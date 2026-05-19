PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS stack_categories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  stack_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  name_normalized TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_default INTEGER NOT NULL DEFAULT 0 CHECK (is_default IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (stack_id) REFERENCES stacks(id) ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_stack_categories_default_per_stack
  ON stack_categories(stack_id)
  WHERE is_default = 1;

CREATE UNIQUE INDEX IF NOT EXISTS idx_stack_categories_stack_name_normalized
  ON stack_categories(stack_id, name_normalized);

ALTER TABLE stack_items ADD COLUMN sort_order INTEGER NOT NULL DEFAULT 0;
ALTER TABLE stack_items ADD COLUMN category_id INTEGER REFERENCES stack_categories(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_stack_categories_stack_sort
  ON stack_categories(stack_id, sort_order, id);

CREATE INDEX IF NOT EXISTS idx_stack_items_stack_sort
  ON stack_items(stack_id, sort_order, id);

CREATE INDEX IF NOT EXISTS idx_stack_items_category_id
  ON stack_items(category_id);

INSERT INTO stack_categories (
  stack_id,
  name,
  name_normalized,
  sort_order,
  is_default,
  created_at,
  updated_at
)
SELECT
  s.id,
  'Unkategorisiert',
  'unkategorisiert',
  0,
  1,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM stacks s
LEFT JOIN stack_categories existing_default
  ON existing_default.stack_id = s.id
 AND existing_default.is_default = 1
WHERE existing_default.id IS NULL;

UPDATE stack_items
SET sort_order = id
WHERE sort_order = 0;

UPDATE stack_items
SET category_id = (
  SELECT sc.id
  FROM stack_categories sc
  WHERE sc.stack_id = stack_items.stack_id
    AND sc.is_default = 1
  LIMIT 1
)
WHERE category_id IS NULL;
