import { Hono, type Context } from 'hono'
import type { AppContext } from '../lib/types'
import { ensureAuth } from '../lib/helpers'
import creatorSharingImport from './creator-sharing-import'
import {
  CREATOR_SHARING_SNAPSHOT_VERSION,
  buildAffiliateUrl,
  canonicalJson,
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
  loadMainIngredientIds,
  parseStoredSnapshot,
  validateSnapshotRelations,
  type AffiliateVersionRow,
  type ValidatedSnapshotRelations,
} from '../lib/creator-sharing-service'

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
}

type CreatorShareStatus = 'pending' | 'approved' | 'blocked' | 'revoked' | 'expired'

type PreviewProductRow = {
  id: number
  name: string
  brand: string | null
}

type CreatorShareListRow = ShareRow & {
  source_stack_id: number | null
  source_stack_name: string | null
}

type StackShareSourceRow = {
  stack_item_id: number
  stack_name: string
  catalog_product_id: number
  quantity: number
  serving_unit: string | null
  intake_interval_days: number | null
  dosage_text: string | null
  timing: string | null
  sort_order: number
  shop_link_id: number
  url: string
  shop_domain_id: number | null
  shop_domain: string | null
  link_kind: 'base_target' | 'legacy_resolved' | null
  legacy_party_id: number | null
  active: number
  blocked_at: string | null
}

function ensureFeature(c: Context<AppContext>): Response | null {
  return creatorSharingEnabled(c.env) ? null : c.json({ error: 'Not found' }, 404)
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
  if (
    !shareId
    || !expectedSnapshotHash
    || !/^[a-f0-9]{64}$/.test(expectedSnapshotHash)
    || !expectedStatus
    || !expectedModerationStatus
    || expectedIsRevoked === null
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
    },
  }
}

function d1Changes(result: D1Result<unknown>): number {
  const value = Number((result.meta as { changes?: number } | undefined)?.changes ?? 0)
  return Number.isFinite(value) ? value : 0
}

type StackExpectedSourceRow = {
  stack_item_id: number
  product_name: string
}

type UnshareableProduct = {
  stack_item_id: number
  product_name: string
}

type SourceShareGuard = {
  shareId: number
  expectedSnapshotHash: string
  expectedStatus: 'blocked' | 'revoked' | 'expired'
  expectedModerationStatus: 'pending' | 'approved' | 'blocked'
  expectedIsRevoked: 0 | 1
  expectedExpiresAt: number | null
}

function creatorShareStatus(row: ShareRow, nowSeconds = Math.floor(Date.now() / 1000)): CreatorShareStatus {
  if (row.is_revoked === 1) return 'revoked'
  if (row.expires_at !== null && row.expires_at <= nowSeconds) return 'expired'
  return row.moderation_status
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

// GET /api/creator-sharing/parties
creatorSharing.get('/parties', async (c) => {
  const featureErr = ensureFeature(c)
  if (featureErr) return featureErr
  const authErr = await ensureAuth(c)
  if (authErr) return authErr
  const user = c.get('user')
  const { results } = await c.env.DB.prepare(`
    SELECT party.id, party.type, party.name, party.slug, party.status,
      membership.role, party.auto_catalog_approval
    FROM party_memberships membership
    JOIN parties party ON party.id = membership.party_id
    WHERE membership.user_id = ? AND membership.status = 'active'
      AND party.status = 'active'
    ORDER BY party.name, party.id
  `).bind(user.userId).all()
  return c.json({ parties: results })
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
      AND (expires_at IS NULL OR expires_at > strftime('%s', 'now'))
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
  if (!party) return null
  const productIds = [...new Set(snapshot.items.map((item) => item.catalog_product_id))]
  const productById = new Map<number, PreviewProductRow>()
  if (productIds.length > 0) {
    const placeholders = productIds.map(() => '?').join(',')
    const { results } = await db.prepare(`
      SELECT id, name, brand
      FROM products
      WHERE id IN (${placeholders})
    `).bind(...productIds).all<PreviewProductRow>()
    for (const product of results ?? []) productById.set(product.id, product)
  }
  return {
    token: row.token,
    type: snapshot.type,
    title: snapshot.title,
    creator: { id: party.id, name: party.name, type: party.type, slug: party.slug },
    published_at: snapshot.published_at,
    items: snapshot.items.map((item) => {
      const product = productById.get(item.catalog_product_id)
      return {
        catalog_product_id: item.catalog_product_id,
        product_name: product?.name ?? null,
        brand: product?.brand ?? null,
        quantity: item.quantity,
        unit: item.unit ?? null,
        intake_interval_days: item.intake_interval_days,
        dosage_text: item.dosage_text,
        timing: item.timing,
        creator_statement: item.creator_statement,
        has_affiliate_attribution: item.link_binding.resolution_kind !== 'bare',
      }
    }),
    disclosure: 'Einige Produktlinks sind Affiliate-Links. Die Plattform oder der Stack-Anbieter kann daran verdienen; für dich ändert sich der Preis nicht.',
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
}> {
  const stack = await db.prepare('SELECT id FROM stacks WHERE id = ? AND user_id = ? AND deleted_at IS NULL')
    .bind(stackId, userId).first<{ id: number }>()
  if (!stack) return { error: 'Stack nicht gefunden.', errorCode: 'STACK_NOT_FOUND' }
  const expectedResult = await db.prepare(`
    SELECT
      si.id AS stack_item_id,
      COALESCE(p.name, up.name, 'Nicht mehr verfügbares Produkt') AS product_name
    FROM stack_items si
    LEFT JOIN products p ON p.id = si.catalog_product_id
    LEFT JOIN user_products up ON up.id = si.user_product_id
    WHERE si.stack_id = ?
      AND (? IS NULL OR si.id = ?)
    ORDER BY si.sort_order ASC, si.id ASC
  `).bind(stackId, stackItemId, stackItemId).all<StackExpectedSourceRow>()
  const expected = expectedResult.results ?? []

  const { results } = await db.prepare(`
    SELECT
      si.id AS stack_item_id,
      s.name AS stack_name,
      si.catalog_product_id,
      si.quantity,
      p.serving_unit,
      si.intake_interval_days,
      si.dosage_text,
      si.timing,
      si.sort_order,
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
    )
    JOIN shop_domains sd ON sd.id = psl.shop_domain_id
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
  const eligibleRows = (results ?? []).filter((row) => (
    Number.isSafeInteger(row.intake_interval_days)
      && Number(row.intake_interval_days) > 0
      && Boolean(row.shop_domain && validateProductTargetUrl(row.url, row.shop_domain).url)
      && (row.link_kind !== 'legacy_resolved' || Boolean(row.legacy_party_id))
  ))
  const mainIds = await loadMainIngredientIds(db, eligibleRows.map((row) => row.catalog_product_id))
  const shareableRows = eligibleRows.filter((row) => (mainIds.get(row.catalog_product_id) ?? []).length > 0)
  const shareableIds = new Set(shareableRows.map((row) => row.stack_item_id))
  const unshareableProducts = expected
    .filter((item) => !shareableIds.has(item.stack_item_id))
    .map((item) => ({ stack_item_id: item.stack_item_id, product_name: item.product_name }))
  if (expected.length === 0 || unshareableProducts.length > 0 || shareableRows.length !== expected.length) {
    return {
      error: expected.length === 0
        ? 'Dieser Stack enthält noch kein Produkt, das geteilt werden kann.'
        : 'Mindestens ein Produkt aus diesem Stack kann noch nicht geteilt werden.',
      errorCode: 'STACK_NOT_FULLY_SHAREABLE',
      unshareableProducts,
      shareableRows,
    }
  }
  return { rows: shareableRows }
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
    })
  }
  return c.json({
    ready: true,
    shareable_stack_item_ids: source.rows.map((row) => row.stack_item_id),
    unshareable_products: [],
  })
})

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
  if (!party || !['creator', 'brand'].includes(party.type)) {
    return c.json({ error: 'Creator oder Marke wurde nicht gefunden.' }, 404)
  }
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
    WHERE share.creator_party_id = ?
    ORDER BY share.created_at DESC, share.id DESC
    LIMIT 200
  `).bind(partyId).all<CreatorShareListRow>()
  const shares: Array<Record<string, unknown>> = []
  for (const row of results ?? []) {
    const parsed = await parseCreatorShareRow(row)
    if (!parsed.snapshot) return c.json({ error: parsed.error ?? 'Empfehlungen konnten nicht geladen werden.' }, 409)
    shares.push({
      id: row.id,
      token: row.token,
      type: row.entity_type,
      entity_id: row.entity_id,
      source_stack_id: row.source_stack_id,
      source_stack_name: row.source_stack_name,
      title: parsed.snapshot.title,
      published_at: parsed.snapshot.published_at,
      created_at: row.created_at,
      expires_at: row.expires_at,
      status: creatorShareStatus(row),
      moderation_status: row.moderation_status,
      is_revoked: row.is_revoked,
      snapshot_hash: row.snapshot_hash,
      views: row.views,
      saves: row.imports,
    })
  }
  return c.json({ party: { id: party.id, name: party.name, type: party.type }, shares })
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
  const parsed = await parseCreatorShareRow(row)
  if (!parsed.snapshot) return c.json({ error: parsed.error ?? 'Vorschau konnte nicht geladen werden.' }, 409)
  const preview = await creatorPreviewPayload(c.env.DB, row, parsed.snapshot)
  if (!preview) return c.json({ error: 'Creator oder Marke wurde nicht gefunden.' }, 409)
  return c.json({
    ...preview,
    creator_status: creatorShareStatus(row),
    share_id: row.id,
    snapshot_hash: row.snapshot_hash,
    moderation_status: row.moderation_status,
    is_revoked: row.is_revoked,
    expires_at: row.expires_at,
  })
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
  const expectedStatus = body.expected_moderation_status === 'pending'
    || body.expected_moderation_status === 'approved'
    || body.expected_moderation_status === 'blocked'
    ? body.expected_moderation_status
    : null
  if (!expectedHash || !/^[a-f0-9]{64}$/.test(expectedHash) || !expectedStatus || body.expected_is_revoked !== 0) {
    return c.json({ error: 'Die aktuellen Angaben der Empfehlung fehlen.' }, 400)
  }
  const row = await c.env.DB.prepare('SELECT * FROM share_links WHERE id = ?')
    .bind(shareId).first<ShareRow>()
  if (!row || !row.creator_party_id) return c.json({ error: 'Empfehlung wurde nicht gefunden.' }, 404)
  const user = c.get('user')
  if (!(await hasPartyAccess(c.env.DB, user.userId, row.creator_party_id, ['owner', 'editor']))) {
    return c.json({ error: 'Forbidden' }, 403)
  }
  if (creatorShareStatus(row) !== 'approved') {
    return c.json({ error: 'Nur eine freigegebene Empfehlung kann beendet werden.' }, 409)
  }
  const result = await c.env.DB.prepare(`
    UPDATE share_links
    SET is_revoked = 1
    WHERE id = ?
      AND creator_party_id = ?
      AND snapshot_hash = ?
      AND moderation_status = ?
      AND is_revoked = 0
      AND (expires_at IS NULL OR expires_at > strftime('%s', 'now'))
  `).bind(shareId, row.creator_party_id, expectedHash, expectedStatus).run()
  if (d1Changes(result) !== 1) {
    return c.json({ error: 'Die Empfehlung hat sich geändert. Bitte lade sie neu.' }, 409)
  }
  return c.json({ ok: true, status: 'revoked' })
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
  const hash = await snapshotHash(parsedSnapshot.value)
  const token = generateShareToken()
  const entityId = type === 'stack' ? stackId : stackItemId
  const snapshotJson = canonicalJson(parsedSnapshot.value)
  const result = guard.value
    ? await c.env.DB.prepare(`
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
          is_revoked
        )
        SELECT ?, ?, ?, ?, ?, ?, ?, ?, 'pending', 0
        FROM share_links source
        WHERE source.id = ?
          AND source.creator_party_id = ?
          AND source.snapshot_hash = ?
          AND source.moderation_status = ?
          AND source.is_revoked = ?
          AND (
            (source.expires_at IS NULL AND ? IS NULL)
            OR source.expires_at = ?
          )
          AND CASE
            WHEN source.is_revoked = 1 THEN 'revoked'
            WHEN source.expires_at IS NOT NULL AND source.expires_at <= strftime('%s', 'now') THEN 'expired'
            ELSE source.moderation_status
          END = ?
      `).bind(
        token,
        type,
        entityId,
        snapshotJson,
        user.userId,
        partyId,
        CREATOR_SHARING_SNAPSHOT_VERSION,
        hash,
        guard.value.shareId,
        partyId,
        guard.value.expectedSnapshotHash,
        guard.value.expectedModerationStatus,
        guard.value.expectedIsRevoked,
        guard.value.expectedExpiresAt,
        guard.value.expectedExpiresAt,
        guard.value.expectedStatus,
      ).run()
    : await c.env.DB.prepare(`
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
          is_revoked
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending', 0)
      `).bind(
        token,
        type,
        entityId,
        snapshotJson,
        user.userId,
        partyId,
        CREATOR_SHARING_SNAPSHOT_VERSION,
        hash,
      ).run()
  if (guard.value && d1Changes(result) !== 1) {
    return c.json({
      error: 'Die ursprüngliche Empfehlung hat sich geändert. Bitte lade deine Empfehlungen neu.',
      code: 'SOURCE_SHARE_CHANGED',
    }, 409)
  }
  return c.json({
    id: result.meta.last_row_id,
    token,
    moderation_status: 'pending',
    snapshot_hash: hash,
  }, 201)
})

async function publicShareFailure(db: D1Database, token: string): Promise<{
  code: 'SHARE_PENDING' | 'SHARE_EXPIRED' | 'SHARE_UNAVAILABLE' | 'SHARE_UNKNOWN' | 'SHARE_INVALID'
  error: string
  httpStatus: 404 | 409 | 410
}> {
  if (!/^[A-Za-z0-9_-]{24,80}$/.test(token)) {
    return { code: 'SHARE_UNKNOWN', error: 'Diese Empfehlung wurde nicht gefunden.', httpStatus: 404 }
  }
  const row = await db.prepare('SELECT * FROM share_links WHERE token = ? LIMIT 1').bind(token).first<ShareRow>()
  if (!row) return { code: 'SHARE_UNKNOWN', error: 'Diese Empfehlung wurde nicht gefunden.', httpStatus: 404 }
  const status = creatorShareStatus(row)
  if (status === 'pending') {
    return { code: 'SHARE_PENDING', error: 'Diese Empfehlung wird noch geprüft.', httpStatus: 409 }
  }
  if (status === 'expired') {
    return { code: 'SHARE_EXPIRED', error: 'Dieser Link ist abgelaufen.', httpStatus: 410 }
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
  const loaded = await loadShare(c.env.DB, c.req.param('token'), true)
  if (!loaded.row || !loaded.snapshot || !loaded.relations) {
    const failure = await publicShareFailure(c.env.DB, c.req.param('token'))
    return c.json({ error: failure.error, code: failure.code }, failure.httpStatus)
  }
  const party = await getParty(c.env.DB, loaded.snapshot.creator_party_id)
  if (!party) return c.json({ error: 'Creator-Partei fehlt.' }, 409)
  await c.env.DB.prepare(`
    UPDATE share_links
    SET views = views + 1
    WHERE id = ?
      AND snapshot_hash = ?
      AND moderation_status = 'approved'
  `).bind(loaded.row.id, loaded.row.snapshot_hash).run()
  return c.json({
    token: loaded.row.token,
    type: loaded.snapshot.type,
    title: loaded.snapshot.title,
    creator: { id: party.id, name: party.name, type: party.type, slug: party.slug },
    published_at: loaded.snapshot.published_at,
    items: loaded.snapshot.items.map((item) => {
      const product = loaded.relations?.products.get(item.catalog_product_id)
      return {
        catalog_product_id: item.catalog_product_id,
        product_name: product?.name ?? null,
        brand: product?.brand ?? null,
        quantity: item.quantity,
        unit: item.unit ?? null,
        intake_interval_days: item.intake_interval_days,
        dosage_text: item.dosage_text,
        timing: item.timing,
        creator_statement: item.creator_statement,
        has_affiliate_attribution: item.link_binding.resolution_kind !== 'bare',
      }
    }),
    disclosure: 'Einige Produktlinks sind Affiliate-Links. Die Plattform oder der Stack-Anbieter kann daran verdienen; für dich ändert sich der Preis nicht.',
  })
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
  const user = c.get('user')
  if (!(await hasPartyAccess(c.env.DB, user.userId, partyId, ['owner', 'editor', 'viewer']))) {
    return c.json({ error: 'Forbidden' }, 403)
  }
  const party = await getParty(c.env.DB, partyId)
  if (!party) return c.json({ error: 'Party not found' }, 404)
  const [clicksTotal, clicksCurrent, clicksPrevious, stacks, products, shops, shares] = await Promise.all([
    c.env.DB.prepare(`SELECT COUNT(*) AS count FROM product_link_clicks WHERE creator_context_party_id = ?`)
      .bind(partyId).first<{ count: number }>(),
    c.env.DB.prepare(`
      SELECT COUNT(*) AS count FROM product_link_clicks
      WHERE creator_context_party_id = ? AND clicked_at >= datetime('now', '-30 days')
    `).bind(partyId).first<{ count: number }>(),
    c.env.DB.prepare(`
      SELECT COUNT(*) AS count FROM product_link_clicks
      WHERE creator_context_party_id = ?
        AND clicked_at >= datetime('now', '-60 days')
        AND clicked_at < datetime('now', '-30 days')
    `).bind(partyId).first<{ count: number }>(),
    c.env.DB.prepare(`SELECT COUNT(*) AS count FROM stacks WHERE origin_party_id = ? AND deleted_at IS NULL`).bind(partyId).first<{ count: number }>(),
    c.env.DB.prepare(`
      SELECT COUNT(DISTINCT product_id) AS count
      FROM product_link_clicks
      WHERE creator_context_party_id = ? AND clicked_at >= datetime('now', '-30 days')
    `).bind(partyId).first<{ count: number }>(),
    c.env.DB.prepare(`
      SELECT COUNT(DISTINCT psl.shop_domain_id) AS count
      FROM product_link_clicks click
      JOIN product_shop_links psl ON psl.id = click.shop_link_id
      WHERE click.creator_context_party_id = ? AND click.clicked_at >= datetime('now', '-30 days')
    `).bind(partyId).first<{ count: number }>(),
    c.env.DB.prepare(`
      SELECT COUNT(*) AS count, COALESCE(SUM(imports), 0) AS imports
      FROM share_links
      WHERE creator_party_id = ?
        AND moderation_status = 'approved'
        AND is_revoked = 0
        AND (expires_at IS NULL OR expires_at > strftime('%s', 'now'))
    `).bind(partyId).first<{ count: number; imports: number }>(),
  ])
  return c.json({
    party: { id: party.id, name: party.name, slug: party.slug, type: party.type },
    period_days: 30,
    clicks_total: clicksTotal?.count ?? 0,
    clicks: clicksCurrent?.count ?? 0,
    previous_clicks: clicksPrevious?.count ?? 0,
    imported_stacks: stacks?.count ?? 0,
    clicked_products: products?.count ?? 0,
    clicked_shops: shops?.count ?? 0,
    active_shares: shares?.count ?? 0,
    imports: shares?.imports ?? 0,
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
