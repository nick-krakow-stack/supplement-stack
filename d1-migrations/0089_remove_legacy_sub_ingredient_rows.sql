PRAGMA foreign_keys = ON;

-- After seeding ingredient_parts, remove legacy child ingredients that only
-- existed to model sub-ingredient/part relationships.
--
-- Scope is intentionally restricted to child_ingredient_id values from the
-- legacy ingredient_sub_ingredients table. Product references are protected so
-- no existing product/user-product row is orphaned by this cleanup.

DELETE FROM ingredients
WHERE id IN (
  SELECT DISTINCT legacy.child_ingredient_id
  FROM ingredient_sub_ingredients legacy
  JOIN ingredients child ON child.id = legacy.child_ingredient_id
  JOIN ingredient_parts part ON part.name = child.name
  JOIN ingredient_part_links link
    ON link.ingredient_id = legacy.parent_ingredient_id
   AND link.part_id = part.id
)
AND NOT EXISTS (
  SELECT 1
  FROM product_ingredients pi
  WHERE pi.ingredient_id = ingredients.id
     OR pi.parent_ingredient_id = ingredients.id
)
AND NOT EXISTS (
  SELECT 1
  FROM user_product_ingredients upi
  WHERE upi.ingredient_id = ingredients.id
     OR upi.parent_ingredient_id = ingredients.id
);
