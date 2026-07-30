import { createServer } from 'node:http';
import { gzipSync } from 'node:zlib';

import { JSDOM } from 'jsdom';
import { describe, expect, it } from 'vitest';

import type { PublicKnowledgeArticle } from '../../../functions/api/modules/knowledge';
import {
  articleJsonLd,
  buildRobotsTxt,
  buildSitemapXml,
  knowledgeCanonicalUrl,
  markdownToPrerenderText,
  renderKnowledgeArticleHtml,
} from '../../../functions/lib/knowledge-indexability';
import {
  buildKnowledgePrerenderResponse,
  onRequestGet,
} from '../../../functions/wissen/[slug]';
import { onRequestGet as onRobotsRequest } from '../../../functions/robots.txt';
import { onRequestGet as onSitemapRequest } from '../../../functions/sitemap.xml';
import { interpretRobotsTxt } from '../../validate-knowledge-magazine-style.mjs';
import {
  createProductionKnowledgeHonoHarness,
  createProductionKnowledgeSchema,
  seedProductionKnowledgeArticle,
} from './productionKnowledgeHonoTestHarness';

const article: PublicKnowledgeArticle = {
  slug: 'grapefruitkernextrakt',
  title: 'Grapefruitkernextrakt: Wirkung & Sicherheit',
  summary: 'Eine quellengebundene Einordnung.',
  body: '<!-- knowledge-template:magazine -->\n\n## Einordnung\n\nEin *klarer* [interner Link](/wissen/test) mit `p = 0,068`.\n\n- Erster Punkt\n- Zweiter Punkt\n\n## Quellen\n\n<!-- sources:auto -->',
  article_layer: 'main_article',
  reviewed_at: '2026-07-15',
  conclusion: null,
  featured_image_url: null,
  featured_image_r2_key: null,
  dose_min: null,
  dose_max: null,
  dose_unit: null,
  product_note: null,
  sources: [{ source_id: 'source-a', label: 'Institution (2026). Quelle.', url: 'https://example.com/?a=1&b=2' }],
  ingredients: [],
  ingredient_ids: [7],
  created_at: '2026-07-15T10:00:00.000Z',
  updated_at: '2026-07-15T11:00:00.000Z',
  published_at: '2026-07-15T10:00:00.000Z',
  modified_at: '2026-07-15T11:00:00.000Z',
  seo: {
    meta_title: 'Grapefruitkernextrakt: Evidenz und Sicherheit',
    meta_description: 'Technische SEO-Beschreibung auf Basis der freigegebenen Artikelprojektion.',
    canonical_url: 'https://supplementstack.de/wissen/grapefruitkernextrakt',
    canonical_path: '/wissen/grapefruitkernextrakt',
    robots: 'index,follow',
    indexable: true,
    json_ld: {
      '@context': 'https://schema.org',
      '@type': 'Article',
      headline: 'Grapefruitkernextrakt: Evidenz und Sicherheit',
      description: 'Technische SEO-Beschreibung auf Basis der freigegebenen Artikelprojektion.',
      mainEntityOfPage: 'https://supplementstack.de/wissen/grapefruitkernextrakt',
      inLanguage: 'de',
      datePublished: '2026-07-15T10:00:00.000Z',
      dateModified: '2026-07-15T11:00:00.000Z',
    },
  },
};

const newlyReleasedStage2Slugs = [
  'magnesium-aufnahme-bioverfuegbarkeit',
  'vitamin-b1-evidenzueberblick',
  'vitamin-b2-evidenzueberblick',
  'vitamin-b3-evidenzueberblick',
  'vitamin-b5-evidenzueberblick',
  'vitamin-b6-evidenz-versorgung-sicherheit',
  'vitamin-b7-evidenz-biotin-status-labortests',
  'vitamin-b9-evidenz-folat-versorgung-sicherheit',
  'vitamin-b12-evidenz-versorgung-risikogruppen',
  'vitamin-c-evidenzquellen',
  'vitamin-d-evidenzquellen',
  'vitamin-e-evidenzquellen',
  'vitamin-k-evidenzquellen',
] as const;

const releasedKnowledgeSlugs = [
  'grapefruitkernextrakt',
  'grapefruitkernextrakt-benzethonium-bfr',
  'grapefruitkerne-harnwegsinfektionen-studie',
  'ginseng',
  'ginseng-fatigue-kim-2013',
  'ginseng-vertraeglichkeit-song-2018',
  ...newlyReleasedStage2Slugs,
] as const;

describe('knowledge indexability delivery', () => {
  it('projects persisted technical SEO through the public detail API', async () => {
    const harness = createProductionKnowledgeHonoHarness();
    try {
      createProductionKnowledgeSchema(harness);
      harness.run("INSERT INTO ingredients (id, name, is_active) VALUES (7, 'Grapefruitkernextrakt', 1)");
      seedProductionKnowledgeArticle(harness, {
        slug: article.slug,
        ingredientId: 7,
        title: article.title,
        summary: article.summary,
        body: article.body,
        status: 'published',
        articleLayer: 'main_article',
        reviewedAt: article.reviewed_at,
        createdAt: article.created_at,
        updatedAt: article.updated_at,
        sources: article.sources.map(({ source_id = 'source-a', label, url }) => ({ source_id, label, url })),
        seo: article.seo,
      });
      const response = await harness.fetch(new Request(`https://example.test/api/knowledge/${article.slug}`));
      const payload = await response.json() as { article: PublicKnowledgeArticle };
      expect(response.status).toBe(200);
      expect(payload.article.title).toBe(article.title);
      expect(payload.article.seo).toEqual(article.seo);
    } finally {
      harness.close();
    }
  });

  it('renders source-backed raw HTML with exact SEO metadata and safe readable text', () => {
    const canonicalUrl = 'https://supplementstack.de/wissen/grapefruitkernextrakt';
    const html = renderKnowledgeArticleHtml(
      '<!doctype html><html lang="de"><head><title>Supplement Stack</title></head><body><div id="root"></div><script src="/assets/app.js"></script></body></html>',
      article,
      canonicalUrl,
    );
    const document = new JSDOM(html, { url: canonicalUrl }).window.document;

    expect(document.querySelector('h1')?.textContent).toBe(article.title);
    expect(document.title).toBe(article.seo?.meta_title);
    expect(document.querySelector('meta[name="description"]')?.getAttribute('content')).toBe(article.seo?.meta_description);
    expect(document.querySelector('meta[name="robots"]')?.getAttribute('content')).toBe('index,follow');
    expect(document.querySelector('link[rel="canonical"]')?.getAttribute('href')).toBe(canonicalUrl);
    expect(JSON.parse(document.querySelector('script[type="application/ld+json"]')?.textContent ?? '')).toEqual(articleJsonLd(article, canonicalUrl));
    expect(document.body.textContent).toContain('Ein *klarer* interner Link mit `p = 0,068`.');
    expect(document.body.textContent).toContain('Erster Punkt\nZweiter Punkt');
    expect(document.body.textContent).toContain(article.sources[0].label);
    expect(document.body.textContent).not.toContain('knowledge-template');
    expect(document.querySelector('a')?.getAttribute('href')).toBe(article.sources[0].url);
    expect(
      JSON.parse(
        document.querySelector('script:not([type])')?.textContent?.replace('window.__knowledgeArticleBootstrap=', '').replace(/;$/, '') ?? '',
      ),
    ).toEqual({ article });
  });

  it('derives robots and sitemap delivery from the published slug inventory', () => {
    expect(markdownToPrerenderText(article.body)).toContain('Ein *klarer* interner Link mit `p = 0,068`.');
    expect(markdownToPrerenderText('„Vitamin D | DGE Referenzwerte“ bleibt vollständig.')).toBe('„Vitamin D | DGE Referenzwerte“ bleibt vollständig.');
    expect(markdownToPrerenderText('| Wert | Einheit |\n| --- | --- |\n| 20 | µg |')).toBe('Wert Einheit\n\n20 µg');
    const robots = buildRobotsTxt(releasedKnowledgeSlugs);
    const sitemap = buildSitemapXml(new Map(releasedKnowledgeSlugs.map((slug) => [slug, '2026-07-15T11:00:00.000Z'])));
    for (const slug of releasedKnowledgeSlugs) {
      expect(robots).toContain(`Allow: /wissen/${slug}$`);
      expect(sitemap).toContain(`<loc>https://supplementstack.de/wissen/${slug}</loc>`);
      expect(knowledgeCanonicalUrl(slug)).toBe(`https://supplementstack.de/wissen/${slug}`);
    }
    expect(robots).toContain('Disallow: /');
    expect(robots).toContain('User-agent: Googlebot\nUser-agent: Googlebot-Image');
    expect(interpretRobotsTxt(robots, 'https://supplementstack.de/wissen/grapefruitkernextrakt', 'Googlebot').global_rule).toBe('ALLOW');
    expect(interpretRobotsTxt(robots, 'https://supplementstack.de/wissen/grapefruitkernextrakt-beliebig', 'Googlebot').global_rule).toBe('DISALLOW');
    for (const slug of newlyReleasedStage2Slugs) {
      expect(interpretRobotsTxt(robots, `https://supplementstack.de/wissen/${slug}`, 'Googlebot').global_rule).toBe('ALLOW');
    }
    expect(interpretRobotsTxt(robots, 'https://supplementstack.de/wissen/vitamin-d-evidenzquellen-entwurf', 'Googlebot').global_rule).toBe('DISALLOW');
    expect(interpretRobotsTxt(robots, 'https://supplementstack.de/wissen/vitamin-a', 'Googlebot').global_rule).toBe('DISALLOW');
    expect((sitemap.match(/<url>/g) ?? [])).toHaveLength(releasedKnowledgeSlugs.length);
  });

  it('rewrites stale shell headers and keeps the production canonical on preview hosts', async () => {
    const response = await buildKnowledgePrerenderResponse(new Response(
      '<!doctype html><html><head><title>Shell</title></head><body><div id="root"></div></body></html>',
      { headers: { 'Content-Type': 'text/html', 'Content-Encoding': 'gzip', ETag: 'shell-etag', 'Last-Modified': 'yesterday', 'Content-Length': '123' } },
    ), article, article.slug);
    const html = await response.text();
    const document = new JSDOM(html, { url: 'https://preview.pages.dev/wissen/grapefruitkernextrakt' }).window.document;

    expect(response.headers.get('content-encoding')).toBeNull();
    expect(response.headers.get('etag')).toBeNull();
    expect(response.headers.get('last-modified')).toBeNull();
    expect(response.headers.get('content-length')).toBeNull();
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(document.querySelector('link[rel="canonical"]')?.getAttribute('href')).toBe('https://supplementstack.de/wissen/grapefruitkernextrakt');
    expect(JSON.parse(document.querySelector('script[type="application/ld+json"]')?.textContent ?? '').mainEntityOfPage).toBe('https://supplementstack.de/wissen/grapefruitkernextrakt');
  });

  it('falls back to a noindex/no-store SPA shell when D1 readback fails', async () => {
    const shell = '<!doctype html><html><head><title>Shell</title></head><body><div id="root"></div></body></html>';
    const compressedShell = gzipSync(shell);
    const server = createServer((_request, response) => {
      response.writeHead(200, {
        'Content-Type': 'text/html',
        'Content-Encoding': 'gzip',
        'Content-Length': String(compressedShell.byteLength),
        ETag: 'shell-etag',
      });
      response.end(compressedShell);
    });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));

    try {
      const address = server.address();
      if (!address || typeof address === 'string') throw new Error('test server did not expose a port');
      const encodedShellResponse = await fetch(`http://127.0.0.1:${address.port}/shell`);
      expect(encodedShellResponse.headers.get('content-encoding')).toBe('gzip');
      const context = {
        params: { slug: 'grapefruitkernextrakt' },
        request: new Request('https://preview.pages.dev/wissen/grapefruitkernextrakt'),
        env: { DB: { prepare: () => { throw new Error('D1 unavailable'); } } },
        next: async () => encodedShellResponse,
      };
      const response = await onRequestGet(context as never);

      expect(response.status).toBe(200);
      expect(response.headers.get('x-robots-tag')).toBe('noindex, nofollow');
      expect(response.headers.get('cache-control')).toBe('no-store');
      expect(response.headers.get('content-encoding')).toBeNull();
      expect(response.headers.get('content-length')).toBeNull();
      expect(response.headers.get('etag')).toBeNull();
      expect(await response.text()).toBe(shell);
    } finally {
      await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    }
  });

  it('fails closed for invalid slugs before touching D1', async () => {
    const shell = '<!doctype html><html><head><title>Shell</title></head><body><div id="root"></div></body></html>';
    const response = await onRequestGet({
      params: { slug: '../private' },
      request: new Request('https://supplementstack.de/wissen/../private'),
      env: { DB: { prepare: () => { throw new Error('D1 must not be called'); } } },
      next: async () => new Response(shell, { status: 200 }),
    } as never);

    expect(response.headers.get('x-robots-tag')).toBe('noindex, nofollow');
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(await response.text()).toBe(shell);
  });

  it('makes robots and sitemap reflect each current published-state read without stale caching', async () => {
    let published = [{ slug: 'vitamin-d-neu', updated_at: '2026-07-18T00:00:00.000Z' }];
    const db = {
      prepare: (sql: string) => ({
        all: async () => ({
          results: sql.includes('updated_at')
            ? published
            : published.map(({ slug }) => ({ slug })),
        }),
      }),
    };
    const context = { env: { DB: db } } as never;

    const robotsPublished = await onRobotsRequest(context);
    const sitemapPublished = await onSitemapRequest(context);
    expect(robotsPublished.status).toBe(200);
    expect(robotsPublished.headers.get('cache-control')).toBe('no-store');
    expect(await robotsPublished.text()).toContain('Allow: /wissen/vitamin-d-neu$');
    expect(sitemapPublished.status).toBe(200);
    expect(sitemapPublished.headers.get('cache-control')).toBe('no-store');
    expect(await sitemapPublished.text()).toContain('<loc>https://supplementstack.de/wissen/vitamin-d-neu</loc>');

    published = [];
    const robotsRetired = await onRobotsRequest(context);
    const sitemapRetired = await onSitemapRequest(context);
    expect(robotsRetired.status).toBe(503);
    expect(robotsRetired.headers.get('cache-control')).toBe('no-store');
    expect(sitemapRetired.status).toBe(503);
    expect(sitemapRetired.headers.get('cache-control')).toBe('no-store');
  });
});
