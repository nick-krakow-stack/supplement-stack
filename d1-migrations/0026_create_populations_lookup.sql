-- Migration 0026: Populations Lookup-Tabelle
-- Ersetzt freie TEXT-Werte in dosage_guidelines.population durch FK-Lookup.
-- Mapping athlete/deficient/sex auf eigene Spalten kommt in 0027.

CREATE TABLE IF NOT EXISTS populations (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  slug         TEXT NOT NULL UNIQUE,         -- adult, pregnant, breastfeeding, children, elderly
  name_de      TEXT NOT NULL,
  description  TEXT,
  priority     INTEGER NOT NULL DEFAULT 100, -- niedriger = wichtiger bei Mehrfach-Match
  created_at   INTEGER NOT NULL DEFAULT (strftime('%s','now'))
);

INSERT INTO populations (slug, name_de, description, priority) VALUES
  ('adult',         'Erwachsene',          'Standard-Empfehlung für Erwachsene 19–64',                              100),
  ('pregnant',      'Schwangere',          'Schwangerschaft – ggf. erhöhter Bedarf, Sicherheitsgrenzen abweichend',  10),
  ('breastfeeding', 'Stillende',           'Stillzeit – erhöhter Bedarf für Mutter und Kind',                        20),
  ('children',      'Kinder & Jugendliche','Bis 18 Jahre – stark altersabhängige Dosierung',                         30),
  ('elderly',       'Senioren',            '65+ – häufig veränderter Bedarf, Resorption, Medikation',                40);
