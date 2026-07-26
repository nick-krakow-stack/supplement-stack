import assert from 'node:assert/strict'
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import test from 'node:test'
import { sha256Bytes } from './lib/content-validation.mjs'
import { visiblePayloadHash } from './lib/evidence-pipeline-builder.mjs'
import { finalizePublicationBatches, writePublicationBatchesAtomically } from './finalize-publication-batches.mjs'

const hash = (value) => sha256Bytes(Buffer.from(String(value)))
const reviewArtifact = (value, seed) => ({ value, path: `${seed}.json`, byte_hash: hash(seed) })
const checks = () => Object.fromEntries(['numbers', 'safety', 'populations', 'source_mapping', 'high_risk_claims', 'other_factual_claims'].map((key) => [key, { status: 'PASS' }]))

function setup(stage2Count = 7) {
  const lock = { lock_id: 'lock-1', lock_hash: hash('lock'), created_at: '2026-07-14T08:00:00.000Z' }
  const source = { source_id: 'src-1', label: 'Quelle', url: 'https://example.org/source' }
  const makeInput = (articleId) => {
    const visible_payload = { slug: articleId, title: `Beispielartikel ${articleId.split('-').at(-1)}`, summary: 'Klare Zusammenfassung.', body: '## Einordnung\n\nSachlicher Haupttext.', conclusion: 'Begrenztes Fazit.', sources: [source] }
    return {
      article_id: articleId, article_file: { path: `${articleId}.md`, byte_hash: hash(`article-${articleId}`) },
      facts_package: { path: `${articleId}.json`, byte_hash: hash(`package-bytes-${articleId}`), package_content_hash: hash(`package-${articleId}`), record_ids: [`fact-${articleId}`] },
      visible_payload, visible_payload_hash: visiblePayloadHash(visible_payload),
    }
  }
  const stage2Articles = Array.from({ length: stage2Count }, (_, index) => makeInput(`stage2-${index + 1}`)), stage3Article = makeInput('stage3-1')
  const stage2InputValue = { schema: 'publication_batch_review_input.v1', review_scope: 'stage2', pipeline_lock: { lock_id: lock.lock_id, lock_hash: lock.lock_hash }, required_article_ids: stage2Articles.map((entry) => entry.article_id), articles: stage2Articles }
  const stage3InputValue = { schema: 'publication_article_review_input.v1', review_scope: 'stage3', pipeline_lock: { lock_id: lock.lock_id, lock_hash: lock.lock_hash }, ...stage3Article }
  const stage2Input = reviewArtifact(stage2InputValue, 'stage2-input'), stage3Input = reviewArtifact(stage3InputValue, 'stage3-input')
  const reader = { role: 'article-reader-acceptance-reviewer', id: 'reader-1' }
  const readerEntry = (input, provenance) => ({ article_id: input.article_id, visible_payload_hash: input.visible_payload_hash, ...(provenance ? { review_provenance: provenance } : {}), questions: { q1: 'Ja', q2: 'Ja', q3: 'Nein' }, result: 'PASS' })
  const readerR1 = reviewArtifact({ review_id: 'reader-r1', reviewer: reader, reviewed_at: '2026-07-14T08:10:00.000Z', overall: { result: 'PASS' }, articles: stage2Articles.map((entry) => readerEntry(entry)) }, 'reader-r1')
  const readerR2 = reviewArtifact({
    review_id: 'reader-r2', reviewer: reader, reviewed_at: '2026-07-14T08:20:00.000Z', overall: { result: 'PASS' },
    input_binding: { byte_hash: stage2Input.byte_hash, pipeline_lock_id: lock.lock_id, pipeline_lock_hash: lock.lock_hash },
    prior_review_binding: { byte_hash: readerR1.byte_hash, review_id: readerR1.value.review_id },
    articles: stage2Articles.map((entry, index) => readerEntry(entry, index < Math.max(0, stage2Count - 1) ? 'inherited_from_r1_after_exact_full_visible_payload_hash_match' : 'direct_recheck')),
  }, 'reader-r2')
  const stage3ReaderR1 = reviewArtifact({ review_id: 'stage3-reader-r1', reviewer: reader, reviewed_at: '2026-07-14T08:11:00.000Z', result: 'FAIL' }, 'stage3-reader-r1')
  const stage3ReaderR2 = reviewArtifact({
    review_id: 'stage3-reader-r2', reviewer: reader, reviewed_at: '2026-07-14T08:21:00.1234567Z', result: 'PASS',
    input_binding: { byte_hash: stage3Input.byte_hash, pipeline_lock_id: lock.lock_id, pipeline_lock_hash: lock.lock_hash },
    prior_review_comparison: { byte_hash: stage3ReaderR1.byte_hash, review_id: stage3ReaderR1.value.review_id },
    article_binding: { article_id: stage3Article.article_id, visible_payload_hash: stage3Article.visible_payload_hash },
    questions: { q1: { answer: 'Ja' }, q2: { answer: 'Ja' }, q3: { answer: 'Nein' } },
  }, 'stage3-reader-r2')
  const fidelityReviewer = { role: 'article-facts-fidelity-reviewer', id: 'fidelity-1' }
  const fidelityEntry = (input, stage) => ({ stage, article_id: input.article_id, article_byte_hash: input.article_file.byte_hash, visible_payload_hash: input.visible_payload_hash, facts_package_hash: input.facts_package.package_content_hash, result: 'PASS', checks: checks() })
  const allEntries = [...stage2Articles.map((entry) => fidelityEntry(entry, 'stage2')), fidelityEntry(stage3Article, 'stage3')]
  const fidelityR1 = reviewArtifact({ schema: 'publication_facts_fidelity_review.v1', review_id: 'fidelity-r1', status: 'PASS', reviewer: fidelityReviewer, reviewed_at: '2026-07-14T08:30:00.000Z', summary: { overall: 'PASS' }, articles: allEntries }, 'fidelity-r1')
  const fidelityR2 = reviewArtifact({ schema: 'publication_facts_fidelity_review.v1', review_id: 'fidelity-r2', status: 'PASS', reviewer: fidelityReviewer, reviewed_at: '2026-07-14T08:40:00.000Z', summary: { overall: 'PASS' }, recheck_of: { byte_hash: fidelityR1.byte_hash, review_id: fidelityR1.value.review_id }, articles: allEntries }, 'fidelity-r2')
  const fidelityR3 = reviewArtifact({
    schema: 'publication_facts_fidelity_review.v1', review_id: 'fidelity-r3', status: 'PASS', reviewer: fidelityReviewer, reviewed_at: '2026-07-14T08:50:00.000Z', summary: { overall: 'PASS' },
    recheck_of: { byte_hash: fidelityR2.byte_hash, review_id: fidelityR2.value.review_id },
    input_bindings: { stage2_review_input: { byte_hash: stage2Input.byte_hash }, stage3_review_input: { byte_hash: stage3Input.byte_hash } },
    targeted_rechecks: [...(stage2Articles.length ? [allEntries[stage2Articles.length - 1]] : []), allEntries.at(-1)],
    unchanged_stage2_carry_forward: allEntries.slice(0, Math.max(0, stage2Articles.length - 1)).map(({ checks: _carriedChecks, ...entry }) => ({ ...entry, source_set_identical_to_r2: true })),
  }, 'fidelity-r3')
  const packages = Object.fromEntries(stage2Articles.map((input) => [input.article_id, { package_content_hash: input.facts_package.package_content_hash, record_ids: input.facts_package.record_ids, visible_sources: [{ source_id: source.source_id, label: source.label, source_url: source.url }], facts: [{ record_id: input.facts_package.record_ids[0], claim: 'Sachlicher Haupttext.' }] }]))
  const stage3Package = { package_content_hash: stage3Article.facts_package.package_content_hash, record_ids: stage3Article.facts_package.record_ids, visible_sources: [{ source_id: source.source_id, label: source.label, source_url: source.url }], facts: [{ record_id: stage3Article.facts_package.record_ids[0], claim: 'Sachlicher Haupttext.' }] }
  const writerProvenance = reviewArtifact({
    schema: 'writer_provenance.v1', provenance_id: 'writers-1', created_at: '2026-07-14T08:05:00.000Z', pipeline_lock: { lock_id: lock.lock_id, lock_hash: lock.lock_hash },
    articles: [...stage2Articles.map((input, index) => ({ stage: 'stage2', article_id: input.article_id, writer_role: 'clinical-study-interpreter', writer_execution_id: `writer-stage2-${index + 1}`, article_byte_hash: input.article_file.byte_hash, visible_payload_hash: input.visible_payload_hash, facts_package_hash: input.facts_package.package_content_hash })), { stage: 'stage3', article_id: stage3Article.article_id, writer_role: 'german-health-science-writer', writer_execution_id: 'writer-stage3-1', article_byte_hash: stage3Article.article_file.byte_hash, visible_payload_hash: stage3Article.visible_payload_hash, facts_package_hash: stage3Article.facts_package.package_content_hash }],
  }, 'writer-provenance')
  return {
    stage2Input, stage3Input, stage2ReaderChain: [readerR1, readerR2], stage3ReaderChain: [stage3ReaderR1, stage3ReaderR2], fidelityChain: [fidelityR1, fidelityR2, fidelityR3], writerProvenance,
    pipeline: { lock, factsGate: { validated_at: '2026-07-14T08:00:00.000Z' }, packages: { stage2: packages, stage3: stage3Package } }, finalizedAt: '2026-07-14T09:00:00.000Z', stage2BatchId: 'stage2-batch-1', stage3BatchId: 'stage3-batch-1', lintRunner: () => ({ issues: [], warnings: [] }),
  }
}

test('legacy v1 finalizer uses the planned Stage-2 set and writes both batches atomically', () => {
  const input = setup(), batches = finalizePublicationBatches(input)
  assert.equal(batches.stage2Batch.articles.length, 7)
  assert.equal(batches.stage3Batch.articles.length, 1)
  assert.equal(batches.stage3Batch.articles[0].reader_review.reviewed_at, '2026-07-14T08:21:00.123Z')
  const dir = mkdtempSync(join(tmpdir(), 'publication-finalizer-')), out = join(dir, 'out')
  try {
    writePublicationBatchesAtomically({ outputDir: out, batches })
    assert.equal(JSON.parse(readFileSync(join(out, 'stage2-publication-batch.v1.json'), 'utf8')).articles.length, 7)
    assert.equal(JSON.parse(readFileSync(join(out, 'stage3-publication-batch.v1.json'), 'utf8')).articles.length, 1)
  } finally { rmSync(dir, { recursive: true, force: true }) }
})

for (const count of [1, 3, 9, 12]) {
  test(`legacy v1 finalizer derives a ${count}-article Stage-2 set instead of assuming a fixed cardinality`, () => {
    const batches = finalizePublicationBatches(setup(count))
    assert.equal(batches.stage2Batch.articles.length, count)
    assert.equal(batches.stage3Batch.articles.length, 1)
  })
}

test('fails closed on stale hashes, missing writer, reviewer collision, incomplete carry-forward and false fidelity without partial output', () => {
  const cases = [
    ['stale fidelity hash', (value) => { value.fidelityChain.at(-1).value.targeted_rechecks[0].visible_payload_hash = hash('stale') }, /stale or not PASS/],
    ['missing writer', (value) => { value.writerProvenance.value.articles.pop() }, /exact planned article executions/],
    ['reviewer collision', (value) => { value.writerProvenance.value.articles[0].writer_execution_id = 'reader-1' }, /identities must be distinct/],
    ['incomplete carry-forward', (value) => { value.fidelityChain.at(-1).value.unchanged_stage2_carry_forward[0].source_set_identical_to_r2 = false }, /carry-forward.*incomplete/],
    ['false fidelity', (value) => { value.fidelityChain.at(-1).value.status = 'FAIL' }, /must PASS/],
  ]
  for (const [label, mutate, pattern] of cases) {
    const value = setup(), dir = mkdtempSync(join(tmpdir(), 'publication-finalizer-fail-')), out = join(dir, 'out')
    try { mutate(value); assert.throws(() => { const batches = finalizePublicationBatches(value); writePublicationBatchesAtomically({ outputDir: out, batches }) }, pattern, label); assert.equal(existsSync(out), false, label) }
    finally { rmSync(dir, { recursive: true, force: true }) }
  }
})
