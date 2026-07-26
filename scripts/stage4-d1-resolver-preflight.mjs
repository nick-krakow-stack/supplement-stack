#!/usr/bin/env node
import { existsSync, readFileSync, realpathSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'
import { artifactHash } from './lib/evidence-pipeline-builder.mjs'
import { sha256Bytes } from './lib/content-validation.mjs'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const QUERY = resolve(ROOT, 'scripts/sql/stage4-resolver-preflight.sql')
const WRANGLER = resolve(ROOT, 'wrangler.toml')

function required(value, label) { if (!String(value ?? '').trim()) throw new Error(`${label} is required`); return String(value).trim() }
function strictIso(value, label) { const text = required(value, label); if (!Number.isFinite(Date.parse(text)) || new Date(Date.parse(text)).toISOString() !== text) throw new Error(`${label} must be strict ISO-8601 UTC`); return text }
function readJson(path) { return JSON.parse(readFileSync(path, 'utf8')) }
function rowsFromD1(value) {
  if (Array.isArray(value) && value[0]?.results) return value[0].results
  if (Array.isArray(value?.result) && value.result[0]?.results) return value.result[0].results
  if (Array.isArray(value?.results)) return value.results
  throw new Error('D1 result JSON does not contain a results array')
}
function canonicalRows(rows) {
  const seen = new Set()
  return rows.map((row, index) => {
    const kind = required(row.row_kind, `results[${index}].row_kind`)
    const id = Number(row.entity_id)
    const slug = required(row.entity_slug, `results[${index}].entity_slug`)
    if (!['ingredient', 'population'].includes(kind) || !Number.isInteger(id) || id <= 0) throw new Error(`results[${index}] is invalid`)
    const key = `${kind}:${id}:${slug}`; if (seen.has(key)) throw new Error(`duplicate D1 result row ${key}`); seen.add(key)
    return { row_kind: kind, entity_id: id, entity_slug: slug }
  }).sort((a, b) => a.row_kind.localeCompare(b.row_kind) || a.entity_id - b.entity_id || a.entity_slug.localeCompare(b.entity_slug))
}

export function buildStage4ResolverSnapshot({ resultPath, outPath, databaseId, databaseName, environment, accountId, binding, executedAt, mode = 'production' }) {
  if (mode !== 'test') throw new Error('file-based result input is test-only and never production-eligible')
  const resultAbsolute = resolve(resultPath), rows = canonicalRows(rowsFromD1(readJson(resultAbsolute)))
  if (mode === 'production' && !resultAbsolute.startsWith(`${ROOT}\\`) && !resultAbsolute.startsWith(`${ROOT}/`)) throw new Error('production result artifact must be stored inside the repository')
  const queryBytes = readFileSync(QUERY), resultBytes = readFileSync(resultAbsolute)
  const snapshot = {
    schema: 'population_resolver_snapshot.v1', version: '1.0.0', mode, created_at: strictIso(executedAt, 'executed_at'),
    provenance: {
      kind: 'd1_preflight', database_id: required(databaseId, 'database_id'), database_name: required(databaseName, 'database_name'),
      environment: required(environment, 'environment'), account_id: required(accountId, 'account_id'), binding: required(binding, 'binding'), executed_at: strictIso(executedAt, 'executed_at'),
      query_path: relative(ROOT, QUERY).replaceAll('\\', '/'), query_hash: sha256Bytes(queryBytes),
      result_artifact_path: mode === 'test' ? resultAbsolute : relative(ROOT, resultAbsolute).replaceAll('\\', '/'), result_hash: sha256Bytes(resultBytes),
    },
    result_rows: rows,
    mappings: rows.filter((row) => row.row_kind === 'population').map((row) => ({ population_key: row.entity_slug, population_id: row.entity_id, population_slug: row.entity_slug })),
    ingredients: rows.filter((row) => row.row_kind === 'ingredient').map((row) => ({ ingredient_id: row.entity_id, ingredient_slug: row.entity_slug })),
    content_hash: '',
  }
  snapshot.content_hash = artifactHash(snapshot)
  writeFileSync(resolve(outPath), `${JSON.stringify(snapshot, null, 2)}\n`, 'utf8')
  return snapshot
}

function wranglerIdentity() {
  const source = readFileSync(WRANGLER, 'utf8'), section = source.match(/\[\[d1_databases\]\]([\s\S]*?)(?=\n\[\[|$)/)?.[1] ?? ''
  const get = (key) => section.match(new RegExp(`^\\s*${key}\\s*=\\s*"([^"]+)"`, 'm'))?.[1]
  const value = { binding: get('binding'), database_name: get('database_name'), database_id: get('database_id') }
  if (Object.values(value).some((entry) => !entry)) throw new Error('canonical Wrangler D1 identity is incomplete')
  return value
}
function accountIds(value, found = new Set()) {
  if (Array.isArray(value)) for (const entry of value) accountIds(entry, found)
  else if (value && typeof value === 'object') {
    if (Array.isArray(value.accounts)) for (const account of value.accounts) if (typeof account?.id === 'string') found.add(account.id)
    for (const [key, entry] of Object.entries(value)) {
      if (/account.*id|id.*account/i.test(key) && typeof entry === 'string') found.add(entry)
      accountIds(entry, found)
    }
  }
  return found
}
export function resolveLocalWranglerEntrypoint() {
  const prefix = process.env.npm_config_prefix || process.env.NPM_CONFIG_PREFIX
  const candidates = [
    resolve(ROOT, 'node_modules/wrangler/bin/wrangler.js'),
    resolve(ROOT, 'functions/node_modules/wrangler/bin/wrangler.js'),
    resolve(ROOT, 'frontend/node_modules/wrangler/bin/wrangler.js'),
    ...(prefix ? [resolve(prefix, 'node_modules/wrangler/bin/wrangler.js')] : []),
    ...(process.platform === 'win32' && process.env.APPDATA ? [resolve(process.env.APPDATA, 'npm/node_modules/wrangler/bin/wrangler.js')] : []),
    ...(process.platform !== 'win32' ? [resolve(homedir(), '.npm-global/lib/node_modules/wrangler/bin/wrangler.js'), '/usr/local/lib/node_modules/wrangler/bin/wrangler.js'] : []),
  ]
  const entry = candidates.find((candidate) => existsSync(candidate))
  if (!entry) throw new Error('local Wrangler JS entrypoint is unavailable; install Wrangler in the workspace or configured npm prefix')
  return realpathSync(entry)
}
function execute(executor, executable, argv) {
  const result = executor(executable, argv, { cwd: ROOT, shell: false, encoding: null, windowsHide: true, maxBuffer: 20 * 1024 * 1024 })
  if (result.error || result.status !== 0 || !(result.stdout instanceof Uint8Array || Buffer.isBuffer(result.stdout))) throw new Error(`Wrangler command failed closed: ${result.error?.message ?? Buffer.from(result.stderr ?? '').toString('utf8')}`)
  return Buffer.from(result.stdout)
}
function productionOutput(path, label) {
  const absolute = resolve(required(path, label)), rel = relative(ROOT, absolute)
  if (rel.startsWith('..') || rel === '' || rel.startsWith('/') || rel.startsWith('\\')) throw new Error(`${label} must be a file inside the repository`)
  return absolute
}
function executeProductionStage4Preflight({ outPath, resultOutPath, attestationOutPath, authOutPath }, { executor, clock, executable, wranglerEntrypoint }) {
  const output = productionOutput(outPath, 'out'), resultOutput = productionOutput(resultOutPath, 'result_out'), attestationOutput = productionOutput(attestationOutPath, 'attestation_out'), authOutput = productionOutput(authOutPath, 'auth_out')
  const identity = wranglerIdentity(), queryArg = relative(ROOT, QUERY).replaceAll('\\', '/'), queryText = readFileSync(QUERY, 'utf8')
  const authArgv = [wranglerEntrypoint, 'whoami', '--json'], queryArgv = [wranglerEntrypoint, 'd1', 'execute', identity.database_name, '--remote', '--command', queryText, '--json']
  const startedAt = strictIso(clock(), 'started_at'), authBytes = execute(executor, executable, authArgv)
  let authJson; try { authJson = JSON.parse(authBytes.toString('utf8')) } catch { throw new Error('Wrangler authentication output is not valid JSON') }
  const ids = accountIds(authJson)
  if (ids.size !== 1) throw new Error('authenticated Cloudflare account identity is missing or ambiguous')
  const accountId = [...ids][0], stdoutBytes = execute(executor, executable, queryArgv), completedAt = strictIso(clock(), 'completed_at')
  if (Date.parse(completedAt) < Date.parse(startedAt)) throw new Error('preflight completion predates start')
  rowsFromD1(JSON.parse(stdoutBytes.toString('utf8')))
  writeFileSync(resultOutput, stdoutBytes)
  writeFileSync(authOutput, authBytes)
  const attestation = {
    schema: 'stage4_d1_preflight_attestation.v1', mode: 'production', execution_mode: 'live', status: 'pass', generator: 'stage4-d1-resolver-preflight.v1',
    executable, wrangler_entrypoint: wranglerEntrypoint, auth_argv: authArgv, query_argv: queryArgv, shell: false, started_at: startedAt, completed_at: completedAt,
    database_id: identity.database_id, database_name: identity.database_name, environment: 'production', account_id: accountId, binding: identity.binding,
    wrangler_config_path: 'wrangler.toml', wrangler_config_hash: sha256Bytes(readFileSync(WRANGLER)), query_path: queryArg, query_hash: sha256Bytes(readFileSync(QUERY)),
    stdout_artifact_path: relative(ROOT, resultOutput).replaceAll('\\', '/'), stdout_byte_hash: sha256Bytes(stdoutBytes),
    auth_artifact_path: relative(ROOT, authOutput).replaceAll('\\', '/'), auth_stdout_byte_hash: sha256Bytes(authBytes),
  }
  writeFileSync(attestationOutput, `${JSON.stringify(attestation, null, 2)}\n`, 'utf8')
  const snapshot = {
    schema: 'population_resolver_snapshot.v1', version: '1.0.0', mode: 'production', created_at: completedAt,
    provenance: { kind: 'd1_preflight', database_id: identity.database_id, database_name: identity.database_name, environment: 'production', account_id: accountId, binding: identity.binding, executed_at: completedAt, query_path: queryArg, query_hash: attestation.query_hash, result_artifact_path: attestation.stdout_artifact_path, result_hash: attestation.stdout_byte_hash, attestation_path: relative(ROOT, attestationOutput).replaceAll('\\', '/'), attestation_hash: '' },
    result_rows: canonicalRows(rowsFromD1(JSON.parse(stdoutBytes.toString('utf8')))), mappings: [], ingredients: [], content_hash: '',
  }
  snapshot.mappings = snapshot.result_rows.filter((row) => row.row_kind === 'population').map((row) => ({ population_key: row.entity_slug, population_id: row.entity_id, population_slug: row.entity_slug }))
  snapshot.ingredients = snapshot.result_rows.filter((row) => row.row_kind === 'ingredient').map((row) => ({ ingredient_id: row.entity_id, ingredient_slug: row.entity_slug }))
  snapshot.provenance.attestation_hash = sha256Bytes(readFileSync(attestationOutput))
  snapshot.content_hash = artifactHash(snapshot); writeFileSync(output, `${JSON.stringify(snapshot, null, 2)}\n`, 'utf8')
  return { snapshot, attestation }
}
export function runProductionStage4Preflight(options) {
  return executeProductionStage4Preflight(options, { executor: spawnSync, clock: () => new Date().toISOString(), executable: process.execPath, wranglerEntrypoint: resolveLocalWranglerEntrypoint() })
}
export const __stage4PreflightTestOnly = Object.freeze({
  run(options, { executor, clock, wranglerEntrypoint = resolve(ROOT, 'node_modules/wrangler/bin/wrangler.js') }) {
    return executeProductionStage4Preflight(options, { executor, clock, executable: process.execPath, wranglerEntrypoint: resolve(wranglerEntrypoint) })
  },
})

function args(argv) { const out = {}; for (let i = 0; i < argv.length; i += 1) { const key = argv[i]; if (!key.startsWith('--')) throw new Error(`unknown argument ${key}`); out[key.slice(2).replaceAll('-', '_')] = argv[++i] } return out }
const invoked = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)
if (invoked) {
  try {
    const a = args(process.argv.slice(2))
    const mode = a.mode ?? 'production'
    const snapshot = mode === 'test'
      ? buildStage4ResolverSnapshot({ resultPath: a.result, outPath: a.out, databaseId: a.database_id, databaseName: a.database_name, environment: a.environment, accountId: a.account_id, binding: a.binding, executedAt: a.executed_at, mode })
      : runProductionStage4Preflight({ outPath: a.out, resultOutPath: a.result_out, attestationOutPath: a.attestation_out, authOutPath: a.auth_out }).snapshot
    console.log(JSON.stringify({ status: 'PASS', resolver: resolve(a.out), content_hash: snapshot.content_hash }, null, 2))
  } catch (error) { console.error(`Stage-4 D1 resolver preflight failed: ${error.message}`); process.exit(1) }
}
