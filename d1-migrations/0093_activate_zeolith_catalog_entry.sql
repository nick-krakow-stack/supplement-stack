-- Keep Zeolith visible in the active canonical ingredient catalog.
-- Narrow data-only migration: no schema change and no article/content creation.

UPDATE ingredients
SET
  name = 'Zeolith',
  category = 'other',
  unit = 'g',
  preferred_unit = 'g',
  is_active = 1,
  version = COALESCE(version, 0) + 1
WHERE id = 23
  AND lower(trim(name)) = lower(trim('Zeolith'))
  AND (
    COALESCE(category, '') <> 'other'
    OR COALESCE(unit, '') <> 'g'
    OR COALESCE(preferred_unit, '') <> 'g'
    OR is_active <> 1
  );
