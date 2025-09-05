-- Seed nutrients data based on demo system
-- This matches the nutrients from the demo-modal.js file

INSERT OR IGNORE INTO nutrients (id, name, synonyms, standard_unit, external_article_url, dge_recommended, study_recommended, max_safe_dose, warning_threshold) VALUES
-- HAUPTWIRKSTOFFE - Das, was Nutzer suchen
(1, 'Vitamin D3', '["D3", "Cholecalciferol", "Vitamin D", "Sonnenvitamin"]', 'IE', '', 800, 2000, 4000, 4000),
(2, 'Vitamin B12', '["B12", "Cobalamin", "Methylcobalamin", "Cyanocobalamin"]', 'µg', '', 4, 250, 1000, 1000),
(3, 'Magnesium', '["Mg", "Magnium"]', 'mg', '', 300, 400, 350, 350),
(4, 'Omega-3', '["Omega 3", "Fischöl", "Algenöl", "Marine Omega"]', 'mg', '', 250, 1000, 5000, 5000),
(5, 'Zink', '["Zn", "Zinc", "Bisglycinat", "Citrat"]', 'mg', '', 10, 15, 25, 25),
(6, 'Vitamin C', '["C", "Ascorbinsäure", "Ester-C"]', 'mg', '', 110, 1000, 1000, 1000),
(11, 'L-Carnitin', '["Carnitin", "Acetyl-L-Carnitin"]', 'mg', '', 300, 2000, 3000, 3000),

-- SUB-WIRKSTOFFE - Können gesucht werden, verweisen auf Hauptwirkstoff  
(41, 'EPA', '["Eicosapentaensäure"]', 'mg', '', 250, 1000, 5000, 5000),
(42, 'DHA', '["Docosahexaensäure"]', 'mg', '', 100, 1000, 5000, 5000),
(43, 'DPA', '["Docosapentaensäure"]', 'mg', '', 10, 100, 1000, 1000),

-- Weitere wichtige Nährstoffe für Vollständigkeit
(7, 'Vitamin B6', '["B6", "Pyridoxin"]', 'mg', '', 1.6, 10, 100, 100),
(8, 'Folsäure', '["Folat", "B9", "5-MTHF"]', 'µg', '', 300, 800, 1000, 1000),
(9, 'Biotin', '["B7", "Vitamin H"]', 'µg', '', 40, 2500, 10000, 10000),
(10, 'Vitamin K2', '["K2", "MK-7", "Menaquinon"]', 'µg', '', 70, 200, 1000, 1000),
(12, 'Eisen', '["Fe", "Eisengluconat", "Eisenfumarat"]', 'mg', '', 15, 18, 45, 45),
(13, 'Calcium', '["Ca", "Kalzium"]', 'mg', '', 1000, 1200, 2500, 2500),
(14, 'Kalium', '["K", "Potassium"]', 'mg', '', 4000, 4700, 6000, 6000),
(15, 'Selen', '["Se", "Selenmethionin"]', 'µg', '', 70, 200, 400, 400),
(16, 'Jod', '["I", "Iodine"]', 'µg', '', 180, 300, 600, 600),
(17, 'Chrom', '["Cr", "Chrompicolinat"]', 'µg', '', 40, 200, 1000, 1000),
(18, 'Kupfer', '["Cu", "Kupfergluconat"]', 'mg', '', 1.5, 2, 10, 10);