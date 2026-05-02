-- Migration 0036: Rename product recommendation links table
--
-- The public API route remains /api/recommendations for compatibility.
-- This table stores product recommendations for ingredients, not dosage
-- recommendations. Dose guidance stays in dose_recommendations.

ALTER TABLE recommendations RENAME TO product_recommendations;

DROP INDEX IF EXISTS idx_recommendations_ingredient_id;
DROP INDEX IF EXISTS idx_recommendations_product_id;

CREATE INDEX IF NOT EXISTS idx_product_recommendations_ingredient_id
  ON product_recommendations (ingredient_id);

CREATE INDEX IF NOT EXISTS idx_product_recommendations_product_id
  ON product_recommendations (product_id);

-- Temporary deploy-compatibility view for old live code that still reads or
-- writes the former recommendations table name. Remove this view and its
-- triggers in a later migration after all code uses product_recommendations.
CREATE VIEW recommendations AS
SELECT id, ingredient_id, product_id, type
FROM product_recommendations;

-- Temporary deploy-compatibility trigger for old INSERT INTO recommendations
-- statements during the deploy window.
CREATE TRIGGER recommendations_insert
INSTEAD OF INSERT ON recommendations
BEGIN
  INSERT INTO product_recommendations (id, ingredient_id, product_id, type)
  VALUES (NEW.id, NEW.ingredient_id, NEW.product_id, NEW.type);
END;

-- Temporary deploy-compatibility trigger for old
-- DELETE FROM recommendations WHERE id = ? statements during the deploy window.
CREATE TRIGGER recommendations_delete
INSTEAD OF DELETE ON recommendations
BEGIN
  DELETE FROM product_recommendations
  WHERE id = OLD.id;
END;
