import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import { spawnSync } from 'node:child_process'
import {
  coveragePlanContentHash,
  deterministicStandardSample,
  evidenceBundleContentHash,
  evidenceRecordPayloadHash,
  lintArticle,
  loadSourceArtifactsFromBundle,
  sha256Bytes,
  validateCoveragePlan,
  validateEvidenceBundle,
} from './lib/content-validation.mjs'

const fixture = (name) => new URL(`./test-fixtures/content-lint/${name}`, import.meta.url).pathname.replace(/^\/(?:[A-Za-z]:)/, (value) => value.slice(1))
const codes = (result) => new Set(result.issues.map((entry) => entry.code))
const errorCodes = (issues) => new Set(issues.map((entry) => entry.code))

function pipeline({ risk = ['standard'], stage4Requested = false } = {}) {
  const sourceArtifacts = { 'src-1': 'source one bytes', 'src-2': 'source two bytes' }
  const sources = Object.entries(sourceArtifacts).map(([source_id, bytes], index) => ({
    source_id,
    created_by: { role: 'clinical-study-interpreter', id: `writer-${index + 1}`, created_at: `2026-07-13T10:0${index}:00Z` },
    source_locator: { source_url: `https://example.org/${source_id}`, doi: null, pmid: null, access_basis: 'verified_full_text', retrieved_at: '2026-07-13' },
    source_artifact_path: `${source_id}.txt`,
    source_content_hash: sha256Bytes(bytes),
    methods: { design: 'systematic_review', population: 'Erwachsene', intervention_or_exposure: 'Supplement', comparison: 'Kontrolle', duration: '12 Wochen' },
  }))
  const records = sources.map((source, index) => ({
    schema: 'source_evidence_record.v1', record_id: `fact-${index + 1}`, source_id: source.source_id,
    cluster_keys: ['cluster-1'], provenance: { location: `Results ${index + 1}`, language: 'en' },
    claim: `Kernaussage ${index + 1}`, result: `Ergebnis ${index + 1}`,
    quantity: { value: null, unit: null, schedule: null, duration: null, is_recommendation: false },
    safety: 'Keine neue Sicherheitsableitung.', uncertainty: 'Begrenzte Übertragbarkeit.',
    stack_relevance: { candidate: stage4Requested, use: stage4Requested ? 'reference_value' : 'none', direct_user_dose_recommendation: false },
    ...(stage4Requested ? { stack_projection: {
      status: 'ready', ingredient_id: 42, population_key: 'adult', population_id: 1, population_slug: 'adult',
      dose_min: 10, dose_max: 10, unit: 'mg', amount_type: 'tested_amount', reported_amount_text: '10 mg/Tag', timing: 'täglich',
      stage4_source_kind: 'study', source_type: 'study', source_label: 'Studie', source_url: source.source_locator.source_url,
      stack_role: 'standard', stack_visible: true, is_controversial: false, sex_filter: null, is_athlete: false,
      purpose: 'maintenance', relevance_reason: 'Geprüfte Studienmenge.',
    } } : {}),
  }))
  const coveragePlan = {
    schema: 'coverage_plan.v1', coverage_plan_id: 'coverage-1', content_hash: '', substance: 'Teststoff', stage4_requested: stage4Requested,
    stage3_archetype_decision: { archetype: 'essential_nutrient', reason: 'Passender Archetyp.', status: 'approved' },
    clusters: [{ cluster_key: 'cluster-1', required: true, status: 'covered', primary_source_ids: ['src-1'], supporting_source_ids: ['src-2'], article_candidate_ids: ['article-1'] }],
    sources: sources.map((source, index) => ({ source_id: source.source_id, stage15_label: index ? 'SUPPORTING' : 'ANCHOR', source_url: source.source_locator.source_url, covered_by_source_ids: index ? ['src-1'] : [], assigned_article_ids: ['article-1'] })),
    article_candidates: [{ article_id: 'article-1', primary_source_id: 'src-1', integrated_source_ids: ['src-2'], cluster_keys: ['cluster-1'], own_article_reason: 'minimal_cluster_representative', risk_class: risk, source_archetype: 'meta_review', framework_fit: { decision: 'existing', framework_id: 'meta-study-v1', variant_id: 'default-v1', reason: 'Passt.', owner_approval: { required: false, status: 'not_required' }, pilot: { required: false, status: 'not_required' } }, publication_gate: { status: 'pending', result: null, review_id: null }, status: 'facts_complete' }],
    facts_gate: {},
  }
  coveragePlan.content_hash = coveragePlanContentHash(coveragePlan)
  const evidenceBundle = { schema: 'source_evidence_bundle.v1', bundle_id: 'bundle-1', content_hash: '', coverage_plan_id: coveragePlan.coverage_plan_id, coverage_plan_content_hash: coveragePlan.content_hash, stage4_requested: stage4Requested, sources, records }
  evidenceBundle.content_hash = evidenceBundleContentHash(evidenceBundle)
  const selected = deterministicStandardSample(risk.includes('standard') ? records.map((r) => r.record_id) : [], 'seed-2026')
  const sourceFactsReviews = records.map((record, index) => ({
    schema: 'source_facts_review.v1', review_id: `review-${index + 1}`, bundle_id: evidenceBundle.bundle_id, bundle_content_hash: evidenceBundle.content_hash,
    status: 'pass', reviewer: { role: 'source-facts-reviewer', id: `reviewer-${index + 1}` }, reviewed_at: `2026-07-13T11:0${index}:00Z`,
    record_results: [{ record_id: record.record_id, status: 'pass', mode: risk.includes('standard') ? (selected.includes(record.record_id) ? 'batch_sample' : 'batch_inherited') : 'full', source_content_hash: sources[index].source_content_hash, fact_payload_hash: evidenceRecordPayloadHash(record), scope: ['source_fidelity', 'coverage_crossrefs', ...(risk.includes('safety') ? ['safety'] : []), ...(stage4Requested ? ['quantity', 'population_mapping', 'stage4_projection'] : [])], risk_class: risk, findings: [] }],
  }))
  const factsCompletenessGate = {
    schema: 'facts_completeness_gate.v1', gate_id: 'gate-1', status: 'pass', coverage_plan_id: coveragePlan.coverage_plan_id, coverage_plan_hash: coveragePlan.content_hash,
    evidence_bundle_id: evidenceBundle.bundle_id, evidence_bundle_content_hash: evidenceBundle.content_hash,
    required_record_ids: records.map((r) => r.record_id), validated_record_ids: records.map((r) => r.record_id), source_facts_review_ids: sourceFactsReviews.map((r) => r.review_id),
    sampling: { algorithm: 'sha256_rank_v1', seed: 'seed-2026', eligible_standard_record_ids: risk.includes('standard') ? records.map((r) => r.record_id).sort() : [], selected_record_ids: selected, expanded_to_full_batch: false },
    checks: { exact_record_set: 'pass', schema: 'pass', crossrefs: 'pass', hashes: 'pass', professional_approvals: 'pass', required_clusters: 'pass' }, open_gaps: [],
    validated_by: { role: 'evidence-bundle-gate-validator', id: 'validator-1' }, validated_at: '2026-07-13T12:00:00Z',
  }
  coveragePlan.facts_gate = { status: 'pass', evidence_bundle_id: evidenceBundle.bundle_id, evidence_bundle_content_hash: evidenceBundle.content_hash, required_record_ids: factsCompletenessGate.required_record_ids, validated_record_ids: factsCompletenessGate.validated_record_ids, source_facts_review_ids: factsCompletenessGate.source_facts_review_ids, gate_artifact_id: factsCompletenessGate.gate_id, missing_cluster_keys: [], blocking_gaps: [] }
  return { coveragePlan, evidenceBundle, sourceFactsReviews, factsCompletenessGate, sourceArtifacts }
}

test('visible PASS fixture has no deterministic errors', () => assert.deepEqual(lintArticle({ file: fixture('pass.md'), type: 'stage3' }).issues, []))
for (const [name, code] of [['mojibake.md', 'MOJIBAKE'], ['workflow.md', 'WORKFLOW_TERM'], ['self-description.md', 'WORKFLOW_TERM'], ['disclosure.md', 'HTML_STRUCTURE'], ['empty-h2.md', 'EMPTY_H2'], ['missing-image.md', 'MISSING_IMAGE'], ['graphic-placeholder.md', 'GRAPHIC_PLACEHOLDER'], ['bad-link.md', 'LINK_FORMAT']]) {
  test(`${name} reports ${code}`, () => assert.ok(codes(lintArticle({ file: fixture(name), repoRoot: process.cwd() })).has(code)))
}

test('pure pipeline API accepts real artifacts and multiple review shards', () => assert.deepEqual(validateEvidenceBundle(pipeline()), []))

test('canonical coverage hash is recomputed', () => {
  const data = pipeline(); data.coveragePlan.substance = 'Manipuliert'
  assert.ok(errorCodes(validateEvidenceBundle(data)).has('COVERAGE_HASH'))
})

test('invented source hash cannot pass without matching artifact bytes', () => {
  const data = pipeline(); data.sourceArtifacts['src-1'] = 'tampered bytes'
  assert.ok(errorCodes(validateEvidenceBundle(data)).has('SOURCE_ARTIFACT_HASH'))
})

test('missing source bytes are a hard failure', () => {
  const data = pipeline(); delete data.sourceArtifacts['src-1']
  assert.ok(errorCodes(validateEvidenceBundle(data)).has('SOURCE_ARTIFACT'))
})

test('review shards reject stale payload hashes, duplicate coverage and self-review', () => {
  const stale = pipeline(); stale.sourceFactsReviews[0].record_results[0].fact_payload_hash = sha256Bytes('fake')
  assert.ok(errorCodes(validateEvidenceBundle(stale)).has('EVIDENCE_HASH'))
  const duplicate = pipeline(); duplicate.sourceFactsReviews[1].record_results.push(structuredClone(duplicate.sourceFactsReviews[0].record_results[0]))
  assert.ok(errorCodes(validateEvidenceBundle(duplicate)).has('SOURCE_FACTS_REVIEW'))
  const self = pipeline(); self.sourceFactsReviews[0].reviewer.id = 'writer-1'
  assert.ok(errorCodes(validateEvidenceBundle(self)).has('REVIEW_INDEPENDENCE'))
})

test('reviews and facts gate enforce temporal order', () => {
  const reviewEarly = pipeline(); reviewEarly.sourceFactsReviews[0].reviewed_at = '2026-07-13T09:00:00Z'
  assert.ok(errorCodes(validateEvidenceBundle(reviewEarly)).has('REVIEW_TIME'))
  const gateEarly = pipeline(); gateEarly.factsCompletenessGate.validated_at = '2026-07-13T10:30:00Z'
  assert.ok(errorCodes(validateEvidenceBundle(gateEarly)).has('REVIEW_TIME'))
})

test('deterministic sampling rejects changed seed selection and wrong modes', () => {
  const changed = pipeline(); changed.factsCompletenessGate.sampling.selected_record_ids.reverse()
  assert.ok(errorCodes(validateEvidenceBundle(changed)).has('SAMPLING'))
  const mode = pipeline(); mode.sourceFactsReviews[0].record_results[0].mode = 'batch_inherited'
  assert.ok(errorCodes(validateEvidenceBundle(mode)).has('SAMPLING'))
})

test('elevated risks require full review and exact scopes', () => {
  const data = pipeline({ risk: ['safety'] }); data.sourceFactsReviews[0].record_results[0].mode = 'batch_sample'
  assert.ok(errorCodes(validateEvidenceBundle(data)).has('RISK_REVIEW'))
  const scope = pipeline({ risk: ['safety'] }); scope.sourceFactsReviews[0].record_results[0].scope = ['source_fidelity', 'coverage_crossrefs']
  assert.ok(errorCodes(validateEvidenceBundle(scope)).has('RISK_REVIEW'))
})

test('new framework always needs owner approval and passed pilot', () => {
  const data = pipeline(); const fit = data.coveragePlan.article_candidates[0].framework_fit
  fit.decision = 'new'; fit.owner_approval = { required: true, status: 'pending' }; fit.pilot = { required: true, status: 'pending' }
  data.coveragePlan.content_hash = coveragePlanContentHash(data.coveragePlan)
  assert.ok(validateCoveragePlan(data.coveragePlan).some((entry) => entry.message.includes('whenever used')))
})

test('stack projection is forbidden unless Stage 4 was requested', () => {
  const data = pipeline(); data.evidenceBundle.records[0].stack_projection = { status: 'not_applicable' }
  data.evidenceBundle.content_hash = evidenceBundleContentHash(data.evidenceBundle)
  assert.ok(errorCodes(validateEvidenceBundle(data)).has('STAGE4_PROJECTION'))
})

test('Stage 4 validates enums, numeric bounds, population/source mapping and therapeutic purpose', () => {
  const data = pipeline({ stage4Requested: true }); const p = data.evidenceBundle.records[0].stack_projection
  p.dose_max = '10'; p.population_slug = 'children'; p.source_type = 'official'; p.purpose = 'therapeutic'
  data.evidenceBundle.content_hash = evidenceBundleContentHash(data.evidenceBundle)
  const issues = validateEvidenceBundle(data)
  assert.ok(errorCodes(issues).has('STAGE4_PROJECTION'))
  assert.ok(issues.some((entry) => entry.message.includes('therapeutic')))
})

test('missing real review and gate artifacts fail closed', () => {
  const data = pipeline(); delete data.sourceFactsReviews; delete data.factsCompletenessGate
  const found = errorCodes(validateEvidenceBundle(data))
  assert.ok(found.has('SOURCE_FACTS_REVIEW')); assert.ok(found.has('FACTS_GATE_ARTIFACT'))
})

test('invalid UTF-8 and BOM remain rejected', () => {
  const dir = mkdtempSync(join(tmpdir(), 'content-lint-')); const invalid = join(dir, 'invalid.md'); const bom = join(dir, 'bom.md')
  writeFileSync(invalid, Buffer.from([0xc3, 0x28])); writeFileSync(bom, Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), Buffer.from('# Text')]))
  assert.ok(codes(lintArticle({ file: invalid })).has('UTF8')); assert.ok(codes(lintArticle({ file: bom })).has('UTF8'))
})

test('images require alt text and an existing local asset', () => {
  const dir = mkdtempSync(join(tmpdir(), 'content-image-lint-'))
  try {
    const missingAlt = join(dir, 'missing-alt.md'), missingAsset = join(dir, 'missing-asset.md'), image = join(dir, 'graphic.png'), valid = join(dir, 'valid.md')
    writeFileSync(image, Buffer.from([0x89, 0x50, 0x4e, 0x47]))
    writeFileSync(missingAlt, '# Text\n\n![](./graphic.png)')
    writeFileSync(missingAsset, '# Text\n\n![Erklärung](./fehlt.png)')
    writeFileSync(valid, '# Text\n\n![Erklärung](./graphic.png)')
    assert.ok(codes(lintArticle({ file: missingAlt })).has('IMAGE_ALT'))
    assert.ok(codes(lintArticle({ file: missingAsset })).has('MISSING_IMAGE'))
    assert.equal(codes(lintArticle({ file: valid })).has('IMAGE_ALT'), false)
    assert.equal(codes(lintArticle({ file: valid })).has('MISSING_IMAGE'), false)
  } finally { rmSync(dir, { recursive: true, force: true }) }
})

test('CLI reserves exit 1 for lint failures and 2 for usage errors', () => {
  const cli = fixture('../../content-lint.mjs')
  const pass = spawnSync(process.execPath, [cli, '--file', fixture('pass.md')], { encoding: 'utf8' })
  const fail = spawnSync(process.execPath, [cli, '--file', fixture('workflow.md')], { encoding: 'utf8' })
  const usage = spawnSync(process.execPath, [cli, '--unknown'], { encoding: 'utf8' })
  assert.equal(pass.status, 0, pass.stderr); assert.equal(fail.status, 1); assert.equal(usage.status, 2)
})

test('CLI loads and hashes real local source artifacts', () => {
  const dir = mkdtempSync(join(tmpdir(), 'evidence-cli-'))
  const data = pipeline()
  for (const [sourceId, bytes] of Object.entries(data.sourceArtifacts)) writeFileSync(join(dir, `${sourceId}.txt`), bytes)
  for (const [name, value] of [['coverage.json', data.coveragePlan], ['bundle.json', data.evidenceBundle], ['gate.json', data.factsCompletenessGate], ['review-1.json', data.sourceFactsReviews[0]], ['review-2.json', data.sourceFactsReviews[1]]]) writeFileSync(join(dir, name), JSON.stringify(value))
  const cli = fixture('../../content-lint.mjs')
  const result = spawnSync(process.execPath, [cli, '--file', fixture('pass.md'), '--coverage', join(dir, 'coverage.json'), '--evidence', join(dir, 'bundle.json'), '--source-review', join(dir, 'review-1.json'), '--source-review', join(dir, 'review-2.json'), '--facts-gate', join(dir, 'gate.json')], { encoding: 'utf8' })
  assert.equal(result.status, 0, result.stderr)
})

test('copied bundle resolves original sources from explicit repo-root metadata', () => {
  const root = mkdtempSync(join(tmpdir(), 'source-resolution-root-'))
  try {
    mkdirSync(join(root, 'originals'), { recursive: true })
    writeFileSync(join(root, 'originals', 'src-1.txt'), 'canonical source bytes')
    const bundle = {
      sources: [{ source_id: 'src-1', source_artifact_path: 'wrong-package-relative.txt' }],
      source_artifact_resolution: { schema: 'source_artifact_resolution.v1', base: 'repo_root', paths: { 'src-1': 'originals/src-1.txt' } },
    }
    const loaded = loadSourceArtifactsFromBundle(bundle, { repoRoot: root, bundleDir: join(root, 'copied', 'package') })
    assert.equal(loaded['src-1'].toString('utf8'), 'canonical source bytes')
  } finally { rmSync(root, { recursive: true, force: true }) }
})

test('legacy relative source paths fail closed without an explicit bundle directory', () => {
  assert.throws(() => loadSourceArtifactsFromBundle({ sources: [{ source_id: 'src-1', source_artifact_path: 'src-1.txt' }] }), /explicit bundleDir/)
})
