import { Hono, type Context } from 'hono'
import type { AppContext } from '../lib/types'
import { checkRateLimit, ensureAuth } from '../lib/helpers'
import creatorSharingImport from './creator-sharing-import'
import {
  CREATOR_SHARING_SNAPSHOT_VERSION,
  buildAffiliateUrl,
  canonicalCreatorTiming,
  canonicalJson,
  creatorTimingLabel,
  creatorSharingEnabled,
  dateWindowAllows,
  generateShareToken,
  isSupportedCreatorShareSnapshotVersion,
  parseCreatorShareSnapshot,
  snapshotHash,
  validateProductTargetUrl,
  validateCreatorStatement,
  type CreatorLinkBindingSnapshot,
  type CreatorShareSnapshot,
  type CreatorShareSnapshotItem,
} from '../lib/creator-sharing'
import {
  getParty,
  getPlatformParty,
  hasPartyAccess,
  loadCreatorTimingLabels,
  loadMainIngredientIds,
  parseStoredSnapshot,
  publicProfileImageUrl,
  SNAPSHOT_RELATION_SIGNATURE_SQL_GUARD,
  snapshotRelationSignatureJson,
  validateSnapshotRelations,
  type AffiliateVersionRow,
  type ValidatedSnapshotRelations,
} from '../lib/creator-sharing-service'
import { drainLegacyCreatorShareNotifications } from '../lib/creator-share-notifications'

const creatorSharing = new Hono<AppContext>()
creatorSharing.route('/', creatorSharingImport)

type ShareRow = {
  id: number
  token: string
  entity_type: 'dose_recommendation' | 'stack'
  entity_id: number
  snapshot_json: string
  creator_user_id: number | null
  creator_party_id: number | null
  snapshot_schema_version: number | null
  snapshot_hash: string | null
  views: number
  imports: number
  expires_at: number | null
  is_revoked: number
  moderation_status: 'pending' | 'approved' | 'blocked'
  created_at: number
  version: number
  moderation_reason: string | null
  moderation_target: 'general' | 'title' | 'creator_statement' | 'product' | null
  moderation_item_index: number | null
  paused_at: number | null
  archived_at: number | null
  supersedes_share_link_id: number | null
  legacy_provenance_status: 'ambiguous' | null
}

type CreatorShareStatus = 'pending' | 'approved' | 'blocked' | 'paused' | 'revoked' | 'expired'

type PreviewProductRow = {
  id: number
  name: string
  brand: string | null
  image_url: string | null
}

type CreatorShareListRow = ShareRow & {
  source_stack_id: number | null
  source_stack_name: string | null
}

type StackShareSourceRow = {
  stack_item_id: number
  stack_item_version: number
  stack_name: string
  catalog_product_id: number
  user_product_id: number | null
  quantity: number
  serving_unit: string | null
  intake_interval_days: number | null
  dosage_text: string | null
  stack_item_timing: string | null
  timing: string | null
  product_timing: string | null
  timing_product_ingredient_id: number | null
  timing_ingredient_id: number | null
  timing_form_id: number | null
  timing_is_main: number | null
  timing_search_relevant: number | null
  timing_form_profile_id: number | null
  timing_form_profile_version: number | null
  timing_form_profile_timing: string | null
  timing_base_profile_id: number | null
  timing_base_profile_version: number | null
  timing_base_profile_timing: string | null
  sort_order: number
  source_share_link_id: number | null
  creator_statement_snapshot: string | null
  amount_source: string | null
  shop_link_id: number
  url: string
  shop_domain_id: number | null
  shop_domain: string | null
  link_kind: 'base_target' | 'legacy_resolved' | null
  legacy_party_id: number | null
  active: number
  blocked_at: string | null
}

function sourceStackItemsSignatureJson(rows: readonly StackShareSourceRow[]): string {
  return JSON.stringify([...rows]
    .sort((left, right) => left.sort_order - right.sort_order || left.stack_item_id - right.stack_item_id)
    .map((row) => ({
      id: row.stack_item_id,
      version: row.stack_item_version,
      catalog_product_id: row.catalog_product_id,
      user_product_id: row.user_product_id,
      quantity: row.quantity,
      serving_unit: row.serving_unit,
      intake_interval_days: row.intake_interval_days,
      dosage_text: row.dosage_text,
      stack_item_timing: row.stack_item_timing,
      timing: row.timing,
      product_timing: row.product_timing,
      timing_product_ingredient_id: row.timing_product_ingredient_id,
      timing_ingredient_id: row.timing_ingredient_id,
      timing_form_id: row.timing_form_id,
      timing_is_main: row.timing_is_main,
      timing_search_relevant: row.timing_search_relevant,
      timing_form_profile_id: row.timing_form_profile_id,
      timing_form_profile_version: row.timing_form_profile_version,
      timing_form_profile_timing: row.timing_form_profile_timing,
      timing_base_profile_id: row.timing_base_profile_id,
      timing_base_profile_version: row.timing_base_profile_version,
      timing_base_profile_timing: row.timing_base_profile_timing,
      sort_order: row.sort_order,
      source_share_link_id: row.source_share_link_id,
      creator_statement_snapshot: row.creator_statement_snapshot,
      amount_source: row.amount_source,
      selected_shop_link_id: row.shop_link_id,
    })))
}

const SOURCE_STACK_ITEMS_SQL_GUARD = `
  AND (
    SELECT COUNT(*)
    FROM stack_items current_item
    WHERE current_item.stack_id = source_stack.id
      AND (? IS NULL OR current_item.id = ?)
  ) = json_array_length(?)
  AND NOT EXISTS (
    SELECT 1
    FROM json_each(?) expected_item
    LEFT JOIN stack_items current_item
      ON current_item.id = json_extract(expected_item.value, '$.id')
     AND current_item.stack_id = source_stack.id
    LEFT JOIN products current_product ON current_product.id = current_item.catalog_product_id
    LEFT JOIN product_ingredients current_pi_main ON current_pi_main.id = (
      SELECT candidate_ingredient.id
      FROM product_ingredients candidate_ingredient
      WHERE candidate_ingredient.product_id = current_product.id
      ORDER BY candidate_ingredient.is_main DESC,
        candidate_ingredient.search_relevant DESC,
        candidate_ingredient.id ASC
      LIMIT 1
    )
    LEFT JOIN ingredient_display_profiles current_idp_form
      ON current_idp_form.ingredient_id = current_pi_main.ingredient_id
     AND current_idp_form.form_id = current_pi_main.form_id
     AND current_idp_form.part_id IS NULL
     AND current_idp_form.sub_ingredient_id IS NULL
    LEFT JOIN ingredient_display_profiles current_idp_base
      ON current_idp_base.ingredient_id = current_pi_main.ingredient_id
     AND current_idp_base.form_id IS NULL
     AND current_idp_base.part_id IS NULL
     AND current_idp_base.sub_ingredient_id IS NULL
    WHERE current_item.id IS NOT json_extract(expected_item.value, '$.id')
      OR current_item.version IS NOT json_extract(expected_item.value, '$.version')
      OR current_item.catalog_product_id IS NOT json_extract(expected_item.value, '$.catalog_product_id')
      OR current_item.user_product_id IS NOT json_extract(expected_item.value, '$.user_product_id')
      OR current_item.quantity IS NOT json_extract(expected_item.value, '$.quantity')
      OR current_product.serving_unit IS NOT json_extract(expected_item.value, '$.serving_unit')
      OR current_item.intake_interval_days IS NOT json_extract(expected_item.value, '$.intake_interval_days')
      OR current_item.dosage_text IS NOT json_extract(expected_item.value, '$.dosage_text')
      OR current_item.timing IS NOT json_extract(expected_item.value, '$.stack_item_timing')
      OR COALESCE(
        current_item.timing,
        current_idp_form.timing,
        current_idp_base.timing,
        current_product.timing
      ) IS NOT json_extract(expected_item.value, '$.timing')
      OR current_product.timing IS NOT json_extract(expected_item.value, '$.product_timing')
      OR current_pi_main.id IS NOT json_extract(expected_item.value, '$.timing_product_ingredient_id')
      OR current_pi_main.ingredient_id IS NOT json_extract(expected_item.value, '$.timing_ingredient_id')
      OR current_pi_main.form_id IS NOT json_extract(expected_item.value, '$.timing_form_id')
      OR current_pi_main.is_main IS NOT json_extract(expected_item.value, '$.timing_is_main')
      OR current_pi_main.search_relevant IS NOT json_extract(expected_item.value, '$.timing_search_relevant')
      OR current_idp_form.id IS NOT json_extract(expected_item.value, '$.timing_form_profile_id')
      OR current_idp_form.version IS NOT json_extract(expected_item.value, '$.timing_form_profile_version')
      OR current_idp_form.timing IS NOT json_extract(expected_item.value, '$.timing_form_profile_timing')
      OR current_idp_base.id IS NOT json_extract(expected_item.value, '$.timing_base_profile_id')
      OR current_idp_base.version IS NOT json_extract(expected_item.value, '$.timing_base_profile_version')
      OR current_idp_base.timing IS NOT json_extract(expected_item.value, '$.timing_base_profile_timing')
      OR current_item.sort_order IS NOT json_extract(expected_item.value, '$.sort_order')
      OR current_item.source_share_link_id IS NOT json_extract(expected_item.value, '$.source_share_link_id')
      OR current_item.creator_statement_snapshot IS NOT json_extract(expected_item.value, '$.creator_statement_snapshot')
      OR current_item.amount_source IS NOT json_extract(expected_item.value, '$.amount_source')
      OR COALESCE(
        (
          SELECT binding.shop_link_id
          FROM stack_item_link_bindings binding
          WHERE binding.stack_item_id = current_item.id
        ),
        (
          SELECT candidate.id
          FROM product_shop_links candidate
          WHERE candidate.product_id = current_item.catalog_product_id
            AND candidate.active = 1
            AND candidate.blocked_at IS NULL
            AND candidate.link_kind IS NOT NULL
            AND candidate.shop_domain_id IS NOT NULL
          ORDER BY candidate.is_primary DESC,
            CASE WHEN candidate.link_kind = 'base_target' THEN 0 ELSE 1 END,
            candidate.sort_order ASC,
            candidate.id ASC
          LIMIT 1
        )
      ) IS NOT json_extract(expected_item.value, '$.selected_shop_link_id')
  )
`

function ensureFeature(c: Context<AppContext>): Response | null {
  return creatorSharingEnabled(c.env) ? null : c.json({ error: 'Not found' }, 404)
}

function setPublicShareResponseHeaders(c: Context<AppContext>): void {
  c.header('Cache-Control', 'private, no-store')
  c.header('X-Robots-Tag', 'noindex, nofollow, noarchive')
  c.header('Referrer-Policy', 'no-referrer')
}

function positiveInteger(value: unknown): number | null {
  const parsed = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : Number.NaN
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null
}

function boundedText(value: unknown, maximum: number): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed && trimmed.length <= maximum ? trimmed : null
}

function parseSourceShareGuard(value: unknown): { value?: SourceShareGuard; error?: string } {
  if (value === undefined) return {}
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return { error: 'Die Angaben der ursprünglichen Empfehlung fehlen.' }
  }
  const input = value as Record<string, unknown>
  const shareId = positiveInteger(input.share_id)
  const expectedSnapshotHash = boundedText(input.expected_snapshot_hash, 64)
  const expectedStatus = input.expected_status === 'blocked'
    || input.expected_status === 'revoked'
    || input.expected_status === 'expired'
    ? input.expected_status
    : null
  const expectedModerationStatus = input.expected_moderation_status === 'pending'
    || input.expected_moderation_status === 'approved'
    || input.expected_moderation_status === 'blocked'
    ? input.expected_moderation_status
    : null
  const expectedIsRevoked = input.expected_is_revoked === 0 || input.expected_is_revoked === 1
    ? input.expected_is_revoked
    : null
  const expectedExpiresAt = input.expected_expires_at === null
    ? null
    : positiveInteger(input.expected_expires_at)
  const expectedVersion = positiveInteger(input.expected_version)
  if (
    !shareId
    || !expectedSnapshotHash
    || !/^[a-f0-9]{64}$/.test(expectedSnapshotHash)
    || !expectedStatus
    || !expectedModerationStatus
    || expectedIsRevoked === null
    || !expectedVersion
    || (input.expected_expires_at !== null && expectedExpiresAt === null)
  ) {
    return { error: 'Die Angaben der ursprünglichen Empfehlung sind unvollständig.' }
  }
  return {
    value: {
      shareId,
      expectedSnapshotHash,
      expectedStatus,
      expectedModerationStatus,
      expectedIsRevoked,
      expectedExpiresAt,
      expectedVersion,
    },
  }
}

function hasOwnKey(value: object, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(value, key)
}

function d1Changes(result: D1Result<unknown>): number {
  const value = Number((result.meta as { changes?: number } | undefined)?.changes ?? 0)
  return Number.isFinite(value) ? value : 0
}

async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))
  return [...new Uint8Array(digest)]
    .map((part) => part.toString(16).padStart(2, '0'))
    .join('')
}

type StackExpectedSourceRow = {
  stack_item_id: number
  product_name: string
  catalog_product_id: number | null
  user_product_id: number | null
  published_product_id: number | null
  intake_interval_days: number | null
  moderation_status: string | null
  visibility: string | null
  owner_party_id: number | null
  owner_status: string | null
  owner_auto_catalog_approval: number | null
}

type ShareReadinessReasonCode =
  | 'product_missing'
  | 'own_product_not_published'
  | 'not_approved'
  | 'not_visible'
  | 'owner_inactive'
  | 'shop_link_missing'
  | 'shop_link_unsafe'
  | 'intake_missing'
  | 'main_ingredient_missing'

type ShareRepairKind = 'own_product' | 'stack_product' | 'contact_owner'

type UnshareableProduct = {
  stack_item_id: number
  product_name: string
  shareable: false
  reason_code: ShareReadinessReasonCode
  repair_kind: ShareRepairKind
}

type ShareableProduct = {
  stack_item_id: number
  product_name: string
  shareable: true
  reason_code: null
  repair_kind: null
}

type SourceShareGuard = {
  shareId: number
  expectedSnapshotHash: string
  expectedStatus: 'blocked' | 'revoked' | 'expired'
  expectedModerationStatus: 'pending' | 'approved' | 'blocked'
  expectedIsRevoked: 0 | 1
  expectedExpiresAt: number | null
  expectedVersion: number
}

function creatorShareStatus(row: ShareRow, nowSeconds = Math.floor(Date.now() / 1000)): CreatorShareStatus {
  if (row.moderation_status === 'blocked') return 'blocked'
  if (row.legacy_provenance_status === 'ambiguous') return 'revoked'
  if (row.is_revoked === 1) return 'revoked'
  if (row.expires_at !== null && row.expires_at <= nowSeconds) return 'expired'
  if (row.moderation_status === 'pending') return 'pending'
  if (row.paused_at !== null) return 'paused'
  return 'approved'
}

function statementMap(value: unknown): Map<number, string | null> | null {
  if (value === undefined || value === null) return new Map()
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const result = new Map<number, string | null>()
  for (const [key, raw] of Object.entries(value as Record<string, unknown>)) {
    const itemId = positiveInteger(key)
    const statement = validateCreatorStatement(raw)
    if (!itemId || statement.error) return null
    result.set(itemId, statement.value ?? null)
  }
  return result
}

// POST /api/creator-sharing/internal/notification-drain
// The deploy process stores only a SHA-256 hash in D1 and sends the raw,
// single-run capability over HTTPS. No SMTP credential or long-lived public
// secret is introduced, and event-level CAS claims make retries idempotent.
creatorSharing.post('/internal/notification-drain', async (c) => {
  const runKey = c.req.header('X-Creator-Drain-Run')?.trim() ?? ''
  const authorization = c.req.header('Authorization') ?? ''
  const nonceMatch = /^Bearer ([0-9a-f]{64})$/.exec(authorization)
  if (!/^[A-Za-z0-9._-]{1,120}$/.test(runKey) || !nonceMatch) {
    return c.json({ error: 'Not found' }, 404)
  }
  const capabilityHash = await sha256Hex(nonceMatch[1])
  const run = await c.env.DB.prepare(`
    SELECT drain.status
    FROM creator_share_notification_drain_runs drain
    JOIN creator_share_workflow_rollouts rollout
      ON rollout.rollout_key = 'creator_portfolio_v1' AND rollout.phase = 'active'
    WHERE drain.run_key = ? AND drain.capability_hash = ?
  `).bind(runKey, capabilityHash).first<{ status: 'ready' | 'running' | 'complete' }>()
  if (!run) return c.json({ error: 'Not found' }, 404)
  if (run.status === 'complete') {
    return c.json({ ok: true, complete: true, claimed: 0, pending: 0, sending: 0, failed: 0 })
  }
  const runClaim = await c.env.DB.prepare(`
    UPDATE creator_share_notification_drain_runs
    SET status = 'running', started_at = COALESCE(started_at, CURRENT_TIMESTAMP)
    WHERE run_key = ? AND capability_hash = ? AND status IN ('ready', 'running')
  `).bind(runKey, capabilityHash).run()
  if (d1Changes(runClaim) !== 1) {
    return c.json({ error: 'Drain state conflict' }, 409)
  }

  const result = await drainLegacyCreatorShareNotifications(c.env, runKey)
  if (result.failed > 0 || result.sending > 0) {
    return c.json({ ok: false, ...result }, 503)
  }
  if (!result.complete) return c.json({ ok: true, ...result }, 202)

  const completed = await c.env.DB.prepare(`
    UPDATE creator_share_notification_drain_runs
    SET status = 'complete', completed_at = COALESCE(completed_at, CURRENT_TIMESTAMP)
    WHERE run_key = ? AND capability_hash = ? AND status = 'running'
  `).bind(runKey, capabilityHash).run()
  if (d1Changes(completed) !== 1) {
    const latest = await c.env.DB.prepare(`
      SELECT status
      FROM creator_share_notification_drain_runs
      WHERE run_key = ? AND capability_hash = ?
    `).bind(runKey, capabilityHash).first<{ status: string }>()
    if (latest?.status !== 'complete') return c.json({ error: 'Drain state conflict' }, 409)
  }
  return c.json({ ok: true, ...result, complete: true })
})

// GET /api/creator-sharing/parties
creatorSharing.get('/parties', async (c) => {
  const featureErr = ensureFeature(c)
  if (featureErr) return featureErr
  const authErr = await ensureAuth(c)
  if (authErr) return authErr
  const user = c.get('user')
  const { results } = await c.env.DB.prepare(`
    SELECT party.id, party.type, party.name, party.slug, party.status,
      membership.role
    FROM party_memberships membership
    JOIN parties party ON party.id = membership.party_id
    WHERE membership.user_id = ? AND membership.status = 'active'
      AND party.type IN ('creator', 'brand')
    ORDER BY CASE party.status WHEN 'active' THEN 0 ELSE 1 END,
      party.name COLLATE NOCASE, party.id
  `).bind(user.userId).all()
  const memberships = results ?? []
  const parties = memberships.filter((party) => party.status === 'active')
  const accessState = parties.length > 0
    ? 'active'
    : memberships.some((party) => party.status === 'blocked')
      ? 'blocked'
      : 'not_invited'
  return c.json({ access_state: accessState, parties })
})

async function loadShare(
  db: D1Database,
  token: string,
  approvedOnly: boolean,
): Promise<{
  row?: ShareRow
  snapshot?: CreatorShareSnapshot
  relations?: ValidatedSnapshotRelations
  error?: string
  status?: number
}> {
  if (!/^[A-Za-z0-9_-]{24,80}$/.test(token)) return { error: 'Share nicht gefunden.', status: 404 }
  const row = await db.prepare(`
    SELECT *
    FROM share_links
    WHERE token = ?
      AND is_revoked = 0
      AND legacy_provenance_status IS NULL
      AND paused_at IS NULL
      AND (expires_at IS NULL OR expires_at > strftime('%s', 'now'))
      AND EXISTS (
        SELECT 1 FROM parties party
        WHERE party.id = share_links.creator_party_id AND party.status = 'active'
      )
      ${approvedOnly ? "AND moderation_status = 'approved'" : ''}
    LIMIT 1
  `).bind(token).first<ShareRow>()
  if (!row) return { error: 'Share nicht gefunden oder nicht mehr verfügbar.', status: 404 }
  if (!isSupportedCreatorShareSnapshotVersion(row.snapshot_schema_version) || !row.snapshot_hash) {
    return { error: 'Share besitzt keinen unterstützten Snapshot.', status: 409 }
  }
  const parsed = parseStoredSnapshot(row.snapshot_json)
  if (!parsed.value) return { error: parsed.error ?? 'Share-Snapshot ist ungültig.', status: 409 }
  const computedHash = await snapshotHash(parsed.value)
  if (computedHash !== row.snapshot_hash) return { error: 'Share-Snapshot stimmt nicht mit seinem Hash überein.', status: 409 }
  if (parsed.value.creator_party_id !== row.creator_party_id || parsed.value.type !== row.entity_type) {
    return { error: 'Share-Metadaten stimmen nicht mit dem Snapshot überein.', status: 409 }
  }
  const relations = await validateSnapshotRelations(db, parsed.value)
  if (!relations.value) return { error: relations.error ?? 'Share-Relationen sind ungültig.', status: 409 }
  return { row, snapshot: parsed.value, relations: relations.value }
}

async function parseCreatorShareRow(
  row: ShareRow,
): Promise<{ snapshot?: CreatorShareSnapshot; error?: string }> {
  if (!isSupportedCreatorShareSnapshotVersion(row.snapshot_schema_version) || !row.snapshot_hash) {
    return { error: 'Empfehlung besitzt keinen unterstützten Stand.' }
  }
  const parsed = parseStoredSnapshot(row.snapshot_json)
  if (!parsed.value) return { error: parsed.error ?? 'Gespeicherter Stand ist ungültig.' }
  const computedHash = await snapshotHash(parsed.value)
  if (computedHash !== row.snapshot_hash) return { error: 'Gespeicherter Stand konnte nicht geprüft werden.' }
  if (parsed.value.creator_party_id !== row.creator_party_id || parsed.value.type !== row.entity_type) {
    return { error: 'Empfehlung und gespeicherter Stand passen nicht zusammen.' }
  }
  return { snapshot: parsed.value }
}

async function creatorPreviewPayload(
  db: D1Database,
  row: ShareRow,
  snapshot: CreatorShareSnapshot,
): Promise<Record<string, unknown> | null> {
  const party = await getParty(db, snapshot.creator_party_id)
  if (!party || party.status !== 'active') return null
  const productIds = [...new Set(snapshot.items.map((item) => item.catalog_product_id))]
  const productById = new Map<number, PreviewProductRow>()
  const timingLabels = new Map<string, string>()
  if (productIds.length > 0) {
    const placeholders = productIds.map(() => '?').join(',')
    const { results } = await db.prepare(`
      SELECT
        product.id,
        product.name,
        product.brand,
        product.image_url
      FROM products product
      WHERE product.id IN (${placeholders})
    `).bind(...productIds).all<PreviewProductRow>()
    for (const product of results ?? []) productById.set(product.id, product)
  }
  for (const [value, label] of await loadCreatorTimingLabels(db)) timingLabels.set(value, label)
  const profileImage = publicProfileImageUrl(party.public_profile_image_url)
  return {
    token: row.token,
    type: snapshot.type,
    title: snapshot.title,
    creator: {
      id: party.id,
      name: party.name,
      type: party.type,
      slug: party.slug,
      profile_image_url: profileImage.ok ? profileImage.value : null,
    },
    published_at: snapshot.published_at,
    items: snapshot.items.map((item) => {
      const product = productById.get(item.catalog_product_id)
      const canonicalTiming = canonicalCreatorTiming(item.timing)
      const publicTiming = canonicalTiming
        && creatorTimingLabel(item.timing, timingLabels) !== 'Keine Angabe'
        ? canonicalTiming
        : null
      return {
        catalog_product_id: item.catalog_product_id,
        product_name: product?.name ?? null,
        brand: product?.brand ?? null,
        image_url: product?.image_url ?? null,
        quantity: item.quantity,
        unit: item.unit ?? null,
        intake_interval_days: item.intake_interval_days,
        dosage_text: item.dosage_text,
        timing: publicTiming,
        timing_label: creatorTimingLabel(item.timing, timingLabels),
        creator_statement: item.creator_statement,
      }
    }),
  }
}

async function currentAffiliateVersions(
  db: D1Database,
  partyIds: number[],
  shopDomainIds: number[],
): Promise<Map<string, AffiliateVersionRow>> {
  const result = new Map<string, AffiliateVersionRow>()
  const parties = [...new Set(partyIds)]
  const shops = [...new Set(shopDomainIds)]
  if (parties.length === 0 || shops.length === 0) return result
  const partyPlaceholders = parties.map(() => '?').join(',')
  const shopPlaceholders = shops.map(() => '?').join(',')
  const { results } = await db.prepare(`
    SELECT
      av.id,
      av.party_id,
      av.shop_domain_id,
      av.version,
      av.code,
      av.link_template,
      av.tracking_domain,
      av.status,
      av.valid_from,
      av.valid_until,
      party.status AS party_status
    FROM party_shop_affiliate_versions av
    JOIN parties party ON party.id = av.party_id
    WHERE av.party_id IN (${partyPlaceholders})
      AND av.shop_domain_id IN (${shopPlaceholders})
      AND av.status = 'current'
      AND party.status = 'active'
  `).bind(...parties, ...shops).all<AffiliateVersionRow>()
  for (const row of results ?? []) {
    if (dateWindowAllows(row.valid_from, row.valid_until)) result.set(`${row.party_id}:${row.shop_domain_id}`, row)
  }
  return result
}

function bindingFromLoadedVersions(
  target: StackShareSourceRow,
  creatorPartyId: number,
  platformPartyId: number,
  versions: Map<string, AffiliateVersionRow>,
): CreatorLinkBindingSnapshot | null {
  if (target.active !== 1 || !target.shop_domain_id || !target.shop_domain || target.blocked_at || !target.link_kind) return null
  const safeTarget = validateProductTargetUrl(target.url, target.shop_domain)
  if (!safeTarget.url) return null
  if (target.link_kind === 'legacy_resolved') {
    return target.legacy_party_id
      ? { resolution_kind: 'legacy_resolved', affiliate_version_id: null, resolved_party_id: target.legacy_party_id }
      : null
  }
  const creatorVersion = versions.get(`${creatorPartyId}:${target.shop_domain_id}`)
  if (creatorVersion && buildAffiliateUrl({
    code: creatorVersion.code,
    linkTemplate: creatorVersion.link_template,
    productUrl: safeTarget.url,
    shopDomain: target.shop_domain,
    trackingDomain: creatorVersion.tracking_domain,
  }).url) {
    return {
      resolution_kind: 'creator_version',
      affiliate_version_id: creatorVersion.id,
      resolved_party_id: creatorPartyId,
    }
  }
  const platformVersion = versions.get(`${platformPartyId}:${target.shop_domain_id}`)
  if (platformVersion && buildAffiliateUrl({
    code: platformVersion.code,
    linkTemplate: platformVersion.link_template,
    productUrl: safeTarget.url,
    shopDomain: target.shop_domain,
    trackingDomain: platformVersion.tracking_domain,
  }).url) {
    return {
      resolution_kind: 'platform_version',
      affiliate_version_id: platformVersion.id,
      resolved_party_id: platformPartyId,
    }
  }
  return { resolution_kind: 'bare', affiliate_version_id: null, resolved_party_id: null }
}

async function loadShareSourceRows(
  db: D1Database,
  userId: number,
  creatorPartyId: number,
  stackId: number,
  stackItemId: number | null,
): Promise<{
  rows?: StackShareSourceRow[]
  error?: string
  errorCode?: 'STACK_NOT_FOUND' | 'STACK_NOT_FULLY_SHAREABLE'
  unshareableProducts?: UnshareableProduct[]
  shareableRows?: StackShareSourceRow[]
  products?: Array<UnshareableProduct | ShareableProduct>
  stackVersion?: number
}> {
  const stack = await db.prepare('SELECT id, version FROM stacks WHERE id = ? AND user_id = ? AND deleted_at IS NULL')
    .bind(stackId, userId).first<{ id: number; version: number }>()
  if (!stack) return { error: 'Stack nicht gefunden.', errorCode: 'STACK_NOT_FOUND' }
  const expectedResult = await db.prepare(`
    SELECT
      si.id AS stack_item_id,
      COALESCE(p.name, up.name, 'Nicht mehr verfügbares Produkt') AS product_name,
      si.catalog_product_id,
      si.user_product_id,
      up.published_product_id,
      si.intake_interval_days,
      p.moderation_status,
      p.visibility,
      p.owner_party_id,
      owner.status AS owner_status,
      owner.auto_catalog_approval AS owner_auto_catalog_approval
    FROM stack_items si
    LEFT JOIN products p ON p.id = si.catalog_product_id
    LEFT JOIN user_products up ON up.id = si.user_product_id
    LEFT JOIN parties owner ON owner.id = p.owner_party_id
    WHERE si.stack_id = ?
      AND (? IS NULL OR si.id = ?)
    ORDER BY si.sort_order ASC, si.id ASC
  `).bind(stackId, stackItemId, stackItemId).all<StackExpectedSourceRow>()
  const expected = expectedResult.results ?? []

  const { results } = await db.prepare(`
    SELECT
      si.id AS stack_item_id,
      si.version AS stack_item_version,
      s.name AS stack_name,
      si.catalog_product_id,
      si.user_product_id,
      si.quantity,
      p.serving_unit,
      si.intake_interval_days,
      si.dosage_text,
      si.timing AS stack_item_timing,
      COALESCE(si.timing, idp_form.timing, idp_base.timing, p.timing) AS timing,
      p.timing AS product_timing,
      pi_main.id AS timing_product_ingredient_id,
      pi_main.ingredient_id AS timing_ingredient_id,
      pi_main.form_id AS timing_form_id,
      pi_main.is_main AS timing_is_main,
      pi_main.search_relevant AS timing_search_relevant,
      idp_form.id AS timing_form_profile_id,
      idp_form.version AS timing_form_profile_version,
      idp_form.timing AS timing_form_profile_timing,
      idp_base.id AS timing_base_profile_id,
      idp_base.version AS timing_base_profile_version,
      idp_base.timing AS timing_base_profile_timing,
      si.sort_order,
      si.source_share_link_id,
      si.creator_statement_snapshot,
      si.amount_source,
      psl.id AS shop_link_id,
      psl.url,
      psl.shop_domain_id,
      sd.domain AS shop_domain,
      psl.link_kind,
      psl.legacy_party_id,
      psl.active,
      psl.blocked_at
    FROM stacks s
    JOIN stack_items si ON si.stack_id = s.id
    JOIN products p ON p.id = si.catalog_product_id
    JOIN product_shop_links psl ON psl.id = COALESCE(
      (SELECT binding.shop_link_id FROM stack_item_link_bindings binding WHERE binding.stack_item_id = si.id),
      (
        SELECT candidate.id
        FROM product_shop_links candidate
        WHERE candidate.product_id = p.id
          AND candidate.active = 1
          AND candidate.blocked_at IS NULL
          AND candidate.link_kind IS NOT NULL
          AND candidate.shop_domain_id IS NOT NULL
        ORDER BY candidate.is_primary DESC,
          CASE WHEN candidate.link_kind = 'base_target' THEN 0 ELSE 1 END,
          candidate.sort_order ASC,
          candidate.id ASC
        LIMIT 1
      )
    ) AND psl.product_id = p.id
    JOIN shop_domains sd ON sd.id = psl.shop_domain_id
    LEFT JOIN product_ingredients pi_main ON pi_main.id = (
      SELECT candidate_ingredient.id
      FROM product_ingredients candidate_ingredient
      WHERE candidate_ingredient.product_id = p.id
      ORDER BY candidate_ingredient.is_main DESC,
        candidate_ingredient.search_relevant DESC,
        candidate_ingredient.id ASC
      LIMIT 1
    )
    LEFT JOIN ingredient_display_profiles idp_form
      ON idp_form.ingredient_id = pi_main.ingredient_id
     AND idp_form.form_id = pi_main.form_id
     AND idp_form.part_id IS NULL
     AND idp_form.sub_ingredient_id IS NULL
    LEFT JOIN ingredient_display_profiles idp_base
      ON idp_base.ingredient_id = pi_main.ingredient_id
     AND idp_base.form_id IS NULL
     AND idp_base.part_id IS NULL
     AND idp_base.sub_ingredient_id IS NULL
    LEFT JOIN parties owner ON owner.id = p.owner_party_id
    WHERE s.id = ?
      AND s.user_id = ?
      AND s.deleted_at IS NULL
      AND si.catalog_product_id IS NOT NULL
      AND p.moderation_status = 'approved'
      AND owner.status = 'active'
      AND (
        p.visibility = 'public'
        OR (p.visibility = 'auto' AND owner.auto_catalog_approval = 1)
        OR (p.owner_party_id = ? AND p.visibility <> 'hidden')
      )
      AND (? IS NULL OR si.id = ?)
    ORDER BY si.sort_order ASC, si.id ASC
  `).bind(stackId, userId, creatorPartyId, stackItemId, stackItemId).all<StackShareSourceRow>()
  const candidateRows = results ?? []
  const eligibleRows = candidateRows.filter((row) => (
    row.active === 1
      && row.blocked_at === null
      && row.link_kind !== null
      && row.shop_domain_id !== null
      && Number.isSafeInteger(row.intake_interval_days)
      && Number(row.intake_interval_days) > 0
      && Boolean(row.shop_domain && validateProductTargetUrl(row.url, row.shop_domain).url)
      && (row.link_kind !== 'legacy_resolved' || Boolean(row.legacy_party_id))
  ))
  const catalogProductIds = expected
    .map((item) => item.catalog_product_id)
    .filter((id): id is number => id !== null)
  const mainIds = await loadMainIngredientIds(db, catalogProductIds)
  const linkCountByProduct = new Map<number, number>()
  if (catalogProductIds.length > 0) {
    const uniqueIds = [...new Set(catalogProductIds)]
    const placeholders = uniqueIds.map(() => '?').join(',')
    const linkCounts = await db.prepare(`
      SELECT product_id, COUNT(*) AS count
      FROM product_shop_links
      WHERE product_id IN (${placeholders})
      GROUP BY product_id
    `).bind(...uniqueIds).all<{ product_id: number; count: number }>()
    for (const row of linkCounts.results ?? []) linkCountByProduct.set(row.product_id, Number(row.count))
  }
  const candidateByItem = new Map(candidateRows.map((row) => [row.stack_item_id, row]))
  const eligibleByItem = new Map(eligibleRows.map((row) => [row.stack_item_id, row]))
  const products: Array<UnshareableProduct | ShareableProduct> = expected.map((item) => {
    const base = { stack_item_id: item.stack_item_id, product_name: item.product_name }
    const unavailable = (reason_code: ShareReadinessReasonCode, repair_kind: ShareRepairKind): UnshareableProduct => ({
      ...base,
      shareable: false,
      reason_code,
      repair_kind,
    })
    if (item.catalog_product_id === null) {
      if (item.user_product_id === null) return unavailable('product_missing', 'stack_product')
      return item.published_product_id === null
        ? unavailable('own_product_not_published', 'own_product')
        : unavailable('product_missing', 'stack_product')
    }
    if (item.moderation_status === null) return unavailable('product_missing', 'stack_product')
    if (item.moderation_status !== 'approved') return unavailable('not_approved', 'stack_product')
    if (item.owner_status !== 'active') return unavailable('owner_inactive', 'contact_owner')
    const contextVisible = item.visibility === 'public'
      || (item.visibility === 'auto' && item.owner_auto_catalog_approval === 1)
      || (item.owner_party_id === creatorPartyId && item.visibility !== 'hidden')
    if (!contextVisible) return unavailable('not_visible', 'stack_product')
    if (!Number.isSafeInteger(item.intake_interval_days) || Number(item.intake_interval_days) <= 0) {
      return unavailable('intake_missing', 'stack_product')
    }
    if ((mainIds.get(item.catalog_product_id) ?? []).length === 0) {
      return unavailable('main_ingredient_missing', 'contact_owner')
    }
    const candidate = candidateByItem.get(item.stack_item_id)
    if (!candidate) {
      return unavailable(
        (linkCountByProduct.get(item.catalog_product_id) ?? 0) > 0 ? 'shop_link_unsafe' : 'shop_link_missing',
        'stack_product',
      )
    }
    if (!eligibleByItem.has(item.stack_item_id)) return unavailable('shop_link_unsafe', 'stack_product')
    return { ...base, shareable: true, reason_code: null, repair_kind: null }
  })
  const shareableIds = new Set(products.filter((item) => item.shareable).map((item) => item.stack_item_id))
  const shareableRows = eligibleRows.filter((row) => shareableIds.has(row.stack_item_id))
  const unshareableProducts = products.filter((item): item is UnshareableProduct => !item.shareable)
  if (expected.length === 0 || unshareableProducts.length > 0 || shareableRows.length !== expected.length) {
    return {
      error: expected.length === 0
        ? 'Dieser Stack enthält noch kein Produkt, das geteilt werden kann.'
        : 'Mindestens ein Produkt aus diesem Stack kann noch nicht geteilt werden.',
      errorCode: 'STACK_NOT_FULLY_SHAREABLE',
      unshareableProducts,
      shareableRows,
      products,
    }
  }
  return { rows: shareableRows, products, stackVersion: stack.version }
}

// GET /api/creator-sharing/stacks/:id/share-readiness?party_id=...
creatorSharing.get('/stacks/:id/share-readiness', async (c) => {
  const featureErr = ensureFeature(c)
  if (featureErr) return featureErr
  const authErr = await ensureAuth(c)
  if (authErr) return authErr
  const stackId = positiveInteger(c.req.param('id'))
  const partyId = positiveInteger(c.req.query('party_id'))
  if (!stackId || !partyId) return c.json({ error: 'Stack oder Creator fehlt.' }, 400)
  const user = c.get('user')
  if (!(await hasPartyAccess(c.env.DB, user.userId, partyId, ['owner', 'editor', 'viewer']))) {
    return c.json({ error: 'Forbidden' }, 403)
  }
  const party = await getParty(c.env.DB, partyId)
  if (!party || party.status !== 'active' || !['creator', 'brand'].includes(party.type)) {
    return c.json({ error: 'Creator oder Marke wurde nicht gefunden.' }, 404)
  }
  const source = await loadShareSourceRows(c.env.DB, user.userId, partyId, stackId, null)
  if (source.errorCode === 'STACK_NOT_FOUND') return c.json({ error: source.error }, 404)
  if (!source.rows) {
    return c.json({
      ready: false,
      shareable_stack_item_ids: (source.shareableRows ?? []).map((row) => row.stack_item_id),
      unshareable_products: source.unshareableProducts ?? [],
      products: source.products ?? [],
    })
  }
  return c.json({
    ready: true,
    shareable_stack_item_ids: source.rows.map((row) => row.stack_item_id),
    unshareable_products: [],
    products: source.products ?? [],
  })
})

const CREATOR_STATUS_SQL = `CASE
  WHEN share.moderation_status = 'blocked' THEN 'blocked'
  WHEN share.is_revoked = 1 THEN 'revoked'
  WHEN share.expires_at IS NOT NULL AND share.expires_at <= strftime('%s', 'now') THEN 'expired'
  WHEN share.moderation_status = 'pending' THEN 'pending'
  WHEN share.paused_at IS NOT NULL THEN 'paused'
  ELSE 'approved'
END`

type CreatorMetricPeriod = {
  days: 30
  from: string
  to: string
  previous_from: string
  previous_to: string
  unique_visitors_definition: string
  saves_definition: string
}

type CreatorMetricWindow = {
  publicPeriod: CreatorMetricPeriod
  currentToExclusive: string
  previousToExclusive: string
}

type CreatorShareMetric = {
  unique_visitors: number
  saves: number
  previous_unique_visitors: number
  previous_saves: number
}

function creatorMetricPeriod(now = new Date()): CreatorMetricWindow {
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
  const from = new Date(today.getTime() - (29 * 24 * 60 * 60 * 1000))
  const currentToExclusive = new Date(today.getTime() + (24 * 60 * 60 * 1000))
  const previousToExclusive = from
  const previousFrom = new Date(previousToExclusive.getTime() - (30 * 24 * 60 * 60 * 1000))
  const previousTo = new Date(previousToExclusive.getTime() - (24 * 60 * 60 * 1000))
  return {
    publicPeriod: {
      days: 30,
      from: from.toISOString(),
      to: today.toISOString(),
      previous_from: previousFrom.toISOString(),
      previous_to: previousTo.toISOString(),
      unique_visitors_definition: 'Erfasst werden nur Besuche mit Zustimmung zur optionalen Nutzungsanalyse. Derselbe Browser zählt im Zeitraum einmal. Besuche ohne Zustimmung fehlen. Automatische Aufrufe werden ausgeschlossen, soweit sie erkennbar sind.',
      saves_definition: 'Gezählt werden abgeschlossene Übernahmen in einen Stack, nicht einzelne Produkte. Wiederholungen desselben Vorgangs zählen nicht erneut. Später rückgängig gemachte Übernahmen bleiben enthalten.',
    },
    currentToExclusive: currentToExclusive.toISOString(),
    previousToExclusive: previousToExclusive.toISOString(),
  }
}

async function loadCreatorShareMetrics(
  db: D1Database,
  shareIds: number[],
  period: CreatorMetricWindow,
): Promise<Map<number, CreatorShareMetric>> {
  const result = new Map<number, CreatorShareMetric>()
  if (shareIds.length === 0) return result
  const placeholders = shareIds.map(() => '?').join(',')
  const [visitors, saves] = await Promise.all([
    db.prepare(`
      SELECT share.id AS share_id,
        COUNT(DISTINCT CASE
          WHEN event.created_at >= datetime(?) AND event.created_at < datetime(?)
          THEN event.visitor_id END
        ) AS current_count,
        COUNT(DISTINCT CASE
          WHEN event.created_at >= datetime(?) AND event.created_at < datetime(?)
          THEN event.visitor_id END
        ) AS previous_count
      FROM share_links share
      LEFT JOIN page_view_events event
        ON event.visitor_id IS NOT NULL
       AND (
         event.path = '/share/' || share.token
         OR (
           substr(event.path, 1, length('/share/' || share.token)) = '/share/' || share.token
           AND substr(event.path, length('/share/' || share.token) + 1, 1) IN ('?', '#')
         )
       )
      WHERE share.id IN (${placeholders})
      GROUP BY share.id
    `).bind(
      period.publicPeriod.from,
      period.currentToExclusive,
      period.publicPeriod.previous_from,
      period.previousToExclusive,
      ...shareIds,
    ).all<{ share_id: number; current_count: number; previous_count: number }>(),
    db.prepare(`
      SELECT share.id AS share_id,
        COALESCE(SUM(CASE
          WHEN operation.created_at >= datetime(?) AND operation.created_at < datetime(?)
          THEN 1 ELSE 0 END
        ), 0) AS current_count,
        COALESCE(SUM(CASE
          WHEN operation.created_at >= datetime(?) AND operation.created_at < datetime(?)
          THEN 1 ELSE 0 END
        ), 0) AS previous_count
      FROM share_links share
      LEFT JOIN share_import_operations operation ON operation.share_link_id = share.id
      WHERE share.id IN (${placeholders})
      GROUP BY share.id
    `).bind(
      period.publicPeriod.from,
      period.currentToExclusive,
      period.publicPeriod.previous_from,
      period.previousToExclusive,
      ...shareIds,
    ).all<{ share_id: number; current_count: number; previous_count: number }>(),
  ])
  for (const shareId of shareIds) {
    result.set(shareId, {
      unique_visitors: 0,
      saves: 0,
      previous_unique_visitors: 0,
      previous_saves: 0,
    })
  }
  for (const row of visitors.results ?? []) {
    const metric = result.get(row.share_id)
    if (metric) {
      metric.unique_visitors = Number(row.current_count)
      metric.previous_unique_visitors = Number(row.previous_count)
    }
  }
  for (const row of saves.results ?? []) {
    const metric = result.get(row.share_id)
    if (metric) {
      metric.saves = Number(row.current_count)
      metric.previous_saves = Number(row.previous_count)
    }
  }
  return result
}

function encodePortfolioCursor(row: Pick<ShareRow, 'created_at' | 'id'>, sort: 'newest' | 'oldest'): string {
  return btoa(JSON.stringify({ created_at: row.created_at, id: row.id, sort }))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '')
}

function parsePortfolioCursor(
  value: string | undefined,
  sort: 'newest' | 'oldest',
): { created_at: number; id: number } | null | undefined {
  if (!value) return null
  if (!/^[A-Za-z0-9_-]{4,200}$/.test(value)) return undefined
  try {
    const normalized = value.replace(/-/g, '+').replace(/_/g, '/')
    const decoded = JSON.parse(atob(normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '='))) as Record<string, unknown>
    const createdAt = positiveInteger(decoded.created_at)
    const id = positiveInteger(decoded.id)
    return createdAt && id && decoded.sort === sort ? { created_at: createdAt, id } : undefined
  } catch {
    return undefined
  }
}

function escapedLike(value: string): string {
  return value.replace(/[\\%_]/g, (match) => `\\${match}`)
}

// GET /api/creator-sharing/creator-shares?party_id=...
creatorSharing.get('/creator-shares', async (c) => {
  const featureErr = ensureFeature(c)
  if (featureErr) return featureErr
  const authErr = await ensureAuth(c)
  if (authErr) return authErr
  const partyId = positiveInteger(c.req.query('party_id'))
  if (!partyId) return c.json({ error: 'Creator oder Marke fehlt.' }, 400)
  const user = c.get('user')
  if (!(await hasPartyAccess(c.env.DB, user.userId, partyId, ['owner', 'editor', 'viewer']))) {
    return c.json({ error: 'Forbidden' }, 403)
  }
  const party = await getParty(c.env.DB, partyId)
  if (!party || party.status !== 'active' || !['creator', 'brand'].includes(party.type)) {
    return c.json({ error: 'Creator oder Marke wurde nicht gefunden.' }, 404)
  }

  const query = (c.req.query('q') ?? '').trim()
  if (query.length > 100) return c.json({ error: 'Die Suche darf höchstens 100 Zeichen lang sein.' }, 400)
  const status = c.req.query('status') ?? 'all'
  const allowedStatuses = new Set(['all', 'pending', 'approved', 'blocked', 'paused', 'revoked', 'expired'])
  if (!allowedStatuses.has(status)) return c.json({ error: 'Unbekannter Statusfilter.' }, 400)
  const archive = c.req.query('archive') ?? 'active'
  if (!['active', 'archived', 'all'].includes(archive)) return c.json({ error: 'Unbekannter Archivfilter.' }, 400)
  const sort = c.req.query('sort') ?? 'newest'
  if (sort !== 'newest' && sort !== 'oldest') return c.json({ error: 'Unbekannte Sortierung.' }, 400)
  const requestedLimit = c.req.query('limit') === undefined ? 20 : positiveInteger(c.req.query('limit'))
  if (!requestedLimit || requestedLimit > 50) return c.json({ error: 'limit muss zwischen 1 und 50 liegen.' }, 400)
  const cursor = parsePortfolioCursor(c.req.query('cursor'), sort)
  if (cursor === undefined) return c.json({ error: 'Der Seitenzeiger ist ungültig.' }, 400)

  const where = ['share.creator_party_id = ?']
  const bindings: Array<string | number> = [partyId]
  if (query) {
    where.push(`lower(CAST(json_extract(share.snapshot_json, '$.title') AS TEXT)) LIKE ? ESCAPE '\\'`)
    bindings.push(`%${escapedLike(query.toLocaleLowerCase('de-DE'))}%`)
  }
  if (status !== 'all') {
    where.push(`(${CREATOR_STATUS_SQL}) = ?`)
    bindings.push(status)
  }
  if (archive === 'active') where.push('share.archived_at IS NULL')
  if (archive === 'archived') where.push('share.archived_at IS NOT NULL')
  if (cursor) {
    const comparator = sort === 'newest' ? '<' : '>'
    where.push(`(share.created_at ${comparator} ? OR (share.created_at = ? AND share.id ${comparator} ?))`)
    bindings.push(cursor.created_at, cursor.created_at, cursor.id)
  }
  const direction = sort === 'newest' ? 'DESC' : 'ASC'
  const { results } = await c.env.DB.prepare(`
    SELECT share.*,
      CASE
        WHEN share.entity_type = 'stack' THEN source_stack.id
        ELSE source_item.stack_id
      END AS source_stack_id,
      CASE
        WHEN share.entity_type = 'stack' THEN source_stack.name
        ELSE item_stack.name
      END AS source_stack_name
    FROM share_links share
    LEFT JOIN stacks source_stack
      ON share.entity_type = 'stack' AND source_stack.id = share.entity_id
    LEFT JOIN stack_items source_item
      ON share.entity_type = 'dose_recommendation' AND source_item.id = share.entity_id
    LEFT JOIN stacks item_stack ON item_stack.id = source_item.stack_id
    WHERE ${where.join(' AND ')}
    ORDER BY share.created_at ${direction}, share.id ${direction}
    LIMIT ?
  `).bind(...bindings, requestedLimit + 1).all<CreatorShareListRow>()
  const rows = results ?? []
  const hasMore = rows.length > requestedLimit
  const pageRows = hasMore ? rows.slice(0, requestedLimit) : rows
  const period = creatorMetricPeriod()
  const metrics = await loadCreatorShareMetrics(c.env.DB, pageRows.map((row) => row.id), period)
  const parsedRows: Array<{ row: CreatorShareListRow; snapshot: CreatorShareSnapshot }> = []
  const moderatedProductIds = new Set<number>()
  for (const row of pageRows) {
    const parsed = await parseCreatorShareRow(row)
    if (!parsed.snapshot) return c.json({ error: parsed.error ?? 'Empfehlungen konnten nicht geladen werden.' }, 409)
    parsedRows.push({ row, snapshot: parsed.snapshot })
    if (
      (row.moderation_target === 'creator_statement' || row.moderation_target === 'product')
      && row.moderation_item_index !== null
    ) {
      const productId = parsed.snapshot.items[row.moderation_item_index]?.catalog_product_id
      if (productId) moderatedProductIds.add(productId)
    }
  }
  const moderatedProductNames = new Map<number, string>()
  if (moderatedProductIds.size > 0) {
    const productIds = [...moderatedProductIds]
    const placeholders = productIds.map(() => '?').join(',')
    const { results: products } = await c.env.DB.prepare(`
      SELECT id, name
      FROM products
      WHERE id IN (${placeholders})
    `).bind(...productIds).all<{ id: number; name: string }>()
    for (const product of products ?? []) moderatedProductNames.set(product.id, product.name)
  }
  const shares: Array<Record<string, unknown>> = []
  for (const { row, snapshot } of parsedRows) {
    const moderationProductId = row.moderation_item_index === null
      ? null
      : snapshot.items[row.moderation_item_index]?.catalog_product_id ?? null
    shares.push({
      id: row.id,
      token: row.token,
      type: row.entity_type,
      entity_id: row.entity_id,
      source_stack_id: row.source_stack_id,
      source_stack_name: row.source_stack_name,
      title: snapshot.title,
      published_at: snapshot.published_at,
      created_at: row.created_at,
      expires_at: row.expires_at,
      status: creatorShareStatus(row),
      moderation_status: row.moderation_status,
      moderation_reason: row.moderation_reason,
      moderation_target: row.moderation_target,
      moderation_item_index: row.moderation_item_index,
      moderation_item_name: moderationProductId === null
        ? null
        : moderatedProductNames.get(moderationProductId) ?? null,
      is_revoked: row.is_revoked,
      paused_at: row.paused_at,
      archived_at: row.archived_at,
      supersedes_share_link_id: row.supersedes_share_link_id,
      snapshot_hash: row.snapshot_hash,
      version: row.version,
      metrics: metrics.get(row.id) ?? {
        unique_visitors: 0,
        saves: 0,
        previous_unique_visitors: 0,
        previous_saves: 0,
      },
    })
  }
  const lastRow = pageRows.at(-1)
  return c.json({
    party: { id: party.id, name: party.name, type: party.type },
    shares,
    next_cursor: hasMore && lastRow ? encodePortfolioCursor(lastRow, sort) : null,
    has_more: hasMore,
    metrics_period: period.publicPeriod,
  })
})

// GET /api/creator-sharing/creator-shares/:id/preview
creatorSharing.get('/creator-shares/:id/preview', async (c) => {
  const featureErr = ensureFeature(c)
  if (featureErr) return featureErr
  const authErr = await ensureAuth(c)
  if (authErr) return authErr
  const shareId = positiveInteger(c.req.param('id'))
  if (!shareId) return c.json({ error: 'Empfehlung wurde nicht gefunden.' }, 404)
  const row = await c.env.DB.prepare('SELECT * FROM share_links WHERE id = ?')
    .bind(shareId).first<ShareRow>()
  if (!row || !row.creator_party_id) return c.json({ error: 'Empfehlung wurde nicht gefunden.' }, 404)
  const user = c.get('user')
  if (!(await hasPartyAccess(c.env.DB, user.userId, row.creator_party_id, ['owner', 'editor', 'viewer']))) {
    return c.json({ error: 'Forbidden' }, 403)
  }
  const party = await getParty(c.env.DB, row.creator_party_id)
  if (!party || party.status !== 'active' || !['creator', 'brand'].includes(party.type)) {
    return c.json({ error: 'Der Creator-Zugang ist gesperrt.' }, 403)
  }
  const parsed = await parseCreatorShareRow(row)
  if (!parsed.snapshot) return c.json({ error: parsed.error ?? 'Vorschau konnte nicht geladen werden.' }, 409)
  const preview = await creatorPreviewPayload(c.env.DB, row, parsed.snapshot)
  if (!preview) return c.json({ error: 'Creator oder Marke wurde nicht gefunden.' }, 409)
  const sourceStack = row.entity_type === 'stack'
    ? await c.env.DB.prepare('SELECT id, name FROM stacks WHERE id = ?')
      .bind(row.entity_id).first<{ id: number; name: string }>()
    : await c.env.DB.prepare(`
        SELECT stack.id, stack.name
        FROM stack_items item
        JOIN stacks stack ON stack.id = item.stack_id
        WHERE item.id = ?
      `).bind(row.entity_id).first<{ id: number; name: string }>()
  const moderationProductId = row.moderation_item_index === null
    ? null
    : parsed.snapshot.items[row.moderation_item_index]?.catalog_product_id ?? null
  const moderationProduct = moderationProductId === null
    ? null
    : await c.env.DB.prepare('SELECT name FROM products WHERE id = ?')
      .bind(moderationProductId).first<{ name: string }>()
  return c.json({
    ...preview,
    entity_id: row.entity_id,
    source_stack_id: sourceStack?.id ?? null,
    source_stack_name: sourceStack?.name ?? null,
    creator_status: creatorShareStatus(row),
    share_id: row.id,
    snapshot_hash: row.snapshot_hash,
    moderation_status: row.moderation_status,
    moderation_reason: row.moderation_reason,
    moderation_target: row.moderation_target,
    moderation_item_index: row.moderation_item_index,
    moderation_item_name: moderationProduct?.name ?? null,
    is_revoked: row.is_revoked,
    expires_at: row.expires_at,
    paused_at: row.paused_at,
    archived_at: row.archived_at,
    supersedes_share_link_id: row.supersedes_share_link_id,
    version: row.version,
  })
})

// PATCH /api/creator-sharing/creator-shares/:id/lifecycle
creatorSharing.patch('/creator-shares/:id/lifecycle', async (c) => {
  const featureErr = ensureFeature(c)
  if (featureErr) return featureErr
  const authErr = await ensureAuth(c)
  if (authErr) return authErr
  const shareId = positiveInteger(c.req.param('id'))
  if (!shareId) return c.json({ error: 'Empfehlung wurde nicht gefunden.' }, 404)
  let body: Record<string, unknown>
  try {
    body = await c.req.json()
  } catch {
    return c.json({ error: 'Ungültige Anfrage.' }, 400)
  }
  const expectedVersion = positiveInteger(body.expected_version)
  const expectedHash = boundedText(body.expected_snapshot_hash, 64)
  const expectedStatus = ['pending', 'approved', 'blocked', 'paused', 'revoked', 'expired'].includes(String(body.expected_status))
    ? body.expected_status as CreatorShareStatus
    : null
  const expectedModerationStatus = ['pending', 'approved', 'blocked'].includes(String(body.expected_moderation_status))
    ? String(body.expected_moderation_status)
    : null
  const expectedIsRevoked = body.expected_is_revoked === 0 || body.expected_is_revoked === 1
    ? body.expected_is_revoked
    : null
  const expectedPausedAt = body.expected_paused_at === null ? null : positiveInteger(body.expected_paused_at)
  const expectedExpiresAt = body.expected_expires_at === null ? null : positiveInteger(body.expected_expires_at)
  const action = ['pause', 'resume', 'end', 'set_expiry', 'clear_expiry'].includes(String(body.action))
    ? String(body.action) as 'pause' | 'resume' | 'end' | 'set_expiry' | 'clear_expiry'
    : null
  if (
    !expectedVersion
    || !expectedHash
    || !/^[a-f0-9]{64}$/.test(expectedHash)
    || !expectedStatus
    || !expectedModerationStatus
    || expectedIsRevoked === null
    || !hasOwnKey(body, 'expected_paused_at')
    || (body.expected_paused_at !== null && expectedPausedAt === null)
    || !hasOwnKey(body, 'expected_expires_at')
    || (body.expected_expires_at !== null && expectedExpiresAt === null)
    || !action
  ) {
    return c.json({ error: 'Die aktuellen Angaben der Empfehlung fehlen.' }, 400)
  }
  const row = await c.env.DB.prepare('SELECT * FROM share_links WHERE id = ?')
    .bind(shareId).first<ShareRow>()
  if (!row || !row.creator_party_id) return c.json({ error: 'Empfehlung wurde nicht gefunden.' }, 404)
  const user = c.get('user')
  if (!(await hasPartyAccess(c.env.DB, user.userId, row.creator_party_id, ['owner', 'editor']))) {
    return c.json({ error: 'Forbidden' }, 403)
  }
  const party = await getParty(c.env.DB, row.creator_party_id)
  if (!party || party.status !== 'active' || !['creator', 'brand'].includes(party.type)) {
    return c.json({ error: 'Der Creator-Zugang ist gesperrt.' }, 403)
  }
  const currentStatus = creatorShareStatus(row)
  if (
    row.version !== expectedVersion
    || row.snapshot_hash !== expectedHash
    || currentStatus !== expectedStatus
    || row.moderation_status !== expectedModerationStatus
    || row.is_revoked !== expectedIsRevoked
    || row.paused_at !== expectedPausedAt
    || row.expires_at !== expectedExpiresAt
  ) {
    return c.json({ error: 'Die Empfehlung hat sich geändert. Bitte lade sie neu.' }, 409)
  }

  const nowSeconds = Math.floor(Date.now() / 1000)
  let nextRevoked = row.is_revoked
  let nextPausedAt = row.paused_at
  let nextExpiresAt = row.expires_at
  if (action === 'pause') {
    if (currentStatus !== 'approved') return c.json({ error: 'Nur ein aktiver Link kann pausiert werden.' }, 409)
    nextPausedAt = nowSeconds
  } else if (action === 'resume') {
    if (currentStatus !== 'paused') return c.json({ error: 'Nur ein pausierter Link kann fortgesetzt werden.' }, 409)
    nextPausedAt = null
  } else if (action === 'end') {
    if (currentStatus !== 'approved' && currentStatus !== 'paused') {
      return c.json({ error: 'Nur ein aktiver oder pausierter Link kann beendet werden.' }, 409)
    }
    nextRevoked = 1
    nextPausedAt = null
  } else if (action === 'set_expiry') {
    if (currentStatus !== 'approved' && currentStatus !== 'paused') {
      return c.json({ error: 'Ein abgelaufener oder beendeter Link kann nicht wieder aktiviert werden. Erstelle stattdessen eine Neuauflage.' }, 409)
    }
    const expiresAt = positiveInteger(body.expires_at)
    if (
      !expiresAt
      || expiresAt <= nowSeconds
      || row.moderation_status !== 'approved'
      || row.is_revoked === 1
    ) {
      return c.json({ error: 'Bitte wähle ein zukünftiges Ablaufdatum für einen freigegebenen Link.' }, 400)
    }
    nextExpiresAt = expiresAt
  } else {
    if (currentStatus !== 'approved' && currentStatus !== 'paused') {
      return c.json({ error: 'Ein abgelaufener oder beendeter Link kann nicht wieder aktiviert werden. Erstelle stattdessen eine Neuauflage.' }, 409)
    }
    nextExpiresAt = null
  }

  const result = await c.env.DB.prepare(`
    UPDATE share_links
    SET is_revoked = ?, paused_at = ?, expires_at = ?, version = version + 1
    WHERE id = ?
      AND creator_party_id = ?
      AND version = ?
      AND snapshot_hash = ?
      AND moderation_status = ?
      AND is_revoked = ?
      AND paused_at IS ?
      AND expires_at IS ?
      AND archived_at IS ?
      AND legacy_provenance_status IS NULL
      AND (CASE
        WHEN moderation_status = 'blocked' THEN 'blocked'
        WHEN is_revoked = 1 THEN 'revoked'
        WHEN expires_at IS NOT NULL AND expires_at <= strftime('%s', 'now') THEN 'expired'
        WHEN moderation_status = 'pending' THEN 'pending'
        WHEN paused_at IS NOT NULL THEN 'paused'
        ELSE 'approved'
      END) = ?
      AND (
        ? NOT IN ('set_expiry', 'clear_expiry')
        OR (CASE
          WHEN moderation_status = 'blocked' THEN 'blocked'
          WHEN is_revoked = 1 THEN 'revoked'
          WHEN expires_at IS NOT NULL AND expires_at <= strftime('%s', 'now') THEN 'expired'
          WHEN moderation_status = 'pending' THEN 'pending'
          WHEN paused_at IS NOT NULL THEN 'paused'
          ELSE 'approved'
        END) IN ('approved', 'paused')
      )
      AND (? <> 'set_expiry' OR ? > CAST(strftime('%s', 'now') AS INTEGER))
      AND EXISTS (
        SELECT 1 FROM parties party
        WHERE party.id = share_links.creator_party_id AND party.status = 'active'
      )
  `).bind(
    nextRevoked,
    nextPausedAt,
    nextExpiresAt,
    row.id,
    row.creator_party_id,
    row.version,
    row.snapshot_hash,
    row.moderation_status,
    row.is_revoked,
    row.paused_at,
    row.expires_at,
    row.archived_at,
    expectedStatus,
    action,
    action,
    nextExpiresAt,
  ).run()
  if (d1Changes(result) !== 1) return c.json({ error: 'Die Empfehlung hat sich geändert. Bitte lade sie neu.' }, 409)
  const updated: ShareRow = {
    ...row,
    is_revoked: nextRevoked,
    paused_at: nextPausedAt,
    expires_at: nextExpiresAt,
    version: row.version + 1,
  }
  return c.json({
    ok: true,
    status: creatorShareStatus(updated),
    version: updated.version,
    paused_at: updated.paused_at,
    expires_at: updated.expires_at,
    is_revoked: updated.is_revoked,
  })
})

// PATCH /api/creator-sharing/creator-shares/:id/archive
creatorSharing.patch('/creator-shares/:id/archive', async (c) => {
  const featureErr = ensureFeature(c)
  if (featureErr) return featureErr
  const authErr = await ensureAuth(c)
  if (authErr) return authErr
  const shareId = positiveInteger(c.req.param('id'))
  if (!shareId) return c.json({ error: 'Empfehlung wurde nicht gefunden.' }, 404)
  let body: Record<string, unknown>
  try {
    body = await c.req.json()
  } catch {
    return c.json({ error: 'Ungültige Anfrage.' }, 400)
  }
  const expectedVersion = positiveInteger(body.expected_version)
  const expectedHash = boundedText(body.expected_snapshot_hash, 64)
  const expectedArchivedAt = body.expected_archived_at === null ? null : positiveInteger(body.expected_archived_at)
  const archived = body.archived === true ? true : body.archived === false ? false : null
  if (
    !expectedVersion
    || !expectedHash
    || !/^[a-f0-9]{64}$/.test(expectedHash)
    || !hasOwnKey(body, 'expected_archived_at')
    || (body.expected_archived_at !== null && expectedArchivedAt === null)
    || archived === null
  ) {
    return c.json({ error: 'Die aktuellen Angaben der Empfehlung fehlen.' }, 400)
  }
  const row = await c.env.DB.prepare('SELECT * FROM share_links WHERE id = ?')
    .bind(shareId).first<ShareRow>()
  if (!row || !row.creator_party_id) return c.json({ error: 'Empfehlung wurde nicht gefunden.' }, 404)
  const user = c.get('user')
  if (!(await hasPartyAccess(c.env.DB, user.userId, row.creator_party_id, ['owner', 'editor']))) {
    return c.json({ error: 'Forbidden' }, 403)
  }
  const party = await getParty(c.env.DB, row.creator_party_id)
  if (!party || party.status !== 'active' || !['creator', 'brand'].includes(party.type)) {
    return c.json({ error: 'Der Creator-Zugang ist gesperrt.' }, 403)
  }
  if (row.version !== expectedVersion || row.snapshot_hash !== expectedHash || row.archived_at !== expectedArchivedAt) {
    return c.json({ error: 'Die Empfehlung hat sich geändert. Bitte lade sie neu.' }, 409)
  }
  if ((archived && row.archived_at !== null) || (!archived && row.archived_at === null)) {
    return c.json({ ok: true, version: row.version, archived_at: row.archived_at })
  }
  const archivedAt = archived ? Math.floor(Date.now() / 1000) : null
  const result = await c.env.DB.prepare(`
    UPDATE share_links
    SET archived_at = ?, version = version + 1
    WHERE id = ?
      AND creator_party_id = ?
      AND version = ?
      AND snapshot_hash = ?
      AND moderation_status = ?
      AND is_revoked = ?
      AND paused_at IS ?
      AND expires_at IS ?
      AND archived_at IS ?
      AND EXISTS (
        SELECT 1 FROM parties party
        WHERE party.id = share_links.creator_party_id AND party.status = 'active'
      )
  `).bind(
    archivedAt,
    row.id,
    row.creator_party_id,
    row.version,
    row.snapshot_hash,
    row.moderation_status,
    row.is_revoked,
    row.paused_at,
    row.expires_at,
    row.archived_at,
  ).run()
  if (d1Changes(result) !== 1) return c.json({ error: 'Die Empfehlung hat sich geändert. Bitte lade sie neu.' }, 409)
  return c.json({ ok: true, version: row.version + 1, archived_at: archivedAt })
})

// PATCH /api/creator-sharing/creator-shares/:id/revoke
creatorSharing.patch('/creator-shares/:id/revoke', async (c) => {
  const featureErr = ensureFeature(c)
  if (featureErr) return featureErr
  const authErr = await ensureAuth(c)
  if (authErr) return authErr
  const shareId = positiveInteger(c.req.param('id'))
  if (!shareId) return c.json({ error: 'Empfehlung wurde nicht gefunden.' }, 404)
  let body: Record<string, unknown>
  try {
    body = await c.req.json()
  } catch {
    return c.json({ error: 'Ungültige Anfrage.' }, 400)
  }
  const expectedHash = boundedText(body.expected_snapshot_hash, 64)
  const expectedVersion = positiveInteger(body.expected_version)
  const expectedStatus = body.expected_moderation_status === 'pending'
    || body.expected_moderation_status === 'approved'
    || body.expected_moderation_status === 'blocked'
    ? body.expected_moderation_status
    : null
  const expectedPausedAt = body.expected_paused_at === null ? null : positiveInteger(body.expected_paused_at)
  const expectedExpiresAt = body.expected_expires_at === null ? null : positiveInteger(body.expected_expires_at)
  if (
    !expectedVersion
    || !expectedHash
    || !/^[a-f0-9]{64}$/.test(expectedHash)
    || !expectedStatus
    || body.expected_is_revoked !== 0
    || !hasOwnKey(body, 'expected_paused_at')
    || (body.expected_paused_at !== null && expectedPausedAt === null)
    || !hasOwnKey(body, 'expected_expires_at')
    || (body.expected_expires_at !== null && expectedExpiresAt === null)
  ) {
    return c.json({ error: 'Die aktuellen Angaben der Empfehlung fehlen.' }, 400)
  }
  const row = await c.env.DB.prepare('SELECT * FROM share_links WHERE id = ?')
    .bind(shareId).first<ShareRow>()
  if (!row || !row.creator_party_id) return c.json({ error: 'Empfehlung wurde nicht gefunden.' }, 404)
  const user = c.get('user')
  if (!(await hasPartyAccess(c.env.DB, user.userId, row.creator_party_id, ['owner', 'editor']))) {
    return c.json({ error: 'Forbidden' }, 403)
  }
  const party = await getParty(c.env.DB, row.creator_party_id)
  if (!party || party.status !== 'active' || !['creator', 'brand'].includes(party.type)) {
    return c.json({ error: 'Der Creator-Zugang ist gesperrt.' }, 403)
  }
  if (
    row.version !== expectedVersion
    || row.snapshot_hash !== expectedHash
    || row.moderation_status !== expectedStatus
    || row.is_revoked !== 0
    || row.paused_at !== expectedPausedAt
    || row.expires_at !== expectedExpiresAt
  ) {
    return c.json({ error: 'Die Empfehlung hat sich geändert. Bitte lade sie neu.' }, 409)
  }
  if (creatorShareStatus(row) !== 'approved') {
    return c.json({ error: 'Nur eine freigegebene Empfehlung kann beendet werden.' }, 409)
  }
  const result = await c.env.DB.prepare(`
    UPDATE share_links
    SET is_revoked = 1, version = version + 1
    WHERE id = ?
      AND creator_party_id = ?
      AND snapshot_hash = ?
      AND version = ?
      AND moderation_status = ?
      AND is_revoked = 0
      AND legacy_provenance_status IS NULL
      AND paused_at IS ?
      AND expires_at IS ?
      AND archived_at IS ?
      AND (expires_at IS NULL OR expires_at > strftime('%s', 'now'))
      AND EXISTS (
        SELECT 1 FROM parties party
        WHERE party.id = share_links.creator_party_id AND party.status = 'active'
      )
  `).bind(
    shareId,
    row.creator_party_id,
    expectedHash,
    expectedVersion,
    expectedStatus,
    expectedPausedAt,
    expectedExpiresAt,
    row.archived_at,
  ).run()
  if (d1Changes(result) !== 1) {
    return c.json({ error: 'Die Empfehlung hat sich geändert. Bitte lade sie neu.' }, 409)
  }
  return c.json({ ok: true, status: 'revoked', version: row.version + 1 })
})

// POST /api/creator-sharing/shares
creatorSharing.post('/shares', async (c) => {
  const featureErr = ensureFeature(c)
  if (featureErr) return featureErr
  const authErr = await ensureAuth(c)
  if (authErr) return authErr
  const user = c.get('user')
  let body: Record<string, unknown>
  try {
    body = await c.req.json()
  } catch {
    return c.json({ error: 'Invalid JSON' }, 400)
  }
  const partyId = positiveInteger(body.party_id)
  const stackId = positiveInteger(body.stack_id)
  const type = body.type === 'stack' || body.type === 'dose_recommendation' ? body.type : null
  const stackItemId = type === 'dose_recommendation' ? positiveInteger(body.stack_item_id) : null
  const title = boundedText(body.title, 120)
  const statements = statementMap(body.creator_statements)
  const guard = parseSourceShareGuard(body.source_share_guard)
  if (guard.error) return c.json({ error: guard.error }, 400)
  if (!partyId || !stackId || !type || !title || statements === null || (type === 'dose_recommendation' && !stackItemId)) {
    return c.json({ error: 'party_id, stack_id, type und title sind erforderlich.' }, 400)
  }
  const party = await getParty(c.env.DB, partyId)
  if (!party || party.status !== 'active' || !['creator', 'brand', 'user'].includes(party.type)) {
    return c.json({ error: 'Creator-Partei ist nicht aktiv.' }, 409)
  }
  if (!(await hasPartyAccess(c.env.DB, user.userId, partyId, ['owner', 'editor']))) {
    return c.json({ error: 'Forbidden' }, 403)
  }
  const source = await loadShareSourceRows(c.env.DB, user.userId, partyId, stackId, stackItemId)
  if (!source.rows) return c.json({
    error: source.error ?? 'Stack ist nicht teilbar.',
    code: source.errorCode,
    products: source.unshareableProducts ?? [],
  }, 409)
  const sourceItemIds = new Set(source.rows.map((row) => row.stack_item_id))
  if ([...statements.keys()].some((itemId) => !sourceItemIds.has(itemId))) {
    return c.json({ error: 'Creator-Aussagen dürfen nur Positionen dieses Shares referenzieren.' }, 400)
  }
  if (type === 'stack' && source.rows.length > 100) return c.json({ error: 'Ein Share darf höchstens 100 Positionen enthalten.' }, 400)

  const mainIds = await loadMainIngredientIds(c.env.DB, source.rows.map((row) => row.catalog_product_id))
  if (source.rows.some((row) => (mainIds.get(row.catalog_product_id) ?? []).length === 0)) {
    return c.json({ error: 'Mindestens ein Produkt besitzt kein Hauptwirkstoff-Set.' }, 409)
  }
  const platform = await getPlatformParty(c.env.DB)
  if (!platform) return c.json({ error: 'Plattform-Partei fehlt.' }, 409)
  const shopIds = source.rows.map((row) => row.shop_domain_id).filter((id): id is number => id !== null)
  const versions = await currentAffiliateVersions(c.env.DB, [partyId, platform.id], shopIds)
  const items: CreatorShareSnapshotItem[] = []
  for (const row of source.rows) {
    const binding = bindingFromLoadedVersions(row, partyId, platform.id, versions)
    if (!binding) return c.json({ error: `Produktziel für Position ${row.stack_item_id} ist nicht sicher auflösbar.` }, 409)
    const statement = statements.get(row.stack_item_id) ?? null
    items.push({
      catalog_product_id: row.catalog_product_id,
      shop_link_id: row.shop_link_id,
      link_binding: binding,
      main_ingredient_ids: mainIds.get(row.catalog_product_id) ?? [],
      quantity: row.quantity,
      unit: row.serving_unit,
      intake_interval_days: Number(row.intake_interval_days),
      dosage_text: row.dosage_text,
      timing: row.timing,
      creator_statement: statement,
      sort_order: row.sort_order,
    })
  }
  const snapshot: CreatorShareSnapshot = {
    schema_version: CREATOR_SHARING_SNAPSHOT_VERSION,
    type,
    creator_party_id: partyId,
    published_at: new Date().toISOString(),
    title,
    items,
  }
  const parsedSnapshot = parseCreatorShareSnapshot(snapshot)
  if (!parsedSnapshot.value) return c.json({ error: parsedSnapshot.error ?? 'Snapshot ist ungültig.' }, 400)
  const validatedRelations = await validateSnapshotRelations(c.env.DB, parsedSnapshot.value)
  if (!validatedRelations.value) {
    return c.json({ error: validatedRelations.error ?? 'Die Produktdaten haben sich geändert.' }, 409)
  }
  if (!source.stackVersion) return c.json({ error: 'Der Stack hat sich geändert.' }, 409)
  const hash = await snapshotHash(parsedSnapshot.value)
  const token = generateShareToken()
  const entityId = type === 'stack' ? stackId : stackItemId
  const snapshotJson = canonicalJson(parsedSnapshot.value)
  const sourceItemsSignature = sourceStackItemsSignatureJson(source.rows)
  const relationSignature = snapshotRelationSignatureJson(parsedSnapshot.value, validatedRelations.value)
  const sourceShareGuardSql = guard.value
    ? `AND EXISTS (
        SELECT 1
        FROM share_links source_share
        WHERE source_share.id = ?
          AND source_share.creator_party_id = ?
          AND source_share.snapshot_hash = ?
          AND source_share.version = ?
          AND source_share.moderation_status = ?
          AND source_share.is_revoked = ?
          AND source_share.legacy_provenance_status IS NULL
          AND EXISTS (
            SELECT 1 FROM parties source_party
            WHERE source_party.id = source_share.creator_party_id AND source_party.status = 'active'
          )
          AND source_share.expires_at IS ?
          AND CASE
            WHEN source_share.moderation_status = 'blocked' THEN 'blocked'
            WHEN source_share.legacy_provenance_status = 'ambiguous' THEN 'revoked'
            WHEN source_share.is_revoked = 1 THEN 'revoked'
            WHEN source_share.expires_at IS NOT NULL AND source_share.expires_at <= strftime('%s', 'now') THEN 'expired'
            ELSE source_share.moderation_status
          END = ?
      )`
    : ''
  const bindings: unknown[] = [
    token,
    type,
    entityId,
    snapshotJson,
    user.userId,
    partyId,
    CREATOR_SHARING_SNAPSHOT_VERSION,
    hash,
    guard.value?.shareId ?? null,
    stackId,
    user.userId,
    source.stackVersion,
    stackItemId,
    stackItemId,
    sourceItemsSignature,
    sourceItemsSignature,
    partyId,
    user.userId,
    partyId,
    party.type,
    party.version,
    relationSignature,
  ]
  if (guard.value) {
    bindings.push(
      guard.value.shareId,
      partyId,
      guard.value.expectedSnapshotHash,
      guard.value.expectedVersion,
      guard.value.expectedModerationStatus,
      guard.value.expectedIsRevoked,
      guard.value.expectedExpiresAt,
      guard.value.expectedStatus,
    )
  }
  const [result] = await c.env.DB.batch([c.env.DB.prepare(`
    INSERT INTO share_links (
      token,
      entity_type,
      entity_id,
      snapshot_json,
      creator_user_id,
      creator_party_id,
      snapshot_schema_version,
      snapshot_hash,
      moderation_status,
      is_revoked,
      supersedes_share_link_id
    )
    SELECT ?, ?, ?, ?, ?, ?, ?, ?, 'pending', 0, ?
    FROM stacks source_stack
    WHERE source_stack.id = ?
      AND source_stack.user_id = ?
      AND source_stack.deleted_at IS NULL
      AND source_stack.version = ?
      ${SOURCE_STACK_ITEMS_SQL_GUARD}
      AND EXISTS (
        SELECT 1
        FROM party_memberships membership
        WHERE membership.party_id = ? AND membership.user_id = ?
          AND membership.status = 'active' AND membership.role IN ('owner', 'editor')
      )
      AND EXISTS (
        SELECT 1
        FROM parties active_party
        WHERE active_party.id = ? AND active_party.type = ?
          AND active_party.status = 'active' AND active_party.version = ?
      )
      AND ${SNAPSHOT_RELATION_SIGNATURE_SQL_GUARD}
      ${sourceShareGuardSql}
  `).bind(...bindings)])
  if (d1Changes(result) !== 1) {
    return c.json({
      error: guard.value
        ? 'Die ursprüngliche Empfehlung oder dein Stack hat sich geändert. Bitte lade deine Empfehlungen neu.'
        : 'Der Stack oder ein Produkt hat sich geändert. Bitte prüfe deine Auswahl noch einmal.',
      code: guard.value ? 'SOURCE_SHARE_CHANGED' : 'SOURCE_STACK_CHANGED',
    }, 409)
  }
  return c.json({
    id: result.meta.last_row_id,
    token,
    moderation_status: 'pending',
    snapshot_hash: hash,
    version: 1,
  }, 201)
})

async function publicShareFailure(db: D1Database, token: string): Promise<{
  code: 'SHARE_PENDING' | 'SHARE_PAUSED' | 'SHARE_EXPIRED' | 'SHARE_UNAVAILABLE' | 'SHARE_UNKNOWN' | 'SHARE_INVALID'
  error: string
  httpStatus: 404 | 409 | 410
}> {
  if (!/^[A-Za-z0-9_-]{24,80}$/.test(token)) {
    return { code: 'SHARE_UNKNOWN', error: 'Diese Empfehlung wurde nicht gefunden.', httpStatus: 404 }
  }
  const row = await db.prepare(`
    SELECT share.*, party.status AS creator_party_status
    FROM share_links share
    LEFT JOIN parties party ON party.id = share.creator_party_id
    WHERE share.token = ?
    LIMIT 1
  `).bind(token).first<ShareRow & { creator_party_status: string | null }>()
  if (!row) return { code: 'SHARE_UNKNOWN', error: 'Diese Empfehlung wurde nicht gefunden.', httpStatus: 404 }
  if (row.creator_party_status !== 'active') {
    return { code: 'SHARE_UNAVAILABLE', error: 'Diese Empfehlung ist nicht mehr verfügbar.', httpStatus: 410 }
  }
  const status = creatorShareStatus(row)
  if (status === 'pending') {
    return { code: 'SHARE_PENDING', error: 'Diese Empfehlung wird noch geprüft.', httpStatus: 409 }
  }
  if (status === 'expired') {
    return { code: 'SHARE_EXPIRED', error: 'Dieser Link ist abgelaufen.', httpStatus: 410 }
  }
  if (status === 'paused') {
    return { code: 'SHARE_PAUSED', error: 'Diese Empfehlung ist vorübergehend pausiert.', httpStatus: 409 }
  }
  if (status === 'revoked' || status === 'blocked') {
    return { code: 'SHARE_UNAVAILABLE', error: 'Diese Empfehlung ist nicht mehr verfügbar.', httpStatus: 410 }
  }
  return { code: 'SHARE_INVALID', error: 'Diese Empfehlung kann gerade nicht geladen werden.', httpStatus: 409 }
}

// GET /api/creator-sharing/shares/:token
creatorSharing.get('/shares/:token', async (c) => {
  const featureErr = ensureFeature(c)
  if (featureErr) return featureErr
  setPublicShareResponseHeaders(c)
  const loaded = await loadShare(c.env.DB, c.req.param('token'), true)
  if (!loaded.row || !loaded.snapshot || !loaded.relations) {
    const failure = await publicShareFailure(c.env.DB, c.req.param('token'))
    if (failure.code === 'SHARE_PENDING' || failure.code === 'SHARE_PAUSED') c.header('Retry-After', '300')
    return c.json({ error: failure.error, code: failure.code }, failure.httpStatus)
  }
  const preview = await creatorPreviewPayload(c.env.DB, loaded.row, loaded.snapshot)
  if (!preview) return c.json({ error: 'Creator oder Marke wurde nicht gefunden.' }, 409)
  return c.json(preview)
})

// POST /api/creator-sharing/shares/:token/report
creatorSharing.post('/shares/:token/report', async (c) => {
  const featureErr = ensureFeature(c)
  if (featureErr) return featureErr
  setPublicShareResponseHeaders(c)
  let body: Record<string, unknown>
  try {
    body = await c.req.json()
  } catch {
    return c.json({ error: 'Bitte wähle einen Grund für deine Meldung.' }, 400)
  }
  const idempotencyKey = boundedText(body.idempotency_key, 120)
  const category = ['outdated', 'misleading', 'safety', 'other'].includes(String(body.category))
    ? String(body.category) as 'outdated' | 'misleading' | 'safety' | 'other'
    : null
  const details = body.details === undefined || body.details === null || body.details === ''
    ? null
    : boundedText(body.details, 500)
  if (!idempotencyKey || !/^[A-Za-z0-9._:-]{16,120}$/.test(idempotencyKey) || !category
    || (body.details !== undefined && body.details !== null && body.details !== '' && !details)) {
    return c.json({ error: 'Bitte prüfe deine Meldung. Der optionale Hinweis darf höchstens 500 Zeichen lang sein.' }, 400)
  }

  const token = c.req.param('token')
  const loaded = await loadShare(c.env.DB, token, true)
  if (!loaded.row) {
    const failure = await publicShareFailure(c.env.DB, token)
    return c.json({ error: failure.error, code: failure.code }, failure.httpStatus)
  }
  const existing = await c.env.DB.prepare(`
    SELECT report.id, report.share_link_id, report.category, report.details, report.status
    FROM creator_share_reports report
    WHERE report.idempotency_key = ?
  `).bind(idempotencyKey).first<{
    id: number
    share_link_id: number
    category: string
    details: string | null
    status: string
  }>()
  if (existing) {
    return existing.share_link_id === loaded.row.id
      && existing.category === category
      && existing.details === details
      ? c.json({ ok: true, report_id: existing.id, status: existing.status })
      : c.json({
        error: 'Diese Meldung wurde mit anderen Angaben begonnen. Bitte öffne das Meldeformular erneut.',
        code: 'REPORT_PAYLOAD_CHANGED',
      }, 409)
  }

  const ip = c.req.header('CF-Connecting-IP') ?? c.req.header('X-Forwarded-For') ?? 'unknown'
  const rateKey = await sha256Hex(`${ip}|${loaded.row.id}`)
  const allowed = await checkRateLimit(c.env.RATE_LIMITER, `creator-share-report:${rateKey}`, 5, 60 * 60)
  if (!allowed) return c.json({ error: 'Du hast in kurzer Zeit mehrere Meldungen gesendet. Bitte versuche es später erneut.' }, 429)

  const result = await c.env.DB.prepare(`
    INSERT OR IGNORE INTO creator_share_reports (
      share_link_id, idempotency_key, category, details, status, version
    )
    SELECT id, ?, ?, ?, 'pending', 1
    FROM share_links
    WHERE id = ? AND token = ? AND snapshot_hash IS ? AND version = ?
      AND moderation_status = 'approved' AND is_revoked = 0
      AND legacy_provenance_status IS NULL AND paused_at IS NULL
      AND (expires_at IS NULL OR expires_at > strftime('%s', 'now'))
      AND EXISTS (
        SELECT 1 FROM parties party
        WHERE party.id = share_links.creator_party_id AND party.status = 'active'
      )
  `).bind(
    idempotencyKey,
    category,
    details,
    loaded.row.id,
    token,
    loaded.row.snapshot_hash,
    loaded.row.version,
  ).run()
  if (d1Changes(result) !== 1) {
    const raced = await c.env.DB.prepare(`
      SELECT id, share_link_id, category, details, status FROM creator_share_reports
      WHERE idempotency_key = ?
    `).bind(idempotencyKey).first<{
      id: number
      share_link_id: number
      category: string
      details: string | null
      status: string
    }>()
    if (raced) {
      return raced.share_link_id === loaded.row.id
        && raced.category === category
        && raced.details === details
        ? c.json({ ok: true, report_id: raced.id, status: raced.status })
        : c.json({
          error: 'Diese Meldung wurde mit anderen Angaben begonnen. Bitte öffne das Meldeformular erneut.',
          code: 'REPORT_PAYLOAD_CHANGED',
        }, 409)
    }
    return c.json({ error: 'Die Empfehlung hat sich geändert. Bitte lade die Seite neu und prüfe sie noch einmal.' }, 409)
  }
  const report = await c.env.DB.prepare(`
    SELECT id, status FROM creator_share_reports
    WHERE idempotency_key = ? AND share_link_id = ?
  `).bind(idempotencyKey, loaded.row.id).first<{ id: number; status: 'pending' }>()
  if (!report) return c.json({ error: 'Die Meldung konnte nicht gespeichert werden.' }, 409)
  return c.json({ ok: true, report_id: report.id, status: report.status }, 201)
})

// POST /api/creator-sharing/stacks/:id/open
creatorSharing.post('/stacks/:id/open', async (c) => {
  const featureErr = ensureFeature(c)
  if (featureErr) return featureErr
  const authErr = await ensureAuth(c)
  if (authErr) return authErr
  const stackId = positiveInteger(c.req.param('id'))
  if (!stackId) return c.json({ error: 'Invalid stack id' }, 400)
  const user = c.get('user')
  const result = await c.env.DB.prepare(`
    UPDATE stacks SET last_opened_at = CURRENT_TIMESTAMP WHERE id = ? AND user_id = ? AND deleted_at IS NULL
  `).bind(stackId, user.userId).run()
  if (d1Changes(result) !== 1) return c.json({ error: 'Stack not found' }, 404)
  return c.json({ ok: true })
})

// GET /api/creator-sharing/dashboard?party_id=...
creatorSharing.get('/dashboard', async (c) => {
  const featureErr = ensureFeature(c)
  if (featureErr) return featureErr
  const authErr = await ensureAuth(c)
  if (authErr) return authErr
  const partyId = positiveInteger(c.req.query('party_id'))
  if (!partyId) return c.json({ error: 'party_id is required' }, 400)
  const requestedPeriod = c.req.query('period_days') ?? '30'
  if (requestedPeriod !== '30') return c.json({ error: 'Der Auswertungszeitraum beträgt 30 Tage.' }, 400)
  const user = c.get('user')
  if (!(await hasPartyAccess(c.env.DB, user.userId, partyId, ['owner', 'editor', 'viewer']))) {
    return c.json({ error: 'Forbidden' }, 403)
  }
  const party = await getParty(c.env.DB, partyId)
  if (!party || party.status !== 'active' || !['creator', 'brand'].includes(party.type)) {
    return c.json({ error: 'Creator oder Marke wurde nicht gefunden.' }, 404)
  }
  const period = creatorMetricPeriod()
  const [visitors, clicks, saves, stacks, shares, visitorTrend, clickTrend, saveTrend] = await Promise.all([
    c.env.DB.prepare(`
      SELECT
        COUNT(DISTINCT CASE
          WHEN event.created_at >= datetime(?) AND event.created_at < datetime(?)
          THEN event.visitor_id END
        ) AS current_count,
        COUNT(DISTINCT CASE
          WHEN event.created_at >= datetime(?) AND event.created_at < datetime(?)
          THEN event.visitor_id END
        ) AS previous_count
      FROM page_view_events event
      JOIN share_links share ON share.creator_party_id = ? AND (
        event.path = '/share/' || share.token
        OR (
          substr(event.path, 1, length('/share/' || share.token)) = '/share/' || share.token
          AND substr(event.path, length('/share/' || share.token) + 1, 1) IN ('?', '#')
        )
      )
      WHERE event.visitor_id IS NOT NULL
    `).bind(
      period.publicPeriod.from,
      period.currentToExclusive,
      period.publicPeriod.previous_from,
      period.previousToExclusive,
      partyId,
    ).first<{ current_count: number; previous_count: number }>(),
    c.env.DB.prepare(`
      SELECT
        COALESCE(SUM(CASE WHEN click.clicked_at >= datetime(?) AND click.clicked_at < datetime(?) THEN 1 ELSE 0 END), 0) AS current_clicks,
        COALESCE(SUM(CASE WHEN click.clicked_at >= datetime(?) AND click.clicked_at < datetime(?) THEN 1 ELSE 0 END), 0) AS previous_clicks,
        COUNT(DISTINCT CASE WHEN click.clicked_at >= datetime(?) AND click.clicked_at < datetime(?) THEN click.product_id END) AS current_products,
        COUNT(DISTINCT CASE WHEN click.clicked_at >= datetime(?) AND click.clicked_at < datetime(?) THEN click.product_id END) AS previous_products,
        COUNT(DISTINCT CASE WHEN click.clicked_at >= datetime(?) AND click.clicked_at < datetime(?) THEN shop_link.shop_domain_id END) AS current_shops,
        COUNT(DISTINCT CASE WHEN click.clicked_at >= datetime(?) AND click.clicked_at < datetime(?) THEN shop_link.shop_domain_id END) AS previous_shops
      FROM product_link_clicks click
      LEFT JOIN product_shop_links shop_link ON shop_link.id = click.shop_link_id
      WHERE click.creator_context_party_id = ?
    `).bind(
      period.publicPeriod.from, period.currentToExclusive,
      period.publicPeriod.previous_from, period.previousToExclusive,
      period.publicPeriod.from, period.currentToExclusive,
      period.publicPeriod.previous_from, period.previousToExclusive,
      period.publicPeriod.from, period.currentToExclusive,
      period.publicPeriod.previous_from, period.previousToExclusive,
      partyId,
    ).first<{
      current_clicks: number
      previous_clicks: number
      current_products: number
      previous_products: number
      current_shops: number
      previous_shops: number
    }>(),
    c.env.DB.prepare(`
      SELECT
        COALESCE(SUM(CASE WHEN operation.created_at >= datetime(?) AND operation.created_at < datetime(?) THEN 1 ELSE 0 END), 0) AS current_count,
        COALESCE(SUM(CASE WHEN operation.created_at >= datetime(?) AND operation.created_at < datetime(?) THEN 1 ELSE 0 END), 0) AS previous_count
      FROM share_import_operations operation
      JOIN share_links share ON share.id = operation.share_link_id
      WHERE share.creator_party_id = ?
    `).bind(
      period.publicPeriod.from, period.currentToExclusive,
      period.publicPeriod.previous_from, period.previousToExclusive,
      partyId,
    ).first<{ current_count: number; previous_count: number }>(),
    c.env.DB.prepare(`
      SELECT
        COALESCE(SUM(CASE WHEN created_at >= datetime(?) AND created_at < datetime(?) THEN 1 ELSE 0 END), 0) AS current_count,
        COALESCE(SUM(CASE WHEN created_at >= datetime(?) AND created_at < datetime(?) THEN 1 ELSE 0 END), 0) AS previous_count
      FROM stacks
      WHERE origin_party_id = ? AND deleted_at IS NULL
    `).bind(
      period.publicPeriod.from, period.currentToExclusive,
      period.publicPeriod.previous_from, period.previousToExclusive,
      partyId,
    ).first<{ current_count: number; previous_count: number }>(),
    c.env.DB.prepare(`
      SELECT COUNT(*) AS count
      FROM share_links
      WHERE creator_party_id = ?
        AND moderation_status = 'approved'
        AND is_revoked = 0
        AND legacy_provenance_status IS NULL
        AND paused_at IS NULL
        AND (expires_at IS NULL OR expires_at > strftime('%s', 'now'))
    `).bind(partyId).first<{ count: number }>(),
    c.env.DB.prepare(`
      SELECT date(event.created_at) AS day, COUNT(DISTINCT event.visitor_id) AS count
      FROM page_view_events event
      JOIN share_links share ON share.creator_party_id = ? AND (
        event.path = '/share/' || share.token
        OR (
          substr(event.path, 1, length('/share/' || share.token)) = '/share/' || share.token
          AND substr(event.path, length('/share/' || share.token) + 1, 1) IN ('?', '#')
        )
      )
      WHERE event.visitor_id IS NOT NULL
        AND event.created_at >= datetime(?) AND event.created_at < datetime(?)
      GROUP BY date(event.created_at)
    `).bind(partyId, period.publicPeriod.from, period.currentToExclusive).all<{ day: string; count: number }>(),
    c.env.DB.prepare(`
      SELECT date(clicked_at) AS day, COUNT(*) AS count
      FROM product_link_clicks
      WHERE creator_context_party_id = ?
        AND clicked_at >= datetime(?) AND clicked_at < datetime(?)
      GROUP BY date(clicked_at)
    `).bind(partyId, period.publicPeriod.from, period.currentToExclusive).all<{ day: string; count: number }>(),
    c.env.DB.prepare(`
      SELECT date(operation.created_at) AS day, COUNT(*) AS count
      FROM share_import_operations operation
      JOIN share_links share ON share.id = operation.share_link_id
      WHERE share.creator_party_id = ?
        AND operation.created_at >= datetime(?) AND operation.created_at < datetime(?)
      GROUP BY date(operation.created_at)
    `).bind(partyId, period.publicPeriod.from, period.currentToExclusive).all<{ day: string; count: number }>(),
  ])
  const trendByDay = new Map<string, { date: string; unique_visitors: number; clicks: number; saves: number }>()
  const fromDay = new Date(period.publicPeriod.from)
  for (let offset = 0; offset < period.publicPeriod.days; offset += 1) {
    const date = new Date(fromDay.getTime() + (offset * 24 * 60 * 60 * 1000)).toISOString().slice(0, 10)
    trendByDay.set(date, { date, unique_visitors: 0, clicks: 0, saves: 0 })
  }
  for (const row of visitorTrend.results ?? []) {
    const point = trendByDay.get(row.day)
    if (point) point.unique_visitors = Number(row.count)
  }
  for (const row of clickTrend.results ?? []) {
    const point = trendByDay.get(row.day)
    if (point) point.clicks = Number(row.count)
  }
  for (const row of saveTrend.results ?? []) {
    const point = trendByDay.get(row.day)
    if (point) point.saves = Number(row.count)
  }
  return c.json({
    party: { id: party.id, name: party.name, slug: party.slug, type: party.type },
    period: {
      days: period.publicPeriod.days,
      from: period.publicPeriod.from,
      to: period.publicPeriod.to,
      previous_from: period.publicPeriod.previous_from,
      previous_to: period.publicPeriod.previous_to,
      definitions: {
        unique_visitors: period.publicPeriod.unique_visitors_definition,
        clicks: 'Aufrufe von Produktlinks aus einem gespeicherten Creator-Stack.',
        saves: period.publicPeriod.saves_definition,
        imported_stacks: 'Stacks, die in diesem Zeitraum neu aus einer Empfehlung erstellt wurden und nicht im Papierkorb liegen.',
        clicked_products: 'Verschiedene Produkte mit mindestens einem Link-Aufruf im Zeitraum.',
        clicked_shops: 'Verschiedene noch einer Shop-Domain zuordenbare Shops mit mindestens einem Link-Aufruf im Zeitraum.',
      },
    },
    current: {
      unique_visitors: Number(visitors?.current_count ?? 0),
      clicks: Number(clicks?.current_clicks ?? 0),
      saves: Number(saves?.current_count ?? 0),
      imported_stacks: Number(stacks?.current_count ?? 0),
      clicked_products: Number(clicks?.current_products ?? 0),
      clicked_shops: Number(clicks?.current_shops ?? 0),
    },
    previous: {
      unique_visitors: Number(visitors?.previous_count ?? 0),
      clicks: Number(clicks?.previous_clicks ?? 0),
      saves: Number(saves?.previous_count ?? 0),
      imported_stacks: Number(stacks?.previous_count ?? 0),
      clicked_products: Number(clicks?.previous_products ?? 0),
      clicked_shops: Number(clicks?.previous_shops ?? 0),
    },
    active_shares: Number(shares?.count ?? 0),
    trend: [...trendByDay.values()],
  })
})

// GET /api/creator-sharing/stacks/:stackId/default-product/:ingredientId
creatorSharing.get('/stacks/:stackId/default-product/:ingredientId', async (c) => {
  const featureErr = ensureFeature(c)
  if (featureErr) return featureErr
  const authErr = await ensureAuth(c)
  if (authErr) return authErr
  const stackId = positiveInteger(c.req.param('stackId'))
  const ingredientId = positiveInteger(c.req.param('ingredientId'))
  if (!stackId || !ingredientId) return c.json({ error: 'Invalid stack or ingredient id' }, 400)
  const user = c.get('user')
  const stack = await c.env.DB.prepare(`
    SELECT s.id,
      CASE WHEN origin.status = 'active' THEN s.origin_party_id ELSE NULL END AS origin_party_id
    FROM stacks s
    LEFT JOIN parties origin ON origin.id = s.origin_party_id
    WHERE s.id = ? AND s.user_id = ? AND s.deleted_at IS NULL
  `).bind(stackId, user.userId).first<{ id: number; origin_party_id: number | null }>()
  if (!stack) return c.json({ error: 'Stack not found' }, 404)

  const candidate = await c.env.DB.prepare(`
    WITH ranked AS (
      SELECT
        p.id AS product_id,
        p.name,
        p.brand,
        psl.id AS shop_link_id,
        CASE
          WHEN pick.product_id = p.id THEN 1
          WHEN default_shop.shop_domain_id = psl.shop_domain_id THEN 2
          WHEN recommendation.product_id = p.id THEN 3
          ELSE 4
        END AS priority
      FROM products p
      JOIN product_ingredients pi ON pi.product_id = p.id AND pi.ingredient_id = ? AND pi.is_main = 1
      JOIN product_shop_links psl ON psl.product_id = p.id
        AND psl.active = 1 AND psl.blocked_at IS NULL AND psl.shop_domain_id IS NOT NULL
      JOIN parties owner ON owner.id = p.owner_party_id AND owner.status = 'active'
      LEFT JOIN party_product_picks pick ON pick.party_id = ? AND pick.ingredient_id = ? AND pick.product_id = p.id
      LEFT JOIN party_default_shops default_shop ON default_shop.party_id = ? AND default_shop.shop_domain_id = psl.shop_domain_id
      LEFT JOIN product_recommendations recommendation ON recommendation.ingredient_id = ? AND recommendation.product_id = p.id
      WHERE p.moderation_status = 'approved'
        AND (
          p.id IN (SELECT product_id FROM globally_visible_products)
          OR (p.owner_party_id = ? AND p.visibility <> 'hidden')
        )
    )
    SELECT product_id, name, brand, shop_link_id, priority
    FROM ranked
    ORDER BY priority ASC, product_id ASC
    LIMIT 1
  `).bind(
    ingredientId,
    stack.origin_party_id,
    ingredientId,
    stack.origin_party_id,
    ingredientId,
    stack.origin_party_id,
  ).first<{ product_id: number; name: string; brand: string | null; shop_link_id: number; priority: number }>()
  if (!candidate) return c.json({ product: null })
  return c.json({ product: candidate })
})

export default creatorSharing
