import { Hono } from 'hono'
import type { AppContext } from '../lib/types'
import { ingredientAmountPerProductServing } from '../lib/stack-calculations'

const knowledge = new Hono<AppContext>()

type ArticleSource = {
  label: string
  url: string
}

type KnowledgeArticleRow = {
  slug: string
  title: string
  summary: string
  body: string
  status: string
  reviewed_at: string | null
  sources_json: string
  created_at: string
  updated_at: string
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
  try {
    const parsed: unknown = JSON.parse(value)
    if (!Array.isArray(parsed)) return []
    return parsed
      .map((source) => {
        if (!source || typeof source !== 'object') return null
        const row = source as Record<string, unknown>
        if (typeof row.label !== 'string' || typeof row.url !== 'string') return null
        return { label: row.label, url: row.url }
      })
      .filter((source): source is ArticleSource => source !== null)
  } catch {
    return []
  }
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

knowledge.get('/:slug', async (c) => {
  const slug = c.req.param('slug')
  if (!/^[a-z0-9-]+$/.test(slug)) return c.json({ error: 'Invalid slug' }, 400)

  const article = await c.env.DB.prepare(`
    SELECT slug, title, summary, body, status, reviewed_at, sources_json, created_at, updated_at
    FROM knowledge_articles
    WHERE slug = ?
      AND status = 'published'
  `).bind(slug).first<KnowledgeArticleRow>()

  if (!article) return c.json({ error: 'Not found' }, 404)

  return c.json({
    article: {
      slug: article.slug,
      title: article.title,
      summary: article.summary,
      body: article.body,
      reviewed_at: article.reviewed_at,
      sources: parseSources(article.sources_json),
      created_at: article.created_at,
      updated_at: article.updated_at,
    },
  })
})

export default knowledge
