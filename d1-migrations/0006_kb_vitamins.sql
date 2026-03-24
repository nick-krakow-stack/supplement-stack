-- Migration 0006: Knowledge-Base – Vitamine
-- Adds comprehensive KB data (synonyms, forms, dosage_guidelines, interactions)
-- for all vitamins: fat-soluble (A, D3, K1, K2, E) and water-soluble (B1–B9, B12, C).
--
-- Existing ingredient IDs updated here:
--   1  = Vitamin D3     2  = Vitamin K2
--   5  = Vitamin C     14  = Vitamin B12
-- New ingredient IDs inserted here (starting at 32):
--  32  = Vitamin A     33  = Vitamin K1     34  = Vitamin E
--  35  = Vitamin B1    36  = Vitamin B2     37  = Vitamin B3
--  38  = Vitamin B5    39  = Vitamin B6     40  = Vitamin B7
--  41  = Vitamin B9
--
-- Data sources:
--   _research_raw/01_fat_soluble_vitamins.json
--   _research_raw/02_b_vitamins_vitamin_c.json

PRAGMA foreign_keys = ON;

-- =========================================================================
-- STEP 1: Update existing ingredients (1, 2, 5, 14) with full KB data
-- =========================================================================

-- Vitamin D3 (id=1)
UPDATE ingredients SET
  category         = 'vitamin_fat_soluble',
  timing           = 'with_meal',
  upper_limit      = 4000,
  upper_limit_unit = 'IU',
  upper_limit_note = 'EFSA UL 4000 IU/Tag für Erwachsene; einige Experten halten unter ärztlicher Aufsicht bis 10.000 IU für kurzfristig tolerierbar; Überdosierung führt zu Hyperkalzämie',
  description      = 'Vitamin D3 (Cholecalciferol) ist das körpereigene Vitamin D, das durch UVB-Strahlung in der Haut gebildet wird und essenzielle Funktionen bei Calciumaufnahme, Knochengesundheit, Immunregulation und Muskelstoffwechsel übernimmt. In nördlichen Breiten ist eine endogene Synthese von Oktober bis April kaum möglich, weshalb Supplementierung besonders in den Wintermonaten empfohlen wird. Viele klinische Studien zeigen, dass Blutspiegel über 50 nmol/L erst mit 2000–5000 IU zuverlässig erreicht werden.',
  hypo_symptoms    = 'Osteomalazie, Rachitis bei Kindern, Muskelschwäche, erhöhte Infektanfälligkeit, Fatigue, depressive Verstimmung, chronische Schmerzen, Osteoporose',
  hyper_symptoms   = 'Hyperkalzämie, Übelkeit, Erbrechen, Polyurie, Nierenkalzinose, Herzrhythmusstörungen, Verwirrtheit, bei chronischer Überdosierung Nierenversagen',
  external_url     = 'https://www.dge.de/wissenschaft/referenzwerte/vitamin-d/'
WHERE id = 1;

-- Vitamin K2 (id=2)
UPDATE ingredients SET
  category         = 'vitamin_fat_soluble',
  timing           = 'with_meal',
  upper_limit      = NULL,
  upper_limit_unit = 'µg',
  upper_limit_note = 'EFSA hat kein UL für Vitamin K2 festgelegt; Wechselwirkung mit Vitamin-K-Antagonisten beachten',
  description      = 'Vitamin K2 (Menachinon) ist die tierisch und bakteriell gebildete Vitamin-K-Form, die sich in der Seitenkettenlänge unterscheidet (MK-4 bis MK-13). K2 aktiviert extrahepatische Gla-Proteine wie Osteocalcin (Knochen) und Matrix-Gla-Protein (Gefäße) weitaus effektiver als K1. MK-7 aus Natto besitzt mit ~72 Stunden eine deutlich längere Halbwertszeit als MK-4 (~1-2 Stunden) und ist bei vergleichbarer Wirksamkeit in deutlich niedrigeren Dosen wirksam.',
  hypo_symptoms    = 'Erhöhtes Frakturrisiko, Knochendichteverlust, arteriosklerotische Calciumablagerungen in Gefäßwänden, erhöhtes kardiovaskuläres Risiko',
  hyper_symptoms   = 'Keine bekannte Toxizität; bei Antikoagulantientherapie mögliche Antagonisierung',
  external_url     = 'https://www.dge.de/wissenschaft/referenzwerte/vitamin-k/'
WHERE id = 2;

-- Vitamin C (id=5)
UPDATE ingredients SET
  category         = 'vitamin_water_soluble',
  timing           = 'with_meal',
  upper_limit      = 2000,
  upper_limit_unit = 'mg',
  upper_limit_note = 'EFSA UL: 1000 mg/Tag; US-IOM: 2000 mg/Tag; BfR empfiehlt maximal 225 mg/Tag aus Supplementen. Ab >1000 mg/Tag: osmotische Diarrhoe (Darmtoleranz-Grenze, individuell sehr variabel). Nierensteine (Oxalat) bei sehr hohen Dosen und Prädisposition.',
  description      = 'Ascorbinsäure ist das wichtigste wasserlösliche Antioxidans und essenziell für Kollagensynthese, Eisenresorption (Fe³⁺→Fe²⁺), Immunfunktion und als Cofaktor von Monooxygenasen (Carnitin-, Katecholamin- und Hormonsynthese). Menschen können Vitamin C nicht selbst synthetisieren (GULO-Gen-Mutation). Der Bedarf steigt bei Stress, Rauchen und Entzündungen erheblich.',
  hypo_symptoms    = 'Skorbut: Zahnfleischbluten, Zahnausfall, perfollikuläre Hämorrhagien, schlechte Wundheilung, Müdigkeit, Gliederschmerzen, Anämie. Erste Mangelzeichen nach 4–6 Wochen.',
  hyper_symptoms   = 'Osmotische Diarrhoe, Blähungen ab ~1000–2000 mg/Tag. Erhöhtes Nierensteinrisiko bei >1000 mg/Tag und Prädisposition. Prooxidative Effekte bei Hämochromatose.',
  external_url     = 'https://www.dge.de/wissenschaft/referenzwerte/vitamin-c/'
WHERE id = 5;

-- Vitamin B12 (id=14)
UPDATE ingredients SET
  category         = 'vitamin_water_soluble',
  timing           = 'morning',
  upper_limit      = NULL,
  upper_limit_unit = 'µg',
  upper_limit_note = 'Kein UL festgelegt. Sehr sicher. Cyanocobalamin: enthält Cyanidgruppe – bei Rauchern und Niereninsuffizienz nicht empfohlen.',
  description      = 'Cobalamin ist ein kobalthaltiges Vitamin, das ausschließlich von Mikroorganismen synthetisiert wird und vor allem in tierischen Lebensmitteln vorkommt. Es ist essenziell für DNA-Synthese, Myelinscheidensynthese, Folat- und Homocysteinstoffwechsel. B12-Mangel ist tückisch: Körperspeicher (Leber) betragen 2–5 mg und Mangelsymptome treten erst nach Jahren auf – dann oft mit irreversiblen neurologischen Schäden.',
  hypo_symptoms    = 'Megaloblastäre Anämie, funikuläre Myelose (Ataxie, Spastik, Parästhesien), periphere Neuropathie, Gedächtniseinbußen, Demenz, Glossitis, erhöhter Homocystein- und Methylmalonsäurespiegel. Risiko: Veganer, Metformin-Einnahme, Magensäuremangel, Gastrektomie.',
  hyper_symptoms   = 'Keine bekannte Toxizität bei oraler Gabe. Selten akneiforme Reaktionen bei hohen Cyanocobalamin-Dosen.',
  external_url     = 'https://www.dge.de/wissenschaft/referenzwerte/vitamin-b12/'
WHERE id = 14;

-- =========================================================================
-- STEP 2: Insert new ingredients (32–41)
-- =========================================================================

INSERT OR IGNORE INTO ingredients (id, name, unit, category, timing, upper_limit, upper_limit_unit, upper_limit_note, description, hypo_symptoms, hyper_symptoms, external_url) VALUES
(32, 'Vitamin A', 'µg RAE', 'vitamin_fat_soluble', 'with_meal', 3000, 'µg RAE',
  'EFSA/BfR UL für vorgeformtes Retinol bei Erwachsenen; kein UL für Beta-Carotin aus Nahrungsquellen; Raucher: Beta-Carotin-Supplemente meiden (erhöhtes Lungenkrebsrisiko)',
  'Vitamin A ist ein fettlösliches Vitamin, das in zwei Hauptformen vorkommt: als vorgeformtes Retinol (aus tierischen Quellen) und als Provitamin-A-Carotinoide wie Beta-Carotin (aus pflanzlichen Quellen). Es ist essenziell für Sehvermögen, Immunfunktion, Zellwachstum und Gewebedifferenzierung. Beta-Carotin wird im Körper bedarfsgerecht in Retinol umgewandelt und gilt aus Nahrungsquellen als sicher, da keine Hypervitaminose durch Beta-Carotin aus der Nahrung bekannt ist.',
  'Nachtblindheit, Xerophthalmie (Austrocknung der Hornhaut), erhöhte Infektanfälligkeit, Wachstumsstörungen bei Kindern, trockene und schuppige Haut, Keratinisierung der Schleimhäute',
  'Kopfschmerzen, Übelkeit, Schwindel, Sehstörungen, Lebervergrößerung und -schäden, Knochenbrüchigkeit, Teratogenität bei Schwangeren (Missbildungen), Haarausfall, trockene Haut (chronische Überdosierung)',
  'https://www.dge.de/wissenschaft/referenzwerte/vitamin-a/'),

(33, 'Vitamin K1', 'µg', 'vitamin_fat_soluble', 'with_meal', NULL, 'µg',
  'EFSA hat kein UL für Vitamin K1 festgelegt; bei Vitamin-K-Antagonisten (Marcumar/Warfarin) ärztliche Aufsicht erforderlich',
  'Vitamin K1 (Phyllochinon) ist die pflanzliche Form des Vitamins K und kommt vor allem in grünem Blattgemüse vor. Es ist primär an der hepatischen Synthese von Gerinnungsfaktoren (II, VII, IX, X) beteiligt. Die Bioverfügbarkeit aus Nahrungsquellen ist gering (~10%), aus Supplements hingegen deutlich besser; K1 wird schnell in der Leber metabolisiert und kaum in extra-hepatisches Gewebe transportiert.',
  'Verlängerte Blutungszeit, Blutungsneigung, Ekchymosen, bei Neugeborenen klassische Vitamin-K-Mangelblutung (VKDB)',
  'Keine bekannte Toxizität aus natürlichem K1',
  'https://www.dge.de/wissenschaft/referenzwerte/vitamin-k/'),

(34, 'Vitamin E', 'mg', 'vitamin_fat_soluble', 'with_meal', 300, 'mg',
  'EFSA UL 300 mg/Tag; BfR empfiehlt max. 30 mg/Tag zusätzlich zur Nahrung; hochdosierte Gaben erhöhen Blutungsrisiko',
  'Vitamin E bezeichnet eine Gruppe von acht fettlöslichen Verbindungen (vier Tocopherole, vier Tocotrienole), wobei α-Tocopherol die biologisch aktivste Form ist. Als primäres fettlösliches Antioxidans schützt es Zellmembranen und LDL-Cholesterol vor oxidativer Schädigung. Natürliches d-α-Tocopherol (RRR-Konfiguration) weist eine bis zu doppelt so hohe biologische Aktivität auf wie synthetisches dl-α-Tocopherol.',
  'Periphere Neuropathie, Muskelschwäche, hämolytische Anämie (bei Frühgeborenen), Ataxie, erhöhte oxidative Stressmarker',
  'Erhöhte Blutungsneigung, Hemmung von Vitamin-K-abhängiger Gerinnung, Übelkeit; >400 IU/Tag tendenziell erhöhte Gesamtmortalität (Meta-Analyse)',
  'https://www.dge.de/wissenschaft/referenzwerte/vitamin-e/'),

(35, 'Vitamin B1', 'mg', 'vitamin_water_soluble', 'with_meal', NULL, NULL,
  'Kein UL durch EFSA/BfR festgelegt, da überschüssiges Thiamin renal ausgeschieden wird.',
  'Thiamin ist essenziell für den Kohlenhydratstoffwechsel und die Funktion des Nervensystems. Als Coenzym Thiaminpyrophosphat (TPP) ist es an der oxidativen Decarboxylierung von Pyruvat und alpha-Ketoglutarat beteiligt. Ein Mangel führt zur klassischen Beriberi-Erkrankung und zum Wernicke-Korsakoff-Syndrom.',
  'Müdigkeit, Reizbarkeit, Konzentrationsschwäche, periphere Neuropathie, Muskelschwäche, Herzinsuffizienz (nasse Beriberi), Wernicke-Enzephalopathie (Augenbewegungsstörungen, Ataxie, Verwirrtheit) bei schwerem Mangel',
  'Bei oraler Einnahme keine bekannte Toxizität.',
  'https://www.dge.de/wissenschaft/referenzwerte/thiamin/'),

(36, 'Vitamin B2', 'mg', 'vitamin_water_soluble', 'with_meal', NULL, NULL,
  'Kein UL durch EFSA/BfR festgelegt. Gelbe Urinverfärbung bei höheren Dosen ist harmlos.',
  'Riboflavin ist Bestandteil der Coenzyme FMN und FAD, die in der Atmungskette und bei Redoxreaktionen zentral sind. Es unterstützt den Energiestoffwechsel, die Aktivierung von Vitamin B6 und Folat sowie den Schutz vor oxidativem Stress. Riboflavin ist lichtempfindlich und wird durch UV-Bestrahlung zerstört.',
  'Mundwinkelrhagaden, Glossitis, seborrhoeische Dermatitis, Augenbrennen, Lichtempfindlichkeit, Anämie',
  'Keine bekannte orale Toxizität. Gelbe bis orangefarbene Urinverfärbung (harmlos).',
  'https://www.dge.de/wissenschaft/referenzwerte/riboflavin/'),

(37, 'Vitamin B3', 'mg', 'vitamin_water_soluble', 'with_meal', 10, 'mg',
  'EFSA UL für Nicotinsäure: 10 mg/Tag; für Nicotinamid: 900 mg/Tag. BfR empfiehlt maximal 17 mg Nicotinsäure/Tag aus Supplementen.',
  'Niacin umfasst Nicotinsäure und Nicotinamid, die zu NAD+ und NADP+ umgewandelt werden und in über 400 enzymatischen Reaktionen des Energie-, Fett- und DNA-Stoffwechsels wirken. Nicotinsäure in pharmakologischen Dosen senkt LDL und hebt HDL, verursacht aber den charakteristischen Niacin-Flush. Nicotinamid löst keinen Flush aus.',
  'Pellagra (Dermatitis, Diarrhoe, Demenz), Stomatitis, Glossitis, Reizbarkeit, Schlaflosigkeit',
  'Niacin-Flush bei Nicotinsäure; bei chronischer Hochdosierung: Hepatotoxizität, erhöhter Blutzucker',
  'https://www.dge.de/wissenschaft/referenzwerte/niacin/'),

(38, 'Vitamin B5', 'mg', 'vitamin_water_soluble', 'with_meal', NULL, NULL,
  'Kein UL festgelegt. Sehr hohe Dosen (>10 g/Tag) können Durchfall verursachen. Gilt als sehr sicher.',
  'Pantothensäure ist als Bestandteil von Coenzym A und dem Acyl-Carrier-Protein unverzichtbar für den Fettsäure-, Kohlenhydrat- und Proteinstoffwechsel sowie die Synthese von Steroidhormonen, Neurotransmittern und Hämoglobin.',
  'Brennen-Fuß-Syndrom, Müdigkeit, Kopfschmerzen, Schlafstörungen, Übelkeit, Taubheitsgefühle. Isolierter Mangel beim Menschen selten.',
  'Sehr gute Verträglichkeit. Bei >10 g/Tag: Durchfall möglich.',
  'https://www.dge.de/wissenschaft/referenzwerte/pantothensaeure/'),

(39, 'Vitamin B6', 'mg', 'vitamin_water_soluble', 'with_meal', 25, 'mg',
  'EFSA UL: 25 mg/Tag für Erwachsene (2023 verschärft). BfR: maximal 3,5 mg/Tag aus Supplementen. Bei >200 mg/Tag über längere Zeit: periphere Neuropathie.',
  'Vitamin B6 ist als Pyridoxal-5-Phosphat (P5P) Coenzym für über 160 Enzymreaktionen, vor allem im Aminosäure- und Neurotransmitterstoffwechsel. Es ist essenziell für die Synthese von Serotonin, Dopamin, GABA und Noradrenalin sowie für den Homocysteinstoffwechsel. B6 ist das einzige wasserlösliche Vitamin mit einem klar definierten UL aufgrund neurotoxischer Effekte bei Hochdosierung.',
  'Seborrhoeische Dermatitis, Glossitis, periphere Neuropathie, Depressionen, Immunsuppression, mikrozytäre Anämie, erhöhtes Homocystein',
  'Periphere sensorische Neuropathie (Kribbeln, Taubheit, Schmerzen) bei >25 mg/Tag über längere Zeit. Meist reversibel nach Absetzen.',
  'https://www.dge.de/wissenschaft/referenzwerte/vitamin-b6/'),

(40, 'Vitamin B7', 'µg', 'vitamin_water_soluble', 'with_meal', NULL, NULL,
  'Kein UL festgelegt. Sehr sicher. Wichtig: >5 mg/Tag kann Labordiagnostik (TSH, Troponin, Steroide) massiv verfälschen.',
  'Biotin (auch Vitamin H) ist als Coenzym für Carboxylasen essenziell und spielt eine Schlüsselrolle im Fettsäure-, Glucose- und Aminosäurestoffwechsel. Es ist bekannt für seine Rolle bei Haut-, Haar- und Nagelgesundheit. Wichtig: Hohe Biotindosen (>5 mg/Tag) können immunologische Laborassays (Troponin, TSH, Schilddrüsenhormone) erheblich verfälschen.',
  'Haarausfall, brüchige Nägel, seborrhoeische Dermatitis, periorbitales Ekzem, periphere Neuropathie, Müdigkeit, Depressionen. Risiko erhöht bei rohem Eiweißkonsum (Avidin).',
  'Keine bekannte Toxizität. Kritisch: Biotindosen >5 mg verfälschen Immunoassay-Laborwerte (falsch erhöhte/erniedrigte TSH, Troponin, Steroidhormone).',
  'https://www.dge.de/wissenschaft/referenzwerte/biotin/'),

(41, 'Vitamin B9', 'µg', 'vitamin_water_soluble', 'morning', 1000, 'µg',
  'EFSA/BfR UL: 1000 µg/Tag synthetische Folsäure. Risiko: Hohe Folsäuredosen können Vitamin-B12-Mangel maskieren. Für L-Methylfolat (5-MTHF) kein UL festgelegt.',
  'Folat (natürliche Form) und Folsäure (synthetische Form) sind essenziell für DNA-Synthese, Zellteilung und den Einkohlenstoffstoffwechsel. Die aktive Form ist 5-Methyltetrahydrofolat (5-MTHF). Kritisch in der Frühschwangerschaft zur Prävention von Neuralrohrdefekten. Bei der MTHFR-C677T-Genvariante (~10–15% homozygot) ist die Umwandlung von Folsäure zu 5-MTHF stark eingeschränkt.',
  'Megaloblastäre Anämie, Glossitis, erhöhtes Homocystein, Depressionen, kognitive Beeinträchtigung. In der Schwangerschaft: Neuralrohrdefekte (Spina bifida).',
  'Maskierung eines Vitamin-B12-Mangels (kritisch – neurologische Schäden bei normalisierter Anämie). Gastrointestinale Beschwerden selten.',
  'https://www.dge.de/wissenschaft/referenzwerte/folat/');

-- =========================================================================
-- STEP 3: Synonyms
-- =========================================================================

-- Vitamin D3 (id=1)
INSERT OR IGNORE INTO ingredient_synonyms (ingredient_id, synonym) VALUES
(1, 'Cholecalciferol'),
(1, 'Colecalciferol'),
(1, 'Vitamin D'),
(1, 'Sonnenvitamin'),
(1, 'Calcitriol'),
(1, '25-Hydroxyvitamin D');

-- Vitamin K2 (id=2)
INSERT OR IGNORE INTO ingredient_synonyms (ingredient_id, synonym) VALUES
(2, 'Menachinon'),
(2, 'Menaquinone'),
(2, 'MK-4'),
(2, 'MK-7'),
(2, 'Menatetrenon'),
(2, 'trans-Menachinon-7'),
(2, 'Natto-Vitamin K');

-- Vitamin C (id=5)
INSERT OR IGNORE INTO ingredient_synonyms (ingredient_id, synonym) VALUES
(5, 'Ascorbinsäure'),
(5, 'Ascorbic acid'),
(5, 'L-Ascorbinsäure'),
(5, 'Ascorbat'),
(5, 'Calciumascorbat'),
(5, 'Natriumascorbat'),
(5, 'Liposomales Vitamin C'),
(5, 'Ester-C');

-- Vitamin B12 (id=14)
INSERT OR IGNORE INTO ingredient_synonyms (ingredient_id, synonym) VALUES
(14, 'Cobalamin'),
(14, 'Methylcobalamin'),
(14, 'Adenosylcobalamin'),
(14, 'Hydroxocobalamin'),
(14, 'Cyanocobalamin'),
(14, 'MeCbl'),
(14, 'AdoCbl'),
(14, 'OHCbl'),
(14, 'CNCbl');

-- Vitamin A (id=32)
INSERT OR IGNORE INTO ingredient_synonyms (ingredient_id, synonym) VALUES
(32, 'Retinol'),
(32, 'Retinal'),
(32, 'Retinsäure'),
(32, 'Beta-Carotin'),
(32, 'Provitamin A'),
(32, 'Carotin'),
(32, 'Axerophthol'),
(32, 'Vitamin A1');

-- Vitamin K1 (id=33)
INSERT OR IGNORE INTO ingredient_synonyms (ingredient_id, synonym) VALUES
(33, 'Phyllochinon'),
(33, 'Phytomenadion'),
(33, 'Phylloquinone'),
(33, 'Antihämorrhagisches Vitamin');

-- Vitamin E (id=34)
INSERT OR IGNORE INTO ingredient_synonyms (ingredient_id, synonym) VALUES
(34, 'Tocopherol'),
(34, 'Alpha-Tocopherol'),
(34, 'd-alpha-Tocopherol'),
(34, 'dl-alpha-Tocopherol'),
(34, 'Mixed Tocopherols'),
(34, 'Gamma-Tocopherol'),
(34, 'Tocotrienol');

-- Vitamin B1 (id=35)
INSERT OR IGNORE INTO ingredient_synonyms (ingredient_id, synonym) VALUES
(35, 'Thiamin'),
(35, 'Thiamine'),
(35, 'Aneurin'),
(35, 'TPP'),
(35, 'Thiaminpyrophosphat'),
(35, 'Thiamindiphosphat');

-- Vitamin B2 (id=36)
INSERT OR IGNORE INTO ingredient_synonyms (ingredient_id, synonym) VALUES
(36, 'Riboflavin'),
(36, 'Laktoflavin'),
(36, 'FMN'),
(36, 'FAD');

-- Vitamin B3 (id=37)
INSERT OR IGNORE INTO ingredient_synonyms (ingredient_id, synonym) VALUES
(37, 'Niacin'),
(37, 'Nicotinsäure'),
(37, 'Nicotinamid'),
(37, 'Niacinamid'),
(37, 'NAD-Vorläufer'),
(37, 'NR'),
(37, 'NMN'),
(37, 'Nicotinamidribosid'),
(37, 'Nicotinamidmononukleotid');

-- Vitamin B5 (id=38)
INSERT OR IGNORE INTO ingredient_synonyms (ingredient_id, synonym) VALUES
(38, 'Pantothensäure'),
(38, 'Pantothenic acid'),
(38, 'Panthenol'),
(38, 'Dexpanthenol'),
(38, 'Calciumpantothenat');

-- Vitamin B6 (id=39)
INSERT OR IGNORE INTO ingredient_synonyms (ingredient_id, synonym) VALUES
(39, 'Pyridoxin'),
(39, 'Pyridoxal'),
(39, 'Pyridoxamin'),
(39, 'P5P'),
(39, 'Pyridoxal-5-Phosphat'),
(39, 'Pyridoxin-HCl');

-- Vitamin B7 (id=40)
INSERT OR IGNORE INTO ingredient_synonyms (ingredient_id, synonym) VALUES
(40, 'Biotin'),
(40, 'Vitamin H'),
(40, 'Coenzym R'),
(40, 'D-Biotin');

-- Vitamin B9 (id=41)
INSERT OR IGNORE INTO ingredient_synonyms (ingredient_id, synonym) VALUES
(41, 'Folat'),
(41, 'Folsäure'),
(41, 'Folic acid'),
(41, 'L-Methylfolat'),
(41, '5-MTHF'),
(41, '5-Methyltetrahydrofolat'),
(41, 'Methylfolat'),
(41, 'Metafolin'),
(41, 'Quatrefolic'),
(41, 'Vitamin M'),
(41, 'DFE');

-- =========================================================================
-- STEP 4: Ingredient forms
-- =========================================================================

-- Vitamin D3 (id=1)
INSERT OR IGNORE INTO ingredient_forms (ingredient_id, name, bioavailability, timing, is_recommended, score, comment) VALUES
(1, 'Cholecalciferol (D3)', 'high', 'with_meal', 1, 9,
  'Körpereigene Form, die effektiver den 25(OH)D-Blutspiegel erhöht als D2. Fettlöslich – Einnahme mit fettreicher Mahlzeit verbessert Resorption um bis zu 50%. Bevorzugte Form.'),
(1, 'Ergocalciferol (D2)', 'medium', 'with_meal', 0, 5,
  'Pflanzliche/pilzliche Form, ~30% weniger wirksam als D3. Kürzere Halbwertszeit. Für Veganer relevant, aber D3 aus Flechten vorzuziehen.'),
(1, 'Calcifediol (25-Hydroxy-D3)', 'very_high', 'with_meal', 1, 8,
  'Bereits hydroxylierte Speicherform, bis zu 3-5x bioverfügbarer als D3. Sinnvoll bei Malabsorption. Nur unter ärztlicher Aufsicht.');

-- Vitamin K2 (id=2)
INSERT OR IGNORE INTO ingredient_forms (ingredient_id, name, bioavailability, timing, is_recommended, score, comment) VALUES
(2, 'Menachinon-7 (MK-7)', 'high', 'with_meal', 1, 9,
  'Bevorzugte K2-Form: Halbwertszeit ~72h ermöglicht stabile Serumspiegel mit einmal täglicher Gabe. 90–200 µg/Tag ausreichend für optimale MGP- und Osteocalcin-Carboxylierung.'),
(2, 'Menachinon-4 (MK-4)', 'medium', 'with_meal', 1, 7,
  'Kurze Halbwertszeit (~1-2h) erfordert 2-3 tägliche Einnahmen. In Japan medizinisch zugelassen (45 mg/Tag bei Osteoporose). Als Supplement in niedrigen Dosen weniger effektiv als MK-7.'),
(2, 'Menachinon-4+7 Kombination', 'high', 'with_meal', 1, 8,
  'Kombiniert schnelle Wirkung von MK-4 und Langzeitstabilität von MK-7. Für fokussierten Knochen- und Gefäßschutz sinnvoll.');

-- Vitamin C (id=5)
INSERT OR IGNORE INTO ingredient_forms (ingredient_id, name, bioavailability, timing, is_recommended, score, comment) VALUES
(5, 'L-Ascorbinsäure', 'high', 'with_meal', 1, 8,
  'Standardform, günstig, gut untersucht. pH 2,5 – kann bei empfindlichem Magen reizen. Mit Mahlzeit einnehmen.'),
(5, 'Natriumascorbat', 'high', 'with_meal', 1, 8,
  'Gepuffert, pH-neutral, bessere Magenverträglichkeit. Enthält ~131 mg Natrium/g – bei Hypertonie beachten.'),
(5, 'Calciumascorbat (Ester-C)', 'high', 'with_meal', 1, 8,
  'pH-neutral, sehr gute Magenverträglichkeit. Enthält ~10% Calcium. Gute Wahl bei Magenproblemen.'),
(5, 'Liposomales Vitamin C', 'very_high', 'fasting', 1, 9,
  'In Phospholipid-Liposomen eingeschlossen. Umgeht teilweise den intestinalen Transporter, ermöglicht höhere Plasmaspiegel. Geringere Darmtoleranzprobleme bei hohen Dosen. Qualitätsunterschiede zwischen Produkten erheblich.');

-- Vitamin B12 (id=14)
INSERT OR IGNORE INTO ingredient_forms (ingredient_id, name, bioavailability, timing, is_recommended, score, comment) VALUES
(14, 'Methylcobalamin', 'very_high', 'morning', 1, 10,
  'Aktive bioidentische Form, direkt für Einkohlenstoffstoffwechsel verwertbar. Bevorzugt für Nervengesundheit. Beste Form für Veganer und ältere Personen. Lichtempfindlich lagern.'),
(14, 'Adenosylcobalamin', 'very_high', 'with_meal', 1, 9,
  'Zweite aktive Form, ausschließlich in Mitochondrien aktiv. Coenzym der Methylmalonyl-CoA-Mutase. Optimal in Kombination mit Methylcobalamin.'),
(14, 'Hydroxocobalamin', 'very_high', 'morning', 1, 8,
  'Natürliche Speicherform. Wird zu Methyl- und Adenosylcobalamin umgewandelt. Bessere Gewebsspeicherung. Standardform für i.m.-Injektionen. Auch für Raucher sicher.'),
(14, 'Cyanocobalamin', 'high', 'morning', 0, 5,
  'Günstigste und stabilste synthetische Form. Enthält Cyanidgruppe. Bei Rauchern und Niereninsuffizienz nicht empfohlen. Muss mehrfach umgewandelt werden.');

-- Vitamin A (id=32)
INSERT OR IGNORE INTO ingredient_forms (ingredient_id, name, bioavailability, timing, is_recommended, score, comment) VALUES
(32, 'Retinol (Vitamin A1)', 'high', 'with_meal', 1, 8,
  'Vorgeformtes Vitamin A aus tierischen Quellen mit hoher Bioverfügbarkeit (~75%). Direkt verwertbar ohne Umwandlung. Geeignet bei nachgewiesenem Mangel, jedoch Vorsicht bei Überdosierung – toxisches Potenzial vorhanden.'),
(32, 'Retinylacetat', 'high', 'with_meal', 1, 7,
  'Synthetische Esterform des Retinols, stabil und häufig in Supplementen verwendet. Wird im Darm zu Retinol hydrolysiert. Bioverfügbarkeit vergleichbar mit Retinol, gute Lagerstabilität.'),
(32, 'Retinylpalmitat', 'high', 'with_meal', 1, 7,
  'Natürliche Esterform des Retinols, häufig in angereicherten Lebensmitteln und Supplementen. Ähnlich wie Retinylacetat gut bioverfügbar, gut verträglich und weit verbreitet in der Supplementierung.'),
(32, 'Beta-Carotin', 'medium', 'with_meal', 0, 6,
  'Pflanzliches Provitamin A mit variabler Konversionsrate (1/12 bis 1/21 β-Carotin : Retinol). Sicher aus Nahrungsquellen (kein UL), aber hochdosierte Supplemente für Raucher kontraindiziert (ATBC- und CARET-Studie: erhöhtes Lungenkrebsrisiko). Aus Nahrung bevorzugen.');

-- Vitamin K1 (id=33)
INSERT OR IGNORE INTO ingredient_forms (ingredient_id, name, bioavailability, timing, is_recommended, score, comment) VALUES
(33, 'Phyllochinon (K1)', 'medium', 'with_meal', 1, 7,
  'Natürliche Pflanzenform, gut zur Blutgerinnungsunterstützung. Bioverfügbarkeit aus Supplements höher als aus Nahrung.');

-- Vitamin E (id=34)
INSERT OR IGNORE INTO ingredient_forms (ingredient_id, name, bioavailability, timing, is_recommended, score, comment) VALUES
(34, 'd-α-Tocopherol (natürlich, RRR)', 'high', 'with_meal', 1, 9,
  'Natürliche Form mit höchster biologischer Aktivität (1 mg = 1,49 IU). Bevorzugt durch α-TTP-Protein für Gewebeverteilung selektiert. Klar bevorzugt für Supplementierung.'),
(34, 'dl-α-Tocopherol (synthetisch, all-rac)', 'medium', 'with_meal', 0, 5,
  'Racemat aus 8 Stereoisomeren; nur das RRR-Isomer biologisch vollwertig aktiv. ~1,36-fache Dosis nötig für gleiche Wirkung wie natürliche Form.'),
(34, 'Gemischte Tocopherole (Mixed Tocopherols)', 'high', 'with_meal', 1, 8,
  'Kombination aus α-, β-, γ- und δ-Tocopherol. γ-Tocopherol hemmt spezifisch COX-2 und neutralisiert RNS. Entspricht natürlichem Nahrungsprofil besser als isoliertes α-Tocopherol.'),
(34, 'Tocotrienole', 'medium', 'with_meal', 1, 7,
  'Aus Palmöl oder Annatto. Zeigen neuroprotektive und cholesterinsenkende Effekte in Studien. Interessante Ergänzung zu Mixed Tocopherols.');

-- Vitamin B1 (id=35)
INSERT OR IGNORE INTO ingredient_forms (ingredient_id, name, bioavailability, timing, is_recommended, score, comment) VALUES
(35, 'Thiaminhydrochlorid', 'medium', 'with_meal', 1, 7,
  'Häufigste und günstigste Form in Supplementen. Ausreichende Bioverfügbarkeit bei normaler Dosierung, mit Nahrung besser aufgenommen.'),
(35, 'Benfotiamin', 'very_high', 'with_meal', 1, 9,
  'Fettlösliches Thiaminderivat mit deutlich höherer Bioverfügbarkeit (3–5× höher). Besonders wirksam bei diabetischer Neuropathie. Bevorzugt bei therapeutischem Einsatz.');

-- Vitamin B2 (id=36)
INSERT OR IGNORE INTO ingredient_forms (ingredient_id, name, bioavailability, timing, is_recommended, score, comment) VALUES
(36, 'Riboflavin', 'medium', 'with_meal', 1, 7,
  'Standardform. Mit Mahlzeit deutlich besser absorbiert (~60–65%).'),
(36, 'Riboflavin-5-Phosphat (FMN)', 'high', 'with_meal', 1, 9,
  'Aktive Form mit etwas höherer Bioverfügbarkeit. Wird direkt als FMN genutzt. Bevorzugt bei eingeschränkter Verdauungskapazität.');

-- Vitamin B3 (id=37)
INSERT OR IGNORE INTO ingredient_forms (ingredient_id, name, bioavailability, timing, is_recommended, score, comment) VALUES
(37, 'Nicotinamid (Niacinamid)', 'high', 'with_meal', 1, 8,
  'Kein Flush, gut verträglich. Bevorzugte Form für Nahrungsergänzung. EFSA-UL 900 mg/Tag.'),
(37, 'Nicotinsäure (Niacin)', 'high', 'with_meal', 0, 6,
  'Stark lipidsenkend in Pharmakodosen, aber Flush und EFSA-UL 10 mg/Tag schränken Supplementierung ein.'),
(37, 'Nicotinamidribosid (NR)', 'high', 'morning', 1, 8,
  'NAD+-Vorläufer, kein Flush, gut verträglich. Erhöht NAD+-Spiegel effizient. Anti-Aging-Forschung vielversprechend.'),
(37, 'Nicotinamidmononukleotid (NMN)', 'high', 'morning', 1, 8,
  'Direkter NAD+-Vorläufer (eine Stufe näher als NR). Kein Flush. Aktive Langlebigkeitsforschung.');

-- Vitamin B5 (id=38)
INSERT OR IGNORE INTO ingredient_forms (ingredient_id, name, bioavailability, timing, is_recommended, score, comment) VALUES
(38, 'Calciumpantothenat', 'high', 'with_meal', 1, 8,
  'Stabilste und häufigste Form. Gut bioverfügbar, kostengünstig.'),
(38, 'Panthenol (D-Panthenol)', 'very_high', 'with_meal', 1, 9,
  'Alkoholform, wird effizient zu Pantothensäure oxidiert. Bessere Absorption. Auch topisch für Wundheilung (Dexpanthenol) eingesetzt.');

-- Vitamin B6 (id=39)
INSERT OR IGNORE INTO ingredient_forms (ingredient_id, name, bioavailability, timing, is_recommended, score, comment) VALUES
(39, 'Pyridoxin-Hydrochlorid (Pyridoxin-HCl)', 'high', 'with_meal', 1, 7,
  'Günstigste Form. Muss zu P5P aktiviert werden. Bei den meisten gesunden Menschen ausreichend.'),
(39, 'Pyridoxal-5-Phosphat (P5P)', 'very_high', 'with_meal', 1, 10,
  'Biologisch aktive Form, direkt verwertbar ohne hepatische Aktivierung. Bevorzugt bei eingeschränkter Leberfunktion, MTHFR-Variante oder therapeutischem Einsatz.');

-- Vitamin B7 (id=40)
INSERT OR IGNORE INTO ingredient_forms (ingredient_id, name, bioavailability, timing, is_recommended, score, comment) VALUES
(40, 'D-Biotin', 'high', 'with_meal', 1, 9,
  'Einzige biologisch aktive Form. Gut bioverfügbar (~100% aus Supplementen). Standardform.');

-- Vitamin B9 (id=41)
INSERT OR IGNORE INTO ingredient_forms (ingredient_id, name, bioavailability, timing, is_recommended, score, comment) VALUES
(41, 'L-Methylfolat (5-MTHF, Metafolin, Quatrefolic)', 'very_high', 'morning', 1, 10,
  'Biologisch aktive Form, direkt verwertbar ohne MTHFR-abhängige Umwandlung. Optimal für alle, besonders bei MTHFR-Polymorphismus. Überquert die Blut-Hirn-Schranke.'),
(41, 'Folsäure', 'high', 'morning', 0, 6,
  'Synthetische Form. Muss über MTHFR zu 5-MTHF umgewandelt werden. Bei MTHFR-Variante stark reduzierte Umwandlung. Kann als UMFA akkumulieren. Nicht empfohlen bei bekannter MTHFR-Variante.');

-- =========================================================================
-- STEP 5: Dosage guidelines
-- =========================================================================

-- Vitamin D3 (id=1)
INSERT OR IGNORE INTO dosage_guidelines (ingredient_id, source, source_url, source_title, population, dose_min, dose_max, unit, frequency, timing, notes, is_default) VALUES
(1, 'DGE', 'https://www.dge.de/wissenschaft/referenzwerte/vitamin-d/', 'DGE Referenzwerte Vitamin D, 2020',
  'adult_male', 800, 800, 'IU', 'daily', 'with_meal',
  'DGE-Schätzwert bei fehlender endogener Synthese für Männer und Frauen 19–70 Jahre: 800 IU (20 µg) täglich', 1),
(1, 'DGE', 'https://www.dge.de/wissenschaft/referenzwerte/vitamin-d/', 'DGE Referenzwerte Vitamin D, 2020',
  'adult_female', 800, 800, 'IU', 'daily', 'with_meal',
  'DGE-Schätzwert für Frauen 19–70 Jahre: 800 IU täglich', 1),
(1, 'study', 'https://doi.org/10.1210/jc.2011-2600', 'Holick et al., 2011, J Clin Endocrinol Metab – Endocrine Society Guidelines',
  'adult', 1500, 2000, 'IU', 'daily', 'with_meal',
  'Endocrine Society: 1500–2000 IU/Tag für 25(OH)D-Spiegel >75 nmol/L (30 ng/ml)', 0),
(1, 'study', 'https://doi.org/10.1001/jama.2022.21417', 'LeBoff et al., 2022, JAMA – VITAL-Studie',
  'adult', 2000, 2000, 'IU', 'daily', 'with_meal',
  'VITAL-Studie (n=25.871): 2000 IU/Tag D3 über 5 Jahre zeigte signifikante Reduktion von Krebsmortalität und Autoimmunerkrankungen', 0);

-- Vitamin K2 (id=2)
INSERT OR IGNORE INTO dosage_guidelines (ingredient_id, source, source_url, source_title, population, dose_min, dose_max, unit, frequency, timing, notes, is_default) VALUES
(2, 'DGE', 'https://www.dge.de/wissenschaft/referenzwerte/vitamin-k/', 'DGE Referenzwerte Vitamin K, 2018',
  'adult', 60, 70, 'µg', 'daily', 'with_meal',
  'DGE-Schätzwert gilt für Gesamt-Vitamin-K (K1+K2); spezifische K2-Referenzwerte fehlen', 1),
(2, 'study', 'https://doi.org/10.1007/s00198-012-2021-5', 'Knapen et al., 2013, Osteoporosis International',
  'adult_female', 180, 180, 'µg', 'daily', 'with_meal',
  '3-Jahres-RCT: 180 µg MK-7/Tag verbesserte Knochenfestigkeit bei postmenopausalen Frauen signifikant', 0),
(2, 'study', 'https://doi.org/10.1016/j.thromres.2018.12.020', 'Vermeer et al., 2019, Thrombosis Research',
  'adult', 90, 200, 'µg', 'daily', 'with_meal',
  '90–200 µg MK-7/Tag für vollständige MGP-Carboxylierung (Gefäßschutz); 180–200 µg für Osteocalcin-Carboxylierung (Knochen)', 0);

-- Vitamin C (id=5)
INSERT OR IGNORE INTO dosage_guidelines (ingredient_id, source, source_url, source_title, population, dose_min, dose_max, unit, frequency, timing, notes, is_default) VALUES
(5, 'DGE', 'https://www.dge.de/wissenschaft/referenzwerte/vitamin-c/', 'Referenzwerte für die Nährstoffzufuhr – Vitamin C',
  'adult_male', 110, 110, 'mg', 'daily', 'with_meal',
  'Männer 19–65 Jahre: 110 mg/Tag. Raucher: +35 mg/Tag zusätzlich.', 1),
(5, 'DGE', 'https://www.dge.de/wissenschaft/referenzwerte/vitamin-c/', 'Referenzwerte für die Nährstoffzufuhr – Vitamin C',
  'adult_female', 95, 95, 'mg', 'daily', 'with_meal',
  'Frauen 19–65 Jahre: 95 mg/Tag; Schwangerschaft: 105 mg/Tag; Stillzeit: 125 mg/Tag.', 0),
(5, 'study', 'https://pubmed.ncbi.nlm.nih.gov/29099763/', 'Hemilä – Vitamin C und Infektionen (Cochrane)',
  'adult', 200, 1000, 'mg', 'daily', 'with_meal',
  '200–1000 mg/Tag zur Immununterstützung. Regelmäßige Prophylaxe (≥200 mg) reduziert Erkältungsdauer signifikant (Cochrane).', 0);

-- Vitamin B12 (id=14)
INSERT OR IGNORE INTO dosage_guidelines (ingredient_id, source, source_url, source_title, population, dose_min, dose_max, unit, frequency, timing, notes, is_default) VALUES
(14, 'DGE', 'https://www.dge.de/wissenschaft/referenzwerte/vitamin-b12/', 'Referenzwerte für die Nährstoffzufuhr – Vitamin B12',
  'adult', 4.0, 4.0, 'µg', 'daily', 'morning',
  'Empfohlene Zufuhr: 4 µg/Tag. Aktiver Transport max. ~1,5 µg pro Mahlzeit. Passive Diffusion (1%) ermöglicht Aufnahme bei hohen oralen Dosen.', 1),
(14, 'study', 'https://pubmed.ncbi.nlm.nih.gov/15992684/', 'Orale B12-Therapie bei Mangel und Veganer-Supplementierung',
  'adult', 250, 2000, 'µg', 'daily', 'morning',
  'Veganer: 250–500 µg Methylcobalamin täglich oder 2000 µg wöchentlich. Bei Mangel: 1000–2000 µg/Tag.', 0);

-- Vitamin A (id=32)
INSERT OR IGNORE INTO dosage_guidelines (ingredient_id, source, source_url, source_title, population, dose_min, dose_max, unit, frequency, timing, notes, is_default) VALUES
(32, 'DGE', 'https://www.dge.de/wissenschaft/referenzwerte/vitamin-a/', 'DGE Referenzwerte Vitamin A, 2015',
  'adult_male', 850, 850, 'µg RAE', 'daily', 'with_meal',
  'DGE-Empfehlung für Männer ab 19 Jahren: 850 µg Retinoläquivalente (RAE) täglich', 1),
(32, 'DGE', 'https://www.dge.de/wissenschaft/referenzwerte/vitamin-a/', 'DGE Referenzwerte Vitamin A, 2015',
  'adult_female', 700, 700, 'µg RAE', 'daily', 'with_meal',
  'DGE-Empfehlung für Frauen ab 19 Jahren: 700 µg Retinoläquivalente (RAE) täglich; erhöhter Bedarf in Schwangerschaft (800 µg) und Stillzeit (1300 µg)', 1),
(32, 'study', 'https://doi.org/10.1093/ajcn/nqaa059', 'Tanumihardjo et al., 2020, American Journal of Clinical Nutrition',
  'adult', 500, 1000, 'µg RAE', 'daily', 'with_meal',
  'Studienbasierte Schätzung des tatsächlichen Bedarfs bei Erwachsenen unter Berücksichtigung von Bioverfügbarkeit und Konversionsrate pflanzlicher Quellen', 0);

-- Vitamin K1 (id=33)
INSERT OR IGNORE INTO dosage_guidelines (ingredient_id, source, source_url, source_title, population, dose_min, dose_max, unit, frequency, timing, notes, is_default) VALUES
(33, 'DGE', 'https://www.dge.de/wissenschaft/referenzwerte/vitamin-k/', 'DGE Referenzwerte Vitamin K, 2018',
  'adult_male', 70, 70, 'µg', 'daily', 'with_meal',
  'DGE-Schätzwert für Männer ab 19 Jahren: 70 µg Vitamin K täglich', 1),
(33, 'DGE', 'https://www.dge.de/wissenschaft/referenzwerte/vitamin-k/', 'DGE Referenzwerte Vitamin K, 2018',
  'adult_female', 60, 60, 'µg', 'daily', 'with_meal',
  'DGE-Schätzwert für Frauen ab 19 Jahren: 60 µg Vitamin K täglich', 1),
(33, 'study', 'https://doi.org/10.3945/ajcn.2008.26483', 'Booth et al., 2009, American Journal of Clinical Nutrition',
  'adult', 100, 300, 'µg', 'daily', 'with_meal',
  'Für optimale Carboxylierung von Gerinnungs- und Knochenproteinen werden 100–300 µg K1/Tag diskutiert', 0);

-- Vitamin E (id=34)
INSERT OR IGNORE INTO dosage_guidelines (ingredient_id, source, source_url, source_title, population, dose_min, dose_max, unit, frequency, timing, notes, is_default) VALUES
(34, 'DGE', 'https://www.dge.de/wissenschaft/referenzwerte/vitamin-e/', 'DGE Referenzwerte Vitamin E, 2015',
  'adult_male', 12, 15, 'mg', 'daily', 'with_meal',
  'DGE-Schätzwert für Männer: 12–15 mg α-Tocopherol-Äquivalente täglich', 1),
(34, 'DGE', 'https://www.dge.de/wissenschaft/referenzwerte/vitamin-e/', 'DGE Referenzwerte Vitamin E, 2015',
  'adult_female', 11, 12, 'mg', 'daily', 'with_meal',
  'DGE-Schätzwert für Frauen: 11–12 mg α-Tocopherol-Äquivalente täglich', 1),
(34, 'study', 'https://doi.org/10.7326/0003-4819-142-1-200501040-00110', 'Miller et al., 2005, Annals of Internal Medicine – Meta-Analyse Hochdosis Vitamin E',
  'adult', 67, 200, 'mg', 'daily', 'with_meal',
  'Dosen >400 IU/Tag mit erhöhter Gesamtmortalität assoziiert. Moderate Dosen von 67–200 mg/Tag (100–300 IU) empfohlen.', 0);

-- Vitamin B1 (id=35)
INSERT OR IGNORE INTO dosage_guidelines (ingredient_id, source, source_url, source_title, population, dose_min, dose_max, unit, frequency, timing, notes, is_default) VALUES
(35, 'DGE', 'https://www.dge.de/wissenschaft/referenzwerte/thiamin/', 'Referenzwerte für die Nährstoffzufuhr – Thiamin',
  'adult_male', 1.2, 1.3, 'mg', 'daily', 'with_meal',
  'Männer 19–65 Jahre: 1,3 mg/Tag', 1),
(35, 'DGE', 'https://www.dge.de/wissenschaft/referenzwerte/thiamin/', 'Referenzwerte für die Nährstoffzufuhr – Thiamin',
  'adult_female', 1.0, 1.1, 'mg', 'daily', 'with_meal',
  'Frauen 19–65 Jahre: 1,0 mg/Tag; Schwangerschaft: 1,2 mg/Tag; Stillzeit: 1,4 mg/Tag', 0);

-- Vitamin B2 (id=36)
INSERT OR IGNORE INTO dosage_guidelines (ingredient_id, source, source_url, source_title, population, dose_min, dose_max, unit, frequency, timing, notes, is_default) VALUES
(36, 'DGE', 'https://www.dge.de/wissenschaft/referenzwerte/riboflavin/', 'Referenzwerte für die Nährstoffzufuhr – Riboflavin',
  'adult_male', 1.4, 1.4, 'mg', 'daily', 'with_meal',
  'Männer 19–65 Jahre: 1,4 mg/Tag', 1),
(36, 'DGE', 'https://www.dge.de/wissenschaft/referenzwerte/riboflavin/', 'Referenzwerte für die Nährstoffzufuhr – Riboflavin',
  'adult_female', 1.1, 1.1, 'mg', 'daily', 'with_meal',
  'Frauen 19–65 Jahre: 1,1 mg/Tag; Schwangerschaft: 1,3 mg/Tag; Stillzeit: 1,4 mg/Tag', 0),
(36, 'study', 'https://pubmed.ncbi.nlm.nih.gov/9237374/', 'Schoenen et al., 1998 – Riboflavin 400 mg/Tag zur Migräneprophylaxe',
  'adult', 400, 400, 'mg', 'daily', 'with_meal',
  'Hochdosiertes Riboflavin (400 mg/Tag) zeigte in RCTs signifikante Reduktion der Migränehäufigkeit.', 0);

-- Vitamin B3 (id=37)
INSERT OR IGNORE INTO dosage_guidelines (ingredient_id, source, source_url, source_title, population, dose_min, dose_max, unit, frequency, timing, notes, is_default) VALUES
(37, 'DGE', 'https://www.dge.de/wissenschaft/referenzwerte/niacin/', 'Referenzwerte für die Nährstoffzufuhr – Niacin',
  'adult_male', 15, 16, 'mg', 'daily', 'with_meal',
  'Männer 19–65 Jahre: 15–16 mg NE/Tag (Niacin-Äquivalente)', 1),
(37, 'DGE', 'https://www.dge.de/wissenschaft/referenzwerte/niacin/', 'Referenzwerte für die Nährstoffzufuhr – Niacin',
  'adult_female', 11, 13, 'mg', 'daily', 'with_meal',
  'Frauen 19–65 Jahre: 11–13 mg NE/Tag', 0),
(37, 'study', 'https://pubmed.ncbi.nlm.nih.gov/34883140/', 'NR augments NAD+ metabolome in skeletal muscle',
  'adult', 250, 500, 'mg', 'daily', 'morning',
  'NR 250–500 mg/Tag erhöht NAD+-Spiegel signifikant. Gut verträglich bis 2000 mg/Tag.', 0);

-- Vitamin B5 (id=38)
INSERT OR IGNORE INTO dosage_guidelines (ingredient_id, source, source_url, source_title, population, dose_min, dose_max, unit, frequency, timing, notes, is_default) VALUES
(38, 'DGE', 'https://www.dge.de/wissenschaft/referenzwerte/pantothensaeure/', 'Referenzwerte für die Nährstoffzufuhr – Pantothensäure',
  'adult', 6, 6, 'mg', 'daily', 'with_meal',
  'Schätzwert für angemessene Zufuhr. Erwachsene: 6 mg/Tag.', 1);

-- Vitamin B6 (id=39)
INSERT OR IGNORE INTO dosage_guidelines (ingredient_id, source, source_url, source_title, population, dose_min, dose_max, unit, frequency, timing, notes, is_default) VALUES
(39, 'DGE', 'https://www.dge.de/wissenschaft/referenzwerte/vitamin-b6/', 'Referenzwerte für die Nährstoffzufuhr – Vitamin B6',
  'adult_male', 1.4, 1.6, 'mg', 'daily', 'with_meal',
  'Männer 19–65 Jahre: 1,6 mg/Tag. Bedarf steigt mit erhöhter Proteinzufuhr.', 1),
(39, 'DGE', 'https://www.dge.de/wissenschaft/referenzwerte/vitamin-b6/', 'Referenzwerte für die Nährstoffzufuhr – Vitamin B6',
  'adult_female', 1.2, 1.4, 'mg', 'daily', 'with_meal',
  'Frauen 19–65 Jahre: 1,4 mg/Tag; Schwangerschaft: 1,8 mg/Tag; Stillzeit: 1,6 mg/Tag', 0);

-- Vitamin B7 (id=40)
INSERT OR IGNORE INTO dosage_guidelines (ingredient_id, source, source_url, source_title, population, dose_min, dose_max, unit, frequency, timing, notes, is_default) VALUES
(40, 'DGE', 'https://www.dge.de/wissenschaft/referenzwerte/biotin/', 'Referenzwerte für die Nährstoffzufuhr – Biotin',
  'adult', 40, 40, 'µg', 'daily', 'with_meal',
  'Schätzwert für angemessene Zufuhr. Erwachsene: 40 µg/Tag.', 1),
(40, 'study', 'https://pubmed.ncbi.nlm.nih.gov/28879475/', 'Hochdosiertes Biotin bei Haarausfall und Nagelbrüchigkeit',
  'adult', 2500, 5000, 'µg', 'daily', 'with_meal',
  '2500–5000 µg/Tag in Studien zu Haarausfall. Bei >5000 µg/Tag: Laborwert-Interferenzen beachten.', 0);

-- Vitamin B9 (id=41)
INSERT OR IGNORE INTO dosage_guidelines (ingredient_id, source, source_url, source_title, population, dose_min, dose_max, unit, frequency, timing, notes, is_default) VALUES
(41, 'DGE', 'https://www.dge.de/wissenschaft/referenzwerte/folat/', 'Referenzwerte für die Nährstoffzufuhr – Folat',
  'adult', 300, 300, 'µg', 'daily', 'morning',
  'Erwachsene: 300 µg DFE/Tag. Schwangerschaft: 550 µg DFE/Tag; mind. 4 Wochen vor Konzeption: +400 µg Folsäure/Tag.', 1),
(41, 'study', 'https://pubmed.ncbi.nlm.nih.gov/21544854/', 'L-methylfolate bei MTHFR-Variante und Depression',
  'adult', 400, 800, 'µg', 'daily', 'morning',
  'L-Methylfolat 400–800 µg/Tag bei MTHFR-Variante. Psychiatrische Indikationen: bis 15 mg/Tag.', 0);

-- =========================================================================
-- STEP 6: Interactions
-- =========================================================================
-- ID reference:
--   1=Vitamin D3   2=Vitamin K2   3=Magnesium    5=Vitamin C
--   9=Kalium      11=Zink        14=Vitamin B12  16=Selen
--  32=Vitamin A   33=Vitamin K1  34=Vitamin E    35=Vitamin B1
--  36=Vitamin B2  37=Vitamin B3  38=Vitamin B5   39=Vitamin B6
--  40=Vitamin B7  41=Vitamin B9

-- Vitamin D3 (1) ↔ Vitamin K2 (2): synergy
-- (already inserted in 0005 as 2↔1; use lower-id-first convention consistently)
INSERT OR IGNORE INTO interactions (ingredient_a_id, ingredient_b_id, type, comment, severity, mechanism, source_url) VALUES
(1, 2, 'synergy',
  'D3 steigert Calciumabsorption; K2 aktiviert Osteocalcin und MGP, die Calcium in Knochen einlagern und Gefäßverkalkung verhindern. Bei >2000 IU D3 ist K2 empfohlen.',
  'medium',
  'D3 stimuliert Osteocalcin-Synthese; K2 carboxyliert und aktiviert Osteocalcin und MGP. Synergistische Kombination besonders bei höheren D3-Dosen (>2000 IU) zur Vermeidung ektoper Calciumablagerungen.',
  'https://doi.org/10.3945/ajcn.2010.30052');

-- Vitamin D3 (1) ↔ Magnesium (3): synergy
INSERT OR IGNORE INTO interactions (ingredient_a_id, ingredient_b_id, type, comment, severity, mechanism, source_url) VALUES
(1, 3, 'synergy',
  'Magnesium ist Cofaktor für alle Enzyme der Vitamin-D-Aktivierung. Magnesiummangel kann die D3-zu-Calcitriol-Konversion hemmen.',
  'medium',
  'Magnesium-abhängige Hydroxylierungsenzyme (25-Hydroxylase, 1α-Hydroxylase) aktivieren inaktives D3 zu Calcitriol. Ohne ausreichend Magnesium bleibt D3-Supplementierung weniger effektiv.',
  'https://doi.org/10.1186/s12937-018-0384-3');

-- Vitamin D3 (1) ↔ Vitamin A (32): caution
INSERT OR IGNORE INTO interactions (ingredient_a_id, ingredient_b_id, type, comment, severity, mechanism, source_url) VALUES
(1, 32, 'caution',
  'Sehr hohe Vitamin-A-Spiegel (>3000 µg RAE) können über RXR-Kompetition die protektiven Knocheneffekte von D3 abschwächen. Nicht gemeinsam hochdosieren.',
  'medium',
  'Vitamin A und D3 interagieren auf Ebene des Retinoid-X-Rezeptors (RXR): RXR ist Bindungspartner für den Vitamin-D-Rezeptor (VDR). Sehr hohe Vitamin-A-Spiegel können Vitamin-D-Signalwege antagonisieren.',
  NULL);

-- Vitamin K2 (2) ↔ Vitamin A (32): synergy (via K1/D3 shared pathway – all fat-soluble trio)
-- Note: JSON lists this as Vitamin A ↔ K2 synergy
INSERT OR IGNORE INTO interactions (ingredient_a_id, ingredient_b_id, type, comment, severity, mechanism, source_url) VALUES
(2, 32, 'synergy',
  'Alle drei fettlöslichen Vitamine A, D und K wirken synergistisch beim Calciumstoffwechsel und der Knochengesundheit.',
  'low',
  'Vitamin A, D und K kooperieren über nukleäre Rezeptoren (RXR, VDR, NKR) bei der Regulation von Knochen-Gla-Proteinen und Calciumhomöostase.',
  NULL);

-- Vitamin K1 (33) ↔ Vitamin E (34): caution
INSERT OR IGNORE INTO interactions (ingredient_a_id, ingredient_b_id, type, comment, severity, mechanism, source_url) VALUES
(33, 34, 'caution',
  'Hochdosiertes Vitamin E (>800 mg) kann Vitamin-K-abhängige Gerinnungsfaktoren reduzieren. Bei normalen Supplementierungsdosen klinisch wenig bedeutsam.',
  'medium',
  'Hochdosiertes α-Tocopherol (>800 mg) hemmt Vitamin-K-abhängige Carboxylase und Prothrombinsynthese. Relevant bei gleichzeitiger Antikoagulantientherapie.',
  'https://doi.org/10.1093/ajcn/65.4.1166');

-- Vitamin E (34) ↔ Vitamin C (5): synergy
INSERT OR IGNORE INTO interactions (ingredient_a_id, ingredient_b_id, type, comment, severity, mechanism, source_url) VALUES
(5, 34, 'synergy',
  'Vitamin C regeneriert oxidiertes Vitamin E zurück zur aktiven Form. Synergistische antioxidative Wirkung im wässrigen und lipophilen Kompartiment.',
  'low',
  'Ascorbat reduziert Tocopheroxylradikal zurück zu α-Tocopherol. Komplementäre antioxidative Wirkung: Vitamin C im wässrigen, Vitamin E im lipophilen Membrankompartiment.',
  NULL);

-- Vitamin E (34) ↔ Selen (16): synergy
INSERT OR IGNORE INTO interactions (ingredient_a_id, ingredient_b_id, type, comment, severity, mechanism, source_url) VALUES
(16, 34, 'synergy',
  'Selen (als Glutathionperoxidase-Cofaktor) und Vitamin E wirken synergistisch im antioxidativen Schutzsystem.',
  'low',
  'Selenhaltige Glutathionperoxidase und Vitamin E schützen Zellmembranen vor Lipidperoxidation über unterschiedliche, komplementäre Mechanismen.',
  NULL);

-- Vitamin A (32) ↔ Zink (11): synergy
INSERT OR IGNORE INTO interactions (ingredient_a_id, ingredient_b_id, type, comment, severity, mechanism, source_url) VALUES
(11, 32, 'synergy',
  'Zink ist essenziell für die Synthese des Retinol-bindenden Proteins (RBP). Zinkmangel kann zu funktionellem Vitamin-A-Mangel führen, da Transport und Mobilisierung aus der Leber gestört sind.',
  'medium',
  'Zink ist Cofaktor der Retinol-Dehydrogenase und essentiell für RBP-Synthese in der Leber. Ohne ausreichend Zink wird Vitamin A nicht effizient aus Leberreserven mobilisiert.',
  NULL);

-- Vitamin A (32) ↔ Vitamin E (34): synergy
INSERT OR IGNORE INTO interactions (ingredient_a_id, ingredient_b_id, type, comment, severity, mechanism, source_url) VALUES
(32, 34, 'synergy',
  'Vitamin E schützt Vitamin A vor oxidativer Zerstörung im Darm und im Gewebe.',
  'low',
  'α-Tocopherol verhindert Oxidation von Retinol und β-Carotin im intestinalen Lumen und in Speichergeweben. Komplementäre Schutzwirkung für fettlösliche Vitamine.',
  NULL);

-- Vitamin B6 (39) ↔ Vitamin B9 (41): synergy
INSERT OR IGNORE INTO interactions (ingredient_a_id, ingredient_b_id, type, comment, severity, mechanism, source_url) VALUES
(39, 41, 'synergy',
  'B6, B9 und B12 wirken synergistisch zur Homocysteinsenkung. Kombination der drei B-Vitamine empfohlen bei erhöhtem Homocysteinspiegel.',
  'medium',
  'B6 (als P5P) ist Coenzym der Cystathionin-β-Synthase (Transsulfurierung); B9 und B12 steuern die Remethylierung. Alle drei Vitamine gemeinsam sind nötig für vollständige Homocysteinregulation.',
  NULL);

-- Vitamin B6 (39) ↔ Vitamin B12 (14): synergy
INSERT OR IGNORE INTO interactions (ingredient_a_id, ingredient_b_id, type, comment, severity, mechanism, source_url) VALUES
(14, 39, 'synergy',
  'B6, B9 und B12 wirken synergistisch zur Homocysteinsenkung.',
  'medium',
  'B12 (als Methylcobalamin) aktiviert Methionin-Synthase für Homocystein-Remethylierung; B6 steuert Transsulfurierungsweg. Kombination für vollständige Homocystein-Senkung notwendig.',
  NULL);

-- Vitamin B9 (41) ↔ Vitamin B12 (14): synergy/caution
INSERT OR IGNORE INTO interactions (ingredient_a_id, ingredient_b_id, type, comment, severity, mechanism, source_url) VALUES
(14, 41, 'caution',
  'Hohe Folsäuredosen können megaloblastäre Anämie bei B12-Mangel normalisieren und so den B12-Mangel maskieren, während neurologische Schäden (funikuläre Myelose) fortschreiten. B12-Status immer gemeinsam prüfen.',
  'high',
  'Folat und B12 teilen den Einkohlenstoffstoffwechsel. Hohe Folatgaben kompensieren hämatologische Folsäuremangel-Zeichen, nicht aber den neurologischen B12-Mangel. B12-Spiegel vor Folat-Hochdosierung prüfen.',
  NULL);
