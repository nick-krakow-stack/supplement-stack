PRAGMA foreign_keys = ON;

ALTER TABLE page_view_events ADD COLUMN visitor_id TEXT;

CREATE INDEX IF NOT EXISTS idx_page_view_events_visitor
  ON page_view_events(visitor_id, created_at);

CREATE TABLE IF NOT EXISTS signup_attribution (
  user_id INTEGER PRIMARY KEY,
  visitor_id TEXT,
  first_referrer_host TEXT,
  first_referrer_source TEXT,
  first_landing_path TEXT,
  first_seen_at TEXT,
  last_referrer_host TEXT,
  last_referrer_source TEXT,
  last_landing_path TEXT,
  last_seen_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_signup_attribution_created
  ON signup_attribution(created_at);

CREATE INDEX IF NOT EXISTS idx_signup_attribution_first_source
  ON signup_attribution(first_referrer_source, first_referrer_host, created_at);

CREATE INDEX IF NOT EXISTS idx_signup_attribution_last_source
  ON signup_attribution(last_referrer_source, last_referrer_host, created_at);
