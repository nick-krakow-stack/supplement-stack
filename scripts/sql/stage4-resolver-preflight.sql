SELECT
  'ingredient' AS row_kind,
  id AS entity_id,
  lower(replace(trim(name), ' ', '-')) AS entity_slug
FROM ingredients
WHERE is_active = 1
UNION ALL
SELECT
  'population' AS row_kind,
  id AS entity_id,
  slug AS entity_slug
FROM populations
ORDER BY row_kind, entity_id;
