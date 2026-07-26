function fail(message) { throw new Error(message) }

export const MAGAZINE_TEMPLATE_MARKER = '<!-- knowledge-template:magazine -->'
export const AUTO_SOURCES_MARKER = '<!-- sources:auto -->'

function assertRawLeadingH1(markdown, stage) {
  if (typeof markdown !== 'string') fail('article authoring markdown must be a string')
  if (!markdown.startsWith('# ')) fail(`${stage} article must start with an H1 at byte 1`)
}

export function normalizeAuthoringMarkdown(markdown) {
  if (typeof markdown !== 'string') fail('article authoring markdown must be a string')
  const normalized = markdown.replaceAll('\r\n', '\n').trim()
  if (!normalized) fail('article authoring markdown is empty')
  return normalized
}

function oneHeading(markdown, pattern, label) {
  const matches = [...markdown.matchAll(pattern)]
  if (matches.length !== 1) fail(`article needs exactly one ${label} heading`)
  return matches[0]
}

function normalizeVisibleSources(visibleSources, stage) {
  if (!Array.isArray(visibleSources) || visibleSources.length === 0) fail(`${stage} article needs visible sources`)
  const normalized = visibleSources.map((source, index) => {
    const sourceId = String(source?.source_id ?? '').trim()
    const label = String(source?.label ?? '').trim()
    const url = String(source?.url ?? '').trim()
    const validUrl = stage === 'Stage-3'
      ? /^\/wissen\/[a-z0-9-]+$/.test(url)
      : /^https?:\/\//i.test(url)
    if (!sourceId || !label || !validUrl) fail(`${stage} visible source ${index} is invalid`)
    return { source_id: sourceId, label, url }
  })
  if (new Set(normalized.map((source) => source.source_id)).size !== normalized.length) fail(`${stage} visible sources contain duplicate source_id values`)
  return normalized
}

function visibleSectionContent(section) {
  return section
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<[^>]+>/g, '')
    .replace(/!\[[^\]\n]*\]\([^)\n]+\)/g, 'image')
    .replace(/\[([^\]\n]+)\]\([^)\n]+\)/g, '$1')
    .replace(/[\s#>*_|:`~-]/g, '')
}

function assertSupportedNonEmptyHeadings(markdown, stage) {
  const headings = [...markdown.matchAll(/^(#{2,6})(?:[ \t]+(.*?))?[ \t]*$/gm)].map((match) => ({
    match, level: match[1].length, title: String(match[2] ?? '').trim(), index: match.index ?? 0,
  }))
  const unsupported = headings.find((heading) => heading.level > 3)
  if (unsupported) fail(`${stage} article supports only H2 and H3 headings; found H${unsupported.level}${unsupported.title ? `: ${unsupported.title}` : ''}`)
  for (const [index, heading] of headings.entries()) {
    if (!heading.title) fail(`${stage} article has an empty H${heading.level} heading`)
    const next = headings.slice(index + 1).find((candidate) => candidate.level <= heading.level)
    const start = heading.index + heading.match[0].length
    const rawSection = markdown.slice(start, next?.index ?? markdown.length).trim()
    if (heading.level === 2 && heading.title === 'Quellen' && rawSection === AUTO_SOURCES_MARKER) continue
    const withoutNestedHeadings = rawSection.replace(/^#{2,6}(?:[ \t]+.*?)?[ \t]*$/gm, '')
    if (!visibleSectionContent(withoutNestedHeadings)) fail(`${stage} article has an empty H${heading.level} section: ${heading.title}`)
  }
  return headings
}

function assertSingleLead(markdown, h1, firstH2, stage) {
  const lead = markdown.slice(h1[0].length, firstH2.index ?? -1).trim()
  if (!lead || /\n[ \t]*\n/.test(lead) || /^(?:#{1,6}\s|[-*+]\s|>\s)/m.test(lead)) {
    fail(`${stage} article needs exactly one lead paragraph between H1 and the first H2`)
  }
  return lead
}

function stage2Metadata(markdown, metadataHeading, articleHeading) {
  const start = (metadataHeading.index ?? -1) + metadataHeading[0].length
  const end = articleHeading.index ?? -1
  const block = markdown.slice(start, end).trim()
  if (!block) fail('Stage-2 authoring metadata is empty')
  const entries = [...block.matchAll(/^- ([a-zA-Z0-9_]+): (.+)$/gm)]
  const metadata = {}
  for (const match of entries) {
    const key = match[1]
    if (Object.hasOwn(metadata, key)) fail(`Stage-2 authoring metadata contains duplicate ${key}`)
    metadata[key] = match[2].trim()
  }
  return metadata
}

function splitStage2ArticleBody(articleBody) {
  const sourceHeading = oneHeading(articleBody, /^### (?:Quellen|Originalquelle)\s*$/gm, 'Stage-2 Quellen or Originalquelle')
  const sourceIndex = sourceHeading.index ?? -1
  const withoutSources = articleBody.slice(0, sourceIndex).trim()
  const sourceSection = articleBody.slice(sourceIndex + sourceHeading[0].length).trim()
  if (!sourceSection) fail('Stage-2 article has an empty source section')

  const summaryBoundary = withoutSources.search(/\n\s*\n/)
  if (summaryBoundary < 0 || withoutSources.startsWith('#')) fail('Stage-2 article needs a distinct lead paragraph before its body sections')
  const summary = withoutSources.slice(0, summaryBoundary).trim()
  const afterSummary = withoutSources.slice(summaryBoundary).trim()
  const headings = [...afterSummary.matchAll(/^### .+$/gm)]
  if (!headings.length) fail('Stage-2 article needs a distinct conclusion section')
  const conclusionHeading = headings.at(-1)
  const conclusionIndex = conclusionHeading.index ?? -1
  const conclusion = afterSummary.slice(conclusionIndex + conclusionHeading[0].length).trim()
  const body = afterSummary.slice(0, conclusionIndex).trim()
  if (!summary) fail('Stage-2 article has an empty summary')
  if (!body) fail('Stage-2 article has no body after separating summary and conclusion')
  if (!conclusion) fail('Stage-2 article has an empty conclusion')
  return { summary, body, conclusion }
}

export function assembleStage2LegacyVisiblePayload({ slug, markdown, visibleSources }) {
  const authoring = normalizeAuthoringMarkdown(markdown)
  const h1 = oneHeading(authoring, /^# (.+)$/gm, 'leading H1')
  if (h1.index !== 0) fail('Stage-2 article H1 must be the first visible line')
  const metadataHeading = oneHeading(authoring, /^## Kernfelder \(Metadaten\)\s*$/gm, 'Stage-2 Kernfelder (Metadaten)')
  const articleHeading = oneHeading(authoring, /^## Artikel\s*$/gm, 'Stage-2 Artikel')
  const statusHeading = oneHeading(authoring, /^## Abschlussstatus\s*$/gm, 'Stage-2 Abschlussstatus')
  const h1Index = h1.index ?? -1
  const metadataIndex = metadataHeading.index ?? -1
  const articleIndex = articleHeading.index ?? -1
  const statusIndex = statusHeading.index ?? -1
  if (!(h1Index < metadataIndex && metadataIndex < articleIndex && articleIndex < statusIndex)) {
    fail('Stage-2 authoring sections must be ordered as H1, metadata, article, Abschlussstatus')
  }
  assertSupportedNonEmptyHeadings(authoring, 'Stage-2')
  const status = authoring.slice(statusIndex + statusHeading[0].length).trim()
  if (!status) fail('Stage-2 Abschlussstatus section is empty')
  const metadata = stage2Metadata(authoring, metadataHeading, articleHeading)
  const title = String(metadata.titel_artikel ?? '').trim()
  if (!title) fail('Stage-2 authoring metadata needs titel_artikel')
  const articleBody = authoring.slice(articleIndex + articleHeading[0].length, statusIndex).trim()
  if (!articleBody) fail('Stage-2 Artikel section is empty')
  return {
    slug: String(slug ?? '').trim(),
    title,
    ...splitStage2ArticleBody(articleBody),
    sources: normalizeVisibleSources(visibleSources, 'Stage-2'),
  }
}

export function assembleStage2VisiblePayload({ slug, markdown, visibleSources }) {
  assertRawLeadingH1(markdown, 'Stage-2')
  const authoring = normalizeAuthoringMarkdown(markdown)
  const sources = normalizeVisibleSources(visibleSources, 'Stage-2')
  const h1 = oneHeading(authoring, /^#[ \t]+(.+?)[ \t]*$/gm, 'leading H1')
  if (h1.index !== 0) fail('Stage-2 article H1 must be the first visible line')
  const title = h1[1].trim()
  if (!title) fail('Stage-2 article has an empty H1 title')

  const headings = [...authoring.matchAll(/^##[ \t]+(.+?)[ \t]*$/gm)]
  if (!headings.length) fail('Stage-2 article needs adaptive H2 sections, Fazit and Quellen')
  const firstH2 = headings[0]
  const summary = assertSingleLead(authoring, h1, firstH2, 'Stage-2')
  const conclusionHeading = oneHeading(authoring, /^## Fazit[ \t]*$/gm, 'Stage-2 Fazit')
  const sourceHeading = oneHeading(authoring, /^## Quellen[ \t]*$/gm, 'Stage-2 Quellen')
  const conclusionIndex = conclusionHeading.index ?? -1
  const sourceIndex = sourceHeading.index ?? -1
  const conclusionPosition = headings.findIndex((heading) => heading.index === conclusionIndex)
  const sourcePosition = headings.findIndex((heading) => heading.index === sourceIndex)
  if (conclusionPosition < 1 || sourcePosition !== headings.length - 1 || sourcePosition !== conclusionPosition + 1) {
    fail('Stage-2 sections must be ordered as lead, one or more adaptive H2 sections, Fazit, Quellen')
  }
  const technicalHeadings = new Set(['Kernfelder (Metadaten)', 'Artikel', 'Abschlussstatus'])
  for (const heading of headings) {
    if (technicalHeadings.has(heading[1].trim())) fail(`Stage-2 v2 markdown contains legacy technical heading: ${heading[1].trim()}`)
  }
  assertSupportedNonEmptyHeadings(authoring, 'Stage-2')

  if (exactLineCount(authoring, AUTO_SOURCES_MARKER) !== 1 || exactTokenCount(authoring, AUTO_SOURCES_MARKER) !== 1) {
    fail('Stage-2 article needs <!-- sources:auto --> exactly once')
  }
  const sourceSection = authoring.slice(sourceIndex + sourceHeading[0].length).trim()
  if (sourceSection !== AUTO_SOURCES_MARKER) {
    fail('Stage-2 Quellen must contain only <!-- sources:auto -->; visible sources are generated from approved relations')
  }
  for (let index = 0; index <= conclusionPosition; index += 1) {
    const heading = headings[index]
    const next = headings[index + 1]
    const section = authoring.slice((heading.index ?? 0) + heading[0].length, next?.index ?? authoring.length).trim()
    if (!visibleSectionContent(section)) fail(`Stage-2 article has an empty H2 section: ${heading[1].trim()}`)
  }
  for (const source of sources) {
    if (authoring.includes(source.url)) fail(`Stage-2 authoring duplicates generated source URL ${source.source_id}`)
  }

  const body = authoring.slice(firstH2.index ?? -1, sourceIndex).trim()
  const conclusion = authoring.slice(conclusionIndex + conclusionHeading[0].length, sourceIndex).trim()
  return { slug: String(slug ?? '').trim(), title, summary, body, conclusion, sources }
}

function exactLineCount(markdown, line) {
  return [...markdown.matchAll(new RegExp(`^${line.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*$`, 'gm'))].length
}

function exactTokenCount(markdown, token) {
  return markdown.split(token).length - 1
}

function assertLocalImageTarget(rawTarget) {
  const target = String(rawTarget ?? '').trim()
  const closingAngle = target.startsWith('<') ? target.indexOf('>') : -1
  const path = closingAngle > 1 ? target.slice(1, closingAngle) : target.startsWith('<') ? '' : target.split(/[ \t]/, 1)[0]
  if (!path || /^[a-z][a-z0-9+.-]*:|^\/\//i.test(path)) fail('Stage-3 magazine images need a verifiable local asset path')
}

function assertMagazineImagesHaveAltText(markdown) {
  for (const match of markdown.matchAll(/!\[([^\]\n]*)\]\(([^)\n]*)\)/g)) {
    if (!match[1].trim()) fail('Stage-3 magazine images need non-empty alt text')
    assertLocalImageTarget(match[2])
  }
  const definitions = new Map([...markdown.matchAll(/^\[([^\]\n]+)\]:[ \t]+(?:<([^>\n]+)>|(\S+))/gm)]
    .map((match) => [match[1].trim().toLowerCase(), match[2] ?? match[3]]))
  for (const match of markdown.matchAll(/!\[([^\]\n]*)\]\[([^\]\n]*)\]/g)) {
    const alt = match[1].trim()
    if (!alt) fail('Stage-3 magazine images need non-empty alt text')
    const reference = (match[2].trim() || alt).toLowerCase()
    if (!definitions.has(reference)) fail('Stage-3 magazine images need a verifiable local asset path')
    assertLocalImageTarget(definitions.get(reference))
  }
  for (const match of markdown.matchAll(/<img\b[^>]*>/gi)) {
    const alt = match[0].match(/\balt=["']([^"']*)["']/i)
    if (!alt?.[1]?.trim()) fail('Stage-3 magazine images need non-empty alt text')
    const src = match[0].match(/\bsrc=["']([^"']+)["']/i)
    assertLocalImageTarget(src?.[1])
  }
}

function splitStage3VisibleBody(markdown) {
  const h1 = oneHeading(markdown, /^#[ \t]+(.+?)[ \t]*$/gm, 'leading H1')
  if (h1.index !== 0) fail('Stage-3 article H1 must be the first visible line')
  const title = h1[1].trim()
  if (!title) fail('Stage-3 article has an empty H1 title')

  if (exactLineCount(markdown, MAGAZINE_TEMPLATE_MARKER) !== 1 || exactTokenCount(markdown, MAGAZINE_TEMPLATE_MARKER) !== 1) fail('Stage-3 article needs the magazine template marker exactly once')
  if (exactLineCount(markdown, AUTO_SOURCES_MARKER) !== 1 || exactTokenCount(markdown, AUTO_SOURCES_MARKER) !== 1) fail('Stage-3 article needs <!-- sources:auto --> exactly once')
  const markerIndex = markdown.indexOf(MAGAZINE_TEMPLATE_MARKER)
  const summary = markdown.slice(h1[0].length, markerIndex).trim()
  if (!summary || /\n\s*\n/.test(summary) || /^#/m.test(summary) || /^[-*+]\s/m.test(summary)) {
    fail('Stage-3 article needs exactly one Summary/Dek paragraph between H1 and magazine marker')
  }
  const body = markdown.slice(markerIndex).trim()
  const afterMarker = body.slice(MAGAZINE_TEMPLATE_MARKER.length).trim()
  if (!afterMarker || afterMarker.startsWith(MAGAZINE_TEMPLATE_MARKER)) fail('Stage-3 article has no body after the magazine marker')

  const overviewHeading = oneHeading(afterMarker, /^## Auf einen Blick\s*$/gm, 'Stage-3 Auf einen Blick')
  const conclusionHeading = oneHeading(afterMarker, /^## Fazit\s*$/gm, 'Stage-3 Fazit')
  const sourceHeading = oneHeading(afterMarker, /^## Quellen\s*$/gm, 'Stage-3 Quellen')
  const headings = [...afterMarker.matchAll(/^##\s+(.+?)\s*$/gm)]
  const overviewIndex = overviewHeading.index ?? -1
  const conclusionIndex = conclusionHeading.index ?? -1
  const sourceIndex = sourceHeading.index ?? -1
  if (overviewIndex !== 0 || headings[0]?.[1].trim() !== 'Auf einen Blick' || conclusionIndex <= overviewIndex || sourceIndex <= conclusionIndex || headings.at(-1)?.[1].trim() !== 'Quellen') {
    fail('Stage-3 magazine sections must be ordered as Auf einen Blick, adaptive body, Fazit, Quellen')
  }
  assertSupportedNonEmptyHeadings(afterMarker, 'Stage-3')

  const conclusion = afterMarker.slice(conclusionIndex + conclusionHeading[0].length, sourceIndex).trim()
  const sourceSection = afterMarker.slice(sourceIndex + sourceHeading[0].length).trim()
  if (!conclusion) fail('Stage-3 article has an empty Fazit section')
  if (sourceSection !== AUTO_SOURCES_MARKER) fail('Stage-3 Quellen must contain only <!-- sources:auto -->; visible sources are generated from approved relations')

  for (let index = 0; index < headings.length; index += 1) {
    const heading = headings[index]
    const start = (heading.index ?? 0) + heading[0].length
    const end = index + 1 < headings.length ? (headings[index + 1].index ?? afterMarker.length) : afterMarker.length
    const rawSection = afterMarker.slice(start, end).trim()
    const visibleSection = visibleSectionContent(rawSection)
    if (heading[1].trim() !== 'Quellen' && !visibleSection) fail(`Stage-3 article has an empty H2 section: ${heading[1].trim()}`)
  }
  const overviewEnd = headings.find((heading) => (heading.index ?? -1) > overviewIndex)?.index ?? afterMarker.length
  const overview = afterMarker.slice(overviewIndex + overviewHeading[0].length, overviewEnd).trim()
  const overviewLines = overview.split('\n').filter((line) => line.trim())
  if (overviewLines.some((line) => !/^[-*+][ \t]+\S.*$/.test(line) || !visibleSectionContent(line.replace(/^[-*+][ \t]+/, '')))) {
    fail('Stage-3 Auf einen Blick may contain only standalone bullet lines')
  }
  if (overviewLines.length < 3 || overviewLines.length > 6) {
    fail('Stage-3 Auf einen Blick needs exactly 3 to 6 bullet points')
  }
  if (/\b(?:Grafik|Diagramm|Abbildung|Bild)[- ]?(?:Briefing|Placeholder)\b|\b(?:TODO|PLACEHOLDER)\b|\[(?:Grafik|Diagramm|Abbildung|Bild)[^\]]*\]/iu.test(markdown)) {
    fail('Stage-3 magazine article contains a graphic briefing or placeholder')
  }
  assertMagazineImagesHaveAltText(markdown)
  return { title, summary, body, conclusion }
}

export function assembleStage3VisiblePayload({ slug, markdown, visibleSources }) {
  assertRawLeadingH1(markdown, 'Stage-3')
  const authoring = normalizeAuthoringMarkdown(markdown)
  const sources = normalizeVisibleSources(visibleSources, 'Stage-3')
  for (const source of sources) if (authoring.includes(source.url)) fail(`Stage-3 authoring duplicates generated source URL ${source.source_id}`)
  return {
    slug: String(slug ?? '').trim(),
    ...splitStage3VisibleBody(authoring),
    sources,
  }
}

export function assertVisibleFieldMatches(actual, expected, label) {
  if (actual == null) return
  if (String(actual).trim() !== expected) fail(`${label} does not match the canonical authoring payload`)
}
