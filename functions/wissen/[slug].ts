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
import { knowledgeArticleHead } from '../lib/knowledge-seo.mjs'

type KnowledgePagesFunction = PagesFunction<Env, 'slug'>

export async function failClosedKnowledgeShell(response: Response, status: 404 | 503 = 503): Promise<Response> {
  const shellHtml = await response.text()
  const headers = new Headers(response.headers)
  headers.set('Cache-Control', 'no-store')
  headers.set('X-Robots-Tag', 'noindex, nofollow')
  headers.set('Referrer-Policy', 'no-referrer')
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
  bypassCache = false,
): Promise<Response> {
  const shellHtml = await shellResponse.text()
  const canonicalUrl = knowledgeCanonicalUrl(slug)
  const headers = new Headers(shellResponse.headers)
  const routeHead = knowledgeArticleHead(article)
  headers.set('Content-Type', 'text/html; charset=utf-8')
  headers.set('Cache-Control', bypassCache ? 'no-store' : routeHead.cacheControl)
  headers.set('X-Robots-Tag', routeHead.robots)
  headers.set('Referrer-Policy', routeHead.referrerPolicy)
  headers.delete('Content-Length')
  headers.delete('Content-Encoding')
  headers.delete('ETag')
  headers.delete('Last-Modified')

  return new Response(renderKnowledgeArticleHtml(shellHtml, article, canonicalUrl), {
    status: 200,
    headers,
  })
}

const handleKnowledgeRequest: KnowledgePagesFunction = async (context) => {
  const rawSlug = context.params.slug
  const slug = Array.isArray(rawSlug) ? rawSlug[0] : rawSlug
  // Static-shell validators do not identify the DB-backed article. HEAD needs
  // the same shell bytes as GET before stripping only the final response body.
  const shellHeaders = new Headers(context.request.headers)
  shellHeaders.delete('If-None-Match')
  shellHeaders.delete('If-Modified-Since')
  const shellResponse = await context.next(new Request(context.request, { method: 'GET', headers: shellHeaders }))
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
  return buildKnowledgePrerenderResponse(shellResponse, article, slug, new URL(context.request.url).searchParams.has('cfcheck'))
}

export const onRequestGet: KnowledgePagesFunction = handleKnowledgeRequest
export const onRequestHead: KnowledgePagesFunction = async (context) => {
  const response = await handleKnowledgeRequest(context)
  await response.body?.cancel()
  return new Response(null, { status: response.status, statusText: response.statusText, headers: response.headers })
}
