PRAGMA foreign_keys = ON;

-- Data minimization: stop retaining profile attributes that are no longer
-- collected or returned by the account/profile API. Columns stay in place for
-- schema compatibility with older migrations and previews.
UPDATE users
SET
  gender = NULL,
  weight = NULL,
  diet_type = NULL,
  personal_goals = NULL;

-- users.is_smoker was added as NOT NULL in migration 0009, so existing D1
-- schemas cannot store NULL without a risky users-table rebuild. Resetting all
-- values removes previously collected smoker-status signals while preserving
-- the compatible schema.
UPDATE users
SET is_smoker = 0;
