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
