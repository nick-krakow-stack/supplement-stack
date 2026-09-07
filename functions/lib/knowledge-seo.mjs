import { knowledgeInlineMarkdownToText, normalizeKnowledgeInlineLink } from './knowledge-inline-markdown.mjs'
import { parseKnowledgeMarkdown } from './knowledge-markdown-blocks.mjs'
import { DEFAULT_SOCIAL_IMAGE, normalizeIsoTimestamp, resolveRouteHead, SITE_ORIGIN } from './route-head-contract.mjs'

export function knowledgeMetadataText(value) {
  return knowledgeInlineMarkdownToText(String(value ?? '')).normalize('NFC').replace(/\s+/g, ' ').trim()
}

export function knowledgeSeoTimestamps(article) {
  const publishedAt = normalizeIsoTimestamp(article.published_at)
    ?? normalizeIsoTimestamp(article.created_at)
    ?? normalizeIsoTimestamp(article.reviewed_at)
  if (!publishedAt) return { publishedAt: null, modifiedAt: null }
  const candidates = [publishedAt, article.modified_at, article.updated_at, article.reviewed_at]
    .map(normalizeIsoTimestamp).filter(Boolean).sort()
  return { publishedAt, modifiedAt: candidates.at(-1) ?? publishedAt }
}

export function knowledgeArticleImage(article) {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(article.slug)) return null
  const expectedPath = new RegExp(`^/api/r2/knowledge/${article.slug}/[a-f0-9]{64}\\.(?:png|jpg)$`)
  for (const block of parseKnowledgeMarkdown(article.body ?? '')) {
    if (block.type !== 'image') continue
    if (block.src !== block.src.trim() || /[\\\u0000-\u0020\u007f]/.test(block.src) || block.src.startsWith('//')) continue
    try {
      const url = new URL(block.src, SITE_ORIGIN)
      if (url.origin === SITE_ORIGIN && !url.username && !url.password && expectedPath.test(url.pathname) && !url.search && !url.hash) return url.href
    } catch { /* Malformed or unbound image paths are not social images. */ }
  }
  return null
}

function articleCore(article, canonicalUrl) {
  const stored = article.seo?.json_ld
  if (stored) {
    // The release-bound Article remains its own exact node. Delivery relations
    // belong to the WebPage it identifies via mainEntityOfPage.
    return {
      ...stored,
      ...(typeof stored.headline === 'string' ? { headline: knowledgeMetadataText(stored.headline) } : {}),
      ...(typeof stored.description === 'string' ? { description: knowledgeMetadataText(stored.description) } : {}),
    }
  }
  const { publishedAt, modifiedAt } = knowledgeSeoTimestamps(article)
  const organization = { '@type': 'Organization', '@id': `${SITE_ORIGIN}/#organization`, name: 'Supplement Stack', url: `${SITE_ORIGIN}/` }
  const image = knowledgeArticleImage(article)
  return {
    '@context': 'https://schema.org', '@type': 'Article',
    headline: knowledgeMetadataText(article.title), description: knowledgeMetadataText(article.summary),
    mainEntityOfPage: canonicalUrl, inLanguage: 'de',
    ...(publishedAt ? { datePublished: publishedAt } : {}),
    ...(modifiedAt ? { dateModified: modifiedAt } : {}),
    author: organization, publisher: organization,
    ...(image ? { image } : {}),
  }
}

export function knowledgeArticleJsonLd(article) {
  const canonicalUrl = `${SITE_ORIGIN}/wissen/${article.slug}`
  const ingredientNames = [...new Set((article.ingredients ?? []).map((ingredient) => knowledgeMetadataText(ingredient.name)).filter(Boolean))]
  const citations = []
  const seenUrls = new Set()
  for (const source of article.sources ?? []) {
    const link = normalizeKnowledgeInlineLink(source.url)
    const label = knowledgeMetadataText(source.label)
    if (!link || !label) continue
    const url = new URL(link.href, SITE_ORIGIN)
    if (!['http:', 'https:'].includes(url.protocol) || seenUrls.has(url.href)) continue
    seenUrls.add(url.href)
    citations.push({ '@type': 'CreativeWork', name: label, url: url.href })
  }
  const mainArticles = article.article_layer === 'single_study'
    ? (article.related_articles ?? []).filter((related) => related.article_layer === 'main_article' && related.slug !== article.slug && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(related.slug))
    : []
  const page = {
    '@type': 'WebPage', '@id': canonicalUrl, url: canonicalUrl,
    name: knowledgeMetadataText(article.title), inLanguage: 'de',
    isPartOf: [
      { '@type': 'CollectionPage', '@id': `${SITE_ORIGIN}/wissen`, name: 'Wissen' },
    ],
    // These articles share an ingredient; that does not prove citation or containment.
    ...(mainArticles.length ? { relatedLink: [...new Set(mainArticles.map((related) => `${SITE_ORIGIN}/wissen/${related.slug}`))] } : {}),
    ...(ingredientNames.length ? { about: ingredientNames.map((name) => ({ '@type': 'Thing', name })) } : {}),
    ...(citations.length ? { citation: citations } : {}),
    breadcrumb: { '@id': `${canonicalUrl}#breadcrumb` },
    primaryImageOfPage: { '@type': 'ImageObject', url: knowledgeArticleImage(article) ?? DEFAULT_SOCIAL_IMAGE },
  }
  const breadcrumb = {
    '@type': 'BreadcrumbList', '@id': `${canonicalUrl}#breadcrumb`,
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Startseite', item: `${SITE_ORIGIN}/` },
      { '@type': 'ListItem', position: 2, name: 'Wissen', item: `${SITE_ORIGIN}/wissen` },
      { '@type': 'ListItem', position: 3, name: knowledgeMetadataText(article.title), item: canonicalUrl },
    ],
  }
  return { '@context': 'https://schema.org', '@graph': [articleCore(article, canonicalUrl), page, breadcrumb] }
}

export function knowledgeArticleHead(article) {
  return resolveRouteHead({
    pathname: `/wissen/${article.slug}`, status: 200,
    title: knowledgeMetadataText(article.seo?.meta_title ?? article.title),
    description: knowledgeMetadataText(article.seo?.meta_description ?? article.summary),
    jsonLd: knowledgeArticleJsonLd(article), image: knowledgeArticleImage(article) ?? undefined,
  })
}
