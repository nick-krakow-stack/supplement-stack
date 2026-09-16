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
// Shape of the completed 2026-09-14 SEO-only release: persisted public SEO,
// without compiled hashes or a reconstructed full-pipeline release.
const storedSeo = JSON.stringify({ canonical_url: 'https://example.test/wissen/teststoff', canonical_path: '/wissen/teststoff', robots: 'index,follow', indexable: true,
  json_ld: { '@context': 'https://schema.org', '@type': 'Article', headline: 'Alter Titel', description: 'Alte Einordnung.', mainEntityOfPage: 'https://example.test/wissen/teststoff', inLanguage: 'de', datePublished: stamp, dateModified: stamp,
    author: { '@type': 'Organization', '@id': 'https://example.test/#organization', name: 'Test', url: 'https://example.test/' }, publisher: { '@type': 'Organization', '@id': 'https://example.test/#organization', name: 'Test', url: 'https://example.test/' } },
  meta_title: 'Teststoff: Funktionen und Grenzen', meta_description: 'Eine verständliche Einordnung.' }, null, 2)
async function fixture(seoJson = null, legacyInterpretation = false, historicalReason = null) {
  const root = mkdtempSync(join(tmpdir(), 'authoritative-l-correction-'))
  const db = new DatabaseSync(':memory:')
  db.exec(`CREATE TABLE knowledge_articles(slug TEXT PRIMARY KEY,title TEXT,summary TEXT,body TEXT,status TEXT,reviewed_at TEXT,sources_json TEXT,created_at TEXT,updated_at TEXT,version INTEGER,conclusion TEXT,featured_image_r2_key TEXT,featured_image_url TEXT,dose_min REAL,dose_max REAL,dose_unit TEXT,product_note TEXT,article_layer TEXT,seo_json TEXT,update_reason TEXT);
    CREATE TABLE knowledge_article_sources(id INTEGER PRIMARY KEY,article_slug TEXT,label TEXT,url TEXT,sort_order INTEGER,created_at TEXT,updated_at TEXT);
    CREATE TABLE knowledge_article_ingredients(article_slug TEXT,ingredient_id INTEGER,sort_order INTEGER,created_at TEXT);
    CREATE TABLE study_interpretation_records(id INTEGER PRIMARY KEY,ingredient_id INTEGER,source_id INTEGER,research_artifact_id INTEGER,knowledge_article_slug TEXT,status TEXT,structured_summary_json TEXT,stage3_reference_summary TEXT,notes TEXT,review_notes TEXT,version INTEGER,created_at TEXT,updated_at TEXT);
    CREATE TABLE knowledge_article_parts(article_slug TEXT,ingredient_id INTEGER,part_id INTEGER);`)
  const row = { slug: 'teststoff', title: 'Alter Titel', summary: 'Alte Einordnung.', body: '## Einordnung\n\nAlter Text.', status: 'published', reviewed_at: stamp, sources_json: null, created_at: stamp, updated_at: stamp, version: 1, conclusion: 'Altes Fazit.', featured_image_r2_key: null, featured_image_url: null, dose_min: null, dose_max: null, dose_unit: null, product_note: null, article_layer: 'main_article', seo_json: null, update_reason: null }
  if (seoJson !== null) { row.seo_json = seoJson; row.version = 2 }
  if (historicalReason !== null) { row.update_reason = historicalReason; row.version = 3 }
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
  if (legacyInterpretation) {
    db.prepare('UPDATE knowledge_articles SET article_layer=? WHERE slug=?').run('single_study', row.slug)
    db.prepare('INSERT INTO study_interpretation_records VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)').run(638, 7, 1258, null, row.slug, 'accepted', '{ "old": true }', 'Original summary', 'manual notes', 'manual review notes', 1, stamp, stamp)
  }
  const identity = { article_id: row.slug, slug: row.slug, stage: legacyInterpretation ? 'stage2' : 'stage3', stage2_interpretation_projection: [] }
  const state = (await adapter.inspectArticlesByTargets([identity]))[row.slug]
  const full = (await adapter.readLegacyFieldCorrectionSnapshots([identity]))[row.slug]
  const before = hashed({ schema: 'article_correction_authoritative_before.v1', captured_at: stamp, read_only: true, database_id: 'test-db', database_name: 'test-target', article_id: row.slug, slug: row.slug, state, full_snapshot: full, expected_changed_row_count: 1, historical_compiled_lineage: null })
  const guard = { mode: 'update', expected_status: 'published', expected_version: row.version, expected_payload_hash: state.payload_hash }
  const target = { ...identity, change_class: 'L', target: 'test-target', write_guard: guard, authoritative_before: before, update_reason: 'Einordnung verständlicher erklärt.', desired_status: 'published', reviewed_at: stamp, published_at: stamp, modified_at: '2026-09-05T01:00:00.000Z',
    publish_payload: { ...state.publish_payload, title: 'Neuer Titel', body: '## Einordnung\n\nNeuer Text.' }, source_relations: [], source_projection: null, ingredient_ids: [7], assets: [], asset_hashes: [], compiled_payload_hash: canonicalJsonHash({ fixture: 'new-compiled' }), seo: null }
  if (legacyInterpretation) {
    const projection = { ingredient_id: 7, local_source_id: 'original-source', resolved_source_id: 1258, knowledge_article_slug: row.slug, status: 'accepted', structured_summary: { facts: 'new bound evidence' }, structured_summary_hash: canonicalJsonHash({ facts: 'new bound evidence' }), stage3_reference_summary: null, source_resolution_receipt_hash: canonicalJsonHash('source-receipt') }
    target.stage2_interpretation_projection = [{ ...projection, projection_hash: canonicalJsonHash(projection) }]
  }
  const release = { release_hash: canonicalJsonHash(target), publish_target: 'test-target', articles: [target] }
  return { root, db, adapter, before, target, release, guard, writes: () => writeBatches, snapshot: async () => (await adapter.readLegacyFieldCorrectionSnapshots([identity]))[row.slug], close() { db.close(); rmSync(root, { recursive: true, force: true }) } }

}

for (const seoJson of [null, storedSeo]) {
test(`historical update reason survives inspection, guarded apply and rollback (SEO=${seoJson !== null})`, async () => {
  const reason = 'Schreibfehler und beschädigte Umlaute korrigiert.'
  const f = await fixture(seoJson, false, reason)
  try {
    assert.equal(f.before.state.persistence_snapshot.article.update_reason, reason)
    assert.equal(f.before.state.version, 3)
    assert.equal(f.before.state.compiled_payload_hash, null)
    validateAuthoritativeCorrectionBeforeV1(f.before, f.target)
    const mismatched = structuredClone(f.before)
    mismatched.state.persistence_snapshot.article.update_reason = null
    assert.throws(() => validateAuthoritativeCorrectionBeforeV1(hashed(mismatched)), /raw article differs/)
    const tx = await f.adapter.applyAtomicRelease(f.release)
    assert.equal((await f.snapshot()).article.update_reason, f.target.update_reason)
    const writes = f.writes()
    assert.equal((await f.adapter.applyAtomicRelease(f.release)).decisions[0].result, 'already_current')
    assert.equal(f.writes(), writes)
    await f.adapter.rollbackAtomic(tx)
    assert.deepEqual(await f.snapshot(), f.before.full_snapshot)
    f.db.prepare('UPDATE knowledge_articles SET update_reason=? WHERE slug=?').run('Concurrent reason', f.target.slug)
    const writesBeforeGuard = f.writes()
    await assert.rejects(() => f.adapter.applyAtomicRelease(f.release), /changed since freeze|guard/i)
    assert.equal(f.writes(), writesBeforeGuard)
    assert.equal((await f.snapshot()).article.update_reason, 'Concurrent reason')
  } finally { f.close() }
})

test(`L raw-before input freezes actual legacy state without invented lineage (SEO=${seoJson !== null})`, async () => {
  const f = await fixture(seoJson)
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

test(`normal D1 L apply, noop and exact rollback (SEO=${seoJson !== null})`, async () => {
  const f = await fixture(seoJson)
  try {
    const transaction = await f.adapter.applyAtomicRelease(f.release)
    assert.equal((await f.snapshot()).article.version, f.before.state.version + 1)
    assert.equal((await f.snapshot()).article.update_reason, f.target.update_reason)
    assert.deepEqual((await f.snapshot()).part_rows, f.before.full_snapshot.part_rows)
    const writes = f.writes()
    assert.equal((await f.adapter.applyAtomicRelease(f.release)).decisions[0].result, 'already_current')
    assert.equal(f.writes(), writes)
    await f.adapter.rollbackAtomic(transaction)
    assert.deepEqual(await f.snapshot(), f.before.full_snapshot)
  } finally { f.close() }
})

test(`L raw-before blocks changed relations and rolls back postguard failure (SEO=${seoJson !== null})`, async () => {
  const f = await fixture(seoJson)
  try {
    // The pre-existing adapter fallback detects legacy rows by absent SEO.
    // SEO-bearing authoritative runs bind the snapshot through parent/child.
    if (seoJson === null) {
      const unbound = structuredClone(f.release); delete unbound.articles[0].authoritative_before
      await assert.rejects(() => f.adapter.applyAtomicRelease(unbound), /requires its authoritative-before/)
    }
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
}

test('SEO raw-before rejects malformed, mismatched, stale and compiled prestates without writes', async () => {
  const f = await fixture(storedSeo)
  try {
    validateAuthoritativeCorrectionBeforeV1(f.before, f.target)
    for (const raw of ['{bad', 'null', '[]', '"text"', '42', 42]) {
      const bad = structuredClone(f.before)
      bad.full_snapshot.article.seo_json = raw
      assert.throws(() => validateAuthoritativeCorrectionBeforeV1(hashed(bad)), /SEO|seo_json/)
    }
    const mismatch = structuredClone(f.before)
    mismatch.state.seo.meta_title = 'Andere Metadaten'
    assert.throws(() => validateAuthoritativeCorrectionBeforeV1(hashed(mismatch)), /SEO differs/)
    const stale = structuredClone(f.before)
    stale.full_snapshot.article.seo_json += ' '
    assert.throws(() => validateAuthoritativeCorrectionBeforeV1(stale), /content hash is stale/)
    assert.throws(() => validateAuthoritativeCorrectionBeforeV1(hashed(stale)), /raw article differs/)
    for (const mutate of [v => { v.state.compiled_payload_hash = canonicalJsonHash('compiled') }, v => { v.historical_compiled_lineage = {} }, v => { v.expected_changed_row_count = 2 }, v => { v.full_snapshot.article.status = 'draft' }, v => { v.state.version++ }]) {
      const bad = structuredClone(f.before); mutate(bad)
      assert.throws(() => validateAuthoritativeCorrectionBeforeV1(hashed(bad)))
    }
    const changedSeo = storedSeo.replace('Funktionen und Grenzen', 'Funktionen und Risiken')
    f.db.prepare('UPDATE knowledge_articles SET seo_json=? WHERE slug=?').run(changedSeo, f.target.slug)
    await assert.rejects(() => f.adapter.applyAtomicRelease(f.release), /changed since freeze|guard/i)
    assert.equal(f.writes(), 0)
    assert.equal((await f.snapshot()).article.seo_json, changedSeo)
  } finally { f.close() }
})


test('L adopts only its bound legacy interpretation in place, repeats as noop and restores every original byte', async () => {
  const f = await fixture(null, true)
  try {
    const tx = await f.adapter.applyAtomicRelease(f.release)
    const rows = (await f.snapshot()).interpretation_rows
    assert.equal(rows.length, 1)
    assert.equal(rows[0].id, 638)
    assert.equal(rows[0].version, 2)
    assert.equal(rows[0].created_at, stamp)
    assert.match(rows[0].notes, /^nutrient-content-v2:/)
    assert.equal(JSON.parse(rows[0].review_notes).source_resolution_receipt_hash, f.target.stage2_interpretation_projection[0].source_resolution_receipt_hash)
    const writes = f.writes()
    assert.equal((await f.adapter.applyAtomicRelease(f.release)).decisions[0].result, 'already_current')
    assert.equal(f.writes(), writes)
    await f.adapter.rollbackAtomic(tx)
    assert.deepEqual(await f.snapshot(), f.before.full_snapshot)
  } finally { f.close() }
})

for (const mutation of [
  "UPDATE study_interpretation_records SET version=2",
  "UPDATE study_interpretation_records SET notes='changed'",
  "UPDATE study_interpretation_records SET research_artifact_id=9",
  "INSERT INTO study_interpretation_records SELECT 639,ingredient_id,source_id,research_artifact_id,knowledge_article_slug,status,structured_summary_json,stage3_reference_summary,notes,review_notes,version,created_at,updated_at FROM study_interpretation_records",
  "INSERT INTO knowledge_article_parts VALUES ('teststoff',7,2)",
]) test(`legacy adoption rejects changed prestate: ${mutation}`, async () => {
  const f = await fixture(null, true)
  try {
    f.db.exec(mutation)
    const before = await f.snapshot()
    await assert.rejects(() => f.adapter.applyAtomicRelease(f.release), /conflicts|ambiguous|changed since freeze/)
    assert.equal(f.writes(), 0)
    assert.deepEqual(await f.snapshot(), before)
  } finally { f.close() }
})

test('legacy adoption blocks absent authority and atomic concurrent old-value/count changes', async () => {
  const f = await fixture(null, true)
  try {
    const unbound = structuredClone(f.release); delete unbound.articles[0].authoritative_before
    await assert.rejects(() => f.adapter.applyAtomicRelease(unbound), /conflicts with a non-pipeline-owned row/)
    const query = f.adapter.query
    f.adapter.query = async request => {
      if (request.batch.some(({ sql }) => /^(UPDATE|INSERT|DELETE)/.test(sql))) f.db.exec("UPDATE study_interpretation_records SET review_notes='concurrent change'")
      return query(request)
    }
    await assert.rejects(() => f.adapter.applyAtomicRelease(f.release), /malformed JSON/)
    assert.equal((await f.snapshot()).article.version, 1)
    assert.equal((await f.snapshot()).interpretation_rows[0].notes, 'manual notes')
  } finally { f.close() }
})

test('legacy adoption rollback rejects changed poststate without deleting the adopted row', async () => {
  const f = await fixture(null, true)
  try {
    const tx = await f.adapter.applyAtomicRelease(f.release)
    f.db.exec("UPDATE study_interpretation_records SET review_notes='concurrent change'")
    const before = await f.snapshot()
    await assert.rejects(() => f.adapter.rollbackAtomic(tx), /malformed JSON/)
    assert.deepEqual(await f.snapshot(), before)
  } finally { f.close() }
})


for (const mutation of ['version=3', "created_at='different'", 'research_artifact_id=9', 'id=639']) test(`adoption noop rejects changed retained identity: ${mutation}`, async () => {
  const f = await fixture(null, true)
  try {
    await f.adapter.applyAtomicRelease(f.release)
    f.db.exec(`UPDATE study_interpretation_records SET ${mutation}`)
    const writes = f.writes()
    await assert.rejects(() => f.adapter.applyAtomicRelease(f.release), /idempotent identity/)
    assert.equal(f.writes(), writes)
  } finally { f.close() }
})
