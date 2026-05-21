PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS research_pipeline_artifacts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ingredient_id INTEGER NOT NULL,
  stage TEXT NOT NULL
    CHECK (stage IN ('research', 'interpretation', 'writer')),
  agent_id TEXT NOT NULL
    CHECK (agent_id IN (
      'nutrient-research-analyst',
      'clinical-study-interpreter',
      'german-health-science-writer'
    )),
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'pending_review', 'approved', 'needs_changes', 'archived')),
  title TEXT NOT NULL,
  summary TEXT,
  content_markdown TEXT NOT NULL DEFAULT '',
  content_json TEXT,
  evidence_strength TEXT
    CHECK (evidence_strength IS NULL OR evidence_strength IN ('STARK', 'MODERAT', 'SCHWACH', 'UNZUREICHEND')),
  knowledge_article_slug TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  approved_at TEXT,
  version INTEGER NOT NULL DEFAULT 1,
  FOREIGN KEY (ingredient_id) REFERENCES ingredients(id) ON DELETE CASCADE,
  FOREIGN KEY (knowledge_article_slug) REFERENCES knowledge_articles(slug) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_research_pipeline_artifacts_ingredient_stage_status
  ON research_pipeline_artifacts(ingredient_id, stage, status);

CREATE INDEX IF NOT EXISTS idx_research_pipeline_artifacts_knowledge_article_slug
  ON research_pipeline_artifacts(knowledge_article_slug);

CREATE TABLE IF NOT EXISTS ingredient_research_pipeline_status (
  ingredient_id INTEGER NOT NULL,
  stage TEXT NOT NULL
    CHECK (stage IN ('research', 'interpretation', 'writer')),
  agent_id TEXT NOT NULL
    CHECK (agent_id IN (
      'nutrient-research-analyst',
      'clinical-study-interpreter',
      'german-health-science-writer'
    )),
  status TEXT NOT NULL DEFAULT 'not_started'
    CHECK (status IN ('not_started', 'in_progress', 'pending_review', 'approved', 'needs_changes', 'blocked')),
  artifact_id INTEGER,
  started_at TEXT,
  completed_at TEXT,
  approved_at TEXT,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  version INTEGER NOT NULL DEFAULT 1,
  PRIMARY KEY (ingredient_id, stage),
  FOREIGN KEY (ingredient_id) REFERENCES ingredients(id) ON DELETE CASCADE,
  FOREIGN KEY (artifact_id) REFERENCES research_pipeline_artifacts(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_ingredient_research_pipeline_status_stage_status
  ON ingredient_research_pipeline_status(stage, status);

CREATE INDEX IF NOT EXISTS idx_ingredient_research_pipeline_status_artifact
  ON ingredient_research_pipeline_status(artifact_id);

CREATE TABLE IF NOT EXISTS research_artifact_sources (
  artifact_id INTEGER NOT NULL,
  research_source_id INTEGER NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  note TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (artifact_id, research_source_id),
  FOREIGN KEY (artifact_id) REFERENCES research_pipeline_artifacts(id) ON DELETE CASCADE,
  FOREIGN KEY (research_source_id) REFERENCES ingredient_research_sources(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_research_artifact_sources_research_source
  ON research_artifact_sources(research_source_id);

INSERT OR IGNORE INTO ingredient_research_pipeline_status (
  ingredient_id,
  stage,
  agent_id,
  status
)
SELECT
  ingredients.id,
  pipeline_stages.stage,
  pipeline_stages.agent_id,
  'not_started'
FROM ingredients
JOIN (
  SELECT 'research' AS stage, 'nutrient-research-analyst' AS agent_id
  UNION ALL
  SELECT 'interpretation' AS stage, 'clinical-study-interpreter' AS agent_id
  UNION ALL
  SELECT 'writer' AS stage, 'german-health-science-writer' AS agent_id
) AS pipeline_stages
WHERE ingredients.category IN ('vitamin_fat_soluble', 'vitamin_water_soluble');
