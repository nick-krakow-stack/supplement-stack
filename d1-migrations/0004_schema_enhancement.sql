-- Schema Enhancement: comprehensive supplement knowledge base
-- Adds dosage guidelines, form quality, enhanced interactions, ingredient categories

-- -------------------------------------------------------------------------
-- Extend ingredients table
-- -------------------------------------------------------------------------
ALTER TABLE ingredients ADD COLUMN category TEXT;
-- Values: 'vitamin_fat_soluble' | 'vitamin_water_soluble' | 'mineral' |
--         'trace_element' | 'amino_acid' | 'fatty_acid' | 'adaptogen' |
--         'enzyme_coenzyme' | 'plant_extract' | 'probiotic' | 'other'

ALTER TABLE ingredients ADD COLUMN timing TEXT;
-- General timing hint: 'morning' | 'evening' | 'with_meal' | 'fasting' |
--                      'pre_workout' | 'split' | 'flexible'

ALTER TABLE ingredients ADD COLUMN upper_limit REAL;
-- Maximum tolerable intake per day (UL) as number

ALTER TABLE ingredients ADD COLUMN upper_limit_unit TEXT;
-- Unit for upper_limit (mg, µg, g, IU)

ALTER TABLE ingredients ADD COLUMN upper_limit_note TEXT;
-- Clarification, e.g. "only as supplement, not from food"

-- -------------------------------------------------------------------------
-- Extend ingredient_forms table
-- -------------------------------------------------------------------------
ALTER TABLE ingredient_forms ADD COLUMN bioavailability TEXT;
-- 'very_high' | 'high' | 'medium' | 'low' | 'very_low'

ALTER TABLE ingredient_forms ADD COLUMN timing TEXT;
-- Override for this specific form (e.g., Mg Bisglycinat → 'evening')

ALTER TABLE ingredient_forms ADD COLUMN is_recommended INTEGER NOT NULL DEFAULT 0;
-- 1 = recommended form, 0 = acceptable, -1 = not recommended

-- -------------------------------------------------------------------------
-- New table: dosage_guidelines
-- Per ingredient, per source (DGE / EFSA / NIH / study / practice)
-- -------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS dosage_guidelines (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  ingredient_id    INTEGER NOT NULL,
  source           TEXT    NOT NULL,
  -- 'DGE' | 'EFSA' | 'NIH' | 'study' | 'practice'
  source_url       TEXT,
  source_title     TEXT,
  population       TEXT    NOT NULL DEFAULT 'adult',
  -- 'adult' | 'adult_male' | 'adult_female' | 'elderly' | 'child' |
  -- 'pregnant' | 'athlete' | 'deficient'
  dose_min         REAL,
  dose_max         REAL,
  unit             TEXT,
  frequency        TEXT    DEFAULT 'daily',
  -- 'daily' | 'weekly' | 'as_needed'
  timing           TEXT,
  -- 'morning' | 'evening' | 'with_meal' | 'fasting' | 'split' | 'pre_workout'
  notes            TEXT,
  is_default       INTEGER NOT NULL DEFAULT 0,
  -- 1 = shown first as the default recommendation
  created_at       TEXT    DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (ingredient_id) REFERENCES ingredients(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_dosage_ingredient_id ON dosage_guidelines(ingredient_id);
CREATE INDEX IF NOT EXISTS idx_dosage_source ON dosage_guidelines(source);
CREATE INDEX IF NOT EXISTS idx_dosage_population ON dosage_guidelines(population);

-- -------------------------------------------------------------------------
-- Extend interactions table
-- -------------------------------------------------------------------------
ALTER TABLE interactions ADD COLUMN severity TEXT DEFAULT 'medium';
-- 'low' | 'medium' | 'high'

ALTER TABLE interactions ADD COLUMN mechanism TEXT;
-- Explanation of why the interaction exists

ALTER TABLE interactions ADD COLUMN source_url TEXT;
-- Optional study or source link
