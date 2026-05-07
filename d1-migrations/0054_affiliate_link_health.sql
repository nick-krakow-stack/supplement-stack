-- Sprint 0 quick win: latest health state for catalog product shop links.
-- The checker updates one row per product and keeps failure streak metadata
-- without storing secrets or request payloads.

CREATE TABLE IF NOT EXISTS affiliate_link_health (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id INTEGER NOT NULL UNIQUE,
  url TEXT NOT NULL,
  host TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'unchecked'
    CHECK (status IN ('unchecked', 'ok', 'failed', 'timeout', 'invalid')),
  http_status INTEGER
    CHECK (http_status IS NULL OR (http_status BETWEEN 100 AND 599)),
  failure_reason TEXT,
  check_method TEXT
    CHECK (check_method IS NULL OR check_method IN ('HEAD', 'GET')),
  final_url TEXT,
  redirected INTEGER NOT NULL DEFAULT 0 CHECK (redirected IN (0, 1)),
  response_time_ms INTEGER
    CHECK (response_time_ms IS NULL OR response_time_ms >= 0),
  consecutive_failures INTEGER NOT NULL DEFAULT 0
    CHECK (consecutive_failures >= 0),
  first_failure_at TEXT,
  last_failure_at TEXT,
  last_success_at TEXT,
  last_checked_at TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_affiliate_link_health_status_checked
  ON affiliate_link_health(status, last_checked_at);

CREATE INDEX IF NOT EXISTS idx_affiliate_link_health_host
  ON affiliate_link_health(host);

CREATE INDEX IF NOT EXISTS idx_affiliate_link_health_failures
  ON affiliate_link_health(consecutive_failures DESC, last_failure_at DESC);
