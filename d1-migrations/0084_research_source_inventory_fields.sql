PRAGMA foreign_keys = ON;

ALTER TABLE ingredient_research_sources ADD COLUMN source_language TEXT;
ALTER TABLE ingredient_research_sources ADD COLUMN source_country TEXT;
ALTER TABLE ingredient_research_sources ADD COLUMN publication_year INTEGER;
ALTER TABLE ingredient_research_sources ADD COLUMN authors TEXT;
ALTER TABLE ingredient_research_sources ADD COLUMN journal TEXT;
ALTER TABLE ingredient_research_sources ADD COLUMN pdf_url TEXT;
ALTER TABLE ingredient_research_sources ADD COLUMN pdf_storage_key TEXT;
ALTER TABLE ingredient_research_sources ADD COLUMN pdf_status TEXT CHECK (pdf_status IS NULL OR pdf_status IN ('not_checked', 'available', 'stored', 'paywalled', 'unavailable'));
ALTER TABLE ingredient_research_sources ADD COLUMN archive_url TEXT;
ALTER TABLE ingredient_research_sources ADD COLUMN topic_summary TEXT;
ALTER TABLE ingredient_research_sources ADD COLUMN study_design TEXT;
ALTER TABLE ingredient_research_sources ADD COLUMN participant_count INTEGER;
ALTER TABLE ingredient_research_sources ADD COLUMN duration_summary TEXT;
ALTER TABLE ingredient_research_sources ADD COLUMN meta_summary TEXT;
ALTER TABLE ingredient_research_sources ADD COLUMN stage2_priority TEXT CHECK (stage2_priority IS NULL OR stage2_priority IN ('niedrig', 'mittel', 'hoch'));

CREATE INDEX IF NOT EXISTS idx_ingredient_research_sources_publication_year
  ON ingredient_research_sources(ingredient_id, publication_year);

CREATE INDEX IF NOT EXISTS idx_ingredient_research_sources_stage2_priority
  ON ingredient_research_sources(ingredient_id, stage2_priority)
  WHERE stage2_priority IS NOT NULL;
