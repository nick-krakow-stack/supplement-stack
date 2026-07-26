import { canonicalJsonHash } from './content-validation.mjs'

const HASH = /^sha256:[a-f0-9]{64}$/

function fail(message) { throw new Error(message) }
function object(value, label) { if (!value || typeof value !== 'object' || Array.isArray(value)) fail(`${label} must be an object`); return value }
function array(value, label) { if (!Array.isArray(value)) fail(`${label} must be an array`); return value }
function sameSet(left, right) { const a = new Set(left), b = new Set(right); return a.size === left.length && b.size === right.length && a.size === b.size && [...a].every((entry) => b.has(entry)) }

export function buildKnowledgeBadgeExpectationsV1(articles) {
  const list = array(articles, 'badge release articles')
  const affectedIngredientIds = [...new Set(list.flatMap((article) => array(article.ingredient_ids, `${article.article_id}.ingredient_ids`)))].sort((left, right) => left - right)
  if (!affectedIngredientIds.length || affectedIngredientIds.some((ingredientId) => !Number.isInteger(ingredientId) || ingredientId <= 0)) fail('badge affected ingredient IDs are invalid')
  const badgeExpectations = affectedIngredientIds.map((ingredientId) => {
    const requiresStudyBadge = list.some((article) => article.stage === 'stage2' && article.desired_status === 'published' && article.ingredient_ids.includes(ingredientId))
    return {
      ingredient_id: ingredientId,
      studies_rule: requiresStudyBadge ? 'REQUIRE_TRUE' : 'API_DOM_PARITY', expected_has_studies: requiresStudyBadge ? true : null,
      dge_rule: 'API_DOM_PARITY', expected_has_dge: null,
    }
  })
  return { affectedIngredientIds, badgeExpectations }
}

function validateExpectation(expectation, label) {
  object(expectation, label)
  if (!Number.isInteger(expectation.ingredient_id) || expectation.ingredient_id <= 0) fail(`${label}.ingredient_id is invalid`)
  if (!['REQUIRE_TRUE', 'PRESERVE', 'API_DOM_PARITY'].includes(expectation.studies_rule) || !['PRESERVE', 'API_DOM_PARITY'].includes(expectation.dge_rule)) fail(`${label} rules are invalid`)
  if (expectation.studies_rule === 'REQUIRE_TRUE' ? expectation.expected_has_studies !== true : expectation.studies_rule === 'PRESERVE' ? typeof expectation.expected_has_studies !== 'boolean' : expectation.expected_has_studies !== null) fail(`${label}.expected_has_studies differs from its rule`)
  if (expectation.dge_rule === 'PRESERVE' ? typeof expectation.expected_has_dge !== 'boolean' : expectation.expected_has_dge !== null) fail(`${label}.expected_has_dge differs from its rule`)
  return expectation
}

export function knowledgeBadgeOriginMismatchKeysV1(originEntry, badgeExpectations) {
  const entry = object(originEntry, 'knowledge badge origin')
  const expectations = array(badgeExpectations, 'knowledge badge expectations').map((expectation, index) => validateExpectation(expectation, `knowledge badge expectation ${index}`))
  const api = object(entry.api, `knowledge badge ${entry.origin}.api`)
  const overview = object(entry.hydrated_overview, `knowledge badge ${entry.origin}.hydrated_overview`)
  const statuses = array(api.statuses, `knowledge badge ${entry.origin}.api.statuses`)
  const cards = array(overview.cards, `knowledge badge ${entry.origin}.hydrated_overview.cards`)
  const ingredientIds = expectations.map((expectation) => expectation.ingredient_id)
  if (!sameSet(statuses.map((status) => status.ingredient_id), ingredientIds) || !sameSet(cards.map((card) => card.ingredient_id), ingredientIds)) fail(`knowledge badge ${entry.origin} API/DOM ingredient sets differ from the request`)
  if (api.body_hash !== null && !HASH.test(api.body_hash ?? '') || !['OK', 'HTTP_ERROR', 'NETWORK_ERROR'].includes(api.fetch_status) || api.fetch_status === 'OK' && (api.http_status !== 200 || typeof api.content_type !== 'string' || !api.content_type.toLowerCase().includes('json'))) fail(`knowledge badge ${entry.origin} API transport evidence is invalid`)
  if (typeof overview.route_ready !== 'boolean' || typeof overview.api_request_url !== 'string' || !overview.api_request_url || !overview.viewport) fail(`knowledge badge ${entry.origin} hydrated overview evidence is invalid`)
  const mismatches = []
  if (api.fetch_status !== 'OK') mismatches.push('api_fetch')
  if (overview.route_ready !== true) mismatches.push('overview_route')
  if (overview.api_request_url !== api.url) mismatches.push('overview_api_request_url')
  for (const expectation of expectations) {
    const status = object(statuses.find((candidate) => candidate.ingredient_id === expectation.ingredient_id), `knowledge badge ${entry.origin} status ${expectation.ingredient_id}`)
    const card = object(cards.find((candidate) => candidate.ingredient_id === expectation.ingredient_id), `knowledge badge ${entry.origin} card ${expectation.ingredient_id}`)
    if (typeof status.status_present !== 'boolean' || typeof status.has_studies !== 'boolean' || typeof status.has_dge !== 'boolean' || !Number.isInteger(card.card_match_count) || card.card_match_count < 0 || typeof card.studies_visible !== 'boolean' || typeof card.dge_visible !== 'boolean') fail(`knowledge badge ${entry.origin} status/card ${expectation.ingredient_id} fields are invalid`)
    for (const key of ['studies_rule', 'expected_has_studies', 'dge_rule', 'expected_has_dge']) if (status[key] !== expectation[key]) fail(`knowledge badge ${entry.origin} status ${expectation.ingredient_id}.${key} differs from the request`)
    if (!status.status_present) mismatches.push(`${expectation.ingredient_id}:status_missing`)
    if (card.card_match_count !== 1) mismatches.push(`${expectation.ingredient_id}:card_count`)
    if (status.has_studies !== card.studies_visible) mismatches.push(`${expectation.ingredient_id}:studies_parity`)
    if (status.has_dge !== card.dge_visible) mismatches.push(`${expectation.ingredient_id}:dge_parity`)
    if (expectation.studies_rule !== 'API_DOM_PARITY' && status.has_studies !== expectation.expected_has_studies) mismatches.push(`${expectation.ingredient_id}:studies_expected`)
    if (expectation.dge_rule === 'PRESERVE' && status.has_dge !== expectation.expected_has_dge) mismatches.push(`${expectation.ingredient_id}:dge_expected`)
  }
  return mismatches
}

export function validateKnowledgeBadgeReadbackV1({ badge, releaseHash, affectedIngredientIds, badgeExpectations, receiptOrigins }) {
  object(badge, 'knowledge badge readback')
  const canonicalIngredientIds = [...affectedIngredientIds].sort((left, right) => left - right)
  if (badge.schema !== 'knowledge_badge_readback.v1' || badge.release_hash !== releaseHash || canonicalJsonHash(badge.affected_ingredient_ids) !== canonicalJsonHash(canonicalIngredientIds) || canonicalJsonHash(affectedIngredientIds) !== canonicalJsonHash(canonicalIngredientIds)) fail('knowledge badge readback schema/release/ingredient binding is invalid')
  const expectations = array(badgeExpectations, 'renderer badge expectations').map((entry, index) => validateExpectation(entry, `renderer badge expectation ${index}`))
  if (canonicalJsonHash(expectations) !== canonicalJsonHash([...expectations].sort((left, right) => left.ingredient_id - right.ingredient_id)) || canonicalJsonHash(expectations.map((entry) => entry.ingredient_id)) !== canonicalJsonHash(canonicalIngredientIds)) fail('renderer badge expectations must be sorted and cover every affected ingredient exactly once')
  const origins = array(badge.origin_results, 'knowledge badge origin_results')
  if (canonicalJsonHash(origins.map((entry) => entry.origin)) !== canonicalJsonHash(receiptOrigins)) fail('knowledge badge origin order differs from renderer origins')
  let anyMismatch = false
  for (const entry of origins) {
    let origin
    try { origin = new URL(entry.origin).href } catch { fail(`knowledge badge origin ${entry.origin} is invalid`) }
    if (origin !== entry.origin) fail(`knowledge badge origin ${entry.origin} is not normalized`)
    const expectedApiUrl = new URL(`/api/knowledge?cfcheck=${encodeURIComponent(releaseHash)}`, origin).href
    const expectedOverviewUrl = new URL(`/wissen?cfcheck=${encodeURIComponent(releaseHash)}`, origin).href
    if (entry.api.url !== expectedApiUrl || entry.hydrated_overview.url !== expectedOverviewUrl) fail(`knowledge badge ${origin} URLs do not bind the release cache-bypass request`)
    const computedMismatches = knowledgeBadgeOriginMismatchKeysV1(entry, expectations).sort()
    const mismatch = computedMismatches.length > 0
    if (!['MATCH', 'MISMATCH'].includes(entry.result) || entry.result !== (mismatch ? 'MISMATCH' : 'MATCH') || canonicalJsonHash(entry.mismatches) !== canonicalJsonHash(computedMismatches)) fail(`knowledge badge ${origin} result/mismatches do not match its evidence`)
    anyMismatch ||= mismatch
  }
  const aggregateMismatches = origins.flatMap((entry) => entry.mismatches).sort()
  if (!['MATCH', 'MISMATCH'].includes(badge.result) || badge.result !== (anyMismatch ? 'MISMATCH' : 'MATCH') || canonicalJsonHash(badge.mismatches) !== canonicalJsonHash(aggregateMismatches)) fail('knowledge badge aggregate result/mismatches do not match its origin evidence')
  return badge
}
