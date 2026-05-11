PRAGMA foreign_keys = ON;

-- Product 5 is a liquid black seed oil bottle, not capsules.
UPDATE products
SET form = 'Öl',
    serving_size = 1,
    serving_unit = 'ml',
    servings_per_container = 500,
    container_count = 1,
    dosage_text = '40 ml täglich'
WHERE id = 5;

UPDATE product_ingredients
SET quantity = 1,
    unit = 'ml',
    basis_quantity = NULL,
    basis_unit = NULL
WHERE product_id = 5
  AND ingredient_id = 6;
