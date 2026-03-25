PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS product_rankings (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id INTEGER NOT NULL UNIQUE,
  rank_score INTEGER NOT NULL DEFAULT 0,
  ranked_at  TEXT    NOT NULL DEFAULT (datetime('now')),
  notes      TEXT,
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_product_rankings_score ON product_rankings(rank_score DESC);

CREATE TABLE IF NOT EXISTS shop_domains (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  domain       TEXT    NOT NULL UNIQUE,
  display_name TEXT    NOT NULL,
  created_at   TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- Seed with common shops
INSERT OR IGNORE INTO shop_domains (domain, display_name) VALUES
  ('amazon.de',       'Amazon'),
  ('amazon.com',      'Amazon'),
  ('amzn.to',         'Amazon'),
  ('amzn.eu',         'Amazon'),
  ('iherb.com',       'iHerb'),
  ('dm.de',           'dm'),
  ('rossmann.de',     'Rossmann'),
  ('vitacost.com',    'Vitacost'),
  ('bodybuilding.com','Bodybuilding.com'),
  ('shop-apotheke.com','Shop Apotheke'),
  ('nu3.de',          'nu3'),
  ('foodspring.de',   'foodspring');
