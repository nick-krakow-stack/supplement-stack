-- Migration 0029: admin_audit_log
-- Vollständiger Audit-Trail aller Admin-/System-Aktionen mit Bezug zu
-- Empfehlungen, Profilen, Blog-Posts, Usern, Interactions und Share-Links.
-- changes enthält JSON-Diff (vorher/nachher) — Backend serialisiert.
-- user_id NULL bei System-Aktionen (z.B. automatische review_due-Reminder).

CREATE TABLE IF NOT EXISTS admin_audit_log (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,

  user_id      INTEGER,                            -- NULL = System-Aktion
  action       TEXT NOT NULL,                       -- z.B. 'create_recommendation','update_recommendation',
                                                    --      'toggle_active','delete_recommendation','revoke_consent'
  entity_type  TEXT NOT NULL,                       -- 'recommendation','verified_profile','blog_post',
                                                    -- 'user','interaction','share_link'
  entity_id    INTEGER,

  changes      TEXT,                                -- JSON-Diff
  reason       TEXT,                                -- Freitext-Begründung
  ip_address   TEXT,
  user_agent   TEXT,

  created_at   INTEGER NOT NULL DEFAULT (strftime('%s','now'))
);

CREATE INDEX IF NOT EXISTS idx_admin_audit_log_user_created
  ON admin_audit_log (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_admin_audit_log_entity
  ON admin_audit_log (entity_type, entity_id);

CREATE INDEX IF NOT EXISTS idx_admin_audit_log_action_created
  ON admin_audit_log (action, created_at DESC);
