PRAGMA foreign_keys = ON;

-- Additive materialized read model for /api/knowledge. Canonical article,
-- ingredient, dose and interpretation tables remain the only source of truth.
-- Generations are append-only so a guarded refresh never destroys the last
-- known-good public projection.
CREATE TABLE IF NOT EXISTS knowledge_overview_projection_meta (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  active_generation INTEGER NOT NULL DEFAULT 1 CHECK (active_generation >= 1),
  source_version INTEGER NOT NULL DEFAULT 1 CHECK (source_version >= 1),
  projected_source_version INTEGER NOT NULL DEFAULT 0 CHECK (projected_source_version >= 0),
  record_count INTEGER NOT NULL DEFAULT 0 CHECK (record_count >= 0),
  content_hash TEXT,
  refreshed_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS knowledge_overview_projection_rows (
  generation INTEGER NOT NULL CHECK (generation >= 1),
  row_kind TEXT NOT NULL CHECK (row_kind IN ('article', 'status')),
  row_key TEXT NOT NULL,
  payload_json TEXT NOT NULL CHECK (json_valid(payload_json)),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (generation, row_kind, row_key)
) WITHOUT ROWID;

CREATE INDEX IF NOT EXISTS idx_knowledge_overview_projection_rows_active
  ON knowledge_overview_projection_rows(generation, row_kind, row_key);

INSERT OR IGNORE INTO knowledge_overview_projection_meta (
  id,
  active_generation,
  source_version,
  projected_source_version,
  record_count
) VALUES (1, 1, 1, 0, 0);

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
INSERT OR REPLACE INTO knowledge_overview_projection_rows (
  generation,
  row_kind,
  row_key,
  payload_json
)
SELECT 1, row_kind, row_key, payload_json
FROM overview_rows;

UPDATE knowledge_overview_projection_meta
SET
  record_count = (
    SELECT COUNT(*)
    FROM knowledge_overview_projection_rows
    WHERE generation = active_generation
  ),
  refreshed_at = datetime('now'),
  updated_at = datetime('now')
WHERE id = 1;

-- Source writes only advance a monotonic version. The public route or the
-- guarded Admin action materializes the next append-only generation.
CREATE TRIGGER IF NOT EXISTS trg_knowledge_overview_ingredients_insert
AFTER INSERT ON ingredients BEGIN
  UPDATE knowledge_overview_projection_meta SET source_version = source_version + 1, updated_at = datetime('now') WHERE id = 1;
END;
CREATE TRIGGER IF NOT EXISTS trg_knowledge_overview_ingredients_update
AFTER UPDATE ON ingredients BEGIN
  UPDATE knowledge_overview_projection_meta SET source_version = source_version + 1, updated_at = datetime('now') WHERE id = 1;
END;
CREATE TRIGGER IF NOT EXISTS trg_knowledge_overview_ingredients_delete
AFTER DELETE ON ingredients BEGIN
  UPDATE knowledge_overview_projection_meta SET source_version = source_version + 1, updated_at = datetime('now') WHERE id = 1;
END;

CREATE TRIGGER IF NOT EXISTS trg_knowledge_overview_articles_insert
AFTER INSERT ON knowledge_articles BEGIN
  UPDATE knowledge_overview_projection_meta SET source_version = source_version + 1, updated_at = datetime('now') WHERE id = 1;
END;
CREATE TRIGGER IF NOT EXISTS trg_knowledge_overview_articles_update
AFTER UPDATE ON knowledge_articles BEGIN
  UPDATE knowledge_overview_projection_meta SET source_version = source_version + 1, updated_at = datetime('now') WHERE id = 1;
END;
CREATE TRIGGER IF NOT EXISTS trg_knowledge_overview_articles_delete
AFTER DELETE ON knowledge_articles BEGIN
  UPDATE knowledge_overview_projection_meta SET source_version = source_version + 1, updated_at = datetime('now') WHERE id = 1;
END;

CREATE TRIGGER IF NOT EXISTS trg_knowledge_overview_article_ingredients_insert
AFTER INSERT ON knowledge_article_ingredients BEGIN
  UPDATE knowledge_overview_projection_meta SET source_version = source_version + 1, updated_at = datetime('now') WHERE id = 1;
END;
CREATE TRIGGER IF NOT EXISTS trg_knowledge_overview_article_ingredients_update
AFTER UPDATE ON knowledge_article_ingredients BEGIN
  UPDATE knowledge_overview_projection_meta SET source_version = source_version + 1, updated_at = datetime('now') WHERE id = 1;
END;
CREATE TRIGGER IF NOT EXISTS trg_knowledge_overview_article_ingredients_delete
AFTER DELETE ON knowledge_article_ingredients BEGIN
  UPDATE knowledge_overview_projection_meta SET source_version = source_version + 1, updated_at = datetime('now') WHERE id = 1;
END;

CREATE TRIGGER IF NOT EXISTS trg_knowledge_overview_article_sources_insert
AFTER INSERT ON knowledge_article_sources BEGIN
  UPDATE knowledge_overview_projection_meta SET source_version = source_version + 1, updated_at = datetime('now') WHERE id = 1;
END;
CREATE TRIGGER IF NOT EXISTS trg_knowledge_overview_article_sources_update
AFTER UPDATE ON knowledge_article_sources BEGIN
  UPDATE knowledge_overview_projection_meta SET source_version = source_version + 1, updated_at = datetime('now') WHERE id = 1;
END;
CREATE TRIGGER IF NOT EXISTS trg_knowledge_overview_article_sources_delete
AFTER DELETE ON knowledge_article_sources BEGIN
  UPDATE knowledge_overview_projection_meta SET source_version = source_version + 1, updated_at = datetime('now') WHERE id = 1;
END;

CREATE TRIGGER IF NOT EXISTS trg_knowledge_overview_interpretations_insert
AFTER INSERT ON study_interpretation_records BEGIN
  UPDATE knowledge_overview_projection_meta SET source_version = source_version + 1, updated_at = datetime('now') WHERE id = 1;
END;
CREATE TRIGGER IF NOT EXISTS trg_knowledge_overview_interpretations_update
AFTER UPDATE ON study_interpretation_records BEGIN
  UPDATE knowledge_overview_projection_meta SET source_version = source_version + 1, updated_at = datetime('now') WHERE id = 1;
END;
CREATE TRIGGER IF NOT EXISTS trg_knowledge_overview_interpretations_delete
AFTER DELETE ON study_interpretation_records BEGIN
  UPDATE knowledge_overview_projection_meta SET source_version = source_version + 1, updated_at = datetime('now') WHERE id = 1;
END;

CREATE TRIGGER IF NOT EXISTS trg_knowledge_overview_doses_insert
AFTER INSERT ON dose_recommendations BEGIN
  UPDATE knowledge_overview_projection_meta SET source_version = source_version + 1, updated_at = datetime('now') WHERE id = 1;
END;
CREATE TRIGGER IF NOT EXISTS trg_knowledge_overview_doses_update
AFTER UPDATE ON dose_recommendations BEGIN
  UPDATE knowledge_overview_projection_meta SET source_version = source_version + 1, updated_at = datetime('now') WHERE id = 1;
END;
CREATE TRIGGER IF NOT EXISTS trg_knowledge_overview_doses_delete
AFTER DELETE ON dose_recommendations BEGIN
  UPDATE knowledge_overview_projection_meta SET source_version = source_version + 1, updated_at = datetime('now') WHERE id = 1;
END;
