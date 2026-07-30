PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS ingredient_parts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  type TEXT,
  internal_comment TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'deprecated')),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS ingredient_part_synonyms (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  part_id INTEGER NOT NULL,
  synonym TEXT NOT NULL,
  language TEXT NOT NULL DEFAULT 'de',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(part_id, synonym, language),
  FOREIGN KEY (part_id) REFERENCES ingredient_parts(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS ingredient_part_links (
  ingredient_id INTEGER NOT NULL,
  part_id INTEGER NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (ingredient_id, part_id),
  FOREIGN KEY (ingredient_id) REFERENCES ingredients(id) ON DELETE CASCADE,
  FOREIGN KEY (part_id) REFERENCES ingredient_parts(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_ingredient_parts_name_norm
  ON ingredient_parts (
    lower(replace(replace(replace(trim(name), ' ', ''), '-', ''), '_', ''))
  );

CREATE INDEX IF NOT EXISTS idx_ingredient_part_synonyms_norm
  ON ingredient_part_synonyms (
    lower(replace(replace(replace(trim(synonym), ' ', ''), '-', ''), '_', ''))
  );

CREATE INDEX IF NOT EXISTS idx_ingredient_part_synonyms_part
  ON ingredient_part_synonyms(part_id, language, synonym);

CREATE INDEX IF NOT EXISTS idx_ingredient_part_links_part
  ON ingredient_part_links(part_id, ingredient_id);

CREATE INDEX IF NOT EXISTS idx_ingredient_part_links_ingredient_sort
  ON ingredient_part_links(ingredient_id, sort_order, part_id);
