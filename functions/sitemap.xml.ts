import type { Env } from './api/lib/types'
import { buildSitemapXml } from './lib/knowledge-indexability'

type SitemapRow = { slug: string; updated_at: string }

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { results } = await context.env.DB.prepare(`
    SELECT slug, updated_at
    FROM knowledge_articles
    WHERE status = 'published'
    ORDER BY slug
  `).all<SitemapRow>()
  const modifiedBySlug = new Map((results ?? []).map((row) => [row.slug, row.updated_at]))

  if (modifiedBySlug.size === 0) {
    return new Response('Indexability inventory is unavailable.', {
      status: 503,
      headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' },
    })
  }

  return new Response(buildSitemapXml(modifiedBySlug), {
    status: 200,
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  })
}
