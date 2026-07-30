import { canonicalJsonHash } from './content-validation.mjs'

const HASH = /^sha256:[a-f0-9]{64}$/
const LEGACY_NULL_FIELDS = Object.freeze({ featured_image_url: null, dose_min: null, dose_max: null, dose_unit: null, product_note: null })

function fail(message) { throw new Error(message) }
function object(value, label) { if (!value || typeof value !== 'object' || Array.isArray(value)) fail(`${label} must be an object`); return value }

export function detailApiCacheBypassUrlV1(release, target) {
  const url = new URL(`/api/knowledge/${encodeURIComponent(target.slug)}`, release.public_base_url)
  url.searchParams.set('cfcheck', release.release_hash)
  return url.href
}

export function validatePublicApiReadbackActualV1({ release, target, actual }) {
  const value = object(actual, `${target.article_id} public API readback`)
  const mime = typeof value.content_type === 'string' ? value.content_type.split(';', 1)[0].trim().toLowerCase() : ''
  const expectedInterpretation = target.stage === 'stage2' && value.optional_interpretation_projection !== null ? target.stage2_interpretation_projection : null
  if (value.url !== detailApiCacheBypassUrlV1(release, target) || value.release_hash !== release.release_hash || value.fetch_status !== 'FETCHED' || value.http_status !== 200 || mime !== 'application/json' || !HASH.test(value.body_hash ?? '')) fail(`${target.article_id} public API transport/release lineage differs`)
  const expectedSeo = { meta_title: target.seo.meta_title, meta_description: target.seo.meta_description, canonical_url: target.seo.canonical_url, canonical_path: target.seo.canonical_path, robots: target.seo.robots, indexable: target.seo.indexable, json_ld: target.seo.json_ld }
  if (value.slug !== target.slug || value.visible_payload_hash !== target.visible_payload_hash || value.seo_hash !== target.seo_hash || canonicalJsonHash(value.seo) !== target.seo_hash || canonicalJsonHash(expectedSeo) !== target.seo_hash || value.reviewed_at !== target.reviewed_at || value.created_at !== target.published_at || value.updated_at !== target.modified_at || canonicalJsonHash(value.source_relations) !== canonicalJsonHash(target.source_relations) || canonicalJsonHash(value.ingredient_ids) !== canonicalJsonHash(target.ingredient_ids) || canonicalJsonHash(value.optional_interpretation_projection) !== canonicalJsonHash(expectedInterpretation) || canonicalJsonHash(value.legacy_visible_fields) !== canonicalJsonHash(LEGACY_NULL_FIELDS)) fail(`${target.article_id} public API payload/SEO/timestamps/relations/legacy projection differs`)
  return value
}

export function buildPublicApiReadbackActualV1({ release, target, publicState }) {
  const state = object(publicState, `${target.article_id} public API state`)
  const actual = {
    url: state.url, release_hash: state.release_hash, fetch_status: state.fetch_status, http_status: state.http_status, content_type: state.content_type, body_hash: state.body_hash,
    slug: state.publish_payload?.slug, visible_payload_hash: target.visible_payload_hash, seo: state.seo, seo_hash: canonicalJsonHash(state.seo), reviewed_at: state.reviewed_at, created_at: state.created_at, updated_at: state.updated_at,
    source_relations: state.source_relations, ingredient_ids: state.ingredient_ids, optional_interpretation_projection: state.stage2_interpretation_projection, legacy_visible_fields: state.legacy_visible_fields,
  }
  return validatePublicApiReadbackActualV1({ release, target, actual })
}

export const PUBLIC_API_READBACK_CHECKS_V1 = Object.freeze(['detail_api_url', 'release_hash', 'fetch_status', 'http_status', 'content_type', 'body_hash', 'slug', 'visible_payload_hash', 'seo_hash', 'reviewed_at', 'created_at', 'updated_at', 'v2_sources', 'ingredient_ids', 'optional_interpretations', 'legacy_visible_fields_null'])
