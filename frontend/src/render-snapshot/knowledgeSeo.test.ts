import { describe, expect, it } from 'vitest';
import { knowledgeArticleHead, knowledgeArticleImage, knowledgeArticleJsonLd, knowledgeSeoTimestamps } from '../../../functions/lib/knowledge-seo.mjs';
import type { KnowledgeSeoArticle } from '../../../functions/lib/knowledge-seo.mjs';
import { DEFAULT_SOCIAL_IMAGE, SITE_ORIGIN } from '../../../functions/lib/route-head-contract.mjs';

const article: KnowledgeSeoArticle = {
  slug: 'quellenartikel', title: 'Der vollständige wissenschaftliche Originaltitel bleibt unverändert',
  summary: 'Die vorhandene Zusammenfassung.', body: '## Einordnung\n\nVorhandener Inhalt.',
  article_layer: 'single_study', created_at: '2025-01-02 08:30:00', updated_at: '2026-07-13T18:00:00Z', reviewed_at: '2026-07-14T10:00:00Z',
  ingredients: [{ name: 'Vitamin D' }, { name: 'Vitamin D' }, { name: null }],
  sources: [{ label: 'Institution (2026). Originalquelle.', url: 'https://example.org/source?case=AbC' }, { label: 'Unsicher', url: 'javascript:alert(1)' }],
  related_articles: [{ slug: 'vitamin-d', title: 'Vitamin D verständlich erklärt', article_layer: 'main_article' }],
};

describe('shared knowledge delivery metadata', () => {
  it('keeps the release-bound Article core intact and attaches only actual public relationships', () => {
    const core = { '@context': 'https://schema.org', '@type': 'Article', headline: 'Separater technischer Titel', description: 'Freigegebene technische Beschreibung.', mainEntityOfPage: `${SITE_ORIGIN}/wissen/quellenartikel`, inLanguage: 'de' };
    const input = { ...article, seo: { meta_title: core.headline, meta_description: core.description, json_ld: core } };
    const before = JSON.stringify(input);
    const graph = knowledgeArticleJsonLd(input)['@graph'];
    expect(graph.filter((node) => node['@type'] === 'Article')).toEqual([core]);
    expect(graph[1]).toMatchObject({
      '@type': 'WebPage', '@id': `${SITE_ORIGIN}/wissen/quellenartikel`,
      about: [{ '@type': 'Thing', name: 'Vitamin D' }],
      citation: [{ '@type': 'CreativeWork', name: article.sources![0].label, url: article.sources![0].url }],
      isPartOf: [{ '@type': 'CollectionPage', '@id': `${SITE_ORIGIN}/wissen`, name: 'Wissen' }],
      relatedLink: [`${SITE_ORIGIN}/wissen/vitamin-d`],
    });
    expect(graph[2]).toMatchObject({ '@type': 'BreadcrumbList', itemListElement: expect.arrayContaining([{ '@type': 'ListItem', position: 3, name: article.title, item: `${SITE_ORIGIN}/wissen/quellenartikel` }]) });
    expect(JSON.stringify(input)).toBe(before);
    expect(knowledgeArticleHead(input).title).toBe(core.headline);
  });

  it('treats shared-ingredient main articles as related links, not proven parents or citations', () => {
    // related_articles is a shared-ingredient query, not an article-source relation.
    const page = knowledgeArticleJsonLd({ ...article, sources: [] })['@graph'][1];
    expect(page.isPartOf).toEqual([{ '@type': 'CollectionPage', '@id': `${SITE_ORIGIN}/wissen`, name: 'Wissen' }]);
    expect(page.relatedLink).toEqual([`${SITE_ORIGIN}/wissen/vitamin-d`]);
    expect(page).not.toHaveProperty('citation');
  });

  it('normalizes actual timestamps, never places modification before publication, and invents no missing date', () => {
    expect(knowledgeSeoTimestamps(article)).toEqual({ publishedAt: '2025-01-02T08:30:00.000Z', modifiedAt: '2026-07-14T10:00:00.000Z' });
    expect(knowledgeSeoTimestamps({ ...article, created_at: '2026-08-01T00:00:00Z' })).toEqual({ publishedAt: '2026-08-01T00:00:00.000Z', modifiedAt: '2026-08-01T00:00:00.000Z' });
    const missing = { ...article, created_at: '2026-02-30', updated_at: 'invalid', reviewed_at: null };
    expect(knowledgeSeoTimestamps(missing)).toEqual({ publishedAt: null, modifiedAt: null });
    expect(knowledgeArticleJsonLd(missing)['@graph'][0]).not.toHaveProperty('datePublished');
  });

  it('uses only the existing article-bound asset or the actual central brand image for social previews', () => {
    const path = `/api/r2/knowledge/quellenartikel/${'a'.repeat(64)}.png`;
    expect(knowledgeArticleImage({ ...article, body: `![Grafik](${path})` })).toBe(`${SITE_ORIGIN}${path}`);
    for (const src of ['https://foreign.example/image.png', '//foreign.example/image.png', `/api/r2/knowledge/other/${'a'.repeat(64)}.png`, `${path}?token=secret`, 'data:image/png;base64,unsafe']) {
      expect(knowledgeArticleImage({ ...article, body: `![Grafik](${src})` })).toBeNull();
    }
    expect(knowledgeArticleHead(article).image).toBe(DEFAULT_SOCIAL_IMAGE);
    expect(knowledgeArticleJsonLd(article)['@graph'][0]).not.toHaveProperty('image');
  });

  it('does not turn absent ingredients, sources or related articles into fabricated relationships', () => {
    const page = knowledgeArticleJsonLd({ ...article, ingredients: [], sources: [], related_articles: [] })['@graph'][1];
    expect(page).not.toHaveProperty('about');
    expect(page).not.toHaveProperty('citation');
    expect(page).not.toHaveProperty('relatedLink');
    expect(page.isPartOf).toEqual([{ '@type': 'CollectionPage', '@id': `${SITE_ORIGIN}/wissen`, name: 'Wissen' }]);
  });
});
