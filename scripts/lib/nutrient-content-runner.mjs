import { appendFileSync, existsSync, mkdirSync, readFileSync, rmSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { performance } from 'node:perf_hooks'
import { fileURLToPath } from 'node:url'
import { canonicalJsonHash, decodeUtf8Strict, sha256Bytes } from './content-validation.mjs'
import {
  EVIDENCE_V2_REPO_ROOT,
  artifactHashV2,
  buildEvidencePipelineV2,
  loadEvidenceManifestV2,
  validateCoveragePlanV2,
  validateEvidencePipelineLockV2,
  validateFactsPackageForImportV2,
  validateStackProjectionV2,
} from './evidence-pipeline-v2.mjs'
import {
  MAX_REVISION,
  buildContentReleaseV2,
  compileArticleV2,
  compiledArticlePath,
  publicationReviewPath,
  validatePublicationReviewV2,
  validatePublishReceiptV2,
  validationReceiptPath,
  writerWorkOrderIdV2,
  writerReceiptPath,
  writeJsonAtomic,
} from './article-runtime-v2.mjs'
import {
  assertContained,
  assertNoPathCollisions,
  assertOwnedPath,
  assertSafeId,
  isContained,
  portablePath,
  resolveManifestPath,
} from './safe-paths.mjs'
import {
  buildCorrectionContentReleaseV2,
  loadArticleCorrectionInputReceiptV1,
  validateArticleCorrectionResultV1,
  validateArticleCorrectionReviewV1,
  validateCorrectionClassV1,
  validateAuthoritativeCorrectionBeforeV1,
} from './article-correction-v1.mjs'
import {
  buildSourceCatalogSyncRequestV1,
  normalizeIngredientTargetSelector,
  validateIngredientTargetReceiptV1,
  validateSourceResolutionReceiptV1,
} from './content-publication-targets-v2.mjs'
import {
  buildAssetDeploymentRequestV1,
  validateAssetDeploymentReceiptV1,
} from './article-asset-deployment-v1.mjs'
import { validateIndexabilityReleaseReceiptV1 } from './indexability-release-v1.mjs'

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const STYLE_SNAPSHOT_PATH = resolve(REPO_ROOT, 'codex-files/frameworks/stage3-style-snapshots.v1.json')
const FRAMEWORK_CATALOG_PATH = resolve(REPO_ROOT, 'codex-files/frameworks/framework-catalog.v1.json')
const HASH = /^sha256:[a-f0-9]{64}$/
export const RUN_SCHEMA = 'nutrient_content_run.v2'
export const RELEASE_SCHEMA = 'content_release.v2'
export const RUNNER_VERSION = 'nutrient-content-runner.v2.2.0'
export const ARTICLE_VALIDATOR_VERSION = 'article-validator.v2.3.0'
export const EVIDENCE_VALIDATOR_VERSION = 'evidence-pipeline-builder.v2.0.0'
export const RENDERER_VERSION = 'knowledge-magazine-react-ssr.v2.2.1'
export const RUN_STATES = Object.freeze([
  'WAITING_FOR_CORRECTION',
  'WAITING_FOR_CORRECTION_REVIEW',
  'WAITING_FOR_RESEARCH',
  'WAITING_FOR_INGREDIENT_TARGET',
  'WAITING_FOR_ARTICLE_TARGETS',
  'WAITING_FOR_SOURCE_CATALOG_SYNC',
  'WAITING_FOR_ASSET_DEPLOYMENT',
  'WAITING_FOR_FRAMEWORK',
  'WAITING_FOR_TECHNICAL_FRAMEWORK_CHANGE',
  'WAITING_FOR_LINK_INVENTORY',
  'WAITING_FOR_SOURCE_EXTRACTION',
  'WAITING_FOR_SOURCE_REVIEW',
  'WAITING_FOR_WRITERS',
  'WAITING_FOR_PUBLICATION_QA',
  'WAITING_FOR_STAGE4',
  'WAITING_FOR_INDEXABILITY_RELEASE',
  'READY_TO_PUBLISH',
  'COMPLETE',
  'BLOCKED',
])
export const WORK_ORDER_KIND_CONTRACTS = Object.freeze({
  article_correction: Object.freeze({ execution_class: 'llm', roles: ['article-correction-editor'], required_outputs: [{ name: 'correction_result', schema: 'article_correction_result.v1' }] }),
  article_correction_review: Object.freeze({ execution_class: 'llm', roles: ['article-correction-reviewer'], required_outputs: [{ name: 'correction_review', schema: 'article_correction_review.v1' }] }),
  research: Object.freeze({ execution_class: 'llm', roles: ['nutrient-research-analyst'], required_outputs: [{ name: 'source_artifact_receipt', schema: 'research_source_artifact_receipt.v2' }] }),
  research_source_freeze: Object.freeze({ execution_class: 'llm', roles: ['nutrient-research-analyst'], required_outputs: [{ name: 'source_artifact_receipt', schema: 'research_source_artifact_receipt.v2' }] }),
  ingredient_target_readback: Object.freeze({ execution_class: 'deterministic', roles: ['deterministic-ingredient-target-resolver'], required_outputs: [{ name: 'ingredient_target_receipt', schema: 'ingredient_target_receipt.v1' }] }),
  article_target_readback: Object.freeze({ execution_class: 'deterministic', roles: ['deterministic-article-target-reader'], required_outputs: [{ name: 'article_target_receipt', schema: 'article_target_receipt.v1' }] }),
  source_catalog_sync: Object.freeze({ execution_class: 'deterministic', roles: ['deterministic-source-catalog-sync'], required_outputs: [{ name: 'source_resolution_receipt', schema: 'source_resolution_receipt.v1' }] }),
  asset_stage: Object.freeze({ execution_class: 'deterministic', roles: ['deterministic-article-asset-stager'], required_outputs: [{ name: 'asset_deployment_receipt', schema: 'asset_deployment_receipt.v1' }] }),
  link_inventory_source_readback: Object.freeze({ execution_class: 'deterministic', roles: ['deterministic-link-inventory-exporter'], required_outputs: [{ name: 'link_inventory_source', schema: 'site_link_inventory_source.v2' }] }),
  coverage_planning: Object.freeze({ execution_class: 'llm', roles: ['coverage-planner'], required_outputs: [{ name: 'coverage_plan', schema: 'coverage_plan.v2' }] }),
  framework_design: Object.freeze({ execution_class: 'llm', roles: ['article-framework-designer'], required_outputs: [] }),
  framework_runtime_change_handoff: Object.freeze({ execution_class: 'human', roles: ['framework-runtime-change-owner'], required_outputs: [] }),
  framework_owner_approval: Object.freeze({ execution_class: 'human', roles: ['framework-owner-approver'], required_outputs: [{ name: 'owner_approval', schema: 'framework_owner_approval_receipt.v1' }] }),
  framework_catalog_activate: Object.freeze({ execution_class: 'deterministic', roles: ['deterministic-framework-catalog-activator'], required_outputs: [{ name: 'activation_receipt', schema: 'framework_catalog_activation_receipt.v1' }] }),
  source_extraction: Object.freeze({ execution_class: 'llm', roles: ['source-evidence-extractor'], required_outputs: [{ name: 'evidence_shard', schema: 'source_evidence_shard.v2' }] }),
  source_extraction_repair: Object.freeze({ execution_class: 'llm', roles: ['source-evidence-extractor'], required_outputs: [{ name: 'evidence_shard', schema: 'source_evidence_shard.v2' }] }),
  source_facts_review: Object.freeze({ execution_class: 'llm', roles: ['source-facts-reviewer'], required_outputs: [{ name: 'source_facts_review', schema: 'source_facts_review.v2' }] }),
  writer: Object.freeze({ execution_class: 'llm', roles: ['clinical-study-interpreter', 'german-health-science-writer'], required_outputs: [{ name: 'article_result', schema: 'article_result.v2' }] }),
  writer_revision: Object.freeze({ execution_class: 'llm', roles: ['clinical-study-interpreter', 'german-health-science-writer'], required_outputs: [{ name: 'article_result', schema: 'article_result.v2' }] }),
  writer_repair: Object.freeze({ execution_class: 'llm', roles: ['clinical-study-interpreter', 'german-health-science-writer'], required_outputs: [{ name: 'article_result', schema: 'article_result.v2' }] }),
  writer_repair_escalation: Object.freeze({ execution_class: 'human', roles: ['content-pipeline-escalation-owner'], required_outputs: [{ name: 'escalation_resolution', schema: 'writer_repair_escalation_resolution.v1' }] }),
  publication_qa: Object.freeze({ execution_class: 'llm', roles: ['article-reader-acceptance-reviewer'], required_outputs: [{ name: 'publication_review', schema: 'article_publication_review.v2' }] }),
  stage4_stack_sync: Object.freeze({ execution_class: 'llm', roles: ['stage4-stack-sync'], required_outputs: [{ name: 'stack_projection', schema: 'stack_projection.v2' }, { name: 'stack_sync_receipt', schema: 'stack_sync_receipt.v2' }] }),
  publication_apply: Object.freeze({ execution_class: 'deterministic', roles: ['deterministic-content-publication-executor'], required_outputs: [{ name: 'publish_receipt', schema: 'content_publish_receipt.v2' }] }),
  indexability_release_handoff: Object.freeze({ execution_class: 'human', roles: ['site-indexability-release-owner'], required_outputs: [] }),
})
const REASONING_TIER_RANK = Object.freeze({ standard: 0, high: 1, xhigh: 2 })
const REASONING_TIER_FLOORS = Object.freeze({
  article_correction: 'standard', article_correction_review: 'standard', research: 'standard', research_source_freeze: 'standard',
  source_extraction: 'standard', source_extraction_repair: 'high', coverage_planning: 'high', source_facts_review: 'standard', writer: 'high', writer_revision: 'high', writer_repair: 'high',
  publication_qa: 'high', stage4_stack_sync: 'high', framework_design: 'xhigh', framework_runtime_change_handoff: 'xhigh', framework_owner_approval: 'high',
})

function minimumReasoningTier(kind, executionClass) {
  if (kind.endsWith('_escalation')) return 'xhigh'
  return REASONING_TIER_FLOORS[kind] ?? (executionClass === 'llm' ? 'high' : 'standard')
}
export const STATE_WORK_ORDER_MATRIX = Object.freeze({
  WAITING_FOR_CORRECTION: Object.freeze(['article_correction']),
  WAITING_FOR_CORRECTION_REVIEW: Object.freeze(['article_correction_review']),
  WAITING_FOR_RESEARCH: Object.freeze(['research', 'research_source_freeze', 'link_inventory_source_readback', 'coverage_planning']),
  WAITING_FOR_INGREDIENT_TARGET: Object.freeze(['ingredient_target_readback', 'article_target_readback']),
  WAITING_FOR_ARTICLE_TARGETS: Object.freeze(['article_target_readback', 'ingredient_target_readback', 'source_catalog_sync']),
  WAITING_FOR_SOURCE_CATALOG_SYNC: Object.freeze(['source_catalog_sync']),
  WAITING_FOR_ASSET_DEPLOYMENT: Object.freeze(['asset_stage', 'article_target_readback', 'ingredient_target_readback', 'source_catalog_sync']),
  WAITING_FOR_FRAMEWORK: Object.freeze(['framework_design', 'framework_owner_approval', 'framework_catalog_activate']),
  WAITING_FOR_TECHNICAL_FRAMEWORK_CHANGE: Object.freeze(['framework_runtime_change_handoff']),
  WAITING_FOR_LINK_INVENTORY: Object.freeze(['link_inventory_source_readback']),
  WAITING_FOR_SOURCE_EXTRACTION: Object.freeze(['source_extraction', 'source_extraction_repair']),
  WAITING_FOR_SOURCE_REVIEW: Object.freeze(['source_facts_review']),
  WAITING_FOR_WRITERS: Object.freeze(['writer', 'writer_revision', 'writer_repair', 'stage4_stack_sync', 'stage4_receipt_integrity_escalation']),
  WAITING_FOR_PUBLICATION_QA: Object.freeze(['publication_qa', 'stage4_stack_sync', 'stage4_receipt_integrity_escalation']),
  WAITING_FOR_STAGE4: Object.freeze(['stage4_stack_sync', 'stage4_receipt_integrity_escalation']),
  WAITING_FOR_INDEXABILITY_RELEASE: Object.freeze(['indexability_release_handoff', 'stage4_stack_sync', 'stage4_receipt_integrity_escalation']),
  READY_TO_PUBLISH: Object.freeze(['publication_apply', 'stage4_stack_sync', 'stage4_receipt_integrity_escalation']),
  COMPLETE: Object.freeze(['stage4_stack_sync', 'stage4_receipt_integrity_escalation']),
  BLOCKED: Object.freeze(['stage4_stack_sync', '*_escalation']),
})

function fail(message) { throw new Error(message) }
function object(value, label) { if (!value || typeof value !== 'object' || Array.isArray(value)) fail(`${label} must be an object`); return value }
function array(value, label) { if (!Array.isArray(value)) fail(`${label} must be an array`); return value }
function text(value, label) { if (typeof value !== 'string' || !value.trim()) fail(`${label} must be a non-empty string`); return value.trim() }
function iso(value, label) { const result = text(value, label); if (!Number.isFinite(Date.parse(result))) fail(`${label} must be ISO-8601`); return new Date(result).toISOString() }
function sameSet(left, right) { const a = new Set(left), b = new Set(right); return a.size === left.length && b.size === right.length && a.size === b.size && [...a].every((entry) => b.has(entry)) }
function strictJson(path, label) {
  const decoded = decodeUtf8Strict(readFileSync(path), label)
  if (decoded.errors.length) fail(decoded.errors.join('; '))
  try { return JSON.parse(decoded.text) } catch (error) { fail(`${label} is invalid JSON: ${error.message}`) }
}

function assertWorkOrderDispatch(state, workOrders) {
  const allowed = STATE_WORK_ORDER_MATRIX[state]
  if (!allowed) fail(`run state ${state} has no WorkOrder dispatch contract`)
  if (state.startsWith('WAITING_') && !workOrders.length) fail(`${state} requires at least one WorkOrder`)
  for (const order of workOrders) {
    const escalation = order.kind.endsWith('_escalation')
    if (!allowed.includes(order.kind) && !(escalation && allowed.includes('*_escalation'))) fail(`${state} cannot dispatch WorkOrder kind ${order.kind}`)
    if (order.execution_receipt?.root !== 'run' || order.execution_receipt?.schema !== 'work_order_execution_receipt.v1' || typeof order.execution_receipt?.path !== 'string' || !order.execution_receipt.path.endsWith('.work-order-execution-receipt.v1.json')) fail(`${order.kind} execution_receipt binding is invalid`)
    if (!Object.hasOwn(REASONING_TIER_RANK, order.reasoning_tier)) fail(`${order.kind} reasoning_tier is invalid`)
    const tierFloor = minimumReasoningTier(order.kind, order.execution_class)
    if (REASONING_TIER_RANK[order.reasoning_tier] < REASONING_TIER_RANK[tierFloor]) fail(`${order.kind} reasoning_tier cannot be lower than ${tierFloor}`)
    if (escalation && !WORK_ORDER_KIND_CONTRACTS[order.kind]) {
      if (order.execution_class !== 'human' || order.wave_index !== null || order.assignee?.role !== 'content-pipeline-escalation-owner' || order.outputs.length) fail(`${order.kind} does not match the human escalation contract`)
      continue
    }
    const contract = WORK_ORDER_KIND_CONTRACTS[order.kind]
    if (!contract) fail(`WorkOrder kind ${order.kind} has no executor/receipt contract`)
    if (order.execution_class !== contract.execution_class || (contract.execution_class === 'llm') !== Number.isInteger(order.wave_index) || !contract.roles.includes(order.assignee?.role)) fail(`${order.kind} executor class, wave, or role differs from its contract`)
    for (const required of contract.required_outputs) {
      if (!order.outputs.some((output) => output.name === required.name && output.schema === required.schema)) fail(`${order.kind} is missing required ${required.schema} output ${required.name}`)
    }
  }
  if (state === 'READY_TO_PUBLISH' && workOrders.filter((order) => order.kind === 'publication_apply').length !== 1) fail('READY_TO_PUBLISH requires exactly one deterministic publication_apply WorkOrder')
  if (state === 'COMPLETE' && workOrders.some((order) => !['stage4_stack_sync', 'stage4_receipt_integrity_escalation'].includes(order.kind))) fail('COMPLETE may only carry the optional unfinished or integrity-blocked Stage-4 child WorkOrder')
  if (state === 'BLOCKED' && !workOrders.some((order) => order.kind.endsWith('_escalation'))) fail('BLOCKED requires an explicit human escalation WorkOrder')
}

function environmentRoot(manifestPath, mode) {
  const absolute = resolve(manifestPath)
  if (mode === 'production') {
    assertContained(REPO_ROOT, absolute, 'production run manifest')
    return REPO_ROOT
  }
  if (mode !== 'test') fail('manifest.mode must be explicit production or test')
  return dirname(absolute)
}

function normalizePublicBaseUrl(value, mode) {
  const raw = text(value ?? 'https://supplementstack.de', 'manifest.publish.public_base_url')
  let parsed
  try { parsed = new URL(raw) } catch { fail('manifest.publish.public_base_url must be a valid HTTP(S) origin') }
  if (!['http:', 'https:'].includes(parsed.protocol) || parsed.username || parsed.password || parsed.search || parsed.hash || parsed.pathname !== '/') fail('manifest.publish.public_base_url must be an HTTP(S) origin')
  if (mode === 'production' && parsed.protocol !== 'https:') fail('production manifest.publish.public_base_url must use HTTPS')
  return parsed.href
}

function normalizeWriteGuard(value, label) {
  object(value, label)
  if (value.mode === 'create') {
    if (value.expected_status !== 'absent' || Number(value.expected_version) !== 0) fail(`${label} create requires expected_status=absent and expected_version=0`)
    return { mode: 'create', expected_status: 'absent', expected_version: 0 }
  }
  if (value.mode !== 'update') fail(`${label}.mode must be create or update`)
  const version = Number(value.expected_version)
  if (!Number.isInteger(version) || version < 1) fail(`${label}.expected_version must be a positive integer`)
  if (!['draft', 'published', 'archived'].includes(value.expected_status)) fail(`${label}.expected_status is invalid`)
  if (!/^sha256:[a-f0-9]{64}$/.test(value.expected_payload_hash ?? '')) fail(`${label}.expected_payload_hash is invalid`)
  return { mode: 'update', expected_status: value.expected_status, expected_version: version, expected_payload_hash: value.expected_payload_hash }
}

function normalizeRetireArticle(value, label) {
  object(value, label)
  const articleId = assertSafeId(value.article_id, `${label}.article_id`)
  const slug = assertSafeId(value.slug, `${label}.slug`)
  const expectedVersion = Number(value.expected_version)
  if (!Number.isInteger(expectedVersion) || expectedVersion < 1) fail(`${label}.expected_version must be a positive integer`)
  if (value.expected_status !== 'published') fail(`${label}.expected_status must equal published`)
  if (!HASH.test(value.expected_payload_hash ?? '')) fail(`${label}.expected_payload_hash is invalid`)
  return {
    article_id: articleId,
    slug,
    expected_status: value.expected_status,
    expected_version: expectedVersion,
    expected_payload_hash: value.expected_payload_hash,
  }
}

function normalizeStage4WriteGuard(value, label) {
  object(value, label)
  if (value.mode !== 'atomic_projection_replace') fail(`${label}.mode must equal atomic_projection_replace`)
  const targets = array(value.targets, `${label}.targets`).map((target, index) => {
    object(target, `${label}.targets[${index}]`)
    const targetKey = assertSafeId(target.target_key, `${label}.targets[${index}].target_key`)
    const ingredientId = Number(target.ingredient_id)
    if (!Number.isInteger(ingredientId) || ingredientId <= 0) fail(`${label}.${targetKey}.ingredient_id must be a positive integer`)
    const populationKey = text(target.population_key, `${label}.${targetKey}.population_key`)
    if (!['adult', 'pregnant', 'breastfeeding', 'children', 'elderly'].includes(populationKey)) fail(`${label}.${targetKey}.population_key is invalid`)
    if (!['absent', 'draft', 'active', 'archived'].includes(target.expected_status)) fail(`${label}.${targetKey}.expected_status is invalid`)
    const expectedVersion = Number(target.expected_version)
    if (!Number.isInteger(expectedVersion) || expectedVersion < 0 || (target.expected_status === 'absent') !== (expectedVersion === 0)) fail(`${label}.${targetKey}.expected_version is inconsistent with status`)
    const expectedPayloadHash = target.expected_status === 'absent' ? null : target.expected_payload_hash
    if (target.expected_status === 'absent' ? target.expected_payload_hash !== null : !HASH.test(expectedPayloadHash ?? '')) fail(`${label}.${targetKey}.expected_payload_hash is invalid`)
    return { target_key: targetKey, ingredient_id: ingredientId, population_key: populationKey, expected_status: target.expected_status, expected_version: expectedVersion, expected_payload_hash: expectedPayloadHash }
  }).sort((a, b) => a.target_key.localeCompare(b.target_key))
  if (!targets.length || new Set(targets.map((target) => target.target_key)).size !== targets.length || new Set(targets.map((target) => `${target.ingredient_id}:${target.population_key}`)).size !== targets.length) fail(`${label}.targets must be non-empty and unique by key and ingredient/population`)
  if (Number(value.expected_record_count) !== targets.length) fail(`${label}.expected_record_count must equal targets.length`)
  return { mode: 'atomic_projection_replace', expected_record_count: targets.length, targets }
}

function validateStage4TargetPrestate(context) {
  if (!context.stage4.prestate_path) return null
  const snapshot = strictJson(context.stage4.prestate_path, 'Stage-4 target prestate')
  if (snapshot.schema !== 'stage4_target_prestate.v1' || snapshot.content_hash !== artifactHashV2(snapshot) || snapshot.run_id !== context.runId || snapshot.target !== context.stage4.target) fail('Stage-4 target prestate schema/hash/lineage differs')
  const target = context.stage4.write_guard.targets.find((entry) => entry.ingredient_id === Number(snapshot.selector?.ingredient_id) && entry.population_key === snapshot.selector?.population_key)
  if (!target || context.stage4.write_guard.targets.length !== 1 || snapshot.write_guard?.target_key !== target.target_key || snapshot.write_guard?.expected_status !== target.expected_status || Number(snapshot.write_guard?.expected_version) !== target.expected_version || snapshot.write_guard?.expected_payload_hash !== target.expected_payload_hash) fail('Stage-4 target prestate write guard differs from the manifest')
  if (!Array.isArray(snapshot.rows) || snapshot.rows.length !== Number(snapshot.row_count) || snapshot.row_count < 1 || new Set(snapshot.rows.map((row) => Number(row.id))).size !== snapshot.rows.length || !sameSet(snapshot.row_ids.map(Number), snapshot.rows.map((row) => Number(row.id)))) fail('Stage-4 target prestate physical row set is invalid')
  const material = { schema: 'stage4_target_prestate_material.v1', ingredient_id: target.ingredient_id, population_key: target.population_key, rows: snapshot.rows }
  if (canonicalJsonHash(material) !== target.expected_payload_hash || canonicalJsonHash(snapshot.rows) !== snapshot.row_hash) fail('Stage-4 target prestate physical payload hash differs')
  const provenance = object(snapshot.provenance, 'Stage-4 target prestate provenance')
  const attestationPath = resolveManifestPath(context.root, provenance.attestation_path, 'Stage-4 target prestate attestation_path')
  const attestation = strictJson(attestationPath, 'Stage-4 target prestate attestation')
  if (attestation.schema !== 'stage4_target_prestate_attestation.v1' || attestation.mode !== 'production' || attestation.execution_mode !== 'live' || attestation.status !== 'pass' || attestation.content_hash !== artifactHashV2(attestation) || attestation.content_hash !== provenance.attestation_hash || attestation.database_id !== snapshot.database_id || attestation.account_id !== provenance.account_id || attestation.database_name !== provenance.database_name || attestation.binding !== provenance.binding || attestation.shell !== false) fail('Stage-4 target prestate production attestation differs')
  const stdoutPath = resolveManifestPath(context.root, attestation.stdout_artifact_path, 'Stage-4 target prestate stdout_artifact_path')
  const authPath = resolveManifestPath(context.root, attestation.auth_artifact_path, 'Stage-4 target prestate auth_artifact_path')
  if (sha256Bytes(readFileSync(stdoutPath)) !== attestation.stdout_byte_hash || sha256Bytes(readFileSync(authPath)) !== attestation.auth_stdout_byte_hash || provenance.stdout_byte_hash !== attestation.stdout_byte_hash || provenance.auth_stdout_byte_hash !== attestation.auth_stdout_byte_hash) fail('Stage-4 target prestate attested command bytes differ')
  return { value: snapshot, path: context.stage4.prestate_path, hash: snapshot.content_hash }
}

function normalizeArticle(entry, stage, context, index) {
  object(entry, `article_plan.${stage}[${index}]`)
  const articleId = assertSafeId(entry.article_id, `article_plan.${stage}[${index}].article_id`)
  const forbiddenOverrides = ['facts_package_path', 'writer_receipt_path', 'publication_qa_path', 'compiled_path', 'validation_receipt_path', 'asset_receipt_paths']
  const presentOverrides = forbiddenOverrides.filter((key) => Object.hasOwn(entry, key))
  if (presentOverrides.length) fail(`article ${articleId} contains forbidden derived-path overrides: ${presentOverrides.join(', ')}`)
  const articleSlug = assertSafeId(entry.slug, `article ${articleId}.slug`)
  const changeClass = text(entry.change_class ?? 'L', `article ${articleId}.change_class`)
  if (!['L', 'M', 'S'].includes(changeClass)) fail(`article ${articleId}.change_class must be L, M or S`)
  const renderProfile = stage === 'stage3' ? text(entry.render_profile ?? context.renderProfile, `${articleId}.render_profile`) : 'study_article_v2'
  if (stage === 'stage3' && renderProfile !== 'knowledge_magazine_v1') fail(`${articleId} Stage-3 render_profile must equal knowledge_magazine_v1`)
  const article = {
    article_id: articleId,
    stage,
    slug: articleSlug,
    change_class: changeClass,
    markdown_path: resolveManifestPath(context.root, entry.markdown_path, `${articleId}.markdown_path`),
    render_profile: renderProfile,
    write_guard: normalizeWriteGuard(entry.write_guard, `${articleId}.write_guard`),
  }
  if (entry.authoritative_before != null) {
    const binding = object(entry.authoritative_before, `${articleId}.authoritative_before`)
    const path = resolveManifestPath(context.root, binding.path, `${articleId}.authoritative_before.path`)
    const snapshot = strictJson(path, `${articleId}.authoritative_before`)
    validateAuthoritativeCorrectionBeforeV1(snapshot, article)
    if (binding.content_hash !== snapshot.content_hash) fail(`${articleId} authoritative-before binding hash differs`)
    article.authoritative_before = snapshot
    article.authoritative_before_path = path
    article.update_reason = text(binding.update_reason, `${articleId}.authoritative_before.update_reason`)
  }
  return article
}

function loadArticleCorrectionRunContext({ absolute, root, mode, raw, runId, substance, policyVersion, renderProfile }) {
  const outputs = object(raw.outputs, 'correction manifest.outputs')
  const unsupported = Object.keys(outputs).filter((key) => key !== 'state_dir')
  if (unsupported.length) fail(`correction manifest.outputs contains unsupported overrides: ${unsupported.join(', ')}`)
  const stateDir = resolveManifestPath(root, outputs.state_dir, 'correction manifest.outputs.state_dir')
  if (stateDir === root) fail('correction state_dir must be below the run root')
  const correction = object(raw.correction, 'manifest.correction')
  const changeClass = text(correction.change_class, 'manifest.correction.change_class')
  if (!['S', 'M', 'L'].includes(changeClass)) fail('manifest.correction.change_class must be S, M or L')
  const inputReceiptPath = resolveManifestPath(root, correction.input_receipt_path, 'manifest.correction.input_receipt_path')
  if (isContained(stateDir, inputReceiptPath)) fail('correction input receipt cannot be inside generated state_dir')
  const publish = object(raw.publish, 'manifest.publish')
  if ((publish.retire_articles ?? []).length) fail('manifest.publish.retire_articles is only supported for operation=full_pipeline')
  const context = {
    absolute, root, mode, manifest: raw, manifestHash: canonicalJsonHash(raw), operation: 'article_correction', runId,
    substance, policyVersion, renderProfile, stateDir, evidenceDir: resolve(stateDir, 'unused-evidence'),
    workOrdersPath: resolve(stateDir, 'work-orders.v2.json'), workOrderHistoryPath: resolve(stateDir, 'work-orders-history.v2.jsonl'), metricsPath: resolve(stateDir, 'metrics', 'run-metrics.v2.jsonl'),
    releasePath: resolve(stateDir, 'release', 'content-release.v2.json'), publishReceiptPath: resolve(stateDir, 'publish', 'content-publish-receipt.v2.json'),
    indexabilityReleaseReceiptPath: resolve(stateDir, 'publish', 'indexability-release-receipt.v1.json'), indexabilityRendererRequestPath: resolve(stateDir, 'publish', 'indexability-renderer-public-readback-request.v2.json'), indexabilityRendererReceiptPath: resolve(stateDir, 'publish', 'indexability-renderer-public-readback-receipt.v2.json'),
    stage4ProjectionPath: resolve(stateDir, 'stage4', 'stack-projection.v2.json'), stage4ReceiptPath: resolve(stateDir, 'stage4', 'stack-sync-receipt.v2.json'),
    publish: { required: publish.required === true, target: text(publish.target, 'manifest.publish.target'), publicBaseUrl: normalizePublicBaseUrl(publish.public_base_url, mode), retireArticles: [] },
    stage4: { enabled: false, target: null, write_guard: null }, validatorVersion: ARTICLE_VALIDATOR_VERSION, evidenceValidatorVersion: EVIDENCE_VALIDATOR_VERSION, rendererVersion: RENDERER_VERSION,
    correction: {
      changeClass, inputReceiptPath,
      resultPath: resolve(stateDir, 'correction', 'article-correction-result.v1.json'),
      reviewPath: resolve(stateDir, 'correction', 'article-correction-review.v1.json'),
      affectedPipelineManifestPath: changeClass === 'L' ? resolveManifestPath(root, correction.affected_pipeline_manifest_path, 'manifest.correction.affected_pipeline_manifest_path') : null,
    },
  }
  const input = loadArticleCorrectionInputReceiptV1({ root, path: inputReceiptPath, runId, changeClass })
  context.correction.input = input
  const article = { article_id: input.candidateArticle.article_id, stage: input.candidateArticle.stage, slug: input.candidateArticle.slug, change_class: changeClass, markdown_path: input.candidatePath, render_profile: input.candidateArticle.stage === 'stage3' ? renderProfile : 'study_article_v2', write_guard: input.candidateArticle.write_guard }
  context.articles = { stage2: article.stage === 'stage2' ? [article] : [], stage3: article.stage === 'stage3' ? [article] : [], all: [article] }
  return context
}

export function loadNutrientContentRunManifest(manifestPath) {
  const absolute = resolve(manifestPath)
  if (!existsSync(absolute)) fail(`run manifest does not exist: ${absolute}`)
  const rawProbe = strictJson(absolute, 'nutrient content run manifest')
  if (rawProbe.schema !== RUN_SCHEMA) fail(`manifest.schema must equal ${RUN_SCHEMA}`)
  const mode = text(rawProbe.mode, 'manifest.mode')
  const root = environmentRoot(absolute, mode)
  const runId = assertSafeId(rawProbe.run_id, 'manifest.run_id')
  const substance = object(rawProbe.substance, 'manifest.substance')
  const substanceSlug = assertSafeId(substance.slug, 'manifest.substance.slug')
  const language = text(substance.language, 'manifest.substance.language')
  const policyVersion = text(object(rawProbe.policy, 'manifest.policy').version, 'manifest.policy.version')
  const renderProfile = text(rawProbe.render_profile ?? 'knowledge_magazine_v1', 'manifest.render_profile')
  if (renderProfile !== 'knowledge_magazine_v1') fail('manifest.render_profile must equal knowledge_magazine_v1')
  const operation = rawProbe.operation ?? 'full_pipeline'
  if (!['full_pipeline', 'article_correction'].includes(operation)) fail('manifest.operation must be full_pipeline or article_correction')
  if (operation === 'article_correction') return loadArticleCorrectionRunContext({ absolute, root, mode, raw: rawProbe, runId, substance: { slug: substanceSlug, language }, policyVersion, renderProfile })
  const ingredientTargetSelector = normalizeIngredientTargetSelector(rawProbe.ingredient_target, substanceSlug)
  const inputs = object(rawProbe.inputs, 'manifest.inputs')
  const outputs = object(rawProbe.outputs, 'manifest.outputs')
  const allowedOutputs = new Set(['state_dir', 'evidence_dir'])
  const unsupported = Object.keys(outputs).filter((key) => !allowedOutputs.has(key))
  if (unsupported.length) fail(`manifest.outputs contains unsupported path overrides: ${unsupported.join(', ')}`)
  const stateDir = resolveManifestPath(root, outputs.state_dir, 'manifest.outputs.state_dir')
  const evidenceDir = resolveManifestPath(root, outputs.evidence_dir, 'manifest.outputs.evidence_dir')
  if (stateDir === root || evidenceDir === root || isContained(stateDir, evidenceDir) || isContained(evidenceDir, stateDir)) fail('state_dir and evidence_dir must be distinct non-nested directories below the run root')
  const context = { root, stateDir, evidenceDir, renderProfile }
  const plan = object(rawProbe.article_plan, 'manifest.article_plan')
  const stage2 = array(plan.stage2, 'manifest.article_plan.stage2').map((entry, index) => normalizeArticle(entry, 'stage2', context, index))
  const stage3 = array(plan.stage3, 'manifest.article_plan.stage3').map((entry, index) => normalizeArticle(entry, 'stage3', context, index))
  const all = [...stage2, ...stage3]
  if (new Set(all.map((entry) => entry.article_id)).size !== all.length) fail('article IDs must be globally unique')
  if (new Set(all.map((entry) => entry.slug)).size !== all.length) fail('article slugs must be globally unique')
  const researchPath = resolveManifestPath(root, inputs.research_path, 'manifest.inputs.research_path')
  const coveragePlanPath = resolveManifestPath(root, inputs.coverage_plan_path, 'manifest.inputs.coverage_plan_path')
  const evidenceManifestPath = resolveManifestPath(root, inputs.evidence_build_manifest_path, 'manifest.inputs.evidence_build_manifest_path')
  const linkInventorySourcePath = resolveManifestPath(root, inputs.link_inventory_source_path, 'manifest.inputs.link_inventory_source_path')
  const sourceArtifactReceiptPath = resolveManifestPath(root, inputs.source_artifact_receipt_path, 'manifest.inputs.source_artifact_receipt_path')
  const ingredientTargetReceiptProvided = Object.hasOwn(inputs, 'ingredient_target_receipt_path')
  const ingredientTargetReceiptPath = ingredientTargetReceiptProvided
    ? resolveManifestPath(root, inputs.ingredient_target_receipt_path, 'manifest.inputs.ingredient_target_receipt_path')
    : resolve(stateDir, 'preflight', 'ingredient-target-receipt.v1.json')
  const sourceResolutionReceiptProvided = Object.hasOwn(inputs, 'source_resolution_receipt_path')
  const sourceResolutionReceiptPath = sourceResolutionReceiptProvided
    ? resolveManifestPath(root, inputs.source_resolution_receipt_path, 'manifest.inputs.source_resolution_receipt_path')
    : resolve(stateDir, 'preflight', 'source-resolution-receipt.v1.json')
  const stage4 = object(rawProbe.stage4 ?? { enabled: false }, 'manifest.stage4')
  if (typeof stage4.enabled !== 'boolean') fail('manifest.stage4.enabled must be boolean')
  const stage4Target = stage4.enabled ? text(stage4.target ?? rawProbe.publish?.target, 'manifest.stage4.target') : null
  const stage4WriteGuard = stage4.enabled ? normalizeStage4WriteGuard(stage4.write_guard, 'manifest.stage4.write_guard') : null
  const stage4PrestatePath = stage4.enabled && stage4.prestate_path ? resolveManifestPath(root, stage4.prestate_path, 'manifest.stage4.prestate_path') : null
  const inputPaths = [absolute, researchPath, coveragePlanPath, evidenceManifestPath, linkInventorySourcePath, sourceArtifactReceiptPath, ...(ingredientTargetReceiptProvided ? [ingredientTargetReceiptPath] : []), ...(sourceResolutionReceiptProvided ? [sourceResolutionReceiptPath] : []), ...(stage4PrestatePath ? [stage4PrestatePath] : []), ...all.map((entry) => entry.markdown_path), ...all.flatMap(entry => entry.authoritative_before_path ? [entry.authoritative_before_path] : [])]
  assertNoPathCollisions(inputPaths.map((path, index) => ({ path, label: index === 0 ? 'run manifest' : `run input ${index}`, kind: 'input' })))
  for (const [label, outputDir] of [['state_dir', stateDir], ['evidence_dir', evidenceDir]]) {
    if (inputPaths.some((path) => isContained(outputDir, path))) fail(`${label} cannot contain a run input`)
  }
  const publish = object(rawProbe.publish, 'manifest.publish')
  if (all.some(article => article.authoritative_before) && (all.length !== 1 || stage4.enabled || (publish.retire_articles ?? []).length)) fail('L authoritative-before child must contain exactly one article without retirements or Stage 4')
  for (const article of all.filter(entry => entry.authoritative_before)) if (article.authoritative_before.database_name !== publish.target) fail('L authoritative-before database target differs from child publish target')
  const publicBaseUrl = normalizePublicBaseUrl(publish.public_base_url, mode)
  const retireArticles = array(publish.retire_articles ?? [], 'manifest.publish.retire_articles')
    .map((entry, index) => normalizeRetireArticle(entry, `manifest.publish.retire_articles[${index}]`))
    .sort((left, right) => left.article_id.localeCompare(right.article_id))
  if (retireArticles.length && publish.required !== true) fail('manifest.publish.retire_articles requires publish.required=true')
  if (new Set(retireArticles.map((entry) => entry.article_id)).size !== retireArticles.length || new Set(retireArticles.map((entry) => entry.slug)).size !== retireArticles.length) fail('manifest.publish.retire_articles IDs/slugs must be unique')
  const activeIds = new Set(all.map((entry) => entry.article_id)), activeSlugs = new Set(all.map((entry) => entry.slug))
  for (const target of retireArticles) {
    if (activeIds.has(target.article_id) || activeSlugs.has(target.slug)) fail(`retirement target ${target.article_id}/${target.slug} collides with an active release article`)
  }
  const result = {
    absolute, root, mode, manifest: rawProbe, manifestHash: canonicalJsonHash(rawProbe), operation: 'full_pipeline', runId,
    substance: { slug: substanceSlug, language }, policyVersion, renderProfile,
    researchPath, coveragePlanPath, evidenceManifestPath, linkInventorySourcePath, linkInventoryPath: resolve(stateDir, 'preflight', 'site-link-inventory.v2.json'), sourceArtifactReceiptPath, sourceArtifactRootPath: resolve(dirname(sourceArtifactReceiptPath), 'source-artifacts'), evidenceDir, stateDir,
    ingredientTargetSelector, ingredientTargetReceiptPath, ingredientTargetReceiptProvided,
    articleTargetReceiptPath: resolve(stateDir, 'preflight', 'article-target-receipt.v1.json'),
    sourceCatalogRequestPath: resolve(stateDir, 'preflight', 'source-catalog-sync-request.v1.json'), sourceResolutionReceiptPath, sourceResolutionReceiptProvided,
    assetDeploymentRequestPath: resolve(stateDir, 'preflight', 'asset-deployment-request.v1.json'), assetDeploymentReceiptPath: resolve(stateDir, 'preflight', 'asset-deployment-receipt.v1.json'),
    workOrdersPath: resolve(stateDir, 'work-orders.v2.json'), workOrderHistoryPath: resolve(stateDir, 'work-orders-history.v2.jsonl'), metricsPath: resolve(stateDir, 'metrics', 'run-metrics.v2.jsonl'),
    releasePath: resolve(stateDir, 'release', 'content-release.v2.json'), publishReceiptPath: resolve(stateDir, 'publish', 'content-publish-receipt.v2.json'),
    indexabilityReleaseReceiptPath: resolve(stateDir, 'publish', 'indexability-release-receipt.v1.json'), indexabilityRendererRequestPath: resolve(stateDir, 'publish', 'indexability-renderer-public-readback-request.v2.json'), indexabilityRendererReceiptPath: resolve(stateDir, 'publish', 'indexability-renderer-public-readback-receipt.v2.json'),
    stage4ProjectionPath: resolve(stateDir, 'stage4', 'stack-projection.v2.json'), stage4ReceiptPath: resolve(stateDir, 'stage4', 'stack-sync-receipt.v2.json'),
    articles: { stage2, stage3, all }, publish: { required: publish.required === true, target: text(publish.target, 'manifest.publish.target'), publicBaseUrl, retireArticles },
    stage4: { enabled: stage4.enabled, target: stage4Target, write_guard: stage4WriteGuard, prestate_path: stage4PrestatePath }, validatorVersion: ARTICLE_VALIDATOR_VERSION, evidenceValidatorVersion: EVIDENCE_VALIDATOR_VERSION, rendererVersion: RENDERER_VERSION,
  }
  return result
}

function binding(context, path, extra = {}) {
  return { path: portablePath(context.root, path), byte_hash: sha256Bytes(readFileSync(path)), ...extra }
}

function validateResearchBytes(context) {
  const bytes = readFileSync(context.researchPath)
  const decoded = decodeUtf8Strict(bytes, 'opaque research input')
  if (decoded.errors.length) fail(decoded.errors.join('; '))
  return { byteHash: sha256Bytes(bytes), bytes }
}

function loadSourceArtifactReceipt(context) {
  const receipt = strictJson(context.sourceArtifactReceiptPath, 'research source artifact receipt')
  if (receipt.schema !== 'research_source_artifact_receipt.v2' || receipt.content_hash !== artifactHashV2(receipt)) fail('research source artifact receipt schema/content hash is invalid')
  if (receipt.run_id !== context.runId) fail('research source artifact receipt run_id differs from the active run')
  const research = validateResearchBytes(context)
  if (receipt.research_hash !== research.byteHash) fail('research source artifact receipt research_hash differs from current research bytes')
  const artifactRoot = resolveManifestPath(context.root, receipt.artifact_root, 'research source artifact root')
  if (artifactRoot !== context.sourceArtifactRootPath) fail('research source artifact root differs from the deterministic run path')
  const sources = array(receipt.sources, 'research source artifact receipt sources').map((entry, index) => {
    object(entry, `research source artifact receipt sources[${index}]`)
    const sourceId = assertSafeId(entry.source_id, `research source artifact source ${index}.source_id`)
    const path = resolveManifestPath(context.root, entry.path, `research source artifact ${sourceId}.path`)
    if (path === artifactRoot || !isContained(artifactRoot, path)) fail(`research source artifact ${sourceId} escapes artifact_root`)
    if (!existsSync(path)) fail(`research source artifact ${sourceId} is missing`)
    if (!HASH.test(entry.byte_hash ?? '') || sha256Bytes(readFileSync(path)) !== entry.byte_hash) fail(`research source artifact ${sourceId} bytes/hash differ`)
    const contentType = text(entry.content_type, `research source artifact ${sourceId}.content_type`).toLowerCase()
    const locator = text(entry.locator, `research source artifact ${sourceId}.locator`)
    if (!/^https?:\/\//i.test(locator)) fail(`research source artifact ${sourceId}.locator must be HTTP(S)`)
    const canonicalLocator = new URL(locator).href
    return { source_id: sourceId, path, byte_hash: entry.byte_hash, content_type: contentType, locator, canonical_locator: canonicalLocator }
  })
  if (!sources.length) fail('research source artifact receipt needs at least one frozen original source')
  if (sources.map((entry) => entry.source_id).join('\n') !== [...sources].sort((a, b) => a.source_id.localeCompare(b.source_id)).map((entry) => entry.source_id).join('\n')) fail('research source artifact receipt sources must be sorted by source_id')
  if (new Set(sources.map((entry) => entry.source_id)).size !== sources.length || new Set(sources.map((entry) => entry.path.toLowerCase())).size !== sources.length || new Set(sources.map((entry) => entry.canonical_locator)).size !== sources.length) fail('research source artifact receipt source IDs, paths and canonical locators must be unique')
  const value = { value: receipt, hash: receipt.content_hash, byteHash: sha256Bytes(readFileSync(context.sourceArtifactReceiptPath)), artifactRoot, sources, byId: new Map(sources.map((entry) => [entry.source_id, entry])) }
  context.sourceArtifactReceipt = value
  return value
}

function coverageReceiptMismatch(coverage, receipt) {
  if (!sameSet(coverage.sources.map((entry) => entry.source_id), receipt.sources.map((entry) => entry.source_id))) return 'coverage sources differ from the frozen research source receipt'
  for (const source of coverage.sources) {
    const frozen = receipt.byId.get(source.source_id)
    if (source.source_content_hash !== frozen.byte_hash || source.url !== frozen.locator) return `coverage source ${source.source_id} hash/locator differs from the frozen original source`
  }
  return null
}

function coverageLinkMismatches(coverage, linkInventory) {
  const routes = new Map(linkInventory.routes.map((route) => [route.path, route]))
  const sources = new Map(coverage.sources.map((source) => [source.source_id, source]))
  const planned = new Map(plannedCoverageArticles(coverage).map((article) => [article.article_id, article]))
  return plannedCoverageArticles(coverage).filter((article) => article.selected_link_slice.links.some((selected) => {
    if ((selected.target_state ?? 'live') === 'same_release') {
      const target = planned.get(selected.target_article_id)
      return !target || target.article_id === article.article_id || target.slug !== selected.target_id || selected.path !== `/wissen/${target.slug}`
    }
    const current = routes.get(selected.path)
    if (!current || current.slug !== selected.target_id || current.title !== selected.title) return true
    if (!selected.covered_source_ids?.length) return false
    if (current.article_layer !== 'single_study') return true
    const coveredSources = selected.covered_source_ids.map((sourceId) => sources.get(sourceId)).filter(Boolean)
    const routeSourceTokens = current.source_urls.map(sourceLocatorIdentityTokens)
    const coveredSourceTokens = coveredSources.map((source) => sourceIdentityTokens(source))
    return coveredSources.length !== selected.covered_source_ids.length
      || routeSourceTokens.length === 0
      || coveredSourceTokens.some((tokens) => !routeSourceTokens.some((routeTokens) => setsOverlap(tokens, routeTokens)))
      || routeSourceTokens.some((tokens) => !coveredSourceTokens.some((sourceTokens) => setsOverlap(tokens, sourceTokens)))
  })).map((article) => article.article_id).sort()
}

function normalizeIdentityUrl(value) {
  try {
    const parsed = new URL(value)
    parsed.hash = ''
    parsed.hostname = parsed.hostname.toLowerCase()
    parsed.pathname = parsed.pathname.replace(/\/$/, '') || '/'
    return parsed.toString()
  } catch { return String(value).trim() }
}

function sourceLocatorIdentityTokens(value) {
  const tokens = new Set([`url:${normalizeIdentityUrl(value)}`])
  try {
    const parsed = new URL(value)
    const host = parsed.hostname.toLowerCase()
    if (/(?:^|\.)doi\.org$/.test(host)) tokens.add(`doi:${decodeURIComponent(parsed.pathname.replace(/^\//, '')).toLowerCase()}`)
    const pmidMatch = host === 'pubmed.ncbi.nlm.nih.gov' ? parsed.pathname.match(/^\/(\d+)\/?$/) : null
    if (pmidMatch) tokens.add(`pmid:${pmidMatch[1]}`)
  } catch {}
  return tokens
}

function sourceIdentityTokens(source) {
  const tokens = new Set([...sourceLocatorIdentityTokens(source.url), ...sourceLocatorIdentityTokens(source.canonical_url)])
  if (source.doi) tokens.add(`doi:${source.doi.toLowerCase()}`)
  if (source.pmid) tokens.add(`pmid:${source.pmid}`)
  return tokens
}

function setsOverlap(left, right) { return [...left].some((entry) => right.has(entry)) }

function buildLinkInventory(context) {
  const source = strictJson(context.linkInventorySourcePath, 'site link inventory source')
  if (source.schema !== 'site_link_inventory_source.v2' || source.content_hash !== artifactHashV2(source) || !['d1-readback', 'route-export'].includes(source.authority)) fail('site link inventory source schema/authority/content hash is invalid')
  if (!Number.isFinite(Date.parse(text(source.exported_at, 'site link inventory source exported_at')))) fail('site link inventory source exported_at must be ISO-8601')
  const routes = array(source.routes, 'site link inventory source routes')
  const paths = new Set()
  for (const [index, route] of routes.entries()) {
    object(route, `site link inventory source route ${index}`)
    if (!/^\/wissen\/[a-z0-9]+(?:-[a-z0-9]+)*$/.test(route.path) || route.slug !== route.path.slice('/wissen/'.length)) fail(`site link inventory route ${index} path/slug is invalid`)
    text(route.title, `site link inventory route ${index}.title`)
    if (route.meta_title != null) text(route.meta_title, `site link inventory route ${index}.meta_title`)
    if (!['main_article', 'single_study'].includes(route.article_layer)) fail(`site link inventory route ${index}.article_layer is invalid`)
    const sourceUrls = array(route.source_urls ?? [], `site link inventory route ${index}.source_urls`).map((url, sourceIndex) => text(url, `site link inventory route ${index}.source_urls[${sourceIndex}]`))
    if (new Set(sourceUrls).size !== sourceUrls.length) fail(`site link inventory route ${index}.source_urls must be unique`)
    if (sourceUrls.some((url) => !/^https?:\/\//i.test(url) && !/^\/wissen\/[a-z0-9-]+$/.test(url))) fail(`site link inventory route ${index}.source_urls contains an invalid locator`)
    route.source_urls = sourceUrls
    if (route.meta_description != null) text(route.meta_description, `site link inventory route ${index}.meta_description`)
    if (paths.has(route.path)) fail(`site link inventory route ${route.path} is duplicated`)
    paths.add(route.path)
  }
  const base = {
    schema: 'site_link_inventory.v2', source_authority: source.authority, source_byte_hash: sha256Bytes(readFileSync(context.linkInventorySourcePath)), source_content_hash: source.content_hash,
    captured_at: source.exported_at, routes: routes.map((route) => ({ path: route.path, slug: route.slug, title: route.title, meta_title: route.meta_title ?? route.title, meta_description: route.meta_description ?? null, article_layer: route.article_layer, source_urls: [...route.source_urls].sort() })).sort((a, b) => a.path.localeCompare(b.path)),
  }
  const value = { ...base, content_hash: artifactHashV2(base) }
  if (!existsSync(context.linkInventoryPath) || canonicalJsonHash(strictJson(context.linkInventoryPath, 'cached site link inventory')) !== canonicalJsonHash(value)) writeJsonAtomic(context.linkInventoryPath, value)
  context.linkInventory = value
  return value
}

function linkInventorySourceRefreshReason(context) {
  try {
    const source = strictJson(context.linkInventorySourcePath, 'site link inventory source')
    if (source.schema !== 'site_link_inventory_source.v2' || source.content_hash !== artifactHashV2(source) || !['d1-readback', 'route-export'].includes(source.authority)) return 'authoritative site link inventory source schema, authority or hash is stale'
    const routes = array(source.routes, 'site link inventory source routes')
    if (routes.some((route) => typeof route?.meta_title !== 'string' || !route.meta_title.trim() || typeof route?.meta_description !== 'string' || !route.meta_description.trim() || !['main_article', 'single_study'].includes(route?.article_layer) || !Array.isArray(route?.source_urls))) return 'authoritative site link inventory source lacks meta_title, meta_description, article_layer or source_urls and must be refreshed'
    return null
  } catch (error) {
    return `authoritative site link inventory source is invalid and must be refreshed: ${error.message}`
  }
}

function runInput(context, name, path, { contentHash, schema = null } = {}) {
  const byteHash = sha256Bytes(readFileSync(path))
  return { name, root: 'run', path: portablePath(context.root, path), byte_hash: byteHash, content_hash: contentHash ?? byteHash, schema }
}

function repoInput(name, path, { contentHash, schema = null } = {}) {
  const absolute = resolve(REPO_ROOT, path)
  const byteHash = sha256Bytes(readFileSync(absolute))
  return { name, root: 'repo', path: portablePath(REPO_ROOT, absolute), byte_hash: byteHash, content_hash: contentHash ?? byteHash, schema }
}

function runOutput(context, name, path, { schema = null, mediaType = null } = {}) {
  if (Boolean(schema) === Boolean(mediaType)) fail(`${name} output needs exactly one of schema or media_type`)
  return { name, root: 'run', path: portablePath(context.root, path), schema, media_type: mediaType }
}

function repoOutput(name, path, { schema = null, mediaType = null } = {}) {
  if (Boolean(schema) === Boolean(mediaType)) fail(`${name} output needs exactly one of schema or media_type`)
  const absolute = resolve(REPO_ROOT, path)
  return { name, root: 'repo', path: portablePath(REPO_ROOT, absolute), schema, media_type: mediaType }
}

function reusedSource(context, sourceId, path, contentHash) {
  return { source_id: sourceId, root: 'run', path: portablePath(context.root, path), byte_hash: sha256Bytes(readFileSync(path)), content_hash: contentHash }
}

function orderScope(mode, { sourceIds = [], clusterIds = [], obligationIds = [], articleIds = [] } = {}) {
  if (!['run', 'sources', 'obligations', 'articles'].includes(mode)) fail(`invalid WorkOrder scope mode ${mode}`)
  const normalize = (values) => [...new Set(values)].sort()
  return { mode, source_ids: normalize(sourceIds), cluster_ids: normalize(clusterIds), obligation_ids: normalize(obligationIds), article_ids: normalize(articleIds) }
}

function linkInventoryInput(context) {
  if (!context.linkInventory) return null
  return runInput(context, 'link_inventory', context.linkInventoryPath, { contentHash: context.linkInventory.content_hash, schema: 'site_link_inventory.v2' })
}

function sourceArtifactReceiptInput(context) {
  const receipt = context.sourceArtifactReceipt
  if (!receipt) return null
  return runInput(context, 'source_artifact_receipt', context.sourceArtifactReceiptPath, { contentHash: receipt.hash, schema: 'research_source_artifact_receipt.v2' })
}

function stage3StyleBindings() {
  const registry = strictJson(STYLE_SNAPSHOT_PATH, 'Stage-3 style snapshot registry')
  return {
    registry: { scope: 'repo', path: portablePath(REPO_ROOT, STYLE_SNAPSHOT_PATH), byte_hash: sha256Bytes(readFileSync(STYLE_SNAPSHOT_PATH)) },
    annotation: { scope: 'repo', path: registry.annotation.path, byte_hash: registry.annotation.sha256 },
    snapshots: registry.snapshots.map((entry) => ({ reference_id: entry.reference_id, scope: 'repo', path: entry.path, byte_hash: entry.sha256 })),
  }
}

function workOrder(context, kind, payload) {
  const inputs = array(payload.inputs ?? [], `${kind}.inputs`).map((entry, index) => {
    object(entry, `${kind}.inputs[${index}]`); text(entry.name, `${kind}.inputs[${index}].name`)
    if (!['run', 'repo'].includes(entry.root) || !HASH.test(entry.byte_hash ?? '') || !HASH.test(entry.content_hash ?? '') || !(entry.schema === null || typeof entry.schema === 'string' && entry.schema)) fail(`${kind}.inputs[${index}] binding is invalid`)
    return entry
  }).sort((a, b) => a.name.localeCompare(b.name))
  if (new Set(inputs.map((entry) => entry.name)).size !== inputs.length) fail(`${kind}.inputs names must be unique`)
  const outputs = array(payload.outputs ?? [], `${kind}.outputs`).map((entry, index) => {
    object(entry, `${kind}.outputs[${index}]`); text(entry.name, `${kind}.outputs[${index}].name`)
    if (!['run', 'repo'].includes(entry.root) || Boolean(entry.schema) === Boolean(entry.media_type)) fail(`${kind}.outputs[${index}] binding is invalid`)
    return entry
  }).sort((a, b) => a.name.localeCompare(b.name))
  if (new Set(outputs.map((entry) => entry.name)).size !== outputs.length) fail(`${kind}.outputs names must be unique`)
  const independentFromIds = [...new Set(array(payload.assignee?.independent_from_ids ?? [], `${kind}.assignee.independent_from_ids`).map((id) => assertSafeId(id, `${kind} independent id`)))].sort()
  const constraints = object(payload.constraints ?? {}, `${kind}.constraints`)
  const executionClass = payload.execution_class ?? (constraints.non_llm === true ? 'deterministic' : 'llm')
  if (!['llm', 'deterministic', 'human'].includes(executionClass)) fail(`${kind}.execution_class is invalid`)
  const tierFloor = minimumReasoningTier(kind, executionClass)
  const reasoningTier = payload.reasoning_tier ?? tierFloor
  if (!Object.hasOwn(REASONING_TIER_RANK, reasoningTier) || REASONING_TIER_RANK[reasoningTier] < REASONING_TIER_RANK[tierFloor]) fail(`${kind}.reasoning_tier must be ${tierFloor} or an upgrade`)
  const base = {
    schema: 'nutrient_content_work_order.v2', run_id: context.runId, kind, execution_class: executionClass, reasoning_tier: reasoningTier, wave_index: executionClass === 'llm' ? context.llmWaveIndex : null,
    reason: text(payload.reason, `${kind}.reason`), substance: context.substance,
    scope: object(payload.scope, `${kind}.scope`), assignee: { role: text(payload.assignee?.role, `${kind}.assignee.role`), independent_from_ids: independentFromIds },
    inputs, reused_sources: array(payload.reused_sources ?? [], `${kind}.reused_sources`).sort((a, b) => a.source_id.localeCompare(b.source_id)),
    link_inventory: payload.link_inventory ?? null, outputs,
    task: object(payload.task ?? {}, `${kind}.task`), constraints,
  }
  const executionReceiptKey = canonicalJsonHash({ schema: 'work_order_execution_receipt_path.v1', work_order: base }).slice('sha256:'.length)
  const executionReceipt = {
    root: 'run',
    path: portablePath(context.root, resolve(context.stateDir, 'metrics', 'work-orders', `${executionReceiptKey}.work-order-execution-receipt.v1.json`)),
    schema: 'work_order_execution_receipt.v1',
  }
  const contract = { ...base, execution_receipt: executionReceipt }
  return { ...contract, work_order_id: canonicalJsonHash(contract) }
}

function loadIssuedWorkOrders(context) {
  const orders = []
  if (existsSync(context.workOrderHistoryPath)) {
    const decoded = decodeUtf8Strict(readFileSync(context.workOrderHistoryPath), 'issued WorkOrder history')
    if (decoded.errors.length) fail(decoded.errors.join('; '))
    for (const [index, line] of decoded.text.split(/\r?\n/).filter(Boolean).entries()) {
      let event
      try { event = JSON.parse(line) } catch (error) { fail(`WorkOrder history line ${index + 1} is invalid JSON: ${error.message}`) }
      if (event.schema !== 'nutrient_content_work_order_event.v2' || event.event_hash !== canonicalJsonHash(Object.fromEntries(Object.entries(event).filter(([key]) => key !== 'event_hash')))) fail(`WorkOrder history line ${index + 1} schema/hash is invalid`)
      if (event.run_id === context.runId && event.manifest_hash === context.manifestHash) orders.push(event.work_order)
    }
  }
  if (existsSync(context.workOrdersPath)) {
    const value = strictJson(context.workOrdersPath, 'issued work orders')
    if (value.schema !== 'nutrient_content_work_orders.v2' || value.content_hash !== canonicalJsonHash(Object.fromEntries(Object.entries(value).filter(([key]) => key !== 'content_hash')))) fail('issued work-orders file schema/hash is invalid')
    if (value.run_id === context.runId && value.manifest_hash === context.manifestHash) orders.push(...array(value.work_orders, 'issued work_orders'))
  }
  for (const order of orders) if (order.schema !== 'nutrient_content_work_order.v2' || order.run_id !== context.runId || order.work_order_id !== canonicalJsonHash(Object.fromEntries(Object.entries(order).filter(([key]) => key !== 'work_order_id')))) fail('issued WorkOrder has a stale full-contract hash')
  return [...new Map(orders.map((order) => [order.work_order_id, order])).values()]
}

function appendWorkOrderHistory(context, workOrders) {
  const existingIds = new Set(loadIssuedWorkOrders(context).map((order) => order.work_order_id))
  mkdirSync(dirname(context.workOrderHistoryPath), { recursive: true })
  for (const order of workOrders) if (!existingIds.has(order.work_order_id)) {
    const base = { schema: 'nutrient_content_work_order_event.v2', run_id: context.runId, manifest_hash: context.manifestHash, issued_at: new Date().toISOString(), work_order: order }
    appendFileSync(context.workOrderHistoryPath, `${JSON.stringify({ ...base, event_hash: canonicalJsonHash(base) })}\n`, 'utf8')
    existingIds.add(order.work_order_id)
  }
}

function removeRelease(context) {
  const path = assertOwnedPath(context.stateDir, context.releasePath, 'release path')
  if (existsSync(path)) rmSync(path, { force: true })
}

function readMetricHistory(path) {
  if (!existsSync(path)) return []
  const decoded = decodeUtf8Strict(readFileSync(path), 'append-only run metrics')
  if (decoded.errors.length) fail(decoded.errors.join('; '))
  return decoded.text.split(/\r?\n/).filter(Boolean).map((line, index) => {
    let value
    try { value = JSON.parse(line) } catch (error) { fail(`run metrics line ${index + 1} is invalid JSON: ${error.message}`) }
    if (value.schema !== 'nutrient_content_run_metric_event.v2' || value.event_hash !== canonicalJsonHash(Object.fromEntries(Object.entries(value).filter(([key]) => key !== 'event_hash')))) fail(`run metrics line ${index + 1} schema/hash is invalid`)
    return value
  })
}

function workOrderExecutionReceiptPath(context, workOrder) {
  object(workOrder?.execution_receipt, `${workOrder?.kind ?? 'work order'}.execution_receipt`)
  if (workOrder.execution_receipt.root !== 'run' || workOrder.execution_receipt.schema !== 'work_order_execution_receipt.v1') fail(`${workOrder.kind}.execution_receipt binding is invalid`)
  return assertOwnedPath(context.root, resolve(context.root, workOrder.execution_receipt.path), `${workOrder.kind} execution receipt path`)
}

function intervalUnionMs(intervals) {
  if (!intervals.length) return 0
  const sortedIntervals = intervals.map(({ started_at, finished_at }) => [Date.parse(started_at), Date.parse(finished_at)]).sort((left, right) => left[0] - right[0])
  let total = 0, [start, end] = sortedIntervals[0]
  for (const [nextStart, nextEnd] of sortedIntervals.slice(1)) {
    if (nextStart <= end) end = Math.max(end, nextEnd)
    else { total += end - start; start = nextStart; end = nextEnd }
  }
  return total + end - start
}

export function summarizeWorkOrderTimingsV1({ workOrders, receipts = [] }) {
  const orders = array(workOrders, 'timing WorkOrders')
  const byId = new Map(orders.map((order) => [order.work_order_id, order]))
  if (byId.size !== orders.length) fail('timing WorkOrders must have unique IDs')
  const normalized = receipts.map((receipt, index) => {
    object(receipt, `execution receipt ${index}`)
    if (receipt.schema !== 'work_order_execution_receipt.v1' || receipt.content_hash !== artifactHashV2(receipt)) fail(`execution receipt ${index} schema/hash is invalid`)
    const order = byId.get(receipt.work_order_id)
    if (!order || receipt.run_id !== order.run_id || receipt.execution_class !== order.execution_class || receipt.reasoning_tier !== order.reasoning_tier || receipt.executor?.role !== order.assignee?.role || receipt.result !== 'PASS' || !HASH.test(receipt.result_hash ?? '')) fail(`execution receipt ${index} differs from its exact WorkOrder`)
    const startedAt = text(receipt.started_at, `execution receipt ${index}.started_at`), finishedAt = text(receipt.finished_at, `execution receipt ${index}.finished_at`)
    const started = Date.parse(startedAt), finished = Date.parse(finishedAt)
    if (!Number.isFinite(started) || !Number.isFinite(finished) || finished < started) fail(`execution receipt ${index} timing interval is invalid`)
    return { work_order_id: order.work_order_id, kind: order.kind, execution_class: order.execution_class, reasoning_tier: order.reasoning_tier, started_at: startedAt, finished_at: finishedAt, elapsed_ms: finished - started, result_hash: receipt.result_hash, receipt_hash: receipt.content_hash }
  }).sort((left, right) => left.started_at.localeCompare(right.started_at) || left.work_order_id.localeCompare(right.work_order_id))
  if (new Set(normalized.map((entry) => entry.work_order_id)).size !== normalized.length) fail('execution receipts contain duplicate WorkOrder IDs')
  const present = new Set(normalized.map((entry) => entry.work_order_id))
  const missing = orders.map((order) => order.work_order_id).filter((id) => !present.has(id)).sort()
  const measurable = missing.length === 0
  const aggregate = (predicate) => measurable ? intervalUnionMs(normalized.filter(predicate)) : 'NOT_MEASURABLE'
  return {
    status: measurable ? 'MEASURED' : 'NOT_MEASURABLE', missing_work_order_ids: missing, work_order_timings: normalized,
    llm_wallclock_ms: aggregate((entry) => entry.execution_class === 'llm'),
    deterministic_elapsed_ms: aggregate((entry) => entry.execution_class === 'deterministic' && entry.kind !== 'publication_apply'),
    publish_readback_ms: aggregate((entry) => entry.kind === 'publication_apply'),
  }
}

function loadWorkOrderTimingSummary(context) {
  const orders = loadIssuedWorkOrders(context)
  const receipts = []
  for (const order of orders) {
    const path = workOrderExecutionReceiptPath(context, order)
    if (existsSync(path)) receipts.push(strictJson(path, `${order.kind} execution receipt`))
  }
  return summarizeWorkOrderTimingsV1({ workOrders: orders, receipts })
}

function finish(context, started, state, workOrders, stats, extra = {}) {
  if (!RUN_STATES.includes(state)) fail(`unknown run state ${state}`)
  assertWorkOrderDispatch(state, workOrders)
  const outputPaths = workOrders.flatMap((order) => order.outputs.map((output) => `${output.root}:${output.path}`))
  if (new Set(outputPaths).size !== outputPaths.length) fail('parallel WorkOrders must have disjoint output paths')
  const ordersBase = { schema: 'nutrient_content_work_orders.v2', run_id: context.runId, manifest_hash: context.manifestHash, state, work_orders: [...workOrders].sort((a, b) => a.work_order_id.localeCompare(b.work_order_id)) }
  const orders = { ...ordersBase, content_hash: canonicalJsonHash(ordersBase) }
  appendWorkOrderHistory(context, orders.work_orders)
  writeJsonAtomic(context.workOrdersPath, orders)
  const history = readMetricHistory(context.metricsPath)
  const recordedAt = new Date().toISOString()
  const firstRecordedAt = history[0]?.recorded_at ?? recordedAt
  const byKind = Object.fromEntries([...new Set(workOrders.map((entry) => entry.kind))].sort().map((kind) => [kind, workOrders.filter((entry) => entry.kind === kind).length]))
  const llmWorkOrders = workOrders.filter((entry) => entry.execution_class === 'llm')
  const llmByKind = Object.fromEntries([...new Set(llmWorkOrders.map((entry) => entry.kind))].sort().map((kind) => [kind, llmWorkOrders.filter((entry) => entry.kind === kind).length]))
  const executionTiming = loadWorkOrderTimingSummary(context)
  const metricsBase = {
    schema: 'nutrient_content_run_metric_event.v2', run_id: context.runId, manifest_hash: context.manifestHash,
    wave_index: history.length + 1, recorded_at: recordedAt, state, runner_version: RUNNER_VERSION,
    invocation_elapsed_ms: Math.round((performance.now() - started) * 100) / 100,
    e2e_elapsed_ms: Math.max(0, Date.parse(recordedAt) - Date.parse(firstRecordedAt)),
    cache: {
      evidence_hits: stats.evidence_cache_hits, evidence_misses: stats.evidence_cache_misses,
      article_hits: stats.article_validation_cache_hits, article_misses: stats.article_validation_cache_misses,
      renderer_style_hits: stats.renderer_style_cache_hits, renderer_style_misses: stats.renderer_style_cache_misses,
    },
    revision_counts: stats.revision_counts,
    gate_timings_ms: stats.gate_timings_ms,
    gate_results: stats.gate_results,
    article_count: context.articles.all.length, work_order_count: workOrders.length, work_order_counts_by_kind: byKind,
    llm_wave_index: llmWorkOrders.length ? context.llmWaveIndex : Math.max(0, ...loadIssuedWorkOrders(context).filter((entry) => entry.execution_class === 'llm').map((entry) => Number(entry.wave_index) || 0)),
    llm_work_order_count: llmWorkOrders.length, llm_work_order_counts_by_kind: llmByKind,
    execution_timing_status: executionTiming.status, missing_timing_work_order_ids: executionTiming.missing_work_order_ids,
    work_order_timings: executionTiming.work_order_timings, llm_wallclock_ms: executionTiming.llm_wallclock_ms,
    deterministic_elapsed_ms: executionTiming.deterministic_elapsed_ms, publish_readback_ms: executionTiming.publish_readback_ms,
  }
  const metrics = { ...metricsBase, event_hash: canonicalJsonHash(metricsBase) }
  mkdirSync(dirname(context.metricsPath), { recursive: true })
  appendFileSync(context.metricsPath, `${JSON.stringify(metrics)}\n`, 'utf8')
  const aggregateStatus = extra.aggregate_status ?? state
  return { schema: 'nutrient_content_run_status.v2', run_id: context.runId, state, aggregate_status: aggregateStatus, success_claimed: aggregateStatus === 'COMPLETE', work_orders: orders, metrics, ...extra }
}

function plannedCoverageArticles(coverage) { return coverage.articles.filter((entry) => entry.status === 'planned') }

function validatePlanParity(context, coverage) {
  const planned = plannedCoverageArticles(coverage)
  const expected = planned.map((entry) => `${entry.stage}:${entry.article_id}:${entry.slug}`)
  const actual = context.articles.all.map((entry) => `${entry.stage}:${entry.article_id}:${entry.slug}`)
  if (!sameSet(expected, actual)) fail(`article_plan must exactly equal planned coverage articles; expected=[${expected.sort().join(', ')}], actual=[${actual.sort().join(', ')}]`)
  if (context.stage4.enabled !== coverage.stage4_requested) fail('manifest.stage4.enabled must exactly equal coverage.stage4_requested')
}

function researchWorkOrder(context, reason, { freezeOnly = false } = {}) {
  return workOrder(context, freezeOnly ? 'research_source_freeze' : 'research', {
    reason, scope: orderScope('run'), assignee: { role: 'nutrient-research-analyst', independent_from_ids: [] },
    inputs: freezeOnly ? [runInput(context, 'research', context.researchPath)] : [], reused_sources: [], link_inventory: null,
    outputs: [
      ...(!freezeOnly ? [runOutput(context, 'research', context.researchPath, { mediaType: 'application/octet-stream' })] : []),
      runOutput(context, 'source_artifact_receipt', context.sourceArtifactReceiptPath, { schema: 'research_source_artifact_receipt.v2' }),
      runOutput(context, 'source_artifact_root', context.sourceArtifactRootPath, { mediaType: 'application/vnd.supplement-stack.source-artifact-directory' }),
    ],
    task: { objective: freezeOnly ? 'Acquire each already selected original source once and freeze its unchanged bytes without adding a second semantic analysis.' : 'Create one opaque semantic research inventory, identify the most material common public assumptions as evidence questions, and in the same wave acquire each selected original source exactly once as unchanged frozen bytes.', research_scope: freezeOnly ? ['already_selected_sources_only'] : ['common_public_assumptions_and_questions', 'authority_reference_and_legal', 'guideline_consensus', 'systematic_review_meta_analysis', 'material_primary_studies', 'safety_interaction_vulnerable_groups', 'correction_retraction_follow_up'], query_budget: freezeOnly ? 0 : 30, wall_clock_budget_minutes: freezeOnly ? 8 : 25, artifact_root: portablePath(context.root, context.sourceArtifactRootPath), receipt_contract: { schema: 'research_source_artifact_receipt.v2', source_fields: ['source_id', 'path', 'byte_hash', 'content_type', 'locator'] } },
    constraints: { original_sources_only: true, hard_query_and_time_budget: true, stop_when_material_coverage_is_satisfied: true, unchanged_source_bytes: true, no_second_semantic_inventory: true, no_downstream_refetch: true, common_assumptions_are_discovery_signals_not_facts: true, no_quantified_prevalence_without_original_evidence: true },
  })
}

function linkInventorySourceWorkOrder(context, reason) {
  return workOrder(context, 'link_inventory_source_readback', {
    reason, scope: orderScope('run'), assignee: { role: 'deterministic-link-inventory-exporter', independent_from_ids: [] }, inputs: [], reused_sources: [], link_inventory: null,
    outputs: [runOutput(context, 'link_inventory_source', context.linkInventorySourcePath, { schema: 'site_link_inventory_source.v2' })],
    task: { objective: 'Export the authoritative read-only /wissen route/title/slug/meta_title/meta_description/article_layer/source_urls rows from D1 or the canonical route registry. The runner deterministically builds site_link_inventory.v2 from this input.' }, constraints: { non_llm: true, read_only_db_or_route_readback: true, canonical_routes_only: true, exact_fields: ['path', 'slug', 'title', 'meta_title', 'meta_description', 'article_layer', 'source_urls'] },
  })
}

function ingredientTargetReadbackWorkOrder(context, reason) {
  return workOrder(context, 'ingredient_target_readback', {
    reason, scope: orderScope('run'), assignee: { role: 'deterministic-ingredient-target-resolver', independent_from_ids: [] }, inputs: [], reused_sources: [], link_inventory: null,
    outputs: [runOutput(context, 'ingredient_target_receipt', context.ingredientTargetReceiptPath, { schema: 'ingredient_target_receipt.v1' })],
    task: { selector: context.ingredientTargetSelector, objective: 'Resolve exactly one existing active canonical ingredient without creating or mutating it.' },
    constraints: { non_llm: true, read_only: true, exactly_one_active_match: true, no_implicit_ingredient_creation: true, id_name_slug_status_version_hash_readback: true },
  })
}

function loadIngredientTarget(context, issuedWorkOrders) {
  const receipt = strictJson(context.ingredientTargetReceiptPath, 'ingredient target receipt')
  const target = validateIngredientTargetReceiptV1({
    receipt, runId: context.runId, selector: context.ingredientTargetSelector, issuedWorkOrders,
    allowUnissuedTestReceipt: context.mode === 'test' && context.ingredientTargetReceiptProvided,
    expectedOutputPath: portablePath(context.root, context.ingredientTargetReceiptPath),
  })
  context.ingredientTarget = target
  return target
}

function updateArticleTargetSelectors(context) {
  const updateTargets = context.articles.all.filter((article) => article.write_guard.mode === 'update').map((article) => ({
    article_id: article.article_id, slug: article.slug, expected_status: article.write_guard.expected_status,
    expected_version: article.write_guard.expected_version, expected_payload_hash: article.write_guard.expected_payload_hash,
  }))
  const selectors = [...updateTargets, ...(context.publish.retireArticles ?? [])].sort((left, right) => left.article_id.localeCompare(right.article_id))
  if (new Set(selectors.map((entry) => entry.article_id)).size !== selectors.length || new Set(selectors.map((entry) => entry.slug)).size !== selectors.length) fail('publication article-target selectors must be unique by ID and slug')
  return selectors
}

function articleTargetReadbackWorkOrder(context, selectors, reason) {
  return workOrder(context, 'article_target_readback', {
    reason, scope: orderScope('articles', { articleIds: selectors.map((entry) => entry.article_id) }), assignee: { role: 'deterministic-article-target-reader', independent_from_ids: [] }, inputs: [], reused_sources: [], link_inventory: null,
    outputs: [runOutput(context, 'article_target_receipt', context.articleTargetReceiptPath, { schema: 'article_target_receipt.v1' })],
    task: { target: context.publish.target, articles: selectors, objective: 'Read the immutable publication timestamp plus current updated timestamp for every guarded update target without mutating content.' },
    constraints: { non_llm: true, read_only: true, exact_guard_match_required: true, timestamps_required: true, no_create_targets: true },
  })
}

function loadArticleTargets(context, selectors, issuedWorkOrders) {
  const receipt = strictJson(context.articleTargetReceiptPath, 'article target receipt')
  if (receipt.schema !== 'article_target_receipt.v1' || receipt.content_hash !== artifactHashV2(receipt) || receipt.run_id !== context.runId || receipt.target !== context.publish.target || receipt.result !== 'PASS') fail('article target receipt schema/hash/run/target/result is invalid')
  if (!Number.isFinite(Date.parse(receipt.captured_at)) || receipt.executor?.role !== 'deterministic-article-target-reader') fail('article target receipt executor/time is invalid')
  const issued = issuedWorkOrders.find((order) => order.work_order_id === receipt.work_order_id && order.kind === 'article_target_readback')
  const output = issued?.outputs?.find((entry) => entry.name === 'article_target_receipt' && entry.schema === 'article_target_receipt.v1' && resolve(context.root, entry.path) === context.articleTargetReceiptPath)
  if (!issued || !output || canonicalJsonHash(issued.task?.articles) !== canonicalJsonHash(selectors)) fail('article target receipt does not bind its exact issued WorkOrder/selectors')
  const rows = array(receipt.articles, 'article target receipt articles')
  if (!sameSet(rows.map((entry) => entry.article_id), selectors.map((entry) => entry.article_id)) || new Set(rows.map((entry) => entry.slug)).size !== rows.length) fail('article target receipt article set differs from update selectors')
  const byId = new Map()
  for (const selector of selectors) {
    const row = object(rows.find((entry) => entry.article_id === selector.article_id), `article target ${selector.article_id}`)
    if (row.slug !== selector.slug || row.status !== selector.expected_status || Number(row.version) !== selector.expected_version || row.payload_hash !== selector.expected_payload_hash) fail(`${selector.article_id} article target guard differs from the manifest`)
    const createdAt = iso(row.created_at, `${selector.article_id}.created_at`), updatedAt = iso(row.updated_at, `${selector.article_id}.updated_at`)
    if (Date.parse(updatedAt) < Date.parse(createdAt)) fail(`${selector.article_id} updated_at predates created_at`)
    byId.set(selector.article_id, { ...row, created_at: createdAt, updated_at: updatedAt })
  }
  context.articleTargets = { receipt_hash: receipt.content_hash, receipt, byId }
  return context.articleTargets
}

function ensureSourceCatalogRequest(context, coverage) {
  const request = buildSourceCatalogSyncRequestV1({ runId: context.runId, ingredientTarget: context.ingredientTarget, sources: coverage.sources })
  if (!existsSync(context.sourceCatalogRequestPath) || canonicalJsonHash(strictJson(context.sourceCatalogRequestPath, 'source catalog sync request')) !== canonicalJsonHash(request)) writeJsonAtomic(context.sourceCatalogRequestPath, request)
  context.sourceCatalogRequest = request
  return request
}

function sourceCatalogSyncWorkOrder(context, request, reason) {
  return workOrder(context, 'source_catalog_sync', {
    reason, scope: orderScope('sources', { sourceIds: request.sources.map((source) => source.source_id) }), assignee: { role: 'deterministic-source-catalog-sync', independent_from_ids: [] },
    inputs: [
      runInput(context, 'ingredient_target_receipt', context.ingredientTargetReceiptPath, { contentHash: context.ingredientTarget.receipt_hash, schema: 'ingredient_target_receipt.v1' }),
      runInput(context, 'source_catalog_sync_request', context.sourceCatalogRequestPath, { contentHash: request.content_hash, schema: 'source_catalog_sync_request.v1' }),
    ], reused_sources: [], link_inventory: null,
    outputs: [runOutput(context, 'source_resolution_receipt', context.sourceResolutionReceiptPath, { schema: 'source_resolution_receipt.v1' })],
    task: { ingredient_id: request.ingredient_id, ingredient_target_hash: request.ingredient_target_hash, request_hash: request.content_hash, source_ids: request.sources.map((source) => source.source_id), objective: 'Resolve or idempotently create canonical source catalog rows by ingredient plus DOI, PubMed ID or canonical URL; fail on ambiguity or identifier conflict.' },
    constraints: { non_llm: true, additive_idempotent_upsert_only: true, no_article_write: true, no_ambiguous_or_cross_ingredient_match: true, exact_numeric_source_id_readback: true },
  })
}

function loadSourceResolution(context, request, issuedWorkOrders) {
  const receipt = strictJson(context.sourceResolutionReceiptPath, 'source resolution receipt')
  const resolution = validateSourceResolutionReceiptV1({ receipt, request, issuedWorkOrders, expectedOutputPath: portablePath(context.root, context.sourceResolutionReceiptPath), allowUnissuedTestReceipt: context.mode === 'test' && context.sourceResolutionReceiptProvided })
  context.sourceResolution = resolution
  return resolution
}

function ensureAssetDeploymentRequest(context, compiledArticles) {
  const request = buildAssetDeploymentRequestV1({ runId: context.runId, root: context.root, articles: compiledArticles })
  if (!existsSync(context.assetDeploymentRequestPath) || canonicalJsonHash(strictJson(context.assetDeploymentRequestPath, 'asset deployment request')) !== canonicalJsonHash(request)) writeJsonAtomic(context.assetDeploymentRequestPath, request)
  context.assetDeploymentRequest = request
  return request
}

function assetStageWorkOrder(context, request, reason) {
  return workOrder(context, 'asset_stage', {
    reason, scope: orderScope('articles', { articleIds: [...new Set(request.assets.map((asset) => asset.article_id))] }), assignee: { role: 'deterministic-article-asset-stager', independent_from_ids: [] },
    inputs: [runInput(context, 'asset_deployment_request', context.assetDeploymentRequestPath, { contentHash: request.content_hash, schema: 'asset_deployment_request.v1' })], reused_sources: [], link_inventory: null,
    outputs: [runOutput(context, 'asset_deployment_receipt', context.assetDeploymentReceiptPath, { schema: 'asset_deployment_receipt.v1' })],
    task: { request_hash: request.content_hash, asset_keys: request.assets.map((asset) => asset.r2_key), objective: 'Additively and idempotently prestage the already frozen generated asset bytes under their content-addressed R2 keys, then read back exact bytes, MIME and dimensions.' },
    constraints: { non_llm: true, explicit_publish_authorization_required: true, additive_versioned_prestage_only: true, no_d1_write: true, no_cross_service_atomicity_claim: true, immutable_cache_control: true, exact_public_byte_readback: true },
  })
}

function loadAssetDeployment(context, request, issuedWorkOrders) {
  const receipt = strictJson(context.assetDeploymentReceiptPath, 'asset deployment receipt')
  const result = validateAssetDeploymentReceiptV1({ receipt, request, issuedWorkOrders, expectedOutputPath: portablePath(context.root, context.assetDeploymentReceiptPath) })
  context.assetDeployment = result
  return result
}

function buildEvidenceManifest(context, coverage) {
  const receipt = context.sourceArtifactReceipt
  const plannedIds = new Set(plannedCoverageArticles(coverage).map((article) => article.article_id))
  const activeObligations = coverage.extraction_obligations.filter((obligation) => obligation.required_for.some((articleId) => plannedIds.has(articleId)))
  const sourceIds = [...new Set(activeObligations.map((obligation) => obligation.source_id))].sort()
  const buildDir = resolve(dirname(context.evidenceManifestPath), `${context.runId}-evidence-work`)
  const extractionSlices = []
  for (let offset = 0; offset < sourceIds.length; offset += 4) {
    const sliceSourceIds = sourceIds.slice(offset, offset + 4)
    const obligations = activeObligations.filter((obligation) => sliceSourceIds.includes(obligation.source_id)).sort((a, b) => a.obligation_id.localeCompare(b.obligation_id))
    const sliceId = `slice-${String(extractionSlices.length + 1).padStart(2, '0')}`
    extractionSlices.push({
      slice_id: sliceId,
      shard_path: portablePath(context.root, resolve(buildDir, 'extraction', `${sliceId}.source-evidence-shard.v2.json`)),
      source_ids: sliceSourceIds,
      obligation_ids: obligations.map((entry) => entry.obligation_id),
      cluster_ids: [...new Set(obligations.map((entry) => entry.cluster_id))].sort(),
    })
  }
  const reviewSlices = [0, 1].flatMap((round) => Array.from({ length: 4 }, (_, index) => {
    const shardId = `round-${round}-shard-${String(index + 1).padStart(2, '0')}`
    return { sampling_round: round, shard_id: shardId, path: portablePath(context.root, resolve(buildDir, 'reviews', `${shardId}.source-facts-review.v2.json`)) }
  }))
  const base = {
    schema: 'evidence_pipeline_build.v2', mode: context.mode,
    research_path: portablePath(context.root, context.researchPath), research_hash: sha256Bytes(readFileSync(context.researchPath)),
    coverage_plan_path: portablePath(context.root, context.coveragePlanPath), coverage_plan_hash: coverage.content_hash,
    source_artifact_receipt_path: portablePath(context.root, context.sourceArtifactReceiptPath), source_artifact_receipt_hash: receipt.hash,
    policy_version: context.policyVersion, validator_version: context.evidenceValidatorVersion, max_sources_per_slice: 4,
    source_evidence_shard_paths: extractionSlices.map((slice) => slice.shard_path),
    source_facts_review_paths: reviewSlices.map((slice) => slice.path),
    source_facts_review_slices: reviewSlices,
    source_artifacts: Object.fromEntries(sourceIds.map((sourceId) => [sourceId, portablePath(context.root, receipt.byId.get(sourceId).path)])),
    extraction_slices: extractionSlices,
    bundle_id: `bundle-${context.runId}`, sampling_seed: canonicalJsonHash({ run_id: context.runId, coverage_plan_hash: coverage.content_hash }),
    merger: { role: 'evidence-bundle-merger', id: `merger-${context.runId}` },
    validator: { role: 'evidence-bundle-gate-validator', id: `validator-${context.runId}`, gate_id: `gate-${context.runId}` },
  }
  const value = { ...base, content_hash: artifactHashV2(base) }
  let current = null
  if (existsSync(context.evidenceManifestPath)) {
    try { current = strictJson(context.evidenceManifestPath, 'cached deterministic evidence manifest') } catch { current = null }
  }
  if (!current || canonicalJsonHash(current) !== canonicalJsonHash(value)) writeJsonAtomic(context.evidenceManifestPath, value)
  return value
}

function frameworkCandidateDir(context, gap) { return resolve(context.stateDir, 'framework-candidates', gap.gap_id) }
function frameworkCandidatePath(context, gap) { return resolve(frameworkCandidateDir(context, gap), 'candidate-framework.md') }
function frameworkCatalogCandidatePath(context, gap) { return resolve(frameworkCandidateDir(context, gap), 'framework-catalog-candidate.v1.json') }
function frameworkPilotFixturePath(context, gap) { return resolve(frameworkCandidateDir(context, gap), 'framework-pilot-fixture.v1.json') }
function frameworkPilotPath(context, gap) { return resolve(frameworkCandidateDir(context, gap), 'article-framework-pilot-receipt.v2.json') }
function frameworkOwnerApprovalPath(context, gap) { return resolve(frameworkCandidateDir(context, gap), 'framework-owner-approval-receipt.v1.json') }
function frameworkActivationPath(context, gap) { return resolve(frameworkCandidateDir(context, gap), 'framework-catalog-activation-receipt.v1.json') }
function frameworkComponentReceiptPath(context, gap, kind) { return resolve(frameworkCandidateDir(context, gap), `framework-${kind}-pilot-receipt.v1.json`) }

const FRAMEWORK_RUNTIME_FINGERPRINT_PATHS = Object.freeze([
  'scripts/lib/article-runtime-v2.mjs',
  'scripts/lib/nutrient-content-machine-dispatcher.mjs',
  'scripts/lib/nutrient-content-runner.mjs',
  'frontend/render-knowledge-magazine-snapshot.mjs',
  'frontend/validate-knowledge-magazine-style.mjs',
  'frontend/src/render-snapshot/knowledgeMagazineRenderSnapshot.tsx',
  'functions/api/modules/knowledge.ts',
])

function normalizeFrameworkTechnicalPaths(paths, gapId) {
  const normalized = array(paths ?? [], `framework catalog candidate ${gapId}.technical_change_paths`).map((path, index) => {
    const value = text(path, `framework catalog candidate ${gapId}.technical_change_paths[${index}]`).replaceAll('\\', '/')
    if (value.startsWith('/') || value.includes('..') || value.startsWith('codex-files/frameworks/') || !isContained(REPO_ROOT, resolve(REPO_ROOT, value))) fail(`framework catalog candidate ${gapId} technical path ${value} is unsafe or not technical runtime scope`)
    return value
  })
  if (new Set(normalized).size !== normalized.length) fail(`framework catalog candidate ${gapId} technical_change_paths must be unique`)
  return normalized.sort()
}

function runtimePathBinding(path) {
  const absolute = resolve(REPO_ROOT, path)
  return { path, byte_hash: existsSync(absolute) ? sha256Bytes(readFileSync(absolute)) : null }
}

function ensureFrameworkPilotFixture(context, gap, extraRuntimePaths = []) {
  const runtimeInputs = [...new Set([...FRAMEWORK_RUNTIME_FINGERPRINT_PATHS, ...normalizeFrameworkTechnicalPaths(extraRuntimePaths, gap.gap_id)])].sort().map(runtimePathBinding)
  const catalog = strictJson(FRAMEWORK_CATALOG_PATH, 'framework catalog')
  const baseFramework = gap.decision === 'adapt_existing'
    ? array(catalog.frameworks ?? [], 'framework catalog frameworks').find((entry) => entry.framework_id === gap.candidate_framework_id && entry.version === gap.candidate_framework_version && entry.status === 'approved')
    : null
  if (gap.decision === 'adapt_existing' && !baseFramework) fail(`framework gap ${gap.gap_id} base framework is not an approved catalog entry`)
  const base = {
    schema: 'framework_pilot_fixture.v1', run_id: context.runId, gap_id: gap.gap_id, article_id: gap.article_id, stage: gap.stage,
    target: { framework_id: gap.target_framework_id, version: gap.target_version, path: gap.target_framework_path },
    base_framework: baseFramework ? { framework_id: baseFramework.framework_id, version: baseFramework.version, path: baseFramework.path, byte_hash: baseFramework.framework_sha256 } : null,
    current_catalog_byte_hash: sha256Bytes(readFileSync(FRAMEWORK_CATALOG_PATH)), runtime_inputs: runtimeInputs,
    article_fixture: {
      language: context.substance.language, substance_slug: context.substance.slug, source_id: 'framework-pilot-source', record_id: 'framework-pilot-record',
      allowed_fact: { claim: 'Die Pilotquelle dokumentiert eine begrenzte Beispielbeobachtung.', value: 5, unit: 'mg', uncertainty: 'Nur technische Pilot-Fixture; keine Publikationsaussage.' },
      required_visible_blocks: ['title', 'dek', 'fazit', 'sources'], forbidden_visible_blocks: ['graphic_briefing', 'placeholder', 'system_language'],
    },
    required_components: ['framework_compiler_pilot_receipt.v1', 'framework_render_pilot_receipt.v1', 'framework_publication_pilot_receipt.v1'],
  }
  const value = { ...base, content_hash: artifactHashV2(base) }
  const path = frameworkPilotFixturePath(context, gap)
  if (!existsSync(path) || canonicalJsonHash(strictJson(path, `framework pilot fixture ${gap.gap_id}`)) !== canonicalJsonHash(value)) writeJsonAtomic(path, value)
  return { path, value, byteHash: sha256Bytes(readFileSync(path)) }
}

function validateFrameworkPilotArtifact(context, gap, binding, label) {
  object(binding, label)
  text(binding.name, `${label}.name`)
  const path = resolveManifestPath(context.root, binding.path, `${label}.path`)
  if (!isContained(frameworkCandidateDir(context, gap), path) || !existsSync(path)) fail(`${label} is missing/outside the framework candidate directory`)
  if (binding.byte_hash !== sha256Bytes(readFileSync(path))) fail(`${label} byte hash differs from the executed artifact`)
  return { name: binding.name, path, byte_hash: binding.byte_hash }
}

const FRAMEWORK_PILOT_CHECKS = Object.freeze({
  framework_compiler_pilot_receipt_v1: Object.freeze(['fixture_parsed', 'compiled_payload_schema_valid', 'deterministic_recompile_match', 'markdown_contract_valid']),
  framework_render_pilot_receipt_v1: Object.freeze(['route_rendered', 'projection_exact', 'responsive_layout', 'no_visible_placeholder']),
  framework_publication_pilot_receipt_v1: Object.freeze(['guard_rejected_stale_state', 'atomic_apply_committed', 'exact_targeted_readback', 'rollback_verified']),
})

function validateFrameworkPilotComponent(context, gap, path, expectedSchema, frameworkByteHash, catalogCandidateHash, pilotFixture) {
  if (!existsSync(path)) return null
  const receipt = strictJson(path, `framework pilot ${gap.gap_id} ${expectedSchema}`)
  if (receipt.schema !== expectedSchema || receipt.content_hash !== artifactHashV2(receipt) || receipt.result !== 'PASS' || receipt.gap_id !== gap.gap_id || receipt.framework_byte_hash !== frameworkByteHash || receipt.catalog_candidate_hash !== catalogCandidateHash || receipt.pilot_fixture_hash !== pilotFixture.value.content_hash) fail(`framework pilot ${gap.gap_id} ${expectedSchema} lineage/result is invalid`)
  const issued = context.issuedWorkOrders.find((order) => order.work_order_id === receipt.work_order_id)
  const fixtureInput = issued?.inputs?.find((input) => input.name === `pilot_fixture_${gap.gap_id}`)
  if (!issued || issued.kind !== 'framework_design' || issued.assignee?.role !== 'article-framework-designer' || !issued.outputs.some((output) => resolveManifestPath(output.root === 'repo' ? REPO_ROOT : context.root, output.path, `${expectedSchema} WorkOrder output`) === path && output.schema === expectedSchema) || fixtureInput?.content_hash !== pilotFixture.value.content_hash || fixtureInput?.byte_hash !== pilotFixture.byteHash) fail(`framework pilot ${gap.gap_id} ${expectedSchema} does not bind its exact issued framework_design WorkOrder/output and runner-issued fixture`)
  const executor = object(receipt.executor, `framework pilot ${gap.gap_id} ${expectedSchema}.executor`)
  if (executor.role !== 'article-framework-designer') fail(`framework pilot ${gap.gap_id} ${expectedSchema} executor role is invalid`)
  assertSafeId(executor.id, `framework pilot ${gap.gap_id} ${expectedSchema} executor id`)
  text(executor.tool, `framework pilot ${gap.gap_id} ${expectedSchema} tool`); text(executor.tool_version, `framework pilot ${gap.gap_id} ${expectedSchema} tool_version`)
  const execution = object(receipt.execution, `framework pilot ${gap.gap_id} ${expectedSchema}.execution`)
  if (execution.exit_code !== 0 || !HASH.test(execution.argv_hash ?? '')) fail(`framework pilot ${gap.gap_id} ${expectedSchema} has no successful hash-bound tool execution`)
  if (!Number.isFinite(Date.parse(text(execution.started_at, `${expectedSchema}.execution.started_at`))) || !Number.isFinite(Date.parse(text(execution.finished_at, `${expectedSchema}.execution.finished_at`))) || Date.parse(execution.finished_at) < Date.parse(execution.started_at)) fail(`framework pilot ${gap.gap_id} ${expectedSchema} execution timestamps are invalid`)
  const artifacts = array(receipt.execution_artifacts, `framework pilot ${gap.gap_id} ${expectedSchema}.execution_artifacts`).map((binding, index) => validateFrameworkPilotArtifact(context, gap, binding, `${expectedSchema}.execution_artifacts[${index}]`))
  if (!['fixture', 'output', 'execution_log'].every((name) => artifacts.some((artifact) => artifact.name === name)) || new Set(artifacts.map((artifact) => artifact.name)).size !== artifacts.length) fail(`framework pilot ${gap.gap_id} ${expectedSchema} must bind distinct fixture, output and execution_log artifacts`)
  const fixtureArtifact = artifacts.find((artifact) => artifact.name === 'fixture')
  if (fixtureArtifact.path !== pilotFixture.path || fixtureArtifact.byte_hash !== pilotFixture.byteHash) fail(`framework pilot ${gap.gap_id} ${expectedSchema} used a self-selected fixture instead of the exact runner-issued pilot input`)
  const checks = object(receipt.checks, `framework pilot ${gap.gap_id} ${expectedSchema}.checks`)
  const checkKey = expectedSchema.replaceAll('.', '_')
  for (const name of FRAMEWORK_PILOT_CHECKS[checkKey] ?? []) if (checks[name] !== true) fail(`framework pilot ${gap.gap_id} ${expectedSchema} did not prove ${name}`)
  if (expectedSchema === 'framework_compiler_pilot_receipt.v1' && !HASH.test(receipt.compiled_payload_hash ?? '')) fail(`framework pilot ${gap.gap_id} compiler output hash is invalid`)
  if (expectedSchema === 'framework_render_pilot_receipt.v1' && (!HASH.test(receipt.compiled_payload_hash ?? '') || !HASH.test(receipt.projection_hash ?? ''))) fail(`framework pilot ${gap.gap_id} render lineage hashes are invalid`)
  if (expectedSchema === 'framework_publication_pilot_receipt.v1' && (!HASH.test(receipt.release_hash ?? '') || !HASH.test(receipt.publish_receipt_hash ?? ''))) fail(`framework pilot ${gap.gap_id} publication lineage hashes are invalid`)
  return { path, receipt, executorId: executor.id, binding: { path: portablePath(context.root, path), byte_hash: sha256Bytes(readFileSync(path)), content_hash: receipt.content_hash } }
}

function ensureFrameworkCompositePilot(context, gap, frameworkByteHash, catalogCandidate, components, pilotFixture) {
  const path = frameworkPilotPath(context, gap)
  const receipts = Object.fromEntries(components.map((component) => [component.receipt.schema.split('_')[1], component.binding]))
  const base = {
    schema: 'article_framework_pilot_receipt.v2', gap_id: gap.gap_id, framework_id: gap.target_framework_id, framework_version: gap.target_version,
    candidate_framework_byte_hash: frameworkByteHash, catalog_candidate_hash: catalogCandidate.content_hash,
    pilot_fixture_hash: pilotFixture.value.content_hash, technical_change_paths: [], receipts, result: 'PASS', composed_by: 'nutrient-content-runner',
  }
  const expected = { ...base, content_hash: artifactHashV2(base) }
  if (existsSync(path)) {
    const current = strictJson(path, `framework composite pilot ${gap.gap_id}`)
    if (canonicalJsonHash(current) !== canonicalJsonHash(expected)) fail(`framework composite pilot ${gap.gap_id} differs from the deterministic component composition`)
  } else writeJsonAtomic(path, expected)
  return { path, receipt: expected }
}

function validateFrameworkCandidate(context, gap) {
  const candidatePath = frameworkCandidatePath(context, gap), catalogCandidatePath = frameworkCatalogCandidatePath(context, gap)
  const componentDefinitions = [
    ['compiler', 'framework_compiler_pilot_receipt.v1'],
    ['render', 'framework_render_pilot_receipt.v1'],
    ['publication', 'framework_publication_pilot_receipt.v1'],
  ]
  if (![candidatePath, catalogCandidatePath].every(existsSync)) return { status: 'needs_design', reason: 'versioned candidate framework or catalog entry is missing', technicalPaths: [] }
  const frameworkByteHash = sha256Bytes(readFileSync(candidatePath))
  const catalogCandidate = strictJson(catalogCandidatePath, `framework catalog candidate ${gap.gap_id}`)
  if (catalogCandidate.schema !== 'framework_catalog_candidate.v1' || catalogCandidate.content_hash !== artifactHashV2(catalogCandidate) || catalogCandidate.gap_id !== gap.gap_id || catalogCandidate.expected_catalog_byte_hash !== sha256Bytes(readFileSync(FRAMEWORK_CATALOG_PATH))) fail(`framework catalog candidate ${gap.gap_id} schema/hash/prior catalog binding is invalid`)
  const entry = object(catalogCandidate.entry, `framework catalog candidate ${gap.gap_id}.entry`)
  if (entry.framework_id !== gap.target_framework_id || entry.version !== gap.target_version || entry.stage !== gap.stage || entry.path !== gap.target_framework_path || entry.status !== 'approved' || entry.framework_sha256 !== frameworkByteHash) fail(`framework catalog candidate ${gap.gap_id} target entry differs from the planned gap/candidate bytes`)
  const technicalPaths = normalizeFrameworkTechnicalPaths(catalogCandidate.technical_change_paths, gap.gap_id)
  const technicalBaseline = array(catalogCandidate.technical_change_baseline, `framework catalog candidate ${gap.gap_id}.technical_change_baseline`).map((binding, index) => {
    object(binding, `framework catalog candidate ${gap.gap_id}.technical_change_baseline[${index}]`)
    const path = text(binding.path, `framework catalog candidate ${gap.gap_id}.technical_change_baseline[${index}].path`).replaceAll('\\', '/')
    if (!(binding.byte_hash === null || HASH.test(binding.byte_hash ?? ''))) fail(`framework catalog candidate ${gap.gap_id} technical baseline hash is invalid`)
    return { path, byte_hash: binding.byte_hash }
  }).sort((left, right) => left.path.localeCompare(right.path))
  if (!sameSet(technicalBaseline.map((binding) => binding.path), technicalPaths)) fail(`framework catalog candidate ${gap.gap_id} technical baseline must bind every declared runtime path exactly once`)
  const pilotFixturePath = frameworkPilotFixturePath(context, gap)
  if (!existsSync(pilotFixturePath)) return { status: 'needs_design', reason: 'runner-issued framework pilot fixture is missing', technicalPaths }
  const pilotFixtureValue = strictJson(pilotFixturePath, `framework pilot fixture ${gap.gap_id}`)
  if (pilotFixtureValue.schema !== 'framework_pilot_fixture.v1' || pilotFixtureValue.content_hash !== artifactHashV2(pilotFixtureValue)) fail(`framework pilot fixture ${gap.gap_id} schema/hash is invalid`)
  const pilotFixture = { path: pilotFixturePath, value: pilotFixtureValue, byteHash: sha256Bytes(readFileSync(pilotFixturePath)) }
  const issued = context.issuedWorkOrders.find((order) => order.work_order_id === catalogCandidate.work_order_id)
  const candidateOutput = issued?.outputs?.find((output) => output.name === `candidate_framework_${gap.gap_id}`)
  const catalogOutput = issued?.outputs?.find((output) => output.name === `catalog_candidate_${gap.gap_id}`)
  const fixtureInput = issued?.inputs?.find((input) => input.name === `pilot_fixture_${gap.gap_id}`)
  if (!issued || issued.kind !== 'framework_design' || issued.assignee?.role !== 'article-framework-designer' || resolveManifestPath(context.root, candidateOutput?.path, 'framework candidate output') !== candidatePath || resolveManifestPath(context.root, catalogOutput?.path, 'framework catalog candidate output') !== catalogCandidatePath || fixtureInput?.content_hash !== pilotFixture.value.content_hash || fixtureInput?.byte_hash !== pilotFixture.byteHash || catalogCandidate.pilot_fixture_hash !== pilotFixture.value.content_hash) fail(`framework catalog candidate ${gap.gap_id} does not bind its exact issued design WorkOrder, outputs and runner-issued fixture`)
  const currentTechnicalBaseline = technicalPaths.map(runtimePathBinding)
  if (canonicalJsonHash(technicalBaseline) !== canonicalJsonHash(currentTechnicalBaseline)) return { status: 'needs_design', reason: 'declared framework runtime paths changed; candidate and pilots must be reissued against the new runtime hashes', candidatePath, catalogCandidatePath, frameworkByteHash, catalogCandidate, technicalPaths }
  if (technicalPaths.length) return {
    status: 'runtime_gap', reason: 'candidate requires runtime, renderer or schema changes that are forbidden inside a content run', candidatePath, catalogCandidatePath, frameworkByteHash, catalogCandidate, technicalPaths, pilotFixture,
  }
  if (!componentDefinitions.map(([kind]) => frameworkComponentReceiptPath(context, gap, kind)).every(existsSync)) return { status: 'needs_pilot', reason: 'declarative candidate needs all three real pilot receipts against the runner-issued fixture', candidatePath, catalogCandidatePath, frameworkByteHash, catalogCandidate, technicalPaths, pilotFixture }
  const components = componentDefinitions.map(([kind, schema]) => validateFrameworkPilotComponent(context, gap, frameworkComponentReceiptPath(context, gap, kind), schema, frameworkByteHash, catalogCandidate.content_hash, pilotFixture))
  const compiler = components.find((component) => component.receipt.schema === 'framework_compiler_pilot_receipt.v1')
  const render = components.find((component) => component.receipt.schema === 'framework_render_pilot_receipt.v1')
  if (render.receipt.compiled_payload_hash !== compiler.receipt.compiled_payload_hash) fail(`framework pilot ${gap.gap_id} render did not consume the compiler pilot output`)
  const pilot = ensureFrameworkCompositePilot(context, gap, frameworkByteHash, catalogCandidate, components, pilotFixture)
  const pilotPath = pilot.path
  let ownerApproval = null
  if (gap.owner_approval_required) {
    const ownerPath = frameworkOwnerApprovalPath(context, gap)
    if (!existsSync(ownerPath)) return { status: 'needs_owner_approval', reason: 'new archetype needs a separate human Owner approval receipt', candidatePath, catalogCandidatePath, pilotPath, frameworkByteHash, catalogCandidate, pilot: pilot.receipt, technicalPaths, components }
    ownerApproval = strictJson(ownerPath, `framework Owner approval ${gap.gap_id}`)
    const issued = context.issuedWorkOrders.find((order) => order.work_order_id === ownerApproval.work_order_id)
    if (!issued || issued.kind !== 'framework_owner_approval' || issued.assignee?.role !== 'framework-owner-approver' || !issued.outputs.some((output) => output.name === 'owner_approval' && output.schema === ownerApproval.schema && resolveManifestPath(context.root, output.path, 'framework owner approval output') === ownerPath)) fail(`framework Owner approval ${gap.gap_id} does not bind its exact HUMAN WorkOrder/output`)
    if (ownerApproval.schema !== 'framework_owner_approval_receipt.v1' || ownerApproval.content_hash !== artifactHashV2(ownerApproval) || ownerApproval.gap_id !== gap.gap_id || ownerApproval.framework_byte_hash !== frameworkByteHash || ownerApproval.catalog_candidate_hash !== catalogCandidate.content_hash || ownerApproval.pilot_hash !== pilot.receipt.content_hash || ownerApproval.decision !== 'APPROVED') fail(`framework Owner approval ${gap.gap_id} is invalid or not bound to the candidate/pilot`)
    text(ownerApproval.approved_by, `framework Owner approval ${gap.gap_id}.approved_by`); if (!Number.isFinite(Date.parse(text(ownerApproval.approved_at, `framework Owner approval ${gap.gap_id}.approved_at`)))) fail(`framework Owner approval ${gap.gap_id}.approved_at is invalid`)
  }
  return { status: 'ready_to_activate', candidatePath, catalogCandidatePath, pilotPath, ownerApprovalPath: gap.owner_approval_required ? frameworkOwnerApprovalPath(context, gap) : null, frameworkByteHash, catalogCandidate, pilot: pilot.receipt, ownerApproval, technicalPaths, components }
}

function validateFrameworkGapResolution(context, gap) {
  const catalog = strictJson(FRAMEWORK_CATALOG_PATH, 'framework catalog')
  const entry = array(catalog.frameworks ?? [], 'framework catalog frameworks').find((item) => item.framework_id === gap.target_framework_id && item.version === gap.target_version && item.stage === gap.stage && item.status === 'approved')
  if (!entry) return validateFrameworkCandidate(context, gap)
  const frameworkPath = resolve(REPO_ROOT, gap.target_framework_path)
  if (entry.path !== gap.target_framework_path || !existsSync(frameworkPath) || entry.framework_sha256 !== sha256Bytes(readFileSync(frameworkPath))) fail(`activated framework ${gap.gap_id} catalog/file binding is invalid`)
  const activationPath = frameworkActivationPath(context, gap)
  if (!existsSync(activationPath)) fail(`activated framework ${gap.gap_id} has no guarded activation receipt`)
  const activation = strictJson(activationPath, `framework activation ${gap.gap_id}`)
  const issued = context.issuedWorkOrders.find((order) => order.work_order_id === activation.work_order_id)
  if (!issued || issued.kind !== 'framework_catalog_activate' || issued.assignee?.role !== 'deterministic-framework-catalog-activator' || !issued.outputs.some((output) => output.name === 'activation_receipt' && output.schema === activation.schema && resolveManifestPath(context.root, output.path, 'framework activation output') === activationPath)) fail(`framework activation ${gap.gap_id} does not bind its exact issued deterministic WorkOrder/output`)
  if (activation.schema !== 'framework_catalog_activation_receipt.v1' || activation.content_hash !== artifactHashV2(activation) || activation.result !== 'PASS' || activation.gap_id !== gap.gap_id || activation.framework_id !== gap.target_framework_id || activation.framework_version !== gap.target_version || activation.target_framework_path !== gap.target_framework_path || activation.framework_byte_hash !== entry.framework_sha256 || activation.resulting_catalog_byte_hash !== sha256Bytes(readFileSync(FRAMEWORK_CATALOG_PATH)) || activation.atomic_bundle?.result !== 'COMMITTED' || activation.readback?.framework_byte_hash !== entry.framework_sha256 || activation.readback?.catalog_byte_hash !== activation.resulting_catalog_byte_hash) fail(`framework activation ${gap.gap_id} receipt lineage/atomic readback differs`)
  return { status: 'resolved', resolved: true, activationPath, activation, entry }
}

export function selectFrameworkGapTransition(resolutions) {
  const normalized = array(resolutions, 'framework gap resolutions')
  const resolved = normalized.filter((entry) => entry.status === 'resolved')
  if (resolved.length) return { action: 'replan', entry: resolved[0], deferred_gap_ids: normalized.filter((entry) => entry !== resolved[0]).map((entry) => entry.gap.gap_id) }
  for (const [status, action] of [['needs_design', 'design'], ['needs_pilot', 'design'], ['runtime_gap', 'technical_handoff'], ['needs_owner_approval', 'owner_approval'], ['ready_to_activate', 'activate']]) {
    const matches = normalized.filter((entry) => entry.status === status)
    if (matches.length) return { action, entry: matches[0], deferred_gap_ids: normalized.filter((entry) => entry !== matches[0]).map((entry) => entry.gap.gap_id) }
  }
  fail(`framework gap state routing is incomplete: ${normalized.map((entry) => `${entry.gap.gap_id}:${entry.status}`).join(', ')}`)
}

function frameworkDesignWorkOrder(context, coverage, gaps, issuedWorkOrders, reason, runtimePaths = []) {
  const catalog = strictJson(FRAMEWORK_CATALOG_PATH, 'framework catalog')
  const inputs = [
    runInput(context, 'coverage_plan_with_framework_gap', context.coveragePlanPath, { contentHash: coverage.content_hash, schema: 'coverage_plan.v2' }),
    repoInput('framework_catalog', 'codex-files/frameworks/framework-catalog.v1.json', { schema: 'framework_catalog.v1' }),
  ]
  for (const gap of gaps) {
    const fixture = ensureFrameworkPilotFixture(context, gap, runtimePaths)
    inputs.push(runInput(context, `pilot_fixture_${gap.gap_id}`, fixture.path, { contentHash: fixture.value.content_hash, schema: 'framework_pilot_fixture.v1' }))
  }
  for (const gap of gaps.filter((entry) => entry.decision === 'adapt_existing')) {
    const candidate = array(catalog.frameworks ?? [], 'framework catalog frameworks').find((entry) => entry.framework_id === gap.candidate_framework_id && entry.version === gap.candidate_framework_version && entry.status === 'approved')
    if (!candidate) fail(`framework gap ${gap.gap_id} candidate framework is not an approved catalog entry`)
    inputs.push(repoInput(`candidate_framework_${gap.gap_id}`, candidate.path))
  }
  const expectedInputHashes = new Map(inputs.map((input) => [input.name, `${input.byte_hash}:${input.content_hash}`]))
  const prior = [...issuedWorkOrders].reverse().find((order) => order.kind === 'framework_design'
    && order.inputs?.length === inputs.length
    && order.inputs.every((input) => expectedInputHashes.get(input.name) === `${input.byte_hash}:${input.content_hash}`))
  if (prior) return prior
  const proposed = workOrder(context, 'framework_design', {
    reason,
    scope: orderScope('articles', { articleIds: gaps.map((gap) => gap.article_id) }),
    assignee: { role: 'article-framework-designer', independent_from_ids: [] }, inputs, reused_sources: [], link_inventory: null,
    outputs: [
      ...gaps.flatMap((gap) => [
        runOutput(context, `candidate_framework_${gap.gap_id}`, frameworkCandidatePath(context, gap), { mediaType: 'text/markdown' }),
        runOutput(context, `catalog_candidate_${gap.gap_id}`, frameworkCatalogCandidatePath(context, gap), { schema: 'framework_catalog_candidate.v1' }),
        runOutput(context, `compiler_pilot_${gap.gap_id}`, frameworkComponentReceiptPath(context, gap, 'compiler'), { schema: 'framework_compiler_pilot_receipt.v1' }),
        runOutput(context, `render_pilot_${gap.gap_id}`, frameworkComponentReceiptPath(context, gap, 'render'), { schema: 'framework_render_pilot_receipt.v1' }),
        runOutput(context, `publication_pilot_${gap.gap_id}`, frameworkComponentReceiptPath(context, gap, 'publication'), { schema: 'framework_publication_pilot_receipt.v1' }),
      ]),
    ],
    task: {
      gaps: gaps.map((gap) => ({ ...gap, candidate_paths: { framework: portablePath(context.root, frameworkCandidatePath(context, gap)), catalog_entry: portablePath(context.root, frameworkCatalogCandidatePath(context, gap)), deterministic_composite_pilot: portablePath(context.root, frameworkPilotPath(context, gap)), owner_approval: gap.owner_approval_required ? portablePath(context.root, frameworkOwnerApprovalPath(context, gap)) : null } })),
      pilot_contract: {
        required_component_receipts: ['framework_compiler_pilot_receipt.v1', 'framework_render_pilot_receipt.v1', 'framework_publication_pilot_receipt.v1'],
        execution_proof: { exact_work_order_id: true, executor_id_and_tool_version: true, successful_timestamps_and_exit_code: true, exact_runner_issued_fixture_output_and_execution_log: true, schema_specific_checks_all_true: true },
        catalog_candidate_binds: ['work_order_id', 'pilot_fixture_hash', 'technical_change_paths', 'technical_change_baseline'],
        runtime_gap_rule: 'Write no pilot PASS receipts when technical_change_paths is non-empty. The content run hands the gap to a separately authorized development and independent technical-review task.',
        deterministic_composite_schema: 'article_framework_pilot_receipt.v2',
      },
      next_step: 'For a declarative candidate (technical_change_paths=[]), execute all three pilots against the exact runner-issued fixture. Otherwise stop after candidate/catalog output; after external implementation and review, the runner reissues design/pilots against changed runtime hashes.',
    },
    constraints: { candidate_outputs_only: true, no_canonical_catalog_or_framework_write: true, no_runtime_renderer_schema_write: true, versioned_framework_file: true, targeted_compiler_render_publication_pilot: true, no_self_asserted_composite_pass: true, runner_issued_pilot_fixture_only: true, separate_owner_approval_for_new_archetype: true, no_article_writing: true },
  })
  return proposed
}

function frameworkRuntimeGapHandoffWorkOrder(context, gap, resolution, issuedWorkOrders, reason) {
  const proposed = workOrder(context, 'framework_runtime_change_handoff', {
    execution_class: 'human', reason, scope: orderScope('articles', { articleIds: [gap.article_id] }), assignee: { role: 'framework-runtime-change-owner', independent_from_ids: [] },
    inputs: [
      runInput(context, 'candidate_framework', resolution.candidatePath),
      runInput(context, 'catalog_candidate', resolution.catalogCandidatePath, { contentHash: resolution.catalogCandidate.content_hash, schema: 'framework_catalog_candidate.v1' }),
      runInput(context, 'pilot_fixture', resolution.pilotFixture.path, { contentHash: resolution.pilotFixture.value.content_hash, schema: 'framework_pilot_fixture.v1' }),
    ], reused_sources: [], link_inventory: null, outputs: [],
    task: {
      gap_id: gap.gap_id, technical_change_paths: resolution.technicalPaths, framework_byte_hash: resolution.frameworkByteHash, catalog_candidate_hash: resolution.catalogCandidate.content_hash,
      required_external_workflow: ['explicit_owner_authorization', 'scoped_development_implementation', 'independent_technical_review', 'changed_runtime_hash_readback', 'rerun_content_pipeline'],
      resume_condition: 'The changed runtime/path hashes invalidate this candidate. The runner must issue a new framework_design WorkOrder and all pilots must run against its new fixture.',
    },
    constraints: { no_automatic_implementation: true, no_runtime_write_by_content_runner: true, no_pilot_pass_before_runtime_support: true, no_implicit_owner_or_technical_approval: true },
  })
  return [...issuedWorkOrders].reverse().find((order) => order.work_order_id === proposed.work_order_id) ?? proposed
}

function frameworkOwnerApprovalWorkOrder(context, gap, resolution, issuedWorkOrders, reason) {
  const outputPath = frameworkOwnerApprovalPath(context, gap)
  const prior = [...issuedWorkOrders].reverse().find((order) => order.kind === 'framework_owner_approval' && order.outputs.some((output) => output.name === 'owner_approval' && resolveManifestPath(context.root, output.path, 'prior framework owner approval output') === outputPath))
  if (prior) return prior
  return workOrder(context, 'framework_owner_approval', {
    execution_class: 'human', reason, scope: orderScope('articles', { articleIds: [gap.article_id] }), assignee: { role: 'framework-owner-approver', independent_from_ids: [] },
    inputs: [
      runInput(context, 'candidate_framework', resolution.candidatePath),
      runInput(context, 'catalog_candidate', resolution.catalogCandidatePath, { contentHash: resolution.catalogCandidate.content_hash, schema: 'framework_catalog_candidate.v1' }),
      runInput(context, 'framework_pilot', resolution.pilotPath, { contentHash: resolution.pilot.content_hash, schema: 'article_framework_pilot_receipt.v2' }),
    ], reused_sources: [], link_inventory: null,
    outputs: [runOutput(context, 'owner_approval', outputPath, { schema: 'framework_owner_approval_receipt.v1' })],
    task: { gap_id: gap.gap_id, decision: gap.decision, framework_byte_hash: resolution.frameworkByteHash, catalog_candidate_hash: resolution.catalogCandidate.content_hash, pilot_hash: resolution.pilot.content_hash, allowed_decisions: ['APPROVED', 'REJECTED'] },
    constraints: { human_decision: true, exact_candidate_catalog_and_pilot_hashes: true, no_implicit_approval: true, no_file_write_except_receipt: true },
  })
}

function frameworkActivationWorkOrder(context, gap, resolution, issuedWorkOrders, reason) {
  const prior = [...issuedWorkOrders].reverse().find((order) => order.kind === 'framework_catalog_activate' && order.task?.gap_id === gap.gap_id && order.task?.catalog_candidate_hash === resolution.catalogCandidate.content_hash)
  if (prior) return prior
  const inputs = [
    runInput(context, 'candidate_framework', resolution.candidatePath),
    runInput(context, 'catalog_candidate', resolution.catalogCandidatePath, { contentHash: resolution.catalogCandidate.content_hash, schema: 'framework_catalog_candidate.v1' }),
    runInput(context, 'framework_pilot', resolution.pilotPath, { contentHash: resolution.pilot.content_hash, schema: 'article_framework_pilot_receipt.v2' }),
    repoInput('current_framework_catalog', 'codex-files/frameworks/framework-catalog.v1.json', { schema: 'framework_catalog.v1' }),
    ...(resolution.ownerApprovalPath ? [runInput(context, 'owner_approval', resolution.ownerApprovalPath, { contentHash: resolution.ownerApproval.content_hash, schema: 'framework_owner_approval_receipt.v1' })] : []),
  ]
  return workOrder(context, 'framework_catalog_activate', {
    reason, scope: orderScope('articles', { articleIds: [gap.article_id] }), assignee: { role: 'deterministic-framework-catalog-activator', independent_from_ids: [] },
    inputs, reused_sources: [], link_inventory: null,
    outputs: [
      repoOutput('activated_framework', gap.target_framework_path, { mediaType: 'text/markdown' }),
      repoOutput('activated_framework_catalog', 'codex-files/frameworks/framework-catalog.v1.json', { schema: 'framework_catalog.v1' }),
      runOutput(context, 'activation_receipt', frameworkActivationPath(context, gap), { schema: 'framework_catalog_activation_receipt.v1' }),
    ],
    task: { gap_id: gap.gap_id, target_framework_path: gap.target_framework_path, framework_id: gap.target_framework_id, framework_version: gap.target_version, expected_framework_absent: true, expected_catalog_byte_hash: resolution.catalogCandidate.expected_catalog_byte_hash, candidate_framework_byte_hash: resolution.frameworkByteHash, catalog_candidate_hash: resolution.catalogCandidate.content_hash, pilot_hash: resolution.pilot.content_hash, owner_approval_hash: resolution.ownerApproval?.content_hash ?? null },
    constraints: { non_llm: true, explicit_framework_activation_flag: true, no_overwrite: true, expected_catalog_hash_guard: true, atomic_framework_and_catalog_promotion: true },
  })
}

function escalationWorkOrder(context, kind, { reason, article = null, task = {}, inputs = [] }) {
  return workOrder(context, kind, {
    execution_class: 'human',
    reason, scope: article ? orderScope('articles', { articleIds: [article.article_id] }) : orderScope('run'),
    assignee: { role: 'content-pipeline-escalation-owner', independent_from_ids: [] }, inputs, reused_sources: [], link_inventory: null, outputs: [],
    task: { ...(article ? { article_id: article.article_id, stage: article.stage } : {}), ...task }, constraints: { no_automatic_success: true, explicit_resolution_required: true },
  })
}

function publicationApplyOrder(context, release, reason) {
  const allArticleIds = [...release.articles.map((article) => article.article_id), ...(release.retire_articles ?? []).map((article) => article.article_id)].sort()
  return workOrder(context, 'publication_apply', {
    reason, scope: orderScope('articles', { articleIds: allArticleIds }), assignee: { role: 'deterministic-content-publication-executor', independent_from_ids: [] },
    inputs: [runInput(context, 'content_release', context.releasePath, { contentHash: release.release_hash, schema: 'content_release.v2' })], reused_sources: [], link_inventory: null,
    outputs: [runOutput(context, 'publish_receipt', context.publishReceiptPath, { schema: 'content_publish_receipt.v2' })],
    task: { target: context.publish.target, release_hash: release.release_hash, articles: release.articles.map((article) => ({ article_id: article.article_id, slug: article.slug, write_guard: article.write_guard, compiled_payload_hash: article.compiled_payload_hash })), retire_articles: release.retire_articles ?? [] },
    constraints: { non_llm: true, guarded_write: true, exactly_one_row_per_applied_article: true, status_only_retirement: true, targeted_readback: true, no_automatic_retry_after_receipt: true },
  })
}

function indexabilityReleaseHandoffOrder(context, release, publish) {
  const blockedArticleIds = [...new Set([
    ...publish.indexabilityBlockers.map((entry) => entry.article_id),
    ...publish.deliveryGaps.map((entry) => entry.article_id),
  ])].sort()
  return workOrder(context, 'indexability_release_handoff', {
    execution_class: 'human', reasoning_tier: 'standard',
    reason: 'the articles are published and content-matched, but page/origin delivery evidence still blocks a live indexability claim',
    scope: orderScope('articles', { articleIds: blockedArticleIds }),
    assignee: { role: 'site-indexability-release-owner', independent_from_ids: [] },
    inputs: [runInput(context, 'content_release', context.releasePath, { contentHash: release.release_hash, schema: 'content_release.v2' }), runInput(context, 'publish_receipt', context.publishReceiptPath, { contentHash: publish.receiptHash, schema: 'content_publish_receipt.v2' })],
    reused_sources: [], link_inventory: null, outputs: [],
    task: { release_hash: release.release_hash, blocked_article_ids: blockedArticleIds, blockers: publish.indexabilityBlockers, delivery_gaps: publish.deliveryGaps, site_policy_fingerprints: [...new Set(publish.indexabilityBlockers.map((entry) => entry.site_policy_fingerprint))].sort(), action: 'repair only the reported page/origin HTTP, robots, delivery or indexability state, then issue a fresh targeted public readback without changing article content' },
    constraints: { article_publish_remains_committed: true, no_writer_or_qa_rerun: true, no_article_rollback: true, delivery_or_site_policy_only: true },
  })
}

function indexabilityReleaseResult(context, release, publish) {
  return validateIndexabilityReleaseReceiptV1({
    release,
    publishReceipt: publish.receipt,
    receiptPath: context.indexabilityReleaseReceiptPath,
    rendererRequestPath: context.indexabilityRendererRequestPath,
    rendererReceiptPath: context.indexabilityRendererReceiptPath,
  })
}

function badgeReadbackEscalationOrder(context, release, publish) {
  return escalationWorkOrder(context, 'badge_readback_escalation', {
    reason: 'the article bundle, relations and detail pages are committed and matched, but the release-bound knowledge overview/API badge readback differs',
    inputs: [runInput(context, 'content_release', context.releasePath, { contentHash: release.release_hash, schema: 'content_release.v2' }), runInput(context, 'publish_receipt', context.publishReceiptPath, { contentHash: publish.receiptHash, schema: 'content_publish_receipt.v2' })],
    task: {
      release_hash: release.release_hash, affected_ingredient_ids: publish.badgeReadback.affected_ingredient_ids,
      badge_result: publish.badgeReadback.result, mismatches: publish.badgeMismatches,
      action: 'inspect or repair only the knowledge overview API aggregation, derived badge data, cache and hydrated overview rendering; then run a fresh release-bound badge readback',
      article_branch_status: 'COMPLETE', publication_apply_must_not_repeat: true, writer_or_publication_qa_must_not_repeat: true,
    },
  })
}

function stage4StackSyncOrder(context, pipeline, reason) {
  const packageValue = pipeline.packages.stage4
  if (!packageValue || !context.packagePaths.stage4) fail('Stage-4 WorkOrder needs the lock-bound Stage-4 facts package')
  const prestate = validateStage4TargetPrestate(context)
  return workOrder(context, 'stage4_stack_sync', {
    reason,
    scope: orderScope('obligations', { sourceIds: packageValue.visible_sources.map((source) => source.source_id), clusterIds: [...new Set(packageValue.facts.map((fact) => fact.cluster_id))], obligationIds: packageValue.obligation_ids }),
    assignee: { role: 'stage4-stack-sync', independent_from_ids: packageValue.facts_reviewer_ids },
    inputs: [
      runInput(context, 'facts_package_for_stage4', context.packagePaths.stage4, { contentHash: packageValue.package_content_hash, schema: 'facts_package_for_stage4.v2' }),
      runInput(context, 'evidence_pipeline_lock', pipeline.lockPath, { contentHash: pipeline.lock.lock_hash, schema: 'evidence_pipeline_lock.v2' }),
      ...(prestate ? [runInput(context, 'stage4_target_prestate', prestate.path, { contentHash: prestate.hash, schema: 'stage4_target_prestate.v1' })] : []),
      repoInput('stage4_framework', 'codex-files/frameworks/05_framework_stage_4_stack_sync.md'),
    ],
    reused_sources: [], link_inventory: null,
    outputs: [runOutput(context, 'stack_projection', context.stage4ProjectionPath, { schema: 'stack_projection.v2' }), runOutput(context, 'stack_sync_receipt', context.stage4ReceiptPath, { schema: 'stack_sync_receipt.v2' })],
    task: { target: context.stage4.target, write_guard: context.stage4.write_guard, prestate_hash: prestate?.hash ?? null, facts_package_id: packageValue.package_id, facts_package_hash: packageValue.package_content_hash, facts_hash: packageValue.facts_hash, evidence_lock_hash: pipeline.lock.lock_hash, projection_path: portablePath(context.root, context.stage4ProjectionPath), receipt_path: portablePath(context.root, context.stage4ReceiptPath) },
    constraints: { explicit_stage4_request: true, facts_package_only: true, no_article_facts: true, guarded_write: true, inert_draft_before_switch: true, exact_record_readback: true, no_article_rollback: true },
  })
}

function stage4Branch(context, pipeline, issuedWorkOrders) {
  if (!context.stage4.enabled) return { requested: false, status: 'NOT_REQUESTED', orders: [] }
  const packageValue = pipeline.packages.stage4
  if (!packageValue) fail('explicit Stage-4 branch has no lock-bound facts_package_for_stage4.v2')
  const prestate = validateStage4TargetPrestate(context)
  const priorOrder = [...issuedWorkOrders].reverse().find((order) => order.kind === 'stage4_stack_sync'
    && order.task?.facts_package_hash === packageValue.package_content_hash
    && order.task?.evidence_lock_hash === pipeline.lock.lock_hash
    && order.task?.target === context.stage4.target
    && order.task?.prestate_hash === prestate?.hash
    && canonicalJsonHash(order.task?.write_guard) === canonicalJsonHash(context.stage4.write_guard))
  if (!existsSync(context.stage4ReceiptPath)) return { requested: true, status: 'WAITING', orders: [priorOrder ?? stage4StackSyncOrder(context, pipeline, 'explicit Stage-4 child branch is ready after the facts gate')] }
  try {
    const receipt = strictJson(context.stage4ReceiptPath, 'Stage-4 stack sync receipt')
    if (receipt.schema !== 'stack_sync_receipt.v2' || receipt.content_hash !== artifactHashV2(receipt)) fail('Stage-4 stack sync receipt schema/content hash is invalid')
    if (!['PASS', 'BLOCKED'].includes(receipt.result) || receipt.run_id !== context.runId || receipt.facts_package_id !== packageValue.package_id || receipt.facts_package_hash !== packageValue.package_content_hash || receipt.facts_hash !== packageValue.facts_hash || receipt.evidence_lock_hash !== pipeline.lock.lock_hash || receipt.target !== context.stage4.target || canonicalJsonHash(receipt.write_guard) !== canonicalJsonHash(context.stage4.write_guard)) fail('Stage-4 stack sync receipt lineage/guard differs')
    const issued = issuedWorkOrders.find((order) => order.work_order_id === receipt.work_order_id)
    if (!issued || issued.kind !== 'stage4_stack_sync' || issued.work_order_id !== canonicalJsonHash(Object.fromEntries(Object.entries(issued).filter(([key]) => key !== 'work_order_id')))) fail('Stage-4 stack sync receipt does not bind an exact issued WorkOrder')
    if (receipt.executor?.role !== 'stage4-stack-sync') fail('Stage-4 stack sync receipt executor role is invalid')
    assertSafeId(receipt.executor.id, 'Stage-4 stack sync executor id')
    if (receipt.result === 'BLOCKED') {
      text(receipt.reason, 'Stage-4 blocked reason')
      return { requested: true, status: 'BLOCKED', orders: [], receipt, receiptHash: receipt.content_hash, reason: receipt.reason }
    }
    if (!Number.isFinite(Date.parse(text(receipt.applied_at, 'Stage-4 applied_at')))) fail('Stage-4 applied_at must be ISO-8601')
    if (!existsSync(context.stage4ProjectionPath)) fail('Stage-4 PASS receipt has no stack_projection.v2')
    const projection = validateStackProjectionV2({ projectionValue: strictJson(context.stage4ProjectionPath, 'stack projection'), pipeline })
    const projectionTargetKeys = [...new Set(projection.records.map((record) => `${record.ingredient_id}:${record.population_key}`))]
    const guardedTargetKeys = context.stage4.write_guard.targets.map((target) => `${target.ingredient_id}:${target.population_key}`)
    if (!sameSet(projectionTargetKeys, guardedTargetKeys)) fail('Stage-4 projection target set must exactly equal the unique guarded ingredient/population set')
    if (!['applied', 'already_current'].includes(receipt.apply_result)) fail('Stage-4 apply_result must be applied or already_current')
    if (canonicalJsonHash(receipt.guard_result?.expected) !== canonicalJsonHash(context.stage4.write_guard) || !Array.isArray(receipt.guard_result?.actual_before) || receipt.guard_result.actual_before.length !== context.stage4.write_guard.targets.length) fail('Stage-4 guard_result does not bind the expected target record set')
    for (const expected of context.stage4.write_guard.targets) {
      const actual = receipt.guard_result.actual_before.find((entry) => entry.target_key === expected.target_key)
      if (!actual || actual.ingredient_id !== expected.ingredient_id || actual.population_key !== expected.population_key || actual.status !== expected.expected_status || actual.version !== expected.expected_version || actual.payload_hash !== expected.expected_payload_hash) fail(`Stage-4 guard readback differs for ${expected.target_key}`)
    }
    if (receipt.apply_result === 'applied' && (receipt.guard_result.outcome !== 'MATCH' || receipt.changed_rows !== projection.records.length)) fail('Stage-4 applied receipt guard/count differs')
    if (receipt.apply_result === 'already_current' && (receipt.guard_result.outcome !== 'ALREADY_CURRENT' || receipt.changed_rows !== 0 || receipt.guard_result.current_projection_hash !== projection.content_hash)) fail('Stage-4 already_current needs exact current projection proof and zero writes')
    if (receipt.projection_path !== portablePath(context.root, context.stage4ProjectionPath) || receipt.projection_hash !== projection.content_hash || receipt.readback?.result !== 'MATCH' || receipt.readback?.projection_hash !== projection.content_hash || !sameSet(receipt.readback?.record_ids ?? [], projection.records.map((entry) => entry.projection_record_id))) fail('Stage-4 PASS receipt projection/apply/readback differs')
    return { requested: true, status: 'PASS', orders: [], receipt, receiptHash: receipt.content_hash, projection }
  } catch (error) {
    return { requested: true, status: 'BLOCKED_INTEGRITY', orders: [escalationWorkOrder(context, 'stage4_receipt_integrity_escalation', { reason: error.message, inputs: [runInput(context, 'stack_sync_receipt', context.stage4ReceiptPath, { schema: 'stack_sync_receipt.v2' })] })], reason: error.message }
  }
}

function stage4StatusExtra(branch) {
  return { stage4: { requested: branch.requested, status: branch.status, reason: branch.reason ?? null, receipt_hash: branch.receiptHash ?? null } }
}

function withStage4Orders(orders, branch) {
  return [...new Map([...orders, ...branch.orders].map((order) => [order.work_order_id, order])).values()]
}

function coveragePlanningWorkOrder(context, reason, { priorCoverage = null, affectedArticleIds = [], materialConflictSignals = [] } = {}) {
  const receipt = context.sourceArtifactReceipt
  return workOrder(context, 'coverage_planning', {
    reason, scope: affectedArticleIds.length ? orderScope('articles', { articleIds: affectedArticleIds }) : orderScope('run'), assignee: { role: 'coverage-planner', independent_from_ids: [] },
    inputs: [runInput(context, 'research', context.researchPath), sourceArtifactReceiptInput(context), repoInput('framework_catalog', 'codex-files/frameworks/framework-catalog.v1.json', { schema: 'framework_catalog.v1' }), ...(priorCoverage ? [runInput(context, 'prior_coverage_plan', context.coveragePlanPath, { contentHash: priorCoverage.content_hash, schema: 'coverage_plan.v2' })] : [])],
    reused_sources: [], link_inventory: linkInventoryInput(context),
    outputs: [runOutput(context, 'coverage_plan', context.coveragePlanPath, { schema: 'coverage_plan.v2' })],
    task: {
      objective: 'Create an article-oriented coverage plan in which every accepted meaningful source has exactly one Stage-2 carrier by default, with multi-source carriers limited to proven direct research lines or meta-analysis families; give every Stage-2 carrier a German original-title presentation label and use it byte-identically for its Stage-3 internal source entry; bind common public assumptions to explicit Stage-3 evidence checks, plus article-specific framework decisions, SEO briefs and extraction obligations.',
      stage2_source_assignment_policy: 'one_meaningful_source_per_stage2.v1',
      stage3_source_label_policy: 'german_original_title.v1',
      relevance_dimensions: [
        'Mangel, Statusmarker oder belegte Nicht-Essenzialität',
        'Übermaß, Überdosierung und relevante Sicherheitsgrenzen',
        'Formen, Bioverfügbarkeit und stoffrelevante Quellen',
      ],
      framework_catalog_hash: sha256Bytes(readFileSync(FRAMEWORK_CATALOG_PATH)), source_artifact_receipt_hash: receipt.hash,
      affected_article_ids: [...affectedArticleIds].sort(), preserve_unaffected_article_nodes: Boolean(affectedArticleIds.length),
      material_conflict_signals: materialConflictSignals, material_conflict_signal_hash: materialConflictSignals.length ? canonicalJsonHash(materialConflictSignals) : null,
    },
    constraints: { one_meaningful_source_per_stage2_by_default: true, multi_source_requires_direct_line_or_meta_family: true, stage3_sources_partition_exactly_once_across_internal_stage2_links: true, stage3_internal_source_labels_equal_german_original_titles: true, common_assumption_review_required_for_stage3: true, common_assumption_checks_require_source_cluster_obligation_bindings: true, no_uncovered_required_cluster: true, sources_must_equal_frozen_receipt: true, relevance_adaptive_sections_only: true, no_empty_or_forced_sections: true },
  })
}

function extractionSliceReasoningTier(evidenceInput, slice) {
  const obligations = evidenceInput.coveragePlan.extraction_obligations.filter((obligation) => slice.obligation_ids.includes(obligation.obligation_id))
  const clusters = new Map(evidenceInput.coveragePlan.clusters.map((cluster) => [cluster.cluster_id, cluster]))
  const highRisk = obligations.some((obligation) => {
    const tags = [...(obligation.plan_risk_tags ?? []), ...(clusters.get(obligation.cluster_id)?.plan_risk_tags ?? [])]
    const semantic = `${obligation.expected_claim_type ?? ''} ${obligation.cluster_id ?? ''}`
    return tags.some((tag) => tag !== 'standard') || /(?:safety|upper[_ -]?limit|toxicity|dose|reference[_ -]?value|interaction|contraindication|pregnan|breastfeeding|child|elderly|controvers|conflict)/i.test(semantic)
  })
  return highRisk ? 'high' : 'standard'
}

function extractionWorkOrders(context, evidenceInput, issuedWorkOrders, reason) {
  return evidenceInput.extractionSlices.filter((slice) => {
    return !existsSync(slice.shard_path)
  }).map((slice) => {
    const prior = [...issuedWorkOrders].reverse().find((order) => order.kind === 'source_extraction' && order.task?.slice_id === slice.slice_id && order.inputs?.some((input) => input.name === 'coverage_plan' && input.content_hash === evidenceInput.coveragePlan.content_hash) && order.inputs?.some((input) => input.name === 'evidence_manifest' && input.content_hash === evidenceInput.manifest.content_hash))
    if (prior) return prior
    return workOrder(context, 'source_extraction', {
    reasoning_tier: extractionSliceReasoningTier(evidenceInput, slice),
    reason, scope: orderScope('obligations', { sourceIds: slice.source_ids, clusterIds: slice.cluster_ids, obligationIds: slice.obligation_ids }),
    assignee: { role: 'source-evidence-extractor', independent_from_ids: [] },
    inputs: [runInput(context, 'coverage_plan', context.coveragePlanPath, { contentHash: evidenceInput.coveragePlan.content_hash, schema: 'coverage_plan.v2' }), sourceArtifactReceiptInput(context), runInput(context, 'evidence_manifest', context.evidenceManifestPath, { contentHash: evidenceInput.manifest.content_hash, schema: 'evidence_pipeline_build.v2' })],
    reused_sources: slice.source_ids.map((sourceId) => reusedSource(context, sourceId, evidenceInput.sourceArtifactPaths[sourceId], evidenceInput.coveragePlan.sources.find((source) => source.source_id === sourceId).source_content_hash)),
    link_inventory: null,
    outputs: [runOutput(context, 'evidence_shard', slice.shard_path, { schema: 'source_evidence_shard.v2' })],
    task: { slice_id: slice.slice_id, sources: evidenceInput.coveragePlan.sources.filter((source) => slice.source_ids.includes(source.source_id)), obligations: evidenceInput.coveragePlan.extraction_obligations.filter((obligation) => slice.obligation_ids.includes(obligation.obligation_id)), missing_outputs: [portablePath(context.root, slice.shard_path)] },
    constraints: { original_source_hashes_exact: true, frozen_source_bytes_only: true, no_network_refetch: true, terminal_outcome_per_obligation: true },
    })
  })
}

function normalizedFactsReviewFailures(failures) {
  const values = array(failures ?? [], 'source facts review failures').map((failure) => ({
    obligation_id: assertSafeId(failure.obligation_id, 'source facts review failure obligation_id'),
    record_id: failure.record_id == null ? null : assertSafeId(failure.record_id, 'source facts review failure record_id'),
    findings: array(failure.findings ?? [], 'source facts review failure findings').map((finding) => object(finding, 'source facts review finding')),
  }))
  return [...new Map(values.map((value) => [canonicalJsonHash(value), value])).values()]
    .sort((left, right) => `${left.obligation_id}:${left.record_id ?? ''}:${canonicalJsonHash(left.findings)}`.localeCompare(`${right.obligation_id}:${right.record_id ?? ''}:${canonicalJsonHash(right.findings)}`))
}

function validateCompletedExtractionRepairs(context, evidenceInput, issuedWorkOrders) {
  for (const slice of evidenceInput.extractionSlices) {
    if (!existsSync(slice.shard_path)) continue
    const shard = strictJson(slice.shard_path, `${slice.slice_id} evidence shard`)
    if (shard.repair_lineage == null) continue
    const lineage = object(shard.repair_lineage, `${slice.slice_id}.repair_lineage`)
    const order = issuedWorkOrders.find((entry) => entry.work_order_id === lineage.work_order_id)
    if (!order || order.kind !== 'source_extraction_repair' || order.outputs?.filter((output) => output.name === 'evidence_shard' && output.path === portablePath(context.root, slice.shard_path)).length !== 1 || order.task?.predecessor_shard_hash !== lineage.predecessor_shard_hash || order.task?.failure_fingerprint !== lineage.failure_fingerprint || order.task?.repair_generation !== lineage.repair_generation) fail(`${slice.slice_id} repaired shard does not bind its exact issued source_extraction_repair WorkOrder`)
  }
}

function sourceExtractionRepairWorkOrders(context, evidenceInput, result, issuedWorkOrders) {
  const failures = normalizedFactsReviewFailures(result.failures ?? [])
  const failedObligationIds = [...new Set(failures.map((failure) => failure.obligation_id))].sort()
  if (!failedObligationIds.length) return { orders: [], exhausted: false }
  const affectedSlices = evidenceInput.extractionSlices.filter((slice) => slice.obligation_ids.some((id) => failedObligationIds.includes(id))).sort((left, right) => left.slice_id.localeCompare(right.slice_id))
  if (!affectedSlices.length) fail('source facts review failures do not map to extraction slices')
  const orders = []
  for (const slice of affectedSlices) {
    const predecessor = strictJson(slice.shard_path, `${slice.slice_id} failed predecessor shard`)
    if (predecessor.repair_lineage != null) return { orders: [], exhausted: true, failed_obligation_ids: failedObligationIds }
    const sliceFailures = failures.filter((failure) => slice.obligation_ids.includes(failure.obligation_id))
    const failureFingerprint = canonicalJsonHash({ slice_id: slice.slice_id, predecessor_shard_hash: predecessor.content_hash, failures: sliceFailures })
    const prior = [...issuedWorkOrders].reverse().find((order) => order.kind === 'source_extraction_repair' && order.task?.slice_id === slice.slice_id && order.task?.predecessor_shard_hash === predecessor.content_hash && order.task?.failure_fingerprint === failureFingerprint)
    if (prior) { orders.push(prior); continue }
    const failedReviewInputs = evidenceInput.reviewPaths.filter(existsSync).map((path) => ({ path, value: strictJson(path, 'failed source facts review') })).filter(({ value }) => value.bundle_hash === result.bundle.content_hash)
    orders.push(workOrder(context, 'source_extraction_repair', {
      reasoning_tier: 'high', reason: 'repair only the source-facts-review findings in the affected extraction slice; preserve all unrelated extracted obligations',
      scope: orderScope('obligations', { sourceIds: slice.source_ids, clusterIds: slice.cluster_ids, obligationIds: slice.obligation_ids.filter((id) => failedObligationIds.includes(id)) }),
      assignee: { role: 'source-evidence-extractor', independent_from_ids: failedReviewInputs.map(({ value }) => value.reviewer?.id).filter(Boolean) },
      inputs: [
        runInput(context, 'coverage_plan', context.coveragePlanPath, { contentHash: evidenceInput.coveragePlan.content_hash, schema: 'coverage_plan.v2' }),
        runInput(context, 'evidence_manifest', context.evidenceManifestPath, { contentHash: evidenceInput.manifest.content_hash, schema: 'evidence_pipeline_build.v2' }),
        runInput(context, 'predecessor_evidence_shard', slice.shard_path, { contentHash: predecessor.content_hash, schema: 'source_evidence_shard.v2' }),
        runInput(context, 'source_review_input', result.reviewInputPath, { contentHash: result.reviewInput.content_hash, schema: 'source_facts_review_input.v2' }),
        ...failedReviewInputs.map(({ path, value }, index) => runInput(context, `failed_source_review_${index}`, path, { contentHash: value.content_hash, schema: 'source_facts_review.v2' })),
      ],
      reused_sources: slice.source_ids.map((sourceId) => reusedSource(context, sourceId, evidenceInput.sourceArtifactPaths[sourceId], evidenceInput.coveragePlan.sources.find((source) => source.source_id === sourceId).source_content_hash)),
      link_inventory: null, outputs: [runOutput(context, 'evidence_shard', slice.shard_path, { schema: 'source_evidence_shard.v2' })],
      task: { slice_id: slice.slice_id, repair_generation: 1, predecessor_shard_hash: predecessor.content_hash, failure_fingerprint: failureFingerprint, failed_obligation_ids: slice.obligation_ids.filter((id) => failedObligationIds.includes(id)).sort(), bundled_findings: sliceFailures, required_repair_lineage: { work_order_id: 'issued_work_order_id', predecessor_shard_hash: predecessor.content_hash, failure_fingerprint: failureFingerprint, repair_generation: 1 } },
      constraints: { frozen_source_bytes_only: true, no_network_refetch: true, preserve_unaffected_obligations_exactly: true, replace_same_declared_shard_path: true, one_repair_generation_only: true },
    }))
  }
  return { orders, exhausted: false, failed_obligation_ids: failedObligationIds }
}

function sourceReviewWorkOrders(context, evidenceInput, result, issuedWorkOrders, reason) {
  const round = Number(result.sample?.sampling_round ?? 0)
  const selected = [...result.reviewInput.selected].sort((a, b) => a.obligation_id.localeCompare(b.obligation_id))
  const declared = evidenceInput.reviewSlices.filter((slice) => slice.sampling_round === round).sort((a, b) => a.shard_id.localeCompare(b.shard_id))
  if (!declared.length) fail(`evidence manifest has no source facts review slices for round ${round}`)
  const shardCount = Math.min(4, declared.length, Math.max(1, selected.length))
  const highSelections = selected.filter((selection) => round === 1 || selection.mode === 'full' || selection.obligation_result?.full_review_required === true || selection.obligation_result?.effective_risk === 'high')
  const lowSelections = selected.filter((selection) => !highSelections.includes(selection))
  const partition = (values, slices, tier) => slices.map((slice, index) => ({ ...slice, reasoning_tier: tier, selections: values.filter((_, selectedIndex) => selectedIndex % slices.length === index) })).filter((assignment) => assignment.selections.length)
  let assignments
  if (highSelections.length && lowSelections.length && shardCount >= 2) {
    const highShardCount = Math.max(1, Math.min(shardCount - 1, Math.round(shardCount * highSelections.length / selected.length)))
    const highSlices = declared.slice(0, highShardCount), lowSlices = declared.slice(highShardCount, shardCount)
    assignments = [...partition(highSelections, highSlices, 'high'), ...partition(lowSelections, lowSlices, 'standard')]
  } else assignments = partition(selected, declared.slice(0, shardCount), highSelections.length ? 'high' : 'standard')
  const assignedIds = assignments.flatMap((assignment) => assignment.selections.map((selection) => selection.obligation_id))
  if (!sameSet(assignedIds, selected.map((selection) => selection.obligation_id))) fail(`source facts review round ${round} shard assignments are not a disjoint complete partition`)
  return assignments.filter((assignment) => {
    if (!existsSync(assignment.path)) return true
    const review = strictJson(assignment.path, `${assignment.shard_id} existing source facts review`)
    const expectedIds = assignment.selections.map((selection) => selection.obligation_id)
    const actualIds = Array.isArray(review.obligation_results) ? review.obligation_results.map((entry) => entry.obligation_id) : []
    return review.bundle_hash !== result.bundle.content_hash || review.sample_manifest_hash !== result.sample.content_hash || !sameSet(actualIds, expectedIds)
  }).map((assignment) => {
    const prior = [...issuedWorkOrders].reverse().find((order) => order.kind === 'source_facts_review' && order.outputs?.some((output) => output.path === portablePath(context.root, assignment.path)) && order.inputs?.some((input) => input.name === 'source_review_input' && input.content_hash === result.reviewInput.content_hash))
    if (prior) return prior
    return workOrder(context, 'source_facts_review', {
    reasoning_tier: assignment.reasoning_tier,
    reason,
    scope: orderScope('obligations', { sourceIds: [...new Set(assignment.selections.map((selection) => selection.obligation_result.source_id))], clusterIds: [...new Set(assignment.selections.map((selection) => selection.obligation_result.cluster_id))], obligationIds: assignment.selections.map((selection) => selection.obligation_id) }),
    assignee: { role: 'source-facts-reviewer', independent_from_ids: result.bundle.extractors },
    inputs: [runInput(context, 'coverage_plan', context.coveragePlanPath, { contentHash: evidenceInput.coveragePlan.content_hash, schema: 'coverage_plan.v2' }), runInput(context, 'source_review_input', result.reviewInputPath, { contentHash: result.reviewInput.content_hash, schema: 'source_facts_review_input.v2' })],
    reused_sources: [...new Set(assignment.selections.map((selection) => selection.obligation_result.source_id))].sort().map((sourceId) => reusedSource(context, sourceId, evidenceInput.sourceArtifactPaths[sourceId], evidenceInput.coveragePlan.sources.find((source) => source.source_id === sourceId).source_content_hash)),
    link_inventory: null, outputs: [runOutput(context, 'source_facts_review', assignment.path, { schema: 'source_facts_review.v2' })],
    task: { sampling_round: round, shard_id: assignment.shard_id, reviewer_slot: assignment.shard_id, selected: assignment.selections }, constraints: { independent_review: true, distinct_reviewer_id_per_concurrent_shard: true, original_sources_required: true },
    })
  })
}

function writerOrder(context, article, factsPackage, reason, options = {}) {
  const desiredRevision = options.desiredRevision ?? 0
  const requestedAssetOutputs = options.missingAssets ?? (article.stage === 'stage3' && factsPackage.graphic_decision.mode === 'generate' ? [{
    receiptPath: resolve(context.stateDir, 'assets', article.article_id, '0.article-asset.v2.json'),
    assetPath: resolve(context.stateDir, 'assets', article.article_id, '0.generated.png'),
    descriptor: { target: null, alt: null, caption: null },
  }] : [])
  const assetOutputs = requestedAssetOutputs.map((entry, index) => ({
    ...entry,
    assetPath: entry.assetPath ?? resolve(context.stateDir, 'assets', article.article_id, `${index}.generated.png`),
    receiptPath: entry.receiptPath ?? resolve(context.stateDir, 'assets', article.article_id, `${index}.article-asset.v2.json`),
    descriptor: entry.descriptor ?? { target: null, alt: null, caption: null },
  }))
  const packagePath = context.packagePaths[article.stage][article.article_id]
  const styleInputs = article.stage === 'stage3' ? stage3StyleBindings() : null
  const canonicalStyleInputs = styleInputs ? [
    repoInput('style_registry', styleInputs.registry.path, { schema: 'stage3_style_snapshots.v1' }),
    repoInput('style_annotation', styleInputs.annotation.path),
  ] : []
  const order = workOrder(context, options.repair ? 'writer_repair' : desiredRevision ? 'writer_revision' : 'writer', {
    reason, scope: orderScope('articles', { sourceIds: factsPackage.visible_sources.map((source) => source.source_id), clusterIds: factsPackage.required_cluster_ids, obligationIds: factsPackage.obligation_ids, articleIds: [article.article_id] }),
    assignee: { role: article.stage === 'stage2' ? 'clinical-study-interpreter' : 'german-health-science-writer', independent_from_ids: factsPackage.facts_reviewer_ids },
    inputs: [runInput(context, 'facts_package', packagePath, { contentHash: factsPackage.package_content_hash, schema: factsPackage.schema }), repoInput('framework', factsPackage.framework.path), ...canonicalStyleInputs],
    reused_sources: [], link_inventory: null,
    outputs: [runOutput(context, 'markdown', article.markdown_path, { mediaType: 'text/markdown' }), runOutput(context, 'article_result', writerReceiptPath(context, article), { schema: 'article_result.v2' }), ...assetOutputs.flatMap((entry, index) => [runOutput(context, `asset_${index}`, entry.assetPath, { mediaType: 'image/png' }), runOutput(context, `asset_receipt_${index}`, entry.receiptPath, { schema: 'article_asset.v2' })])],
    task: {
      article_id: article.article_id, stage: article.stage, slug: article.slug, revision: desiredRevision,
      facts_package_hash: factsPackage.article_package_hash, evidence_membership_hash: factsPackage.evidence_membership_hash, article_lineage_hash: factsPackage.article_lineage_hash,
      framework_hash: factsPackage.framework_hash, policy_version: context.policyVersion, validator_version: context.validatorVersion, renderer_version: context.rendererVersion,
      render_profile: article.render_profile,
      asset_contracts: assetOutputs.map((entry, index) => ({
        asset_index: index, asset_path: portablePath(context.root, entry.assetPath), expected_public_url: entry.descriptor.target,
        public_url_rule: `/api/r2/knowledge/${article.slug}/<sha256-lowercase-hex>.(png|jpg)`,
        article_asset_fields: ['schema', 'asset_id', 'article_id', 'asset_index', 'asset_path', 'asset_byte_hash', 'mime_type', 'width', 'height', 'alt', 'caption', 'position', 'record_ids', 'creator', 'work_order_id', 'created_at', 'content_hash'],
        alt: entry.descriptor.alt ?? { requirement: 'non-empty fact-specific alternative text' },
        caption: entry.descriptor.caption ?? { requirement: 'non-empty visible italic caption' },
        record_ids: factsPackage.graphic_decision?.record_ids ?? [],
      })),
      common_assumption_ids: factsPackage.common_assumption_review?.checks?.map((check) => check.assumption_id) ?? [],
      common_assumption_conclusions: article.stage === 'stage3' ? ['supported', 'partly_supported', 'not_supported', 'contradicted', 'context_dependent', 'unclear'] : [],
      previous: options.previous ?? null, bundled_findings: options.findings ?? [], recheck_scope: options.recheckScope ?? null, repair: options.repair ?? null,
    },
    constraints: { source: 'facts_package_only', visible_sources: 'generated', no_graphic_briefing: true, magazine_template_exact: article.stage === 'stage3', stage2_title_equals_german_original_title_label: article.stage === 'stage2', stage2_restates_conditions_methods_content_results_and_limits_in_german: article.stage === 'stage2', stage2_meta_only_summary_is_forbidden: article.stage === 'stage2', answer_every_bound_common_assumption: article.stage === 'stage3', no_prevalence_wording_without_reviewed_prevalence_record: true, max_revision: MAX_REVISION },
  })
  if (order.work_order_id !== writerWorkOrderIdV2(order)) fail(`${article.article_id} writer WorkOrder hash is inconsistent`)
  return order
}

function initialWriterReuseBindingHash(order) {
  return canonicalJsonHash({
    kind: order.kind, execution_class: order.execution_class, reasoning_tier: order.reasoning_tier, substance: order.substance,
    scope: order.scope, assignee: order.assignee, inputs: order.inputs, reused_sources: order.reused_sources,
    link_inventory: order.link_inventory, outputs: order.outputs, task: order.task, constraints: order.constraints,
  })
}

export function selectReusableInitialWriterOrderV2(issuedWorkOrders, proposed) {
  const proposedBindingHash = initialWriterReuseBindingHash(proposed)
  return [...issuedWorkOrders].reverse().find((order) => order.kind === proposed.kind && initialWriterReuseBindingHash(order) === proposedBindingHash) ?? proposed
}

export function findDuplicateReleaseSeoGroupsV2(compiledResults) {
  const groups = []
  for (const field of ['meta_title', 'meta_description']) {
    const seen = new Map()
    for (const result of compiledResults) {
      const value = String(result?.compiled?.seo?.[field] ?? '').replace(/\s+/g, ' ').trim().toLocaleLowerCase('de-DE')
      if (!seen.has(value)) seen.set(value, [])
      seen.get(value).push(result.article.article_id)
    }
    for (const [value, articleIds] of seen) if (value && articleIds.length > 1) groups.push({ field, value_hash: canonicalJsonHash(value), article_ids: articleIds.sort() })
  }
  return groups.sort((left, right) => left.field.localeCompare(right.field) || left.value_hash.localeCompare(right.value_hash))
}

export function groupDuplicateReleaseSeoRepairsV2(groups) {
  const byArticle = new Map()
  for (const group of groups) for (const articleId of group.article_ids) {
    if (!byArticle.has(articleId)) byArticle.set(articleId, [])
    byArticle.get(articleId).push({ field: group.field, value_hash: group.value_hash, article_ids: [...group.article_ids].sort() })
  }
  return [...byArticle.entries()].map(([article_id, articleGroups]) => ({
    article_id,
    groups: articleGroups.sort((left, right) => left.field.localeCompare(right.field) || left.value_hash.localeCompare(right.value_hash)),
  })).sort((left, right) => left.article_id.localeCompare(right.article_id))
}

function initialWriterOrder(context, issuedWorkOrders, article, factsPackage, reason) {
  const proposed = writerOrder(context, article, factsPackage, reason)
  return selectReusableInitialWriterOrderV2(issuedWorkOrders, proposed)
}

export function repairFailureBundle(context, article, revision, failureKind, details) {
  const normalize = (value) => {
    if (typeof value === 'string') return value.replaceAll(context.root, '<run>').replace(/\s+/g, ' ').trim()
    if (Array.isArray(value)) return value.map(normalize)
    if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).sort(([left], [right]) => left.localeCompare(right)).map(([key, child]) => [key, normalize(child)]))
    return value
  }
  const rawFindings = Array.isArray(details) ? details : details && typeof details === 'object' ? [details] : String(details).split(/;\s+/).filter(Boolean)
  const bundledFindings = rawFindings.map(normalize).sort((left, right) => canonicalJsonHash(left).localeCompare(canonicalJsonHash(right)))
  const failureFingerprints = bundledFindings.map((finding) => canonicalJsonHash({ article_id: article.article_id, revision, failure_kind: failureKind, finding })).sort()
  return { bundledFindings, failureFingerprints, failureFingerprint: canonicalJsonHash({ article_id: article.article_id, revision, failure_kind: failureKind, failure_fingerprints: failureFingerprints }) }
}

export function isStaleWriterBindingError(error) {
  const message = error instanceof Error ? error.message : String(error)
  return / writer receipt (?:does not bind current article bytes|stable article package hash differs|evidence membership hash differs|policy\/render profile differs|Markdown target differs|framework binding differs|record\/source set differs from facts package|work_order_id differs from the exact issued contract)$/u.test(message)
}

function boundedWriterRepair(context, issuedWorkOrders, article, factsPackage, currentReceipt, { failureKind, details, reason, missingAssets = [] }) {
  const revision = Number.isInteger(currentReceipt?.revision) ? currentReceipt.revision : 0
  const revisionOrders = revision > 0
    ? issuedWorkOrders.filter((order) => order.kind === 'writer_revision' && order.task?.article_id === article.article_id && order.task?.revision === revision && order.task?.previous)
    : []
  const receiptHasAncestry = typeof currentReceipt?.previous_review_id === 'string' && typeof currentReceipt?.previous_compiled_payload_hash === 'string'
  const matchingRevisionOrders = receiptHasAncestry
    ? revisionOrders.filter((order) => order.task.previous.review_id === currentReceipt.previous_review_id && order.task.previous.compiled_payload_hash === currentReceipt.previous_compiled_payload_hash)
    : revisionOrders
  const distinctPrevious = new Map(matchingRevisionOrders.map((order) => [canonicalJsonHash(order.task.previous), order.task.previous]))
  const previous = revision > 0 && distinctPrevious.size === 1 ? [...distinctPrevious.values()][0] : null
  if (revision > 0 && !previous) fail(`${article.article_id} revision ${revision} compiler repair has no issued writer-revision ancestry`)
  const bundle = repairFailureBundle(context, article, revision, failureKind, details)
  const fingerprint = bundle.failureFingerprint
  const previousHash = canonicalJsonHash(previous)
  const prior = issuedWorkOrders.filter((order) => order.kind === 'writer_repair'
    && order.task?.article_id === article.article_id
    && order.task?.revision === revision
    && order.task?.repair?.failure_fingerprint
    && canonicalJsonHash(order.task?.previous ?? null) === canonicalJsonHash(previous))
  const same = [...prior].reverse().find((order) => order.task.repair.failure_fingerprint === fingerprint)
  if (same && currentReceipt?.work_order_id !== same.work_order_id) return { order: same, resumed: true }
  const distinct = new Set(prior.map((order) => order.task.repair.failure_fingerprint))
  if (same || distinct.size >= 2) {
    const blockedReason = same
      ? `compiler/asset repair ${fingerprint} still fails after its single permitted attempt`
      : `compiler/asset repair produced a third distinct failure fingerprint after ${[...distinct].join(', ')}`
    const resolutionPath = resolve(context.stateDir, 'escalations', `${article.article_id}.r${revision}.${previousHash.slice('sha256:'.length, 'sha256:'.length + 16)}.${fingerprint.slice('sha256:'.length, 'sha256:'.length + 16)}.writer-repair-escalation-resolution.v1.json`)
    const escalation = workOrder(context, 'writer_repair_escalation', {
      execution_class: 'human', reason: blockedReason, scope: orderScope('articles', { articleIds: [article.article_id] }),
      assignee: { role: 'content-pipeline-escalation-owner', independent_from_ids: [] }, inputs: [], reused_sources: [], link_inventory: null,
      outputs: [runOutput(context, 'escalation_resolution', resolutionPath, { schema: 'writer_repair_escalation_resolution.v1' })],
      task: { article_id: article.article_id, stage: article.stage, revision, previous_hash: previousHash, failure_kind: failureKind, failure_fingerprint: fingerprint, failure_fingerprints: bundle.failureFingerprints, bundled_findings: bundle.bundledFindings, prior_failure_fingerprints: [...distinct].sort() },
      constraints: { no_automatic_success: true, explicit_resolution_required: true, allowed_decision: 'APPROVE_ONE_SCOPED_REPAIR', no_second_owner_repair: true },
    })
    if (prior.some((order) => order.task?.repair?.escalation_resolution_hash)) return { blocked: escalation }
    if (!existsSync(resolutionPath)) return { blocked: escalation }
    const resolution = strictJson(resolutionPath, `${article.article_id} writer repair escalation resolution`)
    if (resolution.schema !== 'writer_repair_escalation_resolution.v1' || resolution.content_hash !== artifactHashV2(resolution) || resolution.decision !== 'APPROVE_ONE_SCOPED_REPAIR' || resolution.run_id !== context.runId || resolution.work_order_id !== escalation.work_order_id || resolution.article_id !== article.article_id || resolution.revision !== revision || resolution.failure_kind !== failureKind || resolution.failure_fingerprint !== fingerprint || resolution.owner?.role !== 'content-pipeline-escalation-owner' || !Number.isFinite(Date.parse(resolution.resolved_at)) || typeof resolution.authorization_basis !== 'string' || !resolution.authorization_basis.trim()) fail(`${article.article_id} writer repair escalation resolution is malformed or stale`)
    assertSafeId(resolution.owner.id, `${article.article_id} escalation resolution owner.id`)
    return { order: writerOrder(context, article, factsPackage, `owner-authorized scoped compiler repair: ${bundle.bundledFindings.join('; ')}`, { desiredRevision: revision, previous, missingAssets, findings: bundle.bundledFindings, repair: { failure_kind: failureKind, failure_fingerprint: fingerprint, failure_fingerprints: bundle.failureFingerprints, bundled_findings_hash: canonicalJsonHash(bundle.bundledFindings), attempt: 1, max_distinct_fingerprints_per_revision: 2, escalation_resolution_hash: resolution.content_hash, escalation_work_order_id: escalation.work_order_id } }) }
  }
  return { order: writerOrder(context, article, factsPackage, reason, { desiredRevision: revision, previous, missingAssets, findings: bundle.bundledFindings, repair: { failure_kind: failureKind, failure_fingerprint: fingerprint, failure_fingerprints: bundle.failureFingerprints, bundled_findings_hash: canonicalJsonHash(bundle.bundledFindings), attempt: 1, max_distinct_fingerprints_per_revision: 2 } }) }
}

export function selectReusablePublicationQaOrderV2(issuedWorkOrders, binding) {
  return [...issuedWorkOrders].reverse().find((order) => order.kind === 'publication_qa'
    && order.task?.article_id === binding.articleId
    && order.task?.revision === binding.revision
    && order.task?.qa_payload_hash === binding.qaPayloadHash
    && order.task?.render_snapshot_hash === binding.renderSnapshotHash
    && order.task?.projection_hash === binding.projectionHash
    && order.task?.writer_execution_id === binding.writerExecutionId
    && order.inputs?.some((input) => input.name === 'compiled_article' && input.content_hash === binding.compiledPayloadHash)
    && order.inputs?.some((input) => input.name === 'facts_package' && input.content_hash === binding.factsPackageHash)
    && order.inputs?.some((input) => input.name === 'validation_receipt' && input.content_hash === binding.validationReceiptHash)
    && order.inputs?.some((input) => input.name === 'writer_result' && input.content_hash === binding.writerReceiptHash)) ?? null
}

function publicationQaOrder(context, articleResult, issuedWorkOrders, reason) {
  const { article, writer, compiled, validationReceiptHash } = articleResult
  const prior = selectReusablePublicationQaOrderV2(issuedWorkOrders, {
    articleId: article.article_id,
    revision: writer.revision,
    qaPayloadHash: compiled.qa_payload.content_hash,
    renderSnapshotHash: compiled.render_snapshot.content_hash,
    projectionHash: compiled.projection_hash,
    writerExecutionId: writer.executionId,
    compiledPayloadHash: compiled.compiled_payload_hash,
    factsPackageHash: articleResult.factsPackage.package_content_hash,
    validationReceiptHash,
    writerReceiptHash: writer.receiptHash,
  })
  if (prior) return prior
  const styleInputs = article.stage === 'stage3' ? stage3StyleBindings() : null
  const assetInputs = compiled.assets.flatMap((asset, index) => [
    runInput(context, `asset_${index}`, resolve(context.root, asset.path)),
    runInput(context, `asset_receipt_${index}`, resolve(context.root, asset.receipt_path), { contentHash: asset.receipt_hash, schema: 'article_asset.v2' }),
  ])
  let previousReview = null
  let previousInputs = []
  if (writer.revision > 0) {
    const previousReviewPath = publicationReviewPath(context, article, writer.revision - 1)
    previousReview = strictJson(previousReviewPath, `${article.article_id} previous publication review`)
    previousInputs = [
      runInput(context, 'previous_publication_review', previousReviewPath, { contentHash: previousReview.content_hash, schema: 'article_publication_review.v2' }),
      runInput(context, 'previous_compiled_article', compiledArticlePath(context, article, writer.revision - 1), { contentHash: writer.receipt.previous_compiled_payload_hash, schema: 'compiled_article.v2' }),
    ]
  }
  return workOrder(context, 'publication_qa', {
    reason, scope: orderScope('articles', { sourceIds: articleResult.factsPackage.visible_sources.map((source) => source.source_id), clusterIds: articleResult.factsPackage.required_cluster_ids, obligationIds: articleResult.factsPackage.obligation_ids, articleIds: [article.article_id] }),
    assignee: { role: 'article-reader-acceptance-reviewer', independent_from_ids: [...new Set([writer.writerId, ...(articleResult.independentFromIds ?? articleResult.factsPackage.facts_reviewer_ids)])].sort() },
    inputs: [
      runInput(context, 'facts_package', context.packagePaths[article.stage][article.article_id], { contentHash: articleResult.factsPackage.package_content_hash, schema: articleResult.factsPackage.schema }),
      repoInput('framework', articleResult.factsPackage.framework.path),
      ...(styleInputs ? [repoInput('style_registry', styleInputs.registry.path, { schema: 'stage3_style_snapshots.v1' }), repoInput('style_annotation', styleInputs.annotation.path)] : []),
      runInput(context, 'writer_result', articleResult.writer.path, { contentHash: writer.receiptHash, schema: 'article_result.v2' }),
      runInput(context, 'compiled_article', articleResult.compiledPath, { contentHash: compiled.compiled_payload_hash, schema: 'compiled_article.v2' }),
      ...(compiled.render_snapshot_path ? [runInput(context, 'render_snapshot', resolve(context.root, compiled.render_snapshot_path), { contentHash: compiled.render_snapshot.content_hash, schema: 'article_render_snapshot.v2' })] : []),
      ...(compiled.renderer_style_validation_path ? [runInput(context, 'renderer_style_validation', resolve(context.root, compiled.renderer_style_validation_path), { contentHash: compiled.renderer_style_validation.content_hash, schema: 'renderer_style_validation.v2' })] : []),
      runInput(context, 'validation_receipt', articleResult.validationReceiptPath, { contentHash: validationReceiptHash, schema: 'validation_receipt.v2' }),
      ...previousInputs,
      ...assetInputs,
    ],
    reused_sources: [], link_inventory: null,
    outputs: [runOutput(context, 'publication_review', publicationReviewPath(context, article, writer.revision), { schema: 'article_publication_review.v2' })],
    task: {
      article_id: article.article_id, stage: article.stage, slug: article.slug, revision: writer.revision, review_type: writer.revision === 0 ? 'full' : 'targeted_recheck', qa_payload_hash: compiled.qa_payload.content_hash, render_snapshot_hash: compiled.render_snapshot.content_hash, projection_hash: compiled.projection_hash, renderer_style_validation_hash: compiled.renderer_style_validation?.content_hash ?? null, writer_execution_id: writer.executionId,
      asset_hashes: compiled.asset_hashes, asset_bindings: compiled.assets.map((asset) => ({ asset_id: asset.asset_id, asset_byte_hash: asset.byte_hash, receipt_hash: asset.receipt_hash, receipt_byte_hash: asset.receipt_byte_hash, writer_execution_id: asset.writer_execution_id, work_order_id: asset.work_order_id })),
      recheck_scope: writer.revision > 0 ? compiled.recheck_scope : null,
      previous_review_hash: previousReview?.content_hash ?? null,
      previous_findings_hash: previousReview ? canonicalJsonHash(previousReview.findings) : null,
      allowed_finding_keys: previousReview ? previousReview.findings.map((finding) => `${finding.pass}:${finding.code}:${finding.location}`).sort() : [],
      required_scoped_passes: ['A', 'B'],
    },
    constraints: { exact_hash_lineage: true, visible_reader_review: true, stage2_requires_substantive_german_study_restatement: article.stage === 'stage2', stage2_meta_only_summary_is_blocking: article.stage === 'stage2', stage3_internal_source_labels_equal_german_original_titles: article.stage === 'stage3', scoped_pass_a_and_b_always: true, no_new_targeted_findings: true, no_duplicate_orchestrator_review: true },
  })
}

function validateRevisionAncestry(context, compiledResult) {
  if (compiledResult.writer.revision === 0) return
  const previousRevision = compiledResult.writer.revision - 1
  const previousPath = publicationReviewPath(context, compiledResult.article, previousRevision)
  if (!existsSync(previousPath)) fail(`${compiledResult.article.article_id} revised writer receipt has no failed review for revision ${previousRevision}`)
  const review = strictJson(previousPath, `${compiledResult.article.article_id} previous publication review`)
  if (review.schema !== 'article_publication_review.v2' || review.content_hash !== artifactHashV2(review) || review.result !== 'FAIL') fail(`${compiledResult.article.article_id} revision must descend from a valid failed review`)
  if (review.review_id !== compiledResult.writer.receipt.previous_review_id || review.compiled_payload_hash !== compiledResult.writer.receipt.previous_compiled_payload_hash) fail(`${compiledResult.article.article_id} revision ancestry differs from failed review`)
}

function loadCoverage(context, { allowFrameworkCatalogMismatch = false } = {}) {
  if (!existsSync(context.coveragePlanPath)) return null
  const researchBytes = readFileSync(context.researchPath)
  const decodedResearch = decodeUtf8Strict(researchBytes, 'opaque research input')
  if (decodedResearch.errors.length) fail(decodedResearch.errors.join('; '))
  const researchHash = sha256Bytes(researchBytes)
  return validateCoveragePlanV2(strictJson(context.coveragePlanPath, 'coverage plan'), { researchHash, substance: context.substance.slug, language: context.substance.language, runId: context.runId, allowFrameworkCatalogMismatch })
}

function articleCorrectionOrder(context, input, issuedWorkOrders, reason) {
  const prior = [...issuedWorkOrders].reverse().find((order) => order.kind === 'article_correction' && order.inputs?.some((entry) => entry.name === 'correction_input_receipt' && entry.content_hash === input.value.content_hash))
  if (prior) return prior
  return workOrder(context, 'article_correction', {
    reason, scope: orderScope('articles', { articleIds: input.value.affected_article_ids }),
    assignee: { role: 'article-correction-editor', independent_from_ids: [] },
    inputs: [
      runInput(context, 'correction_input_receipt', context.correction.inputReceiptPath, { contentHash: input.value.content_hash, schema: 'article_correction_input_receipt.v1' }),
      runInput(context, 'before_markdown', input.beforePath), runInput(context, 'candidate_markdown', input.candidatePath),
    ], reused_sources: [], link_inventory: null,
    outputs: [runOutput(context, 'correction_result', context.correction.resultPath, { schema: 'article_correction_result.v1' })],
    task: { article_id: input.candidateArticle.article_id, change_class: 'M', patch: input.value.patch, candidate_release_article_hash: input.value.candidate.release_article_hash, objective: 'Confirm/apply only the frozen local wording correction and return a hash-bound result; do not expand scope.' },
    constraints: { no_numbers_units_safety_claims_sources_headings_metadata_relations_extracts_or_runtime_changes: true, exact_frozen_candidate_bytes: true, one_editor_pass: true },
  })
}

function articleCorrectionReviewOrder(context, input, correctionResult, issuedWorkOrders, reason) {
  const prior = [...issuedWorkOrders].reverse().find((order) => order.kind === 'article_correction_review' && order.inputs?.some((entry) => entry.name === 'correction_result' && entry.content_hash === correctionResult.value.content_hash))
  if (prior) return prior
  return workOrder(context, 'article_correction_review', {
    reason, scope: orderScope('articles', { articleIds: input.value.affected_article_ids }),
    assignee: { role: 'article-correction-reviewer', independent_from_ids: [correctionResult.editorId] },
    inputs: [
      runInput(context, 'correction_input_receipt', context.correction.inputReceiptPath, { contentHash: input.value.content_hash, schema: 'article_correction_input_receipt.v1' }),
      runInput(context, 'correction_result', context.correction.resultPath, { contentHash: correctionResult.value.content_hash, schema: 'article_correction_result.v1' }),
      runInput(context, 'before_markdown', input.beforePath), runInput(context, 'candidate_markdown', input.candidatePath),
    ], reused_sources: [], link_inventory: null,
    outputs: [runOutput(context, 'correction_review', context.correction.reviewPath, { schema: 'article_correction_review.v1' })],
    task: { article_id: input.candidateArticle.article_id, change_class: 'M', patch_hash: input.value.patch.patch_hash, changed_lines: input.value.patch.changes, neighbourhood: input.value.patch.neighbourhood, release_changed_lines: input.value.patch.release_changes, release_neighbourhood: input.value.patch.release_neighbourhood, required_checks: ['changed_lines_and_neighbourhood', 'readability', 'no_system_language', 'unchanged_scientific_meaning'] },
    constraints: { independent_from_editor: true, changed_lines_and_neighbourhood_only: true, pass_or_fail_no_rewrite: true, fail_promotes_or_returns_to_owner: true },
  })
}

function finishCorrectionRelease({ context, issuedWorkOrders, started, stats, release, correctionExtra }) {
  writeJsonAtomic(context.releasePath, release)
  if (!context.publish.required) return finish(context, started, 'COMPLETE', [], stats, { completion_scope: 'validated_correction_release_only', published: false, release: { ...binding(context, context.releasePath), release_hash: release.release_hash }, ...correctionExtra })
  let publish
  try { publish = validatePublishReceiptV2({ context, release, receiptPath: context.publishReceiptPath }) }
  catch (error) {
    return finish(context, started, 'BLOCKED', [escalationWorkOrder(context, 'publish_receipt_integrity_escalation', { reason: `correction publish receipt is malformed/stale: ${error.message}`, inputs: existsSync(context.publishReceiptPath) ? [runInput(context, 'publish_receipt', context.publishReceiptPath, { schema: 'content_publish_receipt.v2' })] : [] })], stats, { published: false, ...correctionExtra })
  }
  if (publish.status === 'missing') return finish(context, started, 'READY_TO_PUBLISH', [publicationApplyOrder(context, release, 'validated correction release requires guarded atomic apply and exact public readback')], stats, {
    published: false, release: { ...binding(context, context.releasePath), release_hash: release.release_hash }, required_publish_receipt: { path: portablePath(context.root, context.publishReceiptPath), schema: 'content_publish_receipt.v2' }, machine_dispatcher: 'scripts/dispatch-nutrient-content-machines.mjs', ...correctionExtra,
  })
  const releaseBinding = { ...binding(context, context.releasePath), release_hash: release.release_hash }
  const receiptBinding = { ...binding(context, context.publishReceiptPath), receipt_hash: publish.receiptHash }
  if (publish.badgeReadback.result === 'MISMATCH') return finish(context, started, 'BLOCKED', [badgeReadbackEscalationOrder(context, release, publish)], stats, { completion_scope: 'correction_published_badge_readback_blocked', article_branch_status: 'COMPLETE', published: true, seo_live_claim: false, delivery_gaps: publish.deliveryGaps, badge_readback: { schema: publish.badgeReadback.schema, result: publish.badgeReadback.result, affected_ingredient_ids: publish.badgeReadback.affected_ingredient_ids, mismatches: publish.badgeMismatches, article_publication_rollback_required: false }, release: releaseBinding, publish_receipt: receiptBinding, ...correctionExtra })
  if (publish.deliveryGaps.length) {
    let indexabilityRelease
    try { indexabilityRelease = indexabilityReleaseResult(context, release, publish) }
    catch (error) {
      return finish(context, started, 'BLOCKED', [escalationWorkOrder(context, 'indexability_release_receipt_integrity_escalation', { reason: `correction indexability release receipt is malformed/stale: ${error.message}`, inputs: existsSync(context.indexabilityReleaseReceiptPath) ? [runInput(context, 'indexability_release_receipt', context.indexabilityReleaseReceiptPath, { schema: 'indexability_release_receipt.v1' })] : [] })], stats, { completion_scope: 'correction_published_indexability_receipt_blocked', article_branch_status: 'COMPLETE', published: true, seo_live_claim: false, delivery_gaps: publish.deliveryGaps, release: releaseBinding, publish_receipt: receiptBinding, ...correctionExtra })
    }
    if (indexabilityRelease.status === 'missing') return finish(context, started, 'WAITING_FOR_INDEXABILITY_RELEASE', [indexabilityReleaseHandoffOrder(context, release, publish)], stats, { completion_scope: 'correction_published_waiting_for_indexability_release', article_branch_status: 'COMPLETE', published: true, seo_live_claim: false, delivery_gaps: publish.deliveryGaps, indexability: { state: 'WAITING_FOR_INDEXABILITY_RELEASE', blockers: publish.indexabilityBlockers }, release: releaseBinding, publish_receipt: receiptBinding, ...correctionExtra })
    return finish(context, started, 'COMPLETE', [], stats, { completion_scope: 'correction_published_and_indexability_read_back', article_branch_status: 'COMPLETE', published: true, seo_live_claim: true, delivery_gaps: [], indexability: { state: 'RELEASED', receipt_hash: indexabilityRelease.receiptHash }, release: releaseBinding, publish_receipt: receiptBinding, indexability_release_receipt: { ...binding(context, context.indexabilityReleaseReceiptPath), receipt_hash: indexabilityRelease.receiptHash }, ...correctionExtra })
  }
  return finish(context, started, 'COMPLETE', [], stats, { completion_scope: 'correction_published_and_scoped_read_back', article_branch_status: 'COMPLETE', published: true, seo_live_claim: publish.seoLiveClaim, delivery_gaps: publish.deliveryGaps, release: releaseBinding, publish_receipt: receiptBinding, ...correctionExtra })
}

function runArticleCorrection(context, issuedWorkOrders, started, stats) {
  const input = context.correction.input
  const classification = validateCorrectionClassV1(input)
  if (classification.class === 'L') {
    const child = loadNutrientContentRunManifest(context.correction.affectedPipelineManifestPath)
    if (child.operation !== 'full_pipeline') fail('L correction affected_pipeline_manifest must be a full_pipeline run')
    const expectedArticles = [input.candidateArticle].map((article) => ({ article_id: article.article_id, stage: article.stage, slug: article.slug }))
    const childArticles = child.articles.all.map((article) => ({ article_id: article.article_id, stage: article.stage, slug: article.slug }))
    if (canonicalJsonHash(childArticles) !== canonicalJsonHash(expectedArticles)) fail('L correction child pipeline must contain exactly the affected article identity/stage/slug slice')
    if (child.articles.all.some((article) => article.change_class !== 'L')) fail('L correction child pipeline articles must remain class L')
    if (canonicalJsonHash(child.substance) !== canonicalJsonHash(context.substance) || child.policyVersion !== context.policyVersion || child.renderProfile !== context.renderProfile) fail('L correction child pipeline substance/policy/render profile differs from its parent')
    if (child.publish.required !== context.publish.required || child.publish.target !== context.publish.target || child.publish.publicBaseUrl !== context.publish.publicBaseUrl) fail('L correction child pipeline publish scope differs from its parent')
    if (input.authoritativeBefore && (child.articles.all[0].authoritative_before?.content_hash !== input.authoritativeBefore.content_hash
      || canonicalJsonHash(child.articles.all[0].write_guard) !== canonicalJsonHash(input.candidateArticle.write_guard))) fail('L correction child must bind the exact authoritative before and update guard')
    const status = runNutrientContent({ manifestPath: context.correction.affectedPipelineManifestPath })
    return { ...status, parent_correction_run_id: context.runId, correction_route: { class: 'L', affected_article_ids: input.value.affected_article_ids, full_pipeline_slice_only: true } }
  }
  if (classification.class === 'S') {
    const release = buildCorrectionContentReleaseV2({ context, input })
    return finishCorrectionRelease({ context, issuedWorkOrders, started, stats, release, correctionExtra: { correction_route: { class: 'S', llm_work_orders: 0, invariant_checks: classification.invariant_checks } } })
  }
  if (!existsSync(context.correction.resultPath)) {
    removeRelease(context)
    return finish(context, started, 'WAITING_FOR_CORRECTION', [articleCorrectionOrder(context, input, issuedWorkOrders, 'frozen M correction needs one scoped editor result')], stats, { published: false, correction_route: { class: 'M', phase: 'editor' } })
  }
  let correctionResult
  try { correctionResult = validateArticleCorrectionResultV1({ result: strictJson(context.correction.resultPath, 'article correction result'), input, issuedWorkOrders }) }
  catch (error) {
    removeRelease(context)
    return finish(context, started, 'BLOCKED', [escalationWorkOrder(context, 'article_correction_integrity_escalation', { reason: error.message, inputs: [runInput(context, 'correction_result', context.correction.resultPath, { schema: 'article_correction_result.v1' })] })], stats, { published: false })
  }
  if (!existsSync(context.correction.reviewPath)) {
    removeRelease(context)
    return finish(context, started, 'WAITING_FOR_CORRECTION_REVIEW', [articleCorrectionReviewOrder(context, input, correctionResult, issuedWorkOrders, 'M correction needs exactly one independent diff-and-neighbourhood review')], stats, { published: false, correction_route: { class: 'M', phase: 'independent_review' } })
  }
  let correctionReview
  try { correctionReview = validateArticleCorrectionReviewV1({ review: strictJson(context.correction.reviewPath, 'article correction review'), input, result: correctionResult, issuedWorkOrders }) }
  catch (error) {
    removeRelease(context)
    return finish(context, started, 'BLOCKED', [escalationWorkOrder(context, 'article_correction_review_integrity_escalation', { reason: error.message, inputs: [runInput(context, 'correction_review', context.correction.reviewPath, { schema: 'article_correction_review.v1' })] })], stats, { published: false })
  }
  if (correctionReview.value.result !== 'PASS') {
    removeRelease(context)
    return finish(context, started, 'BLOCKED', [escalationWorkOrder(context, 'article_correction_review_escalation', { reason: 'M correction review failed; revise the frozen request or promote it to L', task: { findings: correctionReview.findings, allowed_next_classes: ['M', 'L'] } })], stats, { published: false })
  }
  const release = buildCorrectionContentReleaseV2({ context, input, correctionResult, correctionReview })
  return finishCorrectionRelease({ context, issuedWorkOrders, started, stats, release, correctionExtra: { correction_route: { class: 'M', phases: ['article_correction', 'article_correction_review'], editor_id: correctionResult.editorId, reviewer_id: correctionReview.reviewerId } } })
}

export function runNutrientContent({ manifestPath }) {
  const started = performance.now()
  const context = loadNutrientContentRunManifest(manifestPath)
  const issuedWorkOrders = loadIssuedWorkOrders(context)
  context.issuedWorkOrders = issuedWorkOrders
  context.llmWaveIndex = Math.max(0, ...issuedWorkOrders.filter((order) => order.execution_class === 'llm').map((order) => Number(order.wave_index) || 0)) + 1
  const stats = {
    evidence_cache_hits: 0, evidence_cache_misses: 0, article_validation_cache_hits: 0, article_validation_cache_misses: 0, renderer_style_cache_hits: 0, renderer_style_cache_misses: 0,
    revision_counts: { '0': 0, '1': 0, '2': 0 }, gate_timings_ms: { evidence: 0, stage4: 0, article_validation: 0, publication_qa: 0, publish_validation: 0 }, gate_results: {},
  }
  if (context.operation === 'article_correction') return runArticleCorrection(context, issuedWorkOrders, started, stats)
  if (!existsSync(context.researchPath)) {
    removeRelease(context)
    const orders = [researchWorkOrder(context, 'research input is missing')]
    if (!existsSync(context.linkInventorySourcePath)) orders.push(linkInventorySourceWorkOrder(context, 'authoritative site link inventory source is missing'))
    return finish(context, started, 'WAITING_FOR_RESEARCH', orders, stats)
  }
  validateResearchBytes(context)
  if (!existsSync(context.sourceArtifactReceiptPath)) {
    removeRelease(context)
    const orders = [researchWorkOrder(context, 'research exists but its selected original sources have not been frozen', { freezeOnly: true })]
    if (!existsSync(context.linkInventorySourcePath)) orders.push(linkInventorySourceWorkOrder(context, 'authoritative site link inventory source is missing'))
    return finish(context, started, 'WAITING_FOR_RESEARCH', orders, stats)
  }
  try { loadSourceArtifactReceipt(context) } catch (error) {
    removeRelease(context)
    return finish(context, started, 'BLOCKED', [escalationWorkOrder(context, 'research_source_integrity_escalation', { reason: error.message, inputs: [runInput(context, 'source_artifact_receipt', context.sourceArtifactReceiptPath, { schema: 'research_source_artifact_receipt.v2' })] })], stats, { published: false })
  }
  if (existsSync(context.linkInventorySourcePath)) {
    const refreshReason = linkInventorySourceRefreshReason(context)
    if (refreshReason) {
      removeRelease(context)
      return finish(context, started, 'WAITING_FOR_LINK_INVENTORY', [linkInventorySourceWorkOrder(context, refreshReason)], stats, { published: false })
    }
  }
  if (!existsSync(context.coveragePlanPath)) {
    removeRelease(context)
    if (!existsSync(context.linkInventorySourcePath)) return finish(context, started, 'WAITING_FOR_LINK_INVENTORY', [linkInventorySourceWorkOrder(context, 'authoritative site link inventory source is required before coverage planning')], stats)
    buildLinkInventory(context)
    return finish(context, started, 'WAITING_FOR_RESEARCH', [coveragePlanningWorkOrder(context, 'coverage_plan.v2 is missing')], stats)
  }
  let coverage
  try { coverage = loadCoverage(context, { allowFrameworkCatalogMismatch: true }) }
  catch (error) {
    if (error.code === 'STAGE2_SOURCE_ASSIGNMENT_POLICY') {
      removeRelease(context)
      if (!existsSync(context.linkInventorySourcePath)) return finish(context, started, 'WAITING_FOR_LINK_INVENTORY', [linkInventorySourceWorkOrder(context, 'authoritative site link inventory source is required before Stage-2 source-assignment replanning')], stats, { published: false, coverage_replan_reason: 'stage2_source_assignment_policy' })
      buildLinkInventory(context)
      return finish(context, started, 'WAITING_FOR_RESEARCH', [coveragePlanningWorkOrder(context, `coverage plan predates or violates the active Stage-2 source-assignment policy: ${error.message}`)], stats, { published: false, coverage_replan_reason: 'stage2_source_assignment_policy' })
    }
    throw error
  }
  if (coverage.framework_gaps.length) {
    removeRelease(context)
    const resolutions = coverage.framework_gaps.map((gap) => ({ gap, ...validateFrameworkGapResolution(context, gap) }))
    const transition = selectFrameworkGapTransition(resolutions), entry = transition.entry
    if (transition.action === 'design') return finish(context, started, 'WAITING_FOR_FRAMEWORK', [frameworkDesignWorkOrder(context, coverage, [entry.gap], issuedWorkOrders, `${entry.gap.gap_id}: ${entry.reason}`, entry.technicalPaths ?? [])], stats, { published: false, framework_phase: entry.status === 'needs_pilot' ? 'hash_bound_real_pilots' : 'candidate_design', deferred_gap_ids: transition.deferred_gap_ids })
    if (transition.action === 'technical_handoff') return finish(context, started, 'WAITING_FOR_TECHNICAL_FRAMEWORK_CHANGE', [frameworkRuntimeGapHandoffWorkOrder(context, entry.gap, entry, issuedWorkOrders, entry.reason)], stats, { published: false, framework_phase: 'external_runtime_change_required', deferred_gap_ids: transition.deferred_gap_ids })
    if (transition.action === 'owner_approval') return finish(context, started, 'WAITING_FOR_FRAMEWORK', [frameworkOwnerApprovalWorkOrder(context, entry.gap, entry, issuedWorkOrders, entry.reason)], stats, { published: false, framework_phase: 'human_owner_approval', deferred_gap_ids: transition.deferred_gap_ids })
    if (transition.action === 'activate') return finish(context, started, 'WAITING_FOR_FRAMEWORK', [frameworkActivationWorkOrder(context, entry.gap, entry, issuedWorkOrders, 'validated candidate and all applicable pilot, technical and Owner gates are ready for guarded activation')], stats, { published: false, framework_phase: 'guarded_activation', deferred_gap_ids: transition.deferred_gap_ids })
    if (!existsSync(context.linkInventorySourcePath)) return finish(context, started, 'WAITING_FOR_LINK_INVENTORY', [linkInventorySourceWorkOrder(context, 'authoritative site link inventory source is required before framework-bound coverage replanning')], stats)
    buildLinkInventory(context)
    return finish(context, started, 'WAITING_FOR_RESEARCH', [coveragePlanningWorkOrder(context, `framework ${entry.gap.gap_id} activated; immediately regenerate the complete coverage plan against the new catalog before considering deferred gaps`, { priorCoverage: coverage })], stats, { published: false, framework_phase: 'full_replan_after_single_activation', activated_gap_id: entry.gap.gap_id, deferred_gap_ids: transition.deferred_gap_ids })
  }
  if (coverage.framework_catalog_hash !== sha256Bytes(readFileSync(FRAMEWORK_CATALOG_PATH))) {
    removeRelease(context)
    if (!existsSync(context.linkInventorySourcePath)) return finish(context, started, 'WAITING_FOR_LINK_INVENTORY', [linkInventorySourceWorkOrder(context, 'authoritative site link inventory source is required before catalog-invalidated coverage replanning')], stats)
    buildLinkInventory(context)
    return finish(context, started, 'WAITING_FOR_RESEARCH', [coveragePlanningWorkOrder(context, 'framework catalog bytes changed; regenerate the complete coverage plan', { priorCoverage: coverage })], stats, { published: false })
  }
  const sourceMismatch = coverageReceiptMismatch(coverage, context.sourceArtifactReceipt)
  if (sourceMismatch) {
    removeRelease(context)
    if (!existsSync(context.linkInventorySourcePath)) return finish(context, started, 'WAITING_FOR_LINK_INVENTORY', [linkInventorySourceWorkOrder(context, 'authoritative site link inventory source is required before source-invalidated coverage replanning')], stats)
    buildLinkInventory(context)
    return finish(context, started, 'WAITING_FOR_RESEARCH', [coveragePlanningWorkOrder(context, `${sourceMismatch}; regenerate the complete coverage plan`, { priorCoverage: coverage })], stats, { published: false })
  }
  validatePlanParity(context, coverage)
  if (!context.articles.all.length) {
    removeRelease(context)
    return finish(context, started, 'COMPLETE', [], stats, { completion_scope: 'no_articles_planned', published: false, writers_ready: true })
  }
  if (!existsSync(context.linkInventorySourcePath)) {
    removeRelease(context)
    return finish(context, started, 'WAITING_FOR_LINK_INVENTORY', [linkInventorySourceWorkOrder(context, 'authoritative site link inventory source is missing')], stats)
  }
  buildLinkInventory(context)
  const linkMismatches = coverageLinkMismatches(coverage, context.linkInventory)
  if (linkMismatches.length) {
    removeRelease(context)
    return finish(context, started, 'WAITING_FOR_RESEARCH', [coveragePlanningWorkOrder(context, `selected internal-link targets changed for ${linkMismatches.join(', ')}; regenerate only those article nodes in the complete plan`, { priorCoverage: coverage, affectedArticleIds: linkMismatches })], stats, { published: false, invalidated_article_ids: linkMismatches })
  }
  buildEvidenceManifest(context, coverage)
  const evidenceInput = loadEvidenceManifestV2(context.evidenceManifestPath, { coveragePlanPath: context.coveragePlanPath, researchPath: context.researchPath, sourceArtifactReceiptPath: context.sourceArtifactReceiptPath, sourceArtifactReceiptHash: context.sourceArtifactReceipt.hash, substance: context.substance.slug, language: context.substance.language, runId: context.runId, policyVersion: context.policyVersion, validatorVersion: context.evidenceValidatorVersion })
  if (!evidenceInput.coveragePlan) fail('evidence manifest coverage plan is missing')
  if (evidenceInput.coveragePlan.content_hash !== coverage.content_hash) fail('run and evidence coverage plan bindings differ')
  const evidenceDeclaredPaths = [...evidenceInput.shardPaths, ...evidenceInput.reviewPaths, ...Object.values(evidenceInput.sourceArtifactPaths)]
  if (evidenceDeclaredPaths.some((path) => isContained(context.stateDir, path) || isContained(context.evidenceDir, path))) fail('evidence shard, review and source paths must stay outside generated state/evidence directories')
  const generatedEvidencePaths = [
    resolve(context.evidenceDir, 'coverage-plan.v2.json'), resolve(context.evidenceDir, 'source-evidence-bundle.v2.json'),
    resolve(context.evidenceDir, 'review-sample-manifest.v2.json'), resolve(context.evidenceDir, 'source-facts-review-input.v2.json'), resolve(context.evidenceDir, 'facts-completeness-gate.v2.json'),
    resolve(context.evidenceDir, 'evidence-pipeline-lock.v2.json'),
    resolve(context.evidenceDir, 'stage4-package', 'facts-package-for-stage4.v2.json'),
    ...context.articles.all.map((article) => resolve(context.evidenceDir, `${article.stage}-packages`, `${article.article_id}.json`)),
  ]
  assertNoPathCollisions([
    ...evidenceDeclaredPaths.map((path, index) => ({ path, label: `evidence declared path ${index}`, kind: 'input/output contract' })),
    ...generatedEvidencePaths.map((path, index) => ({ path, label: `generated evidence path ${index}`, kind: 'generated' })),
  ])
  const missingExtraction = evidenceInput.shardPaths.filter((path) => !existsSync(path))
  if (!evidenceInput.shardPaths.length || !Object.keys(evidenceInput.sourceArtifactPaths).length || missingExtraction.length) {
    removeRelease(context)
    const orders = extractionWorkOrders(context, evidenceInput, issuedWorkOrders, 'source-evidence shard and original-source artifacts are incomplete')
    if (!orders.length) fail('source extraction is incomplete but no disjoint extraction WorkOrder could be derived')
    return finish(context, started, 'WAITING_FOR_SOURCE_EXTRACTION', orders, stats)
  }
  const expectedLock = { evidenceManifestPath: context.evidenceManifestPath, coveragePlanPath: context.coveragePlanPath, researchPath: context.researchPath, substance: context.substance.slug, language: context.substance.language, policyVersion: context.policyVersion, validatorVersion: context.evidenceValidatorVersion }
  const cachedLockPath = resolve(context.evidenceDir, 'evidence-pipeline-lock.v2.json')
  const evidenceStarted = performance.now()
  let pipeline = null
  let evidenceResult = null
  if (existsSync(cachedLockPath)) {
    try {
      pipeline = validateEvidencePipelineLockV2({ lockPath: cachedLockPath, root: context.root, expected: expectedLock })
      stats.evidence_cache_hits += 1
    } catch {
      pipeline = null
    }
  }
  if (!pipeline) {
    stats.evidence_cache_misses += 1
    validateCompletedExtractionRepairs(context, evidenceInput, issuedWorkOrders)
    evidenceResult = buildEvidencePipelineV2({ input: evidenceInput, outputDir: context.evidenceDir })
    if (evidenceResult.status === 'coverage_replan_required') {
      removeRelease(context)
      const signalObligationIds = [...new Set(evidenceResult.materialConflictSignals.map((signal) => signal.obligation_id))].sort()
      const affectedArticleIds = [...new Set(coverage.extraction_obligations.filter((obligation) => signalObligationIds.includes(obligation.obligation_id)).flatMap((obligation) => obligation.required_for))].sort()
      const priorCoverage = coverage
      const order = coveragePlanningWorkOrder(context, 'material extractor conflict requires one scoped coverage replan before any review or writing', { priorCoverage, affectedArticleIds, materialConflictSignals: evidenceResult.materialConflictSignals })
      stats.gate_timings_ms.evidence = Math.round((performance.now() - evidenceStarted) * 100) / 100
      stats.gate_results.evidence = 'COVERAGE_REPLAN_REQUIRED'
      return finish(context, started, 'WAITING_FOR_RESEARCH', [order], stats, { published: false, invalidated_article_ids: affectedArticleIds, scoped_replan: { reason: 'material_conflict_signal', obligation_ids: signalObligationIds } })
    }
    if (evidenceResult.status === 'missing_reviews' || evidenceResult.status === 'review_expanded') {
      removeRelease(context)
      const reason = evidenceResult.status === 'review_expanded' ? 'a sampled failure expanded the affected stratum to full review' : 'independent source-facts review is missing'
      const orders = sourceReviewWorkOrders(context, evidenceInput, evidenceResult, issuedWorkOrders, reason)
      if (!orders.length) fail('source review is incomplete but no disjoint source-review WorkOrder could be derived')
      stats.gate_timings_ms.evidence = Math.round((performance.now() - evidenceStarted) * 100) / 100
      stats.gate_results.evidence = evidenceResult.status
      return finish(context, started, 'WAITING_FOR_SOURCE_REVIEW', orders, stats)
    }
    if (evidenceResult.status === 'blocked' && evidenceResult.failures?.length) {
      removeRelease(context)
      const repair = sourceExtractionRepairWorkOrders(context, evidenceInput, evidenceResult, issuedWorkOrders)
      stats.gate_timings_ms.evidence = Math.round((performance.now() - evidenceStarted) * 100) / 100
      if (repair.exhausted) {
        stats.gate_results.evidence = 'REPAIR_EXHAUSTED'
        return finish(context, started, 'BLOCKED', [escalationWorkOrder(context, 'evidence_repair_escalation', { reason: 'the single scoped original-source extraction repair still failed independent source-facts review', task: { failed_obligation_ids: repair.failed_obligation_ids, failures: evidenceResult.failures } })], stats, { published: false })
      }
      if (!repair.orders.length) fail('source-facts review failed but no scoped extraction repair WorkOrder could be derived')
      stats.gate_results.evidence = 'WAITING_FOR_SCOPED_EXTRACTION_REPAIR'
      return finish(context, started, 'WAITING_FOR_SOURCE_EXTRACTION', repair.orders, stats, { published: false, scoped_repair: { failed_obligation_ids: repair.failed_obligation_ids, preserved_unaffected_shards: true } })
    }
    if (evidenceResult.status !== 'pass') {
      removeRelease(context)
      return finish(context, started, 'BLOCKED', [escalationWorkOrder(context, 'evidence_escalation', { reason: evidenceResult.reason ?? 'source-facts review or facts completeness gate failed', task: { failures: evidenceResult.failures ?? [] } })], stats, { published: false })
    }
    pipeline = validateEvidencePipelineLockV2({ lockPath: evidenceResult.lockPath, root: context.root, expected: expectedLock })
  }
  stats.gate_timings_ms.evidence = Math.round((performance.now() - evidenceStarted) * 100) / 100
  stats.gate_results.evidence = 'PASS'
  const expectedPackages = plannedCoverageArticles(coverage).map((entry) => `${entry.stage}:${entry.article_id}`)
  const actualPackages = ['stage2', 'stage3'].flatMap((stage) => Object.keys(pipeline.packages[stage]).map((id) => `${stage}:${id}`))
  if (!sameSet(expectedPackages, actualPackages)) fail('evidence lock package set differs from planned articles')
  context.evidenceLockPath = pipeline.lockPath
  context.packagePaths = { stage2: {}, stage3: {}, stage4: pipeline.packages.stage4 ? resolve(context.evidenceDir, 'stage4-package', 'facts-package-for-stage4.v2.json') : null }
  for (const stage of ['stage2', 'stage3']) for (const articleId of Object.keys(pipeline.packages[stage])) {
    context.packagePaths[stage][articleId] = resolve(context.evidenceDir, `${stage}-packages`, `${articleId}.json`)
  }
  const packages = Object.fromEntries(context.articles.all.map((article) => {
    const packageValue = pipeline.packages[article.stage][article.article_id]
    return [article.article_id, validateFactsPackageForImportV2({ packageValue, stage: article.stage, articleId: article.article_id, pipeline, expected: { substance: context.substance.slug, language: context.substance.language, policyVersion: context.policyVersion, validatorVersion: context.evidenceValidatorVersion } })]
  }))
  const stage4Started = performance.now()
  const stage4BranchResult = stage4Branch(context, pipeline, issuedWorkOrders)
  stats.gate_timings_ms.stage4 = Math.round((performance.now() - stage4Started) * 100) / 100
  stats.gate_results.stage4 = stage4BranchResult.status
  const finishAfterGate = (state, orders, extra = {}) => finish(context, started, state, withStage4Orders(orders, stage4BranchResult), stats, { ...extra, aggregate_status: state === 'COMPLETE' ? terminalAggregateState() : state, ...stage4StatusExtra(stage4BranchResult) })
  const terminalAggregateState = () => stage4BranchResult.status === 'WAITING' ? 'WAITING_FOR_STAGE4' : stage4BranchResult.status === 'PASS' || stage4BranchResult.status === 'NOT_REQUESTED' ? 'COMPLETE' : 'BLOCKED'
  const finishPublishedRelease = (release, publish) => {
    if (publish.badgeReadback.result === 'MISMATCH') return finishAfterGate('BLOCKED', [badgeReadbackEscalationOrder(context, release, publish)], {
      completion_scope: 'published_and_article_matched_badge_readback_blocked', article_branch_status: 'COMPLETE', published: true, seo_live_claim: false,
      delivery_gaps: publish.deliveryGaps, indexability: publish.indexabilityBlockers.length ? { state: 'WAITING_FOR_INDEXABILITY_RELEASE', blockers: publish.indexabilityBlockers } : { state: 'ARTICLE_PAGES_MATCHED' },
      badge_readback: { schema: publish.badgeReadback.schema, result: publish.badgeReadback.result, affected_ingredient_ids: publish.badgeReadback.affected_ingredient_ids, mismatches: publish.badgeMismatches, article_publication_rollback_required: false },
      release: { ...binding(context, context.releasePath), release_hash: release.release_hash }, publish_receipt: { ...binding(context, context.publishReceiptPath), receipt_hash: publish.receiptHash },
    })
    if (publish.deliveryGaps.length) {
      let indexabilityRelease
      try { indexabilityRelease = indexabilityReleaseResult(context, release, publish) }
      catch (error) {
        return finishAfterGate('BLOCKED', [escalationWorkOrder(context, 'indexability_release_receipt_integrity_escalation', {
          reason: `indexability release receipt is malformed, stale, or differs from the fresh public readback: ${error.message}`,
          inputs: existsSync(context.indexabilityReleaseReceiptPath) ? [runInput(context, 'indexability_release_receipt', context.indexabilityReleaseReceiptPath, { schema: 'indexability_release_receipt.v1' })] : [],
        })], { completion_scope: 'published_indexability_receipt_integrity_blocked', article_branch_status: 'COMPLETE', published: true, seo_live_claim: false, delivery_gaps: publish.deliveryGaps, release: { ...binding(context, context.releasePath), release_hash: release.release_hash }, publish_receipt: { ...binding(context, context.publishReceiptPath), receipt_hash: publish.receiptHash } })
      }
      if (indexabilityRelease.status === 'missing') return finishAfterGate('WAITING_FOR_INDEXABILITY_RELEASE', [indexabilityReleaseHandoffOrder(context, release, publish)], {
        completion_scope: 'published_and_content_matched_waiting_for_indexability_release', article_branch_status: 'COMPLETE', published: true, seo_live_claim: false,
        delivery_gaps: publish.deliveryGaps, indexability: { state: 'WAITING_FOR_INDEXABILITY_RELEASE', blockers: publish.indexabilityBlockers },
        release: { ...binding(context, context.releasePath), release_hash: release.release_hash }, publish_receipt: { ...binding(context, context.publishReceiptPath), receipt_hash: publish.receiptHash },
      })
      return finishAfterGate('COMPLETE', [], {
        completion_scope: 'published_and_scoped_read_back', article_branch_status: 'COMPLETE', published: true, seo_live_claim: true, delivery_gaps: [],
        indexability: { state: 'RELEASED', receipt_hash: indexabilityRelease.receiptHash },
        release: { ...binding(context, context.releasePath), release_hash: release.release_hash }, publish_receipt: { ...binding(context, context.publishReceiptPath), receipt_hash: publish.receiptHash },
        indexability_release_receipt: { ...binding(context, context.indexabilityReleaseReceiptPath), receipt_hash: indexabilityRelease.receiptHash },
      })
    }
    return finishAfterGate('COMPLETE', [], {
      completion_scope: stage4BranchResult.status === 'PASS' || stage4BranchResult.status === 'NOT_REQUESTED' ? 'published_and_scoped_read_back' : 'article_published_stage4_separate', article_branch_status: 'COMPLETE', published: true,
      seo_live_claim: publish.seoLiveClaim, delivery_gaps: publish.deliveryGaps,
      release: { ...binding(context, context.releasePath), release_hash: release.release_hash },
      publish_receipt: { ...binding(context, context.publishReceiptPath), receipt_hash: publish.receiptHash },
    })
  }
  if (existsSync(context.publishReceiptPath)) {
    if (!existsSync(context.releasePath)) return finishAfterGate('BLOCKED', [escalationWorkOrder(context, 'publish_receipt_integrity_escalation', {
      reason: 'committed publish receipt exists, but its frozen content_release.v2 bytes are missing',
      inputs: [runInput(context, 'publish_receipt', context.publishReceiptPath, { schema: 'content_publish_receipt.v2' })],
    })], { article_branch_status: 'BLOCKED', published: false, seo_live_claim: false })
    let frozenRelease
    let frozenPublish
    try {
      frozenRelease = strictJson(context.releasePath, 'frozen committed content release')
      const { release_hash: releaseHash, ...releaseBase } = frozenRelease
      if (frozenRelease.schema !== RELEASE_SCHEMA || releaseHash !== canonicalJsonHash(releaseBase) || frozenRelease.run_id !== context.runId || frozenRelease.manifest_hash !== context.manifestHash || frozenRelease.publish_target !== context.publish.target || frozenRelease.public_base_url !== context.publish.publicBaseUrl || !sameSet(frozenRelease.articles?.map((article) => article.article_id) ?? [], context.articles.all.map((article) => article.article_id))) fail('frozen committed content release schema/hash/scope differs')
      frozenPublish = validatePublishReceiptV2({ context, release: frozenRelease, receiptPath: context.publishReceiptPath })
      if (frozenPublish.status !== 'pass') fail('committed publish receipt unexpectedly resolved as missing')
    } catch (error) {
      return finishAfterGate('BLOCKED', [escalationWorkOrder(context, 'publish_receipt_integrity_escalation', {
        reason: `committed release/publish receipt is malformed, stale, or scope-mismatched: ${error.message}`,
        inputs: [runInput(context, 'content_release', context.releasePath, { schema: 'content_release.v2' }), runInput(context, 'publish_receipt', context.publishReceiptPath, { schema: 'content_publish_receipt.v2' })],
      })], { article_branch_status: 'BLOCKED', published: false, seo_live_claim: false })
    }
    return finishPublishedRelease(frozenRelease, frozenPublish)
  }
  const compiled = []
  const writerOrders = []
  const articleValidationStarted = performance.now()
  for (const article of context.articles.all) {
    if (!existsSync(article.markdown_path)) {
      writerOrders.push(initialWriterOrder(context, issuedWorkOrders, article, packages[article.article_id], 'article Markdown is missing'))
      continue
    }
    let result
    try { result = compileArticleV2({ context, article, factsPackage: packages[article.article_id], evidenceMembershipHash: packages[article.article_id].evidence_membership_hash, issuedWorkOrders }) }
    catch (error) {
      if (error.pipeline_failure_kind === 'infrastructure') {
        removeRelease(context)
        return finishAfterGate('BLOCKED', [escalationWorkOrder(context, 'article_runtime_integrity_escalation', { article, reason: error.message, task: { failure_kind: 'renderer_or_browser_infrastructure' } })], { published: false })
      }
      let currentReceipt = null
      if (existsSync(writerReceiptPath(context, article))) {
        try { currentReceipt = strictJson(writerReceiptPath(context, article), `${article.article_id} writer receipt`) }
        catch (receiptError) {
          removeRelease(context)
          return finishAfterGate('BLOCKED', [escalationWorkOrder(context, 'writer_result_integrity_escalation', { article, reason: receiptError.message, inputs: [runInput(context, 'writer_result', writerReceiptPath(context, article), { schema: 'article_result.v2' })] })], { published: false })
        }
        if (currentReceipt.schema !== 'article_result.v2' || currentReceipt.content_hash !== artifactHashV2(currentReceipt)) {
          removeRelease(context)
          return finishAfterGate('BLOCKED', [escalationWorkOrder(context, 'writer_result_integrity_escalation', { article, reason: 'article_result.v2 schema/content hash is malformed or tampered', inputs: [runInput(context, 'writer_result', writerReceiptPath(context, article), { schema: 'article_result.v2' })] })], { published: false })
        }
      }
      if (!currentReceipt) {
        writerOrders.push(initialWriterOrder(context, issuedWorkOrders, article, packages[article.article_id], `article_result.v2 is missing after Markdown appeared: ${error.message}`))
        continue
      }
      if (isStaleWriterBindingError(error)) {
        writerOrders.push(writerOrder(context, article, packages[article.article_id], `full writer rebind after a stale receipt or content-lineage binding: ${error.message}`, { desiredRevision: 0 }))
        continue
      }
      const repair = boundedWriterRepair(context, issuedWorkOrders, article, packages[article.article_id], currentReceipt, { failureKind: 'compiler', details: error.message, reason: `scoped deterministic compiler repair: ${error.message}` })
      if (repair.blocked) {
        removeRelease(context)
        return finishAfterGate('BLOCKED', [repair.blocked], { published: false })
      }
      writerOrders.push(repair.order)
      continue
    }
    if (result.status !== 'pass') {
      if (!result.missingAssets?.length) {
        writerOrders.push(initialWriterOrder(context, issuedWorkOrders, article, packages[article.article_id], 'article_result.v2 is missing'))
        continue
      }
      const details = result.missingAssets.map((entry) => ({ index: entry.index, receipt_path: portablePath(context.root, entry.receiptPath), asset_path: entry.assetPath ? portablePath(context.root, entry.assetPath) : null, public_url: entry.descriptor?.target ?? null, reason: entry.reason ?? 'missing' }))
      const repair = boundedWriterRepair(context, issuedWorkOrders, article, packages[article.article_id], result.writer.receipt, { failureKind: 'asset', details, reason: 'scoped generated-graphic/article_asset.v2 repair', missingAssets: result.missingAssets })
      if (repair.blocked) {
        removeRelease(context)
        return finishAfterGate('BLOCKED', [repair.blocked], { published: false })
      }
      writerOrders.push(repair.order)
      continue
    }
    const nonWriterIds = [...pipeline.lock.extractor_ids, ...pipeline.lock.facts_reviewer_ids, pipeline.evidenceBundle.merged_by.id, pipeline.factsGate.validated_by.id]
    if (nonWriterIds.includes(result.writer.writerId)) fail(`${article.article_id} writer identity overlaps extraction, merge, facts review or facts gate validation`)
    validateRevisionAncestry(context, result)
    if (result.cacheHit) stats.article_validation_cache_hits += 1
    else stats.article_validation_cache_misses += 1
    if (result.rendererStyleCacheHit === true) stats.renderer_style_cache_hits += 1
    else if (result.rendererStyleCacheHit === false) stats.renderer_style_cache_misses += 1
    stats.revision_counts[String(result.writer.revision)] += 1
    compiled.push(result)
  }
  stats.gate_timings_ms.article_validation = Math.round((performance.now() - articleValidationStarted) * 100) / 100
  stats.gate_results.article_validation = writerOrders.length ? 'WAITING' : 'PASS'
  if (writerOrders.length) {
    removeRelease(context)
    return finishAfterGate('WAITING_FOR_WRITERS', writerOrders, { writers_ready: pipeline.factsGate.writers_ready })
  }
  const duplicateSeoGroups = findDuplicateReleaseSeoGroupsV2(compiled)
  if (duplicateSeoGroups.length) {
    const repairs = []
    for (const assignment of groupDuplicateReleaseSeoRepairsV2(duplicateSeoGroups)) {
      const result = compiled.find((entry) => entry.article.article_id === assignment.article_id)
      const repair = boundedWriterRepair(context, issuedWorkOrders, result.article, result.factsPackage, result.writer.receipt, {
        failureKind: 'compiler',
        details: { code: 'duplicate-release-seo-fields', groups: assignment.groups },
        reason: `scoped release SEO repair: ${assignment.groups.map((group) => group.field).join(' and ')} must be unique across the atomic release`,
      })
      if (repair.blocked) {
        removeRelease(context)
        return finishAfterGate('BLOCKED', [repair.blocked], { published: false })
      }
      repairs.push(repair.order)
    }
    removeRelease(context)
    return finishAfterGate('WAITING_FOR_WRITERS', repairs, { writers_ready: pipeline.factsGate.writers_ready, release_seo_duplicate_groups: duplicateSeoGroups })
  }
  const qaOrders = []
  const publicationQaStarted = performance.now()
  for (const result of compiled) {
    let review
    const independentFromIds = [...pipeline.lock.extractor_ids, ...pipeline.lock.facts_reviewer_ids, pipeline.evidenceBundle.merged_by.id, pipeline.factsGate.validated_by.id]
    result.independentFromIds = independentFromIds
    try { review = validatePublicationReviewV2({ context, compiledArticle: result, independentFromIds }) }
    catch (error) {
      removeRelease(context)
      stats.gate_timings_ms.publication_qa = Math.round((performance.now() - publicationQaStarted) * 100) / 100
      stats.gate_results.publication_qa = 'BLOCKED_INTEGRITY'
      return finishAfterGate('BLOCKED', [escalationWorkOrder(context, 'publication_review_integrity_escalation', {
        article: result.article, reason: `publication review is malformed or tampered: ${error.message}`,
        inputs: existsSync(publicationReviewPath(context, result.article, result.writer.revision)) ? [runInput(context, 'publication_review', publicationReviewPath(context, result.article, result.writer.revision), { schema: 'article_publication_review.v2' })] : [],
        task: { revision: result.writer.revision },
      })], { published: false })
    }
    if (review.status === 'missing' || review.status === 'stale') {
      qaOrders.push(publicationQaOrder(context, result, issuedWorkOrders, review.status === 'stale' ? `stale formal review invalidated: ${review.reason}` : 'hash-bound publication review is missing'))
      continue
    }
    if (review.status === 'fail') {
      if (result.writer.revision >= MAX_REVISION) {
        removeRelease(context)
        return finishAfterGate('BLOCKED', [escalationWorkOrder(context, 'publication_escalation', { article: result.article, reason: `targeted recheck failed after ${MAX_REVISION} permitted revisions`, inputs: [runInput(context, 'publication_review', review.path, { contentHash: review.reviewHash, schema: 'article_publication_review.v2' })], task: { revision: result.writer.revision, findings: review.findings } })], { published: false })
      }
      const previous = { review_id: review.reviewId, review_hash: review.reviewHash, review_path: portablePath(context.root, review.path), compiled_payload_hash: result.compiled.compiled_payload_hash, visible_payload_hash: result.compiled.visible_payload_hash }
      const desiredRevision = result.writer.revision + 1
      const priorRevisionOrder = [...issuedWorkOrders].reverse().find((order) => order.kind === 'writer_revision' && order.task?.article_id === result.article.article_id && order.task?.revision === desiredRevision && order.task?.previous?.review_id === review.reviewId)
      qaOrders.push(priorRevisionOrder ?? writerOrder(context, result.article, result.factsPackage, 'publication QA returned blocking findings; revise only the bundled scope', { desiredRevision, previous, findings: review.findings }))
      continue
    }
    result.publicationReview = review
  }
  stats.gate_timings_ms.publication_qa = Math.round((performance.now() - publicationQaStarted) * 100) / 100
  stats.gate_results.publication_qa = qaOrders.length ? 'WAITING' : 'PASS'
  if (qaOrders.length) {
    removeRelease(context)
    const state = qaOrders.some((entry) => entry.kind === 'writer_revision') ? 'WAITING_FOR_WRITERS' : 'WAITING_FOR_PUBLICATION_QA'
    return finishAfterGate(state, qaOrders, { writers_ready: pipeline.factsGate.writers_ready })
  }
  if (!context.publish.required) {
    removeRelease(context)
    return finishAfterGate('COMPLETE', [], {
      completion_scope: stage4BranchResult.status === 'PASS' || stage4BranchResult.status === 'NOT_REQUESTED' ? 'validated_article_bundle_only' : 'article_bundle_validated_stage4_separate',
      article_branch_status: 'COMPLETE', published: false,
      validated_articles: compiled.map((result) => ({ article_id: result.article.article_id, stage: result.article.stage, slug: result.article.slug, compiled_payload_hash: result.compiled.compiled_payload_hash, visible_payload_hash: result.compiled.visible_payload_hash, qa_payload_hash: result.compiled.qa_payload.content_hash, publication_review_hash: result.publicationReview.reviewHash })).sort((left, right) => left.article_id.localeCompare(right.article_id)),
      publish_preflight: { required: false, ingredient_target_resolved: false, source_catalog_synced: false, persistent_writes: 0 },
    })
  }
  const preflightOrders = []
  const articleTargetSelectors = updateArticleTargetSelectors(context)
  if (articleTargetSelectors.length) {
    if (!existsSync(context.articleTargetReceiptPath)) preflightOrders.push(articleTargetReadbackWorkOrder(context, articleTargetSelectors, 'publication gate passed; freeze authoritative created/updated timestamps for guarded update targets before hashing the release SEO'))
    else {
      try { loadArticleTargets(context, articleTargetSelectors, issuedWorkOrders) }
      catch (error) { preflightOrders.push(articleTargetReadbackWorkOrder(context, articleTargetSelectors, `publication gate passed, but the update-target timestamp readback is missing, stale or guard-mismatched: ${error.message}`)) }
    }
  } else context.articleTargets = { receipt_hash: null, receipt: null, byId: new Map() }
  let ingredientReady = false
  if (!existsSync(context.ingredientTargetReceiptPath)) preflightOrders.push(ingredientTargetReadbackWorkOrder(context, 'publication gate passed; resolve the authoritative active ingredient only now for the explicitly authorized publish preflight'))
  else {
    try { loadIngredientTarget(context, issuedWorkOrders); ingredientReady = true }
    catch (error) { preflightOrders.push(ingredientTargetReadbackWorkOrder(context, `publication gate passed, but the publish target is missing, inactive, ambiguous or stale: ${error.message}`)) }
  }
  const assetDeploymentRequest = ensureAssetDeploymentRequest(context, compiled)
  if (assetDeploymentRequest.assets.length) {
    if (!existsSync(context.assetDeploymentReceiptPath)) preflightOrders.push(assetStageWorkOrder(context, assetDeploymentRequest, 'publication gate passed; prestage the frozen content-addressed generated assets before the D1 release'))
    else {
      try { loadAssetDeployment(context, assetDeploymentRequest, issuedWorkOrders) }
      catch (error) { preflightOrders.push(assetStageWorkOrder(context, assetDeploymentRequest, `asset prestage receipt is missing, stale or mismatched: ${error.message}`)) }
    }
  } else context.assetDeployment = { receipt_hash: null, assets: [] }
  if (ingredientReady) {
    const sourceCatalogRequest = ensureSourceCatalogRequest(context, coverage)
    if (!existsSync(context.sourceResolutionReceiptPath)) preflightOrders.push(sourceCatalogSyncWorkOrder(context, sourceCatalogRequest, 'publication gate and ingredient target passed; synchronize the authoritative source catalog in parallel with any still-open additive asset staging'))
    else {
      try { loadSourceResolution(context, sourceCatalogRequest, issuedWorkOrders) }
      catch (error) { preflightOrders.push(sourceCatalogSyncWorkOrder(context, sourceCatalogRequest, `publication gate passed, but source-catalog resolution is ambiguous, stale or incomplete: ${error.message}`)) }
    }
  }
  if (preflightOrders.length) {
    removeRelease(context)
    const waitsForAsset = preflightOrders.some((order) => order.kind === 'asset_stage')
    const waitsForArticleTarget = preflightOrders.some((order) => order.kind === 'article_target_readback')
    const waitsForIngredient = preflightOrders.some((order) => order.kind === 'ingredient_target_readback')
    const state = waitsForAsset ? 'WAITING_FOR_ASSET_DEPLOYMENT' : waitsForArticleTarget ? 'WAITING_FOR_ARTICLE_TARGETS' : waitsForIngredient ? 'WAITING_FOR_INGREDIENT_TARGET' : 'WAITING_FOR_SOURCE_CATALOG_SYNC'
    return finishAfterGate(state, preflightOrders, { published: false, publish_preflight_phase: preflightOrders.map((order) => order.kind).sort(), additive_prestage_only: true, independent_orders_parallelizable: preflightOrders.length > 1 })
  }
  let release = buildContentReleaseV2({ context, articles: compiled })
  if (context.articles.all.some(article => article.authoritative_before)) {
    const { release_hash: previousHash, ...base } = release
    base.articles = base.articles.map(article => {
      const plan = context.articles.all.find(entry => entry.article_id === article.article_id)
      return plan.authoritative_before ? { ...article, authoritative_before: plan.authoritative_before, update_reason: plan.update_reason } : article
    })
    release = { ...base, release_hash: canonicalJsonHash(base) }
  }
  writeJsonAtomic(context.releasePath, release)
  let publish
  const publishValidationStarted = performance.now()
  try { publish = validatePublishReceiptV2({ context, release, receiptPath: context.publishReceiptPath }) }
  catch (error) {
    stats.gate_timings_ms.publish_validation = Math.round((performance.now() - publishValidationStarted) * 100) / 100
    stats.gate_results.publish_validation = 'BLOCKED_INTEGRITY'
    return finishAfterGate('BLOCKED', [escalationWorkOrder(context, 'publish_receipt_integrity_escalation', {
      reason: `existing publish receipt is malformed, stale, or its guard/readback differs: ${error.message}`,
      inputs: [runInput(context, 'content_release', context.releasePath, { contentHash: release.release_hash, schema: 'content_release.v2' }), runInput(context, 'publish_receipt', context.publishReceiptPath, { schema: 'content_publish_receipt.v2' })],
      task: { release_hash: release.release_hash, receipt_path: portablePath(context.root, context.publishReceiptPath) },
    })], { article_branch_status: 'BLOCKED', published: false, release: { ...binding(context, context.releasePath), release_hash: release.release_hash } })
  }
  stats.gate_timings_ms.publish_validation = Math.round((performance.now() - publishValidationStarted) * 100) / 100
  stats.gate_results.publish_validation = publish.status === 'pass' ? 'PASS' : publish.status.toUpperCase()
  if (publish.status === 'missing') return finishAfterGate('READY_TO_PUBLISH', [publicationApplyOrder(context, release, publish.reason ?? 'structured publish/apply/readback receipt is missing')], {
    published: false, reason: publish.reason ?? 'structured publish/apply/readback receipt is missing',
    release: { ...binding(context, context.releasePath), release_hash: release.release_hash },
    required_publish_receipt: { path: portablePath(context.root, context.publishReceiptPath), schema: 'content_publish_receipt.v2' },
    production_apply_executor: { implemented: true, module: 'scripts/lib/nutrient-content-machine-dispatcher.mjs', explicit_publish_flag_required: true },
  })
  if (publish.status !== 'pass') fail(`publish receipt validator returned unsupported status ${publish.status}`)
  return finishPublishedRelease(release, publish)
}

export { EVIDENCE_V2_REPO_ROOT }
