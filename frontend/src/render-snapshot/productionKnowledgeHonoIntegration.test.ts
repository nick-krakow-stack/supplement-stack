// @vitest-environment node
import { afterEach, describe, expect, it } from 'vitest';

import {
  createProductionKnowledgeSchema,
  createProductionKnowledgeHonoHarness,
  seedProductionKnowledgeArticle,
  type ProductionKnowledgeHonoHarness,
} from './productionKnowledgeHonoTestHarness';
import {
  auditProductionKnowledgeOverviewProjection,
  hashProductionKnowledgeOverviewRows,
  loadProductionKnowledgeOverviewRows,
  refreshProductionKnowledgeOverviewProjection,
} from './productionKnowledgeHonoHandlers.mjs';

type NutrientStatus = {
  ingredient_id: number;
  name: string;
  category: string | null;
  description: string | null;
  has_dge: boolean;
  has_studies: boolean;
};

type KnowledgeOverviewPayload = {
  nutrient_statuses: NutrientStatus[];
};

type IngredientSearchRow = {
  id: number;
  name: string;
  matched_form_id: number | null;
  matched_form_name: string | null;
};

type IngredientSearchPayload = {
  ingredients: IngredientSearchRow[];
};

type ProjectionRow = {
  row_kind: 'article' | 'status';
  row_key: string;
  payload_json: string;
};

type ProjectionTestDatabase = {
  prepare: (sql: string) => {
    all: <T>() => Promise<{ results: T[] }>;
  };
};

const harnesses: ProductionKnowledgeHonoHarness[] = [];

function createHarness(): ProductionKnowledgeHonoHarness {
  const harness = createProductionKnowledgeHonoHarness();
  harnesses.push(harness);
  return harness;
}

afterEach(() => {
  while (harnesses.length > 0) harnesses.pop()?.close();
});

function insertIngredient(harness: ProductionKnowledgeHonoHarness, id: number, name: string, isActive = 1): void {
  harness.run('INSERT INTO ingredients (id, name, is_active) VALUES (?, ?, ?)', id, name, isActive);
}

function insertArticle(
  harness: ProductionKnowledgeHonoHarness,
  {
    slug,
    ingredientId,
    status = 'published',
    articleLayer = 'single_study',
    interpretationIngredientId = ingredientId,
    interpretationStatus = 'accepted',
  }: {
    slug: string;
    ingredientId: number;
    status?: string;
    articleLayer?: string;
    interpretationIngredientId?: number;
    interpretationStatus?: string;
  },
): void {
  seedProductionKnowledgeArticle(harness, {
    slug,
    ingredientId,
    title: `${slug} Titel`,
    summary: `${slug} Zusammenfassung`,
    body: '## Einordnung\n\nVerständlicher Inhalt.',
    status,
    articleLayer: articleLayer === 'single_study' ? 'single_study' : 'main_article',
    reviewedAt: '2026-07-14',
    createdAt: '2026-07-14T10:00:00.000Z',
    updatedAt: '2026-07-14T11:00:00.000Z',
    sources: [{ source_id: `${slug}-source`, label: `${slug} Quelle`, url: `https://example.com/${slug}` }],
    ...(articleLayer === 'single_study' ? {
      interpretation: {
        sourceId: 1,
        ingredientId: interpretationIngredientId,
        status: interpretationStatus,
      },
    } : {}),
  });
}

function statusByIngredient(payload: KnowledgeOverviewPayload, ingredientId: number): NutrientStatus | undefined {
  return payload.nutrient_statuses.find((status) => status.ingredient_id === ingredientId);
}

describe.sequential('production Knowledge/R2 Hono integration', () => {
  it('returns every active ingredient and deterministically repairs the legacy status shape', async () => {
    const harness = createHarness();
    createProductionKnowledgeSchema(harness);
    for (let id = 1; id <= 92; id += 1) {
      harness.run(
        'INSERT INTO ingredients (id, name, category, description, is_active) VALUES (?, ?, ?, ?, 1)',
        id,
        `Aktiver Wirkstoff ${id}`,
        id % 2 === 0 ? 'mineral' : 'other',
        `Zentraler Kurztext ${id}`,
      );
    }
    harness.run(
      "INSERT INTO ingredients (id, name, category, description, is_active) VALUES (999, 'Inaktiv', 'other', 'Nicht sichtbar', 0)",
    );

    const firstResponse = await harness.fetch(new Request(
      `https://test.local/api/knowledge?cfcheck=sha256:${'1'.repeat(64)}`,
    ));
    expect(firstResponse.headers.get('x-knowledge-overview-source')).toBe('live');
    const firstPayload = await firstResponse.json() as KnowledgeOverviewPayload;
    expect(firstPayload.nutrient_statuses).toHaveLength(92);
    expect(firstPayload.nutrient_statuses.map((status) => status.ingredient_id)).toEqual(
      Array.from({ length: 92 }, (_, index) => index + 1),
    );
    expect(firstPayload.nutrient_statuses).not.toContainEqual(expect.objectContaining({ ingredient_id: 999 }));
    expect(firstPayload.nutrient_statuses[0]).toMatchObject({
      category: 'other',
      description: 'Zentraler Kurztext 1',
    });

    // Simulate the validly hashed 0095 payload shape that predates category
    // and description. Its versions and hash look current, so only the
    // explicit schema guard may reject and repair it.
    harness.run(`
      UPDATE knowledge_overview_projection_rows
      SET payload_json = json_remove(payload_json, '$.category', '$.description')
      WHERE row_kind = 'status'
    `);
    const db = harness.db as ProjectionTestDatabase;
    const oldRows = (await db.prepare(`
      SELECT row_kind, row_key, payload_json
      FROM knowledge_overview_projection_rows rows
      JOIN knowledge_overview_projection_meta meta ON meta.active_generation = rows.generation
      ORDER BY row_kind, row_key
    `).all<ProjectionRow>()).results;
    const oldHash = await hashProductionKnowledgeOverviewRows(oldRows);
    harness.run('UPDATE knowledge_overview_projection_meta SET content_hash = ?', oldHash);

    const legacyResponse = await harness.fetch(new Request(
      `https://test.local/api/knowledge?cfcheck=sha256:${'2'.repeat(64)}`,
    ));
    expect(legacyResponse.headers.get('x-knowledge-overview-source')).toBe('live');
    expect((await legacyResponse.json() as KnowledgeOverviewPayload).nutrient_statuses).toHaveLength(92);

    const repairedResponse = await harness.fetch(new Request(
      `https://test.local/api/knowledge?cfcheck=sha256:${'3'.repeat(64)}`,
    ));
    expect(repairedResponse.headers.get('x-knowledge-overview-source')).toBe('projection');
    const repairedPayload = await repairedResponse.json() as KnowledgeOverviewPayload;
    expect(repairedPayload.nutrient_statuses).toHaveLength(92);
    expect(repairedPayload.nutrient_statuses[91]).toMatchObject({
      ingredient_id: 92,
      category: 'mineral',
      description: 'Zentraler Kurztext 92',
    });
  });

  it('guards append-only projection refreshes and keeps the previous generation on conflicts', async () => {
    const harness = createHarness();
    createProductionKnowledgeSchema(harness);
    insertIngredient(harness, 7, 'Guard-Wirkstoff');
    insertArticle(harness, { slug: 'guard-main', ingredientId: 7, articleLayer: 'main_article' });

    const before = await auditProductionKnowledgeOverviewProjection(harness.db);
    expect(before.consistent).toBe(false);
    const liveRows = await loadProductionKnowledgeOverviewRows(harness.db);
    const liveHash = await hashProductionKnowledgeOverviewRows(liveRows);

    const staleGuard = await refreshProductionKnowledgeOverviewProjection(harness.db, {
      active_generation: before.active_generation,
      source_version: before.source_version - 1,
      expected_record_count: liveRows.length,
      content_hash: liveHash,
    });
    expect(staleGuard.applied).toBe(false);
    expect((await auditProductionKnowledgeOverviewProjection(harness.db)).active_generation).toBe(before.active_generation);

    const staleGeneration = await refreshProductionKnowledgeOverviewProjection(harness.db, {
      active_generation: before.active_generation + 1,
      source_version: before.source_version,
      expected_record_count: liveRows.length,
      content_hash: liveHash,
    });
    expect(staleGeneration.applied).toBe(false);
    expect((await auditProductionKnowledgeOverviewProjection(harness.db)).active_generation).toBe(before.active_generation);

    const wrongCount = await refreshProductionKnowledgeOverviewProjection(harness.db, {
      active_generation: before.active_generation,
      source_version: before.source_version,
      expected_record_count: liveRows.length + 1,
      content_hash: liveHash,
    });
    expect(wrongCount.applied).toBe(false);
    expect((await auditProductionKnowledgeOverviewProjection(harness.db)).active_generation).toBe(before.active_generation);

    const wrongHash = await refreshProductionKnowledgeOverviewProjection(harness.db, {
      active_generation: before.active_generation,
      source_version: before.source_version,
      expected_record_count: liveRows.length,
      content_hash: `sha256:${'0'.repeat(64)}`,
    });
    expect(wrongHash.applied).toBe(false);
    expect((await auditProductionKnowledgeOverviewProjection(harness.db)).active_generation).toBe(before.active_generation);

    const applied = await refreshProductionKnowledgeOverviewProjection(harness.db, {
      active_generation: before.active_generation,
      source_version: before.source_version,
      expected_record_count: liveRows.length,
      content_hash: liveHash,
    });
    expect(applied.applied).toBe(true);
    expect((await auditProductionKnowledgeOverviewProjection(harness.db)).consistent).toBe(true);

    const replay = await refreshProductionKnowledgeOverviewProjection(harness.db, {
      active_generation: before.active_generation,
      source_version: before.source_version,
      expected_record_count: liveRows.length,
      content_hash: liveHash,
    });
    expect(replay.applied).toBe(false);
    expect((await auditProductionKnowledgeOverviewProjection(harness.db)).active_generation).toBe(applied.active_generation);
  });

  it('runs badge, cache, timestamp and content-addressed R2 behavior through the production handlers', async () => {
    const harness = createHarness();
    createProductionKnowledgeSchema(harness);

    for (const [id, name, active] of [
      [42, 'Studie positiv', 1],
      [43, 'Studie Draft', 1],
      [44, 'Studie nicht akzeptiert', 1],
      [45, 'Studie falscher Wirkstoff', 1],
      [46, 'Interpretation fremder Wirkstoff', 1],
      [50, 'DGE sichtbar', 1],
      [51, 'DGE verborgen', 1],
      [52, 'DGE inaktiv', 1],
      [53, 'Wirkstoff inaktiv', 0],
      [54, 'DGE archiviert', 1],
    ] as const) insertIngredient(harness, id, name, active);

    insertArticle(harness, { slug: 'main-study-positive', ingredientId: 42, articleLayer: 'main_article' });
    insertArticle(harness, { slug: 'study-positive', ingredientId: 42 });
    insertArticle(harness, { slug: 'study-draft', ingredientId: 43, status: 'draft' });
    insertArticle(harness, { slug: 'study-unaccepted', ingredientId: 44, interpretationStatus: 'rejected' });
    insertArticle(harness, { slug: 'study-wrong-ingredient', ingredientId: 45, interpretationIngredientId: 46 });

    const insertDge = (
      ingredientId: number,
      { isActive = 1, stackVisible = 1, stage4Status = 'active' }: {
        isActive?: number;
        stackVisible?: number;
        stage4Status?: string;
      } = {},
    ) => harness.run(`
      INSERT INTO dose_recommendations (
        ingredient_id, source_type, source_label, source_url, is_active,
        stage4_cluster_id, stage4_source_kind, knowledge_article_slug,
        amount_type, reported_amount_text, stack_role, stack_visible,
        relevance_reason, is_controversial, valid_from, valid_until, stage4_status
      ) VALUES (?, 'official', 'Deutsche Gesellschaft für Ernährung (DGE)', 'https://www.dge.de/', ?,
        'cluster-dge', 'dge', 'main-study-positive', 'reference', 'Testwert', 'reference', ?,
        'Integrationstest', 0, '2026-01-01', NULL, ?)
    `, ingredientId, isActive, stackVisible, stage4Status);
    insertDge(50);
    insertDge(51, { stackVisible: 0 });
    insertDge(52, { isActive: 0 });
    insertDge(53);
    insertDge(54, { stage4Status: 'archived' });

    const firstResponse = await harness.fetch(new Request('https://test.local/api/knowledge'));
    expect(firstResponse.status).toBe(200);
    expect(firstResponse.headers.get('cache-control')).toBe('public, max-age=300, stale-while-revalidate=3600');
    const first = await firstResponse.json() as KnowledgeOverviewPayload;
    expect(statusByIngredient(first, 42)).toMatchObject({ has_studies: true, has_dge: false });
    expect(statusByIngredient(first, 43)).toMatchObject({ has_studies: false });
    expect(statusByIngredient(first, 44)).toMatchObject({ has_studies: false });
    expect(statusByIngredient(first, 45)).toMatchObject({ has_studies: false });
    expect(statusByIngredient(first, 50)).toMatchObject({ has_dge: true });
    expect(statusByIngredient(first, 51)).toMatchObject({ has_dge: false });
    expect(statusByIngredient(first, 52)).toMatchObject({ has_dge: false });
    expect(statusByIngredient(first, 54)).toMatchObject({ has_dge: false });
    expect(statusByIngredient(first, 53)).toBeUndefined();

    harness.resetDatabaseOperationCount();
    const projected = await harness.fetch(new Request(`https://test.local/api/knowledge?cfcheck=sha256:${'a'.repeat(64)}`));
    expect(projected.headers.get('x-knowledge-overview-source')).toBe('projection');
    expect(harness.databaseOperationCount()).toBe(1);

    harness.run(`UPDATE knowledge_overview_projection_meta SET content_hash = 'sha256:${'0'.repeat(64)}' WHERE id = 1`);
    const corruptProjection = await harness.fetch(new Request(`https://test.local/api/knowledge?cfcheck=sha256:${'d'.repeat(64)}`));
    expect(corruptProjection.headers.get('x-knowledge-overview-source')).toBe('live');
    const repairedCorruption = await harness.fetch(new Request(`https://test.local/api/knowledge?cfcheck=sha256:${'e'.repeat(64)}`));
    expect(repairedCorruption.headers.get('x-knowledge-overview-source')).toBe('projection');

    harness.run("UPDATE study_interpretation_records SET status = 'rejected' WHERE knowledge_article_slug = 'study-positive'");
    const stale = await harness.fetch(new Request('https://test.local/api/knowledge'));
    expect(statusByIngredient(await stale.json() as KnowledgeOverviewPayload, 42)).toMatchObject({ has_studies: true });

    const fresh = await harness.fetch(new Request(`https://test.local/api/knowledge?cfcheck=sha256:${'b'.repeat(64)}`));
    expect(statusByIngredient(await fresh.json() as KnowledgeOverviewPayload, 42)).toMatchObject({ has_studies: false });
    expect(fresh.headers.get('x-knowledge-overview-source')).toBe('live');

    harness.resetDatabaseOperationCount();
    const repaired = await harness.fetch(new Request(`https://test.local/api/knowledge?cfcheck=sha256:${'f'.repeat(64)}`));
    expect(repaired.headers.get('x-knowledge-overview-source')).toBe('projection');
    expect(harness.databaseOperationCount()).toBe(1);

    harness.resetDatabaseOperationCount();
    const detailBatchCountBefore = harness.databaseBatchCallCount();
    const detailResponse = await harness.fetch(new Request(
      `https://test.local/api/knowledge/main-study-positive?cfcheck=sha256:${'c'.repeat(64)}`,
    ));
    expect(detailResponse.status).toBe(200);
    expect(harness.databaseBatchCallCount()).toBe(detailBatchCountBefore + 1);
    // Detail reads may grow as additional canonical relations (for example Parts)
    // are joined. The grouped-query invariant is the single batch call asserted
    // above; here we only require that the database-backed path actually read data.
    expect(harness.databaseOperationCount()).toBeGreaterThanOrEqual(5);
    const detail = await detailResponse.json() as {
      article: {
        slug: string;
        created_at: string;
        updated_at: string;
        published_at: string;
        modified_at: string;
      };
    };
    expect(detail.article).toMatchObject({
      slug: 'main-study-positive',
      created_at: '2026-07-14T10:00:00.000Z',
      updated_at: '2026-07-14T11:00:00.000Z',
      published_at: '2026-07-14T10:00:00.000Z',
      modified_at: '2026-07-14T11:00:00.000Z',
    });

    harness.resetDatabaseOperationCount();
    const uncachedDetail = await harness.fetch(new Request('https://test.local/api/knowledge/main-study-positive'));
    expect(uncachedDetail.headers.get('cache-control')).toBe('public, max-age=300, stale-while-revalidate=3600');
    expect(uncachedDetail.headers.get('x-knowledge-article-source')).toBe('database');
    const firstDetailOperationCount = harness.databaseOperationCount();
    expect(firstDetailOperationCount).toBeGreaterThan(0);

    const cachedDetail = await harness.fetch(new Request('https://test.local/api/knowledge/main-study-positive'));
    expect(cachedDetail.headers.get('x-knowledge-article-source')).toBe('cache');
    expect(harness.databaseOperationCount()).toBe(firstDetailOperationCount);

    harness.run("UPDATE knowledge_articles SET title = 'Cache-Bypass sichtbar' WHERE slug = 'main-study-positive'");
    const bypassedDetail = await harness.fetch(new Request(
      `https://test.local/api/knowledge/main-study-positive?cfcheck=sha256:${'9'.repeat(64)}`,
    ));
    expect(bypassedDetail.headers.get('x-knowledge-article-source')).toBe('database');
    expect((await bypassedDetail.json() as { article: { title: string } }).article.title).toBe('Cache-Bypass sichtbar');

    const imageHash = 'd'.repeat(64);
    const imageBytes = Uint8Array.from([137, 80, 78, 71, 13, 10, 26, 10]);
    harness.putR2Object(`knowledge/main-study-positive/${imageHash}.png`, imageBytes, 'image/png');
    const imageResponse = await harness.fetch(new Request(
      `https://test.local/api/r2/knowledge/main-study-positive/${imageHash}.png`,
    ));
    expect(imageResponse.status).toBe(200);
    expect(imageResponse.headers.get('content-type')).toBe('image/png');
    expect(imageResponse.headers.get('cache-control')).toBe('public, max-age=31536000, immutable');
    expect(new Uint8Array(await imageResponse.arrayBuffer())).toEqual(imageBytes);
  });

  it('keeps canonical Natrium searchable without exposing an exact legacy form duplicate', async () => {
    const harness = createHarness();
    createProductionKnowledgeSchema(harness);

    for (const [id, name] of [
      [19, 'Jod'],
      [43, 'Natrium'],
      [44, 'Phosphor'],
      [49, 'Molybdän'],
      [99, 'Natriumiodid'],
    ] as const) insertIngredient(harness, id, name);

    harness.run("INSERT INTO ingredient_forms (id, ingredient_id, name) VALUES (141, 19, 'Natriumiodid')");
    harness.run("INSERT INTO ingredient_forms (id, ingredient_id, name) VALUES (142, 44, 'Natriumphosphat')");
    harness.run("INSERT INTO ingredient_forms (id, ingredient_id, name) VALUES (143, 49, 'Natriummolybdat')");
    insertArticle(harness, { slug: 'natrium-study', ingredientId: 43 });

    const search = async (query: string): Promise<IngredientSearchRow[]> => {
      const response = await harness.fetch(new Request(`https://test.local/api/ingredients/search?q=${encodeURIComponent(query)}`));
      expect(response.status).toBe(200);
      return ((await response.json()) as IngredientSearchPayload).ingredients;
    };

    for (const query of ['Natrium', 'Natri']) {
      const rows = await search(query);
      expect(rows.filter((row) => row.id === 43)).toEqual([{
        id: 43,
        name: 'Natrium',
        unit: null,
        description: null,
        matched_form_id: null,
        matched_form_name: null,
        matched_part_id: null,
        matched_part_name: null,
        synonyms: [],
      }]);
      expect(new Set(rows.map((row) => row.id)).size).toBe(rows.length);
      expect(rows.find((row) => row.id === 19)).toMatchObject({ matched_form_id: 141, matched_form_name: 'Natriumiodid' });
      expect(rows.find((row) => row.id === 44)).toMatchObject({ matched_form_id: 142, matched_form_name: 'Natriumphosphat' });
      expect(rows.find((row) => row.id === 49)).toMatchObject({ matched_form_id: 143, matched_form_name: 'Natriummolybdat' });
      expect(rows.some((row) => row.id === 99)).toBe(false);
    }

    expect(await search('Phosphor')).toContainEqual(expect.objectContaining({
      id: 44,
      name: 'Phosphor',
      matched_form_id: null,
      matched_form_name: null,
    }));
    expect(await search('Molybdän')).toContainEqual(expect.objectContaining({
      id: 49,
      name: 'Molybdän',
      matched_form_id: null,
      matched_form_name: null,
    }));

    const knowledgeResponse = await harness.fetch(new Request(
      `https://test.local/api/knowledge?cfcheck=sha256:${'e'.repeat(64)}`,
    ));
    expect(knowledgeResponse.status).toBe(200);
    expect(statusByIngredient(await knowledgeResponse.json() as KnowledgeOverviewPayload, 43)).toMatchObject({
      has_studies: true,
      has_dge: false,
    });
  });
});
