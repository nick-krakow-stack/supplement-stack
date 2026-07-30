PRAGMA foreign_keys = ON;

ALTER TABLE knowledge_articles ADD COLUMN article_layer TEXT NOT NULL DEFAULT 'main_article';

UPDATE knowledge_articles
SET article_layer = 'main_article'
WHERE article_layer IS NULL
   OR article_layer NOT IN ('main_article', 'single_study');

CREATE INDEX IF NOT EXISTS idx_knowledge_articles_layer_status_updated
  ON knowledge_articles(article_layer, status, updated_at);
