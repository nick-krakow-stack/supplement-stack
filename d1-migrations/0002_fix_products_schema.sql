-- Drop and recreate products table with correct schema.
-- Safe: no real data exists yet (app was never functional before this migration).

DROP TABLE IF EXISTS product_ingredients;
DROP TABLE IF EXISTS stack_items;
DROP TABLE IF EXISTS recommendations;
DROP TABLE IF EXISTS products;

CREATE TABLE products (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  brand TEXT,
  form TEXT,
  price REAL NOT NULL,
  shop_link TEXT,
  image_url TEXT,
  moderation_status TEXT NOT NULL DEFAULT 'pending',
  visibility TEXT NOT NULL DEFAULT 'hidden',
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE product_ingredients (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id INTEGER NOT NULL,
  ingredient_id INTEGER NOT NULL,
  is_main INTEGER DEFAULT 0,
  quantity REAL,
  unit TEXT,
  form_id INTEGER,
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
  FOREIGN KEY (ingredient_id) REFERENCES ingredients(id) ON DELETE CASCADE,
  FOREIGN KEY (form_id) REFERENCES ingredient_forms(id) ON DELETE SET NULL
);

CREATE TABLE stack_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  stack_id INTEGER NOT NULL,
  product_id INTEGER NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  FOREIGN KEY (stack_id) REFERENCES stacks(id) ON DELETE CASCADE,
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
);

CREATE TABLE recommendations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ingredient_id INTEGER NOT NULL,
  product_id INTEGER NOT NULL,
  type TEXT NOT NULL,
  FOREIGN KEY (ingredient_id) REFERENCES ingredients(id) ON DELETE CASCADE,
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_products_visibility ON products(visibility);
CREATE INDEX IF NOT EXISTS idx_products_moderation_status ON products(moderation_status);
CREATE INDEX IF NOT EXISTS idx_product_ingredients_product_id ON product_ingredients(product_id);
CREATE INDEX IF NOT EXISTS idx_product_ingredients_ingredient_id ON product_ingredients(ingredient_id);
CREATE INDEX IF NOT EXISTS idx_recommendations_ingredient_id ON recommendations(ingredient_id);
CREATE INDEX IF NOT EXISTS idx_recommendations_product_id ON recommendations(product_id);
