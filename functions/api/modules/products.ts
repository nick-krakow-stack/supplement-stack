// ---------------------------------------------------------------------------
// Products module
// Routes (mounted at /api/products):
//   GET /           — public list (approved + public)
//   GET /:id        — single product + ingredients + recommendations
//   POST /          — create (authenticated)
//   PUT /:id        — update (admin)
//   POST /:id/image — upload image (admin, R2)
//   PUT /:id/status — moderation status (admin)
// Route (mounted at /api/r2):
//   GET /products/:productId/:filename — R2 image proxy (public)
// ---------------------------------------------------------------------------

import { Hono } from 'hono'
import type { AppContext, ProductRow } from '../lib/types'
import { checkRateLimit, ensureAuth, requireAdmin, logAdminAction } from '../lib/helpers'
import { attachWarningsToProducts, loadCatalogProductSafetyWarnings } from './knowledge'

const products = new Hono<AppContext>()

const MAX_PRODUCT_INGREDIENT_ROWS = 50
const AFFILIATE_OWNER_TYPES = ['none', 'nick', 'user'] as const

type AffiliateOwnerType = typeof AFFILIATE_OWNER_TYPES[number]

type AffiliateOwnership = {
  affiliate_owner_type: AffiliateOwnerType
  affiliate_owner_user_id: number | null
  is_affiliate: number
}

type ProductIngredientInput = {
  ingredient_id: number
  is_main: boolean
  quantity: number
  unit: string
  basis_quantity: number | null
  basis_unit: string | null
  search_relevant: number
  parent_ingredient_id: number | null
  form_id: number | null
}

type ProductCoreInput = {
  name?: string
  brand?: string
  form?: string
  price?: number
  serving_size?: number
  serving_unit?: string
  servings_per_container?: number
  container_count?: number
}

type ProductOptionalInput = {
  shop_link?: string
  image_url?: string
  image_r2_key?: string
  is_affiliate?: number
  affiliate_owner_type?: AffiliateOwnerType
  affiliate_owner_user_id?: number | null
  discontinued_at?: string
  replacement_id?: number
  dosage_text?: string
  warning_title?: string
  warning_message?: string
  warning_type?: string
  alternative_note?: string
}

type ProductPayload = ProductCoreInput &
  ProductOptionalInput & {
    ingredients?: ProductIngredientInput[]
  }

function parseJsonBodyError(): Response {
  return new Response(JSON.stringify({ error: 'Invalid JSON' }), {
    status: 400,
    headers: { 'Content-Type': 'application/json' },
  })
}

function hasOwnKey(data: Record<string, unknown>, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(data, key)
}

function optionalText(value: unknown): string | undefined {
  if (value === undefined || value === null) return undefined
  if (typeof value !== 'string') return undefined
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : undefined
}

function requiredText(value: unknown): string | undefined {
  return optionalText(value)
}

function optionalCardText(value: unknown): string | null | undefined {
  if (value === undefined) return undefined
  if (value === null) return null
  return typeof value === 'string' ? value.trim() : undefined
}

function positiveNumber(value: unknown): number | undefined {
  if (value === undefined || value === null || value === '') return undefined
  const parsed = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : Number.NaN
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined
}

function positiveInteger(value: unknown): number | undefined {
  const parsed = positiveNumber(value)
  return parsed !== undefined && Number.isInteger(parsed) ? parsed : undefined
}

function optionalPositiveIntegerOrNull(value: unknown): number | null | undefined {
  if (value === undefined) return undefined
  if (value === null || value === '') return null
  return positiveInteger(value)
}

function optionalPositiveNumberOrNull(value: unknown): number | null | undefined {
  if (value === undefined) return undefined
  if (value === null || value === '') return null
  return positiveNumber(value)
}

function booleanFlag(value: unknown): number | undefined {
  if (value === undefined) return undefined
  if (value === true || value === 1) return 1
  if (value === false || value === 0) return 0
  return undefined
}

function parseAffiliateOwnerType(value: unknown): AffiliateOwnerType | undefined {
  if (typeof value !== 'string') return undefined
  const normalized = value.trim()
  return (AFFILIATE_OWNER_TYPES as readonly string[]).includes(normalized)
    ? normalized as AffiliateOwnerType
    : undefined
}

function normalizeAffiliateOwnership(
  body: Record<string, unknown>,
  fallback?: Partial<AffiliateOwnership>,
): { value?: AffiliateOwnership; error?: string } {
  const hasOwnerType = hasOwnKey(body, 'affiliate_owner_type')
  const hasOwnerUserId = hasOwnKey(body, 'affiliate_owner_user_id')
  const hasLegacyAffiliate = hasOwnKey(body, 'is_affiliate')

  if (hasOwnerUserId && !hasOwnerType) {
    return { error: 'affiliate_owner_user_id requires affiliate_owner_type.' }
  }

  let ownerType: AffiliateOwnerType = fallback?.affiliate_owner_type ?? 'none'
  let ownerUserId: number | null = fallback?.affiliate_owner_user_id ?? null

  if (hasOwnerType) {
    const parsedType = parseAffiliateOwnerType(body.affiliate_owner_type)
    if (!parsedType) {
      return { error: `affiliate_owner_type must be one of ${AFFILIATE_OWNER_TYPES.join(', ')}.` }
    }
    ownerType = parsedType
    const parsedUserId = optionalPositiveIntegerOrNull(body.affiliate_owner_user_id)
    if (parsedUserId === undefined && hasOwnerUserId) {
      return { error: 'affiliate_owner_user_id must be a positive integer when provided.' }
    }
    ownerUserId = parsedUserId ?? null
  } else if (hasLegacyAffiliate) {
    const legacyFlag = booleanFlag(body.is_affiliate)
    if (legacyFlag === undefined) return { error: 'is_affiliate must be true/false or 1/0.' }
    ownerType = legacyFlag === 1 ? 'nick' : 'none'
    ownerUserId = null
  }

  if (ownerType === 'none' || ownerType === 'nick') {
    ownerUserId = null
  }

  if (ownerType === 'user' && ownerUserId === null) {
    return { error: 'affiliate_owner_user_id is required when affiliate_owner_type is user.' }
  }

  return {
    value: {
      affiliate_owner_type: ownerType,
      affiliate_owner_user_id: ownerUserId,
      is_affiliate: ownerType === 'none' ? 0 : 1,
    },
  }
}

async function validateAffiliateOwnerUser(db: D1Database, ownership: AffiliateOwnership): Promise<string | null> {
  if (ownership.affiliate_owner_type !== 'user') return null
  const user = await db.prepare('SELECT id FROM users WHERE id = ?').bind(ownership.affiliate_owner_user_id).first<{ id: number }>()
  return user ? null : 'affiliate_owner_user_id must reference an existing user.'
}

function validateIngredients(value: unknown): { ingredients?: ProductIngredientInput[]; error?: string } {
  if (!Array.isArray(value) || value.length === 0) {
    return { error: 'Mindestens ein Wirkstoff ist erforderlich.' }
  }
  if (value.length > MAX_PRODUCT_INGREDIENT_ROWS) {
    return { error: `Maximal ${MAX_PRODUCT_INGREDIENT_ROWS} Wirkstoffzeilen sind erlaubt.` }
  }

  const ingredients: ProductIngredientInput[] = []

  for (const row of value) {
    if (!row || typeof row !== 'object') {
      return { error: 'Ungültige Wirkstoffdaten.' }
    }
    const ingredient = row as Record<string, unknown>
    const ingredientId = positiveInteger(ingredient.ingredient_id)
    const quantity = positiveNumber(ingredient.quantity)
    const unit = requiredText(ingredient.unit)
    const formId = optionalPositiveIntegerOrNull(ingredient.form_id)
    const basisQuantity = optionalPositiveNumberOrNull(ingredient.basis_quantity)
    const basisUnit = optionalCardText(ingredient.basis_unit)
    const parentIngredientId = optionalPositiveIntegerOrNull(ingredient.parent_ingredient_id)
    const isMain = ingredient.is_main === 1 || ingredient.is_main === true
    const searchRelevant = ingredient.search_relevant === undefined
      ? 1
      : ingredient.search_relevant === 1 || ingredient.search_relevant === true
        ? 1
        : ingredient.search_relevant === 0 || ingredient.search_relevant === false
          ? 0
          : undefined

    if (!ingredientId) return { error: 'Jeder Wirkstoff braucht eine gültige ingredient_id.' }
    if (quantity === undefined) return { error: 'Jeder Wirkstoff braucht eine positive Menge.' }
    if (!unit) return { error: 'Jeder Wirkstoff braucht eine Einheit.' }
    if (formId === undefined && hasOwnKey(ingredient, 'form_id')) {
      return { error: 'form_id muss eine positive Ganzzahl sein, wenn sie angegeben wird.' }
    }
    if (basisQuantity === undefined && hasOwnKey(ingredient, 'basis_quantity')) {
      return { error: 'basis_quantity muss groesser als 0 sein, wenn sie angegeben wird.' }
    }
    if (parentIngredientId === undefined && hasOwnKey(ingredient, 'parent_ingredient_id')) {
      return { error: 'parent_ingredient_id muss eine positive Ganzzahl sein, wenn sie angegeben wird.' }
    }
    if (searchRelevant === undefined) return { error: 'search_relevant muss true/false oder 1/0 sein.' }

    ingredients.push({
      ingredient_id: ingredientId,
      is_main: isMain,
      quantity,
      unit,
      basis_quantity: basisQuantity ?? null,
      basis_unit: basisUnit ?? null,
      search_relevant: searchRelevant,
      parent_ingredient_id: parentIngredientId ?? null,
      form_id: formId ?? null,
    })
  }

  return { ingredients }
}

async function validateProductIngredientReferences(
  db: D1Database,
  ingredients: ProductIngredientInput[],
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

  const parentRows = ingredients.filter((row) => row.parent_ingredient_id !== null)
  if (parentRows.length === 0) return null

  for (const row of parentRows) {
    if (row.parent_ingredient_id === row.ingredient_id) {
      return 'Parent- und Sub-Wirkstoff duerfen nicht identisch sein.'
    }
  }

  const parentIds = [...new Set(parentRows.map((row) => row.parent_ingredient_id as number))]
  const parentPlaceholders = parentIds.map(() => '?').join(',')
  const parentCount = await db.prepare(
    `SELECT COUNT(*) as count FROM ingredients WHERE id IN (${parentPlaceholders})`
  ).bind(...parentIds).first<{ count: number }>()
  if ((parentCount?.count ?? 0) !== parentIds.length) {
    return 'Mindestens ein Parent-Wirkstoff existiert nicht.'
  }

  const relationClauses = parentRows.map(() => '(parent_ingredient_id = ? AND child_ingredient_id = ?)').join(' OR ')
  const relationBindings = parentRows.flatMap((row) => [row.parent_ingredient_id as number, row.ingredient_id])
  const { results: relations } = await db.prepare(
    `SELECT parent_ingredient_id, child_ingredient_id
     FROM ingredient_sub_ingredients
     WHERE ${relationClauses}`
  ).bind(...relationBindings).all<{ parent_ingredient_id: number; child_ingredient_id: number }>()
  const allowedRelations = new Set(relations.map((row) => `${row.parent_ingredient_id}:${row.child_ingredient_id}`))
  for (const row of parentRows) {
    if (!allowedRelations.has(`${row.parent_ingredient_id}:${row.ingredient_id}`)) {
      return 'Mindestens eine Parent/Sub-Wirkstoff-Beziehung ist nicht zugelassen.'
    }
  }

  return null
}

function validateProductPayload(
  body: Record<string, unknown>,
  mode: 'create' | 'update',
): { data?: ProductPayload; error?: string } {
  const data: ProductPayload = {}
  const requiredCoreFields = [
    'name',
    'brand',
    'form',
    'price',
    'serving_size',
    'serving_unit',
    'servings_per_container',
    'container_count',
  ] as const

  if (mode === 'create') {
    for (const field of requiredCoreFields) {
      if (!hasOwnKey(body, field)) return { error: 'Pflichtfelder fehlen.' }
    }
  }

  for (const field of ['name', 'brand', 'form', 'serving_unit'] as const) {
    if (!hasOwnKey(body, field)) continue
    const value = requiredText(body[field])
    if (!value) return { error: `${field} darf nicht leer sein.` }
    data[field] = value
  }

  for (const field of ['price', 'serving_size'] as const) {
    if (!hasOwnKey(body, field)) continue
    const value = positiveNumber(body[field])
    if (value === undefined) return { error: `${field} muss größer als 0 sein.` }
    data[field] = value
  }

  for (const field of ['servings_per_container', 'container_count'] as const) {
    if (!hasOwnKey(body, field)) continue
    const value = positiveInteger(body[field])
    if (value === undefined) return { error: `${field} muss eine positive Ganzzahl sein.` }
    data[field] = value
  }

  for (const field of [
    'shop_link',
    'image_url',
    'image_r2_key',
    'discontinued_at',
    'dosage_text',
    'warning_title',
    'warning_message',
    'warning_type',
    'alternative_note',
  ] as const) {
    const value = optionalCardText(body[field])
    if (value !== undefined) data[field] = value ?? undefined
  }

  const ownership = normalizeAffiliateOwnership(body)
  if (ownership.error) return { error: ownership.error }
  if (
    hasOwnKey(body, 'affiliate_owner_type') ||
    hasOwnKey(body, 'affiliate_owner_user_id') ||
    hasOwnKey(body, 'is_affiliate')
  ) {
    data.affiliate_owner_type = ownership.value!.affiliate_owner_type
    data.affiliate_owner_user_id = ownership.value!.affiliate_owner_user_id
    data.is_affiliate = ownership.value!.is_affiliate
  }

  const replacementId = optionalPositiveIntegerOrNull(body.replacement_id)
  if (replacementId === undefined && hasOwnKey(body, 'replacement_id')) {
    return { error: 'replacement_id muss eine positive Ganzzahl sein, wenn sie angegeben wird.' }
  }
  if (replacementId !== undefined) data.replacement_id = replacementId ?? undefined

  if (mode === 'create' || hasOwnKey(body, 'ingredients')) {
    const ingredientValidation = validateIngredients(body.ingredients)
    if (ingredientValidation.error) return { error: ingredientValidation.error }
    data.ingredients = ingredientValidation.ingredients
  }

  return { data }
}

// GET /api/products
products.get('/', async (c) => {
  const { results } = await c.env.DB.prepare(
    `SELECT
      p.*,
      pi.ingredient_id,
      pi.quantity,
      pi.unit,
      pi.basis_quantity,
      pi.basis_unit,
      pi.search_relevant,
      pi.form_id,
      COALESCE(idp_form.effect_summary, idp_base.effect_summary) AS effect_summary,
      COALESCE(idp_form.effect_summary, idp_base.effect_summary) AS ingredient_effect_summary,
      COALESCE(idp_form.timing, idp_base.timing, p.timing) AS timing,
      COALESCE(idp_form.timing, idp_base.timing) AS ingredient_timing,
      COALESCE(idp_form.timing_note, idp_base.timing_note) AS ingredient_timing_note,
      COALESCE(idp_form.intake_hint, idp_base.intake_hint) AS ingredient_intake_hint
    FROM products p
    LEFT JOIN product_ingredients pi ON pi.id = (
      SELECT pi2.id
      FROM product_ingredients pi2
      WHERE pi2.product_id = p.id
      ORDER BY pi2.is_main DESC, pi2.search_relevant DESC, pi2.id ASC
      LIMIT 1
    )
    LEFT JOIN ingredient_display_profiles idp_form
      ON idp_form.ingredient_id = pi.ingredient_id
     AND idp_form.form_id = pi.form_id
     AND idp_form.sub_ingredient_id IS NULL
    LEFT JOIN ingredient_display_profiles idp_base
      ON idp_base.ingredient_id = pi.ingredient_id
     AND idp_base.form_id IS NULL
     AND idp_base.sub_ingredient_id IS NULL
    WHERE p.visibility = 'public'
      AND p.moderation_status = 'approved'`
  ).all<ProductRow>()
  const warningsByProduct = await loadCatalogProductSafetyWarnings(c.env.DB, results.map((product) => product.id))
  return c.json({ products: attachWarningsToProducts(results, warningsByProduct) })
})

// GET /api/products/:id
products.get('/:id', async (c) => {
  const id = c.req.param('id')
  const product = await c.env.DB.prepare(`
    SELECT
      p.*,
      COALESCE(idp_form.effect_summary, idp_base.effect_summary) AS effect_summary,
      COALESCE(idp_form.effect_summary, idp_base.effect_summary) AS ingredient_effect_summary,
      COALESCE(idp_form.timing, idp_base.timing, p.timing) AS timing,
      COALESCE(idp_form.timing, idp_base.timing) AS ingredient_timing,
      COALESCE(idp_form.timing_note, idp_base.timing_note) AS ingredient_timing_note,
      COALESCE(idp_form.intake_hint, idp_base.intake_hint) AS ingredient_intake_hint
    FROM products p
    LEFT JOIN product_ingredients pi ON pi.id = (
      SELECT pi2.id
      FROM product_ingredients pi2
      WHERE pi2.product_id = p.id
      ORDER BY pi2.is_main DESC, pi2.search_relevant DESC, pi2.id ASC
      LIMIT 1
    )
    LEFT JOIN ingredient_display_profiles idp_form
      ON idp_form.ingredient_id = pi.ingredient_id
     AND idp_form.form_id = pi.form_id
     AND idp_form.sub_ingredient_id IS NULL
    LEFT JOIN ingredient_display_profiles idp_base
      ON idp_base.ingredient_id = pi.ingredient_id
     AND idp_base.form_id IS NULL
     AND idp_base.sub_ingredient_id IS NULL
    WHERE p.id = ?
  `).bind(id).first<ProductRow>()
  if (!product) return c.json({ error: 'Not found' }, 404)
  const { results: ingredients } = await c.env.DB.prepare(`
    SELECT pi.*, i.name as ingredient_name, i.unit as ingredient_unit,
           i.description as ingredient_description,
           parent.name as parent_ingredient_name
    FROM product_ingredients pi
    JOIN ingredients i ON i.id = pi.ingredient_id
    LEFT JOIN ingredients parent ON parent.id = pi.parent_ingredient_id
    WHERE pi.product_id = ?
    ORDER BY pi.is_main DESC, pi.search_relevant DESC, pi.id ASC
  `).bind(id).all()
  const { results: recommendations } = await c.env.DB.prepare(
    'SELECT r.* FROM product_recommendations r WHERE r.product_id = ?'
  ).bind(id).all()
  const warningsByProduct = await loadCatalogProductSafetyWarnings(c.env.DB, [Number(id)])
  const [productWithWarnings] = attachWarningsToProducts([product], warningsByProduct)
  return c.json({ product: productWithWarnings, ingredients, recommendations })
})

// POST /api/products
products.post('/', async (c) => {
  const authErr = await ensureAuth(c)
  if (authErr) return authErr
  const user = c.get('user')
  const allowed = await checkRateLimit(c.env.RATE_LIMITER, `products:create:${user.userId}`, 10, 60 * 60)
  if (!allowed) return c.json({ error: 'Zu viele Produktanlagen. Bitte warte kurz.' }, 429)

  let body: Record<string, unknown>
  try {
    body = await c.req.json()
  } catch {
    return parseJsonBodyError()
  }
  const payload = { ...body }
  const requestedOwnerType = parseAffiliateOwnerType(payload.affiliate_owner_type)
  if (requestedOwnerType === 'nick' || (!requestedOwnerType && booleanFlag(payload.is_affiliate) === 1)) {
    return c.json({ error: 'Nick affiliate ownership can only be assigned by an admin.' }, 403)
  }
  if (requestedOwnerType === 'user') {
    const requestedOwnerUserId = optionalPositiveIntegerOrNull(payload.affiliate_owner_user_id)
    if (requestedOwnerUserId === undefined && hasOwnKey(payload, 'affiliate_owner_user_id')) {
      return c.json({ error: 'affiliate_owner_user_id must be a positive integer when provided.' }, 400)
    }
    if (requestedOwnerUserId !== null && requestedOwnerUserId !== undefined && requestedOwnerUserId !== user.userId) {
      return c.json({ error: 'affiliate_owner_user_id must match the authenticated user.' }, 403)
    }
    payload.affiliate_owner_user_id = user.userId
  }
  const validation = validateProductPayload(payload, 'create')
  if (validation.error || !validation.data?.ingredients) {
    return c.json({ error: validation.error ?? 'Ungültige Produktdaten.' }, 400)
  }
  const data = validation.data
  const ingredients = data.ingredients!
  const ownership = {
    affiliate_owner_type: data.affiliate_owner_type ?? 'none',
    affiliate_owner_user_id: data.affiliate_owner_user_id ?? null,
    is_affiliate: data.is_affiliate ?? 0,
  } satisfies AffiliateOwnership
  const affiliateOwnerError = await validateAffiliateOwnerUser(c.env.DB, ownership)
  if (affiliateOwnerError) return c.json({ error: affiliateOwnerError }, 400)
  const ingredientReferenceError = await validateProductIngredientReferences(c.env.DB, ingredients)
  if (ingredientReferenceError) return c.json({ error: ingredientReferenceError }, 400)

  const dup = await c.env.DB.prepare(
    'SELECT id FROM products WHERE name = ? AND brand = ?'
  ).bind(data.name, data.brand).first()
  if (dup) return c.json({ error: 'Duplicate product detected' }, 409)

  const result = await c.env.DB.prepare(
    `INSERT INTO products (
      name, brand, form, price, shop_link, image_url, moderation_status, visibility,
      is_affiliate, affiliate_owner_type, affiliate_owner_user_id,
      serving_size, serving_unit, servings_per_container, container_count
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    data.name,
    data.brand,
    data.form,
    data.price,
    data.shop_link ?? null,
    data.image_url ?? null,
    'pending',
    'hidden',
    ownership.is_affiliate,
    ownership.affiliate_owner_type,
    ownership.affiliate_owner_user_id,
    data.serving_size,
    data.serving_unit,
    data.servings_per_container,
    data.container_count,
  ).run()
  const productId = result.meta.last_row_id

  for (const ing of ingredients) {
    await c.env.DB.prepare(
      `INSERT INTO product_ingredients (
        product_id, ingredient_id, is_main, quantity, unit, form_id,
        basis_quantity, basis_unit, search_relevant, parent_ingredient_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      productId,
      ing.ingredient_id,
      ing.is_main ? 1 : 0,
      ing.quantity,
      ing.unit,
      ing.form_id,
      ing.basis_quantity,
      ing.basis_unit,
      ing.search_relevant,
      ing.parent_ingredient_id,
    ).run()
  }

  return c.json({ productId })
})

// PUT /api/products/:id (admin only)
products.put('/:id', async (c) => {
  const authErr = await ensureAuth(c)
  if (authErr) return authErr
  const user = c.get('user')
  const id = c.req.param('id')
  const product = await c.env.DB.prepare('SELECT * FROM products WHERE id = ?').bind(id).first<ProductRow>()
  if (!product) return c.json({ error: 'Not found' }, 404)
  if (user.role !== 'admin') return c.json({ error: 'Forbidden' }, 403)
  let body: Record<string, unknown>
  try {
    body = await c.req.json()
  } catch {
    return parseJsonBodyError()
  }
  const validation = validateProductPayload(body, 'update')
  if (validation.error || !validation.data) {
    return c.json({ error: validation.error ?? 'Ungültige Produktdaten.' }, 400)
  }
  const data = validation.data
  const ownership = normalizeAffiliateOwnership(body, {
    affiliate_owner_type: product.affiliate_owner_type ?? (product.is_affiliate === 1 ? 'nick' : 'none'),
    affiliate_owner_user_id: product.affiliate_owner_user_id,
    is_affiliate: product.is_affiliate === 1 ? 1 : 0,
  })
  if (ownership.error || !ownership.value) {
    return c.json({ error: ownership.error ?? 'Ungueltige Affiliate-Owner-Daten.' }, 400)
  }
  const affiliateOwnerError = await validateAffiliateOwnerUser(c.env.DB, ownership.value)
  if (affiliateOwnerError) return c.json({ error: affiliateOwnerError }, 400)
  if (data.ingredients) {
    const ingredientReferenceError = await validateProductIngredientReferences(c.env.DB, data.ingredients)
    if (ingredientReferenceError) return c.json({ error: ingredientReferenceError }, 400)
  }
  await c.env.DB.prepare(`
    UPDATE products SET
      name = COALESCE(?, name),
      brand = COALESCE(?, brand),
      form = COALESCE(?, form),
      price = COALESCE(?, price),
      shop_link = COALESCE(?, shop_link),
      image_url = COALESCE(?, image_url),
      image_r2_key = COALESCE(?, image_r2_key),
      is_affiliate = ?,
      affiliate_owner_type = ?,
      affiliate_owner_user_id = ?,
      discontinued_at = COALESCE(?, discontinued_at),
      serving_size = COALESCE(?, serving_size),
      serving_unit = COALESCE(?, serving_unit),
      servings_per_container = COALESCE(?, servings_per_container),
      container_count = COALESCE(?, container_count),
      dosage_text = COALESCE(?, dosage_text),
      warning_title = COALESCE(?, warning_title),
      warning_message = COALESCE(?, warning_message),
      warning_type = COALESCE(?, warning_type),
      alternative_note = COALESCE(?, alternative_note)
    WHERE id = ?
  `).bind(
    data.name ?? null,
    data.brand ?? null,
    data.form ?? null,
    data.price ?? null,
    data.shop_link ?? null,
    data.image_url ?? null,
    data.image_r2_key ?? null,
    ownership.value.is_affiliate,
    ownership.value.affiliate_owner_type,
    ownership.value.affiliate_owner_user_id,
    data.discontinued_at ?? null,
    data.serving_size ?? null,
    data.serving_unit ?? null,
    data.servings_per_container ?? null,
    data.container_count ?? null,
    data.dosage_text ?? null,
    data.warning_title ?? null,
    data.warning_message ?? null,
    data.warning_type ?? null,
    data.alternative_note ?? null,
    id,
  ).run()
  if (data.ingredients) {
    await c.env.DB.batch([
      c.env.DB.prepare('DELETE FROM product_ingredients WHERE product_id = ?').bind(id),
      ...data.ingredients.map((ing) =>
        c.env.DB.prepare(
          `INSERT INTO product_ingredients (
            product_id, ingredient_id, is_main, quantity, unit, form_id,
            basis_quantity, basis_unit, search_relevant, parent_ingredient_id
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        ).bind(
          id,
          ing.ingredient_id,
          ing.is_main ? 1 : 0,
          ing.quantity,
          ing.unit,
          ing.form_id,
          ing.basis_quantity,
          ing.basis_unit,
          ing.search_relevant,
          ing.parent_ingredient_id,
        ),
      ),
    ])
  }
  const updated = await c.env.DB.prepare('SELECT * FROM products WHERE id = ?').bind(id).first()
  await logAdminAction(c, {
    action: 'update_product',
    entity_type: 'product',
    entity_id: Number(id),
    changes: { ...data, ...ownership.value },
  })
  return c.json({ product: updated })
})

// POST /api/products/:id/image (admin only)
products.post('/:id/image', async (c) => {
  const authErr = await ensureAuth(c)
  if (authErr) return authErr
  const admErr = requireAdmin(c)
  if (admErr) return admErr
  const id = c.req.param('id')
  const product = await c.env.DB.prepare('SELECT id FROM products WHERE id = ?').bind(id).first()
  if (!product) return c.json({ error: 'Not found' }, 404)
  if (!c.env.PRODUCT_IMAGES) return c.json({ error: 'Product image storage is not configured' }, 501)
  const formData = await c.req.formData()
  // Accept both 'image' (new) and 'file' (legacy) field names
  const file = (formData.get('image') ?? formData.get('file')) as File | null
  if (!file) return c.json({ error: 'image field required' }, 400)
  const allowedTypes = ['image/jpeg', 'image/png', 'image/webp']
  if (!allowedTypes.includes(file.type)) return c.json({ error: 'Only JPEG, PNG or WebP images are allowed' }, 415)
  if (file.size > 5 * 1024 * 1024) return c.json({ error: 'Max 5 MB' }, 413)
  const extMap: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' }
  const ext = extMap[file.type] ?? 'jpg'
  const filename = `${crypto.randomUUID()}.${ext}`
  const r2Key = `products/${id}/${filename}`
  const buffer = await file.arrayBuffer()
  await c.env.PRODUCT_IMAGES.put(r2Key, buffer, {
    httpMetadata: { contentType: file.type },
  })
  const imageUrl = `/api/r2/products/${id}/${filename}`
  await c.env.DB.prepare(
    'UPDATE products SET image_url = ?, image_r2_key = ? WHERE id = ?'
  ).bind(imageUrl, r2Key, id).run()
  await logAdminAction(c, {
    action: 'upload_product_image',
    entity_type: 'product',
    entity_id: Number(id),
    changes: { image_url: imageUrl, r2_key: r2Key },
  })
  return c.json({ image_url: imageUrl })
})

// PUT /api/products/:id/status (admin only)
products.put('/:id/status', async (c) => {
  const authErr = await ensureAuth(c)
  if (authErr) return authErr
  const admErr = requireAdmin(c)
  if (admErr) return admErr
  const id = c.req.param('id')
  const product = await c.env.DB.prepare('SELECT id FROM products WHERE id = ?').bind(id).first()
  if (!product) return c.json({ error: 'Not found' }, 404)
  const body = await c.req.json()
  if (body.moderation_status && !['pending', 'approved', 'rejected'].includes(body.moderation_status as string))
    return c.json({ error: 'Invalid moderation_status' }, 400)
  if (body.visibility && !['public', 'hidden'].includes(body.visibility as string))
    return c.json({ error: 'Invalid visibility' }, 400)
  const data = body as { moderation_status?: string; visibility?: string }
  await c.env.DB.prepare(`
    UPDATE products SET
      moderation_status = COALESCE(?, moderation_status),
      visibility = COALESCE(?, visibility)
    WHERE id = ?
  `).bind(data.moderation_status ?? null, data.visibility ?? null, id).run()
  const updated = await c.env.DB.prepare('SELECT * FROM products WHERE id = ?').bind(id).first()
  await logAdminAction(c, {
    action: 'update_product_status',
    entity_type: 'product',
    entity_id: Number(id),
    changes: { moderation_status: data.moderation_status ?? null, visibility: data.visibility ?? null },
  })
  return c.json({ product: updated })
})

export default products

// ---------------------------------------------------------------------------
// R2 image proxy (mounted at /api/r2)
// ---------------------------------------------------------------------------

export const r2App = new Hono<AppContext>()

// GET /api/r2/products/:productId/:filename (public — R2 proxy)
r2App.get('/products/:productId/:filename', async (c) => {
  if (!c.env.PRODUCT_IMAGES) return c.json({ error: 'Image storage not configured' }, 501)
  const productId = c.req.param('productId')
  const filename = c.req.param('filename')
  const r2Key = `products/${productId}/${filename}`
  const object = await c.env.PRODUCT_IMAGES.get(r2Key)
  if (!object) return c.json({ error: 'Not found' }, 404)
  const contentType = object.httpMetadata?.contentType ?? 'application/octet-stream'
  const body = await object.arrayBuffer()
  return new Response(body, {
    headers: {
      'Content-Type': contentType,
      'Cache-Control': 'public, max-age=31536000, immutable',
    },
  })
})
