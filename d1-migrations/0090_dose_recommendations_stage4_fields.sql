PRAGMA foreign_keys = ON;

ALTER TABLE dose_recommendations ADD COLUMN stage4_cluster_id TEXT;
ALTER TABLE dose_recommendations ADD COLUMN stage4_source_kind TEXT CHECK (stage4_source_kind IS NULL OR stage4_source_kind IN ('dge', 'study', 'country_framework', 'influencer'));
ALTER TABLE dose_recommendations ADD COLUMN knowledge_article_slug TEXT;
ALTER TABLE dose_recommendations ADD COLUMN amount_type TEXT CHECK (amount_type IS NULL OR amount_type IN ('recommended_amount', 'tested_amount', 'reference_value'));
ALTER TABLE dose_recommendations ADD COLUMN reported_amount_text TEXT;
ALTER TABLE dose_recommendations ADD COLUMN stack_role TEXT CHECK (stack_role IS NULL OR stack_role IN ('standard', 'alternative', 'tie', 'not_in_stack'));
ALTER TABLE dose_recommendations ADD COLUMN stack_visible INTEGER NOT NULL DEFAULT 0 CHECK (stack_visible IN (0, 1));
ALTER TABLE dose_recommendations ADD COLUMN relevance_reason TEXT;
ALTER TABLE dose_recommendations ADD COLUMN is_controversial INTEGER NOT NULL DEFAULT 0 CHECK (is_controversial IN (0, 1));
ALTER TABLE dose_recommendations ADD COLUMN valid_from TEXT;
ALTER TABLE dose_recommendations ADD COLUMN valid_until TEXT;
ALTER TABLE dose_recommendations ADD COLUMN stage4_status TEXT CHECK (stage4_status IS NULL OR stage4_status IN ('draft', 'active', 'archived'));

CREATE INDEX IF NOT EXISTS idx_dose_recommendations_stage4_visibility
  ON dose_recommendations(ingredient_id, stage4_status, stack_visible);

CREATE INDEX IF NOT EXISTS idx_dose_recommendations_stage4_cluster
  ON dose_recommendations(stage4_cluster_id)
  WHERE stage4_cluster_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_dose_recommendations_knowledge_article_slug
  ON dose_recommendations(knowledge_article_slug)
  WHERE knowledge_article_slug IS NOT NULL;
