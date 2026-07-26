export type KnowledgeOverviewArticle = {
  slug: string
  title: string
  summary: string
  reviewed_at: string | null
  updated_at: string | null
  created_at: string | null
  sources_count: number
  ingredients: Array<{
    ingredient_id: number
    name: string | null
    sort_order: number
  }>
  ingredient_ids: number[]
}

export type KnowledgeOverviewNutrientStatus = {
  ingredient_id: number
  name: string | null
  has_dge: boolean
  has_studies: boolean
}

export type KnowledgeOverviewPayload = {
  articles: KnowledgeOverviewArticle[]
  nutrient_statuses: KnowledgeOverviewNutrientStatus[]
  total: number
}

type OverviewRowKind = 'article' | 'status'

type OverviewProjectionRow = {
  row_kind: OverviewRowKind
  row_key: string
  payload_json: string
}

type OverviewProjectionSnapshotRow = OverviewProjectionRow & {
  active_generation: number
  source_version: number
  projected_source_version: number
  record_count: number
  content_hash: string | null
  refreshed_at: string | null
}

export type KnowledgeOverviewProjectionState = {
  available: boolean
  active_generation: number
  source_version: number
  projected_source_version: number
  record_count: number
  content_hash: string | null
  refreshed_at: string | null
  rows: OverviewProjectionRow[]
}

export type KnowledgeOverviewProjectionAudit = {
  schema: 'knowledge_overview_projection_audit.v1'
  available: boolean
  consistent: boolean
  active_generation: number
  source_version: number
  projected_source_version: number
  projected_record_count: number
  live_record_count: number
  projected_content_hash: string | null
  live_content_hash: string
  refreshed_at: string | null
  differing_row_keys: string[]
}

type D1RunResultLike = {
  meta?: {
    changes?: number
  }
}

const OVERVIEW_CTE = `
  WITH
  ordered_article_ingredients AS (
    SELECT
      kai.article_slug,
      kai.ingredient_id,
      i.name,
      kai.sort_order
    FROM knowledge_article_ingredients kai
    LEFT JOIN ingredients i ON i.id = kai.ingredient_id
    ORDER BY kai.article_slug ASC, kai.sort_order ASC, i.name ASC, kai.ingredient_id ASC
  ),
  article_ingredients AS (
    SELECT
      article_slug,
      json_group_array(json_object(
        'ingredient_id', ingredient_id,
        'name', name,
        'sort_order', sort_order
      )) AS ingredients_json,
      json_group_array(ingredient_id) AS ingredient_ids_json
    FROM ordered_article_ingredients
    GROUP BY article_slug
  ),
  source_counts AS (
    SELECT article_slug, COUNT(*) AS sources_count
    FROM knowledge_article_sources
    GROUP BY article_slug
  ),
  study_status AS (
    SELECT kai.ingredient_id, 1 AS has_studies
    FROM knowledge_articles ka
    JOIN knowledge_article_ingredients kai ON kai.article_slug = ka.slug
    JOIN study_interpretation_records sir
      ON sir.knowledge_article_slug = ka.slug
     AND sir.ingredient_id = kai.ingredient_id
     AND sir.status = 'accepted'
    WHERE ka.status = 'published'
      AND ka.article_layer = 'single_study'
    GROUP BY kai.ingredient_id
  ),
  dge_status AS (
    SELECT dr.ingredient_id, 1 AS has_dge
    FROM dose_recommendations dr
    WHERE dr.source_type = 'official'
      AND dr.is_active = 1
      AND (
        LOWER(COALESCE(dr.source_label, '')) LIKE '%dge%'
        OR LOWER(COALESCE(dr.source_label, '')) LIKE '%deutsche gesellschaft f%'
        OR LOWER(COALESCE(dr.source_url, '')) LIKE '%dge%'
        OR dr.stage4_source_kind = 'dge'
      )
      AND (
        (
          dr.stage4_status IS NULL
          AND dr.stage4_cluster_id IS NULL
          AND dr.stage4_source_kind IS NULL
          AND dr.knowledge_article_slug IS NULL
          AND dr.amount_type IS NULL
          AND dr.reported_amount_text IS NULL
          AND dr.stack_role IS NULL
          AND dr.relevance_reason IS NULL
          AND dr.valid_from IS NULL
          AND dr.valid_until IS NULL
          AND COALESCE(dr.is_controversial, 0) = 0
        )
        OR (dr.stage4_status = 'active' AND dr.stack_visible = 1)
      )
    GROUP BY dr.ingredient_id
  ),
  overview_rows AS (
    SELECT
      'article' AS row_kind,
      ka.slug AS row_key,
      json_object(
        'slug', ka.slug,
        'title', ka.title,
        'summary', ka.summary,
        'reviewed_at', ka.reviewed_at,
        'updated_at', ka.updated_at,
        'created_at', ka.created_at,
        'sources_count', COALESCE(sc.sources_count, 0),
        'ingredients', json(COALESCE(ai.ingredients_json, '[]')),
        'ingredient_ids', json(COALESCE(ai.ingredient_ids_json, '[]'))
      ) AS payload_json
    FROM knowledge_articles ka
    LEFT JOIN source_counts sc ON sc.article_slug = ka.slug
    LEFT JOIN article_ingredients ai ON ai.article_slug = ka.slug
    WHERE ka.status = 'published'
      AND ka.article_layer = 'main_article'

    UNION ALL

    SELECT
      'status' AS row_kind,
      CAST(i.id AS TEXT) AS row_key,
      json_object(
        'ingredient_id', i.id,
        'name', i.name,
        'has_dge', CASE WHEN ds.has_dge = 1 THEN json('true') ELSE json('false') END,
        'has_studies', CASE WHEN ss.has_studies = 1 THEN json('true') ELSE json('false') END
      ) AS payload_json
    FROM ingredients i
    LEFT JOIN dge_status ds ON ds.ingredient_id = i.id
    LEFT JOIN study_status ss ON ss.ingredient_id = i.id
    WHERE i.is_active = 1
  )
`

const LIVE_OVERVIEW_ROWS_SQL = `${OVERVIEW_CTE}
  SELECT row_kind, row_key, payload_json
  FROM overview_rows
  ORDER BY row_kind ASC, row_key ASC
`

const LOAD_PROJECTION_SQL = `
  SELECT
    m.active_generation,
    m.source_version,
    m.projected_source_version,
    m.record_count,
    m.content_hash,
    m.refreshed_at,
    r.row_kind,
    r.row_key,
    r.payload_json
  FROM knowledge_overview_projection_meta m
  LEFT JOIN knowledge_overview_projection_rows r
    ON r.generation = m.active_generation
  WHERE m.id = 1
  ORDER BY r.row_kind ASC, r.row_key ASC
`

const INSERT_PROJECTION_GENERATION_SQL = `${OVERVIEW_CTE}
  INSERT OR REPLACE INTO knowledge_overview_projection_rows (
    generation,
    row_kind,
    row_key,
    payload_json,
    created_at
  )
  SELECT ?, rows.row_kind, rows.row_key, rows.payload_json, datetime('now')
  FROM overview_rows rows
  JOIN knowledge_overview_projection_meta meta ON meta.id = 1
  WHERE meta.source_version = ?
    AND meta.active_generation = ?
`

const ACTIVATE_PROJECTION_GENERATION_SQL = `
  UPDATE knowledge_overview_projection_meta
  SET
    active_generation = ?,
    projected_source_version = source_version,
    record_count = ?,
    content_hash = ?,
    refreshed_at = datetime('now'),
    updated_at = datetime('now')
  WHERE id = 1
    AND active_generation = ?
    AND source_version = ?
    AND (
      SELECT COUNT(*)
      FROM knowledge_overview_projection_rows
      WHERE generation = ?
    ) = ?
`

function isProjectionRowKind(value: unknown): value is OverviewRowKind {
  return value === 'article' || value === 'status'
}

function normalizeProjectionRows(rows: OverviewProjectionRow[]): OverviewProjectionRow[] {
  return [...rows].sort((left, right) => {
    const kindOrder = left.row_kind.localeCompare(right.row_kind)
    return kindOrder || left.row_key.localeCompare(right.row_key)
  })
}

function parseOverviewArticle(value: unknown): KnowledgeOverviewArticle | null {
  if (!value || typeof value !== 'object') return null
  const row = value as Record<string, unknown>
  if (typeof row.slug !== 'string' || typeof row.title !== 'string' || typeof row.summary !== 'string') return null
  const ingredients = Array.isArray(row.ingredients)
    ? row.ingredients.flatMap((candidate) => {
      if (!candidate || typeof candidate !== 'object') return []
      const ingredient = candidate as Record<string, unknown>
      const ingredientId = Number(ingredient.ingredient_id)
      if (!Number.isInteger(ingredientId) || ingredientId <= 0) return []
      return [{
        ingredient_id: ingredientId,
        name: typeof ingredient.name === 'string' ? ingredient.name : null,
        sort_order: Number.isFinite(Number(ingredient.sort_order)) ? Number(ingredient.sort_order) : 0,
      }]
    })
    : []
  const ingredientIds = Array.isArray(row.ingredient_ids)
    ? row.ingredient_ids.map(Number).filter((id) => Number.isInteger(id) && id > 0)
    : ingredients.map((ingredient) => ingredient.ingredient_id)
  return {
    slug: row.slug,
    title: row.title,
    summary: row.summary,
    reviewed_at: typeof row.reviewed_at === 'string' ? row.reviewed_at : null,
    updated_at: typeof row.updated_at === 'string' ? row.updated_at : null,
    created_at: typeof row.created_at === 'string' ? row.created_at : null,
    sources_count: Math.max(0, Number(row.sources_count) || 0),
    ingredients,
    ingredient_ids: ingredientIds,
  }
}

function parseOverviewStatus(value: unknown): KnowledgeOverviewNutrientStatus | null {
  if (!value || typeof value !== 'object') return null
  const row = value as Record<string, unknown>
  const ingredientId = Number(row.ingredient_id)
  if (!Number.isInteger(ingredientId) || ingredientId <= 0) return null
  return {
    ingredient_id: ingredientId,
    name: typeof row.name === 'string' ? row.name : null,
    has_dge: row.has_dge === true || row.has_dge === 1,
    has_studies: row.has_studies === true || row.has_studies === 1,
  }
}

function articleTimestamp(article: KnowledgeOverviewArticle): string {
  return article.reviewed_at ?? article.updated_at ?? article.created_at ?? ''
}

export function buildKnowledgeOverviewPayload(rows: OverviewProjectionRow[]): KnowledgeOverviewPayload | null {
  const articles: KnowledgeOverviewArticle[] = []
  const statuses: KnowledgeOverviewNutrientStatus[] = []
  for (const row of rows) {
    let parsed: unknown
    try {
      parsed = JSON.parse(row.payload_json)
    } catch {
      return null
    }
    if (row.row_kind === 'article') {
      const article = parseOverviewArticle(parsed)
      if (!article || article.slug !== row.row_key) return null
      articles.push(article)
      continue
    }
    const status = parseOverviewStatus(parsed)
    if (!status || String(status.ingredient_id) !== row.row_key) return null
    statuses.push(status)
  }

  articles.sort((left, right) => {
    const dateOrder = articleTimestamp(right).localeCompare(articleTimestamp(left))
    return dateOrder || left.title.localeCompare(right.title, 'de') || left.slug.localeCompare(right.slug)
  })
  statuses.sort((left, right) => left.ingredient_id - right.ingredient_id)
  return { articles, nutrient_statuses: statuses, total: articles.length }
}

export async function loadLiveKnowledgeOverviewRows(db: D1Database): Promise<OverviewProjectionRow[]> {
  const { results } = await db.prepare(LIVE_OVERVIEW_ROWS_SQL).all<OverviewProjectionRow>()
  return normalizeProjectionRows((results ?? []).filter((row: OverviewProjectionRow) => isProjectionRowKind(row.row_kind)))
}

export async function loadKnowledgeOverviewProjection(db: D1Database): Promise<KnowledgeOverviewProjectionState> {
  try {
    const { results } = await db.prepare(LOAD_PROJECTION_SQL).all<OverviewProjectionSnapshotRow>()
    const snapshots = results ?? []
    const head = snapshots[0]
    if (!head) {
      return {
        available: false,
        active_generation: 0,
        source_version: 0,
        projected_source_version: 0,
        record_count: 0,
        content_hash: null,
        refreshed_at: null,
        rows: [],
      }
    }
    const rows = snapshots.flatMap((row: OverviewProjectionSnapshotRow) => {
      if (!isProjectionRowKind(row.row_kind) || typeof row.row_key !== 'string' || typeof row.payload_json !== 'string') return []
      return [{ row_kind: row.row_kind, row_key: row.row_key, payload_json: row.payload_json }]
    })
    return {
      available: true,
      active_generation: Number(head.active_generation),
      source_version: Number(head.source_version),
      projected_source_version: Number(head.projected_source_version),
      record_count: Number(head.record_count),
      content_hash: head.content_hash,
      refreshed_at: head.refreshed_at,
      rows: normalizeProjectionRows(rows),
    }
  } catch {
    return {
      available: false,
      active_generation: 0,
      source_version: 0,
      projected_source_version: 0,
      record_count: 0,
      content_hash: null,
      refreshed_at: null,
      rows: [],
    }
  }
}

async function projectionIsCurrent(state: KnowledgeOverviewProjectionState): Promise<boolean> {
  if (!state.available
    || state.source_version !== state.projected_source_version
    || state.record_count !== state.rows.length
    || !state.content_hash
    || !/^sha256:[a-f0-9]{64}$/.test(state.content_hash)
    || buildKnowledgeOverviewPayload(state.rows) === null
  ) return false

  return await hashKnowledgeOverviewRows(state.rows) === state.content_hash
}

export async function hashKnowledgeOverviewRows(rows: OverviewProjectionRow[]): Promise<string> {
  const canonical = normalizeProjectionRows(rows)
    .map((row) => `${row.row_kind}\u001f${row.row_key}\u001f${row.payload_json}`)
    .join('\u001e')
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(canonical))
  return `sha256:${Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('')}`
}

export async function refreshKnowledgeOverviewProjection(
  db: D1Database,
  guard: {
    active_generation: number
    source_version: number
    expected_record_count: number
    content_hash: string
  },
): Promise<{ applied: boolean; active_generation: number }> {
  if (!Number.isInteger(guard.active_generation) || guard.active_generation < 1) return { applied: false, active_generation: 0 }
  if (!Number.isInteger(guard.source_version) || guard.source_version < 1) return { applied: false, active_generation: 0 }
  if (!Number.isInteger(guard.expected_record_count) || guard.expected_record_count < 0) return { applied: false, active_generation: 0 }
  if (!/^sha256:[a-f0-9]{64}$/.test(guard.content_hash)) return { applied: false, active_generation: 0 }

  // Recompute the values inside the guarded executor. Callers cannot switch the
  // active generation with a plausible-looking count or hash that does not
  // describe the canonical source rows at write time.
  const liveRows = await loadLiveKnowledgeOverviewRows(db)
  if (liveRows.length !== guard.expected_record_count) return { applied: false, active_generation: guard.active_generation }
  if (await hashKnowledgeOverviewRows(liveRows) !== guard.content_hash) {
    return { applied: false, active_generation: guard.active_generation }
  }

  const nextGeneration = Math.max(guard.active_generation, guard.source_version) + 1
  const results = await db.batch([
    db.prepare(INSERT_PROJECTION_GENERATION_SQL).bind(
      nextGeneration,
      guard.source_version,
      guard.active_generation,
    ),
    db.prepare(ACTIVATE_PROJECTION_GENERATION_SQL).bind(
      nextGeneration,
      guard.expected_record_count,
      guard.content_hash,
      guard.active_generation,
      guard.source_version,
      nextGeneration,
      guard.expected_record_count,
    ),
  ]) as D1RunResultLike[]
  const updateResult = results[results.length - 1]
  return {
    applied: Number(updateResult?.meta?.changes ?? 0) === 1,
    active_generation: nextGeneration,
  }
}

export async function loadKnowledgeOverview(db: D1Database): Promise<{
  payload: KnowledgeOverviewPayload
  projection: KnowledgeOverviewProjectionState
  used_projection: boolean
  refresh_scheduled: boolean
  live_rows: OverviewProjectionRow[] | null
}> {
  const projection = await loadKnowledgeOverviewProjection(db)
  if (await projectionIsCurrent(projection)) {
    const payload = buildKnowledgeOverviewPayload(projection.rows)
    if (payload) {
      return { payload, projection, used_projection: true, refresh_scheduled: false, live_rows: null }
    }
  }

  const liveRows = await loadLiveKnowledgeOverviewRows(db)
  const payload = buildKnowledgeOverviewPayload(liveRows)
  if (!payload) throw new Error('Knowledge overview source projection is invalid')
  return {
    payload,
    projection,
    used_projection: false,
    refresh_scheduled: projection.available,
    live_rows: liveRows,
  }
}

function rowMap(rows: OverviewProjectionRow[]): Map<string, string> {
  return new Map(rows.map((row) => [`${row.row_kind}:${row.row_key}`, row.payload_json]))
}

export async function auditKnowledgeOverviewProjection(db: D1Database): Promise<KnowledgeOverviewProjectionAudit> {
  const [projection, liveRows] = await Promise.all([
    loadKnowledgeOverviewProjection(db),
    loadLiveKnowledgeOverviewRows(db),
  ])
  const liveHash = await hashKnowledgeOverviewRows(liveRows)
  const projectedHash = projection.rows.length > 0 ? await hashKnowledgeOverviewRows(projection.rows) : null
  const projected = rowMap(projection.rows)
  const live = rowMap(liveRows)
  const differingKeys = new Set<string>()
  for (const [key, value] of projected) {
    if (live.get(key) !== value) differingKeys.add(key)
  }
  for (const [key, value] of live) {
    if (projected.get(key) !== value) differingKeys.add(key)
  }
  return {
    schema: 'knowledge_overview_projection_audit.v1',
    available: projection.available,
    consistent: projection.available
      && projection.source_version === projection.projected_source_version
      && projection.record_count === projection.rows.length
      && projection.rows.length === liveRows.length
      && projection.content_hash === projectedHash
      && projectedHash === liveHash,
    active_generation: projection.active_generation,
    source_version: projection.source_version,
    projected_source_version: projection.projected_source_version,
    projected_record_count: projection.rows.length,
    live_record_count: liveRows.length,
    projected_content_hash: projectedHash,
    live_content_hash: liveHash,
    refreshed_at: projection.refreshed_at,
    differing_row_keys: [...differingKeys].sort().slice(0, 100),
  }
}

export async function refreshKnowledgeOverviewProjectionIfNeeded(db: D1Database): Promise<boolean> {
  const projection = await loadKnowledgeOverviewProjection(db)
  if (!projection.available || await projectionIsCurrent(projection)) return false
  const liveRows = await loadLiveKnowledgeOverviewRows(db)
  const contentHash = await hashKnowledgeOverviewRows(liveRows)
  const result = await refreshKnowledgeOverviewProjection(db, {
    active_generation: projection.active_generation,
    source_version: projection.source_version,
    expected_record_count: liveRows.length,
    content_hash: contentHash,
  })
  return result.applied
}
