PRAGMA foreign_keys = ON;

-- Phase 1.4 additive foundation for optimistic concurrency.
-- API If-Match/version enforcement is intentionally handled in the next slice.
ALTER TABLE ingredients ADD COLUMN version INTEGER NOT NULL DEFAULT 1;
ALTER TABLE products ADD COLUMN version INTEGER NOT NULL DEFAULT 1;
ALTER TABLE dose_recommendations ADD COLUMN version INTEGER NOT NULL DEFAULT 1;
ALTER TABLE interactions ADD COLUMN version INTEGER NOT NULL DEFAULT 1;
ALTER TABLE ingredient_research_status ADD COLUMN version INTEGER NOT NULL DEFAULT 1;
ALTER TABLE ingredient_display_profiles ADD COLUMN version INTEGER NOT NULL DEFAULT 1;
ALTER TABLE knowledge_articles ADD COLUMN version INTEGER NOT NULL DEFAULT 1;
ALTER TABLE ingredient_safety_warnings ADD COLUMN version INTEGER NOT NULL DEFAULT 1;
ALTER TABLE ingredient_research_sources ADD COLUMN version INTEGER NOT NULL DEFAULT 1;
