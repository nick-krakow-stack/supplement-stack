PRAGMA foreign_keys = ON;

ALTER TABLE products ADD COLUMN source_user_product_id INTEGER REFERENCES user_products(id) ON DELETE SET NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_products_source_user_product_id
  ON products(source_user_product_id)
  WHERE source_user_product_id IS NOT NULL;

-- Startdaten fuer Sub-Wirkstoff-Prompts. Parent/Child werden bewusst ueber
-- Namen verbunden, damit die Migration keine bestehenden IDs voraussetzt.

INSERT OR IGNORE INTO ingredients (name, unit, description) VALUES
('Acetyl-L-Carnitin', 'mg', 'Acetylierte Form von L-Carnitin. Wird auf Produktetiketten oft als eigene Carnitin-Form ausgewiesen.'),
('L-Carnitin Tartrat', 'mg', 'Salzform von L-Carnitin mit Tartrat. Wird auf Produktetiketten oft separat angegeben.'),
('L-Carnitin Fumarat', 'mg', 'Salzform von L-Carnitin mit Fumarat. Wird auf Produktetiketten oft separat angegeben.'),
('EPA', 'mg', 'Omega-3-Fettsaeure, die auf Produktetiketten haeufig als EPA-Menge ausgewiesen wird.'),
('DHA', 'mg', 'Omega-3-Fettsaeure, die auf Produktetiketten haeufig als DHA-Menge ausgewiesen wird.'),
('DPA', 'mg', 'Omega-3-Fettsaeure, die auf Produktetiketten gelegentlich als DPA-Menge ausgewiesen wird.');

INSERT INTO ingredient_synonyms (ingredient_id, synonym)
SELECT i.id, 'ALCAR'
FROM ingredients i
WHERE i.name = 'Acetyl-L-Carnitin'
  AND NOT EXISTS (
    SELECT 1 FROM ingredient_synonyms s
    WHERE s.ingredient_id = i.id AND lower(s.synonym) = lower('ALCAR')
  );

INSERT INTO ingredient_synonyms (ingredient_id, synonym)
SELECT i.id, 'Acetylcarnitin'
FROM ingredients i
WHERE i.name = 'Acetyl-L-Carnitin'
  AND NOT EXISTS (
    SELECT 1 FROM ingredient_synonyms s
    WHERE s.ingredient_id = i.id AND lower(s.synonym) = lower('Acetylcarnitin')
  );

INSERT INTO ingredient_synonyms (ingredient_id, synonym)
SELECT i.id, 'L-Carnitin L-Tartrat'
FROM ingredients i
WHERE i.name = 'L-Carnitin Tartrat'
  AND NOT EXISTS (
    SELECT 1 FROM ingredient_synonyms s
    WHERE s.ingredient_id = i.id AND lower(s.synonym) = lower('L-Carnitin L-Tartrat')
  );

INSERT INTO ingredient_synonyms (ingredient_id, synonym)
SELECT i.id, 'L-Carnitine L-Tartrate'
FROM ingredients i
WHERE i.name = 'L-Carnitin Tartrat'
  AND NOT EXISTS (
    SELECT 1 FROM ingredient_synonyms s
    WHERE s.ingredient_id = i.id AND lower(s.synonym) = lower('L-Carnitine L-Tartrate')
  );

INSERT INTO ingredient_synonyms (ingredient_id, synonym)
SELECT i.id, 'L-Carnitine Fumarate'
FROM ingredients i
WHERE i.name = 'L-Carnitin Fumarat'
  AND NOT EXISTS (
    SELECT 1 FROM ingredient_synonyms s
    WHERE s.ingredient_id = i.id AND lower(s.synonym) = lower('L-Carnitine Fumarate')
  );

INSERT INTO ingredient_synonyms (ingredient_id, synonym)
SELECT i.id, 'Eicosapentaensaeure'
FROM ingredients i
WHERE i.name = 'EPA'
  AND NOT EXISTS (
    SELECT 1 FROM ingredient_synonyms s
    WHERE s.ingredient_id = i.id AND lower(s.synonym) = lower('Eicosapentaensaeure')
  );

INSERT INTO ingredient_synonyms (ingredient_id, synonym)
SELECT i.id, 'Docosahexaensaeure'
FROM ingredients i
WHERE i.name = 'DHA'
  AND NOT EXISTS (
    SELECT 1 FROM ingredient_synonyms s
    WHERE s.ingredient_id = i.id AND lower(s.synonym) = lower('Docosahexaensaeure')
  );

INSERT INTO ingredient_synonyms (ingredient_id, synonym)
SELECT i.id, 'Docosapentaensaeure'
FROM ingredients i
WHERE i.name = 'DPA'
  AND NOT EXISTS (
    SELECT 1 FROM ingredient_synonyms s
    WHERE s.ingredient_id = i.id AND lower(s.synonym) = lower('Docosapentaensaeure')
  );

INSERT OR IGNORE INTO ingredient_sub_ingredients (
  parent_ingredient_id,
  child_ingredient_id,
  sort_order,
  prompt_label,
  is_default_prompt
)
SELECT parent.id, child.id, 10, 'Acetyl-L-Carnitin', 1
FROM ingredients parent
JOIN ingredients child ON child.name = 'Acetyl-L-Carnitin'
WHERE parent.name = 'L-Carnitin';

INSERT OR IGNORE INTO ingredient_sub_ingredients (
  parent_ingredient_id,
  child_ingredient_id,
  sort_order,
  prompt_label,
  is_default_prompt
)
SELECT parent.id, child.id, 20, 'L-Carnitin Tartrat', 1
FROM ingredients parent
JOIN ingredients child ON child.name = 'L-Carnitin Tartrat'
WHERE parent.name = 'L-Carnitin';

INSERT OR IGNORE INTO ingredient_sub_ingredients (
  parent_ingredient_id,
  child_ingredient_id,
  sort_order,
  prompt_label,
  is_default_prompt
)
SELECT parent.id, child.id, 30, 'L-Carnitin Fumarat', 0
FROM ingredients parent
JOIN ingredients child ON child.name = 'L-Carnitin Fumarat'
WHERE parent.name = 'L-Carnitin';

INSERT OR IGNORE INTO ingredient_sub_ingredients (
  parent_ingredient_id,
  child_ingredient_id,
  sort_order,
  prompt_label,
  is_default_prompt
)
SELECT parent.id, child.id, 10, 'EPA', 1
FROM ingredients parent
JOIN ingredients child ON child.name = 'EPA'
WHERE parent.name = 'Omega-3';

INSERT OR IGNORE INTO ingredient_sub_ingredients (
  parent_ingredient_id,
  child_ingredient_id,
  sort_order,
  prompt_label,
  is_default_prompt
)
SELECT parent.id, child.id, 20, 'DHA', 1
FROM ingredients parent
JOIN ingredients child ON child.name = 'DHA'
WHERE parent.name = 'Omega-3';

INSERT OR IGNORE INTO ingredient_sub_ingredients (
  parent_ingredient_id,
  child_ingredient_id,
  sort_order,
  prompt_label,
  is_default_prompt
)
SELECT parent.id, child.id, 30, 'DPA', 0
FROM ingredients parent
JOIN ingredients child ON child.name = 'DPA'
WHERE parent.name = 'Omega-3';
