import assert from 'node:assert/strict'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, relative } from 'node:path'
import test from 'node:test'
import { buildArticleCorrectionInputReceiptV1 } from './lib/article-correction-v1.mjs'
import { canonicalJsonHash } from './lib/content-validation.mjs'
import { artifactHashV2 } from './lib/evidence-pipeline-v2.mjs'
import { SqliteContentPublicationAdapter, dispatchDeterministicWorkOrderV2, publicationGuardPayloadHash } from './lib/nutrient-content-machine-dispatcher.mjs'
import { loadNutrientContentRunManifest, runNutrientContent } from './lib/nutrient-content-runner.mjs'

function put(path, value) { mkdirSync(dirname(path), { recursive: true }); writeFileSync(path, typeof value === 'string' ? value : `${JSON.stringify(value, null, 2)}\n`, 'utf8'); return path }
function rel(root, path) { return relative(root, path).replaceAll('\\', '/') }
function hash(label) { return canonicalJsonHash({ label }) }
const INGREDIENT_ID = 7
const SOURCE_RESOLUTION_HASH = hash('source-resolution')
const PUBLISHED_AT = '2026-07-14T09:30:00.000Z'

function releaseArticle({ body = '## Einordnung\n\nDer Stoff ist gut verständlich.', writeGuard = { mode: 'create', expected_status: 'absent', expected_version: 0 }, reviewedAt = PUBLISHED_AT, publishedAt = PUBLISHED_AT, modifiedAt = PUBLISHED_AT } = {}) {
  const title = 'Teststoff verständlich erklärt'
  const description = 'Teststoff wird klar, quellengebunden und ohne unnötige Fachsprache verständlich eingeordnet.'
  const canonicalUrl = 'https://supplementstack.de/wissen/teststoff'
  const publicSeo = { meta_title: title, meta_description: description, canonical_url: canonicalUrl, canonical_path: '/wissen/teststoff', robots: 'index,follow', indexable: true, json_ld: { '@context': 'https://schema.org', '@type': 'Article', headline: title, description, mainEntityOfPage: canonicalUrl, inLanguage: 'de', datePublished: publishedAt, dateModified: modifiedAt } }
  const relations = [{ position: 0, source_id: 'source-a', label: 'Originalquelle', url: 'https://example.org/source-a' }]
  const publishPayload = { schema: 'article_visible_payload.v2', slug: 'teststoff', title, dek: description, body, conclusion: 'Die Einordnung bleibt klar begrenzt.', sources: relations.map(({ source_id, label, url }) => ({ source_id, label, url })) }
  const projection = { schema: 'article_render_projection.v2', article_id: 'main-teststoff', stage: 'stage3', route: '/wissen/teststoff', template: 'knowledge_magazine_v1', title, dek: description, body, sources: publishPayload.sources, assets: [] }
  const factsPackageHash = hash('facts')
  const relationHash = canonicalJsonHash(relations)
  return {
    article_id: 'main-teststoff', stage: 'stage3', article_layer: 'main_article', slug: 'teststoff', write_guard: writeGuard, desired_status: 'published', reviewed_at: reviewedAt, published_at: publishedAt, modified_at: modifiedAt, target: 'sqlite-test',
    article_byte_hash: hash('article'), facts_package_hash: factsPackageHash, evidence_membership_hash: hash('membership'), article_lineage_hash: hash('lineage'), framework_hash: hash('framework'),
    writer_execution_id: 'writer-a', validation_receipt_hash: hash('validation'), publication_review_hash: hash('publication-review'),
    compiled_payload_hash: hash(`compiled:${body}`), visible_payload_hash: hash(`visible:${body}`), qa_payload_hash: hash(`qa:${body}`), render_snapshot_hash: hash(`render:${body}`), relation_hash: relationHash,
    asset_hashes: [], seo: { ...publicSeo, seo_hash: canonicalJsonHash(publicSeo) }, seo_hash: canonicalJsonHash(publicSeo), publish_payload: publishPayload, source_relations: relations, assets: [],
    expected_projection: projection, projection_hash: canonicalJsonHash(projection), ingredient_ids: [INGREDIENT_ID], ingredient_relation_hash: canonicalJsonHash({ ingredient_ids: [INGREDIENT_ID] }),
    source_projection: { schema: 'knowledge_article_sources_projection.v2', facts_package_hash: factsPackageHash, ingredient_ids: [INGREDIENT_ID], relations, relation_hash: relationHash },
    stage2_interpretation_projection: [], internal_link_dependencies: [],
  }
}

function releaseContext(...articles) {
  const identity = { ingredient_id: INGREDIENT_ID, canonical_name: 'Teststoff', canonical_slug: 'teststoff', status: 'active', version: 3 }
  const candidate = articles.at(-1)
  return {
    ingredient_target: { ...identity, identity_hash: canonicalJsonHash(identity), receipt_hash: hash('ingredient-target-receipt') },
    source_resolution_receipt_hash: SOURCE_RESOLUTION_HASH,
    article_target_receipt_hash: candidate.write_guard.mode === 'update' ? hash('article-target-receipt') : null,
    asset_deployment_receipt_hash: articles.some((article) => article.assets.length) ? hash('asset-deployment-receipt') : null,
  }
}

function correctionFixture({ changeClass, beforeMarkdown, candidateMarkdown, beforeArticle = releaseArticle(), candidateArticle = null, requestMutator = null }) {
  const root = mkdtempSync(join(tmpdir(), `correction-${changeClass.toLowerCase()}-`))
  const beforePath = put(join(root, 'inputs', 'before.md'), beforeMarkdown)
  const candidatePath = put(join(root, 'inputs', 'candidate.md'), candidateMarkdown)
  const frozenCandidate = candidateArticle ?? beforeArticle
  const request = { schema: 'article_correction_request.v1', run_id: `correction-${changeClass.toLowerCase()}-run`, change_class: changeClass, release_context: releaseContext(beforeArticle, frozenCandidate), before: { markdown_path: rel(root, beforePath), release_article: beforeArticle }, candidate: { markdown_path: rel(root, candidatePath), release_article: frozenCandidate } }
  requestMutator?.(request)
  let input
  try { input = buildArticleCorrectionInputReceiptV1({ root, request, frozenAt: '2026-07-14T10:00:00.000Z' }) }
  catch (error) { rmSync(root, { recursive: true, force: true }); throw error }
  const inputPath = put(join(root, 'inputs', 'article-correction-input-receipt.v1.json'), input)
  const manifest = {
    schema: 'nutrient_content_run.v2', operation: 'article_correction', mode: 'test', run_id: request.run_id, substance: { slug: 'teststoff', language: 'de' }, policy: { version: 'policy-v2' }, render_profile: 'knowledge_magazine_v1',
    outputs: { state_dir: 'generated/state' }, correction: { change_class: changeClass, input_receipt_path: rel(root, inputPath) }, publish: { required: true, target: 'sqlite-test', public_base_url: 'https://supplementstack.de/' },
  }
  const manifestPath = put(join(root, 'run.json'), manifest)
  return { root, manifestPath, input, beforeArticle, candidateArticle: frozenCandidate, state: join(root, 'generated', 'state'), cleanup: () => rmSync(root, { recursive: true, force: true }) }
}

async function publishReadyCorrection(fixture, status) {
  assert.equal(status.state, 'READY_TO_PUBLISH')
  const order = status.work_orders.work_orders.find((entry) => entry.kind === 'publication_apply')
  assert.ok(order)
  const context = loadNutrientContentRunManifest(fixture.manifestPath)
  const adapter = new SqliteContentPublicationAdapter()
  try {
    if (fixture.candidateArticle.write_guard.mode === 'update') adapter.seedArticle(fixture.beforeArticle, { version: fixture.candidateArticle.write_guard.expected_version, status: fixture.candidateArticle.write_guard.expected_status })
    const receipt = await dispatchDeterministicWorkOrderV2({ context, workOrder: order, adapter, publishEnabled: true })
    assert.equal(receipt.atomic_batch.result, 'COMMITTED')
    assert.equal(receipt.badge_readback.result, 'MATCH')
    assert.deepEqual(receipt.badge_readback.affected_ingredient_ids, [INGREDIENT_ID])
    assert.ok(receipt.article_results.every((entry) => entry.readbacks.dom.result === 'MATCH' && entry.readbacks.seo.result === 'MATCH'))
    const release = JSON.parse(readFileSync(join(fixture.state, 'release', 'content-release.v2.json'), 'utf8'))
    assert.equal(release.ingredient_target.identity_hash, fixture.input.release_context.ingredient_target.identity_hash)
    assert.equal(release.source_resolution_receipt_hash, fixture.input.release_context.source_resolution_receipt_hash)
    assert.equal(release.article_target_receipt_hash, fixture.input.release_context.article_target_receipt_hash)
    assert.equal(release.asset_deployment_receipt_hash, fixture.input.release_context.asset_deployment_receipt_hash)
  } finally { adapter.close() }
  const complete = runNutrientContent({ manifestPath: fixture.manifestPath })
  assert.equal(complete.state, 'COMPLETE')
  assert.equal(complete.published, true)
  return complete
}

test('S correction deletes only non-visible representation and reaches publication with zero LLM WorkOrders', async () => {
  const fixture = correctionFixture({ changeClass: 'S', beforeMarkdown: '# Teststoff\n\nDer Stoff ist gut verständlich.\n\n<!-- obsolete -->\n', candidateMarkdown: '# Teststoff\n\nDer Stoff ist gut verständlich.\n' })
  try {
    const status = runNutrientContent({ manifestPath: fixture.manifestPath })
    assert.equal(status.correction_route.class, 'S')
    assert.equal(status.correction_route.llm_work_orders, 0)
    assert.deepEqual(status.work_orders.work_orders.map((entry) => entry.kind), ['publication_apply'])
    await publishReadyCorrection(fixture, status)
  } finally { fixture.cleanup() }
})

test('S correction fails closed when visible meaning changes', () => {
  const fixture = correctionFixture({ changeClass: 'S', beforeMarkdown: '# Teststoff\n\nDer Stoff ist gut verständlich.\n', candidateMarkdown: '# Teststoff\n\nDer Stoff ist völlig anders.\n', candidateArticle: releaseArticle({ body: '## Einordnung\n\nDer Stoff ist völlig anders.' }) })
  try { assert.throws(() => runNutrientContent({ manifestPath: fixture.manifestPath }), /S correction changes forbidden semantic fields/i) } finally { fixture.cleanup() }
})

test('correction input fails closed on forged publication lineage', () => {
  assert.throws(() => correctionFixture({
    changeClass: 'S', beforeMarkdown: '# Teststoff\n\nDer Stoff ist gut verständlich.\n\n<!-- obsolete -->\n', candidateMarkdown: '# Teststoff\n\nDer Stoff ist gut verständlich.\n',
    requestMutator: (request) => { request.release_context.ingredient_target.identity_hash = hash('forged-identity') },
  }), /ingredient_target\.identity_hash is stale/i)
})

test('M correction cannot hide a number or unit change only inside the publish payload', () => {
  const fixture = correctionFixture({
    changeClass: 'M',
    beforeMarkdown: '# Teststoff\n\nDer Stoff ist gut verständlich.\n',
    candidateMarkdown: '# Teststoff\n\nDer Stoff ist klar verständlich.\n',
    candidateArticle: releaseArticle({ body: '## Einordnung\n\nDer Stoff ist klar verständlich.\n\nDie Menge beträgt 10 mg.' }),
  })
  try { assert.throws(() => runNutrientContent({ manifestPath: fixture.manifestPath }), /release_number_unit_tokens/i) } finally { fixture.cleanup() }
})

test('M correction runs exactly one editor and one independent neighbourhood review before the same publisher', async () => {
  const beforeArticle = releaseArticle()
  const candidateArticle = releaseArticle({
    body: '## Einordnung\n\nDer Stoff ist klar verständlich.',
    writeGuard: { mode: 'update', expected_status: 'published', expected_version: 1, expected_payload_hash: publicationGuardPayloadHash(beforeArticle) },
    reviewedAt: '2026-07-14T12:00:00.000Z', publishedAt: PUBLISHED_AT, modifiedAt: '2026-07-14T12:00:00.000Z',
  })
  const fixture = correctionFixture({ changeClass: 'M', beforeMarkdown: '# Teststoff\n\nDer Stoff ist gut verständlich.\n', candidateMarkdown: '# Teststoff\n\nDer Stoff ist klar verständlich.\n', beforeArticle, candidateArticle })
  try {
    let status = runNutrientContent({ manifestPath: fixture.manifestPath })
    assert.equal(status.state, 'WAITING_FOR_CORRECTION')
    const editorOrder = status.work_orders.work_orders[0]
    assert.equal(editorOrder.kind, 'article_correction')
    const resultBase = { schema: 'article_correction_result.v1', result: 'PASS', input_receipt_hash: fixture.input.content_hash, candidate_markdown_byte_hash: fixture.input.candidate.markdown_byte_hash, candidate_release_article_hash: fixture.input.candidate.release_article_hash, patch_hash: fixture.input.patch.patch_hash, editor: { role: 'article-correction-editor', id: 'correction-editor-a' }, edited_at: '2026-07-14T11:00:00.000Z', work_order_id: editorOrder.work_order_id }
    const result = { ...resultBase, content_hash: artifactHashV2(resultBase) }
    put(join(fixture.state, 'correction', 'article-correction-result.v1.json'), result)
    status = runNutrientContent({ manifestPath: fixture.manifestPath })
    assert.equal(status.state, 'WAITING_FOR_CORRECTION_REVIEW')
    const reviewOrder = status.work_orders.work_orders[0]
    assert.equal(reviewOrder.kind, 'article_correction_review')
    assert.deepEqual(reviewOrder.assignee.independent_from_ids, ['correction-editor-a'])
    const reviewBase = { schema: 'article_correction_review.v1', result: 'PASS', input_receipt_hash: fixture.input.content_hash, correction_result_hash: result.content_hash, patch_hash: fixture.input.patch.patch_hash, reviewer: { role: 'article-correction-reviewer', id: 'correction-reviewer-a' }, reviewed_at: '2026-07-14T12:00:00.000Z', work_order_id: reviewOrder.work_order_id, checks: { changed_lines_and_neighbourhood: 'PASS', readability: 'PASS', no_system_language: 'PASS', unchanged_scientific_meaning: 'PASS' }, findings: [] }
    put(join(fixture.state, 'correction', 'article-correction-review.v1.json'), { ...reviewBase, content_hash: artifactHashV2(reviewBase) })
    status = runNutrientContent({ manifestPath: fixture.manifestPath })
    assert.equal(status.correction_route.class, 'M')
    assert.deepEqual(status.correction_route.phases, ['article_correction', 'article_correction_review'])
    await publishReadyCorrection(fixture, status)
    const publishReceipt = JSON.parse(readFileSync(join(fixture.state, 'publish', 'content-publish-receipt.v2.json'), 'utf8'))
    assert.equal(publishReceipt.article_results[0].resulting_version, 2)
    assert.equal(publishReceipt.article_results[0].readbacks.public_api.actual.created_at, PUBLISHED_AT)
    assert.equal(publishReceipt.article_results[0].readbacks.public_api.actual.updated_at, '2026-07-14T12:00:00.000Z')
  } finally { fixture.cleanup() }
})

test('M review cannot reuse the editor identity', () => {
  const fixture = correctionFixture({ changeClass: 'M', beforeMarkdown: '# Teststoff\n\nDer Stoff ist gut verständlich.\n', candidateMarkdown: '# Teststoff\n\nDer Stoff ist klar verständlich.\n', candidateArticle: releaseArticle({ body: '## Einordnung\n\nDer Stoff ist klar verständlich.' }) })
  try {
    let status = runNutrientContent({ manifestPath: fixture.manifestPath }), order = status.work_orders.work_orders[0]
    const resultBase = { schema: 'article_correction_result.v1', result: 'PASS', input_receipt_hash: fixture.input.content_hash, candidate_markdown_byte_hash: fixture.input.candidate.markdown_byte_hash, candidate_release_article_hash: fixture.input.candidate.release_article_hash, patch_hash: fixture.input.patch.patch_hash, editor: { role: 'article-correction-editor', id: 'same-agent' }, edited_at: '2026-07-14T11:00:00.000Z', work_order_id: order.work_order_id }
    const result = { ...resultBase, content_hash: artifactHashV2(resultBase) }; put(join(fixture.state, 'correction', 'article-correction-result.v1.json'), result)
    status = runNutrientContent({ manifestPath: fixture.manifestPath }); order = status.work_orders.work_orders[0]
    const reviewBase = { schema: 'article_correction_review.v1', result: 'PASS', input_receipt_hash: fixture.input.content_hash, correction_result_hash: result.content_hash, patch_hash: fixture.input.patch.patch_hash, reviewer: { role: 'article-correction-reviewer', id: 'same-agent' }, reviewed_at: '2026-07-14T12:00:00.000Z', work_order_id: order.work_order_id, checks: { changed_lines_and_neighbourhood: 'PASS', readability: 'PASS', no_system_language: 'PASS', unchanged_scientific_meaning: 'PASS' }, findings: [] }
    put(join(fixture.state, 'correction', 'article-correction-review.v1.json'), { ...reviewBase, content_hash: artifactHashV2(reviewBase) })
    status = runNutrientContent({ manifestPath: fixture.manifestPath })
    assert.equal(status.state, 'BLOCKED')
    assert.equal(status.work_orders.work_orders[0].kind, 'article_correction_review_integrity_escalation')
  } finally { fixture.cleanup() }
})
