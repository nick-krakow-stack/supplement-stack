PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS user_products (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  brand TEXT,
  form TEXT,
  price REAL NOT NULL DEFAULT 0,
  shop_link TEXT,
  image_url TEXT,
  serving_size REAL,
  serving_unit TEXT,
  servings_per_container INTEGER,
  container_count INTEGER NOT NULL DEFAULT 1,
  is_affiliate INTEGER NOT NULL DEFAULT 0,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_user_products_user_id ON user_products(user_id);
