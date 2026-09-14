import { readFileSync } from 'node:fs'
import { canonicalJsonHash, sha256Bytes } from './content-validation.mjs'
import { knowledgeArticleHead, knowledgeArticleJsonLd, knowledgeMetadataText } from '../../functions/lib/knowledge-seo.mjs'

export const SEO_METADATA_CORRECTION_MODE = 'seo_metadata_correction'
export const SEO_CORRECTION_CACHE_TABLE = 'knowledge_overview_projection_meta'
const ORIGIN = 'https://supplementstack.de'
const HASH = /^sha256:[a-f0-9]{64}$/
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
const fail = message => { throw new Error(`SEO correction: ${message}`) }
const same = (a, b) => canonicalJsonHash(a) === canonicalJsonHash(b)
const plainObject = value => value && typeof value === 'object' && !Array.isArray(value)
const without = (value, keys) => Object.fromEntries(Object.entries(value).filter(([key]) => !keys.includes(key)))
export const hashSeoCorrectionArtifactV1 = value => canonicalJsonHash(without(value, ['content_hash']))
export const sealSeoCorrectionArtifactV1 = value => ({ ...value, content_hash: hashSeoCorrectionArtifactV1(value) })
function artifact(value, schema) {
  if (!plainObject(value) || value.schema !== schema || value.content_hash !== hashSeoCorrectionArtifactV1(value)) fail(`${schema} schema/hash differs`)
  return value
}
function exactKeys(value, keys, label) {
  if (!plainObject(value) || !same(Object.keys(value).sort(), [...keys].sort())) fail(`${label} fields differ`)
}
function identifier(value, label) { if (typeof value !== 'string' || !value.trim()) fail(`${label} is required`); return value }
function timestamp(value, label) { if (typeof value !== 'string' || !/^\d{4}-\d\d-\d\dT.*Z$/.test(value) || !Number.isFinite(Date.parse(value))) fail(`${label} is not UTC ISO`); return value }
function targets(values, label) {
  if (!Array.isArray(values) || !values.length || values.some(value => !SLUG.test(value)) || new Set(values).size !== values.length) fail(`${label} requires distinct slugs`)
}
export const SEO_CORRECTION_TABLES = [
  { key: 'article', table: 'knowledge_articles', column: 'slug', pk: ['slug'], order: 'slug' },
  { key: 'source_rows', table: 'knowledge_article_sources', column: 'article_slug', pk: ['id'], order: 'article_slug,sort_order,id' },
  { key: 'ingredient_rows', table: 'knowledge_article_ingredients', column: 'article_slug', pk: ['article_slug', 'ingredient_id'], order: 'article_slug,sort_order,ingredient_id' },
  { key: 'part_rows', table: 'knowledge_article_parts', column: 'article_slug', pk: ['article_slug', 'ingredient_id', 'part_id'], order: 'article_slug,ingredient_id,part_id' },
  { key: 'interpretation_rows', table: 'study_interpretation_records', column: 'knowledge_article_slug', pk: ['id'], order: 'knowledge_article_slug,source_id,id' },
]
export function seoCorrectionSnapshotV1(prestate, slug) {
  const rows = prestate.articles.filter(row => row.slug === slug)
  if (rows.length !== 1) fail(`${slug} expected one authoritative article`)
  return Object.fromEntries(SEO_CORRECTION_TABLES.map(({ key, column }) => [key, key === 'article' ? rows[0] : prestate[key].filter(row => row[column] === slug)]))
}
function validateSnapshot(snapshot, slug) {
  exactKeys(snapshot, SEO_CORRECTION_TABLES.map(item => item.key), `${slug} complete snapshot`)
  const row = snapshot.article
  if (!plainObject(row) || row.slug !== slug || row.status !== 'published' || !Number.isInteger(row.version) || row.version < 0
    || !['main_article', 'single_study'].includes(row.article_layer) || !Object.hasOwn(row, 'seo_json')) fail(`${slug} is not an exact published prestate`)
  for (const { key, column, pk } of SEO_CORRECTION_TABLES) {
    const rows = key === 'article' ? [row] : snapshot[key]
    if (!Array.isArray(rows)) fail(`${slug} missing ${key}`)
    const keys = new Set()
    for (const entry of rows) {
      if (!plainObject(entry) || entry[column] !== slug || Object.keys(entry).some(name => !/^[a-z][a-z0-9_]*$/.test(name))
        || Object.values(entry).some(value => value !== null && !['string', 'number'].includes(typeof value)) || pk.some(name => entry[name] == null)) fail(`${slug} unsafe/incomplete ${key} row`)
      const identity = JSON.stringify(pk.map(name => entry[name]))
      if (keys.has(identity)) fail(`${slug} duplicate ${key} identity`)
      keys.add(identity)
    }
  }
}
function storedSeo(row) {
  if (row.seo_json === null) return null
  let value
  try { value = JSON.parse(row.seo_json) } catch { fail(`${row.slug} stored SEO is malformed`) }
  if (!plainObject(value) || !plainObject(value.json_ld) || typeof value.meta_title !== 'string' || typeof value.meta_description !== 'string'
    || value.canonical_url !== `${ORIGIN}/wissen/${row.slug}` || value.canonical_path !== `/wissen/${row.slug}`
    || value.robots !== 'index,follow' || value.indexable !== true) fail(`${row.slug} stored SEO canonical/robots/schema is invalid`)
  return value
}
export function currentSeoMetadataV1(row) {
  const seo = storedSeo(row)
  return { meta_title: knowledgeMetadataText(seo?.meta_title ?? row.title), meta_description: knowledgeMetadataText(seo?.meta_description ?? row.summary), seo_json: row.seo_json }
}
function metaText(value, min, max, label) {
  if (typeof value !== 'string' || value !== value.normalize('NFC') || value.trim() !== value || /[\u0000-\u001f\u007f<>\uFFFD]/u.test(value)
    || /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/u.test(value)
    || /\*\*|__|\[[^\]]*\]\(|Ã[\u0080-\u00bf]|Â[\u0080-\u00bf]|â€/.test(value) || /\s{2}/u.test(value) || knowledgeMetadataText(value) !== value
    || [...value].length < min || [...value].length > max) fail(`${label} must be plain UTF-8/NFC text of ${min}..${max} characters`)
  return value
}
export function projectSeoMetadataCorrectionV1(row, after) {
  exactKeys(after, ['meta_title', 'meta_description'], `${row.slug} after`)
  metaText(after.meta_title, 15, 70, `${row.slug} meta title`)
  metaText(after.meta_description, 40, 180, `${row.slug} meta description`)
  if (normalizeSeoUniquenessV1(after.meta_title) === normalizeSeoUniquenessV1(after.meta_description)) fail(`${row.slug} title and description are identical`)
  const before = storedSeo(row)
  const canonicalPath = `/wissen/${row.slug}`
  const base = before ?? { canonical_url: `${ORIGIN}${canonicalPath}`, canonical_path: canonicalPath, robots: 'index,follow', indexable: true,
    json_ld: knowledgeArticleJsonLd(row)['@graph'][0] }
  return JSON.stringify({ ...base, meta_title: after.meta_title, meta_description: after.meta_description })
}
export const normalizeSeoUniquenessV1 = value => knowledgeMetadataText(value).normalize('NFKC').toLocaleLowerCase('de-DE')
export function assertSeoMetadataUniquenessV1(inventory, replacements = []) {
  targets(inventory.map(row => row.slug), 'published inventory')
  const replacementMap = new Map(replacements.map(row => [row.slug, row.after]))
  for (const key of ['meta_title', 'meta_description']) {
    const seen = new Map()
    for (const row of inventory) {
      const value = normalizeSeoUniquenessV1((replacementMap.get(row.slug) ?? currentSeoMetadataV1(row))[key])
      if (!value || seen.has(value)) fail(`${key} is empty/duplicate for ${row.slug}${seen.has(value) ? ` and ${seen.get(value)}` : ''}`)
      seen.set(value, row.slug)
    }
  }
}
const inventoryRow = row => Object.fromEntries(['slug', 'status', 'version', 'title', 'summary', 'seo_json'].map(key => [key, row[key]]))
function validateProposalEntry(proposal, before) {
  exactKeys(proposal, ['slug', 'expected_version', 'expected_status', 'before_article_hash', 'complete_prestate_hash', 'before', 'after', 'rationale', 'evidence'], `${proposal.slug} proposal`)
  const row = before.article
  if (proposal.expected_version !== row.version || proposal.expected_status !== row.status || proposal.before_article_hash !== canonicalJsonHash(row)
    || proposal.complete_prestate_hash !== canonicalJsonHash(before) || !same(proposal.before, currentSeoMetadataV1(row))) fail(`${row.slug} proposal prestate is stale`)
  identifier(proposal.rationale, `${row.slug} rationale`)
  if (!Array.isArray(proposal.evidence) || !proposal.evidence.length) fail(`${row.slug} requires exact article evidence`)
  for (const evidence of proposal.evidence) {
    exactKeys(evidence, ['field', 'quote'], `${row.slug} evidence`)
    if (!['title', 'summary', 'body', 'conclusion'].includes(evidence.field) || typeof evidence.quote !== 'string' || !evidence.quote.trim()
      || typeof row[evidence.field] !== 'string' || !row[evidence.field].includes(evidence.quote)) fail(`${row.slug} evidence is not in the unchanged article`)
  }
  const after = projectSeoMetadataCorrectionV1(row, proposal.after)
  if (same(proposal.after, without(proposal.before, ['seo_json']))) fail(`${row.slug} has no actual metadata change`)
  return after
}
export function buildSeoMetadataCorrectionInputV1({ runId, prestate, proposal, schemaRows }) {
  artifact(prestate, 'published_article_metadata_prestate.v1')
  artifact(proposal, 'seo_metadata_correction_proposal.v1')
  if (prestate.read_only !== true || proposal.before_snapshot_hash !== prestate.content_hash) fail('proposal does not bind the read-only snapshot')
  const articles = proposal.proposals.map(entry => {
    const before = seoCorrectionSnapshotV1(prestate, entry.slug)
    return { slug: entry.slug, before, before_hash: canonicalJsonHash(before), after_seo_json: validateProposalEntry(entry, before) }
  })
  const base = { schema: 'seo_metadata_correction_input.v1', run_id: runId, database_id: prestate.database_id, publish_target: prestate.database_name,
    public_base_url: `${ORIGIN}/`, prestate_hash: prestate.content_hash, proposal,
    inventory: prestate.articles.map(inventoryRow), articles, schema_rows: schemaRows }
  const input = sealSeoCorrectionArtifactV1(base)
  validateSeoMetadataCorrectionInputV1(input)
  return input
}
export function validateSeoMetadataCorrectionInputV1(input) {
  artifact(input, 'seo_metadata_correction_input.v1')
  exactKeys(input, ['schema', 'run_id', 'database_id', 'publish_target', 'public_base_url', 'prestate_hash', 'proposal', 'inventory', 'articles', 'schema_rows', 'content_hash'], 'input')
  identifier(input.run_id, 'run ID'); identifier(input.database_id, 'database ID'); identifier(input.publish_target, 'database name')
  if (input.public_base_url !== `${ORIGIN}/` || !HASH.test(input.prestate_hash)) fail('input origin/snapshot binding differs')
  if (!Array.isArray(input.schema_rows) || !input.schema_rows.length) fail('full schema/trigger binding is required')
  for (const row of input.schema_rows) {
    exactKeys(row, ['type', 'name', 'tbl_name', 'sql'], 'schema object')
    if (![...SEO_CORRECTION_TABLES.map(table => table.table), SEO_CORRECTION_CACHE_TABLE].includes(row.tbl_name) || !['table', 'index', 'trigger'].includes(row.type)) fail('schema includes an unrelated object')
  }
  if (new Set(input.schema_rows.map(row => row.name)).size !== input.schema_rows.length
    || [...SEO_CORRECTION_TABLES.map(table => table.table), SEO_CORRECTION_CACHE_TABLE].some(table => input.schema_rows.filter(row => row.type === 'table' && row.name === table).length !== 1)) fail('schema table/identity coverage differs')
  const proposal = artifact(input.proposal, 'seo_metadata_correction_proposal.v1')
  exactKeys(proposal, ['schema', 'editor_id', 'created_at', 'before_snapshot_hash', 'source_inventory_hash', 'proposals', 'content_hash'], 'proposal')
  identifier(proposal.editor_id, 'editor ID'); timestamp(proposal.created_at, 'editor timestamp')
  if (proposal.before_snapshot_hash !== input.prestate_hash || !HASH.test(proposal.source_inventory_hash)) fail('proposal source snapshot/inventory hash differs')
  targets(input.articles.map(row => row.slug), 'affected articles')
  if (!same(proposal.proposals.map(row => row.slug), input.articles.map(row => row.slug))) fail('proposal target coverage/order differs')
  for (const row of input.inventory) {
    exactKeys(row, ['slug', 'status', 'version', 'title', 'summary', 'seo_json'], 'inventory row')
    if (row.status !== 'published') fail('inventory includes an unpublished article')
  }
  for (let index = 0; index < input.articles.length; index++) {
    const target = input.articles[index]
    exactKeys(target, ['slug', 'before', 'before_hash', 'after_seo_json'], 'target')
    validateSnapshot(target.before, target.slug)
    if (target.before_hash !== canonicalJsonHash(target.before) || validateProposalEntry(proposal.proposals[index], target.before) !== target.after_seo_json
      || !same(input.inventory.find(row => row.slug === target.slug), inventoryRow(target.before.article))) fail(`${target.slug} frozen target/inventory differs`)
  }
  assertSeoMetadataUniquenessV1(input.inventory, proposal.proposals)
  return input
}
function exactOrderHash(order) { return canonicalJsonHash(without(order, ['work_order_id'])) }
export function buildSeoMetadataCorrectionReviewOrderV1(input) {
  validateSeoMetadataCorrectionInputV1(input)
  const order = { schema: 'nutrient_content_work_order.v2', run_id: input.run_id, kind: 'seo_metadata_correction_review', execution_class: 'external',
    reasoning_tier: 'xhigh', assignee: { role: 'seo-metadata-correction-reviewer' }, input_hash: input.content_hash, proposal_hash: input.proposal.content_hash,
    affected_slugs: input.articles.map(row => row.slug),
    execution_receipt: { root: 'run', path: 'seo-metadata-review.work-order-execution-receipt.v1.json', schema: 'work_order_execution_receipt.v1' } }
  return { ...order, work_order_id: exactOrderHash(order) }
}
export function buildSeoMetadataCorrectionReleaseV1({ input, review, reviewWorkOrder, reviewExecutionReceipt, publicBefore }) {
  const order = buildSeoMetadataCorrectionReviewOrderV1(input)
  if (!same(order, reviewWorkOrder)) fail('review Order does not bind the exact input')
  artifact(review, 'seo_metadata_correction_review.v1')
  if (review.result !== 'PASS' || review.input_hash !== input.content_hash || review.proposal_hash !== input.proposal.content_hash || review.work_order_id !== order.work_order_id
    || review.reviewer?.role !== order.assignee.role || !review.reviewer.id || review.reviewer.id === input.proposal.editor_id) fail('independent review binding/result differs')
  timestamp(review.reviewed_at, 'reviewed_at')
  if (!same(review.articles?.map(row => row.slug), input.articles.map(row => row.slug))) fail('independent review does not cover every target exactly')
  for (let index = 0; index < input.articles.length; index++) {
    const decision = review.articles[index], target = input.articles[index]
    if (decision.result !== 'PASS' || decision.before_hash !== target.before_hash || decision.after_seo_hash !== canonicalJsonHash(target.after_seo_json)
      || !decision.reason?.trim() || !same(decision.checks, { supported_by_unchanged_article: 'PASS', limitations_preserved: 'PASS', no_new_claims_numbers_sources_or_advice: 'PASS', useful_distinct_metadata: 'PASS' })) fail(`${target.slug} independent decision is incomplete/stale`)
  }
  const timing = artifact(reviewExecutionReceipt, 'work_order_execution_receipt.v1')
  if (timing.run_id !== input.run_id || timing.work_order_id !== order.work_order_id || timing.execution_class !== order.execution_class || timing.reasoning_tier !== order.reasoning_tier
    || !same(timing.executor, review.reviewer) || timing.result !== 'PASS' || timing.result_hash !== review.content_hash) fail('review execution receipt binding differs')
  timestamp(timing.started_at, 'review started_at'); timestamp(timing.finished_at, 'review finished_at')
  if (Date.parse(timing.started_at) < Date.parse(input.proposal.created_at) || Date.parse(review.reviewed_at) < Date.parse(timing.started_at)
    || Date.parse(timing.finished_at) < Date.parse(review.reviewed_at)) fail('review execution chronology differs')
  artifact(publicBefore, 'seo_metadata_correction_public_before.v1')
  if (publicBefore.input_hash !== input.content_hash) fail('public before does not bind input')
  validatePublicObservations(publicBefore, input, 'before')
  const base = { schema: 'content_release.v2', operation: 'article_correction', mode: SEO_METADATA_CORRECTION_MODE, atomic: true,
    run_id: input.run_id, database_id: input.database_id, publish_target: input.publish_target, public_base_url: input.public_base_url,
    input, review, review_work_order: order, review_execution_receipt: timing, public_before: publicBefore }
  return { ...base, release_hash: canonicalJsonHash(base) }
}
export function validateSeoMetadataCorrectionReleaseV1(release) {
  const expected = buildSeoMetadataCorrectionReleaseV1({ input: release.input, review: release.review, reviewWorkOrder: release.review_work_order, reviewExecutionReceipt: release.review_execution_receipt, publicBefore: release.public_before })
  if (!same(expected, release)) fail('release full-contract hash differs')
  return release
}
export function buildSeoMetadataCorrectionApplyOrderV1({ release, releasePath, receiptPath = 'seo-content-publish-receipt.v2.json' }) {
  validateSeoMetadataCorrectionReleaseV1(release)
  const order = { schema: 'nutrient_content_work_order.v2', run_id: release.run_id, kind: 'publication_apply', execution_class: 'deterministic', wave_index: null,
    reasoning_tier: 'standard', assignee: { role: 'deterministic-content-publication-executor' }, task: { mode: release.mode, release_hash: release.release_hash },
    inputs: [{ name: 'content_release', schema: 'content_release.v2', root: 'run', path: releasePath, byte_hash: sha256Bytes(readFileSync(releasePath)), content_hash: release.release_hash }],
    outputs: [{ name: 'publish_receipt', schema: 'content_publish_receipt.v2', root: 'run', path: receiptPath }],
    execution_receipt: { root: 'run', path: 'seo-publication-apply.work-order-execution-receipt.v1.json', schema: 'work_order_execution_receipt.v1' } }
  return { ...order, work_order_id: exactOrderHash(order) }
}
export function seoCorrectionAfterSnapshotV1(target) {
  return { ...target.before, article: { ...target.before.article, seo_json: target.after_seo_json, version: target.before.article.version + 1 } }
}
function validatePublicObservations(observation, input, side) {
  timestamp(observation.checked_at, 'readback checked_at')
  if (!plainObject(observation.snapshots) || !same(Object.keys(observation.snapshots).sort(), input.articles.map(row => row.slug).sort())) fail('public readback target coverage differs')
  if (!observation.browser?.product?.trim()) fail('actual browser provenance is missing')
  for (const target of input.articles) {
    const entry = observation.snapshots[target.slug], url = `${ORIGIN}/wissen/${target.slug}`
      const api = entry?.api
      if (api?.http_status !== 200 || api.url !== `${ORIGIN}/api/knowledge/${target.slug}` || !plainObject(api.article)) fail(`${target.slug} ${side} API observation missing`)
      const expected = side === 'before' ? target.before.article : seoCorrectionAfterSnapshotV1(target).article
      for (const field of ['slug', 'title', 'summary', 'body', 'conclusion', 'created_at', 'updated_at', 'reviewed_at', 'update_reason', 'article_layer', 'featured_image_url', 'featured_image_r2_key', 'dose_min', 'dose_max', 'dose_unit', 'product_note']) {
        if (Object.hasOwn(expected, field) && (!Object.hasOwn(api.article, field) || api.article[field] !== expected[field])) fail(`${target.slug} ${side} API ${field} differs`)
      }
      if (!same(api.article.seo, side === 'before' ? storedSeo(target.before.article) : JSON.parse(target.after_seo_json))) fail(`${target.slug} ${side} API SEO differs`)
      const head = knowledgeArticleHead(api.article)
      for (const surface of ['raw_html', 'desktop', 'mobile']) {
        const state = surface === 'raw_html' ? entry.raw_html : entry.viewports?.[surface]
        if (state?.http_status !== 200 || state.url !== url || !HASH.test(state.body_hash) || !state.article_text?.trim() || !Array.isArray(state.links)
          || state.h1 !== knowledgeMetadataText(expected.title) || state.title !== head.title || state.description !== head.description
          || state.canonical !== head.canonicalUrl || state.robots !== head.robots || !same(state.json_ld, head.jsonLd)) fail(`${target.slug} ${side} ${surface} head/content observation differs`)
      }
  }
}
export function validateSeoCorrectionReadbackV1(observation, release) {
  artifact(observation, 'seo_metadata_correction_readback.v1')
  if (observation.release_hash !== release.release_hash) fail('public readback release differs')
  if (Date.parse(observation.checked_at) < Date.parse(release.public_before.checked_at)) fail('public readback predates baseline')
  validatePublicObservations(observation, release.input, 'after')
  for (const target of release.input.articles) {
    const before = release.public_before.snapshots[target.slug], after = observation.snapshots[target.slug]
    if (!same(without(before.api.article, ['seo', 'version']), without(after.api.article, ['seo', 'version']))) fail(`${target.slug} public API non-SEO bytes changed`)
    for (const surface of ['raw_html', 'desktop', 'mobile']) {
      const oldState = surface === 'raw_html' ? before.raw_html : before.viewports[surface]
      const newState = surface === 'raw_html' ? after.raw_html : after.viewports[surface]
      if (oldState.article_text !== newState.article_text || !same(oldState.links, newState.links) || !same(oldState.json_ld, newState.json_ld)) fail(`${target.slug} ${surface} article/source/schema changed`)
      for (const field of ['images', 'times', 'article_html']) {
        if ((Object.hasOwn(oldState, field) || Object.hasOwn(newState, field)) && !same(oldState[field], newState[field])) fail(`${target.slug} ${surface} ${field} changed`)
      }
    }
  }
  return sealSeoCorrectionArtifactV1({ ...observation, result: 'MATCH' })
}
