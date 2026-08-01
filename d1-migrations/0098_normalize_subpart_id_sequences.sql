PRAGMA foreign_keys = ON;

-- Historical table rebuilds can leave more than one sqlite_sequence row for
-- the same AUTOINCREMENT table.  The subpart runtime reserves explicit ID
-- ranges through this source of truth, so each targeted table must have one
-- row whose value is at least the current maximum persisted ID.
CREATE TABLE _0098_subpart_sequence_repair (
  name TEXT PRIMARY KEY,
  seq INTEGER NOT NULL
);

INSERT INTO _0098_subpart_sequence_repair(name, seq)
SELECT 'products', MAX(
  COALESCE((SELECT MAX(seq) FROM sqlite_sequence WHERE name = 'products'), 0),
  COALESCE((SELECT MAX(id) FROM products), 0)
);
INSERT INTO _0098_subpart_sequence_repair(name, seq)
SELECT 'product_ingredients', MAX(
  COALESCE((SELECT MAX(seq) FROM sqlite_sequence WHERE name = 'product_ingredients'), 0),
  COALESCE((SELECT MAX(id) FROM product_ingredients), 0)
);
INSERT INTO _0098_subpart_sequence_repair(name, seq)
SELECT 'user_products', MAX(
  COALESCE((SELECT MAX(seq) FROM sqlite_sequence WHERE name = 'user_products'), 0),
  COALESCE((SELECT MAX(id) FROM user_products), 0)
);
INSERT INTO _0098_subpart_sequence_repair(name, seq)
SELECT 'user_product_ingredients', MAX(
  COALESCE((SELECT MAX(seq) FROM sqlite_sequence WHERE name = 'user_product_ingredients'), 0),
  COALESCE((SELECT MAX(id) FROM user_product_ingredients), 0)
);
INSERT INTO _0098_subpart_sequence_repair(name, seq)
SELECT 'ingredient_parts', MAX(
  COALESCE((SELECT MAX(seq) FROM sqlite_sequence WHERE name = 'ingredient_parts'), 0),
  COALESCE((SELECT MAX(id) FROM ingredient_parts), 0)
);

DELETE FROM sqlite_sequence
WHERE name IN (
  'products',
  'product_ingredients',
  'user_products',
  'user_product_ingredients',
  'ingredient_parts'
);

INSERT INTO sqlite_sequence(name, seq)
SELECT name, seq
FROM _0098_subpart_sequence_repair
ORDER BY name;

DROP TABLE _0098_subpart_sequence_repair;
