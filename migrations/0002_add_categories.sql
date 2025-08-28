-- Add supplement categories system
-- Migration to add categories to products and nutrients

-- Categories table
CREATE TABLE IF NOT EXISTS categories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  sort_order INTEGER DEFAULT 0,
  
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Add category_id to nutrients table
ALTER TABLE nutrients ADD COLUMN category_id INTEGER;
ALTER TABLE nutrients ADD FOREIGN KEY (category_id) REFERENCES categories(id);

-- Add category_id to products table (derived from main nutrient)
ALTER TABLE products ADD COLUMN category_id INTEGER;
ALTER TABLE products ADD FOREIGN KEY (category_id) REFERENCES categories(id);

-- Insert the 10 main supplement categories
INSERT OR IGNORE INTO categories (id, name, description, sort_order) VALUES
(1, 'Vitamine', 'Fettlösliche (A, D, E, K) und wasserlösliche Vitamine (C, B-Komplex)', 1),
(2, 'Mineralstoffe & Elektrolyte', 'Mengenelemente (Calcium, Magnesium, Kalium) und Spurenelemente (Eisen, Zink, Jod)', 2),
(3, 'Aminosäuren & Proteine', 'Essentielle und nicht-essentielle Aminosäuren, Proteinkomplexe (Whey, Casein, Kollagen)', 3),
(4, 'Fettsäuren & Lipidbasierte Substanzen', 'Omega-3/6/9 Fettsäuren, Phospholipide, MCT-Öle', 4),
(5, 'Enzyme & Verdauungshelfer', 'Verdauungsenzyme (Bromelain, Papain, Laktase, Amylase, Lipase, Protease)', 5),
(6, 'Sekundäre Pflanzenstoffe', 'Polyphenole, Carotinoide, Flavonoide (OPC, Resveratrol, Quercetin, Curcumin)', 6),
(7, 'Adaptogene & Pflanzenextrakte', 'Ginseng, Rhodiola, Ashwagandha, Heilpilze (Reishi, Cordyceps, Lion''s Mane)', 7),
(8, 'Hormonnahe Substanzen', 'Melatonin, DHEA, Pregnenolon', 8),
(9, 'Probiotika & Präbiotika', 'Probiotika (Lactobacillus, Bifidobacterium), Präbiotika (Inulin), Synbiotika', 9),
(10, 'Spezielle Health-Supps', 'Coenzyme (Q10, PQQ), Antioxidantien (Alpha-Liponsäure, NAC), Performance-Supps (Kreatin)', 10);

-- Create index for categories
CREATE INDEX IF NOT EXISTS idx_categories_sort_order ON categories(sort_order);
CREATE INDEX IF NOT EXISTS idx_nutrients_category ON nutrients(category_id);
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category_id);