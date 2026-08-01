import { convertAmount, normalizeUnit } from './units'

export const MAX_PART_ROWS_PER_INGREDIENT = 30

const EXPLICIT_ID_TABLES = new Set([
  'products',
  'product_ingredients',
  'user_products',
  'user_product_ingredients',
])

export type IngredientPartInput = {
  part_id: number
  quantity: number | null
  unit: string | null
  basis_quantity: number | null
  basis_unit: string | null
  search_relevant: number
}

export type IngredientPartRead = IngredientPartInput & {
  id: number
  part_name: string
  part_type: string | null
  part_status: 'active' | 'inactive' | 'deprecated'
  sort_order: number
}

/**
 * D1 batch statements cannot pass `last_insert_rowid()` results to later
 * prepared statements. Reserving candidate ids before the batch lets the
 * parent and all nested part rows participate in the same transaction. A
 * concurrent allocation can only cause a PK conflict, which rolls the whole
 * batch back; it can never leave a half-written replacement behind.
 */
export async function reserveExplicitRowIds(
  db: D1Database,
  table: 'products' | 'product_ingredients' | 'user_products' | 'user_product_ingredients',
  count: number,
): Promise<number[]> {
  if (!EXPLICIT_ID_TABLES.has(table)) throw new Error('Unsupported explicit-id table.')
  if (!Number.isInteger(count) || count < 0 || count > 1000) throw new Error('Invalid explicit-id reservation count.')
  if (count === 0) return []
  const row = await db.prepare(`SELECT COALESCE(MAX(id), 0) AS max_id FROM ${table}`).first<{ max_id: number }>()
  const maxId = Number(row?.max_id ?? 0)
  if (!Number.isSafeInteger(maxId) || maxId < 0 || maxId + count > Number.MAX_SAFE_INTEGER) {
    throw new Error('Could not reserve safe database ids.')
  }
  return Array.from({ length: count }, (_, index) => maxId + index + 1)
}

type ParentAmount = {
  quantity: number | null
  unit: string | null
  basis_quantity: number | null
  basis_unit: string | null
}

type PartReferenceRow = {
  part_id: number
  status: 'active' | 'inactive' | 'deprecated'
}

type PartRow = IngredientPartRead & {
  parent_row_id: number
}

function own(value: Record<string, unknown>, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(value, key)
}

function positiveInteger(value: unknown): number | undefined {
  const parsed = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : Number.NaN
  return Number.isInteger(parsed) && parsed > 0 ? parsed : undefined
}

function optionalPositiveNumber(value: unknown): number | null | undefined {
  if (value === undefined || value === null || value === '') return null
  const parsed = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : Number.NaN
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined
}

function optionalText(value: unknown): string | null | undefined {
  if (value === undefined || value === null) return null
  if (typeof value !== 'string') return undefined
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

function booleanFlag(value: unknown): number | undefined {
  if (value === undefined) return 1
  if (value === true || value === 1) return 1
  if (value === false || value === 0) return 0
  return undefined
}

export function parseIngredientParts(
  value: unknown,
): { parts?: IngredientPartInput[]; error?: string } {
  if (value === undefined) return { parts: [] }
  if (!Array.isArray(value)) return { error: 'parts muss eine Liste sein.' }
  if (value.length > MAX_PART_ROWS_PER_INGREDIENT) {
    return { error: `Maximal ${MAX_PART_ROWS_PER_INGREDIENT} Sub-Wirkstoffe pro Wirkstoffzeile sind erlaubt.` }
  }

  const parts: IngredientPartInput[] = []
  const seen = new Set<number>()
  for (const raw of value) {
    if (!raw || typeof raw !== 'object') return { error: 'Ungültige Sub-Wirkstoffdaten.' }
    const row = raw as Record<string, unknown>
    const partId = positiveInteger(row.part_id)
    const quantity = optionalPositiveNumber(row.quantity)
    const unit = optionalText(row.unit)
    const basisQuantity = optionalPositiveNumber(row.basis_quantity)
    const basisUnit = optionalText(row.basis_unit)
    const searchRelevant = booleanFlag(row.search_relevant)

    if (partId === undefined) return { error: 'Jeder Sub-Wirkstoff braucht eine gültige part_id.' }
    if (seen.has(partId)) return { error: 'Doppelte Sub-Wirkstoffe sind innerhalb einer Wirkstoffzeile nicht erlaubt.' }
    if (quantity === undefined) return { error: 'Die Sub-Wirkstoffmenge muss größer als 0 sein.' }
    if (unit === undefined) return { error: 'Die Einheit des Sub-Wirkstoffs ist ungültig.' }
    if (basisQuantity === undefined) return { error: 'Die Bezugsmenge des Sub-Wirkstoffs muss größer als 0 sein.' }
    if (basisUnit === undefined) return { error: 'Die Bezugseinheit des Sub-Wirkstoffs ist ungültig.' }
    if ((quantity === null) !== (unit === null)) {
      return { error: 'Menge und Einheit eines Sub-Wirkstoffs müssen gemeinsam angegeben werden.' }
    }
    if ((basisQuantity === null) !== (basisUnit === null)) {
      return { error: 'Bezugsmenge und Bezugseinheit eines Sub-Wirkstoffs müssen gemeinsam angegeben werden.' }
    }
    if (searchRelevant === undefined) return { error: 'search_relevant muss true/false oder 1/0 sein.' }
    if (searchRelevant === 1 && (quantity === null || unit === null)) {
      return { error: 'Suchrelevante Sub-Wirkstoffe brauchen eine positive Menge und Einheit.' }
    }
    if (own(row, 'parent_ingredient_id') || own(row, 'ingredient_id')) {
      return { error: 'Sub-Wirkstoffe werden ausschließlich über part_id angegeben.' }
    }

    seen.add(partId)
    parts.push({
      part_id: partId,
      quantity,
      unit,
      basis_quantity: basisQuantity,
      basis_unit: basisUnit,
      search_relevant: searchRelevant,
    })
  }
  return { parts }
}

function normalizedBasisUnit(value: string | null): string | null {
  return value?.trim().toLocaleLowerCase('de-DE') ?? null
}

function sameEffectiveBasis(parent: ParentAmount, part: IngredientPartInput): boolean {
  const partQuantity = part.basis_quantity ?? parent.basis_quantity
  const partUnit = part.basis_unit ?? parent.basis_unit
  if (parent.basis_quantity === null || parent.basis_unit === null) {
    return partQuantity === null && partUnit === null
  }
  return partQuantity !== null
    && Math.abs(partQuantity - parent.basis_quantity) <= 1e-9
    && normalizedBasisUnit(partUnit) === normalizedBasisUnit(parent.basis_unit)
}

export function validatePartAmountSum(
  parent: ParentAmount,
  parts: IngredientPartInput[],
): string | null {
  if (parent.quantity === null || parent.unit === null || parts.length === 0) return null
  const parentUnit = normalizeUnit(parent.unit)
  if (parentUnit === null || parentUnit === 'IU') return null

  let comparableTotal = 0
  let comparableCount = 0
  for (const part of parts) {
    if (part.quantity === null || part.unit === null || !sameEffectiveBasis(parent, part)) continue
    const partUnit = normalizeUnit(part.unit)
    if (partUnit === null || partUnit === 'IU') continue
    const converted = convertAmount(part.quantity, part.unit, parent.unit)
    if (converted === null) continue
    comparableTotal += converted
    comparableCount += 1
  }

  const epsilon = Math.max(1e-9, Math.abs(parent.quantity) * 1e-9)
  if (comparableCount > 0 && comparableTotal > parent.quantity + epsilon) {
    return 'Die Summe vergleichbarer Sub-Wirkstoffmengen darf die Hauptmenge nicht überschreiten.'
  }
  return null
}

export async function validateIngredientPartReferences(
  db: D1Database,
  ingredientId: number,
  parts: IngredientPartInput[],
  options: { requireActive: boolean } = { requireActive: true },
): Promise<string | null> {
  if (parts.length === 0) return null
  const ids = parts.map((part) => part.part_id)
  const placeholders = ids.map(() => '?').join(', ')
  const { results } = await db.prepare(`
    SELECT l.part_id, p.status
    FROM ingredient_part_links l
    JOIN ingredient_parts p ON p.id = l.part_id
    WHERE l.ingredient_id = ?
      AND l.part_id IN (${placeholders})
  `).bind(ingredientId, ...ids).all<PartReferenceRow>()
  const references = new Map((results ?? []).map((row) => [row.part_id, row.status]))
  for (const part of parts) {
    const status = references.get(part.part_id)
    if (!status) return 'Mindestens ein Sub-Wirkstoff ist nicht mit dem Hauptwirkstoff verknüpft.'
    if (options.requireActive && status !== 'active') {
      return 'Inaktive oder veraltete Sub-Wirkstoffe können nicht neu gespeichert werden.'
    }
  }
  return null
}

export async function loadIngredientPartsByParentRows(
  db: D1Database,
  table: 'product_ingredient_parts' | 'user_product_ingredient_parts',
  parentColumn: 'product_ingredient_id' | 'user_product_ingredient_id',
  parentRowIds: number[],
  options: { publicOnly?: boolean } = {},
): Promise<Map<number, IngredientPartRead[]>> {
  const uniqueIds = [...new Set(parentRowIds.filter((id) => Number.isInteger(id) && id > 0))]
  const byParent = new Map<number, IngredientPartRead[]>()
  if (uniqueIds.length === 0) return byParent
  const placeholders = uniqueIds.map(() => '?').join(', ')
  const statusPredicate = options.publicOnly ? "AND p.status = 'active'" : ''
  const { results } = await db.prepare(`
    SELECT
      pp.id,
      pp.${parentColumn} AS parent_row_id,
      pp.part_id,
      pp.quantity,
      pp.unit,
      pp.basis_quantity,
      pp.basis_unit,
      pp.search_relevant,
      p.name AS part_name,
      p.type AS part_type,
      p.status AS part_status,
      l.sort_order
    FROM ${table} pp
    JOIN ingredient_parts p ON p.id = pp.part_id
    JOIN ingredient_part_links l
      ON l.part_id = pp.part_id
     AND l.ingredient_id = (
       SELECT parent_row.ingredient_id
       FROM ${table === 'product_ingredient_parts' ? 'product_ingredients' : 'user_product_ingredients'} parent_row
       WHERE parent_row.id = pp.${parentColumn}
     )
    WHERE pp.${parentColumn} IN (${placeholders})
      ${statusPredicate}
    ORDER BY pp.${parentColumn} ASC, l.sort_order ASC, p.name ASC, pp.id ASC
  `).bind(...uniqueIds).all<PartRow>()
  for (const row of results ?? []) {
    const list = byParent.get(row.parent_row_id) ?? []
    const { parent_row_id: _parentRowId, ...part } = row
    list.push(part)
    byParent.set(row.parent_row_id, list)
  }
  return byParent
}

export function buildIngredientPartInsert(
  db: D1Database,
  table: 'product_ingredient_parts' | 'user_product_ingredient_parts',
  parentColumn: 'product_ingredient_id' | 'user_product_ingredient_id',
  parentRowId: number,
  part: IngredientPartInput,
): D1PreparedStatement {
  return db.prepare(`
    INSERT INTO ${table} (
      ${parentColumn}, part_id, quantity, unit, basis_quantity, basis_unit, search_relevant
    ) VALUES (?, ?, ?, ?, ?, ?, ?)
  `).bind(
    parentRowId,
    part.part_id,
    part.quantity,
    part.unit,
    part.basis_quantity,
    part.basis_unit,
    part.search_relevant,
  )
}

export async function reserveIntegerIds(
  db: D1Database,
  table: 'products' | 'product_ingredients' | 'user_products' | 'user_product_ingredients' | 'ingredient_parts',
  count: number,
): Promise<number[]> {
  if (!Number.isInteger(count) || count < 0) throw new Error('count must be a non-negative integer')
  if (count === 0) return []
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
