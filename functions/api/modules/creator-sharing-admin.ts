import { Hono } from 'hono'
import type { AppContext } from '../lib/types'
import { ensureAdmin, logAdminAction } from '../lib/helpers'
import { normalizeDomain, snapshotHash, validateAffiliateTemplate } from '../lib/creator-sharing'
import { getPlatformParty, parseStoredSnapshot, publicProfileImageUrl } from '../lib/creator-sharing-service'
import { deliverCreatorShareNotification } from '../lib/creator-share-notifications'

const creatorSharingAdmin = new Hono<AppContext>()

function positiveInteger(value: unknown): number | null {
  const parsed = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : Number.NaN
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null
}

function nonNegativeInteger(value: unknown): number | null {
  const parsed = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : Number.NaN
  return Number.isSafeInteger(parsed) && parsed >= 0 ? parsed : null
}

function boundedText(value: unknown, maximum: number): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed && trimmed.length <= maximum ? trimmed : null
}

function d1Changes(result: D1Result<unknown>): number {
  return Number((result.meta as { changes?: number } | undefined)?.changes ?? 0)
}

function trackingDomain(value: unknown): string | null | undefined {
  if (value === undefined || value === null || value === '') return null
  if (typeof value !== 'string') return undefined
  const normalized = normalizeDomain(value)
  return /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/i.test(normalized)
    ? normalized
    : undefined
}

function hasOwnKey(value: object, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(value, key)
}

function optionalIsoTimestamp(value: unknown): string | null | undefined {
  if (value === undefined || value === null || value === '') return null
  if (typeof value !== 'string' || value.length > 40 || !Number.isFinite(Date.parse(value))) return undefined
  return new Date(value).toISOString()
}

creatorSharingAdmin.use('*', async (c, next) => {
  const authErr = await ensureAdmin(c)
  if (authErr) return authErr
  return next()
})

creatorSharingAdmin.get('/parties', async (c) => {
  const { results } = await c.env.DB.prepare(`
    SELECT
      party.*,
      COUNT(DISTINCT membership.user_id) AS members_count,
      COUNT(DISTINCT product.id) AS products_count,
      COUNT(DISTINCT share_link.id) AS shares_count
    FROM parties party
    LEFT JOIN party_memberships membership
      ON membership.party_id = party.id AND membership.status = 'active'
    LEFT JOIN products product ON product.owner_party_id = party.id
    LEFT JOIN share_links share_link ON share_link.creator_party_id = party.id
    GROUP BY party.id
    ORDER BY CASE party.type WHEN 'platform' THEN 0 WHEN 'creator' THEN 1 ELSE 2 END,
      party.name COLLATE NOCASE, party.id
  `).all()
  return c.json({ parties: results })
})

creatorSharingAdmin.post('/parties', async (c) => {
  let body: Record<string, unknown>
  try { body = await c.req.json() } catch { return c.json({ error: 'Invalid JSON' }, 400) }
  const type = ['creator', 'brand', 'user'].includes(String(body.type)) ? String(body.type) : null
  const name = boundedText(body.name, 160)
  const slug = boundedText(body.slug, 120)?.toLowerCase()
  const ownerUserId = body.owner_user_id === undefined || body.owner_user_id === null
    ? null
    : positiveInteger(body.owner_user_id)
  const profileImage = publicProfileImageUrl(body.public_profile_image_url)
  if (!type || !name || !slug || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)
    || (body.owner_user_id != null && !ownerUserId) || !profileImage.ok) {
    return c.json({ error: 'Typ, Name und gültiger Kurzname sind erforderlich. Das optionale Profilbild braucht eine sichere HTTPS- oder R2-Adresse.' }, 400)
  }
  if (ownerUserId) {
    const owner = await c.env.DB.prepare('SELECT id FROM users WHERE id = ?').bind(ownerUserId).first<{ id: number }>()
    if (!owner) return c.json({ error: 'Owner user not found' }, 404)
  }
  const statements: D1PreparedStatement[] = [c.env.DB.prepare(`
    INSERT INTO parties (
      type, name, slug, status, auto_catalog_approval,
      public_profile_image_url, version
    )
    VALUES (?, ?, ?, 'active', ?, ?, 1)
  `).bind(type, name, slug, body.auto_catalog_approval === true ? 1 : 0, profileImage.value)]
  if (ownerUserId) {
    statements.push(c.env.DB.prepare(`
      INSERT INTO party_memberships (party_id, user_id, role, status)
      SELECT id, ?, 'owner', 'active' FROM parties WHERE slug = ?
    `).bind(ownerUserId, slug))
  }
  await c.env.DB.batch(statements)
  const party = await c.env.DB.prepare('SELECT * FROM parties WHERE slug = ?').bind(slug).first()
  await logAdminAction(c, { action: 'create_creator_party', entity_type: 'party', entity_id: Number((party as { id?: number } | null)?.id ?? 0), changes: { type, name, slug, owner_user_id: ownerUserId, public_profile_image_url: profileImage.value } })
  return c.json({ party }, 201)
})

creatorSharingAdmin.patch('/parties/:id', async (c) => {
  const partyId = positiveInteger(c.req.param('id'))
  if (!partyId) return c.json({ error: 'Invalid party id' }, 400)
  let body: Record<string, unknown>
  try { body = await c.req.json() } catch { return c.json({ error: 'Invalid JSON' }, 400) }
  const expectedVersion = positiveInteger(body.expected_version)
  if (!expectedVersion) return c.json({ error: 'expected_version is required' }, 400)
  const current = await c.env.DB.prepare('SELECT * FROM parties WHERE id = ?').bind(partyId).first<{
    id: number; type: string; name: string; status: string; auto_catalog_approval: number;
    public_profile_image_url: string | null; version: number
  }>()
  if (!current) return c.json({ error: 'Party not found' }, 404)
  const name = body.name === undefined ? current.name : boundedText(body.name, 160)
  const status = body.status === undefined ? current.status : ['active', 'blocked'].includes(String(body.status)) ? String(body.status) : null
  const autoApproval = body.auto_catalog_approval === undefined
    ? current.auto_catalog_approval
    : body.auto_catalog_approval === true || body.auto_catalog_approval === 1 ? 1 : body.auto_catalog_approval === false || body.auto_catalog_approval === 0 ? 0 : null
  const profileImage = body.public_profile_image_url === undefined
    ? { ok: true as const, value: current.public_profile_image_url }
    : publicProfileImageUrl(body.public_profile_image_url)
  if (!name || !status || autoApproval === null || !profileImage.ok) {
    return c.json({ error: 'Die Änderung ist ungültig. Das optionale Profilbild braucht eine sichere HTTPS- oder R2-Adresse.' }, 400)
  }
  if (current.type === 'platform' && status === 'blocked') return c.json({ error: 'Platform party cannot be blocked.' }, 409)
  const result = await c.env.DB.prepare(`
    UPDATE parties
    SET name = ?, status = ?, auto_catalog_approval = ?, public_profile_image_url = ?,
      version = version + 1, updated_at = CURRENT_TIMESTAMP
    WHERE id = ? AND version = ?
  `).bind(name, status, autoApproval, profileImage.value, partyId, expectedVersion).run()
  if (d1Changes(result) !== 1) return c.json({ error: 'Version conflict', current_version: current.version }, 409)
  const party = await c.env.DB.prepare('SELECT * FROM parties WHERE id = ?').bind(partyId).first()
  await logAdminAction(c, { action: 'update_creator_party', entity_type: 'party', entity_id: partyId, changes: { before: current, after: party } })
  return c.json({ party })
})

creatorSharingAdmin.get('/parties/:id/settings', async (c) => {
  const partyId = positiveInteger(c.req.param('id'))
  if (!partyId) return c.json({ error: 'Invalid party id' }, 400)
  const [party, affiliateVersions, defaultShop, picks] = await Promise.all([
    c.env.DB.prepare('SELECT * FROM parties WHERE id = ?').bind(partyId).first(),
    c.env.DB.prepare(`
      SELECT av.*, sd.display_name AS shop_name, sd.domain AS shop_domain
      FROM party_shop_affiliate_versions av
      JOIN shop_domains sd ON sd.id = av.shop_domain_id
      WHERE av.party_id = ? ORDER BY sd.display_name, av.version DESC
    `).bind(partyId).all(),
    c.env.DB.prepare(`
      SELECT ds.*, sd.display_name AS shop_name, sd.domain AS shop_domain
      FROM party_default_shops ds JOIN shop_domains sd ON sd.id = ds.shop_domain_id
      WHERE ds.party_id = ?
    `).bind(partyId).first(),
    c.env.DB.prepare(`
      SELECT pick.*, ingredient.name AS ingredient_name, product.name AS product_name
      FROM party_product_picks pick
      JOIN ingredients ingredient ON ingredient.id = pick.ingredient_id
      JOIN products product ON product.id = pick.product_id
      WHERE pick.party_id = ? ORDER BY ingredient.name
    `).bind(partyId).all(),
  ])
  if (!party) return c.json({ error: 'Party not found' }, 404)
  return c.json({ party, affiliate_versions: affiliateVersions.results, default_shop: defaultShop, product_picks: picks.results })
})

creatorSharingAdmin.post('/parties/:id/affiliate-versions', async (c) => {
  const partyId = positiveInteger(c.req.param('id'))
  if (!partyId) return c.json({ error: 'Invalid party id' }, 400)
  let body: Record<string, unknown>
  try { body = await c.req.json() } catch { return c.json({ error: 'Invalid JSON' }, 400) }
  const shopDomainId = positiveInteger(body.shop_domain_id)
  const code = boundedText(body.code, 300)
  const linkTemplate = boundedText(body.link_template, 1200)
  const domain = trackingDomain(body.tracking_domain)
  const validFrom = optionalIsoTimestamp(body.valid_from)
  const validUntil = optionalIsoTimestamp(body.valid_until)
  if (!shopDomainId || !code || !linkTemplate || domain === undefined || validFrom === undefined || validUntil === undefined) {
    return c.json({ error: 'Invalid affiliate version' }, 400)
  }
  if (validFrom && validUntil && Date.parse(validFrom) > Date.parse(validUntil)) {
    return c.json({ error: 'valid_from must not be after valid_until' }, 400)
  }
  const templateError = validateAffiliateTemplate(linkTemplate, domain)
  if (templateError) return c.json({ error: templateError }, 400)
  const [party, shop, current, maxVersion] = await Promise.all([
    c.env.DB.prepare('SELECT id, status FROM parties WHERE id = ?').bind(partyId).first<{ id: number; status: string }>(),
    c.env.DB.prepare('SELECT id FROM shop_domains WHERE id = ?').bind(shopDomainId).first<{ id: number }>(),
    c.env.DB.prepare(`SELECT id FROM party_shop_affiliate_versions WHERE party_id = ? AND shop_domain_id = ? AND status = 'current'`)
      .bind(partyId, shopDomainId).first<{ id: number }>(),
    c.env.DB.prepare('SELECT COALESCE(MAX(version), 0) AS version FROM party_shop_affiliate_versions WHERE party_id = ? AND shop_domain_id = ?')
      .bind(partyId, shopDomainId).first<{ version: number }>(),
  ])
  if (!party || !shop) return c.json({ error: 'Party or shop not found' }, 404)
  if (!hasOwnKey(body, 'expected_current_id')) return c.json({ error: 'expected_current_id is required' }, 400)
  const expectedCurrentId = body.expected_current_id === null ? null : positiveInteger(body.expected_current_id)
  if (body.expected_current_id !== null && expectedCurrentId === null) return c.json({ error: 'Invalid expected_current_id' }, 400)
  if ((current?.id ?? null) !== expectedCurrentId) return c.json({ error: 'Current affiliate version conflict', current_id: current?.id ?? null }, 409)
  const statements: D1PreparedStatement[] = []
  if (current) {
    statements.push(c.env.DB.prepare(`
      UPDATE party_shop_affiliate_versions SET status = 'retired'
      WHERE id = ? AND party_id = ? AND shop_domain_id = ? AND status = 'current'
    `).bind(current.id, partyId, shopDomainId))
  }
  statements.push(c.env.DB.prepare(`
    INSERT INTO party_shop_affiliate_versions (
      party_id, shop_domain_id, version, code, link_template, tracking_domain,
      status, valid_from, valid_until
    ) VALUES (?, ?, ?, ?, ?, ?, 'current', ?, ?)
  `).bind(
    partyId, shopDomainId, (maxVersion?.version ?? 0) + 1, code, linkTemplate, domain,
    validFrom, validUntil,
  ))
  await c.env.DB.batch(statements)
  const created = await c.env.DB.prepare(`
    SELECT * FROM party_shop_affiliate_versions
    WHERE party_id = ? AND shop_domain_id = ? AND status = 'current'
  `).bind(partyId, shopDomainId).first()
  await logAdminAction(c, { action: 'create_affiliate_version', entity_type: 'party_shop_affiliate_version', entity_id: Number((created as { id?: number } | null)?.id ?? 0), changes: { party_id: partyId, shop_domain_id: shopDomainId, replaced_id: current?.id ?? null } })
  return c.json({ affiliate_version: created }, 201)
})

creatorSharingAdmin.put('/parties/:id/default-shop', async (c) => {
  const partyId = positiveInteger(c.req.param('id'))
  let body: Record<string, unknown>
  try { body = await c.req.json() } catch { return c.json({ error: 'Invalid JSON' }, 400) }
  const shopDomainId = positiveInteger(body.shop_domain_id)
  const existing = partyId ? await c.env.DB.prepare('SELECT * FROM party_default_shops WHERE party_id = ?').bind(partyId).first<{ shop_domain_id: number; version: number }>() : null
  if (!hasOwnKey(body, 'expected_version')) return c.json({ error: 'expected_version is required' }, 400)
  const expectedVersion = body.expected_version === null ? null : positiveInteger(body.expected_version)
  if (body.expected_version !== null && expectedVersion === null) return c.json({ error: 'Invalid expected_version' }, 400)
  if (!partyId || !shopDomainId || (existing?.version ?? null) !== expectedVersion) return c.json({ error: 'Invalid input or version conflict', current_version: existing?.version ?? null }, 409)
  const shop = await c.env.DB.prepare('SELECT id FROM shop_domains WHERE id = ?').bind(shopDomainId).first()
  if (!shop) return c.json({ error: 'Shop not found' }, 404)
  if (existing) {
    const result = await c.env.DB.prepare(`UPDATE party_default_shops SET shop_domain_id = ?, version = version + 1, updated_at = CURRENT_TIMESTAMP WHERE party_id = ? AND version = ?`)
      .bind(shopDomainId, partyId, expectedVersion).run()
    if (d1Changes(result) !== 1) return c.json({ error: 'Version conflict' }, 409)
  } else {
    await c.env.DB.prepare('INSERT INTO party_default_shops (party_id, shop_domain_id, version) VALUES (?, ?, 1)').bind(partyId, shopDomainId).run()
  }
  return c.json({ default_shop: await c.env.DB.prepare('SELECT * FROM party_default_shops WHERE party_id = ?').bind(partyId).first() })
})

creatorSharingAdmin.put('/parties/:id/product-picks/:ingredientId', async (c) => {
  const partyId = positiveInteger(c.req.param('id'))
  const ingredientId = positiveInteger(c.req.param('ingredientId'))
  let body: Record<string, unknown>
  try { body = await c.req.json() } catch { return c.json({ error: 'Invalid JSON' }, 400) }
  const productId = positiveInteger(body.product_id)
  const existing = partyId && ingredientId ? await c.env.DB.prepare(`SELECT product_id, version FROM party_product_picks WHERE party_id = ? AND ingredient_id = ?`).bind(partyId, ingredientId).first<{ product_id: number; version: number }>() : null
  if (!hasOwnKey(body, 'expected_version')) return c.json({ error: 'expected_version is required' }, 400)
  const expectedVersion = body.expected_version === null ? null : positiveInteger(body.expected_version)
  if (body.expected_version !== null && expectedVersion === null) return c.json({ error: 'Invalid expected_version' }, 400)
  if (!partyId || !ingredientId || !productId || (existing?.version ?? null) !== expectedVersion) return c.json({ error: 'Invalid input or version conflict', current_version: existing?.version ?? null }, 409)
  const product = await c.env.DB.prepare(`
    SELECT 1 AS allowed FROM products p
    JOIN product_ingredients pi ON pi.product_id = p.id AND pi.ingredient_id = ? AND pi.is_main = 1
    JOIN parties owner ON owner.id = p.owner_party_id AND owner.status = 'active'
    WHERE p.id = ? AND p.moderation_status = 'approved'
      AND (p.id IN (SELECT product_id FROM globally_visible_products) OR (p.owner_party_id = ? AND p.visibility <> 'hidden'))
  `).bind(ingredientId, productId, partyId).first()
  if (!product) return c.json({ error: 'Product is not context-visible for this ingredient' }, 409)
  if (existing) {
    const result = await c.env.DB.prepare(`UPDATE party_product_picks SET product_id = ?, version = version + 1, updated_at = CURRENT_TIMESTAMP WHERE party_id = ? AND ingredient_id = ? AND version = ?`)
      .bind(productId, partyId, ingredientId, expectedVersion).run()
    if (d1Changes(result) !== 1) return c.json({ error: 'Version conflict' }, 409)
  } else {
    await c.env.DB.prepare(`INSERT INTO party_product_picks (party_id, ingredient_id, product_id, version) VALUES (?, ?, ?, 1)`).bind(partyId, ingredientId, productId).run()
  }
  return c.json({ product_pick: await c.env.DB.prepare('SELECT * FROM party_product_picks WHERE party_id = ? AND ingredient_id = ?').bind(partyId, ingredientId).first() })
})

creatorSharingAdmin.get('/shares', async (c) => {
  const status = c.req.query('status')
  const filter = status && ['pending', 'approved', 'blocked'].includes(status) ? status : null
  const { results } = await c.env.DB.prepare(`
    SELECT share.id, share.token, share.entity_type, share.creator_party_id,
      share.snapshot_hash, share.snapshot_schema_version, share.moderation_status,
      share.moderation_reason, share.moderation_target, share.moderation_item_index,
      share.is_revoked, share.created_at, share.expires_at, share.paused_at,
      share.archived_at, share.supersedes_share_link_id, share.version,
      CAST(json_extract(share.snapshot_json, '$.title') AS TEXT) AS title,
      party.name AS creator_name,
      notification.status AS notification_status,
      notification.attempts AS notification_attempts
    FROM share_links share JOIN parties party ON party.id = share.creator_party_id
    LEFT JOIN creator_share_notification_events notification ON notification.id = (
      SELECT event.id
      FROM creator_share_notification_events event
      WHERE event.share_link_id = share.id AND event.share_version = share.version
      ORDER BY event.id DESC
      LIMIT 1
    )
    WHERE (? IS NULL OR share.moderation_status = ?)
    ORDER BY CASE share.moderation_status WHEN 'pending' THEN 0 ELSE 1 END, share.created_at DESC
    LIMIT 250
  `).bind(filter, filter).all()
  return c.json({ shares: results })
})

creatorSharingAdmin.patch('/shares/:id', async (c) => {
  const shareId = positiveInteger(c.req.param('id'))
  let body: Record<string, unknown>
  try { body = await c.req.json() } catch { return c.json({ error: 'Invalid JSON' }, 400) }
  if (hasOwnKey(body, 'is_revoked')) {
    return c.json({ error: 'Moderation darf eine Empfehlung nicht im Namen des Creators beenden.' }, 400)
  }
  const moderationStatus = body.moderation_status === 'approved' || body.moderation_status === 'blocked'
    ? body.moderation_status
    : null
  const expectedStatus = ['pending', 'approved', 'blocked'].includes(String(body.expected_moderation_status))
    ? String(body.expected_moderation_status) as 'pending' | 'approved' | 'blocked'
    : null
  const expectedVersion = positiveInteger(body.expected_version)
  const expectedHash = boundedText(body.expected_snapshot_hash, 64)
  const expectedIsRevoked = body.expected_is_revoked === 0 || body.expected_is_revoked === 1
    ? body.expected_is_revoked
    : null
  const expectedPausedAt = body.expected_paused_at === null ? null : positiveInteger(body.expected_paused_at)
  const expectedExpiresAt = body.expected_expires_at === null ? null : positiveInteger(body.expected_expires_at)
  const expectedArchivedAt = body.expected_archived_at === null ? null : positiveInteger(body.expected_archived_at)
  const reason = moderationStatus === 'blocked' ? boundedText(body.moderation_reason, 1000) : null
  const target = moderationStatus === 'blocked' && ['general', 'title', 'creator_statement', 'product'].includes(String(body.moderation_target))
    ? String(body.moderation_target) as 'general' | 'title' | 'creator_statement' | 'product'
    : null
  const itemIndex = moderationStatus === 'blocked' && (target === 'creator_statement' || target === 'product')
    ? nonNegativeInteger(body.moderation_item_index)
    : null
  if (
    !shareId
    || !moderationStatus
    || !expectedStatus
    || !expectedVersion
    || !expectedHash
    || !/^[a-f0-9]{64}$/.test(expectedHash)
    || expectedIsRevoked === null
    || !hasOwnKey(body, 'expected_paused_at')
    || (body.expected_paused_at !== null && expectedPausedAt === null)
    || !hasOwnKey(body, 'expected_expires_at')
    || (body.expected_expires_at !== null && expectedExpiresAt === null)
    || !hasOwnKey(body, 'expected_archived_at')
    || (body.expected_archived_at !== null && expectedArchivedAt === null)
    || (moderationStatus === 'blocked' && (!reason || !target))
    || (moderationStatus === 'blocked' && (target === 'creator_statement' || target === 'product') && itemIndex === null)
    || (moderationStatus === 'blocked' && (target === 'general' || target === 'title') && body.moderation_item_index !== null)
    || (moderationStatus === 'approved' && (
      (body.moderation_reason !== undefined && body.moderation_reason !== null)
      || (body.moderation_target !== undefined && body.moderation_target !== null)
      || (body.moderation_item_index !== undefined && body.moderation_item_index !== null)
    ))
  ) {
    return c.json({ error: 'Die aktuellen Angaben und eine verständliche Moderationsentscheidung sind erforderlich.' }, 400)
  }
  const current = await c.env.DB.prepare(`
    SELECT *
    FROM share_links
    WHERE id = ?
  `).bind(shareId).first<{
    id: number
    snapshot_json: string
    snapshot_hash: string | null
    creator_user_id: number | null
    moderation_status: 'pending' | 'approved' | 'blocked'
    moderation_reason: string | null
    moderation_target: 'general' | 'title' | 'creator_statement' | 'product' | null
    moderation_item_index: number | null
    is_revoked: number
    paused_at: number | null
    expires_at: number | null
    archived_at: number | null
    legacy_provenance_status: 'ambiguous' | null
    version: number
  }>()
  if (!current) return c.json({ error: 'Empfehlung wurde nicht gefunden.' }, 404)
  if (
    current.version !== expectedVersion
    || current.snapshot_hash !== expectedHash
    || current.moderation_status !== expectedStatus
    || current.is_revoked !== expectedIsRevoked
    || current.paused_at !== expectedPausedAt
    || current.expires_at !== expectedExpiresAt
    || current.archived_at !== expectedArchivedAt
  ) {
    return c.json({ error: 'Die Empfehlung hat sich geändert. Bitte lade sie neu.' }, 409)
  }
  if (current.legacy_provenance_status === 'ambiguous') {
    return c.json({ error: 'Diese ältere Empfehlung kann nicht sicher zugeordnet werden. Bitte erstelle eine Neuauflage.' }, 409)
  }
  if (current.is_revoked === 1) {
    return c.json({ error: 'Eine vom Creator beendete Empfehlung kann nicht mehr moderiert werden.' }, 409)
  }
  const parsed = parseStoredSnapshot(current.snapshot_json)
  if (!parsed.value || await snapshotHash(parsed.value) !== current.snapshot_hash) {
    return c.json({ error: 'Der gespeicherte Stand der Empfehlung konnte nicht sicher geprüft werden.' }, 409)
  }
  if (itemIndex !== null && itemIndex >= parsed.value.items.length) {
    return c.json({ error: 'Das ausgewählte Produkt ist in dieser Empfehlung nicht vorhanden.' }, 400)
  }
  if (
    current.moderation_status === moderationStatus
    && current.moderation_reason === reason
    && current.moderation_target === target
    && current.moderation_item_index === itemIndex
  ) {
    return c.json({ share: current, notification_status: null })
  }
  const user = c.get('user')
  const eventType = moderationStatus === 'approved' ? 'moderation_approved' : 'moderation_blocked'
  let moderationBatch: D1Result<unknown>[]
  try {
    moderationBatch = await c.env.DB.batch([
      c.env.DB.prepare(`
        UPDATE share_links
        SET moderation_status = ?, moderation_reason = ?, moderation_target = ?,
          moderation_item_index = ?, moderated_by_user_id = ?,
          moderated_at = CURRENT_TIMESTAMP, version = version + 1
        WHERE id = ?
          AND version = ?
          AND snapshot_hash = ?
          AND moderation_status = ?
          AND is_revoked = ?
          AND paused_at IS ?
          AND expires_at IS ?
          AND archived_at IS ?
          AND legacy_provenance_status IS NULL
      `).bind(
        moderationStatus,
        reason,
        target,
        itemIndex,
        user.userId,
        shareId,
        expectedVersion,
        expectedHash,
        expectedStatus,
        expectedIsRevoked,
        expectedPausedAt,
        expectedExpiresAt,
        expectedArchivedAt,
      ),
      c.env.DB.prepare(`
        INSERT INTO creator_share_notification_events (
          share_link_id,
          share_version,
          event_type,
          status,
          attempts
        ) VALUES (
          (
            SELECT id
            FROM share_links
            WHERE id = ?
              AND version = ?
              AND snapshot_hash = ?
              AND moderation_status = ?
              AND moderation_reason IS ?
              AND moderation_target IS ?
              AND moderation_item_index IS ?
              AND is_revoked = ?
              AND paused_at IS ?
              AND expires_at IS ?
              AND archived_at IS ?
              AND legacy_provenance_status IS NULL
          ),
          ?,
          ?,
          'pending',
          0
        )
      `).bind(
        shareId,
        expectedVersion + 1,
        expectedHash,
        moderationStatus,
        reason,
        target,
        itemIndex,
        expectedIsRevoked,
        expectedPausedAt,
        expectedExpiresAt,
        expectedArchivedAt,
        expectedVersion + 1,
        eventType,
      ),
    ])
  } catch {
    return c.json({ error: 'Die Empfehlung hat sich geändert. Bitte lade sie neu.' }, 409)
  }
  if (d1Changes(moderationBatch[0]) !== 1 || d1Changes(moderationBatch[1]) !== 1) {
    return c.json({ error: 'Die Empfehlung hat sich geändert. Bitte lade sie neu.' }, 409)
  }
  const share = await c.env.DB.prepare('SELECT * FROM share_links WHERE id = ?').bind(shareId).first<{
    id: number
    version: number
  }>()
  const event = await c.env.DB.prepare(`
    SELECT id, status
    FROM creator_share_notification_events
    WHERE share_link_id = ? AND share_version = ? AND event_type = ?
  `).bind(shareId, expectedVersion + 1, eventType).first<{ id: number; status: string }>()
  let notificationStatus = event?.status ?? 'failed'
  if (event?.status === 'pending') {
    try {
      notificationStatus = (await deliverCreatorShareNotification(c.env, event.id)).status
    } catch {
      const latestEvent = await c.env.DB.prepare(`
        SELECT status
        FROM creator_share_notification_events
        WHERE id = ?
      `).bind(event.id).first<{ status: string }>()
      notificationStatus = latestEvent?.status ?? 'failed'
    }
  }
  await logAdminAction(c, {
    action: 'moderate_creator_share',
    entity_type: 'share_link',
    entity_id: shareId,
    reason,
    changes: {
      before: {
        version: current.version,
        moderation_status: current.moderation_status,
        moderation_reason: current.moderation_reason,
        moderation_target: current.moderation_target,
        moderation_item_index: current.moderation_item_index,
      },
      after: {
        version: expectedVersion + 1,
        moderation_status: moderationStatus,
        moderation_reason: reason,
        moderation_target: target,
        moderation_item_index: itemIndex,
      },
    },
  })
  return c.json({ share, notification_status: notificationStatus })
})

creatorSharingAdmin.get('/reports', async (c) => {
  const requestedStatus = c.req.query('status') ?? 'open'
  if (!['open', 'pending', 'reviewed', 'resolved', 'dismissed', 'all'].includes(requestedStatus)) {
    return c.json({ error: 'Invalid report status' }, 400)
  }
  const where = requestedStatus === 'all'
    ? '1 = 1'
    : requestedStatus === 'open'
      ? "report.status IN ('pending', 'reviewed')"
      : 'report.status = ?'
  const query = c.env.DB.prepare(`
    SELECT
      report.id, report.share_link_id, report.category, report.details,
      report.status, report.version, report.created_at, report.reviewed_at,
      report.resolution_note, share.token, share.entity_type,
      json_extract(share.snapshot_json, '$.title') AS share_title,
      party.name AS creator_name
    FROM creator_share_reports report
    JOIN share_links share ON share.id = report.share_link_id
    JOIN parties party ON party.id = share.creator_party_id
    WHERE ${where}
    ORDER BY
      CASE report.status WHEN 'pending' THEN 0 WHEN 'reviewed' THEN 1 ELSE 2 END,
      report.created_at ASC, report.id ASC
    LIMIT 100
  `)
  const { results } = requestedStatus !== 'all' && requestedStatus !== 'open'
    ? await query.bind(requestedStatus).all()
    : await query.all()
  return c.json({ reports: results })
})

creatorSharingAdmin.patch('/reports/:id', async (c) => {
  const reportId = positiveInteger(c.req.param('id'))
  if (!reportId) return c.json({ error: 'Invalid report id' }, 400)
  let body: Record<string, unknown>
  try { body = await c.req.json() } catch { return c.json({ error: 'Invalid JSON' }, 400) }
  const expectedVersion = positiveInteger(body.expected_version)
  const expectedStatus = ['pending', 'reviewed', 'resolved', 'dismissed'].includes(String(body.expected_status))
    ? String(body.expected_status)
    : null
  const status = ['reviewed', 'resolved', 'dismissed'].includes(String(body.status))
    ? String(body.status)
    : null
  const resolutionNote = body.resolution_note === undefined || body.resolution_note === null || body.resolution_note === ''
    ? null
    : boundedText(body.resolution_note, 1000)
  if (!expectedVersion || !expectedStatus || !status
    || (body.resolution_note !== undefined && body.resolution_note !== null && body.resolution_note !== '' && !resolutionNote)) {
    return c.json({ error: 'expected_version, expected_status and a valid status are required' }, 400)
  }
  if ((expectedStatus === 'resolved' || expectedStatus === 'dismissed') || expectedStatus === status) {
    return c.json({ error: 'Report status cannot be changed from this state' }, 409)
  }
  const admin = c.get('user')
  const result = await c.env.DB.prepare(`
    UPDATE creator_share_reports
    SET status = ?, version = version + 1, reviewed_by_user_id = ?,
      reviewed_at = CURRENT_TIMESTAMP, resolution_note = ?
    WHERE id = ? AND version = ? AND status = ?
  `).bind(status, admin.userId, resolutionNote, reportId, expectedVersion, expectedStatus).run()
  if (d1Changes(result) !== 1) return c.json({ error: 'Report status conflict' }, 409)
  const report = await c.env.DB.prepare('SELECT * FROM creator_share_reports WHERE id = ?')
    .bind(reportId).first()
  await logAdminAction(c, {
    action: 'moderate_creator_share_report',
    entity_type: 'creator_share_report',
    entity_id: reportId,
    reason: resolutionNote,
    changes: {
      before: { version: expectedVersion, status: expectedStatus },
      after: { version: expectedVersion + 1, status },
    },
  })
  return c.json({ report })
})

creatorSharingAdmin.get('/missing-platform-codes', async (c) => {
  const platform = await getPlatformParty(c.env.DB)
  if (!platform) return c.json({ error: 'Platform party missing' }, 409)
  const { results } = await c.env.DB.prepare(`
    SELECT sd.id AS shop_domain_id, sd.display_name AS shop_name, sd.domain,
      COUNT(DISTINCT psl.product_id) AS products_count,
      GROUP_CONCAT(DISTINCT p.name) AS product_names
    FROM shop_domains sd
    JOIN product_shop_links psl ON psl.shop_domain_id = sd.id
      AND psl.active = 1 AND psl.blocked_at IS NULL AND psl.link_kind = 'base_target'
    JOIN products p ON p.id = psl.product_id
    LEFT JOIN party_shop_affiliate_versions av ON av.party_id = ?
      AND av.shop_domain_id = sd.id AND av.status = 'current'
      AND (av.valid_from IS NULL OR av.valid_from <= CURRENT_TIMESTAMP)
      AND (av.valid_until IS NULL OR av.valid_until >= CURRENT_TIMESTAMP)
    WHERE av.id IS NULL
    GROUP BY sd.id
    ORDER BY products_count DESC, sd.display_name
  `).bind(platform.id).all()
  return c.json({ shops: results })
})

creatorSharingAdmin.get('/products/:id/owner', async (c) => {
  const productId = positiveInteger(c.req.param('id'))
  if (!productId) return c.json({ error: 'Invalid product id' }, 400)
  const product = await c.env.DB.prepare(`
    SELECT p.id, p.name, p.brand, p.owner_party_id, party.name AS owner_party_name
    FROM products p JOIN parties party ON party.id = p.owner_party_id
    WHERE p.id = ?
  `).bind(productId).first()
  if (!product) return c.json({ error: 'Product not found' }, 404)
  return c.json({ product })
})

creatorSharingAdmin.patch('/products/:id/owner', async (c) => {
  const productId = positiveInteger(c.req.param('id'))
  let body: Record<string, unknown>
  try { body = await c.req.json() } catch { return c.json({ error: 'Invalid JSON' }, 400) }
  const partyId = positiveInteger(body.party_id)
  const expectedOwnerPartyId = positiveInteger(body.expected_owner_party_id)
  if (!productId || !partyId || !expectedOwnerPartyId) return c.json({ error: 'Product, party and expected owner are required' }, 400)
  const party = await c.env.DB.prepare('SELECT id FROM parties WHERE id = ? AND status = \'active\'').bind(partyId).first()
  if (!party) return c.json({ error: 'Active party not found' }, 404)
  const result = await c.env.DB.prepare(`UPDATE products SET owner_party_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND owner_party_id = ?`)
    .bind(partyId, productId, expectedOwnerPartyId).run()
  if (d1Changes(result) !== 1) return c.json({ error: 'Product owner conflict' }, 409)
  await logAdminAction(c, { action: 'update_product_owner_party', entity_type: 'product', entity_id: productId, changes: { before: expectedOwnerPartyId, after: partyId } })
  return c.json({ ok: true })
})

export default creatorSharingAdmin
