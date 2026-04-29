-- Migration 0028: verified_profiles
-- Profile externer/verifizierter Personen (Ärzte, Wissenschaftler, etc.) deren
-- Empfehlungen in dose_recommendations referenziert werden (verified_profile_id).
-- Persönlichkeitsrecht: Bei Widerruf wird is_verified=0 gesetzt UND die zugehörigen
-- dose_recommendations.is_active=0. NICHT löschen — historische Integrität bleibt
-- erhalten (Audit-Pfad für bereits geteilte Empfehlungen).
-- consent_archive_url ist Pflicht, sobald is_verified=1 — Backend validiert.

CREATE TABLE IF NOT EXISTS verified_profiles (
  id                   INTEGER PRIMARY KEY AUTOINCREMENT,

  slug                 TEXT NOT NULL UNIQUE,        -- für /import/profile/<slug>
  name                 TEXT NOT NULL,
  credentials          TEXT,                        -- z.B. "Dr. med., Endokrinologe"
  profile_url          TEXT,                        -- offizielle Webseite
  avatar_url           TEXT,
  bio                  TEXT,

  -- Verifikations-Status
  is_verified          INTEGER NOT NULL DEFAULT 0,

  -- Einwilligung (DSGVO / Persönlichkeitsrecht)
  consent_documented   INTEGER NOT NULL DEFAULT 0,
  consent_date         INTEGER,                     -- Unix-Sekunden
  consent_notes        TEXT,
  consent_archive_url  TEXT,                        -- R2-Key/URL der archivierten Einwilligung (Pflicht bei is_verified=1)

  created_at           INTEGER NOT NULL DEFAULT (strftime('%s','now')),
  updated_at           INTEGER NOT NULL DEFAULT (strftime('%s','now'))
);

CREATE INDEX IF NOT EXISTS idx_verified_profiles_slug
  ON verified_profiles (slug);

CREATE INDEX IF NOT EXISTS idx_verified_profiles_is_verified
  ON verified_profiles (is_verified);
