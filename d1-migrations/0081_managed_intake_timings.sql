PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS managed_list_item_translations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  managed_list_item_id INTEGER NOT NULL REFERENCES managed_list_items(id) ON DELETE CASCADE,
  language TEXT NOT NULL,
  label TEXT NOT NULL,
  description TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(managed_list_item_id, language)
);

CREATE INDEX IF NOT EXISTS idx_managed_list_item_translations_language
  ON managed_list_item_translations(language);

INSERT INTO managed_list_items (list_key, value, label, description, sort_order, active)
VALUES
  ('intake_timing', 'anytime', 'Jederzeit', NULL, 10, 1),
  ('intake_timing', 'before_breakfast', 'Vor dem Frühstück', NULL, 20, 1),
  ('intake_timing', 'after_breakfast', 'Nach dem Frühstück', NULL, 30, 1),
  ('intake_timing', 'with_meal', 'Zum Essen', NULL, 40, 1),
  ('intake_timing', 'morning', 'Morgens', NULL, 50, 1),
  ('intake_timing', 'evening', 'Abends', NULL, 60, 1),
  ('intake_timing', 'noon', 'Mittags', NULL, 70, 1),
  ('intake_timing', 'morning_evening', 'Morgens & Abends', NULL, 80, 1)
ON CONFLICT(list_key, value) DO UPDATE SET
  label = excluded.label,
  description = excluded.description,
  sort_order = excluded.sort_order,
  active = 1,
  updated_at = datetime('now'),
  version = COALESCE(managed_list_items.version, 0) + 1;
