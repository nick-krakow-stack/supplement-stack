PRAGMA foreign_keys = ON;

-- Wirkstoff-/Form-Profile sind die fachliche Quelle fuer UI-Texte wie
-- Wirkung, Timing und Einnahmehinweise. Produkte behalten nur Produktdaten und
-- Wirkstoff-Potenzangaben in product_ingredients/user_product_ingredients.
CREATE TABLE IF NOT EXISTS ingredient_display_profiles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ingredient_id INTEGER NOT NULL,
  form_id INTEGER,
  sub_ingredient_id INTEGER,
  effect_summary TEXT,
  timing TEXT,
  timing_note TEXT,
  intake_hint TEXT,
  card_note TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  CHECK (form_id IS NOT NULL OR sub_ingredient_id IS NOT NULL OR ingredient_id IS NOT NULL),
  FOREIGN KEY (ingredient_id) REFERENCES ingredients(id) ON DELETE CASCADE,
  FOREIGN KEY (form_id) REFERENCES ingredient_forms(id) ON DELETE CASCADE,
  FOREIGN KEY (sub_ingredient_id) REFERENCES ingredients(id) ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_ingredient_display_profiles_base
  ON ingredient_display_profiles(ingredient_id)
  WHERE form_id IS NULL AND sub_ingredient_id IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_ingredient_display_profiles_form
  ON ingredient_display_profiles(ingredient_id, form_id)
  WHERE form_id IS NOT NULL AND sub_ingredient_id IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_ingredient_display_profiles_sub
  ON ingredient_display_profiles(ingredient_id, sub_ingredient_id)
  WHERE form_id IS NULL AND sub_ingredient_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_ingredient_display_profiles_form_sub
  ON ingredient_display_profiles(ingredient_id, form_id, sub_ingredient_id)
  WHERE form_id IS NOT NULL AND sub_ingredient_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_ingredient_display_profiles_ingredient
  ON ingredient_display_profiles(ingredient_id, form_id, sub_ingredient_id);

-- Move the previously seeded product-card summaries to the corresponding
-- main ingredient as a transitional data migration.
INSERT OR IGNORE INTO ingredient_display_profiles (
  ingredient_id,
  effect_summary,
  created_at,
  updated_at
)
WITH main_rows AS (
  SELECT
    p.id AS product_id,
    pi.ingredient_id,
    TRIM(p.effect_summary) AS effect_summary
  FROM products p
  JOIN product_ingredients pi ON pi.id = (
    SELECT pi2.id
    FROM product_ingredients pi2
    WHERE pi2.product_id = p.id
      AND pi2.search_relevant = 1
    ORDER BY pi2.is_main DESC, pi2.id ASC
    LIMIT 1
  )
  WHERE p.effect_summary IS NOT NULL
    AND TRIM(p.effect_summary) <> ''
),
chosen AS (
  SELECT m.ingredient_id, m.effect_summary
  FROM main_rows m
  WHERE m.product_id = (
    SELECT MIN(m2.product_id)
    FROM main_rows m2
    WHERE m2.ingredient_id = m.ingredient_id
  )
)
SELECT ingredient_id, effect_summary, datetime('now'), datetime('now')
FROM chosen;

-- Existing ingredient_forms already contain form-specific timing/comment data.
-- Expose that through the display profile layer so product cards and stack
-- defaults can use it without reading product-level fields.
INSERT OR IGNORE INTO ingredient_display_profiles (
  ingredient_id,
  form_id,
  timing,
  timing_note,
  created_at,
  updated_at
)
SELECT
  ingredient_id,
  id,
  NULLIF(TRIM(timing), ''),
  NULLIF(TRIM(comment), ''),
  datetime('now'),
  datetime('now')
FROM ingredient_forms
WHERE (timing IS NOT NULL AND TRIM(timing) <> '')
   OR (comment IS NOT NULL AND TRIM(comment) <> '');

-- Preserve currently visible card summaries for the launch catalog on the
-- ingredient profile level. These compact labels still need content review.
UPDATE ingredient_display_profiles
SET effect_summary = 'Immunsystem, Knochen, Hormone',
    updated_at = datetime('now')
WHERE ingredient_id = (SELECT id FROM ingredients WHERE name = 'Vitamin D3')
  AND form_id IS NULL
  AND sub_ingredient_id IS NULL;

UPDATE ingredient_display_profiles
SET effect_summary = 'Muskel- & Nervenfunktion, Entspannung',
    updated_at = datetime('now')
WHERE ingredient_id = (SELECT id FROM ingredients WHERE name = 'Magnesium')
  AND form_id IS NULL
  AND sub_ingredient_id IS NULL;

-- Infer obvious catalog form links where the product name exactly contains an
-- existing form name. Ambiguous products remain null and fall back to the base
-- ingredient profile.
UPDATE product_ingredients
SET form_id = (
  SELECT f.id
  FROM products p
  JOIN ingredient_forms f ON f.ingredient_id = product_ingredients.ingredient_id
  WHERE p.id = product_ingredients.product_id
    AND instr(lower(p.name), lower(f.name)) > 0
  ORDER BY length(f.name) DESC, f.id ASC
  LIMIT 1
)
WHERE form_id IS NULL
  AND EXISTS (
    SELECT 1
    FROM products p
    JOIN ingredient_forms f ON f.ingredient_id = product_ingredients.ingredient_id
    WHERE p.id = product_ingredients.product_id
      AND instr(lower(p.name), lower(f.name)) > 0
  );
