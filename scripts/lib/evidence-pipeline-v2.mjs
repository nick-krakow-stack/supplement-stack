import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { canonicalJsonHash, decodeUtf8Strict, sha256Bytes } from './content-validation.mjs'
import { assertContained, assertNoPathCollisions, assertSafeId, isContained, portablePath, resolveManifestPath } from './safe-paths.mjs'

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const CATALOG_PATH = resolve(REPO_ROOT, 'codex-files/frameworks/framework-catalog.v1.json')
const STYLE_SNAPSHOT_PATH = resolve(REPO_ROOT, 'codex-files/frameworks/stage3-style-snapshots.v1.json')
const HASH = /^sha256:[a-f0-9]{64}$/
const HIGH_RISKS = new Set(['safety', 'dose_or_reference', 'interaction', 'vulnerable_population', 'controversy', 'stage4_relevance', 'warning'])
const RISK_VALUES = new Set(['standard', ...HIGH_RISKS])
const STAGE2_SOURCE_ASSIGNMENT_POLICY = 'one_meaningful_source_per_stage2.v1'
const STAGE3_SOURCE_LABEL_POLICY = 'german_original_title.v1'
const ASSUMPTION_REVIEW_STATUSES = new Set(['identified', 'none_identified'])
const DIRECT_RESEARCH_RELATIONS = new Set([
  'replication',
  'direct_follow_up',
  'population_extension',
  'dose_extension',
  'method_extension',
  'outcome_extension',
  'superseding_update',
])

function fail(message) { throw new Error(message) }
function sourceAssignmentPolicyFail(message) { const error = new Error(message); error.code = 'STAGE2_SOURCE_ASSIGNMENT_POLICY'; throw error }
function object(value, label) { if (!value || typeof value !== 'object' || Array.isArray(value)) fail(`${label} must be an object`); return value }
function array(value, label) { if (!Array.isArray(value)) fail(`${label} must be an array`); return value }
function text(value, label) { if (typeof value !== 'string' || !value.trim()) fail(`${label} must be a non-empty string`); return value.trim() }
function bool(value, label) { if (typeof value !== 'boolean') fail(`${label} must be boolean`); return value }
function iso(value, label) { const result = text(value, label); if (!Number.isFinite(Date.parse(result))) fail(`${label} must be ISO-8601`); return result }
function unique(values, label, { allowEmpty = false } = {}) {
  if (!Array.isArray(values) || (!allowEmpty && !values.length)) fail(`${label} must be ${allowEmpty ? 'an' : 'a non-empty'} array`)
  const normalized = values.map((value, index) => text(value, `${label}[${index}]`))
  if (new Set(normalized).size !== normalized.length) fail(`${label} must be unique`)
  return normalized
}
function json(path, label = path) {
  const bytes = readFileSync(path)
  const decoded = decodeUtf8Strict(bytes, label)
  if (decoded.errors.length) fail(decoded.errors.join('; '))
  try { return JSON.parse(decoded.text) } catch (error) { fail(`${label} is invalid JSON: ${error.message}`) }
}
function artifactHash(value, omitted = ['content_hash', 'package_content_hash', 'lock_hash']) {
  const copy = Object.fromEntries(Object.entries(value).filter(([key]) => !omitted.includes(key)))
  return canonicalJsonHash(copy)
}
function writeJson(path, value) { mkdirSync(dirname(path), { recursive: true }); writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, 'utf8') }
function sameSet(left, right) { const a = new Set(left), b = new Set(right); return a.size === left.length && b.size === right.length && a.size === b.size && [...a].every((entry) => b.has(entry)) }
function sorted(values) { return [...values].sort((a, b) => String(a).localeCompare(String(b))) }
function hashRank(seed, id) { return canonicalJsonHash({ seed, id }) }

function validateRiskTags(value, label, { allowEmpty = true } = {}) {
  const tags = unique(value ?? [], label, { allowEmpty })
  if (tags.some((tag) => !RISK_VALUES.has(tag))) fail(`${label} contains an invalid risk`)
  if (tags.includes('standard') && tags.length > 1) fail(`${label} cannot combine standard with elevated risks`)
  return tags
}

function nullableDoi(value, label) {
  if (value == null || value === '') return null
  const normalized = text(String(value), label).replace(/^https?:\/\/(?:dx\.)?doi\.org\//i, '').replace(/^doi:\s*/i, '').toLowerCase()
  if (!/^10\.\d{4,9}\/\S+$/.test(normalized)) fail(`${label} is invalid`)
  return normalized
}

function nullablePmid(value, label) {
  if (value == null || value === '') return null
  const normalized = text(String(value), label).replace(/^pmid:\s*/i, '')
  if (!/^\d+$/.test(normalized)) fail(`${label} is invalid`)
  return normalized
}

export function sourceCitationLabelV2(source) {
  const authorOrInstitution = text(source.author_or_institution, 'source.author_or_institution')
  const publicationYear = source.publication_year == null ? null : Number(source.publication_year)
  if (publicationYear != null && (!Number.isInteger(publicationYear) || publicationYear < 1000 || publicationYear > new Date().getUTCFullYear())) fail('source.publication_year must be an original-source year or null')
  const title = text(source.title, 'source.title')
  const journalOrPublisher = text(source.journal_or_publisher, 'source.journal_or_publisher')
  const doi = nullableDoi(source.doi, 'source.doi')
  const pmid = nullablePmid(source.pmid ?? source.pubmed_id, 'source.pmid')
  return `${authorOrInstitution} (${publicationYear ?? 'o. J.'}). ${title}. ${journalOrPublisher}.${doi ? ` DOI: ${doi}.` : ''}${pmid ? ` PMID: ${pmid}.` : ''}`
}

function validateSource(source, index) {
  object(source, `sources[${index}]`)
  const sourceId = assertSafeId(source.source_id, `sources[${index}].source_id`)
  const sourceType = text(source.source_type, `sources[${index}].source_type`)
  const sourceKind = text(source.source_kind, `sources[${index}].source_kind`)
  if (!['official', 'study'].includes(sourceKind)) fail(`source ${sourceId}.source_kind must be official or study`)
  const authorOrInstitution = text(source.author_or_institution, `sources[${index}].author_or_institution`)
  const publicationYear = source.publication_year == null ? null : Number(source.publication_year)
  if (publicationYear != null && (!Number.isInteger(publicationYear) || publicationYear < 1000 || publicationYear > new Date().getUTCFullYear())) fail(`source ${sourceId}.publication_year is invalid`)
  const title = text(source.title, `sources[${index}].title`)
  const journalOrPublisher = text(source.journal_or_publisher, `sources[${index}].journal_or_publisher`)
  const doi = nullableDoi(source.doi, `sources[${index}].doi`)
  const pmid = nullablePmid(source.pmid ?? source.pubmed_id, `sources[${index}].pmid`)
  const label = text(source.label, `sources[${index}].label`)
  const expectedLabel = sourceCitationLabelV2({ author_or_institution: authorOrInstitution, publication_year: publicationYear, title, journal_or_publisher: journalOrPublisher, doi, pmid })
  if (label !== expectedLabel) fail(`source ${sourceId}.label must equal the deterministic visible citation label`)
  const url = text(source.url, `sources[${index}].url`)
  if (!/^https?:\/\//i.test(url)) fail(`source ${sourceId} needs an HTTP(S) URL`)
  const canonicalUrl = text(source.canonical_url ?? url, `sources[${index}].canonical_url`)
  if (!/^https?:\/\//i.test(canonicalUrl)) fail(`source ${sourceId} needs an HTTP(S) canonical_url`)
  if (!HASH.test(source.source_content_hash ?? '')) fail(`source ${sourceId} needs a SHA-256 source_content_hash`)
  return { ...source, source_id: sourceId, source_type: sourceType, source_kind: sourceKind, author_or_institution: authorOrInstitution, publication_year: publicationYear, title, journal_or_publisher: journalOrPublisher, doi, pmid, label, url, canonical_url: canonicalUrl }
}

function validateSeoBrief(value, label) {
  const brief = object(value, label)
  for (const key of ['primary_intent', 'reader_question', 'reader_promise', 'primary_topic_phrase', 'cannibalization_note']) text(brief[key], `${label}.${key}`)
  brief.secondary_questions = unique(brief.secondary_questions, `${label}.secondary_questions`)
  if (brief.secondary_questions.length < 3 || brief.secondary_questions.length > 6) fail(`${label}.secondary_questions must contain 3 to 6 questions`)
  brief.internal_link_targets = unique(brief.internal_link_targets ?? [], `${label}.internal_link_targets`, { allowEmpty: true })
  for (const target of brief.internal_link_targets) if (!/^\/wissen\/[a-z0-9]+(?:-[a-z0-9]+)*$/.test(target)) fail(`${label}.internal_link_targets must use canonical /wissen/<slug> paths`)
  return brief
}

function validateSelectedLinkSlice(value, seoBrief, label) {
  const slice = object(value, label)
  const links = array(slice.links ?? [], `${label}.links`).map((entry, index) => {
    object(entry, `${label}.links[${index}]`)
    const path = text(entry.path, `${label}.links[${index}].path`)
    if (!/^\/wissen\/[a-z0-9]+(?:-[a-z0-9]+)*$/.test(path)) fail(`${label}.links[${index}].path is invalid`)
    const targetId = assertSafeId(entry.target_id, `${label}.links[${index}].target_id`)
    if (targetId !== path.slice('/wissen/'.length)) fail(`${label}.links[${index}] target identity differs from path`)
    const targetState = entry.target_state ?? 'live'
    if (!['live', 'same_release'].includes(targetState)) fail(`${label}.links[${index}].target_state must be live or same_release`)
    const targetArticleId = targetState === 'same_release'
      ? assertSafeId(entry.target_article_id, `${label}.links[${index}].target_article_id`)
      : null
    if (targetState === 'live' && entry.target_article_id != null) fail(`${label}.links[${index}] live target cannot bind target_article_id`)
    const coveredSourceIds = entry.covered_source_ids == null
      ? null
      : unique(entry.covered_source_ids, `${label}.links[${index}].covered_source_ids`)
    return {
      path,
      title: text(entry.title, `${label}.links[${index}].title`),
      target_id: targetId,
      target_state: targetState,
      target_article_id: targetArticleId,
      ...(coveredSourceIds ? { covered_source_ids: coveredSourceIds } : {}),
    }
  })
  if (links.map((entry) => entry.path).join('\n') !== [...links].sort((a, b) => a.path.localeCompare(b.path)).map((entry) => entry.path).join('\n') || new Set(links.map((entry) => entry.path)).size !== links.length) fail(`${label}.links must be unique and sorted by path`)
  if (!sameSet(links.map((entry) => entry.path), seoBrief.internal_link_targets)) fail(`${label}.links differ from seo_brief.internal_link_targets`)
  const expectedHash = canonicalJsonHash({ links })
  if (slice.slice_hash !== expectedHash) fail(`${label}.slice_hash is stale`)
  return { links, slice_hash: expectedHash }
}

function validateGraphicDecision(value, label) {
  const decision = object(value ?? { mode: 'none', reason: 'No explanatory graphic is required.' }, label)
  if (!['none', 'generate'].includes(decision.mode)) fail(`${label}.mode must be none or generate`)
  const reason = text(decision.reason, `${label}.reason`)
  if (Object.hasOwn(decision, 'record_ids')) fail(`${label} coverage planning cannot bind record_ids before extraction`)
  const clusterIds = unique(decision.cluster_ids ?? [], `${label}.cluster_ids`, { allowEmpty: true })
  const obligationIds = unique(decision.obligation_ids ?? [], `${label}.obligation_ids`, { allowEmpty: true })
  if (decision.mode === 'generate' && (!clusterIds.length || !obligationIds.length)) fail(`${label} generate requires cluster_ids and obligation_ids`)
  if (decision.mode === 'none' && (clusterIds.length || obligationIds.length)) fail(`${label} none cannot retain graphic cluster/obligation bindings`)
  return { mode: decision.mode, reason, cluster_ids: clusterIds, obligation_ids: obligationIds }
}

function validateCommonAssumptionReview(value, label, { resolved = false } = {}) {
  const review = object(value, label)
  if (!ASSUMPTION_REVIEW_STATUSES.has(review.status)) fail(`${label}.status must be identified or none_identified`)
  const discoveryNote = text(review.discovery_note, `${label}.discovery_note`)
  const checks = array(review.checks, `${label}.checks`).map((check, index) => {
    object(check, `${label}.checks[${index}]`)
    const assumptionId = assertSafeId(check.assumption_id, `${label}.checks[${index}].assumption_id`)
    const sourceIds = unique(check.source_ids, `${label}.${assumptionId}.source_ids`)
    const clusterIds = unique(check.cluster_ids, `${label}.${assumptionId}.cluster_ids`)
    const obligationIds = unique(check.obligation_ids, `${label}.${assumptionId}.obligation_ids`)
    const recordIds = resolved
      ? unique(check.record_ids ?? [], `${label}.${assumptionId}.record_ids`, { allowEmpty: true })
      : []
    if (!resolved && Object.hasOwn(check, 'record_ids')) fail(`${label}.${assumptionId} cannot bind record_ids before extraction`)
    return {
      assumption_id: assumptionId,
      assumption: text(check.assumption, `${label}.${assumptionId}.assumption`),
      reader_question: text(check.reader_question, `${label}.${assumptionId}.reader_question`),
      discovery_basis: text(check.discovery_basis, `${label}.${assumptionId}.discovery_basis`),
      source_ids: sourceIds,
      cluster_ids: clusterIds,
      obligation_ids: obligationIds,
      ...(resolved ? { record_ids: recordIds } : {}),
    }
  })
  if (new Set(checks.map((check) => check.assumption_id)).size !== checks.length) fail(`${label}.assumption_id values must be unique`)
  if (review.status === 'identified' && checks.length === 0) fail(`${label}.identified requires at least one check`)
  if (review.status === 'none_identified' && checks.length !== 0) fail(`${label}.none_identified requires checks=[]`)
  return { status: review.status, discovery_note: discoveryNote, checks }
}

function isMetaAnalysisSource(source) {
  const normalized = source.source_type.toLowerCase().replace(/[^a-z0-9]+/g, '_')
  return normalized.includes('meta_analysis') || normalized.includes('metaanalysis') || normalized.includes('metaanalyse') || (normalized.includes('systemat') && (normalized.includes('review') || normalized.includes('uebersicht'))) || normalized.includes('umbrella_review')
}

function normalizedSourceIdentityUrl(value) {
  try {
    const parsed = new URL(value)
    parsed.hash = ''
    parsed.hostname = parsed.hostname.toLowerCase()
    parsed.pathname = parsed.pathname.replace(/\/$/, '') || '/'
    return parsed.toString()
  } catch { return String(value).trim() }
}

function validateStage2SourceAssignment(value, { articleId, sourceIds, sourceById }) {
  const label = `article ${articleId}.source_assignment`
  if (!value || typeof value !== 'object' || Array.isArray(value)) sourceAssignmentPolicyFail(`${label} must be an object`)
  const assignment = value
  if (!['single_source', 'direct_research_line', 'meta_analysis_family'].includes(assignment.mode)) sourceAssignmentPolicyFail(`${label}.mode is invalid`)
  const anchorSourceId = assertSafeId(assignment.anchor_source_id, `${label}.anchor_source_id`)
  if (!sourceIds.includes(anchorSourceId)) sourceAssignmentPolicyFail(`${label}.anchor_source_id must belong to the article`)
  const relations = array(assignment.relations ?? [], `${label}.relations`).map((relation, index) => {
    object(relation, `${label}.relations[${index}]`)
    const sourceId = assertSafeId(relation.source_id, `${label}.relations[${index}].source_id`)
    const relatedToSourceId = assertSafeId(relation.related_to_source_id, `${label}.relations[${index}].related_to_source_id`)
    if (!sourceIds.includes(sourceId) || !sourceIds.includes(relatedToSourceId) || sourceId === relatedToSourceId) sourceAssignmentPolicyFail(`${label}.relations[${index}] must connect two different article sources`)
    return {
      source_id: sourceId,
      related_to_source_id: relatedToSourceId,
      relation_type: assertSafeId(relation.relation_type, `${label}.relations[${index}].relation_type`),
      rationale: text(relation.rationale, `${label}.relations[${index}].rationale`),
    }
  })
  if (assignment.mode === 'single_source') {
    if (sourceIds.length !== 1 || relations.length !== 0) sourceAssignmentPolicyFail(`${label} single_source requires exactly one source and no relations`)
    return { mode: assignment.mode, anchor_source_id: anchorSourceId, relations }
  }
  if (sourceIds.length < 2) sourceAssignmentPolicyFail(`${label} ${assignment.mode} requires at least two sources`)
  const nonAnchorIds = sourceIds.filter((sourceId) => sourceId !== anchorSourceId)
  if (!sameSet(relations.map((relation) => relation.source_id), nonAnchorIds)) sourceAssignmentPolicyFail(`${label}.relations must assign every non-anchor source exactly once`)
  if (assignment.mode === 'meta_analysis_family') {
    if (!isMetaAnalysisSource(sourceById.get(anchorSourceId))) sourceAssignmentPolicyFail(`${label} meta_analysis_family anchor must be a meta-analysis, systematic review or umbrella review`)
    if (relations.some((relation) => relation.relation_type !== 'meta_constituent' || relation.related_to_source_id !== anchorSourceId)) sourceAssignmentPolicyFail(`${label} meta_analysis_family permits only direct meta_constituent relations to the anchor`)
    if (nonAnchorIds.some((sourceId) => sourceById.get(sourceId).source_kind !== 'study')) sourceAssignmentPolicyFail(`${label} meta_analysis_family constituents must be study sources`)
    return { mode: assignment.mode, anchor_source_id: anchorSourceId, relations }
  }
  if (relations.some((relation) => !DIRECT_RESEARCH_RELATIONS.has(relation.relation_type))) sourceAssignmentPolicyFail(`${label} direct_research_line contains a non-lineage relation`)
  const adjacency = new Map(sourceIds.map((sourceId) => [sourceId, []]))
  for (const relation of relations) {
    adjacency.get(relation.source_id).push(relation.related_to_source_id)
    adjacency.get(relation.related_to_source_id).push(relation.source_id)
  }
  const visited = new Set([anchorSourceId])
  const pending = [anchorSourceId]
  while (pending.length) {
    for (const next of adjacency.get(pending.pop())) if (!visited.has(next)) { visited.add(next); pending.push(next) }
  }
  if (visited.size !== sourceIds.length) sourceAssignmentPolicyFail(`${label} direct_research_line must form one connected lineage graph`)
  return { mode: assignment.mode, anchor_source_id: anchorSourceId, relations }
}

function validateResolvedGraphicDecision(value, label) {
  const decision = object(value, label)
  if (!['none', 'generate'].includes(decision.mode)) fail(`${label}.mode must be none or generate`)
  text(decision.reason, `${label}.reason`)
  const clusterIds = unique(decision.cluster_ids ?? [], `${label}.cluster_ids`, { allowEmpty: true })
  const obligationIds = unique(decision.obligation_ids ?? [], `${label}.obligation_ids`, { allowEmpty: true })
  const recordIds = unique(decision.record_ids ?? [], `${label}.record_ids`, { allowEmpty: true })
  if (decision.mode === 'generate' && (!clusterIds.length || !obligationIds.length || !recordIds.length)) fail(`${label} generate needs resolved cluster/obligation/record bindings`)
  if (decision.mode === 'none' && (clusterIds.length || obligationIds.length || recordIds.length)) fail(`${label} none cannot retain graphic bindings`)
  return { ...decision, cluster_ids: clusterIds, obligation_ids: obligationIds, record_ids: recordIds }
}

export function validateCoveragePlanV2(value, { researchHash, substance, language, runId: expectedRunId, allowFrameworkCatalogMismatch = false } = {}) {
  object(value, 'coverage plan')
  if (value.schema !== 'coverage_plan.v2') fail('coverage plan schema must equal coverage_plan.v2')
  const coveragePlanId = assertSafeId(value.coverage_plan_id, 'coverage_plan_id')
  const runId = assertSafeId(value.run_id, 'coverage.run_id')
  if (expectedRunId && runId !== expectedRunId) fail('coverage run_id differs from the active run')
  const planner = object(value.planner, 'coverage.planner')
  if (planner.role !== 'coverage-planner') fail('coverage planner role must equal coverage-planner')
  assertSafeId(planner.id, 'coverage.planner.id'); iso(planner.planned_at, 'coverage.planner.planned_at')
  const planSubstance = object(value.substance, 'coverage.substance')
  const planSlug = assertSafeId(planSubstance.slug, 'coverage.substance.slug')
  const planLanguage = text(planSubstance.language, 'coverage.substance.language')
  if (substance && planSlug !== substance) fail('coverage substance differs from run substance')
  if (language && planLanguage !== language) fail('coverage language differs from run language')
  if (researchHash && value.research_hash !== researchHash) fail('coverage research_hash differs from the current research bytes')
  if (!HASH.test(value.research_hash ?? '')) fail('coverage research_hash is invalid')
  const frameworkCatalogHash = sha256Bytes(readFileSync(CATALOG_PATH))
  if (!HASH.test(value.framework_catalog_hash ?? '')) fail('coverage framework_catalog_hash is invalid')
  if (!allowFrameworkCatalogMismatch && value.framework_catalog_hash !== frameworkCatalogHash) fail('coverage framework_catalog_hash differs from the canonical catalog bytes')
  if (value.stage2_source_assignment_policy !== STAGE2_SOURCE_ASSIGNMENT_POLICY) sourceAssignmentPolicyFail(`coverage stage2_source_assignment_policy must equal ${STAGE2_SOURCE_ASSIGNMENT_POLICY}`)
  if (value.stage3_source_label_policy !== STAGE3_SOURCE_LABEL_POLICY) sourceAssignmentPolicyFail(`coverage stage3_source_label_policy must equal ${STAGE3_SOURCE_LABEL_POLICY}`)
  bool(value.stage4_requested, 'coverage.stage4_requested')
  const sources = array(value.sources, 'coverage.sources').map(validateSource)
  const sourceIds = sources.map((entry) => entry.source_id)
  if (!sameSet(sourceIds, [...new Set(sourceIds)])) fail('coverage source IDs must be unique')
  const sourceSet = new Set(sourceIds)
  const sourceById = new Map(sources.map((entry) => [entry.source_id, entry]))
  for (const [identityType, values] of [
    ['DOI', sources.filter((source) => source.doi).map((source) => source.doi)],
    ['PMID', sources.filter((source) => source.pmid).map((source) => source.pmid)],
    ['canonical URL', sources.map((source) => normalizedSourceIdentityUrl(source.canonical_url))],
  ]) if (new Set(values).size !== values.length) sourceAssignmentPolicyFail(`coverage sources contain a duplicate ${identityType} identity`)
  const clusters = array(value.clusters, 'coverage.clusters').map((cluster, index) => {
    object(cluster, `clusters[${index}]`)
    const clusterId = assertSafeId(cluster.cluster_id, `clusters[${index}].cluster_id`)
    const sourceRefs = unique(cluster.source_ids, `cluster ${clusterId}.source_ids`)
    if (sourceRefs.some((id) => !sourceSet.has(id))) fail(`cluster ${clusterId} references an unknown source`)
    if (Object.hasOwn(cluster, 'risk_tags')) fail(`cluster ${clusterId} uses deprecated risk_tags; use plan_risk_tags`)
    return { ...cluster, cluster_id: clusterId, required: bool(cluster.required, `cluster ${clusterId}.required`), source_ids: sourceRefs, plan_risk_tags: validateRiskTags(cluster.plan_risk_tags ?? [], `cluster ${clusterId}.plan_risk_tags`) }
  })
  const clusterIds = clusters.map((entry) => entry.cluster_id)
  if (!sameSet(clusterIds, [...new Set(clusterIds)])) fail('coverage cluster IDs must be unique')
  const clusterSet = new Set(clusterIds)
  const catalog = json(CATALOG_PATH, 'framework catalog')
  const catalogEntries = new Map((catalog.frameworks ?? []).filter((entry) => entry.status === 'approved').map((entry) => [`${entry.framework_id}@${entry.version}`, entry]))
  const articles = array(value.articles, 'coverage.articles').map((article, index) => {
    object(article, `articles[${index}]`)
    const articleId = assertSafeId(article.article_id, `articles[${index}].article_id`)
    if (!['stage2', 'stage3'].includes(article.stage)) fail(`article ${articleId}.stage is invalid`)
    if (!['planned', 'blocked', 'excluded'].includes(article.status)) fail(`article ${articleId}.status is invalid`)
    const requiredClusterIds = unique(article.required_cluster_ids ?? [], `article ${articleId}.required_cluster_ids`, { allowEmpty: article.status !== 'planned' })
    if (requiredClusterIds.some((id) => !clusterSet.has(id))) fail(`article ${articleId} references an unknown cluster`)
    const articleSourceIds = unique(article.source_ids ?? [], `article ${articleId}.source_ids`, { allowEmpty: article.status !== 'planned' })
    if (articleSourceIds.some((id) => !sourceSet.has(id))) fail(`article ${articleId} references an unknown source`)
    const framework = object(article.framework, `article ${articleId}.framework`)
    const requestedFramework = { framework_id: text(framework.framework_id, `article ${articleId}.framework_id`), version: text(framework.version, `article ${articleId}.framework.version`) }
    const entry = catalogEntries.get(`${requestedFramework.framework_id}@${requestedFramework.version}`)
    if ((!entry || entry.stage !== article.stage) && article.status === 'planned') fail(`article ${articleId} does not bind an approved ${article.stage} framework`)
    let frameworkBinding = { ...requestedFramework, variant: 'unresolved', path: null, byte_hash: null }
    if (entry && entry.stage === article.stage) {
      const frameworkPath = resolveManifestPath(REPO_ROOT, entry.path, `article ${articleId}.framework.path`)
      if (!existsSync(frameworkPath)) fail(`article ${articleId} framework file is missing`)
      const frameworkByteHash = sha256Bytes(readFileSync(frameworkPath))
      if (frameworkByteHash !== entry.framework_sha256) fail(`article ${articleId} framework file bytes differ from catalog`)
      frameworkBinding = { framework_id: entry.framework_id, version: entry.version, variant: entry.variant, path: portablePath(REPO_ROOT, frameworkPath), byte_hash: frameworkByteHash }
    }
    const seoBrief = validateSeoBrief(article.seo_brief, `article ${articleId}.seo_brief`)
    const base = { ...article, article_id: articleId, slug: assertSafeId(article.slug, `article ${articleId}.slug`), required_cluster_ids: requiredClusterIds, source_ids: articleSourceIds, framework: frameworkBinding, framework_hash: canonicalJsonHash(frameworkBinding), seo_brief: seoBrief, selected_link_slice: validateSelectedLinkSlice(article.selected_link_slice, seoBrief, `article ${articleId}.selected_link_slice`) }
    if (article.stage === 'stage2' && article.status === 'planned') {
      base.source_assignment = validateStage2SourceAssignment(article.source_assignment, { articleId, sourceIds: articleSourceIds, sourceById })
      base.source_presentation_label_de = text(article.source_presentation_label_de, `article ${articleId}.source_presentation_label_de`)
    }
    else if (Object.hasOwn(article, 'source_assignment')) sourceAssignmentPolicyFail(`article ${articleId}.source_assignment is only valid for planned Stage-2 articles`)
    if (article.stage === 'stage3' && article.status === 'planned') {
      for (const link of base.selected_link_slice.links) {
        if (link.covered_source_ids?.some((sourceId) => !articleSourceIds.includes(sourceId))) fail(`article ${articleId} internal link ${link.path} covers a source outside the Stage-3 article slice`)
      }
      base.blueprint = object(article.blueprint, `article ${articleId}.blueprint`)
      base.blueprint.blueprint_id = assertSafeId(base.blueprint.blueprint_id, `article ${articleId}.blueprint.blueprint_id`)
      base.blueprint.sections = unique(base.blueprint.sections, `article ${articleId}.blueprint.sections`)
      base.blueprint.readability_target = text(base.blueprint.readability_target, `article ${articleId}.blueprint.readability_target`)
      base.controversies = array(article.controversies ?? [], `article ${articleId}.controversies`).map((controversy, controversyIndex) => {
        object(controversy, `article ${articleId}.controversies[${controversyIndex}]`)
        const controversyId = assertSafeId(controversy.controversy_id, `article ${articleId}.controversy_id`)
        const controversySourceIds = unique(controversy.source_ids, `article ${articleId}.${controversyId}.source_ids`)
        const controversyClusterIds = unique(controversy.cluster_ids, `article ${articleId}.${controversyId}.cluster_ids`)
        if (controversySourceIds.some((id) => !sourceSet.has(id)) || controversyClusterIds.some((id) => !clusterSet.has(id))) fail(`article ${articleId} controversy references an unknown source/cluster`)
        if (!['explain', 'limit_claim', 'omit_as_immaterial'].includes(controversy.disposition)) fail(`article ${articleId} controversy disposition is invalid`)
        text(controversy.issue, `article ${articleId}.${controversyId}.issue`); text(controversy.materiality, `article ${articleId}.${controversyId}.materiality`)
        if (controversy.disposition === 'omit_as_immaterial') text(controversy.reason, `article ${articleId}.${controversyId}.reason`)
        return { ...controversy, controversy_id: controversyId, source_ids: controversySourceIds, cluster_ids: controversyClusterIds }
      })
      base.common_assumption_review = validateCommonAssumptionReview(article.common_assumption_review, `article ${articleId}.common_assumption_review`)
      base.graphic_decision = validateGraphicDecision(article.graphic_decision, `article ${articleId}.graphic_decision`)
    }
    return base
  })
  const articleIds = articles.map((entry) => entry.article_id)
  const slugs = articles.map((entry) => entry.slug)
  if (!sameSet(articleIds, [...new Set(articleIds)]) || !sameSet(slugs, [...new Set(slugs)])) fail('coverage article IDs and slugs must be unique')
  const articleById = new Map(articles.map((entry) => [entry.article_id, entry]))
  for (const article of articles) for (const link of article.selected_link_slice.links) {
    if (link.target_state !== 'same_release') continue
    const target = articleById.get(link.target_article_id)
    if (!target || target.status !== 'planned') fail(`article ${article.article_id} same_release target ${link.target_article_id} is not a planned article`)
    if (target.slug !== link.target_id || link.path !== `/wissen/${target.slug}`) fail(`article ${article.article_id} same_release target ${link.target_article_id} path/slug differs`)
    if (target.article_id === article.article_id) fail(`article ${article.article_id} cannot use itself as a same_release target`)
    if (link.covered_source_ids?.length && target.stage !== 'stage2') sourceAssignmentPolicyFail(`article ${article.article_id} source presentation target ${link.target_article_id} must be a Stage-2 article`)
    if (link.covered_source_ids?.some((sourceId) => !target.source_ids.includes(sourceId))) sourceAssignmentPolicyFail(`article ${article.article_id} same_release target ${link.target_article_id} cannot cover sources outside the target Stage-2 article`)
    if (link.covered_source_ids?.length && link.title !== target.source_presentation_label_de) sourceAssignmentPolicyFail(`article ${article.article_id} source presentation label must equal the German original-title label of ${link.target_article_id}`)
  }
  const plannedStage2Articles = articles.filter((entry) => entry.stage === 'stage2' && entry.status === 'planned')
  const plannedStage3Articles = articles.filter((entry) => entry.stage === 'stage3' && entry.status === 'planned')
  // A meta-family owns only its review/meta anchor. Its constituent studies
  // are visible original citations, not additional carrier assignments. The
  // same primary study may therefore be cited by multiple independently
  // selected meta-families without acquiring duplicate Stage-2 carriers.
  const carrierSourceIds = (article) => article.source_assignment.mode === 'meta_analysis_family'
    ? [article.source_assignment.anchor_source_id]
    : article.source_ids
  const assignedStage2Sources = plannedStage2Articles.flatMap((article) => carrierSourceIds(article).map((sourceId) => ({ sourceId, articleId: article.article_id })))
  const duplicateStage2Sources = [...new Set(assignedStage2Sources.map((entry) => entry.sourceId).filter((sourceId, index, all) => all.indexOf(sourceId) !== index))].sort()
  if (duplicateStage2Sources.length) sourceAssignmentPolicyFail(`planned Stage-2 sources must have exactly one carrier article: ${duplicateStage2Sources.join(', ')}`)
  const metaConstituentSourceIds = new Set(plannedStage2Articles
    .filter((article) => article.source_assignment.mode === 'meta_analysis_family')
    .flatMap((article) => article.source_assignment.relations.map((relation) => relation.source_id)))
  const independentlyCarriedMetaConstituents = [...metaConstituentSourceIds].filter((sourceId) => assignedStage2Sources.some((entry) => entry.sourceId === sourceId)).sort()
  if (independentlyCarriedMetaConstituents.length) sourceAssignmentPolicyFail(`meta-analysis constituents cannot receive a separate Stage-2 carrier: ${independentlyCarriedMetaConstituents.join(', ')}`)
  if (plannedStage3Articles.length) {
    const stage3SourceSet = new Set(plannedStage3Articles.flatMap((article) => article.source_ids))
    const orphanStage2Sources = [...new Set(assignedStage2Sources.map((entry) => entry.sourceId).filter((sourceId) => !stage3SourceSet.has(sourceId)))].sort()
    if (orphanStage2Sources.length) sourceAssignmentPolicyFail(`planned Stage-2 carrier sources are absent from all planned Stage-3 articles: ${orphanStage2Sources.join(', ')}`)
    const stage3MetaConstituents = [...metaConstituentSourceIds].filter((sourceId) => stage3SourceSet.has(sourceId)).sort()
    if (stage3MetaConstituents.length) sourceAssignmentPolicyFail(`Stage-3 source presentation must use meta-family anchors, not their constituent studies: ${stage3MetaConstituents.join(', ')}`)
  }
  for (const article of plannedStage3Articles) {
    const presentations = article.selected_link_slice.links.flatMap((link) => (link.covered_source_ids ?? []).map((sourceId) => ({ sourceId, link })))
    const presentedIds = presentations.map((entry) => entry.sourceId)
    const duplicates = [...new Set(presentedIds.filter((sourceId, index) => presentedIds.indexOf(sourceId) !== index))].sort()
    if (duplicates.length) sourceAssignmentPolicyFail(`article ${article.article_id} presents original sources through more than one Stage-2 link: ${duplicates.join(', ')}`)
    if (!sameSet(presentedIds, article.source_ids)) sourceAssignmentPolicyFail(`article ${article.article_id} must present every original source exactly once through internal Stage-2 links`)
    for (const presentation of presentations) {
      const plannedCarrier = assignedStage2Sources.find((entry) => entry.sourceId === presentation.sourceId)
      if (plannedCarrier && (presentation.link.target_state !== 'same_release' || presentation.link.target_article_id !== plannedCarrier.articleId)) sourceAssignmentPolicyFail(`article ${article.article_id} must present source ${presentation.sourceId} through its planned Stage-2 carrier ${plannedCarrier.articleId}`)
    }
  }
  const frameworkGaps = array(value.framework_gaps ?? [], 'coverage.framework_gaps').map((gap, index) => {
    object(gap, `framework_gaps[${index}]`)
    const gapId = assertSafeId(gap.gap_id, `framework_gaps[${index}].gap_id`)
    const articleId = assertSafeId(gap.article_id, `framework gap ${gapId}.article_id`)
    const article = articleById.get(articleId)
    if (!article || article.status !== 'blocked') fail(`framework gap ${gapId} must reference a blocked article`)
    if (gap.stage !== article.stage) fail(`framework gap ${gapId} stage differs from its article`)
    if (!['adapt_existing', 'new_archetype'].includes(gap.decision)) fail(`framework gap ${gapId}.decision is invalid`)
    const targetFrameworkId = assertSafeId(gap.target_framework_id, `framework gap ${gapId}.target_framework_id`)
    const targetVersion = text(gap.target_version, `framework gap ${gapId}.target_version`)
    const targetFrameworkPath = text(gap.target_framework_path, `framework gap ${gapId}.target_framework_path`).replaceAll('\\', '/')
    if (!targetFrameworkPath.startsWith('codex-files/frameworks/') || !targetFrameworkPath.endsWith('.md') || targetFrameworkPath.includes('..')) fail(`framework gap ${gapId}.target_framework_path must be a framework Markdown path`)
    const ownerApprovalRequired = bool(gap.owner_approval_required, `framework gap ${gapId}.owner_approval_required`)
    if (ownerApprovalRequired !== (gap.decision === 'new_archetype')) fail(`framework gap ${gapId}.owner_approval_required differs from its decision`)
    const candidateFrameworkId = gap.decision === 'adapt_existing' ? assertSafeId(gap.candidate_framework_id, `framework gap ${gapId}.candidate_framework_id`) : null
    const candidateFrameworkVersion = gap.decision === 'adapt_existing' ? text(gap.candidate_framework_version, `framework gap ${gapId}.candidate_framework_version`) : null
    text(gap.reason, `framework gap ${gapId}.reason`)
    return { ...gap, gap_id: gapId, article_id: articleId, stage: article.stage, target_framework_id: targetFrameworkId, target_version: targetVersion, target_framework_path: targetFrameworkPath, candidate_framework_id: candidateFrameworkId, candidate_framework_version: candidateFrameworkVersion, owner_approval_required: ownerApprovalRequired }
  })
  if (new Set(frameworkGaps.map((entry) => entry.gap_id)).size !== frameworkGaps.length || new Set(frameworkGaps.map((entry) => entry.article_id)).size !== frameworkGaps.length) fail('framework gaps must have unique gap/article IDs')
  for (const article of articles.filter((entry) => entry.framework.variant === 'unresolved')) if (!frameworkGaps.some((gap) => gap.article_id === article.article_id)) fail(`blocked article ${article.article_id} has an unresolved framework without framework_gap`)
  for (const gap of frameworkGaps) if (articleById.get(gap.article_id).framework.variant !== 'unresolved') fail(`framework gap ${gap.gap_id} redundantly targets an approved framework`)
  const obligations = array(value.extraction_obligations, 'coverage.extraction_obligations').map((obligation, index) => {
    object(obligation, `extraction_obligations[${index}]`)
    const obligationId = assertSafeId(obligation.obligation_id, `extraction_obligations[${index}].obligation_id`)
    const sourceId = assertSafeId(obligation.source_id, `obligation ${obligationId}.source_id`)
    const clusterId = assertSafeId(obligation.cluster_id, `obligation ${obligationId}.cluster_id`)
    if (!sourceSet.has(sourceId) || !clusterSet.has(clusterId)) fail(`obligation ${obligationId} references unknown source/cluster`)
    const requiredFor = unique(obligation.required_for, `obligation ${obligationId}.required_for`)
    if (requiredFor.some((id) => !articleById.has(id))) fail(`obligation ${obligationId} references an unknown article`)
    if (Object.hasOwn(obligation, 'risk_tags')) fail(`obligation ${obligationId} uses deprecated risk_tags; use plan_risk_tags`)
    return {
      ...obligation,
      obligation_id: obligationId,
      source_id: sourceId,
      cluster_id: clusterId,
      expected_claim_type: assertSafeId(obligation.expected_claim_type, `obligation ${obligationId}.expected_claim_type`),
      required: bool(obligation.required, `obligation ${obligationId}.required`),
      required_for: requiredFor,
      plan_risk_tags: validateRiskTags(obligation.plan_risk_tags ?? [], `obligation ${obligationId}.plan_risk_tags`),
    }
  })
  const obligationIds = obligations.map((entry) => entry.obligation_id)
  if (!sameSet(obligationIds, [...new Set(obligationIds)])) fail('extraction obligation IDs must be unique')
  const tupleKeys = obligations.map((entry) => `${entry.source_id}|${entry.cluster_id}|${entry.expected_claim_type}`)
  if (!sameSet(tupleKeys, [...new Set(tupleKeys)])) fail('each source×cluster×expected_claim_type obligation must be unique')
  const activeIds = new Set(articles.filter((entry) => entry.status === 'planned').map((entry) => entry.article_id))
  for (const obligation of obligations) if (!obligation.required_for.some((id) => activeIds.has(id))) fail(`obligation ${obligation.obligation_id} is not required by a planned article`)
  for (const articleId of activeIds) {
    const article = articleById.get(articleId)
    for (const clusterId of article.required_cluster_ids) if (!obligations.some((entry) => entry.cluster_id === clusterId && entry.required_for.includes(articleId))) fail(`planned article ${articleId} has no extraction obligation for required cluster ${clusterId}`)
    const obligationSources = sorted(new Set(obligations.filter((entry) => entry.required_for.includes(articleId)).map((entry) => entry.source_id)))
    if (!sameSet(article.source_ids, obligationSources)) fail(`planned article ${articleId} source_ids differ from its extraction obligations`)
    if (article.stage === 'stage3') {
      const graphic = article.graphic_decision
      if (graphic.cluster_ids.some((id) => !article.required_cluster_ids.includes(id))) fail(`article ${articleId} graphic decision references a non-required cluster`)
      if (graphic.obligation_ids.some((id) => !obligations.some((entry) => entry.obligation_id === id && entry.required_for.includes(articleId)))) fail(`article ${articleId} graphic decision references an unknown/non-article obligation`)
      const graphicClusters = sorted(new Set(graphic.obligation_ids.map((id) => obligations.find((entry) => entry.obligation_id === id).cluster_id)))
      if (!sameSet(graphic.cluster_ids, graphicClusters)) fail(`article ${articleId} graphic cluster/obligation bindings differ`)
      for (const check of article.common_assumption_review.checks) {
        if (check.source_ids.some((id) => !article.source_ids.includes(id))) fail(`article ${articleId} assumption ${check.assumption_id} references a non-article source`)
        if (check.cluster_ids.some((id) => !article.required_cluster_ids.includes(id))) fail(`article ${articleId} assumption ${check.assumption_id} references a non-required cluster`)
        const assumptionObligations = check.obligation_ids.map((id) => obligations.find((entry) => entry.obligation_id === id && entry.required_for.includes(articleId)))
        if (assumptionObligations.some((entry) => !entry)) fail(`article ${articleId} assumption ${check.assumption_id} references an unknown/non-article obligation`)
        if (!sameSet(check.source_ids, sorted(new Set(assumptionObligations.map((entry) => entry.source_id))))) fail(`article ${articleId} assumption ${check.assumption_id} source/obligation bindings differ`)
        if (!sameSet(check.cluster_ids, sorted(new Set(assumptionObligations.map((entry) => entry.cluster_id))))) fail(`article ${articleId} assumption ${check.assumption_id} cluster/obligation bindings differ`)
      }
    }
  }
  if (value.content_hash !== artifactHash(value)) fail('coverage plan content_hash is stale')
  return { ...value, coverage_plan_id: coveragePlanId, run_id: runId, framework_catalog_hash: value.framework_catalog_hash, stage2_source_assignment_policy: STAGE2_SOURCE_ASSIGNMENT_POLICY, stage3_source_label_policy: STAGE3_SOURCE_LABEL_POLICY, substance: { slug: planSlug, language: planLanguage }, sources, clusters, articles, framework_gaps: frameworkGaps, extraction_obligations: obligations }
}

function resolveEnvironmentRoot(manifestPath, mode) {
  const absolute = resolve(manifestPath)
  if (mode === 'production') {
    assertContained(REPO_ROOT, absolute, 'production evidence manifest')
    return REPO_ROOT
  }
  if (mode !== 'test') fail('evidence manifest mode must be explicit production or test')
  return dirname(absolute)
}

export function loadEvidenceManifestV2(manifestPath, expected = {}) {
  const absolute = resolve(manifestPath)
  const raw = json(absolute, 'evidence manifest')
  if (raw.schema !== 'evidence_pipeline_build.v2') fail('evidence manifest schema must equal evidence_pipeline_build.v2')
  if (raw.content_hash !== artifactHash(raw)) fail('evidence manifest content_hash is stale')
  const mode = text(raw.mode, 'evidence manifest mode')
  const policyVersion = text(raw.policy_version, 'evidence manifest.policy_version')
  const validatorVersion = text(raw.validator_version, 'evidence manifest.validator_version')
  if (expected.policyVersion && policyVersion !== expected.policyVersion) fail('evidence manifest policy_version differs from the active run')
  if (expected.validatorVersion && validatorVersion !== expected.validatorVersion) fail('evidence manifest validator_version differs from the active run')
  const root = resolveEnvironmentRoot(absolute, mode)
  const coveragePlanPath = resolveManifestPath(root, raw.coverage_plan_path, 'coverage_plan_path')
  const researchPath = resolveManifestPath(root, raw.research_path, 'research_path')
  const sourceArtifactReceiptPath = resolveManifestPath(root, raw.source_artifact_receipt_path, 'source_artifact_receipt_path')
  if (raw.max_sources_per_slice !== 4) fail('evidence manifest max_sources_per_slice must equal 4')
  if (expected.coveragePlanPath && resolve(expected.coveragePlanPath) !== coveragePlanPath) fail('run coverage path differs from evidence manifest coverage path')
  if (expected.researchPath && resolve(expected.researchPath) !== researchPath) fail('run research path differs from evidence manifest research path')
  let researchHash = null
  if (existsSync(researchPath)) {
    const researchBytes = readFileSync(researchPath)
    const decodedResearch = decodeUtf8Strict(researchBytes, 'opaque research input')
    if (decodedResearch.errors.length) fail(decodedResearch.errors.join('; '))
    researchHash = sha256Bytes(researchBytes)
  }
  const coveragePlan = existsSync(coveragePlanPath) ? validateCoveragePlanV2(json(coveragePlanPath), { researchHash, substance: expected.substance, language: expected.language, runId: expected.runId }) : null
  if (raw.research_hash !== researchHash) fail('evidence manifest research_hash differs from current research bytes')
  if (coveragePlan && raw.coverage_plan_hash !== coveragePlan.content_hash) fail('evidence manifest coverage_plan_hash differs from the current coverage plan')
  if (!HASH.test(raw.source_artifact_receipt_hash ?? '')) fail('evidence manifest source_artifact_receipt_hash is invalid')
  if (expected.sourceArtifactReceiptPath && resolve(expected.sourceArtifactReceiptPath) !== sourceArtifactReceiptPath) fail('run source artifact receipt path differs from evidence manifest')
  if (expected.sourceArtifactReceiptHash && expected.sourceArtifactReceiptHash !== raw.source_artifact_receipt_hash) fail('run source artifact receipt hash differs from evidence manifest')
  const shardPaths = unique(raw.source_evidence_shard_paths ?? [], 'source_evidence_shard_paths', { allowEmpty: true }).map((path, index) => resolveManifestPath(root, path, `source_evidence_shard_paths[${index}]`))
  const extractionSlices = array(raw.extraction_slices ?? [], 'extraction_slices').map((slice, index) => {
    object(slice, `extraction_slices[${index}]`)
    const shardPath = resolveManifestPath(root, slice.shard_path, `extraction_slices[${index}].shard_path`)
    if (!shardPaths.includes(shardPath)) fail(`extraction slice ${index} references an undeclared shard path`)
    return {
      slice_id: assertSafeId(slice.slice_id, `extraction_slices[${index}].slice_id`),
      shard_path: shardPath,
      source_ids: unique(slice.source_ids, `extraction_slices[${index}].source_ids`),
      obligation_ids: unique(slice.obligation_ids, `extraction_slices[${index}].obligation_ids`),
      cluster_ids: unique(slice.cluster_ids, `extraction_slices[${index}].cluster_ids`),
    }
  })
  if (extractionSlices.some((slice) => slice.source_ids.length > 4)) fail('an extraction slice exceeds the four-source concurrency cap')
  if (new Set(extractionSlices.map((slice) => slice.slice_id)).size !== extractionSlices.length || new Set(extractionSlices.map((slice) => slice.shard_path)).size !== extractionSlices.length || !sameSet(extractionSlices.map((slice) => slice.shard_path), shardPaths)) fail('extraction_slices must bind every declared shard path exactly once')
  if (coveragePlan) {
    const plannedIds = new Set(coveragePlan.articles.filter((article) => article.status === 'planned').map((article) => article.article_id))
    const activeObligations = coveragePlan.extraction_obligations.filter((obligation) => obligation.required_for.some((id) => plannedIds.has(id)))
    const obligationById = new Map(activeObligations.map((obligation) => [obligation.obligation_id, obligation]))
    const assignedObligations = extractionSlices.flatMap((slice) => slice.obligation_ids)
    if (!sameSet(assignedObligations, activeObligations.map((obligation) => obligation.obligation_id))) fail('extraction_slices must partition the active obligation set exactly once')
    for (const slice of extractionSlices) {
      if (slice.obligation_ids.some((id) => !obligationById.has(id))) fail(`extraction slice ${slice.slice_id} references an inactive/unknown obligation`)
      const obligations = slice.obligation_ids.map((id) => obligationById.get(id))
      if (!sameSet(slice.source_ids, sorted(new Set(obligations.map((entry) => entry.source_id)))) || !sameSet(slice.cluster_ids, sorted(new Set(obligations.map((entry) => entry.cluster_id))))) fail(`extraction slice ${slice.slice_id} source/cluster lineage differs from its obligation slice`)
    }
  }
  const declaredReviewPaths = unique(raw.source_facts_review_paths ?? [], 'source_facts_review_paths', { allowEmpty: true }).map((path, index) => resolveManifestPath(root, path, `source_facts_review_paths[${index}]`))
  const reviewSlices = raw.source_facts_review_slices === undefined
    ? declaredReviewPaths.map((path, index) => ({ sampling_round: index, shard_id: `legacy-round-${index}`, path }))
    : array(raw.source_facts_review_slices, 'source_facts_review_slices').map((slice, index) => {
      object(slice, `source_facts_review_slices[${index}]`)
      const samplingRound = Number(slice.sampling_round)
      if (![0, 1].includes(samplingRound)) fail(`source_facts_review_slices[${index}].sampling_round must be 0 or 1`)
      const shardId = assertSafeId(slice.shard_id, `source_facts_review_slices[${index}].shard_id`)
      const path = resolveManifestPath(root, slice.path, `source_facts_review_slices[${index}].path`)
      return { sampling_round: samplingRound, shard_id: shardId, path }
    })
  const reviewPaths = reviewSlices.map((slice) => slice.path)
  if (new Set(reviewPaths).size !== reviewPaths.length || new Set(reviewSlices.map((slice) => slice.shard_id)).size !== reviewSlices.length) fail('source_facts_review_slices paths and shard_ids must be unique')
  if (declaredReviewPaths.length && !sameSet(declaredReviewPaths, reviewPaths)) fail('source_facts_review_paths and source_facts_review_slices must declare the same paths')
  for (const round of [0, 1]) {
    const slices = reviewSlices.filter((slice) => slice.sampling_round === round)
    if (slices.length > 4) fail(`source facts review round ${round} exceeds concurrency cap C=4`)
  }
  object(raw.source_artifacts ?? {}, 'source_artifacts')
  const sourceArtifactPaths = Object.fromEntries(Object.entries(raw.source_artifacts ?? {}).map(([id, path]) => [assertSafeId(id, `source_artifacts.${id}`), resolveManifestPath(root, path, `source_artifacts.${id}`)]))
  const slicedSourceIds = sorted(new Set(extractionSlices.flatMap((slice) => slice.source_ids)))
  if (!sameSet(Object.keys(sourceArtifactPaths), slicedSourceIds)) fail('source_artifacts must exactly map the source IDs assigned by extraction_slices')
  assertNoPathCollisions([
    { path: coveragePlanPath, label: 'coverage plan', kind: 'input' }, { path: researchPath, label: 'research', kind: 'input' }, { path: sourceArtifactReceiptPath, label: 'source artifact receipt', kind: 'input' },
    ...shardPaths.map((path, index) => ({ path, label: `shard ${index}`, kind: 'input' })), ...reviewPaths.map((path, index) => ({ path, label: `review ${index}`, kind: 'input' })),
    ...Object.entries(sourceArtifactPaths).map(([id, path]) => ({ path, label: `source ${id}`, kind: 'input' })),
  ])
  return { absolute, root, mode, policyVersion, validatorVersion, manifest: raw, coveragePlanPath, researchPath, researchHash, sourceArtifactReceiptPath, sourceArtifactReceiptHash: raw.source_artifact_receipt_hash, coveragePlan, shardPaths, extractionSlices, reviewPaths, reviewSlices, sourceArtifactPaths }
}

function validateRecord(record, obligation, stage4Requested) {
  object(record, `record for ${obligation.obligation_id}`)
  if (record.schema !== 'source_evidence_record.v2') fail(`record ${record.record_id ?? '(missing)'} schema must equal source_evidence_record.v2`)
  const recordId = assertSafeId(record.record_id, 'record_id')
  if (record.obligation_id !== obligation.obligation_id || record.source_id !== obligation.source_id || record.cluster_id !== obligation.cluster_id || record.claim_type !== obligation.expected_claim_type) fail(`record ${recordId} differs from its extraction obligation`)
  const subjectKey = assertSafeId(record.subject_key, `record ${recordId}.subject_key`)
  const predicateKey = assertSafeId(record.predicate_key, `record ${recordId}.predicate_key`)
  object(record.context, `record ${recordId}.context`)
  if (!(record.conflict_set_id === null || record.conflict_set_id === undefined || typeof record.conflict_set_id === 'string' && /^[a-z0-9]+(?:[._-][a-z0-9]+)*$/.test(record.conflict_set_id))) fail(`record ${recordId}.conflict_set_id must be null or a safe ID`)
  text(record.claim, `record ${recordId}.claim`); text(record.locator, `record ${recordId}.locator`); text(record.uncertainty, `record ${recordId}.uncertainty`)
  if (!(record.value === null || Number.isFinite(record.value))) fail(`record ${recordId}.value must be null or finite`)
  if (!(record.unit === null || typeof record.unit === 'string' && record.unit.trim())) fail(`record ${recordId}.unit must be null or non-empty`)
  if (record.value !== null && record.unit === null) fail(`record ${recordId} numeric value needs a unit`)
  if (Object.hasOwn(record, 'risk_tags')) fail(`record ${recordId} uses deprecated risk_tags; use extractor_risk_tags`)
  validateRiskTags(record.extractor_risk_tags ?? [], `record ${recordId}.extractor_risk_tags`)
  if (record.stack_projection != null) fail(`record ${recordId} must never embed stack_projection; Stage 4 creates a standalone stack_projection.v2 after the facts gate`)
  let stage4Relevance = null
  if (record.stage4_relevance != null) {
    if (!stage4Requested) fail(`record ${recordId} must omit stage4_relevance when Stage 4 is not requested`)
    const relevance = object(record.stage4_relevance, `record ${recordId}.stage4_relevance`)
    if (relevance.status !== 'candidate') fail(`record ${recordId}.stage4_relevance.status must equal candidate`)
    const allowedKeys = new Set(['status', 'reason', 'locator'])
    const forbiddenKeys = Object.keys(relevance).filter((key) => !allowedKeys.has(key))
    if (forbiddenKeys.length) fail(`record ${recordId}.stage4_relevance contains operational or unsupported fields: ${forbiddenKeys.join(', ')}`)
    stage4Relevance = {
      status: 'candidate',
      reason: text(relevance.reason, `record ${recordId}.stage4_relevance.reason`),
      locator: text(relevance.locator, `record ${recordId}.stage4_relevance.locator`),
    }
  }
  return {
    ...record,
    record_id: recordId,
    subject_key: subjectKey,
    predicate_key: predicateKey,
    conflict_set_id: record.conflict_set_id ?? null,
    extractor_risk_tags: record.extractor_risk_tags ?? [],
    ...(stage4Relevance ? { stage4_relevance: stage4Relevance } : {}),
  }
}

function addSemanticRisks(risks, words) {
  const normalized = words.toLowerCase()
  if (/(?:^|[_ -])(?:safety|upper[_ -]?limit|tolerable[_ -]?upper|ul|adverse|toxicity|toxic)(?:$|[_ -])/.test(normalized)) risks.add('safety')
  if (/(?:^|[_ -])(?:reference[_ -]?value|recommended[_ -]?intake|dietary[_ -]?reference|nutrient[_ -]?reference)(?:$|[_ -])/.test(normalized)) risks.add('dose_or_reference')
  if (/(?:^|[_ -])(?:interaction|contraindication)(?:$|[_ -])/.test(normalized)) risks.add('interaction')
  if (/(?:^|[_ -])(?:vulnerable|pregnan|pregnancy|breastfeeding|child|children|elderly)(?:$|[_ -])/.test(normalized)) risks.add('vulnerable_population')
  if (/(?:^|[_ -])(?:controversy|controversial|conflict|contradiction)(?:$|[_ -])/.test(normalized)) risks.add('controversy')
}

function derivedRisks({ obligation, records, cluster, source, controversies, warnings, status }) {
  const risks = new Set([...obligation.plan_risk_tags, ...(cluster.plan_risk_tags ?? [])])
  addSemanticRisks(risks, `${obligation.expected_claim_type} ${obligation.cluster_id} ${source.source_type} ${source.label}`)
  if (controversies.some((entry) => entry.cluster_ids.includes(obligation.cluster_id) || entry.source_ids.includes(obligation.source_id))) risks.add('controversy')
  for (const record of records) {
    for (const risk of validateRiskTags(record.extractor_risk_tags ?? [], `record ${record.record_id}.extractor_risk_tags`)) risks.add(risk)
    addSemanticRisks(risks, `${record.claim_type} ${record.cluster_id} ${record.population_context ?? ''}`)
    if (record.stage4_relevance?.status === 'candidate') risks.add('stage4_relevance')
  }
  if (status === 'not_reported') risks.add('warning')
  if (warnings.some((entry) => /(?:material|safety|critical|blocking|contradiction|source[_ -]?hash|locator)/i.test(entry.code))) risks.add('warning')
  risks.delete('standard')
  const riskTags = risks.size ? sorted(risks) : ['standard']
  const fullReviewRequired = riskTags.some((risk) => HIGH_RISKS.has(risk))
  return { effective_risk: fullReviewRequired ? 'high' : 'low', risk_tags: riskTags, full_review_required: fullReviewRequired }
}

export function mergeEvidenceV2(input) {
  const plan = input.coveragePlan
  const activeArticles = plan.articles.filter((entry) => entry.status === 'planned')
  const activeIds = new Set(activeArticles.map((entry) => entry.article_id))
  const activeObligations = plan.extraction_obligations.filter((entry) => entry.required_for.some((id) => activeIds.has(id)))
  if (!activeArticles.length) {
    const merger = object(input.manifest.merger, 'merger')
    if (merger.role !== 'evidence-bundle-merger') fail('merger role must equal evidence-bundle-merger')
    const base = {
      schema: 'source_evidence_bundle.v2', bundle_id: assertSafeId(input.manifest.bundle_id, 'bundle_id'), run_id: plan.run_id,
      coverage_plan_id: plan.coverage_plan_id, coverage_plan_hash: plan.content_hash, research_hash: input.researchHash,
      stage4_requested: plan.stage4_requested, records: [], obligation_results: [], warnings: [], extractors: [],
      merged_by: { role: merger.role, id: assertSafeId(merger.id, 'merger.id'), merged_at: iso(plan.planner.planned_at, 'coverage.planner.planned_at') },
    }
    return { bundle: { ...base, content_hash: artifactHash(base) }, extractorIds: new Set(), activeArticles }
  }
  const obligationById = new Map(activeObligations.map((entry) => [entry.obligation_id, entry]))
  const sourceById = new Map(plan.sources.map((entry) => [entry.source_id, entry]))
  const clusterById = new Map(plan.clusters.map((entry) => [entry.cluster_id, entry]))
  const shards = input.shardPaths.map((path) => json(path, 'source evidence shard'))
  const seenSources = new Set(), seenObligations = new Set(), seenRecords = new Set(), extractorIds = new Set()
  const records = [], outcomes = [], warnings = [], materialConflictSignals = [], extractedAt = []
  for (const [shardIndex, shard] of shards.entries()) {
    const declaredSlice = input.extractionSlices.find((slice) => slice.shard_path === input.shardPaths[shardIndex])
    if (!declaredSlice) fail(`shard ${shardIndex} has no declared extraction slice`)
    if (shard.schema !== 'source_evidence_shard.v2') fail(`shard ${shard.shard_id ?? '(missing)'} schema must equal source_evidence_shard.v2`)
    assertSafeId(shard.shard_id, 'shard_id')
    if (shard.coverage_plan_id !== plan.coverage_plan_id || shard.coverage_plan_hash !== plan.content_hash) fail(`shard ${shard.shard_id} has stale coverage binding`)
    if (shard.extractor?.role !== 'source-evidence-extractor') fail(`shard ${shard.shard_id} has invalid extractor role`)
    const extractorId = assertSafeId(shard.extractor.id, `shard ${shard.shard_id}.extractor.id`)
    if (shard.repair_lineage != null) {
      object(shard.repair_lineage, `shard ${shard.shard_id}.repair_lineage`)
      if (!HASH.test(shard.repair_lineage.work_order_id ?? '') || !HASH.test(shard.repair_lineage.predecessor_shard_hash ?? '') || !HASH.test(shard.repair_lineage.failure_fingerprint ?? '') || shard.repair_lineage.repair_generation !== 1) fail(`shard ${shard.shard_id}.repair_lineage is invalid`)
    }
    extractorIds.add(extractorId); extractedAt.push(iso(shard.extracted_at, `shard ${shard.shard_id}.extracted_at`))
    const shardSourceIds = unique(shard.source_ids, `shard ${shard.shard_id}.source_ids`)
    if (!sameSet(shardSourceIds, declaredSlice.source_ids)) fail(`shard ${shard.shard_id} source IDs differ from extraction slice ${declaredSlice.slice_id}`)
    for (const sourceId of shardSourceIds) {
      if (!sourceById.has(sourceId) || seenSources.has(sourceId)) fail(`source ${sourceId} is unknown or assigned to multiple extractors`)
      const artifactPath = input.sourceArtifactPaths[sourceId]
      if (!artifactPath || !existsSync(artifactPath) || sha256Bytes(readFileSync(artifactPath)) !== sourceById.get(sourceId).source_content_hash) fail(`source ${sourceId} artifact bytes/hash mismatch`)
      seenSources.add(sourceId)
    }
    const shardWarnings = array(shard.warnings ?? [], `shard ${shard.shard_id}.warnings`).map((warning, index) => {
      object(warning, `shard ${shard.shard_id}.warnings[${index}]`)
      const obligationId = assertSafeId(warning.obligation_id, 'warning.obligation_id')
      text(warning.code, 'warning.code'); text(warning.message, 'warning.message')
      return { ...warning, obligation_id: obligationId, extractor_id: extractorId }
    })
    warnings.push(...shardWarnings)
    const shardSignals = array(shard.material_conflict_signals ?? [], `shard ${shard.shard_id}.material_conflict_signals`).map((signal, index) => {
      object(signal, `shard ${shard.shard_id}.material_conflict_signals[${index}]`)
      const signalId = assertSafeId(signal.signal_id, 'material conflict signal_id')
      const obligationId = assertSafeId(signal.obligation_id, `${signalId}.obligation_id`)
      const obligation = obligationById.get(obligationId)
      if (!obligation || !declaredSlice.obligation_ids.includes(obligationId) || signal.source_id !== obligation.source_id || signal.cluster_id !== obligation.cluster_id) fail(`material conflict signal ${signalId} differs from its assigned extraction obligation`)
      return { signal_id: signalId, obligation_id: obligationId, source_id: obligation.source_id, cluster_id: obligation.cluster_id, conflict_set_id: assertSafeId(signal.conflict_set_id, `${signalId}.conflict_set_id`), reason: text(signal.reason, `${signalId}.reason`), extractor_id: extractorId }
    })
    materialConflictSignals.push(...shardSignals)
    const shardRecords = array(shard.records ?? [], `shard ${shard.shard_id}.records`)
    const byObligation = new Map()
    for (const rawRecord of shardRecords) {
      const obligation = obligationById.get(rawRecord.obligation_id)
      if (!obligation) fail(`shard ${shard.shard_id} contains a record for an inactive/unknown obligation`)
      const record = validateRecord(rawRecord, obligation, plan.stage4_requested)
      if (seenRecords.has(record.record_id)) fail(`duplicate record_id ${record.record_id}`)
      seenRecords.add(record.record_id); records.push(record)
      if (!byObligation.has(obligation.obligation_id)) byObligation.set(obligation.obligation_id, [])
      byObligation.get(obligation.obligation_id).push(record)
    }
    for (const rawOutcome of array(shard.obligation_results, `shard ${shard.shard_id}.obligation_results`)) {
      object(rawOutcome, 'obligation result')
      const obligationId = assertSafeId(rawOutcome.obligation_id, 'obligation_result.obligation_id')
      const obligation = obligationById.get(obligationId)
      if (!obligation || seenObligations.has(obligationId) || !shard.source_ids.includes(obligation.source_id)) fail(`obligation ${obligationId} is unknown, duplicated or outside shard sources`)
      if (!['extracted', 'not_reported', 'blocked'].includes(rawOutcome.status)) fail(`obligation ${obligationId} has invalid terminal status`)
      const recordIds = unique(rawOutcome.record_ids ?? [], `obligation ${obligationId}.record_ids`, { allowEmpty: true })
      const actualIds = (byObligation.get(obligationId) ?? []).map((entry) => entry.record_id)
      if (!sameSet(recordIds, actualIds)) fail(`obligation ${obligationId} record_ids differ from extracted records`)
      if (rawOutcome.status === 'extracted' && !recordIds.length) fail(`extracted obligation ${obligationId} needs records`)
      if (rawOutcome.status !== 'extracted' && recordIds.length) fail(`${rawOutcome.status} obligation ${obligationId} cannot have records`)
      if (rawOutcome.status !== 'extracted') text(rawOutcome.reason, `obligation ${obligationId}.reason`)
      const outcomeWarnings = warnings.filter((entry) => entry.obligation_id === obligationId)
      const relevantControversies = plan.articles.filter((article) => article.stage === 'stage3' && article.status === 'planned').flatMap((article) => article.controversies ?? [])
      const risk = derivedRisks({ obligation, records: byObligation.get(obligationId) ?? [], cluster: clusterById.get(obligation.cluster_id), source: sourceById.get(obligation.source_id), controversies: relevantControversies, warnings: outcomeWarnings, status: rawOutcome.status })
      outcomes.push({ obligation_id: obligationId, source_id: obligation.source_id, cluster_id: obligation.cluster_id, expected_claim_type: obligation.expected_claim_type, required: obligation.required, required_for: obligation.required_for.filter((id) => activeIds.has(id)), status: rawOutcome.status, reason: rawOutcome.reason ?? null, record_ids: sorted(recordIds), extractor_id: extractorId, plan_risk_tags: obligation.plan_risk_tags, effective_risk: risk.effective_risk, effective_risk_tags: risk.risk_tags, full_review_required: risk.full_review_required, warning_codes: sorted(outcomeWarnings.map((entry) => entry.code)) })
      seenObligations.add(obligationId)
    }
    if (!sameSet(shard.obligation_results.map((entry) => entry.obligation_id), declaredSlice.obligation_ids)) fail(`shard ${shard.shard_id} obligation IDs differ from extraction slice ${declaredSlice.slice_id}`)
    if (shard.content_hash !== artifactHash(shard)) fail(`shard ${shard.shard_id} content_hash is stale`)
  }
  const missing = activeObligations.map((entry) => entry.obligation_id).filter((id) => !seenObligations.has(id))
  if (missing.length) fail(`active extraction obligations are missing terminal outcomes: ${missing.join(', ')}`)
  const bundleBase = {
    schema: 'source_evidence_bundle.v2', bundle_id: assertSafeId(input.manifest.bundle_id, 'bundle_id'), run_id: plan.run_id,
    coverage_plan_id: plan.coverage_plan_id, coverage_plan_hash: plan.content_hash, research_hash: input.researchHash,
    stage4_requested: plan.stage4_requested, records: records.sort((a, b) => a.record_id.localeCompare(b.record_id)),
    material_conflict_signals: materialConflictSignals.sort((a, b) => a.signal_id.localeCompare(b.signal_id)),
    obligation_results: outcomes.sort((a, b) => a.obligation_id.localeCompare(b.obligation_id)), warnings: warnings.sort((a, b) => `${a.obligation_id}:${a.code}`.localeCompare(`${b.obligation_id}:${b.code}`)),
    extractors: sorted(extractorIds), merged_by: { role: 'evidence-bundle-merger', id: assertSafeId(input.manifest.merger?.id, 'merger.id'), merged_at: [...extractedAt].sort((a, b) => Date.parse(b) - Date.parse(a))[0] },
  }
  if (extractorIds.has(bundleBase.merged_by.id)) fail('evidence merger must be independent from extractors')
  return { bundle: { ...bundleBase, content_hash: artifactHash(bundleBase) }, extractorIds, activeArticles }
}

function stratumKey(outcome) { return `extractor:${outcome.extractor_id}` }
function isHighRisk(outcome) { return outcome.full_review_required === true && outcome.effective_risk === 'high' }

export function buildReviewSampleV2({ coveragePlan, bundle, samplingSeed, reviews = [] }) {
  const sourceById = new Map(coveragePlan.sources.map((entry) => [entry.source_id, entry]))
  const strata = new Map()
  for (const outcome of bundle.obligation_results) {
    const key = stratumKey(outcome)
    if (!strata.has(key)) strata.set(key, [])
    strata.get(key).push(outcome)
  }
  const expanded = new Set()
  for (const review of reviews) for (const result of review.obligation_results ?? []) {
    if (result.status === 'FAIL' && result.mode === 'sample') {
      const outcome = bundle.obligation_results.find((entry) => entry.obligation_id === result.obligation_id)
      if (outcome) expanded.add(stratumKey(outcome))
    }
  }
  const priorPasses = new Map()
  for (const review of reviews) for (const result of review.obligation_results ?? []) {
    if (result.status === 'PASS') priorPasses.set(result.obligation_id, { review, result })
  }
  const selected = [], carriedForward = [], entries = []
  for (const [key, outcomes] of [...strata.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    const high = outcomes.filter(isHighRisk)
    const low = outcomes.filter((entry) => !isHighRisk(entry))
    const lowCount = expanded.has(key) ? low.length : Math.min(low.length, 10, Math.max(Math.min(3, low.length), Math.ceil(low.length * 0.20)))
    const diversityGroups = new Map()
    for (const outcome of low) {
      const diversityKey = `${outcome.cluster_id}|${sourceById.get(outcome.source_id).source_type}`
      if (!diversityGroups.has(diversityKey)) diversityGroups.set(diversityKey, [])
      diversityGroups.get(diversityKey).push({ outcome, rank: hashRank(`${samplingSeed}:${bundle.content_hash}:${key}:${diversityKey}`, outcome.obligation_id) })
    }
    const rankedGroups = [...diversityGroups.entries()].map(([diversityKey, entries]) => ({
      diversityKey,
      rank: hashRank(`${samplingSeed}:${bundle.content_hash}:${key}:diversity-group`, diversityKey),
      entries: entries.sort((left, right) => left.rank.localeCompare(right.rank) || left.outcome.obligation_id.localeCompare(right.outcome.obligation_id)),
    })).sort((left, right) => left.rank.localeCompare(right.rank) || left.diversityKey.localeCompare(right.diversityKey))
    const lowSelected = []
    for (let depth = 0; lowSelected.length < lowCount; depth += 1) {
      let added = false
      for (const group of rankedGroups) if (group.entries[depth] && lowSelected.length < lowCount) { lowSelected.push(group.entries[depth].outcome); added = true }
      if (!added) break
    }
    for (const [outcome, mode] of [...high.map((entry) => [entry, 'full']), ...lowSelected.map((entry) => [entry, expanded.has(key) ? 'full' : 'sample'])]) {
      const prior = priorPasses.get(outcome.obligation_id)
      if (expanded.size && prior?.review?.review_id && prior.review.content_hash && prior.review.sample_manifest_hash) {
        carriedForward.push({ obligation_id: outcome.obligation_id, mode, prior_review_id: prior.review.review_id, prior_review_hash: prior.review.content_hash, prior_sample_manifest_hash: prior.review.sample_manifest_hash })
      } else selected.push({ obligation_id: outcome.obligation_id, mode, stratum_id: key })
    }
    entries.push({ stratum_id: key, extractor_id: outcomes[0]?.extractor_id ?? null, population: outcomes.length, high_risk_count: high.length, low_risk_count: low.length, cluster_ids: sorted(new Set(outcomes.map((entry) => entry.cluster_id))), source_types: sorted(new Set(outcomes.map((entry) => sourceById.get(entry.source_id).source_type))), low_risk_selected: lowSelected.map((entry) => entry.obligation_id), expanded_to_full: expanded.has(key) })
  }
  const previousSampleHashes = sorted(new Set(carriedForward.map((entry) => entry.prior_sample_manifest_hash)))
  const base = { schema: 'review_sample_manifest.v2', run_id: coveragePlan.run_id, coverage_plan_hash: coveragePlan.content_hash, bundle_hash: bundle.content_hash, algorithm: 'extractor_quality_sha256_v3', sampling_seed: text(samplingSeed, 'sampling_seed'), sampling_round: expanded.size ? 1 : 0, strata: entries, selected: selected.sort((a, b) => a.obligation_id.localeCompare(b.obligation_id)), carried_forward: carriedForward.sort((a, b) => a.obligation_id.localeCompare(b.obligation_id)), previous_sample_manifest_hashes: previousSampleHashes }
  return { ...base, content_hash: artifactHash(base) }
}

function validateReviewsV2({ input, bundle, sample, previousSample = null, candidateReviews = null }) {
  const reviews = candidateReviews ?? input.reviewPaths.filter(existsSync).map((path) => json(path, 'source facts review'))
  if (!reviews.length) return { status: 'missing', reviews: [] }
  const selected = new Map(sample.selected.map((entry) => [entry.obligation_id, entry]))
  const carried = new Map((sample.carried_forward ?? []).map((entry) => [entry.obligation_id, entry]))
  const priorSelected = new Map((previousSample?.selected ?? []).map((entry) => [entry.obligation_id, entry]))
  const outcomeById = new Map(bundle.obligation_results.map((entry) => [entry.obligation_id, entry]))
  const recordsByObligation = new Map()
  for (const record of bundle.records) {
    if (!recordsByObligation.has(record.obligation_id)) recordsByObligation.set(record.obligation_id, [])
    recordsByObligation.get(record.obligation_id).push(record.record_id)
  }
  const reviewedObligations = new Set(), reviewedRecords = new Set(), reviewerIds = new Set(), currentRoundReviewerIds = new Set(), reviewIds = new Set(), failures = [], obligationStatuses = new Map(), carriedProofs = new Set()
  for (const review of reviews) {
    if (review.schema !== 'source_facts_review.v2') fail(`review ${review.review_id ?? '(missing)'} schema must equal source_facts_review.v2`)
    const reviewId = assertSafeId(review.review_id, 'review_id')
    if (reviewIds.has(reviewId)) fail(`duplicate source facts review_id ${reviewId}`)
    reviewIds.add(reviewId)
    if (review.content_hash !== artifactHash(review)) fail(`review ${review.review_id} content_hash is stale`)
    if (review.bundle_hash !== bundle.content_hash) fail(`review ${review.review_id} has stale bundle binding`)
    const currentRound = review.sample_manifest_hash === sample.content_hash
    const priorRound = sample.sampling_round === 1 && previousSample && review.sample_manifest_hash === previousSample.content_hash
    if (!currentRound && !priorRound) fail(`review ${review.review_id} has an unrecognized sample binding`)
    if (review.reviewer?.role !== 'source-facts-reviewer') fail(`review ${review.review_id} reviewer role is invalid`)
    const reviewerId = assertSafeId(review.reviewer.id, `review ${review.review_id}.reviewer.id`)
    if (bundle.extractors.includes(reviewerId) || bundle.merged_by.id === reviewerId) fail(`facts reviewer ${reviewerId} overlaps an extractor or merger`)
    if (currentRound && currentRoundReviewerIds.has(reviewerId)) fail(`facts reviewer ${reviewerId} is assigned to more than one concurrent current-round shard`)
    if (currentRound) currentRoundReviewerIds.add(reviewerId)
    reviewerIds.add(reviewerId); iso(review.reviewed_at, `review ${review.review_id}.reviewed_at`)
    for (const result of array(review.obligation_results, `review ${review.review_id}.obligation_results`)) {
      const selection = currentRound ? selected.get(result.obligation_id) : priorSelected.get(result.obligation_id)
      const outcome = outcomeById.get(result.obligation_id)
      if (!selection || !outcome || currentRound && reviewedObligations.has(result.obligation_id)) fail(`review result ${result.obligation_id} is unselected, unknown or duplicated`)
      if (!['PASS', 'FAIL'].includes(result.status) || result.mode !== selection.mode) fail(`review result ${result.obligation_id} status/mode is invalid`)
      if (!Array.isArray(result.findings)) fail(`review result ${result.obligation_id}.findings must be an array`)
      if (result.status === 'PASS' && result.findings.length) fail(`passing review result ${result.obligation_id} cannot retain findings`)
      if (result.status === 'FAIL' && !result.findings.length) fail(`failing review result ${result.obligation_id} needs findings`)
      if (currentRound) {
        if (result.status === 'FAIL') failures.push({ ...result, stratum_id: selection.stratum_id })
        obligationStatuses.set(result.obligation_id, result.status)
        reviewedObligations.add(result.obligation_id)
      } else {
        const carry = carried.get(result.obligation_id)
        if (carry && result.status === 'PASS' && carry.prior_review_id === review.review_id && carry.prior_review_hash === review.content_hash && carry.prior_sample_manifest_hash === review.sample_manifest_hash) carriedProofs.add(result.obligation_id)
      }
    }
    for (const result of array(review.record_results ?? [], `review ${review.review_id}.record_results`)) {
      const record = bundle.records.find((entry) => entry.record_id === result.record_id)
      const recordSelected = currentRound ? selected.has(record?.obligation_id) : priorSelected.has(record?.obligation_id)
      if (!record || !recordSelected || currentRound && reviewedRecords.has(result.record_id)) fail(`record review ${result.record_id} is unknown, unselected or duplicated`)
      if (!['PASS', 'FAIL'].includes(result.status)) fail(`record review ${result.record_id} status is invalid`)
      if (!Array.isArray(result.findings)) fail(`record review ${result.record_id}.findings must be an array`)
      if (result.status === 'PASS' && result.findings.length) fail(`passing record review ${result.record_id} cannot retain findings`)
      if (currentRound && result.status === 'FAIL' && (!result.findings.length || obligationStatuses.get(record.obligation_id) !== 'FAIL')) fail(`failing record review ${result.record_id} needs findings and a failing parent obligation`)
      if (currentRound && result.status === 'FAIL') failures.push({ ...result, obligation_id: record.obligation_id, mode: selected.get(record.obligation_id).mode, stratum_id: selected.get(record.obligation_id).stratum_id })
      if (currentRound) reviewedRecords.add(result.record_id)
    }
  }
  const reviewedRequiredRecords = [...reviewedObligations].flatMap((id) => recordsByObligation.get(id) ?? [])
  if (!sameSet([...reviewedRecords], reviewedRequiredRecords)) fail('source reviews do not cover every record in their reviewed extracted obligations')
  const selectedComplete = sameSet([...reviewedObligations], [...selected.keys()])
  const carryComplete = sameSet([...carriedProofs], [...carried.keys()])
  if (!selectedComplete || !carryComplete) {
    if (failures.length) return { status: 'fail', reviews, reviewerIds, failures, carriedForward: [...carried.values()] }
    return { status: 'missing', reviews, reviewerIds, failures: [], carriedForward: [...carried.values()] }
  }
  return { status: failures.length ? 'fail' : 'pass', reviews, reviewerIds, failures, carriedForward: [...carried.values()] }
}

function visibleSource(source) {
  return {
    source_id: source.source_id, source_type: source.source_type, label: source.label, source_url: source.url,
    author_or_institution: source.author_or_institution, publication_year: source.publication_year, title: source.title, journal_or_publisher: source.journal_or_publisher,
    canonical_url: source.canonical_url ?? source.url, doi: source.doi ?? null, pubmed_id: source.pmid ?? source.pubmed_id ?? null,
    source_content_hash: source.source_content_hash,
  }
}
function writerFact(record) {
  return {
    record_id: record.record_id,
    obligation_id: record.obligation_id,
    source_id: record.source_id,
    cluster_id: record.cluster_id,
    claim_type: record.claim_type,
    subject_key: record.subject_key,
    predicate_key: record.predicate_key,
    context: record.context,
    conflict_set_id: record.conflict_set_id,
    claim: record.claim,
    population_context: record.population_context ?? null,
    value: record.value,
    unit: record.unit,
    effect_direction: record.effect_direction ?? null,
    uncertainty: record.uncertainty,
    locator: record.locator,
  }
}

function buildStage4PackageV2({ coveragePlan, bundle, gate, reviewerIds }) {
  if (!coveragePlan.stage4_requested) return null
  const sourceById = new Map(coveragePlan.sources.map((entry) => [entry.source_id, entry]))
  const records = bundle.records
    .filter((record) => record.stage4_relevance?.status === 'candidate')
    .sort((left, right) => left.record_id.localeCompare(right.record_id))
  const sourceIds = sorted(new Set(records.map((record) => record.source_id)))
  const obligationIds = sorted(new Set(records.map((record) => record.obligation_id)))
  const facts = records.map((record) => ({ ...writerFact(record), stage4_relevance: record.stage4_relevance }))
  const base = {
    schema: 'facts_package_for_stage4.v2',
    package_id: `stage4.${gate.gate_id}`,
    run_id: coveragePlan.run_id,
    substance: coveragePlan.substance,
    language: coveragePlan.substance.language,
    coverage_plan_id: coveragePlan.coverage_plan_id,
    coverage_plan_hash: coveragePlan.content_hash,
    evidence_bundle_id: bundle.bundle_id,
    evidence_bundle_hash: bundle.content_hash,
    facts_gate_id: gate.gate_id,
    facts_gate_hash: gate.content_hash,
    facts_reviewer_ids: sorted(reviewerIds),
    obligation_ids: obligationIds,
    record_ids: records.map((record) => record.record_id), facts_hash: canonicalJsonHash(facts),
    facts,
    visible_sources: sourceIds.map((sourceId) => visibleSource(sourceById.get(sourceId))),
  }
  return { ...base, package_content_hash: artifactHash(base) }
}

function buildPackagesV2({ coveragePlan, bundle, gate, reviews, policyVersion, validatorVersion }) {
  const sourceById = new Map(coveragePlan.sources.map((entry) => [entry.source_id, entry]))
  const outcomeById = new Map(bundle.obligation_results.map((entry) => [entry.obligation_id, entry]))
  const packages = { stage2: {}, stage3: {}, stage4: null }
  for (const article of coveragePlan.articles.filter((entry) => entry.status === 'planned')) {
    const outcomes = bundle.obligation_results.filter((entry) => entry.required_for.includes(article.article_id))
    const obligationIds = outcomes.map((entry) => entry.obligation_id)
    const records = bundle.records.filter((entry) => obligationIds.includes(entry.obligation_id))
    const sources = sorted(new Set(outcomes.map((entry) => entry.source_id))).map((id) => visibleSource(sourceById.get(id)))
    const relevantClusters = coveragePlan.clusters.filter((entry) => article.required_cluster_ids.includes(entry.cluster_id))
    const lineageBase = {
      schema: 'article_evidence_lineage.v2', run_id: coveragePlan.run_id, article_id: article.article_id, stage: article.stage,
      article_plan: article, clusters: relevantClusters, obligations: outcomes.map((entry) => coveragePlan.extraction_obligations.find((obligation) => obligation.obligation_id === entry.obligation_id)),
      obligation_results: outcomes, records: records.sort((a, b) => a.record_id.localeCompare(b.record_id)), visible_sources: sources,
      facts_gate_status: gate.article_gates[article.article_id], framework_hash: article.framework_hash, policy_version: policyVersion, validator_version: validatorVersion,
    }
    const articleLineageHash = canonicalJsonHash(lineageBase)
    const evidenceMembershipHash = canonicalJsonHash({ schema: 'article_evidence_membership.v2', run_id: coveragePlan.run_id, article_id: article.article_id, stage: article.stage, article_lineage_hash: articleLineageHash, framework_hash: article.framework_hash, policy_version: policyVersion, validator_version: validatorVersion })
    const articlePackageHash = canonicalJsonHash({ schema: 'article_facts_package_binding.v2', article_id: article.article_id, stage: article.stage, evidence_membership_hash: evidenceMembershipHash })
    const directReviewerIds = sorted(new Set(reviews.filter((review) => review.obligation_results?.some((result) => obligationIds.includes(result.obligation_id))).map((review) => review.reviewer.id)))
    const gateReviewerIds = sorted(new Set(reviews.map((review) => review.reviewer.id)))
    if (!gateReviewerIds.length) fail(`article ${article.article_id} has no source-facts reviewer bound to the passed facts gate`)
    const base = {
      schema: article.stage === 'stage2' ? 'facts_package_for_stage2.v2' : 'facts_package_for_stage3.v2', package_id: `${article.article_id}.${articlePackageHash.slice(-16)}`,
      article_id: article.article_id, stage: article.stage, slug: article.slug, substance: coveragePlan.substance, language: coveragePlan.substance.language,
      facts_reviewer_ids: gateReviewerIds, direct_facts_reviewer_ids: directReviewerIds, framework: article.framework, framework_hash: article.framework_hash,
      policy_version: policyVersion, validator_version: validatorVersion, article_lineage_hash: articleLineageHash, evidence_membership_hash: evidenceMembershipHash, article_package_hash: articlePackageHash,
      required_cluster_ids: article.required_cluster_ids, obligation_ids: sorted(obligationIds), obligation_results: outcomes.map((entry) => ({ ...outcomeById.get(entry.obligation_id) })),
      record_ids: sorted(records.map((entry) => entry.record_id)), facts: records.sort((a, b) => a.record_id.localeCompare(b.record_id)).map(writerFact), visible_sources: sources, seo_brief: article.seo_brief, selected_link_slice: article.selected_link_slice,
    }
    if (article.stage === 'stage2') {
      base.source_assignment = article.source_assignment
      base.source_presentation_label_de = article.source_presentation_label_de
    }
    if (article.stage === 'stage3') {
      const stage2Articles = new Map(coveragePlan.articles
        .filter((candidate) => candidate.stage === 'stage2' && candidate.status === 'planned')
        .map((candidate) => [candidate.article_id, candidate]))
      const sourceIdSet = new Set(sources.map((source) => source.source_id))
      const presentationSources = []
      const coveredSourceIds = new Set()
      for (const link of article.selected_link_slice.links) {
        const candidate = link.target_state === 'same_release'
          ? stage2Articles.get(link.target_article_id)
          : [...stage2Articles.values()].find((entry) => entry.slug === link.target_id)
        const covered = (link.covered_source_ids ?? candidate?.source_ids ?? [])
          .filter((sourceId) => sourceIdSet.has(sourceId))
          .sort()
        if (!covered.length) continue
        covered.forEach((sourceId) => coveredSourceIds.add(sourceId))
        presentationSources.push({
          source_id: `internal-article-${link.target_id}`,
          label: link.title,
          source_url: link.path,
          target_article_id: candidate?.article_id ?? link.target_id,
          covered_source_ids: covered,
        })
      }
      if (sourceIdSet.size > 0 && presentationSources.length === 0) {
        fail(`article ${article.article_id} needs at least one internal Stage-2 source presentation`)
      }
      if (coveredSourceIds.size !== sourceIdSet.size) {
        const missing = [...sourceIdSet].filter((sourceId) => !coveredSourceIds.has(sourceId)).sort()
        fail(`article ${article.article_id} internal Stage-2 source presentation is incomplete: ${missing.join(', ')}`)
      }
      base.source_presentation_policy = 'internal_stage2_only'
      base.presentation_sources = presentationSources
      base.common_assumption_review = {
        ...article.common_assumption_review,
        checks: article.common_assumption_review.checks.map((check) => ({
          ...check,
          record_ids: sorted(records.filter((record) => check.obligation_ids.includes(record.obligation_id)).map((record) => record.record_id)),
        })),
      }
      const graphicRecordIds = sorted(records.filter((record) => article.graphic_decision.obligation_ids.includes(record.obligation_id) && article.graphic_decision.cluster_ids.includes(record.cluster_id)).map((record) => record.record_id))
      if (article.graphic_decision.mode === 'generate' && !graphicRecordIds.length) fail(`article ${article.article_id} graphic decision resolves to no reviewed records`)
      Object.assign(base, { blueprint: article.blueprint, controversies: article.controversies, graphic_decision: { ...article.graphic_decision, record_ids: graphicRecordIds } })
    }
    const value = { ...base, package_content_hash: artifactHash(base) }
    packages[article.stage][article.article_id] = value
  }
  packages.stage4 = buildStage4PackageV2({ coveragePlan, bundle, gate, reviewerIds: new Set(reviews.map((review) => review.reviewer.id)) })
  return packages
}

function runBinding(root, path, extra = {}) { return { scope: 'run', path: portablePath(root, path), byte_hash: sha256Bytes(readFileSync(path)), ...extra } }
function repoBinding(path, extra = {}) { return { scope: 'repo', path: portablePath(REPO_ROOT, path), byte_hash: sha256Bytes(readFileSync(path)), ...extra } }

function writeSourceReviewInputV2({ input, dir, bundle, sample }) {
  const outcomeById = new Map(bundle.obligation_results.map((entry) => [entry.obligation_id, entry]))
  const selected = sample.selected.map((selection) => {
    const outcome = outcomeById.get(selection.obligation_id)
    return { ...selection, obligation_result: outcome, records: bundle.records.filter((record) => record.obligation_id === selection.obligation_id) }
  })
  const selectedSourceIds = sorted(new Set(selected.map((entry) => entry.obligation_result.source_id)))
  const base = {
    schema: 'source_facts_review_input.v2', run_id: input.coveragePlan.run_id,
    coverage_plan_hash: input.coveragePlan.content_hash, evidence_bundle_hash: bundle.content_hash, sample_manifest_hash: sample.content_hash,
    selected, carried_forward: sample.carried_forward ?? [], original_sources: selectedSourceIds.map((sourceId) => runBinding(input.root, input.sourceArtifactPaths[sourceId], { source_id: sourceId })),
    allowed_output_paths: input.reviewPaths.map((path) => portablePath(input.root, path)),
    reviewer_contract: { role: 'source-facts-reviewer', independence_source: 'nutrient_content_work_order.v2.assignee', output_schema: 'source_facts_review.v2' },
  }
  const value = { ...base, content_hash: artifactHash(base) }
  const coveragePath = resolve(dir, 'coverage-plan.v2.json')
  const bundlePath = resolve(dir, 'source-evidence-bundle.v2.json')
  const samplePath = resolve(dir, 'review-sample-manifest.v2.json')
  const reviewInputPath = resolve(dir, 'source-facts-review-input.v2.json')
  writeJson(coveragePath, input.coveragePlan); writeJson(bundlePath, bundle); writeJson(samplePath, sample); writeJson(reviewInputPath, value)
  return { value, path: reviewInputPath, coveragePath, bundlePath, samplePath }
}

export function buildEvidencePipelineV2({ input, outputDir }) {
  if (!input.coveragePlan) fail('coverage plan is missing')
  const { bundle, extractorIds, activeArticles } = mergeEvidenceV2(input)
  if (bundle.material_conflict_signals?.length) return { status: 'coverage_replan_required', reason: 'an extractor found a material conflict outside the frozen coverage plan', bundle, materialConflictSignals: bundle.material_conflict_signals, activeArticles }
  if (bundle.obligation_results.some((entry) => entry.status === 'blocked')) return { status: 'blocked', reason: 'active extraction obligation is blocked', bundle, activeArticles }
  const dir = assertContained(input.root, outputDir, 'evidence output directory')
  if (dir === resolve(input.root)) fail('evidence output directory must be below the run root')
  const declaredPaths = [input.absolute, input.coveragePlanPath, input.researchPath, ...input.shardPaths, ...input.reviewPaths, ...Object.values(input.sourceArtifactPaths)]
  if (declaredPaths.some((path) => isContained(dir, path))) fail('evidence output directory cannot contain a declared input or review path')
  const persistedSamplePath = resolve(dir, 'review-sample-manifest.v2.json')
  const candidateReviews = input.reviewPaths.filter(existsSync).map((path) => json(path))
  for (const review of candidateReviews) if (review.schema !== 'source_facts_review.v2' || review.content_hash !== artifactHash(review)) fail(`source review ${review.review_id ?? '(missing)'} is malformed or tampered`)
  const existingReviews = candidateReviews.filter((review) => review.bundle_hash === bundle.content_hash)
  const previousSample = buildReviewSampleV2({ coveragePlan: input.coveragePlan, bundle, samplingSeed: input.manifest.sampling_seed, reviews: [] })
  let sample = previousSample
  if (existsSync(persistedSamplePath)) {
    const persisted = json(persistedSamplePath, 'persisted review sample manifest')
    if (persisted.schema === 'review_sample_manifest.v2' && persisted.bundle_hash === bundle.content_hash && persisted.coverage_plan_hash === input.coveragePlan.content_hash && persisted.sampling_round === 1 && persisted.content_hash === artifactHash(persisted)) sample = persisted
  }
  let reviews = validateReviewsV2({ input, bundle, sample, previousSample: sample.sampling_round === 1 ? previousSample : null, candidateReviews: existingReviews })
  if (reviews.status === 'fail' && sample.sampling_round === 0 && reviews.failures.some((failure) => failure.mode === 'sample')) {
    sample = buildReviewSampleV2({ coveragePlan: input.coveragePlan, bundle, samplingSeed: input.manifest.sampling_seed, reviews: reviews.reviews })
    if (sample.sampling_round !== 1) fail('a sampled source-review failure did not expand its affected stratum')
    const reviewInput = writeSourceReviewInputV2({ input, dir, bundle, sample })
    return { status: 'review_expanded', bundle, sample, reviewInput: reviewInput.value, reviewInputPath: reviewInput.path, failures: reviews.failures, activeArticles }
  }
  if (reviews.status !== 'pass') {
    const reviewInput = writeSourceReviewInputV2({ input, dir, bundle, sample })
    return { status: reviews.status === 'missing' ? 'missing_reviews' : 'blocked', bundle, sample, reviewInput: reviewInput.value, reviewInputPath: reviewInput.path, failures: reviews.failures ?? [], activeArticles }
  }
  const validator = object(input.manifest.validator, 'validator')
  if (validator.role !== 'evidence-bundle-gate-validator') fail('validator role must equal evidence-bundle-gate-validator')
  const validatorId = assertSafeId(validator.id, 'validator.id')
  if (extractorIds.has(validatorId) || reviews.reviewerIds.has(validatorId) || bundle.merged_by.id === validatorId) fail('gate validator must be independent')
  const validatedAt = [...reviews.reviews].map((review) => iso(review.reviewed_at, `review ${review.review_id}.reviewed_at`)).sort((a, b) => Date.parse(b) - Date.parse(a))[0]
  const selected = new Map([...sample.selected, ...(sample.carried_forward ?? [])].map((entry) => [entry.obligation_id, entry]))
  const articleGates = Object.fromEntries(activeArticles.map((article) => {
    const outcomes = bundle.obligation_results.filter((entry) => entry.required_for.includes(article.article_id))
    const extractedClusterSet = new Set(outcomes.filter((entry) => entry.status === 'extracted' && entry.record_ids.length).map((entry) => entry.cluster_id))
    const missingExtractedClusterIds = article.required_cluster_ids.filter((id) => !extractedClusterSet.has(id))
    const passed = !missingExtractedClusterIds.length && outcomes.every((entry) => entry.status !== 'blocked')
    return [article.article_id, { status: passed ? 'PASS' : 'BLOCKED', required_cluster_ids: article.required_cluster_ids, missing_extracted_cluster_ids: missingExtractedClusterIds, obligation_ids: sorted(outcomes.map((entry) => entry.obligation_id)) }]
  }))
  const gateBase = {
    schema: 'facts_completeness_gate.v2', gate_id: assertSafeId(validator.gate_id, 'validator.gate_id'), run_id: input.coveragePlan.run_id,
    coverage_plan_hash: input.coveragePlan.content_hash, evidence_bundle_hash: bundle.content_hash, sample_manifest_hash: sample.content_hash,
    source_review_ids: sorted(reviews.reviews.map((entry) => entry.review_id)), facts_reviewer_ids: sorted(reviews.reviewerIds),
    obligation_review_basis: bundle.obligation_results.map((entry) => ({ obligation_id: entry.obligation_id, basis: selected.has(entry.obligation_id) ? ((sample.carried_forward ?? []).some((carry) => carry.obligation_id === entry.obligation_id) ? 'carried_forward_pass' : selected.get(entry.obligation_id).mode === 'full' ? 'individual_full' : 'sampled') : 'accepted_by_sample', stratum_id: stratumKey(entry) })),
    article_gates: articleGates, writers_ready: Object.values(articleGates).every((entry) => entry.status === 'PASS'), validated_by: { role: validator.role, id: validatorId }, validated_at: validatedAt,
  }
  const gate = { ...gateBase, content_hash: artifactHash(gateBase) }
  if (!gate.writers_ready) return { status: 'blocked', reason: 'not every planned article facts gate passed', bundle, sample, gate, activeArticles }
  const packages = buildPackagesV2({ coveragePlan: input.coveragePlan, bundle, gate, reviews: reviews.reviews, policyVersion: input.policyVersion, validatorVersion: input.validatorVersion })
  mkdirSync(resolve(dir, 'stage2-packages'), { recursive: true }); mkdirSync(resolve(dir, 'stage3-packages'), { recursive: true })
  const reviewInput = writeSourceReviewInputV2({ input, dir, bundle, sample })
  const coverageOut = reviewInput.coveragePath, bundleOut = reviewInput.bundlePath, sampleOut = reviewInput.samplePath, gateOut = resolve(dir, 'facts-completeness-gate.v2.json')
  writeJson(gateOut, gate)
  const packageBindings = { stage2: {}, stage3: {}, stage4: null }
  for (const stage of ['stage2', 'stage3']) for (const [articleId, value] of Object.entries(packages[stage])) {
    const path = resolve(dir, `${stage}-packages`, `${articleId}.json`); writeJson(path, value)
    packageBindings[stage][articleId] = runBinding(input.root, path, { package_hash: value.package_content_hash, article_package_hash: value.article_package_hash, article_lineage_hash: value.article_lineage_hash, evidence_membership_hash: value.evidence_membership_hash, framework_hash: value.framework_hash })
  }
  if (packages.stage4) {
    const path = resolve(dir, 'stage4-package', 'facts-package-for-stage4.v2.json')
    writeJson(path, packages.stage4)
    packageBindings.stage4 = runBinding(input.root, path, { package_hash: packages.stage4.package_content_hash })
  }
  const lockBase = {
    schema: 'evidence_pipeline_lock.v2', lock_id: `${bundle.bundle_id}.${gate.gate_id}`, mode: input.mode, run_id: input.coveragePlan.run_id,
    policy_version: input.policyVersion, validator_version: input.validatorVersion,
    build_manifest: runBinding(input.root, input.absolute),
    research: runBinding(input.root, input.researchPath, { content_hash: input.researchHash }), source_artifact_receipt: runBinding(input.root, input.sourceArtifactReceiptPath, { content_hash: input.sourceArtifactReceiptHash }), coverage_plan: runBinding(input.root, coverageOut, { content_hash: input.coveragePlan.content_hash }),
    original_coverage_plan: runBinding(input.root, input.coveragePlanPath, { content_hash: input.coveragePlan.content_hash }),
    canonical_framework_catalog: repoBinding(CATALOG_PATH), style_snapshot: repoBinding(STYLE_SNAPSHOT_PATH),
    framework_files: [...new Map(input.coveragePlan.articles.filter((article) => article.status === 'planned').map((article) => [`${article.framework.path}:${article.framework_hash}`, repoBinding(resolve(REPO_ROOT, article.framework.path), { framework_hash: article.framework_hash })])).values()],
    extraction_shards: input.extractionSlices.map((slice) => runBinding(input.root, slice.shard_path, { slice_id: slice.slice_id, source_ids: slice.source_ids, obligation_ids: slice.obligation_ids, cluster_ids: slice.cluster_ids })), source_artifacts: Object.entries(input.sourceArtifactPaths).sort().map(([sourceId, path]) => runBinding(input.root, path, { source_id: sourceId })),
    source_review_input: runBinding(input.root, reviewInput.path, { content_hash: reviewInput.value.content_hash }),
    source_reviews: input.reviewPaths.filter(existsSync).map((path) => runBinding(input.root, path)), evidence_bundle: runBinding(input.root, bundleOut, { content_hash: bundle.content_hash }), sample_manifest: runBinding(input.root, sampleOut, { content_hash: sample.content_hash }), facts_gate: runBinding(input.root, gateOut, { content_hash: gate.content_hash }),
    packages: packageBindings, writers_ready: gate.writers_ready, extractor_ids: sorted(extractorIds), facts_reviewer_ids: sorted(reviews.reviewerIds),
    stage4: { requested: input.coveragePlan.stage4_requested, package_schema: 'facts_package_for_stage4.v2', projection_schema: 'stack_projection.v2', execution: 'separate_post_gate' },
  }
  const lock = { ...lockBase, lock_hash: artifactHash(lockBase) }
  const lockPath = resolve(dir, 'evidence-pipeline-lock.v2.json'); writeJson(lockPath, lock)
  return { status: 'pass', coveragePlan: input.coveragePlan, bundle, sample, gate, packages, lock, lockPath, activeArticles }
}

function resolveLockBinding(root, binding, label) {
  object(binding, label)
  const base = binding.scope === 'repo' ? REPO_ROOT : binding.scope === 'run' ? root : fail(`${label}.scope is invalid`)
  const path = resolveManifestPath(base, binding.path, `${label}.path`)
  if (!existsSync(path) || sha256Bytes(readFileSync(path)) !== binding.byte_hash) fail(`${label} bytes/hash mismatch`)
  return { path, value: path.endsWith('.json') ? json(path, label) : null }
}

function validateStyleSnapshotDependencies(value) {
  if (value?.schema !== 'stage3_style_snapshots.v1' || value.status !== 'approved') fail('style snapshot registry is not approved stage3_style_snapshots.v1')
  const dependencies = [object(value.annotation, 'style snapshot annotation'), ...array(value.snapshots, 'style snapshots')]
  for (const [index, dependency] of dependencies.entries()) {
    const path = resolveManifestPath(REPO_ROOT, dependency.path, `style snapshot dependency ${index}.path`)
    if (!existsSync(path) || sha256Bytes(readFileSync(path)) !== dependency.sha256) fail(`style snapshot dependency ${index} bytes/hash mismatch`)
  }
}

export function validateEvidencePipelineLockV2({ lockPath, root, expected }) {
  const absolute = assertContained(root, lockPath, 'evidence lock')
  const lock = json(absolute, 'evidence lock')
  if (lock.schema !== 'evidence_pipeline_lock.v2' || lock.lock_hash !== artifactHash(lock)) fail('evidence lock schema/hash is invalid')
  if (!lock.writers_ready) fail('evidence lock is not writers_ready')
  if (expected.policyVersion && lock.policy_version !== expected.policyVersion) fail('evidence lock policy_version differs from run')
  if (expected.validatorVersion && lock.validator_version !== expected.validatorVersion) fail('evidence lock validator_version differs from run')
  const buildManifest = resolveLockBinding(root, lock.build_manifest, 'evidence build manifest')
  if (expected.evidenceManifestPath && resolve(expected.evidenceManifestPath) !== buildManifest.path) fail('run evidence manifest path differs from locked build manifest')
  const research = resolveLockBinding(root, lock.research, 'research')
  if (lock.research.content_hash !== sha256Bytes(readFileSync(research.path))) fail('research dependency hash is stale')
  const sourceArtifactReceipt = resolveLockBinding(root, lock.source_artifact_receipt, 'source artifact receipt').value
  if (sourceArtifactReceipt?.content_hash !== lock.source_artifact_receipt.content_hash || sourceArtifactReceipt?.content_hash !== artifactHash(sourceArtifactReceipt)) fail('source artifact receipt lock binding is stale')
  const coverage = resolveLockBinding(root, lock.coverage_plan, 'coverage plan').value
  const originalCoverage = resolveLockBinding(root, lock.original_coverage_plan, 'original coverage plan')
  if (coverage.content_hash !== originalCoverage.value.content_hash || sha256Bytes(readFileSync(originalCoverage.path)) !== lock.original_coverage_plan.byte_hash) fail('coverage lock bindings differ')
  if (expected.coveragePlanPath && resolve(expected.coveragePlanPath) !== originalCoverage.path) fail('run coverage path differs from locked coverage')
  if (expected.researchPath && resolve(expected.researchPath) !== research.path) fail('run research path differs from locked research')
  if (coverage.substance.slug !== expected.substance || coverage.substance.language !== expected.language) fail('locked coverage substance/language differs from run')
  resolveLockBinding(root, lock.canonical_framework_catalog, 'framework catalog'); validateStyleSnapshotDependencies(resolveLockBinding(root, lock.style_snapshot, 'style snapshot').value)
  for (const [index, entry] of array(lock.framework_files, 'framework_files').entries()) resolveLockBinding(root, entry, `framework file ${index}`)
  for (const [index, entry] of lock.extraction_shards.entries()) resolveLockBinding(root, entry, `extraction shard ${index}`)
  for (const [index, entry] of lock.source_artifacts.entries()) resolveLockBinding(root, entry, `source artifact ${index}`)
  const reviewInput = resolveLockBinding(root, lock.source_review_input, 'source review input').value
  for (const [index, entry] of lock.source_reviews.entries()) resolveLockBinding(root, entry, `source review ${index}`)
  const bundle = resolveLockBinding(root, lock.evidence_bundle, 'evidence bundle').value
  const sample = resolveLockBinding(root, lock.sample_manifest, 'sample manifest').value
  const gate = resolveLockBinding(root, lock.facts_gate, 'facts gate').value
  if (reviewInput.content_hash !== lock.source_review_input.content_hash || reviewInput.evidence_bundle_hash !== bundle.content_hash || reviewInput.sample_manifest_hash !== sample.content_hash || bundle.content_hash !== lock.evidence_bundle.content_hash || sample.content_hash !== lock.sample_manifest.content_hash || gate.content_hash !== lock.facts_gate.content_hash || !gate.writers_ready) fail('locked evidence outputs are stale')
  const packages = { stage2: {}, stage3: {}, stage4: null }
  for (const stage of ['stage2', 'stage3']) for (const [articleId, entry] of Object.entries(lock.packages?.[stage] ?? {})) {
    assertSafeId(articleId, `lock package ${articleId}`)
    const value = resolveLockBinding(root, entry, `${stage} package ${articleId}`).value
    if (value.package_content_hash !== entry.package_hash || value.article_package_hash !== entry.article_package_hash || value.article_lineage_hash !== entry.article_lineage_hash || value.evidence_membership_hash !== entry.evidence_membership_hash || value.framework_hash !== entry.framework_hash) fail(`${stage} package ${articleId} lineage/hash differs from lock`)
    if (!lock.framework_files.some((framework) => framework.path === value.framework.path && framework.byte_hash === value.framework.byte_hash && framework.framework_hash === value.framework_hash)) fail(`${stage} package ${articleId} framework is not bound by the evidence lock`)
    packages[stage][articleId] = value
  }
  if (lock.stage4?.requested !== coverage.stage4_requested || lock.stage4?.package_schema !== 'facts_package_for_stage4.v2' || lock.stage4?.projection_schema !== 'stack_projection.v2' || lock.stage4?.execution !== 'separate_post_gate') fail('locked Stage-4 branch differs from coverage or canonical schemas')
  const stage4Binding = lock.packages?.stage4 ?? null
  if (coverage.stage4_requested !== Boolean(stage4Binding)) fail('Stage-4 package presence must exactly match stage4_requested')
  if (stage4Binding) {
    const value = resolveLockBinding(root, stage4Binding, 'Stage-4 facts package').value
    if (value?.schema !== 'facts_package_for_stage4.v2' || value.package_content_hash !== stage4Binding.package_hash || value.package_content_hash !== artifactHash(value)) fail('Stage-4 facts package schema/hash differs from lock')
    if (value.coverage_plan_hash !== coverage.content_hash || value.evidence_bundle_hash !== bundle.content_hash || value.facts_gate_hash !== gate.content_hash) fail('Stage-4 facts package lineage is stale')
    const candidateIds = sorted(bundle.records.filter((record) => record.stage4_relevance?.status === 'candidate').map((record) => record.record_id))
    if (!sameSet(value.record_ids ?? [], candidateIds) || !sameSet(value.facts?.map((fact) => fact.record_id) ?? [], candidateIds)) fail('Stage-4 facts package record set differs from reviewed candidate records')
    packages.stage4 = value
  }
  return { lock, lockPath: absolute, coveragePlan: coverage, evidenceBundle: bundle, sampleManifest: sample, sourceReviewInput: reviewInput, factsGate: gate, packages }
}

export function validateStackProjectionV2({ projectionValue, pipeline }) {
  object(projectionValue, 'stack projection')
  const stage4Package = pipeline.packages?.stage4
  if (!pipeline.coveragePlan.stage4_requested || !stage4Package) fail('stack_projection.v2 requires an explicit, lock-bound Stage-4 facts package')
  if (projectionValue.schema !== 'stack_projection.v2' || projectionValue.status !== 'ready') fail('stack projection schema/status must equal stack_projection.v2/ready')
  assertSafeId(projectionValue.projection_id, 'stack projection.projection_id')
  if (projectionValue.run_id !== pipeline.coveragePlan.run_id) fail('stack projection run_id differs')
  if (projectionValue.coverage_plan_hash !== pipeline.coveragePlan.content_hash || projectionValue.evidence_bundle_hash !== pipeline.evidenceBundle.content_hash || projectionValue.facts_gate_hash !== pipeline.factsGate.content_hash || projectionValue.evidence_lock_hash !== pipeline.lock.lock_hash) fail('stack projection plan/bundle/gate/lock binding differs')
  if (projectionValue.facts_package_id !== stage4Package.package_id || projectionValue.facts_package_hash !== stage4Package.package_content_hash || projectionValue.facts_hash !== stage4Package.facts_hash) fail('stack projection Stage-4 facts package/facts binding differs')
  const packageRecordIds = sorted(stage4Package.record_ids)
  if (!sameSet(projectionValue.record_ids ?? [], packageRecordIds) || JSON.stringify(projectionValue.record_ids) !== JSON.stringify(packageRecordIds)) fail('stack projection record_ids must exactly equal the sorted Stage-4 package record set')
  const creator = object(projectionValue.creator, 'stack projection.creator')
  if (creator.role !== 'stack-sync' && creator.role !== 'stage4-stack-sync') fail('stack projection creator role is invalid')
  assertSafeId(creator.id, 'stack projection.creator.id'); assertSafeId(projectionValue.execution_id, 'stack projection.execution_id'); iso(projectionValue.created_at, 'stack projection.created_at')
  const projectionRecords = array(projectionValue.records, 'stack projection.records')
  const factById = new Map(stage4Package.facts.map((fact) => [fact.record_id, fact]))
  const sourceById = new Map(stage4Package.visible_sources.map((source) => [source.source_id, source]))
  const referenced = new Set()
  const projectionRecordIds = new Set()
  for (const [index, record] of projectionRecords.entries()) {
    object(record, `stack projection.records[${index}]`)
    const projectionRecordId = assertSafeId(record.projection_record_id, `stack projection.records[${index}].projection_record_id`)
    if (projectionRecordIds.has(projectionRecordId)) fail(`duplicate projection_record_id ${projectionRecordId}`)
    projectionRecordIds.add(projectionRecordId)
    const evidenceRecordIds = unique(record.evidence_record_ids, `${projectionRecordId}.evidence_record_ids`)
    const facts = evidenceRecordIds.map((recordId) => factById.get(recordId))
    for (const recordId of evidenceRecordIds) {
      if (!packageRecordIds.includes(recordId)) fail(`${projectionRecordId} references a record outside the Stage-4 facts package`)
      referenced.add(recordId)
    }
    if (!Number.isInteger(record.ingredient_id) || record.ingredient_id <= 0) fail(`${projectionRecordId}.ingredient_id must be a positive integer`)
    if (!['adult', 'pregnant', 'breastfeeding', 'children', 'elderly'].includes(record.population_key)) fail(`${projectionRecordId}.population_key is invalid`)
    for (const key of ['source_type', 'source_label', 'source_url', 'reported_amount_text', 'unit', 'purpose', 'relevance_reason']) text(record[key], `${projectionRecordId}.${key}`)
    if (!/^https?:\/\//i.test(record.source_url)) fail(`${projectionRecordId}.source_url must be HTTP(S)`)
    if (!['recommended_amount', 'tested_amount', 'reference_value'].includes(record.amount_type)) fail(`${projectionRecordId}.amount_type is invalid`)
    if (!Number.isFinite(record.dose_min) || !Number.isFinite(record.dose_max) || record.dose_min > record.dose_max) fail(`${projectionRecordId} dose range is invalid`)
    const sourceIds = new Set(facts.map((fact) => fact.source_id))
    if (sourceIds.size !== 1) fail(`${projectionRecordId} cannot merge facts from different sources into one operational record`)
    const source = sourceById.get(facts[0].source_id)
    if (!source || record.source_type !== source.source_type || record.source_label !== source.label || record.source_url !== source.source_url) fail(`${projectionRecordId} source fields differ from the bound original source`)
    const numericFacts = facts.map((fact) => {
      if (Number.isFinite(fact.value) && typeof fact.unit === 'string' && fact.unit.trim()) return { fact, min: fact.value, max: fact.value, unit: fact.unit }
      const context = fact.context ?? {}
      if (Number.isFinite(context.amount_min) && Number.isFinite(context.amount_max) && context.amount_min <= context.amount_max && typeof context.amount_unit === 'string' && context.amount_unit.trim()) return { fact, min: context.amount_min, max: context.amount_max, unit: context.amount_unit }
      return null
    })
    if (!numericFacts.length || numericFacts.some((entry) => entry == null)) fail(`${projectionRecordId} operational amount requires an explicit numeric value/unit or amount range/unit in every bound fact`)
    const populationKeys = new Set(facts.map((fact) => {
      const population = String(fact.population_context ?? '').toLowerCase()
      if (/pregnan|schwanger/.test(population)) return 'pregnant'
      if (/breast|stillend/.test(population)) return 'breastfeeding'
      if (/child|kind|adolesc/.test(population)) return 'children'
      if (/elder|older|senior|älter/.test(population)) return 'elderly'
      if (/adult|erwachsen/.test(population)) return 'adult'
      return null
    }))
    if (populationKeys.size !== 1 || !populationKeys.has(record.population_key)) fail(`${projectionRecordId}.population_key is not exactly derivable from its facts`)
    const units = new Set(numericFacts.map((entry) => entry.unit))
    if (units.size !== 1 || record.unit !== numericFacts[0].unit) fail(`${projectionRecordId}.unit differs from its facts`)
    if (record.dose_min !== Math.min(...numericFacts.map((entry) => entry.min)) || record.dose_max !== Math.max(...numericFacts.map((entry) => entry.max))) fail(`${projectionRecordId} dose range is not the exact min/max of its bound facts`)
    const expectedAmountType = numericFacts.every(({ fact }) => /(?:reference|referenz|recommended|empfohlen)/i.test(`${fact.claim_type} ${fact.predicate_key} ${fact.claim}`))
      ? (numericFacts.every(({ fact }) => /(?:recommended|empfohlen)/i.test(`${fact.claim_type} ${fact.predicate_key} ${fact.claim}`)) ? 'recommended_amount' : 'reference_value')
      : 'tested_amount'
    if (record.amount_type !== expectedAmountType) fail(`${projectionRecordId}.amount_type is not derivable from its facts`)
    const exactClaims = [...new Set(facts.map((fact) => fact.claim))]
    const expectedReportedText = exactClaims.join(' | ')
    if (record.reported_amount_text !== expectedReportedText) fail(`${projectionRecordId}.reported_amount_text must preserve the exact bound fact claim text`)
    const relevanceReasons = [...new Set(facts.map((fact) => fact.stage4_relevance?.reason).filter(Boolean))]
    if (!relevanceReasons.includes(record.relevance_reason)) fail(`${projectionRecordId}.relevance_reason is not present in its reviewed facts`)
    const supportedPurposes = new Set(facts.flatMap((fact) => [fact.claim_type, fact.claim, fact.stage4_relevance?.reason].filter(Boolean)))
    if (!supportedPurposes.has(record.purpose)) fail(`${projectionRecordId}.purpose is not present in its reviewed facts`)
    if (!['standard', 'alternative', 'tie', 'not_in_stack'].includes(record.stack_role)) fail(`${projectionRecordId}.stack_role is invalid`)
    if (typeof record.visible !== 'boolean' || typeof record.controversial !== 'boolean') fail(`${projectionRecordId} visibility/controversy flags must be boolean`)
    text(record.lifecycle_status, `${projectionRecordId}.lifecycle_status`)
    if (record.stack_role === 'tie' && (!record.controversial || record.visible)) fail(`${projectionRecordId} tie must be controversial and not preselected/visible`)
    if (record.stack_role === 'not_in_stack' && record.visible) fail(`${projectionRecordId} not_in_stack must be invisible`)
  }
  if (!sameSet([...referenced], packageRecordIds)) fail('stack projection records must account for every Stage-4 package record exactly by membership')
  if (projectionValue.content_hash !== artifactHash(projectionValue)) fail('stack projection content_hash is stale')
  return projectionValue
}

export function validateFactsPackageForImportV2({ packageValue, stage, articleId, pipeline, expected }) {
  object(packageValue, `${stage} facts package`)
  const schema = stage === 'stage2' ? 'facts_package_for_stage2.v2' : 'facts_package_for_stage3.v2'
  if (packageValue.schema !== schema || packageValue.stage !== stage || packageValue.article_id !== articleId) fail(`${articleId} facts package schema/stage/article binding is invalid`)
  if (packageValue.package_content_hash !== artifactHash(packageValue)) fail(`${articleId} facts package content hash is stale`)
  if (packageValue.substance?.slug !== expected.substance || packageValue.language !== expected.language) fail(`${articleId} facts package substance/language differs from run`)
  if (packageValue.policy_version !== expected.policyVersion || packageValue.validator_version !== expected.validatorVersion) fail(`${articleId} facts package policy/validator version differs from the active runtime`)
  const coverageArticle = pipeline.coveragePlan.articles.find((entry) => entry.article_id === articleId)
  if (!coverageArticle) fail(`${articleId} facts package has no coverage article`)
  if (stage === 'stage2' && canonicalJsonHash(packageValue.source_assignment) !== canonicalJsonHash(coverageArticle.source_assignment)) fail(`${articleId} Stage-2 source assignment differs from coverage`)
  if (stage === 'stage2' && packageValue.source_presentation_label_de !== coverageArticle.source_presentation_label_de) fail(`${articleId} Stage-2 German source presentation label differs from coverage`)
  const gate = pipeline.factsGate.article_gates?.[articleId]
  if (gate?.status !== 'PASS' || !sameSet(packageValue.required_cluster_ids, gate.required_cluster_ids) || !sameSet(packageValue.obligation_ids, gate.obligation_ids)) fail(`${articleId} facts package differs from its passing article gate`)
  if (!sameSet(packageValue.record_ids, packageValue.facts.map((entry) => entry.record_id)) || packageValue.facts.some((fact) => !packageValue.obligation_ids.includes(fact.obligation_id))) fail(`${articleId} facts package record/obligation set is inconsistent`)
  const factsReviewerIds = unique(packageValue.facts_reviewer_ids, `${articleId}.facts_reviewer_ids`)
  const directFactsReviewerIds = unique(packageValue.direct_facts_reviewer_ids ?? [], `${articleId}.direct_facts_reviewer_ids`, { allowEmpty: true })
  if (!sameSet(factsReviewerIds, pipeline.lock.facts_reviewer_ids) || directFactsReviewerIds.some((id) => !factsReviewerIds.includes(id))) fail(`${articleId} facts reviewer lineage differs from the global gate or direct reviewed slice`)
  const expectedFacts = pipeline.evidenceBundle.records.filter((record) => packageValue.obligation_ids.includes(record.obligation_id)).sort((a, b) => a.record_id.localeCompare(b.record_id)).map(writerFact)
  if (canonicalJsonHash(packageValue.facts) !== canonicalJsonHash(expectedFacts)) fail(`${articleId} facts package differs from its current article evidence slice`)
  const lockEntry = pipeline.lock.packages?.[stage]?.[articleId]
  const expectedArticlePackageHash = canonicalJsonHash({ schema: 'article_facts_package_binding.v2', article_id: articleId, stage, evidence_membership_hash: packageValue.evidence_membership_hash })
  if (packageValue.article_package_hash !== expectedArticlePackageHash) fail(`${articleId} stable article package hash is invalid`)
  if (!lockEntry || lockEntry.package_hash !== packageValue.package_content_hash || lockEntry.article_package_hash !== packageValue.article_package_hash || lockEntry.article_lineage_hash !== packageValue.article_lineage_hash || lockEntry.evidence_membership_hash !== packageValue.evidence_membership_hash || lockEntry.framework_hash !== packageValue.framework_hash) fail(`${articleId} facts package is not the exact lock-bound package`)
  const framework = object(packageValue.framework, `${articleId}.framework`)
  const frameworkPath = resolveManifestPath(REPO_ROOT, framework.path, `${articleId}.framework.path`)
  if (!existsSync(frameworkPath) || sha256Bytes(readFileSync(frameworkPath)) !== framework.byte_hash || canonicalJsonHash(framework) !== packageValue.framework_hash) fail(`${articleId} actual framework file bytes/hash differ from its package`)
  if (!array(pipeline.lock.framework_files, 'lock.framework_files').some((entry) => entry.path === portablePath(REPO_ROOT, frameworkPath) && entry.byte_hash === framework.byte_hash && entry.framework_hash === packageValue.framework_hash)) fail(`${articleId} framework is not bound by the evidence lock`)
  const seoBrief = validateSeoBrief(packageValue.seo_brief, `${articleId}.seo_brief`)
  validateSelectedLinkSlice(packageValue.selected_link_slice, seoBrief, `${articleId}.selected_link_slice`)
  if (stage === 'stage3') {
    if (packageValue.source_presentation_policy !== 'internal_stage2_only') fail(`${articleId} Stage-3 source presentation policy must equal internal_stage2_only`)
    const presentationSources = array(packageValue.presentation_sources, `${articleId}.presentation_sources`)
    const originalSourceIds = new Set(packageValue.visible_sources.map((source) => source.source_id))
    if (originalSourceIds.size > 0 && presentationSources.length === 0) fail(`${articleId} Stage-3 presentation_sources cannot be empty when original evidence sources are present`)
    const presentationIds = new Set()
    const coveredSourceIds = new Set()
    for (const [index, source] of presentationSources.entries()) {
      object(source, `${articleId}.presentation_sources[${index}]`)
      const presentationId = assertSafeId(source.source_id, `${articleId}.presentation_sources[${index}].source_id`)
      if (presentationIds.has(presentationId)) fail(`${articleId} Stage-3 presentation source IDs must be unique`)
      presentationIds.add(presentationId)
      text(source.label, `${articleId}.${presentationId}.label`)
      const sourceUrl = text(source.source_url, `${articleId}.${presentationId}.source_url`)
      if (!/^\/wissen\/[a-z0-9-]+$/.test(sourceUrl)) fail(`${articleId} Stage-3 presentation source ${presentationId} must target an internal knowledge article`)
      assertSafeId(source.target_article_id, `${articleId}.${presentationId}.target_article_id`)
      for (const coveredId of unique(source.covered_source_ids, `${articleId}.${presentationId}.covered_source_ids`)) {
        if (!originalSourceIds.has(coveredId)) fail(`${articleId} Stage-3 presentation source ${presentationId} covers unknown original source ${coveredId}`)
        coveredSourceIds.add(coveredId)
      }
    }
    if (coveredSourceIds.size !== originalSourceIds.size || [...originalSourceIds].some((sourceId) => !coveredSourceIds.has(sourceId))) fail(`${articleId} Stage-3 presentation sources do not cover every original evidence source`)
    object(packageValue.blueprint, `${articleId}.blueprint`); assertSafeId(packageValue.blueprint.blueprint_id, `${articleId}.blueprint.blueprint_id`); array(packageValue.controversies, `${articleId}.controversies`)
    const assumptionReview = validateCommonAssumptionReview(packageValue.common_assumption_review, `${articleId}.common_assumption_review`, { resolved: true })
    if (canonicalJsonHash({ ...assumptionReview, checks: assumptionReview.checks.map(({ record_ids, ...check }) => check) }) !== canonicalJsonHash(coverageArticle.common_assumption_review)) fail(`${articleId} common assumption review differs from coverage`)
    for (const check of assumptionReview.checks) {
      const expectedRecordIds = sorted(packageValue.facts.filter((fact) => check.obligation_ids.includes(fact.obligation_id)).map((fact) => fact.record_id))
      if (!sameSet(check.record_ids, expectedRecordIds)) fail(`${articleId} assumption ${check.assumption_id} record bindings differ from its resolved obligations`)
    }
    const graphic = validateResolvedGraphicDecision(packageValue.graphic_decision, `${articleId}.graphic_decision`)
    if (graphic.record_ids.some((id) => !packageValue.record_ids.includes(id)) || graphic.obligation_ids.some((id) => !packageValue.obligation_ids.includes(id)) || graphic.cluster_ids.some((id) => !packageValue.required_cluster_ids.includes(id))) fail(`${articleId} graphic bindings leave the article facts slice`)
    const expectedGraphicRecords = packageValue.facts.filter((fact) => graphic.obligation_ids.includes(fact.obligation_id) && graphic.cluster_ids.includes(fact.cluster_id)).map((fact) => fact.record_id)
    if (!sameSet(graphic.record_ids, expectedGraphicRecords)) fail(`${articleId} graphic record bindings differ from its resolved obligation/cluster slice`)
  }
  return packageValue
}

export const EVIDENCE_V2_REPO_ROOT = REPO_ROOT
export { artifactHash as artifactHashV2 }
