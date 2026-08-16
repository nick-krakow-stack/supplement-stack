PRAGMA foreign_keys = OFF;

-- Family profiles are retired for privacy reasons. Production was verified to
-- contain neither profiles nor linked stacks before this migration was added.
-- Fail closed if that invariant changes instead of deleting personal data.
CREATE TABLE family_profile_retirement_guard_0105 (
  ok INTEGER NOT NULL CHECK (ok = 1)
);

INSERT INTO family_profile_retirement_guard_0105 (ok)
SELECT CASE WHEN
  NOT EXISTS (SELECT 1 FROM family_profiles)
  AND NOT EXISTS (SELECT 1 FROM stacks WHERE family_member_id IS NOT NULL)
THEN 1 ELSE 0 END;

DROP INDEX IF EXISTS idx_stacks_family_member_id;
ALTER TABLE stacks DROP COLUMN family_member_id;
DROP TABLE family_profiles;
DROP TABLE family_profile_retirement_guard_0105;

PRAGMA foreign_keys = ON;
