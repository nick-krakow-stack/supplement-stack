import { existsSync, readFileSync } from 'node:fs'

import { canonicalJsonHash, decodeUtf8Strict, sha256Bytes } from './content-validation.mjs'
import { artifactHashV2 } from './evidence-pipeline-v2.mjs'
import {
  buildRendererPublicReadbackRequestV2,
  validateRendererPublicReadbackReceiptV2,
} from './nutrient-content-machine-dispatcher.mjs'

const HASH = /^sha256:[a-f0-9]{64}$/

function fail(message) { throw new Error(message) }
function object(value, label) { if (!value || typeof value !== 'object' || Array.isArray(value)) fail(`${label} must be an object`); return value }
function array(value, label) { if (!Array.isArray(value)) fail(`${label} must be an array`); return value }
function sameSet(left, right) { const a = new Set(left), b = new Set(right); return a.size === left.length && b.size === right.length && a.size === b.size && [...a].every((entry) => b.has(entry)) }
function iso(value, label) { if (typeof value !== 'string' || !Number.isFinite(Date.parse(value))) fail(`${label} must be ISO-8601`); return value }

function readJson(path, label) {
  const decoded = decodeUtf8Strict(readFileSync(path), label)
  if (decoded.errors.length) fail(decoded.errors.join('; '))
  try { return JSON.parse(decoded.text) } catch (error) { fail(`${label} is not valid JSON: ${error.message}`) }
}

function validateRendererReleaseBinding({ release, request, receipt, publishReceipt }) {
  const generatedAt = iso(request.generated_at, 'indexability renderer request.generated_at')
  if (Date.parse(generatedAt) <= Date.parse(publishReceipt.applied_at)) fail('indexability renderer request must postdate the article publication')
  const expectedRequest = buildRendererPublicReadbackRequestV2(release, { generatedAt })
  if (canonicalJsonHash(request) !== canonicalJsonHash(expectedRequest)) fail('indexability renderer request differs from the canonical release-bound request')
  validateRendererPublicReadbackReceiptV2(receipt, request)
  const checkedAt = iso(receipt.checked_at, 'indexability renderer receipt.checked_at')
  if (Date.parse(checkedAt) <= Date.parse(generatedAt)) fail('indexability renderer receipt must postdate its fresh request')
  if (!sameSet(request.articles.map((entry) => entry.article_id), release.articles.map((entry) => entry.article_id))) fail('indexability renderer request article set differs from release')
  if (!sameSet(receipt.article_results.map((entry) => entry.article_id), release.articles.map((entry) => entry.article_id))) fail('indexability renderer receipt article set differs from release')

  const originResults = array(receipt.origin_results, 'indexability renderer receipt.origin_results')
  if (!originResults.length || originResults.some((entry) => entry.indexability_state !== 'INDEXABLE' || entry.robots_txt?.global_rule !== 'ALLOW' || !HASH.test(entry.site_policy_fingerprint ?? ''))) fail('indexability origin readback does not prove an allowed site policy')
  if (receipt.badge_readback?.result !== 'MATCH' || (receipt.badge_readback?.mismatches ?? []).length) fail('indexability renderer badge readback differs')

  const summaries = release.articles.map((target) => {
    const expected = request.articles.find((entry) => entry.article_id === target.article_id)
    const result = receipt.article_results.find((entry) => entry.article_id === target.article_id)
    if (!expected || expected.projection_hash !== target.projection_hash || expected.seo_hash !== target.seo_hash || expected.public_url !== target.seo.canonical_url) fail(`${target.article_id} indexability request differs from frozen release`)
    if (!result || result.result !== 'MATCH' || result.hydrated_dom_state !== 'HYDRATED_DOM_MATCH' || result.seo_match !== 'MATCH' || (result.mismatches ?? []).length) fail(`${target.article_id} fresh renderer readback did not MATCH`)
    if (result.projection_hash !== target.projection_hash || result.seo_hash !== target.seo_hash || !sameSet(result.asset_hashes ?? [], target.asset_hashes)) fail(`${target.article_id} fresh renderer projection/SEO/assets differ from release`)
    if (result.indexability_state !== 'INDEXABLE' || result.seo_delivery_state !== 'RAW_HTML_MATCH' || result.sitemap?.state !== 'INCLUDED') fail(`${target.article_id} indexability/raw HTML/sitemap delivery is incomplete`)
    if (result.raw_html?.fetch_status !== 'FETCHED' || result.raw_html?.http_status !== 200 || result.raw_html?.title_match !== true || result.raw_html?.article_text_match !== true || result.raw_html?.article_json_ld_match !== true || result.raw_html?.seo_delivery_state !== 'RAW_HTML_MATCH' || !HASH.test(result.raw_html?.body_hash ?? '')) fail(`${target.article_id} raw HTML readback is incomplete`)
    for (const viewportName of ['desktop', 'mobile']) {
      const viewport = result.viewports?.[viewportName]
      if (!viewport || viewport.result !== 'MATCH' || viewport.projection_hash !== target.projection_hash || viewport.seo_hash !== target.seo_hash || (viewport.mismatches ?? []).length) fail(`${target.article_id} ${viewportName} renderer readback differs`)
    }
    return {
      article_id: target.article_id,
      public_url: result.public_url,
      result: 'PASS',
      indexability_state: result.indexability_state,
      seo_delivery_state: result.seo_delivery_state,
      sitemap_state: result.sitemap.state,
      site_policy_fingerprint: result.site_policy_fingerprint,
      raw_html_body_hash: result.raw_html.body_hash,
      projection_hash: result.projection_hash,
      seo_hash: result.seo_hash,
    }
  }).sort((left, right) => left.article_id.localeCompare(right.article_id))
  return { checkedAt, originResults, summaries }
}

export function buildIndexabilityReleaseReceiptV1({ release, publishReceipt, rendererRequest, rendererReceipt }) {
  if (publishReceipt.schema !== 'content_publish_receipt.v2' || publishReceipt.content_hash !== artifactHashV2(publishReceipt) || publishReceipt.release_hash !== release.release_hash) fail('indexability release publish receipt binding is invalid')
  const { checkedAt, originResults, summaries } = validateRendererReleaseBinding({ release, request: rendererRequest, receipt: rendererReceipt, publishReceipt })
  const base = {
    schema: 'indexability_release_receipt.v1',
    release_hash: release.release_hash,
    publish_receipt_hash: publishReceipt.content_hash,
    checked_at: checkedAt,
    renderer_request_hash: rendererRequest.content_hash,
    renderer_receipt_hash: rendererReceipt.content_hash,
    result: 'PASS',
    origin_results: originResults.map((entry) => ({
      origin: entry.origin,
      indexability_state: entry.indexability_state,
      site_policy_fingerprint: entry.site_policy_fingerprint,
      robots_body_hash: entry.robots_txt.body_hash,
      sitemap_body_hash: entry.sitemap_discovery.body_hash,
      deployment_fingerprint: entry.deployment_fingerprint.fingerprint,
    })).sort((left, right) => left.origin.localeCompare(right.origin)),
    article_results: summaries,
  }
  return { ...base, content_hash: artifactHashV2(base) }
}

export function validateIndexabilityReleaseReceiptV1({ release, publishReceipt, receiptPath, rendererRequestPath, rendererReceiptPath }) {
  if (!existsSync(receiptPath)) return { status: 'missing' }
  if (!existsSync(rendererRequestPath) || !existsSync(rendererReceiptPath)) fail('indexability release renderer bindings are missing')
  const rendererRequest = readJson(rendererRequestPath, 'indexability renderer request')
  const rendererReceipt = readJson(rendererReceiptPath, 'indexability renderer receipt')
  const expected = buildIndexabilityReleaseReceiptV1({ release, publishReceipt, rendererRequest, rendererReceipt })
  const actual = readJson(receiptPath, 'indexability release receipt')
  if (actual.schema !== 'indexability_release_receipt.v1' || actual.content_hash !== artifactHashV2(actual) || canonicalJsonHash(actual) !== canonicalJsonHash(expected)) fail('indexability release receipt is malformed or stale')
  return { status: 'pass', receipt: actual, receiptHash: actual.content_hash, rendererReceiptHash: rendererReceipt.content_hash, rendererRequestHash: rendererRequest.content_hash }
}

export function indexabilityReleaseBindingFiles(paths) {
  return {
    receipt_byte_hash: sha256Bytes(readFileSync(paths.receiptPath)),
    renderer_request_byte_hash: sha256Bytes(readFileSync(paths.rendererRequestPath)),
    renderer_receipt_byte_hash: sha256Bytes(readFileSync(paths.rendererReceiptPath)),
  }
}
