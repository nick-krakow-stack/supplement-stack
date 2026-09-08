import type { Env } from './api/lib/types'
import { buildSitemapXml } from './lib/site-crawl.mjs'
import { listPublicCreatorProfiles } from './api/lib/creator-public-profile'
import { creatorSharingEnabled } from './api/lib/creator-sharing'

type SitemapRow = { slug: string; updated_at: string }

export const onRequestGet: PagesFunction<Env> = async (context) => {
  try {
    const { results } = await context.env.DB.prepare(`
    SELECT slug, updated_at
    FROM knowledge_articles
    WHERE status = 'published'
    ORDER BY slug
  `).all<SitemapRow>()
    const modifiedBySlug = new Map((results ?? []).map((row) => [row.slug, row.updated_at]))
    const creators = creatorSharingEnabled(context.env) ? await listPublicCreatorProfiles(context.env.DB) : []
    return new Response(buildSitemapXml(modifiedBySlug, creators), {
      status: 200,
      headers: {
        'Content-Type': 'application/xml; charset=utf-8',
        'Cache-Control': 'no-store',
      },
    })
  } catch {
    return new Response('Indexability inventory is unavailable.', {
      status: 503,
      headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' },
    })
  }

}

export const onRequestHead: PagesFunction<Env> = async (context) => {
  const response = await onRequestGet(context)
  return new Response(null, { status: response.status, headers: response.headers })
}
