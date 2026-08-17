// ---------------------------------------------------------------------------
// Ingredients module
// Routes (mounted at /api/ingredients):
//   GET /           — list all
//   GET /search     — search by canonical name/synonym/form
//   GET /:id        — single ingredient + synonyms + forms + parts/precursors
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
import { globalProductVisibilitySql } from '../lib/creator-sharing-service'
import { publicProductSelect } from '../lib/public-product-projection'
import { attachWarningsToProducts, loadCatalogProductSafetyWarnings } from './knowledge'

const ingredients = new Hono<AppContext>()

type DoseRecommendationQueryRow = {
  id: number
  ingredient_id: number
  part_id: number | null
  part_name: string | null
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

type IngredientPartLinkRow = {
  ingredient_id: number
  part_id: number
  part_name: string
  part_type: string | null
  part_status: string | null
  sort_order: number
  created_at: string | null
}

type IngredientProductRow = {
  id: number
  [key: string]: unknown
}


function normalizedLookupSql(expression: string): string {
  return `lower(replace(replace(replace(${expression}, ' ', ''), '-', ''), '_', ''))`
}

function normalizeLookupValue(value: string): string {
  return value.toLowerCase().replace(/[\s\-_]/g, '')
}

function parsePositiveInteger(value: string): number | null {
  if (!/^\d+$/.test(value)) return null
  const parsed = Number(value)
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null
}

function optionalTrimmedText(value: unknown): string | null | undefined {
  if (value === undefined) return undefined
  if (value === null) return null
  if (typeof value !== 'string') return undefined
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

function optionalNumber(value: unknown): number | null | undefined {
  if (value === undefined) return undefined
  if (value === null || value === '') return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : undefined
}

function optionalBooleanInt(value: unknown): number | null | undefined {
  if (value === undefined) return undefined
  if (value === null || value === '') return null
  if (value === true || value === 1) return 1
  if (value === false || value === 0) return 0
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase()
    if (['1', 'true', 'yes', 'ja'].includes(normalized)) return 1
    if (['0', 'false', 'no', 'nein'].includes(normalized)) return 0
  }
  return undefined
}

async function hasTable(db: D1Database, tableName: string): Promise<boolean> {
  try {
    const row = await db.prepare(`
      SELECT name
      FROM sqlite_master
      WHERE type = 'table'
        AND name = ?
    `).bind(tableName).first<{ name: string }>()
    return row?.name === tableName
  } catch {
    return false
  }
}

async function getTableColumns(db: D1Database, tableName: string): Promise<Set<string>> {
  try {
    const { results } = await db.prepare(`PRAGMA table_info(${tableName})`).all<{ name: string }>()
    return new Set((results ?? []).map((row) => row.name))
  } catch {
    return new Set()
  }
}

const DOSE_RECOMMENDATION_STAGE4_COLUMNS = [
  'stage4_cluster_id',
  'stage4_source_kind',
  'knowledge_article_slug',
  'amount_type',
  'reported_amount_text',
  'stack_role',
  'stack_visible',
  'relevance_reason',
  'is_controversial',
  'valid_from',
  'valid_until',
  'stage4_status',
] as const

const DOSE_RECOMMENDATION_STAGE4_LEGACY_MARKER_COLUMNS = [
  'stage4_cluster_id',
  'stage4_source_kind',
  'knowledge_article_slug',
  'amount_type',
  'reported_amount_text',
  'stack_role',
  'relevance_reason',
  'valid_from',
  'valid_until',
] as const

function hasDoseRecommendationStage4Columns(columns: Set<string>): boolean {
  return DOSE_RECOMMENDATION_STAGE4_COLUMNS.every((column) => columns.has(column))
}

function doseRecommendationColumn(alias: string | null, column: string): string {
  return alias ? `${alias}.${column}` : column
}

function doseRecommendationOperationalVisibilityPredicate(columns: Set<string>, alias: string | null): string | null {
  if (!hasDoseRecommendationStage4Columns(columns)) return null
  const column = (name: string) => doseRecommendationColumn(alias, name)
  const legacyMarkerChecks = DOSE_RECOMMENDATION_STAGE4_LEGACY_MARKER_COLUMNS
    .map((name) => `${column(name)} IS NULL`)
    .join(' AND ')
  return `((
    ${column('stage4_status')} IS NULL
    AND ${legacyMarkerChecks}
    AND COALESCE(${column('is_controversial')}, 0) = 0
  ) OR (
    ${column('stage4_status')} = 'active'
    AND ${column('stack_visible')} = 1
  ))`
}

function doseRecommendationGuidelineVisibilityPredicate(columns: Set<string>, alias: string | null): string | null {
  const operationalPredicate = doseRecommendationOperationalVisibilityPredicate(columns, alias)
  if (!operationalPredicate) return null
  const column = (name: string) => doseRecommendationColumn(alias, name)
  return `((${operationalPredicate}) OR (
    ${column('source_type')} = 'study'
    AND ${column('stage4_status')} = 'active'
    AND ${column('amount_type')} = 'tested_amount'
  ))`
}

function doseRecommendationOptionalColumnSelect(columns: Set<string>, column: string): string {
  return columns.has(column) ? column : `NULL AS ${column}`
}

async function getSubIngredientsForParent(
  db: D1Database,
  parentIngredientId: number | string,
): Promise<SubIngredientPromptRow[]> {
  const partLinks = await getPartLinksForIngredient(db, parentIngredientId)
  return partLinks.map((link) => ({
    parent_ingredient_id: link.ingredient_id,
    child_ingredient_id: link.part_id,
    child_name: link.part_name,
    child_unit: null,
    prompt_label: null,
    is_default_prompt: 0,
    sort_order: link.sort_order,
  }))
}

async function getPartLinksForIngredient(
  db: D1Database,
  ingredientId: number | string,
): Promise<IngredientPartLinkRow[]> {
  if (!(await hasTable(db, 'ingredient_part_links')) || !(await hasTable(db, 'ingredient_parts'))) return []
  const { results } = await db.prepare(`
    SELECT
      l.ingredient_id,
      l.part_id,
      p.name AS part_name,
      p.type AS part_type,
      p.status AS part_status,
      l.sort_order,
      l.created_at
    FROM ingredient_part_links l
    JOIN ingredient_parts p ON p.id = l.part_id
    WHERE l.ingredient_id = ?
      AND p.status = 'active'
    ORDER BY l.sort_order ASC, p.name ASC, l.part_id ASC
  `).bind(ingredientId).all<IngredientPartLinkRow>()
  return results
}

function partLinkToLegacyPrecursor(link: IngredientPartLinkRow): Record<string, string | number | null> {
  return {
    ingredient_id: link.ingredient_id,
    precursor_ingredient_id: link.part_id,
    precursor_name: link.part_name,
    precursor_unit: null,
    sort_order: link.sort_order,
    note: null,
    created_at: link.created_at,
    part_id: link.part_id,
    part_name: link.part_name,
    part_type: link.part_type,
    part_status: link.part_status,
  }
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
  const { results } = await c.env.DB.prepare('SELECT * FROM ingredients WHERE is_active = 1 ORDER BY name ASC').all<IngredientRow>()
  return c.json({ ingredients: results })
})

// GET /api/ingredients/search
ingredients.get('/search', async (c) => {
  const q = (c.req.query('q') || '').trim()
  if (!q) return c.json({ ingredients: [] })
  const qNorm = normalizeLookupValue(q)
  if (!qNorm) return c.json({ ingredients: [] })

  const { results: unique } = await c.env.DB.prepare(`
    WITH form_shadow AS (
      SELECT DISTINCT child.id
      FROM ingredients child
      JOIN ingredient_forms f
      JOIN ingredients parent ON parent.id = f.ingredient_id
      WHERE child.id <> parent.id
        AND (
          ${normalizedLookupSql('child.name')} = ${normalizedLookupSql('f.name')}
          OR ${normalizedLookupSql('child.name')} = ${normalizedLookupSql('parent.name')} || ${normalizedLookupSql('f.name')}
          OR ${normalizedLookupSql('child.name')} = ${normalizedLookupSql('f.name')} || ${normalizedLookupSql('parent.name')}
        )
    ),
    matched AS (
      SELECT
        i.id,
        i.name,
        i.unit,
        i.description,
        NULL AS matched_form_id,
        NULL AS matched_form_name,
        NULL AS matched_part_id,
        NULL AS matched_part_name,
        0 AS match_rank
      FROM ingredients i
      WHERE instr(${normalizedLookupSql('i.name')}, ?) > 0
        AND i.is_active = 1
        AND NOT EXISTS (SELECT 1 FROM form_shadow fs WHERE fs.id = i.id)

      UNION ALL

      SELECT
        i.id,
        i.name,
        i.unit,
        i.description,
        NULL AS matched_form_id,
        NULL AS matched_form_name,
        NULL AS matched_part_id,
        NULL AS matched_part_name,
        1 AS match_rank
      FROM ingredient_synonyms s
      JOIN ingredients i ON i.id = s.ingredient_id
      WHERE instr(${normalizedLookupSql('s.synonym')}, ?) > 0
        AND i.is_active = 1
        AND NOT EXISTS (SELECT 1 FROM form_shadow fs WHERE fs.id = i.id)

      UNION ALL

      SELECT
        i.id,
        i.name,
        i.unit,
        i.description,
        f.id AS matched_form_id,
        f.name AS matched_form_name,
        NULL AS matched_part_id,
        NULL AS matched_part_name,
        3 AS match_rank
      FROM ingredient_forms f
      JOIN ingredients i ON i.id = f.ingredient_id
      WHERE instr(${normalizedLookupSql('f.name')}, ?) > 0
        AND i.is_active = 1
        AND NOT EXISTS (SELECT 1 FROM form_shadow fs WHERE fs.id = i.id)

      UNION ALL

      SELECT
        i.id,
        i.name,
        i.unit,
        i.description,
        NULL AS matched_form_id,
        NULL AS matched_form_name,
        p.id AS matched_part_id,
        p.name AS matched_part_name,
        2 AS match_rank
      FROM ingredient_part_links l
      JOIN ingredient_parts p ON p.id = l.part_id
      JOIN ingredients i ON i.id = l.ingredient_id
      WHERE instr(${normalizedLookupSql('p.name')}, ?) > 0
        AND p.status = 'active'
        AND i.is_active = 1

      UNION ALL

      SELECT
        i.id,
        i.name,
        i.unit,
        i.description,
        NULL AS matched_form_id,
        NULL AS matched_form_name,
        p.id AS matched_part_id,
        p.name AS matched_part_name,
        2 AS match_rank
      FROM ingredient_part_synonyms ps
      JOIN ingredient_parts p ON p.id = ps.part_id
      JOIN ingredient_part_links l ON l.part_id = p.id
      JOIN ingredients i ON i.id = l.ingredient_id
      WHERE instr(${normalizedLookupSql('ps.synonym')}, ?) > 0
        AND p.status = 'active'
        AND i.is_active = 1
    ),
    ranked AS (
      SELECT
        matched.*,
        ROW_NUMBER() OVER (
          PARTITION BY matched.id
          ORDER BY
            CASE
              WHEN matched.match_rank = 0 THEN 0
              WHEN matched.matched_part_id IS NOT NULL THEN 1
              WHEN matched.matched_form_id IS NOT NULL THEN 2
              ELSE 3
            END ASC,
            matched.match_rank ASC,
            length(matched.name) ASC,
            matched.name ASC,
            COALESCE(matched.matched_form_name, '') ASC
        ) AS row_rank
      FROM matched
    )
    SELECT id, name, unit, description, matched_form_id, matched_form_name,
           matched_part_id, matched_part_name, match_rank
    FROM ranked
    WHERE row_rank = 1
    ORDER BY
      CASE
        WHEN match_rank = 0 THEN 0
        WHEN matched_part_id IS NOT NULL THEN 1
        WHEN matched_form_id IS NOT NULL THEN 2
        ELSE 3
      END ASC,
      match_rank ASC,
      length(name) ASC,
      name ASC
    LIMIT 10
  `).bind(qNorm, qNorm, qNorm, qNorm, qNorm).all<IngredientRow & {
    matched_form_id: number | null
    matched_form_name: string | null
    matched_part_id: number | null
    matched_part_name: string | null
    match_rank: number
  }>()

  if (unique.length === 0) return c.json({ ingredients: [] })
  // Fetch synonyms for all matched ingredients in a single query
  const ids = unique.map(i => i.id)
  const placeholders = ids.map(() => '?').join(',')
  const { results: allSynonyms } = await c.env.DB.prepare(
    `SELECT ingredient_id, synonym FROM ingredient_synonyms WHERE ingredient_id IN (${placeholders}) ORDER BY synonym ASC`
  ).bind(...ids).all<{ ingredient_id: number; synonym: string }>()
  const synMap: Record<number, Array<{ synonym: string }>> = {}
  for (const s of allSynonyms) {
    if (!synMap[s.ingredient_id]) synMap[s.ingredient_id] = []
    synMap[s.ingredient_id].push({ synonym: s.synonym })
  }
  const ingredientsResult = unique.map(i => ({
    id: i.id,
    name: i.name,
    unit: i.unit,
    description: i.description,
    matched_form_id: i.matched_form_id,
    matched_form_name: i.matched_form_name,
    matched_part_id: i.matched_part_id,
    matched_part_name: i.matched_part_name,
    synonyms: synMap[i.id] ?? [],
  }))
  return c.json({ ingredients: ingredientsResult })
})

// GET /api/ingredients/:id/sub-ingredients
ingredients.get('/:id/sub-ingredients', async (c) => {
  const ingredientId = parsePositiveInteger(c.req.param('id'))
  if (ingredientId === null) return c.json({ error: 'Der Wirkstoff konnte nicht eindeutig erkannt werden.' }, 400)

  const parent = await c.env.DB.prepare(
    'SELECT id, name, unit, description FROM ingredients WHERE id = ?'
  ).bind(ingredientId).first<{
    id: number
    name: string
    unit: string | null
    description: string | null
  }>()
  if (!parent) return c.json({ error: 'Der Wirkstoff wurde nicht gefunden.' }, 404)

  const subIngredients = await getSubIngredientsForParent(c.env.DB, ingredientId)
  const parts = await getPartLinksForIngredient(c.env.DB, ingredientId)
  return c.json({ parent, parts, sub_ingredients: subIngredients })
})

// GET /api/ingredients/:id
ingredients.get('/:id', async (c) => {
  const id = parsePositiveInteger(c.req.param('id'))
  if (id === null) return c.json({ error: 'Der Wirkstoff konnte nicht eindeutig erkannt werden.' }, 400)
  const ingredient = await c.env.DB.prepare('SELECT * FROM ingredients WHERE id = ?').bind(id).first<IngredientRow>()
  if (!ingredient) return c.json({ error: 'Der Wirkstoff wurde nicht gefunden.' }, 404)
  const { results: synonyms } = await c.env.DB.prepare(
    'SELECT * FROM ingredient_synonyms WHERE ingredient_id = ? ORDER BY synonym ASC'
  ).bind(id).all()
  const { results: forms } = await c.env.DB.prepare(
    'SELECT * FROM ingredient_forms WHERE ingredient_id = ? ORDER BY score DESC, name ASC, id ASC'
  ).bind(id).all()
  const subIngredients = await getSubIngredientsForParent(c.env.DB, id)
  const parts = await getPartLinksForIngredient(c.env.DB, id)
  const precursors = parts.map((link) => partLinkToLegacyPrecursor(link))
  return c.json({
    ingredient,
    synonyms,
    forms,
    parts,
    sub_ingredients: subIngredients,
    precursors,
  })
})

// GET /api/ingredients/:id/recommendations
ingredients.get('/:id/recommendations', async (c) => {
  const ingredientId = parsePositiveInteger(c.req.param('id'))
  if (ingredientId === null) return c.json({ error: 'Der Wirkstoff konnte nicht eindeutig erkannt werden.' }, 400)

  const language = (c.req.query('language') || 'de').trim().toLowerCase()
  const rawPartId = c.req.query('part_id')?.trim()
  const requestedPartId = rawPartId ? parsePositiveInteger(rawPartId) : null
  if (rawPartId && requestedPartId === null) return c.json({ error: 'Der ausgewählte Bestandteil ist ungültig.' }, 400)
  if (requestedPartId !== null) {
    const linkedPart = await c.env.DB.prepare(`
      SELECT p.id
      FROM ingredient_part_links l
      JOIN ingredient_parts p ON p.id = l.part_id
      WHERE l.ingredient_id = ? AND l.part_id = ? AND p.status = 'active'
    `).bind(ingredientId, requestedPartId).first<{ id: number }>()
    if (!linkedPart) return c.json({ error: 'Der ausgewählte Bestandteil gehört nicht zu diesem Wirkstoff oder ist nicht verfügbar.' }, 400)
  }

  try {
    const ingredient = await c.env.DB.prepare(
      'SELECT id, name, upper_limit, upper_limit_unit FROM ingredients WHERE id = ?'
    ).bind(ingredientId).first<IngredientRow>()
    if (!ingredient) return c.json({ error: 'Der Wirkstoff wurde nicht gefunden.' }, 404)

    const recommendationColumns = await getTableColumns(c.env.DB, 'dose_recommendations')
    const stage4VisibilityPredicate = doseRecommendationOperationalVisibilityPredicate(recommendationColumns, 'dr')
    const stage4VisibilitySql = stage4VisibilityPredicate ? `AND ${stage4VisibilityPredicate}` : ''

    const { results: rows } = await c.env.DB.prepare(`
      SELECT
        dr.id,
        dr.ingredient_id,
        dr.part_id,
        part.name AS part_name,
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
      LEFT JOIN ingredient_parts part ON part.id = dr.part_id
      JOIN populations p ON p.id = dr.population_id
      LEFT JOIN verified_profiles vp ON vp.id = dr.verified_profile_id
      LEFT JOIN dose_recommendation_translations drt
        ON drt.dose_recommendation_id = dr.id AND drt.language = ?
      LEFT JOIN verified_profile_translations vpt
        ON vpt.verified_profile_id = vp.id AND vpt.language = ?
      WHERE dr.ingredient_id = ?
        AND ((? IS NULL AND dr.part_id IS NULL) OR (? IS NOT NULL AND (dr.part_id = ? OR dr.part_id IS NULL)))
        AND dr.is_active = 1
        AND dr.source_type <> 'user_private'
        AND (dr.source_type <> 'user_public' OR dr.is_public = 1)
        ${stage4VisibilitySql}
      ORDER BY
        CASE WHEN dr.part_id = ? THEN 0 ELSE 1 END ASC,
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
    `).bind(
      language,
      language,
      ingredientId,
      requestedPartId,
      requestedPartId,
      requestedPartId,
      requestedPartId,
    ).all<DoseRecommendationQueryRow>()

    const recommendations = rows.map((row) => {
      const upperLimitStatus = getUpperLimitStatus(
        row.dose_max,
        row.unit,
        row.per_kg_body_weight,
        row.part_id === null ? row.upper_limit : null,
        row.part_id === null ? row.upper_limit_unit : null,
        { name: ingredient.name }
      )

      return {
        id: row.id,
        ingredient_id: row.ingredient_id,
        part_id: row.part_id,
        part_name: row.part_name,
        is_parent_fallback: requestedPartId !== null && row.part_id === null,
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
          value: row.part_id === null ? row.upper_limit : null,
          unit: row.part_id === null ? row.upper_limit_unit : null,
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
  const id = parsePositiveInteger(c.req.param('id'))
  if (id === null) return c.json({ error: 'Der Wirkstoff konnte nicht eindeutig erkannt werden.' }, 400)
  const rawPartId = c.req.query('part_id')?.trim()
  const partId = rawPartId ? parsePositiveInteger(rawPartId) : null
  if (rawPartId && partId === null) return c.json({ error: 'Der ausgewählte Bestandteil ist ungültig.' }, 400)
  if (partId !== null) {
    const linkedPart = await c.env.DB.prepare(`
      SELECT p.id
      FROM ingredient_part_links l
      JOIN ingredient_parts p ON p.id = l.part_id
      WHERE l.ingredient_id = ? AND l.part_id = ? AND p.status = 'active'
    `).bind(id, partId).first<{ id: number }>()
    if (!linkedPart) return c.json({ error: 'Der ausgewählte Bestandteil gehört nicht zu diesem Wirkstoff oder ist nicht verfügbar.' }, 400)
  }
  const recommendationColumns = await getTableColumns(c.env.DB, 'dose_recommendations')
  const stage4VisibilityPredicate = doseRecommendationGuidelineVisibilityPredicate(recommendationColumns, null)
  const stage4VisibilitySql = stage4VisibilityPredicate ? `AND ${stage4VisibilityPredicate}` : ''
  const { results: guidelines } = await c.env.DB.prepare(
    `
      SELECT
        id,
        ingredient_id,
        part_id,
        (SELECT name FROM ingredient_parts WHERE id = dose_recommendations.part_id) AS part_name,
        CASE WHEN ? IS NOT NULL AND part_id IS NULL THEN 1 ELSE 0 END AS is_parent_fallback,
        source_type,
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
        is_default,
        ${doseRecommendationOptionalColumnSelect(recommendationColumns, 'amount_type')},
        ${doseRecommendationOptionalColumnSelect(recommendationColumns, 'stack_role')},
        ${doseRecommendationOptionalColumnSelect(recommendationColumns, 'stage4_status')},
        ${doseRecommendationOptionalColumnSelect(recommendationColumns, 'stack_visible')}
      FROM dose_recommendations
      WHERE ingredient_id = ?
        AND ((? IS NULL AND part_id IS NULL) OR (? IS NOT NULL AND (part_id = ? OR part_id IS NULL)))
        AND is_active = 1
        AND source_type <> 'user_private'
        AND (source_type <> 'user_public' OR is_public = 1)
        ${stage4VisibilitySql}
      ORDER BY CASE WHEN part_id = ? THEN 0 ELSE 1 END ASC, is_default DESC, source ASC, relevance_score DESC, id ASC
    `
  ).bind(partId, id, partId, partId, partId, partId).all()
  return c.json({ guidelines })
})

// GET /api/ingredients/:id/products
ingredients.get('/:id/products', async (c) => {
  const productVisibility = await globalProductVisibilitySql(c.env.DB, 'p')
  const id = parsePositiveInteger(c.req.param('id'))
  if (id === null) return c.json({ error: 'Der Wirkstoff konnte nicht eindeutig erkannt werden.' }, 400)
  const rawFormId = c.req.query('form_id')?.trim()
  const formId = rawFormId ? parsePositiveInteger(rawFormId) : null
  if (rawFormId && formId === null) return c.json({ error: 'Die ausgewählte Darreichungsform ist ungültig.' }, 400)
  const rawPartId = c.req.query('part_id')?.trim()
  const partId = rawPartId ? parsePositiveInteger(rawPartId) : null
  if (rawPartId && partId === null) return c.json({ error: 'Der ausgewählte Bestandteil ist ungültig.' }, 400)
  if (formId !== null) {
    const form = await c.env.DB.prepare(
      'SELECT id FROM ingredient_forms WHERE id = ? AND ingredient_id = ?'
    ).bind(formId, id).first<{ id: number }>()
    if (!form) return c.json({ error: 'Die ausgewählte Darreichungsform gehört nicht zu diesem Wirkstoff.' }, 400)
  }
  if (partId !== null) {
    const part = await c.env.DB.prepare(`
      SELECT p.id
      FROM ingredient_part_links l
      JOIN ingredient_parts p ON p.id = l.part_id
      WHERE l.ingredient_id = ? AND l.part_id = ? AND p.status = 'active'
    `).bind(id, partId).first<{ id: number }>()
    if (!part) return c.json({ error: 'Der ausgewählte Bestandteil gehört nicht zu diesem Wirkstoff oder ist nicht verfügbar.' }, 400)
  }
  const recommendationColumns = await getTableColumns(c.env.DB, 'product_recommendations')
  const hasRecommendationSlots = recommendationColumns.has('recommendation_slot') && recommendationColumns.has('shop_link_id')
  const hasShopLinks = hasRecommendationSlots && await hasTable(c.env.DB, 'product_shop_links')
  const recommendationSelect = hasRecommendationSlots
    ? `
        CASE rec.recommendation_slot
          WHEN 'primary' THEN 0
          WHEN 'alternative_1' THEN 1
          WHEN 'alternative_2' THEN 2
          ELSE 99
        END AS recommendation_rank,
        COALESCE(rec.sort_order, 999) AS recommendation_sort_order,
        rec.recommendation_slot,
        rec.shop_link_id AS recommendation_shop_link_id,
        ${hasShopLinks ? 'psl.url' : 'NULL'} AS recommendation_shop_link_url,`
    : `
        99 AS recommendation_rank,
        999 AS recommendation_sort_order,
        NULL AS recommendation_slot,
        NULL AS recommendation_shop_link_id,
        NULL AS recommendation_shop_link_url,`
  const recommendationJoin = hasRecommendationSlots
    ? `
      LEFT JOIN product_recommendations rec
        ON rec.ingredient_id = ?
       AND rec.product_id = p.id
       AND rec.recommendation_slot IN ('primary', 'alternative_1', 'alternative_2')
      ${hasShopLinks ? 'LEFT JOIN product_shop_links psl ON psl.id = rec.shop_link_id AND psl.product_id = p.id' : ''}`
    : ''
  const recommendationOrder = hasRecommendationSlots
    ? `
            CASE rec.recommendation_slot
              WHEN 'primary' THEN 0
              WHEN 'alternative_1' THEN 1
              WHEN 'alternative_2' THEN 2
              ELSE 99
            END ASC,
            COALESCE(rec.sort_order, 999) ASC,`
    : ''
  const partSelect = partId === null
    ? `NULL AS matched_part_id, NULL AS matched_part_name,
       NULL AS matched_part_quantity, NULL AS matched_part_unit,
       NULL AS matched_part_basis_quantity, NULL AS matched_part_basis_unit,`
    : `pip.part_id AS matched_part_id, part.name AS matched_part_name,
       pip.quantity AS matched_part_quantity, pip.unit AS matched_part_unit,
       COALESCE(pip.basis_quantity, pi.basis_quantity) AS matched_part_basis_quantity,
       COALESCE(pip.basis_unit, pi.basis_unit) AS matched_part_basis_unit,`
  const partJoin = partId === null
    ? ''
    : `JOIN product_ingredient_parts pip
         ON pip.product_ingredient_id = pi.id
        AND pip.part_id = ?
        AND pip.search_relevant = 1
       JOIN ingredient_parts part ON part.id = pip.part_id AND part.status = 'active'`
  const partDisplaySelect = partId === null
    ? {
        timing: 'COALESCE(idp_form.timing, idp_base.timing)',
        timingNote: 'COALESCE(idp_form.timing_note, idp_base.timing_note)',
        intakeHint: 'COALESCE(idp_form.intake_hint, idp_base.intake_hint)',
      }
    : {
        timing: 'COALESCE(idp_part.timing, idp_form.timing, idp_base.timing)',
        timingNote: 'COALESCE(idp_part.timing_note, idp_form.timing_note, idp_base.timing_note)',
        intakeHint: 'COALESCE(idp_part.intake_hint, idp_form.intake_hint, idp_base.intake_hint)',
      }
  const partDisplayJoin = partId === null
    ? ''
    : `LEFT JOIN ingredient_display_profiles idp_part
         ON idp_part.ingredient_id = pi.ingredient_id
        AND idp_part.part_id = ?
        AND idp_part.form_id IS NULL
        AND idp_part.sub_ingredient_id IS NULL`
  const bindings: Array<number | null> = [id]
  if (partId !== null) bindings.push(partId)
  if (partId !== null) bindings.push(partId)
  if (hasRecommendationSlots) bindings.push(id)
  bindings.push(id, formId, formId)
  const { results: products } = await c.env.DB.prepare(`
    WITH matching_rows AS (
      SELECT
        ${publicProductSelect()},
        pi.quantity,
        pi.unit,
        pi.is_main,
        pi.basis_quantity,
        pi.basis_unit,
        pi.search_relevant,
        pi.parent_ingredient_id,
        pi.ingredient_id AS matched_ingredient_id,
        pi.form_id,
        ${partSelect}
        COALESCE(${partDisplaySelect.timing}, p.timing) AS timing,
        ${partDisplaySelect.timing} AS ingredient_timing,
        ${partDisplaySelect.timingNote} AS ingredient_timing_note,
        ${partDisplaySelect.intakeHint} AS ingredient_intake_hint,
        ${recommendationSelect}
        ROW_NUMBER() OVER (
          PARTITION BY p.id
          ORDER BY
            ${recommendationOrder}
            CASE WHEN pi.ingredient_id = ? THEN 0 ELSE 1 END ASC,
            pi.is_main DESC,
            pi.id ASC
        ) AS row_rank
      FROM products p
      JOIN product_ingredients pi ON pi.product_id = p.id
      ${partJoin}
      ${partDisplayJoin}
      LEFT JOIN ingredient_display_profiles idp_form
        ON idp_form.ingredient_id = pi.ingredient_id
       AND idp_form.form_id = pi.form_id
       AND idp_form.part_id IS NULL
       AND idp_form.sub_ingredient_id IS NULL
      LEFT JOIN ingredient_display_profiles idp_base
        ON idp_base.ingredient_id = pi.ingredient_id
       AND idp_base.form_id IS NULL
       AND idp_base.part_id IS NULL
       AND idp_base.sub_ingredient_id IS NULL
      ${recommendationJoin}
      WHERE pi.ingredient_id = ?
        AND (? IS NULL OR pi.form_id = ?)
        AND pi.search_relevant = 1
        AND ${productVisibility}
    )
    SELECT *
    FROM matching_rows
    WHERE row_rank = 1
    ORDER BY recommendation_rank ASC, recommendation_sort_order ASC, is_main DESC, name ASC
  `).bind(...bindings).all<IngredientProductRow>()
  const normalizedProducts = (products ?? []).map((product) => {
    const shopLinkId = typeof product.recommendation_shop_link_id === 'number'
      ? product.recommendation_shop_link_id
      : null
    const shopLinkUrl = typeof product.recommendation_shop_link_url === 'string'
      ? product.recommendation_shop_link_url
      : null
    if (!shopLinkId || !shopLinkUrl) return product
    return {
      ...product,
      shop_link: shopLinkUrl,
      shop_link_id: shopLinkId,
      click_url: `/api/products/${product.id}/out?shop_link_id=${shopLinkId}&context=product_card`,
    }
  })
  const warningsByProduct = await loadCatalogProductSafetyWarnings(c.env.DB, normalizedProducts.map((product) => product.id))
  return c.json({ products: attachWarningsToProducts(normalizedProducts, warningsByProduct) })
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

// PATCH /api/ingredients/:id/synonyms/:synId (admin only)
ingredients.patch('/:id/synonyms/:synId', async (c) => {
  const authErr = await ensureAuth(c)
  if (authErr) return authErr
  const admErr = requireAdmin(c)
  if (admErr) return admErr
  const id = c.req.param('id')
  const synId = c.req.param('synId')
  const existing = await c.env.DB.prepare(
    'SELECT * FROM ingredient_synonyms WHERE id = ? AND ingredient_id = ?'
  ).bind(synId, id).first<Record<string, unknown>>()
  if (!existing) return c.json({ error: 'Not found' }, 404)

  let body: Record<string, unknown>
  try {
    body = await c.req.json()
  } catch {
    return c.json({ error: 'Invalid JSON' }, 400)
  }

  const columns = await getTableColumns(c.env.DB, 'ingredient_synonyms')
  const fields: Array<[string, string | number | null]> = []
  if (Object.prototype.hasOwnProperty.call(body, 'synonym')) {
    const synonym = optionalTrimmedText(body.synonym)
    if (synonym === undefined || synonym === null) return c.json({ error: 'synonym is required' }, 400)
    fields.push(['synonym', synonym])
  }
  if (columns.has('language') && Object.prototype.hasOwnProperty.call(body, 'language')) {
    const language = optionalTrimmedText(body.language)
    fields.push(['language', language ?? 'de'])
  }
  if (fields.length === 0) return c.json({ error: 'No supported fields provided' }, 400)

  await c.env.DB.prepare(`
    UPDATE ingredient_synonyms
    SET ${fields.map(([key]) => `${key} = ?`).join(', ')}
    WHERE id = ? AND ingredient_id = ?
  `).bind(...fields.map(([, value]) => value), synId, id).run()
  const updated = await c.env.DB.prepare('SELECT * FROM ingredient_synonyms WHERE id = ?').bind(synId).first()
  await logAdminAction(c, {
    action: 'update_ingredient_synonym',
    entity_type: 'ingredient_synonym',
    entity_id: Number(synId),
    changes: { ingredient_id: Number(id), before: existing, after: updated },
  })
  return c.json({ synonym: updated })
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

// PATCH /api/ingredients/:id/forms/:formId (admin only)
ingredients.patch('/:id/forms/:formId', async (c) => {
  const authErr = await ensureAuth(c)
  if (authErr) return authErr
  const admErr = requireAdmin(c)
  if (admErr) return admErr
  const id = c.req.param('id')
  const formId = c.req.param('formId')
  const existing = await c.env.DB.prepare(
    'SELECT * FROM ingredient_forms WHERE id = ? AND ingredient_id = ?'
  ).bind(formId, id).first<Record<string, unknown>>()
  if (!existing) return c.json({ error: 'Not found' }, 404)

  let body: Record<string, unknown>
  try {
    body = await c.req.json()
  } catch {
    return c.json({ error: 'Invalid JSON' }, 400)
  }

  const columns = await getTableColumns(c.env.DB, 'ingredient_forms')
  const fields: Array<[string, string | number | null]> = []
  const textFields = ['name', 'comment', 'tags', 'bioavailability', 'timing'] as const
  for (const field of textFields) {
    if (!columns.has(field) || !Object.prototype.hasOwnProperty.call(body, field)) continue
    const value = optionalTrimmedText(body[field])
    if (field === 'name' && (value === undefined || value === null)) return c.json({ error: 'name is required' }, 400)
    if (value !== undefined) fields.push([field, value])
  }
  if (columns.has('score') && Object.prototype.hasOwnProperty.call(body, 'score')) {
    const score = optionalNumber(body.score)
    if (score === undefined) return c.json({ error: 'score must be a number' }, 400)
    fields.push(['score', score ?? 0])
  }
  if (columns.has('is_recommended') && Object.prototype.hasOwnProperty.call(body, 'is_recommended')) {
    const recommended = optionalBooleanInt(body.is_recommended)
    if (recommended === undefined) return c.json({ error: 'is_recommended must be boolean' }, 400)
    fields.push(['is_recommended', recommended ?? 0])
  }
  if (fields.length === 0) return c.json({ error: 'No supported fields provided' }, 400)

  await c.env.DB.prepare(`
    UPDATE ingredient_forms
    SET ${fields.map(([key]) => `${key} = ?`).join(', ')}
    WHERE id = ? AND ingredient_id = ?
  `).bind(...fields.map(([, value]) => value), formId, id).run()
  const updated = await c.env.DB.prepare('SELECT * FROM ingredient_forms WHERE id = ?').bind(formId).first()
  await logAdminAction(c, {
    action: 'update_ingredient_form',
    entity_type: 'ingredient_form',
    entity_id: Number(formId),
    changes: { ingredient_id: Number(id), before: existing, after: updated },
  })
  return c.json({ form: updated })
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
    const productVisibility = await globalProductVisibilitySql(c.env.DB, 'p')
    const { results: recommendations } = await c.env.DB.prepare(`
      SELECT DISTINCT r.product_id, r.type
      FROM product_recommendations r
      JOIN products p ON p.id = r.product_id
      JOIN product_ingredients pi
        ON pi.product_id = p.id
       AND pi.search_relevant = 1
       AND pi.ingredient_id = r.ingredient_id
      WHERE r.ingredient_id = ?
        AND ${productVisibility}
      ORDER BY CASE r.type WHEN 'recommended' THEN 0 ELSE 1 END ASC
    `).bind(ingredientId).all<{ product_id: number; type: string }>()
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
