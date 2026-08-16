-- D1 executes a migration in an implicit transaction. foreign_keys cannot be
-- disabled there, so defer checks while the parent table is rebuilt.
PRAGMA defer_foreign_keys = ON;

-- The preceding release no longer reads or writes categories. Create a
-- temporary, exact migration snapshot so the destructive step fails closed.
-- The durable rollback snapshot is exported and verified before this release;
-- these tables are removed below so retired user/category data is not kept.
CREATE TABLE stack_category_archive_0104 (
  category_id INTEGER PRIMARY KEY,
  stack_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  name_normalized TEXT NOT NULL,
  sort_order INTEGER NOT NULL,
  is_default INTEGER NOT NULL,
  created_at TEXT,
  updated_at TEXT,
  archived_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE stack_item_category_archive_0104 (
  stack_item_id INTEGER PRIMARY KEY,
  stack_id INTEGER NOT NULL,
  category_id INTEGER NOT NULL,
  archived_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- DROP TABLE stack_items executes ON DELETE CASCADE for this child table even
-- while FK checks are deferred. Preserve every binding column and primary key
-- before the rebuild, then restore and verify them below.
CREATE TABLE stack_item_link_binding_archive_0104 (
  stack_item_id INTEGER PRIMARY KEY,
  shop_link_id INTEGER NOT NULL,
  resolution_kind TEXT NOT NULL,
  affiliate_version_id INTEGER,
  resolved_party_id INTEGER,
  bound_at TEXT NOT NULL
);

INSERT INTO stack_category_archive_0104 (
  category_id, stack_id, name, name_normalized, sort_order, is_default,
  created_at, updated_at
)
SELECT id, stack_id, name, name_normalized, sort_order, is_default,
       created_at, updated_at
FROM stack_categories;

INSERT INTO stack_item_category_archive_0104 (
  stack_item_id, stack_id, category_id
)
SELECT id, stack_id, category_id
FROM stack_items
WHERE category_id IS NOT NULL;

INSERT INTO stack_item_link_binding_archive_0104 (
  stack_item_id, shop_link_id, resolution_kind, affiliate_version_id,
  resolved_party_id, bound_at
)
SELECT
  stack_item_id, shop_link_id, resolution_kind, affiliate_version_id,
  resolved_party_id, bound_at
FROM stack_item_link_bindings;

CREATE TABLE stack_category_migration_guard_0104 (
  ok INTEGER NOT NULL CHECK (ok = 1)
);

INSERT INTO stack_category_migration_guard_0104 (ok)
SELECT CASE WHEN
  (SELECT COUNT(*) FROM stack_category_archive_0104) =
    (SELECT COUNT(*) FROM stack_categories)
  AND
  (SELECT COUNT(*) FROM stack_item_category_archive_0104) =
    (SELECT COUNT(*) FROM stack_items WHERE category_id IS NOT NULL)
  AND NOT EXISTS (
    SELECT 1
    FROM stack_item_category_archive_0104 assignment
    JOIN stack_category_archive_0104 category
      ON category.category_id = assignment.category_id
    WHERE category.stack_id <> assignment.stack_id
  )
  AND
  (SELECT COUNT(*) FROM stack_item_link_binding_archive_0104) =
    (SELECT COUNT(*) FROM stack_item_link_bindings)
  AND NOT EXISTS (
    SELECT 1
    FROM stack_item_link_bindings original
    LEFT JOIN stack_item_link_binding_archive_0104 archived
      ON archived.stack_item_id = original.stack_item_id
    WHERE archived.stack_item_id IS NULL
      OR typeof(archived.shop_link_id) <> typeof(original.shop_link_id)
      OR archived.shop_link_id IS NOT original.shop_link_id
      OR typeof(archived.resolution_kind) <> typeof(original.resolution_kind)
      OR archived.resolution_kind IS NOT original.resolution_kind
      OR typeof(archived.affiliate_version_id) <> typeof(original.affiliate_version_id)
      OR archived.affiliate_version_id IS NOT original.affiliate_version_id
      OR typeof(archived.resolved_party_id) <> typeof(original.resolved_party_id)
      OR archived.resolved_party_id IS NOT original.resolved_party_id
      OR typeof(archived.bound_at) <> typeof(original.bound_at)
      OR archived.bound_at IS NOT original.bound_at
  )
THEN 1 ELSE 0 END;

CREATE TABLE stack_items_0104 (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  stack_id INTEGER NOT NULL,
  catalog_product_id INTEGER,
  user_product_id INTEGER,
  quantity INTEGER NOT NULL DEFAULT 1,
  dosage_text TEXT,
  timing TEXT,
  intake_interval_days INTEGER NOT NULL DEFAULT 1 CHECK (intake_interval_days >= 1),
  sort_order INTEGER NOT NULL DEFAULT 0,
  source_share_link_id INTEGER REFERENCES share_links(id) ON DELETE SET NULL,
  creator_statement_snapshot TEXT,
  amount_source TEXT,
  version INTEGER NOT NULL DEFAULT 1,
  CHECK (
    (catalog_product_id IS NOT NULL AND user_product_id IS NULL)
    OR
    (catalog_product_id IS NULL AND user_product_id IS NOT NULL)
  ),
  FOREIGN KEY (stack_id) REFERENCES stacks(id) ON DELETE CASCADE,
  FOREIGN KEY (catalog_product_id) REFERENCES products(id) ON DELETE CASCADE,
  FOREIGN KEY (user_product_id) REFERENCES user_products(id) ON DELETE CASCADE
);

INSERT INTO stack_items_0104 (
  id, stack_id, catalog_product_id, user_product_id, quantity, dosage_text,
  timing, intake_interval_days, sort_order, source_share_link_id,
  creator_statement_snapshot, amount_source, version
)
SELECT
  id, stack_id, catalog_product_id, user_product_id, quantity, dosage_text,
  timing, intake_interval_days, sort_order, source_share_link_id,
  creator_statement_snapshot, amount_source, version
FROM stack_items;

INSERT INTO stack_category_migration_guard_0104 (ok)
SELECT CASE WHEN
  (SELECT COUNT(*) FROM stack_items_0104) = (SELECT COUNT(*) FROM stack_items)
  AND NOT EXISTS (
    SELECT 1
    FROM stack_items old
    LEFT JOIN stack_items_0104 rebuilt ON rebuilt.id = old.id
    WHERE rebuilt.id IS NULL
      OR typeof(rebuilt.stack_id) <> typeof(old.stack_id) OR rebuilt.stack_id IS NOT old.stack_id
      OR typeof(rebuilt.catalog_product_id) <> typeof(old.catalog_product_id) OR rebuilt.catalog_product_id IS NOT old.catalog_product_id
      OR typeof(rebuilt.user_product_id) <> typeof(old.user_product_id) OR rebuilt.user_product_id IS NOT old.user_product_id
      OR typeof(rebuilt.quantity) <> typeof(old.quantity) OR rebuilt.quantity IS NOT old.quantity
      OR typeof(rebuilt.dosage_text) <> typeof(old.dosage_text) OR rebuilt.dosage_text IS NOT old.dosage_text
      OR typeof(rebuilt.timing) <> typeof(old.timing) OR rebuilt.timing IS NOT old.timing
      OR typeof(rebuilt.intake_interval_days) <> typeof(old.intake_interval_days) OR rebuilt.intake_interval_days IS NOT old.intake_interval_days
      OR typeof(rebuilt.sort_order) <> typeof(old.sort_order) OR rebuilt.sort_order IS NOT old.sort_order
      OR typeof(rebuilt.source_share_link_id) <> typeof(old.source_share_link_id) OR rebuilt.source_share_link_id IS NOT old.source_share_link_id
      OR typeof(rebuilt.creator_statement_snapshot) <> typeof(old.creator_statement_snapshot) OR rebuilt.creator_statement_snapshot IS NOT old.creator_statement_snapshot
      OR typeof(rebuilt.amount_source) <> typeof(old.amount_source) OR rebuilt.amount_source IS NOT old.amount_source
      OR typeof(rebuilt.version) <> typeof(old.version) OR rebuilt.version IS NOT old.version
  )
THEN 1 ELSE 0 END;

DROP TABLE stack_items;
ALTER TABLE stack_items_0104 RENAME TO stack_items;

INSERT OR REPLACE INTO stack_item_link_bindings (
  stack_item_id, shop_link_id, resolution_kind, affiliate_version_id,
  resolved_party_id, bound_at
)
SELECT
  stack_item_id, shop_link_id, resolution_kind, affiliate_version_id,
  resolved_party_id, bound_at
FROM stack_item_link_binding_archive_0104;

INSERT INTO stack_category_migration_guard_0104 (ok)
SELECT CASE WHEN
  (SELECT COUNT(*) FROM stack_item_link_binding_archive_0104) =
    (SELECT COUNT(*) FROM stack_item_link_bindings)
  AND NOT EXISTS (
    SELECT 1
    FROM stack_item_link_binding_archive_0104 archived
    LEFT JOIN stack_item_link_bindings restored
      ON restored.stack_item_id = archived.stack_item_id
    WHERE restored.stack_item_id IS NULL
      OR typeof(restored.shop_link_id) <> typeof(archived.shop_link_id)
      OR restored.shop_link_id IS NOT archived.shop_link_id
      OR typeof(restored.resolution_kind) <> typeof(archived.resolution_kind)
      OR restored.resolution_kind IS NOT archived.resolution_kind
      OR typeof(restored.affiliate_version_id) <> typeof(archived.affiliate_version_id)
      OR restored.affiliate_version_id IS NOT archived.affiliate_version_id
      OR typeof(restored.resolved_party_id) <> typeof(archived.resolved_party_id)
      OR restored.resolved_party_id IS NOT archived.resolved_party_id
      OR typeof(restored.bound_at) <> typeof(archived.bound_at)
      OR restored.bound_at IS NOT archived.bound_at
  )
THEN 1 ELSE 0 END;

CREATE INDEX IF NOT EXISTS idx_stack_items_stack_id ON stack_items(stack_id);
CREATE INDEX IF NOT EXISTS idx_stack_items_catalog_product_id ON stack_items(catalog_product_id);
CREATE INDEX IF NOT EXISTS idx_stack_items_user_product_id ON stack_items(user_product_id);
CREATE INDEX IF NOT EXISTS idx_stack_items_stack_sort ON stack_items(stack_id, sort_order, id);

DROP TABLE stack_categories;
DROP TABLE stack_category_migration_guard_0104;
DROP TABLE stack_item_link_binding_archive_0104;
DROP TABLE stack_item_category_archive_0104;
DROP TABLE stack_category_archive_0104;
