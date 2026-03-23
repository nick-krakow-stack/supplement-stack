-- Fix products table: recreate with correct schema (visibility + moderation_status columns).
-- Safe to run: renames old table, creates new one, copies data, drops old one.

ALTER TABLE products RENAME TO products_old;

CREATE TABLE products (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  brand TEXT,
  form TEXT,
  price REAL NOT NULL,
  shop_link TEXT,
  image_url TEXT,
  moderation_status TEXT NOT NULL DEFAULT 'pending',
  visibility TEXT NOT NULL DEFAULT 'hidden',
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO products (id, name, brand, form, price, shop_link, image_url, moderation_status, visibility, created_at)
SELECT
  id,
  name,
  brand,
  form,
  price,
  shop_link,
  image_url,
  COALESCE(moderation_status, 'pending'),
  COALESCE(visibility, 'hidden'),
  created_at
FROM products_old;

DROP TABLE products_old;

-- Now we can safely create the indexes that need visibility + moderation_status
CREATE INDEX IF NOT EXISTS idx_products_visibility ON products(visibility);
CREATE INDEX IF NOT EXISTS idx_products_moderation_status ON products(moderation_status);
