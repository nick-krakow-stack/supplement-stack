-- Migration 0035: Daten-Migration dosage_guidelines → dose_recommendations
--                 + Rename des Legacy-Tables.
--
-- WICHTIG / Manuelle Nachpflege:
-- Rows ohne dose_max UND ohne dose_min werden NICHT migriert (nicht migrierbar
-- mangels NOT-NULL-Wert in dose_recommendations.dose_max). Solche Rows bleiben
-- in dosage_guidelines_legacy erhalten und müssen manuell nachgepflegt werden.
-- Filter: WHERE COALESCE(dg.dose_max, dg.dose_min, 0) > 0.
--
-- Mapping (siehe Plan):
--   adult         → adult,    sex_filter=NULL,   is_athlete=0, purpose=maintenance
--   adult_female  → adult,    sex_filter=female, is_athlete=0, purpose=maintenance
--   adult_male    → adult,    sex_filter=male,   is_athlete=0, purpose=maintenance
--   athlete       → adult,    sex_filter=NULL,   is_athlete=1, purpose=maintenance
--   elderly       → elderly,  sex_filter=NULL,   is_athlete=0, purpose=maintenance
--   deficient     → adult,    sex_filter=NULL,   is_athlete=0, purpose=deficiency_correction
--   pregnant      → pregnant, sex_filter=NULL,   is_athlete=0, purpose=maintenance
--
-- source_type: study, falls source IN ('study','studies','studien','pubmed','cochrane'),
-- sonst official (im Backend reviewen).
-- review_due_at = verified_at + 2 Jahre.
-- Legacy-Tabelle wird umbenannt (nicht gedroppt) zur historischen Integrität.

INSERT INTO dose_recommendations (
  ingredient_id,
  population_id,
  source_type,
  source_label,
  source_url,
  dose_min,
  dose_max,
  unit,
  timing,
  context_note,
  sex_filter,
  is_athlete,
  purpose,
  is_default,
  is_active,
  relevance_score,
  category_name,
  population_slug,
  verified_at,
  review_due_at,
  created_at,
  updated_at
)
SELECT
  dg.ingredient_id,
  CASE dg.population
    WHEN 'pregnant' THEN (SELECT id FROM populations WHERE slug='pregnant')
    WHEN 'elderly'  THEN (SELECT id FROM populations WHERE slug='elderly')
    ELSE                  (SELECT id FROM populations WHERE slug='adult')
  END                                                                AS population_id,
  CASE
    WHEN LOWER(dg.source) IN ('study','studies','studien','pubmed','cochrane') THEN 'study'
    ELSE 'official'
  END                                                                AS source_type,
  COALESCE(dg.source_title, dg.source)                               AS source_label,
  dg.source_url                                                      AS source_url,
  dg.dose_min                                                        AS dose_min,
  COALESCE(dg.dose_max, dg.dose_min, 0)                              AS dose_max,
  COALESCE(dg.unit, 'mg')                                            AS unit,
  dg.timing                                                          AS timing,
  dg.notes                                                           AS context_note,
  CASE dg.population
    WHEN 'adult_female' THEN 'female'
    WHEN 'adult_male'   THEN 'male'
    ELSE NULL
  END                                                                AS sex_filter,
  CASE WHEN dg.population = 'athlete'   THEN 1 ELSE 0 END            AS is_athlete,
  CASE WHEN dg.population = 'deficient' THEN 'deficiency_correction'
       ELSE 'maintenance' END                                        AS purpose,
  COALESCE(dg.is_default, 0)                                         AS is_default,
  1                                                                  AS is_active,
  50                                                                 AS relevance_score,
  i.category                                                         AS category_name,
  CASE dg.population
    WHEN 'pregnant' THEN 'pregnant'
    WHEN 'elderly'  THEN 'elderly'
    ELSE                  'adult'
  END                                                                AS population_slug,
  strftime('%s', dg.created_at)                                      AS verified_at,
  strftime('%s', dg.created_at) + (2 * 365 * 86400)                  AS review_due_at,
  strftime('%s', dg.created_at)                                      AS created_at,
  strftime('%s','now')                                               AS updated_at
FROM dosage_guidelines dg
JOIN ingredients i ON i.id = dg.ingredient_id
WHERE COALESCE(dg.dose_max, dg.dose_min, 0) > 0;

-- Legacy-Tabelle umbenennen (NICHT droppen — Fallback bei Migrations-Bugs +
-- Container für Rows ohne Dosis, die manuell nachgepflegt werden müssen).
ALTER TABLE dosage_guidelines RENAME TO dosage_guidelines_legacy;
