PRAGMA foreign_keys = OFF;

-- stack_items.product_id originally referenced only catalog products. User
-- products can have colliding numeric IDs, so stack rows now use explicit
-- nullable references. Existing rows are backfilled as catalog products.
CREATE TABLE IF NOT EXISTS stack_items_new (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  stack_id INTEGER NOT NULL,
  catalog_product_id INTEGER,
  user_product_id INTEGER,
  quantity INTEGER NOT NULL DEFAULT 1,
  dosage_text TEXT,
  timing TEXT,
  CHECK (
    (catalog_product_id IS NOT NULL AND user_product_id IS NULL)
    OR
    (catalog_product_id IS NULL AND user_product_id IS NOT NULL)
  ),
  FOREIGN KEY (stack_id) REFERENCES stacks(id) ON DELETE CASCADE,
  FOREIGN KEY (catalog_product_id) REFERENCES products(id) ON DELETE CASCADE,
  FOREIGN KEY (user_product_id) REFERENCES user_products(id) ON DELETE CASCADE
);

INSERT INTO stack_items_new (
  id, stack_id, catalog_product_id, user_product_id, quantity, dosage_text, timing
)
SELECT
  id, stack_id, product_id, NULL, quantity, dosage_text, timing
FROM stack_items;

DROP TABLE stack_items;
ALTER TABLE stack_items_new RENAME TO stack_items;

CREATE INDEX IF NOT EXISTS idx_stack_items_stack_id
  ON stack_items(stack_id);

CREATE INDEX IF NOT EXISTS idx_stack_items_catalog_product_id
  ON stack_items(catalog_product_id);

CREATE INDEX IF NOT EXISTS idx_stack_items_user_product_id
  ON stack_items(user_product_id);

PRAGMA foreign_keys = ON;

-- Demo product D3 dose: previous seed showed 10,000 IU per drop, which is
-- above common adult upper-limit framing and looked like a suggested demo dose.
-- Use a conservative 2,000 IU amount for existing databases.
UPDATE product_ingredients
SET quantity = 2000,
    unit = 'IU'
WHERE product_id = 1
  AND ingredient_id = 1;
