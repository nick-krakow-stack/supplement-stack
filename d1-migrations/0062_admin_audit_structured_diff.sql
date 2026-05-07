PRAGMA foreign_keys = ON;

ALTER TABLE admin_audit_log ADD COLUMN before_json TEXT;
ALTER TABLE admin_audit_log ADD COLUMN after_json TEXT;
