import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, relative, resolve } from 'node:path'
import test from 'node:test'
import { artifactHashV2, buildEvidencePipelineV2, buildReviewSampleV2, loadEvidenceManifestV2, mergeEvidenceV2, validateCoveragePlanV2, validateEvidencePipelineLockV2, validateFactsPackageForImportV2, validateStackProjectionV2 } from './lib/evidence-pipeline-v2.mjs'
import { canonicalJsonHash, sha256Bytes } from './lib/content-validation.mjs'
import { buildContentReleaseV2, buildTechnicalSeo, findDuplicateLiveSeoTitleV2, normalizeVisibleSeoTextV2, projectInlineLinksV2, projectVisibleAssetV2, stage3PresentationSourcesV2, technicalMetaTitleV2, validateNumberUnitTokens, writerWorkOrderIdV2 } from './lib/article-runtime-v2.mjs'
import { STATE_WORK_ORDER_MATRIX, WORK_ORDER_KIND_CONTRACTS, findDuplicateReleaseSeoGroupsV2, groupDuplicateReleaseSeoRepairsV2, isStaleWriterBindingError, loadNutrientContentRunManifest, repairFailureBundle, runNutrientContent, selectFrameworkGapTransition, selectReusableInitialWriterOrderV2, selectReusablePublicationQaOrderV2, summarizeWorkOrderTimingsV1 } from './lib/nutrient-content-runner.mjs'
import { buildSourceCatalogSyncRequestV1, buildStage2InterpretationProjectionV1 } from './lib/content-publication-targets-v2.mjs'
import { buildKnowledgeBadgeExpectationsV1 } from './lib/knowledge-badge-readback-v1.mjs'
import { buildRendererPublicReadbackRequestV2, SqliteContentPublicationAdapter, dispatchDeterministicWorkOrderV2 } from './lib/nutrient-content-machine-dispatcher.mjs'
import { stageArticleAssetsV1 } from './lib/article-asset-deployment-v1.mjs'
import { buildIndexabilityReleaseReceiptV1 } from './lib/indexability-release-v1.mjs'

const ROOT = resolve(dirname(new URL(import.meta.url).pathname.replace(/^\/(?:[A-Za-z]:)/, (match) => match.slice(1))), '..')
const PNG_1X1 = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl2nYQAAAAASUVORK5CYII=', 'base64')
const PNG_1X1_HASH = sha256Bytes(PNG_1X1)
const TEST_ASSET_R2_KEY = `knowledge/main-a/${PNG_1X1_HASH.slice('sha256:'.length)}.png`
const TEST_ASSET_PUBLIC_URL = `/api/r2/${TEST_ASSET_R2_KEY}`
const TEST_SOURCE_LABEL = 'Testautor et al. (2024). Originalstudie. Testjournal.'
const KNOWLEDGE_MAGAZINE_FRAMEWORK_BYTE_HASH = 'sha256:d7a6cab31f287c631226bc75d49e70470cbf84cc80c98445cd7001b7ed6bc727'

test('Stage-2 interpretation projection skips factless meta-family constituents while preserving fact-bearing owners', () => {
  const owner = { source_id: 'meta-owner', source_content_hash: canonicalJsonHash({ label: 'meta-owner' }) }
  const constituent = { source_id: 'meta-constituent', source_content_hash: canonicalJsonHash({ label: 'meta-constituent' }) }
  const projection = buildStage2InterpretationProjectionV1({
    article: { article_id: 'calcium-meta-family', slug: 'calcium-meta-family', stage: 'stage2' },
    factsPackage: {
      article_package_hash: canonicalJsonHash({ label: 'package' }),
      evidence_membership_hash: canonicalJsonHash({ label: 'membership' }),
      visible_sources: [owner, constituent],
      facts: [{
        record_id: 'record-owner', obligation_id: 'obligation-owner', source_id: owner.source_id, cluster_id: 'cluster-owner',
        claim_type: 'outcome', subject_key: 'calcium', predicate_key: 'effect', context: {}, conflict_set_id: null,
        claim: 'Die Meta-Analyse berichtet den freigegebenen Endpunkt.', locator: { page: 1 },
      }],
    },
    ingredientTarget: { ingredient_id: 42 },
    sourceResolution: {
      receipt_hash: canonicalJsonHash({ label: 'source-resolution' }),
      bySourceId: new Map([
        [owner.source_id, { resolved_source_id: 101 }],
        [constituent.source_id, { resolved_source_id: 102 }],
      ]),
    },
  })

  assert.equal(projection.length, 1)
  assert.equal(projection[0].local_source_id, owner.source_id)
  assert.equal(projection[0].resolved_source_id, 101)
  assert.deepEqual(projection[0].structured_summary.record_ids, ['record-owner'])

  assert.throws(() => buildStage2InterpretationProjectionV1({
    article: { article_id: 'calcium-meta-family', slug: 'calcium-meta-family', stage: 'stage2' },
    factsPackage: { visible_sources: [constituent], facts: [] },
    ingredientTarget: { ingredient_id: 42 },
    sourceResolution: { receipt_hash: canonicalJsonHash({ label: 'source-resolution' }), bySourceId: new Map() },
  }), /has no authoritative catalog resolution/)

  assert.deepEqual(buildStage2InterpretationProjectionV1({
    article: { article_id: 'factless-stage2', slug: 'factless-stage2', stage: 'stage2' },
    factsPackage: { visible_sources: [constituent], facts: [] },
    ingredientTarget: { ingredient_id: 42 },
    sourceResolution: {
      receipt_hash: canonicalJsonHash({ label: 'source-resolution' }),
      bySourceId: new Map([[constituent.source_id, { resolved_source_id: 102 }]]),
    },
  }), [])
})

test('visible SEO normalization removes supported inline Markdown and preserves the required German micro sign', () => {
  assert.equal(normalizeVisibleSeoTextV2('  4,0 µg   Vitamin B12  '), '4,0 µg Vitamin B12')
  assert.notEqual(normalizeVisibleSeoTextV2('4,0 µg'), '4,0 μg')
  assert.equal(normalizeVisibleSeoTextV2(' Eine **klare** und *vorsichtige* Einordnung. '), 'Eine klare und vorsichtige Einordnung.')
  assert.equal(technicalMetaTitleV2('**Teststoff** im Überblick'), 'Teststoff im Überblick')
})

test('compiler inline links and visible assets use one marker-free projection pass', () => {
  assert.deepEqual(
    projectInlineLinksV2('[\\*literal\\*](#fazit), [protokollrelativ](//example.com), [Zugangsdaten](https://user:pass@example.com) und [**Wissen**](/wissen/test).'),
    [{ label: '*literal*', url: '#fazit' }, { label: 'Wissen', url: '/wissen/test' }],
  )
  assert.deepEqual(
    projectVisibleAssetV2({ public_url: '/api/r2/knowledge/schema.png', alt: '**Schema**', caption: 'Eine **klare** Einordnung.' }),
    { src: '/api/r2/knowledge/schema.png', alt: 'Schema', caption: 'Eine klare Einordnung.' },
  )
})

test('technical meta title shortens long visible titles deterministically without changing the H1', () => {
  const visibleTitle = 'Vitamin C und die langfristige Vorbeugung von Herz-Kreislauf-Erkrankungen in randomisierten Studien'
  const metaTitle = technicalMetaTitleV2(visibleTitle)
  assert.equal(metaTitle, 'Vitamin C und die langfristige Vorbeugung von…')
  assert.ok(metaTitle.length >= 15 && metaTitle.length <= 70)
  assert.equal(technicalMetaTitleV2(visibleTitle), metaTitle)
  assert.equal(visibleTitle, 'Vitamin C und die langfristige Vorbeugung von Herz-Kreislauf-Erkrankungen in randomisierten Studien')
  assert.equal(technicalMetaTitleV2('  4,0 µg   Vitamin B12 im Alltag  '), '4,0 µg Vitamin B12 im Alltag')
  assert.equal(technicalMetaTitleV2(`Cafe\u0301 ${'x'.repeat(80)}`).normalize('NFC'), `Café ${'x'.repeat(64)}…`)
  assert.equal(technicalMetaTitleV2(visibleTitle, 'Vitamin B1'), 'Vitamin B1: Vitamin C und die langfristige Vorbeugung von…')
  assert.equal(technicalMetaTitleV2('Präeklampsie', 'Calcium'), 'Calcium: Präeklampsie')
  assert.equal(technicalMetaTitleV2('Calcium', 'Calcium'), 'Calcium: Originalquelle')
})

test('technical SEO gives a short exact Stage-2 source H1 deterministic context', () => {
  const seo = buildTechnicalSeo({
    context: { linkInventory: { routes: [] }, publish: { publicBaseUrl: 'https://supplementstack.de/' } },
    article: { article_id: 'kalium-reference-dge-2026', slug: 'kalium-reference-dge-2026', stage: 'stage2' },
    factsPackage: {
      language: 'de', substance: { slug: 'kalium' }, selected_link_slice: { links: [] },
      seo_brief: { primary_intent: 'Originalquelle auf Deutsch verstehen', internal_link_targets: [] },
    },
    publishPayload: {
      title: 'Kalium',
      dek: 'Der DGE-Schätzwert für Erwachsene wird quellengebunden und verständlich eingeordnet.',
    },
  })
  assert.equal(seo.meta_title, 'Kalium: Originalquelle')
})

test('live SEO collision guard compares the persisted technical meta title with legacy H1 fallback', () => {
  const technicalTitle = 'Gemeinsamer gekürzter Studientitel…'
  const technicalCollision = { slug: 'live-a', title: 'Ein anderer und deutlich längerer sichtbarer H1', meta_title: technicalTitle }
  const legacyCollision = { slug: 'live-b', title: technicalTitle }
  assert.equal(findDuplicateLiveSeoTitleV2([technicalCollision], 'candidate', technicalTitle), technicalCollision)
  assert.equal(findDuplicateLiveSeoTitleV2([legacyCollision], 'candidate', technicalTitle), legacyCollision)
  assert.equal(findDuplicateLiveSeoTitleV2([technicalCollision], 'live-a', technicalTitle), null)
})

test('quantity guard accepts source-claim-bound German thousands, comparison values and compound fact units', () => {
  const article = { article_id: 'ginseng-main' }
  const factsPackage = { facts: [
    { value: 1000, unit: 'mg/Tag', claim: 'Geprüft wurden 1.000 mg pro Tag.' },
    { value: 2000, unit: 'mg Tabletten/Tag', claim: 'Geprüft wurden 2.000 mg; dies entsprach 3 g Extrakt.' },
    { value: 39.2, unit: '% KRG-Gruppe', claim: 'Ereignisse: 39,2 % gegenüber 42,0 %.' },
  ] }
  assert.doesNotThrow(() => validateNumberUnitTokens(article, factsPackage, '1.000 mg, 2.000 mg, 3 g sowie 39,2 % und 42,0 %'))
  assert.throws(() => validateNumberUnitTokens(article, factsPackage, 'Falsche Tausender-Aliasform: 1 mg.'), /1 mg/)
  assert.throws(() => validateNumberUnitTokens(article, factsPackage, 'Nicht belegt: 4 g.'), /4 g/)
  assert.throws(() => validateNumberUnitTokens(article, { facts: [{ value: 1, unit: 'g', claim: 'Geprüft wurden 1,000 g.' }] }, 'Falsche Komma-Aliasform: 1000 g.'), /1000 g/)
  assert.throws(() => validateNumberUnitTokens(article, { facts: [{ value: 1000, unit: 'mg', claim: 'Geprüft wurden 1 000 mg.' }] }, 'Falsche Space-Aliasform: 0 mg.'), /0 mg/)
  assert.throws(() => validateNumberUnitTokens(article, { facts: [{ value: 0.5, unit: 'mg', claim: 'Geprüft wurden 0.5 mg.' }] }, 'Falsche Punktdezimal-Aliasform: 5 mg.'), /5 mg/)
})

test('quantity guard accepts approved study conditions from fact context only', () => {
  const article = { article_id: 'vitamin-c-study' }
  const factsPackage = { facts: [{
    value: null,
    unit: null,
    claim: 'Die Intervention und Vergleichsgruppe wurden im freigegebenen Kontext beschrieben.',
    context: {
      intervention_or_exposure: 'Täglich 1–2 g Vitamin C.',
      comparator: 'Verglichen wurden Dosierungen von 125–200 mg.',
      endpoints: ['Dieser nicht-stringförmige Wert ist nicht freigegeben: 9 g.'],
    },
  }] }
  assert.doesNotThrow(() => validateNumberUnitTokens(article, factsPackage, 'Untersucht wurden 1–2 g; die Vergleichsdosen lagen bei 125–200 mg.'))
  assert.throws(() => validateNumberUnitTokens(article, factsPackage, 'Nicht gebundene Bedingung: 9 g.'), /9 g/)
})

test('release SEO duplicate grouping reports every colliding article deterministically', () => {
  const compiled = [
    { article: { article_id: 'article-c' }, compiled: { seo: { meta_title: 'Gleicher Titel', meta_description: 'Gleicher Text' } } },
    { article: { article_id: 'article-a' }, compiled: { seo: { meta_title: ' gleicher   titel ', meta_description: ' gleicher   text ' } } },
    { article: { article_id: 'article-b' }, compiled: { seo: { meta_title: 'Gleicher Titel', meta_description: 'Gleicher Text' } } },
  ]
  const groups = findDuplicateReleaseSeoGroupsV2(compiled)
  assert.equal(groups.length, 2)
  assert.deepEqual(groups.map((group) => group.field), ['meta_description', 'meta_title'])
  assert.ok(groups.every((group) => JSON.stringify(group.article_ids) === JSON.stringify(['article-a', 'article-b', 'article-c'])))
  const assignments = groupDuplicateReleaseSeoRepairsV2(groups)
  assert.deepEqual(assignments.map((entry) => entry.article_id), ['article-a', 'article-b', 'article-c'])
  assert.ok(assignments.every((entry) => entry.groups.length === 2))
  const first = repairFailureBundle({ root: ROOT }, { article_id: 'article-a' }, 1, 'compiler', { code: 'duplicate-release-seo-fields', groups: assignments[0].groups })
  const second = repairFailureBundle({ root: ROOT }, { article_id: 'article-a' }, 1, 'compiler', { code: 'duplicate-release-seo-fields', groups: assignments[0].groups.slice(0, 1) })
  assert.equal(first.bundledFindings[0].code, 'duplicate-release-seo-fields')
  assert.deepEqual(first.bundledFindings[0].groups, assignments[0].groups)
  assert.notEqual(first.failureFingerprint, second.failureFingerprint)
})

test('stale writer lineage is reissued instead of consuming a compiler repair fingerprint', () => {
  assert.equal(isStaleWriterBindingError(new Error('article-a writer receipt work_order_id differs from the exact issued contract')), true)
  assert.equal(isStaleWriterBindingError(new Error('article-a writer receipt does not bind current article bytes')), true)
  assert.equal(isStaleWriterBindingError(new Error('article-a writer receipt record/source set differs from facts package')), true)
  assert.equal(isStaleWriterBindingError(new Error('article-a SEO description length must be 40..180 characters')), false)
  assert.equal(isStaleWriterBindingError(new Error('article-a contains quantity/unit tokens not present in its original-source facts: 4 g')), false)
})

test('initial writer reuse preserves cache-neutral orders but rebinds changed facts inputs', () => {
  const base = { kind: 'writer', execution_class: 'llm', reasoning_tier: 'high', substance: { slug: 'test', language: 'de' }, scope: {}, assignee: {}, inputs: [{ name: 'facts_package', content_hash: canonicalJsonHash({ version: 1 }) }], reused_sources: [], link_inventory: null, outputs: [], task: { article_id: 'article-a', revision: 0, facts_package_hash: canonicalJsonHash({ version: 1 }) }, constraints: {} }
  const stale = { ...base, work_order_id: canonicalJsonHash({ order: 'stale' }), wave_index: 1, reason: 'old' }
  const current = { ...base, work_order_id: canonicalJsonHash({ order: 'current' }), wave_index: 4, reason: 'current' }
  assert.equal(selectReusableInitialWriterOrderV2([stale], current), stale)
  const rebound = structuredClone(current)
  rebound.inputs[0].content_hash = canonicalJsonHash({ version: 2 })
  rebound.task.facts_package_hash = canonicalJsonHash({ version: 2 })
  assert.equal(selectReusableInitialWriterOrderV2([stale], rebound), rebound)
})

test('publication QA reuse requires the complete current compiler lineage', () => {
  const binding = {
    articleId: 'article-a', revision: 0, qaPayloadHash: canonicalJsonHash({ qa: 1 }),
    renderSnapshotHash: canonicalJsonHash({ render: 1 }), projectionHash: canonicalJsonHash({ projection: 1 }),
    writerExecutionId: 'writer-a', compiledPayloadHash: canonicalJsonHash({ compiled: 1 }),
    factsPackageHash: canonicalJsonHash({ facts: 1 }), validationReceiptHash: canonicalJsonHash({ validation: 1 }),
    writerReceiptHash: canonicalJsonHash({ writer: 1 }),
  }
  const order = {
    kind: 'publication_qa',
    task: {
      article_id: binding.articleId, revision: binding.revision, qa_payload_hash: binding.qaPayloadHash,
      render_snapshot_hash: binding.renderSnapshotHash, projection_hash: binding.projectionHash,
      writer_execution_id: binding.writerExecutionId,
    },
    inputs: [
      { name: 'compiled_article', content_hash: binding.compiledPayloadHash },
      { name: 'facts_package', content_hash: binding.factsPackageHash },
      { name: 'validation_receipt', content_hash: binding.validationReceiptHash },
      { name: 'writer_result', content_hash: binding.writerReceiptHash },
    ],
  }
  assert.equal(selectReusablePublicationQaOrderV2([order], binding), order)
  assert.equal(selectReusablePublicationQaOrderV2([order], { ...binding, compiledPayloadHash: canonicalJsonHash({ compiled: 2 }) }), null)
  assert.equal(selectReusablePublicationQaOrderV2([order], { ...binding, validationReceiptHash: canonicalJsonHash({ validation: 2 }) }), null)
})

test('Stage-3 compiler freezes complete internal Stage-2 source presentation before render and QA', () => {
  const factsPackage = {
    stage: 'stage3',
    source_presentation_policy: 'internal_stage2_only',
    visible_sources: [
      { source_id: 'source-a', label: 'Autor A (2024). Studie A. Journal.', source_url: 'https://example.org/a', author_or_institution: 'Autor A', publication_year: 2024, title: 'Studie A', journal_or_publisher: 'Journal', doi: null, pubmed_id: null },
      { source_id: 'source-b', label: 'Autor B (2023). Studie B. Journal.', source_url: 'https://example.org/b', author_or_institution: 'Autor B', publication_year: 2023, title: 'Studie B', journal_or_publisher: 'Journal', doi: null, pubmed_id: null },
    ],
    presentation_sources: [{
      source_id: 'internal-article-study-overview', label: 'Studienüberblick zu Teststoff', source_url: '/wissen/study-overview',
      target_article_id: 'study-overview', covered_source_ids: ['source-a', 'source-b'],
    }],
  }
  assert.deepEqual(stage3PresentationSourcesV2(factsPackage), [{
    source_id: 'internal-article-study-overview', label: 'Studienüberblick zu Teststoff', url: '/wissen/study-overview',
  }])
  const incomplete = structuredClone(factsPackage)
  incomplete.presentation_sources[0].covered_source_ids = ['source-a']
  assert.throws(() => stage3PresentationSourcesV2(incomplete), /do not cover every original evidence source/i)
  const empty = structuredClone(factsPackage)
  empty.presentation_sources = []
  assert.throws(() => stage3PresentationSourcesV2(empty), /cannot be empty/i)
  const missing = structuredClone(factsPackage)
  delete missing.presentation_sources
  assert.throws(() => stage3PresentationSourcesV2(missing), /presentation_sources must be an array/i)
  const legacy = structuredClone(factsPackage)
  delete legacy.presentation_sources
  delete legacy.source_presentation_policy
  assert.deepEqual(stage3PresentationSourcesV2(legacy), legacy.visible_sources.map((source) => ({ source_id: source.source_id, label: source.label, url: source.source_url })))
})

test('new Stage-3 evidence packages fail closed when no internal Stage-2 source presentation is planned', () => {
  const fixture = createFixture({ stages: ['stage3'] })
  try {
    const coverage = json(fixture.paths.coverage)
    coverage.articles[0].seo_brief.internal_link_targets = []
    coverage.articles[0].selected_link_slice = { links: [], slice_hash: canonicalJsonHash({ links: [] }) }
    coverage.content_hash = artifactHashV2(coverage)
    put(fixture.paths.coverage, coverage)
    const manifest = json(fixture.paths.evidenceManifest)
    manifest.coverage_plan_hash = coverage.content_hash
    manifest.content_hash = artifactHashV2(manifest)
    put(fixture.paths.evidenceManifest, manifest)
    const shard = json(fixture.paths.shard)
    shard.coverage_plan_hash = coverage.content_hash
    shard.content_hash = artifactHashV2(shard)
    put(fixture.paths.shard, shard)

    assert.throws(
      () => loadEvidenceManifestV2(fixture.paths.evidenceManifest),
      /must present every original source exactly once through internal Stage-2 links/i,
    )
  } finally { fixture.cleanup() }
})

test('Stage-3 coverage requires an explicit common-assumption review with evidence bindings', () => {
  const fixture = createFixture({ stages: ['stage3'] })
  try {
    const raw = json(fixture.paths.coverage)
    delete raw.articles[0].common_assumption_review
    raw.content_hash = artifactHashV2(raw)
    assert.throws(() => validateCoveragePlanV2(raw, { researchHash: raw.research_hash, substance: 'teststoff', language: 'de' }), /common_assumption_review must be an object/i)

    raw.articles[0].common_assumption_review = { status: 'none_identified', discovery_note: 'The scoped searches found no material recurring public assumption.', checks: [] }
    raw.content_hash = artifactHashV2(raw)
    assert.equal(validateCoveragePlanV2(raw, { researchHash: raw.research_hash, substance: 'teststoff', language: 'de' }).articles[0].common_assumption_review.status, 'none_identified')

    raw.articles[0].common_assumption_review = { status: 'identified', discovery_note: 'A recurring reader question was found.', checks: [{ assumption_id: 'test-assumption', assumption: 'Teststoff always works.', reader_question: 'Does Teststoff always work?', discovery_basis: 'Recurring reader question, not a prevalence estimate.', source_ids: ['source-a'], cluster_ids: ['core'], obligation_ids: ['missing-obligation'] }] }
    raw.content_hash = artifactHashV2(raw)
    assert.throws(() => validateCoveragePlanV2(raw, { researchHash: raw.research_hash, substance: 'teststoff', language: 'de' }), /unknown\/non-article obligation/i)
  } finally { fixture.cleanup() }
})

test('Stage-2 multi-source assignment accepts only direct research lines or meta-analysis constituents', () => {
  const fixture = createFixture({ stages: ['stage2'] })
  try {
    const raw = json(fixture.paths.coverage)
    raw.sources.push({ ...raw.sources[0], source_id: 'source-b', title: 'Follow-up study', label: 'Testautor et al. (2024). Follow-up study. Testjournal.', url: 'https://example.org/follow-up', canonical_url: 'https://example.org/follow-up' })
    raw.clusters[0].source_ids.push('source-b')
    raw.articles[0].source_ids.push('source-b')
    raw.extraction_obligations.push({ obligation_id: 'obligation-b', source_id: 'source-b', cluster_id: 'core', expected_claim_type: 'follow_up_result', required: true, required_for: ['study-a'], plan_risk_tags: [] })
    raw.content_hash = artifactHashV2(raw)
    assert.throws(() => validateCoveragePlanV2(raw, { researchHash: raw.research_hash, substance: 'teststoff', language: 'de' }), /single_source requires exactly one source/i)

    raw.articles[0].source_assignment = { mode: 'direct_research_line', anchor_source_id: 'source-a', relations: [{ source_id: 'source-b', related_to_source_id: 'source-a', relation_type: 'same_topic', rationale: 'Both sources discuss the same topic.' }] }
    raw.content_hash = artifactHashV2(raw)
    assert.throws(() => validateCoveragePlanV2(raw, { researchHash: raw.research_hash, substance: 'teststoff', language: 'de' }), /non-lineage relation/i)

    raw.articles[0].source_assignment.relations[0] = { source_id: 'source-b', related_to_source_id: 'source-a', relation_type: 'replication', rationale: 'The later study explicitly replicates the original protocol.' }
    raw.content_hash = artifactHashV2(raw)
    assert.equal(validateCoveragePlanV2(raw, { researchHash: raw.research_hash, substance: 'teststoff', language: 'de' }).articles[0].source_assignment.mode, 'direct_research_line')

    raw.articles[0].source_assignment = { mode: 'meta_analysis_family', anchor_source_id: 'source-a', relations: [{ source_id: 'source-b', related_to_source_id: 'source-a', relation_type: 'meta_constituent', rationale: 'The review includes this study.' }] }
    raw.content_hash = artifactHashV2(raw)
    assert.throws(() => validateCoveragePlanV2(raw, { researchHash: raw.research_hash, substance: 'teststoff', language: 'de' }), /anchor must be a meta-analysis/i)
    raw.sources[0].source_type = 'systematic_review'
    raw.content_hash = artifactHashV2(raw)
    assert.equal(validateCoveragePlanV2(raw, { researchHash: raw.research_hash, substance: 'teststoff', language: 'de' }).articles[0].source_assignment.mode, 'meta_analysis_family')
    raw.sources[1].source_type = 'systematic_review'
    raw.content_hash = artifactHashV2(raw)
    assert.equal(validateCoveragePlanV2(raw, { researchHash: raw.research_hash, substance: 'teststoff', language: 'de' }).articles[0].source_assignment.mode, 'meta_analysis_family')
    raw.sources[1].source_kind = 'official'
    raw.content_hash = artifactHashV2(raw)
    assert.throws(() => validateCoveragePlanV2(raw, { researchHash: raw.research_hash, substance: 'teststoff', language: 'de' }), /constituents must be study sources/i)
  } finally { fixture.cleanup() }
})

test('coverage rejects duplicate canonical source identities before Stage-2 assignment', () => {
  const fixture = createFixture({ stages: ['stage2'] })
  try {
    const raw = json(fixture.paths.coverage)
    raw.sources.push({ ...raw.sources[0], source_id: 'source-b', title: 'Duplicate locator row', label: 'Testautor et al. (2024). Duplicate locator row. Testjournal.', url: 'https://example.org/alternate-locator' })
    raw.content_hash = artifactHashV2(raw)
    assert.throws(() => validateCoveragePlanV2(raw, { researchHash: raw.research_hash, substance: 'teststoff', language: 'de' }), /duplicate canonical URL identity/i)
  } finally { fixture.cleanup() }
})

test('Stage-3 source presentation is an exact partition across internal Stage-2 links', () => {
  const fixture = createFixture({ stages: ['stage3'] })
  try {
    const raw = json(fixture.paths.coverage)
    const links = [
      raw.articles[0].selected_link_slice.links[0],
      { path: '/wissen/vitamin-a', title: 'Vitamin A', target_id: 'vitamin-a', target_state: 'live', target_article_id: null, covered_source_ids: ['source-a'] },
    ].sort((a, b) => a.path.localeCompare(b.path))
    raw.articles[0].seo_brief.internal_link_targets = links.map((link) => link.path)
    raw.articles[0].selected_link_slice = { links, slice_hash: canonicalJsonHash({ links }) }
    raw.content_hash = artifactHashV2(raw)
    assert.throws(() => validateCoveragePlanV2(raw, { researchHash: raw.research_hash, substance: 'teststoff', language: 'de' }), /more than one Stage-2 link/i)
  } finally { fixture.cleanup() }
})

test('a planned Stage-2 carrier cannot be replaced by an unrelated live Stage-2 link', () => {
  const fixture = createFixture({ stages: ['stage2', 'stage3'] })
  try {
    const raw = json(fixture.paths.coverage)
    const stage3 = raw.articles.find((article) => article.stage === 'stage3')
    const links = [{ path: '/wissen/magnesium', title: 'Magnesium', target_id: 'magnesium', target_state: 'live', target_article_id: null, covered_source_ids: ['source-a'] }]
    stage3.seo_brief.internal_link_targets = links.map((link) => link.path)
    stage3.selected_link_slice = { links, slice_hash: canonicalJsonHash({ links }) }
    raw.content_hash = artifactHashV2(raw)
    assert.throws(() => validateCoveragePlanV2(raw, { researchHash: raw.research_hash, substance: 'teststoff', language: 'de' }), /through its planned Stage-2 carrier study-a/i)
    put(fixture.paths.coverage, raw)
    const status = runNutrientContent({ manifestPath: fixture.paths.run })
    assert.equal(status.state, 'WAITING_FOR_RESEARCH')
    assert.equal(status.coverage_replan_reason, 'stage2_source_assignment_policy')
  } finally { fixture.cleanup() }
})

test('planned Stage-2 carriers cannot contain sources absent from every planned Stage-3 article', () => {
  const fixture = createFixture({ stages: ['stage2', 'stage3'] })
  try {
    const raw = json(fixture.paths.coverage)
    raw.sources.push({ ...raw.sources[0], source_id: 'source-b', title: 'Additional study', label: 'Testautor et al. (2024). Additional study. Testjournal.', url: 'https://example.org/additional-study', canonical_url: 'https://example.org/additional-study' })
    raw.clusters[0].source_ids.push('source-b')
    const stage2 = raw.articles.find((article) => article.stage === 'stage2')
    stage2.source_ids.push('source-b')
    stage2.source_assignment = { mode: 'direct_research_line', anchor_source_id: 'source-a', relations: [{ source_id: 'source-b', related_to_source_id: 'source-a', relation_type: 'replication', rationale: 'The additional study directly replicates the original protocol.' }] }
    raw.extraction_obligations.push({ obligation_id: 'obligation-b', source_id: 'source-b', cluster_id: 'core', expected_claim_type: 'replication_result', required: true, required_for: ['study-a'], plan_risk_tags: [] })
    raw.content_hash = artifactHashV2(raw)
    assert.throws(() => validateCoveragePlanV2(raw, { researchHash: raw.research_hash, substance: 'teststoff', language: 'de' }), /absent from all planned Stage-3 articles/i)
  } finally { fixture.cleanup() }
})

test('meta-analysis constituents may overlap between families but remain non-owning', () => {
  const fixture = createFixture({ stages: ['stage2', 'stage3'] })
  try {
    const raw = json(fixture.paths.coverage)
    const stage2 = raw.articles.find((article) => article.stage === 'stage2')
    const stage3 = raw.articles.find((article) => article.stage === 'stage3')
    raw.sources[0].source_type = 'systematic_review'
    raw.sources.push(
      { ...raw.sources[0], source_id: 'source-meta-b', title: 'Updated meta-analysis', url: 'https://example.org/meta-b', canonical_url: 'https://example.org/meta-b', doi: null, pmid: null },
      { ...raw.sources[0], source_id: 'source-constituent', source_type: 'randomized_trial', title: 'Shared randomized trial', url: 'https://example.org/shared-trial', canonical_url: 'https://example.org/shared-trial', doi: null, pmid: null },
    )
    for (const source of raw.sources.slice(-2)) source.label = `${source.author_or_institution} (${source.publication_year ?? 'o. J.'}). ${source.title}. ${source.journal_or_publisher}.`
    raw.clusters[0].source_ids = ['source-a', 'source-meta-b', 'source-constituent']
    stage2.source_ids = ['source-a', 'source-constituent']
    stage2.source_assignment = { mode: 'meta_analysis_family', anchor_source_id: 'source-a', relations: [{ source_id: 'source-constituent', related_to_source_id: 'source-a', relation_type: 'meta_constituent', rationale: 'The review includes the randomized trial.' }] }
    const secondStage2 = {
      ...structuredClone(stage2),
      article_id: 'study-b',
      slug: 'study-b',
      source_ids: ['source-meta-b', 'source-constituent'],
      source_assignment: { mode: 'meta_analysis_family', anchor_source_id: 'source-meta-b', relations: [{ source_id: 'source-constituent', related_to_source_id: 'source-meta-b', relation_type: 'meta_constituent', rationale: 'The updated review also includes the randomized trial.' }] },
      source_presentation_label_de: 'Aktualisierte Metaanalyse zu Teststoff',
      seo_brief: { ...stage2.seo_brief, internal_link_targets: [] },
      selected_link_slice: { links: [], slice_hash: canonicalJsonHash({ links: [] }) },
    }
    raw.articles.splice(raw.articles.indexOf(stage3), 0, secondStage2)
    const links = [
      { path: '/wissen/study-a', title: stage2.source_presentation_label_de, target_id: 'study-a', target_state: 'same_release', target_article_id: 'study-a', covered_source_ids: ['source-a'] },
      { path: '/wissen/study-b', title: secondStage2.source_presentation_label_de, target_id: 'study-b', target_state: 'same_release', target_article_id: 'study-b', covered_source_ids: ['source-meta-b'] },
    ].sort((a, b) => a.path.localeCompare(b.path))
    stage3.source_ids = ['source-a', 'source-meta-b']
    stage3.seo_brief.internal_link_targets = links.map((link) => link.path)
    stage3.selected_link_slice = { links, slice_hash: canonicalJsonHash({ links }) }
    raw.extraction_obligations.push(
      { obligation_id: 'obligation-meta-b', source_id: 'source-meta-b', cluster_id: 'core', expected_claim_type: 'meta_result', required: true, required_for: ['study-b', stage3.article_id], plan_risk_tags: [] },
      { obligation_id: 'obligation-constituent', source_id: 'source-constituent', cluster_id: 'core', expected_claim_type: 'constituent_result', required: true, required_for: ['study-a', 'study-b'], plan_risk_tags: [] },
    )
    raw.content_hash = artifactHashV2(raw)
    const validated = validateCoveragePlanV2(raw, { researchHash: raw.research_hash, substance: 'teststoff', language: 'de' })
    assert.equal(validated.articles.filter((article) => article.stage === 'stage2').length, 2)

    stage3.source_ids.push('source-constituent')
    raw.content_hash = artifactHashV2(raw)
    assert.throws(() => validateCoveragePlanV2(raw, { researchHash: raw.research_hash, substance: 'teststoff', language: 'de' }), /must use meta-family anchors, not their constituent studies/i)
    stage3.source_ids.pop()

    const separate = structuredClone(raw.articles.find((article) => article.article_id === 'study-b'))
    separate.article_id = 'shared-trial'
    separate.slug = 'shared-trial'
    separate.source_ids = ['source-constituent']
    separate.source_assignment = { mode: 'single_source', anchor_source_id: 'source-constituent', relations: [] }
    raw.articles.splice(raw.articles.indexOf(stage3), 0, separate)
    raw.content_hash = artifactHashV2(raw)
    assert.throws(() => validateCoveragePlanV2(raw, { researchHash: raw.research_hash, substance: 'teststoff', language: 'de' }), /constituents cannot receive a separate Stage-2 carrier/i)
  } finally { fixture.cleanup() }
})

test('ordinary Stage-2 sources cannot have two carrier articles', () => {
  const fixture = createFixture({ stages: ['stage2', 'stage3'] })
  try {
    const raw = json(fixture.paths.coverage)
    const stage2 = raw.articles.find((article) => article.stage === 'stage2')
    const stage3 = raw.articles.find((article) => article.stage === 'stage3')
    raw.articles.splice(raw.articles.indexOf(stage3), 0, { ...structuredClone(stage2), article_id: 'study-duplicate', slug: 'study-duplicate' })
    raw.content_hash = artifactHashV2(raw)
    assert.throws(() => validateCoveragePlanV2(raw, { researchHash: raw.research_hash, substance: 'teststoff', language: 'de' }), /must have exactly one carrier article/i)
  } finally { fixture.cleanup() }
})

test('Stage-3 internal source labels must equal the German original-title label of their Stage-2 carrier', () => {
  const fixture = createFixture({ stages: ['stage2', 'stage3'] })
  try {
    const raw = json(fixture.paths.coverage)
    const stage3 = raw.articles.find((article) => article.stage === 'stage3')
    stage3.selected_link_slice.links[0].title = 'Freier SEO-Titel statt Studientitel'
    stage3.selected_link_slice.slice_hash = canonicalJsonHash({ links: stage3.selected_link_slice.links })
    raw.content_hash = artifactHashV2(raw)
    assert.throws(() => validateCoveragePlanV2(raw, { researchHash: raw.research_hash, substance: 'teststoff', language: 'de' }), /German original-title label/i)
  } finally { fixture.cleanup() }
})

function json(path) { return JSON.parse(readFileSync(path, 'utf8')) }
function put(path, value) { mkdirSync(dirname(path), { recursive: true }); writeFileSync(path, typeof value === 'string' || Buffer.isBuffer(value) ? value : `${JSON.stringify(value, null, 2)}\n`); return path }
function hashed(value) { return { ...value, content_hash: artifactHashV2(value) } }
function rel(root, path) { return relative(root, path).replaceAll('\\', '/') }

function articleMarkdown(stage, { image = false, suffix = '' } = {}) {
  if (stage === 'stage2') return `# Studie zu Teststoff${suffix}\n\nDie Untersuchung ordnet einen Messwert verständlich ein.\n\n## Was wurde untersucht?\n\nIn der Originalquelle wurden 5 mg als Studienmenge dokumentiert.\n\n## Fazit\n\nDie Studie liefert einen klar begrenzten Befund.\n\n## Quellen\n\n<!-- sources:auto -->\n`
  return `# Teststoff verständlich erklärt${suffix}\n\nEin klarer Überblick über den Stoff und die belastbaren Originalquellen.\n\n<!-- knowledge-template:magazine -->\n\n## Auf einen Blick\n\n- Der Stoff wird anhand von Originalquellen erklärt.\n- Eine Studienmenge von 5 mg ist keine Einnahmeempfehlung.\n- Unsicherheiten bleiben sichtbar.\n\n## Was ist Teststoff?\n\nTeststoff ist hier ein neutrales Beispiel für eine verständliche Einordnung.${image ? `\n\n![Messgrafik](${TEST_ASSET_PUBLIC_URL})\n\n*Messwert aus der gebundenen Originalquelle.*` : ''}\n\n## Fazit\n\nDie Datenlage lässt sich verständlich und ohne Übertreibung zusammenfassen.\n\n## Quellen\n\n<!-- sources:auto -->\n`
}

function createFixture({ stages = ['stage2', 'stage3'], graphic = false, publishRequired = true, stage4 = false } = {}) {
  const root = mkdtempSync(join(tmpdir(), 'nutrient-v2-'))
  const evidenceWork = join(root, 'run-a-evidence-work')
  const paths = {
    root,
    run: join(root, 'run.json'), research: join(root, 'inputs', 'research.md'), coverage: join(root, 'inputs', 'coverage.json'), linkInventorySource: join(root, 'inputs', 'site-link-inventory-source.json'), ingredientTarget: join(root, 'inputs', 'ingredient-target-receipt.json'), sourceResolution: join(root, 'inputs', 'source-resolution-receipt.json'),
    sourceArtifactReceipt: join(root, 'inputs', 'source-artifact-receipt.json'), evidenceManifest: join(root, 'evidence-build.json'), shard: join(evidenceWork, 'extraction', 'slice-01.source-evidence-shard.v2.json'), review: join(evidenceWork, 'reviews', 'round-0-shard-01.source-facts-review.v2.json'), reviewRound1: join(evidenceWork, 'reviews', 'round-1-shard-01.source-facts-review.v2.json'), source: join(root, 'inputs', 'source-artifacts', 'source-a.txt'),
    state: join(root, 'generated', 'state'), evidence: join(root, 'generated', 'evidence'),
  }
  put(paths.research, '# Research\n\nOriginal-source inventory.\n\n## Gängige Annahmen und Prüfaufträge\n\n- Annahme: Teststoff wirke immer gleich. Prüfauftrag: Welche Bedingungen begrenzen den Befund?\n')
  put(paths.source, 'The source reports a study quantity of 5 mg.\n')
  put(paths.linkInventorySource, hashed({ schema: 'site_link_inventory_source.v2', authority: 'd1-readback', exported_at: '2026-07-14T07:00:00.000Z', routes: [{ path: '/wissen/magnesium', slug: 'magnesium', title: 'Magnesium', meta_description: 'Magnesium verständlich erklärt: Funktionen, Quellen und die wissenschaftliche Einordnung im Überblick.', article_layer: 'single_study', source_urls: ['https://example.org/study'] }, { path: '/wissen/vitamin-a', slug: 'vitamin-a', title: 'Vitamin A', meta_description: 'Vitamin A verständlich erklärt: Funktionen, Quellen und die wissenschaftliche Einordnung im Überblick.', article_layer: 'main_article', source_urls: [] }] }))
  const ingredientIdentity = { ingredient_id: 7, canonical_name: 'Teststoff', canonical_slug: 'teststoff', status: 'active', version: 3 }
  const ingredientTargetReceipt = hashed({ schema: 'ingredient_target_receipt.v1', run_id: 'run-a', authority: 'test-fixture', selector: { substance_slug: 'teststoff', canonical_name: 'Teststoff', expected_ingredient_id: 7 }, target: { ...ingredientIdentity, identity_hash: canonicalJsonHash(ingredientIdentity) }, captured_at: '2026-07-14T07:01:00.000Z', work_order_id: null })
  put(paths.ingredientTarget, ingredientTargetReceipt)
  const sourceHash = sha256Bytes(readFileSync(paths.source))
  const sourceArtifactReceipt = hashed({ schema: 'research_source_artifact_receipt.v2', run_id: 'run-a', research_hash: sha256Bytes(readFileSync(paths.research)), artifact_root: rel(root, dirname(paths.source)), sources: [{ source_id: 'source-a', path: rel(root, paths.source), byte_hash: sourceHash, content_type: 'text/plain', locator: 'https://example.org/study' }] })
  put(paths.sourceArtifactReceipt, sourceArtifactReceipt)
  const articles = stages.map((stage) => {
    const id = stage === 'stage2' ? 'study-a' : 'main-a'
    const presentationLinks = stage === 'stage3' ? [stages.includes('stage2') ? {
      path: '/wissen/study-a',
      title: 'Studie zu Teststoff',
      target_id: 'study-a',
      target_state: 'same_release',
      target_article_id: 'study-a',
      covered_source_ids: ['source-a'],
    } : {
      path: '/wissen/magnesium',
      title: 'Magnesium',
      target_id: 'magnesium',
      target_state: 'live',
      target_article_id: null,
      covered_source_ids: ['source-a'],
    }] : []
    const base = {
      article_id: id, stage, status: 'planned', slug: id, required_cluster_ids: ['core'], source_ids: ['source-a'],
      framework: stage === 'stage2'
        ? { framework_id: 'stage2.clinical_single_study', version: '2.0.1' }
        : { framework_id: 'stage3.nonessential_or_endogenous', version: '2.0.3' },
      seo_brief: {
        primary_intent: 'Teststoff verstehen', reader_question: 'Was zeigt die Originalquelle zu Teststoff?', reader_promise: 'Eine klare, quellengebundene Einordnung ohne Übertreibung.',
        primary_topic_phrase: stage === 'stage2' ? 'Teststoff Studie' : 'Teststoff', secondary_questions: ['Was wurde untersucht?', 'Was bedeutet der Befund?', 'Welche Grenzen gibt es?'],
        cannibalization_note: 'Ergänzt bestehende Inhalte ohne konkurrierende Suchintention.', internal_link_targets: presentationLinks.map((link) => link.path),
      },
      selected_link_slice: { links: presentationLinks, slice_hash: canonicalJsonHash({ links: presentationLinks }) },
    }
    if (stage === 'stage2') {
      base.source_assignment = { mode: 'single_source', anchor_source_id: 'source-a', relations: [] }
      base.source_presentation_label_de = 'Studie zu Teststoff'
    }
    if (stage === 'stage3') Object.assign(base, {
      blueprint: { blueprint_id: 'teststoff-magazine', sections: ['Auf einen Blick', 'Was ist Teststoff?', 'Fazit', 'Quellen'], readability_target: 'grade-10' }, controversies: [],
      common_assumption_review: { status: 'identified', discovery_note: 'Die Annahme wurde als wiederkehrende Leserfrage erfasst; dies ist kein Prävalenznachweis.', checks: [{ assumption_id: 'always-same-effect', assumption: 'Teststoff wirkt bei allen Menschen immer gleich.', reader_question: 'Wirkt Teststoff unabhängig vom Kontext immer gleich?', discovery_basis: 'Wiederkehrende allgemeine Leserfrage; keine quantifizierte Verbreitungsbehauptung.', source_ids: ['source-a'], cluster_ids: ['core'], obligation_ids: ['obligation-a'] }] },
      graphic_decision: graphic ? { mode: 'generate', reason: 'A measured value benefits from a small chart.', cluster_ids: ['core'], obligation_ids: ['obligation-a'] } : { mode: 'none', reason: 'No graphic adds material understanding.', cluster_ids: [], obligation_ids: [] },
    })
    return base
  })
  const coverageBase = {
    schema: 'coverage_plan.v2', coverage_plan_id: 'coverage-a', run_id: 'run-a', research_hash: sha256Bytes(readFileSync(paths.research)), framework_catalog_hash: sha256Bytes(readFileSync(join(ROOT, 'codex-files', 'frameworks', 'framework-catalog.v1.json'))), stage2_source_assignment_policy: 'one_meaningful_source_per_stage2.v1', stage3_source_label_policy: 'german_original_title.v1',
    substance: { slug: 'teststoff', language: 'de' }, stage4_requested: stage4,
    planner: { role: 'coverage-planner', id: 'planner-a', planned_at: '2026-07-14T08:00:00.000Z' },
    sources: [{ source_id: 'source-a', source_type: 'clinical-study', source_kind: 'study', author_or_institution: 'Testautor et al.', publication_year: 2024, title: 'Originalstudie', journal_or_publisher: 'Testjournal', doi: null, pmid: null, label: TEST_SOURCE_LABEL, url: 'https://example.org/study', canonical_url: 'https://example.org/study', source_content_hash: sourceHash }],
    clusters: [{ cluster_id: 'core', required: true, source_ids: ['source-a'], plan_risk_tags: [] }],
    articles,
    extraction_obligations: articles.length ? [{ obligation_id: 'obligation-a', source_id: 'source-a', cluster_id: 'core', expected_claim_type: 'study_quantity', required: true, required_for: articles.map((entry) => entry.article_id), plan_risk_tags: [] }] : [],
  }
  const coverage = hashed(coverageBase)
  put(paths.coverage, coverage)
  const sourceRequest = buildSourceCatalogSyncRequestV1({ runId: 'run-a', ingredientTarget: { ...ingredientIdentity, identity_hash: ingredientTargetReceipt.target.identity_hash }, sources: coverage.sources })
  const sourceResolutionReceipt = hashed({ schema: 'source_resolution_receipt.v1', run_id: 'run-a', request_hash: sourceRequest.content_hash, ingredient_target_hash: ingredientTargetReceipt.target.identity_hash, ingredient_id: 7, result: 'PASS', work_order_id: null, executor: { role: 'deterministic-source-catalog-sync', id: 'test-source-sync' }, resolved_at: '2026-07-14T07:02:00.000Z', mappings: [{ source_id: 'source-a', resolved_source_id: 101, resolution: 'existing', canonical_url: 'https://example.org/study', doi: null, pubmed_id: null, persisted_version: 2, persisted_hash: canonicalJsonHash({ id: 101, version: 2 }) }] })
  put(paths.sourceResolution, sourceResolutionReceipt)
  const record = {
    schema: 'source_evidence_record.v2', record_id: 'record-a', obligation_id: 'obligation-a', source_id: 'source-a', cluster_id: 'core', claim_type: 'study_quantity',
    subject_key: 'teststoff', predicate_key: 'study-quantity', context: { design: 'example' }, conflict_set_id: null,
    claim: 'The study used 5 mg.', population_context: 'adults', value: 5, unit: 'mg', effect_direction: null, uncertainty: 'Example source only.', locator: 'p. 1', extractor_risk_tags: [],
    ...(stage4 ? { stage4_relevance: { status: 'candidate', reason: 'This source-bound quantity may be relevant to an explicit later stack decision.', locator: 'p. 1' } } : {}),
  }
  const shardBase = {
    schema: 'source_evidence_shard.v2', shard_id: 'shard-a', coverage_plan_id: coverage.coverage_plan_id, coverage_plan_hash: coverage.content_hash,
    extractor: { role: 'source-evidence-extractor', id: 'extractor-a' }, extracted_at: '2026-07-14T09:00:00.000Z', source_ids: ['source-a'], records: [record], warnings: [],
    obligation_results: [{ obligation_id: 'obligation-a', status: 'extracted', record_ids: ['record-a'] }],
  }
  put(paths.shard, hashed(shardBase))
  const evidenceManifestBase = {
    schema: 'evidence_pipeline_build.v2', mode: 'test', research_path: rel(root, paths.research), coverage_plan_path: rel(root, paths.coverage),
    research_hash: coverage.research_hash, coverage_plan_hash: coverage.content_hash, source_artifact_receipt_path: rel(root, paths.sourceArtifactReceipt), source_artifact_receipt_hash: sourceArtifactReceipt.content_hash,
    policy_version: 'policy-v2', validator_version: 'evidence-pipeline-builder.v2.0.0', max_sources_per_slice: 4,
    source_evidence_shard_paths: [rel(root, paths.shard)], source_facts_review_paths: [rel(root, paths.review), rel(root, paths.reviewRound1)],
    source_facts_review_slices: [{ sampling_round: 0, shard_id: 'round-0-shard-01', path: rel(root, paths.review) }, { sampling_round: 1, shard_id: 'round-1-shard-01', path: rel(root, paths.reviewRound1) }],
    source_artifacts: { 'source-a': rel(root, paths.source) },
    extraction_slices: [{ slice_id: 'slice-01', shard_path: rel(root, paths.shard), source_ids: ['source-a'], obligation_ids: ['obligation-a'], cluster_ids: ['core'] }],
    bundle_id: 'bundle-run-a', sampling_seed: canonicalJsonHash({ run_id: 'run-a', coverage_plan_hash: coverage.content_hash }), merger: { role: 'evidence-bundle-merger', id: 'merger-run-a' },
    validator: { role: 'evidence-bundle-gate-validator', id: 'validator-run-a', gate_id: 'gate-run-a' },
  }
  const evidenceManifest = hashed(evidenceManifestBase)
  put(paths.evidenceManifest, evidenceManifest)
  const plan = { stage2: [], stage3: [] }
  for (const article of articles) {
    const markdown = join(root, 'articles', `${article.article_id}.md`)
    paths[article.article_id] = markdown
    plan[article.stage].push({ article_id: article.article_id, slug: article.slug, markdown_path: rel(root, markdown), change_class: 'L', write_guard: { mode: 'create', expected_status: 'absent', expected_version: 0 } })
  }
  const runManifest = {
    schema: 'nutrient_content_run.v2', mode: 'test', run_id: 'run-a', substance: { slug: 'teststoff', language: 'de' }, ingredient_target: { canonical_name: 'Teststoff', expected_ingredient_id: 7 }, policy: { version: 'policy-v2' },
    render_profile: 'knowledge_magazine_v1', inputs: { research_path: rel(root, paths.research), coverage_plan_path: rel(root, paths.coverage), evidence_build_manifest_path: rel(root, paths.evidenceManifest), link_inventory_source_path: rel(root, paths.linkInventorySource), source_artifact_receipt_path: rel(root, paths.sourceArtifactReceipt), ingredient_target_receipt_path: rel(root, paths.ingredientTarget), source_resolution_receipt_path: rel(root, paths.sourceResolution) },
    outputs: { state_dir: rel(root, paths.state), evidence_dir: rel(root, paths.evidence) }, article_plan: plan,
    stage4: { enabled: stage4, ...(stage4 ? { target: 'cloudflare-d1-production', write_guard: { mode: 'atomic_projection_replace', expected_record_count: 1, targets: [{ target_key: 'ingredient-9-adult', ingredient_id: 9, population_key: 'adult', expected_status: 'absent', expected_version: 0, expected_payload_hash: null }] } } : {}) }, publish: { required: publishRequired, target: 'cloudflare-d1-production' },
  }
  put(paths.run, runManifest)
  return { root, paths, coverage, evidenceManifest, articles, graphic, cleanup: () => rmSync(root, { recursive: true, force: true }) }
}

function createSourceReview(fixture, { result = 'PASS' } = {}) {
  const sample = json(join(fixture.paths.evidence, 'review-sample-manifest.v2.json'))
  const bundle = (() => {
    const input = loadEvidenceManifestV2(fixture.paths.evidenceManifest)
    return mergeEvidenceV2(input).bundle
  })()
  const base = {
    schema: 'source_facts_review.v2', review_id: `facts-review-r${sample.sampling_round}`, bundle_hash: bundle.content_hash, sample_manifest_hash: sample.content_hash,
    reviewer: { role: 'source-facts-reviewer', id: 'facts-reviewer-a' }, reviewed_at: '2026-07-14T11:00:00.000Z',
    obligation_results: sample.selected.map((selection) => ({ obligation_id: selection.obligation_id, mode: selection.mode, status: result, findings: result === 'PASS' ? [] : [{ code: 'claim-mismatch', message: 'Claim needs correction.' }] })),
    record_results: bundle.records.filter((record) => sample.selected.some((selection) => selection.obligation_id === record.obligation_id)).map((record) => ({ record_id: record.record_id, status: result, findings: result === 'PASS' ? [] : [{ code: 'record-mismatch', message: 'Record needs correction.' }] })),
  }
  put(sample.sampling_round === 0 ? fixture.paths.review : fixture.paths.reviewRound1, hashed(base))
}

function writerResultPath(fixture, articleId) { return join(fixture.paths.state, 'writer-results', `${articleId}.article-result.v2.json`) }
function compiledPath(fixture, articleId, revision = 0) { return join(fixture.paths.state, 'compiled', `${articleId}.round-${revision}.compiled-article.v2.json`) }
function validationPath(fixture, articleId, revision = 0) { return join(fixture.paths.state, 'validation', `${articleId}.round-${revision}.validation-receipt.v2.json`) }
function reviewPath(fixture, articleId, revision = 0) { return join(fixture.paths.state, 'publication-qa', `${articleId}.round-${revision}.article-publication-review.v2.json`) }

function createWriterResults(fixture, { revision = 0, previous = {}, suffix = '', image = fixture.graphic } = {}) {
  for (const article of fixture.articles) {
    const markdown = articleMarkdown(article.stage, { image: article.stage === 'stage3' && image, suffix })
    put(fixture.paths[article.article_id], markdown)
    const packagePath = join(fixture.paths.evidence, `${article.stage}-packages`, `${article.article_id}.json`)
    const factsPackage = json(packagePath)
    const issuedOrder = json(join(fixture.paths.state, 'work-orders.v2.json')).work_orders.find((entry) => entry.task?.article_id === article.article_id && entry.task?.revision === revision && ['writer', 'writer_revision', 'writer_repair'].includes(entry.kind))
    assert.ok(issuedOrder, `missing issued writer WorkOrder for ${article.article_id} revision ${revision}`)
    assert.equal(issuedOrder.work_order_id, writerWorkOrderIdV2(issuedOrder))
    const base = {
      schema: 'article_result.v2', execution_id: `${article.article_id}-writer-r${revision}`, article_id: article.article_id, stage: article.stage, slug: article.slug,
      writer: { role: article.stage === 'stage2' ? 'clinical-study-interpreter' : 'german-health-science-writer', id: `${article.stage}-writer-a` },
      written_at: revision ? '2026-07-14T14:00:00.000Z' : '2026-07-14T13:00:00.000Z', revision,
      work_order_id: issuedOrder.work_order_id, markdown_path: rel(fixture.root, fixture.paths[article.article_id]),
      article_byte_hash: sha256Bytes(readFileSync(fixture.paths[article.article_id])), facts_package_hash: factsPackage.article_package_hash, evidence_membership_hash: factsPackage.evidence_membership_hash,
      framework: factsPackage.framework, framework_hash: factsPackage.framework_hash, used_record_ids: factsPackage.record_ids, used_source_ids: factsPackage.visible_sources.map((source) => source.source_id), asset_ids: article.stage === 'stage3' && image ? ['asset-a'] : [],
      assumption_check_coverage: article.stage === 'stage3' ? factsPackage.common_assumption_review.checks.map((check) => ({ assumption_id: check.assumption_id, conclusion: 'context_dependent', obligation_ids: check.obligation_ids, record_ids: check.record_ids })) : [],
      policy_version: 'policy-v2', render_profile: article.stage === 'stage3' ? 'knowledge_magazine_v1' : 'study_article_v2',
      ...(revision ? { previous_review_id: previous[article.article_id].review_id, previous_compiled_payload_hash: previous[article.article_id].compiled_payload_hash } : {}),
    }
    put(writerResultPath(fixture, article.article_id), hashed(base))
  }
}

function createAssetReceipt(fixture) {
  const article = fixture.articles.find((entry) => entry.stage === 'stage3')
  const issuedWriter = json(join(fixture.paths.state, 'work-orders.v2.json')).work_orders.find((entry) => entry.task?.article_id === article.article_id && ['writer', 'writer_repair'].includes(entry.kind))
  const assetOutput = issuedWriter.outputs.find((entry) => entry.name === 'asset_0')
  const assetPath = join(fixture.root, assetOutput.path)
  put(assetPath, PNG_1X1)
  const writer = json(writerResultPath(fixture, article.article_id))
  const base = {
    schema: 'article_asset.v2', asset_id: 'asset-a', article_id: article.article_id, asset_index: 0, asset_path: rel(fixture.root, assetPath),
    asset_byte_hash: sha256Bytes(readFileSync(assetPath)), mime_type: 'image/png', width: 1, height: 1, alt: 'Messgrafik', caption: 'Messwert aus der gebundenen Originalquelle.',
    position: { index: 0, markdown_offset: articleMarkdown('stage3', { image: true }).indexOf('![Messgrafik]') },
    record_ids: ['record-a'], creator: { role: 'article-graphic-generator', id: 'graphic-agent-a', writer_execution_id: writer.execution_id }, work_order_id: writer.work_order_id, created_at: '2026-07-14T13:05:00.000Z',
  }
  const receiptPath = join(fixture.paths.state, 'assets', article.article_id, '0.article-asset.v2.json')
  put(receiptPath, hashed(base))
  return { assetPath, receiptPath }
}

function createPublicationReviews(fixture, { result = 'PASS', revision = 0, previous = {} } = {}) {
  const created = {}
  for (const article of fixture.articles) {
    const compiled = json(compiledPath(fixture, article.article_id, revision))
    const validation = json(validationPath(fixture, article.article_id, revision))
    const writer = json(writerResultPath(fixture, article.article_id))
    const issuedOrder = json(join(fixture.paths.state, 'work-orders.v2.json')).work_orders.find((entry) => entry.kind === 'publication_qa' && entry.task?.article_id === article.article_id && entry.task?.revision === revision && entry.task?.qa_payload_hash === compiled.qa_payload.content_hash)
    assert.ok(issuedOrder, `missing issued publication_qa WorkOrder for ${article.article_id} revision ${revision}`)
    const findings = result === 'PASS' ? [] : [{ category: 'blocking_reader', pass: 'B', code: 'readability', message: 'Ein Absatz ist noch zu abstrakt.', location: 'Absatz bei Was ist Teststoff?', target: 'Konkrete Alltagssprache', minimal_scope: 'Nur den betroffenen Absatz umformulieren.', record_ids: [] }]
    const previousReview = revision ? json(reviewPath(fixture, article.article_id, revision - 1)) : null
    const scopeHash = revision ? canonicalJsonHash(compiled.recheck_scope) : null
    const base = {
      schema: 'article_publication_review.v2', review_id: `${article.article_id}-review-r${revision}`, work_order_id: issuedOrder.work_order_id, article_id: article.article_id, stage: article.stage, revision,
      review_type: revision ? 'targeted_recheck' : 'full', compiled_payload_hash: compiled.compiled_payload_hash, visible_payload_hash: compiled.visible_payload_hash,
      qa_payload_hash: compiled.qa_payload.content_hash, render_snapshot_hash: compiled.render_snapshot.content_hash,
      validation_receipt_hash: validation.content_hash, facts_package_hash: compiled.facts_package_hash, writer_execution_id: writer.execution_id, asset_hashes: compiled.asset_hashes, asset_receipt_hashes: compiled.assets.map((asset) => asset.receipt_hash),
      reviewer: { role: 'article-reader-acceptance-reviewer', id: 'publication-reviewer-a' }, reviewed_at: revision ? '2026-07-14T15:00:00.000Z' : '2026-07-14T13:30:00.000Z',
      result, reader_questions: { q1: 'Ja', q2: 'Ja', q3: 'Nein' }, findings,
      passes: {
        facts_safety_sources: { result: 'PASS', checked: ['facts', 'uncertainty', 'sources'], ...(revision ? { scope_hash: scopeHash } : {}) },
        reader_seo_template: { result, checked: ['readability', 'SEO', 'template'], ...(revision ? { scope_hash: scopeHash } : {}) },
      },
      ...(revision ? {
        previous_review_id: previous[article.article_id].review_id, previous_compiled_payload_hash: previous[article.article_id].compiled_payload_hash,
        previous_review_hash: previousReview.content_hash, previous_findings_hash: canonicalJsonHash(previousReview.findings),
        allowed_finding_keys: previousReview.findings.map((finding) => `${finding.pass}:${finding.code}:${finding.location}`).sort(), recheck_scope: compiled.recheck_scope,
      } : {}),
    }
    const value = hashed(base)
    put(reviewPath(fixture, article.article_id, revision), value)
    created[article.article_id] = { review_id: value.review_id, review_hash: value.content_hash, compiled_payload_hash: compiled.compiled_payload_hash, visible_payload_hash: compiled.visible_payload_hash }
  }
  return created
}

function createArticleTargetReceipt(fixture, { createdAt = '2025-01-10T09:00:00.000Z', updatedAt = '2026-06-01T10:00:00.000Z' } = {}) {
  const workOrder = json(join(fixture.paths.state, 'work-orders.v2.json')).work_orders.find((entry) => entry.kind === 'article_target_readback')
  assert.ok(workOrder, 'missing article_target_readback WorkOrder')
  const base = {
    schema: 'article_target_receipt.v1', run_id: 'run-a', target: 'cloudflare-d1-production', result: 'PASS', work_order_id: workOrder.work_order_id,
    executor: { role: 'deterministic-article-target-reader', id: 'test-article-target-reader' }, captured_at: '2026-07-14T13:45:00.000Z',
    articles: workOrder.task.articles.map((entry) => ({ article_id: entry.article_id, slug: entry.slug, status: entry.expected_status, version: entry.expected_version, payload_hash: entry.expected_payload_hash, created_at: createdAt, updated_at: updatedAt })).sort((left, right) => left.article_id.localeCompare(right.article_id)),
  }
  const output = workOrder.outputs.find((entry) => entry.name === 'article_target_receipt')
  assert.ok(output, 'missing article_target_receipt output')
  put(join(fixture.root, output.path), hashed(base))
}

function createPublishReceipt(fixture, release, { alreadyCurrent = false, primitive = false, indexabilityState = 'INDEXABLE', seoDeliveryState = 'RAW_HTML_MATCH', sitemapState = 'INCLUDED' } = {}) {
  if (primitive) {
    put(join(fixture.paths.state, 'publish', 'content-publish-receipt.v2.json'), { schema: 'content_publish_receipt.v2', status: 'PASS', release_hash: release.release_hash })
    return
  }
  const checkedAt = '2026-07-14T16:01:00.000Z'
  const readback = (checked, actual) => ({ checked_at: checkedAt, checked, result: 'MATCH', actual })
  const currentOrders = json(join(fixture.paths.state, 'work-orders.v2.json')).work_orders
  const historyPath = join(fixture.paths.state, 'work-orders-history.v2.jsonl')
  const historicalOrders = existsSync(historyPath) ? readFileSync(historyPath, 'utf8').split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line).work_order) : []
  const publishWorkOrder = [...currentOrders, ...historicalOrders].find((entry) => entry.kind === 'publication_apply' && entry.task?.release_hash === release.release_hash)
  assert.ok(publishWorkOrder, 'missing exact publication_apply WorkOrder')
  const origin = 'https://supplementstack.de/'
  const originIndexabilityState = indexabilityState === 'BLOCKED_BY_PAGE_META' ? 'INDEXABLE' : indexabilityState
  const rawHtmlBodyHash = canonicalJsonHash({ release_hash: release.release_hash, delivery: seoDeliveryState })
  const sitePolicyFingerprint = canonicalJsonHash({ origin, indexability_state: indexabilityState, robots: indexabilityState === 'BLOCKED_BY_SITE_POLICY' ? 'Disallow: /' : 'Allow: /' })
  const deploymentBase = { representative_url: `${origin}wissen/${release.articles[0].slug}`, raw_html_body_hash: rawHtmlBodyHash, assets: [] }
  const originResults = [{
    origin, indexability_state: originIndexabilityState,
    robots_txt: { url: `${origin}robots.txt`, fetch_status: 'OK', http_status: 200, body_hash: canonicalJsonHash({ robots: sitePolicyFingerprint }), policy: indexabilityState === 'BLOCKED_BY_SITE_POLICY' ? 'BLOCKED' : 'ALLOWED' },
    sitemap_discovery: { state: sitemapState, checked_urls: [`${origin}sitemap.xml`] },
    deployment_fingerprint: { ...deploymentBase, fingerprint: canonicalJsonHash(deploymentBase) },
    site_policy_fingerprint: sitePolicyFingerprint,
  }]
  const { affectedIngredientIds, badgeExpectations } = buildKnowledgeBadgeExpectationsV1(release.articles)
  const badgeApiUrl = `${origin}api/knowledge?cfcheck=${encodeURIComponent(release.release_hash)}`
  const badgeStatuses = badgeExpectations.map((expectation) => ({
    ingredient_id: expectation.ingredient_id, status_present: true,
    has_studies: expectation.studies_rule === 'REQUIRE_TRUE', has_dge: false,
    studies_rule: expectation.studies_rule, expected_has_studies: expectation.expected_has_studies,
    dge_rule: expectation.dge_rule, expected_has_dge: expectation.expected_has_dge,
  }))
  const badgeOrigin = {
    origin,
    api: { url: badgeApiUrl, fetch_status: 'OK', http_status: 200, content_type: 'application/json; charset=utf-8', body_hash: canonicalJsonHash(badgeStatuses), statuses: badgeStatuses },
    hydrated_overview: { url: `${origin}wissen?cfcheck=${encodeURIComponent(release.release_hash)}`, viewport: { name: 'desktop', width: 1440, height: 1000 }, route_ready: true, api_request_url: badgeApiUrl, cards: badgeStatuses.map((entry) => ({ ingredient_id: entry.ingredient_id, card_match_count: 1, studies_visible: entry.has_studies, dge_visible: entry.has_dge })) },
    result: 'MATCH', mismatches: [],
  }
  const badgeReadback = { schema: 'knowledge_badge_readback.v1', release_hash: release.release_hash, affected_ingredient_ids: affectedIngredientIds, origin_results: [badgeOrigin], result: 'MATCH', mismatches: [] }
  const articleResults = release.articles.map((article) => {
    const resultingVersion = article.write_guard.mode === 'create' ? 1 : article.write_guard.expected_version + (alreadyCurrent ? 0 : 1)
    const rawHtmlUrl = `${article.seo.canonical_url}?cfcheck=${encodeURIComponent(release.release_hash)}`
    const rawHtml = { url: rawHtmlUrl, fetch_status: 'FETCHED', http_status: 200, content_type: 'text/html; charset=utf-8', body_hash: rawHtmlBodyHash, title_match: seoDeliveryState === 'RAW_HTML_MATCH', article_text_match: seoDeliveryState === 'RAW_HTML_MATCH', article_json_ld_match: seoDeliveryState === 'RAW_HTML_MATCH', seo_delivery_state: seoDeliveryState }
    const detailApiUrl = `${origin}api/knowledge/${encodeURIComponent(article.slug)}?cfcheck=${encodeURIComponent(release.release_hash)}`
    const optionalInterpretation = article.stage === 'stage2' ? article.stage2_interpretation_projection : null
    const legacyVisibleFields = { featured_image_url: null, dose_min: null, dose_max: null, dose_unit: null, product_note: null }
    return ({
    article_id: article.article_id, slug: article.slug, target_identity: article.article_id, result: alreadyCurrent ? 'already_current' : 'applied', changed_rows: alreadyCurrent ? 0 : 1,
    write_guard: article.write_guard,
    guard_result: {
      expected: article.write_guard,
      outcome: alreadyCurrent ? 'ALREADY_CURRENT' : 'MATCH',
      actual_before: alreadyCurrent
        ? { status: 'published', version: resultingVersion, payload_hash: article.compiled_payload_hash }
        : article.write_guard.mode === 'create'
          ? { status: 'absent', version: 0, payload_hash: null }
          : { status: article.write_guard.expected_status, version: article.write_guard.expected_version, payload_hash: article.write_guard.expected_payload_hash },
      actual: { compiled_payload_hash: article.compiled_payload_hash },
    },
    resulting_version: resultingVersion, resulting_status: 'published', compiled_payload_hash: article.compiled_payload_hash, visible_payload_hash: article.visible_payload_hash,
    qa_payload_hash: article.qa_payload_hash, render_snapshot_hash: article.render_snapshot_hash, relation_hash: article.relation_hash, projection_hash: article.projection_hash, seo_hash: article.seo_hash, asset_hashes: article.asset_hashes,
    hydrated_dom_state: 'HYDRATED_DOM_MATCH', indexability_state: indexabilityState, site_policy_fingerprint: sitePolicyFingerprint,
    seo_delivery_state: seoDeliveryState, sitemap_state: sitemapState,
    raw_html: rawHtml,
    sitemap: { state: sitemapState, matched_url: sitemapState === 'INCLUDED' ? article.seo.canonical_url : null, checked_urls: [`${origin}sitemap.xml`] },
    readbacks: {
      persistence: readback(['target_identity', 'version', 'compiled_payload_hash'], { target_identity: article.article_id, resulting_version: resultingVersion, compiled_payload_hash: article.compiled_payload_hash }),
      relations: readback(['relation_hash', 'asset_hashes'], { relation_hash: article.relation_hash, asset_hashes: article.asset_hashes }),
      public_api: readback(['detail_api_url', 'release_hash', 'fetch_status', 'http_status', 'content_type', 'body_hash', 'slug', 'visible_payload_hash', 'seo_hash', 'reviewed_at', 'created_at', 'updated_at', 'v2_sources', 'ingredient_ids', 'optional_interpretations', 'legacy_visible_fields_null'], { url: detailApiUrl, release_hash: release.release_hash, fetch_status: 'FETCHED', http_status: 200, content_type: 'application/json; charset=utf-8', body_hash: canonicalJsonHash({ article_id: article.article_id, release_hash: release.release_hash }), slug: article.slug, visible_payload_hash: article.visible_payload_hash, seo: { meta_title: article.seo.meta_title, meta_description: article.seo.meta_description, canonical_url: article.seo.canonical_url, canonical_path: article.seo.canonical_path, robots: article.seo.robots, indexable: article.seo.indexable, json_ld: article.seo.json_ld }, seo_hash: article.seo_hash, reviewed_at: article.reviewed_at, created_at: article.published_at, updated_at: article.modified_at, source_relations: article.source_relations, ingredient_ids: article.ingredient_ids, optional_interpretation_projection: optionalInterpretation, legacy_visible_fields: legacyVisibleFields }),
      utf8: readback(['valid_utf8', 'mojibake_free'], { valid_utf8: true, mojibake_free: true }),
      dom: readback(['full_projection', 'assets'], { visible_payload_hash: article.visible_payload_hash, projection: article.expected_projection, projection_hash: article.projection_hash, asset_hashes: article.asset_hashes }),
      seo: readback(['meta', 'canonical', 'robots', 'indexability', 'json_ld'], { seo: { meta_title: article.seo.meta_title, meta_description: article.seo.meta_description, canonical_url: article.seo.canonical_url, canonical_path: article.seo.canonical_path, robots: article.seo.robots, indexable: article.seo.indexable, json_ld: article.seo.json_ld }, seo_hash: article.seo_hash }),
      seo_delivery: { checked_at: checkedAt, checked: ['hydrated_dom_state', 'site_policy_fingerprint', 'raw_html_http', 'raw_html_body_hash', 'raw_title', 'raw_article_text', 'raw_article_json_ld', 'sitemap_inclusion'], result: seoDeliveryState === 'RAW_HTML_MATCH' && sitemapState === 'INCLUDED' && indexabilityState === 'INDEXABLE' ? 'MATCH' : 'INCOMPLETE', actual: { hydrated_dom_state: 'HYDRATED_DOM_MATCH', indexability_state: indexabilityState, site_policy_fingerprint: sitePolicyFingerprint, seo_delivery_state: seoDeliveryState, raw_html: rawHtml, sitemap: { state: sitemapState, matched_url: sitemapState === 'INCLUDED' ? article.seo.canonical_url : null, checked_urls: [`${origin}sitemap.xml`] } } },
    },
  }) })
  const base = { schema: 'content_publish_receipt.v2', release_hash: release.release_hash, target: 'cloudflare-d1-production', work_order_id: publishWorkOrder.work_order_id, executor: { role: 'deterministic-content-publication-executor', id: 'publisher-a' }, applied_at: '2026-07-14T16:00:00.000Z', atomic_batch: { result: 'COMMITTED', scope: 'd1_articles_relations_interpretations_only', excludes: ['r2_asset_staging', 'source_catalog_staging'], transaction_id: 'test-atomic-batch-a', article_ids: release.articles.map((article) => article.article_id).sort() }, origin_results: originResults, article_results: articleResults, badge_readback: badgeReadback }
  put(join(fixture.paths.state, 'publish', 'content-publish-receipt.v2.json'), hashed(base))
}

function createIndexabilityReleaseReceipt(fixture, release, {
  requestGeneratedAt = '2026-07-14T16:59:00.000Z',
  receiptCheckedAt = '2026-07-14T17:00:00.000Z',
} = {}) {
  const publishDir = join(fixture.paths.state, 'publish')
  const publishReceipt = json(join(publishDir, 'content-publish-receipt.v2.json'))
  const rendererRequest = buildRendererPublicReadbackRequestV2(release, { generatedAt: requestGeneratedAt })
  const origin = 'https://supplementstack.de/'
  const sitePolicyFingerprint = canonicalJsonHash({ release_hash: release.release_hash, policy: 'indexable' })
  const bodyHash = canonicalJsonHash({ release_hash: release.release_hash, raw: true })
  const deploymentBase = { representative_url: rendererRequest.articles[0].public_url, raw_html_body_hash: bodyHash, assets: [] }
  const rendererReceipt = hashed({
    schema: 'renderer_public_readback_receipt.v2', release_hash: release.release_hash, checked_at: receiptCheckedAt,
    browser: { product: 'test-browser', protocol_version: 'test.v1' },
    origin_results: [{ origin, indexability_state: 'INDEXABLE', robots_txt: { url: `${origin}robots.txt`, fetch_status: 'FETCHED', http_status: 200, body_hash: bodyHash, user_agent: 'Googlebot', global_rule: 'ALLOW', matched_rule: 'Allow: /wissen/test$' }, sitemap_discovery: { discovery_url: `${origin}robots.txt`, sitemap_url: `${origin}sitemap.xml`, fetch_status: 'FETCHED', http_status: 200, body_hash: bodyHash }, deployment_fingerprint: { ...deploymentBase, fingerprint: canonicalJsonHash(deploymentBase) }, site_policy_fingerprint: sitePolicyFingerprint }],
    article_results: rendererRequest.articles.map((expected) => ({
      article_id: expected.article_id, public_url: expected.public_url, result: 'MATCH', hydrated_dom_state: 'HYDRATED_DOM_MATCH', seo_match: 'MATCH', mismatches: [],
      projection: expected.expected_projection, projection_hash: expected.projection_hash, seo: expected.expected_seo, seo_hash: expected.seo_hash, asset_hashes: expected.asset_hashes,
      indexability_state: 'INDEXABLE', site_policy_fingerprint: sitePolicyFingerprint, seo_delivery_state: 'RAW_HTML_MATCH',
      raw_html: { url: `${expected.public_url}?cfcheck=${encodeURIComponent(release.release_hash)}`, fetch_status: 'FETCHED', http_status: 200, content_type: 'text/html; charset=utf-8', body_hash: bodyHash, title_match: true, article_text_match: true, article_json_ld_match: true, seo_delivery_state: 'RAW_HTML_MATCH' },
      sitemap: { state: 'INCLUDED', discovery_url: `${origin}robots.txt`, sitemap_url: `${origin}sitemap.xml`, fetch_status: 'FETCHED', http_status: 200, body_hash: bodyHash, article_url_match: true },
      checked: expected.required_checks,
      viewports: {
        desktop: { result: 'MATCH', projection_hash: expected.projection_hash, seo_hash: expected.seo_hash, asset_hashes: expected.asset_hashes, checked: expected.required_checks, mismatches: [] },
        mobile: { result: 'MATCH', projection_hash: expected.projection_hash, seo_hash: expected.seo_hash, asset_hashes: expected.asset_hashes, checked: expected.required_checks, mismatches: [] },
      },
    })),
    badge_readback: publishReceipt.badge_readback,
  })
  const indexabilityReceipt = buildIndexabilityReleaseReceiptV1({ release, publishReceipt, rendererRequest, rendererReceipt })
  put(join(publishDir, 'indexability-renderer-public-readback-request.v2.json'), rendererRequest)
  put(join(publishDir, 'indexability-renderer-public-readback-receipt.v2.json'), rendererReceipt)
  put(join(publishDir, 'indexability-release-receipt.v1.json'), indexabilityReceipt)
}

function createStage4Receipt(fixture, { result = 'PASS', alreadyCurrent = false, duplicateTarget = false } = {}) {
  const lockPath = join(fixture.paths.evidence, 'evidence-pipeline-lock.v2.json')
  const pipeline = validateEvidencePipelineLockV2({ lockPath, root: fixture.root, expected: { evidenceManifestPath: fixture.paths.evidenceManifest, coveragePlanPath: fixture.paths.coverage, researchPath: fixture.paths.research, substance: 'teststoff', language: 'de' } })
  const packageValue = pipeline.packages.stage4
  const workOrder = json(join(fixture.paths.state, 'work-orders.v2.json')).work_orders.find((entry) => entry.kind === 'stage4_stack_sync')
  assert.ok(workOrder, 'missing Stage-4 WorkOrder')
  const manifest = json(fixture.paths.run)
  const common = {
    schema: 'stack_sync_receipt.v2', run_id: 'run-a', result, work_order_id: workOrder.work_order_id,
    facts_package_id: packageValue.package_id, facts_package_hash: packageValue.package_content_hash, facts_hash: packageValue.facts_hash,
    evidence_lock_hash: pipeline.lock.lock_hash, target: manifest.stage4.target, write_guard: manifest.stage4.write_guard,
    executor: { role: 'stage4-stack-sync', id: 'stage4-sync-a' },
  }
  if (result === 'BLOCKED') {
    put(join(fixture.paths.state, 'stage4', 'stack-sync-receipt.v2.json'), hashed({ ...common, reason: 'Guarded Stage-4 mapping is ambiguous.' }))
    return
  }
  const fact = packageValue.facts[0]
  const source = packageValue.visible_sources.find((entry) => entry.source_id === fact.source_id)
  const projection = hashed({
    schema: 'stack_projection.v2', projection_id: 'projection-a', status: 'ready', run_id: 'run-a', coverage_plan_hash: pipeline.coveragePlan.content_hash,
    evidence_bundle_hash: pipeline.evidenceBundle.content_hash, facts_gate_hash: pipeline.factsGate.content_hash, evidence_lock_hash: pipeline.lock.lock_hash,
    facts_package_id: packageValue.package_id, facts_package_hash: packageValue.package_content_hash, facts_hash: packageValue.facts_hash, record_ids: [...packageValue.record_ids].sort(),
    creator: { role: 'stage4-stack-sync', id: 'stage4-sync-a' }, execution_id: 'stage4-execution-a', created_at: '2026-07-14T16:30:00.000Z',
    records: [
      { projection_record_id: 'projection-record-a', evidence_record_ids: [fact.record_id], ingredient_id: 9, population_key: 'adult', source_type: source.source_type, source_label: source.label, source_url: source.source_url, amount_type: 'tested_amount', reported_amount_text: fact.claim, dose_min: fact.value, dose_max: fact.value, unit: fact.unit, purpose: fact.claim_type, relevance_reason: fact.stage4_relevance.reason, stack_role: 'not_in_stack', visible: false, controversial: false, lifecycle_status: 'draft' },
      ...(duplicateTarget ? [{ projection_record_id: 'projection-record-b', evidence_record_ids: [fact.record_id], ingredient_id: 9, population_key: 'adult', source_type: source.source_type, source_label: source.label, source_url: source.source_url, amount_type: 'tested_amount', reported_amount_text: fact.claim, dose_min: fact.value, dose_max: fact.value, unit: fact.unit, purpose: fact.claim_type, relevance_reason: fact.stage4_relevance.reason, stack_role: 'not_in_stack', visible: false, controversial: false, lifecycle_status: 'draft' }] : []),
    ],
  })
  const projectionPath = join(fixture.paths.state, 'stage4', 'stack-projection.v2.json')
  put(projectionPath, projection)
  const actualBefore = manifest.stage4.write_guard.targets.map((target) => ({ target_key: target.target_key, ingredient_id: target.ingredient_id, population_key: target.population_key, status: target.expected_status, version: target.expected_version, payload_hash: target.expected_payload_hash }))
  const base = {
    ...common, applied_at: '2026-07-14T16:31:00.000Z', apply_result: alreadyCurrent ? 'already_current' : 'applied', changed_rows: alreadyCurrent ? 0 : projection.records.length,
    guard_result: { expected: manifest.stage4.write_guard, actual_before: actualBefore, outcome: alreadyCurrent ? 'ALREADY_CURRENT' : 'MATCH', ...(alreadyCurrent ? { current_projection_hash: projection.content_hash } : {}) },
    projection_path: rel(fixture.root, projectionPath), projection_hash: projection.content_hash,
    readback: { result: 'MATCH', projection_hash: projection.content_hash, record_ids: projection.records.map((entry) => entry.projection_record_id) },
  }
  put(join(fixture.paths.state, 'stage4', 'stack-sync-receipt.v2.json'), hashed(base))
}

function progressToWriters(fixture) {
  let status = runNutrientContent({ manifestPath: fixture.paths.run })
  assert.equal(status.state, 'WAITING_FOR_SOURCE_REVIEW')
  createSourceReview(fixture)
  status = runNutrientContent({ manifestPath: fixture.paths.run })
  assert.equal(status.state, 'WAITING_FOR_WRITERS')
  return status
}

function progressToQa(fixture) {
  progressToWriters(fixture)
  if (fixture.graphic) {
    put(join(fixture.root, 'frontend', 'public', 'assets', 'knowledge', 'main-a-explanation.png'), PNG_1X1)
    createWriterResults(fixture)
    let status = runNutrientContent({ manifestPath: fixture.paths.run })
    assert.equal(status.state, 'WAITING_FOR_WRITERS')
    assert.match(status.work_orders.work_orders[0].reason, /graphic|article_asset/i)
    createWriterResults(fixture)
    createAssetReceipt(fixture)
  } else createWriterResults(fixture)
  const status = runNutrientContent({ manifestPath: fixture.paths.run })
  assert.equal(status.state, 'WAITING_FOR_PUBLICATION_QA', JSON.stringify(status.work_orders?.work_orders ?? []))
  return status
}

function buildLowRiskReviewSample(fixture, count, samplingSeed = `low-risk-${count}`) {
  const plan = json(fixture.paths.coverage)
  plan.extraction_obligations = Array.from({ length: count }, (_, index) => {
    const suffix = String(index).padStart(3, '0')
    return { obligation_id: `obligation-${suffix}`, source_id: 'source-a', cluster_id: 'core', expected_claim_type: `numeric-result-${suffix}`, required: true, required_for: ['main-a'], plan_risk_tags: [] }
  })
  plan.articles[0].common_assumption_review.checks[0].obligation_ids = plan.extraction_obligations.map((entry) => entry.obligation_id)
  plan.content_hash = artifactHashV2(plan)
  put(fixture.paths.coverage, plan)
  const evidenceManifest = json(fixture.paths.evidenceManifest)
  evidenceManifest.coverage_plan_hash = plan.content_hash
  evidenceManifest.extraction_slices[0].obligation_ids = plan.extraction_obligations.map((entry) => entry.obligation_id)
  evidenceManifest.content_hash = artifactHashV2(evidenceManifest)
  put(fixture.paths.evidenceManifest, evidenceManifest)
  const shard = json(fixture.paths.shard)
  shard.coverage_plan_hash = plan.content_hash
  shard.records = plan.extraction_obligations.map((obligation, index) => ({
    schema: 'source_evidence_record.v2', record_id: `record-${String(index).padStart(3, '0')}`, obligation_id: obligation.obligation_id,
    source_id: 'source-a', cluster_id: 'core', claim_type: obligation.expected_claim_type, subject_key: 'teststoff', predicate_key: `predicate-${index}`,
    context: { design: 'example' }, conflict_set_id: null, claim: `Result ${index + 1} was ${index + 1} mg.`, population_context: 'adults', value: index + 1, unit: 'mg', effect_direction: null, uncertainty: 'Example.', locator: `p. ${index + 1}`, extractor_risk_tags: [],
  }))
  shard.obligation_results = shard.records.map((record) => ({ obligation_id: record.obligation_id, status: 'extracted', record_ids: [record.record_id] }))
  shard.content_hash = artifactHashV2(shard)
  put(fixture.paths.shard, shard)
  const input = loadEvidenceManifestV2(fixture.paths.evidenceManifest)
  const merged = mergeEvidenceV2(input)
  return buildReviewSampleV2({ coveragePlan: input.coveragePlan, bundle: merged.bundle, samplingSeed })
}

test('v2 run progresses once through evidence, parallel writers, full QA, frozen release and structured readback', () => {
  const fixture = createFixture()
  try {
    progressToQa(fixture)
    createPublicationReviews(fixture)
    let status = runNutrientContent({ manifestPath: fixture.paths.run })
    assert.equal(status.state, 'READY_TO_PUBLISH', JSON.stringify(status.work_orders?.work_orders ?? [], null, 2))
    assert.equal(status.production_apply_executor.implemented, true)
    assert.equal(status.production_apply_executor.explicit_publish_flag_required, true)
    const release = json(join(fixture.paths.state, 'release', 'content-release.v2.json'))
    assert.equal(release.articles.length, 2)
    for (const article of release.articles) {
      const compiled = json(compiledPath(fixture, article.article_id))
      assert.deepEqual(article.publish_payload, compiled.publish_payload)
      assert.equal(article.compiled_payload_hash, compiled.compiled_payload_hash)
      assert.equal(article.visible_payload_hash, canonicalJsonHash(compiled.visible_hash_material))
      if (article.stage === 'stage2') {
        assert.equal(compiled.render_snapshot.renderer.contract_version, 'deterministic-study-projection.v2')
        assert.ok(compiled.render_snapshot.sections.length >= 3)
        assert.deepEqual(compiled.render_snapshot.actual_projection, compiled.expected_projection)
        assert.equal(compiled.render_snapshot.projection_hash, compiled.projection_hash)
        assert.ok(compiled.render_snapshot.projection_checks.every((check) => check.result === 'PASS'))
        assert.ok(compiled.render_request_path)
        assert.ok(compiled.render_snapshot_path)
      } else {
        assert.ok(article.publish_payload.sources.length > 0)
        assert.ok(article.publish_payload.sources.every((source) => /^\/wissen\/[a-z0-9-]+$/.test(source.url)))
        assert.ok(article.source_relations.every((source) => /^\/wissen\/[a-z0-9-]+$/.test(source.url)))
        assert.deepEqual(article.publish_payload.sources, article.source_relations.map(({ source_id, label, url }) => ({ source_id, label, url })))
      }
    }
    createPublishReceipt(fixture, release)
    status = runNutrientContent({ manifestPath: fixture.paths.run })
    assert.equal(status.state, 'COMPLETE')
    assert.equal(status.published, true)
    assert.equal(status.metrics.cache.evidence_hits, 1)
    assert.equal(status.metrics.cache.article_hits, 0)
    assert.equal(status.work_orders.work_orders.length, 0)
  } finally { fixture.cleanup() }
})

test('Runner release dispatches through the real SQLite publication adapter and consumes its hashed receipt', async () => {
  const fixture = createFixture({ stages: ['stage2'] })
  const adapter = new SqliteContentPublicationAdapter()
  try {
    progressToQa(fixture)
    createPublicationReviews(fixture)
    let status = runNutrientContent({ manifestPath: fixture.paths.run })
    assert.equal(status.state, 'READY_TO_PUBLISH')
    const order = status.work_orders.work_orders.find((entry) => entry.kind === 'publication_apply')
    assert.ok(order)
    const context = loadNutrientContentRunManifest(fixture.paths.run)
    const receipt = await dispatchDeterministicWorkOrderV2({ context, workOrder: order, adapter, publishEnabled: true })
    assert.equal(receipt.atomic_batch.result, 'COMMITTED')
    assert.equal(receipt.badge_readback.result, 'MATCH')
    const executionReceipt = json(resolve(fixture.root, order.execution_receipt.path))
    assert.equal(executionReceipt.result, 'PASS')
    assert.equal(executionReceipt.result_hash, receipt.content_hash)
    assert.equal(executionReceipt.content_hash, artifactHashV2(executionReceipt))

    status = runNutrientContent({ manifestPath: fixture.paths.run })
    assert.equal(status.state, 'COMPLETE')
    assert.equal(status.published, true)
    assert.equal(status.article_branch_status, 'COMPLETE')
    assert.equal(status.work_orders.work_orders.length, 0)
  } finally { adapter.close(); fixture.cleanup() }
})

test('truthful no-article completion skips extraction, writers and publication', () => {
  const fixture = createFixture({ stages: [], publishRequired: true })
  try {
    const status = runNutrientContent({ manifestPath: fixture.paths.run })
    assert.equal(status.state, 'COMPLETE')
    assert.equal(status.completion_scope, 'no_articles_planned')
    assert.equal(status.published, false)
    assert.equal(existsSync(join(fixture.paths.state, 'release', 'content-release.v2.json')), false)
  } finally { fixture.cleanup() }
})

test('state to WorkOrder to executor/receipt matrix is exact and has no phantom specialist', () => {
  assert.deepEqual(Object.keys(WORK_ORDER_KIND_CONTRACTS).sort(), [
    'article_correction', 'article_correction_review', 'article_target_readback', 'asset_stage', 'coverage_planning', 'framework_catalog_activate', 'framework_design', 'framework_owner_approval', 'framework_runtime_change_handoff', 'indexability_release_handoff', 'ingredient_target_readback', 'link_inventory_source_readback', 'publication_apply', 'publication_qa', 'research', 'research_source_freeze',
    'source_catalog_sync', 'source_extraction', 'source_extraction_repair', 'source_facts_review', 'stage4_stack_sync', 'writer', 'writer_repair', 'writer_repair_escalation', 'writer_revision',
  ])
  assert.deepEqual(STATE_WORK_ORDER_MATRIX.READY_TO_PUBLISH, ['publication_apply', 'stage4_stack_sync', 'stage4_receipt_integrity_escalation'])
  assert.deepEqual(WORK_ORDER_KIND_CONTRACTS.publication_apply, {
    execution_class: 'deterministic', roles: ['deterministic-content-publication-executor'], required_outputs: [{ name: 'publish_receipt', schema: 'content_publish_receipt.v2' }],
  })
  assert.deepEqual(WORK_ORDER_KIND_CONTRACTS.stage4_stack_sync.required_outputs, [{ name: 'stack_projection', schema: 'stack_projection.v2' }, { name: 'stack_sync_receipt', schema: 'stack_sync_receipt.v2' }])
  assert.equal(Object.keys(WORK_ORDER_KIND_CONTRACTS).some((kind) => /coordinator|graphic_generator|orchestrator/.test(kind)), false)

  const fixture = createFixture({ stages: ['stage3'] })
  try {
    let status = runNutrientContent({ manifestPath: fixture.paths.run })
    assert.deepEqual([status.state, ...status.work_orders.work_orders.map((order) => `${order.kind}:${order.execution_class}:${order.assignee.role}`)], ['WAITING_FOR_SOURCE_REVIEW', 'source_facts_review:llm:source-facts-reviewer'])
    createSourceReview(fixture)
    status = runNutrientContent({ manifestPath: fixture.paths.run })
    assert.deepEqual([status.state, ...status.work_orders.work_orders.map((order) => `${order.kind}:${order.execution_class}:${order.assignee.role}`)], ['WAITING_FOR_WRITERS', 'writer:llm:german-health-science-writer'])
    const leanWriter = status.work_orders.work_orders[0]
    assert.deepEqual(leanWriter.inputs.map((input) => input.name), ['facts_package', 'framework', 'style_annotation', 'style_registry'])
    for (const duplicate of ['framework', 'seo_brief', 'blueprint', 'controversies', 'graphic_decision']) assert.equal(Object.hasOwn(leanWriter.task, duplicate), false)
    createWriterResults(fixture)
    status = runNutrientContent({ manifestPath: fixture.paths.run })
    assert.deepEqual([status.state, ...status.work_orders.work_orders.map((order) => `${order.kind}:${order.execution_class}:${order.assignee.role}`)], ['WAITING_FOR_PUBLICATION_QA', 'publication_qa:llm:article-reader-acceptance-reviewer'])
    assert.equal(Object.hasOwn(status.work_orders.work_orders[0].task, 'qa_payload'), false)
    createPublicationReviews(fixture)
    status = runNutrientContent({ manifestPath: fixture.paths.run })
    assert.deepEqual([status.state, ...status.work_orders.work_orders.map((order) => `${order.kind}:${order.execution_class}:${order.assignee.role}`)], ['READY_TO_PUBLISH', 'publication_apply:deterministic:deterministic-content-publication-executor'])
    assert.equal(status.work_orders.work_orders[0].wave_index, null)
    const release = json(join(fixture.paths.state, 'release', 'content-release.v2.json'))
    createPublishReceipt(fixture, release)
    status = runNutrientContent({ manifestPath: fixture.paths.run })
    assert.equal(status.state, 'COMPLETE')
    assert.deepEqual(status.work_orders.work_orders, [])
  } finally { fixture.cleanup() }

  for (const setup of [
    { expected: ['WAITING_FOR_RESEARCH', 'research:llm'], mutate: (entry) => rmSync(entry.paths.research) },
    { expected: ['WAITING_FOR_RESEARCH', 'research_source_freeze:llm'], mutate: (entry) => rmSync(entry.paths.sourceArtifactReceipt) },
    { expected: ['WAITING_FOR_LINK_INVENTORY', 'link_inventory_source_readback:deterministic'], mutate: (entry) => rmSync(entry.paths.linkInventorySource) },
    { expected: ['WAITING_FOR_SOURCE_EXTRACTION', 'source_extraction:llm'], mutate: (entry) => rmSync(entry.paths.shard) },
  ]) {
    const entry = createFixture({ stages: ['stage3'] })
    try {
      setup.mutate(entry)
      const status = runNutrientContent({ manifestPath: entry.paths.run })
      assert.deepEqual([status.state, ...status.work_orders.work_orders.map((order) => `${order.kind}:${order.execution_class}`)], setup.expected)
    } finally { entry.cleanup() }
  }
})

test('compiler-derived magazine projection reaches React and hydrated browser contracts while style PASS is cross-run and article-neutral', () => {
  const first = createFixture({ stages: ['stage3'], graphic: true })
  const second = createFixture({ stages: ['stage3'] })
  try {
    progressToWriters(first)
    const frameworkBoundFacts = json(join(first.paths.evidence, 'stage3-packages', 'main-a.json'))
    assert.equal(frameworkBoundFacts.framework.version, '2.0.3')
    assert.equal(frameworkBoundFacts.framework.byte_hash, KNOWLEDGE_MAGAZINE_FRAMEWORK_BYTE_HASH)
    createWriterResults(first)
    createAssetReceipt(first)
    const article = first.articles[0]
    const enriched = readFileSync(first.paths[article.article_id], 'utf8').replace('\n## Fazit\n', `
## Merkkasten

Die Einordnung bleibt an die geprüften Originalquellen gebunden.

## Lebensmittel im Überblick

| Lebensmittelgruppe | Beispiel | Einordnung |
| --- | --- | --- |
| Pflanzlich | Beeren | natürlicher Kontext |
| Weitere Quellen | Kräuter | stoffabhängig |

## Rechtlicher Hinweis

Der Artikel ersetzt keine persönliche medizinische Beratung.

## Fazit
`)
    put(first.paths[article.article_id], enriched)
    const writer = json(writerResultPath(first, article.article_id))
    const writerBase = Object.fromEntries(Object.entries(writer).filter(([key]) => key !== 'content_hash'))
    writerBase.article_byte_hash = sha256Bytes(readFileSync(first.paths[article.article_id]))
    put(writerResultPath(first, article.article_id), hashed(writerBase))

    let status = runNutrientContent({ manifestPath: first.paths.run })
    assert.equal(status.state, 'WAITING_FOR_PUBLICATION_QA')
    const compiled = json(compiledPath(first, article.article_id))
    assert.equal(compiled.expected_projection.ui.contract_version, 'knowledge-magazine-ui.v2')
    assert.equal(compiled.expected_projection.ui.toc_title, 'Auf dieser Seite')
    assert.deepEqual(compiled.expected_projection.sections.filter((section) => section.kind === 'control').map((section) => section.control_type), ['merkkasten', 'legal_notice'])
    assert.equal(compiled.expected_projection.toc.some((entry) => ['merkkasten', 'rechtlicher-hinweis'].includes(entry.section_id)), false)
    const foodTable = compiled.expected_projection.sections.flatMap((section) => section.tables).find((table) => table.presentation === 'food_grid')
    assert.deepEqual(foodTable, { presentation: 'food_grid', headers: ['Lebensmittelgruppe', 'Beispiel', 'Einordnung'], rows: [['Pflanzlich', 'Beeren', 'natürlicher Kontext'], ['Weitere Quellen', 'Kräuter', 'stoffabhängig']] })
    const foodSection = compiled.expected_projection.sections.find((section) => section.tables.some((table) => table.presentation === 'food_grid'))
    assert.equal(foodSection.normalized_text, 'Pflanzlich Beeren natürlicher Kontext Weitere Quellen Kräuter stoffabhängig')
    assert.doesNotMatch(foodSection.normalized_text, /Lebensmittelgruppe|Beispiel|Einordnung/)
    assert.deepEqual(compiled.expected_projection.sections.flatMap((section) => section.assets), [{ src: TEST_ASSET_PUBLIC_URL, alt: 'Messgrafik', caption: 'Messwert aus der gebundenen Originalquelle.' }])
    assert.deepEqual(compiled.render_snapshot.actual_projection, compiled.expected_projection)
    assert.equal(compiled.renderer_style_validation.validator_version, 'knowledge-magazine-route-browser-contract.v2.2.0')
    assert.equal(compiled.renderer_style_validation.renderer_style_hash, compiled.renderer_style_validation.route_fingerprint)
    assert.ok(compiled.renderer_style_validation.fixture_hash)
    assert.ok(compiled.renderer_style_validation.route_contract)
    assert.equal('render_snapshot_hash' in compiled.renderer_style_validation, false)

    const localStyleReceipt = resolve(first.root, compiled.renderer_style_validation_path)
    put(localStyleReceipt, { schema: 'tampered-style-cache' })
    status = runNutrientContent({ manifestPath: first.paths.run })
    assert.equal(status.state, 'WAITING_FOR_PUBLICATION_QA')
    assert.deepEqual(status.work_orders.work_orders.map((order) => order.kind), ['publication_qa'])
    assert.equal(status.metrics.cache.renderer_style_hits, 1)
    assert.equal(json(localStyleReceipt).content_hash, compiled.renderer_style_validation.content_hash)

    const negativeRequest = structuredClone(compiled.render_request)
    negativeRequest.expected_projection.sections.find((section) => section.kind === 'content').normalized_text = 'Manipulierter Projektionstext'
    negativeRequest.projection_hash = canonicalJsonHash(negativeRequest.expected_projection)
    const negativeBase = Object.fromEntries(Object.entries(negativeRequest).filter(([key]) => key !== 'content_hash'))
    negativeRequest.content_hash = artifactHashV2(negativeBase)
    const negativeInput = join(first.paths.state, 'render', 'compiler-derived-negative-request.json')
    const negativeOutput = join(first.paths.state, 'render', 'compiler-derived-negative-snapshot.json')
    put(negativeInput, negativeRequest)
    const rendered = spawnSync(process.execPath, [join(ROOT, 'frontend', 'render-knowledge-magazine-snapshot.mjs'), '--input', negativeInput, '--out', negativeOutput], { cwd: ROOT, encoding: 'utf8', windowsHide: true, timeout: 60_000 })
    assert.equal(rendered.status, 1, rendered.stderr || rendered.stdout)
    assert.equal(json(negativeOutput).result, 'FAIL')

    progressToWriters(second)
    createWriterResults(second)
    status = runNutrientContent({ manifestPath: second.paths.run })
    assert.equal(status.state, 'WAITING_FOR_PUBLICATION_QA')
    assert.equal(status.metrics.cache.renderer_style_hits, 1)
    assert.equal(status.metrics.cache.renderer_style_misses, 0)
    const secondCompiled = json(compiledPath(second, second.articles[0].article_id))
    assert.equal(secondCompiled.renderer_style_validation.content_hash, compiled.renderer_style_validation.content_hash)
    assert.notEqual(secondCompiled.render_snapshot.content_hash, compiled.render_snapshot.content_hash)
  } finally {
    first.cleanup()
    second.cleanup()
  }
})

test('optional Stage-4 accepts multiple source-separated records for one guarded target and reaches aggregate COMPLETE only with its exact receipt', () => {
  const fixture = createFixture({ stages: ['stage3'], stage4: true })
  try {
    let status = progressToWriters(fixture)
    assert.equal(status.state, 'WAITING_FOR_WRITERS')
    assert.equal(status.stage4.status, 'WAITING')
    assert.ok(status.work_orders.work_orders.some((entry) => entry.kind === 'writer'))
    assert.ok(status.work_orders.work_orders.some((entry) => entry.kind === 'stage4_stack_sync'))
    createStage4Receipt(fixture, { duplicateTarget: true })
    createWriterResults(fixture)
    status = runNutrientContent({ manifestPath: fixture.paths.run })
    assert.equal(status.state, 'WAITING_FOR_PUBLICATION_QA', JSON.stringify(status, null, 2))
    assert.equal(status.stage4.status, 'PASS')
    assert.ok(status.work_orders.work_orders.every((entry) => entry.kind !== 'stage4_stack_sync'))
    createPublicationReviews(fixture)
    status = runNutrientContent({ manifestPath: fixture.paths.run })
    assert.equal(status.state, 'READY_TO_PUBLISH')
    const release = json(join(fixture.paths.state, 'release', 'content-release.v2.json'))
    createPublishReceipt(fixture, release)
    status = runNutrientContent({ manifestPath: fixture.paths.run })
    assert.equal(status.state, 'COMPLETE')
    assert.equal(status.aggregate_status, 'COMPLETE')
    assert.equal(status.stage4.status, 'PASS')
    assert.equal(status.success_claimed, true)
  } finally { fixture.cleanup() }
})

test('terminal Stage-4 BLOCKED never rolls back a successfully published article branch', () => {
  const fixture = createFixture({ stages: ['stage3'], stage4: true })
  try {
    progressToWriters(fixture)
    createStage4Receipt(fixture, { result: 'BLOCKED' })
    createWriterResults(fixture)
    let status = runNutrientContent({ manifestPath: fixture.paths.run })
    assert.equal(status.state, 'WAITING_FOR_PUBLICATION_QA', JSON.stringify(status, null, 2))
    assert.equal(status.stage4.status, 'BLOCKED')
    createPublicationReviews(fixture)
    status = runNutrientContent({ manifestPath: fixture.paths.run })
    const release = json(join(fixture.paths.state, 'release', 'content-release.v2.json'))
    createPublishReceipt(fixture, release)
    status = runNutrientContent({ manifestPath: fixture.paths.run })
    assert.equal(status.state, 'COMPLETE')
    assert.equal(status.article_branch_status, 'COMPLETE')
    assert.equal(status.aggregate_status, 'BLOCKED')
    assert.equal(status.published, true)
    assert.equal(status.success_claimed, false)
  } finally { fixture.cleanup() }
})

test('Stage-4 projection target set must not contain an unguarded ingredient and population target', () => {
  const fixture = createFixture({ stages: ['stage3'], stage4: true })
  try {
    progressToWriters(fixture)
    createStage4Receipt(fixture)
    const projectionPath = join(fixture.paths.state, 'stage4', 'stack-projection.v2.json')
    const projection = json(projectionPath)
    const projectionBase = Object.fromEntries(Object.entries(projection).filter(([key]) => key !== 'content_hash'))
    projectionBase.records.push({ ...projectionBase.records[0], projection_record_id: 'projection-record-extra', ingredient_id: 10 })
    put(projectionPath, hashed(projectionBase))
    createWriterResults(fixture)
    const status = runNutrientContent({ manifestPath: fixture.paths.run })
    assert.equal(status.state, 'WAITING_FOR_PUBLICATION_QA')
    assert.equal(status.stage4.status, 'BLOCKED_INTEGRITY')
    assert.match(status.stage4.reason, /target set must exactly equal/)
    assert.deepEqual(status.work_orders.work_orders.map((order) => [order.kind, order.execution_class, order.assignee.role]).sort(), [
      ['publication_qa', 'llm', 'article-reader-acceptance-reviewer'],
      ['stage4_receipt_integrity_escalation', 'human', 'content-pipeline-escalation-owner'],
    ])
  } finally { fixture.cleanup() }
})

test('Stage-4 disabled emits no phantom Stage-4 WorkOrder', () => {
  const fixture = createFixture({ stages: ['stage3'], stage4: false })
  try {
    const status = progressToWriters(fixture)
    assert.equal(status.stage4.status, 'NOT_REQUESTED')
    assert.ok(status.work_orders.work_orders.every((entry) => entry.kind !== 'stage4_stack_sync'))
  } finally { fixture.cleanup() }
})

test('QA FAIL creates at most two bundled writer revisions and targeted rechecks; a remaining blocker stops', () => {
  const fixture = createFixture({ stages: ['stage3'] })
  try {
    progressToQa(fixture)
    const previous = createPublicationReviews(fixture, { result: 'FAIL' })
    let status = runNutrientContent({ manifestPath: fixture.paths.run })
    assert.equal(status.state, 'WAITING_FOR_WRITERS')
    assert.equal(status.work_orders.work_orders[0].kind, 'writer_revision')
    assert.equal(status.work_orders.work_orders[0].task.bundled_findings.length, 1)
    createWriterResults(fixture, { revision: 1, previous, suffix: ' – überarbeitet' })
    status = runNutrientContent({ manifestPath: fixture.paths.run })
    assert.equal(status.state, 'WAITING_FOR_PUBLICATION_QA')
    assert.equal(status.work_orders.work_orders[0].task.review_type, 'targeted_recheck')
    const previousRevisionOne = createPublicationReviews(fixture, { result: 'FAIL', revision: 1, previous })
    status = runNutrientContent({ manifestPath: fixture.paths.run })
    assert.equal(status.state, 'WAITING_FOR_WRITERS')
    assert.equal(status.work_orders.work_orders[0].task.revision, 2)
    createWriterResults(fixture, { revision: 2, previous: previousRevisionOne, suffix: ' – final überarbeitet' })
    status = runNutrientContent({ manifestPath: fixture.paths.run })
    assert.equal(status.state, 'WAITING_FOR_PUBLICATION_QA')
    createPublicationReviews(fixture, { result: 'FAIL', revision: 2, previous: previousRevisionOne })
    status = runNutrientContent({ manifestPath: fixture.paths.run })
    assert.equal(status.state, 'BLOCKED')
    assert.equal(status.work_orders.work_orders[0].kind, 'publication_escalation')
  } finally { fixture.cleanup() }
})

test('compiler repair of a publication revision preserves its failed-review ancestry', () => {
  const fixture = createFixture({ stages: ['stage3'] })
  try {
    progressToQa(fixture)
    const previous = createPublicationReviews(fixture, { result: 'FAIL' })
    let status = runNutrientContent({ manifestPath: fixture.paths.run })
    const revisionOrder = status.work_orders.work_orders[0]
    assert.equal(revisionOrder.kind, 'writer_revision')
    const historyPath = join(fixture.paths.state, 'work-orders-history.v2.jsonl')
    const issued = json(join(fixture.paths.state, 'work-orders.v2.json'))
    const alternateRevision = { ...revisionOrder, task: { ...revisionOrder.task, previous: { ...revisionOrder.task.previous, review_id: 'alternate-review-r0', compiled_payload_hash: `sha256:${'1'.repeat(64)}` } } }
    alternateRevision.work_order_id = writerWorkOrderIdV2(alternateRevision)
    const alternateEventBase = { schema: 'nutrient_content_work_order_event.v2', run_id: issued.run_id, manifest_hash: issued.manifest_hash, issued_at: '2026-07-14T14:01:00.000Z', work_order: alternateRevision }
    const alternateEvent = { ...alternateEventBase, event_hash: canonicalJsonHash(alternateEventBase) }
    put(historyPath, `${readFileSync(historyPath, 'utf8')}${JSON.stringify(alternateEvent)}\n`)
    createWriterResults(fixture, { revision: 1, previous })
    status = runNutrientContent({ manifestPath: fixture.paths.run })
    const repair = status.work_orders.work_orders.find((entry) => entry.kind === 'writer_repair')
    assert.ok(repair)
    assert.equal(repair.task.revision, 1)
    assert.deepEqual(repair.task.previous, revisionOrder.task.previous)
    const malformed = { ...repair, task: { ...repair.task, previous: null } }
    malformed.work_order_id = writerWorkOrderIdV2(malformed)
    const malformedEventBase = { schema: 'nutrient_content_work_order_event.v2', run_id: issued.run_id, manifest_hash: issued.manifest_hash, issued_at: '2026-07-14T14:05:00.000Z', work_order: malformed }
    const malformedEvent = { ...malformedEventBase, event_hash: canonicalJsonHash(malformedEventBase) }
    put(historyPath, `${readFileSync(historyPath, 'utf8')}${JSON.stringify(malformedEvent)}\n`)
    status = runNutrientContent({ manifestPath: fixture.paths.run })
    const resumed = status.work_orders.work_orders.find((entry) => entry.kind === 'writer_repair')
    assert.ok(resumed)
    assert.deepEqual(resumed.task.previous, revisionOrder.task.previous)
    assert.notEqual(resumed.work_order_id, malformed.work_order_id)
  } finally { fixture.cleanup() }
})

test('generated graphics require real bytes, caption, exact record bindings and article_asset.v2; mutation invalidates validation', () => {
  const fixture = createFixture({ stages: ['stage3'], graphic: true })
  try {
    progressToQa(fixture)
    const assetPath = resolve(fixture.root, json(join(fixture.paths.state, 'assets', 'main-a', '0.article-asset.v2.json')).asset_path)
    const assetReceipt = json(join(fixture.paths.state, 'assets', 'main-a', '0.article-asset.v2.json'))
    assert.deepEqual(Object.keys(assetReceipt).sort(), ['article_id', 'asset_byte_hash', 'asset_id', 'asset_index', 'asset_path', 'alt', 'caption', 'content_hash', 'created_at', 'creator', 'height', 'mime_type', 'position', 'record_ids', 'schema', 'width', 'work_order_id'].sort())
    assert.equal(Object.hasOwn(assetReceipt, 'r2_key'), false)
    assert.equal(Object.hasOwn(assetReceipt, 'final_public_url'), false)
    let status = runNutrientContent({ manifestPath: fixture.paths.run })
    assert.equal(status.state, 'WAITING_FOR_PUBLICATION_QA')
    const compiled = json(compiledPath(fixture, 'main-a'))
    assert.equal(compiled.assets[0].caption, 'Messwert aus der gebundenen Originalquelle.')
    assert.equal(compiled.assets[0].record_ids[0], 'record-a')
    assert.equal(compiled.assets[0].r2_key, TEST_ASSET_R2_KEY)
    assert.equal(compiled.assets[0].public_url, TEST_ASSET_PUBLIC_URL)
    put(assetPath, Buffer.concat([PNG_1X1, Buffer.from('changed')]))
    status = runNutrientContent({ manifestPath: fixture.paths.run })
    assert.equal(status.state, 'WAITING_FOR_WRITERS')
    assert.match(status.work_orders.work_orders[0].reason, /asset receipt|byte hash|compile/i)
    put(assetPath, PNG_1X1)
    put(fixture.paths['main-a'], readFileSync(fixture.paths['main-a'], 'utf8').replace(TEST_ASSET_PUBLIC_URL, 'chart.png'))
    put(join(dirname(fixture.paths['main-a']), 'chart.png'), PNG_1X1)
    const writer = json(writerResultPath(fixture, 'main-a'))
    writer.article_byte_hash = sha256Bytes(readFileSync(fixture.paths['main-a']))
    writer.content_hash = artifactHashV2(writer)
    put(writerResultPath(fixture, 'main-a'), writer)
    status = runNutrientContent({ manifestPath: fixture.paths.run })
    assert.equal(status.state, 'BLOCKED')
    assert.equal(status.work_orders.work_orders[0].kind, 'writer_repair_escalation')
    assert.match(status.work_orders.work_orders[0].reason, /third distinct failure fingerprint/i)
    assert.equal(status.work_orders.work_orders[0].task.prior_failure_fingerprints.length, 2)
    assert.ok(!status.work_orders.work_orders[0].task.prior_failure_fingerprints.includes(status.work_orders.work_orders[0].task.failure_fingerprint))
    const escalation = status.work_orders.work_orders[0]
    const resolutionOutput = escalation.outputs.find((entry) => entry.name === 'escalation_resolution')
    assert.ok(resolutionOutput)
    const resolution = hashed({
      schema: 'writer_repair_escalation_resolution.v1', decision: 'APPROVE_ONE_SCOPED_REPAIR', run_id: 'run-a', work_order_id: escalation.work_order_id,
      article_id: 'main-a', revision: 0, failure_kind: escalation.task.failure_kind, failure_fingerprint: escalation.task.failure_fingerprint,
      owner: { role: 'content-pipeline-escalation-owner', id: 'test-escalation-owner' }, resolved_at: '2026-07-14T14:30:00.000Z', authorization_basis: 'Fixture explicitly authorizes one scoped repair.',
    })
    put(resolve(fixture.root, resolutionOutput.path), resolution)
    status = runNutrientContent({ manifestPath: fixture.paths.run })
    assert.equal(status.state, 'WAITING_FOR_WRITERS')
    assert.equal(status.work_orders.work_orders[0].kind, 'writer_repair')
    assert.equal(status.work_orders.work_orders[0].task.repair.escalation_resolution_hash, resolution.content_hash)
    createWriterResults(fixture)
    put(fixture.paths['main-a'], readFileSync(fixture.paths['main-a'], 'utf8').replace(TEST_ASSET_PUBLIC_URL, 'chart.png'))
    const ownerRepairWriter = json(writerResultPath(fixture, 'main-a'))
    ownerRepairWriter.article_byte_hash = sha256Bytes(readFileSync(fixture.paths['main-a']))
    ownerRepairWriter.content_hash = artifactHashV2(ownerRepairWriter)
    put(writerResultPath(fixture, 'main-a'), ownerRepairWriter)
    status = runNutrientContent({ manifestPath: fixture.paths.run })
    assert.equal(status.state, 'BLOCKED')
    assert.equal(status.work_orders.work_orders[0].kind, 'writer_repair_escalation')
    assert.equal(status.work_orders.work_orders.some((entry) => entry.kind === 'writer_repair'), false)
  } finally { fixture.cleanup() }
})

test('generated asset is staged once under its derived content-addressed R2 path before the D1 release', async () => {
  const fixture = createFixture({ stages: ['stage3'], graphic: true })
  try {
    progressToQa(fixture)
    createPublicationReviews(fixture)
    let status = runNutrientContent({ manifestPath: fixture.paths.run })
    assert.equal(status.state, 'WAITING_FOR_ASSET_DEPLOYMENT')
    const order = status.work_orders.work_orders.find((entry) => entry.kind === 'asset_stage')
    assert.ok(order)
    const requestInput = order.inputs.find((entry) => entry.name === 'asset_deployment_request')
    const request = json(resolve(fixture.root, requestInput.path))
    assert.equal(request.assets.length, 1)
    assert.equal(request.assets[0].r2_key, TEST_ASSET_R2_KEY)
    assert.equal(request.assets[0].final_public_url, TEST_ASSET_PUBLIC_URL)
    assert.equal(request.assets[0].local_asset_path, 'generated/state/assets/main-a/0.generated.png')

    const context = loadNutrientContentRunManifest(fixture.paths.run)
    const staged = await stageArticleAssetsV1({
      context, workOrder: order, stagingEnabled: true,
      commandRunner: (_command, args) => {
        assert.ok(args.includes(`supplement-stack-images/${TEST_ASSET_R2_KEY}`))
        return { status: 0, stdout: '', stderr: '' }
      },
      fetchImpl: async (url) => {
        assert.equal(new URL(url).pathname, TEST_ASSET_PUBLIC_URL)
        return new Response(PNG_1X1, { status: 200, headers: { 'content-type': 'image/png' } })
      },
    })
    assert.equal(staged.result, 'PASS')
    assert.equal(staged.assets[0].readback.result, 'MATCH')
    status = runNutrientContent({ manifestPath: fixture.paths.run })
    assert.equal(status.state, 'READY_TO_PUBLISH', JSON.stringify(status.work_orders?.work_orders ?? [], null, 2))
    const release = json(join(fixture.paths.state, 'release', 'content-release.v2.json'))
    assert.equal(release.asset_deployment_receipt_hash, staged.content_hash)
  } finally { fixture.cleanup() }
})

test('an executed compiler/asset repair fingerprint gets exactly one attempt and then blocks instead of looping', () => {
  const fixture = createFixture({ stages: ['stage3'], graphic: true })
  try {
    progressToWriters(fixture)
    put(join(fixture.root, 'frontend', 'public', 'assets', 'knowledge', 'main-a-explanation.png'), PNG_1X1)
    createWriterResults(fixture)
    let status = runNutrientContent({ manifestPath: fixture.paths.run })
    assert.equal(status.state, 'WAITING_FOR_WRITERS')
    const repair = status.work_orders.work_orders.find((entry) => entry.kind === 'writer_repair')
    assert.ok(repair)
    createWriterResults(fixture)
    status = runNutrientContent({ manifestPath: fixture.paths.run })
    assert.equal(status.state, 'BLOCKED')
    const escalation = status.work_orders.work_orders[0]
    assert.equal(escalation.kind, 'writer_repair_escalation')
    assert.equal(escalation.task.failure_fingerprint, repair.task.repair.failure_fingerprint)
    assert.match(escalation.reason, /single permitted attempt/i)
    const previousHash = canonicalJsonHash(null)
    assert.equal(escalation.task.previous_hash, previousHash)
    const resolutionOutput = escalation.outputs.find((entry) => entry.name === 'escalation_resolution')
    assert.ok(resolutionOutput.path.includes(previousHash.slice('sha256:'.length, 'sha256:'.length + 16)))
    const otherPreviousHash = canonicalJsonHash({ review_id: 'other-review-r0', compiled_payload_hash: `sha256:${'2'.repeat(64)}` })
    const otherContract = { ...escalation, task: { ...escalation.task, previous_hash: otherPreviousHash } }
    delete otherContract.work_order_id
    assert.notEqual(canonicalJsonHash(otherContract), escalation.work_order_id)
    assert.notEqual(resolutionOutput.path.replace(previousHash.slice(7, 23), otherPreviousHash.slice(7, 23)), resolutionOutput.path)
  } finally { fixture.cleanup() }
})

test('primitive PASS publication receipts cannot claim success; already_current needs concrete matching hashes', () => {
  const fixture = createFixture({ stages: ['stage3'] })
  try {
    progressToQa(fixture)
    createPublicationReviews(fixture)
    let status = runNutrientContent({ manifestPath: fixture.paths.run })
    assert.equal(status.state, 'READY_TO_PUBLISH')
    const release = json(join(fixture.paths.state, 'release', 'content-release.v2.json'))
    createPublishReceipt(fixture, release, { primitive: true })
    status = runNutrientContent({ manifestPath: fixture.paths.run })
    assert.equal(status.state, 'BLOCKED')
    assert.equal(status.work_orders.work_orders[0].kind, 'publish_receipt_integrity_escalation')
    assert.equal(status.published, false)
    const escalationId = status.work_orders.work_orders[0].work_order_id
    status = runNutrientContent({ manifestPath: fixture.paths.run })
    assert.equal(status.state, 'BLOCKED')
    assert.equal(status.work_orders.work_orders[0].work_order_id, escalationId)
    assert.ok(status.work_orders.work_orders.every((entry) => entry.kind !== 'publication_apply'))
    createPublishReceipt(fixture, release, { alreadyCurrent: true })
    const receiptPath = join(fixture.paths.state, 'publish', 'content-publish-receipt.v2.json')
    let receipt = json(receiptPath)
    receipt.article_results[0].guard_result.actual.compiled_payload_hash = sha256Bytes(Buffer.from('foreign-current-payload'))
    receipt.content_hash = artifactHashV2(receipt)
    put(receiptPath, receipt)
    status = runNutrientContent({ manifestPath: fixture.paths.run })
    assert.equal(status.state, 'BLOCKED')
    createPublishReceipt(fixture, release, { alreadyCurrent: true })
    receipt = json(receiptPath)
    receipt.article_results[0].qa_payload_hash = sha256Bytes(Buffer.from('foreign-qa-payload'))
    receipt.content_hash = artifactHashV2(receipt)
    put(receiptPath, receipt)
    status = runNutrientContent({ manifestPath: fixture.paths.run })
    assert.equal(status.state, 'BLOCKED')
    createPublishReceipt(fixture, release, { alreadyCurrent: true })
    status = runNutrientContent({ manifestPath: fixture.paths.run })
    assert.equal(status.state, 'COMPLETE')
  } finally { fixture.cleanup() }
})

test('Class M update still requires exact changed public DOM and SEO readback', () => {
  const fixture = createFixture({ stages: ['stage3'] })
  try {
    const manifest = json(fixture.paths.run)
    manifest.article_plan.stage3[0].change_class = 'M'
    manifest.article_plan.stage3[0].write_guard = {
      mode: 'update', expected_status: 'published', expected_version: 2,
      expected_payload_hash: sha256Bytes(Buffer.from('previous-compiled-payload')),
    }
    put(fixture.paths.run, manifest)
    progressToQa(fixture)
    createPublicationReviews(fixture)
    let status = runNutrientContent({ manifestPath: fixture.paths.run })
    assert.equal(status.state, 'WAITING_FOR_ARTICLE_TARGETS')
    createArticleTargetReceipt(fixture)
    status = runNutrientContent({ manifestPath: fixture.paths.run })
    assert.equal(status.state, 'READY_TO_PUBLISH')
    const release = json(join(fixture.paths.state, 'release', 'content-release.v2.json'))
    createPublishReceipt(fixture, release)
    const receiptPath = join(fixture.paths.state, 'publish', 'content-publish-receipt.v2.json')
    let receipt = json(receiptPath)
    delete receipt.article_results[0].readbacks.seo
    receipt.content_hash = artifactHashV2(receipt)
    put(receiptPath, receipt)
    status = runNutrientContent({ manifestPath: fixture.paths.run })
    assert.equal(status.state, 'BLOCKED')
    assert.equal(status.work_orders.work_orders[0].kind, 'publish_receipt_integrity_escalation')

    createPublishReceipt(fixture, release)
    receipt = json(receiptPath)
    delete receipt.article_results[0].readbacks.dom
    receipt.content_hash = artifactHashV2(receipt)
    put(receiptPath, receipt)
    status = runNutrientContent({ manifestPath: fixture.paths.run })
    assert.equal(status.state, 'BLOCKED')
    assert.equal(status.work_orders.work_orders[0].kind, 'publish_receipt_integrity_escalation')
  } finally { fixture.cleanup() }
})

test('badge mismatch blocks only the aggregate after commit and never reissues writer, QA or publication apply', () => {
  const fixture = createFixture({ stages: ['stage2'] })
  try {
    progressToQa(fixture)
    createPublicationReviews(fixture)
    let status = runNutrientContent({ manifestPath: fixture.paths.run })
    assert.equal(status.state, 'READY_TO_PUBLISH')
    const release = json(join(fixture.paths.state, 'release', 'content-release.v2.json'))
    createPublishReceipt(fixture, release)
    const receiptPath = join(fixture.paths.state, 'publish', 'content-publish-receipt.v2.json')
    const receipt = json(receiptPath)
    const badge = receipt.badge_readback, origin = badge.origin_results[0]
    origin.api.statuses[0].has_studies = false
    origin.hydrated_overview.cards[0].studies_visible = false
    origin.result = 'MISMATCH'
    origin.mismatches = [`${origin.api.statuses[0].ingredient_id}:studies_expected`]
    badge.result = 'MISMATCH'
    badge.mismatches = [...origin.mismatches]
    receipt.content_hash = artifactHashV2(receipt)
    put(receiptPath, receipt)

    status = runNutrientContent({ manifestPath: fixture.paths.run })
    assert.equal(status.state, 'BLOCKED')
    assert.equal(status.published, true)
    assert.equal(status.article_branch_status, 'COMPLETE')
    assert.equal(status.badge_readback.result, 'MISMATCH')
    assert.equal(status.badge_readback.article_publication_rollback_required, false)
    assert.deepEqual(status.work_orders.work_orders.map((order) => order.kind), ['badge_readback_escalation'])
    assert.equal(status.work_orders.work_orders[0].task.publication_apply_must_not_repeat, true)
    const escalationId = status.work_orders.work_orders[0].work_order_id

    status = runNutrientContent({ manifestPath: fixture.paths.run })
    assert.equal(status.state, 'BLOCKED')
    assert.equal(status.published, true)
    assert.equal(status.work_orders.work_orders[0].work_order_id, escalationId)
    assert.ok(status.work_orders.work_orders.every((order) => !['writer', 'writer_revision', 'publication_qa', 'publication_apply'].includes(order.kind)))
  } finally { fixture.cleanup() }
})

test('site policy waits without rollback while client-only SEO or missing sitemap remains a truthful delivery gap', () => {
  const blocked = createFixture({ stages: ['stage2'] })
  try {
    progressToQa(blocked)
    createPublicationReviews(blocked)
    let status = runNutrientContent({ manifestPath: blocked.paths.run })
    const release = json(join(blocked.paths.state, 'release', 'content-release.v2.json'))
    createPublishReceipt(blocked, release, { indexabilityState: 'BLOCKED_BY_SITE_POLICY' })
    status = runNutrientContent({ manifestPath: blocked.paths.run })
    assert.equal(status.state, 'WAITING_FOR_INDEXABILITY_RELEASE')
    assert.equal(status.published, true)
    assert.equal(status.article_branch_status, 'COMPLETE')
    assert.equal(status.seo_live_claim, false)
    assert.deepEqual(status.work_orders.work_orders.map((order) => order.kind), ['indexability_release_handoff'])
    assert.equal(status.work_orders.work_orders[0].constraints.no_article_rollback, true)
    assert.equal(status.work_orders.work_orders[0].constraints.no_writer_or_qa_rerun, true)
    const frozenReleasePath = join(blocked.paths.state, 'release', 'content-release.v2.json')
    const frozenReleaseHash = sha256Bytes(readFileSync(frozenReleasePath))
    const staleReviewPath = reviewPath(blocked, release.articles[0].article_id)
    const staleUpstreamReview = json(staleReviewPath)
    staleUpstreamReview.qa_payload_hash = canonicalJsonHash({ stale_after_commit: true })
    staleUpstreamReview.content_hash = artifactHashV2(staleUpstreamReview)
    put(staleReviewPath, staleUpstreamReview)

    const publishReceipt = json(join(blocked.paths.state, 'publish', 'content-publish-receipt.v2.json'))
    assert.throws(() => buildIndexabilityReleaseReceiptV1({
      release,
      publishReceipt,
      rendererRequest: hashed({ schema: 'renderer_public_readback_request.v2', release_hash: release.release_hash, articles: [] }),
      rendererReceipt: hashed({ schema: 'renderer_public_readback_receipt.v2', release_hash: release.release_hash }),
    }), /generated_at|canonical/i)
    assert.throws(() => buildIndexabilityReleaseReceiptV1({
      release,
      publishReceipt,
      rendererRequest: buildRendererPublicReadbackRequestV2(release, { generatedAt: '2026-07-14T15:59:00.000Z' }),
      rendererReceipt: {},
    }), /postdate/i)
    assert.throws(() => createIndexabilityReleaseReceipt(blocked, release, {
      requestGeneratedAt: '2026-07-14T17:00:00.000Z',
      receiptCheckedAt: '2026-07-14T17:00:00.000Z',
    }), /must postdate/i)
    assert.throws(() => createIndexabilityReleaseReceipt(blocked, release, {
      requestGeneratedAt: '2026-07-14T17:00:00.000Z',
      receiptCheckedAt: '2026-07-14T16:59:59.999Z',
    }), /must postdate/i)

    createIndexabilityReleaseReceipt(blocked, release)
    status = runNutrientContent({ manifestPath: blocked.paths.run })
    assert.equal(status.state, 'COMPLETE')
    assert.equal(status.published, true)
    assert.equal(status.seo_live_claim, true)
    assert.deepEqual(status.delivery_gaps, [])
    assert.equal(status.indexability.state, 'RELEASED')
    assert.equal(status.work_orders.work_orders.length, 0)
    assert.equal(sha256Bytes(readFileSync(frozenReleasePath)), frozenReleaseHash)
  } finally { blocked.cleanup() }

  for (const indexabilityState of ['BLOCKED_BY_HTTP', 'UNKNOWN']) {
    const originBlocked = createFixture({ stages: ['stage2'] })
    try {
      progressToQa(originBlocked)
      createPublicationReviews(originBlocked)
      let status = runNutrientContent({ manifestPath: originBlocked.paths.run })
      const release = json(join(originBlocked.paths.state, 'release', 'content-release.v2.json'))
      createPublishReceipt(originBlocked, release, { indexabilityState, seoDeliveryState: 'CLIENT_RENDERED_ONLY' })
      status = runNutrientContent({ manifestPath: originBlocked.paths.run })
      assert.equal(status.state, 'WAITING_FOR_INDEXABILITY_RELEASE')
      assert.equal(status.published, true)
      assert.equal(status.article_branch_status, 'COMPLETE')
      assert.equal(status.seo_live_claim, false)
      assert.deepEqual(status.indexability.blockers.map((entry) => entry.state), [indexabilityState])
      assert.deepEqual(status.work_orders.work_orders.map((order) => order.kind), ['indexability_release_handoff'])
      assert.equal(status.work_orders.work_orders[0].constraints.no_article_rollback, true)
    } finally { originBlocked.cleanup() }
  }

  const deliveryGap = createFixture({ stages: ['stage2'] })
  try {
    progressToQa(deliveryGap)
    createPublicationReviews(deliveryGap)
    let status = runNutrientContent({ manifestPath: deliveryGap.paths.run })
    const release = json(join(deliveryGap.paths.state, 'release', 'content-release.v2.json'))
    createPublishReceipt(deliveryGap, release, { seoDeliveryState: 'CLIENT_RENDERED_ONLY', sitemapState: 'NOT_AVAILABLE' })
    status = runNutrientContent({ manifestPath: deliveryGap.paths.run })
    assert.equal(status.state, 'WAITING_FOR_INDEXABILITY_RELEASE')
    assert.equal(status.published, true)
    assert.equal(status.article_branch_status, 'COMPLETE')
    assert.equal(status.seo_live_claim, false)
    assert.deepEqual(status.delivery_gaps.map((entry) => entry.code).sort(), ['CLIENT_RENDERED_ONLY', 'NOT_AVAILABLE'])
    assert.deepEqual(status.work_orders.work_orders.map((order) => order.kind), ['indexability_release_handoff'])
  } finally { deliveryGap.cleanup() }
})

test('run manifest rejects absolute/traversal paths, colliding IDs/slugs and generated/input collisions before writes', () => {
  const cases = [
    (manifest, fixture) => { manifest.inputs.research_path = fixture.paths.research },
    (manifest) => { manifest.inputs.research_path = '../escape.md' },
    (manifest) => { manifest.article_plan.stage3[0].article_id = '../unsafe' },
    (manifest) => { manifest.outputs.state_dir = manifest.inputs.research_path },
    (manifest) => { manifest.article_plan.stage3[0].facts_package_path = 'forged-package.json' },
  ]
  for (const mutate of cases) {
    const fixture = createFixture({ stages: ['stage3'] })
    try {
      const manifest = json(fixture.paths.run)
      mutate(manifest, fixture)
      put(fixture.paths.run, manifest)
      assert.throws(() => loadNutrientContentRunManifest(fixture.paths.run), /absolute|\.\.|path-safe|contain|collision|input|distinct/i)
    } finally { fixture.cleanup() }
  }
})

test('run manifest normalizes guarded published-article retirements and rejects active collisions', () => {
  const fixture = createFixture({ stages: ['stage2', 'stage3'] })
  try {
    const manifest = json(fixture.paths.run)
    manifest.publish.retire_articles = [{ article_id: 'legacy-bundle', slug: 'legacy-bundle', expected_status: 'published', expected_version: 7, expected_payload_hash: canonicalJsonHash({ legacy: true }) }]
    put(fixture.paths.run, manifest)
    const context = loadNutrientContentRunManifest(fixture.paths.run)
    assert.deepEqual(context.publish.retireArticles, manifest.publish.retire_articles)

    manifest.publish.retire_articles[0].article_id = manifest.article_plan.stage2[0].article_id
    put(fixture.paths.run, manifest)
    assert.throws(() => loadNutrientContentRunManifest(fixture.paths.run), /collides/i)

    manifest.publish.retire_articles[0].article_id = 'legacy-bundle'
    manifest.publish.retire_articles[0].expected_status = 'draft'
    put(fixture.paths.run, manifest)
    assert.throws(() => loadNutrientContentRunManifest(fixture.paths.run), /must equal published/i)
  } finally { fixture.cleanup() }
})

test('evidence manifest rejects absolute, traversal and colliding declared paths', () => {
  const cases = [
    (manifest, fixture) => { manifest.research_path = fixture.paths.research },
    (manifest) => { manifest.source_evidence_shard_paths = ['../shard.json'] },
    (manifest) => { manifest.source_facts_review_paths[0] = manifest.source_evidence_shard_paths[0]; manifest.source_facts_review_slices[0].path = manifest.source_evidence_shard_paths[0] },
  ]
  for (const mutate of cases) {
    const fixture = createFixture({ stages: ['stage3'] })
    try {
      const manifest = json(fixture.paths.evidenceManifest)
      mutate(manifest, fixture)
      manifest.content_hash = artifactHashV2(manifest)
      put(fixture.paths.evidenceManifest, manifest)
      assert.throws(() => loadEvidenceManifestV2(fixture.paths.evidenceManifest), /absolute|\.\.|collision/i)
    } finally { fixture.cleanup() }
  }
})

test('evidence build manifest is deterministic, four-source-capped and never creates a coordinator wave', () => {
  const fixture = createFixture({ stages: ['stage3'] })
  try {
    rmSync(fixture.paths.evidenceManifest)
    rmSync(fixture.paths.shard)
    let status = runNutrientContent({ manifestPath: fixture.paths.run })
    assert.equal(status.state, 'WAITING_FOR_SOURCE_EXTRACTION')
    assert.ok(status.work_orders.work_orders.every((entry) => entry.kind !== 'evidence_manifest'))
    const extraction = status.work_orders.work_orders[0]
    assert.equal(extraction.kind, 'source_extraction')
    assert.ok(extraction.inputs.every((input) => input.name !== 'research'))
    assert.equal(extraction.reused_sources.length, 1)
    assert.deepEqual(extraction.outputs.map((output) => output.name), ['evidence_shard'])
    const firstManifest = json(fixture.paths.evidenceManifest)
    assert.equal(firstManifest.max_sources_per_slice, 4)
    assert.ok(firstManifest.extraction_slices.every((slice) => slice.source_ids.length <= 4))
    const firstOrderId = extraction.work_order_id
    status = runNutrientContent({ manifestPath: fixture.paths.run })
    assert.equal(status.work_orders.work_orders[0].work_order_id, firstOrderId)
    assert.equal(json(fixture.paths.evidenceManifest).content_hash, firstManifest.content_hash)

    const coverage = json(fixture.paths.coverage)
    coverage.articles[0].seo_brief.reader_promise = 'Eine aktualisierte, weiterhin quellengebundene Einordnung.'
    coverage.content_hash = artifactHashV2(coverage)
    put(fixture.paths.coverage, coverage)
    status = runNutrientContent({ manifestPath: fixture.paths.run })
    assert.equal(status.state, 'WAITING_FOR_SOURCE_EXTRACTION')
    assert.notEqual(json(fixture.paths.evidenceManifest).content_hash, firstManifest.content_hash)
    assert.notEqual(status.work_orders.work_orders[0].work_order_id, firstOrderId)
  } finally { fixture.cleanup() }
})

test('unrelated route additions are link-slice cache-neutral, selected target changes invalidate only their article node', () => {
  const unrelated = createFixture({ stages: ['stage3'] })
  try {
    let status = progressToWriters(unrelated)
    const writerId = status.work_orders.work_orders.find((entry) => entry.kind === 'writer').work_order_id
    const source = json(unrelated.paths.linkInventorySource)
    source.routes.push({ path: '/wissen/quercetin', slug: 'quercetin', title: 'Quercetin', article_layer: 'main_article', source_urls: [] })
    source.content_hash = artifactHashV2(source)
    put(unrelated.paths.linkInventorySource, source)
    status = runNutrientContent({ manifestPath: unrelated.paths.run })
    assert.equal(status.state, 'WAITING_FOR_WRITERS')
    assert.equal(status.work_orders.work_orders.find((entry) => entry.kind === 'writer').work_order_id, writerId)
  } finally { unrelated.cleanup() }

  const selected = createFixture({ stages: ['stage3'] })
  try {
    const coverage = json(selected.paths.coverage)
    coverage.articles[0].seo_brief.internal_link_targets = ['/wissen/magnesium']
    const links = [{ path: '/wissen/magnesium', title: 'Magnesium', target_id: 'magnesium', target_state: 'live', target_article_id: null, covered_source_ids: ['source-a'] }]
    coverage.articles[0].selected_link_slice = { links, slice_hash: canonicalJsonHash({ links }) }
    coverage.content_hash = artifactHashV2(coverage)
    put(selected.paths.coverage, coverage)
    const shard = json(selected.paths.shard)
    shard.coverage_plan_hash = coverage.content_hash
    shard.content_hash = artifactHashV2(shard)
    put(selected.paths.shard, shard)
    progressToWriters(selected)
    const inventorySource = json(selected.paths.linkInventorySource)
    inventorySource.routes.find((route) => route.slug === 'magnesium').title = 'Magnesium – aktualisiert'
    inventorySource.content_hash = artifactHashV2(inventorySource)
    put(selected.paths.linkInventorySource, inventorySource)
    const status = runNutrientContent({ manifestPath: selected.paths.run })
    assert.equal(status.state, 'WAITING_FOR_RESEARCH')
    const order = status.work_orders.work_orders[0]
    assert.equal(order.kind, 'coverage_planning')
    assert.deepEqual(order.scope.article_ids, ['main-a'])
    assert.deepEqual(order.task.affected_article_ids, ['main-a'])
    assert.ok(order.link_inventory)
  } finally { selected.cleanup() }
})

test('legacy link inventories and coverage plans are refreshed instead of reused under the source-assignment policy', () => {
  const inventoryFixture = createFixture({ stages: ['stage3'] })
  try {
    const inventory = json(inventoryFixture.paths.linkInventorySource)
    delete inventory.routes[0].article_layer
    inventory.content_hash = artifactHashV2(inventory)
    put(inventoryFixture.paths.linkInventorySource, inventory)
    const status = runNutrientContent({ manifestPath: inventoryFixture.paths.run })
    assert.equal(status.state, 'WAITING_FOR_LINK_INVENTORY')
    assert.equal(status.work_orders.work_orders[0].kind, 'link_inventory_source_readback')
  } finally { inventoryFixture.cleanup() }

  const coverageFixture = createFixture({ stages: ['stage3'] })
  try {
    const coverage = json(coverageFixture.paths.coverage)
    delete coverage.stage2_source_assignment_policy
    coverage.content_hash = artifactHashV2(coverage)
    put(coverageFixture.paths.coverage, coverage)
    const status = runNutrientContent({ manifestPath: coverageFixture.paths.run })
    assert.equal(status.state, 'WAITING_FOR_RESEARCH')
    assert.equal(status.work_orders.work_orders[0].kind, 'coverage_planning')
    assert.equal(status.coverage_replan_reason, 'stage2_source_assignment_policy')
  } finally { coverageFixture.cleanup() }

  const missingInventoryFixture = createFixture({ stages: ['stage3'] })
  try {
    const coverage = json(missingInventoryFixture.paths.coverage)
    delete coverage.stage2_source_assignment_policy
    coverage.content_hash = artifactHashV2(coverage)
    put(missingInventoryFixture.paths.coverage, coverage)
    rmSync(missingInventoryFixture.paths.linkInventorySource)
    const status = runNutrientContent({ manifestPath: missingInventoryFixture.paths.run })
    assert.equal(status.state, 'WAITING_FOR_LINK_INVENTORY')
    assert.equal(status.work_orders.work_orders[0].kind, 'link_inventory_source_readback')
  } finally { missingInventoryFixture.cleanup() }
})

test('live Stage-2 reuse is invalidated when its authoritative source identities differ', () => {
  const fixture = createFixture({ stages: ['stage3'] })
  try {
    const inventory = json(fixture.paths.linkInventorySource)
    inventory.routes.find((route) => route.slug === 'magnesium').source_urls = ['https://example.org/unrelated-study']
    inventory.content_hash = artifactHashV2(inventory)
    put(fixture.paths.linkInventorySource, inventory)
    const status = runNutrientContent({ manifestPath: fixture.paths.run })
    assert.equal(status.state, 'WAITING_FOR_RESEARCH')
    assert.equal(status.work_orders.work_orders[0].kind, 'coverage_planning')
  } finally { fixture.cleanup() }
})

test('release dependencies contain only same-release edges while live links remain in compiled visible lineage', () => {
  const linkLive = { path: '/wissen/magnesium', title: 'Magnesium', target_id: 'magnesium', target_state: 'live', target_article_id: null }
  const linkSameRelease = { path: '/wissen/target-b', title: 'Target B vertiefen', target_id: 'target-b', target_state: 'same_release', target_article_id: 'target-b' }
  const entry = ({ articleId, slug, title, links, compiledLinks }) => ({
    article: { article_id: articleId, stage: 'stage3', slug, change_class: 'L', write_guard: { mode: 'create', expected_status: 'absent', expected_version: 0 } },
    writer: { executionId: `${articleId}-writer` }, publicationReview: { reviewHash: canonicalJsonHash({ articleId, kind: 'review' }), review: { reviewed_at: '2026-07-14T12:00:00.000Z' } }, validationReceiptHash: canonicalJsonHash({ articleId, kind: 'validation' }),
    factsPackage: { selected_link_slice: { links } },
    compiled: {
      article_byte_hash: canonicalJsonHash({ articleId, kind: 'article' }), facts_package_hash: canonicalJsonHash({ articleId, kind: 'facts' }), evidence_membership_hash: canonicalJsonHash({ articleId, kind: 'membership' }), article_lineage_hash: canonicalJsonHash({ articleId, kind: 'lineage' }), framework_hash: canonicalJsonHash({ articleId, kind: 'framework' }),
      compiled_payload_hash: canonicalJsonHash({ articleId, kind: 'compiled' }), visible_payload_hash: canonicalJsonHash({ articleId, kind: 'visible' }), qa_payload: { content_hash: canonicalJsonHash({ articleId, kind: 'qa' }) }, render_snapshot: { content_hash: canonicalJsonHash({ articleId, kind: 'render' }) }, relation_hash: canonicalJsonHash({ articleId, kind: 'relations' }), asset_hashes: [],
      seo: { meta_title: `${title} im Überblick`, meta_description: `${title} verständlich und quellengebunden erklärt. Diese Beschreibung ist absichtlich eindeutig.`, seo_hash: canonicalJsonHash({ articleId, kind: 'seo' }) }, publish_payload: { title, body: 'Body', sources: [] }, expanded_sources: [], assets: [], expected_projection: { article_id: articleId }, projection_hash: canonicalJsonHash({ article_id: articleId }), links: compiledLinks,
    },
  })
  const source = entry({ articleId: 'source-a', slug: 'source-a', title: 'Source A', links: [linkLive, linkSameRelease], compiledLinks: [{ label: 'Magnesium', url: '/wissen/magnesium' }, { label: 'Target B vertiefen', url: '/wissen/target-b' }] })
  const target = entry({ articleId: 'target-b', slug: 'target-b', title: 'Target B', links: [], compiledLinks: [] })
  const ingredientIdentity = { ingredient_id: 7, canonical_name: 'Teststoff', canonical_slug: 'teststoff', status: 'active', version: 1 }
  const release = buildContentReleaseV2({ context: { runId: 'link-release-run', manifestHash: canonicalJsonHash({ manifest: 'link-release' }), policyVersion: 'policy-v2', ingredientTarget: { ...ingredientIdentity, identity_hash: canonicalJsonHash(ingredientIdentity), receipt_hash: canonicalJsonHash({ ingredient: 7 }) }, sourceResolution: { receipt_hash: canonicalJsonHash({ sources: [] }), bySourceId: new Map() }, assetDeployment: { receipt_hash: null, assets: [] }, publish: { target: 'test', publicBaseUrl: 'https://supplementstack.de/' } }, articles: [source, target] })
  assert.deepEqual(release.articles.find((article) => article.article_id === 'source-a').internal_link_dependencies, [linkSameRelease])
  assert.ok(source.compiled.links.some((link) => link.url === linkLive.path))
})

test('a genuine framework gap takes the rare versioned design/pilot path and resumes one exact WorkOrder', () => {
  const fixture = createFixture({ stages: ['stage3'] })
  try {
    const coverage = json(fixture.paths.coverage)
    coverage.articles[0].status = 'blocked'
    coverage.articles[0].required_cluster_ids = []
    coverage.articles[0].source_ids = []
    coverage.articles[0].framework = { framework_id: 'stage3.pending-adaptation', version: '1.0.0' }
    coverage.extraction_obligations = []
    coverage.framework_gaps = [{ gap_id: 'gap-main-a', article_id: 'main-a', stage: 'stage3', decision: 'adapt_existing', reason: 'A durable reusable contract change is required.', candidate_framework_id: 'stage3.nonessential_or_endogenous', candidate_framework_version: '2.0.3', target_framework_id: 'stage3.nonessential-or-endogenous-adapted', target_version: '2.1.0', target_framework_path: 'codex-files/frameworks/test-stage3-adapted.md', owner_approval_required: false }]
    coverage.content_hash = artifactHashV2(coverage)
    put(fixture.paths.coverage, coverage)
    let status = runNutrientContent({ manifestPath: fixture.paths.run })
    assert.equal(status.state, 'WAITING_FOR_FRAMEWORK')
    const order = status.work_orders.work_orders[0]
    assert.equal(order.kind, 'framework_design')
    assert.equal(order.assignee.role, 'article-framework-designer')
    assert.ok(order.outputs.every((output) => output.root === 'run'))
    assert.ok(order.outputs.some((output) => output.schema === 'framework_catalog_candidate.v1'))
    assert.ok(order.outputs.some((output) => output.schema === 'framework_compiler_pilot_receipt.v1'))
    assert.ok(order.outputs.some((output) => output.schema === 'framework_render_pilot_receipt.v1'))
    assert.ok(order.outputs.some((output) => output.schema === 'framework_publication_pilot_receipt.v1'))
    assert.equal(order.outputs.some((output) => output.schema === 'article_framework_pilot_receipt.v2'), false)
    const pilotFixtureInput = order.inputs.find((input) => input.name === 'pilot_fixture_gap-main-a')
    assert.equal(pilotFixtureInput.schema, 'framework_pilot_fixture.v1')
    const pilotFixture = json(join(fixture.root, pilotFixtureInput.path))
    assert.equal(pilotFixture.content_hash, pilotFixtureInput.content_hash)
    assert.equal(pilotFixture.base_framework.framework_id, 'stage3.nonessential_or_endogenous')
    assert.ok(pilotFixture.runtime_inputs.every((input) => input.byte_hash === null || /^sha256:[a-f0-9]{64}$/.test(input.byte_hash)))
    assert.equal(order.constraints.no_canonical_catalog_or_framework_write, true)
    status = runNutrientContent({ manifestPath: fixture.paths.run })
    assert.equal(status.work_orders.work_orders[0].work_order_id, order.work_order_id)
  } finally { fixture.cleanup() }
})

test('framework runtime capability gaps fail closed before pilots and require an external authorized technical handoff', () => {
  const fixture = createFixture({ stages: ['stage3'] })
  try {
    const coverage = json(fixture.paths.coverage)
    coverage.articles[0].status = 'blocked'
    coverage.articles[0].required_cluster_ids = []
    coverage.articles[0].source_ids = []
    coverage.articles[0].framework = { framework_id: 'stage3.pending-adaptation', version: '1.0.0' }
    coverage.extraction_obligations = []
    const gap = { gap_id: 'gap-runtime-a', article_id: 'main-a', stage: 'stage3', decision: 'adapt_existing', reason: 'A renderer capability is genuinely missing.', candidate_framework_id: 'stage3.nonessential_or_endogenous', candidate_framework_version: '2.0.3', target_framework_id: 'stage3.runtime-capability-adapted', target_version: '2.1.0', target_framework_path: 'codex-files/frameworks/test-stage3-runtime-adapted.md', owner_approval_required: false }
    coverage.framework_gaps = [gap]
    coverage.content_hash = artifactHashV2(coverage)
    put(fixture.paths.coverage, coverage)
    let status = runNutrientContent({ manifestPath: fixture.paths.run })
    const design = status.work_orders.work_orders[0]
    const candidateOutput = design.outputs.find((output) => output.name === 'candidate_framework_gap-runtime-a')
    const catalogOutput = design.outputs.find((output) => output.name === 'catalog_candidate_gap-runtime-a')
    const fixtureInput = design.inputs.find((input) => input.name === 'pilot_fixture_gap-runtime-a')
    const candidatePath = join(fixture.root, candidateOutput.path)
    put(candidatePath, '# Declarative framework candidate\n')
    const technicalPath = 'scripts/lib/article-runtime-v2.mjs'
    const catalogBase = {
      schema: 'framework_catalog_candidate.v1', gap_id: gap.gap_id, work_order_id: design.work_order_id, pilot_fixture_hash: fixtureInput.content_hash,
      expected_catalog_byte_hash: sha256Bytes(readFileSync(join(ROOT, 'codex-files', 'frameworks', 'framework-catalog.v1.json'))),
      entry: { framework_id: gap.target_framework_id, version: gap.target_version, stage: gap.stage, path: gap.target_framework_path, status: 'approved', framework_sha256: sha256Bytes(readFileSync(candidatePath)) },
      technical_change_paths: [technicalPath], technical_change_baseline: [{ path: technicalPath, byte_hash: sha256Bytes(readFileSync(join(ROOT, technicalPath))) }],
    }
    put(join(fixture.root, catalogOutput.path), hashed(catalogBase))
    status = runNutrientContent({ manifestPath: fixture.paths.run })
    assert.equal(status.state, 'WAITING_FOR_TECHNICAL_FRAMEWORK_CHANGE')
    assert.equal(status.framework_phase, 'external_runtime_change_required')
    const handoff = status.work_orders.work_orders[0]
    assert.equal(handoff.kind, 'framework_runtime_change_handoff')
    assert.equal(handoff.execution_class, 'human')
    assert.deepEqual(handoff.task.technical_change_paths, [technicalPath])
    assert.equal(handoff.constraints.no_runtime_write_by_content_runner, true)
    assert.equal(existsSync(join(fixture.paths.state, 'framework-candidates', gap.gap_id, 'framework-compiler-pilot-receipt.v1.json')), false)
  } finally { fixture.cleanup() }
})

test('multiple framework gaps are serialized and the first activation forces full replan before a stale second candidate', () => {
  const first = { gap: { gap_id: 'gap-a' }, status: 'needs_design', reason: 'missing candidate' }
  const second = { gap: { gap_id: 'gap-b' }, status: 'needs_design', reason: 'missing candidate' }
  assert.deepEqual(selectFrameworkGapTransition([first, second]), { action: 'design', entry: first, deferred_gap_ids: ['gap-b'] })
  const activatedFirst = { gap: first.gap, status: 'resolved', activation: { result: 'PASS' } }
  assert.deepEqual(selectFrameworkGapTransition([activatedFirst, second]), { action: 'replan', entry: activatedFirst, deferred_gap_ids: ['gap-b'] })
})

test('research remains format-agnostic but must be strict UTF-8 and hash-bound before coverage', () => {
  const fixture = createFixture({ stages: ['stage3'] })
  try {
    assert.doesNotThrow(() => loadEvidenceManifestV2(fixture.paths.evidenceManifest))
    put(fixture.paths.research, Buffer.from([0xff, 0xfe, 0xfd]))
    const coverage = json(fixture.paths.coverage)
    coverage.research_hash = sha256Bytes(readFileSync(fixture.paths.research))
    coverage.content_hash = artifactHashV2(coverage)
    put(fixture.paths.coverage, coverage)
    assert.throws(() => loadEvidenceManifestV2(fixture.paths.evidenceManifest), /invalid UTF-8/i)
    assert.throws(() => runNutrientContent({ manifestPath: fixture.paths.run }), /invalid UTF-8/i)
    assert.equal(existsSync(fixture.paths.state), false)
  } finally { fixture.cleanup() }
})

test('resolved junction/symlink breakout is rejected before any generated write', (t) => {
  const fixture = createFixture({ stages: ['stage3'] })
  const outside = mkdtempSync(join(tmpdir(), 'nutrient-outside-'))
  try {
    put(join(outside, 'research.md'), 'outside')
    const link = join(fixture.root, 'linked-outside')
    try { symlinkSync(outside, link, 'junction') } catch (error) { t.skip(`junction creation unavailable: ${error.code}`); return }
    const manifest = json(fixture.paths.run)
    manifest.inputs.research_path = 'linked-outside/research.md'
    put(fixture.paths.run, manifest)
    assert.throws(() => loadNutrientContentRunManifest(fixture.paths.run), /symlink|junction|escapes/i)
    assert.equal(existsSync(fixture.paths.state), false)
  } finally {
    fixture.cleanup()
    rmSync(outside, { recursive: true, force: true })
  }
})

test('all planned writers wait on one run-wide facts gate, but completed sibling writers are not repeated', () => {
  const fixture = createFixture()
  try {
    progressToWriters(fixture)
    createWriterResults(fixture)
    rmSync(writerResultPath(fixture, 'main-a'))
    const status = runNutrientContent({ manifestPath: fixture.paths.run })
    assert.equal(status.state, 'WAITING_FOR_WRITERS')
    assert.equal(status.work_orders.work_orders.length, 1)
    assert.equal(status.work_orders.work_orders[0].task.article_id, 'main-a')
    assert.equal(existsSync(validationPath(fixture, 'study-a')), true)
  } finally { fixture.cleanup() }
})

test('article_result.v2 must bind the exact deterministic writer work order, not any hash-shaped token', () => {
  const fixture = createFixture({ stages: ['stage3'] })
  try {
    const issued = progressToWriters(fixture).work_orders.work_orders[0]
    createWriterResults(fixture)
    let writer = json(writerResultPath(fixture, 'main-a'))
    assert.equal(writer.work_order_id, issued.work_order_id)
    writer.work_order_id = sha256Bytes(Buffer.from('unissued-writer-order'))
    writer.content_hash = artifactHashV2(writer)
    put(writerResultPath(fixture, 'main-a'), writer)
    const status = runNutrientContent({ manifestPath: fixture.paths.run })
    assert.equal(status.state, 'WAITING_FOR_WRITERS')
    assert.match(status.work_orders.work_orders[0].reason, /exact issued contract/i)
  } finally { fixture.cleanup() }
})

test('extractor, facts reviewer, writer and publication reviewer identities stay independent', () => {
  const factsCollision = createFixture({ stages: ['stage3'] })
  try {
    let status = runNutrientContent({ manifestPath: factsCollision.paths.run })
    assert.equal(status.state, 'WAITING_FOR_SOURCE_REVIEW')
    createSourceReview(factsCollision)
    const review = json(factsCollision.paths.review)
    review.reviewer.id = 'extractor-a'
    review.content_hash = artifactHashV2(review)
    put(factsCollision.paths.review, review)
    assert.throws(() => runNutrientContent({ manifestPath: factsCollision.paths.run }), /overlaps an extractor/i)
  } finally { factsCollision.cleanup() }

  const writerCollision = createFixture({ stages: ['stage3'] })
  try {
    progressToWriters(writerCollision)
    createWriterResults(writerCollision)
    const writer = json(writerResultPath(writerCollision, 'main-a'))
    writer.writer.id = 'facts-reviewer-a'
    writer.content_hash = artifactHashV2(writer)
    put(writerResultPath(writerCollision, 'main-a'), writer)
    const status = runNutrientContent({ manifestPath: writerCollision.paths.run })
    assert.equal(status.state, 'WAITING_FOR_WRITERS')
    assert.match(status.work_orders.work_orders[0].reason, /writer must differ|identity overlaps/i)
  } finally { writerCollision.cleanup() }

  const qaCollision = createFixture({ stages: ['stage3'] })
  try {
    progressToQa(qaCollision)
    createPublicationReviews(qaCollision)
    const review = json(reviewPath(qaCollision, 'main-a'))
    review.reviewer.id = 'stage3-writer-a'
    review.content_hash = artifactHashV2(review)
    put(reviewPath(qaCollision, 'main-a'), review)
    const status = runNutrientContent({ manifestPath: qaCollision.paths.run })
    assert.equal(status.state, 'BLOCKED')
    assert.match(status.work_orders.work_orders[0].reason, /not independent/i)
  } finally { qaCollision.cleanup() }
})

test('mixed source-review risk is split into homogeneous standard and high reasoning shards', () => {
  const fixture = createFixture({ stages: ['stage3'] })
  try {
    const plan = json(fixture.paths.coverage)
    plan.extraction_obligations = [
      { obligation_id: 'obligation-low', source_id: 'source-a', cluster_id: 'core', expected_claim_type: 'numeric-result-low', required: true, required_for: ['main-a'], plan_risk_tags: [] },
      { obligation_id: 'obligation-high', source_id: 'source-a', cluster_id: 'core', expected_claim_type: 'upper-limit', required: true, required_for: ['main-a'], plan_risk_tags: [] },
    ]
    plan.articles[0].common_assumption_review.checks[0].obligation_ids = plan.extraction_obligations.map((entry) => entry.obligation_id)
    plan.content_hash = artifactHashV2(plan)
    put(fixture.paths.coverage, plan)
    const secondReviewPath = join(dirname(fixture.paths.review), 'round-0-shard-02.source-facts-review.v2.json')
    const manifest = json(fixture.paths.evidenceManifest)
    manifest.coverage_plan_hash = plan.content_hash
    manifest.extraction_slices[0].obligation_ids = plan.extraction_obligations.map((entry) => entry.obligation_id)
    manifest.source_facts_review_paths = [rel(fixture.root, fixture.paths.review), rel(fixture.root, secondReviewPath), rel(fixture.root, fixture.paths.reviewRound1)]
    manifest.source_facts_review_slices = [
      { sampling_round: 0, shard_id: 'round-0-shard-01', path: rel(fixture.root, fixture.paths.review) },
      { sampling_round: 0, shard_id: 'round-0-shard-02', path: rel(fixture.root, secondReviewPath) },
      { sampling_round: 1, shard_id: 'round-1-shard-01', path: rel(fixture.root, fixture.paths.reviewRound1) },
    ]
    manifest.content_hash = artifactHashV2(manifest)
    put(fixture.paths.evidenceManifest, manifest)
    const shard = json(fixture.paths.shard)
    shard.coverage_plan_hash = plan.content_hash
    shard.records = plan.extraction_obligations.map((obligation, index) => ({
      schema: 'source_evidence_record.v2', record_id: `record-risk-${index}`, obligation_id: obligation.obligation_id, source_id: 'source-a', cluster_id: 'core', claim_type: obligation.expected_claim_type,
      subject_key: 'teststoff', predicate_key: `risk-${index}`, context: { design: 'example' }, conflict_set_id: null, claim: `${index + 1} mg.`, population_context: 'adults', value: index + 1, unit: 'mg', effect_direction: null, uncertainty: 'Example.', locator: `p. ${index + 1}`, extractor_risk_tags: [],
    }))
    shard.obligation_results = shard.records.map((record) => ({ obligation_id: record.obligation_id, status: 'extracted', record_ids: [record.record_id] }))
    shard.content_hash = artifactHashV2(shard)
    put(fixture.paths.shard, shard)

    const status = runNutrientContent({ manifestPath: fixture.paths.run })
    assert.equal(status.state, 'WAITING_FOR_SOURCE_REVIEW')
    assert.equal(status.work_orders.work_orders.length, 2)
    assert.deepEqual(status.work_orders.work_orders.map((order) => order.reasoning_tier).sort(), ['high', 'standard'])
    for (const order of status.work_orders.work_orders) {
      const risks = new Set(order.task.selected.map((entry) => entry.obligation_result.effective_risk))
      assert.equal(risks.size, 1)
      assert.equal([...risks][0], order.reasoning_tier === 'high' ? 'high' : 'low')
    }
  } finally { fixture.cleanup() }
})

test('one sampled source-review failure expands exactly once; a second failure blocks', () => {
  const fixture = createFixture({ stages: ['stage3'] })
  try {
    const input = loadEvidenceManifestV2(fixture.paths.evidenceManifest)
    let result = buildEvidencePipelineV2({ input, outputDir: fixture.paths.evidence })
    assert.equal(result.status, 'missing_reviews')
    createSourceReview(fixture, { result: 'FAIL' })
    result = buildEvidencePipelineV2({ input: loadEvidenceManifestV2(fixture.paths.evidenceManifest), outputDir: fixture.paths.evidence })
    assert.equal(result.status, 'review_expanded')
    assert.equal(result.sample.sampling_round, 1)
    createSourceReview(fixture, { result: 'FAIL' })
    result = buildEvidencePipelineV2({ input: loadEvidenceManifestV2(fixture.paths.evidenceManifest), outputDir: fixture.paths.evidence })
    assert.equal(result.status, 'blocked')
  } finally { fixture.cleanup() }
})

test('runner opens one scoped extraction repair, ignores stale reviews and escalates only after the repaired shard fails again', () => {
  const fixture = createFixture({ stages: ['stage3'] })
  try {
    let status = runNutrientContent({ manifestPath: fixture.paths.run })
    assert.equal(status.state, 'WAITING_FOR_SOURCE_REVIEW')
    createSourceReview(fixture, { result: 'FAIL' })
    status = runNutrientContent({ manifestPath: fixture.paths.run })
    assert.equal(status.state, 'WAITING_FOR_SOURCE_REVIEW')
    assert.equal(status.work_orders.work_orders[0].task.sampling_round, 1)
    createSourceReview(fixture, { result: 'FAIL' })
    status = runNutrientContent({ manifestPath: fixture.paths.run })
    assert.equal(status.state, 'WAITING_FOR_SOURCE_EXTRACTION')
    const repairOrder = status.work_orders.work_orders[0]
    assert.equal(repairOrder.kind, 'source_extraction_repair')
    assert.equal(repairOrder.reasoning_tier, 'high')
    assert.equal(repairOrder.task.repair_generation, 1)
    assert.deepEqual(repairOrder.task.failed_obligation_ids, ['obligation-a'])

    const predecessor = json(fixture.paths.shard)
    const repairedBase = Object.fromEntries(Object.entries(predecessor).filter(([key]) => key !== 'content_hash'))
    repairedBase.extracted_at = '2026-07-14T12:00:00.000Z'
    repairedBase.repair_lineage = { work_order_id: repairOrder.work_order_id, predecessor_shard_hash: repairOrder.task.predecessor_shard_hash, failure_fingerprint: repairOrder.task.failure_fingerprint, repair_generation: 1 }
    put(fixture.paths.shard, hashed(repairedBase))

    status = runNutrientContent({ manifestPath: fixture.paths.run })
    assert.equal(status.state, 'WAITING_FOR_SOURCE_REVIEW')
    assert.equal(status.work_orders.work_orders[0].task.sampling_round, 0)
    assert.notEqual(status.work_orders.work_orders[0].inputs.find((entry) => entry.name === 'source_review_input').content_hash, repairOrder.inputs.find((entry) => entry.name === 'source_review_input').content_hash)
    createSourceReview(fixture, { result: 'FAIL' })
    status = runNutrientContent({ manifestPath: fixture.paths.run })
    assert.equal(status.state, 'WAITING_FOR_SOURCE_REVIEW')
    assert.equal(status.work_orders.work_orders[0].task.sampling_round, 1)
    createSourceReview(fixture, { result: 'FAIL' })
    status = runNutrientContent({ manifestPath: fixture.paths.run })
    assert.equal(status.state, 'BLOCKED')
    assert.equal(status.work_orders.work_orders[0].kind, 'evidence_repair_escalation')
    assert.ok(status.work_orders.work_orders.every((order) => order.kind !== 'source_extraction_repair'))
  } finally { fixture.cleanup() }
})

test('a failed full review blocks immediately instead of opening a redundant sampling round', () => {
  const fixture = createFixture({ stages: ['stage3'], stage4: true })
  try {
    let result = buildEvidencePipelineV2({ input: loadEvidenceManifestV2(fixture.paths.evidenceManifest), outputDir: fixture.paths.evidence })
    assert.equal(result.status, 'missing_reviews')
    assert.equal(result.sample.selected[0].mode, 'full')
    createSourceReview(fixture, { result: 'FAIL' })
    result = buildEvidencePipelineV2({ input: loadEvidenceManifestV2(fixture.paths.evidenceManifest), outputDir: fixture.paths.evidence })
    assert.equal(result.status, 'blocked')
    assert.equal(result.sample.sampling_round, 0)
  } finally { fixture.cleanup() }
})

test('low-risk review sampling is deterministic and capped at 8 of 40 and 10 of 80', () => {
  for (const [count, expected] of [[40, 8], [80, 10]]) {
    const fixture = createFixture({ stages: ['stage3'] })
    try {
      const first = buildLowRiskReviewSample(fixture, count)
      const second = buildLowRiskReviewSample(fixture, count)
      assert.equal(first.selected.length, expected)
      assert.equal(first.selected.filter((entry) => entry.mode === 'sample').length, expected)
      assert.ok(first.selected.every((entry) => entry.mode === 'sample'))
      assert.deepEqual(first, second)
      assert.equal(new Set(first.selected.map((entry) => entry.obligation_id)).size, expected)
    } finally { fixture.cleanup() }
  }
})

test('facts packages are derived from hash-bound original-source bytes and never from article prose', () => {
  const fixture = createFixture({ stages: ['stage3'] })
  try {
    let result = buildEvidencePipelineV2({ input: loadEvidenceManifestV2(fixture.paths.evidenceManifest), outputDir: fixture.paths.evidence })
    assert.equal(result.status, 'missing_reviews')
    createSourceReview(fixture)
    result = buildEvidencePipelineV2({ input: loadEvidenceManifestV2(fixture.paths.evidenceManifest), outputDir: fixture.paths.evidence })
    assert.equal(result.status, 'pass')
    const packagePath = join(fixture.paths.evidence, 'stage3-packages', 'main-a.json')
    const before = json(packagePath)
    assert.equal(before.facts[0].claim, 'The study used 5 mg.')
    assert.equal(before.visible_sources[0].source_content_hash, sha256Bytes(readFileSync(fixture.paths.source)))

    put(fixture.paths['main-a'], '# Manipulierter Entwurf\n\nDer Entwurf behauptet frei erfunden 999 mg.\n')
    result = buildEvidencePipelineV2({ input: loadEvidenceManifestV2(fixture.paths.evidenceManifest), outputDir: fixture.paths.evidence })
    assert.equal(result.status, 'pass')
    const afterArticleMutation = json(packagePath)
    assert.equal(afterArticleMutation.package_content_hash, before.package_content_hash)
    assert.equal(afterArticleMutation.facts[0].claim, 'The study used 5 mg.')

    put(fixture.paths.source, 'The source was changed after its hash-bound freeze and now says 999 mg.\n')
    assert.throws(() => buildEvidencePipelineV2({ input: loadEvidenceManifestV2(fixture.paths.evidenceManifest), outputDir: fixture.paths.evidence }), /artifact bytes\/hash mismatch/i)
  } finally { fixture.cleanup() }
})

test('evidence lock retains distinct approved framework variants that share one file', () => {
  const fixture = createFixture({ stages: ['stage2', 'stage3'] })
  try {
    const coverage = json(fixture.paths.coverage)
    const secondArticle = coverage.articles.find((article) => article.article_id === 'main-a')
    secondArticle.stage = 'stage2'
    delete secondArticle.common_assumption_review
    secondArticle.framework = { framework_id: 'stage2.authority_guideline_safety', version: '2.0.1' }
    secondArticle.source_ids = ['source-b']
    secondArticle.source_assignment = { mode: 'single_source', anchor_source_id: 'source-b', relations: [] }
    secondArticle.source_presentation_label_de = 'Zweite Originalquelle'
    secondArticle.seo_brief.internal_link_targets = []
    secondArticle.selected_link_slice = { links: [], slice_hash: canonicalJsonHash({ links: [] }) }
    coverage.sources.push({ ...coverage.sources[0], source_id: 'source-b', title: 'Zweite Originalquelle', label: 'Testautor et al. (2024). Zweite Originalquelle. Testjournal.', url: 'https://example.org/study-b', canonical_url: 'https://example.org/study-b' })
    coverage.clusters[0].source_ids.push('source-b')
    coverage.extraction_obligations[0].required_for = ['study-a']
    coverage.extraction_obligations.push({ obligation_id: 'obligation-b', source_id: 'source-b', cluster_id: 'core', expected_claim_type: 'study_quantity_b', required: true, required_for: ['main-a'], plan_risk_tags: [] })
    coverage.content_hash = artifactHashV2(coverage)
    put(fixture.paths.coverage, coverage)

    const sourceBPath = join(fixture.root, 'inputs', 'source-artifacts', 'source-b.txt')
    put(sourceBPath, 'The second source reports a study quantity of 5 mg.\n')
    const sourceBHash = sha256Bytes(readFileSync(sourceBPath))
    coverage.sources.find((source) => source.source_id === 'source-b').source_content_hash = sourceBHash
    coverage.content_hash = artifactHashV2(coverage)
    put(fixture.paths.coverage, coverage)
    const artifactReceipt = json(fixture.paths.sourceArtifactReceipt)
    artifactReceipt.sources.push({ source_id: 'source-b', path: rel(fixture.root, sourceBPath), byte_hash: sourceBHash, content_type: 'text/plain', locator: 'https://example.org/study-b' })
    artifactReceipt.sources.sort((a, b) => a.source_id.localeCompare(b.source_id))
    artifactReceipt.content_hash = artifactHashV2(artifactReceipt)
    put(fixture.paths.sourceArtifactReceipt, artifactReceipt)

    const manifest = json(fixture.paths.evidenceManifest)
    manifest.coverage_plan_hash = coverage.content_hash
    manifest.source_artifact_receipt_hash = artifactReceipt.content_hash
    manifest.source_artifacts['source-b'] = rel(fixture.root, sourceBPath)
    manifest.extraction_slices[0].source_ids.push('source-b')
    manifest.extraction_slices[0].obligation_ids.push('obligation-b')
    manifest.content_hash = artifactHashV2(manifest)
    put(fixture.paths.evidenceManifest, manifest)

    const shard = json(fixture.paths.shard)
    shard.coverage_plan_hash = coverage.content_hash
    shard.source_ids.push('source-b')
    shard.records.push({ ...shard.records[0], record_id: 'record-b', obligation_id: 'obligation-b', source_id: 'source-b', claim_type: 'study_quantity_b', predicate_key: 'study-quantity-b' })
    shard.obligation_results[0].required_for = ['study-a']
    shard.obligation_results.push({ obligation_id: 'obligation-b', status: 'extracted', record_ids: ['record-b'] })
    shard.content_hash = artifactHashV2(shard)
    put(fixture.paths.shard, shard)

    let result = buildEvidencePipelineV2({ input: loadEvidenceManifestV2(fixture.paths.evidenceManifest), outputDir: fixture.paths.evidence })
    assert.equal(result.status, 'missing_reviews')
    createSourceReview(fixture)
    result = buildEvidencePipelineV2({ input: loadEvidenceManifestV2(fixture.paths.evidenceManifest), outputDir: fixture.paths.evidence })
    assert.equal(result.status, 'pass')

    const sharedPathBindings = result.lock.framework_files.filter((entry) => entry.path === 'codex-files/frameworks/01_framework_single_study.md')
    assert.equal(sharedPathBindings.length, 2)
    assert.equal(new Set(sharedPathBindings.map((entry) => entry.framework_hash)).size, 2)
    const validated = validateEvidencePipelineLockV2({
      lockPath: result.lockPath,
      root: fixture.root,
      expected: {
        evidenceManifestPath: fixture.paths.evidenceManifest,
        coveragePlanPath: fixture.paths.coverage,
        researchPath: fixture.paths.research,
        substance: 'teststoff',
        language: 'de',
      },
    })
    assert.equal(validated.lock.lock_hash, result.lock.lock_hash)

    const staleLock = structuredClone(result.lock)
    staleLock.framework_files = staleLock.framework_files.filter((entry) => entry.framework_hash !== result.packages.stage2['study-a'].framework_hash)
    staleLock.lock_hash = artifactHashV2(staleLock)
    put(result.lockPath, staleLock)
    assert.throws(() => validateEvidencePipelineLockV2({
      lockPath: result.lockPath,
      root: fixture.root,
      expected: {
        evidenceManifestPath: fixture.paths.evidenceManifest,
        coveragePlanPath: fixture.paths.coverage,
        researchPath: fixture.paths.research,
        substance: 'teststoff',
        language: 'de',
      },
    }), /framework is not bound by the evidence lock/i)
  } finally { fixture.cleanup() }
})

test('Evidence records never embed a projection and stage4_relevance is candidate-only and explicitly gated', () => {
  const disabled = createFixture({ stages: ['stage3'], stage4: false })
  try {
    const shard = json(disabled.paths.shard)
    shard.records[0].stage4_relevance = { status: 'candidate', reason: 'Potentially relevant.', locator: 'p. 1' }
    shard.content_hash = artifactHashV2(shard)
    put(disabled.paths.shard, shard)
    assert.throws(() => mergeEvidenceV2(loadEvidenceManifestV2(disabled.paths.evidenceManifest)), /must omit stage4_relevance/i)
  } finally { disabled.cleanup() }

  const enabled = createFixture({ stages: ['stage3'], stage4: true })
  try {
    assert.equal(mergeEvidenceV2(loadEvidenceManifestV2(enabled.paths.evidenceManifest)).bundle.records[0].stage4_relevance.status, 'candidate')
    const shard = json(enabled.paths.shard)
    shard.records[0].stack_projection = { schema: 'stack_projection.v2', status: 'ready' }
    shard.content_hash = artifactHashV2(shard)
    put(enabled.paths.shard, shard)
    assert.throws(() => mergeEvidenceV2(loadEvidenceManifestV2(enabled.paths.evidenceManifest)), /must never embed stack_projection/i)
  } finally { enabled.cleanup() }
})

test('Stage 4 receives one lock-bound candidate package while article packages omit operational Stage-4 data', () => {
  const fixture = createFixture({ stages: ['stage3'], stage4: true })
  try {
    progressToWriters(fixture)
    const pipeline = validateEvidencePipelineLockV2({
      lockPath: join(fixture.paths.evidence, 'evidence-pipeline-lock.v2.json'),
      root: fixture.root,
      expected: { evidenceManifestPath: fixture.paths.evidenceManifest, coveragePlanPath: fixture.paths.coverage, researchPath: fixture.paths.research, substance: 'teststoff', language: 'de' },
    })
    assert.equal(pipeline.packages.stage4.schema, 'facts_package_for_stage4.v2')
    assert.deepEqual(pipeline.packages.stage4.record_ids, ['record-a'])
    assert.equal(pipeline.packages.stage4.facts[0].stage4_relevance.status, 'candidate')
    assert.equal(pipeline.packages.stage3['main-a'].facts[0].stage4_relevance, undefined)
    assert.equal(pipeline.packages.stage3['main-a'].facts[0].stack_projection, undefined)

    const packageValue = pipeline.packages.stage4
    const projectionBase = {
      schema: 'stack_projection.v2', projection_id: 'projection-a', status: 'ready', run_id: 'run-a',
      coverage_plan_hash: pipeline.coveragePlan.content_hash, evidence_bundle_hash: pipeline.evidenceBundle.content_hash,
      facts_gate_hash: pipeline.factsGate.content_hash, evidence_lock_hash: pipeline.lock.lock_hash,
      facts_package_id: packageValue.package_id, facts_package_hash: packageValue.package_content_hash, facts_hash: packageValue.facts_hash, record_ids: ['record-a'],
      creator: { role: 'stage4-stack-sync', id: 'stack-sync-a' }, execution_id: 'stack-execution-a', created_at: '2026-07-14T14:00:00.000Z',
      records: [{
        projection_record_id: 'projection-record-a', evidence_record_ids: ['record-a'], ingredient_id: 9, population_key: 'adult',
        source_type: 'clinical-study', source_label: TEST_SOURCE_LABEL, source_url: 'https://example.org/study',
        amount_type: 'tested_amount', reported_amount_text: 'The study used 5 mg.', dose_min: 5, dose_max: 5, unit: 'mg', purpose: 'study_quantity',
        stack_role: 'not_in_stack', visible: false, controversial: false, lifecycle_status: 'draft', relevance_reason: 'This source-bound quantity may be relevant to an explicit later stack decision.',
      }],
    }
    const projection = hashed(projectionBase)
    assert.equal(validateStackProjectionV2({ projectionValue: projection, pipeline }).projection_id, 'projection-a')

    const rangedPipeline = structuredClone(pipeline)
    const rangedFact = rangedPipeline.packages.stage4.facts[0]
    rangedFact.value = null
    rangedFact.unit = null
    rangedFact.context = { ...rangedFact.context, amount_min: 5, amount_max: 6, amount_unit: 'seeds' }
    rangedFact.claim = 'The study used 5 to 6 seeds.'
    const rangedProjection = hashed({
      ...projectionBase,
      records: [{
        ...projectionBase.records[0],
        reported_amount_text: rangedFact.claim,
        dose_min: 5,
        dose_max: 6,
        unit: 'seeds',
      }],
    })
    assert.equal(validateStackProjectionV2({ projectionValue: rangedProjection, pipeline: rangedPipeline }).records[0].dose_max, 6)
    const stale = { ...projection, facts_gate_hash: sha256Bytes(Buffer.from('stale')) }
    stale.content_hash = artifactHashV2(stale)
    assert.throws(() => validateStackProjectionV2({ projectionValue: stale, pipeline }), /gate\/lock binding differs/i)
  } finally { fixture.cleanup() }
})

test('ordinary study quantities remain low-risk while UL and not_reported are always full-reviewed', () => {
  const fixture = createFixture({ stages: ['stage3'] })
  try {
    const plan = json(fixture.paths.coverage)
    const obligations = []
    const records = []
    const results = []
    for (let index = 0; index < 16; index += 1) {
      const suffix = String(index).padStart(2, '0')
      const claimType = index === 14 ? 'upper-limit' : index === 15 ? 'numeric-result-not-reported' : `numeric-result-${suffix}`
      const id = `obligation-${suffix}`
      obligations.push({ obligation_id: id, source_id: 'source-a', cluster_id: 'core', expected_claim_type: claimType, required: true, required_for: ['main-a'], plan_risk_tags: [] })
      if (index === 15) results.push({ obligation_id: id, status: 'not_reported', reason: 'The source does not report this endpoint.', record_ids: [] })
      else {
        const recordId = `record-${suffix}`
        records.push({ schema: 'source_evidence_record.v2', record_id: recordId, obligation_id: id, source_id: 'source-a', cluster_id: 'core', claim_type: claimType, subject_key: 'teststoff', predicate_key: `predicate-${suffix}`, context: { design: 'example' }, conflict_set_id: null, claim: `Result ${index} was ${index + 1} mg.`, population_context: 'adults', value: index + 1, unit: 'mg', effect_direction: null, uncertainty: 'Example.', locator: `p. ${index + 1}`, extractor_risk_tags: [] })
        results.push({ obligation_id: id, status: 'extracted', record_ids: [recordId] })
      }
    }
    plan.extraction_obligations = obligations
    plan.articles[0].common_assumption_review.checks[0].obligation_ids = obligations.map((entry) => entry.obligation_id)
    plan.content_hash = artifactHashV2(plan)
    put(fixture.paths.coverage, plan)
    const evidenceManifest = json(fixture.paths.evidenceManifest)
    evidenceManifest.coverage_plan_hash = plan.content_hash
    evidenceManifest.extraction_slices[0].obligation_ids = obligations.map((entry) => entry.obligation_id)
    evidenceManifest.content_hash = artifactHashV2(evidenceManifest)
    put(fixture.paths.evidenceManifest, evidenceManifest)
    const shard = json(fixture.paths.shard)
    shard.coverage_plan_hash = plan.content_hash
    shard.records = records
    shard.obligation_results = results
    shard.content_hash = artifactHashV2(shard)
    put(fixture.paths.shard, shard)
    const input = loadEvidenceManifestV2(fixture.paths.evidenceManifest)
    const merged = mergeEvidenceV2(input)
    const standard = merged.bundle.obligation_results.filter((entry) => entry.expected_claim_type.startsWith('numeric-result-') && entry.expected_claim_type !== 'numeric-result-not-reported')
    assert.equal(standard.filter((entry) => entry.full_review_required).length, 0)
    assert.ok(standard.every((entry) => entry.effective_risk === 'low'))
    const ul = merged.bundle.obligation_results.find((entry) => entry.expected_claim_type === 'upper-limit')
    const notReported = merged.bundle.obligation_results.find((entry) => entry.status === 'not_reported')
    assert.equal(ul.full_review_required, true)
    assert.equal(notReported.full_review_required, true)
    const sample = buildReviewSampleV2({ coveragePlan: input.coveragePlan, bundle: merged.bundle, samplingSeed: 'seed-a' })
    assert.equal(sample.selected.filter((entry) => entry.mode === 'full').length, 2)
    assert.equal(sample.selected.filter((entry) => entry.mode === 'sample').length, 3)
    assert.deepEqual(sample, buildReviewSampleV2({ coveragePlan: input.coveragePlan, bundle: merged.bundle, samplingSeed: 'seed-a' }))
    const sampledId = sample.selected.find((entry) => entry.mode === 'sample').obligation_id
    const expanded = buildReviewSampleV2({ coveragePlan: input.coveragePlan, bundle: merged.bundle, samplingSeed: 'seed-a', reviews: [{ obligation_results: [{ obligation_id: sampledId, mode: 'sample', status: 'FAIL' }] }] })
    assert.equal(expanded.sampling_round, 1)
    assert.equal(expanded.selected.length, merged.bundle.obligation_results.length)
    assert.ok(expanded.selected.every((entry) => entry.mode === 'full'))
  } finally { fixture.cleanup() }
})

test('blocked/excluded coverage articles produce no active obligations or packages', () => {
  const fixture = createFixture({ stages: ['stage3'] })
  try {
    const raw = json(fixture.paths.coverage)
    raw.articles[0].status = 'excluded'
    raw.articles[0].required_cluster_ids = []
    raw.articles[0].source_ids = []
    raw.extraction_obligations = []
    raw.content_hash = artifactHashV2(raw)
    put(fixture.paths.coverage, raw)
    const shard = json(fixture.paths.shard)
    shard.coverage_plan_hash = raw.content_hash
    shard.records = []
    shard.obligation_results = []
    shard.content_hash = artifactHashV2(shard)
    put(fixture.paths.shard, shard)
    const evidenceManifest = json(fixture.paths.evidenceManifest)
    evidenceManifest.coverage_plan_hash = raw.content_hash
    evidenceManifest.source_evidence_shard_paths = []
    evidenceManifest.extraction_slices = []
    evidenceManifest.source_artifacts = {}
    evidenceManifest.content_hash = artifactHashV2(evidenceManifest)
    put(fixture.paths.evidenceManifest, evidenceManifest)
    const coverage = validateCoveragePlanV2(raw, { researchHash: raw.research_hash, substance: 'teststoff', language: 'de' })
    const input = loadEvidenceManifestV2(fixture.paths.evidenceManifest)
    input.coveragePlan = coverage
    input.manifest = { ...input.manifest }
    const merged = mergeEvidenceV2(input)
    assert.equal(merged.bundle.obligation_results.length, 0)
    assert.equal(merged.activeArticles.length, 0)
  } finally { fixture.cleanup() }
})

test('runtime scripts contain no substance-specific branch or fixed 7+1 article count', () => {
  for (const path of [resolve('scripts/run-nutrient-content.mjs'), resolve('scripts/lib/nutrient-content-runner.mjs'), resolve('scripts/lib/article-runtime-v2.mjs'), resolve('scripts/lib/evidence-pipeline-v2.mjs')]) {
    const source = readFileSync(path, 'utf8')
    assert.doesNotMatch(source, /quercetin/i)
    assert.doesNotMatch(source, /length\s*!==\s*[78]|exactly\s+(?:seven|eight)|7\s*\+\s*1/i)
  }
  assert.doesNotMatch(readFileSync(resolve('scripts/run-nutrient-content.mjs'), 'utf8'), /--resume/)
})

test('execution metrics use interval union for parallel work and never encode missing evidence as zero', () => {
  const order = (label, executionClass, kind = 'writer') => ({ run_id: 'timing-run', work_order_id: canonicalJsonHash({ label }), kind, execution_class: executionClass, reasoning_tier: executionClass === 'llm' ? 'high' : 'standard', assignee: { role: executionClass === 'llm' ? 'german-health-science-writer' : 'deterministic-link-inventory-exporter' }, execution_receipt: { root: 'run', path: `metrics/${label}.work-order-execution-receipt.v1.json`, schema: 'work_order_execution_receipt.v1' } })
  const orders = [order('llm-a', 'llm'), order('llm-b', 'llm'), order('machine', 'deterministic', 'link_inventory_source_readback'), order('publish', 'deterministic', 'publication_apply')]
  const receipt = (target, startedAt, finishedAt) => hashed({ schema: 'work_order_execution_receipt.v1', run_id: target.run_id, work_order_id: target.work_order_id, execution_class: target.execution_class, reasoning_tier: target.reasoning_tier, executor: { role: target.assignee.role, id: `executor-${target.kind}` }, started_at: startedAt, finished_at: finishedAt, result: 'PASS', result_hash: canonicalJsonHash({ result: target.work_order_id }) })
  const measured = summarizeWorkOrderTimingsV1({ workOrders: orders, receipts: [
    receipt(orders[0], '2026-07-14T10:00:00.000Z', '2026-07-14T10:00:10.000Z'),
    receipt(orders[1], '2026-07-14T10:00:05.000Z', '2026-07-14T10:00:15.000Z'),
    receipt(orders[2], '2026-07-14T10:00:20.000Z', '2026-07-14T10:00:22.000Z'),
    receipt(orders[3], '2026-07-14T10:00:23.000Z', '2026-07-14T10:00:28.000Z'),
  ] })
  assert.equal(measured.status, 'MEASURED')
  assert.equal(measured.llm_wallclock_ms, 15_000)
  assert.equal(measured.deterministic_elapsed_ms, 2_000)
  assert.equal(measured.publish_readback_ms, 5_000)
  const missing = summarizeWorkOrderTimingsV1({ workOrders: orders, receipts: [receipt(orders[0], '2026-07-14T10:00:00.000Z', '2026-07-14T10:00:10.000Z')] })
  assert.equal(missing.status, 'NOT_MEASURABLE')
  assert.equal(missing.llm_wallclock_ms, 'NOT_MEASURABLE')
  assert.equal(missing.deterministic_elapsed_ms, 'NOT_MEASURABLE')
  assert.equal(missing.publish_readback_ms, 'NOT_MEASURABLE')
})

test('source persistence equates percent-encoded DOI URL characters with the explicit DOI', () => {
  const ingredientTarget = { ingredient_id: 7, identity_hash: canonicalJsonHash({ ingredient: 7 }) }
  const source = {
    source_id: 'encoded-doi-source', source_type: 'meta_constituent_study', source_kind: 'study',
    author_or_institution: 'Malvy et al.', publication_year: 2000,
    title: 'Relationship Between Vitamin D Status and Skin Phototype', journal_or_publisher: 'Photochemistry and Photobiology',
    doi: '10.1562/0031-8655(2000)071<0466:rbvdsa>2.0.co;2', pmid: null,
    label: 'Malvy et al. (2000). Relationship Between Vitamin D Status and Skin Phototype. Photochemistry and Photobiology. DOI: 10.1562/0031-8655(2000)071<0466:rbvdsa>2.0.co;2.',
    canonical_url: 'https://doi.org/10.1562/0031-8655(2000)071%3C0466:rbvdsa%3E2.0.co;2',
    source_content_hash: canonicalJsonHash({ source: 'encoded-doi-source' }),
  }
  const request = buildSourceCatalogSyncRequestV1({ runId: 'encoded-doi-run', ingredientTarget, sources: [source] })
  assert.equal(request.sources[0].doi, source.doi.toLowerCase())
  assert.equal(request.sources[0].canonical_url, source.canonical_url)
})

test('source persistence does not mislabel an archive locator DOI as the original study DOI', () => {
  const ingredientTarget = { ingredient_id: 7, identity_hash: canonicalJsonHash({ ingredient: 7 }) }
  const source = {
    source_id: 'archived-constituent', source_type: 'meta_constituent_study', source_kind: 'study',
    author_or_institution: 'Asfora J', publication_year: 1977,
    title: 'Vitamin C in high doses in the treatment of the common cold', journal_or_publisher: 'International Journal for Vitamin and Nutrition Research',
    doi: null, pmid: null,
    label: 'Asfora J (1977). Vitamin C in high doses in the treatment of the common cold. International Journal for Vitamin and Nutrition Research.',
    canonical_url: 'https://doi.org/10.5281/zenodo.7661409',
    source_content_hash: canonicalJsonHash({ source: 'archived-constituent' }),
  }
  const request = buildSourceCatalogSyncRequestV1({ runId: 'archive-locator-run', ingredientTarget, sources: [source] })
  assert.equal(request.sources[0].doi, null)
  assert.equal(request.sources[0].canonical_url, source.canonical_url)
})

test('source persistence binds explicit official/study kind and rejects URL identifier conflicts', () => {
  const ingredientTarget = { ingredient_id: 7, identity_hash: canonicalJsonHash({ ingredient: 7 }) }
  const official = buildSourceCatalogSyncRequestV1({ runId: 'source-kind-run', ingredientTarget, sources: [{ source_id: 'dge-a', source_type: 'DGE-Referenzwert', source_kind: 'official', author_or_institution: 'Deutsche Gesellschaft für Ernährung', publication_year: null, title: 'Referenzwerte', journal_or_publisher: 'DGE', label: 'Deutsche Gesellschaft für Ernährung (o. J.). Referenzwerte. DGE.', url: 'https://www.dge.de/wissenschaft/referenzwerte/', source_content_hash: canonicalJsonHash({ source: 'dge' }) }] })
  assert.equal(official.sources[0].source_kind, 'official')
  assert.throws(() => buildSourceCatalogSyncRequestV1({ runId: 'source-kind-run', ingredientTarget, sources: [{ source_id: 'efsa-a', source_type: 'EFSA-BehÃ¶rdenbewertung', source_kind: 'official', label: 'EFSA', url: 'https://doi.org/10.1000/url-id', doi: '10.1000/other-id', source_content_hash: canonicalJsonHash({ source: 'efsa' }) }] }), /DOI conflicts/i)
})
