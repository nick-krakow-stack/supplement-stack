PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS ingredient_admin_task_status (
  ingredient_id INTEGER NOT NULL,
  task_key TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open',
  note TEXT,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_by_user_id INTEGER,
  PRIMARY KEY (ingredient_id, task_key),
  CHECK (task_key IN ('forms', 'dge', 'precursors', 'synonyms')),
  CHECK (status IN ('open', 'done', 'none')),
  FOREIGN KEY (ingredient_id) REFERENCES ingredients(id) ON DELETE CASCADE,
  FOREIGN KEY (updated_by_user_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_ingredient_admin_task_status_key
  ON ingredient_admin_task_status(task_key, status);

CREATE INDEX IF NOT EXISTS idx_ingredient_admin_task_status_updated
  ON ingredient_admin_task_status(updated_at);
