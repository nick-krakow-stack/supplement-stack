// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { applyRouteHeadHtml, buildKnowledgeOverviewJsonLd, canonicalRouteRedirect, normalizeIsoTimestamp, PUBLIC_SITEMAP_PATHS, resolveRouteHead } from '../../../functions/lib/route-head-contract.mjs';
import { buildRobotsTxt, buildSitemapXml } from '../../../functions/lib/site-crawl.mjs';
import { applyPublicRouteHead } from './publicPageHead';

describe('shared route-head and crawler contract', () => {
  it.each(PUBLIC_SITEMAP_PATHS)('publishes a unique canonical and social image for %s', (pathname) => {
    const head = resolveRouteHead({ pathname: `${pathname}?returnTo=SECRET` });
    expect(head.robots).toBe('index,follow');
    expect(head.canonicalUrl).toBe(`https://supplementstack.de${pathname}`);
    const html = applyRouteHeadHtml('<html><head><title>Old</title><meta name="description" content="Old"><meta property="og:url" content="SECRET"><script type="application/ld+json">{}</script></head><body></body></html>', head);
    expect(html).not.toContain('SECRET');
    expect(html.match(/<title>/g)).toHaveLength(1);
    expect(html.match(/name="description"/g)).toHaveLength(1);
    expect(html).toContain('name="twitter:image"');
  });

  it.each(['/share/SECRET', '/reset-password?token=SECRET', '/verify-email?token=SECRET', '/stacks', '/creator', '/profile', '/administrator/knowledge', '/unknown/SECRET'])('keeps %s private without token metadata', (pathname) => {
    const head = resolveRouteHead({ pathname });
    expect(head.robots).toBe('noindex,nofollow');
    expect(head.canonicalUrl).toBeNull();
    expect(head.referrerPolicy).toBe('no-referrer');
    expect(head.cacheControl).toBe('private, no-store');
    expect(head.jsonLd).toBeNull();
    expect(applyRouteHeadHtml('<head></head>', head)).not.toContain('SECRET');
  });

  it.each(['/login', '/register', '/forgot-password', '/impressum', '/datenschutz', '/nutzungsbedingungen'])('allows crawling but not indexing of %s', (pathname) => {
    expect(resolveRouteHead({ pathname }).robots).toBe('noindex,follow');
    expect(PUBLIC_SITEMAP_PATHS).not.toContain(pathname);
  });

  it('clears all stale article metadata on client navigation, with one graph at most', () => {
    const article = resolveRouteHead({ pathname: '/wissen/vitamin-c', title: 'Vitamin C', jsonLd: { '@type': 'Article', headline: '</script> & Test' } });
    applyPublicRouteHead(article);
    applyPublicRouteHead(article);
    expect(document.head.querySelectorAll('script[type="application/ld+json"]')).toHaveLength(1);
    expect(document.getElementById('route-json-ld')?.textContent).not.toContain('</script>');
    applyPublicRouteHead(resolveRouteHead({ pathname: '/share/SECRET' }));
    expect(document.head.querySelectorAll('script[type="application/ld+json"], link[rel="canonical"], meta[property="og:url"]')).toHaveLength(0);
    expect(document.head.innerHTML).not.toContain('Vitamin C');
    expect(document.head.innerHTML).not.toContain('SECRET');
    expect(document.head.querySelectorAll('meta[name="robots"]')).toHaveLength(1);
  });

  it('never interprets dynamic titles as replacement syntax', () => {
    const html = applyRouteHeadHtml('<head></head>', resolveRouteHead({ pathname: '/share/example', title: "Titel $& $` $' $$" }));
    expect(html).toContain('Titel $&amp; $` $&#39; $$');
    expect(html.match(/<\/head>/g)).toHaveLength(1);
  });

  it('normalizes real dates without inventing missing dates or accepting calendar overflow', () => {
    expect(normalizeIsoTimestamp('2026-07-15 11:22:33')).toBe('2026-07-15T11:22:33.000Z');
    expect(normalizeIsoTimestamp('2026-07-15T13:22:33+02:00')).toBe('2026-07-15T11:22:33.000Z');
    expect(normalizeIsoTimestamp('2024-02-29')).toBe('2024-02-29T00:00:00.000Z');
    for (const invalid of [null, '', 'yesterday', '2026-02-29', '2026-13-01', '2026-01-00', '2026-01-01T24:00:00Z']) expect(normalizeIsoTimestamp(invalid)).toBeNull();
  });

  it('redirects known aliases permanently to a fixed origin while preserving functional deep links', () => {
    expect(canonicalRouteRedirect('https://evil.example/agb/?token=SECRET')).toBe('https://supplementstack.de/nutzungsbedingungen');
    expect(canonicalRouteRedirect('https://example.org/wissen/vitamin-c/')).toBe('https://supplementstack.de/wissen/vitamin-c');
    expect(canonicalRouteRedirect('https://example.org/stacks/?stack=12')).toBe('https://supplementstack.de/stacks?stack=12');
    expect(canonicalRouteRedirect('https://example.org/assets/missing/')).toBeNull();
  });

  it('emits canonical public sitemap entries, valid ISO dates and no utility URLs', () => {
    const sitemap = buildSitemapXml(new Map([['vitamin-c', '2026-07-15 11:22:33'], ['vitamin-d', 'invalid'], ['../SECRET', '2026-01-01']]));
    expect((sitemap.match(/<url>/g) ?? [])).toHaveLength(PUBLIC_SITEMAP_PATHS.length + 2);
    expect(sitemap).toContain('<lastmod>2026-07-15T11:22:33.000Z</lastmod>');
    expect((sitemap.match(/<lastmod>/g) ?? [])).toHaveLength(1);
    expect(sitemap).not.toMatch(/SECRET|\/login|\/share|\/impressum|\/stacks/);
    const robots = buildRobotsTxt();
    expect(robots).toContain('Allow: /');
    expect(robots).not.toContain('Disallow:');
  });

  it('uses the same complete, canonical overview graph regardless of filter state', () => {
    const graph = buildKnowledgeOverviewJsonLd([
      { slug: 'vitamin-c', title: 'Vitamin C', article_layer: 'main_article' },
      { slug: 'vitamin-c', title: 'Vitamin C', article_layer: 'main_article' },
      { slug: 'study-c', title: 'Studie', article_layer: 'single_study' },
    ]);
    const encoded = JSON.stringify(graph);
    expect(encoded).toContain('ItemList');
    expect(encoded).toContain('BreadcrumbList');
    expect(encoded.match(/\/wissen\/vitamin-c/g)).toHaveLength(1);
    expect(encoded).not.toContain('study-c');
  });
});
