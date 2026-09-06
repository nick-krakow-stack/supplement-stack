import type { Env } from './api/lib/types'
import { LEGAL_PAGE_SLUGS, loadPublishedLegalDocument } from './lib/legal-documents'
import { isBackendPath, isKnownAppPath } from './lib/site-routes.mjs'
import { pageResponse, renderLegalPageHtml, renderMissingPageHtml } from './lib/site-page-html'

export const onRequest: PagesFunction<Env> = async (context) => {
  const url = new URL(context.request.url)
  const path = url.pathname
  // A fixed canonical target intentionally drops query parameters (tokens, return paths, etc.).
  if (path === '/agb' || path === '/agb/') return new Response(null, { status: 308, headers: { Location: 'https://supplementstack.de/nutzungsbedingungen', 'Cache-Control': 'public, max-age=3600' } })
  if (isBackendPath(path)) return context.next()
  const head = context.request.method === 'HEAD'
  if (!head && context.request.method !== 'GET') return context.next()
  const slug = path.replace(/^\//, '').replace(/\/$/, '')
  if (LEGAL_PAGE_SLUGS.has(slug)) {
    // HEAD shares exactly the GET status/metadata; fetching the static shell never executes a write.
    const shell = await context.next(head ? new Request(context.request, { method: 'GET' }) : undefined)
    const html = await shell.text()
    try {
      const document = await loadPublishedLegalDocument(context.env.DB, slug)
      if (!document) return pageResponse(renderMissingPageHtml(html, 404, true), shell, 404, head)
      return pageResponse(renderLegalPageHtml(html, document), shell, 200, head)
    } catch { return pageResponse(renderMissingPageHtml(html, 503, true), shell, 503, head) }
  }
  // Existing article handlers, authenticated screens, and share routes own their own state checks.
  if (isKnownAppPath(path)) return context.next()
  const response = await context.next(head ? new Request(context.request, { method: 'GET' }) : undefined)
  // Preserve real static assets, but never mistake the SPA's HTML fallback for an existing file.
  const type = response.headers.get('Content-Type') ?? ''
  if (response.ok && !/text\/html|application\/xhtml\+xml/i.test(type) && type.length > 0) {
    return head ? new Response(null, { status: response.status, headers: response.headers }) : response
  }
  return pageResponse(renderMissingPageHtml(await response.text(), 404), response, 404, head)
}
