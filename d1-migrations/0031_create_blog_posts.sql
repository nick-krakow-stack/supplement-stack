-- Migration 0031: blog_posts
-- Blog-Content liegt als Markdown in R2 (r2_key), nicht in D1 — D1 hält nur Metadaten.
-- featured_image_r2_key speichert den R2-Key (NICHT die volle URL) damit CDN-Domain
-- ohne Daten-Migration getauscht werden kann.
-- linked_ingredient_ids als JSON-Array für interne Verlinkung
-- (z.B. [3,17,42] → Renderer linkt automatisch zu /ingredients/<id>).
-- Übersetzungen liegen in blog_translations (siehe 0030).

CREATE TABLE IF NOT EXISTS blog_posts (
  id                       INTEGER PRIMARY KEY AUTOINCREMENT,

  r2_key                   TEXT NOT NULL UNIQUE,    -- z.B. 'blog/<slug>.md'
  author_id                INTEGER REFERENCES users(id) ON DELETE SET NULL,

  featured_image_r2_key    TEXT,                    -- R2-Key, NICHT URL
  linked_ingredient_ids    TEXT,                    -- JSON-Array von ingredient.id

  status                   TEXT NOT NULL DEFAULT 'draft'
                             CHECK (status IN ('draft','published','archived')),
  published_at             INTEGER,

  created_at               INTEGER NOT NULL DEFAULT (strftime('%s','now')),
  updated_at               INTEGER NOT NULL DEFAULT (strftime('%s','now'))
);

CREATE INDEX IF NOT EXISTS idx_blog_posts_status_published
  ON blog_posts (status, published_at DESC);

CREATE INDEX IF NOT EXISTS idx_blog_posts_author
  ON blog_posts (author_id);
