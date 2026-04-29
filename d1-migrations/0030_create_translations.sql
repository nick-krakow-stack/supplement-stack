-- Migration 0030: Translations-Tabellen (i18n-Strategie)
-- Beschluss 2026-04-28: separate *_translations-Tabellen statt Suffix-Spalten.
-- Phase B: alle DE-Inhalte landen mit language='de'.
-- blog_translations referenziert blog_posts (kommt in 0031). FK ohne CONSTRAINT
-- weil 0031 nach dieser Migration läuft — Backend validiert Existenz.
-- Slug ist pro Sprache eindeutig (UNIQUE auf (language, slug)) damit jede Sprache
-- ihren eigenen SEO-tauglichen Slug haben kann.

CREATE TABLE IF NOT EXISTS ingredient_translations (
  ingredient_id    INTEGER NOT NULL REFERENCES ingredients(id) ON DELETE CASCADE,
  language         TEXT NOT NULL,                 -- 'de','en','fr',...
  name             TEXT NOT NULL,
  description      TEXT,
  hypo_symptoms    TEXT,
  hyper_symptoms   TEXT,
  PRIMARY KEY (ingredient_id, language)
);

CREATE INDEX IF NOT EXISTS idx_ingredient_translations_language
  ON ingredient_translations (language);

CREATE TABLE IF NOT EXISTS dose_recommendation_translations (
  dose_recommendation_id  INTEGER NOT NULL REFERENCES dose_recommendations(id) ON DELETE CASCADE,
  language                TEXT NOT NULL,
  source_label            TEXT,
  timing                  TEXT,
  context_note            TEXT,
  PRIMARY KEY (dose_recommendation_id, language)
);

CREATE INDEX IF NOT EXISTS idx_dose_recommendation_translations_language
  ON dose_recommendation_translations (language);

CREATE TABLE IF NOT EXISTS verified_profile_translations (
  verified_profile_id  INTEGER NOT NULL REFERENCES verified_profiles(id) ON DELETE CASCADE,
  language             TEXT NOT NULL,
  bio                  TEXT,
  credentials          TEXT,
  PRIMARY KEY (verified_profile_id, language)
);

CREATE INDEX IF NOT EXISTS idx_verified_profile_translations_language
  ON verified_profile_translations (language);

-- blog_posts wird in 0031 erstellt. FK kann hier nicht deklariert werden ohne
-- Migrations-Reihenfolge zu brechen — Backend validiert blog_post_id-Existenz.
CREATE TABLE IF NOT EXISTS blog_translations (
  blog_post_id     INTEGER NOT NULL,
  language         TEXT NOT NULL,
  title            TEXT NOT NULL,
  slug             TEXT NOT NULL,                 -- i18n-fähig: jede Sprache eigener Slug
  excerpt          TEXT,
  meta_description TEXT,                          -- SEO
  PRIMARY KEY (blog_post_id, language)
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_blog_translations_language_slug
  ON blog_translations (language, slug);

CREATE INDEX IF NOT EXISTS idx_blog_translations_language
  ON blog_translations (language);
