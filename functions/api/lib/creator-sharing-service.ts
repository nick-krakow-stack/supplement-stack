import {
  buildAffiliateUrl,
  dateWindowAllows,
  hostMatchesDomain,
  parseCreatorShareSnapshot,
  type CreatorLinkBindingSnapshot,
  type CreatorShareSnapshot,
  type CreatorShareSnapshotItem,
  validateProductTargetUrl,
} from './creator-sharing'

export type PartyAccessRole = 'owner' | 'editor' | 'viewer'

export type PartyRow = {
  id: number
  type: 'platform' | 'creator' | 'brand' | 'user'
  name: string
  slug: string
  status: 'active' | 'blocked'
  auto_catalog_approval: number
  version: number
}

export type ProductShopTargetRow = {
  id: number
  product_id: number
  shop_domain_id: number | null
  url: string
  normalized_host: string | null
  link_kind: 'base_target' | 'legacy_resolved' | null
  legacy_party_id: number | null
  active: number
  blocked_at: string | null
  shop_domain: string | null
}

export type AffiliateVersionRow = {
  id: number
  party_id: number
  shop_domain_id: number
  version: number
  code: string
  link_template: string
  tracking_domain: string | null
  status: 'current' | 'retired' | 'blocked'
  valid_from: string | null
  valid_until: string | null
  party_status?: 'active' | 'blocked'
}

export type SnapshotRelationProduct = {
  id: number
  name: string
  brand: string | null
  moderation_status: string
  visibility: string
  owner_party_id: number | null
  owner_status: string | null
  owner_auto_catalog_approval: number | null
}

export type ValidatedSnapshotRelations = {
  products: Map<number, SnapshotRelationProduct>
  targets: Map<number, ProductShopTargetRow>
  versions: Map<number, AffiliateVersionRow>
  mainIngredientIds: Map<number, number[]>
}

export type OutboundResolution = {
  url: string
  product_id: number
  shop_link_id: number
  resolved_party_id: number | null
  creator_context_party_id: number | null
  affiliate_version_id: number | null
  source_share_link_id: number | null
  is_affiliate: number
  resolution_kind: CreatorLinkBindingSnapshot['resolution_kind']
}

function placeholders(values: readonly unknown[]): string {
  return values.map(() => '?').join(',')
}

export async function globalProductVisibilitySql(db: D1Database, alias = 'p'): Promise<string> {
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(alias)) throw new Error('Invalid SQL alias')
  const view = await db.prepare(`
    SELECT 1 AS available
    FROM sqlite_master
    WHERE type = 'view' AND name = 'globally_visible_products'
  `).first<{ available: number }>()
  return view
    ? `${alias}.id IN (SELECT product_id FROM globally_visible_products)`
    : `${alias}.visibility = 'public' AND ${alias}.moderation_status = 'approved'`
}

export async function getPlatformParty(db: D1Database): Promise<PartyRow | null> {
  return db.prepare(`
    SELECT id, type, name, slug, status, auto_catalog_approval, version
    FROM parties
    WHERE slug = 'platform'
    LIMIT 1
  `).first<PartyRow>()
}

export async function getParty(db: D1Database, partyId: number): Promise<PartyRow | null> {
  return db.prepare(`
    SELECT id, type, name, slug, status, auto_catalog_approval, version
    FROM parties
    WHERE id = ?
  `).bind(partyId).first<PartyRow>()
}

export async function ensureUserParty(db: D1Database, userId: number): Promise<PartyRow> {
  const slug = `user-${userId}`
  let party = await db.prepare(`SELECT id, type, name, slug, status, auto_catalog_approval, version FROM parties WHERE slug = ?`)
    .bind(slug).first<PartyRow>()
  if (!party) {
    await db.batch([
      db.prepare(`
        INSERT OR IGNORE INTO parties (type, name, slug, status, auto_catalog_approval, version)
        VALUES ('user', ?, ?, 'active', 0, 1)
      `).bind(`Nutzer ${userId}`, slug),
      db.prepare(`
        INSERT OR IGNORE INTO party_memberships (party_id, user_id, role, status)
        SELECT id, ?, 'owner', 'active' FROM parties WHERE slug = ?
      `).bind(userId, slug),
    ])
    party = await db.prepare(`SELECT id, type, name, slug, status, auto_catalog_approval, version FROM parties WHERE slug = ?`)
      .bind(slug).first<PartyRow>()
  } else {
    await db.prepare(`
      INSERT OR IGNORE INTO party_memberships (party_id, user_id, role, status)
      VALUES (?, ?, 'owner', 'active')
    `).bind(party.id, userId).run()
  }
  if (!party) throw new Error('Could not create user party')
  return party
}

export async function hasPartyAccess(
  db: D1Database,
  userId: number,
  partyId: number,
  roles: readonly PartyAccessRole[],
): Promise<boolean> {
  if (roles.length === 0) return false
  const row = await db.prepare(`
    SELECT 1 AS allowed
    FROM party_memberships
    WHERE user_id = ?
      AND party_id = ?
      AND status = 'active'
      AND role IN (${placeholders(roles)})
    LIMIT 1
  `).bind(userId, partyId, ...roles).first<{ allowed: number }>()
  return row?.allowed === 1
}

export async function getProductShopTarget(
  db: D1Database,
  productId: number,
  shopLinkId?: number | null,
): Promise<ProductShopTargetRow | null> {
  return db.prepare(`
    SELECT
      psl.id,
      psl.product_id,
      psl.shop_domain_id,
      psl.url,
      psl.normalized_host,
      psl.link_kind,
      psl.legacy_party_id,
      psl.active,
      psl.blocked_at,
      sd.domain AS shop_domain
    FROM product_shop_links psl
    LEFT JOIN shop_domains sd ON sd.id = psl.shop_domain_id
    WHERE psl.product_id = ?
      AND (? IS NULL OR psl.id = ?)
      AND psl.active = 1
      AND psl.blocked_at IS NULL
      AND psl.link_kind IS NOT NULL
    ORDER BY
      CASE WHEN ? IS NOT NULL AND psl.id = ? THEN 0 ELSE 1 END,
      psl.active DESC,
      psl.is_primary DESC,
      CASE WHEN psl.link_kind = 'base_target' THEN 0 ELSE 1 END,
      psl.sort_order ASC,
      psl.id ASC
    LIMIT 1
  `).bind(productId, shopLinkId ?? null, shopLinkId ?? null, shopLinkId ?? null, shopLinkId ?? null)
    .first<ProductShopTargetRow>()
}

export async function getCurrentAffiliateVersion(
  db: D1Database,
  partyId: number,
  shopDomainId: number,
): Promise<AffiliateVersionRow | null> {
  const row = await db.prepare(`
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
    WHERE av.party_id = ?
      AND av.shop_domain_id = ?
      AND av.status = 'current'
      AND party.status = 'active'
    LIMIT 1
  `).bind(partyId, shopDomainId).first<AffiliateVersionRow>()
  return row && dateWindowAllows(row.valid_from, row.valid_until) ? row : null
}

export async function resolveBindingForNewItem(
  db: D1Database,
  target: ProductShopTargetRow,
  contextPartyId: number | null,
): Promise<CreatorLinkBindingSnapshot | null> {
  if (target.active !== 1 || !target.shop_domain_id || !target.shop_domain || target.blocked_at || !target.link_kind) return null
  const safeTarget = validateProductTargetUrl(target.url, target.shop_domain)
  if (!safeTarget.url) return null

  if (target.link_kind === 'legacy_resolved') {
    return target.legacy_party_id
      ? { resolution_kind: 'legacy_resolved', affiliate_version_id: null, resolved_party_id: target.legacy_party_id }
      : null
  }

  if (contextPartyId) {
    const creatorVersion = await getCurrentAffiliateVersion(db, contextPartyId, target.shop_domain_id)
    if (creatorVersion) {
      return {
        resolution_kind: 'creator_version',
        affiliate_version_id: creatorVersion.id,
        resolved_party_id: creatorVersion.party_id,
      }
    }
  }

  const platform = await getPlatformParty(db)
  if (platform) {
    const platformVersion = await getCurrentAffiliateVersion(db, platform.id, target.shop_domain_id)
    if (platformVersion) {
      return {
        resolution_kind: 'platform_version',
        affiliate_version_id: platformVersion.id,
        resolved_party_id: platform.id,
      }
    }
  }
  return { resolution_kind: 'bare', affiliate_version_id: null, resolved_party_id: null }
}

export async function loadMainIngredientIds(
  db: D1Database,
  productIds: number[],
): Promise<Map<number, number[]>> {
  const uniqueIds = [...new Set(productIds)]
  const result = new Map<number, number[]>()
  if (uniqueIds.length === 0) return result
  const { results } = await db.prepare(`
    SELECT product_id, ingredient_id
    FROM product_ingredients
    WHERE product_id IN (${placeholders(uniqueIds)})
      AND is_main = 1
    ORDER BY product_id ASC, ingredient_id ASC
  `).bind(...uniqueIds).all<{ product_id: number; ingredient_id: number }>()
  for (const row of results ?? []) {
    const ids = result.get(row.product_id) ?? []
    if (!ids.includes(row.ingredient_id)) ids.push(row.ingredient_id)
    result.set(row.product_id, ids)
  }
  return result
}

export function sameIntegerSet(left: readonly number[], right: readonly number[]): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index])
}

export async function validateSnapshotRelations(
  db: D1Database,
  snapshot: CreatorShareSnapshot,
): Promise<{ value?: ValidatedSnapshotRelations; error?: string }> {
  const productIds = [...new Set(snapshot.items.map((item) => item.catalog_product_id))]
  const targetIds = [...new Set(snapshot.items.map((item) => item.shop_link_id))]
  const versionIds = [...new Set(snapshot.items
    .map((item) => item.link_binding.affiliate_version_id)
    .filter((id): id is number => id !== null))]

  const [productResult, targetResult, versionResult, mainIngredientIds] = await Promise.all([
    db.prepare(`
      SELECT
        p.id,
        p.name,
        p.brand,
        p.moderation_status,
        p.visibility,
        p.owner_party_id,
        owner.status AS owner_status,
        owner.auto_catalog_approval AS owner_auto_catalog_approval
      FROM products p
      LEFT JOIN parties owner ON owner.id = p.owner_party_id
      WHERE p.id IN (${placeholders(productIds)})
    `).bind(...productIds).all<SnapshotRelationProduct>(),
    db.prepare(`
      SELECT
        psl.id,
        psl.product_id,
        psl.shop_domain_id,
        psl.url,
        psl.normalized_host,
        psl.link_kind,
        psl.legacy_party_id,
        psl.active,
        psl.blocked_at,
        sd.domain AS shop_domain
      FROM product_shop_links psl
      LEFT JOIN shop_domains sd ON sd.id = psl.shop_domain_id
      WHERE psl.id IN (${placeholders(targetIds)})
    `).bind(...targetIds).all<ProductShopTargetRow>(),
    versionIds.length === 0
      ? Promise.resolve({ results: [] as AffiliateVersionRow[] })
      : db.prepare(`
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
          WHERE av.id IN (${placeholders(versionIds)})
        `).bind(...versionIds).all<AffiliateVersionRow>(),
    loadMainIngredientIds(db, productIds),
  ])

  const products = new Map((productResult.results ?? []).map((row) => [row.id, row]))
  const targets = new Map((targetResult.results ?? []).map((row) => [row.id, row]))
  const versions = new Map((versionResult.results ?? []).map((row) => [row.id, row]))
  const creatorParty = await getParty(db, snapshot.creator_party_id)
  if (!creatorParty || creatorParty.status !== 'active') return { error: 'Creator-Partei ist nicht aktiv.' }

  for (const item of snapshot.items) {
    const product = products.get(item.catalog_product_id)
    const target = targets.get(item.shop_link_id)
    const currentMainIds = mainIngredientIds.get(item.catalog_product_id) ?? []
    if (!product || product.moderation_status !== 'approved' || product.owner_status !== 'active') {
      return { error: 'Ein Snapshot-Produkt ist nicht mehr freigegeben.' }
    }
    const globallyVisible = product.visibility === 'public'
      || (product.visibility === 'auto' && product.owner_auto_catalog_approval === 1)
    const creatorVisible = product.owner_party_id === snapshot.creator_party_id && product.visibility !== 'hidden'
    if (!globallyVisible && !creatorVisible) {
      return { error: 'Ein Snapshot-Produkt ist außerhalb seines Creator-Kontexts nicht sichtbar.' }
    }
    if (!target || target.product_id !== product.id || target.active !== 1 || target.blocked_at || !target.shop_domain_id || !target.shop_domain) {
      return { error: 'Ein Snapshot-Produktziel ist nicht mehr sicher verfügbar.' }
    }
    if (!validateProductTargetUrl(target.url, target.shop_domain).url) {
      return { error: 'Ein Snapshot-Produktziel verletzt die Shop-Domain.' }
    }
    if (!sameIntegerSet(currentMainIds, item.main_ingredient_ids)) {
      return { error: 'Das Hauptwirkstoff-Set eines Snapshot-Produkts hat sich geändert.' }
    }
    const binding = item.link_binding
    if (binding.resolution_kind === 'legacy_resolved') {
      if (target.link_kind !== 'legacy_resolved' || target.legacy_party_id !== binding.resolved_party_id) {
        return { error: 'Legacy-Attribution passt nicht zum Produktziel.' }
      }
    } else if (binding.resolution_kind === 'bare') {
      if (target.link_kind !== 'base_target') return { error: 'Nacktes Ziel ist kein sicheres Basisziel.' }
    } else {
      const version = binding.affiliate_version_id ? versions.get(binding.affiliate_version_id) : null
      if (!version || version.party_id !== binding.resolved_party_id || version.shop_domain_id !== target.shop_domain_id) {
        return { error: 'Affiliate-Snapshot passt nicht zur Partei oder Shop-Domain.' }
      }
      if (version.status === 'blocked' || version.party_status === 'blocked') {
        // Import remains possible; outbound resolution will use the documented safety fallback.
        continue
      }
    }
  }

  return { value: { products, targets, versions, mainIngredientIds } }
}

export function parseStoredSnapshot(snapshotJson: string): { value?: CreatorShareSnapshot; error?: string } {
  try {
    return parseCreatorShareSnapshot(JSON.parse(snapshotJson) as unknown)
  } catch {
    return { error: 'Share-Snapshot ist kein gültiges JSON.' }
  }
}

function affiliateVersionUsableForExistingBinding(version: AffiliateVersionRow | undefined): boolean {
  return Boolean(
    version
    && version.status !== 'blocked'
    && version.party_status !== 'blocked'
    && dateWindowAllows(version.valid_from, version.valid_until),
  )
}

async function currentPlatformFallback(
  db: D1Database,
  target: ProductShopTargetRow,
): Promise<{ url: string; version: AffiliateVersionRow; partyId: number } | null> {
  if (!target.shop_domain_id || !target.shop_domain || target.link_kind !== 'base_target') return null
  const platform = await getPlatformParty(db)
  if (!platform || platform.status !== 'active') return null
  const version = await getCurrentAffiliateVersion(db, platform.id, target.shop_domain_id)
  if (!version) return null
  const built = buildAffiliateUrl({
    code: version.code,
    linkTemplate: version.link_template,
    productUrl: target.url,
    shopDomain: target.shop_domain,
    trackingDomain: version.tracking_domain,
  })
  return built.url ? { url: built.url, version, partyId: platform.id } : null
}

export async function resolveBoundOutbound(
  db: D1Database,
  params: {
    stackItemId: number
    expectedUserId: number
  },
): Promise<{ value?: OutboundResolution; error?: string; status?: number }> {
  const row = await db.prepare(`
    SELECT
      si.id AS stack_item_id,
      si.catalog_product_id AS product_id,
      si.source_share_link_id,
      COALESCE(s.origin_party_id, source_share.creator_party_id) AS creator_context_party_id,
      binding.shop_link_id,
      binding.resolution_kind,
      binding.affiliate_version_id,
      binding.resolved_party_id,
      psl.url,
      psl.shop_domain_id,
      psl.link_kind,
      psl.legacy_party_id,
      psl.active,
      psl.blocked_at,
      sd.domain AS shop_domain,
      av.code,
      av.link_template,
      av.tracking_domain,
      av.status AS affiliate_status,
      av.valid_from,
      av.valid_until,
      earning_party.status AS earning_party_status
    FROM stack_items si
    JOIN stacks s ON s.id = si.stack_id
    LEFT JOIN share_links source_share ON source_share.id = si.source_share_link_id
    JOIN stack_item_link_bindings binding ON binding.stack_item_id = si.id
    JOIN product_shop_links psl ON psl.id = binding.shop_link_id
    LEFT JOIN shop_domains sd ON sd.id = psl.shop_domain_id
    LEFT JOIN party_shop_affiliate_versions av ON av.id = binding.affiliate_version_id
    LEFT JOIN parties earning_party ON earning_party.id = binding.resolved_party_id
    WHERE si.id = ?
      AND s.user_id = ?
      AND si.catalog_product_id IS NOT NULL
      AND psl.product_id = si.catalog_product_id
    LIMIT 1
  `).bind(params.stackItemId, params.expectedUserId).first<{
    stack_item_id: number
    product_id: number
    source_share_link_id: number | null
    creator_context_party_id: number | null
    shop_link_id: number
    resolution_kind: CreatorLinkBindingSnapshot['resolution_kind']
    affiliate_version_id: number | null
    resolved_party_id: number | null
    url: string
    shop_domain_id: number | null
    link_kind: 'base_target' | 'legacy_resolved' | null
    legacy_party_id: number | null
    active: number
    blocked_at: string | null
    shop_domain: string | null
    code: string | null
    link_template: string | null
    tracking_domain: string | null
    affiliate_status: 'current' | 'retired' | 'blocked' | null
    valid_from: string | null
    valid_until: string | null
    earning_party_status: 'active' | 'blocked' | null
  }>()
  if (!row) return { error: 'Stack-Position oder Linkbindung nicht gefunden.', status: 404 }
  if (row.active !== 1 || row.blocked_at || !row.shop_domain_id || !row.shop_domain || !row.link_kind) {
    return { error: 'Produktziel ist blockiert.', status: 409 }
  }
  const safeTarget = validateProductTargetUrl(row.url, row.shop_domain)
  if (!safeTarget.url) return { error: safeTarget.error ?? 'Produktziel ist unsicher.', status: 409 }

  const target: ProductShopTargetRow = {
    id: row.shop_link_id,
    product_id: row.product_id,
    shop_domain_id: row.shop_domain_id,
    url: safeTarget.url,
    normalized_host: null,
    link_kind: row.link_kind,
    legacy_party_id: row.legacy_party_id,
    active: row.active,
    blocked_at: row.blocked_at,
    shop_domain: row.shop_domain,
  }

  if (row.resolution_kind === 'bare') {
    return { value: {
      url: safeTarget.url,
      product_id: row.product_id,
      shop_link_id: row.shop_link_id,
      resolved_party_id: null,
      creator_context_party_id: row.creator_context_party_id,
      affiliate_version_id: null,
      source_share_link_id: row.source_share_link_id,
      is_affiliate: 0,
      resolution_kind: 'bare',
    } }
  }

  if (row.resolution_kind === 'legacy_resolved' && row.earning_party_status === 'active') {
    return { value: {
      url: safeTarget.url,
      product_id: row.product_id,
      shop_link_id: row.shop_link_id,
      resolved_party_id: row.resolved_party_id,
      creator_context_party_id: row.creator_context_party_id,
      affiliate_version_id: null,
      source_share_link_id: row.source_share_link_id,
      is_affiliate: 1,
      resolution_kind: 'legacy_resolved',
    } }
  }

  const version: AffiliateVersionRow | undefined = row.affiliate_version_id && row.code && row.link_template && row.affiliate_status
    ? {
        id: row.affiliate_version_id,
        party_id: row.resolved_party_id ?? 0,
        shop_domain_id: row.shop_domain_id,
        version: 0,
        code: row.code,
        link_template: row.link_template,
        tracking_domain: row.tracking_domain,
        status: row.affiliate_status,
        valid_from: row.valid_from,
        valid_until: row.valid_until,
        party_status: row.earning_party_status ?? 'blocked',
      }
    : undefined
  if (affiliateVersionUsableForExistingBinding(version) && version) {
    const built = buildAffiliateUrl({
      code: version.code,
      linkTemplate: version.link_template,
      productUrl: safeTarget.url,
      shopDomain: row.shop_domain,
      trackingDomain: version.tracking_domain,
    })
    if (built.url) {
      return { value: {
        url: built.url,
        product_id: row.product_id,
        shop_link_id: row.shop_link_id,
        resolved_party_id: row.resolved_party_id,
        creator_context_party_id: row.creator_context_party_id,
        affiliate_version_id: row.affiliate_version_id,
        source_share_link_id: row.source_share_link_id,
        is_affiliate: 1,
        resolution_kind: row.resolution_kind,
      } }
    }
  }

  const fallback = await currentPlatformFallback(db, target)
  if (fallback) {
    return { value: {
      url: fallback.url,
      product_id: row.product_id,
      shop_link_id: row.shop_link_id,
      resolved_party_id: fallback.partyId,
      creator_context_party_id: row.creator_context_party_id,
      affiliate_version_id: fallback.version.id,
      source_share_link_id: row.source_share_link_id,
      is_affiliate: 1,
      resolution_kind: 'platform_version',
    } }
  }
  return { value: {
    url: safeTarget.url,
    product_id: row.product_id,
    shop_link_id: row.shop_link_id,
    resolved_party_id: null,
    creator_context_party_id: row.creator_context_party_id,
    affiliate_version_id: null,
    source_share_link_id: row.source_share_link_id,
    is_affiliate: 0,
    resolution_kind: 'bare',
  } }
}

export async function resolvePublicProductOutbound(
  db: D1Database,
  productId: number,
  requestedShopLinkId: number | null,
): Promise<{ value?: OutboundResolution; error?: string }> {
  const visibility = await globalProductVisibilitySql(db, 'p')
  const visible = await db.prepare(`SELECT 1 AS visible FROM products p WHERE p.id = ? AND ${visibility}`)
    .bind(productId).first<{ visible: number }>()
  if (!visible) return { error: 'Product link not found' }
  const target = await getProductShopTarget(db, productId, requestedShopLinkId)
  if (!target || !target.shop_domain_id || !target.shop_domain) return { error: 'Product link not found' }
  const safe = validateProductTargetUrl(target.url, target.shop_domain)
  if (!safe.url) return { error: safe.error ?? 'Product link not found' }
  if (target.link_kind === 'legacy_resolved') {
    const party = target.legacy_party_id ? await getParty(db, target.legacy_party_id) : null
    if (party?.status === 'active') {
      return { value: {
        url: safe.url,
        product_id: productId,
        shop_link_id: target.id,
        resolved_party_id: party.id,
        creator_context_party_id: null,
        affiliate_version_id: null,
        source_share_link_id: null,
        is_affiliate: 1,
        resolution_kind: 'legacy_resolved',
      } }
    }
  }
  const platformFallback = await currentPlatformFallback(db, target)
  if (platformFallback) {
    return { value: {
      url: platformFallback.url,
      product_id: productId,
      shop_link_id: target.id,
      resolved_party_id: platformFallback.partyId,
      creator_context_party_id: null,
      affiliate_version_id: platformFallback.version.id,
      source_share_link_id: null,
      is_affiliate: 1,
      resolution_kind: 'platform_version',
    } }
  }
  return { value: {
    url: safe.url,
    product_id: productId,
    shop_link_id: target.id,
    resolved_party_id: null,
    creator_context_party_id: null,
    affiliate_version_id: null,
    source_share_link_id: null,
    is_affiliate: 0,
    resolution_kind: 'bare',
  } }
}

export function snapshotItemBindingStatements(
  db: D1Database,
  stackItemId: number,
  item: CreatorShareSnapshotItem,
  guardImportKey?: string,
): D1PreparedStatement[] {
  const guardSql = guardImportKey
    ? 'WHERE EXISTS (SELECT 1 FROM share_import_operations WHERE idempotency_key = ?)'
    : ''
  const bindings: Array<string | number | null> = [
    stackItemId,
    item.shop_link_id,
    item.link_binding.resolution_kind,
    item.link_binding.affiliate_version_id,
    item.link_binding.resolved_party_id,
  ]
  if (guardImportKey) bindings.push(guardImportKey)
  return [db.prepare(`
    INSERT INTO stack_item_link_bindings (
      stack_item_id,
      shop_link_id,
      resolution_kind,
      affiliate_version_id,
      resolved_party_id,
      bound_at
    )
    SELECT ?, ?, ?, ?, ?, CURRENT_TIMESTAMP
    ${guardSql}
  `).bind(...bindings)]
}

export async function reserveIds(
  db: D1Database,
  table: 'stacks' | 'stack_categories' | 'stack_items',
  count: number,
): Promise<number[]> {
  if (!Number.isInteger(count) || count < 0) throw new Error('Invalid id reservation count')
  if (count === 0) return []
  await db.prepare(`
    INSERT INTO sqlite_sequence (name, seq)
    SELECT ?, COALESCE(MAX(id), 0) FROM ${table}
    HAVING NOT EXISTS (SELECT 1 FROM sqlite_sequence WHERE name = ?)
  `).bind(table, table).run()
  const row = await db.prepare(`
    UPDATE sqlite_sequence
    SET seq = MAX(seq, (SELECT COALESCE(MAX(id), 0) FROM ${table})) + ?
    WHERE name = ?
    RETURNING seq - ? + 1 AS first_id
  `).bind(count, table, count).first<{ first_id: number }>()
  const first = Number(row?.first_id)
  if (!Number.isSafeInteger(first) || first <= 0) throw new Error(`Could not reserve ids for ${table}`)
  return Array.from({ length: count }, (_, index) => first + index)
}
