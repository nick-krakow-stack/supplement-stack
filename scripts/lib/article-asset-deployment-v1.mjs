import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { dirname, resolve } from 'node:path'
import { canonicalJsonHash, decodeUtf8Strict, sha256Bytes } from './content-validation.mjs'
import { artifactHashV2 } from './evidence-pipeline-v2.mjs'
import { portablePath } from './safe-paths.mjs'

const HASH = /^sha256:[a-f0-9]{64}$/

function fail(message) { throw new Error(message) }
function object(value, label) { if (!value || typeof value !== 'object' || Array.isArray(value)) fail(`${label} must be an object`); return value }
function array(value, label) { if (!Array.isArray(value)) fail(`${label} must be an array`); return value }
function text(value, label) { if (typeof value !== 'string' || !value.trim()) fail(`${label} must be a non-empty string`); return value.trim() }
function now() { return new Date().toISOString() }
function without(value, keys) { return Object.fromEntries(Object.entries(value).filter(([key]) => !keys.includes(key))) }

function writeJsonAtomic(path, value) {
  mkdirSync(dirname(path), { recursive: true })
  const temporary = `${path}.tmp-${process.pid}`
  writeFileSync(temporary, `${JSON.stringify(value, null, 2)}\n`, 'utf8')
  renameSync(temporary, path)
}

function strictJson(path, label) {
  const decoded = decodeUtf8Strict(readFileSync(path), label)
  if (decoded.errors.length) fail(decoded.errors.join('; '))
  try { return JSON.parse(decoded.text) } catch (error) { fail(`${label} is invalid JSON: ${error.message}`) }
}

function rasterMetadata(bytes, label) {
  const buffer = Buffer.from(bytes)
  if (buffer.length >= 24 && buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) return { mime_type: 'image/png', width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20), extension: 'png' }
  if (buffer.length >= 12 && buffer[0] === 0xff && buffer[1] === 0xd8) {
    let offset = 2
    while (offset + 9 < buffer.length) {
      if (buffer[offset] !== 0xff) { offset += 1; continue }
      const marker = buffer[offset + 1]
      if ([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf].includes(marker)) return { mime_type: 'image/jpeg', width: buffer.readUInt16BE(offset + 7), height: buffer.readUInt16BE(offset + 5), extension: 'jpg' }
      const length = buffer.readUInt16BE(offset + 2)
      if (!Number.isInteger(length) || length < 2) break
      offset += 2 + length
    }
  }
  fail(`${label} must be PNG or JPEG`)
}

function normalizeAsset(root, article, asset, index) {
  object(asset, `${article.article_id}.assets[${index}]`)
  const localPath = resolve(root, text(asset.local_asset_path ?? asset.path, `${article.article_id}.assets[${index}].local_asset_path`))
  if (!existsSync(localPath)) fail(`${article.article_id} local asset is missing`)
  const bytes = readFileSync(localPath), byteHash = sha256Bytes(bytes), metadata = rasterMetadata(bytes, localPath)
  if (asset.byte_hash !== byteHash || asset.mime_type !== metadata.mime_type || Number(asset.width) !== metadata.width || Number(asset.height) !== metadata.height) fail(`${article.article_id} asset bytes/MIME/dimensions differ from the compiled binding`)
  const expectedKey = `knowledge/${article.slug}/${byteHash.slice('sha256:'.length)}.${metadata.extension}`
  const expectedUrl = `/api/r2/${expectedKey}`
  if (asset.r2_key !== expectedKey || asset.public_url !== expectedUrl) fail(`${article.article_id} asset does not use its content-addressed R2 key/public URL`)
  return {
    article_id: article.article_id, slug: article.slug, asset_id: text(asset.asset_id, `${article.article_id}.asset_id`), local_asset_path: portablePath(root, localPath),
    asset_byte_hash: byteHash, mime_type: metadata.mime_type, width: metadata.width, height: metadata.height, r2_key: expectedKey, final_public_url: expectedUrl,
  }
}

export function buildAssetDeploymentRequestV1({ runId, root, articles }) {
  const assets = array(articles, 'asset deployment articles').flatMap((entry) => {
    const article = entry.article ? { article_id: entry.article.article_id, slug: entry.article.slug } : { article_id: entry.article_id, slug: entry.slug }
    const compiledAssets = entry.compiled?.assets ?? entry.assets ?? []
    return compiledAssets.map((asset, index) => normalizeAsset(root, article, asset, index))
  }).sort((left, right) => `${left.article_id}:${left.asset_id}`.localeCompare(`${right.article_id}:${right.asset_id}`))
  if (new Set(assets.map((asset) => asset.r2_key)).size !== assets.length || new Set(assets.map((asset) => `${asset.article_id}:${asset.asset_id}`)).size !== assets.length) fail('asset deployment request contains duplicate asset identities or keys')
  const base = { schema: 'asset_deployment_request.v1', run_id: runId, assets }
  return { ...base, content_hash: artifactHashV2(base) }
}

export function validateAssetDeploymentReceiptV1({ receipt, request, issuedWorkOrders = [], expectedOutputPath = null, allowUnissuedTestReceipt = false }) {
  object(receipt, 'asset deployment receipt')
  if (receipt.schema !== 'asset_deployment_receipt.v1' || receipt.content_hash !== artifactHashV2(receipt) || receipt.run_id !== request.run_id || receipt.request_hash !== request.content_hash || receipt.result !== 'PASS') fail('asset deployment receipt schema/hash/request/result is invalid')
  if (!Number.isFinite(Date.parse(receipt.staged_at))) fail('asset deployment receipt staged_at is invalid')
  if (!allowUnissuedTestReceipt) {
    const order = issuedWorkOrders.find((entry) => entry.work_order_id === receipt.work_order_id)
    const output = order?.outputs?.find((entry) => entry.name === 'asset_deployment_receipt' && entry.schema === receipt.schema)
    if (!order || order.kind !== 'asset_stage' || order.execution_class !== 'deterministic' || order.assignee?.role !== 'deterministic-article-asset-stager' || !output || expectedOutputPath && output.path !== expectedOutputPath) fail('asset deployment receipt does not bind its exact deterministic WorkOrder/output')
  }
  const actual = array(receipt.assets, 'asset deployment receipt assets')
  if (canonicalJsonHash(actual.map((asset) => ({ article_id: asset.article_id, slug: asset.slug, asset_id: asset.asset_id, local_asset_path: asset.local_asset_path, asset_byte_hash: asset.asset_byte_hash, mime_type: asset.mime_type, width: asset.width, height: asset.height, r2_key: asset.r2_key, final_public_url: asset.final_public_url }))) !== canonicalJsonHash(request.assets)) fail('asset deployment receipt asset set differs from request')
  for (const asset of actual) {
    if (asset.result !== 'STAGED' || asset.readback?.result !== 'MATCH' || asset.readback?.status !== 200 || asset.readback?.byte_hash !== asset.asset_byte_hash || asset.readback?.mime_type !== asset.mime_type || asset.readback?.width !== asset.width || asset.readback?.height !== asset.height || !HASH.test(asset.readback?.body_hash ?? '')) fail(`${asset.article_id}/${asset.asset_id} R2 readback is incomplete or mismatched`)
  }
  return { receipt, receipt_hash: receipt.content_hash, assets: actual }
}

function validateWorkOrder(workOrder, runId) {
  object(workOrder, 'asset_stage WorkOrder')
  if (workOrder.schema !== 'nutrient_content_work_order.v2' || workOrder.work_order_id !== canonicalJsonHash(without(workOrder, ['work_order_id'])) || workOrder.run_id !== runId || workOrder.kind !== 'asset_stage' || workOrder.execution_class !== 'deterministic' || workOrder.reasoning_tier !== 'standard' || workOrder.assignee?.role !== 'deterministic-article-asset-stager') fail('asset_stage WorkOrder identity/class/role/tier is invalid')
}

export async function stageArticleAssetsV1({ context, workOrder, stagingEnabled = false, commandRunner = spawnSync, fetchImpl = fetch, bucket = 'supplement-stack-images' }) {
  validateWorkOrder(workOrder, context.runId)
  if (context.publish?.required !== true || !stagingEnabled) fail('asset staging is disabled; it requires an explicit publish request and --publish authorization')
  const requestInput = workOrder.inputs?.find((entry) => entry.name === 'asset_deployment_request' && entry.schema === 'asset_deployment_request.v1')
  const output = workOrder.outputs?.find((entry) => entry.name === 'asset_deployment_receipt' && entry.schema === 'asset_deployment_receipt.v1')
  if (!requestInput || !output) fail('asset_stage WorkOrder input/output binding is incomplete')
  const requestPath = resolve(context.root, requestInput.path)
  if (!existsSync(requestPath) || sha256Bytes(readFileSync(requestPath)) !== requestInput.byte_hash) fail('asset deployment request bytes differ from WorkOrder')
  const request = strictJson(requestPath, 'asset deployment request')
  if (request.schema !== 'asset_deployment_request.v1' || request.content_hash !== artifactHashV2(request) || request.content_hash !== requestInput.content_hash || request.run_id !== context.runId) fail('asset deployment request lineage is invalid')
  const results = []
  for (const asset of request.assets) {
    const localPath = resolve(context.root, asset.local_asset_path)
    const bytes = readFileSync(localPath), metadata = rasterMetadata(bytes, localPath)
    if (sha256Bytes(bytes) !== asset.asset_byte_hash || metadata.mime_type !== asset.mime_type || metadata.width !== asset.width || metadata.height !== asset.height) fail(`${asset.article_id}/${asset.asset_id} changed after WorkOrder issuance`)
    const executable = process.platform === 'win32' ? 'npx.cmd' : 'npx'
    const upload = commandRunner(executable, ['wrangler', 'r2', 'object', 'put', `${bucket}/${asset.r2_key}`, '--file', localPath, '--remote', '--content-type', asset.mime_type, '--cache-control', 'public, max-age=31536000, immutable', '--force'], { cwd: context.root, shell: false, encoding: 'utf8', windowsHide: true, timeout: 120_000 })
    if (upload.status !== 0) fail(`R2 asset staging failed for ${asset.r2_key}: ${(upload.stderr || upload.stdout || '').trim()}`)
    const url = new URL(asset.final_public_url, context.publish.publicBaseUrl)
    url.searchParams.set('cfcheck', request.content_hash.slice('sha256:'.length))
    const response = await fetchImpl(url, { headers: { Accept: asset.mime_type }, cache: 'no-store' })
    const responseBytes = Buffer.from(await response.arrayBuffer()), readbackMetadata = rasterMetadata(responseBytes, asset.final_public_url)
    const readback = { result: response.status === 200 && sha256Bytes(responseBytes) === asset.asset_byte_hash && response.headers.get('content-type')?.split(';')[0].trim() === asset.mime_type && readbackMetadata.width === asset.width && readbackMetadata.height === asset.height ? 'MATCH' : 'MISMATCH', status: response.status, body_hash: sha256Bytes(responseBytes), byte_hash: sha256Bytes(responseBytes), mime_type: response.headers.get('content-type')?.split(';')[0].trim() ?? null, width: readbackMetadata.width, height: readbackMetadata.height }
    if (readback.result !== 'MATCH') fail(`R2 asset readback differs for ${asset.r2_key}`)
    results.push({ ...asset, result: 'STAGED', readback })
  }
  const base = { schema: 'asset_deployment_receipt.v1', run_id: context.runId, request_hash: request.content_hash, work_order_id: workOrder.work_order_id, executor: { role: 'deterministic-article-asset-stager', id: 'wrangler-r2-object-put' }, staged_at: now(), result: 'PASS', assets: results }
  const receipt = { ...base, content_hash: artifactHashV2(base) }
  writeJsonAtomic(resolve(context.root, output.path), receipt)
  return receipt
}
