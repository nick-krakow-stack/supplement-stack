PRAGMA foreign_keys = ON;

ALTER TABLE ingredient_research_sources
  ADD COLUMN is_retracted INTEGER NOT NULL DEFAULT 0 CHECK (is_retracted IN (0, 1));

ALTER TABLE ingredient_research_sources
  ADD COLUMN retraction_checked_at TEXT;

ALTER TABLE ingredient_research_sources
  ADD COLUMN retraction_notice_url TEXT;

ALTER TABLE ingredient_research_sources
  ADD COLUMN evidence_grade TEXT CHECK (evidence_grade IN ('A', 'B', 'C', 'D', 'F'));

CREATE INDEX IF NOT EXISTS idx_ingredient_research_sources_retracted
  ON ingredient_research_sources(is_retracted);

CREATE INDEX IF NOT EXISTS idx_ingredient_research_sources_evidence_grade
  ON ingredient_research_sources(evidence_grade)
  WHERE evidence_grade IS NOT NULL;
