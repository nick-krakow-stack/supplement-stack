PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS consent_log (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id      INTEGER NOT NULL,
  consent_type TEXT    NOT NULL,
  granted      INTEGER NOT NULL DEFAULT 1,
  ip_hash      TEXT,
  user_agent   TEXT,
  created_at   TEXT    NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_consent_log_user_id ON consent_log(user_id);
