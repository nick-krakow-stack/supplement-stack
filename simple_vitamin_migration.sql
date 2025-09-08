-- Simple Vitamin Migration - Compatible with existing database structure
-- This adds all essential vitamins without changing the existing schema

-- Add effects column if it doesn't exist (safe operation)
-- This will fail silently if column already exists
-- ALTER TABLE nutrients ADD COLUMN effects TEXT;

-- Delete existing vitamin entries to avoid conflicts (if they exist)
DELETE FROM nutrients WHERE id IN (101, 102, 103, 104, 105, 106, 107, 108, 109, 110, 111, 112);

-- Insert new vitamins without category_id (will use existing schema)
INSERT OR IGNORE INTO nutrients (id, name, synonyms, standard_unit, dge_recommended, study_recommended, max_safe_dose, warning_threshold) VALUES

-- Fat-soluble vitamins
(101, 'Vitamin A (Retinol)', '["Vitamin A", "Retinol", "Beta-Carotin", "A", "Retinyl"]', 'µg', 775, 1500, 3000, 2400),
(102, 'Vitamin E (Tocopherol)', '["Vitamin E", "Tocopherol", "Alpha-Tocopherol", "E"]', 'mg', 13, 15, 300, 200),
(103, 'Vitamin K1 (Phylloquinon)', '["K1", "Phylloquinon", "Vitamin K1"]', 'µg', 65, 100, 1000, 500),

-- B-Complex vitamins
(104, 'Vitamin B1 (Thiamin)', '["Vitamin B1", "Thiamin", "B1", "Thiamine"]', 'mg', 1.1, 10, 300, 100),
(105, 'Vitamin B2 (Riboflavin)', '["Vitamin B2", "Riboflavin", "B2"]', 'mg', 1.25, 10, 200, 100),
(106, 'Vitamin B3 (Niacin)', '["Vitamin B3", "Niacin", "B3", "Nicotinsäure"]', 'mg', 13.5, 20, 35, 30),
(107, 'Vitamin B5 (Pantothensäure)', '["Vitamin B5", "Pantothensäure", "B5"]', 'mg', 5, 10, 100, 50),

-- Additional forms
(108, 'Vitamin B12 (Methylcobalamin)', '["Methylcobalamin", "Methyl-B12"]', 'µg', 4, 250, 1000, 500),
(109, 'Vitamin B12 (Cyanocobalamin)', '["Cyanocobalamin", "Cyano-B12"]', 'µg', 4, 250, 1000, 500),
(110, 'Vitamin D2 (Ergocalciferol)', '["D2", "Ergocalciferol", "Vitamin D2"]', 'µg', 20, 50, 100, 75),
(111, 'Vitamin B9 (5-MTHF)', '["5-MTHF", "Methylfolat", "L-Methylfolat"]', 'µg', 300, 800, 1000, 800),
(112, 'Vitamin A (Beta-Carotin)', '["Beta-Carotin", "Betacarotin", "Provitamin A"]', 'mg', 2, 6, 20, 15);

-- Update existing vitamins with DGE reference values
UPDATE nutrients SET 
  name = 'Vitamin D3 (Cholecalciferol)',
  synonyms = '["D3", "Cholecalciferol", "Vitamin D", "Sonnenvitamin"]',
  dge_recommended = 20,
  study_recommended = 50,
  max_safe_dose = 100,
  warning_threshold = 75
WHERE id = 1;

UPDATE nutrients SET 
  name = 'Vitamin B12 (Cobalamin)',
  synonyms = '["B12", "Cobalamin", "Methylcobalamin", "Cyanocobalamin", "Vitamin B12"]',
  dge_recommended = 4,
  study_recommended = 250,
  max_safe_dose = 1000,
  warning_threshold = 500
WHERE id = 2;

UPDATE nutrients SET 
  name = 'Vitamin C (Ascorbinsäure)',
  synonyms = '["C", "Ascorbinsäure", "Ester-C", "Vitamin C"]',
  dge_recommended = 102.5,
  study_recommended = 1000,
  max_safe_dose = 2000,
  warning_threshold = 1500
WHERE id = 6;

UPDATE nutrients SET 
  name = 'Vitamin B6 (Pyridoxin)',
  synonyms = '["B6", "Pyridoxin", "Vitamin B6"]',
  dge_recommended = 1.5,
  study_recommended = 10,
  max_safe_dose = 100,
  warning_threshold = 50
WHERE id = 7;

UPDATE nutrients SET 
  name = 'Vitamin B9 (Folsäure)',
  synonyms = '["Folat", "B9", "5-MTHF", "Folsäure", "Vitamin B9"]',
  dge_recommended = 300,
  study_recommended = 800,
  max_safe_dose = 1000,
  warning_threshold = 800
WHERE id = 8;

UPDATE nutrients SET 
  name = 'Vitamin B7 (Biotin)',
  synonyms = '["B7", "Vitamin H", "Biotin", "Vitamin B7"]',
  dge_recommended = 40,
  study_recommended = 2500,
  max_safe_dose = 10000,
  warning_threshold = 5000
WHERE id = 9;

UPDATE nutrients SET 
  name = 'Vitamin K2 (Menaquinon)',
  synonyms = '["K2", "MK-7", "Menaquinon", "Vitamin K", "Vitamin K2"]',
  dge_recommended = 65,
  study_recommended = 200,
  max_safe_dose = 1000,
  warning_threshold = 500
WHERE id = 10;