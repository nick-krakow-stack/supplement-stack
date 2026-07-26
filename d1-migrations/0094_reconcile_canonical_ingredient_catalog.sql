-- Reconcile the three canonical mineral/trace-element rows that were already
-- present before the catalog migration, and add the intended UTF-8 aliases.
-- This migration is additive, idempotent for its complete post-state, and
-- fails closed on a mixed or unexpected target state.

WITH targets(id, name, category, unit) AS (
  VALUES
    (43, 'Natrium', 'mineral', 'mg'),
    (44, 'Phosphor', 'mineral', 'mg'),
    (49, 'Molybdän', 'trace_element', 'µg')
),
alias_ingredients(name, category) AS (
  VALUES
    ('Löwenmähne (Hericium)', 'medicinal_mushroom'),
    ('Grüner Tee (EGCG)', 'plant_extract'),
    ('MCT-Öl', 'fatty_acid')
),
aliases(ingredient_name, synonym) AS (
  VALUES
    ('Löwenmähne (Hericium)', 'Löwenmähne'),
    ('Löwenmähne (Hericium)', 'Hericium'),
    ('Grüner Tee (EGCG)', 'Grüner Tee'),
    ('Grüner Tee (EGCG)', 'EGCG'),
    ('MCT-Öl', 'MCT Oel')
)
SELECT CASE WHEN (
  (
    (SELECT COUNT(*)
     FROM targets AS t
     JOIN ingredients AS i ON i.id = t.id
     WHERE i.name = t.name
       AND i.category = t.category
       AND i.unit = t.unit
       AND i.preferred_unit = t.unit
       AND i.is_active = 0
       AND i.version = 1) = 3
    OR
    (SELECT COUNT(*)
     FROM targets AS t
     JOIN ingredients AS i ON i.id = t.id
     WHERE i.name = t.name
       AND i.category = t.category
       AND i.unit = t.unit
       AND i.preferred_unit = t.unit
       AND i.is_active = 1
       AND i.version = 2) = 3
  )
  AND EXISTS (
    SELECT 1 FROM ingredients
    WHERE id = 8 AND name = 'B-Vitamin-Komplex' AND is_active = 0 AND version = 1
  )
  AND EXISTS (
    SELECT 1 FROM ingredients
    WHERE id = 63 AND name = 'ALA' AND category = 'fatty_acid'
      AND unit = 'mg' AND preferred_unit = 'mg' AND is_active = 0 AND version = 1
  )
  AND (
    SELECT COUNT(*)
    FROM alias_ingredients AS expected
    JOIN ingredients AS i
      ON i.name = expected.name
     AND i.category = expected.category
     AND i.is_active = 1
  ) = 3
  AND NOT EXISTS (
    SELECT 1
    FROM aliases AS expected
    JOIN ingredients AS i ON i.name = expected.ingredient_name
    WHERE (
      SELECT COUNT(*)
      FROM ingredient_synonyms AS existing
      WHERE existing.ingredient_id = i.id
        AND lower(trim(existing.synonym)) = lower(trim(expected.synonym))
        AND existing.language = 'de'
    ) > 1
  )
) THEN 1 ELSE abs(-9223372036854775808) END AS migration_precondition;

WITH targets(id, name, category, unit) AS (
  VALUES
    (43, 'Natrium', 'mineral', 'mg'),
    (44, 'Phosphor', 'mineral', 'mg'),
    (49, 'Molybdän', 'trace_element', 'µg')
)
UPDATE ingredients
SET is_active = 1,
    version = 2
WHERE is_active = 0
  AND version = 1
  AND EXISTS (
    SELECT 1
    FROM targets AS expected
    WHERE expected.id = ingredients.id
      AND expected.name = ingredients.name
      AND expected.category = ingredients.category
      AND expected.unit = ingredients.unit
      AND expected.unit = ingredients.preferred_unit
  );

WITH aliases(ingredient_name, synonym) AS (
  VALUES
    ('Löwenmähne (Hericium)', 'Löwenmähne'),
    ('Löwenmähne (Hericium)', 'Hericium'),
    ('Grüner Tee (EGCG)', 'Grüner Tee'),
    ('Grüner Tee (EGCG)', 'EGCG'),
    ('MCT-Öl', 'MCT Oel')
)
INSERT INTO ingredient_synonyms (ingredient_id, synonym, language)
SELECT i.id, expected.synonym, 'de'
FROM aliases AS expected
JOIN ingredients AS i ON i.name = expected.ingredient_name
WHERE NOT EXISTS (
  SELECT 1
  FROM ingredient_synonyms AS existing
  WHERE existing.ingredient_id = i.id
    AND lower(trim(existing.synonym)) = lower(trim(expected.synonym))
    AND existing.language = 'de'
);

WITH targets(id, name, category, unit) AS (
  VALUES
    (43, 'Natrium', 'mineral', 'mg'),
    (44, 'Phosphor', 'mineral', 'mg'),
    (49, 'Molybdän', 'trace_element', 'µg')
),
aliases(ingredient_name, synonym) AS (
  VALUES
    ('Löwenmähne (Hericium)', 'Löwenmähne'),
    ('Löwenmähne (Hericium)', 'Hericium'),
    ('Grüner Tee (EGCG)', 'Grüner Tee'),
    ('Grüner Tee (EGCG)', 'EGCG'),
    ('MCT-Öl', 'MCT Oel')
)
SELECT CASE WHEN (
  (SELECT COUNT(*)
   FROM targets AS t
   JOIN ingredients AS i ON i.id = t.id
   WHERE i.name = t.name
     AND i.category = t.category
     AND i.unit = t.unit
     AND i.preferred_unit = t.unit
     AND i.is_active = 1
     AND i.version = 2) = 3
  AND EXISTS (
    SELECT 1 FROM ingredients
    WHERE id = 8 AND name = 'B-Vitamin-Komplex' AND is_active = 0 AND version = 1
  )
  AND EXISTS (
    SELECT 1 FROM ingredients
    WHERE id = 63 AND name = 'ALA' AND category = 'fatty_acid'
      AND unit = 'mg' AND preferred_unit = 'mg' AND is_active = 0 AND version = 1
  )
  AND NOT EXISTS (
    SELECT 1
    FROM aliases AS expected
    JOIN ingredients AS i ON i.name = expected.ingredient_name
    WHERE (
      SELECT COUNT(*)
      FROM ingredient_synonyms AS existing
      WHERE existing.ingredient_id = i.id
        AND lower(trim(existing.synonym)) = lower(trim(expected.synonym))
        AND existing.language = 'de'
    ) <> 1
  )
) THEN 1 ELSE abs(-9223372036854775808) END AS migration_postcondition;
