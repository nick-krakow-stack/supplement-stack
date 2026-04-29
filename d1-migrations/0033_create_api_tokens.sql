-- Migration 0033: api_tokens
-- API-Token für externe Integrationen (z.B. NotebookLM-Webhook, Studien-Import).
-- token_hash = SHA-256 hex; Klartext-Token wird nur einmal bei Generierung
-- ausgegeben und nirgends gespeichert.
-- token_prefix = erste 8 Zeichen Base64URL für Wiedererkennung in Admin-UI
--   (analog zu GitHub PATs: "tok_abc123…").
-- scopes als JSON-Array, z.B. ["recommendations:write","blog:write"].

CREATE TABLE IF NOT EXISTS api_tokens (
  id                   INTEGER PRIMARY KEY AUTOINCREMENT,

  name                 TEXT NOT NULL,                -- User-Label, z.B. "NotebookLM Webhook"
  token_hash           TEXT NOT NULL UNIQUE,         -- SHA-256 hex
  token_prefix         TEXT NOT NULL,                -- 8 erste Zeichen Base64URL für Anzeige
  scopes               TEXT NOT NULL,                -- JSON-Array

  created_by_user_id   INTEGER REFERENCES users(id) ON DELETE CASCADE,
  last_used_at         INTEGER,
  expires_at           INTEGER,
  is_revoked           INTEGER NOT NULL DEFAULT 0,

  created_at           INTEGER NOT NULL DEFAULT (strftime('%s','now'))
);

-- UNIQUE auf token_hash deckt Lookup-Performance ab; expliziter Index für Klarheit.
CREATE INDEX IF NOT EXISTS idx_api_tokens_token_hash
  ON api_tokens (token_hash);

CREATE INDEX IF NOT EXISTS idx_api_tokens_created_by
  ON api_tokens (created_by_user_id);
