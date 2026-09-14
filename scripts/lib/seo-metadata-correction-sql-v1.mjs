import { canonicalJsonHash } from './content-validation.mjs'
import { SEO_CORRECTION_TABLES, SEO_CORRECTION_CACHE_TABLE, assertSeoMetadataUniquenessV1, seoCorrectionAfterSnapshotV1 } from './seo-metadata-correction-v1.mjs'

const same = (left, right) => canonicalJsonHash(left) === canonicalJsonHash(right)
const fail = message => { throw new Error(`SEO correction SQL: ${message}`) }
const INVENTORY_COLUMNS = ['slug', 'status', 'version', 'title', 'summary', 'seo_json']
const PARAMETER_BYTES = 1_900_000 // D1 string limit is 2 MB, including the JSON transport representation.
const groups = (values, size = 50) => Array.from({ length: Math.ceil(values.length / size) }, (_, index) => values.slice(index * size, (index + 1) * size))
const rowKeys = row => Object.keys(row).sort()
const quote = name => { if (!/^[a-z][a-z0-9_]*$/.test(name)) fail('unsafe column'); return `"${name}"` }
const SCHEMA_WHERE = `tbl_name IN (${[...SEO_CORRECTION_TABLES.map(({ table }) => table), SEO_CORRECTION_CACHE_TABLE].map(table => `'${table}'`).join(',')}) AND type IN ('table','index','trigger')`
const schemaSort = rows => [...rows].sort((left, right) => left.name < right.name ? -1 : left.name > right.name ? 1 : 0)
const equalColumns = (keys, alias = 'a', expected = 'e') => keys.map(key => `${alias}.${quote(key)} IS json_extract(${expected}.value,'$.${key}')`).join(' AND ')
const guard = (condition, params, name) => ({ sql: `SELECT CASE WHEN ${condition} THEN 1 ELSE json_extract('seo-${name}-guard-failed','$') END AS exact_guard`, params })
function results(response) {
  if (response?.success !== true || !Array.isArray(response.result) || response.result.some(result => result.success !== true)) fail('D1 result is incomplete/unsuccessful')
  return response.result
}
function stats(response, label, queries) {
  if (results(response).length !== queries.length) fail('D1 batch result count differs')
  return results(response).map((result, index) => ({ phase: label, query_hash: canonicalJsonHash(queries[index]), row_count: result.results?.length ?? 0,
    rows_read: result.meta?.rows_read ?? null, rows_written: result.meta?.rows_written ?? null, duration_ms: result.meta?.duration ?? null }))
}
export async function readSeoMetadataCorrectionStateV1(adapter, targets) {
  const slugs = targets.map(row => row.slug)
  if (!slugs.length || new Set(slugs).size !== slugs.length || slugs.some(slug => !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug))) fail('exact distinct targets required')
  const snapshots = Object.fromEntries(slugs.map(slug => [slug, {}]))
  const queryReceipts = []
  // One compact site inventory, not a source-join multiplicative scan.
  const metadataQueries = [{ sql: `SELECT ${INVENTORY_COLUMNS.join(',')} FROM knowledge_articles WHERE status='published' ORDER BY slug` },
    ...SEO_CORRECTION_TABLES.map(({ table }) => ({ sql: `PRAGMA table_info(${table})` })),
    { sql: `SELECT type,name,tbl_name,sql FROM sqlite_schema WHERE ${SCHEMA_WHERE} ORDER BY name` },
    { sql: `PRAGMA table_info(${SEO_CORRECTION_CACHE_TABLE})` },
    { sql: `SELECT *,datetime('now') AS __seo_utc_now FROM ${SEO_CORRECTION_CACHE_TABLE} WHERE id=1` }]
  const metadata = await adapter.query({ batch: metadataQueries })
  const metadataResults = results(metadata)
  if (metadataResults.length !== metadataQueries.length) fail('metadata result count differs')
  queryReceipts.push(...stats(metadata, 'snapshot-metadata', metadataQueries))
  const schema = Object.fromEntries(SEO_CORRECTION_TABLES.map(({ table }, index) => [table, metadataResults[index + 1].results]))
  schema[SEO_CORRECTION_CACHE_TABLE] = metadataResults.at(-2).results
  if (metadataResults.at(-1).results.length !== 1) fail('expected exactly one cache metadata row')
  const { __seo_utc_now: cacheReadAt, ...cacheRow } = metadataResults.at(-1).results[0]
  for (const selected of groups(slugs)) {
    const placeholders = selected.map(() => '?').join(',')
    const queries = SEO_CORRECTION_TABLES.map(({ table, column, order }) => ({ sql: `SELECT * FROM ${table} WHERE ${column} IN (${placeholders}) ORDER BY ${order}`, params: selected }))
    const response = await adapter.query({ batch: queries }), rows = results(response)
    if (rows.length !== queries.length) fail('snapshot result count differs')
    queryReceipts.push(...stats(response, 'target-snapshot', queries))
    for (const [index, { key, column }] of SEO_CORRECTION_TABLES.entries()) {
      for (const slug of selected) {
        const found = (rows[index].results ?? []).filter(row => row[column] === slug)
        if (key === 'article' && found.length !== 1) fail(`${slug} expected one article, got ${found.length}`)
        snapshots[slug][key] = key === 'article' ? found[0] : found
      }
    }
  }
  return { snapshots, inventory: metadataResults[0].results, schema, schema_rows: metadataResults.at(-3).results,
    cache: { row: cacheRow, read_at_db: cacheReadAt }, query_receipts: queryReceipts }
}

function jsonGroups(rows, maxCount = 50) {
  const output = []; let group = []
  for (const row of rows) {
    if (Buffer.byteLength(JSON.stringify(row), 'utf8') + 2 > PARAMETER_BYTES) fail('one row exceeds safe D1 JSON parameter limit; no non-atomic fallback')
    if (group.length && (group.length >= maxCount || Buffer.byteLength(JSON.stringify([...group, row]), 'utf8') > PARAMETER_BYTES)) { output.push(group); group = [] }
    group.push(row)
  }
  if (group.length) output.push(group)
  return output
}
function indexedExactRowGuards(table, rows, keys, pk) {
  if (!rows.length) return []
  return jsonGroups(rows).map(selected => guard(`NOT EXISTS (
    SELECT 1 FROM json_each(?) e WHERE NOT EXISTS (
      SELECT 1 FROM ${table} a WHERE ${equalColumns(pk)} AND ${equalColumns(keys)}
    ))`, [JSON.stringify(selected)], `${table}-rows`))
}
function snapshotGuards(snapshots, schema) {
  const statements = [], slugs = Object.keys(snapshots)
  for (const { key, table, column, pk } of SEO_CORRECTION_TABLES) {
    const columns = schema[table]?.map(row => row.name).sort()
    if (!columns?.length) fail(`${table} schema is missing`)
    const rows = slugs.flatMap(slug => key === 'article' ? [snapshots[slug].article] : snapshots[slug][key])
    if (rows.some(row => !same(rowKeys(row), columns))) fail(`${table} snapshot omits/adds a database column`)
    for (const selected of groups(slugs)) {
      const count = rows.filter(row => selected.includes(row[column])).length
      statements.push(guard(`(SELECT COUNT(*) FROM ${table} WHERE ${column} IN (SELECT value FROM json_each(?)))=?`, [JSON.stringify(selected), count], `${table}-count`))
    }
    statements.push(...indexedExactRowGuards(table, rows, columns, pk))
  }
  return statements
}
function schemaGuards(schema) {
  return [...SEO_CORRECTION_TABLES.map(({ table }) => table), SEO_CORRECTION_CACHE_TABLE].flatMap(table => {
    const rows = schema[table]
    if (!rows?.length) fail(`${table} missing schema`)
    return [guard(`(SELECT COUNT(*) FROM pragma_table_info('${table}'))=? AND NOT EXISTS (
      SELECT 1 FROM json_each(?) e WHERE NOT EXISTS (SELECT 1 FROM pragma_table_info('${table}') a WHERE ${equalColumns(rowKeys(rows[0]))})
    )`, [rows.length, JSON.stringify(rows)], `${table}-schema`)]
  })
}
function inventoryGuards(inventory) {
  return [guard("(SELECT COUNT(*) FROM knowledge_articles WHERE status='published')=?", [inventory.length], 'published-inventory-count'),
    ...indexedExactRowGuards('knowledge_articles', inventory, INVENTORY_COLUMNS, ['slug'])]
}

// This is only an SQL plan builder. The existing publication_apply dispatcher owns
// execution, one atomic D1 batch, snapshots, and honest pending/complete receipts.
export function buildSeoMetadataCorrectionSqlV1(release, state) {
  if (!same(schemaSort(state.schema_rows), schemaSort(release.input.schema_rows))) fail('schema/trigger binding changed since review')
  const expectedAfter = {}, decisions = [], targetMap = new Map(release.input.articles.map(target => [target.slug, target]))
  const expectedInventoryBefore = release.input.inventory.map(row => {
    const target = targetMap.get(row.slug)
    if (!target) return row
    const current = state.snapshots[row.slug], after = seoCorrectionAfterSnapshotV1(target)
    if (same(current, target.before)) decisions.push({ slug: row.slug, result: 'applied' })
    else if (same(current, after)) decisions.push({ slug: row.slug, result: 'already_current' })
    else fail(`${row.slug} full prestate/version/status/relations differs`)
    expectedAfter[row.slug] = after
    return { ...row, seo_json: current.article.seo_json, version: current.article.version }
  })
  if (decisions.length !== release.input.articles.length || !same(Object.keys(state.snapshots).sort(), [...targetMap.keys()].sort())) fail('persistence target coverage differs')
  if (!same(state.inventory, expectedInventoryBefore)) fail('global metadata inventory changed; refresh and recheck uniqueness')
  const expectedInventoryAfter = expectedInventoryBefore.map(row => targetMap.has(row.slug) ? { ...row, seo_json: targetMap.get(row.slug).after_seo_json, version: targetMap.get(row.slug).before.article.version + 1 } : row)
  assertSeoMetadataUniquenessV1(expectedInventoryAfter)
  const schemaObjectGuard = guard(`(SELECT COUNT(*) FROM sqlite_schema WHERE ${SCHEMA_WHERE})=? AND NOT EXISTS (
    SELECT 1 FROM json_each(?) e WHERE NOT EXISTS (SELECT 1 FROM sqlite_schema a WHERE ${equalColumns(['name', 'type', 'tbl_name', 'sql'])})
  )`, [state.schema_rows.length, JSON.stringify(state.schema_rows)], 'schema-objects')
  // Protect every overwritten value (SEO/version) with the exact site inventory
  // before writing. All remaining article fields and relations are never assigned
  // by this plan or the frozen triggers: their complete postguards below therefore
  // also reject pre-existing/concurrent drift, rolling back the entire batch.
  // Sending those large immutable rows twice exceeds D1's observed envelope limit.
  const batch = [schemaObjectGuard, ...schemaGuards(state.schema), ...inventoryGuards(expectedInventoryBefore)]
  const cache = state.cache.row
  if (cache.id !== 1 || !Number.isInteger(cache.source_version) || !same(rowKeys(cache), state.schema[SEO_CORRECTION_CACHE_TABLE].map(row => row.name).sort())) fail('cache metadata full row/schema differs')
  batch.push(guard(`(SELECT COUNT(*) FROM ${SEO_CORRECTION_CACHE_TABLE})=1`, [], 'cache-row-count'), ...indexedExactRowGuards(SEO_CORRECTION_CACHE_TABLE, [cache], rowKeys(cache), ['id']))
  const writes = decisions.filter(decision => decision.result === 'applied').map(decision => ({ slug: decision.slug, seo_json: expectedAfter[decision.slug].article.seo_json,
    version: targetMap.get(decision.slug).before.article.version, status: 'published' }))
  for (const selected of jsonGroups(writes)) {
    batch.push({ sql: `UPDATE knowledge_articles SET seo_json=(SELECT json_extract(e.value,'$.seo_json') FROM json_each(?1) e WHERE json_extract(e.value,'$.slug')=knowledge_articles.slug),version=version+1
      WHERE slug IN (SELECT json_extract(value,'$.slug') FROM json_each(?1))`, params: [JSON.stringify(selected)] })
    batch.push(guard('changes()=?', [selected.length], 'exact-update-count'))
  }
  // The other inventory rows cannot change inside this transaction: only the
  // explicitly scoped UPDATE above and the bound cache invalidation can write.
  // Target postguards prove the complete projected final inventory by induction.
  batch.push(...snapshotGuards(expectedAfter, state.schema))
  const expectedCache = { ...cache, source_version: cache.source_version + writes.length }
  if (writes.length) {
    const keys = rowKeys(expectedCache).filter(key => key !== 'updated_at')
    batch.push(...indexedExactRowGuards(SEO_CORRECTION_CACHE_TABLE, [Object.fromEntries(keys.map(key => [key, expectedCache[key]]))], keys, ['id']))
    batch.push(guard(`(SELECT COUNT(*) FROM ${SEO_CORRECTION_CACHE_TABLE} WHERE id=1 AND updated_at>=? AND updated_at<=datetime('now') AND updated_at=datetime(updated_at))=1`, [state.cache.read_at_db], 'cache-invalidation-time'))
  } else batch.push(...indexedExactRowGuards(SEO_CORRECTION_CACHE_TABLE, [cache], rowKeys(cache), ['id']))
  for (const statement of batch) {
    if (Buffer.byteLength(statement.sql) > 100_000 || (statement.params?.length ?? 0) > 100 || (statement.params ?? []).some(value => typeof value === 'string' && Buffer.byteLength(value) > 2_000_000)) fail('D1 statement/parameter limit exceeded; atomic batch must not be split')
  }
  return { batch, decisions, expected_after: expectedAfter, expected_inventory_after: expectedInventoryAfter,
    cache_invalidation: { table: SEO_CORRECTION_CACHE_TABLE, expected_source_version_increment: writes.length, before: state.cache, expected_row: expectedCache },
    limits: { statement_count: batch.length, request_bytes: Buffer.byteLength(JSON.stringify({ batch })), maximum_sql_bytes: Math.max(...batch.map(row => Buffer.byteLength(row.sql))),
      maximum_bound_parameters: Math.max(...batch.map(row => row.params?.length ?? 0)), maximum_parameter_bytes: Math.max(0, ...batch.flatMap(row => (row.params ?? []).filter(value => typeof value === 'string').map(value => Buffer.byteLength(value)))) } }
}
export function validateSeoCorrectionCacheReadbackV1(plan, after) {
  const { expected_row: expected, expected_source_version_increment: increment, before } = plan.cache_invalidation
  const actual = after.cache.row
  const keys = Object.keys(expected).filter(key => increment === 0 || key !== 'updated_at')
  if (!same(Object.keys(expected).sort(), Object.keys(actual).sort()) || keys.some(key => actual[key] !== expected[key])
    || (increment > 0 && (!/^\d{4}-\d\d-\d\d \d\d:\d\d:\d\d$/.test(actual.updated_at) || actual.updated_at < before.read_at_db || actual.updated_at > after.cache.read_at_db))) fail('technical cache invalidation readback differs')
  return { result: 'MATCH', table: SEO_CORRECTION_CACHE_TABLE, source_version_increment: increment, before: before.row, after: actual }
}
export function seoCorrectionQueryReceiptsV1(response, label, queries) { return stats(response, label, queries) }
