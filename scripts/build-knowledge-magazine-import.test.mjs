import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { DatabaseSync } from 'node:sqlite'
import test from 'node:test'
import { buildKnowledgeMagazineImport, visibleArticlePayloadHash } from './build-knowledge-magazine-import.mjs'
import { writeEvidencePipelineFixture } from './test-helpers/evidence-pipeline-fixture.mjs'
import { visiblePayloadHash as pipelineVisiblePayloadHash } from './lib/evidence-pipeline-builder.mjs'
import { assembleStage3VisiblePayload } from './lib/visible-payload-assembly.mjs'

const here = dirname(fileURLToPath(import.meta.url))

function stage3Fixture({ update = false } = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'stage3-import-'))
  const pipeline = writeEvidencePipelineFixture(dir)
  const relations = [
    { sourceId: 101, sourceKey: 'src-primary', label: 'Hauptquelle', url: 'https://example.org/primary' },
    { sourceId: 102, sourceKey: 'src-support', label: 'Ergänzende Quelle', url: 'https://example.org/support' },
  ]
  const authoring = `# Teststoff einfach erklärt

Eine kurze, verständliche Zusammenfassung.

<!-- knowledge-template:magazine -->

## Auf einen Blick

- Die Auswertung bleibt klar begrenzt.
- Mengen werden nicht als Empfehlung dargestellt.
- Unsicherheiten bleiben sichtbar.

## Wofür der Körper den Teststoff nutzt

Eine Referenzmenge kann zum Beispiel 300 mg nennen.

## Fazit

Die Kernaussage bleibt verständlich.

## Quellen

<!-- sources:auto -->`
  const articlePath = join(dir, 'article.md')
  writeFileSync(articlePath, authoring)
  const payload = assembleStage3VisiblePayload({
    slug: 'teststoff', markdown: authoring,
    visibleSources: relations.map((relation) => ({ source_id: relation.sourceKey, label: relation.label, url: relation.url })),
  })
  const visible = { ...payload, relations }
  const hash = visibleArticlePayloadHash(visible)
  const meta = {
    schema: 'stage3_article_import.v2', slug: visible.slug, ingredient_id: 7, title: visible.title, summary: visible.summary, conclusion: visible.conclusion,
    coverage_plan_path: pipeline.paths.coverage, source_evidence_bundle_path: pipeline.paths.evidence,
    source_facts_review_paths: pipeline.paths.reviews, facts_completeness_gate_path: pipeline.paths.gate,
    source_artifacts: pipeline.paths.sources,
    pipeline_lock_path: pipeline.paths.lock, allow_test_pipeline_lock: true,
    source_relations: relations.map((relation) => ({ db_source_id: relation.sourceId, source_key: relation.sourceKey, label: relation.label, url: relation.url })),
    publication_gate: { status: 'accepted', result: 'PASS', review_id: 'stage3-review-1', reviewer: { role: 'article-reader-acceptance-reviewer', id: 'reader-1' }, reviewed_at: '2026-07-13T13:00:00Z', scope: ['article:teststoff', 'visible_reader_quality'], article_hash: `sha256:${hash}`, content_lint: { status: 'PASS', validator: 'content-lint.v1', article_hash: `sha256:${hash}`, validated_at: '2026-07-13T12:30:00Z' } },
    write_guard: update
      ? { mode: 'update', expected_status: 'published', expected_version: 4, expected_body: 'alter body', expected_article_hash: `sha256:${createHash('sha256').update('alter body').digest('hex')}` }
      : { mode: 'create', expected_status: 'absent', expected_version: 0 },
  }
  const publicationPayload = payload
  const batchHash = pipelineVisiblePayloadHash(publicationPayload), pkg = pipeline.packages.stage3
  const batch = { schema: 'publication_batch.v1', batch_id: 'stage3-batch-1', reviewed_at: '2026-07-13T13:02:00.000Z', articles: [{ article_id: visible.slug, writer_id: 'stage3-writer-1', visible_payload_hash: batchHash, facts_package_hash: pkg.package_content_hash, content_lint: { status: 'PASS', validator: 'content-lint.v1', validated_at: '2026-07-13T12:59:00.000Z', visible_payload_hash: batchHash }, reader_review: { status: 'PASS', q1: 'Ja', q2: 'Ja', q3: 'Nein', reviewer: { role: 'article-reader-acceptance-reviewer', id: 'reader-1' }, reviewed_at: '2026-07-13T13:00:00.000Z', visible_payload_hash: batchHash }, facts_fidelity_review: { status: 'PASS', reviewer: { role: 'article-facts-fidelity-reviewer', id: 'fidelity-1' }, reviewed_at: '2026-07-13T13:01:00.000Z', visible_payload_hash: batchHash, facts_package_hash: pkg.package_content_hash, checks: { numbers: { status: 'PASS', visible_tokens: ['300 mg'], unsupported_tokens: [] }, safety: { status: 'PASS', visible_claims: [], unsupported_claims: [] }, populations: { status: 'PASS', visible_tokens: [], unsupported_tokens: [] }, source_mapping: { status: 'PASS', visible_source_ids: ['src-primary', 'src-support'] }, unsupported_high_risk_claims: { status: 'PASS', claims: [], unsupported: [] } }, claim_support: [] } }] }
  meta.publication_batch_path = join(dir, 'publication-batch.json'); writeFileSync(meta.publication_batch_path, JSON.stringify(batch))
  const metaPath = join(dir, 'meta.json'); writeFileSync(metaPath, JSON.stringify(meta))
  return { dir, meta, metaPath, articlePath, payload, batchHash }
}

test('canonical Stage-3 import has no arbitrary length/link minimum and guards relations', () => {
  const data = stage3Fixture()
  const result = buildKnowledgeMagazineImport({ markdownPath: data.articlePath, metaPath: data.metaPath })
  assert.equal(result.report.facts_gate, 'PASS')
  assert.equal(result.report.article_hash, data.batchHash)
  assert.match(result.sql, /CHECK \(succeeded = 1\)/)
  assert.doesNotMatch(result.sql, /ON CONFLICT/)
  assert.equal((result.sql.match(/INSERT INTO knowledge_article_sources/g) ?? []).length, 2)
  assert.match(result.sql, /## Auf einen Blick/)
  assert.doesNotMatch(result.sql, /# Teststoff einfach erklärt/)
  assert.match(result.sql, /<!-- knowledge-template:magazine -->/)
  assert.match(result.sql, /## Fazit/)
  assert.match(result.sql, /## Quellen/)
  assert.equal((result.sql.match(/Eine kurze, verständliche Zusammenfassung\./g) ?? []).length, 1)
  assert.equal((result.sql.match(/Die Kernaussage bleibt verständlich\./g) ?? []).length, 1)
  assert.equal(result.report.conclusion_storage, 'body')
})

test('Stage-3 v2 persists Fazit in magazine body and never duplicates it in conclusion', () => {
  const data = stage3Fixture()
  const { sql } = buildKnowledgeMagazineImport({ markdownPath: data.articlePath, metaPath: data.metaPath })
  const db = new DatabaseSync(':memory:')
  db.exec(`
    CREATE TABLE knowledge_articles (slug TEXT PRIMARY KEY, title TEXT, summary TEXT, body TEXT, status TEXT, reviewed_at TEXT, sources_json TEXT, created_at TEXT, updated_at TEXT, version INTEGER, conclusion TEXT, featured_image_r2_key TEXT, featured_image_url TEXT, dose_min REAL, dose_max REAL, dose_unit TEXT, product_note TEXT, article_layer TEXT);
    CREATE TABLE knowledge_article_sources (article_slug TEXT, label TEXT, url TEXT, sort_order INTEGER, created_at TEXT, updated_at TEXT);
    CREATE TABLE knowledge_article_ingredients (article_slug TEXT, ingredient_id INTEGER, sort_order INTEGER, created_at TEXT);
  `)
  db.exec(sql)
  const row = db.prepare("SELECT body, conclusion FROM knowledge_articles WHERE slug='teststoff'").get()
  assert.match(row.body, /## Fazit\n\nDie Kernaussage bleibt verständlich\./)
  assert.equal(row.conclusion, null)
  assert.equal((`${row.body}\n${row.conclusion ?? ''}`.match(/Die Kernaussage bleibt verständlich\./g) ?? []).length, 1)
  db.close()
})

test('Stage-3 v2 review and importer payload hashes match for realistic authoring structure', () => {
  const data = stage3Fixture()
  const result = buildKnowledgeMagazineImport({ markdownPath: data.articlePath, metaPath: data.metaPath })
  assert.equal(result.report.article_hash, pipelineVisiblePayloadHash(data.payload))
  assert.equal(result.report.article_hash, data.batchHash)
})

test('Stage-3 v2 fails closed on ambiguous boundaries and stale parallel metadata', () => {
  const duplicate = stage3Fixture()
  const markdown = readFileSync(duplicate.articlePath, 'utf8').replace('## Fazit', '## Fazit\n\n## Fazit')
  writeFileSync(duplicate.articlePath, markdown)
  assert.throws(() => buildKnowledgeMagazineImport({ markdownPath: duplicate.articlePath, metaPath: duplicate.metaPath }), /exactly one Stage-3 Fazit heading/)

  const stale = stage3Fixture()
  stale.meta.summary = 'Eine konkurrierende Summary.'
  writeFileSync(stale.metaPath, JSON.stringify(stale.meta))
  assert.throws(() => buildKnowledgeMagazineImport({ markdownPath: stale.articlePath, metaPath: stale.metaPath }), /meta.summary does not match the canonical authoring payload/)
})

test('missing pipeline lock and stale relation fail closed; redundant manual gate is ignored', () => {
  const missing = stage3Fixture(); delete missing.meta.pipeline_lock_path; writeFileSync(missing.metaPath, JSON.stringify(missing.meta))
  assert.throws(() => buildKnowledgeMagazineImport({ markdownPath: missing.articlePath, metaPath: missing.metaPath }), /path is required|path must be a string/)
  const stale = stage3Fixture(); stale.meta.source_relations[0].url = 'https://example.org/tampered'; writeFileSync(stale.metaPath, JSON.stringify(stale.meta))
  assert.throws(() => buildKnowledgeMagazineImport({ markdownPath: stale.articlePath, metaPath: stale.metaPath }), /differs from coverage_plan|article_hash does not match/)
  const direct = stage3Fixture(); delete direct.meta.publication_gate; direct.meta.publication_status = 'accepted'; writeFileSync(direct.metaPath, JSON.stringify(direct.meta))
  assert.doesNotThrow(() => buildKnowledgeMagazineImport({ markdownPath: direct.articlePath, metaPath: direct.metaPath }))
})

test('legacy vitamin wrapper is fail-fast and never accepts an output path', () => {
  const wrapper = join(here, 'build-vitamin-magazine-import.mjs')
  assert.equal(spawnSync(process.execPath, [wrapper], { encoding: 'utf8' }).status, 1)
  const run = spawnSync(process.execPath, [wrapper, '--out', 'unsafe.sql'], { encoding: 'utf8' })
  assert.equal(run.status, 1); assert.match(run.stderr, /never writes SQL/)
})

test('stale Stage-3 update aborts before existing relations are deleted', () => {
  const data = stage3Fixture({ update: true })
  const { sql } = buildKnowledgeMagazineImport({ markdownPath: data.articlePath, metaPath: data.metaPath })
  const db = new DatabaseSync(':memory:')
  db.exec(`
    CREATE TABLE knowledge_articles (slug TEXT PRIMARY KEY, title TEXT, summary TEXT, body TEXT, status TEXT, reviewed_at TEXT, sources_json TEXT, created_at TEXT, updated_at TEXT, version INTEGER, conclusion TEXT, featured_image_r2_key TEXT, featured_image_url TEXT, dose_min REAL, dose_max REAL, dose_unit TEXT, product_note TEXT, article_layer TEXT);
    CREATE TABLE knowledge_article_sources (article_slug TEXT, label TEXT, url TEXT, sort_order INTEGER, created_at TEXT, updated_at TEXT);
    CREATE TABLE knowledge_article_ingredients (article_slug TEXT, ingredient_id INTEGER, sort_order INTEGER, created_at TEXT);
    INSERT INTO knowledge_articles VALUES ('teststoff','old','old','alter body','published',NULL,'{}','now','now',5,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'main_article');
    INSERT INTO knowledge_article_sources VALUES ('teststoff','bestehend','https://example.org/old',0,'now','now');
  `)
  assert.throws(() => db.exec(sql), /CHECK constraint failed/)
  assert.equal(db.prepare("SELECT COUNT(*) AS count FROM knowledge_article_sources WHERE label='bestehend'").get().count, 1)
  assert.equal(db.prepare("SELECT version FROM knowledge_articles WHERE slug='teststoff'").get().version, 5)
  db.close()
})
