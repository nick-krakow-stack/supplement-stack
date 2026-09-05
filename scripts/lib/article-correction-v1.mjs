import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { canonicalJsonHash, decodeUtf8Strict, sha256Bytes } from './content-validation.mjs'
import { artifactHashV2 } from './evidence-pipeline-v2.mjs'
import { assertSafeId, portablePath, resolveManifestPath } from './safe-paths.mjs'

const HASH = /^sha256:[a-f0-9]{64}$/
const NUMBER_UNIT = /(?<![\p{L}\p{N}_])(\d+(?:[.,]\d+)?)\s*(µg|μg|ug|mcg|mg|kg|g|ml|l|IE|IU|%|mmol|mol|KBE|CFU)(?![\p{L}\p{N}_])/giu

function fail(message) { throw new Error(message) }
function object(value, label) { if (!value || typeof value !== 'object' || Array.isArray(value)) fail(`${label} must be an object`); return value }
function array(value, label) { if (!Array.isArray(value)) fail(`${label} must be an array`); return value }
function text(value, label) { if (typeof value !== 'string' || !value.trim()) fail(`${label} must be a non-empty string`); return value.trim() }
function iso(value, label) { const result = text(value, label); if (!Number.isFinite(Date.parse(result))) fail(`${label} must be ISO-8601`); return result }
function sameSet(left, right) { const a = new Set(left), b = new Set(right); return a.size === left.length && b.size === right.length && a.size === b.size && [...a].every((entry) => b.has(entry)) }
function hash(value, label) { const result = text(value, label); if (!HASH.test(result)) fail(`${label} must be a sha256 hash`); return result }
function strictJson(path, label = path) {
  const decoded = decodeUtf8Strict(readFileSync(path), label)
  if (decoded.errors.length) fail(decoded.errors.join('; '))
  try { return JSON.parse(decoded.text) } catch (error) { fail(`${label} is invalid JSON: ${error.message}`) }
}
function markdown(path, label) {
  const bytes = readFileSync(path), decoded = decodeUtf8Strict(bytes, label)
  if (decoded.errors.length) fail(decoded.errors.join('; '))
  return { path, byte_hash: sha256Bytes(bytes), text: decoded.text.replaceAll('\r\n', '\n') }
}
function normalize(value) { return String(value ?? '').normalize('NFKC').replace(/\s+/g, ' ').trim() }
function links(value) { return [...value.matchAll(/(?<!!)\[([^\]\n]+)\]\(([^)\n]+)\)/g)].map((match) => ({ label: normalize(match[1]), url: match[2].trim() })) }
function headings(value) { return [...value.matchAll(/^(#{1,6})\s+(.+?)\s*$/gm)].map((match) => ({ level: match[1].length, text: normalize(match[2]) })) }
function tables(value) { return value.split('\n').filter((line) => /^\s*\|.*\|\s*$/.test(line)).map((line) => line.trim().slice(1, -1).split('|').map(normalize)) }
function numbers(value) { return [...value.matchAll(NUMBER_UNIT)].map((match) => normalize(match[0])) }
function deduplicatedVisibleText(value) {
  const plain = value.replace(/<!--[\s\S]*?-->/g, '').replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1').replace(/\[([^\]]+)\]\([^)]*\)/g, '$1').replace(/^#{1,6}\s+/gm, '').replace(/^[-*+]\s+/gm, '').replace(/[|*_>`~]/g, ' ')
  const blocks = plain.split(/\n\s*\n/).map(normalize).filter(Boolean)
  return [...new Set(blocks)].join('\n')
}

function releaseVisibleDocument(releaseArticle) {
  const payload = object(releaseArticle.publish_payload, `${releaseArticle.article_id}.publish_payload`)
  const sources = array(payload.sources, `${releaseArticle.article_id}.publish_payload.sources`)
  return [
    `# ${String(payload.title ?? '')}`,
    String(payload.dek ?? ''),
    String(payload.body ?? ''),
    String(payload.conclusion ?? ''),
    ...sources.map((source) => `[${String(source.label ?? '')}](${String(source.url ?? '')})`),
  ].join('\n\n')
}

function semanticSeo(value) {
  const seo = object(value, 'release article seo')
  const jsonLd = { ...object(seo.json_ld, 'release article seo.json_ld') }
  delete jsonLd.datePublished
  delete jsonLd.dateModified
  return { meta_title: seo.meta_title, meta_description: seo.meta_description, canonical_url: seo.canonical_url, canonical_path: seo.canonical_path, robots: seo.robots, indexable: seo.indexable, json_ld: jsonLd }
}

function semanticFingerprint(markdownText, releaseArticle) {
  const releaseVisible = releaseVisibleDocument(releaseArticle)
  const material = {
    normalized_visible_text: deduplicatedVisibleText(markdownText), headings: headings(markdownText), tables: tables(markdownText), links: links(markdownText), number_unit_tokens: numbers(markdownText),
    release_normalized_visible_text: deduplicatedVisibleText(releaseVisible), release_headings: headings(releaseVisible), release_tables: tables(releaseVisible), release_links: links(releaseVisible), release_number_unit_tokens: numbers(releaseVisible),
    citations: releaseArticle.source_relations ?? [], identity: { article_id: releaseArticle.article_id, stage: releaseArticle.stage, slug: releaseArticle.slug, target: releaseArticle.target, desired_status: releaseArticle.desired_status },
    metadata: { seo: semanticSeo(releaseArticle.seo), framework_hash: releaseArticle.framework_hash, facts_package_hash: releaseArticle.facts_package_hash, evidence_membership_hash: releaseArticle.evidence_membership_hash },
    assets: releaseArticle.assets ?? [], extracts: releaseArticle.extracts ?? null, badge_driving_data: releaseArticle.badge_driving_data ?? null,
  }
  return { ...material, semantic_hash: canonicalJsonHash(material) }
}

function lineDiff(previous, candidate) {
  const left = previous.split('\n'), right = candidate.split('\n')
  const table = Array.from({ length: left.length + 1 }, () => new Uint32Array(right.length + 1))
  for (let i = left.length - 1; i >= 0; i -= 1) for (let j = right.length - 1; j >= 0; j -= 1) table[i][j] = left[i] === right[j] ? table[i + 1][j + 1] + 1 : Math.max(table[i + 1][j], table[i][j + 1])
  const changes = []; let i = 0; let j = 0
  while (i < left.length || j < right.length) {
    if (i < left.length && j < right.length && left[i] === right[j]) { i += 1; j += 1; continue }
    if (j < right.length && (i >= left.length || table[i][j + 1] >= table[i + 1][j])) { changes.push({ kind: 'insert', old_line: null, new_line: j + 1, old_text: null, new_text: right[j] }); j += 1 }
    else { changes.push({ kind: 'delete', old_line: i + 1, new_line: null, old_text: left[i], new_text: null }); i += 1 }
  }
  return changes
}

function neighbourhood(candidate, changes) {
  const lines = candidate.split('\n'), changed = changes.map((change) => change.new_line).filter(Number.isInteger)
  const selected = new Set()
  for (const line of changed) for (let offset = -2; offset <= 2; offset += 1) if (line + offset >= 1 && line + offset <= lines.length) selected.add(line + offset)
  return [...selected].sort((a, b) => a - b).map((line) => ({ line, text: lines[line - 1] }))
}

function validateReleaseArticle(article, label) {
  object(article, label)
  assertSafeId(article.article_id, `${label}.article_id`); assertSafeId(article.slug, `${label}.slug`)
  if (!['stage2', 'stage3'].includes(article.stage) || article.desired_status !== 'published') fail(`${label} stage/status is invalid`)
  if (article.article_layer != null && article.article_layer !== (article.stage === 'stage2' ? 'single_study' : 'main_article')) fail(`${label}.article_layer differs from its stage`)
  const reviewedAt = iso(article.reviewed_at, `${label}.reviewed_at`), publishedAt = iso(article.published_at, `${label}.published_at`), modifiedAt = iso(article.modified_at, `${label}.modified_at`)
  if (Date.parse(modifiedAt) < Date.parse(publishedAt) || Date.parse(modifiedAt) < Date.parse(reviewedAt)) fail(`${label} publication timestamps are invalid`)
  const guard = object(article.write_guard, `${label}.write_guard`)
  if (!['create', 'update'].includes(guard.mode) || !Number.isInteger(guard.expected_version) || guard.expected_version < 0) fail(`${label}.write_guard is invalid`)
  if (guard.mode === 'create'
    ? guard.expected_status !== 'absent' || guard.expected_version !== 0 || guard.expected_payload_hash != null
    : guard.expected_version < 1 || !['draft', 'published', 'archived'].includes(guard.expected_status) || !HASH.test(guard.expected_payload_hash ?? '')) fail(`${label}.write_guard prestate is invalid`)
  for (const key of ['compiled_payload_hash', 'visible_payload_hash', 'qa_payload_hash', 'render_snapshot_hash', 'relation_hash', 'projection_hash', 'seo_hash']) if (!HASH.test(article[key] ?? '')) fail(`${label}.${key} is invalid`)
  if (article.projection_hash !== canonicalJsonHash(object(article.expected_projection, `${label}.expected_projection`))) fail(`${label}.projection_hash is stale`)
  const publicSeo = object(article.seo, `${label}.seo`)
  if (article.seo_hash !== canonicalJsonHash({ meta_title: publicSeo.meta_title, meta_description: publicSeo.meta_description, canonical_url: publicSeo.canonical_url, canonical_path: publicSeo.canonical_path, robots: publicSeo.robots, indexable: publicSeo.indexable, json_ld: publicSeo.json_ld })) fail(`${label}.seo_hash is stale`)
  if (publicSeo.json_ld?.datePublished !== publishedAt || publicSeo.json_ld?.dateModified !== modifiedAt) fail(`${label} JSON-LD publication timestamps differ from the release article`)
  const sourceRelations = array(article.source_relations, `${label}.source_relations`)
  if (article.relation_hash !== canonicalJsonHash(sourceRelations)) fail(`${label}.relation_hash is stale`)
  const visiblePayload = object(article.publish_payload, `${label}.publish_payload`)
  if (visiblePayload.schema !== 'article_visible_payload.v2' || visiblePayload.slug !== article.slug) fail(`${label}.publish_payload identity is invalid`)
  const projectedSources = sourceRelations.map(({ source_id, label: sourceLabel, url }) => ({ source_id, label: sourceLabel, url }))
  if (canonicalJsonHash(visiblePayload.sources) !== canonicalJsonHash(projectedSources)) fail(`${label}.publish_payload sources differ from the frozen relations`)
  array(article.assets, `${label}.assets`); array(article.asset_hashes, `${label}.asset_hashes`); array(article.internal_link_dependencies ?? [], `${label}.internal_link_dependencies`)
  const ingredientIds = array(article.ingredient_ids, `${label}.ingredient_ids`)
  if (!ingredientIds.length || ingredientIds.some((id) => !Number.isInteger(id) || id <= 0) || article.ingredient_relation_hash !== canonicalJsonHash({ ingredient_ids: ingredientIds })) fail(`${label} ingredient relation is invalid`)
  const sourceProjection = object(article.source_projection, `${label}.source_projection`)
  if (sourceProjection.schema !== 'knowledge_article_sources_projection.v2' || sourceProjection.facts_package_hash !== article.facts_package_hash || sourceProjection.relation_hash !== article.relation_hash || !sameSet(sourceProjection.ingredient_ids ?? [], ingredientIds) || canonicalJsonHash(sourceProjection.relations) !== canonicalJsonHash(sourceRelations)) fail(`${label}.source_projection is stale`)
  const interpretations = array(article.stage2_interpretation_projection, `${label}.stage2_interpretation_projection`)
  if (article.stage === 'stage2' ? !interpretations.length : interpretations.length) fail(`${label}.stage2_interpretation_projection cardinality is invalid`)
  return article
}

function validateReleaseContext(value, beforeArticle, candidateArticle, label = 'article correction release_context') {
  const context = object(value, label)
  const ingredientTarget = object(context.ingredient_target, `${label}.ingredient_target`)
  if (!Number.isInteger(ingredientTarget.ingredient_id) || ingredientTarget.ingredient_id <= 0 || ingredientTarget.status !== 'active' || !Number.isInteger(ingredientTarget.version) || ingredientTarget.version <= 0) fail(`${label}.ingredient_target identity is invalid`)
  const identity = { ingredient_id: ingredientTarget.ingredient_id, canonical_name: text(ingredientTarget.canonical_name, `${label}.ingredient_target.canonical_name`), canonical_slug: assertSafeId(ingredientTarget.canonical_slug, `${label}.ingredient_target.canonical_slug`), status: ingredientTarget.status, version: ingredientTarget.version }
  if (ingredientTarget.identity_hash !== canonicalJsonHash(identity)) fail(`${label}.ingredient_target.identity_hash is stale`)
  hash(ingredientTarget.receipt_hash, `${label}.ingredient_target.receipt_hash`)
  hash(context.source_resolution_receipt_hash, `${label}.source_resolution_receipt_hash`)
  for (const [name, article] of [['before', beforeArticle], ['candidate', candidateArticle]]) {
    if (!sameSet(article.ingredient_ids, [identity.ingredient_id])) fail(`${label} ${name} article ingredient relation differs from the authoritative target`)
    if (article.stage === 'stage2' && article.stage2_interpretation_projection.some((entry) => entry.source_resolution_receipt_hash !== context.source_resolution_receipt_hash)) fail(`${label} ${name} Stage-2 interpretation source lineage differs`)
  }
  if (candidateArticle.write_guard.mode === 'update' ? !HASH.test(context.article_target_receipt_hash ?? '') : context.article_target_receipt_hash != null) fail(`${label}.article_target_receipt_hash differs from the candidate write guard`)
  const hasAssets = [beforeArticle, candidateArticle].some((article) => article.assets.length)
  if (hasAssets ? !HASH.test(context.asset_deployment_receipt_hash ?? '') : context.asset_deployment_receipt_hash != null) fail(`${label}.asset_deployment_receipt_hash differs from the article assets`)
  if (hasAssets && [beforeArticle, candidateArticle].some((article) => article.assets.some((asset) => asset.deployment_receipt_hash !== context.asset_deployment_receipt_hash))) fail(`${label} article asset lineage differs from the deployment receipt`)
  return {
    ingredient_target: { ...identity, identity_hash: ingredientTarget.identity_hash, receipt_hash: ingredientTarget.receipt_hash },
    source_resolution_receipt_hash: context.source_resolution_receipt_hash,
    article_target_receipt_hash: context.article_target_receipt_hash ?? null,
    asset_deployment_receipt_hash: context.asset_deployment_receipt_hash ?? null,
  }
}

export function buildArticleCorrectionInputReceiptV1({ root, request, frozenAt = new Date().toISOString() }) {
  object(request, 'article correction request')
  if (request.schema !== 'article_correction_request.v1') fail('article correction request schema must equal article_correction_request.v1')
  const runId = assertSafeId(request.run_id, 'article correction request run_id')
  const changeClass = text(request.change_class, 'article correction request change_class')
  if (!['S', 'M', 'L'].includes(changeClass)) fail('article correction change_class must be S, M or L')
  if (request.before?.authoritative_snapshot_path != null) {
    if (changeClass !== 'L' || request.before.release_article != null || request.candidate != null) fail('authoritative-before correction is L-only and cannot invent a prior or candidate release')
    const snapshotPath = resolveManifestPath(root, request.before.authoritative_snapshot_path, 'L correction authoritative before path')
    const snapshot = strictJson(snapshotPath, 'L correction authoritative before')
    validateAuthoritativeCorrectionBeforeV1(snapshot)
    const base = {
      schema: 'article_correction_input_receipt.v1', mode: 'authoritative_before', run_id: runId, change_class: 'L', frozen_at: iso(frozenAt, 'article correction frozen_at'),
      affected_article_ids: [snapshot.article_id],
      before: { authoritative_snapshot_path: portablePath(root, snapshotPath), authoritative_snapshot_hash: snapshot.content_hash },
    }
    return { ...base, content_hash: artifactHashV2(base) }
  }
  const beforeArticle = validateReleaseArticle(request.before?.release_article, 'article correction before.release_article')
  const candidateArticle = validateReleaseArticle(request.candidate?.release_article, 'article correction candidate.release_article')
  if (beforeArticle.article_id !== candidateArticle.article_id || beforeArticle.stage !== candidateArticle.stage || beforeArticle.slug !== candidateArticle.slug) fail('article correction before/candidate identity differs')
  const releaseContext = validateReleaseContext(request.release_context, beforeArticle, candidateArticle)
  const beforePath = resolveManifestPath(root, request.before.markdown_path, 'article correction before.markdown_path')
  const candidatePath = resolveManifestPath(root, request.candidate.markdown_path, 'article correction candidate.markdown_path')
  if (!existsSync(beforePath) || !existsSync(candidatePath)) fail('article correction before/candidate Markdown is missing')
  const before = markdown(beforePath, 'article correction before Markdown'), candidate = markdown(candidatePath, 'article correction candidate Markdown')
  const changes = lineDiff(before.text, candidate.text)
  if (!changes.length) fail('article correction candidate does not differ from before')
  const patchBase = { schema: 'article_correction_patch.v1', before_byte_hash: before.byte_hash, candidate_byte_hash: candidate.byte_hash, changes, neighbourhood: neighbourhood(candidate.text, changes) }
  const releaseBefore = releaseVisibleDocument(beforeArticle), releaseCandidate = releaseVisibleDocument(candidateArticle)
  patchBase.release_changes = lineDiff(releaseBefore, releaseCandidate)
  patchBase.release_neighbourhood = neighbourhood(releaseCandidate, patchBase.release_changes)
  const patch = { ...patchBase, patch_hash: canonicalJsonHash(patchBase) }
  const base = {
    schema: 'article_correction_input_receipt.v1', run_id: runId, change_class: changeClass, frozen_at: iso(frozenAt, 'article correction frozen_at'), affected_article_ids: [beforeArticle.article_id],
    release_context: releaseContext,
    before: { markdown_path: portablePath(root, beforePath), markdown_byte_hash: before.byte_hash, release_article: beforeArticle, release_article_hash: canonicalJsonHash(beforeArticle), semantic_fingerprint: semanticFingerprint(before.text, beforeArticle) },
    candidate: { markdown_path: portablePath(root, candidatePath), markdown_byte_hash: candidate.byte_hash, release_article: candidateArticle, release_article_hash: canonicalJsonHash(candidateArticle), semantic_fingerprint: semanticFingerprint(candidate.text, candidateArticle) },
    patch,
  }
  return { ...base, content_hash: artifactHashV2(base) }
}

export function loadArticleCorrectionInputReceiptV1({ root, path, runId, changeClass }) {
  const receipt = strictJson(path, 'article correction input receipt')
  if (receipt.schema !== 'article_correction_input_receipt.v1' || receipt.content_hash !== artifactHashV2(receipt)) fail('article correction input receipt schema/hash is invalid')
  if (receipt.run_id !== runId || receipt.change_class !== changeClass) fail('article correction input receipt run/class differs from manifest')
  iso(receipt.frozen_at, 'article correction input receipt frozen_at')
  if (receipt.mode === 'authoritative_before') {
    if (changeClass !== 'L' || receipt.candidate != null || receipt.before?.release_article != null) fail('authoritative-before correction must remain L without invented release lineage')
    const beforePath = resolveManifestPath(root, receipt.before.authoritative_snapshot_path, 'L correction authoritative before path')
    const authoritativeBefore = strictJson(beforePath, 'L correction authoritative before')
    validateAuthoritativeCorrectionBeforeV1(authoritativeBefore)
    if (authoritativeBefore.content_hash !== receipt.before.authoritative_snapshot_hash || !sameSet(receipt.affected_article_ids, [authoritativeBefore.article_id])) fail('L correction authoritative before hash/identity differs')
    const state = authoritativeBefore.state
    return { value: receipt, beforePath, authoritativeBefore, candidatePath: null,
      candidateArticle: { article_id: state.article_id, stage: state.stage, slug: state.slug,
        write_guard: { mode: 'update', expected_status: state.status, expected_version: state.version, expected_payload_hash: state.payload_hash } } }
  }
  const beforePath = resolveManifestPath(root, receipt.before.markdown_path, 'article correction before Markdown path')
  const candidatePath = resolveManifestPath(root, receipt.candidate.markdown_path, 'article correction candidate Markdown path')
  const before = markdown(beforePath, 'article correction before Markdown'), candidate = markdown(candidatePath, 'article correction candidate Markdown')
  if (before.byte_hash !== receipt.before.markdown_byte_hash || candidate.byte_hash !== receipt.candidate.markdown_byte_hash) fail('article correction frozen Markdown bytes changed')
  const beforeArticle = validateReleaseArticle(receipt.before.release_article, 'article correction before.release_article')
  const candidateArticle = validateReleaseArticle(receipt.candidate.release_article, 'article correction candidate.release_article')
  validateReleaseContext(receipt.release_context, beforeArticle, candidateArticle, 'article correction input receipt release_context')
  if (canonicalJsonHash(beforeArticle) !== receipt.before.release_article_hash || canonicalJsonHash(candidateArticle) !== receipt.candidate.release_article_hash) fail('article correction release article hash is stale')
  if (canonicalJsonHash(semanticFingerprint(before.text, beforeArticle)) !== canonicalJsonHash(receipt.before.semantic_fingerprint) || canonicalJsonHash(semanticFingerprint(candidate.text, candidateArticle)) !== canonicalJsonHash(receipt.candidate.semantic_fingerprint)) fail('article correction semantic fingerprint is stale')
  const changes = lineDiff(before.text, candidate.text)
  const releaseBefore = releaseVisibleDocument(beforeArticle), releaseCandidate = releaseVisibleDocument(candidateArticle), releaseChanges = lineDiff(releaseBefore, releaseCandidate)
  const expectedPatchBase = { schema: 'article_correction_patch.v1', before_byte_hash: before.byte_hash, candidate_byte_hash: candidate.byte_hash, changes, neighbourhood: neighbourhood(candidate.text, changes), release_changes: releaseChanges, release_neighbourhood: neighbourhood(releaseCandidate, releaseChanges) }
  if (receipt.patch.patch_hash !== canonicalJsonHash(expectedPatchBase) || canonicalJsonHash(receipt.patch) !== canonicalJsonHash({ ...expectedPatchBase, patch_hash: canonicalJsonHash(expectedPatchBase) })) fail('article correction patch is stale')
  return { value: receipt, beforePath, candidatePath, before, candidate, beforeArticle, candidateArticle }
}

const S_EXACT_FIELDS = ['normalized_visible_text', 'release_normalized_visible_text', 'headings', 'release_headings', 'tables', 'release_tables', 'links', 'release_links', 'number_unit_tokens', 'release_number_unit_tokens', 'citations', 'identity', 'metadata', 'assets', 'extracts', 'badge_driving_data']
const M_EXACT_FIELDS = ['headings', 'release_headings', 'tables', 'release_tables', 'links', 'release_links', 'number_unit_tokens', 'release_number_unit_tokens', 'citations', 'identity', 'metadata', 'assets', 'extracts', 'badge_driving_data']

function validateFingerprintFields(input, fields, label) {
  const changed = fields.filter((field) => canonicalJsonHash(input.value.before.semantic_fingerprint[field]) !== canonicalJsonHash(input.value.candidate.semantic_fingerprint[field]))
  if (changed.length) fail(`${label} changes forbidden semantic fields: ${changed.join(', ')}`)
  return fields
}

export function validateCorrectionClassV1(input) {
  if (input.value.change_class === 'S') return { class: 'S', invariant_checks: validateFingerprintFields(input, S_EXACT_FIELDS, 'S correction'), review_required: false }
  if (input.value.change_class === 'M') return { class: 'M', invariant_checks: validateFingerprintFields(input, M_EXACT_FIELDS, 'M correction'), review_required: true }
  return { class: 'L', invariant_checks: [], review_required: true }
}

function exactWorkOrderId(workOrder) { return canonicalJsonHash(Object.fromEntries(Object.entries(workOrder).filter(([key]) => key !== 'work_order_id'))) }

export function validateArticleCorrectionResultV1({ result, input, issuedWorkOrders }) {
  if (result.schema !== 'article_correction_result.v1' || result.content_hash !== artifactHashV2(result) || result.result !== 'PASS') fail('article correction result schema/hash/result is invalid')
  if (result.input_receipt_hash !== input.value.content_hash || result.candidate_markdown_byte_hash !== input.candidate.byte_hash || result.candidate_release_article_hash !== input.value.candidate.release_article_hash || result.patch_hash !== input.value.patch.patch_hash) fail('article correction result input/candidate/patch lineage differs')
  if (result.editor?.role !== 'article-correction-editor') fail('article correction result editor role is invalid')
  const editorId = assertSafeId(result.editor.id, 'article correction editor id'); iso(result.edited_at, 'article correction edited_at')
  const order = issuedWorkOrders.find((entry) => entry.work_order_id === result.work_order_id)
  if (!order || order.kind !== 'article_correction' || order.work_order_id !== exactWorkOrderId(order)) fail('article correction result does not bind an exact issued WorkOrder')
  return { value: result, editorId, path: null }
}

export function validateArticleCorrectionReviewV1({ review, input, result, issuedWorkOrders }) {
  if (review.schema !== 'article_correction_review.v1' || review.content_hash !== artifactHashV2(review)) fail('article correction review schema/hash is invalid')
  if (review.input_receipt_hash !== input.value.content_hash || review.correction_result_hash !== result.value.content_hash || review.patch_hash !== input.value.patch.patch_hash) fail('article correction review lineage differs')
  if (review.reviewer?.role !== 'article-correction-reviewer') fail('article correction reviewer role is invalid')
  const reviewerId = assertSafeId(review.reviewer.id, 'article correction reviewer id')
  if (reviewerId === result.editorId) fail('article correction reviewer must be independent from editor')
  iso(review.reviewed_at, 'article correction reviewed_at')
  const order = issuedWorkOrders.find((entry) => entry.work_order_id === review.work_order_id)
  if (!order || order.kind !== 'article_correction_review' || order.work_order_id !== exactWorkOrderId(order) || !order.assignee.independent_from_ids.includes(result.editorId)) fail('article correction review does not bind an exact independent issued WorkOrder')
  if (!['PASS', 'FAIL'].includes(review.result)) fail('article correction review result is invalid')
  const checks = object(review.checks, 'article correction review checks')
  for (const key of ['changed_lines_and_neighbourhood', 'readability', 'no_system_language', 'unchanged_scientific_meaning']) if (!['PASS', 'FAIL'].includes(checks[key])) fail(`article correction review check ${key} is invalid`)
  const findings = array(review.findings, 'article correction review findings')
  if (review.result === 'PASS' && (Object.values(checks).some((value) => value !== 'PASS') || findings.length)) fail('passing article correction review needs all checks PASS and no findings')
  if (review.result === 'FAIL' && Object.values(checks).every((value) => value === 'PASS')) fail('failing article correction review needs a failed check')
  return { value: review, reviewerId, findings }
}

export function buildCorrectionContentReleaseV2({ context, input, correctionResult = null, correctionReview = null }) {
  const candidate = {
    ...input.candidateArticle,
    change_class: input.value.change_class,
    correction_input_receipt_hash: input.value.content_hash,
    correction_result_hash: correctionResult?.value.content_hash ?? null,
    correction_review_hash: correctionReview?.value.content_hash ?? null,
  }
  const base = {
    schema: 'content_release.v2', run_id: context.runId, manifest_hash: context.manifestHash, policy_version: context.policyVersion,
    ingredient_target: input.value.release_context.ingredient_target,
    source_resolution_receipt_hash: input.value.release_context.source_resolution_receipt_hash,
    article_target_receipt_hash: input.value.release_context.article_target_receipt_hash,
    asset_deployment_receipt_hash: input.value.release_context.asset_deployment_receipt_hash,
    publish_target: context.publish.target, public_base_url: context.publish.publicBaseUrl, atomic: true, articles: [candidate],
  }
  return { ...base, release_hash: canonicalJsonHash(base) }
}

export { semanticFingerprint }

/** An actual historical readback is a prestate, never a reconstructed v2 release. */
export function validateAuthoritativeCorrectionBeforeV1(value, target = null) {
  exactArtifact(value, 'L authoritative before')
  if (value.schema !== 'article_correction_authoritative_before.v1' || value.read_only !== true || value.historical_compiled_lineage !== null || value.expected_changed_row_count !== 1) fail('L authoritative before schema/read-only/count/history is invalid')
  iso(value.captured_at, 'L authoritative before captured_at')
  text(value.database_id, 'L authoritative before database_id'); text(value.database_name, 'L authoritative before database_name')
  assertSafeId(value.article_id, 'L authoritative before article_id'); assertSafeId(value.slug, 'L authoritative before slug')
  const state = object(value.state, 'L authoritative before state')
  const snapshot = validateLegacySnapshot(value.full_snapshot, value.slug)
  const row = snapshot.article
  const columns = ['slug', 'title', 'summary', 'body', 'status', 'reviewed_at', 'sources_json', 'created_at', 'updated_at', 'version', 'conclusion', 'featured_image_r2_key', 'featured_image_url', 'dose_min', 'dose_max', 'dose_unit', 'product_note', 'article_layer', 'seo_json', 'update_reason']
  if (columns.some(key => !Object.hasOwn(row, key))) fail('L authoritative before article row is incomplete')
  if (row.status !== 'published' || !Number.isInteger(row.version) || row.version < 1 || row.seo_json !== null || state.seo !== null || state.compiled_payload_hash !== null) fail('L authoritative before is not a published article without historical compiled/SEO lineage')
  if (state.article_id !== value.article_id || state.slug !== value.slug || state.status !== row.status || state.version !== row.version || state.article_layer !== row.article_layer || state.stage !== (row.article_layer === 'single_study' ? 'stage2' : row.article_layer === 'main_article' ? 'stage3' : null)) fail('L authoritative before state identity differs from raw row')
  hash(state.payload_hash, 'L authoritative before payload hash')
  const persisted = object(state.persistence_snapshot, 'L authoritative before persistence snapshot')
  if (canonicalJsonHash(normalizeLegacyCorrectionRowV1(persisted.article)) !== canonicalJsonHash(row)) fail('L authoritative before raw article differs from inspected state')
  for (const key of ['source_rows', 'ingredient_rows', 'interpretation_rows']) if (canonicalJsonHash(persisted[key]) !== canonicalJsonHash(snapshot[key])) fail(`L authoritative before ${key} differs from inspected state`)
  if (target) {
    if (target.change_class !== 'L' || target.article_id !== value.article_id || target.slug !== value.slug || target.stage !== state.stage) fail('L authoritative before target identity/class differs')
    const expected = { mode: 'update', expected_status: state.status, expected_version: state.version, expected_payload_hash: state.payload_hash }
    if (canonicalJsonHash(target.write_guard) !== canonicalJsonHash(expected)) fail('L authoritative before target write guard differs')
  }
  return snapshot
}

export const LEGACY_FIELD_CORRECTION_MODE = 'legacy_field_patch'
export const LEGACY_SPELLING_UPDATE_REASON = 'Schreibfehler und beschädigte Umlaute korrigiert.'

function withoutHash(value) { return Object.fromEntries(Object.entries(value).filter(([key]) => key !== 'content_hash')) }
function exactArtifact(value, label) {
  object(value, label)
  if (value.content_hash !== canonicalJsonHash(withoutHash(value))) fail(`${label} content hash is stale`)
}

/** Migration 0110 adds only NULL; no other historical or present field is dropped. */
export function normalizeLegacyCorrectionRowV1(value) {
  const row = object(value, 'legacy article row')
  return Object.hasOwn(row, 'update_reason') ? { ...row } : { ...row, update_reason: null }
}

function validateLegacySnapshot(snapshot, slug) {
  object(snapshot, `${slug} snapshot`)
  if (snapshot.article?.slug !== slug) fail(`${slug} snapshot identity differs`)
  for (const [key, column] of [['source_rows', 'article_slug'], ['ingredient_rows', 'article_slug'], ['interpretation_rows', 'knowledge_article_slug'], ['part_rows', 'article_slug']]) {
    for (const row of array(snapshot[key], `${slug} ${key}`)) {
      if (row[column] !== slug) fail(`${slug} ${key} contains another article`)
    }
  }
  return { ...snapshot, article: normalizeLegacyCorrectionRowV1(snapshot.article) }
}

function validateUmlautFieldPatch(patch, row, label) {
  if (!['summary', 'conclusion'].includes(patch.field)) fail(`${label} changes a field outside the legacy M spelling scope`)
  if (typeof patch.before !== 'string' || typeof patch.after !== 'string' || patch.before === patch.after || patch.before.length !== patch.after.length) fail(`${label} is not an exact character repair`)
  if (row[patch.field] !== patch.before || canonicalJsonHash(patch.before) !== patch.expected_before_hash || canonicalJsonHash(patch.after) !== patch.expected_after_hash) fail(`${label} field prestate/hash differs`)
  for (let index = 0; index < patch.before.length; index += 1) {
    if (patch.before[index] !== patch.after[index] && (patch.before[index] !== '?' || !/[äöüÄÖÜß]/u.test(patch.after[index]))) fail(`${label} changes more than a damaged umlaut`)
  }
}

export function buildLegacyFieldCorrectionInputV1({ runId, prestate, proposal, authoritativeSnapshots, publicBefore, publicBaseUrl = 'https://supplementstack.de/', frozenAt = new Date().toISOString() }) {
  assertSafeId(runId, 'legacy correction run id')
  exactArtifact(prestate, 'legacy original snapshot'); exactArtifact(proposal, 'legacy editor proposal')
  if (prestate.read_only !== true || proposal.before_snapshot_hash !== prestate.content_hash) fail('legacy proposal does not bind the read-only original snapshot')
  if (proposal.schema !== 'article_spelling_correction_editor_proposal.v1') fail('legacy editor proposal schema is invalid')
  const proposals = array(proposal.proposals, 'legacy proposals')
  if (!proposals.length || proposals.length > 6 || new Set(proposals.map((entry) => entry.slug)).size !== proposals.length) fail('legacy M correction requires 1..6 distinct articles')
  const editorIds = [...new Set(proposals.map((entry) => assertSafeId(entry.editor_id, 'legacy editor id')))]
  if (editorIds.length !== 1) fail('legacy M correction requires one accountable editor')
  const articles = proposals.map((entry) => {
    assertSafeId(entry.article_id, 'legacy article id'); assertSafeId(entry.slug, 'legacy article slug')
    if (entry.requested_class !== 'M' || entry.article_id !== entry.slug) fail('legacy M article identity/class differs')
    const old = prestate.articles.filter((row) => row.slug === entry.slug)
    if (old.length !== 1 || old[0].status !== 'published' || old[0].version !== 1 || old[0].seo_json !== null) fail(`${entry.slug} is not an exact published version-1 legacy article`)
    const row = normalizeLegacyCorrectionRowV1(old[0])
    if (row.update_reason !== null || !['main_article', 'single_study'].includes(row.article_layer)) fail(`${entry.slug} legacy layer/reason differs`)
    const snapshot = validateLegacySnapshot(authoritativeSnapshots[entry.slug], entry.slug)
    if (canonicalJsonHash(snapshot.article) !== canonicalJsonHash(row)) fail(`${entry.slug} authoritative article differs from original snapshot`)
    const fields = array(entry.fields, `${entry.slug} fields`)
    if (!fields.length || fields.length > 2 || new Set(fields.map((patch) => patch.field)).size !== fields.length) fail(`${entry.slug} fields are empty or duplicate`)
    for (const patch of fields) validateUmlautFieldPatch(patch, row, entry.slug)
    const unchanged = Object.fromEntries(Object.entries(old[0]).filter(([key]) => !fields.some((patch) => patch.field === key)))
    const guard = object(entry.guard, `${entry.slug} guard`)
    if (guard.expected_row_hash !== canonicalJsonHash(old[0]) || guard.expected_unchanged_fields_hash !== canonicalJsonHash(unchanged)
      || guard.expected_status !== row.status || guard.expected_version !== row.version || guard.expected_article_layer !== row.article_layer || guard.expected_changed_row_count !== 1) fail(`${entry.slug} proposed full-row guard differs`)
    for (const [key, snapshotKey, column] of [['sources', 'source_rows', 'article_slug'], ['ingredients', 'ingredient_rows', 'article_slug'], ['interpretations', 'interpretation_rows', 'knowledge_article_slug']]) {
      const original = prestate[key].filter((relation) => relation[column] === entry.slug)
      if (canonicalJsonHash(original) !== guard[`expected_${key}_hash`] || canonicalJsonHash(snapshot[snapshotKey]) !== canonicalJsonHash(original)) fail(`${entry.slug} ${key} changed before freeze`)
    }
    const publicRow = publicBefore.articles.find((observed) => observed.slug === entry.slug)
    if (!publicRow || canonicalJsonHash(publicRow.article) !== publicRow.article_hash) fail(`${entry.slug} public prestate is missing or stale`)
    for (const field of ['title', 'summary', 'body', 'conclusion']) if (publicRow.article[field] !== row[field]) fail(`${entry.slug} public ${field} differs from D1 prestate`)
    const candidate = { ...row, ...Object.fromEntries(fields.map((patch) => [patch.field, patch.after])) }
    if (canonicalJsonHash(normalizeLegacyCorrectionRowV1(entry.candidate_article_without_executor_metadata)) !== canonicalJsonHash(candidate)) fail(`${entry.slug} candidate changes undeclared fields`)
    return { article_id: entry.article_id, slug: entry.slug, before: snapshot, before_hash: canonicalJsonHash(snapshot), fields,
      candidate_row: candidate, candidate_row_hash: canonicalJsonHash(candidate), public_before: publicRow.article,
      public_before_hash: publicRow.article_hash, expected_changed_row_count: 1 }
  })
  const base = { schema: 'article_correction_input_receipt.v1', mode: LEGACY_FIELD_CORRECTION_MODE, operation: 'article_correction', run_id: runId,
    change_class: 'M', frozen_at: iso(frozenAt, 'legacy frozen_at'), database_id: text(prestate.database_id, 'legacy database id'),
    publish_target: text(prestate.database_name, 'legacy database name'), public_base_url: publicBaseUrl,
    original_snapshot_hash: prestate.content_hash, correction_result_hash: proposal.content_hash, editor: { id: editorIds[0], role: 'article-correction-editor' },
    affected_article_ids: articles.map((entry) => entry.article_id), expected_article_count: articles.length,
    update_reason: LEGACY_SPELLING_UPDATE_REASON, articles,
    patch: { patch_hash: canonicalJsonHash(articles.map(({ article_id, fields }) => ({ article_id, fields }))) } }
  const input = { ...base, content_hash: canonicalJsonHash(base) }
  validateLegacyFieldCorrectionInputV1(input)
  return input
}

export function validateLegacyFieldCorrectionInputV1(input) {
  exactArtifact(input, 'legacy correction input')
  if (input.schema !== 'article_correction_input_receipt.v1' || input.mode !== LEGACY_FIELD_CORRECTION_MODE || input.operation !== 'article_correction' || input.change_class !== 'M') fail('legacy correction mode/schema/class is invalid')
  if (input.update_reason !== LEGACY_SPELLING_UPDATE_REASON) fail('legacy correction update reason differs')
  assertSafeId(input.run_id, 'legacy run id'); assertSafeId(input.editor?.id, 'legacy editor id')
  if (input.editor.role !== 'article-correction-editor') fail('legacy editor role is invalid')
  iso(input.frozen_at, 'legacy frozen_at')
  for (const value of [input.original_snapshot_hash, input.correction_result_hash]) hash(value, 'legacy input lineage hash')
  const articles = array(input.articles, 'legacy input articles')
  if (!articles.length || articles.length > 6 || articles.length !== input.expected_article_count || !sameSet(articles.map((entry) => entry.article_id), input.affected_article_ids)) fail('legacy correction article scope/count differs')
  for (const target of articles) {
    if (target.article_id !== target.slug || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(target.slug)) fail('legacy article ID/slug differs')
    const before = validateLegacySnapshot(target.before, target.slug)
    if (canonicalJsonHash(before) !== target.before_hash || target.before.article.update_reason !== null) fail(`${target.slug} frozen snapshot hash/reason differs`)
    if (before.article.status !== 'published' || before.article.version !== 1 || before.article.seo_json !== null || !['main_article', 'single_study'].includes(before.article.article_layer)) fail(`${target.slug} frozen legacy state differs`)
    if (target.expected_changed_row_count !== 1 || !target.fields.length || target.fields.length > 2 || new Set(target.fields.map((patch) => patch.field)).size !== target.fields.length) fail(`${target.slug} frozen field scope/count differs`)
    for (const patch of target.fields) validateUmlautFieldPatch(patch, before.article, target.slug)
    const candidate = { ...before.article, ...Object.fromEntries(target.fields.map((patch) => [patch.field, patch.after])) }
    if (canonicalJsonHash(candidate) !== target.candidate_row_hash || canonicalJsonHash(target.candidate_row) !== target.candidate_row_hash) fail(`${target.slug} frozen candidate differs`)
    if (canonicalJsonHash(target.public_before) !== target.public_before_hash) fail(`${target.slug} frozen public prestate hash differs`)
  }
  if (input.patch.patch_hash !== canonicalJsonHash(articles.map(({ article_id, fields }) => ({ article_id, fields })))) fail('legacy correction patch hash differs')
  return input
}

export function buildLegacyFieldCorrectionReviewOrderV1(input) {
  validateLegacyFieldCorrectionInputV1(input)
  const order = { schema: 'nutrient_content_work_order.v2', run_id: input.run_id, kind: 'article_correction_review', execution_class: 'llm', reasoning_tier: 'standard',
    assignee: { role: 'article-correction-reviewer', independent_from_ids: [input.editor.id] },
    task: { mode: input.mode, input_receipt_hash: input.content_hash, correction_result_hash: input.correction_result_hash, patch_hash: input.patch.patch_hash,
      affected_article_ids: input.affected_article_ids },
    execution_receipt: { root: 'run', path: 'legacy-correction-review.work-order-execution-receipt.v1.json', schema: 'work_order_execution_receipt.v1' } }
  return { ...order, work_order_id: exactWorkOrderId(order) }
}

export function buildLegacyFieldCorrectionReleaseV1({ input, review, reviewWorkOrder, reviewExecutionReceipt }) {
  validateLegacyFieldCorrectionInputV1(input)
  const expectedOrder = buildLegacyFieldCorrectionReviewOrderV1(input)
  if (canonicalJsonHash(reviewWorkOrder) !== canonicalJsonHash(expectedOrder)) fail('legacy correction review Order does not bind the frozen input')
  const validated = validateArticleCorrectionReviewV1({ review, input: { value: input }, result: { value: { content_hash: input.correction_result_hash }, editorId: input.editor.id }, issuedWorkOrders: [reviewWorkOrder] })
  if (validated.value.result !== 'PASS') fail('legacy field correction has not passed independent M review')
  exactArtifact(reviewExecutionReceipt, 'legacy review execution receipt')
  const timing = reviewExecutionReceipt
  if (timing.schema !== 'work_order_execution_receipt.v1' || timing.run_id !== input.run_id || timing.work_order_id !== reviewWorkOrder.work_order_id
    || timing.execution_class !== reviewWorkOrder.execution_class || timing.reasoning_tier !== reviewWorkOrder.reasoning_tier
    || timing.executor?.role !== review.reviewer.role || timing.executor?.id !== review.reviewer.id || timing.result !== 'PASS'
    || timing.result_hash !== review.content_hash) fail('legacy review execution receipt differs from exact review/Order')
  const started = Date.parse(iso(timing.started_at, 'legacy review started_at')), finished = Date.parse(iso(timing.finished_at, 'legacy review finished_at'))
  if (finished < started || Date.parse(review.reviewed_at) < started || Date.parse(review.reviewed_at) > finished) fail('legacy review execution timing differs from actual review')
  const base = { schema: 'content_release.v2', operation: 'article_correction', mode: LEGACY_FIELD_CORRECTION_MODE, run_id: input.run_id,
    publish_target: input.publish_target, public_base_url: input.public_base_url, database_id: input.database_id, atomic: true,
    input, review, review_work_order: reviewWorkOrder, review_execution_receipt: reviewExecutionReceipt, articles: input.articles }
  return { ...base, release_hash: canonicalJsonHash(base) }
}

export function validateLegacyFieldCorrectionReleaseV1(release) {
  const expected = buildLegacyFieldCorrectionReleaseV1({ input: release.input, review: release.review, reviewWorkOrder: release.review_work_order, reviewExecutionReceipt: release.review_execution_receipt })
  if (canonicalJsonHash(release) !== canonicalJsonHash(expected)) fail('legacy correction release full-contract hash differs')
  return release
}

export function buildLegacyFieldCorrectionApplyOrderV1({ release, releasePath, receiptPath = 'legacy-content-publish-receipt.v2.json' }) {
  validateLegacyFieldCorrectionReleaseV1(release)
  const order = { schema: 'nutrient_content_work_order.v2', run_id: release.run_id, kind: 'publication_apply', execution_class: 'deterministic', wave_index: null,
    reasoning_tier: 'standard', assignee: { role: 'deterministic-content-publication-executor' }, task: { mode: release.mode, release_hash: release.release_hash },
    inputs: [{ name: 'content_release', schema: 'content_release.v2', root: 'run', path: releasePath, byte_hash: sha256Bytes(readFileSync(releasePath)), content_hash: release.release_hash }],
    outputs: [{ name: 'publish_receipt', schema: 'content_publish_receipt.v2', root: 'run', path: receiptPath }],
    execution_receipt: { root: 'run', path: 'legacy-publication-apply.work-order-execution-receipt.v1.json', schema: 'work_order_execution_receipt.v1' } }
  return { ...order, work_order_id: exactWorkOrderId(order) }
}
