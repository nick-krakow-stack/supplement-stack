-- Supplement Stack - Test Data
-- Sample data for development and testing

-- Insert basic nutrients with German names
INSERT OR IGNORE INTO nutrients (name, synonyms, standard_unit, external_article_url, link_label, dge_recommended, study_recommended, max_safe_dose, warning_threshold) VALUES 
  ('Vitamin D3', '["Cholecalciferol", "Vitamin D"]', 'µg', 'https://example.com/vitamin-d', 'Mehr über Vitamin D', 20.0, 50.0, 100.0, 80.0),
  ('Vitamin B12', '["Cobalamin", "B12"]', 'µg', 'https://example.com/vitamin-b12', 'Mehr über B12', 4.0, 10.0, 1000.0, 500.0),
  ('Magnesium', '["Mg"]', 'mg', 'https://example.com/magnesium', 'Mehr über Magnesium', 300.0, 400.0, 800.0, 600.0),
  ('Omega-3', '["EPA", "DHA", "Fischöl"]', 'mg', 'https://example.com/omega-3', 'Mehr über Omega-3', 250.0, 1000.0, 3000.0, 2000.0),
  ('Zink', '["Zinc", "Zn"]', 'mg', 'https://example.com/zink', 'Mehr über Zink', 10.0, 15.0, 40.0, 25.0),
  ('Vitamin C', '["Ascorbinsäure", "L-Ascorbinsäure"]', 'mg', 'https://example.com/vitamin-c', 'Mehr über Vitamin C', 100.0, 500.0, 2000.0, 1000.0),
  ('Kreatin', '["Creatine", "Kreatinmonohydrat"]', 'g', 'https://example.com/kreatin', 'Mehr über Kreatin', 0.0, 3.0, 5.0, 4.0),
  ('Protein', '["Eiweiß", "Whey"]', 'g', 'https://example.com/protein', 'Mehr über Protein', 50.0, 80.0, 200.0, 150.0);

-- Insert test user
INSERT OR IGNORE INTO users (email, password_hash, age, gender, weight, diet_type, guideline_source) VALUES 
  ('test@example.com', '$2a$10$rX8kVqF9E5.123456789', 30, 'männlich', 75.0, 'omnivore', 'DGE');

-- Get user ID for further inserts
-- Note: In real application, this would be handled by the application layer

-- Insert sample products
INSERT OR IGNORE INTO products (user_id, name, brand, form, price_per_package, servings_per_package, shop_url) VALUES 
  (1, 'Vitamin D3 4000 IU', 'Sunday Natural', 'Kapsel', 19.90, 90, 'https://sunday.de/vitamin-d3'),
  (1, 'B12 Tropfen', 'InnoNature', 'Tropfen', 24.90, 100, 'https://innonature.eu/b12-tropfen'),
  (1, 'Magnesium Glycinat', 'Biomenta', 'Kapsel', 16.90, 120, 'https://biomenta.de/magnesium'),
  (1, 'Omega-3 Algenöl', 'Norsan', 'Öl', 29.90, 30, 'https://norsan.de/omega-3'),
  (1, 'Zink Bisglycinate', 'Vitabay', 'Kapsel', 14.90, 60, 'https://vitabay.net/zink');

-- Insert product nutrients (ingredients)
INSERT OR IGNORE INTO product_nutrients (product_id, nutrient_id, amount, unit, amount_standardized) VALUES 
  -- Vitamin D3 4000 IU
  (1, 1, 100.0, 'µg', 100.0),
  
  -- B12 Drops
  (2, 2, 200.0, 'µg', 200.0),
  
  -- Magnesium
  (3, 3, 400.0, 'mg', 400.0),
  
  -- Omega-3 Oil
  (4, 4, 2000.0, 'mg', 2000.0),
  
  -- Zinc
  (5, 5, 15.0, 'mg', 15.0);

-- Insert sample guidelines
INSERT OR IGNORE INTO guidelines (source_name, source_type, nutrient_id, recommended_dose, unit, reference_url) VALUES 
  ('DGE', 'official', 1, 20.0, 'µg', 'https://dge.de/vitamin-d'),
  ('Studien', 'research', 1, 50.0, 'µg', 'https://pubmed.ncbi.nlm.nih.gov/vitamin-d'),
  ('Influencer', 'social', 1, 75.0, 'µg', 'https://youtube.com/vitamin-d'),
  
  ('DGE', 'official', 2, 4.0, 'µg', 'https://dge.de/vitamin-b12'),
  ('Studien', 'research', 2, 10.0, 'µg', 'https://pubmed.ncbi.nlm.nih.gov/b12'),
  
  ('DGE', 'official', 3, 300.0, 'mg', 'https://dge.de/magnesium'),
  ('Studien', 'research', 3, 400.0, 'mg', 'https://pubmed.ncbi.nlm.nih.gov/magnesium');

-- Insert sample stack
INSERT OR IGNORE INTO stacks (user_id, name, description) VALUES 
  (1, 'Grundausstattung', 'Mein täglicher Supplement-Stack für die Grundversorgung'),
  (1, 'Winter-Stack', 'Zusätzliche Supplements für die dunkle Jahreszeit');

-- Insert stack products
INSERT OR IGNORE INTO stack_products (stack_id, product_id, dosage_per_day, dosage_source) VALUES 
  (1, 1, 1.0, 'DGE'),     -- Vitamin D3
  (1, 2, 0.5, 'studien'), -- B12 
  (1, 3, 1.0, 'DGE'),     -- Magnesium
  
  (2, 1, 1.5, 'studien'), -- More Vitamin D in winter
  (2, 2, 1.0, 'studien'), -- B12
  (2, 6, 2.0, 'custom');  -- Vitamin C for immune system

-- Insert sample user note
INSERT OR IGNORE INTO user_notes (user_id, product_id, note) VALUES 
  (1, 1, 'Nehme ich morgens zum Frühstück. Wirkt gut, keine Nebenwirkungen.');

-- Insert sample wishlist items
INSERT OR IGNORE INTO wishlist (user_id, product_id) VALUES 
  (1, 4),  -- Omega-3
  (1, 5);  -- Zink

-- Insert sample nutrient interactions
INSERT OR IGNORE INTO nutrient_interactions (nutrient_a_id, nutrient_b_id, interaction_type, description) VALUES 
  (3, 5, 'negative', 'Magnesium kann die Zinkaufnahme verringern. Zeitversetzt einnehmen.'),
  (1, 3, 'positive', 'Magnesium unterstützt die Vitamin D Verwertung im Körper.');