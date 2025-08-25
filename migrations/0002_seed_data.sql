-- Sample Data für Supplement Stack Demo
-- Beispiel-Produkte und Stacks

-- Sample Products
INSERT OR IGNORE INTO products (name, brand, serving_size, cost_per_serving, servings_per_container, category, notes) VALUES
('Vitamin D3', 'Nature Made', '1 Kapsel (2000 IU)', 0.08, 180, 'Vitamine', 'Hochdosiertes Vitamin D für Immunsystem und Knochen'),
('Omega-3 Fischöl', 'Nordic Naturals', '2 Kapseln (1000mg EPA/DHA)', 0.45, 120, 'Mineralien', 'Premium Fischöl aus Alaska für Herz und Gehirn'),
('Magnesium Glycinat', 'Thorne', '3 Kapseln (200mg)', 0.35, 90, 'Mineralien', 'Gut verträgliche Magnesium-Form für besseren Schlaf'),
('Whey Protein Isolat', 'Optimum Nutrition', '1 Scoop (30g)', 1.20, 28, 'Protein', 'Hochwertiges Molkenprotein für Muskelaufbau'),
('Kreatin Monohydrat', 'Creapure', '1 Teelöffel (5g)', 0.15, 200, 'Pre-Workout', 'Pharmazeutisches Kreatin für Kraft und Ausdauer'),
('Multivitamin', 'Life Extension', '2 Kapseln', 0.85, 60, 'Vitamine', 'Umfassendes Multivitamin mit hoher Bioverfügbarkeit');

-- Sample Ingredients
INSERT OR IGNORE INTO ingredients (name, category, unit, daily_value, upper_limit, description) VALUES
('Vitamin D3', 'Vitamine', 'IU', 800, 4000, 'Cholecalciferol für Knochengesundheit und Immunsystem'),
('EPA', 'Fettsäuren', 'mg', 250, 3000, 'Eicosapentaensäure - entzündungshemmende Omega-3-Fettsäure'),
('DHA', 'Fettsäuren', 'mg', 250, 3000, 'Docosahexaensäure - wichtig für Gehirn und Augen'),
('Magnesium', 'Mineralien', 'mg', 375, 600, 'Essentielles Mineral für über 300 Körperfunktionen'),
('Kreatin', 'Aminosäuren', 'g', 3, 10, 'Energielieferant für Muskelkraft und -ausdauer'),
('Vitamin C', 'Vitamine', 'mg', 90, 2000, 'Ascorbinsäure für Immunsystem und Kollagenbildung'),
('Vitamin B12', 'Vitamine', 'µg', 2.4, 1000, 'Cobalamin für Nervensystem und Blutbildung'),
('Zink', 'Mineralien', 'mg', 10, 40, 'Spurenelement für Immunsystem und Wundheilung');

-- Sample Product Ingredients (Verknüpfungen)
INSERT OR IGNORE INTO product_ingredients (product_id, ingredient_id, amount_per_serving, unit) VALUES
(1, 1, 2000, 'IU'),  -- Vitamin D3 Produkt enthält 2000 IU Vitamin D3
(2, 2, 600, 'mg'),   -- Omega-3 enthält 600mg EPA
(2, 3, 400, 'mg'),   -- Omega-3 enthält 400mg DHA
(3, 4, 200, 'mg'),   -- Magnesium Glycinat enthält 200mg Magnesium
(5, 5, 5, 'g'),      -- Kreatin Produkt enthält 5g Kreatin
(6, 6, 500, 'mg'),   -- Multivitamin enthält 500mg Vitamin C
(6, 7, 25, 'µg'),    -- Multivitamin enthält 25µg B12
(6, 8, 15, 'mg');    -- Multivitamin enthält 15mg Zink

-- Sample Stacks
INSERT OR IGNORE INTO stacks (name, description, goal) VALUES
('Basis Gesundheit', 'Grundlegende Nährstoffversorgung für allgemeine Gesundheit', 'Gesundheit'),
('Muskelaufbau Stack', 'Optimiert für Krafttraining und Muskelwachstum', 'Muskelaufbau'),
('Immunsystem Boost', 'Stärkung der Abwehrkräfte in der kalten Jahreszeit', 'Gesundheit');

-- Sample Stack Items (Produkte in Stacks)
INSERT OR IGNORE INTO stack_items (stack_id, product_id, daily_servings, timing, notes) VALUES
-- Basis Gesundheit Stack
(1, 1, 1, 'morning', 'Mit dem Frühstück für bessere Aufnahme'),
(1, 2, 1, 'evening', 'Zum Abendessen'),
(1, 6, 1, 'morning', 'Morgens mit viel Wasser'),

-- Muskelaufbau Stack  
(2, 4, 2, 'post-workout', 'Direkt nach dem Training und vor dem Schlafen'),
(2, 5, 1, 'pre-workout', '30 Minuten vor dem Training'),
(2, 3, 1, 'evening', 'Vor dem Schlafen für bessere Regeneration'),

-- Immunsystem Stack
(3, 1, 1, 'morning', 'Vitamin D für Immunfunktion'),
(3, 6, 1, 'morning', 'Vitamine und Antioxidantien'),
(3, 8, 1, 'evening', 'Zink für Immunabwehr');