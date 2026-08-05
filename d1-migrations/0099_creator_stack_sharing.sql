PRAGMA foreign_keys = ON;

-- Influencer-/Creator-Stack-Sharing MVP.
-- Additive only: existing product, ingredient, shop-link, share and click tables
-- remain canonical. Public activation is controlled by the Worker feature flag.

CREATE TABLE IF NOT EXISTS parties (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  type TEXT NOT NULL CHECK (type IN ('platform', 'creator', 'brand', 'user')),
  name TEXT NOT NULL CHECK (length(trim(name)) BETWEEN 1 AND 160),
  slug TEXT NOT NULL UNIQUE CHECK (length(trim(slug)) BETWEEN 1 AND 120),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'blocked')),
  auto_catalog_approval INTEGER NOT NULL DEFAULT 0 CHECK (auto_catalog_approval IN (0, 1)),
  version INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS party_memberships (
  party_id INTEGER NOT NULL REFERENCES parties(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('owner', 'editor', 'viewer')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'revoked')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (party_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_party_memberships_user
  ON party_memberships(user_id, status, party_id);

INSERT OR IGNORE INTO parties (
  type, name, slug, status, auto_catalog_approval
) VALUES (
  'platform', 'Supplement Stack', 'platform', 'active', 1
);

-- Existing user-owned or user-submitted affiliate/product records receive a
-- stable user party. No email address is copied into the party name.
INSERT OR IGNORE INTO parties (
  type, name, slug, status, auto_catalog_approval
)
SELECT DISTINCT
  'user',
  'Nutzer ' || u.id,
  'user-' || u.id,
  'active',
  0
FROM users u
WHERE EXISTS (
  SELECT 1
  FROM products p
  WHERE p.affiliate_owner_user_id = u.id
)
OR EXISTS (
  SELECT 1
  FROM product_shop_links psl
  WHERE psl.affiliate_owner_user_id = u.id
)
OR EXISTS (
  SELECT 1
  FROM user_products up
  WHERE up.user_id = u.id
    AND up.published_product_id IS NOT NULL
);

INSERT OR IGNORE INTO party_memberships (party_id, user_id, role, status)
SELECT p.id, CAST(substr(p.slug, 6) AS INTEGER), 'owner', 'active'
FROM parties p
WHERE p.type = 'user'
  AND p.slug GLOB 'user-[0-9]*'
  AND EXISTS (
    SELECT 1 FROM users u WHERE u.id = CAST(substr(p.slug, 6) AS INTEGER)
  );

ALTER TABLE products
  ADD COLUMN owner_party_id INTEGER REFERENCES parties(id) ON DELETE RESTRICT;

UPDATE products
SET owner_party_id = COALESCE(
  (
    SELECT party.id
    FROM user_products up
    JOIN parties party ON party.slug = 'user-' || up.user_id
    WHERE up.id = products.source_user_product_id
    LIMIT 1
  ),
  (
    SELECT party.id
    FROM parties party
    WHERE party.slug = 'user-' || products.affiliate_owner_user_id
    LIMIT 1
  ),
  (SELECT id FROM parties WHERE slug = 'platform')
)
WHERE owner_party_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_products_owner_party
  ON products(owner_party_id, moderation_status, visibility);

CREATE VIEW IF NOT EXISTS globally_visible_products AS
SELECT p.id AS product_id
FROM products p
JOIN parties owner ON owner.id = p.owner_party_id
WHERE p.moderation_status = 'approved'
  AND owner.status = 'active'
  AND (
    p.visibility = 'public'
    OR (p.visibility = 'auto' AND owner.auto_catalog_approval = 1)
  );

ALTER TABLE product_shop_links ADD COLUMN link_kind TEXT;
ALTER TABLE product_shop_links
  ADD COLUMN legacy_party_id INTEGER REFERENCES parties(id) ON DELETE RESTRICT;
ALTER TABLE product_shop_links ADD COLUMN blocked_at TEXT;
ALTER TABLE product_shop_links ADD COLUMN blocked_reason TEXT;

-- Bind domains only when an existing configured domain matches unambiguously.
UPDATE product_shop_links
SET shop_domain_id = (
      SELECT sd.id
      FROM shop_domains sd
      WHERE lower(product_shop_links.url) LIKE '%://' || lower(sd.domain) || '/%'
         OR lower(product_shop_links.url) LIKE '%://www.' || lower(sd.domain) || '/%'
      ORDER BY length(sd.domain) DESC, sd.id ASC
      LIMIT 1
    ),
    normalized_host = (
      SELECT sd.domain
      FROM shop_domains sd
      WHERE lower(product_shop_links.url) LIKE '%://' || lower(sd.domain) || '/%'
         OR lower(product_shop_links.url) LIKE '%://www.' || lower(sd.domain) || '/%'
      ORDER BY length(sd.domain) DESC, sd.id ASC
      LIMIT 1
    )
WHERE shop_domain_id IS NULL;

UPDATE product_shop_links
SET link_kind = CASE
      WHEN COALESCE(is_affiliate, 0) = 1
        OR COALESCE(affiliate_owner_type, 'none') <> 'none'
        THEN 'legacy_resolved'
      ELSE 'base_target'
    END,
    legacy_party_id = CASE
      WHEN COALESCE(affiliate_owner_type, 'none') = 'user'
        AND affiliate_owner_user_id IS NOT NULL
        THEN (
          SELECT id FROM parties WHERE slug = 'user-' || product_shop_links.affiliate_owner_user_id
        )
      WHEN COALESCE(is_affiliate, 0) = 1
        OR COALESCE(affiliate_owner_type, 'none') = 'nick'
        THEN (SELECT id FROM parties WHERE slug = 'platform')
      ELSE NULL
    END
WHERE link_kind IS NULL;

CREATE INDEX IF NOT EXISTS idx_product_shop_links_creator_resolution
  ON product_shop_links(product_id, shop_domain_id, active, blocked_at, link_kind, is_primary, sort_order);

CREATE TABLE IF NOT EXISTS party_shop_affiliate_versions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  party_id INTEGER NOT NULL REFERENCES parties(id) ON DELETE RESTRICT,
  shop_domain_id INTEGER NOT NULL REFERENCES shop_domains(id) ON DELETE RESTRICT,
  version INTEGER NOT NULL CHECK (version >= 1),
  code TEXT NOT NULL CHECK (length(trim(code)) BETWEEN 1 AND 300),
  link_template TEXT NOT NULL CHECK (length(trim(link_template)) BETWEEN 1 AND 1200),
  tracking_domain TEXT,
  status TEXT NOT NULL DEFAULT 'current' CHECK (status IN ('current', 'retired', 'blocked')),
  valid_from TEXT,
  valid_until TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (party_id, shop_domain_id, version)
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_party_shop_current_affiliate
  ON party_shop_affiliate_versions(party_id, shop_domain_id)
  WHERE status = 'current';

CREATE INDEX IF NOT EXISTS idx_party_shop_affiliate_lookup
  ON party_shop_affiliate_versions(party_id, shop_domain_id, status, valid_from, valid_until);

CREATE TABLE IF NOT EXISTS party_default_shops (
  party_id INTEGER PRIMARY KEY REFERENCES parties(id) ON DELETE CASCADE,
  shop_domain_id INTEGER NOT NULL REFERENCES shop_domains(id) ON DELETE RESTRICT,
  version INTEGER NOT NULL DEFAULT 1,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS party_product_picks (
  party_id INTEGER NOT NULL REFERENCES parties(id) ON DELETE CASCADE,
  ingredient_id INTEGER NOT NULL REFERENCES ingredients(id) ON DELETE CASCADE,
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  version INTEGER NOT NULL DEFAULT 1,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (party_id, ingredient_id)
);

CREATE INDEX IF NOT EXISTS idx_party_product_picks_product
  ON party_product_picks(product_id, party_id);

ALTER TABLE stacks
  ADD COLUMN origin_party_id INTEGER REFERENCES parties(id) ON DELETE RESTRICT;
ALTER TABLE stacks ADD COLUMN last_opened_at TEXT;

CREATE INDEX IF NOT EXISTS idx_stacks_origin_party
  ON stacks(origin_party_id, user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_stacks_user_last_opened
  ON stacks(user_id, last_opened_at DESC, id DESC);

ALTER TABLE stack_items
  ADD COLUMN source_share_link_id INTEGER REFERENCES share_links(id) ON DELETE SET NULL;
ALTER TABLE stack_items ADD COLUMN creator_statement_snapshot TEXT;
ALTER TABLE stack_items ADD COLUMN amount_source TEXT;
ALTER TABLE stack_items ADD COLUMN version INTEGER NOT NULL DEFAULT 1;

CREATE TABLE IF NOT EXISTS stack_item_link_bindings (
  stack_item_id INTEGER PRIMARY KEY REFERENCES stack_items(id) ON DELETE CASCADE,
  shop_link_id INTEGER NOT NULL REFERENCES product_shop_links(id) ON DELETE RESTRICT,
  resolution_kind TEXT NOT NULL CHECK (
    resolution_kind IN ('creator_version', 'platform_version', 'legacy_resolved', 'bare')
  ),
  affiliate_version_id INTEGER
    REFERENCES party_shop_affiliate_versions(id) ON DELETE RESTRICT,
  resolved_party_id INTEGER REFERENCES parties(id) ON DELETE RESTRICT,
  bound_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK (
    (
      resolution_kind IN ('creator_version', 'platform_version')
      AND affiliate_version_id IS NOT NULL
      AND resolved_party_id IS NOT NULL
    )
    OR (
      resolution_kind = 'legacy_resolved'
      AND affiliate_version_id IS NULL
      AND resolved_party_id IS NOT NULL
    )
    OR (
      resolution_kind = 'bare'
      AND affiliate_version_id IS NULL
      AND resolved_party_id IS NULL
    )
  )
);

CREATE INDEX IF NOT EXISTS idx_stack_item_link_bindings_resolution
  ON stack_item_link_bindings(resolved_party_id, affiliate_version_id, shop_link_id);

ALTER TABLE share_links
  ADD COLUMN creator_party_id INTEGER REFERENCES parties(id) ON DELETE RESTRICT;
ALTER TABLE share_links ADD COLUMN snapshot_schema_version INTEGER;
ALTER TABLE share_links ADD COLUMN snapshot_hash TEXT;
ALTER TABLE share_links ADD COLUMN moderation_status TEXT NOT NULL DEFAULT 'pending';
ALTER TABLE share_links
  ADD COLUMN moderated_by_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE share_links ADD COLUMN moderated_at TEXT;

UPDATE share_links
SET creator_party_id = (
  SELECT party.id
  FROM parties party
  WHERE party.slug = 'user-' || share_links.creator_user_id
)
WHERE creator_party_id IS NULL
  AND creator_user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_share_links_creator_moderation
  ON share_links(creator_party_id, moderation_status, is_revoked, created_at DESC);

CREATE TABLE IF NOT EXISTS share_import_operations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  idempotency_key TEXT NOT NULL UNIQUE,
  share_link_id INTEGER NOT NULL REFERENCES share_links(id) ON DELETE RESTRICT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  target_stack_id INTEGER REFERENCES stacks(id) ON DELETE SET NULL,
  result_json TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_share_import_operations_user
  ON share_import_operations(user_id, created_at DESC);

ALTER TABLE product_link_clicks
  ADD COLUMN resolved_party_id INTEGER REFERENCES parties(id) ON DELETE SET NULL;
ALTER TABLE product_link_clicks
  ADD COLUMN creator_context_party_id INTEGER REFERENCES parties(id) ON DELETE SET NULL;
ALTER TABLE product_link_clicks
  ADD COLUMN affiliate_version_id INTEGER
    REFERENCES party_shop_affiliate_versions(id) ON DELETE SET NULL;
ALTER TABLE product_link_clicks
  ADD COLUMN source_share_link_id INTEGER REFERENCES share_links(id) ON DELETE SET NULL;
ALTER TABLE product_link_clicks ADD COLUMN resolution_kind TEXT;

CREATE INDEX IF NOT EXISTS idx_product_link_clicks_creator_context
  ON product_link_clicks(creator_context_party_id, clicked_at);
CREATE INDEX IF NOT EXISTS idx_product_link_clicks_resolved_party
  ON product_link_clicks(resolved_party_id, clicked_at);
