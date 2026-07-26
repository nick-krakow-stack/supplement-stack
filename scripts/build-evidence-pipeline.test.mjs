import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import test from 'node:test'
import { buildEvidencePipeline, writeEvidencePipeline } from './build-evidence-pipeline.mjs'
import { __stage4PreflightTestOnly, buildStage4ResolverSnapshot, resolveLocalWranglerEntrypoint } from './stage4-d1-resolver-preflight.mjs'
import {
  artifactHash, buildFactsGate, buildFactsPackages, lintVisiblePayload, mergeSourceEvidenceShards,
  resolveFrameworkCatalog, validatePublicationBatch, validateSourceEvidenceShard, visiblePayloadHash,
  validatePopulationResolver,
  validateEvidencePipelineLock,
  derivePublicationFidelitySignals,
} from './lib/evidence-pipeline-builder.mjs'
import { coveragePlanContentHash, evidenceBundleContentHash, evidenceRecordPayloadHash, sha256Bytes } from './lib/content-validation.mjs'

const ROOT = resolve(import.meta.dirname, '..')

function setup() {
  const dir = mkdtempSync(join(tmpdir(), 'evidence-builder-'))
  const sourceBytes = { 'src-a': 'original authority bytes', 'src-b': 'original supporting bytes' }
  for (const [id, bytes] of Object.entries(sourceBytes)) writeFileSync(join(dir, `${id}.txt`), bytes)
  const fit = { decision: 'existing', framework_id: 'stage2.meta_study', version: '2.0.0', variant_id: 'systematic_review_or_meta_analysis', reason: 'fit', owner_approval: { required: false, status: 'not_required' }, pilot: { required: false, status: 'not_required' } }
  const plan = {
    schema: 'coverage_plan.v1', coverage_plan_id: 'plan-1', content_hash: '', substance: 'Teststoff', stage4_requested: false,
    stage3_archetype_decision: { archetype: 'essential_nutrient', reason: 'fit', status: 'approved', framework_id: 'stage3.essential_nutrient', version: '2.0.3', variant: 'essential_nutrient', decision: 'existing' },
    clusters: [{ cluster_key: 'safety', required: true, status: 'covered', primary_source_ids: ['src-a'], supporting_source_ids: ['src-b'], article_candidate_ids: ['article-a'] }],
    sources: [
      { source_id: 'src-a', stage15_label: 'ANCHOR', source_url: 'https://example.test/a', title: 'Authority A', covered_by_source_ids: [], assigned_article_ids: ['article-a'] },
      { source_id: 'src-b', stage15_label: 'SUPPORTING', source_url: 'https://example.test/b', title: 'Support B', covered_by_source_ids: [], assigned_article_ids: ['article-a'] },
    ],
    article_candidates: [{ article_id: 'article-a', primary_source_id: 'src-a', integrated_source_ids: ['src-b'], cluster_keys: ['safety'], own_article_reason: 'minimal_cluster_representative', risk_class: ['safety'], source_archetype: 'meta_review', framework_fit: fit, publication_gate: { status: 'pending', result: null, review_id: null }, status: 'planned', facts_status: 'pending', publication_status: 'drafted' }],
    facts_gate: { status: 'pending', required_record_ids: [], validated_record_ids: [], missing_cluster_keys: [], blocking_gaps: [] },
  }
  plan.content_hash = coveragePlanContentHash(plan)
  const makeShard = (id, sourceId, recordId, createdAt, extractorId) => {
    const source = { source_id: sourceId, created_by: { role: 'source-evidence-extractor', id: extractorId, created_at: createdAt }, source_locator: { source_url: `https://example.test/${sourceId.at(-1)}`, access_basis: 'verified_full_text', retrieved_at: '2026-07-13' }, source_artifact_path: `${sourceId}.txt`, source_content_hash: sha256Bytes(sourceBytes[sourceId]), methods: { design: 'systematic_review', population: 'Erwachsene' } }
    const record = { schema: 'source_evidence_record.v1', record_id: recordId, source_id: sourceId, cluster_keys: ['safety'], provenance: { location: 'p. 1', language: 'en' }, claim: `Claim ${recordId}`, result: `Result ${recordId}`, quantity: { value: null, unit: null, schedule: null, duration: null, is_recommendation: false }, safety: 'Safety fact', uncertainty: 'Uncertainty', stack_relevance: { candidate: false, use: 'none', direct_user_dose_recommendation: false } }
    const shard = { schema: 'source_evidence_shard.v1', shard_id: id, coverage_plan_id: plan.coverage_plan_id, coverage_plan_content_hash: plan.content_hash, extractor: { role: 'source-evidence-extractor', id: extractorId }, created_at: createdAt, sources: [source], records: [record], content_hash: '' }
    shard.content_hash = artifactHash(shard)
    return shard
  }
  const shards = [makeShard('shard-a', 'src-a', 'fact-a', '2026-07-13T10:00:00.000Z', 'extractor-a'), makeShard('shard-b', 'src-b', 'fact-b', '2026-07-13T10:01:00.000Z', 'extractor-b')]
  const sourceArtifacts = Object.fromEntries(Object.entries(sourceBytes).map(([id, bytes]) => [id, Buffer.from(bytes)]))
  const merged = mergeSourceEvidenceShards({ coveragePlan: plan, shards, sourceArtifacts, merger: { role: 'evidence-bundle-merger', id: 'merger-a', merged_at: '2026-07-13T11:00:00.000Z' }, bundleId: 'bundle-a' })
  const reviews = merged.bundle.records.map((record, index) => {
    const source = merged.bundle.sources.find((item) => item.source_id === record.source_id)
    return { schema: 'source_facts_review.v1', review_id: `review-${index}`, bundle_id: merged.bundle.bundle_id, bundle_content_hash: merged.bundle.content_hash, status: 'pass', reviewer: { role: 'source-facts-reviewer', id: `reviewer-${index}` }, reviewed_at: `2026-07-13T12:0${index}:00.000Z`, record_results: [{ record_id: record.record_id, status: 'pass', mode: 'full', source_content_hash: source.source_content_hash, fact_payload_hash: evidenceRecordPayloadHash(record), scope: ['source_fidelity', 'coverage_crossrefs', 'safety'], risk_class: ['safety'], findings: [] }] }
  })
  const catalog = JSON.parse(readFileSync(resolve(ROOT, 'codex-files/frameworks/framework-catalog.v1.json'), 'utf8'))
  return { dir, plan, shards, sourceArtifacts, merged, reviews, catalog }
}
function gate(data) { return buildFactsGate({ coveragePlan: data.plan, evidenceBundle: data.merged.bundle, sourceFactsReviews: data.reviews, sourceArtifacts: data.sourceArtifacts, validator: { role: 'evidence-bundle-gate-validator', id: 'validator-a', gate_id: 'gate-a', validated_at: '2026-07-13T13:00:00.000Z' }, samplingSeed: 'seed-a', extractorIds: data.merged.extractorIds }) }
function throws(message, callback) { assert.throws(callback, new RegExp(message, 'i')) }

test('deterministically merges, gates and packages exact facts', () => {
  const data = setup(); try {
    const bindings = resolveFrameworkCatalog({ catalog: data.catalog, repoRoot: ROOT, coveragePlan: data.plan })
    const built = gate(data)
    const packages = buildFactsPackages({ coveragePlan: built.coveragePlan, evidenceBundle: data.merged.bundle, gate: built.gate, frameworkBindings: bindings })
    assert.deepEqual(data.merged.bundle.source_evidence_shard_ids, ['shard-a', 'shard-b'])
    assert.deepEqual(packages.stage2['article-a'].record_ids, ['fact-a', 'fact-b'])
    assert.deepEqual(packages.stage3.record_ids, ['fact-a', 'fact-b'])
    assert.equal(packages.stage3.facts[0].stack_projection, undefined)
    assert.equal(buildFactsPackages({ coveragePlan: built.coveragePlan, evidenceBundle: data.merged.bundle, gate: built.gate, frameworkBindings: bindings }).stage3.package_content_hash, packages.stage3.package_content_hash)
  } finally { rmSync(data.dir, { recursive: true, force: true }) }
})

test('rejects overlapping source and record ownership', () => { const d = setup(); try { const duplicate = structuredClone(d.shards[0]); duplicate.shard_id = 'other'; duplicate.content_hash = artifactHash(duplicate); throws('overlapping source_id', () => mergeSourceEvidenceShards({ coveragePlan: d.plan, shards: [d.shards[0], duplicate], sourceArtifacts: d.sourceArtifacts, merger: { role: 'evidence-bundle-merger', id: 'merger-x', merged_at: '2026-07-13T11:00:00.000Z' }, bundleId: 'x' })) } finally { rmSync(d.dir, { recursive: true, force: true }) } })
test('rejects writer-owned extraction shards', () => { const d = setup(); try { d.shards[0].extractor.role = 'clinical-study-interpreter'; d.shards[0].content_hash = artifactHash(d.shards[0]); throws('source-evidence-extractor', () => validateSourceEvidenceShard({ shard: d.shards[0], coveragePlan: d.plan, sourceArtifacts: d.sourceArtifacts })) } finally { rmSync(d.dir, { recursive: true, force: true }) } })
test('rejects stale source artifact bytes and shard hash', () => { const d = setup(); try { d.sourceArtifacts['src-a'] = Buffer.from('tampered'); throws('artifact hash mismatch', () => validateSourceEvidenceShard({ shard: d.shards[0], coveragePlan: d.plan, sourceArtifacts: d.sourceArtifacts })) } finally { rmSync(d.dir, { recursive: true, force: true }) } })
test('rejects reviewer/merger/extractor identity collision', () => { const d = setup(); try { d.reviews[0].reviewer.id = 'extractor-a'; throws('not independent', () => gate(d)) } finally { rmSync(d.dir, { recursive: true, force: true }) } })
test('rejects missing facts for a required supporting source', () => { const d = setup(); try { d.merged.bundle.records = d.merged.bundle.records.filter((r) => r.source_id !== 'src-b'); d.merged.bundle.sources = d.merged.bundle.sources.filter((s) => s.source_id !== 'src-b'); d.merged.bundle.content_hash = evidenceBundleContentHash(d.merged.bundle); d.reviews = d.reviews.slice(0, 1); throws('source:src-b', () => gate(d)) } finally { rmSync(d.dir, { recursive: true, force: true }) } })
test('rejects stale and non-strict timestamps', () => { const d = setup(); try { d.reviews[0].reviewed_at = '2026-07-13'; throws('strict ISO', () => gate(d)); d.reviews[0].reviewed_at = '2026-07-13T14:00:00.000Z'; throws('predates', () => gate(d)) } finally { rmSync(d.dir, { recursive: true, force: true }) } })
test('resolves only exact approved catalog id/version/stage/path/variant', () => { const d = setup(); try { d.plan.article_candidates[0].framework_fit.version = '9.9.9'; throws('does not resolve', () => resolveFrameworkCatalog({ catalog: d.catalog, repoRoot: ROOT, coveragePlan: d.plan })); d.plan.article_candidates[0].framework_fit.version = '2.0.0'; d.plan.article_candidates[0].framework_fit.variant_id = 'wrong'; throws('variant differs', () => resolveFrameworkCatalog({ catalog: d.catalog, repoRoot: ROOT, coveragePlan: d.plan })) } finally { rmSync(d.dir, { recursive: true, force: true }) } })
test('new catalog entries require durable owner and pilot provenance', () => { const d = setup(); try { const entry = structuredClone(d.catalog.frameworks[0]); entry.framework_id = 'stage2.new'; entry.version = '1.0.0'; entry.variant = 'new'; entry.lifecycle = 'new'; d.catalog.frameworks.push(entry); d.plan.article_candidates[0].framework_fit = { ...d.plan.article_candidates[0].framework_fit, decision: 'new', framework_id: 'stage2.new', version: '1.0.0', variant_id: 'new', owner_approval: { status: 'approved' }, pilot: { status: 'passed' } }; throws('owner_approval_artifact', () => resolveFrameworkCatalog({ catalog: d.catalog, repoRoot: ROOT, coveragePlan: d.plan })) } finally { rmSync(d.dir, { recursive: true, force: true }) } })
test('stage4 false does not require a population resolver', () => { const d = setup(); try { assert.equal(gate(d).gate.status, 'pass') } finally { rmSync(d.dir, { recursive: true, force: true }) } })
test('stage4 true binds canonical query and immutable exact D1 result rows', () => { const d = setup(); try { d.plan.stage4_requested = true; throws('requires a versioned', () => validatePopulationResolver({ coveragePlan: d.plan, evidenceBundle: d.merged.bundle, resolver: null, mode: 'test' })); d.merged.bundle.records[0].stack_relevance.candidate = true; d.merged.bundle.records[0].stack_projection = { ingredient_id: 9, population_key: 'adult', population_id: 7, population_slug: 'adult' }; const queryPath = resolve(ROOT, 'scripts/sql/stage4-resolver-preflight.sql'), resultPath = join(d.dir, 'd1-result.json'), rows = [{ row_kind: 'ingredient', entity_id: 9, entity_slug: 'teststoff' }, { row_kind: 'population', entity_id: 7, entity_slug: 'adult' }]; writeFileSync(resultPath, JSON.stringify([{ results: rows }])); const resolver = { schema: 'population_resolver_snapshot.v1', version: '1.0.0', mode: 'test', created_at: '2026-07-13T09:00:00.000Z', provenance: { kind: 'd1_preflight', database_id: 'test-db', database_name: 'test-db', environment: 'test', account_id: 'test-account', binding: 'DB', executed_at: '2026-07-13T08:59:00.000Z', query_path: queryPath, result_artifact_path: resultPath, query_hash: sha256Bytes(readFileSync(queryPath)), result_hash: sha256Bytes(readFileSync(resultPath)) }, result_rows: rows, mappings: [{ population_key: 'adult', population_id: 7, population_slug: 'adult' }], ingredients: [{ ingredient_id: 9, ingredient_slug: 'teststoff' }], content_hash: '' }; resolver.content_hash = artifactHash(resolver); assert.equal(validatePopulationResolver({ coveragePlan: d.plan, evidenceBundle: d.merged.bundle, resolver, mode: 'test' }).version, '1.0.0'); writeFileSync(resultPath, JSON.stringify([{ results: [...rows, { row_kind: 'ingredient', entity_id: 99, entity_slug: 'invented' }] }])); throws('bytes/hash mismatch', () => validatePopulationResolver({ coveragePlan: d.plan, evidenceBundle: d.merged.bundle, resolver, mode: 'test' })) } finally { rmSync(d.dir, { recursive: true, force: true }) } })
test('read-only Stage-4 preflight helper canonicalizes immutable D1 rows', () => { const dir = mkdtempSync(join(tmpdir(), 'stage4-preflight-')); try { const result = join(dir, 'result.json'), out = join(dir, 'snapshot.json'); writeFileSync(result, JSON.stringify([{ results: [{ row_kind: 'population', entity_id: 2, entity_slug: 'adult' }, { row_kind: 'ingredient', entity_id: 3, entity_slug: 'magnesium' }] }])); const snapshot = buildStage4ResolverSnapshot({ resultPath: result, outPath: out, databaseId: 'test', databaseName: 'test', environment: 'test', accountId: 'test', binding: 'DB', executedAt: '2026-07-13T08:00:00.000Z', mode: 'test' }); assert.deepEqual(snapshot.result_rows.map((row) => row.row_kind), ['ingredient', 'population']); assert.equal(snapshot.provenance.result_hash, sha256Bytes(readFileSync(result))) } finally { rmSync(dir, { recursive: true, force: true }) } })
test('file-based Stage-4 result input is never production-eligible', () => { assert.throws(() => buildStage4ResolverSnapshot({ mode: 'production' }), /test-only/) })
test('self-authored production file with real D1 ID fails without CLI attestation', () => { const d = setup(); try { d.plan.stage4_requested = true; d.merged.bundle.records[0].stack_relevance.candidate = true; d.merged.bundle.records[0].stack_projection = { ingredient_id: 9, population_key: 'adult', population_id: 7, population_slug: 'adult' }; const query = resolve(ROOT, 'scripts/sql/stage4-resolver-preflight.sql'), result = resolve(ROOT, 'scripts/test-fixtures/stage4-resolver/d1-result.json'), rows = JSON.parse(readFileSync(result, 'utf8'))[0].results; const resolver = { schema: 'population_resolver_snapshot.v1', version: '1.0.0', mode: 'production', created_at: '2026-07-13T09:00:00.000Z', provenance: { kind: 'd1_preflight', database_id: 'f1336769-9231-4cfa-a54b-91a261f07b08', database_name: 'supplementstack-production', environment: 'production', account_id: 'self-authored-account', binding: 'DB', executed_at: '2026-07-13T09:00:00.000Z', query_path: 'scripts/sql/stage4-resolver-preflight.sql', result_artifact_path: 'scripts/test-fixtures/stage4-resolver/d1-result.json', query_hash: sha256Bytes(readFileSync(query)), result_hash: sha256Bytes(readFileSync(result)) }, result_rows: rows, mappings: [{ population_key: 'adult', population_id: 7, population_slug: 'adult' }], ingredients: [{ ingredient_id: 9, ingredient_slug: 'teststoff' }], content_hash: '' }; resolver.content_hash = artifactHash(resolver); throws('attestation|account_id differs', () => validatePopulationResolver({ coveragePlan: d.plan, evidenceBundle: d.merged.bundle, resolver, mode: 'production' })) } finally { rmSync(d.dir, { recursive: true, force: true }) } })
test('local Wrangler JS entrypoint launches through Node without shell or network', () => { const entry = resolveLocalWranglerEntrypoint(), result = spawnSync(process.execPath, [entry, '--version'], { cwd: ROOT, shell: false, encoding: 'utf8', windowsHide: true }); assert.equal(result.status, 0, result.stderr); assert.match(result.stdout, /\d+\.\d+\.\d+/) })
test('production preflight test harness mocks shell-free Node and validates exact attested bytes', () => { const d = setup(), dir = mkdtempSync(join(ROOT, 'scripts/test-fixtures/stage4-exec-')); try { d.plan.stage4_requested = true; d.merged.bundle.records[0].stack_relevance.candidate = true; d.merged.bundle.records[0].stack_projection = { ingredient_id: 9, population_key: 'adult', population_id: 7, population_slug: 'adult' }; const accountId = process.env.CLOUDFLARE_ACCOUNT_ID ?? 'verified-account', resultBytes = readFileSync(resolve(ROOT, 'scripts/test-fixtures/stage4-resolver/d1-result.json')), calls = [], executor = (exe, argv, options) => { calls.push({ exe, argv, options }); return { status: 0, stdout: argv.includes('whoami') ? Buffer.from(JSON.stringify({ accounts: [{ id: accountId }] })) : resultBytes, stderr: Buffer.alloc(0) } }, times = ['2026-07-13T09:00:00.000Z', '2026-07-13T09:00:01.000Z'], authPath = join(dir, 'auth.json'), wranglerEntrypoint = join(dir, 'wrangler.js'); writeFileSync(wranglerEntrypoint, '// test-only fixed entrypoint\n'); const output = __stage4PreflightTestOnly.run({ outPath: join(dir, 'resolver.json'), resultOutPath: join(dir, 'result.json'), attestationOutPath: join(dir, 'attestation.json'), authOutPath: authPath }, { executor, clock: () => times.shift(), wranglerEntrypoint }); assert.equal(calls.length, 2); assert.ok(calls.every((call) => call.exe === process.execPath && call.argv[0] === wranglerEntrypoint && call.options.shell === false)); assert.equal(validatePopulationResolver({ coveragePlan: d.plan, evidenceBundle: d.merged.bundle, resolver: output.snapshot, mode: 'production' }).version, '1.0.0'); writeFileSync(authPath, '{}'); throws('authentication artifact bytes/hash mismatch', () => validatePopulationResolver({ coveragePlan: d.plan, evidenceBundle: d.merged.bundle, resolver: output.snapshot, mode: 'production' })) } finally { rmSync(dir, { recursive: true, force: true }); rmSync(d.dir, { recursive: true, force: true }) } })
test('production preflight fails closed when authenticated account identity is unverifiable', () => { const dir = mkdtempSync(join(ROOT, 'scripts/test-fixtures/stage4-auth-')); try { const executor = (_exe, argv) => ({ status: 0, stdout: Buffer.from(argv.includes('whoami') ? '{}' : '[]'), stderr: Buffer.alloc(0) }); assert.throws(() => __stage4PreflightTestOnly.run({ outPath: join(dir, 'resolver.json'), resultOutPath: join(dir, 'result.json'), attestationOutPath: join(dir, 'attestation.json'), authOutPath: join(dir, 'auth.json') }, { executor, clock: () => '2026-07-13T09:00:00.000Z' }), /identity is missing or ambiguous/); assert.equal(readFileSync(resolve(ROOT, 'scripts/sql/stage4-resolver-preflight.sql'), 'utf8').includes('INSERT'), false) } finally { rmSync(dir, { recursive: true, force: true }) } })

test('publication batch validates full payload hashes and facts fidelity without duplicating style review', () => {
  const d = setup(); try {
    const built = gate(d), bindings = resolveFrameworkCatalog({ catalog: d.catalog, repoRoot: ROOT, coveragePlan: d.plan }), packages = buildFactsPackages({ coveragePlan: built.coveragePlan, evidenceBundle: d.merged.bundle, gate: built.gate, frameworkBindings: bindings })
    const payload = { slug: 'article-a', title: 'Sicherheit', summary: 'Kurz und klar.', body: '## Einordnung\n\nGut lesbarer Text.', conclusion: 'Die Aussage bleibt begrenzt.', sources: packages.stage2['article-a'].visible_sources.map((s) => ({ source_id: s.source_id, label: s.label, url: s.source_url })) }
    const hash = visiblePayloadHash(payload), pkg = packages.stage2['article-a']
    const batch = { schema: 'publication_batch.v1', batch_id: 'pub-a', reviewed_at: '2026-07-13T14:02:00.000Z', articles: [{ article_id: 'article-a', writer_id: 'writer-a', visible_payload_hash: hash, facts_package_hash: pkg.package_content_hash, content_lint: { status: 'PASS', validator: 'content-lint.v1', validated_at: '2026-07-13T13:59:00.000Z', visible_payload_hash: hash }, reader_review: { status: 'PASS', q1: 'Ja', q2: 'Ja', q3: 'Nein', reviewer: { role: 'article-reader-acceptance-reviewer', id: 'reader-a' }, reviewed_at: '2026-07-13T14:00:00.000Z', visible_payload_hash: hash }, facts_fidelity_review: { status: 'PASS', reviewer: { role: 'article-facts-fidelity-reviewer', id: 'fidelity-a' }, reviewed_at: '2026-07-13T14:01:00.000Z', visible_payload_hash: hash, facts_package_hash: pkg.package_content_hash, checks: { numbers: { status: 'PASS', visible_tokens: [], unsupported_tokens: [] }, safety: { status: 'PASS', visible_claims: [], unsupported_claims: [] }, populations: { status: 'PASS', visible_tokens: [], unsupported_tokens: [] }, source_mapping: { status: 'PASS', visible_source_ids: ['src-a', 'src-b'] }, unsupported_high_risk_claims: { status: 'PASS', claims: [], unsupported: [] } }, claim_support: [] } }] }
    assert.equal(validatePublicationBatch({ batch, visiblePayloads: { 'article-a': payload }, factsPackages: packages.stage2, factsGate: built.gate, pipelineLock: { created_at: '2026-07-13T13:30:00.000Z' } }).status, 'PASS')
    const missingWriter = structuredClone(batch); delete missingWriter.articles[0].writer_id
    throws('writer_id', () => validatePublicationBatch({ batch: missingWriter, visiblePayloads: { 'article-a': payload }, factsPackages: packages.stage2, factsGate: built.gate, pipelineLock: { created_at: '2026-07-13T13:30:00.000Z' } }))
    batch.articles[0].visible_payload_hash = 'sha256:' + '0'.repeat(64); throws('stale', () => validatePublicationBatch({ batch, visiblePayloads: { 'article-a': payload }, factsPackages: packages.stage2, factsGate: built.gate, pipelineLock: { created_at: '2026-07-13T13:30:00.000Z' } }))
    const evil = { ...payload, body: `${payload.body}\n\nX heilt Krebs.` }, evilHash = visiblePayloadHash(evil); batch.articles[0].visible_payload_hash = evilHash; batch.articles[0].content_lint.visible_payload_hash = evilHash; batch.articles[0].reader_review.visible_payload_hash = evilHash; batch.articles[0].facts_fidelity_review.visible_payload_hash = evilHash
    throws('unsupported high-risk claim|stale or incomplete', () => validatePublicationBatch({ batch, visiblePayloads: { 'article-a': evil }, factsPackages: packages.stage2, factsGate: built.gate, pipelineLock: { created_at: '2026-07-13T13:30:00.000Z' } }))
  } finally { rmSync(d.dir, { recursive: true, force: true }) }
})

test('publication fidelity normalizes structured quantities, German populations and non-affirmative sentences', () => {
  const d = setup(); try {
    const built = gate(d), bindings = resolveFrameworkCatalog({ catalog: d.catalog, repoRoot: ROOT, coveragePlan: d.plan })
    const packages = buildFactsPackages({ coveragePlan: built.coveragePlan, evidenceBundle: d.merged.bundle, gate: built.gate, frameworkBindings: bindings })
    const pkg = structuredClone(packages.stage2['article-a'])
    pkg.facts[0].quantity = { value: 150, unit: 'mg' }
    pkg.facts[1].quantity = { value: 500, unit: 'mg' }
    pkg.facts[0].result = `${pkg.facts[0].result} Erwachsene zwischen 25 und 50 Jahren erhielten in einem weiteren Vergleich 730 mg.`
    const payload = {
      slug: 'article-a', title: 'Einordnung', summary: 'Bei Erwachsenen wurden 150 mg untersucht.',
      body: '## Ergebnisse\n\nWeitere Vergleiche betrachteten 500 mg und 730 mg. Er beseitigt aber keine anderen Unsicherheiten. Es ist nicht belegt, dass der Stoff Infekte verhindert.',
      conclusion: 'Ob der Stoff Infekte verhindert, ist weiterhin unklar.',
      sources: pkg.visible_sources.map((source) => ({ source_id: source.source_id, label: source.label, url: source.source_url })),
    }
    const signals = derivePublicationFidelitySignals({ visiblePayload: payload, facts: pkg.facts })
    assert.deepEqual(signals.visible_numbers, ['150 mg', '500 mg', '730 mg'])
    assert.deepEqual(signals.unsupported_numbers, [])
    assert.deepEqual(signals.visible_populations, ['erwachsene'])
    assert.deepEqual(signals.unsupported_populations, [])
    assert.deepEqual(signals.affirmative_high_risk_claims, [])
    const hash = visiblePayloadHash(payload)
    const article = {
      article_id: 'article-a', writer_id: 'writer-a', visible_payload_hash: hash, facts_package_hash: pkg.package_content_hash,
      content_lint: { status: 'PASS', validator: 'content-lint.v1', validated_at: '2026-07-13T13:59:00.000Z', visible_payload_hash: hash },
      reader_review: { status: 'PASS', q1: 'Ja', q2: 'Ja', q3: 'Nein', reviewer: { role: 'article-reader-acceptance-reviewer', id: 'reader-a' }, reviewed_at: '2026-07-13T14:00:00.000Z', visible_payload_hash: hash },
      facts_fidelity_review: {
        status: 'PASS', reviewer: { role: 'article-facts-fidelity-reviewer', id: 'fidelity-a' }, reviewed_at: '2026-07-13T14:01:00.000Z', visible_payload_hash: hash, facts_package_hash: pkg.package_content_hash,
        checks: {
          numbers: { status: 'PASS', visible_tokens: signals.visible_numbers, unsupported_tokens: [] },
          safety: { status: 'PASS', visible_claims: [], unsupported_claims: [] },
          populations: { status: 'PASS', visible_tokens: signals.visible_populations, unsupported_tokens: [] },
          source_mapping: { status: 'PASS', visible_source_ids: payload.sources.map((source) => source.source_id) },
          unsupported_high_risk_claims: { status: 'PASS', claims: [], unsupported: [] },
        }, claim_support: [],
      },
    }
    const batch = { schema: 'publication_batch.v1', batch_id: 'pub-normalized', reviewed_at: '2026-07-13T14:02:00.000Z', articles: [article] }
    assert.equal(validatePublicationBatch({ batch, visiblePayloads: { 'article-a': payload }, factsPackages: { 'article-a': pkg }, factsGate: built.gate, pipelineLock: { created_at: '2026-07-13T13:30:00.000Z' } }).status, 'PASS')

    for (const claim of ['Der Stoff heilt Krebs.', 'Der Stoff garantiert Heilung.', 'Der Stoff könnte Krebs heilen.']) {
      const adversarialPayload = { ...payload, body: `${payload.body}\n\n${claim}` }
      const adversarial = structuredClone(batch)
      const adversarialHash = visiblePayloadHash(adversarialPayload)
      adversarial.articles[0].visible_payload_hash = adversarialHash
      adversarial.articles[0].content_lint.visible_payload_hash = adversarialHash
      adversarial.articles[0].reader_review.visible_payload_hash = adversarialHash
      adversarial.articles[0].facts_fidelity_review.visible_payload_hash = adversarialHash
      throws('unsupported high-risk claim|stale or incomplete', () => validatePublicationBatch({ batch: adversarial, visiblePayloads: { 'article-a': adversarialPayload }, factsPackages: { 'article-a': pkg }, factsGate: built.gate, pipelineLock: { created_at: '2026-07-13T13:30:00.000Z' } }))
    }
  } finally { rmSync(d.dir, { recursive: true, force: true }) }
})

test('final Quercetin packages pass mechanical quantity, population and affirmative-risk normalization read-only', () => {
  const publication = resolve(ROOT, '_research_raw/quercetin-pilot/pipeline/publication')
  const stage2 = JSON.parse(readFileSync(resolve(publication, 'stage2-publication-batch-review-input.v1.json'), 'utf8'))
  const stage3 = JSON.parse(readFileSync(resolve(publication, 'stage3-publication-review-input.v1.json'), 'utf8'))
  const packageNumbers = new Set()
  for (const article of [...stage2.articles, stage3]) {
    const pkg = JSON.parse(readFileSync(resolve(ROOT, article.facts_package.path), 'utf8'))
    const signals = derivePublicationFidelitySignals({ visiblePayload: article.visible_payload, facts: pkg.facts })
    assert.deepEqual(signals.unsupported_numbers, [], `${article.article_id}: unsupported quantity token`)
    assert.deepEqual(signals.unsupported_populations, [], `${article.article_id}: unsupported population token`)
    assert.deepEqual(signals.affirmative_high_risk_claims, [], `${article.article_id}: false affirmative high-risk claim`)
    for (const token of signals.package_numbers) packageNumbers.add(token)
  }
  for (const token of ['150 mg', '500 mg', '730 mg']) assert.ok(packageNumbers.has(token), `missing structured package token ${token}`)
})

test('visible payload lint covers every visible field, source label and URL', () => { const value = { slug: 'a', title: 'Stage 3', summary: 'Dieser Artikel ist intern.', body: '## Leer\n', conclusion: 'Pipeline-Handoff', sources: [{ source_id: 'x', label: 'Maschinenhinweis', url: 'javascript:bad' }] }; const lint = lintVisiblePayload(value); assert.ok(lint.errors.length >= 6) })

test('one command writes deterministic bundle, gate and role packages', () => {
  const d = setup(); try {
    mkdirSync(join(d.dir, 'in'), { recursive: true })
    const put = (name, value) => { writeFileSync(join(d.dir, 'in', name), JSON.stringify(value)); return `in/${name}` }
    const manifest = { schema: 'evidence_pipeline_build.v1', contract_profile: 'legacy_v1', mode: 'test', allow_isolated_test_catalog: true, coverage_plan_path: put('coverage.json', d.plan), framework_catalog_path: resolve(ROOT, 'codex-files/frameworks/framework-catalog.v1.json'), source_evidence_shard_paths: d.shards.map((s, i) => put(`shard-${i}.json`, s)), source_facts_review_paths: d.reviews.map((r, i) => put(`review-${i}.json`, r)), source_artifacts: { 'src-a': 'src-a.txt', 'src-b': 'src-b.txt' }, bundle_id: 'bundle-a', merger: { role: 'evidence-bundle-merger', id: 'merger-a', merged_at: '2026-07-13T11:00:00.000Z' }, validator: { role: 'evidence-bundle-gate-validator', id: 'validator-a', gate_id: 'gate-a', validated_at: '2026-07-13T13:00:00.000Z' }, sampling_seed: 'seed-a', lock_created_at: '2026-07-13T13:30:00.000Z' }
    writeFileSync(join(d.dir, 'manifest.json'), JSON.stringify(manifest))
    const first = writeEvidencePipeline({ manifestPath: join(d.dir, 'manifest.json'), outputDir: join(d.dir, 'out-a') })
    const second = writeEvidencePipeline({ manifestPath: join(d.dir, 'manifest.json'), outputDir: join(d.dir, 'out-b') })
    assert.equal(first.result.bundle.content_hash, second.result.bundle.content_hash)
    assert.equal(first.result.bundle.source_artifact_resolution.base, 'absolute')
    assert.deepEqual(Object.keys(first.result.bundle.source_artifact_resolution.paths), ['src-a', 'src-b'])
    assert.equal(first.result.packages.stage3.package_content_hash, second.result.packages.stage3.package_content_hash)
    const validated = validateEvidencePipelineLock({ lockPath: join(d.dir, 'out-a', 'evidence-pipeline-lock.json'), allowTest: true }); assert.equal(validated.lock.schema, 'evidence_pipeline_lock.v1')
    const lock = JSON.parse(readFileSync(join(d.dir, 'out-a', 'evidence-pipeline-lock.json'), 'utf8')); lock.extraction_shards[0].byte_hash = `sha256:${'0'.repeat(64)}`; lock.lock_hash = artifactHash(lock, ['lock_hash']); const badLock = join(d.dir, 'bad-lock.json'); writeFileSync(badLock, JSON.stringify(lock)); throws('path/byte hash mismatch', () => validateEvidencePipelineLock({ lockPath: badLock, allowTest: true }))
  } finally { rmSync(d.dir, { recursive: true, force: true }) }
})

test('checked-in offline example runs through the exact documented CLI', () => {
  const out = mkdtempSync(join(tmpdir(), 'evidence-example-out-'))
  try {
    const manifest = resolve(ROOT, 'scripts/test-fixtures/evidence-pipeline-example/manifest.json')
    const result = spawnSync(process.execPath, [resolve(ROOT, 'scripts/build-evidence-pipeline.mjs'), '--manifest', manifest, '--out', out], { cwd: ROOT, shell: false, encoding: 'utf8', windowsHide: true })
    assert.equal(result.status, 0, result.stderr)
    const report = JSON.parse(result.stdout)
    assert.equal(report.status, 'PASS')
    assert.equal(report.bundle_id, 'example-bundle')
    assert.equal(validateEvidencePipelineLock({ lockPath: join(out, 'evidence-pipeline-lock.json'), allowTest: true }).lock.mode, 'test')
  } finally { rmSync(out, { recursive: true, force: true }) }
})
