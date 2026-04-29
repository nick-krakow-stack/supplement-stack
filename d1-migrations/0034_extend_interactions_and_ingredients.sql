-- Migration 0034: interactions Table-Rebuild + ingredients.preferred_unit
--
-- TEIL 1: interactions Table-Rebuild
-- ---------------------------------------------------------
-- Bisheriges Schema: ingredient_a_id, ingredient_b_id mit UNIQUE(a_id,b_id).
-- Erweiterung: Partner kann auch Food/Medikament/Condition sein, nicht nur
-- ein anderer Ingredient. SQLite kann UNIQUE-Constraints nicht via ALTER TABLE
-- ändern → Table-Rebuild ist der einzig saubere Weg.
--
-- UNIQUE-Constraint mit nullable partner_ingredient_id / partner_label:
-- SQLite behandelt NULL-Werte in UNIQUE-Indizes als "verschieden", was hier
-- false-negatives produziert. Workaround: COALESCE auf Sentinel-Werte
-- (-1 für ID, '_' für Label) im UNIQUE INDEX (analog Pattern in 0027).

CREATE TABLE IF NOT EXISTS interactions_new (
  id                       INTEGER PRIMARY KEY AUTOINCREMENT,

  ingredient_id            INTEGER NOT NULL REFERENCES ingredients(id) ON DELETE CASCADE,
  partner_type             TEXT NOT NULL DEFAULT 'ingredient'
                             CHECK (partner_type IN ('ingredient','food','medication','condition')),
  partner_ingredient_id    INTEGER REFERENCES ingredients(id) ON DELETE CASCADE,  -- NULL wenn partner_type≠'ingredient'
  partner_label            TEXT,                  -- z.B. 'Kaffee', 'Levothyroxin' (wenn partner_type≠'ingredient')

  type                     TEXT,                  -- synergy/antagonism/timing/...
  severity                 TEXT DEFAULT 'medium',
  mechanism                TEXT,
  comment                  TEXT,
  source_url               TEXT,
  source_label             TEXT,

  is_active                INTEGER NOT NULL DEFAULT 1,
  created_at               TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Daten-Migration: alle Bestandseinträge sind partner_type='ingredient'.
INSERT INTO interactions_new (
  ingredient_id, partner_type, partner_ingredient_id,
  type, severity, mechanism, comment, source_url
)
SELECT
  ingredient_a_id,
  'ingredient',
  ingredient_b_id,
  type,
  severity,
  mechanism,
  comment,
  source_url
FROM interactions;

DROP TABLE interactions;

ALTER TABLE interactions_new RENAME TO interactions;

-- UNIQUE-Index mit COALESCE-Workaround (NULL-Vergleich-Falle in SQLite UNIQUE):
CREATE UNIQUE INDEX IF NOT EXISTS uq_interactions_partner
  ON interactions (
    ingredient_id,
    partner_type,
    COALESCE(partner_ingredient_id, -1),
    COALESCE(partner_label, '_')
  );

-- Lookup-Indizes
CREATE INDEX IF NOT EXISTS idx_interactions_ingredient_active
  ON interactions (ingredient_id, is_active);

CREATE INDEX IF NOT EXISTS idx_interactions_partner_ingredient
  ON interactions (partner_ingredient_id);

-- TEIL 2: ingredients.preferred_unit
-- ---------------------------------------------------------
-- Neue Spalte für die bevorzugte Anzeige-Einheit (mg/µg/IU/g/ml/...).
-- Initial-Wert vom alten unit übernehmen damit nichts NULL bleibt.

ALTER TABLE ingredients ADD COLUMN preferred_unit TEXT;

UPDATE ingredients SET preferred_unit = unit WHERE preferred_unit IS NULL;
