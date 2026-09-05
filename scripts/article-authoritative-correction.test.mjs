import assert from 'node:assert/strict'
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import test from 'node:test'
import { canonicalJsonHash } from './lib/content-validation.mjs'
import { artifactHashV2 } from './lib/evidence-pipeline-v2.mjs'
import { buildArticleCorrectionInputReceiptV1, loadArticleCorrectionInputReceiptV1, validateAuthoritativeCorrectionBeforeV1 } from './lib/article-correction-v1.mjs'
import { CloudflareD1ContentPublicationAdapter } from './lib/nutrient-content-machine-dispatcher.mjs'
import { loadNutrientContentRunManifest, runNutrientContent } from './lib/nutrient-content-runner.mjs'

const stamp = '2026-09-05T00:00:00.000Z'
const hashed = value => ({ ...value, content_hash: artifactHashV2(value) })
async function fixture() {
  const root = mkdtempSync(join(tmpdir(), 'authoritative-l-correction-'))
  const db = new DatabaseSync(':memory:')
  db.exec(`CREATE TABLE knowledge_articles(slug TEXT PRIMARY KEY,title TEXT,summary TEXT,body TEXT,status TEXT,reviewed_at TEXT,sources_json TEXT,created_at TEXT,updated_at TEXT,version INTEGER,conclusion TEXT,featured_image_r2_key TEXT,featured_image_url TEXT,dose_min REAL,dose_max REAL,dose_unit TEXT,product_note TEXT,article_layer TEXT,seo_json TEXT,update_reason TEXT);
    CREATE TABLE knowledge_article_sources(id INTEGER PRIMARY KEY,article_slug TEXT,label TEXT,url TEXT,sort_order INTEGER,created_at TEXT,updated_at TEXT);
    CREATE TABLE knowledge_article_ingredients(article_slug TEXT,ingredient_id INTEGER,sort_order INTEGER,created_at TEXT);
    CREATE TABLE study_interpretation_records(id INTEGER PRIMARY KEY,ingredient_id INTEGER,source_id INTEGER,research_artifact_id INTEGER,knowledge_article_slug TEXT,status TEXT,structured_summary_json TEXT,stage3_reference_summary TEXT,notes TEXT,review_notes TEXT,version INTEGER,created_at TEXT,updated_at TEXT);
    CREATE TABLE knowledge_article_parts(article_slug TEXT,ingredient_id INTEGER,part_id INTEGER);`)
  const row = { slug: 'teststoff', title: 'Alter Titel', summary: 'Alte Einordnung.', body: '## Einordnung\n\nAlter Text.', status: 'published', reviewed_at: stamp, sources_json: null, created_at: stamp, updated_at: stamp, version: 1, conclusion: 'Altes Fazit.', featured_image_r2_key: null, featured_image_url: null, dose_min: null, dose_max: null, dose_unit: null, product_note: null, article_layer: 'main_article', seo_json: null, update_reason: null }
  db.prepare(`INSERT INTO knowledge_articles(${Object.keys(row).join(',')}) VALUES (${Object.keys(row).map(() => '?').join(',')})`).run(...Object.values(row))
  db.prepare('INSERT INTO knowledge_article_ingredients VALUES (?,?,?,?)').run(row.slug, 7, 0, stamp)
  db.prepare('INSERT INTO knowledge_article_parts VALUES (?,?,?)').run(row.slug, 7, 1)
  const adapter = new CloudflareD1ContentPublicationAdapter({ accountId: 'test', databaseId: 'test-db', apiToken: 'test-only', publicBaseUrl: 'https://example.test/' })
  let writeBatches = 0
  adapter.query = async ({ batch }) => {
    if (batch.some(({ sql }) => /^(UPDATE|INSERT|DELETE)/.test(sql))) writeBatches++
    db.exec('BEGIN IMMEDIATE')
    try { const result = batch.map(({ sql, params = [] }) => ({ results: db.prepare(sql).all(...params), success: true })); db.exec('COMMIT'); return { success: true, result } }
    catch (error) { db.exec('ROLLBACK'); throw error }
  }
  const identity = { article_id: row.slug, slug: row.slug, stage: 'stage3', stage2_interpretation_projection: [] }
  const state = (await adapter.inspectArticlesByTargets([identity]))[row.slug]
  const full = (await adapter.readLegacyFieldCorrectionSnapshots([identity]))[row.slug]
  const before = hashed({ schema: 'article_correction_authoritative_before.v1', captured_at: stamp, read_only: true, database_id: 'test-db', database_name: 'test-target', article_id: row.slug, slug: row.slug, state, full_snapshot: full, expected_changed_row_count: 1, historical_compiled_lineage: null })
  const guard = { mode: 'update', expected_status: 'published', expected_version: 1, expected_payload_hash: state.payload_hash }
  const target = { ...identity, change_class: 'L', target: 'test-target', write_guard: guard, authoritative_before: before, update_reason: 'Einordnung verständlicher erklärt.', desired_status: 'published', reviewed_at: stamp, published_at: stamp, modified_at: '2026-09-05T01:00:00.000Z',
    publish_payload: { ...state.publish_payload, title: 'Neuer Titel', body: '## Einordnung\n\nNeuer Text.' }, source_relations: [], source_projection: null, ingredient_ids: [7], assets: [], asset_hashes: [], compiled_payload_hash: canonicalJsonHash({ fixture: 'new-compiled' }), seo: null }
  const release = { release_hash: canonicalJsonHash(target), publish_target: 'test-target', articles: [target] }
  return { root, db, adapter, before, target, release, guard, writes: () => writeBatches, snapshot: async () => (await adapter.readLegacyFieldCorrectionSnapshots([identity]))[row.slug], close() { db.close(); rmSync(root, { recursive: true, force: true }) } }

}

test('L raw-before input freezes actual legacy state without inventing any prior or candidate v2 lineage', async () => {
  const f = await fixture()
  try {
    const put = (name, value) => writeFileSync(join(f.root, name), JSON.stringify(value))
    put('before.json', f.before)
    const request = { schema: 'article_correction_request.v1', run_id: 'correction-test', change_class: 'L', before: { authoritative_snapshot_path: 'before.json' } }
    const receipt = buildArticleCorrectionInputReceiptV1({ root: f.root, request, frozenAt: stamp })
    assert.equal(receipt.mode, 'authoritative_before'); assert.equal(receipt.candidate, undefined); assert.equal(receipt.before.release_article, undefined)
    put('input.json', receipt)
    const loaded = loadArticleCorrectionInputReceiptV1({ root: f.root, path: join(f.root, 'input.json'), runId: request.run_id, changeClass: 'L' })
    assert.deepEqual(loaded.candidateArticle.write_guard, f.guard)
    assert.throws(() => buildArticleCorrectionInputReceiptV1({ root: f.root, request: { ...request, change_class: 'M' } }), /L-only/)
    assert.throws(() => buildArticleCorrectionInputReceiptV1({ root: f.root, request: { ...request, candidate: {} } }), /cannot invent/)
    const parent = { schema: 'nutrient_content_run.v2', operation: 'article_correction', mode: 'test', run_id: request.run_id, substance: { slug: 'teststoff', language: 'de' }, policy: { version: 'v2' }, render_profile: 'knowledge_magazine_v1', outputs: { state_dir: 'parent-state' }, correction: { change_class: 'L', input_receipt_path: 'input.json', affected_pipeline_manifest_path: 'child.json' }, publish: { required: true, target: 'test-target', public_base_url: 'https://example.test/' } }
    const child = { ...parent, operation: 'full_pipeline', run_id: 'child-test', ingredient_target: { canonical_name: 'Teststoff', expected_ingredient_id: 7 }, inputs: { research_path: 'research.md', coverage_plan_path: 'coverage.json', evidence_build_manifest_path: 'evidence.json', link_inventory_source_path: 'links.json', source_artifact_receipt_path: 'sources.json' }, outputs: { state_dir: 'child-state', evidence_dir: 'evidence' }, article_plan: { stage2: [], stage3: [{ article_id: 'teststoff', slug: 'teststoff', change_class: 'L', markdown_path: 'future-writer.md', write_guard: f.guard, authoritative_before: { path: 'before.json', content_hash: f.before.content_hash, update_reason: f.target.update_reason } }] }, stage4: { enabled: false } }
    put('parent.json', parent); put('child.json', child)
    assert.equal(loadNutrientContentRunManifest(join(f.root, 'parent.json')).correction.input.authoritativeBefore.content_hash, f.before.content_hash)
    assert.equal(loadNutrientContentRunManifest(join(f.root, 'child.json')).articles.all[0].authoritative_before.content_hash, f.before.content_hash)
    delete child.article_plan.stage3[0].authoritative_before; put('child.json', child)
    assert.throws(() => runNutrientContent({ manifestPath: join(f.root, 'parent.json') }), /exact authoritative before/)
    const wrong = structuredClone(f.before); delete wrong.full_snapshot.article.body
    assert.throws(() => validateAuthoritativeCorrectionBeforeV1(hashed(wrong)), /incomplete/)
    put('before.json', hashed({ ...f.before, expected_changed_row_count: 2 }))
    assert.throws(() => loadArticleCorrectionInputReceiptV1({ root: f.root, path: join(f.root, 'input.json'), runId: request.run_id, changeClass: 'L' }), /count/)
  } finally { f.close() }
})

test('normal D1 L apply guards full raw state, updates once, preserves parts, and restores the exact prestate on rollback', async () => {
  const f = await fixture()
  try {
    const transaction = await f.adapter.applyAtomicRelease(f.release)
    assert.equal((await f.snapshot()).article.version, 2)
    assert.equal((await f.snapshot()).article.update_reason, f.target.update_reason)
    assert.deepEqual((await f.snapshot()).part_rows, f.before.full_snapshot.part_rows)
    const writes = f.writes()
    assert.equal((await f.adapter.applyAtomicRelease(f.release)).decisions[0].result, 'already_current')
    assert.equal(f.writes(), writes)
    await f.adapter.rollbackAtomic(transaction)
    assert.deepEqual(await f.snapshot(), f.before.full_snapshot)
  } finally { f.close() }
})

test('L raw-before blocks changed relations and a postguard failure atomically rolls back article and part writes', async () => {
  const f = await fixture()
  try {
    const unbound = structuredClone(f.release); delete unbound.articles[0].authoritative_before
    await assert.rejects(() => f.adapter.applyAtomicRelease(unbound), /requires its authoritative-before/)
    assert.equal(f.writes(), 0)
    f.db.exec("INSERT INTO knowledge_article_parts VALUES ('teststoff',7,2)")
    await assert.rejects(() => f.adapter.applyAtomicRelease(f.release), /changed since freeze/)
    assert.equal(f.writes(), 0)
    f.db.exec('DELETE FROM knowledge_article_parts WHERE part_id=2')
    f.db.exec("CREATE TRIGGER modify_parts AFTER UPDATE OF title ON knowledge_articles BEGIN INSERT INTO knowledge_article_parts VALUES ('teststoff',7,2); END")
    await assert.rejects(() => f.adapter.applyAtomicRelease(f.release), /malformed JSON/)
    assert.deepEqual(await f.snapshot(), f.before.full_snapshot)
  } finally { f.close() }
})
