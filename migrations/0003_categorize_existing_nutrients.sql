-- Update existing nutrients with correct categories
-- This migration assigns categories to all existing nutrients

UPDATE nutrients SET category_id = 1 WHERE name IN ('Vitamin D3', 'Vitamin B12', 'Vitamin C'); -- Vitamine
UPDATE nutrients SET category_id = 2 WHERE name IN ('Magnesium', 'Zink'); -- Mineralstoffe & Elektrolyte
UPDATE nutrients SET category_id = 3 WHERE name = 'Protein'; -- Aminosäuren & Proteine
UPDATE nutrients SET category_id = 4 WHERE name = 'Omega-3'; -- Fettsäuren & Lipidbasierte Substanzen
UPDATE nutrients SET category_id = 10 WHERE name = 'Kreatin'; -- Spezielle Health-Supps

-- Update products with categories based on their main nutrient
-- Products get category from their primary (first) nutrient
UPDATE products SET category_id = (
  SELECT n.category_id 
  FROM nutrients n 
  JOIN product_nutrients pn ON n.id = pn.nutrient_id 
  WHERE pn.product_id = products.id 
  ORDER BY pn.amount_standardized DESC 
  LIMIT 1
) WHERE category_id IS NULL;

-- Add more sample nutrients to demonstrate all categories

-- More Vitamine (Category 1)
INSERT OR IGNORE INTO nutrients (name, synonyms, standard_unit, external_article_url, link_label, dge_recommended, study_recommended, max_safe_dose, warning_threshold, category_id) VALUES 
  ('Vitamin A', '["Retinol", "Beta-Carotin"]', 'µg', 'https://example.com/vitamin-a', 'Mehr über Vitamin A', 800.0, 1500.0, 3000.0, 2500.0, 1),
  ('Vitamin E', '["Tocopherol"]', 'mg', 'https://example.com/vitamin-e', 'Mehr über Vitamin E', 12.0, 15.0, 300.0, 100.0, 1),
  ('Vitamin K2', '["Menachinon", "MK-7"]', 'µg', 'https://example.com/vitamin-k2', 'Mehr über Vitamin K2', 70.0, 100.0, 1000.0, 500.0, 1),
  ('Folsäure', '["Vitamin B9", "Folat"]', 'µg', 'https://example.com/folsaeure', 'Mehr über Folsäure', 400.0, 600.0, 1000.0, 800.0, 1),
  ('Biotin', '["Vitamin B7", "Vitamin H"]', 'µg', 'https://example.com/biotin', 'Mehr über Biotin', 40.0, 50.0, 5000.0, 2500.0, 1);

-- More Mineralstoffe & Elektrolyte (Category 2)
INSERT OR IGNORE INTO nutrients (name, synonyms, standard_unit, external_article_url, link_label, dge_recommended, study_recommended, max_safe_dose, warning_threshold, category_id) VALUES 
  ('Eisen', '["Iron", "Fe"]', 'mg', 'https://example.com/eisen', 'Mehr über Eisen', 14.0, 18.0, 45.0, 30.0, 2),
  ('Calcium', '["Ca"]', 'mg', 'https://example.com/calcium', 'Mehr über Calcium', 1000.0, 1200.0, 2500.0, 2000.0, 2),
  ('Kalium', '["Potassium", "K"]', 'mg', 'https://example.com/kalium', 'Mehr über Kalium', 4000.0, 4700.0, 6000.0, 5500.0, 2),
  ('Jod', '["Iodine", "I"]', 'µg', 'https://example.com/jod', 'Mehr über Jod', 200.0, 250.0, 600.0, 400.0, 2),
  ('Selen', '["Selenium", "Se"]', 'µg', 'https://example.com/selen', 'Mehr über Selen', 70.0, 100.0, 400.0, 300.0, 2);

-- Aminosäuren & Proteine (Category 3)
INSERT OR IGNORE INTO nutrients (name, synonyms, standard_unit, external_article_url, link_label, dge_recommended, study_recommended, max_safe_dose, warning_threshold, category_id) VALUES 
  ('L-Arginin', '["Arginin"]', 'g', 'https://example.com/arginin', 'Mehr über L-Arginin', 0.0, 5.0, 20.0, 15.0, 3),
  ('BCAA', '["Verzweigtkettige Aminosäuren", "Leucin"]', 'g', 'https://example.com/bcaa', 'Mehr über BCAA', 0.0, 10.0, 35.0, 25.0, 3),
  ('Glutamin', '["L-Glutamin"]', 'g', 'https://example.com/glutamin', 'Mehr über Glutamin', 0.0, 5.0, 40.0, 30.0, 3),
  ('Kollagen', '["Collagen", "Kollagenpeptide"]', 'g', 'https://example.com/kollagen', 'Mehr über Kollagen', 0.0, 10.0, 20.0, 15.0, 3);

-- Fettsäuren & Lipidbasierte Substanzen (Category 4)
INSERT OR IGNORE INTO nutrients (name, synonyms, standard_unit, external_article_url, link_label, dge_recommended, study_recommended, max_safe_dose, warning_threshold, category_id) VALUES 
  ('EPA', '["Eicosapentaensäure"]', 'mg', 'https://example.com/epa', 'Mehr über EPA', 250.0, 500.0, 2000.0, 1500.0, 4),
  ('DHA', '["Docosahexaensäure"]', 'mg', 'https://example.com/dha', 'Mehr über DHA', 250.0, 500.0, 2000.0, 1500.0, 4),
  ('MCT-Öl', '["Mittelkettige Triglyceride"]', 'g', 'https://example.com/mct-oel', 'Mehr über MCT-Öl', 0.0, 15.0, 30.0, 25.0, 4);

-- Enzyme & Verdauungshelfer (Category 5)
INSERT OR IGNORE INTO nutrients (name, synonyms, standard_unit, external_article_url, link_label, dge_recommended, study_recommended, max_safe_dose, warning_threshold, category_id) VALUES 
  ('Bromelain', '["Ananas-Enzym"]', 'GDU', 'https://example.com/bromelain', 'Mehr über Bromelain', 0.0, 500.0, 2000.0, 1500.0, 5),
  ('Laktase', '["Lactase"]', 'FCC', 'https://example.com/laktase', 'Mehr über Laktase', 0.0, 9000.0, 20000.0, 15000.0, 5);

-- Sekundäre Pflanzenstoffe (Category 6)
INSERT OR IGNORE INTO nutrients (name, synonyms, standard_unit, external_article_url, link_label, dge_recommended, study_recommended, max_safe_dose, warning_threshold, category_id) VALUES 
  ('Curcumin', '["Kurkumin", "Turmeric"]', 'mg', 'https://example.com/curcumin', 'Mehr über Curcumin', 0.0, 500.0, 8000.0, 6000.0, 6),
  ('Quercetin', '["Quercitrin"]', 'mg', 'https://example.com/quercetin', 'Mehr über Quercetin', 0.0, 500.0, 1000.0, 800.0, 6),
  ('Resveratrol', '["Trans-Resveratrol"]', 'mg', 'https://example.com/resveratrol', 'Mehr über Resveratrol', 0.0, 100.0, 1500.0, 1000.0, 6),
  ('OPC', '["Oligomere Proanthocyanidine", "Traubenkernextrakt"]', 'mg', 'https://example.com/opc', 'Mehr über OPC', 0.0, 150.0, 400.0, 300.0, 6);

-- Adaptogene & Pflanzenextrakte (Category 7)
INSERT OR IGNORE INTO nutrients (name, synonyms, standard_unit, external_article_url, link_label, dge_recommended, study_recommended, max_safe_dose, warning_threshold, category_id) VALUES 
  ('Ashwagandha', '["Withania somnifera"]', 'mg', 'https://example.com/ashwagandha', 'Mehr über Ashwagandha', 0.0, 600.0, 3000.0, 2000.0, 7),
  ('Rhodiola', '["Rhodiola rosea", "Rosenwurz"]', 'mg', 'https://example.com/rhodiola', 'Mehr über Rhodiola', 0.0, 300.0, 600.0, 500.0, 7),
  ('Ginseng', '["Panax ginseng"]', 'mg', 'https://example.com/ginseng', 'Mehr über Ginseng', 0.0, 200.0, 3000.0, 2000.0, 7),
  ('Reishi', '["Ganoderma lucidum", "Glänzender Lackporling"]', 'mg', 'https://example.com/reishi', 'Mehr über Reishi', 0.0, 1000.0, 6000.0, 4000.0, 7);

-- Hormonnahe Substanzen (Category 8)
INSERT OR IGNORE INTO nutrients (name, synonyms, standard_unit, external_article_url, link_label, dge_recommended, study_recommended, max_safe_dose, warning_threshold, category_id) VALUES 
  ('Melatonin', '["Schlafhormon"]', 'mg', 'https://example.com/melatonin', 'Mehr über Melatonin', 0.0, 1.0, 10.0, 5.0, 8);

-- Probiotika & Präbiotika (Category 9)
INSERT OR IGNORE INTO nutrients (name, synonyms, standard_unit, external_article_url, link_label, dge_recommended, study_recommended, max_safe_dose, warning_threshold, category_id) VALUES 
  ('Probiotika', '["Lactobacillus", "Bifidobacterium"]', 'KBE', 'https://example.com/probiotika', 'Mehr über Probiotika', 0.0, 10000000000.0, 100000000000.0, 50000000000.0, 9),
  ('Inulin', '["Präbiotikum"]', 'g', 'https://example.com/inulin', 'Mehr über Inulin', 0.0, 5.0, 15.0, 12.0, 9);

-- Spezielle Health-Supps (Category 10)
INSERT OR IGNORE INTO nutrients (name, synonyms, standard_unit, external_article_url, link_label, dge_recommended, study_recommended, max_safe_dose, warning_threshold, category_id) VALUES 
  ('Coenzym Q10', '["CoQ10", "Ubiquinol"]', 'mg', 'https://example.com/coq10', 'Mehr über CoQ10', 0.0, 100.0, 1200.0, 800.0, 10),
  ('Alpha-Liponsäure', '["ALA", "Thioctsäure"]', 'mg', 'https://example.com/alpha-liponsaeure', 'Mehr über Alpha-Liponsäure', 0.0, 200.0, 1800.0, 1200.0, 10),
  ('NAC', '["N-Acetylcystein"]', 'mg', 'https://example.com/nac', 'Mehr über NAC', 0.0, 600.0, 1800.0, 1200.0, 10),
  ('Beta-Alanin', '["β-Alanin"]', 'g', 'https://example.com/beta-alanin', 'Mehr über Beta-Alanin', 0.0, 3.0, 6.4, 5.0, 10);