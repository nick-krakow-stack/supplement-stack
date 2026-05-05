CREATE TABLE IF NOT EXISTS family_profiles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  first_name TEXT NOT NULL,
  age INTEGER,
  weight REAL,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
  CHECK (length(trim(first_name)) BETWEEN 1 AND 80),
  CHECK (age IS NULL OR (age BETWEEN 0 AND 120)),
  CHECK (weight IS NULL OR (weight > 0 AND weight <= 300)),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_family_profiles_user_id
  ON family_profiles(user_id);

ALTER TABLE stacks
  ADD COLUMN family_member_id INTEGER REFERENCES family_profiles(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_stacks_family_member_id
  ON stacks(family_member_id);

CREATE TABLE IF NOT EXISTS product_link_reports (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  stack_id INTEGER,
  product_type TEXT NOT NULL CHECK (product_type IN ('catalog', 'user_product')),
  product_id INTEGER NOT NULL,
  product_name TEXT,
  shop_link_snapshot TEXT,
  reason TEXT NOT NULL DEFAULT 'missing_link',
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'reviewed', 'closed')),
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (stack_id) REFERENCES stacks(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_product_link_reports_status_created
  ON product_link_reports(status, created_at);

CREATE INDEX IF NOT EXISTS idx_product_link_reports_product
  ON product_link_reports(product_type, product_id);
