-- Seed Data für Supplement Stack

-- Admin User erstellen
INSERT OR IGNORE INTO users (email, password_hash, name, role) VALUES 
  ('admin@supplementstack.dev', '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj/VcQzitHy.', 'Administrator', 'admin');

-- Demo User
INSERT OR IGNORE INTO users (email, password_hash, name) VALUES 
  ('demo@supplementstack.dev', '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj/VcQzitHy.', 'Demo User');

-- Basis-Wirkstoffe
INSERT OR IGNORE INTO wirkstoffe (name, einheit, beschreibung, hypo_symptome, hyper_symptome, external_url) VALUES 
  ('Vitamin B12', 'mcg', 'Wichtig für Nervensystem und Blutbildung', 'Müdigkeit, Anämie, Nervenschäden', 'Selten, da wasserlöslich', 'https://supplementguru.de/vitamin-b12'),
  ('Vitamin D3', 'IE', 'Wichtig für Knochen und Immunsystem', 'Knochenschwäche, häufige Infekte', 'Hyperkalzämie, Nierensteine', 'https://supplementguru.de/vitamin-d3'),
  ('Magnesium', 'mg', 'Wichtig für Muskeln und Nervensystem', 'Muskelkrämpfe, Unruhe, Herzrhythmusstörungen', 'Durchfall, Übelkeit', 'https://supplementguru.de/magnesium'),
  ('Zink', 'mg', 'Wichtig für Immunsystem und Wundheilung', 'Schwaches Immunsystem, schlechte Wundheilung', 'Kupfermangel, Magenprobleme', 'https://supplementguru.de/zink'),
  ('Omega-3', 'mg', 'EPA/DHA für Herz und Gehirn', 'Trockene Haut, Konzentrationsprobleme', 'Blutverdünnung, Fischgeruch', 'https://supplementguru.de/omega-3'),
  ('Eisen', 'mg', 'Wichtig für Sauerstofftransport', 'Anämie, Müdigkeit, Blässe', 'Verstopfung, Magenprobleme', 'https://supplementguru.de/eisen'),
  ('MSM', 'mg', 'Organischer Schwefel für Gelenke', 'Gelenkprobleme, schlechte Hautqualität', 'Selten, meist gut verträglich', 'https://supplementguru.de/msm');

-- Synonyme für bessere Suche
INSERT OR IGNORE INTO wirkstoff_synonyme (wirkstoff_id, synonym) VALUES 
  (1, 'B12'), (1, 'Cobalamin'), (1, 'Methylcobalamin'), (1, 'Cyanocobalamin'),
  (2, 'D3'), (2, 'Cholecalciferol'), (2, 'Sonnenvitamin'),
  (3, 'Mg'), (3, 'Magnesiumcitrat'), (3, 'Magnesiumoxid'),
  (4, 'Zn'), (4, 'Zinkpicolinat'), (4, 'Zinkbisglycinat'),
  (5, 'EPA'), (5, 'DHA'), (5, 'Fischöl'),
  (6, 'Fe'), (6, 'Eisenfumarat'), (6, 'Eisenbisglycinat'),
  (7, 'Methylsulfonylmethan'), (7, 'Schwefel');

-- Formen der Wirkstoffe
INSERT OR IGNORE INTO wirkstoff_formen (wirkstoff_id, name, kommentar, score) VALUES 
  (1, 'Methylcobalamin', 'Bioaktive Form, empfohlen', 5),
  (1, 'Adenosylcobalamin', 'Bioaktive Form für Mitochondrien', 4),
  (1, 'Cyanocobalamin', 'Synthetische Form, nicht optimal', 2),
  (3, 'Magnesiumcitrat', 'Gut bioverfügbar', 5),
  (3, 'Magnesiumbisglycinat', 'Sehr gut verträglich', 5),
  (3, 'Magnesiumoxid', 'Schlecht bioverfügbar', 2),
  (4, 'Zinkbisglycinat', 'Gut verträglich', 5),
  (4, 'Zinkpicolinat', 'Gute Bioverfügbarkeit', 4),
  (4, 'Zinksulfat', 'Kann Magenprobleme verursachen', 2);

-- Beispiel-Produkte
INSERT OR IGNORE INTO produkte (name, marke, form, preis, einheit_anzahl, shop_link, moderation_status, sichtbarkeit) VALUES 
  ('Vitamin B12 Methylcobalamin 1000mcg', 'Sunday Natural', 'Tablette', 24.90, 180, 'https://amazon.de/sunday-natural-b12', 'approved', TRUE),
  ('Vitamin D3 5000 IE + K2', 'InnoNature', 'Tropfen', 29.90, 50, 'https://amazon.de/innonature-d3-k2', 'approved', TRUE),
  ('Magnesium Komplex 400mg', 'Natural Elements', 'Kapsel', 19.99, 120, 'https://amazon.de/natural-elements-magnesium', 'approved', TRUE),
  ('Zink Bisglycinat 25mg', 'Gloryfeel', 'Kapsel', 16.90, 90, 'https://amazon.de/gloryfeel-zink', 'approved', TRUE),
  ('Omega-3 Fischöl 2000mg', 'Norsan', 'Flüssig', 45.00, 200, 'https://amazon.de/norsan-omega3', 'approved', TRUE),
  ('MSM Pulver 1000g', 'Vit4ever', 'Pulver', 22.90, 1000, 'https://amazon.de/vit4ever-msm', 'approved', TRUE);

-- Wirkstoffe zu Produkten zuordnen
INSERT OR IGNORE INTO produkt_wirkstoffe (produkt_id, wirkstoff_id, ist_hauptwirkstoff, menge, einheit, form_id) VALUES 
  (1, 1, TRUE, 1000, 'mcg', 1), -- B12 Methylcobalamin
  (2, 2, TRUE, 5000, 'IE', NULL), -- D3
  (3, 3, TRUE, 400, 'mg', 4), -- Magnesiumcitrat
  (4, 4, TRUE, 25, 'mg', 6), -- Zinkbisglycinat
  (5, 5, TRUE, 2000, 'mg', NULL), -- Omega-3
  (6, 7, TRUE, 1000, 'mg', NULL); -- MSM

-- Empfohlene Produkte pro Wirkstoff
INSERT OR IGNORE INTO wirkstoff_empfehlungen (wirkstoff_id, produkt_id, typ, reihenfolge) VALUES 
  (1, 1, 'empfohlen', 1), -- B12 -> Sunday Natural
  (2, 2, 'empfohlen', 1), -- D3 -> InnoNature
  (3, 3, 'empfohlen', 1), -- Magnesium -> Natural Elements
  (4, 4, 'empfohlen', 1), -- Zink -> Gloryfeel
  (5, 5, 'empfohlen', 1), -- Omega-3 -> Norsan
  (7, 6, 'empfohlen', 1); -- MSM -> Vit4ever

-- Wichtige Interaktionen
INSERT OR IGNORE INTO wirkstoff_interaktionen (wirkstoff_a_id, wirkstoff_b_id, typ, kommentar, schwere) VALUES 
  (7, 4, 'warnung', 'MSM kann Zink-Aufnahme reduzieren. Zeitversetzt einnehmen.', 'mittel'),
  (6, 4, 'warnung', 'Eisen und Zink konkurrieren um Aufnahme. 2h Abstand einhalten.', 'mittel'),
  (2, 3, 'positiv', 'Vitamin D3 verbessert Magnesium-Verwertung.', 'niedrig'),
  (3, 2, 'positiv', 'Magnesium unterstützt Vitamin D3-Aktivierung.', 'niedrig');

-- Demo Stack für Playground
INSERT OR IGNORE INTO stacks (user_id, name, beschreibung, is_demo, demo_session_key, expires_at) VALUES 
  (NULL, 'Demo Stack', 'Grundversorgung Demo', TRUE, 'demo-playground', datetime('now', '+24 hours'));