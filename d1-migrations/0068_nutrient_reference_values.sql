PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS nutrient_reference_values (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ingredient_id INTEGER NOT NULL,
  population_id INTEGER,
  organization TEXT NOT NULL,
  value_min REAL,
  value_max REAL,
  unit TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (
    kind IN (
      'rda',
      'ai',
      'ear',
      'ul',
      'pri',
      'ar',
      'lti',
      'ri',
      'nrv'
    )
  ),
  source_url TEXT,
  source_year INTEGER,
  note TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  version INTEGER NOT NULL DEFAULT 1,
  CHECK (TRIM(organization) <> ''),
  CHECK (TRIM(unit) <> ''),
  CHECK (value_min IS NULL OR value_min >= 0),
  CHECK (value_max IS NULL OR value_max >= 0),
  CHECK (value_min IS NULL OR value_max IS NULL OR value_min <= value_max),
  CHECK (source_year IS NULL OR source_year BETWEEN 1900 AND 2100),
  UNIQUE (ingredient_id, organization, population_id, kind),
  FOREIGN KEY (ingredient_id) REFERENCES ingredients(id) ON DELETE CASCADE,
  FOREIGN KEY (population_id) REFERENCES populations(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_nutrient_reference_values_ingredient
  ON nutrient_reference_values(ingredient_id);

CREATE INDEX IF NOT EXISTS idx_nutrient_reference_values_population
  ON nutrient_reference_values(population_id);

CREATE INDEX IF NOT EXISTS idx_nutrient_reference_values_kind
  ON nutrient_reference_values(kind);
