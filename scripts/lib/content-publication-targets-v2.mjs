import { canonicalJsonHash } from './content-validation.mjs'
import { artifactHashV2, sourceCitationLabelV2 } from './evidence-pipeline-v2.mjs'
import { assertSafeId } from './safe-paths.mjs'

const HASH = /^sha256:[a-f0-9]{64}$/

function fail(message) { throw new Error(message) }
function object(value, label) { if (!value || typeof value !== 'object' || Array.isArray(value)) fail(`${label} must be an object`); return value }
function array(value, label) { if (!Array.isArray(value)) fail(`${label} must be an array`); return value }
function text(value, label) { if (typeof value !== 'string' || !value.trim()) fail(`${label} must be a non-empty string`); return value.trim() }
function iso(value, label) { const result = text(value, label); if (!Number.isFinite(Date.parse(result))) fail(`${label} must be ISO-8601`); return result }
function sameSet(left, right) { const a = new Set(left), b = new Set(right); return a.size === left.length && b.size === right.length && a.size === b.size && [...a].every((entry) => b.has(entry)) }

export function canonicalIngredientSlug(value) {
  return text(value, 'ingredient name')
    .toLocaleLowerCase('de-DE')
    .replace(/\u00df/g, 'ss')
    .replace(/\u00e4/g, 'ae')
    .replace(/\u00f6/g, 'oe')
    .replace(/\u00fc/g, 'ue')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

export function normalizeIngredientTargetSelector(value, substanceSlug) {
  const selector = object(value, 'manifest.ingredient_target')
  const canonicalName = text(selector.canonical_name, 'manifest.ingredient_target.canonical_name')
  const expectedId = selector.expected_ingredient_id == null ? null : Number(selector.expected_ingredient_id)
  if (expectedId != null && (!Number.isInteger(expectedId) || expectedId <= 0)) fail('manifest.ingredient_target.expected_ingredient_id must be a positive integer or null')
  const canonicalSlug = canonicalIngredientSlug(canonicalName)
  if (canonicalSlug !== substanceSlug) fail(`ingredient target canonical name resolves to ${canonicalSlug}, not substance slug ${substanceSlug}`)
  return { substance_slug: substanceSlug, canonical_name: canonicalName, expected_ingredient_id: expectedId }
}

export function validateIngredientTargetReceiptV1({ receipt, runId, selector, issuedWorkOrders = [], allowUnissuedTestReceipt = false, expectedOutputPath = null }) {
  object(receipt, 'ingredient target receipt')
  if (receipt.schema !== 'ingredient_target_receipt.v1' || receipt.content_hash !== artifactHashV2(receipt) || receipt.run_id !== runId || canonicalJsonHash(receipt.selector) !== canonicalJsonHash(selector)) fail('ingredient target receipt schema/hash/run/selector is invalid')
  iso(receipt.captured_at, 'ingredient target receipt captured_at'); text(receipt.authority, 'ingredient target receipt authority')
  const target = object(receipt.target, 'ingredient target receipt target')
  const ingredientId = Number(target.ingredient_id), version = Number(target.version)
  if (!Number.isInteger(ingredientId) || ingredientId <= 0 || !Number.isInteger(version) || version <= 0 || target.status !== 'active') fail('ingredient target receipt must bind one positive, versioned, active ingredient')
  const canonicalName = text(target.canonical_name, 'ingredient target canonical_name')
  if (target.canonical_slug !== selector.substance_slug || canonicalIngredientSlug(canonicalName) !== target.canonical_slug || canonicalName.toLocaleLowerCase('de-DE') !== selector.canonical_name.toLocaleLowerCase('de-DE') || selector.expected_ingredient_id != null && ingredientId !== selector.expected_ingredient_id) fail('ingredient target receipt identity differs from its selector')
  const identity = { ingredient_id: ingredientId, canonical_name: canonicalName, canonical_slug: target.canonical_slug, status: target.status, version }
  if (target.identity_hash !== canonicalJsonHash(identity)) fail('ingredient target identity hash is stale')
  if (!allowUnissuedTestReceipt) {
    const order = issuedWorkOrders.find((entry) => entry.work_order_id === receipt.work_order_id)
    const output = order?.outputs?.find((entry) => entry.name === 'ingredient_target_receipt' && entry.schema === receipt.schema)
    if (!order || order.kind !== 'ingredient_target_readback' || order.execution_class !== 'deterministic' || order.assignee?.role !== 'deterministic-ingredient-target-resolver' || !output || expectedOutputPath && output.path !== expectedOutputPath) fail('ingredient target receipt does not bind its exact issued deterministic WorkOrder/output')
  }
  return { ...identity, identity_hash: target.identity_hash, receipt_hash: receipt.content_hash, receipt }
}

function normalizeDoi(value) {
  if (value == null || value === '') return null
  const stripped = String(value).trim().replace(/^https?:\/\/(?:dx\.)?doi\.org\//i, '').replace(/^doi:\s*/i, '')
  let normalized
  try { normalized = decodeURIComponent(stripped).toLowerCase() } catch { fail(`invalid DOI encoding ${value}`) }
  if (!/^10\.\d{4,9}\/.+/.test(normalized)) fail(`invalid DOI ${value}`)
  return normalized
}

function normalizePubmed(value) {
  if (value == null || value === '') return null
  const normalized = String(value).trim().replace(/^pmid:\s*/i, '')
  if (!/^\d+$/.test(normalized)) fail(`invalid PubMed ID ${value}`)
  return normalized
}

function canonicalSourceUrl(value) {
  let parsed
  try { parsed = new URL(text(value, 'source URL')) } catch { fail(`invalid source URL ${value}`) }
  if (!['http:', 'https:'].includes(parsed.protocol) || parsed.username || parsed.password || !parsed.hostname) fail(`invalid source URL ${value}`)
  parsed.hash = ''
  for (const key of [...parsed.searchParams.keys()]) if (/^utm_|^(?:fbclid|gclid)$/i.test(key)) parsed.searchParams.delete(key)
  return parsed.href
}

export function buildSourceCatalogSyncRequestV1({ runId, ingredientTarget, sources }) {
  const normalized = array(sources, 'source catalog sources').map((source, index) => {
    object(source, `source catalog sources[${index}]`)
    const sourceId = assertSafeId(source.source_id, `source catalog sources[${index}].source_id`)
    const canonicalUrl = canonicalSourceUrl(source.canonical_url ?? source.source_url ?? source.url)
    const doiFromUrl = /doi\.org\//i.test(canonicalUrl) ? normalizeDoi(canonicalUrl) : null
    const pubmedFromUrl = /pubmed\.ncbi\.nlm\.nih\.gov\/\d+/i.exec(canonicalUrl)?.[0]?.match(/\d+/)?.[0] ?? null
    const explicitDoi = normalizeDoi(source.doi)
    const explicitPubmed = normalizePubmed(source.pubmed_id ?? source.pmid)
    if (explicitDoi && doiFromUrl && explicitDoi !== doiFromUrl) fail(`source ${sourceId} explicit DOI conflicts with its canonical URL`)
    if (explicitPubmed && pubmedFromUrl && explicitPubmed !== pubmedFromUrl) fail(`source ${sourceId} explicit PubMed ID conflicts with its canonical URL`)
    const sourceKind = text(source.source_kind, `${sourceId}.source_kind`)
    if (!['official', 'study'].includes(sourceKind)) fail(`${sourceId}.source_kind must be official or study`)
    const publicationYear = source.publication_year == null ? null : Number(source.publication_year)
    const citationMetadata = {
      author_or_institution: text(source.author_or_institution, `${sourceId}.author_or_institution`), publication_year: publicationYear,
      title: text(source.title, `${sourceId}.title`), journal_or_publisher: text(source.journal_or_publisher, `${sourceId}.journal_or_publisher`),
      // A present `doi` field is authoritative even when it is explicitly null:
      // repository/archive locators can themselves use a DOI without that DOI
      // belonging to the cited original source. Only infer from the URL when the
      // source metadata omitted the DOI field altogether.
      doi: Object.hasOwn(source, 'doi') ? explicitDoi : doiFromUrl, pmid: explicitPubmed ?? pubmedFromUrl,
    }
    const label = text(source.label, `${sourceId}.label`)
    if (label !== sourceCitationLabelV2(citationMetadata)) fail(`source ${sourceId} label differs from its deterministic citation metadata`)
    return {
      source_id: sourceId, source_type: text(source.source_type, `${sourceId}.source_type`), source_kind: sourceKind,
      ...citationMetadata, label, canonical_url: canonicalUrl, doi: citationMetadata.doi, pubmed_id: citationMetadata.pmid,
      source_content_hash: text(source.source_content_hash, `${sourceId}.source_content_hash`),
    }
  }).sort((left, right) => left.source_id.localeCompare(right.source_id))
  if (!normalized.length || new Set(normalized.map((source) => source.source_id)).size !== normalized.length || normalized.some((source) => !HASH.test(source.source_content_hash))) fail('source catalog request needs unique sources with SHA-256 content hashes')
  const base = {
    schema: 'source_catalog_sync_request.v1', run_id: runId, ingredient_target_hash: ingredientTarget.identity_hash, ingredient_id: ingredientTarget.ingredient_id,
    sources: normalized,
  }
  return { ...base, content_hash: artifactHashV2(base) }
}

export function validateSourceResolutionReceiptV1({ receipt, request, issuedWorkOrders, expectedOutputPath = null, allowUnissuedTestReceipt = false }) {
  object(receipt, 'source resolution receipt')
  if (receipt.schema !== 'source_resolution_receipt.v1' || receipt.content_hash !== artifactHashV2(receipt) || receipt.result !== 'PASS' || receipt.run_id !== request.run_id || receipt.request_hash !== request.content_hash || receipt.ingredient_target_hash !== request.ingredient_target_hash || receipt.ingredient_id !== request.ingredient_id) fail('source resolution receipt schema/hash/request/ingredient/result is invalid')
  iso(receipt.resolved_at, 'source resolution receipt resolved_at')
  if (!allowUnissuedTestReceipt) {
    const order = issuedWorkOrders.find((entry) => entry.work_order_id === receipt.work_order_id)
    const output = order?.outputs?.find((entry) => entry.name === 'source_resolution_receipt' && entry.schema === receipt.schema)
    if (!order || order.kind !== 'source_catalog_sync' || order.execution_class !== 'deterministic' || order.assignee?.role !== 'deterministic-source-catalog-sync' || !output || expectedOutputPath && output.path !== expectedOutputPath) fail('source resolution receipt does not bind its exact issued deterministic WorkOrder/output')
  }
  const mappings = array(receipt.mappings, 'source resolution receipt mappings')
  if (!sameSet(mappings.map((mapping) => mapping.source_id), request.sources.map((source) => source.source_id))) fail('source resolution receipt mapping set differs from request')
  const bySourceId = new Map()
  for (const mapping of mappings) {
    const source = request.sources.find((entry) => entry.source_id === mapping.source_id)
    const resolvedId = Number(mapping.resolved_source_id), version = Number(mapping.persisted_version)
    if (!source || !Number.isInteger(resolvedId) || resolvedId <= 0 || !Number.isInteger(version) || version <= 0 || !['existing', 'created'].includes(mapping.resolution) || mapping.canonical_url !== source.canonical_url || mapping.doi !== source.doi || mapping.pubmed_id !== source.pubmed_id || !HASH.test(mapping.persisted_hash ?? '')) fail(`source resolution mapping ${mapping.source_id ?? '(missing)'} is invalid`)
    bySourceId.set(mapping.source_id, { ...mapping, resolved_source_id: resolvedId, persisted_version: version })
  }
  return { receipt, receipt_hash: receipt.content_hash, bySourceId }
}

function interpretationFact(fact) {
  return {
    record_id: fact.record_id, obligation_id: fact.obligation_id, source_id: fact.source_id, cluster_id: fact.cluster_id, claim_type: fact.claim_type,
    subject_key: fact.subject_key, predicate_key: fact.predicate_key, context: fact.context, conflict_set_id: fact.conflict_set_id, claim: fact.claim,
    population_context: fact.population_context ?? null, value: fact.value ?? null, unit: fact.unit ?? null, effect_direction: fact.effect_direction ?? null,
    uncertainty: fact.uncertainty ?? null, locator: fact.locator,
  }
}

export function buildStage2InterpretationProjectionV1({ article, factsPackage, ingredientTarget, sourceResolution }) {
  if (article.stage !== 'stage2') return []
  const projections = []
  for (const source of factsPackage.visible_sources) {
    const mapping = sourceResolution.bySourceId.get(source.source_id)
    if (!mapping) fail(`${article.article_id} source ${source.source_id} has no authoritative catalog resolution`)
    const facts = factsPackage.facts.filter((fact) => fact.source_id === source.source_id).map(interpretationFact).sort((left, right) => left.record_id.localeCompare(right.record_id))
    // Meta-analysis constituents remain visible original-source relations, but
    // only fact-bearing sources own an accepted interpretation projection.
    if (!facts.length) continue
    const structuredSummary = {
      schema: 'study_interpretation_summary.v1', source_id: source.source_id, source_content_hash: source.source_content_hash,
      facts_package_hash: factsPackage.article_package_hash, evidence_membership_hash: factsPackage.evidence_membership_hash, record_ids: facts.map((fact) => fact.record_id), facts,
    }
    const base = {
      ingredient_id: ingredientTarget.ingredient_id, local_source_id: source.source_id, resolved_source_id: mapping.resolved_source_id, knowledge_article_slug: article.slug,
      status: 'accepted', structured_summary: structuredSummary, structured_summary_hash: canonicalJsonHash(structuredSummary), stage3_reference_summary: null,
      source_resolution_receipt_hash: sourceResolution.receipt_hash,
    }
    projections.push({ ...base, projection_hash: canonicalJsonHash(base) })
  }
  return projections.sort((left, right) => left.local_source_id.localeCompare(right.local_source_id))
}
