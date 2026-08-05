import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fetchCreatorSharingHono } from './creatorSharingHonoHandlers.mjs';
import { createProductionKnowledgeHonoHarness, type ProductionKnowledgeHonoHarness } from './productionKnowledgeHonoTestHarness';
import { buildAffiliateUrl, validateProductTargetUrl } from '../../../functions/api/lib/creator-sharing';
import { convertAmount } from '../../../functions/api/lib/units';

type TestStatement = {
  bind: (...values: unknown[]) => TestStatement;
  first: <T>() => Promise<T | null>;
  all: <T>() => Promise<{ results: T[] }>;
};
type TestDatabase = { prepare: (sql: string) => TestStatement };

const JWT_SECRET = 'creator-sharing-integration-secret-that-is-long-enough';

async function authToken(userId: number, role: 'user' | 'admin', email: string): Promise<string> {
  const encode = (value: string) => Buffer.from(value).toString('base64url');
  const header = encode(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const payload = encode(JSON.stringify({ userId, role, email, exp: Math.floor(Date.now() / 1000) + 3600 }));
  const signingInput = `${header}.${payload}`;
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(JWT_SECRET),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(signingInput));
  return `${signingInput}.${Buffer.from(signature).toString('base64url')}`;
}

async function jsonRequest(
  harness: ProductionKnowledgeHonoHarness,
  path: string,
  options: { method?: string; token?: string; cookie?: string; body?: unknown; feature?: boolean } = {},
): Promise<Response> {
  const headers = new Headers();
  if (options.token) headers.set('Authorization', `Bearer ${options.token}`);
  if (options.cookie) headers.set('Cookie', `session=${options.cookie}`);
  if (options.body !== undefined) headers.set('Content-Type', 'application/json');
  const request = new Request(`https://supplementstack.de${path}`, {
    method: options.method ?? 'GET',
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });
  return fetchCreatorSharingHono(request, {
    DB: harness.db,
    JWT_SECRET,
    CREATOR_STACK_SHARING_ENABLED: options.feature === false ? 'false' : 'true',
  }, { waitUntil() {}, passThroughOnException() {}, props: {} });
}

function applyAllMigrations(harness: ProductionKnowledgeHonoHarness): void {
  const directory = resolve(process.cwd(), '..', 'd1-migrations');
  for (const file of readdirSync(directory).filter((name) => /^\d+.*\.sql$/.test(name)).sort()) {
    harness.exec(readFileSync(resolve(directory, file), 'utf8'));
  }
}

describe('creator stack sharing runtime contract', () => {
  let harness: ProductionKnowledgeHonoHarness;
  let db: TestDatabase;

  beforeEach(async () => {
    harness = createProductionKnowledgeHonoHarness();
    applyAllMigrations(harness);
    db = harness.db as TestDatabase;
    harness.run(`INSERT INTO users (id, email, password_hash, role, email_verified_at) VALUES (100, 'creator@test.invalid', 'x', 'user', CURRENT_TIMESTAMP)`);
    harness.run(`INSERT INTO users (id, email, password_hash, role, email_verified_at) VALUES (101, 'importer@test.invalid', 'x', 'user', CURRENT_TIMESTAMP)`);
    harness.run(`INSERT INTO users (id, email, password_hash, role, email_verified_at) VALUES (102, 'admin@test.invalid', 'x', 'admin', CURRENT_TIMESTAMP)`);
    harness.run(`INSERT INTO parties (id, type, name, slug, status, auto_catalog_approval) VALUES (100, 'creator', 'Test Creator', 'test-creator', 'active', 0)`);
    harness.run(`INSERT INTO party_memberships (party_id, user_id, role, status) VALUES (100, 100, 'owner', 'active')`);
    harness.run(`INSERT INTO stacks (id, user_id, name) VALUES (100, 100, 'Creator Stack')`);
    harness.run(`INSERT INTO stack_categories (id, stack_id, name, name_normalized, sort_order, is_default) VALUES (100, 100, 'Unkategorisiert', 'unkategorisiert', 0, 1)`);

    const target = await db.prepare(`
      SELECT psl.id AS shop_link_id, psl.product_id, psl.shop_domain_id
      FROM product_shop_links psl
      JOIN product_ingredients pi ON pi.product_id = psl.product_id AND pi.is_main = 1
      WHERE psl.link_kind = 'base_target' AND psl.active = 1 AND psl.shop_domain_id IS NOT NULL
      ORDER BY psl.id LIMIT 1
    `).first<{ shop_link_id: number; product_id: number; shop_domain_id: number }>();
    expect(target).not.toBeNull();
    harness.run(`INSERT INTO stack_items (id, stack_id, catalog_product_id, quantity, intake_interval_days, sort_order, category_id) VALUES (100, 100, ?, 1, 1, 0, 100)`, target!.product_id);
    harness.run(`INSERT INTO party_shop_affiliate_versions (id, party_id, shop_domain_id, version, code, link_template, status) VALUES (100, 100, ?, 1, 'creator-v1', '{url}?creator={code}', 'current')`, target!.shop_domain_id);
  });

  afterEach(() => harness.close());

  it('keeps new public routes disabled by default', async () => {
    const creator = await authToken(100, 'user', 'creator@test.invalid');
    const response = await jsonRequest(harness, '/api/creator-sharing/shares', {
      method: 'POST', token: creator, feature: false,
      body: { party_id: 100, stack_id: 100, type: 'stack', title: 'Disabled' },
    });
    expect(response.status).toBe(404);
  });

  it('freezes attribution, moderates, imports idempotently and tracks without user or stack ids', async () => {
    const creator = await authToken(100, 'user', 'creator@test.invalid');
    const importer = await authToken(101, 'user', 'importer@test.invalid');
    const admin = await authToken(102, 'admin', 'admin@test.invalid');
    const creatorProduct = await db.prepare(`SELECT catalog_product_id AS id FROM stack_items WHERE id = 100`).first<{ id: number }>();
    harness.run(`UPDATE parties SET auto_catalog_approval = 1 WHERE id = 100`);
    harness.run(`UPDATE products SET owner_party_id = 100, visibility = 'auto' WHERE id = ?`, creatorProduct!.id);
    expect(await db.prepare(`SELECT product_id FROM globally_visible_products WHERE product_id = ?`).bind(creatorProduct!.id).first()).not.toBeNull();

    const createResponse = await jsonRequest(harness, '/api/creator-sharing/shares', {
      method: 'POST', token: creator,
      body: {
        party_id: 100,
        stack_id: 100,
        type: 'stack',
        title: 'Mein Snapshot',
        creator_statements: { 100: 'Sachlicher Kontext ohne individuelle Dosierung.' },
      },
    });
    expect(createResponse.status).toBe(201);
    const created = await createResponse.json() as { id: number; token: string; snapshot_hash: string };
    expect((await jsonRequest(harness, `/api/creator-sharing/shares/${created.token}`)).status).toBe(404);

    const moderation = await jsonRequest(harness, `/api/admin/creator-sharing/shares/${created.id}`, {
      method: 'PATCH', token: admin,
      body: { expected_status: 'pending', expected_snapshot_hash: created.snapshot_hash, moderation_status: 'approved', is_revoked: 0 },
    });
    expect(moderation.status).toBe(200);
    const previewResponse = await jsonRequest(harness, `/api/creator-sharing/shares/${created.token}`);
    expect(previewResponse.status).toBe(200);
    const preview = await previewResponse.json() as { creator: { name: string }; disclosure: string; items: Array<{ creator_statement: string }> };
    expect(preview.creator.name).toBe('Test Creator');
    expect(preview.disclosure).toContain('Affiliate');
    expect(preview.items[0].creator_statement).toContain('Sachlicher Kontext');

    const target = await db.prepare(`SELECT shop_domain_id FROM party_shop_affiliate_versions WHERE id = 100`).first<{ shop_domain_id: number }>();
    harness.run(`UPDATE party_shop_affiliate_versions SET status = 'retired' WHERE id = 100`);
    harness.run(`INSERT INTO party_shop_affiliate_versions (party_id, shop_domain_id, version, code, link_template, status) VALUES (100, ?, 2, 'creator-v2', '{url}?creator={code}', 'current')`, target!.shop_domain_id);

    const importBody = { idempotency_key: 'creator-import-operation-0001', stack_name: 'Importierter Stack' };
    const firstImport = await jsonRequest(harness, `/api/creator-sharing/shares/${created.token}/import`, { method: 'POST', token: importer, body: importBody });
    expect(firstImport.status).toBe(201);
    const imported = await firstImport.json() as { stack_id: number };
    const replay = await jsonRequest(harness, `/api/creator-sharing/shares/${created.token}/import`, { method: 'POST', token: importer, body: importBody });
    expect(replay.status).toBe(200);
    expect((await replay.json() as { idempotent_replay: boolean }).idempotent_replay).toBe(true);

    const importedRow = await db.prepare(`
      SELECT si.id AS stack_item_id, s.origin_party_id, si.source_share_link_id,
        binding.affiliate_version_id, binding.resolved_party_id
      FROM stacks s JOIN stack_items si ON si.stack_id = s.id
      JOIN stack_item_link_bindings binding ON binding.stack_item_id = si.id
      WHERE s.id = ?
    `).bind(imported.stack_id).first<{ stack_item_id: number; origin_party_id: number; source_share_link_id: number; affiliate_version_id: number; resolved_party_id: number }>();
    expect(importedRow).toMatchObject({ origin_party_id: 100, source_share_link_id: created.id, affiliate_version_id: 100, resolved_party_id: 100 });
    const shareCounters = await db.prepare(`SELECT imports FROM share_links WHERE id = ?`).bind(created.id).first<{ imports: number }>();
    expect(shareCounters?.imports).toBe(1);

    const clickResponse = await jsonRequest(harness, `/api/products/${preview.items.length ? (await db.prepare('SELECT catalog_product_id AS id FROM stack_items WHERE id = ?').bind(importedRow!.stack_item_id).first<{ id: number }>())!.id : 0}/out?stack_item_id=${importedRow!.stack_item_id}`, { cookie: importer });
    expect(clickResponse.status).toBe(302);
    expect(clickResponse.headers.get('location')).toContain('creator-v1');
    const click = await db.prepare(`SELECT user_id, stack_id, creator_context_party_id, resolved_party_id, affiliate_version_id, referrer_path FROM product_link_clicks ORDER BY id DESC LIMIT 1`).first<{
      user_id: number | null; stack_id: number | null; creator_context_party_id: number; resolved_party_id: number; affiliate_version_id: number; referrer_path: string | null;
    }>();
    expect(click).toMatchObject({ user_id: null, stack_id: null, creator_context_party_id: 100, resolved_party_id: 100, affiliate_version_id: 100, referrer_path: null });

    const platform = await db.prepare(`SELECT id FROM parties WHERE slug = 'platform'`).first<{ id: number }>();
    harness.run(`UPDATE party_shop_affiliate_versions SET status = 'blocked' WHERE id = 100`);
    harness.run(`INSERT INTO party_shop_affiliate_versions (party_id, shop_domain_id, version, code, link_template, status) VALUES (?, ?, 1, 'platform-safe', '{url}?platform={code}', 'current')`, platform!.id, target!.shop_domain_id);
    const fallbackResponse = await jsonRequest(harness, `/api/products/${(await db.prepare('SELECT catalog_product_id AS id FROM stack_items WHERE id = ?').bind(importedRow!.stack_item_id).first<{ id: number }>())!.id}/out?stack_item_id=${importedRow!.stack_item_id}`, { cookie: importer });
    expect(fallbackResponse.status).toBe(302);
    expect(fallbackResponse.headers.get('location')).toContain('platform-safe');
    const fallbackClick = await db.prepare(`SELECT creator_context_party_id, resolved_party_id, resolution_kind FROM product_link_clicks ORDER BY id DESC LIMIT 1`).first<{
      creator_context_party_id: number; resolved_party_id: number; resolution_kind: string;
    }>();
    expect(fallbackClick).toMatchObject({ creator_context_party_id: 100, resolved_party_id: platform!.id, resolution_kind: 'platform_version' });

    harness.run(`UPDATE party_shop_affiliate_versions SET status = 'blocked' WHERE party_id = ? AND shop_domain_id = ?`, platform!.id, target!.shop_domain_id);
    const bareResponse = await jsonRequest(harness, `/api/products/${creatorProduct!.id}/out?stack_item_id=${importedRow!.stack_item_id}`, { cookie: importer });
    expect(bareResponse.status).toBe(302);
    expect(bareResponse.headers.get('location')).not.toContain('creator=');
    expect(bareResponse.headers.get('location')).not.toContain('platform=');
    const bareClick = await db.prepare(`SELECT creator_context_party_id, resolved_party_id, resolution_kind FROM product_link_clicks ORDER BY id DESC LIMIT 1`).first<{
      creator_context_party_id: number; resolved_party_id: number | null; resolution_kind: string;
    }>();
    expect(bareClick).toMatchObject({ creator_context_party_id: 100, resolved_party_id: null, resolution_kind: 'bare' });

    harness.run(`UPDATE parties SET status = 'blocked' WHERE id = 100`);
    expect(await db.prepare(`SELECT product_id FROM globally_visible_products WHERE product_id = ?`).bind(creatorProduct!.id).first()).toBeNull();
    const blockedShare = await jsonRequest(harness, '/api/creator-sharing/shares', {
      method: 'POST', token: creator,
      body: { party_id: 100, stack_id: 100, type: 'stack', title: 'Nicht erlaubt' },
    });
    expect(blockedShare.status).toBe(409);
  });

  it('uses exact main-ingredient sets and never treats D3 as D3 plus K2', async () => {
    const source = await db.prepare(`
      SELECT si.catalog_product_id AS product_id, psl.id AS shop_link_id, psl.shop_domain_id
      FROM stack_items si JOIN product_shop_links psl ON psl.product_id = si.catalog_product_id AND psl.link_kind = 'base_target'
      WHERE si.id = 100 LIMIT 1
    `).first<{ product_id: number; shop_link_id: number; shop_domain_id: number }>();
    const main = await db.prepare(`SELECT ingredient_id FROM product_ingredients WHERE product_id = ? AND is_main = 1 ORDER BY ingredient_id LIMIT 1`).bind(source!.product_id).first<{ ingredient_id: number }>();
    const other = await db.prepare(`SELECT id FROM ingredients WHERE id <> ? ORDER BY id LIMIT 1`).bind(main!.ingredient_id).first<{ id: number }>();
    harness.run(`INSERT INTO products (id, name, price, moderation_status, visibility, owner_party_id) VALUES (999, 'Doppelkombination', 1, 'approved', 'public', (SELECT id FROM parties WHERE slug='platform'))`);
    harness.run(`INSERT INTO product_ingredients (product_id, ingredient_id, is_main, quantity, unit) VALUES (999, ?, 1, 1, 'mg')`, main!.ingredient_id);
    harness.run(`INSERT INTO product_ingredients (product_id, ingredient_id, is_main, quantity, unit) VALUES (999, ?, 1, 1, 'mg')`, other!.id);
    harness.run(`INSERT INTO product_shop_links (product_id, shop_domain_id, url, active, is_primary, sort_order, link_kind) SELECT 999, shop_domain_id, url, 1, 1, 0, 'base_target' FROM product_shop_links WHERE id = ?`, source!.shop_link_id);
    harness.run(`INSERT INTO stacks (id, user_id, name, last_opened_at) VALUES (101, 101, 'Ziel', CURRENT_TIMESTAMP)`);
    harness.run(`INSERT INTO stack_categories (id, stack_id, name, name_normalized, sort_order, is_default) VALUES (101, 101, 'Unkategorisiert', 'unkategorisiert', 0, 1)`);
    harness.run(`INSERT INTO stack_items (id, stack_id, catalog_product_id, quantity, intake_interval_days, sort_order, category_id) VALUES (101, 101, 999, 1, 1, 0, 101)`);

    const creator = await authToken(100, 'user', 'creator@test.invalid');
    const admin = await authToken(102, 'admin', 'admin@test.invalid');
    const importer = await authToken(101, 'user', 'importer@test.invalid');
    const createdResponse = await jsonRequest(harness, '/api/creator-sharing/shares', { method: 'POST', token: creator, body: { party_id: 100, stack_id: 100, stack_item_id: 100, type: 'dose_recommendation', title: 'D3' } });
    const created = await createdResponse.json() as { id: number; token: string; snapshot_hash: string };
    await jsonRequest(harness, `/api/admin/creator-sharing/shares/${created.id}`, { method: 'PATCH', token: admin, body: { expected_status: 'pending', expected_snapshot_hash: created.snapshot_hash, moderation_status: 'approved' } });
    const imported = await jsonRequest(harness, `/api/creator-sharing/shares/${created.token}/import`, { method: 'POST', token: importer, body: { idempotency_key: 'exact-main-set-operation-0001', target_stack_id: 101 } });
    expect(imported.status).toBe(201);
    expect((await imported.json() as { action: string }).action).toBe('added');
  });

  it('requires a concrete choice when several exact conflicts exist', async () => {
    harness.run(`INSERT INTO stacks (id, user_id, name, last_opened_at) VALUES (101, 101, 'Ziel', CURRENT_TIMESTAMP)`);
    harness.run(`INSERT INTO stack_categories (id, stack_id, name, name_normalized, sort_order, is_default) VALUES (101, 101, 'Unkategorisiert', 'unkategorisiert', 0, 1)`);
    const source = await db.prepare(`SELECT catalog_product_id AS product_id FROM stack_items WHERE id = 100`).first<{ product_id: number }>();
    harness.run(`INSERT INTO stack_items (id, stack_id, catalog_product_id, quantity, intake_interval_days, sort_order, category_id) VALUES (101, 101, ?, 1, 1, 0, 101)`, source!.product_id);
    harness.run(`INSERT INTO stack_items (id, stack_id, catalog_product_id, quantity, intake_interval_days, sort_order, category_id) VALUES (102, 101, ?, 1, 1, 1, 101)`, source!.product_id);
    const creator = await authToken(100, 'user', 'creator@test.invalid');
    const admin = await authToken(102, 'admin', 'admin@test.invalid');
    const importer = await authToken(101, 'user', 'importer@test.invalid');
    const create = await jsonRequest(harness, '/api/creator-sharing/shares', {
      method: 'POST', token: creator,
      body: { party_id: 100, stack_id: 100, stack_item_id: 100, type: 'dose_recommendation', title: 'Einzel' },
    });
    const share = await create.json() as { id: number; token: string; snapshot_hash: string };
    await jsonRequest(harness, `/api/admin/creator-sharing/shares/${share.id}`, {
      method: 'PATCH', token: admin,
      body: { expected_status: 'pending', expected_snapshot_hash: share.snapshot_hash, moderation_status: 'approved' },
    });
    const conflict = await jsonRequest(harness, `/api/creator-sharing/shares/${share.token}/import`, {
      method: 'POST', token: importer,
      body: { idempotency_key: 'multiple-conflicts-0001', target_stack_id: 101 },
    });
    expect(conflict.status).toBe(409);
    const payload = await conflict.json() as { conflicts: Array<{ stack_item_id: number; version: number }> };
    expect(payload.conflicts.map((entry) => entry.stack_item_id)).toEqual([101, 102]);
    const replace = await jsonRequest(harness, `/api/creator-sharing/shares/${share.token}/import`, {
      method: 'POST', token: importer,
      body: {
        idempotency_key: 'multiple-conflicts-0002', target_stack_id: 101, conflict_action: 'replace',
        replace_stack_item_id: 102, expected_stack_item_version: payload.conflicts[1].version,
      },
    });
    expect(replace.status).toBe(200);
    expect((await replace.json() as { stack_item_id: number }).stack_item_id).toBe(102);
  });

  it('enforces admin write guards and exposes only aggregate creator metrics', async () => {
    const admin = await authToken(102, 'admin', 'admin@test.invalid');
    const creator = await authToken(100, 'user', 'creator@test.invalid');
    const target = await db.prepare(`SELECT shop_domain_id, product_id, url FROM product_shop_links WHERE link_kind = 'base_target' AND shop_domain_id IS NOT NULL LIMIT 1`).first<{ shop_domain_id: number; product_id: number; url: string }>();
    const ingredient = await db.prepare(`SELECT ingredient_id FROM product_ingredients WHERE product_id = ? AND is_main = 1 LIMIT 1`).bind(target!.product_id).first<{ ingredient_id: number }>();

    const missingExpected = await jsonRequest(harness, '/api/admin/creator-sharing/parties/100/affiliate-versions', {
      method: 'POST', token: admin,
      body: { shop_domain_id: target!.shop_domain_id, code: 'x', link_template: '{url}?code={code}' },
    });
    expect(missingExpected.status).toBe(400);
    const invalidWindow = await jsonRequest(harness, '/api/admin/creator-sharing/parties/100/affiliate-versions', {
      method: 'POST', token: admin,
      body: { shop_domain_id: target!.shop_domain_id, code: 'x', link_template: '{url}?code={code}', expected_current_id: 100, valid_from: 'not-a-date' },
    });
    expect(invalidWindow.status).toBe(400);
    const defaultShop = await jsonRequest(harness, '/api/admin/creator-sharing/parties/100/default-shop', {
      method: 'PUT', token: admin,
      body: { shop_domain_id: target!.shop_domain_id, expected_version: null },
    });
    expect(defaultShop.status).toBe(200);
    const pick = await jsonRequest(harness, `/api/admin/creator-sharing/parties/100/product-picks/${ingredient!.ingredient_id}`, {
      method: 'PUT', token: admin,
      body: { product_id: target!.product_id, expected_version: null },
    });
    expect(pick.status).toBe(200);
    expect((await jsonRequest(harness, '/api/admin/creator-sharing/missing-platform-codes', { token: admin })).status).toBe(200);

    harness.run(`UPDATE products SET shop_link = NULL, is_affiliate = 0, affiliate_owner_type = 'none', affiliate_owner_user_id = NULL WHERE id = ?`, target!.product_id);
    const productQa = await jsonRequest(harness, '/api/admin/product-qa?issue=missing_shop_link', { token: admin });
    expect(productQa.status).toBe(200);
    const productQaPayload = await productQa.json() as { products: Array<{ id: number }> };
    expect(productQaPayload.products.map((product) => product.id)).not.toContain(target!.product_id);
    expect((await jsonRequest(harness, '/api/admin/health', { token: admin })).status).toBe(200);
    expect((await jsonRequest(harness, '/api/admin/launch-checks', { token: admin })).status).toBe(200);
    const legacyWrite = await jsonRequest(harness, `/api/admin/product-qa/${target!.product_id}`, {
      method: 'PATCH', token: admin, body: { shop_link: 'https://example.test/parallel-write' },
    });
    expect(legacyWrite.status).toBe(409);
    const createProduct = await jsonRequest(harness, '/api/admin/products', {
      method: 'POST', token: admin,
      body: {
        name: 'Kanonisches Zielprodukt', brand: 'Test', form: 'Kapseln', price: 19.9,
        shop_link: target!.url, moderation_status: 'approved', visibility: 'public',
        serving_size: 1, serving_unit: 'Portion', servings_per_container: 30, container_count: 1,
      },
    });
    const createdProduct = await createProduct.json() as { product: { id: number }; error?: string };
    expect(createProduct.status, createdProduct.error).toBe(201);
    const canonicalWrite = await db.prepare(`
      SELECT p.shop_link, p.is_affiliate, p.affiliate_owner_type,
        psl.link_kind, psl.url
      FROM products p JOIN product_shop_links psl ON psl.product_id = p.id
      WHERE p.id = ?
    `).bind(createdProduct.product.id).first<{ shop_link: string | null; is_affiliate: number; affiliate_owner_type: string; link_kind: string; url: string }>();
    expect(canonicalWrite).toMatchObject({ shop_link: null, is_affiliate: 0, affiliate_owner_type: 'none', link_kind: 'base_target', url: target!.url });

    harness.run(`
      INSERT INTO user_products (
        id, user_id, name, brand, form, price, shop_link, serving_size,
        serving_unit, servings_per_container, container_count, is_affiliate, status
      ) VALUES (900, 101, 'Nutzerprodukt ohne Affiliate', 'Test', 'Kapseln', 12.5, ?, 1, 'Portion', 30, 1, 0, 'pending')
    `, target!.url);
    harness.run(`
      INSERT INTO user_product_ingredients (
        user_product_id, ingredient_id, search_relevant, is_main
      ) VALUES (900, ?, 1, 1)
    `, ingredient!.ingredient_id);
    const publishUserProduct = await jsonRequest(harness, '/api/admin/user-products/900/publish', {
      method: 'PUT', token: admin, body: {},
    });
    const publishedUserProduct = await publishUserProduct.json() as { product?: { id: number }; error?: string };
    expect(publishUserProduct.status, publishedUserProduct.error).toBe(201);
    const userProductTarget = await db.prepare(`
      SELECT p.shop_link, p.is_affiliate, p.affiliate_owner_type, p.owner_party_id,
        psl.link_kind, psl.legacy_party_id, psl.is_affiliate AS target_is_affiliate,
        psl.affiliate_owner_type AS target_owner_type, psl.url,
        party.type AS owner_party_type
      FROM products p
      JOIN product_shop_links psl ON psl.product_id = p.id
      JOIN parties party ON party.id = p.owner_party_id
      WHERE p.source_user_product_id = 900
    `).first<{
      shop_link: string | null; is_affiliate: number; affiliate_owner_type: string;
      owner_party_id: number; link_kind: string; legacy_party_id: number | null;
      target_is_affiliate: number; target_owner_type: string; url: string;
      owner_party_type: string;
    }>();
    expect(userProductTarget).toMatchObject({
      shop_link: null,
      is_affiliate: 0,
      affiliate_owner_type: 'none',
      link_kind: 'base_target',
      legacy_party_id: null,
      target_is_affiliate: 0,
      target_owner_type: 'none',
      url: target!.url,
      owner_party_type: 'user',
    });

    const dashboard = await jsonRequest(harness, '/api/creator-sharing/dashboard?party_id=100', { token: creator });
    expect(dashboard.status).toBe(200);
    const dashboardPayload = await dashboard.json() as Record<string, unknown>;
    expect(dashboardPayload).not.toHaveProperty('users');
    expect(dashboardPayload).not.toHaveProperty('stack_ids');
    expect(dashboardPayload).not.toHaveProperty('referrers');
  });

  it('refuses redirects through an inactive frozen product target', async () => {
    const importer = await authToken(101, 'user', 'importer@test.invalid');
    const target = await db.prepare(`SELECT psl.id AS shop_link_id, psl.product_id FROM product_shop_links psl WHERE psl.link_kind = 'base_target' AND psl.active = 1 LIMIT 1`).first<{ shop_link_id: number; product_id: number }>();
    harness.run(`INSERT INTO stacks (id, user_id, name) VALUES (101, 101, 'Gebunden')`);
    harness.run(`INSERT INTO stack_items (id, stack_id, catalog_product_id, quantity, intake_interval_days) VALUES (101, 101, ?, 1, 1)`, target!.product_id);
    harness.run(`INSERT INTO stack_item_link_bindings (stack_item_id, shop_link_id, resolution_kind) VALUES (101, ?, 'bare')`, target!.shop_link_id);
    harness.run(`UPDATE product_shop_links SET active = 0 WHERE id = ?`, target!.shop_link_id);
    const response = await jsonRequest(harness, `/api/products/${target!.product_id}/out?stack_item_id=101`, { cookie: importer });
    expect(response.status).toBe(409);
  });
});

describe('creator sharing safety helpers', () => {
  it('rejects unsafe product URLs and unsafe affiliate templates', () => {
    expect(validateProductTargetUrl('javascript:alert(1)', 'shop.example').url).toBeUndefined();
    expect(validateProductTargetUrl('https://user:pass@shop.example/product', 'shop.example').url).toBeUndefined();
    expect(validateProductTargetUrl('https://evil.example/product', 'shop.example').url).toBeUndefined();
    expect(buildAffiliateUrl({ code: 'x', linkTemplate: 'https://evil.example/?u={url}&c={code}', productUrl: 'https://shop.example/p', shopDomain: 'shop.example', trackingDomain: 'tracking.example' }).url).toBeUndefined();
  });

  it('uses the central ingredient-specific IE conversion and blocks unknown conversions', () => {
    expect(convertAmount(1000, 'IE', 'µg', { name: 'Vitamin D3' })).toBe(25);
    expect(convertAmount(1000, 'IE', 'µg', { name: 'Unbekannter Stoff' })).toBeNull();
  });
});
