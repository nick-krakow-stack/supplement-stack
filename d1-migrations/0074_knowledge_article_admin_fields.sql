PRAGMA foreign_keys = ON;

ALTER TABLE knowledge_articles ADD COLUMN conclusion TEXT;
ALTER TABLE knowledge_articles ADD COLUMN featured_image_r2_key TEXT;
ALTER TABLE knowledge_articles ADD COLUMN featured_image_url TEXT;
ALTER TABLE knowledge_articles ADD COLUMN dose_min REAL CHECK (dose_min IS NULL OR dose_min >= 0);
ALTER TABLE knowledge_articles ADD COLUMN dose_max REAL CHECK (dose_max IS NULL OR dose_max >= 0);
ALTER TABLE knowledge_articles ADD COLUMN dose_unit TEXT;
ALTER TABLE knowledge_articles ADD COLUMN product_note TEXT;

CREATE TABLE IF NOT EXISTS knowledge_article_sources (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  article_slug TEXT NOT NULL,
  label TEXT NOT NULL,
  url TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (article_slug) REFERENCES knowledge_articles(slug) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_knowledge_article_sources_article_sort
  ON knowledge_article_sources(article_slug, sort_order, id);

CREATE TABLE IF NOT EXISTS knowledge_article_ingredients (
  article_slug TEXT NOT NULL,
  ingredient_id INTEGER NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (article_slug, ingredient_id),
  FOREIGN KEY (article_slug) REFERENCES knowledge_articles(slug) ON DELETE CASCADE,
  FOREIGN KEY (ingredient_id) REFERENCES ingredients(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_knowledge_article_ingredients_ingredient
  ON knowledge_article_ingredients(ingredient_id, sort_order, article_slug);

INSERT INTO knowledge_article_sources (article_slug, label, url, sort_order)
SELECT
  ka.slug,
  COALESCE(NULLIF(trim(json_extract(source.value, '$.label')), ''), NULLIF(trim(json_extract(source.value, '$.name')), '')),
  COALESCE(NULLIF(trim(json_extract(source.value, '$.url')), ''), NULLIF(trim(json_extract(source.value, '$.link')), '')),
  CAST(source.key AS INTEGER)
FROM knowledge_articles ka
JOIN json_each(ka.sources_json) AS source
WHERE json_valid(ka.sources_json)
  AND COALESCE(NULLIF(trim(json_extract(source.value, '$.label')), ''), NULLIF(trim(json_extract(source.value, '$.name')), '')) IS NOT NULL
  AND COALESCE(NULLIF(trim(json_extract(source.value, '$.url')), ''), NULLIF(trim(json_extract(source.value, '$.link')), '')) IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM knowledge_article_sources existing
    WHERE existing.article_slug = ka.slug
      AND existing.url = COALESCE(NULLIF(trim(json_extract(source.value, '$.url')), ''), NULLIF(trim(json_extract(source.value, '$.link')), ''))
  );

INSERT OR IGNORE INTO knowledge_article_ingredients (article_slug, ingredient_id, sort_order)
SELECT
  w.article_slug,
  w.ingredient_id,
  MIN(w.id)
FROM ingredient_safety_warnings w
JOIN knowledge_articles ka ON ka.slug = w.article_slug
JOIN ingredients i ON i.id = w.ingredient_id
WHERE w.article_slug IS NOT NULL
GROUP BY w.article_slug, w.ingredient_id;
