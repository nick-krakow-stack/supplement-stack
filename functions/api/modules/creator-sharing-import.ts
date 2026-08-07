import { Hono, type Context } from 'hono'
import type { AppContext } from '../lib/types'
import { ensureAuth } from '../lib/helpers'
import {
  canonicalJson,
  creatorSharingEnabled,
  isSupportedCreatorShareSnapshotVersion,
  snapshotHash,
  type CreatorShareSnapshot,
  type CreatorShareSnapshotItem,
} from '../lib/creator-sharing'
import {
  getParty,
  parseStoredSnapshot,
  sameIntegerSet,
  validateSnapshotRelations,
  type ValidatedSnapshotRelations,
} from '../lib/creator-sharing-service'

const creatorSharingImport = new Hono<AppContext>()

type ShareRow = {
  id: number
  token: string
  entity_type: 'dose_recommendation' | 'stack'
  entity_id: number
  snapshot_json: string
  creator_party_id: number | null
  snapshot_schema_version: number | null
  snapshot_hash: string | null
  expires_at: number | null
  is_revoked: number
  moderation_status: 'pending' | 'approved' | 'blocked'
}

type ImportComparison = {
  product_name: string
  quantity: number
  unit: string | null
  intake_interval_days: number | null
  dosage_text: string | null
  timing: string | null
}

type SimilarProduct = {
  stack_item_id: number
  version: number
  product_type: 'catalog' | 'user_product'
  main_ingredient_names: string[]
  comparison: ImportComparison
  private_note: string | null
}

type TargetState = {
  itemSignature: string
  ingredientSignature: string
  categorySignature: string
}

type ImportWriteClaim = {
  idempotencyKey: string
  shareId: number
  userId: number
  storedResultJson: string
}

type ImportPlan = {
  mode: 'new' | 'existing'
  stackId: number | null
  stackName: string
}

type LoadedShare = {
  row: ShareRow
  snapshot: CreatorShareSnapshot
  relations: ValidatedSnapshotRelations
}

type ImportPreflight = {
  loaded: LoadedShare
  plan: ImportPlan
  targetState: TargetState | null
  similarProducts: SimilarProduct[]
  response: {
    type: 'dose_recommendation' | 'stack'
    snapshot_hash: string
    title: string
    creator: { id: number; name: string }
    target: {
      mode: 'new' | 'existing'
      stack_id: number | null
      stack_name: string
      name_already_used: boolean
      suggested_stack_name: string | null
    }
    main_ingredient_names: string[]
    recommendation: ImportComparison | null
    similar_products: SimilarProduct[]
    stack_item_count: number
    preflight_fingerprint: string
  }
}

type PreflightFailure = {
  error: string
  code: string
  httpStatus: 400 | 404 | 409 | 410
}

type StackDetailRow = {
  stack_item_id: number
  version: number
  product_name: string
  product_type: 'catalog' | 'user_product'
  quantity: number
  unit: string | null
  intake_interval_days: number | null
  dosage_text: string | null
  timing: string | null
  private_note: string | null
  ingredient_id: number | null
  ingredient_name: string | null
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

async function hashCanonicalValue(value: unknown): Promise<string> {
  const bytes = new TextEncoder().encode(canonicalJson(value))
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return [...new Uint8Array(digest)].map((part) => part.toString(16).padStart(2, '0')).join('')
}

async function shareFailure(db: D1Database, token: string): Promise<PreflightFailure> {
  if (!/^[A-Za-z0-9_-]{24,80}$/.test(token)) {
    return { code: 'SHARE_UNKNOWN', error: 'Diese Empfehlung wurde nicht gefunden.', httpStatus: 404 }
  }
  const row = await db.prepare('SELECT * FROM share_links WHERE token = ? LIMIT 1').bind(token).first<ShareRow>()
  if (!row) return { code: 'SHARE_UNKNOWN', error: 'Diese Empfehlung wurde nicht gefunden.', httpStatus: 404 }
  const now = Math.floor(Date.now() / 1000)
  if (row.is_revoked === 1 || row.moderation_status === 'blocked') {
    return { code: 'SHARE_UNAVAILABLE', error: 'Diese Empfehlung ist nicht mehr verfügbar.', httpStatus: 410 }
  }
  if (row.expires_at !== null && row.expires_at <= now) {
    return { code: 'SHARE_EXPIRED', error: 'Dieser Link ist abgelaufen.', httpStatus: 410 }
  }
  if (row.moderation_status === 'pending') {
    return { code: 'SHARE_PENDING', error: 'Diese Empfehlung wird noch geprüft.', httpStatus: 409 }
  }
  return { code: 'SHARE_INVALID', error: 'Diese Empfehlung kann gerade nicht geladen werden.', httpStatus: 409 }
}

async function loadShare(db: D1Database, token: string): Promise<{ value?: LoadedShare; failure?: PreflightFailure }> {
  if (!/^[A-Za-z0-9_-]{24,80}$/.test(token)) return { failure: await shareFailure(db, token) }
  const row = await db.prepare(`
    SELECT * FROM share_links
    WHERE token = ? AND moderation_status = 'approved' AND is_revoked = 0
      AND (expires_at IS NULL OR expires_at > strftime('%s', 'now'))
    LIMIT 1
  `).bind(token).first<ShareRow>()
  if (!row) return { failure: await shareFailure(db, token) }
  if (!isSupportedCreatorShareSnapshotVersion(row.snapshot_schema_version) || !row.snapshot_hash) {
    return { failure: { code: 'SHARE_INVALID', error: 'Diese Empfehlung kann gerade nicht geladen werden.', httpStatus: 409 } }
  }
  const parsed = parseStoredSnapshot(row.snapshot_json)
  if (!parsed.value || await snapshotHash(parsed.value) !== row.snapshot_hash
    || parsed.value.creator_party_id !== row.creator_party_id || parsed.value.type !== row.entity_type) {
    return { failure: { code: 'SHARE_INVALID', error: 'Diese Empfehlung kann gerade nicht geladen werden.', httpStatus: 409 } }
  }
  const relations = await validateSnapshotRelations(db, parsed.value)
  if (!relations.value) {
    return { failure: { code: 'SHARE_INVALID', error: 'Diese Empfehlung kann gerade nicht geladen werden.', httpStatus: 409 } }
  }
  return { value: { row, snapshot: parsed.value, relations: relations.value } }
}

async function ingredientNames(db: D1Database, ids: number[]): Promise<string[]> {
  if (ids.length === 0) return []
  const placeholders = ids.map(() => '?').join(', ')
  const { results } = await db.prepare(`
    SELECT id, name FROM ingredients WHERE id IN (${placeholders}) ORDER BY name COLLATE NOCASE, id
  `).bind(...ids).all<{ id: number; name: string }>()
  const names = new Map((results ?? []).map((row) => [row.id, row.name]))
  return ids.map((id) => names.get(id)).filter((name): name is string => typeof name === 'string')
}

async function stackItemDetails(db: D1Database, stackId: number, userId: number): Promise<Map<number, {
  ids: number[]
  names: string[]
  item: SimilarProduct
}>> {
  const { results } = await db.prepare(`
    SELECT * FROM (
      SELECT si.id AS stack_item_id, si.version, p.name AS product_name,
        'catalog' AS product_type, si.quantity, p.serving_unit AS unit,
        si.intake_interval_days, si.dosage_text, si.timing, NULL AS private_note,
        pi.ingredient_id, ingredient.name AS ingredient_name
      FROM stack_items si
      JOIN products p ON p.id = si.catalog_product_id
      LEFT JOIN product_ingredients pi ON pi.product_id = si.catalog_product_id AND pi.is_main = 1
      LEFT JOIN ingredients ingredient ON ingredient.id = pi.ingredient_id
      WHERE si.stack_id = ? AND si.catalog_product_id IS NOT NULL
      UNION ALL
      SELECT si.id AS stack_item_id, si.version, up.name AS product_name,
        'user_product' AS product_type, si.quantity, up.serving_unit AS unit,
        si.intake_interval_days, si.dosage_text, si.timing,
        CASE WHEN up.user_id = ? THEN up.notes ELSE NULL END AS private_note,
        upi.ingredient_id, ingredient.name AS ingredient_name
      FROM stack_items si
      JOIN user_products up ON up.id = si.user_product_id
      LEFT JOIN user_product_ingredients upi ON upi.user_product_id = si.user_product_id AND upi.is_main = 1
      LEFT JOIN ingredients ingredient ON ingredient.id = upi.ingredient_id
      WHERE si.stack_id = ? AND si.user_product_id IS NOT NULL
    ) ORDER BY stack_item_id, ingredient_id
  `).bind(stackId, userId, stackId).all<StackDetailRow>()
  const items = new Map<number, { ids: number[]; names: string[]; item: SimilarProduct }>()
  for (const row of results ?? []) {
    const existing = items.get(row.stack_item_id) ?? {
      ids: [],
      names: [],
      item: {
        stack_item_id: row.stack_item_id,
        version: row.version,
        product_type: row.product_type,
        main_ingredient_names: [],
        comparison: {
          product_name: row.product_name,
          quantity: row.quantity,
          unit: row.unit,
          intake_interval_days: row.intake_interval_days,
          dosage_text: row.dosage_text,
          timing: row.timing,
        },
        private_note: row.private_note,
      },
    }
    if (row.ingredient_id !== null && !existing.ids.includes(row.ingredient_id)) {
      existing.ids.push(row.ingredient_id)
      if (row.ingredient_name) existing.names.push(row.ingredient_name)
    }
    existing.item.main_ingredient_names = existing.names
    items.set(row.stack_item_id, existing)
  }
  return items
}

async function loadTargetState(db: D1Database, stackId: number): Promise<TargetState> {
  const [items, ingredients, categories] = await Promise.all([
    db.prepare('SELECT id, version, category_id, sort_order FROM stack_items WHERE stack_id = ? ORDER BY id')
      .bind(stackId).all<{ id: number; version: number; category_id: number | null; sort_order: number }>(),
    db.prepare(`
      SELECT stack_item_id, ingredient_id FROM (
        SELECT si.id AS stack_item_id, pi.ingredient_id
        FROM stack_items si JOIN product_ingredients pi ON pi.product_id = si.catalog_product_id AND pi.is_main = 1
        WHERE si.stack_id = ?
        UNION ALL
        SELECT si.id AS stack_item_id, upi.ingredient_id
        FROM stack_items si JOIN user_product_ingredients upi ON upi.user_product_id = si.user_product_id AND upi.is_main = 1
        WHERE si.stack_id = ?
      ) ORDER BY stack_item_id, ingredient_id
    `).bind(stackId, stackId).all<{ stack_item_id: number; ingredient_id: number }>(),
    db.prepare('SELECT id, sort_order, is_default, updated_at FROM stack_categories WHERE stack_id = ? ORDER BY id')
      .bind(stackId).all<{ id: number; sort_order: number; is_default: number; updated_at: string }>(),
  ])
  return {
    itemSignature: (items.results ?? []).map((row) => `${row.id}:${row.version}:${row.category_id ?? ''}:${row.sort_order}`).join('|'),
    ingredientSignature: (ingredients.results ?? []).map((row) => `${row.stack_item_id}:${row.ingredient_id}`).join('|'),
    categorySignature: (categories.results ?? []).map((row) => `${row.id}:${row.sort_order}:${row.is_default}:${row.updated_at}`).join('|'),
  }
}

function normalizedStackName(value: string): string {
  return value.trim().toLocaleLowerCase('de-DE').replace(/\s+/g, ' ')
}

function freeStackName(existingNames: string[], title: string, creatorName: string): string {
  const used = new Set(existingNames.map(normalizedStackName))
  const creatorSuffix = ` – von ${creatorName.trim()}`
  const base = creatorSuffix.length < 120
    ? `${title.slice(0, 120 - creatorSuffix.length).trim()}${creatorSuffix}`
    : `${title.slice(0, 60).trim()} – von ${creatorName.trim()}`.slice(0, 120)
  if (!used.has(normalizedStackName(base))) return base
  for (let number = 2; number < 10_000; number += 1) {
    const suffix = ` (${number})`
    const candidate = `${base.slice(0, 120 - suffix.length)}${suffix}`
    if (!used.has(normalizedStackName(candidate))) return candidate
  }
  return `${base.slice(0, 113)} (neu)`
}

async function buildPreflight(
  db: D1Database,
  token: string,
  userId: number,
  body: Record<string, unknown>,
): Promise<{ value?: ImportPreflight; failure?: PreflightFailure }> {
  const loadedResult = await loadShare(db, token)
  if (!loadedResult.value) return { failure: loadedResult.failure }
  const loaded = loadedResult.value
  const party = await getParty(db, loaded.snapshot.creator_party_id)
  if (!party) return { failure: { code: 'SHARE_INVALID', error: 'Diese Empfehlung kann gerade nicht geladen werden.', httpStatus: 409 } }

  let plan: ImportPlan
  if (loaded.snapshot.type === 'stack') {
    const stackName = body.stack_name === undefined ? loaded.snapshot.title : boundedText(body.stack_name, 120)
    if (!stackName) return { failure: { code: 'INVALID_TARGET', error: 'Bitte gib einen Namen für den neuen Stack ein.', httpStatus: 400 } }
    plan = { mode: 'new', stackId: null, stackName }
  } else if (body.target_mode === 'new') {
    const stackName = boundedText(body.stack_name, 120)
    if (!stackName) return { failure: { code: 'INVALID_TARGET', error: 'Bitte gib einen Namen für den neuen Stack ein.', httpStatus: 400 } }
    plan = { mode: 'new', stackId: null, stackName }
  } else if (body.target_mode === 'existing') {
    const stackId = positiveInteger(body.target_stack_id)
    if (!stackId) return { failure: { code: 'INVALID_TARGET', error: 'Bitte wähle einen deiner Stacks aus.', httpStatus: 400 } }
    const stack = await db.prepare('SELECT id, name FROM stacks WHERE id = ? AND user_id = ?')
      .bind(stackId, userId).first<{ id: number; name: string }>()
    if (!stack) return { failure: { code: 'TARGET_CHANGED', error: 'Der gewählte Stack ist nicht mehr verfügbar.', httpStatus: 409 } }
    plan = { mode: 'existing', stackId: stack.id, stackName: stack.name }
  } else {
    return { failure: { code: 'INVALID_TARGET', error: 'Bitte wähle aus, wo du die Empfehlung speichern möchtest.', httpStatus: 400 } }
  }

  const snapshotItem = loaded.snapshot.items[0]
  const targetState = plan.stackId ? await loadTargetState(db, plan.stackId) : null
  const details = plan.stackId ? await stackItemDetails(db, plan.stackId, userId) : new Map<number, { ids: number[]; names: string[]; item: SimilarProduct }>()
  const similarProducts = loaded.snapshot.type === 'dose_recommendation'
    ? [...details.values()].filter((entry) => sameIntegerSet(entry.ids, snapshotItem.main_ingredient_ids)).map((entry) => entry.item)
    : []
  const allIngredientIds = [...new Set(loaded.snapshot.items.flatMap((entry) => entry.main_ingredient_ids))]
  const mainIngredientNames = await ingredientNames(db, allIngredientIds)
  const creatorProduct = loaded.relations.products.get(snapshotItem.catalog_product_id)
  if (!creatorProduct) return { failure: { code: 'SHARE_INVALID', error: 'Diese Empfehlung kann gerade nicht geladen werden.', httpStatus: 409 } }
  const namesResult = await db.prepare('SELECT name FROM stacks WHERE user_id = ? ORDER BY id').bind(userId).all<{ name: string }>()
  const existingNames = (namesResult.results ?? []).map((row) => row.name)
  const sameName = plan.mode === 'new' && existingNames.some((name) => normalizedStackName(name) === normalizedStackName(plan.stackName))
  const recommendation: ImportComparison | null = loaded.snapshot.type === 'dose_recommendation' ? {
    product_name: creatorProduct.name,
    quantity: snapshotItem.quantity,
    unit: snapshotItem.unit ?? null,
    intake_interval_days: snapshotItem.intake_interval_days,
    dosage_text: snapshotItem.dosage_text,
    timing: snapshotItem.timing,
  } : null
  const fingerprint = await hashCanonicalValue({
    version: 1,
    share_id: loaded.row.id,
    snapshot_hash: loaded.row.snapshot_hash,
    user_id: userId,
    plan,
    target_state: targetState,
  })
  return {
    value: {
      loaded,
      plan,
      targetState,
      similarProducts,
      response: {
        type: loaded.snapshot.type,
        snapshot_hash: loaded.row.snapshot_hash as string,
        title: loaded.snapshot.title,
        creator: { id: party.id, name: party.name },
        target: {
          mode: plan.mode,
          stack_id: plan.stackId,
          stack_name: plan.stackName,
          name_already_used: sameName,
          suggested_stack_name: sameName ? freeStackName(existingNames, plan.stackName, party.name) : null,
        },
        main_ingredient_names: mainIngredientNames,
        recommendation,
        similar_products: similarProducts,
        stack_item_count: loaded.snapshot.items.length,
        preflight_fingerprint: fingerprint,
      },
    },
  }
}

creatorSharingImport.post('/shares/:token/preflight', async (c) => {
  const featureErr = ensureFeature(c)
  if (featureErr) return featureErr
  const authErr = await ensureAuth(c)
  if (authErr) return authErr
  let body: Record<string, unknown>
  try {
    body = await c.req.json()
  } catch {
    return c.json({ error: 'Ungültige Anfrage.', code: 'INVALID_TARGET' }, 400)
  }
  const result = await buildPreflight(c.env.DB, c.req.param('token'), c.get('user').userId, body)
  if (!result.value) {
    const failure = result.failure ?? { code: 'PREFLIGHT_FAILED', error: 'Das hat gerade nicht geklappt.', httpStatus: 409 as const }
    return c.json({ error: failure.error, code: failure.code }, failure.httpStatus)
  }
  return c.json(result.value.response)
})

const TARGET_STATE_SQL_GUARD = `
  AND (
    SELECT COALESCE(group_concat(signature, '|'), '') FROM (
      SELECT CAST(id AS TEXT) || ':' || CAST(version AS TEXT) || ':' ||
        COALESCE(CAST(category_id AS TEXT), '') || ':' || CAST(sort_order AS TEXT) AS signature
      FROM stack_items WHERE stack_id = ? ORDER BY id
    )
  ) = ?
  AND (
    SELECT COALESCE(group_concat(signature, '|'), '') FROM (
      SELECT CAST(stack_item_id AS TEXT) || ':' || CAST(ingredient_id AS TEXT) AS signature FROM (
        SELECT si.id AS stack_item_id, pi.ingredient_id
        FROM stack_items si JOIN product_ingredients pi ON pi.product_id = si.catalog_product_id AND pi.is_main = 1
        WHERE si.stack_id = ?
        UNION ALL
        SELECT si.id AS stack_item_id, upi.ingredient_id
        FROM stack_items si JOIN user_product_ingredients upi ON upi.user_product_id = si.user_product_id AND upi.is_main = 1
        WHERE si.stack_id = ?
      ) ORDER BY stack_item_id, ingredient_id
    )
  ) = ?
  AND (
    SELECT COALESCE(group_concat(signature, '|'), '') FROM (
      SELECT CAST(id AS TEXT) || ':' || CAST(sort_order AS TEXT) || ':' ||
        CAST(is_default AS TEXT) || ':' || updated_at AS signature
      FROM stack_categories WHERE stack_id = ? ORDER BY id
    )
  ) = ?
`

function targetStateBindings(stackId: number, state: TargetState): unknown[] {
  return [stackId, state.itemSignature, stackId, stackId, state.ingredientSignature, stackId, state.categorySignature]
}

const WRITE_CLAIM_SQL = `EXISTS (
  SELECT 1 FROM share_import_operations operation
  WHERE operation.idempotency_key = ? AND operation.share_link_id = ?
    AND operation.user_id = ? AND operation.result_json = ?
)`

function createWriteClaim(
  idempotencyKey: string,
  shareId: number,
  userId: number,
  result: Record<string, unknown>,
  attemptNonce: string,
): ImportWriteClaim {
  return {
    idempotencyKey,
    shareId,
    userId,
    storedResultJson: JSON.stringify({ ...result, __attempt_nonce: attemptNonce }),
  }
}

function claimBindings(claim: ImportWriteClaim): unknown[] {
  return [claim.idempotencyKey, claim.shareId, claim.userId, claim.storedResultJson]
}

async function candidateIds(
  db: D1Database,
  table: 'stacks' | 'stack_categories' | 'stack_items',
  count: number,
): Promise<number[]> {
  if (!Number.isInteger(count) || count < 0) throw new Error('Invalid id candidate count')
  if (count === 0) return []
  const row = await db.prepare(`
    SELECT MAX(
      COALESCE((SELECT seq FROM sqlite_sequence WHERE name = ?), 0),
      COALESCE((SELECT MAX(id) FROM ${table}), 0)
    ) + 1 AS first_id
  `).bind(table).first<{ first_id: number }>()
  const first = Number(row?.first_id)
  const last = first + count - 1
  if (!Number.isSafeInteger(first) || first <= 0 || !Number.isSafeInteger(last)) {
    throw new Error(`Could not generate ids for ${table}`)
  }
  return Array.from({ length: count }, (_, index) => first + index)
}

function operationGuard(
  db: D1Database,
  input: {
    targetStackId: number | null
    share: ShareRow
    claim: ImportWriteClaim
    targetState?: TargetState | null
  },
): D1PreparedStatement {
  const targetGuard = input.targetStackId && input.targetState
    ? `AND EXISTS (SELECT 1 FROM stacks WHERE id = ? AND user_id = ?) ${TARGET_STATE_SQL_GUARD}`
    : ''
  const bindings: unknown[] = [
    input.claim.idempotencyKey,
    input.claim.userId,
    input.targetStackId,
    input.claim.storedResultJson,
    input.claim.shareId,
    input.share.snapshot_hash,
  ]
  if (input.targetStackId && input.targetState) {
    bindings.push(input.targetStackId, input.claim.userId, ...targetStateBindings(input.targetStackId, input.targetState))
  }
  return db.prepare(`
    INSERT INTO share_import_operations (
      idempotency_key, share_link_id, user_id, target_stack_id, result_json
    )
    SELECT ?, id, ?, ?, ? FROM share_links
    WHERE id = ? AND snapshot_hash = ? AND moderation_status = 'approved'
      AND is_revoked = 0
      AND (expires_at IS NULL OR expires_at > strftime('%s', 'now'))
      ${targetGuard}
  `).bind(...bindings)
}

function counterStatement(db: D1Database, share: ShareRow, claim: ImportWriteClaim): D1PreparedStatement {
  return db.prepare(`
    UPDATE share_links SET imports = imports + 1
    WHERE id = ? AND snapshot_hash = ? AND moderation_status = 'approved' AND is_revoked = 0
      AND (expires_at IS NULL OR expires_at > strftime('%s', 'now'))
      AND ${WRITE_CLAIM_SQL}
  `).bind(share.id, share.snapshot_hash, ...claimBindings(claim))
}

async function replayResult(db: D1Database, idempotencyKey: string, userId: number, token: string): Promise<Record<string, unknown> | null> {
  const row = await db.prepare(`
    SELECT operation.result_json FROM share_import_operations operation
    JOIN share_links share ON share.id = operation.share_link_id
    WHERE operation.idempotency_key = ? AND operation.user_id = ? AND share.token = ?
  `).bind(idempotencyKey, userId, token).first<{ result_json: string | null }>()
  if (!row?.result_json) return null
  try {
    const parsed = JSON.parse(row.result_json) as Record<string, unknown>
    delete parsed.__attempt_nonce
    return parsed
  } catch {
    return null
  }
}

async function executeBatch(
  c: Context<AppContext>,
  statements: D1PreparedStatement[],
  idempotencyKey: string,
  token: string,
): Promise<{ batch?: D1Result<unknown>[]; replay?: Record<string, unknown> }> {
  try {
    const batch = await c.env.DB.batch(statements)
    if (d1Changes(batch[0]) === 0) {
      const replay = await replayResult(c.env.DB, idempotencyKey, c.get('user').userId, token)
      if (replay) return { replay }
    }
    return { batch }
  } catch (error) {
    const replay = await replayResult(c.env.DB, idempotencyKey, c.get('user').userId, token)
    if (replay) return { replay }
    throw error
  }
}

async function defaultCategoryId(db: D1Database, stackId: number): Promise<number | null> {
  const row = await db.prepare('SELECT id FROM stack_categories WHERE stack_id = ? AND is_default = 1 LIMIT 1')
    .bind(stackId).first<{ id: number }>()
  return row?.id ?? null
}

function normalizeCategoryName(value: string | null): { name: string; normalized: string } {
  const name = value?.trim() || 'Unkategorisiert'
  return {
    name: name.slice(0, 80),
    normalized: name.trim().toLocaleLowerCase('de-DE').replace(/\s+/g, ' '),
  }
}

function addSnapshotItem(
  db: D1Database,
  input: {
    itemId: number
    stackId: number
    categoryId: number
    sortOrder: number
    shareId: number
    item: CreatorShareSnapshotItem
    claim: ImportWriteClaim
  },
): D1PreparedStatement {
  return db.prepare(`
    INSERT INTO stack_items (
      id, stack_id, catalog_product_id, user_product_id, quantity,
      intake_interval_days, dosage_text, timing, sort_order, category_id,
      source_share_link_id, creator_statement_snapshot, amount_source, version
    )
    SELECT ?, ?, ?, NULL, ?, ?, ?, ?, ?, ?, ?, ?, 'creator_snapshot', 1
    WHERE ${WRITE_CLAIM_SQL}
  `).bind(
    input.itemId,
    input.stackId,
    input.item.catalog_product_id,
    input.item.quantity,
    input.item.intake_interval_days,
    input.item.dosage_text,
    input.item.timing,
    input.sortOrder,
    input.categoryId,
    input.shareId,
    input.item.creator_statement,
    ...claimBindings(input.claim),
  )
}

function claimedSnapshotItemBindingStatement(
  db: D1Database,
  stackItemId: number,
  item: CreatorShareSnapshotItem,
  claim: ImportWriteClaim,
): D1PreparedStatement {
  return db.prepare(`
    INSERT INTO stack_item_link_bindings (
      stack_item_id, shop_link_id, resolution_kind, affiliate_version_id, resolved_party_id, bound_at
    )
    SELECT ?, ?, ?, ?, ?, CURRENT_TIMESTAMP
    WHERE ${WRITE_CLAIM_SQL}
  `).bind(
    stackItemId,
    item.shop_link_id,
    item.link_binding.resolution_kind,
    item.link_binding.affiliate_version_id,
    item.link_binding.resolved_party_id,
    ...claimBindings(claim),
  )
}

creatorSharingImport.post('/shares/:token/import', async (c) => {
  const featureErr = ensureFeature(c)
  if (featureErr) return featureErr
  const authErr = await ensureAuth(c)
  if (authErr) return authErr
  const user = c.get('user')
  let body: Record<string, unknown>
  try {
    body = await c.req.json()
  } catch {
    return c.json({ error: 'Ungültige Anfrage.' }, 400)
  }
  const token = c.req.param('token')
  const idempotencyKey = boundedText(body.idempotency_key, 120)
  if (!idempotencyKey || !/^[A-Za-z0-9._:-]{16,120}$/.test(idempotencyKey)) {
    return c.json({ error: 'Die Speicheranfrage ist ungültig.' }, 400)
  }
  const replay = await replayResult(c.env.DB, idempotencyKey, user.userId, token)
  if (replay) return c.json({ ...replay, idempotent_replay: true })
  const collision = await c.env.DB.prepare('SELECT id FROM share_import_operations WHERE idempotency_key = ?')
    .bind(idempotencyKey).first<{ id: number }>()
  if (collision) return c.json({ error: 'Bitte prüfe die Auswahl noch einmal.', code: 'PREFLIGHT_CHANGED' }, 409)

  const fingerprint = boundedText(body.preflight_fingerprint, 64)
  const snapshotHashValue = boundedText(body.expected_snapshot_hash, 64)
  if (!fingerprint || !/^[a-f0-9]{64}$/.test(fingerprint)
    || !snapshotHashValue || !/^[a-f0-9]{64}$/.test(snapshotHashValue)) {
    return c.json({ error: 'Bitte prüfe die Auswahl vor dem Speichern.', code: 'PREFLIGHT_REQUIRED' }, 409)
  }
  const preflightResult = await buildPreflight(c.env.DB, token, user.userId, body)
  if (!preflightResult.value) {
    const failure = preflightResult.failure ?? { code: 'PREFLIGHT_CHANGED', error: 'Bitte prüfe die Auswahl noch einmal.', httpStatus: 409 as const }
    return c.json({ error: failure.error, code: failure.code }, failure.httpStatus)
  }
  const preflight = preflightResult.value
  if (preflight.response.preflight_fingerprint !== fingerprint || preflight.loaded.row.snapshot_hash !== snapshotHashValue) {
    return c.json({
      error: 'Die Empfehlung oder dein Ziel hat sich geändert. Bitte prüfe die Auswahl noch einmal.',
      code: 'PREFLIGHT_CHANGED',
    }, 409)
  }

  const attemptNonce = crypto.randomUUID()
  if (preflight.loaded.snapshot.type === 'stack') {
    return saveCompleteStack(c, preflight, idempotencyKey, token, attemptNonce)
  }
  return saveSingleRecommendation(c, preflight, idempotencyKey, token, body, attemptNonce)
})

async function saveCompleteStack(
  c: Context<AppContext>,
  preflight: ImportPreflight,
  idempotencyKey: string,
  token: string,
  attemptNonce: string,
): Promise<Response> {
  const user = c.get('user')
  const { loaded, plan } = preflight
  const [stackId] = await candidateIds(c.env.DB, 'stacks', 1)
  const itemIds = await candidateIds(c.env.DB, 'stack_items', loaded.snapshot.items.length)
  const categories: Array<{ name: string; normalized: string }> = [normalizeCategoryName(null)]
  for (const item of loaded.snapshot.items) {
    const category = normalizeCategoryName(item.category_name)
    if (!categories.some((entry) => entry.normalized === category.normalized)) categories.push(category)
  }
  categories.sort((left, right) => left.normalized === 'unkategorisiert' ? -1 : right.normalized === 'unkategorisiert' ? 1 : left.name.localeCompare(right.name, 'de'))
  const categoryIds = await candidateIds(c.env.DB, 'stack_categories', categories.length)
  const categoryByName = new Map(categories.map((entry, index) => [entry.normalized, categoryIds[index]]))
  const result = {
    ok: true,
    type: 'stack',
    action: 'stack_created',
    stack_id: stackId,
    stack_name: plan.stackName,
    imported_items: itemIds.length,
  }
  const claim = createWriteClaim(idempotencyKey, loaded.row.id, user.userId, result, attemptNonce)
  const statements: D1PreparedStatement[] = [
    operationGuard(c.env.DB, { targetStackId: null, share: loaded.row, claim }),
    c.env.DB.prepare(`
      INSERT INTO stacks (id, user_id, name, origin_party_id, last_opened_at)
      SELECT ?, ?, ?, ?, CURRENT_TIMESTAMP
      WHERE ${WRITE_CLAIM_SQL}
    `).bind(stackId, user.userId, plan.stackName, loaded.snapshot.creator_party_id, ...claimBindings(claim)),
  ]
  categories.forEach((category, index) => {
    statements.push(c.env.DB.prepare(`
      INSERT INTO stack_categories (
        id, stack_id, name, name_normalized, sort_order, is_default, created_at, updated_at
      )
      SELECT ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
      WHERE ${WRITE_CLAIM_SQL}
    `).bind(categoryIds[index], stackId, category.name, category.normalized, index, category.normalized === 'unkategorisiert' ? 1 : 0, ...claimBindings(claim)))
  })
  loaded.snapshot.items.forEach((item, index) => {
    statements.push(addSnapshotItem(c.env.DB, {
      itemId: itemIds[index],
      stackId,
      categoryId: categoryByName.get(normalizeCategoryName(item.category_name).normalized) as number,
      sortOrder: item.sort_order,
      shareId: loaded.row.id,
      item,
      claim,
    }))
    statements.push(claimedSnapshotItemBindingStatement(c.env.DB, itemIds[index], item, claim))
  })
  statements.push(c.env.DB.prepare(`
    UPDATE share_import_operations SET target_stack_id = ?
    WHERE idempotency_key = ? AND share_link_id = ? AND user_id = ? AND result_json = ?
  `).bind(stackId, ...claimBindings(claim)))
  statements.push(counterStatement(c.env.DB, loaded.row, claim))
  const execution = await executeBatch(c, statements, idempotencyKey, token)
  if (execution.replay) return c.json({ ...execution.replay, idempotent_replay: true })
  if (!execution.batch || d1Changes(execution.batch[0]) !== 1) {
    return c.json({ error: 'Die Empfehlung hat sich geändert. Bitte prüfe sie noch einmal.', code: 'PREFLIGHT_CHANGED' }, 409)
  }
  return c.json(result, 201)
}

async function saveSingleRecommendation(
  c: Context<AppContext>,
  preflight: ImportPreflight,
  idempotencyKey: string,
  token: string,
  body: Record<string, unknown>,
  attemptNonce: string,
): Promise<Response> {
  const { loaded, plan, targetState, similarProducts } = preflight
  const item = loaded.snapshot.items[0]
  const product = loaded.relations.products.get(item.catalog_product_id)
  if (!product) return c.json({ error: 'Diese Empfehlung kann gerade nicht gespeichert werden.' }, 409)
  const selectedId = positiveInteger(body.selected_stack_item_id)
  const selectedVersion = positiveInteger(body.expected_stack_item_version)
  const selected = selectedId && selectedVersion
    ? similarProducts.find((candidate) => candidate.stack_item_id === selectedId && candidate.version === selectedVersion) ?? null
    : null
  const decision = body.decision === 'keep' || body.decision === 'replace' || body.decision === 'add' ? body.decision : null
  if (similarProducts.length > 0 && (!selected || (decision !== 'keep' && decision !== 'replace'))) {
    return c.json({
      error: 'Bitte wähle das ähnliche Produkt und entscheide, was du möchtest.',
      code: 'CHOICE_REQUIRED',
    }, 409)
  }
  if (similarProducts.length === 0 && decision !== 'add') {
    return c.json({ error: 'Bitte prüfe die Auswahl noch einmal.', code: 'PREFLIGHT_CHANGED' }, 409)
  }
  if (decision === 'keep' && selected) {
    return c.json({
      ok: true,
      type: 'dose_recommendation',
      action: 'kept_existing',
      stack_id: plan.stackId,
      stack_name: plan.stackName,
      creator_product_name: product.name,
      existing_product_name: selected.comparison.product_name,
    })
  }
  if (plan.mode === 'new') {
    return addToNewStack(c, preflight, idempotencyKey, token, product.name, attemptNonce)
  }
  if (!plan.stackId || !targetState) {
    return c.json({ error: 'Bitte prüfe das Ziel noch einmal.', code: 'PREFLIGHT_CHANGED' }, 409)
  }
  if (decision === 'replace' && selected) {
    return replaceInExistingStack(c, preflight, selected, idempotencyKey, token, product.name, attemptNonce)
  }
  return addToExistingStack(c, preflight, idempotencyKey, token, product.name, attemptNonce)
}

async function addToNewStack(
  c: Context<AppContext>,
  preflight: ImportPreflight,
  idempotencyKey: string,
  token: string,
  productName: string,
  attemptNonce: string,
): Promise<Response> {
  const user = c.get('user')
  const { loaded, plan } = preflight
  const item = loaded.snapshot.items[0]
  const [stackId] = await candidateIds(c.env.DB, 'stacks', 1)
  const [categoryId] = await candidateIds(c.env.DB, 'stack_categories', 1)
  const [itemId] = await candidateIds(c.env.DB, 'stack_items', 1)
  const result = {
    ok: true,
    type: 'dose_recommendation',
    action: 'added',
    stack_id: stackId,
    stack_name: plan.stackName,
    stack_item_id: itemId,
    creator_product_name: productName,
    created_stack: true,
  }
  const claim = createWriteClaim(idempotencyKey, loaded.row.id, user.userId, result, attemptNonce)
  const statements: D1PreparedStatement[] = [
    operationGuard(c.env.DB, { targetStackId: null, share: loaded.row, claim }),
    c.env.DB.prepare(`
      INSERT INTO stacks (id, user_id, name, origin_party_id, last_opened_at)
      SELECT ?, ?, ?, ?, CURRENT_TIMESTAMP
      WHERE ${WRITE_CLAIM_SQL}
    `).bind(stackId, user.userId, plan.stackName, loaded.snapshot.creator_party_id, ...claimBindings(claim)),
    c.env.DB.prepare(`
      INSERT INTO stack_categories (
        id, stack_id, name, name_normalized, sort_order, is_default, created_at, updated_at
      )
      SELECT ?, ?, 'Unkategorisiert', 'unkategorisiert', 0, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
      WHERE ${WRITE_CLAIM_SQL}
    `).bind(categoryId, stackId, ...claimBindings(claim)),
    addSnapshotItem(c.env.DB, {
      itemId,
      stackId,
      categoryId,
      sortOrder: 0,
      shareId: loaded.row.id,
      item,
      claim,
    }),
    claimedSnapshotItemBindingStatement(c.env.DB, itemId, item, claim),
    c.env.DB.prepare(`
      UPDATE share_import_operations SET target_stack_id = ?
      WHERE idempotency_key = ? AND share_link_id = ? AND user_id = ? AND result_json = ?
    `).bind(stackId, ...claimBindings(claim)),
    counterStatement(c.env.DB, loaded.row, claim),
  ]
  const execution = await executeBatch(c, statements, idempotencyKey, token)
  if (execution.replay) return c.json({ ...execution.replay, idempotent_replay: true })
  if (!execution.batch || d1Changes(execution.batch[0]) !== 1) {
    return c.json({ error: 'Die Empfehlung hat sich geändert. Bitte prüfe sie noch einmal.', code: 'PREFLIGHT_CHANGED' }, 409)
  }
  return c.json(result, 201)
}

async function replaceInExistingStack(
  c: Context<AppContext>,
  preflight: ImportPreflight,
  selected: SimilarProduct,
  idempotencyKey: string,
  token: string,
  productName: string,
  attemptNonce: string,
): Promise<Response> {
  const user = c.get('user')
  const { loaded, plan, targetState } = preflight
  const item = loaded.snapshot.items[0]
  if (!plan.stackId || !targetState) {
    return c.json({ error: 'Bitte prüfe das Ziel noch einmal.', code: 'PREFLIGHT_CHANGED' }, 409)
  }
  const result = {
    ok: true,
    type: 'dose_recommendation',
    action: 'replaced',
    stack_id: plan.stackId,
    stack_name: plan.stackName,
    stack_item_id: selected.stack_item_id,
    creator_product_name: productName,
    replaced_product_name: selected.comparison.product_name,
    replaced_user_product_retained: selected.product_type === 'user_product',
  }
  const claim = createWriteClaim(idempotencyKey, loaded.row.id, user.userId, result, attemptNonce)
  const statements = [
    operationGuard(c.env.DB, {
      targetStackId: plan.stackId,
      share: loaded.row,
      claim,
      targetState,
    }),
    c.env.DB.prepare(`
      UPDATE stack_items
      SET catalog_product_id = ?, user_product_id = NULL, quantity = ?,
        intake_interval_days = ?, dosage_text = ?, timing = ?,
        source_share_link_id = ?, creator_statement_snapshot = ?,
        amount_source = 'creator_snapshot', version = version + 1
      WHERE id = ? AND stack_id = ? AND version = ?
        AND ${WRITE_CLAIM_SQL}
    `).bind(
      item.catalog_product_id,
      item.quantity,
      item.intake_interval_days,
      item.dosage_text,
      item.timing,
      loaded.row.id,
      item.creator_statement,
      selected.stack_item_id,
      plan.stackId,
      selected.version,
      ...claimBindings(claim),
    ),
    c.env.DB.prepare(`
      DELETE FROM stack_item_link_bindings
      WHERE stack_item_id = ?
        AND EXISTS (SELECT 1 FROM stack_items WHERE id = ? AND version = ?)
        AND ${WRITE_CLAIM_SQL}
    `).bind(selected.stack_item_id, selected.stack_item_id, selected.version + 1, ...claimBindings(claim)),
    c.env.DB.prepare(`
      INSERT INTO stack_item_link_bindings (
        stack_item_id, shop_link_id, resolution_kind, affiliate_version_id, resolved_party_id, bound_at
      )
      SELECT ?, ?, ?, ?, ?, CURRENT_TIMESTAMP
      WHERE EXISTS (SELECT 1 FROM stack_items WHERE id = ? AND version = ?)
        AND ${WRITE_CLAIM_SQL}
    `).bind(
      selected.stack_item_id,
      item.shop_link_id,
      item.link_binding.resolution_kind,
      item.link_binding.affiliate_version_id,
      item.link_binding.resolved_party_id,
      selected.stack_item_id,
      selected.version + 1,
      ...claimBindings(claim),
    ),
    counterStatement(c.env.DB, loaded.row, claim),
  ]
  const execution = await executeBatch(c, statements, idempotencyKey, token)
  if (execution.replay) return c.json({ ...execution.replay, idempotent_replay: true })
  if (!execution.batch || d1Changes(execution.batch[0]) !== 1 || d1Changes(execution.batch[1]) !== 1) {
    return c.json({ error: 'Der Stack hat sich geändert. Bitte prüfe die Auswahl noch einmal.', code: 'PREFLIGHT_CHANGED' }, 409)
  }
  return c.json(result)
}

async function addToExistingStack(
  c: Context<AppContext>,
  preflight: ImportPreflight,
  idempotencyKey: string,
  token: string,
  productName: string,
  attemptNonce: string,
): Promise<Response> {
  const user = c.get('user')
  const { loaded, plan, targetState } = preflight
  const item = loaded.snapshot.items[0]
  if (!plan.stackId || !targetState) {
    return c.json({ error: 'Bitte prüfe das Ziel noch einmal.', code: 'PREFLIGHT_CHANGED' }, 409)
  }
  const [itemId] = await candidateIds(c.env.DB, 'stack_items', 1)
  let categoryId = await defaultCategoryId(c.env.DB, plan.stackId)
  const categoryIsNew = categoryId === null
  if (categoryId === null) [categoryId] = await candidateIds(c.env.DB, 'stack_categories', 1)
  const sort = await c.env.DB.prepare('SELECT COALESCE(MAX(sort_order), -1) + 1 AS next_sort FROM stack_items WHERE stack_id = ?')
    .bind(plan.stackId).first<{ next_sort: number }>()
  const result = {
    ok: true,
    type: 'dose_recommendation',
    action: 'added',
    stack_id: plan.stackId,
    stack_name: plan.stackName,
    stack_item_id: itemId,
    creator_product_name: productName,
  }
  const claim = createWriteClaim(idempotencyKey, loaded.row.id, user.userId, result, attemptNonce)
  const statements: D1PreparedStatement[] = [operationGuard(c.env.DB, {
    targetStackId: plan.stackId,
    share: loaded.row,
    claim,
    targetState,
  })]
  if (categoryIsNew) {
    statements.push(c.env.DB.prepare(`
      INSERT INTO stack_categories (
        id, stack_id, name, name_normalized, sort_order, is_default, created_at, updated_at
      )
      SELECT ?, ?, 'Unkategorisiert', 'unkategorisiert', 0, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
      WHERE ${WRITE_CLAIM_SQL}
    `).bind(categoryId, plan.stackId, ...claimBindings(claim)))
  }
  statements.push(addSnapshotItem(c.env.DB, {
    itemId,
    stackId: plan.stackId,
    categoryId,
    sortOrder: sort?.next_sort ?? 0,
    shareId: loaded.row.id,
    item,
    claim,
  }))
  statements.push(claimedSnapshotItemBindingStatement(c.env.DB, itemId, item, claim))
  statements.push(counterStatement(c.env.DB, loaded.row, claim))
  const execution = await executeBatch(c, statements, idempotencyKey, token)
  if (execution.replay) return c.json({ ...execution.replay, idempotent_replay: true })
  if (!execution.batch || d1Changes(execution.batch[0]) !== 1) {
    return c.json({ error: 'Der Stack hat sich geändert. Bitte prüfe die Auswahl noch einmal.', code: 'PREFLIGHT_CHANGED' }, 409)
  }
  return c.json(result, 201)
}

export default creatorSharingImport
