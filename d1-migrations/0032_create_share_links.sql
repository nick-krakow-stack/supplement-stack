-- Migration 0032: share_links
-- Öffentliche Share-Links zu einzelnen Recommendations oder ganzen Stacks.
-- token: 128-bit Base64URL (vom Backend generiert, in der UI nie editierbar).
-- snapshot_json: kompletter Snapshot zum Zeitpunkt der Share-Erstellung —
--   Fallback falls Original inactive/superseded wird (Empfänger sieht trotzdem
--   den ursprünglich geteilten Stand). Wichtig für Vertrauen + Recht.
-- views/imports werden vom Backend hochgezählt (separate API).

CREATE TABLE IF NOT EXISTS share_links (
  id                  INTEGER PRIMARY KEY AUTOINCREMENT,

  token               TEXT NOT NULL UNIQUE,        -- 128-bit Base64URL
  entity_type         TEXT NOT NULL CHECK (entity_type IN ('dose_recommendation','stack')),
  entity_id           INTEGER NOT NULL,

  snapshot_json       TEXT NOT NULL,               -- vollständiger Snapshot
  creator_user_id     INTEGER REFERENCES users(id) ON DELETE SET NULL,

  views               INTEGER NOT NULL DEFAULT 0,
  imports             INTEGER NOT NULL DEFAULT 0,

  expires_at          INTEGER,                     -- NULL = nie
  is_revoked          INTEGER NOT NULL DEFAULT 0,

  created_at          INTEGER NOT NULL DEFAULT (strftime('%s','now'))
);

-- UNIQUE auf token deckt die Lookup-Performance bereits ab; expliziter Index
-- für Klarheit & falls UNIQUE-Index-Name in zukünftigen Queries gebraucht wird.
CREATE INDEX IF NOT EXISTS idx_share_links_token
  ON share_links (token);

CREATE INDEX IF NOT EXISTS idx_share_links_creator_created
  ON share_links (creator_user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_share_links_entity
  ON share_links (entity_type, entity_id);
