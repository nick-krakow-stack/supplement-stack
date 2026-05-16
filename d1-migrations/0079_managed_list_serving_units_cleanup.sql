PRAGMA foreign_keys = ON;

ALTER TABLE managed_list_items ADD COLUMN plural_label TEXT;

INSERT INTO managed_list_items (list_key, value, label, plural_label, sort_order, active)
VALUES
  ('serving_unit', 'Kapsel', 'Kapsel', 'Kapseln', 10, 1),
  ('serving_unit', 'Tablette', 'Tablette', 'Tabletten', 20, 1),
  ('serving_unit', 'Lutschtablette', 'Lutschtablette', 'Lutschtabletten', 30, 1),
  ('serving_unit', 'Tropfen', 'Tropfen', 'Tropfen', 40, 1),
  ('serving_unit', 'Portion', 'Portion', 'Portionen', 50, 1),
  ('serving_unit', 'Messlöffel', 'Messlöffel', 'Messlöffel', 60, 1),
  ('serving_unit', 'Beutel', 'Beutel', 'Beutel', 70, 1),
  ('serving_unit', 'Stick', 'Stick', 'Sticks', 80, 1),
  ('serving_unit', 'Softgel', 'Softgel', 'Softgels', 90, 1),
  ('serving_unit', 'Scoop', 'Scoop', 'Scoops', 100, 1)
ON CONFLICT(list_key, value) DO UPDATE SET
  label = excluded.label,
  plural_label = excluded.plural_label,
  sort_order = excluded.sort_order,
  active = 1,
  updated_at = datetime('now'),
  version = COALESCE(managed_list_items.version, 0) + 1;

-- Normalize known legacy serving units to canonical managed values (case/spacing-safe),
-- including hard deactivation targets (mg/g/ml) to avoid uneditable historical rows.
UPDATE products
SET serving_unit = CASE
  WHEN LOWER(TRIM(serving_unit)) IN ('mg', 'g', 'ml') THEN 'Portion'
  WHEN LOWER(TRIM(serving_unit)) IN ('kapseln') THEN 'Kapsel'
  WHEN LOWER(TRIM(serving_unit)) IN ('tabletten') THEN 'Tablette'
  WHEN LOWER(TRIM(serving_unit)) IN ('lutschtabletten') THEN 'Lutschtablette'
  WHEN LOWER(TRIM(serving_unit)) IN ('portionen') THEN 'Portion'
  WHEN LOWER(TRIM(serving_unit)) IN ('messloeffel', 'messlöffel')
    OR hex(LOWER(TRIM(serving_unit))) IN ('6D6573736CC383C2B66666656C', '6D6573736CC383C692C382C2B66666656C')
    THEN 'Messlöffel'
  WHEN LOWER(TRIM(serving_unit)) IN ('softgels') THEN 'Softgel'
  WHEN LOWER(TRIM(serving_unit)) IN ('sticks') THEN 'Stick'
  WHEN LOWER(TRIM(serving_unit)) IN ('scoops') THEN 'Scoop'
  ELSE serving_unit
END
WHERE serving_unit IS NOT NULL
  AND LOWER(TRIM(serving_unit)) IN (
    'mg',
    'g',
    'ml',
    'kapseln',
    'tabletten',
    'lutschtabletten',
    'portionen',
    'messloeffel',
    'messlöffel',
    'softgels',
    'sticks',
    'scoops'
  );

UPDATE user_products
SET serving_unit = CASE
  WHEN LOWER(TRIM(serving_unit)) IN ('mg', 'g', 'ml') THEN 'Portion'
  WHEN LOWER(TRIM(serving_unit)) IN ('kapseln') THEN 'Kapsel'
  WHEN LOWER(TRIM(serving_unit)) IN ('tabletten') THEN 'Tablette'
  WHEN LOWER(TRIM(serving_unit)) IN ('lutschtabletten') THEN 'Lutschtablette'
  WHEN LOWER(TRIM(serving_unit)) IN ('portionen') THEN 'Portion'
  WHEN LOWER(TRIM(serving_unit)) IN ('messloeffel', 'messlöffel')
    OR hex(LOWER(TRIM(serving_unit))) IN ('6D6573736CC383C2B66666656C', '6D6573736CC383C692C382C2B66666656C')
    THEN 'Messlöffel'
  WHEN LOWER(TRIM(serving_unit)) IN ('softgels') THEN 'Softgel'
  WHEN LOWER(TRIM(serving_unit)) IN ('sticks') THEN 'Stick'
  WHEN LOWER(TRIM(serving_unit)) IN ('scoops') THEN 'Scoop'
  ELSE serving_unit
END
WHERE serving_unit IS NOT NULL
  AND LOWER(TRIM(serving_unit)) IN (
    'mg',
    'g',
    'ml',
    'kapseln',
    'tabletten',
    'lutschtabletten',
    'portionen',
    'messloeffel',
    'messlöffel',
    'softgels',
    'sticks',
    'scoops'
  );

UPDATE managed_list_items
SET active = 0,
    updated_at = datetime('now'),
    version = COALESCE(version, 0) + 1
WHERE list_key = 'serving_unit'
  AND LOWER(TRIM(value)) IN ('mg', 'g', 'ml');

UPDATE managed_list_items
SET active = 0,
    updated_at = datetime('now'),
    version = COALESCE(version, 0) + 1
WHERE list_key = 'serving_unit'
  AND value IN (
    'Kapseln',
    'Tabletten',
    'Lutschtabletten',
    'Portionen',
    'Messloeffel',
    'Softgels',
    'Sticks',
    'Scoops'
  );
