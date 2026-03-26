PRAGMA foreign_keys = ON;

-- google_id already exists in production DB (added manually earlier)
-- Only add the columns that are truly missing

ALTER TABLE users ADD COLUMN role TEXT NOT NULL DEFAULT 'user';
ALTER TABLE users ADD COLUMN is_smoker INTEGER NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN health_consent INTEGER NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN health_consent_at TEXT;
ALTER TABLE users ADD COLUMN deleted_at TEXT;

-- Ensure the unique index on google_id exists (idempotent)
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_google_id ON users(google_id) WHERE google_id IS NOT NULL;
