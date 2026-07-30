PRAGMA foreign_keys = ON;

-- Seed the new ingredient_parts model from the legacy parent/child mapping.
-- Legacy ingredients and ingredient_sub_ingredients stay intact for compatibility.

INSERT OR IGNORE INTO ingredient_parts (name)
SELECT DISTINCT child.name
FROM ingredient_sub_ingredients legacy
JOIN ingredients child ON child.id = legacy.child_ingredient_id
WHERE trim(child.name) <> '';

WITH legacy_part_synonyms AS (
  SELECT
    part.id AS part_id,
    min(trim(synonym.synonym)) AS synonym,
    COALESCE(NULLIF(trim(synonym.language), ''), 'de') AS language
  FROM ingredient_sub_ingredients legacy
  JOIN ingredients child ON child.id = legacy.child_ingredient_id
  JOIN ingredient_parts part ON part.name = child.name
  JOIN ingredient_synonyms synonym ON synonym.ingredient_id = child.id
  WHERE trim(child.name) <> ''
    AND trim(synonym.synonym) <> ''
  GROUP BY
    part.id,
    lower(trim(synonym.synonym)),
    COALESCE(NULLIF(trim(synonym.language), ''), 'de')
)
INSERT OR IGNORE INTO ingredient_part_synonyms (part_id, synonym, language)
SELECT
  legacy_part_synonyms.part_id,
  legacy_part_synonyms.synonym,
  legacy_part_synonyms.language
FROM legacy_part_synonyms
WHERE NOT EXISTS (
  SELECT 1
  FROM ingredient_part_synonyms existing
  WHERE existing.part_id = legacy_part_synonyms.part_id
    AND lower(trim(existing.synonym)) = lower(trim(legacy_part_synonyms.synonym))
    AND existing.language = legacy_part_synonyms.language
);

INSERT OR IGNORE INTO ingredient_part_links (ingredient_id, part_id, sort_order)
SELECT
  legacy.parent_ingredient_id,
  part.id,
  legacy.sort_order
FROM ingredient_sub_ingredients legacy
JOIN ingredients parent ON parent.id = legacy.parent_ingredient_id
JOIN ingredients child ON child.id = legacy.child_ingredient_id
JOIN ingredient_parts part ON part.name = child.name
WHERE trim(child.name) <> '';
