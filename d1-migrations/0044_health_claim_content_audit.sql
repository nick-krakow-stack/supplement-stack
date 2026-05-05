PRAGMA foreign_keys = ON;

-- Health-claims/content audit cleanup.
-- Scope: wording only. No dose amounts, units, source URLs, product prices, or
-- recommendation relationships are changed in this migration.

UPDATE ingredients
SET description = 'Panax-Ginseng und verwandte Ginseng-Arten werden in Fachquellen im Zusammenhang mit Energie-, Stress- und Kognitionskontexten beschrieben. Die Einordnung dient nur der allgemeinen Orientierung und ersetzt keine medizinische Empfehlung.'
WHERE name = 'Ginseng';

UPDATE ingredients
SET description = 'Öl aus Nigella-sativa-Samen mit Thymochinon als häufig beschriebenem Inhaltsstoff. Quellen diskutieren antioxidative und entzündungsbezogene Forschungszusammenhänge; daraus folgt keine Behandlungsempfehlung.'
WHERE name = 'Schwarzkümmelöl';

UPDATE ingredients
SET description = 'Kreatin ist eine körpereigene Verbindung im Phosphokreatin-System. Kreatin-Monohydrat ist eine gut untersuchte Supplementform; individuelle Trainings- oder Kognitionseffekte sind kontextabhängig.'
WHERE name IN ('Creatin', 'Kreatin');

UPDATE ingredients
SET description = 'Mehrfach ungesättigte Omega-3-Fettsäuren EPA und DHA. Quellen beschreiben unterschiedliche Rollen im Fettstoffwechsel und in Zellmembranen; konkrete Gesundheitsclaims hängen von zugelassenen Bedingungen und Dosierungen ab.'
WHERE name = 'Omega-3';

UPDATE ingredients
SET description = 'Spirulina ist eine nährstoffreiche Blaugrünalge. Produktqualität und Kontaminationsprüfung sind wichtig; aus der Einordnung wird keine Ausleitungs- oder Behandlungsempfehlung abgeleitet.'
WHERE name = 'Spirulina';

UPDATE ingredients
SET description = 'Chlorella ist eine nährstoffreiche Grünalge. In Quellen wird Bindung im Verdauungstrakt diskutiert; dies ist keine Empfehlung zur Ausleitung von Schwermetallen.'
WHERE name = 'Chlorella';

UPDATE ingredients
SET description = 'Zeolith ist ein Silikatmineral, bei dem unspezifische Bindung im Verdauungstrakt diskutiert wird. Abstand zu Medikamenten und Supplementen beachten; keine medizinische Ausleitungsempfehlung.'
WHERE name = 'Zeolith';

UPDATE ingredients
SET description = 'Methylsulfonylmethan (MSM) ist eine organische Schwefelverbindung, die in Quellen im Zusammenhang mit Bindegewebe und Gelenkkontexten beschrieben wird. Keine Aussage zur Behandlung von Beschwerden.'
WHERE name = 'MSM';

UPDATE ingredients
SET description = 'Withania somnifera (Ashwagandha) ist ein Pflanzenextrakt, der in Studien unter anderem in Stress- und Schlafkontexten untersucht wurde. Arzneimittel, Schilddrüse, Schwangerschaft und individuelle Verträglichkeit ärztlich abklären.'
WHERE name = 'Ashwagandha';

UPDATE ingredients
SET description = 'Rhodiola rosea (Rosenwurz) ist ein Pflanzenextrakt, der in Quellen im Zusammenhang mit Stress- und Belastungskontexten beschrieben wird. Keine Aussage zur Behandlung von Erschöpfung oder Stimmungslagen.'
WHERE name = 'Rhodiola';

UPDATE ingredients
SET description = 'Berberin ist ein Pflanzenalkaloid, das in Studien zu Glukose- und Lipidstoffwechselparametern untersucht wurde. Bei bestehenden Erkrankungen, Medikamenten, Schwangerschaft oder Stillzeit nur medizinisch begleitet einordnen.'
WHERE name = 'Berberin';

UPDATE ingredients
SET description = 'Resveratrol ist ein Polyphenol, das in Quellen im Zusammenhang mit Zell- und Stoffwechselmarkern untersucht wird. Die Einordnung ist keine Aussage zu kardioprotektiven oder krankheitsbezogenen Effekten.'
WHERE name = 'Resveratrol';

UPDATE ingredients
SET description = 'Curcumin ist ein Polyphenol aus Curcuma longa. Quellen diskutieren Bioverfügbarkeit und verschiedene Forschungszusammenhänge; dies ist keine Aussage zur Behandlung entzündlicher Erkrankungen.'
WHERE name = 'Curcumin';

UPDATE ingredients
SET description = 'Eicosapentaensäure (EPA) ist eine Omega-3-Fettsäure. Quellen beschreiben EPA in kardiometabolischen und weiteren Forschungskontexten; konkrete Gesundheitsclaims sind nur im zugelassenen Rahmen einzuordnen.'
WHERE name = 'EPA';

UPDATE ingredients
SET description = 'Docosahexaensäure (DHA) ist eine Omega-3-Fettsäure und Bestandteil von Zellmembranen. Konkrete Gesundheitsclaims sind nur im zugelassenen Rahmen und mit den jeweiligen Bedingungen einzuordnen.'
WHERE name = 'DHA';

UPDATE ingredients
SET description = 'Alpha-Linolensäure (ALA) ist eine pflanzliche Omega-3-Fettsäure. Die Umwandlung zu EPA/DHA ist begrenzt und individuell unterschiedlich; keine Krankheits- oder Behandlungsaussage.'
WHERE name = 'ALA';

UPDATE ingredients
SET description = 'L-Arginin ist eine Aminosäure und Vorstufe von Stickstoffmonoxid. Quellen diskutieren NO-Stoffwechsel und Sportkontexte; bei Herz-Kreislauf-Erkrankungen oder Medikamenten medizinisch abklären.'
WHERE name = 'L-Arginin';

UPDATE ingredients
SET description = 'L-Citrullin ist eine Aminosäure, die im Körper zu L-Arginin umgewandelt werden kann. Studien beschreiben Trainingskontexte; individuelle Leistungswirkungen werden nicht zugesichert.'
WHERE name = 'L-Citrullin';

UPDATE ingredients
SET description = 'L-Tyrosin ist eine Aminosäure und Vorstufe verschiedener körpereigener Botenstoffe. Studien beschreiben Stress- und Kognitionskontexte; dies ist keine Empfehlung zur Behandlung psychischer Beschwerden.'
WHERE name = 'L-Tyrosin';

UPDATE ingredients
SET description = 'Taurin ist eine schwefelhaltige Aminosäure, die in Herz, Gehirn, Augen und Muskulatur vorkommt. Quellen diskutieren Stoffwechsel- und Sportkontexte; keine krankheitsbezogene Aussage.'
WHERE name = 'Taurin';

UPDATE ingredients
SET description = 'Glycin ist eine Aminosäure und Baustein von Kollagen. Quellen beschreiben Schlaf- und Bindegewebskontexte; dies ist keine Behandlungsempfehlung für Schlafstörungen.'
WHERE name = 'Glycin';

UPDATE ingredients
SET description = 'Beta-Alanin ist eine Beta-Aminosäure und Vorstufe von Carnosin. Quellen beschreiben hochintensive Trainingskontexte; individuelle Leistungswirkungen werden nicht zugesichert.'
WHERE name = 'Beta-Alanin';

UPDATE ingredients
SET description = 'Kalium ist ein essenzieller Elektrolyt. Quellen beschreiben Zusammenhänge mit Flüssigkeitshaushalt, Nerven- und Muskelfunktion sowie Blutdruckregulation; Blutdruck-Behandlungsziele gehören in ärztliche Betreuung.'
WHERE name = 'Kalium';

UPDATE ingredients
SET description = 'Molybdän ist ein essenzielles Spurenelement und Kofaktor menschlicher Enzyme. Die Einordnung beschreibt physiologische Funktionen und ist keine Ausleitungs- oder Behandlungsempfehlung.'
WHERE name = 'Molybdän';

UPDATE ingredient_forms
SET comment = REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(comment,
  'Gold-Standard', 'gut untersuchte Standardform'),
  'Goldstandard', 'gut untersuchte Standardform'),
  'therapeutische', 'ärztlich begleitete'),
  'therapeutischen', 'ärztlich begleiteten'),
  'therapeutischer', 'ärztlich begleiteter'),
  'therapeutisch', 'ärztlich begleitet')
WHERE comment IS NOT NULL;

UPDATE ingredient_forms
SET comment = 'Standardisierter Withania-somnifera-Wurzelextrakt mit Studienbezug zu Stress- und Schlafkontexten. Keine medizinische Empfehlung.'
WHERE name = 'KSM-66';

UPDATE ingredient_forms
SET comment = 'Rohes Pulver ohne Standardisierung; variable Inhaltsstoffmenge. Für eine gezielte Einordnung sind standardisierte Quellen besser vergleichbar.'
WHERE name = 'Pulverisierte Ginsengwurzel';

UPDATE ingredient_forms
SET comment = 'Höherer Thymochinon-Anteil als natives Öl; weniger Daten zu Langzeitsicherheit. Als Forschungs- und Produktqualitätskontext einordnen.'
WHERE name = 'Thymochinon-angereicherter Extrakt';

UPDATE ingredient_forms
SET comment = 'Geringere Reinheit und Adsorptionskapazität. Nicht als Ausleitungs- oder Behandlungsempfehlung verstehen.'
WHERE name = 'Zeolith Rohpulver (nicht aktiviert)';

UPDATE dose_recommendations
SET context_note = REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(context_note,
  'therapeutische Effekte', 'in klinischen Studien untersuchte Effekte'),
  'therapeutische Dosen', 'ärztlich begleitete Dosen'),
  'therapeutisch verordnet', 'ärztlich verordnet'),
  'Entzündungshemmung', 'entzündungsbezogene Forschungszusammenhänge'),
  'antiinflammatorische Wirkung', 'entzündungsbezogene Forschungszusammenhänge')
WHERE context_note IS NOT NULL;

UPDATE dose_recommendations
SET context_note = 'Bei bestehendem Diabetes oder Insulinresistenz wurden 200-1000 µg Chrompicolinat/Tag in Studien untersucht. Nur ärztlich begleitet, insbesondere bei Diabetes-Therapie.'
WHERE source_label LIKE '%Diabetes%'
   OR context_note LIKE '%Typ-2-Diabetes%'
   OR context_note LIKE '%Insulinresistenz%';

UPDATE dose_recommendations
SET context_note = 'EPA-Daten umfassen Studien zu psychischer Gesundheit. Anwendungen bei Depression oder anderen Erkrankungen gehören in medizinische Betreuung und sind keine Selbstbehandlungs-Empfehlung.'
WHERE source_label LIKE '%Depression%'
   OR context_note LIKE '%Depression%';

UPDATE dose_recommendations
SET context_note = '1,5-3 g/Tag wurden in Meta-Analysen zu kardiometabolischen Parametern untersucht. Nicht als Behandlungsziel oder garantierte Wirkung verstehen.'
WHERE source_label LIKE '%Taurin%'
   OR context_note LIKE '%LDL-Cholesterin%';

UPDATE dose_recommendations
SET context_note = '8 g Citrullin-Malat 1 h vor Training wurden in einer Trainingsstudie untersucht. Individuelle Leistungswirkungen werden nicht zugesichert.'
WHERE context_note LIKE '%Citrullin-Malat%';

UPDATE dose_recommendations
SET context_note = '3 g Glycin vor dem Schlaf wurden in Studien zur subjektiven Schlafqualität untersucht. Keine Behandlungsempfehlung für Schlafstörungen.'
WHERE source_label LIKE '%Glycin%'
   OR context_note LIKE '%Glycin vor Schlaf%';

UPDATE dose_recommendations
SET context_note = '1-2 g vor dem Schlaf wurden in Studien zu Schlaf- und Stimmungskontexten untersucht. Keine Behandlungsempfehlung für Schlafstörungen oder psychische Beschwerden.'
WHERE source_label LIKE '%Tryptophan%';

UPDATE dose_recommendations
SET context_note = '2 g vor kognitiven Aufgaben wurden in Studienkontexten untersucht. Besonders bei Stress oder Schlafmangel nicht als medizinische Empfehlung verstehen.'
WHERE source_label LIKE '%Tyrosin%'
   OR context_note LIKE '%Task-Switching%';

UPDATE interactions
SET comment = 'D3 und K2 werden in Quellen gemeinsam im Kontext von Calciumstoffwechsel, Knochenproteinen und MGP beschrieben. Bei hohen D3-Mengen K2-Kontext fachlich oder ärztlich prüfen.',
    mechanism = 'Calciumstoffwechsel und Vitamin-K-abhängige Proteine; keine Aussage zur Prävention oder Behandlung von Gefäßverkalkung'
WHERE comment LIKE '%Gefäßverkalkung verhindern%'
   OR comment LIKE '%Calcium in Knochen einlagern%';

UPDATE interactions
SET comment = 'Curcumin und Vitamin C werden in Quellen im antioxidativen und Kollagenstoffwechsel-Kontext beschrieben. Keine Behandlung entzündlicher Erkrankungen daraus ableiten.',
    mechanism = 'Antioxidativer Forschungszusammenhang und Kollagenstoffwechsel'
WHERE comment LIKE '%Curcumin und Vitamin C%';

UPDATE interactions
SET comment = 'Curcumin und Omega-3-Fettsäuren werden in Quellen in entzündungsbezogenen Forschungskontexten beschrieben. Gemeinsame Einnahme mit einer Mahlzeit kann wegen Fettlöslichkeit relevant sein.',
    mechanism = 'Entzündungsbezogene Forschungszusammenhänge; Fettlöslichkeit'
WHERE comment LIKE '%Curcumin und Omega-3%';

UPDATE interactions
SET comment = 'Melatonin und Ashwagandha werden in Schlaf- und Stresskontexten untersucht. Nicht als Behandlung von Schlafstörungen verstehen; bei Schlafproblemen medizinisch abklären.',
    mechanism = 'Schlaf- und Stresskontext; keine Behandlungsempfehlung'
WHERE comment LIKE '%Melatonin und Ashwagandha%';

UPDATE interactions
SET comment = 'OPC und Vitamin C werden in Quellen im antioxidativen und Kollagenstoffwechsel-Kontext beschrieben. Keine konkrete Wirkungsverstärkung zusichern.',
    mechanism = 'Antioxidativer Forschungszusammenhang und Kollagenstoffwechsel'
WHERE comment LIKE '%OPC und Vitamin C%';

UPDATE interactions
SET comment = 'Kalium und Natrium stehen in ernährungsphysiologischem Zusammenhang mit Blutdruckregulation. Blutdruck-Behandlungsziele gehören in ärztliche Betreuung.',
    mechanism = 'Elektrolyt- und Blutdruckregulationskontext'
WHERE comment LIKE '%Kalium und Natrium%';

UPDATE interactions
SET comment = 'ALCAR und R-ALA werden gemeinsam im mitochondrialen Stoffwechselkontext diskutiert. Keine kognitive Wirkung oder Behandlungsaussage ableiten.',
    mechanism = 'Mitochondrialer Stoffwechselkontext'
WHERE comment LIKE '%ALCAR + R-ALA%';

UPDATE interactions
SET comment = 'DHA und EPA sind unterschiedliche Omega-3-Fettsäuren mit verschiedenen Forschungsbezügen. Die Kombination deckt unterschiedliche ernährungsphysiologische Kontexte ab.',
    mechanism = 'Omega-3-Fettsäuren mit unterschiedlichen Forschungsbezügen'
WHERE comment LIKE '%DHA und EPA%';

UPDATE interactions
SET comment = 'Eine ausreichende Zinkversorgung wird in Quellen im Zusammenhang mit ALA-zu-EPA/DHA-Konversion beschrieben. Keine konkrete Wirkungsverstärkung zusichern.',
    mechanism = 'Delta-6-Desaturase benötigt Zink als enzymatischen Kofaktor'
WHERE comment LIKE '%Zink ist Kofaktor der Delta-6-Desaturase%';

UPDATE products
SET effect_summary = REPLACE(REPLACE(REPLACE(REPLACE(effect_summary,
  'Entgiftung', 'allgemeiner Kontext'),
  'senkt', 'wird quellenbezogen eingeordnet'),
  'steigert', 'wird quellenbezogen eingeordnet'),
  'verbessert', 'wird quellenbezogen eingeordnet')
WHERE effect_summary IS NOT NULL;

UPDATE products
SET warning_message = REPLACE(REPLACE(REPLACE(warning_message,
  'heilt', 'ersetzt keine Behandlung von'),
  'senkt', 'wird quellenbezogen eingeordnet'),
  'Entgiftung', 'allgemeiner Kontext')
WHERE warning_message IS NOT NULL;

UPDATE ingredient_translations
SET description = REPLACE(REPLACE(REPLACE(description,
  'Entgiftung', 'allgemeiner Kontext'),
  'bindet Schwermetalle', 'wird im Zusammenhang mit Bindung im Verdauungstrakt diskutiert'),
  'Goldstandard', 'gut untersuchte Standardform')
WHERE language = 'de'
  AND description IS NOT NULL;
