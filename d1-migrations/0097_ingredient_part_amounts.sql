PRAGMA foreign_keys = ON;

-- Abort before any canonical data is changed when multiple legacy form rows
-- of one product would collapse onto the same Part with different semantics.
-- The migration runner applies the file atomically; these short-lived objects
-- therefore also leave no trace on a guarded failure.
CREATE TABLE _subparts_0097_legacy_guard (
  scope TEXT NOT NULL
);

CREATE TRIGGER _subparts_0097_legacy_guard_catalog
BEFORE INSERT ON _subparts_0097_legacy_guard
WHEN NEW.scope = 'catalog'
BEGIN
  SELECT RAISE(ABORT, '0097: Katalogprodukt enthaelt widerspruechliche Legacy-Formzeilen fuer denselben Sub-Wirkstoff.');
END;

CREATE TRIGGER _subparts_0097_legacy_guard_user
BEFORE INSERT ON _subparts_0097_legacy_guard
WHEN NEW.scope = 'user'
BEGIN
  SELECT RAISE(ABORT, '0097: Nutzerprodukt enthaelt widerspruechliche Legacy-Formzeilen fuer denselben Sub-Wirkstoff.');
END;

INSERT INTO _subparts_0097_legacy_guard (scope)
SELECT 'catalog'
WHERE EXISTS (
  SELECT 1
  FROM product_ingredients left_row
  JOIN ingredient_forms left_form ON left_form.id = left_row.form_id
  JOIN product_ingredients right_row
    ON right_row.product_id = left_row.product_id
   AND right_row.id > left_row.id
  JOIN ingredient_forms right_form ON right_form.id = right_row.form_id
  JOIN ingredients ingredient
    ON ingredient.id = left_form.ingredient_id
   AND ingredient.id = right_form.ingredient_id
   AND ingredient.name = 'L-Carnitin'
  WHERE (CASE left_form.name
      WHEN 'Acetyl-L-Carnitin (ALCAR)' THEN 'Acetyl-L-Carnitin'
      WHEN 'L-Carnitin Tartrat' THEN 'L-Carnitin-Tartrat'
      WHEN 'L-Carnitin L-Tartrat (flüssig)' THEN 'L-Carnitin-Tartrat'
      WHEN 'L-Carnitin Fumarat' THEN 'L-Carnitin-Fumarat'
      WHEN 'Propionyl-L-Carnitin' THEN 'Propionyl-L-Carnitin'
    END) IS NOT NULL
    AND (CASE left_form.name
      WHEN 'Acetyl-L-Carnitin (ALCAR)' THEN 'Acetyl-L-Carnitin'
      WHEN 'L-Carnitin Tartrat' THEN 'L-Carnitin-Tartrat'
      WHEN 'L-Carnitin L-Tartrat (flüssig)' THEN 'L-Carnitin-Tartrat'
      WHEN 'L-Carnitin Fumarat' THEN 'L-Carnitin-Fumarat'
      WHEN 'Propionyl-L-Carnitin' THEN 'Propionyl-L-Carnitin'
    END) = (CASE right_form.name
      WHEN 'Acetyl-L-Carnitin (ALCAR)' THEN 'Acetyl-L-Carnitin'
      WHEN 'L-Carnitin Tartrat' THEN 'L-Carnitin-Tartrat'
      WHEN 'L-Carnitin L-Tartrat (flüssig)' THEN 'L-Carnitin-Tartrat'
      WHEN 'L-Carnitin Fumarat' THEN 'L-Carnitin-Fumarat'
      WHEN 'Propionyl-L-Carnitin' THEN 'Propionyl-L-Carnitin'
    END)
    AND NOT (
      left_row.quantity IS right_row.quantity
      AND left_row.unit IS right_row.unit
      AND left_row.basis_quantity IS right_row.basis_quantity
      AND left_row.basis_unit IS right_row.basis_unit
      AND left_row.search_relevant IS right_row.search_relevant
    )
);

INSERT INTO _subparts_0097_legacy_guard (scope)
SELECT 'user'
WHERE EXISTS (
  SELECT 1
  FROM user_product_ingredients left_row
  JOIN ingredient_forms left_form ON left_form.id = left_row.form_id
  JOIN user_product_ingredients right_row
    ON right_row.user_product_id = left_row.user_product_id
   AND right_row.id > left_row.id
  JOIN ingredient_forms right_form ON right_form.id = right_row.form_id
  JOIN ingredients ingredient
    ON ingredient.id = left_form.ingredient_id
   AND ingredient.id = right_form.ingredient_id
   AND ingredient.name = 'L-Carnitin'
  WHERE (CASE left_form.name
      WHEN 'Acetyl-L-Carnitin (ALCAR)' THEN 'Acetyl-L-Carnitin'
      WHEN 'L-Carnitin Tartrat' THEN 'L-Carnitin-Tartrat'
      WHEN 'L-Carnitin L-Tartrat (flüssig)' THEN 'L-Carnitin-Tartrat'
      WHEN 'L-Carnitin Fumarat' THEN 'L-Carnitin-Fumarat'
      WHEN 'Propionyl-L-Carnitin' THEN 'Propionyl-L-Carnitin'
    END) IS NOT NULL
    AND (CASE left_form.name
      WHEN 'Acetyl-L-Carnitin (ALCAR)' THEN 'Acetyl-L-Carnitin'
      WHEN 'L-Carnitin Tartrat' THEN 'L-Carnitin-Tartrat'
      WHEN 'L-Carnitin L-Tartrat (flüssig)' THEN 'L-Carnitin-Tartrat'
      WHEN 'L-Carnitin Fumarat' THEN 'L-Carnitin-Fumarat'
      WHEN 'Propionyl-L-Carnitin' THEN 'Propionyl-L-Carnitin'
    END) = (CASE right_form.name
      WHEN 'Acetyl-L-Carnitin (ALCAR)' THEN 'Acetyl-L-Carnitin'
      WHEN 'L-Carnitin Tartrat' THEN 'L-Carnitin-Tartrat'
      WHEN 'L-Carnitin L-Tartrat (flüssig)' THEN 'L-Carnitin-Tartrat'
      WHEN 'L-Carnitin Fumarat' THEN 'L-Carnitin-Fumarat'
      WHEN 'Propionyl-L-Carnitin' THEN 'Propionyl-L-Carnitin'
    END)
    AND NOT (
      left_row.quantity IS right_row.quantity
      AND left_row.unit IS right_row.unit
      AND left_row.basis_quantity IS right_row.basis_quantity
      AND left_row.basis_unit IS right_row.basis_unit
      AND left_row.search_relevant IS right_row.search_relevant
    )
);

DROP TRIGGER _subparts_0097_legacy_guard_catalog;
DROP TRIGGER _subparts_0097_legacy_guard_user;
DROP TABLE _subparts_0097_legacy_guard;

-- A normalized spelling identifies exactly one global Part search term. The
-- unique indexes cover each table and the triggers close the cross-table gap.
CREATE UNIQUE INDEX IF NOT EXISTS uq_ingredient_parts_name_norm
  ON ingredient_parts (
    lower(replace(replace(replace(trim(name), ' ', ''), '-', ''), '_', ''))
  );
CREATE UNIQUE INDEX IF NOT EXISTS uq_ingredient_part_synonyms_norm
  ON ingredient_part_synonyms (
    lower(replace(replace(replace(trim(synonym), ' ', ''), '-', ''), '_', ''))
  );

CREATE TRIGGER IF NOT EXISTS trg_ingredient_parts_name_norm_insert
BEFORE INSERT ON ingredient_parts
BEGIN
  SELECT RAISE(ABORT, 'Normalisierter Part-Name ist bereits vergeben.')
  WHERE EXISTS (
      SELECT 1 FROM ingredient_parts existing
      WHERE lower(replace(replace(replace(trim(existing.name), ' ', ''), '-', ''), '_', '')) =
            lower(replace(replace(replace(trim(NEW.name), ' ', ''), '-', ''), '_', ''))
    )
    OR EXISTS (
      SELECT 1 FROM ingredient_part_synonyms existing
      WHERE lower(replace(replace(replace(trim(existing.synonym), ' ', ''), '-', ''), '_', '')) =
            lower(replace(replace(replace(trim(NEW.name), ' ', ''), '-', ''), '_', ''))
    );
END;

CREATE TRIGGER IF NOT EXISTS trg_ingredient_parts_name_norm_update
BEFORE UPDATE OF name ON ingredient_parts
BEGIN
  SELECT RAISE(ABORT, 'Normalisierter Part-Name ist bereits vergeben.')
  WHERE EXISTS (
      SELECT 1 FROM ingredient_parts existing
      WHERE existing.id <> OLD.id
        AND lower(replace(replace(replace(trim(existing.name), ' ', ''), '-', ''), '_', '')) =
            lower(replace(replace(replace(trim(NEW.name), ' ', ''), '-', ''), '_', ''))
    )
    OR EXISTS (
      SELECT 1 FROM ingredient_part_synonyms existing
      WHERE lower(replace(replace(replace(trim(existing.synonym), ' ', ''), '-', ''), '_', '')) =
            lower(replace(replace(replace(trim(NEW.name), ' ', ''), '-', ''), '_', ''))
    );
END;

CREATE TRIGGER IF NOT EXISTS trg_ingredient_part_synonyms_norm_insert
BEFORE INSERT ON ingredient_part_synonyms
BEGIN
  SELECT RAISE(ABORT, 'Normalisiertes Part-Synonym ist bereits vergeben.')
  WHERE EXISTS (
      SELECT 1 FROM ingredient_parts existing
      WHERE lower(replace(replace(replace(trim(existing.name), ' ', ''), '-', ''), '_', '')) =
            lower(replace(replace(replace(trim(NEW.synonym), ' ', ''), '-', ''), '_', ''))
    )
    OR EXISTS (
      SELECT 1 FROM ingredient_part_synonyms existing
      WHERE lower(replace(replace(replace(trim(existing.synonym), ' ', ''), '-', ''), '_', '')) =
            lower(replace(replace(replace(trim(NEW.synonym), ' ', ''), '-', ''), '_', ''))
    );
END;

CREATE TRIGGER IF NOT EXISTS trg_ingredient_part_synonyms_norm_update
BEFORE UPDATE OF synonym ON ingredient_part_synonyms
BEGIN
  SELECT RAISE(ABORT, 'Normalisiertes Part-Synonym ist bereits vergeben.')
  WHERE EXISTS (
      SELECT 1 FROM ingredient_parts existing
      WHERE lower(replace(replace(replace(trim(existing.name), ' ', ''), '-', ''), '_', '')) =
            lower(replace(replace(replace(trim(NEW.synonym), ' ', ''), '-', ''), '_', ''))
    )
    OR EXISTS (
      SELECT 1 FROM ingredient_part_synonyms existing
      WHERE existing.id <> OLD.id
        AND lower(replace(replace(replace(trim(existing.synonym), ' ', ''), '-', ''), '_', '')) =
            lower(replace(replace(replace(trim(NEW.synonym), ' ', ''), '-', ''), '_', ''))
    );
END;

-- Existing rows pass through the same guards before new canonical seeds are
-- accepted. The id exclusions above make unchanged self-updates valid.
UPDATE ingredient_parts SET name = name;
UPDATE ingredient_part_synonyms SET synonym = synonym;

-- Canonical part data. Parts are contained in their parent amount and are
-- never modelled as ingredients or ingredient forms.
WITH seed(name, type, status) AS (
  VALUES
    ('EPA', 'fatty_acid_component', 'active'),
    ('DHA', 'fatty_acid_component', 'active'),
    ('DPA', 'fatty_acid_component', 'active'),
    ('Acetyl-L-Carnitin', 'carnitine_derivative', 'active'),
    ('L-Carnitin-Tartrat', 'carnitine_derivative', 'active'),
    ('L-Carnitin-Fumarat', 'carnitine_derivative', 'active'),
    ('Propionyl-L-Carnitin', 'carnitine_derivative', 'active')
)
INSERT INTO ingredient_parts (name, type, status)
SELECT seed.name, seed.type, seed.status
FROM seed
WHERE NOT EXISTS (
  SELECT 1 FROM ingredient_parts existing
  WHERE lower(replace(replace(replace(trim(existing.name), ' ', ''), '-', ''), '_', '')) =
        lower(replace(replace(replace(trim(seed.name), ' ', ''), '-', ''), '_', ''))
);

UPDATE ingredient_parts
SET status = 'active',
    type = CASE
      WHEN name IN ('EPA', 'DHA', 'DPA') THEN 'fatty_acid_component'
      ELSE 'carnitine_derivative'
    END
WHERE name IN (
  'EPA', 'DHA', 'DPA',
  'Acetyl-L-Carnitin', 'L-Carnitin-Tartrat',
  'L-Carnitin-Fumarat', 'Propionyl-L-Carnitin'
);

WITH seed(part_name, synonym, language) AS (
  VALUES
    ('Acetyl-L-Carnitin', 'ALCAR', 'de'),
    ('Acetyl-L-Carnitin', 'Acetylcarnitin', 'de'),
    ('Acetyl-L-Carnitin', 'N-Acetyl-L-Carnitin', 'de'),
    ('Acetyl-L-Carnitin', 'Acetyl-Levocarnitin', 'de'),
    ('L-Carnitin-Tartrat', 'L-Carnitin L-Tartrat', 'de'),
    ('L-Carnitin-Tartrat', 'L-Carnitine L-Tartrate', 'en'),
    ('L-Carnitin-Tartrat', 'L-Carnitine Tartrate', 'en'),
    ('L-Carnitin-Fumarat', 'L-Carnitine Fumarate', 'en'),
    ('Propionyl-L-Carnitin', 'Propionylcarnitin', 'de'),
    ('Propionyl-L-Carnitin', 'Propionyl-L-Carnitine', 'en'),
    ('Propionyl-L-Carnitin', 'PLC', 'de')
)
INSERT INTO ingredient_part_synonyms (part_id, synonym, language)
SELECT part.id, seed.synonym, seed.language
FROM seed
JOIN ingredient_parts part ON part.name = seed.part_name
WHERE NOT EXISTS (
  SELECT 1
  FROM ingredient_part_synonyms existing
  WHERE lower(replace(replace(replace(trim(existing.synonym), ' ', ''), '-', ''), '_', '')) =
        lower(replace(replace(replace(trim(seed.synonym), ' ', ''), '-', ''), '_', ''))
);

WITH seed(parent_name, part_name, sort_order) AS (
  VALUES
    ('Omega-3', 'EPA', 10),
    ('Omega-3', 'DHA', 20),
    ('Omega-3', 'DPA', 30),
    ('L-Carnitin', 'Acetyl-L-Carnitin', 10),
    ('L-Carnitin', 'L-Carnitin-Tartrat', 20),
    ('L-Carnitin', 'L-Carnitin-Fumarat', 30),
    ('L-Carnitin', 'Propionyl-L-Carnitin', 40)
)
INSERT OR IGNORE INTO ingredient_part_links (ingredient_id, part_id, sort_order)
SELECT ingredient.id, part.id, seed.sort_order
FROM seed
JOIN ingredients ingredient ON ingredient.name = seed.parent_name
JOIN ingredient_parts part ON part.name = seed.part_name;

-- Product part quantities always belong to one concrete parent ingredient row.
CREATE TABLE IF NOT EXISTS product_ingredient_parts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  product_ingredient_id INTEGER NOT NULL,
  part_id INTEGER NOT NULL,
  quantity REAL,
  unit TEXT,
  basis_quantity REAL,
  basis_unit TEXT,
  search_relevant INTEGER NOT NULL DEFAULT 1 CHECK (search_relevant IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (product_ingredient_id, part_id),
  CHECK (quantity IS NULL OR quantity > 0),
  CHECK (basis_quantity IS NULL OR basis_quantity > 0),
  CHECK (search_relevant = 0 OR (quantity IS NOT NULL AND NULLIF(trim(unit), '') IS NOT NULL)),
  FOREIGN KEY (product_ingredient_id) REFERENCES product_ingredients(id) ON DELETE CASCADE,
  FOREIGN KEY (part_id) REFERENCES ingredient_parts(id) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS user_product_ingredient_parts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_product_ingredient_id INTEGER NOT NULL,
  part_id INTEGER NOT NULL,
  quantity REAL,
  unit TEXT,
  basis_quantity REAL,
  basis_unit TEXT,
  search_relevant INTEGER NOT NULL DEFAULT 1 CHECK (search_relevant IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (user_product_ingredient_id, part_id),
  CHECK (quantity IS NULL OR quantity > 0),
  CHECK (basis_quantity IS NULL OR basis_quantity > 0),
  CHECK (search_relevant = 0 OR (quantity IS NOT NULL AND NULLIF(trim(unit), '') IS NOT NULL)),
  FOREIGN KEY (user_product_ingredient_id) REFERENCES user_product_ingredients(id) ON DELETE CASCADE,
  FOREIGN KEY (part_id) REFERENCES ingredient_parts(id) ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_product_ingredient_parts_parent
  ON product_ingredient_parts(product_ingredient_id, part_id);
CREATE INDEX IF NOT EXISTS idx_product_ingredient_parts_search
  ON product_ingredient_parts(part_id, search_relevant, product_ingredient_id);
CREATE INDEX IF NOT EXISTS idx_user_product_ingredient_parts_parent
  ON user_product_ingredient_parts(user_product_ingredient_id, part_id);
CREATE INDEX IF NOT EXISTS idx_user_product_ingredient_parts_search
  ON user_product_ingredient_parts(part_id, search_relevant, user_product_ingredient_id);

CREATE TRIGGER IF NOT EXISTS trg_product_ingredient_parts_link_insert
BEFORE INSERT ON product_ingredient_parts
BEGIN
  SELECT RAISE(ABORT, 'Part ist nicht mit dem Hauptwirkstoff verknüpft.')
  WHERE NOT EXISTS (
    SELECT 1
    FROM product_ingredients parent
    JOIN ingredient_part_links link
      ON link.ingredient_id = parent.ingredient_id
     AND link.part_id = NEW.part_id
    WHERE parent.id = NEW.product_ingredient_id
      AND parent.parent_ingredient_id IS NULL
  );
END;

CREATE TRIGGER IF NOT EXISTS trg_product_ingredient_parts_link_update
BEFORE UPDATE OF product_ingredient_id, part_id ON product_ingredient_parts
BEGIN
  SELECT RAISE(ABORT, 'Part ist nicht mit dem Hauptwirkstoff verknüpft.')
  WHERE NOT EXISTS (
    SELECT 1
    FROM product_ingredients parent
    JOIN ingredient_part_links link
      ON link.ingredient_id = parent.ingredient_id
     AND link.part_id = NEW.part_id
    WHERE parent.id = NEW.product_ingredient_id
      AND parent.parent_ingredient_id IS NULL
  );
END;

CREATE TRIGGER IF NOT EXISTS trg_user_product_ingredient_parts_link_insert
BEFORE INSERT ON user_product_ingredient_parts
BEGIN
  SELECT RAISE(ABORT, 'Part ist nicht mit dem Hauptwirkstoff verknüpft.')
  WHERE NOT EXISTS (
    SELECT 1
    FROM user_product_ingredients parent
    JOIN ingredient_part_links link
      ON link.ingredient_id = parent.ingredient_id
     AND link.part_id = NEW.part_id
    WHERE parent.id = NEW.user_product_ingredient_id
      AND parent.parent_ingredient_id IS NULL
  );
END;

CREATE TRIGGER IF NOT EXISTS trg_user_product_ingredient_parts_link_update
BEFORE UPDATE OF user_product_ingredient_id, part_id ON user_product_ingredient_parts
BEGIN
  SELECT RAISE(ABORT, 'Part ist nicht mit dem Hauptwirkstoff verknüpft.')
  WHERE NOT EXISTS (
    SELECT 1
    FROM user_product_ingredients parent
    JOIN ingredient_part_links link
      ON link.ingredient_id = parent.ingredient_id
     AND link.part_id = NEW.part_id
    WHERE parent.id = NEW.user_product_ingredient_id
      AND parent.parent_ingredient_id IS NULL
  );
END;

-- Part-aware display, dose, warning and knowledge relations.
ALTER TABLE ingredient_display_profiles
  ADD COLUMN part_id INTEGER REFERENCES ingredient_parts(id) ON DELETE RESTRICT;
ALTER TABLE dose_recommendations
  ADD COLUMN part_id INTEGER REFERENCES ingredient_parts(id) ON DELETE RESTRICT;
ALTER TABLE ingredient_safety_warnings
  ADD COLUMN part_id INTEGER REFERENCES ingredient_parts(id) ON DELETE RESTRICT;

DROP INDEX IF EXISTS idx_ingredient_display_profiles_base;
DROP INDEX IF EXISTS idx_ingredient_display_profiles_form;
DROP INDEX IF EXISTS idx_ingredient_display_profiles_sub;
DROP INDEX IF EXISTS idx_ingredient_display_profiles_form_sub;
DROP INDEX IF EXISTS idx_ingredient_display_profiles_ingredient;

CREATE UNIQUE INDEX idx_ingredient_display_profiles_base
  ON ingredient_display_profiles(ingredient_id)
  WHERE form_id IS NULL AND sub_ingredient_id IS NULL AND part_id IS NULL;
CREATE UNIQUE INDEX idx_ingredient_display_profiles_form
  ON ingredient_display_profiles(ingredient_id, form_id)
  WHERE form_id IS NOT NULL AND sub_ingredient_id IS NULL AND part_id IS NULL;
CREATE UNIQUE INDEX idx_ingredient_display_profiles_sub
  ON ingredient_display_profiles(ingredient_id, sub_ingredient_id)
  WHERE form_id IS NULL AND sub_ingredient_id IS NOT NULL AND part_id IS NULL;
CREATE UNIQUE INDEX idx_ingredient_display_profiles_form_sub
  ON ingredient_display_profiles(ingredient_id, form_id, sub_ingredient_id)
  WHERE form_id IS NOT NULL AND sub_ingredient_id IS NOT NULL AND part_id IS NULL;
CREATE UNIQUE INDEX idx_ingredient_display_profiles_part
  ON ingredient_display_profiles(ingredient_id, part_id)
  WHERE form_id IS NULL AND sub_ingredient_id IS NULL AND part_id IS NOT NULL;
CREATE INDEX idx_ingredient_display_profiles_ingredient
  ON ingredient_display_profiles(ingredient_id, form_id, sub_ingredient_id, part_id);

DROP INDEX IF EXISTS uq_dose_recommendations_default;
CREATE UNIQUE INDEX uq_dose_recommendations_default
  ON dose_recommendations (
    ingredient_id,
    COALESCE(part_id, -1),
    population_id,
    COALESCE(sex_filter, '_'),
    purpose,
    is_athlete
  )
  WHERE is_default = 1 AND is_active = 1;
CREATE INDEX IF NOT EXISTS idx_dose_recommendations_part_active
  ON dose_recommendations(ingredient_id, part_id, is_active, relevance_score DESC);

DROP INDEX IF EXISTS idx_ingredient_safety_warnings_ingredient_active;
DROP INDEX IF EXISTS idx_ingredient_safety_warnings_unique_label;
CREATE INDEX idx_ingredient_safety_warnings_ingredient_active
  ON ingredient_safety_warnings(ingredient_id, part_id, form_id, active);
CREATE UNIQUE INDEX idx_ingredient_safety_warnings_unique_label
  ON ingredient_safety_warnings(
    ingredient_id,
    COALESCE(part_id, -1),
    COALESCE(form_id, -1),
    short_label,
    COALESCE(article_slug, '')
  );

CREATE TABLE IF NOT EXISTS knowledge_article_parts (
  article_slug TEXT NOT NULL,
  ingredient_id INTEGER NOT NULL,
  part_id INTEGER NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (article_slug, ingredient_id, part_id),
  FOREIGN KEY (article_slug) REFERENCES knowledge_articles(slug) ON DELETE CASCADE,
  FOREIGN KEY (ingredient_id, part_id)
    REFERENCES ingredient_part_links(ingredient_id, part_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_knowledge_article_parts_part
  ON knowledge_article_parts(part_id, ingredient_id, article_slug);

-- Convert legacy L-Carnitin form rows into part quantities. A parent row is
-- added only when missing, without inventing a parent amount or basis.
INSERT INTO product_ingredients (
  product_id, ingredient_id, is_main, quantity, unit, form_id,
  basis_quantity, basis_unit, search_relevant, parent_ingredient_id
)
SELECT
  legacy.product_id,
  parent.id,
  max(COALESCE(legacy.is_main, 0)),
  NULL,
  NULL,
  NULL,
  NULL,
  NULL,
  max(legacy.search_relevant),
  NULL
FROM product_ingredients legacy
JOIN ingredient_forms form ON form.id = legacy.form_id
JOIN ingredients parent ON parent.id = form.ingredient_id AND parent.name = 'L-Carnitin'
WHERE form.name IN (
  'Acetyl-L-Carnitin (ALCAR)', 'L-Carnitin Tartrat',
  'Propionyl-L-Carnitin', 'L-Carnitin L-Tartrat (flüssig)',
  'L-Carnitin Fumarat'
)
AND NOT EXISTS (
  SELECT 1 FROM product_ingredients existing
  WHERE existing.product_id = legacy.product_id
    AND existing.ingredient_id = parent.id
    AND existing.form_id IS NULL
    AND existing.parent_ingredient_id IS NULL
)
GROUP BY legacy.product_id, parent.id;

INSERT INTO user_product_ingredients (
  user_product_id, ingredient_id, form_id, quantity, unit,
  basis_quantity, basis_unit, search_relevant, parent_ingredient_id, is_main
)
SELECT
  legacy.user_product_id,
  parent.id,
  NULL,
  NULL,
  NULL,
  NULL,
  NULL,
  max(legacy.search_relevant),
  NULL,
  max(legacy.is_main)
FROM user_product_ingredients legacy
JOIN ingredient_forms form ON form.id = legacy.form_id
JOIN ingredients parent ON parent.id = form.ingredient_id AND parent.name = 'L-Carnitin'
WHERE form.name IN (
  'Acetyl-L-Carnitin (ALCAR)', 'L-Carnitin Tartrat',
  'Propionyl-L-Carnitin', 'L-Carnitin L-Tartrat (flüssig)',
  'L-Carnitin Fumarat'
)
AND NOT EXISTS (
  SELECT 1 FROM user_product_ingredients existing
  WHERE existing.user_product_id = legacy.user_product_id
    AND existing.ingredient_id = parent.id
    AND existing.form_id IS NULL
    AND existing.parent_ingredient_id IS NULL
)
GROUP BY legacy.user_product_id, parent.id;

UPDATE product_ingredients
SET is_main = 1
WHERE ingredient_id = (SELECT id FROM ingredients WHERE name = 'L-Carnitin')
  AND form_id IS NULL
  AND parent_ingredient_id IS NULL
  AND EXISTS (
    SELECT 1
    FROM product_ingredients legacy
    JOIN ingredient_forms form ON form.id = legacy.form_id
    WHERE legacy.product_id = product_ingredients.product_id
      AND form.ingredient_id = product_ingredients.ingredient_id
      AND legacy.is_main = 1
  );

UPDATE user_product_ingredients
SET is_main = 1
WHERE ingredient_id = (SELECT id FROM ingredients WHERE name = 'L-Carnitin')
  AND form_id IS NULL
  AND parent_ingredient_id IS NULL
  AND EXISTS (
    SELECT 1
    FROM user_product_ingredients legacy
    JOIN ingredient_forms form ON form.id = legacy.form_id
    WHERE legacy.user_product_id = user_product_ingredients.user_product_id
      AND form.ingredient_id = user_product_ingredients.ingredient_id
      AND legacy.is_main = 1
  );

WITH legacy_part_rows AS (
  SELECT
    legacy.*,
    CASE form.name
      WHEN 'Acetyl-L-Carnitin (ALCAR)' THEN 'Acetyl-L-Carnitin'
      WHEN 'L-Carnitin Tartrat' THEN 'L-Carnitin-Tartrat'
      WHEN 'L-Carnitin L-Tartrat (flüssig)' THEN 'L-Carnitin-Tartrat'
      WHEN 'L-Carnitin Fumarat' THEN 'L-Carnitin-Fumarat'
      WHEN 'Propionyl-L-Carnitin' THEN 'Propionyl-L-Carnitin'
    END AS part_name,
    row_number() OVER (
      PARTITION BY legacy.product_id, CASE form.name
        WHEN 'Acetyl-L-Carnitin (ALCAR)' THEN 'Acetyl-L-Carnitin'
        WHEN 'L-Carnitin Tartrat' THEN 'L-Carnitin-Tartrat'
        WHEN 'L-Carnitin L-Tartrat (flüssig)' THEN 'L-Carnitin-Tartrat'
        WHEN 'L-Carnitin Fumarat' THEN 'L-Carnitin-Fumarat'
        WHEN 'Propionyl-L-Carnitin' THEN 'Propionyl-L-Carnitin'
      END
      ORDER BY legacy.id
    ) AS part_row_rank
  FROM product_ingredients legacy
  JOIN ingredient_forms form ON form.id = legacy.form_id
  JOIN ingredients ingredient
    ON ingredient.id = form.ingredient_id
   AND ingredient.name = 'L-Carnitin'
  WHERE form.name IN (
    'Acetyl-L-Carnitin (ALCAR)', 'L-Carnitin Tartrat',
    'Propionyl-L-Carnitin', 'L-Carnitin L-Tartrat (flüssig)',
    'L-Carnitin Fumarat'
  )
)
INSERT INTO product_ingredient_parts (
  product_ingredient_id, part_id, quantity, unit,
  basis_quantity, basis_unit, search_relevant
)
SELECT
  parent_row.id,
  part.id,
  legacy.quantity,
  legacy.unit,
  legacy.basis_quantity,
  legacy.basis_unit,
  legacy.search_relevant
FROM legacy_part_rows legacy
JOIN product_ingredients parent_row
  ON parent_row.product_id = legacy.product_id
 AND parent_row.ingredient_id = legacy.ingredient_id
 AND parent_row.form_id IS NULL
 AND parent_row.parent_ingredient_id IS NULL
JOIN ingredient_parts part ON part.name = legacy.part_name
WHERE legacy.part_row_rank = 1;

WITH legacy_part_rows AS (
  SELECT
    legacy.*,
    CASE form.name
      WHEN 'Acetyl-L-Carnitin (ALCAR)' THEN 'Acetyl-L-Carnitin'
      WHEN 'L-Carnitin Tartrat' THEN 'L-Carnitin-Tartrat'
      WHEN 'L-Carnitin L-Tartrat (flüssig)' THEN 'L-Carnitin-Tartrat'
      WHEN 'L-Carnitin Fumarat' THEN 'L-Carnitin-Fumarat'
      WHEN 'Propionyl-L-Carnitin' THEN 'Propionyl-L-Carnitin'
    END AS part_name,
    row_number() OVER (
      PARTITION BY legacy.user_product_id, CASE form.name
        WHEN 'Acetyl-L-Carnitin (ALCAR)' THEN 'Acetyl-L-Carnitin'
        WHEN 'L-Carnitin Tartrat' THEN 'L-Carnitin-Tartrat'
        WHEN 'L-Carnitin L-Tartrat (flüssig)' THEN 'L-Carnitin-Tartrat'
        WHEN 'L-Carnitin Fumarat' THEN 'L-Carnitin-Fumarat'
        WHEN 'Propionyl-L-Carnitin' THEN 'Propionyl-L-Carnitin'
      END
      ORDER BY legacy.id
    ) AS part_row_rank
  FROM user_product_ingredients legacy
  JOIN ingredient_forms form ON form.id = legacy.form_id
  JOIN ingredients ingredient
    ON ingredient.id = form.ingredient_id
   AND ingredient.name = 'L-Carnitin'
  WHERE form.name IN (
    'Acetyl-L-Carnitin (ALCAR)', 'L-Carnitin Tartrat',
    'Propionyl-L-Carnitin', 'L-Carnitin L-Tartrat (flüssig)',
    'L-Carnitin Fumarat'
  )
)
INSERT INTO user_product_ingredient_parts (
  user_product_ingredient_id, part_id, quantity, unit,
  basis_quantity, basis_unit, search_relevant
)
SELECT
  parent_row.id,
  part.id,
  legacy.quantity,
  legacy.unit,
  legacy.basis_quantity,
  legacy.basis_unit,
  legacy.search_relevant
FROM legacy_part_rows legacy
JOIN user_product_ingredients parent_row
  ON parent_row.user_product_id = legacy.user_product_id
 AND parent_row.ingredient_id = legacy.ingredient_id
 AND parent_row.form_id IS NULL
 AND parent_row.parent_ingredient_id IS NULL
JOIN ingredient_parts part ON part.name = legacy.part_name
WHERE legacy.part_row_rank = 1;

-- Preserve the distinct liquid-tartrate profile internally before collapsing
-- both former forms into the single canonical tartrate part.
UPDATE ingredient_parts
SET internal_comment =
  COALESCE(NULLIF(trim(internal_comment), '') || char(10), '') ||
  'Legacy-Profil "L-Carnitin L-Tartrat (flüssig)": ' ||
  COALESCE((
    SELECT json_object(
      'effect_summary', profile.effect_summary,
      'timing', profile.timing,
      'timing_note', profile.timing_note,
      'intake_hint', profile.intake_hint,
      'card_note', profile.card_note,
      'translations', json(COALESCE((
        SELECT json_group_array(json_object(
          'language', translation.language,
          'effect_summary', translation.effect_summary,
          'timing', translation.timing,
          'timing_note', translation.timing_note,
          'intake_hint', translation.intake_hint,
          'card_note', translation.card_note
        ))
        FROM display_profile_translations translation
        WHERE translation.display_profile_id = profile.id
      ), '[]'))
    )
    FROM ingredient_display_profiles profile
    JOIN ingredient_forms form ON form.id = profile.form_id
    JOIN ingredients ingredient ON ingredient.id = profile.ingredient_id
    WHERE ingredient.name = 'L-Carnitin'
      AND form.name = 'L-Carnitin L-Tartrat (flüssig)'
    ORDER BY profile.id
    LIMIT 1
  ), '{}')
WHERE name = 'L-Carnitin-Tartrat'
  AND EXISTS (
    SELECT 1
    FROM ingredient_display_profiles profile
    JOIN ingredient_forms form ON form.id = profile.form_id
    JOIN ingredients ingredient ON ingredient.id = profile.ingredient_id
    WHERE ingredient.name = 'L-Carnitin'
      AND form.name = 'L-Carnitin L-Tartrat (flüssig)'
  );

DELETE FROM ingredient_display_profiles
WHERE form_id IN (
  SELECT form.id
  FROM ingredient_forms form
  JOIN ingredients ingredient ON ingredient.id = form.ingredient_id
  WHERE ingredient.name = 'L-Carnitin'
    AND form.name = 'L-Carnitin L-Tartrat (flüssig)'
);

UPDATE ingredient_display_profiles
SET part_id = (
      SELECT part.id FROM ingredient_parts part
      WHERE part.name = CASE (
        SELECT form.name FROM ingredient_forms form
        WHERE form.id = ingredient_display_profiles.form_id
      )
        WHEN 'Acetyl-L-Carnitin (ALCAR)' THEN 'Acetyl-L-Carnitin'
        WHEN 'L-Carnitin Tartrat' THEN 'L-Carnitin-Tartrat'
        WHEN 'L-Carnitin Fumarat' THEN 'L-Carnitin-Fumarat'
        WHEN 'Propionyl-L-Carnitin' THEN 'Propionyl-L-Carnitin'
      END
    ),
    form_id = NULL,
    updated_at = datetime('now'),
    version = version + 1
WHERE ingredient_id = (SELECT id FROM ingredients WHERE name = 'L-Carnitin')
  AND form_id IN (
    SELECT form.id FROM ingredient_forms form
    WHERE form.ingredient_id = ingredient_display_profiles.ingredient_id
      AND form.name IN (
        'Acetyl-L-Carnitin (ALCAR)', 'L-Carnitin Tartrat',
        'L-Carnitin Fumarat', 'Propionyl-L-Carnitin'
      )
  );

UPDATE ingredient_safety_warnings
SET part_id = (
      SELECT part.id FROM ingredient_parts part
      WHERE part.name = CASE (
        SELECT form.name FROM ingredient_forms form
        WHERE form.id = ingredient_safety_warnings.form_id
      )
        WHEN 'Acetyl-L-Carnitin (ALCAR)' THEN 'Acetyl-L-Carnitin'
        WHEN 'L-Carnitin Tartrat' THEN 'L-Carnitin-Tartrat'
        WHEN 'L-Carnitin L-Tartrat (flüssig)' THEN 'L-Carnitin-Tartrat'
        WHEN 'L-Carnitin Fumarat' THEN 'L-Carnitin-Fumarat'
        WHEN 'Propionyl-L-Carnitin' THEN 'Propionyl-L-Carnitin'
      END
    ),
    form_id = NULL,
    version = version + 1
WHERE ingredient_id = (SELECT id FROM ingredients WHERE name = 'L-Carnitin')
  AND form_id IN (
    SELECT form.id FROM ingredient_forms form
    WHERE form.ingredient_id = ingredient_safety_warnings.ingredient_id
      AND form.name IN (
        'Acetyl-L-Carnitin (ALCAR)', 'L-Carnitin Tartrat',
        'L-Carnitin L-Tartrat (flüssig)', 'L-Carnitin Fumarat',
        'Propionyl-L-Carnitin'
      )
  );

UPDATE dose_recommendations
SET part_id = (SELECT id FROM ingredient_parts WHERE name = 'Acetyl-L-Carnitin'),
    updated_at = strftime('%s', 'now'),
    version = version + 1
WHERE ingredient_id = (SELECT id FROM ingredients WHERE name = 'L-Carnitin')
  AND (
    source_label LIKE '%ALCAR%'
    OR source_label LIKE '%Acetyl-L-Carnitin%'
    OR context_note LIKE '%ALCAR%'
    OR context_note LIKE '%Acetyl-L-Carnitin%'
    OR EXISTS (
      SELECT 1 FROM dose_recommendation_translations translation
      WHERE translation.dose_recommendation_id = dose_recommendations.id
        AND (
          translation.source_label LIKE '%ALCAR%'
          OR translation.source_label LIKE '%Acetyl-L-Carnitin%'
          OR translation.context_note LIKE '%ALCAR%'
          OR translation.context_note LIKE '%Acetyl-L-Carnitin%'
        )
    )
  );

DELETE FROM product_ingredients
WHERE form_id IN (
  SELECT form.id
  FROM ingredient_forms form
  JOIN ingredients ingredient ON ingredient.id = form.ingredient_id
  WHERE ingredient.name = 'L-Carnitin'
    AND form.name IN (
      'Acetyl-L-Carnitin (ALCAR)', 'L-Carnitin Tartrat',
      'Propionyl-L-Carnitin', 'L-Carnitin L-Tartrat (flüssig)',
      'L-Carnitin Fumarat'
    )
);

DELETE FROM user_product_ingredients
WHERE form_id IN (
  SELECT form.id
  FROM ingredient_forms form
  JOIN ingredients ingredient ON ingredient.id = form.ingredient_id
  WHERE ingredient.name = 'L-Carnitin'
    AND form.name IN (
      'Acetyl-L-Carnitin (ALCAR)', 'L-Carnitin Tartrat',
      'Propionyl-L-Carnitin', 'L-Carnitin L-Tartrat (flüssig)',
      'L-Carnitin Fumarat'
    )
);

DELETE FROM ingredient_forms
WHERE ingredient_id = (SELECT id FROM ingredients WHERE name = 'L-Carnitin')
  AND name IN (
    'Acetyl-L-Carnitin (ALCAR)', 'L-Carnitin Tartrat',
    'Propionyl-L-Carnitin', 'L-Carnitin L-Tartrat (flüssig)',
    'L-Carnitin Fumarat'
  );

-- Keep canonical relations from being removed while persisted consumers exist.
CREATE TRIGGER IF NOT EXISTS trg_ingredient_part_links_restrict_delete
BEFORE DELETE ON ingredient_part_links
BEGIN
  SELECT RAISE(ABORT, 'Part-Verknüpfung wird noch verwendet.')
  WHERE EXISTS (
      SELECT 1 FROM product_ingredient_parts child
      JOIN product_ingredients parent ON parent.id = child.product_ingredient_id
      WHERE parent.ingredient_id = OLD.ingredient_id AND child.part_id = OLD.part_id
    )
    OR EXISTS (
      SELECT 1 FROM user_product_ingredient_parts child
      JOIN user_product_ingredients parent ON parent.id = child.user_product_ingredient_id
      WHERE parent.ingredient_id = OLD.ingredient_id AND child.part_id = OLD.part_id
    )
    OR EXISTS (
      SELECT 1 FROM ingredient_display_profiles profile
      WHERE profile.ingredient_id = OLD.ingredient_id AND profile.part_id = OLD.part_id
    )
    OR EXISTS (
      SELECT 1 FROM dose_recommendations dose
      WHERE dose.ingredient_id = OLD.ingredient_id AND dose.part_id = OLD.part_id
    )
    OR EXISTS (
      SELECT 1 FROM ingredient_safety_warnings warning
      WHERE warning.ingredient_id = OLD.ingredient_id AND warning.part_id = OLD.part_id
    )
    OR EXISTS (
      SELECT 1 FROM knowledge_article_parts article
      WHERE article.ingredient_id = OLD.ingredient_id AND article.part_id = OLD.part_id
    );
END;

-- Reserve explicit runtime ID ranges through SQLite's AUTOINCREMENT source of
-- truth.  Initializing missing rows here makes UPDATE ... RETURNING atomic and
-- keeps concurrent legacy auto-ID inserts outside reserved ranges.
INSERT INTO sqlite_sequence(name, seq)
SELECT 'products', COALESCE(MAX(id), 0) FROM products
WHERE NOT EXISTS (SELECT 1 FROM sqlite_sequence WHERE name = 'products');
UPDATE sqlite_sequence SET seq = MAX(seq, (SELECT COALESCE(MAX(id), 0) FROM products)) WHERE name = 'products';

INSERT INTO sqlite_sequence(name, seq)
SELECT 'product_ingredients', COALESCE(MAX(id), 0) FROM product_ingredients
WHERE NOT EXISTS (SELECT 1 FROM sqlite_sequence WHERE name = 'product_ingredients');
UPDATE sqlite_sequence SET seq = MAX(seq, (SELECT COALESCE(MAX(id), 0) FROM product_ingredients)) WHERE name = 'product_ingredients';

INSERT INTO sqlite_sequence(name, seq)
SELECT 'user_products', COALESCE(MAX(id), 0) FROM user_products
WHERE NOT EXISTS (SELECT 1 FROM sqlite_sequence WHERE name = 'user_products');
UPDATE sqlite_sequence SET seq = MAX(seq, (SELECT COALESCE(MAX(id), 0) FROM user_products)) WHERE name = 'user_products';

INSERT INTO sqlite_sequence(name, seq)
SELECT 'user_product_ingredients', COALESCE(MAX(id), 0) FROM user_product_ingredients
WHERE NOT EXISTS (SELECT 1 FROM sqlite_sequence WHERE name = 'user_product_ingredients');
UPDATE sqlite_sequence SET seq = MAX(seq, (SELECT COALESCE(MAX(id), 0) FROM user_product_ingredients)) WHERE name = 'user_product_ingredients';

INSERT INTO sqlite_sequence(name, seq)
SELECT 'ingredient_parts', COALESCE(MAX(id), 0) FROM ingredient_parts
WHERE NOT EXISTS (SELECT 1 FROM sqlite_sequence WHERE name = 'ingredient_parts');
UPDATE sqlite_sequence SET seq = MAX(seq, (SELECT COALESCE(MAX(id), 0) FROM ingredient_parts)) WHERE name = 'ingredient_parts';
