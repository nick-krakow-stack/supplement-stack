PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS dose_recommendation_sources (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  dose_recommendation_id INTEGER NOT NULL
    REFERENCES dose_recommendations(id) ON DELETE CASCADE,
  research_source_id INTEGER NOT NULL
    REFERENCES ingredient_research_sources(id) ON DELETE RESTRICT,
  relevance_weight INTEGER NOT NULL DEFAULT 50 CHECK (relevance_weight BETWEEN 0 AND 100),
  is_primary INTEGER NOT NULL DEFAULT 0 CHECK (is_primary IN (0, 1)),
  note TEXT,
  created_at INTEGER NOT NULL DEFAULT (strftime('%s','now')),
  UNIQUE (dose_recommendation_id, research_source_id)
);

CREATE INDEX IF NOT EXISTS idx_drs_recommendation
  ON dose_recommendation_sources(dose_recommendation_id);

CREATE INDEX IF NOT EXISTS idx_drs_source
  ON dose_recommendation_sources(research_source_id);

CREATE UNIQUE INDEX IF NOT EXISTS uq_drs_primary
  ON dose_recommendation_sources(dose_recommendation_id)
  WHERE is_primary = 1;

INSERT OR IGNORE INTO dose_recommendation_sources (
  dose_recommendation_id,
  research_source_id,
  relevance_weight,
  is_primary,
  note
)
SELECT
  dr.id,
  irs.id,
  100,
  CASE
    WHEN irs.id = (
      SELECT MIN(irs_primary.id)
      FROM ingredient_research_sources irs_primary
      WHERE irs_primary.ingredient_id = dr.ingredient_id
        AND NULLIF(TRIM(irs_primary.source_url), '') IS NOT NULL
        AND TRIM(irs_primary.source_url) = TRIM(dr.source_url)
    )
    THEN 1
    ELSE 0
  END,
  'Backfilled from dose_recommendations.source_url'
FROM dose_recommendations dr
JOIN ingredient_research_sources irs
  ON irs.ingredient_id = dr.ingredient_id
 AND NULLIF(TRIM(irs.source_url), '') IS NOT NULL
 AND NULLIF(TRIM(dr.source_url), '') IS NOT NULL
 AND TRIM(irs.source_url) = TRIM(dr.source_url);
