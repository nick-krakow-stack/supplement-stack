ALTER TABLE knowledge_articles
ADD COLUMN seo_json TEXT
CHECK (seo_json IS NULL OR json_valid(seo_json));
