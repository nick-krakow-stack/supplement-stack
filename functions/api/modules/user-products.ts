// ---------------------------------------------------------------------------
// User products module
// Routes (mounted at /api/user-products):
//   GET /       - list authenticated user's products
//   POST /      - create user product
//   PUT /:id    - update own user product
//   DELETE /:id - delete own user product
// ---------------------------------------------------------------------------

import { Hono } from 'hono'
import type { AppContext } from '../lib/types'
import { checkRateLimit, ensureAuth } from '../lib/helpers'
import { loadUserProductSafetyWarnings } from './knowledge'
import {
  buildIngredientPartInsert,
  loadIngredientPartsByParentRows,
  parseIngredientParts,
  reserveIntegerIds,
  validateIngredientPartReferences,
  validatePartAmountSum,
  type IngredientPartInput,
} from '../lib/ingredient-parts'

const userProducts = new Hono<AppContext>()

const MAX_USER_PRODUCT_INGREDIENT_ROWS = 50

type UserProductIngredientInput = {
  ingredient_id: number
  form_id: number | null
  quantity: number | null
  unit: string | null
  basis_quantity: number | null
  basis_unit: string | null
  search_relevant: number
  is_main: boolean
  parts: IngredientPartInput[]
}

function parseJsonBodyError(): Response {
  return new Response(JSON.stringify({ error: 'Die Angaben konnten nicht gelesen werden. Bitte versuche es erneut.' }), {
    status: 400,
    headers: { 'Content-Type': 'application/json' },
  })
}

function normalizeOptionalText(value: unknown): string | null | undefined {
  if (value === undefined) return undefined
  if (value === null) return null
  return typeof value === 'string' ? value.trim() : undefined
}

function normalizeOptionalPositiveNumber(value: unknown): number | undefined {
  if (value === undefined) return undefined
  if (value === null || value === '') return undefined
  const parsed = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : Number.NaN
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined
}

function normalizeOptionalPositiveInteger(value: unknown): number | undefined {
  const parsed = normalizeOptionalPositiveNumber(value)
  return parsed !== undefined && Number.isInteger(parsed) ? parsed : undefined
}

function normalizeOptionalPositiveIntegerOrNull(value: unknown): number | null | undefined {
  if (value === undefined) return undefined
  if (value === null || value === '') return null
  const parsed = normalizeOptionalPositiveInteger(value)
  return parsed === undefined ? undefined : parsed
}

function normalizeOptionalPositiveNumberOrNull(value: unknown): number | null | undefined {
  if (value === undefined) return undefined
  if (value === null || value === '') return null
  const parsed = normalizeOptionalPositiveNumber(value)
  return parsed === undefined ? undefined : parsed
}

function hasOwnKey(data: Record<string, unknown>, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(data, key)
}

function expectedVersionFrom(body: Record<string, unknown>): number | undefined {
  return normalizeOptionalPositiveInteger(body.expected_version)
}

function requireNonEmptyText(body: Record<string, unknown>, key: string): string | undefined {
  const value = normalizeOptionalText(body[key])
  return typeof value === 'string' && value.length > 0 ? value : undefined
}

function normalizeSearchRelevant(value: unknown): number | undefined {
  if (value === undefined) return 1
  if (value === true || value === 1) return 1
  if (value === false || value === 0) return 0
  return undefined
}

function validateIngredients(value: unknown): { ingredients?: UserProductIngredientInput[]; error?: string } {
  if (!Array.isArray(value) || value.length === 0) {
    return { error: 'Mindestens ein Wirkstoff ist erforderlich.' }
  }
  if (value.length > MAX_USER_PRODUCT_INGREDIENT_ROWS) {
    return { error: `Maximal ${MAX_USER_PRODUCT_INGREDIENT_ROWS} Wirkstoffzeilen sind erlaubt.` }
  }

  const ingredients: UserProductIngredientInput[] = []

  for (const row of value) {
    if (!row || typeof row !== 'object') return { error: 'Mindestens ein Wirkstoffeintrag ist unvollständig.' }
    const ingredient = row as Record<string, unknown>
    const ingredientId = normalizeOptionalPositiveInteger(ingredient.ingredient_id)
    const formId = normalizeOptionalPositiveIntegerOrNull(ingredient.form_id)
    const quantity = normalizeOptionalPositiveNumberOrNull(ingredient.quantity)
    const unit = normalizeOptionalText(ingredient.unit)
    const basisQuantity = normalizeOptionalPositiveNumberOrNull(ingredient.basis_quantity)
    const basisUnit = normalizeOptionalText(ingredient.basis_unit)
    const searchRelevant = normalizeSearchRelevant(ingredient.search_relevant)
    const partsResult = parseIngredientParts(ingredient.parts)
    const isMain = ingredient.is_main === true || ingredient.is_main === 1

    if (ingredientId === undefined) return { error: 'Wähle für jeden Eintrag einen Wirkstoff aus.' }
    if (formId === undefined && hasOwnKey(ingredient, 'form_id')) return { error: 'Die gewählte Wirkstoffform ist ungültig. Bitte wähle sie erneut aus.' }
    if (quantity === undefined && hasOwnKey(ingredient, 'quantity')) return { error: 'Die Wirkstoffmenge muss größer als 0 sein oder leer bleiben.' }
    if ((unit === undefined || unit === '') && hasOwnKey(ingredient, 'unit')) return { error: 'Wähle eine Einheit für die Wirkstoffmenge aus.' }
    if (basisQuantity === undefined && hasOwnKey(ingredient, 'basis_quantity')) return { error: 'Die Bezugsmenge muss größer als 0 sein.' }
    if (hasOwnKey(ingredient, 'parent_ingredient_id')) return { error: 'Die Wirkstoffteile sind veraltet gespeichert. Bitte wähle den Hauptwirkstoff erneut aus.' }
    if (partsResult.error || !partsResult.parts) return { error: partsResult.error ?? 'Ungültige Sub-Wirkstoffdaten.' }
    if (searchRelevant === undefined) return { error: 'Die Einstellung für die Wirkstoffsuche ist ungültig.' }

    const finalQuantity = quantity ?? null
    const finalUnit = unit ?? null
    const finalBasisQuantity = basisQuantity ?? null
    const finalBasisUnit = basisUnit ?? null
    if ((finalQuantity === null) !== (finalUnit === null)) {
      return { error: 'Wirkstoffmenge und Einheit müssen gemeinsam angegeben werden.' }
    }
    if ((finalBasisQuantity === null) !== (finalBasisUnit === null)) {
      return { error: 'Bezugsmenge und Bezugseinheit müssen gemeinsam angegeben werden.' }
    }

    ingredients.push({
      ingredient_id: ingredientId,
      form_id: formId ?? null,
      quantity: finalQuantity,
      unit: finalUnit,
      basis_quantity: finalBasisQuantity,
      basis_unit: finalBasisUnit,
      search_relevant: searchRelevant,
      is_main: isMain,
      parts: partsResult.parts,
    })
  }

  return { ingredients }
}

async function validateUserProductIngredientReferences(
  db: D1Database,
  ingredients: UserProductIngredientInput[],
): Promise<string | null> {
  if (ingredients.length === 0) return null

  const ingredientIds = [...new Set(ingredients.map((row) => row.ingredient_id))]
  const ingredientPlaceholders = ingredientIds.map(() => '?').join(',')
  const ingredientCount = await db.prepare(
    `SELECT COUNT(*) as count FROM ingredients WHERE id IN (${ingredientPlaceholders})`
  ).bind(...ingredientIds).first<{ count: number }>()
  if ((ingredientCount?.count ?? 0) !== ingredientIds.length) {
    return 'Mindestens ein Wirkstoff existiert nicht.'
  }

  const formRows = ingredients.filter((row) => row.form_id !== null)
  if (formRows.length > 0) {
    const formIds = [...new Set(formRows.map((row) => row.form_id as number))]
    const formPlaceholders = formIds.map(() => '?').join(',')
    const { results: forms } = await db.prepare(
      `SELECT id, ingredient_id FROM ingredient_forms WHERE id IN (${formPlaceholders})`
    ).bind(...formIds).all<{ id: number; ingredient_id: number }>()
    const formMap = new Map(forms.map((row) => [row.id, row.ingredient_id]))
    for (const row of formRows) {
      if (formMap.get(row.form_id as number) !== row.ingredient_id) {
        return 'Mindestens eine gewählte Form passt nicht zum Wirkstoff. Bitte wähle sie erneut aus.'
      }
    }
  }

  for (const row of ingredients) {
    const referenceError = await validateIngredientPartReferences(db, row.ingredient_id, row.parts, { requireActive: true })
    if (referenceError) return referenceError
    const amountError = validatePartAmountSum(row, row.parts)
    if (amountError) return amountError
  }

  return null
}

async function attachIngredients(
  db: D1Database,
  products: Record<string, unknown>[],
): Promise<Array<Record<string, unknown> & { ingredients: unknown[] }>> {
  if (products.length === 0) return []
  const ids = products
    .map((product) => Number(product.id))
    .filter((id) => Number.isInteger(id) && id > 0)
  if (ids.length === 0) return products.map((product) => ({ ...product, ingredients: [] }))

  const placeholders = ids.map(() => '?').join(',')
  const { results: rows } = await db.prepare(`
    SELECT upi.*, i.name as ingredient_name, i.unit as ingredient_unit
    FROM user_product_ingredients upi
    JOIN ingredients i ON i.id = upi.ingredient_id
    WHERE upi.user_product_id IN (${placeholders})
    ORDER BY upi.user_product_id ASC, upi.is_main DESC, upi.search_relevant DESC, upi.id ASC
  `).bind(...ids).all<Record<string, unknown>>()

  const rowIds = rows.map((row) => Number(row.id)).filter((id) => Number.isInteger(id) && id > 0)
  const partsByRow = await loadIngredientPartsByParentRows(
    db,
    'user_product_ingredient_parts',
    'user_product_ingredient_id',
    rowIds,
    { publicOnly: false },
  )
  const byProduct = new Map<number, Record<string, unknown>[]>()
  for (const row of rows) {
    const productId = Number(row.user_product_id)
    const list = byProduct.get(productId) ?? []
    list.push({ ...row, parts: partsByRow.get(Number(row.id)) ?? [] })
    byProduct.set(productId, list)
  }

  const warningsByProduct = await loadUserProductSafetyWarnings(db, ids)

  return products.map((product) => ({
    ...product,
    ingredients: byProduct.get(Number(product.id)) ?? [],
    warnings: warningsByProduct.get(Number(product.id)) ?? [],
  }))
}

function buildUserProductIngredientStatements(
  db: D1Database,
  userProductId: number | string,
  parentRowId: number,
  ingredient: UserProductIngredientInput,
  writeGuard?: { claimToken: string; userId: number; status: string; version: number },
): D1PreparedStatement[] {
  const insertSql = writeGuard ? `
    INSERT INTO user_product_ingredients (
      id, user_product_id, ingredient_id, form_id, quantity, unit,
      basis_quantity, basis_unit, search_relevant, parent_ingredient_id, is_main
    )
    SELECT ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?
    WHERE EXISTS (
      SELECT 1 FROM user_products
      WHERE id = ? AND user_id = ? AND status = ? AND version = ? AND write_claim_token = ?
    )
  ` : `
    INSERT INTO user_product_ingredients (
      id, user_product_id, ingredient_id, form_id, quantity, unit,
      basis_quantity, basis_unit, search_relevant, parent_ingredient_id, is_main
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?)
  `
  const bindings: unknown[] = [
    parentRowId,
    userProductId,
    ingredient.ingredient_id,
    ingredient.form_id,
    ingredient.quantity,
    ingredient.unit,
    ingredient.basis_quantity,
    ingredient.basis_unit,
    ingredient.search_relevant,
    ingredient.is_main ? 1 : 0,
  ]
  if (writeGuard) {
    bindings.push(
      userProductId,
      writeGuard.userId,
      writeGuard.status,
      writeGuard.version,
      writeGuard.claimToken,
    )
  }
  const statements = [db.prepare(insertSql).bind(...bindings)]
  statements.push(...ingredient.parts.map((part) => writeGuard
    ? db.prepare(`
        INSERT INTO user_product_ingredient_parts (
          user_product_ingredient_id, part_id, quantity, unit,
          basis_quantity, basis_unit, search_relevant
        )
        SELECT ?, ?, ?, ?, ?, ?, ?
        WHERE EXISTS (
          SELECT 1
          FROM user_product_ingredients parent
          JOIN user_products product ON product.id = parent.user_product_id
          WHERE parent.id = ?
            AND parent.user_product_id = ?
            AND product.id = ?
            AND product.user_id = ?
            AND product.status = ?
            AND product.version = ?
            AND product.write_claim_token = ?
        )
      `).bind(
        parentRowId,
        part.part_id,
        part.quantity,
        part.unit,
        part.basis_quantity,
        part.basis_unit,
        part.search_relevant,
        parentRowId,
        userProductId,
        userProductId,
        writeGuard.userId,
        writeGuard.status,
        writeGuard.version,
        writeGuard.claimToken,
      )
    : buildIngredientPartInsert(
        db,
        'user_product_ingredient_parts',
        'user_product_ingredient_id',
        parentRowId,
        part,
      )))
  return statements
}

async function candidateUserProductIngredientIds(db: D1Database, count: number): Promise<number[]> {
  if (!Number.isInteger(count) || count < 0) throw new Error('Invalid user product ingredient id count')
  if (count === 0) return []
  const row = await db.prepare(`
    SELECT MAX(
      COALESCE((SELECT seq FROM sqlite_sequence WHERE name = 'user_product_ingredients'), 0),
      COALESCE((SELECT MAX(id) FROM user_product_ingredients), 0)
    ) + 1 AS first_id
  `).first<{ first_id: number }>()
  const first = Number(row?.first_id)
  const last = first + count - 1
  if (!Number.isSafeInteger(first) || first <= 0 || !Number.isSafeInteger(last)) {
    throw new Error('Could not generate user product ingredient ids')
  }
  return Array.from({ length: count }, (_, index) => first + index)
}

type UserProductStatusHistoryRow = {
  user_product_id: number
  moderation_status: string
  visibility: 'private' | 'public'
  note: string | null
  created_at: string
}

type UserProductStackUsageRow = {
  user_product_id: number
  stack_item_id: number
  stack_id: number
  stack_name: string
  quantity: number
  dosage_text: string | null
  intake_interval_days: number | null
}

async function attachUserProductContext(
  db: D1Database,
  userId: number,
  products: Record<string, unknown>[],
): Promise<Array<Record<string, unknown> & { ingredients: unknown[] }>> {
  const enriched = await attachIngredients(db, products)
  if (enriched.length === 0) return enriched

  const ids = enriched
    .map((product) => Number(product.id))
    .filter((id) => Number.isSafeInteger(id) && id > 0)
  if (ids.length === 0) return enriched
  const placeholders = ids.map(() => '?').join(',')

  const [{ results: historyRows }, { results: usageRows }] = await Promise.all([
    db.prepare(`
      SELECT user_product_id, moderation_status, visibility, note, created_at
      FROM user_product_status_history
      WHERE user_product_id IN (${placeholders})
      ORDER BY created_at DESC, id DESC
    `).bind(...ids).all<UserProductStatusHistoryRow>(),
    db.prepare(`
      SELECT
        si.user_product_id,
        si.id AS stack_item_id,
        s.id AS stack_id,
        s.name AS stack_name,
        si.quantity,
        si.dosage_text,
        si.intake_interval_days
      FROM stack_items si
      JOIN stacks s ON s.id = si.stack_id
      WHERE s.user_id = ?
        AND s.deleted_at IS NULL
        AND si.user_product_id IN (${placeholders})
      ORDER BY s.name COLLATE NOCASE ASC, s.id ASC, si.id ASC
    `).bind(userId, ...ids).all<UserProductStackUsageRow>(),
  ])

  const historyByProduct = new Map<number, UserProductStatusHistoryRow[]>()
  for (const row of historyRows ?? []) {
    const rows = historyByProduct.get(row.user_product_id) ?? []
    rows.push(row)
    historyByProduct.set(row.user_product_id, rows)
  }
  const usageByProduct = new Map<number, UserProductStackUsageRow[]>()
  for (const row of usageRows ?? []) {
    const rows = usageByProduct.get(row.user_product_id) ?? []
    rows.push(row)
    usageByProduct.set(row.user_product_id, rows)
  }

  return enriched.map((product) => {
    const publicProduct = { ...product }
    delete publicProduct.write_claim_token
    return {
      ...publicProduct,
      visibility: product.published_product_id == null ? 'private' : 'public',
      status_history: historyByProduct.get(Number(product.id)) ?? [],
      stack_usage: usageByProduct.get(Number(product.id)) ?? [],
    }
  })
}

// GET /api/user-products
userProducts.get('/', async (c) => {
  const authErr = await ensureAuth(c)
  if (authErr) return authErr
  const user = c.get('user')
  const { results } = await c.env.DB.prepare(
    'SELECT * FROM user_products WHERE user_id = ? ORDER BY created_at DESC'
  ).bind(user.userId).all()
  const products = await attachUserProductContext(c.env.DB, user.userId, results as Record<string, unknown>[])
  return c.json({ products })
})

// POST /api/user-products
userProducts.post('/', async (c) => {
  const authErr = await ensureAuth(c)
  if (authErr) return authErr
  const user = c.get('user')
  const allowed = await checkRateLimit(c.env.RATE_LIMITER, `user-products:create:${user.userId}`, 10, 60 * 60)
  if (!allowed) return c.json({ error: 'Zu viele Produktanlagen. Bitte warte kurz.' }, 429)

  let body: Record<string, unknown>
  try {
    body = await c.req.json()
  } catch {
    return parseJsonBodyError()
  }
  const name = normalizeOptionalText(body.name)
  if (typeof name !== 'string' || name.length === 0) return c.json({ error: 'Bitte gib einen Produktnamen ein.' }, 400)
  const brand = requireNonEmptyText(body, 'brand')
  if (!brand) return c.json({ error: 'Bitte gib die Marke oder den Hersteller ein.' }, 400)
  const form = requireNonEmptyText(body, 'form')
  if (!form) return c.json({ error: 'Bitte wähle die Produktform aus.' }, 400)
  const price = normalizeOptionalPositiveNumber(body.price)
  if (price === undefined) return c.json({ error: 'Bitte gib einen Packungspreis größer als 0 ein.' }, 400)
  const servingSize = normalizeOptionalPositiveNumber(body.serving_size)
  if (servingSize === undefined) return c.json({ error: 'Bitte gib an, aus wie vielen Einheiten eine Portion besteht.' }, 400)
  const servingUnit = requireNonEmptyText(body, 'serving_unit')
  if (!servingUnit) return c.json({ error: 'Bitte wähle die Einheit der Portion aus.' }, 400)
  const servingsPerContainer = normalizeOptionalPositiveInteger(body.servings_per_container)
  if (servingsPerContainer === undefined) return c.json({ error: 'Bitte gib eine ganze Anzahl Portionen pro Behälter ein.' }, 400)
  const containerCount = normalizeOptionalPositiveInteger(body.container_count)
  if (containerCount === undefined) return c.json({ error: 'Bitte gib eine ganze Anzahl Behälter in der Packung ein.' }, 400)
  const data = {
    name,
    brand,
    form,
    price,
    shop_link: normalizeOptionalText(body.shop_link),
    image_url: normalizeOptionalText(body.image_url),
    serving_size: servingSize,
    serving_unit: servingUnit,
    servings_per_container: servingsPerContainer,
    container_count: containerCount,
    is_affiliate: body.is_affiliate === 1 || body.is_affiliate === true ? 1 : 0,
    notes: normalizeOptionalText(body.notes),
  }
  const shopLinkProvided = hasOwnKey(body, 'shop_link')
  const notesProvided = hasOwnKey(body, 'notes')
  if (shopLinkProvided && data.shop_link === undefined) {
    return c.json({ error: 'Der Shop-Link muss Text sein oder leer bleiben.' }, 400)
  }
  if (notesProvided && data.notes === undefined) {
    return c.json({ error: 'Die persönliche Notiz muss Text sein oder leer bleiben.' }, 400)
  }
  const shopLinkValue = data.shop_link ? data.shop_link : null
  const notesValue = data.notes ? data.notes : null
  const ingredientsValidation = hasOwnKey(body, 'ingredients')
    ? validateIngredients(body.ingredients)
    : { ingredients: undefined }
  if (ingredientsValidation.error) return c.json({ error: ingredientsValidation.error }, 400)
  const ingredients = ingredientsValidation.ingredients ?? []
  const ingredientReferenceError = await validateUserProductIngredientReferences(c.env.DB, ingredients)
  if (ingredientReferenceError) return c.json({ error: ingredientReferenceError }, 400)
  const submitter = await c.env.DB.prepare(
    'SELECT is_trusted_product_submitter, is_blocked_product_submitter FROM users WHERE id = ?'
  ).bind(user.userId).first<{ is_trusted_product_submitter: number; is_blocked_product_submitter: number | null }>()
  const blockedSubmitter = submitter?.is_blocked_product_submitter === 1
  const autoApproved = submitter?.is_trusted_product_submitter === 1
  const status = blockedSubmitter ? 'blocked' : autoApproved ? 'approved' : 'pending'
  const [userProductId] = await reserveIntegerIds(c.env.DB, 'user_products', 1)
  const ingredientRowIds = await reserveIntegerIds(c.env.DB, 'user_product_ingredients', ingredients.length)
  const statements: D1PreparedStatement[] = [c.env.DB.prepare(`
    INSERT INTO user_products (
      id, user_id, name, brand, form, price, shop_link, image_url,
      serving_size, serving_unit, servings_per_container, container_count,
      is_affiliate, notes, status, approved_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    userProductId,
    user.userId,
    data.name,
    data.brand,
    data.form,
    data.price,
    shopLinkValue,
    data.image_url ?? null,
    data.serving_size,
    data.serving_unit,
    data.servings_per_container,
    data.container_count,
    data.is_affiliate ?? 0,
    notesValue,
    status,
    autoApproved ? new Date().toISOString() : null,
  )]
  ingredients.forEach((ingredient, index) => {
    statements.push(...buildUserProductIngredientStatements(c.env.DB, userProductId, ingredientRowIds[index], ingredient))
  })
  await c.env.DB.batch(statements)
  const created = await c.env.DB.prepare('SELECT * FROM user_products WHERE id = ?')
    .bind(userProductId)
    .first<Record<string, unknown>>()
  const product = created ? (await attachUserProductContext(c.env.DB, user.userId, [created]))[0] : null
  return c.json({ id: userProductId, product }, 201)
})

// PUT /api/user-products/:id
userProducts.put('/:id', async (c) => {
  const authErr = await ensureAuth(c)
  if (authErr) return authErr
  const user = c.get('user')
  const id = c.req.param('id')
  const existing = await c.env.DB.prepare(
    'SELECT id, status, published_product_id, version FROM user_products WHERE id = ? AND user_id = ?'
  ).bind(id, user.userId).first<{ id: number; status: string; published_product_id: number | null; version: number }>()
  if (!existing) return c.json({ error: 'Dieses Produkt wurde nicht gefunden.' }, 404)
  if (existing.status === 'approved' || existing.published_product_id !== null) {
    const error = existing.published_product_id == null
      ? 'Dieses private Original wurde bereits geprüft und kann nicht mehr direkt geändert werden. Erstelle bitte eine bearbeitbare Kopie.'
      : 'Das öffentliche Original bleibt unverändert. Erstelle für Änderungen bitte eine bearbeitbare Kopie.'
    return c.json({ error }, 409)
  }

  let body: Record<string, unknown>
  try {
    body = await c.req.json()
  } catch {
    return parseJsonBodyError()
  }
  const expectedVersion = expectedVersionFrom(body)
  if (expectedVersion === undefined || !hasOwnKey(body, 'expected_version')) {
    return c.json({ error: 'Die erwartete Produktversion fehlt oder ist ungültig. Bitte lade das Produkt neu.' }, 400)
  }
  if (existing.version !== expectedVersion) {
    return c.json({
      error: 'Das Produkt wurde zwischenzeitlich geändert. Bitte lade es neu.',
      current_version: existing.version,
    }, 409)
  }
  const name = normalizeOptionalText(body.name)
  if (hasOwnKey(body, 'name') && (!name || name.length === 0)) return c.json({ error: 'Bitte gib einen Produktnamen ein.' }, 400)
  const brand = normalizeOptionalText(body.brand)
  if (hasOwnKey(body, 'brand') && (!brand || brand.length === 0)) return c.json({ error: 'Bitte gib die Marke oder den Hersteller ein.' }, 400)
  const form = normalizeOptionalText(body.form)
  if (hasOwnKey(body, 'form') && (!form || form.length === 0)) return c.json({ error: 'Bitte wähle die Produktform aus.' }, 400)
  const servingUnit = normalizeOptionalText(body.serving_unit)
  if (hasOwnKey(body, 'serving_unit') && (!servingUnit || servingUnit.length === 0)) return c.json({ error: 'Bitte wähle die Einheit der Portion aus.' }, 400)
  const price = normalizeOptionalPositiveNumber(body.price)
  const servingSize = normalizeOptionalPositiveNumber(body.serving_size)
  const servingsPerContainer = normalizeOptionalPositiveInteger(body.servings_per_container)
  const containerCount = normalizeOptionalPositiveInteger(body.container_count)
  if (
    (hasOwnKey(body, 'price') && price === undefined) ||
    (hasOwnKey(body, 'serving_size') && servingSize === undefined) ||
    (hasOwnKey(body, 'servings_per_container') && servingsPerContainer === undefined) ||
    (hasOwnKey(body, 'container_count') && containerCount === undefined)
  ) {
    return c.json({ error: 'Preis, Portionsgröße, Portionen pro Behälter und Behälteranzahl müssen größer als 0 sein.' }, 400)
  }
  const data = {
    name,
    brand,
    form,
    price,
    shop_link: normalizeOptionalText(body.shop_link),
    image_url: normalizeOptionalText(body.image_url),
    serving_size: servingSize,
    serving_unit: servingUnit,
    servings_per_container: servingsPerContainer,
    container_count: containerCount,
    is_affiliate: body.is_affiliate === undefined ? undefined : body.is_affiliate === 1 || body.is_affiliate === true ? 1 : 0,
    notes: normalizeOptionalText(body.notes),
  }
  const shopLinkProvided = hasOwnKey(body, 'shop_link')
  const notesProvided = hasOwnKey(body, 'notes')
  if (shopLinkProvided && data.shop_link === undefined) {
    return c.json({ error: 'Der Shop-Link muss Text sein oder leer bleiben.' }, 400)
  }
  if (notesProvided && data.notes === undefined) {
    return c.json({ error: 'Die persönliche Notiz muss Text sein oder leer bleiben.' }, 400)
  }
  const shopLinkValue = data.shop_link ? data.shop_link : null
  const notesValue = data.notes ? data.notes : null
  const ingredientsValidation = hasOwnKey(body, 'ingredients')
    ? validateIngredients(body.ingredients)
    : { ingredients: undefined }
  if (ingredientsValidation.error) return c.json({ error: ingredientsValidation.error }, 400)
  if (ingredientsValidation.ingredients) {
    const ingredientReferenceError = await validateUserProductIngredientReferences(c.env.DB, ingredientsValidation.ingredients)
    if (ingredientReferenceError) return c.json({ error: ingredientReferenceError }, 400)
  }
  const submitter = await c.env.DB.prepare(
    'SELECT is_trusted_product_submitter, is_blocked_product_submitter FROM users WHERE id = ?'
  ).bind(user.userId).first<{ is_trusted_product_submitter: number; is_blocked_product_submitter: number | null }>()
  const blockedSubmitter = submitter?.is_blocked_product_submitter === 1
  const autoApproved = submitter?.is_trusted_product_submitter === 1
  const status = blockedSubmitter ? 'blocked' : autoApproved ? 'approved' : 'pending'
  const claimedVersion = expectedVersion + 1
  if (!Number.isSafeInteger(claimedVersion)) {
    return c.json({ error: 'Die Produktversion ist ungültig. Bitte lade das Produkt neu.' }, 409)
  }
  const claimToken = crypto.randomUUID()
  const imageUrlProvided = hasOwnKey(body, 'image_url')
  const imageUrlValue = data.image_url === '' ? null : data.image_url ?? null
  const updateStatement = c.env.DB.prepare(`
    UPDATE user_products SET
      name = COALESCE(?, name),
      brand = COALESCE(?, brand),
      form = COALESCE(?, form),
      price = COALESCE(?, price),
      shop_link = CASE WHEN ? THEN ? ELSE shop_link END,
      image_url = CASE WHEN ? THEN ? ELSE image_url END,
      serving_size = COALESCE(?, serving_size),
      serving_unit = COALESCE(?, serving_unit),
      servings_per_container = COALESCE(?, servings_per_container),
      container_count = COALESCE(?, container_count),
      is_affiliate = COALESCE(?, is_affiliate),
      notes = CASE WHEN ? THEN ? ELSE notes END,
      status = ?,
      approved_at = CASE WHEN ? THEN COALESCE(approved_at, datetime('now')) ELSE NULL END,
      review_note = NULL,
      version = version + 1,
      write_claim_token = ?
    WHERE id = ? AND user_id = ? AND status = ? AND version = ?
  `).bind(
    data.name ?? null, data.brand ?? null, data.form ?? null, data.price ?? null,
    shopLinkProvided ? 1 : 0, shopLinkValue, imageUrlProvided ? 1 : 0, imageUrlValue,
    data.serving_size ?? null, data.serving_unit ?? null,
    data.servings_per_container ?? null, data.container_count ?? null,
    data.is_affiliate ?? null, notesProvided ? 1 : 0, notesValue,
    status,
    autoApproved ? 1 : 0,
    claimToken,
    id, user.userId, existing.status, expectedVersion,
  )
  if (ingredientsValidation.ingredients) {
    const ingredientRowIds = await candidateUserProductIngredientIds(
      c.env.DB,
      ingredientsValidation.ingredients.length,
    )
    const statements: D1PreparedStatement[] = [
      updateStatement,
      c.env.DB.prepare(`
        DELETE FROM user_product_ingredients
        WHERE user_product_id = ?
          AND EXISTS (
            SELECT 1 FROM user_products
            WHERE id = ? AND user_id = ? AND status = ? AND version = ? AND write_claim_token = ?
          )
      `).bind(id, id, user.userId, status, claimedVersion, claimToken),
    ]
    ingredientsValidation.ingredients.forEach((ingredient, index) => {
      statements.push(...buildUserProductIngredientStatements(
        c.env.DB,
        id,
        ingredientRowIds[index],
        ingredient,
        { claimToken, userId: user.userId, status, version: claimedVersion },
      ))
    })
    const results = await c.env.DB.batch(statements)
    if (results[0]?.meta.changes !== 1) {
      const current = await c.env.DB.prepare(
        'SELECT version FROM user_products WHERE id = ? AND user_id = ?'
      ).bind(id, user.userId).first<{ version: number }>()
      return c.json({
        error: 'Das Produkt wurde zwischenzeitlich geändert. Bitte lade es neu.',
        current_version: current?.version,
      }, 409)
    }
  } else {
    const result = await updateStatement.run()
    if (result.meta.changes !== 1) {
      const current = await c.env.DB.prepare(
        'SELECT version FROM user_products WHERE id = ? AND user_id = ?'
      ).bind(id, user.userId).first<{ version: number }>()
      return c.json({
        error: 'Das Produkt wurde zwischenzeitlich geändert. Bitte lade es neu.',
        current_version: current?.version,
      }, 409)
    }
  }
  const updated = await c.env.DB.prepare('SELECT * FROM user_products WHERE id = ?').bind(id).first<Record<string, unknown>>()
  const product = updated ? (await attachUserProductContext(c.env.DB, user.userId, [updated]))[0] : null
  return c.json({ product })
})

// DELETE /api/user-products/:id
userProducts.delete('/:id', async (c) => {
  const authErr = await ensureAuth(c)
  if (authErr) return authErr
  const user = c.get('user')
  const id = c.req.param('id')
  const existing = await c.env.DB.prepare(
    'SELECT id, status, published_product_id, version FROM user_products WHERE id = ? AND user_id = ?'
  ).bind(id, user.userId).first<{ id: number; status: string; published_product_id: number | null; version: number }>()
  if (!existing) return c.json({ error: 'Dieses Produkt wurde nicht gefunden.' }, 404)
  if (existing.status === 'approved' || existing.published_product_id !== null) {
    const error = existing.published_product_id == null
      ? 'Dieses private Original wurde bereits geprüft und kann nicht gelöscht werden. Du kannst eine bearbeitbare Kopie anlegen.'
      : 'Das öffentliche Original bleibt erhalten. Du kannst eine bearbeitbare Kopie anlegen.'
    return c.json({ error }, 409)
  }
  let body: Record<string, unknown>
  try {
    body = await c.req.json()
  } catch {
    return parseJsonBodyError()
  }
  const expectedVersion = expectedVersionFrom(body)
  if (expectedVersion === undefined || !hasOwnKey(body, 'expected_version')) {
    return c.json({ error: 'Die erwartete Produktversion fehlt oder ist ungültig. Bitte lade das Produkt neu.' }, 400)
  }
  if (existing.version !== expectedVersion) {
    return c.json({
      error: 'Das Produkt wurde zwischenzeitlich geändert. Bitte lade es neu.',
      current_version: existing.version,
    }, 409)
  }
  const result = await c.env.DB.prepare(
    'DELETE FROM user_products WHERE id = ? AND user_id = ? AND status = ? AND version = ?'
  ).bind(id, user.userId, existing.status, expectedVersion).run()
  if (result.meta.changes !== 1) {
    const current = await c.env.DB.prepare(
      'SELECT version FROM user_products WHERE id = ? AND user_id = ?'
    ).bind(id, user.userId).first<{ version: number }>()
    return c.json({
      error: 'Das Produkt wurde zwischenzeitlich geändert. Bitte lade es neu.',
      current_version: current?.version,
    }, 409)
  }
  return c.json({ ok: true })
})

export default userProducts
