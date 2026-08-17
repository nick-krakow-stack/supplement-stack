PRAGMA foreign_keys = ON;

-- 0100 established one central effect-summary profile for every active
-- ingredient and the five retained legacy ingredients. This additive repair
-- keeps that single source of truth, but replaces jargon and broad benefit
-- claims with plain, neutral German. Where the existing evidence is not
-- specific enough for a useful short text, NULL deliberately lets the UI show
-- its neutral "Kurztext wird geprüft" fallback.
CREATE TABLE _0109_expected_effect_summaries (
  ingredient_name TEXT PRIMARY KEY,
  expected_is_active INTEGER NOT NULL CHECK (expected_is_active IN (0, 1)),
  old_effect_summary TEXT NOT NULL CHECK (trim(old_effect_summary) <> ''),
  new_effect_summary TEXT CHECK (new_effect_summary IS NULL OR trim(new_effect_summary) <> '')
);

INSERT INTO _0109_expected_effect_summaries (
  ingredient_name,
  expected_is_active,
  old_effect_summary,
  new_effect_summary
)
VALUES
  -- 0100 intentionally preserved the non-empty D3 profile seeded by 0050.
  -- Bind that runtime value instead of the unused 0100 fallback value.
  ('Vitamin D3', 0, 'Immunsystem, Knochen, Hormone', 'Vitamin D ist am Calciumstoffwechsel sowie an der Funktion von Knochen und Muskeln beteiligt.'),
  ('Vitamin K2', 0, 'Knochen, Gefäße, Gla-Proteine', 'Vitamin K2 ist eine Form von Vitamin K und steht mit bestimmten körpereigenen Proteinen in Zusammenhang.'),
  ('Magnesium', 1, 'Muskel- & Nervenfunktion, Entspannung', 'Mineralstoff für die normale Funktion von Muskeln und Nerven.'),
  ('Ginseng', 1, 'Energie, Stressresistenz, Immunsystem', 'Quellen beschreiben Ginseng im Zusammenhang mit Energie und Stress.'),
  ('Vitamin C', 1, 'Immunsystem, Zellschutz, Kollagenbildung', 'Vitamin C trägt zu einer normalen Funktion des Immunsystems und zur normalen Kollagenbildung sowie zum Schutz der Zellen vor oxidativem Stress bei.'),
  ('Schwarzkümmelöl', 1, 'Immunsystem, Atemwege, Haut', 'Schwarzkümmelöl enthält Thymochinon. Zusammenhänge mit oxidativem Stress und Entzündungsprozessen werden untersucht.'),
  ('Grapefruitkernextrakt', 1, 'Darmflora, Verdauung, Mikrobiom', 'Grapefruitkernextrakt wird traditionell verwendet. Seine Wirksamkeit ist wissenschaftlich umstritten.'),
  ('B-Vitamin-Komplex', 0, 'Energie, Nervensystem, Stoffwechsel', 'Gruppe von B-Vitaminen mit Aufgaben im Energie- und Nervenstoffwechsel.'),
  ('Kalium', 1, 'Elektrolyte, Herz, Muskelfunktion', 'Elektrolyt für den Flüssigkeitshaushalt sowie die Funktion von Nerven und Muskeln.'),
  ('Omega-3', 1, 'Herz, Gehirn, Zellfunktion', 'Fettsäuren mit Aufgaben im Fettstoffwechsel und in Zellmembranen.'),
  ('Zink', 1, 'Immunsystem, Haut, Zellschutz', 'Zink trägt zu einer normalen Funktion des Immunsystems und zum Erhalt normaler Haut sowie zum Schutz der Zellen vor oxidativem Stress bei.'),
  ('Kreatin', 1, 'Kraft, Leistung, Regeneration', 'Körpereigener Stoff im Energiesystem von Muskeln und Gehirn.'),
  ('L-Carnitin', 1, 'Energiestoffwechsel, Ausdauer, Fokus', 'Stoff für den Transport von Fettsäuren zur Energiegewinnung in den Zellen.'),
  ('Vitamin B12', 1, 'Blutbildung, Nervensystem, Energiestoffwechsel', 'Vitamin für Blutbildung und Nervensystem sowie den Energiestoffwechsel.'),
  ('Coenzym Q10', 1, 'Mitochondrien, Energieerzeugung', 'Körpereigener Stoff mit einer Rolle bei der Energiegewinnung in Zellen.'),
  ('Selen', 1, 'Zellschutz, Schilddrüsenfunktion, Immunsystem', 'Selen trägt zu einer normalen Schilddrüsen- und Immunfunktion sowie zum Schutz der Zellen vor oxidativem Stress bei.'),
  ('Kollagen', 1, 'Haut, Bindegewebe, Gelenke', 'Kollagen ist ein Strukturprotein des Bindegewebes.'),
  ('OPC', 1, 'Polyphenole, Traubenkernextrakt', 'Pflanzenstoffe aus Traubenkernen.'),
  ('Jod', 1, 'Schilddrüsenfunktion, Energiestoffwechsel, Nervensystem', 'Spurenelement für Schilddrüse und Energiestoffwechsel sowie das Nervensystem.'),
  ('MSM', 1, 'Schwefelverbindung, Gelenkkontext', 'MSM ist eine organische Schwefelverbindung. Quellen beschreiben Zusammenhänge mit Bindegewebe und Gelenken.'),
  ('Spirulina', 1, 'Mikroalge, Nährstoffkontext, Pflanzenfarbstoffe', NULL),
  ('Chlorella', 1, 'Mikroalge, Mikronährstoffkontext', 'Grünalge mit verschiedenen Nährstoffen.'),
  ('Zeolith', 1, 'Bindung im Verdauungstrakt', 'Bei Zeolith wird eine unspezifische Bindung im Verdauungstrakt diskutiert.'),
  ('Ashwagandha', 1, 'Stresskontext, Schlafkontext', 'Studien untersuchen den Pflanzenextrakt Ashwagandha im Zusammenhang mit Stress und Schlaf.'),
  ('Rhodiola Rosea', 1, 'Stresskontext, Ermüdungskontext', 'Quellen beschreiben den Pflanzenextrakt Rosenwurz im Zusammenhang mit Stress und Belastung.'),
  ('Maca', 1, 'Energiebezug, traditionelle Nutzung', 'Maca wird in Quellen im Zusammenhang mit Energie untersucht.'),
  ('Berberin', 1, 'Glukosestoffwechsel, Fettstoffwechsel', 'Studien untersuchen Zusammenhänge von Berberin mit dem Zucker- und Fettstoffwechsel.'),
  ('Resveratrol', 1, 'Polyphenole, Zellstoffwechsel', 'Resveratrol ist ein Polyphenol. Zusammenhänge mit dem Zellstoffwechsel werden untersucht.'),
  ('Curcumin', 1, 'Pflanzenextrakt, antioxidativer Forschungskontext', 'Curcumin ist ein Pflanzenstoff aus Kurkuma. Zusammenhänge mit oxidativem Stress werden untersucht.'),
  ('Alpha-Liponsäure', 1, 'Zellschutz, Energiestoffwechsel', 'Alpha-Liponsäure ist am Energiestoffwechsel beteiligt. Zusammenhänge mit oxidativem Stress werden untersucht.'),
  ('Melatonin', 1, 'Schlaf-Wach-Rhythmus', 'Körpereigener Stoff im Schlaf-Wach-Rhythmus.'),
  ('Vitamin A', 1, 'Augen, Haut, Schleimhäute', 'Vitamin für Augen und Haut sowie für die Schleimhäute.'),
  ('Vitamin K1', 0, 'Blutgerinnung, Gerinnungsfaktoren, Leberstoffwechsel', 'Vitamin-K-Form mit einer Rolle bei der Blutgerinnung.'),
  ('Vitamin E', 1, 'Zellschutz', 'Vitamin E trägt zum Schutz der Zellen vor oxidativem Stress bei.'),
  ('Vitamin B1', 1, 'Energiestoffwechsel, Nervensystem', 'Vitamin für Energiegewinnung und Nervensystem.'),
  ('Vitamin B2', 1, 'Energiestoffwechsel, Zellschutz, Haut', 'Vitamin B2 trägt zu einem normalen Energiestoffwechsel sowie zum Schutz der Zellen vor oxidativem Stress bei.'),
  ('Vitamin B3', 1, 'Energiestoffwechsel, Nervensystem, Haut', 'Vitamin für Energiegewinnung und Nervensystem sowie die Haut.'),
  ('Vitamin B5', 1, 'Energiestoffwechsel, geistige Leistung', 'Vitamin für Energiegewinnung und geistige Leistung.'),
  ('Vitamin B6', 1, 'Eiweißstoffwechsel, Nervensystem, Immunsystem', 'Vitamin für Eiweißstoffwechsel und Nervensystem sowie das Immunsystem.'),
  ('Vitamin B7', 1, 'Energiestoffwechsel, Haut, Haare', 'Vitamin für Energiegewinnung und Haut sowie die Haare.'),
  ('Vitamin B9', 1, 'Zellteilung, Blutbildung, Schwangerschaft', 'Vitamin mit einer Rolle bei Zellteilung und Blutbildung.'),
  ('Calcium', 1, 'Knochen, Zähne, Muskelfunktion', 'Mineralstoff für Knochen und Zähne sowie die Muskelfunktion.'),
  ('Natrium', 1, 'Flüssigkeitshaushalt, Nervenfunktion, Muskelfunktion', 'Mineralstoff für Flüssigkeitshaushalt und die Funktion von Nerven und Muskeln.'),
  ('Phosphor', 1, 'Knochen, Zähne, Energiestoffwechsel', 'Mineralstoff für Knochen und Zähne sowie die Energiegewinnung.'),
  ('Eisen', 1, 'Sauerstofftransport, Blutbildung, Energiestoffwechsel', 'Spurenelement für Sauerstofftransport und Blutbildung sowie die Energiegewinnung.'),
  ('Kupfer', 1, 'Eisenstoffwechsel, Bindegewebe, Zellschutz', 'Kupfer trägt zu einem normalen Eisenstoffwechsel und zum Erhalt normalen Bindegewebes sowie zum Schutz der Zellen vor oxidativem Stress bei.'),
  ('Mangan', 1, 'Energiestoffwechsel, Bindegewebe, Zellschutz', 'Mangan trägt zu einem normalen Energiestoffwechsel und einer normalen Bindegewebsbildung sowie zum Schutz der Zellen vor oxidativem Stress bei.'),
  ('Chrom', 1, 'Makronährstoff-Stoffwechsel', 'Spurenelement mit einer Rolle beim Verarbeiten von Kohlenhydraten und Fett sowie Eiweiß.'),
  ('Molybdän', 1, 'Enzymfunktion, Schwefelstoffwechsel', 'Spurenelement als Bestandteil bestimmter Enzyme.'),
  ('L-Glutamin', 1, 'Darmkontext, Belastungskontext, Aminosäurenversorgung', 'L-Glutamin wird als Aminosäure im Zusammenhang mit Darm und körperlicher Belastung untersucht.'),
  ('L-Arginin', 1, 'Stickstoffmonoxid-Stoffwechsel, Gefäßkontext', 'L-Arginin ist eine Aminosäure und Vorstufe von Stickstoffmonoxid.'),
  ('L-Citrullin', 1, 'Harnstoffzyklus, Stickstoffmonoxid-Stoffwechsel, Trainingskontext', 'Der Körper kann die Aminosäure L-Citrullin in L-Arginin umwandeln.'),
  ('L-Tryptophan', 1, 'Serotoninstoffwechsel, Schlafkontext', 'L-Tryptophan wird als Aminosäure im Zusammenhang mit Serotonin und Schlaf untersucht.'),
  ('L-Tyrosin', 1, 'Botenstoff-Vorstufe, Stresskontext, Kognition', 'Aminosäure und Vorstufe verschiedener körpereigener Botenstoffe.'),
  ('L-Theanin', 1, 'Fokus, Ausgeglichenheit', 'L-Theanin wird im Zusammenhang mit Aufmerksamkeit und Ausgeglichenheit untersucht.'),
  ('Taurin', 1, 'Flüssigkeitshaushalt, Herz-Kreislauf-Kontext, Sportkontext', 'Schwefelhaltige Aminosäure in Herz und Gehirn sowie Augen und Muskeln.'),
  ('Glycin', 1, 'Kollagenbaustein, Schlafkontext, Regeneration', 'Aminosäure und Baustein von Kollagen.'),
  ('BCAA', 1, 'Aminosäurenversorgung, Trainingskontext', 'Gruppe von Aminosäuren mit Bezug zum Training.'),
  ('Beta-Alanin', 1, 'Carnosinbildung, hochintensives Training', 'Aminosäure und Vorstufe von Carnosin.'),
  ('ALA', 0, 'Pflanzliches Omega-3, EPA-/DHA-Umwandlung', 'Pflanzliche Omega-3-Fettsäure mit begrenzter Umwandlung zu EPA und DHA.'),
  ('Vitamin D', 1, 'Knochen, Calciumstoffwechsel, Muskelfunktion', 'Vitamin D ist am Calciumstoffwechsel sowie an der Funktion von Knochen und Muskeln beteiligt.'),
  ('Vitamin K', 1, 'Blutgerinnung, Knochenstoffwechsel', 'Vitamin mit einer Rolle bei Blutgerinnung und Knochenstoffwechsel.'),
  ('Cholin', 1, 'Leberstoffwechsel, Fettstoffwechsel', 'Stoff mit einer Rolle im Leber- und Fettstoffwechsel.'),
  ('Inositol', 1, 'Zellstoffwechsel, Stresskontext', 'Quellen beschreiben Inositol im Zusammenhang mit Zellstoffwechsel und Stress.'),
  ('Elektrolyte', 1, 'Wasserhaushalt, Ionenhaushalt, Muskelfunktion', 'Elektrolyte gehören zum Wasser- und Ionenhaushalt sowie zur Muskelfunktion.'),
  ('Glutathion', 1, 'Antioxidativer Schutz, Zellschutz', 'Glutathion wird im Zusammenhang mit dem antioxidativen Schutz von Zellen beschrieben.'),
  ('5-HTP', 1, 'Serotoninstoffwechsel, Aminosäure-Kontext', '5-HTP wird im Zusammenhang mit dem Serotoninstoffwechsel beschrieben.'),
  ('GABA', 1, 'Nervensystem, Entspannungskontext', 'GABA wird im Zusammenhang mit dem Nervensystem und mit Ruhe untersucht.'),
  ('MCT-Öl', 1, 'Schnelle Energie, Fettstoffwechsel', 'MCT-Öl wird im Zusammenhang mit dem Fettstoffwechsel und der Energiegewinnung beschrieben.'),
  ('Krillöl', 1, 'Omega-3-Versorgung, Zellmembranen', 'Krillöl liefert Omega-3-Fettsäuren. Diese sind Bestandteile von Zellmembranen.'),
  ('Baldrian', 1, 'Abendroutine, Entspannungskontext', 'Baldrian wird im Zusammenhang mit Ruhe am Abend untersucht.'),
  ('Boswellia (Weihrauch)', 1, 'Traditionelle Anwendung, Pflanzenextrakt', NULL),
  ('Brennnessel', 1, 'Traditionelle Nutzung, Alltagskontext', NULL),
  ('Ginkgo', 1, 'Durchblutungskontext, traditionelle Nutzung', 'Ginkgo wird im Zusammenhang mit der Durchblutung untersucht.'),
  ('Grüner Tee (EGCG)', 1, 'Polyphenole, Pflanzenextrakt', NULL),
  ('Mariendistel (Silymarin)', 1, 'Leberkontext, traditionelle Nutzung', NULL),
  ('Mönchspfeffer', 1, 'Hormonkontext, Pflanzenextrakt', NULL),
  ('Pfefferminz', 1, 'Traditionelle Anwendung, Pflanzenbestandteil', NULL),
  ('Quercetin', 1, 'Entzündungsforschung, Reizschutz', 'Quercetin wird als Pflanzenstoff in der Forschung zu Entzündungsprozessen untersucht.'),
  ('Sägepalme', 1, 'Prostatakontext, Harnwegskontext', NULL),
  ('Reishi', 1, 'Stresskontext, Immunforschung', 'Reishi wird als Pilzextrakt im Zusammenhang mit Stress und Immunsystem untersucht.'),
  ('Cordyceps', 1, 'Ausdauerkontext, Energiebezug', 'Cordyceps wird als Pilzextrakt im Zusammenhang mit Ausdauer und Energie untersucht.'),
  ('Löwenmähne (Hericium)', 1, 'Nervenkontext, Pilzforschung', 'Löwenmähne wird als Pilzextrakt im Zusammenhang mit Nerven untersucht.'),
  ('Chaga', 1, 'Antioxidativer Forschungskontext', 'Chaga wird im Zusammenhang mit oxidativem Stress untersucht.'),
  ('Maitake', 1, 'Immunforschung', 'Maitake wird als Pilzextrakt im Zusammenhang mit dem Immunsystem untersucht.'),
  ('Shiitake', 1, 'Speisepilz, Ergänzungskontext', NULL),
  ('Birkenporling', 1, 'Traditionelle Nutzung, Pilzkontext', NULL),
  ('Zunderschwamm', 1, 'Traditionelle Nutzung, Pilzkontext', NULL),
  ('Bromelain', 1, 'Eiweißspaltung, Verdauungsprozesse', 'Bromelain ist ein Enzym zur Spaltung von Eiweiß.'),
  ('Papain', 1, 'Eiweißspaltung, Verdauungsprozesse', 'Papain ist ein Enzym zur Spaltung von Eiweiß.'),
  ('Laktase', 1, 'Laktoseverdauung', 'Enzym zur Spaltung von Milchzucker.'),
  ('Probiotika', 1, 'Lebende Kulturen, Darmbereich', NULL),
  ('Saccharomyces boulardii', 1, 'Probiotischer Hefestamm, Darmbereich', NULL),
  ('Glucosamin', 1, 'Gelenkkontext, Knorpelkontext', 'Glucosamin wird im Zusammenhang mit Gelenken und Knorpel untersucht.'),
  ('Chondroitin', 1, 'Gelenkkontext, Knorpelkontext', 'Chondroitin wird im Zusammenhang mit Gelenken und Knorpel untersucht.'),
  ('Hyaluronsäure', 1, 'Bindegewebe, Feuchtigkeit', 'Stoff im Bindegewebe mit einer Rolle beim Binden von Wasser.'),
  ('Beta-Glucane', 1, 'Immunforschung, Polysaccharide', 'Beta-Glucane sind Mehrfachzucker. Zusammenhänge mit dem Immunsystem werden untersucht.');

CREATE TABLE _0109_effect_summary_guard (
  scope TEXT NOT NULL
);

CREATE TRIGGER _0109_effect_summary_guard_abort
BEFORE INSERT ON _0109_effect_summary_guard
BEGIN
  SELECT RAISE(ABORT, '0109: Unerwarteter Wirkstoff- oder Kurztextbestand; keine Kurztexte geändert.');
END;

-- Bind the complete identity and old values before either central table is
-- touched. The de translation must already exist; this migration never creates
-- a second or replacement translation source.
INSERT INTO _0109_effect_summary_guard (scope)
SELECT 'precondition'
WHERE (SELECT COUNT(*) FROM _0109_expected_effect_summaries) <> 97
   OR (SELECT COUNT(*) FROM _0109_expected_effect_summaries WHERE new_effect_summary IS NULL) <> 13
   OR (SELECT COUNT(*) FROM _0109_expected_effect_summaries WHERE new_effect_summary IS NOT NULL) <> 84
   OR (SELECT COUNT(*) FROM ingredients WHERE is_active = 1) <> 92
   OR EXISTS (
     SELECT 1
     FROM _0109_expected_effect_summaries expected
     LEFT JOIN ingredients ingredient ON ingredient.name = expected.ingredient_name
     WHERE ingredient.id IS NULL
        OR ingredient.is_active <> expected.expected_is_active
   )
   OR EXISTS (
     SELECT 1
     FROM ingredients ingredient
     WHERE ingredient.is_active = 1
       AND NOT EXISTS (
         SELECT 1
         FROM _0109_expected_effect_summaries expected
         WHERE expected.ingredient_name = ingredient.name
           AND expected.expected_is_active = 1
       )
   )
   OR (
     SELECT COUNT(*)
     FROM _0109_expected_effect_summaries expected
     JOIN ingredients ingredient ON ingredient.name = expected.ingredient_name
     JOIN ingredient_display_profiles profile
       ON profile.ingredient_id = ingredient.id
      AND profile.form_id IS NULL
      AND profile.part_id IS NULL
      AND profile.sub_ingredient_id IS NULL
   ) <> 97
   OR (
     SELECT COUNT(*)
     FROM _0109_expected_effect_summaries expected
     JOIN ingredients ingredient ON ingredient.name = expected.ingredient_name
     JOIN ingredient_display_profiles profile
       ON profile.ingredient_id = ingredient.id
      AND profile.form_id IS NULL
      AND profile.part_id IS NULL
      AND profile.sub_ingredient_id IS NULL
     JOIN display_profile_translations translation
       ON translation.display_profile_id = profile.id
      AND translation.language = 'de'
   ) <> 97
   OR EXISTS (
     SELECT 1
     FROM _0109_expected_effect_summaries expected
     JOIN ingredients ingredient ON ingredient.name = expected.ingredient_name
     LEFT JOIN ingredient_display_profiles profile
       ON profile.ingredient_id = ingredient.id
      AND profile.form_id IS NULL
      AND profile.part_id IS NULL
      AND profile.sub_ingredient_id IS NULL
     LEFT JOIN display_profile_translations translation
       ON translation.display_profile_id = profile.id
      AND translation.language = 'de'
     WHERE profile.id IS NULL
        OR profile.effect_summary IS NOT expected.old_effect_summary
        OR translation.language IS NULL
        OR translation.effect_summary IS NOT expected.old_effect_summary
   );

UPDATE ingredient_display_profiles
SET effect_summary = (
      SELECT expected.new_effect_summary
      FROM ingredients ingredient
      JOIN _0109_expected_effect_summaries expected
        ON expected.ingredient_name = ingredient.name
      WHERE ingredient.id = ingredient_display_profiles.ingredient_id
    ),
    updated_at = datetime('now'),
    version = COALESCE(version, 0) + 1
WHERE form_id IS NULL
  AND part_id IS NULL
  AND sub_ingredient_id IS NULL
  AND EXISTS (
    SELECT 1
    FROM ingredients ingredient
    JOIN _0109_expected_effect_summaries expected
      ON expected.ingredient_name = ingredient.name
    WHERE ingredient.id = ingredient_display_profiles.ingredient_id
      AND ingredient_display_profiles.effect_summary IS expected.old_effect_summary
  );

INSERT INTO _0109_effect_summary_guard (scope)
SELECT 'base-update-count'
WHERE changes() <> 97;

UPDATE display_profile_translations
SET effect_summary = (
      SELECT expected.new_effect_summary
      FROM ingredient_display_profiles profile
      JOIN ingredients ingredient ON ingredient.id = profile.ingredient_id
      JOIN _0109_expected_effect_summaries expected
        ON expected.ingredient_name = ingredient.name
      WHERE profile.id = display_profile_translations.display_profile_id
    ),
    updated_at = datetime('now')
WHERE language = 'de'
  AND EXISTS (
    SELECT 1
    FROM ingredient_display_profiles profile
    JOIN ingredients ingredient ON ingredient.id = profile.ingredient_id
    JOIN _0109_expected_effect_summaries expected
      ON expected.ingredient_name = ingredient.name
    WHERE profile.id = display_profile_translations.display_profile_id
      AND display_profile_translations.effect_summary IS expected.old_effect_summary
  );

INSERT INTO _0109_effect_summary_guard (scope)
SELECT 'translation-update-count'
WHERE changes() <> 97;

INSERT INTO _0109_effect_summary_guard (scope)
SELECT 'postcondition'
WHERE EXISTS (
  SELECT 1
  FROM _0109_expected_effect_summaries expected
  JOIN ingredients ingredient ON ingredient.name = expected.ingredient_name
  LEFT JOIN ingredient_display_profiles profile
    ON profile.ingredient_id = ingredient.id
   AND profile.form_id IS NULL
   AND profile.part_id IS NULL
   AND profile.sub_ingredient_id IS NULL
  LEFT JOIN display_profile_translations translation
    ON translation.display_profile_id = profile.id
   AND translation.language = 'de'
  WHERE profile.effect_summary IS NOT expected.new_effect_summary
     OR translation.effect_summary IS NOT expected.new_effect_summary
);

DROP TRIGGER _0109_effect_summary_guard_abort;
DROP TABLE _0109_effect_summary_guard;
DROP TABLE _0109_expected_effect_summaries;
