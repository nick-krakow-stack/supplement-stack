-- Migration: Create available_products table and migrate demo data
-- This creates a global product database that all users can access

-- Create available_products table for global product catalog
CREATE TABLE IF NOT EXISTS available_products (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  
  -- Basic product info
  name TEXT NOT NULL,
  brand TEXT NOT NULL,
  form TEXT NOT NULL,
  
  -- Pricing and packaging
  purchase_price REAL NOT NULL,
  quantity INTEGER NOT NULL,
  price_per_piece REAL,
  dosage_per_day INTEGER DEFAULT 1,
  days_supply INTEGER,
  monthly_cost REAL,
  
  -- Product details
  description TEXT,
  benefits TEXT, -- JSON array
  warnings TEXT, -- JSON array
  dosage_recommendation TEXT,
  category TEXT,
  
  -- Nutrients - stored as JSON for flexibility
  main_nutrients TEXT, -- JSON array: [{"nutrient_id": 1, "amount_per_unit": 4000}]
  secondary_nutrients TEXT, -- JSON array
  
  -- Recommendation
  recommended BOOLEAN DEFAULT FALSE,
  recommendation_rank INTEGER DEFAULT 0,
  
  -- Media
  product_image TEXT,
  shop_url TEXT,
  
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_available_products_category ON available_products(category);
CREATE INDEX IF NOT EXISTS idx_available_products_recommended ON available_products(recommended, recommendation_rank);
CREATE INDEX IF NOT EXISTS idx_available_products_main_nutrients ON available_products(main_nutrients);

-- Insert demo products data from JavaScript into database
INSERT OR IGNORE INTO available_products (
  id, name, brand, form, purchase_price, quantity, price_per_piece, 
  dosage_per_day, days_supply, monthly_cost, description, benefits, 
  warnings, dosage_recommendation, category, main_nutrients, 
  secondary_nutrients, recommended, recommendation_rank, product_image, shop_url
) VALUES

-- Vitamin D3 4000 IU
(1, 'Vitamin D3 4000 IU', 'Sunday Natural', 'Kapsel', 19.90, 50, 0.398, 
 1, 50, 11.94, 'Hochdosiertes Vitamin D3 (Cholecalciferol) aus Lanolin',
 '["Unterstützt das Immunsystem", "Wichtig für Knochen und Zähne", "Trägt zur normalen Muskelfunktion bei"]',
 '[]',
 '1 Kapsel täglich zu einer Mahlzeit', 'Vitamine',
 '[{"nutrient_id": 1, "amount_per_unit": 4000}]',
 '[]',
 1, 1, 'https://images.unsplash.com/photo-1550572017-edd951aa8f72?w=400&h=400&fit=crop&crop=center',
 'https://example.com/vitamin-d3'),

-- Vitamin D3 2000 IU
(11, 'Vitamin D3 2000 IU', 'Nature Love', 'Kapsel', 14.90, 90, 0.166,
 1, 90, 4.97, 'Vitamin D3 in moderater Dosierung für die tägliche Einnahme',
 '["Unterstützt das Immunsystem", "Wichtig für Knochen und Zähne"]',
 '["Nicht über 2000 IU täglich ohne ärztliche Rücksprache"]',
 '1 Kapsel täglich zu einer Mahlzeit', 'Vitamine',
 '[{"nutrient_id": 1, "amount_per_unit": 2000}]',
 '[]',
 1, 2, 'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=400&h=400&fit=crop&crop=center',
 'https://example.com/vitamin-d3-2000'),

-- B12 Methylcobalamin  
(2, 'B12 Methylcobalamin', 'InnoNature', 'Tropfen', 24.90, 60, 0.415,
 1, 60, 12.45, 'Bioaktives Vitamin B12 als Methylcobalamin',
 '["Reduziert Müdigkeit", "Unterstützt Nervensystem", "Wichtig für Blutbildung"]',
 '["Hochdosiert - nicht für Schwangere ohne Rücksprache"]',
 '1 Tropfen täglich', 'Vitamine',
 '[{"nutrient_id": 2, "amount_per_unit": 200}]',
 '[]',
 1, 1, 'https://images.unsplash.com/photo-1559181567-c3190ca9959b?w=400&h=400&fit=crop&crop=center',
 'https://example.com/b12'),

-- B-Komplex Premium
(12, 'B-Komplex Premium', 'Biomenta', 'Kapsel', 21.90, 60, 0.365,
 1, 60, 10.95, 'Vollständiger B-Vitamin Komplex mit allen wichtigen B-Vitaminen',
 '["Unterstützt Energiestoffwechsel", "Nervensystem", "Reduziert Müdigkeit"]',
 '["Kann Urin gelb färben (normal)", "Nicht auf nüchternen Magen"]',
 '1 Kapsel täglich zu einer Mahlzeit', 'Vitamine',
 '[{"nutrient_id": 2, "amount_per_unit": 100}, {"nutrient_id": 7, "amount_per_unit": 5}, {"nutrient_id": 8, "amount_per_unit": 400}]',
 '[]',
 0, 3, NULL, 'https://example.com/b-komplex'),

-- Magnesium Glycinat
(3, 'Magnesium Glycinat', 'Biomenta', 'Kapsel', 16.90, 60, 0.282,
 2, 30, 16.90, 'Hochwertiges Magnesium in Chelat-Form für optimale Bioverfügbarkeit',
 '["Reduziert Müdigkeit", "Unterstützt normale Muskelfunktion", "Trägt zum Elektrolytgleichgewicht bei"]',
 '[]',
 '2 Kapseln täglich zu den Mahlzeiten', 'Mineralien',
 '[{"nutrient_id": 3, "amount_per_unit": 200}]',
 '[]',
 1, 1, 'https://images.unsplash.com/photo-1471864190281-a93a3070b6de?w=400&h=400&fit=crop&crop=center',
 'https://example.com/magnesium'),

-- Zink Bisglycinat
(5, 'Zink Bisglycinat', 'Sunday Natural', 'Kapsel', 12.90, 90, 0.143,
 1, 90, 4.30, 'Hochwertiges Zink in chelatierter Form für optimale Aufnahme',
 '["Unterstützt Immunsystem", "Wichtig für Wundheilung", "Trägt zur normalen Fruchtbarkeit bei"]',
 '["Nicht auf nüchternen Magen", "Abstand zu Eisenpräparaten halten"]',
 '1 Kapsel täglich zu einer Mahlzeit', 'Mineralien',
 '[{"nutrient_id": 5, "amount_per_unit": 15}]',
 '[]',
 1, 1, 'https://images.unsplash.com/photo-1550572017-edd951aa8f72?w=400&h=400&fit=crop&crop=center',
 'https://example.com/zink'),

-- Omega-3 EPA/DHA  
(4, 'Omega-3 EPA/DHA', 'Norsan', 'Öl', 29.00, 30, 0.967,
 1, 30, 29.00, 'Hochwertiges Omega-3 Fischöl mit EPA und DHA',
 '["Unterstützt Herzfunktion", "Wichtig für Gehirn", "Entzündungshemmend"]',
 '["Bei Blutverdünnung ärztliche Rücksprache", "Kühl lagern"]',
 '1 Teelöffel (5ml) täglich', 'Fettsäuren',
 '[{"nutrient_id": 4, "amount_per_unit": 2000}]',
 '[]',
 1, 1, 'https://images.unsplash.com/photo-1559181567-c3190ca9959b?w=400&h=400&fit=crop&crop=center',
 'https://example.com/omega3'),

-- Vitamin C
(6, 'Vitamin C Acerola', 'Effective Nature', 'Kapsel', 18.90, 90, 0.210,
 2, 45, 12.60, 'Natürliches Vitamin C aus Acerola-Kirschen',
 '["Antioxidative Wirkung", "Unterstützt Immunsystem", "Verbessert Eisenaufnahme"]',
 '["Bei empfindlichem Magen zu den Mahlzeiten"]',
 '2 Kapseln täglich', 'Vitamine',
 '[{"nutrient_id": 6, "amount_per_unit": 170}]',
 '[]',
 1, 1, NULL, 'https://example.com/vitamin-c'),

-- Vitamin K2 MK7
(7, 'Vitamin K2 MK7', 'Sunday Natural', 'Kapsel', 24.90, 90, 0.277,
 1, 90, 8.30, 'Vitamin K2 als Menachinon-7 für optimale Calciumverwertung',
 '["Unterstützt Knochengesundheit", "Wichtig für Blutgerinnung", "Synergistisch zu Vitamin D3"]',
 '["Bei Blutverdünnung kontraindiziert", "Rücksprache bei Medikamenten"]',
 '1 Kapsel täglich zu einer fettigen Mahlzeit', 'Vitamine',
 '[{"nutrient_id": 7, "amount_per_unit": 200}]',
 '[]',
 1, 2, NULL, 'https://example.com/vitamin-k2'),

-- Creatin
(8, 'Creatin Monohydrat', 'ESN', 'Pulver', 14.90, 100, 0.149,
 1, 100, 4.47, 'Reines Creatin Monohydrat für Kraft und Ausdauer',
 '["Verbessert Kraft", "Unterstützt Muskelaufbau", "Schnellere Regeneration"]',
 '["Ausreichend Wasser trinken", "Loading-Phase möglich"]',
 '3-5g täglich in Wasser gelöst', 'Aminosäuren',
 '[{"nutrient_id": 8, "amount_per_unit": 3000}]',
 '[]',
 1, 1, NULL, 'https://example.com/creatin'),

-- Protein Pulver
(9, 'Whey Protein Isolate', 'ESN', 'Pulver', 39.90, 40, 0.998,
 1, 40, 29.93, 'Hochwertiges Molkenprotein Isolat mit BCAA',
 '["Muskelaufbau", "Schnelle Verfügbarkeit", "Hoher BCAA-Gehalt"]',
 '["Bei Laktoseintoleranz beachten", "Nicht als Mahlzeitenersatz"]',
 '30g (1 Messlöffel) nach dem Training', 'Protein',
 '[{"nutrient_id": 9, "amount_per_unit": 25000}]',
 '[]',
 0, 2, NULL, 'https://example.com/protein');