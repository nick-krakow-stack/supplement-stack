PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS product_shop_links (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id INTEGER NOT NULL,
  shop_domain_id INTEGER,
  shop_name TEXT,
  url TEXT NOT NULL,
  normalized_host TEXT,
  is_affiliate INTEGER NOT NULL DEFAULT 0,
  affiliate_owner_type TEXT NOT NULL DEFAULT 'none',
  affiliate_owner_user_id INTEGER,
  source_type TEXT NOT NULL DEFAULT 'admin',
  submitted_by_user_id INTEGER,
  is_primary INTEGER NOT NULL DEFAULT 0,
  active INTEGER NOT NULL DEFAULT 1,
  sort_order INTEGER NOT NULL DEFAULT 0,
  version INTEGER NOT NULL DEFAULT 0,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
  FOREIGN KEY (shop_domain_id) REFERENCES shop_domains(id) ON DELETE SET NULL,
  FOREIGN KEY (affiliate_owner_user_id) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (submitted_by_user_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_product_shop_links_product
  ON product_shop_links(product_id, active, sort_order, id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_product_shop_links_primary
  ON product_shop_links(product_id)
  WHERE active = 1 AND is_primary = 1;

INSERT INTO product_shop_links (
  product_id,
  url,
  is_affiliate,
  affiliate_owner_type,
  affiliate_owner_user_id,
  source_type,
  is_primary,
  active,
  sort_order,
  created_at,
  updated_at
)
SELECT
  p.id,
  p.shop_link,
  COALESCE(p.is_affiliate, 0),
  COALESCE(
    p.affiliate_owner_type,
    CASE WHEN COALESCE(p.is_affiliate, 0) = 1 THEN 'nick' ELSE 'none' END
  ),
  p.affiliate_owner_user_id,
  CASE WHEN p.source_user_product_id IS NOT NULL THEN 'user_product' ELSE 'legacy_product' END,
  1,
  1,
  0,
  COALESCE(p.created_at, CURRENT_TIMESTAMP),
  CURRENT_TIMESTAMP
FROM products p
WHERE COALESCE(TRIM(p.shop_link), '') <> ''
  AND NOT EXISTS (
    SELECT 1
    FROM product_shop_links existing
    WHERE existing.product_id = p.id
      AND existing.url = p.shop_link
  );

CREATE TABLE IF NOT EXISTS product_shop_link_health (
  shop_link_id INTEGER PRIMARY KEY,
  url TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'unchecked',
  http_status INTEGER,
  failure_reason TEXT,
  last_checked_at TEXT,
  last_success_at TEXT,
  consecutive_failures INTEGER NOT NULL DEFAULT 0,
  response_time_ms INTEGER,
  final_url TEXT,
  redirected INTEGER NOT NULL DEFAULT 0,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (shop_link_id) REFERENCES product_shop_links(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_product_shop_link_health_status
  ON product_shop_link_health(status, last_checked_at);

INSERT INTO product_shop_link_health (
  shop_link_id,
  url,
  status,
  http_status,
  failure_reason,
  last_checked_at,
  last_success_at,
  consecutive_failures,
  response_time_ms,
  final_url,
  redirected,
  created_at,
  updated_at
)
SELECT
  psl.id,
  COALESCE(lh.url, psl.url),
  COALESCE(lh.status, 'unchecked'),
  lh.http_status,
  lh.failure_reason,
  lh.last_checked_at,
  lh.last_success_at,
  COALESCE(lh.consecutive_failures, 0),
  lh.response_time_ms,
  lh.final_url,
  COALESCE(lh.redirected, 0),
  COALESCE(lh.created_at, CURRENT_TIMESTAMP),
  COALESCE(lh.updated_at, CURRENT_TIMESTAMP)
FROM product_shop_links psl
LEFT JOIN affiliate_link_health lh ON lh.product_id = psl.product_id
WHERE psl.is_primary = 1
  AND NOT EXISTS (
    SELECT 1
    FROM product_shop_link_health existing
    WHERE existing.shop_link_id = psl.id
  );

CREATE TABLE IF NOT EXISTS product_link_clicks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  product_type TEXT NOT NULL DEFAULT 'catalog',
  product_id INTEGER NOT NULL,
  shop_link_id INTEGER,
  user_id INTEGER,
  stack_id INTEGER,
  is_affiliate INTEGER NOT NULL DEFAULT 0,
  url_snapshot TEXT NOT NULL,
  context TEXT,
  referrer_path TEXT,
  clicked_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (shop_link_id) REFERENCES product_shop_links(id) ON DELETE SET NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (stack_id) REFERENCES stacks(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_product_link_clicks_clicked_at
  ON product_link_clicks(clicked_at);

CREATE INDEX IF NOT EXISTS idx_product_link_clicks_product
  ON product_link_clicks(product_type, product_id, clicked_at);

CREATE INDEX IF NOT EXISTS idx_product_link_clicks_shop_link
  ON product_link_clicks(shop_link_id, clicked_at);

CREATE INDEX IF NOT EXISTS idx_product_link_clicks_user
  ON product_link_clicks(user_id, clicked_at);

ALTER TABLE users ADD COLUMN is_blocked_product_submitter INTEGER NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN product_submission_blocked_at TEXT;
ALTER TABLE users ADD COLUMN product_submission_block_reason TEXT;
ALTER TABLE users ADD COLUMN product_submission_blocked_by_user_id INTEGER;

CREATE INDEX IF NOT EXISTS idx_users_blocked_product_submitter
  ON users(is_blocked_product_submitter);

ALTER TABLE product_recommendations ADD COLUMN shop_link_id INTEGER;
ALTER TABLE product_recommendations ADD COLUMN recommendation_slot TEXT;
ALTER TABLE product_recommendations ADD COLUMN sort_order INTEGER NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_product_recommendations_slot
  ON product_recommendations(ingredient_id, recommendation_slot);

CREATE TABLE IF NOT EXISTS legal_documents (
  slug TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  body_md TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'draft',
  published_at TEXT,
  updated_by_user_id INTEGER,
  version INTEGER NOT NULL DEFAULT 0,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (updated_by_user_id) REFERENCES users(id) ON DELETE SET NULL
);

INSERT OR IGNORE INTO legal_documents (slug, title, status)
VALUES
  ('impressum', 'Impressum', 'draft'),
  ('datenschutz', 'Datenschutz', 'draft'),
  ('nutzungsbedingungen', 'Nutzungsbedingungen', 'draft'),
  ('cookie-consent', 'Cookie-Consent', 'draft'),
  ('affiliate-disclosure', 'Affiliate-Hinweis', 'draft');
