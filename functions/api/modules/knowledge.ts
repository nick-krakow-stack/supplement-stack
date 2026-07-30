import { Hono } from 'hono'
import type { AppContext } from '../lib/types'
import { ingredientAmountPerProductServing } from '../lib/stack-calculations'
import {
  appendLegacyInternalSourceTargets,
  bindV2ProjectionSourcesToRows,
  enrichV2SourcesWithInternalArticles,
  internalSourceArticleTargetLookupKeys,
  parseArticleSourcesPayload,
  projectFullyCoveredV2SourcesToInternalArticles,
  type ArticleSource,
  type ArticleSourceRow,
  type InternalSourceArticleTarget,
} from './knowledge-source-projection'
import {
  hashKnowledgeOverviewRows,
  loadKnowledgeOverview,
  refreshKnowledgeOverviewProjection,
} from './knowledge-overview-projection'

export {
  appendLegacyInternalSourceTargets,
  bindV2ProjectionSourcesToRows,
  enrichV2SourcesWithInternalArticles,
  internalSourceArticleTargetLookupKeys,
  parseArticleSourcesPayload,
  projectFullyCoveredV2SourcesToInternalArticles,
} from './knowledge-source-projection'

const knowledge = new Hono<AppContext>()

type KnowledgeArticleRow = {
  slug: string
  title: string
  summary: string
  body: string
  status: string
  article_layer: string | null
  reviewed_at: string | null
  sources_json: string
  conclusion: string | null
  featured_image_url: string | null
  featured_image_r2_key: string | null
  dose_min: number | null
  dose_max: number | null
  dose_unit: string | null
  product_note: string | null
  seo_json: string | null
  created_at: string
  updated_at: string
}

export type PublicKnowledgeArticleSeo = {
  meta_title: string
  meta_description: string
  canonical_url: string
  canonical_path: string
  robots: string
  indexable: boolean
  json_ld: Record<string, unknown>
}

export type PublicKnowledgeArticle = {
  slug: string
  title: string
  summary: string
  body: string
  article_layer: string | null
  reviewed_at: string | null
  conclusion: string | null
  featured_image_url: string | null
  featured_image_r2_key: string | null
  dose_min: number | null
  dose_max: number | null
  dose_unit: string | null
  product_note: string | null
  sources: ArticleSource[]
  ingredients: ArticleIngredientRow[]
  ingredient_ids: number[]
  created_at: string
  updated_at: string
  published_at: string
  modified_at: string
  seo: PublicKnowledgeArticleSeo | null
}

function parsePublicKnowledgeArticleSeo(value: string | null): PublicKnowledgeArticleSeo | null {
  if (!value) return null
  try {
    const parsed = JSON.parse(value) as Partial<PublicKnowledgeArticleSeo>
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null
    if (typeof parsed.meta_title !== 'string' || typeof parsed.meta_description !== 'string' || typeof parsed.canonical_url !== 'string' || typeof parsed.canonical_path !== 'string' || typeof parsed.robots !== 'string' || typeof parsed.indexable !== 'boolean' || !parsed.json_ld || typeof parsed.json_ld !== 'object' || Array.isArray(parsed.json_ld)) return null
    return parsed as PublicKnowledgeArticleSeo
  } catch {
    return null
  }
}

type InternalSourceArticleRow = {
  source_url: string | null
  doi: string | null
  pubmed_id: string | null
  source_label: string | null
  internal_slug: string
  internal_title: string
}

type ArticleIngredientRow = {
  ingredient_id: number
  name: string | null
  sort_order: number
}

export type ProductSafetyWarning = {
  id: number
  ingredient_id: number
  short_label: string
  popover_text: string
  severity: 'info' | 'caution' | 'danger'
  article_slug: string | null
  article_title: string | null
  article_url: string | null
}

type WarningMatchRow = {
  product_id: number
  id: number
  ingredient_id: number
  short_label: string
  popover_text: string
  severity: string
  article_slug: string | null
  article_title: string | null
  min_amount: number | null
  warning_unit: string | null
  quantity: number | null
  unit: string | null
  basis_quantity: number | null
  basis_unit: string | null
  serving_size: number | null
  serving_unit: string | null
}

type ProductWithId = {
  id: number
  warnings?: ProductSafetyWarning[]
}

function parseSources(value: string): ArticleSource[] {
  return parseArticleSourcesPayload(value).sources
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

async function loadInternalSourceArticleTargets(
  db: D1Database,
  ingredientIds: number[],
): Promise<Map<string, InternalSourceArticleTarget[]>> {
  const ids = [...new Set(ingredientIds.filter((id) => Number.isInteger(id) && id > 0))]
  if (ids.length === 0) return new Map()
  const articleColumns = await getTableColumns(db, 'knowledge_articles')
  if (!articleColumns.has('article_layer')) return new Map()

  const placeholders = ids.map(() => '?').join(',')
  const rows: InternalSourceArticleRow[] = []
  if (
    (await hasTable(db, 'knowledge_article_sources'))
    && (await hasTable(db, 'knowledge_article_ingredients'))
  ) {
    const { results } = await db.prepare(`
      SELECT
        kas.url AS source_url,
        NULL AS doi,
        NULL AS pubmed_id,
        kas.label AS source_label,
        ka.slug AS internal_slug,
        ka.title AS internal_title
      FROM knowledge_article_sources kas
      JOIN knowledge_articles ka
        ON ka.slug = kas.article_slug
      JOIN knowledge_article_ingredients kai
        ON kai.article_slug = ka.slug
      WHERE kai.ingredient_id IN (${placeholders})
        AND ka.status = 'published'
        AND ka.article_layer = 'single_study'
      ORDER BY ka.slug ASC, ka.title ASC, kas.sort_order ASC, kas.id ASC
    `).bind(...ids).all<InternalSourceArticleRow>()
    rows.push(...(results ?? []))
  }

  if (
    (await hasTable(db, 'ingredient_research_sources'))
    && (await hasTable(db, 'study_interpretation_records'))
  ) {
    const { results } = await db.prepare(`
      SELECT
        irs.source_url,
        irs.doi,
        irs.pubmed_id,
        irs.source_title AS source_label,
        ka.slug AS internal_slug,
        ka.title AS internal_title
      FROM ingredient_research_sources irs
      JOIN study_interpretation_records sir
        ON sir.source_id = irs.id
       AND sir.ingredient_id = irs.ingredient_id
      JOIN knowledge_articles ka
        ON ka.slug = sir.knowledge_article_slug
      WHERE irs.ingredient_id IN (${placeholders})
        AND sir.status = 'accepted'
        AND sir.knowledge_article_slug IS NOT NULL
        AND ka.status = 'published'
        AND ka.article_layer = 'single_study'
      ORDER BY ka.slug ASC, ka.title ASC
    `).bind(...ids).all<InternalSourceArticleRow>()
    rows.push(...(results ?? []))
  }

  const targets = new Map<string, InternalSourceArticleTarget[]>()
  for (const row of rows) {
    const keys = internalSourceArticleTargetLookupKeys(row)

    for (const key of keys) {
      const existing = targets.get(key) ?? []
      if (!existing.some((target) => target.slug === row.internal_slug)) {
        existing.push({ slug: row.internal_slug, title: row.internal_title })
        targets.set(key, existing)
      }
    }
  }

  return targets
}

async function loadArticleSources(
  db: D1Database,
  slug: string,
  fallbackJson: string,
  options: {
    articleLayer?: string | null
    ingredientIds?: number[]
  } = {},
): Promise<ArticleSource[]> {
  const fallback = parseArticleSourcesPayload(fallbackJson)
  let sources: ArticleSource[] | null = null
  if (await hasTable(db, 'knowledge_article_sources')) {
    const { results } = await db.prepare(`
      SELECT label, url, sort_order
      FROM knowledge_article_sources
      WHERE article_slug = ?
      ORDER BY sort_order ASC, id ASC
    `).bind(slug).all<ArticleSourceRow>()
    const sourceRows = results ?? []
    if (fallback.isV2Projection || sourceRows.length > 0) {
      sources = bindV2ProjectionSourcesToRows(fallback, sourceRows)
    }
  }

  sources = sources ?? fallback.sources
  if (options.articleLayer !== 'main_article') return sources

  const targets = await loadInternalSourceArticleTargets(db, options.ingredientIds ?? [])
  const externalSources = sources.filter((source) => /^https?:\/\//i.test(source.url))
  if (externalSources.length > 0) {
    const internalOnly = projectFullyCoveredV2SourcesToInternalArticles(externalSources, targets)
    if (internalOnly) return internalOnly
  }
  if (fallback.isV2Projection) {
    return enrichV2SourcesWithInternalArticles(sources, targets)
  }
  return appendLegacyInternalSourceTargets(sources, targets)
}

async function loadArticleIngredients(db: D1Database, slug: string): Promise<ArticleIngredientRow[]> {
  if (!(await hasTable(db, 'knowledge_article_ingredients'))) return []
  const { results } = await db.prepare(`
    SELECT kai.ingredient_id, i.name, kai.sort_order
    FROM knowledge_article_ingredients kai
    LEFT JOIN ingredients i ON i.id = kai.ingredient_id
    WHERE kai.article_slug = ?
    ORDER BY kai.sort_order ASC, i.name ASC
  `).bind(slug).all<ArticleIngredientRow>()
  return results ?? []
}

function normalizeMassUnit(unit?: string | null): 'ug' | 'mg' | 'g' | null {
  const normalized = (unit ?? '').trim().toLowerCase().replace(/\u03bc/g, '\u00b5')
  if (['ug', 'mcg', '\u00b5g'].includes(normalized)) return 'ug'
  if (normalized === 'mg') return 'mg'
  if (normalized === 'g') return 'g'
  return null
}

function toMicrograms(value: number, unit?: string | null): number | null {
  const normalized = normalizeMassUnit(unit)
  if (normalized === 'ug') return value
  if (normalized === 'mg') return value * 1000
  if (normalized === 'g') return value * 1_000_000
  return null
}

function convertMassAmount(value: number, fromUnit?: string | null, toUnit?: string | null): number | null {
  const micrograms = toMicrograms(value, fromUnit)
  const target = normalizeMassUnit(toUnit)
  if (micrograms === null || target === null) return null
  if (target === 'ug') return micrograms
  if (target === 'mg') return micrograms / 1000
  if (target === 'g') return micrograms / 1_000_000
  return null
}

function warningApplies(row: WarningMatchRow): boolean {
  if (row.min_amount === null || row.min_amount <= 0 || !row.warning_unit) return true

  const amountPerServing = ingredientAmountPerProductServing(row, {
    serving_size: row.serving_size,
    serving_unit: row.serving_unit,
  })
  if (amountPerServing === null) return true

  const comparableAmount = convertMassAmount(amountPerServing, row.unit, row.warning_unit)
  if (comparableAmount === null) return true

  return comparableAmount >= row.min_amount
}

function severityRank(severity: string): number {
  if (severity === 'danger') return 0
  if (severity === 'caution') return 1
  return 2
}

function groupWarnings(rows: WarningMatchRow[]): Map<number, ProductSafetyWarning[]> {
  const grouped = new Map<number, ProductSafetyWarning[]>()
  const seen = new Set<string>()

  for (const row of rows) {
    if (!warningApplies(row)) continue
    const key = `${row.product_id}:${row.id}`
    if (seen.has(key)) continue
    seen.add(key)

    const warnings = grouped.get(row.product_id) ?? []
    warnings.push({
      id: row.id,
      ingredient_id: row.ingredient_id,
      short_label: row.short_label,
      popover_text: row.popover_text,
      severity: row.severity === 'danger' || row.severity === 'info' ? row.severity : 'caution',
      article_slug: row.article_slug,
      article_title: row.article_title,
      article_url: row.article_slug ? `/wissen/${row.article_slug}` : null,
    })
    grouped.set(row.product_id, warnings)
  }

  for (const [productId, warnings] of grouped.entries()) {
    warnings.sort((a, b) => severityRank(a.severity) - severityRank(b.severity) || a.short_label.localeCompare(b.short_label))
    grouped.set(productId, warnings)
  }

  return grouped
}

export async function loadCatalogProductSafetyWarnings(
  db: D1Database,
  productIds: number[],
): Promise<Map<number, ProductSafetyWarning[]>> {
  const ids = [...new Set(productIds.filter((id) => Number.isInteger(id) && id > 0))]
  if (ids.length === 0) return new Map()

  const placeholders = ids.map(() => '?').join(',')
  const { results } = await db.prepare(`
    SELECT
      pi.product_id,
      w.id,
      w.ingredient_id,
      w.short_label,
      w.popover_text,
      w.severity,
      w.article_slug,
      ka.title AS article_title,
      w.min_amount,
      w.unit AS warning_unit,
      pi.quantity,
      pi.unit,
      pi.basis_quantity,
      pi.basis_unit,
      p.serving_size,
      p.serving_unit
    FROM ingredient_safety_warnings w
    JOIN product_ingredients pi
      ON pi.ingredient_id = w.ingredient_id
     AND (w.form_id IS NULL OR w.form_id = pi.form_id)
    JOIN products p ON p.id = pi.product_id
    LEFT JOIN knowledge_articles ka ON ka.slug = w.article_slug AND ka.status = 'published'
    WHERE w.active = 1
      AND pi.product_id IN (${placeholders})
    ORDER BY pi.product_id ASC, w.id ASC
  `).bind(...ids).all<WarningMatchRow>()

  return groupWarnings(results)
}

export async function loadUserProductSafetyWarnings(
  db: D1Database,
  productIds: number[],
): Promise<Map<number, ProductSafetyWarning[]>> {
  const ids = [...new Set(productIds.filter((id) => Number.isInteger(id) && id > 0))]
  if (ids.length === 0) return new Map()

  const placeholders = ids.map(() => '?').join(',')
  const { results } = await db.prepare(`
    SELECT
      upi.user_product_id AS product_id,
      w.id,
      w.ingredient_id,
      w.short_label,
      w.popover_text,
      w.severity,
      w.article_slug,
      ka.title AS article_title,
      w.min_amount,
      w.unit AS warning_unit,
      upi.quantity,
      upi.unit,
      upi.basis_quantity,
      upi.basis_unit,
      up.serving_size,
      up.serving_unit
    FROM ingredient_safety_warnings w
    JOIN user_product_ingredients upi
      ON upi.ingredient_id = w.ingredient_id
     AND (w.form_id IS NULL OR w.form_id = upi.form_id)
    JOIN user_products up ON up.id = upi.user_product_id
    LEFT JOIN knowledge_articles ka ON ka.slug = w.article_slug AND ka.status = 'published'
    WHERE w.active = 1
      AND upi.user_product_id IN (${placeholders})
    ORDER BY upi.user_product_id ASC, w.id ASC
  `).bind(...ids).all<WarningMatchRow>()

  return groupWarnings(results)
}

export function attachWarningsToProducts<T extends ProductWithId>(
  products: T[],
  warningsByProduct: Map<number, ProductSafetyWarning[]>,
): Array<T & { warnings: ProductSafetyWarning[] }> {
  return products.map((product) => ({
    ...product,
    warnings: warningsByProduct.get(Number(product.id)) ?? product.warnings ?? [],
  }))
}

knowledge.get('/', async (c) => {
  const startedAt = Date.now()
  const requestUrl = new URL(c.req.url)
  const bypassCache = requestUrl.searchParams.has('cfcheck')
  const cacheUrl = new URL(c.req.url)
  cacheUrl.search = ''
  const cacheKey = new Request(cacheUrl.toString(), { method: 'GET' })
  if (!bypassCache) {
    const cached = await caches.default.match(cacheKey)
    if (cached) return cached
  }

  const overview = await loadKnowledgeOverview(c.env.DB)
  if (overview.refresh_scheduled && overview.live_rows) {
    const refresh = hashKnowledgeOverviewRows(overview.live_rows)
      .then((contentHash) => refreshKnowledgeOverviewProjection(c.env.DB, {
        active_generation: overview.projection.active_generation,
        source_version: overview.projection.source_version,
        expected_record_count: overview.live_rows?.length ?? 0,
        content_hash: contentHash,
      }))
      .catch(() => undefined)
    c.executionCtx.waitUntil(refresh)
  }

  const response = new Response(JSON.stringify(overview.payload), {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'public, max-age=300, stale-while-revalidate=3600',
      'Server-Timing': `knowledge-overview;dur=${Date.now() - startedAt}`,
      'X-Knowledge-Overview-Source': overview.used_projection ? 'projection' : 'live',
    },
  })
  c.executionCtx.waitUntil(caches.default.put(cacheKey, response.clone()))
  return response
})

export async function loadPublishedKnowledgeArticle(
  db: D1Database,
  slug: string,
): Promise<PublicKnowledgeArticle | null> {
  if (!/^[a-z0-9-]+$/.test(slug)) return null
  const columns = await getTableColumns(db, 'knowledge_articles')

  const article = await db.prepare(`
    SELECT
      slug,
      title,
      summary,
      body,
      status,
      ${columns.has('article_layer') ? 'article_layer' : "'main_article' AS article_layer"},
      reviewed_at,
      sources_json,
      ${columns.has('conclusion') ? 'conclusion' : 'NULL AS conclusion'},
      ${columns.has('featured_image_url') ? 'featured_image_url' : 'NULL AS featured_image_url'},
      ${columns.has('featured_image_r2_key') ? 'featured_image_r2_key' : 'NULL AS featured_image_r2_key'},
      ${columns.has('dose_min') ? 'dose_min' : 'NULL AS dose_min'},
      ${columns.has('dose_max') ? 'dose_max' : 'NULL AS dose_max'},
      ${columns.has('dose_unit') ? 'dose_unit' : 'NULL AS dose_unit'},
      ${columns.has('product_note') ? 'product_note' : 'NULL AS product_note'},
      ${columns.has('seo_json') ? 'seo_json' : 'NULL AS seo_json'},
      created_at,
      updated_at
    FROM knowledge_articles
    WHERE slug = ?
      AND status = 'published'
  `).bind(slug).first<KnowledgeArticleRow>()

  if (!article) return null
  const ingredients = await loadArticleIngredients(db, article.slug)
  const ingredientIds = ingredients.map((ingredient) => ingredient.ingredient_id)
  const sources = await loadArticleSources(db, article.slug, article.sources_json, {
    articleLayer: article.article_layer,
    ingredientIds,
  })

  return {
    slug: article.slug,
    title: article.title,
    summary: article.summary,
    body: article.body,
    article_layer: article.article_layer,
    reviewed_at: article.reviewed_at,
    conclusion: article.conclusion,
    featured_image_url: article.featured_image_url,
    featured_image_r2_key: article.featured_image_r2_key,
    dose_min: article.dose_min,
    dose_max: article.dose_max,
    dose_unit: article.dose_unit,
    product_note: article.product_note,
    sources,
    ingredients,
    ingredient_ids: ingredientIds,
    created_at: article.created_at,
    updated_at: article.updated_at,
    published_at: article.created_at,
    modified_at: article.updated_at,
    seo: parsePublicKnowledgeArticleSeo(article.seo_json),
  }
}

knowledge.get('/:slug', async (c) => {
  const slug = c.req.param('slug')
  if (!/^[a-z0-9-]+$/.test(slug)) return c.json({ error: 'Invalid slug' }, 400)
  const article = await loadPublishedKnowledgeArticle(c.env.DB, slug)
  if (!article) return c.json({ error: 'Not found' }, 404)
  return c.json({ article })
})

export default knowledge
