import { Hono, type Context } from 'hono'
import type { AppContext } from '../lib/types'
import { ensureAuth } from '../lib/helpers'
import {
  canonicalJson,
  creatorTimingLabel,
  creatorSharingEnabled,
  isSupportedCreatorShareSnapshotVersion,
  sha256Hex,
  snapshotHash,
  type CreatorShareSnapshot,
  type CreatorShareSnapshotItem,
} from '../lib/creator-sharing'
import {
  getParty,
  loadCreatorTimingLabels,
  parseStoredSnapshot,
  sameIntegerSet,
  SNAPSHOT_RELATION_SIGNATURE_SQL_GUARD,
  snapshotRelationSignatureJson,
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
  paused_at: number | null
  is_revoked: number
  moderation_status: 'pending' | 'approved' | 'blocked'
  legacy_provenance_status: 'ambiguous' | null
  version: number
}

type ImportComparison = {
  product_name: string
  quantity: number
  unit: string | null
  intake_interval_days: number | null
  dosage_text: string | null
  timing: string | null
  timing_label: string
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
  relationSignature: string
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

type StackItemUndoState = {
  id: number
  stack_id: number
  catalog_product_id: number | null
  user_product_id: number | null
  quantity: number
  dosage_text: string | null
  timing: string | null
  intake_interval_days: number
  sort_order: number
  source_share_link_id: number | null
  creator_statement_snapshot: string | null
  amount_source: string | null
  version: number
}

type StackItemBindingUndoState = {
  stack_item_id: number
  shop_link_id: number
  resolution_kind: 'creator_version' | 'platform_version' | 'legacy_resolved' | 'bare'
  affiliate_version_id: number | null
  resolved_party_id: number | null
  bound_at: string
}

type ExpectedStackItemBinding = Omit<StackItemBindingUndoState, 'bound_at'>

type ImportUndoRow = {
  id: number
  operation_id: number
  user_id: number
  target_stack_id: number
  stack_item_id: number
  action: 'replaced'
  previous_item_json: string
  previous_binding_json: string | null
  expected_item_json: string
  expected_binding_json: string
  summary: string
  expires_at: number
  undone_at: string | null
  write_claim_token: string | null
  version: number
  stack_name: string
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

function parseUndoItem(value: string): StackItemUndoState | null {
  try {
    const parsed = JSON.parse(value) as Partial<StackItemUndoState>
    if (!Number.isSafeInteger(parsed.id) || Number(parsed.id) <= 0
      || !Number.isSafeInteger(parsed.stack_id) || Number(parsed.stack_id) <= 0
      || !Number.isFinite(parsed.quantity)
      || !Number.isSafeInteger(parsed.intake_interval_days) || Number(parsed.intake_interval_days) < 1
      || !Number.isSafeInteger(parsed.sort_order)
      || !Number.isSafeInteger(parsed.version) || Number(parsed.version) < 1
      || (parsed.catalog_product_id === null) === (parsed.user_product_id === null)) return null
    return parsed as StackItemUndoState
  } catch {
    return null
  }
}

function parseUndoBinding(value: string | null, allowNull: true): StackItemBindingUndoState | null | undefined
function parseUndoBinding(value: string, allowNull: false): ExpectedStackItemBinding | null
function parseUndoBinding(
  value: string | null,
  allowNull: boolean,
): StackItemBindingUndoState | ExpectedStackItemBinding | null | undefined {
  if (value === null) return allowNull ? undefined : null
  try {
    const parsed = JSON.parse(value) as Partial<StackItemBindingUndoState>
    if (!Number.isSafeInteger(parsed.stack_item_id) || Number(parsed.stack_item_id) <= 0
      || !Number.isSafeInteger(parsed.shop_link_id) || Number(parsed.shop_link_id) <= 0
      || !['creator_version', 'platform_version', 'legacy_resolved', 'bare'].includes(String(parsed.resolution_kind))
      || (parsed.affiliate_version_id !== null && parsed.affiliate_version_id !== undefined
        && (!Number.isSafeInteger(parsed.affiliate_version_id) || Number(parsed.affiliate_version_id) <= 0))
      || (parsed.resolved_party_id !== null && parsed.resolved_party_id !== undefined
        && (!Number.isSafeInteger(parsed.resolved_party_id) || Number(parsed.resolved_party_id) <= 0))) return null
    if (allowNull && typeof parsed.bound_at !== 'string') return null
    return parsed as StackItemBindingUndoState | ExpectedStackItemBinding
  } catch {
    return null
  }
}

function itemGuardBindings(item: StackItemUndoState): unknown[] {
  return [
    item.id,
    item.stack_id,
    item.catalog_product_id,
    item.user_product_id,
    item.quantity,
    item.dosage_text,
    item.timing,
    item.intake_interval_days,
    item.sort_order,
    item.source_share_link_id,
    item.creator_statement_snapshot,
    item.amount_source,
    item.version,
  ]
}

const STACK_ITEM_EXACT_GUARD_SQL = `
  id = ? AND stack_id = ? AND catalog_product_id IS ? AND user_product_id IS ?
  AND quantity = ? AND dosage_text IS ? AND timing IS ?
  AND intake_interval_days = ? AND sort_order = ? AND source_share_link_id IS ?
  AND creator_statement_snapshot IS ? AND amount_source IS ? AND version = ?
`

function undoPostconditionStatement(
  db: D1Database,
  input: {
    undo: ImportUndoRow
    userId: number
    expectedVersion: number
    writeClaimToken: string
    restoredItem: StackItemUndoState
    previousBinding: StackItemBindingUndoState | undefined
  },
): D1PreparedStatement {
  const bindingGuard = input.previousBinding === undefined
    ? `NOT EXISTS (
        SELECT 1 FROM stack_item_link_bindings WHERE stack_item_id = ?
      )`
    : `(SELECT COUNT(*) FROM stack_item_link_bindings WHERE stack_item_id = ?) = 1
      AND EXISTS (
        SELECT 1 FROM stack_item_link_bindings binding
        WHERE binding.stack_item_id = ? AND binding.shop_link_id = ?
          AND binding.resolution_kind = ? AND binding.affiliate_version_id IS ?
          AND binding.resolved_party_id IS ? AND binding.bound_at = ?
      )`
  const bindingValues: unknown[] = input.previousBinding === undefined
    ? [input.undo.stack_item_id]
    : [
      input.previousBinding.stack_item_id,
      input.previousBinding.stack_item_id,
      input.previousBinding.shop_link_id,
      input.previousBinding.resolution_kind,
      input.previousBinding.affiliate_version_id,
      input.previousBinding.resolved_party_id,
      input.previousBinding.bound_at,
    ]
  return db.prepare(`
    SELECT CASE WHEN
      EXISTS (
        SELECT 1 FROM creator_share_import_undos
        WHERE id = ? AND operation_id = ? AND user_id = ? AND action = 'replaced'
          AND target_stack_id = ? AND stack_item_id = ? AND version = ?
          AND undone_at IS NOT NULL AND write_claim_token = ?
      )
      AND EXISTS (
        SELECT 1 FROM stack_items WHERE ${STACK_ITEM_EXACT_GUARD_SQL}
      )
      AND ${bindingGuard}
    THEN 1 ELSE json('UNDO_POSTCONDITION_FAILED') END AS undo_postcondition
  `).bind(
    input.undo.id,
    input.undo.operation_id,
    input.userId,
    input.undo.target_stack_id,
    input.undo.stack_item_id,
    input.expectedVersion + 1,
    input.writeClaimToken,
    ...itemGuardBindings(input.restoredItem),
    ...bindingValues,
  )
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
  const row = await db.prepare(`
    SELECT share.*, party.status AS creator_party_status
    FROM share_links share
    LEFT JOIN parties party ON party.id = share.creator_party_id
    WHERE share.token = ?
    LIMIT 1
  `).bind(token).first<ShareRow & { creator_party_status: string | null }>()
  if (!row) return { code: 'SHARE_UNKNOWN', error: 'Diese Empfehlung wurde nicht gefunden.', httpStatus: 404 }
  const now = Math.floor(Date.now() / 1000)
  if (
    row.creator_party_status !== 'active'
    || row.is_revoked === 1
    || row.moderation_status === 'blocked'
    || row.legacy_provenance_status === 'ambiguous'
  ) {
    return { code: 'SHARE_UNAVAILABLE', error: 'Diese Empfehlung ist nicht mehr verfügbar.', httpStatus: 410 }
  }
  if (row.expires_at !== null && row.expires_at <= now) {
    return { code: 'SHARE_EXPIRED', error: 'Dieser Link ist abgelaufen.', httpStatus: 410 }
  }
  if (row.moderation_status === 'pending') {
    return { code: 'SHARE_PENDING', error: 'Diese Empfehlung wird noch geprüft.', httpStatus: 409 }
  }
  if (row.paused_at !== null) {
    return { code: 'SHARE_PAUSED', error: 'Diese Empfehlung ist vorübergehend pausiert.', httpStatus: 409 }
  }
  return { code: 'SHARE_INVALID', error: 'Diese Empfehlung kann gerade nicht geladen werden.', httpStatus: 409 }
}

async function loadShare(db: D1Database, token: string): Promise<{ value?: LoadedShare; failure?: PreflightFailure }> {
  if (!/^[A-Za-z0-9_-]{24,80}$/.test(token)) return { failure: await shareFailure(db, token) }
  const row = await db.prepare(`
    SELECT * FROM share_links
    WHERE token = ? AND moderation_status = 'approved' AND is_revoked = 0
      AND legacy_provenance_status IS NULL
      AND paused_at IS NULL
      AND (expires_at IS NULL OR expires_at > strftime('%s', 'now'))
      AND EXISTS (
        SELECT 1 FROM parties party
        WHERE party.id = share_links.creator_party_id AND party.status = 'active'
      )
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

async function stackItemDetails(
  db: D1Database,
  stackId: number,
  userId: number,
  timingLabels: ReadonlyMap<string, string>,
): Promise<Map<number, {
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
          timing_label: creatorTimingLabel(row.timing, timingLabels),
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
  const [items, ingredients] = await Promise.all([
    db.prepare('SELECT id, version, sort_order FROM stack_items WHERE stack_id = ? ORDER BY id')
      .bind(stackId).all<{ id: number; version: number; sort_order: number }>(),
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
  ])
  return {
    itemSignature: (items.results ?? []).map((row) => `${row.id}:${row.version}:${row.sort_order}`).join('|'),
    ingredientSignature: (ingredients.results ?? []).map((row) => `${row.stack_item_id}:${row.ingredient_id}`).join('|'),
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
    const stack = await db.prepare('SELECT id, name FROM stacks WHERE id = ? AND user_id = ? AND deleted_at IS NULL')
      .bind(stackId, userId).first<{ id: number; name: string }>()
    if (!stack) return { failure: { code: 'TARGET_CHANGED', error: 'Der gewählte Stack ist nicht mehr verfügbar.', httpStatus: 409 } }
    plan = { mode: 'existing', stackId: stack.id, stackName: stack.name }
  } else {
    return { failure: { code: 'INVALID_TARGET', error: 'Bitte wähle aus, wo du die Empfehlung speichern möchtest.', httpStatus: 400 } }
  }

  const snapshotItem = loaded.snapshot.items[0]
  const [targetState, timingLabels] = await Promise.all([
    plan.stackId ? loadTargetState(db, plan.stackId) : Promise.resolve(null),
    loadCreatorTimingLabels(db),
  ])
  const details = plan.stackId
    ? await stackItemDetails(db, plan.stackId, userId, timingLabels)
    : new Map<number, { ids: number[]; names: string[]; item: SimilarProduct }>()
  const similarProducts = loaded.snapshot.type === 'dose_recommendation'
    ? [...details.values()].filter((entry) => sameIntegerSet(entry.ids, snapshotItem.main_ingredient_ids)).map((entry) => entry.item)
    : []
  const allIngredientIds = [...new Set(loaded.snapshot.items.flatMap((entry) => entry.main_ingredient_ids))]
  const mainIngredientNames = await ingredientNames(db, allIngredientIds)
  const creatorProduct = loaded.relations.products.get(snapshotItem.catalog_product_id)
  if (!creatorProduct) return { failure: { code: 'SHARE_INVALID', error: 'Diese Empfehlung kann gerade nicht geladen werden.', httpStatus: 409 } }
  const namesResult = await db.prepare('SELECT name FROM stacks WHERE user_id = ? AND deleted_at IS NULL ORDER BY id').bind(userId).all<{ name: string }>()
  const existingNames = (namesResult.results ?? []).map((row) => row.name)
  const sameName = plan.mode === 'new' && existingNames.some((name) => normalizedStackName(name) === normalizedStackName(plan.stackName))
  const recommendation: ImportComparison | null = loaded.snapshot.type === 'dose_recommendation' ? {
    product_name: creatorProduct.name,
    quantity: snapshotItem.quantity,
    unit: snapshotItem.unit ?? null,
    intake_interval_days: snapshotItem.intake_interval_days,
    dosage_text: snapshotItem.dosage_text,
    timing: snapshotItem.timing,
    timing_label: creatorTimingLabel(snapshotItem.timing, timingLabels),
  } : null
  const relationSignature = snapshotRelationSignatureJson(loaded.snapshot, loaded.relations)
  const fingerprint = await hashCanonicalValue({
    version: 1,
    share_id: loaded.row.id,
    share_version: loaded.row.version,
    snapshot_hash: loaded.row.snapshot_hash,
    share_lifecycle: {
      moderation_status: loaded.row.moderation_status,
      is_revoked: loaded.row.is_revoked,
      paused_at: loaded.row.paused_at,
      expires_at: loaded.row.expires_at,
    },
    relation_signature: relationSignature,
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
      relationSignature,
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
        CAST(sort_order AS TEXT) AS signature
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
`

function targetStateBindings(stackId: number, state: TargetState): unknown[] {
  return [stackId, state.itemSignature, stackId, stackId, state.ingredientSignature]
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
  const storedResult: Record<string, unknown> = { ...result }
  // Undo credentials are bearer secrets. Persist only the separately hashed
  // token in creator_share_import_undos; an idempotent replay is safe but does
  // not re-issue the short-lived credential.
  delete storedResult.undo
  return {
    idempotencyKey,
    shareId,
    userId,
    storedResultJson: JSON.stringify({ ...storedResult, __attempt_nonce: attemptNonce }),
  }
}

function claimBindings(claim: ImportWriteClaim): unknown[] {
  return [claim.idempotencyKey, claim.shareId, claim.userId, claim.storedResultJson]
}

async function candidateIds(
  db: D1Database,
  table: 'stacks' | 'stack_items',
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
    relationSignature: string
    targetState?: TargetState | null
    expectedPreviousBinding?: {
      stackItemId: number
      binding: StackItemBindingUndoState | null
    }
  },
): D1PreparedStatement {
  const targetGuard = input.targetStackId && input.targetState
    ? `AND EXISTS (SELECT 1 FROM stacks WHERE id = ? AND user_id = ? AND deleted_at IS NULL) ${TARGET_STATE_SQL_GUARD}`
    : ''
  const previousBindingGuard = input.expectedPreviousBinding === undefined
    ? ''
    : input.expectedPreviousBinding.binding === null
      ? `AND NOT EXISTS (
          SELECT 1 FROM stack_item_link_bindings binding
          WHERE binding.stack_item_id = ?
        )`
      : `AND EXISTS (
          SELECT 1 FROM stack_item_link_bindings binding
          WHERE binding.stack_item_id = ? AND binding.shop_link_id = ?
            AND binding.resolution_kind = ? AND binding.affiliate_version_id IS ?
            AND binding.resolved_party_id IS ? AND binding.bound_at IS ?
        )`
  const bindings: unknown[] = [
    input.claim.idempotencyKey,
    input.claim.userId,
    input.targetStackId,
    input.claim.storedResultJson,
    input.claim.shareId,
    input.share.snapshot_hash,
    input.share.snapshot_schema_version,
    input.share.entity_type,
    input.share.entity_id,
    input.share.creator_party_id,
    input.share.version,
    input.share.legacy_provenance_status,
    input.share.moderation_status,
    input.share.is_revoked,
    input.share.paused_at,
    input.share.expires_at,
    input.relationSignature,
  ]
  if (input.targetStackId && input.targetState) {
    bindings.push(input.targetStackId, input.claim.userId, ...targetStateBindings(input.targetStackId, input.targetState))
  }
  if (input.expectedPreviousBinding) {
    const { stackItemId, binding } = input.expectedPreviousBinding
    bindings.push(stackItemId)
    if (binding) {
      bindings.push(
        binding.shop_link_id,
        binding.resolution_kind,
        binding.affiliate_version_id,
        binding.resolved_party_id,
        binding.bound_at,
      )
    }
  }
  return db.prepare(`
    INSERT INTO share_import_operations (
      idempotency_key, share_link_id, user_id, target_stack_id, result_json
    )
    SELECT ?, id, ?, ?, ? FROM share_links
    WHERE id = ? AND snapshot_hash = ? AND snapshot_schema_version IS ?
      AND entity_type = ? AND entity_id = ? AND creator_party_id IS ?
      AND version = ? AND legacy_provenance_status IS ? AND moderation_status = ?
      AND is_revoked = ? AND paused_at IS ? AND expires_at IS ?
      AND moderation_status = 'approved' AND is_revoked = 0 AND paused_at IS NULL
      AND legacy_provenance_status IS NULL
      AND (expires_at IS NULL OR expires_at > strftime('%s', 'now'))
      AND EXISTS (
        SELECT 1 FROM parties party
        WHERE party.id = share_links.creator_party_id AND party.status = 'active'
      )
      AND ${SNAPSHOT_RELATION_SIGNATURE_SQL_GUARD}
      ${targetGuard}
      ${previousBindingGuard}
  `).bind(...bindings)
}

function counterStatement(db: D1Database, share: ShareRow, claim: ImportWriteClaim): D1PreparedStatement {
  return db.prepare(`
    UPDATE share_links SET imports = imports + 1
    WHERE id = ? AND snapshot_hash = ? AND moderation_status = 'approved' AND is_revoked = 0
      AND legacy_provenance_status IS NULL
      AND paused_at IS NULL
      AND (expires_at IS NULL OR expires_at > strftime('%s', 'now'))
      AND EXISTS (
        SELECT 1 FROM parties party
        WHERE party.id = share_links.creator_party_id AND party.status = 'active'
      )
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

function addSnapshotItem(
  db: D1Database,
  input: {
    itemId: number
    stackId: number
    sortOrder: number
    shareId: number
    item: CreatorShareSnapshotItem
    claim: ImportWriteClaim
  },
): D1PreparedStatement {
  return db.prepare(`
    INSERT INTO stack_items (
      id, stack_id, catalog_product_id, user_product_id, quantity,
      intake_interval_days, dosage_text, timing, sort_order,
      source_share_link_id, creator_statement_snapshot, amount_source, version
    )
    SELECT ?, ?, ?, NULL, ?, ?, ?, ?, ?, ?, ?, 'creator_snapshot', 1
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

async function loadUndoState(
  db: D1Database,
  stackItemId: number,
  stackId: number,
  userId: number,
  expectedVersion: number,
): Promise<{ item: StackItemUndoState; binding: StackItemBindingUndoState | null } | null> {
  const item = await db.prepare(`
    SELECT stack_item.*
    FROM stack_items stack_item
    JOIN stacks stack ON stack.id = stack_item.stack_id
    WHERE stack_item.id = ? AND stack_item.stack_id = ? AND stack_item.version = ?
      AND stack.user_id = ? AND stack.deleted_at IS NULL
  `).bind(stackItemId, stackId, expectedVersion, userId).first<StackItemUndoState>()
  if (!item) return null
  const binding = await db.prepare(`
    SELECT stack_item_id, shop_link_id, resolution_kind, affiliate_version_id,
      resolved_party_id, bound_at
    FROM stack_item_link_bindings
    WHERE stack_item_id = ?
  `).bind(stackItemId).first<StackItemBindingUndoState>()
  return { item, binding }
}

function undoMetadataStatement(
  db: D1Database,
  input: {
    claim: ImportWriteClaim
    undoTokenHash: string
    targetStackId: number
    stackItemId: number
    previousItem: StackItemUndoState
    previousBinding: StackItemBindingUndoState | null
    expectedItem: StackItemUndoState
    expectedBinding: ExpectedStackItemBinding
    summary: string
    expiresAt: number
  },
): D1PreparedStatement {
  return db.prepare(`
    INSERT INTO creator_share_import_undos (
      operation_id, undo_token_hash, user_id, target_stack_id, stack_item_id,
      action, previous_item_json, previous_binding_json, expected_item_json,
      expected_binding_json, summary, expires_at, version
    )
    SELECT operation.id, ?, operation.user_id, ?, ?, 'replaced', ?, ?, ?, ?, ?, ?, 1
    FROM share_import_operations operation
    WHERE operation.idempotency_key = ? AND operation.share_link_id = ?
      AND operation.user_id = ? AND operation.result_json = ?
      AND operation.target_stack_id = ?
      AND EXISTS (
        SELECT 1 FROM stack_items
        WHERE ${STACK_ITEM_EXACT_GUARD_SQL}
      )
      AND EXISTS (
        SELECT 1 FROM stack_item_link_bindings binding
        WHERE binding.stack_item_id = ? AND binding.shop_link_id = ?
          AND binding.resolution_kind = ? AND binding.affiliate_version_id IS ?
          AND binding.resolved_party_id IS ?
      )
  `).bind(
    input.undoTokenHash,
    input.targetStackId,
    input.stackItemId,
    JSON.stringify(input.previousItem),
    input.previousBinding ? JSON.stringify(input.previousBinding) : null,
    JSON.stringify(input.expectedItem),
    JSON.stringify(input.expectedBinding),
    input.summary,
    input.expiresAt,
    ...claimBindings(input.claim),
    input.targetStackId,
    ...itemGuardBindings(input.expectedItem),
    input.expectedBinding.stack_item_id,
    input.expectedBinding.shop_link_id,
    input.expectedBinding.resolution_kind,
    input.expectedBinding.affiliate_version_id,
    input.expectedBinding.resolved_party_id,
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

creatorSharingImport.post('/shares/:token/import/undo', async (c) => {
  const featureErr = ensureFeature(c)
  if (featureErr) return featureErr
  const authErr = await ensureAuth(c)
  if (authErr) return authErr
  const user = c.get('user')
  let body: Record<string, unknown>
  try {
    body = await c.req.json()
  } catch {
    return c.json({ error: 'Die Rückgängig-Anfrage ist ungültig.' }, 400)
  }
  const undoToken = boundedText(body.undo_token, 120)
  const expectedVersion = positiveInteger(body.expected_version)
  const expectedStackId = positiveInteger(body.expected_stack_id)
  const expectedStackItemId = positiveInteger(body.expected_stack_item_id)
  if (!undoToken || !/^undo_[a-f0-9-]{36}$/i.test(undoToken)
    || !expectedVersion || !expectedStackId || !expectedStackItemId) {
    return c.json({ error: 'Die Rückgängig-Anfrage ist ungültig.' }, 400)
  }
  const undoTokenHash = await sha256Hex(undoToken)
  const undo = await c.env.DB.prepare(`
    SELECT undo.*, stack.name AS stack_name
    FROM creator_share_import_undos undo
    JOIN share_import_operations operation ON operation.id = undo.operation_id
    JOIN share_links share ON share.id = operation.share_link_id
    JOIN stacks stack ON stack.id = undo.target_stack_id
    WHERE undo.undo_token_hash = ? AND undo.user_id = ? AND share.token = ?
      AND operation.user_id = undo.user_id
  `).bind(undoTokenHash, user.userId, c.req.param('token')).first<ImportUndoRow>()
  if (!undo) return c.json({ error: 'Diese Änderung kann nicht rückgängig gemacht werden.', code: 'UNDO_UNKNOWN' }, 404)
  if (undo.target_stack_id !== expectedStackId || undo.stack_item_id !== expectedStackItemId) {
    return c.json({ error: 'Die Rückgängig-Anfrage passt nicht mehr zum gespeicherten Stand.', code: 'UNDO_TARGET_CHANGED' }, 409)
  }
  if (undo.undone_at !== null) {
    return c.json({ error: 'Diese Änderung wurde bereits rückgängig gemacht.', code: 'UNDO_ALREADY_USED' }, 409)
  }
  if (undo.version !== expectedVersion) {
    return c.json({ error: 'Die Rückgängig-Anfrage passt nicht mehr zum gespeicherten Stand.', code: 'UNDO_TARGET_CHANGED' }, 409)
  }
  if (undo.expires_at <= Math.floor(Date.now() / 1000)) {
    return c.json({ error: 'Die kurze Rückgängig-Frist ist abgelaufen.', code: 'UNDO_EXPIRED' }, 410)
  }
  const previousItem = parseUndoItem(undo.previous_item_json)
  const expectedItem = parseUndoItem(undo.expected_item_json)
  const previousBinding = parseUndoBinding(undo.previous_binding_json, true)
  const expectedBinding = parseUndoBinding(undo.expected_binding_json, false)
  if (!previousItem || !expectedItem || previousBinding === null || !expectedBinding
    || previousItem.id !== undo.stack_item_id || expectedItem.id !== undo.stack_item_id
    || previousItem.stack_id !== undo.target_stack_id || expectedItem.stack_id !== undo.target_stack_id
    || expectedBinding.stack_item_id !== undo.stack_item_id
    || (previousBinding !== undefined && previousBinding.stack_item_id !== undo.stack_item_id)) {
    return c.json({ error: 'Der gespeicherte Rückgängig-Stand ist ungültig.', code: 'UNDO_INVALID' }, 409)
  }

  const writeClaimToken = `claim_${crypto.randomUUID()}`
  const claim = c.env.DB.prepare(`
    UPDATE creator_share_import_undos
    SET undone_at = CURRENT_TIMESTAMP, write_claim_token = ?, version = version + 1
    WHERE id = ? AND operation_id = ? AND user_id = ? AND action = 'replaced'
      AND target_stack_id = ? AND stack_item_id = ? AND version = ?
      AND undone_at IS NULL AND expires_at = ? AND expires_at > strftime('%s', 'now')
      AND EXISTS (
        SELECT 1 FROM stacks
        WHERE id = ? AND user_id = ? AND deleted_at IS NULL
      )
      AND EXISTS (
        SELECT 1 FROM stack_items
        WHERE ${STACK_ITEM_EXACT_GUARD_SQL}
      )
      AND EXISTS (
        SELECT 1 FROM stack_item_link_bindings binding
        WHERE binding.stack_item_id = ? AND binding.shop_link_id = ?
          AND binding.resolution_kind = ? AND binding.affiliate_version_id IS ?
          AND binding.resolved_party_id IS ?
      )
  `).bind(
    writeClaimToken,
    undo.id,
    undo.operation_id,
    user.userId,
    expectedStackId,
    expectedStackItemId,
    expectedVersion,
    undo.expires_at,
    expectedStackId,
    user.userId,
    ...itemGuardBindings(expectedItem),
    expectedBinding.stack_item_id,
    expectedBinding.shop_link_id,
    expectedBinding.resolution_kind,
    expectedBinding.affiliate_version_id,
    expectedBinding.resolved_party_id,
  )
  const restoredItem: StackItemUndoState = { ...previousItem, version: expectedItem.version + 1 }
  const restoreItem = c.env.DB.prepare(`
    UPDATE stack_items
    SET catalog_product_id = ?, user_product_id = ?, quantity = ?, dosage_text = ?,
      timing = ?, intake_interval_days = ?, sort_order = ?, source_share_link_id = ?,
      creator_statement_snapshot = ?, amount_source = ?, version = version + 1
    WHERE ${STACK_ITEM_EXACT_GUARD_SQL}
      AND EXISTS (
        SELECT 1 FROM creator_share_import_undos
        WHERE id = ? AND user_id = ? AND version = ?
          AND undone_at IS NOT NULL AND write_claim_token = ?
      )
  `).bind(
    previousItem.catalog_product_id,
    previousItem.user_product_id,
    previousItem.quantity,
    previousItem.dosage_text,
    previousItem.timing,
    previousItem.intake_interval_days,
    previousItem.sort_order,
    previousItem.source_share_link_id,
    previousItem.creator_statement_snapshot,
    previousItem.amount_source,
    ...itemGuardBindings(expectedItem),
    undo.id,
    user.userId,
    expectedVersion + 1,
    writeClaimToken,
  )
  const clearImportedBinding = c.env.DB.prepare(`
    DELETE FROM stack_item_link_bindings
    WHERE stack_item_id = ? AND shop_link_id = ? AND resolution_kind = ?
      AND affiliate_version_id IS ? AND resolved_party_id IS ?
      AND EXISTS (SELECT 1 FROM stack_items WHERE ${STACK_ITEM_EXACT_GUARD_SQL})
      AND EXISTS (
        SELECT 1 FROM creator_share_import_undos
        WHERE id = ? AND user_id = ? AND version = ?
          AND undone_at IS NOT NULL AND write_claim_token = ?
      )
  `).bind(
    expectedBinding.stack_item_id,
    expectedBinding.shop_link_id,
    expectedBinding.resolution_kind,
    expectedBinding.affiliate_version_id,
    expectedBinding.resolved_party_id,
    ...itemGuardBindings(restoredItem),
    undo.id,
    user.userId,
    expectedVersion + 1,
    writeClaimToken,
  )
  const statements: D1PreparedStatement[] = [claim, restoreItem, clearImportedBinding]
  if (previousBinding !== undefined) {
    statements.push(c.env.DB.prepare(`
      INSERT INTO stack_item_link_bindings (
        stack_item_id, shop_link_id, resolution_kind, affiliate_version_id,
        resolved_party_id, bound_at
      )
      SELECT ?, ?, ?, ?, ?, ?
      WHERE NOT EXISTS (
        SELECT 1 FROM stack_item_link_bindings WHERE stack_item_id = ?
      )
        AND EXISTS (SELECT 1 FROM stack_items WHERE ${STACK_ITEM_EXACT_GUARD_SQL})
        AND EXISTS (
          SELECT 1 FROM creator_share_import_undos
          WHERE id = ? AND user_id = ? AND version = ?
            AND undone_at IS NOT NULL AND write_claim_token = ?
        )
    `).bind(
      previousBinding.stack_item_id,
      previousBinding.shop_link_id,
      previousBinding.resolution_kind,
      previousBinding.affiliate_version_id,
      previousBinding.resolved_party_id,
      previousBinding.bound_at,
      previousBinding.stack_item_id,
      ...itemGuardBindings(restoredItem),
      undo.id,
      user.userId,
      expectedVersion + 1,
      writeClaimToken,
    ))
  }
  statements.push(undoPostconditionStatement(c.env.DB, {
    undo,
    userId: user.userId,
    expectedVersion,
    writeClaimToken,
    restoredItem,
    previousBinding,
  }))
  let batch: D1Result<unknown>[]
  try {
    batch = await c.env.DB.batch(statements)
  } catch {
    return c.json({ error: 'Die Änderung konnte nicht sicher rückgängig gemacht werden.', code: 'UNDO_TARGET_CHANGED' }, 409)
  }
  if (d1Changes(batch[0]) !== 1 || d1Changes(batch[1]) !== 1 || d1Changes(batch[2]) !== 1
    || (previousBinding !== undefined && d1Changes(batch[3]) !== 1)) {
    return c.json({ error: 'Dein Stack wurde inzwischen geändert. Deshalb wurde nichts rückgängig gemacht.', code: 'UNDO_TARGET_CHANGED' }, 409)
  }
  const receipt = await c.env.DB.prepare(`
    SELECT undone_at FROM creator_share_import_undos
    WHERE id = ? AND user_id = ? AND version = ? AND write_claim_token = ?
  `).bind(undo.id, user.userId, expectedVersion + 1, writeClaimToken).first<{ undone_at: string }>()
  if (!receipt?.undone_at) {
    return c.json({ error: 'Die Rückgängig-Bestätigung konnte nicht sicher gelesen werden.', code: 'UNDO_RECEIPT_MISSING' }, 409)
  }
  return c.json({
    ok: true,
    stack_id: expectedStackId,
    stack_name: undo.stack_name,
    summary: undo.summary,
    restored_summary: `Der vorherige Stand in „${undo.stack_name}“ wurde wiederhergestellt.`,
    undone_at: receipt.undone_at,
  })
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
    operationGuard(c.env.DB, {
      targetStackId: null,
      share: loaded.row,
      claim,
      relationSignature: preflight.relationSignature,
    }),
    c.env.DB.prepare(`
      INSERT INTO stacks (id, user_id, name, origin_party_id, last_opened_at)
      SELECT ?, ?, ?, ?, CURRENT_TIMESTAMP
      WHERE ${WRITE_CLAIM_SQL}
    `).bind(stackId, user.userId, plan.stackName, loaded.snapshot.creator_party_id, ...claimBindings(claim)),
  ]
  loaded.snapshot.items.forEach((item, index) => {
    statements.push(addSnapshotItem(c.env.DB, {
      itemId: itemIds[index],
      stackId,
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
    operationGuard(c.env.DB, {
      targetStackId: null,
      share: loaded.row,
      claim,
      relationSignature: preflight.relationSignature,
    }),
    c.env.DB.prepare(`
      INSERT INTO stacks (id, user_id, name, origin_party_id, last_opened_at)
      SELECT ?, ?, ?, ?, CURRENT_TIMESTAMP
      WHERE ${WRITE_CLAIM_SQL}
    `).bind(stackId, user.userId, plan.stackName, loaded.snapshot.creator_party_id, ...claimBindings(claim)),
    addSnapshotItem(c.env.DB, {
      itemId,
      stackId,
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
  const previous = await loadUndoState(
    c.env.DB,
    selected.stack_item_id,
    plan.stackId,
    user.userId,
    selected.version,
  )
  if (!previous) {
    return c.json({ error: 'Der Stack hat sich geändert. Bitte prüfe die Auswahl noch einmal.', code: 'PREFLIGHT_CHANGED' }, 409)
  }
  const undoToken = `undo_${crypto.randomUUID()}`
  const undoTokenHash = await sha256Hex(undoToken)
  const undoExpiresAt = Math.floor(Date.now() / 1000) + 10 * 60
  const rawUndoSummary = `${selected.comparison.product_name} wird in „${plan.stackName}“ wiederhergestellt. ${productName} wird von diesem Platz entfernt.`
  const undoSummary = rawUndoSummary.length <= 500 ? rawUndoSummary : `${rawUndoSummary.slice(0, 499)}…`
  const expectedItem: StackItemUndoState = {
    id: selected.stack_item_id,
    stack_id: plan.stackId,
    catalog_product_id: item.catalog_product_id,
    user_product_id: null,
    quantity: item.quantity,
    dosage_text: item.dosage_text,
    timing: item.timing,
    intake_interval_days: item.intake_interval_days,
    sort_order: previous.item.sort_order,
    source_share_link_id: loaded.row.id,
    creator_statement_snapshot: item.creator_statement,
    amount_source: 'creator_snapshot',
    version: selected.version + 1,
  }
  const expectedBinding: ExpectedStackItemBinding = {
    stack_item_id: selected.stack_item_id,
    shop_link_id: item.shop_link_id,
    resolution_kind: item.link_binding.resolution_kind,
    affiliate_version_id: item.link_binding.affiliate_version_id,
    resolved_party_id: item.link_binding.resolved_party_id,
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
    undo: {
      token: undoToken,
      expires_at: undoExpiresAt,
      version: 1,
      stack_id: plan.stackId,
      stack_item_id: selected.stack_item_id,
      summary: undoSummary,
    },
  }
  const claim = createWriteClaim(idempotencyKey, loaded.row.id, user.userId, result, attemptNonce)
  const statements = [
    operationGuard(c.env.DB, {
      targetStackId: plan.stackId,
      share: loaded.row,
      claim,
      relationSignature: preflight.relationSignature,
      targetState,
      expectedPreviousBinding: {
        stackItemId: selected.stack_item_id,
        binding: previous.binding,
      },
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
    undoMetadataStatement(c.env.DB, {
      claim,
      undoTokenHash,
      targetStackId: plan.stackId,
      stackItemId: selected.stack_item_id,
      previousItem: previous.item,
      previousBinding: previous.binding,
      expectedItem,
      expectedBinding,
      summary: undoSummary,
      expiresAt: undoExpiresAt,
    }),
    counterStatement(c.env.DB, loaded.row, claim),
  ]
  const execution = await executeBatch(c, statements, idempotencyKey, token)
  if (execution.replay) return c.json({ ...execution.replay, idempotent_replay: true })
  if (!execution.batch || d1Changes(execution.batch[0]) !== 1
    || d1Changes(execution.batch[1]) !== 1 || d1Changes(execution.batch[4]) !== 1) {
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
    relationSignature: preflight.relationSignature,
    targetState,
  })]
  statements.push(addSnapshotItem(c.env.DB, {
    itemId,
    stackId: plan.stackId,
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
