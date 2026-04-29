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
  const body = await c.req.json()
  if (!body.name || typeof body.name !== 'string') return c.json({ error: 'name erforderlich' }, 400)
  const data = body as {
    name: string; brand?: string; form?: string; price?: number; shop_link?: string;
    image_url?: string; serving_size?: number; serving_unit?: string; servings_per_container?: number;
    container_count?: number; is_affiliate?: number; notes?: string;
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
  const body = await c.req.json()
  const data = body as {
    name?: string; brand?: string; form?: string; price?: number; shop_link?: string;
    image_url?: string; serving_size?: number; serving_unit?: string; servings_per_container?: number;
    container_count?: number; is_affiliate?: number; notes?: string;
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
