PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS managed_list_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  list_key TEXT NOT NULL,
  value TEXT NOT NULL,
  label TEXT NOT NULL,
  description TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  active INTEGER NOT NULL DEFAULT 1,
  version INTEGER NOT NULL DEFAULT 0,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_managed_list_items_key_value
  ON managed_list_items(list_key, value);

CREATE INDEX IF NOT EXISTS idx_managed_list_items_list_sort
  ON managed_list_items(list_key, active, sort_order, label);

INSERT OR IGNORE INTO managed_list_items (list_key, value, label, sort_order, active)
VALUES
  ('serving_unit', 'Kapsel', 'Kapsel', 10, 1),
  ('serving_unit', 'Kapseln', 'Kapseln', 20, 1),
  ('serving_unit', 'Tablette', 'Tablette', 30, 1),
  ('serving_unit', 'Tabletten', 'Tabletten', 40, 1),
  ('serving_unit', 'Softgel', 'Softgel', 50, 1),
  ('serving_unit', 'Softgels', 'Softgels', 60, 1),
  ('serving_unit', 'Tropfen', 'Tropfen', 70, 1),
  ('serving_unit', 'Portion', 'Portion', 80, 1),
  ('serving_unit', 'Portionen', 'Portionen', 90, 1),
  ('serving_unit', 'Messloeffel', 'Messloeffel', 100, 1),
  ('serving_unit', 'ml', 'ml', 110, 1),
  ('serving_unit', 'g', 'g', 120, 1),
  ('serving_unit', 'mg', 'mg', 130, 1);

INSERT OR IGNORE INTO managed_list_items (list_key, value, label, sort_order, active)
SELECT
  'serving_unit',
  TRIM(serving_unit),
  TRIM(serving_unit),
  500 + ROW_NUMBER() OVER (ORDER BY LOWER(TRIM(serving_unit))),
  1
FROM products
WHERE COALESCE(TRIM(serving_unit), '') <> '';
