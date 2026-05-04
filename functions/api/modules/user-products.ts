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

function hasOwnKey(data: Record<string, unknown>, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(data, key)
}

function requireNonEmptyText(body: Record<string, unknown>, key: string): string | undefined {
  const value = normalizeOptionalText(body[key])
  return typeof value === 'string' && value.length > 0 ? value : undefined
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
  const result = await c.env.DB.prepare(`
    INSERT INTO user_products (user_id, name, brand, form, price, shop_link, image_url, serving_size, serving_unit, servings_per_container, container_count, is_affiliate, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
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
  const imageUrlProvided = hasOwnKey(body, 'image_url')
  const imageUrlValue = data.image_url === '' ? null : data.image_url ?? null
  await c.env.DB.prepare(`
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
      notes = COALESCE(?, notes)
    WHERE id = ? AND user_id = ?
  `).bind(
    data.name ?? null, data.brand ?? null, data.form ?? null, data.price ?? null,
    data.shop_link ?? null, imageUrlProvided ? 1 : 0, imageUrlValue,
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
