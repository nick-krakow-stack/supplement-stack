-- Migration 0005: Seed – Adaptogene, Pflanzliche Extrakte, Enzyme, Algen, Weitere
-- Covers: Ginseng (update), Ashwagandha, Rhodiola, Maca, OPC (update), Schwarzkümmelöl (update),
--         Grapefruitkernextrakt (update), Berberin, Resveratrol, Curcumin,
--         CoQ10 (update), ALA, Spirulina (update), Chlorella (update), Zeolith (update),
--         MSM (update), Kollagen (update), Melatonin

PRAGMA foreign_keys = ON;

-- =========================================================================
-- STEP 1: Update existing ingredients with new columns (category, timing, UL)
-- =========================================================================

-- Ginseng (id=4) – already exists, update
UPDATE ingredients SET
  category           = 'adaptogen',
  timing             = 'morning',
  upper_limit        = 3000,
  upper_limit_unit   = 'mg',
  upper_limit_note   = 'Empfohlene Höchstdosis bei Langzeitanwendung; bei standardisierten Extrakten entsprechend niedriger',
  description        = 'Klassisches Adaptogen der TCM und Ayurveda. Panax ginseng (Koreanischer Ginseng), Eleutherococcus senticosus (Sibirischer Ginseng) und Panax quinquefolius (Amerikanischer Ginseng) fördern Energie, kognitive Leistung und Stressresistenz.',
  hypo_symptoms      = 'Erschöpfung, verminderte Stresstoleranz, kognitive Verlangsamung',
  hyper_symptoms     = 'Schlaflosigkeit, Nervosität, Blutdruckanstieg, Kopfschmerzen, gastrointestinale Beschwerden; Ginseng-Missbrauchssyndrom bei Langzeitüberdosierung',
  external_url       = 'https://ods.od.nih.gov/factsheets/list-all/'
WHERE id = 4;

-- OPC (id=18) – update
UPDATE ingredients SET
  category           = 'plant_extract',
  timing             = 'morning',
  upper_limit        = 800,
  upper_limit_unit   = 'mg',
  upper_limit_note   = 'Kein offizielles UL; Praxiswert aus Studiendaten',
  description        = 'Oligomere Proanthocyanidine (OPC) aus Traubenkernextrakt (Vitis vinifera). Starkes polyphenolisches Antioxidans, schützt Gefäße, Haut und Bindegewebe vor oxidativem Stress.',
  hypo_symptoms      = 'Kein klassischer Mangel bekannt; erhöhter oxidativer Stress möglich',
  hyper_symptoms     = 'Bei sehr hohen Dosen: Kopfschmerzen, Schwindel, Übelkeit',
  external_url       = 'https://www.ncbi.nlm.nih.gov/pmc/articles/PMC4690266/'
WHERE id = 18;

-- Schwarzkümmelöl (id=6) – update
UPDATE ingredients SET
  category           = 'plant_extract',
  timing             = 'with_meal',
  upper_limit        = 3000,
  upper_limit_unit   = 'mg',
  upper_limit_note   = 'Keine offiziellen Daten; Praxisgrenze',
  description        = 'Öl aus den Samen von Nigella sativa. Enthält Thymochinon als Hauptwirkstoff mit nachgewiesenen antiinflammatorischen, immunmodulierenden und antioxidativen Eigenschaften.',
  hypo_symptoms      = 'Kein klassischer Mangel; erhöhte Infektanfälligkeit möglich',
  hyper_symptoms     = 'Magenreizung bei hohen Dosen; selten allergische Reaktionen; nicht in der Schwangerschaft',
  external_url       = 'https://www.ncbi.nlm.nih.gov/pmc/articles/PMC3642442/'
WHERE id = 6;

-- Grapefruitkernextrakt (id=7) – update
UPDATE ingredients SET
  category           = 'plant_extract',
  timing             = 'with_meal',
  upper_limit        = 1000,
  upper_limit_unit   = 'mg',
  upper_limit_note   = 'Kein offizielles UL; bei hochkonzentrierten Produkten Vorsicht',
  description        = 'Extrakt aus Kernen und Schalen der Grapefruit (Citrus paradisi). Wird traditionell als antimikrobielles Mittel gegen Bakterien, Pilze und Viren eingesetzt. Wirksamkeit wissenschaftlich umstritten – Aktivität möglicherweise auf Konservierungsstoffe zurückzuführen.',
  hypo_symptoms      = 'Nicht relevant (kein essenzieller Nährstoff)',
  hyper_symptoms     = 'Magen-Darm-Beschwerden bei hohen Dosen; Wechselwirkungen mit CYP3A4-Substraten (wie Grapefruitsaft)',
  external_url       = NULL
WHERE id = 7;

-- CoQ10 (id=15) – update
UPDATE ingredients SET
  category           = 'enzyme_coenzyme',
  timing             = 'with_meal',
  upper_limit        = 1200,
  upper_limit_unit   = 'mg',
  upper_limit_note   = 'Kein offizielles UL; Studiendaten zeigen gute Verträglichkeit bis 1200 mg/Tag',
  description        = 'Coenzym Q10 (Ubiquinon/Ubiquinol) ist ein fettlösliches Coenzym der mitochondrialen Atmungskette (Komplex I–III). Essenziell für zelluläre Energieproduktion (ATP-Synthese) und als Antioxidans. Körpereigene Produktion nimmt ab dem 40. Lebensjahr ab. Statine hemmen die endogene CoQ10-Biosynthese über den Mevalonatweg.',
  hypo_symptoms      = 'Erschöpfung, Muskelschwäche, Herzinsuffizienz-Risiko, kognitive Einschränkungen, besonders relevant bei Statin-Einnahme',
  hyper_symptoms     = 'Magenreizung, Übelkeit, Durchfall bei sehr hohen Dosen (>1200 mg)',
  external_url       = 'https://ods.od.nih.gov/factsheets/CoQ10-HealthProfessional/'
WHERE id = 15;

-- Spirulina (id=21) – update
UPDATE ingredients SET
  category           = 'other',
  timing             = 'morning',
  upper_limit        = 8,
  upper_limit_unit   = 'g',
  upper_limit_note   = 'Kein offizielles UL; Praxiswert; bei Qualitätsprodukten auch höhere Dosen möglich',
  description        = 'Cyanobakterium (Blaugrünalge) Arthrospira platensis/maxima. Reich an vollständigem Protein (~60–70 %), B-Vitaminen (kein aktives B12), Eisen, Phycocyanin (Antioxidans) und Chlorophyll. Entgiftend und immunmodulierend.',
  hypo_symptoms      = 'Kein Mangel im klassischen Sinne',
  hyper_symptoms     = 'Übelkeit, Verdauungsbeschwerden; bei kontaminierten Produkten Schwermetallbelastung; Vorsicht bei Phenylketonurie (Phenylalanin-Gehalt)',
  external_url       = 'https://www.ncbi.nlm.nih.gov/pmc/articles/PMC3136577/'
WHERE id = 21;

-- Chlorella (id=22) – update
UPDATE ingredients SET
  category           = 'other',
  timing             = 'morning',
  upper_limit        = 10,
  upper_limit_unit   = 'g',
  upper_limit_note   = 'Kein offizielles UL',
  description        = 'Einzellige Grünalge (Chlorella vulgaris/pyrenoidosa). Enthält Chlorella Growth Factor (CGF), Chlorophyll, vollständiges Protein, echtes Vitamin B12 und Mineralien. Bekannt für Schwermetallausleitung (Quecksilber, Blei) durch Bindung im GI-Trakt.',
  hypo_symptoms      = 'Kein Mangel im klassischen Sinne',
  hyper_symptoms     = 'Verdauungsbeschwerden, Blähungen; Photosensitivität bei sehr hohen Dosen',
  external_url       = 'https://www.ncbi.nlm.nih.gov/pmc/articles/PMC6523211/'
WHERE id = 22;

-- Zeolith (id=23) – update
UPDATE ingredients SET
  category           = 'other',
  timing             = 'fasting',
  upper_limit        = 15,
  upper_limit_unit   = 'g',
  upper_limit_note   = 'Kein offizielles UL; zeitlichen Abstand zu Medikamenten und Nährstoffen einhalten',
  description        = 'Natürliches vulkanisches Silikatmineral (Klinoptilolith). Durch seine Gitterstruktur bindet Zeolith Schwermetalle, Ammonium und organische Toxine im Gastrointestinaltrakt und leitet sie aus. Keine systemische Resorption. Mindestens 2 Stunden Abstand zu Medikamenten und Supplementen erforderlich.',
  hypo_symptoms      = 'Nicht relevant',
  hyper_symptoms     = 'Verstopfung bei unzureichender Flüssigkeitszufuhr; bindet unspezifisch Nährstoffe',
  external_url       = 'https://www.ncbi.nlm.nih.gov/pmc/articles/PMC5053453/'
WHERE id = 23;

-- MSM (id=20) – update
UPDATE ingredients SET
  category           = 'other',
  timing             = 'with_meal',
  upper_limit        = 4800,
  upper_limit_unit   = 'mg',
  upper_limit_note   = 'EFSA-Bewertung: bis 4800 mg/Tag ohne unerwünschte Effekte in Studien',
  description        = 'Methylsulfonylmethan (MSM) ist eine natürliche organische Schwefelverbindung. Liefert bioverfügbaren Schwefel als Cofaktor für Kollagensynthese, Glutathionproduktion und Gelenkknaorpelaufbau. Antiinflammatorisch über NF-κB-Hemmung.',
  hypo_symptoms      = 'Gelenkschmerzen, Muskelverspannungen, verringerte Antioxidanskapazität',
  hyper_symptoms     = 'Übelkeit, Durchfall bei sehr hohen Dosen; in der Regel sehr gut verträglich',
  external_url       = 'https://www.ncbi.nlm.nih.gov/pmc/articles/PMC5372953/'
WHERE id = 20;

-- Kollagen (id=17) – update
UPDATE ingredients SET
  category           = 'other',
  timing             = 'fasting',
  upper_limit        = NULL,
  upper_limit_unit   = NULL,
  upper_limit_note   = 'Kein UL etabliert; als Nahrungsprotein gilt Kollagen als sicher',
  description        = 'Strukturprotein des Bindegewebes. Typ I (Haut, Haare, Nägel, Knochen, Sehnen), Typ II (Gelenkknorpel), Typ III (Haut, Blutgefäße, innere Organe). Hydrolysiertes Kollagen (Kollagenhydrolysat/Peptide) wird am besten aufgenommen. Vitamin C ist essenzieller Cofaktor für die endogene Kollagensynthese (Hydroxylierung von Prolin/Lysin).',
  hypo_symptoms      = 'Faltige Haut, Gelenkschmerzen, brüchige Nägel/Haare, Knochenschwäche',
  hyper_symptoms     = 'Bei sehr hohen Mengen: Kalziumanstieg (bei kalziumreichem Kollagen); bei schlechter Qualität: Schwermetallkontamination',
  external_url       = 'https://www.ncbi.nlm.nih.gov/pmc/articles/PMC6566836/'
WHERE id = 17;

-- =========================================================================
-- STEP 2: Insert new ingredients (Ashwagandha, Rhodiola, Maca, Berberin,
--         Resveratrol, Curcumin, ALA, Melatonin)
-- =========================================================================

INSERT OR IGNORE INTO ingredients
  (id, name, unit, description, category, timing, upper_limit, upper_limit_unit, upper_limit_note, hypo_symptoms, hyper_symptoms, external_url)
VALUES
-- id=24 Ashwagandha
(24, 'Ashwagandha', 'mg',
 'Withania somnifera – zentrales Adaptogen des Ayurveda. Reguliert die HPA-Achse, senkt Cortisol, verbessert Schlafqualität, Stressresistenz und kognitive Leistung. Standardisierte Extrakte KSM-66 (5 % Withanolide, Vollspektrum-Wurzel) und Sensoril (10 % Withanolide, Wurzel+Blatt) sind am besten belegt.',
 'adaptogen', 'evening', 1500, 'mg',
 'Kein offizielles UL; bei 1500 mg/Tag in Studien sicher; Langzeitdaten über 6 Monate begrenzt',
 'Erschöpfung, Stressanfälligkeit, Schlafprobleme, erhöhte Cortisol-Level',
 'Schilddrüsenüberfunktion (kann TSH erhöhen), Magenreizung, Schläfrigkeit; KONTRAINDIZIERT in der Schwangerschaft (uterotonn) und bei Autoimmunerkrankungen',
 'https://www.ncbi.nlm.nih.gov/pmc/articles/PMC6979308/'),

-- id=25 Rhodiola rosea
(25, 'Rhodiola rosea', 'mg',
 'Rosenwurz – adaptogene Wurzel aus dem arktisch-alpinen Raum. Wirkstoffe Rosavine und Salidrosid hemmen MAO-A/B und beeinflussen Serotonin-/Dopamin-Transportproteine. Reduziert mentale Erschöpfung, verbessert Belastungstoleranz und Stimmung.',
 'adaptogen', 'morning', 680, 'mg',
 'Kein offizielles UL; EFSA-Sicherheitsbewertung positiv bis 680 mg/Tag bei standardisierten Extrakten',
 'Mentale Erschöpfung, Konzentrationsschwäche, Anpassungsstörungen unter Stress',
 'Schlaflosigkeit bei Einnahme am Abend, Unruhe, Schwindel bei hohen Dosen; Interaktion mit MAO-Hemmern und Antidepressiva',
 'https://www.ema.europa.eu/en/medicines/herbal/rhodiolae-roseae-rhizoma-et-radix'),

-- id=26 Maca
(26, 'Maca', 'mg',
 'Lepidium meyenii – peruanische Kreuzblütlerpflanze (Andenrettich). Kein klassisches Adaptogen im pharmakologischen Sinne, wirkt jedoch adaptogen-ähnlich auf Energie, Libido, Hormonstatus und Fertilität. Enthält Macamide, Macaene und Glucosinolate als Leitwirkstoffe.',
 'adaptogen', 'morning', 5000, 'mg',
 'Kein offizielles UL; traditionell in Peru als Nahrungsmittel in Mengen von 10–50 g/Tag verwendet',
 'Kein klassischer Mangel; bei Studie-Unterdosierung keine signifikanten Effekte',
 'Schlafstörungen bei Abendeinnahme; bei Schilddrüsenerkrankungen Vorsicht (Glucosinolate); selten gastrointestinale Beschwerden',
 'https://www.ncbi.nlm.nih.gov/pmc/articles/PMC3184420/'),

-- id=27 Berberin
(27, 'Berberin', 'mg',
 'Isochinolin-Alkaloid aus Berberis vulgaris (Berberitze), Goldenseal und anderen Pflanzen. Aktiviert AMPK (AMP-aktivierte Proteinkinase) ähnlich wie Metformin → verbessert Glukosetoleranz, Insulinsensitivität, Lipidprofil und Darmmikrobiom. Breit antimikrobiell.',
 'plant_extract', 'with_meal', 2000, 'mg',
 'Keine offiziellen Daten; in Studien bis 1500 mg/Tag gut vertragen; 2000 mg als Vorsichtsgrenze',
 'Erhöhter Blutzucker, Dyslipidämie, gestörte Darmflora',
 'Übelkeit, Verstopfung oder Durchfall (besonders zu Beginn), Blutdruckabfall; Neurotoxizität bei Überdosierung (experimentell)',
 'https://www.ncbi.nlm.nih.gov/pmc/articles/PMC6434235/'),

-- id=28 Resveratrol
(28, 'Resveratrol', 'mg',
 'Polyphenol (Stilbenoid) aus Traubenschalen, Rotwein und Japanischem Knöterich (Polygonum cuspidatum). Aktiviert SIRT1 (Sirtuin-1) und AMPK, hemmt NF-κB. Antioxidativ, kardioprotektiv, antiinflammatorisch. Trans-Resveratrol ist die bioaktive Form.',
 'plant_extract', 'with_meal', 1500, 'mg',
 'Kein offizielles UL; in Studien bis 5000 mg/Tag verabreicht ohne schwerwiegende UAW; 1500 mg als Praxisgrenze',
 'Kein klassischer Mangel',
 'Übelkeit, Durchfall bei hohen Dosen; Wechselwirkungen mit Antikoagulanzien; bei sehr hohen Dosen hormonerartige Effekte (Östrogenmimetikum)',
 'https://www.ncbi.nlm.nih.gov/pmc/articles/PMC7694580/'),

-- id=29 Curcumin
(29, 'Curcumin', 'mg',
 'Polyphenolischer Hauptwirkstoff der Kurkumawurzel (Curcuma longa). Potenter NF-κB-Inhibitor mit antiinflammatorischen, antioxidativen und neuroprotektiven Eigenschaften. Allein sehr schlechte Bioverfügbarkeit (<1 %); Piperin (BioPerine, 20 mg) steigert Absorption um bis zu 2000 %. Spezialisierte Formulierungen (BCM-95, Meriva, Mizellen-Curcumin) erhöhen Bioverfügbarkeit drastisch.',
 'plant_extract', 'with_meal', 8000, 'mg',
 'WHO ADI: 0–3 mg/kg KG/Tag; EFSA kein UL für Supplement-Curcumin; 8000 mg/Tag als Studienhöchstwert ohne schwere UAW',
 'Kein klassischer Mangel; chronische Entzündungsneigung ohne Supplementierung möglich',
 'Magenreizung, Gallenblasenstimulation (Vorsicht bei Gallensteinen); bei sehr hohen Dosen Leberwerte-Erhöhung möglich; Wechselwirkungen mit Antikoagulanzien',
 'https://www.ncbi.nlm.nih.gov/pmc/articles/PMC7199889/'),

-- id=30 Alpha-Liponsäure
(30, 'Alpha-Liponsäure', 'mg',
 'Schwefelhaltige Fettsäure (Thioktansäure/ALA) – NICHT zu verwechseln mit Alpha-Linolensäure (Omega-3-Fettsäure). Universelles Antioxidans: sowohl wasser- als auch fettlöslich. Cofaktor der mitochondrialen Energiegewinnung (Pyruvatdehydrogenase-Komplex). Regeneriert andere Antioxidanzien (Vitamin C, E, Glutathion). R-ALA ist die natürliche, bioaktivere Form.',
 'enzyme_coenzyme', 'fasting', 1800, 'mg',
 'Kein offizielles UL; in Studien bis 1800 mg/Tag untersucht',
 'Mitochondriale Dysfunktion, verringerte Antioxidanskapazität, neuropathische Beschwerden',
 'Übelkeit, Kopfschmerzen (besonders bei R-ALA nüchtern); kann Blutzucker senken (Vorsicht bei Diabetikern); Wechselwirkungen mit Schilddrüsenmedikamenten',
 'https://www.ncbi.nlm.nih.gov/pmc/articles/PMC6723188/'),

-- id=31 Melatonin
(31, 'Melatonin', 'mg',
 'Indolaminhormon der Zirbeldrüse, synthetisiert aus Tryptophan → Serotonin → Melatonin. Steuert den circadianen Rhythmus und Schlaf-Wach-Zyklus über MT1/MT2-Rezeptoren. Potentes Antioxidans. In Deutschland verschreibungspflichtig ab 2 mg (Ausnahme: Circadin 2 mg für Personen >55 Jahre). Kleine Dosen (0,5 mg) oft effektiver als hohe Dosen (10 mg). Nur für Kurzzeitanwendung.',
 'other', 'evening', 10, 'mg',
 'Kein offizielles UL; in Deutschland ab 2 mg rezeptpflichtig; physiologische Dosen: 0,5–1 mg',
 'Einschlafstörungen, Jetlag, gestörter Schlaf-Wach-Rhythmus bei Schichtarbeit',
 'Tagesmüdigkeit, Kopfschmerzen, Schwindel, kognitive Beeinträchtigung am nächsten Tag; NICHT bei Autoimmunerkrankungen (immunstimulierend); NICHT dauerhaft; NICHT in Schwangerschaft/Stillzeit',
 'https://www.ncbi.nlm.nih.gov/pmc/articles/PMC4334454/');

-- =========================================================================
-- STEP 3: Synonyme für alle Wirkstoffe
-- =========================================================================

-- Ginseng (id=4)
INSERT OR IGNORE INTO ingredient_synonyms (ingredient_id, synonym) VALUES
(4, 'Panax ginseng'),
(4, 'Koreanischer Ginseng'),
(4, 'Eleutherococcus senticosus'),
(4, 'Sibirischer Ginseng'),
(4, 'Taigawurzel'),
(4, 'Amerikanischer Ginseng'),
(4, 'Panax quinquefolius'),
(4, 'Ginsenoside'),
(4, 'KRG'),
(4, 'Eleutherosid');

-- OPC (id=18)
INSERT OR IGNORE INTO ingredient_synonyms (ingredient_id, synonym) VALUES
(18, 'Oligomere Proanthocyanidine'),
(18, 'Traubenkernextrakt'),
(18, 'Grape Seed Extract'),
(18, 'GSE'),
(18, 'Procyanidine'),
(18, 'Pycnogenol'),
(18, 'Vitis vinifera Extrakt');

-- Schwarzkümmelöl (id=6)
INSERT OR IGNORE INTO ingredient_synonyms (ingredient_id, synonym) VALUES
(6, 'Nigella sativa'),
(6, 'Thymochinon'),
(6, 'Black Seed Oil'),
(6, 'Schwarzkümmel'),
(6, 'Kalonji'),
(6, 'Habba Sauda'),
(6, 'Thymoquinone');

-- Grapefruitkernextrakt (id=7)
INSERT OR IGNORE INTO ingredient_synonyms (ingredient_id, synonym) VALUES
(7, 'GSE'),
(7, 'Grapefruit Seed Extract'),
(7, 'Citrus paradisi Extrakt'),
(7, 'Citricidal');

-- CoQ10 (id=15)
INSERT OR IGNORE INTO ingredient_synonyms (ingredient_id, synonym) VALUES
(15, 'CoQ10'),
(15, 'Ubiquinol'),
(15, 'Ubiquinon'),
(15, 'Q10'),
(15, 'Ubichinon'),
(15, 'Ubichinol'),
(15, 'Coenzyme Q10'),
(15, 'Mitoquinone');

-- Spirulina (id=21)
INSERT OR IGNORE INTO ingredient_synonyms (ingredient_id, synonym) VALUES
(21, 'Arthrospira platensis'),
(21, 'Arthrospira maxima'),
(21, 'Blaualge'),
(21, 'Blaugrünalge'),
(21, 'Spirulina platensis');

-- Chlorella (id=22)
INSERT OR IGNORE INTO ingredient_synonyms (ingredient_id, synonym) VALUES
(22, 'Chlorella vulgaris'),
(22, 'Chlorella pyrenoidosa'),
(22, 'Grünalge'),
(22, 'CGF'),
(22, 'Chlorella Growth Factor');

-- Zeolith (id=23)
INSERT OR IGNORE INTO ingredient_synonyms (ingredient_id, synonym) VALUES
(23, 'Klinoptilolith'),
(23, 'Clinoptilolite'),
(23, 'Zeolite'),
(23, 'Vulkanmineral');

-- MSM (id=20)
INSERT OR IGNORE INTO ingredient_synonyms (ingredient_id, synonym) VALUES
(20, 'Methylsulfonylmethan'),
(20, 'Dimethylsulfon'),
(20, 'DMSO2'),
(20, 'Organischer Schwefel'),
(20, 'OptiMSM');

-- Kollagen (id=17)
INSERT OR IGNORE INTO ingredient_synonyms (ingredient_id, synonym) VALUES
(17, 'Collagen'),
(17, 'Kollagenhydrolysat'),
(17, 'Hydrolysiertes Kollagen'),
(17, 'Collagen Peptides'),
(17, 'Kollagenpeptide'),
(17, 'Gelatine'),
(17, 'Typ I Kollagen'),
(17, 'Typ II Kollagen'),
(17, 'Typ III Kollagen'),
(17, 'Verisol'),
(17, 'Peptan');

-- Ashwagandha (id=24)
INSERT OR IGNORE INTO ingredient_synonyms (ingredient_id, synonym) VALUES
(24, 'Withania somnifera'),
(24, 'KSM-66'),
(24, 'Sensoril'),
(24, 'Schlafbeere'),
(24, 'Winterkirsche'),
(24, 'Indian Ginseng'),
(24, 'Withanolide'),
(24, 'Ashwagandha Root'),
(24, 'Shoden');

-- Rhodiola (id=25)
INSERT OR IGNORE INTO ingredient_synonyms (ingredient_id, synonym) VALUES
(25, 'Rosenwurz'),
(25, 'Rhodiola'),
(25, 'Golden Root'),
(25, 'Arctic Root'),
(25, 'SHR-5'),
(25, 'Rosavine'),
(25, 'Salidrosid'),
(25, 'Sedum roseum');

-- Maca (id=26)
INSERT OR IGNORE INTO ingredient_synonyms (ingredient_id, synonym) VALUES
(26, 'Lepidium meyenii'),
(26, 'Lepidium peruvianum'),
(26, 'Peruanischer Ginseng'),
(26, 'Andenrettich'),
(26, 'Macamide'),
(26, 'Maca Wurzel');

-- Berberin (id=27)
INSERT OR IGNORE INTO ingredient_synonyms (ingredient_id, synonym) VALUES
(27, 'Berberine'),
(27, 'Berberis vulgaris'),
(27, 'Berberitze'),
(27, 'Goldenseal'),
(27, 'Berberinhydrochlorid'),
(27, 'BBR');

-- Resveratrol (id=28)
INSERT OR IGNORE INTO ingredient_synonyms (ingredient_id, synonym) VALUES
(28, 'Trans-Resveratrol'),
(28, 'Resveratrolo'),
(28, 'Polygonum cuspidatum'),
(28, 'Japanischer Knöterich Extrakt'),
(28, 'Stilbenoid'),
(28, 'Pterostilben');

-- Curcumin (id=29)
INSERT OR IGNORE INTO ingredient_synonyms (ingredient_id, synonym) VALUES
(29, 'Curcuma longa'),
(29, 'Kurkuma'),
(29, 'Tumeric'),
(29, 'BCM-95'),
(29, 'Meriva'),
(29, 'Theracurmin'),
(29, 'Longvida'),
(29, 'Liposomales Curcumin'),
(29, 'Mizellen-Curcumin'),
(29, 'Curcuminoide');

-- ALA (id=30)
INSERT OR IGNORE INTO ingredient_synonyms (ingredient_id, synonym) VALUES
(30, 'Thioktansäure'),
(30, 'Thioctacid'),
(30, 'ALA'),
(30, 'R-ALA'),
(30, 'Alpha-Lipoic Acid'),
(30, 'Lipoic Acid'),
(30, 'R-Liponsäure'),
(30, 'Na-R-ALA'),
(30, 'R-DHLA');

-- Melatonin (id=31)
INSERT OR IGNORE INTO ingredient_synonyms (ingredient_id, synonym) VALUES
(31, 'N-Acetyl-5-methoxytryptamine'),
(31, 'Schlafhormon'),
(31, 'Circadin'),
(31, 'MLT'),
(31, 'Zirbeldrüsenhormon');

-- =========================================================================
-- STEP 4: Ingredient Forms (Unterformen mit Bioverfügbarkeit und Scoring)
-- =========================================================================

-- GINSENG (id=4) Formen
INSERT OR IGNORE INTO ingredient_forms (ingredient_id, name, comment, score, bioavailability, timing, is_recommended) VALUES
(4, 'Panax ginseng Standardextrakt (G115)', 'Klassischer Koreaginseng-Extrakt, standardisiert auf 4 % Ginsenoside. Breite Studienbasis. Marke Ginsana/Pharmaton.', 8, 'high', 'morning', 1),
(4, 'KRG (Korean Red Ginseng)', 'Gedämpfter und getrockneter Ginseng – höherer Gehalt an Ginsenosiden Rg3 und Rh2. Stärkere adaptogene Wirkung.', 9, 'high', 'morning', 1),
(4, 'Eleutherococcus senticosus Extrakt', 'Sibirischer/Taigawurzel-Extrakt. Andere Wirkstoffe (Eleutherosid B, E). Milder adaptogen, gut für Langzeitanwendung.', 7, 'medium', 'morning', 0),
(4, 'Amerikanischer Ginseng (Panax quinquefolius)', 'Kühlendere Wirkung, stärker sedierend; enthält mehr Rb1-Ginsenoside. Geeignet für ältere Personen.', 7, 'high', 'morning', 0),
(4, 'Pulverisierte Ginsengwurzel', 'Rohes Pulver ohne Standardisierung; variable Wirkstoffmenge. Nicht empfohlen für therapeutische Dosierung.', 4, 'low', 'morning', -1);

-- ASHWAGANDHA (id=24) Formen
INSERT OR IGNORE INTO ingredient_forms (ingredient_id, name, comment, score, bioavailability, timing, is_recommended) VALUES
(24, 'KSM-66', 'Gold-Standard: Vollspektrum-Wurzelextrakt, standardisiert auf min. 5 % Withanolide. Herstellungsverfahren ohne Alkohol. Hervorragende Studienbasis (Cortisol, Schlaf, Testosteron, kognitive Funktion).', 10, 'high', 'evening', 1),
(24, 'Sensoril', 'Extrakt aus Wurzel + Blatt, standardisiert auf 10 % Withanolide + Withaferin A. Höhere Withanolidkonzentration; möglicherweise stärker beruhigend. Weniger Studiendaten als KSM-66.', 8, 'high', 'evening', 1),
(24, 'Shoden', 'Standardisiert auf 35 % Withanoglycosid-Komplex. Höchste Withanolid-Konzentration; erste Studien vielversprechend; Evidenzbasis noch begrenzt.', 7, 'high', 'evening', 0),
(24, 'Rohpulver / nicht standardisierter Extrakt', 'Variable Withanolid-Konzentration. Für Supplementierung ungeeignet – keine verlässliche Dosierung.', 3, 'low', 'evening', -1);

-- RHODIOLA (id=25) Formen
INSERT OR IGNORE INTO ingredient_forms (ingredient_id, name, comment, score, bioavailability, timing, is_recommended) VALUES
(25, 'Rhodiola rosea Standardextrakt (3 % Rosavine / 1 % Salidrosid)', 'Klassisches 3:1-Verhältnis Rosavine:Salidrosid. Marken: SHR-5 (Schweden), Rosavin. Bestdokumentiertes Verhältnis in klinischen Studien.', 9, 'high', 'morning', 1),
(25, 'Rhodiola rosea Extrakt (1 % Salidrosid)', 'Nur auf Salidrosid standardisiert. Weniger repräsentativ für klassische klinische Studien.', 6, 'medium', 'morning', 0),
(25, 'Rhodiola Rohpulver', 'Nicht standardisiert; unkontrollierter Wirkstoffgehalt. Nicht für Supplementierung geeignet.', 3, 'low', 'morning', -1);

-- MACA (id=26) Formen
INSERT OR IGNORE INTO ingredient_forms (ingredient_id, name, comment, score, bioavailability, timing, is_recommended) VALUES
(26, 'Gelatiniertes Maca Pulver', 'Hitzebehandlung entfernt Stärke und Glucosinolate → besser verdaulich, konzentrierter, höhere Bioverfügbarkeit der Macamide.', 9, 'high', 'morning', 1),
(26, 'Maca Rohpulver', 'Enthält intakte Stärke → schwerer verdaulich; Glucosinolate können Schilddrüse beeinflussen. Traditionelle Form.', 6, 'medium', 'morning', 0),
(26, 'Maca Extrakt (Flüssig/Kapseln)', 'Standardisierter Extrakt; praktischer als Pulver; Konzentrationsverhältnisse variieren stark je Hersteller.', 7, 'high', 'morning', 0);

-- OPC (id=18) Formen
INSERT OR IGNORE INTO ingredient_forms (ingredient_id, name, comment, score, bioavailability, timing, is_recommended) VALUES
(18, 'Traubenkernextrakt (95 % OPC)', 'Hochkonzentrierter Extrakt aus Vitis vinifera Kernen. Beste Evidenzbasis. Standardisiert auf 95 % OPC.', 9, 'high', 'morning', 1),
(18, 'Pycnogenol (Kiefernrindenextrakt)', 'Proprietärer Extrakt aus Pinus pinaster Rinde. Ähnliche OPC-Zusammensetzung, zusätzlich Procyanidine. Sehr gute Studienbasis zu Gefäßgesundheit und Entzündung.', 9, 'high', 'morning', 1),
(18, 'Rotweinextrakt (OPC + Resveratrol)', 'Kombinationsextrakt mit Resveratrol. Niedrigerer OPC-Gehalt; Synergie möglich aber schlechtere Standardisierung.', 6, 'medium', 'morning', 0);

-- SCHWARZKÜMMELÖL (id=6) Formen
INSERT OR IGNORE INTO ingredient_forms (ingredient_id, name, comment, score, bioavailability, timing, is_recommended) VALUES
(6, 'Kaltgepresstes Schwarzkümmelöl', 'Nativestes Öl mit höchstem Thymochinon-Gehalt (~1,5–2 %). Kaltpressung erhält flüchtige Wirkstoffe.', 9, 'high', 'with_meal', 1),
(6, 'Schwarzkümmelöl Kapseln (Weichkapseln)', 'Praktische Darreichungsform; leicht oxidationsgeschützt durch Kapsel. Geringfügiger Qualitätsverlust durch Verarbeitung.', 8, 'high', 'with_meal', 1),
(6, 'Thymochinon-angereicherter Extrakt', 'Höherer Thymochinon-Anteil als natives Öl; stärkere therapeutische Wirkung möglich; weniger Daten zu Langzeitsicherheit.', 7, 'very_high', 'with_meal', 0);

-- GRAPEFRUITKERNEXTRAKT (id=7) Formen
INSERT OR IGNORE INTO ingredient_forms (ingredient_id, name, comment, score, bioavailability, timing, is_recommended) VALUES
(7, 'GSE Flüssigtropfen (hochkonzentriert)', 'Klassische Darreichungsform; bitter; direkte antimikrobielle Wirkung im GI-Trakt möglich.', 6, 'medium', 'with_meal', 0),
(7, 'GSE Kapseln', 'Praktischer, geschmacksneutral; ähnliche Wirkung. Bevorzugte Darreichungsform für Supplementierung.', 6, 'medium', 'with_meal', 0);

-- BERBERIN (id=27) Formen
INSERT OR IGNORE INTO ingredient_forms (ingredient_id, name, comment, score, bioavailability, timing, is_recommended) VALUES
(27, 'Berberinhydrochlorid', 'Standardform in klinischen Studien. Geringe orale Bioverfügbarkeit (~5 %) durch P-gp und First-Pass-Effekt → Aufteilung in 3× täglich.', 7, 'low', 'with_meal', 1),
(27, 'Dihydroberberine (DHB)', 'Reduzierte Form mit ca. 5-fach höherer Bioverfügbarkeit als Standard-Berberin. Wird im Körper zu aktivem Berberin oxidiert. Geringere GI-Beschwerden.', 9, 'high', 'with_meal', 1),
(27, 'Berberin-Phytosom (Berbevis)', 'Lecthin-gebundenes Berberin (Indena); deutlich verbesserte Absorption; einmal täglich möglich.', 8, 'high', 'with_meal', 1);

-- RESVERATROL (id=28) Formen
INSERT OR IGNORE INTO ingredient_forms (ingredient_id, name, comment, score, bioavailability, timing, is_recommended) VALUES
(28, 'Trans-Resveratrol (aus Polygonum cuspidatum)', 'Bioaktivste Form. Aus Japanischem Knöterich; hochstandardisiert bis 98 % Trans-Resveratrol. Standard in Studien.', 9, 'high', 'with_meal', 1),
(28, 'Liposomales Resveratrol', 'Erhöhte Bioverfügbarkeit durch Liposomeneinschluss; verhindert schnelle Metabolisierung.', 9, 'very_high', 'with_meal', 1),
(28, 'Resveratrol aus Rotweinextrakt', 'Sehr geringer Resveratrol-Gehalt; therapeutische Dosen nicht erreichbar. Für Dosierung ungeeignet.', 2, 'low', 'with_meal', -1),
(28, 'Pterostilben', 'Dimethylether-Analogon des Resveratrol. Bessere Bioverfügbarkeit und längere Halbwertszeit. Zunehmend als Alternative eingesetzt.', 8, 'very_high', 'with_meal', 1);

-- CURCUMIN (id=29) Formen
INSERT OR IGNORE INTO ingredient_forms (ingredient_id, name, comment, score, bioavailability, timing, is_recommended) VALUES
(29, 'Curcumin + Piperin (BioPerine)', 'Piperinzusatz (20 mg) steigert Curcumin-Absorption um bis zu 2000 %. Standard-Kombination; kostengünstig; First Choice.', 8, 'high', 'with_meal', 1),
(29, 'BCM-95 (Biocurcumax)', 'Curcumin + ätherische Kurkumaöle. 6,3-fach bessere Absorption als reines Curcumin, ohne Piperin. Gut für Personen ohne Piperinverträglichkeit.', 9, 'high', 'with_meal', 1),
(29, 'Meriva (Curcumin-Phytosom)', 'Lecithin-gebundenes Curcumin (Indena). 29-fach bessere Bioverfügbarkeit als Standard-Curcumin. Sehr gut belegt bei Gelenkentzündung.', 9, 'very_high', 'with_meal', 1),
(29, 'Theracurmin', 'Kolloidales Curcumin; Nanopartikelgröße erhöht Löslichkeit drastisch. 27-fach höhere AUC als reines Curcumin.', 9, 'very_high', 'with_meal', 1),
(29, 'Mizellen-Curcumin (Lipocurc)', 'Mizellare Formulierung; sehr hohe Bioverfügbarkeit; flüssige Darreichungsform. Gut geeignet für höhere Dosierungen.', 9, 'very_high', 'with_meal', 1),
(29, 'Curcumin Rohpulver / Standard-Extrakt ohne Zusatz', 'Ohne Bioverfügbarkeitsenhancer: <1 % Absorption. Für therapeutische Zwecke völlig ungeeignet.', 1, 'very_low', 'with_meal', -1);

-- CoQ10 (id=15) Formen
INSERT OR IGNORE INTO ingredient_forms (ingredient_id, name, comment, score, bioavailability, timing, is_recommended) VALUES
(15, 'Ubiquinol (reduzierte Form, QH)', 'Biologisch aktive, bereits reduzierte Form. Keine Umwandlung nötig. Signifikant bessere Absorption als Ubiquinon. Ab 40 Jahren dringend bevorzugt; bei Statin-Einnahme essenziell. Dosis: 100–200 mg/Tag.', 10, 'very_high', 'with_meal', 1),
(15, 'Ubiquinon (oxidierte Form)', 'Klassische, günstigere Form. Muss im Körper zu Ubiquinol reduziert werden. Unter 40 Jahren ausreichend wirksam. Dosis: 200–300 mg/Tag für äquivalente Wirkung. Bei verminderter Umwandlungskapazität suboptimal.', 6, 'medium', 'with_meal', 0),
(15, 'Mikronisiertes/Nanopartikelbasiertes CoQ10', 'Verbesserte Löslichkeit durch Partikelreduktion; ähnliche oder bessere Absorption als Standard-Ubiquinon; günstiger als Ubiquinol.', 7, 'high', 'with_meal', 0);

-- ALA (id=30) Formen
INSERT OR IGNORE INTO ingredient_forms (ingredient_id, name, comment, score, bioavailability, timing, is_recommended) VALUES
(30, 'R-Alpha-Liponsäure (R-ALA)', 'Natürliche, rechtsdrehende Form. Höhere Bioverfügbarkeit als Racemat. Stärkere mitochondriale und antioxidative Wirkung. Bevorzugt nüchtern einnehmen.', 10, 'high', 'fasting', 1),
(30, 'Na-R-ALA (Natriumsalz der R-ALA)', 'Stabilisierte Form der R-ALA. Verhindert Polymerisation; sehr hohe Bioverfügbarkeit; schnelle Absorption. Gold-Standard.', 10, 'very_high', 'fasting', 1),
(30, 'R/S-ALA (Racemat)', 'Synthetische Mischung aus R- und S-Form. Günstig; S-ALA ist biologisch inaktiv und kann R-ALA-Aufnahme teilweise hemmen. Immer noch wirksam aber suboptimal.', 6, 'medium', 'fasting', 0);

-- SPIRULINA (id=21) Formen
INSERT OR IGNORE INTO ingredient_forms (ingredient_id, name, comment, score, bioavailability, timing, is_recommended) VALUES
(21, 'Spirulina Pulver', 'Flexible Dosierung; ideal in Smoothies. Auf Schwermetallfreiheit und Anbauqualität (kein Wildsammlung) achten.', 8, 'high', 'morning', 1),
(21, 'Spirulina Presslinge/Tabletten', 'Praktische Alternative; keine Geschmacksbelästigung. Leicht geringere Verdaulichkeit als Pulver möglich.', 7, 'high', 'morning', 1);

-- CHLORELLA (id=22) Formen
INSERT OR IGNORE INTO ingredient_forms (ingredient_id, name, comment, score, bioavailability, timing, is_recommended) VALUES
(22, 'Chlorella (Zellwand aufgebrochen)', 'Essenziell: Chlorella-Zellwand ist unverdaulich – nur aufgebrochene Zellen setzen Nährstoffe frei. Druckknacktechnologie bevorzugt.', 9, 'high', 'morning', 1),
(22, 'Chlorella Rohpulver (nicht aufgebrochen)', 'Nährstoffe nicht bioverfügbar; CGF und Chlorophyll bleiben in Zellwand eingeschlossen. Nicht für Supplementierung geeignet.', 2, 'very_low', 'morning', -1);

-- ZEOLITH (id=23) Formen
INSERT OR IGNORE INTO ingredient_forms (ingredient_id, name, comment, score, bioavailability, timing, is_recommended) VALUES
(23, 'Aktiviertes Klinoptilolith-Pulver (MANC)', 'Mikronisiertes und aktiviertes Zeolith mit nachgewiesener Detoxkapazität. Produkte wie Panaceo oder Leuchtturm Zeolit.', 8, 'medium', 'fasting', 1),
(23, 'Zeolith Rohpulver (nicht aktiviert)', 'Geringere Reinheit und Adsorptionskapazität. Für gezielte Entgiftung weniger geeignet.', 5, 'low', 'fasting', 0);

-- MSM (id=20) Formen
INSERT OR IGNORE INTO ingredient_forms (ingredient_id, name, comment, score, bioavailability, timing, is_recommended) VALUES
(20, 'OptiMSM (destilliertes MSM)', 'Höchste Reinheit (>99,9 %); destilliert statt kristallisiert; frei von Verunreinigungen. Gold-Standard in klinischen Studien.', 10, 'very_high', 'with_meal', 1),
(20, 'MSM-Kristallpulver', 'Kristallisiertes MSM; günstig; sehr gut löslich; ausreichende Qualität wenn aus seriöser Quelle.', 8, 'very_high', 'with_meal', 1),
(20, 'MSM Kapseln/Tabletten', 'Praktische Darreichungsform; keine Geschmacksbedenken; leichte Bioverfügbarkeitsnachteile durch Tablettenmatrix möglich.', 7, 'high', 'with_meal', 0);

-- KOLLAGEN (id=17) Formen
INSERT OR IGNORE INTO ingredient_forms (ingredient_id, name, comment, score, bioavailability, timing, is_recommended) VALUES
(17, 'Hydrolysiertes Kollagen Typ I (Verisol / Peptan)', 'Kollagenpeptide aus Rinds- oder Fischhaut. Kleinste Peptide (1–5 kDa) → beste Resorption über Dünndarm. Typ I: Haut, Haare, Nägel, Knochen. Auf nüchternen Magen oder nach Training.', 10, 'very_high', 'fasting', 1),
(17, 'Hydrolysiertes Kollagen Typ II (UC-II)', 'Nicht-denaturiertes Kollagen Typ II aus Hühnersternal. Wirkt über oraler Toleranzinduktion im Darm (niedrig dosiert ~40 mg). Für Gelenkknorpel.', 9, 'high', 'fasting', 1),
(17, 'Marines Kollagen Hydrolysat', 'Aus Fischknochen/-haut; Typ I dominant; sehr kleine Peptide → exzellente Bioverfügbarkeit. Halal/vegetarisch ungeeignet. Nachhaltigkeitsfrage.', 9, 'very_high', 'fasting', 1),
(17, 'Bovines Kollagen Hydrolysat', 'Aus Rinderhaut/-knochen; Typ I + III; gute Bioverfügbarkeit. Am häufigsten verfügbar; kostengünstig.', 8, 'high', 'fasting', 1),
(17, 'Gelatine (partiell hydrolysiert)', 'Nicht vollständig hydrolysiert; größere Peptide → schlechtere Absorption. Traditionelle Form; als Lebensmittel geeignet aber für Supplementierung inferior.', 5, 'medium', 'fasting', 0),
(17, 'Natürliches Kollagen (Rohprotein, nicht hydrolysiert)', 'Unverdaulich als intaktes Protein; nahezu keine therapeutische Bioverfügbarkeit. Nicht für Supplementierung geeignet.', 1, 'very_low', 'fasting', -1);

-- MELATONIN (id=31) Formen
INSERT OR IGNORE INTO ingredient_forms (ingredient_id, name, comment, score, bioavailability, timing, is_recommended) VALUES
(31, 'Melatonin Sublingual (0,5–1 mg)', 'Schnellste Resorption; umgeht First-Pass-Effekt; ideale Dosierung 0,5 mg. Physiologische Dosis für Einschlafförderung und Jetlag.', 10, 'very_high', 'evening', 1),
(31, 'Melatonin Tabletten/Kapseln (0,5–1 mg)', 'Standardform; erste Wahl für Schlafphasenverschiebung und Jetlag. Niedrige Dosierung bevorzugen.', 9, 'high', 'evening', 1),
(31, 'Retardiertes Melatonin (Circadin 2 mg)', 'Verzögerte Freisetzung über 8–10 Stunden; nachgeahmt natürliches nächtliches Melatonin-Profil. Zugelassenes Arzneimittel (DE) für Personen >55 Jahre.', 8, 'medium', 'evening', 1),
(31, 'Melatonin Hochdosis (5–10 mg)', 'Unnötig hohe Dosis – kann zu Tagesmüdigkeit und Desensibilisierung der MT-Rezeptoren führen. Cave: Rezeptpflicht in DE ab 2 mg. Nur in Ausnahmefällen (Schichtarbeit, schwerer Jetlag).', 3, 'high', 'evening', -1);

-- =========================================================================
-- STEP 5: Dosage Guidelines
-- =========================================================================

-- GINSENG (id=4)
INSERT OR IGNORE INTO dosage_guidelines (ingredient_id, source, source_url, source_title, population, dose_min, dose_max, unit, frequency, timing, notes, is_default) VALUES
(4, 'study', 'https://www.ncbi.nlm.nih.gov/pmc/articles/PMC7834807/', 'Efficacy of Panax ginseng supplementation – Meta-Analysis 2021', 'adult', 200, 400, 'mg', 'daily', 'morning', 'Standardextrakt G115 oder gleichwertiger Extrakt. 4–12 Wochen Anwendung, danach 2–4 Wochen Pause.', 1),
(4, 'study', 'https://www.ncbi.nlm.nih.gov/pmc/articles/PMC7834807/', 'Panax ginseng – Kognitiver Nutzen', 'adult', 400, 800, 'mg', 'daily', 'morning', 'KRG (Korean Red Ginseng) bei kognitiven Zielen (Gedächtnis, Reaktionszeit)', 0),
(4, 'practice', NULL, 'Sibirischer Ginseng (Eleutherococcus)', 'adult', 300, 1200, 'mg', 'daily', 'morning', 'Eleutherococcus-Extrakt; standardisiert auf Eleutherosid E; 6–8 Wochen Kur', 0);

-- ASHWAGANDHA (id=24)
INSERT OR IGNORE INTO dosage_guidelines (ingredient_id, source, source_url, source_title, population, dose_min, dose_max, unit, frequency, timing, notes, is_default) VALUES
(24, 'study', 'https://www.ncbi.nlm.nih.gov/pmc/articles/PMC6979308/', 'Adaptogenic and Anxiolytic Effects of Ashwagandha Root Extract – RCT', 'adult', 300, 600, 'mg', 'daily', 'evening', 'KSM-66 Extrakt (5 % Withanolide). Einnahme abends wegen entspannend-sedierender Wirkung. Mindestdauer 8 Wochen.', 1),
(24, 'study', 'https://www.ncbi.nlm.nih.gov/pmc/articles/PMC6979308/', 'Sensoril-Dosierung', 'adult', 125, 250, 'mg', 'daily', 'evening', 'Sensoril (10 % Withanolide): niedrigere Dosis notwendig aufgrund höherer Withanolid-Konzentration', 0),
(24, 'practice', NULL, 'Ashwagandha bei Schlaf', 'adult', 600, 600, 'mg', 'daily', 'evening', 'KSM-66 600 mg abends bei Schlafstörungen und Cortisolreduktion; Studiendauer 8–12 Wochen', 0);

-- RHODIOLA (id=25)
INSERT OR IGNORE INTO dosage_guidelines (ingredient_id, source, source_url, source_title, population, dose_min, dose_max, unit, frequency, timing, notes, is_default) VALUES
(25, 'study', 'https://www.ema.europa.eu/en/medicines/herbal/rhodiolae-roseae-rhizoma-et-radix', 'EMA Rhodiola rosea Monographie', 'adult', 144, 400, 'mg', 'daily', 'morning', 'Standardextrakt 3 % Rosavine / 1 % Salidrosid. 30 Minuten vor Mahlzeit. Nicht abends (stimulierend). Max. 12 Wochen kontinuierlich.', 1),
(25, 'study', 'https://www.ncbi.nlm.nih.gov/pmc/articles/PMC6208354/', 'Rhodiola rosea für Burnout und Stress – Klinische Studie', 'adult', 400, 680, 'mg', 'daily', 'morning', 'Höhere Dosen (400–680 mg) bei Burnout und chronischer Erschöpfung; SHR-5 Extrakt', 0);

-- MACA (id=26)
INSERT OR IGNORE INTO dosage_guidelines (ingredient_id, source, source_url, source_title, population, dose_min, dose_max, unit, frequency, timing, notes, is_default) VALUES
(26, 'study', 'https://www.ncbi.nlm.nih.gov/pmc/articles/PMC3184420/', 'Maca (Lepidium meyenii) – Systematischer Review', 'adult', 1500, 3000, 'mg', 'daily', 'morning', 'Gelatiniertes Maca bevorzugt. 1,5–3 g/Tag für Libido, Fertilität und Energieniveau. 6–12 Wochen Anwendungsdauer.', 1),
(26, 'practice', NULL, 'Maca traditionell / Sport', 'athlete', 5000, 5000, 'mg', 'daily', 'morning', 'Bis 5 g/Tag traditionelle peruanische Verwendung; bei Sportlern zur Ausdauerleistung diskutiert', 0);

-- OPC (id=18)
INSERT OR IGNORE INTO dosage_guidelines (ingredient_id, source, source_url, source_title, population, dose_min, dose_max, unit, frequency, timing, notes, is_default) VALUES
(18, 'study', 'https://www.ncbi.nlm.nih.gov/pmc/articles/PMC4690266/', 'Grape Seed Extract Health Benefits – Review', 'adult', 100, 300, 'mg', 'daily', 'morning', 'Traubenkernextrakt (95 % OPC). 100–300 mg/Tag für Antioxidansschutz und Gefäßgesundheit.', 1),
(18, 'study', NULL, 'Pycnogenol Dosierung', 'adult', 50, 200, 'mg', 'daily', 'morning', 'Pycnogenol (Kiefernrindenextrakt): 50–200 mg/Tag; bei Venenproblemen und chronischer Entzündung', 0);

-- SCHWARZKÜMMELÖL (id=6)
INSERT OR IGNORE INTO dosage_guidelines (ingredient_id, source, source_url, source_title, population, dose_min, dose_max, unit, frequency, timing, notes, is_default) VALUES
(6, 'study', 'https://www.ncbi.nlm.nih.gov/pmc/articles/PMC3642442/', 'Nigella sativa – Therapeutic Review', 'adult', 1000, 3000, 'mg', 'daily', 'with_meal', '1–3 g Schwarzkümmelöl/Tag (aufgeteilt auf 2 Mahlzeiten). Mit Mahlzeit zur Reduktion von Magenreizungen.', 1);

-- GRAPEFRUITKERNEXTRAKT (id=7)
INSERT OR IGNORE INTO dosage_guidelines (ingredient_id, source, source_url, source_title, population, dose_min, dose_max, unit, frequency, timing, notes, is_default) VALUES
(7, 'practice', NULL, 'GSE – Praxisdosierung', 'adult', 100, 500, 'mg', 'daily', 'with_meal', 'Keine offiziellen Dosisempfehlungen; Praxisbereich 100–500 mg/Tag. Kurzfristig bei mikrobieller Belastung. Wechselwirkungen mit CYP3A4-Substraten beachten.', 1);

-- BERBERIN (id=27)
INSERT OR IGNORE INTO dosage_guidelines (ingredient_id, source, source_url, source_title, population, dose_min, dose_max, unit, frequency, timing, notes, is_default) VALUES
(27, 'study', 'https://www.ncbi.nlm.nih.gov/pmc/articles/PMC6434235/', 'Berberine and T2DM – Meta-Analysis', 'adult', 900, 1500, 'mg', 'daily', 'with_meal', '3× täglich 300–500 mg jeweils VOR den Hauptmahlzeiten. Kurze Halbwertszeit erfordert Aufteilung. Studiendauer 8–12 Wochen.', 1),
(27, 'study', 'https://www.ncbi.nlm.nih.gov/pmc/articles/PMC6434235/', 'Dihydroberberine (DHB) Äquivalenz', 'adult', 200, 400, 'mg', 'daily', 'with_meal', 'DHB: 200–400 mg/Tag; ca. 5-fach bioverfügbarer als Berberinhydrochlorid. Geringere GI-Beschwerden.', 0);

-- RESVERATROL (id=28)
INSERT OR IGNORE INTO dosage_guidelines (ingredient_id, source, source_url, source_title, population, dose_min, dose_max, unit, frequency, timing, notes, is_default) VALUES
(28, 'study', 'https://www.ncbi.nlm.nih.gov/pmc/articles/PMC7694580/', 'Resveratrol – Clinical Trials Review', 'adult', 100, 500, 'mg', 'daily', 'with_meal', 'Trans-Resveratrol aus Polygonum cuspidatum. 100–500 mg/Tag für kardiovaskuläre und metabolische Effekte. Mit fetthaltiger Mahlzeit für bessere Absorption.', 1),
(28, 'study', NULL, 'Resveratrol Antialterung/Longevity', 'adult', 500, 1000, 'mg', 'daily', 'with_meal', 'Höhere Dosen (500–1000 mg) für SIRT1-Aktivierung und Longevity-Protokolle; liposomale Form bevorzugt', 0);

-- CURCUMIN (id=29)
INSERT OR IGNORE INTO dosage_guidelines (ingredient_id, source, source_url, source_title, population, dose_min, dose_max, unit, frequency, timing, notes, is_default) VALUES
(29, 'study', 'https://www.ncbi.nlm.nih.gov/pmc/articles/PMC7199889/', 'Curcumin Bioavailability and Clinical Evidence – Review', 'adult', 500, 1000, 'mg', 'daily', 'with_meal', 'Curcumin + 20 mg Piperin (BioPerine): 500–1000 mg/Tag. Mit fettreicher Mahlzeit. Aufteilung in 2 Dosen empfohlen.', 1),
(29, 'study', NULL, 'BCM-95 / Meriva Dosierung', 'adult', 250, 500, 'mg', 'daily', 'with_meal', 'Bioverfügbarkeitsformulierungen (BCM-95, Meriva): Niedrigere Dosis ausreichend aufgrund 6–29-fach besserer Absorption', 0),
(29, 'practice', NULL, 'Curcumin bei chronischen Entzündungen', 'adult', 1000, 2000, 'mg', 'daily', 'with_meal', 'Höhere Dosen bei Arthritis/chronischen Entzündungen; liposomales oder Mizellen-Curcumin bevorzugt', 0);

-- CoQ10 (id=15)
INSERT OR IGNORE INTO dosage_guidelines (ingredient_id, source, source_url, source_title, population, dose_min, dose_max, unit, frequency, timing, notes, is_default) VALUES
(15, 'study', 'https://ods.od.nih.gov/factsheets/CoQ10-HealthProfessional/', 'NIH Office of Dietary Supplements – CoQ10', 'adult', 100, 200, 'mg', 'daily', 'with_meal', 'Ubiquinol bevorzugt (besonders ab 40 Jahren). Mit fetthaltiger Mahlzeit (fettlöslich). Effektiv für mitochondriale Funktion und Herzgesundheit.', 1),
(15, 'study', NULL, 'CoQ10 bei Statin-Einnahme', 'adult', 200, 400, 'mg', 'daily', 'with_meal', 'Bei Statin-Einnahme: höhere Dosis (200–400 mg) notwendig, da Statine endogene CoQ10-Synthese über Mevalonatweg hemmen. Ubiquinol dringend bevorzugt.', 0),
(15, 'study', NULL, 'Ubiquinon (unter 40 Jahren)', 'adult', 200, 300, 'mg', 'daily', 'with_meal', 'Ubiquinon bei Personen unter 40: 200–300 mg für äquivalente Wirkung zu 100–200 mg Ubiquinol', 0);

-- ALA (id=30)
INSERT OR IGNORE INTO dosage_guidelines (ingredient_id, source, source_url, source_title, population, dose_min, dose_max, unit, frequency, timing, notes, is_default) VALUES
(30, 'study', 'https://www.ncbi.nlm.nih.gov/pmc/articles/PMC6723188/', 'Alpha-Lipoic Acid – Mechanisms and Clinical Use', 'adult', 300, 600, 'mg', 'daily', 'fasting', 'R-ALA oder Na-R-ALA bevorzugt. Nüchtern einnehmen (30 min vor Mahlzeit) für maximale Absorption. Aufteilung in 2× täglich möglich.', 1),
(30, 'study', NULL, 'ALA bei diabetischer Neuropathie', 'adult', 600, 1800, 'mg', 'daily', 'fasting', 'Bei diabetischer Neuropathie: 600–1800 mg/Tag (aufgeteilt); IV-Gabe in klinischen Studien üblich', 0);

-- SPIRULINA (id=21)
INSERT OR IGNORE INTO dosage_guidelines (ingredient_id, source, source_url, source_title, population, dose_min, dose_max, unit, frequency, timing, notes, is_default) VALUES
(21, 'study', 'https://www.ncbi.nlm.nih.gov/pmc/articles/PMC3136577/', 'Spirulina – Human Health Effects', 'adult', 1, 8, 'g', 'daily', 'morning', '1–8 g/Tag; mit Wasser oder im Smoothie morgens. Auf Schwermetallfreiheit und Cyanotoxin-Freiheit des Produkts achten (Zertifizierung).', 1);

-- CHLORELLA (id=22)
INSERT OR IGNORE INTO dosage_guidelines (ingredient_id, source, source_url, source_title, population, dose_min, dose_max, unit, frequency, timing, notes, is_default) VALUES
(22, 'study', 'https://www.ncbi.nlm.nih.gov/pmc/articles/PMC6523211/', 'Chlorella – Detoxification and Immune Functions', 'adult', 2, 10, 'g', 'daily', 'morning', 'Nur Produkte mit aufgebrochener Zellwand. 2–10 g/Tag; bei Schwermetallausleitung höhere Dosen. Ausreichend Wasser trinken.', 1);

-- ZEOLITH (id=23)
INSERT OR IGNORE INTO dosage_guidelines (ingredient_id, source, source_url, source_title, population, dose_min, dose_max, unit, frequency, timing, notes, is_default) VALUES
(23, 'study', 'https://www.ncbi.nlm.nih.gov/pmc/articles/PMC5053453/', 'Zeolite Clinoptilolite Safety and Medical Use', 'adult', 1, 5, 'g', 'daily', 'fasting', 'Aktiviertes Klinoptilolith-Pulver. Nüchtern einnehmen, mindestens 2 Stunden Abstand zu Medikamenten und Nährstoffen. Ausreichend Flüssigkeit (min. 500 ml).', 1);

-- MSM (id=20)
INSERT OR IGNORE INTO dosage_guidelines (ingredient_id, source, source_url, source_title, population, dose_min, dose_max, unit, frequency, timing, notes, is_default) VALUES
(20, 'study', 'https://www.ncbi.nlm.nih.gov/pmc/articles/PMC5372953/', 'MSM for Osteoarthritis and Joint Health', 'adult', 1500, 3000, 'mg', 'daily', 'with_meal', '1,5–3 g/Tag, aufgeteilt auf 2 Mahlzeiten. Bei Gelenkbeschwerden Mindestanwendung 12 Wochen. Kombination mit Vitamin C sinnvoll (Kollagensynthese).', 1),
(20, 'practice', NULL, 'MSM Hochdosis Protokoll', 'adult', 4000, 4800, 'mg', 'daily', 'with_meal', 'Höhere Dosen (4–4,8 g) bei chronischen Entzündungen oder intensivem Sport; auf EFSA-Sicherheitsgrenze achten', 0);

-- KOLLAGEN (id=17)
INSERT OR IGNORE INTO dosage_guidelines (ingredient_id, source, source_url, source_title, population, dose_min, dose_max, unit, frequency, timing, notes, is_default) VALUES
(17, 'study', 'https://www.ncbi.nlm.nih.gov/pmc/articles/PMC6566836/', 'Oral Collagen Supplementation – Systematic Review', 'adult', 10, 15, 'g', 'daily', 'fasting', 'Hydrolysiertes Kollagen Typ I: 10–15 g/Tag morgens nüchtern oder nach Training (erhöhte Aminosäureaufnahme). Vitamin C als Cofaktor einnehmen.', 1),
(17, 'study', NULL, 'Kollagen Typ II (UC-II) für Gelenke', 'adult', 0.04, 0.04, 'g', 'daily', 'fasting', 'UC-II (nicht-denaturiertes Typ-II-Kollagen): NUR 40 mg/Tag morgens nüchtern! Wirkt über orale Toleranzinduktion – höhere Dosen nicht effektiver.', 0),
(17, 'practice', NULL, 'Marines Kollagen für Haut/Haare', 'adult', 5, 10, 'g', 'daily', 'fasting', 'Marines Kollagenpeptide: 5–10 g/Tag. Für Hautstraffung und Haarqualität mindestens 8–12 Wochen.', 0);

-- MELATONIN (id=31)
INSERT OR IGNORE INTO dosage_guidelines (ingredient_id, source, source_url, source_title, population, dose_min, dose_max, unit, frequency, timing, notes, is_default) VALUES
(31, 'study', 'https://www.ncbi.nlm.nih.gov/pmc/articles/PMC4334454/', 'Melatonin for Sleep Disorders – Review', 'adult', 0.5, 1, 'mg', 'daily', 'evening', 'Physiologische Dosis: 0,5–1 mg sublingual, 30–60 Minuten vor Schlaf. Kleine Dosen oft wirkungsvoller als hohe. In Deutschland bis 1 mg rezeptfrei. Nur kurzfristig (max. 4 Wochen).', 1),
(31, 'study', NULL, 'Melatonin bei Jetlag', 'adult', 0.5, 3, 'mg', 'as_needed', 'evening', 'Jetlag: 0,5–3 mg zum neuen lokalen Schlafzeitpunkt, 3–5 Tage. Tagesrichtung beachtet: Reise nach Osten stärker belastet.', 0),
(31, 'study', NULL, 'Melatonin > 55 Jahre (Circadin)', 'elderly', 2, 2, 'mg', 'daily', 'evening', 'Circadin 2 mg (retardiert) – zugelassenes Arzneimittel DE für Personen >55 Jahre mit Primär-Insomnie. Rezeptpflichtig.', 0);

-- =========================================================================
-- STEP 6: Interactions
-- =========================================================================

-- Ashwagandha (24) ↔ Schilddrüsenmedikamente (Jod id=19 als Proxy)
INSERT OR IGNORE INTO interactions (ingredient_a_id, ingredient_b_id, type, comment, severity, mechanism, source_url) VALUES
(24, 19, 'caution', 'Ashwagandha kann TSH und Schilddrüsenhormone (T3/T4) erhöhen. Vorsicht bei Schilddrüsenerkrankungen und Einnahme von Levothyroxin oder Schilddrüsenhormonen. Regelmäßige TSH-Kontrolle empfohlen.', 'high', 'Ashwagandha stimuliert hypothalamische und pituitäre Schilddrüsenachse; kann Schilddrüsenhormon-Medikation potenzieren', 'https://www.ncbi.nlm.nih.gov/pmc/articles/PMC6979308/');

-- Berberin (27) ↔ Diabetes-Medikamente (Magnesium id=3 als nächste vorhandene Metabolismus-ID – besser: Direktlink)
INSERT OR IGNORE INTO interactions (ingredient_a_id, ingredient_b_id, type, comment, severity, mechanism, source_url) VALUES
(27, 15, 'caution', 'Berberin hemmt CYP3A4 und CYP2D6 – Wechselwirkungen mit Statinen (CoQ10-Spiegel beachten) und Cyclosporin. Kombination von Berberin mit Metformin oder anderen Antidiabetika kann Hypoglykämie-Risiko erhöhen. Blutzucker-Monitoring erforderlich.', 'high', 'AMPK-Aktivierung durch Berberin synergistisch mit Metformin; CYP3A4-Hemmung erhöht Plasmaspiegel von CYP3A4-Substraten wie Cyclosporin', 'https://www.ncbi.nlm.nih.gov/pmc/articles/PMC6434235/');

-- Curcumin (29) ↔ Vitamin C (5) – synergistisch / Bioverfügbarkeit
INSERT OR IGNORE INTO interactions (ingredient_a_id, ingredient_b_id, type, comment, severity, mechanism, source_url) VALUES
(29, 5, 'synergy', 'Curcumin und Vitamin C wirken synergistisch antioxidativ und antiinflammatorisch. Kombination sinnvoll bei entzündlichen Erkrankungen. Vitamin C als Cofaktor der Kollagensynthese ergänzt Curcumins antiinflammatorische Wirkung.', 'low', 'Komplementäre antioxidative Mechanismen; Vitamin C regeneriert oxidiertes Curcumin', NULL);

-- Curcumin (29) ↔ Omega-3 (10) – synergistisch
INSERT OR IGNORE INTO interactions (ingredient_a_id, ingredient_b_id, type, comment, severity, mechanism, source_url) VALUES
(29, 10, 'synergy', 'Curcumin und Omega-3-Fettsäuren (EPA/DHA) wirken synergistisch antiinflammatorisch über unterschiedliche Signalwege (NF-κB und Eikosanoidstoffwechsel). Gleichzeitige Einnahme mit fetthaltiger Mahlzeit verbessert Absorption beider Substanzen.', 'low', 'NF-κB-Hemmung (Curcumin) + COX-2-Modulation (EPA/DHA); gemeinsame Fettlöslichkeit verbessert gegenseitige Bioverfügbarkeit', NULL);

-- CoQ10 (15) ↔ Statine – Hinweis (keine direkte Statin-Zutat in DB; dokumentiert als Kommentar in dosage)
-- Resveratrol (28) ↔ Blutgerinnungshemmer (Omega-3 als Proxy für antikoagulante Wirkung)
INSERT OR IGNORE INTO interactions (ingredient_a_id, ingredient_b_id, type, comment, severity, mechanism, source_url) VALUES
(28, 10, 'caution', 'Resveratrol und Omega-3-Fettsäuren haben beide blutgerinnungshemmende Eigenschaften. Kombination bei gleichzeitiger Einnahme von Antikoagulanzien (Marcumar, Xarelto, ASS) mit Vorsicht – erhöhtes Blutungsrisiko.', 'medium', 'Resveratrol hemmt Thromboxan-A2-Synthese und Thrombozytenaggregation; additiver Effekt mit EPA/DHA und Antikoagulanzien', NULL);

-- ALA (30) ↔ Diabetes-Kontext / CoQ10 – synergistisch antioxidativ
INSERT OR IGNORE INTO interactions (ingredient_a_id, ingredient_b_id, type, comment, severity, mechanism, source_url) VALUES
(30, 15, 'synergy', 'Alpha-Liponsäure und CoQ10 ergänzen sich optimal in der mitochondrialen Antioxidansstrategie. ALA regeneriert Glutathion, Vitamin E und C; CoQ10 schützt die mitochondriale Membran. Kombination bei mitochondrialer Dysfunktion und Neuropathie sehr sinnvoll.', 'low', 'ALA als wasserlösliches Antioxidans + CoQ10 als membrangebundenes fettlösliches Antioxidans; gegenseitige Regeneration möglich', NULL);

-- Melatonin (31) ↔ Ashwagandha (24) – synergistisch Schlaf
INSERT OR IGNORE INTO interactions (ingredient_a_id, ingredient_b_id, type, comment, severity, mechanism, source_url) VALUES
(31, 24, 'synergy', 'Melatonin und Ashwagandha (KSM-66) synergistisch für Schlafqualität: Melatonin fördert Einschlafen, Ashwagandha reduziert Cortisol und fördert Tiefschlaf. Kombination kleiner Melatonin-Dosis (0,5 mg) mit Ashwagandha (300–600 mg) abends empfohlen.', 'low', 'Komplementäre Mechanismen: Melatonin über MT1/MT2-Rezeptoren; Ashwagandha über HPA-Achse/Cortisol-Reduktion', NULL);

-- Zeolith (23) ↔ Curcumin (29) – vermeiden (zeitlicher Abstand)
INSERT OR IGNORE INTO interactions (ingredient_a_id, ingredient_b_id, type, comment, severity, mechanism, source_url) VALUES
(23, 29, 'avoid', 'Zeolith mindestens 2 Stunden von Curcumin und anderen polyphenolischen Verbindungen trennen. Zeolith kann Curcumin und andere Wirkstoffe unspezifisch adsorbieren und deren Bioverfügbarkeit drastisch reduzieren.', 'medium', 'Physikalische Adsorption polarer und aromatischer Verbindungen in der Zeolith-Gitterstruktur', NULL);

-- Zeolith (23) ↔ ALA (30) – vermeiden
INSERT OR IGNORE INTO interactions (ingredient_a_id, ingredient_b_id, type, comment, severity, mechanism, source_url) VALUES
(23, 30, 'avoid', 'Zeolith mindestens 2 Stunden von Alpha-Liponsäure trennen – Zeolith kann ALA durch seine Adsorptionseigenschaften binden.', 'medium', 'Unspezifische Adsorption organischer Verbindungen durch Zeolith-Kationenaustauscher', NULL);

-- Chlorella (22) ↔ Curcumin (29) – kein Problem, aber Kollagen-Synergie
INSERT OR IGNORE INTO interactions (ingredient_a_id, ingredient_b_id, type, comment, severity, mechanism, source_url) VALUES
(22, 17, 'synergy', 'Chlorella (Vitamin C, Aminosäuren) kann die endogene Kollagensynthese unterstützen. Chlorella enthält Prolin, Glycin und Hydroxyprolin als Kollagenbausteine sowie Chlorophyll, das antioxidativen Schutz für Bindegewebe bietet.', 'low', 'Kollagenprekursor-Aminosäuren aus Chlorella + Antioxidansschutz durch Chlorophyll', NULL);

-- MSM (20) ↔ Kollagen (17) – synergistisch
INSERT OR IGNORE INTO interactions (ingredient_a_id, ingredient_b_id, type, comment, severity, mechanism, source_url) VALUES
(20, 17, 'synergy', 'MSM (Schwefelquelle) und Kollagen sind synergistisch für Gelenk- und Bindegewebsgesundheit. Schwefel aus MSM ist essentieller Cofaktor der Kollagen-Quervernetzung und Knorpelmatrix-Synthese. Empfehlenswerte Kombination.', 'low', 'MSM liefert organischen Schwefel für Disulfidbrücken in Kollagenfibrillen und Proteoglykanen des Knorpels', NULL);

-- OPC (18) ↔ Vitamin C (5) – synergistisch
INSERT OR IGNORE INTO interactions (ingredient_a_id, ingredient_b_id, type, comment, severity, mechanism, source_url) VALUES
(18, 5, 'synergy', 'OPC und Vitamin C wirken synergistisch antioxidativ: OPC regeneriert Vitamin C nach dessen Oxidation. Klassische Kombination für Gefäßschutz, Kollagenbildung und Immunsystem. OPC verstärkt zudem die Wirksamkeit von Vitamin C um den Faktor 20.', 'low', 'OPC regeneriert Ascorbat aus Dehydroascorbinsäure; gemeinsame Hemmung von Kollagenase und Hyaluronidase', NULL);

-- Rhodiola (25) ↔ Antidepressiva/MAO-Hemmer Warnung
INSERT OR IGNORE INTO interactions (ingredient_a_id, ingredient_b_id, type, comment, severity, mechanism, source_url) VALUES
(25, 24, 'caution', 'Rhodiola rosea und Ashwagandha können kombiniert werden (beide adaptogen), jedoch ist Vorsicht bei gleichzeitiger Einnahme von MAO-Hemmern, SSRI oder SNRI geboten. Rhodiola hemmt MAO-A/B schwach – mögliche serotoninerge/adrenerge Potenzierung.', 'medium', 'Rhodiola-Salidrosid hemmt Monoaminoxidase und beeinflusst Serotonin/Dopamin-Transport; Ashwagandha GABAerger Effekt kann Sediering verstärken', NULL);

-- Berberin (27) ↔ Melatonin (31) – CYP-Inhibition Warnung
INSERT OR IGNORE INTO interactions (ingredient_a_id, ingredient_b_id, type, comment, severity, mechanism, source_url) VALUES
(27, 31, 'caution', 'Berberin hemmt CYP1A2, das für den Melatonin-Abbau zuständig ist. Kombination kann Melatonin-Plasmaspiegel erhöhen und Überdosierungssymptome verstärken (Tagesmüdigkeit). Falls kombiniert: Melatonin-Dosis reduzieren.', 'medium', 'Berberin-Hemmung von CYP1A2 verlangsamt hepatischen Melatonin-Metabolismus (6-Sulfatoxymelatonin-Bildung)', NULL);
