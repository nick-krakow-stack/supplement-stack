-- Phase 0.2: explicit affiliate ownership for catalog products.
-- Additive compatibility migration: products.is_affiliate remains in place
-- until later cleanup, and is dual-written by application code.

ALTER TABLE products ADD COLUMN affiliate_owner_type TEXT NOT NULL DEFAULT 'none'
  CHECK (affiliate_owner_type IN ('none', 'nick', 'user'));

ALTER TABLE products ADD COLUMN affiliate_owner_user_id INTEGER
  REFERENCES users(id) ON DELETE SET NULL;

UPDATE products
SET affiliate_owner_type = CASE
  WHEN COALESCE(is_affiliate, 0) = 1 THEN 'nick'
  ELSE 'none'
END;

UPDATE products
SET affiliate_owner_user_id = NULL
WHERE affiliate_owner_type IN ('none', 'nick');

UPDATE products
SET is_affiliate = CASE
  WHEN affiliate_owner_type IN ('nick', 'user') THEN 1
  ELSE 0
END;

CREATE INDEX IF NOT EXISTS idx_products_affiliate_owner
  ON products(affiliate_owner_type, affiliate_owner_user_id);
