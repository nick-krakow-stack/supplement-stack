import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { dirname, extname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { canonicalJsonHash, decodeUtf8Strict, lintArticle, sha256Bytes } from './content-validation.mjs'
import { lintVisiblePayload } from './evidence-pipeline-builder.mjs'
import { artifactHashV2, sourceCitationLabelV2 } from './evidence-pipeline-v2.mjs'
import { assertContained, assertRelativeManifestPath, assertSafeId, portablePath } from './safe-paths.mjs'
import { assembleStage2VisiblePayload, assembleStage3VisiblePayload } from './visible-payload-assembly.mjs'
import { buildStage2InterpretationProjectionV1 } from './content-publication-targets-v2.mjs'
import { buildKnowledgeBadgeExpectationsV1, validateKnowledgeBadgeReadbackV1 } from './knowledge-badge-readback-v1.mjs'
import { indexabilityNeedsReleaseV1, validateArticleOriginIndexabilityV1, validateRawHtmlDeliveryV1, validateOriginIndexabilityStateV1 } from './public-delivery-status-v1.mjs'
import { validatePublicApiReadbackActualV1 } from './public-api-readback-v1.mjs'
import { isKnowledgeControlMarkerLine, knowledgeInlineMarkdownToText, normalizeKnowledgeInlineLink, tokenizeKnowledgeInlineMarkdown } from '../../functions/lib/knowledge-inline-markdown.mjs'

const HASH = /^sha256:[a-f0-9]{64}$/
const MAX_REVISION = 2
const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const FRONTEND_ROOT = resolve(REPO_ROOT, 'frontend')
const RENDERER_CLI = resolve(REPO_ROOT, 'frontend/render-knowledge-magazine-snapshot.mjs')
const STYLE_VALIDATOR_CLI = resolve(REPO_ROOT, 'frontend/validate-knowledge-magazine-style.mjs')
const STYLE_VALIDATOR_VERSION = 'knowledge-magazine-route-browser-contract.v2.2.0'
const ASSUMPTION_CONCLUSIONS = new Set(['supported', 'partly_supported', 'not_supported', 'contradicted', 'context_dependent', 'unclear'])

function fail(message) { throw new Error(message) }
function infrastructureFail(message) { const error = new Error(message); error.pipeline_failure_kind = 'infrastructure'; throw error }
function styleCliFailureDiagnostic(result, receiptPath) {
  if (existsSync(receiptPath)) {
    try {
      const receipt = readJson(receiptPath, 'failed renderer style validation')
      const findings = Array.isArray(receipt.errors) ? receipt.errors.map((entry) => `${entry.code ?? 'STYLE_FAIL'}: ${entry.message ?? 'style contract failed'}`) : []
      if (findings.length) return findings.join('; ')
    } catch {}
  }
  return [result.stdout, result.stderr].map((value) => String(value ?? '').trim()).filter(Boolean).join('\n').slice(0, 4_000)
}
function object(value, label) { if (!value || typeof value !== 'object' || Array.isArray(value)) fail(`${label} must be an object`); return value }
function array(value, label) { if (!Array.isArray(value)) fail(`${label} must be an array`); return value }
function text(value, label) { if (typeof value !== 'string' || !value.trim()) fail(`${label} must be a non-empty string`); return value.trim() }
function iso(value, label) { const result = text(value, label); if (!Number.isFinite(Date.parse(result))) fail(`${label} must be ISO-8601`); return result }
function hash(value, label) { const result = text(value, label); if (!HASH.test(result)) fail(`${label} must be sha256:<64 lowercase hex>`); return result }
function sameSet(left, right) { const a = new Set(left), b = new Set(right); return a.size === left.length && b.size === right.length && a.size === b.size && [...a].every((entry) => b.has(entry)) }
function writeJsonAtomic(path, value) {
  mkdirSync(dirname(path), { recursive: true })
  const temp = `${path}.tmp-${process.pid}`
  writeFileSync(temp, `${JSON.stringify(value, null, 2)}\n`, 'utf8')
  renameSync(temp, path)
}
function readJson(path, label) {
  const bytes = readFileSync(path)
  const decoded = decodeUtf8Strict(bytes, label)
  if (decoded.errors.length) fail(decoded.errors.join('; '))
  try { return JSON.parse(decoded.text) } catch (error) { fail(`${label} is invalid JSON: ${error.message}`) }
}
function readMarkdown(path) {
  if (!existsSync(path)) fail(`article markdown does not exist: ${path}`)
  const bytes = readFileSync(path)
  const decoded = decodeUtf8Strict(bytes, path)
  if (decoded.errors.length) fail(decoded.errors.join('; '))
  return { bytes, markdown: decoded.text.replaceAll('\r\n', '\n'), byteHash: sha256Bytes(bytes) }
}

function visibleSources(factsPackage) {
  return factsPackage.visible_sources.map((source) => {
    const sourceId = text(source.source_id, 'visible source id')
    const label = text(source.label, `visible source ${sourceId}.label`)
    if (label !== sourceCitationLabelV2(source)) fail(`visible source ${sourceId}.label differs from its original-source citation metadata`)
    return { source_id: sourceId, label, url: text(source.source_url, `visible source ${sourceId}.source_url`) }
  })
}

export function stage3PresentationSourcesV2(factsPackage) {
  if (factsPackage.stage !== 'stage3') return visibleSources(factsPackage)
  const hasPresentationField = Object.hasOwn(factsPackage, 'presentation_sources')
  const hasPolicyField = Object.hasOwn(factsPackage, 'source_presentation_policy')
  if (!hasPresentationField && !hasPolicyField) return visibleSources(factsPackage)
  if (factsPackage.source_presentation_policy !== 'internal_stage2_only') fail('Stage-3 source presentation policy must equal internal_stage2_only')
  const presentationSources = array(factsPackage.presentation_sources, 'Stage-3 presentation_sources')
  const expectedSourceIds = new Set(factsPackage.visible_sources.map((source) => source.source_id))
  if (expectedSourceIds.size > 0 && presentationSources.length === 0) fail('Stage-3 presentation_sources cannot be empty when original evidence sources are present')
  const coveredSourceIds = new Set()
  const sources = presentationSources.map((source, index) => {
    const sourceId = assertSafeId(source.source_id, `presentation source ${index}.source_id`)
    const covered = array(source.covered_source_ids, `presentation source ${sourceId}.covered_source_ids`)
      .map((id) => assertSafeId(id, `presentation source ${sourceId} covered source`))
    for (const id of covered) {
      if (!expectedSourceIds.has(id)) fail(`presentation source ${sourceId} covers unknown original source ${id}`)
      coveredSourceIds.add(id)
    }
    const url = text(source.source_url, `presentation source ${sourceId}.source_url`)
    if (!/^\/wissen\/[a-z0-9-]+$/.test(url)) fail(`presentation source ${sourceId} must target an internal knowledge article`)
    return { source_id: sourceId, label: text(source.label, `presentation source ${sourceId}.label`), url }
  })
  if (coveredSourceIds.size !== expectedSourceIds.size || [...expectedSourceIds].some((id) => !coveredSourceIds.has(id))) {
    fail('Stage-3 presentation sources do not cover every original evidence source')
  }
  if (new Set(sources.map((source) => source.source_id)).size !== sources.length) fail('Stage-3 presentation sources must be unique')
  return sources
}

function writerRole(stage) { return stage === 'stage2' ? 'clinical-study-interpreter' : 'german-health-science-writer' }

export function writerWorkOrderIdV2(workOrder) {
  object(workOrder, 'writer work order')
  const canonical = Object.fromEntries(Object.entries(workOrder).filter(([key]) => key !== 'work_order_id'))
  return canonicalJsonHash(canonical)
}

export function writerReceiptPath(context, article) {
  return resolve(context.stateDir, 'writer-results', `${assertSafeId(article.article_id, 'article_id')}.article-result.v2.json`)
}

export function publicationReviewPath(context, article, revision) {
  return resolve(context.stateDir, 'publication-qa', `${assertSafeId(article.article_id, 'article_id')}.round-${revision}.article-publication-review.v2.json`)
}

export function compiledArticlePath(context, article, revision) {
  if (!Number.isInteger(revision) || revision < 0 || revision > MAX_REVISION) fail('compiled article revision is invalid')
  return resolve(context.stateDir, 'compiled', `${assertSafeId(article.article_id, 'article_id')}.round-${revision}.compiled-article.v2.json`)
}

export function validationReceiptPath(context, article, revision) {
  if (!Number.isInteger(revision) || revision < 0 || revision > MAX_REVISION) fail('validation receipt revision is invalid')
  return resolve(context.stateDir, 'validation', `${assertSafeId(article.article_id, 'article_id')}.round-${revision}.validation-receipt.v2.json`)
}

export function validateWriterReceipt({ context, article, factsPackage, articleByteHash, evidenceMembershipHash, issuedWorkOrders }) {
  const path = writerReceiptPath(context, article)
  if (!existsSync(path)) return { status: 'missing', path, revision: 0 }
  const receipt = readJson(path, `${article.article_id} writer receipt`)
  if (receipt.schema !== 'article_result.v2') fail(`${article.article_id} writer receipt schema must equal article_result.v2`)
  if (receipt.content_hash !== artifactHashV2(receipt)) fail(`${article.article_id} writer receipt content_hash is stale`)
  const executionId = assertSafeId(receipt.execution_id, `${article.article_id}.execution_id`)
  if (receipt.article_id !== article.article_id || receipt.stage !== article.stage || receipt.slug !== article.slug) fail(`${article.article_id} writer receipt article binding differs`)
  if (receipt.writer?.role !== writerRole(article.stage)) fail(`${article.article_id} writer role must equal ${writerRole(article.stage)}`)
  const writerId = assertSafeId(receipt.writer.id, `${article.article_id}.writer.id`)
  iso(receipt.written_at, `${article.article_id}.written_at`)
  const revision = Number(receipt.revision)
  if (!Number.isInteger(revision) || revision < 0 || revision > MAX_REVISION) fail(`${article.article_id} writer revision must be between 0 and ${MAX_REVISION}`)
  if (receipt.article_byte_hash !== articleByteHash) fail(`${article.article_id} writer receipt does not bind current article bytes`)
  if (receipt.facts_package_hash !== factsPackage.article_package_hash) fail(`${article.article_id} writer receipt stable article package hash differs`)
  if (receipt.evidence_membership_hash !== evidenceMembershipHash) fail(`${article.article_id} writer receipt evidence membership hash differs`)
  if (receipt.policy_version !== context.policyVersion || receipt.render_profile !== article.render_profile) fail(`${article.article_id} writer receipt policy/render profile differs`)
  if (receipt.markdown_path !== portablePath(context.root, article.markdown_path)) fail(`${article.article_id} writer receipt Markdown target differs`)
  if (canonicalJsonHash(receipt.framework) !== canonicalJsonHash(factsPackage.framework) || receipt.framework_hash !== factsPackage.framework_hash) fail(`${article.article_id} writer receipt framework binding differs`)
  const usedRecordIds = array(receipt.used_record_ids, `${article.article_id}.used_record_ids`).map((id) => assertSafeId(id, 'used record_id'))
  const usedSourceIds = array(receipt.used_source_ids, `${article.article_id}.used_source_ids`).map((id) => assertSafeId(id, 'used source_id'))
  const assetIds = array(receipt.asset_ids ?? [], `${article.article_id}.asset_ids`).map((id) => assertSafeId(id, 'asset_id'))
  if (!sameSet(usedRecordIds, factsPackage.record_ids) || !sameSet(usedSourceIds, factsPackage.visible_sources.map((source) => source.source_id))) fail(`${article.article_id} writer receipt record/source set differs from facts package`)
  const assumptionCoverage = array(receipt.assumption_check_coverage, `${article.article_id}.assumption_check_coverage`).map((entry, index) => {
    object(entry, `${article.article_id}.assumption_check_coverage[${index}]`)
    const assumptionId = assertSafeId(entry.assumption_id, `${article.article_id}.assumption_check_coverage[${index}].assumption_id`)
    const conclusion = text(entry.conclusion, `${article.article_id}.${assumptionId}.conclusion`)
    if (!ASSUMPTION_CONCLUSIONS.has(conclusion)) fail(`${article.article_id}.${assumptionId}.conclusion is invalid`)
    const obligationIds = array(entry.obligation_ids, `${article.article_id}.${assumptionId}.obligation_ids`).map((id) => assertSafeId(id, 'assumption obligation_id'))
    const recordIds = array(entry.record_ids, `${article.article_id}.${assumptionId}.record_ids`).map((id) => assertSafeId(id, 'assumption record_id'))
    if (!sameSet(obligationIds, [...new Set(obligationIds)]) || !sameSet(recordIds, [...new Set(recordIds)])) fail(`${article.article_id}.${assumptionId} obligation/record IDs must be unique`)
    return { assumption_id: assumptionId, conclusion, obligation_ids: obligationIds, record_ids: recordIds }
  })
  if (article.stage === 'stage2' && assumptionCoverage.length) fail(`${article.article_id} Stage-2 writer receipt cannot contain assumption coverage`)
  if (article.stage === 'stage3') {
    const checks = array(factsPackage.common_assumption_review?.checks, `${article.article_id}.common_assumption_review.checks`)
    if (!sameSet(assumptionCoverage.map((entry) => entry.assumption_id), checks.map((check) => check.assumption_id))) fail(`${article.article_id} writer receipt must resolve every planned common assumption exactly once`)
    for (const entry of assumptionCoverage) {
      const check = checks.find((candidate) => candidate.assumption_id === entry.assumption_id)
      if (!sameSet(entry.obligation_ids, check.obligation_ids) || !sameSet(entry.record_ids, check.record_ids)) fail(`${article.article_id}.${entry.assumption_id} writer coverage differs from the lock-bound assumption evidence slice`)
    }
  }
  if (revision === 0 && (receipt.previous_review_id != null || receipt.previous_compiled_payload_hash != null)) fail(`${article.article_id} initial writer receipt cannot bind a previous review`)
  if (revision > 0) {
    assertSafeId(receipt.previous_review_id, `${article.article_id}.previous_review_id`)
    hash(receipt.previous_compiled_payload_hash, `${article.article_id}.previous_compiled_payload_hash`)
  }
  const issued = array(issuedWorkOrders ?? [], `${article.article_id}.issued_work_orders`).find((entry) => entry.work_order_id === receipt.work_order_id)
  if (!issued || issued.task?.article_id !== article.article_id || issued.task?.revision !== revision || !['writer', 'writer_revision', 'writer_repair'].includes(issued.kind) || issued.work_order_id !== writerWorkOrderIdV2(issued)) fail(`${article.article_id} writer receipt work_order_id differs from the exact issued contract`)
  return { status: 'pass', path, receipt, revision, executionId, writerId, assetIds, receiptHash: receipt.content_hash, byteHash: sha256Bytes(readFileSync(path)) }
}

function markdownImages(markdown) {
  const descriptors = []
  const captionAfter = (end, target) => {
    const tail = markdown.slice(end)
    const next = tail.split('\n').map((line) => line.trim()).find(Boolean)
    const captionMatch = next?.match(/^(?:\*([^*\n]+)\*|_([^_\n]+)_)$/)
    if (!captionMatch) fail(`image ${target} needs an immediately following italic caption`)
    return (captionMatch[1] ?? captionMatch[2]).trim()
  }
  for (const match of markdown.matchAll(/!\[([^\]\n]*)\]\(([^)\n]+)\)/g)) {
    const alt = text(match[1], 'image alt text')
    const target = text(match[2].replace(/^<|>$/g, ''), 'image target')
    const end = (match.index ?? 0) + match[0].length
    descriptors.push({ alt, target, caption: captionAfter(end, target), index: match.index ?? 0 })
  }
  const definitions = new Map([...markdown.matchAll(/^\[([^\]\n]+)\]:[ \t]+(?:<([^>\n]+)>|(\S+))/gm)].map((match) => [match[1].trim().toLowerCase(), match[2] ?? match[3]]))
  for (const match of markdown.matchAll(/!\[([^\]\n]*)\]\[([^\]\n]*)\]/g)) {
    const alt = text(match[1], 'image alt text')
    const reference = (match[2].trim() || alt).toLowerCase()
    const target = definitions.get(reference)
    if (!target) fail(`image reference ${reference} is undefined`)
    const end = (match.index ?? 0) + match[0].length
    descriptors.push({ alt, target, caption: captionAfter(end, target), index: match.index ?? 0 })
  }
  if (/<img\b/i.test(markdown)) fail('runtime v2 accepts Markdown images only; HTML images need an explicit legacy adapter')
  return descriptors
}

function resolveAssetPath({ context, localAssetPath }) {
  const relativeTarget = assertRelativeManifestPath(localAssetPath, `local asset ${localAssetPath}`)
  const path = resolve(context.root, relativeTarget)
  assertContained(context.root, path, `local asset ${localAssetPath}`)
  if (!existsSync(path)) fail(`local asset does not exist: ${localAssetPath}`)
  return path
}

function rasterMetadata(bytes, path) {
  const buffer = Buffer.from(bytes)
  if (buffer.length >= 24 && buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) {
    return { mime_type: 'image/png', width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) }
  }
  if (buffer.length >= 12 && buffer[0] === 0xff && buffer[1] === 0xd8) {
    let offset = 2
    while (offset + 9 < buffer.length) {
      if (buffer[offset] !== 0xff) { offset += 1; continue }
      const marker = buffer[offset + 1]
      if ([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf].includes(marker)) {
        return { mime_type: 'image/jpeg', width: buffer.readUInt16BE(offset + 7), height: buffer.readUInt16BE(offset + 5) }
      }
      const length = buffer.readUInt16BE(offset + 2)
      if (!Number.isInteger(length) || length < 2) break
      offset += 2 + length
    }
  }
  fail(`asset ${path} must be a supported raster image (PNG or JPEG)`)
}

function validateAssetReceipt({ context, article, factsPackage, writer, descriptor, index }) {
  const receiptPath = resolve(context.stateDir, 'assets', article.article_id, `${index}.article-asset.v2.json`)
  if (!existsSync(receiptPath)) return { status: 'missing', receiptPath, assetPath: null, descriptor, index }
  const receipt = readJson(receiptPath, `${article.article_id} asset receipt ${index}`)
  if (receipt.schema !== 'article_asset.v2' || receipt.content_hash !== artifactHashV2(receipt)) fail(`${article.article_id} asset receipt ${index} schema/hash is invalid`)
  const receiptFields = ['schema', 'asset_id', 'article_id', 'asset_index', 'asset_path', 'asset_byte_hash', 'mime_type', 'width', 'height', 'alt', 'caption', 'position', 'record_ids', 'creator', 'work_order_id', 'created_at', 'content_hash']
  if (!sameSet(Object.keys(receipt), receiptFields)) fail(`${article.article_id} asset receipt ${index} fields differ from article_asset.v2`)
  if (receipt.article_id !== article.article_id || Number(receipt.asset_index) !== index) fail(`${article.article_id} asset receipt ${index} article/index differs`)
  assertSafeId(receipt.asset_id, `${article.article_id} asset_id`)
  const assetPath = resolveAssetPath({ context, localAssetPath: text(receipt.asset_path, `${article.article_id} asset receipt ${index}.asset_path`) })
  if (receipt.asset_path !== portablePath(context.root, assetPath)) fail(`${article.article_id} asset receipt ${index} local path differs`)
  const bytes = readFileSync(assetPath)
  if (receipt.asset_byte_hash !== sha256Bytes(bytes)) fail(`${article.article_id} asset receipt ${index} byte hash differs`)
  const dimensions = rasterMetadata(bytes, assetPath)
  if (receipt.mime_type !== dimensions.mime_type || receipt.width !== dimensions.width || receipt.height !== dimensions.height || receipt.width < 1 || receipt.height < 1) fail(`${article.article_id} asset receipt ${index} MIME/dimensions differ`)
  const extension = dimensions.mime_type === 'image/png' ? 'png' : 'jpg'
  const expectedR2Key = `knowledge/${article.slug}/${receipt.asset_byte_hash.slice('sha256:'.length)}.${extension}`
  const expectedPublicUrl = `/api/r2/${expectedR2Key}`
  if (descriptor.target !== expectedPublicUrl) fail(`${article.article_id} asset receipt ${index} does not bind its content-addressed final R2 URL`)
  if (receipt.alt !== descriptor.alt || receipt.caption !== descriptor.caption) fail(`${article.article_id} asset receipt ${index} alt/caption differs from visible Markdown`)
  if (receipt.position?.index !== index || receipt.position?.markdown_offset !== descriptor.index) fail(`${article.article_id} asset receipt ${index} position differs from visible Markdown`)
  const recordIds = array(receipt.record_ids, `${article.article_id} asset receipt ${index}.record_ids`).map((id) => assertSafeId(id, 'asset record_id'))
  if (!recordIds.length || new Set(recordIds).size !== recordIds.length || recordIds.some((id) => !factsPackage.record_ids.includes(id))) fail(`${article.article_id} asset receipt ${index} record_ids are invalid`)
  if (receipt.creator?.role !== 'article-graphic-generator') fail(`${article.article_id} asset receipt ${index} creator role is invalid`)
  const creatorId = assertSafeId(receipt.creator.id, `${article.article_id} asset creator id`)
  if (receipt.creator.writer_execution_id !== writer.executionId || receipt.work_order_id !== writer.receipt.work_order_id) fail(`${article.article_id} asset receipt ${index} is not bound to the executing Writer WorkOrder`)
  iso(receipt.created_at, `${article.article_id} asset created_at`)
  return {
    status: 'pass', receiptPath, receiptHash: receipt.content_hash, receiptByteHash: sha256Bytes(readFileSync(receiptPath)), assetPath,
    asset: { asset_id: receipt.asset_id, asset_index: index, position: receipt.position, path: receipt.asset_path, asset_path: receipt.asset_path, local_asset_path: receipt.asset_path, public_url: expectedPublicUrl, r2_key: expectedR2Key, byte_hash: receipt.asset_byte_hash, mime_type: receipt.mime_type, width: receipt.width, height: receipt.height, alt: receipt.alt, caption: receipt.caption, record_ids: recordIds, creator_id: creatorId, writer_execution_id: writer.executionId, work_order_id: receipt.work_order_id, receipt_path: portablePath(context.root, receiptPath), receipt_hash: receipt.content_hash, receipt_byte_hash: sha256Bytes(readFileSync(receiptPath)) },
  }
}

function validateAssets({ context, article, factsPackage, writer, markdown }) {
  const descriptors = markdownImages(markdown)
  if (article.stage === 'stage3') {
    const decision = factsPackage.graphic_decision
    if (decision.mode === 'none' && descriptors.length) fail(`${article.article_id} has images although graphic_decision.mode is none`)
    if (decision.mode === 'generate' && descriptors.length !== 1) fail(`${article.article_id} needs exactly one generated and integrated graphic`)
    if (decision.mode === 'generate' && !new RegExp(`^/api/r2/knowledge/${article.slug}/[a-f0-9]{64}\\.(?:png|jpg)$`).test(descriptors[0].target)) fail(`${article.article_id} generated graphic must use its content-addressed /api/r2/knowledge/${article.slug}/<sha256>.(png|jpg) URL`)
  }
  const results = descriptors.map((descriptor, index) => validateAssetReceipt({ context, article, factsPackage, writer, descriptor, index }))
  const missing = results.filter((entry) => entry.status === 'missing')
  if (missing.length) return { status: 'missing', missing, assets: [] }
  const assets = results.map((entry) => entry.asset)
  if (article.stage === 'stage3' && factsPackage.graphic_decision.mode === 'generate') {
    const bound = [...new Set(assets.flatMap((entry) => entry.record_ids))]
    if (!sameSet(bound, factsPackage.graphic_decision.record_ids)) fail(`${article.article_id} asset record bindings differ from graphic_decision`)
  }
  return { status: 'pass', assets, receipts: results }
}

function markdownAst(markdown) {
  const lines = markdown.split('\n')
  const nodes = []
  let paragraph = []
  const flush = () => { if (paragraph.length) { nodes.push({ type: 'paragraph', text: paragraph.join('\n') }); paragraph = [] } }
  for (const line of lines) {
    if (!line.trim()) { flush(); continue }
    const heading = line.match(/^(#{1,6})\s+(.+)$/)
    if (heading) { flush(); nodes.push({ type: 'heading', level: heading[1].length, text: heading[2].trim() }); continue }
    const bullet = line.match(/^([-*+])\s+(.+)$/)
    if (bullet) { flush(); nodes.push({ type: 'list_item', marker: bullet[1], text: bullet[2].trim() }); continue }
    if (/^\|.*\|\s*$/.test(line)) { flush(); nodes.push({ type: 'table_row', cells: line.slice(1, line.lastIndexOf('|')).split('|').map((cell) => cell.trim()) }); continue }
    if (isKnowledgeControlMarkerLine(line)) { flush(); nodes.push({ type: 'marker', value: line.trim() }); continue }
    paragraph.push(line)
  }
  flush()
  return nodes
}

function linkInventory(markdown) {
  const links = []
  const markdownWithoutImagesOrComments = String(markdown)
    .split('\n')
    .filter((line) => !isKnowledgeControlMarkerLine(line))
    .join('\n')
    .replace(/!\[[^\]\n]*\]\([^\n)]*\)/g, '')
  const tokenText = (tokens) => tokens.map((token) => token.type === 'text' ? token.value : tokenText(token.children)).join('')
  const collect = (tokens) => {
    for (const token of tokens) {
      if (token.type === 'link') {
        const normalizedLink = normalizeKnowledgeInlineLink(token.href)
        if (normalizedLink) links.push({ label: normalizeProjectionText(tokenText(token.children)), url: normalizedLink.href })
      }
      else if (Array.isArray(token.children)) collect(token.children)
    }
  }
  for (const line of markdownWithoutImagesOrComments.split('\n')) collect(tokenizeKnowledgeInlineMarkdown(line))
  return links
}

function normalizeProjectionText(value) {
  return String(value).normalize('NFC').replace(/\u00a0/g, ' ').replace(/[\s\p{Z}]+/gu, ' ').trim()
}

function projectionUrl(value) {
  const raw = String(value).trim()
  const normalizedLink = normalizeKnowledgeInlineLink(raw)
  if (!normalizedLink) fail(`invalid projection URL ${raw}`)
  return normalizedLink.href
}

function projectionInlineText(value) {
  return normalizeProjectionText(knowledgeInlineMarkdownToText(String(value)))
}

function projectInlineLinksV2(markdown) {
  return linkInventory(markdown).map((link) => ({ label: normalizeProjectionText(link.label), url: projectionUrl(link.url) }))
}

function projectVisibleAssetV2(asset) {
  return { src: asset.public_url, alt: projectionInlineText(asset.alt), caption: projectionInlineText(asset.caption) }
}

function projectionSectionId(value, used) {
  const base = String(value).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/ß/g, 'ss').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'abschnitt'
  let candidate = base
  let suffix = 2
  while (used.has(candidate)) candidate = `${base}-${suffix++}`
  used.add(candidate)
  return candidate
}

function projectionTableRow(line) {
  const trimmed = line.trim()
  if (!trimmed.includes('|')) return null
  const cells = trimmed.replace(/^\|/, '').replace(/\|$/, '').split('|').map(projectionInlineText)
  return cells.length > 1 ? cells : null
}

function projectionTablePresentation(headers) {
  const [groupHeader = '', exampleHeader = ''] = headers.map((header) => header.trim().toLowerCase())
  return headers.length >= 3
    && /(lebensmittel|nahrungs|quellen?)(gruppe|kategorie)?/.test(groupHeader)
    && /(beispiel|lebensmittel|vorkommen)/.test(exampleHeader)
    ? 'food_grid'
    : 'data_table'
}

function projectionTables(raw) {
  const lines = raw.split('\n')
  const tables = []
  for (let index = 0; index + 1 < lines.length; index += 1) {
    const headers = projectionTableRow(lines[index])
    const separator = projectionTableRow(lines[index + 1])
    if (!headers || !separator?.every((cell) => /^:?-{3,}:?$/.test(cell))) continue
    const rows = []
    index += 2
    while (index < lines.length) {
      const cells = projectionTableRow(lines[index])
      if (!cells) { index -= 1; break }
      rows.push(cells); index += 1
    }
    tables.push({ presentation: projectionTablePresentation(headers), headers, rows })
  }
  return tables
}

function projectionSectionText(raw) {
  const lines = raw.split('\n')
  const hiddenFoodGridHeaderRows = new Set()
  for (let index = 0; index + 1 < lines.length; index += 1) {
    const headers = projectionTableRow(lines[index])
    const separator = projectionTableRow(lines[index + 1])
    if (headers && separator?.every((cell) => /^:?-{3,}:?$/.test(cell)) && projectionTablePresentation(headers) === 'food_grid') {
      hiddenFoodGridHeaderRows.add(index)
    }
  }
  const visible = []
  for (let index = 0; index < lines.length; index += 1) {
    if (hiddenFoodGridHeaderRows.has(index)) continue
    const line = lines[index].trim()
    if (!line || isKnowledgeControlMarkerLine(line) || /^\|?(?:\s*:?-{3,}:?\s*\|)+\s*$/.test(line)) continue
    const image = line.match(/^!\[([^\]]*)]\(([^)]*)\)$/)
    if (image) continue
    let textValue = line.replace(/^#{1,3}\s+/, '').replace(/^[-*+]\s+/, '').replace(/^\d+\.\s+/, '')
    if (/^\|.*\|$/.test(textValue)) textValue = textValue.slice(1, -1).replaceAll('|', ' ')
    const caption = textValue.match(/^(?:\*([^*]+)\*|_([^_]+)_)$/)
    if (caption) textValue = caption[1] ?? caption[2]
    const normalized = projectionInlineText(textValue)
    if (normalized) visible.push(normalized)
  }
  return normalizeProjectionText(visible.join(' '))
}

function expectedStage3Projection({ article, markdown, publishPayload, assets }) {
  const route = `/wissen/${article.slug}`
  const markerIndex = markdown.indexOf('<!-- knowledge-template:magazine -->')
  const body = markerIndex >= 0 ? markdown.slice(markerIndex + '<!-- knowledge-template:magazine -->'.length) : markdown
  const headings = [...body.matchAll(/^##\s+(.+?)\s*$/gm)]
  const usedIds = new Set(['ueberblick', 'quellen'])
  const sections = []
  let numbered = 0
  for (const [index, heading] of headings.entries()) {
    const title = projectionInlineText(heading[1].trim())
    const start = (heading.index ?? 0) + heading[0].length
    const end = headings[index + 1]?.index ?? body.length
    const raw = body.slice(start, end).trim()
    if (/^quellen?$/i.test(title)) continue
    const isOverview = /^auf einen blick$/i.test(title)
    const controlMatch = title.match(/^(merkkasten|rechtlicher hinweis)$/i)
    const isControl = Boolean(controlMatch)
    const isFazit = /^fazit(?:\b|$)/i.test(title)
    const sectionId = isOverview ? 'ueberblick' : isFazit ? (usedIds.add('fazit'), 'fazit') : projectionSectionId(title, usedIds)
    if (!isOverview && !isControl) numbered += 1
    const sectionStart = markerIndex + '<!-- knowledge-template:magazine -->'.length + start
    const sectionEnd = markerIndex + '<!-- knowledge-template:magazine -->'.length + end
    const sectionAssets = assets.filter((asset) => asset.position.markdown_offset >= sectionStart && asset.position.markdown_offset < sectionEnd).map(projectVisibleAssetV2)
    sections.push({
      section_id: sectionId,
      kind: isOverview ? 'overview' : isControl ? 'control' : isFazit ? 'fazit' : 'content',
      control_type: controlMatch?.[1].toLowerCase() === 'merkkasten' ? 'merkkasten' : isControl ? 'legal_notice' : null,
      heading: title, number: isOverview || isControl ? null : String(numbered).padStart(2, '0'), order: sections.length,
      normalized_text: projectionSectionText(raw),
      links: projectInlineLinksV2(raw),
      tables: projectionTables(raw), assets: sectionAssets,
    })
  }
  const sourceSection = {
    section_id: 'quellen', kind: 'sources', control_type: null, heading: 'Quellen', number: null, order: sections.length,
    normalized_text: normalizeProjectionText(publishPayload.sources.map((source) => source.label).join(' ')),
    links: publishPayload.sources.map((source) => ({ label: normalizeProjectionText(source.label), url: projectionUrl(source.url) })), tables: [], assets: [],
  }
  sections.push(sourceSection)
  const toc = sections.filter((section) => section.kind !== 'control').map((section) => ({ section_id: section.section_id, label: section.heading, href: `#${section.section_id}` }))
  const fazit = sections.find((section) => section.section_id === 'fazit')
  if (!fazit) fail(`${article.article_id} projection has no Fazit section`)
  return {
    schema: 'article_render_projection.v2', article_id: article.article_id, route, template: 'magazine', h1: projectionInlineText(publishPayload.title), dek: projectionInlineText(publishPayload.dek),
    ui: {
      contract_version: 'knowledge-magazine-ui.v2', eyebrow: 'Wissen', toc_title: 'Auf dieser Seite', ingredient_chip: 'Wirkstoff: Wissensartikel', reviewed_date: null,
      reading_time: (() => {
        const readableBody = publishPayload.body.split(/\r?\n/).filter((line) => line.trim().toLowerCase() !== '<!-- knowledge-template:magazine -->').join('\n')
        const minutes = Math.max(1, Math.ceil(`${readableBody} ${publishPayload.conclusion ?? ''}`.trim().split(/\s+/).filter(Boolean).length / 200))
        return { minutes, label: `Lesezeit ca. ${minutes} ${minutes === 1 ? 'Minute' : 'Minuten'}` }
      })(),
      sources_label: 'Quellen', sources_count: { count: publishPayload.sources.length, label: `${publishPayload.sources.length} ${publishPayload.sources.length === 1 ? 'Quelle' : 'Quellen'}` },
    },
    sections, toc, fazit: { section_id: fazit.section_id, normalized_text: fazit.normalized_text },
    sources: publishPayload.sources.map((source, order) => ({ source_id: source.source_id, label: normalizeProjectionText(source.label), url: projectionUrl(source.url), order })),
  }
}

function expectedStage2Projection({ article, markdown, publishPayload, assets }) {
  const headings = [...markdown.matchAll(/^##\s+(.+?)\s*$/gm)]
  const sections = []
  for (const [index, heading] of headings.entries()) {
    const title = projectionInlineText(heading[1].trim())
    const start = (heading.index ?? 0) + heading[0].length
    const end = headings[index + 1]?.index ?? markdown.length
    if (/^quellen?$/i.test(title)) continue
    const raw = markdown.slice(start, end).trim()
    const sectionId = /^fazit$/i.test(title) ? 'fazit' : projectionSectionId(title, new Set(sections.map((section) => section.section_id)))
    const sectionAssets = assets.filter((asset) => asset.position.markdown_offset >= start && asset.position.markdown_offset < end).map(projectVisibleAssetV2)
    sections.push({
      section_id: sectionId, kind: /^fazit$/i.test(title) ? 'fazit' : 'content', control_type: null, heading: title, number: null, order: sections.length,
      normalized_text: projectionSectionText(raw), links: projectInlineLinksV2(raw),
      tables: projectionTables(raw), assets: sectionAssets,
    })
  }
  const sourceSection = {
    section_id: 'quellen', kind: 'sources', control_type: null, heading: 'Quellen', number: null, order: sections.length,
    normalized_text: normalizeProjectionText(publishPayload.sources.map((source) => source.label).join(' ')),
    links: publishPayload.sources.map((source) => ({ label: normalizeProjectionText(source.label), url: projectionUrl(source.url) })), tables: [], assets: [],
  }
  sections.push(sourceSection)
  const fazit = sections.find((section) => section.section_id === 'fazit')
  if (!fazit) fail(`${article.article_id} Stage-2 projection has no Fazit section`)
  return {
    schema: 'article_render_projection.v2', article_id: article.article_id, route: `/wissen/${article.slug}`, template: 'study_article_v2', h1: projectionInlineText(publishPayload.title), dek: projectionInlineText(publishPayload.dek),
    ui: { contract_version: 'knowledge-study-article-ui.v2', eyebrow: null, toc_title: null, ingredient_chip: null, reviewed_date: null, reading_time: null, sources_label: 'Quellen', sources_count: { count: publishPayload.sources.length, label: `${publishPayload.sources.length} ${publishPayload.sources.length === 1 ? 'Quelle' : 'Quellen'}` } },
    sections, toc: [], fazit: { section_id: fazit.section_id, normalized_text: fazit.normalized_text },
    sources: publishPayload.sources.map((source, order) => ({ source_id: source.source_id, label: normalizeProjectionText(source.label), url: projectionUrl(source.url), order })),
  }
}

function lineDiff(previousLines, currentLines) {
  const rows = previousLines.length + 1
  const cols = currentLines.length + 1
  const table = Array.from({ length: rows }, () => new Uint32Array(cols))
  for (let left = previousLines.length - 1; left >= 0; left -= 1) {
    for (let right = currentLines.length - 1; right >= 0; right -= 1) {
      table[left][right] = previousLines[left] === currentLines[right]
        ? table[left + 1][right + 1] + 1
        : Math.max(table[left + 1][right], table[left][right + 1])
    }
  }
  const changes = []
  let left = 0
  let right = 0
  while (left < previousLines.length || right < currentLines.length) {
    if (left < previousLines.length && right < currentLines.length && previousLines[left] === currentLines[right]) {
      left += 1; right += 1; continue
    }
    if (right < currentLines.length && (left >= previousLines.length || table[left][right + 1] >= table[left + 1][right])) {
      changes.push({ kind: 'insert', old_line: null, new_line: right + 1, old_text: null, new_text: currentLines[right] })
      right += 1
    } else {
      changes.push({ kind: 'delete', old_line: left + 1, new_line: null, old_text: previousLines[left], new_text: null })
      left += 1
    }
  }
  return changes
}

function paragraphRanges(lines) {
  const ranges = []
  let start = null
  for (let index = 0; index <= lines.length; index += 1) {
    if (index < lines.length && lines[index].trim()) {
      if (start === null) start = index
      continue
    }
    if (start !== null) {
      const textValue = lines.slice(start, index).join('\n')
      ranges.push({ start_line: start + 1, end_line: index, text_hash: canonicalJsonHash(textValue) })
      start = null
    }
  }
  return ranges
}

function changedSideEffects(previous, current) {
  const effects = []
  for (const [label, left, right] of [
    ['title', previous.publish_payload.title, current.publishPayload.title],
    ['dek', previous.publish_payload.dek, current.publishPayload.dek],
    ['headings', previous.headings, current.headings],
    ['tables', previous.tables, current.tables],
    ['links', previous.links, current.links],
    ['conclusion', previous.publish_payload.conclusion, current.publishPayload.conclusion],
    ['sources', previous.expanded_sources, current.relations],
    ['assets', previous.assets, current.assets],
  ]) if (canonicalJsonHash(left) !== canonicalJsonHash(right)) effects.push(label)
  return effects
}

function deriveRevisionDiff({ article, writer, markdown, articleByteHash, previousCompiled, visible, relations, assets, factsPackage }) {
  if (writer.revision === 0) return null
  const previousLines = array(previousCompiled.authoring_lines, `${article.article_id} previous authoring_lines`)
  const currentLines = markdown.split('\n')
  const changes = lineDiff(previousLines, currentLines)
  if (!changes.length) fail(`${article.article_id} revision ${writer.revision} does not change visible authoring bytes`)
  const changedCurrentLines = new Set(changes.filter((entry) => entry.new_line !== null).map((entry) => entry.new_line))
  const paragraphs = paragraphRanges(currentLines)
  const neighbours = paragraphs.filter((entry, index) =>
    [...changedCurrentLines].some((line) => line >= entry.start_line && line <= entry.end_line)
    || paragraphs[index - 1] && [...changedCurrentLines].some((line) => line >= paragraphs[index - 1].start_line && line <= paragraphs[index - 1].end_line)
    || paragraphs[index + 1] && [...changedCurrentLines].some((line) => line >= paragraphs[index + 1].start_line && line <= paragraphs[index + 1].end_line))
  const changedText = changes.map((entry) => `${entry.old_text ?? ''}\n${entry.new_text ?? ''}`).join('\n').toLowerCase()
  const touchedClaims = factsPackage.facts.filter((fact) => {
    const tokens = [fact.claim, fact.subject_key, fact.predicate_key, fact.value, fact.unit].filter((value) => value !== null && value !== undefined).map((value) => String(value).toLowerCase())
    return tokens.some((token) => token.length > 2 && changedText.includes(token))
  }).map((fact) => fact.record_id).sort()
  const touchedSources = factsPackage.visible_sources.filter((source) =>
    changedText.includes(source.label.toLowerCase()) || changedText.includes(source.source_url.toLowerCase())).map((source) => source.source_id).sort()
  const previousAssets = new Map(previousCompiled.assets.map((asset) => [asset.asset_id, asset.byte_hash]))
  const currentAssets = new Map(assets.map((asset) => [asset.asset_id, asset.byte_hash]))
  const touchedAssets = [...new Set([...previousAssets.keys(), ...currentAssets.keys()])].filter((id) => previousAssets.get(id) !== currentAssets.get(id)).sort()
  const diffBase = {
    schema: 'article_revision_diff.v2', article_id: article.article_id, from_revision: writer.revision - 1, to_revision: writer.revision,
    previous_article_byte_hash: previousCompiled.article_byte_hash, article_byte_hash: articleByteHash,
    previous_compiled_payload_hash: previousCompiled.compiled_payload_hash, changed_lines: changes,
    neighbour_paragraphs: neighbours, touched_claims: touchedClaims, touched_sources: touchedSources,
    touched_assets: touchedAssets, visible_side_effects: changedSideEffects(previousCompiled, { publishPayload: visible.publishPayload, headings: markdownAst(markdown).filter((node) => node.type === 'heading').map((node) => ({ level: node.level, text: node.text })), tables: markdownAst(markdown).filter((node) => node.type === 'table_row').map((node) => node.cells), links: linkInventory(markdown), relations, assets }),
  }
  const diff = { ...diffBase, diff_hash: canonicalJsonHash(diffBase) }
  return {
    diff,
    recheck_scope: {
      diff_hash: diff.diff_hash,
      changed_lines: changes.map((entry) => entry.new_line ?? entry.old_line),
      neighbour_paragraphs: neighbours,
      touched_claims: touchedClaims,
      touched_sources: touchedSources,
      touched_assets: diffBase.touched_assets,
      visible_side_effects: diffBase.visible_side_effects,
    },
  }
}

function normalizeUnit(value) {
  const unit = String(value).trim().toLowerCase()
  if (unit === 'ug' || unit === 'mcg' || unit === 'μg') return 'µg'
  return unit
}

function normalizeNumber(value) {
  const compact = String(value).replace(/[\s\u00a0\u202f]/gu, '')
  if (/^[+-]?\d{1,3}(?:\.\d{3})+(?:,\d+)?$/u.test(compact)) return Number(compact.replaceAll('.', '').replace(',', '.'))
  return Number(compact.replace(',', '.'))
}

function quantityTokens(value) {
  return [...String(value ?? '').matchAll(/(?<![\p{L}\p{N}_])(\d+(?:(?:\.\d{3})+(?:,\d+)?|(?:[ \u00a0\u202f]\d{3})+(?:,\d+)?|[.,]\d+)?)\s*(µg|μg|ug|mcg|mg|kg|g|ml|l|IE|IU|%|mmol|mol|KBE|CFU)(?![\p{L}\p{N}_])/giu)]
    .map((match) => ({ token: match[0], key: `${normalizeNumber(match[1])}|${normalizeUnit(match[2])}`, value: normalizeNumber(match[1]), unit: normalizeUnit(match[2]) }))
}

function structuredFactQuantityKey(fact) {
  if (!Number.isFinite(fact.value) || typeof fact.unit !== 'string') return null
  const baseUnit = fact.unit.trim().match(/^(µg|μg|ug|mcg|mg|kg|g|ml|l|IE|IU|%|mmol|mol|KBE|CFU)(?![\p{L}\p{N}_])/iu)?.[1]
  return baseUnit ? `${Number(fact.value)}|${normalizeUnit(baseUnit)}` : null
}

function normalizeVisibleSeoTextV2(value) {
  return knowledgeInlineMarkdownToText(String(value ?? ''))
    .normalize('NFC')
    .replace(/\s+/g, ' ')
    .trim()
}

function technicalMetaTitleV2(value, contextPrefix = null) {
  const visibleTitle = normalizeVisibleSeoTextV2(value)
  const prefix = normalizeVisibleSeoTextV2(contextPrefix)
  const normalized = prefix
    ? (seoComparisonKeyV2(prefix) === seoComparisonKeyV2(visibleTitle) ? `${visibleTitle}: Originalquelle` : `${prefix}: ${visibleTitle}`)
    : visibleTitle
  if (normalized.length <= 70) return normalized
  const maximumStemLength = 69
  const candidate = normalized.slice(0, maximumStemLength + 1)
  const boundary = candidate.lastIndexOf(' ')
  const stem = (boundary >= 14 ? candidate.slice(0, boundary) : normalized.slice(0, maximumStemLength)).trimEnd()
  return `${stem}…`.normalize('NFC')
}

function seoComparisonKeyV2(value) {
  return normalizeVisibleSeoTextV2(value).normalize('NFKC').toLocaleLowerCase('de-DE')
}

function findDuplicateLiveSeoTitleV2(routes, slug, metaTitle) {
  const key = seoComparisonKeyV2(metaTitle)
  return routes.find((route) => route.slug !== slug && seoComparisonKeyV2(route.meta_title ?? route.title) === key) ?? null
}

function buildTechnicalSeo({ context, article, factsPackage, publishPayload }) {
  let metaTitle = technicalMetaTitleV2(publishPayload.title)
  const metaDescription = normalizeVisibleSeoTextV2(publishPayload.dek)
  const substancePath = `/wissen/${factsPackage.substance?.slug ?? ''}`
  const substanceTitle = article.stage === 'stage2'
    ? (factsPackage.selected_link_slice?.links?.find((link) => link.path === substancePath)?.title ?? null)
    : null
  if (metaTitle.length < 15 && article.stage === 'stage2') {
    metaTitle = technicalMetaTitleV2(publishPayload.title, substanceTitle ?? publishPayload.title)
  }
  if (metaTitle.length < 15 || metaTitle.length > 70) fail(`${article.article_id} SEO title length must be 15..70 characters`)
  if (metaDescription.length < 40 || metaDescription.length > 180) fail(`${article.article_id} SEO description length must be 40..180 characters`)
  if (metaTitle.toLocaleLowerCase('de-DE') === metaDescription.toLocaleLowerCase('de-DE')) fail(`${article.article_id} SEO title and description must be distinct`)
  let duplicateLiveTitle = findDuplicateLiveSeoTitleV2(context.linkInventory?.routes ?? [], article.slug, metaTitle)
  if (duplicateLiveTitle && article.stage === 'stage2') {
    if (substanceTitle) {
      metaTitle = technicalMetaTitleV2(publishPayload.title, substanceTitle)
      duplicateLiveTitle = findDuplicateLiveSeoTitleV2(context.linkInventory?.routes ?? [], article.slug, metaTitle)
    }
  }
  if (duplicateLiveTitle) fail(`${article.article_id} SEO title duplicates live route ${duplicateLiveTitle.path}`)
  const duplicateLiveDescription = (context.linkInventory?.routes ?? []).find((route) => route.slug !== article.slug && route.meta_description && seoComparisonKeyV2(route.meta_description) === seoComparisonKeyV2(metaDescription))
  if (duplicateLiveDescription) fail(`${article.article_id} SEO description duplicates live route ${duplicateLiveDescription.path}`)
  const canonicalPath = `/wissen/${article.slug}`
  const publicBaseUrl = context.publish?.publicBaseUrl ?? 'https://supplementstack.de'
  const canonicalUrl = new URL(canonicalPath, publicBaseUrl).href
  const jsonLd = {
    '@context': 'https://schema.org', '@type': 'Article', headline: metaTitle, description: metaDescription,
    mainEntityOfPage: canonicalUrl, inLanguage: factsPackage.language,
  }
  const publicSeo = {
    meta_title: metaTitle, meta_description: metaDescription, canonical_url: canonicalUrl, canonical_path: canonicalPath,
    robots: 'index,follow', indexable: true, json_ld: jsonLd,
  }
  return {
    ...publicSeo,
    primary_intent: factsPackage.seo_brief.primary_intent, internal_link_targets: factsPackage.seo_brief.internal_link_targets,
    validated_checks: ['canonical', 'description_length', 'indexability', 'json_ld_article', 'live_description_uniqueness', 'live_title_uniqueness', 'robots', 'title_description_distinct', 'title_length', 'utf8'],
    seo_hash: canonicalJsonHash(publicSeo),
  }
}

function validateNumberUnitTokens(article, factsPackage, markdown) {
  const visible = markdown.replace(/<!--[^]*?-->/g, '').replace(/```[^]*?```/g, '')
  const tokens = quantityTokens(visible)
  const allowed = new Set(factsPackage.facts.flatMap((fact) => [
    structuredFactQuantityKey(fact),
    ...quantityTokens(fact.claim).map((entry) => entry.key),
    ...Object.values(fact.context ?? {}).filter((value) => typeof value === 'string').flatMap((value) => quantityTokens(value).map((entry) => entry.key)),
  ].filter(Boolean)))
  const unmatched = tokens.filter((entry) => !allowed.has(entry.key))
  if (unmatched.length) fail(`${article.article_id} contains quantity/unit tokens not present in its original-source facts: ${unmatched.map((entry) => entry.token).join(', ')}`)
  return tokens.map(({ token, value, unit }) => ({ token, value, unit }))
}

function compileVisiblePayload({ context, article, factsPackage, markdown }) {
  const sources = article.stage === 'stage3' ? stage3PresentationSourcesV2(factsPackage) : visibleSources(factsPackage)
  const assembled = article.stage === 'stage2'
    ? assembleStage2VisiblePayload({ slug: article.slug, markdown, visibleSources: sources })
    : assembleStage3VisiblePayload({ slug: article.slug, markdown, visibleSources: sources })
  const visibleLint = lintVisiblePayload(assembled, {
    sourceUrlPolicy: article.stage === 'stage3' ? 'internal_stage2_only' : 'external_originals',
  })
  if (visibleLint.errors.length) fail(`${article.article_id} visible payload failed: ${visibleLint.errors.join('; ')}`)
  const articleLint = lintArticle({ file: article.markdown_path, type: article.stage, repoRoot: context.root })
  if (articleLint.issues.length) fail(`${article.article_id} content lint failed: ${articleLint.issues.map((entry) => `${entry.code}: ${entry.message}`).join('; ')}`)
  const links = linkInventory(markdown)
  const renderedLinks = [
    ...links,
    ...assembled.sources.map((source) => ({ label: source.label, url: source.url })),
  ]
  const selectedLinkSlice = object(factsPackage.selected_link_slice, `${article.article_id} selected_link_slice`)
  if (!Array.isArray(selectedLinkSlice.links) || selectedLinkSlice.slice_hash !== canonicalJsonHash({ links: selectedLinkSlice.links })) fail(`${article.article_id} selected link slice hash is stale`)
  const canonicalRoutes = new Map((context.linkInventory?.routes ?? []).map((route) => [route.path, route]))
  const plannedArticles = new Map((context.articles?.all ?? []).map((candidate) => [candidate.article_id, candidate]))
  for (const selected of selectedLinkSlice.links) {
    if ((selected.target_state ?? 'live') === 'same_release') {
      const planned = plannedArticles.get(selected.target_article_id)
      if (!planned || planned.slug !== selected.target_id || selected.path !== `/wissen/${planned.slug}` || planned.article_id === article.article_id) fail(`${article.article_id} same-release internal link ${selected.path} differs from its planned target`)
    } else {
      const current = canonicalRoutes.get(selected.path)
      if (!current || current.slug !== selected.target_id || current.title !== selected.title) fail(`${article.article_id} selected internal link ${selected.path} differs from the current authoritative inventory`)
    }
  }
  const unexpectedInternal = renderedLinks.filter((entry) => entry.url.startsWith('/wissen/') && !selectedLinkSlice.links.some((selected) => selected.path === entry.url))
  if (unexpectedInternal.length) fail(`${article.article_id} uses internal knowledge links outside its selected link slice: ${unexpectedInternal.map((entry) => entry.url).join(', ')}`)
  for (const target of factsPackage.seo_brief.internal_link_targets) {
    if (!renderedLinks.some((entry) => entry.url === target)) fail(`${article.article_id} does not visibly use required internal link target ${target}`)
  }
  const publishPayload = {
    schema: 'article_visible_payload.v2', slug: assembled.slug, title: assembled.title,
    dek: assembled.summary, body: assembled.body, conclusion: article.stage === 'stage3' ? null : assembled.conclusion,
    sources: assembled.sources,
  }
  return { assembled, publishPayload, warnings: articleLint.warnings }
}

function renderRequestPath(context, article, revision) {
  return resolve(context.stateDir, 'render', `${article.article_id}.round-${revision}.article-render-request.v2.json`)
}

function renderSnapshotPath(context, article, revision) {
  return resolve(context.stateDir, 'render', `${article.article_id}.round-${revision}.article-render-snapshot.v2.json`)
}

function buildRenderSnapshot({ context, article, writer, articleByteHash, visiblePayloadHash, publishPayload, expectedProjection }) {
  const payloadHash = canonicalJsonHash(publishPayload)
  if (article.stage !== 'stage3') {
    if (!expectedProjection || expectedProjection.template !== 'study_article_v2' || !Array.isArray(expectedProjection.sections) || expectedProjection.sections.length < 3 || !expectedProjection.sections.some((section) => section.kind === 'content') || !expectedProjection.sections.some((section) => section.kind === 'fazit') || !expectedProjection.sections.some((section) => section.kind === 'sources')) fail(`${article.article_id} Stage-2 deterministic projection is incomplete`)
    const routeContract = rendererStyleContract(context)
    const requestBase = {
      schema: 'article_render_request.v2', mode: 'deterministic-study-projection', article_id: article.article_id, route: `/wissen/${article.slug}`,
      article_byte_hash: articleByteHash, visible_payload_hash: visiblePayloadHash, payload_hash: payloadHash, publish_payload: publishPayload,
      expected_projection: expectedProjection, projection_hash: canonicalJsonHash(expectedProjection), route_fingerprint: routeContract.route_fingerprint,
    }
    const request = { ...requestBase, content_hash: artifactHashV2(requestBase) }
    const requestPath = renderRequestPath(context, article, writer.revision)
    const snapshotPath = renderSnapshotPath(context, article, writer.revision)
    writeJsonAtomic(requestPath, request)
    const projectionChecks = [
      { check: 'nonempty_sections', result: 'PASS' },
      { check: 'content_section_present', result: 'PASS' },
      { check: 'fazit_present', result: 'PASS' },
      { check: 'sources_present', result: 'PASS' },
      { check: 'projection_exact', result: 'PASS' },
    ]
    const base = {
      schema: 'article_render_snapshot.v2', article_id: article.article_id, route: `/wissen/${article.slug}`,
      article_byte_hash: articleByteHash, visible_payload_hash: visiblePayloadHash, payload_hash: payloadHash,
      request_hash: request.content_hash, renderer: { component: 'deterministic-study-projection', version: context.rendererVersion, contract_version: 'deterministic-study-projection.v2' },
      route_fingerprint: routeContract.route_fingerprint, template: 'study_article_v2', h1: publishPayload.title, toc: expectedProjection.toc, sections: expectedProjection.sections, disclosures: [],
      projection_hash: requestBase.projection_hash, actual_projection: expectedProjection, projection_checks: projectionChecks, checks: projectionChecks,
      result: 'PASS', errors: [], html_hash: canonicalJsonHash(publishPayload.body), dom_hash: canonicalJsonHash(expectedProjection),
    }
    const snapshot = { ...base, content_hash: artifactHashV2(base) }
    writeJsonAtomic(snapshotPath, snapshot)
    return { request, requestPath, snapshotPath, snapshotByteHash: sha256Bytes(readFileSync(snapshotPath)), snapshot }
  }
  if (!existsSync(RENDERER_CLI)) infrastructureFail(`Stage-3 renderer CLI is missing: ${RENDERER_CLI}`)
  const requestBase = {
    schema: 'article_render_request.v2', article_id: article.article_id, route: `/wissen/${article.slug}`,
    article_byte_hash: articleByteHash, visible_payload_hash: visiblePayloadHash, payload_hash: payloadHash, publish_payload: publishPayload,
    expected_projection: expectedProjection, projection_hash: canonicalJsonHash(expectedProjection),
  }
  const request = { ...requestBase, content_hash: artifactHashV2(requestBase) }
  const requestPath = renderRequestPath(context, article, writer.revision)
  const snapshotPath = renderSnapshotPath(context, article, writer.revision)
  writeJsonAtomic(requestPath, request)
  const rendered = spawnSync(process.execPath, [RENDERER_CLI, '--input', requestPath, '--out', snapshotPath], {
    cwd: REPO_ROOT, shell: false, encoding: 'utf8', windowsHide: true, timeout: 60_000,
  })
  if (rendered.status !== 0) {
    const message = `${article.article_id} React render snapshot failed (${rendered.status ?? 'signal'}): ${(rendered.stderr || rendered.stdout || '').trim()}`
    if (rendered.status === 1) fail(message)
    infrastructureFail(message)
  }
  if (!existsSync(snapshotPath)) infrastructureFail(`${article.article_id} React renderer did not create its snapshot`)
  const snapshot = readJson(snapshotPath, `${article.article_id} render snapshot`)
  if (snapshot.schema !== 'article_render_snapshot.v2' || snapshot.content_hash !== artifactHashV2(snapshot)) fail(`${article.article_id} render snapshot schema/hash is invalid`)
  if (snapshot.result !== 'PASS' || snapshot.article_id !== article.article_id || snapshot.article_byte_hash !== articleByteHash || snapshot.visible_payload_hash !== visiblePayloadHash || snapshot.payload_hash !== payloadHash || snapshot.request_hash !== canonicalJsonHash(requestBase) || snapshot.projection_hash !== requestBase.projection_hash || snapshot.renderer?.version !== context.rendererVersion || snapshot.renderer?.contract_version !== 'knowledge-magazine-dom-contract.v2.2.1') fail(`${article.article_id} render snapshot lineage/result/renderer differs`)
  if (canonicalJsonHash(snapshot.actual_projection) !== requestBase.projection_hash || !Array.isArray(snapshot.projection_checks) || snapshot.projection_checks.some((entry) => entry.result !== 'PASS') || !Array.isArray(snapshot.checks) || snapshot.checks.some((entry) => entry.result !== 'PASS') || (snapshot.errors ?? []).length) fail(`${article.article_id} rendered DOM differs from the independent compiler projection`)
  return { request, requestPath, snapshotPath, snapshotByteHash: sha256Bytes(readFileSync(snapshotPath)), snapshot }
}

function frameworkDependency(factsPackage) {
  const binding = object(factsPackage.framework, 'facts package framework')
  const path = resolve(REPO_ROOT, text(binding.path, 'framework.path'))
  if (!existsSync(path)) fail(`framework file is missing: ${binding.path}`)
  const byteHash = sha256Bytes(readFileSync(path))
  if (binding.byte_hash !== byteHash || factsPackage.framework_hash !== canonicalJsonHash(binding)) fail('facts package framework bytes/hash differ')
  return { kind: 'framework', scope: 'repo', path: portablePath(REPO_ROOT, path), byte_hash: byteHash }
}

function selectedLinkSliceDependency(context, article, factsPackage) {
  const slice = object(factsPackage.selected_link_slice, `${article.article_id} selected_link_slice`)
  if (!Array.isArray(slice.links) || slice.slice_hash !== canonicalJsonHash({ links: slice.links })) fail(`${article.article_id} selected link slice hash is stale`)
  const currentRoutes = new Map((context.linkInventory?.routes ?? []).map((route) => [route.path, route]))
  const plannedArticles = new Map((context.articles?.all ?? []).map((candidate) => [candidate.article_id, candidate]))
  const current = slice.links.map((selected) => {
    if ((selected.target_state ?? 'live') === 'same_release') {
      const planned = plannedArticles.get(selected.target_article_id)
      if (!planned || planned.slug !== selected.target_id || selected.path !== `/wissen/${planned.slug}` || planned.article_id === article.article_id) fail(`${article.article_id} same-release internal link ${selected.path} differs from its planned target`)
      return { path: selected.path, title: selected.title, target_id: selected.target_id, target_state: 'same_release', target_article_id: selected.target_article_id }
    }
    const route = currentRoutes.get(selected.path)
    if (!route || route.slug !== selected.target_id || route.title !== selected.title) fail(`${article.article_id} selected internal link ${selected.path} differs from the current authoritative inventory`)
    return { path: route.path, title: route.title, target_id: route.slug, target_state: 'live', target_article_id: null }
  })
  return { kind: 'selected_link_slice', scope: 'derived', slice_hash: slice.slice_hash, current_target_hash: canonicalJsonHash({ links: current }) }
}

function seoUniquenessDependency(context, article) {
  const normalizedLiveSeo = (context.linkInventory?.routes ?? [])
    .filter((route) => route.slug !== article.slug)
    .map((route) => ({
      path: route.path,
      meta_title: seoComparisonKeyV2(route.meta_title ?? route.title),
      meta_description: route.meta_description ? seoComparisonKeyV2(route.meta_description) : null,
    }))
    .sort((left, right) => left.path.localeCompare(right.path))
  return { kind: 'seo_uniqueness_guard', scope: 'derived', inventory_hash: canonicalJsonHash({ routes: normalizedLiveSeo }) }
}

function assetCacheDependencies({ context, article, writer }) {
  const bindings = []
  for (let index = 0; index < writer.assetIds.length; index += 1) {
    const receiptPath = resolve(context.stateDir, 'assets', article.article_id, `${index}.article-asset.v2.json`)
    if (!existsSync(receiptPath)) return null
    const receipt = readJson(receiptPath, `${article.article_id} cached asset receipt ${index}`)
    if (receipt.schema !== 'article_asset.v2' || receipt.asset_id !== writer.assetIds[index] || receipt.content_hash !== artifactHashV2(receipt)) return null
    const assetPath = resolve(context.root, text(receipt.asset_path, `${article.article_id} cached asset path`))
    if (!existsSync(assetPath)) return null
    bindings.push(
      { kind: 'asset', scope: 'run', path: portablePath(context.root, assetPath), byte_hash: sha256Bytes(readFileSync(assetPath)) },
      { kind: 'asset_receipt', scope: 'run', path: portablePath(context.root, receiptPath), byte_hash: sha256Bytes(readFileSync(receiptPath)) },
    )
  }
  return bindings
}

function rendererStyleContract(context) {
  if (context.rendererStyleContract) return context.rendererStyleContract
  if (!existsSync(STYLE_VALIDATOR_CLI)) infrastructureFail(`real-browser renderer style validator CLI is missing: ${STYLE_VALIDATOR_CLI}`)
  const printed = spawnSync(process.execPath, [STYLE_VALIDATOR_CLI, '--print-contract-hash'], {
    cwd: FRONTEND_ROOT, shell: false, encoding: 'utf8', windowsHide: true, timeout: 30_000,
  })
  if (printed.status !== 0) infrastructureFail(`renderer/style contract fingerprint failed (${printed.status ?? 'signal'}): ${(printed.stderr || printed.stdout || '').trim()}`)
  let value
  try { value = JSON.parse(printed.stdout) } catch (error) { infrastructureFail(`renderer/style contract fingerprint is invalid JSON: ${error.message}`) }
  if (value.schema !== 'renderer_style_contract_hash.v2' || !HASH.test(value.renderer_style_hash ?? '') || !HASH.test(value.fixture_hash ?? '') || value.route_fingerprint !== value.renderer_style_hash || canonicalJsonHash(object(value.route_fingerprint_parts, 'route_fingerprint_parts')) !== value.renderer_style_hash) infrastructureFail('renderer/style contract fingerprint schema or hashes are invalid')
  context.rendererStyleContract = value
  return value
}

function rendererRouteContractDependency(context) {
  const contract = rendererStyleContract(context)
  return { kind: 'renderer_route_contract', scope: 'repo', renderer_style_hash: contract.renderer_style_hash, fixture_hash: contract.fixture_hash, route_fingerprint: contract.route_fingerprint }
}

function rendererCacheDependencies(context) {
  const contract = rendererStyleContract(context)
  const snapshotContractPath = resolve(REPO_ROOT, 'frontend/src/render-snapshot/knowledgeMagazineRenderSnapshot.tsx')
  for (const path of [RENDERER_CLI, snapshotContractPath]) if (!existsSync(path)) fail(`Stage-3 render dependency is missing: ${path}`)
  return [
    { kind: 'renderer_snapshot_cli', scope: 'repo', path: portablePath(REPO_ROOT, RENDERER_CLI), byte_hash: sha256Bytes(readFileSync(RENDERER_CLI)) },
    { kind: 'renderer_snapshot_contract', scope: 'repo', path: portablePath(REPO_ROOT, snapshotContractPath), byte_hash: sha256Bytes(readFileSync(snapshotContractPath)) },
  ]
}

function rendererStyleValidationPath(context, contract) {
  const cacheId = canonicalJsonHash({ validator_version: STYLE_VALIDATOR_VERSION, renderer_style_hash: contract.renderer_style_hash, fixture_hash: contract.fixture_hash })
  return resolve(context.stateDir, 'render', `${cacheId.slice('sha256:'.length)}.renderer-style-validation.v2.json`)
}

function sharedRendererStyleValidationPath(contract) {
  const cacheId = canonicalJsonHash({ validator_version: STYLE_VALIDATOR_VERSION, renderer_style_hash: contract.renderer_style_hash, fixture_hash: contract.fixture_hash })
  return resolve(REPO_ROOT, 'frontend/node_modules/.cache/supplement-stack/renderer-style', `${cacheId.slice('sha256:'.length)}.renderer-style-validation.v2.json`)
}

function validateRendererStyleArtifact(path, contract) {
  const value = readJson(path, 'renderer style validation')
  if (value.schema !== 'renderer_style_validation.v2' || value.content_hash !== artifactHashV2(value) || value.result !== 'PASS') fail('renderer style validation schema/hash/result is invalid')
  if (value.validator_version !== STYLE_VALIDATOR_VERSION || value.renderer_style_hash !== contract.renderer_style_hash || value.fixture_hash !== contract.fixture_hash || value.route_fingerprint !== contract.route_fingerprint || canonicalJsonHash(value.route_fingerprint_parts) !== canonicalJsonHash(contract.route_fingerprint_parts)) fail('renderer style validation route/fixture dependency hashes differ')
  if (!Array.isArray(value.checks) || !value.checks.length || value.checks.some((check) => check.result !== 'PASS') || !Array.isArray(value.errors) || value.errors.length) fail('renderer style validation contains a failed check/error')
  const desktop = value.viewports?.desktop, mobile = value.viewports?.mobile
  if (value.viewport?.width !== 1440 || value.viewport?.height !== 1000 || value.viewport?.device_scale_factor !== 1 || desktop?.viewport?.width !== 1440 || desktop?.viewport?.height !== 1000 || desktop?.result !== 'PASS' || mobile?.viewport?.width !== 390 || mobile?.viewport?.height !== 844 || mobile?.result !== 'PASS' || !value.browser?.product || !value.browser?.user_agent || !value.route_contract || typeof value.route_contract !== 'object') fail('renderer style validation did not bind both canonical hydrated route/browser viewports')
  return { value, path, byteHash: sha256Bytes(readFileSync(path)) }
}

function ensureRendererStyleValidation({ context }) {
  const contract = rendererStyleContract(context)
  const outputPath = rendererStyleValidationPath(context, contract)
  if (existsSync(outputPath)) {
    try { return { ...validateRendererStyleArtifact(outputPath, contract), contract, cacheHit: true } } catch {}
  }
  const sharedPath = sharedRendererStyleValidationPath(contract)
  if (existsSync(sharedPath)) {
    try {
      const shared = validateRendererStyleArtifact(sharedPath, contract)
      writeJsonAtomic(outputPath, shared.value)
      return { ...validateRendererStyleArtifact(outputPath, contract), contract, cacheHit: true }
    } catch {}
  }
  const request = { schema: 'renderer_style_validation_request.v2', renderer_style_hash: contract.renderer_style_hash, fixture_hash: contract.fixture_hash }
  const requestPath = outputPath.replace(/\.renderer-style-validation\.v2\.json$/, '.renderer-style-validation-request.v2.json')
  writeJsonAtomic(requestPath, request)
  const checked = spawnSync(process.execPath, [STYLE_VALIDATOR_CLI, '--input', requestPath, '--out', sharedPath], {
    cwd: FRONTEND_ROOT, shell: false, encoding: 'utf8', windowsHide: true, timeout: 90_000,
  })
  if (checked.status !== 0) infrastructureFail(`real-browser renderer style validation failed (${checked.status ?? 'signal'}): ${styleCliFailureDiagnostic(checked, sharedPath)}`)
  if (!existsSync(sharedPath)) infrastructureFail('real-browser renderer style validator did not create its attestation')
  let shared
  try { shared = validateRendererStyleArtifact(sharedPath, contract) } catch (error) { infrastructureFail(`real-browser renderer style attestation is invalid: ${error.message}`) }
  writeJsonAtomic(outputPath, shared.value)
  return { ...validateRendererStyleArtifact(outputPath, contract), contract, cacheHit: false }
}

function compileDependencies({ context, article, factsPackage, markdownInput, writer }) {
  const assetBindings = assetCacheDependencies({ context, article, writer })
  if (assetBindings === null) return null
  const bindings = [
    { kind: 'facts_package_slice', scope: 'run', path: portablePath(context.root, context.packagePaths[article.stage][article.article_id]), article_package_hash: factsPackage.article_package_hash },
    { kind: 'article', scope: 'run', path: portablePath(context.root, article.markdown_path), byte_hash: markdownInput.byteHash },
    { kind: 'writer_receipt', scope: 'run', path: portablePath(context.root, writer.path), byte_hash: writer.byteHash },
    frameworkDependency(factsPackage),
    selectedLinkSliceDependency(context, article, factsPackage),
    seoUniquenessDependency(context, article),
    rendererRouteContractDependency(context),
    ...(article.stage === 'stage2' ? [{ kind: 'stage2_visible_payload_contract', scope: 'runtime', version: 'stage2-visible-payload.v2.1.0' }] : []),
    ...assetBindings,
  ]
  if (article.stage === 'stage3') {
    const rendererBindings = rendererCacheDependencies(context)
    bindings.push(...rendererBindings)
  }
  return bindings
}

function compileCacheKey({ context, article, factsPackage, writer, dependencyBindings }) {
  return canonicalJsonHash({
    dependencies: dependencyBindings, policy_version: context.policyVersion, validator_version: context.validatorVersion,
    renderer_version: context.rendererVersion, render_profile: article.render_profile,
    evidence_membership_hash: factsPackage.evidence_membership_hash, article_lineage_hash: factsPackage.article_lineage_hash,
    revision: writer.revision,
  })
}

function cachedCompileResult({ context, article, factsPackage, writer, cacheKey, compiledPath, receiptPath }) {
  if (!existsSync(compiledPath) || !existsSync(receiptPath)) return null
  const receipt = readJson(receiptPath, `${article.article_id} cached validation receipt`)
  const compiledByteHash = sha256Bytes(readFileSync(compiledPath))
  if (receipt.schema !== 'validation_receipt.v2' || receipt.result !== 'PASS' || receipt.source_aware !== true
    || receipt.revision !== writer.revision || receipt.cache_key !== cacheKey || receipt.policy_version !== context.policyVersion
    || receipt.validator_version !== context.validatorVersion || receipt.compiled_binding?.byte_hash !== compiledByteHash
    || receipt.content_hash !== artifactHashV2(receipt)) return null
  const compiled = readJson(compiledPath, `${article.article_id} cached compiled article`)
  if (compiled.schema !== 'compiled_article.v2' || compiled.revision !== writer.revision
    || compiled.compiled_payload_hash !== receipt.compiled_payload_hash
    || compiled.compiled_payload_hash !== canonicalJsonHash(Object.fromEntries(Object.entries(compiled).filter(([key]) => key !== 'compiled_payload_hash')))) return null
  let rendererStyleCacheHit = null
  if (article.stage === 'stage3') {
    if (!compiled.renderer_style_validation_path || !compiled.renderer_style_validation) return null
    const stylePath = resolve(context.root, compiled.renderer_style_validation_path)
    if (!existsSync(stylePath)) return null
    try {
      const style = validateRendererStyleArtifact(stylePath, rendererStyleContract(context))
      if (style.value.content_hash !== compiled.renderer_style_validation.content_hash || !receipt.input_bindings?.some((entry) => entry.kind === 'renderer_style_validation' && entry.byte_hash === style.byteHash && entry.content_hash === style.value.content_hash)) return null
      rendererStyleCacheHit = true
    } catch { return null }
  }
  return { status: 'pass', article, factsPackage, writer, compiled, compiledPath, compiledByteHash, validationReceipt: receipt, validationReceiptPath: receiptPath, validationReceiptHash: receipt.content_hash, cacheHit: true, rendererStyleCacheHit }
}

export function compileArticleV2({ context, article, factsPackage, evidenceMembershipHash, issuedWorkOrders }) {
  const markdownInput = readMarkdown(article.markdown_path)
  const writer = validateWriterReceipt({ context, article, factsPackage, articleByteHash: markdownInput.byteHash, evidenceMembershipHash, issuedWorkOrders })
  if (writer.status !== 'pass') return { status: 'waiting_writer', writer }
  if (factsPackage.facts_reviewer_ids.includes(writer.writerId)) fail(`${article.article_id} writer must differ from every facts reviewer`)
  const compiledPath = compiledArticlePath(context, article, writer.revision)
  const receiptPath = validationReceiptPath(context, article, writer.revision)
  let dependencyBindings = compileDependencies({ context, article, factsPackage, markdownInput, writer })
  let cacheKey = dependencyBindings ? compileCacheKey({ context, article, factsPackage, writer, dependencyBindings }) : null
  if (cacheKey) {
    const cached = cachedCompileResult({ context, article, factsPackage, writer, cacheKey, compiledPath, receiptPath })
    if (cached) return cached
  }
  const visible = compileVisiblePayload({ context, article, factsPackage, markdown: markdownInput.markdown })
  if (article.stage === 'stage2' && visible.publishPayload.title !== factsPackage.source_presentation_label_de) {
    fail(`${article.article_id} Stage-2 title must equal its German original-source presentation label`)
  }
  const numberUnitTokens = validateNumberUnitTokens(article, factsPackage, markdownInput.markdown)
  const assetResult = validateAssets({ context, article, factsPackage, writer, markdown: markdownInput.markdown })
  if (assetResult.status !== 'pass') return { status: 'waiting_writer', writer, missingAssets: assetResult.missing }
  if (!sameSet(writer.assetIds, assetResult.assets.map((asset) => asset.asset_id))) fail(`${article.article_id} writer receipt asset set differs from compiled assets`)
  const ast = markdownAst(markdownInput.markdown)
  const headings = ast.filter((node) => node.type === 'heading').map((node) => ({ level: node.level, text: node.text }))
  const tables = ast.filter((node) => node.type === 'table_row').map((node) => node.cells)
  const links = linkInventory(markdownInput.markdown)
  const relations = visible.publishPayload.sources.map((source, position) => ({ position, source_id: source.source_id, label: source.label, url: source.url }))
  const relationHash = canonicalJsonHash(relations)
  const assetHashes = assetResult.assets.map((asset) => asset.byte_hash)
  const seo = buildTechnicalSeo({ context, article, factsPackage, publishPayload: visible.publishPayload })
  const visibleHashMaterial = {
    title: visible.publishPayload.title, dek: visible.publishPayload.dek, ordered_visible_ast: ast, headings, tables, links,
    conclusion: visible.publishPayload.conclusion, expanded_sources: relations, assets: assetResult.assets,
  }
  const visiblePayloadHash = canonicalJsonHash(visibleHashMaterial)
  const expectedProjection = article.stage === 'stage3'
    ? expectedStage3Projection({ article, markdown: markdownInput.markdown, publishPayload: visible.publishPayload, assets: assetResult.assets })
    : expectedStage2Projection({ article, markdown: markdownInput.markdown, publishPayload: visible.publishPayload, assets: assetResult.assets })
  const render = buildRenderSnapshot({ context, article, writer, articleByteHash: markdownInput.byteHash, visiblePayloadHash, publishPayload: visible.publishPayload, expectedProjection })
  const styleValidation = article.stage === 'stage3' ? ensureRendererStyleValidation({ context }) : null
  if (article.stage === 'stage3') {
    dependencyBindings.push({ kind: 'renderer_style_validation', scope: 'run', path: portablePath(context.root, styleValidation.path), byte_hash: styleValidation.byteHash, content_hash: styleValidation.value.content_hash })
  }
  let previousCompiled = null
  if (writer.revision > 0) {
    const previousPath = compiledArticlePath(context, article, writer.revision - 1)
    if (!existsSync(previousPath)) fail(`${article.article_id} revision ${writer.revision} has no frozen predecessor`)
    previousCompiled = readJson(previousPath, `${article.article_id} previous compiled article`)
    if (previousCompiled.compiled_payload_hash !== writer.receipt.previous_compiled_payload_hash) fail(`${article.article_id} previous compiled payload hash differs from writer ancestry`)
  }
  const revision = deriveRevisionDiff({ article, writer, markdown: markdownInput.markdown, articleByteHash: markdownInput.byteHash, previousCompiled, visible, relations, assets: assetResult.assets, factsPackage })
  const qaPayloadBase = {
    schema: 'article_qa_payload.v2', article_id: article.article_id, stage: article.stage, revision: writer.revision,
    visible_payload_hash: visiblePayloadHash, publish_payload: visible.publishPayload, visible_hash_material: visibleHashMaterial,
    facts_package_hash: factsPackage.article_package_hash, evidence_membership_hash: evidenceMembershipHash, framework_hash: factsPackage.framework_hash,
    writer_execution_id: writer.executionId, relation_hash: relationHash, asset_hashes: assetHashes, render_snapshot_hash: render.snapshot.content_hash,
    revision_diff_hash: revision?.diff.diff_hash ?? null, projection_hash: expectedProjection ? canonicalJsonHash(expectedProjection) : null,
    renderer_style_validation_hash: styleValidation?.value.content_hash ?? null,
  }
  const qaPayload = { ...qaPayloadBase, content_hash: canonicalJsonHash(qaPayloadBase) }
  const compiledBase = {
    schema: 'compiled_article.v2', article_id: article.article_id, stage: article.stage, slug: article.slug, revision: writer.revision,
    article_byte_hash: markdownInput.byteHash, facts_package_hash: factsPackage.article_package_hash, evidence_membership_hash: evidenceMembershipHash,
    article_lineage_hash: factsPackage.article_lineage_hash, framework_hash: factsPackage.framework_hash,
    writer_execution_id: writer.executionId, writer_receipt_hash: writer.receiptHash, policy_version: context.policyVersion, render_profile: article.render_profile,
    validator_version: context.validatorVersion, renderer_version: context.rendererVersion,
    publish_payload: visible.publishPayload, visible_hash_material: visibleHashMaterial, ordered_ast: ast, headings, tables, links, expanded_sources: relations,
    relation_hash: relationHash, assets: assetResult.assets, asset_hashes: assetHashes, seo, number_unit_tokens: numberUnitTokens,
    authoring_lines: markdownInput.markdown.split('\n'), qa_payload: qaPayload, render_snapshot: render.snapshot,
    render_request: render.request, render_request_path: render.requestPath ? portablePath(context.root, render.requestPath) : null,
    render_snapshot_path: render.snapshotPath ? portablePath(context.root, render.snapshotPath) : null,
    expected_projection: expectedProjection, projection_hash: expectedProjection ? canonicalJsonHash(expectedProjection) : null,
    renderer_style_validation: styleValidation?.value ?? null, renderer_style_validation_path: styleValidation ? portablePath(context.root, styleValidation.path) : null,
    revision_diff: revision?.diff ?? null, recheck_scope: revision?.recheck_scope ?? null,
  }
  const compiled = { ...compiledBase, visible_payload_hash: visiblePayloadHash, compiled_payload_hash: canonicalJsonHash({ ...compiledBase, visible_payload_hash: visiblePayloadHash }) }
  writeJsonAtomic(compiledPath, compiled)
  const receiptBase = {
    schema: 'validation_receipt.v2', validation_id: `${article.article_id}.r${writer.revision}.${compiled.compiled_payload_hash.slice(-12)}`,
    article_id: article.article_id, stage: article.stage, revision: writer.revision, result: 'PASS', source_aware: true,
    cache_key: cacheKey, validator_version: context.validatorVersion, policy_version: context.policyVersion,
    facts_package_hash: factsPackage.article_package_hash, evidence_membership_hash: evidenceMembershipHash, article_lineage_hash: factsPackage.article_lineage_hash,
    framework_hash: factsPackage.framework_hash, article_byte_hash: markdownInput.byteHash,
    visible_payload_hash: compiled.visible_payload_hash, compiled_payload_hash: compiled.compiled_payload_hash, relation_hash: relationHash, asset_hashes: assetHashes,
    qa_payload_hash: compiled.qa_payload.content_hash, render_snapshot_hash: compiled.render_snapshot.content_hash,
    render_snapshot_binding: render.snapshotPath ? { path: portablePath(context.root, render.snapshotPath), byte_hash: render.snapshotByteHash } : null,
    render_request_hash: render.request?.content_hash ?? null, projection_hash: expectedProjection ? canonicalJsonHash(expectedProjection) : null, renderer_style_validation_hash: styleValidation?.value.content_hash ?? null, revision_diff_hash: revision?.diff.diff_hash ?? null,
    input_bindings: dependencyBindings, compiled_binding: { path: portablePath(context.root, compiledPath), byte_hash: null },
    validated_checks: ['strict_utf8', 'framework_bytes', 'template_structure', 'visible_sources', 'source_aware_number_units', 'local_assets', 'internal_links', 'workflow_language', 'empty_sections', 'renderer_route_contract', ...(article.stage === 'stage3' ? ['react_render_snapshot', 'independent_render_projection', 'real_browser_style_validation'] : ['deterministic_full_stage2_projection', 'final_public_dom_readback_required'])],
  }
  const compiledByteHash = sha256Bytes(readFileSync(compiledPath))
  receiptBase.compiled_binding.byte_hash = compiledByteHash
  const receipt = { ...receiptBase, content_hash: artifactHashV2(receiptBase) }
  writeJsonAtomic(receiptPath, receipt)
  return { status: 'pass', article, factsPackage, writer, compiled, compiledPath, compiledByteHash, validationReceipt: receipt, validationReceiptPath: receiptPath, validationReceiptHash: receipt.content_hash, cacheHit: false, rendererStyleCacheHit: styleValidation?.cacheHit ?? null }
}

function validateReviewChecks(review, label) {
  object(review.passes, `${label}.passes`)
  const results = []
  for (const key of ['facts_safety_sources', 'reader_seo_template']) {
    const value = object(review.passes[key], `${label}.passes.${key}`)
    if (!['PASS', 'FAIL'].includes(value.result)) fail(`${label}.passes.${key}.result must equal PASS or FAIL`)
    if (!Array.isArray(value.checked) || !value.checked.length) fail(`${label}.passes.${key}.checked must be non-empty`)
    results.push(value.result)
  }
  return results
}

function publicationFindingKey(finding) {
  return `${finding.pass}:${finding.code}:${finding.location}`
}

export function validatePublicationReviewV2({ context, compiledArticle, independentFromIds }) {
  const { article, writer, compiled, factsPackage, validationReceiptHash } = compiledArticle
  const path = publicationReviewPath(context, article, writer.revision)
  if (!existsSync(path)) return { status: 'missing', path, revision: writer.revision }
  const review = readJson(path, `${article.article_id} publication review`)
  if (review.schema !== 'article_publication_review.v2' || review.content_hash !== artifactHashV2(review)) fail(`${article.article_id} publication review schema/hash is invalid`)
  const reviewId = assertSafeId(review.review_id, `${article.article_id}.review_id`)
  if (review.article_id !== article.article_id || review.stage !== article.stage || Number(review.revision) !== writer.revision) fail(`${article.article_id} publication review article/revision differs`)
  if (review.compiled_payload_hash !== compiled.compiled_payload_hash || review.visible_payload_hash !== compiled.visible_payload_hash || review.qa_payload_hash !== compiled.qa_payload.content_hash || review.render_snapshot_hash !== compiled.render_snapshot.content_hash || review.validation_receipt_hash !== validationReceiptHash || review.facts_package_hash !== compiled.facts_package_hash || review.writer_execution_id !== writer.executionId) return { status: 'stale', path, reason: `${article.article_id} publication review input hashes differ`, revision: writer.revision }
  if (!sameSet(review.asset_hashes ?? [], compiled.asset_hashes)) return { status: 'stale', path, reason: `${article.article_id} publication review asset hashes differ`, revision: writer.revision }
  if (!sameSet(review.asset_receipt_hashes ?? [], compiled.assets.map((asset) => asset.receipt_hash))) return { status: 'stale', path, reason: `${article.article_id} publication review asset receipt hashes differ`, revision: writer.revision }
  const issued = array(context.issuedWorkOrders ?? [], `${article.article_id}.issued_work_orders`).find((order) => order.work_order_id === review.work_order_id)
  if (!issued || issued.schema !== 'nutrient_content_work_order.v2' || issued.work_order_id !== canonicalJsonHash(Object.fromEntries(Object.entries(issued).filter(([key]) => key !== 'work_order_id')))
    || issued.kind !== 'publication_qa' || issued.execution_class !== 'llm' || issued.assignee?.role !== 'article-reader-acceptance-reviewer'
    || issued.task?.article_id !== article.article_id || issued.task?.revision !== writer.revision || issued.task?.qa_payload_hash !== compiled.qa_payload.content_hash
    || issued.task?.writer_execution_id !== writer.executionId || issued.task?.render_snapshot_hash !== compiled.render_snapshot.content_hash
    || !issued.outputs?.some((output) => output.name === 'publication_review' && output.schema === 'article_publication_review.v2' && resolve(context.root, output.path) === path)) fail(`${article.article_id} publication review does not bind the exact issued publication_qa WorkOrder`)
  const requiredInputs = { compiled_article: compiled.compiled_payload_hash, facts_package: factsPackage.package_content_hash, validation_receipt: validationReceiptHash, writer_result: writer.receiptHash }
  for (const [name, contentHash] of Object.entries(requiredInputs)) if (!issued.inputs?.some((input) => input.name === name && input.content_hash === contentHash)) fail(`${article.article_id} publication_qa WorkOrder input ${name} is stale`)
  const expectedIndependentIds = [...new Set([writer.writerId, ...independentFromIds])].sort()
  if (!sameSet(issued.assignee.independent_from_ids ?? [], expectedIndependentIds)) fail(`${article.article_id} publication_qa WorkOrder independence scope differs`)
  if (review.reviewer?.role !== 'article-reader-acceptance-reviewer') fail(`${article.article_id} publication reviewer role is invalid`)
  const reviewerId = assertSafeId(review.reviewer.id, `${article.article_id}.publication reviewer id`)
  if (issued.assignee.independent_from_ids.includes(reviewerId)) fail(`${article.article_id} publication reviewer is not independent from its exact WorkOrder scope`)
  iso(review.reviewed_at, `${article.article_id}.reviewed_at`)
  if (!['PASS', 'FAIL'].includes(review.result)) fail(`${article.article_id} publication review result is invalid`)
  const findings = array(review.findings, `${article.article_id}.findings`)
  for (const [index, finding] of findings.entries()) {
    object(finding, `${article.article_id}.findings[${index}]`)
    if (!['blocking_facts', 'blocking_reader', 'polish'].includes(finding.category)) fail(`${article.article_id} finding category is invalid`)
    if (!['A', 'B'].includes(finding.pass)) fail(`${article.article_id} finding pass must be A or B`)
    text(finding.code, `${article.article_id} finding code`); text(finding.message, `${article.article_id} finding message`)
    text(finding.location, `${article.article_id} finding location`); text(finding.target, `${article.article_id} finding target`)
    text(finding.minimal_scope, `${article.article_id} finding minimal_scope`)
    const recordIds = array(finding.record_ids, `${article.article_id} finding record_ids`).map((id) => assertSafeId(id, 'finding record_id'))
    if (recordIds.some((id) => !compiledArticle.factsPackage.record_ids.includes(id))) fail(`${article.article_id} finding references a record outside its facts package`)
  }
  const hasBlocking = findings.some((finding) => finding.category !== 'polish')
  if (review.result === 'PASS' && hasBlocking) fail(`${article.article_id} passing publication review cannot retain blocking findings`)
  if (review.result === 'FAIL' && !hasBlocking) fail(`${article.article_id} failing publication review needs a blocking finding`)
  const questions = object(review.reader_questions, `${article.article_id}.reader_questions`)
  for (const key of ['q1', 'q2', 'q3']) if (!['Ja', 'Nein'].includes(questions[key])) fail(`${article.article_id} reader question ${key} must equal Ja or Nein`)
  if (review.result === 'PASS' && (questions.q1 !== 'Ja' || questions.q2 !== 'Ja' || questions.q3 !== 'Nein')) fail(`${article.article_id} passing reader questions must equal Ja/Ja/Nein`)
  const passResults = validateReviewChecks(review, article.article_id)
  if (review.result === 'PASS' && passResults.some((result) => result !== 'PASS')) fail(`${article.article_id} overall PASS requires both review passes`)
  if (review.result === 'FAIL' && passResults.every((result) => result === 'PASS')) fail(`${article.article_id} overall FAIL needs a failed review pass`)
  if (writer.revision === 0) {
    if (review.review_type !== 'full') fail(`${article.article_id} initial publication review must be full`)
  } else {
    if (review.review_type !== 'targeted_recheck') fail(`${article.article_id} revised publication review must be targeted_recheck`)
    if (review.previous_review_id !== writer.receipt.previous_review_id || review.previous_compiled_payload_hash !== writer.receipt.previous_compiled_payload_hash) return { status: 'stale', path, reason: `${article.article_id} targeted recheck previous review/payload binding differs`, revision: writer.revision }
    const previousPath = publicationReviewPath(context, article, writer.revision - 1)
    if (!existsSync(previousPath)) fail(`${article.article_id} targeted recheck has no previous publication review bytes`)
    const previousReview = readJson(previousPath, `${article.article_id} previous publication review`)
    if (previousReview.schema !== 'article_publication_review.v2' || previousReview.content_hash !== artifactHashV2(previousReview) || previousReview.result !== 'FAIL') fail(`${article.article_id} targeted recheck predecessor is not a valid failing review`)
    if (previousReview.review_id !== review.previous_review_id || previousReview.compiled_payload_hash !== review.previous_compiled_payload_hash || review.previous_review_hash !== previousReview.content_hash) return { status: 'stale', path, reason: `${article.article_id} targeted recheck predecessor byte/hash binding differs`, revision: writer.revision }
    const previousFindingsHash = canonicalJsonHash(previousReview.findings)
    if (review.previous_findings_hash !== previousFindingsHash) return { status: 'stale', path, reason: `${article.article_id} targeted recheck previous findings hash differs`, revision: writer.revision }
    const allowedFindingKeys = previousReview.findings.map(publicationFindingKey).sort()
    if (!sameSet(review.allowed_finding_keys ?? [], allowedFindingKeys)) fail(`${article.article_id} targeted recheck allowed finding set differs from its predecessor`)
    if (findings.some((finding) => !allowedFindingKeys.includes(publicationFindingKey(finding)))) fail(`${article.article_id} targeted recheck introduced a finding outside the original bounded scope`)
    const scope = object(review.recheck_scope, `${article.article_id}.recheck_scope`)
    for (const key of ['changed_lines', 'neighbour_paragraphs', 'touched_claims', 'touched_sources', 'touched_assets', 'visible_side_effects']) if (!Array.isArray(scope[key])) fail(`${article.article_id}.recheck_scope.${key} must be an array`)
    hash(scope.diff_hash, `${article.article_id}.recheck_scope.diff_hash`)
    if (canonicalJsonHash(scope) !== canonicalJsonHash(compiled.recheck_scope)) return { status: 'stale', path, reason: `${article.article_id} targeted recheck scope differs from server-derived diff`, revision: writer.revision }
    const scopeHash = canonicalJsonHash(scope)
    for (const key of ['facts_safety_sources', 'reader_seo_template']) if (review.passes[key].scope_hash !== scopeHash) fail(`${article.article_id} targeted recheck pass ${key} is not scoped to the server-derived diff`)
  }
  return { status: review.result === 'PASS' ? 'pass' : 'fail', path, review, reviewId, reviewerId, findings, reviewHash: review.content_hash, byteHash: sha256Bytes(readFileSync(path)) }
}

function publicationReviewedDate(reviewedAt) {
  const parsed = new Date(iso(reviewedAt, 'publication review reviewed_at'))
  const date = parsed.toISOString().slice(0, 10)
  const label = new Intl.DateTimeFormat('de-DE', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' }).format(new Date(`${date}T12:00:00.000Z`))
  return { reviewed_at: date, reviewed_label: `Geprüft am ${label}` }
}

function lateBoundReleaseProjection({ entry, ingredientName }) {
  const projection = structuredClone(entry.compiled.expected_projection)
  const reviewed = publicationReviewedDate(entry.publicationReview.review.reviewed_at)
  projection.ui = {
    ...projection.ui,
    ingredient_chip: `${entry.article.stage === 'stage3' ? 'Wirkstoff' : 'Wirkstoffe'}: ${ingredientName}`,
    reviewed_date: reviewed.reviewed_label,
  }
  return { projection, ...reviewed }
}

function releasePublicationTimestamps({ context, entry }) {
  const reviewedAt = new Date(iso(entry.publicationReview.review.reviewed_at, `${entry.article.article_id} publication reviewed_at`)).toISOString()
  if (entry.article.write_guard.mode === 'create') return { published_at: reviewedAt, modified_at: reviewedAt }
  const target = context.articleTargets?.byId?.get(entry.article.article_id)
  if (!target) fail(`${entry.article.article_id} update release needs its authoritative article-target timestamp readback`)
  const publishedAt = new Date(iso(target.created_at, `${entry.article.article_id} persisted created_at`)).toISOString()
  const modifiedAt = new Date(Math.max(Date.parse(publishedAt), Date.parse(reviewedAt), Date.parse(iso(target.updated_at, `${entry.article.article_id} persisted updated_at`)))).toISOString()
  return { published_at: publishedAt, modified_at: modifiedAt }
}

function lateBoundReleaseSeo({ entry, publishedAt, modifiedAt, publicBaseUrl }) {
  const organization = { '@type': 'Organization', '@id': new URL('/#organization', publicBaseUrl).href, name: 'Supplement Stack', url: new URL('/', publicBaseUrl).href }
  const image = entry.compiled.assets[0]?.public_url ? new URL(entry.compiled.assets[0].public_url, publicBaseUrl).href : null
  const jsonLd = {
    ...entry.compiled.seo.json_ld,
    datePublished: publishedAt,
    dateModified: modifiedAt,
    author: organization,
    publisher: organization,
    ...(image ? { image } : {}),
  }
  const seo = { ...entry.compiled.seo, json_ld: jsonLd }
  const publicSeo = { meta_title: seo.meta_title, meta_description: seo.meta_description, canonical_url: seo.canonical_url, canonical_path: seo.canonical_path, robots: seo.robots, indexable: seo.indexable, json_ld: seo.json_ld }
  return { seo: { ...seo, seo_hash: canonicalJsonHash(publicSeo) }, seoHash: canonicalJsonHash(publicSeo) }
}

export function buildContentReleaseV2({ context, articles }) {
  if (!context.ingredientTarget || !context.sourceResolution) fail('content release needs authoritative ingredient target and source resolution receipts')
  const releaseArticles = articles.map((entry) => {
    const lateBound = lateBoundReleaseProjection({ entry, ingredientName: context.ingredientTarget.canonical_name })
    const timestamps = releasePublicationTimestamps({ context, entry })
    const lateSeo = lateBoundReleaseSeo({ entry, publishedAt: timestamps.published_at, modifiedAt: timestamps.modified_at, publicBaseUrl: context.publish.publicBaseUrl ?? 'https://supplementstack.de/' })
    return ({
    article_id: entry.article.article_id, stage: entry.article.stage, slug: entry.article.slug, change_class: entry.article.change_class,
    write_guard: entry.article.write_guard, desired_status: 'published', target: context.publish.target, article_byte_hash: entry.compiled.article_byte_hash,
    facts_package_hash: entry.compiled.facts_package_hash, evidence_membership_hash: entry.compiled.evidence_membership_hash,
    article_lineage_hash: entry.compiled.article_lineage_hash, framework_hash: entry.compiled.framework_hash,
    writer_execution_id: entry.writer.executionId, validation_receipt_hash: entry.validationReceiptHash, publication_review_hash: entry.publicationReview.reviewHash,
    compiled_payload_hash: entry.compiled.compiled_payload_hash, visible_payload_hash: entry.compiled.visible_payload_hash,
    qa_payload_hash: entry.compiled.qa_payload.content_hash, render_snapshot_hash: entry.compiled.render_snapshot.content_hash,
    relation_hash: entry.compiled.relation_hash, asset_hashes: entry.compiled.asset_hashes, seo: lateSeo.seo,
    seo_hash: lateSeo.seoHash, qa_seo_hash: entry.compiled.seo.seo_hash,
    publish_payload: entry.compiled.publish_payload, source_relations: entry.compiled.expanded_sources, assets: entry.compiled.assets.map((asset) => ({ ...asset, deployment_receipt_hash: context.assetDeployment?.receipt_hash ?? null })),
    expected_projection: lateBound.projection, projection_hash: canonicalJsonHash(lateBound.projection), qa_projection_hash: entry.compiled.projection_hash, reviewed_at: lateBound.reviewed_at, published_at: timestamps.published_at, modified_at: timestamps.modified_at,
    ingredient_ids: [context.ingredientTarget.ingredient_id], ingredient_relation_hash: canonicalJsonHash({ ingredient_ids: [context.ingredientTarget.ingredient_id] }),
    source_projection: { schema: 'knowledge_article_sources_projection.v2', facts_package_hash: entry.compiled.facts_package_hash, ingredient_ids: [context.ingredientTarget.ingredient_id], relations: entry.compiled.expanded_sources, relation_hash: entry.compiled.relation_hash },
    stage2_interpretation_projection: buildStage2InterpretationProjectionV1({ article: entry.article, factsPackage: entry.factsPackage, ingredientTarget: context.ingredientTarget, sourceResolution: context.sourceResolution }),
    internal_link_dependencies: entry.factsPackage.selected_link_slice.links.filter((link) => (link.target_state ?? 'live') === 'same_release'),
  }) }).sort((a, b) => a.article_id.localeCompare(b.article_id))
  const duplicateField = (field) => {
    const seen = new Map()
    for (const article of releaseArticles) {
      const value = seoComparisonKeyV2(article.seo[field])
      if (seen.has(value)) fail(`release SEO ${field} is duplicated by ${seen.get(value)} and ${article.article_id}`)
      seen.set(value, article.article_id)
    }
  }
  duplicateField('meta_title'); duplicateField('meta_description')
  const retireArticles = (context.publish.retireArticles ?? []).map((target) => ({
    article_id: target.article_id,
    slug: target.slug,
    expected_status: target.expected_status,
    expected_version: target.expected_version,
    expected_payload_hash: target.expected_payload_hash,
    desired_status: 'draft',
    target: context.publish.target,
  })).sort((left, right) => left.article_id.localeCompare(right.article_id))
  const activeIds = new Set(releaseArticles.map((article) => article.article_id)), activeSlugs = new Set(releaseArticles.map((article) => article.slug))
  for (const target of retireArticles) {
    if (activeIds.has(target.article_id) || activeSlugs.has(target.slug)) fail(`retirement target ${target.article_id}/${target.slug} collides with an active release article`)
  }
  const byArticleId = new Map(releaseArticles.map((article) => [article.article_id, article]))
  for (const article of releaseArticles) for (const dependency of article.internal_link_dependencies) {
    if ((dependency.target_state ?? 'live') !== 'same_release') continue
    const target = byArticleId.get(dependency.target_article_id)
    if (!target || target.slug !== dependency.target_id || dependency.path !== `/wissen/${target.slug}`) fail(`${article.article_id} same-release link ${dependency.path} is not satisfied by the atomic release bundle`)
  }
  const base = {
    schema: 'content_release.v2', run_id: context.runId, manifest_hash: context.manifestHash, policy_version: context.policyVersion,
    ingredient_target: { ingredient_id: context.ingredientTarget.ingredient_id, canonical_name: context.ingredientTarget.canonical_name, canonical_slug: context.ingredientTarget.canonical_slug, status: context.ingredientTarget.status, version: context.ingredientTarget.version, identity_hash: context.ingredientTarget.identity_hash, receipt_hash: context.ingredientTarget.receipt_hash },
    source_resolution_receipt_hash: context.sourceResolution.receipt_hash, article_target_receipt_hash: context.articleTargets?.receipt_hash ?? null, asset_deployment_receipt_hash: context.assetDeployment?.receipt_hash ?? null,
    publish_target: context.publish.target, public_base_url: context.publish.publicBaseUrl ?? 'https://supplementstack.de', atomic: true, articles: releaseArticles, retire_articles: retireArticles,
  }
  return { ...base, release_hash: canonicalJsonHash(base) }
}

function requireReadbackObject(value, label) {
  object(value, label)
  const checkedAt = iso(value.checked_at, `${label}.checked_at`)
  if (!Array.isArray(value.checked) || !value.checked.length) fail(`${label}.checked must be non-empty`)
  if (value.result !== 'MATCH') fail(`${label}.result must equal MATCH`)
  return checkedAt
}

export function validatePublishReceiptV2({ context, release, receiptPath }) {
  if (!existsSync(receiptPath)) return { status: 'missing', reason: 'content_publish_receipt.v2 is missing' }
  const receipt = readJson(receiptPath, 'content publish receipt')
  if (receipt.schema !== 'content_publish_receipt.v2' || receipt.content_hash !== artifactHashV2(receipt)) fail('publish receipt schema/hash is invalid')
  if (receipt.release_hash !== release.release_hash || receipt.target !== context.publish.target) fail('publish receipt release/target differs')
  const appliedAt = iso(receipt.applied_at, 'publish receipt applied_at')
  if (receipt.executor?.role !== 'deterministic-content-publication-executor') fail('publish receipt executor role is invalid')
  assertSafeId(receipt.executor.id, 'publish receipt executor id')
  const issuedApply = (context.issuedWorkOrders ?? []).find((order) => order.work_order_id === receipt.work_order_id && order.kind === 'publication_apply' && order.task?.release_hash === release.release_hash)
  if (!issuedApply) fail('publish receipt does not bind the exact issued publication_apply WorkOrder')
  const atomicBatch = object(receipt.atomic_batch, 'publish receipt atomic_batch')
  if (atomicBatch.result !== 'COMMITTED' || !sameSet(atomicBatch.article_ids ?? [], release.articles.map((article) => article.article_id))) fail('publish receipt does not prove an atomic full-bundle commit/read-current decision')
  if (!sameSet(atomicBatch.retire_article_ids ?? [], (release.retire_articles ?? []).map((article) => article.article_id))) fail('publish receipt retirement set differs from the atomic release')
  if (atomicBatch.scope !== 'd1_articles_relations_interpretations_only' || !sameSet(atomicBatch.excludes ?? [], ['r2_asset_staging', 'source_catalog_staging'])) fail('publish receipt must describe only the atomic D1 batch and explicitly exclude additive cross-service staging')
  text(atomicBatch.transaction_id, 'publish receipt atomic_batch.transaction_id')
  const originResults = array(receipt.origin_results, 'publish receipt origin_results')
  if (!originResults.length || new Set(originResults.map((entry) => entry.origin)).size !== originResults.length) fail('publish receipt origin_results must be non-empty and unique')
  if (canonicalJsonHash(originResults.map((entry) => entry.origin)) !== canonicalJsonHash(originResults.map((entry) => entry.origin).sort())) fail('publish receipt origin_results must be sorted by origin')
  for (const originResult of originResults) {
    let normalizedOrigin
    try { normalizedOrigin = new URL(text(originResult.origin, 'publish receipt origin')).href } catch { fail('publish receipt origin is invalid') }
    if (normalizedOrigin !== originResult.origin || !HASH.test(originResult.site_policy_fingerprint ?? '')) fail(`publish receipt origin ${originResult.origin} fingerprint is invalid`)
    validateOriginIndexabilityStateV1(originResult.indexability_state, `publish receipt origin ${originResult.origin}.indexability_state`)
    object(originResult.robots_txt, `publish receipt origin ${originResult.origin}.robots_txt`)
    object(originResult.sitemap_discovery, `publish receipt origin ${originResult.origin}.sitemap_discovery`)
    const deployment = object(originResult.deployment_fingerprint, `publish receipt origin ${originResult.origin}.deployment_fingerprint`)
    if (deployment.raw_html_body_hash !== null && !HASH.test(deployment.raw_html_body_hash ?? '') || !HASH.test(deployment.fingerprint ?? '') || !Array.isArray(deployment.assets) || deployment.assets.some((asset) => typeof asset.url !== 'string' || !HASH.test(asset.body_hash ?? '')) || canonicalJsonHash(deployment.assets) !== canonicalJsonHash([...deployment.assets].sort((left, right) => left.url.localeCompare(right.url))) || deployment.fingerprint !== canonicalJsonHash({ representative_url: deployment.representative_url, raw_html_body_hash: deployment.raw_html_body_hash, assets: deployment.assets })) fail(`publish receipt origin ${originResult.origin} deployment fingerprint evidence is invalid`)
  }
  const { affectedIngredientIds, badgeExpectations } = buildKnowledgeBadgeExpectationsV1(release.articles)
  const badgeReadback = validateKnowledgeBadgeReadbackV1({ badge: receipt.badge_readback, releaseHash: release.release_hash, affectedIngredientIds, badgeExpectations, receiptOrigins: originResults.map((entry) => entry.origin) })
  const results = array(receipt.article_results, 'publish receipt article_results')
  if (!sameSet(results.map((entry) => entry.article_id), release.articles.map((entry) => entry.article_id))) fail('publish receipt article set differs from release')
  for (const target of release.articles) {
    const result = results.find((entry) => entry.article_id === target.article_id)
    if (!['applied', 'already_current'].includes(result.result)) fail(`${target.article_id} publish result must be applied or already_current`)
    const changedRows = Number(result.changed_rows)
    if (result.result === 'applied' && changedRows !== 1) fail(`${target.article_id} applied must report exactly one changed row`)
    if (result.result === 'already_current' && changedRows !== 0) fail(`${target.article_id} already_current must report zero changed rows`)
    if (result.slug !== target.slug || result.target_identity !== target.article_id) fail(`${target.article_id} publish target identity differs`)
    if (canonicalJsonHash(result.write_guard) !== canonicalJsonHash(target.write_guard)) fail(`${target.article_id} publish guard differs`)
    const guard = object(result.guard_result, `${target.article_id}.guard_result`)
    if (canonicalJsonHash(guard.expected) !== canonicalJsonHash(target.write_guard)) fail(`${target.article_id} guard_result expected state differs`)
    const before = object(guard.actual_before, `${target.article_id}.guard_result.actual_before`)
    if (result.result === 'applied' && guard.outcome !== 'MATCH') fail(`${target.article_id} applied guard_result must equal MATCH`)
    if (result.result === 'applied' && target.write_guard.mode === 'create' && (before.status !== 'absent' || before.version !== 0 || before.payload_hash !== null)) fail(`${target.article_id} create guard observed an unexpected predecessor`)
    if (result.result === 'applied' && target.write_guard.mode === 'update' && (before.status !== target.write_guard.expected_status || before.version !== target.write_guard.expected_version || before.payload_hash !== target.write_guard.expected_payload_hash)) fail(`${target.article_id} update guard observed an unexpected predecessor`)
    if (result.result === 'already_current' && (guard.outcome !== 'ALREADY_CURRENT' || guard.actual?.compiled_payload_hash !== target.compiled_payload_hash)) fail(`${target.article_id} already_current needs exact current payload proof`)
    if (result.compiled_payload_hash !== target.compiled_payload_hash || result.visible_payload_hash !== target.visible_payload_hash || result.qa_payload_hash !== target.qa_payload_hash || result.render_snapshot_hash !== target.render_snapshot_hash || result.relation_hash !== target.relation_hash || result.projection_hash !== target.projection_hash || result.seo_hash !== target.seo_hash || !sameSet(result.asset_hashes ?? [], target.asset_hashes)) fail(`${target.article_id} published hashes differ from release`)
    const version = Number(result.resulting_version)
    if (!Number.isInteger(version) || version < 1) fail(`${target.article_id} resulting_version is invalid`)
    if (result.resulting_status !== target.desired_status) fail(`${target.article_id} resulting_status differs from release`)
    if (result.hydrated_dom_state !== 'HYDRATED_DOM_MATCH' || !HASH.test(result.site_policy_fingerprint ?? '')) fail(`${target.article_id} hydrated/indexability/SEO-delivery state is invalid`)
    const origin = new URL(target.seo.canonical_url).origin + '/'
    const originResult = originResults.find((entry) => entry.origin === origin && entry.site_policy_fingerprint === result.site_policy_fingerprint)
    if (!originResult) fail(`${target.article_id} site policy fingerprint does not resolve to its canonical origin`)
    validateArticleOriginIndexabilityV1(result.indexability_state, originResult.indexability_state, `${target.article_id} publish receipt indexability`)
    const rawUrl = new URL(`/wissen/${encodeURIComponent(target.slug)}`, release.public_base_url); rawUrl.searchParams.set('cfcheck', release.release_hash)
    validateRawHtmlDeliveryV1(result.raw_html, result.seo_delivery_state, { label: `${target.article_id}.raw_html`, expectedUrl: rawUrl.href })
    const sitemap = object(result.sitemap, `${target.article_id}.sitemap`)
    if (!['INCLUDED', 'NOT_INCLUDED', 'NOT_AVAILABLE'].includes(sitemap.state) || result.sitemap_state !== sitemap.state) fail(`${target.article_id} sitemap delivery state is invalid`)
    const readbacks = object(result.readbacks, `${target.article_id}.readbacks`)
    for (const kind of ['persistence', 'relations', 'public_api', 'utf8']) {
      const checkedAt = requireReadbackObject(readbacks[kind], `${target.article_id}.readbacks.${kind}`)
      if (Date.parse(checkedAt) < Date.parse(appliedAt)) fail(`${target.article_id} ${kind} readback predates apply`)
    }
    if (readbacks.persistence.actual?.target_identity !== target.article_id || readbacks.persistence.actual?.resulting_version !== version || readbacks.persistence.actual?.compiled_payload_hash !== target.compiled_payload_hash) fail(`${target.article_id} persistence readback differs`)
    if (readbacks.relations.actual?.relation_hash !== target.relation_hash || !sameSet(readbacks.relations.actual?.asset_hashes ?? [], target.asset_hashes)) fail(`${target.article_id} relation/asset readback differs`)
    const publicApi = object(readbacks.public_api.actual, `${target.article_id}.readbacks.public_api.actual`)
    validatePublicApiReadbackActualV1({ release, target, actual: publicApi })
    if (readbacks.utf8.actual?.valid_utf8 !== true || readbacks.utf8.actual?.mojibake_free !== true) fail(`${target.article_id} UTF-8 readback differs`)
    const domReadbackRequired = true
    if (domReadbackRequired) {
      const checkedAt = requireReadbackObject(readbacks.dom, `${target.article_id}.readbacks.dom`)
      if (Date.parse(checkedAt) < Date.parse(appliedAt)) fail(`${target.article_id} DOM readback predates apply`)
      const actual = readbacks.dom.actual
      if (actual?.visible_payload_hash !== target.visible_payload_hash || actual?.projection_hash !== target.projection_hash || canonicalJsonHash(actual?.projection) !== target.projection_hash || !sameSet(actual?.asset_hashes ?? [], target.asset_hashes)) fail(`${target.article_id} full DOM projection readback differs`)
    }
    const seoReadbackRequired = true
    if (seoReadbackRequired) {
      const seoCheckedAt = requireReadbackObject(readbacks.seo, `${target.article_id}.readbacks.seo`)
      const expectedSeo = { meta_title: target.seo.meta_title, meta_description: target.seo.meta_description, canonical_url: target.seo.canonical_url, canonical_path: target.seo.canonical_path, robots: target.seo.robots, indexable: target.seo.indexable, json_ld: target.seo.json_ld }
      if (Date.parse(seoCheckedAt) < Date.parse(appliedAt) || readbacks.seo.actual?.seo_hash !== target.seo_hash || canonicalJsonHash(readbacks.seo.actual?.seo) !== target.seo_hash || canonicalJsonHash(expectedSeo) !== target.seo_hash) fail(`${target.article_id} full SEO/canonical/indexability/JSON-LD readback differs`)
    }
    const deliveryReadback = object(readbacks.seo_delivery, `${target.article_id}.readbacks.seo_delivery`)
    const deliveryCheckedAt = iso(deliveryReadback.checked_at, `${target.article_id}.readbacks.seo_delivery.checked_at`)
    if (Date.parse(deliveryCheckedAt) < Date.parse(appliedAt) || !['MATCH', 'INCOMPLETE'].includes(deliveryReadback.result) || canonicalJsonHash(deliveryReadback.actual) !== canonicalJsonHash({ hydrated_dom_state: result.hydrated_dom_state, indexability_state: result.indexability_state, site_policy_fingerprint: result.site_policy_fingerprint, seo_delivery_state: result.seo_delivery_state, raw_html: result.raw_html, sitemap: result.sitemap })) fail(`${target.article_id} SEO delivery readback differs from the receipt state`)
  }
  const retirementResults = array(receipt.retirement_results ?? [], 'publish receipt retirement_results')
  const retirementTargets = release.retire_articles ?? []
  if (!sameSet(retirementResults.map((entry) => entry.article_id), retirementTargets.map((entry) => entry.article_id))) fail('publish receipt retirement result set differs from release')
  for (const target of retirementTargets) {
    const result = retirementResults.find((entry) => entry.article_id === target.article_id)
    if (!['applied', 'already_current'].includes(result.result)) fail(`${target.article_id} retirement result must be applied or already_current`)
    if (result.slug !== target.slug || result.target_identity !== target.article_id) fail(`${target.article_id} retirement identity differs`)
    if (Number(result.changed_rows) !== (result.result === 'applied' ? 1 : 0)) fail(`${target.article_id} retirement changed_rows differs from result`)
    const expectedGuard = { expected_status: target.expected_status, expected_version: target.expected_version, expected_payload_hash: target.expected_payload_hash }
    if (canonicalJsonHash(result.write_guard) !== canonicalJsonHash(expectedGuard)) fail(`${target.article_id} retirement write guard differs`)
    const guard = object(result.guard_result, `${target.article_id}.retirement.guard_result`)
    if (canonicalJsonHash(guard.expected) !== canonicalJsonHash(expectedGuard)) fail(`${target.article_id} retirement expected guard differs`)
    const before = object(guard.actual_before, `${target.article_id}.retirement.guard_result.actual_before`)
    if (result.result === 'applied' && (guard.outcome !== 'MATCH' || before.status !== target.expected_status || Number(before.version) !== target.expected_version || before.payload_hash !== target.expected_payload_hash)) fail(`${target.article_id} retirement applied predecessor differs from guard`)
    if (result.result === 'already_current' && (guard.outcome !== 'ALREADY_CURRENT' || before.status !== 'draft' || Number(before.version) !== target.expected_version + 1 || guard.reconstructed_predecessor_payload_hash !== target.expected_payload_hash)) fail(`${target.article_id} retirement already-current proof differs from guard`)
    if (result.resulting_status !== 'draft' || Number(result.resulting_version) !== target.expected_version + 1 || !HASH.test(result.resulting_payload_hash ?? '')) fail(`${target.article_id} retirement resulting state is invalid`)
    const readbacks = object(result.readbacks, `${target.article_id}.retirement.readbacks`)
    const persistenceCheckedAt = requireReadbackObject(readbacks.persistence, `${target.article_id}.retirement.readbacks.persistence`)
    const publicCheckedAt = requireReadbackObject(readbacks.public_absence, `${target.article_id}.retirement.readbacks.public_absence`)
    if (Date.parse(persistenceCheckedAt) < Date.parse(appliedAt) || Date.parse(publicCheckedAt) < Date.parse(appliedAt)) fail(`${target.article_id} retirement readback predates apply`)
    const persisted = object(readbacks.persistence.actual, `${target.article_id}.retirement.persistence.actual`)
    if (persisted.target_identity !== target.article_id || persisted.slug !== target.slug || persisted.status !== 'draft' || Number(persisted.version) !== target.expected_version + 1 || persisted.payload_hash !== result.resulting_payload_hash) fail(`${target.article_id} retirement persistence readback differs`)
    const absence = object(readbacks.public_absence.actual, `${target.article_id}.retirement.public_absence.actual`)
    const detailUrl = new URL(`/api/knowledge/${encodeURIComponent(target.slug)}`, release.public_base_url); detailUrl.searchParams.set('cfcheck', release.release_hash)
    const overviewApiUrl = new URL('/api/knowledge', release.public_base_url); overviewApiUrl.searchParams.set('cfcheck', release.release_hash)
    const overviewRouteUrl = new URL('/wissen', release.public_base_url); overviewRouteUrl.searchParams.set('cfcheck', release.release_hash)
    if (absence.detail_api?.url !== detailUrl.href || absence.detail_api?.fetch_status !== 'FETCHED' || absence.detail_api?.http_status !== 404 || absence.detail_api?.article_present !== false) fail(`${target.article_id} retired detail API readback differs`)
    if (absence.overview_api?.url !== overviewApiUrl.href || absence.overview_api?.fetch_status !== 'FETCHED' || absence.overview_api?.http_status !== 200 || absence.overview_api?.slug_present !== false) fail(`${target.article_id} retired overview API readback differs`)
    if (absence.overview_route?.url !== overviewRouteUrl.href || absence.overview_route?.fetch_status !== 'FETCHED' || absence.overview_route?.http_status !== 200 || absence.overview_route?.slug_present !== false) fail(`${target.article_id} retired /wissen readback differs`)
  }
  const indexabilityBlockers = results.filter((entry) => indexabilityNeedsReleaseV1(entry.indexability_state)).map((entry) => ({ article_id: entry.article_id, state: entry.indexability_state, site_policy_fingerprint: entry.site_policy_fingerprint })).sort((left, right) => left.article_id.localeCompare(right.article_id))
  const deliveryGaps = results.flatMap((entry) => [
    ...(indexabilityNeedsReleaseV1(entry.indexability_state) ? [{ article_id: entry.article_id, code: entry.indexability_state }] : []),
    ...(entry.seo_delivery_state === 'CLIENT_RENDERED_ONLY' ? [{ article_id: entry.article_id, code: 'CLIENT_RENDERED_ONLY' }] : []),
    ...(entry.sitemap.state !== 'INCLUDED' ? [{ article_id: entry.article_id, code: entry.sitemap.state }] : []),
  ]).sort((left, right) => `${left.article_id}:${left.code}`.localeCompare(`${right.article_id}:${right.code}`))
  return { status: 'pass', receipt, receiptHash: receipt.content_hash, indexabilityBlockers, deliveryGaps, badgeReadback, badgeMismatches: badgeReadback.mismatches, seoLiveClaim: indexabilityBlockers.length === 0 && deliveryGaps.length === 0 && badgeReadback.result === 'MATCH' }
}

export { MAX_REVISION, buildTechnicalSeo, findDuplicateLiveSeoTitleV2, normalizeVisibleSeoTextV2, projectInlineLinksV2, projectVisibleAssetV2, technicalMetaTitleV2, writeJsonAtomic, validateNumberUnitTokens }
