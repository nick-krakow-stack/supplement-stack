-- Enhance nutrients database with deficiency, excess symptoms and external links
-- This adds the data needed for the 4-symbol system in nutrient overview

-- Add new columns for the symbol system
ALTER TABLE nutrients ADD COLUMN deficiency_symptoms TEXT DEFAULT NULL;
ALTER TABLE nutrients ADD COLUMN excess_symptoms TEXT DEFAULT NULL;

-- Update existing vitamins with deficiency and excess information

-- Fat-soluble vitamins
UPDATE nutrients SET 
  deficiency_symptoms = 'Nachtblindheit, trockene Haut, geschwächtes Immunsystem, verzögertes Wachstum',
  excess_symptoms = 'Kopfschmerzen, Übelkeit, Leberschäden, Haut- und Haarveränderungen',
  external_article_url = 'https://www.dge.de/wissenschaft/referenzwerte/vitamin-a/'
WHERE id = 101; -- Vitamin A

UPDATE nutrients SET 
  deficiency_symptoms = 'Rachitis bei Kindern, Osteomalazie, Muskelschwäche, erhöhte Infektanfälligkeit',
  excess_symptoms = 'Hyperkalzämie, Nierenschäden, Herzrhythmusstörungen, Übelkeit',
  external_article_url = 'https://www.dge.de/wissenschaft/referenzwerte/vitamin-d/'
WHERE id = 1; -- Vitamin D3

UPDATE nutrients SET 
  deficiency_symptoms = 'Muskelschwäche, neurologische Störungen, erhöhte Zellschädigung durch freie Radikale',
  excess_symptoms = 'Blutungsneigung, Wechselwirkungen mit Antikoagulantien, Magen-Darm-Beschwerden'
WHERE id = 102; -- Vitamin E

UPDATE nutrients SET 
  deficiency_symptoms = 'Verlängerte Blutungszeit, Blutungsneigung, gestörte Knochenbildung',
  excess_symptoms = 'Wechselwirkungen mit Antikoagulantien, selten bei normaler Zufuhr'
WHERE id IN (10, 103); -- Vitamin K1/K2

-- Water-soluble vitamins (B-Complex)
UPDATE nutrients SET 
  deficiency_symptoms = 'Beriberi, Müdigkeit, Herzrhythmusstörungen, Nervenstörungen, Appetitlosigkeit',
  excess_symptoms = 'Selten, da wasserlöslich - möglich: Kopfschmerzen bei sehr hohen Dosen'
WHERE id = 104; -- Vitamin B1

UPDATE nutrients SET 
  deficiency_symptoms = 'Rissige Mundwinkel, Hautentzündungen, Lichtempfindlichkeit, Anämie',
  excess_symptoms = 'Selten, da wasserlöslich - möglich: Gelbverfärbung des Urins'
WHERE id = 105; -- Vitamin B2

UPDATE nutrients SET 
  deficiency_symptoms = 'Pellagra, Hautentzündungen, Durchfall, Demenz, Depression',
  excess_symptoms = 'Hautrötungen, Hitzegefühl, Leberschäden bei sehr hohen Dosen'
WHERE id = 106; -- Vitamin B3

UPDATE nutrients SET 
  deficiency_symptoms = 'Müdigkeit, Taubheitsgefühl, Magen-Darm-Beschwerden, Haarausfall',
  excess_symptoms = 'Selten, da wasserlöslich - sehr hohe Dosen können Verdauungsprobleme verursachen'
WHERE id = 107; -- Vitamin B5

UPDATE nutrients SET 
  deficiency_symptoms = 'Anämie, Hautveränderungen, Wachstumsstörungen, geschwächtes Immunsystem',
  excess_symptoms = 'Neurologische Schäden, Taubheitsgefühl, Sensibilitätsstörungen',
  external_article_url = 'https://www.dge.de/wissenschaft/referenzwerte/vitamin-b6/'
WHERE id = 7; -- Vitamin B6

UPDATE nutrients SET 
  deficiency_symptoms = 'Haarausfall, brüchige Nägel, Hautveränderungen, neurologische Symptome',
  excess_symptoms = 'Selten, da wasserlöslich - sehr hohe Dosen können Akne verschlechtern'
WHERE id = 9; -- Vitamin B7 (Biotin)

UPDATE nutrients SET 
  deficiency_symptoms = 'Megaloblastäre Anämie, Neuralrohrdefekte, Müdigkeit, Wachstumsstörungen',
  excess_symptoms = 'Maskiert B12-Mangel, kann Epilepsie-Medikation beeinflussen',
  external_article_url = 'https://www.dge.de/wissenschaft/referenzwerte/folat/'
WHERE id IN (8, 111); -- Vitamin B9 (Folsäure/5-MTHF)

UPDATE nutrients SET 
  deficiency_symptoms = 'Megaloblastäre Anämie, neurologische Schäden, Müdigkeit, Gedächtnisstörungen',
  excess_symptoms = 'Selten, kann Folsäure-Mangel maskieren, sehr hohe Dosen können Akne fördern',
  external_article_url = 'https://www.dge.de/wissenschaft/referenzwerte/vitamin-b12/'
WHERE id IN (2, 108, 109); -- Vitamin B12 (alle Formen)

-- Vitamin C
UPDATE nutrients SET 
  deficiency_symptoms = 'Skorbut, Zahnfleischbluten, schlechte Wundheilung, geschwächtes Immunsystem',
  excess_symptoms = 'Durchfall, Nierensteine, Magen-Darm-Beschwerden, Eisenüberladung',
  external_article_url = 'https://www.dge.de/wissenschaft/referenzwerte/vitamin-c/'
WHERE id = 6; -- Vitamin C

-- Additional vitamin forms
UPDATE nutrients SET 
  deficiency_symptoms = 'Wie Vitamin B12 - Megaloblastäre Anämie, neurologische Schäden',
  excess_symptoms = 'Selten, bioaktive Form wird besser toleriert'
WHERE id = 108; -- B12 Methylcobalamin

UPDATE nutrients SET 
  deficiency_symptoms = 'Wie Vitamin B12 - Megaloblastäre Anämie, neurologische Schäden', 
  excess_symptoms = 'Selten, stabile synthetische Form'
WHERE id = 109; -- B12 Cyanocobalamin

UPDATE nutrients SET 
  deficiency_symptoms = 'Wie Vitamin D3 - Rachitis, Osteomalazie, Muskelschwäche',
  excess_symptoms = 'Wie Vitamin D3 - Hyperkalzämie, weniger potent als D3'
WHERE id = 110; -- Vitamin D2

UPDATE nutrients SET 
  deficiency_symptoms = 'Wie Folsäure - aber aktive Form, direkt verwertbar',
  excess_symptoms = 'Seltener als bei Folsäure, da besser reguliert'
WHERE id = 111; -- 5-MTHF

UPDATE nutrients SET 
  deficiency_symptoms = 'Wie Vitamin A - aber aus pflanzlichen Quellen, weniger toxisch',
  excess_symptoms = 'Hauptsächlich Gelbfärbung der Haut, selten toxisch'
WHERE id = 112; -- Beta-Carotin

-- Add some important external links for existing nutrients without specific pages
UPDATE nutrients SET external_article_url = 'https://www.ncbi.nlm.nih.gov/pmc/articles/PMC6266123/' WHERE id = 1 AND external_article_url IS NULL;
UPDATE nutrients SET external_article_url = 'https://www.ncbi.nlm.nih.gov/pmc/articles/PMC4424347/' WHERE id = 102 AND external_article_url IS NULL;
UPDATE nutrients SET external_article_url = 'https://www.ncbi.nlm.nih.gov/pmc/articles/PMC4845679/' WHERE id = 9 AND external_article_url IS NULL;