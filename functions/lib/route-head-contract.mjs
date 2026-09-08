import { isCreatorProfilePath, isKnownAppPath } from './site-routes.mjs'

export const SITE_ORIGIN = 'https://supplementstack.de'
export const DEFAULT_SOCIAL_IMAGE = `${SITE_ORIGIN}/logo.png`

// One delivery catalogue shared by the edge renderer, SPA and crawler endpoints.
const ROUTES = {
  '/': ['home', 'Supplement Stack – quellenbasiert planen und vergleichen', 'Ordne deine Nahrungsergänzung, vergleiche Produkte und Kosten und informiere dich anhand verständlich erklärter Quellen.', true],
  '/wissen': ['knowledge-index', 'Wissen zu Nahrungsergänzung | Supplement Stack', 'Informiere dich über Wirkstoffe, Studien und ihre Grenzen. Verständliche Wissensartikel helfen dir, Nahrungsergänzung besser einzuordnen.', true],
  '/demo': ['demo', 'Kostenlose Demo | Supplement Stack', 'Probiere Supplement Stack ohne Anmeldung aus: Produkte zusammenstellen, Kosten vergleichen und einen Beispielplan kennenlernen.', true],
  '/einnahmeplan-erstellen': ['intake-intro', 'Einnahmeplan erstellen | Supplement Stack', 'Ordne die Produkte aus deinem Stack nach Zeitpunkt und Häufigkeit. Lerne kennen, wie du deinen Plan ansehen, drucken und speichern kannst.', true],
  '/login': ['auth', 'Anmelden | Supplement Stack', 'Melde dich an, um deine gespeicherten Stacks und deinen Einnahmeplan zu öffnen.', false],
  '/register': ['auth', 'Kostenlos registrieren | Supplement Stack', 'Erstelle ein Konto, um deine Stacks zu speichern und jederzeit wieder aufzurufen.', false],
  '/forgot-password': ['auth', 'Passwort zurücksetzen | Supplement Stack', 'Fordere einen Link an, um ein neues Passwort für dein Konto festzulegen.', false],
  '/reset-password': ['auth-token', 'Neues Passwort | Supplement Stack', 'Lege über deinen persönlichen Link ein neues Passwort fest.', false],
  '/verify-email': ['auth-token', 'E-Mail bestätigen | Supplement Stack', 'Bestätige deine E-Mail-Adresse, um die Einrichtung deines Kontos abzuschließen.', false],
  '/impressum': ['legal', 'Impressum | Supplement Stack', 'Anbieterangaben und Kontakt zu Supplement Stack.', false],
  '/datenschutz': ['legal', 'Datenschutz | Supplement Stack', 'Informationen zum Umgang mit personenbezogenen Daten bei Supplement Stack.', false],
  '/nutzungsbedingungen': ['legal', 'Nutzungsbedingungen | Supplement Stack', 'Die Bedingungen für die Nutzung von Supplement Stack.', false],
  '/stacks': ['private', 'Meine Stacks | Supplement Stack', 'Deine gespeicherten Zusammenstellungen.', false],
  '/einnahmeplan': ['private', 'Einnahmeplan | Supplement Stack', 'Dein persönlicher Einnahmeplan.', false],
  '/my-products': ['private', 'Eigene Produkte | Supplement Stack', 'Verwalte deine selbst angelegten Produkte.', false],
  '/profile': ['private', 'Mein Profil | Supplement Stack', 'Verwalte deine Kontoeinstellungen.', false],
  '/creator': ['private', 'Creator-Bereich | Supplement Stack', 'Verwalte dein Creator-Profil und deine geteilten Empfehlungen.', false],
}

export const PUBLIC_SITEMAP_PATHS = Object.freeze(Object.entries(ROUTES).filter(([, row]) => row[3]).map(([path]) => path))

export function buildKnowledgeOverviewJsonLd(articles) {
  const unique = new Map()
  for (const article of articles) {
    if (article.article_layer && article.article_layer !== 'main_article' || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(article.slug)) continue
    unique.set(article.slug, article)
  }
  const canonical = `${SITE_ORIGIN}/wissen`
  return { '@context': 'https://schema.org', '@graph': [
    { '@type': 'CollectionPage', '@id': canonical, name: 'Wissen zu Nahrungsergänzung', url: canonical, inLanguage: 'de', isPartOf: { '@id': `${SITE_ORIGIN}/#website` },
      mainEntity: { '@type': 'ItemList', itemListElement: [...unique.values()].sort((a, b) => a.slug.localeCompare(b.slug)).map((article, index) => ({ '@type': 'ListItem', position: index + 1, name: article.title, url: `${canonical}/${article.slug}` })) },
      breadcrumb: { '@id': `${canonical}#breadcrumb` } },
    { '@type': 'BreadcrumbList', '@id': `${canonical}#breadcrumb`, itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Startseite', item: `${SITE_ORIGIN}/` },
      { '@type': 'ListItem', position: 2, name: 'Wissen', item: canonical },
    ] },
  ] }
}

function baseSchema(kind, canonicalUrl) {
  const publisher = { '@type': 'Organization', '@id': `${SITE_ORIGIN}/#organization`, name: 'Supplement Stack', url: SITE_ORIGIN, logo: DEFAULT_SOCIAL_IMAGE }
  if (kind === 'home') return { '@context': 'https://schema.org', '@graph': [publisher,
    { '@type': 'WebSite', '@id': `${SITE_ORIGIN}/#website`, name: 'Supplement Stack', url: SITE_ORIGIN, inLanguage: 'de', publisher: { '@id': publisher['@id'] } },
    { '@type': 'WebApplication', '@id': `${SITE_ORIGIN}/#application`, name: 'Supplement Stack', url: SITE_ORIGIN, applicationCategory: 'LifestyleApplication', operatingSystem: 'Web browser' },
  ] }
  if (kind === 'demo') return { '@context': 'https://schema.org', '@type': 'WebApplication', name: 'Supplement Stack Demo', url: canonicalUrl, applicationCategory: 'LifestyleApplication', operatingSystem: 'Web browser' }
  if (kind === 'knowledge-index') return { '@context': 'https://schema.org', '@type': 'CollectionPage', name: 'Wissen zu Nahrungsergänzung', url: canonicalUrl, inLanguage: 'de', isPartOf: { '@id': `${SITE_ORIGIN}/#website` } }
  return null
}

export function resolveRouteHead({ pathname, status, title, description, jsonLd, image, profilePublished = false } = {}) {
  const path = typeof pathname === 'string' ? pathname.split(/[?#]/, 1)[0].replace(/\/$/, '') || '/' : '/'
  let row = ROUTES[path]
  if (!row && /^\/wissen\/[a-z0-9]+(?:-[a-z0-9]+)*$/.test(path)) row = ['knowledge-article', 'Wissensartikel | Supplement Stack', 'Quellenbasiertes Wissen zu Nahrungsergänzung.', true]
  if (!row && /^\/share\/[^/]+$/.test(path)) row = ['share', 'Geteilte Empfehlung | Supplement Stack', 'Sieh dir eine geteilte Zusammenstellung an und entscheide selbst, was du übernehmen möchtest.', false]
  if (!row && isCreatorProfilePath(path)) row = ['creator-profile', 'Öffentliche Creator-Seite | Supplement Stack', 'Lerne einen Creator auf Supplement Stack kennen.', profilePublished === true]
  if (!row && path.startsWith('/administrator') && isKnownAppPath(path)) row = ['private', 'Verwaltung | Supplement Stack', 'Geschützter Verwaltungsbereich.', false]
  const effectiveStatus = status ?? (row ? 200 : 404)
  const error = effectiveStatus >= 400
  const [kind, defaultTitle, defaultDescription, publicIndex] = row ?? ['error', 'Seite nicht gefunden | Supplement Stack', 'Diese Seite ist nicht verfügbar. Über die Startseite oder den Wissensbereich findest du weiter.', false]
  const sensitive = ['share', 'private', 'auth-token'].includes(kind)
  const indexable = !!publicIndex && !error
  const canonicalUrl = !error && (indexable || kind === 'legal') ? `${SITE_ORIGIN}${path}` : null
  return {
    kind: error ? 'error' : kind,
    title: title || (error ? (effectiveStatus >= 500 ? 'Seite vorübergehend nicht erreichbar | Supplement Stack' : 'Seite nicht gefunden | Supplement Stack') : defaultTitle),
    description: description || (error ? 'Diese Seite ist gerade nicht verfügbar. Über die Startseite oder den Wissensbereich findest du weiter.' : defaultDescription),
    robots: indexable ? 'index,follow' : sensitive || error ? 'noindex,nofollow' : 'noindex,follow',
    canonicalUrl,
    ogType: kind === 'knowledge-article' && !error ? 'article' : 'website',
    image: image && /^https:\/\//.test(image) ? image : DEFAULT_SOCIAL_IMAGE,
    imageAlt: 'Supplement Stack',
    jsonLd: indexable ? (jsonLd ?? baseSchema(kind, canonicalUrl)) : null,
    status: effectiveStatus,
    cacheControl: indexable && kind !== 'creator-profile' ? 'public, max-age=0, must-revalidate' : 'private, no-store',
    referrerPolicy: sensitive || error ? 'no-referrer' : 'strict-origin-when-cross-origin',
    indexable,
    authRequired: kind === 'private',
  }
}

/** Only known app aliases redirect. Never use request host or echo token queries. */
export function canonicalRouteRedirect(inputURL) {
  const url = new URL(inputURL, SITE_ORIGIN)
  if (/^\/agb\/?$/.test(url.pathname)) return `${SITE_ORIGIN}/nutzungsbedingungen`
  if (url.pathname !== '/' && url.pathname.endsWith('/') && isKnownAppPath(url.pathname)) {
    // Preserve functional deep-link parameters for the app, never in metadata.
    return `${SITE_ORIGIN}${url.pathname.slice(0, -1)}${url.search}`
  }
  return null
}

/** Legacy D1 UTC timestamps and explicit ISO offsets converge without invented dates. */
export function normalizeIsoTimestamp(value) {
  if (typeof value !== 'string') return null
  const text = value.trim()
  const match = /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2}):(\d{2})(\.\d{1,3})?(Z|[+-]\d{2}:\d{2})?)?$/.exec(text)
  if (!match) return null
  const [, year, month, day, hour = '00', minute = '00', second = '00', fraction = '', zone = 'Z'] = match
  const y = Number(year), m = Number(month), d = Number(day)
  const days = new Date(Date.UTC(y, m, 0)).getUTCDate()
  if (m < 1 || m > 12 || d < 1 || d > days || Number(hour) > 23 || Number(minute) > 59 || Number(second) > 59) return null
  const date = new Date(`${year}-${month}-${day}T${hour}:${minute}:${second}${fraction}${zone}`)
  return Number.isFinite(date.getTime()) ? date.toISOString() : null
}

const escape = (value) => String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;')

export function renderRouteHeadHtml(head) {
  const meta = (name, content, property = false) => `<meta ${property ? 'property' : 'name'}="${name}" content="${escape(content)}" data-route-head>`
  const tags = [`<title>${escape(head.title)}</title>`, meta('description', head.description), meta('robots', head.robots), meta('referrer', head.referrerPolicy),
    meta('og:title', head.title, true), meta('og:description', head.description, true), meta('og:type', head.ogType, true), meta('og:site_name', 'Supplement Stack', true), meta('og:locale', 'de_DE', true),
    meta('og:image', head.image, true), meta('og:image:alt', head.imageAlt, true), meta('twitter:card', 'summary_large_image'), meta('twitter:title', head.title), meta('twitter:description', head.description), meta('twitter:image', head.image), meta('twitter:image:alt', head.imageAlt)]
  if (head.canonicalUrl) tags.push(`<link rel="canonical" href="${escape(head.canonicalUrl)}" data-route-head>`, meta('og:url', head.canonicalUrl, true))
  if (head.jsonLd) tags.push(`<script type="application/ld+json" id="route-json-ld" data-route-head${head.kind === 'knowledge-article' ? ' data-knowledge-article-json-ld="true"' : ''}>${JSON.stringify(head.jsonLd).replace(/</g, '\\u003c').replace(/>/g, '\\u003e').replace(/&/g, '\\u0026')}</script>`)
  return tags.join('\n')
}

export function applyRouteHeadHtml(shell, head) {
  const clean = shell.replace(/<title\b[^>]*>[\s\S]*?<\/title\s*>/gi, '')
    .replace(/<meta\b[^>]*(?:name|property)\s*=\s*["'](?:description|robots|referrer|og:[^"']*|twitter:[^"']*)["'][^>]*>/gi, '')
    .replace(/<link\b[^>]*rel\s*=\s*["']canonical["'][^>]*>/gi, '')
    .replace(/<script\b[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>[\s\S]*?<\/script\s*>/gi, '')
  return clean.replace(/<\/head\s*>/i, () => `${renderRouteHeadHtml(head)}\n</head>`)
}
