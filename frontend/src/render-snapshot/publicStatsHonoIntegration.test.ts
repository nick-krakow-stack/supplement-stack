// @vitest-environment node
import { afterEach, describe, expect, it } from 'vitest';

import {
  createProductionKnowledgeHonoHarness,
  createProductionKnowledgeSchema,
  type ProductionKnowledgeHonoHarness,
} from './productionKnowledgeHonoTestHarness';

type PublicStatsPayload = {
  active_nutrients: number;
  published_knowledge_articles: number;
  prepared_studies: number;
  public_approved_products: number;
};

const harnesses: ProductionKnowledgeHonoHarness[] = [];

function createHarness(): ProductionKnowledgeHonoHarness {
  const harness = createProductionKnowledgeHonoHarness();
  harnesses.push(harness);
  createProductionKnowledgeSchema(harness);
  return harness;
}

function insertArticle(
  harness: ProductionKnowledgeHonoHarness,
  slug: string,
  status: 'draft' | 'published',
  articleLayer: 'main_article' | 'single_study',
): void {
  harness.run(`
    INSERT INTO knowledge_articles (
      slug, title, summary, body, status, article_layer, sources_json, created_at, updated_at
    ) VALUES (?, ?, '', '', ?, ?, '[]', '2026-07-30', '2026-07-30')
  `, slug, slug, status, articleLayer);
}

afterEach(() => {
  while (harnesses.length > 0) harnesses.pop()?.close();
});

describe.sequential('public landing-page statistics', () => {
  it('counts only public, published and scientifically accepted records and refreshes via cfcheck', async () => {
    const harness = createHarness();

    harness.run("INSERT INTO ingredients (id, name, is_active) VALUES (1, 'Aktiv 1', 1)");
    harness.run("INSERT INTO ingredients (id, name, is_active) VALUES (2, 'Aktiv 2', 1)");
    harness.run("INSERT INTO ingredients (id, name, is_active) VALUES (3, 'Inaktiv', 0)");

    insertArticle(harness, 'main-published', 'published', 'main_article');
    insertArticle(harness, 'main-draft', 'draft', 'main_article');
    insertArticle(harness, 'study-published', 'published', 'single_study');
    insertArticle(harness, 'study-official', 'published', 'single_study');
    insertArticle(harness, 'study-rejected', 'published', 'single_study');
    insertArticle(harness, 'study-draft', 'draft', 'single_study');

    harness.run("INSERT INTO ingredient_research_sources (id, ingredient_id, source_kind) VALUES (101, 1, 'study')");
    harness.run("INSERT INTO ingredient_research_sources (id, ingredient_id, source_kind) VALUES (102, 1, 'official')");
    harness.run("INSERT INTO ingredient_research_sources (id, ingredient_id, source_kind) VALUES (103, 1, 'study')");
    harness.run("INSERT INTO ingredient_research_sources (id, ingredient_id, source_kind) VALUES (104, 1, 'study')");
    harness.run("INSERT INTO study_interpretation_records (source_id, ingredient_id, knowledge_article_slug, status) VALUES (101, 1, 'study-published', 'accepted')");
    harness.run("INSERT INTO study_interpretation_records (source_id, ingredient_id, knowledge_article_slug, status) VALUES (101, 1, 'study-published', 'accepted')");
    harness.run("INSERT INTO study_interpretation_records (source_id, ingredient_id, knowledge_article_slug, status) VALUES (102, 1, 'study-official', 'accepted')");
    harness.run("INSERT INTO study_interpretation_records (source_id, ingredient_id, knowledge_article_slug, status) VALUES (103, 1, 'study-rejected', 'rejected')");
    harness.run("INSERT INTO study_interpretation_records (source_id, ingredient_id, knowledge_article_slug, status) VALUES (104, 1, 'study-draft', 'accepted')");

    harness.run("INSERT INTO products (id, moderation_status, visibility) VALUES (1, 'approved', 'public')");
    harness.run("INSERT INTO products (id, moderation_status, visibility) VALUES (2, 'approved', 'private')");
    harness.run("INSERT INTO products (id, moderation_status, visibility) VALUES (3, 'pending', 'public')");
    harness.run("INSERT INTO products (id, moderation_status, visibility) VALUES (4, 'approved', 'public')");
    harness.run("INSERT INTO products (id, moderation_status, visibility) VALUES (5, 'approved', 'public')");
    harness.run('INSERT INTO product_ingredients (product_id, ingredient_id) VALUES (1, 1)');
    harness.run('INSERT INTO product_ingredients (product_id, ingredient_id) VALUES (2, 1)');
    harness.run('INSERT INTO product_ingredients (product_id, ingredient_id) VALUES (3, 1)');
    harness.run('INSERT INTO product_ingredients (product_id, ingredient_id) VALUES (5, 1)');

    const beforeBatchCalls = harness.databaseBatchCallCount();
    const response = await harness.fetch(new Request('https://test.local/api/public-stats'));
    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('public, max-age=300');
    expect(await response.json()).toEqual<PublicStatsPayload>({
      active_nutrients: 2,
      published_knowledge_articles: 1,
      prepared_studies: 1,
      public_approved_products: 2,
    });
    expect(harness.databaseBatchCallCount() - beforeBatchCalls).toBe(1);

    harness.run("UPDATE ingredients SET is_active = 1 WHERE id = 3");
    insertArticle(harness, 'main-published-2', 'published', 'main_article');
    insertArticle(harness, 'study-published-2', 'published', 'single_study');
    harness.run("INSERT INTO ingredient_research_sources (id, ingredient_id, source_kind) VALUES (105, 2, 'study')");
    harness.run("INSERT INTO study_interpretation_records (source_id, ingredient_id, knowledge_article_slug, status) VALUES (105, 2, 'study-published-2', 'accepted')");
    harness.run('INSERT INTO product_ingredients (product_id, ingredient_id) VALUES (4, 2)');

    const cached = await harness.fetch(new Request('https://test.local/api/public-stats'));
    expect(await cached.json()).toMatchObject({
      active_nutrients: 2,
      published_knowledge_articles: 1,
      prepared_studies: 1,
      public_approved_products: 2,
    });
    expect(harness.databaseBatchCallCount() - beforeBatchCalls).toBe(1);

    const fresh = await harness.fetch(new Request('https://test.local/api/public-stats?cfcheck=release'));
    expect(await fresh.json()).toEqual<PublicStatsPayload>({
      active_nutrients: 3,
      published_knowledge_articles: 2,
      prepared_studies: 2,
      public_approved_products: 3,
    });
    expect(harness.databaseBatchCallCount() - beforeBatchCalls).toBe(2);
  });
});
