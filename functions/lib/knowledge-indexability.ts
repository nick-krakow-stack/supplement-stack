import type { PublicKnowledgeArticle } from '../api/modules/knowledge'
import { isKnowledgeControlMarkerLine, knowledgeInlineMarkdownToText } from './knowledge-inline-markdown.mjs'

export const SITE_ORIGIN = 'https://supplementstack.de'
const SEARCH_CRAWLERS = Object.freeze([
  'Googlebot',
  'Googlebot-Image',
  'Bingbot',
  'DuckDuckBot',
  'YandexBot',
  'Baiduspider',
  'Slurp',
])

export function isValidKnowledgeSlug(slug: string): boolean {
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)
}

export function knowledgeCanonicalUrl(slug: string): string {
  if (!isValidKnowledgeSlug(slug)) throw new Error('Knowledge slug is invalid.')
  return `${SITE_ORIGIN}/wissen/${slug}`
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function serializeBootstrapJson(value: unknown): string {
  const escapedCharacters: Record<string, string> = {
    '<': '\\u003c',
    '>': '\\u003e',
    '&': '\\u0026',
    '\u2028': '\\u2028',
    '\u2029': '\\u2029',
  }
  return JSON.stringify(value).replace(/[<>&\u2028\u2029]/g, (character) => escapedCharacters[character])
}

function inlineMarkdownToText(value: string): string {
  return knowledgeInlineMarkdownToText(value)
}

function inlineMetadataText(value: string): string {
  return knowledgeInlineMarkdownToText(value).replace(/\s+/g, ' ').trim()
}

export function markdownToPrerenderText(markdown: string): string {
  const lines = markdown.split(/\r?\n/)
  const tableLines = new Set<number>()
  const captionLines = new Set<number>()
  const tableCells = (line: string): string[] | null => {
    const trimmed = line.trim()
    if (!trimmed.includes('|')) return null
    const cells = trimmed.replace(/^\|/, '').replace(/\|$/, '').split('|').map((cell) => cell.trim())
    return cells.length > 1 ? cells : null
  }
  const isSeparator = (line: string): boolean => Boolean(tableCells(line)?.every((cell) => /^:?-{3,}:?$/.test(cell)))
  for (let index = 0; index + 1 < lines.length; index += 1) {
    if (!tableCells(lines[index]) || !isSeparator(lines[index + 1])) continue
    tableLines.add(index)
    tableLines.add(index + 1)
    for (let row = index + 2; row < lines.length && tableCells(lines[row]) && !isSeparator(lines[row]); row += 1) tableLines.add(row)
  }
  for (let index = 0; index < lines.length; index += 1) {
    if (!/^!\[([^\]\n]*)\]\([^)]*\)\s*$/.test(lines[index].trim())) continue
    let captionIndex = index + 1
    while (captionIndex < lines.length && !lines[captionIndex].trim()) captionIndex += 1
    if (/^(?:\*([^*\n]+)\*|_([^_\n]+)_)$/.test(lines[captionIndex]?.trim() ?? '')) captionLines.add(captionIndex)
  }

  return lines
    .map((line, index) => {
      if (isKnowledgeControlMarkerLine(line)) return ''
      if (/^\s*\|?\s*:?-{3,}:?\s*(?:\|\s*:?-{3,}:?\s*)+\|?\s*$/.test(line)) return ''
      let withoutBlockSyntax = line
        .replace(/^\s{0,3}#{1,6}\s+/, '')
        .replace(/^\s*>\s?/, '')
        .replace(/^\s*(?:[-+*]|\d+[.)])\s+/, '')
      const image = withoutBlockSyntax.trim().match(/^!\[([^\]\n]*)\]\([^)]*\)\s*$/)
      if (image) withoutBlockSyntax = image[1]
      const caption = captionLines.has(index)
        ? withoutBlockSyntax.trim().match(/^(?:\*([^*\n]+)\*|_([^_\n]+)_)$/)
        : null
      if (caption) withoutBlockSyntax = caption[1] ?? caption[2]
      if (tableLines.has(index)) {
        withoutBlockSyntax = withoutBlockSyntax
          .replace(/^\s*\|/, '')
          .replace(/\|\s*$/, '')
          .replace(/\s*\|\s*/g, ' ')
      }
      return inlineMarkdownToText(withoutBlockSyntax).trim()
    })
    .filter((line, index, lines) => line || (index > 0 && lines[index - 1]))
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

export function articleJsonLd(article: PublicKnowledgeArticle, canonicalUrl: string): Record<string, unknown> {
  const storedJsonLd = article.seo?.json_ld
  if (storedJsonLd) {
    return {
      ...storedJsonLd,
      ...(typeof storedJsonLd.headline === 'string'
        ? { headline: inlineMetadataText(storedJsonLd.headline) }
        : {}),
      ...(typeof storedJsonLd.description === 'string'
        ? { description: inlineMetadataText(storedJsonLd.description) }
        : {}),
    }
  }

  return {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: inlineMetadataText(article.title),
    description: inlineMetadataText(article.summary),
    mainEntityOfPage: canonicalUrl,
    inLanguage: 'de',
    datePublished: article.published_at,
    dateModified: article.modified_at,
    author: {
      '@type': 'Organization',
      '@id': `${SITE_ORIGIN}/#organization`,
      name: 'Supplement Stack',
      url: `${SITE_ORIGIN}/`,
    },
    publisher: {
      '@type': 'Organization',
      '@id': `${SITE_ORIGIN}/#organization`,
      name: 'Supplement Stack',
      url: `${SITE_ORIGIN}/`,
    },
  }
}

export function renderKnowledgeArticleHtml(
  shellHtml: string,
  article: PublicKnowledgeArticle,
  canonicalUrl: string,
): string {
  const metaTitle = inlineMetadataText(article.seo?.meta_title ?? article.title)
  const metaDescription = inlineMetadataText(article.seo?.meta_description ?? article.summary)
  const robots = article.seo?.robots ?? 'index,follow'
  const jsonLd = JSON.stringify(articleJsonLd(article, canonicalUrl)).replace(/</g, '\\u003c')
  const articleBootstrap = serializeBootstrapJson({ article })
  const sourceItems = article.sources
    .map((source) => `        <li><a href="${escapeHtml(source.url)}">${escapeHtml(source.label)}</a></li>`)
    .join('\n')
  const prerenderedArticle = `
    <main class="knowledge-prerender" data-knowledge-prerender="${escapeHtml(article.slug)}">
      <article>
        <h1>${escapeHtml(inlineMetadataText(article.title))}</h1>
        <p>${escapeHtml(inlineMetadataText(article.summary))}</p>
        <div style="white-space: pre-wrap">${escapeHtml(markdownToPrerenderText(article.body))}</div>
        <section aria-labelledby="prerender-sources">
          <h2 id="prerender-sources">Quellen</h2>
          <ol>
${sourceItems}
          </ol>
        </section>
      </article>
    </main>`
  const head = [
    `    <meta name="description" content="${escapeHtml(metaDescription)}" />`,
    `    <meta name="robots" content="${escapeHtml(robots)}" />`,
    `    <link rel="canonical" href="${escapeHtml(canonicalUrl)}" />`,
    `    <meta property="og:title" content="${escapeHtml(metaTitle)}" />`,
    `    <meta property="og:description" content="${escapeHtml(metaDescription)}" />`,
    `    <meta property="og:url" content="${escapeHtml(canonicalUrl)}" />`,
    '    <meta property="og:type" content="article" />',
    `    <script type="application/ld+json">${jsonLd}</script>`,
    `    <script>window.__knowledgeArticleBootstrap=${articleBootstrap};</script>`,
  ].join('\n')

  return shellHtml
    .replace(/<title>[\s\S]*?<\/title>/i, `<title>${escapeHtml(metaTitle)}</title>`)
    .replace('</head>', `${head}\n  </head>`)
    .replace(/<div\s+id=["']root["']\s*><\/div>/i, `<div id="root">${prerenderedArticle}\n  </div>`)
}

export function buildRobotsTxt(slugs: readonly string[]): string {
  const releasedSlugs = [...new Set(slugs)].filter(isValidKnowledgeSlug).sort()
  const rules = releasedSlugs
    .map((slug) => `Allow: /wissen/${slug}$`)
    .join('\n')
  const agents = [...SEARCH_CRAWLERS, '*'].map((crawler) => `User-agent: ${crawler}`).join('\n')
  return `# Published knowledge indexability; Cloudflare may prepend a wildcard AI-bot group.\n${agents}\nDisallow: /\n${rules}\n\nSitemap: ${SITE_ORIGIN}/sitemap.xml\n`
}

export function buildSitemapXml(lastModifiedBySlug: ReadonlyMap<string, string> = new Map()): string {
  const urls = [...lastModifiedBySlug.keys()].filter(isValidKnowledgeSlug).sort().map((slug) => {
    const modified = lastModifiedBySlug.get(slug)
    return [
      '  <url>',
      `    <loc>${knowledgeCanonicalUrl(slug)}</loc>`,
      ...(modified ? [`    <lastmod>${escapeHtml(modified)}</lastmod>`] : []),
      '  </url>',
    ].join('\n')
  }).join('\n')
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`
}
