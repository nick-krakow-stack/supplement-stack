import { createHash } from 'node:crypto'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, isAbsolute, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  canonicalize,
  coveragePlanContentHash,
  deterministicStandardSample,
  evidenceBundleContentHash,
  evidenceRecordPayloadHash,
  sha256Bytes,
  validateCoveragePlan,
  validateEvidenceBundle,
  validateEvidenceRecord,
  validateEvidenceSource,
} from './content-validation.mjs'

const HASH = /^sha256:[a-f0-9]{64}$/
const OPERATIONAL_LABELS = new Set(['ANCHOR', 'SUPPORTING'])
const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
export const CANONICAL_FRAMEWORK_CATALOG_PATH = resolve(REPO_ROOT, 'codex-files/frameworks/framework-catalog.v1.json')
export const CANONICAL_STYLE_SNAPSHOT_PATH = resolve(REPO_ROOT, 'codex-files/frameworks/stage3-style-snapshots.v1.json')
export const CANONICAL_STAGE4_QUERY_PATH = resolve(REPO_ROOT, 'scripts/sql/stage4-resolver-preflight.sql')
const WRANGLER_PATH = resolve(REPO_ROOT, 'wrangler.toml')

export function artifactHash(value, omitted = ['content_hash', 'package_content_hash']) {
  const copy = Object.fromEntries(Object.entries(value).filter(([key]) => !omitted.includes(key)))
  return `sha256:${createHash('sha256').update(JSON.stringify(canonicalize(copy)), 'utf8').digest('hex')}`
}

function fail(message) { throw new Error(message) }
function object(value, label) { if (!value || typeof value !== 'object' || Array.isArray(value)) fail(`${label} must be an object`); return value }
function text(value, label) { if (typeof value !== 'string' || !value.trim()) fail(`${label} must be a non-empty string`); return value.trim() }
function strings(value, label, { allowEmpty = false } = {}) {
  if (!Array.isArray(value) || (!allowEmpty && !value.length) || value.some((entry) => typeof entry !== 'string' || !entry.trim())) fail(`${label} must be ${allowEmpty ? 'a' : 'a non-empty'} string array`)
  const result = value.map((entry) => entry.trim())
  if (new Set(result).size !== result.length) fail(`${label} must contain unique values`)
  return result
}
function iso(value, label) { const input = text(value, label); const parsed = Date.parse(input); if (!Number.isFinite(parsed) || new Date(parsed).toISOString() !== input) fail(`${label} must be strict ISO-8601 UTC`); return parsed }
function sameSet(left, right) { return left.size === right.size && [...left].every((entry) => right.has(entry)) }
function sorted(values) { return [...values].sort((a, b) => String(a).localeCompare(String(b))) }
function readJson(path) { return JSON.parse(readFileSync(path, 'utf8')) }
function resolveFrom(baseDir, path) { return isAbsolute(path) ? resolve(path) : resolve(baseDir, path) }
function assertIssues(issues, label) { if (issues.length) fail(`${label}: ${issues.map((entry) => `${entry.code}: ${entry.message}`).join('; ')}`) }

export function resolveFrameworkCatalog({ catalog, repoRoot, coveragePlan, catalogPath = CANONICAL_FRAMEWORK_CATALOG_PATH, mode = 'production' }) {
  object(catalog, 'framework catalog')
  if (catalog.schema !== 'framework_catalog.v1') fail('framework catalog schema must equal framework_catalog.v1')
  if (mode === 'production' && resolve(catalogPath) !== CANONICAL_FRAMEWORK_CATALOG_PATH) fail('production builds must use the canonical repository framework catalog')
  const entries = Array.isArray(catalog.frameworks) ? catalog.frameworks : fail('framework catalog frameworks must be an array')
  const keys = new Set()
  const byKey = new Map()
  for (const [index, entry] of entries.entries()) {
    object(entry, `frameworks[${index}]`)
    const id = text(entry.framework_id, `frameworks[${index}].framework_id`)
    const version = text(entry.version, `frameworks[${index}].version`)
    const stage = text(entry.stage, `frameworks[${index}].stage`)
    const variant = text(entry.variant, `frameworks[${index}].variant`)
    const path = text(entry.path, `frameworks[${index}].path`)
    if (!['stage2', 'stage3'].includes(stage)) fail(`framework ${id}@${version} has invalid stage`)
    if (!['approved', 'retired'].includes(entry.status)) fail(`framework ${id}@${version} has invalid status`)
    const key = `${id}@${version}`
    if (keys.has(key)) fail(`duplicate framework catalog key ${key}`)
    keys.add(key)
    if (!existsSync(resolve(repoRoot, path))) fail(`framework file does not exist: ${path}`)
    if (entry.lifecycle === 'new') {
      for (const gate of ['owner_approval_artifact', 'pilot_artifact']) {
        object(entry[gate], `${key}.${gate}`)
        if (entry[gate].status !== 'passed' && entry[gate].status !== 'approved') fail(`${key}.${gate} is not approved/passed`)
        text(entry[gate].artifact_id, `${key}.${gate}.artifact_id`)
        if (!HASH.test(entry[gate].artifact_hash ?? '')) fail(`${key}.${gate}.artifact_hash is invalid`)
        text(entry[gate].actor_id, `${key}.${gate}.actor_id`)
        iso(entry[gate].at, `${key}.${gate}.at`)
        const artifactPath = resolve(repoRoot, text(entry[gate].artifact_path, `${key}.${gate}.artifact_path`))
        if (!existsSync(artifactPath) || sha256Bytes(readFileSync(artifactPath)) !== entry[gate].artifact_hash) fail(`${key}.${gate} artifact path/bytes do not match its hash`)
      }
    }
    if (entry.lifecycle === 'adapt') {
      text(entry.base_framework_id, `${key}.base_framework_id`)
      text(entry.change_summary, `${key}.change_summary`)
      if (entry.variant_review_status !== 'passed') fail(`${key} adapted framework requires variant_review_status=passed`)
    }
    byKey.set(key, { ...entry, path, variant })
  }
  function bind(fit, stage, label) {
    object(fit, label)
    const id = text(fit.framework_id, `${label}.framework_id`)
    const version = text(fit.version ?? fit.framework_version, `${label}.version`)
    const entry = byKey.get(`${id}@${version}`)
    if (!entry || entry.status !== 'approved' || entry.stage !== stage) fail(`${label} does not resolve to an approved ${stage} catalog entry`)
    const variant = fit.variant ?? fit.variant_id
    if (variant !== entry.variant) fail(`${label} variant differs from catalog`)
    const decision = text(fit.decision, `${label}.decision`)
    const lifecycle = entry.lifecycle ?? 'existing'
    if (decision !== lifecycle) fail(`${label}.decision must equal catalog lifecycle ${lifecycle}`)
    if (decision === 'new' && (fit.owner_approval?.status !== 'approved' || fit.pilot?.status !== 'passed')) fail(`${label} new framework lacks owner/pilot PASS`)
    return { framework_id: id, version, stage, path: entry.path, status: entry.status, variant: entry.variant, decision }
  }
  const candidateBindings = Object.fromEntries((coveragePlan.article_candidates ?? []).map((candidate) => [candidate.article_id, bind(candidate.framework_fit, 'stage2', `article ${candidate.article_id}.framework_fit`)]))
  const stage3Fit = coveragePlan.stage3_archetype_decision?.framework_fit ?? coveragePlan.stage3_archetype_decision
  const stage3Binding = bind(stage3Fit, 'stage3', 'stage3_archetype_decision.framework_fit')
  if (stage3Binding.variant !== coveragePlan.stage3_archetype_decision.archetype) fail('Stage-3 archetype differs from framework catalog variant')
  return { catalog_version: text(catalog.catalog_version, 'catalog_version'), candidate_bindings: candidateBindings, stage3_binding: stage3Binding }
}

export function resolveCanonicalStyleReferences({ repoRoot = REPO_ROOT, snapshotPath = CANONICAL_STYLE_SNAPSHOT_PATH, mode = 'production' } = {}) {
  if (mode === 'production' && resolve(snapshotPath) !== CANONICAL_STYLE_SNAPSHOT_PATH) fail('production builds must use the canonical Stage-3 style snapshot')
  const snapshot = readJson(snapshotPath)
  if (snapshot.schema !== 'stage3_style_snapshots.v1' || snapshot.status !== 'approved') fail('Stage-3 style snapshot must be approved')
  const refs = Array.isArray(snapshot.snapshots) ? snapshot.snapshots : fail('Stage-3 style snapshot entries are missing')
  const required = new Set(['magnesium-reader-reference-v2', 'vitamin-a-reader-reference-v2'])
  const resolved = refs.map((entry, index) => {
    const id = text(entry.reference_id, `style snapshot[${index}].reference_id`)
    const path = text(entry.path, `style snapshot[${index}].path`)
    const absolute = resolve(repoRoot, path)
    if (!existsSync(absolute) || sha256Bytes(readFileSync(absolute)) !== entry.sha256) fail(`style reference ${id} path/bytes do not match its approved hash`)
    required.delete(id)
    return { id, version: snapshot.version, path, content_hash: entry.sha256, status: 'approved' }
  })
  if (required.size) fail(`required style references are missing: ${[...required].join(', ')}`)
  return { snapshot, snapshot_path: snapshotPath, snapshot_hash: sha256Bytes(readFileSync(snapshotPath)), references: resolved }
}

export function validateSourceEvidenceShard({ shard, coveragePlan, sourceArtifacts, file = 'source-evidence-shard.json' }) {
  object(shard, file)
  if (shard.schema !== 'source_evidence_shard.v1') fail(`${file}: schema must equal source_evidence_shard.v1`)
  text(shard.shard_id, `${file}.shard_id`)
  if (shard.coverage_plan_id !== coveragePlan.coverage_plan_id || shard.coverage_plan_content_hash !== coveragePlan.content_hash) fail(`${file}: stale coverage binding`)
  if (shard.extractor?.role !== 'source-evidence-extractor') fail(`${file}: extractor.role must equal source-evidence-extractor`)
  const extractorId = text(shard.extractor?.id ?? shard.extractor_id, `${file}.extractor.id`)
  const createdAt = iso(shard.created_at, `${file}.created_at`)
  const sources = Array.isArray(shard.sources) ? shard.sources : fail(`${file}.sources must be an array`)
  const records = Array.isArray(shard.records) ? shard.records : fail(`${file}.records must be an array`)
  if (!sources.length || !records.length) fail(`${file}: sources and records must not be empty`)
  const sourceIds = strings(sources.map((source) => source.source_id), `${file}.source IDs`)
  strings(records.map((record) => record.record_id), `${file}.record IDs`)
  const sourceSet = new Set(sourceIds)
  for (const source of sources) {
    assertIssues(validateEvidenceSource(source, file), file)
    if (source.created_by?.role !== 'source-evidence-extractor' || source.created_by?.id !== extractorId) fail(`${file}: source ${source.source_id} ownership differs from shard extractor`)
    if (iso(source.created_by.created_at, `${file}.${source.source_id}.created_at`) > createdAt) fail(`${file}: source creation occurs after shard creation`)
    const bytes = sourceArtifacts[source.source_id]
    if (!(typeof bytes === 'string' || bytes instanceof Uint8Array)) fail(`${file}: source artifact bytes missing for ${source.source_id}`)
    if (sha256Bytes(bytes) !== source.source_content_hash) fail(`${file}: source artifact hash mismatch for ${source.source_id}`)
  }
  for (const record of records) {
    assertIssues(validateEvidenceRecord(record, file), file)
    if (!sourceSet.has(record.source_id)) fail(`${file}: record ${record.record_id} references source outside its shard`)
  }
  if (shard.content_hash !== artifactHash(shard)) fail(`${file}: content_hash mismatch`)
  return { ...shard, extractor: { role: 'source-evidence-extractor', id: extractorId } }
}

export function mergeSourceEvidenceShards({ coveragePlan, shards, sourceArtifacts, sourceArtifactPaths, merger, bundleId, repoRoot = REPO_ROOT, mode = 'production' }) {
  if (!Array.isArray(shards) || !shards.length) fail('at least one extraction shard is required')
  if (merger?.role !== 'evidence-bundle-merger') fail('merger.role must equal evidence-bundle-merger')
  const mergerId = text(merger.id, 'merger.id')
  const mergedAt = iso(merger.merged_at, 'merger.merged_at')
  const shardIds = new Set(), sourceIds = new Set(), recordIds = new Set(), extractorIds = new Set()
  const sources = [], records = []
  for (const shard of shards) {
    validateSourceEvidenceShard({ shard, coveragePlan, sourceArtifacts, file: shard.shard_id ?? 'shard' })
    if (shardIds.has(shard.shard_id)) fail(`duplicate shard_id ${shard.shard_id}`)
    shardIds.add(shard.shard_id)
    const extractorId = shard.extractor?.id ?? shard.extractor_id
    extractorIds.add(extractorId)
    if (extractorId === mergerId) fail('merger must be independent from every extractor')
    if (iso(shard.created_at, `${shard.shard_id}.created_at`) > mergedAt) fail(`shard ${shard.shard_id} postdates merge`)
    for (const source of shard.sources) { if (sourceIds.has(source.source_id)) fail(`overlapping source_id ${source.source_id}`); sourceIds.add(source.source_id); sources.push(source) }
    for (const record of shard.records) { if (recordIds.has(record.record_id)) fail(`overlapping record_id ${record.record_id}`); recordIds.add(record.record_id); records.push(record) }
  }
  const bundle = {
    schema: 'source_evidence_bundle.v1', bundle_id: text(bundleId, 'bundle_id'), content_hash: '',
    coverage_plan_id: coveragePlan.coverage_plan_id, coverage_plan_content_hash: coveragePlan.content_hash,
    source_evidence_shard_ids: sorted(shardIds), merged_by: { role: 'evidence-bundle-merger', id: mergerId, merged_at: merger.merged_at },
    stage4_requested: coveragePlan.stage4_requested, sources: sources.sort((a, b) => a.source_id.localeCompare(b.source_id)), records: records.sort((a, b) => a.record_id.localeCompare(b.record_id)),
  }
  if (sourceArtifactPaths) {
    object(sourceArtifactPaths, 'sourceArtifactPaths')
    const declaredIds = Object.keys(sourceArtifactPaths)
    if (!sameSet(new Set(declaredIds), sourceIds)) fail('sourceArtifactPaths must map exactly the merged source IDs')
    const paths = {}
    for (const sourceId of sorted(sourceIds)) {
      const absolute = resolve(text(sourceArtifactPaths[sourceId], `sourceArtifactPaths.${sourceId}`))
      if (mode === 'production') {
        const path = relative(resolve(repoRoot), absolute)
        if (!path || path.startsWith('..') || isAbsolute(path)) fail(`production source artifact is outside repository: ${absolute}`)
        paths[sourceId] = path.replaceAll('\\', '/')
      } else paths[sourceId] = absolute
    }
    bundle.source_artifact_resolution = { schema: 'source_artifact_resolution.v1', base: mode === 'production' ? 'repo_root' : 'absolute', paths }
  }
  bundle.content_hash = evidenceBundleContentHash(bundle)
  return { bundle, extractorIds }
}

function candidateSourceIds(candidate) { return new Set([candidate.primary_source_id, ...(candidate.integrated_source_ids ?? [])]) }
function risksForRecord(record, plan) {
  const result = new Set()
  for (const candidate of plan.article_candidates ?? []) if (candidateSourceIds(candidate).has(record.source_id)) for (const risk of candidate.risk_class ?? []) result.add(risk)
  return result.size ? sorted(result) : ['standard']
}

export function deriveExpectedFacts({ coveragePlan, evidenceBundle }) {
  const requiredCovered = (coveragePlan.clusters ?? []).filter((cluster) => cluster.required && cluster.status === 'covered')
  const acceptedCandidates = (coveragePlan.article_candidates ?? []).filter((candidate) => !['blocked', 'excluded'].includes(candidate.status))
  const requiredSources = new Set()
  for (const cluster of requiredCovered) for (const id of [...(cluster.primary_source_ids ?? []), ...(cluster.supporting_source_ids ?? [])]) {
    const source = coveragePlan.sources.find((entry) => entry.source_id === id)
    if (source && OPERATIONAL_LABELS.has(source.stage15_label)) requiredSources.add(id)
  }
  for (const candidate of acceptedCandidates) for (const id of candidateSourceIds(candidate)) {
    const source = coveragePlan.sources.find((entry) => entry.source_id === id)
    if (source && OPERATIONAL_LABELS.has(source.stage15_label)) requiredSources.add(id)
  }
  const blockingGaps = []
  for (const cluster of requiredCovered) if (!evidenceBundle.records.some((record) => record.cluster_keys.includes(cluster.cluster_key))) blockingGaps.push(`cluster:${cluster.cluster_key}`)
  for (const sourceId of requiredSources) if (!evidenceBundle.records.some((record) => record.source_id === sourceId)) blockingGaps.push(`source:${sourceId}`)
  for (const cluster of coveragePlan.clusters ?? []) if (cluster.required && cluster.status === 'input_gap') blockingGaps.push(`cluster:${cluster.cluster_key}:${cluster.reason ?? 'INPUT_GAP'}`)
  const recordIds = evidenceBundle.records.filter((record) => requiredSources.has(record.source_id) || record.cluster_keys.some((key) => requiredCovered.some((cluster) => cluster.cluster_key === key))).map((record) => record.record_id)
  if (!recordIds.length) blockingGaps.push('records:none')
  return { required_record_ids: sorted(new Set(recordIds)), required_source_ids: sorted(requiredSources), required_cluster_keys: sorted(requiredCovered.map((cluster) => cluster.cluster_key)), blocking_gaps: sorted(new Set(blockingGaps)) }
}

function d1ResultRows(value) {
  if (Array.isArray(value) && value[0]?.results) return value[0].results
  if (Array.isArray(value?.result) && value.result[0]?.results) return value.result[0].results
  if (Array.isArray(value?.results)) return value.results
  fail('D1 result artifact has no results array')
}
function wranglerD1Identity() {
  const text = readFileSync(WRANGLER_PATH, 'utf8')
  const section = text.match(/\[\[d1_databases\]\]([\s\S]*?)(?=\n\[\[|$)/)?.[1] ?? ''
  const get = (key) => section.match(new RegExp(`^\\s*${key}\\s*=\\s*"([^"]+)"`, 'm'))?.[1]
  return { binding: get('binding'), database_name: get('database_name'), database_id: get('database_id') }
}
function cloudflareAccountIds(value, found = new Set()) {
  if (Array.isArray(value)) for (const entry of value) cloudflareAccountIds(entry, found)
  else if (value && typeof value === 'object') {
    if (Array.isArray(value.accounts)) for (const account of value.accounts) if (typeof account?.id === 'string') found.add(account.id)
    for (const [key, entry] of Object.entries(value)) { if (/account.*id|id.*account/i.test(key) && typeof entry === 'string') found.add(entry); cloudflareAccountIds(entry, found) }
  }
  return found
}
function validateProductionD1Attestation(resolver) {
  const p = resolver.provenance
  for (const key of ['attestation_path', 'attestation_hash']) text(p[key], `population resolver.provenance.${key}`)
  const attestationPath = resolve(REPO_ROOT, p.attestation_path)
  if (isAbsolute(p.attestation_path) || relative(REPO_ROOT, attestationPath).startsWith('..')) fail('Stage-4 production attestation must be stored inside the repository')
  if (!existsSync(attestationPath) || sha256Bytes(readFileSync(attestationPath)) !== p.attestation_hash) fail('Stage-4 production attestation bytes/hash mismatch')
  const a = readJson(attestationPath)
  if (a.schema !== 'stage4_d1_preflight_attestation.v1' || a.mode !== 'production' || a.execution_mode !== 'live' || a.status !== 'pass' || a.generator !== 'stage4-d1-resolver-preflight.v1' || a.shell !== false) fail('Stage-4 production attestation is invalid')
  const wranglerEntrypoint = resolve(text(a.wrangler_entrypoint, 'Stage-4 attestation.wrangler_entrypoint'))
  const expectedAuth = [wranglerEntrypoint, 'whoami', '--json'], expectedQuery = [wranglerEntrypoint, 'd1', 'execute', p.database_name, '--remote', '--command', readFileSync(CANONICAL_STAGE4_QUERY_PATH, 'utf8'), '--json']
  if (a.executable !== process.execPath || a.wrangler_entrypoint !== wranglerEntrypoint || !existsSync(wranglerEntrypoint) || JSON.stringify(a.auth_argv) !== JSON.stringify(expectedAuth) || JSON.stringify(a.query_argv) !== JSON.stringify(expectedQuery)) fail('Stage-4 attestation command argv is not canonical')
  const started = iso(a.started_at, 'Stage-4 attestation.started_at'), completed = iso(a.completed_at, 'Stage-4 attestation.completed_at')
  if (completed < started || a.completed_at !== p.executed_at) fail('Stage-4 attestation time/order differs from resolver')
  const authPath = resolve(REPO_ROOT, text(a.auth_artifact_path, 'Stage-4 attestation.auth_artifact_path'))
  const stdoutPath = resolve(REPO_ROOT, text(a.stdout_artifact_path, 'Stage-4 attestation.stdout_artifact_path'))
  if (isAbsolute(a.auth_artifact_path) || relative(REPO_ROOT, authPath).startsWith('..') || isAbsolute(a.stdout_artifact_path) || relative(REPO_ROOT, stdoutPath).startsWith('..')) fail('Stage-4 production command artifacts must be stored inside the repository')
  if (!existsSync(authPath) || sha256Bytes(readFileSync(authPath)) !== a.auth_stdout_byte_hash) fail('Stage-4 authentication artifact bytes/hash mismatch')
  if (!existsSync(stdoutPath) || sha256Bytes(readFileSync(stdoutPath)) !== a.stdout_byte_hash) fail('Stage-4 stdout artifact bytes/hash mismatch')
  let auth; try { auth = JSON.parse(readFileSync(authPath, 'utf8')) } catch { fail('Stage-4 authentication artifact is not JSON') }
  const ids = cloudflareAccountIds(auth)
  if (ids.size !== 1 || !ids.has(a.account_id)) fail('Stage-4 authenticated account identity is missing or ambiguous')
  if (a.wrangler_config_path !== 'wrangler.toml' || a.wrangler_config_hash !== sha256Bytes(readFileSync(WRANGLER_PATH)) || a.query_path !== 'scripts/sql/stage4-resolver-preflight.sql' || a.query_hash !== sha256Bytes(readFileSync(CANONICAL_STAGE4_QUERY_PATH))) fail('Stage-4 attestation config/query bytes are stale')
  for (const key of ['database_id', 'database_name', 'environment', 'account_id', 'binding']) if (a[key] !== p[key]) fail(`Stage-4 attestation ${key} differs from resolver`)
  if (a.stdout_artifact_path !== p.result_artifact_path || a.stdout_byte_hash !== p.result_hash || a.query_hash !== p.query_hash) fail('Stage-4 attestation output/query binding differs from resolver')
  return { attestation: a, path: attestationPath, authPath, stdoutPath }
}
export function validatePopulationResolver({ coveragePlan, evidenceBundle, resolver, mode = 'production' }) {
  if (!coveragePlan.stage4_requested) {
    if (resolver != null) fail('population resolver must be omitted when stage4_requested=false')
    return null
  }
  if (resolver == null) fail('Stage 4 requires a versioned population resolver snapshot or explicit preflight mapping')
  object(resolver, 'population resolver')
  if (!['population_resolver_snapshot.v1', 'population_preflight_mapping.v1'].includes(resolver.schema)) fail('Stage 4 requires a versioned population resolver snapshot or explicit preflight mapping')
  text(resolver.version, 'population resolver.version')
  if (resolver.mode !== mode) fail(`population resolver mode must equal ${mode}`)
  iso(resolver.created_at, 'population resolver.created_at')
  if (resolver.provenance?.kind !== 'd1_preflight' || !text(resolver.provenance?.database_id, 'population resolver.provenance.database_id') || !HASH.test(resolver.provenance?.query_hash ?? '') || !HASH.test(resolver.provenance?.result_hash ?? '')) fail('population resolver requires hash-bound D1 preflight provenance')
  iso(resolver.provenance.executed_at, 'population resolver.provenance.executed_at')
  for (const key of ['database_name', 'environment', 'account_id', 'binding', 'query_path', 'result_artifact_path']) text(resolver.provenance[key], `population resolver.provenance.${key}`)
  const queryPath = mode === 'test' && isAbsolute(resolver.provenance.query_path) ? resolve(resolver.provenance.query_path) : resolve(REPO_ROOT, resolver.provenance.query_path)
  const resultPath = mode === 'test' && isAbsolute(resolver.provenance.result_artifact_path) ? resolve(resolver.provenance.result_artifact_path) : resolve(REPO_ROOT, resolver.provenance.result_artifact_path)
  if (mode === 'production' && queryPath !== CANONICAL_STAGE4_QUERY_PATH) fail('production Stage-4 resolver must use the canonical read-only query')
  if (!existsSync(queryPath) || sha256Bytes(readFileSync(queryPath)) !== resolver.provenance.query_hash) fail('Stage-4 resolver query bytes/hash mismatch')
  if (!existsSync(resultPath) || sha256Bytes(readFileSync(resultPath)) !== resolver.provenance.result_hash) fail('Stage-4 resolver result artifact bytes/hash mismatch')
  if (mode === 'production') {
    if (!resultPath.startsWith(`${REPO_ROOT}\\`) && !resultPath.startsWith(`${REPO_ROOT}/`)) fail('production Stage-4 result artifact must be stored inside the repository')
    const identity = wranglerD1Identity()
    if (resolver.provenance.database_id !== identity.database_id || resolver.provenance.database_name !== identity.database_name || resolver.provenance.binding !== identity.binding || resolver.provenance.environment !== 'production') fail('Stage-4 resolver D1 identity differs from canonical Wrangler production binding')
    if (process.env.CLOUDFLARE_ACCOUNT_ID && resolver.provenance.account_id !== process.env.CLOUDFLARE_ACCOUNT_ID) fail('Stage-4 resolver account_id differs from the active Cloudflare account')
    validateProductionD1Attestation(resolver)
  }
  const mappings = Array.isArray(resolver.mappings) ? resolver.mappings : fail('population resolver.mappings must be an array')
  const keys = strings(mappings.map((entry) => entry.population_key), 'population resolver keys')
  const byKey = new Map()
  for (const [index, entry] of mappings.entries()) {
    if (!Number.isInteger(entry.population_id) || entry.population_id <= 0) fail(`population resolver.mappings[${index}].population_id must be positive`)
    if (entry.population_slug !== entry.population_key) fail(`population resolver mapping ${entry.population_key} slug differs`)
    byKey.set(entry.population_key, entry)
  }
  if (resolver.content_hash !== artifactHash(resolver)) fail('population resolver content hash is stale')
  const ingredients = Array.isArray(resolver.ingredients) ? resolver.ingredients : fail('population resolver.ingredients must be an array')
  const ingredientIds = new Set()
  for (const [index, entry] of ingredients.entries()) {
    if (!Number.isInteger(entry.ingredient_id) || entry.ingredient_id <= 0 || !text(entry.ingredient_slug, `population resolver.ingredients[${index}].ingredient_slug`)) fail(`population resolver.ingredients[${index}] is invalid`)
    if (ingredientIds.has(entry.ingredient_id)) fail(`duplicate ingredient mapping ${entry.ingredient_id}`)
    ingredientIds.add(entry.ingredient_id)
  }
  const resultRows = d1ResultRows(readJson(resultPath)).map((row) => ({ row_kind: String(row.row_kind), entity_id: Number(row.entity_id), entity_slug: String(row.entity_slug) })).sort((a, b) => a.row_kind.localeCompare(b.row_kind) || a.entity_id - b.entity_id || a.entity_slug.localeCompare(b.entity_slug))
  const rowKeys = resultRows.map((row) => `${row.row_kind}:${row.entity_id}:${row.entity_slug}`)
  if (resultRows.some((row) => !['ingredient', 'population'].includes(row.row_kind) || !Number.isInteger(row.entity_id) || row.entity_id <= 0 || !row.entity_slug.trim()) || new Set(rowKeys).size !== rowKeys.length) fail('Stage-4 D1 result contains invalid or duplicate identity rows')
  if (JSON.stringify(resultRows) !== JSON.stringify(resolver.result_rows)) fail('Stage-4 resolver result_rows differ from immutable D1 result artifact')
  const expectedPopulations = resultRows.filter((row) => row.row_kind === 'population').map((row) => ({ population_key: row.entity_slug, population_id: row.entity_id, population_slug: row.entity_slug }))
  const expectedIngredients = resultRows.filter((row) => row.row_kind === 'ingredient').map((row) => ({ ingredient_id: row.entity_id, ingredient_slug: row.entity_slug }))
  if (JSON.stringify(expectedPopulations) !== JSON.stringify(resolver.mappings) || JSON.stringify(expectedIngredients) !== JSON.stringify(resolver.ingredients)) fail('Stage-4 resolver mappings are not the exact D1 result rows')
  for (const record of evidenceBundle.records) {
    const projection = record.stack_projection
    if (record.stack_relevance?.candidate !== true) continue
    const mapping = byKey.get(projection?.population_key)
    if (!mapping || mapping.population_id !== projection.population_id || mapping.population_slug !== projection.population_slug) fail(`record ${record.record_id} population projection is not resolved by the supplied snapshot`)
    if (!ingredientIds.has(projection?.ingredient_id)) fail(`record ${record.record_id} ingredient projection is not resolved by the supplied D1 snapshot`)
  }
  return resolver
}

export function buildFactsGate({ coveragePlan, evidenceBundle, sourceFactsReviews, sourceArtifacts, validator, samplingSeed, extractorIds = new Set() }) {
  const expected = deriveExpectedFacts({ coveragePlan, evidenceBundle })
  if (expected.blocking_gaps.length) fail(`facts completeness blocked: ${expected.blocking_gaps.join(', ')}`)
  const bundleIds = new Set(evidenceBundle.records.map((record) => record.record_id))
  if (!sameSet(bundleIds, new Set(expected.required_record_ids))) fail('bundle contains facts outside or omits facts required by coverage')
  const reviewIds = strings(sourceFactsReviews.map((review) => review.review_id), 'source review IDs')
  const reviewerIds = new Set()
  let latestReview = -Infinity
  for (const review of sourceFactsReviews) {
    if (review.schema !== 'source_facts_review.v1' || review.status !== 'pass' || review.reviewer?.role !== 'source-facts-reviewer') fail(`invalid source facts review ${review.review_id ?? '(missing)'}`)
    const reviewerId = text(review.reviewer.id, `${review.review_id}.reviewer.id`)
    reviewerIds.add(reviewerId)
    if (extractorIds.has(reviewerId) || reviewerId === evidenceBundle.merged_by.id) fail(`reviewer ${reviewerId} is not independent`)
    latestReview = Math.max(latestReview, iso(review.reviewed_at, `${review.review_id}.reviewed_at`))
  }
  if (validator?.role !== 'evidence-bundle-gate-validator') fail('validator.role must equal evidence-bundle-gate-validator')
  const validatorId = text(validator.id, 'validator.id')
  if (extractorIds.has(validatorId) || reviewerIds.has(validatorId) || validatorId === evidenceBundle.merged_by.id) fail('gate validator must be independent from extractor, merger and reviewers')
  const validatedAt = iso(validator.validated_at, 'validator.validated_at')
  if (validatedAt < latestReview) fail('facts gate predates a source facts review')
  const standardIds = evidenceBundle.records.filter((record) => risksForRecord(record, coveragePlan).every((risk) => risk === 'standard')).map((record) => record.record_id)
  const expanded = sourceFactsReviews.some((review) => review.expanded_to_full_batch === true || (review.record_results ?? []).some((result) => result.findings?.length))
  const selected = deterministicStandardSample(standardIds, samplingSeed, expanded)
  const gate = {
    schema: 'facts_completeness_gate.v1', gate_id: text(validator.gate_id, 'validator.gate_id'), status: 'pass',
    coverage_plan_id: coveragePlan.coverage_plan_id, coverage_plan_hash: coveragePlan.content_hash,
    evidence_bundle_id: evidenceBundle.bundle_id, evidence_bundle_content_hash: evidenceBundle.content_hash,
    required_record_ids: expected.required_record_ids, validated_record_ids: expected.required_record_ids,
    source_facts_review_ids: sorted(reviewIds), sampling: { algorithm: 'sha256_rank_v1', seed: text(samplingSeed, 'sampling_seed'), eligible_standard_record_ids: sorted(standardIds), selected_record_ids: selected, expanded_to_full_batch: expanded },
    checks: { exact_record_set: 'pass', schema: 'pass', crossrefs: 'pass', hashes: 'pass', professional_approvals: 'pass', required_clusters: 'pass' }, open_gaps: [],
    validated_by: { role: 'evidence-bundle-gate-validator', id: validatorId }, validated_at: validator.validated_at,
  }
  const planForValidation = structuredClone(coveragePlan)
  planForValidation.facts_gate = { status: 'pass', evidence_bundle_id: evidenceBundle.bundle_id, evidence_bundle_content_hash: evidenceBundle.content_hash, required_record_ids: gate.required_record_ids, validated_record_ids: gate.validated_record_ids, source_facts_review_ids: gate.source_facts_review_ids, gate_artifact_id: gate.gate_id, missing_cluster_keys: [], blocking_gaps: [] }
  planForValidation.content_hash = coveragePlanContentHash(planForValidation)
  // The plan hash is immutable and excludes facts_gate, so this must remain equal.
  if (planForValidation.content_hash !== coveragePlan.content_hash) fail('coverage plan hash changed while attaching gate pointer')
  assertIssues(validateEvidenceBundle({ coveragePlan: planForValidation, evidenceBundle, sourceFactsReviews, factsCompletenessGate: gate, sourceArtifacts, file: 'evidence-pipeline-build' }), 'evidence pipeline validation failed')
  return { gate, coveragePlan: planForValidation, expected }
}

function visibleSource(source, planSource) {
  return { source_id: source.source_id, label: planSource.citation ?? planSource.title ?? source.source_id, source_url: planSource.source_url, locator: source.source_locator, source_content_hash: source.source_content_hash }
}
function writerFact(record) {
  return { record_id: record.record_id, source_id: record.source_id, cluster_keys: sorted(record.cluster_keys), claim: record.claim, result: record.result, quantity: record.quantity, safety: record.safety, uncertainty: record.uncertainty }
}

export function buildFactsPackages({ coveragePlan, evidenceBundle, gate, frameworkBindings, styleReferences = [] }) {
  const gateHash = artifactHash(gate, [])
  const sourceById = new Map(evidenceBundle.sources.map((source) => [source.source_id, source]))
  const planSourceById = new Map(coveragePlan.sources.map((source) => [source.source_id, source]))
  const stage2 = {}
  for (const candidate of coveragePlan.article_candidates.filter((item) => !['blocked', 'excluded'].includes(item.status))) {
    const sources = candidateSourceIds(candidate)
    const records = evidenceBundle.records.filter((record) => sources.has(record.source_id) && record.cluster_keys.some((key) => candidate.cluster_keys.includes(key)))
    if (!records.length) fail(`candidate ${candidate.article_id} has no exact facts mapping`)
    const payload = {
      schema: 'facts_package_for_stage2.v1', package_id: `stage2-${candidate.article_id}-${gate.gate_id}`, package_content_hash: '', article_id: candidate.article_id,
      substance: coveragePlan.substance, coverage_plan_id: coveragePlan.coverage_plan_id, coverage_plan_hash: coveragePlan.content_hash,
      evidence_bundle_id: evidenceBundle.bundle_id, evidence_bundle_content_hash: evidenceBundle.content_hash, facts_gate_id: gate.gate_id, facts_gate_hash: gateHash,
      framework: frameworkBindings.candidate_bindings[candidate.article_id], record_ids: sorted(records.map((record) => record.record_id)), facts: records.sort((a, b) => a.record_id.localeCompare(b.record_id)).map(writerFact),
      visible_sources: sorted(sources).map((id) => visibleSource(sourceById.get(id), planSourceById.get(id))),
    }
    payload.package_content_hash = artifactHash(payload)
    stage2[candidate.article_id] = payload
  }
  const allowedSources = new Set(coveragePlan.sources.filter((source) => !['BLOCKED', 'LOW_SIGNAL'].includes(source.stage15_label)).map((source) => source.source_id))
  const stage3Records = evidenceBundle.records.filter((record) => allowedSources.has(record.source_id))
  const stage3 = {
    schema: 'facts_package_for_stage3.v1', package_id: `stage3-${coveragePlan.coverage_plan_id}-${gate.gate_id}`, package_content_hash: '', substance: coveragePlan.substance,
    coverage_plan_id: coveragePlan.coverage_plan_id, coverage_plan_hash: coveragePlan.content_hash, evidence_bundle_id: evidenceBundle.bundle_id, evidence_bundle_content_hash: evidenceBundle.content_hash,
    facts_gate_id: gate.gate_id, facts_gate_hash: gateHash, archetype: coveragePlan.stage3_archetype_decision.archetype, framework: frameworkBindings.stage3_binding,
    style_references: styleReferences.map((entry, index) => ({ id: text(entry.id, `style_references[${index}].id`), version: text(entry.version, `style_references[${index}].version`), path: text(entry.path, `style_references[${index}].path`), content_hash: text(entry.content_hash, `style_references[${index}].content_hash`) })),
    record_ids: sorted(stage3Records.map((record) => record.record_id)), facts: stage3Records.sort((a, b) => a.record_id.localeCompare(b.record_id)).map(writerFact),
    visible_sources: sorted(new Set(stage3Records.map((record) => record.source_id))).map((id) => visibleSource(sourceById.get(id), planSourceById.get(id))),
    input_gaps: coveragePlan.clusters.filter((cluster) => cluster.status === 'input_gap').map((cluster) => ({ cluster_key: cluster.cluster_key, label: 'INPUT_GAP', reason: cluster.reason })),
  }
  stage3.package_content_hash = artifactHash(stage3)
  return { stage2, stage3 }
}

export function validateFactsPackageForImport({ packageValue, stage, articleId, coveragePlan, evidenceBundle, factsGate }) {
  const schema = stage === 'stage2' ? 'facts_package_for_stage2.v1' : 'facts_package_for_stage3.v1'
  object(packageValue, `${stage} facts package`)
  if (packageValue.schema !== schema) fail(`${stage} facts package schema must equal ${schema}`)
  if (packageValue.package_content_hash !== artifactHash(packageValue)) fail(`${stage} facts package content hash is stale`)
  if (packageValue.coverage_plan_id !== coveragePlan.coverage_plan_id || packageValue.coverage_plan_hash !== coveragePlan.content_hash) fail(`${stage} facts package has stale coverage binding`)
  if (packageValue.evidence_bundle_id !== evidenceBundle.bundle_id || packageValue.evidence_bundle_content_hash !== evidenceBundle.content_hash) fail(`${stage} facts package has stale bundle binding`)
  if (packageValue.facts_gate_id !== factsGate.gate_id || packageValue.facts_gate_hash !== artifactHash(factsGate, [])) fail(`${stage} facts package has stale gate binding`)
  if (stage === 'stage2' && packageValue.article_id !== articleId) fail(`Stage-2 facts package belongs to another candidate`)
  const packageIds = strings(packageValue.record_ids, `${stage} facts package record_ids`)
  const factIds = strings((packageValue.facts ?? []).map((fact) => fact.record_id), `${stage} facts package fact IDs`)
  if (!sameSet(new Set(packageIds), new Set(factIds))) fail(`${stage} facts package record/fact sets differ`)
  const records = new Map(evidenceBundle.records.map((record) => [record.record_id, record]))
  for (const fact of packageValue.facts) {
    const record = records.get(fact.record_id)
    if (!record || JSON.stringify(canonicalize(fact)) !== JSON.stringify(canonicalize(writerFact(record)))) fail(`${stage} facts package fact ${fact.record_id} differs from gated evidence`)
  }
  if (stage === 'stage2') {
    const candidate = coveragePlan.article_candidates.find((entry) => entry.article_id === articleId)
    if (!candidate) fail(`unknown Stage-2 candidate ${articleId}`)
    const allowedSources = candidateSourceIds(candidate)
    const expected = evidenceBundle.records.filter((record) => allowedSources.has(record.source_id) && record.cluster_keys.some((key) => candidate.cluster_keys.includes(key))).map((record) => record.record_id)
    if (!sameSet(new Set(packageIds), new Set(expected))) fail(`Stage-2 facts package does not exactly map candidate facts`)
  } else if (!sameSet(new Set(packageIds), new Set(factsGate.required_record_ids))) fail('Stage-3 facts package must contain the complete gated record set')
  return packageValue
}

export function visiblePayloadHash(payload) {
  const normalized = normalizeVisiblePayload(payload)
  return artifactHash(normalized, [])
}
export function normalizeVisiblePayload(payload) {
  object(payload, 'visible payload')
  const sources = Array.isArray(payload.sources) ? payload.sources : fail('visible payload sources must be an array')
  return { schema: 'article_visible_payload.v1', slug: text(payload.slug, 'visible payload slug'), title: text(payload.title, 'visible payload title'), summary: text(payload.summary, 'visible payload summary'), body: text(payload.body, 'visible payload body'), conclusion: text(payload.conclusion, 'visible payload conclusion'), sources: sources.map((source, index) => ({ source_id: text(source.source_id ?? source.source_key, `sources[${index}].source_id`), label: text(source.label, `sources[${index}].label`), url: text(source.url, `sources[${index}].url`) })) }
}
export function lintVisiblePayload(payload, { sourceUrlPolicy = 'external_originals' } = {}) {
  const normalized = normalizeVisiblePayload(payload)
  if (!['external_originals', 'internal_stage2_only'].includes(sourceUrlPolicy)) fail('visible payload source URL policy is invalid')
  const errors = []
  const visibleFields = [
    ...['title', 'summary', 'body', 'conclusion'].map((key) => [key, normalized[key]]),
    ...normalized.sources.map((source, index) => [`sources[${index}].label`, source.label]),
  ]
  const mojibake = /\uFFFD|\u00C3[\u0080-\u00BF]|\u00C2[\u0080-\u00BF]|\u00E2(?:\u0080|\u0082|\u0084)/u
  const workflow = /\b(?:Stage[- ]?[0-4](?:\.5)?|INPUT_GAP|Grafikbriefing|PLACEHOLDER|Pipeline(?:-Handoff)?|Handoff|Maschinenhinweis|f\u00FCr die Maschine|Dieser Artikel(?: ist intern)?)\b/iu
  for (const [key, value] of visibleFields) {
    if (mojibake.test(value) || workflow.test(value)) errors.push(`${key} contains mojibake or workflow/placeholder language`)
  }
  const headings = [...normalized.body.matchAll(/^##\s+.+$/gm)]
  for (let index = 0; index < headings.length; index += 1) {
    const start = (headings[index].index ?? 0) + headings[index][0].length
    const end = index + 1 < headings.length ? headings[index + 1].index : normalized.body.length
    const headingTitle = headings[index][0].replace(/^##\s+/, '').trim()
    const rawSection = normalized.body.slice(start, end).trim()
    if (headingTitle === 'Quellen' && rawSection === '<!-- sources:auto -->') continue
    if (!normalized.body.slice(start, end).replace(/<[^>]+>/g, '').replace(/[\s#>*_|:-]/g, '')) {
      errors.push('body contains an empty H2 section')
      break
    }
  }
  const ids = new Set()
  for (const source of normalized.sources) {
    if (ids.has(source.source_id)) errors.push(`duplicate visible source ${source.source_id}`)
    ids.add(source.source_id)
    if (sourceUrlPolicy === 'internal_stage2_only') {
      if (!/^\/wissen\/[a-z0-9-]+$/.test(source.url)) errors.push(`source ${source.source_id} URL must target an internal Stage-2 knowledge article`)
    } else {
      try { const url = new URL(source.url); if (!['http:', 'https:'].includes(url.protocol)) errors.push(`source ${source.source_id} URL must be HTTP(S)`) } catch { errors.push(`source ${source.source_id} URL is invalid`) }
    }
  }
  return { payload: normalized, hash: visiblePayloadHash(normalized), errors }
}

const QUANTITY_TOKEN = /(?<![\p{L}\p{N}_])(\d{1,3}(?:[.\s]\d{3})+|\d+(?:[.,]\d+)?)\s*(\u00B5g|ug|mcg|mg|kg|g|ml|l|IE|IU|%|mmol|mol|KBE|CFU)(?![\p{L}\p{N}_])/giu

function normalizeQuantityToken(rawValue, rawUnit) {
  let number = String(rawValue ?? '').trim().replaceAll(/\s+/g, '')
  if (!number) return null
  if (/^\d{1,3}(?:\.\d{3})+$/.test(number)) number = number.replaceAll('.', '')
  else number = number.replace(',', '.')
  const numeric = Number(number)
  if (!Number.isFinite(numeric)) return null
  let unit = String(rawUnit ?? '').trim().toLowerCase()
  if (unit === 'ug' || unit === 'mcg') unit = '\u00B5g'
  if (!/^(?:\u00B5g|mg|kg|g|ml|l|ie|iu|%|mmol|mol|kbe|cfu)$/u.test(unit)) return null
  return `${numeric} ${unit}`
}

function normalizedNumberTokens(value) {
  return [...String(value).matchAll(QUANTITY_TOKEN)]
    .map((match) => normalizeQuantityToken(match[1], match[2]))
    .filter(Boolean)
}

function structuredQuantityTokens(value, tokens = new Set()) {
  if (Array.isArray(value)) {
    for (const entry of value) structuredQuantityTokens(entry, tokens)
    return tokens
  }
  if (!value || typeof value !== 'object') return tokens
  if (Object.hasOwn(value, 'value') && Object.hasOwn(value, 'unit')) {
    const token = normalizeQuantityToken(value.value, value.unit)
    if (token) tokens.add(token)
  }
  for (const nested of Object.values(value)) structuredQuantityTokens(nested, tokens)
  return tokens
}

const POPULATION_FORMS = [
  [/\bErwachsen(?:e|en|er|em)\b/giu, 'erwachsene'],
  [/\bKind(?:er|ern)\b/giu, 'kinder'],
  [/\bJugendlich(?:e|en|er|em)\b/giu, 'jugendliche'],
  [/\bSchwanger(?:e|en|er)\b/giu, 'schwangere'],
  [/\bStillend(?:e|en|er)\b/giu, 'stillende'],
  [/\b(?:Senioren|Seniorinnen)\b/giu, 'senioren'],
  [/\bM\u00E4nnern?\b/giu, 'm\u00E4nner'],
  [/\bFrauen\b/giu, 'frauen'],
]

function populationTokens(value) {
  const textValue = String(value)
  const tokens = []
  for (const [pattern, token] of POPULATION_FORMS) {
    if (pattern.test(textValue)) tokens.push(token)
    pattern.lastIndex = 0
  }
  const explicitAges = [...textValue.matchAll(/(?<!\d)(\d{1,3})-J\u00E4hrig(?:e|en|er|em)\b/giu)].map((match) => Number(match[1]))
  if (explicitAges.some((age) => age >= 18)) tokens.push('erwachsene')
  return tokens
}

const HIGH_RISK_CLAIM = /\b(?:heil(?:t|en)|therapier(?:t|en)|behandel(?:t|n)|verhinder(?:t|n)|beseitig(?:t|en)|garantier(?:t|en)|sicher vor|ohne Risiko|toxisch|Gegenanzeige|Kontraindikation|\u00DCberdosierung)\b/iu

function isNonAffirmativeRiskSentence(sentence, match) {
  const before = sentence.slice(0, match.index).toLowerCase()
  const after = sentence.slice((match.index ?? 0) + match[0].length).toLowerCase()
  if (/^verhinder/u.test(match[0].toLowerCase()) && /^\s*,?\s*aus\b[^.!?]{0,160}\b(?:[\p{L}-]*aussage|schlussfolgerung)\b[^.!?]{0,80}\babzuleiten\b/u.test(after)) return true
  if (/\b(?:kein(?:e|en|er|es)?\s+(?:nachweis|beleg|beweis)|nicht\s+(?:belegt|nachgewiesen|gesichert|best\u00E4tigt)|weder\s+belegt\s+noch|unklar\s*,?\s+ob|offen\s*,?\s+ob)\b/u.test(sentence.toLowerCase())) return true
  if (/(?:\bnicht|\bkein(?:e|en|er|es)?|\bkeineswegs)\s*$/u.test(before)) return true
  if (/^\s*(?:aber\s+)?(?:nicht(?!\s+nur\b)|kein(?:e|en|er|es)?\b|keineswegs\b)/u.test(after)) return true
  if (/^[^.!?]{0,60}\b(?:nicht(?!\s+nur\b)|keineswegs)\b/u.test(after)) return true
  if (/^[^.!?]{0,60}\b(?:ist|bleibt|war)\s+(?:weiterhin\s+)?unklar\b/u.test(after)) return true
  return false
}

function riskySentences(value) {
  return String(value).split(/(?<=[.!?])\s+|\n+/).map((entry) => entry.trim()).filter((entry) => {
    const match = HIGH_RISK_CLAIM.exec(entry)
    HIGH_RISK_CLAIM.lastIndex = 0
    return match && !isNonAffirmativeRiskSentence(entry, match)
  })
}

export function derivePublicationFidelitySignals({ visiblePayload, facts }) {
  const visibleText = `${visiblePayload.title}\n${visiblePayload.summary}\n${visiblePayload.body}\n${visiblePayload.conclusion}`
  const packageText = JSON.stringify(facts)
  const visibleNumbers = sorted(new Set(normalizedNumberTokens(visibleText)))
  const packageNumbers = new Set([...normalizedNumberTokens(packageText), ...structuredQuantityTokens(facts)])
  const visiblePopulations = sorted(new Set(populationTokens(visibleText)))
  const packagePopulations = new Set(populationTokens(packageText))
  return {
    visible_numbers: visibleNumbers,
    package_numbers: sorted(packageNumbers),
    unsupported_numbers: visibleNumbers.filter((token) => !packageNumbers.has(token)),
    visible_populations: visiblePopulations,
    package_populations: sorted(packagePopulations),
    unsupported_populations: visiblePopulations.filter((token) => !packagePopulations.has(token)),
    affirmative_high_risk_claims: riskySentences(visibleText),
  }
}

export function validatePublicationBatch({ batch, visiblePayloads, factsPackages, factsGate, pipelineLock }) {
  object(batch, 'publication batch')
  if (batch.schema !== 'publication_batch.v1') fail('publication batch schema must equal publication_batch.v1')
  text(batch.batch_id, 'publication batch.batch_id')
  const reviewedAt = iso(batch.reviewed_at, 'publication batch.reviewed_at')
  const lowerBound = Math.max(
    factsGate ? iso(factsGate.validated_at, 'facts gate.validated_at') : -Infinity,
    pipelineLock ? iso(pipelineLock.created_at, 'pipeline lock.created_at') : -Infinity,
  )
  if (reviewedAt <= lowerBound) fail('publication batch must postdate facts gate, packages and pipeline lock')
  const articles = Array.isArray(batch.articles) ? batch.articles : fail('publication batch articles must be an array')
  if (!articles.length) fail('publication batch articles must not be empty')
  const keys = strings(articles.map((article) => article.article_id), 'publication batch article IDs')
  if (!sameSet(new Set(keys), new Set(Object.keys(visiblePayloads)))) fail('publication batch scope must exactly match supplied visible payloads')
  for (const article of articles) {
    const lint = lintVisiblePayload(visiblePayloads[article.article_id])
    if (lint.errors.length) fail(`${article.article_id} visible payload lint failed: ${lint.errors.join('; ')}`)
    if (article.visible_payload_hash !== lint.hash) fail(`${article.article_id} visible payload hash is stale`)
    const contentLint = object(article.content_lint, `${article.article_id}.content_lint`)
    const lintAt = iso(contentLint.validated_at, `${article.article_id}.content_lint.validated_at`)
    if (contentLint.status !== 'PASS' || contentLint.validator !== 'content-lint.v1' || contentLint.visible_payload_hash !== lint.hash || lintAt <= lowerBound || lintAt > reviewedAt) fail(`${article.article_id} content lint binding/time is invalid`)
    const pkg = factsPackages[article.article_id]
    if (!pkg || article.facts_package_hash !== pkg.package_content_hash) fail(`${article.article_id} facts package binding is stale`)
    if (!sameSet(new Set(lint.payload.sources.map((source) => source.source_id)), new Set(pkg.visible_sources.map((source) => source.source_id)))) fail(`${article.article_id} visible source mapping differs from facts package`)
    const reader = object(article.reader_review, `${article.article_id}.reader_review`)
    if (reader.status !== 'PASS' || reader.q1 !== 'Ja' || reader.q2 !== 'Ja' || reader.q3 !== 'Nein') fail(`${article.article_id} reader acceptance failed`)
    if (reader.reviewer?.role !== 'article-reader-acceptance-reviewer') fail(`${article.article_id} reader reviewer role is invalid`)
    const readerId = text(reader.reviewer.id, `${article.article_id}.reader reviewer id`)
    const readerAt = iso(reader.reviewed_at, `${article.article_id}.reader reviewed_at`)
    if (reader.visible_payload_hash !== lint.hash || readerAt <= lowerBound || readerAt > reviewedAt) fail(`${article.article_id} reader review binding/time is invalid`)
    const fidelity = object(article.facts_fidelity_review, `${article.article_id}.facts_fidelity_review`)
    if (fidelity.status !== 'PASS' || fidelity.reviewer?.role !== 'article-facts-fidelity-reviewer') fail(`${article.article_id} facts fidelity review is invalid`)
    const writerId = text(article.writer_id, `${article.article_id}.writer_id`)
    const fidelityId = text(fidelity.reviewer.id, `${article.article_id}.fidelity reviewer id`)
    if (fidelityId === readerId || fidelityId === writerId || readerId === writerId) fail(`${article.article_id} writer, reader and fidelity reviewers must be independent`)
    const fidelityAt = iso(fidelity.reviewed_at, `${article.article_id}.fidelity reviewed_at`)
    if (fidelityAt <= lowerBound || fidelityAt > reviewedAt || fidelity.visible_payload_hash !== lint.hash || fidelity.facts_package_hash !== pkg.package_content_hash) fail(`${article.article_id} facts fidelity binding/time is invalid`)
    const checks = object(fidelity.checks, `${article.article_id}.facts_fidelity_review.checks`)
    for (const key of ['numbers', 'safety', 'populations', 'source_mapping', 'unsupported_high_risk_claims']) if (checks[key]?.status !== 'PASS') fail(`${article.article_id} fidelity check ${key} must PASS`)
    const signals = derivePublicationFidelitySignals({ visiblePayload: lint.payload, facts: pkg.facts })
    const visibleNumbers = signals.visible_numbers
    const unsupportedNumbers = signals.unsupported_numbers
    if (unsupportedNumbers.length || JSON.stringify(checks.numbers.visible_tokens) !== JSON.stringify(visibleNumbers) || !sameSet(new Set(checks.numbers.unsupported_tokens ?? []), new Set(unsupportedNumbers))) fail(`${article.article_id} number fidelity is unsupported or falsely reported`)
    const visiblePopulations = signals.visible_populations
    const unsupportedPopulations = signals.unsupported_populations
    if (unsupportedPopulations.length || JSON.stringify(checks.populations.visible_tokens) !== JSON.stringify(visiblePopulations) || (checks.populations.unsupported_tokens ?? []).length) fail(`${article.article_id} population fidelity is unsupported or falsely reported`)
    const risks = signals.affirmative_high_risk_claims
    const support = Array.isArray(fidelity.claim_support) ? fidelity.claim_support : []
    for (const sentence of risks) {
      const mapping = support.find((entry) => entry.visible_claim === sentence)
      if (!mapping || !Array.isArray(mapping.record_ids) || !mapping.record_ids.length || mapping.record_ids.some((id) => !pkg.record_ids.includes(id))) fail(`${article.article_id} unsupported high-risk claim: ${sentence}`)
      const records = pkg.facts.filter((fact) => mapping.record_ids.includes(fact.record_id))
      if (!records.some((fact) => JSON.stringify(fact).toLowerCase().includes(sentence.toLowerCase()))) fail(`${article.article_id} high-risk claim is not present in its cited facts: ${sentence}`)
    }
    if (JSON.stringify(checks.unsupported_high_risk_claims.claims ?? []) !== JSON.stringify(risks) || (checks.unsupported_high_risk_claims.unsupported ?? []).length) fail(`${article.article_id} high-risk claim check is stale or incomplete`)
    if (JSON.stringify(checks.safety.visible_claims ?? []) !== JSON.stringify(risks) || (checks.safety.unsupported_claims ?? []).length) fail(`${article.article_id} safety fidelity detail is stale or incomplete`)
    const sourceIds = lint.payload.sources.map((source) => source.source_id)
    if (!sameSet(new Set(checks.source_mapping.visible_source_ids ?? []), new Set(sourceIds))) fail(`${article.article_id} source fidelity detail is stale`)
  }
  return { status: 'PASS', batch_id: batch.batch_id, reviewed_at: batch.reviewed_at }
}

export function loadPipelineManifest(manifestPath) {
  const absolute = resolve(manifestPath), baseDir = dirname(absolute), manifest = readJson(absolute)
  if (manifest.schema !== 'evidence_pipeline_build.v1') fail('manifest.schema must equal evidence_pipeline_build.v1')
  if (manifest.contract_profile !== 'legacy_v1') fail('evidence_pipeline_build.v1 requires explicit contract_profile=legacy_v1')
  const load = (path, label) => readJson(resolveFrom(baseDir, text(path, label)))
  const coveragePlan = load(manifest.coverage_plan_path, 'coverage_plan_path')
  assertIssues(validateCoveragePlan(coveragePlan, manifest.coverage_plan_path), 'coverage plan invalid')
  if (coveragePlan.content_hash !== coveragePlanContentHash(coveragePlan)) fail('coverage plan content hash is stale')
  const mode = manifest.mode ?? 'production'
  if (!['production', 'test'].includes(mode) || (mode === 'test' && manifest.allow_isolated_test_catalog !== true)) fail('manifest mode must be production, or explicit isolated test mode')
  const catalogPath = manifest.framework_catalog_path ? resolveFrom(baseDir, manifest.framework_catalog_path) : CANONICAL_FRAMEWORK_CATALOG_PATH
  if (mode === 'production' && catalogPath !== CANONICAL_FRAMEWORK_CATALOG_PATH) fail('production manifest framework_catalog_path must be the canonical repository catalog')
  const catalog = readJson(catalogPath)
  const shardPaths = strings(manifest.source_evidence_shard_paths, 'source_evidence_shard_paths')
  const reviewPaths = strings(manifest.source_facts_review_paths, 'source_facts_review_paths')
  const absoluteShardPaths = shardPaths.map((path) => resolveFrom(baseDir, path))
  const absoluteReviewPaths = reviewPaths.map((path) => resolveFrom(baseDir, path))
  const shards = absoluteShardPaths.map((path) => readJson(path))
  const sourceFactsReviews = absoluteReviewPaths.map((path) => readJson(path))
  const sourceArtifacts = {}
  const sourceArtifactPaths = {}
  object(manifest.source_artifacts, 'source_artifacts')
  for (const [id, path] of Object.entries(manifest.source_artifacts)) {
    sourceArtifactPaths[id] = resolveFrom(baseDir, text(path, `source_artifacts.${id}`))
    sourceArtifacts[id] = readFileSync(sourceArtifactPaths[id])
  }
  const populationResolver = manifest.population_resolver_path ? load(manifest.population_resolver_path, 'population_resolver_path') : null
  return { absolute, baseDir, mode, manifest, coveragePlan, catalog, catalogPath, coveragePlanPath: resolveFrom(baseDir, manifest.coverage_plan_path), shardPaths: absoluteShardPaths, reviewPaths: absoluteReviewPaths, shards, sourceFactsReviews, sourceArtifacts, sourceArtifactPaths, populationResolver, populationResolverPath: manifest.population_resolver_path ? resolveFrom(baseDir, manifest.population_resolver_path) : null }
}

function portablePath(path, mode) {
  const absolute = resolve(path)
  if (mode === 'test') return absolute
  const rel = absolute.slice(REPO_ROOT.length + 1)
  if (absolute === REPO_ROOT || rel.startsWith('..') || isAbsolute(rel)) fail(`production lock artifact is outside repository: ${absolute}`)
  return rel.replaceAll('\\', '/')
}
function lockEntry(path, mode, extra = {}) { return { ...extra, path: portablePath(path, mode), byte_hash: sha256Bytes(readFileSync(path)) } }
function lockResolve(path, mode) { return mode === 'test' && isAbsolute(path) ? resolve(path) : resolve(REPO_ROOT, path) }

export function buildEvidencePipelineLock({ input, outputDir, result, styleResolution, createdAt }) {
  iso(createdAt, 'pipeline lock.created_at')
  const stage2Packages = Object.fromEntries(Object.keys(result.packages.stage2).sort().map((articleId) => [articleId, lockEntry(resolve(outputDir, 'stage2-packages', `${articleId}.json`), input.mode, { package_hash: result.packages.stage2[articleId].package_content_hash })]))
  const ownerPilot = []
  for (const entry of input.catalog.frameworks ?? []) for (const key of ['owner_approval_artifact', 'pilot_artifact']) if (entry[key]?.artifact_path) ownerPilot.push(lockEntry(resolve(REPO_ROOT, entry[key].artifact_path), input.mode, { framework_id: entry.framework_id, artifact_type: key, declared_hash: entry[key].artifact_hash }))
  const lock = {
    schema: 'evidence_pipeline_lock.v1', lock_id: `${result.bundle.bundle_id}:${result.gate.gate_id}`, lock_hash: '', mode: input.mode, created_at: createdAt,
    canonical_framework_catalog: lockEntry(input.catalogPath, input.mode, { catalog_version: input.catalog.catalog_version }),
    style_snapshot: lockEntry(styleResolution.snapshot_path, input.mode, { snapshot_hash: styleResolution.snapshot_hash }),
    style_references: styleResolution.references.map((entry) => lockEntry(resolve(REPO_ROOT, entry.path), input.mode, entry)), owner_pilot_artifacts: ownerPilot,
    coverage_plan: lockEntry(resolve(outputDir, 'coverage-plan.gated.json'), input.mode, { content_hash: result.coveragePlan.content_hash }),
    extraction_shards: input.shardPaths.map((path, index) => lockEntry(path, input.mode, { shard_id: input.shards[index].shard_id, content_hash: input.shards[index].content_hash })),
    source_artifacts: Object.entries(input.sourceArtifactPaths).sort().map(([sourceId, path]) => lockEntry(path, input.mode, { source_id: sourceId })),
    evidence_bundle: lockEntry(resolve(outputDir, 'source-evidence-bundle.json'), input.mode, { bundle_id: result.bundle.bundle_id, content_hash: result.bundle.content_hash }),
    source_facts_reviews: input.reviewPaths.map((path, index) => lockEntry(path, input.mode, { review_id: input.sourceFactsReviews[index].review_id })),
    facts_gate: lockEntry(resolve(outputDir, 'facts-completeness-gate.json'), input.mode, { gate_id: result.gate.gate_id, gate_hash: artifactHash(result.gate, []) }),
    stage2_packages: stage2Packages,
    stage3_package: lockEntry(resolve(outputDir, 'facts-package-stage3.json'), input.mode, { package_hash: result.packages.stage3.package_content_hash }),
    population_resolver: input.populationResolverPath ? lockEntry(input.populationResolverPath, input.mode, { content_hash: input.populationResolver.content_hash }) : null,
    stage4_query: input.populationResolver ? lockEntry(input.mode === 'test' && isAbsolute(input.populationResolver.provenance.query_path) ? input.populationResolver.provenance.query_path : resolve(REPO_ROOT, input.populationResolver.provenance.query_path), input.mode, { declared_hash: input.populationResolver.provenance.query_hash }) : null,
    stage4_result_artifact: input.populationResolver ? lockEntry(input.mode === 'test' && isAbsolute(input.populationResolver.provenance.result_artifact_path) ? input.populationResolver.provenance.result_artifact_path : resolve(REPO_ROOT, input.populationResolver.provenance.result_artifact_path), input.mode, { declared_hash: input.populationResolver.provenance.result_hash }) : null,
    stage4_attestation: input.populationResolver?.provenance.attestation_path ? lockEntry(resolve(REPO_ROOT, input.populationResolver.provenance.attestation_path), input.mode, { declared_hash: input.populationResolver.provenance.attestation_hash }) : null,
    stage4_auth_artifact: input.populationResolver?.provenance.attestation_path ? (() => { const a = readJson(resolve(REPO_ROOT, input.populationResolver.provenance.attestation_path)); return lockEntry(resolve(REPO_ROOT, a.auth_artifact_path), input.mode, { declared_hash: a.auth_stdout_byte_hash }) })() : null,
    build_parameters: { bundle_id: input.manifest.bundle_id, merger: input.manifest.merger, validator: input.manifest.validator, sampling_seed: input.manifest.sampling_seed },
  }
  lock.lock_hash = artifactHash(lock, ['lock_hash'])
  return lock
}

function verifyLockEntry(entry, mode, label) {
  object(entry, label)
  const path = lockResolve(text(entry.path, `${label}.path`), mode)
  if (!existsSync(path) || sha256Bytes(readFileSync(path)) !== entry.byte_hash) fail(`${label} path/byte hash mismatch`)
  return { path, value: path.endsWith('.json') ? readJson(path) : null, bytes: readFileSync(path) }
}

export function validateEvidencePipelineLock({ lockPath, allowTest = false }) {
  const lock = readJson(resolve(lockPath))
  if (lock.schema !== 'evidence_pipeline_lock.v1' || lock.lock_hash !== artifactHash(lock, ['lock_hash'])) fail('pipeline lock schema/hash is invalid')
  if (lock.mode === 'test' && !allowTest) fail('test pipeline lock requires explicit importer opt-in')
  if (!['production', 'test'].includes(lock.mode)) fail('pipeline lock mode is invalid')
  iso(lock.created_at, 'pipeline lock.created_at')
  const catalogArtifact = verifyLockEntry(lock.canonical_framework_catalog, lock.mode, 'framework catalog')
  if (lock.mode === 'production' && catalogArtifact.path !== CANONICAL_FRAMEWORK_CATALOG_PATH) fail('production lock is not bound to canonical framework catalog')
  const styleArtifact = verifyLockEntry(lock.style_snapshot, lock.mode, 'style snapshot')
  if (lock.mode === 'production' && styleArtifact.path !== CANONICAL_STYLE_SNAPSHOT_PATH) fail('production lock is not bound to canonical style snapshot')
  for (const [index, entry] of (lock.style_references ?? []).entries()) verifyLockEntry(entry, lock.mode, `style reference ${index}`)
  for (const [index, entry] of (lock.owner_pilot_artifacts ?? []).entries()) { const artifact = verifyLockEntry(entry, lock.mode, `owner/pilot artifact ${index}`); if (entry.declared_hash !== entry.byte_hash) fail('owner/pilot declared hash differs from actual bytes') }
  const coverageArtifact = verifyLockEntry(lock.coverage_plan, lock.mode, 'coverage plan'), coveragePlan = coverageArtifact.value
  const bundleArtifact = verifyLockEntry(lock.evidence_bundle, lock.mode, 'evidence bundle'), evidenceBundle = bundleArtifact.value
  const gateArtifact = verifyLockEntry(lock.facts_gate, lock.mode, 'facts gate'), factsGate = gateArtifact.value
  const shardArtifacts = lock.extraction_shards.map((entry, index) => verifyLockEntry(entry, lock.mode, `extraction shard ${index}`)), shards = shardArtifacts.map((entry) => entry.value)
  const reviewArtifacts = lock.source_facts_reviews.map((entry, index) => verifyLockEntry(entry, lock.mode, `source review ${index}`)), sourceFactsReviews = reviewArtifacts.map((entry) => entry.value)
  const verifiedSourceArtifacts = lock.source_artifacts.map((entry, index) => ({ entry, artifact: verifyLockEntry(entry, lock.mode, `source artifact ${index}`) }))
  const sourceArtifacts = Object.fromEntries(verifiedSourceArtifacts.map(({ entry, artifact }) => [entry.source_id, artifact.bytes]))
  const sourceArtifactPaths = Object.fromEntries(verifiedSourceArtifacts.map(({ entry, artifact }) => [entry.source_id, artifact.path]))
  const catalog = catalogArtifact.value
  const bindings = resolveFrameworkCatalog({ catalog, repoRoot: REPO_ROOT, coveragePlan, catalogPath: catalogArtifact.path, mode: lock.mode })
  const styleResolution = resolveCanonicalStyleReferences({ repoRoot: REPO_ROOT, snapshotPath: styleArtifact.path, mode: lock.mode })
  const merged = mergeSourceEvidenceShards({ coveragePlan, shards, sourceArtifacts, sourceArtifactPaths, merger: lock.build_parameters.merger, bundleId: lock.build_parameters.bundle_id, mode: lock.mode })
  if (JSON.stringify(canonicalize(merged.bundle)) !== JSON.stringify(canonicalize(evidenceBundle))) fail('pipeline lock bundle differs from deterministic shard merge')
  if (lock.population_resolver) {
    verifyLockEntry(lock.stage4_query, lock.mode, 'Stage-4 canonical query'); verifyLockEntry(lock.stage4_result_artifact, lock.mode, 'Stage-4 result artifact')
    if (lock.stage4_query.declared_hash !== lock.stage4_query.byte_hash || lock.stage4_result_artifact.declared_hash !== lock.stage4_result_artifact.byte_hash) fail('Stage-4 lock declared hashes differ from actual bytes')
    if (lock.mode === 'production') {
      verifyLockEntry(lock.stage4_attestation, lock.mode, 'Stage-4 execution attestation'); verifyLockEntry(lock.stage4_auth_artifact, lock.mode, 'Stage-4 authentication artifact')
      if (lock.stage4_attestation.declared_hash !== lock.stage4_attestation.byte_hash || lock.stage4_auth_artifact.declared_hash !== lock.stage4_auth_artifact.byte_hash) fail('Stage-4 attestation/auth lock hashes differ from actual bytes')
    }
  }
  validatePopulationResolver({ coveragePlan, evidenceBundle, resolver: lock.population_resolver ? verifyLockEntry(lock.population_resolver, lock.mode, 'population resolver').value : null, mode: lock.mode })
  const built = buildFactsGate({ coveragePlan, evidenceBundle, sourceFactsReviews, sourceArtifacts, validator: lock.build_parameters.validator, samplingSeed: lock.build_parameters.sampling_seed, extractorIds: merged.extractorIds })
  if (JSON.stringify(canonicalize(built.gate)) !== JSON.stringify(canonicalize(factsGate))) fail('pipeline lock facts gate differs from deterministic validation')
  const packages = buildFactsPackages({ coveragePlan: built.coveragePlan, evidenceBundle, gate: factsGate, frameworkBindings: bindings, styleReferences: styleResolution.references })
  const stage2 = {}
  for (const [articleId, entry] of Object.entries(lock.stage2_packages)) { const value = verifyLockEntry(entry, lock.mode, `Stage-2 package ${articleId}`).value; validateFactsPackageForImport({ packageValue: value, stage: 'stage2', articleId, coveragePlan, evidenceBundle, factsGate }); if (value.package_content_hash !== packages.stage2[articleId]?.package_content_hash) fail(`Stage-2 package ${articleId} differs from deterministic package`); stage2[articleId] = value }
  const stage3 = verifyLockEntry(lock.stage3_package, lock.mode, 'Stage-3 package').value
  validateFactsPackageForImport({ packageValue: stage3, stage: 'stage3', coveragePlan, evidenceBundle, factsGate })
  if (stage3.package_content_hash !== packages.stage3.package_content_hash) fail('Stage-3 package differs from deterministic package')
  return { lock, coveragePlan: built.coveragePlan, evidenceBundle, sourceFactsReviews, factsGate, packages: { stage2, stage3 }, sourceArtifacts }
}
