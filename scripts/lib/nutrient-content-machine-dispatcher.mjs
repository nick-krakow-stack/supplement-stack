import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { dirname, resolve } from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { fileURLToPath } from 'node:url'
import { canonicalJsonHash, decodeUtf8Strict, sha256Bytes } from './content-validation.mjs'
import { artifactHashV2 } from './evidence-pipeline-v2.mjs'
import { loadNutrientContentRunManifest, runNutrientContent } from './nutrient-content-runner.mjs'
import { assertContained, assertSafeId, portablePath } from './safe-paths.mjs'
import { canonicalIngredientSlug } from './content-publication-targets-v2.mjs'
import { stageArticleAssetsV1 } from './article-asset-deployment-v1.mjs'
import { buildKnowledgeBadgeExpectationsV1, knowledgeBadgeOriginMismatchKeysV1, validateKnowledgeBadgeReadbackV1 } from './knowledge-badge-readback-v1.mjs'
import { validateArticleOriginIndexabilityV1, validateRawHtmlDeliveryV1, validateOriginIndexabilityStateV1 } from './public-delivery-status-v1.mjs'
import { buildPublicApiReadbackActualV1, PUBLIC_API_READBACK_CHECKS_V1 } from './public-api-readback-v1.mjs'
import { LEGACY_FIELD_CORRECTION_MODE, normalizeLegacyCorrectionRowV1, validateLegacyFieldCorrectionReleaseV1 } from './article-correction-v1.mjs'
import { parseKnowledgeMarkdown, isKnowledgeSourceHeading } from '../../functions/lib/knowledge-markdown-blocks.mjs'
import { knowledgeInlineMarkdownToText } from '../../functions/lib/knowledge-inline-markdown.mjs'

const HASH = /^sha256:[a-f0-9]{64}$/
const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const PUBLIC_READBACK_CLI = resolve(REPO_ROOT, 'frontend/validate-knowledge-magazine-style.mjs')
const PIPELINE_INTERPRETATION_PREFIX = 'nutrient-content-v2:'
const PIPELINE_INTERPRETATION_LINEAGE_SCHEMA = 'nutrient_content_interpretation_lineage.v2'

export function rendererPublicReadbackTimeoutMs(articleCount) {
  const count = Number.isInteger(articleCount) && articleCount > 0 ? articleCount : 1
  return Math.min(900_000, Math.max(120_000, count * 12_000))
}

function fail(message) { throw new Error(message) }
function object(value, label) { if (!value || typeof value !== 'object' || Array.isArray(value)) fail(`${label} must be an object`); return value }
function array(value, label) { if (!Array.isArray(value)) fail(`${label} must be an array`); return value }
function text(value, label) { if (typeof value !== 'string' || !value.trim()) fail(`${label} must be a non-empty string`); return value.trim() }
function iso(value, label) { const result = text(value, label); if (!Number.isFinite(Date.parse(result))) fail(`${label} must be ISO-8601`); return result }
function sameSet(left, right) { const a = new Set(left), b = new Set(right); return a.size === left.length && b.size === right.length && a.size === b.size && [...a].every((entry) => b.has(entry)) }
function now() { return new Date().toISOString() }
function strictJson(path, label = path) {
  const decoded = decodeUtf8Strict(readFileSync(path), label)
  if (decoded.errors.length) fail(decoded.errors.join('; '))
  try { return JSON.parse(decoded.text) } catch (error) { fail(`${label} is invalid JSON: ${error.message}`) }
}
function writeJsonAtomic(path, value) {
  mkdirSync(dirname(path), { recursive: true })
  const temporary = `${path}.tmp-${process.pid}`
  writeFileSync(temporary, `${JSON.stringify(value, null, 2)}\n`, 'utf8')
  renameSync(temporary, path)
}
function without(value, keys) { return Object.fromEntries(Object.entries(value).filter(([key]) => !keys.includes(key))) }
function exactWorkOrderId(workOrder) { return canonicalJsonHash(without(workOrder, ['work_order_id'])) }
function normalizeUrlOrigin(value, label) {
  let parsed
  try { parsed = new URL(text(value, label)) } catch { fail(`${label} must be an HTTP(S) origin`) }
  if (!['http:', 'https:'].includes(parsed.protocol) || parsed.username || parsed.password || parsed.search || parsed.hash || parsed.pathname !== '/') fail(`${label} must be an HTTP(S) origin`)
  return parsed.href
}

function machineRepoRoot(context) {
  if (context?.mode === 'test' && context.machineRepoRoot) return resolve(context.machineRepoRoot)
  return REPO_ROOT
}

function bumpPatchVersion(value) {
  const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(text(value, 'framework catalog_version'))
  if (!match) fail('framework catalog_version must be semantic x.y.z')
  return `${match[1]}.${match[2]}.${Number(match[3]) + 1}`
}

function validateBoundInput(context, workOrder, name, { schema = null, root = null } = {}) {
  const input = workOrder.inputs.find((entry) => entry.name === name)
  if (!input || schema && input.schema !== schema || root && input.root !== root) fail(`${workOrder.kind} input ${name} binding is missing/invalid`)
  const base = input.root === 'repo' ? machineRepoRoot(context) : context.root
  const path = resolve(base, input.path)
  if (!existsSync(path) || sha256Bytes(readFileSync(path)) !== input.byte_hash) fail(`${workOrder.kind} input ${name} bytes differ from its WorkOrder binding`)
  const value = schema ? strictJson(path, `${workOrder.kind} input ${name}`) : null
  if (value && value.content_hash != null && value.content_hash !== input.content_hash) fail(`${workOrder.kind} input ${name} content hash differs from its WorkOrder binding`)
  return { input, path, value }
}

export function validateDeterministicWorkOrderV2(workOrder, { kind, runId = null } = {}) {
  object(workOrder, 'deterministic WorkOrder')
  if (workOrder.schema !== 'nutrient_content_work_order.v2' || workOrder.work_order_id !== exactWorkOrderId(workOrder)) fail('deterministic WorkOrder schema/full-contract hash is invalid')
  if (workOrder.execution_class !== 'deterministic' || workOrder.wave_index !== null) fail('deterministic WorkOrder execution class/wave is invalid')
  if (!['standard', 'high', 'xhigh'].includes(workOrder.reasoning_tier)) fail('deterministic WorkOrder reasoning_tier is invalid')
  if (workOrder.reasoning_tier !== 'standard') fail('deterministic WorkOrders must use reasoning_tier standard')
  if (workOrder.execution_receipt?.root !== 'run' || workOrder.execution_receipt?.schema !== 'work_order_execution_receipt.v1' || typeof workOrder.execution_receipt?.path !== 'string' || !workOrder.execution_receipt.path.endsWith('.work-order-execution-receipt.v1.json')) fail('deterministic WorkOrder execution_receipt binding is invalid')
  if (kind && workOrder.kind !== kind) fail(`expected deterministic WorkOrder kind ${kind}, got ${workOrder.kind}`)
  if (runId && workOrder.run_id !== runId) fail('deterministic WorkOrder run_id differs from the active run')
  return workOrder
}

function ingredientIdentity(row) {
  const identity = { ingredient_id: Number(row.id), canonical_name: row.name, canonical_slug: canonicalIngredientSlug(row.name), status: Number(row.is_active) === 1 ? 'active' : 'inactive', version: Number(row.version) }
  return { ...identity, identity_hash: canonicalJsonHash(identity) }
}

function persistedSource(row) {
  const value = {
    id: Number(row.id), ingredient_id: Number(row.ingredient_id), source_kind: row.source_kind, source_title: row.source_title, source_url: row.source_url,
    doi: row.doi ?? null, pubmed_id: row.pubmed_id ?? null, version: Number(row.version),
  }
  return { ...value, persisted_hash: canonicalJsonHash(value) }
}

function sourceLocatorIdentity(row) {
  const doi = typeof row.doi === 'string' ? row.doi.trim().toLowerCase() : null
  const pubmedId = typeof row.pubmed_id === 'string' ? row.pubmed_id.trim() : null
  return canonicalJsonHash({
    ingredient_id: Number(row.ingredient_id),
    doi,
    pubmed_id: pubmedId,
    source_url: doi == null && pubmedId == null ? row.source_url : null,
  })
}

function selectCanonicalSourceRow(rows, sourceId, authority) {
  const uniqueRows = [...new Map(rows.map((row) => [Number(row.id), row])).values()]
  if (uniqueRows.length <= 1) return uniqueRows[0] ?? null
  if (new Set(uniqueRows.map(sourceLocatorIdentity)).size !== 1) fail(`source ${sourceId} resolves ambiguously${authority ? ` ${authority}` : ''}`)
  return uniqueRows.sort((left, right) => Number(left.id) - Number(right.id))[0]
}

function articleLayer(article) { return article.article_layer ?? (article.stage === 'stage2' ? 'single_study' : 'main_article') }
// v2 assets are already frozen inside body/expected_projection. The legacy hero
// columns must stay empty so the API cannot render a second, unreviewed image.
function targetFeaturedImageUrl() { return null }
function nullSafeJson(value, label) {
  try { return JSON.parse(value) } catch { fail(`${label} is invalid JSON`) }
}
function pipelineInterpretationLineage(projection) {
  return {
    schema: PIPELINE_INTERPRETATION_LINEAGE_SCHEMA,
    local_source_id: projection.local_source_id,
    source_resolution_receipt_hash: projection.source_resolution_receipt_hash,
    projection_hash: projection.projection_hash,
  }
}
function interpretationKey(value) { return `${Number(value.ingredient_id)}:${Number(value.resolved_source_id ?? value.source_id)}` }
function exactTargetState(current, target) {
  return Boolean(current)
    && current.status === target.desired_status
    && current.stage === target.stage
    && current.article_layer === articleLayer(target)
    && current.reviewed_at === target.reviewed_at
    && current.created_at === target.published_at
    && current.updated_at === target.modified_at
    && canonicalJsonHash(current.publish_payload) === canonicalJsonHash(target.publish_payload)
    && canonicalJsonHash(current.source_relations) === canonicalJsonHash(target.source_relations)
    && canonicalJsonHash(current.source_projection) === canonicalJsonHash(target.source_projection)
    && canonicalJsonHash(current.ingredient_ids) === canonicalJsonHash(target.ingredient_ids)
    && canonicalJsonHash(current.stage2_interpretation_projection) === canonicalJsonHash(target.stage2_interpretation_projection)
    && canonicalJsonHash(publicSeo(current)) === canonicalJsonHash(publicSeo(target))
    && (current.featured_image_url ?? null) === targetFeaturedImageUrl(target)
    && (current.featured_image_r2_key ?? null) === null
    && (current.dose_min ?? null) === null
    && (current.dose_max ?? null) === null
    && (current.dose_unit ?? null) === null
    && (current.product_note ?? null) === null
}

function assertInterpretationRowsAreUnambiguous(rows, target) {
  const expectedKeys = new Set((target.stage2_interpretation_projection ?? []).map(interpretationKey))
  const grouped = new Map()
  for (const row of rows) {
    const key = `${Number(row.ingredient_id)}:${Number(row.source_id)}`
    const entries = grouped.get(key) ?? []
    entries.push(row); grouped.set(key, entries)
  }
  for (const key of expectedKeys) {
    const matches = grouped.get(key) ?? []
    if (matches.length > 1) fail(`${target.article_id} interpretation target ${key} is ambiguous (${matches.length} rows)`)
    if (matches.some((row) => !String(row.notes ?? '').startsWith(PIPELINE_INTERPRETATION_PREFIX))) fail(`${target.article_id} interpretation target ${key} conflicts with a non-pipeline-owned row`)
  }
  for (const [key, matches] of grouped) {
    const owned = matches.filter((row) => String(row.notes ?? '').startsWith(PIPELINE_INTERPRETATION_PREFIX))
    if (owned.length > 1) fail(`${target.article_id} pipeline-owned interpretation ${key} is ambiguous (${owned.length} rows)`)
  }
}

export function publicationGuardPayloadHash(article) {
  return canonicalJsonHash({
    slug: article.slug, stage: article.stage, status: article.status ?? article.desired_status,
    article_layer: articleLayer(article),
    reviewed_at: article.reviewed_at,
    published_at: article.published_at ?? article.created_at,
    modified_at: article.modified_at ?? article.updated_at,
    publish_payload: article.publish_payload, source_relations: article.source_relations ?? [], source_projection: article.source_projection ?? null,
    ingredient_ids: article.ingredient_ids ?? [], stage2_interpretation_projection: article.stage2_interpretation_projection ?? [],
  })
}

function publicSeo(article) {
  if (!article?.seo) return null
  return {
    meta_title: article.seo.meta_title, meta_description: article.seo.meta_description, canonical_url: article.seo.canonical_url,
    canonical_path: article.seo.canonical_path, robots: article.seo.robots, indexable: article.seo.indexable, json_ld: article.seo.json_ld,
  }
}

function retirementGuard(target) {
  return {
    expected_status: target.expected_status,
    expected_version: target.expected_version,
    expected_payload_hash: target.expected_payload_hash,
  }
}

function retirementAlreadyCurrent(current, target) {
  if (!current || current.slug !== target.slug || current.status !== 'draft' || current.version !== target.expected_version + 1) return false
  return publicationGuardPayloadHash({ ...current, status: target.expected_status }) === target.expected_payload_hash
}

export function validateContentReleaseForApplyV2(value) {
  const release = object(value, 'content release')
  if (release.schema !== 'content_release.v2' || release.release_hash !== canonicalJsonHash(without(release, ['release_hash']))) fail('content release schema/hash is invalid')
  if (release.atomic !== true) fail('content release must require an atomic bundle')
  normalizeUrlOrigin(release.public_base_url, 'content release public_base_url')
  const ingredientTarget = object(release.ingredient_target, 'content release ingredient_target')
  if (!Number.isInteger(ingredientTarget.ingredient_id) || ingredientTarget.ingredient_id <= 0 || ingredientTarget.status !== 'active' || !Number.isInteger(ingredientTarget.version) || ingredientTarget.version <= 0 || !HASH.test(ingredientTarget.identity_hash ?? '') || !HASH.test(ingredientTarget.receipt_hash ?? '') || !HASH.test(release.source_resolution_receipt_hash ?? '')) fail('content release ingredient/source target lineage is invalid')
  if (ingredientTarget.identity_hash !== canonicalJsonHash({ ingredient_id: ingredientTarget.ingredient_id, canonical_name: ingredientTarget.canonical_name, canonical_slug: ingredientTarget.canonical_slug, status: ingredientTarget.status, version: ingredientTarget.version })) fail('content release ingredient identity hash is stale')
  const articles = array(release.articles, 'content release articles')
  if (!articles.length || new Set(articles.map((article) => article.article_id)).size !== articles.length || new Set(articles.map((article) => article.slug)).size !== articles.length) fail('content release article IDs/slugs must be non-empty and unique')
  const retireArticles = array(release.retire_articles ?? [], 'content release retire_articles')
  if (new Set(retireArticles.map((article) => article.article_id)).size !== retireArticles.length || new Set(retireArticles.map((article) => article.slug)).size !== retireArticles.length) fail('content release retirement IDs/slugs must be unique')
  const activeIds = new Set(articles.map((article) => article.article_id)), activeSlugs = new Set(articles.map((article) => article.slug))
  for (const target of retireArticles) {
    assertSafeId(target.article_id, 'retirement article_id'); assertSafeId(target.slug, `${target.article_id}.slug`)
    if (target.expected_status !== 'published' || !Number.isInteger(target.expected_version) || target.expected_version < 1 || !HASH.test(target.expected_payload_hash ?? '')) fail(`${target.article_id} retirement guard is invalid`)
    if (target.desired_status !== 'draft' || target.target !== release.publish_target) fail(`${target.article_id} retirement status/target differs from release`)
    if (activeIds.has(target.article_id) || activeSlugs.has(target.slug)) fail(`${target.article_id} retirement identity collides with an active release article`)
  }
  const byId = new Map(articles.map((article) => [article.article_id, article]))
  const hasArticleTargets = retireArticles.length > 0 || articles.some((article) => article.write_guard?.mode === 'update')
  if (hasArticleTargets ? !HASH.test(release.article_target_receipt_hash ?? '') : release.article_target_receipt_hash != null) fail('content release article-target timestamp lineage is invalid')
  const seoTitles = new Set(), seoDescriptions = new Set()
  for (const article of articles) {
    text(article.article_id, 'release article_id'); text(article.slug, `${article.article_id}.slug`)
    iso(article.reviewed_at, `${article.article_id}.reviewed_at`)
    const publishedAt = iso(article.published_at, `${article.article_id}.published_at`)
    const modifiedAt = iso(article.modified_at, `${article.article_id}.modified_at`)
    if (Date.parse(modifiedAt) < Date.parse(publishedAt)) fail(`${article.article_id} modified_at predates published_at`)
    if (!['stage2', 'stage3'].includes(article.stage) || !['S', 'M', 'L'].includes(article.change_class)) fail(`${article.article_id} stage/change_class is invalid`)
    if (article.article_layer != null && article.article_layer !== (article.stage === 'stage2' ? 'single_study' : 'main_article')) fail(`${article.article_id} article_layer differs from its stage`)
    if (article.desired_status !== 'published' || article.target !== release.publish_target) fail(`${article.article_id} status/target differs from release`)
    object(article.write_guard, `${article.article_id}.write_guard`)
    for (const field of ['compiled_payload_hash', 'visible_payload_hash', 'qa_payload_hash', 'render_snapshot_hash', 'relation_hash', 'projection_hash', 'seo_hash']) if (!HASH.test(article[field] ?? '')) fail(`${article.article_id}.${field} is invalid`)
    if (article.projection_hash !== canonicalJsonHash(object(article.expected_projection, `${article.article_id}.expected_projection`))) fail(`${article.article_id} projection hash is stale`)
    if (article.seo_hash !== canonicalJsonHash(publicSeo(article))) fail(`${article.article_id} public SEO hash is stale`)
    if (article.seo.canonical_path !== `/wissen/${article.slug}` || new URL(article.seo.canonical_url).pathname !== article.seo.canonical_path || article.seo.robots !== 'index,follow' || article.seo.indexable !== true || article.seo.json_ld?.['@type'] !== 'Article') fail(`${article.article_id} canonical/indexability/JSON-LD contract is invalid`)
    if (article.seo.json_ld.datePublished !== publishedAt || article.seo.json_ld.dateModified !== modifiedAt) fail(`${article.article_id} JSON-LD publication timestamps differ from the frozen release`)
    const titleKey = article.seo.meta_title.normalize('NFKC').toLocaleLowerCase('de-DE')
    const descriptionKey = article.seo.meta_description.normalize('NFKC').toLocaleLowerCase('de-DE')
    if (seoTitles.has(titleKey) || seoDescriptions.has(descriptionKey)) fail('content release contains duplicate SEO title or description')
    seoTitles.add(titleKey); seoDescriptions.add(descriptionKey)
    if (!Array.isArray(article.internal_link_dependencies) || !Array.isArray(article.source_relations) || !Array.isArray(article.assets) || !Array.isArray(article.asset_hashes)) fail(`${article.article_id} relations/assets/link dependencies are invalid`)
    if (!Array.isArray(article.ingredient_ids) || !sameSet(article.ingredient_ids, [ingredientTarget.ingredient_id]) || article.ingredient_relation_hash !== canonicalJsonHash({ ingredient_ids: [ingredientTarget.ingredient_id] })) fail(`${article.article_id} ingredient relation differs from authoritative target`)
    const sourceProjection = object(article.source_projection, `${article.article_id}.source_projection`)
    if (sourceProjection.schema !== 'knowledge_article_sources_projection.v2' || sourceProjection.facts_package_hash !== article.facts_package_hash || sourceProjection.relation_hash !== article.relation_hash || !sameSet(sourceProjection.ingredient_ids ?? [], article.ingredient_ids) || canonicalJsonHash(sourceProjection.relations) !== canonicalJsonHash(article.source_relations)) fail(`${article.article_id} structured source projection differs from frozen relations/provenance`)
    const interpretations = array(article.stage2_interpretation_projection, `${article.article_id}.stage2_interpretation_projection`)
    if ((article.stage === 'stage2' && !interpretations.length) || (article.stage === 'stage3' && interpretations.length)) fail(`${article.article_id} Stage-2 interpretation projection cardinality is invalid`)
    if (new Set(interpretations.map(interpretationKey)).size !== interpretations.length || new Set(interpretations.map((entry) => entry.local_source_id)).size !== interpretations.length) fail(`${article.article_id} Stage-2 interpretation projection is ambiguous`)
    for (const interpretation of interpretations) {
      if (!article.source_relations.some((source) => source.source_id === interpretation.local_source_id) || interpretation.ingredient_id !== ingredientTarget.ingredient_id || !Number.isInteger(interpretation.resolved_source_id) || interpretation.resolved_source_id <= 0 || interpretation.knowledge_article_slug !== article.slug || interpretation.status !== 'accepted' || interpretation.source_resolution_receipt_hash !== release.source_resolution_receipt_hash || interpretation.structured_summary?.facts_package_hash !== article.facts_package_hash || interpretation.structured_summary_hash !== canonicalJsonHash(interpretation.structured_summary) || interpretation.stage3_reference_summary !== null || interpretation.projection_hash !== canonicalJsonHash(without(interpretation, ['projection_hash']))) fail(`${article.article_id} accepted interpretation is not a facts/source-bound deterministic projection`)
    }
  }
  const retirementSlugs = new Set(retireArticles.map((target) => target.slug))
  for (const article of articles) for (const dependency of article.internal_link_dependencies) {
    if (retirementSlugs.has(dependency.target_id) || retirementSlugs.has(String(dependency.path ?? '').replace(/^\/wissen\//, ''))) fail(`${article.article_id} links to a same-release retirement target`)
    if ((dependency.target_state ?? 'live') !== 'same_release') continue
    const target = byId.get(dependency.target_article_id)
    if (!target || target.slug !== dependency.target_id || dependency.path !== `/wissen/${target.slug}`) fail(`${article.article_id} same-release link is absent from the atomic bundle`)
  }
  return release
}

export function buildRendererPublicReadbackRequestV2(release, { generatedAt = now() } = {}) {
  validateContentReleaseForApplyV2(release)
  const articles = release.articles.map((article) => ({
    article_id: article.article_id, stage: article.stage, slug: article.slug,
    public_url: new URL(`/wissen/${article.slug}`, release.public_base_url).href,
    desired_status: article.desired_status, compiled_payload_hash: article.compiled_payload_hash, visible_payload_hash: article.visible_payload_hash,
    relation_hash: article.relation_hash, asset_hashes: article.asset_hashes, projection_hash: article.projection_hash, expected_projection: article.expected_projection,
    seo_hash: article.seo_hash, expected_seo: publicSeo(article),
    required_checks: (article.stage === 'stage3'
      ? ['assets', 'canonical', 'controls', 'fazit', 'h1_dek', 'indexability', 'internal_links', 'json_ld', 'left_navigation', 'projection', 'robots', 'sources', 'toc', 'ui']
      : ['assets', 'canonical', 'fazit', 'h1_dek', 'indexability', 'internal_links', 'json_ld', 'projection', 'robots', 'sources']).sort(),
  })).sort((a, b) => a.article_id.localeCompare(b.article_id))
  const { affectedIngredientIds, badgeExpectations } = buildKnowledgeBadgeExpectationsV1(release.articles)
  const base = { schema: 'renderer_public_readback_request.v2', release_hash: release.release_hash, publish_target: release.publish_target, generated_at: iso(generatedAt, 'renderer public readback generated_at'), affected_ingredient_ids: affectedIngredientIds, badge_expectations: badgeExpectations, articles }
  return { ...base, content_hash: artifactHashV2(base) }
}

export function validateRendererPublicReadbackReceiptV2(receipt, request) {
  object(receipt, 'renderer public readback receipt')
  if (receipt.schema !== 'renderer_public_readback_receipt.v2' || receipt.content_hash !== artifactHashV2(receipt) || receipt.release_hash !== request.release_hash) fail('renderer public readback receipt schema/hash/release binding is invalid')
  iso(receipt.checked_at, 'renderer public readback checked_at'); object(receipt.browser, 'renderer public readback browser')
  const originResults = array(receipt.origin_results, 'renderer public readback origin_results')
  if (!originResults.length || new Set(originResults.map((entry) => entry.origin)).size !== originResults.length) fail('renderer public readback origin_results must be non-empty and unique')
  if (canonicalJsonHash(originResults.map((entry) => entry.origin)) !== canonicalJsonHash(originResults.map((entry) => entry.origin).sort())) fail('renderer public readback origin_results must be sorted by origin')
  for (const originResult of originResults) {
    const origin = normalizeUrlOrigin(originResult.origin, 'renderer public readback origin')
    if (origin !== originResult.origin || !HASH.test(originResult.site_policy_fingerprint ?? '')) fail(`renderer origin ${origin} site policy fingerprint is invalid`)
    validateOriginIndexabilityStateV1(originResult.indexability_state, `renderer origin ${origin}.indexability_state`)
    object(originResult.robots_txt, `renderer origin ${origin}.robots_txt`)
    object(originResult.sitemap_discovery, `renderer origin ${origin}.sitemap_discovery`)
    const deployment = object(originResult.deployment_fingerprint, `renderer origin ${origin}.deployment_fingerprint`)
    if (deployment.raw_html_body_hash !== null && !HASH.test(deployment.raw_html_body_hash ?? '') || !HASH.test(deployment.fingerprint ?? '') || !Array.isArray(deployment.assets) || deployment.assets.some((asset) => typeof asset.url !== 'string' || !HASH.test(asset.body_hash ?? '')) || canonicalJsonHash(deployment.assets) !== canonicalJsonHash([...deployment.assets].sort((left, right) => left.url.localeCompare(right.url)))) fail(`renderer origin ${origin} deployment fingerprint evidence is invalid`)
    if (deployment.fingerprint !== canonicalJsonHash({ representative_url: deployment.representative_url, raw_html_body_hash: deployment.raw_html_body_hash, assets: deployment.assets })) fail(`renderer origin ${origin} deployment fingerprint hash is stale`)
  }
  const results = array(receipt.article_results, 'renderer public readback article_results')
  if (!sameSet(results.map((result) => result.article_id), request.articles.map((article) => article.article_id))) fail('renderer public readback article set differs from request')
  for (const expected of request.articles) {
    const result = results.find((entry) => entry.article_id === expected.article_id)
    if (result.result !== 'MATCH' || result.hydrated_dom_state !== 'HYDRATED_DOM_MATCH' || result.public_url !== expected.public_url || (result.mismatches ?? []).length) fail(`${expected.article_id} renderer public readback did not MATCH`)
    if (result.seo_match !== 'MATCH') fail(`${expected.article_id} renderer SEO receipt is incomplete`)
    if (!['INCLUDED', 'NOT_INCLUDED', 'NOT_AVAILABLE'].includes(result.sitemap?.state)) fail(`${expected.article_id} renderer sitemap state is invalid`)
    const expectedOrigin = new URL(expected.public_url).origin + '/'
    const originResult = originResults.find((entry) => entry.origin === expectedOrigin)
    if (!originResult || result.site_policy_fingerprint !== originResult.site_policy_fingerprint) fail(`${expected.article_id} renderer site policy fingerprint does not resolve to its origin result`)
    validateArticleOriginIndexabilityV1(result.indexability_state, originResult.indexability_state, `${expected.article_id} renderer indexability`)
    const rawUrl = new URL(expected.public_url); rawUrl.search = ''; rawUrl.searchParams.set('cfcheck', request.release_hash)
    validateRawHtmlDeliveryV1(result.raw_html, result.seo_delivery_state, { label: `${expected.article_id} renderer raw HTML`, expectedUrl: rawUrl.href })
    if (result.projection_hash !== expected.projection_hash || canonicalJsonHash(result.projection) !== expected.projection_hash || result.seo_hash !== expected.seo_hash || canonicalJsonHash(result.seo) !== expected.seo_hash || !sameSet(result.asset_hashes ?? [], expected.asset_hashes)) fail(`${expected.article_id} renderer projection/SEO/assets differ from request`)
    if (!sameSet(result.checked ?? [], expected.required_checks)) fail(`${expected.article_id} renderer checked set differs from request`)
    for (const viewportName of ['desktop', 'mobile']) {
      const viewport = result.viewports?.[viewportName]
      if (!viewport || viewport.result !== 'MATCH' || viewport.projection_hash !== expected.projection_hash || viewport.seo_hash !== expected.seo_hash || !sameSet(viewport.asset_hashes ?? [], expected.asset_hashes)) fail(`${expected.article_id} renderer ${viewportName} receipt differs from request`)
    }
  }
  validateKnowledgeBadgeReadbackV1({ badge: receipt.badge_readback, releaseHash: request.release_hash, affectedIngredientIds: request.affected_ingredient_ids, badgeExpectations: request.badge_expectations, receiptOrigins: originResults.map((entry) => entry.origin) })
  return receipt
}

function localRendererReceipt(request, adapter) {
  const checkedAt = now()
  const origin = new URL(request.articles[0].public_url).origin + '/'
  const rawHtmlBodyHash = canonicalJsonHash({ adapter: 'sqlite-projection-adapter', release_hash: request.release_hash })
  const deploymentBase = { representative_url: request.articles[0].public_url, raw_html_body_hash: rawHtmlBodyHash, assets: [] }
  const deploymentFingerprint = { ...deploymentBase, fingerprint: canonicalJsonHash(deploymentBase) }
  const originDelivery = adapter.localRendererOriginDelivery?.(request) ?? {}
  const originIndexabilityState = originDelivery.indexability_state ?? 'INDEXABLE'
  const robotsTxt = originDelivery.robots_txt ?? { url: new URL('/robots.txt', origin).href, fetch_status: 'OK', http_status: 200, body_hash: canonicalJsonHash({ local: true }), user_agent: '*', global_rule: 'ALLOW', matched_rule: null }
  const sitemapDiscovery = originDelivery.sitemap_discovery ?? { state: 'INCLUDED', checked_urls: [new URL('/sitemap.xml', origin).href] }
  const sitePolicyFingerprint = canonicalJsonHash({ origin, robots_txt: robotsTxt, sitemap_discovery: sitemapDiscovery })
  const articleResults = request.articles.map((expected) => {
    const actual = adapter.readPublicProjection(expected.article_id)
    const projectionHash = canonicalJsonHash(actual.projection)
    const seoHash = canonicalJsonHash(actual.seo)
    const mismatches = []
    if (projectionHash !== expected.projection_hash) mismatches.push('projection')
    if (seoHash !== expected.seo_hash) mismatches.push('seo')
    if (!sameSet(actual.asset_hashes, expected.asset_hashes)) mismatches.push('assets')
    const result = mismatches.length ? 'MISMATCH' : 'MATCH'
    const viewport = { result, projection_hash: projectionHash, seo_hash: seoHash, asset_hashes: actual.asset_hashes, checked: expected.required_checks, mismatches }
    const delivery = {
      indexability_state: originIndexabilityState, site_policy_fingerprint: sitePolicyFingerprint, seo_delivery_state: 'RAW_HTML_MATCH',
      raw_html: { url: `${expected.public_url}?cfcheck=${encodeURIComponent(request.release_hash)}`, fetch_status: 'FETCHED', http_status: 200, content_type: 'text/html; charset=utf-8', body_hash: rawHtmlBodyHash, title_match: true, article_text_match: true, article_json_ld_match: true, seo_delivery_state: 'RAW_HTML_MATCH' },
      sitemap: { state: 'INCLUDED', matched_url: expected.public_url, checked_urls: sitemapDiscovery.checked_urls },
      ...(adapter.localRendererDelivery?.(expected) ?? {}),
    }
    return {
      article_id: expected.article_id, public_url: expected.public_url, result, hydrated_dom_state: result === 'MATCH' ? 'HYDRATED_DOM_MATCH' : 'HYDRATED_DOM_MISMATCH', seo_match: seoHash === expected.seo_hash ? 'MATCH' : 'MISMATCH', ...delivery,
      projection: actual.projection, projection_hash: projectionHash, seo: actual.seo, seo_hash: seoHash, asset_hashes: actual.asset_hashes, checked: expected.required_checks, mismatches,
      viewports: { desktop: viewport, mobile: viewport },
    }
  })
  const badgeStatuses = adapter.readKnowledgeBadgeStatuses(request.affected_ingredient_ids)
  const statusById = new Map(badgeStatuses.map((entry) => [entry.ingredient_id, entry]))
  const statuses = request.badge_expectations.map((expectation) => {
    const actual = statusById.get(expectation.ingredient_id) ?? { ingredient_id: expectation.ingredient_id, status_present: false, has_studies: false, has_dge: false }
    return { ...actual, studies_rule: expectation.studies_rule, expected_has_studies: expectation.expected_has_studies, dge_rule: expectation.dge_rule, expected_has_dge: expectation.expected_has_dge }
  })
  const cards = statuses.map((entry) => ({ ingredient_id: entry.ingredient_id, card_match_count: entry.status_present ? 1 : 0, studies_visible: entry.has_studies, dge_visible: entry.has_dge }))
  const badgeApiUrl = new URL(`/api/knowledge?cfcheck=${encodeURIComponent(request.release_hash)}`, origin).href
  const badgeOriginEvidence = {
    origin,
    api: { url: badgeApiUrl, fetch_status: 'OK', http_status: 200, content_type: 'application/json; charset=utf-8', body_hash: canonicalJsonHash(statuses), statuses },
    hydrated_overview: { url: new URL(`/wissen?cfcheck=${encodeURIComponent(request.release_hash)}`, origin).href, viewport: { name: 'desktop', width: 1440, height: 1000 }, route_ready: true, api_request_url: badgeApiUrl, cards },
  }
  const badgeMismatches = knowledgeBadgeOriginMismatchKeysV1(badgeOriginEvidence, request.badge_expectations).sort()
  const badgeOrigin = { ...badgeOriginEvidence, result: badgeMismatches.length ? 'MISMATCH' : 'MATCH', mismatches: badgeMismatches }
  const badgeReadback = { schema: 'knowledge_badge_readback.v1', release_hash: request.release_hash, affected_ingredient_ids: request.affected_ingredient_ids, origin_results: [badgeOrigin], result: badgeOrigin.result, mismatches: badgeOrigin.mismatches }
  const base = { schema: 'renderer_public_readback_receipt.v2', release_hash: request.release_hash, checked_at: checkedAt, browser: { product: 'sqlite-projection-adapter', protocol_version: 'local.v1' }, origin_results: [{ origin, indexability_state: originIndexabilityState, robots_txt: robotsTxt, sitemap_discovery: sitemapDiscovery, deployment_fingerprint: deploymentFingerprint, site_policy_fingerprint: sitePolicyFingerprint }], article_results: articleResults, badge_readback: badgeReadback }
  return { ...base, content_hash: artifactHashV2(base) }
}

export function runRendererPublicReadbackV2({ release, adapter, requestPath, receiptPath }) {
  const request = buildRendererPublicReadbackRequestV2(release)
  writeJsonAtomic(requestPath, request)
  if (adapter.kind === 'sqlite') writeJsonAtomic(receiptPath, localRendererReceipt(request, adapter))
  else {
    if (!existsSync(PUBLIC_READBACK_CLI)) fail(`canonical renderer public readback CLI is missing: ${PUBLIC_READBACK_CLI}`)
    clearRendererPublicReadbackReceiptV2(receiptPath)
    const run = spawnSync(process.execPath, [PUBLIC_READBACK_CLI, '--input', requestPath, '--out', receiptPath], {
      shell: false,
      encoding: 'utf8',
      windowsHide: true,
      timeout: rendererPublicReadbackTimeoutMs(request.articles.length),
    })
    return { request, receipt: finalizeRendererPublicReadbackV2({ run, receiptPath, request }) }
  }
  return { request, receipt: finalizeRendererPublicReadbackV2({ run: { status: 0 }, receiptPath, request }) }
}

export function clearRendererPublicReadbackReceiptV2(receiptPath) {
  rmSync(receiptPath, { force: true })
}

export function finalizeRendererPublicReadbackV2({ run, receiptPath, request }) {
  if (run.status !== 0 && !existsSync(receiptPath)) fail(`renderer public readback failed (${run.status ?? 'signal'}): ${(run.stderr || run.stdout || '').trim()}`)
  if (!existsSync(receiptPath)) fail('renderer public readback did not produce its receipt')
  return validateRendererPublicReadbackReceiptV2(strictJson(receiptPath), request)
}

function sqliteSchema(database) {
  database.exec(`
    PRAGMA foreign_keys = ON;
    CREATE TABLE IF NOT EXISTS content_publication_articles (
      article_id TEXT PRIMARY KEY,
      slug TEXT NOT NULL UNIQUE,
      stage TEXT NOT NULL,
      article_layer TEXT NOT NULL,
      status TEXT NOT NULL,
      reviewed_at TEXT NOT NULL,
      version INTEGER NOT NULL,
      guard_payload_hash TEXT NOT NULL,
      compiled_payload_hash TEXT NOT NULL,
      visible_payload_hash TEXT NOT NULL,
      qa_payload_hash TEXT NOT NULL,
      render_snapshot_hash TEXT NOT NULL,
      relation_hash TEXT NOT NULL,
      projection_hash TEXT NOT NULL,
      seo_hash TEXT NOT NULL,
      payload_json TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS content_publication_sources (
      article_id TEXT NOT NULL,
      position INTEGER NOT NULL,
      source_id TEXT NOT NULL,
      label TEXT NOT NULL,
      url TEXT NOT NULL,
      PRIMARY KEY (article_id, position),
      FOREIGN KEY (article_id) REFERENCES content_publication_articles(article_id) ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS content_publication_ingredients (
      article_id TEXT NOT NULL,
      ingredient_id INTEGER NOT NULL,
      sort_order INTEGER NOT NULL,
      PRIMARY KEY (article_id, ingredient_id),
      FOREIGN KEY (article_id) REFERENCES content_publication_articles(article_id) ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS content_publication_interpretations (
      article_id TEXT NOT NULL,
      local_source_id TEXT NOT NULL,
      resolved_source_id INTEGER NOT NULL,
      status TEXT NOT NULL,
      projection_json TEXT NOT NULL,
      PRIMARY KEY (article_id, local_source_id),
      FOREIGN KEY (article_id) REFERENCES content_publication_articles(article_id) ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS ingredients (
      id INTEGER PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      is_active INTEGER NOT NULL CHECK (is_active IN (0,1)),
      version INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS ingredient_research_sources (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ingredient_id INTEGER NOT NULL,
      source_kind TEXT NOT NULL CHECK (source_kind IN ('official','study')),
      source_title TEXT NOT NULL,
      source_url TEXT NOT NULL,
      doi TEXT,
      pubmed_id TEXT,
      version INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (ingredient_id) REFERENCES ingredients(id) ON DELETE CASCADE
    );
  `)
  const articleColumns = database.prepare('PRAGMA table_info(content_publication_articles)').all().map((row) => row.name)
  if (!articleColumns.includes('article_layer')) database.exec("ALTER TABLE content_publication_articles ADD COLUMN article_layer TEXT NOT NULL DEFAULT 'main_article'")
  if (!articleColumns.includes('reviewed_at')) database.exec("ALTER TABLE content_publication_articles ADD COLUMN reviewed_at TEXT NOT NULL DEFAULT '1970-01-01T00:00:00.000Z'")
  if (!articleColumns.includes('created_at')) database.exec("ALTER TABLE content_publication_articles ADD COLUMN created_at TEXT NOT NULL DEFAULT '1970-01-01T00:00:00.000Z'")
}

function sqliteRow(database, articleId) {
  const row = database.prepare('SELECT * FROM content_publication_articles WHERE article_id = ?').get(articleId)
  if (!row) return null
  const payload = JSON.parse(row.payload_json)
  const sourceRelations = database.prepare('SELECT position,source_id,label,url FROM content_publication_sources WHERE article_id=? ORDER BY position').all(articleId).map((entry) => ({ position: Number(entry.position), source_id: entry.source_id, label: entry.label, url: entry.url }))
  const ingredientIds = database.prepare('SELECT ingredient_id FROM content_publication_ingredients WHERE article_id=? ORDER BY sort_order,ingredient_id').all(articleId).map((entry) => Number(entry.ingredient_id))
  const interpretationRows = database.prepare('SELECT local_source_id,resolved_source_id,status,projection_json FROM content_publication_interpretations WHERE article_id=? ORDER BY local_source_id').all(articleId)
  const interpretations = interpretationRows.map((entry) => {
    const projection = nullSafeJson(entry.projection_json, `${articleId} SQLite interpretation ${entry.local_source_id}`)
    if (projection.local_source_id !== entry.local_source_id || projection.resolved_source_id !== Number(entry.resolved_source_id) || projection.status !== entry.status || projection.projection_hash !== canonicalJsonHash(without(projection, ['projection_hash']))) fail(`${articleId} SQLite interpretation row/projection is invalid`)
    return projection
  })
  const keys = interpretations.map(interpretationKey)
  if (new Set(keys).size !== keys.length) fail(`${articleId} SQLite interpretations are ambiguous`)
  const state = {
    article_id: row.article_id, slug: row.slug, stage: row.stage, article_layer: row.article_layer, status: row.status, reviewed_at: row.reviewed_at, created_at: row.created_at, updated_at: row.updated_at, published_at: row.created_at, modified_at: row.updated_at, version: Number(row.version), payload_hash: row.guard_payload_hash,
    compiled_payload_hash: row.compiled_payload_hash, visible_payload_hash: row.visible_payload_hash, qa_payload_hash: row.qa_payload_hash,
    render_snapshot_hash: row.render_snapshot_hash, relation_hash: row.relation_hash, projection_hash: row.projection_hash, seo_hash: row.seo_hash,
    ...payload, source_relations: sourceRelations, ingredient_ids: ingredientIds, stage2_interpretation_projection: interpretations,
  }
  return { ...state, stored_guard_payload_hash: row.guard_payload_hash, payload_hash: publicationGuardPayloadHash(state) }
}

export class SqliteContentPublicationAdapter {
  constructor({ databasePath = ':memory:', authority = 'd1-readback', publicBaseUrl = 'https://supplementstack.de/' } = {}) {
    this.kind = 'sqlite'; this.authority = authority; this.publicBaseUrl = normalizeUrlOrigin(publicBaseUrl ?? 'https://supplementstack.de/', 'SQLite public base URL'); this.database = new DatabaseSync(databasePath)
    sqliteSchema(this.database)
  }

  close() { this.database.close() }

  seedIngredient({ id, name, is_active = 1, version = 1 }) {
    this.database.prepare('INSERT OR REPLACE INTO ingredients (id,name,is_active,version) VALUES (?,?,?,?)').run(id, name, is_active, version)
  }

  resolveIngredientTarget(selector) {
    const rows = this.database.prepare('SELECT id,name,is_active,version FROM ingredients WHERE lower(trim(name))=lower(trim(?)) ORDER BY id').all(selector.canonical_name)
    const matches = rows.filter((row) => canonicalIngredientSlug(row.name) === selector.substance_slug && (selector.expected_ingredient_id == null || Number(row.id) === selector.expected_ingredient_id))
    if (matches.length !== 1) fail(`ingredient target selector resolved ${matches.length} rows instead of exactly one`)
    const target = ingredientIdentity(matches[0])
    if (target.status !== 'active' || !Number.isInteger(target.version) || target.version <= 0) fail('ingredient target is inactive or unversioned')
    return target
  }

  syncSourceCatalog(request) {
    const mappings = []
    this.database.exec('BEGIN IMMEDIATE')
    try {
      for (const source of request.sources) {
        const rows = this.database.prepare(`SELECT id,ingredient_id,source_kind,source_title,source_url,doi,pubmed_id,version FROM ingredient_research_sources
          WHERE ingredient_id=? AND ((? IS NOT NULL AND lower(doi)=lower(?)) OR (? IS NOT NULL AND pubmed_id=?) OR source_url=?) ORDER BY id`).all(request.ingredient_id, source.doi, source.doi, source.pubmed_id, source.pubmed_id, source.canonical_url)
        let row = selectCanonicalSourceRow(rows, source.source_id, 'in SQLite')
        let resolution = 'existing'
        if (row) {
          if (row.doi && source.doi && row.doi.toLowerCase() !== source.doi.toLowerCase() || row.pubmed_id && source.pubmed_id && row.pubmed_id !== source.pubmed_id || row.source_url !== source.canonical_url && (row.doi == null || source.doi == null) && (row.pubmed_id == null || source.pubmed_id == null)) fail(`source ${source.source_id} identifiers conflict with existing catalog row ${row.id}`)
          const next = { doi: row.doi ?? source.doi, pubmed_id: row.pubmed_id ?? source.pubmed_id, source_title: row.source_title || source.label, source_url: row.source_url || source.canonical_url }
          if (next.doi !== row.doi || next.pubmed_id !== row.pubmed_id || next.source_title !== row.source_title || next.source_url !== row.source_url) {
            this.database.prepare('UPDATE ingredient_research_sources SET doi=?,pubmed_id=?,source_title=?,source_url=?,version=version+1,updated_at=? WHERE id=? AND version=?').run(next.doi, next.pubmed_id, next.source_title, next.source_url, now(), row.id, row.version)
            row = this.database.prepare('SELECT id,ingredient_id,source_kind,source_title,source_url,doi,pubmed_id,version FROM ingredient_research_sources WHERE id=?').get(row.id)
          }
        } else {
          const inserted = this.database.prepare('INSERT INTO ingredient_research_sources (ingredient_id,source_kind,source_title,source_url,doi,pubmed_id,version,created_at,updated_at) VALUES (?,?,?,?,?,?,1,?,?)').run(request.ingredient_id, source.source_kind, source.label, source.canonical_url, source.doi, source.pubmed_id, now(), now())
          row = this.database.prepare('SELECT id,ingredient_id,source_kind,source_title,source_url,doi,pubmed_id,version FROM ingredient_research_sources WHERE id=?').get(Number(inserted.lastInsertRowid))
          resolution = 'created'
        }
        const persisted = persistedSource(row)
        mappings.push({ source_id: source.source_id, resolved_source_id: persisted.id, resolution, canonical_url: source.canonical_url, doi: source.doi, pubmed_id: source.pubmed_id, persisted_version: persisted.version, persisted_hash: persisted.persisted_hash })
      }
      this.database.exec('COMMIT')
    } catch (error) { this.database.exec('ROLLBACK'); throw error }
    return mappings.sort((left, right) => left.source_id.localeCompare(right.source_id))
  }

  seedArticle(article, { version = 1, status = article.desired_status ?? 'published', guardPayloadHash = null } = {}) {
    const normalized = { ...article, status }
    const payloadHash = guardPayloadHash ?? publicationGuardPayloadHash(normalized)
    const createdAt = article.published_at ?? article.created_at ?? article.reviewed_at
    const updatedAt = article.modified_at ?? article.updated_at ?? createdAt
    const payload = { publish_payload: article.publish_payload, source_relations: article.source_relations ?? [], source_projection: article.source_projection ?? null, ingredient_ids: article.ingredient_ids ?? [], stage2_interpretation_projection: article.stage2_interpretation_projection ?? [], assets: article.assets ?? [], asset_hashes: article.asset_hashes ?? [], expected_projection: article.expected_projection, seo: article.seo }
    this.database.prepare(`INSERT OR REPLACE INTO content_publication_articles
      (article_id,slug,stage,article_layer,status,reviewed_at,version,guard_payload_hash,compiled_payload_hash,visible_payload_hash,qa_payload_hash,render_snapshot_hash,relation_hash,projection_hash,seo_hash,payload_json,created_at,updated_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(article.article_id, article.slug, article.stage, articleLayer(article), status, article.reviewed_at, version, payloadHash, article.compiled_payload_hash, article.visible_payload_hash, article.qa_payload_hash, article.render_snapshot_hash, article.relation_hash, article.projection_hash, article.seo_hash, JSON.stringify(payload), createdAt, updatedAt)
    this.#replaceSources(article.article_id, payload.source_relations)
    this.#replaceIngredientRelations(article.article_id, payload.ingredient_ids)
    this.#replaceInterpretations(article.article_id, payload.stage2_interpretation_projection)
  }

  #replaceSources(articleId, sources) {
    this.database.prepare('DELETE FROM content_publication_sources WHERE article_id = ?').run(articleId)
    const insert = this.database.prepare('INSERT INTO content_publication_sources (article_id,position,source_id,label,url) VALUES (?,?,?,?,?)')
    for (const source of sources) insert.run(articleId, source.position, source.source_id, source.label, source.url)
  }

  #replaceIngredientRelations(articleId, ingredientIds) {
    this.database.prepare('DELETE FROM content_publication_ingredients WHERE article_id = ?').run(articleId)
    const insert = this.database.prepare('INSERT INTO content_publication_ingredients (article_id,ingredient_id,sort_order) VALUES (?,?,?)')
    ingredientIds.forEach((ingredientId, index) => insert.run(articleId, ingredientId, index))
  }

  #replaceInterpretations(articleId, interpretations) {
    this.database.prepare('DELETE FROM content_publication_interpretations WHERE article_id = ?').run(articleId)
    const insert = this.database.prepare('INSERT INTO content_publication_interpretations (article_id,local_source_id,resolved_source_id,status,projection_json) VALUES (?,?,?,?,?)')
    for (const interpretation of interpretations) insert.run(articleId, interpretation.local_source_id, interpretation.resolved_source_id, interpretation.status, JSON.stringify(interpretation))
  }

  readRoutes() {
    const rows = this.database.prepare("SELECT a.slug, a.article_layer, json_extract(a.payload_json, '$.publish_payload.title') AS title, COALESCE(json_extract(a.payload_json, '$.seo.meta_title'),json_extract(a.payload_json, '$.publish_payload.title')) AS meta_title, COALESCE(json_extract(a.payload_json, '$.seo.meta_description'),json_extract(a.payload_json, '$.publish_payload.dek')) AS meta_description, s.url AS source_url FROM content_publication_articles a LEFT JOIN content_publication_sources s ON s.article_id=a.article_id WHERE a.status = 'published' ORDER BY a.slug,s.position,s.source_id").all()
    const routes = new Map()
    for (const row of rows) {
      if (!routes.has(row.slug)) routes.set(row.slug, { path: `/wissen/${row.slug}`, slug: row.slug, title: row.title, meta_title: row.meta_title, meta_description: row.meta_description, article_layer: row.article_layer, source_urls: [] })
      if (row.source_url != null && !routes.get(row.slug).source_urls.includes(row.source_url)) routes.get(row.slug).source_urls.push(row.source_url)
    }
    return [...routes.values()]
  }

  inspectArticles(articleIds) { return Object.fromEntries(articleIds.map((id) => [id, sqliteRow(this.database, id)])) }

  readArticleTargets(selectors) {
    const current = this.inspectArticles(selectors.map((entry) => entry.article_id))
    return selectors.map((selector) => {
      const row = current[selector.article_id]
      if (!row) fail(`${selector.article_id} update target is missing from SQLite persistence`)
      return { article_id: selector.article_id, slug: row.slug, status: row.status, version: row.version, payload_hash: row.payload_hash, created_at: row.created_at, updated_at: row.updated_at }
    })
  }

  applyAtomicRelease(release) {
    const retireArticles = release.retire_articles ?? []
    const targetIds = [...release.articles.map((article) => article.article_id), ...retireArticles.map((article) => article.article_id)]
    const before = this.inspectArticles(targetIds)
    const decisions = []
    for (const target of release.articles) {
      const current = before[target.article_id]
      const alreadyCurrent = exactTargetState(current, target)
        && current.compiled_payload_hash === target.compiled_payload_hash
        && current.visible_payload_hash === target.visible_payload_hash
        && current.relation_hash === target.relation_hash
        && current.projection_hash === target.projection_hash
        && current.seo_hash === target.seo_hash
      if (alreadyCurrent) { decisions.push({ target, current, result: 'already_current' }); continue }
      if (target.write_guard.mode === 'create') {
        if (current) fail(`${target.article_id} create guard expected absent but found version ${current.version}`)
      } else if (!current || current.status !== target.write_guard.expected_status || current.version !== target.write_guard.expected_version || current.payload_hash !== target.write_guard.expected_payload_hash) fail(`${target.article_id} update guard differs from SQLite persistence`)
      decisions.push({ target, current, result: 'applied' })
    }
    const retirementDecisions = []
    for (const target of retireArticles) {
      const current = before[target.article_id]
      if (retirementAlreadyCurrent(current, target)) { retirementDecisions.push({ target, current, result: 'already_current' }); continue }
      if (!current || current.slug !== target.slug || current.status !== target.expected_status || current.version !== target.expected_version || current.payload_hash !== target.expected_payload_hash) fail(`${target.article_id} retirement guard differs from SQLite persistence`)
      retirementDecisions.push({ target, current, result: 'applied' })
    }
    const transactionId = `sqlite-${release.release_hash.slice(-16)}-${Date.now()}`
    this.database.exec('BEGIN IMMEDIATE')
    try {
      for (const decision of decisions.filter((entry) => entry.result === 'applied')) {
        const { target, current } = decision
        const version = current ? current.version + 1 : 1
        const payload = { publish_payload: target.publish_payload, source_relations: target.source_relations, source_projection: target.source_projection, ingredient_ids: target.ingredient_ids, stage2_interpretation_projection: target.stage2_interpretation_projection, assets: target.assets, asset_hashes: target.asset_hashes, expected_projection: target.expected_projection, seo: target.seo }
        const guardPayloadHash = publicationGuardPayloadHash({ ...target, status: target.desired_status })
        this.database.prepare(`INSERT INTO content_publication_articles
          (article_id,slug,stage,article_layer,status,reviewed_at,version,guard_payload_hash,compiled_payload_hash,visible_payload_hash,qa_payload_hash,render_snapshot_hash,relation_hash,projection_hash,seo_hash,payload_json,created_at,updated_at)
          VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
          ON CONFLICT(article_id) DO UPDATE SET slug=excluded.slug,stage=excluded.stage,article_layer=excluded.article_layer,status=excluded.status,reviewed_at=excluded.reviewed_at,version=excluded.version,guard_payload_hash=excluded.guard_payload_hash,compiled_payload_hash=excluded.compiled_payload_hash,visible_payload_hash=excluded.visible_payload_hash,qa_payload_hash=excluded.qa_payload_hash,render_snapshot_hash=excluded.render_snapshot_hash,relation_hash=excluded.relation_hash,projection_hash=excluded.projection_hash,seo_hash=excluded.seo_hash,payload_json=excluded.payload_json,created_at=excluded.created_at,updated_at=excluded.updated_at`).run(target.article_id, target.slug, target.stage, articleLayer(target), target.desired_status, target.reviewed_at, version, guardPayloadHash, target.compiled_payload_hash, target.visible_payload_hash, target.qa_payload_hash, target.render_snapshot_hash, target.relation_hash, target.projection_hash, target.seo_hash, JSON.stringify(payload), target.published_at, target.modified_at)
        this.#replaceSources(target.article_id, target.source_relations)
        this.#replaceIngredientRelations(target.article_id, target.ingredient_ids)
        this.#replaceInterpretations(target.article_id, target.stage2_interpretation_projection)
      }
      for (const { target, current, result } of retirementDecisions) {
        if (result !== 'applied') continue
        const retiredPayloadHash = publicationGuardPayloadHash({ ...current, status: 'draft' })
        const changed = this.database.prepare('UPDATE content_publication_articles SET status=?,version=version+1,guard_payload_hash=? WHERE article_id=? AND slug=? AND status=? AND version=? AND guard_payload_hash=?').run('draft', retiredPayloadHash, target.article_id, target.slug, target.expected_status, target.expected_version, target.expected_payload_hash)
        if (Number(changed.changes) !== 1) fail(`${target.article_id} retirement exact SQLite write guard failed`)
      }
      this.database.exec('COMMIT')
    } catch (error) { this.database.exec('ROLLBACK'); throw error }
    const after = this.inspectArticles(targetIds)
    return { transaction_id: transactionId, before, after, decisions, retirementDecisions }
  }

  rollbackAtomic(transaction) {
    this.database.exec('BEGIN IMMEDIATE')
    try {
      for (const decision of transaction.decisions.filter((entry) => entry.result === 'applied')) {
        const snapshot = transaction.before[decision.target.article_id]
        this.database.prepare('DELETE FROM content_publication_articles WHERE article_id = ?').run(decision.target.article_id)
        if (snapshot) this.seedArticle(snapshot, { version: snapshot.version, status: snapshot.status, guardPayloadHash: snapshot.payload_hash })
      }
      for (const decision of (transaction.retirementDecisions ?? []).filter((entry) => entry.result === 'applied')) {
        const before = transaction.before[decision.target.article_id], after = transaction.after[decision.target.article_id]
        const changed = this.database.prepare('UPDATE content_publication_articles SET status=?,version=?,guard_payload_hash=? WHERE article_id=? AND slug=? AND status=? AND version=? AND guard_payload_hash=?').run(before.status, before.version, before.payload_hash, decision.target.article_id, decision.target.slug, after.status, after.version, after.payload_hash)
        if (Number(changed.changes) !== 1) fail(`${decision.target.article_id} retirement SQLite rollback guard failed`)
      }
      this.database.exec('COMMIT')
    } catch (error) { this.database.exec('ROLLBACK'); throw error }
  }

  readPublicProjection(articleId) {
    const row = sqliteRow(this.database, articleId)
    if (!row) fail(`public SQLite projection ${articleId} is missing`)
    return { projection: row.expected_projection, seo: publicSeo(row), asset_hashes: row.asset_hashes }
  }

  readKnowledgeBadgeStatuses(ingredientIds) {
    return ingredientIds.map((ingredientId) => {
      const relation = this.database.prepare('SELECT 1 AS present FROM content_publication_ingredients WHERE ingredient_id=? LIMIT 1').get(ingredientId)
      const study = this.database.prepare(`SELECT 1 AS present
        FROM content_publication_articles a
        JOIN content_publication_ingredients ai ON ai.article_id=a.article_id AND ai.ingredient_id=?
        JOIN content_publication_interpretations i ON i.article_id=a.article_id AND i.status='accepted'
        WHERE a.status='published' AND a.article_layer='single_study'
        LIMIT 1`).get(ingredientId)
      return { ingredient_id: ingredientId, status_present: Boolean(relation), has_studies: Boolean(study), has_dge: false }
    })
  }

  async readPublicArticle(target, releaseHash) {
    const row = sqliteRow(this.database, target.article_id)
    if (!row) fail(`public SQLite article ${target.article_id} is missing`)
    const url = new URL(`/api/knowledge/${encodeURIComponent(target.slug)}`, target.seo.canonical_url); url.searchParams.set('cfcheck', releaseHash)
    return { url: url.href, release_hash: releaseHash, fetch_status: 'FETCHED', http_status: 200, content_type: 'application/json; charset=utf-8', body_hash: canonicalJsonHash({ ...row.publish_payload, seo: row.seo }), publish_payload: row.publish_payload, seo: publicSeo(row), reviewed_at: row.reviewed_at, created_at: row.created_at, updated_at: row.updated_at, source_relations: row.source_relations, ingredient_ids: row.ingredient_ids, stage2_interpretation_projection: target.stage === 'stage2' ? row.stage2_interpretation_projection : null, legacy_visible_fields: { featured_image_url: null, dose_min: null, dose_max: null, dose_unit: null, product_note: null }, raw: { ...row.publish_payload, seo: row.seo } }
  }

  async readRetiredArticlePublicState(target, releaseHash) {
    const row = sqliteRow(this.database, target.article_id)
    const routePresent = this.readRoutes().some((route) => route.slug === target.slug)
    const detailUrl = new URL(`/api/knowledge/${encodeURIComponent(target.slug)}`, this.publicBaseUrl); detailUrl.searchParams.set('cfcheck', releaseHash)
    const overviewApiUrl = new URL('/api/knowledge', this.publicBaseUrl); overviewApiUrl.searchParams.set('cfcheck', releaseHash)
    const overviewRouteUrl = new URL('/wissen', this.publicBaseUrl); overviewRouteUrl.searchParams.set('cfcheck', releaseHash)
    return {
      detail_api: { url: detailUrl.href, fetch_status: 'FETCHED', http_status: row?.status === 'published' ? 200 : 404, article_present: row?.status === 'published' },
      overview_api: { url: overviewApiUrl.href, fetch_status: 'FETCHED', http_status: 200, slug_present: routePresent },
      overview_route: { url: overviewRouteUrl.href, fetch_status: 'FETCHED', http_status: 200, slug_present: routePresent },
    }
  }

}

function d1Rows(response, index = 0) {
  const result = Array.isArray(response.result) ? response.result[index] : response.result
  if (!response.success || !result?.success) fail(`Cloudflare D1 query failed: ${JSON.stringify(response.errors ?? result?.error ?? [])}`)
  return result.results ?? []
}

const LEGACY_CORRECTION_TABLES = [
  { key: 'article', table: 'knowledge_articles', column: 'slug', order: 'slug' },
  { key: 'source_rows', table: 'knowledge_article_sources', column: 'article_slug', order: 'article_slug,sort_order,id' },
  { key: 'ingredient_rows', table: 'knowledge_article_ingredients', column: 'article_slug', order: 'article_slug,sort_order,ingredient_id' },
  { key: 'interpretation_rows', table: 'study_interpretation_records', column: 'knowledge_article_slug', order: 'knowledge_article_slug,source_id,id' },
  { key: 'part_rows', table: 'knowledge_article_parts', column: 'article_slug', order: 'article_slug,ingredient_id,part_id' },
]

function legacySnapshotGuards(slug, snapshot) {
  if (!snapshot?.article) fail(`${slug} has no exact legacy snapshot`)
  const guards = []
  for (const { key, table, column } of LEGACY_CORRECTION_TABLES) {
    const rows = key === 'article' ? [snapshot.article] : snapshot[key]
    if (!Array.isArray(rows)) fail(`${slug} legacy ${key} snapshot is missing`)
    guards.push({ sql: `SELECT CASE WHEN (SELECT COUNT(*) FROM ${table} WHERE ${column}=?)=? THEN 1 ELSE json_extract('legacy-snapshot-count-failed','$') END AS exact_snapshot_count`, params: [slug, rows.length] })
    for (const row of rows) {
      const keys = Object.keys(row)
      if (!keys.length || keys.some((name) => !/^[a-z][a-z0-9_]*$/.test(name))) fail('legacy snapshot contains an unsafe SQL column')
      guards.push({ sql: `SELECT CASE WHEN (SELECT COUNT(*) FROM ${table} WHERE ${keys.map((name) => `${name} IS ?`).join(' AND ')})=1 THEN 1 ELSE json_extract('legacy-snapshot-row-failed','$') END AS exact_snapshot_row`, params: keys.map((name) => row[name]) })
    }
  }
  return guards
}

function legacyCorrectionAlreadyCurrent(snapshot, target, input) {
  if (!snapshot?.article || snapshot.article.version !== target.before.article.version + 1 || snapshot.article.update_reason !== input.update_reason
    || !Number.isFinite(Date.parse(snapshot.article.updated_at)) || Date.parse(snapshot.article.updated_at) < Date.parse(input.frozen_at)) return false
  const expected = { ...target.before, article: { ...target.candidate_row, version: snapshot.article.version, updated_at: snapshot.article.updated_at, update_reason: input.update_reason } }
  return canonicalJsonHash(snapshot) === canonicalJsonHash(expected)
}

export class CloudflareD1ContentPublicationAdapter {
  constructor({ accountId, databaseId, apiToken, publicBaseUrl, legacyDomReadback = null }) {
    this.kind = 'cloudflare-d1'; this.authority = 'd1-readback'
    this.publicReadbackRetry = { attempts: 10, delayMs: 500 }
    this.accountId = text(accountId, 'Cloudflare account id'); this.databaseId = text(databaseId, 'Cloudflare D1 database id'); this.apiToken = text(apiToken, 'Cloudflare API token')
    this.publicBaseUrl = normalizeUrlOrigin(publicBaseUrl, 'Cloudflare public base URL')
    if (legacyDomReadback !== null && typeof legacyDomReadback !== 'function') fail('legacy DOM readback adapter must be a function')
    this.legacyDomReadback = legacyDomReadback
    this.endpoint = `https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(this.accountId)}/d1/database/${encodeURIComponent(this.databaseId)}/query`
  }

  async query(body) {
    const response = await fetch(this.endpoint, { method: 'POST', headers: { Authorization: `Bearer ${this.apiToken}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    let value
    try { value = await response.json() } catch { fail(`Cloudflare D1 returned non-JSON HTTP ${response.status}`) }
    if (!response.ok || value.success !== true) fail(`Cloudflare D1 HTTP/API error ${response.status}: ${(value.errors ?? []).map((error) => error.message).join('; ')}`)
    if (Array.isArray(value.result) && value.result.some((entry) => entry?.success !== true)) fail(`Cloudflare D1 transactional batch failed: ${JSON.stringify(value.result.filter((entry) => entry?.success !== true).map((entry) => entry?.error ?? entry))}`)
    return value
  }

  async readLegacyFieldCorrectionSnapshots(targets) {
    if (!targets.length || targets.length > 6 || new Set(targets.map((target) => target.slug)).size !== targets.length) fail('legacy snapshot requires 1..6 exact distinct targets')
    const slugs = targets.map((target) => assertSafeId(target.slug, 'legacy snapshot slug'))
    const placeholders = slugs.map(() => '?').join(',')
    const response = await this.query({ batch: LEGACY_CORRECTION_TABLES.map(({ table, column, order }) => ({
      sql: `SELECT * FROM ${table} WHERE ${column} IN (${placeholders}) ORDER BY ${order}`, params: slugs,
    })) })
    const result = {}
    for (const slug of slugs) {
      const snapshot = {}
      LEGACY_CORRECTION_TABLES.forEach(({ key, column }, index) => {
        const rows = d1Rows(response, index).filter((row) => row[column] === slug)
        if (key === 'article') {
          if (rows.length !== 1) fail(`${slug} legacy snapshot found ${rows.length} articles instead of one`)
          snapshot.article = normalizeLegacyCorrectionRowV1(rows[0])
        } else snapshot[key] = rows
      })
      result[slug] = snapshot
    }
    return result
  }

  async readLegacyFieldCorrectionDom(release) {
    if (this.legacyDomReadback) return this.legacyDomReadback(release)
    const { collectLegacyCorrectionDomV1 } = await import('../../frontend/validate-knowledge-magazine-style.mjs')
    return collectLegacyCorrectionDomV1(release.articles.map(target => ({ article_id: target.article_id, slug: target.slug,
      article_layer: target.before.article.article_layer, public_url: new URL(`/wissen/${target.slug}`, release.public_base_url).href })), release.release_hash)
  }

  async applyAtomicLegacyFieldCorrection(release, { appliedAt, before }) {
    if (this.databaseId !== release.database_id || this.publicBaseUrl !== normalizeUrlOrigin(release.public_base_url, 'legacy public base URL')) fail('legacy publication adapter target/origin differs from the frozen release')
    const batch = [], decisions = [], expectedAfter = {}
    for (const target of release.articles) {
      const current = before[target.slug]
      if (canonicalJsonHash(current) === target.before_hash) {
        decisions.push({ slug: target.slug, result: 'applied' })
        expectedAfter[target.slug] = { ...target.before, article: { ...target.candidate_row, version: target.before.article.version + 1, updated_at: appliedAt, update_reason: release.input.update_reason } }
      } else if (legacyCorrectionAlreadyCurrent(current, target, release.input)) {
        decisions.push({ slug: target.slug, result: 'already_current' })
        expectedAfter[target.slug] = current
      } else fail(`${target.slug} authoritative legacy prestate/version/status/relations differs`)
      batch.push(...legacySnapshotGuards(target.slug, current))
    }
    for (const target of release.articles) {
      if (decisions.find((entry) => entry.slug === target.slug).result === 'already_current') continue
      const assignments = target.fields.map((patch) => `${patch.field}=?`).join(',')
      batch.push({ sql: `UPDATE knowledge_articles SET ${assignments},version=version+1,updated_at=?,update_reason=? WHERE slug=? AND status=? AND version=? AND article_layer=?`,
        params: [...target.fields.map((patch) => patch.after), appliedAt, release.input.update_reason, target.slug, target.before.article.status, target.before.article.version, target.before.article.article_layer] })
      batch.push({ sql: "SELECT CASE WHEN changes()=1 THEN 1 ELSE json_extract('legacy-correction-write-count-failed','$') END AS exact_changed_row" })
    }
    // Validate the complete resulting rows and untouched relations inside the same transaction.
    for (const target of release.articles) batch.push(...legacySnapshotGuards(target.slug, expectedAfter[target.slug]))
    await this.query({ batch })
    const after = await this.readLegacyFieldCorrectionSnapshots(release.articles)
    if (canonicalJsonHash(after) !== canonicalJsonHash(expectedAfter)) fail('legacy correction D1 content readback differs after atomic batch')
    return { before, after, decisions, transaction_id: `d1-legacy-${release.release_hash.slice(-16)}-${Date.now()}` }
  }

  async readRoutes() {
    const response = await this.query({ sql: "SELECT ka.slug,ka.title,COALESCE(json_extract(ka.seo_json,'$.meta_title'),ka.title) AS meta_title,COALESCE(json_extract(ka.seo_json,'$.meta_description'),ka.summary) AS meta_description,ka.article_layer,kas.url AS source_url FROM knowledge_articles ka LEFT JOIN knowledge_article_sources kas ON kas.article_slug=ka.slug WHERE ka.status='published' ORDER BY ka.slug,kas.sort_order,kas.id" })
    const routes = new Map()
    for (const row of d1Rows(response)) {
      if (!routes.has(row.slug)) routes.set(row.slug, { path: `/wissen/${row.slug}`, slug: row.slug, title: row.title, meta_title: row.meta_title, meta_description: row.meta_description, article_layer: row.article_layer, source_urls: [] })
      if (row.source_url != null && !routes.get(row.slug).source_urls.includes(row.source_url)) routes.get(row.slug).source_urls.push(row.source_url)
    }
    return [...routes.values()]
  }

  async resolveIngredientTarget(selector) {
    const response = await this.query({ sql: 'SELECT id,name,is_active,version FROM ingredients WHERE lower(trim(name))=lower(trim(?)) ORDER BY id', params: [selector.canonical_name] })
    const matches = d1Rows(response).filter((row) => canonicalIngredientSlug(row.name) === selector.substance_slug && (selector.expected_ingredient_id == null || Number(row.id) === selector.expected_ingredient_id))
    if (matches.length !== 1) fail(`ingredient target selector resolved ${matches.length} D1 rows instead of exactly one`)
    const target = ingredientIdentity(matches[0])
    if (target.status !== 'active' || !Number.isInteger(target.version) || target.version <= 0) fail('ingredient target is inactive or unversioned in D1')
    return target
  }

  async syncSourceCatalog(request) {
    const mappings = []
    const selectSql = `SELECT id,ingredient_id,source_kind,source_title,source_url,doi,pubmed_id,version FROM ingredient_research_sources
      WHERE ingredient_id=? AND ((? IS NOT NULL AND lower(doi)=lower(?)) OR (? IS NOT NULL AND pubmed_id=?) OR source_url=?) ORDER BY id`
    const paramsFor = (source) => [request.ingredient_id, source.doi, source.doi, source.pubmed_id, source.pubmed_id, source.canonical_url]
    for (const source of request.sources) {
      let rows = d1Rows(await this.query({ sql: selectSql, params: paramsFor(source) }))
      let row = selectCanonicalSourceRow(rows, source.source_id, 'in D1')
      let resolution = 'existing'
      if (!row) {
        const response = await this.query({ batch: [
          { sql: `INSERT INTO ingredient_research_sources (ingredient_id,source_kind,source_title,source_url,doi,pubmed_id,version,created_at,updated_at)
              SELECT ?,?,?,?,?,?,1,datetime('now'),datetime('now')
              WHERE NOT EXISTS (SELECT 1 FROM ingredient_research_sources WHERE ingredient_id=? AND ((? IS NOT NULL AND lower(doi)=lower(?)) OR (? IS NOT NULL AND pubmed_id=?) OR source_url=?))`, params: [request.ingredient_id, source.source_kind, source.label, source.canonical_url, source.doi, source.pubmed_id, ...paramsFor(source)] },
          { sql: selectSql, params: paramsFor(source) },
        ] })
        rows = d1Rows(response, 1)
        row = selectCanonicalSourceRow(rows, source.source_id, 'in D1 after idempotent upsert')
        resolution = 'created'
      }
      if (!row) fail(`source ${source.source_id} did not resolve to a D1 row after idempotent upsert`)
      if (row.doi && source.doi && row.doi.toLowerCase() !== source.doi.toLowerCase() || row.pubmed_id && source.pubmed_id && row.pubmed_id !== source.pubmed_id || row.source_url !== source.canonical_url && (row.doi == null || source.doi == null) && (row.pubmed_id == null || source.pubmed_id == null)) fail(`source ${source.source_id} identifiers conflict with D1 row ${row.id}`)
      const next = { doi: row.doi ?? source.doi, pubmed_id: row.pubmed_id ?? source.pubmed_id, source_title: row.source_title || source.label, source_url: row.source_url || source.canonical_url }
      if (next.doi !== row.doi || next.pubmed_id !== row.pubmed_id || next.source_title !== row.source_title || next.source_url !== row.source_url) {
        const response = await this.query({ batch: [
          { sql: 'UPDATE ingredient_research_sources SET doi=?,pubmed_id=?,source_title=?,source_url=?,version=version+1,updated_at=datetime(\'now\') WHERE id=? AND version=?', params: [next.doi, next.pubmed_id, next.source_title, next.source_url, row.id, row.version] },
          { sql: "SELECT CASE WHEN changes()=1 THEN 1 ELSE json_extract('source-update-guard-failed','$') END AS exact_source_guard" },
          { sql: 'SELECT id,ingredient_id,source_kind,source_title,source_url,doi,pubmed_id,version FROM ingredient_research_sources WHERE id=?', params: [row.id] },
        ] })
        row = d1Rows(response, 2)[0]
      }
      const persisted = persistedSource(row)
      mappings.push({ source_id: source.source_id, resolved_source_id: persisted.id, resolution, canonical_url: source.canonical_url, doi: source.doi, pubmed_id: source.pubmed_id, persisted_version: persisted.version, persisted_hash: persisted.persisted_hash })
    }
    return mappings.sort((left, right) => left.source_id.localeCompare(right.source_id))
  }

  async inspectArticlesByTargets(targets) {
    if (!targets.length) return {}
    const slugs = targets.map((target) => target.slug)
    const placeholders = slugs.map(() => '?').join(',')
    const response = await this.query({ batch: [
      { sql: `SELECT slug,title,summary,body,status,version,article_layer,conclusion,featured_image_url,featured_image_r2_key,dose_min,dose_max,dose_unit,product_note,reviewed_at,created_at,updated_at,sources_json,seo_json FROM knowledge_articles WHERE slug IN (${placeholders})`, params: slugs },
      { sql: `SELECT id,article_slug,label,url,sort_order,created_at,updated_at FROM knowledge_article_sources WHERE article_slug IN (${placeholders}) ORDER BY article_slug,sort_order,id`, params: slugs },
      { sql: `SELECT article_slug,ingredient_id,sort_order,created_at FROM knowledge_article_ingredients WHERE article_slug IN (${placeholders}) ORDER BY article_slug,sort_order,ingredient_id`, params: slugs },
      { sql: `SELECT id,ingredient_id,source_id,research_artifact_id,knowledge_article_slug,status,structured_summary_json,stage3_reference_summary,notes,review_notes,version,created_at,updated_at FROM study_interpretation_records WHERE knowledge_article_slug IN (${placeholders}) ORDER BY knowledge_article_slug,source_id,id`, params: slugs },
    ] })
    const rows = d1Rows(response, 0), relationRows = d1Rows(response, 1), ingredientRows = d1Rows(response, 2), interpretationRows = d1Rows(response, 3)
    const targetBySlug = new Map(targets.map((target) => [target.slug, target]))
    const result = {}
    for (const row of rows) {
      const target = targetBySlug.get(row.slug)
      if (!target) continue
      const persistedSources = relationRows.filter((entry) => entry.article_slug === row.slug)
      const persistedIngredients = ingredientRows.filter((entry) => entry.article_slug === row.slug)
      const persistedInterpretations = interpretationRows.filter((entry) => entry.knowledge_article_slug === row.slug)
      assertInterpretationRowsAreUnambiguous(persistedInterpretations, target)
      let sourceProjection = null
      try {
        const parsed = JSON.parse(row.sources_json ?? 'null')
        if (parsed?.schema === 'knowledge_article_sources_projection.v2' && Array.isArray(parsed.relations)) sourceProjection = parsed
      } catch {}
      const projectedByPosition = new Map((sourceProjection?.relations ?? []).map((entry) => [Number(entry.position), entry]))
      const sourceRelations = persistedSources.map((entry) => {
        const projected = projectedByPosition.get(Number(entry.sort_order))
        return { position: Number(entry.sort_order), source_id: projected?.source_id ?? `legacy-source-${Number(entry.sort_order) + 1}`, label: entry.label, url: entry.url }
      })
      const ownedInterpretations = persistedInterpretations.filter((entry) => String(entry.notes ?? '').startsWith(PIPELINE_INTERPRETATION_PREFIX)).map((entry) => {
        const structuredSummary = nullSafeJson(entry.structured_summary_json, `${target.article_id} interpretation ${entry.id} structured_summary_json`)
        const lineage = nullSafeJson(entry.review_notes, `${target.article_id} interpretation ${entry.id} review_notes`)
        if (lineage.schema !== PIPELINE_INTERPRETATION_LINEAGE_SCHEMA || !HASH.test(lineage.projection_hash ?? '') || !HASH.test(lineage.source_resolution_receipt_hash ?? '') || entry.notes !== `${PIPELINE_INTERPRETATION_PREFIX}${lineage.projection_hash}`) fail(`${target.article_id} pipeline interpretation ${entry.id} lineage is invalid`)
        const projection = {
          ingredient_id: Number(entry.ingredient_id), local_source_id: lineage.local_source_id, resolved_source_id: Number(entry.source_id), knowledge_article_slug: entry.knowledge_article_slug,
          status: entry.status, structured_summary: structuredSummary, structured_summary_hash: canonicalJsonHash(structuredSummary), stage3_reference_summary: entry.stage3_reference_summary ?? null,
          source_resolution_receipt_hash: lineage.source_resolution_receipt_hash, projection_hash: lineage.projection_hash,
        }
        if (projection.projection_hash !== canonicalJsonHash(without(projection, ['projection_hash']))) fail(`${target.article_id} pipeline interpretation ${entry.id} projection hash is stale`)
        return projection
      }).sort((left, right) => left.local_source_id.localeCompare(right.local_source_id))
      const ingredientIds = persistedIngredients.map((entry) => Number(entry.ingredient_id))
      const publishPayload = { schema: 'article_visible_payload.v2', slug: row.slug, title: row.title, dek: row.summary, body: row.body, conclusion: row.conclusion, sources: sourceRelations.map(({ source_id, label, url }) => ({ source_id, label, url })) }
      const seo = row.seo_json == null ? null : nullSafeJson(row.seo_json, `${target.article_id} seo_json`)
      const state = {
        article_id: target.article_id, slug: row.slug, stage: row.article_layer === 'single_study' ? 'stage2' : 'stage3', article_layer: row.article_layer, status: row.status, version: Number(row.version),
        publish_payload: publishPayload, seo, source_relations: sourceRelations, source_projection: sourceProjection, ingredient_ids: ingredientIds, stage2_interpretation_projection: ownedInterpretations,
        featured_image_url: row.featured_image_url, featured_image_r2_key: row.featured_image_r2_key, dose_min: row.dose_min, dose_max: row.dose_max, dose_unit: row.dose_unit, product_note: row.product_note, reviewed_at: row.reviewed_at, created_at: row.created_at, updated_at: row.updated_at,
        persistence_snapshot: { article: row, source_rows: persistedSources, ingredient_rows: persistedIngredients, interpretation_rows: persistedInterpretations },
      }
      result[target.article_id] = { ...state, payload_hash: publicationGuardPayloadHash(state), compiled_payload_hash: null }
    }
    return result
  }

  async readArticleTargets(selectors) {
    const probeTargets = selectors.map((selector) => ({ ...selector, stage2_interpretation_projection: [] }))
    const current = await this.inspectArticlesByTargets(probeTargets)
    return selectors.map((selector) => {
      const row = current[selector.article_id]
      if (!row) fail(`${selector.article_id} update target is missing from authoritative D1`)
      return { article_id: selector.article_id, slug: row.slug, status: row.status, version: row.version, payload_hash: row.payload_hash, created_at: row.created_at, updated_at: row.updated_at }
    })
  }

  #snapshotGuards(target, snapshot) {
    const guards = []
    const guard = (condition, params = []) => guards.push({ sql: `SELECT CASE WHEN ${condition} THEN 1 ELSE json_extract('d1-snapshot-guard-failed','$') END AS exact_snapshot_guard`, params })
    const count = (table, column, rows) => guard(`(SELECT COUNT(*) FROM ${table} WHERE ${column}=?)=?`, [target.slug, rows.length])
    if (!snapshot) {
      for (const [table, column] of [['knowledge_articles', 'slug'], ['knowledge_article_sources', 'article_slug'], ['knowledge_article_ingredients', 'article_slug'], ['study_interpretation_records', 'knowledge_article_slug']]) {
        guard(`(SELECT COUNT(*) FROM ${table} WHERE ${column}=?)=0`, [target.slug])
      }
    } else {
      const raw = snapshot.persistence_snapshot
      const article = raw.article
      guard('(SELECT COUNT(*) FROM knowledge_articles WHERE slug=? AND title IS ? AND summary IS ? AND body IS ? AND status IS ? AND version IS ? AND article_layer IS ? AND conclusion IS ? AND featured_image_url IS ? AND featured_image_r2_key IS ? AND dose_min IS ? AND dose_max IS ? AND dose_unit IS ? AND product_note IS ? AND reviewed_at IS ? AND created_at IS ? AND updated_at IS ? AND sources_json IS ?)=1', [article.slug, article.title, article.summary, article.body, article.status, Number(article.version), article.article_layer, article.conclusion, article.featured_image_url, article.featured_image_r2_key, article.dose_min, article.dose_max, article.dose_unit, article.product_note, article.reviewed_at, article.created_at, article.updated_at, article.sources_json])
      guard('(SELECT COUNT(*) FROM knowledge_articles WHERE slug=? AND seo_json IS ?)=1', [article.slug, article.seo_json])
      count('knowledge_article_sources', 'article_slug', raw.source_rows)
      for (const row of raw.source_rows) {
        guard('(SELECT COUNT(*) FROM knowledge_article_sources WHERE id=? AND article_slug=? AND label IS ? AND url IS ? AND sort_order IS ? AND created_at IS ? AND updated_at IS ?)=1', [Number(row.id), row.article_slug, row.label, row.url, Number(row.sort_order), row.created_at, row.updated_at])
      }
      count('knowledge_article_ingredients', 'article_slug', raw.ingredient_rows)
      for (const row of raw.ingredient_rows) {
        guard('(SELECT COUNT(*) FROM knowledge_article_ingredients WHERE article_slug=? AND ingredient_id=? AND sort_order IS ? AND created_at IS ?)=1', [row.article_slug, Number(row.ingredient_id), Number(row.sort_order), row.created_at])
      }
      count('study_interpretation_records', 'knowledge_article_slug', raw.interpretation_rows)
      for (const row of raw.interpretation_rows) {
        guard('(SELECT COUNT(*) FROM study_interpretation_records WHERE id=? AND ingredient_id=? AND source_id=? AND research_artifact_id IS ? AND knowledge_article_slug=? AND status IS ? AND structured_summary_json IS ? AND stage3_reference_summary IS ? AND notes IS ? AND review_notes IS ? AND version=? AND created_at IS ? AND updated_at IS ?)=1', [Number(row.id), Number(row.ingredient_id), Number(row.source_id), row.research_artifact_id, row.knowledge_article_slug, row.status, row.structured_summary_json, row.stage3_reference_summary, row.notes, row.review_notes, Number(row.version), row.created_at, row.updated_at])
      }
    }
    return guards
  }

  #appendTargetRelations(batch, target) {
    batch.push({ sql: 'DELETE FROM knowledge_article_sources WHERE article_slug=?', params: [target.slug] })
    batch.push({ sql: 'DELETE FROM knowledge_article_ingredients WHERE article_slug=?', params: [target.slug] })
    batch.push({ sql: `DELETE FROM study_interpretation_records WHERE knowledge_article_slug=? AND notes LIKE '${PIPELINE_INTERPRETATION_PREFIX}%'`, params: [target.slug] })
    for (const source of target.source_relations) batch.push({ sql: 'INSERT INTO knowledge_article_sources (article_slug,label,url,sort_order,created_at,updated_at) VALUES (?,?,?,?,datetime(\'now\'),datetime(\'now\'))', params: [target.slug, source.label, source.url, source.position] })
    target.ingredient_ids.forEach((ingredientId, index) => batch.push({ sql: 'INSERT INTO knowledge_article_ingredients (article_slug,ingredient_id,sort_order,created_at) VALUES (?,?,?,datetime(\'now\'))', params: [target.slug, ingredientId, index] }))
    for (const projection of target.stage2_interpretation_projection) batch.push({
      sql: 'INSERT INTO study_interpretation_records (ingredient_id,source_id,research_artifact_id,knowledge_article_slug,status,structured_summary_json,stage3_reference_summary,notes,review_notes,created_at,updated_at,version) VALUES (?,?,NULL,?,?,?,?,?,?,datetime(\'now\'),datetime(\'now\'),1)',
      params: [projection.ingredient_id, projection.resolved_source_id, projection.knowledge_article_slug, projection.status, JSON.stringify(projection.structured_summary), projection.stage3_reference_summary, `${PIPELINE_INTERPRETATION_PREFIX}${projection.projection_hash}`, JSON.stringify(pipelineInterpretationLineage(projection))],
    })
  }

  async applyAtomicRelease(release) {
    const retireArticles = release.retire_articles ?? []
    const retirementProbeTargets = retireArticles.map((target) => ({ ...target, stage2_interpretation_projection: [] }))
    const allTargets = [...release.articles, ...retirementProbeTargets]
    const before = await this.inspectArticlesByTargets(allTargets)
    const decisions = []
    for (const target of release.articles) {
      const current = before[target.article_id]
      if (exactTargetState(current, target)) { current.compiled_payload_hash = target.compiled_payload_hash; decisions.push({ target, current, result: 'already_current' }); continue }
      if (target.write_guard.mode === 'create') {
        if (current) fail(`${target.article_id} create guard expected absent in D1`)
      } else if (!current || current.status !== target.write_guard.expected_status || current.version !== target.write_guard.expected_version || current.payload_hash !== target.write_guard.expected_payload_hash) fail(`${target.article_id} update guard differs from authoritative D1 readback`)
      decisions.push({ target, current, result: 'applied' })
    }
    const retirementDecisions = []
    for (const target of retireArticles) {
      const current = before[target.article_id]
      if (retirementAlreadyCurrent(current, target)) { retirementDecisions.push({ target, current, result: 'already_current' }); continue }
      if (!current || current.slug !== target.slug || current.status !== target.expected_status || current.version !== target.expected_version || current.payload_hash !== target.expected_payload_hash) fail(`${target.article_id} retirement guard differs from authoritative D1 readback`)
      retirementDecisions.push({ target, current, result: 'applied' })
    }
    const batch = []
    for (const { target, current, result } of decisions) if (result === 'applied') batch.push(...this.#snapshotGuards(target, current))
    for (const { target, current, result } of retirementDecisions) if (result === 'applied') batch.push(...this.#snapshotGuards(target, current))
    for (const { target, current, result } of decisions) {
      if (result !== 'applied') continue
      const sourcesJson = JSON.stringify(target.source_projection), seoJson = JSON.stringify(publicSeo(target)), layer = articleLayer(target), featuredImageUrl = targetFeaturedImageUrl(target)
      const featuredImageR2Key = null
      if (!current) {
        batch.push({ sql: 'INSERT INTO knowledge_articles (slug,title,summary,body,status,reviewed_at,sources_json,seo_json,article_layer,conclusion,featured_image_url,featured_image_r2_key,dose_min,dose_max,dose_unit,product_note,created_at,updated_at,version) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,1)', params: [target.slug, target.publish_payload.title, target.publish_payload.dek, target.publish_payload.body, target.desired_status, target.reviewed_at, sourcesJson, seoJson, layer, target.publish_payload.conclusion, featuredImageUrl, featuredImageR2Key, null, null, null, null, target.published_at, target.modified_at] })
      } else {
        batch.push({ sql: 'UPDATE knowledge_articles SET title=?,summary=?,body=?,status=?,reviewed_at=?,sources_json=?,seo_json=?,article_layer=?,conclusion=?,featured_image_url=?,featured_image_r2_key=?,dose_min=NULL,dose_max=NULL,dose_unit=NULL,product_note=NULL,created_at=?,updated_at=?,version=version+1 WHERE slug=? AND version=? AND status=? AND article_layer=? AND created_at=?', params: [target.publish_payload.title, target.publish_payload.dek, target.publish_payload.body, target.desired_status, target.reviewed_at, sourcesJson, seoJson, layer, target.publish_payload.conclusion, featuredImageUrl, featuredImageR2Key, target.published_at, target.modified_at, target.slug, current.version, current.status, current.article_layer, current.created_at] })
      }
      batch.push({ sql: "SELECT CASE WHEN changes()=1 THEN 1 ELSE json_extract('d1-article-write-guard-failed','$') END AS exact_guarded_row" })
      this.#appendTargetRelations(batch, target)
    }
    for (const { target, result } of retirementDecisions) {
      if (result !== 'applied') continue
      batch.push({ sql: 'UPDATE knowledge_articles SET status=\'draft\',version=version+1 WHERE slug=? AND status=? AND version=?', params: [target.slug, target.expected_status, target.expected_version] })
      batch.push({ sql: "SELECT CASE WHEN changes()=1 THEN 1 ELSE json_extract('d1-retirement-write-guard-failed','$') END AS exact_retirement_guard" })
    }
    if (batch.length) await this.query({ batch })
    const after = await this.inspectArticlesByTargets(allTargets)
    for (const decision of decisions) {
      const current = after[decision.target.article_id]
      if (!current) fail(`${decision.target.article_id} disappeared after D1 atomic batch`)
      current.compiled_payload_hash = decision.target.compiled_payload_hash
    }
    return { transaction_id: `d1-${release.release_hash.slice(-16)}-${Date.now()}`, before, after, decisions, retirementDecisions }
  }

  #appendSnapshotRestore(batch, target, snapshot, resulting) {
    batch.push(...this.#snapshotGuards(target, resulting))
    batch.push({ sql: `DELETE FROM study_interpretation_records WHERE knowledge_article_slug=? AND notes LIKE '${PIPELINE_INTERPRETATION_PREFIX}%'`, params: [target.slug] })
    batch.push({ sql: 'DELETE FROM knowledge_article_ingredients WHERE article_slug=?', params: [target.slug] })
    batch.push({ sql: 'DELETE FROM knowledge_article_sources WHERE article_slug=?', params: [target.slug] })
    if (!snapshot) {
      batch.push({ sql: 'DELETE FROM knowledge_articles WHERE slug=? AND version=? AND status=? AND article_layer=?', params: [target.slug, resulting.version, resulting.status, resulting.article_layer] })
      batch.push({ sql: "SELECT CASE WHEN changes()=1 THEN 1 ELSE json_extract('d1-rollback-guard-failed','$') END AS rollback_guard" })
      return
    }
    const raw = snapshot.persistence_snapshot, article = raw.article
    batch.push({
      sql: 'UPDATE knowledge_articles SET title=?,summary=?,body=?,reviewed_at=?,sources_json=?,seo_json=?,conclusion=?,featured_image_url=?,featured_image_r2_key=?,dose_min=?,dose_max=?,dose_unit=?,product_note=? WHERE slug=? AND version=? AND status=? AND article_layer=?',
      params: [article.title, article.summary, article.body, article.reviewed_at, article.sources_json, article.seo_json, article.conclusion, article.featured_image_url, article.featured_image_r2_key, article.dose_min, article.dose_max, article.dose_unit, article.product_note, target.slug, resulting.version, resulting.status, resulting.article_layer],
    })
    batch.push({ sql: "SELECT CASE WHEN changes()=1 THEN 1 ELSE json_extract('d1-rollback-guard-failed','$') END AS rollback_guard" })
    batch.push({
      sql: 'UPDATE knowledge_articles SET status=?,article_layer=?,created_at=?,updated_at=?,version=? WHERE slug=? AND version=? AND status=? AND article_layer=?',
      params: [article.status, article.article_layer, article.created_at, article.updated_at, Number(article.version), target.slug, resulting.version, resulting.status, resulting.article_layer],
    })
    batch.push({ sql: "SELECT CASE WHEN changes()=1 THEN 1 ELSE json_extract('d1-rollback-guard-failed','$') END AS rollback_guard" })
    for (const row of raw.source_rows) batch.push({ sql: 'INSERT INTO knowledge_article_sources (id,article_slug,label,url,sort_order,created_at,updated_at) VALUES (?,?,?,?,?,?,?)', params: [Number(row.id), row.article_slug, row.label, row.url, Number(row.sort_order), row.created_at, row.updated_at] })
    for (const row of raw.ingredient_rows) batch.push({ sql: 'INSERT INTO knowledge_article_ingredients (article_slug,ingredient_id,sort_order,created_at) VALUES (?,?,?,?)', params: [row.article_slug, Number(row.ingredient_id), Number(row.sort_order), row.created_at] })
    for (const row of raw.interpretation_rows.filter((entry) => String(entry.notes ?? '').startsWith(PIPELINE_INTERPRETATION_PREFIX))) batch.push({
      sql: 'INSERT INTO study_interpretation_records (id,ingredient_id,source_id,research_artifact_id,knowledge_article_slug,status,structured_summary_json,stage3_reference_summary,notes,review_notes,created_at,updated_at,version) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)',
      params: [Number(row.id), Number(row.ingredient_id), Number(row.source_id), row.research_artifact_id, row.knowledge_article_slug, row.status, row.structured_summary_json, row.stage3_reference_summary, row.notes, row.review_notes, row.created_at, row.updated_at, Number(row.version)],
    })
  }

  async rollbackAtomic(transaction) {
    const batch = []
    for (const decision of transaction.decisions.filter((entry) => entry.result === 'applied')) this.#appendSnapshotRestore(batch, decision.target, transaction.before[decision.target.article_id], transaction.after[decision.target.article_id])
    for (const decision of (transaction.retirementDecisions ?? []).filter((entry) => entry.result === 'applied')) {
      const before = transaction.before[decision.target.article_id], after = transaction.after[decision.target.article_id]
      batch.push(...this.#snapshotGuards(decision.target, after))
      batch.push({ sql: 'UPDATE knowledge_articles SET status=?,version=? WHERE slug=? AND status=? AND version=?', params: [before.status, before.version, decision.target.slug, after.status, after.version] })
      batch.push({ sql: "SELECT CASE WHEN changes()=1 THEN 1 ELSE json_extract('d1-retirement-rollback-guard-failed','$') END AS retirement_rollback_guard" })
    }
    if (batch.length) await this.query({ batch })
    const restoredTargets = [...transaction.decisions.map((entry) => entry.target), ...(transaction.retirementDecisions ?? []).map((entry) => ({ ...entry.target, stage2_interpretation_projection: [] }))]
    const restored = await this.inspectArticlesByTargets(restoredTargets)
    for (const decision of transaction.decisions.filter((entry) => entry.result === 'applied')) {
      const expected = transaction.before[decision.target.article_id], actual = restored[decision.target.article_id]
      if (!expected && actual || expected && (!actual || actual.status !== expected.status || actual.article_layer !== expected.article_layer || actual.version !== expected.version || actual.payload_hash !== expected.payload_hash || canonicalJsonHash(publicSeo(actual)) !== canonicalJsonHash(publicSeo(expected)))) fail(`${decision.target.article_id} D1 rollback readback differs from its exact snapshot`)
    }
    for (const decision of (transaction.retirementDecisions ?? []).filter((entry) => entry.result === 'applied')) {
      const expected = transaction.before[decision.target.article_id], actual = restored[decision.target.article_id]
      if (!actual || actual.status !== expected.status || actual.version !== expected.version || actual.payload_hash !== expected.payload_hash || canonicalJsonHash(publicSeo(actual)) !== canonicalJsonHash(publicSeo(expected))) fail(`${decision.target.article_id} D1 retirement rollback readback differs from its exact snapshot`)
    }
  }

  async readPublicArticle(target, releaseHash) {
    const url = new URL(`/api/knowledge/${encodeURIComponent(target.slug)}`, this.publicBaseUrl)
    url.searchParams.set('cfcheck', text(releaseHash, 'public API release hash'))
    const response = await fetch(url, { headers: { Accept: 'application/json' }, cache: 'no-store' })
    const bytes = Buffer.from(await response.arrayBuffer())
    const decoded = decodeUtf8Strict(bytes, `${target.article_id} public API response`)
    if (decoded.errors.length) fail(decoded.errors.join('; '))
    let value
    try { value = JSON.parse(decoded.text) } catch { fail(`${target.article_id} public API returned invalid JSON`) }
    if (!response.ok || !value.article) fail(`${target.article_id} public API readback failed with HTTP ${response.status}`)
    const article = value.article
    const sources = array(article.sources ?? [], `${target.article_id} public API sources`).map((source, position) => ({ position, source_id: source.source_id, label: source.label ?? source.name, url: source.url ?? source.link }))
    for (const source of sources) if (typeof source.source_id !== 'string' || !source.source_id || typeof source.label !== 'string' || typeof source.url !== 'string') fail(`${target.article_id} public API v2 source projection is incomplete`)
    const ingredientIds = array(article.ingredient_ids ?? [], `${target.article_id} public API ingredient_ids`).map(Number)
    const publicInterpretations = article.stage2_interpretation_projection == null ? null : array(article.stage2_interpretation_projection, `${target.article_id} optional public interpretation projection`)
    return {
      url: url.href, release_hash: releaseHash, fetch_status: 'FETCHED', http_status: response.status, content_type: response.headers.get('content-type'), body_hash: sha256Bytes(bytes),
      publish_payload: { schema: 'article_visible_payload.v2', slug: article.slug, title: article.title, dek: article.summary, body: article.body, conclusion: article.conclusion ?? null, sources: sources.map(({ source_id, label, url: sourceUrl }) => ({ source_id, label, url: sourceUrl })) },
      seo: article.seo ?? null,
      reviewed_at: article.reviewed_at,
      created_at: article.created_at,
      updated_at: article.updated_at,
      source_relations: sources,
      ingredient_ids: ingredientIds,
      stage2_interpretation_projection: publicInterpretations,
      legacy_visible_fields: { featured_image_url: article.featured_image_url ?? null, dose_min: article.dose_min ?? null, dose_max: article.dose_max ?? null, dose_unit: article.dose_unit ?? null, product_note: article.product_note ?? null },
      raw: value,
    }
  }

  async readRetiredArticlePublicState(target, releaseHash) {
    const suffix = `cfcheck=${encodeURIComponent(text(releaseHash, 'public retirement release hash'))}`
    const detailUrl = new URL(`/api/knowledge/${encodeURIComponent(target.slug)}?${suffix}`, this.publicBaseUrl)
    const overviewApiUrl = new URL(`/api/knowledge?${suffix}`, this.publicBaseUrl)
    const overviewRouteUrl = new URL(`/wissen?${suffix}`, this.publicBaseUrl)
    const [detailResponse, overviewApiResponse, overviewRouteResponse] = await Promise.all([
      fetch(detailUrl, { headers: { Accept: 'application/json' }, cache: 'no-store' }),
      fetch(overviewApiUrl, { headers: { Accept: 'application/json' }, cache: 'no-store' }),
      fetch(overviewRouteUrl, { headers: { Accept: 'text/html' }, cache: 'no-store' }),
    ])
    const detailBytes = Buffer.from(await detailResponse.arrayBuffer()), overviewApiBytes = Buffer.from(await overviewApiResponse.arrayBuffer()), overviewRouteBytes = Buffer.from(await overviewRouteResponse.arrayBuffer())
    const detailDecoded = decodeUtf8Strict(detailBytes, `${target.article_id} retired detail API response`)
    const overviewApiDecoded = decodeUtf8Strict(overviewApiBytes, `${target.article_id} retired overview API response`)
    const overviewRouteDecoded = decodeUtf8Strict(overviewRouteBytes, `${target.article_id} retired /wissen response`)
    if (detailDecoded.errors.length || overviewApiDecoded.errors.length || overviewRouteDecoded.errors.length) fail([...detailDecoded.errors, ...overviewApiDecoded.errors, ...overviewRouteDecoded.errors].join('; '))
    let detailValue = null, overviewValue
    try { detailValue = detailDecoded.text ? JSON.parse(detailDecoded.text) : null } catch {}
    try { overviewValue = JSON.parse(overviewApiDecoded.text) } catch { fail(`${target.article_id} retired overview API returned invalid JSON`) }
    if (!overviewApiResponse.ok || !Array.isArray(overviewValue?.articles)) fail(`${target.article_id} retired overview API readback failed with HTTP ${overviewApiResponse.status}`)
    if (!overviewRouteResponse.ok) fail(`${target.article_id} retired /wissen readback failed with HTTP ${overviewRouteResponse.status}`)
    const publicPath = `/wissen/${target.slug}`
    return {
      detail_api: { url: detailUrl.href, fetch_status: 'FETCHED', http_status: detailResponse.status, content_type: detailResponse.headers.get('content-type'), body_hash: sha256Bytes(detailBytes), article_present: Boolean(detailResponse.ok && detailValue?.article) },
      overview_api: { url: overviewApiUrl.href, fetch_status: 'FETCHED', http_status: overviewApiResponse.status, content_type: overviewApiResponse.headers.get('content-type'), body_hash: sha256Bytes(overviewApiBytes), slug_present: overviewValue.articles.some((article) => article?.slug === target.slug) },
      overview_route: { url: overviewRouteUrl.href, fetch_status: 'FETCHED', http_status: overviewRouteResponse.status, content_type: overviewRouteResponse.headers.get('content-type'), body_hash: sha256Bytes(overviewRouteBytes), slug_present: overviewRouteDecoded.text.includes(publicPath) },
    }
  }

}

function validateUtf8RoundTrip(value, label) {
  const bytes = Buffer.from(JSON.stringify(value), 'utf8')
  const decoded = decodeUtf8Strict(bytes, label)
  return { valid_utf8: decoded.errors.length === 0, mojibake_free: decoded.errors.length === 0 && !/(?:Ã.|Â.|â€|ï¿½)/u.test(decoded.text) }
}

function assertPublicArticleMatchesTarget(release, target, publicState) {
  buildPublicApiReadbackActualV1({ release, target, publicState })
  if (publicState.reviewed_at !== target.reviewed_at || publicState.created_at !== target.published_at || publicState.updated_at !== target.modified_at || canonicalJsonHash(publicState.publish_payload) !== canonicalJsonHash(target.publish_payload) || canonicalJsonHash(publicState.seo) !== canonicalJsonHash(publicSeo(target)) || canonicalJsonHash(publicState.source_relations) !== canonicalJsonHash(target.source_relations) || canonicalJsonHash(publicState.ingredient_ids) !== canonicalJsonHash(target.ingredient_ids)) fail(`${target.article_id} public API payload/SEO/timestamps/v2 sources/ingredient relations differ after atomic apply`)
  if (publicState.stage2_interpretation_projection !== null && canonicalJsonHash(publicState.stage2_interpretation_projection) !== canonicalJsonHash(target.stage2_interpretation_projection)) fail(`${target.article_id} optional public interpretation projection differs after atomic apply`)
  if (Object.values(object(publicState.legacy_visible_fields, `${target.article_id} public legacy visible fields`)).some((value) => value !== null)) fail(`${target.article_id} public API exposes stale legacy hero/dose/product fields outside the frozen v2 projection`)
  return publicState
}

async function readPublicArticleWithConvergence(adapter, release, target) {
  const attempts = Math.max(1, Number(adapter.publicReadbackRetry?.attempts ?? 1))
  const delayMs = Math.max(0, Number(adapter.publicReadbackRetry?.delayMs ?? 0))
  let lastError
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return assertPublicArticleMatchesTarget(release, target, await adapter.readPublicArticle(target, release.release_hash))
    } catch (error) {
      lastError = error
      if (attempt < attempts && delayMs > 0) await new Promise((resolve) => setTimeout(resolve, delayMs))
    }
  }
  throw lastError
}

function assertRetiredArticleIsNotPublic(release, target, publicState) {
  const expectedDetail = new URL(`/api/knowledge/${encodeURIComponent(target.slug)}`, release.public_base_url); expectedDetail.searchParams.set('cfcheck', release.release_hash)
  const expectedOverviewApi = new URL('/api/knowledge', release.public_base_url); expectedOverviewApi.searchParams.set('cfcheck', release.release_hash)
  const expectedOverviewRoute = new URL('/wissen', release.public_base_url); expectedOverviewRoute.searchParams.set('cfcheck', release.release_hash)
  const detail = object(publicState.detail_api, `${target.article_id} retirement detail_api`)
  const overviewApi = object(publicState.overview_api, `${target.article_id} retirement overview_api`)
  const overviewRoute = object(publicState.overview_route, `${target.article_id} retirement overview_route`)
  if (detail.url !== expectedDetail.href || detail.fetch_status !== 'FETCHED' || detail.http_status !== 404 || detail.article_present !== false) fail(`${target.article_id} retired detail API did not return the exact public 404 absence evidence`)
  if (overviewApi.url !== expectedOverviewApi.href || overviewApi.fetch_status !== 'FETCHED' || overviewApi.http_status !== 200 || overviewApi.slug_present !== false) fail(`${target.article_id} retired article remains in the public knowledge overview API`)
  if (overviewRoute.url !== expectedOverviewRoute.href || overviewRoute.fetch_status !== 'FETCHED' || overviewRoute.http_status !== 200 || overviewRoute.slug_present !== false) fail(`${target.article_id} retired article remains in the public /wissen route`)
  return publicState
}

async function readRetiredArticleWithConvergence(adapter, release, target) {
  if (typeof adapter.readRetiredArticlePublicState !== 'function') fail('publication adapter has no retired-article public readback')
  const attempts = Math.max(1, Number(adapter.publicReadbackRetry?.attempts ?? 1))
  const delayMs = Math.max(0, Number(adapter.publicReadbackRetry?.delayMs ?? 0))
  let lastError
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try { return assertRetiredArticleIsNotPublic(release, target, await adapter.readRetiredArticlePublicState(target, release.release_hash)) }
    catch (error) {
      lastError = error
      if (attempt < attempts && delayMs > 0) await new Promise((resolve) => setTimeout(resolve, delayMs))
    }
  }
  throw lastError
}

function articleResultReadbacks(release, target, current, publicState, seoDelivery, checkedAt, rendererResult) {
  const persistence = { target_identity: target.article_id, resulting_version: current.version, resulting_status: current.status, article_layer: current.article_layer, compiled_payload_hash: target.compiled_payload_hash }
  const relations = { relation_hash: target.relation_hash, source_projection_hash: canonicalJsonHash(current.source_projection), ingredient_relation_hash: canonicalJsonHash({ ingredient_ids: current.ingredient_ids }), interpretation_projection_hash: canonicalJsonHash(current.stage2_interpretation_projection), asset_hashes: target.asset_hashes }
  const publicApi = buildPublicApiReadbackActualV1({ release, target, publicState })
  const utf8 = validateUtf8RoundTrip(publicState.raw, `${target.article_id} public payload`)
  const seoLiveResult = rendererResult.seo_match !== 'MISMATCH' && seoDelivery.seo_delivery_state === 'RAW_HTML_MATCH' && seoDelivery.sitemap.state === 'INCLUDED' && rendererResult.indexability_state === 'INDEXABLE' ? 'MATCH' : 'INCOMPLETE'
  return {
    persistence: { checked_at: checkedAt, checked: ['identity', 'version', 'status', 'article_layer', 'compiled_payload_hash'], result: 'MATCH', actual: persistence },
    relations: { checked_at: checkedAt, checked: ['relation_hash', 'source_projection', 'ingredient_relation', 'interpretation_projection', 'asset_hashes'], result: 'MATCH', actual: relations },
    public_api: { checked_at: checkedAt, checked: PUBLIC_API_READBACK_CHECKS_V1, result: 'MATCH', actual: publicApi },
    utf8: { checked_at: checkedAt, checked: ['strict_utf8', 'mojibake'], result: utf8.valid_utf8 && utf8.mojibake_free ? 'MATCH' : 'MISMATCH', actual: utf8 },
    dom: { checked_at: checkedAt, checked: rendererResult.checked, result: rendererResult.result, actual: { visible_payload_hash: target.visible_payload_hash, projection: rendererResult.projection, projection_hash: rendererResult.projection_hash, asset_hashes: rendererResult.asset_hashes } },
    seo: { checked_at: checkedAt, checked: ['meta', 'canonical', 'robots', 'indexability', 'json_ld'], result: rendererResult.result, actual: { seo: rendererResult.seo, seo_hash: rendererResult.seo_hash } },
    seo_delivery: { checked_at: checkedAt, checked: ['hydrated_dom_state', 'site_policy_fingerprint', 'raw_html_http', 'raw_html_body_hash', 'raw_title', 'raw_article_text', 'raw_article_json_ld', 'sitemap_inclusion'], result: seoLiveResult, actual: seoDelivery },
  }
}

export async function applyContentReleaseV2({ release, workOrder, adapter, publishEnabled = false, receiptPath, rendererRequestPath = null, rendererReceiptPath = null }) {
  if (release?.mode === LEGACY_FIELD_CORRECTION_MODE) return applyLegacyFieldCorrectionV1({ release, workOrder, adapter, publishEnabled, receiptPath })
  validateContentReleaseForApplyV2(release)
  validateDeterministicWorkOrderV2(workOrder, { kind: 'publication_apply', runId: release.run_id })
  if (workOrder.task?.release_hash !== release.release_hash || workOrder.assignee?.role !== 'deterministic-content-publication-executor') fail('publication_apply WorkOrder release/role differs')
  if (!publishEnabled) fail('publication apply is disabled; pass the explicit publish flag after reviewing target and guards')
  const output = workOrder.outputs.find((entry) => entry.name === 'publish_receipt' && entry.schema === 'content_publish_receipt.v2')
  if (!output) fail('publication_apply WorkOrder has no canonical publish receipt output')
  const appliedAt = now()
  let transaction
  try {
    transaction = await adapter.applyAtomicRelease(release)
    const publicStates = {}
    await Promise.all(release.articles.map(async (target) => {
      const authoritative = transaction.after[target.article_id]
      if (!exactTargetState(authoritative, target)) fail(`${target.article_id} authoritative article/status/layer/source/ingredient/interpretation readback differs after the D1 atomic batch`)
      const publicState = await readPublicArticleWithConvergence(adapter, release, target)
      publicStates[target.article_id] = publicState
    }))
    const retirementPublicStates = {}
    await Promise.all((release.retire_articles ?? []).map(async (target) => {
      const authoritative = transaction.after[target.article_id]
      if (!retirementAlreadyCurrent(authoritative, target)) fail(`${target.article_id} authoritative retirement readback differs after the D1 atomic batch`)
      retirementPublicStates[target.article_id] = await readRetiredArticleWithConvergence(adapter, release, target)
    }))
    const requestPath = rendererRequestPath ?? resolve(dirname(receiptPath), 'renderer-public-readback-request.v2.json')
    const publicReceiptPath = rendererReceiptPath ?? resolve(dirname(receiptPath), 'renderer-public-readback-receipt.v2.json')
    const renderer = runRendererPublicReadbackV2({ release, adapter, requestPath, receiptPath: publicReceiptPath })
    const checkedAt = now()
    const articleResults = release.articles.map((target) => {
      const decision = transaction.decisions.find((entry) => entry.target.article_id === target.article_id)
      const current = transaction.after[target.article_id]
      const rendererResult = renderer.receipt.article_results.find((entry) => entry.article_id === target.article_id)
      const seoDelivery = {
        hydrated_dom_state: rendererResult.hydrated_dom_state, indexability_state: rendererResult.indexability_state,
        site_policy_fingerprint: rendererResult.site_policy_fingerprint, seo_delivery_state: rendererResult.seo_delivery_state,
        raw_html: rendererResult.raw_html, sitemap: rendererResult.sitemap,
      }
      const before = transaction.before[target.article_id]
      return {
        article_id: target.article_id, slug: target.slug, target_identity: target.article_id, result: decision.result, changed_rows: decision.result === 'applied' ? 1 : 0,
        write_guard: target.write_guard,
        guard_result: decision.result === 'applied'
          ? { expected: target.write_guard, outcome: 'MATCH', actual_before: before ? { status: before.status, version: before.version, payload_hash: before.payload_hash } : { status: 'absent', version: 0, payload_hash: null } }
          : { expected: target.write_guard, outcome: 'ALREADY_CURRENT', actual_before: { status: before.status, version: before.version, payload_hash: before.payload_hash }, actual: { compiled_payload_hash: target.compiled_payload_hash } },
        compiled_payload_hash: target.compiled_payload_hash, visible_payload_hash: target.visible_payload_hash, qa_payload_hash: target.qa_payload_hash, render_snapshot_hash: target.render_snapshot_hash, relation_hash: target.relation_hash,
        projection_hash: target.projection_hash, seo_hash: target.seo_hash, asset_hashes: target.asset_hashes,
        resulting_version: current.version, resulting_status: current.status, rendering_changed: decision.result === 'applied', seo_changed: decision.result === 'applied',
        hydrated_dom_state: rendererResult.hydrated_dom_state, indexability_state: rendererResult.indexability_state, site_policy_fingerprint: rendererResult.site_policy_fingerprint,
        seo_delivery_state: rendererResult.seo_delivery_state, sitemap_state: rendererResult.sitemap.state,
        raw_html: rendererResult.raw_html, sitemap: rendererResult.sitemap,
        readbacks: articleResultReadbacks(release, target, current, publicStates[target.article_id], seoDelivery, checkedAt, rendererResult),
      }
    })
    const retirementResults = (release.retire_articles ?? []).map((target) => {
      const decision = transaction.retirementDecisions.find((entry) => entry.target.article_id === target.article_id)
      const before = transaction.before[target.article_id], current = transaction.after[target.article_id]
      const publicState = retirementPublicStates[target.article_id]
      return {
        article_id: target.article_id, slug: target.slug, target_identity: target.article_id,
        result: decision.result, changed_rows: decision.result === 'applied' ? 1 : 0,
        write_guard: retirementGuard(target),
        guard_result: decision.result === 'applied'
          ? { expected: retirementGuard(target), outcome: 'MATCH', actual_before: { status: before.status, version: before.version, payload_hash: before.payload_hash } }
          : { expected: retirementGuard(target), outcome: 'ALREADY_CURRENT', actual_before: { status: before.status, version: before.version, payload_hash: before.payload_hash }, reconstructed_predecessor_payload_hash: publicationGuardPayloadHash({ ...before, status: target.expected_status }) },
        resulting_version: current.version, resulting_status: current.status, resulting_payload_hash: current.payload_hash,
        readbacks: {
          persistence: { checked_at: checkedAt, checked: ['identity', 'slug', 'status', 'version', 'payload_hash'], result: 'MATCH', actual: { target_identity: target.article_id, slug: current.slug, status: current.status, version: current.version, payload_hash: current.payload_hash } },
          public_absence: { checked_at: checkedAt, checked: ['detail_api_absent', 'overview_api_absent', 'wissen_route_absent'], result: 'MATCH', actual: publicState },
        },
      }
    })
    const base = {
      schema: 'content_publish_receipt.v2', release_hash: release.release_hash, target: release.publish_target, work_order_id: workOrder.work_order_id,
      executor: { role: 'deterministic-content-publication-executor', id: `machine-${adapter.kind}` }, applied_at: appliedAt,
      atomic_batch: { result: 'COMMITTED', scope: 'd1_articles_relations_interpretations_only', excludes: ['r2_asset_staging', 'source_catalog_staging'], transaction_id: transaction.transaction_id, article_ids: release.articles.map((article) => article.article_id).sort(), retire_article_ids: (release.retire_articles ?? []).map((article) => article.article_id).sort() },
      origin_results: renderer.receipt.origin_results, article_results: articleResults, retirement_results: retirementResults, badge_readback: renderer.receipt.badge_readback,
    }
    const receipt = { ...base, content_hash: artifactHashV2(base) }
    writeJsonAtomic(receiptPath, receipt)
    return receipt
  } catch (error) {
    if (transaction) {
      try { await adapter.rollbackAtomic(transaction) } catch (rollbackError) { error.message = `${error.message}; compensating rollback failed: ${rollbackError.message}` }
    }
    throw error
  }
}

async function readLegacyCorrectionPublicState(adapter, release, target, expected) {
  const url = new URL(`/api/knowledge/${target.slug}`, release.public_base_url)
  url.searchParams.set('cfcheck', release.release_hash)
  const response = await fetch(url)
  const bytes = new Uint8Array(await response.arrayBuffer())
  const decoded = decodeUtf8Strict(bytes, `${target.slug} public content`)
  if (!response.ok || decoded.errors.length) fail(`${target.slug} legacy public readback HTTP/UTF-8 failed`)
  let article
  try { article = JSON.parse(decoded.text).article } catch { fail(`${target.slug} legacy public readback is invalid JSON`) }
  if (!article || article.slug !== target.slug) fail(`${target.slug} legacy public identity differs`)
  for (const field of ['title', 'summary', 'body', 'conclusion', 'article_layer', 'reviewed_at', 'created_at', 'updated_at', 'update_reason']) {
    if (article[field] !== expected.article[field]) fail(`${target.slug} legacy public ${field} readback differs`)
  }
  for (const field of ['sources', 'ingredients', 'parts', 'ingredient_ids', 'featured_image_url', 'featured_image_r2_key', 'dose_min', 'dose_max', 'dose_unit', 'product_note', 'seo']) {
    if (canonicalJsonHash(article[field] ?? null) !== canonicalJsonHash(target.public_before[field] ?? null)) fail(`${target.slug} legacy public unchanged ${field} differs`)
  }
  return { url: url.href, status: response.status, checked_at: now(), body_hash: sha256Bytes(bytes), article_hash: canonicalJsonHash(article), result: 'MATCH' }
}

export function validateLegacyCorrectionDomV1(observation, release, after) {
  if (observation?.schema !== 'legacy_article_dom_readback.v1' || observation.release_hash !== release.release_hash
    || observation.content_hash !== artifactHashV2(observation) || !observation.browser?.product || !Number.isFinite(Date.parse(observation.checked_at))
    || !sameSet((observation.article_results ?? []).map(entry => entry.article_id), release.input.affected_article_ids)) fail('legacy DOM observation identity/browser/time differs')
  const normalizeText = value => knowledgeInlineMarkdownToText(String(value ?? '')).normalize('NFKC').replace(/\s+/gu, ' ').trim()
  const utcTimestamp = value => Date.parse(typeof value === 'string' && /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}(?:\.\d+)?$/.test(value) ? value.replace(' ', 'T') + 'Z' : value)
  for (const target of release.articles) {
    const row = after[target.slug].article
    if (Date.parse(observation.checked_at) < Date.parse(row.updated_at)) fail(`${target.slug} DOM observation predates actual applied content`)
    const actual = observation.article_results.find(entry => entry.article_id === target.article_id)
    const url = new URL(`/wissen/${target.slug}`, release.public_base_url).href
    if (actual.public_url !== url || actual.raw_html?.http_status !== 200 || !/text\/html/i.test(actual.raw_html.content_type ?? '') || !HASH.test(actual.raw_html.body_hash ?? '')) fail(`${target.slug} raw DOM fetch differs`)
    const required = [row.title, row.summary]
    let skipSourceLevel = null, skippingFazit = false
    const body = parseKnowledgeMarkdown(row.body)
    if (row.article_layer === 'main_article' && row.conclusion) body.push(...parseKnowledgeMarkdown(row.conclusion))
    const originalBodyCount = parseKnowledgeMarkdown(row.body).length
    for (const [index, block] of body.entries()) {
      if (index === originalBodyCount) { skippingFazit = false; skipSourceLevel = null }
      if (block.type === 'heading') {
        if (isKnowledgeSourceHeading(block.text)) { skipSourceLevel = block.level; continue }
        if (skipSourceLevel !== null && block.level <= skipSourceLevel) skipSourceLevel = null
        if (index < originalBodyCount && row.article_layer === 'main_article' && row.conclusion && block.level === 2) skippingFazit = /^fazit(?:\b|$)/i.test(normalizeText(block.text))
      }
      if (skipSourceLevel !== null || skippingFazit) continue
      if (block.type === 'paragraph' || block.type === 'heading') required.push(block.text)
      else if (block.type === 'list') required.push(...block.items)
      else if (block.type === 'table') required.push(...block.headers, ...block.rows.flat())
      else if (block.type === 'image' && block.caption) required.push(block.caption)
    }
    for (const [surface, state] of [['raw_html', actual.raw_html], ['desktop', actual.viewports?.desktop], ['mobile', actual.viewports?.mobile]]) {
      if (!state) fail(`${target.slug} ${surface} DOM missing`)
      const actualText = normalizeText(state.text)
      const visibleFieldTexts = [row.summary, ...(row.article_layer === 'main_article' && target.fields.some(patch => patch.field === 'conclusion') ? [row.conclusion] : [])]
      const requiredSurfaceTexts = surface === 'raw_html' ? required : visibleFieldTexts
      if (normalizeText(state.h1) !== normalizeText(row.title) || requiredSurfaceTexts.some(value => normalizeText(value) && !actualText.includes(normalizeText(value)))) fail(`${target.slug} ${surface} visible content differs`)
      if (state.canonical !== url || state.robots !== 'index,follow' || normalizeText(state.title) !== normalizeText(row.title) || normalizeText(state.description) !== normalizeText(row.summary)) fail(`${target.slug} ${surface} SEO differs`)
      const jsonLd = state.json_ld?.find(value => value?.['@type'] === 'Article' && value.mainEntityOfPage === url)
      if (!jsonLd || normalizeText(jsonLd.headline) !== normalizeText(row.title) || normalizeText(jsonLd.description) !== normalizeText(row.summary)
        || utcTimestamp(jsonLd.datePublished) !== utcTimestamp(row.created_at) || utcTimestamp(jsonLd.dateModified) !== utcTimestamp(row.updated_at)) fail(`${target.slug} ${surface} JSON-LD differs`)
      for (const source of target.public_before.sources ?? []) {
        if (!state.links?.some(link => normalizeText(link.label) === normalizeText(source.label) && link.url === new URL(source.url, url).href)) fail(`${target.slug} ${surface} source differs`)
      }
    }
  }
  const result = { ...observation, result: 'MATCH' }
  return { ...result, content_hash: artifactHashV2(result) }
}

async function applyLegacyFieldCorrectionV1({ release, workOrder, adapter, publishEnabled, receiptPath }) {
  validateLegacyFieldCorrectionReleaseV1(release)
  validateDeterministicWorkOrderV2(workOrder, { kind: 'publication_apply', runId: release.run_id })
  if (workOrder.task?.release_hash !== release.release_hash || workOrder.assignee?.role !== 'deterministic-content-publication-executor') fail('legacy publication_apply release/role binding differs')
  if (!publishEnabled) fail('publication apply is disabled; pass the explicit publish flag after reviewing target and guards')
  if (!workOrder.outputs?.some((entry) => entry.name === 'publish_receipt' && entry.schema === 'content_publish_receipt.v2')) fail('legacy publication_apply has no canonical receipt output')
  if (typeof adapter.readLegacyFieldCorrectionSnapshots !== 'function' || typeof adapter.applyAtomicLegacyFieldCorrection !== 'function') fail('publication adapter does not implement the exact legacy field mode')
  const appliedAt = now()
  const before = await adapter.readLegacyFieldCorrectionSnapshots(release.articles)
  const snapshotBase = { schema: 'article_legacy_correction_snapshot.v1', release_hash: release.release_hash, database_id: release.database_id,
    captured_at: appliedAt, read_only: true, snapshots: before }
  const snapshot = { ...snapshotBase, content_hash: artifactHashV2(snapshotBase) }
  const snapshotPath = `${receiptPath}.before-${Date.now()}.json`
  writeJsonAtomic(snapshotPath, snapshot)
  const transaction = await adapter.applyAtomicLegacyFieldCorrection(release, { appliedAt, before })
  const articleResults = []
  let domReadback
  try {
  for (const target of release.articles) {
    const expected = transaction.after[target.slug]
    const publicReadback = await readLegacyCorrectionPublicState(adapter, release, target, expected)
    const decision = transaction.decisions.find((entry) => entry.slug === target.slug)
    articleResults.push({ article_id: target.article_id, slug: target.slug, result: decision.result, changed_rows: decision.result === 'applied' ? 1 : 0,
      resulting_version: expected.article.version, resulting_status: expected.article.status,
      before_hash: canonicalJsonHash(before[target.slug]), after_hash: canonicalJsonHash(expected),
      readbacks: { persistence: { result: 'MATCH', actual: expected }, public_api: publicReadback } })
  }
  if (typeof adapter.readLegacyFieldCorrectionDom !== 'function') fail('legacy target DOM reader is missing')
  domReadback = validateLegacyCorrectionDomV1(await adapter.readLegacyFieldCorrectionDom(release), release, transaction.after)
  } catch (error) {
    const pending = { schema: 'content_publish_receipt.v2', mode: LEGACY_FIELD_CORRECTION_MODE, operation: 'article_correction', release_hash: release.release_hash,
      work_order_id: workOrder.work_order_id, completion_state: 'PUBLISHED_READBACK_PENDING', seo_live_claim: false, applied_at: appliedAt,
      snapshot: { path: snapshotPath, content_hash: snapshot.content_hash }, atomic_batch: { result: 'COMMITTED', transaction_id: transaction.transaction_id },
      persistence_after: transaction.after, article_results: articleResults, readback_error: String(error.message) }
    writeJsonAtomic(receiptPath, { ...pending, content_hash: artifactHashV2(pending) })
    throw error
  }
  const base = { schema: 'content_publish_receipt.v2', mode: LEGACY_FIELD_CORRECTION_MODE, operation: 'article_correction',
    release_hash: release.release_hash, work_order_id: workOrder.work_order_id, target: release.publish_target,
    correction_input_receipt_hash: release.input.content_hash, correction_review_hash: release.review.content_hash,
    review_execution_receipt_hash: release.review_execution_receipt.content_hash, completion_state: 'COMPLETE', seo_live_claim: false,
    target_dom_seo: domReadback,
    executor: { role: 'deterministic-content-publication-executor', id: `machine-${adapter.kind}` }, applied_at: appliedAt,
    snapshot: { path: snapshotPath, content_hash: snapshot.content_hash },
    atomic_batch: { result: 'COMMITTED', scope: 'existing_article_fields_only', transaction_id: transaction.transaction_id,
      article_ids: release.input.affected_article_ids, unchanged: ['sources', 'ingredient_relations', 'interpretations', 'parts', 'article_titles', 'stored_seo', 'article_bodies'] },
    article_results: articleResults }
  const receipt = { ...base, content_hash: artifactHashV2(base) }
  writeJsonAtomic(receiptPath, receipt)
  return receipt
}

export async function exportSiteLinkInventorySourceV2({ workOrder, adapter, root, outputPath = null }) {
  validateDeterministicWorkOrderV2(workOrder, { kind: 'link_inventory_source_readback' })
  if (workOrder.assignee?.role !== 'deterministic-link-inventory-exporter') fail('link inventory WorkOrder role is invalid')
  const output = workOrder.outputs.find((entry) => entry.name === 'link_inventory_source' && entry.schema === 'site_link_inventory_source.v2')
  if (!output) fail('link inventory WorkOrder has no canonical output')
  const routes = (await adapter.readRoutes()).map((route) => {
    const sourceUrls = array(route.source_urls ?? [], `authoritative link inventory ${route.path}.source_urls`)
      .map((url, index) => text(url, `authoritative link inventory ${route.path}.source_urls[${index}]`))
      .filter((url) => /^https?:\/\//i.test(url) || /^\/wissen\/[a-z0-9]+(?:-[a-z0-9]+)*$/.test(url))
    if (new Set(sourceUrls).size !== sourceUrls.length) fail(`authoritative link inventory ${route.path}.source_urls contains duplicates`)
    return { path: route.path, slug: route.slug, title: route.title, meta_title: text(route.meta_title ?? route.title, `authoritative link inventory ${route.path}.meta_title`), meta_description: text(route.meta_description, `authoritative link inventory ${route.path}.meta_description`), article_layer: text(route.article_layer, `authoritative link inventory ${route.path}.article_layer`), source_urls: sourceUrls.sort() }
  }).sort((a, b) => a.path.localeCompare(b.path))
  if (new Set(routes.map((route) => route.path)).size !== routes.length) fail('authoritative link inventory returned duplicate routes')
  for (const route of routes) if (route.path !== `/wissen/${route.slug}` || !route.title || !['main_article', 'single_study'].includes(route.article_layer)) fail(`authoritative link inventory route ${route.path} is invalid`)
  const base = { schema: 'site_link_inventory_source.v2', authority: adapter.authority, exported_at: now(), routes }
  const value = { ...base, content_hash: artifactHashV2(base) }
  const destination = outputPath ?? resolve(root, output.path)
  writeJsonAtomic(destination, value)
  return value
}

export async function resolveIngredientTargetV1({ context, workOrder, adapter }) {
  validateDeterministicWorkOrderV2(workOrder, { kind: 'ingredient_target_readback', runId: context.runId })
  if (workOrder.assignee?.role !== 'deterministic-ingredient-target-resolver') fail('ingredient target WorkOrder role is invalid')
  if (context.publish?.required !== true) fail('ingredient target publication preflight is not available for a draft-only run')
  const selector = object(workOrder.task?.selector, 'ingredient target WorkOrder selector')
  const output = workOrder.outputs.find((entry) => entry.name === 'ingredient_target_receipt' && entry.schema === 'ingredient_target_receipt.v1')
  if (!output) fail('ingredient target WorkOrder output is missing')
  const target = await adapter.resolveIngredientTarget(selector)
  const base = { schema: 'ingredient_target_receipt.v1', run_id: context.runId, authority: adapter.authority, selector, target, captured_at: now(), work_order_id: workOrder.work_order_id }
  const receipt = { ...base, content_hash: artifactHashV2(base) }
  writeJsonAtomic(outputAbsolute(context, output), receipt)
  return receipt
}

export async function readArticleTargetsV1({ context, workOrder, adapter }) {
  validateDeterministicWorkOrderV2(workOrder, { kind: 'article_target_readback', runId: context.runId })
  if (workOrder.assignee?.role !== 'deterministic-article-target-reader' || context.publish?.required !== true) fail('article target readback role/publish scope is invalid')
  const selectors = array(workOrder.task?.articles, 'article target WorkOrder articles')
  if (!selectors.length || new Set(selectors.map((entry) => entry.article_id)).size !== selectors.length || selectors.some((entry) => !HASH.test(entry.expected_payload_hash ?? '') || !Number.isInteger(entry.expected_version) || entry.expected_version < 1)) fail('article target WorkOrder selectors are invalid')
  const output = workOrder.outputs.find((entry) => entry.name === 'article_target_receipt' && entry.schema === 'article_target_receipt.v1')
  if (!output || typeof adapter.readArticleTargets !== 'function') fail('article target WorkOrder output/adapter is incomplete')
  const rows = await adapter.readArticleTargets(selectors)
  if (!sameSet(rows.map((entry) => entry.article_id), selectors.map((entry) => entry.article_id))) fail('article target adapter returned a different article set')
  for (const selector of selectors) {
    const row = rows.find((entry) => entry.article_id === selector.article_id)
    if (row.slug !== selector.slug || row.status !== selector.expected_status || Number(row.version) !== selector.expected_version || row.payload_hash !== selector.expected_payload_hash) fail(`${selector.article_id} authoritative update guard differs during timestamp readback`)
    const createdAt = iso(row.created_at, `${selector.article_id} created_at`), updatedAt = iso(row.updated_at, `${selector.article_id} updated_at`)
    if (Date.parse(updatedAt) < Date.parse(createdAt)) fail(`${selector.article_id} authoritative updated_at predates created_at`)
  }
  const base = {
    schema: 'article_target_receipt.v1', run_id: context.runId, target: context.publish.target, result: 'PASS', work_order_id: workOrder.work_order_id,
    executor: { role: 'deterministic-article-target-reader', id: `machine-${adapter.kind ?? 'adapter'}` }, captured_at: now(),
    articles: rows.map((entry) => ({ article_id: entry.article_id, slug: entry.slug, status: entry.status, version: Number(entry.version), payload_hash: entry.payload_hash, created_at: entry.created_at, updated_at: entry.updated_at })).sort((left, right) => left.article_id.localeCompare(right.article_id)),
  }
  const receipt = { ...base, content_hash: artifactHashV2(base) }
  writeJsonAtomic(outputAbsolute(context, output), receipt)
  return receipt
}

export async function syncSourceCatalogV1({ context, workOrder, adapter, syncEnabled = false }) {
  validateDeterministicWorkOrderV2(workOrder, { kind: 'source_catalog_sync', runId: context.runId })
  if (workOrder.assignee?.role !== 'deterministic-source-catalog-sync') fail('source catalog sync WorkOrder role is invalid')
  if (context.publish?.required !== true || !syncEnabled) fail('source catalog synchronization is disabled; it requires an explicit publish request and --publish authorization')
  const target = validateBoundInput(context, workOrder, 'ingredient_target_receipt', { schema: 'ingredient_target_receipt.v1' }).value
  const request = validateBoundInput(context, workOrder, 'source_catalog_sync_request', { schema: 'source_catalog_sync_request.v1' }).value
  if (request.run_id !== context.runId || request.ingredient_target_hash !== target.target?.identity_hash || request.ingredient_id !== target.target?.ingredient_id || request.content_hash !== artifactHashV2(request)) fail('source catalog sync request/ingredient target binding is invalid')
  const output = workOrder.outputs.find((entry) => entry.name === 'source_resolution_receipt' && entry.schema === 'source_resolution_receipt.v1')
  if (!output) fail('source catalog sync WorkOrder output is missing')
  const mappings = await adapter.syncSourceCatalog(request)
  const base = {
    schema: 'source_resolution_receipt.v1', run_id: context.runId, request_hash: request.content_hash, ingredient_target_hash: request.ingredient_target_hash, ingredient_id: request.ingredient_id,
    result: 'PASS', work_order_id: workOrder.work_order_id, executor: { role: 'deterministic-source-catalog-sync', id: `machine-${adapter.kind}` }, resolved_at: now(), mappings,
  }
  const receipt = { ...base, content_hash: artifactHashV2(base) }
  writeJsonAtomic(outputAbsolute(context, output), receipt)
  return receipt
}

export function activateFrameworkCatalogV1({ context, workOrder, activationEnabled = false }) {
  validateDeterministicWorkOrderV2(workOrder, { kind: 'framework_catalog_activate', runId: context.runId })
  if (workOrder.assignee?.role !== 'deterministic-framework-catalog-activator') fail('framework activation WorkOrder role is invalid')
  if (!activationEnabled) fail('framework catalog activation is disabled; pass the explicit activate-framework flag after reviewing candidate, pilots and guards')
  const candidate = validateBoundInput(context, workOrder, 'candidate_framework')
  const catalogCandidateBinding = validateBoundInput(context, workOrder, 'catalog_candidate', { schema: 'framework_catalog_candidate.v1' })
  const pilotBinding = validateBoundInput(context, workOrder, 'framework_pilot', { schema: 'article_framework_pilot_receipt.v2' })
  const currentCatalogBinding = validateBoundInput(context, workOrder, 'current_framework_catalog', { schema: 'framework_catalog.v1', root: 'repo' })
  const ownerBinding = workOrder.task.owner_approval_hash == null ? null : validateBoundInput(context, workOrder, 'owner_approval', { schema: 'framework_owner_approval_receipt.v1' })
  const outputFramework = workOrder.outputs.find((output) => output.name === 'activated_framework' && output.root === 'repo' && output.media_type === 'text/markdown')
  const outputCatalog = workOrder.outputs.find((output) => output.name === 'activated_framework_catalog' && output.root === 'repo' && output.schema === 'framework_catalog.v1')
  const outputReceipt = workOrder.outputs.find((output) => output.name === 'activation_receipt' && output.schema === 'framework_catalog_activation_receipt.v1')
  if (!outputFramework || !outputCatalog || !outputReceipt) fail('framework activation output bindings are incomplete')
  const targetPath = outputAbsolute(context, outputFramework), catalogPath = outputAbsolute(context, outputCatalog), receiptPath = outputAbsolute(context, outputReceipt)
  const repoRoot = machineRepoRoot(context)
  if (targetPath !== resolve(repoRoot, workOrder.task.target_framework_path) || catalogPath !== currentCatalogBinding.path || catalogPath !== resolve(repoRoot, 'codex-files/frameworks/framework-catalog.v1.json')) fail('framework activation outputs differ from the guarded target/catalog paths')
  if (existsSync(targetPath)) fail('framework activation no-overwrite guard found an existing target framework path')
  const candidateBytes = readFileSync(candidate.path)
  const frameworkByteHash = sha256Bytes(candidateBytes)
  const catalogCandidate = catalogCandidateBinding.value, pilot = pilotBinding.value, currentCatalog = currentCatalogBinding.value
  if (catalogCandidate.schema !== 'framework_catalog_candidate.v1' || catalogCandidate.content_hash !== artifactHashV2(catalogCandidate) || catalogCandidate.content_hash !== workOrder.task.catalog_candidate_hash || catalogCandidate.expected_catalog_byte_hash !== currentCatalogBinding.input.byte_hash) fail('framework catalog candidate schema/hash/old-catalog guard is invalid')
  if (currentCatalogBinding.input.byte_hash !== workOrder.task.expected_catalog_byte_hash || currentCatalogBinding.input.byte_hash !== sha256Bytes(readFileSync(catalogPath))) fail('framework catalog changed after activation WorkOrder issuance')
  if (frameworkByteHash !== workOrder.task.candidate_framework_byte_hash || catalogCandidate.entry?.framework_sha256 !== frameworkByteHash || catalogCandidate.entry?.path !== workOrder.task.target_framework_path || catalogCandidate.entry?.framework_id !== workOrder.task.framework_id || catalogCandidate.entry?.version !== workOrder.task.framework_version || catalogCandidate.entry?.status !== 'approved') fail('framework candidate entry differs from target/task bytes')
  if (pilot.schema !== 'article_framework_pilot_receipt.v2' || pilot.content_hash !== artifactHashV2(pilot) || pilot.content_hash !== workOrder.task.pilot_hash || pilot.result !== 'PASS' || pilot.candidate_framework_byte_hash !== frameworkByteHash || pilot.catalog_candidate_hash !== catalogCandidate.content_hash) fail('framework composite pilot is invalid/stale')
  if (ownerBinding) {
    const approval = ownerBinding.value
    if (approval.schema !== 'framework_owner_approval_receipt.v1' || approval.content_hash !== artifactHashV2(approval) || approval.content_hash !== workOrder.task.owner_approval_hash || approval.decision !== 'APPROVED' || approval.framework_byte_hash !== frameworkByteHash || approval.catalog_candidate_hash !== catalogCandidate.content_hash || approval.pilot_hash !== pilot.content_hash) fail('framework Owner approval is invalid/stale')
  }
  const frameworks = array(currentCatalog.frameworks, 'current framework catalog frameworks')
  if (frameworks.some((entry) => entry.framework_id === catalogCandidate.entry.framework_id && entry.version === catalogCandidate.entry.version || entry.path === catalogCandidate.entry.path)) fail('framework activation would overwrite an existing ID/version or path')
  const nextCatalogBase = {
    ...currentCatalog,
    catalog_version: bumpPatchVersion(currentCatalog.catalog_version),
    updated_at: now().slice(0, 10),
    frameworks: [...frameworks, catalogCandidate.entry].sort((left, right) => `${left.stage}:${left.framework_id}:${left.version}`.localeCompare(`${right.stage}:${right.framework_id}:${right.version}`)),
  }
  const nextCatalogBytes = Buffer.from(`${JSON.stringify(nextCatalogBase, null, 2)}\n`, 'utf8')
  const resultingCatalogByteHash = sha256Bytes(nextCatalogBytes)
  mkdirSync(dirname(targetPath), { recursive: true }); mkdirSync(dirname(receiptPath), { recursive: true })
  const suffix = `${process.pid}-${Date.now()}`
  const stagedFramework = `${targetPath}.activate-${suffix}`, stagedCatalog = `${catalogPath}.activate-${suffix}`, catalogBackup = `${catalogPath}.backup-${suffix}`
  writeFileSync(stagedFramework, candidateBytes); writeFileSync(stagedCatalog, nextCatalogBytes); writeFileSync(catalogBackup, readFileSync(catalogPath))
  let frameworkPromoted = false, catalogPromoted = false
  try {
    if (existsSync(targetPath) || sha256Bytes(readFileSync(catalogPath)) !== workOrder.task.expected_catalog_byte_hash) fail('framework activation guards changed during staging')
    renameSync(stagedFramework, targetPath); frameworkPromoted = true
    renameSync(catalogPath, `${catalogPath}.old-${suffix}`)
    try {
      renameSync(stagedCatalog, catalogPath); catalogPromoted = true
      rmSync(`${catalogPath}.old-${suffix}`, { force: true })
    } catch (error) {
      if (existsSync(`${catalogPath}.old-${suffix}`)) renameSync(`${catalogPath}.old-${suffix}`, catalogPath)
      throw error
    }
    if (sha256Bytes(readFileSync(targetPath)) !== frameworkByteHash || sha256Bytes(readFileSync(catalogPath)) !== resultingCatalogByteHash) fail('framework activation targeted readback differs')
    const base = {
      schema: 'framework_catalog_activation_receipt.v1', result: 'PASS', run_id: context.runId, work_order_id: workOrder.work_order_id,
      gap_id: workOrder.task.gap_id, framework_id: workOrder.task.framework_id, framework_version: workOrder.task.framework_version,
      target_framework_path: workOrder.task.target_framework_path, framework_byte_hash: frameworkByteHash,
      catalog_candidate_hash: catalogCandidate.content_hash, pilot_hash: pilot.content_hash, owner_approval_hash: ownerBinding?.value.content_hash ?? null,
      expected_catalog_byte_hash: workOrder.task.expected_catalog_byte_hash, resulting_catalog_byte_hash: resultingCatalogByteHash,
      atomic_bundle: { result: 'COMMITTED', transaction_id: `framework-${workOrder.work_order_id.slice(-16)}-${Date.now()}`, outputs: [outputFramework.path, outputCatalog.path].sort() },
      activated_at: now(), readback: { framework_byte_hash: sha256Bytes(readFileSync(targetPath)), catalog_byte_hash: sha256Bytes(readFileSync(catalogPath)), catalog_entry_count: nextCatalogBase.frameworks.length },
    }
    const receipt = { ...base, content_hash: artifactHashV2(base) }
    writeJsonAtomic(receiptPath, receipt)
    rmSync(catalogBackup, { force: true })
    return receipt
  } catch (error) {
    rmSync(stagedFramework, { force: true }); rmSync(stagedCatalog, { force: true })
    if (frameworkPromoted && existsSync(targetPath)) rmSync(targetPath, { force: true })
    if (catalogPromoted && existsSync(catalogBackup)) {
      rmSync(catalogPath, { force: true })
      renameSync(catalogBackup, catalogPath)
    } else rmSync(catalogBackup, { force: true })
    throw error
  }
}

function outputAbsolute(context, output) { return resolve(output.root === 'repo' ? machineRepoRoot(context) : context.root, output.path) }

export async function dispatchDeterministicWorkOrderV2({ context, workOrder, adapter, publishEnabled = false, frameworkActivationEnabled = false }) {
  validateDeterministicWorkOrderV2(workOrder, { runId: context.runId })
  const startedAt = now()
  let result
  if (workOrder.kind === 'ingredient_target_readback') result = await resolveIngredientTargetV1({ context, workOrder, adapter })
  else if (workOrder.kind === 'article_target_readback') result = await readArticleTargetsV1({ context, workOrder, adapter })
  else if (workOrder.kind === 'source_catalog_sync') result = await syncSourceCatalogV1({ context, workOrder, adapter, syncEnabled: publishEnabled })
  else if (workOrder.kind === 'asset_stage') result = await stageArticleAssetsV1({ context, workOrder, stagingEnabled: publishEnabled })
  else if (workOrder.kind === 'link_inventory_source_readback') {
    const output = workOrder.outputs.find((entry) => entry.name === 'link_inventory_source')
    result = await exportSiteLinkInventorySourceV2({ workOrder, adapter, root: context.root, outputPath: outputAbsolute(context, output) })
  }
  else if (workOrder.kind === 'publication_apply') {
    const input = workOrder.inputs.find((entry) => entry.name === 'content_release' && entry.schema === 'content_release.v2')
    const output = workOrder.outputs.find((entry) => entry.name === 'publish_receipt')
    if (!input || !output) fail('publication_apply input/output binding is incomplete')
    const releasePath = resolve(context.root, input.path)
    const release = strictJson(releasePath, 'content release input')
    if (sha256Bytes(readFileSync(releasePath)) !== input.byte_hash || release.release_hash !== input.content_hash) fail('publication_apply content release bytes/hash differ from WorkOrder')
    result = await applyContentReleaseV2({ release, workOrder, adapter, publishEnabled, receiptPath: outputAbsolute(context, output) })
  }
  else if (workOrder.kind === 'framework_catalog_activate') result = activateFrameworkCatalogV1({ context, workOrder, activationEnabled: frameworkActivationEnabled })
  else fail(`no deterministic machine executor is registered for WorkOrder kind ${workOrder.kind}`)
  const resultHash = result.content_hash ?? result.release_hash ?? canonicalJsonHash(result)
  if (!HASH.test(resultHash)) fail(`${workOrder.kind} produced no hashable deterministic result`)
  const executionReceiptBase = {
    schema: 'work_order_execution_receipt.v1', run_id: workOrder.run_id, work_order_id: workOrder.work_order_id,
    execution_class: workOrder.execution_class, reasoning_tier: workOrder.reasoning_tier,
    executor: { role: workOrder.assignee.role, id: `machine-${adapter.kind ?? 'adapter'}` }, started_at: startedAt, finished_at: now(), result: 'PASS', result_hash: resultHash,
  }
  const executionReceiptPath = assertContained(context.root, resolve(context.root, workOrder.execution_receipt.path), `${workOrder.kind} execution receipt`)
  writeJsonAtomic(executionReceiptPath, { ...executionReceiptBase, content_hash: artifactHashV2(executionReceiptBase) })
  return result
}

export async function dispatchNutrientContentMachinesV2({ manifestPath, adapter, publishEnabled = false, frameworkActivationEnabled = false, maxTransitions = 8 }) {
  if (!Number.isInteger(maxTransitions) || maxTransitions < 1 || maxTransitions > 16) fail('machine dispatcher maxTransitions must be 1..16')
  const context = loadNutrientContentRunManifest(manifestPath)
  const transitions = []
  for (let index = 0; index < maxTransitions; index += 1) {
    const status = runNutrientContent({ manifestPath })
    const deterministic = status.work_orders.work_orders.filter((order) => order.execution_class === 'deterministic')
    if (!deterministic.length) return { status, transitions }
    const completed = await Promise.all(deterministic.map(async (workOrder) => {
      const result = await dispatchDeterministicWorkOrderV2({ context, workOrder, adapter, publishEnabled, frameworkActivationEnabled })
      return { kind: workOrder.kind, work_order_id: workOrder.work_order_id, result_hash: result.content_hash ?? result.release_hash ?? canonicalJsonHash(result) }
    }))
    transitions.push(...completed)
  }
  fail(`machine dispatcher exceeded bounded transition limit ${maxTransitions}`)
}

export { PUBLIC_READBACK_CLI }
