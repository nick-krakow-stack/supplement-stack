import { escapeLegalHtml as escapeHtml, serializeLegalBootstrap } from './legal-document-renderer.mjs'
import { resolveRouteHead, buildKnowledgeOverviewJsonLd, type RouteHead } from './route-head-contract.mjs'
import { preparePageShell } from './site-page-html'
import type { KnowledgeOverviewPayload } from '../api/modules/knowledge-overview-projection'
import { knowledgeCategoryLabel } from '../../frontend/src/lib/knowledgeCategories'
import type { PublicSharePage } from './site-page-data'
import { INTAKE_PLAN_INTRO } from './public-page-copy.mjs'

const navigation = '<nav aria-label="Weitere Seiten"><a href="/">Startseite</a> · <a href="/wissen">Wissen entdecken</a> · <a href="/demo">Demo ausprobieren</a></nav>'
const styles = '<style>#site-page-prerender{font-family:system-ui,sans-serif;max-width:70rem;margin:2rem auto;padding:2rem;color:#172033;line-height:1.65}#site-page-prerender h1{font-size:clamp(1.8rem,4vw,3rem);line-height:1.2}#site-page-prerender a{color:#254bc2;text-decoration:underline}#site-page-prerender section{margin-top:2rem}#site-page-prerender label{display:block;margin-top:1rem}#site-page-prerender input{border:1px solid #94a3b8;border-radius:.5rem;padding:.6rem;max-width:100%}#site-page-prerender fieldset{border:0;padding:0}</style>'

export function renderSitePage(shell: string, head: RouteHead, content: string, pathname?: string, knowledgeOverview?: KnowledgeOverviewPayload): string {
  const bootstrap = { status: head.status, pageKind: head.kind, pathname }
  return preparePageShell(shell, head).replace(/<div\s+id=["']root["']/i, () => `<div id="site-page-prerender">${styles}<main>${content}</main></div><script type="application/json" id="site-delivery-bootstrap">${serializeLegalBootstrap(bootstrap)}</script>${knowledgeOverview ? `<script type="application/json" id="knowledge-overview-bootstrap">${serializeLegalBootstrap(knowledgeOverview)}</script>` : ''}<div id="root"`)
}

export function renderPublicIntro(pathname: '/' | '/demo' | '/einnahmeplan-erstellen'): string {
  if (pathname === '/demo') return '<h1>Deinen Supplement-Stack ausprobieren</h1><p>Teste die Wirkstoffsuche, baue einen Beispiel-Stack auf und vergleiche deine monatlichen Produktkosten – kostenlos und ohne Konto.</p><p>Die Demo bleibt in deinem Browser. Speichern im Konto, E-Mail-Versand und eigene Produkte kannst du nach der Anmeldung nutzen.</p><p>Allgemeine Referenzwerte und Studienmengen sind keine persönliche Einnahmeempfehlung.</p><noscript><p>Aktiviere JavaScript, um die interaktive Demo zu nutzen. Die Wissensartikel kannst du auch ohne JavaScript lesen.</p></noscript><p><a href="/register">Kostenlos registrieren</a></p>' + navigation
  if (pathname === '/einnahmeplan-erstellen') return `<h1>${INTAKE_PLAN_INTRO.heading}</h1><p>${INTAKE_PLAN_INTRO.description}</p><p>${INTAKE_PLAN_INTRO.boundary}</p><p>${INTAKE_PLAN_INTRO.links.map((link) => `<a href="${link.href}">${link.label}</a>`).join(' · ')}</p>${navigation}`
  return '<h1>Dein übersichtlicher Supplement-Stack.</h1><p>Quellenbasiert planen. Einfach vergleichen. Kostenlos starten.</p><p>Ordne allgemeine Referenzwerte und Studienmengen ein, vergleiche Produktangaben und plane deinen eigenen Stack. Die Inhalte sind keine persönliche Empfehlung und ersetzen keine medizinische Beratung.</p><section><h2>So funktioniert Supplement Stack</h2><ol><li>Suche einen Wirkstoff und lies vorhandene offizielle Referenzwerte und Studienangaben.</li><li>Vergleiche Produktangaben und lege deine geplante Menge selbst fest.</li><li>Behalte deinen Stack, die Einnahmezeiten und deine Kosten im Blick.</li></ol></section><p><a href="/demo">Demo ohne Konto ausprobieren</a> · <a href="/register">Kostenlos registrieren</a> · <a href="/wissen">Wissen entdecken</a></p>'
}

export function knowledgeOverviewPage(overview: KnowledgeOverviewPayload): { head: RouteHead; content: string } {
  const categories = new Map<string, string[]>()
  for (const nutrient of overview.nutrient_statuses) {
    const label = knowledgeCategoryLabel(nutrient.category_key) ?? 'Sonstige'
    if (!categories.has(label)) categories.set(label, [])
    if (nutrient.name) categories.get(label)?.push(nutrient.name)
  }
  const categoryHtml = [...categories].map(([label, names]) => `<section><h2>${escapeHtml(label)}</h2><p>${names.map(escapeHtml).join(' · ')}</p></section>`).join('')
  const articleLinks = overview.articles.map((article) => `<li><a href="/wissen/${encodeURIComponent(article.slug)}">${escapeHtml(article.title)}</a></li>`).join('')
  const jsonLd = buildKnowledgeOverviewJsonLd(overview.articles)
  return {
    head: resolveRouteHead({ pathname: '/wissen', jsonLd }),
    content: `<h1>Alles über Vitamine, Mineralstoffe &amp; Co. – einfach erklärt</h1><p>Hier findest du Wirkstoffe nach Kategorien und alle veröffentlichten Hauptartikel. In den Artikeln führen dich Quellenlinks zu den zugehörigen Studien und Originalquellen.</p>${categoryHtml}<section><h2>Alle Hauptartikel</h2><ul>${articleLinks}</ul></section>${navigation}`,
  }
}

export function authPageContent(path: string, status: number, hasToken: boolean): string {
  const heading = path === '/login' ? 'Anmelden' : path === '/register' ? 'Kostenlos registrieren' : path === '/forgot-password' ? 'Passwort vergessen?' : path === '/reset-password' ? 'Neues Passwort festlegen' : 'E-Mail bestätigen'
  if (status === 400 || status === 410) return `<h1>${heading}</h1><p>${status === 410 ? 'Dieser Link ist abgelaufen.' : 'Dieser Link ist ungültig.'} Bitte fordere einen neuen Link an.</p><p><a href="${path === '/reset-password' ? '/forgot-password' : '/login'}">${path === '/reset-password' ? 'Neuen Passwort-Link anfordern' : 'Anmelden und Bestätigungslink erneut anfordern'}</a></p>${navigation}`
  if (path === '/verify-email') return `<h1>${heading}</h1><p>${hasToken ? 'Der Bestätigungslink ist gültig. Die Bestätigung erfolgt in der App.' : 'Öffne den Bestätigungslink aus deiner E-Mail. Wenn du keinen aktuellen Link hast, kannst du nach der Anmeldung einen neuen anfordern.'}</p><noscript><p>Für die Bestätigung benötigst du JavaScript.</p></noscript>${navigation}`
  const passwordOnly = path === '/reset-password'
  const emailOnly = path === '/forgot-password'
  // Disabled controls intentionally never submit a password/token as URL data without the app.
  return `<h1>${heading}</h1><p>${emailOnly ? 'Fordere einen Link an, um ein neues Passwort festzulegen.' : passwordOnly ? 'Wähle ein neues Passwort mit mindestens 8 Zeichen.' : path === '/register' ? 'Erstelle dein kostenloses Konto, um eigene Stacks zu speichern.' : 'Melde dich an, um deine gespeicherten Stacks zu öffnen.'}</p><form aria-label="${heading}"><fieldset disabled><legend>Formular wird in der App bereitgestellt</legend>${passwordOnly ? '' : '<label>E-Mail-Adresse <input type="email" autocomplete="email"></label>'}${emailOnly ? '' : `<label>${passwordOnly ? 'Neues Passwort' : 'Passwort'} <input type="password" autocomplete="${passwordOnly || path === '/register' ? 'new-password' : 'current-password'}" minlength="8"></label>`}<button type="button" disabled>${emailOnly ? 'Link anfordern' : heading}</button></fieldset></form><noscript><p>Aktiviere JavaScript, um dieses Formular sicher zu nutzen. Ohne JavaScript werden keine Eingaben gesendet.</p></noscript><p><a href="/login">Anmelden</a> · <a href="/forgot-password">Passwort vergessen?</a></p>${navigation}`
}

export function sharePageProjection(pathname: string, share: PublicSharePage): { head: RouteHead; content: string } {
  const title = share.status === 200 ? share.title || 'Geteilte Empfehlung' : share.status === 410 ? 'Empfehlung nicht mehr verfügbar' : share.status === 404 ? 'Empfehlung nicht gefunden' : 'Empfehlung gerade nicht verfügbar'
  const description = share.status === 200 ? `${share.creatorName ? `Von ${share.creatorName}. ` : ''}Sieh dir die geteilte Zusammenstellung an. Du entscheidest selbst, welche Produkte du übernehmen möchtest.` : share.message
  return {
    head: resolveRouteHead({ pathname, status: share.status, title: `${title} | Supplement Stack`, description }),
    content: `<h1>${escapeHtml(title)}</h1><p>${escapeHtml(description ?? '')}</p>${share.status === 200 ? `<h2>Produkte in dieser Zusammenstellung</h2><ul>${(share.productNames ?? []).map((name) => `<li>${escapeHtml(name)}</li>`).join('')}</ul><p>Dein eigener Stack bleibt unverändert, bis du in der App eine Auswahl bestätigst. Dies ist keine persönliche Einnahmeempfehlung.</p><noscript><p>Aktiviere JavaScript, wenn du Produkte auswählen und in deinen Stack übernehmen möchtest.</p></noscript>` : ''}${navigation}`,
  }
}
