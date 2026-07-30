-- One-time reconciliation for production D1 only.
-- The schema/data bytes represented by 0091-0093 are already present remotely,
-- but their Wrangler ledger rows are missing. This single INSERT records those
-- exact filenames only when every independently reviewed precondition matches.

WITH expected_ledger(id, name) AS (
  VALUES
    (78, '0091_add_ingredient_is_active.sql'),
    (79, '0092_canonical_ingredient_catalog.sql'),
    (80, '0093_activate_zeolith_catalog_entry.sql')
),
expected_catalog(name, category) AS (
  VALUES
    ('Vitamin A', 'vitamin'),
    ('Vitamin B1', 'vitamin'),
    ('Vitamin B2', 'vitamin'),
    ('Vitamin B3', 'vitamin'),
    ('Vitamin B5', 'vitamin'),
    ('Vitamin B6', 'vitamin'),
    ('Vitamin B7', 'vitamin'),
    ('Vitamin B9', 'vitamin'),
    ('Vitamin B12', 'vitamin'),
    ('Vitamin C', 'vitamin'),
    ('Vitamin D', 'vitamin'),
    ('Vitamin E', 'vitamin'),
    ('Vitamin K', 'vitamin'),
    ('Cholin', 'vitamin'),
    ('Inositol', 'vitamin'),
    ('Calcium', 'mineral'),
    ('Kalium', 'mineral'),
    ('Magnesium', 'mineral'),
    ('Elektrolyte', 'mineral'),
    ('Chrom', 'trace_element'),
    ('Eisen', 'trace_element'),
    ('Jod', 'trace_element'),
    ('Kupfer', 'trace_element'),
    ('Mangan', 'trace_element'),
    ('Selen', 'trace_element'),
    ('Zink', 'trace_element'),
    ('BCAA', 'amino_acid_protein'),
    ('Beta-Alanin', 'amino_acid_protein'),
    ('Glycin', 'amino_acid_protein'),
    ('Glutathion', 'amino_acid_protein'),
    ('Kollagen', 'amino_acid_protein'),
    ('Kreatin', 'amino_acid_protein'),
    ('L-Arginin', 'amino_acid_protein'),
    ('L-Carnitin', 'amino_acid_protein'),
    ('L-Citrullin', 'amino_acid_protein'),
    ('L-Glutamin', 'amino_acid_protein'),
    ('L-Theanin', 'amino_acid_protein'),
    ('L-Tryptophan', 'amino_acid_protein'),
    ('L-Tyrosin', 'amino_acid_protein'),
    ('Taurin', 'amino_acid_protein'),
    ('5-HTP', 'amino_acid_protein'),
    ('GABA', 'amino_acid_protein'),
    ('Omega-3', 'fatty_acid'),
    ('MCT-Öl', 'fatty_acid'),
    ('Krillöl', 'fatty_acid'),
    ('Ashwagandha', 'plant_extract'),
    ('Baldrian', 'plant_extract'),
    ('Berberin', 'plant_extract'),
    ('Boswellia (Weihrauch)', 'plant_extract'),
    ('Brennnessel', 'plant_extract'),
    ('Chlorella', 'plant_extract'),
    ('Curcumin', 'plant_extract'),
    ('Ginkgo', 'plant_extract'),
    ('Ginseng', 'plant_extract'),
    ('Grapefruitkernextrakt', 'plant_extract'),
    ('Grüner Tee (EGCG)', 'plant_extract'),
    ('Maca', 'plant_extract'),
    ('Mariendistel (Silymarin)', 'plant_extract'),
    ('Mönchspfeffer', 'plant_extract'),
    ('OPC', 'plant_extract'),
    ('Pfefferminz', 'plant_extract'),
    ('Quercetin', 'plant_extract'),
    ('Resveratrol', 'plant_extract'),
    ('Rhodiola Rosea', 'plant_extract'),
    ('Sägepalme', 'plant_extract'),
    ('Schwarzkümmelöl', 'plant_extract'),
    ('Spirulina', 'plant_extract'),
    ('Reishi', 'medicinal_mushroom'),
    ('Cordyceps', 'medicinal_mushroom'),
    ('Löwenmähne (Hericium)', 'medicinal_mushroom'),
    ('Chaga', 'medicinal_mushroom'),
    ('Maitake', 'medicinal_mushroom'),
    ('Shiitake', 'medicinal_mushroom'),
    ('Birkenporling', 'medicinal_mushroom'),
    ('Zunderschwamm', 'medicinal_mushroom'),
    ('Bromelain', 'enzyme'),
    ('Papain', 'enzyme'),
    ('Laktase', 'enzyme'),
    ('Probiotika', 'probiotic'),
    ('Saccharomyces boulardii', 'probiotic'),
    ('Glucosamin', 'other'),
    ('Chondroitin', 'other'),
    ('Hyaluronsäure', 'other'),
    ('MSM', 'other'),
    ('Alpha-Liponsäure', 'other'),
    ('Coenzym Q10', 'other'),
    ('Melatonin', 'other'),
    ('Beta-Glucane', 'other')
),
guard(ok) AS (
  SELECT 1
  WHERE (SELECT COUNT(*) FROM d1_migrations) = 77
    AND (SELECT MAX(id) FROM d1_migrations) = 77
    AND (SELECT name FROM d1_migrations WHERE id = 77) = '0090_dose_recommendations_stage4_fields.sql'
    AND NOT EXISTS (
      SELECT 1
      FROM d1_migrations AS existing
      JOIN expected_ledger AS expected
        ON existing.id = expected.id OR existing.name = expected.name
    )
    AND (
      SELECT COUNT(*)
      FROM pragma_table_info('ingredients')
      WHERE name = 'is_active'
        AND upper(type) = 'INTEGER'
        AND "notnull" = 1
        AND replace(COALESCE(dflt_value, ''), '''', '') = '1'
        AND pk = 0
    ) = 1
    AND (SELECT COUNT(*) FROM ingredients) = 94
    AND (SELECT COUNT(*) FROM ingredients WHERE is_active = 1) = 89
    AND (SELECT COUNT(*) FROM ingredients WHERE is_active = 0) = 5
    AND NOT EXISTS (SELECT 1 FROM ingredients WHERE is_active NOT IN (0, 1) OR is_active IS NULL)
    AND (
      SELECT group_concat(id, ',')
      FROM (SELECT id FROM ingredients WHERE is_active = 0 ORDER BY id)
    ) = '8,43,44,49,63'
    AND (SELECT COUNT(*) FROM expected_catalog) = 88
    AND NOT EXISTS (
      SELECT 1
      FROM expected_catalog AS expected
      LEFT JOIN ingredients AS i
        ON lower(trim(i.name)) = lower(trim(expected.name))
      WHERE i.id IS NULL
        OR i.name <> expected.name
        OR i.category <> expected.category
        OR i.is_active <> 1
        OR NULLIF(trim(i.unit), '') IS NULL
        OR NULLIF(trim(i.preferred_unit), '') IS NULL
    )
    AND NOT EXISTS (
      SELECT 1
      FROM ingredients
      GROUP BY lower(trim(name))
      HAVING COUNT(*) > 1
    )
    AND EXISTS (
      SELECT 1
      FROM ingredients
      WHERE id = 23
        AND name = 'Zeolith'
        AND category = 'other'
        AND unit = 'g'
        AND preferred_unit = 'g'
        AND is_active = 1
        AND version = 2
    )
)
INSERT INTO d1_migrations (id, name)
SELECT expected.id, expected.name
FROM expected_ledger AS expected
CROSS JOIN guard;
