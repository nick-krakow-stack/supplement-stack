import { PUBLIC_SITEMAP_PATHS, SITE_ORIGIN, normalizeIsoTimestamp } from './route-head-contract.mjs'
import { isCreatorProfileSlug } from './site-routes.mjs'

const SEARCH_CRAWLERS = ['Googlebot', 'Googlebot-Image', 'Bingbot', 'DuckDuckBot', 'YandexBot', 'Baiduspider', 'Slurp']
const validSlug = (slug) => typeof slug === 'string' && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)
const escapeXml = (value) => value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;')

export function buildRobotsTxt() {
  // Utility routes must be crawlable for their noindex headers to be seen.
  // Access control and response cache policies, not robots.txt, protect private data.
  const agents = [...SEARCH_CRAWLERS.map((agent) => `User-agent: ${agent}`), 'User-agent: *'].join('\n')
  return `# Public crawling; indexing and access are controlled on each response.\n${agents}\nAllow: /\n\nSitemap: ${SITE_ORIGIN}/sitemap.xml\n`
}

export function buildSitemapXml(lastModifiedBySlug, publishedCreators = []) {
  const urls = PUBLIC_SITEMAP_PATHS.map((path) => `<url><loc>${SITE_ORIGIN}${path}</loc></url>`)
  for (const [slug, modified] of [...lastModifiedBySlug.entries()].filter(([slug]) => validSlug(slug)).sort(([a], [b]) => a.localeCompare(b))) {
    const date = normalizeIsoTimestamp(modified)
    urls.push(`<url><loc>${escapeXml(`${SITE_ORIGIN}/wissen/${slug}`)}</loc>${date ? `<lastmod>${date}</lastmod>` : ''}</url>`)
  }
  for (const creator of [...publishedCreators].filter((row) => isCreatorProfileSlug(row.slug)).sort((a, b) => a.slug.localeCompare(b.slug))) {
    const date = normalizeIsoTimestamp(creator.published_at)
    urls.push(`<url><loc>${escapeXml(`${SITE_ORIGIN}/creator/${creator.slug}`)}</loc>${date ? `<lastmod>${date}</lastmod>` : ''}</url>`)
  }
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join('\n')}\n</urlset>\n`
}
