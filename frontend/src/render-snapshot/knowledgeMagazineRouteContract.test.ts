// @vitest-environment node
import { EventEmitter } from 'node:events';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  computeKnowledgeMagazineContractHashes,
  canonicalJsonHash,
  listKnowledgeMagazineRouteFiles,
  sha256Bytes,
} from '../../knowledge-magazine-contract-hash.mjs';
import {
  assessHydratedRouteState,
  assessRawHtmlReadback,
  assessPublicRouteState,
  buildOverviewBadgeOriginReceipt,
  buildRobotsReceipt,
  buildSitemapReceipt,
  closeActualRouteServer,
  createTemporaryBrowserProfile,
  deriveIndexabilityState,
  deriveOriginIndexabilityState,
  interpretRobotsTxt,
  removeBrowserProfile,
  spawnBrowserProcess,
  startActualRouteServer,
  terminateBrowserProcess,
  writeReceiptAtomic,
} from '../../validate-knowledge-magazine-style.mjs';
import { buildRobotsTxt } from '../../../functions/lib/knowledge-indexability';
import type { ArticleRenderProjectionV2 } from './knowledgeMagazineRenderSnapshot';
import {
  createProductionKnowledgeHonoHarness,
  createProductionKnowledgeSchema,
  seedProductionKnowledgeArticle,
  type ProductionKnowledgeHonoHarness,
} from './productionKnowledgeHonoTestHarness';
const CLI = resolve(process.cwd(), 'validate-knowledge-magazine-style.mjs');

type RuntimePublicReadbackRequest = {
  schema: 'renderer_public_readback_request.v2';
  release_hash: string;
  publish_target: string;
  generated_at: string;
  affected_ingredient_ids: number[];
  badge_expectations: Array<{
    ingredient_id: number;
    studies_rule: 'REQUIRE_TRUE' | 'PRESERVE' | 'API_DOM_PARITY';
    expected_has_studies: boolean | null;
    dge_rule: 'PRESERVE' | 'API_DOM_PARITY';
    expected_has_dge: boolean | null;
  }>;
  articles: Array<{
    article_id: string;
    projection_hash: string;
    seo_hash: string;
  } & Record<string, unknown>>;
  content_hash: string;
};

function buildRuntimePublicReadbackRequest(releasePath: string, generatedAt: string): RuntimePublicReadbackRequest {
  const dispatcherUrl = pathToFileURL(resolve(process.cwd(), '../scripts/lib/nutrient-content-machine-dispatcher.mjs')).href;
  const source = [
    "import { readFileSync } from 'node:fs';",
    `import { buildRendererPublicReadbackRequestV2 } from ${JSON.stringify(dispatcherUrl)};`,
    `const release = JSON.parse(readFileSync(${JSON.stringify(releasePath)}, 'utf8'));`,
    `process.stdout.write(JSON.stringify(buildRendererPublicReadbackRequestV2(release, { generatedAt: ${JSON.stringify(generatedAt)} })));`,
  ].join('\n');
  const result = spawnSync(process.execPath, ['--input-type=module', '--eval', source], {
    cwd: resolve(process.cwd(), '..'),
    encoding: 'utf8',
    timeout: 15_000,
  });
  if (result.status !== 0) throw new Error(result.stderr || result.stdout || 'Runtime-Readback-Builder schlug fehl.');
  return JSON.parse(result.stdout) as RuntimePublicReadbackRequest;
}

function validateRuntimePublicReadbackReceipt(requestPath: string, receiptPath: string): void {
  const dispatcherUrl = pathToFileURL(resolve(process.cwd(), '../scripts/lib/nutrient-content-machine-dispatcher.mjs')).href;
  const source = [
    "import { readFileSync } from 'node:fs';",
    `import { validateRendererPublicReadbackReceiptV2 } from ${JSON.stringify(dispatcherUrl)};`,
    `const request = JSON.parse(readFileSync(${JSON.stringify(requestPath)}, 'utf8'));`,
    `const receipt = JSON.parse(readFileSync(${JSON.stringify(receiptPath)}, 'utf8'));`,
    'validateRendererPublicReadbackReceiptV2(receipt, request);',
  ].join('\n');
  const result = spawnSync(process.execPath, ['--input-type=module', '--eval', source], {
    cwd: resolve(process.cwd(), '..'),
    encoding: 'utf8',
    timeout: 15_000,
  });
  if (result.status !== 0) throw new Error(result.stderr || result.stdout || 'Runtime-Readback-Receipt-Validierung schlug fehl.');
}

function runCli(args: string[], timeout = 45_000) {
  return spawnSync(process.execPath, [CLI, ...args], {
    cwd: process.cwd(),
    encoding: 'utf8',
    timeout,
  });
}

function runCliAsync(args: string[], timeout = 90_000): Promise<{ status: number | null; stdout: string; stderr: string }> {
  return new Promise((resolveRun, rejectRun) => {
    const child = spawn(process.execPath, [CLI, ...args], { cwd: process.cwd(), windowsHide: true });
    let stdout = '';
    let stderr = '';
    const timer = setTimeout(() => {
      child.kill();
      rejectRun(new Error(`CLI timeout after ${timeout} ms`));
    }, timeout);
    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', (chunk) => { stdout += chunk; });
    child.stderr.on('data', (chunk) => { stderr += chunk; });
    child.once('error', (error) => {
      clearTimeout(timer);
      rejectRun(error);
    });
    child.once('close', (status) => {
      clearTimeout(timer);
      resolveRun({ status, stdout, stderr });
    });
  });
}

describe('hydrated knowledge route browser contract', () => {
  it('keeps public badge SQL fail-closed and derives study coverage without any dose dependency', () => {
    const source = readFileSync(resolve(process.cwd(), '../functions/api/modules/knowledge-overview-projection.ts'), 'utf8');
    const studyStart = source.indexOf('study_status AS (');
    const studyEnd = source.indexOf('dge_status AS (', studyStart);
    expect(studyStart).toBeGreaterThan(0);
    expect(studyEnd).toBeGreaterThan(studyStart);
    const studyBlock = source.slice(studyStart, studyEnd);
    expect(studyBlock).toMatch(/JOIN\s+study_interpretation_records\s+sir/);
    expect(studyBlock).toMatch(/sir\.ingredient_id\s*=\s*kai\.ingredient_id/);
    expect(studyBlock).toMatch(/sir\.status\s*=\s*'accepted'/);
    expect(studyBlock).toMatch(/ka\.status\s*=\s*'published'/);
    expect(studyBlock).toMatch(/ka\.article_layer\s*=\s*'single_study'/);
    expect(studyBlock).not.toMatch(/dose_recommendations/);

    const dgeStart = source.indexOf('dge_status AS (');
    const dgeEnd = source.indexOf('overview_rows AS (', dgeStart);
    expect(dgeStart).toBeGreaterThan(0);
    expect(dgeEnd).toBeGreaterThan(dgeStart);
    const dgeBlock = source.slice(dgeStart, dgeEnd);
    expect(dgeBlock).toMatch(/dr\.source_type\s*=\s*'official'/);
    expect(dgeBlock).toMatch(/dr\.is_active\s*=\s*1/);
    expect(dgeBlock).toMatch(/dr\.stage4_status\s*=\s*'active'[\s\S]*dr\.stack_visible\s*=\s*1/);
    expect(dgeBlock).toMatch(/dr\.stage4_status\s+IS\s+NULL/);
    expect(dgeBlock).toMatch(/COALESCE\(dr\.is_controversial,\s*0\)\s*=\s*0/);
  });

  it('matches source locators without folding path/query case and rejects wrong-ingredient interpretations', async () => {
    const harness = createProductionKnowledgeHonoHarness();
    try {
      createProductionKnowledgeSchema(harness);
      harness.run("INSERT INTO ingredients (id, name, is_active) VALUES (42, 'Teststoff', 1)");
      harness.run("INSERT INTO ingredients (id, name, is_active) VALUES (43, 'Fremdstoff', 1)");
      const mainSources = [
        { source_id: 'case-match', label: 'Case Match', url: 'https://example.com/Study?Token=AbC' },
        { source_id: 'case-mismatch', label: 'Case Mismatch', url: 'https://example.com/study?Token=AbC' },
        {
          source_id: 'doi-match',
          label: 'DOI Match. DOI 10.1000/ABC.',
          url: 'https://doi.org/10.1000/',
        },
        { source_id: 'pmid-match', label: 'PMID Match', url: 'HTTPS://PUBMED.NCBI.NLM.NIH.GOV/123456/' },
        { source_id: 'pmid-efetch-match', label: 'PMID EFetch Match', url: 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi?rettype=xml&db=pubmed&id=123456&retmode=xml' },
        { source_id: 'wrong-ingredient', label: 'Wrong Ingredient', url: 'https://example.com/wrong-ingredient' },
        { source_id: 'label-match', label: 'Unique Label', url: 'https://archive.example.com/old-locator' },
        { source_id: 'label-collision', label: 'Colliding Label', url: 'https://archive.example.com/colliding-locator' },
        { source_id: 'national-academies', label: 'IOM 2005', url: 'https://www.nationalacademies.org/publications/10925' },
        {
          source_id: 'fda-biotin-alias',
          label: 'U.S. Food and Drug Administration. (2019). The FDA Warns that Biotin May Interfere with Lab Tests.',
          url: 'https://www.fda.gov/medical-devices/safety-communications/fda-warns-biotin-may-interfere-lab-tests-fda-safety-communication',
        },
        {
          source_id: 'bfr-b12-alias',
          label: 'Bundesinstitut für Risikobewertung. (2021). Höchstmengen für Vitamin B12 in Lebensmitteln inklusive Nahrungsergänzungsmitteln.',
          url: 'https://www.bfr.bund.de/',
        },
        {
          source_id: 'publisher-doi-path',
          label: 'VITAL',
          url: 'https://www.nejm.org/doi/full/10.1056/NEJMoa1809944',
        },
        {
          source_id: 'lookalike-fda-host',
          label: 'Nicht die FDA',
          url: 'https://evilfda.gov/medical-devices/in-vitro-diagnostics/biotin-interference-troponin-lab-tests-assays-subject-biotin-interference',
        },
        {
          source_id: 'lookalike-academies-host',
          label: 'Nicht die National Academies',
          url: 'https://evilnationalacademies.org/publications/10925',
        },
        {
          source_id: 'different-fda-document',
          label: 'Anderes FDA-Dokument',
          url: 'https://www.fda.gov/medical-devices/in-vitro-diagnostics/another-biotin-lab-test-document',
        },
      ];
      seedProductionKnowledgeArticle(harness, {
        slug: 'source-matching-main', ingredientId: 42, title: 'Source Matching', summary: 'Test',
        body: '<!-- knowledge-template:magazine -->\n\n## Quellen\n\n<!-- sources:auto -->',
        status: 'published', articleLayer: 'main_article', reviewedAt: '2026-07-15',
        createdAt: '2026-07-15T10:00:00.000Z', updatedAt: '2026-07-15T10:00:00.000Z', sources: mainSources,
      });
      seedProductionKnowledgeArticle(harness, {
        slug: 'matching-study', ingredientId: 42, title: 'Passende Studie', summary: 'Test', body: 'Studientext',
        status: 'published', articleLayer: 'single_study', reviewedAt: '2026-07-15',
        createdAt: '2026-07-15T10:00:00.000Z', updatedAt: '2026-07-15T10:00:00.000Z',
        sources: [{ source_id: 'matching-original', label: 'Original', url: 'https://example.com/original' }],
        interpretation: { sourceId: 201, ingredientId: 42, status: 'accepted' },
      });
      seedProductionKnowledgeArticle(harness, {
        slug: 'wrong-ingredient-study', ingredientId: 43, title: 'Fremdstoff-Studie', summary: 'Test', body: 'Studientext',
        status: 'published', articleLayer: 'single_study', reviewedAt: '2026-07-15',
        createdAt: '2026-07-15T10:00:00.000Z', updatedAt: '2026-07-15T10:00:00.000Z',
        sources: [{ source_id: 'wrong-original', label: 'Original', url: 'https://example.com/wrong-original' }],
        interpretation: { sourceId: 202, ingredientId: 43, status: 'accepted' },
      });
      harness.run(
        'INSERT INTO ingredient_research_sources (id, ingredient_id, source_title, source_url, doi, pubmed_id) VALUES (?, ?, ?, ?, ?, ?)',
        201, 42, 'Unique Label', 'HTTPS://EXAMPLE.COM/Study?Token=AbC', 'DOI: 10.1000/ABC', 'PMID: 123456',
      );
      harness.run(
        'INSERT INTO ingredient_research_sources (id, ingredient_id, source_title, source_url, doi, pubmed_id) VALUES (?, ?, ?, ?, ?, ?)',
        205, 42, 'IOM 2005', 'https://www.nationalacademies.org/publications/10925/dietary-reference-intakes-for-water-potassium-sodium-chloride-and-sulfate', '10.17226/10925', null,
      );
      harness.run(`
        INSERT INTO study_interpretation_records (
          source_id, ingredient_id, knowledge_article_slug, status, created_at, updated_at
        ) VALUES (205, 42, 'matching-study', 'accepted', '2026-07-15T10:00:00.000Z', '2026-07-15T10:00:00.000Z')
      `);
      for (const [sourceId, sourceTitle, sourceUrl, doi] of [
        [206, 'FDA Biotin Interference', 'https://www.fda.gov/medical-devices/in-vitro-diagnostics/biotin-interference-troponin-lab-tests-assays-subject-biotin-interference', null],
        [207, 'BfR Vitamin B12 Höchstmengen', 'https://www.bfr.bund.de/cm/343/hoechstmengenvorschlaege-fuer-vitamin-b12-in-lebensmitteln-inklusive-nahrungsergaenzungsmitteln.pdf', null],
        [208, 'VITAL', 'https://pubmed.ncbi.nlm.nih.gov/30415629/', '10.1056/NEJMoa1809944'],
      ] as const) {
        harness.run(
          'INSERT INTO ingredient_research_sources (id, ingredient_id, source_title, source_url, doi, pubmed_id) VALUES (?, 42, ?, ?, ?, NULL)',
          sourceId, sourceTitle, sourceUrl, doi,
        );
        harness.run(`
          INSERT INTO study_interpretation_records (
            source_id, ingredient_id, knowledge_article_slug, status, created_at, updated_at
          ) VALUES (?, 42, 'matching-study', 'accepted', '2026-07-15T10:00:00.000Z', '2026-07-15T10:00:00.000Z')
        `, sourceId);
      }
      harness.run(
        'INSERT INTO ingredient_research_sources (id, ingredient_id, source_url, doi, pubmed_id) VALUES (?, ?, ?, NULL, NULL)',
        202, 42, 'https://example.com/wrong-ingredient',
      );
      for (const [sourceId, slug, title] of [
        [203, 'collision-study-a', 'Kollisionsstudie A'],
        [204, 'collision-study-b', 'Kollisionsstudie B'],
      ] as const) {
        seedProductionKnowledgeArticle(harness, {
          slug, ingredientId: 42, title, summary: 'Test', body: 'Studientext',
          status: 'published', articleLayer: 'single_study', reviewedAt: '2026-07-15',
          createdAt: '2026-07-15T10:00:00.000Z', updatedAt: '2026-07-15T10:00:00.000Z',
          sources: [{ source_id: `${slug}-original`, label: 'Original', url: `https://example.com/${slug}` }],
          interpretation: { sourceId, ingredientId: 42, status: 'accepted' },
        });
        harness.run(
          'INSERT INTO ingredient_research_sources (id, ingredient_id, source_title, source_url, doi, pubmed_id) VALUES (?, ?, ?, ?, NULL, NULL)',
          sourceId, 42, 'Colliding Label', `https://catalog.example.com/${slug}`,
        );
      }

      const response = await harness.fetch(new Request('https://example.test/api/knowledge/source-matching-main?cfcheck=test'));
      expect(response.status).toBe(200);
      const payload = await response.json() as {
        article: { sources: Array<{ source_id: string; internal_articles?: Array<{ slug: string; title: string; url: string }> }> };
      };
      expect(payload.article.sources.map((source) => source.source_id)).toEqual(mainSources.map((source) => source.source_id));
      expect(payload.article.sources[0].internal_articles).toEqual([
        { slug: 'matching-study', title: 'Passende Studie', url: '/wissen/matching-study' },
      ]);
      expect(payload.article.sources[1]).not.toHaveProperty('internal_articles');
      expect(payload.article.sources[2].internal_articles).toEqual(payload.article.sources[0].internal_articles);
      expect(payload.article.sources[3].internal_articles).toEqual(payload.article.sources[0].internal_articles);
      expect(payload.article.sources[4].internal_articles).toEqual(payload.article.sources[0].internal_articles);
      expect(payload.article.sources[5]).not.toHaveProperty('internal_articles');
      expect(payload.article.sources[6]).not.toHaveProperty('internal_articles');
      expect(payload.article.sources[7]).not.toHaveProperty('internal_articles');
      expect(payload.article.sources[8].internal_articles).toEqual(payload.article.sources[0].internal_articles);
      expect(payload.article.sources[9].internal_articles).toEqual(payload.article.sources[0].internal_articles);
      expect(payload.article.sources[10]).not.toHaveProperty('internal_articles');
      expect(payload.article.sources[11].internal_articles).toEqual(payload.article.sources[0].internal_articles);
      expect(payload.article.sources[12]).not.toHaveProperty('internal_articles');
      expect(payload.article.sources[13]).not.toHaveProperty('internal_articles');
      expect(payload.article.sources[14]).not.toHaveProperty('internal_articles');
    } finally {
      harness.close();
    }
  });

  it('uses deduplicated internal Stage 2 sources only when every v2 main source is covered', async () => {
    const harness = createProductionKnowledgeHonoHarness();
    try {
      createProductionKnowledgeSchema(harness);
      harness.run("INSERT INTO ingredients (id, name, is_active) VALUES (42, 'Teststoff', 1)");
      seedProductionKnowledgeArticle(harness, {
        slug: 'fully-covered-main', ingredientId: 42, title: 'Vollständig abgedeckt', summary: 'Test',
        body: '<!-- knowledge-template:magazine -->\n\n## Quellen\n\n<!-- sources:auto -->',
        status: 'published', articleLayer: 'main_article', reviewedAt: '2026-07-15',
        createdAt: '2026-07-15T10:00:00.000Z', updatedAt: '2026-07-15T10:00:00.000Z',
        sources: [
          { source_id: 'external-a', label: 'Originalquelle A', url: 'https://evidence.example/a' },
          { source_id: 'external-b', label: 'Originalquelle B', url: 'https://evidence.example/b' },
          { source_id: 'external-c', label: 'Originalquelle C', url: 'https://evidence.example/c' },
          { source_id: 'external-d', label: 'Direkt im Studienartikel sichtbare Quelle', url: 'https://publisher.example/shared' },
        ],
      });
      harness.run(
        'UPDATE knowledge_articles SET sources_json = ? WHERE slug = ?',
        JSON.stringify([
          { label: 'Originalquelle A', url: 'https://evidence.example/a' },
          { label: 'Originalquelle B', url: 'https://evidence.example/b' },
          { label: 'Originalquelle C', url: 'https://evidence.example/c' },
          { label: 'Direkt im Studienartikel sichtbare Quelle', url: 'https://publisher.example/shared' },
        ]),
        'fully-covered-main',
      );
      seedProductionKnowledgeArticle(harness, {
        slug: 'study-shared', ingredientId: 42, title: 'Gemeinsamer Studienartikel', summary: 'Test', body: 'Studientext',
        status: 'published', articleLayer: 'single_study', reviewedAt: '2026-07-15',
        createdAt: '2026-07-15T10:00:00.000Z', updatedAt: '2026-07-15T10:00:00.000Z',
        sources: [{ source_id: 'shared-original', label: 'Externe Originalstudie', url: 'https://publisher.example/shared' }],
        interpretation: { sourceId: 301, ingredientId: 42, status: 'accepted' },
      });
      seedProductionKnowledgeArticle(harness, {
        slug: 'study-third', ingredientId: 42, title: 'Dritter Studienartikel', summary: 'Test', body: 'Studientext',
        status: 'published', articleLayer: 'single_study', reviewedAt: '2026-07-15',
        createdAt: '2026-07-15T10:00:00.000Z', updatedAt: '2026-07-15T10:00:00.000Z',
        sources: [{ source_id: 'third-original', label: 'Weitere Originalstudie', url: 'https://publisher.example/third' }],
        interpretation: { sourceId: 303, ingredientId: 42, status: 'accepted' },
      });
      for (const [sourceId, sourceUrl] of [
        [301, 'https://evidence.example/a'],
        [302, 'https://evidence.example/b'],
        [303, 'https://evidence.example/c'],
      ] as const) {
        harness.run(
          'INSERT INTO ingredient_research_sources (id, ingredient_id, source_title, source_url, doi, pubmed_id) VALUES (?, 42, ?, ?, NULL, NULL)',
          sourceId, `Originalquelle ${sourceId}`, sourceUrl,
        );
      }
      harness.run(`
        INSERT INTO study_interpretation_records (
          source_id, ingredient_id, knowledge_article_slug, status, created_at, updated_at
        ) VALUES (302, 42, 'study-shared', 'accepted', '2026-07-15T10:00:00.000Z', '2026-07-15T10:00:00.000Z')
      `);

      const mainResponse = await harness.fetch(new Request('https://example.test/api/knowledge/fully-covered-main'));
      expect(mainResponse.status).toBe(200);
      const mainPayload = await mainResponse.json() as {
        article: { sources: Array<{ label: string; url: string; name?: string; link?: string }> };
      };
      expect(mainPayload.article.sources).toEqual([
        {
          source_id: 'internal-article-study-shared',
          label: 'Gemeinsamer Studienartikel',
          url: '/wissen/study-shared',
          name: 'Gemeinsamer Studienartikel',
          link: '/wissen/study-shared',
        },
        {
          source_id: 'internal-article-study-third',
          label: 'Dritter Studienartikel',
          url: '/wissen/study-third',
          name: 'Dritter Studienartikel',
          link: '/wissen/study-third',
        },
      ]);

      const stage2Response = await harness.fetch(new Request('https://example.test/api/knowledge/study-shared'));
      expect(stage2Response.status).toBe(200);
      const stage2Payload = await stage2Response.json() as {
        article: { sources: Array<{ source_id?: string; label: string; url: string }> };
      };
      expect(stage2Payload.article.sources).toEqual([
        {
          source_id: 'shared-original',
          label: 'Externe Originalstudie',
          url: 'https://publisher.example/shared',
          name: 'Externe Originalstudie',
          link: 'https://publisher.example/shared',
        },
      ]);
    } finally {
      harness.close();
    }
  });

  it('publishes the single machine-readable fingerprint truth', async () => {
    const hashes = await computeKnowledgeMagazineContractHashes({ root: process.cwd() });
    const result = runCli(['--print-contract-hash']);

    expect(result.status, result.stderr).toBe(0);
    expect(result.stderr).toBe('');
    expect(JSON.parse(result.stdout)).toEqual({
      schema: 'renderer_style_contract_hash.v2',
      validator_version: 'knowledge-magazine-route-browser-contract.v2.2.0',
      viewports: {
        desktop: { width: 1440, height: 1000, device_scale_factor: 1 },
        mobile: { width: 390, height: 844, device_scale_factor: 1 },
      },
      renderer_style_hash: hashes.renderer_style_hash,
      fixture_hash: hashes.fixture_hash,
      route_fingerprint: hashes.route_fingerprint,
      route_fingerprint_parts: hashes.route_fingerprint_parts,
    });
    const fingerprintPaths = hashes.route_fingerprint_parts.files.map((entry) => entry.path);
    expect(fingerprintPaths).toEqual([...fingerprintPaths].sort());
    expect(fingerprintPaths).toEqual(expect.arrayContaining([
      'validate-knowledge-magazine-style.mjs',
      'src/render-snapshot/styleContractHarness.ts',
      'src/App.tsx',
      'src/components/ProtectedRoute.tsx',
      'src/components/Layout.tsx',
      'src/pages/KnowledgeArticlePage.tsx',
      'src/pages/KnowledgeMagazineArticle.tsx',
      'src/pages/KnowledgeMarkdown.tsx',
      'src/styles.css',
      'vite.config.ts',
      'tailwind.config.js',
      'postcss.config.js',
      'package.json',
      'package-lock.json',
    ]));
    expect(hashes.route_fingerprint_parts.resolved_versions).toMatchObject({
      react: expect.any(String),
      'react-dom': expect.any(String),
      'react-router-dom': expect.any(String),
      vite: expect.any(String),
      tailwindcss: expect.any(String),
    });
  });

  it('invalidates the fingerprint for every imported src file, including a formerly omitted App dependency', async () => {
    const workspaceRoot = process.cwd();
    const routeFiles = await listKnowledgeMagazineRouteFiles({ root: workspaceRoot });
    const previouslyOmittedImport = 'src/components/ProtectedRoute.tsx';
    expect(readFileSync(join(workspaceRoot, 'src/App.tsx'), 'utf8')).toContain("from './components/ProtectedRoute'");
    expect(routeFiles).toContain(previouslyOmittedImport);

    const temporaryRoot = mkdtempSync(join(tmpdir(), 'knowledge-route-fingerprint-'));
    try {
      for (const relativePath of routeFiles) {
        const targetPath = join(temporaryRoot, relativePath);
        mkdirSync(dirname(targetPath), { recursive: true });
        writeFileSync(targetPath, readFileSync(join(workspaceRoot, relativePath)));
      }
      const before = await computeKnowledgeMagazineContractHashes({ root: temporaryRoot });
      const mutationPath = join(temporaryRoot, previouslyOmittedImport);
      writeFileSync(mutationPath, `${readFileSync(mutationPath, 'utf8')}\n// fingerprint mutation\n`, 'utf8');
      const after = await computeKnowledgeMagazineContractHashes({ root: temporaryRoot });

      expect(after.renderer_style_hash).not.toBe(before.renderer_style_hash);
      expect(after.route_fingerprint_parts.files.find((entry) => entry.path === previouslyOmittedImport)?.byte_hash)
        .not.toBe(before.route_fingerprint_parts.files.find((entry) => entry.path === previouslyOmittedImport)?.byte_hash);
      expect(after.fixture_hash).toBe(before.fixture_hash);
    } finally {
      rmSync(temporaryRoot, { recursive: true, force: true });
    }
  });

  it('allows long German compound headings to shrink without mobile horizontal overflow', () => {
    const styles = readFileSync(join(process.cwd(), 'src/styles.css'), 'utf8');
    expect(styles).toMatch(/\.knowledge-magazine h1,[\s\S]*?\.knowledge-magazine h3 \{[\s\S]*?overflow-wrap:\s*anywhere;/);
    expect(styles).toMatch(/\.knowledge-magazine \.sec-head h2 \{[\s\S]*?min-width:\s*0;/);
  });

  it('hydrates the real App/Layout/KnowledgeArticlePage route and proves interactions, leaves, images and food tuples', async () => {
    const directory = mkdtempSync(join(tmpdir(), 'knowledge-route-browser-'));
    try {
      const hashes = await computeKnowledgeMagazineContractHashes({ root: process.cwd() });
      const inputPath = join(directory, 'request.json');
      const outputPath = join(directory, 'receipt.json');
      writeFileSync(inputPath, JSON.stringify({
        schema: 'renderer_style_validation_request.v2',
        renderer_style_hash: hashes.renderer_style_hash,
        fixture_hash: hashes.fixture_hash,
      }), 'utf8');
      const result = runCli(['--input', inputPath, '--out', outputPath]);

      expect(result.status, result.stderr || result.stdout).toBe(0);
      expect(result.stderr).toBe('');
      const receipt = JSON.parse(result.stdout);
      expect(receipt).toEqual(JSON.parse(readFileSync(outputPath, 'utf8')));
      expect(receipt).toMatchObject({
        schema: 'renderer_style_validation.v2',
        validator_version: 'knowledge-magazine-route-browser-contract.v2.2.0',
        renderer_style_hash: hashes.renderer_style_hash,
        fixture_hash: hashes.fixture_hash,
        route_fingerprint: hashes.renderer_style_hash,
        viewport: { width: 1440, height: 1000, device_scale_factor: 1 },
        result: 'PASS',
      });
      expect(receipt.browser.product).toMatch(/(?:Chrome|Edg|Chromium)/i);
      expect(receipt.viewports).toMatchObject({
        desktop: { viewport: { width: 1440, height: 1000, device_scale_factor: 1 }, result: 'PASS' },
        mobile: { viewport: { width: 390, height: 844, device_scale_factor: 1 }, result: 'PASS' },
      });
      expect(receipt.viewports.mobile.route_contract).toMatchObject({
        viewport: { width: 390, height: 844, device_scale_factor: 1 },
        document_metrics: { viewport_width: 390, horizontal_overflow: false },
      });
      expect(receipt.viewports.mobile.route_contract.toc.display).toBe('none');
      expect(receipt.viewports.mobile.route_contract.mobile_nav_interactions).toHaveLength(2);
      expect(receipt.viewports.mobile.route_contract.mobile_nav_interactions.every((interaction: { trusted_click: boolean }) => interaction.trusted_click)).toBe(true);
      expect(receipt.viewports.mobile.route_contract.pointer_interactions).toHaveLength(2);
      expect(receipt.viewports.mobile.route_contract.responsive_tables).toEqual(expect.arrayContaining([
        expect.objectContaining({ presentation: 'data_table', mobile_cards_exposed: [true] }),
        expect.objectContaining({ presentation: 'food_grid', food_cards_exposed: [true, true] }),
      ]));
      expect(receipt.route_contract.route).toBe('/wissen/render-contract');
      expect(receipt).not.toHaveProperty('article_id');
      expect(receipt).not.toHaveProperty('render_snapshot_hash');
      expect(receipt.route_contract.disclosures).toHaveLength(2);
      expect(receipt.route_contract.images[0]).toMatchObject({
        src: '/api/r2/knowledge/render-contract/f88a1476e9546b8d9c64e9e80f1e43427523d57b15d4293982fba3d83fd93d21.png',
        alt: 'Supplement-Stack-Logo',
        caption: 'Die Grafik dient als kanonisches Render-Testbild.',
        complete: true,
      });
      expect(receipt.route_contract.images[0].natural_width).toBeGreaterThan(0);
      expect(receipt.route_contract.food).toMatchObject({
        headers: hashes.fixture.expected.food_headers,
        rows: hashes.fixture.expected.food_rows,
      });
      expect(receipt.route_contract.projection).toEqual(hashes.fixture.expected.projection);
      expect(receipt.route_contract.pointer_interactions).toHaveLength(2);
      expect(receipt.route_contract.pointer_interactions.every((interaction: {
        dispatched_via: string;
        geometry_stable: boolean;
        hit_test: boolean;
        trusted_click: boolean;
      }) => (
        interaction.dispatched_via === 'CDP.Input.dispatchMouseEvent'
        && interaction.geometry_stable
        && interaction.hit_test
        && interaction.trusted_click
      ))).toBe(true);
      expect(receipt.checks.every((check: { result: string }) => check.result === 'PASS')).toBe(true);

      const hiddenLeafState = structuredClone(receipt.route_contract);
      hiddenLeafState.semantic_leaves[0].exposed = true;
      hiddenLeafState.semantic_leaves[0].exposure_chain.at(-1).aria_hidden = true;
      const hiddenAncestorMutation = assessHydratedRouteState(hiddenLeafState, hashes.fixture);
      expect(hiddenAncestorMutation.result).toBe('FAIL');
      expect(hiddenAncestorMutation.errors.map((error) => error.code)).toContain('ROUTE_SEMANTIC_LEAF_INVALID');

      const projectionState = structuredClone(receipt.route_contract);
      projectionState.projection.leaves[0].text = 'Nicht kanonischer Text';
      const projectionMutation = assessHydratedRouteState(projectionState, hashes.fixture);
      expect(projectionMutation.result).toBe('FAIL');
      expect(projectionMutation.errors.map((error) => error.code)).toContain('ROUTE_PROJECTION_INVALID');

      const fixtureMutation = structuredClone(hashes.fixture);
      fixtureMutation.article.summary = 'Nicht gebundene Zusammenfassung';
      const fixtureBindingMutation = assessHydratedRouteState(receipt.route_contract, fixtureMutation);
      expect(fixtureBindingMutation.result).toBe('FAIL');
      expect(fixtureBindingMutation.errors.map((error) => error.code)).toContain('ROUTE_FIXTURE_PROJECTION_BINDING_INVALID');

      const pointerState = structuredClone(receipt.route_contract);
      pointerState.pointer_interactions[0].hit_test = false;
      const pointerMutation = assessHydratedRouteState(pointerState, hashes.fixture);
      expect(pointerMutation.result).toBe('FAIL');
      expect(pointerMutation.errors.map((error) => error.code)).toContain('ROUTE_POINTER_INTERACTION_INVALID');

      const publicState = structuredClone(receipt.route_contract);
      publicState.fixture_fetch_count = 0;
      const releaseHash = `sha256:${'9'.repeat(64)}`;
      const publicUrl = publicState.seo.canonical_url;
      const detailApiUrl = new URL(`/api/knowledge/${hashes.fixture.article.slug}`, publicUrl);
      detailApiUrl.searchParams.set('cfcheck', releaseHash);
      publicState.public_api = {
        request_url: detailApiUrl.href,
        status: 200,
        payload: { article: structuredClone(hashes.fixture.article) },
      };
      const publicExpected = {
        stage: 'stage3',
        slug: hashes.fixture.article.slug,
        public_url: publicUrl,
        expected_projection: hashes.fixture.expected.release_projection,
        projection_hash: canonicalJsonHash(hashes.fixture.expected.release_projection),
        expected_seo: publicState.seo,
        seo_hash: canonicalJsonHash(publicState.seo),
        asset_hashes: publicState.asset_readbacks.map((asset: { byte_hash: string }) => asset.byte_hash),
        required_checks: ['assets', 'canonical', 'controls', 'fazit', 'h1_dek', 'indexability', 'internal_links', 'json_ld', 'left_navigation', 'projection', 'robots', 'sources', 'toc', 'ui'],
      };
      expect(assessPublicRouteState(publicState, publicExpected, 'desktop', releaseHash)).toMatchObject({ result: 'MATCH', mismatches: [] });
      publicState.public_api.request_url = new URL(`/api/knowledge/${hashes.fixture.article.slug}`, publicUrl).href;
      expect(assessPublicRouteState(publicState, publicExpected, 'desktop', releaseHash).mismatches).toContain('projection');
      publicState.public_api.request_url = detailApiUrl.href;
      publicState.release_projection.sections[1].normalized_text = 'Manipulierter öffentlicher DOM-Text';
      expect(assessPublicRouteState(publicState, publicExpected, 'desktop', releaseHash)).toMatchObject({ result: 'MISMATCH' });
      expect(assessPublicRouteState(publicState, publicExpected, 'desktop', releaseHash).mismatches).toContain('projection');
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  }, 55_000);

  it('reads Stage 2 and Stage 3 from real public routes without browser fixture injection', async () => {
    const directory = mkdtempSync(join(tmpdir(), 'knowledge-public-readback-'));
    let routeServer: Awaited<ReturnType<typeof startActualRouteServer>> | undefined;
    let honoHarness: ProductionKnowledgeHonoHarness | undefined;
    try {
      const hashes = await computeKnowledgeMagazineContractHashes({ root: process.cwd() });
      const logoBytes = readFileSync(join(process.cwd(), 'public/logo.png'));
      const logoHash = sha256Bytes(logoBytes);
      const stage3AssetPath = `/api/r2/knowledge/render-contract/${logoHash.slice('sha256:'.length)}.png`;
      const stage3Article = {
        ...structuredClone(hashes.fixture.article),
        article_layer: 'main_article',
        body: String(hashes.fixture.article.body),
        reviewed_at: '2026-07-14',
        published_at: '2026-07-14T10:00:00.000Z',
        modified_at: '2026-07-14T11:00:00.000Z',
        featured_image_url: null,
        featured_image_r2_key: null,
        dose_min: null,
        dose_max: null,
        dose_unit: null,
        product_note: null,
        created_at: '2026-07-14T10:00:00.000Z',
        updated_at: '2026-07-14T11:00:00.000Z',
        ingredients: [{ ingredient_id: 42, name: 'Quercetin', sort_order: 0 }],
      };
      const stage2Article = {
        slug: 'study-contract',
        title: 'Vitamin D: aktualisierte BfR-Hoechstmengenbewertung',
        summary: 'Eine klar begrenzte Studienauswertung für interessierte Leserinnen und Leser.',
        article_layer: 'single_study',
        body: [
          '## Studiendesign',
          '',
          'Die randomisierte Studie vergleicht [Vitamin A](/wissen/vitamin-a) mit Placebo.',
          '',
          '| Merkmal | Einordnung |',
          '| --- | --- |',
          '| Dauer | Acht Wochen |',
          '',
          '## Ergebnisse',
          '',
          'Die Ergebnisse zeigen einen nachvollziehbaren, aber begrenzten Unterschied.',
          '',
          '## Fazit',
          '',
          'Die Studie liefert einen klar begrenzten Hinweis.',
          '',
          '## Quellen',
          '',
          '<!-- sources:auto -->',
        ].join('\n'),
        conclusion: null,
        reviewed_at: '2026-07-14',
        published_at: '2026-07-14T10:00:00.000Z',
        modified_at: '2026-07-14T11:00:00.000Z',
        featured_image_url: null,
        featured_image_r2_key: null,
        dose_min: null,
        dose_max: null,
        dose_unit: null,
        product_note: null,
        created_at: '2026-07-14T10:00:00.000Z',
        updated_at: '2026-07-14T11:00:00.000Z',
        sources: [{ source_id: 'src-study', label: 'Originalstudie', url: 'https://example.com/study' }],
        ingredients: [{ ingredient_id: 42, name: 'Quercetin', sort_order: 0 }],
      };
      const robotsText = buildRobotsTxt(['released-elsewhere']);
      honoHarness = createProductionKnowledgeHonoHarness();
      createProductionKnowledgeSchema(honoHarness);
      honoHarness.run("INSERT INTO ingredients (id, name, is_active) VALUES (42, 'Quercetin', 1)");
      seedProductionKnowledgeArticle(honoHarness, {
        slug: stage3Article.slug,
        ingredientId: 42,
        title: stage3Article.title,
        summary: stage3Article.summary,
        body: stage3Article.body,
        status: 'published',
        articleLayer: 'main_article',
        reviewedAt: stage3Article.reviewed_at,
        createdAt: stage3Article.created_at,
        updatedAt: stage3Article.updated_at,
        sources: stage3Article.sources,
      });
      seedProductionKnowledgeArticle(honoHarness, {
        slug: stage2Article.slug,
        ingredientId: 42,
        title: stage2Article.title,
        summary: stage2Article.summary,
        body: stage2Article.body,
        status: 'published',
        articleLayer: 'single_study',
        reviewedAt: stage2Article.reviewed_at,
        createdAt: stage2Article.created_at,
        updatedAt: stage2Article.updated_at,
        sources: stage2Article.sources,
        interpretation: { sourceId: 101, ingredientId: 42, status: 'accepted' },
      });
      honoHarness.run(
        'INSERT INTO ingredient_research_sources (id, ingredient_id, source_url, doi, pubmed_id) VALUES (?, ?, ?, NULL, NULL)',
        101, 42, 'HTTPS://EXAMPLE.COM/study',
      );
      const enrichedApiResponse = await honoHarness.fetch(new Request(
        'https://example.test/api/knowledge/render-contract?cfcheck=enriched-source-fixture',
      ));
      expect(enrichedApiResponse.status).toBe(200);
      const enrichedApiPayload = await enrichedApiResponse.json() as {
        article: { sources: Array<{ label: string; url: string; name?: string; link?: string }> };
      };
      expect(enrichedApiPayload.article.sources).toEqual([{
        source_id: 'internal-article-study-contract',
        label: stage2Article.title,
        url: '/wissen/study-contract',
        name: stage2Article.title,
        link: '/wissen/study-contract',
      }]);
      honoHarness.run(`
        INSERT INTO dose_recommendations (
          ingredient_id, source_type, source_label, source_url, is_active,
          stage4_cluster_id, stage4_source_kind, knowledge_article_slug,
          amount_type, reported_amount_text, stack_role, stack_visible,
          relevance_reason, is_controversial, valid_from, valid_until, stage4_status
        ) VALUES (
          42, 'official', 'Deutsche Gesellschaft für Ernährung (DGE)', 'https://www.dge.de/', 1,
          'quercetin-dge', 'dge', 'render-contract', 'reference', 'Testwert', 'reference', 1,
          'Browserintegration', 0, '2026-01-01', NULL, 'active'
        )
      `);
      honoHarness.putR2Object(`knowledge/render-contract/${logoHash.slice('sha256:'.length)}.png`, logoBytes, 'image/png');
      routeServer = await startActualRouteServer(hashes.fixture.route, {
        productionApiFetch: honoHarness.fetch,
        publicRoutes: ['/wissen', '/wissen/render-contract', '/wissen/study-contract'],
        robotsText,
        sitemapStatus: 200,
        sitemapText: (origin: string) => [
          '<?xml version="1.0" encoding="UTF-8"?>',
          '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
          `  <url><loc>${origin}/wissen/study-contract</loc></url>`,
          `  <url><loc>${origin}/wissen/render-contract</loc></url>`,
          '</urlset>',
        ].join('\n'),
      });
      const baseUrl = routeServer.base_url;
      const stage2Projection = {
        schema: 'article_render_projection.v2',
        article_id: 'stage2-study-contract',
        route: '/wissen/study-contract',
        template: 'study_article_v2',
        h1: stage2Article.title,
        dek: stage2Article.summary,
        ui: {
          contract_version: 'knowledge-study-article-ui.v2',
          eyebrow: null,
          toc_title: null,
          ingredient_chip: 'Wirkstoffe: Quercetin',
          reviewed_date: 'Geprüft am 14. Juli 2026',
          reading_time: null,
          sources_label: 'Quellen',
          sources_count: { count: 1, label: '1 Quelle' },
        },
        sections: [
          {
            section_id: 'studiendesign', kind: 'content', control_type: null, heading: 'Studiendesign', order: 0, number: null,
            normalized_text: 'Die randomisierte Studie vergleicht Vitamin A mit Placebo. Merkmal Einordnung Dauer Acht Wochen',
            links: [{ label: 'Vitamin A', url: '/wissen/vitamin-a' }],
            tables: [{ presentation: 'data_table', headers: ['Merkmal', 'Einordnung'], rows: [['Dauer', 'Acht Wochen']] }],
            assets: [],
          },
          {
            section_id: 'ergebnisse', kind: 'content', control_type: null, heading: 'Ergebnisse', order: 1, number: null,
            normalized_text: 'Die Ergebnisse zeigen einen nachvollziehbaren, aber begrenzten Unterschied.', links: [], tables: [], assets: [],
          },
          {
            section_id: 'fazit', kind: 'fazit', control_type: null, heading: 'Fazit', order: 2, number: null,
            normalized_text: 'Die Studie liefert einen klar begrenzten Hinweis.', links: [], tables: [], assets: [],
          },
          {
            section_id: 'quellen', kind: 'sources', control_type: null, heading: 'Quellen', order: 3, number: null,
            normalized_text: 'Originalstudie', links: [{ label: 'Originalstudie', url: 'https://example.com/study' }], tables: [], assets: [],
          },
        ],
        toc: [],
        fazit: { section_id: 'fazit', normalized_text: 'Die Studie liefert einen klar begrenzten Hinweis.' },
        sources: [{ source_id: 'src-study', label: 'Originalstudie', url: 'https://example.com/study', order: 0 }],
      };
      const seoFor = (article: {
        slug: string;
        title: string;
        summary: string;
        published_at: string;
        modified_at: string;
      }, imagePath: string | null = null) => {
        const canonicalUrl = `${baseUrl}/wissen/${article.slug}`;
        const organization = {
          '@type': 'Organization',
          '@id': `${baseUrl}/#organization`,
          name: 'Supplement Stack',
          url: `${baseUrl}/`,
        };
        return {
          meta_title: article.title,
          meta_description: article.summary,
          canonical_url: canonicalUrl,
          canonical_path: `/wissen/${article.slug}`,
          robots: 'index,follow',
          indexable: true,
          json_ld: {
            '@context': 'https://schema.org',
            '@type': 'Article',
            headline: article.title,
            description: article.summary,
            mainEntityOfPage: canonicalUrl,
            inLanguage: 'de',
            datePublished: article.published_at,
            dateModified: article.modified_at,
            author: organization,
            publisher: organization,
            ...(imagePath ? { image: `${baseUrl}${imagePath}` } : {}),
          },
        };
      };
      const stage2Seo = seoFor(stage2Article);
      const stage3Projection = structuredClone(
        hashes.fixture.expected.release_projection,
      ) as ArticleRenderProjectionV2;
      stage3Projection.ui.ingredient_chip = 'Wirkstoff: Quercetin';
      stage3Projection.ui.sources_count = { count: 1, label: '1 Quelle' };
      stage3Projection.sections = stage3Projection.sections.map((section) => (
        section.kind === 'sources'
          ? {
              ...section,
              normalized_text: stage2Article.title,
              links: [{ label: stage2Article.title, url: '/wissen/study-contract' }],
            }
          : section
      ));
      stage3Projection.sources = [{
        source_id: 'internal-article-study-contract',
        label: stage2Article.title,
        url: '/wissen/study-contract',
        order: 0,
      }];
      stage3Projection.sections = stage3Projection.sections.map((section) => ({
        ...section,
        assets: (section.assets ?? []).map((asset) => ({ ...asset, src: stage3AssetPath })),
      }));
      const stage3Seo = seoFor(stage3Article, stage3AssetPath);
      type PublicArticleFixture = {
        slug: string;
        title: string;
        summary: string;
        body: string;
        published_at: string;
        modified_at: string;
        sources: Array<{ source_id: string; label: string; url: string }>;
      };
      type PublicSeoFixture = ReturnType<typeof seoFor>;
      const sourceResolutionReceiptHash = canonicalJsonHash({ kind: 'source-resolution' });
      const releaseArticle = ({
        articleId,
        stage,
        article,
        expectedProjection,
        seo,
        assetHashes,
        assets,
        resolvedSourceId,
      }: {
        articleId: string;
        stage: 'stage2' | 'stage3';
        article: PublicArticleFixture;
        expectedProjection: Record<string, unknown>;
        seo: PublicSeoFixture;
        assetHashes: string[];
        assets: Array<Record<string, unknown>>;
        resolvedSourceId: number;
      }) => {
        const sourceRelations = article.sources.map((source, position) => ({ position, ...source }));
        const primarySource = sourceRelations[0];
        if (!primarySource) throw new Error(`${articleId} braucht eine Originalquelle.`);
        const factsPackageHash = canonicalJsonHash({ article_id: articleId, kind: 'facts-package' });
        const relationHash = canonicalJsonHash(sourceRelations);
        const sourceProjection = {
          schema: 'knowledge_article_sources_projection.v2',
          facts_package_hash: factsPackageHash,
          ingredient_ids: [42],
          relations: sourceRelations,
          relation_hash: relationHash,
        };
        const structuredSummary = {
          schema: 'study_interpretation_summary.v1',
          source_id: primarySource.source_id,
          source_content_hash: canonicalJsonHash({ article_id: articleId, kind: 'source-content' }),
          facts_package_hash: factsPackageHash,
          evidence_membership_hash: canonicalJsonHash({ article_id: articleId, kind: 'membership' }),
          record_ids: [`record-${articleId}`],
          facts: [{ record_id: `record-${articleId}`, claim: `${article.title}: Testfakt` }],
        };
        const interpretationBase = {
          ingredient_id: 42,
          local_source_id: primarySource.source_id,
          resolved_source_id: resolvedSourceId,
          knowledge_article_slug: article.slug,
          status: 'accepted',
          structured_summary: structuredSummary,
          structured_summary_hash: canonicalJsonHash(structuredSummary),
          stage3_reference_summary: null,
          source_resolution_receipt_hash: sourceResolutionReceiptHash,
        };
        const publishPayload = {
          schema: 'article_visible_payload.v2',
          slug: article.slug,
          title: article.title,
          dek: article.summary,
          body: article.body,
          conclusion: null,
          sources: article.sources,
        };
        const seoHash = canonicalJsonHash(seo);
        return {
          article_id: articleId,
          stage,
          article_layer: stage === 'stage2' ? 'single_study' : 'main_article',
          slug: article.slug,
          change_class: 'L',
          write_guard: { mode: 'create', expected_status: 'absent', expected_version: 0 },
          desired_status: 'published',
          reviewed_at: '2026-07-14',
          published_at: article.published_at,
          modified_at: article.modified_at,
          target: 'local-real-route',
          article_byte_hash: canonicalJsonHash({ article_id: articleId, kind: 'article' }),
          facts_package_hash: factsPackageHash,
          evidence_membership_hash: structuredSummary.evidence_membership_hash,
          article_lineage_hash: canonicalJsonHash({ article_id: articleId, kind: 'lineage' }),
          framework_hash: canonicalJsonHash({ article_id: articleId, kind: 'framework' }),
          writer_execution_id: `${articleId}-writer`,
          validation_receipt_hash: canonicalJsonHash({ article_id: articleId, kind: 'validation' }),
          publication_review_hash: canonicalJsonHash({ article_id: articleId, kind: 'publication-review' }),
          compiled_payload_hash: canonicalJsonHash({ article_id: articleId, kind: 'compiled' }),
          visible_payload_hash: canonicalJsonHash({ article_id: articleId, kind: 'visible' }),
          qa_payload_hash: canonicalJsonHash({ article_id: articleId, kind: 'qa' }),
          render_snapshot_hash: canonicalJsonHash({ article_id: articleId, kind: 'render' }),
          relation_hash: relationHash,
          asset_hashes: assetHashes,
          seo: { ...seo, seo_hash: seoHash },
          seo_hash: seoHash,
          publish_payload: publishPayload,
          source_relations: sourceRelations,
          source_projection: sourceProjection,
          assets,
          expected_projection: expectedProjection,
          projection_hash: canonicalJsonHash(expectedProjection),
          ingredient_ids: [42],
          ingredient_relation_hash: canonicalJsonHash({ ingredient_ids: [42] }),
          stage2_interpretation_projection: stage === 'stage2'
            ? [{ ...interpretationBase, projection_hash: canonicalJsonHash(interpretationBase) }]
            : [],
          internal_link_dependencies: [],
        };
      };
      const stage2ReleaseArticle = releaseArticle({
        articleId: 'stage2-study-contract',
        stage: 'stage2',
        article: stage2Article,
        expectedProjection: stage2Projection,
        seo: stage2Seo,
        assetHashes: [],
        assets: [],
        resolvedSourceId: 101,
      });
      const stage3ReleaseArticle = releaseArticle({
        articleId: 'stage3-render-contract',
        stage: 'stage3',
        article: stage3Article,
        expectedProjection: stage3Projection,
        seo: stage3Seo,
        assetHashes: [logoHash],
        assets: [{ src: stage3AssetPath, byte_hash: logoHash }],
        resolvedSourceId: 102,
      });
      const ingredientIdentity = {
        ingredient_id: 42,
        canonical_name: 'Quercetin',
        canonical_slug: 'quercetin',
        status: 'active',
        version: 1,
      };
      const releaseBase = {
        schema: 'content_release.v2',
        run_id: 'public-readback-contract',
        manifest_hash: canonicalJsonHash({ kind: 'manifest' }),
        policy_version: 'policy-v2',
        publish_target: 'local-real-route',
        public_base_url: `${baseUrl}/`,
        atomic: true,
        ingredient_target: {
          ...ingredientIdentity,
          identity_hash: canonicalJsonHash(ingredientIdentity),
          receipt_hash: canonicalJsonHash({ kind: 'ingredient-receipt' }),
        },
        source_resolution_receipt_hash: sourceResolutionReceiptHash,
        articles: [stage2ReleaseArticle, stage3ReleaseArticle],
      };
      const release = { ...releaseBase, release_hash: canonicalJsonHash(releaseBase) };
      const releasePath = join(directory, 'content-release.json');
      writeFileSync(releasePath, JSON.stringify(release), 'utf8');
      const request = buildRuntimePublicReadbackRequest(releasePath, '2026-07-14T12:00:00.000Z');
      const articles = request.articles;
      expect(request.affected_ingredient_ids).toEqual([42]);
      expect(request.badge_expectations).toEqual([{
        ingredient_id: 42,
        studies_rule: 'REQUIRE_TRUE',
        expected_has_studies: true,
        dge_rule: 'API_DOM_PARITY',
        expected_has_dge: null,
      }]);
      const inputPath = join(directory, 'request.json');
      const outputPath = join(directory, 'receipt.json');
      writeFileSync(inputPath, JSON.stringify(request), 'utf8');

      const result = await runCliAsync(['--input', inputPath, '--out', outputPath], 120_000);
      expect(result.status, result.stderr || result.stdout).toBe(0);
      expect(result.stderr).toBe('');
      validateRuntimePublicReadbackReceipt(inputPath, outputPath);
      const receipt = JSON.parse(result.stdout);
      expect(receipt).toEqual(JSON.parse(readFileSync(outputPath, 'utf8')));
      expect(receipt).toMatchObject({
        schema: 'renderer_public_readback_receipt.v2',
        release_hash: request.release_hash,
        article_results: [
          {
            article_id: 'stage2-study-contract', result: 'MATCH', seo_match: 'MATCH', indexability_state: 'BLOCKED_BY_SITE_POLICY',
            hydrated_dom_state: 'HYDRATED_DOM_MATCH', seo_delivery_state: 'CLIENT_RENDERED_ONLY',
            projection_hash: articles[0].projection_hash, seo_hash: articles[0].seo_hash, mismatches: [],
            viewports: { desktop: { result: 'MATCH', mismatches: [] }, mobile: { result: 'MATCH', mismatches: [] } },
          },
          {
            article_id: 'stage3-render-contract', result: 'MATCH', seo_match: 'MATCH', indexability_state: 'BLOCKED_BY_SITE_POLICY',
            hydrated_dom_state: 'HYDRATED_DOM_MATCH', seo_delivery_state: 'CLIENT_RENDERED_ONLY',
            projection_hash: articles[1].projection_hash, seo_hash: articles[1].seo_hash, asset_hashes: [logoHash], mismatches: [],
            viewports: { desktop: { result: 'MATCH', mismatches: [] }, mobile: { result: 'MATCH', mismatches: [] } },
          },
        ],
      });
      expect(receipt.origin_results).toHaveLength(1);
      const badgeApiUrl = new URL('/api/knowledge', baseUrl);
      badgeApiUrl.searchParams.set('cfcheck', request.release_hash);
      const badgeOverviewUrl = new URL('/wissen', baseUrl);
      badgeOverviewUrl.searchParams.set('cfcheck', request.release_hash);
      expect(receipt.badge_readback).toEqual({
        schema: 'knowledge_badge_readback.v1',
        release_hash: request.release_hash,
        affected_ingredient_ids: [42],
        origin_results: [{
          origin: `${baseUrl}/`,
          api: {
            url: badgeApiUrl.href,
            fetch_status: 'OK',
            http_status: 200,
            content_type: 'application/json; charset=utf-8',
            body_hash: expect.stringMatching(/^sha256:[a-f0-9]{64}$/),
            statuses: [{
              ingredient_id: 42,
              status_present: true,
              studies_rule: 'REQUIRE_TRUE',
              expected_has_studies: true,
              has_studies: true,
              dge_rule: 'API_DOM_PARITY',
              expected_has_dge: null,
              has_dge: true,
            }],
          },
          hydrated_overview: {
            url: badgeOverviewUrl.href,
            viewport: { width: 1440, height: 1000, device_scale_factor: 1 },
            route_ready: true,
            api_request_url: badgeApiUrl.href,
            cards: [{ ingredient_id: 42, card_match_count: 1, studies_visible: true, dge_visible: true }],
          },
          result: 'MATCH',
          mismatches: [],
        }],
        result: 'MATCH',
        mismatches: [],
      });
      const originResult = receipt.origin_results[0];
      expect(originResult).toMatchObject({
        origin: `${baseUrl}/`,
        indexability_state: 'BLOCKED_BY_SITE_POLICY',
        robots_txt: {
          url: `${baseUrl}/robots.txt`, fetch_status: 'FETCHED', http_status: 200,
          body_hash: sha256Bytes(Buffer.from(robotsText)), user_agent: 'Googlebot', global_rule: 'DISALLOW', matched_rule: 'Disallow: /',
        },
        sitemap_discovery: {
          discovery_url: `${baseUrl}/robots.txt`, sitemap_url: `${baseUrl}/sitemap.xml`, fetch_status: 'FETCHED', http_status: 200,
        },
      });
      const representativeUrl = new URL('/wissen/study-contract', baseUrl);
      representativeUrl.searchParams.set('cfcheck', request.release_hash);
      expect(originResult.deployment_fingerprint.representative_url).toBe(representativeUrl.href);
      expect(originResult.deployment_fingerprint.raw_html_body_hash).toMatch(/^sha256:[a-f0-9]{64}$/);
      expect(originResult.deployment_fingerprint.assets.length).toBeGreaterThan(0);
      expect(originResult.deployment_fingerprint.assets).toEqual(
        [...originResult.deployment_fingerprint.assets].sort((left, right) => left.url.localeCompare(right.url)),
      );
      expect(new Set(originResult.deployment_fingerprint.assets.map((asset: { url: string }) => asset.url)).size)
        .toBe(originResult.deployment_fingerprint.assets.length);
      expect(originResult.deployment_fingerprint.fingerprint).toBe(canonicalJsonHash({
        representative_url: originResult.deployment_fingerprint.representative_url,
        raw_html_body_hash: originResult.deployment_fingerprint.raw_html_body_hash,
        assets: originResult.deployment_fingerprint.assets,
      }));
      expect(originResult.site_policy_fingerprint).toBe(canonicalJsonHash({
        origin: `${baseUrl}/`,
        robots_txt: originResult.robots_txt,
        sitemap_discovery: originResult.sitemap_discovery,
        raw_delivery_capability: 'CLIENT_RENDERED_ONLY',
        indexability_state: 'BLOCKED_BY_SITE_POLICY',
      }));
      expect(receipt.article_results[0].projection).toEqual(stage2Projection);
      expect(receipt.article_results[1].projection).toEqual(stage3Projection);
      expect(receipt.article_results[0].seo).toEqual(stage2Seo);
      expect(receipt.article_results[1].seo).toEqual(stage3Seo);
      for (const articleResult of receipt.article_results) {
        expect(articleResult).not.toHaveProperty('robots_txt');
        expect(articleResult.site_policy_fingerprint).toBe(originResult.site_policy_fingerprint);
        expect(articleResult.raw_html).toMatchObject({
          fetch_status: 'FETCHED', http_status: 200, content_type: 'text/html; charset=utf-8',
          title_match: false, article_text_match: false, article_json_ld_match: false,
          seo_delivery_state: 'CLIENT_RENDERED_ONLY',
        });
        expect(articleResult.raw_html.body_hash).toMatch(/^sha256:[a-f0-9]{64}$/);
        expect(articleResult.sitemap).toMatchObject({
          state: 'INCLUDED', discovery_url: `${baseUrl}/robots.txt`, sitemap_url: `${baseUrl}/sitemap.xml`,
          fetch_status: 'FETCHED', http_status: 200, article_url_match: true,
        });
        expect(articleResult.sitemap.body_hash).toMatch(/^sha256:[a-f0-9]{64}$/);
      }
      expect(receipt.article_results[0].viewports.desktop.responsive_tables).toEqual([{
        presentation: 'data_table', desktop_table_exposed: true, mobile_cards_container_exposed: false, mobile_cards_exposed: [false],
      }]);
      expect(receipt.article_results[0].viewports.mobile.responsive_tables).toEqual([{
        presentation: 'data_table', desktop_table_exposed: false, mobile_cards_container_exposed: true, mobile_cards_exposed: [true],
      }]);
      expect(receipt.article_results[1].viewports.mobile.responsive_diagnostics).toMatchObject({
        document_metrics: { horizontal_overflow: false },
        layout: { display: 'block', exposed: true },
        toc: { display: 'none', exposed: false },
      });
      expect(routeServer.request_log.filter((entry) => entry === '/robots.txt')).toHaveLength(1);
      expect(routeServer.request_log.filter((entry) => entry === '/sitemap.xml')).toHaveLength(1);
      const knowledgeApiRequests = routeServer.request_log.filter((entry) => entry.startsWith('/api/knowledge/'));
      expect(knowledgeApiRequests).toHaveLength(2);
      expect(new Set(knowledgeApiRequests.map((entry) => new URL(entry, baseUrl).pathname))).toEqual(new Set([
        '/api/knowledge/study-contract',
        '/api/knowledge/render-contract',
      ]));
      expect(knowledgeApiRequests.every((entry) => new URL(entry, baseUrl).searchParams.get('cfcheck') === request.release_hash)).toBe(true);
      const overviewApiRequests = routeServer.request_log.filter((entry) => new URL(entry, baseUrl).pathname === '/api/knowledge');
      expect(overviewApiRequests.length).toBeGreaterThanOrEqual(2);
      expect(overviewApiRequests.every((entry) => new URL(entry, baseUrl).searchParams.get('cfcheck') === request.release_hash)).toBe(true);
      expect(routeServer.request_log).toContain(`${badgeOverviewUrl.pathname}${badgeOverviewUrl.search}`);
      expect(receipt.content_hash).toBe(canonicalJsonHash(Object.fromEntries(Object.entries(receipt).filter(([key]) => key !== 'content_hash'))));

      honoHarness.run("UPDATE study_interpretation_records SET status = 'rejected' WHERE knowledge_article_slug = 'study-contract'");
      const mismatchOutputPath = join(directory, 'badge-mismatch-receipt.json');
      const mismatchResult = await runCliAsync(['--input', inputPath, '--out', mismatchOutputPath], 120_000);
      expect(mismatchResult.status, mismatchResult.stderr || mismatchResult.stdout).toBe(0);
      expect(mismatchResult.stderr).toBe('');
      validateRuntimePublicReadbackReceipt(inputPath, mismatchOutputPath);
      const mismatchReceipt = JSON.parse(mismatchResult.stdout);
      expect(mismatchReceipt.article_results.every((article: { result: string }) => article.result === 'MATCH')).toBe(true);
      expect(mismatchReceipt.badge_readback).toMatchObject({
        schema: 'knowledge_badge_readback.v1',
        release_hash: request.release_hash,
        result: 'MISMATCH',
        mismatches: ['42:studies_expected'],
        origin_results: [{ result: 'MISMATCH', mismatches: ['42:studies_expected'] }],
      });
      expect(mismatchReceipt.content_hash).toBe(canonicalJsonHash(
        Object.fromEntries(Object.entries(mismatchReceipt).filter(([key]) => key !== 'content_hash')),
      ));
    } finally {
      await closeActualRouteServer(routeServer);
      honoHarness?.close();
      rmSync(directory, { recursive: true, force: true });
    }
  }, 130_000);

  it('interprets robots policy independently from page SEO and applies the longest matching rule', () => {
    const policy = [
      'User-agent: *',
      'Disallow: /',
      'Allow: /wissen/',
      'Disallow: /wissen/privat$',
      '',
      'User-agent: OtherBot',
      'Disallow:',
    ].join('\n');
    expect(interpretRobotsTxt(policy, 'https://example.com/wissen/vitamin-a')).toEqual({
      global_rule: 'ALLOW', matched_rule: 'Allow: /wissen/',
    });
    expect(interpretRobotsTxt(policy, 'https://example.com/wissen/privat')).toEqual({
      global_rule: 'DISALLOW', matched_rule: 'Disallow: /wissen/privat$',
    });
    const robots = buildRobotsReceipt({
      url: 'https://example.com/robots.txt', fetch_status: 'FETCHED', http_status: 200,
      body_hash: `sha256:${'a'.repeat(64)}`, body: 'User-agent: *\nDisallow: /\n',
    }, 'https://example.com/wissen/vitamin-a');
    expect(robots).toMatchObject({ global_rule: 'DISALLOW', matched_rule: 'Disallow: /' });
    expect(deriveIndexabilityState({ indexable: true }, robots)).toBe('BLOCKED_BY_SITE_POLICY');
    expect(deriveOriginIndexabilityState(robots)).toBe('BLOCKED_BY_SITE_POLICY');
    expect(deriveIndexabilityState({ indexable: false }, robots)).toBe('BLOCKED_BY_PAGE_META');
    expect(deriveOriginIndexabilityState({ global_rule: 'ALLOW', fetch_status: 'FETCHED' })).toBe('INDEXABLE');
    expect(deriveOriginIndexabilityState({ global_rule: 'UNKNOWN', fetch_status: 'HTTP_ERROR' })).toBe('BLOCKED_BY_HTTP');
    expect(deriveOriginIndexabilityState({ global_rule: 'UNKNOWN', fetch_status: 'NETWORK_ERROR' })).toBe('UNKNOWN');
  });

  it('preserves the observed overview API URL or null and reports a separate release-URL mismatch', () => {
    const apiUrl = new URL(`https://example.com/api/knowledge?cfcheck=sha256:${'a'.repeat(64)}`);
    const overviewUrl = new URL(`https://example.com/wissen?cfcheck=sha256:${'a'.repeat(64)}`);
    const base = {
      origin: 'https://example.com/',
      apiUrl,
      overviewUrl,
      apiResult: { receipt: { url: apiUrl.href }, mismatches: [], statuses: [] },
      request: { affected_ingredient_ids: [42] },
    };
    const missing = buildOverviewBadgeOriginReceipt({
      ...base,
      overview: { route_ready: true, api_request_url: null, cards: [] },
    });
    expect(missing).toMatchObject({
      result: 'MISMATCH',
      mismatches: ['overview_api_request_url'],
      hydrated_overview: { route_ready: true, api_request_url: null },
    });

    const observedWrongUrl = 'https://example.com/api/knowledge';
    const wrong = buildOverviewBadgeOriginReceipt({
      ...base,
      overview: { route_ready: true, api_request_url: observedWrongUrl, cards: [] },
    });
    expect(wrong.mismatches).toEqual(['overview_api_request_url']);
    expect(wrong.hydrated_overview.api_request_url).toBe(observedWrongUrl);
  });

  it('reports raw HTML delivery independently from a matching hydrated DOM and classifies sitemap states', () => {
    const jsonLd = {
      '@context': 'https://schema.org',
      '@type': 'Article',
      headline: 'Teststoff klar erklärt',
      description: 'Eine verständliche Einordnung.',
      mainEntityOfPage: 'https://example.com/wissen/teststoff',
      inLanguage: 'de',
    };
    const expected = {
      expected_projection: {
        h1: 'Teststoff klar erklärt',
        dek: 'Eine verständliche Einordnung.',
        sections: [{ normalized_text: 'Der Abschnitt bleibt vollständig im ausgelieferten HTML.' }],
      },
      expected_seo: { meta_title: 'Teststoff klar erklärt', json_ld: jsonLd },
    };
    const rawBody = [
      '<!doctype html><html><head>',
      '<title>Teststoff klar erklärt</title>',
      `<script type="application/ld+json">${JSON.stringify(jsonLd)}</script>`,
      '</head><body><main>',
      '<h1>Teststoff klar erklärt</h1>',
      '<p>Eine verständliche Einordnung.</p>',
      '<section>Der Abschnitt bleibt vollständig im ausgelieferten HTML.</section>',
      '</main></body></html>',
    ].join('');
    const rawReadback = {
      url: 'https://example.com/wissen/teststoff',
      fetch_status: 'FETCHED' as const,
      http_status: 200,
      content_type: 'text/html; charset=utf-8',
      body_hash: sha256Bytes(Buffer.from(rawBody)),
      body: rawBody,
    };
    expect(assessRawHtmlReadback(rawReadback, expected)).toMatchObject({
      url: 'https://example.com/wissen/teststoff',
      fetch_status: 'FETCHED',
      http_status: 200,
      content_type: 'text/html; charset=utf-8',
      body_hash: rawReadback.body_hash,
      title_match: true,
      article_text_match: true,
      article_json_ld_match: true,
      seo_delivery_state: 'RAW_HTML_MATCH',
    });

    expect(assessRawHtmlReadback({
      ...rawReadback,
      fetch_status: 'HTTP_ERROR',
      http_status: 503,
      content_type: 'text/html',
    }, expected)).toMatchObject({
      fetch_status: 'FETCHED',
      http_status: 503,
      content_type: 'text/html',
      seo_delivery_state: 'CLIENT_RENDERED_ONLY',
    });
    expect(assessRawHtmlReadback({
      ...rawReadback,
      fetch_status: 'NETWORK_ERROR',
      http_status: null,
      content_type: null,
      body_hash: null,
      body: '',
    }, expected)).toMatchObject({
      fetch_status: 'NETWORK_ERROR',
      http_status: null,
      content_type: null,
      body_hash: null,
      seo_delivery_state: 'CLIENT_RENDERED_ONLY',
    });

    const spaBody = '<!doctype html><html><head><title>Supplement Stack</title></head><body><div id="root"></div></body></html>';
    expect(assessRawHtmlReadback({
      ...rawReadback,
      body: spaBody,
      body_hash: sha256Bytes(Buffer.from(spaBody)),
    }, expected)).toMatchObject({
      title_match: false,
      article_text_match: false,
      article_json_ld_match: false,
      seo_delivery_state: 'CLIENT_RENDERED_ONLY',
    });

    const discovery = {
      discovery_url: 'https://example.com/robots.txt',
      sitemap_url: 'https://example.com/sitemap.xml',
      fetch_status: 'FETCHED' as const,
      http_status: 200,
      body_hash: sha256Bytes(Buffer.from('<urlset/>')),
      body: '<urlset><url><loc>https://example.com/wissen/teststoff</loc></url></urlset>',
    };
    expect(buildSitemapReceipt(discovery, 'https://example.com/wissen/teststoff')).toMatchObject({
      state: 'INCLUDED', article_url_match: true,
    });
    expect(buildSitemapReceipt(discovery, 'https://example.com/wissen/anderer-stoff')).toMatchObject({
      state: 'NOT_INCLUDED', article_url_match: false,
    });
    expect(buildSitemapReceipt({
      ...discovery, fetch_status: 'NOT_FOUND', http_status: 404, body_hash: null, body: '',
    }, 'https://example.com/wissen/teststoff')).toMatchObject({
      state: 'NOT_AVAILABLE', article_url_match: false,
    });
  });

  it('evaluates the complete Cloudflare robots fixture for Google search crawlers', () => {
    const cloudflarePolicy = [
      'User-agent: *',
      'Allow: /',
      '',
      'User-agent: Googlebot',
      'Disallow: /',
      '',
      'User-agent: *',
      'Disallow: /',
      '',
    ].join('\n');
    const interpreted = interpretRobotsTxt(
      cloudflarePolicy,
      'https://supplementstack.de/wissen/vitamin-a',
      'Googlebot',
    );
    expect(interpreted).toEqual({ global_rule: 'DISALLOW', matched_rule: 'Disallow: /' });

    const robots = buildRobotsReceipt({
      url: 'https://supplementstack.de/robots.txt',
      fetch_status: 'FETCHED',
      http_status: 200,
      body_hash: sha256Bytes(Buffer.from(cloudflarePolicy)),
      body: cloudflarePolicy,
    }, 'https://supplementstack.de/wissen/vitamin-a', 'Googlebot');
    expect(robots).toMatchObject({
      user_agent: 'Googlebot',
      global_rule: 'DISALLOW',
      matched_rule: 'Disallow: /',
    });
    expect(deriveIndexabilityState({ indexable: true }, robots)).toBe('BLOCKED_BY_SITE_POLICY');
  });

  it('rejects stale renderer and fixture hashes before opening a browser', async () => {
    const directory = mkdtempSync(join(tmpdir(), 'knowledge-route-hash-'));
    try {
      const hashes = await computeKnowledgeMagazineContractHashes({ root: process.cwd() });
      const inputPath = join(directory, 'request.json');
      writeFileSync(inputPath, JSON.stringify({
        schema: 'renderer_style_validation_request.v2',
        renderer_style_hash: `sha256:${'a'.repeat(64)}`,
        fixture_hash: hashes.fixture_hash,
      }), 'utf8');
      const result = runCli(['--input', inputPath]);
      expect(result.status).toBe(2);
      expect(JSON.parse(result.stderr)).toMatchObject({ code: 'INPUT_RENDERER_STYLE_HASH_MISMATCH' });

      writeFileSync(inputPath, JSON.stringify({
        schema: 'renderer_style_validation_request.v2',
        renderer_style_hash: hashes.renderer_style_hash,
        fixture_hash: hashes.fixture_hash,
        article_snapshot_hash: `sha256:${'b'.repeat(64)}`,
      }), 'utf8');
      const redundantArticleBinding = runCli(['--input', inputPath]);
      expect(redundantArticleBinding.status).toBe(2);
      expect(JSON.parse(redundantArticleBinding.stderr)).toMatchObject({ code: 'INPUT_SCHEMA_INVALID' });
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it('normalizes temp, spawn, cleanup, close and write failures to structured exit 3 errors', async () => {
    await expect(createTemporaryBrowserProfile(async () => {
      throw new Error('temp boom');
    })).rejects.toMatchObject({ code: 'BROWSER_TEMP_FAILED', exit_code: 3 });

    const spawnFailure = () => {
      const child = new EventEmitter();
      queueMicrotask(() => child.emit('error', new Error('spawn boom')));
      return child;
    };
    await expect(spawnBrowserProcess('browser', [], spawnFailure)).rejects.toMatchObject({
      code: 'BROWSER_SPAWN_FAILED',
      exit_code: 3,
    });

    await expect(terminateBrowserProcess({
      exitCode: null,
      signalCode: null,
      kill: () => { throw new Error('browser close boom'); },
    })).rejects.toMatchObject({ code: 'BROWSER_CLOSE_FAILED', exit_code: 3 });

    let treeKilledPid: number | null = null;
    let rootKillCalled = false;
    const windowsTreeChild = Object.assign(new EventEmitter(), {
      pid: 42,
      exitCode: null as number | null,
      signalCode: null as NodeJS.Signals | null,
      kill: () => { rootKillCalled = true; },
    });
    await terminateBrowserProcess(windowsTreeChild, {
      platform: 'win32',
      treeKill: async (pid: number) => {
        treeKilledPid = pid;
        windowsTreeChild.exitCode = 0;
        windowsTreeChild.emit('exit', 0, null);
      },
    });
    expect(treeKilledPid).toBe(42);
    expect(rootKillCalled).toBe(false);

    for (const taskkillFailure of ['taskkill.exe endete mit Exit-Code 128.', 'taskkill.exe überschritt 25 ms.']) {
      const exitedDuringTreeKill = Object.assign(new EventEmitter(), {
        pid: 43,
        exitCode: null as number | null,
        signalCode: null as NodeJS.Signals | null,
        kill: () => undefined,
      });
      await expect(terminateBrowserProcess(exitedDuringTreeKill, {
        platform: 'win32',
        treeKill: async () => {
          exitedDuringTreeKill.exitCode = 0;
          exitedDuringTreeKill.emit('exit', 0, null);
          throw new Error(taskkillFailure);
        },
        treeKillTimeoutMs: 25,
      })).resolves.toBeUndefined();
    }

    await expect(removeBrowserProfile('profile', async () => {
      throw new Error('cleanup boom');
    })).rejects.toMatchObject({ code: 'BROWSER_TEMP_CLEANUP_FAILED', exit_code: 3 });

    await expect(closeActualRouteServer({
      server: {},
      vite: { close: async () => { throw new Error('vite close boom'); } },
    }, async () => {
      throw new Error('http close boom');
    })).rejects.toMatchObject({ code: 'STYLE_SERVER_CLOSE_FAILED', exit_code: 3 });

    const directory = mkdtempSync(join(tmpdir(), 'knowledge-route-write-'));
    try {
      const existingDirectory = join(directory, 'existing-directory');
      mkdirSync(existingDirectory);
      await expect(writeReceiptAtomic(existingDirectory, '{}\n')).rejects.toMatchObject({
        code: 'OUTPUT_WRITE_FAILED',
        exit_code: 3,
      });
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });
});
