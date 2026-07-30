import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { coveragePlanContentHash, deterministicStandardSample, evidenceBundleContentHash, evidenceRecordPayloadHash, sha256Bytes } from '../lib/content-validation.mjs'
import { artifactHash, buildFactsPackages } from '../lib/evidence-pipeline-builder.mjs'
import { writeEvidencePipeline } from '../build-evidence-pipeline.mjs'

export function evidencePipelineFixture({ acceptedCandidate = false } = {}) {
  const sourceArtifacts = { 'src-primary': 'primary source bytes', 'src-support': 'supporting source bytes' }
  const sources = Object.entries(sourceArtifacts).map(([source_id, bytes], index) => ({
    source_id, created_by: { role: 'source-evidence-extractor', id: `extractor-${index + 1}`, created_at: `2026-07-13T10:0${index}:00.000Z` },
    source_locator: { source_url: `https://example.org/${index ? 'support' : 'primary'}`, access_basis: 'verified_full_text', retrieved_at: '2026-07-13' },
    source_artifact_path: `${source_id}.txt`, source_content_hash: sha256Bytes(bytes),
    methods: { design: 'systematic_review', population: 'Erwachsene' },
  }))
  const records = sources.map((source, index) => ({
    schema: 'source_evidence_record.v1', record_id: index ? 'fact-support-01' : 'fact-primary-01', source_id: source.source_id,
    cluster_keys: ['safety'], provenance: { location: `Results ${index + 1}`, language: 'en' }, claim: `Kernaussage ${index + 1}`,
    result: index === 0 ? 'Ergebnis 1 bei 300 mg.' : `Ergebnis ${index + 1}`, quantity: { value: index === 0 ? 300 : null, unit: index === 0 ? 'mg' : null, schedule: null, duration: null, is_recommendation: false },
    safety: 'Keine neue Sicherheitsableitung.', uncertainty: 'Begrenzte Übertragbarkeit.',
    stack_relevance: { candidate: false, use: 'none', direct_user_dose_recommendation: false },
  }))
  const coveragePlan = {
    schema: 'coverage_plan.v1', coverage_plan_id: 'coverage-stage2-import-01', content_hash: '', substance: 'Teststoff', stage4_requested: false,
    stage3_archetype_decision: { archetype: 'essential_nutrient', reason: 'Passender Archetyp.', status: 'approved', decision: 'existing', framework_id: 'stage3.essential_nutrient', version: '2.0.3', variant: 'essential_nutrient' },
    clusters: [{ cluster_key: 'safety', required: true, status: 'covered', primary_source_ids: ['src-primary'], supporting_source_ids: ['src-support'], article_candidate_ids: ['article-01'] }],
    sources: sources.map((source, index) => ({ source_id: source.source_id, stage15_label: index ? 'SUPPORTING' : 'ANCHOR', source_url: source.source_locator.source_url, covered_by_source_ids: index ? ['src-primary'] : [], assigned_article_ids: ['article-01'] })),
    article_candidates: [{ article_id: 'article-01', primary_source_id: 'src-primary', integrated_source_ids: ['src-support'], cluster_keys: ['safety'], own_article_reason: 'minimal_cluster_representative', risk_class: ['safety'], source_archetype: 'meta_review', framework_fit: { decision: 'existing', framework_id: 'stage2.meta_study', version: '2.0.0', variant_id: 'systematic_review_or_meta_analysis', reason: 'Passt.', owner_approval: { required: false, status: 'not_required' }, pilot: { required: false, status: 'not_required' } }, publication_gate: acceptedCandidate ? { status: 'accepted', result: 'PASS', review_id: 'stage2-publication-01' } : { status: 'pending', result: null, review_id: null }, status: acceptedCandidate ? 'accepted' : 'facts_complete', facts_status: 'complete', publication_status: acceptedCandidate ? 'accepted' : 'drafted' }], facts_gate: {},
  }
  coveragePlan.content_hash = coveragePlanContentHash(coveragePlan)
  const evidenceBundle = { schema: 'source_evidence_bundle.v1', bundle_id: 'bundle-stage2-import-01', content_hash: '', coverage_plan_id: coveragePlan.coverage_plan_id, coverage_plan_content_hash: coveragePlan.content_hash, stage4_requested: false, sources, records }
  evidenceBundle.content_hash = evidenceBundleContentHash(evidenceBundle)
  const sourceFactsReviews = records.map((record, index) => ({
    schema: 'source_facts_review.v1', review_id: `review-${index + 1}`, bundle_id: evidenceBundle.bundle_id, bundle_content_hash: evidenceBundle.content_hash, status: 'pass',
    reviewer: { role: 'source-facts-reviewer', id: `reviewer-${index + 1}` }, reviewed_at: `2026-07-13T11:0${index}:00.000Z`,
    record_results: [{ record_id: record.record_id, status: 'pass', mode: 'full', source_content_hash: sources[index].source_content_hash, fact_payload_hash: evidenceRecordPayloadHash(record), scope: ['source_fidelity', 'coverage_crossrefs', 'safety'], risk_class: ['safety'], findings: [] }],
  }))
  const factsCompletenessGate = { schema: 'facts_completeness_gate.v1', gate_id: 'gate-1', status: 'pass', coverage_plan_id: coveragePlan.coverage_plan_id, coverage_plan_hash: coveragePlan.content_hash, evidence_bundle_id: evidenceBundle.bundle_id, evidence_bundle_content_hash: evidenceBundle.content_hash, required_record_ids: records.map((r) => r.record_id), validated_record_ids: records.map((r) => r.record_id), source_facts_review_ids: sourceFactsReviews.map((r) => r.review_id), sampling: { algorithm: 'sha256_rank_v1', seed: 'seed-2026', eligible_standard_record_ids: [], selected_record_ids: deterministicStandardSample([], 'seed-2026'), expanded_to_full_batch: false }, checks: { exact_record_set: 'pass', schema: 'pass', crossrefs: 'pass', hashes: 'pass', professional_approvals: 'pass', required_clusters: 'pass' }, open_gaps: [], validated_by: { role: 'evidence-bundle-gate-validator', id: 'validator-1' }, validated_at: '2026-07-13T12:00:00.000Z' }
  coveragePlan.facts_gate = { status: 'pass', evidence_bundle_id: evidenceBundle.bundle_id, evidence_bundle_content_hash: evidenceBundle.content_hash, required_record_ids: factsCompletenessGate.required_record_ids, validated_record_ids: factsCompletenessGate.validated_record_ids, source_facts_review_ids: factsCompletenessGate.source_facts_review_ids, gate_artifact_id: factsCompletenessGate.gate_id, missing_cluster_keys: [], blocking_gaps: [] }
  const packages = buildFactsPackages({ coveragePlan, evidenceBundle, gate: factsCompletenessGate, frameworkBindings: { candidate_bindings: { 'article-01': { framework_id: 'legacy-test', version: '1.0.0', stage: 'stage2', path: 'test', status: 'approved', variant: 'test', decision: 'existing' } }, stage3_binding: { framework_id: 'legacy-stage3-test', version: '1.0.0', stage: 'stage3', path: 'test', status: 'approved', variant: 'essential_nutrient', decision: 'existing' } } })
  return { coveragePlan, evidenceBundle, sourceFactsReviews, factsCompletenessGate, sourceArtifacts, packages }
}

export function writeEvidencePipelineFixture(dir, options) {
  const data = evidencePipelineFixture(options)
  const paths = { coverage: join(dir, 'coverage.json'), evidence: join(dir, 'built', 'source-evidence-bundle.json'), gate: join(dir, 'built', 'facts-completeness-gate.json'), stage2Package: join(dir, 'built', 'stage2-packages', 'article-01.json'), stage3Package: join(dir, 'built', 'facts-package-stage3.json'), lock: join(dir, 'built', 'evidence-pipeline-lock.json'), reviews: [] , shards: [], sources: {} }
  writeFileSync(paths.coverage, JSON.stringify(data.coveragePlan))
  data.sourceFactsReviews.forEach((review, index) => { const path = join(dir, `review-${index + 1}.json`); writeFileSync(path, JSON.stringify(review)); paths.reviews.push(path) })
  for (const [sourceId, bytes] of Object.entries(data.sourceArtifacts)) { const path = join(dir, `${sourceId}.txt`); writeFileSync(path, bytes); paths.sources[sourceId] = path }
  data.evidenceBundle.sources.forEach((source, index) => {
    const record = data.evidenceBundle.records.find((entry) => entry.source_id === source.source_id)
    const shard = { schema: 'source_evidence_shard.v1', shard_id: `shard-${index + 1}`, coverage_plan_id: data.coveragePlan.coverage_plan_id, coverage_plan_content_hash: data.coveragePlan.content_hash, extractor: { role: 'source-evidence-extractor', id: source.created_by.id }, created_at: source.created_by.created_at, sources: [source], records: [record], content_hash: '' }
    shard.content_hash = artifactHash(shard); const path = join(dir, `shard-${index + 1}.json`); writeFileSync(path, JSON.stringify(shard)); paths.shards.push(path)
  })
  const manifest = { schema: 'evidence_pipeline_build.v1', contract_profile: 'legacy_v1', mode: 'test', allow_isolated_test_catalog: true, coverage_plan_path: paths.coverage, framework_catalog_path: join(process.cwd(), 'codex-files/frameworks/framework-catalog.v1.json'), source_evidence_shard_paths: paths.shards, source_facts_review_paths: paths.reviews, source_artifacts: paths.sources, bundle_id: data.evidenceBundle.bundle_id, merger: { role: 'evidence-bundle-merger', id: 'merger-test', merged_at: '2026-07-13T10:30:00.000Z' }, validator: { role: 'evidence-bundle-gate-validator', id: 'validator-1', gate_id: data.factsCompletenessGate.gate_id, validated_at: data.factsCompletenessGate.validated_at }, sampling_seed: data.factsCompletenessGate.sampling.seed, lock_created_at: '2026-07-13T12:30:00.000Z' }
  const manifestPath = join(dir, 'builder-manifest.json'); writeFileSync(manifestPath, JSON.stringify(manifest)); writeEvidencePipeline({ manifestPath, outputDir: join(dir, 'built') })
  return { ...data, packages: { stage2: { 'article-01': JSON.parse(readFileSync(paths.stage2Package, 'utf8')) }, stage3: JSON.parse(readFileSync(paths.stage3Package, 'utf8')) }, paths }
}
