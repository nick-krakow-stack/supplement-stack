import type { Env } from './api/lib/types'
import { buildRobotsTxt } from './lib/knowledge-indexability'

type PublishedSlugRow = { slug: string }

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { results } = await context.env.DB.prepare(`
    SELECT slug
    FROM knowledge_articles
    WHERE status = 'published'
    ORDER BY slug
  `).all<PublishedSlugRow>()
  const slugs = (results ?? []).map((row) => row.slug)
  if (slugs.length === 0) return new Response('Indexability inventory is unavailable.', {
    status: 503,
    headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' },
  })
  return new Response(buildRobotsTxt(slugs), {
    status: 200,
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  })
}
