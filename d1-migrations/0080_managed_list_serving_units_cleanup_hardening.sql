PRAGMA foreign_keys = ON;

-- Follow-up hardening for already-applied migration 0079.
-- Keep this no-op-safe: do not change schema, only normalize remaining legacy data.

UPDATE products
SET serving_unit = CASE
  WHEN LOWER(TRIM(serving_unit)) IN ('mg', 'g', 'ml') THEN 'Portion'
  WHEN LOWER(TRIM(serving_unit)) = 'kapseln' THEN 'Kapsel'
  WHEN LOWER(TRIM(serving_unit)) = 'tabletten' THEN 'Tablette'
  WHEN LOWER(TRIM(serving_unit)) = 'lutschtabletten' THEN 'Lutschtablette'
  WHEN LOWER(TRIM(serving_unit)) = 'portionen' THEN 'Portion'
  WHEN LOWER(REPLACE(TRIM(serving_unit), 'Ö', 'ö')) IN ('messloeffel', 'messlöffel')
    OR hex(LOWER(TRIM(serving_unit))) IN (
      '6D6573736CC383C2B66666656C',
      '6D6573736CC383C692C382C2B66666656C',
      '6D6573736CEFBFBD6666656C'
    )
    THEN 'Messlöffel'
  WHEN LOWER(TRIM(serving_unit)) = 'softgels' THEN 'Softgel'
  WHEN LOWER(TRIM(serving_unit)) = 'sticks' THEN 'Stick'
  WHEN LOWER(TRIM(serving_unit)) = 'scoops' THEN 'Scoop'
  ELSE TRIM(serving_unit)
END
WHERE serving_unit IS NOT NULL
  AND (
    LOWER(TRIM(serving_unit)) IN (
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
    )
    OR LOWER(REPLACE(TRIM(serving_unit), 'Ö', 'ö')) IN ('messloeffel', 'messlöffel')
    OR hex(LOWER(TRIM(serving_unit))) IN (
      '6D6573736CC383C2B66666656C',
      '6D6573736CC383C692C382C2B66666656C',
      '6D6573736CEFBFBD6666656C'
    )
  );

UPDATE user_products
SET serving_unit = CASE
  WHEN LOWER(TRIM(serving_unit)) IN ('mg', 'g', 'ml') THEN 'Portion'
  WHEN LOWER(TRIM(serving_unit)) = 'kapseln' THEN 'Kapsel'
  WHEN LOWER(TRIM(serving_unit)) = 'tabletten' THEN 'Tablette'
  WHEN LOWER(TRIM(serving_unit)) = 'lutschtabletten' THEN 'Lutschtablette'
  WHEN LOWER(TRIM(serving_unit)) = 'portionen' THEN 'Portion'
  WHEN LOWER(REPLACE(TRIM(serving_unit), 'Ö', 'ö')) IN ('messloeffel', 'messlöffel')
    OR hex(LOWER(TRIM(serving_unit))) IN (
      '6D6573736CC383C2B66666656C',
      '6D6573736CC383C692C382C2B66666656C',
      '6D6573736CEFBFBD6666656C'
    )
    THEN 'Messlöffel'
  WHEN LOWER(TRIM(serving_unit)) = 'softgels' THEN 'Softgel'
  WHEN LOWER(TRIM(serving_unit)) = 'sticks' THEN 'Stick'
  WHEN LOWER(TRIM(serving_unit)) = 'scoops' THEN 'Scoop'
  ELSE TRIM(serving_unit)
END
WHERE serving_unit IS NOT NULL
  AND (
    LOWER(TRIM(serving_unit)) IN (
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
    )
    OR LOWER(REPLACE(TRIM(serving_unit), 'Ö', 'ö')) IN ('messloeffel', 'messlöffel')
    OR hex(LOWER(TRIM(serving_unit))) IN (
      '6D6573736CC383C2B66666656C',
      '6D6573736CC383C692C382C2B66666656C',
      '6D6573736CEFBFBD6666656C'
    )
  );

UPDATE managed_list_items
SET active = 0,
    updated_at = datetime('now'),
    version = COALESCE(version, 0) + 1
WHERE list_key = 'serving_unit'
  AND COALESCE(active, 0) <> 0
  AND (
    LOWER(TRIM(value)) IN (
      'mg',
      'g',
      'ml',
      'kapseln',
      'tabletten',
      'lutschtabletten',
      'portionen',
      'messloeffel',
      'softgels',
      'sticks',
      'scoops'
    )
    OR LOWER(TRIM(label)) IN (
      'mg',
      'g',
      'ml',
      'kapseln',
      'tabletten',
      'lutschtabletten',
      'portionen',
      'messloeffel',
      'softgels',
      'sticks',
      'scoops'
    )
    OR (LOWER(REPLACE(TRIM(value), 'Ö', 'ö')) = 'messlöffel' AND value <> 'Messlöffel')
    OR (LOWER(REPLACE(TRIM(label), 'Ö', 'ö')) = 'messlöffel' AND value <> 'Messlöffel')
    OR hex(LOWER(TRIM(value))) IN (
      '6D6573736CC383C2B66666656C',
      '6D6573736CC383C692C382C2B66666656C',
      '6D6573736CEFBFBD6666656C'
    )
    OR hex(LOWER(TRIM(label))) IN (
      '6D6573736CC383C2B66666656C',
      '6D6573736CC383C692C382C2B66666656C',
      '6D6573736CEFBFBD6666656C'
    )
  );
