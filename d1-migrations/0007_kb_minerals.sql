PRAGMA foreign_keys = ON;

-- ============================================================
-- UPDATE existing mineral/trace-element ingredients (from 0003)
-- ============================================================

-- Magnesium (id=3)
UPDATE ingredients SET
  description   = 'Magnesium ist ein essenzielles Makromineral, das an über 300 enzymatischen Reaktionen im Körper beteiligt ist. Es spielt eine zentrale Rolle in der Energieproduktion (ATP-Synthese), der Proteinsynthese, der Muskelfunktion, der Nervenübertragung und der Regulierung des Blutzuckerspiegels. Magnesium ist zudem wichtig für die Knochen- und Zahnstruktur sowie für den Herzrhythmus. Ein Großteil der Bevölkerung nimmt laut Studien nicht ausreichend Magnesium über die Nahrung auf.',
  timing        = 'flexible',
  upper_limit   = 250,
  upper_limit_unit = 'mg',
  upper_limit_note = 'Der UL von 250 mg/Tag gilt ausschließlich für supplementales Magnesium (EFSA/BfR). Magnesium aus der Nahrung unterliegt keinem festgelegten UL.',
  hypo_symptoms = 'Muskelkrämpfe, Zittern, Schlafstörungen, Erschöpfung, Reizbarkeit, Herzrhythmusstörungen, Kopfschmerzen, Taubheitsgefühle, erhöhter Blutdruck, Verstopfung',
  hyper_symptoms = 'Durchfall, Übelkeit, Erbrechen (hauptsächlich durch osmotischen Effekt bei Supplementen), bei sehr hohen Dosen: Blutdruckabfall, Muskelschwäche, Atemlähmung (nur bei i.v.-Gabe oder extremer Überdosierung)',
  external_url  = 'https://www.dge.de/wissenschaft/referenzwerte/magnesium/'
WHERE id = 3;

-- Kalium (id=9)
UPDATE ingredients SET
  description   = 'Kalium ist das wichtigste intrazelluläre Kation des menschlichen Körpers. Es reguliert den Flüssigkeitshaushalt, das Säure-Basen-Gleichgewicht, die Nerven- und Muskelreizleitung sowie den Blutdruck. Kalium wirkt dem blutdruckerhöhenden Effekt von Natrium entgegen. Eine kaliumreiche Ernährung (viel Obst und Gemüse) ist mit reduziertem Schlaganfall- und Herzrisiko assoziiert.',
  timing        = 'with_meal',
  upper_limit   = 3700,
  upper_limit_unit = 'mg',
  upper_limit_note = 'EFSA Adequate Intake (AI): 3500 mg/Tag. Kein formaler UL etabliert, da Nierenfunktion überschüssiges Kalium bei gesunden Personen ausscheidet. Bei Nierenerkrankungen strenge ärztliche Kontrolle erforderlich.',
  hypo_symptoms = 'Muskelschwäche, Muskelkrämpfe, Herzrhythmusstörungen (Arrhythmien), Verstopfung, Müdigkeit, Kribbeln, erhöhter Blutdruck',
  hyper_symptoms = 'Herzrhythmusstörungen (gefährlich!), Muskelschwäche, Lähmungen, Übelkeit – Hyperkaliämie bei Niereninsuffizienz lebensbedrohlich',
  external_url  = 'https://www.dge.de/wissenschaft/referenzwerte/kalium/'
WHERE id = 9;

-- Zink (id=11)
UPDATE ingredients SET
  description   = 'Zink ist ein essenzielles Spurenelement und Kofaktor von über 300 Enzymen. Es ist entscheidend für Immunfunktion, Wundheilung, Proteinsynthese, DNA-Synthese, Zellteilung und Wachstum. Zink spielt zudem eine wichtige Rolle für Haut, Haare, Nägel, Fortpflanzungsfunktion (Testosteron) und Sinneswahrnehmung (Geschmack, Geruch). Eine leichte Unterversorgung ist weltweit verbreitet.',
  timing        = 'with_meal',
  upper_limit   = 40,
  upper_limit_unit = 'mg',
  upper_limit_note = 'EFSA/BfR UL: 40 mg/Tag für Erwachsene. Bei chronischer Einnahme >50 mg/Tag droht Kupfermangel durch kompetitive Absorption. Auf nüchternen Magen kann Zink Übelkeit und Magenreizung verursachen – stets mit Mahlzeit einnehmen.',
  hypo_symptoms = 'Beeinträchtigte Immunfunktion, Haarausfall, verzögerte Wundheilung, verminderter Geschmacks- und Geruchssinn, Wachstumsstörungen bei Kindern, Akne, brüchige Nägel, Fertilitätsprobleme',
  hyper_symptoms = 'Übelkeit, Erbrechen, Bauchschmerzen (akut bei hoher Einnahme auf nüchternen Magen), chronisch: Kupfermangel, Immunsuppression, HDL-Cholesterin-Senkung',
  external_url  = 'https://www.dge.de/wissenschaft/referenzwerte/zink/'
WHERE id = 11;

-- Selen (id=16)
UPDATE ingredients SET
  description   = 'Selen ist ein essenzielles Spurenelement und integraler Bestandteil von Selenoproteinen (Glutathionperoxidasen, Thioredoxinreduktasen, Deiodasen). Es wirkt antioxidativ, schützt Zellen vor oxidativem Stress, unterstützt die Schilddrüsenfunktion (Jodstoffwechsel), das Immunsystem und die männliche Fertilität. Selen hat ein enges therapeutisches Fenster – der Bereich zwischen Mangel und Toxizität ist vergleichsweise klein. In Deutschland ist die Selenversorgung aufgrund selenarmer Böden oft grenzwertig.',
  timing        = 'with_meal',
  upper_limit   = 300,
  upper_limit_unit = 'µg',
  upper_limit_note = 'BfR UL: 300 µg/Tag (Gesamtzufuhr). EFSA UL: 255 µg/Tag. Toxisch bei dauerhafter Überdosierung! Symptome bereits ab 400–900 µg/Tag möglich (Selenose). DGE-Referenzwert: 70 µg/Tag (Männer), 60 µg/Tag (Frauen).',
  hypo_symptoms = 'Muskelschwäche, Herzmuskelerkrankung (Keshan-Krankheit), Schilddrüsenunterfunktion, geschwächtes Immunsystem, Fruchtbarkeitsprobleme, erhöhtes Krebsrisiko (epidemiologisch)',
  hyper_symptoms = 'Selenose: Knoblauchartiger Atemgeruch, Haarausfall, brüchige Nägel, Übelkeit, Erbrechen, Nervenschäden, Müdigkeit, Hautveränderungen bei chronischer Überdosierung',
  external_url  = 'https://www.dge.de/wissenschaft/referenzwerte/selen/'
WHERE id = 16;

-- Jod (id=19)
UPDATE ingredients SET
  description   = 'Jod ist unverzichtbar für die Synthese der Schilddrüsenhormone Thyroxin (T4) und Triiodthyronin (T3), die Stoffwechsel, Wachstum, Entwicklung (besonders Gehirn) und Körpertemperatur regulieren. Deutschland gilt als Jodmangelgebiet, obwohl die Situation durch Jodsalz verbessert wurde. Kritisch: Bei bestehender Autoimmunthyreoiditis (Hashimoto) kann zu viel Jod die Erkrankung verschlimmern – ärztliche Abklärung vor Supplementierung ist essenziell.',
  timing        = 'with_meal',
  upper_limit   = 600,
  upper_limit_unit = 'µg',
  upper_limit_note = 'EFSA UL: 600 µg/Tag für Erwachsene. BfR: Supplements sollten max. 100 µg Jod/Tag liefern. Bei Hashimoto-Thyreoiditis oder Schilddrüsenerkrankungen: Supplementierung nur unter ärztlicher Aufsicht!',
  hypo_symptoms = 'Struma (Kropf), Schilddrüsenunterfunktion (Hypothyreose), Erschöpfung, Gewichtszunahme, Kältegefühl, Haarausfall, verlangsamter Herzschlag, Wachstumsstörungen, mentale Verlangsamung, bei Schwangeren: Kretinismus beim Kind',
  hyper_symptoms = 'Hyperthyreose, Hashimoto-Exazerbation, Thyreoiditis, in seltenen Fällen: Strumaentwicklung durch Wolff-Chaikoff-Effekt, Schilddrüsenüberfunktion bei vorbestehendem Knotenstruma',
  external_url  = 'https://www.dge.de/wissenschaft/referenzwerte/jod/'
WHERE id = 19;

-- ============================================================
-- INSERT new ingredients (42–49)
-- ============================================================

INSERT OR IGNORE INTO ingredients (id, name, unit, category, description, timing, upper_limit, upper_limit_unit, upper_limit_note, hypo_symptoms, hyper_symptoms, external_url) VALUES
(42, 'Calcium', 'mg', 'mineral',
 'Calcium ist das mengenmäßig häufigste Mineral im menschlichen Körper. Etwa 99 % sind in Knochen und Zähnen gespeichert. Das verbleibende 1 % erfüllt lebenswichtige Funktionen: Muskelkontraktion, Nervenübertragung, Blutgerinnung, Zellkommunikation und Enzymaktivität. Eine ausreichende Calciumversorgung in der Kindheit und im jungen Erwachsenenalter ist entscheidend für die Knochengesundheit und die Prävention von Osteoporose im Alter.',
 'with_meal', 2500, 'mg',
 'UL gilt für Gesamtcalciumzufuhr (Nahrung + Supplements). EFSA: 2500 mg/Tag für Erwachsene.',
 'Muskelkrämpfe, Tetanie, Taubheitsgefühle, Kribbeln in Händen und Füßen, Herzrhythmusstörungen, brüchige Knochen und Zähne, Osteoporose',
 'Verstopfung, Übelkeit, Nierensteine (Calciumoxalat), Weichteilverkalkungen, eingeschränkte Nierenfunktion, Hypercalcämie (bei sehr hoher Zufuhr)',
 'https://www.dge.de/wissenschaft/referenzwerte/calcium/'),

(43, 'Natrium', 'mg', 'mineral',
 'Natrium ist das wichtigste extrazelluläre Kation und unentbehrlich für die Regulierung des Flüssigkeitshaushalts, des Blutdrucks, des Säure-Basen-Gleichgewichts und der Nerven- und Muskelreizleitung. In westlichen Ernährungsweisen ist eine Unterversorgung selten – die meisten Menschen konsumieren durch verarbeitete Lebensmittel und Kochsalz deutlich zu viel Natrium.',
 'with_meal', 2300, 'mg',
 'WHO-Empfehlung: max. 2000 mg Natrium/Tag (entspricht ca. 5 g Kochsalz). DGE-Richtwert: max. 6 g Kochsalz/Tag (entspricht 2400 mg Na). Ein formaler UL ist nicht festgelegt, da Natrium nahrungsimmanent ist.',
 'Übelkeit, Kopfschmerzen, Verwirrtheit, Krämpfe, Bewusstlosigkeit (Hyponatriämie – v. a. bei übermäßiger Wasseraufnahme bei Ausdauersport), Muskelschwäche',
 'Bluthochdruck, erhöhtes Herzerkrankungs- und Schlaganfallrisiko, Wasserretention (Ödeme), erhöhte renale Calciumausscheidung (Knochenverlust)',
 'https://www.dge.de/wissenschaft/referenzwerte/natrium-chlorid-kalium/'),

(44, 'Phosphor', 'mg', 'mineral',
 'Phosphor ist nach Calcium das zweithäufigste Mineral im menschlichen Körper. Ca. 85 % befinden sich in Knochen und Zähnen (als Hydroxyapatit). Phosphor ist Bestandteil von DNA, RNA, Phospholipiden (Zellmembranen), ATP (Energieträger) und zahlreichen Enzymen. Ein Mangel ist in westlichen Ländern sehr selten, da Phosphor in nahezu allen Lebensmitteln vorkommt. Eher problematisch ist eine Überversorgung durch Phosphatzusätze in Fertigprodukten.',
 'with_meal', 4000, 'mg',
 'EFSA UL: 4000 mg/Tag für Erwachsene (inklusive Nahrungsquellen). Ältere Menschen: 3000 mg/Tag empfohlen. Chronisch hohe Zufuhr (>4000 mg) kann Calciumstoffwechsel und Knochendichte negativ beeinflussen.',
 'Muskelschwäche, Knochenschmerzen, Appetitlosigkeit, Verwirrtheit, erhöhte Infektanfälligkeit (selten, meist bei Malnutrition oder Nierenerkrankungen)',
 'Hyperphosphatämie: Calciumablagerungen in Gefäßen und Weichteilen, erhöhtes kardiovaskuläres Risiko, Störung des Calciumspiegels (Hypokalzämie), Knochenabbau',
 'https://www.dge.de/wissenschaft/referenzwerte/phosphor/'),

(45, 'Eisen', 'mg', 'trace_element',
 'Eisen ist ein essenzielles Spurenelement für den Sauerstofftransport im Blut (Hämoglobin), die Sauerstoffspeicherung in Muskeln (Myoglobin), die Energieproduktion in Mitochondrien und die DNA-Synthese. Eisenmangel ist weltweit der häufigste Nährstoffmangel. Supplementierung sollte nur bei nachgewiesenem Mangel (Ferritin, Hämoglobin, Transferrinsättigung) erfolgen, da überschüssiges Eisen oxidativen Stress fördern kann.',
 'fasting', 45, 'mg',
 'EFSA/BfR UL: 45 mg/Tag für Erwachsene (supplementales Eisen). Nur bei nachgewiesenem Mangel supplementieren. Regelmäßige Bluttests (Ferritin, CRP, Blutbild) empfohlen.',
 'Erschöpfung, Blässe, Kurzatmigkeit, Schwindel, Konzentrationsprobleme, Kopfschmerzen, Kältegefühl, spröde Nägel (Koilonychie), Restless-Legs-Syndrom, Haarausfall',
 'Übelkeit, Bauchschmerzen, Verstopfung, dunkler Stuhl (akut), chronische Überdosierung: Leberschäden, Herzschäden, erhöhtes Infektionsrisiko, oxidativer Stress',
 'https://www.dge.de/wissenschaft/referenzwerte/eisen/'),

(46, 'Kupfer', 'mg', 'trace_element',
 'Kupfer ist ein essenzielles Spurenelement und Kofaktor zahlreicher Enzyme (Cuproenzyme): Ceruloplasmin (Eisenstoffwechsel), Superoxid-Dismutase (Antioxidans), Cytochrom-c-Oxidase (Energieproduktion), Tyrosinase (Melaninsynthese), Lysyloxidase (Bindegewebsstabilität). Kupfer ist wichtig für das Immunsystem, Knochen, Nerven, Eisenstoffwechsel und die Herzgesundheit. Echte Kupfermangelzustände sind selten, aber durch exzessive Zinksupplementierung induzierbar.',
 'with_meal', 5, 'mg',
 'EFSA UL: 5 mg/Tag für Erwachsene. Kupfertoxizität möglich; genetische Kupferakkumulationserkrankungen (Morbus Wilson) kontroindizieren Supplementierung.',
 'Anämie (mikrozytär), Neutropenie, Knochenschwäche (erhöhtes Frakturrisiko), neurologische Probleme (Myelopathie), Pigmentierungsverlust, Erschöpfung (bei Zinkmangel-induziertem Kupfermangel)',
 'Übelkeit, Erbrechen, Bauchschmerzen, Leberschäden (bei genetischer Prädisposition), grünliche Verfärbung der Haut/Haare (selten), Morbus Wilson-Exazerbation',
 'https://www.dge.de/wissenschaft/referenzwerte/kupfer/'),

(47, 'Mangan', 'mg', 'trace_element',
 'Mangan ist ein essenzielles Spurenelement und Kofaktor der Mangan-Superoxiddismutase (antioxidatives Enzym in den Mitochondrien), der Arginase (Harnstoffzyklus), von Glykosidasen (Bindegewebe, Knorpel) und weiterer Enzyme des Kohlenhydrat- und Knochenstoffwechsels. Ein Mangelzustand ist bei ausgewogener Ernährung sehr selten. Überdosierung (vor allem durch Inhalation in industriellen Umgebungen) kann neurotoxisch sein.',
 'with_meal', 11, 'mg',
 'EFSA UL: 11 mg/Tag für Erwachsene. Chronische orale Überversorgung ist beim Menschen selten – ein relevantes Risiko besteht hauptsächlich bei Inhalationsexposition (Schweißen, Bergbau) mit neurotoxischen Folgen (Manganismus).',
 'Muskelschwäche, Knochenschwäche, beeinträchtigte Glukosetoleranz, abnormales Lipidprofil (selten – Mangel beim Menschen kaum nachgewiesen)',
 'Neurotoxizität (Manganismus): Parkinson-ähnliche Symptome (Tremor, Steifheit), kognitive Beeinträchtigungen, psychiatrische Symptome (vor allem bei Inhalationsexposition)',
 'https://www.dge.de/wissenschaft/referenzwerte/mangan/'),

(48, 'Chrom', 'µg', 'trace_element',
 'Chrom(III) ist ein essenzielles Spurenelement, das die Insulinwirkung verstärkt und am Kohlenhydrat-, Fett- und Proteinstoffwechsel beteiligt ist. Chrom erhöht die Insulinsensitivität der Zellen durch Interaktion mit dem Insulinrezeptor (Chromodulin-Mechanismus). Studien zeigen bescheidene Effekte auf Blutzucker und Insulinresistenz, besonders bei Diabetikern und bei Chrommangelzuständen. Die Wirkung auf sportliche Leistung oder Körperzusammensetzung bei Gesunden ist wissenschaftlich nicht eindeutig belegt.',
 'with_meal', 250, 'µg',
 'EFSA: Kein formaler UL für Chrom(III) festgelegt, da keine Toxizität bei oraler Aufnahme aus Supplements belegt. BfR empfiehlt max. 250 µg/Tag als Vorsichtsmaßnahme. Chrom(VI) ist stark kanzerogen, kommt aber nicht in Lebensmittelsupplements vor.',
 'Insulinresistenz, gestörte Glukosetoleranz, erhöhte Triglyzeride, Appetitsteigerung, Gewichtszunahme (selten, kaum klinisch dokumentierter Mangel)',
 'Bei oraler Aufnahme von Cr(III) kaum Toxizität belegt. Theoretisch: Nierenschäden bei sehr hoher Zufuhr, mögliche DNA-Schäden bei sehr hohen Dosen (in vitro).',
 'https://www.dge.de/wissenschaft/referenzwerte/chrom/'),

(49, 'Molybdän', 'µg', 'trace_element',
 'Molybdän ist ein essenzielles Spurenelement und Kofaktor von vier menschlichen Enzymen: Xanthinoxidase (Harnsäuresynthese, Purinabbau), Aldehydoxidase (Detoxifikation), Sulfit-Oxidase (Entgiftung von schwefelhaltige Verbindungen – kritisch!) und Amidoxim-reduzierendes Komponent. Besonders die Sulfit-Oxidase ist lebenswichtig – ein genetischer Defekt führt zu schwerer neurologischer Erkrankung. Ein ernährungsbedingter Mangel ist in normalen Lebensverhältnissen extrem selten.',
 'with_meal', 600, 'µg',
 'EFSA UL: 600 µg/Tag für Erwachsene. Chronisch hohe Zufuhr (>10 mg/Tag) kann Kupfermangel induzieren und Gichtanfälle auslösen (durch erhöhte Harnsäureproduktion via Xanthinoxidase).',
 'Sehr selten: Sulfitüberempfindlichkeit (Kopfschmerzen, Übelkeit), erhöhte Xanthinausscheidung im Urin, Netzhautprobleme. Genetische Molybdän-Cofaktor-Defizienz: schwere neurologische Entwicklungsstörungen',
 'Gichtartige Symptome (erhöhte Harnsäure), Kupfermangel bei sehr hoher Zufuhr, Wachstumshemmung (im Tierversuch bei extremen Dosen)',
 'https://www.dge.de/wissenschaft/referenzwerte/molybdaen/');

-- ============================================================
-- SYNONYMS
-- ============================================================

-- Magnesium (3)
INSERT OR IGNORE INTO ingredient_synonyms (ingredient_id, synonym) VALUES
(3, 'Mg'),
(3, 'Magnesiumsalz'),
(3, 'Magnesio'),
(3, 'Magnésium');

-- Kalium (9)
INSERT OR IGNORE INTO ingredient_synonyms (ingredient_id, synonym) VALUES
(9, 'K'),
(9, 'Potassium'),
(9, 'Kaliumsalz');

-- Zink (11)
INSERT OR IGNORE INTO ingredient_synonyms (ingredient_id, synonym) VALUES
(11, 'Zn'),
(11, 'Zinc'),
(11, 'Zinksalz');

-- Selen (16)
INSERT OR IGNORE INTO ingredient_synonyms (ingredient_id, synonym) VALUES
(16, 'Se'),
(16, 'Selenium'),
(16, 'Selenverbindung');

-- Jod (19)
INSERT OR IGNORE INTO ingredient_synonyms (ingredient_id, synonym) VALUES
(19, 'I'),
(19, 'Iodid'),
(19, 'Kaliumiodid'),
(19, 'Iodine'),
(19, 'Iod');

-- Calcium (42)
INSERT OR IGNORE INTO ingredient_synonyms (ingredient_id, synonym) VALUES
(42, 'Ca'),
(42, 'Calciumsalz'),
(42, 'Kalk'),
(42, 'Kalzium');

-- Natrium (43)
INSERT OR IGNORE INTO ingredient_synonyms (ingredient_id, synonym) VALUES
(43, 'Na'),
(43, 'Sodium'),
(43, 'Kochsalz (NaCl)'),
(43, 'Natriumchlorid');

-- Phosphor (44)
INSERT OR IGNORE INTO ingredient_synonyms (ingredient_id, synonym) VALUES
(44, 'P'),
(44, 'Phosphat'),
(44, 'Phosphorus');

-- Eisen (45)
INSERT OR IGNORE INTO ingredient_synonyms (ingredient_id, synonym) VALUES
(45, 'Fe'),
(45, 'Ferrum'),
(45, 'Eisensalz'),
(45, 'Iron');

-- Kupfer (46)
INSERT OR IGNORE INTO ingredient_synonyms (ingredient_id, synonym) VALUES
(46, 'Cu'),
(46, 'Cuprum'),
(46, 'Copper'),
(46, 'Kupfersalz');

-- Mangan (47)
INSERT OR IGNORE INTO ingredient_synonyms (ingredient_id, synonym) VALUES
(47, 'Mn'),
(47, 'Manganese'),
(47, 'Mangansalz');

-- Chrom (48)
INSERT OR IGNORE INTO ingredient_synonyms (ingredient_id, synonym) VALUES
(48, 'Cr'),
(48, 'Chromium'),
(48, 'Chrom-III'),
(48, 'Chrompicolinat');

-- Molybdän (49)
INSERT OR IGNORE INTO ingredient_synonyms (ingredient_id, synonym) VALUES
(49, 'Mo'),
(49, 'Molybdenum'),
(49, 'Molybdänsalz');

-- ============================================================
-- INGREDIENT FORMS
-- score: JSON 0-100 → DB 1-10 (divide by 10, rounded)
-- ============================================================

-- Magnesium forms (id=3)
-- JSON scores: 85→9, 95→10, 93→9, 80→8, 82→8, 88→9, 30→3, 40→4, 25→3, 20→2
INSERT OR IGNORE INTO ingredient_forms (ingredient_id, name, bioavailability, timing, is_recommended, score, comment) VALUES
(3, 'Magnesiumcitrat', 'high', 'morning', 1, 9,
 'Sehr gut bioverfügbar und gut löslich in Wasser. Empfehlung: Morgens einnehmen, da Citrat die Verdauung anregen kann und bei empfindlichen Personen leicht abführend wirkt. Ideal für tagsüber zur Energie- und Muskelunterstützung.'),
(3, 'Magnesiumbisglycinat', 'very_high', 'evening', 1, 10,
 'Die am besten verträgliche Form – als Chelat an Glycin gebunden. Kaum abführende Wirkung, sehr magenfreundlich. Empfehlung: Abends einnehmen, da Glycin beruhigend wirkt und die Schlafqualität fördern kann. Bestens für Personen mit empfindlichem Magen.'),
(3, 'Magnesiumglycinat', 'very_high', 'evening', 1, 9,
 'Synonymbezeichnung für Magnesiumbisglycinat. Identische Eigenschaften: hohe Bioverfügbarkeit, sehr gute Magenverträglichkeit, beruhigender Effekt durch Glycin. Abendliche Einnahme empfohlen.'),
(3, 'Magnesiummalat', 'high', 'morning', 1, 8,
 'Verbindung aus Magnesium und Äpfelsäure (Malat). Malat ist ein Zwischenprodukt des Citratzyklus und kann die Energieproduktion unterstützen. Gut geeignet für aktive Personen und bei Fibromyalgie diskutiert. Eher morgens oder tagsüber einzunehmen.'),
(3, 'Magnesiumtaurat', 'high', 'evening', 1, 8,
 'Verbindung aus Magnesium und Taurin. Taurin wirkt kardioprotektiv und beruhigend auf das Nervensystem. Besonders interessant für Herzgesundheit und Stressreduktion. Abends oder nach dem Training einzunehmen.'),
(3, 'Magnesium-L-Threonat', 'high', 'evening', 1, 9,
 'Einzige Form, die nachweislich die Blut-Hirn-Schranke überquert und den Magnesiumspiegel im Gehirn erhöht (Studienbasis: MIT, Ates et al. 2019). Eingesetzt für kognitive Funktion, Gedächtnis und neuroprotektive Effekte. Höchster Preis aller Magnesiumformen. Abends empfohlen.'),
(3, 'Magnesiumoxid', 'low', 'flexible', -1, 3,
 'Sehr hoher Magnesiumgehalt pro Gramm (ca. 60 %), aber schlechte Bioverfügbarkeit (unter 4 % laut Studien). Wird im Körper kaum aufgenommen und wirkt hauptsächlich abführend. Nicht zur Supplementierung bei Magnesiummangel empfohlen. Günstig, aber ineffektiv.'),
(3, 'Magnesiumsulfat', 'medium', 'flexible', 0, 4,
 'Bekannt als Bittersalz oder Epsom-Salz. Oral: stark abführende Wirkung, daher kaum zur oralen Supplementierung geeignet. Transdermale Anwendung (Bäder) ist populär, wissenschaftliche Evidenz für relevante Absorption durch die Haut ist jedoch begrenzt.'),
(3, 'Magnesiumcarbonat', 'low', 'with_meal', -1, 3,
 'Mäßig bioverfügbar, wird durch Magensäure erst in lösliche Formen umgewandelt. Wirkt stark antazid und kann bei regelmäßiger Einnahme die Magensäure neutralisieren. Nicht empfohlen als primäre Magnesiumquelle. Am besten mit Mahlzeiten.'),
(3, 'Magnesiumhydroxid', 'low', 'flexible', -1, 2,
 'Bekannt als Magnesia (z. B. Milk of Magnesia). Primär als Abführmittel und Antazidum eingesetzt, nicht zur Behebung eines Magnesiummangels geeignet. Geringe Bioverfügbarkeit für systemische Magnesiumversorgung.');

-- Calcium forms (id=42)
-- JSON scores: 90→9, 60→6, 55→6, 60→6, 85→9
INSERT OR IGNORE INTO ingredient_forms (ingredient_id, name, bioavailability, timing, is_recommended, score, comment) VALUES
(42, 'Calciumcitrat', 'high', 'flexible', 1, 9,
 'Beste Bioverfügbarkeit unter allen Calciumformen, besonders gut für Personen mit reduzierter Magensäureproduktion (ältere Menschen, PPI-Einnahme). Kann unabhängig von Mahlzeiten eingenommen werden.'),
(42, 'Calciumcarbonat', 'medium', 'with_meal', 0, 6,
 'Günstigste und häufigste Calciumform. Benötigt Magensäure zur Auflösung – daher zwingend mit einer Mahlzeit einzunehmen. Bei Magensäuremangel oder PPI-Einnahme deutlich schlechtere Absorption. Kann Blähungen und Verstopfung verursachen.'),
(42, 'Calciumgluconat', 'medium', 'with_meal', 0, 6,
 'Niedriger elementarer Calciumgehalt (ca. 9 %). Gut verträglich, aber es werden viele Kapseln/Tabletten benötigt. Wird oft in Brausetabletten verwendet.'),
(42, 'Calciumlactat', 'medium', 'flexible', 0, 6,
 'Besser löslich als Carbonat, etwas unabhängiger von Magensäure. Gut verträglich, mittlerer elementarer Calciumgehalt (ca. 13 %).'),
(42, 'Hydroxyapatit (MCHC)', 'high', 'with_meal', 1, 9,
 'Mikrokristalliner Hydroxyapatit aus Knochenmark. Enthält neben Calcium auch Phosphor, Kollagen und Wachstumsfaktoren. Studien zeigen gute Wirkung auf Knochendichte. Natürliche, gut bioverfügbare Form.');

-- Kalium forms (id=9)
-- JSON scores: 88→9, 70→7, 80→8, 65→7
INSERT OR IGNORE INTO ingredient_forms (ingredient_id, name, bioavailability, timing, is_recommended, score, comment) VALUES
(9, 'Kaliumcitrat', 'high', 'with_meal', 1, 9,
 'Sehr gut verträgliche und lösliche Form. Hat zusätzlich alkalisierenden Effekt auf den Harn, was Nierensteinen (Calciumoxalat) vorbeugen kann. Bevorzugte Form bei Supplementierung. Mit Mahlzeiten einnehmen.'),
(9, 'Kaliumchlorid', 'high', 'with_meal', 0, 7,
 'Gute Bioverfügbarkeit, häufig als Salzersatz verwendet. Kann in hohen Dosen Magenbeschwerden verursachen. Mit ausreichend Flüssigkeit und Mahlzeiten einnehmen.'),
(9, 'Kaliumgluconat', 'high', 'with_meal', 1, 8,
 'Gut verträglich, milde Form. Häufig in Nahrungsergänzungsmitteln verwendete Standardform. Empfohlen bei leichtem Kaliummangel.'),
(9, 'Kaliumbicarbonat', 'high', 'with_meal', 0, 7,
 'Alkalisierende Wirkung, kann Säure-Basen-Gleichgewicht positiv beeinflussen. Geeignet bei saurer Ernährung und erhöhter sportlicher Aktivität (Pufferkapazität).');

-- Natrium forms (id=43)
-- JSON scores: 50→5, 75→8, 60→6
INSERT OR IGNORE INTO ingredient_forms (ingredient_id, name, bioavailability, timing, is_recommended, score, comment) VALUES
(43, 'Natriumchlorid', 'very_high', 'with_meal', 0, 5,
 'Kochsalz – wichtigste Natriumquelle. Bei Ausdauersportlern und starkem Schwitzen als Elektrolyt sinnvoll. Für die allgemeine Bevölkerung ist eine Supplementierung kaum erforderlich, da Natrium über die Ernährung ausreichend zugeführt wird.'),
(43, 'Natriumcitrat', 'very_high', 'pre_workout', 1, 8,
 'Elektrolytform für Sportlergetränke. Wirkt als Puffer (alkalisierend) und kann die sportliche Ausdauerleistung verbessern. Magenfreundlicher als Natriumchlorid in Supplementen.'),
(43, 'Natriumbicarbonat', 'very_high', 'pre_workout', 0, 6,
 'Backpulver-Komponente. Als Ergänzung im Ausdauersport diskutiert (Pufferkapazität bei Lactatakkumulation). Kann starke Magenprobleme verursachen.');

-- Phosphor forms (id=44)
-- JSON scores: 55→6, 65→7, 60→6
INSERT OR IGNORE INTO ingredient_forms (ingredient_id, name, bioavailability, timing, is_recommended, score, comment) VALUES
(44, 'Dicalciumphosphat', 'medium', 'with_meal', 0, 6,
 'Häufig als Trägerstoff in Supplements verwendet. Enthält sowohl Calcium als auch Phosphor. Für reine Phosphorversorgung nicht optimal.'),
(44, 'Kaliumphosphat', 'high', 'with_meal', 0, 7,
 'Gut bioverfügbare Form, die gleichzeitig Kalium liefert. In medizinischen Anwendungen bei Hypophosphatämie eingesetzt.'),
(44, 'Natriumphosphat', 'high', 'with_meal', 0, 6,
 'Gut löslich und bioverfügbar. Im Sport manchmal zur kurzfristigen Leistungssteigerung diskutiert (Phosphat-Loading). Als Lebensmittelzusatz (E339) weitverbreitet.');

-- Zink forms (id=11)
-- JSON scores: 95→10, 78→8, 80→8, 55→6, 25→3, 72→7, 88→9
INSERT OR IGNORE INTO ingredient_forms (ingredient_id, name, bioavailability, timing, is_recommended, score, comment) VALUES
(11, 'Zinkbisglycinat', 'very_high', 'with_meal', 1, 10,
 'Chelat-Form mit Glycin – beste Bioverfügbarkeit und hervorragende Magenverträglichkeit. Wenig bis keine Übelkeit. Bevorzugte Form für Supplementierung. Mit kleiner Mahlzeit einnehmen.'),
(11, 'Zinkgluconat', 'high', 'with_meal', 1, 8,
 'Gut bioverfügbar, oft in Lutschtabletten gegen Erkältungen verwendet (klinische Studien vorhanden). Gute Verträglichkeit mit Mahlzeiten.'),
(11, 'Zinkcitrat', 'high', 'with_meal', 1, 8,
 'Gute Bioverfügbarkeit, gut verträgliche Form. Oft in hochwertigen Multivitaminpräparaten verwendet.'),
(11, 'Zinksulfat', 'medium', 'with_meal', 0, 6,
 'Günstig und gut untersucht, aber gastrointestinale Nebenwirkungen (Übelkeit, Magenreizung) häufiger als bei Chelatformen. Unbedingt mit Mahlzeit einnehmen.'),
(11, 'Zinkoxid', 'low', 'with_meal', -1, 3,
 'Schlechte Bioverfügbarkeit oral. Häufig in günstigen Multivitaminpräparaten. Für eine effektive Zinkversorgung nicht empfohlen. Topisch in Zinksalben gebräuchlich.'),
(11, 'Zinkacetat', 'high', 'with_meal', 0, 7,
 'Gute Bioverfügbarkeit, klinisch bei Erkältungen und Morbus Wilson eingesetzt. Verträglichkeit besser als Sulfat.'),
(11, 'Zinkmonomethionin (OptiZinc)', 'very_high', 'with_meal', 1, 9,
 'Patentierte Verbindung aus Zink und L-Methionin. Sehr hohe Bioverfügbarkeit, exzellente Verträglichkeit. Gut für Personen mit Verdauungsproblemen. Mit Mahlzeit einnehmen.');

-- Eisen forms (id=45)
-- JSON scores: 95→10, 70→7, 60→6, 55→6, 75→8
INSERT OR IGNORE INTO ingredient_forms (ingredient_id, name, bioavailability, timing, is_recommended, score, comment) VALUES
(45, 'Eisenbisglycinat', 'very_high', 'fasting', 1, 10,
 'Chelat-Form – beste Bioverfügbarkeit und beste Magenverträglichkeit aller Eisenformen. Kaum Übelkeit oder Verstopfung. Bevorzugte Form bei empfindlichem Magen. Am besten auf nüchternen Magen oder mit Vitamin-C-Quelle einnehmen.'),
(45, 'Eisenfumarat', 'high', 'fasting', 0, 7,
 'Gute Bioverfügbarkeit, günstiger als Bisglycinat. Häufig in gängigen Eisenpräparaten. Gastrointestinale Nebenwirkungen (Übelkeit, Verstopfung) häufiger als bei Chelat-Formen.'),
(45, 'Eisensulfat', 'high', 'fasting', 0, 6,
 'Am häufigsten verwendete Eisenform in pharmakologischen Präparaten. Gute Bioverfügbarkeit, aber deutlich mehr gastrointestinale Nebenwirkungen (Übelkeit, Bauchschmerzen, Verstopfung, dunkler Stuhl). Einnahme nüchtern für beste Resorption.'),
(45, 'Eisengluconat', 'medium', 'fasting', 0, 6,
 'Etwas besser verträglich als Sulfat, aber geringere Bioverfügbarkeit. Häufig in flüssigen Eisenpräparaten und bei Kindern eingesetzt.'),
(45, 'Eisen(III)-Hydroxid-Polymaltose (IPC)', 'medium', 'with_meal', 1, 8,
 'Nicht-ionische Form – kann mit oder ohne Mahlzeiten eingenommen werden, da die Resorption nahrungsunabhängig reguliert wird. Sehr gute Verträglichkeit, kaum Verfärbungen der Zähne oder Übelkeit. Etwas langsamer wirkend. Gut für Kinder und empfindliche Personen.');

-- Selen forms (id=16)
-- JSON scores: 90→9, 85→9, 55→6
INSERT OR IGNORE INTO ingredient_forms (ingredient_id, name, bioavailability, timing, is_recommended, score, comment) VALUES
(16, 'Selenomethionin', 'very_high', 'with_meal', 1, 9,
 'Organische Selenform, die wie Methionin in Körperproteine eingebaut wird. Höchste Bioverfügbarkeit (~90 %), bildet ein Selenspeicher-Reservoir im Körper. Bevorzugte Form für Langzeitsupplementierung. Mit Mahlzeiten einnehmen.'),
(16, 'Selenhefe', 'very_high', 'with_meal', 1, 9,
 'Natürliche Form – Selen ist in Hefe hauptsächlich als Selenomethionin gebunden. Gut verträglich, hohe Bioverfügbarkeit. Geeignet für Personen, die natürliche Quellen bevorzugen.'),
(16, 'Natriumselenit', 'medium', 'with_meal', 0, 6,
 'Anorganische Selenform. Geringere Bioverfügbarkeit als organische Formen, aber schneller verfügbar für Selenoenzyme. Nicht zusammen mit Vitamin C einnehmen (Bildung von elementarem Selen, das nicht resorbiert wird). Günstig und weit verbreitet in günstigen Präparaten.');

-- Jod forms (id=19)
-- JSON scores: 90→9, 85→9, 30→3
INSERT OR IGNORE INTO ingredient_forms (ingredient_id, name, bioavailability, timing, is_recommended, score, comment) VALUES
(19, 'Kaliumiodid', 'very_high', 'with_meal', 1, 9,
 'Standardform in Supplements und jodierten Lebensmitteln. Sehr gut bioverfügbar (nahezu 100 %), gut verträglich. Mit Mahlzeiten einnehmen für optimale Resorption.'),
(19, 'Natriumiodid', 'very_high', 'with_meal', 1, 9,
 'Gleich gute Bioverfügbarkeit wie Kaliumiodid. Häufig in flüssigen Supplementen und Tropfenformulierungen eingesetzt.'),
(19, 'Kelp / Meeresalgen-Jod', 'medium', 'with_meal', -1, 3,
 'Natürliche Jodquelle aus Meeresalgen, aber stark schwankende Jodkonzentration (kann von empfohlenem Wert stark abweichen). Risiko der Überdosierung und Kontaminationen (Schwermetalle, Arsen). Nicht empfohlen als kontrollierte Jodquelle.');

-- Kupfer forms (id=46)
-- JSON scores: 92→9, 80→8, 50→5
INSERT OR IGNORE INTO ingredient_forms (ingredient_id, name, bioavailability, timing, is_recommended, score, comment) VALUES
(46, 'Kupferbisglycinat', 'very_high', 'with_meal', 1, 9,
 'Chelat-Form – beste Bioverfügbarkeit, sehr gut verträglich. Bevorzugte Form für Supplementierung. Empfohlen als Begleitsubstitution bei hochdosierter Zinksupplementierung (>25 mg Zink/Tag).'),
(46, 'Kupfergluconat', 'high', 'with_meal', 1, 8,
 'Gut bioverfügbar, häufig in Multivitaminpräparaten. Gut verträglich, kostengünstiger als Chelat-Formen.'),
(46, 'Kupfersulfat', 'medium', 'with_meal', 0, 5,
 'Anorganische Form, mehr gastrointestinale Nebenwirkungen. Seltener in hochwertigen Supplements. Eher in günstigen Formulierungen.');

-- Mangan forms (id=47)
-- JSON scores: 85→9, 65→7, 55→6
INSERT OR IGNORE INTO ingredient_forms (ingredient_id, name, bioavailability, timing, is_recommended, score, comment) VALUES
(47, 'Manganbisglycinat', 'high', 'with_meal', 1, 9,
 'Chelat-Form mit bester Bioverfügbarkeit und guter Verträglichkeit. Bevorzugte Form in hochwertigen Multivitaminpräparaten.'),
(47, 'Mangancitrat', 'medium', 'with_meal', 0, 7,
 'Gute Löslichkeit, moderate Bioverfügbarkeit. Häufig in Knochenpräparaten kombiniert.'),
(47, 'Mangansulfat', 'medium', 'with_meal', 0, 6,
 'Standardform in günstigen Präparaten. Ausreichend bioverfügbar für Standarddosierungen. Gastrointestinale Verträglichkeit schlechter als Chelat-Formen.');

-- Chrom forms (id=48)
-- JSON scores: 80→8, 75→8, 25→3
INSERT OR IGNORE INTO ingredient_forms (ingredient_id, name, bioavailability, timing, is_recommended, score, comment) VALUES
(48, 'Chrompicolinat', 'high', 'with_meal', 1, 8,
 'Am häufigsten verwendete und gut untersuchte Chromform. Hohe Bioverfügbarkeit durch Picolinsäure-Komplexierung. Studien zur Insulinsensitivität und Blutzuckerstabilisierung. Mit Mahlzeiten einnehmen.'),
(48, 'Chromnicotinat', 'high', 'with_meal', 1, 8,
 'Gut bioverfügbar, weniger untersucht als Picolinat. Enthält gleichzeitig Nicotinat (Niacinform). Gut verträglich.'),
(48, 'Chromchlorid', 'low', 'with_meal', -1, 3,
 'Schlechte Bioverfügbarkeit (unter 1 %). Älteste und billigste Form. Für effektive Chromversorgung nicht geeignet.');

-- Molybdän forms (id=49)
-- JSON scores: 85→9, 65→7
INSERT OR IGNORE INTO ingredient_forms (ingredient_id, name, bioavailability, timing, is_recommended, score, comment) VALUES
(49, 'Natriummolybdat', 'very_high', 'with_meal', 1, 9,
 'Standardform in Supplements, sehr gut wasserlöslich und bioverfügbar. Gut verträglich bei empfohlenen Dosierungen. Häufig in Multivitaminpräparaten enthalten.'),
(49, 'Ammoniummolybdat', 'high', 'with_meal', 0, 7,
 'Gut bioverfügbar, aber seltener in Supplements verwendet. Eher in industriellen/landwirtschaftlichen Anwendungen.');

-- ============================================================
-- DOSAGE GUIDELINES
-- ============================================================

-- Magnesium (3)
INSERT OR IGNORE INTO dosage_guidelines (ingredient_id, source, source_url, source_title, population, dose_min, dose_max, unit, frequency, timing, notes, is_default) VALUES
(3, 'DGE', 'https://www.dge.de/wissenschaft/referenzwerte/magnesium/', 'DGE Referenzwerte für Magnesium',
 'adult_male', 350, 350, 'mg', 'daily', 'flexible',
 'Empfehlung der Deutschen Gesellschaft für Ernährung für Männer ab 25 Jahren', 1),
(3, 'DGE', 'https://www.dge.de/wissenschaft/referenzwerte/magnesium/', 'DGE Referenzwerte für Magnesium',
 'adult_female', 300, 300, 'mg', 'daily', 'flexible',
 'Empfehlung der DGE für Frauen ab 25 Jahren', 0),
(3, 'study', 'https://doi.org/10.3390/nu7010201',
 'Subclinical Magnesium Deficiency: a principal driver of cardiovascular disease and a public health crisis (DiNicolantonio et al., Nutrients 2018)',
 'adult', 300, 400, 'mg', 'daily', 'split',
 'Geteilte Einnahme (morgens und abends) empfohlen zur besseren Absorption und Minimierung gastrointestinaler Nebenwirkungen', 0),
(3, 'study', 'https://doi.org/10.1016/j.neuron.2010.09.031',
 'Enhancement of Learning and Memory by Elevating Brain Magnesium (Slutsky et al., Neuron 2010) – Basis für Mg-L-Threonat',
 'adult', 1500, 2000, 'mg', 'daily', 'evening',
 'Nur für Magnesium-L-Threonat: höhere Dosierung erforderlich aufgrund des geringeren elementaren Magnesiumanteils pro Kapsel. Entspricht ca. 144–200 mg elementarem Magnesium.', 0);

-- Calcium (42)
INSERT OR IGNORE INTO dosage_guidelines (ingredient_id, source, source_url, source_title, population, dose_min, dose_max, unit, frequency, timing, notes, is_default) VALUES
(42, 'DGE', 'https://www.dge.de/wissenschaft/referenzwerte/calcium/', 'DGE Referenzwerte für Calcium',
 'adult', 1000, 1000, 'mg', 'daily', 'with_meal',
 'Inkl. Nahrungsquellen. Supplements nur bei unzureichender Nahrungszufuhr empfohlen. Einnahme aufteilen (max. 500 mg pro Einnahme) für bessere Absorption.', 1),
(42, 'study', 'https://doi.org/10.1056/NEJMoa043220',
 'Calcium plus Vitamin D Supplementation and the Risk of Fractures (Jackson et al., NEJM 2006)',
 'adult_female', 1000, 1200, 'mg', 'daily', 'with_meal',
 'Kombination mit Vitamin D3 für optimale Knochengesundheit. Gesamtzufuhr (Nahrung + Supplement). Studie zeigte reduziertes Hüftfrakturrisiko bei postmenopausalen Frauen.', 0);

-- Kalium (9)
INSERT OR IGNORE INTO dosage_guidelines (ingredient_id, source, source_url, source_title, population, dose_min, dose_max, unit, frequency, timing, notes, is_default) VALUES
(9, 'DGE', 'https://www.dge.de/wissenschaft/referenzwerte/kalium/', 'DGE Referenzwerte für Kalium',
 'adult', 4000, 4000, 'mg', 'daily', 'with_meal',
 'Schätzwert für Erwachsene. Hauptsächlich über Nahrung (Obst, Gemüse, Hülsenfrüchte, Nüsse). Supplements in EU auf max. 1000 mg/Tagesdosis beschränkt.', 1),
(9, 'study', 'https://doi.org/10.1136/bmj.e2934',
 'Effect of increased potassium intake on cardiovascular risk factors (Aburto et al., BMJ 2013)',
 'adult', 3500, 4700, 'mg', 'daily', 'with_meal',
 'Meta-Analyse: Erhöhte Kaliumzufuhr senkt systolischen Blutdruck um ca. 3,5 mmHg und Schlaganfallrisiko. Bevorzugt über Ernährung decken.', 0);

-- Natrium (43)
INSERT OR IGNORE INTO dosage_guidelines (ingredient_id, source, source_url, source_title, population, dose_min, dose_max, unit, frequency, timing, notes, is_default) VALUES
(43, 'DGE', 'https://www.dge.de/wissenschaft/referenzwerte/natrium-chlorid-kalium/', 'DGE Referenzwerte für Natrium, Chlorid und Kalium',
 'adult', 1500, 2300, 'mg', 'daily', 'with_meal',
 'Mindestzufuhr: 1500 mg/Tag. Richtwert zur Reduzierung: max. 2300 mg/Tag. Durchschnittlicher Konsum in Deutschland liegt bei ca. 3400–4400 mg/Tag – deutlich zu hoch.', 1);

-- Phosphor (44)
INSERT OR IGNORE INTO dosage_guidelines (ingredient_id, source, source_url, source_title, population, dose_min, dose_max, unit, frequency, timing, notes, is_default) VALUES
(44, 'DGE', 'https://www.dge.de/wissenschaft/referenzwerte/phosphor/', 'DGE Referenzwerte für Phosphor',
 'adult', 700, 700, 'mg', 'daily', 'with_meal',
 'Empfehlung DGE für Erwachsene. Da Phosphor in fast allen Lebensmitteln vorkommt, ist eine Supplementierung bei ausgewogener Ernährung praktisch nie notwendig.', 1);

-- Zink (11)
INSERT OR IGNORE INTO dosage_guidelines (ingredient_id, source, source_url, source_title, population, dose_min, dose_max, unit, frequency, timing, notes, is_default) VALUES
(11, 'DGE', 'https://www.dge.de/wissenschaft/referenzwerte/zink/', 'DGE Referenzwerte für Zink',
 'adult_male', 11, 16, 'mg', 'daily', 'with_meal',
 'Je nach Phytatzufuhr (hoch bei veganer Ernährung: bis 16 mg). Mit Mahlzeiten für bessere Verträglichkeit.', 1),
(11, 'DGE', 'https://www.dge.de/wissenschaft/referenzwerte/zink/', 'DGE Referenzwerte für Zink',
 'adult_female', 7, 10, 'mg', 'daily', 'with_meal',
 'Je nach Phytatzufuhr. Veganerinnen/Vegetarierinnen eher am oberen Ende.', 0),
(11, 'study', 'https://doi.org/10.1093/advances/nmaa043',
 'Zinc and Immune Function (Wessels et al., Advances in Nutrition 2017)',
 'adult', 15, 30, 'mg', 'daily', 'with_meal',
 'Bei klinischen Zeichen von Zinkmangel oder für Immunsupport. Nicht dauerhaft >40 mg/Tag ohne ärztliche Aufsicht. Kupfersubstitution bei Langzeiteinnahme >25 mg/Tag erwägen.', 0);

-- Eisen (45)
INSERT OR IGNORE INTO dosage_guidelines (ingredient_id, source, source_url, source_title, population, dose_min, dose_max, unit, frequency, timing, notes, is_default) VALUES
(45, 'DGE', 'https://www.dge.de/wissenschaft/referenzwerte/eisen/', 'DGE Referenzwerte für Eisen',
 'adult_male', 10, 10, 'mg', 'daily', 'with_meal',
 'Empfehlungswert. Männer haben selten Eisenmangel außer bei bestimmten Erkrankungen. Supplementierung nur bei nachgewiesenem Mangel.', 1),
(45, 'DGE', 'https://www.dge.de/wissenschaft/referenzwerte/eisen/', 'DGE Referenzwerte für Eisen',
 'adult_female', 15, 15, 'mg', 'daily', 'fasting',
 'Erhöhter Bedarf durch Menstruation. Häufig wird bei Eisenmangelanämie 50–100 mg/Tag therapeutisch verordnet. Immer Ferritinwert und CRP prüfen.', 0),
(45, 'study', 'https://doi.org/10.1182/blood-2016-07-727412',
 'Iron deficiency and supplementation: evidence-based review (Tolkien et al., Blood 2015)',
 'deficient', 40, 80, 'mg', 'daily', 'fasting',
 'Bei nachgewiesenem Eisenmangel: therapeutische Dosen unter ärztlicher Aufsicht. Wechseltägige Einnahme kann gastrointestinale Verträglichkeit verbessern (Hepcidin-Mechanismus).', 0);

-- Selen (16)
INSERT OR IGNORE INTO dosage_guidelines (ingredient_id, source, source_url, source_title, population, dose_min, dose_max, unit, frequency, timing, notes, is_default) VALUES
(16, 'DGE', 'https://www.dge.de/wissenschaft/referenzwerte/selen/', 'DGE Referenzwerte für Selen',
 'adult_male', 70, 70, 'µg', 'daily', 'with_meal',
 'Referenzwert DGE für Männer. In Deutschland oft nicht aus der Nahrung allein gedeckt (selenarme Böden). Supplementierung mit 50–100 µg/Tag für Risikogruppen sinnvoll.', 1),
(16, 'DGE', 'https://www.dge.de/wissenschaft/referenzwerte/selen/', 'DGE Referenzwerte für Selen',
 'adult_female', 60, 60, 'µg', 'daily', 'with_meal',
 'Referenzwert DGE für Frauen. Bei Hashimoto-Thyreoiditis: 200 µg/Tag Selenomethionin in Studien untersucht (nur unter ärztlicher Aufsicht).', 0),
(16, 'study', 'https://doi.org/10.1016/j.thyroid.2017.11.018',
 'Selenium Supplementation in Autoimmune Thyroid Diseases (Ventura et al., Thyroid 2017)',
 'adult', 100, 200, 'µg', 'daily', 'with_meal',
 'Bei Hashimoto-Thyreoiditis: 200 µg/Tag Selenomethionin kann TPO-Antikörper senken. Nur unter Schilddrüsenarzt-Kontrolle. UL beachten! Maximal 12 Wochen ohne Laborkontrolle.', 0);

-- Jod (19)
INSERT OR IGNORE INTO dosage_guidelines (ingredient_id, source, source_url, source_title, population, dose_min, dose_max, unit, frequency, timing, notes, is_default) VALUES
(19, 'DGE', 'https://www.dge.de/wissenschaft/referenzwerte/jod/', 'DGE Referenzwerte für Jod',
 'adult', 200, 200, 'µg', 'daily', 'with_meal',
 'Empfehlung DGE für Erwachsene. Hauptquelle: jodiertes Speisesalz, Milchprodukte, Seefisch. Bei veganer Ernährung oft kritischer Nährstoff.', 1),
(19, 'study', 'https://doi.org/10.3390/nu13010013',
 'Iodine Nutrition in Germany: Iodine Supply and Risk Groups (Johner et al., Nutrients 2021)',
 'pregnant', 230, 260, 'µg', 'daily', 'with_meal',
 'Erhöhter Bedarf in Schwangerschaft und Stillzeit (bis 260 µg). Vorgeburtliche Supplements sollten Jod enthalten. WICHTIG: Bei Hashimoto erst Schilddrüsenantikörper (TPO-AK, TG-AK) und TSH bestimmen.', 0);

-- Kupfer (46)
INSERT OR IGNORE INTO dosage_guidelines (ingredient_id, source, source_url, source_title, population, dose_min, dose_max, unit, frequency, timing, notes, is_default) VALUES
(46, 'DGE', 'https://www.dge.de/wissenschaft/referenzwerte/kupfer/', 'DGE Referenzwerte für Kupfer',
 'adult', 1.0, 1.5, 'mg', 'daily', 'with_meal',
 'Schätzwert DGE für Erwachsene. Kupfer ist in Nüssen, Hülsenfrüchten, Vollkorn, Innereien reichlich enthalten. Supplementierung nur bei Mangel (z. B. durch Zinksupplementierung) erforderlich.', 1),
(46, 'study', 'https://doi.org/10.1001/archneurol.2011.206',
 'Copper Deficiency Myelopathy Secondary to Excessive Zinc Supplementation (Nations et al., Archives of Neurology 2008)',
 'adult', 1, 2, 'mg', 'daily', 'with_meal',
 'Bei hochdosierter Zinksupplementierung (>25 mg/Tag) wird 1–2 mg Kupfer/Tag als Kosubstitution empfohlen, um zinkinduzierten Kupfermangel (Myelopathie) zu vermeiden.', 0);

-- Mangan (47)
INSERT OR IGNORE INTO dosage_guidelines (ingredient_id, source, source_url, source_title, population, dose_min, dose_max, unit, frequency, timing, notes, is_default) VALUES
(47, 'DGE', 'https://www.dge.de/wissenschaft/referenzwerte/mangan/', 'DGE Referenzwerte für Mangan',
 'adult_male', 2.0, 5.0, 'mg', 'daily', 'with_meal',
 'Schätzwert DGE. Mangan ist in Vollkornprodukten, Hülsenfrüchten, Nüssen und Tee reichlich vorhanden. Supplementierung selten notwendig.', 1);

-- Chrom (48)
INSERT OR IGNORE INTO dosage_guidelines (ingredient_id, source, source_url, source_title, population, dose_min, dose_max, unit, frequency, timing, notes, is_default) VALUES
(48, 'DGE', 'https://www.dge.de/wissenschaft/referenzwerte/chrom/', 'DGE Referenzwerte für Chrom',
 'adult', 30, 100, 'µg', 'daily', 'with_meal',
 'Schätzwert DGE für eine sichere und angemessene Zufuhr. Die meisten Menschen decken ihren Bedarf über die Nahrung (Vollkorn, Fleisch, Käse, Brokkoli, Nüsse).', 1),
(48, 'study', 'https://doi.org/10.2337/diacare.27.11.2741',
 'Chromium Picolinate and Biotin Supplementation for the Treatment of Type 2 Diabetes (Albarracin et al., Diabetes Care 2008)',
 'adult', 200, 1000, 'µg', 'daily', 'with_meal',
 'Bei Typ-2-Diabetes oder Insulinresistenz: 200–1000 µg Chrompicolinat/Tag zeigte Verbesserungen der Blutzuckerkontrolle. Nur unter ärztlicher Begleitung bei bestehender Diabetes-Therapie.', 0);

-- Molybdän (49)
INSERT OR IGNORE INTO dosage_guidelines (ingredient_id, source, source_url, source_title, population, dose_min, dose_max, unit, frequency, timing, notes, is_default) VALUES
(49, 'DGE', 'https://www.dge.de/wissenschaft/referenzwerte/molybdaen/', 'DGE Referenzwerte für Molybdän',
 'adult', 50, 100, 'µg', 'daily', 'with_meal',
 'Schätzwert DGE. Molybdän ist in Hülsenfrüchten, Getreide, Nüssen und Innereien reichlich vorhanden. Ein ernährungsbedingter Mangel ist extrem selten. Supplementierung praktisch nie notwendig.', 1);

-- ============================================================
-- INTERACTIONS
-- ID map: Vitamin D3=1, Vitamin C=5, Magnesium=3, Kalium=9, Zink=11, Selen=16, Jod=19
--         Calcium=42, Natrium=43, Phosphor=44, Eisen=45, Kupfer=46, Mangan=47, Chrom=48, Molybdän=49
-- SKIP interactions with unknown partners (drugs, foods, etc.)
-- ============================================================

-- Magnesium (3) interactions
-- Vitamin D → id=1, Calcium → id=42, Zink → id=11
-- SKIP: Antibiotika (drug), PPIs (drug)
INSERT OR IGNORE INTO interactions (ingredient_a_id, ingredient_b_id, type, comment, severity, mechanism) VALUES
(3, 1, 'synergy',
 'Magnesium ist essenziell für die Aktivierung von Vitamin D. Ohne ausreichend Magnesium kann Vitamin D nicht in seine aktive Form (Calcitriol) umgewandelt werden. Gleichzeitige Einnahme sinnvoll.',
 'medium',
 'Magnesium-abhängige Enzyme aktivieren 25(OH)D zu 1,25(OH)2D (Calcitriol)'),
(3, 42, 'caution',
 'Calcium und Magnesium konkurrieren um den gleichen Transportmechanismus im Darm. Verhältnis Ca:Mg sollte idealerweise 2:1 nicht überschreiten. Zeitlich getrennte Einnahme (mind. 2 Stunden Abstand) empfohlen.',
 'medium',
 'Kompetitive Absorption über TRPM7-Kanäle und divalente Metalltransporter im Dünndarm'),
(3, 11, 'caution',
 'Hochdosiertes Zink (>142 mg/Tag) kann die Magnesiumabsorption beeinträchtigen. Bei üblichen Supplementierungsdosen kein relevantes Problem.',
 'low',
 'Kompetition um divalente Metalltransporter (DMT1) bei sehr hohen Zinkdosen');

-- Calcium (42) interactions
-- Magnesium → id=3, Eisen → id=45, Vitamin D → id=1, Zink → id=11
INSERT OR IGNORE INTO interactions (ingredient_a_id, ingredient_b_id, type, comment, severity, mechanism) VALUES
(42, 3, 'caution',
 'Kompetitive Absorption: Ca und Mg teilen die gleichen Transporter. Verhältnis Ca:Mg von 2:1 wird empfohlen. Zeitlich getrennte Einnahme optimiert die Absorption beider Mineralien.',
 'medium',
 'TRPM7 und weitere divalente Metallionentransporter im Dünndarm'),
(42, 45, 'caution',
 'Calcium hemmt die Eisenabsorption. Calcium-Supplements und Eisenpräparate nicht gleichzeitig einnehmen. Mind. 2 Stunden Abstand einhalten.',
 'medium',
 'Calcium hemmt sowohl häm- als auch nicht-häm-Eisentransport im Duodenum'),
(42, 1, 'synergy',
 'Vitamin D ist essenziell für die intestinale Calciumabsorption. Ohne ausreichend Vitamin D wird nur 10–15 % des Calciums aus der Nahrung aufgenommen (mit Vitamin D bis zu 40 %).',
 'medium',
 '1,25(OH)2D3 induziert Calbindin-Synthese und stimuliert aktiven Ca-Transport im Duodenum'),
(42, 11, 'caution',
 'Hohe Calciummengen können die Zinkabsorption beeinträchtigen. Zeitlich getrennte Einnahme empfohlen.',
 'low',
 'Kompetition um divalente Metalltransporter');

-- Kalium (9) interactions
-- Natrium → id=43, Magnesium → id=3
-- SKIP: ACE-Hemmer / Kaliumsparende Diuretika (drugs)
INSERT OR IGNORE INTO interactions (ingredient_a_id, ingredient_b_id, type, comment, severity, mechanism) VALUES
(9, 43, 'caution',
 'Kalium und Natrium wirken entgegengesetzt auf den Blutdruck. Kaliumreiche Ernährung gleicht die blutdruckerhöhende Wirkung von Natrium aus. Optimales Verhältnis Na:K sollte unter 1 liegen.',
 'medium',
 'Na/K-ATPase reguliert intrazelluläre Konzentrationen; Kalium fördert renale Natriumausscheidung'),
(9, 3, 'synergy',
 'Magnesiummangel kann Kaliummangel begünstigen, da Magnesium für die Na/K-ATPase und renale Kaliumretention notwendig ist. Bei Hypokaliämie immer auch Magnesiumstatus prüfen.',
 'medium',
 'Magnesium aktiviert Na/K-ATPase und reguliert renal-tubuläre Kaliumsekretion');

-- Natrium (43) interactions
-- Kalium → id=9, Calcium → id=42
INSERT OR IGNORE INTO interactions (ingredient_a_id, ingredient_b_id, type, comment, severity, mechanism) VALUES
(43, 9, 'caution',
 'Natrium und Kalium stehen in einem direkten Gleichgewichtsverhältnis. Zu viel Natrium erhöht den Blutdruck, ausreichend Kalium wirkt gegenregulatorisch. Eine ausgewogene Balance ist entscheidend für kardiovaskuläre Gesundheit.',
 'medium',
 'Na/K-ATPase; renale Regulierung über Aldosteron'),
(43, 42, 'caution',
 'Hohe Natriumzufuhr erhöht die renale Calciumausscheidung und kann langfristig die Knochendichte beeinträchtigen.',
 'low',
 'Konkurrierende Reabsorption von Na und Ca im renalen Tubulus');

-- Phosphor (44) interactions
-- Calcium → id=42, Vitamin D → id=1, Zink → id=11
INSERT OR IGNORE INTO interactions (ingredient_a_id, ingredient_b_id, type, comment, severity, mechanism) VALUES
(44, 42, 'caution',
 'Ein ungünstiges Ca:P-Verhältnis (zu viel Phosphor, zu wenig Calcium) kann den Knochenabbau fördern. Das optimale Verhältnis Ca:P liegt bei ca. 1:1 bis 2:1.',
 'medium',
 'Phosphat bindet Calcium und kann Calcitriol-Spiegel sowie Parathormon beeinflussen'),
(44, 1, 'synergy',
 'Vitamin D reguliert die intestinale Phosphatresorption und die renale Phosphatausscheidung. Vitamin-D-Mangel kann zu Phosphatretention und -imbalancen führen.',
 'medium',
 '1,25(OH)2D3 stimuliert NaPi-IIb-Transporter im Dünndarm'),
(44, 11, 'caution',
 'Hohe Phosphatzufuhr kann die Zinkabsorption durch Bildung unlöslicher Zink-Phytat-Phosphat-Komplexe beeinträchtigen.',
 'low',
 'Bildung unlöslicher Chelatkomplexe im GI-Trakt');

-- Zink (11) interactions
-- Kupfer → id=46, Eisen → id=45, Calcium → id=42
-- SKIP: Folsäure (hochdosiert) – not in our DB
INSERT OR IGNORE INTO interactions (ingredient_a_id, ingredient_b_id, type, comment, severity, mechanism, source_url) VALUES
(11, 46, 'avoid',
 'Langfristige Zinkeinnahme >50 mg/Tag kann zu schwerem Kupfermangel führen (Metallothionein-Mechanismus). Bei dauerhafter Einnahme über 25–30 mg/Tag Kupfer (1–2 mg/Tag) gleichzeitig supplementieren. UL: 40 mg/Tag.',
 'high',
 'Zink induziert intestinales Metallothionein, das Kupfer bindet und dessen Resorption hemmt',
 'https://doi.org/10.1001/archneurol.2011.206');

INSERT OR IGNORE INTO interactions (ingredient_a_id, ingredient_b_id, type, comment, severity, mechanism) VALUES
(11, 45, 'caution',
 'Hohe Eisendosen können die Zinkabsorption hemmen und umgekehrt. Nicht gleichzeitig auf nüchternen Magen einnehmen. Mit Mahlzeiten zeitlich trennen.',
 'medium',
 'Kompetition über DMT1 (Divalent Metal Transporter 1)'),
(11, 42, 'caution',
 'Hohe Calciumdosen können Zinkabsorption beeinträchtigen. Bei gleichzeitiger Einnahme 1–2 Stunden Abstand einhalten.',
 'low',
 'Kompetitive Absorption im Dünndarm');

-- Eisen (45) interactions
-- Vitamin C → id=5, Calcium → id=42, Zink → id=11
-- SKIP: Kaffee und Tee (food), Antazida / PPI (drugs)
INSERT OR IGNORE INTO interactions (ingredient_a_id, ingredient_b_id, type, comment, severity, mechanism) VALUES
(45, 5, 'synergy',
 'Vitamin C (Ascorbinsäure) erhöht die Absorption von Nicht-Häm-Eisen erheblich (2–3-fach) durch Reduktion von Fe³⁺ zu Fe²⁺ und Bildung löslicher Chelate. Gleichzeitige Einnahme empfohlen.',
 'medium',
 'Reduktion von Fe³⁺ zu besser löslichem Fe²⁺; Bildung von Ascorbat-Eisen-Chelaten verhindert Fällung im alkalischen Dünndarm'),
(45, 42, 'caution',
 'Calcium (sowohl aus Milch als auch Supplements) hemmt die Eisenabsorption. Milch, Käse oder Calciumsupplements nicht gleichzeitig mit Eisen einnehmen. Mind. 2 Stunden Abstand.',
 'medium',
 'Calcium hemmt sowohl häm- als auch nicht-häm-Eisen-Transport im Duodenum, vermutlich über gemeinsame Transportproteine'),
(45, 11, 'caution',
 'Hochdosiertes Eisen hemmt die Zinkabsorption und umgekehrt. Nicht gleichzeitig auf nüchternen Magen. Mit Mahlzeiten zeitlich trennen.',
 'medium',
 'Kompetition über DMT1-Transporter');

-- Selen (16) interactions
-- Jod → id=19, Vitamin C → id=5
-- SKIP: Schwermetalle (not in our DB)
INSERT OR IGNORE INTO interactions (ingredient_a_id, ingredient_b_id, type, comment, severity, mechanism) VALUES
(16, 19, 'synergy',
 'Selen und Jod arbeiten synergistisch in der Schilddrüse. Selenoproteine (Deiodasen) aktivieren Schilddrüsenhormone (T4 → T3). Bei Jodmangel können Selen-Supplements die Schilddrüsenfunktion beeinträchtigen. Beide sollten ausreichend vorhanden sein.',
 'medium',
 'Selenabhängige Deiodasen (Typ I, II, III) konvertieren Thyroxin (T4) in aktives Triiodthyronin (T3)'),
(16, 5, 'caution',
 'Vitamin C kann die Absorption von anorganischem Selen (Natriumselenit) durch Reduktion zu elementarem Selen hemmen. Kein Problem mit organischem Selenomethionin. Natriumselenit nicht gleichzeitig mit Vitamin-C-Präparaten einnehmen.',
 'medium',
 'Ascorbat reduziert Selenit (Se⁴⁺) zu elementarem Selen (Se⁰), das im GI-Trakt nicht resorbiert wird');

-- Jod (19) interactions
-- Selen → id=16
-- SKIP: Goitrogene Lebensmittel (food), Amiodarone (drug)
INSERT OR IGNORE INTO interactions (ingredient_a_id, ingredient_b_id, type, comment, severity, mechanism) VALUES
(19, 16, 'synergy',
 'Selen ist für die enzymatische Aktivierung und Inaktivierung von Schilddrüsenhormonen essenziell. Jod und Selen sollten beide ausreichend vorhanden sein. Selen schützt zudem die Schilddrüse vor oxidativem Schaden durch H₂O₂ bei der Jodumsetzung.',
 'medium',
 'Selenabhängige Deiodasen und Glutathionperoxidasen schützen Schilddrüsengewebe');

-- Kupfer (46) interactions
-- Zink → id=11, Vitamin C → id=5
INSERT OR IGNORE INTO interactions (ingredient_a_id, ingredient_b_id, type, comment, severity, mechanism) VALUES
(46, 11, 'avoid',
 'Klassischer Antagonismus: Hochdosiertes Zink (>50 mg/Tag) kann zu schwerem Kupfermangel führen. Bei dauerhafter Zinkeinnahme über 25 mg/Tag empfiehlt sich gleichzeitig 1–2 mg Kupfer. Umgekehrt: zu viel Kupfer kann Zink-Status beeinflussen.',
 'high',
 'Zink induziert intestinales Metallothionein, das Kupfer abfängt und dessen Absorption hemmt'),
(46, 5, 'caution',
 'Sehr hohe Vitamin-C-Dosen (>1500 mg/Tag) können die Kupferaufnahme leicht beeinträchtigen. Bei üblichen Supplementierungsdosen nicht relevant.',
 'low',
 'Ascorbat kann Kupfer reduzieren (Cu²⁺ → Cu⁺) und dadurch die Kupfer-abhängige Enzymaktivität beeinflussen');

-- Mangan (47) interactions
-- Eisen → id=45, Calcium → id=42
INSERT OR IGNORE INTO interactions (ingredient_a_id, ingredient_b_id, type, comment, severity, mechanism) VALUES
(47, 45, 'caution',
 'Eisen und Mangan konkurrieren um den gleichen intestinalen Transporter (DMT1). Hohe Eisendosen können die Manganabsorption hemmen und umgekehrt. Zeitlich getrennte Einnahme empfohlen.',
 'medium',
 'Konkurrenz über DMT1 (Divalent Metal Transporter 1) im Duodenum'),
(47, 42, 'caution',
 'Hohe Calciumzufuhr kann die Manganabsorption reduzieren. Bei Supplementierung von Knochenpräparaten (Ca + Mn) zeitlich trennen oder an die verminderte Bioverfügbarkeit denken.',
 'low',
 'Kompetitive Absorption über gemeinsame Transportmechanismen');

-- Chrom (48) interactions
-- SKIP: Insulin / Antidiabetika (drug), Antazida / Calciumcarbonat (drug category – not in our DB as a supplement)

-- Molybdän (49) interactions
-- Kupfer → id=46
-- SKIP: Sulfit / Lebensmittelzusatz (food additive – not in our DB)
INSERT OR IGNORE INTO interactions (ingredient_a_id, ingredient_b_id, type, comment, severity, mechanism) VALUES
(49, 46, 'caution',
 'Sehr hohe Molybdänzufuhr kann die Kupferbioverfügbarkeit reduzieren (im Wiederkäuer gut belegt, beim Menschen bei extrem hoher Zufuhr). Bei normalen Supplement-Dosierungen nicht relevant.',
 'medium',
 'Im GI-Trakt Bildung von Thiomolybdat-Kupfer-Komplexen, die Kupfer binden und dessen Resorption hemmen');
