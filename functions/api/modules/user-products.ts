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
  return new Response(JSON.stringify({ error: 'Invalid JSON' }), {
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
    if (!row || typeof row !== 'object') return { error: 'Ungueltige Wirkstoffdaten.' }
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

    if (ingredientId === undefined) return { error: 'Jeder Wirkstoff braucht eine gueltige ingredient_id.' }
    if (formId === undefined && hasOwnKey(ingredient, 'form_id')) return { error: 'form_id muss eine positive Ganzzahl sein.' }
    if (quantity === undefined && hasOwnKey(ingredient, 'quantity')) return { error: 'quantity muss groesser als 0 oder null sein.' }
    if ((unit === undefined || unit === '') && hasOwnKey(ingredient, 'unit')) return { error: 'unit darf nicht leer sein.' }
    if (basisQuantity === undefined && hasOwnKey(ingredient, 'basis_quantity')) return { error: 'basis_quantity muss groesser als 0 sein.' }
    if (hasOwnKey(ingredient, 'parent_ingredient_id')) return { error: 'parent_ingredient_id wird nicht mehr unterstützt. Sub-Wirkstoffe gehören in parts.' }
    if (partsResult.error || !partsResult.parts) return { error: partsResult.error ?? 'Ungültige Sub-Wirkstoffdaten.' }
    if (searchRelevant === undefined) return { error: 'search_relevant muss true/false oder 1/0 sein.' }

    const finalQuantity = quantity ?? null
    const finalUnit = unit ?? null
    const finalBasisQuantity = basisQuantity ?? null
    const finalBasisUnit = basisUnit ?? null
    if ((finalQuantity === null) !== (finalUnit === null)) {
      return { error: 'quantity und unit müssen gemeinsam angegeben oder beide null sein.' }
    }
    if ((finalBasisQuantity === null) !== (finalBasisUnit === null)) {
      return { error: 'basis_quantity und basis_unit müssen gemeinsam angegeben oder beide null sein.' }
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
        return 'Mindestens eine form_id gehoert nicht zum angegebenen Wirkstoff.'
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
): D1PreparedStatement[] {
  const statements = [db.prepare(`
    INSERT INTO user_product_ingredients (
      id, user_product_id, ingredient_id, form_id, quantity, unit,
      basis_quantity, basis_unit, search_relevant, parent_ingredient_id, is_main
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?)
  `).bind(
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
  )]
  statements.push(...ingredient.parts.map((part) => buildIngredientPartInsert(
      db,
      'user_product_ingredient_parts',
      'user_product_ingredient_id',
      parentRowId,
      part,
    )))
  return statements
}

// GET /api/user-products
userProducts.get('/', async (c) => {
  const authErr = await ensureAuth(c)
  if (authErr) return authErr
  const user = c.get('user')
  const { results } = await c.env.DB.prepare(
    'SELECT * FROM user_products WHERE user_id = ? ORDER BY created_at DESC'
  ).bind(user.userId).all()
  const products = await attachIngredients(c.env.DB, results as Record<string, unknown>[])
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
  if (typeof name !== 'string' || name.length === 0) return c.json({ error: 'name erforderlich' }, 400)
  const brand = requireNonEmptyText(body, 'brand')
  if (!brand) return c.json({ error: 'brand erforderlich' }, 400)
  const form = requireNonEmptyText(body, 'form')
  if (!form) return c.json({ error: 'form erforderlich' }, 400)
  const price = normalizeOptionalPositiveNumber(body.price)
  if (price === undefined) return c.json({ error: 'price must be greater than 0' }, 400)
  const servingSize = normalizeOptionalPositiveNumber(body.serving_size)
  if (servingSize === undefined) return c.json({ error: 'serving_size must be greater than 0' }, 400)
  const servingUnit = requireNonEmptyText(body, 'serving_unit')
  if (!servingUnit) return c.json({ error: 'serving_unit erforderlich' }, 400)
  const servingsPerContainer = normalizeOptionalPositiveInteger(body.servings_per_container)
  if (servingsPerContainer === undefined) return c.json({ error: 'servings_per_container must be a positive integer' }, 400)
  const containerCount = normalizeOptionalPositiveInteger(body.container_count)
  if (containerCount === undefined) return c.json({ error: 'container_count must be a positive integer' }, 400)
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
    data.shop_link ?? null,
    data.image_url ?? null,
    data.serving_size,
    data.serving_unit,
    data.servings_per_container,
    data.container_count,
    data.is_affiliate ?? 0,
    data.notes ?? null,
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
  const product = created ? (await attachIngredients(c.env.DB, [created]))[0] : null
  return c.json({ id: userProductId, product }, 201)
})

// PUT /api/user-products/:id
userProducts.put('/:id', async (c) => {
  const authErr = await ensureAuth(c)
  if (authErr) return authErr
  const user = c.get('user')
  const id = c.req.param('id')
  const existing = await c.env.DB.prepare(
    'SELECT id, status FROM user_products WHERE id = ? AND user_id = ?'
  ).bind(id, user.userId).first<{ id: number; status: string }>()
  if (!existing) return c.json({ error: 'Not found' }, 404)
  if (existing.status === 'approved') {
    return c.json({ error: 'Freigegebene Produkte koennen nicht mehr bearbeitet werden.' }, 409)
  }

  let body: Record<string, unknown>
  try {
    body = await c.req.json()
  } catch {
    return parseJsonBodyError()
  }
  const name = normalizeOptionalText(body.name)
  if (hasOwnKey(body, 'name') && (!name || name.length === 0)) return c.json({ error: 'name darf nicht leer sein' }, 400)
  const brand = normalizeOptionalText(body.brand)
  if (hasOwnKey(body, 'brand') && (!brand || brand.length === 0)) return c.json({ error: 'brand darf nicht leer sein' }, 400)
  const form = normalizeOptionalText(body.form)
  if (hasOwnKey(body, 'form') && (!form || form.length === 0)) return c.json({ error: 'form darf nicht leer sein' }, 400)
  const servingUnit = normalizeOptionalText(body.serving_unit)
  if (hasOwnKey(body, 'serving_unit') && (!servingUnit || servingUnit.length === 0)) return c.json({ error: 'serving_unit darf nicht leer sein' }, 400)
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
    return c.json({ error: 'price, serving_size, servings_per_container and container_count must be greater than 0 when provided' }, 400)
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
  const imageUrlProvided = hasOwnKey(body, 'image_url')
  const imageUrlValue = data.image_url === '' ? null : data.image_url ?? null
  const updateStatement = c.env.DB.prepare(`
    UPDATE user_products SET
      name = COALESCE(?, name),
      brand = COALESCE(?, brand),
      form = COALESCE(?, form),
      price = COALESCE(?, price),
      shop_link = COALESCE(?, shop_link),
      image_url = CASE WHEN ? THEN ? ELSE image_url END,
      serving_size = COALESCE(?, serving_size),
      serving_unit = COALESCE(?, serving_unit),
      servings_per_container = COALESCE(?, servings_per_container),
      container_count = COALESCE(?, container_count),
      is_affiliate = COALESCE(?, is_affiliate),
      notes = COALESCE(?, notes),
      status = ?,
      approved_at = CASE WHEN ? THEN COALESCE(approved_at, datetime('now')) ELSE NULL END
    WHERE id = ? AND user_id = ?
  `).bind(
    data.name ?? null, data.brand ?? null, data.form ?? null, data.price ?? null,
    data.shop_link ?? null, imageUrlProvided ? 1 : 0, imageUrlValue,
    data.serving_size ?? null, data.serving_unit ?? null,
    data.servings_per_container ?? null, data.container_count ?? null,
    data.is_affiliate ?? null, data.notes ?? null,
    status,
    autoApproved ? 1 : 0,
    id, user.userId,
  )
  if (ingredientsValidation.ingredients) {
    const ingredientRowIds = await reserveIntegerIds(
      c.env.DB,
      'user_product_ingredients',
      ingredientsValidation.ingredients.length,
    )
    const statements: D1PreparedStatement[] = [
      updateStatement,
      c.env.DB.prepare('DELETE FROM user_product_ingredients WHERE user_product_id = ?').bind(id),
    ]
    ingredientsValidation.ingredients.forEach((ingredient, index) => {
      statements.push(...buildUserProductIngredientStatements(c.env.DB, id, ingredientRowIds[index], ingredient))
    })
    await c.env.DB.batch(statements)
  } else {
    await updateStatement.run()
  }
  const updated = await c.env.DB.prepare('SELECT * FROM user_products WHERE id = ?').bind(id).first<Record<string, unknown>>()
  const product = updated ? (await attachIngredients(c.env.DB, [updated]))[0] : null
  return c.json({ product })
})

// DELETE /api/user-products/:id
userProducts.delete('/:id', async (c) => {
  const authErr = await ensureAuth(c)
  if (authErr) return authErr
  const user = c.get('user')
  const id = c.req.param('id')
  const existing = await c.env.DB.prepare(
    'SELECT id, status FROM user_products WHERE id = ? AND user_id = ?'
  ).bind(id, user.userId).first<{ id: number; status: string }>()
  if (!existing) return c.json({ error: 'Not found' }, 404)
  if (existing.status === 'approved') {
    return c.json({ error: 'Freigegebene Produkte koennen nicht mehr geloescht werden.' }, 409)
  }
  await c.env.DB.prepare('DELETE FROM user_products WHERE id = ?').bind(id).run()
  return c.json({ ok: true })
})

export default userProducts
