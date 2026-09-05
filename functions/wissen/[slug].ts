import type { Env } from '../api/lib/types'
import {
  loadCachedPublishedKnowledgeArticle,
  type PublicKnowledgeArticle,
} from '../api/modules/knowledge'
import {
  isValidKnowledgeSlug,
  knowledgeCanonicalUrl,
  renderKnowledgeArticleHtml,
  renderKnowledgeUnavailableHtml,
} from '../lib/knowledge-indexability'

type KnowledgePagesFunction = PagesFunction<Env, 'slug'>

export async function failClosedKnowledgeShell(response: Response, status: 404 | 503 = 503): Promise<Response> {
  const shellHtml = await response.text()
  const headers = new Headers(response.headers)
  headers.set('Cache-Control', 'no-store')
  headers.set('X-Robots-Tag', 'noindex, nofollow')
  headers.set('Content-Type', 'text/html; charset=utf-8')
  if (status === 503) headers.set('Retry-After', '60')
  headers.delete('Content-Length')
  headers.delete('Content-Encoding')
  headers.delete('ETag')
  headers.delete('Last-Modified')
  return new Response(renderKnowledgeUnavailableHtml(shellHtml, status), { status, headers })
}

export async function buildKnowledgePrerenderResponse(
  shellResponse: Response,
  article: PublicKnowledgeArticle,
  slug: string,
): Promise<Response> {
  const shellHtml = await shellResponse.text()
  const canonicalUrl = knowledgeCanonicalUrl(slug)
  const headers = new Headers(shellResponse.headers)
  headers.set('Content-Type', 'text/html; charset=utf-8')
  headers.set('Cache-Control', 'no-store')
  headers.delete('Content-Length')
  headers.delete('Content-Encoding')
  headers.delete('ETag')
  headers.delete('Last-Modified')

  return new Response(renderKnowledgeArticleHtml(shellHtml, article, canonicalUrl), {
    status: 200,
    headers,
  })
}

export const onRequestGet: KnowledgePagesFunction = async (context) => {
  const rawSlug = context.params.slug
  const slug = Array.isArray(rawSlug) ? rawSlug[0] : rawSlug
  const shellResponse = await context.next()
  if (!shellResponse.ok) return shellResponse
  if (!slug || !isValidKnowledgeSlug(slug)) return await failClosedKnowledgeShell(shellResponse, 404)

  let article
  try {
    const result = await loadCachedPublishedKnowledgeArticle(context.env.DB, context.request.url, slug, {
      bypassCache: new URL(context.request.url).searchParams.has('cfcheck'),
      waitUntil: (promise) => context.waitUntil(promise),
    })
    article = result.article
  }
  catch { return await failClosedKnowledgeShell(shellResponse) }
  if (!article) return await failClosedKnowledgeShell(shellResponse, 404)
  return buildKnowledgePrerenderResponse(shellResponse, article, slug)
}
