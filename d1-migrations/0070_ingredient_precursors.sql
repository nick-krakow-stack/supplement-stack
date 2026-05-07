-- Editorial precursor relationships between canonical ingredients.
--
-- This is not a search expansion table. It supports admin/content work such as
-- explaining that Lysin and Methionin are precursor building blocks for
-- L-Carnitin while all involved rows stay canonical ingredients.

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS ingredient_precursors (
  ingredient_id INTEGER NOT NULL,
  precursor_ingredient_id INTEGER NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  note TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (ingredient_id, precursor_ingredient_id),
  CHECK (ingredient_id <> precursor_ingredient_id),
  FOREIGN KEY (ingredient_id) REFERENCES ingredients(id) ON DELETE CASCADE,
  FOREIGN KEY (precursor_ingredient_id) REFERENCES ingredients(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_ingredient_precursors_precursor
  ON ingredient_precursors(precursor_ingredient_id);

CREATE INDEX IF NOT EXISTS idx_ingredient_precursors_parent_sort
  ON ingredient_precursors(ingredient_id, sort_order, precursor_ingredient_id);

INSERT OR IGNORE INTO ingredient_precursors (ingredient_id, precursor_ingredient_id, sort_order)
SELECT target.id, precursor.id, 10
FROM ingredients target
JOIN ingredients precursor ON precursor.name = 'Lysin'
WHERE target.name = 'L-Carnitin';

INSERT OR IGNORE INTO ingredient_precursors (ingredient_id, precursor_ingredient_id, sort_order)
SELECT target.id, precursor.id, 20
FROM ingredients target
JOIN ingredients precursor ON precursor.name = 'Methionin'
WHERE target.name = 'L-Carnitin';

