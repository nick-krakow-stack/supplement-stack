import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { lintArticle, normalizeEvidenceRecords, validateEvidenceBundle } from './lib/content-validation.mjs'
import { validateEvidencePipelineLock, validatePublicationBatch, visiblePayloadHash } from './lib/evidence-pipeline-builder.mjs'
import { assembleStage2LegacyVisiblePayload, assertVisibleFieldMatches } from './lib/visible-payload-assembly.mjs'

const FORBIDDEN_VISIBLE_TERMS = [
  'Stage 1', 'Stage 2', 'Stage 3', 'Stage-1', 'Stage-2', 'Stage-3', 'Pipeline',
  'Review-Anker', 'Review-Coverage', 'Coverage-Mapping', 'Handoff',
  'Maschinenhinweis', 'für die Maschine', 'Dieser Artikel', 'In diesem Artikel',
  'Relevanz für Hauptartikel',
]

const INTERPRETATION_STATUSES = new Set([
  'planned', 'delegated', 'drafted', 'reviewed', 'accepted', 'blocked', 'excluded',
])

export function buildStage2Import({ manifestPath }) {
  const absoluteManifestPath = resolve(manifestPath)
  const manifest = readJson(absoluteManifestPath)
  const baseDir = dirname(absoluteManifestPath)
  const pipeline = manifest.schema === 'stage2_article_import.v3'
    ? validateEvidencePipelineLock({ lockPath: resolveInputPath(baseDir, manifest.pipeline_lock_path), allowTest: manifest.allow_test_pipeline_lock === true })
    : null
  const coveragePlan = pipeline?.coveragePlan ?? loadOptionalJson(baseDir, manifest.coverage_plan_path, manifest.coverage_plan)
  if (coveragePlan && coveragePlan.schema !== 'coverage_plan.v1') {
    throw new Error('coverage plan must use schema coverage_plan.v1')
  }
  const coverageCandidates = new Map((coveragePlan?.article_candidates ?? []).map((entry) => [entry.article_id, entry]))
  const evidenceGate = pipeline ? { sourceFactsReviews: pipeline.sourceFactsReviews, factsCompletenessGate: pipeline.factsGate, sourceArtifacts: pipeline.sourceArtifacts, bundle: pipeline.evidenceBundle }
    : manifest.schema === 'stage2_article_import.v2'
    ? loadEvidenceGateArtifacts(manifest, baseDir)
    : null
  const articles = normalizeArticles(manifest, coveragePlan)
  const errors = []
  const normalized = []

  for (const metadata of articles) {
    try {
      normalized.push(normalizeArticle({ metadata, manifest, baseDir, coveragePlan, coverageCandidates, evidenceGate }))
    } catch (error) {
      errors.push(`${metadata.article_path || metadata.slug || metadata.article_id || 'article'}: ${error.message}`)
    }
  }
  if (errors.length) throw new Error(errors.join('\n'))

  if (manifest.schema === 'stage2_article_import.v3') {
    const batch = readJson(resolveInputPath(baseDir, manifest.publication_batch_path))
    const payloads = Object.fromEntries(normalized.map((article) => [article.articleId, article.visiblePayload]))
    const publication = validatePublicationBatch({ batch, visiblePayloads: payloads, factsPackages: pipeline.packages.stage2, factsGate: pipeline.factsGate, pipelineLock: pipeline.lock })
    for (const article of normalized) {
      article.publicationStatus = 'accepted'; article.articleStatus = 'published'; article.interpretationStatus = 'accepted'; article.reviewedAt = publication.reviewed_at
      article.reviewNotes = `publication_batch=${publication.batch_id}; pipeline_lock=${pipeline.lock.lock_id}`
    }
  }

  const statements = [
    'PRAGMA foreign_keys = ON;',
    '-- Generated Stage-2 single-study import. Publication follows the manifest publication gate.',
    'DROP TABLE IF EXISTS _stage2_import_guard;',
    'CREATE TEMP TABLE _stage2_import_guard (slug TEXT PRIMARY KEY, succeeded INTEGER NOT NULL CHECK (succeeded = 1));',
    ...normalized.map(articleSql),
    'SELECT slug, succeeded FROM _stage2_import_guard ORDER BY slug;',
    'DROP TABLE _stage2_import_guard;',
  ]
  return { sql: `${statements.join('\n\n')}\n`, articles: normalized }
}

function normalizeArticle({ metadata, manifest, baseDir, coveragePlan, coverageCandidates, evidenceGate }) {
  const articlePath = resolveInputPath(baseDir, metadata.article_path)
  const authoringMarkdown = readText(articlePath)
  const legacyExtract = metadata.extract_path
    ? readJson(resolveInputPath(baseDir, metadata.extract_path))
    : null
  const articleId = metadata.article_id || metadata.slug || legacyExtract?.article_id
  const candidate = coverageCandidates.get(articleId)
  if (coveragePlan && !candidate) throw new Error(`article_id ${articleId || '(missing)'} is not in coverage_plan.v1.article_candidates`)

  const slug = metadata.slug || articleId || legacyExtract?.slug
  const ingredientId = positiveInteger(metadata.ingredient_id || manifest.ingredient_id || legacyExtract?.ingredient_id)
  let title = metadata.title || legacyExtract?.title || legacyExtract?.short_summary || firstHeading(authoringMarkdown)
  let summary = metadata.summary || legacyExtract?.short_summary || firstParagraph(authoringMarkdown)
  let conclusion = metadata.conclusion || summary
  let body = authoringMarkdown
  const factsStatus = metadata.facts_status || candidate?.facts_status || 'input_gap'
  const relations = normalizeRelations(metadata, manifest, legacyExtract, candidate, coveragePlan)
  const visibleSources = relations.map((relation) => ({ source_id: relation.sourceKey, label: relation.label, url: relation.url }))
  let visiblePayload
  if (manifest.schema === 'stage2_article_import.v3') {
    visiblePayload = assembleStage2LegacyVisiblePayload({ slug, markdown: authoringMarkdown, visibleSources })
    assertVisibleFieldMatches(metadata.title, visiblePayload.title, `${slug}: metadata.title`)
    assertVisibleFieldMatches(metadata.summary, visiblePayload.summary, `${slug}: metadata.summary`)
    assertVisibleFieldMatches(metadata.conclusion, visiblePayload.conclusion, `${slug}: metadata.conclusion`)
    ;({ title, summary, body, conclusion } = visiblePayload)
  } else {
    visiblePayload = { slug, title, summary, body, conclusion, sources: visibleSources }
  }
  const articleHash = manifest.schema === 'stage2_article_import.v3'
    ? normalizeHash(visiblePayloadHash(visiblePayload))
    : visibleArticlePayloadHash({ slug, title, summary, body, conclusion, relations })
  const lintResult = lintArticle({ file: articlePath, type: 'stage2' })
  if (lintResult.issues.length) throw new Error(`${slug}: content-lint failed: ${lintResult.issues.map((entry) => `${entry.code}: ${entry.message}`).join('; ')}`)
  const gate = manifest.schema === 'stage2_article_import.v3'
    ? { publicationStatus: 'drafted', interpretationStatus: 'drafted', reviewNotes: null, reviewedAt: null, reviewId: null }
    : publicationGate(metadata, articleHash, slug, candidate)
  if (gate.publicationStatus === 'accepted' && !['stage2_article_import.v2', 'stage2_article_import.v3'].includes(manifest.schema)) {
    throw new Error(`${slug}: accepted publication requires the canonical Stage-2 evidence gate`)
  }
  const evidence = loadEvidenceBundle(metadata, manifest, baseDir, coveragePlan, evidenceGate)
  const evidenceRecordIds = normalizeEvidenceIds(metadata, evidence.records)
  const writeGuard = normalizeWriteGuard(metadata, manifest, baseDir)

  if (!slug) throw new Error('missing slug/article_id')
  if (!ingredientId) throw new Error(`${slug}: missing positive ingredient_id`)
  if (!['complete', 'input_gap', 'blocked'].includes(factsStatus)) throw new Error(`${slug}: unsupported facts_status ${factsStatus}`)
  if (factsStatus === 'complete' && coveragePlan?.facts_gate?.status !== 'pass') throw new Error(`${slug}: facts_status=complete requires coverage facts_gate.status=pass`)
  if (gate.publicationStatus === 'accepted' && factsStatus !== 'complete') throw new Error(`${slug}: accepted publication requires facts_status=complete`)
  if (manifest.schema !== 'stage2_article_import.v3') validateCandidatePublication(slug, candidate, gate)
  if (!relations.length) throw new Error(`${slug}: missing source relations`)
  if (!body.trim()) throw new Error(`${slug}: empty body`)
  validateBody(slug, body)
  validateCoverageRelations(slug, candidate, relations)
  validateEvidenceRelations(slug, evidenceRecordIds, evidence.records, relations, factsStatus)

  const structuredSummary = evidenceRecordIds.length
    ? JSON.stringify({
        schema: 'source_evidence_provenance.v1',
        facts_status: factsStatus,
        coverage_plan_id: coveragePlan?.coverage_plan_id ?? null,
        coverage_plan_content_hash: coveragePlan?.content_hash ?? null,
        coverage_article_id: articleId,
        stage3_archetype: coveragePlan?.stage3_archetype_decision?.archetype ?? null,
        evidence_bundle_content_hash: evidence.bundle?.content_hash ?? null,
        source_evidence_record_ids: evidenceRecordIds,
      })
    : '{}'

  return {
    slug, title, summary, body, conclusion, ingredientId, relations, structuredSummary, articleId,
    articleHash, writeGuard, reviewedAt: gate.reviewedAt,
    factsPackagePath: metadata.facts_package_path,
    visiblePayload,
    factsStatus, publicationStatus: gate.publicationStatus,
    articleStatus: gate.publicationStatus === 'accepted' ? 'published' : 'draft',
    interpretationStatus: gate.interpretationStatus,
    reviewNotes: gate.reviewNotes,
  }
}

function publicationGate(article, articleHash, slug, candidate) {
  const explicit = article.publication_gate && typeof article.publication_gate === 'object'
    ? article.publication_gate
    : null
  const direct = String(article.publication_status || article.publish_status || '').toLowerCase()
  if (!explicit && (direct === 'accepted' || direct === 'published')) {
    throw new Error('accepted/published requires an explicit publication_gate object')
  }
  let raw = explicit?.status || direct
  raw = String(raw || 'drafted').toLowerCase()
  if (raw === 'published') throw new Error('publication_gate.status must use accepted, not published')
  if (raw === 'rejected' || raw === 'failed' || raw === 'fail') raw = 'blocked'
  if (raw === 'unreviewed' || raw === 'draft') raw = 'drafted'
  if (!INTERPRETATION_STATUSES.has(raw)) throw new Error(`unsupported publication status ${raw}`)

  const accepted = raw === 'accepted'
  let reviewedAt = null
  if (accepted) {
    const result = String(explicit?.result || '').toUpperCase()
    const reviewer = explicit?.reviewer
    const reviewerId = String(reviewer?.id || '').trim()
    const batch = String(explicit?.batch_id || explicit?.review_batch_id || '').trim()
    const scope = stringArray(explicit?.scope)
    const riskClasses = stringArray(explicit?.risk_classes)
    reviewedAt = String(explicit?.reviewed_at || '').trim()
    const reviewedHash = normalizeHash(explicit?.article_hash)
    const contentLint = explicit?.content_lint
    if (result !== 'PASS') throw new Error('accepted publication_gate requires result=PASS')
    if (!reviewer || reviewer.role !== 'article-reader-acceptance-reviewer' || !reviewerId) throw new Error('accepted publication_gate requires a structured article-reader-acceptance-reviewer')
    if (!batch) throw new Error('accepted publication_gate requires batch_id')
    if (!scope.includes(`article:${slug}`) || !scope.includes('visible_reader_quality')) throw new Error(`accepted publication_gate.scope must include article:${slug} and visible_reader_quality`)
    if (!sameStringSet(riskClasses, stringArray(candidate?.risk_class))) throw new Error('accepted publication_gate.risk_classes must exactly match the coverage candidate')
    if (!reviewedAt || !Number.isFinite(Date.parse(reviewedAt))) throw new Error('accepted publication_gate requires valid reviewed_at')
    if (!reviewedHash || reviewedHash !== articleHash) throw new Error('publication_gate.article_hash does not match the actual article')
    if (!contentLint || contentLint.status !== 'PASS' || contentLint.validator !== 'content-lint.v1' || normalizeHash(contentLint.article_hash) !== articleHash || !String(contentLint.validated_at || '').trim()) {
      throw new Error('accepted publication_gate requires a PASS content_lint bound to the same article hash')
    }
  }
  const reviewNotes = accepted
    ? String(explicit?.review_notes || '').trim() || `reviewer=${explicit.reviewer.id}; batch=${explicit.batch_id || explicit.review_batch_id}; scope=${explicit.scope.join(',')}; reviewed_at=${explicit.reviewed_at}; article_hash=sha256:${articleHash}`
    : null
  return { publicationStatus: raw, interpretationStatus: raw, reviewNotes, reviewedAt, reviewId: explicit?.review_id ?? null }
}

function validateCandidatePublication(slug, candidate, gate) {
  if (gate.publicationStatus !== 'accepted') return
  if (!candidate) throw new Error(`${slug}: accepted publication requires a coverage candidate`)
  if (candidate.status !== 'accepted' || candidate.publication_status !== 'accepted' || candidate.publication_gate?.status !== 'accepted' || String(candidate.publication_gate?.result).toUpperCase() !== 'PASS') {
    throw new Error(`${slug}: accepted publication conflicts with coverage candidate status/publication gate`)
  }
  if (candidate.publication_gate.review_id !== gate.reviewId) throw new Error(`${slug}: publication review_id differs from coverage candidate`)
  if (candidate.framework_fit?.decision === 'new' && (candidate.framework_fit.owner_approval?.status !== 'approved' || candidate.framework_fit.pilot?.status !== 'passed')) {
    throw new Error(`${slug}: new framework requires approved owner gate and passed pilot before publication`)
  }
}

function normalizeWriteGuard(article, manifest, baseDir) {
  const input = article.write_guard || manifest.write_guard
  if (!input) {
    if (['stage2_article_import.v2', 'stage2_article_import.v3'].includes(manifest.schema)) throw new Error('canonical Stage-2 import requires write_guard')
    return { mode: 'create' }
  }
  const mode = String(input.mode || '').toLowerCase()
  if (mode === 'create') {
    if (input.expected_status !== 'absent' || Number(input.expected_version) !== 0) {
      throw new Error('create write_guard requires expected_status=absent and expected_version=0')
    }
    return { mode }
  }
  if (mode !== 'update') throw new Error('write_guard.mode must be create or update')
  const expectedVersion = positiveInteger(input.expected_version)
  const expectedStatus = String(input.expected_status || '')
  if (!expectedVersion || !['draft', 'published', 'archived'].includes(expectedStatus)) {
    throw new Error('update write_guard requires positive expected_version and valid expected_status')
  }
  const expectedBody = input.expected_body_path
    ? readText(resolveInputPath(baseDir, input.expected_body_path))
    : typeof input.expected_body === 'string' ? input.expected_body : null
  if (expectedBody === null) throw new Error('update write_guard requires expected_body or expected_body_path')
  const expectedHash = normalizeHash(input.expected_article_hash)
  if (!expectedHash || expectedHash !== sha256(expectedBody)) {
    throw new Error('write_guard.expected_article_hash does not match expected body')
  }
  return { mode, expectedVersion, expectedStatus, expectedBody, expectedHash }
}

function normalizeRelations(article, manifest, legacyExtract, candidate, coveragePlan) {
  const globalRelations = Array.isArray(manifest.source_relations)
    ? manifest.source_relations.filter((relation) => !relation.article_id || relation.article_id === article.article_id || relation.article_slug === article.slug)
    : null
  const direct = article.source_relations || article.sources || globalRelations
  if (Array.isArray(direct)) {
    const normalized = direct.map((relation, index) => normalizeRelation(relation, index))
    if (normalized.some((relation) => !relation)) throw new Error('invalid source relation: numeric database id and HTTP(S) URL are required')
    return normalized
  }

  const ids = article.source_ids || legacyExtract?.source_ids || []
  const keys = article.source_keys || []
  const links = normalizeSources(article.source_links || legacyExtract?.source_links)
  if (ids.length) {
    const relations = ids.map((sourceId, index) => ({
      sourceId: positiveInteger(sourceId),
      sourceKey: String(keys[index] || candidateSourceKeys(candidate)[index] || ''),
      label: links[index]?.label || String(keys[index] || `Quelle ${index + 1}`),
      url: links[index]?.url || coverageSourceUrl(coveragePlan, keys[index] || candidateSourceKeys(candidate)[index]),
      evidenceRecordIds: [],
    })).filter((relation) => relation.sourceId && /^https?:\/\//i.test(relation.url || ''))
    if (relations.length !== ids.length) throw new Error('legacy source_ids and source_links must form exact valid relations')
    return relations
  }
  return []
}

function normalizeRelation(relation, index) {
  if (!relation || typeof relation !== 'object') return null
  const sourceId = positiveInteger(relation.db_source_id || relation.ingredient_research_source_id || relation.source_id)
  const url = relation.url || relation.source_url
  if (!sourceId || !/^https?:\/\//i.test(String(url || ''))) return null
  const logicalSourceId = positiveInteger(relation.source_id) ? '' : relation.source_id
  return {
    sourceId,
    sourceKey: String(relation.source_key || relation.coverage_source_id || relation.source_ref || logicalSourceId || ''),
    label: relation.label || relation.title || relation.name || `Quelle ${index + 1}`,
    url,
    evidenceRecordIds: stringArray(relation.source_evidence_record_ids || relation.evidence_record_ids),
  }
}

function loadEvidenceBundle(article, manifest, baseDir, coveragePlan, evidenceGate) {
  if (manifest.schema === 'stage2_article_import.v3') return { bundle: evidenceGate.bundle, records: new Map(evidenceGate.bundle.records.map((record) => [record.record_id, record])) }
  const inline = [
    ...arrayValue(manifest.source_evidence_records),
    ...arrayValue(article.source_evidence_records),
    manifest.source_evidence_bundle,
    article.source_evidence_bundle,
  ].filter(Boolean)
  const paths = [
    ...arrayValue(manifest.source_evidence_paths),
    ...arrayValue(article.source_evidence_paths),
    ...[
      manifest.source_evidence_path, article.source_evidence_path,
      manifest.source_evidence_bundle_path, article.source_evidence_bundle_path,
    ].filter(Boolean),
  ]
  const values = [...inline]
  for (const path of paths) {
    const value = readJson(resolveInputPath(baseDir, path))
    values.push(value)
  }
  const bundles = values.filter((value) => value?.schema === 'source_evidence_bundle.v1')
  if (bundles.length > 1) throw new Error('exactly one source_evidence_bundle.v1 is allowed')
  const loose = values.filter((value) => value?.schema !== 'source_evidence_bundle.v1')
    .flatMap((value) => Array.isArray(value) ? value : [value])
  if (bundles.length && loose.length) throw new Error('do not mix a source evidence bundle with loose evidence records')
  const bundle = bundles[0] ?? null
  const records = normalizeEvidenceRecords(bundle ?? loose)
  if (['stage2_article_import.v2', 'stage2_article_import.v3'].includes(manifest.schema)) {
    const issues = validateEvidenceBundle({
      coveragePlan,
      evidenceBundle: bundle,
      sourceFactsReviews: evidenceGate.sourceFactsReviews,
      factsCompletenessGate: evidenceGate.factsCompletenessGate,
      sourceArtifacts: evidenceGate.sourceArtifacts,
      file: 'stage2-import-evidence',
    })
    if (issues.length) throw new Error(`invalid coverage/evidence bundle: ${issues.map((entry) => `${entry.code}: ${entry.message}`).join('; ')}`)
  }
  const byId = new Map()
  for (const record of records) {
    if (record?.schema !== 'source_evidence_record.v1' || !record.record_id) {
      throw new Error('source evidence must use schema source_evidence_record.v1 and have record_id')
    }
    if (byId.has(record.record_id)) throw new Error(`duplicate source evidence record ${record.record_id}`)
    byId.set(record.record_id, record)
  }
  return { bundle, records: byId }
}

function loadEvidenceGateArtifacts(manifest, baseDir) {
  const reviewPaths = arrayValue(manifest.source_facts_review_paths ?? manifest.source_facts_review_path)
  if (!reviewPaths.length) throw new Error('stage2_article_import.v2 requires source_facts_review_path(s)')
  const sourceFactsReviews = reviewPaths.map((path) => readJson(resolveInputPath(baseDir, path)))
  if (sourceFactsReviews.some((review) => review.schema !== 'source_facts_review.v1')) throw new Error('source facts reviews must use source_facts_review.v1')
  if (!manifest.facts_completeness_gate_path) throw new Error('stage2_article_import.v2 requires facts_completeness_gate_path')
  const factsCompletenessGate = readJson(resolveInputPath(baseDir, manifest.facts_completeness_gate_path))
  if (factsCompletenessGate.schema !== 'facts_completeness_gate.v1') throw new Error('facts gate must use facts_completeness_gate.v1')
  const mappings = manifest.source_artifacts
  if (!mappings || typeof mappings !== 'object' || Array.isArray(mappings) || !Object.keys(mappings).length) throw new Error('stage2_article_import.v2 requires source_artifacts')
  const sourceArtifacts = Object.fromEntries(Object.entries(mappings).map(([sourceId, path]) => [sourceId, readFileSync(resolveInputPath(baseDir, path))]))
  if (!manifest.source_evidence_bundle_path) throw new Error('canonical Stage-2 import requires source_evidence_bundle_path')
  const bundle = readJson(resolveInputPath(baseDir, manifest.source_evidence_bundle_path))
  if (bundle.schema !== 'source_evidence_bundle.v1') throw new Error('evidence bundle must use source_evidence_bundle.v1')
  return { sourceFactsReviews, factsCompletenessGate, sourceArtifacts, bundle }
}

function normalizeEvidenceIds(article, records) {
  const direct = stringArray(article.source_evidence_record_ids || article.evidence_record_ids)
  const fromRelations = (article.source_relations ?? []).flatMap((relation) =>
    stringArray(relation.source_evidence_record_ids || relation.evidence_record_ids))
  const ids = [...new Set([...direct, ...fromRelations])]
  for (const id of ids) if (!records.has(id)) throw new Error(`missing source evidence record ${id}`)
  return ids
}

function validateCoverageRelations(slug, candidate, relations) {
  const dbIds = relations.map((relation) => relation.sourceId)
  if (new Set(dbIds).size !== dbIds.length) throw new Error(`${slug}: duplicate database source relation`)
  if (!candidate) return
  const expected = new Set(candidateSourceKeys(candidate))
  const actualKeys = relations.map((relation) => relation.sourceKey).filter(Boolean)
  const actual = new Set(actualKeys)
  if (actual.size !== actualKeys.length || expected.size !== actual.size || [...expected].some((key) => !actual.has(key))) {
    throw new Error(`${slug}: source relations must exactly match coverage candidate sources`)
  }
}

function validateEvidenceRelations(slug, ids, records, relations, factsStatus) {
  const relationKeys = new Set(relations.map((relation) => relation.sourceKey).filter(Boolean))
  const evidencedKeys = new Set()
  for (const id of ids) {
    const record = records.get(id)
    if (relationKeys.size && !relationKeys.has(String(record.source_id))) {
      throw new Error(`${slug}: evidence ${id} source_id has no exact source relation`)
    }
    evidencedKeys.add(String(record.source_id))
  }
  if (factsStatus === 'complete') {
    if (!ids.length) throw new Error(`${slug}: complete facts_status requires source evidence references`)
    for (const key of relationKeys) {
      if (!evidencedKeys.has(key)) throw new Error(`${slug}: complete facts_status has no evidence for source relation ${key}`)
    }
  }
}

function candidateSourceKeys(candidate) {
  if (!candidate) return []
  return [...new Set([candidate.primary_source_id, ...(candidate.integrated_source_ids ?? [])].filter(Boolean).map(String))]
}

function coverageSourceUrl(plan, key) {
  return plan?.sources?.find((source) => String(source.source_id) === String(key))?.source_url || ''
}

function validateBody(slug, body) {
  if (body.includes('\uFFFD')) throw new Error(`${slug}: contains replacement character`)
  if (body.includes('\u00c3\u0192') || body.includes('\u00c3\u201a') || body.includes('\u00c3\u00a2\u00e2\u201a\u00ac')) {
    throw new Error(`${slug}: contains likely mojibake`)
  }
  for (const term of FORBIDDEN_VISIBLE_TERMS) {
    if (body.includes(term)) throw new Error(`${slug}: contains forbidden visible term "${term}"`)
  }
}

function articleSql(article) {
  const guardExists = `EXISTS (SELECT 1 FROM _stage2_import_guard WHERE slug=${sql(article.slug)} AND succeeded=1)`
  const sources = article.relations.map(({ label, url }) => ({ label, url }))
  const sourcesJson = JSON.stringify({ source_type: 'stage2_single_study_sources', source_links: sources })
  const sourceRows = sources.map((source, index) =>
    `INSERT INTO knowledge_article_sources (article_slug, label, url, sort_order, created_at, updated_at)
SELECT ${sql(article.slug)}, ${sql(source.label)}, ${sql(source.url)}, ${index}, datetime('now'), datetime('now')
WHERE ${guardExists};`
  ).join('\n')
  const interpretationRows = article.relations.map((relation) => `
INSERT INTO study_interpretation_records (
  ingredient_id, source_id, research_artifact_id, knowledge_article_slug, status,
  structured_summary_json, stage3_reference_summary, notes, review_notes,
  created_at, updated_at, version
)
SELECT
  ${article.ingredientId}, ${relation.sourceId}, NULL, ${sql(article.slug)}, ${sql(article.interpretationStatus)},
  ${sql(article.structuredSummary)}, ${sql(article.conclusion)}, ${sql(`facts_status=${article.factsStatus}`)}, ${sql(article.reviewNotes)},
  datetime('now'), datetime('now'), 1
WHERE ${guardExists};`).join('\n')
  const reviewedAt = article.articleStatus === 'published' ? sql(article.reviewedAt) : 'NULL'

  const writeArticle = article.writeGuard.mode === 'create'
    ? `INSERT INTO knowledge_articles (
  slug, title, summary, body, status, reviewed_at, sources_json, created_at, updated_at,
  version, conclusion, featured_image_r2_key, featured_image_url, dose_min, dose_max,
  dose_unit, product_note, article_layer
)
SELECT
  ${sql(article.slug)}, ${sql(article.title)}, ${sql(article.summary)}, ${sql(article.body)},
  ${sql(article.articleStatus)}, ${reviewedAt}, ${sql(sourcesJson)}, datetime('now'), datetime('now'),
  1, ${sql(article.conclusion)}, NULL, NULL, NULL, NULL, NULL, NULL, 'single_study'
WHERE NOT EXISTS (SELECT 1 FROM knowledge_articles WHERE slug=${sql(article.slug)});`
    : `UPDATE knowledge_articles
SET
  title=${sql(article.title)},
  summary=${sql(article.summary)},
  body=${sql(article.body)},
  status=${sql(article.articleStatus)},
  reviewed_at=${reviewedAt},
  sources_json=${sql(sourcesJson)},
  updated_at=datetime('now'),
  version=version + 1,
  conclusion=${sql(article.conclusion)},
  article_layer='single_study'
WHERE slug=${sql(article.slug)}
  AND version=${article.writeGuard.expectedVersion}
  AND status=${sql(article.writeGuard.expectedStatus)}
  AND article_layer='single_study'
  AND body=${sql(article.writeGuard.expectedBody)};`

  return `${writeArticle}

INSERT INTO _stage2_import_guard (slug, succeeded)
VALUES (${sql(article.slug)}, CASE WHEN changes() = 1 THEN 1 ELSE 0 END);

DELETE FROM knowledge_article_sources
WHERE article_slug=${sql(article.slug)} AND ${guardExists};
${sourceRows}
DELETE FROM knowledge_article_ingredients
WHERE article_slug=${sql(article.slug)} AND ${guardExists};
INSERT INTO knowledge_article_ingredients (article_slug, ingredient_id, sort_order, created_at)
SELECT ${sql(article.slug)}, ${article.ingredientId}, 0, datetime('now')
WHERE ${guardExists};
DELETE FROM study_interpretation_records
WHERE knowledge_article_slug=${sql(article.slug)} AND ${guardExists};
${interpretationRows}`
}

function normalizeArticles(manifest, coveragePlan) {
  if (Array.isArray(manifest.articles)) return manifest.articles
  if (Array.isArray(manifest.stage2_articles)) return manifest.stage2_articles
  if (Array.isArray(manifest.meta_review_candidates) || Array.isArray(manifest.single_study_candidates)) {
    return [...(manifest.meta_review_candidates ?? []), ...(manifest.single_study_candidates ?? [])]
  }
  if (coveragePlan && Array.isArray(manifest.article_metadata)) return manifest.article_metadata
  throw new Error('manifest must contain articles, article_metadata, stage2_articles, or legacy candidate arrays')
}

function readJson(path) { return JSON.parse(readText(path)) }
function loadOptionalJson(baseDir, path, inline) {
  if (inline) return inline
  return path ? readJson(resolveInputPath(baseDir, path)) : null
}
function readText(path) { return readFileSync(path, 'utf8') }
function resolveInputPath(baseDir, inputPath) {
  const text = String(inputPath || '')
  if (!text) throw new Error('missing input path')
  if (/^(?:[a-zA-Z]:[\\/]|\\\\)/.test(text)) return resolve(text)
  if (text.startsWith('_research_raw/') || text.startsWith('_research_raw\\')) return resolve(text)
  return resolve(baseDir, text)
}
function firstHeading(body) { return body.match(/^#\s+(.+)$/m)?.[1]?.trim() || 'Studienauswertung' }
function firstParagraph(body) {
  return body.split(/\n{2,}/).map((part) => part.trim()).find((part) => part && !part.startsWith('#')) || 'Studienauswertung.'
}
function normalizeSources(value) {
  if (!Array.isArray(value)) return []
  return value.map((source, index) => typeof source === 'string'
    ? { label: `Quelle ${index + 1}`, url: source }
    : { label: source.label || source.title || source.name || `Quelle ${index + 1}`, url: source.url || source.source_url })
    .filter((source) => /^https?:\/\//i.test(String(source.url || '')))
}
function positiveInteger(value) { const number = Number(value); return Number.isInteger(number) && number > 0 ? number : null }
function stringArray(value) { return Array.isArray(value) ? value.filter((entry) => entry != null).map(String) : [] }
function arrayValue(value) { return Array.isArray(value) ? value : value == null ? [] : [value] }
function sameStringSet(left, right) {
  const leftSet = new Set(left)
  const rightSet = new Set(right)
  return leftSet.size === left.length && rightSet.size === right.length && leftSet.size === rightSet.size && [...leftSet].every((entry) => rightSet.has(entry))
}
function sha256(value) { return createHash('sha256').update(value, 'utf8').digest('hex') }
function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize)
  if (!value || typeof value !== 'object') return value
  return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonicalize(value[key])]))
}
function visibleArticlePayloadHash({ slug, title, summary, body, conclusion, relations }) {
  const payload = {
    schema: 'article_visible_payload.v1', slug, title, summary, body, conclusion,
    sources: relations.map((relation) => ({
      db_source_id: relation.sourceId,
      source_key: relation.sourceKey,
      label: relation.label,
      url: relation.url,
    })),
  }
  return sha256(JSON.stringify(canonicalize(payload)))
}
function normalizeHash(value) {
  const text = String(value || '').trim().toLowerCase().replace(/^sha256:/, '')
  return /^[a-f0-9]{64}$/.test(text) ? text : null
}
function sql(value) {
  if (value == null) return 'NULL'
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : 'NULL'
  return `'${String(value).replaceAll("'", "''")}'`
}

function parseArgs(argv) {
  const parsed = { articleList: '', out: '', dryRun: false }
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]
    if (arg === '--article-list') { parsed.articleList = argv[++index]; continue }
    if (arg === '--out') { parsed.out = argv[++index]; continue }
    if (arg === '--dry-run') { parsed.dryRun = true; continue }
    throw new Error(`Unknown argument: ${arg}`)
  }
  if (!parsed.articleList) throw new Error('--article-list is required')
  return parsed
}

function runCli() {
  try {
    const args = parseArgs(process.argv.slice(2))
    const result = buildStage2Import({ manifestPath: args.articleList })
    if (args.dryRun) {
      console.log(JSON.stringify({ ok: true, articles: result.articles.map((article) => ({
        slug: article.slug,
        article_status: article.articleStatus,
        interpretation_status: article.interpretationStatus,
        facts_status: article.factsStatus,
        source_relation_count: article.relations.length,
      })) }, null, 2))
      return
    }
    if (args.out) {
      const outPath = resolve(args.out)
      mkdirSync(dirname(outPath), { recursive: true })
      writeFileSync(outPath, result.sql, 'utf8')
      console.log(`wrote ${outPath}`)
    } else console.log(result.sql)
  } catch (error) {
    console.error(error.message)
    process.exitCode = 1
  }
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))) runCli()
