PRAGMA foreign_keys = ON;

ALTER TABLE ingredient_synonyms ADD COLUMN language TEXT NOT NULL DEFAULT 'de';

CREATE INDEX IF NOT EXISTS idx_ingredient_synonyms_language
  ON ingredient_synonyms(language);

CREATE INDEX IF NOT EXISTS idx_ingredient_synonyms_lookup_language
  ON ingredient_synonyms(synonym, language);

CREATE INDEX IF NOT EXISTS idx_ingredient_synonyms_ingredient_language
  ON ingredient_synonyms(ingredient_id, language);
