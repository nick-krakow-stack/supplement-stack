import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { lintArticle, validateEvidenceBundle } from './lib/content-validation.mjs'
import { validateEvidencePipelineLock, validatePublicationBatch, visiblePayloadHash } from './lib/evidence-pipeline-builder.mjs'
import { assembleStage3VisiblePayload, assertVisibleFieldMatches } from './lib/visible-payload-assembly.mjs'

export function buildKnowledgeMagazineImport({ markdownPath, metaPath, legacyDryRun = false }) {
  const articlePath = resolve(markdownPath)
  const absoluteMetaPath = resolve(metaPath)
  const authoringMarkdown = readFileSync(articlePath, 'utf8').trim()
  const meta = readJson(absoluteMetaPath)
  const baseDir = dirname(absoluteMetaPath)

  if (legacyDryRun) return buildLegacyReport({ articlePath, absoluteMetaPath, body: authoringMarkdown, meta })
  if (!['stage3_article_import.v1', 'stage3_article_import.v2'].includes(meta.schema)) throw new Error('meta.schema must equal stage3_article_import.v1 or v2')

  const slug = nonEmpty(meta.slug, 'meta.slug')
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) throw new Error('meta.slug is invalid')
  const ingredientId = positiveInteger(meta.ingredient_id)
  if (!ingredientId) throw new Error('meta.ingredient_id must be a positive integer')
  let title = nonEmpty(meta.title, 'meta.title')
  let summary = nonEmpty(meta.summary, 'meta.summary')
  let conclusion = nonEmpty(meta.conclusion, 'meta.conclusion')
  let persistedConclusion = conclusion
  let body = authoringMarkdown
  if (!authoringMarkdown) throw new Error('article body is empty')

  if (meta.schema === 'stage3_article_import.v2' && !meta.pipeline_lock_path) throw new Error('stage3_article_import.v2 pipeline_lock_path is required')
  const pipeline = meta.schema === 'stage3_article_import.v2'
    ? validateEvidencePipelineLock({ lockPath: resolveInput(baseDir, meta.pipeline_lock_path), allowTest: meta.allow_test_pipeline_lock === true })
    : null
  const coveragePlan = pipeline?.coveragePlan ?? loadRequiredArtifact(baseDir, meta.coverage_plan_path, 'coverage_plan.v1')
  const evidenceBundle = pipeline?.evidenceBundle ?? loadRequiredArtifact(baseDir, meta.source_evidence_bundle_path, 'source_evidence_bundle.v1')
  const reviewPaths = Array.isArray(meta.source_facts_review_paths) ? meta.source_facts_review_paths : [meta.source_facts_review_path].filter(Boolean)
  if (!pipeline && !reviewPaths.length) throw new Error('source_facts_review.v1 path is required')
  const sourceFactsReviews = pipeline?.sourceFactsReviews ?? reviewPaths.map((path) => loadRequiredArtifact(baseDir, path, 'source_facts_review.v1'))
  const factsGate = pipeline?.factsGate ?? loadRequiredArtifact(baseDir, meta.facts_completeness_gate_path, 'facts_completeness_gate.v1')
  const sourceArtifacts = pipeline?.sourceArtifacts ?? loadSourceArtifacts(baseDir, meta.source_artifacts)
  if (coveragePlan.stage3_archetype_decision?.status !== 'approved') {
    throw new Error('Stage 3 requires an approved stage3_archetype_decision')
  }

  const evidenceIssues = pipeline ? [] : validateEvidenceBundle({
    coveragePlan,
    evidenceBundle,
    evidenceRecords: evidenceBundle.records,
    sourceFactsReviews,
    factsCompletenessGate: factsGate,
    sourceArtifacts,
    file: absoluteMetaPath,
  })
  if (evidenceIssues.length) throw new Error(`Facts Gate failed: ${formatIssues(evidenceIssues)}`)
  assertGateBindings({ coveragePlan, evidenceBundle, sourceFactsReviews, factsGate })

  const relations = normalizeRelations(meta.source_relations)
  if (!relations.length) throw new Error('meta.source_relations must contain at least one source')
  assertRelationCoverage(relations, coveragePlan, evidenceBundle)

  const visibleSources = relations.map((relation) => ({ source_id: relation.sourceKey, label: relation.label, url: relation.url }))
  let visiblePayload
  if (meta.schema === 'stage3_article_import.v2') {
    visiblePayload = assembleStage3VisiblePayload({ slug, markdown: authoringMarkdown, visibleSources })
    assertVisibleFieldMatches(meta.title, visiblePayload.title, 'meta.title')
    assertVisibleFieldMatches(meta.summary, visiblePayload.summary, 'meta.summary')
    assertVisibleFieldMatches(meta.conclusion, visiblePayload.conclusion, 'meta.conclusion')
    ;({ title, summary, body, conclusion } = visiblePayload)
    persistedConclusion = null
  } else {
    visiblePayload = { slug, title, summary, body, conclusion, sources: visibleSources }
  }
  const articleHash = meta.schema === 'stage3_article_import.v2'
    ? normalizeHash(visiblePayloadHash(visiblePayload))
    : visibleArticlePayloadHash({ slug, title, summary, body, conclusion, relations })
  const lintResult = lintArticle({ file: articlePath, type: 'stage3' })
  if (lintResult.issues.length) throw new Error(`Content-Lint failed: ${formatIssues(lintResult.issues)}`)
  if (meta.schema !== 'stage3_article_import.v2') throw new Error('accepted Stage-3 publication requires stage3_article_import.v2 facts package and publication_batch.v1')
  const factsPackage = pipeline.packages.stage3
  const publicationBatch = loadRequiredArtifact(baseDir, meta.publication_batch_path, 'publication_batch.v1')
  const publication = validatePublicationBatch({ batch: publicationBatch, visiblePayloads: { [slug]: visiblePayload }, factsPackages: { [slug]: factsPackage }, factsGate, pipelineLock: pipeline.lock })
  const writeGuard = normalizeWriteGuard(meta.write_guard, baseDir)

  const article = {
    slug, ingredientId, title, summary, conclusion: persistedConclusion, body, relations, articleHash,
    reviewedAt: publication.reviewed_at, reviewId: publication.batch_id, writeGuard,
    provenance: JSON.stringify({
      schema: 'stage3_publication_provenance.v1',
      coverage_plan_id: coveragePlan.coverage_plan_id,
      coverage_plan_hash: coveragePlan.content_hash,
      evidence_bundle_id: evidenceBundle.bundle_id,
      evidence_bundle_content_hash: evidenceBundle.content_hash,
      source_facts_review_ids: sourceFactsReviews.map((review) => review.review_id),
      facts_completeness_gate_id: factsGate.gate_id,
      publication_batch_id: publication.batch_id,
      evidence_pipeline_lock_id: pipeline.lock.lock_id,
    }),
  }
  return {
    sql: `${articleSql(article)}\n`,
    report: {
      schema: 'stage3_import_report.v1', status: 'ready', slug, article_hash: `sha256:${articleHash}`,
      content_lint: 'PASS', stage3_5: 'PASS', facts_gate: 'PASS', write_guard: writeGuard.mode,
      conclusion_storage: 'body',
    },
  }
}

function buildLegacyReport({ articlePath, absoluteMetaPath, body, meta }) {
  const lintResult = lintArticle({ file: articlePath, type: 'stage3' })
  if (lintResult.issues.length) throw new Error(`Legacy dry-run Content-Lint failed: ${formatIssues(lintResult.issues)}`)
  return {
    sql: null,
    report: {
      schema: 'stage3_legacy_dry_run_report.v1', status: 'legacy_unpublishable',
      article: articlePath, meta: absoluteMetaPath, slug: meta.slug ?? null,
      body_bytes: Buffer.byteLength(body, 'utf8'), reason: 'missing canonical Facts Gate and Stage 3.5 publication contract',
    },
  }
}

function assertGateBindings({ coveragePlan, evidenceBundle, sourceFactsReviews, factsGate }) {
  if (sourceFactsReviews.some((review) => review.status !== 'pass')) throw new Error('source_facts_review.v1 must have status=pass')
  if (factsGate.status !== 'pass') throw new Error('facts_completeness_gate.v1 must have status=pass')
  if (sourceFactsReviews.some((review) => review.bundle_id !== evidenceBundle.bundle_id || review.bundle_content_hash !== evidenceBundle.content_hash)) {
    throw new Error('source facts review is not bound to the supplied evidence bundle')
  }
  if (factsGate.coverage_plan_id !== coveragePlan.coverage_plan_id || factsGate.coverage_plan_hash !== coveragePlan.content_hash) {
    throw new Error('Facts Gate is not bound to the supplied coverage plan')
  }
  if (factsGate.evidence_bundle_id !== evidenceBundle.bundle_id || factsGate.evidence_bundle_content_hash !== evidenceBundle.content_hash) {
    throw new Error('Facts Gate is not bound to the supplied evidence bundle')
  }
  if (!sameSet(sourceFactsReviews.map((review) => review.review_id), factsGate.source_facts_review_ids)) throw new Error('Facts Gate references a different source facts review')
  const recordIds = evidenceBundle.records.map((record) => String(record.record_id))
  if (!sameSet(recordIds, factsGate.required_record_ids) || !sameSet(recordIds, factsGate.validated_record_ids)) {
    throw new Error('Facts Gate required/validated record sets must exactly match the evidence bundle')
  }
  const checks = ['exact_record_set', 'schema', 'crossrefs', 'hashes', 'professional_approvals', 'required_clusters']
  for (const check of checks) if (factsGate.checks?.[check] !== 'pass') throw new Error(`Facts Gate check ${check} must pass`)
  if (!Array.isArray(factsGate.open_gaps) || factsGate.open_gaps.length) throw new Error('Facts Gate must have an empty open_gaps array')
}

function assertRelationCoverage(relations, coveragePlan, evidenceBundle) {
  const planSources = new Map(coveragePlan.sources.map((source) => [String(source.source_id), source]))
  const evidenceSourceIds = new Set(evidenceBundle.records.map((record) => String(record.source_id)))
  const relationKeys = relations.map((relation) => relation.sourceKey)
  if (new Set(relationKeys).size !== relationKeys.length) throw new Error('source_relations contains duplicate source_key values')
  for (const relation of relations) {
    const source = planSources.get(relation.sourceKey)
    if (!source) throw new Error(`source relation ${relation.sourceKey} is absent from coverage_plan.v1`)
    if (!evidenceSourceIds.has(relation.sourceKey)) throw new Error(`source relation ${relation.sourceKey} has no evidence record`)
    if (source.source_url !== relation.url) throw new Error(`source relation ${relation.sourceKey} URL differs from coverage_plan.v1`)
  }
  for (const sourceId of evidenceSourceIds) if (!relationKeys.includes(sourceId)) throw new Error(`evidence source ${sourceId} is missing from visible source relations`)
}

function validatePublicationGate(gate, articleHash, slug) {
  if (!gate || typeof gate !== 'object') throw new Error('accepted Stage 3 publication requires publication_gate')
  if (gate.status !== 'accepted' || String(gate.result).toUpperCase() !== 'PASS') throw new Error('publication_gate must be accepted with result=PASS')
  if (gate.reviewer?.role !== 'article-reader-acceptance-reviewer' || !String(gate.reviewer?.id || '').trim()) {
    throw new Error('publication_gate requires a structured article-reader-acceptance-reviewer')
  }
  const reviewId = nonEmpty(gate.review_id, 'publication_gate.review_id')
  const reviewedAt = nonEmpty(gate.reviewed_at, 'publication_gate.reviewed_at')
  if (!Number.isFinite(Date.parse(reviewedAt))) throw new Error('publication_gate.reviewed_at is invalid')
  const scope = stringArray(gate.scope)
  if (!scope.includes(`article:${slug}`) || !scope.includes('visible_reader_quality')) {
    throw new Error(`publication_gate.scope must include article:${slug} and visible_reader_quality`)
  }
  if (normalizeHash(gate.article_hash) !== articleHash) throw new Error('publication_gate.article_hash does not match the full visible payload')
  const lint = gate.content_lint
  if (!lint || lint.status !== 'PASS' || lint.validator !== 'content-lint.v1' || normalizeHash(lint.article_hash) !== articleHash || !String(lint.validated_at || '').trim()) {
    throw new Error('publication_gate requires Content-Lint PASS bound to the full visible payload')
  }
  return { reviewId, reviewedAt }
}

function normalizeRelations(value) {
  if (!Array.isArray(value)) return []
  return value.map((relation, index) => {
    const sourceId = positiveInteger(relation?.db_source_id ?? relation?.ingredient_research_source_id)
    const sourceKey = String(relation?.source_key ?? relation?.source_id ?? '').trim()
    const label = String(relation?.label ?? relation?.title ?? '').trim()
    const url = String(relation?.url ?? relation?.source_url ?? '').trim()
    if (!sourceId || !sourceKey || !label || !/^https?:\/\//i.test(url)) throw new Error(`invalid source_relations[${index}]`)
    return { sourceId, sourceKey, label, url }
  })
}

function normalizeWriteGuard(value, baseDir) {
  if (!value || typeof value !== 'object') throw new Error('meta.write_guard is required')
  if (value.mode === 'create') {
    if (value.expected_status !== 'absent' || Number(value.expected_version) !== 0) throw new Error('create write_guard requires expected_status=absent and expected_version=0')
    return { mode: 'create' }
  }
  if (value.mode !== 'update') throw new Error('write_guard.mode must be create or update')
  const expectedVersion = positiveInteger(value.expected_version)
  const expectedStatus = String(value.expected_status || '')
  if (!expectedVersion || !['draft', 'published', 'archived'].includes(expectedStatus)) throw new Error('update write_guard requires a valid expected version and status')
  const expectedBody = value.expected_body_path ? readFileSync(resolveInput(baseDir, value.expected_body_path), 'utf8').trim() : value.expected_body
  if (typeof expectedBody !== 'string') throw new Error('update write_guard requires expected_body or expected_body_path')
  if (normalizeHash(value.expected_article_hash) !== sha256(expectedBody)) throw new Error('write_guard.expected_article_hash does not match expected body')
  return { mode: 'update', expectedVersion, expectedStatus, expectedBody }
}

function articleSql(article) {
  const guard = `EXISTS (SELECT 1 FROM _stage3_import_guard WHERE slug=${sql(article.slug)} AND succeeded=1)`
  const sources = article.relations.map(({ label, url }) => ({ label, url }))
  const sourcesJson = JSON.stringify({ source_type: 'stage3_main_article_sources', source_links: sources, provenance: JSON.parse(article.provenance) })
  const write = article.writeGuard.mode === 'create'
    ? `INSERT INTO knowledge_articles (slug,title,summary,body,status,reviewed_at,sources_json,created_at,updated_at,version,conclusion,featured_image_r2_key,featured_image_url,dose_min,dose_max,dose_unit,product_note,article_layer)\nSELECT ${sql(article.slug)},${sql(article.title)},${sql(article.summary)},${sql(article.body)},'published',${sql(article.reviewedAt)},${sql(sourcesJson)},datetime('now'),datetime('now'),1,${sql(article.conclusion)},NULL,NULL,NULL,NULL,NULL,NULL,'main_article'\nWHERE NOT EXISTS (SELECT 1 FROM knowledge_articles WHERE slug=${sql(article.slug)});`
    : `UPDATE knowledge_articles SET title=${sql(article.title)},summary=${sql(article.summary)},body=${sql(article.body)},status='published',reviewed_at=${sql(article.reviewedAt)},sources_json=${sql(sourcesJson)},updated_at=datetime('now'),version=version+1,conclusion=${sql(article.conclusion)},article_layer='main_article'\nWHERE slug=${sql(article.slug)} AND version=${article.writeGuard.expectedVersion} AND status=${sql(article.writeGuard.expectedStatus)} AND article_layer='main_article' AND body=${sql(article.writeGuard.expectedBody)};`
  const sourceRows = article.relations.map((source, index) => `INSERT INTO knowledge_article_sources (article_slug,label,url,sort_order,created_at,updated_at) SELECT ${sql(article.slug)},${sql(source.label)},${sql(source.url)},${index},datetime('now'),datetime('now') WHERE ${guard};`).join('\n')
  return `PRAGMA foreign_keys = ON;\nDROP TABLE IF EXISTS _stage3_import_guard;\nCREATE TEMP TABLE _stage3_import_guard (slug TEXT PRIMARY KEY, succeeded INTEGER NOT NULL CHECK (succeeded = 1));\n${write}\nINSERT INTO _stage3_import_guard (slug,succeeded) VALUES (${sql(article.slug)},CASE WHEN changes()=1 THEN 1 ELSE 0 END);\nDELETE FROM knowledge_article_sources WHERE article_slug=${sql(article.slug)} AND ${guard};\n${sourceRows}\nDELETE FROM knowledge_article_ingredients WHERE article_slug=${sql(article.slug)} AND ${guard};\nINSERT INTO knowledge_article_ingredients (article_slug,ingredient_id,sort_order,created_at) SELECT ${sql(article.slug)},${article.ingredientId},0,datetime('now') WHERE ${guard};\nSELECT slug,succeeded FROM _stage3_import_guard;\nDROP TABLE _stage3_import_guard;`
}

export function visibleArticlePayloadHash({ slug, title, summary, body, conclusion, relations }) {
  return normalizeHash(visiblePayloadHash({
    slug, title, summary, body, conclusion,
    sources: relations.map((relation) => ({ source_id: relation.sourceKey, label: relation.label, url: relation.url })),
  }))
}

function loadRequiredArtifact(baseDir, path, schema) {
  if (!path) throw new Error(`${schema} path is required`)
  const value = readJson(resolveInput(baseDir, path))
  if (value.schema !== schema) throw new Error(`artifact must use schema ${schema}`)
  return value
}
function loadSourceArtifacts(baseDir, value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('meta.source_artifacts must map source_id to an original artifact path')
  const entries = Object.entries(value)
  if (!entries.length) throw new Error('meta.source_artifacts must not be empty')
  return Object.fromEntries(entries.map(([sourceId, path]) => {
    const absolute = resolveInput(baseDir, path)
    if (!existsSync(absolute)) throw new Error(`source artifact for ${sourceId} does not exist`)
    return [sourceId, readFileSync(absolute)]
  }))
}
function readJson(path) { return JSON.parse(readFileSync(path, 'utf8')) }
function resolveInput(baseDir, path) { return /^(?:[a-zA-Z]:[\\/]|\\\\)/.test(String(path)) ? resolve(path) : resolve(baseDir, path) }
function positiveInteger(value) { const number = Number(value); return Number.isInteger(number) && number > 0 ? number : null }
function nonEmpty(value, label) { const text = String(value ?? '').trim(); if (!text) throw new Error(`${label} is required`); return text }
function stringArray(value) { return Array.isArray(value) ? value.map(String) : [] }
function sameSet(left, right) { const a = new Set(stringArray(left)); const b = new Set(stringArray(right)); return a.size === left.length && b.size === (Array.isArray(right) ? right.length : -1) && a.size === b.size && [...a].every((entry) => b.has(entry)) }
function sha256(value) { return createHash('sha256').update(value, 'utf8').digest('hex') }
function normalizeHash(value) { const text = String(value || '').toLowerCase().replace(/^sha256:/, ''); return /^[a-f0-9]{64}$/.test(text) ? text : null }
function formatIssues(issues) { return issues.map((entry) => `${entry.code}: ${entry.message}`).join('; ') }
function sql(value) { if (value == null) return 'NULL'; if (typeof value === 'number') return String(value); return `'${String(value).replaceAll("'", "''")}'` }

function parseArgs(argv) {
  const parsed = { markdown: '', meta: '', out: '', dryRun: false, legacyDryRun: false }
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]
    if (arg === '--dry-run') { parsed.dryRun = true; continue }
    if (arg === '--legacy-dry-run') { parsed.legacyDryRun = true; continue }
    if (['--markdown', '--meta', '--out'].includes(arg)) { parsed[arg.slice(2).replace('-', '')] = argv[++index] || ''; continue }
    throw new Error(`Unknown argument: ${arg}`)
  }
  if (!parsed.markdown || !parsed.meta) throw new Error('--markdown and --meta are required')
  if (parsed.legacyDryRun && parsed.out) throw new Error('--legacy-dry-run never accepts --out')
  return parsed
}

function main() {
  const args = parseArgs(process.argv.slice(2))
  const result = buildKnowledgeMagazineImport({ markdownPath: args.markdown, metaPath: args.meta, legacyDryRun: args.legacyDryRun })
  if (args.dryRun || args.legacyDryRun) { console.log(JSON.stringify(result.report, null, 2)); return }
  if (args.out) { const out = resolve(args.out); mkdirSync(dirname(out), { recursive: true }); writeFileSync(out, result.sql, 'utf8'); console.log(JSON.stringify({ ...result.report, output: out })); return }
  console.log(result.sql)
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { main() } catch (error) { console.error(error.message); process.exitCode = 1 }
}
