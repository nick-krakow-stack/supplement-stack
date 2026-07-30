import { Hono } from 'hono'
import type { AppContext } from '../lib/types'

const publicStats = new Hono<AppContext>()

type CountRow = {
  count: number
}

function resultCount(result: D1Result): number {
  const row = (result.results?.[0] ?? null) as CountRow | null
  const count = Number(row?.count ?? 0)
  return Number.isSafeInteger(count) && count >= 0 ? count : 0
}

publicStats.get('/', async (c) => {
  const requestUrl = new URL(c.req.url)
  const bypassCache = requestUrl.searchParams.has('cfcheck')
  const cacheUrl = new URL(c.req.url)
  cacheUrl.search = ''
  const cacheKey = new Request(cacheUrl.toString(), { method: 'GET' })
  const cache = typeof caches === 'undefined' ? null : caches.default

  if (!bypassCache && cache) {
    const cached = await cache.match(cacheKey)
    if (cached) return cached
  }

  const [
    activeNutrientsResult,
    knowledgeArticlesResult,
    preparedStudiesResult,
    publicProductsResult,
  ] = await c.env.DB.batch([
    c.env.DB.prepare(`
      SELECT COUNT(*) AS count
      FROM ingredients
      WHERE is_active = 1
    `),
    c.env.DB.prepare(`
      SELECT COUNT(*) AS count
      FROM knowledge_articles
      WHERE status = 'published'
        AND article_layer = 'main_article'
    `),
    c.env.DB.prepare(`
      SELECT COUNT(DISTINCT sir.source_id) AS count
      FROM study_interpretation_records sir
      JOIN ingredient_research_sources irs
        ON irs.id = sir.source_id
       AND irs.source_kind = 'study'
      JOIN knowledge_articles ka
        ON ka.slug = sir.knowledge_article_slug
       AND ka.status = 'published'
       AND ka.article_layer = 'single_study'
      WHERE sir.status = 'accepted'
    `),
    c.env.DB.prepare(`
      SELECT COUNT(*) AS count
      FROM products p
      WHERE p.visibility = 'public'
        AND p.moderation_status = 'approved'
        AND EXISTS (
          SELECT 1
          FROM product_ingredients pi
          WHERE pi.product_id = p.id
        )
    `),
  ])

  const response = c.json({
    active_nutrients: resultCount(activeNutrientsResult),
    published_knowledge_articles: resultCount(knowledgeArticlesResult),
    prepared_studies: resultCount(preparedStudiesResult),
    public_approved_products: resultCount(publicProductsResult),
  })
  response.headers.set('Cache-Control', 'public, max-age=300')

  if (!bypassCache && cache) {
    c.executionCtx.waitUntil(cache.put(cacheKey, response.clone()))
  }

  return response
})

export default publicStats
