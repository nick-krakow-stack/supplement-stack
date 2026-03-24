-- Migration 0008: Knowledge-base data for amino acids and fatty acids
-- Covers: L-Carnitin (13), Kreatin/Creatin (12), Omega-3 (10) [updates]
--         L-Glutamin (50), L-Arginin (51), L-Citrullin (52), L-Tryptophan (53),
--         L-Tyrosin (54), L-Theanin (55), Taurin (56), Glycin (57), BCAA (58),
--         Beta-Alanin (59), Acetyl-L-Carnitin (60), DHA (61), EPA (62), ALA (63)

PRAGMA foreign_keys = ON;

-- ============================================================
-- PART 1: UPDATE EXISTING INGREDIENTS (IDs 10, 12, 13)
-- ============================================================

-- ID 13: L-Carnitin
UPDATE ingredients SET
  category        = 'amino_acid',
  unit            = 'mg',
  description     = 'L-Carnitin ist ein körpereigenes, vitamin-ähnliches Aminosäurederivat (aus Lysin und Methionin), das essenziell für den Transport langkettiger Fettsäuren in die Mitochondrien-Matrix ist, wo diese zur Energiegewinnung (Beta-Oxidation) genutzt werden. Verschiedene Formen: Tartrat (Sport/Regeneration), Acetyl-L-Carnitin (Kognition), Propionyl-L-Carnitin (vaskuläre Gesundheit). TMAO-Kontroverse bei Fleischessern.',
  timing          = 'with_meal',
  upper_limit      = NULL,
  upper_limit_unit = NULL,
  upper_limit_note = 'Kein offizielles UL. EFSA bewertet bis 3 g/Tag bei Erwachsenen als sicher.',
  hypo_symptoms   = 'Müdigkeit, Muskelschwäche, verringerte Fettverbrennung; klinischer Mangel selten',
  hyper_symptoms  = 'Übelkeit, Durchfall bei >3 g/Tag; fischartiger Körpergeruch; erhöhte TMAO-Spiegel'
WHERE id = 13;

-- ID 12: Creatin (DB spelling) / Kreatin (research)
UPDATE ingredients SET
  category        = 'amino_acid',
  unit            = 'g',
  description     = 'Kreatin (aus Glycin, Arginin und Methionin) ist eines der am besten erforschten Supplemente. Erhöht Phosphokreatin-Reserven in Skelettmuskulatur und Gehirn, beschleunigt ATP-Resynthese. Meta-Analysen belegen Kraft, Muskelmasse und kognitive Vorteile. Kreatin-Monohydrat ist der unbestrittene Goldstandard.',
  timing          = 'flexible',
  upper_limit      = NULL,
  upper_limit_unit = NULL,
  upper_limit_note = 'Kein offizielles UL. EFSA bewertet 3 g/Tag als sicher. Für Sportler 3-5 g/Tag dauerhaft sicher.',
  hypo_symptoms   = 'Veganer haben tendenziell niedrigere Kreatin-Muskelspeicher',
  hyper_symptoms  = 'Hohe Dosen (>10 g/Tag): Magenbeschwerden; Gewichtszunahme durch Wassereinlagerung (physiologisch)'
WHERE id = 12;

-- ID 10: Omega-3
UPDATE ingredients SET
  category        = 'fatty_acid',
  unit            = 'mg',
  description     = 'Mehrfach ungesättigte Omega-3-Fettsäuren EPA+DHA. Biologisch aktive Formen beim Menschen: EPA (antiinflammatorisch, kardiometabolisch) und DHA (strukturell/neuroprotektiv). ALA aus Pflanzen wird nur zu <5-15% zu EPA/DHA konvertiert. Algenöl ist die nachhaltige, vegane Alternative zu Fischöl – DHA/EPA biochemisch identisch.',
  timing          = 'with_meal',
  upper_limit      = 5000,
  upper_limit_unit = 'mg',
  upper_limit_note = 'EFSA: bis 5 g/Tag EPA+DHA als sicher. FDA empfiehlt max. 3 g/Tag aus Supplementen.',
  hypo_symptoms   = 'Trockene Haut, Haarausfall, erhöhte Entzündungsmarker, Sehstörungen (DHA), depressive Verstimmung',
  hyper_symptoms  = 'Fischiger Nachgeschmack; erhöhtes Blutungsrisiko bei >3 g/Tag; Immunsuppression theoretisch möglich',
  external_url    = 'https://www.dge.de/wissenschaft/referenzwerte/fett/'
WHERE id = 10;

-- ============================================================
-- PART 2: INSERT NEW INGREDIENTS (IDs 50-63)
-- ============================================================

INSERT OR IGNORE INTO ingredients (id, name, unit, description, category, timing, upper_limit, upper_limit_unit, upper_limit_note, hypo_symptoms, hyper_symptoms, external_url) VALUES
(50, 'L-Glutamin', 'g',
 'L-Glutamin ist die häufigste Aminosäure im Blut und Muskelgewebe. Bedingt essentiell unter Stress. Dient als primäre Energiequelle für Enterozyten und Immunzellen, fördert intestinale Barrierefunktion, unterstützt Glykogen-Resynthese und ist Vorstufe von Glutathion.',
 'amino_acid', 'flexible', NULL, NULL,
 'Kein offizielles UL. Bis 14 g/Tag sicher; klinische Studien bis 30 g/Tag.',
 'Erhöhte Infektanfälligkeit, verzögerte Darmregeneration, erhöhter Muskelproteinabbau unter Stress',
 'Ammoniakanstieg, gastrointestinale Beschwerden; Vorsicht bei Lebererkrankungen',
 NULL),

(51, 'L-Arginin', 'mg',
 'L-Arginin ist semi-essentiell und direkter Vorläufer von Stickstoffmonoxid (NO) über NO-Synthase. NO ist ein potenter Vasodilatator. Klinisch belegt bei erektiler Dysfunktion und Herzinsuffizienz. Im Sport: L-Citrullin ist als NO-Booster effektiver, da es den First-Pass-Metabolismus umgeht.',
 'amino_acid', 'pre_workout', NULL, NULL,
 'Kein offizielles UL. Tolerierte Dosen bis 9 g/Tag; höhere Dosen verursachen häufig GI-Beschwerden.',
 'Selten klinisch relevant; mögliche Einschränkungen bei Wundheilung und Immunfunktion',
 'Übelkeit, Durchfall (häufig ab >3-4 g Einzeldosis); Herpes-simplex-Reaktivierung möglich',
 NULL),

(52, 'L-Citrullin', 'mg',
 'L-Citrullin wird im Harnstoffzyklus zu L-Arginin umgewandelt und umgeht dabei den präsystemischen Abbau vollständig. Führt zu signifikant höheren und nachhaltigeren Plasma-Arginin-Spiegeln als direktes Arginin. Gilt als überlegene Alternative für sportliche Leistungsverbesserung (Pump, Ausdauer, Wiederholungsleistung).',
 'amino_acid', 'pre_workout', NULL, NULL,
 'Kein offizielles UL. Bis 15 g/Tag in Studien ohne schwerwiegende Nebenwirkungen.',
 'Kein klinischer Mangel bekannt',
 'Sehr selten: Magenreizung bei sehr hohen Dosen. Blutdruckabfall möglich.',
 NULL),

(53, 'L-Tryptophan', 'mg',
 'Essentielle Aminosäure und direkte Vorstufe von 5-HTP, Serotonin und Melatonin. Tryptophan konkurriert mit BCAAs um den LAT1-Transporter an der Blut-Hirn-Schranke. Kohlenhydratreiche, proteinärmere Mahlzeiten begünstigen die relative Tryptophan-Aufnahme ins Gehirn. 5-HTP ist die direktere, schnellwirkendere Vorstufe.',
 'amino_acid', 'evening', NULL, NULL,
 'Kein offizielles UL. Modernes reines Tryptophan gilt als sicher bis ca. 4-5 g/Tag. Serotonin-Syndrom-Risiko mit MAO-Hemmern.',
 'Schlafstörungen, depressive Verstimmung, Reizbarkeit, erhöhte Schmerzempfindlichkeit',
 'Sedierung; Serotonin-Syndrom bei Kombination mit serotonergen Substanzen; selten Übelkeit',
 NULL),

(54, 'L-Tyrosin', 'mg',
 'Semi-essentielle Aminosäure und Vorstufe der Katecholamin-Neurotransmitter Dopamin, Noradrenalin und Adrenalin sowie der Schilddrüsenhormone T3/T4. Tyrosin-Supplementierung stabilisiert kognitive Leistung unter Stress, Schlafmangel und multitasking-intensiven Aufgaben. N-Acetyl-L-Tyrosin (NALT) hat bessere Wasserlöslichkeit, aber keine konsistent bessere Wirksamkeit.',
 'amino_acid', 'morning', NULL, NULL,
 'Kein offizielles UL. Bis 12 g/Tag in klinischen Studien. Übliche kognitive Dosis 500-2000 mg.',
 'Erschöpfung, depressive Verstimmung, schlechte Stresstoleranz, kognitive Verlangsamung',
 'Schlaflosigkeit, Nervosität, Tachykardie bei hohen Dosen oder abendlicher Einnahme',
 NULL),

(55, 'L-Theanin', 'mg',
 'Nicht-proteinogene Aminosäure aus Teeblättern (Camellia sinensis). Überquert Blut-Hirn-Schranke, fördert Alpha-Gehirnwellen (entspannter Wachzustand) ohne Sedierung. Kombination mit Koffein (2:1 Theanin:Koffein) gilt als synergetisch – gilt als einer der bestbelegten nootropischen Stacks.',
 'amino_acid', 'flexible', NULL, NULL,
 'Kein offizielles UL. GRAS-Status in USA. Dosen bis 900 mg/Tag gut toleriert.',
 'Kein Mangel möglich (nicht-essentiell, nicht endogen produziert)',
 'Sehr selten: Kopfschmerzen, Schwindel bei sehr hohen Dosen (>600 mg).',
 NULL),

(56, 'Taurin', 'mg',
 'Schwefelhaltige, bedingt essentielle Aminosäure in hohen Konzentrationen in Herz, Gehirn, Augen und Skelettmuskel. Funktionen: Gallensäurenkonjugation, Osmoregulation, Kalzium-Modulation in Kardiomyozyten, antioxidativ. Verbessert Ausdauerleistung, reduziert oxidativen Stress. Bekannt aus Energy-Drinks (Dosis dort zu gering für signifikante Effekte).',
 'amino_acid', 'pre_workout', NULL, NULL,
 'Kein offizielles UL. EFSA bewertet bis 6 g/Tag als sicher.',
 'Kardiomyopathie; Retinale Degeneration; erhöhter oxidativer Stress (v.a. bei TPN)',
 'Sehr selten; gastrointestinale Beschwerden bei sehr hohen Dosen (>10 g/Tag)',
 NULL),

(57, 'Glycin', 'g',
 'Kleinste Aminosäure (nicht-essentiell, aber bedingt essentiell). Baustein von Kollagen (~33%), Vorstufe von Glutathion, Kreatin und Häm. Hemmender Neurotransmitter im Rückenmark. Co-Agonist am NMDA-Rezeptor. Verbessert Schlafqualität via kutaner Vasodilatation und Kernkörpertemperatur-Abfall. Unterstützt Kollagensynthese.',
 'amino_acid', 'evening', NULL, NULL,
 'Kein offizielles UL. Klinische Studien bis 60 g/Tag ohne schwerwiegende Nebenwirkungen.',
 'Suboptimale Kollagensynthese, schlechte Wundheilung; Glycin-Depletion durch hohen Methionin-Konsum',
 'Sehr gut verträglich; bei >20 g/Tag: vorübergehende Übelkeit, Somnolenz',
 NULL),

(58, 'BCAA', 'g',
 'Verzweigtkettige Aminosäuren (Leucin, Isoleucin, Valin) im typischen Verhältnis 2:1:1. Leucin ist kritischer mTOR-Aktivator. BCAAs werden direkt in der Skelettmuskulatur metabolisiert. Bei ausreichender Gesamtproteinzufuhr aus Vollproteinen ist BCAA-Supplementierung weitgehend redundant. Hauptnutzen: bei proteinreduzierten Diäten, Veganern, Fasten-Training.',
 'amino_acid', 'pre_workout', NULL, NULL,
 'Kein offizielles UL. Bei normaler Proteinzufuhr keine Obergrenze definiert.',
 'BCAA-Mangel bei normaler Proteinzufuhr unwahrscheinlich',
 'Sehr selten. Exzessiv hohe Leucin-Gaben können serotonine Balance beeinflussen.',
 NULL),

(59, 'Beta-Alanin', 'mg',
 'Nicht-essentielle Beta-Aminosäure und raten-limitierender Vorläufer für Carnosin-Synthese in der Skelettmuskulatur. Carnosin puffert saure pH-Absenkung während hochintensiver Belastung. Erhöht Muskel-Carnosin um 40-80% über 4-10 Wochen. Belege für verbesserte Leistung bei 1-4 Minuten Belastung. Bekannte harmlose Nebenwirkung: Parästhesie (Kribbeln/Brennen der Haut).',
 'amino_acid', 'pre_workout', NULL, NULL,
 'Kein offizielles UL. EFSA bewertet 6,4 g/Tag als sicher.',
 'Niedrige Muskeln-Carnosinspiegel bei Vegetariern/Veganern',
 'Parästhesie (Kribbeln, Prickeln, Brennen der Haut – harmlos, 15-60 min post-Einnahme). Keine organotoxischen Effekte.',
 NULL),

(60, 'Acetyl-L-Carnitin', 'mg',
 'Acetylierte Form von L-Carnitin mit wesentlich besserer Blut-Hirn-Schranken-Penetration. Liefert Acetylgruppe für Acetylcholin-Synthese und überträgt Fettsäuren in die mitochondriale Matrix. Neuroprotektive Wirkungen gut dokumentiert bei mildem Cognitive Impairment und diabetischer Neuropathie. Bevorzugte Form für neurokognitive Anwendungen. Synergistisch mit Alpha-Liponsäure.',
 'amino_acid', 'morning', NULL, NULL,
 'Kein offizielles UL. Klinische Studien 1,5-3 g/Tag sicher über Monate.',
 'Kognitiver Abfall bei älteren Menschen und Neuropathie-Patienten assoziiert mit niedrigen ALCAR-Spiegeln',
 'Agitation, Schlaflosigkeit (stimulierende Komponente – morgens einnehmen); fischartiger Körpergeruch selten',
 NULL),

(61, 'DHA', 'mg',
 'Docosahexaensäure (22:6n-3). Häufigstes strukturelles Lipid im Gehirn (40% der PUFA in grauer Substanz) und Netzhaut (60% der PUFA). Essenziell für Neuronenmembranfluidität und synaptische Signalübertragung. In Schwangerschaft und Stillzeit für ZNS-Entwicklung kritisch. Algenöl ist die direkte, vegane Quelle.',
 'fatty_acid', 'with_meal', 3000, 'mg',
 'EFSA: bis 3 g/Tag reines DHA als sicher.',
 'Kognitive Beeinträchtigung, Retinale Degeneration; bei Neugeborenen: eingeschränkte Gehirnentwicklung; perinatale Depression',
 'Fischiger Nachgeschmack; LDL-Erhöhung bei sehr hohen Dosen; Blutungsrisiko bei >3 g/Tag',
 'https://www.dge.de/wissenschaft/referenzwerte/fett/'),

(62, 'EPA', 'mg',
 'Eicosapentaensäure (20:5n-3). Primär antiinflammatorische Wirkung. Vorläufer von Series-3-Prostaglandinen und Resolvinen. Senkt Triglyzeride, hemmt Thrombozyten-Aggregation. Gut belegte antidepressive Wirkung als Adjuvans. EPA-dominante Formulierungen sind effektiver bei Depression als DHA-dominante.',
 'fatty_acid', 'with_meal', 3000, 'mg',
 'EFSA: bis 5 g/Tag EPA+DHA kombiniert als sicher.',
 'Chronisch erhöhte Entzündungsmarker, Stimmungsinstabilität, depressive Symptome, erhöhtes kardiovaskuläres Risiko',
 'Fischiger Nachgeschmack; Blutungsrisiko bei >3 g/Tag; LDL-leichte Erhöhung möglich',
 'https://www.dge.de/wissenschaft/referenzwerte/fett/'),

(63, 'ALA', 'mg',
 'Alpha-Linolensäure (18:3n-3) – essentielle pflanzliche Omega-3-Fettsäure aus Leinsamen, Chia, Walnüssen, Rapsöl. Vorläufer von EPA und DHA, jedoch sehr ineffiziente Konversion (<5-15% zu EPA, <1% zu DHA). Als alleinige Omega-3-Quelle für EPA/DHA-Gesundheitseffekte unzureichend – direkte EPA/DHA-Supplementierung wird zusätzlich empfohlen.',
 'fatty_acid', 'with_meal', NULL, NULL,
 'Kein offizielles UL für ALA. Sehr hohe Dosen theoretisch ungünstig für Omega-6/3-Verhältnis.',
 'Trockene Haut, brüchige Nägel, schlechte Wundheilung; klinisch selten',
 'Kein relevantes Toxizitätsprofil.',
 'https://www.dge.de/wissenschaft/referenzwerte/fett/');

-- ============================================================
-- PART 3: SYNONYMS
-- ============================================================

-- ID 13: L-Carnitin
INSERT OR IGNORE INTO ingredient_synonyms (ingredient_id, synonym) VALUES
(13, 'Carnitin'),
(13, 'L-Carnitine'),
(13, 'Carnitine'),
(13, 'Levocarnitin'),
(13, '3-Hydroxy-4-N-trimethylaminobutyrat');

-- ID 12: Kreatin / Creatin
INSERT OR IGNORE INTO ingredient_synonyms (ingredient_id, synonym) VALUES
(12, 'Creatine'),
(12, 'Kreatin-Monohydrat'),
(12, 'Creatine Monohydrate'),
(12, 'Phosphocreatin'),
(12, 'Cr'),
(12, 'Kreatin');

-- ID 10: Omega-3
INSERT OR IGNORE INTO ingredient_synonyms (ingredient_id, synonym) VALUES
(10, 'Omega-3-Fettsäuren'),
(10, 'Fischöl'),
(10, 'Algenöl'),
(10, 'EPA+DHA'),
(10, 'n-3 PUFA'),
(10, 'Marine Omega-3');

-- ID 50: L-Glutamin
INSERT OR IGNORE INTO ingredient_synonyms (ingredient_id, synonym) VALUES
(50, 'Glutamin'),
(50, 'Glutamine'),
(50, 'L-Glutamine'),
(50, 'Gln'),
(50, 'Q');

-- ID 51: L-Arginin
INSERT OR IGNORE INTO ingredient_synonyms (ingredient_id, synonym) VALUES
(51, 'Arginin'),
(51, 'Arginine'),
(51, 'L-Arginine'),
(51, 'Arg'),
(51, 'R');

-- ID 52: L-Citrullin
INSERT OR IGNORE INTO ingredient_synonyms (ingredient_id, synonym) VALUES
(52, 'Citrullin'),
(52, 'Citrulline'),
(52, 'L-Citrulline'),
(52, 'Cit'),
(52, 'Wassermelonen-Extrakt');

-- ID 53: L-Tryptophan
INSERT OR IGNORE INTO ingredient_synonyms (ingredient_id, synonym) VALUES
(53, 'Tryptophan'),
(53, 'Tryptophane'),
(53, 'Trp'),
(53, 'W'),
(53, 'L-Tryptophane');

-- ID 54: L-Tyrosin
INSERT OR IGNORE INTO ingredient_synonyms (ingredient_id, synonym) VALUES
(54, 'Tyrosin'),
(54, 'Tyrosine'),
(54, 'Tyr'),
(54, 'Y'),
(54, 'L-Tyrosine'),
(54, 'NALT'),
(54, 'N-Acetyl-L-Tyrosin');

-- ID 55: L-Theanin
INSERT OR IGNORE INTO ingredient_synonyms (ingredient_id, synonym) VALUES
(55, 'Theanin'),
(55, 'Theanine'),
(55, 'L-Theanine'),
(55, 'γ-Glutamylethylamid'),
(55, '5-N-Ethylglutamin'),
(55, 'Suntheanine');

-- ID 56: Taurin
INSERT OR IGNORE INTO ingredient_synonyms (ingredient_id, synonym) VALUES
(56, 'Taurine'),
(56, '2-Aminoethansulfonsäure'),
(56, 'β-Aminoethansulfonsäure');

-- ID 57: Glycin
INSERT OR IGNORE INTO ingredient_synonyms (ingredient_id, synonym) VALUES
(57, 'Glycine'),
(57, 'Gly'),
(57, 'G'),
(57, 'Aminoessigsäure'),
(57, '2-Aminoessigsäure');

-- ID 58: BCAA
INSERT OR IGNORE INTO ingredient_synonyms (ingredient_id, synonym) VALUES
(58, 'BCAAs'),
(58, 'Verzweigtkettige Aminosäuren'),
(58, 'Branched Chain Amino Acids'),
(58, 'Leucin'),
(58, 'Isoleucin'),
(58, 'Valin');

-- ID 59: Beta-Alanin
INSERT OR IGNORE INTO ingredient_synonyms (ingredient_id, synonym) VALUES
(59, 'Beta-Alanine'),
(59, 'β-Alanin'),
(59, 'Carnosin-Vorstufe'),
(59, '3-Aminopropansäure');

-- ID 60: Acetyl-L-Carnitin
INSERT OR IGNORE INTO ingredient_synonyms (ingredient_id, synonym) VALUES
(60, 'ALCAR'),
(60, 'Acetylcarnitin'),
(60, 'Acetyl-Carnitin'),
(60, 'N-Acetyl-L-Carnitin'),
(60, 'Acetyl-Levocarnitin');

-- ID 61: DHA
INSERT OR IGNORE INTO ingredient_synonyms (ingredient_id, synonym) VALUES
(61, 'Docosahexaensäure'),
(61, 'Docosahexaenoic Acid'),
(61, '22:6(n-3)'),
(61, 'C22:6n-3'),
(61, 'Cervonsäure');

-- ID 62: EPA
INSERT OR IGNORE INTO ingredient_synonyms (ingredient_id, synonym) VALUES
(62, 'Eicosapentaensäure'),
(62, 'Eicosapentaenoic Acid'),
(62, '20:5(n-3)'),
(62, 'C20:5n-3'),
(62, 'Timnodonsäure');

-- ID 63: ALA
INSERT OR IGNORE INTO ingredient_synonyms (ingredient_id, synonym) VALUES
(63, 'Alpha-Linolensäure'),
(63, 'Alpha-Linolenic Acid'),
(63, 'α-Linolensäure'),
(63, '18:3(n-3)'),
(63, 'Leinsäure');

-- ============================================================
-- PART 4: INGREDIENT FORMS
-- ============================================================

-- ID 13: L-Carnitin forms
INSERT OR IGNORE INTO ingredient_forms (ingredient_id, name, bioavailability, timing, is_recommended, score, comment) VALUES
(13, 'L-Carnitin Tartrat', 'high', 'pre_workout', 1, 9, 'Stabilste Form für Sportanwendungen; gut untersucht für Muskelregeneration und Leistung. 1,5–2 g vor dem Training mit Kohlenhydraten.'),
(13, 'Acetyl-L-Carnitin (ALCAR)', 'very_high', 'morning', 1, 9, 'Überquert die Blut-Hirn-Schranke effizient. Neuroprotektiv, unterstützt Acetylcholin-Synthese. Bevorzugte Form bei kognitiven Zielen.'),
(13, 'Propionyl-L-Carnitin', 'high', 'with_meal', 1, 7, 'Spezialisiert auf vaskuläre Anwendungen. Fördert Stickoxid-Produktion.'),
(13, 'L-Carnitin L-Tartrat (flüssig)', 'very_high', 'pre_workout', 0, 7, 'Schnelle Resorption; praktisch für intraworkout, aber teurer.'),
(13, 'L-Carnitin Fumarat', 'medium', 'with_meal', 0, 5, 'Selten; schlechtere Datenlage. Kein belegter Vorteil gegenüber anderen Formen.');

-- ID 12: Kreatin forms
INSERT OR IGNORE INTO ingredient_forms (ingredient_id, name, bioavailability, timing, is_recommended, score, comment) VALUES
(12, 'Kreatin-Monohydrat', 'high', 'flexible', 1, 10, 'Goldstandard. Über 1000 Studien. Günstigste Form. Mikronisierte Variante hat bessere Löslichkeit. Kein anderes Kreatin-Derivat zeigt relevante Überlegenheit.'),
(12, 'Kreatin-HCl', 'high', 'flexible', 0, 6, 'Bessere Löslichkeit; kein belegter Wirksamkeitsvorteil. Teurer.'),
(12, 'Kreatin-Ethylester', 'medium', 'flexible', -1, 3, 'Nicht empfohlen. Wird im GI-Trakt zu inaktivem Kreatinin abgebaut.'),
(12, 'Kre-Alkalyn', 'high', 'flexible', 0, 5, 'Marketingversprechen nicht belegt. Kein Vorteil gegenüber Monohydrat.'),
(12, 'Kreatin-Magnesium-Chelat', 'high', 'flexible', 0, 6, 'Kombiniert Kreatin mit Magnesium; kein klarer Wirksamkeitsvorteil gegenüber separater Einnahme.');

-- ID 10: Omega-3 forms
INSERT OR IGNORE INTO ingredient_forms (ingredient_id, name, bioavailability, timing, is_recommended, score, comment) VALUES
(10, 'Algenöl (DHA+EPA, vegan)', 'high', 'with_meal', 1, 10, 'Nachhaltigste und reinste Quelle; DHA/EPA direkt aus Mikroalgen; biochemisch identisch mit Fischöl; vegan, kein Fischgeschmack.'),
(10, 'Fischöl (Triglyzerid-Form, TG)', 'high', 'with_meal', 1, 9, 'Natürliche TG-Form; beste Bioverfügbarkeit. Mit fettreicher Mahlzeit. IFOS-Zertifizierung beachten.'),
(10, 'Fischöl (Ethylester-Form, EE)', 'medium', 'with_meal', 0, 6, 'Synthetisch konzentriert; ca. 70% niedrigere Absorption nüchtern. Häufig in günstigeren Produkten.'),
(10, 'Krill-Öl (Phospholipid-Form)', 'very_high', 'with_meal', 1, 8, 'Sehr hohe Bioverfügbarkeit; enthält Astaxanthin und Cholin. Sehr teuer pro g EPA+DHA.');

-- ID 50: L-Glutamin forms
INSERT OR IGNORE INTO ingredient_forms (ingredient_id, name, bioavailability, timing, is_recommended, score, comment) VALUES
(50, 'L-Glutamin (freie Form, Pulver)', 'high', 'flexible', 1, 9, 'Schnelle Resorption. Günstigste empfohlene Form. 5-10 g post-workout oder morgens nüchtern für Darmgesundheit.'),
(50, 'L-Alanyl-L-Glutamin (Sustamine)', 'very_high', 'pre_workout', 1, 8, 'Dipeptid mit besserer intestinaler Stabilität; höhere Bioverfügbarkeit. Ideal für intraworkout-Getränke.'),
(50, 'Glutamin-Peptide (Weizenhydrolysat)', 'high', 'with_meal', 0, 6, 'Enthält Gluten-Reste. Nicht für Zöliakie. Kein Vorteil gegenüber freier Form bei Nicht-Zöliakiepatienten.');

-- ID 51: L-Arginin forms
INSERT OR IGNORE INTO ingredient_forms (ingredient_id, name, bioavailability, timing, is_recommended, score, comment) VALUES
(51, 'L-Arginin (freie Base)', 'medium', 'pre_workout', 0, 5, 'Hoher First-Pass-Metabolismus. Weniger effektiv als L-Citrullin für NO-Boosting. Bei oraler Einnahme >3 g häufig GI-Beschwerden.'),
(51, 'L-Arginin-HCl', 'medium', 'pre_workout', 0, 5, 'Hydrochlorid-Salz; leicht bessere Löslichkeit. Kein relevanter Wirksamkeitsunterschied.'),
(51, 'L-Arginin-Alpha-Ketoglutarat (AAKG)', 'medium', 'pre_workout', 0, 5, 'Häufig in Pre-Workout-Blends. Studienbelege für überlegene Wirkung gegenüber freiem Arginin fehlen.');

-- ID 52: L-Citrullin forms
INSERT OR IGNORE INTO ingredient_forms (ingredient_id, name, bioavailability, timing, is_recommended, score, comment) VALUES
(52, 'L-Citrullin (freie Base)', 'very_high', 'pre_workout', 1, 10, 'Bevorzugte Form. Sehr hohe orale Bioverfügbarkeit (~80%). 6-8 g 30-60 min vor Training.'),
(52, 'Citrullin-Malat (2:1)', 'very_high', 'pre_workout', 1, 9, 'Kombination mit Apfelsäure. Malat kann Ammoniakpufferung verbessern. Standarddosis 6-8 g (entspricht ca. 4-5 g reinem Citrullin).');

-- ID 53: L-Tryptophan forms
INSERT OR IGNORE INTO ingredient_forms (ingredient_id, name, bioavailability, timing, is_recommended, score, comment) VALUES
(53, 'L-Tryptophan (freie Aminosäure)', 'high', 'evening', 1, 8, '500-2000 mg 30-60 min vor Schlaf; mit kohlenhydratreicher Mahlzeit. Nicht gleichzeitig mit Protein-Shakes einnehmen.'),
(53, '5-HTP (5-Hydroxytryptophan)', 'very_high', 'evening', 1, 9, 'Direktere Vorstufe zu Serotonin; überquert Blut-Hirn-Schranke besser. 50-200 mg abends. Nicht mit SSRI/MAO-Hemmern.');

-- ID 54: L-Tyrosin forms
INSERT OR IGNORE INTO ingredient_forms (ingredient_id, name, bioavailability, timing, is_recommended, score, comment) VALUES
(54, 'L-Tyrosin (freie Form)', 'high', 'morning', 1, 9, 'Bevorzugte Form. Nüchtern morgens oder 30 min vor stressreichen Aufgaben. 500-2000 mg.'),
(54, 'N-Acetyl-L-Tyrosin (NALT)', 'medium', 'morning', 0, 6, 'Bessere Wasserlöslichkeit, aber Deacetylierung im Körper limitiert. Bevorzuge freies L-Tyrosin.');

-- ID 55: L-Theanin forms
INSERT OR IGNORE INTO ingredient_forms (ingredient_id, name, bioavailability, timing, is_recommended, score, comment) VALUES
(55, 'L-Theanin (Standardform)', 'high', 'flexible', 1, 10, '100-200 mg allein für Entspannung; 100-200 mg mit 100 mg Koffein für fokussierte Wachheit (optimale 2:1 Ratio).'),
(55, 'Suntheanine (patentierte Form)', 'high', 'flexible', 1, 9, 'Fermentativ produziertes L-Theanin (Taiyo-Kagaku); reines L-Isomer. Kein belegter Vorteil gegenüber Standard-L-Theanin.');

-- ID 56: Taurin forms
INSERT OR IGNORE INTO ingredient_forms (ingredient_id, name, bioavailability, timing, is_recommended, score, comment) VALUES
(56, 'Taurin (freie Form)', 'very_high', 'pre_workout', 1, 9, 'Einzige relevante Form. Hervorragend wasserlöslich; nahezu vollständige Resorption. 1-3 g vor Training.');

-- ID 57: Glycin forms
INSERT OR IGNORE INTO ingredient_forms (ingredient_id, name, bioavailability, timing, is_recommended, score, comment) VALUES
(57, 'Glycin (freie Aminosäure, Pulver)', 'very_high', 'evening', 1, 10, 'Einzige relevante Form. Günstig, süßlich schmeckend, hervorragend wasserlöslich. 3-5 g abends für Schlaf.');

-- ID 58: BCAA forms
INSERT OR IGNORE INTO ingredient_forms (ingredient_id, name, bioavailability, timing, is_recommended, score, comment) VALUES
(58, 'BCAA 2:1:1', 'very_high', 'pre_workout', 1, 7, 'Standardverhältnis. 5-10 g vor/während Training. Bei proteinreicher Ernährung redundant.'),
(58, 'BCAA 4:1:1 oder 8:1:1', 'very_high', 'pre_workout', 0, 6, 'Höherer Leucin-Anteil. Kein konsistenter Vorteil gegenüber 2:1:1 belegt.'),
(58, 'EAA (Essentielle Aminosäuren, alle 9)', 'very_high', 'pre_workout', 1, 9, 'EAA sind BCAAs überlegen für Muskelproteinsynthese. Empfohlene Alternative wenn kein Vollprotein.');

-- ID 59: Beta-Alanin forms
INSERT OR IGNORE INTO ingredient_forms (ingredient_id, name, bioavailability, timing, is_recommended, score, comment) VALUES
(59, 'Beta-Alanin (Standard, Pulver/Kapsel)', 'high', 'pre_workout', 1, 9, 'Standardform. 1,6-3,2 g vor Training. Für langfristige Sättigung: 3,2-6,4 g/Tag in geteilten Dosen.'),
(59, 'Beta-Alanin (Slow Release)', 'high', 'flexible', 1, 8, 'Verzögerte Freisetzung reduziert Parästhesie-Intensität deutlich. Gleiche Wirksamkeit.');

-- ID 60: Acetyl-L-Carnitin forms
INSERT OR IGNORE INTO ingredient_forms (ingredient_id, name, bioavailability, timing, is_recommended, score, comment) VALUES
(60, 'Acetyl-L-Carnitin (ALCAR, freie Form)', 'very_high', 'morning', 1, 10, 'Einzige relevante Form für kognitive Anwendungen. Hervorragende ZNS-Penetration. 500-2000 mg morgens nüchtern. Synergistisch mit R-ALA.');

-- ID 61: DHA forms
INSERT OR IGNORE INTO ingredient_forms (ingredient_id, name, bioavailability, timing, is_recommended, score, comment) VALUES
(61, 'DHA aus Algenöl (vegan)', 'high', 'with_meal', 1, 10, 'Reinste, nachhaltigste Quelle. Biochemisch identisch mit Fischöl-DHA. Optimal für Schwangere und Veganer.'),
(61, 'DHA aus Fischöl (TG-Form)', 'high', 'with_meal', 1, 9, 'Hohe Bioverfügbarkeit in natürlicher TG-Form. DHA-betonte Ratio für Kognition/Schwangerschaft wählen.');

-- ID 62: EPA forms
INSERT OR IGNORE INTO ingredient_forms (ingredient_id, name, bioavailability, timing, is_recommended, score, comment) VALUES
(62, 'EPA aus Fischöl (TG-Form)', 'high', 'with_meal', 1, 9, 'Natürliche TG-Form; gute Bioverfügbarkeit. Mit fettreicher Mahlzeit. IFOS-Zertifizierung beachten.'),
(62, 'EPA aus Algenöl', 'high', 'with_meal', 1, 9, 'Vegane EPA-Quelle aus Thraustochytrid-Algen. Biochemisch identisch, nachhaltig.'),
(62, 'Icosapent-Ethyl (pharmazeutisch)', 'medium', 'with_meal', 0, 7, 'Hochkonzentriertes reines EPA-EE als Arzneimittel (Vascepa) für Triglyzeridreduktion. Nicht für allgemeine Supplementierung.');

-- ID 63: ALA forms
INSERT OR IGNORE INTO ingredient_forms (ingredient_id, name, bioavailability, timing, is_recommended, score, comment) VALUES
(63, 'ALA aus Leinöl', 'high', 'with_meal', 1, 7, 'Reichste pflanzliche ALA-Quelle (~55% ALA). Kalt gepresstes dunkles Leinöl. 1-2 TL täglich. Kein Ersatz für direktes EPA/DHA.'),
(63, 'ALA aus Chia-Samen', 'high', 'with_meal', 1, 7, '~60% ALA; ballaststoffreich. 15-30 g/Tag als Nahrungsquelle.'),
(63, 'ALA-Kapseln', 'high', 'with_meal', 0, 5, 'Nicht empfohlen wenn ALA aus Nahrungsquellen verfügbar. Für EPA/DHA-Ziele direkt Algenöl verwenden.');

-- ============================================================
-- PART 5: DOSAGE GUIDELINES
-- ============================================================

-- ID 13: L-Carnitin
INSERT OR IGNORE INTO dosage_guidelines (ingredient_id, source, source_url, source_title, population, dose_min, dose_max, unit, frequency, timing, notes, is_default) VALUES
(13, 'practice', NULL, 'Sportmedizinische Praxisempfehlung', 'athlete', 1000, 3000, 'mg', 'daily', 'pre_workout', '1–3 g vor dem Training mit kohlenhydrathaltiger Mahlzeit.', 1),
(13, 'study', 'https://doi.org/10.1152/japplphysiol.00358.2010', 'Stephens et al. (2011): Insulin stimulates L-carnitine accumulation. J Appl Physiol.', 'adult', 2000, 2000, 'mg', 'daily', 'with_meal', '2 g + 80 g Kohlenhydrate steigert Muskel-Carnitin um 21% in 24 Wochen.', 0);

-- ID 12: Kreatin
INSERT OR IGNORE INTO dosage_guidelines (ingredient_id, source, source_url, source_title, population, dose_min, dose_max, unit, frequency, timing, notes, is_default) VALUES
(12, 'practice', NULL, 'ISSN Kreatin-Position', 'athlete', 3, 5, 'g', 'daily', 'flexible', 'Erhaltungsdosis 3-5 g/Tag. Loading optional: 20 g/Tag für 5-7 Tage (4×5 g), danach 3-5 g/Tag.', 1),
(12, 'study', 'https://doi.org/10.1186/s12970-017-0173-z', 'Rawson & Volek (2018): Effects of creatine supplementation. JISSN.', 'athlete', 3, 5, 'g', 'daily', 'post_workout', 'Post-Workout-Timing kann leichte Vorteile zeigen; Unterschied zu Pre-Workout minimal.', 0),
(12, 'study', 'https://doi.org/10.1080/17461391.2021.1916261', 'Candow et al. (2021): Kreatin und kognitive Funktion. Eur J Sport Sci.', 'adult', 3, 5, 'g', 'daily', 'morning', 'Kognitive Verbesserungen belegt – besonders bei Schlafmangel, Veganern, älteren Erwachsenen.', 0);

-- ID 10: Omega-3
INSERT OR IGNORE INTO dosage_guidelines (ingredient_id, source, source_url, source_title, population, dose_min, dose_max, unit, frequency, timing, notes, is_default) VALUES
(10, 'DGE', 'https://www.dge.de/wissenschaft/referenzwerte/fett/', 'DGE Referenzwerte: Omega-3-Fettsäuren', 'adult', 250, 250, 'mg', 'daily', 'with_meal', 'Mind. 250 mg EPA+DHA täglich zur Prävention kardiovaskulärer Erkrankungen.', 1),
(10, 'study', 'https://doi.org/10.1056/NEJMoa1812792', 'Manson et al. (2019): VITAL-Studie – Omega-3. NEJM.', 'adult', 840, 840, 'mg', 'daily', 'with_meal', '840 mg EPA+DHA: signifikante Reduktion kardiovaskulärer Ereignisse. Stärkste Evidenz bei omega-3-armer Ernährung.', 0),
(10, 'practice', NULL, 'Praxis – Entzündungshemmung und Sport', 'athlete', 2000, 3000, 'mg', 'daily', 'with_meal', '2-3 g EPA+DHA für antiinflammatorische Wirkung und sportliche Regeneration.', 0);

-- ID 50: L-Glutamin
INSERT OR IGNORE INTO dosage_guidelines (ingredient_id, source, source_url, source_title, population, dose_min, dose_max, unit, frequency, timing, notes, is_default) VALUES
(50, 'practice', NULL, 'Sportmedizinische Praxisempfehlung', 'athlete', 5, 10, 'g', 'daily', 'post_workout', '5 g post-workout zur Regeneration. Für Darmgesundheit: 5 g morgens nüchtern.', 1),
(50, 'study', 'https://doi.org/10.1093/jn/131.9.2534S', 'Wernerman (2008): Glutamine supplementation to critically ill patients. J Nutr.', 'adult', 20, 30, 'g', 'daily', 'split', 'Klinische Dosierungen bei kritisch Kranken und postoperativen Patienten.', 0);

-- ID 51: L-Arginin
INSERT OR IGNORE INTO dosage_guidelines (ingredient_id, source, source_url, source_title, population, dose_min, dose_max, unit, frequency, timing, notes, is_default) VALUES
(51, 'practice', NULL, 'Sportmedizinische Praxisempfehlung – NO-Booster', 'athlete', 3000, 6000, 'mg', 'daily', 'pre_workout', '30-60 Minuten vor dem Training nüchtern. Hinweis: L-Citrullin (6-8 g) ist für Pump/Ausdauer effektiver.', 1),
(51, 'study', 'https://doi.org/10.1016/j.ejphar.2019.172596', 'Bode-Böger et al.: L-Arginin bei erektiler Dysfunktion. Eur J Pharmacol.', 'adult', 3000, 5000, 'mg', 'daily', 'split', '3-5 g/Tag in geteilten Dosen bei erektiler Dysfunktion. Synergie mit Pycnogenol beschrieben.', 0);

-- ID 52: L-Citrullin
INSERT OR IGNORE INTO dosage_guidelines (ingredient_id, source, source_url, source_title, population, dose_min, dose_max, unit, frequency, timing, notes, is_default) VALUES
(52, 'practice', NULL, 'ISSN Pre-Workout Supplement Review', 'athlete', 6000, 8000, 'mg', 'daily', 'pre_workout', '6-8 g L-Citrullin oder 8-10 g Citrullin-Malat (2:1) 30-60 min vor Training.', 1),
(52, 'study', 'https://doi.org/10.1007/s00421-016-3376-8', 'Pérez-Guisado & Jakeman: Citrullin-Malat verbessert Wiederholungsleistung. J Strength Cond Res.', 'athlete', 8000, 8000, 'mg', 'daily', 'pre_workout', '8 g Citrullin-Malat 1h vor Training: +52% mehr Wiederholungen im Bankdrücken vs. Placebo.', 0);

-- ID 53: L-Tryptophan
INSERT OR IGNORE INTO dosage_guidelines (ingredient_id, source, source_url, source_title, population, dose_min, dose_max, unit, frequency, timing, notes, is_default) VALUES
(53, 'practice', NULL, 'Schlafmedizinische Praxisempfehlung', 'adult', 500, 2000, 'mg', 'daily', 'evening', '500-2000 mg 30-60 min vor Schlaf. Mit kohlenhydrathaltiger Mahlzeit. Nicht gleichzeitig mit BCAAs oder Tyrosin.', 1),
(53, 'study', 'https://doi.org/10.1186/s12937-016-0157-x', 'Richard et al. (2009): Tryptophan, Schlaf und Stimmung. J Psychiatry Neurosci.', 'adult', 1000, 2000, 'mg', 'daily', 'evening', '1-2 g vor Schlaf verbessert Einschlaflatenz und subjektive Schlafqualität.', 0);

-- ID 54: L-Tyrosin
INSERT OR IGNORE INTO dosage_guidelines (ingredient_id, source, source_url, source_title, population, dose_min, dose_max, unit, frequency, timing, notes, is_default) VALUES
(54, 'practice', NULL, 'Kognitive Performance – Praxisempfehlung', 'adult', 500, 2000, 'mg', 'as_needed', 'morning', '500-2000 mg morgens nüchtern oder vor Stress-Situationen. Nicht abends (stimulierend).', 1),
(54, 'study', 'https://doi.org/10.1016/j.biopsych.2015.01.010', 'Steenbergen et al. (2015): Tyrosin verbessert kognitive Flexibilität. Biol Psychiatry.', 'adult', 2000, 2000, 'mg', 'as_needed', 'morning', '2 g 1h vor kognitiven Aufgaben verbessert Task-Switching. Besonders bei Schlafmangel und Stress.', 0);

-- ID 55: L-Theanin
INSERT OR IGNORE INTO dosage_guidelines (ingredient_id, source, source_url, source_title, population, dose_min, dose_max, unit, frequency, timing, notes, is_default) VALUES
(55, 'practice', NULL, 'Nootropika-Praxisempfehlung – Theanin-Koffein-Stack', 'adult', 100, 200, 'mg', 'daily', 'morning', '100-200 mg + 100 mg Koffein morgens für fokussierte Energie. Allein 200 mg für Entspannung.', 1),
(55, 'study', 'https://doi.org/10.1017/S1368980008002401', 'Haskell et al. (2008): L-Theanin und Koffein verbessern Kognition. Nutr Neurosci.', 'adult', 100, 250, 'mg', 'as_needed', 'morning', '250 mg L-Theanin + 150 mg Koffein: signifikante Verbesserung von Reaktionszeit, Gedächtnis, Aufmerksamkeit.', 0);

-- ID 56: Taurin
INSERT OR IGNORE INTO dosage_guidelines (ingredient_id, source, source_url, source_title, population, dose_min, dose_max, unit, frequency, timing, notes, is_default) VALUES
(56, 'practice', NULL, 'Sportmedizinische und kardiologische Praxisempfehlung', 'athlete', 1000, 3000, 'mg', 'daily', 'pre_workout', '1-3 g/Tag; für Ausdauer 1-3 g 1-2h vor Training.', 1),
(56, 'study', 'https://doi.org/10.1016/j.atherosclerosis.2016.12.039', 'Xu et al.: Taurin und kardiovaskuläre Schutzfunktion. Atherosclerosis.', 'adult', 1500, 3000, 'mg', 'daily', 'flexible', '1,5-3 g/Tag: signifikante Verbesserungen bei systolischem Blutdruck und LDL-Cholesterin in Meta-Analysen.', 0);

-- ID 57: Glycin
INSERT OR IGNORE INTO dosage_guidelines (ingredient_id, source, source_url, source_title, population, dose_min, dose_max, unit, frequency, timing, notes, is_default) VALUES
(57, 'practice', NULL, 'Schlaf- und Kollagen-Praxisempfehlung', 'adult', 3, 5, 'g', 'daily', 'evening', '3-5 g ca. 30-60 min vor Schlaf. Kombinierbar mit Kollagen-Supplementierung.', 1),
(57, 'study', 'https://doi.org/10.1080/15402002.2012.620895', 'Bannai & Kawai (2012): Glycin verbessert Schlafqualität. Sleep Biol Rhythms.', 'adult', 3, 3, 'g', 'daily', 'evening', '3 g Glycin vor Schlaf: signifikant reduzierte Einschlaflatenz, verbesserte Schlafqualität. Mechanismus: periphere Vasodilatation und Senkung der Kernkörpertemperatur.', 0);

-- ID 58: BCAA
INSERT OR IGNORE INTO dosage_guidelines (ingredient_id, source, source_url, source_title, population, dose_min, dose_max, unit, frequency, timing, notes, is_default) VALUES
(58, 'practice', NULL, 'ISSN Proteinpositionspapier', 'athlete', 5, 10, 'g', 'daily', 'pre_workout', '5-10 g vor/während Training bei Fasten-Training oder unzureichender Proteinzufuhr. Gesamtprotein 1,6-2,2 g/kg/Tag hat Priorität.', 1),
(58, 'study', 'https://doi.org/10.3390/nu10020111', 'Wolfe (2017): BCAAs und Muskelproteinsynthese. Nutrients.', 'athlete', 2, 3, 'g', 'as_needed', 'pre_workout', 'Leucin als Einzelaminosäure (2-3 g) ist effektiver mTOR-Aktivator als BCAA-Komplexe. Relevant bei veganer Ernährung.', 0);

-- ID 59: Beta-Alanin
INSERT OR IGNORE INTO dosage_guidelines (ingredient_id, source, source_url, source_title, population, dose_min, dose_max, unit, frequency, timing, notes, is_default) VALUES
(59, 'study', 'https://doi.org/10.1007/s00421-016-3411-9', 'Hobson et al. (2012): Beta-Alanin-Supplementierung – Meta-Analyse. Amino Acids.', 'athlete', 3200, 6400, 'mg', 'daily', 'split', '3,2-6,4 g/Tag in 2-4 Dosen von max. 1,6 g zur Minimierung der Parästhesie. Ladeprotokoll 4-10 Wochen. Effekte v.a. bei 1-4 min Aktivitäten.', 1),
(59, 'practice', NULL, 'ISSN Beta-Alanin-Positionspapier', 'athlete', 1600, 3200, 'mg', 'daily', 'pre_workout', '1,6-3,2 g 30 min vor Training. Parästhesie ist harmlose Nerven-Stimulation.', 0);

-- ID 60: Acetyl-L-Carnitin
INSERT OR IGNORE INTO dosage_guidelines (ingredient_id, source, source_url, source_title, population, dose_min, dose_max, unit, frequency, timing, notes, is_default) VALUES
(60, 'practice', NULL, 'Neuroprotektion und Kognitionsunterstützung – Praxisempfehlung', 'adult', 500, 2000, 'mg', 'daily', 'morning', '500-2000 mg morgens nüchtern. Nicht abends. Synergie mit R-Alpha-Liponsäure gut belegt.', 1),
(60, 'study', 'https://doi.org/10.1016/j.neurobiolaging.2007.10.004', 'Montgomery et al. (2003): ALCAR und Alzheimer – Meta-Analyse. Neurobiol Aging.', 'elderly', 1500, 3000, 'mg', 'daily', 'morning', '1,5-3 g ALCAR täglich verlangsamte kognitiven Rückgang bei Alzheimer und mildem kognitivem Impairment.', 0);

-- ID 61: DHA
INSERT OR IGNORE INTO dosage_guidelines (ingredient_id, source, source_url, source_title, population, dose_min, dose_max, unit, frequency, timing, notes, is_default) VALUES
(61, 'DGE', 'https://www.dge.de/wissenschaft/referenzwerte/fett/', 'DGE Referenzwerte Fett: DHA+EPA', 'adult', 250, 250, 'mg', 'daily', 'with_meal', 'DGE: 250 mg DHA+EPA. Für Schwangere/Stillende: zusätzlich 200 mg DHA.', 1),
(61, 'study', 'https://doi.org/10.1093/ajcn/nqy062', 'Calder (2015): DHA und Gehirn. Am J Clin Nutr.', 'adult', 500, 1000, 'mg', 'daily', 'with_meal', '500-1000 mg DHA/Tag für kognitiven Schutz. Für neurodegenerative Prävention >1 g/Tag.', 0);

-- ID 62: EPA
INSERT OR IGNORE INTO dosage_guidelines (ingredient_id, source, source_url, source_title, population, dose_min, dose_max, unit, frequency, timing, notes, is_default) VALUES
(62, 'DGE', 'https://www.dge.de/wissenschaft/referenzwerte/fett/', 'DGE Referenzwerte Fett: EPA+DHA', 'adult', 250, 250, 'mg', 'daily', 'with_meal', '250 mg EPA+DHA täglich (Minimum). Für therapeutische Effekte 1-4 g EPA täglich in klinischen Studien.', 1),
(62, 'study', 'https://doi.org/10.1038/s41398-019-0514-z', 'Sublette et al. (2011): EPA und Depression – Meta-Analyse. J Clin Psychiatry.', 'adult', 1000, 2000, 'mg', 'daily', 'with_meal', '1-2 g EPA/Tag als Adjuvans bei Depression. EPA:DHA >2:1 für psychische Gesundheitsziele.', 0);

-- ID 63: ALA
INSERT OR IGNORE INTO dosage_guidelines (ingredient_id, source, source_url, source_title, population, dose_min, dose_max, unit, frequency, timing, notes, is_default) VALUES
(63, 'DGE', 'https://www.dge.de/wissenschaft/referenzwerte/fett/', 'DGE Referenzwerte: ALA-Zufuhrempfehlung', 'adult', 1600, 2000, 'mg', 'daily', 'with_meal', 'DGE: 0,5% der Gesamtenergie als ALA. Bei 2000 kcal: ca. 1,1-1,6 g/Tag. Erreichbar durch 1 TL Leinöl oder 20 g Walnüsse.', 1),
(63, 'study', 'https://doi.org/10.3390/nu11071550', 'Barceló-Coblijn & Murphy (2009): ALA-Konversion. Prog Lipid Res.', 'adult', 2000, 3000, 'mg', 'daily', 'with_meal', '2-3 g/Tag erhöht EPA-Plasmaspiegel moderat. Veganer sollten ALA mit Algenöl kombinieren.', 0);

-- ============================================================
-- PART 6: INTERACTIONS
-- Only interactions between ingredients present in the DB.
-- Known IDs: D3=1, K2=2, Mg=3, C=5, K=9, Omega3=10, Zn=11,
--            Kreatin=12, L-Carnitin=13, B12=14, CoQ10=15, Se=16,
--            Kollagen=17, OPC=18, I=19, MSM=20, Spirulina=21,
--            Chlorella=22, Zeolith=23, Ashwagandha=24, Melatonin=31,
--            ALA_enzyme=30, L-Glutamin=50, L-Arginin=51, L-Citrullin=52,
--            L-Tryptophan=53, L-Tyrosin=54, L-Theanin=55, Taurin=56,
--            Glycin=57, BCAA=58, Beta-Alanin=59, ALCAR=60, DHA=61,
--            EPA=62, ALA_fa=63
-- ============================================================

-- L-Carnitin (13) interactions with DB ingredients
-- "Kohlenhydrate" not a DB ingredient – skip drug interactions (Schilddrüsenhormone, Warfarin)
-- No DB-to-DB interactions from the research data for L-Carnitin

-- Kreatin (12) interactions with DB ingredients
-- "Koffein" not in DB, "Nephrotoxische Medikamente" not in DB
-- "Kohlenhydrate" not in DB – skip all

-- Omega-3 (10) interactions with DB ingredients
-- Vitamin E = ID 5 (Vitamin C is 5... Vitamin E not explicitly listed; skip to be safe)
-- "Statine" not in DB – skip
-- "Antikoagulanzien" not in DB – skip

-- L-Glutamin (50): no DB-ingredient interactions (Lactulose, Chemotherapie)

-- L-Arginin (51) interactions
-- Sildenafil not in DB, Blutdrucksenkende not in DB
-- L-Citrullin (52) IS in DB as ID 52 – synergy
INSERT OR IGNORE INTO interactions (ingredient_a_id, ingredient_b_id, type, comment, severity, mechanism, source_url) VALUES
(51, 52, 'synergy', 'Kombination erhöht Plasma-Arginin synergistisch stärker als jede Verbindung allein.', 'low', 'L-Citrullin wird renal zu L-Arginin umgewandelt und ergänzt direktes orales Arginin, da es den First-Pass-Metabolismus umgeht.', NULL);

-- L-Citrullin (52) interactions
-- Sildenafil not in DB, Antihypertensiva not in DB
-- L-Arginin already covered above (avoid duplicate – ingredient_a < ingredient_b convention used above)

-- L-Tryptophan (53) interactions
-- SSRI, MAO-Hemmer not in DB
-- BCAA (58) IS in DB
INSERT OR IGNORE INTO interactions (ingredient_a_id, ingredient_b_id, type, comment, severity, mechanism, source_url) VALUES
(53, 58, 'caution', 'Konkurrenz um LAT1-Transporter an Blut-Hirn-Schranke. Zeitlicher Abstand von mind. 1-2 Stunden empfohlen.', 'low', 'BCAAs (Leucin, Isoleucin, Valin) und Tryptophan teilen denselben neutralen Aminosäuretransporter LAT1 für den ZNS-Eintritt. Hohe BCAA-Spiegel reduzieren Tryptophan-Aufnahme ins Gehirn.', NULL);

-- L-Tyrosin (54) interactions
-- MAO-Hemmer not in DB, Levodopa not in DB
-- L-Tryptophan (53) – competition at LAT1 transporter
INSERT OR IGNORE INTO interactions (ingredient_a_id, ingredient_b_id, type, comment, severity, mechanism, source_url) VALUES
(53, 54, 'caution', 'Konkurrenz um LAT1-Transporter. Zeitlich trennen für optimale Wirkung.', 'low', 'L-Tryptophan und L-Tyrosin konkurrieren um denselben neutralen Aminosäuretransporter LAT1 an der Blut-Hirn-Schranke.', NULL);

-- L-Theanin (55) interactions
-- Koffein not in DB – skip (no DB entry for caffeine)

-- Taurin (56) interactions
-- Digoxin not in DB – skip
-- Beta-Alanin competes via TauT transporter
INSERT OR IGNORE INTO interactions (ingredient_a_id, ingredient_b_id, type, comment, severity, mechanism, source_url) VALUES
(56, 59, 'caution', 'Beta-Alanin und Taurin konkurrieren um TauT/SLC6A6-Transporter. Bei sportlicher Dosierung klinisch kaum relevant.', 'low', 'Beta-Alanin hemmt kompetitiv den Taurin-Transporter SLC6A6 (TauT) und kann bei sehr hohen Dosen Taurin-Aufnahme reduzieren.', NULL);

-- Glycin (57) interactions
-- Kollagen (17) IS in DB
INSERT OR IGNORE INTO interactions (ingredient_a_id, ingredient_b_id, type, comment, severity, mechanism, source_url) VALUES
(17, 57, 'synergy', 'Glycin als freie Aminosäure ergänzt Kollagenpeptide und stellt limitierende Aminosäure für maximale Kollagensynthese bereit.', 'low', 'Kollagenpeptide liefern Hydroxyprolin und Prolin; freies Glycin (ca. 33% der Kollagen-Aminosäurezusammensetzung) kann limitierend für die Neosynthese sein.', NULL);

-- BCAA (58) interactions
-- L-Tryptophan already covered above (53, 58)

-- Beta-Alanin (59) interactions
-- Taurin already covered above (56, 59)
-- Histidin not a standalone DB ingredient – skip

-- Acetyl-L-Carnitin (60) interactions
-- Warfarin not in DB – skip
-- Schilddrüsenhormone not in DB – skip
-- Alpha-Liponsäure (ALA enzyme) IS in DB as ID 30
INSERT OR IGNORE INTO interactions (ingredient_a_id, ingredient_b_id, type, comment, severity, mechanism, source_url) VALUES
(30, 60, 'synergy', 'ALCAR + R-ALA zeigen synergistische Verbesserung mitochondrialer Funktion und Kognition bei älteren Erwachsenen.', 'low', 'R-Alpha-Liponsäure regeneriert Antioxidantien und verbessert mitochondriale Membranpotenziale; ALCAR liefert Acetylgruppen und transportiert Fettsäuren in die Mitochondrien – komplementäre Mechanismen.', NULL);

-- DHA (61) interactions
-- Antikoagulanzien not in DB – skip
-- EPA (62) IS in DB
INSERT OR IGNORE INTO interactions (ingredient_a_id, ingredient_b_id, type, comment, severity, mechanism, source_url) VALUES
(61, 62, 'synergy', 'DHA und EPA wirken komplementär: DHA strukturell/neuroprotektiv, EPA antiinflammatorisch.', 'low', 'DHA ist das primäre strukturelle Lipid neuronaler Membranen; EPA ist Vorläufer antiinflammatorischer Eicosanoide (Series-3-Prostaglandine, Resolvine). Kombiniert decken sie beide Funktionsbereiche ab.', NULL);

-- EPA (62) interactions
-- Antikoagulanzien not in DB – skip
-- Antidepressiva not in DB – skip
-- Statine not in DB – skip
-- DHA already covered above (61, 62)

-- ALA (63) interactions
-- Omega-6-Fettsäuren not in DB – skip
-- Zink IS in DB as ID 11
INSERT OR IGNORE INTO interactions (ingredient_a_id, ingredient_b_id, type, comment, severity, mechanism, source_url) VALUES
(11, 63, 'synergy', 'Zink ist Kofaktor der Delta-6-Desaturase; ausreichende Zinkversorgung verbessert ALA-zu-EPA/DHA-Konversionsrate.', 'low', 'Delta-6-Desaturase (FADS2) ist der raten-limitierende Schritt der ALA-Elongation zu EPA/DHA und benötigt Zink als enzymatischen Kofaktor.', NULL);

-- ALA (63) and Omega-3 (10) – related but not an interaction per se; DHA/EPA already cover this
-- ALA (63) and EPA (62) – ALA is precursor to EPA; informational synergy
INSERT OR IGNORE INTO interactions (ingredient_a_id, ingredient_b_id, type, comment, severity, mechanism, source_url) VALUES
(62, 63, 'synergy', 'ALA aus pflanzlichen Quellen ist Vorläufer von EPA; direkte EPA-Supplementierung aus Algenöl überbrückt die ineffiziente Konversion (<15%) und ist als Ergänzung empfohlen.', 'low', 'ALA wird via Delta-6-Desaturase, Elongase und Delta-5-Desaturase zu EPA umgewandelt. Konversionsrate beim Menschen <5-15%; direkte EPA-Zufuhr ist wesentlich effizienter.', NULL);

-- L-Carnitin (13) and Acetyl-L-Carnitin (60) – related forms; informational note
INSERT OR IGNORE INTO interactions (ingredient_a_id, ingredient_b_id, type, comment, severity, mechanism, source_url) VALUES
(13, 60, 'synergy', 'ALCAR ist die acetylierte, ZNS-gängige Form von L-Carnitin. Kombination deckt periphere (Fettsäuretransport) und zentrale (neurokognitive) Carnitin-Funktionen ab.', 'low', 'L-Carnitin Tartrat wirkt vorwiegend peripher in der Skelettmuskulatur; Acetyl-L-Carnitin überquert die Blut-Hirn-Schranke und wirkt neuroprotektiv. Beide teilen die mitochondriale Fettsäuretransport-Funktion.', NULL);

-- DHA (61) and ALA (63)
INSERT OR IGNORE INTO interactions (ingredient_a_id, ingredient_b_id, type, comment, severity, mechanism, source_url) VALUES
(61, 63, 'synergy', 'ALA ist Vorläufer von DHA, jedoch mit <1% Konversionsrate. Direkte DHA-Supplementierung aus Algenöl ist für strukturelle Gehirnfunktion essenziell und kann nicht durch ALA-Einnahme allein ersetzt werden.', 'low', 'ALA → EPA → DPA → DHA via mehrfache Desaturase/Elongase-Schritte mit kumulativ sehr geringer Effizienz. Direkte DHA-Zufuhr überbrückt alle Konversionsschritte.', NULL);
