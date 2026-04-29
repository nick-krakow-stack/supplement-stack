-- Migration 0027: Recommendations (Kern-Tabelle Dosage-System)
-- Ersetzt perspektivisch dosage_guidelines. Daten-Migration kommt in B.12.
-- Quellen: official, study, profile, user_private, user_public.
-- Defaults pro (ingredient, population, sex_filter, purpose, is_athlete)-Kombi
-- werden via Partial UNIQUE Index abgesichert (siehe unten, COALESCE-Workaround
-- für SQLite NULL-Vergleichsverhalten in UNIQUE-Indizes).

CREATE TABLE IF NOT EXISTS dose_recommendations (
  id                       INTEGER PRIMARY KEY AUTOINCREMENT,

  -- Zuordnung
  ingredient_id            INTEGER NOT NULL REFERENCES ingredients(id) ON DELETE CASCADE,
  population_id            INTEGER NOT NULL REFERENCES populations(id),

  -- Quelle
  source_type              TEXT NOT NULL CHECK (source_type IN ('official','study','profile','user_private','user_public')),
  source_label             TEXT NOT NULL,        -- z.B. "DGE 2024", "Müller et al. 2023"
  source_url               TEXT,                 -- Pflicht-Validierung im Backend (Profile evtl. ohne URL)

  -- Dosis
  dose_min                 REAL,
  dose_max                 REAL NOT NULL,
  unit                     TEXT NOT NULL,        -- mg, µg, IU, …
  per_kg_body_weight       REAL,                 -- für mg/kg-Studiendosierungen
  per_kg_cap               REAL,                 -- Obergrenze trotz mg/kg

  -- Kontext / UX
  timing                   TEXT,                 -- z.B. "morgens nüchtern", "zum Essen"
  context_note             TEXT,                 -- Hover/Tap-Tooltip

  -- Filter / Targeting
  sex_filter               TEXT CHECK (sex_filter IS NULL OR sex_filter IN ('male','female')),
  is_athlete               INTEGER NOT NULL DEFAULT 0,
  purpose                  TEXT NOT NULL DEFAULT 'maintenance'
                             CHECK (purpose IN ('maintenance','deficiency_correction','therapeutic')),

  -- Status / Sichtbarkeit
  is_default               INTEGER NOT NULL DEFAULT 0,
  is_active                INTEGER NOT NULL DEFAULT 1,
  relevance_score          INTEGER NOT NULL DEFAULT 50,  -- 0–100, für Studien-Sortierung

  -- Ownership (User-Empfehlungen + Public Sharing Phase H)
  created_by_user_id       INTEGER REFERENCES users(id) ON DELETE SET NULL,
  is_public                INTEGER NOT NULL DEFAULT 0,

  -- Verified Profile (Tabelle wird in B.4 erstellt; FK-Constraint folgt dann)
  verified_profile_id      INTEGER,

  -- Read-Performance (Denormalisierung, vom Backend befüllt)
  category_name            TEXT,
  population_slug          TEXT,
  verified_profile_name    TEXT,

  -- Lifecycle
  published_at             INTEGER,
  verified_at              INTEGER,
  review_due_at            INTEGER,              -- Auto-Reminder bei veralteten Daten
  superseded_by_id         INTEGER REFERENCES dose_recommendations(id) ON DELETE SET NULL,

  created_at               INTEGER NOT NULL DEFAULT (strftime('%s','now')),
  updated_at               INTEGER NOT NULL DEFAULT (strftime('%s','now'))
);

-- Lese-Pfade
CREATE INDEX IF NOT EXISTS idx_dose_recommendations_ingredient_active_relevance
  ON dose_recommendations (ingredient_id, is_active, relevance_score DESC);

CREATE INDEX IF NOT EXISTS idx_dose_recommendations_ingredient_population
  ON dose_recommendations (ingredient_id, population_id);

CREATE INDEX IF NOT EXISTS idx_dose_recommendations_user_public
  ON dose_recommendations (created_by_user_id, is_public);

-- Default-Garantie: genau 1 Default pro (ingredient, population, sex_filter, purpose, is_athlete)
-- WHERE is_default=1 AND is_active=1.
-- SQLite-Eigenheit: NULL-Werte in UNIQUE-Indizes gelten als verschieden, daher
-- COALESCE auf Sentinel-Wert für nullable Spalten (sex_filter).
CREATE UNIQUE INDEX IF NOT EXISTS uq_dose_recommendations_default
  ON dose_recommendations (
    ingredient_id,
    population_id,
    COALESCE(sex_filter, '_'),
    purpose,
    is_athlete
  )
  WHERE is_default = 1 AND is_active = 1;
