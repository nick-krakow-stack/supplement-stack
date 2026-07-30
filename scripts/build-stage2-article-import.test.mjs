import assert from 'node:assert/strict'
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { DatabaseSync } from 'node:sqlite'
import test from 'node:test'
import { buildStage2Import } from './build-stage2-article-import.mjs'
import { writeEvidencePipelineFixture } from './test-helpers/evidence-pipeline-fixture.mjs'
import { visiblePayloadHash } from './lib/evidence-pipeline-builder.mjs'
import { assembleStage2LegacyVisiblePayload } from './lib/visible-payload-assembly.mjs'

const fixtures = join(dirname(fileURLToPath(import.meta.url)), 'test-fixtures', 'stage2-import')
const fixture = (name) => join(fixtures, name)
function canonicalManifest() {
  const dir = mkdtempSync(join(tmpdir(), 'stage2-canonical-'))
  const pipeline = writeEvidencePipelineFixture(dir, { acceptedCandidate: true })
  const manifest = JSON.parse(readFileSync(fixture('new-manifest.json'), 'utf8'))
  manifest.schema = 'stage2_article_import.v3'
  manifest.coverage_plan_path = pipeline.paths.coverage
  manifest.source_evidence_bundle_path = pipeline.paths.evidence
  manifest.source_facts_review_paths = pipeline.paths.reviews
  manifest.facts_completeness_gate_path = pipeline.paths.gate
  manifest.source_artifacts = pipeline.paths.sources
  manifest.pipeline_lock_path = pipeline.paths.lock
  manifest.allow_test_pipeline_lock = true
  const article = manifest.article_metadata[0]
  const authoring = `# Studienartikel: Gut lesbare Studienauswertung

## Kernfelder (Metadaten)

- titel_artikel: Gut lesbare Studienauswertung
- coverage_article_id: article-01
- publication_status: drafted

## Artikel

Die Originalquellen beantworten eine klar begrenzte Frage.

Ein zweiter Absatz führt ohne Wiederholung in die Auswertung.

### Hintergrund

Die Hauptquelle und die ergänzende Quelle werden getrennt eingeordnet.

### Was lässt sich festhalten?

Die Kernaussage bleibt auf die geprüften Originalquellen begrenzt.

### Quellen

- [Hauptquelle](https://example.org/primary)
- [Ergänzende Quelle](https://example.org/support)

## Abschlussstatus

- publication_status: drafted`
  article.article_path = join(dir, 'article.md')
  writeFileSync(article.article_path, authoring)
  const visibleSources = article.source_relations.map((relation) => ({ source_id: relation.source_key ?? (typeof relation.source_id === 'string' ? relation.source_id : ''), label: relation.label, url: relation.url }))
  const payload = assembleStage2LegacyVisiblePayload({ slug: article.slug, markdown: authoring, visibleSources })
  article.title = payload.title
  article.summary = payload.summary
  article.conclusion = payload.conclusion
  const hash = visiblePayloadHash(payload), pkg = pipeline.packages.stage2['article-01']
  const batch = { schema: 'publication_batch.v1', batch_id: 'stage2-batch-01', reviewed_at: '2026-07-13T13:02:00.000Z', articles: [{ article_id: 'article-01', writer_id: 'writer-01', visible_payload_hash: hash, facts_package_hash: pkg.package_content_hash, content_lint: { status: 'PASS', validator: 'content-lint.v1', validated_at: '2026-07-13T12:59:00.000Z', visible_payload_hash: hash }, reader_review: { status: 'PASS', q1: 'Ja', q2: 'Ja', q3: 'Nein', reviewer: { role: 'article-reader-acceptance-reviewer', id: 'reader-reviewer-01' }, reviewed_at: '2026-07-13T13:00:00.000Z', visible_payload_hash: hash }, facts_fidelity_review: { status: 'PASS', reviewer: { role: 'article-facts-fidelity-reviewer', id: 'fidelity-reviewer-01' }, reviewed_at: '2026-07-13T13:01:00.000Z', visible_payload_hash: hash, facts_package_hash: pkg.package_content_hash, checks: { numbers: { status: 'PASS', visible_tokens: [], unsupported_tokens: [] }, safety: { status: 'PASS', visible_claims: [], unsupported_claims: [] }, populations: { status: 'PASS', visible_tokens: [], unsupported_tokens: [] }, source_mapping: { status: 'PASS', visible_source_ids: ['src-primary', 'src-support'] }, unsupported_high_risk_claims: { status: 'PASS', claims: [], unsupported: [] } }, claim_support: [] } }] }
  manifest.publication_batch_path = join(dir, 'publication-batch.json')
  writeFileSync(manifest.publication_batch_path, JSON.stringify(batch))
  const path = join(dir, 'manifest.json')
  writeFileSync(path, JSON.stringify(manifest))
  return path
}

test('new coverage/evidence path publishes only an accepted publication gate and keeps exact relations', () => {
  const manifestPath = canonicalManifest()
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'))
  const batch = JSON.parse(readFileSync(manifest.publication_batch_path, 'utf8'))
  const result = buildStage2Import({ manifestPath })
  assert.equal(result.articles[0].articleStatus, 'published')
  assert.equal(result.articles[0].interpretationStatus, 'accepted')
  assert.deepEqual(result.articles[0].relations.map((entry) => entry.sourceId), [101, 102])
  assert.match(result.sql, /source_evidence_provenance\.v1/)
  assert.match(result.sql, /coverage-stage2-import-01/)
  assert.doesNotMatch(result.sql, /faithful_paraphrase/)
  assert.equal((result.sql.match(/INSERT INTO study_interpretation_records/g) ?? []).length, 2)
  assert.equal((result.sql.match(/INSERT INTO knowledge_article_sources/g) ?? []).length, 2)
  assert.match(result.sql, /'accepted'/)
  assert.match(result.sql, /publication_batch=stage2-batch-01/)
  assert.equal(visiblePayloadHash(result.articles[0].visiblePayload), batch.articles[0].visible_payload_hash)
  assert.equal(result.articles[0].body, 'Ein zweiter Absatz führt ohne Wiederholung in die Auswertung.\n\n### Hintergrund\n\nDie Hauptquelle und die ergänzende Quelle werden getrennt eingeordnet.')
  assert.doesNotMatch(result.articles[0].body, /Kernfelder \(Metadaten\)|Abschlussstatus|^# |Die Originalquellen beantworten|Was lässt sich festhalten|### Quellen/m)
})

test('Stage-2 v3 fails closed on ambiguous authoring boundaries or stale duplicated metadata', () => {
  const basePath = canonicalManifest()
  const base = JSON.parse(readFileSync(basePath, 'utf8'))
  const original = readFileSync(base.article_metadata[0].article_path, 'utf8')
  const cases = [
    ['duplicate article wrapper', original.replace('## Artikel', '## Artikel\n\n## Artikel'), /exactly one Stage-2 Artikel heading/],
    ['missing conclusion', original.replace(/^### (?:Hintergrund|Was lässt sich festhalten\?)\s*$/gm, ''), /distinct conclusion section/],
  ]
  for (const [name, markdown, expected] of cases) {
    const dir = mkdtempSync(join(tmpdir(), 'stage2-parity-negative-'))
    const manifest = structuredClone(base)
    manifest.article_metadata[0].article_path = join(dir, 'article.md')
    writeFileSync(manifest.article_metadata[0].article_path, markdown)
    const path = join(dir, 'manifest.json'); writeFileSync(path, JSON.stringify(manifest))
    assert.throws(() => buildStage2Import({ manifestPath: path }), expected, name)
  }
  const stale = structuredClone(base)
  stale.article_metadata[0].summary = 'Ein zweiter konkurrierender Lead.'
  const dir = mkdtempSync(join(tmpdir(), 'stage2-parity-negative-'))
  const path = join(dir, 'manifest.json'); writeFileSync(path, JSON.stringify(stale))
  assert.throws(() => buildStage2Import({ manifestPath: path }), /metadata.summary does not match the canonical authoring payload/)
})

test('new path rejects relations that do not exactly match the coverage candidate', () => {
  const manifest = JSON.parse(readFileSync(canonicalManifest(), 'utf8'))
  manifest.article_metadata[0].source_relations.pop()
  manifest.article_metadata[0].publication_gate = { status: 'drafted' }
  const dir = mkdtempSync(join(tmpdir(), 'stage2-import-'))
  const path = join(dir, 'manifest.json')
  writeFileSync(path, JSON.stringify(manifest))
  assert.throws(() => buildStage2Import({ manifestPath: path }), /exactly match coverage candidate sources/)
})

test('accepted publication uses only the complete hash-bound publication batch', () => {
  const base = JSON.parse(readFileSync(canonicalManifest(), 'utf8'))
  const cases = [
    ['missing reader PASS', (entry) => { delete entry.reader_review.status }, /reader acceptance failed/],
    ['mismatched hash', (entry) => { entry.visible_payload_hash = `sha256:${'0'.repeat(64)}` }, /visible payload hash is stale/],
    ['unstructured reviewer', (entry) => { entry.reader_review.reviewer = 'reviewer-01' }, /reader reviewer role is invalid/],
    ['reviewer collision', (entry) => { entry.facts_fidelity_review.reviewer.id = entry.reader_review.reviewer.id }, /must be independent/],
    ['stale time', (entry) => { entry.reader_review.reviewed_at = '2000-01-01T00:00:00.000Z' }, /binding\/time is invalid/],
    ['false fidelity', (entry) => { entry.facts_fidelity_review.checks.numbers.status = 'FAIL' }, /fidelity check numbers must PASS/],
  ]
  for (const [name, mutate, expected] of cases) {
    const manifest = structuredClone(base)
    const dir = mkdtempSync(join(tmpdir(), 'stage2-import-'))
    const batch = JSON.parse(readFileSync(manifest.publication_batch_path, 'utf8')); mutate(batch.articles[0]); manifest.publication_batch_path = join(dir, 'batch.json'); writeFileSync(manifest.publication_batch_path, JSON.stringify(batch))
    const path = join(dir, `${name.replaceAll(' ', '-')}.json`)
    writeFileSync(path, JSON.stringify(manifest))
    assert.throws(() => buildStage2Import({ manifestPath: path }), expected)
  }
})

test('invalid or incomplete evidence bundles and false facts-complete claims produce no import', () => {
  const base = JSON.parse(readFileSync(canonicalManifest(), 'utf8'))
  const dir = mkdtempSync(join(tmpdir(), 'stage2-import-'))
  const lock = JSON.parse(readFileSync(base.pipeline_lock_path, 'utf8')); lock.evidence_bundle.byte_hash = `sha256:${'0'.repeat(64)}`; base.pipeline_lock_path = join(dir, 'bad-lock.json'); writeFileSync(base.pipeline_lock_path, JSON.stringify(lock))
  const badManifest = join(dir, 'bad-manifest.json')
  writeFileSync(badManifest, JSON.stringify(base))
  assert.throws(() => buildStage2Import({ manifestPath: badManifest }), /pipeline lock schema\/hash is invalid/)

  const cli = fixture('../../build-stage2-article-import.mjs')
  const out = join(dir, 'must-not-exist.sql')
  const run = spawnSync(process.execPath, [cli, '--article-list', badManifest, '--out', out], { encoding: 'utf8' })
  assert.equal(run.status, 1)
  assert.equal(existsSync(out), false)

  const falseClaim = JSON.parse(readFileSync(canonicalManifest(), 'utf8'))
  delete falseClaim.pipeline_lock_path
  const falseClaimPath = join(dir, 'false-claim.json')
  writeFileSync(falseClaimPath, JSON.stringify(falseClaim))
  assert.throws(() => buildStage2Import({ manifestPath: falseClaimPath }), /missing input path|path is required|must be a non-empty string/)
})

test('rejected and unreviewed publication states remain drafts and never get acceptance notes', () => {
  const manifest = JSON.parse(readFileSync(canonicalManifest(), 'utf8'))
  manifest.schema = 'stage2_article_import.v2'
  const base = manifest.article_metadata[0]
  manifest.article_metadata = [
    { ...base, article_path: fixture('article.md'), slug: 'rejected', publication_gate: { status: 'rejected', result: 'FAIL', review_notes: 'must not leak' } },
    { ...base, article_path: fixture('article.md'), slug: 'unreviewed', publication_gate: { status: 'unreviewed' } },
  ]
  const dir = mkdtempSync(join(tmpdir(), 'stage2-import-'))
  const path = join(dir, 'manifest.json')
  writeFileSync(path, JSON.stringify(manifest))
  const result = buildStage2Import({ manifestPath: path })
  assert.deepEqual(result.articles.map((entry) => entry.articleStatus), ['draft', 'draft'])
  assert.deepEqual(result.articles.map((entry) => entry.interpretationStatus), ['blocked', 'drafted'])
  assert.deepEqual(result.articles.map((entry) => entry.reviewNotes), [null, null])
  assert.equal(result.articles[0].body, readFileSync(fixture('article.md'), 'utf8'))
  assert.doesNotMatch(result.sql, /must not leak/)
})

test('legacy extract manifests remain importable but a missing gate cannot publish them', () => {
  const manifest = JSON.parse(readFileSync(fixture('legacy-manifest.json'), 'utf8'))
  manifest.articles[0].status = 'accepted'
  manifest.articles[0].review_notes = 'unchecked acceptance must not leak'
  const dir = mkdtempSync(join(tmpdir(), 'stage2-import-'))
  const path = join(dir, 'manifest.json')
  manifest.articles[0].article_path = fixture('article.md')
  manifest.articles[0].extract_path = fixture('legacy-extract.json')
  writeFileSync(path, JSON.stringify(manifest))
  const result = buildStage2Import({ manifestPath: path })
  assert.equal(result.articles[0].articleStatus, 'draft')
  assert.equal(result.articles[0].interpretationStatus, 'drafted')
  assert.equal(result.articles[0].structuredSummary, '{}')
  assert.match(result.sql, /Legacy summary/)
  assert.doesNotMatch(result.sql, /Legacy detail that must not be copied/)
  assert.doesNotMatch(result.sql, /unchecked acceptance/)
})

test('CLI dry-run validates without writing SQL; --out writes deterministic SQL', () => {
  const script = fixture('../../build-stage2-article-import.mjs')
  const manifest = canonicalManifest()
  const dry = spawnSync(process.execPath, [script, '--article-list', manifest, '--dry-run'], { encoding: 'utf8' })
  assert.equal(dry.status, 0, dry.stderr)
  assert.equal(JSON.parse(dry.stdout).articles[0].source_relation_count, 2)
  assert.doesNotMatch(dry.stdout, /INSERT INTO/)

  const dir = mkdtempSync(join(tmpdir(), 'stage2-import-'))
  const out = join(dir, 'import.sql')
  const write = spawnSync(process.execPath, [script, '--article-list', manifest, '--out', out], { encoding: 'utf8' })
  assert.equal(write.status, 0, write.stderr)
  const sql = readFileSync(out, 'utf8')
  assert.match(sql, /INSERT INTO knowledge_articles/)
  assert.match(sql, /source_evidence_provenance\.v1/)
  assert.doesNotMatch(sql, /ON CONFLICT/)
  assert.match(sql, /_stage2_import_guard/)
})

test('update SQL binds optimistic version, status, slug, and previous body guards', () => {
  const manifest = JSON.parse(readFileSync(canonicalManifest(), 'utf8'))
  const article = manifest.article_metadata[0]
  const previousBody = '# Vorherige Fassung\n\nUnveränderter Ausgangstext.'
  article.write_guard = {
    mode: 'update',
    expected_version: 4,
    expected_status: 'draft',
    expected_article_hash: `sha256:${createHash('sha256').update(previousBody).digest('hex')}`,
    expected_body: previousBody,
  }
  const dir = mkdtempSync(join(tmpdir(), 'stage2-import-'))
  const path = join(dir, 'manifest.json')
  writeFileSync(path, JSON.stringify(manifest))
  const result = buildStage2Import({ manifestPath: path })
  assert.match(result.sql, /AND version=4/)
  assert.match(result.sql, /AND status='draft'/)
  assert.match(result.sql, /WHERE slug='article-01'/)
  assert.match(result.sql, /AND body='# Vorherige Fassung/)
  assert.match(result.sql, /CHECK \(succeeded = 1\)/)
})

test('stale version aborts before existing relations or interpretation records are deleted', () => {
  const manifest = JSON.parse(readFileSync(canonicalManifest(), 'utf8'))
  const article = manifest.article_metadata[0]
  const previousBody = '# Vorherige Fassung\n\nUnveränderter Ausgangstext.'
  article.write_guard = {
    mode: 'update', expected_version: 4, expected_status: 'draft',
    expected_article_hash: `sha256:${createHash('sha256').update(previousBody).digest('hex')}`,
    expected_body: previousBody,
  }
  const dir = mkdtempSync(join(tmpdir(), 'stage2-import-'))
  const path = join(dir, 'manifest.json')
  writeFileSync(path, JSON.stringify(manifest))
  const { sql } = buildStage2Import({ manifestPath: path })
  const db = new DatabaseSync(':memory:')
  db.exec(`
    CREATE TABLE knowledge_articles (slug TEXT PRIMARY KEY, title TEXT, summary TEXT, body TEXT, status TEXT, reviewed_at TEXT, sources_json TEXT, created_at TEXT, updated_at TEXT, version INTEGER, conclusion TEXT, featured_image_r2_key TEXT, featured_image_url TEXT, dose_min REAL, dose_max REAL, dose_unit TEXT, product_note TEXT, article_layer TEXT);
    CREATE TABLE knowledge_article_sources (article_slug TEXT, label TEXT, url TEXT, sort_order INTEGER, created_at TEXT, updated_at TEXT);
    CREATE TABLE knowledge_article_ingredients (article_slug TEXT, ingredient_id INTEGER, sort_order INTEGER, created_at TEXT);
    CREATE TABLE study_interpretation_records (ingredient_id INTEGER, source_id INTEGER, research_artifact_id INTEGER, knowledge_article_slug TEXT, status TEXT, structured_summary_json TEXT, stage3_reference_summary TEXT, notes TEXT, review_notes TEXT, created_at TEXT, updated_at TEXT, version INTEGER);
    INSERT INTO knowledge_articles VALUES ('article-01','old','old','${previousBody.replaceAll("'", "''")}','draft',NULL,'{}','now','now',5,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'single_study');
    INSERT INTO knowledge_article_sources VALUES ('article-01','old source','https://example.org/old',0,'now','now');
    INSERT INTO knowledge_article_ingredients VALUES ('article-01',7,0,'now');
    INSERT INTO study_interpretation_records VALUES (7,999,NULL,'article-01','drafted','{}',NULL,NULL,NULL,'now','now',1);
  `)
  assert.throws(() => db.exec(sql), /CHECK constraint failed/)
  assert.equal(db.prepare("SELECT version FROM knowledge_articles WHERE slug='article-01'").get().version, 5)
  assert.equal(db.prepare("SELECT COUNT(*) AS count FROM knowledge_article_sources WHERE label='old source'").get().count, 1)
  assert.equal(db.prepare("SELECT COUNT(*) AS count FROM study_interpretation_records WHERE source_id=999").get().count, 1)
  db.close()
})

test('guarded create SQL executes and preserves exact accepted source relations', () => {
  const { sql } = buildStage2Import({ manifestPath: canonicalManifest() })
  const db = new DatabaseSync(':memory:')
  db.exec(`
    CREATE TABLE knowledge_articles (slug TEXT PRIMARY KEY, title TEXT, summary TEXT, body TEXT, status TEXT, reviewed_at TEXT, sources_json TEXT, created_at TEXT, updated_at TEXT, version INTEGER, conclusion TEXT, featured_image_r2_key TEXT, featured_image_url TEXT, dose_min REAL, dose_max REAL, dose_unit TEXT, product_note TEXT, article_layer TEXT);
    CREATE TABLE knowledge_article_sources (article_slug TEXT, label TEXT, url TEXT, sort_order INTEGER, created_at TEXT, updated_at TEXT);
    CREATE TABLE knowledge_article_ingredients (article_slug TEXT, ingredient_id INTEGER, sort_order INTEGER, created_at TEXT);
    CREATE TABLE study_interpretation_records (ingredient_id INTEGER, source_id INTEGER, research_artifact_id INTEGER, knowledge_article_slug TEXT, status TEXT, structured_summary_json TEXT, stage3_reference_summary TEXT, notes TEXT, review_notes TEXT, created_at TEXT, updated_at TEXT, version INTEGER);
  `)
  db.exec(sql)
  assert.deepEqual({ ...db.prepare("SELECT status, version, reviewed_at FROM knowledge_articles WHERE slug='article-01'").get() }, {
    status: 'published', version: 1, reviewed_at: '2026-07-13T13:02:00.000Z',
  })
  assert.equal(db.prepare("SELECT COUNT(*) AS count FROM knowledge_article_sources WHERE article_slug='article-01'").get().count, 2)
  assert.equal(db.prepare("SELECT COUNT(*) AS count FROM study_interpretation_records WHERE knowledge_article_slug='article-01' AND status='accepted'").get().count, 2)
  db.close()
})
