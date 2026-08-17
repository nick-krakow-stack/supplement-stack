PRAGMA foreign_keys = ON;

-- A Creator image is public only after an administrator explicitly stores it
-- on the canonical party record. NULL remains the default and renders nothing.
ALTER TABLE parties
  ADD COLUMN public_profile_image_url TEXT
  CHECK (
    public_profile_image_url IS NULL
    OR length(trim(public_profile_image_url)) BETWEEN 1 AND 500
  );

-- Public reports retain only the selected reason and the optional short note.
-- No IP address, user agent or inferred reporter profile is persisted.
CREATE TABLE creator_share_reports (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  share_link_id INTEGER NOT NULL REFERENCES share_links(id) ON DELETE RESTRICT,
  idempotency_key TEXT NOT NULL UNIQUE
    CHECK (length(idempotency_key) BETWEEN 16 AND 120),
  category TEXT NOT NULL
    CHECK (category IN ('outdated', 'misleading', 'safety', 'other')),
  details TEXT CHECK (details IS NULL OR length(details) BETWEEN 1 AND 500),
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'reviewed', 'resolved', 'dismissed')),
  version INTEGER NOT NULL DEFAULT 1 CHECK (version >= 1),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  reviewed_by_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  reviewed_at TEXT,
  resolution_note TEXT
    CHECK (resolution_note IS NULL OR length(resolution_note) BETWEEN 1 AND 1000)
);

CREATE INDEX idx_creator_share_reports_queue
  ON creator_share_reports(status, created_at, id);
CREATE INDEX idx_creator_share_reports_share
  ON creator_share_reports(share_link_id, created_at DESC, id DESC);

-- Undo is intentionally limited to the guarded replacement operation. The
-- before/after payloads bind every mutable stack-item field and its link
-- binding, while the opaque public token is stored only as a SHA-256 hash.
CREATE TABLE creator_share_import_undos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  operation_id INTEGER NOT NULL UNIQUE
    REFERENCES share_import_operations(id) ON DELETE CASCADE,
  undo_token_hash TEXT NOT NULL UNIQUE
    CHECK (length(undo_token_hash) = 64),
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  target_stack_id INTEGER NOT NULL REFERENCES stacks(id) ON DELETE CASCADE,
  stack_item_id INTEGER NOT NULL,
  action TEXT NOT NULL CHECK (action = 'replaced'),
  previous_item_json TEXT NOT NULL CHECK (json_valid(previous_item_json)),
  previous_binding_json TEXT CHECK (
    previous_binding_json IS NULL OR json_valid(previous_binding_json)
  ),
  expected_item_json TEXT NOT NULL CHECK (json_valid(expected_item_json)),
  expected_binding_json TEXT NOT NULL CHECK (json_valid(expected_binding_json)),
  summary TEXT NOT NULL CHECK (length(trim(summary)) BETWEEN 1 AND 500),
  expires_at INTEGER NOT NULL,
  undone_at TEXT,
  write_claim_token TEXT CHECK (
    write_claim_token IS NULL OR length(write_claim_token) BETWEEN 16 AND 120
  ),
  version INTEGER NOT NULL DEFAULT 1 CHECK (version >= 1),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_creator_share_import_undos_user
  ON creator_share_import_undos(user_id, expires_at DESC, id DESC);
