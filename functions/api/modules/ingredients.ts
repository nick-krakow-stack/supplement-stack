// ---------------------------------------------------------------------------
// Ingredients module
// Routes (mounted at /api/ingredients):
//   GET /           — list all
//   GET /search     — search by name/synonym
//   GET /:id        — single ingredient + synonyms + forms
//   GET /:id/dosage-guidelines
//   GET /:id/products
//   POST /          — create (admin)
//   PUT /:id        — update (admin)
//   POST /:id/synonyms      (admin)
//   DELETE /:id/synonyms/:synId (admin)
//   POST /:id/forms         (admin)
//   DELETE /:id/forms/:formId (admin)
// Plus recommendation routes (mounted at /api/recommendations):
//   GET /           — public
//   POST /          — admin
//   DELETE /:id     — admin
// ---------------------------------------------------------------------------

import { Hono } from 'hono'
import type { AppContext, IngredientRow } from '../lib/types'
import { ensureAuth, requireAdmin } from '../lib/helpers'

const ingredients = new Hono<AppContext>()

// GET /api/ingredients
ingredients.get('/', async (c) => {
  const { results } = await c.env.DB.prepare('SELECT * FROM ingredients').all<IngredientRow>()
  return c.json({ ingredients: results })
})

// GET /api/ingredients/search
ingredients.get('/search', async (c) => {
  const q = (c.req.query('q') || '').trim()
  if (!q) return c.json({ ingredients: [] })
  const { results: byName } = await c.env.DB.prepare(
    'SELECT * FROM ingredients WHERE name LIKE ?'
  ).bind(`%${q}%`).all<IngredientRow>()
  const { results: bySynonym } = await c.env.DB.prepare(
    'SELECT i.* FROM ingredients i JOIN ingredient_synonyms s ON s.ingredient_id = i.id WHERE s.synonym LIKE ?'
  ).bind(`%${q}%`).all<IngredientRow>()
  const merged = [...byName, ...bySynonym]
  const unique = Array.from(new Map(merged.map(i => [i.id, i])).values()).slice(0, 10)
  if (unique.length === 0) return c.json({ ingredients: [] })
  // Fetch synonyms for all matched ingredients in a single query
  const ids = unique.map(i => i.id)
  const placeholders = ids.map(() => '?').join(',')
  const { results: allSynonyms } = await c.env.DB.prepare(
    `SELECT ingredient_id, synonym FROM ingredient_synonyms WHERE ingredient_id IN (${placeholders})`
  ).bind(...ids).all<{ ingredient_id: number; synonym: string }>()
  const synMap: Record<number, Array<{ synonym: string }>> = {}
  for (const s of allSynonyms) {
    if (!synMap[s.ingredient_id]) synMap[s.ingredient_id] = []
    synMap[s.ingredient_id].push({ synonym: s.synonym })
  }
  const ingredientsResult = unique.map(i => ({ ...i, synonyms: synMap[i.id] ?? [] }))
  return c.json({ ingredients: ingredientsResult })
})

// GET /api/ingredients/:id
ingredients.get('/:id', async (c) => {
  const id = c.req.param('id')
  const ingredient = await c.env.DB.prepare('SELECT * FROM ingredients WHERE id = ?').bind(id).first<IngredientRow>()
  if (!ingredient) return c.json({ error: 'Not found' }, 404)
  const { results: synonyms } = await c.env.DB.prepare(
    'SELECT * FROM ingredient_synonyms WHERE ingredient_id = ?'
  ).bind(id).all()
  const { results: forms } = await c.env.DB.prepare(
    'SELECT * FROM ingredient_forms WHERE ingredient_id = ?'
  ).bind(id).all()
  return c.json({ ingredient, synonyms, forms })
})

// GET /api/ingredients/:id/dosage-guidelines
ingredients.get('/:id/dosage-guidelines', async (c) => {
  const id = c.req.param('id')
  const { results: guidelines } = await c.env.DB.prepare(
    `
      SELECT
        id,
        ingredient_id,
        CASE
          WHEN source_type = 'study' THEN 'study'
          WHEN source_type IN ('profile', 'user_private', 'user_public') THEN 'practice'
          WHEN lower(source_label) LIKE '%dge%' OR lower(COALESCE(source_url, '')) LIKE '%dge%' THEN 'DGE'
          WHEN lower(source_label) LIKE '%efsa%' OR lower(COALESCE(source_url, '')) LIKE '%efsa%' THEN 'EFSA'
          WHEN lower(source_label) LIKE '%nih%' OR lower(COALESCE(source_url, '')) LIKE '%nih%' THEN 'NIH'
          ELSE 'practice'
        END AS source,
        source_label AS source_title,
        source_url,
        CASE
          WHEN purpose = 'deficiency_correction' THEN 'deficient'
          WHEN is_athlete = 1 THEN 'athlete'
          WHEN population_slug = 'pregnant' THEN 'pregnant'
          WHEN population_slug = 'elderly' THEN 'elderly'
          WHEN sex_filter = 'female' THEN 'adult_female'
          WHEN sex_filter = 'male' THEN 'adult_male'
          ELSE COALESCE(population_slug, 'adult')
        END AS population,
        dose_min,
        dose_max,
        unit,
        NULL AS frequency,
        timing,
        context_note AS notes,
        is_default
      FROM dose_recommendations
      WHERE ingredient_id = ? AND is_active = 1
      ORDER BY is_default DESC, source ASC, relevance_score DESC, id ASC
    `
  ).bind(id).all()
  return c.json({ guidelines })
})

// GET /api/ingredients/:id/products
ingredients.get('/:id/products', async (c) => {
  const id = c.req.param('id')
  const { results: products } = await c.env.DB.prepare(`
    SELECT p.*, pi.quantity, pi.unit
    FROM products p
    JOIN product_ingredients pi ON pi.product_id = p.id
    WHERE pi.ingredient_id = ? AND p.visibility = 'public'
    ORDER BY pi.is_main DESC, p.name ASC
  `).bind(id).all()
  return c.json({ products })
})

// POST /api/ingredients (admin only)
ingredients.post('/', async (c) => {
  const authErr = await ensureAuth(c)
  if (authErr) return authErr
  const user = c.get('user')
  if (user.role !== 'admin') return c.json({ error: 'Forbidden' }, 403)
  let body: Record<string, unknown>
  try {
    body = await c.req.json()
  } catch {
    return c.json({ error: 'Invalid JSON' }, 400)
  }
  const result = await c.env.DB.prepare(
    'INSERT INTO ingredients (name, unit, description, hypo_symptoms, hyper_symptoms, external_url) VALUES (?, ?, ?, ?, ?, ?)'
  ).bind(
    body.name,
    (body.unit as string) || null,
    (body.description as string) || null,
    (body.hypo_symptoms as string) || null,
    (body.hyper_symptoms as string) || null,
    (body.external_url as string) || null,
  ).run()
  return c.json({ id: result.meta.last_row_id })
})

// PUT /api/ingredients/:id (admin only)
ingredients.put('/:id', async (c) => {
  const authErr = await ensureAuth(c)
  if (authErr) return authErr
  const admErr = requireAdmin(c)
  if (admErr) return admErr
  const id = c.req.param('id')
  const ingredient = await c.env.DB.prepare('SELECT id FROM ingredients WHERE id = ?').bind(id).first()
  if (!ingredient) return c.json({ error: 'Not found' }, 404)
  const body = await c.req.json()
  const data = body as { name?: string; unit?: string; description?: string; hypo_symptoms?: string; hyper_symptoms?: string; external_url?: string }
  await c.env.DB.prepare(`
    UPDATE ingredients SET
      name = COALESCE(?, name),
      unit = COALESCE(?, unit),
      description = COALESCE(?, description),
      hypo_symptoms = COALESCE(?, hypo_symptoms),
      hyper_symptoms = COALESCE(?, hyper_symptoms),
      external_url = COALESCE(?, external_url)
    WHERE id = ?
  `).bind(
    data.name ?? null,
    data.unit ?? null,
    data.description ?? null,
    data.hypo_symptoms ?? null,
    data.hyper_symptoms ?? null,
    data.external_url ?? null,
    id,
  ).run()
  const updated = await c.env.DB.prepare('SELECT * FROM ingredients WHERE id = ?').bind(id).first()
  return c.json({ ingredient: updated })
})

// POST /api/ingredients/:id/synonyms (admin only)
ingredients.post('/:id/synonyms', async (c) => {
  const authErr = await ensureAuth(c)
  if (authErr) return authErr
  const admErr = requireAdmin(c)
  if (admErr) return admErr
  const id = c.req.param('id')
  const ingredient = await c.env.DB.prepare('SELECT id FROM ingredients WHERE id = ?').bind(id).first()
  if (!ingredient) return c.json({ error: 'Not found' }, 404)
  const body = await c.req.json()
  if (!body.synonym || typeof body.synonym !== 'string' || body.synonym.trim().length === 0)
    return c.json({ error: 'synonym is required' }, 400)
  const result = await c.env.DB.prepare(
    'INSERT INTO ingredient_synonyms (ingredient_id, synonym) VALUES (?, ?)'
  ).bind(id, body.synonym).run()
  return c.json({ id: result.meta.last_row_id }, 201)
})

// DELETE /api/ingredients/:id/synonyms/:synId (admin only)
ingredients.delete('/:id/synonyms/:synId', async (c) => {
  const authErr = await ensureAuth(c)
  if (authErr) return authErr
  const admErr = requireAdmin(c)
  if (admErr) return admErr
  const id = c.req.param('id')
  const synId = c.req.param('synId')
  const syn = await c.env.DB.prepare(
    'SELECT id FROM ingredient_synonyms WHERE id = ? AND ingredient_id = ?'
  ).bind(synId, id).first()
  if (!syn) return c.json({ error: 'Not found' }, 404)
  await c.env.DB.prepare('DELETE FROM ingredient_synonyms WHERE id = ?').bind(synId).run()
  return c.json({ ok: true })
})

// POST /api/ingredients/:id/forms (admin only)
ingredients.post('/:id/forms', async (c) => {
  const authErr = await ensureAuth(c)
  if (authErr) return authErr
  const admErr = requireAdmin(c)
  if (admErr) return admErr
  const id = c.req.param('id')
  const ingredient = await c.env.DB.prepare('SELECT id FROM ingredients WHERE id = ?').bind(id).first()
  if (!ingredient) return c.json({ error: 'Not found' }, 404)
  const body = await c.req.json()
  if (!body.name || typeof body.name !== 'string' || body.name.trim().length === 0)
    return c.json({ error: 'name is required' }, 400)
  const data = body as { name: string; comment?: string; tags?: string; score?: number }
  const result = await c.env.DB.prepare(
    'INSERT INTO ingredient_forms (ingredient_id, name, comment, tags, score) VALUES (?, ?, ?, ?, ?)'
  ).bind(id, data.name, data.comment ?? null, data.tags ?? null, data.score ?? 0).run()
  return c.json({ id: result.meta.last_row_id }, 201)
})

// DELETE /api/ingredients/:id/forms/:formId (admin only)
ingredients.delete('/:id/forms/:formId', async (c) => {
  const authErr = await ensureAuth(c)
  if (authErr) return authErr
  const admErr = requireAdmin(c)
  if (admErr) return admErr
  const id = c.req.param('id')
  const formId = c.req.param('formId')
  const form = await c.env.DB.prepare(
    'SELECT id FROM ingredient_forms WHERE id = ? AND ingredient_id = ?'
  ).bind(formId, id).first()
  if (!form) return c.json({ error: 'Not found' }, 404)
  await c.env.DB.prepare('DELETE FROM ingredient_forms WHERE id = ?').bind(formId).run()
  return c.json({ ok: true })
})

export default ingredients

// ---------------------------------------------------------------------------
// Recommendations sub-app (mounted at /api/recommendations)
// ---------------------------------------------------------------------------

export const recommendationsApp = new Hono<AppContext>()

// GET /api/recommendations?ingredient_id=x (public)
recommendationsApp.get('/', async (c) => {
  const ingredientIdParam = c.req.query('ingredient_id')
  if (!ingredientIdParam) return c.json({ error: 'ingredient_id query param required' }, 400)
  const ingredientId = Number(ingredientIdParam)
  if (!Number.isInteger(ingredientId) || ingredientId <= 0)
    return c.json({ error: 'ingredient_id must be a positive integer' }, 400)
  try {
    const { results: recommendations } = await c.env.DB.prepare(`
      SELECT r.product_id, r.type
      FROM recommendations r
      JOIN products p ON p.id = r.product_id
      WHERE r.ingredient_id = ?
        AND p.moderation_status = 'approved'
        AND p.visibility = 'public'
      ORDER BY CASE r.type WHEN 'recommended' THEN 0 ELSE 1 END ASC
    `).bind(ingredientId).all<{ product_id: number; type: string }>()
    return c.json({ recommendations })
  } catch {
    return c.json({ error: 'Failed to fetch recommendations' }, 500)
  }
})

// POST /api/recommendations (admin only)
recommendationsApp.post('/', async (c) => {
  const authErr = await ensureAuth(c)
  if (authErr) return authErr
  const admErr = requireAdmin(c)
  if (admErr) return admErr
  const body = await c.req.json()
  if (!body.ingredient_id || !body.product_id) return c.json({ error: 'ingredient_id and product_id are required' }, 400)
  if (!['recommended', 'alternative'].includes(body.type as string)) return c.json({ error: 'type must be recommended or alternative' }, 400)
  const data = body as { ingredient_id: number; product_id: number; type: string }
  const ingredient = await c.env.DB.prepare('SELECT id FROM ingredients WHERE id = ?').bind(data.ingredient_id).first()
  if (!ingredient) return c.json({ error: 'Ingredient not found' }, 404)
  const product = await c.env.DB.prepare('SELECT id FROM products WHERE id = ?').bind(data.product_id).first()
  if (!product) return c.json({ error: 'Product not found' }, 404)
  const result = await c.env.DB.prepare(
    'INSERT INTO recommendations (ingredient_id, product_id, type) VALUES (?, ?, ?)'
  ).bind(data.ingredient_id, data.product_id, data.type).run()
  return c.json({ id: result.meta.last_row_id }, 201)
})

// DELETE /api/recommendations/:id (admin only)
recommendationsApp.delete('/:id', async (c) => {
  const authErr = await ensureAuth(c)
  if (authErr) return authErr
  const admErr = requireAdmin(c)
  if (admErr) return admErr
  const id = c.req.param('id')
  const rec = await c.env.DB.prepare('SELECT id FROM recommendations WHERE id = ?').bind(id).first()
  if (!rec) return c.json({ error: 'Not found' }, 404)
  await c.env.DB.prepare('DELETE FROM recommendations WHERE id = ?').bind(id).run()
  return c.json({ ok: true })
})
