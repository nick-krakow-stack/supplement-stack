PRAGMA foreign_keys = ON;

-- Optimistic concurrency for user edits. Existing rows are backfilled to 1 by
-- SQLite's constant DEFAULT when the column is added.
ALTER TABLE user_products ADD COLUMN version INTEGER NOT NULL DEFAULT 1
  CHECK (version >= 1);

-- Internal one-shot marker that binds child replacements to the exact winning
-- compare-and-swap inside the same D1 batch. It is never exposed by the API.
ALTER TABLE user_products ADD COLUMN write_claim_token TEXT;

-- User-facing moderation context. The canonical moderation status remains in
-- user_products.status; this column only carries an optional explanation.
ALTER TABLE user_products ADD COLUMN review_note TEXT
  CHECK (review_note IS NULL OR length(review_note) <= 500);

-- Append-only history for the two user-facing states. Internal moderation
-- values are retained for auditability, while the UI only exposes
-- "Privat"/"Öffentlich".
CREATE TABLE IF NOT EXISTS user_product_status_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_product_id INTEGER NOT NULL,
  moderation_status TEXT NOT NULL,
  visibility TEXT NOT NULL CHECK (visibility IN ('private', 'public')),
  note TEXT CHECK (note IS NULL OR length(note) <= 500),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (user_product_id) REFERENCES user_products(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_user_product_status_history_product_created
  ON user_product_status_history(user_product_id, created_at DESC, id DESC);

INSERT INTO user_product_status_history (
  user_product_id,
  moderation_status,
  visibility,
  note,
  created_at
)
SELECT
  product.id,
  product.status,
  CASE WHEN product.published_product_id IS NOT NULL THEN 'public' ELSE 'private' END,
  product.review_note,
  COALESCE(product.published_at, product.approved_at, product.created_at, datetime('now'))
FROM user_products product
WHERE NOT EXISTS (
  SELECT 1
  FROM user_product_status_history history
  WHERE history.user_product_id = product.id
);

CREATE TRIGGER IF NOT EXISTS trg_user_product_status_history_insert
AFTER INSERT ON user_products
BEGIN
  INSERT INTO user_product_status_history (
    user_product_id,
    moderation_status,
    visibility,
    note
  ) VALUES (
    NEW.id,
    NEW.status,
    CASE WHEN NEW.published_product_id IS NOT NULL THEN 'public' ELSE 'private' END,
    NEW.review_note
  );
END;

CREATE TRIGGER IF NOT EXISTS trg_user_product_status_history_update
AFTER UPDATE OF status, published_product_id, review_note ON user_products
WHEN OLD.status IS NOT NEW.status
  OR OLD.published_product_id IS NOT NEW.published_product_id
  OR OLD.review_note IS NOT NEW.review_note
BEGIN
  INSERT INTO user_product_status_history (
    user_product_id,
    moderation_status,
    visibility,
    note
  ) VALUES (
    NEW.id,
    NEW.status,
    CASE WHEN NEW.published_product_id IS NOT NULL THEN 'public' ELSE 'private' END,
    NEW.review_note
  );
END;

CREATE TRIGGER IF NOT EXISTS trg_user_product_status_history_no_update
BEFORE UPDATE ON user_product_status_history
BEGIN
  SELECT RAISE(ABORT, 'User-Produkt-Statusverlauf ist unveränderlich.');
END;

-- Direct history deletion is blocked while the owning product still exists.
-- A deliberate product/account deletion remains possible: during the
-- FK-CASCADE the parent row no longer exists, so its dependent history can be
-- removed with it instead of retaining personal data.
CREATE TRIGGER IF NOT EXISTS trg_user_product_status_history_no_direct_delete
BEFORE DELETE ON user_product_status_history
WHEN EXISTS (
  SELECT 1 FROM user_products product WHERE product.id = OLD.user_product_id
)
BEGIN
  SELECT RAISE(ABORT, 'User-Produkt-Statusverlauf kann nicht einzeln gelöscht werden.');
END;
