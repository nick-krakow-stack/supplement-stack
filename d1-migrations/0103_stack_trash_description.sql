PRAGMA foreign_keys = ON;

-- Additive preparation release: the new stack runtime can be deployed while
-- the previous runtime remains compatible during the migration/deploy window.
ALTER TABLE stacks ADD COLUMN description TEXT CHECK (description IS NULL OR length(description) <= 1000);
ALTER TABLE stacks ADD COLUMN deleted_at TEXT;
ALTER TABLE stacks ADD COLUMN delete_purge_after TEXT;
ALTER TABLE stacks ADD COLUMN version INTEGER NOT NULL DEFAULT 1;
ALTER TABLE stacks ADD COLUMN write_claim_token TEXT;

CREATE INDEX IF NOT EXISTS idx_stacks_user_active
  ON stacks(user_id, deleted_at, last_opened_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS idx_stacks_trash_purge
  ON stacks(delete_purge_after, user_id)
  WHERE deleted_at IS NOT NULL;
