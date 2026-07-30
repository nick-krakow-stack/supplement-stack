PRAGMA foreign_keys = ON;

-- Canonical ingredient catalog for planned active set.
-- Migration scope:
-- 1) Reset all existing ingredients to inactive.
-- 2) Normalize a small set of known duplicate canonical names.
-- 3) Upsert canonical ingredient list with explicit category + unit defaults.
-- 4) Add important alias synonyms.
--
-- NOTE: The owner text says "86", but the explicit supplied list contains
-- 88 names. The explicit list wins, because no listed ingredient should be
-- silently removed.

UPDATE ingredients
SET name = 'Kreatin'
WHERE lower(trim(name)) = 'creatin';

UPDATE ingredients
SET name = 'Rhodiola Rosea'
WHERE name = 'Rhodiola rosea';

UPDATE ingredients
SET is_active = 0;

INSERT INTO ingredients (name, category, unit, preferred_unit, is_active)
VALUES
    ('Vitamin A', 'vitamin', 'µg', 'µg', 1),
    ('Vitamin B1', 'vitamin', 'mg', 'mg', 1),
    ('Vitamin B2', 'vitamin', 'mg', 'mg', 1),
    ('Vitamin B3', 'vitamin', 'mg', 'mg', 1),
    ('Vitamin B5', 'vitamin', 'mg', 'mg', 1),
    ('Vitamin B6', 'vitamin', 'mg', 'mg', 1),
    ('Vitamin B7', 'vitamin', 'µg', 'µg', 1),
    ('Vitamin B9', 'vitamin', 'µg', 'µg', 1),
    ('Vitamin B12', 'vitamin', 'µg', 'µg', 1),
    ('Vitamin C', 'vitamin', 'mg', 'mg', 1),
    ('Vitamin D', 'vitamin', 'µg', 'µg', 1),
    ('Vitamin E', 'vitamin', 'mg', 'mg', 1),
    ('Vitamin K', 'vitamin', 'µg', 'µg', 1),
    ('Cholin', 'vitamin', 'mg', 'mg', 1),
    ('Inositol', 'vitamin', 'g', 'g', 1),
    ('Calcium', 'mineral', 'mg', 'mg', 1),
    ('Kalium', 'mineral', 'mg', 'mg', 1),
    ('Magnesium', 'mineral', 'mg', 'mg', 1),
    ('Elektrolyte', 'mineral', 'mg', 'mg', 1),
    ('Chrom', 'trace_element', 'µg', 'µg', 1),
    ('Eisen', 'trace_element', 'mg', 'mg', 1),
    ('Jod', 'trace_element', 'µg', 'µg', 1),
    ('Kupfer', 'trace_element', 'mg', 'mg', 1),
    ('Mangan', 'trace_element', 'mg', 'mg', 1),
    ('Selen', 'trace_element', 'µg', 'µg', 1),
    ('Zink', 'trace_element', 'mg', 'mg', 1),
    ('BCAA', 'amino_acid_protein', 'g', 'g', 1),
    ('Beta-Alanin', 'amino_acid_protein', 'g', 'g', 1),
    ('Glycin', 'amino_acid_protein', 'g', 'g', 1),
    ('Glutathion', 'amino_acid_protein', 'mg', 'mg', 1),
    ('Kollagen', 'amino_acid_protein', 'g', 'g', 1),
    ('Kreatin', 'amino_acid_protein', 'g', 'g', 1),
    ('L-Arginin', 'amino_acid_protein', 'g', 'g', 1),
    ('L-Carnitin', 'amino_acid_protein', 'g', 'g', 1),
    ('L-Citrullin', 'amino_acid_protein', 'g', 'g', 1),
    ('L-Glutamin', 'amino_acid_protein', 'g', 'g', 1),
    ('L-Theanin', 'amino_acid_protein', 'mg', 'mg', 1),
    ('L-Tryptophan', 'amino_acid_protein', 'mg', 'mg', 1),
    ('L-Tyrosin', 'amino_acid_protein', 'mg', 'mg', 1),
    ('Taurin', 'amino_acid_protein', 'g', 'g', 1),
    ('5-HTP', 'amino_acid_protein', 'mg', 'mg', 1),
    ('GABA', 'amino_acid_protein', 'mg', 'mg', 1),
    ('Omega-3', 'fatty_acid', 'g', 'g', 1),
    ('MCT-Öl', 'fatty_acid', 'g', 'g', 1),
    ('Krillöl', 'fatty_acid', 'g', 'g', 1),
    ('Ashwagandha', 'plant_extract', 'mg', 'mg', 1),
    ('Baldrian', 'plant_extract', 'mg', 'mg', 1),
    ('Berberin', 'plant_extract', 'mg', 'mg', 1),
    ('Boswellia (Weihrauch)', 'plant_extract', 'mg', 'mg', 1),
    ('Brennnessel', 'plant_extract', 'mg', 'mg', 1),
    ('Chlorella', 'plant_extract', 'mg', 'mg', 1),
    ('Curcumin', 'plant_extract', 'mg', 'mg', 1),
    ('Ginkgo', 'plant_extract', 'mg', 'mg', 1),
    ('Ginseng', 'plant_extract', 'mg', 'mg', 1),
    ('Grapefruitkernextrakt', 'plant_extract', 'mg', 'mg', 1),
    ('Grüner Tee (EGCG)', 'plant_extract', 'mg', 'mg', 1),
    ('Maca', 'plant_extract', 'mg', 'mg', 1),
    ('Mariendistel (Silymarin)', 'plant_extract', 'mg', 'mg', 1),
    ('Mönchspfeffer', 'plant_extract', 'mg', 'mg', 1),
    ('OPC', 'plant_extract', 'mg', 'mg', 1),
    ('Pfefferminz', 'plant_extract', 'mg', 'mg', 1),
    ('Quercetin', 'plant_extract', 'mg', 'mg', 1),
    ('Resveratrol', 'plant_extract', 'mg', 'mg', 1),
    ('Rhodiola Rosea', 'plant_extract', 'mg', 'mg', 1),
    ('Sägepalme', 'plant_extract', 'mg', 'mg', 1),
    ('Schwarzkümmelöl', 'plant_extract', 'g', 'g', 1),
    ('Spirulina', 'plant_extract', 'mg', 'mg', 1),
    ('Reishi', 'medicinal_mushroom', 'mg', 'mg', 1),
    ('Cordyceps', 'medicinal_mushroom', 'mg', 'mg', 1),
    ('Löwenmähne (Hericium)', 'medicinal_mushroom', 'mg', 'mg', 1),
    ('Chaga', 'medicinal_mushroom', 'mg', 'mg', 1),
    ('Maitake', 'medicinal_mushroom', 'mg', 'mg', 1),
    ('Shiitake', 'medicinal_mushroom', 'mg', 'mg', 1),
    ('Birkenporling', 'medicinal_mushroom', 'mg', 'mg', 1),
    ('Zunderschwamm', 'medicinal_mushroom', 'mg', 'mg', 1),
    ('Bromelain', 'enzyme', 'mg', 'mg', 1),
    ('Papain', 'enzyme', 'mg', 'mg', 1),
    ('Laktase', 'enzyme', 'mg', 'mg', 1),
    ('Probiotika', 'probiotic', 'mg', 'mg', 1),
    ('Saccharomyces boulardii', 'probiotic', 'mg', 'mg', 1),
    ('Glucosamin', 'other', 'g', 'g', 1),
    ('Chondroitin', 'other', 'g', 'g', 1),
    ('Hyaluronsäure', 'other', 'mg', 'mg', 1),
    ('MSM', 'other', 'g', 'g', 1),
    ('Alpha-Liponsäure', 'other', 'mg', 'mg', 1),
    ('Coenzym Q10', 'other', 'mg', 'mg', 1),
    ('Melatonin', 'other', 'mg', 'mg', 1),
    ('Beta-Glucane', 'other', 'g', 'g', 1)
ON CONFLICT(name) DO UPDATE
SET
  category = excluded.category,
  is_active = 1,
  unit = CASE
    WHEN NULLIF(TRIM(ingredients.unit), '') IS NULL THEN excluded.unit
    ELSE ingredients.unit
  END,
  preferred_unit = CASE
    WHEN NULLIF(TRIM(ingredients.preferred_unit), '') IS NULL THEN excluded.unit
    ELSE ingredients.preferred_unit
  END,
  version = COALESCE(ingredients.version, 0) + 1
;

-- Optional alias enrichment for important legacy naming variants.
INSERT OR IGNORE INTO ingredient_synonyms (ingredient_id, synonym, language)
SELECT i.id, 'Creatin', 'de'
FROM ingredients AS i
WHERE lower(trim(i.name)) = lower(trim('Kreatin'))
  AND NOT EXISTS (
    SELECT 1
    FROM ingredient_synonyms AS x
    WHERE x.ingredient_id = i.id
      AND lower(trim(x.synonym)) = lower(trim('Creatin'))
      AND x.language = 'de'
  );

INSERT OR IGNORE INTO ingredient_synonyms (ingredient_id, synonym, language)
SELECT i.id, 'Iod', 'de'
FROM ingredients AS i
WHERE lower(trim(i.name)) = lower(trim('Jod'))
  AND NOT EXISTS (
    SELECT 1
    FROM ingredient_synonyms AS x
    WHERE x.ingredient_id = i.id
      AND lower(trim(x.synonym)) = lower(trim('Iod'))
      AND x.language = 'de'
  );

INSERT OR IGNORE INTO ingredient_synonyms (ingredient_id, synonym, language)
SELECT i.id, 'Boswellia', 'de'
FROM ingredients AS i
WHERE lower(trim(i.name)) = lower(trim('Boswellia (Weihrauch)'))
  AND NOT EXISTS (
    SELECT 1
    FROM ingredient_synonyms AS x
    WHERE x.ingredient_id = i.id
      AND lower(trim(x.synonym)) = lower(trim('Boswellia'))
      AND x.language = 'de'
  );

INSERT OR IGNORE INTO ingredient_synonyms (ingredient_id, synonym, language)
SELECT i.id, 'Weihrauch', 'de'
FROM ingredients AS i
WHERE lower(trim(i.name)) = lower(trim('Boswellia (Weihrauch)'))
  AND NOT EXISTS (
    SELECT 1
    FROM ingredient_synonyms AS x
    WHERE x.ingredient_id = i.id
      AND lower(trim(x.synonym)) = lower(trim('Weihrauch'))
      AND x.language = 'de'
  );

INSERT OR IGNORE INTO ingredient_synonyms (ingredient_id, synonym, language)
SELECT i.id, 'L?wenm?hne', 'de'
FROM ingredients AS i
WHERE lower(trim(i.name)) = lower(trim('L?wenm?hne (Hericium)'))
  AND NOT EXISTS (
    SELECT 1
    FROM ingredient_synonyms AS x
    WHERE x.ingredient_id = i.id
      AND lower(trim(x.synonym)) = lower(trim('L?wenm?hne'))
      AND x.language = 'de'
  );

INSERT OR IGNORE INTO ingredient_synonyms (ingredient_id, synonym, language)
SELECT i.id, 'Hericium', 'de'
FROM ingredients AS i
WHERE lower(trim(i.name)) = lower(trim('L?wenm?hne (Hericium)'))
  AND NOT EXISTS (
    SELECT 1
    FROM ingredient_synonyms AS x
    WHERE x.ingredient_id = i.id
      AND lower(trim(x.synonym)) = lower(trim('Hericium'))
      AND x.language = 'de'
  );

INSERT OR IGNORE INTO ingredient_synonyms (ingredient_id, synonym, language)
SELECT i.id, 'Gr?ner Tee', 'de'
FROM ingredients AS i
WHERE lower(trim(i.name)) = lower(trim('Gr?ner Tee (EGCG)'))
  AND NOT EXISTS (
    SELECT 1
    FROM ingredient_synonyms AS x
    WHERE x.ingredient_id = i.id
      AND lower(trim(x.synonym)) = lower(trim('Gr?ner Tee'))
      AND x.language = 'de'
  );

INSERT OR IGNORE INTO ingredient_synonyms (ingredient_id, synonym, language)
SELECT i.id, 'EGCG', 'de'
FROM ingredients AS i
WHERE lower(trim(i.name)) = lower(trim('Gr?ner Tee (EGCG)'))
  AND NOT EXISTS (
    SELECT 1
    FROM ingredient_synonyms AS x
    WHERE x.ingredient_id = i.id
      AND lower(trim(x.synonym)) = lower(trim('EGCG'))
      AND x.language = 'de'
  );

INSERT OR IGNORE INTO ingredient_synonyms (ingredient_id, synonym, language)
SELECT i.id, 'Mariendistel', 'de'
FROM ingredients AS i
WHERE lower(trim(i.name)) = lower(trim('Mariendistel (Silymarin)'))
  AND NOT EXISTS (
    SELECT 1
    FROM ingredient_synonyms AS x
    WHERE x.ingredient_id = i.id
      AND lower(trim(x.synonym)) = lower(trim('Mariendistel'))
      AND x.language = 'de'
  );

INSERT OR IGNORE INTO ingredient_synonyms (ingredient_id, synonym, language)
SELECT i.id, 'Silymarin', 'de'
FROM ingredients AS i
WHERE lower(trim(i.name)) = lower(trim('Mariendistel (Silymarin)'))
  AND NOT EXISTS (
    SELECT 1
    FROM ingredient_synonyms AS x
    WHERE x.ingredient_id = i.id
      AND lower(trim(x.synonym)) = lower(trim('Silymarin'))
      AND x.language = 'de'
  );

INSERT OR IGNORE INTO ingredient_synonyms (ingredient_id, synonym, language)
SELECT i.id, 'Rhodiola rosea', 'de'
FROM ingredients AS i
WHERE lower(trim(i.name)) = lower(trim('Rhodiola Rosea'))
  AND NOT EXISTS (
    SELECT 1
    FROM ingredient_synonyms AS x
    WHERE x.ingredient_id = i.id
      AND lower(trim(x.synonym)) = lower(trim('Rhodiola rosea'))
      AND x.language = 'de'
  );

INSERT OR IGNORE INTO ingredient_synonyms (ingredient_id, synonym, language)
SELECT i.id, 'MCT Oel', 'de'
FROM ingredients AS i
WHERE lower(trim(i.name)) = lower(trim('MCT-?l'))
  AND NOT EXISTS (
    SELECT 1
    FROM ingredient_synonyms AS x
    WHERE x.ingredient_id = i.id
      AND lower(trim(x.synonym)) = lower(trim('MCT Oel'))
      AND x.language = 'de'
  );

INSERT OR IGNORE INTO ingredient_synonyms (ingredient_id, synonym, language)
SELECT i.id, '5 HTP', 'de'
FROM ingredients AS i
WHERE lower(trim(i.name)) = lower(trim('5-HTP'))
  AND NOT EXISTS (
    SELECT 1
    FROM ingredient_synonyms AS x
    WHERE x.ingredient_id = i.id
      AND lower(trim(x.synonym)) = lower(trim('5 HTP'))
      AND x.language = 'de'
  );
