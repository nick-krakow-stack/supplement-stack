PRAGMA foreign_keys = ON;

-- Creator portfolio, moderation feedback and lifecycle controls. All additions
-- are backwards compatible with the immutable share snapshot introduced in
-- migration 0099. Snapshot JSON remains the only source for title/content.

ALTER TABLE share_links
  ADD COLUMN version INTEGER NOT NULL DEFAULT 1 CHECK (version >= 1);

ALTER TABLE share_links
  ADD COLUMN moderation_reason TEXT
  CHECK (moderation_reason IS NULL OR length(trim(moderation_reason)) BETWEEN 1 AND 1000);

ALTER TABLE share_links
  ADD COLUMN moderation_target TEXT
  CHECK (moderation_target IS NULL OR moderation_target IN ('general', 'title', 'creator_statement', 'product'));

ALTER TABLE share_links
  ADD COLUMN moderation_item_index INTEGER
  CHECK (moderation_item_index IS NULL OR moderation_item_index >= 0);

ALTER TABLE share_links
  ADD COLUMN paused_at INTEGER CHECK (paused_at IS NULL OR paused_at > 0);

ALTER TABLE share_links
  ADD COLUMN archived_at INTEGER CHECK (archived_at IS NULL OR archived_at > 0);

ALTER TABLE share_links
  ADD COLUMN supersedes_share_link_id INTEGER
  REFERENCES share_links(id) ON DELETE RESTRICT
  CHECK (supersedes_share_link_id IS NULL OR supersedes_share_link_id <> id);

-- NULL is the normal state. Postdeploy sets this marker only when a row that
-- changed during the mixed-runtime window cannot be tied to an exact admin
-- audit receipt. It is deliberately separate from is_revoked: an unknown
-- provenance must be unavailable without inventing a Creator revocation.
ALTER TABLE share_links
  ADD COLUMN legacy_provenance_status TEXT
  CHECK (legacy_provenance_status IS NULL OR legacy_provenance_status = 'ambiguous');

CREATE INDEX IF NOT EXISTS idx_share_links_creator_portfolio
  ON share_links(creator_party_id, archived_at, created_at DESC, id DESC);

CREATE INDEX IF NOT EXISTS idx_share_links_supersedes
  ON share_links(supersedes_share_link_id, id);

-- SQLite creates a zero-valued sqlite_sequence row even when an
-- INSERT ... SELECT guard selects no rows. Initialize the two guarded
-- AUTOINCREMENT targets during migration so a rejected runtime write leaves
-- sequence state byte-for-byte unchanged.
INSERT OR IGNORE INTO sqlite_sequence (name, seq)
SELECT 'share_links', COALESCE(MAX(id), 0) FROM share_links;

INSERT OR IGNORE INTO sqlite_sequence (name, seq)
SELECT 'share_import_operations', COALESCE(MAX(id), 0) FROM share_import_operations;

-- One delivery receipt per committed moderation version. It intentionally
-- stores neither an email address nor a recipient/user id. The recipient is
-- resolved transiently through share_links.creator_user_id after commit.
CREATE TABLE IF NOT EXISTS creator_share_notification_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  share_link_id INTEGER NOT NULL REFERENCES share_links(id) ON DELETE CASCADE,
  share_version INTEGER NOT NULL CHECK (share_version >= 1),
  event_type TEXT NOT NULL
    CHECK (event_type IN ('moderation_approved', 'moderation_blocked')),
  origin TEXT NOT NULL DEFAULT 'runtime'
    CHECK (origin IN ('runtime', 'legacy_activation')),
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'sending', 'sent', 'failed', 'skipped')),
  attempts INTEGER NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  claim_run_key TEXT CHECK (claim_run_key IS NULL OR length(claim_run_key) BETWEEN 1 AND 120),
  last_error TEXT CHECK (last_error IS NULL OR length(last_error) <= 120),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  sent_at TEXT,
  UNIQUE (share_link_id, share_version, event_type)
);

CREATE INDEX IF NOT EXISTS idx_creator_share_notifications_status
  ON creator_share_notification_events(origin, status, created_at, id);

-- A deploy creates an ephemeral 256-bit capability and persists only its
-- SHA-256 hash here. The raw nonce exists only in the deploy process and the
-- authenticated HTTPS request to the newly deployed runtime. This lets the
-- postdeploy workflow drain legacy events through the runtime-only SMTP
-- bindings without adding a long-lived public secret.
CREATE TABLE IF NOT EXISTS creator_share_notification_drain_runs (
  run_key TEXT PRIMARY KEY
    CHECK (length(run_key) BETWEEN 1 AND 120),
  capability_hash TEXT NOT NULL
    CHECK (length(capability_hash) = 64 AND capability_hash NOT GLOB '*[^0-9a-f]*'),
  status TEXT NOT NULL DEFAULT 'ready'
    CHECK (status IN ('ready', 'running', 'complete')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  started_at TEXT,
  completed_at TEXT
);

-- 0106 is deliberately expand-only. D1 reports trigger side effects through
-- D1Result.meta.changes, so a normalizing trigger would make the previous
-- runtime misread its successful one-row moderation update as a conflict.
-- Capture the exact pre-deploy baseline instead. The new runtime writes its
-- version and outbox row explicitly in one D1 batch; the separate postdeploy
-- migration reconciles only rows that changed against this baseline and then
-- activates strict triggers after the Pages deployment has succeeded.
CREATE TABLE IF NOT EXISTS creator_share_workflow_rollouts (
  rollout_key TEXT PRIMARY KEY CHECK (rollout_key = 'creator_portfolio_v1'),
  phase TEXT NOT NULL CHECK (phase IN ('expanded', 'active')),
  baseline_share_count INTEGER NOT NULL DEFAULT 0 CHECK (baseline_share_count >= 0),
  expanded_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  activated_at TEXT
);

INSERT OR IGNORE INTO creator_share_workflow_rollouts (rollout_key, phase)
VALUES ('creator_portfolio_v1', 'expanded');

CREATE TABLE IF NOT EXISTS creator_share_workflow_baseline (
  rollout_key TEXT NOT NULL
    REFERENCES creator_share_workflow_rollouts(rollout_key) ON DELETE CASCADE,
  share_link_id INTEGER NOT NULL,
  version INTEGER NOT NULL,
  moderation_status TEXT NOT NULL,
  is_revoked INTEGER NOT NULL,
  snapshot_hash TEXT,
  moderated_by_user_id INTEGER,
  moderated_at TEXT,
  PRIMARY KEY (rollout_key, share_link_id)
);

INSERT OR IGNORE INTO creator_share_workflow_baseline (
  rollout_key,
  share_link_id,
  version,
  moderation_status,
  is_revoked,
  snapshot_hash,
  moderated_by_user_id,
  moderated_at
)
SELECT
  'creator_portfolio_v1',
  id,
  version,
  moderation_status,
  is_revoked,
  snapshot_hash,
  moderated_by_user_id,
  moderated_at
FROM share_links;

UPDATE creator_share_workflow_rollouts
SET baseline_share_count = (
  SELECT COUNT(*)
  FROM creator_share_workflow_baseline baseline
  WHERE baseline.rollout_key = creator_share_workflow_rollouts.rollout_key
)
WHERE rollout_key = 'creator_portfolio_v1' AND phase = 'expanded';

-- The previous admin runtime always includes moderated_by_user_id and
-- moderated_at in its UPDATE. A same-status write cannot prove whether an
-- intervening Creator revoke is being cleared, so reject it during the mixed
-- runtime window. The previous Creator revoke updates only is_revoked and is
-- therefore unaffected. New-runtime moderation increments version explicitly.
CREATE TRIGGER IF NOT EXISTS trg_share_links_block_legacy_same_status_admin_write
BEFORE UPDATE OF moderated_by_user_id, moderated_at ON share_links
WHEN NEW.version IS OLD.version
  AND NEW.moderation_status IS OLD.moderation_status
BEGIN
  SELECT RAISE(ABORT, 'ambiguous legacy creator share moderation write');
END;

-- Creator revocation is terminal. This zero-side-effect guard blocks every
-- OLD=1 -> NEW=0 attempt, including an unlogged/same-second legacy admin
-- request. Postdeploy drops it only inside the activation transaction while
-- normalizing audit-proven historic admin blocks, then recreates it.
CREATE TRIGGER IF NOT EXISTS trg_share_links_prevent_unrevoke
BEFORE UPDATE OF is_revoked ON share_links
WHEN OLD.is_revoked = 1 AND NEW.is_revoked = 0
BEGIN
  SELECT RAISE(ABORT, 'creator share revocation is terminal');
END;

-- Unique visitor metrics reuse the existing consent-gated page-view source.
-- This index makes exact token-route and period reads cheap without creating a
-- second visitor identifier or exposing visitor rows to creators.
CREATE INDEX IF NOT EXISTS idx_page_view_events_path_created_visitor
  ON page_view_events(path, created_at, visitor_id);
