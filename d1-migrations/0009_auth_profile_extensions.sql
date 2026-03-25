PRAGMA foreign_keys = ON;

-- Extend users table for Google OAuth, smoker status, DSGVO health consent, soft-delete
ALTER TABLE users ADD COLUMN google_id TEXT;
ALTER TABLE users ADD COLUMN is_smoker INTEGER NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN health_consent INTEGER NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN health_consent_at TEXT;
ALTER TABLE users ADD COLUMN deleted_at TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_google_id ON users(google_id) WHERE google_id IS NOT NULL;
