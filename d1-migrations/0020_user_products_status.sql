PRAGMA foreign_keys = ON;

ALTER TABLE user_products ADD COLUMN status TEXT NOT NULL DEFAULT 'pending';
ALTER TABLE user_products ADD COLUMN approved_at TEXT;

CREATE INDEX IF NOT EXISTS idx_user_products_status ON user_products(status);
