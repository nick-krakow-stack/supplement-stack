// ---------------------------------------------------------------------------
// Demo module
// Routes (mounted at /api/demo):
//   POST /sessions      - create demo session
//   GET /sessions/:key  - load demo session
//   GET /products       - public demo starter products
//   GET /reset          - delete expired demo sessions
// ---------------------------------------------------------------------------

import { Hono } from 'hono'
import type { AppContext, DemoSessionRow } from '../lib/types'

const demo = new Hono<AppContext>()

// GET /api/demo/products
demo.get('/products', async (c) => {
  const { results: products } = await c.env.DB.prepare(`
    SELECT
      p.*,
      pi.ingredient_id,
      i.name AS ingredient_name,
      i.category AS ingredient_category,
      pi.quantity,
      pi.unit,
      pi.is_main
    FROM products p
    LEFT JOIN product_ingredients pi ON pi.id = (
      SELECT pi2.id
      FROM product_ingredients pi2
      WHERE pi2.product_id = p.id
      ORDER BY pi2.is_main DESC, pi2.id ASC
      LIMIT 1
    )
    LEFT JOIN ingredients i ON i.id = pi.ingredient_id
    WHERE p.visibility = 'public'
      AND p.moderation_status = 'approved'
    ORDER BY
      CASE WHEN p.discontinued_at IS NULL THEN 0 ELSE 1 END,
      p.id ASC
    LIMIT 18
  `).all()
  return c.json({ products })
})

// POST /api/demo/sessions
demo.post('/sessions', async (c) => {
  let data: Record<string, unknown>
  try {
    data = await c.req.json()
  } catch {
    data = {}
  }
  const DEMO_TTL = Number(c.env.DEMO_SESSION_TTL_MINUTES || '1440')
  const key = crypto.randomUUID()
  const expiresAt = new Date(Date.now() + DEMO_TTL * 60 * 1000).toISOString()
  await c.env.DB.prepare(
    'INSERT INTO demo_sessions (key, stack_json, expires_at) VALUES (?, ?, ?)'
  ).bind(key, JSON.stringify(data.stack || []), expiresAt).run()
  return c.json({ key, expiresAt })
})

// GET /api/demo/sessions/:key
demo.get('/sessions/:key', async (c) => {
  const session = await c.env.DB.prepare(
    'SELECT * FROM demo_sessions WHERE key = ? AND expires_at > ?'
  ).bind(c.req.param('key'), new Date().toISOString()).first<DemoSessionRow>()
  if (!session) return c.json({ error: 'Not found or expired' }, 404)
  return c.json({ stack: JSON.parse(session.stack_json || '[]'), expires_at: session.expires_at })
})

// GET /api/demo/reset
demo.get('/reset', async (c) => {
  await c.env.DB.prepare('DELETE FROM demo_sessions WHERE expires_at <= ?').bind(new Date().toISOString()).run()
  return c.json({ ok: true })
})

export default demo
