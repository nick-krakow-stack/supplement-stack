PRAGMA foreign_keys = ON;

-- Backfill required catalog metadata for legacy demo products from migration 0003.
-- Prices for IDs 1-21 stay unchanged and are treated as fictional 30-day package
-- prices. Serving/container values are therefore set to 30 package servings.

UPDATE products
SET brand = COALESCE(NULLIF(TRIM(brand), ''), 'Supplement Stack Demo'),
    serving_size = CASE id
      WHEN 1 THEN 1
      WHEN 2 THEN 2
      WHEN 3 THEN 1
      WHEN 4 THEN 1
      WHEN 5 THEN 2
      WHEN 6 THEN 1
      WHEN 7 THEN 1
      WHEN 8 THEN 2
      WHEN 9 THEN 1
      WHEN 10 THEN 1
      WHEN 11 THEN 10
      WHEN 12 THEN 4
      WHEN 13 THEN 4
      WHEN 14 THEN 1
      WHEN 15 THEN 1
      WHEN 16 THEN 10
      WHEN 17 THEN 1
      WHEN 18 THEN 1
      WHEN 19 THEN 2
      WHEN 20 THEN 6
      WHEN 21 THEN 5
      ELSE serving_size
    END,
    serving_unit = CASE id
      WHEN 1 THEN 'Tropfen'
      WHEN 2 THEN 'Kapseln'
      WHEN 3 THEN 'Kapsel'
      WHEN 4 THEN 'Kapsel'
      WHEN 5 THEN 'Kapseln'
      WHEN 6 THEN 'Kapsel'
      WHEN 7 THEN 'Tablette'
      WHEN 8 THEN 'Kapseln'
      WHEN 9 THEN 'Portion'
      WHEN 10 THEN 'Tablette'
      WHEN 11 THEN 'g'
      WHEN 12 THEN 'Kapseln'
      WHEN 13 THEN 'Tropfen'
      WHEN 14 THEN 'Softgel'
      WHEN 15 THEN 'Tablette'
      WHEN 16 THEN 'g'
      WHEN 17 THEN 'Kapsel'
      WHEN 18 THEN 'Tablette'
      WHEN 19 THEN 'Tabletten'
      WHEN 20 THEN 'Tabletten'
      WHEN 21 THEN 'g'
      ELSE serving_unit
    END,
    servings_per_container = 30,
    container_count = 1
WHERE id BETWEEN 1 AND 21;

-- Fill missing ingredient amounts with plausible fictional values based on
-- the original seed comments and ingredient units. Existing positive amounts
-- remain untouched.
UPDATE product_ingredients
SET quantity = CASE
      WHEN product_id = 3 AND ingredient_id = 4 THEN 200
      WHEN product_id = 4 AND ingredient_id = 5 THEN 1000
      WHEN product_id = 6 AND ingredient_id = 7 THEN 250
      WHEN product_id = 7 AND ingredient_id = 8 THEN 1
      WHEN product_id = 9 AND ingredient_id = 10 THEN 2000
      WHEN product_id = 15 AND ingredient_id = 16 THEN 200
      WHEN product_id = 16 AND ingredient_id = 17 THEN 10
      WHEN product_id = 17 AND ingredient_id = 18 THEN 400
      WHEN product_id = 19 AND ingredient_id = 5 THEN 200
      WHEN product_id = 20 AND ingredient_id = 21 THEN 3
      WHEN product_id = 20 AND ingredient_id = 22 THEN 3
      WHEN product_id = 21 AND ingredient_id = 23 THEN 5
      ELSE quantity
    END,
    unit = CASE
      WHEN product_id = 3 AND ingredient_id = 4 THEN 'mg'
      WHEN product_id = 4 AND ingredient_id = 5 THEN 'mg'
      WHEN product_id = 6 AND ingredient_id = 7 THEN 'mg'
      WHEN product_id = 7 AND ingredient_id = 8 THEN 'Komplex'
      WHEN product_id = 9 AND ingredient_id = 10 THEN 'mg'
      WHEN product_id = 15 AND ingredient_id = 16 THEN 'ug'
      WHEN product_id = 16 AND ingredient_id = 17 THEN 'g'
      WHEN product_id = 17 AND ingredient_id = 18 THEN 'mg'
      WHEN product_id = 19 AND ingredient_id = 5 THEN 'mg'
      WHEN product_id = 20 AND ingredient_id = 21 THEN 'g'
      WHEN product_id = 20 AND ingredient_id = 22 THEN 'g'
      WHEN product_id = 21 AND ingredient_id = 23 THEN 'g'
      ELSE unit
    END
WHERE product_id BETWEEN 1 AND 21
  AND (quantity IS NULL OR quantity <= 0 OR unit IS NULL OR TRIM(unit) = '');
