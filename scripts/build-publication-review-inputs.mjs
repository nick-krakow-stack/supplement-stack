#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { basename, dirname, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { lintArticle, sha256Bytes } from './lib/content-validation.mjs'
import { lintVisiblePayload, validateEvidencePipelineLock } from './lib/evidence-pipeline-builder.mjs'
import { assembleStage2VisiblePayload, assembleStage3VisiblePayload } from './lib/visible-payload-assembly.mjs'
import { runNutrientContent } from './lib/nutrient-content-runner.mjs'

export { assembleStage2VisiblePayload, assembleStage3VisiblePayload } from './lib/visible-payload-assembly.mjs'

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const QUESTIONS = {
  q1: 'Würde eine außenstehende informationssuchende Person den Artikel gerne lesen und flüssig verstehen?',
  q2: 'Ist der Artikel klar und interessant aufgebaut und enthält er nur Informationen, die dem Thema und seiner sicheren Einordnung dienen?',
  q3: 'Enthält der sichtbare Text Dinge, die nur für das interne System, Rollen, Reviews, Importe oder die Pipeline relevant sind?',
}

function fail(message) { throw new Error(message) }
function read(path) { return readFileSync(path, 'utf8').replaceAll('\r\n', '\n') }
function json(path) { return JSON.parse(readFileSync(path, 'utf8')) }
function repoPath(path) { return relative(REPO_ROOT, path).replaceAll('\\', '/') }
function fileBinding(path) { return { path: repoPath(path), byte_hash: sha256Bytes(readFileSync(path)) } }
function writeJson(path, value) { writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, 'utf8') }
function lockPath(entry, mode) { return mode === 'test' && /^(?:[a-zA-Z]:[\\/]|\\\\)/.test(entry.path) ? resolve(entry.path) : resolve(REPO_ROOT, entry.path) }

function metadata(markdown) {
  return Object.fromEntries([...markdown.matchAll(/^- ([a-zA-Z0-9_]+): (.+)$/gm)].map((match) => [match[1], match[2].trim()]))
}

function sources(pkg) {
  return pkg.visible_sources.map((source) => ({ source_id: source.source_id, label: source.label, url: source.source_url }))
}

function pendingReaderReview(payloadHash) {
  return {
    status: 'pending', reviewer: { role: 'article-reader-acceptance-reviewer', id: null }, reviewed_at: null,
    visible_payload_hash: payloadHash,
    questions: Object.fromEntries(Object.entries(QUESTIONS).map(([key, question]) => [key, { question, answer: null, rationale: null }])),
  }
}

export function resolveStage3ReaderReview({ review, payloadHash }) {
  if (!review) return pendingReaderReview(payloadHash)
  if (review.schema !== 'article_reader_review.v1') fail('Stage-3 reader review must use schema article_reader_review.v1')
  if (review.status !== 'PASS') fail('Stage-3 reader review is not an accepted PASS')
  if (review.visible_payload_hash !== payloadHash) fail('Stage-3 reader review visible_payload_hash does not match the current payload')
  if (review.reviewer?.role !== 'article-reader-acceptance-reviewer' || typeof review.reviewer?.id !== 'string' || !review.reviewer.id.trim()) fail('Stage-3 reader review lacks independent reviewer provenance')
  if (typeof review.writer_id !== 'string' || !review.writer_id.trim() || review.writer_id === review.reviewer.id) fail('Stage-3 reader review is not independent from the writer')
  if (typeof review.reviewed_at !== 'string' || !review.reviewed_at.trim()) fail('Stage-3 reader review lacks reviewed_at')
  const answers = Object.fromEntries(['q1', 'q2', 'q3'].map((key) => {
    const value = review.questions?.[key]
    if (!value || typeof value.answer !== 'string' || typeof value.rationale !== 'string' || !value.rationale.trim()) fail(`Stage-3 reader review lacks ${key.toUpperCase()} evidence`)
    return [key, value.answer.trim()]
  }))
  if (!answers.q1.startsWith('Ja') || !answers.q2.startsWith('Ja') || !answers.q3.startsWith('Nein')) fail('Stage-3 reader review is not an accepted Q1/Q2/Q3 PASS')
  return review
}

function pendingReviewFields(payloadHash, packageHash) {
  return {
    writer_id: null,
    reader_review: pendingReaderReview(payloadHash),
    facts_fidelity_review: {
      status: 'pending', reviewer: { role: 'article-facts-fidelity-reviewer', id: null }, reviewed_at: null,
      visible_payload_hash: payloadHash, facts_package_hash: packageHash,
      checks: {
        numbers: { status: null, visible_tokens: null, unsupported_tokens: null },
        safety: { status: null, visible_claims: null, unsupported_claims: null },
        populations: { status: null, visible_tokens: null, unsupported_tokens: null },
        source_mapping: { status: null, visible_source_ids: null },
        unsupported_high_risk_claims: { status: null, claims: null, unsupported: null },
      },
      claim_support: null,
    },
  }
}

function lintBinding({ articlePath, type, payload, pipeline }) {
  const lint = lintArticle({
    file: articlePath, type, repoRoot: REPO_ROOT,
    coverage: lockPath(pipeline.lock.coverage_plan, pipeline.lock.mode),
    evidence: lockPath(pipeline.lock.evidence_bundle, pipeline.lock.mode),
    sourceFactsReviews: pipeline.lock.source_facts_reviews.map((entry) => lockPath(entry, pipeline.lock.mode)),
    factsCompletenessGate: lockPath(pipeline.lock.facts_gate, pipeline.lock.mode),
  })
  if (lint.issues.length) fail(`${basename(articlePath)} source-aware lint failed: ${lint.issues.map((issue) => `${issue.code}: ${issue.message}`).join('; ')}`)
  const visible = lintVisiblePayload(payload)
  if (visible.errors.length) fail(`${basename(articlePath)} visible-payload lint failed: ${visible.errors.join('; ')}`)
  return {
    payload: visible.payload,
    hash: visible.hash,
    result: {
      status: 'PASS', validator: 'content-lint.v1', visible_payload_hash: visible.hash,
      source_aware: true, issues: [], warnings: lint.warnings.map(({ code, message }) => ({ code, message })),
    },
  }
}

function buildStage2({ pilotRoot, pipeline }) {
  const articleDir = resolve(pilotRoot, 'stage2/articles')
  const packageDir = resolve(pilotRoot, 'pipeline/final/stage2-packages')
  const packageIds = Object.keys(pipeline.packages.stage2).sort()
  const byArticleId = new Map()
  for (const name of readdirSync(articleDir).filter((value) => value.endsWith('.md'))) {
    const path = resolve(articleDir, name), markdown = read(path), meta = metadata(markdown)
    const articleId = meta.coverage_article_id || basename(path, '.md')
    if (byArticleId.has(articleId)) fail(`duplicate Stage-2 article for ${articleId}`)
    byArticleId.set(articleId, { path, markdown, meta })
  }
  if (byArticleId.size !== packageIds.length || packageIds.some((id) => !byArticleId.has(id))) fail('Stage-2 article set does not exactly match locked facts packages')
  const articles = packageIds.map((articleId) => {
    const { path, markdown, meta } = byArticleId.get(articleId)
    const pkg = pipeline.packages.stage2[articleId]
    const packagePath = resolve(packageDir, `${articleId}.json`)
    const payload = assembleStage2VisiblePayload({
      slug: meta.slug || basename(path, '.md'),
      markdown,
      visibleSources: sources(pkg),
    })
    const lint = lintBinding({ articlePath: path, type: 'stage2', payload, pipeline })
    return {
      article_id: articleId, article_file: fileBinding(path), facts_package: { ...fileBinding(packagePath), package_content_hash: pkg.package_content_hash, record_ids: pkg.record_ids },
      visible_payload: lint.payload, visible_payload_hash: lint.hash, content_lint: lint.result,
      ...pendingReviewFields(lint.hash, pkg.package_content_hash),
    }
  })
  return {
    schema: 'publication_batch_review_input.v1', review_scope: 'stage2', status: 'pending_review',
    pipeline_lock: { ...fileBinding(resolve(pilotRoot, 'pipeline/final/evidence-pipeline-lock.json')), lock_id: pipeline.lock.lock_id, lock_hash: pipeline.lock.lock_hash },
    facts_gate: { gate_id: pipeline.factsGate.gate_id, gate_hash: pipeline.lock.facts_gate.gate_hash, validated_record_count: pipeline.factsGate.validated_record_ids.length },
    required_article_ids: packageIds, articles,
    reviewer_instruction: 'Complete writer identity, Q1–Q3 and every facts-fidelity field. Do not convert this input into publication_batch.v1 unless all independent checks are evidenced and PASS.',
  }
}

function buildStage3({ pilotRoot, pipeline, slug, articlePath: configuredArticlePath, readerReviewPath, historicalReaderReviewPath }) {
  const articlePath = resolve(pilotRoot, configuredArticlePath)
  const historicalReviewPath = historicalReaderReviewPath ? resolve(pilotRoot, historicalReaderReviewPath) : null
  const packagePath = resolve(pilotRoot, 'pipeline/final/facts-package-stage3.json')
  const markdown = read(articlePath), pkg = pipeline.packages.stage3
  const payload = assembleStage3VisiblePayload({ slug, markdown, visibleSources: sources(pkg) })
  const lint = lintBinding({ articlePath, type: 'stage3', payload, pipeline })
  const pending = pendingReviewFields(lint.hash, pkg.package_content_hash)
  const explicitReview = readerReviewPath ? json(resolve(readerReviewPath)) : null
  const readerReview = resolveStage3ReaderReview({ review: explicitReview, payloadHash: lint.hash })
  const historical = historicalReviewPath && existsSync(historicalReviewPath) ? {
    ...fileBinding(historicalReviewPath), status: 'historical_diff_recheck_only', accepting: false,
    note: 'This artifact reviewed only a prior local diff and carries no matching visible_payload_hash. It does not accept the current article or payload.',
  } : null
  return {
    schema: 'publication_article_review_input.v1', review_scope: 'stage3', status: 'pending_facts_fidelity_and_publication', article_id: slug,
    pipeline_lock: { ...fileBinding(resolve(pilotRoot, 'pipeline/final/evidence-pipeline-lock.json')), lock_id: pipeline.lock.lock_id, lock_hash: pipeline.lock.lock_hash },
    article_file: fileBinding(articlePath), facts_package: { ...fileBinding(packagePath), package_content_hash: pkg.package_content_hash, record_ids: pkg.record_ids },
    visible_payload: lint.payload, visible_payload_hash: lint.hash, content_lint: lint.result,
    writer_id: explicitReview?.writer_id ?? null,
    reader_review: readerReview,
    ...(readerReviewPath ? { reader_review_file: fileBinding(resolve(readerReviewPath)) } : {}),
    ...(historical ? { historical_reader_review_evidence: historical } : {}),
    facts_fidelity_review: pending.facts_fidelity_review,
    publication_decision: { status: 'pending', batch_id: null, reviewed_at: null },
    reviewer_instruction: 'Complete an independent hash-bound reader review for this exact visible_payload_hash, writer identity and the independent facts-fidelity review before any publication_batch.v1 is created.',
  }
}

export function buildPublicationReviewInputs({ pilotRoot, outputDir, stage3Slug, stage3ArticlePath, stage3ReaderReviewPath, historicalStage3ReaderReviewPath }) {
  const absolutePilotRoot = resolve(pilotRoot), out = resolve(outputDir)
  const lockFile = resolve(absolutePilotRoot, 'pipeline/final/evidence-pipeline-lock.json')
  const pipeline = validateEvidencePipelineLock({ lockPath: lockFile })
  const stage2 = buildStage2({ pilotRoot: absolutePilotRoot, pipeline })
  if (!stage3ArticlePath) fail('legacy publication review input requires an explicit stage3ArticlePath')
  const stage3 = buildStage3({ pilotRoot: absolutePilotRoot, pipeline, slug: stage3Slug, articlePath: stage3ArticlePath, readerReviewPath: stage3ReaderReviewPath, historicalReaderReviewPath: historicalStage3ReaderReviewPath })
  mkdirSync(out, { recursive: true })
  const stage2Path = resolve(out, 'stage2-publication-batch-review-input.v1.json')
  const stage3Path = resolve(out, 'stage3-publication-review-input.v1.json')
  writeJson(stage2Path, stage2); writeJson(stage3Path, stage3)
  const manifest = {
    schema: 'publication_review_input_manifest.v1', status: 'ready_for_independent_review',
    pipeline_lock: { ...fileBinding(lockFile), lock_hash: pipeline.lock.lock_hash },
    inputs: [
      { scope: 'stage2', ...fileBinding(stage2Path), schema: stage2.schema, article_count: stage2.articles.length },
      { scope: 'stage3', ...fileBinding(stage3Path), schema: stage3.schema, article_count: 1 },
    ],
    prohibited_outputs_confirmed_absent: ['publication_batch.v1', 'SQL', 'database_write'],
  }
  const manifestPath = resolve(out, 'publication-review-input-manifest.v1.json')
  writeJson(manifestPath, manifest)
  return { manifestPath, manifest, stage2, stage3 }
}

export function buildPublicationReviewInputsV2({ manifestPath, outputDir }) {
  const result = runNutrientContent({ manifestPath })
  if (!['WAITING_FOR_PUBLICATION_QA', 'READY_TO_PUBLISH', 'COMPLETE'].includes(result.state)) {
    fail(`v2 run is not ready for publication QA: ${result.state}`)
  }
  const qaOrders = result.work_orders.filter((entry) => entry.kind === 'publication_qa')
  const value = {
    schema: 'publication_review_input_manifest.v2', run_id: result.run_id,
    manifest_hash: result.manifest_hash, state: result.state,
    article_count: qaOrders.length, articles: qaOrders,
    note: qaOrders.length ? 'Every listed article needs a complete independent article_publication_review.v2.' : 'No publication QA work remains for the current hashes.',
  }
  const path = resolve(outputDir, 'publication-review-input-manifest.v2.json')
  mkdirSync(dirname(path), { recursive: true })
  writeJson(path, value)
  return { manifestPath: path, manifest: value, state: result.state }
}

function args(argv) {
  const parsed = {}
  for (let index = 0; index < argv.length; index += 1) {
    const key = argv[index]
    if (key === '--pilot-root') parsed.pilotRoot = argv[++index]
    else if (key === '--manifest') parsed.manifestPath = argv[++index]
    else if (key === '--out') parsed.outputDir = argv[++index]
    else if (key === '--stage3-slug') parsed.stage3Slug = argv[++index]
    else if (key === '--stage3-article') parsed.stage3ArticlePath = argv[++index]
    else if (key === '--stage3-reader-review') parsed.stage3ReaderReviewPath = argv[++index]
    else if (key === '--historical-stage3-reader-review') parsed.historicalStage3ReaderReviewPath = argv[++index]
    else fail(`unknown argument ${key}`)
  }
  if (parsed.manifestPath) {
    if (!parsed.outputDir || parsed.pilotRoot || parsed.stage3Slug || parsed.stage3ArticlePath) fail('usage: --manifest <nutrient_content_run.v2.json> --out <dir>')
    return parsed
  }
  if (!parsed.pilotRoot || !parsed.outputDir || !parsed.stage3Slug || !parsed.stage3ArticlePath) fail('legacy usage: --pilot-root <dir> --out <dir> --stage3-slug <slug> --stage3-article <file>')
  return parsed
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const parsed = args(process.argv.slice(2))
    const result = parsed.manifestPath ? buildPublicationReviewInputsV2(parsed) : buildPublicationReviewInputs(parsed)
    console.log(JSON.stringify(parsed.manifestPath
      ? { status: 'PASS', schema: result.manifest.schema, state: result.state, manifest: repoPath(result.manifestPath), article_count: result.manifest.article_count }
      : { status: 'PASS', manifest: repoPath(result.manifestPath), stage2_articles: result.stage2.articles.length, stage3_articles: 1 }, null, 2))
  } catch (error) { console.error(error.message); process.exit(1) }
}
