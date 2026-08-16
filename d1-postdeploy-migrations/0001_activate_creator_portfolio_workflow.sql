PRAGMA foreign_keys = ON;

-- This migration runs only after the new Pages runtime is live. It is kept in
-- a separate Wrangler migration directory/table so the predeploy migration
-- command cannot activate strict writes while the previous runtime is serving.

CREATE TABLE IF NOT EXISTS creator_share_workflow_activation_checks (
  check_key TEXT PRIMARY KEY,
  passed INTEGER NOT NULL CHECK (passed = 1),
  checked_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Fail closed if the expand phase or its immutable baseline is absent or
-- incomplete. Re-running an already active migration remains valid.
INSERT OR REPLACE INTO creator_share_workflow_activation_checks (
  check_key,
  passed,
  checked_at
)
VALUES (
  'creator_portfolio_v1_expand_ready',
  COALESCE((
    SELECT CASE
      WHEN rollout.phase IN ('expanded', 'active')
       AND rollout.baseline_share_count = (
         SELECT COUNT(*)
         FROM creator_share_workflow_baseline baseline
         WHERE baseline.rollout_key = rollout.rollout_key
       )
      THEN 1 ELSE 0
    END
    FROM creator_share_workflow_rollouts rollout
    WHERE rollout.rollout_key = 'creator_portfolio_v1'
  ), 0),
  CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS creator_share_workflow_legacy_transitions (
  rollout_key TEXT NOT NULL
    REFERENCES creator_share_workflow_rollouts(rollout_key) ON DELETE CASCADE,
  share_link_id INTEGER NOT NULL REFERENCES share_links(id) ON DELETE CASCADE,
  expected_version INTEGER NOT NULL,
  expected_snapshot_hash TEXT,
  expected_moderation_status TEXT NOT NULL,
  expected_is_revoked INTEGER NOT NULL,
  expected_moderation_reason TEXT,
  expected_moderation_target TEXT,
  expected_moderation_item_index INTEGER,
  expected_moderated_by_user_id INTEGER,
  expected_moderated_at TEXT,
  provenance_audit_log_id INTEGER NOT NULL
    REFERENCES admin_audit_log(id) ON DELETE RESTRICT,
  notify_creator INTEGER NOT NULL CHECK (notify_creator IN (0, 1)),
  detected_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (rollout_key, share_link_id)
);

CREATE TABLE IF NOT EXISTS creator_share_workflow_legacy_ambiguous (
  rollout_key TEXT NOT NULL
    REFERENCES creator_share_workflow_rollouts(rollout_key) ON DELETE CASCADE,
  share_link_id INTEGER NOT NULL REFERENCES share_links(id) ON DELETE CASCADE,
  expected_version INTEGER NOT NULL,
  expected_snapshot_hash TEXT,
  expected_moderation_status TEXT NOT NULL,
  expected_is_revoked INTEGER NOT NULL,
  expected_moderation_reason TEXT,
  expected_moderation_target TEXT,
  expected_moderation_item_index INTEGER,
  expected_moderated_by_user_id INTEGER,
  expected_moderated_at TEXT,
  detected_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (rollout_key, share_link_id)
);

-- A legacy moderation is normalized only when an original admin audit receipt
-- proves the exact same request, actor, share, second and pending -> decision
-- transition. Requiring expected_status=pending is material: a later admin
-- block of a Creator-revoked approval is not evidence that the Creator never
-- revoked it. approved+revoked is therefore never eligible. A historic
-- blocked+revoked row is eligible only when this same proof shows that the old
-- admin request itself set both fields from pending.
INSERT OR IGNORE INTO creator_share_workflow_legacy_transitions (
  rollout_key,
  share_link_id,
  expected_version,
  expected_snapshot_hash,
  expected_moderation_status,
  expected_is_revoked,
  expected_moderation_reason,
  expected_moderation_target,
  expected_moderation_item_index,
  expected_moderated_by_user_id,
  expected_moderated_at,
  provenance_audit_log_id,
  notify_creator
)
SELECT
  rollout.rollout_key,
  share.id,
  share.version,
  share.snapshot_hash,
  share.moderation_status,
  share.is_revoked,
  share.moderation_reason,
  share.moderation_target,
  share.moderation_item_index,
  share.moderated_by_user_id,
  share.moderated_at,
  audit.id,
  CASE WHEN baseline.share_link_id IS NULL OR baseline.moderation_status = 'pending'
    THEN 1 ELSE 0 END
FROM creator_share_workflow_rollouts rollout
JOIN share_links share
LEFT JOIN creator_share_workflow_baseline baseline
  ON baseline.rollout_key = rollout.rollout_key
 AND baseline.share_link_id = share.id
JOIN admin_audit_log audit ON audit.id = (
  SELECT candidate.id
  FROM admin_audit_log candidate
  WHERE candidate.action = 'moderate_creator_share'
    AND candidate.entity_type = 'share_link'
    AND candidate.entity_id = share.id
    AND candidate.user_id IS share.moderated_by_user_id
    AND candidate.created_at = CAST(strftime('%s', share.moderated_at) AS INTEGER)
    AND json_valid(candidate.changes) = 1
    AND json_extract(candidate.changes, '$.expected_status') = 'pending'
    AND json_extract(candidate.changes, '$.moderation_status') = share.moderation_status
    AND (
      (
        share.is_revoked = 1
        AND json_extract(candidate.changes, '$.is_revoked') = 1
      )
      OR (
        share.is_revoked = 0
        AND (
          json_extract(candidate.changes, '$.is_revoked') = 0
          OR json_type(candidate.changes, '$.is_revoked') = 'null'
        )
      )
    )
  ORDER BY candidate.id DESC
  LIMIT 1
)
WHERE rollout.rollout_key = 'creator_portfolio_v1'
  AND rollout.phase = 'expanded'
  AND share.version = 1
  AND share.moderation_status IN ('approved', 'blocked')
  AND NOT (share.moderation_status = 'approved' AND share.is_revoked = 1)
  AND share.moderated_by_user_id IS NOT NULL
  AND share.moderated_at IS NOT NULL
  AND (
    baseline.share_link_id IS NULL
    OR (
      baseline.version = 1
      AND baseline.moderation_status = 'pending'
      AND baseline.is_revoked = 0
      AND baseline.snapshot_hash IS share.snapshot_hash
      AND baseline.moderation_status IS NOT share.moderation_status
    )
    OR (
      baseline.version = share.version
      AND baseline.moderation_status = 'blocked'
      AND baseline.is_revoked = 1
      AND baseline.snapshot_hash IS share.snapshot_hash
      AND baseline.moderated_by_user_id IS share.moderated_by_user_id
      AND baseline.moderated_at IS share.moderated_at
      AND share.moderation_status = 'blocked'
      AND share.is_revoked = 1
    )
  );

-- Every mixed-runtime decision without that exact receipt is quarantined. The
-- Share fields remain truthful (in particular is_revoked is never invented or
-- cleared); runtime reads use this explicit marker to return 410.
INSERT OR IGNORE INTO creator_share_workflow_legacy_ambiguous (
  rollout_key,
  share_link_id,
  expected_version,
  expected_snapshot_hash,
  expected_moderation_status,
  expected_is_revoked,
  expected_moderation_reason,
  expected_moderation_target,
  expected_moderation_item_index,
  expected_moderated_by_user_id,
  expected_moderated_at
)
SELECT
  rollout.rollout_key,
  share.id,
  share.version,
  share.snapshot_hash,
  share.moderation_status,
  share.is_revoked,
  share.moderation_reason,
  share.moderation_target,
  share.moderation_item_index,
  share.moderated_by_user_id,
  share.moderated_at
FROM creator_share_workflow_rollouts rollout
JOIN share_links share
LEFT JOIN creator_share_workflow_baseline baseline
  ON baseline.rollout_key = rollout.rollout_key
 AND baseline.share_link_id = share.id
WHERE rollout.rollout_key = 'creator_portfolio_v1'
  AND rollout.phase = 'expanded'
  AND share.version = 1
  AND share.moderation_status IN ('approved', 'blocked')
  AND share.moderated_by_user_id IS NOT NULL
  AND share.moderated_at IS NOT NULL
  AND (
    baseline.share_link_id IS NULL
    OR (
      baseline.version = 1
      AND baseline.moderation_status = 'pending'
      AND baseline.is_revoked = 0
      AND baseline.snapshot_hash IS share.snapshot_hash
      AND baseline.moderation_status IS NOT share.moderation_status
    )
    OR (
      baseline.version = share.version
      AND baseline.moderation_status = 'blocked'
      AND baseline.is_revoked = 1
      AND baseline.snapshot_hash IS share.snapshot_hash
      AND baseline.moderated_by_user_id IS share.moderated_by_user_id
      AND baseline.moderated_at IS share.moderated_at
      AND share.moderation_status = 'blocked'
      AND share.is_revoked = 1
    )
    OR (
      baseline.version = share.version
      AND baseline.snapshot_hash IS share.snapshot_hash
      AND (
        baseline.moderation_status IS NOT share.moderation_status
        OR baseline.is_revoked IS NOT share.is_revoked
        OR baseline.moderated_by_user_id IS NOT share.moderated_by_user_id
        OR baseline.moderated_at IS NOT share.moderated_at
      )
    )
  )
  AND NOT EXISTS (
    SELECT 1
    FROM creator_share_workflow_legacy_transitions transition
    WHERE transition.rollout_key = rollout.rollout_key
      AND transition.share_link_id = share.id
  );

UPDATE share_links
SET version = version + 1,
  legacy_provenance_status = 'ambiguous'
WHERE EXISTS (
  SELECT 1
  FROM creator_share_workflow_legacy_ambiguous ambiguous
  WHERE ambiguous.rollout_key = 'creator_portfolio_v1'
    AND ambiguous.share_link_id = share_links.id
    AND ambiguous.expected_version = share_links.version
    AND ambiguous.expected_snapshot_hash IS share_links.snapshot_hash
    AND ambiguous.expected_moderation_status = share_links.moderation_status
    AND ambiguous.expected_is_revoked = share_links.is_revoked
    AND ambiguous.expected_moderation_reason IS share_links.moderation_reason
    AND ambiguous.expected_moderation_target IS share_links.moderation_target
    AND ambiguous.expected_moderation_item_index IS share_links.moderation_item_index
    AND ambiguous.expected_moderated_by_user_id IS share_links.moderated_by_user_id
    AND ambiguous.expected_moderated_at IS share_links.moderated_at
    AND share_links.legacy_provenance_status IS NULL
);

INSERT OR REPLACE INTO creator_share_workflow_activation_checks (
  check_key,
  passed,
  checked_at
)
VALUES (
  'creator_portfolio_v1_ambiguous_rows_quarantined',
  CASE WHEN NOT EXISTS (
    SELECT 1
    FROM creator_share_workflow_legacy_ambiguous ambiguous
    LEFT JOIN share_links share ON share.id = ambiguous.share_link_id
    WHERE ambiguous.rollout_key = 'creator_portfolio_v1'
      AND (
        share.id IS NULL
        OR share.version IS NOT ambiguous.expected_version + 1
        OR share.moderation_status IS NOT ambiguous.expected_moderation_status
        OR share.is_revoked IS NOT ambiguous.expected_is_revoked
        OR share.legacy_provenance_status IS NOT 'ambiguous'
      )
  ) THEN 1 ELSE 0 END,
  CURRENT_TIMESTAMP
);

-- Normalize each candidate only while every captured value is still exact.
-- Legacy blocked feedback deliberately remains nullable; no reason is invented.
-- Expand keeps every Creator revoke terminal. Activation drops this guard only
-- within this migration transaction so an audit-proven historic admin block can
-- be normalized, then restores it immediately before any external write can run.
DROP TRIGGER IF EXISTS trg_share_links_prevent_unrevoke;

UPDATE share_links
SET version = version + 1,
  is_revoked = 0,
  legacy_provenance_status = NULL,
  moderation_reason = CASE
    WHEN moderation_status = 'approved' THEN NULL
    ELSE moderation_reason
  END,
  moderation_target = CASE
    WHEN moderation_status = 'approved' THEN NULL
    ELSE moderation_target
  END,
  moderation_item_index = CASE
    WHEN moderation_status = 'approved' THEN NULL
    ELSE moderation_item_index
  END
WHERE EXISTS (
  SELECT 1
  FROM creator_share_workflow_legacy_transitions transition
  WHERE transition.rollout_key = 'creator_portfolio_v1'
    AND transition.share_link_id = share_links.id
    AND transition.expected_version = share_links.version
    AND transition.expected_snapshot_hash IS share_links.snapshot_hash
    AND transition.expected_moderation_status = share_links.moderation_status
    AND transition.expected_is_revoked = share_links.is_revoked
    AND transition.expected_moderation_reason IS share_links.moderation_reason
    AND transition.expected_moderation_target IS share_links.moderation_target
    AND transition.expected_moderation_item_index IS share_links.moderation_item_index
    AND transition.expected_moderated_by_user_id IS share_links.moderated_by_user_id
    AND transition.expected_moderated_at IS share_links.moderated_at
    AND share_links.legacy_provenance_status IS NULL
);

CREATE TRIGGER IF NOT EXISTS trg_share_links_prevent_unrevoke
BEFORE UPDATE OF is_revoked ON share_links
WHEN OLD.is_revoked = 1 AND NEW.is_revoked = 0
BEGIN
  SELECT RAISE(ABORT, 'creator share revocation is terminal');
END;

INSERT OR REPLACE INTO creator_share_workflow_activation_checks (
  check_key,
  passed,
  checked_at
)
VALUES (
  'creator_portfolio_v1_legacy_rows_normalized',
  CASE WHEN NOT EXISTS (
    SELECT 1
    FROM creator_share_workflow_legacy_transitions transition
    LEFT JOIN share_links share ON share.id = transition.share_link_id
    WHERE transition.rollout_key = 'creator_portfolio_v1'
      AND (
        share.id IS NULL
        OR share.version IS NOT transition.expected_version + 1
        OR share.moderation_status IS NOT transition.expected_moderation_status
        OR share.is_revoked IS NOT 0
        OR share.legacy_provenance_status IS NOT NULL
        OR (
          share.moderation_status = 'approved'
          AND (
            share.moderation_reason IS NOT NULL
            OR share.moderation_target IS NOT NULL
            OR share.moderation_item_index IS NOT NULL
          )
        )
      )
  ) THEN 1 ELSE 0 END,
  CURRENT_TIMESTAMP
);

INSERT OR IGNORE INTO creator_share_notification_events (
  share_link_id,
  share_version,
  event_type,
  origin,
  status,
  attempts
)
SELECT
  transition.share_link_id,
  transition.expected_version + 1,
  CASE transition.expected_moderation_status
    WHEN 'approved' THEN 'moderation_approved'
    ELSE 'moderation_blocked'
  END,
  'legacy_activation',
  'pending',
  0
FROM creator_share_workflow_legacy_transitions transition
JOIN share_links share ON share.id = transition.share_link_id
WHERE transition.rollout_key = 'creator_portfolio_v1'
  AND transition.notify_creator = 1
  AND share.version = transition.expected_version + 1
  AND share.moderation_status = transition.expected_moderation_status
  AND share.is_revoked = 0;

INSERT OR REPLACE INTO creator_share_workflow_activation_checks (
  check_key,
  passed,
  checked_at
)
VALUES (
  'creator_portfolio_v1_outbox_complete',
  CASE WHEN NOT EXISTS (
    SELECT 1
    FROM creator_share_workflow_legacy_transitions transition
    LEFT JOIN creator_share_notification_events event
      ON event.share_link_id = transition.share_link_id
     AND event.share_version = transition.expected_version + 1
     AND event.event_type = CASE transition.expected_moderation_status
       WHEN 'approved' THEN 'moderation_approved'
       ELSE 'moderation_blocked'
     END
    WHERE transition.rollout_key = 'creator_portfolio_v1'
      AND transition.notify_creator = 1
      AND event.id IS NULL
  ) THEN 1 ELSE 0 END,
  CURRENT_TIMESTAMP
);

CREATE TRIGGER IF NOT EXISTS trg_share_links_require_versioned_moderation
BEFORE UPDATE OF moderation_status ON share_links
WHEN NEW.moderation_status IS NOT OLD.moderation_status
  AND NEW.version IS NOT OLD.version + 1
BEGIN
  SELECT RAISE(ABORT, 'creator share moderation requires an exact version increment');
END;

CREATE TRIGGER IF NOT EXISTS trg_share_links_moderation_shape_insert
BEFORE INSERT ON share_links
WHEN (
  NEW.moderation_status = 'blocked'
  AND (
    NEW.moderation_reason IS NULL
    OR length(trim(NEW.moderation_reason)) NOT BETWEEN 1 AND 1000
    OR NEW.moderation_target IS NULL
    OR NEW.moderation_target NOT IN ('general', 'title', 'creator_statement', 'product')
    OR (
      NEW.moderation_target IN ('creator_statement', 'product')
      AND (
        NEW.moderation_item_index IS NULL
        OR NEW.moderation_item_index >= COALESCE(json_array_length(NEW.snapshot_json, '$.items'), 0)
      )
    )
    OR (NEW.moderation_target IN ('general', 'title') AND NEW.moderation_item_index IS NOT NULL)
  )
)
OR (
  NEW.moderation_status <> 'blocked'
  AND (
    NEW.moderation_reason IS NOT NULL
    OR NEW.moderation_target IS NOT NULL
    OR NEW.moderation_item_index IS NOT NULL
  )
)
BEGIN
  SELECT RAISE(ABORT, 'invalid creator share moderation feedback');
END;

CREATE TRIGGER IF NOT EXISTS trg_share_links_moderation_shape_update
BEFORE UPDATE OF moderation_status, moderation_reason, moderation_target, moderation_item_index
ON share_links
WHEN (
  NEW.version IS NOT OLD.version
  OR NEW.moderation_reason IS NOT OLD.moderation_reason
  OR NEW.moderation_target IS NOT OLD.moderation_target
  OR NEW.moderation_item_index IS NOT OLD.moderation_item_index
)
AND (
  (
    NEW.moderation_status = 'blocked'
    AND (
      NEW.moderation_reason IS NULL
      OR length(trim(NEW.moderation_reason)) NOT BETWEEN 1 AND 1000
      OR NEW.moderation_target IS NULL
      OR NEW.moderation_target NOT IN ('general', 'title', 'creator_statement', 'product')
      OR (
        NEW.moderation_target IN ('creator_statement', 'product')
        AND (
          NEW.moderation_item_index IS NULL
          OR NEW.moderation_item_index >= COALESCE(json_array_length(NEW.snapshot_json, '$.items'), 0)
        )
      )
      OR (NEW.moderation_target IN ('general', 'title') AND NEW.moderation_item_index IS NOT NULL)
    )
  )
  OR (
    NEW.moderation_status <> 'blocked'
    AND (
      NEW.moderation_reason IS NOT NULL
      OR NEW.moderation_target IS NOT NULL
      OR NEW.moderation_item_index IS NOT NULL
    )
  )
)
BEGIN
  SELECT RAISE(ABORT, 'invalid creator share moderation feedback');
END;

UPDATE creator_share_workflow_rollouts
SET phase = 'active',
  activated_at = COALESCE(activated_at, CURRENT_TIMESTAMP)
WHERE rollout_key = 'creator_portfolio_v1'
  AND phase IN ('expanded', 'active');

INSERT OR REPLACE INTO creator_share_workflow_activation_checks (
  check_key,
  passed,
  checked_at
)
VALUES (
  'creator_portfolio_v1_active',
  COALESCE((
    SELECT CASE
      WHEN phase = 'active' AND activated_at IS NOT NULL THEN 1 ELSE 0
    END
    FROM creator_share_workflow_rollouts
    WHERE rollout_key = 'creator_portfolio_v1'
  ), 0),
  CURRENT_TIMESTAMP
);
