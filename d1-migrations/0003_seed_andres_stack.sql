-- Seed: André's Supplement Stack
-- Inserts 23 ingredients, 21 products, product–ingredient links,
-- key interactions/warnings, and one pre-built demo session.

-- -------------------------------------------------------------------------
-- Ingredients
-- -------------------------------------------------------------------------
INSERT OR IGNORE INTO ingredients (id, name, unit, description) VALUES
(1,  'Vitamin D3',            'IU',  'Fettlösliches Sonnenvitamin für Knochen, Immunsystem und Hormonhaushalt'),
(2,  'Vitamin K2',            'µg',  'Fettlösliches Vitamin zur Calciumsteuerung – essenziell in Kombination mit D3'),
(3,  'Magnesium',             'mg',  'Essenzielles Mineral für Nerven, Muskeln, Schlaf und Energiestoffwechsel'),
(4,  'Ginseng',               'mg',  'Adaptogene Pflanzenwurzel zur Unterstützung von Energie und kognitiver Leistung'),
(5,  'Vitamin C',             'mg',  'Wasserlösliches Antioxidans, wichtig für Immunsystem und Kollagenbildung'),
(6,  'Schwarzkümmelöl',       'mg',  'Thymochinon-reiches Öl mit entzündungshemmenden und immunmodulierenden Eigenschaften'),
(7,  'Grapefruitkernextrakt', 'mg',  'Antimikrobieller Extrakt aus Grapefruitkernen'),
(8,  'B-Vitamin-Komplex',     NULL,  'Kombination aller B-Vitamine für Energiestoffwechsel und Nervenfunktion'),
(9,  'Kalium',                'mg',  'Essenzieller Elektrolyt für Herzfunktion, Nerven und Blutdruck'),
(10, 'Omega-3',               'mg',  'Essentielle Fettsäuren (DHA/EPA) aus Algenöl für Herz, Gehirn und Entzündungsregulation'),
(11, 'Zink',                  'mg',  'Spurenelement für Immunsystem, Hormonstatus und Wundheilung'),
(12, 'Creatin',               'g',   'Kraftstoff für ATP-Resynthese; steigert Kraft, Muskelmasse und kognitive Leistung'),
(13, 'L-Carnitin',            'mg',  'Aminosäurederivat für den Transport von Fettsäuren in die Mitochondrien'),
(14, 'Vitamin B12',           'µg',  'Methylcobalamin-Form für Nerven, Blutbildung und Energiestoffwechsel'),
(15, 'Coenzym Q10',           'mg',  'Ubiquinol-Form für mitochondriale Energieproduktion und Antioxidanzschutz'),
(16, 'Selen',                 'µg',  'Essenzielles Spurenelement für Schilddrüse, Immunsystem und Antioxidanzschutz'),
(17, 'Kollagen',              'g',   'Strukturprotein für Gelenke, Haut, Knochen und Bindegewebe'),
(18, 'OPC',                   'mg',  'Oligomere Proanthocyanidine aus Traubenkernextrakt – starkes Antioxidans'),
(19, 'Jod',                   'µg',  'Essenzielles Spurenelement für Schilddrüsenhormonproduktion'),
(20, 'MSM',                   'mg',  'Methylsulfonylmethan – organische Schwefelverbindung für Gelenke und Entzündungshemmung'),
(21, 'Spirulina',             'g',   'Blaualge reich an Proteinen, B-Vitaminen und Chlorophyll'),
(22, 'Chlorella',             'g',   'Grünalge mit Entgiftungseigenschaften; bindet Schwermetalle'),
(23, 'Zeolith',               'g',   'Vulkanisches Mineral zur Bindung und Ausleitung von Toxinen und Schwermetallen');

-- -------------------------------------------------------------------------
-- Products (price = monatliche Kosten in EUR)
-- -------------------------------------------------------------------------
INSERT OR IGNORE INTO products (id, name, form, price, moderation_status, visibility) VALUES
(1,  'Vitamin D3/K2 Tropfen',       'Tropfen',   1.22,  'approved', 'public'),
(2,  'Magnesiumcitrat',             'Kapseln',   5.33,  'approved', 'public'),
(3,  'Ginseng',                     'Kapseln',   9.98,  'approved', 'public'),
(4,  'Vitamin C',                   'Kapseln',  19.96,  'approved', 'public'),
(5,  'Schwarzkümmelöl',             'Kapseln',  11.39,  'approved', 'public'),
(6,  'Grapefruitkernextrakt',       'Kapseln',   4.73,  'approved', 'public'),
(7,  'B-Komplex',                   'Tabletten', 1.81,  'approved', 'public'),
(8,  'Kaliumcitrat',                'Kapseln',   3.45,  'approved', 'public'),
(9,  'Omega 3 Algenöl',             'Öl',       45.89,  'approved', 'public'),
(10, 'Zinkbisglycinat',             'Tabletten', 1.00,  'approved', 'public'),
(11, 'Creatin Monohydrat',          'Pulver',    9.09,  'approved', 'public'),
(12, 'L-Carnitin Komplex',          'Kapseln',  17.99,  'approved', 'public'),
(13, 'Vitamin B12 Tropfen',         'Tropfen',   0.57,  'approved', 'public'),
(14, 'CoQ10 Ubiquinol',             'Softgels', 12.65,  'approved', 'public'),
(15, 'Selen-Komplex',               'Tabletten', 1.06,  'approved', 'public'),
(16, 'Kollagen',                    'Pulver',   18.18,  'approved', 'public'),
(17, 'OPC Traubenkernextrakt',      'Kapseln',   4.50,  'approved', 'public'),
(18, 'Jod (Kaliumjodid)',           'Tabletten', 2.83,  'approved', 'public'),
(19, 'MSM + Vitamin C',             'Tabletten', 3.33,  'approved', 'public'),
(20, 'Spirulina + Chlorella Mix',   'Tabletten',10.76,  'approved', 'public'),
(21, 'Zeolith',                     'Pulver',   29.57,  'approved', 'public');

-- -------------------------------------------------------------------------
-- Product ↔ ingredient links
-- -------------------------------------------------------------------------
-- Vitamin D3/K2 Tropfen: D3 (main, 10000 IU/drop) + K2 (100 µg/drop)
INSERT OR IGNORE INTO product_ingredients (product_id, ingredient_id, is_main, quantity, unit) VALUES
(1, 1, 1, 10000, 'IU'),
(1, 2, 0, 100,   'µg');

-- Magnesiumcitrat: Magnesium (main, 300 mg per 2 caps)
INSERT OR IGNORE INTO product_ingredients (product_id, ingredient_id, is_main, quantity, unit) VALUES
(2, 3, 1, 300, 'mg');

-- Ginseng
INSERT OR IGNORE INTO product_ingredients (product_id, ingredient_id, is_main, quantity, unit) VALUES
(3, 4, 1, NULL, NULL);

-- Vitamin C
INSERT OR IGNORE INTO product_ingredients (product_id, ingredient_id, is_main, quantity, unit) VALUES
(4, 5, 1, NULL, NULL);

-- Schwarzkümmelöl (40 mg per 2 caps)
INSERT OR IGNORE INTO product_ingredients (product_id, ingredient_id, is_main, quantity, unit) VALUES
(5, 6, 1, 40, 'mg');

-- Grapefruitkernextrakt
INSERT OR IGNORE INTO product_ingredients (product_id, ingredient_id, is_main, quantity, unit) VALUES
(6, 7, 1, NULL, NULL);

-- B-Komplex
INSERT OR IGNORE INTO product_ingredients (product_id, ingredient_id, is_main, quantity, unit) VALUES
(7, 8, 1, NULL, NULL);

-- Kaliumcitrat (800 mg per 2 caps)
INSERT OR IGNORE INTO product_ingredients (product_id, ingredient_id, is_main, quantity, unit) VALUES
(8, 9, 1, 800, 'mg');

-- Omega 3 Algenöl
INSERT OR IGNORE INTO product_ingredients (product_id, ingredient_id, is_main, quantity, unit) VALUES
(9, 10, 1, NULL, NULL);

-- Zinkbisglycinat (50 mg per tablet)
INSERT OR IGNORE INTO product_ingredients (product_id, ingredient_id, is_main, quantity, unit) VALUES
(10, 11, 1, 50, 'mg');

-- Creatin Monohydrat (10 g per serving)
INSERT OR IGNORE INTO product_ingredients (product_id, ingredient_id, is_main, quantity, unit) VALUES
(11, 12, 1, 10, 'g');

-- L-Carnitin Komplex (3000 mg per 4 caps)
INSERT OR IGNORE INTO product_ingredients (product_id, ingredient_id, is_main, quantity, unit) VALUES
(12, 13, 1, 3000, 'mg');

-- Vitamin B12 Tropfen (1000 µg per 4 drops)
INSERT OR IGNORE INTO product_ingredients (product_id, ingredient_id, is_main, quantity, unit) VALUES
(13, 14, 1, 1000, 'µg');

-- CoQ10 Ubiquinol (200 mg per softgel)
INSERT OR IGNORE INTO product_ingredients (product_id, ingredient_id, is_main, quantity, unit) VALUES
(14, 15, 1, 200, 'mg');

-- Selen-Komplex
INSERT OR IGNORE INTO product_ingredients (product_id, ingredient_id, is_main, quantity, unit) VALUES
(15, 16, 1, NULL, NULL);

-- Kollagen
INSERT OR IGNORE INTO product_ingredients (product_id, ingredient_id, is_main, quantity, unit) VALUES
(16, 17, 1, NULL, NULL);

-- OPC Traubenkernextrakt
INSERT OR IGNORE INTO product_ingredients (product_id, ingredient_id, is_main, quantity, unit) VALUES
(17, 18, 1, NULL, NULL);

-- Jod (Kaliumjodid, 400 µg per tablet)
INSERT OR IGNORE INTO product_ingredients (product_id, ingredient_id, is_main, quantity, unit) VALUES
(18, 19, 1, 400, 'µg');

-- MSM + Vitamin C (2400 mg MSM per 2 tablets + Vitamin C)
INSERT OR IGNORE INTO product_ingredients (product_id, ingredient_id, is_main, quantity, unit) VALUES
(19, 20, 1, 2400, 'mg'),
(19, 5,  0, NULL, NULL);

-- Spirulina + Chlorella Mix (50:50)
INSERT OR IGNORE INTO product_ingredients (product_id, ingredient_id, is_main, quantity, unit) VALUES
(20, 21, 1, NULL, NULL),
(20, 22, 0, NULL, NULL);

-- Zeolith
INSERT OR IGNORE INTO product_ingredients (product_id, ingredient_id, is_main, quantity, unit) VALUES
(21, 23, 1, NULL, NULL);

-- -------------------------------------------------------------------------
-- Interactions / Warnungen
-- -------------------------------------------------------------------------
-- MSM + Zink (vermeiden)
INSERT OR IGNORE INTO interactions (ingredient_a_id, ingredient_b_id, type, comment) VALUES
(20, 11, 'avoid', 'MSM sollte nicht gleichzeitig mit Zink eingenommen werden – gegenseitige Absorptionshemmung möglich.');

-- MSM + Selen (vermeiden)
INSERT OR IGNORE INTO interactions (ingredient_a_id, ingredient_b_id, type, comment) VALUES
(20, 16, 'avoid', 'MSM und Selen nicht kombinieren – kann die Selenverfügbarkeit beeinträchtigen.');

-- Jod + Chlorella (vermeiden)
INSERT OR IGNORE INTO interactions (ingredient_a_id, ingredient_b_id, type, comment) VALUES
(19, 22, 'avoid', 'Jod nicht zusammen mit Chlorella einnehmen – Chlorella kann Jod binden und die Aufnahme reduzieren.');

-- Zeolith + Jod (vermeiden – Zeolith bindet Jod)
INSERT OR IGNORE INTO interactions (ingredient_a_id, ingredient_b_id, type, comment) VALUES
(23, 19, 'avoid', 'Zeolith mindestens 30 Minuten von allen anderen Supplementen trennen – bindet Nährstoffe und Jod unspezifisch.');

-- Zeolith + B12 (vermeiden – Zeolith bindet B12)
INSERT OR IGNORE INTO interactions (ingredient_a_id, ingredient_b_id, type, comment) VALUES
(23, 14, 'avoid', 'Zeolith mindestens 30 Minuten von Vitamin B12 trennen – Zeolith kann B12 adsorbieren.');

-- -------------------------------------------------------------------------
-- Demo session: André's Morgen-Stack (08:00 Uhr mit fetthaltiger Mahlzeit)
-- Enthält: Magnesium, Ginseng, Vitamin C, Schwarzkümmelöl, Grapefruitkern,
--          B-Komplex, Kalium, Omega-3, Zink, CoQ10, Selen, Kollagen, OPC
-- -------------------------------------------------------------------------
INSERT OR IGNORE INTO demo_sessions (key, stack_json, expires_at) VALUES (
  'andre-morgenstack',
  json('{"products":[{"id":2,"name":"Magnesiumcitrat","price":5.33,"form":"Kapseln"},{"id":3,"name":"Ginseng","price":9.98,"form":"Kapseln"},{"id":4,"name":"Vitamin C","price":19.96,"form":"Kapseln"},{"id":5,"name":"Schwarzkümmelöl","price":11.39,"form":"Kapseln"},{"id":6,"name":"Grapefruitkernextrakt","price":4.73,"form":"Kapseln"},{"id":7,"name":"B-Komplex","price":1.81,"form":"Tabletten"},{"id":8,"name":"Kaliumcitrat","price":3.45,"form":"Kapseln"},{"id":9,"name":"Omega 3 Algenöl","price":45.89,"form":"Öl"},{"id":10,"name":"Zinkbisglycinat","price":1.00,"form":"Tabletten"},{"id":14,"name":"CoQ10 Ubiquinol","price":12.65,"form":"Softgels"},{"id":15,"name":"Selen-Komplex","price":1.06,"form":"Tabletten"},{"id":16,"name":"Kollagen","price":18.18,"form":"Pulver"},{"id":17,"name":"OPC Traubenkernextrakt","price":4.50,"form":"Kapseln"}],"totalMonthly":139.93}'),
  '2027-12-31T23:59:59.000Z'
);
