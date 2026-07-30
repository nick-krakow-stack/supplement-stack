import assert from 'node:assert/strict'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import { canonicalJsonHash, sha256Bytes } from './lib/content-validation.mjs'
import { artifactHashV2 } from './lib/evidence-pipeline-v2.mjs'
import { validatePublishReceiptV2 } from './lib/article-runtime-v2.mjs'
import {
  CloudflareD1ContentPublicationAdapter,
  SqliteContentPublicationAdapter,
  activateFrameworkCatalogV1,
  applyContentReleaseV2,
  buildRendererPublicReadbackRequestV2,
  clearRendererPublicReadbackReceiptV2,
  exportSiteLinkInventorySourceV2,
  finalizeRendererPublicReadbackV2,
  readArticleTargetsV1,
  publicationGuardPayloadHash,
  rendererPublicReadbackTimeoutMs,
  runRendererPublicReadbackV2,
  validateContentReleaseForApplyV2,
  validateRendererPublicReadbackReceiptV2,
} from './lib/nutrient-content-machine-dispatcher.mjs'

function hash(label) { return canonicalJsonHash({ label }) }

test('renderer public readback timeout scales with release size and remains bounded', () => {
  assert.equal(rendererPublicReadbackTimeoutMs(1), 120_000)
  assert.equal(rendererPublicReadbackTimeoutMs(10), 120_000)
  assert.equal(rendererPublicReadbackTimeoutMs(35), 420_000)
  assert.equal(rendererPublicReadbackTimeoutMs(1000), 900_000)
})

test('source catalog deterministically reuses the oldest exact locator duplicate but rejects conflicting locator matches', () => {
  const adapter = new SqliteContentPublicationAdapter()
  const request = {
    ingredient_id: INGREDIENT_ID,
    sources: [{ source_id: 'source-exact-duplicate', source_kind: 'official', label: 'Institution (2024). Titel. Publisher.', canonical_url: 'https://example.test/source', doi: null, pubmed_id: null }],
  }
  try {
    adapter.seedIngredient({ id: INGREDIENT_ID, name: 'Teststoff' })
    for (const [id, title] of [[41, 'Older title'], [42, 'Newer title']]) {
      adapter.database.prepare('INSERT INTO ingredient_research_sources (id,ingredient_id,source_kind,source_title,source_url,doi,pubmed_id,version,created_at,updated_at) VALUES (?,?,?,?,?,?,?,1,?,?)').run(id, INGREDIENT_ID, 'official', title, request.sources[0].canonical_url, null, null, '2026-07-18T00:00:00.000Z', '2026-07-18T00:00:00.000Z')
    }
    assert.equal(adapter.syncSourceCatalog(request)[0].resolved_source_id, 41)
    adapter.database.prepare('UPDATE ingredient_research_sources SET doi=? WHERE id=?').run('10.1000/conflict', 42)
    assert.throws(() => adapter.syncSourceCatalog(request), /resolves ambiguously in SQLite/)
  } finally { adapter.close() }
})

test('source catalog treats URL variants as aliases only when DOI and PMID identities are exact', () => {
  const adapter = new SqliteContentPublicationAdapter()
  const request = {
    ingredient_id: INGREDIENT_ID,
    sources: [{ source_id: 'source-strong-identifiers', source_kind: 'study', label: 'Autor (2022). Titel. Journal.', canonical_url: 'https://doi.org/10.1000/exact', doi: '10.1000/exact', pubmed_id: '12345' }],
  }
  try {
    adapter.seedIngredient({ id: INGREDIENT_ID, name: 'Teststoff' })
    for (const [id, url] of [[51, 'https://pmc.example.test/article'], [52, 'https://pubmed.example.test/12345']]) {
      adapter.database.prepare('INSERT INTO ingredient_research_sources (id,ingredient_id,source_kind,source_title,source_url,doi,pubmed_id,version,created_at,updated_at) VALUES (?,?,?,?,?,?,?,1,?,?)').run(id, INGREDIENT_ID, 'study', 'Title', url, request.sources[0].doi, request.sources[0].pubmed_id, '2026-07-18T00:00:00.000Z', '2026-07-18T00:00:00.000Z')
    }
    assert.equal(adapter.syncSourceCatalog(request)[0].resolved_source_id, 51)
    adapter.database.prepare('UPDATE ingredient_research_sources SET pubmed_id=? WHERE id=?').run('99999', 52)
    assert.throws(() => adapter.syncSourceCatalog(request), /resolves ambiguously in SQLite/)
  } finally { adapter.close() }
})

test('renderer public readback finalization rejects stale, partial and wrongly bound receipts but accepts a fresh valid receipt after a signal', () => {
  const root = mkdtempSync(join(tmpdir(), 'renderer-readback-finalize-'))
  const adapter = new SqliteContentPublicationAdapter()
  try {
    const release = releaseFixture()
    for (const target of release.articles) adapter.seedArticle(target)
    const requestPath = join(root, 'request.json')
    const receiptPath = join(root, 'receipt.json')
    const generated = runRendererPublicReadbackV2({ release, adapter, requestPath, receiptPath })
    const validReceipt = structuredClone(generated.receipt)
    const request = structuredClone(generated.request)

    clearRendererPublicReadbackReceiptV2(receiptPath)
    assert.equal(existsSync(receiptPath), false, 'stale receipt bytes must be removed before the external process starts')
    assert.throws(
      () => finalizeRendererPublicReadbackV2({ run: { status: null, signal: 'SIGTERM', stderr: 'terminated' }, receiptPath, request }),
      /failed \(signal\)/i,
    )

    writeFileSync(receiptPath, `${JSON.stringify(validReceipt)}\n`)
    assert.equal(
      finalizeRendererPublicReadbackV2({ run: { status: null, signal: 'SIGTERM' }, receiptPath, request }).content_hash,
      validReceipt.content_hash,
    )

    writeFileSync(receiptPath, '{"schema":')
    assert.throws(
      () => finalizeRendererPublicReadbackV2({ run: { status: null, signal: 'SIGTERM' }, receiptPath, request }),
      /invalid JSON/i,
    )

    const wrongRelease = { ...validReceipt, release_hash: hash('wrong-release') }
    wrongRelease.content_hash = artifactHashV2(wrongRelease)
    writeFileSync(receiptPath, `${JSON.stringify(wrongRelease)}\n`)
    assert.throws(
      () => finalizeRendererPublicReadbackV2({ run: { status: null, signal: 'SIGTERM' }, receiptPath, request }),
      /release binding is invalid/i,
    )

    const wrongArticles = structuredClone(validReceipt)
    wrongArticles.article_results = wrongArticles.article_results.slice(1)
    wrongArticles.content_hash = artifactHashV2(wrongArticles)
    writeFileSync(receiptPath, `${JSON.stringify(wrongArticles)}\n`)
    assert.throws(
      () => finalizeRendererPublicReadbackV2({ run: { status: null, signal: 'SIGTERM' }, receiptPath, request }),
      /article set differs from request/i,
    )
  } finally {
    adapter.close()
    rmSync(root, { recursive: true, force: true })
  }
})

const PUBLISHED_AT = '2026-07-14T09:30:00.000Z'
function publicSeo(slug, title, description, publishedAt = PUBLISHED_AT, modifiedAt = publishedAt) {
  const canonical = `https://supplementstack.de/wissen/${slug}`
  return { meta_title: title, meta_description: description, canonical_url: canonical, canonical_path: `/wissen/${slug}`, robots: 'index,follow', indexable: true, json_ld: { '@context': 'https://schema.org', '@type': 'Article', headline: title, description, mainEntityOfPage: canonical, inLanguage: 'de', datePublished: publishedAt, dateModified: modifiedAt } }
}

const INGREDIENT_ID = 7
const SOURCE_RESOLUTION_HASH = hash('source-resolution')

function article({ id, stage, slug, title, description, resolvedSourceId, link = null, metaTitle = title }) {
  const sourceRelations = [{ position: 0, source_id: `source-${id}`, label: `Quelle ${id}`, url: `https://example.org/${id}` }]
  const publishPayload = { schema: 'article_visible_payload.v2', slug, title, dek: description, body: `## Einordnung\n\n${description}`, conclusion: 'Kurz und verständlich zusammengefasst.', sources: sourceRelations.map(({ source_id, label, url }) => ({ source_id, label, url })) }
  const projection = { schema: 'article_render_projection.v2', article_id: id, stage, route: `/wissen/${slug}`, template: stage === 'stage3' ? 'knowledge_magazine_v1' : 'study_article_v2', title, dek: description, body: publishPayload.body, sources: publishPayload.sources, assets: [] }
  const seo = publicSeo(slug, metaTitle, description)
  const factsPackageHash = hash(`${id}-facts`)
  const sourceProjection = { schema: 'knowledge_article_sources_projection.v2', facts_package_hash: factsPackageHash, ingredient_ids: [INGREDIENT_ID], relations: sourceRelations, relation_hash: canonicalJsonHash(sourceRelations) }
  const structuredSummary = { schema: 'study_interpretation_summary.v1', source_id: sourceRelations[0].source_id, source_content_hash: hash(`${id}-source-content`), facts_package_hash: factsPackageHash, evidence_membership_hash: hash(`${id}-membership`), record_ids: [`record-${id}`], facts: [{ record_id: `record-${id}`, claim: `${title}: Testfakt` }] }
  const interpretationBase = { ingredient_id: INGREDIENT_ID, local_source_id: sourceRelations[0].source_id, resolved_source_id: resolvedSourceId, knowledge_article_slug: slug, status: 'accepted', structured_summary: structuredSummary, structured_summary_hash: canonicalJsonHash(structuredSummary), stage3_reference_summary: null, source_resolution_receipt_hash: SOURCE_RESOLUTION_HASH }
  return {
    article_id: id, stage, slug, change_class: 'L', write_guard: { mode: 'create', expected_status: 'absent', expected_version: 0 }, desired_status: 'published', reviewed_at: '2026-07-14', published_at: PUBLISHED_AT, modified_at: PUBLISHED_AT, target: 'sqlite-test',
    article_byte_hash: hash(`${id}-article`), facts_package_hash: factsPackageHash, evidence_membership_hash: hash(`${id}-membership`), article_lineage_hash: hash(`${id}-lineage`), framework_hash: hash(`${id}-framework`),
    writer_execution_id: `${id}-writer`, validation_receipt_hash: hash(`${id}-validation`), publication_review_hash: hash(`${id}-review`),
    compiled_payload_hash: hash(`${id}-compiled`), visible_payload_hash: hash(`${id}-visible`), qa_payload_hash: hash(`${id}-qa`), render_snapshot_hash: hash(`${id}-render`),
    relation_hash: canonicalJsonHash(sourceRelations), asset_hashes: [], seo: { ...seo, seo_hash: canonicalJsonHash(seo) }, seo_hash: canonicalJsonHash(seo),
    publish_payload: publishPayload, source_relations: sourceRelations, assets: [], expected_projection: projection, projection_hash: canonicalJsonHash(projection),
    ingredient_ids: [INGREDIENT_ID], ingredient_relation_hash: canonicalJsonHash({ ingredient_ids: [INGREDIENT_ID] }), source_projection: sourceProjection,
    stage2_interpretation_projection: stage === 'stage2' ? [{ ...interpretationBase, projection_hash: canonicalJsonHash(interpretationBase) }] : [],
    internal_link_dependencies: link ? [link] : [],
  }
}

function releaseFixture() {
  const beta = article({ id: 'main-beta', stage: 'stage3', slug: 'beta', title: 'Beta verständlich erklärt', description: 'Beta wird klar, quellengebunden und ohne unnötige Fachsprache verständlich eingeordnet.', resolvedSourceId: 102 })
  const alpha = article({ id: 'study-alpha', stage: 'stage2', slug: 'alpha', title: 'Alpha-Studie zu langfristigen Bedingungen, Ergebnissen und Grenzen der untersuchten Intervention', metaTitle: 'Alpha-Studie: Bedingungen, Ergebnisse und Grenzen', description: 'Die Alpha-Studie wird mit Methode, Ergebnis und Grenzen kompakt und verständlich eingeordnet.', resolvedSourceId: 101, link: { path: '/wissen/beta', title: 'Beta im Hauptartikel vertiefen', target_id: 'beta', target_state: 'same_release', target_article_id: 'main-beta' } })
  const identity = { ingredient_id: INGREDIENT_ID, canonical_name: 'Teststoff', canonical_slug: 'teststoff', status: 'active', version: 3 }
  const base = { schema: 'content_release.v2', run_id: 'machine-test-run', manifest_hash: hash('manifest'), policy_version: 'policy-v2', publish_target: 'sqlite-test', public_base_url: 'https://supplementstack.de/', atomic: true, ingredient_target: { ...identity, identity_hash: canonicalJsonHash(identity), receipt_hash: hash('ingredient-receipt') }, source_resolution_receipt_hash: SOURCE_RESOLUTION_HASH, article_target_receipt_hash: null, asset_deployment_receipt_hash: null, articles: [beta, alpha].sort((left, right) => left.article_id.localeCompare(right.article_id)) }
  return { ...base, release_hash: canonicalJsonHash(base) }
}

function refreezeRelease(release, articles) {
  const base = { ...release, articles, article_target_receipt_hash: articles.some((entry) => entry.write_guard.mode === 'update') ? hash('article-target-receipt') : null, release_hash: undefined }
  delete base.release_hash
  return { ...base, release_hash: canonicalJsonHash(base) }
}

function withRetirement(release, target, current) {
  const retirement = {
    article_id: target.article_id,
    slug: target.slug,
    expected_status: current.status,
    expected_version: current.version,
    expected_payload_hash: current.payload_hash,
    desired_status: 'draft',
    target: release.publish_target,
  }
  const base = { ...release, retire_articles: [retirement], article_target_receipt_hash: hash('article-target-receipt'), release_hash: undefined }
  delete base.release_hash
  return { ...base, release_hash: canonicalJsonHash(base) }
}

function updateDescription(target, description, writeGuard) {
  const publishPayload = { ...target.publish_payload, dek: description, body: `## Einordnung\n\n${description}` }
  const projection = { ...target.expected_projection, dek: description, body: publishPayload.body }
  const modifiedAt = '2026-07-14T10:00:00.000Z'
  const seo = publicSeo(target.slug, target.publish_payload.title, description, target.published_at, modifiedAt)
  return {
    ...target,
    write_guard: writeGuard,
    modified_at: modifiedAt,
    publish_payload: publishPayload,
    expected_projection: projection,
    projection_hash: canonicalJsonHash(projection),
    seo: { ...seo, seo_hash: canonicalJsonHash(seo) },
    seo_hash: canonicalJsonHash(seo),
    compiled_payload_hash: hash(`${target.article_id}-compiled-update`),
    visible_payload_hash: hash(`${target.article_id}-visible-update`),
    qa_payload_hash: hash(`${target.article_id}-qa-update`),
    render_snapshot_hash: hash(`${target.article_id}-render-update`),
  }
}

function persistedArticleProjection(row) {
  if (!row) return null
  return {
    slug: row.slug, stage: row.stage, article_layer: row.article_layer, status: row.status, version: row.version, payload_hash: row.payload_hash,
    publish_payload: row.publish_payload, source_relations: row.source_relations, source_projection: row.source_projection,
    ingredient_ids: row.ingredient_ids, stage2_interpretation_projection: row.stage2_interpretation_projection, seo: row.seo,
  }
}

function workOrder({ release = null, kind = 'publication_apply', outputPath = 'receipt.json' } = {}) {
  const base = {
    schema: 'nutrient_content_work_order.v2', run_id: release?.run_id ?? 'machine-test-run', kind, execution_class: 'deterministic', wave_index: null, reasoning_tier: 'standard',
    reason: 'Machine integration test', substance: { slug: 'teststoff', language: 'de' }, scope: { mode: 'run', source_ids: [], cluster_ids: [], obligation_ids: [], article_ids: release?.articles.map((entry) => entry.article_id) ?? [] },
    assignee: { role: kind === 'publication_apply' ? 'deterministic-content-publication-executor' : 'deterministic-link-inventory-exporter', independent_from_ids: [] }, inputs: [], reused_sources: [], link_inventory: null,
    outputs: [{ name: kind === 'publication_apply' ? 'publish_receipt' : 'link_inventory_source', root: 'run', path: outputPath, schema: kind === 'publication_apply' ? 'content_publish_receipt.v2' : 'site_link_inventory_source.v2', media_type: null }],
    task: kind === 'publication_apply' ? { target: release.publish_target, release_hash: release.release_hash, articles: release.articles.map((entry) => ({ article_id: entry.article_id, slug: entry.slug, write_guard: entry.write_guard, compiled_payload_hash: entry.compiled_payload_hash })) } : { objective: 'Export route/title/slug/meta_description.' },
    constraints: { non_llm: true }, execution_receipt: { root: 'run', path: `metrics/${kind}.work-order-execution-receipt.v1.json`, schema: 'work_order_execution_receipt.v1' },
  }
  return { ...base, work_order_id: canonicalJsonHash(base) }
}

function articleTargetWorkOrder(release, selectors, outputPath = 'article-target-receipt.json') {
  const base = {
    schema: 'nutrient_content_work_order.v2', run_id: release.run_id, kind: 'article_target_readback', execution_class: 'deterministic', wave_index: null, reasoning_tier: 'standard',
    reason: 'Freeze authoritative update timestamps', substance: { slug: 'teststoff', language: 'de' }, scope: { mode: 'articles', source_ids: [], cluster_ids: [], obligation_ids: [], article_ids: selectors.map((entry) => entry.article_id).sort() },
    assignee: { role: 'deterministic-article-target-reader', independent_from_ids: [] }, inputs: [], reused_sources: [], link_inventory: null,
    outputs: [{ name: 'article_target_receipt', root: 'run', path: outputPath, schema: 'article_target_receipt.v1', media_type: null }],
    task: { target: release.publish_target, articles: selectors, objective: 'Read frozen timestamps.' }, constraints: { non_llm: true, read_only: true },
    execution_receipt: { root: 'run', path: 'metrics/article-target.work-order-execution-receipt.v1.json', schema: 'work_order_execution_receipt.v1' },
  }
  return { ...base, work_order_id: canonicalJsonHash(base) }
}

test('SQLite executor atomically publishes a same-release bundle and emits exact projection/SEO receipts', async () => {
  const root = mkdtempSync(join(tmpdir(), 'content-machine-'))
  const adapter = new SqliteContentPublicationAdapter({ databasePath: join(root, 'content.sqlite') })
  try {
    const release = validateContentReleaseForApplyV2(releaseFixture())
    const order = workOrder({ release, outputPath: 'publish-receipt.json' })
    await assert.rejects(() => applyContentReleaseV2({ release, workOrder: order, adapter, publishEnabled: false, receiptPath: join(root, 'publish-receipt.json') }), /explicit publish flag/i)
    assert.deepEqual(adapter.inspectArticles(release.articles.map((entry) => entry.article_id)), Object.fromEntries(release.articles.map((entry) => [entry.article_id, null])))
    const receipt = await applyContentReleaseV2({ release, workOrder: order, adapter, publishEnabled: true, receiptPath: join(root, 'publish-receipt.json') })
    assert.equal(receipt.atomic_batch.result, 'COMMITTED')
    assert.deepEqual(receipt.atomic_batch.article_ids, release.articles.map((entry) => entry.article_id).sort())
    assert.ok(receipt.article_results.every((entry) => entry.result === 'applied' && entry.changed_rows === 1 && entry.readbacks.dom.result === 'MATCH' && entry.readbacks.seo.result === 'MATCH'))
    const shortened = release.articles.find((entry) => entry.article_id === 'study-alpha')
    const shortenedReadback = receipt.article_results.find((entry) => entry.article_id === 'study-alpha').readbacks.public_api.actual
    assert.notEqual(shortened.publish_payload.title, shortened.seo.meta_title)
    assert.equal(shortenedReadback.seo.meta_title, shortened.seo.meta_title)
    assert.equal(shortenedReadback.seo_hash, shortened.seo_hash)
    assert.equal(receipt.badge_readback.result, 'MATCH')
    assert.deepEqual(receipt.badge_readback.affected_ingredient_ids, [INGREDIENT_ID])
    assert.equal(existsSync(join(root, 'publish-receipt.json')), true)
    const second = await applyContentReleaseV2({ release, workOrder: order, adapter, publishEnabled: true, receiptPath: join(root, 'publish-receipt-2.json') })
    assert.ok(second.article_results.every((entry) => entry.result === 'already_current' && entry.changed_rows === 0))
  } finally { adapter.close(); rmSync(root, { recursive: true, force: true }) }
})

test('SQLite atomically retires a guarded replaced article without rewriting its content or relations', async () => {
  const root = mkdtempSync(join(tmpdir(), 'content-machine-retirement-'))
  const adapter = new SqliteContentPublicationAdapter({ databasePath: join(root, 'content.sqlite') })
  try {
    const legacy = article({ id: 'legacy-bundle', stage: 'stage2', slug: 'legacy-bundle', title: 'Historischer Sammelartikel', description: 'Der historische Sammelartikel bleibt als unveränderter Snapshot erhalten und wird nur aus der öffentlichen Sicht genommen.', resolvedSourceId: 303 })
    adapter.seedArticle(legacy, { version: 4, status: 'published' })
    const before = adapter.inspectArticles([legacy.article_id])[legacy.article_id]
    const release = validateContentReleaseForApplyV2(withRetirement(releaseFixture(), legacy, before))
    const order = workOrder({ release, outputPath: 'publish-receipt.json' })
    const receiptPath = join(root, 'publish-receipt.json')
    const receipt = await applyContentReleaseV2({ release, workOrder: order, adapter, publishEnabled: true, receiptPath })
    const after = adapter.inspectArticles([legacy.article_id])[legacy.article_id]
    assert.equal(after.status, 'draft')
    assert.equal(after.version, 5)
    for (const key of ['publish_payload', 'source_relations', 'source_projection', 'ingredient_ids', 'stage2_interpretation_projection']) assert.deepEqual(after[key], before[key], `${key} must remain byte-equivalent in the persistence projection`)
    assert.deepEqual(receipt.atomic_batch.retire_article_ids, [legacy.article_id])
    assert.equal(receipt.retirement_results[0].result, 'applied')
    assert.equal(receipt.retirement_results[0].readbacks.public_absence.actual.detail_api.article_present, false)
    assert.equal(receipt.retirement_results[0].readbacks.public_absence.actual.overview_route.slug_present, false)
    assert.equal(validatePublishReceiptV2({ context: { publish: { target: release.publish_target }, issuedWorkOrders: [order] }, release, receiptPath }).status, 'pass')

    const second = await applyContentReleaseV2({ release, workOrder: order, adapter, publishEnabled: true, receiptPath: join(root, 'publish-receipt-2.json') })
    assert.equal(second.retirement_results[0].result, 'already_current')
    assert.equal(second.retirement_results[0].changed_rows, 0)
  } finally { adapter.close(); rmSync(root, { recursive: true, force: true }) }
})

test('retirement collision, stale guard, and public-presence mismatch fail closed with exact rollback', async () => {
  const legacy = article({ id: 'legacy-bundle', stage: 'stage2', slug: 'legacy-bundle', title: 'Historischer Sammelartikel', description: 'Dieser Altartikel testet Kollisionen, Guards und den kompensierenden Status-Rollback.', resolvedSourceId: 303 })
  const collisionBase = releaseFixture()
  const collision = { ...collisionBase, retire_articles: [{ article_id: collisionBase.articles[0].article_id, slug: legacy.slug, expected_status: 'published', expected_version: 1, expected_payload_hash: hash('collision'), desired_status: 'draft', target: collisionBase.publish_target }], article_target_receipt_hash: hash('target'), release_hash: undefined }
  delete collision.release_hash
  collision.release_hash = canonicalJsonHash(collision)
  assert.throws(() => validateContentReleaseForApplyV2(collision), /collides/i)

  for (const mode of ['stale_guard', 'public_presence']) {
    const root = mkdtempSync(join(tmpdir(), `content-machine-retirement-${mode}-`))
    const adapter = new SqliteContentPublicationAdapter({ databasePath: join(root, 'content.sqlite') })
    try {
      adapter.seedArticle(legacy, { version: 4, status: 'published' })
      const before = adapter.inspectArticles([legacy.article_id])[legacy.article_id]
      let release = withRetirement(releaseFixture(), legacy, before)
      if (mode === 'stale_guard') {
        release.retire_articles[0].expected_version = 3
        const base = { ...release, release_hash: undefined }; delete base.release_hash
        release = { ...base, release_hash: canonicalJsonHash(base) }
        await assert.rejects(() => applyContentReleaseV2({ release, workOrder: workOrder({ release }), adapter, publishEnabled: true, receiptPath: join(root, 'receipt.json') }), /retirement guard differs/i)
      } else {
        const original = adapter.readRetiredArticlePublicState.bind(adapter)
        adapter.readRetiredArticlePublicState = async (target, releaseHash) => {
          const state = await original(target, releaseHash)
          return { ...state, overview_route: { ...state.overview_route, slug_present: true } }
        }
        await assert.rejects(() => applyContentReleaseV2({ release, workOrder: workOrder({ release }), adapter, publishEnabled: true, receiptPath: join(root, 'receipt.json') }), /remains in the public \/wissen route/i)
      }
      const restored = adapter.inspectArticles([legacy.article_id])[legacy.article_id]
      assert.equal(restored.status, before.status)
      assert.equal(restored.version, before.version)
      assert.equal(restored.payload_hash, before.payload_hash)
      assert.ok(Object.values(adapter.inspectArticles(release.articles.map((entry) => entry.article_id))).every((entry) => entry === null), 'active article writes must not survive a failed atomic publication')
    } finally { adapter.close(); rmSync(root, { recursive: true, force: true }) }
  }
})

test('public API readback retries bounded replica lag before accepting the exact projection', async () => {
  const root = mkdtempSync(join(tmpdir(), 'content-machine-public-convergence-'))
  const adapter = new SqliteContentPublicationAdapter()
  try {
    const release = releaseFixture(), original = adapter.readPublicArticle.bind(adapter)
    let reads = 0
    adapter.publicReadbackRetry = { attempts: 3, delayMs: 0 }
    adapter.readPublicArticle = async (target, releaseHash) => {
      const state = await original(target, releaseHash)
      reads += 1
      return reads === 1 ? { ...state, updated_at: '2000-01-01T00:00:00.000Z' } : state
    }
    const receipt = await applyContentReleaseV2({ release, workOrder: workOrder({ release }), adapter, publishEnabled: true, receiptPath: join(root, 'receipt.json') })
    assert.equal(receipt.atomic_batch.result, 'COMMITTED')
    assert.ok(reads > release.articles.length)
  } finally { adapter.close(); rmSync(root, { recursive: true, force: true }) }
})

test('client-rendered-only raw HTML or unavailable sitemap is recorded without rolling back a valid D1 publication', async () => {
  const root = mkdtempSync(join(tmpdir(), 'content-machine-seo-gap-'))
  const adapter = new SqliteContentPublicationAdapter()
  try {
    const release = releaseFixture()
    adapter.localRendererDelivery = (target) => ({
      indexability_state: 'INDEXABLE',
      seo_delivery_state: 'CLIENT_RENDERED_ONLY',
      raw_html: { url: `https://supplementstack.de/wissen/${target.slug}?cfcheck=${encodeURIComponent(release.release_hash)}`, fetch_status: 'NETWORK_ERROR', http_status: null, content_type: null, body_hash: null, title_match: false, article_text_match: false, article_json_ld_match: false, seo_delivery_state: 'CLIENT_RENDERED_ONLY' },
      sitemap: { state: 'NOT_AVAILABLE', matched_url: null, checked_urls: [] },
    })
    const receipt = await applyContentReleaseV2({ release, workOrder: workOrder({ release }), adapter, publishEnabled: true, receiptPath: join(root, 'receipt.json') })
    assert.ok(receipt.article_results.every((entry) => entry.result === 'applied' && entry.seo_delivery_state === 'CLIENT_RENDERED_ONLY' && entry.sitemap_state === 'NOT_AVAILABLE' && entry.readbacks.seo_delivery.result === 'INCOMPLETE'))
    assert.ok(Object.values(adapter.inspectArticles(release.articles.map((entry) => entry.article_id))).every(Boolean))
  } finally { adapter.close(); rmSync(root, { recursive: true, force: true }) }
})

test('origin-wide indexability blockers remain committed and never roll back valid article rows', async () => {
  for (const indexabilityState of ['BLOCKED_BY_SITE_POLICY', 'BLOCKED_BY_HTTP', 'UNKNOWN']) {
    const root = mkdtempSync(join(tmpdir(), `content-machine-${indexabilityState.toLowerCase()}-`))
    const adapter = new SqliteContentPublicationAdapter()
    try {
      const release = releaseFixture()
      adapter.localRendererOriginDelivery = () => ({ indexability_state: indexabilityState })
      adapter.localRendererDelivery = (target) => ({
        indexability_state: indexabilityState,
        seo_delivery_state: 'CLIENT_RENDERED_ONLY',
        raw_html: { url: `https://supplementstack.de/wissen/${target.slug}?cfcheck=${encodeURIComponent(release.release_hash)}`, fetch_status: 'NETWORK_ERROR', http_status: null, content_type: null, body_hash: null, title_match: false, article_text_match: false, article_json_ld_match: false, seo_delivery_state: 'CLIENT_RENDERED_ONLY' },
        sitemap: { state: 'NOT_AVAILABLE', matched_url: null, checked_urls: [] },
      })
      const receipt = await applyContentReleaseV2({ release, workOrder: workOrder({ release }), adapter, publishEnabled: true, receiptPath: join(root, 'receipt.json') })
      assert.equal(receipt.atomic_batch.result, 'COMMITTED')
      assert.ok(receipt.article_results.every((entry) => entry.result === 'applied' && entry.indexability_state === indexabilityState && entry.readbacks.seo_delivery.result === 'INCOMPLETE'))
      assert.ok(Object.values(adapter.inspectArticles(release.articles.map((entry) => entry.article_id))).every(Boolean), `${indexabilityState} must preserve every committed row`)
    } finally { adapter.close(); rmSync(root, { recursive: true, force: true }) }
  }
})

test('badge mismatch is integrity-valid, remains committed and rejects forged mismatch or cache-bypass evidence', async () => {
  const root = mkdtempSync(join(tmpdir(), 'content-machine-badge-gap-'))
  const adapter = new SqliteContentPublicationAdapter()
  try {
    adapter.readKnowledgeBadgeStatuses = (ingredientIds) => ingredientIds.map((ingredientId) => ({ ingredient_id: ingredientId, status_present: true, has_studies: false, has_dge: false }))
    const release = releaseFixture(), receiptPath = join(root, 'publish-receipt.json')
    const receipt = await applyContentReleaseV2({ release, workOrder: workOrder({ release }), adapter, publishEnabled: true, receiptPath })
    assert.equal(receipt.badge_readback.result, 'MISMATCH')
    assert.deepEqual(receipt.badge_readback.mismatches, [`${INGREDIENT_ID}:studies_expected`])
    assert.ok(Object.values(adapter.inspectArticles(release.articles.map((entry) => entry.article_id))).every(Boolean), 'valid article publication must remain committed')

    const request = JSON.parse(readFileSync(join(root, 'renderer-public-readback-request.v2.json'), 'utf8'))
    const rendererReceipt = JSON.parse(readFileSync(join(root, 'renderer-public-readback-receipt.v2.json'), 'utf8'))
    const forgedMismatch = structuredClone(rendererReceipt)
    forgedMismatch.badge_readback.origin_results[0].mismatches = ['forged-finding']
    forgedMismatch.badge_readback.mismatches = ['forged-finding']
    forgedMismatch.content_hash = artifactHashV2(forgedMismatch)
    assert.throws(() => validateRendererPublicReadbackReceiptV2(forgedMismatch, request), /mismatches do not match/i)

    const forgedUrl = structuredClone(rendererReceipt)
    forgedUrl.badge_readback.origin_results[0].api.url = 'https://supplementstack.de/api/knowledge'
    forgedUrl.badge_readback.origin_results[0].hydrated_overview.api_request_url = forgedUrl.badge_readback.origin_results[0].api.url
    forgedUrl.content_hash = artifactHashV2(forgedUrl)
    assert.throws(() => validateRendererPublicReadbackReceiptV2(forgedUrl, request), /cache-bypass/i)

    const observedOverviewUrl = structuredClone(rendererReceipt)
    observedOverviewUrl.badge_readback.origin_results[0].hydrated_overview.api_request_url = 'https://supplementstack.de/api/knowledge'
    observedOverviewUrl.badge_readback.origin_results[0].result = 'MISMATCH'
    observedOverviewUrl.badge_readback.origin_results[0].mismatches = [...observedOverviewUrl.badge_readback.origin_results[0].mismatches, 'overview_api_request_url'].sort()
    observedOverviewUrl.badge_readback.result = 'MISMATCH'
    observedOverviewUrl.badge_readback.mismatches = [...observedOverviewUrl.badge_readback.mismatches, 'overview_api_request_url'].sort()
    observedOverviewUrl.content_hash = artifactHashV2(observedOverviewUrl)
    assert.equal(validateRendererPublicReadbackReceiptV2(observedOverviewUrl, request).badge_readback.result, 'MISMATCH')
  } finally { adapter.close(); rmSync(root, { recursive: true, force: true }) }
})

test('article-target readback freezes stable publication timestamps before a guarded update', async () => {
  const root = mkdtempSync(join(tmpdir(), 'content-machine-targets-'))
  const adapter = new SqliteContentPublicationAdapter()
  try {
    const initial = releaseFixture(), target = initial.articles.find((entry) => entry.stage === 'stage2')
    adapter.seedArticle(target, { version: 4 })
    const current = adapter.inspectArticles([target.article_id])[target.article_id]
    const selectors = [{ article_id: target.article_id, slug: target.slug, expected_status: current.status, expected_version: current.version, expected_payload_hash: current.payload_hash }]
    const order = articleTargetWorkOrder(initial, selectors)
    const receipt = await readArticleTargetsV1({ context: { runId: initial.run_id, root, publish: { required: true, target: initial.publish_target } }, workOrder: order, adapter })
    assert.equal(receipt.articles[0].created_at, target.published_at)
    assert.equal(receipt.articles[0].updated_at, target.modified_at)
    assert.equal(JSON.parse(readFileSync(join(root, 'article-target-receipt.json'), 'utf8')).content_hash, receipt.content_hash)

    const updated = updateDescription(target, 'Eine neue, klarere Beschreibung mit stabiler Erstveröffentlichung.', { mode: 'update', expected_status: current.status, expected_version: current.version, expected_payload_hash: current.payload_hash })
    const release = refreezeRelease(initial, initial.articles.map((entry) => entry.article_id === target.article_id ? updated : entry))
    const publishReceipt = await applyContentReleaseV2({ release, workOrder: workOrder({ release }), adapter, publishEnabled: true, receiptPath: join(root, 'publish.json') })
    const persisted = adapter.inspectArticles([target.article_id])[target.article_id]
    assert.equal(persisted.created_at, target.published_at)
    assert.equal(persisted.updated_at, updated.modified_at)
    assert.equal(updated.seo.json_ld.datePublished, target.published_at)
    assert.equal(updated.seo.json_ld.dateModified, updated.modified_at)
    assert.equal(publishReceipt.article_results.find((entry) => entry.article_id === target.article_id).readbacks.public_api.actual.created_at, target.published_at)
  } finally { adapter.close(); rmSync(root, { recursive: true, force: true }) }
})

test('Cloudflare article-target and public API adapters preserve authoritative created_at and updated_at', async () => {
  const release = releaseFixture(), target = release.articles.find((entry) => entry.stage === 'stage2')
  class TimestampD1Adapter extends CloudflareD1ContentPublicationAdapter {
    constructor() { super({ accountId: 'account', databaseId: 'database', apiToken: 'secret', publicBaseUrl: 'https://supplementstack.de/' }) }
    async inspectArticlesByTargets(targets) {
      return Object.fromEntries(targets.map((entry) => [entry.article_id, { article_id: entry.article_id, slug: entry.slug, status: 'published', version: 9, payload_hash: hash('authoritative-guard'), created_at: '2025-04-01T08:00:00.000Z', updated_at: '2026-07-13T18:00:00.000Z' }]))
    }
  }
  const adapter = new TimestampD1Adapter()
  const selectors = [{ article_id: target.article_id, slug: target.slug, expected_status: 'published', expected_version: 9, expected_payload_hash: hash('authoritative-guard') }]
  assert.deepEqual(await adapter.readArticleTargets(selectors), [{ article_id: target.article_id, slug: target.slug, status: 'published', version: 9, payload_hash: hash('authoritative-guard'), created_at: '2025-04-01T08:00:00.000Z', updated_at: '2026-07-13T18:00:00.000Z' }])

  const originalFetch = globalThis.fetch
  let requestedUrl = null
  globalThis.fetch = async (url) => {
    requestedUrl = String(url)
    const body = JSON.stringify({ article: { ...target.publish_payload, summary: target.publish_payload.dek, seo: { meta_title: target.seo.meta_title, meta_description: target.seo.meta_description, canonical_url: target.seo.canonical_url, canonical_path: target.seo.canonical_path, robots: target.seo.robots, indexable: target.seo.indexable, json_ld: target.seo.json_ld }, reviewed_at: target.reviewed_at, created_at: '2025-04-01T08:00:00.000Z', updated_at: '2026-07-13T18:00:00.000Z', ingredient_ids: target.ingredient_ids, stage2_interpretation_projection: target.stage2_interpretation_projection, featured_image_url: null, dose_min: null, dose_max: null, dose_unit: null, product_note: null } })
    return new Response(body, { status: 200, headers: { 'content-type': 'application/json' } })
  }
  try {
    const publicArticle = await adapter.readPublicArticle(target, release.release_hash)
    assert.equal(publicArticle.created_at, '2025-04-01T08:00:00.000Z')
    assert.equal(publicArticle.updated_at, '2026-07-13T18:00:00.000Z')
    assert.equal(new URL(requestedUrl).searchParams.get('cfcheck'), release.release_hash)
  } finally { globalThis.fetch = originalFetch }
})

test('SQLite guards fail before the transaction and never partially write a bundle', async () => {
  const adapter = new SqliteContentPublicationAdapter()
  try {
    const release = releaseFixture()
    adapter.seedArticle({ ...release.articles[1], compiled_payload_hash: hash('foreign-compiled') }, { version: 7 })
    await assert.rejects(() => applyContentReleaseV2({ release, workOrder: workOrder({ release }), adapter, publishEnabled: true, receiptPath: join(tmpdir(), `should-not-exist-${Date.now()}.json`) }), /create guard expected absent/i)
    const rows = adapter.inspectArticles(release.articles.map((entry) => entry.article_id))
    assert.equal(rows[release.articles[0].article_id], null)
    assert.equal(rows[release.articles[1].article_id].version, 7)
  } finally { adapter.close() }
})

test('SQLite never treats matching text with the wrong status or article_layer as already_current', async () => {
  const root = mkdtempSync(join(tmpdir(), 'content-machine-state-'))
  const adapter = new SqliteContentPublicationAdapter()
  try {
    const initial = releaseFixture()
    for (const target of initial.articles) adapter.seedArticle(target)
    const stage2 = initial.articles.find((entry) => entry.stage === 'stage2')
    adapter.database.prepare("UPDATE content_publication_articles SET status='draft',article_layer='main_article' WHERE article_id=?").run(stage2.article_id)
    const current = adapter.inspectArticles([stage2.article_id])[stage2.article_id]
    const updatedStage2 = { ...stage2, write_guard: { mode: 'update', expected_status: current.status, expected_version: current.version, expected_payload_hash: current.payload_hash } }
    const release = refreezeRelease(initial, initial.articles.map((entry) => entry.article_id === stage2.article_id ? updatedStage2 : entry))
    const receipt = await applyContentReleaseV2({ release, workOrder: workOrder({ release }), adapter, publishEnabled: true, receiptPath: join(root, 'receipt.json') })
    const result = receipt.article_results.find((entry) => entry.article_id === stage2.article_id)
    assert.equal(result.result, 'applied')
    assert.equal(result.resulting_status, 'published')
    assert.equal(result.readbacks.persistence.actual.article_layer, 'single_study')
  } finally { adapter.close(); rmSync(root, { recursive: true, force: true }) }
})

test('SQLite fails closed on ambiguous interpretation rows for one ingredient/source/article target', async () => {
  const adapter = new SqliteContentPublicationAdapter()
  try {
    const release = releaseFixture(), stage2 = release.articles.find((entry) => entry.stage === 'stage2')
    adapter.seedArticle(stage2)
    const original = stage2.stage2_interpretation_projection[0]
    const originalBase = { ...original }
    delete originalBase.projection_hash
    const base = { ...originalBase, local_source_id: `${original.local_source_id}-duplicate` }
    const duplicate = { ...base, projection_hash: canonicalJsonHash(base) }
    adapter.database.prepare('INSERT INTO content_publication_interpretations (article_id,local_source_id,resolved_source_id,status,projection_json) VALUES (?,?,?,?,?)').run(stage2.article_id, duplicate.local_source_id, duplicate.resolved_source_id, duplicate.status, JSON.stringify(duplicate))
    assert.throws(() => adapter.inspectArticles([stage2.article_id]), /ambiguous/i)
  } finally { adapter.close() }
})

test('failed exact public projection readback rolls back SQLite and emits no success receipt', async () => {
  const root = mkdtempSync(join(tmpdir(), 'content-machine-rollback-'))
  const adapter = new SqliteContentPublicationAdapter()
  try {
    const release = releaseFixture(), order = workOrder({ release })
    const original = adapter.readPublicProjection.bind(adapter)
    adapter.readPublicProjection = (articleId) => {
      const value = original(articleId)
      if (articleId === release.articles[0].article_id) value.projection = { ...value.projection, title: 'Manipulierte Ausgabe' }
      return value
    }
    const receiptPath = join(root, 'receipt.json')
    await assert.rejects(() => applyContentReleaseV2({ release, workOrder: order, adapter, publishEnabled: true, receiptPath }), /did not MATCH|projection/i)
    assert.equal(existsSync(receiptPath), false)
    assert.ok(Object.values(adapter.inspectArticles(release.articles.map((entry) => entry.article_id))).every((entry) => entry === null))
  } finally { adapter.close(); rmSync(root, { recursive: true, force: true }) }
})

test('failed update readback restores the exact SQLite article, sources, ingredient and interpretation snapshot', async () => {
  const root = mkdtempSync(join(tmpdir(), 'content-machine-update-rollback-'))
  const adapter = new SqliteContentPublicationAdapter()
  try {
    const initial = releaseFixture()
    for (const target of initial.articles) adapter.seedArticle(target, { version: 4 })
    const target = initial.articles.find((entry) => entry.stage === 'stage2')
    const before = adapter.inspectArticles([target.article_id])[target.article_id]
    const writeGuard = { mode: 'update', expected_status: before.status, expected_version: before.version, expected_payload_hash: before.payload_hash }
    const updated = updateDescription(target, 'Eine gezielt geänderte Beschreibung erzwingt einen guarded Update-Pfad.', writeGuard)
    const release = refreezeRelease(initial, initial.articles.map((entry) => entry.article_id === target.article_id ? updated : entry))
    const original = adapter.readPublicProjection.bind(adapter)
    adapter.readPublicProjection = (articleId) => {
      const value = original(articleId)
      if (articleId === target.article_id) value.projection = { ...value.projection, title: 'Manipulierte Ausgabe' }
      return value
    }
    await assert.rejects(() => applyContentReleaseV2({ release, workOrder: workOrder({ release }), adapter, publishEnabled: true, receiptPath: join(root, 'receipt.json') }), /did not MATCH|projection/i)
    const restored = adapter.inspectArticles([target.article_id])[target.article_id]
    assert.deepEqual(persistedArticleProjection(restored), persistedArticleProjection(before))
  } finally { adapter.close(); rmSync(root, { recursive: true, force: true }) }
})

test('authoritative inventory export comes from persisted rows and includes meta descriptions', async () => {
  const root = mkdtempSync(join(tmpdir(), 'link-machine-'))
  const adapter = new SqliteContentPublicationAdapter()
  try {
    const release = releaseFixture()
    adapter.seedArticle(release.articles[0])
    const order = workOrder({ kind: 'link_inventory_source_readback', outputPath: 'inventory.json' })
    const value = await exportSiteLinkInventorySourceV2({ workOrder: order, adapter, root, outputPath: join(root, 'inventory.json') })
    assert.deepEqual(value.routes, [{ path: `/wissen/${release.articles[0].slug}`, slug: release.articles[0].slug, title: release.articles[0].publish_payload.title, meta_title: release.articles[0].seo.meta_title, meta_description: release.articles[0].seo.meta_description, article_layer: release.articles[0].stage === 'stage2' ? 'single_study' : 'main_article', source_urls: release.articles[0].source_relations.map((source) => source.url).sort() }])
    assert.equal(JSON.parse(readFileSync(join(root, 'inventory.json'), 'utf8')).content_hash, value.content_hash)
  } finally { adapter.close(); rmSync(root, { recursive: true, force: true }) }
})

test('authoritative inventory export omits legacy source placeholders that are not locators', async () => {
  const root = mkdtempSync(join(tmpdir(), 'content-machine-inventory-placeholder-'))
  const adapter = new SqliteContentPublicationAdapter()
  try {
    const release = releaseFixture()
    const route = {
      path: '/wissen/legacy-source-placeholder',
      slug: 'legacy-source-placeholder',
      title: 'Legacy source placeholder',
      meta_title: 'Technischer Legacy-Meta-Titel',
      meta_description: 'A valid route whose historical source list contains a non-link placeholder.',
      article_layer: 'single_study',
      source_urls: ['Im übergebenen Quellenstand nicht vorhanden.', 'https://doi.org/10.1000/example', '/wissen/internal-source'],
    }
    adapter.readRoutes = () => [route]
    const order = articleTargetWorkOrder(release, [], 'inventory.json')
    order.kind = 'link_inventory_source_readback'
    order.assignee.role = 'deterministic-link-inventory-exporter'
    order.outputs = [{ name: 'link_inventory_source', root: 'run', path: 'inventory.json', schema: 'site_link_inventory_source.v2', media_type: null }]
    const unsigned = { ...order }
    delete unsigned.work_order_id
    order.work_order_id = artifactHashV2(unsigned)
    const value = await exportSiteLinkInventorySourceV2({ workOrder: order, adapter, root, outputPath: join(root, 'inventory.json') })
    assert.deepEqual(value.routes[0].source_urls, ['/wissen/internal-source', 'https://doi.org/10.1000/example'])
    assert.equal(value.routes[0].meta_title, route.meta_title)
  } finally {
    adapter.close()
    rmSync(root, { recursive: true, force: true })
  }
})

test('framework activation is explicit, no-overwrite and atomically promotes candidate plus catalog in an isolated repo', () => {
  const root = mkdtempSync(join(tmpdir(), 'framework-machine-')), repo = join(root, 'repo'), run = join(root, 'run')
  try {
    const catalogPath = join(repo, 'codex-files', 'frameworks', 'framework-catalog.v1.json')
    mkdirSync(join(run, 'candidate'), { recursive: true }); mkdirSync(join(repo, 'codex-files', 'frameworks'), { recursive: true })
    writeFileSync(catalogPath, `${JSON.stringify({ schema: 'framework_catalog.v1', catalog_version: '1.0.0', updated_at: '2026-07-14', frameworks: [] }, null, 2)}\n`)
    const candidatePath = join(run, 'candidate', 'framework.md'), catalogCandidatePath = join(run, 'candidate', 'catalog-candidate.json'), pilotPath = join(run, 'candidate', 'pilot.json')
    writeFileSync(candidatePath, '# Candidate framework\n')
    const frameworkByteHash = sha256Bytes(readFileSync(candidatePath)), expectedCatalogHash = sha256Bytes(readFileSync(catalogPath))
    const entry = { framework_id: 'stage3.test', version: '1.0.0', stage: 'stage3', path: 'codex-files/frameworks/test-framework.md', framework_sha256: frameworkByteHash, contract_id: 'knowledge_magazine_v1', render_profile: 'knowledge_magazine_v1', variant: 'test', status: 'approved' }
    const candidateBase = { schema: 'framework_catalog_candidate.v1', gap_id: 'gap-test', expected_catalog_byte_hash: expectedCatalogHash, technical_change_paths: [], entry }
    const catalogCandidate = { ...candidateBase, content_hash: artifactHashV2(candidateBase) }; writeFileSync(catalogCandidatePath, `${JSON.stringify(catalogCandidate)}\n`)
    const pilotBase = { schema: 'article_framework_pilot_receipt.v2', gap_id: 'gap-test', framework_id: entry.framework_id, framework_version: entry.version, candidate_framework_byte_hash: frameworkByteHash, catalog_candidate_hash: catalogCandidate.content_hash, technical_change_paths: [], receipts: { compiler: {}, render: {}, publication: {}, technical: null }, result: 'PASS', composed_by: 'nutrient-content-runner' }
    const pilot = { ...pilotBase, content_hash: artifactHashV2(pilotBase) }; writeFileSync(pilotPath, `${JSON.stringify(pilot)}\n`)
    const bind = (name, rootKind, path, value = null, schema = null) => ({ name, root: rootKind, path, byte_hash: sha256Bytes(readFileSync(rootKind === 'repo' ? join(repo, path) : join(run, path))), content_hash: value?.content_hash ?? sha256Bytes(readFileSync(rootKind === 'repo' ? join(repo, path) : join(run, path))), schema })
    const base = {
      schema: 'nutrient_content_work_order.v2', run_id: 'framework-run', kind: 'framework_catalog_activate', execution_class: 'deterministic', wave_index: null, reasoning_tier: 'standard', reason: 'Activate tested candidate', substance: { slug: 'teststoff', language: 'de' },
      scope: { mode: 'articles', source_ids: [], cluster_ids: [], obligation_ids: [], article_ids: ['main-test'] }, assignee: { role: 'deterministic-framework-catalog-activator', independent_from_ids: [] },
      inputs: [bind('candidate_framework', 'run', 'candidate/framework.md'), bind('catalog_candidate', 'run', 'candidate/catalog-candidate.json', catalogCandidate, 'framework_catalog_candidate.v1'), bind('framework_pilot', 'run', 'candidate/pilot.json', pilot, 'article_framework_pilot_receipt.v2'), bind('current_framework_catalog', 'repo', 'codex-files/frameworks/framework-catalog.v1.json', null, 'framework_catalog.v1')], reused_sources: [], link_inventory: null,
      outputs: [{ name: 'activated_framework', root: 'repo', path: entry.path, schema: null, media_type: 'text/markdown' }, { name: 'activated_framework_catalog', root: 'repo', path: 'codex-files/frameworks/framework-catalog.v1.json', schema: 'framework_catalog.v1', media_type: null }, { name: 'activation_receipt', root: 'run', path: 'candidate/activation.json', schema: 'framework_catalog_activation_receipt.v1', media_type: null }],
      task: { gap_id: 'gap-test', target_framework_path: entry.path, framework_id: entry.framework_id, framework_version: entry.version, expected_framework_absent: true, expected_catalog_byte_hash: expectedCatalogHash, candidate_framework_byte_hash: frameworkByteHash, catalog_candidate_hash: catalogCandidate.content_hash, pilot_hash: pilot.content_hash, owner_approval_hash: null }, constraints: { non_llm: true, no_overwrite: true }, execution_receipt: { root: 'run', path: 'metrics/framework.work-order-execution-receipt.v1.json', schema: 'work_order_execution_receipt.v1' },
    }
    const order = { ...base, work_order_id: canonicalJsonHash(base) }, context = { runId: 'framework-run', root: run, mode: 'test', machineRepoRoot: repo }
    assert.throws(() => activateFrameworkCatalogV1({ context, workOrder: order, activationEnabled: false }), /explicit activate-framework flag/i)
    const receipt = activateFrameworkCatalogV1({ context, workOrder: order, activationEnabled: true })
    assert.equal(receipt.atomic_bundle.result, 'COMMITTED')
    assert.equal(sha256Bytes(readFileSync(join(repo, entry.path))), frameworkByteHash)
    assert.equal(JSON.parse(readFileSync(catalogPath, 'utf8')).frameworks[0].framework_id, entry.framework_id)
    assert.throws(() => activateFrameworkCatalogV1({ context, workOrder: order, activationEnabled: true }), /bytes differ|changed|overwrite/i)
  } finally { rmSync(root, { recursive: true, force: true }) }
})

test('Cloudflare D1 adapter sends every article, relation and exact-row guard in one transactional batch', async () => {
  class MockD1Adapter extends CloudflareD1ContentPublicationAdapter {
    constructor() { super({ accountId: 'account', databaseId: 'database', apiToken: 'secret', publicBaseUrl: 'https://supplementstack.de/' }); this.inspectCount = 0; this.batches = [] }
    async inspectArticlesByTargets(targets) {
      this.inspectCount += 1
      if (this.inspectCount === 1) return {}
      return Object.fromEntries(targets.map((target) => [target.article_id, { ...target, status: target.desired_status, version: 1, payload_hash: publicationHash(target), created_at: target.published_at, updated_at: target.modified_at, featured_image_url: null }]))
    }
    async query(body) { this.batches.push(body); return { success: true, result: [] } }
  }
  const publicationHash = (target) => canonicalJsonHash({ slug: target.slug, stage: target.stage, status: target.desired_status, publish_payload: target.publish_payload, source_relations: target.source_relations })
  const adapter = new MockD1Adapter(), release = releaseFixture()
  const result = await adapter.applyAtomicRelease(release)
  assert.equal(result.decisions.length, release.articles.length)
  assert.equal(adapter.batches.length, 1)
  const statements = adapter.batches[0].batch
  assert.ok(Array.isArray(statements) && statements.length > release.articles.length)
  assert.equal(statements.filter((entry) => /INSERT INTO knowledge_articles/.test(entry.sql)).length, release.articles.length)
  assert.equal(statements.filter((entry) => /exact_guarded_row/.test(entry.sql)).length, release.articles.length)
  assert.equal(statements.filter((entry) => /INSERT INTO knowledge_article_sources/.test(entry.sql)).length, release.articles.reduce((sum, entry) => sum + entry.source_relations.length, 0))
  assert.equal(statements.filter((entry) => /INSERT INTO knowledge_article_ingredients/.test(entry.sql)).length, release.articles.length)
  assert.equal(statements.filter((entry) => /INSERT INTO study_interpretation_records/.test(entry.sql)).length, release.articles.reduce((sum, entry) => sum + entry.stage2_interpretation_projection.length, 0))
  assert.ok(statements.filter((entry) => /INSERT INTO knowledge_articles/.test(entry.sql)).every((entry) => entry.params.includes(JSON.stringify(release.articles.find((article) => article.slug === entry.params[0]).source_projection))))
  assert.ok(statements.filter((entry) => /INSERT INTO knowledge_articles/.test(entry.sql)).every((entry) => {
    const target = release.articles.find((article) => article.slug === entry.params[0])
    return entry.params.at(-2) === target.published_at && entry.params.at(-1) === target.modified_at
  }), 'D1 creates must persist the frozen published_at/modified_at pair')
  assert.ok(statements.filter((entry) => /INSERT INTO knowledge_articles/.test(entry.sql)).every((entry) => entry.params.slice(10, 16).length === 6 && entry.params.slice(10, 16).every((value) => value === null)), 'legacy hero/dose/product columns must be written as NULL')
  assert.equal(statements.some((entry) => /BEGIN|COMMIT/.test(entry.sql)), false)
})

test('Cloudflare guarded update normalizes created_at after guarding the raw snapshot and is idempotent', async () => {
  const initial = releaseFixture(), original = initial.articles.find((entry) => entry.stage === 'stage3')
  const createdAt = '2025-04-01 08:00:00', publishedAt = '2025-04-01T06:00:00.000Z', priorUpdatedAt = '2026-06-01T10:00:00.000Z', guardHash = hash('d1-update-guard')
  const writeGuard = { mode: 'update', expected_status: 'published', expected_version: 4, expected_payload_hash: guardHash }
  const target = { ...updateDescription(original, 'Cloudflare aktualisiert gezielt und behÃ¤lt die ErstverÃ¶ffentlichung.', writeGuard), published_at: publishedAt }
  const targetSeo = publicSeo(target.slug, target.publish_payload.title, target.publish_payload.dek, publishedAt, target.modified_at)
  target.seo = { ...targetSeo, seo_hash: canonicalJsonHash(targetSeo) }
  target.seo_hash = canonicalJsonHash(targetSeo)
  const release = refreezeRelease({ ...initial, articles: [target] }, [target])
  const persistedSources = Array.from({ length: 16 }, (_, index) => ({ id: 100 + index, article_slug: target.slug, label: `Historische Quelle ${index}`, url: `https://example.org/history/${index}`, sort_order: index, created_at: createdAt, updated_at: priorUpdatedAt }))
  const persistedIngredients = target.ingredient_ids.map((ingredientId, index) => ({ article_slug: target.slug, ingredient_id: ingredientId, sort_order: index, created_at: createdAt }))
  const persistedInterpretations = Array.from({ length: 8 }, (_, index) => ({ id: 200 + index, ingredient_id: INGREDIENT_ID, source_id: 300 + index, research_artifact_id: null, knowledge_article_slug: target.slug, status: 'accepted', structured_summary_json: JSON.stringify({ index }), stage3_reference_summary: null, notes: `content-pipeline-v2:${index}`, review_notes: null, version: 1, created_at: createdAt, updated_at: priorUpdatedAt }))
  const rawArticle = { slug: target.slug, title: original.publish_payload.title, summary: original.publish_payload.dek, body: original.publish_payload.body, status: 'published', version: 4, article_layer: 'main_article', conclusion: original.publish_payload.conclusion, featured_image_url: null, featured_image_r2_key: null, dose_min: null, dose_max: null, dose_unit: null, product_note: null, reviewed_at: original.reviewed_at, created_at: createdAt, updated_at: priorUpdatedAt, sources_json: JSON.stringify(original.source_projection), seo_json: JSON.stringify(publicSeo(original.slug, original.publish_payload.title, original.publish_payload.dek, original.published_at, original.modified_at)) }
  const before = { ...original, status: 'published', version: 4, payload_hash: guardHash, article_layer: 'main_article', created_at: createdAt, updated_at: priorUpdatedAt, persistence_snapshot: { article: rawArticle, source_rows: persistedSources, ingredient_rows: persistedIngredients, interpretation_rows: persistedInterpretations } }
  const resulting = { ...target, status: 'published', article_layer: 'main_article', version: 5, payload_hash: hash('after-update'), created_at: target.published_at, updated_at: target.modified_at, persistence_snapshot: { article: { ...rawArticle, title: target.publish_payload.title, summary: target.publish_payload.dek, body: target.publish_payload.body, seo_json: JSON.stringify(publicSeo(target.slug, target.seo.meta_title, target.seo.meta_description, target.published_at, target.modified_at)), version: 5, created_at: target.published_at, updated_at: target.modified_at }, source_rows: [], ingredient_rows: [], interpretation_rows: [] } }
  class UpdateD1Adapter extends CloudflareD1ContentPublicationAdapter {
    constructor() { super({ accountId: 'account', databaseId: 'database', apiToken: 'secret', publicBaseUrl: 'https://supplementstack.de/' }); this.state = before; this.batches = [] }
    async inspectArticlesByTargets() { return { [target.article_id]: this.state } }
    async query(body) {
      this.batches.push(body)
      this.state = body.batch.some((entry) => /^UPDATE knowledge_articles SET title=/.test(entry.sql) && /version=version\+1/.test(entry.sql)) ? resulting : before
      return { success: true, result: [] }
    }
  }
  const adapter = new UpdateD1Adapter()
  const transaction = await adapter.applyAtomicRelease(release)
  const update = adapter.batches[0].batch.find((entry) => /^UPDATE knowledge_articles SET/.test(entry.sql))
  assert.ok(update)
  assert.equal(update.params[11], target.published_at)
  assert.equal(update.params[12], target.modified_at)
  assert.equal(update.params.at(-1), createdAt)
  assert.match(update.sql, /WHERE .*created_at=\?/)
  assert.match(update.sql.split(' WHERE ')[0], /created_at=\?/)
  const snapshotGuards = adapter.batches[0].batch.filter((entry) => /exact_snapshot_guard/.test(entry.sql))
  assert.ok(snapshotGuards.length >= 1 + 1 + persistedSources.length + 1 + persistedIngredients.length + 1 + persistedInterpretations.length)
  assert.ok(snapshotGuards.every((entry) => (entry.params ?? []).length <= 18), 'each exact snapshot guard must remain below the D1 SQL-variable limit')
  const second = await adapter.applyAtomicRelease(release)
  assert.equal(second.decisions[0].result, 'already_current')
  assert.equal(adapter.batches.length, 1, 'idempotent re-apply must not emit another D1 batch')
  await adapter.rollbackAtomic(transaction)
  assert.equal(adapter.batches.length, 2)
  for (const request of adapter.batches) {
    assert.ok(request.batch.every((entry) => (entry.params ?? []).length <= 18), 'every apply/rollback statement must remain below the D1 SQL-variable limit')
    const lastSnapshotGuard = request.batch.map((entry, index) => /exact_snapshot_guard/.test(entry.sql) ? index : -1).reduce((max, index) => Math.max(max, index), -1)
    const firstMutation = request.batch.findIndex((entry) => /^(?:INSERT|UPDATE|DELETE)\b/.test(entry.sql))
    assert.ok(lastSnapshotGuard >= 0 && firstMutation > lastSnapshotGuard, 'all exact snapshot guards must precede writes in their atomic batch')
  }

  class GuardFailureD1Adapter extends CloudflareD1ContentPublicationAdapter {
    constructor() { super({ accountId: 'account', databaseId: 'database', apiToken: 'secret', publicBaseUrl: 'https://supplementstack.de/' }); this.mutated = false }
    async inspectArticlesByTargets() { return { [target.article_id]: before } }
    async query(body) {
      for (const statement of body.batch) {
        if (/exact_snapshot_guard/.test(statement.sql)) throw new Error('simulated exact snapshot guard failure')
        if (/^(?:INSERT|UPDATE|DELETE)\b/.test(statement.sql)) this.mutated = true
      }
      return { success: true, result: [] }
    }
  }
  const failingAdapter = new GuardFailureD1Adapter()
  await assert.rejects(failingAdapter.applyAtomicRelease(release), /simulated exact snapshot guard failure/)
  assert.equal(failingAdapter.mutated, false)
})

test('Cloudflare retirement emits one status-only guarded mutation and rollback restores exact status/version', async () => {
  const legacy = article({ id: 'legacy-d1-bundle', stage: 'stage2', slug: 'legacy-d1-bundle', title: 'Historischer D1-Sammelartikel', description: 'Dieser D1-Altartikel prüft eine atomare Retirement-Mutation ohne Content- oder Relationsrewrite.', resolvedSourceId: 404 })
  const rawArticle = { slug: legacy.slug, title: legacy.publish_payload.title, summary: legacy.publish_payload.dek, body: legacy.publish_payload.body, status: 'published', version: 4, article_layer: 'single_study', conclusion: legacy.publish_payload.conclusion, featured_image_url: null, featured_image_r2_key: null, dose_min: null, dose_max: null, dose_unit: null, product_note: null, reviewed_at: legacy.reviewed_at, created_at: legacy.published_at, updated_at: legacy.modified_at, sources_json: JSON.stringify(legacy.source_projection), seo_json: JSON.stringify(publicSeo(legacy.slug, legacy.seo.meta_title, legacy.seo.meta_description, legacy.published_at, legacy.modified_at)) }
  const sourceRows = legacy.source_relations.map((source, index) => ({ id: 600 + index, article_slug: legacy.slug, label: source.label, url: source.url, sort_order: source.position, created_at: legacy.published_at, updated_at: legacy.modified_at }))
  const ingredientRows = legacy.ingredient_ids.map((ingredientId, index) => ({ article_slug: legacy.slug, ingredient_id: ingredientId, sort_order: index, created_at: legacy.published_at }))
  const beforeBase = { ...legacy, status: 'published', article_layer: 'single_study', version: 4, created_at: legacy.published_at, updated_at: legacy.modified_at, persistence_snapshot: { article: rawArticle, source_rows: sourceRows, ingredient_rows: ingredientRows, interpretation_rows: [] } }
  const before = { ...beforeBase, payload_hash: publicationGuardPayloadHash(beforeBase) }
  const afterBase = { ...before, status: 'draft', version: 5, persistence_snapshot: { ...before.persistence_snapshot, article: { ...rawArticle, status: 'draft', version: 5 } } }
  const after = { ...afterBase, payload_hash: publicationGuardPayloadHash(afterBase) }
  const retirement = { article_id: legacy.article_id, slug: legacy.slug, expected_status: 'published', expected_version: 4, expected_payload_hash: before.payload_hash, desired_status: 'draft', target: 'cloudflare-d1-test' }
  const releaseBase = { release_hash: hash('d1-retirement-release'), articles: [], retire_articles: [retirement] }
  class RetirementD1Adapter extends CloudflareD1ContentPublicationAdapter {
    constructor() { super({ accountId: 'account', databaseId: 'database', apiToken: 'secret', publicBaseUrl: 'https://supplementstack.de/' }); this.state = before; this.batches = [] }
    async inspectArticlesByTargets() { return { [legacy.article_id]: this.state } }
    async query(body) {
      this.batches.push(body)
      if (body.batch.some((entry) => /d1-retirement-write-guard-failed/.test(entry.sql))) this.state = after
      if (body.batch.some((entry) => /d1-retirement-rollback-guard-failed/.test(entry.sql))) this.state = before
      return { success: true, result: [] }
    }
  }
  const adapter = new RetirementD1Adapter()
  const transaction = await adapter.applyAtomicRelease(releaseBase)
  const statements = adapter.batches[0].batch
  assert.equal(statements.filter((entry) => /^UPDATE knowledge_articles SET status='draft',version=version\+1/.test(entry.sql)).length, 1)
  assert.equal(statements.some((entry) => /DELETE FROM knowledge_article_|INSERT INTO knowledge_article_|SET title=/.test(entry.sql)), false)
  const firstMutation = statements.findIndex((entry) => /^UPDATE knowledge_articles/.test(entry.sql))
  const lastSnapshotGuard = statements.map((entry, index) => /exact_snapshot_guard/.test(entry.sql) ? index : -1).reduce((max, index) => Math.max(max, index), -1)
  assert.ok(lastSnapshotGuard >= 0 && firstMutation > lastSnapshotGuard)
  assert.equal(transaction.after[legacy.article_id].status, 'draft')
  assert.equal(transaction.after[legacy.article_id].version, 5)
  await adapter.rollbackAtomic(transaction)
  assert.equal(adapter.state.status, 'published')
  assert.equal(adapter.state.version, 4)
  assert.equal(adapter.state.payload_hash, before.payload_hash)
})

test('Cloudflare D1 inspection rejects a competing non-pipeline interpretation row', async () => {
  const release = releaseFixture(), target = release.articles.find((entry) => entry.stage === 'stage2'), projection = target.stage2_interpretation_projection[0]
  class CompetingD1Adapter extends CloudflareD1ContentPublicationAdapter {
    constructor() { super({ accountId: 'account', databaseId: 'database', apiToken: 'secret', publicBaseUrl: 'https://supplementstack.de/' }) }
    async query() {
      return { success: true, result: [
        { success: true, results: [{ slug: target.slug, title: target.publish_payload.title, summary: target.publish_payload.dek, body: target.publish_payload.body, status: 'published', version: 1, article_layer: 'single_study', conclusion: target.publish_payload.conclusion, featured_image_url: null, featured_image_r2_key: null, reviewed_at: '2026-07-14T00:00:00Z', created_at: '2026-07-14T00:00:00Z', updated_at: '2026-07-14T00:00:00Z', sources_json: JSON.stringify(target.source_projection) }] },
        { success: true, results: [{ id: 10, article_slug: target.slug, label: target.source_relations[0].label, url: target.source_relations[0].url, sort_order: 0, created_at: '2026-07-14T00:00:00Z', updated_at: '2026-07-14T00:00:00Z' }] },
        { success: true, results: [{ article_slug: target.slug, ingredient_id: INGREDIENT_ID, sort_order: 0, created_at: '2026-07-14T00:00:00Z' }] },
        { success: true, results: [{ id: 20, ingredient_id: INGREDIENT_ID, source_id: projection.resolved_source_id, research_artifact_id: null, knowledge_article_slug: target.slug, status: 'accepted', structured_summary_json: JSON.stringify(projection.structured_summary), stage3_reference_summary: null, notes: 'manually-curated', review_notes: null, version: 1, created_at: '2026-07-14T00:00:00Z', updated_at: '2026-07-14T00:00:00Z' }] },
      ] }
    }
  }
  const adapter = new CompetingD1Adapter()
  await assert.rejects(() => adapter.inspectArticlesByTargets([target]), /conflicts with a non-pipeline-owned row/i)
})
