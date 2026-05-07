-- Ingredient lookup indexes for canonical ingredient search.
--
-- Search normalizes names by removing spaces, hyphens, and underscores before
-- comparing. These expression indexes match the query expressions used by the
-- ingredients search endpoint.

PRAGMA foreign_keys = ON;

CREATE INDEX IF NOT EXISTS idx_ingredients_name_norm
  ON ingredients (
    lower(replace(replace(replace(name, ' ', ''), '-', ''), '_', ''))
  );

CREATE INDEX IF NOT EXISTS idx_ingredient_synonyms_synonym_norm
  ON ingredient_synonyms (
    lower(replace(replace(replace(synonym, ' ', ''), '-', ''), '_', ''))
  );

CREATE INDEX IF NOT EXISTS idx_ingredient_forms_name_norm
  ON ingredient_forms (
    lower(replace(replace(replace(name, ' ', ''), '-', ''), '_', ''))
  );

