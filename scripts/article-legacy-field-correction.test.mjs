import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import test from 'node:test'
import { canonicalJsonHash } from './lib/content-validation.mjs'
import { buildLegacyFieldCorrectionInputV1, buildLegacyFieldCorrectionReviewOrderV1, buildLegacyFieldCorrectionReleaseV1, buildLegacyFieldCorrectionApplyOrderV1, validateLegacyFieldCorrectionInputV1, normalizeLegacyCorrectionRowV1 } from './lib/article-correction-v1.mjs'
import { CloudflareD1ContentPublicationAdapter, dispatchDeterministicWorkOrderV2, validateLegacyCorrectionDomV1 } from './lib/nutrient-content-machine-dispatcher.mjs'

const stamp = '2026-09-05T00:00:00.000Z'
const hashed = value => ({ ...value, content_hash: canonicalJsonHash(value) })
function fixture() {
  const root = mkdtempSync(join(tmpdir(), 'legacy-field-correction-'))
  const db = new DatabaseSync(':memory:')
  db.exec(`CREATE TABLE knowledge_articles(slug TEXT PRIMARY KEY,title TEXT,summary TEXT,body TEXT,status TEXT,reviewed_at TEXT,sources_json TEXT,created_at TEXT,updated_at TEXT,version INTEGER,conclusion TEXT,article_layer TEXT,seo_json TEXT,update_reason TEXT);
    CREATE TABLE knowledge_article_sources(id INTEGER PRIMARY KEY,article_slug TEXT,label TEXT,url TEXT,sort_order INTEGER);
    CREATE TABLE knowledge_article_ingredients(article_slug TEXT,ingredient_id INTEGER,sort_order INTEGER);
    CREATE TABLE study_interpretation_records(id INTEGER PRIMARY KEY,knowledge_article_slug TEXT,source_id INTEGER,status TEXT);
    CREATE TABLE knowledge_article_parts(article_slug TEXT,ingredient_id INTEGER,part_id INTEGER);`)
  const row = { slug: 'teststoff', title: 'Unveränderter Titel', summary: 'Der K?rper.', body: '## Grenze\n\nEine Aussage mit 100 Mikrogramm.', status: 'published', reviewed_at: stamp, sources_json: '[]', created_at: stamp, updated_at: stamp, version: 1, conclusion: 'Unverändert.', article_layer: 'single_study', seo_json: null }
  db.prepare(`INSERT INTO knowledge_articles(${Object.keys(row).join(',')}) VALUES (${Object.keys(row).map(() => '?').join(',')})`).run(...Object.values(row))
  const sources = [{ id: 1, article_slug: row.slug, label: 'Originalquelle', url: 'https://example.test/original', sort_order: 0 }]
  const ingredients = [{ article_slug: row.slug, ingredient_id: 1, sort_order: 0 }]
  const interpretations = [{ id: 1, knowledge_article_slug: row.slug, source_id: 1, status: 'accepted' }]
  db.prepare('INSERT INTO knowledge_article_sources VALUES (?,?,?,?,?)').run(...Object.values(sources[0]))
  db.prepare('INSERT INTO knowledge_article_ingredients VALUES (?,?,?)').run(...Object.values(ingredients[0]))
  db.prepare('INSERT INTO study_interpretation_records VALUES (?,?,?,?)').run(...Object.values(interpretations[0]))
  const snapshot = { article: normalizeLegacyCorrectionRowV1(row), source_rows: sources, ingredient_rows: ingredients, interpretation_rows: interpretations, part_rows: [] }
  const prestate = hashed({ schema: 'article_ux_correction_prestate.v1', captured_at: stamp, database_id: 'test-db', database_name: 'test-target', read_only: true, articles: [row], sources, ingredients, interpretations })
  const fields = [{ field: 'summary', before: row.summary, after: 'Der Körper.', expected_before_hash: canonicalJsonHash(row.summary), expected_after_hash: canonicalJsonHash('Der Körper.') }]
  const candidate = { ...row, summary: fields[0].after }
  const proposal = hashed({ schema: 'article_spelling_correction_editor_proposal.v1', before_snapshot_hash: prestate.content_hash,
    proposals: [{ article_id: row.slug, slug: row.slug, requested_class: 'M', editor_id: 'editor-test', fields,
      guard: { expected_status: row.status, expected_version: 1, expected_article_layer: row.article_layer, expected_changed_row_count: 1, expected_row_hash: canonicalJsonHash(row),
        expected_unchanged_fields_hash: canonicalJsonHash(Object.fromEntries(Object.entries(row).filter(([key]) => key !== 'summary'))), expected_sources_hash: canonicalJsonHash(sources), expected_ingredients_hash: canonicalJsonHash(ingredients), expected_interpretations_hash: canonicalJsonHash(interpretations) },
      candidate_article_without_executor_metadata: candidate }] })
  const publicArticle = { ...row, sources: [], ingredients: [], parts: [], ingredient_ids: [1], seo: null }
  const publicBefore = { articles: [{ slug: row.slug, article: publicArticle, article_hash: canonicalJsonHash(publicArticle) }] }
  const input = buildLegacyFieldCorrectionInputV1({ runId: 'test-legacy-correction', prestate, proposal, authoritativeSnapshots: { [row.slug]: snapshot }, publicBefore, publicBaseUrl: 'https://example.test/', frozenAt: stamp })
  const reviewOrder = buildLegacyFieldCorrectionReviewOrderV1(input)
  const review = hashed({ schema: 'article_correction_review.v1', input_receipt_hash: input.content_hash, correction_result_hash: input.correction_result_hash, patch_hash: input.patch.patch_hash,
    reviewer: { id: 'independent-reviewer-test', role: 'article-correction-reviewer' }, reviewed_at: stamp, work_order_id: reviewOrder.work_order_id, result: 'PASS',
    checks: { changed_lines_and_neighbourhood: 'PASS', readability: 'PASS', no_system_language: 'PASS', unchanged_scientific_meaning: 'PASS' }, findings: [] })
  const reviewExecutionReceipt = hashed({ schema: 'work_order_execution_receipt.v1', run_id: input.run_id, work_order_id: reviewOrder.work_order_id,
    execution_class: reviewOrder.execution_class, reasoning_tier: reviewOrder.reasoning_tier, executor: review.reviewer,
    started_at: stamp, finished_at: stamp, result: 'PASS', result_hash: review.content_hash })
  const release = buildLegacyFieldCorrectionReleaseV1({ input, review, reviewWorkOrder: reviewOrder, reviewExecutionReceipt })
  const releasePath = join(root, 'release.json')
  writeFileSync(releasePath, `${JSON.stringify(release)}\n`)
  const order = buildLegacyFieldCorrectionApplyOrderV1({ release, releasePath, receiptPath: 'receipt.json' })
  const adapter = new CloudflareD1ContentPublicationAdapter({ accountId: 'test-account', databaseId: 'test-db', apiToken: 'test-only', publicBaseUrl: 'https://example.test/' })
  adapter.query = async ({ batch }) => {
    db.exec('BEGIN IMMEDIATE')
    try {
      const result = batch.map(({ sql, params = [] }) => ({ success: true, results: db.prepare(sql).all(...params) }))
      db.exec('COMMIT')
      return { success: true, result }
    } catch (error) { db.exec('ROLLBACK'); throw error }
  }
  adapter.readLegacyFieldCorrectionDom = async release => {
    const row = db.prepare('SELECT * FROM knowledge_articles WHERE slug=?').get(release.articles[0].slug)
    const publicUrl = `https://example.test/wissen/${row.slug}`
    const state = { text: `${row.title} ${row.summary} Grenze Eine Aussage mit 100 Mikrogramm.`, h1: row.title, title: row.title, description: row.summary,
      canonical: publicUrl, robots: 'index,follow', json_ld: [{ '@type': 'Article', mainEntityOfPage: publicUrl, headline: row.title, description: row.summary, datePublished: row.created_at, dateModified: row.updated_at }], links: [] }
    return hashed({ schema: 'legacy_article_dom_readback.v1', release_hash: release.release_hash, browser: { product: 'test-fixture-only' }, checked_at: new Date().toISOString(), article_results: [{ article_id: row.slug, public_url: publicUrl,
      raw_html: { ...state, http_status: 200, content_type: 'text/html', body_hash: canonicalJsonHash(state) }, viewports: { desktop: state, mobile: state } }] })
  }
  const previousFetch = globalThis.fetch
  globalThis.fetch = async () => new Response(JSON.stringify({ article: { ...publicArticle, ...db.prepare('SELECT * FROM knowledge_articles WHERE slug=?').get(row.slug) } }), { headers: { 'Content-Type': 'application/json' } })
  return { root, db, input, review, reviewOrder, reviewExecutionReceipt, release, adapter, order, prestate, proposal, publicBefore, snapshot,
    apply: () => dispatchDeterministicWorkOrderV2({ context: { root, runId: input.run_id }, workOrder: order, adapter, publishEnabled: true }),
    close: () => { globalThis.fetch = previousFetch; db.close(); rmSync(root, { recursive: true, force: true }) } }
}

test('legacy M publishes through the same executor with exact snapshots and an idempotent no-op', async () => {
  const f = fixture()
  try {
    const receipt = await f.apply()
    assert.equal(receipt.schema, 'content_publish_receipt.v2')
    assert.equal(receipt.mode, 'legacy_field_patch')
    assert.equal(receipt.article_results[0].changed_rows, 1)
    assert.equal(receipt.article_results[0].readbacks.public_api.result, 'MATCH')
    assert.equal(receipt.target_dom_seo.result, 'MATCH')
    const { content_hash: domHash, ...domBody } = receipt.target_dom_seo
    assert.equal(domHash, canonicalJsonHash(domBody))
    assert.equal(receipt.completion_state, 'COMPLETE')
    assert.equal(JSON.parse(readFileSync(receipt.snapshot.path, 'utf8')).snapshots.teststoff.article.summary, 'Der K?rper.')
    const first = f.db.prepare('SELECT * FROM knowledge_articles').get()
    assert.equal(first.version, 2)
    assert.equal(first.update_reason, 'Schreibfehler und beschädigte Umlaute korrigiert.')
    assert.equal(first.body, f.input.articles[0].before.article.body)
    const second = await f.apply()
    assert.equal(second.article_results[0].result, 'already_current')
    assert.equal(second.article_results[0].changed_rows, 0)
    assert.deepEqual(f.db.prepare('SELECT * FROM knowledge_articles').get(), first)
  } finally { f.close() }
})

test('legacy mode rejects changed class, hidden full-row writes and a non-independent reviewer', () => {
  const f = fixture()
  try {
    const { content_hash: ignored, ...base } = f.input
    assert.throws(() => validateLegacyFieldCorrectionInputV1(hashed({ ...base, change_class: 'L' })), /class/)
    const altered = structuredClone(base)
    altered.articles[0].candidate_row.body = 'Ungeprüfte neue Aussage.'
    altered.articles[0].candidate_row_hash = canonicalJsonHash(altered.articles[0].candidate_row)
    assert.throws(() => validateLegacyFieldCorrectionInputV1(hashed(altered)), /candidate differs/)
    const { content_hash: oldHash, ...review } = f.review
    assert.throws(() => buildLegacyFieldCorrectionReleaseV1({ input: f.input, review: hashed({ ...review, reviewer: { ...review.reviewer, id: f.input.editor.id } }), reviewWorkOrder: f.reviewOrder, reviewExecutionReceipt: f.reviewExecutionReceipt }), /independent/)
    assert.throws(() => buildLegacyFieldCorrectionReleaseV1({ input: f.input, review: f.review, reviewWorkOrder: f.reviewOrder }), /execution receipt/)
    const { content_hash: timingHash, ...timing } = f.reviewExecutionReceipt
    assert.throws(() => buildLegacyFieldCorrectionReleaseV1({ input: f.input, review: f.review, reviewWorkOrder: f.reviewOrder, reviewExecutionReceipt: hashed({ ...timing, result_hash: canonicalJsonHash('wrong') }) }), /execution receipt/)
    assert.ok(timingHash)
    assert.ok(ignored && oldHash)
  } finally { f.close() }
})

test('legacy post-publish DOM failure records committed pending state and retries without another write', async () => {
  const f = fixture()
  try {
    const readDom = f.adapter.readLegacyFieldCorrectionDom
    f.adapter.readLegacyFieldCorrectionDom = async () => { throw new Error('Browser unavailable') }
    await assert.rejects(f.apply(), /Browser unavailable/)
    const pending = JSON.parse(readFileSync(join(f.root, 'receipt.json'), 'utf8'))
    assert.equal(pending.completion_state, 'PUBLISHED_READBACK_PENDING')
    assert.equal(pending.atomic_batch.result, 'COMMITTED')
    assert.equal(f.db.prepare('SELECT version FROM knowledge_articles').get().version, 2)
    f.adapter.readLegacyFieldCorrectionDom = readDom
    const receipt = await f.apply()
    assert.equal(receipt.completion_state, 'COMPLETE')
    assert.equal(receipt.article_results[0].changed_rows, 0)
    const observation = await readDom(f.release)
    const after = await f.adapter.readLegacyFieldCorrectionSnapshots(f.release.articles)
    observation.article_results[0].viewports.mobile = { ...observation.article_results[0].viewports.mobile, text: 'Missing body' }
    delete observation.content_hash
    observation.content_hash = canonicalJsonHash(observation)
    assert.throws(() => validateLegacyCorrectionDomV1(observation, f.release, after), /mobile visible content/)
  } finally { f.close() }
})

test('legacy atomic write rejects changed source/part rows and rolls back a relation race', async () => {
  for (const mutation of [
    "UPDATE knowledge_article_sources SET label='Geändert' WHERE id=1",
    "INSERT INTO knowledge_article_parts VALUES ('teststoff',1,2)",
  ]) {
    const f = fixture()
    try {
      f.db.exec(mutation)
      await assert.rejects(f.apply(), /prestate\/version\/status\/relations differs/)
      assert.equal(f.db.prepare('SELECT version FROM knowledge_articles').get().version, 1)
    } finally { f.close() }
  }
  const f = fixture()
  try {
    f.db.exec("CREATE TRIGGER concurrent_change AFTER UPDATE ON knowledge_articles BEGIN UPDATE knowledge_article_sources SET label='Changed by trigger' WHERE id=1; END")
    await assert.rejects(f.apply(), /malformed JSON/)
    assert.equal(f.db.prepare('SELECT version FROM knowledge_articles').get().version, 1)
    assert.equal(f.db.prepare('SELECT label FROM knowledge_article_sources').get().label, 'Originalquelle')
  } finally { f.close() }
})

test('legacy mode fails closed without explicit publish and on wrong destination', async () => {
  const f = fixture()
  try {
    await assert.rejects(dispatchDeterministicWorkOrderV2({ context: { root: f.root, runId: f.input.run_id }, workOrder: f.order, adapter: f.adapter }), /disabled/)
    f.adapter.databaseId = 'another-db'
    await assert.rejects(f.apply(), /target\/origin differs/)
    assert.equal(f.db.prepare('SELECT version FROM knowledge_articles').get().version, 1)
  } finally { f.close() }
})

test('legacy two-article SQL batch rolls back the first update when the second target postguard fails', async () => {
  const f = fixture()
  try {
    const second = JSON.parse(JSON.stringify(f.input.articles[0]).replaceAll('teststoff', 'zweiterstoff'))
    second.before.source_rows[0].id = 2
    second.before.interpretation_rows[0].id = 2
    second.before.interpretation_rows[0].source_id = 2
    second.before_hash = canonicalJsonHash(second.before)
    second.candidate_row_hash = canonicalJsonHash(second.candidate_row)
    second.public_before_hash = canonicalJsonHash(second.public_before)
    for (const [table, rows] of [['knowledge_articles', [second.before.article]], ['knowledge_article_sources', second.before.source_rows], ['knowledge_article_ingredients', second.before.ingredient_rows], ['study_interpretation_records', second.before.interpretation_rows]]) {
      for (const row of rows) f.db.prepare(`INSERT INTO ${table}(${Object.keys(row).join(',')}) VALUES (${Object.keys(row).map(() => '?').join(',')})`).run(...Object.values(row))
    }
    const { content_hash: ignoredInputHash, ...base } = f.input
    const articles = [...base.articles, second]
    const input = hashed({ ...base, articles, expected_article_count: 2, affected_article_ids: articles.map(x => x.article_id), patch: { patch_hash: canonicalJsonHash(articles.map(({ article_id, fields }) => ({ article_id, fields }))) } })
    const reviewOrder = buildLegacyFieldCorrectionReviewOrderV1(input)
    const { content_hash: ignoredReviewHash, ...reviewBase } = f.review
    const review = hashed({ ...reviewBase, input_receipt_hash: input.content_hash, patch_hash: input.patch.patch_hash, work_order_id: reviewOrder.work_order_id })
    const { content_hash: ignoredTimingHash, ...timingBase } = f.reviewExecutionReceipt
    const timing = hashed({ ...timingBase, work_order_id: reviewOrder.work_order_id, result_hash: review.content_hash })
    const release = buildLegacyFieldCorrectionReleaseV1({ input, review, reviewWorkOrder: reviewOrder, reviewExecutionReceipt: timing })
    const releasePath = join(f.root, 'two-release.json')
    writeFileSync(releasePath, JSON.stringify(release))
    const order = buildLegacyFieldCorrectionApplyOrderV1({ release, releasePath, receiptPath: 'two-receipt.json' })
    f.db.exec("CREATE TRIGGER second_postguard_failure AFTER UPDATE ON knowledge_articles WHEN NEW.slug='zweiterstoff' BEGIN UPDATE knowledge_article_sources SET label='race' WHERE article_slug='zweiterstoff'; END")
    await assert.rejects(dispatchDeterministicWorkOrderV2({ context: { root: f.root, runId: input.run_id }, workOrder: order, adapter: f.adapter, publishEnabled: true }), /malformed JSON/)
    assert.deepEqual(f.db.prepare('SELECT version FROM knowledge_articles ORDER BY slug').all().map(row => row.version), [1, 1])
    assert.equal(f.db.prepare("SELECT label FROM knowledge_article_sources WHERE id=2").get().label, 'Originalquelle')
    assert.ok(ignoredInputHash && ignoredReviewHash && ignoredTimingHash)
  } finally { f.close() }
})

test('legacy DOM treats actual SQLite publication timestamps as UTC in Europe/Berlin', async () => {
  const f = fixture()
  const oldTimezone = process.env.TZ
  try {
    process.env.TZ = 'Europe/Berlin'
    await f.apply()
    const after = await f.adapter.readLegacyFieldCorrectionSnapshots(f.release.articles)
    const observation = await f.adapter.readLegacyFieldCorrectionDom(f.release)
    after.teststoff.article.created_at = '2026-06-26 23:15:07'
    for (const state of [observation.article_results[0].raw_html, ...Object.values(observation.article_results[0].viewports)]) state.json_ld[0].datePublished = '2026-06-26T23:15:07.000Z'
    delete observation.content_hash
    observation.content_hash = canonicalJsonHash(observation)
    assert.equal(validateLegacyCorrectionDomV1(observation, f.release, after).result, 'MATCH')
  } finally { if (oldTimezone === undefined) delete process.env.TZ; else process.env.TZ = oldTimezone; f.close() }
})
