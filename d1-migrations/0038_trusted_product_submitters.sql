PRAGMA foreign_keys = ON;

ALTER TABLE users ADD COLUMN is_trusted_product_submitter INTEGER NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_users_trusted_product_submitter
  ON users(is_trusted_product_submitter);
