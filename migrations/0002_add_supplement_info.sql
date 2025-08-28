-- Migration: Erweiterte Supplement-Informationen zu Products
-- Datum: 2025-01-15

-- Erweiterte Supplement-Informationen zu Products hinzufügen
ALTER TABLE products ADD COLUMN description TEXT;
ALTER TABLE products ADD COLUMN benefits TEXT; -- JSON array of benefits
ALTER TABLE products ADD COLUMN warnings TEXT; -- Warnhinweise
ALTER TABLE products ADD COLUMN dosage_recommendation TEXT; -- Empfohlene Dosierung
ALTER TABLE products ADD COLUMN category TEXT; -- Vitamin, Mineral, etc.

-- Beispiel-Produktdaten für Demo (echte Supplements)
INSERT OR REPLACE INTO products (
  id, user_id, name, brand, form, price_per_package, servings_per_package, 
  shop_url, image_url, description, benefits, warnings, dosage_recommendation, category
) VALUES 
(1, 1, 'Vitamin D3 4000 IU', 'Sunday Natural', 'Kapsel', 19.90, 120, 
 'https://sunday.de/vitamin-d3-4000', 
 'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=400&h=400&fit=crop',
 'Hochdosiertes Vitamin D3 aus pflanzlichen Quellen für starke Knochen und Immunsystem',
 '["Unterstützt das Immunsystem", "Fördert starke Knochen und Zähne", "Wichtig für Muskelkraft", "Reguliert Calciumaufnahme"]',
 'Nicht bei Nierensteinen einnehmen. Bei Überdosierung Arzt konsultieren.',
 '1 Kapsel täglich zu einer Mahlzeit', 'Vitamin'),

(2, 1, 'Magnesium Glycinat 400mg', 'Biomenta', 'Kapsel', 24.95, 90,
 'https://biomenta.de/magnesium-glycinat',
 'https://images.unsplash.com/photo-1559757148-5c350d0d3c56?w=400&h=400&fit=crop',
 'Hochbioverfügbares Magnesium-Glycinat für Muskeln, Nerven und gegen Müdigkeit',
 '["Reduziert Müdigkeit und Erschöpfung", "Unterstützt normale Muskelfunktion", "Wichtig für das Nervensystem", "Fördert erholsamen Schlaf"]',
 'Bei Nierenproblemen vor Einnahme Arzt konsultieren.',
 '1-2 Kapseln täglich, vorzugsweise abends', 'Mineral'),

(3, 1, 'Omega-3 Algenöl', 'InnoNature', 'Tropfen', 29.90, 30,
 'https://innonature.eu/omega-3-algenoel',
 'https://images.unsplash.com/photo-1584464491033-06628f3a6b7b?w=400&h=400&fit=crop',
 '100% veganes Omega-3 aus Algen mit EPA und DHA für Herz und Gehirn',
 '["Unterstützt Herz-Kreislauf-Gesundheit", "Wichtig für Gehirnfunktion", "Entzündungshemmende Wirkung", "100% vegan und nachhaltig"]',
 'Bei Blutverdünnung Arzt konsultieren. Kühl lagern.',
 '1 Teelöffel (5ml) täglich zu einer Mahlzeit', 'Fettsäure'),

(4, 1, 'B12 Methylcobalamin', 'Naturtreu', 'Tropfen', 24.99, 50,
 'https://naturtreu.de/b12-tropfen',
 'https://images.unsplash.com/photo-1576671081837-49000212a370?w=400&h=400&fit=crop',
 'Hochdosiertes B12 in der aktiven Methylcobalamin-Form für Energie und Nervensystem',
 '["Reduziert Müdigkeit und Erschöpfung", "Wichtig für Nervensystem", "Unterstützt Blutbildung", "Für Veganer essentiell"]',
 'Bei Allergien gegen Kobalt nicht einnehmen.',
 '10 Tropfen täglich unter die Zunge', 'Vitamin'),

(5, 1, 'Zink Bisglycinat 25mg', 'effective nature', 'Kapsel', 19.90, 60,
 'https://effective-nature.de/zink-bisglycinat',
 'https://images.unsplash.com/photo-1550572017-edd951aa8e8a?w=400&h=400&fit=crop',
 'Hochbioverfügbares Zink-Bisglycinat für Immunsystem und gesunde Haut',
 '["Stärkt das Immunsystem", "Wichtig für gesunde Haut", "Unterstützt Wundheilung", "Antioxidative Eigenschaften"]',
 'Nicht auf nüchternen Magen einnehmen. Kann Übelkeit verursachen.',
 '1 Kapsel täglich zu einer Mahlzeit', 'Mineral'),

(6, 1, 'Vitamin C 1000mg', 'Cosphera', 'Kapsel', 22.95, 120,
 'https://cosphera.net/vitamin-c-1000',
 'https://images.unsplash.com/photo-1578662996442-48f60103fc96?w=400&h=400&fit=crop',
 'Hochdosiertes Vitamin C mit Bioflavonoiden für starkes Immunsystem',
 '["Stärkt das Immunsystem", "Antioxidativer Schutz", "Unterstützt Kollagenbildung", "Verbessert Eisenaufnahme"]',
 'Bei Nierensteinen in der Anamnese vorsichtig dosieren.',
 '1 Kapsel täglich zu einer Mahlzeit', 'Vitamin');

-- Nährstoff-Einträge für die Produkte
INSERT OR REPLACE INTO nutrients (id, name, synonyms, standard_unit, dge_recommended) VALUES
(1, 'Vitamin D3', '["Cholecalciferol", "Sonnenvitamin"]', 'µg', 20),
(2, 'Magnesium', '["Mg"]', 'mg', 350),
(3, 'EPA', '["Eicosapentaensäure"]', 'mg', 250),
(4, 'DHA', '["Docosahexaensäure"]', 'mg', 250),
(5, 'Vitamin B12', '["Cobalamin", "Methylcobalamin"]', 'µg', 4),
(6, 'Zink', '["Zn"]', 'mg', 10),
(7, 'Vitamin C', '["Ascorbinsäure"]', 'mg', 110);

-- Nährstoff-Zuordnungen zu Produkten
INSERT OR REPLACE INTO product_nutrients (product_id, nutrient_id, amount, unit, amount_standardized) VALUES
(1, 1, 100, 'µg', 100), -- Vitamin D3 4000 IU = 100µg
(2, 2, 400, 'mg', 400), -- Magnesium 400mg
(3, 3, 1000, 'mg', 1000), -- EPA 1000mg
(3, 4, 500, 'mg', 500), -- DHA 500mg  
(4, 5, 1000, 'µg', 1000), -- B12 1000µg
(5, 6, 25, 'mg', 25), -- Zink 25mg
(6, 7, 1000, 'mg', 1000); -- Vitamin C 1000mg