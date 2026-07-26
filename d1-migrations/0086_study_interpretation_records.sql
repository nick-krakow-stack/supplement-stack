PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS study_interpretation_records (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ingredient_id INTEGER NOT NULL,
  source_id INTEGER NOT NULL,
  research_artifact_id INTEGER,
  knowledge_article_slug TEXT,
  status TEXT NOT NULL DEFAULT 'planned',
  structured_summary_json TEXT NOT NULL DEFAULT '{}',
  stage3_reference_summary TEXT,
  notes TEXT,
  review_notes TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  version INTEGER NOT NULL DEFAULT 1,
  FOREIGN KEY (ingredient_id) REFERENCES ingredients(id) ON DELETE CASCADE,
  FOREIGN KEY (source_id) REFERENCES ingredient_research_sources(id) ON DELETE CASCADE,
  FOREIGN KEY (research_artifact_id) REFERENCES research_pipeline_artifacts(id) ON DELETE SET NULL,
  FOREIGN KEY (knowledge_article_slug) REFERENCES knowledge_articles(slug) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_study_interpretation_records_article
  ON study_interpretation_records(knowledge_article_slug, updated_at);

CREATE INDEX IF NOT EXISTS idx_study_interpretation_records_ingredient_status
  ON study_interpretation_records(ingredient_id, status, updated_at);

CREATE INDEX IF NOT EXISTS idx_study_interpretation_records_source_status
  ON study_interpretation_records(source_id, status, updated_at);

CREATE INDEX IF NOT EXISTS idx_study_interpretation_records_artifact
  ON study_interpretation_records(research_artifact_id);
