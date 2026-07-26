export type ArticleSource = {
  source_id?: string
  label: string
  url: string
  name?: string
  link?: string
  internal_articles?: InternalSourceArticle[]
}

export type ArticleSourceRow = {
  label: string
  url: string
  sort_order: number
}

export type InternalSourceArticleTarget = {
  slug: string
  title: string
}

export type InternalSourceArticle = InternalSourceArticleTarget & {
  url: string
}

export type InternalSourceArticleLocator = {
  source_url?: string | null
  doi?: string | null
  pubmed_id?: string | null
  source_label?: string | null
}

export type ParsedArticleSources = {
  sources: ArticleSource[]
  isV2Projection: boolean
  relationPositions: number[]
}

export function parseArticleSourcesPayload(value: string): ParsedArticleSources {
  try {
    const parsed: unknown = JSON.parse(value)
    const projection = parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? parsed as Record<string, unknown>
      : null
    const isV2Projection = projection?.schema === 'knowledge_article_sources_projection.v2'
    const entries = Array.isArray(parsed)
      ? parsed
      : isV2Projection && Array.isArray(projection?.relations)
        ? projection.relations
        : []
    const normalizedEntries = entries
      .map((source, index) => {
        if (!source || typeof source !== 'object') return null
        const row = source as Record<string, unknown>
        if (typeof row.label !== 'string' || typeof row.url !== 'string') return null
        return {
          source: {
            ...(typeof row.source_id === 'string' && row.source_id ? { source_id: row.source_id } : {}),
            label: row.label,
            url: row.url,
          },
          position: Number.isInteger(row.position) && Number(row.position) >= 0 ? Number(row.position) : index,
        }
      })
      .filter((entry): entry is { source: ArticleSource; position: number } => entry !== null)
    return {
      sources: normalizedEntries.map((entry) => entry.source),
      isV2Projection,
      relationPositions: normalizedEntries.map((entry) => entry.position),
    }
  } catch {
    return { sources: [], isV2Projection: false, relationPositions: [] }
  }
}

export function bindV2ProjectionSourcesToRows(
  projection: ParsedArticleSources,
  rows: ArticleSourceRow[],
): ArticleSource[] {
  if (!projection.isV2Projection) {
    return rows.map((row) => ({ label: row.label, url: row.url, name: row.label, link: row.url }))
  }
  if (rows.length !== projection.sources.length) {
    throw new Error('knowledge_article_sources differs from v2 source projection count')
  }

  return rows.map((row, index) => {
    const projected = projection.sources[index]
    if (
      row.sort_order !== projection.relationPositions[index]
      || row.label !== projected.label
      || row.url !== projected.url
      || !projected.source_id
    ) {
      throw new Error(`knowledge_article_sources differs from v2 source projection at position ${index}`)
    }
    return {
      source_id: projected.source_id,
      label: row.label,
      url: row.url,
      name: row.label,
      link: row.url,
    }
  })
}

function normalizeLookupUrl(value: string | null | undefined): string | null {
  const trimmed = (value ?? '').trim()
  if (!trimmed) return null
  const absoluteUrl = trimmed.match(/^([a-z][a-z0-9+.-]*):\/\/([^/?#]*)(.*)$/i)
  if (!absoluteUrl) return trimmed
  const [, protocol, authority, suffix] = absoluteUrl
  const userInfoEnd = authority.lastIndexOf('@')
  const userInfo = userInfoEnd >= 0 ? authority.slice(0, userInfoEnd + 1) : ''
  const host = userInfoEnd >= 0 ? authority.slice(userInfoEnd + 1) : authority
  return `${protocol.toLowerCase()}://${userInfo}${host.toLowerCase()}${suffix}`
}

export function sourceLookupKeys(value: string | null | undefined): string[] {
  const normalized = normalizeLookupUrl(value)
  if (!normalized) return []
  const suffixStart = normalized.search(/[?#]/)
  const path = suffixStart >= 0 ? normalized.slice(0, suffixStart) : normalized
  const suffix = suffixStart >= 0 ? normalized.slice(suffixStart) : ''
  const alternatePath = path.endsWith('/') ? path.replace(/\/+$/, '') : `${path}/`
  const keys = [normalized, `${alternatePath}${suffix}`]
  try {
    const parsed = new URL(normalized)
    const hostname = parsed.hostname.toLowerCase()
    const hostIs = (domain: string) => hostname === domain || hostname.endsWith(`.${domain}`)
    const pathname = parsed.pathname.toLowerCase().replace(/\/+$/, '') || '/'
    if (hostIs('nationalacademies.org')) {
      const publicationId = parsed.pathname.match(/\/(?:publications?|publication)\/(\d+)(?:\/|$)/i)?.[1]
      if (publicationId) keys.push(`nationalacademies:publication:${publicationId}`)
    }
    const fdaBiotinPaths = new Set([
      '/medical-devices/safety-communications/fda-warns-biotin-may-interfere-lab-tests-fda-safety-communication',
      '/medical-devices/in-vitro-diagnostics/biotin-interference-troponin-lab-tests-assays-subject-biotin-interference',
    ])
    if (hostIs('fda.gov') && fdaBiotinPaths.has(pathname)) {
      keys.push('fda:biotin-lab-test-interference')
    }
    const bfrVitaminKPaths = new Set([
      '/veroeffentlichung/hoechstmengenvorschlaege-fuer-vitamin-k-in-lebensmitteln-inklusive-nahrungsergaenzungsmitteln',
      '/cm/343/hoechstmengenvorschlaege-fuer-vitamin-k-in-lebensmitteln-inklusive-nahrungsergaenzungsmitteln.pdf',
    ])
    if (hostIs('bfr.bund.de') && bfrVitaminKPaths.has(pathname)) {
      keys.push('bfr:maximum-levels:vitamin-k:2021')
    }
  } catch {}
  return [...new Set(keys)]
}

function normalizeDoi(value: string | null | undefined): string | null {
  let normalized = (value ?? '').trim().toLowerCase()
  if (!normalized) return null
  normalized = normalized
    .replace(/^https?:\/\/(?:dx\.)?doi\.org\//, '')
    .replace(/^doi:\s*/, '')
    .replace(/^\/+|\/+$/g, '')
  return /^10\.\d{4,9}\/.+/.test(normalized) ? normalized : null
}

function doiFromPublisherUrl(value: string | null | undefined): string | null {
  const rawValue = (value ?? '').trim()
  if (!rawValue) return null
  try {
    const parsed = new URL(rawValue)
    const match = decodeURIComponent(parsed.pathname).match(/\/doi\/(?:abs\/|full\/|pdf\/)?(10\.\d{4,9}\/.+)$/i)
    return normalizeDoi(match?.[1]?.replace(/\/(?:full|abstract|pdf)$/i, '') ?? null)
  } catch {
    return null
  }
}

function pubmedLookupKeys(value: string | null | undefined): string[] {
  const rawValue = (value ?? '').trim()
  let normalized = rawValue
    .trim()
    .toLowerCase()
    .replace(/^pmid:\s*/, '')
    .replace(/^https?:\/\/pubmed\.ncbi\.nlm\.nih\.gov\//, '')
    .replace(/^\/+|\/+$/g, '')
  if (!/^\d+$/.test(normalized)) {
    try {
      const parsed = new URL(rawValue)
      const isPubmedEfetch = parsed.hostname.toLowerCase() === 'eutils.ncbi.nlm.nih.gov'
        && parsed.pathname.toLowerCase() === '/entrez/eutils/efetch.fcgi'
        && parsed.searchParams.get('db')?.toLowerCase() === 'pubmed'
      normalized = isPubmedEfetch ? (parsed.searchParams.get('id') ?? '').trim() : ''
    } catch {
      normalized = ''
    }
  }
  if (!/^\d+$/.test(normalized)) return []
  return sourceLookupKeys(`https://pubmed.ncbi.nlm.nih.gov/${normalized}/`)
}

function structuredIdentifierLookupKeysFromLabel(value: string | null | undefined): string[] {
  const label = (value ?? '').trim()
  if (!label) return []

  const keys: string[] = []
  const doiMatch = label.match(/(?:\bDOI(?:\s*:\s*|\s+)|https?:\/\/(?:dx\.)?doi\.org\/)(10\.\d{4,9}\/\S+)/i)
  if (doiMatch?.[1]) {
    const doi = normalizeDoi(doiMatch[1].replace(/[.,;:]+$/g, ''))
    if (doi) keys.push(...sourceLookupKeys(`https://doi.org/${doi}`))
  }

  const pmidMatch = label.match(/\bPMID(?:\s*:\s*|\s+)(\d+)\b/i)
  if (pmidMatch?.[1]) keys.push(...pubmedLookupKeys(pmidMatch[1]))
  return [...new Set(keys)]
}

export function internalSourceArticleTargetLookupKeys(
  locator: InternalSourceArticleLocator,
): string[] {
  const doi = normalizeDoi(locator.doi) ?? normalizeDoi(locator.source_url) ?? doiFromPublisherUrl(locator.source_url)
  const keys = [
    ...sourceLookupKeys(locator.source_url),
    ...sourceLookupKeys(doi ? `https://doi.org/${doi}` : null),
    ...pubmedLookupKeys(locator.pubmed_id),
    ...pubmedLookupKeys(locator.source_url),
    ...structuredIdentifierLookupKeysFromLabel(locator.source_label),
  ]
  return [...new Set(keys)]
}

function uniqueInternalTargets(matches: InternalSourceArticleTarget[]): InternalSourceArticleTarget[] {
  const bySlug = new Map<string, InternalSourceArticleTarget>()
  for (const target of matches) if (!bySlug.has(target.slug)) bySlug.set(target.slug, target)
  return [...bySlug.values()]
}

function internalTargetsForSource(
  source: ArticleSource,
  targets: Map<string, InternalSourceArticleTarget[]>,
): InternalSourceArticleTarget[] {
  return uniqueInternalTargets(
    internalSourceArticleTargetLookupKeys({ source_url: source.url, source_label: source.label })
      .flatMap((key) => targets.get(key) ?? []),
  )
}

export function enrichV2SourcesWithInternalArticles(
  sources: ArticleSource[],
  targets: Map<string, InternalSourceArticleTarget[]>,
): ArticleSource[] {
  if (targets.size === 0) return sources

  return sources.map((source) => {
    const matches = internalTargetsForSource(source, targets)
    const seenSlugs = new Set<string>()
    const internalArticles: InternalSourceArticle[] = []
    for (const target of matches) {
      if (!/^[a-z0-9-]+$/.test(target.slug) || !target.title.trim() || seenSlugs.has(target.slug)) continue
      seenSlugs.add(target.slug)
      internalArticles.push({
        slug: target.slug,
        title: target.title,
        url: `/wissen/${target.slug}`,
      })
    }
    return internalArticles.length > 0
      ? { ...source, internal_articles: internalArticles }
      : source
  })
}

export function projectFullyCoveredV2SourcesToInternalArticles(
  sources: ArticleSource[],
  targets: Map<string, InternalSourceArticleTarget[]>,
): ArticleSource[] | null {
  if (sources.length === 0 || targets.size === 0) return null

  const coveredTargets = new Map<string, InternalSourceArticleTarget>()
  for (const source of sources) {
    const matches = internalTargetsForSource(source, targets).filter(
      (target) => /^[a-z0-9-]+$/.test(target.slug) && Boolean(target.title.trim()),
    )
    if (matches.length === 0) return null
    for (const target of matches) {
      if (!coveredTargets.has(target.slug)) coveredTargets.set(target.slug, target)
    }
  }

  return [...coveredTargets.values()]
    .sort((left, right) => left.slug < right.slug ? -1 : left.slug > right.slug ? 1 : 0)
    .map((target) => {
      const label = target.title
      const url = `/wissen/${target.slug}`
      return {
        source_id: `internal-article-${target.slug}`,
        label,
        url,
        name: label,
        link: url,
      }
    })
}

export function appendLegacyInternalSourceTargets(
  sources: ArticleSource[],
  targets: Map<string, InternalSourceArticleTarget[]>,
): ArticleSource[] {
  const seenUrls = new Set<string>()
  const originalSources = sources.filter((source) => {
    const keys = sourceLookupKeys(source.url)
    if (keys.length === 0 || keys.some((key) => seenUrls.has(key))) return false
    keys.forEach((key) => seenUrls.add(key))
    return true
  })
  if (targets.size === 0) return originalSources

  const internalSources: ArticleSource[] = []
  const seenSlugs = new Set<string>()
  for (const source of originalSources) {
    const matches = internalTargetsForSource(source, targets)
    for (const target of matches) {
      if (seenSlugs.has(target.slug)) continue
      const internalUrl = `/wissen/${target.slug}`
      const urlKeys = sourceLookupKeys(internalUrl)
      if (urlKeys.length === 0 || urlKeys.some((key) => seenUrls.has(key))) continue
      seenSlugs.add(target.slug)
      urlKeys.forEach((key) => seenUrls.add(key))
      internalSources.push({
        label: `Studienartikel: ${target.title}`,
        url: internalUrl,
        name: `Studienartikel: ${target.title}`,
        link: internalUrl,
      })
    }
  }

  return [...originalSources, ...internalSources]
}
