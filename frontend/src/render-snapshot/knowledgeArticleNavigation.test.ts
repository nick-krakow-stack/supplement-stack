import { JSDOM } from 'jsdom';
import { describe, expect, it } from 'vitest';
import type { PublicKnowledgeArticle } from '../../../functions/api/modules/knowledge';
import { renderKnowledgeArticleHtml, renderKnowledgeMarkdownHtml } from '../../../functions/lib/knowledge-indexability';
import { onRequestGet } from '../../../functions/wissen/[slug]';
import {
  createProductionKnowledgeHonoHarness,
  createProductionKnowledgeSchema,
  seedProductionKnowledgeArticle,
  type ProductionKnowledgeHonoHarness,
} from './productionKnowledgeHonoTestHarness';

function seed(harness: ProductionKnowledgeHonoHarness, slug: string, options: {
  ingredientId?: number; layer?: 'main_article' | 'single_study'; status?: string; accepted?: boolean;
} = {}) {
  const ingredientId = options.ingredientId ?? 1;
  seedProductionKnowledgeArticle(harness, {
    slug, title: slug, summary: 'Einordnung.', body: '## Ergebnis\n\nEine begrenzte Beobachtung.',
    articleLayer: options.layer ?? 'single_study', ingredientId,
    status: options.status ?? 'published', reviewedAt: null,
    createdAt: '2026-09-05T00:00:00Z', updatedAt: '2026-09-05T00:00:00Z', sources: [],
    interpretation: options.accepted === undefined ? undefined : {
      sourceId: ingredientId, ingredientId, status: options.accepted ? 'accepted' : 'planned',
    },
  });
}

describe('published article navigation and semantic HTML', () => {
  it('returns only real public ingredient relations and accepted evidence in one read batch', async () => {
    const harness = createProductionKnowledgeHonoHarness();
    try {
      createProductionKnowledgeSchema(harness);
      harness.run("INSERT INTO ingredients (id, name, is_active) VALUES (1, 'Magnesium', 1), (2, 'Zink', 1), (3, 'Inaktiv', 0)");
      harness.run("INSERT INTO ingredient_research_sources (id, ingredient_id) VALUES (1, 1), (2, 2), (3, 3)");
      seed(harness, 'study-current', { accepted: true });
      seed(harness, 'magnesium', { layer: 'main_article' });
      seed(harness, 'study-accepted', { accepted: true });
      seed(harness, 'study-unreviewed', { accepted: false });
      seed(harness, 'study-no-record');
      seed(harness, 'draft-article', { status: 'draft', layer: 'main_article' });
      seed(harness, 'archived-article', { status: 'archived', accepted: true });
      seed(harness, 'zink', { ingredientId: 2, layer: 'main_article' });
      seed(harness, 'inactive-article', { ingredientId: 3, layer: 'main_article' });
      harness.run("INSERT INTO knowledge_article_ingredients (article_slug, ingredient_id) VALUES ('study-current', 3)");
      // Duplicate join rows must not turn into duplicate links or ingredients.
      harness.run("INSERT INTO knowledge_article_ingredients (article_slug, ingredient_id) VALUES ('magnesium', 1)");
      const before = harness.databaseBatchCallCount();
      const response = await harness.fetch(new Request('https://test.local/api/knowledge/study-current?cfcheck=1'));
      expect(response.status).toBe(200);
      expect(harness.databaseBatchCallCount()).toBe(before + 1);
      const { article } = await response.json() as { article: PublicKnowledgeArticle };
      expect(article.related_articles).toEqual([
        { slug: 'magnesium', title: 'magnesium', article_layer: 'main_article', ingredients: [{ ingredient_id: 1, name: 'Magnesium' }] },
        { slug: 'study-accepted', title: 'study-accepted', article_layer: 'single_study', ingredients: [{ ingredient_id: 1, name: 'Magnesium' }] },
      ]);
      expect(article).not.toHaveProperty('editorial');
      expect(article.update_reason).toBeNull();
      expect(() => harness.run("UPDATE knowledge_articles SET update_reason = '' WHERE slug = 'study-current'")).toThrow();
      harness.run("UPDATE knowledge_articles SET update_reason = ? WHERE slug = 'study-current'", 'a'.repeat(500));
      expect(() => harness.run("UPDATE knowledge_articles SET update_reason = ? WHERE slug = 'study-current'", 'a'.repeat(501))).toThrow();
      harness.run("UPDATE knowledge_articles SET update_reason = 'Schreibweise korrigiert.' WHERE slug = 'study-current'");
      const edited = await harness.fetch(new Request('https://test.local/api/knowledge/study-current?cfcheck=2'));
      expect((await edited.json() as { article: PublicKnowledgeArticle }).article.update_reason).toBe('Schreibweise korrigiert.');
      for (const slug of ['missing', 'draft-article', 'archived-article']) {
        expect((await harness.fetch(new Request(`https://test.local/api/knowledge/${slug}?cfcheck=1`))).status).toBe(404);
      }
    } finally { harness.close(); }
  });

  it('ignores an old cached projection and returns a genuine HTML 404 without leaking draft data', async () => {
    const harness = createProductionKnowledgeHonoHarness();
    try {
      createProductionKnowledgeSchema(harness);
      harness.run("INSERT INTO ingredients (id, name, is_active) VALUES (1, 'Magnesium', 1)");
      seed(harness, 'secret-draft-title', { status: 'draft', layer: 'main_article' });
      seed(harness, 'magnesium', { layer: 'main_article' });
      await harness.cache.put(new Request('https://test.local/api/knowledge/magnesium'), new Response(JSON.stringify({
        article: { slug: 'magnesium', title: 'Old cache' },
      })));
      const current = await harness.fetch(new Request('https://test.local/api/knowledge/magnesium'));
      expect(current.headers.get('x-knowledge-article-source')).toBe('database');
      for (const slug of ['missing', 'secret-draft-title']) {
        const response = await onRequestGet({
          params: { slug }, request: new Request(`https://test.local/wissen/${slug}`),
          env: { DB: harness.db }, waitUntil: () => undefined,
          next: async () => new Response('<html><head><title>Shell</title></head><body><div id="root"></div></body></html>'),
        } as never);
        expect(response.status).toBe(404);
        expect(response.headers.get('x-robots-tag')).toBe('noindex, nofollow');
        const html = await response.text();
        const document = new JSDOM(html).window.document;
        expect(document.querySelector('h1')?.textContent).toBe('Artikel nicht gefunden');
        expect(document.querySelector('form input[name="q"]')).not.toBeNull();
        expect(html).not.toContain('secret-draft-title');
      }
    } finally { harness.close(); }
  });

  it('renders headings, lists, tables and links before JavaScript without interpreting unsafe HTML', () => {
    const html = renderKnowledgeMarkdownHtml([
      '# Ein Artikel', '## Einordnung', '### Grenzen',
      'Ein **wichtiger** und *begrenzter* Befund. <img src=x onerror=alert(1)>',
      '- Eine Beobachtung', '- [Interne Einordnung](/wissen/magnesium)',
      '', '1. Erster Schritt', '2. Zweiter Schritt', '',
      '| Ergebnis | Grenze |', '| --- | --- |', '| **20** | [Quelle](https://example.com/study) |', '',
      '[Unsicher](javascript:alert) und [Protokoll](//example.com) und [Zugang](https://user:pass@example.com/)',
      '', '![Grafik](javascript:alert)', '', '## Quellen', '<!-- sources:auto -->',
    ].join('\n'), 'Ein Artikel', { skipBodySources: true });
    const document = new JSDOM(html).window.document;
    expect(document.querySelector('h1')).toBeNull();
    expect(document.querySelector('h2')?.textContent).toBe('Einordnung');
    expect(document.querySelector('h3')?.textContent).toBe('Grenzen');
    expect(document.querySelectorAll('ul li')).toHaveLength(2);
    expect(document.querySelectorAll('ol li')).toHaveLength(2);
    expect(document.querySelector('table th')?.getAttribute('scope')).toBe('col');
    expect(document.querySelector('table td strong')?.textContent).toBe('20');
    expect(document.querySelectorAll('a')).toHaveLength(2);
    expect(document.querySelector('[onerror],script,img')).toBeNull();
    expect(document.body.textContent).toContain('<img src=x onerror=alert(1)>');
    expect(document.body.textContent).toContain('Unsicher und Protokoll und Zugang');
    expect(document.body.textContent).not.toContain('sources:auto');
  });

  it('keeps distinct sources with one locator, body-only sources and the stored main-article conclusion', async () => {
    const harness = createProductionKnowledgeHonoHarness();
    try {
      createProductionKnowledgeSchema(harness);
      harness.run("INSERT INTO ingredients (id, name, is_active) VALUES (1, 'Magnesium', 1)");
      seed(harness, 'magnesium', { layer: 'main_article' });
      const response = await harness.fetch(new Request('https://test.local/api/knowledge/magnesium?cfcheck=1'));
      const { article } = await response.json() as { article: PublicKnowledgeArticle };
      const shell = '<html><head><title>Shell</title></head><body><div id="root"></div></body></html>';
      article.sources = [
        { source_id: 'a', label: 'Studie A', url: '/wissen/evidenz' },
        { source_id: 'b', label: 'Studie B', url: '/wissen/evidenz' },
        { source_id: 'a', label: 'Studie A', url: '/wissen/evidenz' },
      ];
      article.body = '## Ergebnis\n\nEin Befund.\n\n## **Fazit und Einordnung**\n\nAltes Fazit.\n\n## Quellen\n\n[Bodyquelle](https://example.com/original)';
      article.conclusion = '## **Fazit**\n\n**Aktuelles** Fazit.';
      const document = new JSDOM(renderKnowledgeArticleHtml(shell, article, 'https://test.local/wissen/magnesium')).window.document;
      expect(document.querySelectorAll('#prerender-sources + ol li')).toHaveLength(2);
      expect(document.querySelector('article')?.textContent).not.toContain('Altes Fazit.');
      expect(document.querySelectorAll('article h2')).toHaveLength(3);
      expect(document.querySelector('article strong')?.textContent).toBe('Aktuelles');
      article.sources = [];
      const bodyOnly = new JSDOM(renderKnowledgeArticleHtml(shell, article, 'https://test.local/wissen/magnesium')).window.document;
      expect(bodyOnly.querySelector('article a[href="https://example.com/original"]')?.textContent).toBe('Bodyquelle');
    } finally { harness.close(); }
  });
});
