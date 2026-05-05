PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS ingredient_research_status (
  ingredient_id INTEGER PRIMARY KEY,
  research_status TEXT NOT NULL DEFAULT 'unreviewed'
    CHECK (research_status IN ('unreviewed', 'researching', 'needs_review', 'reviewed', 'stale', 'blocked')),
  calculation_status TEXT NOT NULL DEFAULT 'not_started'
    CHECK (calculation_status IN ('not_started', 'in_progress', 'needs_review', 'ready', 'not_applicable', 'blocked')),
  internal_notes TEXT,
  blog_url TEXT,
  reviewed_at TEXT,
  review_due_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (ingredient_id) REFERENCES ingredients(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS ingredient_research_sources (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ingredient_id INTEGER NOT NULL,
  source_kind TEXT NOT NULL CHECK (source_kind IN ('official', 'study')),
  organization TEXT,
  country TEXT,
  region TEXT,
  population TEXT,
  recommendation_type TEXT,
  no_recommendation INTEGER NOT NULL DEFAULT 0 CHECK (no_recommendation IN (0, 1)),
  dose_min REAL CHECK (dose_min IS NULL OR dose_min >= 0),
  dose_max REAL CHECK (dose_max IS NULL OR dose_max >= 0),
  dose_unit TEXT,
  per_kg_body_weight INTEGER NOT NULL DEFAULT 0 CHECK (per_kg_body_weight IN (0, 1)),
  frequency TEXT,
  study_type TEXT,
  evidence_quality TEXT,
  duration TEXT,
  outcome TEXT,
  finding TEXT,
  source_title TEXT,
  source_url TEXT,
  doi TEXT,
  pubmed_id TEXT,
  notes TEXT,
  source_date TEXT,
  reviewed_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  CHECK (dose_min IS NULL OR dose_max IS NULL OR dose_min <= dose_max),
  FOREIGN KEY (ingredient_id) REFERENCES ingredients(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_ingredient_research_status_status
  ON ingredient_research_status(research_status, calculation_status);

CREATE INDEX IF NOT EXISTS idx_ingredient_research_status_due
  ON ingredient_research_status(review_due_at);

CREATE INDEX IF NOT EXISTS idx_ingredient_research_sources_ingredient_kind
  ON ingredient_research_sources(ingredient_id, source_kind);

CREATE INDEX IF NOT EXISTS idx_ingredient_research_sources_reviewed
  ON ingredient_research_sources(reviewed_at);

CREATE INDEX IF NOT EXISTS idx_ingredient_research_sources_pubmed
  ON ingredient_research_sources(pubmed_id)
  WHERE pubmed_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_ingredient_research_sources_doi
  ON ingredient_research_sources(doi)
  WHERE doi IS NOT NULL;
