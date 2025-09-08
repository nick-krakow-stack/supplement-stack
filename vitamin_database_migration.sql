-- Vitamin Database Migration: Complete DGE Reference Values
-- Based on Deutsche Gesellschaft für Ernährung (DGE) 2024 Reference Values
-- This script adds/updates all essential vitamins with proper dosing and effects

-- ================================
-- 1. Add effects column to nutrients table
-- ================================
ALTER TABLE nutrients ADD COLUMN effects TEXT;

-- ================================
-- 2. Complete Vitamin Database
-- ================================

-- Clear existing vitamin data to avoid conflicts (optional - comment out if you want to preserve existing data)
-- DELETE FROM nutrients WHERE id IN (1,2,6,7,8,9,10);

-- Fat-soluble vitamins (fettlösliche Vitamine)
-- Category 1 = Vitamine
INSERT OR REPLACE INTO nutrients (id, name, synonyms, standard_unit, dge_recommended, study_recommended, max_safe_dose, warning_threshold, effects, category_id) VALUES

-- Vitamin A (Retinol) - DGE: 700-850 µg (average 775)
(101, 'Vitamin A (Retinol)', '["Vitamin A", "Retinol", "Beta-Carotin", "A", "Retinyl", "Retinol-Äquivalent"]', 'µg', 775, 1500, 3000, 2400, 'Sehkraft, Immunsystem, Haut- und Schleimhautgesundheit', 1),

-- Vitamin D3 (update existing) - DGE: 20 µg 
(1, 'Vitamin D3 (Cholecalciferol)', '["D3", "Cholecalciferol", "Vitamin D", "Sonnenvitamin"]', 'µg', 20, 50, 100, 75, 'Knochengesundheit, Immunsystem, Calciumaufnahme', 1),

-- Vitamin E (Tocopherol) - DGE: 12-14 mg (average 13)
(102, 'Vitamin E (Tocopherol)', '["Vitamin E", "Tocopherol", "Alpha-Tocopherol", "E"]', 'mg', 13, 15, 300, 200, 'Antioxidans, Zellschutz, Herzgesundheit, Durchblutung', 1),

-- Vitamin K - DGE: 60-70 µg (average 65)
(103, 'Vitamin K1 (Phylloquinon)', '["K1", "Phylloquinon", "Vitamin K1"]', 'µg', 65, 100, 1000, 500, 'Blutgerinnung, Knochengesundheit', 1),
(10, 'Vitamin K2 (Menaquinon)', '["K2", "MK-7", "Menaquinon", "Vitamin K", "Vitamin K2"]', 'µg', 65, 200, 1000, 500, 'Blutgerinnung, Knochengesundheit, Herzgesundheit', 1);

-- Water-soluble vitamins (wasserlösliche Vitamine) - B-Complex & Vitamin C
INSERT OR REPLACE INTO nutrients (id, name, synonyms, standard_unit, dge_recommended, study_recommended, max_safe_dose, warning_threshold, effects, category_id) VALUES

-- Vitamin B1 (Thiamin) - DGE: 1,0-1,2 mg (average 1,1)
(104, 'Vitamin B1 (Thiamin)', '["Vitamin B1", "Thiamin", "B1", "Thiamine"]', 'mg', 1.1, 10, 300, 100, 'Energiestoffwechsel, Nervensystem, Herzfunktion', 1),

-- Vitamin B2 (Riboflavin) - DGE: 1,1-1,4 mg (average 1,25)
(105, 'Vitamin B2 (Riboflavin)', '["Vitamin B2", "Riboflavin", "B2"]', 'mg', 1.25, 10, 200, 100, 'Energiestoffwechsel, Zellwachstum, Sehkraft', 1),

-- Vitamin B3 (Niacin) - DGE: 12-15 mg (average 13,5)
(106, 'Vitamin B3 (Niacin)', '["Vitamin B3", "Niacin", "B3", "Nicotinsäure"]', 'mg', 13.5, 20, 35, 30, 'Energiestoffwechsel, Cholesterinspiegel, Hautgesundheit', 1),

-- Vitamin B5 (Pantothensäure) - DGE: 5 mg (Schätzwert)
(107, 'Vitamin B5 (Pantothensäure)', '["Vitamin B5", "Pantothensäure", "B5", "Pantothenic Acid"]', 'mg', 5, 10, 100, 50, 'Energiestoffwechsel, Hormonproduktion, Stressresistenz', 1),

-- Vitamin B6 (update existing) - DGE: 1,4-1,6 mg (average 1,5)
(7, 'Vitamin B6 (Pyridoxin)', '["B6", "Pyridoxin", "Vitamin B6"]', 'mg', 1.5, 10, 100, 50, 'Aminosäurestoffwechsel, Nervensystem, Immunfunktion', 1),

-- Vitamin B7/Biotin (update existing) - DGE: 40 µg (Schätzwert)
(9, 'Vitamin B7 (Biotin)', '["B7", "Vitamin H", "Biotin", "Vitamin B7"]', 'µg', 40, 2500, 10000, 5000, 'Stoffwechsel, Haut- und Haargesundheit, Genregulation', 1),

-- Vitamin B9/Folsäure (update existing) - DGE: 300 µg
(8, 'Vitamin B9 (Folsäure)', '["Folat", "B9", "5-MTHF", "Folsäure", "Vitamin B9"]', 'µg', 300, 800, 1000, 800, 'Zellteilung, DNA-Synthese, Blutbildung, Schwangerschaft', 1),

-- Vitamin B12 (update existing) - DGE: 4,0 µg
(2, 'Vitamin B12 (Cobalamin)', '["B12", "Cobalamin", "Methylcobalamin", "Cyanocobalamin", "Vitamin B12"]', 'µg', 4, 250, 1000, 500, 'Blutbildung, Nervensystem, DNA-Synthese, Energiestoffwechsel', 1),

-- Vitamin C (update existing) - DGE: 95-110 mg (average 102,5)
(6, 'Vitamin C (Ascorbinsäure)', '["C", "Ascorbinsäure", "Ester-C", "Vitamin C"]', 'mg', 102.5, 1000, 2000, 1500, 'Immunsystem, Antioxidans, Kollagenbildung, Eisenaufnahme', 1);

-- ================================
-- 3. Additional vitamin forms for completeness
-- ================================

INSERT OR REPLACE INTO nutrients (id, name, synonyms, standard_unit, dge_recommended, study_recommended, max_safe_dose, warning_threshold, effects, category_id) VALUES

-- Specialized B12 forms
(108, 'Vitamin B12 (Methylcobalamin)', '["Methylcobalamin", "Methyl-B12", "B12 Methyl"]', 'µg', 4, 250, 1000, 500, 'Blutbildung, Nervensystem, aktive B12-Form', 1),
(109, 'Vitamin B12 (Cyanocobalamin)', '["Cyanocobalamin", "Cyano-B12"]', 'µg', 4, 250, 1000, 500, 'Blutbildung, Nervensystem, stabile B12-Form', 1),

-- Vitamin D2 alternative
(110, 'Vitamin D2 (Ergocalciferol)', '["D2", "Ergocalciferol", "Vitamin D2"]', 'µg', 20, 50, 100, 75, 'Knochengesundheit, Calciumaufnahme, pflanzliches Vitamin D', 1),

-- Active folate form
(111, 'Vitamin B9 (5-MTHF)', '["5-MTHF", "Methylfolat", "L-Methylfolat", "Metafolin"]', 'µg', 300, 800, 1000, 800, 'Aktive Folatform, Zellteilung, DNA-Synthese', 1),

-- Beta-Carotin (Provitamin A)
(112, 'Vitamin A (Beta-Carotin)', '["Beta-Carotin", "Betacarotin", "Provitamin A", "β-Carotin"]', 'mg', 2, 6, 20, 15, 'Sehkraft, Antioxidans, Hautgesundheit, Vorstufe von Vitamin A', 1);

-- ================================
-- 4. Update existing nutrients with effects where missing
-- ================================

UPDATE nutrients SET effects = 'Knochengesundheit, Immunsystem, Calciumaufnahme', category_id = 1 
WHERE id = 1 AND effects IS NULL;

UPDATE nutrients SET effects = 'Blutbildung, Nervensystem, DNA-Synthese, Energiestoffwechsel', category_id = 1 
WHERE id = 2 AND effects IS NULL;

UPDATE nutrients SET effects = 'Immunsystem, Antioxidans, Kollagenbildung, Eisenaufnahme', category_id = 1 
WHERE id = 6 AND effects IS NULL;

UPDATE nutrients SET effects = 'Aminosäurestoffwechsel, Nervensystem, Immunfunktion', category_id = 1 
WHERE id = 7 AND effects IS NULL;

UPDATE nutrients SET effects = 'Zellteilung, DNA-Synthese, Blutbildung, Schwangerschaft', category_id = 1 
WHERE id = 8 AND effects IS NULL;

UPDATE nutrients SET effects = 'Stoffwechsel, Haut- und Haargesundheit, Genregulation', category_id = 1 
WHERE id = 9 AND effects IS NULL;

UPDATE nutrients SET effects = 'Blutgerinnung, Knochengesundheit, Herzgesundheit', category_id = 1 
WHERE id = 10 AND effects IS NULL;

-- ================================
-- SUMMARY INFORMATION
-- ================================
/*
This migration adds all essential vitamins based on DGE 2024 reference values:

Fat-soluble vitamins (fettlösliche Vitamine):
- Vitamin A: 775 µg/day (Sehkraft, Immunsystem, Hautgesundheit)
- Vitamin D: 20 µg/day (Knochengesundheit, Immunsystem, Calciumaufnahme) 
- Vitamin E: 13 mg/day (Antioxidans, Zellschutz, Herzgesundheit)
- Vitamin K: 65 µg/day (Blutgerinnung, Knochengesundheit)

Water-soluble vitamins (wasserlösliche Vitamine):
B-Complex:
- B1 (Thiamin): 1.1 mg/day (Energiestoffwechsel, Nervensystem)
- B2 (Riboflavin): 1.25 mg/day (Energiestoffwechsel, Zellwachstung)
- B3 (Niacin): 13.5 mg/day (Energiestoffwechsel, Cholesterinspiegel)
- B5 (Pantothensäure): 5 mg/day (Energiestoffwechsel, Hormonproduktion)
- B6 (Pyridoxin): 1.5 mg/day (Aminosäurestoffwechsel, Nervensystem)
- B7 (Biotin): 40 µg/day (Stoffwechsel, Haut- und Haargesundheit)
- B9 (Folsäure): 300 µg/day (Zellteilung, DNA-Synthese, Blutbildung)
- B12 (Cobalamin): 4 µg/day (Blutbildung, Nervensystem, DNA-Synthese)

Vitamin C: 102.5 mg/day (Immunsystem, Antioxidans, Kollagenbildung)

All values are averages for adults (19-65 years) based on DGE reference values.
Special forms and alternative nutrients are also included for completeness.
*/