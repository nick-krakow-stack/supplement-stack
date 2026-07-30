const HASH = /^sha256:[a-f0-9]{64}$/

export const ORIGIN_INDEXABILITY_STATES_V1 = Object.freeze(['INDEXABLE', 'BLOCKED_BY_SITE_POLICY', 'BLOCKED_BY_HTTP', 'UNKNOWN'])
export const ARTICLE_INDEXABILITY_STATES_V1 = Object.freeze([...ORIGIN_INDEXABILITY_STATES_V1, 'BLOCKED_BY_PAGE_META'])
export const SEO_DELIVERY_STATES_V1 = Object.freeze(['RAW_HTML_MATCH', 'CLIENT_RENDERED_ONLY'])
export const RAW_HTML_FETCH_STATES_V1 = Object.freeze(['FETCHED', 'NETWORK_ERROR'])

function fail(message) { throw new Error(message) }
function object(value, label) { if (!value || typeof value !== 'object' || Array.isArray(value)) fail(`${label} must be an object`); return value }

export function validateOriginIndexabilityStateV1(value, label = 'origin indexability_state') {
  if (!ORIGIN_INDEXABILITY_STATES_V1.includes(value)) fail(`${label} is invalid`)
  return value
}

export function validateArticleIndexabilityStateV1(value, label = 'article indexability_state') {
  if (!ARTICLE_INDEXABILITY_STATES_V1.includes(value)) fail(`${label} is invalid`)
  return value
}

export function indexabilityNeedsReleaseV1(value) {
  return validateArticleIndexabilityStateV1(value) !== 'INDEXABLE'
}

export function validateRawHtmlDeliveryV1(value, seoDeliveryState, { label = 'raw HTML', expectedUrl = null } = {}) {
  const raw = object(value, label)
  if (!SEO_DELIVERY_STATES_V1.includes(seoDeliveryState) || raw.seo_delivery_state !== seoDeliveryState) fail(`${label} delivery state is invalid`)
  if (!RAW_HTML_FETCH_STATES_V1.includes(raw.fetch_status)) fail(`${label}.fetch_status is invalid`)
  if (expectedUrl != null && raw.url !== expectedUrl) fail(`${label}.url does not bind the release cache-bypass URL`)
  if (seoDeliveryState === 'RAW_HTML_MATCH') {
    const mime = typeof raw.content_type === 'string' ? raw.content_type.split(';', 1)[0].trim().toLowerCase() : ''
    if (raw.fetch_status !== 'FETCHED' || raw.http_status !== 200 || mime !== 'text/html' || !HASH.test(raw.body_hash ?? '') || raw.title_match !== true || raw.article_text_match !== true || raw.article_json_ld_match !== true) fail(`${label} RAW_HTML_MATCH evidence is invalid`)
    return raw
  }
  if (raw.fetch_status === 'NETWORK_ERROR') {
    if (raw.http_status !== null || raw.content_type !== null || raw.body_hash !== null) fail(`${label} network-error evidence must keep HTTP, MIME and body hash null`)
    return raw
  }
  if (!Number.isInteger(raw.http_status) || raw.http_status < 100 || raw.http_status > 599 || raw.content_type != null && typeof raw.content_type !== 'string' || !HASH.test(raw.body_hash ?? '')) fail(`${label} fetched client-only evidence is invalid`)
  return raw
}

export function validateArticleOriginIndexabilityV1(articleState, originState, label = 'article/origin indexability') {
  validateArticleIndexabilityStateV1(articleState, `${label} article state`)
  validateOriginIndexabilityStateV1(originState, `${label} origin state`)
  if (articleState !== 'BLOCKED_BY_PAGE_META' && articleState !== originState) fail(`${label} origin-wide state differs between article and origin receipt`)
  return articleState
}
