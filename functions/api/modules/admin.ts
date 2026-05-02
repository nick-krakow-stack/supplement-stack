// ---------------------------------------------------------------------------
// Admin module
// Routes (mounted at /api/admin):
//   GET /products           — all products list (admin)
//   GET /stats              — platform statistics (admin)
//   GET /shop-domains       — shop domains list (admin)
//   POST /shop-domains      — create shop domain (admin)
//   DELETE /shop-domains/:id — delete shop domain (admin)
//   GET /product-rankings   — product rankings (admin)
//   PUT /product-rankings/:productId — upsert ranking (admin)
//   GET /user-products?status= — user-submitted products (admin)
//   PUT /user-products/:id/approve (admin)
//   PUT /user-products/:id/reject  (admin)
//   DELETE /user-products/:id      (admin)
//   GET /translations/ingredients — ingredient translations list (admin)
//   PUT /translations/ingredients/:ingredientId/:language — upsert ingredient translation (admin)
// Plus public shop-domain routes (mounted at /api/shop-domains):
//   GET /resolve?url=       — resolve shop name from URL (public)
//   GET /                   — list shop domains (public)
// Plus interaction routes (mounted at /api/interactions):
//   GET /                   — list all (public)
//   POST /                  — create (admin)
//   DELETE /:id             — delete (admin)
// ---------------------------------------------------------------------------

import { Hono } from 'hono'
import type { AppContext, CountRow, ProductRow, InteractionRow } from '../lib/types'
import { ensureAuth, requireAdmin, ensureAdmin, logAdminAction } from '../lib/helpers'

const admin = new Hono<AppContext>()

type IngredientTranslationRow = {
  ingredient_id: number
  source_name: string
  source_description: string | null
  source_hypo_symptoms: string | null
  source_hyper_symptoms: string | null
  language: string
  name: string | null
  description: string | null
  hypo_symptoms: string | null
  hyper_symptoms: string | null
  status: 'missing' | 'translated'
}

function normalizeTranslationLanguage(value: string | undefined): string | null {
  if (!value) return null
  const normalized = value.trim().toLowerCase().replace(/_/g, '-')
  if (!/^[a-z]{2}(?:-[a-z]{2})?$/.test(normalized)) return null
  return normalized
}

function parsePagination(value: string | undefined, fallback: number, max: number): number {
  const parsed = Number(value)
  if (!Number.isFinite(parsed) || parsed < 0) return fallback
  return Math.min(Math.floor(parsed), max)
}

function optionalText(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

// GET /api/admin/products (admin only)
admin.get('/products', async (c) => {
  const authErr = await ensureAuth(c)
  if (authErr) return authErr
  const admErr = requireAdmin(c)
  if (admErr) return admErr
  const { results: products } = await c.env.DB.prepare(
    'SELECT * FROM products ORDER BY created_at DESC'
  ).all<ProductRow>()
  return c.json({ products })
})

// GET /api/admin/stats (admin only)
admin.get('/stats', async (c) => {
  const authErr = await ensureAuth(c)
  if (authErr) return authErr
  const admErr = requireAdmin(c)
  if (admErr) return admErr
  const usersRow = await c.env.DB.prepare('SELECT COUNT(*) as count FROM users').first<CountRow>()
  const ingredientsRow = await c.env.DB.prepare('SELECT COUNT(*) as count FROM ingredients').first<CountRow>()
  const productsRow = await c.env.DB.prepare('SELECT COUNT(*) as count FROM products').first<CountRow>()
  const stacksRow = await c.env.DB.prepare('SELECT COUNT(*) as count FROM stacks').first<CountRow>()
  const pendingRow = await c.env.DB.prepare(
    `SELECT COUNT(*) as count FROM products WHERE moderation_status = 'pending'`
  ).first<CountRow>()
  return c.json({
    users: usersRow?.count ?? 0,
    ingredients: ingredientsRow?.count ?? 0,
    products: productsRow?.count ?? 0,
    stacks: stacksRow?.count ?? 0,
    pending_products: pendingRow?.count ?? 0,
  })
})

// GET /api/admin/shop-domains (admin only)
admin.get('/shop-domains', async (c) => {
  const authErr = await ensureAuth(c)
  if (authErr) return authErr
  const admErr = requireAdmin(c)
  if (admErr) return admErr
  const { results: shops } = await c.env.DB.prepare(
    'SELECT * FROM shop_domains ORDER BY display_name ASC'
  ).all()
  return c.json({ shops })
})

// POST /api/admin/shop-domains (admin only)
admin.post('/shop-domains', async (c) => {
  const authErr = await ensureAuth(c)
  if (authErr) return authErr
  const admErr = requireAdmin(c)
  if (admErr) return admErr
  const body = await c.req.json()
  if (!body.domain || !body.display_name) return c.json({ error: 'domain und display_name erforderlich' }, 400)
  const result = await c.env.DB.prepare(
    'INSERT INTO shop_domains (domain, display_name) VALUES (?, ?)'
  ).bind(String(body.domain).trim(), String(body.display_name).trim()).run()
  await logAdminAction(c, {
    action: 'create_shop_domain',
    entity_type: 'shop_domain',
    entity_id: result.meta.last_row_id as number,
    changes: body,
  })
  return c.json({ id: result.meta.last_row_id }, 201)
})

// DELETE /api/admin/shop-domains/:id (admin only)
admin.delete('/shop-domains/:id', async (c) => {
  const authErr = await ensureAuth(c)
  if (authErr) return authErr
  const admErr = requireAdmin(c)
  if (admErr) return admErr
  const id = c.req.param('id')
  await c.env.DB.prepare('DELETE FROM shop_domains WHERE id = ?').bind(id).run()
  await logAdminAction(c, {
    action: 'delete_shop_domain',
    entity_type: 'shop_domain',
    entity_id: Number(id),
  })
  return c.json({ ok: true })
})

// GET /api/admin/product-rankings (admin only)
admin.get('/product-rankings', async (c) => {
  const authErr = await ensureAuth(c)
  if (authErr) return authErr
  const admErr = requireAdmin(c)
  if (admErr) return admErr
  const { results: rankings } = await c.env.DB.prepare(`
    SELECT pr.*, p.name as product_name
    FROM product_rankings pr
    JOIN products p ON p.id = pr.product_id
    ORDER BY pr.rank_score DESC
  `).all()
  return c.json({ rankings })
})

// PUT /api/admin/product-rankings/:productId (admin only)
admin.put('/product-rankings/:productId', async (c) => {
  const authErr = await ensureAuth(c)
  if (authErr) return authErr
  const admErr = requireAdmin(c)
  if (admErr) return admErr
  const productId = c.req.param('productId')
  const body = await c.req.json()
  if (body.rank_score === undefined) return c.json({ error: 'rank_score erforderlich' }, 400)
  await c.env.DB.prepare(`
    INSERT INTO product_rankings (product_id, rank_score, notes, ranked_at)
    VALUES (?, ?, ?, datetime('now'))
    ON CONFLICT(product_id) DO UPDATE SET
      rank_score = excluded.rank_score,
      notes = COALESCE(excluded.notes, product_rankings.notes),
      ranked_at = datetime('now')
  `).bind(productId, body.rank_score, body.notes ?? null).run()
  await logAdminAction(c, {
    action: 'upsert_product_ranking',
    entity_type: 'product_ranking',
    entity_id: Number(productId),
    changes: { rank_score: body.rank_score, notes: body.notes ?? null },
  })
  return c.json({ ok: true })
})

// GET /api/admin/user-products?status=pending (admin)
admin.get('/user-products', async (c) => {
  const authErr = await ensureAdmin(c)
  if (authErr) return authErr
  const status = c.req.query('status') ?? 'pending'
  const { results } = await c.env.DB.prepare(`
    SELECT up.*, u.email as user_email
    FROM user_products up
    LEFT JOIN users u ON up.user_id = u.id
    WHERE up.status = ?
    ORDER BY up.created_at DESC
  `).bind(status).all()
  return c.json({ products: results })
})

// PUT /api/admin/user-products/:id/approve (admin)
admin.put('/user-products/:id/approve', async (c) => {
  const authErr = await ensureAdmin(c)
  if (authErr) return authErr
  const id = c.req.param('id')
  await c.env.DB.prepare(`
    UPDATE user_products SET status = 'approved', approved_at = datetime('now') WHERE id = ?
  `).bind(id).run()
  await logAdminAction(c, {
    action: 'approve_user_product',
    entity_type: 'user_product',
    entity_id: Number(id),
  })
  return c.json({ ok: true })
})

// PUT /api/admin/user-products/:id/reject (admin)
admin.put('/user-products/:id/reject', async (c) => {
  const authErr = await ensureAdmin(c)
  if (authErr) return authErr
  const id = c.req.param('id')
  await c.env.DB.prepare(`
    UPDATE user_products SET status = 'rejected' WHERE id = ?
  `).bind(id).run()
  await logAdminAction(c, {
    action: 'reject_user_product',
    entity_type: 'user_product',
    entity_id: Number(id),
  })
  return c.json({ ok: true })
})

// DELETE /api/admin/user-products/:id (admin)
admin.delete('/user-products/:id', async (c) => {
  const authErr = await ensureAdmin(c)
  if (authErr) return authErr
  const id = c.req.param('id')
  await c.env.DB.prepare('DELETE FROM user_products WHERE id = ?').bind(id).run()
  await logAdminAction(c, {
    action: 'delete_user_product',
    entity_type: 'user_product',
    entity_id: Number(id),
  })
  return c.json({ ok: true })
})

// GET /api/admin/translations/ingredients?language=de&q=&limit=50&offset=0 (admin)
admin.get('/translations/ingredients', async (c) => {
  const authErr = await ensureAdmin(c)
  if (authErr) return authErr

  const language = normalizeTranslationLanguage(c.req.query('language') ?? 'de')
  if (!language) return c.json({ error: 'Invalid language' }, 400)

  const q = c.req.query('q')?.trim() ?? ''
  const limit = parsePagination(c.req.query('limit'), 50, 100)
  const offset = parsePagination(c.req.query('offset'), 0, 100000)
  const like = `%${q}%`

  const baseQuery = `
    SELECT
      i.id as ingredient_id,
      i.name as source_name,
      i.description as source_description,
      i.hypo_symptoms as source_hypo_symptoms,
      i.hyper_symptoms as source_hyper_symptoms,
      ? as language,
      t.name as name,
      t.description as description,
      t.hypo_symptoms as hypo_symptoms,
      t.hyper_symptoms as hyper_symptoms,
      CASE WHEN t.ingredient_id IS NULL THEN 'missing' ELSE 'translated' END as status
    FROM ingredients i
    LEFT JOIN ingredient_translations t
      ON t.ingredient_id = i.id AND t.language = ?
    WHERE (? = '' OR i.name LIKE ? OR COALESCE(t.name, '') LIKE ?)
    ORDER BY
      CASE WHEN t.ingredient_id IS NULL THEN 0 ELSE 1 END ASC,
      i.name ASC
    LIMIT ? OFFSET ?
  `

  const { results } = await c.env.DB.prepare(baseQuery)
    .bind(language, language, q, like, like, limit, offset)
    .all<IngredientTranslationRow>()

  return c.json({ language, translations: results, limit, offset })
})

// PUT /api/admin/translations/ingredients/:ingredientId/:language (admin)
admin.put('/translations/ingredients/:ingredientId/:language', async (c) => {
  const authErr = await ensureAdmin(c)
  if (authErr) return authErr

  const ingredientId = Number(c.req.param('ingredientId'))
  if (!Number.isInteger(ingredientId) || ingredientId <= 0) {
    return c.json({ error: 'Invalid ingredient id' }, 400)
  }

  const language = normalizeTranslationLanguage(c.req.param('language'))
  if (!language) return c.json({ error: 'Invalid language' }, 400)

  const ingredient = await c.env.DB.prepare('SELECT id FROM ingredients WHERE id = ?')
    .bind(ingredientId)
    .first<{ id: number }>()
  if (!ingredient) return c.json({ error: 'Ingredient not found' }, 404)

  let body: Record<string, unknown>
  try {
    body = await c.req.json()
  } catch {
    return c.json({ error: 'Invalid JSON' }, 400)
  }

  const name = optionalText(body.name)
  if (!name) return c.json({ error: 'name is required' }, 400)

  const description = optionalText(body.description)
  const hypoSymptoms = optionalText(body.hypo_symptoms)
  const hyperSymptoms = optionalText(body.hyper_symptoms)

  await c.env.DB.prepare(`
    INSERT INTO ingredient_translations (
      ingredient_id,
      language,
      name,
      description,
      hypo_symptoms,
      hyper_symptoms
    )
    VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(ingredient_id, language) DO UPDATE SET
      name = excluded.name,
      description = excluded.description,
      hypo_symptoms = excluded.hypo_symptoms,
      hyper_symptoms = excluded.hyper_symptoms
  `).bind(
    ingredientId,
    language,
    name,
    description,
    hypoSymptoms,
    hyperSymptoms,
  ).run()

  const translation = await c.env.DB.prepare(`
    SELECT ingredient_id, language, name, description, hypo_symptoms, hyper_symptoms
    FROM ingredient_translations
    WHERE ingredient_id = ? AND language = ?
  `).bind(ingredientId, language).first()

  await logAdminAction(c, {
    action: 'upsert_ingredient_translation',
    entity_type: 'ingredient_translation',
    entity_id: ingredientId,
    changes: {
      ingredient_id: ingredientId,
      language,
      name,
      description,
      hypo_symptoms: hypoSymptoms,
      hyper_symptoms: hyperSymptoms,
    },
  })

  return c.json({ translation })
})

export default admin

// ---------------------------------------------------------------------------
// Shop domains public sub-app (mounted at /api/shop-domains)
// ---------------------------------------------------------------------------

export const shopDomainsPublicApp = new Hono<AppContext>()

// GET /api/shop-domains/resolve?url=... (public)
shopDomainsPublicApp.get('/resolve', async (c) => {
  const url = c.req.query('url') || ''
  if (!url) return c.json({ shop_name: null, button_text: 'Jetzt kaufen' })
  const { results: shops } = await c.env.DB.prepare('SELECT domain, display_name FROM shop_domains').all<{ domain: string; display_name: string }>()
  const match = shops.find(s => url.toLowerCase().includes(s.domain.toLowerCase()))
  if (!match) return c.json({ shop_name: null, button_text: 'Jetzt kaufen' })
  return c.json({ shop_name: match.display_name, button_text: `Bei ${match.display_name} kaufen` })
})

// GET /api/shop-domains (public — for client-side URL matching)
shopDomainsPublicApp.get('/', async (c) => {
  const { results: shops } = await c.env.DB.prepare(
    'SELECT id, domain, display_name FROM shop_domains ORDER BY display_name ASC'
  ).all()
  return c.json({ shops })
})

// ---------------------------------------------------------------------------
// Interactions sub-app (mounted at /api/interactions)
// ---------------------------------------------------------------------------

export const interactionsApp = new Hono<AppContext>()

// GET /api/interactions
interactionsApp.get('/', async (c) => {
  const { results: interactions } = await c.env.DB.prepare(`
    SELECT ix.*,
           ia.name as ingredient_a_name,
           ib.name as ingredient_b_name
    FROM interactions ix
    JOIN ingredients ia ON ia.id = ix.ingredient_a_id
    JOIN ingredients ib ON ib.id = ix.ingredient_b_id
    ORDER BY ix.id DESC
  `).all()
  return c.json({ interactions })
})

// POST /api/interactions (admin only)
interactionsApp.post('/', async (c) => {
  const authErr = await ensureAuth(c)
  if (authErr) return authErr
  const user = c.get('user')
  if (user.role !== 'admin') return c.json({ error: 'Forbidden' }, 403)
  let data: Record<string, unknown>
  try {
    data = await c.req.json()
  } catch {
    return c.json({ error: 'Invalid JSON' }, 400)
  }
  if (!data.ingredient_a_id || !data.ingredient_b_id) return c.json({ error: 'Missing fields' }, 400)
  const interactionResult = await c.env.DB.prepare(
    'INSERT OR REPLACE INTO interactions (ingredient_a_id, ingredient_b_id, type, comment) VALUES (?, ?, ?, ?)'
  ).bind(
    data.ingredient_a_id,
    data.ingredient_b_id,
    (data.type as string) || 'avoid',
    (data.comment as string) || null,
  ).run()
  await logAdminAction(c, {
    action: 'upsert_interaction',
    entity_type: 'interaction',
    entity_id: interactionResult.meta.last_row_id as number ?? null,
    changes: data,
  })
  return c.json({ ok: true })
})

// DELETE /api/interactions/:id (admin only)
interactionsApp.delete('/:id', async (c) => {
  const authErr = await ensureAuth(c)
  if (authErr) return authErr
  const admErr = requireAdmin(c)
  if (admErr) return admErr
  const id = c.req.param('id')
  const interaction = await c.env.DB.prepare('SELECT id FROM interactions WHERE id = ?').bind(id).first<InteractionRow>()
  if (!interaction) return c.json({ error: 'Not found' }, 404)
  await c.env.DB.prepare('DELETE FROM interactions WHERE id = ?').bind(id).run()
  await logAdminAction(c, {
    action: 'delete_interaction',
    entity_type: 'interaction',
    entity_id: Number(id),
  })
  return c.json({ ok: true })
})
