PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS product_warnings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id INTEGER NOT NULL,
  severity TEXT NOT NULL DEFAULT 'warning'
    CHECK (severity IN ('info', 'caution', 'warning', 'danger')),
  title TEXT,
  message TEXT,
  alternative_note TEXT,
  active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  version INTEGER NOT NULL DEFAULT 1,
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_product_warnings_product_active
  ON product_warnings(product_id, active);

CREATE INDEX IF NOT EXISTS idx_product_warnings_severity
  ON product_warnings(severity);

INSERT INTO product_warnings (
  product_id,
  severity,
  title,
  message,
  alternative_note,
  created_at,
  updated_at
)
SELECT
  p.id,
  CASE LOWER(TRIM(COALESCE(p.warning_type, '')))
    WHEN 'danger' THEN 'danger'
    WHEN 'info' THEN 'info'
    WHEN 'caution' THEN 'caution'
    ELSE 'warning'
  END,
  NULLIF(TRIM(p.warning_title), ''),
  NULLIF(TRIM(p.warning_message), ''),
  NULLIF(TRIM(p.alternative_note), ''),
  datetime('now'),
  datetime('now')
FROM products p
WHERE (
    (p.warning_title IS NOT NULL AND TRIM(p.warning_title) <> '')
    OR (p.warning_message IS NOT NULL AND TRIM(p.warning_message) <> '')
    OR (p.warning_type IS NOT NULL AND TRIM(p.warning_type) <> '')
    OR (p.alternative_note IS NOT NULL AND TRIM(p.alternative_note) <> '')
  )
  AND NOT EXISTS (
    SELECT 1
    FROM product_warnings pw
    WHERE pw.product_id = p.id
  );
