#!/usr/bin/env node
import { existsSync, mkdirSync, mkdtempSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs'
import { basename, dirname, isAbsolute, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { lintArticle, sha256Bytes } from './lib/content-validation.mjs'
import { derivePublicationFidelitySignals, lintVisiblePayload, validateEvidencePipelineLock, validatePublicationBatch } from './lib/evidence-pipeline-builder.mjs'
import { runNutrientContent } from './lib/nutrient-content-runner.mjs'

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')

function fail(message) { throw new Error(message) }
function object(value, label) { if (!value || typeof value !== 'object' || Array.isArray(value)) fail(`${label} must be an object`); return value }
function text(value, label) { if (typeof value !== 'string' || !value.trim()) fail(`${label} must be a non-empty string`); return value.trim() }
function uniqueIds(values, label) {
  if (!Array.isArray(values)) fail(`${label} must be an array`)
  const ids = values.map((entry, index) => text(entry.article_id, `${label}[${index}].article_id`))
  if (new Set(ids).size !== ids.length) fail(`${label} article IDs must be unique`)
  return ids
}
function canonicalTime(value, label) {
  const raw = text(value, label), time = Date.parse(raw)
  if (!Number.isFinite(time)) fail(`${label} must be ISO-8601 UTC`)
  return new Date(time).toISOString()
}
function strictFinalizedAt(value) {
  const canonical = canonicalTime(value, 'finalized_at')
  if (canonical !== value) fail('finalized_at must use canonical ISO-8601 UTC milliseconds')
  return canonical
}
function sameSet(left, right) { return left.size === right.size && [...left].every((value) => right.has(value)) }
function artifact(value, path = '(memory)', byteHash = null) { return { value, path, byte_hash: byteHash ?? sha256Bytes(Buffer.from(JSON.stringify(value))) } }
function reviewResult(value) { return value?.result ?? value?.overall?.result ?? value?.status ?? value?.summary?.overall }
function question(value, key) { const answer = value?.questions?.[key]; return typeof answer === 'string' ? answer.trim() : String(answer?.answer ?? '').trim() }
function articleEntries(review) { return [...(review.articles ?? []), ...(review.targeted_rechecks ?? []), ...(review.unchanged_stage2_carry_forward ?? [])] }
function reviewArticle(review, articleId) { return articleEntries(review).find((entry) => entry.article_id === articleId) }
function allProofFlagsTrue(proof, label) {
  object(proof, label)
  const flags = Object.entries(proof).filter(([, value]) => typeof value === 'boolean')
  if (!flags.length || flags.some(([, value]) => value !== true)) fail(`${label} carry-forward proof is incomplete`)
}

function validateReviewChain(chain, label, linkKeys) {
  if (!Array.isArray(chain) || !chain.length) fail(`${label} review chain must not be empty`)
  for (let index = 0; index < chain.length; index += 1) {
    const current = chain[index]
    object(current.value, `${label} review ${index + 1}`)
    text(current.value.review_id, `${label} review_id`)
    const currentTime = Date.parse(canonicalTime(current.value.reviewed_at, `${label} reviewed_at`))
    if (index === 0) continue
    const priorTime = Date.parse(canonicalTime(chain[index - 1].value.reviewed_at, `${label} prior reviewed_at`))
    if (currentTime <= priorTime) fail(`${label} review chain timestamps are not strictly increasing`)
    const link = linkKeys.map((key) => current.value[key]).find(Boolean)
    if (!link || link.byte_hash !== chain[index - 1].byte_hash) fail(`${label} review chain has an incomplete or stale carry-forward link at position ${index + 1}`)
    if (link.review_id != null && link.review_id !== chain[index - 1].value.review_id) fail(`${label} review chain names the wrong prior review at position ${index + 1}`)
    if (link.review_id == null && typeof link.path !== 'string') fail(`${label} review chain lacks prior review provenance at position ${index + 1}`)
  }
}

function validateReaderChains({ stage2, stage3, stage2Input, stage3Input, lock }) {
  validateReviewChain(stage2, 'Stage-2 reader', ['prior_review_binding', 'prior_review_comparison'])
  validateReviewChain(stage3, 'Stage-3 reader', ['prior_review_binding', 'prior_review_comparison'])
  const final2 = stage2.at(-1).value, final3 = stage3.at(-1).value
  for (const [review, input, inputArtifact, label] of [[final2, stage2Input.value, stage2Input, 'Stage-2'], [final3, stage3Input.value, stage3Input, 'Stage-3']]) {
    if (review.input_binding?.byte_hash !== inputArtifact.byte_hash || review.input_binding?.pipeline_lock_id !== lock.lock_id || review.input_binding?.pipeline_lock_hash !== lock.lock_hash) fail(`${label} reader review is not bound to the final input and pipeline lock`)
    if (review.reviewer?.role !== 'article-reader-acceptance-reviewer') fail(`${label} reader reviewer role is invalid`)
    text(review.reviewer?.id, `${label} reader reviewer id`)
    if (reviewResult(review) !== 'PASS') fail(`${label} final reader review must PASS`)
  }
  const input2ById = new Map(stage2Input.value.articles.map((entry) => [entry.article_id, entry]))
  const entries2 = final2.articles ?? []
  if (entries2.length !== input2ById.size || !sameSet(new Set(entries2.map((entry) => entry.article_id)), new Set(input2ById.keys()))) fail('Stage-2 final reader review must cover the exact planned article set')
  for (const entry of entries2) {
    const input = input2ById.get(entry.article_id)
    if (!input || entry.visible_payload_hash !== input.visible_payload_hash || entry.result !== 'PASS' || question(entry, 'q1') !== 'Ja' || question(entry, 'q2') !== 'Ja' || question(entry, 'q3') !== 'Nein') fail(`Stage-2 reader result for ${entry.article_id} is stale or not PASS`)
    if (/inherited/i.test(entry.review_provenance ?? '')) {
      const prior = reviewArticle(stage2.at(-2)?.value, entry.article_id)
      if (!prior || prior.visible_payload_hash !== entry.visible_payload_hash || reviewResult(prior) !== 'PASS') fail(`Stage-2 reader carry-forward for ${entry.article_id} is incomplete`)
    }
  }
  const binding3 = final3.article_binding
  if (binding3?.article_id !== stage3Input.value.article_id || binding3?.visible_payload_hash !== stage3Input.value.visible_payload_hash || question(final3, 'q1') !== 'Ja' || question(final3, 'q2') !== 'Ja' || question(final3, 'q3') !== 'Nein') fail('Stage-3 reader result is stale or not PASS')
  return { stage2: final2, stage3: final3 }
}

function validateFidelityChain({ chain, stage2Input, stage3Input, lock }) {
  validateReviewChain(chain, 'Fidelity', ['recheck_of'])
  for (let index = 1; index < chain.length; index += 1) {
    const review = chain[index].value, prior = chain[index - 1].value
    for (const entry of articleEntries(review).filter((value) => /carried_forward/i.test(value.recheck_mode ?? ''))) {
      const proof = entry.assembly_proof ?? review.assembly_carry_forward_proof?.find((value) => value.article_id === entry.article_id)
      allProofFlagsTrue(proof, `Fidelity ${entry.article_id}`)
      if (!reviewArticle(prior, entry.article_id) || reviewResult(reviewArticle(prior, entry.article_id)) !== 'PASS') fail(`Fidelity carry-forward for ${entry.article_id} lacks a prior PASS`)
    }
  }
  const final = chain.at(-1).value
  if (final.schema !== 'publication_facts_fidelity_review.v1' || final.status !== 'PASS' || final.summary?.overall !== 'PASS') fail('final independent fidelity review must PASS')
  if (final.reviewer?.role !== 'article-facts-fidelity-reviewer') fail('final fidelity reviewer role is invalid')
  text(final.reviewer?.id, 'final fidelity reviewer id')
  if (final.input_bindings?.stage2_review_input?.byte_hash !== stage2Input.byte_hash || final.input_bindings?.stage3_review_input?.byte_hash !== stage3Input.byte_hash) fail('final fidelity review input bindings are stale')
  const expected = new Map([...stage2Input.value.articles, stage3Input.value].map((entry) => [entry.article_id, entry]))
  const entries = articleEntries(final)
  if (entries.length !== expected.size || !sameSet(new Set(entries.map((entry) => entry.article_id)), new Set(expected.keys()))) fail('final fidelity review must resolve the exact planned article set')
  const resolvedEntries = []
  for (const entry of entries) {
    const input = expected.get(entry.article_id)
    if (!input || entry.visible_payload_hash !== input.visible_payload_hash || entry.facts_package_hash !== input.facts_package.package_content_hash || entry.result !== 'PASS') fail(`final fidelity result for ${entry.article_id} is stale or not PASS`)
    let resolved = entry
    if ((final.unchanged_stage2_carry_forward ?? []).includes(entry)) {
      if (entry.source_set_identical_to_r2 !== true) fail(`final fidelity carry-forward for ${entry.article_id} is incomplete`)
      const prior = reviewArticle(chain.at(-2)?.value, entry.article_id)
      if (!prior || prior.visible_payload_hash !== entry.visible_payload_hash || prior.facts_package_hash !== entry.facts_package_hash || reviewResult(prior) !== 'PASS') fail(`final fidelity carry-forward for ${entry.article_id} lacks an exact prior PASS`)
      resolved = { ...prior, ...entry, checks: prior.checks, claim_support: prior.claim_support ?? [] }
    }
    if (/carried_forward/i.test(entry.recheck_mode ?? '')) allProofFlagsTrue(entry.assembly_proof, `final fidelity ${entry.article_id}`)
    for (const key of ['numbers', 'safety', 'populations', 'source_mapping', 'high_risk_claims', 'other_factual_claims']) if (resolved.checks?.[key]?.status !== 'PASS') fail(`final fidelity result for ${entry.article_id} lacks ${key} PASS`)
    resolvedEntries.push(resolved)
  }
  return { review: final, byArticleId: new Map(resolvedEntries.map((entry) => [entry.article_id, entry])) }
}

function validateWriterProvenance({ provenance, inputs, stageByArticleId, lock }) {
  if (provenance.schema !== 'writer_provenance.v1') fail('writer provenance must use schema writer_provenance.v1')
  text(provenance.provenance_id, 'writer provenance provenance_id')
  canonicalTime(provenance.created_at, 'writer provenance created_at')
  if (provenance.pipeline_lock?.lock_id !== lock.lock_id || provenance.pipeline_lock?.lock_hash !== lock.lock_hash) fail('writer provenance pipeline lock binding is stale')
  const expected = new Map(inputs.map((entry) => [entry.article_id, entry]))
  const entries = provenance.articles
  if (!Array.isArray(entries) || entries.length !== expected.size || !sameSet(new Set(entries.map((entry) => entry.article_id)), new Set(expected.keys()))) fail('writer provenance must contain the exact planned article executions')
  const result = new Map()
  for (const entry of entries) {
    const input = expected.get(entry.article_id)
    if (!input || entry.stage !== stageByArticleId.get(entry.article_id)) fail(`writer provenance has unknown or wrongly scoped article ${entry.article_id}`)
    const writerId = text(entry.writer_execution_id, `writer provenance ${entry.article_id}.writer_execution_id`)
    const expectedRole = entry.stage === 'stage2' ? 'clinical-study-interpreter' : 'german-health-science-writer'
    if (entry.writer_role !== expectedRole || entry.article_byte_hash !== input.article_file.byte_hash || entry.visible_payload_hash !== input.visible_payload_hash || entry.facts_package_hash !== input.facts_package.package_content_hash) fail(`writer provenance binding for ${entry.article_id} is stale`)
    result.set(entry.article_id, writerId)
  }
  return result
}

function normalizedClaimSupport(entry) {
  const values = entry.claim_support ?? []
  if (!Array.isArray(values)) fail(`fidelity claim_support for ${entry.article_id} must be an array`)
  return values.map((value) => ({ visible_claim: text(value.visible_claim, 'claim_support.visible_claim'), record_ids: [...new Set(value.record_ids ?? [])].sort() })).sort((a, b) => a.visible_claim.localeCompare(b.visible_claim))
}

export function finalizePublicationBatches({ stage2Input, stage3Input, stage2ReaderChain, stage3ReaderChain, fidelityChain, writerProvenance, pipeline, finalizedAt, stage2BatchId, stage3BatchId, lintRunner }) {
  const finalTime = strictFinalizedAt(finalizedAt)
  if (stage2Input.value.schema !== 'publication_batch_review_input.v1' || stage2Input.value.review_scope !== 'stage2') fail('Stage-2 review input schema or scope is invalid')
  if (stage3Input.value.schema !== 'publication_article_review_input.v1' || stage3Input.value.review_scope !== 'stage3') fail('Stage-3 review input schema or scope is invalid')
  const stage2Ids = uniqueIds(stage2Input.value.articles, 'Stage-2 review input articles')
  uniqueIds([stage3Input.value], 'Stage-3 review input articles')
  if (!sameSet(new Set(stage2Ids), new Set(stage2Input.value.required_article_ids ?? []))) fail('Stage-2 required article IDs differ from the review articles')
  for (const input of [stage2Input.value, stage3Input.value]) if (input.pipeline_lock?.lock_id !== pipeline.lock.lock_id || input.pipeline_lock?.lock_hash !== pipeline.lock.lock_hash) fail('review input pipeline lock binding is stale')
  const inputs = [...stage2Input.value.articles, stage3Input.value]
  const stageByArticleId = new Map([...stage2Input.value.articles.map((entry) => [entry.article_id, 'stage2']), [stage3Input.value.article_id, 'stage3']])
  const writers = validateWriterProvenance({ provenance: writerProvenance.value, inputs, stageByArticleId, lock: pipeline.lock })
  const readers = validateReaderChains({ stage2: stage2ReaderChain, stage3: stage3ReaderChain, stage2Input, stage3Input, lock: pipeline.lock })
  const fidelity = validateFidelityChain({ chain: fidelityChain, stage2Input, stage3Input, lock: pipeline.lock })
  const readerById = new Map(readers.stage2.articles.map((entry) => [entry.article_id, entry])); readerById.set(stage3Input.value.article_id, readers.stage3)
  const buildArticle = (input, stage) => {
    const pkg = stage === 'stage2' ? pipeline.packages.stage2[input.article_id] : pipeline.packages.stage3
    if (!pkg || pkg.package_content_hash !== input.facts_package.package_content_hash || !sameSet(new Set(pkg.record_ids), new Set(input.facts_package.record_ids))) fail(`${input.article_id} facts package differs from the pipeline lock`)
    const visible = lintVisiblePayload(input.visible_payload)
    if (visible.errors.length || visible.hash !== input.visible_payload_hash) fail(`${input.article_id} visible payload is stale or fails content lint`)
    const lint = lintRunner(input, stage)
    if (!lint || !Array.isArray(lint.issues) || lint.issues.length) fail(`${input.article_id} source-aware content lint failed${lint?.issues?.length ? `: ${lint.issues.map((entry) => entry.code ?? entry.message).join(', ')}` : ''}`)
    const reader = readerById.get(input.article_id), fidelityEntry = fidelity.byArticleId.get(input.article_id)
    const writerId = writers.get(input.article_id), readerId = text((stage === 'stage2' ? readers.stage2 : readers.stage3).reviewer.id, `${stage} reader id`), fidelityId = text(fidelity.review.reviewer.id, 'fidelity reviewer id')
    if (new Set([writerId, readerId, fidelityId]).size !== 3) fail(`${input.article_id} writer, reader and fidelity reviewer identities must be distinct`)
    const signals = derivePublicationFidelitySignals({ visiblePayload: visible.payload, facts: pkg.facts })
    if (signals.unsupported_numbers.length || signals.unsupported_populations.length) fail(`${input.article_id} has mechanically unsupported fidelity signals`)
    const claimSupport = normalizedClaimSupport(fidelityEntry)
    if (signals.affirmative_high_risk_claims.length && !signals.affirmative_high_risk_claims.every((claim) => claimSupport.some((entry) => entry.visible_claim === claim))) fail(`${input.article_id} high-risk claim lacks independent claim_support`)
    return {
      article_id: input.article_id, writer_id: writerId, visible_payload_hash: visible.hash, facts_package_hash: pkg.package_content_hash,
      content_lint: { status: 'PASS', validator: 'content-lint.v1', validated_at: finalTime, visible_payload_hash: visible.hash, source_aware: true, issues: [], warnings: (lint.warnings ?? []).map(({ code, message }) => ({ code, message })) },
      reader_review: { status: reader.result ?? reviewResult(stage === 'stage2' ? readers.stage2 : readers.stage3), q1: question(reader, 'q1'), q2: question(reader, 'q2'), q3: question(reader, 'q3'), reviewer: { role: 'article-reader-acceptance-reviewer', id: readerId }, reviewed_at: canonicalTime((stage === 'stage2' ? readers.stage2 : readers.stage3).reviewed_at, `${input.article_id} reader reviewed_at`), visible_payload_hash: visible.hash },
      facts_fidelity_review: {
        status: fidelityEntry.result, reviewer: { role: 'article-facts-fidelity-reviewer', id: fidelityId }, reviewed_at: canonicalTime(fidelity.review.reviewed_at, 'fidelity reviewed_at'), visible_payload_hash: visible.hash, facts_package_hash: pkg.package_content_hash,
        checks: {
          numbers: { status: fidelityEntry.checks.numbers.status, visible_tokens: signals.visible_numbers, unsupported_tokens: signals.unsupported_numbers },
          safety: { status: fidelityEntry.checks.safety.status, visible_claims: signals.affirmative_high_risk_claims, unsupported_claims: [] },
          populations: { status: fidelityEntry.checks.populations.status, visible_tokens: signals.visible_populations, unsupported_tokens: signals.unsupported_populations },
          source_mapping: { status: fidelityEntry.checks.source_mapping.status, visible_source_ids: visible.payload.sources.map((source) => source.source_id) },
          unsupported_high_risk_claims: { status: fidelityEntry.checks.high_risk_claims.status, claims: signals.affirmative_high_risk_claims, unsupported: [] },
        },
        claim_support: claimSupport,
      },
    }
  }
  const stage2Batch = { schema: 'publication_batch.v1', batch_id: text(stage2BatchId, 'stage2_batch_id'), reviewed_at: finalTime, articles: stage2Input.value.articles.map((input) => buildArticle(input, 'stage2')) }
  const stage3Batch = { schema: 'publication_batch.v1', batch_id: text(stage3BatchId, 'stage3_batch_id'), reviewed_at: finalTime, articles: [buildArticle(stage3Input.value, 'stage3')] }
  validatePublicationBatch({ batch: stage2Batch, visiblePayloads: Object.fromEntries(stage2Input.value.articles.map((entry) => [entry.article_id, entry.visible_payload])), factsPackages: pipeline.packages.stage2, factsGate: pipeline.factsGate, pipelineLock: pipeline.lock })
  validatePublicationBatch({ batch: stage3Batch, visiblePayloads: { [stage3Input.value.article_id]: stage3Input.value.visible_payload }, factsPackages: { [stage3Input.value.article_id]: pipeline.packages.stage3 }, factsGate: pipeline.factsGate, pipelineLock: pipeline.lock })
  return { stage2Batch, stage3Batch }
}

export function writePublicationBatchesAtomically({ outputDir, batches }) {
  const out = resolve(outputDir)
  if (existsSync(out)) fail(`output directory already exists: ${out}`)
  mkdirSync(dirname(out), { recursive: true })
  const temp = mkdtempSync(resolve(dirname(out), `.${basename(out)}.tmp-`))
  try {
    writeFileSync(resolve(temp, 'stage2-publication-batch.v1.json'), `${JSON.stringify(batches.stage2Batch, null, 2)}\n`, 'utf8')
    writeFileSync(resolve(temp, 'stage3-publication-batch.v1.json'), `${JSON.stringify(batches.stage3Batch, null, 2)}\n`, 'utf8')
    renameSync(temp, out)
  } catch (error) {
    rmSync(temp, { recursive: true, force: true })
    throw error
  }
  return out
}

function readArtifact(path, label) {
  const absolute = resolve(path)
  if (!existsSync(absolute)) fail(`${label} file does not exist: ${absolute}`)
  const bytes = readFileSync(absolute)
  let value
  try { value = JSON.parse(bytes.toString('utf8')) } catch (error) { fail(`${label} is invalid JSON: ${error.message}`) }
  return artifact(value, absolute, sha256Bytes(bytes))
}
function repoFile(path) { const absolute = resolve(path); const rel = relative(REPO_ROOT, absolute); if (rel.startsWith('..') || isAbsolute(rel)) fail(`path escapes repository: ${path}`); return absolute }
function verifyBoundFile(binding, label) { const path = repoFile(text(binding?.path, `${label}.path`)); if (!existsSync(path) || sha256Bytes(readFileSync(path)) !== binding.byte_hash) fail(`${label} bytes are stale`); return path }
function lockFile(entry, mode) { return mode === 'test' && isAbsolute(entry.path) ? resolve(entry.path) : repoFile(entry.path) }

function parseArgs(argv) {
  if (argv.includes('--manifest')) {
    if (argv.length !== 2 || argv[0] !== '--manifest' || !argv[1] || argv[1].startsWith('--')) fail('v2 usage: --manifest <nutrient_content_run.v2.json>')
    return { manifestPath: argv[1] }
  }
  const args = { stage2ReaderReviews: [], stage3ReaderReviews: [], fidelityReviews: [] }
  const many = { '--stage2-reader-review': 'stage2ReaderReviews', '--stage3-reader-review': 'stage3ReaderReviews', '--fidelity-review': 'fidelityReviews' }
  const one = { '--stage2-input': 'stage2Input', '--stage3-input': 'stage3Input', '--pipeline-lock': 'pipelineLock', '--writer-provenance': 'writerProvenance', '--out': 'outputDir', '--finalized-at': 'finalizedAt', '--stage2-batch-id': 'stage2BatchId', '--stage3-batch-id': 'stage3BatchId' }
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index], key = many[token] ?? one[token], value = argv[++index]
    if (!key || !value || value.startsWith('--')) fail(`unknown or incomplete argument ${token}`)
    if (many[token]) args[key].push(value); else args[key] = value
  }
  for (const key of [...Object.values(one), ...Object.values(many)]) if (!args[key] || (Array.isArray(args[key]) && !args[key].length)) fail('all publication finalizer inputs, review chains, batch IDs, finalized_at and --out are required')
  return args
}

export function finalizeContentReleaseV2({ manifestPath }) {
  const result = runNutrientContent({ manifestPath })
  if (!['READY_TO_PUBLISH', 'COMPLETE'].includes(result.state)) fail(`content release is not finalizable: ${result.state}`)
  return result
}

export function runPublicationFinalizer(args) {
  const writerProvenance = readArtifact(args.writerProvenance, 'writer_provenance.v1')
  const stage2Input = readArtifact(args.stage2Input, 'Stage-2 review input'), stage3Input = readArtifact(args.stage3Input, 'Stage-3 review input')
  const pipelineLockPath = resolve(args.pipelineLock), pipeline = validateEvidencePipelineLock({ lockPath: pipelineLockPath })
  if (stage2Input.value.pipeline_lock?.byte_hash !== sha256Bytes(readFileSync(pipelineLockPath)) || stage3Input.value.pipeline_lock?.byte_hash !== sha256Bytes(readFileSync(pipelineLockPath))) fail('review inputs do not bind the supplied pipeline-lock bytes')
  for (const input of [...stage2Input.value.articles, stage3Input.value]) { verifyBoundFile(input.article_file, `${input.article_id} article`); verifyBoundFile(input.facts_package, `${input.article_id} facts package`) }
  const stage2ReaderChain = args.stage2ReaderReviews.map((path) => readArtifact(path, 'Stage-2 reader review'))
  const stage3ReaderChain = args.stage3ReaderReviews.map((path) => readArtifact(path, 'Stage-3 reader review'))
  const fidelityChain = args.fidelityReviews.map((path) => readArtifact(path, 'fidelity review'))
  const lintRunner = (input, stage) => lintArticle({ file: repoFile(input.article_file.path), type: stage, repoRoot: REPO_ROOT, coverage: lockFile(pipeline.lock.coverage_plan, pipeline.lock.mode), evidence: lockFile(pipeline.lock.evidence_bundle, pipeline.lock.mode), sourceFactsReviews: pipeline.lock.source_facts_reviews.map((entry) => lockFile(entry, pipeline.lock.mode)), factsCompletenessGate: lockFile(pipeline.lock.facts_gate, pipeline.lock.mode) })
  const batches = finalizePublicationBatches({ stage2Input, stage3Input, stage2ReaderChain, stage3ReaderChain, fidelityChain, writerProvenance, pipeline, finalizedAt: args.finalizedAt, stage2BatchId: args.stage2BatchId, stage3BatchId: args.stage3BatchId, lintRunner })
  return { outputDir: writePublicationBatchesAtomically({ outputDir: args.outputDir, batches }), batches }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const parsed = parseArgs(process.argv.slice(2))
    if (parsed.manifestPath) {
      const result = finalizeContentReleaseV2(parsed)
      console.log(JSON.stringify({ status: 'PASS', schema: result.schema, state: result.state, release: result.release, published: result.published }, null, 2))
    } else {
      const result = runPublicationFinalizer(parsed)
      console.log(JSON.stringify({ status: 'PASS', output_dir: result.outputDir, stage2_articles: result.batches.stage2Batch.articles.length, stage3_articles: result.batches.stage3Batch.articles.length }, null, 2))
    }
  } catch (error) {
    console.error(JSON.stringify({ status: 'BLOCKED', reason: error.message, outputs_written: false }, null, 2))
    process.exit(1)
  }
}
