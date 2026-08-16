PRAGMA foreign_keys = ON;

-- Every product card resolves its short effect text through the linked
-- ingredient display profile. Keep that text in one central place and never
-- duplicate it on individual catalog or user products.
--
-- The labels below are compacted exclusively from the descriptions already
-- present in the ingredient catalog and knowledge overview. Existing non-empty
-- profile text remains authoritative and is never overwritten.
CREATE TABLE _0100_expected_ingredient_effects (
  ingredient_name TEXT PRIMARY KEY,
  effect_summary TEXT NOT NULL CHECK (trim(effect_summary) <> '')
);

INSERT INTO _0100_expected_ingredient_effects (ingredient_name, effect_summary)
VALUES
  ('Vitamin D3', 'Knochen, Calciumstoffwechsel, Muskelfunktion'),
  ('Vitamin K2', 'Knochen, Gefäße, Gla-Proteine'),
  ('Magnesium', 'Muskel- & Nervenfunktion, Entspannung'),
  ('Ginseng', 'Energie, Stressresistenz, Immunsystem'),
  ('Vitamin C', 'Immunsystem, Zellschutz, Kollagenbildung'),
  ('Schwarzkümmelöl', 'Immunsystem, Atemwege, Haut'),
  ('Grapefruitkernextrakt', 'Darmflora, Verdauung, Mikrobiom'),
  ('B-Vitamin-Komplex', 'Energie, Nervensystem, Stoffwechsel'),
  ('Kalium', 'Elektrolyte, Herz, Muskelfunktion'),
  ('Omega-3', 'Herz, Gehirn, Zellfunktion'),
  ('Zink', 'Immunsystem, Haut, Zellschutz'),
  ('Kreatin', 'Kraft, Leistung, Regeneration'),
  ('L-Carnitin', 'Energiestoffwechsel, Ausdauer, Fokus'),
  ('Vitamin B12', 'Blutbildung, Nervensystem, Energiestoffwechsel'),
  ('Coenzym Q10', 'Mitochondrien, Energieerzeugung'),
  ('Selen', 'Zellschutz, Schilddrüsenfunktion, Immunsystem'),
  ('Kollagen', 'Haut, Bindegewebe, Gelenke'),
  ('OPC', 'Polyphenole, Traubenkernextrakt'),
  ('Jod', 'Schilddrüsenfunktion, Energiestoffwechsel, Nervensystem'),
  ('MSM', 'Schwefelverbindung, Gelenkkontext'),
  ('Spirulina', 'Mikroalge, Nährstoffkontext, Pflanzenfarbstoffe'),
  ('Chlorella', 'Mikroalge, Mikronährstoffkontext'),
  ('Zeolith', 'Bindung im Verdauungstrakt'),
  ('Ashwagandha', 'Stresskontext, Schlafkontext'),
  ('Rhodiola Rosea', 'Stresskontext, Ermüdungskontext'),
  ('Maca', 'Energiebezug, traditionelle Nutzung'),
  ('Berberin', 'Glukosestoffwechsel, Fettstoffwechsel'),
  ('Resveratrol', 'Polyphenole, Zellstoffwechsel'),
  ('Curcumin', 'Pflanzenextrakt, antioxidativer Forschungskontext'),
  ('Alpha-Liponsäure', 'Zellschutz, Energiestoffwechsel'),
  ('Melatonin', 'Schlaf-Wach-Rhythmus'),
  ('Vitamin A', 'Augen, Haut, Schleimhäute'),
  ('Vitamin K1', 'Blutgerinnung, Gerinnungsfaktoren, Leberstoffwechsel'),
  ('Vitamin E', 'Zellschutz'),
  ('Vitamin B1', 'Energiestoffwechsel, Nervensystem'),
  ('Vitamin B2', 'Energiestoffwechsel, Zellschutz, Haut'),
  ('Vitamin B3', 'Energiestoffwechsel, Nervensystem, Haut'),
  ('Vitamin B5', 'Energiestoffwechsel, geistige Leistung'),
  ('Vitamin B6', 'Eiweißstoffwechsel, Nervensystem, Immunsystem'),
  ('Vitamin B7', 'Energiestoffwechsel, Haut, Haare'),
  ('Vitamin B9', 'Zellteilung, Blutbildung, Schwangerschaft'),
  ('Calcium', 'Knochen, Zähne, Muskelfunktion'),
  ('Natrium', 'Flüssigkeitshaushalt, Nervenfunktion, Muskelfunktion'),
  ('Phosphor', 'Knochen, Zähne, Energiestoffwechsel'),
  ('Eisen', 'Sauerstofftransport, Blutbildung, Energiestoffwechsel'),
  ('Kupfer', 'Eisenstoffwechsel, Bindegewebe, Zellschutz'),
  ('Mangan', 'Energiestoffwechsel, Bindegewebe, Zellschutz'),
  ('Chrom', 'Makronährstoff-Stoffwechsel'),
  ('Molybdän', 'Enzymfunktion, Schwefelstoffwechsel'),
  ('L-Glutamin', 'Darmkontext, Belastungskontext, Aminosäurenversorgung'),
  ('L-Arginin', 'Stickstoffmonoxid-Stoffwechsel, Gefäßkontext'),
  ('L-Citrullin', 'Harnstoffzyklus, Stickstoffmonoxid-Stoffwechsel, Trainingskontext'),
  ('L-Tryptophan', 'Serotoninstoffwechsel, Schlafkontext'),
  ('L-Tyrosin', 'Botenstoff-Vorstufe, Stresskontext, Kognition'),
  ('L-Theanin', 'Fokus, Ausgeglichenheit'),
  ('Taurin', 'Flüssigkeitshaushalt, Herz-Kreislauf-Kontext, Sportkontext'),
  ('Glycin', 'Kollagenbaustein, Schlafkontext, Regeneration'),
  ('BCAA', 'Aminosäurenversorgung, Trainingskontext'),
  ('Beta-Alanin', 'Carnosinbildung, hochintensives Training'),
  ('ALA', 'Pflanzliches Omega-3, EPA-/DHA-Umwandlung'),
  ('Vitamin D', 'Knochen, Calciumstoffwechsel, Muskelfunktion'),
  ('Vitamin K', 'Blutgerinnung, Knochenstoffwechsel'),
  ('Cholin', 'Leberstoffwechsel, Fettstoffwechsel'),
  ('Inositol', 'Zellstoffwechsel, Stresskontext'),
  ('Elektrolyte', 'Wasserhaushalt, Ionenhaushalt, Muskelfunktion'),
  ('Glutathion', 'Antioxidativer Schutz, Zellschutz'),
  ('5-HTP', 'Serotoninstoffwechsel, Aminosäure-Kontext'),
  ('GABA', 'Nervensystem, Entspannungskontext'),
  ('MCT-Öl', 'Schnelle Energie, Fettstoffwechsel'),
  ('Krillöl', 'Omega-3-Versorgung, Zellmembranen'),
  ('Baldrian', 'Abendroutine, Entspannungskontext'),
  ('Boswellia (Weihrauch)', 'Traditionelle Anwendung, Pflanzenextrakt'),
  ('Brennnessel', 'Traditionelle Nutzung, Alltagskontext'),
  ('Ginkgo', 'Durchblutungskontext, traditionelle Nutzung'),
  ('Grüner Tee (EGCG)', 'Polyphenole, Pflanzenextrakt'),
  ('Mariendistel (Silymarin)', 'Leberkontext, traditionelle Nutzung'),
  ('Mönchspfeffer', 'Hormonkontext, Pflanzenextrakt'),
  ('Pfefferminz', 'Traditionelle Anwendung, Pflanzenbestandteil'),
  ('Quercetin', 'Entzündungsforschung, Reizschutz'),
  ('Sägepalme', 'Prostatakontext, Harnwegskontext'),
  ('Reishi', 'Stresskontext, Immunforschung'),
  ('Cordyceps', 'Ausdauerkontext, Energiebezug'),
  ('Löwenmähne (Hericium)', 'Nervenkontext, Pilzforschung'),
  ('Chaga', 'Antioxidativer Forschungskontext'),
  ('Maitake', 'Immunforschung'),
  ('Shiitake', 'Speisepilz, Ergänzungskontext'),
  ('Birkenporling', 'Traditionelle Nutzung, Pilzkontext'),
  ('Zunderschwamm', 'Traditionelle Nutzung, Pilzkontext'),
  ('Bromelain', 'Eiweißspaltung, Verdauungsprozesse'),
  ('Papain', 'Eiweißspaltung, Verdauungsprozesse'),
  ('Laktase', 'Laktoseverdauung'),
  ('Probiotika', 'Lebende Kulturen, Darmbereich'),
  ('Saccharomyces boulardii', 'Probiotischer Hefestamm, Darmbereich'),
  ('Glucosamin', 'Gelenkkontext, Knorpelkontext'),
  ('Chondroitin', 'Gelenkkontext, Knorpelkontext'),
  ('Hyaluronsäure', 'Bindegewebe, Feuchtigkeit'),
  ('Beta-Glucane', 'Immunforschung, Polysaccharide');

CREATE TABLE _0100_ingredient_effect_guard (
  scope TEXT NOT NULL
);

CREATE TRIGGER _0100_ingredient_effect_guard_abort
BEFORE INSERT ON _0100_ingredient_effect_guard
BEGIN
  SELECT RAISE(ABORT, '0100: Unerwarteter Wirkstoffbestand; keine Wirkungsprofile geschrieben.');
END;

-- Bind the exact live catalog identity before any persistent profile write.
-- Production and the historical snapshot used different IDs for Vitamin D/K,
-- so names plus active/reference state are the stable identity. Every active
-- row and every ingredient still referenced by a catalog or user product must
-- be represented in the expected set.
INSERT INTO _0100_ingredient_effect_guard (scope)
SELECT 'precondition'
WHERE (SELECT COUNT(*) FROM _0100_expected_ingredient_effects) <> 97
   OR (SELECT COUNT(*) FROM ingredients WHERE is_active = 1) <> 92
   OR EXISTS (
     SELECT 1
     FROM ingredients ingredient
     LEFT JOIN _0100_expected_ingredient_effects expected ON expected.ingredient_name = ingredient.name
     WHERE ingredient.is_active = 1
       AND expected.ingredient_name IS NULL
   )
   OR EXISTS (
     SELECT 1
     FROM product_ingredients product_ingredient
     JOIN ingredients ingredient ON ingredient.id = product_ingredient.ingredient_id
     LEFT JOIN _0100_expected_ingredient_effects expected ON expected.ingredient_name = ingredient.name
     WHERE expected.ingredient_name IS NULL
   )
   OR EXISTS (
     SELECT 1
     FROM user_product_ingredients product_ingredient
     JOIN ingredients ingredient ON ingredient.id = product_ingredient.ingredient_id
     LEFT JOIN _0100_expected_ingredient_effects expected ON expected.ingredient_name = ingredient.name
     WHERE expected.ingredient_name IS NULL
   )
   OR EXISTS (
     SELECT ingredient_id
     FROM ingredient_display_profiles
     WHERE form_id IS NULL AND part_id IS NULL AND sub_ingredient_id IS NULL
     GROUP BY ingredient_id
     HAVING COUNT(*) > 1
   );

INSERT INTO ingredient_display_profiles (
  ingredient_id,
  form_id,
  part_id,
  sub_ingredient_id,
  effect_summary,
  timing,
  timing_note,
  intake_hint,
  card_note,
  created_at,
  updated_at,
  version
)
SELECT
  ingredient.id,
  NULL,
  NULL,
  NULL,
  expected.effect_summary,
  NULL,
  NULL,
  NULL,
  NULL,
  datetime('now'),
  datetime('now'),
  1
FROM _0100_expected_ingredient_effects expected
JOIN ingredients ingredient ON ingredient.name = expected.ingredient_name
WHERE 1 = 1
ON CONFLICT DO UPDATE SET
  effect_summary = excluded.effect_summary,
  updated_at = datetime('now'),
  version = COALESCE(ingredient_display_profiles.version, 0) + 1
WHERE trim(COALESCE(ingredient_display_profiles.effect_summary, '')) = '';

-- Keep the already established language projection complete as well. Runtime
-- and admin continue to have one profile-level maintenance surface; no product
-- row receives a copied effect text.
INSERT INTO display_profile_translations (
  display_profile_id,
  language,
  effect_summary,
  timing,
  timing_note,
  intake_hint,
  card_note,
  created_at,
  updated_at
)
SELECT
  profile.id,
  'de',
  profile.effect_summary,
  profile.timing,
  profile.timing_note,
  profile.intake_hint,
  profile.card_note,
  profile.created_at,
  profile.updated_at
FROM ingredient_display_profiles profile
JOIN ingredients ingredient ON ingredient.id = profile.ingredient_id
JOIN _0100_expected_ingredient_effects expected ON expected.ingredient_name = ingredient.name
WHERE profile.form_id IS NULL
  AND profile.part_id IS NULL
  AND profile.sub_ingredient_id IS NULL
  AND trim(COALESCE(profile.effect_summary, '')) <> ''
ON CONFLICT(display_profile_id, language) DO UPDATE SET
  effect_summary = excluded.effect_summary,
  updated_at = datetime('now')
WHERE trim(COALESCE(display_profile_translations.effect_summary, '')) = '';

WITH target_ingredients AS (
  SELECT id AS ingredient_id FROM ingredients WHERE is_active = 1
  UNION
  SELECT ingredient_id FROM product_ingredients
  UNION
  SELECT ingredient_id FROM user_product_ingredients
)
INSERT INTO _0100_ingredient_effect_guard (scope)
SELECT 'postcondition'
WHERE EXISTS (
  SELECT 1
  FROM target_ingredients target
  LEFT JOIN ingredient_display_profiles profile
    ON profile.ingredient_id = target.ingredient_id
   AND profile.form_id IS NULL
   AND profile.part_id IS NULL
   AND profile.sub_ingredient_id IS NULL
  LEFT JOIN display_profile_translations translation
    ON translation.display_profile_id = profile.id
   AND translation.language = 'de'
  WHERE trim(COALESCE(profile.effect_summary, '')) = ''
     OR trim(COALESCE(translation.effect_summary, '')) = ''
);

DROP TRIGGER _0100_ingredient_effect_guard_abort;
DROP TABLE _0100_ingredient_effect_guard;
DROP TABLE _0100_expected_ingredient_effects;
