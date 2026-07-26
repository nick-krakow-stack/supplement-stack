import assert from 'node:assert/strict'
import test from 'node:test'
import { canonicalJsonHash } from './lib/content-validation.mjs'
import { validateArticleOriginIndexabilityV1, validateRawHtmlDeliveryV1 } from './lib/public-delivery-status-v1.mjs'
import { detailApiCacheBypassUrlV1, validatePublicApiReadbackActualV1 } from './lib/public-api-readback-v1.mjs'

const URL = 'https://supplementstack.de/wissen/teststoff?cfcheck=sha256%3Aabc'
const HASH = canonicalJsonHash({ raw: 'html' })

function raw(overrides = {}) {
  return { url: URL, fetch_status: 'FETCHED', http_status: 200, content_type: 'text/html; charset=utf-8', body_hash: HASH, title_match: true, article_text_match: true, article_json_ld_match: true, seo_delivery_state: 'RAW_HTML_MATCH', ...overrides }
}

test('RAW_HTML_MATCH requires the shared FETCHED, HTTP 200 and text/html contract', () => {
  assert.doesNotThrow(() => validateRawHtmlDeliveryV1(raw(), 'RAW_HTML_MATCH', { expectedUrl: URL }))
  for (const invalid of [
    raw({ fetch_status: 'OK' }),
    raw({ http_status: 404 }),
    raw({ content_type: 'application/json' }),
    raw({ content_type: null }),
    raw({ url: 'https://supplementstack.de/wissen/teststoff' }),
  ]) assert.throws(() => validateRawHtmlDeliveryV1(invalid, 'RAW_HTML_MATCH', { expectedUrl: URL }), /invalid|cache-bypass/i)
})

test('CLIENT_RENDERED_ONLY preserves fetched or network-error evidence without inventing response fields', () => {
  assert.doesNotThrow(() => validateRawHtmlDeliveryV1(raw({ seo_delivery_state: 'CLIENT_RENDERED_ONLY', title_match: false }), 'CLIENT_RENDERED_ONLY', { expectedUrl: URL }))
  assert.doesNotThrow(() => validateRawHtmlDeliveryV1(raw({ fetch_status: 'NETWORK_ERROR', http_status: null, content_type: null, body_hash: null, title_match: false, article_text_match: false, article_json_ld_match: false, seo_delivery_state: 'CLIENT_RENDERED_ONLY' }), 'CLIENT_RENDERED_ONLY', { expectedUrl: URL }))
  assert.throws(() => validateRawHtmlDeliveryV1(raw({ fetch_status: 'NETWORK_ERROR', http_status: 200, content_type: null, body_hash: null, seo_delivery_state: 'CLIENT_RENDERED_ONLY' }), 'CLIENT_RENDERED_ONLY', { expectedUrl: URL }), /must keep HTTP, MIME and body hash null/i)
})

test('origin-wide HTTP, robots and unknown states must agree between origin and article receipts', () => {
  for (const state of ['INDEXABLE', 'BLOCKED_BY_SITE_POLICY', 'BLOCKED_BY_HTTP', 'UNKNOWN']) assert.equal(validateArticleOriginIndexabilityV1(state, state), state)
  assert.equal(validateArticleOriginIndexabilityV1('BLOCKED_BY_PAGE_META', 'INDEXABLE'), 'BLOCKED_BY_PAGE_META')
  assert.throws(() => validateArticleOriginIndexabilityV1('BLOCKED_BY_HTTP', 'INDEXABLE'), /differs between article and origin/i)
})

test('resume validation binds the exact detail API URL, release and complete public projection', () => {
  const release = { public_base_url: 'https://supplementstack.de/', release_hash: canonicalJsonHash({ release: 1 }) }
  const target = {
    article_id: 'main-teststoff', stage: 'stage3', slug: 'teststoff', visible_payload_hash: canonicalJsonHash({ visible: 1 }), reviewed_at: '2026-07-14', published_at: '2025-01-02T10:00:00.000Z', modified_at: '2026-07-14T12:00:00.000Z',
    source_relations: [{ position: 0, source_id: 'source-a', label: 'Quelle A', url: 'https://example.org/a' }], ingredient_ids: [7], stage2_interpretation_projection: [],
  }
  const actual = {
    url: detailApiCacheBypassUrlV1(release, target), release_hash: release.release_hash, fetch_status: 'FETCHED', http_status: 200, content_type: 'application/json; charset=utf-8', body_hash: canonicalJsonHash({ body: 1 }),
    slug: target.slug, visible_payload_hash: target.visible_payload_hash, reviewed_at: target.reviewed_at, created_at: target.published_at, updated_at: target.modified_at, source_relations: target.source_relations, ingredient_ids: target.ingredient_ids, optional_interpretation_projection: null,
    legacy_visible_fields: { featured_image_url: null, dose_min: null, dose_max: null, dose_unit: null, product_note: null },
  }
  assert.doesNotThrow(() => validatePublicApiReadbackActualV1({ release, target, actual }))
  const mutations = [
    (value) => { value.url = 'https://supplementstack.de/api/knowledge/teststoff' },
    (value) => { value.release_hash = canonicalJsonHash({ release: 2 }) },
    (value) => { value.reviewed_at = '2026-07-13' },
    (value) => { value.source_relations = [] },
    (value) => { value.ingredient_ids = [8] },
    (value) => { value.optional_interpretation_projection = [] },
    (value) => { value.legacy_visible_fields.dose_unit = 'mg' },
  ]
  for (const mutate of mutations) {
    const forged = structuredClone(actual); mutate(forged)
    assert.throws(() => validatePublicApiReadbackActualV1({ release, target, actual: forged }), /differs/i)
  }
})

test('Stage-2 interpretation projection stays optional but is exact when the API exposes it', () => {
  const release = { public_base_url: 'https://supplementstack.de/', release_hash: canonicalJsonHash({ release: 'stage2' }) }
  const interpretation = [{ local_source_id: 'source-a', status: 'accepted', projection_hash: canonicalJsonHash({ source: 'a' }) }]
  const target = {
    article_id: 'study-teststoff', stage: 'stage2', slug: 'teststoff-studie', visible_payload_hash: canonicalJsonHash({ visible: 'stage2' }), reviewed_at: '2026-07-14', published_at: '2025-01-02T10:00:00.000Z', modified_at: '2026-07-14T12:00:00.000Z',
    source_relations: [{ position: 0, source_id: 'source-a', label: 'Quelle A', url: 'https://example.org/a' }], ingredient_ids: [7], stage2_interpretation_projection: interpretation,
  }
  const actual = {
    url: detailApiCacheBypassUrlV1(release, target), release_hash: release.release_hash, fetch_status: 'FETCHED', http_status: 200, content_type: 'application/json; charset=utf-8', body_hash: canonicalJsonHash({ body: 'stage2' }),
    slug: target.slug, visible_payload_hash: target.visible_payload_hash, reviewed_at: target.reviewed_at, created_at: target.published_at, updated_at: target.modified_at, source_relations: target.source_relations, ingredient_ids: target.ingredient_ids, optional_interpretation_projection: null,
    legacy_visible_fields: { featured_image_url: null, dose_min: null, dose_max: null, dose_unit: null, product_note: null },
  }
  assert.doesNotThrow(() => validatePublicApiReadbackActualV1({ release, target, actual }))
  assert.doesNotThrow(() => validatePublicApiReadbackActualV1({ release, target, actual: { ...actual, optional_interpretation_projection: interpretation } }))
  assert.throws(() => validatePublicApiReadbackActualV1({ release, target, actual: { ...actual, optional_interpretation_projection: [] } }), /differs/i)
})
