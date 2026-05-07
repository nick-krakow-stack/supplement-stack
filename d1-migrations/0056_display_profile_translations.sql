PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS display_profile_translations (
  display_profile_id INTEGER NOT NULL,
  language TEXT NOT NULL,
  effect_summary TEXT,
  timing TEXT,
  timing_note TEXT,
  intake_hint TEXT,
  card_note TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (display_profile_id, language),
  CHECK (TRIM(language) <> ''),
  FOREIGN KEY (display_profile_id) REFERENCES ingredient_display_profiles(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_display_profile_translations_language
  ON display_profile_translations(language);

INSERT OR IGNORE INTO display_profile_translations (
  display_profile_id,
  language,
  effect_summary,
  timing,
  timing_note,
  intake_hint,
  card_note,
  created_at,
  updated_at
)
SELECT
  id,
  'de',
  effect_summary,
  timing,
  timing_note,
  intake_hint,
  card_note,
  created_at,
  updated_at
FROM ingredient_display_profiles
WHERE effect_summary IS NOT NULL
   OR timing IS NOT NULL
   OR timing_note IS NOT NULL
   OR intake_hint IS NOT NULL
   OR card_note IS NOT NULL;
