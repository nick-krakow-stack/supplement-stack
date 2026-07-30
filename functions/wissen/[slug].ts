import type { Env } from '../api/lib/types'
import { loadPublishedKnowledgeArticle } from '../api/modules/knowledge'
import {
  isValidKnowledgeSlug,
  knowledgeCanonicalUrl,
  renderKnowledgeArticleHtml,
} from '../lib/knowledge-indexability'

type KnowledgePagesFunction = PagesFunction<Env, 'slug'>

export async function failClosedKnowledgeShell(response: Response): Promise<Response> {
  const shellHtml = await response.text()
  const headers = new Headers(response.headers)
  headers.set('Cache-Control', 'no-store')
  headers.set('X-Robots-Tag', 'noindex, nofollow')
  headers.delete('Content-Length')
  headers.delete('Content-Encoding')
  headers.delete('ETag')
  headers.delete('Last-Modified')
  return new Response(shellHtml, { status: response.status, statusText: response.statusText, headers })
}

export async function buildKnowledgePrerenderResponse(
  shellResponse: Response,
  article: Awaited<ReturnType<typeof loadPublishedKnowledgeArticle>> & object,
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
  if (!slug || !isValidKnowledgeSlug(slug)) return await failClosedKnowledgeShell(shellResponse)

  let article
  try { article = await loadPublishedKnowledgeArticle(context.env.DB, slug) }
  catch { return await failClosedKnowledgeShell(shellResponse) }
  if (!article) return await failClosedKnowledgeShell(shellResponse)
  return buildKnowledgePrerenderResponse(shellResponse, article, slug)
}
