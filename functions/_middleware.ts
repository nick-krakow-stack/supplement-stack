import type { Env } from './api/lib/types'
import { LEGAL_PAGE_SLUGS, loadPublishedLegalDocument } from './lib/legal-documents'
import { isBackendPath, isKnownAppPath } from './lib/site-routes.mjs'
import { pageResponse, renderLegalPageHtml, renderMissingPageHtml } from './lib/site-page-html'
import { canonicalRouteRedirect, resolveRouteHead } from './lib/route-head-contract.mjs'
import { authLinkPageStatus } from './api/lib/auth-link-state'
import { validateReturnTo } from './api/lib/return-to'
import { loadKnowledgeOverview } from './api/modules/knowledge-overview-projection'
import { checkPrivatePageAccess, loadPublicSharePage } from './lib/site-page-data'
import { authPageContent, knowledgeOverviewPage, renderPublicIntro, renderSitePage, sharePageProjection } from './lib/site-public-html'
import { escapeLegalHtml } from './lib/legal-document-renderer.mjs'

export const onRequest: PagesFunction<Env> = async (context) => {
  const url = new URL(context.request.url)
  const path = url.pathname
  const redirect = canonicalRouteRedirect(url)
  if (redirect) {
    const policy = resolveRouteHead({ pathname: new URL(redirect).pathname })
    return new Response(null, { status: 308, headers: { Location: redirect, 'Cache-Control': policy.cacheControl, 'Referrer-Policy': 'no-referrer', 'X-Robots-Tag': policy.robots } })
  }
  if (isBackendPath(path)) return context.next()
  const head = context.request.method === 'HEAD'
  if (!head && context.request.method !== 'GET') return context.next()
  // Article delivery retains its own published-state, SSR and HEAD contract.
  if (/^\/wissen\/[^/]+$/.test(path)) return context.next()
  const policy = resolveRouteHead({ pathname: path })
  if (policy.kind !== 'error') {
    if (policy.authRequired) {
      const access = await checkPrivatePageAccess(context.request, context.env, path.startsWith('/administrator'))
      if (access === 401) {
        const returnTo = validateReturnTo(`${path}${url.search}`) ?? '/stacks'
        return new Response(null, { status: 302, headers: { Location: `/login?returnTo=${encodeURIComponent(returnTo)}`, 'Cache-Control': policy.cacheControl, 'X-Robots-Tag': policy.robots, 'Referrer-Policy': policy.referrerPolicy } })
      }
      if (access !== 204) {
        const errorHead = resolveRouteHead({ pathname: path, status: access, title: access === 403 ? 'Kein Zugriff | Supplement Stack' : undefined })
        const html = renderSitePage('', errorHead, `<h1>${access === 403 ? 'Du hast keinen Zugriff auf diesen Bereich' : 'Dieser Bereich kann gerade nicht geladen werden'}</h1><p><a href="/">Zur Startseite</a> · <a href="/stacks">Meine Stacks</a></p>`)
        return pageResponse(html, new Response(), access, head, errorHead)
      }
    }
    // SSR reads the real shell without validators. HEAD must have the same status/head as GET.
    const shellHeaders = new Headers(context.request.headers)
    shellHeaders.delete('If-None-Match')
    shellHeaders.delete('If-Modified-Since')
    let shell: Response
    let html: string
    try {
      shell = await context.next(new Request(context.request, { method: 'GET', headers: shellHeaders }))
      if (!shell.ok) throw new Error('Page shell unavailable')
      html = await shell.text()
    } catch {
      const errorHead = resolveRouteHead({ pathname: path, status: 503 })
      const content = '<h1>Diese Seite kann gerade nicht geladen werden</h1><p>Bitte versuche es später noch einmal.</p><p><a href="/">Zur Startseite</a></p>'
      return pageResponse(renderSitePage('', errorHead, content, path), new Response(), 503, head, errorHead)
    }
    try {
      const slug = path.slice(1)
      if (LEGAL_PAGE_SLUGS.has(slug)) {
        const document = await loadPublishedLegalDocument(context.env.DB, slug)
        if (!document) return pageResponse(renderMissingPageHtml(html, 404, true), shell, 404, head, resolveRouteHead({ pathname: path, status: 404 }))
        return pageResponse(renderLegalPageHtml(html, document), shell, 200, head, policy)
      }
      if (policy.kind === 'share') {
        const share = await loadPublicSharePage(context.env, path.slice('/share/'.length))
        const projection = sharePageProjection(path, share)
        const response = pageResponse(renderSitePage(html, projection.head, projection.content), shell, share.status, head, projection.head)
        if (share.retryAfter) response.headers.set('Retry-After', share.retryAfter)
        return response
      }
      if (path === '/wissen') {
        const overview = await loadKnowledgeOverview(context.env.DB)
        const projection = knowledgeOverviewPage(overview.payload)
        return pageResponse(renderSitePage(html, projection.head, projection.content, path, overview.payload), shell, 200, head, projection.head)
      }
      if (policy.kind === 'auth' || policy.kind === 'auth-token') {
        const status = path === '/reset-password' || path === '/verify-email' ? await authLinkPageStatus(context.env.DB, path.slice(1) as 'reset-password' | 'verify-email', url.searchParams.get('token')) : 200
        const authHead = resolveRouteHead({ pathname: path, status })
        return pageResponse(renderSitePage(html, authHead, authPageContent(path, status, url.searchParams.has('token')), path), shell, status, head, authHead)
      }
      const content = policy.authRequired
        ? `<h1>${escapeLegalHtml(policy.title.replace(/ \| Supplement Stack$/, ''))}</h1><p>Dein geschützter Bereich wird in der App geöffnet. Persönliche Daten werden erst nach der Anmeldung geladen.</p><noscript><p>Aktiviere JavaScript, um diesen Bereich zu nutzen.</p></noscript><p><a href="/wissen">Wissen entdecken</a> · <a href="/">Startseite</a></p>`
        : renderPublicIntro(path as '/' | '/demo' | '/einnahmeplan-erstellen')
      return pageResponse(renderSitePage(html, policy, content), shell, 200, head, policy)
    } catch {
      const errorHead = resolveRouteHead({ pathname: path, status: 503 })
      if (policy.kind === 'auth-token') return pageResponse(renderSitePage(html, errorHead, '<h1>Dieser Link kann gerade nicht geprüft werden</h1><p>Bitte versuche es später noch einmal.</p><p><a href="/login">Zur Anmeldung</a></p>', path), shell, 503, head, errorHead)
      return pageResponse(renderMissingPageHtml(html, 503, policy.kind === 'legal'), shell, 503, head, errorHead)
    }
  }
  // Keep only actual existing app routes, not arbitrary path prefixes.
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
  return pageResponse(renderMissingPageHtml(await response.text(), 404), response, 404, head, resolveRouteHead({ pathname: path, status: 404 }))
}
