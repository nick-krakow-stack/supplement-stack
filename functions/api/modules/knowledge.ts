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
  knowledgeOverviewCacheKey,
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
const KNOWLEDGE_ARTICLE_CACHE_CONTROL = 'public, max-age=300, stale-while-revalidate=3600'

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
  update_reason: string | null
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
  parts: ArticlePartRow[]
  ingredient_ids: number[]
  created_at: string
  updated_at: string
  published_at: string
  modified_at: string
  seo: PublicKnowledgeArticleSeo | null
  related_articles?: RelatedKnowledgeArticle[]
  update_reason?: string | null
}

export type RelatedKnowledgeArticle = {
  slug: string
  title: string
  article_layer: 'main_article' | 'single_study'
  ingredients: { ingredient_id: number; name: string }[]
}

type RelatedKnowledgeArticleRow = {
  slug: string
  title: string
  article_layer: 'main_article' | 'single_study'
  ingredient_id: number
  name: string
}

const RELATED_KNOWLEDGE_ARTICLES_SQL = `
  WITH eligible_relations AS (
    SELECT DISTINCT target.slug, target.title, target.article_layer, i.id AS ingredient_id, i.name
    FROM knowledge_article_ingredients owner_relation
    JOIN knowledge_articles owner ON owner.slug = owner_relation.article_slug AND owner.status = 'published'
    JOIN ingredients i ON i.id = owner_relation.ingredient_id AND i.is_active = 1
    JOIN knowledge_article_ingredients target_relation ON target_relation.ingredient_id = i.id
    JOIN knowledge_articles target ON target.slug = target_relation.article_slug AND target.status = 'published'
    WHERE owner.slug = ?
      AND target.slug <> owner.slug
      AND trim(COALESCE(i.name, '')) <> ''
      AND (
        target.article_layer = 'main_article'
        OR (target.article_layer = 'single_study' AND EXISTS (
          SELECT 1 FROM study_interpretation_records sir
          JOIN ingredient_research_sources source ON source.id = sir.source_id AND source.ingredient_id = sir.ingredient_id
          WHERE sir.knowledge_article_slug = target.slug
            AND sir.ingredient_id = i.id AND sir.status = 'accepted'
        ))
      )
  ), selected_articles AS (
    SELECT DISTINCT slug, title, article_layer FROM eligible_relations
    ORDER BY CASE article_layer WHEN 'main_article' THEN 0 ELSE 1 END, title COLLATE NOCASE, slug
    LIMIT 8
  )
  SELECT relation.* FROM eligible_relations relation
  JOIN selected_articles selected ON selected.slug = relation.slug
  ORDER BY CASE relation.article_layer WHEN 'main_article' THEN 0 ELSE 1 END,
    relation.title COLLATE NOCASE, relation.slug, relation.name COLLATE NOCASE, relation.ingredient_id
`

function projectRelatedKnowledgeArticles(rows: readonly RelatedKnowledgeArticleRow[]): RelatedKnowledgeArticle[] {
  const articles = new Map<string, RelatedKnowledgeArticle>()
  for (const row of rows) {
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(row.slug)) continue
    const article = articles.get(row.slug) ?? {
      slug: row.slug, title: row.title, article_layer: row.article_layer, ingredients: [],
    }
    if (!article.ingredients.some((ingredient) => ingredient.ingredient_id === row.ingredient_id)) {
      article.ingredients.push({ ingredient_id: row.ingredient_id, name: row.name })
    }
    articles.set(row.slug, article)
  }
  return [...articles.values()]
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

type ArticlePartRow = {
  part_id: number
  part_name: string
  part_type: string | null
  ingredient_id: number
  ingredient_name: string
  sort_order: number
}

export type ProductSafetyWarning = {
  id: number
  ingredient_id: number
  part_id: number | null
  part_name: string | null
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
  part_id: number | null
  part_name: string | null
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

function buildInternalSourceArticleTargets(
  rows: readonly InternalSourceArticleRow[],
): Map<string, InternalSourceArticleTarget[]> {
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

  return buildInternalSourceArticleTargets(rows)
}

function resolveArticleSources(
  fallbackJson: string,
  sourceRows: ArticleSourceRow[],
  articleLayer: string | null,
  targets: Map<string, InternalSourceArticleTarget[]>,
): ArticleSource[] {
  const fallback = parseArticleSourcesPayload(fallbackJson)
  const sources = fallback.isV2Projection || sourceRows.length > 0
    ? bindV2ProjectionSourcesToRows(fallback, sourceRows)
    : fallback.sources
  if (articleLayer !== 'main_article') return sources

  const externalSources = sources.filter((source) => /^https?:\/\//i.test(source.url))
  if (externalSources.length > 0) {
    const internalOnly = projectFullyCoveredV2SourcesToInternalArticles(externalSources, targets)
    if (internalOnly) return internalOnly
  }
  if (fallback.isV2Projection) return enrichV2SourcesWithInternalArticles(sources, targets)
  return appendLegacyInternalSourceTargets(sources, targets)
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
  let sourceRows: ArticleSourceRow[] = []
  if (await hasTable(db, 'knowledge_article_sources')) {
    const { results } = await db.prepare(`
      SELECT label, url, sort_order
      FROM knowledge_article_sources
      WHERE article_slug = ?
      ORDER BY sort_order ASC, id ASC
    `).bind(slug).all<ArticleSourceRow>()
    sourceRows = results ?? []
  }

  const targets = options.articleLayer === 'main_article'
    ? await loadInternalSourceArticleTargets(db, options.ingredientIds ?? [])
    : new Map<string, InternalSourceArticleTarget[]>()
  return resolveArticleSources(fallbackJson, sourceRows, options.articleLayer ?? null, targets)
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

async function loadArticleParts(db: D1Database, slug: string): Promise<ArticlePartRow[]> {
  if (!(await hasTable(db, 'knowledge_article_parts'))) return []
  const { results } = await db.prepare(`
    SELECT kap.part_id, p.name AS part_name, p.type AS part_type,
           kap.ingredient_id, i.name AS ingredient_name, kap.sort_order
    FROM knowledge_article_parts kap
    JOIN ingredient_parts p ON p.id = kap.part_id AND p.status = 'active'
    JOIN ingredients i ON i.id = kap.ingredient_id
    JOIN ingredient_part_links l ON l.ingredient_id = kap.ingredient_id AND l.part_id = kap.part_id
    WHERE kap.article_slug = ?
    ORDER BY kap.sort_order ASC, p.name ASC, p.id ASC
  `).bind(slug).all<ArticlePartRow>()
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
      part_id: row.part_id,
      part_name: row.part_name,
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
      w.part_id,
      part.name AS part_name,
      w.short_label,
      w.popover_text,
      w.severity,
      w.article_slug,
      ka.title AS article_title,
      w.min_amount,
      w.unit AS warning_unit,
      CASE WHEN w.part_id IS NULL THEN pi.quantity ELSE pip.quantity END AS quantity,
      CASE WHEN w.part_id IS NULL THEN pi.unit ELSE pip.unit END AS unit,
      CASE WHEN w.part_id IS NULL THEN pi.basis_quantity ELSE COALESCE(pip.basis_quantity, pi.basis_quantity) END AS basis_quantity,
      CASE WHEN w.part_id IS NULL THEN pi.basis_unit ELSE COALESCE(pip.basis_unit, pi.basis_unit) END AS basis_unit,
      p.serving_size,
      p.serving_unit
    FROM ingredient_safety_warnings w
    JOIN product_ingredients pi
      ON pi.ingredient_id = w.ingredient_id
     AND (w.form_id IS NULL OR w.form_id = pi.form_id)
    LEFT JOIN product_ingredient_parts pip
      ON pip.product_ingredient_id = pi.id
     AND pip.part_id = w.part_id
    LEFT JOIN ingredient_parts part ON part.id = w.part_id
    JOIN products p ON p.id = pi.product_id
    LEFT JOIN knowledge_articles ka ON ka.slug = w.article_slug AND ka.status = 'published'
    WHERE w.active = 1
      AND (w.part_id IS NULL OR (pip.id IS NOT NULL AND part.status = 'active'))
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
      w.part_id,
      part.name AS part_name,
      w.short_label,
      w.popover_text,
      w.severity,
      w.article_slug,
      ka.title AS article_title,
      w.min_amount,
      w.unit AS warning_unit,
      CASE WHEN w.part_id IS NULL THEN upi.quantity ELSE upip.quantity END AS quantity,
      CASE WHEN w.part_id IS NULL THEN upi.unit ELSE upip.unit END AS unit,
      CASE WHEN w.part_id IS NULL THEN upi.basis_quantity ELSE COALESCE(upip.basis_quantity, upi.basis_quantity) END AS basis_quantity,
      CASE WHEN w.part_id IS NULL THEN upi.basis_unit ELSE COALESCE(upip.basis_unit, upi.basis_unit) END AS basis_unit,
      up.serving_size,
      up.serving_unit
    FROM ingredient_safety_warnings w
    JOIN user_product_ingredients upi
      ON upi.ingredient_id = w.ingredient_id
     AND (w.form_id IS NULL OR w.form_id = upi.form_id)
    LEFT JOIN user_product_ingredient_parts upip
      ON upip.user_product_ingredient_id = upi.id
     AND upip.part_id = w.part_id
    LEFT JOIN ingredient_parts part ON part.id = w.part_id
    JOIN user_products up ON up.id = upi.user_product_id
    LEFT JOIN knowledge_articles ka ON ka.slug = w.article_slug AND ka.status = 'published'
    WHERE w.active = 1
      AND (w.part_id IS NULL OR upip.id IS NOT NULL)
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
  const cacheKey = knowledgeOverviewCacheKey(c.req.url)
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

async function loadPublishedKnowledgeArticleLegacy(
  db: D1Database,
  slug: string,
): Promise<PublicKnowledgeArticle | null> {
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
      ${columns.has('update_reason') ? 'update_reason' : 'NULL AS update_reason'},
      created_at,
      updated_at
    FROM knowledge_articles
    WHERE slug = ?
      AND status = 'published'
  `).bind(slug).first<KnowledgeArticleRow>()

  if (!article) return null
  const ingredients = await loadArticleIngredients(db, article.slug)
  const parts = await loadArticleParts(db, article.slug)
  const ingredientIds = ingredients.map((ingredient) => ingredient.ingredient_id)
  const sources = await loadArticleSources(db, article.slug, article.sources_json, {
    articleLayer: article.article_layer,
    ingredientIds,
  })
  const canLoadRelated = columns.has('article_layer')
    && await hasTable(db, 'knowledge_article_ingredients')
    && await hasTable(db, 'study_interpretation_records')
    && await hasTable(db, 'ingredient_research_sources')
  const relatedRows = canLoadRelated
    ? (await db.prepare(RELATED_KNOWLEDGE_ARTICLES_SQL).bind(article.slug).all<RelatedKnowledgeArticleRow>()).results ?? []
    : []

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
    parts,
    ingredient_ids: ingredientIds,
    created_at: article.created_at,
    updated_at: article.updated_at,
    published_at: article.created_at,
    modified_at: article.updated_at,
    seo: parsePublicKnowledgeArticleSeo(article.seo_json),
    related_articles: projectRelatedKnowledgeArticles(relatedRows),
    update_reason: article.update_reason,
  }
}

function batchRows<T>(result: D1Result): T[] {
  return (result.results ?? []) as T[]
}

async function loadPublishedKnowledgeArticleCurrentSchema(
  db: D1Database,
  slug: string,
): Promise<PublicKnowledgeArticle | null> {
  const [
    articleResult,
    ingredientResult,
    partResult,
    sourceResult,
    relationTargetResult,
    interpretationTargetResult,
    relatedArticleResult,
  ] = await db.batch([
    db.prepare(`
      SELECT
        slug,
        title,
        summary,
        body,
        status,
        article_layer,
        reviewed_at,
        sources_json,
        conclusion,
        featured_image_url,
        featured_image_r2_key,
        dose_min,
        dose_max,
        dose_unit,
        product_note,
        seo_json,
        update_reason,
        created_at,
        updated_at
      FROM knowledge_articles
      WHERE slug = ?
        AND status = 'published'
    `).bind(slug),
    db.prepare(`
      SELECT kai.ingredient_id, i.name, kai.sort_order
      FROM knowledge_article_ingredients kai
      LEFT JOIN ingredients i ON i.id = kai.ingredient_id
      WHERE kai.article_slug = ?
      ORDER BY kai.sort_order ASC, i.name ASC
    `).bind(slug),
    db.prepare(`
      SELECT kap.part_id, p.name AS part_name, p.type AS part_type,
             kap.ingredient_id, i.name AS ingredient_name, kap.sort_order
      FROM knowledge_article_parts kap
      JOIN ingredient_parts p ON p.id = kap.part_id AND p.status = 'active'
      JOIN ingredients i ON i.id = kap.ingredient_id
      JOIN ingredient_part_links l ON l.ingredient_id = kap.ingredient_id AND l.part_id = kap.part_id
      WHERE kap.article_slug = ?
      ORDER BY kap.sort_order ASC, p.name ASC, p.id ASC
    `).bind(slug),
    db.prepare(`
      SELECT label, url, sort_order
      FROM knowledge_article_sources
      WHERE article_slug = ?
      ORDER BY sort_order ASC, id ASC
    `).bind(slug),
    db.prepare(`
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
      WHERE kai.ingredient_id IN (
        SELECT ingredient_id
        FROM knowledge_article_ingredients
        WHERE article_slug = ?
      )
        AND EXISTS (
          SELECT 1
          FROM knowledge_articles owner
          WHERE owner.slug = ?
            AND owner.article_layer = 'main_article'
        )
        AND ka.status = 'published'
        AND ka.article_layer = 'single_study'
      ORDER BY ka.slug ASC, ka.title ASC, kas.sort_order ASC, kas.id ASC
    `).bind(slug, slug),
    db.prepare(`
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
      WHERE irs.ingredient_id IN (
        SELECT ingredient_id
        FROM knowledge_article_ingredients
        WHERE article_slug = ?
      )
        AND EXISTS (
          SELECT 1
          FROM knowledge_articles owner
          WHERE owner.slug = ?
            AND owner.article_layer = 'main_article'
        )
        AND sir.status = 'accepted'
        AND sir.knowledge_article_slug IS NOT NULL
        AND ka.status = 'published'
        AND ka.article_layer = 'single_study'
      ORDER BY ka.slug ASC, ka.title ASC
    `).bind(slug, slug),
    db.prepare(RELATED_KNOWLEDGE_ARTICLES_SQL).bind(slug),
  ])

  const article = batchRows<KnowledgeArticleRow>(articleResult)[0]
  if (!article) return null
  const ingredients = batchRows<ArticleIngredientRow>(ingredientResult)
  const parts = batchRows<ArticlePartRow>(partResult)
  const targetRows = [
    ...batchRows<InternalSourceArticleRow>(relationTargetResult),
    ...batchRows<InternalSourceArticleRow>(interpretationTargetResult),
  ]
  const sources = resolveArticleSources(
    article.sources_json,
    batchRows<ArticleSourceRow>(sourceResult),
    article.article_layer,
    buildInternalSourceArticleTargets(targetRows),
  )

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
    parts,
    ingredient_ids: ingredients.map((ingredient) => ingredient.ingredient_id),
    created_at: article.created_at,
    updated_at: article.updated_at,
    published_at: article.created_at,
    modified_at: article.updated_at,
    seo: parsePublicKnowledgeArticleSeo(article.seo_json),
    related_articles: projectRelatedKnowledgeArticles(batchRows<RelatedKnowledgeArticleRow>(relatedArticleResult)),
    update_reason: article.update_reason,
  }
}

export async function loadPublishedKnowledgeArticle(
  db: D1Database,
  slug: string,
): Promise<PublicKnowledgeArticle | null> {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) return null
  try {
    return await loadPublishedKnowledgeArticleCurrentSchema(db, slug)
  } catch {
    return loadPublishedKnowledgeArticleLegacy(db, slug)
  }
}

export type CachedPublishedKnowledgeArticle = {
  article: PublicKnowledgeArticle | null
  source: 'cache' | 'database'
}

export function knowledgeArticleCacheKey(requestUrl: string, slug: string): Request {
  return new Request(new URL(`/api/knowledge/${slug}?projection=article-navigation-v2`, requestUrl).toString(), { method: 'GET' })
}

function defaultKnowledgeCache(): Cache | null {
  return typeof caches === 'undefined' ? null : caches.default
}

export async function deletePublishedKnowledgeArticleCache(
  requestUrl: string,
  slug: string,
): Promise<boolean> {
  const cache = defaultKnowledgeCache()
  if (!cache) return false
  return cache.delete(knowledgeArticleCacheKey(requestUrl, slug))
}

export async function loadCachedPublishedKnowledgeArticle(
  db: D1Database,
  requestUrl: string,
  slug: string,
  options: {
    bypassCache?: boolean
    waitUntil?: (promise: Promise<void>) => void
  } = {},
): Promise<CachedPublishedKnowledgeArticle> {
  const cache = defaultKnowledgeCache()
  const cacheKey = knowledgeArticleCacheKey(requestUrl, slug)

  if (cache && !options.bypassCache) {
    const cached = await cache.match(cacheKey)
    if (cached) {
      try {
        const payload = await cached.json() as { article?: PublicKnowledgeArticle }
        if (payload.article?.slug === slug) return { article: payload.article, source: 'cache' }
      } catch {
        // A malformed cache entry must never hide the database-backed article.
      }
      await cache.delete(cacheKey)
    }
  }

  const article = await loadPublishedKnowledgeArticle(db, slug)
  if (article && cache && !options.bypassCache) {
    const cacheWrite = cache.put(cacheKey, new Response(JSON.stringify({ article }), {
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': KNOWLEDGE_ARTICLE_CACHE_CONTROL,
      },
    }))
    if (options.waitUntil) options.waitUntil(cacheWrite)
    else await cacheWrite
  }
  return { article, source: 'database' }
}

knowledge.get('/:slug', async (c) => {
  const startedAt = Date.now()
  const slug = c.req.param('slug')
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) return c.json({ error: 'Artikel nicht gefunden.' }, 404, { 'Cache-Control': 'no-store' })
  const requestUrl = new URL(c.req.url)
  let result: CachedPublishedKnowledgeArticle
  try {
    result = await loadCachedPublishedKnowledgeArticle(c.env.DB, c.req.url, slug, {
      bypassCache: requestUrl.searchParams.has('cfcheck'),
      waitUntil: (promise) => c.executionCtx.waitUntil(promise),
    })
  } catch {
    return c.json({ error: 'Der Artikel konnte gerade nicht geladen werden.' }, 503, { 'Cache-Control': 'no-store', 'Retry-After': '60' })
  }
  if (!result.article) return c.json({ error: 'Not found' }, 404, { 'Cache-Control': 'no-store' })
  return new Response(JSON.stringify({ article: result.article }), {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': KNOWLEDGE_ARTICLE_CACHE_CONTROL,
      'Server-Timing': `knowledge-article;dur=${Date.now() - startedAt}`,
      'X-Knowledge-Article-Source': result.source,
    },
  })
})

export default knowledge
