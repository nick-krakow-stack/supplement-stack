PRAGMA foreign_keys = ON;

ALTER TABLE users ADD COLUMN last_seen_at TEXT;

CREATE INDEX IF NOT EXISTS idx_users_last_seen_at
  ON users(last_seen_at);

CREATE TABLE IF NOT EXISTS stack_email_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER,
  stack_id INTEGER,
  event_type TEXT NOT NULL DEFAULT 'single_stack',
  stack_count INTEGER NOT NULL DEFAULT 1,
  recipient_domain TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (stack_id) REFERENCES stacks(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_stack_email_events_created
  ON stack_email_events(created_at);

CREATE INDEX IF NOT EXISTS idx_stack_email_events_user
  ON stack_email_events(user_id, created_at);

CREATE TABLE IF NOT EXISTS account_deletion_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  deleted_user_id INTEGER,
  had_verified_email INTEGER NOT NULL DEFAULT 0,
  stack_count INTEGER NOT NULL DEFAULT 0,
  user_product_count INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_account_deletion_events_created
  ON account_deletion_events(created_at);

CREATE TABLE IF NOT EXISTS page_view_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  path TEXT NOT NULL,
  referrer_host TEXT,
  referrer_source TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_page_view_events_created
  ON page_view_events(created_at);

CREATE INDEX IF NOT EXISTS idx_page_view_events_referrer
  ON page_view_events(referrer_source, referrer_host, created_at);
