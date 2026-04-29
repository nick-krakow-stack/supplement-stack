// ---------------------------------------------------------------------------
// Wishlist module
// Routes (mounted at /api/wishlist):
//   GET /                    — list user wishlist (auth)
//   POST /                   — add product to wishlist (auth)
//   DELETE /:product_id      — remove from wishlist (auth)
// ---------------------------------------------------------------------------

import { Hono } from 'hono'
import type { AppContext } from '../lib/types'
import { ensureAuth } from '../lib/helpers'

const wishlist = new Hono<AppContext>()

// GET /api/wishlist
wishlist.get('/', async (c) => {
  const authErr = await ensureAuth(c)
  if (authErr) return authErr
  const user = c.get('user')
  const { results } = await c.env.DB.prepare(`
    SELECT w.id, w.created_at, p.*
    FROM wishlist w
    JOIN products p ON p.id = w.product_id
    WHERE w.user_id = ?
    ORDER BY w.created_at DESC
  `).bind(user.userId).all()
  return c.json({ wishlist: results })
})

// POST /api/wishlist
wishlist.post('/', async (c) => {
  const authErr = await ensureAuth(c)
  if (authErr) return authErr
  const user = c.get('user')
  const body = await c.req.json()
  if (!body.product_id || typeof body.product_id !== 'number') return c.json({ error: 'product_id is required' }, 400)
  const { product_id } = body as { product_id: number }
  const product = await c.env.DB.prepare('SELECT id FROM products WHERE id = ?').bind(product_id).first()
  if (!product) return c.json({ error: 'Product not found' }, 404)
  try {
    const result = await c.env.DB.prepare(
      'INSERT INTO wishlist (user_id, product_id) VALUES (?, ?)'
    ).bind(user.userId, product_id).run()
    return c.json({ id: result.meta.last_row_id }, 201)
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    if (msg.includes('UNIQUE')) return c.json({ error: 'Already in wishlist' }, 409)
    return c.json({ error: msg }, 400)
  }
})

// DELETE /api/wishlist/:product_id
wishlist.delete('/:product_id', async (c) => {
  const authErr = await ensureAuth(c)
  if (authErr) return authErr
  const user = c.get('user')
  const product_id = c.req.param('product_id')
  const entry = await c.env.DB.prepare(
    'SELECT id FROM wishlist WHERE user_id = ? AND product_id = ?'
  ).bind(user.userId, product_id).first()
  if (!entry) return c.json({ error: 'Not found' }, 404)
  await c.env.DB.prepare('DELETE FROM wishlist WHERE user_id = ? AND product_id = ?').bind(user.userId, product_id).run()
  return c.json({ ok: true })
})

export default wishlist
