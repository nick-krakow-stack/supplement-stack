-- Migration 0024: Seed example products (2 per core ingredient, approved + public)
-- Ingredients: Vitamin D3=1, Vitamin K2=2, Magnesium=3, Vitamin C=5, Zink=11, Vitamin B12=14

PRAGMA foreign_keys = ON;

-- ============================================================
-- Vitamin D3 (ingredient_id = 1)
-- ============================================================
INSERT INTO products (name, brand, form, price, shop_link, image_url, moderation_status, visibility, is_affiliate, serving_size, serving_unit, servings_per_container, container_count)
VALUES ('Vitamin D3 5000 IU', 'Sunday Natural', 'Kapsel', 14.90, 'https://www.amazon.de/s?k=Sunday+Natural+Vitamin+D3+5000&tag=supplementstack-21', 'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=400&q=80', 'approved', 'public', 1, 1, 'Kapsel', 365, 1);
INSERT INTO product_ingredients (product_id, ingredient_id, is_main, quantity, unit) VALUES (last_insert_rowid(), 1, 1, 5000, 'IU');

INSERT INTO products (name, brand, form, price, shop_link, image_url, moderation_status, visibility, is_affiliate, serving_size, serving_unit, servings_per_container, container_count)
VALUES ('Vitamin D3 2000 IU Tropfen', 'Naturtreu', 'Tropfen', 12.50, 'https://www.amazon.de/s?k=Naturtreu+Vitamin+D3+Tropfen', 'https://images.unsplash.com/photo-1550572017-edd951b55104?w=400&q=80', 'approved', 'public', 0, 3, 'Tropfen', 333, 1);
INSERT INTO product_ingredients (product_id, ingredient_id, is_main, quantity, unit) VALUES (last_insert_rowid(), 1, 1, 2000, 'IU');

-- ============================================================
-- Vitamin K2 (ingredient_id = 2)
-- ============================================================
INSERT INTO products (name, brand, form, price, shop_link, image_url, moderation_status, visibility, is_affiliate, serving_size, serving_unit, servings_per_container, container_count)
VALUES ('Vitamin K2 MK-7 200µg', 'Sunday Natural', 'Kapsel', 22.90, 'https://www.amazon.de/s?k=Sunday+Natural+Vitamin+K2+MK7&tag=supplementstack-21', 'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=400&q=80', 'approved', 'public', 1, 1, 'Kapsel', 180, 1);
INSERT INTO product_ingredients (product_id, ingredient_id, is_main, quantity, unit) VALUES (last_insert_rowid(), 2, 1, 200, 'µg');

INSERT INTO products (name, brand, form, price, shop_link, image_url, moderation_status, visibility, is_affiliate, serving_size, serving_unit, servings_per_container, container_count)
VALUES ('Vitamin K2 MK-7 100µg', 'InnoNature', 'Kapsel', 16.95, 'https://www.amazon.de/s?k=InnoNature+Vitamin+K2', 'https://images.unsplash.com/photo-1550572017-edd951b55104?w=400&q=80', 'approved', 'public', 0, 1, 'Kapsel', 120, 1);
INSERT INTO product_ingredients (product_id, ingredient_id, is_main, quantity, unit) VALUES (last_insert_rowid(), 2, 1, 100, 'µg');

-- ============================================================
-- Magnesium (ingredient_id = 3)
-- ============================================================
INSERT INTO products (name, brand, form, price, shop_link, image_url, moderation_status, visibility, is_affiliate, serving_size, serving_unit, servings_per_container, container_count)
VALUES ('Magnesium Bisglycinat 300mg', 'Sunday Natural', 'Kapsel', 18.90, 'https://www.amazon.de/s?k=Sunday+Natural+Magnesium+Bisglycinat&tag=supplementstack-21', 'https://images.unsplash.com/photo-1626378763638-8f6e82d1ebba?w=400&q=80', 'approved', 'public', 1, 2, 'Kapsel', 180, 1);
INSERT INTO product_ingredients (product_id, ingredient_id, is_main, quantity, unit) VALUES (last_insert_rowid(), 3, 1, 300, 'mg');

INSERT INTO products (name, brand, form, price, shop_link, image_url, moderation_status, visibility, is_affiliate, serving_size, serving_unit, servings_per_container, container_count)
VALUES ('Magnesium Malat 400mg', 'Naturtreu', 'Pulver', 15.90, 'https://www.amazon.de/s?k=Naturtreu+Magnesium+Malat', 'https://images.unsplash.com/photo-1607619056574-7b8d3ee536b2?w=400&q=80', 'approved', 'public', 0, 5, 'g', 80, 1);
INSERT INTO product_ingredients (product_id, ingredient_id, is_main, quantity, unit) VALUES (last_insert_rowid(), 3, 1, 400, 'mg');

-- ============================================================
-- Vitamin C (ingredient_id = 5)
-- ============================================================
INSERT INTO products (name, brand, form, price, shop_link, image_url, moderation_status, visibility, is_affiliate, serving_size, serving_unit, servings_per_container, container_count)
VALUES ('Vitamin C 1000mg Pufferform', 'Sunday Natural', 'Kapsel', 16.90, 'https://www.amazon.de/s?k=Sunday+Natural+Vitamin+C+1000mg&tag=supplementstack-21', 'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=400&q=80', 'approved', 'public', 1, 1, 'Kapsel', 365, 1);
INSERT INTO product_ingredients (product_id, ingredient_id, is_main, quantity, unit) VALUES (last_insert_rowid(), 5, 1, 1000, 'mg');

INSERT INTO products (name, brand, form, price, shop_link, image_url, moderation_status, visibility, is_affiliate, serving_size, serving_unit, servings_per_container, container_count)
VALUES ('Vitamin C 500mg', 'dm Bio', 'Tablette', 4.95, 'https://www.dm.de/suche?query=Vitamin+C', 'https://images.unsplash.com/photo-1550572017-edd951b55104?w=400&q=80', 'approved', 'public', 0, 1, 'Tablette', 100, 1);
INSERT INTO product_ingredients (product_id, ingredient_id, is_main, quantity, unit) VALUES (last_insert_rowid(), 5, 1, 500, 'mg');

-- ============================================================
-- Zink (ingredient_id = 11)
-- ============================================================
INSERT INTO products (name, brand, form, price, shop_link, image_url, moderation_status, visibility, is_affiliate, serving_size, serving_unit, servings_per_container, container_count)
VALUES ('Zink Bisglycinat 25mg', 'Sunday Natural', 'Kapsel', 13.90, 'https://www.amazon.de/s?k=Sunday+Natural+Zink+Bisglycinat&tag=supplementstack-21', 'https://images.unsplash.com/photo-1626378763638-8f6e82d1ebba?w=400&q=80', 'approved', 'public', 1, 1, 'Kapsel', 365, 1);
INSERT INTO product_ingredients (product_id, ingredient_id, is_main, quantity, unit) VALUES (last_insert_rowid(), 11, 1, 25, 'mg');

INSERT INTO products (name, brand, form, price, shop_link, image_url, moderation_status, visibility, is_affiliate, serving_size, serving_unit, servings_per_container, container_count)
VALUES ('Zink 10mg', 'Rossmann', 'Tablette', 3.49, 'https://www.rossmann.de/de/suche/zink', 'https://images.unsplash.com/photo-1607619056574-7b8d3ee536b2?w=400&q=80', 'approved', 'public', 0, 1, 'Tablette', 100, 1);
INSERT INTO product_ingredients (product_id, ingredient_id, is_main, quantity, unit) VALUES (last_insert_rowid(), 11, 1, 10, 'mg');

-- ============================================================
-- Vitamin B12 (ingredient_id = 14)
-- ============================================================
INSERT INTO products (name, brand, form, price, shop_link, image_url, moderation_status, visibility, is_affiliate, serving_size, serving_unit, servings_per_container, container_count)
VALUES ('Vitamin B12 Methylcobalamin 1000µg', 'Sunday Natural', 'Kapsel', 17.90, 'https://www.amazon.de/s?k=Sunday+Natural+B12+Methylcobalamin&tag=supplementstack-21', 'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=400&q=80', 'approved', 'public', 1, 1, 'Kapsel', 365, 1);
INSERT INTO product_ingredients (product_id, ingredient_id, is_main, quantity, unit) VALUES (last_insert_rowid(), 14, 1, 1000, 'µg');

INSERT INTO products (name, brand, form, price, shop_link, image_url, moderation_status, visibility, is_affiliate, serving_size, serving_unit, servings_per_container, container_count)
VALUES ('Vitamin B12 500µg Lutschtablette', 'Naturtreu', 'Lutschtablette', 11.90, 'https://www.amazon.de/s?k=Naturtreu+B12+Lutschtablette', 'https://images.unsplash.com/photo-1550572017-edd951b55104?w=400&q=80', 'approved', 'public', 0, 1, 'Lutschtablette', 90, 1);
INSERT INTO product_ingredients (product_id, ingredient_id, is_main, quantity, unit) VALUES (last_insert_rowid(), 14, 1, 500, 'µg');
