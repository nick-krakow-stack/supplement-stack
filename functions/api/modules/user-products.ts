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
import { ensureAuth } from '../lib/helpers'

const userProducts = new Hono<AppContext>()

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

function normalizeOptionalNonNegativeNumber(value: unknown): number | null | undefined {
  if (value === undefined) return undefined
  if (value === null || value === '') return undefined
  const parsed = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : Number.NaN
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : undefined
}

function hasOwnKey(data: Record<string, unknown>, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(data, key)
}

// GET /api/user-products
userProducts.get('/', async (c) => {
  const authErr = await ensureAuth(c)
  if (authErr) return authErr
  const user = c.get('user')
  const { results } = await c.env.DB.prepare(
    'SELECT * FROM user_products WHERE user_id = ? ORDER BY created_at DESC'
  ).bind(user.userId).all()
  return c.json({ products: results })
})

// POST /api/user-products
userProducts.post('/', async (c) => {
  const authErr = await ensureAuth(c)
  if (authErr) return authErr
  const user = c.get('user')
  let body: Record<string, unknown>
  try {
    body = await c.req.json()
  } catch {
    return parseJsonBodyError()
  }
  const name = normalizeOptionalText(body.name)
  if (typeof name !== 'string' || name.length === 0) return c.json({ error: 'name erforderlich' }, 400)
  const price = normalizeOptionalNonNegativeNumber(body.price)
  if (price === undefined) return c.json({ error: 'price must be a non-negative number' }, 400)
  const servingSize = normalizeOptionalNonNegativeNumber(body.serving_size)
  const servingsPerContainer = normalizeOptionalNonNegativeNumber(body.servings_per_container)
  const containerCount = normalizeOptionalNonNegativeNumber(body.container_count)
  if (
    (hasOwnKey(body, 'serving_size') && servingSize === undefined) ||
    (hasOwnKey(body, 'servings_per_container') && servingsPerContainer === undefined) ||
    (hasOwnKey(body, 'container_count') && containerCount === undefined)
  ) {
    return c.json({ error: 'serving_size, servings_per_container and container_count must be non-negative numbers when provided' }, 400)
  }
  const data = {
    name,
    brand: normalizeOptionalText(body.brand),
    form: normalizeOptionalText(body.form),
    price,
    shop_link: normalizeOptionalText(body.shop_link),
    image_url: normalizeOptionalText(body.image_url),
    serving_size: servingSize,
    serving_unit: normalizeOptionalText(body.serving_unit),
    servings_per_container: servingsPerContainer,
    container_count: containerCount,
    is_affiliate: body.is_affiliate === 1 || body.is_affiliate === true ? 1 : 0,
    notes: normalizeOptionalText(body.notes),
  }
  const result = await c.env.DB.prepare(`
    INSERT INTO user_products (user_id, name, brand, form, price, shop_link, image_url, serving_size, serving_unit, servings_per_container, container_count, is_affiliate, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    user.userId,
    data.name,
    data.brand ?? null,
    data.form ?? null,
    data.price ?? 0,
    data.shop_link ?? null,
    data.image_url ?? null,
    data.serving_size ?? null,
    data.serving_unit ?? null,
    data.servings_per_container ?? null,
    data.container_count ?? 1,
    data.is_affiliate ?? 0,
    data.notes ?? null,
  ).run()
  return c.json({ id: result.meta.last_row_id }, 201)
})

// PUT /api/user-products/:id
userProducts.put('/:id', async (c) => {
  const authErr = await ensureAuth(c)
  if (authErr) return authErr
  const user = c.get('user')
  const id = c.req.param('id')
  const existing = await c.env.DB.prepare(
    'SELECT id FROM user_products WHERE id = ? AND user_id = ?'
  ).bind(id, user.userId).first()
  if (!existing) return c.json({ error: 'Not found' }, 404)
  let body: Record<string, unknown>
  try {
    body = await c.req.json()
  } catch {
    return parseJsonBodyError()
  }
  const name = normalizeOptionalText(body.name)
  if (name !== undefined && name !== null && name.length === 0) return c.json({ error: 'name darf nicht leer sein' }, 400)
  const price = normalizeOptionalNonNegativeNumber(body.price)
  const servingSize = normalizeOptionalNonNegativeNumber(body.serving_size)
  const servingsPerContainer = normalizeOptionalNonNegativeNumber(body.servings_per_container)
  const containerCount = normalizeOptionalNonNegativeNumber(body.container_count)
  if (
    (hasOwnKey(body, 'price') && price === undefined) ||
    (hasOwnKey(body, 'serving_size') && servingSize === undefined) ||
    (hasOwnKey(body, 'servings_per_container') && servingsPerContainer === undefined) ||
    (hasOwnKey(body, 'container_count') && containerCount === undefined)
  ) {
    return c.json({ error: 'price, serving_size, servings_per_container and container_count must be non-negative numbers when provided' }, 400)
  }
  const data = {
    name,
    brand: normalizeOptionalText(body.brand),
    form: normalizeOptionalText(body.form),
    price,
    shop_link: normalizeOptionalText(body.shop_link),
    image_url: normalizeOptionalText(body.image_url),
    serving_size: servingSize,
    serving_unit: normalizeOptionalText(body.serving_unit),
    servings_per_container: servingsPerContainer,
    container_count: containerCount,
    is_affiliate: body.is_affiliate === undefined ? undefined : body.is_affiliate === 1 || body.is_affiliate === true ? 1 : 0,
    notes: normalizeOptionalText(body.notes),
  }
  await c.env.DB.prepare(`
    UPDATE user_products SET
      name = COALESCE(?, name),
      brand = COALESCE(?, brand),
      form = COALESCE(?, form),
      price = COALESCE(?, price),
      shop_link = COALESCE(?, shop_link),
      image_url = ?,
      serving_size = COALESCE(?, serving_size),
      serving_unit = COALESCE(?, serving_unit),
      servings_per_container = COALESCE(?, servings_per_container),
      container_count = COALESCE(?, container_count),
      is_affiliate = COALESCE(?, is_affiliate),
      notes = COALESCE(?, notes)
    WHERE id = ? AND user_id = ?
  `).bind(
    data.name ?? null, data.brand ?? null, data.form ?? null, data.price ?? null,
    data.shop_link ?? null, data.image_url ?? null,
    data.serving_size ?? null, data.serving_unit ?? null,
    data.servings_per_container ?? null, data.container_count ?? null,
    data.is_affiliate ?? null, data.notes ?? null,
    id, user.userId,
  ).run()
  const updated = await c.env.DB.prepare('SELECT * FROM user_products WHERE id = ?').bind(id).first()
  return c.json({ product: updated })
})

// DELETE /api/user-products/:id
userProducts.delete('/:id', async (c) => {
  const authErr = await ensureAuth(c)
  if (authErr) return authErr
  const user = c.get('user')
  const id = c.req.param('id')
  const existing = await c.env.DB.prepare(
    'SELECT id FROM user_products WHERE id = ? AND user_id = ?'
  ).bind(id, user.userId).first()
  if (!existing) return c.json({ error: 'Not found' }, 404)
  await c.env.DB.prepare('DELETE FROM user_products WHERE id = ?').bind(id).run()
  return c.json({ ok: true })
})

export default userProducts
