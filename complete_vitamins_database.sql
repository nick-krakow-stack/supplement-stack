-- Complete Vitamin Database Extension based on DGE Reference Values
-- This script adds all essential vitamins with proper dosing and effects

-- Add effects column to nutrients table if it doesn't exist
ALTER TABLE nutrients ADD COLUMN effects TEXT;

-- Complete Vitamin Database Insert/Update
-- Using INSERT OR REPLACE to update existing entries

-- Fat-soluble vitamins (fettlösliche Vitamine)
INSERT OR REPLACE INTO nutrients (id, name, synonyms, standard_unit, dge_recommended, study_recommended, max_safe_dose, warning_threshold, effects) VALUES
-- Vitamin A (Retinol)
(101, 'Vitamin A (Retinol)', '["Vitamin A", "Retinol", "Beta-Carotin", "A", "Retinyl"]', 'µg', 775, 1000, 3000, 2400, 'Sehkraft, Immunsystem, Haut- und Schleimhautgesundheit'),

-- Vitamin D (already exists, update with effects)
(1, 'Vitamin D3 (Cholecalciferol)', '["D3", "Cholecalciferol", "Vitamin D", "Sonnenvitamin"]', 'µg', 20, 50, 100, 75, 'Knochengesundheit, Immunsystem, Calciumaufnahme'),

-- Vitamin E (Tocopherol)
(102, 'Vitamin E (Tocopherol)', '["Vitamin E", "Tocopherol", "Alpha-Tocopherol", "E"]', 'mg', 13, 15, 300, 200, 'Antioxidans, Zellschutz, Herzgesundheit, Durchblutung'),

-- Vitamin K (Phylloquinon/Menaquinon)
(10, 'Vitamin K2 (Menaquinon)', '["K2", "MK-7", "Menaquinon", "Vitamin K"]', 'µg', 65, 200, 1000, 500, 'Blutgerinnung, Knochengesundheit, Herzgesundheit'),
(103, 'Vitamin K1 (Phylloquinon)', '["K1", "Phylloquinon", "Vitamin K1"]', 'µg', 65, 100, 1000, 500, 'Blutgerinnung, Knochengesundheit');

-- Water-soluble vitamins (wasserlösliche Vitamine) - B-Complex
INSERT OR REPLACE INTO nutrients (id, name, synonyms, standard_unit, dge_recommended, study_recommended, max_safe_dose, warning_threshold, effects) VALUES
-- Vitamin B1 (Thiamin)
(104, 'Vitamin B1 (Thiamin)', '["Vitamin B1", "Thiamin", "B1", "Thiamine"]', 'mg', 1.1, 10, 300, 100, 'Energiestoffwechsel, Nervensystem, Herzfunktion'),

-- Vitamin B2 (Riboflavin)
(105, 'Vitamin B2 (Riboflavin)', '["Vitamin B2", "Riboflavin", "B2"]', 'mg', 1.25, 10, 200, 100, 'Energiestoffwechsel, Zellwachstum, Sehkraft'),

-- Vitamin B3 (Niacin)
(106, 'Vitamin B3 (Niacin)', '["Vitamin B3", "Niacin", "B3", "Nicotinsäure"]', 'mg', 13.5, 20, 35, 30, 'Energiestoffwechsel, Cholesterinspiegel, Hautgesundheit'),

-- Vitamin B5 (Pantothensäure)
(107, 'Vitamin B5 (Pantothensäure)', '["Vitamin B5", "Pantothensäure", "B5", "Pantothenic Acid"]', 'mg', 5, 10, 100, 50, 'Energiestoffwechsel, Hormonproduktion, Stressresistenz'),

-- Vitamin B6 (already exists, update with proper naming and effects)
(7, 'Vitamin B6 (Pyridoxin)', '["B6", "Pyridoxin", "Vitamin B6"]', 'mg', 1.5, 10, 100, 50, 'Aminosäurestoffwechsel, Nervensystem, Immunfunktion'),

-- Vitamin B7 (Biotin) - already exists as Biotin, update with proper naming
(9, 'Vitamin B7 (Biotin)', '["B7", "Vitamin H", "Biotin", "Vitamin B7"]', 'µg', 40, 2500, 10000, 5000, 'Stoffwechsel, Haut- und Haargesundheit, Genregulation'),

-- Vitamin B9 (Folsäure) - already exists, update with proper naming and effects  
(8, 'Vitamin B9 (Folsäure)', '["Folat", "B9", "5-MTHF", "Folsäure", "Vitamin B9"]', 'µg', 300, 800, 1000, 800, 'Zellteilung, DNA-Synthese, Blutbildung, Schwangerschaft'),

-- Vitamin B12 (already exists, update with proper naming and effects)
(2, 'Vitamin B12 (Cobalamin)', '["B12", "Cobalamin", "Methylcobalamin", "Cyanocobalamin", "Vitamin B12"]', 'µg', 4, 250, 1000, 500, 'Blutbildung, Nervensystem, DNA-Synthese, Energiestoffwechsel');

-- Vitamin C (already exists, update with proper naming and effects)
INSERT OR REPLACE INTO nutrients (id, name, synonyms, standard_unit, dge_recommended, study_recommended, max_safe_dose, warning_threshold, effects) VALUES
(6, 'Vitamin C (Ascorbinsäure)', '["C", "Ascorbinsäure", "Ester-C", "Vitamin C"]', 'mg', 102.5, 1000, 2000, 1500, 'Immunsystem, Antioxidans, Kollagenbildung, Eisenaufnahme');

-- Additional forms of existing vitamins for completeness
INSERT OR REPLACE INTO nutrients (id, name, synonyms, standard_unit, dge_recommended, study_recommended, max_safe_dose, warning_threshold, effects) VALUES
-- Vitamin B12 variations
(108, 'Vitamin B12 (Methylcobalamin)', '["Methylcobalamin", "Methyl-B12", "B12 Methyl"]', 'µg', 4, 250, 1000, 500, 'Blutbildung, Nervensystem, aktive B12-Form'),
(109, 'Vitamin B12 (Cyanocobalamin)', '["Cyanocobalamin", "Cyano-B12"]', 'µg', 4, 250, 1000, 500, 'Blutbildung, Nervensystem, stabile B12-Form'),

-- Vitamin D2 for completeness
(110, 'Vitamin D2 (Ergocalciferol)', '["D2", "Ergocalciferol", "Vitamin D2"]', 'µg', 20, 50, 100, 75, 'Knochengesundheit, Calciumaufnahme, pflanzliches Vitamin D'),

-- Folat natural forms
(111, 'Vitamin B9 (5-MTHF)', '["5-MTHF", "Methylfolat", "L-Methylfolat"]', 'µg', 300, 800, 1000, 800, 'Aktive Folatform, Zellteilung, DNA-Synthese'),

-- Beta-Carotin (Vitamin A precursor)
(112, 'Vitamin A (Beta-Carotin)', '["Beta-Carotin", "Betacarotin", "Provitamin A"]', 'mg', 2, 6, 20, 15, 'Sehkraft, Antioxidans, Hautgesundheit, Vorstufe von Vitamin A');