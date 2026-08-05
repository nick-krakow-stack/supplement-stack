import { Hono, type Context } from 'hono'
import type { AppContext } from '../lib/types'
import { ensureAuth } from '../lib/helpers'
import {
  CREATOR_SHARING_SNAPSHOT_VERSION,
  buildAffiliateUrl,
  canonicalJson,
  creatorSharingEnabled,
  dateWindowAllows,
  generateShareToken,
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
  reserveIds,
  sameIntegerSet,
  snapshotItemBindingStatements,
  validateSnapshotRelations,
  type AffiliateVersionRow,
  type ValidatedSnapshotRelations,
} from '../lib/creator-sharing-service'

const creatorSharing = new Hono<AppContext>()

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

type StackShareSourceRow = {
  stack_item_id: number
  stack_name: string
  catalog_product_id: number
  quantity: number
  intake_interval_days: number
  dosage_text: string | null
  timing: string | null
  sort_order: number
  category_name: string | null
  shop_link_id: number
  url: string
  shop_domain_id: number | null
  shop_domain: string | null
  link_kind: 'base_target' | 'legacy_resolved' | null
  legacy_party_id: number | null
  active: number
  blocked_at: string | null
}

type ExistingStackIngredientRow = {
  stack_item_id: number
  version: number
  ingredient_id: number
  product_name: string
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

function d1Changes(result: D1Result<unknown>): number {
  const value = Number((result.meta as { changes?: number } | undefined)?.changes ?? 0)
  return Number.isFinite(value) ? value : 0
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

function normalizeCategoryName(value: string | null): { name: string; normalized: string } {
  const name = value?.trim() || 'Unkategorisiert'
  return {
    name: name.slice(0, 80),
    normalized: name.trim().toLocaleLowerCase('de-DE').replace(/\s+/g, ' '),
  }
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
  if (row.snapshot_schema_version !== CREATOR_SHARING_SNAPSHOT_VERSION || !row.snapshot_hash) {
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
): Promise<{ rows?: StackShareSourceRow[]; error?: string }> {
  const stack = await db.prepare('SELECT id FROM stacks WHERE id = ? AND user_id = ?')
    .bind(stackId, userId).first<{ id: number }>()
  if (!stack) return { error: 'Stack nicht gefunden.' }
  const userProductCount = await db.prepare(`
    SELECT COUNT(*) AS count
    FROM stack_items
    WHERE stack_id = ?
      AND user_product_id IS NOT NULL
      AND (? IS NULL OR id = ?)
  `).bind(stackId, stackItemId, stackItemId).first<{ count: number }>()
  if ((userProductCount?.count ?? 0) > 0) {
    return { error: 'Geteilte Produkte müssen zuerst als moderierte Katalogprodukte veröffentlicht werden.' }
  }

  const { results } = await db.prepare(`
    SELECT
      si.id AS stack_item_id,
      s.name AS stack_name,
      si.catalog_product_id,
      si.quantity,
      si.intake_interval_days,
      si.dosage_text,
      si.timing,
      si.sort_order,
      category.name AS category_name,
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
    LEFT JOIN stack_categories category ON category.id = si.category_id
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
  if (!results || results.length === 0) return { error: 'Stack enthält keine teilbare Katalogposition.' }
  if (stackItemId && results.length !== 1) return { error: 'Stack-Position ist nicht teilbar.' }
  return { rows: results }
}

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
  if (!source.rows) return c.json({ error: source.error ?? 'Stack ist nicht teilbar.' }, 409)
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
      intake_interval_days: row.intake_interval_days,
      dosage_text: row.dosage_text,
      timing: row.timing,
      creator_statement: statement,
      sort_order: row.sort_order,
      category_name: row.category_name,
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
  const result = await c.env.DB.prepare(`
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
    type === 'stack' ? stackId : stackItemId,
    canonicalJson(parsedSnapshot.value),
    user.userId,
    partyId,
    CREATOR_SHARING_SNAPSHOT_VERSION,
    hash,
  ).run()
  return c.json({
    id: result.meta.last_row_id,
    token,
    moderation_status: 'pending',
    snapshot_hash: hash,
  }, 201)
})

// GET /api/creator-sharing/shares/:token
creatorSharing.get('/shares/:token', async (c) => {
  const featureErr = ensureFeature(c)
  if (featureErr) return featureErr
  const loaded = await loadShare(c.env.DB, c.req.param('token'), true)
  if (!loaded.row || !loaded.snapshot || !loaded.relations) {
    return c.json({ error: loaded.error ?? 'Share nicht gefunden.' }, loaded.status === 409 ? 409 : 404)
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
        intake_interval_days: item.intake_interval_days,
        dosage_text: item.dosage_text,
        timing: item.timing,
        creator_statement: item.creator_statement,
        category_name: item.category_name,
        has_affiliate_attribution: item.link_binding.resolution_kind !== 'bare',
      }
    }),
    disclosure: 'Einige Produktlinks sind Affiliate-Links. Die Plattform oder der Stack-Anbieter kann daran verdienen; für dich ändert sich der Preis nicht.',
  })
})

async function existingStackMainSets(
  db: D1Database,
  stackId: number,
): Promise<Map<number, { ids: number[]; version: number; productName: string }>> {
  const { results } = await db.prepare(`
    SELECT stack_item_id, version, ingredient_id
    FROM (
      SELECT si.id AS stack_item_id, si.version, pi.ingredient_id, p.name AS product_name
      FROM stack_items si
      JOIN products p ON p.id = si.catalog_product_id
      JOIN product_ingredients pi ON pi.product_id = si.catalog_product_id AND pi.is_main = 1
      WHERE si.stack_id = ? AND si.catalog_product_id IS NOT NULL
      UNION ALL
      SELECT si.id AS stack_item_id, si.version, upi.ingredient_id, up.name AS product_name
      FROM stack_items si
      JOIN user_products up ON up.id = si.user_product_id
      JOIN user_product_ingredients upi ON upi.user_product_id = si.user_product_id AND upi.is_main = 1
      WHERE si.stack_id = ? AND si.user_product_id IS NOT NULL
    )
    ORDER BY stack_item_id ASC, ingredient_id ASC
  `).bind(stackId, stackId).all<ExistingStackIngredientRow>()
  const sets = new Map<number, { ids: number[]; version: number; productName: string }>()
  for (const row of results ?? []) {
    const existing = sets.get(row.stack_item_id) ?? { ids: [], version: row.version, productName: row.product_name }
    if (!existing.ids.includes(row.ingredient_id)) existing.ids.push(row.ingredient_id)
    sets.set(row.stack_item_id, existing)
  }
  return sets
}

async function defaultCategoryId(db: D1Database, stackId: number): Promise<number | null> {
  const row = await db.prepare(`
    SELECT id FROM stack_categories WHERE stack_id = ? AND is_default = 1 LIMIT 1
  `).bind(stackId).first<{ id: number }>()
  return row?.id ?? null
}

// POST /api/creator-sharing/shares/:token/import
creatorSharing.post('/shares/:token/import', async (c) => {
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
  const idempotencyKey = boundedText(body.idempotency_key, 120)
  if (!idempotencyKey || !/^[A-Za-z0-9._:-]{16,120}$/.test(idempotencyKey)) {
    return c.json({ error: 'Ein gültiger Idempotency-Key ist erforderlich.' }, 400)
  }
  const loaded = await loadShare(c.env.DB, c.req.param('token'), true)
  if (!loaded.row || !loaded.snapshot || !loaded.relations) {
    return c.json({ error: loaded.error ?? 'Share nicht gefunden.' }, loaded.status === 409 ? 409 : 404)
  }
  const previous = await c.env.DB.prepare(`
    SELECT result_json
    FROM share_import_operations
    WHERE idempotency_key = ? AND user_id = ? AND share_link_id = ?
  `).bind(idempotencyKey, user.userId, loaded.row.id).first<{ result_json: string | null }>()
  if (previous?.result_json) {
    try {
      return c.json({ ...JSON.parse(previous.result_json) as Record<string, unknown>, idempotent_replay: true })
    } catch {
      return c.json({ error: 'Gespeichertes Importergebnis ist ungültig.' }, 409)
    }
  }
  const keyCollision = await c.env.DB.prepare(`
    SELECT share_link_id, user_id FROM share_import_operations WHERE idempotency_key = ?
  `).bind(idempotencyKey).first<{ share_link_id: number; user_id: number }>()
  if (keyCollision) return c.json({ error: 'Idempotency-Key wurde bereits für einen anderen Import verwendet.' }, 409)

  if (loaded.snapshot.type === 'stack') {
    const requestedName = body.stack_name === undefined ? loaded.snapshot.title : boundedText(body.stack_name, 120)
    if (!requestedName) return c.json({ error: 'Ungültiger Stack-Name.' }, 400)
    const [stackId] = await reserveIds(c.env.DB, 'stacks', 1)
    const itemIds = await reserveIds(c.env.DB, 'stack_items', loaded.snapshot.items.length)
    const categories: Array<{ name: string; normalized: string }> = [normalizeCategoryName(null)]
    for (const item of loaded.snapshot.items) {
      const category = normalizeCategoryName(item.category_name)
      if (!categories.some((entry) => entry.normalized === category.normalized)) categories.push(category)
    }
    categories.sort((left, right) => left.normalized === 'unkategorisiert' ? -1 : right.normalized === 'unkategorisiert' ? 1 : left.name.localeCompare(right.name, 'de'))
    const categoryIds = await reserveIds(c.env.DB, 'stack_categories', categories.length)
    const categoryIdByName = new Map(categories.map((entry, index) => [entry.normalized, categoryIds[index]]))
    const resultPayload = { ok: true, type: 'stack', stack_id: stackId, imported_items: itemIds.length }
    const statements: D1PreparedStatement[] = [c.env.DB.prepare(`
      INSERT INTO share_import_operations (
        idempotency_key, share_link_id, user_id, target_stack_id, result_json
      )
      SELECT ?, id, ?, NULL, ?
      FROM share_links
      WHERE id = ? AND snapshot_hash = ? AND moderation_status = 'approved'
        AND is_revoked = 0
        AND (expires_at IS NULL OR expires_at > strftime('%s', 'now'))
    `).bind(idempotencyKey, user.userId, JSON.stringify(resultPayload), loaded.row.id, loaded.row.snapshot_hash), c.env.DB.prepare(`
      INSERT INTO stacks (id, user_id, name, origin_party_id, last_opened_at)
      SELECT ?, ?, ?, ?, CURRENT_TIMESTAMP
      WHERE EXISTS (SELECT 1 FROM share_import_operations WHERE idempotency_key = ?)
    `).bind(stackId, user.userId, requestedName, loaded.snapshot.creator_party_id, idempotencyKey)]
    categories.forEach((category, index) => {
      statements.push(c.env.DB.prepare(`
        INSERT INTO stack_categories (
          id, stack_id, name, name_normalized, sort_order, is_default, created_at, updated_at
        )
        SELECT ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
        WHERE EXISTS (SELECT 1 FROM share_import_operations WHERE idempotency_key = ?)
      `).bind(
        categoryIds[index],
        stackId,
        category.name,
        category.normalized,
        index,
        category.normalized === 'unkategorisiert' ? 1 : 0,
        idempotencyKey,
      ))
    })
    loaded.snapshot.items.forEach((item, index) => {
      const category = normalizeCategoryName(item.category_name)
      statements.push(c.env.DB.prepare(`
        INSERT INTO stack_items (
          id, stack_id, catalog_product_id, user_product_id, quantity,
          intake_interval_days, dosage_text, timing, sort_order, category_id,
          source_share_link_id, creator_statement_snapshot, amount_source, version
        )
        SELECT ?, ?, ?, NULL, ?, ?, ?, ?, ?, ?, ?, ?, 'creator_snapshot', 1
        WHERE EXISTS (SELECT 1 FROM share_import_operations WHERE idempotency_key = ?)
      `).bind(
        itemIds[index],
        stackId,
        item.catalog_product_id,
        item.quantity,
        item.intake_interval_days,
        item.dosage_text,
        item.timing,
        item.sort_order,
        categoryIdByName.get(category.normalized) ?? null,
        loaded.row?.id,
        item.creator_statement,
        idempotencyKey,
      ))
      statements.push(...snapshotItemBindingStatements(c.env.DB, itemIds[index], item, idempotencyKey))
    })
    statements.push(c.env.DB.prepare(`
      UPDATE share_import_operations
      SET target_stack_id = ?
      WHERE idempotency_key = ? AND share_link_id = ? AND user_id = ?
    `).bind(stackId, idempotencyKey, loaded.row.id, user.userId))
    statements.push(c.env.DB.prepare(`
      UPDATE share_links
      SET imports = imports + 1
      WHERE id = ? AND snapshot_hash = ? AND moderation_status = 'approved'
        AND is_revoked = 0
        AND EXISTS (SELECT 1 FROM share_import_operations WHERE idempotency_key = ?)
    `).bind(loaded.row.id, loaded.row.snapshot_hash, idempotencyKey))
    try {
      const batch = await c.env.DB.batch(statements)
      if (d1Changes(batch[0]) !== 1) return c.json({ error: 'Share wurde zwischenzeitlich geändert.' }, 409)
    } catch (error) {
      const replay = await c.env.DB.prepare(`
        SELECT result_json FROM share_import_operations
        WHERE idempotency_key = ? AND user_id = ? AND share_link_id = ?
      `).bind(idempotencyKey, user.userId, loaded.row.id).first<{ result_json: string | null }>()
      if (replay?.result_json) return c.json({ ...JSON.parse(replay.result_json) as Record<string, unknown>, idempotent_replay: true })
      throw error
    }
    return c.json(resultPayload, 201)
  }

  const item = loaded.snapshot.items[0]
  const requestedStackId = positiveInteger(body.target_stack_id)
  const targetStack = requestedStackId
    ? await c.env.DB.prepare('SELECT id FROM stacks WHERE id = ? AND user_id = ?').bind(requestedStackId, user.userId).first<{ id: number }>()
    : await c.env.DB.prepare(`
        SELECT id FROM stacks WHERE user_id = ?
          AND last_opened_at IS NOT NULL
        ORDER BY CASE WHEN last_opened_at IS NULL THEN 1 ELSE 0 END,
          last_opened_at DESC, id DESC
        LIMIT 1
      `).bind(user.userId).first<{ id: number }>()
  if (!targetStack) return c.json({ error: 'Ziel-Stack nicht gefunden. Bitte wähle einen Stack.' }, 404)
  const sets = await existingStackMainSets(c.env.DB, targetStack.id)
  const conflicts = [...sets.entries()]
    .filter(([, value]) => sameIntegerSet(value.ids, item.main_ingredient_ids))
    .map(([stackItemId, value]) => ({ stack_item_id: stackItemId, version: value.version, product_name: value.productName }))
  const action = body.conflict_action === 'keep' || body.conflict_action === 'replace' ? body.conflict_action : null
  if (conflicts.length > 0 && !action) {
    return c.json({
      error: 'Ein identisches Hauptwirkstoff-Set ist bereits vorhanden.',
      conflict_required: true,
      conflicts,
    }, 409)
  }
  if (action === 'keep') {
    const resultPayload = { ok: true, type: 'dose_recommendation', stack_id: targetStack.id, action: 'kept_existing' }
    try {
      const batch = await c.env.DB.batch([
        c.env.DB.prepare(`
          INSERT INTO share_import_operations (
            idempotency_key, share_link_id, user_id, target_stack_id, result_json
          )
          SELECT ?, id, ?, ?, ?
          FROM share_links
          WHERE id = ? AND snapshot_hash = ? AND moderation_status = 'approved'
            AND is_revoked = 0
            AND (expires_at IS NULL OR expires_at > strftime('%s', 'now'))
        `).bind(idempotencyKey, user.userId, targetStack.id, JSON.stringify(resultPayload), loaded.row.id, loaded.row.snapshot_hash),
        c.env.DB.prepare(`
          UPDATE share_links SET imports = imports + 1
          WHERE id = ? AND snapshot_hash = ? AND moderation_status = 'approved' AND is_revoked = 0
            AND EXISTS (SELECT 1 FROM share_import_operations WHERE idempotency_key = ?)
        `).bind(loaded.row.id, loaded.row.snapshot_hash, idempotencyKey),
      ])
      if (d1Changes(batch[0]) !== 1) return c.json({ error: 'Share wurde zwischenzeitlich geändert.' }, 409)
    } catch (error) {
      const replay = await c.env.DB.prepare('SELECT result_json FROM share_import_operations WHERE idempotency_key = ?')
        .bind(idempotencyKey).first<{ result_json: string | null }>()
      if (replay?.result_json) return c.json({ ...JSON.parse(replay.result_json) as Record<string, unknown>, idempotent_replay: true })
      throw error
    }
    return c.json(resultPayload)
  }

  if (action === 'replace') {
    const replacementId = positiveInteger(body.replace_stack_item_id)
    const expectedVersion = positiveInteger(body.expected_stack_item_version)
    const conflict = conflicts.find((candidate) => candidate.stack_item_id === replacementId)
    if (!replacementId || !expectedVersion || !conflict || conflict.version !== expectedVersion) {
      return c.json({ error: 'Die konkret zu ersetzende Position und ihre Version sind erforderlich.', conflicts }, 409)
    }
    const resultPayload = { ok: true, type: 'dose_recommendation', stack_id: targetStack.id, action: 'replaced', stack_item_id: replacementId }
    let batch: D1Result<unknown>[]
    try {
      batch = await c.env.DB.batch([
      c.env.DB.prepare(`
        INSERT INTO share_import_operations (
          idempotency_key, share_link_id, user_id, target_stack_id, result_json
        )
        SELECT ?, share.id, ?, ?, ?
        FROM share_links share
        WHERE share.id = ? AND share.snapshot_hash = ?
          AND share.moderation_status = 'approved' AND share.is_revoked = 0
          AND (share.expires_at IS NULL OR share.expires_at > strftime('%s', 'now'))
          AND EXISTS (
            SELECT 1 FROM stack_items si
            WHERE si.id = ? AND si.stack_id = ? AND si.version = ?
          )
      `).bind(
        idempotencyKey,
        user.userId,
        targetStack.id,
        JSON.stringify(resultPayload),
        loaded.row.id,
        loaded.row.snapshot_hash,
        replacementId,
        targetStack.id,
        expectedVersion,
      ),
      c.env.DB.prepare(`
        UPDATE stack_items
        SET catalog_product_id = ?,
            user_product_id = NULL,
            quantity = ?,
            intake_interval_days = ?,
            dosage_text = ?,
            timing = ?,
            source_share_link_id = ?,
            creator_statement_snapshot = ?,
            amount_source = 'creator_snapshot',
            version = version + 1
        WHERE id = ? AND stack_id = ? AND version = ?
          AND EXISTS (SELECT 1 FROM share_import_operations WHERE idempotency_key = ?)
      `).bind(
        item.catalog_product_id,
        item.quantity,
        item.intake_interval_days,
        item.dosage_text,
        item.timing,
        loaded.row.id,
        item.creator_statement,
        replacementId,
        targetStack.id,
        expectedVersion,
        idempotencyKey,
      ),
      c.env.DB.prepare(`
        DELETE FROM stack_item_link_bindings
        WHERE stack_item_id = ?
          AND EXISTS (SELECT 1 FROM stack_items WHERE id = ? AND version = ?)
          AND EXISTS (SELECT 1 FROM share_import_operations WHERE idempotency_key = ?)
      `).bind(replacementId, replacementId, expectedVersion + 1, idempotencyKey),
      c.env.DB.prepare(`
        INSERT INTO stack_item_link_bindings (
          stack_item_id, shop_link_id, resolution_kind,
          affiliate_version_id, resolved_party_id, bound_at
        )
        SELECT ?, ?, ?, ?, ?, CURRENT_TIMESTAMP
        WHERE EXISTS (SELECT 1 FROM stack_items WHERE id = ? AND version = ?)
          AND EXISTS (SELECT 1 FROM share_import_operations WHERE idempotency_key = ?)
      `).bind(
        replacementId,
        item.shop_link_id,
        item.link_binding.resolution_kind,
        item.link_binding.affiliate_version_id,
        item.link_binding.resolved_party_id,
        replacementId,
        expectedVersion + 1,
        idempotencyKey,
      ),
      c.env.DB.prepare(`
        UPDATE share_links
        SET imports = imports + 1
        WHERE id = ? AND snapshot_hash = ?
          AND moderation_status = 'approved' AND is_revoked = 0
          AND EXISTS (SELECT 1 FROM share_import_operations WHERE idempotency_key = ?)
      `).bind(loaded.row.id, loaded.row.snapshot_hash, idempotencyKey),
      ])
    } catch (error) {
      const replay = await c.env.DB.prepare(`
        SELECT result_json FROM share_import_operations
        WHERE idempotency_key = ? AND user_id = ? AND share_link_id = ?
      `).bind(idempotencyKey, user.userId, loaded.row.id).first<{ result_json: string | null }>()
      if (replay?.result_json) return c.json({ ...JSON.parse(replay.result_json) as Record<string, unknown>, idempotent_replay: true })
      throw error
    }
    if (d1Changes(batch[0]) !== 1 || d1Changes(batch[1]) !== 1) {
      return c.json({ error: 'Share oder Stack-Position wurde zwischenzeitlich geändert.' }, 409)
    }
    return c.json(resultPayload)
  }

  const [newItemId] = await reserveIds(c.env.DB, 'stack_items', 1)
  let categoryId = await defaultCategoryId(c.env.DB, targetStack.id)
  const statements: D1PreparedStatement[] = []
  const resultPayload = { ok: true, type: 'dose_recommendation', stack_id: targetStack.id, action: 'added', stack_item_id: newItemId }
  statements.push(c.env.DB.prepare(`
    INSERT INTO share_import_operations (
      idempotency_key, share_link_id, user_id, target_stack_id, result_json
    )
    SELECT ?, id, ?, ?, ?
    FROM share_links
    WHERE id = ? AND snapshot_hash = ? AND moderation_status = 'approved'
      AND is_revoked = 0
      AND (expires_at IS NULL OR expires_at > strftime('%s', 'now'))
  `).bind(idempotencyKey, user.userId, targetStack.id, JSON.stringify(resultPayload), loaded.row.id, loaded.row.snapshot_hash))
  if (!categoryId) {
    [categoryId] = await reserveIds(c.env.DB, 'stack_categories', 1)
    statements.push(c.env.DB.prepare(`
      INSERT INTO stack_categories (
        id, stack_id, name, name_normalized, sort_order, is_default, created_at, updated_at
      )
      SELECT ?, ?, 'Unkategorisiert', 'unkategorisiert', 0, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
      WHERE EXISTS (SELECT 1 FROM share_import_operations WHERE idempotency_key = ?)
    `).bind(categoryId, targetStack.id, idempotencyKey))
  }
  const sortRow = await c.env.DB.prepare('SELECT COALESCE(MAX(sort_order), -1) + 1 AS next_sort FROM stack_items WHERE stack_id = ?')
    .bind(targetStack.id).first<{ next_sort: number }>()
  statements.push(c.env.DB.prepare(`
    INSERT INTO stack_items (
      id, stack_id, catalog_product_id, user_product_id, quantity,
      intake_interval_days, dosage_text, timing, sort_order, category_id,
      source_share_link_id, creator_statement_snapshot, amount_source, version
    )
    SELECT ?, ?, ?, NULL, ?, ?, ?, ?, ?, ?, ?, ?, 'creator_snapshot', 1
    WHERE EXISTS (SELECT 1 FROM share_import_operations WHERE idempotency_key = ?)
  `).bind(
    newItemId,
    targetStack.id,
    item.catalog_product_id,
    item.quantity,
    item.intake_interval_days,
    item.dosage_text,
    item.timing,
    sortRow?.next_sort ?? 0,
    categoryId,
    loaded.row.id,
    item.creator_statement,
    idempotencyKey,
  ))
  statements.push(...snapshotItemBindingStatements(c.env.DB, newItemId, item, idempotencyKey))
  statements.push(c.env.DB.prepare(`
    UPDATE share_links SET imports = imports + 1
    WHERE id = ? AND snapshot_hash = ? AND moderation_status = 'approved' AND is_revoked = 0
      AND EXISTS (SELECT 1 FROM share_import_operations WHERE idempotency_key = ?)
  `).bind(loaded.row.id, loaded.row.snapshot_hash, idempotencyKey))
  try {
    const batch = await c.env.DB.batch(statements)
    if (d1Changes(batch[0]) !== 1) return c.json({ error: 'Share wurde zwischenzeitlich geändert.' }, 409)
  } catch (error) {
    const replay = await c.env.DB.prepare(`
      SELECT result_json FROM share_import_operations
      WHERE idempotency_key = ? AND user_id = ? AND share_link_id = ?
    `).bind(idempotencyKey, user.userId, loaded.row.id).first<{ result_json: string | null }>()
    if (replay?.result_json) return c.json({ ...JSON.parse(replay.result_json) as Record<string, unknown>, idempotent_replay: true })
    throw error
  }
  return c.json(resultPayload, 201)
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
    UPDATE stacks SET last_opened_at = CURRENT_TIMESTAMP WHERE id = ? AND user_id = ?
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
    c.env.DB.prepare(`SELECT COUNT(*) AS count FROM stacks WHERE origin_party_id = ?`).bind(partyId).first<{ count: number }>(),
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
      WHERE creator_party_id = ? AND moderation_status = 'approved' AND is_revoked = 0
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
    WHERE s.id = ? AND s.user_id = ?
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
