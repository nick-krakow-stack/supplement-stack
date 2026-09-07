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
  let response = await context.next(head ? new Request(context.request, { method: 'GET' }) : undefined)
  // A 304 may omit representation headers. Verify its actual asset without validators;
  // an HTML SPA fallback must not turn an unknown URL into a valid cached page.
  if (response.status === 304 && !response.headers.get('Content-Type')) {
    const notModified = response
    const headers = new Headers(context.request.headers)
    headers.delete('If-None-Match')
    headers.delete('If-Modified-Since')
    response = await context.next(new Request(context.request, { method: 'GET', headers }))
    const verifiedType = response.headers.get('Content-Type') ?? ''
    if (response.ok && verifiedType.length > 0 && !/text\/html|application\/xhtml\+xml/i.test(verifiedType)) {
      // Prefer a fresh representation if the file changed between the two reads.
      if (response.headers.get('ETag') === notModified.headers.get('ETag')
        && response.headers.get('Last-Modified') === notModified.headers.get('Last-Modified')) {
        await response.body?.cancel()
        return notModified
      }
    }
  }
  // Preserve real static assets, but never mistake the SPA's HTML fallback for an existing file.
  const type = response.headers.get('Content-Type') ?? ''
  if ((response.ok || response.status === 304) && !/text\/html|application\/xhtml\+xml/i.test(type) && type.length > 0) {
    return head ? new Response(null, { status: response.status, headers: response.headers }) : response
  }
  return pageResponse(renderMissingPageHtml(await response.text(), 404), response, 404, head)
}
