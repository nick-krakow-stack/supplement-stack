// ---------------------------------------------------------------------------
// Demo module
// Routes (mounted at /api/demo):
//   POST /sessions      - create demo session
//   GET /sessions/:key  - load demo session
//   GET /products       - public demo starter products
//   GET /reset          - delete expired demo sessions
// ---------------------------------------------------------------------------

import { Hono } from 'hono'
import type { Context } from 'hono'
import { checkRateLimit } from '../lib/helpers'
import type { AppContext } from '../lib/types'
import { attachWarningsToProducts, loadCatalogProductSafetyWarnings } from './knowledge'

const demo = new Hono<AppContext>()
const DEMO_SESSION_RATE_LIMIT = 10
const DEMO_SESSION_RATE_WINDOW_SECONDS = 15 * 60

type DemoProductRow = {
  id: number
  [key: string]: unknown
}

function clientIp(c: Context<AppContext>): string {
  return (
    c.req.header('CF-Connecting-IP') ??
    c.req.header('X-Forwarded-For')?.split(',')[0]?.trim() ??
    'unknown'
  )
}

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
      pi.basis_quantity,
      pi.basis_unit,
      pi.search_relevant,
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
    LIMIT 7
  `).all<DemoProductRow>()
  const warningsByProduct = await loadCatalogProductSafetyWarnings(c.env.DB, products.map((product) => product.id))
  return c.json({ products: attachWarningsToProducts(products, warningsByProduct) })
})

// POST /api/demo/sessions
demo.post('/sessions', async (c) => {
  const ip = clientIp(c)
  const allowed = await checkRateLimit(
    c.env.RATE_LIMITER,
    `demo_session:${ip}`,
    DEMO_SESSION_RATE_LIMIT,
    DEMO_SESSION_RATE_WINDOW_SECONDS,
  )
  if (!allowed) {
    return c.json({ error: 'Too many demo sessions. Please try again later.' }, 429)
  }

  const DEMO_TTL = Number(c.env.DEMO_SESSION_TTL_MINUTES || '1440')
  const key = crypto.randomUUID()
  const expiresAt = new Date(Date.now() + DEMO_TTL * 60 * 1000).toISOString()

  return c.json({ key, expiresAt, stack: [] })
})

// GET /api/demo/sessions/:key
demo.get('/sessions/:key', async (c) => {
  const session = await c.env.DB.prepare(
    'SELECT expires_at FROM demo_sessions WHERE key = ? AND expires_at > ?'
  ).bind(c.req.param('key'), new Date().toISOString()).first<{ expires_at: string | null }>()
  if (!session) return c.json({ error: 'Not found or expired' }, 404)
  return c.json({ stack: [], expires_at: session.expires_at })
})

// GET /api/demo/reset
demo.get('/reset', async (c) => {
  await c.env.DB.prepare('DELETE FROM demo_sessions WHERE expires_at <= ?').bind(new Date().toISOString()).run()
  return c.json({ ok: true })
})

export default demo
