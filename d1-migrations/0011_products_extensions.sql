PRAGMA foreign_keys = ON;

-- Affiliate disclosure flag
ALTER TABLE products ADD COLUMN is_affiliate INTEGER NOT NULL DEFAULT 0;
-- R2 storage key for product image (e.g. "products/21/abc123.webp")
ALTER TABLE products ADD COLUMN image_r2_key TEXT;
-- Soft-discontinuation
ALTER TABLE products ADD COLUMN discontinued_at TEXT;
ALTER TABLE products ADD COLUMN replacement_id INTEGER REFERENCES products(id) ON DELETE SET NULL;
-- Serving size for cost/dosage calculation
ALTER TABLE products ADD COLUMN serving_size REAL;
ALTER TABLE products ADD COLUMN serving_unit TEXT;
ALTER TABLE products ADD COLUMN servings_per_container INTEGER;
ALTER TABLE products ADD COLUMN container_count INTEGER NOT NULL DEFAULT 1;

CREATE INDEX IF NOT EXISTS idx_products_discontinued ON products(discontinued_at) WHERE discontinued_at IS NOT NULL;
