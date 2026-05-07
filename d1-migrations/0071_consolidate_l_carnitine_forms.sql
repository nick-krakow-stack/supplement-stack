PRAGMA foreign_keys = ON;

-- Consolidate old form-like L-Carnitin ingredient rows into the canonical
-- ingredient and explicit forms:
--   60 Acetyl-L-Carnitin  -> ingredient 13, form 155
--   65 L-Carnitin Tartrat -> ingredient 13, form 154
--   66 L-Carnitin Fumarat -> ingredient 13, form 158

-- Ensure the target ALCAR form profile exists before merging old copy.
INSERT INTO ingredient_display_profiles (
  ingredient_id,
  form_id,
  created_at,
  updated_at
)
SELECT 13, 155, datetime('now'), datetime('now')
WHERE EXISTS (
    SELECT 1 FROM ingredient_forms WHERE id = 155 AND ingredient_id = 13
  )
  AND NOT EXISTS (
    SELECT 1
    FROM ingredient_display_profiles
    WHERE ingredient_id = 13
      AND form_id = 155
      AND sub_ingredient_id IS NULL
  );

-- Preserve old names and synonyms under canonical L-Carnitin.
INSERT INTO ingredient_synonyms (ingredient_id, synonym, language)
WITH source_raw AS (
  SELECT
    name AS synonym,
    'de' AS language,
    lower(replace(replace(replace(trim(name), ' ', ''), '-', ''), '_', '')) AS norm
  FROM ingredients
  WHERE id IN (60, 65, 66)
    AND NULLIF(trim(name), '') IS NOT NULL
  UNION ALL
  SELECT
    synonym,
    language,
    lower(replace(replace(replace(trim(synonym), ' ', ''), '-', ''), '_', '')) AS norm
  FROM ingredient_synonyms
  WHERE ingredient_id IN (60, 65, 66)
    AND NULLIF(trim(synonym), '') IS NOT NULL
),
source_synonyms AS (
  SELECT min(synonym) AS synonym, language, norm
  FROM source_raw
  WHERE norm <> ''
  GROUP BY language, norm
)
SELECT 13, source_synonyms.synonym, source_synonyms.language
FROM source_synonyms
WHERE NOT EXISTS (
  SELECT 1
  FROM ingredient_synonyms existing
  WHERE existing.ingredient_id = 13
    AND existing.language = source_synonyms.language
    AND lower(replace(replace(replace(trim(existing.synonym), ' ', ''), '-', ''), '_', '')) = source_synonyms.norm
);

-- Keep ALCAR dosage labels explicit after moving dose rows to L-Carnitin.
UPDATE dose_recommendations
SET
  source_label = CASE
    WHEN source_label LIKE '%ALCAR%' OR source_label LIKE '%Acetyl-L-Carnitin%' THEN source_label
    ELSE 'Acetyl-L-Carnitin (ALCAR): ' || source_label
  END,
  context_note = CASE
    WHEN NULLIF(trim(context_note), '') IS NULL THEN 'Acetyl-L-Carnitin (ALCAR).'
    WHEN context_note LIKE '%ALCAR%' OR context_note LIKE '%Acetyl-L-Carnitin%' THEN context_note
    ELSE 'Acetyl-L-Carnitin (ALCAR): ' || context_note
  END,
  updated_at = strftime('%s', 'now')
WHERE ingredient_id = 60;

UPDATE dosage_guidelines_legacy
SET
  source_title = CASE
    WHEN source_title LIKE '%ALCAR%' OR source_title LIKE '%Acetyl-L-Carnitin%' THEN source_title
    ELSE 'Acetyl-L-Carnitin (ALCAR): ' || source_title
  END,
  notes = CASE
    WHEN NULLIF(trim(notes), '') IS NULL THEN 'Acetyl-L-Carnitin (ALCAR).'
    WHEN notes LIKE '%ALCAR%' OR notes LIKE '%Acetyl-L-Carnitin%' THEN notes
    ELSE 'Acetyl-L-Carnitin (ALCAR): ' || notes
  END
WHERE ingredient_id = 60;

-- Avoid dose default unique conflicts before remapping to ingredient 13.
UPDATE dose_recommendations
SET
  is_default = 0,
  updated_at = strftime('%s', 'now')
WHERE ingredient_id IN (60, 65, 66)
  AND is_default = 1
  AND is_active = 1
  AND EXISTS (
    SELECT 1
    FROM dose_recommendations other
    WHERE other.id <> dose_recommendations.id
      AND other.ingredient_id IN (13, 60, 65, 66)
      AND other.is_default = 1
      AND other.is_active = 1
      AND other.population_id = dose_recommendations.population_id
      AND COALESCE(other.sex_filter, '_') = COALESCE(dose_recommendations.sex_filter, '_')
      AND other.purpose = dose_recommendations.purpose
      AND other.is_athlete = dose_recommendations.is_athlete
      AND (
        other.ingredient_id = 13
        OR other.id < dose_recommendations.id
      )
  );

UPDATE dose_recommendations
SET
  ingredient_id = 13,
  updated_at = strftime('%s', 'now')
WHERE ingredient_id IN (60, 65, 66);

UPDATE dosage_guidelines_legacy
SET ingredient_id = 13
WHERE ingredient_id IN (60, 65, 66);

-- Merge old ALCAR free-form metadata into the canonical ALCAR form.
UPDATE ingredient_forms
SET
  score = max(
    COALESCE(score, 0),
    COALESCE((SELECT score FROM ingredient_forms WHERE id = 189), 0)
  ),
  is_recommended = max(
    COALESCE(is_recommended, 0),
    COALESCE((SELECT is_recommended FROM ingredient_forms WHERE id = 189), 0)
  ),
  bioavailability = CASE
    WHEN NULLIF(trim(bioavailability), '') IS NULL
    THEN (SELECT bioavailability FROM ingredient_forms WHERE id = 189)
    ELSE bioavailability
  END,
  timing = CASE
    WHEN NULLIF(trim(timing), '') IS NULL
    THEN (SELECT timing FROM ingredient_forms WHERE id = 189)
    ELSE timing
  END,
  tags = CASE
    WHEN NULLIF(trim(tags), '') IS NULL
    THEN (SELECT tags FROM ingredient_forms WHERE id = 189)
    ELSE tags
  END,
  comment = CASE
    WHEN NULLIF(trim((SELECT comment FROM ingredient_forms WHERE id = 189)), '') IS NULL THEN comment
    WHEN NULLIF(trim(comment), '') IS NULL THEN (SELECT comment FROM ingredient_forms WHERE id = 189)
    WHEN instr(comment, (SELECT comment FROM ingredient_forms WHERE id = 189)) > 0 THEN comment
    ELSE comment || ' | Legacy ALCAR free-form note: ' || (SELECT comment FROM ingredient_forms WHERE id = 189)
  END
WHERE id = 155
  AND EXISTS (SELECT 1 FROM ingredient_forms WHERE id = 189);

-- Merge legacy ALCAR profile copy into the canonical form profile.
UPDATE ingredient_display_profiles
SET
  effect_summary = CASE
    WHEN NULLIF(trim(effect_summary), '') IS NULL
    THEN (
      SELECT effect_summary
      FROM ingredient_display_profiles
      WHERE ingredient_id = 60 AND form_id = 189 AND sub_ingredient_id IS NULL
      ORDER BY id
      LIMIT 1
    )
    ELSE effect_summary
  END,
  timing = CASE
    WHEN NULLIF(trim(timing), '') IS NULL
    THEN (
      SELECT timing
      FROM ingredient_display_profiles
      WHERE ingredient_id = 60 AND form_id = 189 AND sub_ingredient_id IS NULL
      ORDER BY id
      LIMIT 1
    )
    ELSE timing
  END,
  timing_note = CASE
    WHEN NULLIF(trim((
      SELECT timing_note
      FROM ingredient_display_profiles
      WHERE ingredient_id = 60 AND form_id = 189 AND sub_ingredient_id IS NULL
      ORDER BY id
      LIMIT 1
    )), '') IS NULL THEN timing_note
    WHEN NULLIF(trim(timing_note), '') IS NULL THEN (
      SELECT timing_note
      FROM ingredient_display_profiles
      WHERE ingredient_id = 60 AND form_id = 189 AND sub_ingredient_id IS NULL
      ORDER BY id
      LIMIT 1
    )
    WHEN instr(timing_note, (
      SELECT timing_note
      FROM ingredient_display_profiles
      WHERE ingredient_id = 60 AND form_id = 189 AND sub_ingredient_id IS NULL
      ORDER BY id
      LIMIT 1
    )) > 0 THEN timing_note
    ELSE timing_note || ' | Legacy ALCAR: ' || (
      SELECT timing_note
      FROM ingredient_display_profiles
      WHERE ingredient_id = 60 AND form_id = 189 AND sub_ingredient_id IS NULL
      ORDER BY id
      LIMIT 1
    )
  END,
  intake_hint = CASE
    WHEN NULLIF(trim(intake_hint), '') IS NULL
    THEN (
      SELECT intake_hint
      FROM ingredient_display_profiles
      WHERE ingredient_id = 60 AND form_id = 189 AND sub_ingredient_id IS NULL
      ORDER BY id
      LIMIT 1
    )
    ELSE intake_hint
  END,
  card_note = CASE
    WHEN NULLIF(trim(card_note), '') IS NULL
    THEN (
      SELECT card_note
      FROM ingredient_display_profiles
      WHERE ingredient_id = 60 AND form_id = 189 AND sub_ingredient_id IS NULL
      ORDER BY id
      LIMIT 1
    )
    ELSE card_note
  END,
  updated_at = datetime('now')
WHERE ingredient_id = 13
  AND form_id = 155
  AND sub_ingredient_id IS NULL
  AND EXISTS (
    SELECT 1
    FROM ingredient_display_profiles
    WHERE ingredient_id = 60 AND form_id = 189 AND sub_ingredient_id IS NULL
  );

INSERT INTO display_profile_translations (
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
  target.id,
  legacy_t.language,
  legacy_t.effect_summary,
  legacy_t.timing,
  legacy_t.timing_note,
  legacy_t.intake_hint,
  legacy_t.card_note,
  legacy_t.created_at,
  datetime('now')
FROM display_profile_translations legacy_t
JOIN ingredient_display_profiles legacy_p
  ON legacy_p.id = legacy_t.display_profile_id
JOIN ingredient_display_profiles target
  ON target.ingredient_id = 13
 AND target.form_id = 155
 AND target.sub_ingredient_id IS NULL
WHERE legacy_p.ingredient_id = 60
  AND legacy_p.form_id = 189
  AND legacy_p.sub_ingredient_id IS NULL
  AND NOT EXISTS (
    SELECT 1
    FROM display_profile_translations existing
    WHERE existing.display_profile_id = target.id
      AND existing.language = legacy_t.language
  );

UPDATE display_profile_translations
SET
  timing_note = CASE
    WHEN NULLIF(trim((
      SELECT legacy_t.timing_note
      FROM display_profile_translations legacy_t
      JOIN ingredient_display_profiles legacy_p
        ON legacy_p.id = legacy_t.display_profile_id
      WHERE legacy_p.ingredient_id = 60
        AND legacy_p.form_id = 189
        AND legacy_p.sub_ingredient_id IS NULL
        AND legacy_t.language = display_profile_translations.language
      LIMIT 1
    )), '') IS NULL THEN timing_note
    WHEN NULLIF(trim(timing_note), '') IS NULL THEN (
      SELECT legacy_t.timing_note
      FROM display_profile_translations legacy_t
      JOIN ingredient_display_profiles legacy_p
        ON legacy_p.id = legacy_t.display_profile_id
      WHERE legacy_p.ingredient_id = 60
        AND legacy_p.form_id = 189
        AND legacy_p.sub_ingredient_id IS NULL
        AND legacy_t.language = display_profile_translations.language
      LIMIT 1
    )
    WHEN instr(timing_note, (
      SELECT legacy_t.timing_note
      FROM display_profile_translations legacy_t
      JOIN ingredient_display_profiles legacy_p
        ON legacy_p.id = legacy_t.display_profile_id
      WHERE legacy_p.ingredient_id = 60
        AND legacy_p.form_id = 189
        AND legacy_p.sub_ingredient_id IS NULL
        AND legacy_t.language = display_profile_translations.language
      LIMIT 1
    )) > 0 THEN timing_note
    ELSE timing_note || ' | Legacy ALCAR: ' || (
      SELECT legacy_t.timing_note
      FROM display_profile_translations legacy_t
      JOIN ingredient_display_profiles legacy_p
        ON legacy_p.id = legacy_t.display_profile_id
      WHERE legacy_p.ingredient_id = 60
        AND legacy_p.form_id = 189
        AND legacy_p.sub_ingredient_id IS NULL
        AND legacy_t.language = display_profile_translations.language
      LIMIT 1
    )
  END,
  updated_at = datetime('now')
WHERE display_profile_id = (
    SELECT id
    FROM ingredient_display_profiles
    WHERE ingredient_id = 13
      AND form_id = 155
      AND sub_ingredient_id IS NULL
    LIMIT 1
  )
  AND EXISTS (
    SELECT 1
    FROM display_profile_translations legacy_t
    JOIN ingredient_display_profiles legacy_p
      ON legacy_p.id = legacy_t.display_profile_id
    WHERE legacy_p.ingredient_id = 60
      AND legacy_p.form_id = 189
      AND legacy_p.sub_ingredient_id IS NULL
      AND legacy_t.language = display_profile_translations.language
  );

-- Store the old L-Carnitin -> ALCAR relationship as form-level context, not
-- as a future self-interaction.
UPDATE ingredient_display_profiles
SET
  card_note = CASE
    WHEN NULLIF(trim(card_note), '') IS NULL THEN (
      SELECT group_concat(comment, ' | ')
      FROM interactions
      WHERE ingredient_id = 13
        AND partner_type = 'ingredient'
        AND partner_ingredient_id IN (60, 65, 66)
        AND NULLIF(trim(comment), '') IS NOT NULL
    )
    ELSE card_note || ' | Legacy ALCAR relation: ' || (
      SELECT group_concat(comment, ' | ')
      FROM interactions
      WHERE ingredient_id = 13
        AND partner_type = 'ingredient'
        AND partner_ingredient_id IN (60, 65, 66)
        AND NULLIF(trim(comment), '') IS NOT NULL
    )
  END,
  updated_at = datetime('now')
WHERE ingredient_id = 13
  AND form_id = 155
  AND sub_ingredient_id IS NULL
  AND EXISTS (
    SELECT 1
    FROM interactions
    WHERE ingredient_id = 13
      AND partner_type = 'ingredient'
      AND partner_ingredient_id IN (60, 65, 66)
      AND NULLIF(trim(comment), '') IS NOT NULL
  );

-- Delete interactions that would become ingredient 13 self-interactions.
DELETE FROM interactions
WHERE partner_type = 'ingredient'
  AND (
    (ingredient_id = 13 AND partner_ingredient_id IN (60, 65, 66))
    OR (ingredient_id IN (60, 65, 66) AND partner_ingredient_id = 13)
    OR (ingredient_id IN (60, 65, 66) AND partner_ingredient_id IN (60, 65, 66))
  );

-- Merge or remap remaining interactions that reference the old IDs.
UPDATE interactions
SET
  comment = CASE
    WHEN NULLIF(trim(comment), '') IS NULL THEN (
      SELECT source.comment
      FROM interactions source
      WHERE source.id <> interactions.id
        AND source.ingredient_id = interactions.ingredient_id
        AND source.partner_type = 'ingredient'
        AND source.partner_ingredient_id IN (60, 65, 66)
      ORDER BY source.id
      LIMIT 1
    )
    ELSE comment
  END,
  source_url = COALESCE(source_url, (
    SELECT source.source_url
    FROM interactions source
    WHERE source.id <> interactions.id
      AND source.ingredient_id = interactions.ingredient_id
      AND source.partner_type = 'ingredient'
      AND source.partner_ingredient_id IN (60, 65, 66)
    ORDER BY source.id
    LIMIT 1
  )),
  source_label = COALESCE(source_label, (
    SELECT source.source_label
    FROM interactions source
    WHERE source.id <> interactions.id
      AND source.ingredient_id = interactions.ingredient_id
      AND source.partner_type = 'ingredient'
      AND source.partner_ingredient_id IN (60, 65, 66)
    ORDER BY source.id
    LIMIT 1
  ))
WHERE partner_type = 'ingredient'
  AND partner_ingredient_id = 13
  AND EXISTS (
    SELECT 1
    FROM interactions source
    WHERE source.id <> interactions.id
      AND source.ingredient_id = interactions.ingredient_id
      AND source.partner_type = 'ingredient'
      AND source.partner_ingredient_id IN (60, 65, 66)
  );

DELETE FROM interactions
WHERE partner_type = 'ingredient'
  AND partner_ingredient_id IN (60, 65, 66)
  AND EXISTS (
    SELECT 1
    FROM interactions target
    WHERE target.id <> interactions.id
      AND target.ingredient_id = interactions.ingredient_id
      AND target.partner_type = 'ingredient'
      AND target.partner_ingredient_id = 13
      AND target.partner_label IS interactions.partner_label
  );

UPDATE interactions
SET
  partner_ingredient_id = 13,
  comment = CASE
    WHEN partner_ingredient_id = 60
      AND comment NOT LIKE '%ALCAR%'
      AND comment NOT LIKE '%Acetyl-L-Carnitin%'
    THEN 'Acetyl-L-Carnitin (ALCAR): ' || comment
    ELSE comment
  END
WHERE partner_type = 'ingredient'
  AND partner_ingredient_id IN (60, 65, 66);

UPDATE interactions
SET ingredient_id = 13
WHERE ingredient_id IN (60, 65, 66)
  AND NOT EXISTS (
    SELECT 1
    FROM interactions target
    WHERE target.id <> interactions.id
      AND target.ingredient_id = 13
      AND target.partner_type = interactions.partner_type
      AND target.partner_ingredient_id IS interactions.partner_ingredient_id
      AND target.partner_label IS interactions.partner_label
  );

DELETE FROM interactions
WHERE ingredient_id IN (60, 65, 66)
   OR partner_ingredient_id IN (60, 65, 66)
   OR ingredient_id = partner_ingredient_id;

-- Product ingredient rows become canonical rows with explicit form IDs.
UPDATE product_ingredients
SET
  ingredient_id = 13,
  form_id = CASE ingredient_id
    WHEN 60 THEN 155
    WHEN 65 THEN 154
    WHEN 66 THEN 158
    ELSE 155
  END,
  parent_ingredient_id = NULL
WHERE ingredient_id IN (60, 65, 66)
   OR form_id = 189;

UPDATE product_ingredients
SET parent_ingredient_id = NULL
WHERE parent_ingredient_id IN (13, 60, 65, 66)
  AND ingredient_id = 13;

UPDATE product_ingredients
SET parent_ingredient_id = NULL
WHERE parent_ingredient_id IN (60, 65, 66);

UPDATE user_product_ingredients
SET
  ingredient_id = 13,
  form_id = CASE ingredient_id
    WHEN 60 THEN 155
    WHEN 65 THEN 154
    WHEN 66 THEN 158
    ELSE 155
  END,
  parent_ingredient_id = NULL
WHERE ingredient_id IN (60, 65, 66)
   OR form_id = 189;

UPDATE user_product_ingredients
SET parent_ingredient_id = NULL
WHERE parent_ingredient_id IN (13, 60, 65, 66)
  AND ingredient_id = 13;

UPDATE user_product_ingredients
SET parent_ingredient_id = NULL
WHERE parent_ingredient_id IN (60, 65, 66);

-- Defensive remaps for direct reference tables that are empty for these IDs
-- in the audited production data.
INSERT INTO ingredient_translations (
  ingredient_id,
  language,
  name,
  description,
  hypo_symptoms,
  hyper_symptoms
)
SELECT
  13,
  legacy.language,
  legacy.name,
  legacy.description,
  legacy.hypo_symptoms,
  legacy.hyper_symptoms
FROM ingredient_translations legacy
WHERE legacy.ingredient_id IN (60, 65, 66)
  AND NOT EXISTS (
    SELECT 1
    FROM ingredient_translations target
    WHERE target.ingredient_id = 13
      AND target.language = legacy.language
  );

DELETE FROM ingredient_translations
WHERE ingredient_id IN (60, 65, 66);

UPDATE ingredient_research_sources
SET
  ingredient_id = 13,
  updated_at = datetime('now')
WHERE ingredient_id IN (60, 65, 66);

UPDATE product_recommendations
SET ingredient_id = 13
WHERE ingredient_id IN (60, 65, 66);

UPDATE ingredient_safety_warnings
SET
  ingredient_id = 13,
  form_id = CASE
    WHEN ingredient_id = 60 OR form_id = 189 THEN 155
    WHEN ingredient_id = 65 THEN 154
    WHEN ingredient_id = 66 THEN 158
    ELSE form_id
  END
WHERE ingredient_id IN (60, 65, 66)
   OR form_id = 189;

UPDATE nutrient_reference_values
SET
  ingredient_id = 13,
  updated_at = datetime('now')
WHERE ingredient_id IN (60, 65, 66)
  AND NOT EXISTS (
    SELECT 1
    FROM nutrient_reference_values target
    WHERE target.ingredient_id = 13
      AND target.organization = nutrient_reference_values.organization
      AND target.population_id IS nutrient_reference_values.population_id
      AND target.kind = nutrient_reference_values.kind
  );

DELETE FROM nutrient_reference_values
WHERE ingredient_id IN (60, 65, 66);

INSERT INTO ingredient_research_status (
  ingredient_id,
  research_status,
  calculation_status,
  internal_notes,
  blog_url,
  reviewed_at,
  review_due_at,
  created_at,
  updated_at,
  version
)
SELECT
  13,
  legacy.research_status,
  legacy.calculation_status,
  legacy.internal_notes,
  legacy.blog_url,
  legacy.reviewed_at,
  legacy.review_due_at,
  legacy.created_at,
  datetime('now'),
  legacy.version
FROM ingredient_research_status legacy
WHERE legacy.ingredient_id IN (60, 65, 66)
  AND NOT EXISTS (
    SELECT 1 FROM ingredient_research_status target WHERE target.ingredient_id = 13
  )
ORDER BY legacy.ingredient_id
LIMIT 1;

DELETE FROM ingredient_research_status
WHERE ingredient_id IN (60, 65, 66);

-- Blog metadata only changes exact JSON arrays of integer ingredient IDs.
UPDATE blog_posts
SET linked_ingredient_ids = (
  WITH mapped AS (
    SELECT
      CASE
        WHEN CAST(value AS INTEGER) IN (60, 65, 66) THEN 13
        ELSE CAST(value AS INTEGER)
      END AS ingredient_id,
      min(CAST(key AS INTEGER)) AS first_key
    FROM json_each(blog_posts.linked_ingredient_ids)
    GROUP BY CASE
      WHEN CAST(value AS INTEGER) IN (60, 65, 66) THEN 13
      ELSE CAST(value AS INTEGER)
    END
  )
  SELECT json_group_array(ingredient_id)
  FROM (
    SELECT ingredient_id
    FROM mapped
    ORDER BY first_key
  )
)
WHERE linked_ingredient_ids IS NOT NULL
  AND json_valid(linked_ingredient_ids)
  AND json_type(linked_ingredient_ids) = 'array'
  AND (
    SELECT COUNT(*) FROM json_each(linked_ingredient_ids)
  ) = (
    SELECT COUNT(*) FROM json_each(linked_ingredient_ids) WHERE type = 'integer'
  )
  AND EXISTS (
    SELECT 1
    FROM json_each(linked_ingredient_ids)
    WHERE type = 'integer'
      AND CAST(value AS INTEGER) IN (60, 65, 66)
  );

-- Remove obsolete sub-ingredient/precursor rows for the old form ingredients.
DELETE FROM ingredient_sub_ingredients
WHERE (parent_ingredient_id = 13 AND child_ingredient_id IN (60, 65, 66))
   OR parent_ingredient_id IN (60, 65, 66)
   OR child_ingredient_id IN (60, 65, 66);

DELETE FROM ingredient_precursors
WHERE ingredient_id IN (60, 65, 66)
   OR precursor_ingredient_id IN (60, 65, 66);

DELETE FROM ingredient_display_profiles
WHERE ingredient_id IN (60, 65, 66)
   OR form_id = 189
   OR sub_ingredient_id IN (60, 65, 66);

DELETE FROM ingredient_synonyms
WHERE ingredient_id IN (60, 65, 66);

DELETE FROM ingredient_forms
WHERE id = 189
   OR ingredient_id IN (60, 65, 66);

DELETE FROM ingredients
WHERE id IN (60, 65, 66);
