PRAGMA foreign_keys = ON;

-- Katalogprodukte: Wirkstoffzeilen bleiben kompatibel mit is_main, bekommen
-- aber eigene Suchrelevanz, Bezugsmenge und Parent-Gruppierung.
ALTER TABLE product_ingredients ADD COLUMN basis_quantity REAL;
ALTER TABLE product_ingredients ADD COLUMN basis_unit TEXT;
ALTER TABLE product_ingredients ADD COLUMN search_relevant INTEGER NOT NULL DEFAULT 1 CHECK (search_relevant IN (0, 1));
ALTER TABLE product_ingredients ADD COLUMN parent_ingredient_id INTEGER REFERENCES ingredients(id) ON DELETE SET NULL;

UPDATE product_ingredients
SET search_relevant = 1
WHERE search_relevant IS NULL;

CREATE INDEX IF NOT EXISTS idx_product_ingredients_search_relevant
  ON product_ingredients(ingredient_id, search_relevant);

CREATE INDEX IF NOT EXISTS idx_product_ingredients_parent_ingredient
  ON product_ingredients(parent_ingredient_id);

-- Eigene Produkte brauchen dauerhafte Wirkstoffzeilen, damit Moderation und
-- spaetere Katalog-Konvertierung nicht nur aus Freitext bestehen.
CREATE TABLE IF NOT EXISTS user_product_ingredients (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_product_id INTEGER NOT NULL,
  ingredient_id INTEGER NOT NULL,
  form_id INTEGER,
  quantity REAL,
  unit TEXT,
  basis_quantity REAL,
  basis_unit TEXT,
  search_relevant INTEGER NOT NULL DEFAULT 1 CHECK (search_relevant IN (0, 1)),
  parent_ingredient_id INTEGER,
  is_main INTEGER NOT NULL DEFAULT 0 CHECK (is_main IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (user_product_id) REFERENCES user_products(id) ON DELETE CASCADE,
  FOREIGN KEY (ingredient_id) REFERENCES ingredients(id) ON DELETE CASCADE,
  FOREIGN KEY (form_id) REFERENCES ingredient_forms(id) ON DELETE SET NULL,
  FOREIGN KEY (parent_ingredient_id) REFERENCES ingredients(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_user_product_ingredients_user_product_id
  ON user_product_ingredients(user_product_id);

CREATE INDEX IF NOT EXISTS idx_user_product_ingredients_ingredient_id
  ON user_product_ingredients(ingredient_id);

CREATE INDEX IF NOT EXISTS idx_user_product_ingredients_search_relevant
  ON user_product_ingredients(ingredient_id, search_relevant);

CREATE INDEX IF NOT EXISTS idx_user_product_ingredients_parent_ingredient
  ON user_product_ingredients(parent_ingredient_id);

-- Parent/Child-Mapping fuer Sub-Wirkstoffe, z.B. Vitamin-C-Komplexe,
-- Extraktmarker oder Detailformen, ohne harte Seed-Annahmen.
CREATE TABLE IF NOT EXISTS ingredient_sub_ingredients (
  parent_ingredient_id INTEGER NOT NULL,
  child_ingredient_id INTEGER NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  prompt_label TEXT,
  is_default_prompt INTEGER NOT NULL DEFAULT 0 CHECK (is_default_prompt IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (parent_ingredient_id, child_ingredient_id),
  CHECK (parent_ingredient_id <> child_ingredient_id),
  FOREIGN KEY (parent_ingredient_id) REFERENCES ingredients(id) ON DELETE CASCADE,
  FOREIGN KEY (child_ingredient_id) REFERENCES ingredients(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_ingredient_sub_ingredients_child
  ON ingredient_sub_ingredients(child_ingredient_id);

CREATE INDEX IF NOT EXISTS idx_ingredient_sub_ingredients_parent_sort
  ON ingredient_sub_ingredients(parent_ingredient_id, sort_order, child_ingredient_id);

ALTER TABLE user_products ADD COLUMN published_product_id INTEGER REFERENCES products(id) ON DELETE SET NULL;
ALTER TABLE user_products ADD COLUMN published_at TEXT;

CREATE INDEX IF NOT EXISTS idx_user_products_published_product_id
  ON user_products(published_product_id);
