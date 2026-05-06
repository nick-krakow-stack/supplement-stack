// ---------------------------------------------------------------------------
// Ingredients module
// Routes (mounted at /api/ingredients):
//   GET /           — list all
//   GET /search     — search by name/synonym
//   GET /:id        — single ingredient + synonyms + forms
//   GET /:id/sub-ingredients
//   GET /:id/recommendations
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
import { ensureAuth, requireAdmin, logAdminAction } from '../lib/helpers'
import { convertAmount, normalizeUnit } from '../lib/units'
import { attachWarningsToProducts, loadCatalogProductSafetyWarnings } from './knowledge'

const ingredients = new Hono<AppContext>()

type DoseRecommendationQueryRow = {
  id: number
  ingredient_id: number
  population_id: number
  population_slug: string | null
  population_name_de: string | null
  population_description: string | null
  population_priority: number | null
  source_type: string
  source_label: string
  translated_source_label: string | null
  source_url: string | null
  dose_min: number | null
  dose_max: number
  unit: string
  per_kg_body_weight: number | null
  per_kg_cap: number | null
  timing: string | null
  translated_timing: string | null
  context_note: string | null
  translated_context_note: string | null
  sex_filter: string | null
  is_athlete: number
  purpose: string
  is_default: number
  relevance_score: number
  category_name: string | null
  verified_profile_id: number | null
  verified_profile_slug: string | null
  verified_profile_name: string | null
  verified_profile_credentials: string | null
  translated_verified_profile_credentials: string | null
  verified_profile_url: string | null
  verified_profile_avatar_url: string | null
  verified_profile_bio: string | null
  translated_verified_profile_bio: string | null
  verified_profile_is_verified: number | null
  published_at: number | null
  verified_at: number | null
  review_due_at: number | null
  created_at: number
  updated_at: number
  upper_limit: number | null
  upper_limit_unit: string | null
}

type SubIngredientPromptRow = {
  parent_ingredient_id: number
  child_ingredient_id: number
  child_name: string
  child_unit: string | null
  prompt_label: string | null
  is_default_prompt: number
  sort_order: number
}

type IngredientProductRow = {
  id: number
  [key: string]: unknown
}


function parsePositiveInteger(value: string): number | null {
  if (!/^\d+$/.test(value)) return null
  const parsed = Number(value)
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null
}

async function getSubIngredientsForParent(
  db: D1Database,
  parentIngredientId: number | string,
): Promise<SubIngredientPromptRow[]> {
  const { results } = await db.prepare(`
    SELECT
      isi.parent_ingredient_id,
      isi.child_ingredient_id,
      child.name AS child_name,
      child.unit AS child_unit,
      isi.prompt_label,
      isi.is_default_prompt,
      isi.sort_order
    FROM ingredient_sub_ingredients isi
    JOIN ingredients child ON child.id = isi.child_ingredient_id
    WHERE isi.parent_ingredient_id = ?
    ORDER BY isi.sort_order ASC, child.name ASC, isi.child_ingredient_id ASC
  `).bind(parentIngredientId).all<SubIngredientPromptRow>()
  return results
}

function getUpperLimitStatus(
  doseMax: number,
  doseUnit: string,
  perKgBodyWeight: number | null,
  upperLimit: number | null,
  upperLimitUnit: string | null,
  ingredientHint?: { name?: string | null }
): {
  upper_limit_exceeded: boolean
  upper_limit_warning: 'exceeded' | 'near_upper_limit' | null
  upper_limit_ratio: number | null
  upper_limit_comparison_available: boolean
  amount_converted_to_upper_limit_unit: number | null
} {
  const unavailable = {
    upper_limit_exceeded: false,
    upper_limit_warning: null as null,
    upper_limit_ratio: null,
    upper_limit_comparison_available: false,
    amount_converted_to_upper_limit_unit: null,
  }

  if (
    perKgBodyWeight !== null ||
    !Number.isFinite(doseMax) ||
    doseMax <= 0 ||
    upperLimit === null ||
    upperLimit <= 0
  ) {
    return unavailable
  }

  const doseUnitNormalized = normalizeUnit(doseUnit)
  const limitUnitNormalized = upperLimitUnit !== null ? normalizeUnit(upperLimitUnit) : null
  if (doseUnitNormalized === null || limitUnitNormalized === null) return unavailable

  // Determine the effective dose amount in upper-limit units for comparison.
  let effectiveDose: number
  let convertedAmount: number | null = null

  if (doseUnitNormalized === limitUnitNormalized) {
    effectiveDose = doseMax
  } else {
    // Attempt cross-unit conversion
    const converted = convertAmount(doseMax, doseUnit, upperLimitUnit!, ingredientHint)
    if (converted === null || !Number.isFinite(converted) || converted <= 0) return unavailable
    effectiveDose = converted
    convertedAmount = Math.round(converted * 1_000_000) / 1_000_000
  }

  const ratio = effectiveDose / upperLimit
  const roundedRatio = Math.round(ratio * 1000) / 1000

  if (ratio > 1) {
    return {
      upper_limit_exceeded: true,
      upper_limit_warning: 'exceeded',
      upper_limit_ratio: roundedRatio,
      upper_limit_comparison_available: true,
      amount_converted_to_upper_limit_unit: convertedAmount,
    }
  }
  return {
    upper_limit_exceeded: false,
    upper_limit_warning: ratio >= 0.9 ? 'near_upper_limit' : null,
    upper_limit_ratio: roundedRatio,
    upper_limit_comparison_available: true,
    amount_converted_to_upper_limit_unit: convertedAmount,
  }
}

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

// GET /api/ingredients/:id/sub-ingredients
ingredients.get('/:id/sub-ingredients', async (c) => {
  const ingredientId = parsePositiveInteger(c.req.param('id'))
  if (ingredientId === null) return c.json({ error: 'id must be a positive integer' }, 400)

  const parent = await c.env.DB.prepare(
    'SELECT id, name, unit, description FROM ingredients WHERE id = ?'
  ).bind(ingredientId).first<{
    id: number
    name: string
    unit: string | null
    description: string | null
  }>()
  if (!parent) return c.json({ error: 'Not found' }, 404)

  const subIngredients = await getSubIngredientsForParent(c.env.DB, ingredientId)
  return c.json({ parent, sub_ingredients: subIngredients })
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
  const subIngredients = await getSubIngredientsForParent(c.env.DB, id)
  return c.json({ ingredient, synonyms, forms, sub_ingredients: subIngredients })
})

// GET /api/ingredients/:id/recommendations
ingredients.get('/:id/recommendations', async (c) => {
  const ingredientId = parsePositiveInteger(c.req.param('id'))
  if (ingredientId === null) return c.json({ error: 'id must be a positive integer' }, 400)

  const language = (c.req.query('language') || 'de').trim().toLowerCase()

  try {
    const ingredient = await c.env.DB.prepare(
      'SELECT id, name, upper_limit, upper_limit_unit FROM ingredients WHERE id = ?'
    ).bind(ingredientId).first<IngredientRow>()
    if (!ingredient) return c.json({ error: 'Not found' }, 404)

    const { results: rows } = await c.env.DB.prepare(`
      SELECT
        dr.id,
        dr.ingredient_id,
        dr.population_id,
        p.slug AS population_slug,
        p.name_de AS population_name_de,
        p.description AS population_description,
        p.priority AS population_priority,
        dr.source_type,
        dr.source_label,
        drt.source_label AS translated_source_label,
        dr.source_url,
        dr.dose_min,
        dr.dose_max,
        dr.unit,
        dr.per_kg_body_weight,
        dr.per_kg_cap,
        dr.timing,
        drt.timing AS translated_timing,
        dr.context_note,
        drt.context_note AS translated_context_note,
        dr.sex_filter,
        dr.is_athlete,
        dr.purpose,
        dr.is_default,
        dr.relevance_score,
        dr.category_name,
        dr.verified_profile_id,
        vp.slug AS verified_profile_slug,
        vp.name AS verified_profile_name,
        vp.credentials AS verified_profile_credentials,
        vpt.credentials AS translated_verified_profile_credentials,
        vp.profile_url AS verified_profile_url,
        vp.avatar_url AS verified_profile_avatar_url,
        vp.bio AS verified_profile_bio,
        vpt.bio AS translated_verified_profile_bio,
        vp.is_verified AS verified_profile_is_verified,
        dr.published_at,
        dr.verified_at,
        dr.review_due_at,
        dr.created_at,
        dr.updated_at,
        i.upper_limit,
        i.upper_limit_unit
      FROM dose_recommendations dr
      JOIN ingredients i ON i.id = dr.ingredient_id
      JOIN populations p ON p.id = dr.population_id
      LEFT JOIN verified_profiles vp ON vp.id = dr.verified_profile_id
      LEFT JOIN dose_recommendation_translations drt
        ON drt.dose_recommendation_id = dr.id AND drt.language = ?
      LEFT JOIN verified_profile_translations vpt
        ON vpt.verified_profile_id = vp.id AND vpt.language = ?
      WHERE dr.ingredient_id = ?
        AND dr.is_active = 1
        AND dr.source_type <> 'user_private'
        AND (dr.source_type <> 'user_public' OR dr.is_public = 1)
      ORDER BY
        dr.relevance_score DESC,
        CASE dr.source_type
          WHEN 'official' THEN 0
          WHEN 'study' THEN 1
          WHEN 'profile' THEN 2
          WHEN 'user_public' THEN 3
          ELSE 4
        END ASC,
        COALESCE(dr.published_at, dr.verified_at, dr.updated_at, dr.created_at) DESC,
        dr.id ASC
    `).bind(language, language, ingredientId).all<DoseRecommendationQueryRow>()

    const recommendations = rows.map((row) => {
      const upperLimitStatus = getUpperLimitStatus(
        row.dose_max,
        row.unit,
        row.per_kg_body_weight,
        row.upper_limit,
        row.upper_limit_unit,
        { name: ingredient.name }
      )

      return {
        id: row.id,
        ingredient_id: row.ingredient_id,
        source: {
          type: row.source_type,
          label: row.translated_source_label ?? row.source_label,
          original_label: row.source_label,
          url: row.source_url,
        },
        dose: {
          min: row.dose_min,
          max: row.dose_max,
          unit: row.unit,
          per_kg_body_weight: row.per_kg_body_weight,
          per_kg_cap: row.per_kg_cap,
        },
        population: {
          id: row.population_id,
          slug: row.population_slug,
          name_de: row.population_name_de,
          description: row.population_description,
          priority: row.population_priority,
        },
        targeting: {
          sex_filter: row.sex_filter,
          is_athlete: row.is_athlete === 1,
          purpose: row.purpose,
        },
        context: {
          timing: row.translated_timing ?? row.timing,
          original_timing: row.timing,
          note: row.translated_context_note ?? row.context_note,
          original_note: row.context_note,
        },
        verified_profile: row.verified_profile_id === null ? null : row.verified_profile_is_verified === 1 ? {
          id: row.verified_profile_id,
          slug: row.verified_profile_slug,
          name: row.verified_profile_name,
          credentials: row.translated_verified_profile_credentials ?? row.verified_profile_credentials,
          original_credentials: row.verified_profile_credentials,
          profile_url: row.verified_profile_url,
          avatar_url: row.verified_profile_avatar_url,
          bio: row.translated_verified_profile_bio ?? row.verified_profile_bio,
          original_bio: row.verified_profile_bio,
          is_verified: true,
          missing: false,
        } : {
          is_verified: false,
          missing: row.verified_profile_is_verified === null,
        },
        upper_limit: {
          value: row.upper_limit,
          unit: row.upper_limit_unit,
          ...upperLimitStatus,
        },
        metadata: {
          is_default: row.is_default === 1,
          relevance_score: row.relevance_score,
          category_name: row.category_name,
          published_at: row.published_at,
          verified_at: row.verified_at,
          review_due_at: row.review_due_at,
          created_at: row.created_at,
          updated_at: row.updated_at,
        },
      }
    })

    return c.json({
      recommendations,
      metadata: {
        ingredient_id: ingredient.id,
        language,
        count: recommendations.length,
      },
    })
  } catch {
    return c.json({ error: 'Failed to fetch dose recommendations' }, 500)
  }
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
      WHERE ingredient_id = ?
        AND is_active = 1
        AND source_type <> 'user_private'
        AND (source_type <> 'user_public' OR is_public = 1)
      ORDER BY is_default DESC, source ASC, relevance_score DESC, id ASC
    `
  ).bind(id).all()
  return c.json({ guidelines })
})

// GET /api/ingredients/:id/products
ingredients.get('/:id/products', async (c) => {
  const id = c.req.param('id')
  const { results: products } = await c.env.DB.prepare(`
    WITH matching_rows AS (
      SELECT
        p.*,
        pi.quantity,
        pi.unit,
        pi.is_main,
        pi.basis_quantity,
        pi.basis_unit,
        pi.search_relevant,
        pi.parent_ingredient_id,
        pi.ingredient_id AS matched_ingredient_id,
        pi.form_id,
        COALESCE(idp_form.effect_summary, idp_base.effect_summary) AS effect_summary,
        COALESCE(idp_form.effect_summary, idp_base.effect_summary) AS ingredient_effect_summary,
        COALESCE(idp_form.timing, idp_base.timing, p.timing) AS timing,
        COALESCE(idp_form.timing, idp_base.timing) AS ingredient_timing,
        COALESCE(idp_form.timing_note, idp_base.timing_note) AS ingredient_timing_note,
        COALESCE(idp_form.intake_hint, idp_base.intake_hint) AS ingredient_intake_hint,
        ROW_NUMBER() OVER (
          PARTITION BY p.id
          ORDER BY
            CASE WHEN pi.ingredient_id = ? THEN 0 ELSE 1 END ASC,
            pi.is_main DESC,
            pi.id ASC
        ) AS row_rank
      FROM products p
      JOIN product_ingredients pi ON pi.product_id = p.id
      LEFT JOIN ingredient_display_profiles idp_form
        ON idp_form.ingredient_id = pi.ingredient_id
       AND idp_form.form_id = pi.form_id
       AND idp_form.sub_ingredient_id IS NULL
      LEFT JOIN ingredient_display_profiles idp_base
        ON idp_base.ingredient_id = pi.ingredient_id
       AND idp_base.form_id IS NULL
       AND idp_base.sub_ingredient_id IS NULL
      WHERE (pi.ingredient_id = ? OR pi.parent_ingredient_id = ?)
        AND pi.search_relevant = 1
        AND p.visibility = 'public'
        AND p.moderation_status = 'approved'
    )
    SELECT *
    FROM matching_rows
    WHERE row_rank = 1
    ORDER BY is_main DESC, name ASC
  `).bind(id, id, id).all<IngredientProductRow>()
  const warningsByProduct = await loadCatalogProductSafetyWarnings(c.env.DB, products.map((product) => product.id))
  return c.json({ products: attachWarningsToProducts(products, warningsByProduct) })
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
  await logAdminAction(c, {
    action: 'create_ingredient',
    entity_type: 'ingredient',
    entity_id: result.meta.last_row_id as number,
    changes: body,
  })
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
  await logAdminAction(c, {
    action: 'update_ingredient',
    entity_type: 'ingredient',
    entity_id: Number(id),
    changes: data,
  })
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
  await logAdminAction(c, {
    action: 'create_ingredient_synonym',
    entity_type: 'ingredient_synonym',
    entity_id: result.meta.last_row_id as number,
    changes: { ingredient_id: Number(id), synonym: body.synonym },
  })
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
  await logAdminAction(c, {
    action: 'delete_ingredient_synonym',
    entity_type: 'ingredient_synonym',
    entity_id: Number(synId),
    changes: { ingredient_id: Number(id) },
  })
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
  await logAdminAction(c, {
    action: 'create_ingredient_form',
    entity_type: 'ingredient_form',
    entity_id: result.meta.last_row_id as number,
    changes: { ingredient_id: Number(id), ...data },
  })
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
  await logAdminAction(c, {
    action: 'delete_ingredient_form',
    entity_type: 'ingredient_form',
    entity_id: Number(formId),
    changes: { ingredient_id: Number(id) },
  })
  return c.json({ ok: true })
})

export default ingredients

// ---------------------------------------------------------------------------
// Product recommendations sub-app (mounted at /api/recommendations for compatibility)
// ---------------------------------------------------------------------------

export const recommendationsApp = new Hono<AppContext>()

// GET /api/recommendations?ingredient_id=x (public product recommendations)
recommendationsApp.get('/', async (c) => {
  const ingredientIdParam = c.req.query('ingredient_id')
  if (!ingredientIdParam) return c.json({ error: 'ingredient_id query param required' }, 400)
  const ingredientId = Number(ingredientIdParam)
  if (!Number.isInteger(ingredientId) || ingredientId <= 0)
    return c.json({ error: 'ingredient_id must be a positive integer' }, 400)
  try {
    const { results: recommendations } = await c.env.DB.prepare(`
      WITH target_recommendations AS (
        SELECT r.*
        FROM product_recommendations r
        WHERE r.ingredient_id = ?

        UNION

        SELECT r.*
        FROM product_recommendations r
        JOIN ingredient_sub_ingredients isi ON isi.child_ingredient_id = r.ingredient_id
        WHERE isi.parent_ingredient_id = ?
      )
      SELECT DISTINCT tr.product_id, tr.type
      FROM target_recommendations tr
      JOIN products p ON p.id = tr.product_id
      JOIN product_ingredients pi
        ON pi.product_id = p.id
       AND pi.search_relevant = 1
       AND (pi.ingredient_id = tr.ingredient_id OR pi.parent_ingredient_id = tr.ingredient_id)
      WHERE p.moderation_status = 'approved'
        AND p.visibility = 'public'
      ORDER BY CASE tr.type WHEN 'recommended' THEN 0 ELSE 1 END ASC
    `).bind(ingredientId, ingredientId).all<{ product_id: number; type: string }>()
    return c.json({ recommendations })
  } catch {
    return c.json({ error: 'Failed to fetch recommendations' }, 500)
  }
})

// POST /api/recommendations (admin only, product recommendations)
recommendationsApp.post('/', async (c) => {
  const authErr = await ensureAuth(c)
  if (authErr) return authErr
  const admErr = requireAdmin(c)
  if (admErr) return admErr
  let body: Record<string, unknown>
  try {
    body = await c.req.json()
  } catch {
    return c.json({ error: 'Invalid JSON' }, 400)
  }
  const ingredientId = Number(body.ingredient_id)
  const productId = Number(body.product_id)
  if (!Number.isInteger(ingredientId) || ingredientId <= 0 || !Number.isInteger(productId) || productId <= 0) {
    return c.json({ error: 'ingredient_id and product_id must be positive integers' }, 400)
  }
  if (!['recommended', 'alternative'].includes(body.type as string)) return c.json({ error: 'type must be recommended or alternative' }, 400)
  const data = { ingredient_id: ingredientId, product_id: productId, type: body.type as string }
  const ingredient = await c.env.DB.prepare('SELECT id FROM ingredients WHERE id = ?').bind(data.ingredient_id).first()
  if (!ingredient) return c.json({ error: 'Ingredient not found' }, 404)
  const product = await c.env.DB.prepare('SELECT id FROM products WHERE id = ?').bind(data.product_id).first()
  if (!product) return c.json({ error: 'Product not found' }, 404)
  const duplicate = await c.env.DB.prepare(
    'SELECT id FROM product_recommendations WHERE ingredient_id = ? AND product_id = ?'
  ).bind(data.ingredient_id, data.product_id).first<{ id: number }>()
  if (duplicate) return c.json({ error: 'Recommendation already exists', id: duplicate.id }, 409)
  const result = await c.env.DB.prepare(
    'INSERT INTO product_recommendations (ingredient_id, product_id, type) VALUES (?, ?, ?)'
  ).bind(data.ingredient_id, data.product_id, data.type).run()
  await logAdminAction(c, {
    action: 'create_recommendation',
    entity_type: 'recommendation',
    entity_id: result.meta.last_row_id as number,
    changes: data,
  })
  return c.json({ id: result.meta.last_row_id }, 201)
})

// DELETE /api/recommendations/:id (admin only, product recommendations)
recommendationsApp.delete('/:id', async (c) => {
  const authErr = await ensureAuth(c)
  if (authErr) return authErr
  const admErr = requireAdmin(c)
  if (admErr) return admErr
  const id = c.req.param('id')
  const rec = await c.env.DB.prepare('SELECT id FROM product_recommendations WHERE id = ?').bind(id).first()
  if (!rec) return c.json({ error: 'Not found' }, 404)
  await c.env.DB.prepare('DELETE FROM product_recommendations WHERE id = ?').bind(id).run()
  await logAdminAction(c, {
    action: 'delete_recommendation',
    entity_type: 'recommendation',
    entity_id: Number(id),
  })
  return c.json({ ok: true })
})
