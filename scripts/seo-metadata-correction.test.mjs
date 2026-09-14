import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import test from 'node:test'
import { canonicalJsonHash } from './lib/content-validation.mjs'
import { knowledgeArticleHead, knowledgeMetadataText } from '../functions/lib/knowledge-seo.mjs'
import { buildSeoMetadataCorrectionInputV1, buildSeoMetadataCorrectionReviewOrderV1, buildSeoMetadataCorrectionReleaseV1, buildSeoMetadataCorrectionApplyOrderV1,
  sealSeoCorrectionArtifactV1 as seal, seoCorrectionSnapshotV1, currentSeoMetadataV1, projectSeoMetadataCorrectionV1, validateSeoMetadataCorrectionInputV1,
  validateSeoMetadataCorrectionReleaseV1, validateSeoCorrectionReadbackV1, SEO_CORRECTION_TABLES } from './lib/seo-metadata-correction-v1.mjs'
import { buildSeoMetadataCorrectionSqlV1 } from './lib/seo-metadata-correction-sql-v1.mjs'
import { CloudflareD1ContentPublicationAdapter, dispatchDeterministicWorkOrderV2 } from './lib/nutrient-content-machine-dispatcher.mjs'

const origin = 'https://supplementstack.de'
const stamp = '2026-09-14T10:00:00.000Z'
const rowsFrom = (db, table, order) => db.prepare(`SELECT * FROM ${table} ORDER BY ${order}`).all().map(row => ({ ...row }))
function observations(db, slugs) {
  return Object.fromEntries(slugs.map(slug => {
    const row = { ...db.prepare('SELECT * FROM knowledge_articles WHERE slug=?').get(slug) }
    const { seo_json, status, version, sources_json, ...data } = row
    assert.equal(status, 'published'); assert.ok(version); assert.ok(sources_json)
    const article = { ...data, sources: rowsFrom(db, 'knowledge_article_sources', 'id').filter(source => source.article_slug === slug),
      ingredients: [{ ingredient_id: 1, name: 'Teststoff' }], parts: [], related_articles: [], seo: seo_json ? JSON.parse(seo_json) : null }
    const head = knowledgeArticleHead(article), url = `${origin}/wissen/${slug}`
    const state = { url, http_status: 200, body_hash: canonicalJsonHash(article), h1: knowledgeMetadataText(row.title), title: head.title, description: head.description,
      canonical: head.canonicalUrl, robots: head.robots, json_ld: head.jsonLd, article_text: `${row.title}\n${row.summary}\n${row.body}\n${row.conclusion}`,
      links: article.sources.map(source => ({ label: source.label, url: source.url })) }
    return [slug, { api: { url: `${origin}/api/knowledge/${slug}`, http_status: 200, article }, raw_html: state, viewports: { desktop: state, mobile: state } }]
  }))
}
function fixture({ postguard = false } = {}) {
  const root = mkdtempSync(join(tmpdir(), 'seo-metadata-test-'))
  const db = new DatabaseSync(':memory:')
  db.exec(`CREATE TABLE knowledge_articles(slug TEXT PRIMARY KEY,title TEXT,summary TEXT,body TEXT,status TEXT,reviewed_at TEXT,sources_json TEXT,created_at TEXT,updated_at TEXT,version INTEGER,conclusion TEXT,article_layer TEXT,seo_json TEXT,update_reason TEXT,dose_min REAL,dose_max REAL,dose_unit TEXT,product_note TEXT,featured_image_url TEXT,featured_image_r2_key TEXT);
    CREATE TABLE knowledge_article_sources(id INTEGER PRIMARY KEY,article_slug TEXT,label TEXT,url TEXT,sort_order INTEGER,created_at TEXT,updated_at TEXT);
    CREATE INDEX article_source_index ON knowledge_article_sources(article_slug,sort_order,id);
    CREATE TABLE knowledge_article_ingredients(article_slug TEXT,ingredient_id INTEGER,sort_order INTEGER,created_at TEXT,PRIMARY KEY(article_slug,ingredient_id));
    CREATE TABLE study_interpretation_records(id INTEGER PRIMARY KEY,knowledge_article_slug TEXT,source_id INTEGER,status TEXT,notes TEXT);
    CREATE INDEX interpretation_article_index ON study_interpretation_records(knowledge_article_slug);
    CREATE TABLE knowledge_article_parts(article_slug TEXT,ingredient_id INTEGER,part_id INTEGER,sort_order INTEGER,created_at TEXT,PRIMARY KEY(article_slug,ingredient_id,part_id));
    CREATE TABLE knowledge_overview_projection_meta(id INTEGER PRIMARY KEY CHECK(id=1),source_version INTEGER,updated_at TEXT);
    INSERT INTO knowledge_overview_projection_meta VALUES(1,1,'2026-09-01 12:00:00');
    CREATE TRIGGER trg_knowledge_overview_articles_update AFTER UPDATE ON knowledge_articles BEGIN UPDATE knowledge_overview_projection_meta SET source_version=source_version+1,updated_at=datetime('now') WHERE id=1; END;`)
  for (let index = 1; index <= 3; index++) {
    const row = { slug: `teststoff-${index}`, title: `Unveränderter wissenschaftlicher Titel ${index}`, summary: `Eine unveränderte Zusammenfassung zur Untersuchung ${index}, mit wichtigen Grenzen.`,
      body: `## Grenzen\n\nKeine Empfehlung. Die Quelle ${index} untersuchte 100 mg über 12 Wochen.`, status: 'published', reviewed_at: null, sources_json: '[]',
      created_at: '2026-06-26 23:15:07', updated_at: '2026-07-04 11:22:33', version: index, conclusion: 'Die Übertragbarkeit ist begrenzt.', article_layer: 'single_study', seo_json: null,
      update_reason: 'Historischer Grund', dose_min: 1.5, dose_max: 10, dose_unit: 'µg', product_note: 'Originalnotiz', featured_image_url: null, featured_image_r2_key: null }
    if (index === 2) row.seo_json = projectSeoMetadataCorrectionV1(row, { meta_title: row.title, meta_description: row.summary })
    db.prepare(`INSERT INTO knowledge_articles(${Object.keys(row).join(',')}) VALUES(${Object.values(row).map(() => '?').join(',')})`).run(...Object.values(row))
    db.prepare('INSERT INTO knowledge_article_sources VALUES (?,?,?,?,?,?,?)').run(index, row.slug, `Originalquelle ${index}`, `https://example.test/${index}`, 0, stamp, stamp)
    db.prepare('INSERT INTO knowledge_article_ingredients VALUES (?,?,?,?)').run(row.slug, index, 0, stamp)
    db.prepare('INSERT INTO study_interpretation_records VALUES (?,?,?,?,?)').run(index, row.slug, index, 'accepted', 'Unveränderte Interpretation')
    db.prepare('INSERT INTO knowledge_article_parts VALUES (?,?,?,?,?)').run(row.slug, index, index, 0, stamp)
  }
  if (postguard) db.exec("CREATE TRIGGER test_postguard AFTER UPDATE ON knowledge_articles WHEN NEW.slug='teststoff-2' BEGIN UPDATE knowledge_articles SET updated_at='bad timestamp' WHERE slug=NEW.slug; END")
  const schemaRows = db.prepare("SELECT type,name,tbl_name,sql FROM sqlite_schema WHERE type IN ('table','index','trigger') ORDER BY name").all().map(row => ({ ...row }))
  const snapshotBase = { schema: 'published_article_metadata_prestate.v1', database_id: 'test-db', database_name: 'test-only', read_only: true }
  for (const entry of SEO_CORRECTION_TABLES) snapshotBase[entry.key === 'article' ? 'articles' : entry.key] = rowsFrom(db, entry.table, entry.order)
  const prestate = seal(snapshotBase)
  const proposals = prestate.articles.slice(0, 2).map(row => ({ slug: row.slug, expected_version: row.version, expected_status: row.status,
    before_article_hash: canonicalJsonHash(row), complete_prestate_hash: canonicalJsonHash(seoCorrectionSnapshotV1(prestate, row.slug)), before: currentSeoMetadataV1(row),
    after: { meta_title: `Untersuchung ${row.version}: Was wurde geprüft?`, meta_description: `Untersuchung ${row.version} verständlich erklärt: Was die Quelle betrachtet und welche Grenzen dabei bestehen.` },
    rationale: 'Konkrete Leserfrage, Grenzen bleiben erkennbar.', evidence: [{ field: 'summary', quote: row.summary }, { field: 'conclusion', quote: row.conclusion }] }))
  const proposal = seal({ schema: 'seo_metadata_correction_proposal.v1', editor_id: 'test-editor', created_at: stamp, before_snapshot_hash: prestate.content_hash,
    source_inventory_hash: canonicalJsonHash('test inventory'), proposals })
  const input = buildSeoMetadataCorrectionInputV1({ runId: 'seo-test', prestate, proposal, schemaRows })
  const reviewOrder = buildSeoMetadataCorrectionReviewOrderV1(input)
  const review = seal({ schema: 'seo_metadata_correction_review.v1', input_hash: input.content_hash, proposal_hash: proposal.content_hash,
    work_order_id: reviewOrder.work_order_id, result: 'PASS', reviewer: { id: 'test-independent-reviewer', role: 'seo-metadata-correction-reviewer' }, reviewed_at: stamp,
    articles: input.articles.map(target => ({ slug: target.slug, result: 'PASS', before_hash: target.before_hash, after_seo_hash: canonicalJsonHash(target.after_seo_json),
      reason: 'Testfixture: keine inhaltliche Freigabe realer Artikel.', checks: { supported_by_unchanged_article: 'PASS', limitations_preserved: 'PASS', no_new_claims_numbers_sources_or_advice: 'PASS', useful_distinct_metadata: 'PASS' } })) })
  const timing = seal({ schema: 'work_order_execution_receipt.v1', run_id: input.run_id, work_order_id: reviewOrder.work_order_id, execution_class: reviewOrder.execution_class,
    reasoning_tier: reviewOrder.reasoning_tier, executor: review.reviewer, started_at: stamp, finished_at: stamp, result: 'PASS', result_hash: review.content_hash })
  const publicBefore = seal({ schema: 'seo_metadata_correction_public_before.v1', input_hash: input.content_hash, checked_at: stamp,
    browser: { product: 'local-test-fixture-not-a-real-browser' }, snapshots: observations(db, input.articles.map(row => row.slug)) })
  const release = buildSeoMetadataCorrectionReleaseV1({ input, review, reviewWorkOrder: reviewOrder, reviewExecutionReceipt: timing, publicBefore })
  const releasePath = join(root, 'release.json')
  writeFileSync(releasePath, JSON.stringify(release))
  const workOrder = buildSeoMetadataCorrectionApplyOrderV1({ release, releasePath, receiptPath: 'receipt.json' })
  const adapter = new CloudflareD1ContentPublicationAdapter({ accountId: 'test-only', databaseId: 'test-db', apiToken: 'not-a-real-token', publicBaseUrl: `${origin}/` })
  const queryCalls = []
  adapter.query = async ({ batch }) => {
    queryCalls.push(batch)
    db.exec('BEGIN IMMEDIATE')
    try {
      const result = batch.map(({ sql, params = [] }) => ({ success: true, results: db.prepare(sql).all(...params).map(row => ({ ...row })) }))
      db.exec('COMMIT'); return { success: true, result }
    } catch (error) { db.exec('ROLLBACK'); throw error }
  }
  const observation = () => seal({ schema: 'seo_metadata_correction_readback.v1', release_hash: release.release_hash, checked_at: stamp,
    browser: publicBefore.browser, snapshots: observations(db, input.articles.map(row => row.slug)) })
  adapter.seoMetadataReadback = async () => observation()
  return { root, db, input, prestate, proposal, publicBefore, reviewOrder, review, timing, release, adapter, queryCalls, workOrder, observation,
    rebuild: overrides => buildSeoMetadataCorrectionReleaseV1({ input, review, reviewWorkOrder: reviewOrder, reviewExecutionReceipt: timing, publicBefore, ...overrides }),
    apply: () => dispatchDeterministicWorkOrderV2({ context: { root, runId: input.run_id }, workOrder, adapter, publishEnabled: true }),
    close: () => { db.close(); rmSync(root, { recursive: true, force: true }) } }
}

test('same publication_apply changes only SEO/version and preserves dates, all relations and existing Article schema', async () => {
  const f = fixture()
  try {
    const receipt = await f.apply()
    assert.equal(receipt.completion_state, 'COMPLETE'); assert.equal(receipt.seo_live_claim, true)
    assert.equal(receipt.cache_invalidation.source_version_increment, 2)
    assert.equal(receipt.cache_invalidation.after.source_version, receipt.cache_invalidation.before.source_version + 2)
    for (const target of f.input.articles) {
      const actual = { ...f.db.prepare('SELECT * FROM knowledge_articles WHERE slug=?').get(target.slug) }
      assert.deepEqual(actual, { ...target.before.article, seo_json: target.after_seo_json, version: target.before.article.version + 1 })
      for (const { key, table, column, order } of SEO_CORRECTION_TABLES.filter(entry => entry.key !== 'article')) assert.deepEqual(rowsFrom(f.db, table, order).filter(row => row[column] === target.slug), target.before[key])
      if (target.before.article.seo_json) assert.deepEqual(JSON.parse(actual.seo_json).json_ld, JSON.parse(target.before.article.seo_json).json_ld)
    }
    assert.deepEqual({ ...f.db.prepare("SELECT * FROM knowledge_articles WHERE slug='teststoff-3'").get() }, f.prestate.articles[2])
    const writes = f.queryCalls.filter(batch => batch.some(row => row.sql.startsWith('UPDATE')))
    assert.equal(writes.length, 1)
    const again = await f.apply()
    assert.equal(again.completion_state, 'COMPLETE'); assert.ok(again.article_results.every(row => row.changed_rows === 0))
    assert.equal(again.cache_invalidation.source_version_increment, 0)
    assert.equal(f.queryCalls.filter(batch => batch.some(row => row.sql.startsWith('UPDATE'))).length, 1)
    assert.equal(receipt.content_hash, seal(receipt).content_hash)
  } finally { f.close() }
})

test('missing, same-editor, stale and incomplete independent reviews cannot produce a release', () => {
  const f = fixture()
  try {
    assert.throws(() => f.rebuild({ review: null }), /schema\/hash/)
    assert.throws(() => f.rebuild({ review: seal({ ...f.review, reviewer: { ...f.review.reviewer, id: f.proposal.editor_id } }) }), /independent/)
    assert.throws(() => f.rebuild({ review: seal({ ...f.review, input_hash: canonicalJsonHash('stale') }) }), /binding/)
    assert.throws(() => f.rebuild({ review: seal({ ...f.review, articles: f.review.articles.slice(0, 1) }) }), /cover every/)
    assert.throws(() => f.rebuild({ reviewExecutionReceipt: seal({ ...f.timing, result_hash: canonicalJsonHash('wrong') }) }), /execution receipt/)
    assert.throws(() => f.rebuild({ reviewWorkOrder: { ...f.reviewOrder, reasoning_tier: 'standard' } }), /Order/)
    assert.throws(() => f.rebuild({ publicBefore: seal({ ...f.publicBefore, input_hash: canonicalJsonHash('wrong') }) }), /public before/)
  } finally { f.close() }
})

test('explicit publish and exact database/origin are required before any database access', async () => {
  const f = fixture()
  try {
    await assert.rejects(dispatchDeterministicWorkOrderV2({ context: { root: f.root, runId: f.input.run_id }, workOrder: f.workOrder, adapter: f.adapter }), /explicit publish/)
    f.adapter.databaseId = 'another-database'
    await assert.rejects(f.apply(), /database\/origin/)
    f.adapter.databaseId = 'test-db'; f.adapter.publicBaseUrl = 'https://another.example/'
    await assert.rejects(f.apply(), /database\/origin/)
    assert.equal(f.queryCalls.length, 0)
  } finally { f.close() }
})

test('tampered metadata, undeclared fields, altered evidence, UTF8/markup/length and duplicates fail', () => {
  const f = fixture()
  try {
    const changed = structuredClone(f.release); changed.input.articles[0].after_seo_json = '{}'
    assert.throws(() => validateSeoMetadataCorrectionReleaseV1(changed), /schema\/hash/)
    const illegal = seal({ ...f.input, arbitrary_write: true })
    assert.throws(() => validateSeoMetadataCorrectionInputV1(illegal), /fields/)
    for (const patch of [{ meta_title: 'zu kurz' }, { meta_title: 'Ein Titel mit <b>HTML</b>' }, { meta_title: 'Ungültiger Titel \uD800' }, { meta_description: 'x'.repeat(181) }, { body: 'Ungeprüfter Inhalt' }]) {
      assert.throws(() => projectSeoMetadataCorrectionV1(f.prestate.articles[0], { ...f.proposal.proposals[0].after, ...patch }), /plain UTF-8|fields/)
    }
    const proposal = structuredClone(f.proposal); proposal.proposals[0].evidence[0].quote = 'Nicht im Artikel'
    assert.throws(() => buildSeoMetadataCorrectionInputV1({ runId: 'seo-test', prestate: f.prestate, proposal: seal(proposal), schemaRows: f.input.schema_rows }), /evidence/)
    const duplicate = structuredClone(f.proposal); duplicate.proposals[1].after = duplicate.proposals[0].after
    assert.throws(() => buildSeoMetadataCorrectionInputV1({ runId: 'seo-test', prestate: f.prestate, proposal: seal(duplicate), schemaRows: f.input.schema_rows }), /duplicate/)
  } finally { f.close() }
})

for (const [name, mutation] of [
  ['body', "UPDATE knowledge_articles SET body='concurrent body' WHERE slug='teststoff-2'"],
  ['version', "UPDATE knowledge_articles SET version=version+1 WHERE slug='teststoff-2'"],
  ['source', "UPDATE knowledge_article_sources SET label='concurrent source' WHERE id=2"],
  ['interpretation', "UPDATE study_interpretation_records SET notes='concurrent facts' WHERE id=2"],
  ['part deletion', "DELETE FROM knowledge_article_parts WHERE article_slug='teststoff-2'"],
  ['new relation', "INSERT INTO knowledge_article_ingredients VALUES ('teststoff-2',99,0,'today')"],
  ['global metadata', "UPDATE knowledge_articles SET title='Different third title' WHERE slug='teststoff-3'"],
]) test(`fresh ${name} mismatch blocks all writes`, async () => {
  const f = fixture()
  try {
    f.db.exec(mutation)
    await assert.rejects(f.apply(), /differs|changed/)
    assert.equal(f.db.prepare("SELECT version FROM knowledge_articles WHERE slug='teststoff-1'").get().version, 1)
    assert.ok(!f.queryCalls.some(batch => batch.some(row => row.sql.startsWith('UPDATE'))))
  } finally { f.close() }
})

test('a race after fresh read and a postguard-trigger failure both roll back the entire multiarticle batch', async () => {
  for (const phase of ['race', 'postguard']) {
    const f = fixture({ postguard: phase === 'postguard' })
    try {
      if (phase === 'race') {
        const query = f.adapter.query
        f.adapter.query = async body => {
          if (body.batch.some(row => row.sql.startsWith('UPDATE'))) f.db.exec("UPDATE knowledge_article_sources SET label='raced' WHERE id=2")
          return query(body)
        }
      }
      await assert.rejects(f.apply(), /malformed JSON/)
      assert.equal(f.db.prepare("SELECT version FROM knowledge_articles WHERE slug='teststoff-1'").get().version, 1)
      assert.equal(f.db.prepare("SELECT version FROM knowledge_articles WHERE slug='teststoff-2'").get().version, 2)
      assert.equal(f.db.prepare("SELECT updated_at FROM knowledge_articles WHERE slug='teststoff-2'").get().updated_at, f.prestate.articles[1].updated_at)
    } finally { f.close() }
  }
})

test('new schema columns cannot be silently omitted from the frozen complete row', async () => {
  const f = fixture()
  try {
    f.db.exec('ALTER TABLE knowledge_articles ADD COLUMN new_sensitive_field TEXT')
    await assert.rejects(f.apply(), /schema\/trigger/)
    assert.equal(f.db.prepare("SELECT version FROM knowledge_articles WHERE slug='teststoff-1'").get().version, 1)
  } finally { f.close() }
})

test('missing or incomplete actual public readback stays honestly pending; retry is no-op and then complete', async () => {
  const f = fixture()
  try {
    f.adapter.seoMetadataReadback = null
    const pending = await f.apply()
    assert.equal(pending.completion_state, 'PUBLISHED_READBACK_PENDING'); assert.equal(pending.published, true); assert.equal(pending.seo_live_claim, false)
    assert.equal(pending.persistence.result, 'MATCH')
    assert.equal(JSON.parse(readFileSync(join(f.root, 'receipt.json'))).completion_state, pending.completion_state)
    const incomplete = f.observation(); delete incomplete.snapshots['teststoff-2']
    assert.throws(() => validateSeoCorrectionReadbackV1(seal(incomplete), f.release), /coverage/)
    f.adapter.seoMetadataReadback = async () => f.observation()
    const complete = await f.apply()
    assert.equal(complete.completion_state, 'COMPLETE'); assert.ok(complete.article_results.every(row => row.changed_rows === 0))
  } finally { f.close() }
})

test('stale or tampered existing receipt blocks a retry before database access', async () => {
  const f = fixture()
  try {
    await f.apply()
    const path = join(f.root, 'receipt.json'), valid = JSON.parse(readFileSync(path))
    for (const receipt of [{ ...valid, completion_state: 'fabricated' }, seal({ ...valid, release_hash: canonicalJsonHash('other release') })]) {
      writeFileSync(path, JSON.stringify(receipt))
      const calls = f.queryCalls.length
      await assert.rejects(f.apply(), /existing SEO publication receipt/)
      assert.equal(f.queryCalls.length, calls)
    }
  } finally { f.close() }
})

test('lost transport response records unknown outcome and recovers committed state without another write', async () => {
  const f = fixture()
  try {
    const query = f.adapter.query
    f.adapter.query = async body => {
      const result = await query(body)
      if (body.batch.some(row => row.sql.startsWith('UPDATE'))) throw new Error('test-only lost transport response')
      return result
    }
    await assert.rejects(f.apply(), /lost transport/)
    const unknown = JSON.parse(readFileSync(join(f.root, 'receipt.json')))
    assert.equal(unknown.completion_state, 'APPLY_OUTCOME_UNKNOWN'); assert.equal(unknown.published, null)
    f.adapter.query = query
    const completed = await f.apply()
    assert.equal(completed.completion_state, 'COMPLETE'); assert.ok(completed.article_results.every(row => row.changed_rows === 0))
  } finally { f.close() }
})

test('later pending and confirmed-unknown no-op retries retain the publication anchor and saved partial readbacks', async t => {
  t.mock.timers.enable({ apis: ['Date'], now: new Date('2026-09-14T10:01:00.000Z') })
  for (const initialState of ['pending', 'unknown']) {
    t.mock.timers.setTime(Date.parse('2026-09-14T10:01:00.000Z'))
    const f = fixture()
    try {
      const originalQuery = f.adapter.query
      if (initialState === 'unknown') {
        f.adapter.query = async body => {
          const result = await originalQuery(body)
          if (body.batch.some(row => row.sql.startsWith('UPDATE'))) throw new Error('test-only lost response')
          return result
        }
        await assert.rejects(f.apply(), /lost response/)
      } else {
        f.adapter.seoMetadataReadback = async () => { throw new Error('test-only interrupted collector') }
        assert.equal((await f.apply()).completion_state, 'PUBLISHED_READBACK_PENDING')
      }
      const initial = JSON.parse(readFileSync(join(f.root, 'receipt.json')))
      const saved = { checked_at: '2026-09-14T10:03:00.000Z', snapshot: f.observation().snapshots['teststoff-1'] }
      t.mock.timers.setTime(Date.parse('2026-09-14T10:11:00.000Z'))
      f.adapter.query = originalQuery
      f.adapter.seoMetadataReadback = async () => {
        const pending = JSON.parse(readFileSync(join(f.root, 'receipt.json')))
        // Same eligibility comparison used by the incremental real collector.
        assert.ok(Date.parse(saved.checked_at) >= Date.parse(pending.applied_at))
        const observed = f.observation()
        observed.checked_at = '2026-09-14T10:11:00.000Z'
        observed.snapshots['teststoff-1'] = saved.snapshot
        return seal(observed)
      }
      const completed = await f.apply()
      assert.equal(completed.completion_state, 'COMPLETE')
      assert.equal(completed.applied_at, initial.applied_at)
      assert.equal(completed.applied_at, '2026-09-14T10:01:00.000Z')
      assert.equal(completed.attempted_at, '2026-09-14T10:11:00.000Z')
      const snapshot = JSON.parse(readFileSync(completed.snapshot.path))
      assert.equal(snapshot.captured_at, completed.attempted_at)
      assert.ok(completed.article_results.every(row => row.changed_rows === 0))
      assert.equal(f.queryCalls.filter(batch => batch.some(row => row.sql.startsWith('UPDATE'))).length, 1)
    } finally { f.close() }
  }
})

test('public API, H1, source links, dates, canonical and mobile content mismatches cannot be called COMPLETE', async () => {
  const f = fixture()
  try {
    await f.apply()
    for (const mutate of [
      row => { row.api.article.body += ' unrelated claim' }, row => { row.api.article.reviewed_at = stamp },
      row => { row.raw_html.h1 = 'Different H1' }, row => { row.viewports.mobile.article_text = 'Different visible article' },
      row => { row.viewports.desktop.links = [] }, row => { row.raw_html.canonical = `${origin}/wrong` },
      row => { row.raw_html.json_ld = { '@type': 'Article', headline: 'Wrong' } },
    ]) {
      const bad = structuredClone(f.observation()); mutate(bad.snapshots['teststoff-1'])
      assert.throws(() => validateSeoCorrectionReadbackV1(seal(bad), f.release), /differs|changed/)
    }
  } finally { f.close() }
})

test('guard SELECTs use indexed identities and D1 statements remain within published limits', async () => {
  const f = fixture()
  try {
    const state = await f.adapter.readSeoMetadataCorrectionState(f.input.articles)
    const plan = buildSeoMetadataCorrectionSqlV1(f.release, state)
    assert.ok(plan.limits.maximum_sql_bytes < 100_000)
    assert.ok(plan.limits.maximum_bound_parameters <= 100)
    assert.ok(plan.limits.maximum_parameter_bytes < 2_000_000)
    for (const statement of plan.batch.filter(row => row.sql.includes('json_each(?) e WHERE NOT EXISTS') && !row.sql.includes('pragma_table_info') && !row.sql.includes('sqlite_schema'))) {
      const details = f.db.prepare(`EXPLAIN QUERY PLAN ${statement.sql}`).all(...statement.params).map(row => row.detail)
      assert.ok(details.some(detail => /SEARCH a USING (?:INTEGER PRIMARY KEY|INDEX|COVERING INDEX)/.test(detail)), details.join('\n'))
      assert.ok(!details.some(detail => /^SCAN a(?:\s|$)/.test(detail)), details.join('\n'))
    }
    for (const batch of f.queryCalls) for (const statement of batch.filter(row => row.sql.includes(' IN ('))) assert.ok((statement.params?.length ?? 0) <= 50)
  } finally { f.close() }
})
