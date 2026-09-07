import type { PublicLegalDocument } from './legal-documents'
import { escapeLegalHtml, legalDocumentVersionText, renderLegalMarkdown, serializeLegalBootstrap } from './legal-document-renderer.mjs'
import { applyRouteHeadHtml, resolveRouteHead, type RouteHead } from './route-head-contract.mjs'

const FALLBACK_SHELL = '<!doctype html><html lang="de"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Supplement Stack</title></head><body><div id="root"></div></body></html>'

export function preparePageShell(shell: string, head: RouteHead): string {
  const source = /<head\b/i.test(shell) && /<div\s+id=["']root["']/i.test(shell) ? shell : FALLBACK_SHELL
  return applyRouteHeadHtml(source, head)
}

export function renderLegalPageHtml(shell: string, document: PublicLegalDocument): string {
  const version = legalDocumentVersionText(document)
  const main = `<div id="legal-prerender"><main class="legal-page"><article class="legal-document"><h1 class="legal-document-title">${escapeLegalHtml(document.title)}</h1>${version ? `<p class="legal-document-version">${escapeLegalHtml(version)}</p>` : ''}<div class="legal-document-body">${renderLegalMarkdown(document.body_md, document.title)}</div></article></main></div>`
  return preparePageShell(shell, resolveRouteHead({ pathname: `/${document.slug}`, title: `${document.title} | Supplement Stack` }))
    .replace(/<div\s+id=["']root["']/i, () => `${main}<script type="application/json" id="legal-document-bootstrap">${serializeLegalBootstrap({ document })}</script><div id="root"`)
}

export function renderMissingPageHtml(shell: string, status: 404 | 503, legal = false): string {
  const title = status === 404 ? 'Seite nicht gefunden' : 'Seite gerade nicht verfügbar'
  const heading = status === 404 ? 'Diese Seite gibt es nicht' : 'Diese Seite kann gerade nicht geladen werden'
  const message = status === 404 ? 'Vielleicht wurde sie verschoben oder der Link ist nicht mehr gültig.' : 'Bitte versuche es später noch einmal. Die zuletzt veröffentlichte Fassung bleibt unverändert.'
  const content = `<div id="${legal ? 'legal-prerender' : 'site-not-found-prerender'}"><main class="not-found-page" aria-labelledby="not-found-title"><p class="not-found-code" aria-hidden="true">${status}</p><h1 id="not-found-title">${heading}</h1><p>${message}</p><nav class="legal-page-actions" aria-label="Weiter nach der Fehlerseite"><a class="legal-page-primary" href="/">Startseite</a><a class="legal-page-secondary" href="/wissen">Wissen entdecken</a><a class="legal-page-secondary" href="/stacks">Meine Stacks</a></nav></main></div>`
  return preparePageShell(shell, resolveRouteHead({ pathname: legal ? '/impressum' : '/not-found', status, title: `${title} | Supplement Stack` }))
    .replace(/<div\s+id=["']root["']/i, () => `${content}${legal ? `<script type="application/json" id="legal-document-bootstrap">${serializeLegalBootstrap({ document: null, status })}</script>` : ''}<div id="root"`)
}

export function pageResponse(html: string, shell: Response, status: number, head = false, routeHead?: RouteHead): Response {
  const headers = new Headers(shell.headers)
  headers.set('Content-Type', 'text/html; charset=utf-8')
  headers.set('Cache-Control', routeHead?.cacheControl ?? 'no-store')
  for (const name of ['Content-Length', 'Content-Encoding', 'ETag', 'Last-Modified', 'Location']) headers.delete(name)
  if (status !== 200) headers.set('X-Robots-Tag', 'noindex, nofollow')
  if (routeHead) {
    headers.set('X-Robots-Tag', routeHead.robots.replaceAll(',', ', '))
    headers.set('Referrer-Policy', routeHead.referrerPolicy)
  }
  if (status === 503) headers.set('Retry-After', '60')
  return new Response(head ? null : html, { status, headers })
}
