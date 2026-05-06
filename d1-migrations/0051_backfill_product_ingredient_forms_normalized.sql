PRAGMA foreign_keys = ON;

-- Catch product/form matches that differ only by simple separators, e.g.
-- "Magnesium Bisglycinat" vs "Magnesiumbisglycinat".
UPDATE product_ingredients
SET form_id = (
  SELECT f.id
  FROM products p
  JOIN ingredient_forms f ON f.ingredient_id = product_ingredients.ingredient_id
  WHERE p.id = product_ingredients.product_id
    AND instr(
      lower(replace(replace(replace(p.name, ' ', ''), '-', ''), '_', '')),
      lower(replace(replace(replace(f.name, ' ', ''), '-', ''), '_', ''))
    ) > 0
  ORDER BY length(f.name) DESC, f.id ASC
  LIMIT 1
)
WHERE form_id IS NULL
  AND EXISTS (
    SELECT 1
    FROM products p
    JOIN ingredient_forms f ON f.ingredient_id = product_ingredients.ingredient_id
    WHERE p.id = product_ingredients.product_id
      AND instr(
        lower(replace(replace(replace(p.name, ' ', ''), '-', ''), '_', '')),
        lower(replace(replace(replace(f.name, ' ', ''), '-', ''), '_', ''))
      ) > 0
  );

UPDATE user_product_ingredients
SET form_id = (
  SELECT f.id
  FROM user_products up
  JOIN ingredient_forms f ON f.ingredient_id = user_product_ingredients.ingredient_id
  WHERE up.id = user_product_ingredients.user_product_id
    AND instr(
      lower(replace(replace(replace(up.name, ' ', ''), '-', ''), '_', '')),
      lower(replace(replace(replace(f.name, ' ', ''), '-', ''), '_', ''))
    ) > 0
  ORDER BY length(f.name) DESC, f.id ASC
  LIMIT 1
)
WHERE form_id IS NULL
  AND EXISTS (
    SELECT 1
    FROM user_products up
    JOIN ingredient_forms f ON f.ingredient_id = user_product_ingredients.ingredient_id
    WHERE up.id = user_product_ingredients.user_product_id
      AND instr(
        lower(replace(replace(replace(up.name, ' ', ''), '-', ''), '_', '')),
        lower(replace(replace(replace(f.name, ' ', ''), '-', ''), '_', ''))
      ) > 0
  );
