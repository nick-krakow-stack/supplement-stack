import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fetchCreatorSharingHono } from './creatorSharingHonoHandlers.mjs';
import { createProductionKnowledgeHonoHarness, type ProductionKnowledgeHonoHarness } from './productionKnowledgeHonoTestHarness';
import {
  buildAffiliateUrl,
  canonicalJson,
  parseCreatorShareSnapshot,
  snapshotHash,
  validateProductTargetUrl,
} from '../../../functions/api/lib/creator-sharing';
import { convertAmount } from '../../../functions/api/lib/units';
import { calculateProductUsage } from '../lib/stackCalculations';

const { sendMailMock } = vi.hoisted(() => ({
  sendMailMock: vi.fn(),
}));

vi.mock('../../../functions/api/lib/mail', () => ({
  sendMail: sendMailMock,
}));

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

async function preflightAndSave(
  harness: ProductionKnowledgeHonoHarness,
  token: string,
  auth: string,
  selection: Record<string, unknown>,
  write: Record<string, unknown>,
): Promise<{ preflight: Record<string, unknown>; response: Response }> {
  const preflightResponse = await jsonRequest(harness, `/api/creator-sharing/shares/${token}/preflight`, {
    method: 'POST', token: auth, body: selection,
  });
  expect(preflightResponse.status).toBe(200);
  const preflight = await preflightResponse.json() as Record<string, unknown>;
  const response = await jsonRequest(harness, `/api/creator-sharing/shares/${token}/import`, {
    method: 'POST', token: auth,
    body: {
      ...selection,
      ...write,
      preflight_fingerprint: preflight.preflight_fingerprint,
      expected_snapshot_hash: preflight.snapshot_hash,
    },
  });
  return { preflight, response };
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
    sendMailMock.mockReset();
    sendMailMock.mockResolvedValue({ ok: true });
    harness = createProductionKnowledgeHonoHarness();
    applyAllMigrations(harness);
    db = harness.db as TestDatabase;
    harness.run(`INSERT INTO users (id, email, password_hash, role, email_verified_at) VALUES (100, 'creator@test.invalid', 'x', 'user', CURRENT_TIMESTAMP)`);
    harness.run(`INSERT INTO users (id, email, password_hash, role, email_verified_at) VALUES (101, 'importer@test.invalid', 'x', 'user', CURRENT_TIMESTAMP)`);
    harness.run(`INSERT INTO users (id, email, password_hash, role, email_verified_at) VALUES (102, 'admin@test.invalid', 'x', 'admin', CURRENT_TIMESTAMP)`);
    harness.run(`INSERT INTO parties (id, type, name, slug, status, auto_catalog_approval) VALUES (100, 'creator', 'Test Creator', 'test-creator', 'active', 0)`);
    harness.run(`INSERT INTO party_memberships (party_id, user_id, role, status) VALUES (100, 100, 'owner', 'active')`);
    harness.run(`INSERT INTO stacks (id, user_id, name) VALUES (100, 100, 'Creator Stack')`);

    const target = await db.prepare(`
      SELECT psl.id AS shop_link_id, psl.product_id, psl.shop_domain_id
      FROM product_shop_links psl
      JOIN product_ingredients pi ON pi.product_id = psl.product_id AND pi.is_main = 1
      WHERE psl.link_kind = 'base_target' AND psl.active = 1 AND psl.shop_domain_id IS NOT NULL
      ORDER BY psl.id LIMIT 1
    `).first<{ shop_link_id: number; product_id: number; shop_domain_id: number }>();
    expect(target).not.toBeNull();
    harness.run(`INSERT INTO stack_items (id, stack_id, catalog_product_id, quantity, intake_interval_days, sort_order) VALUES (100, 100, ?, 1, 1, 0)`, target!.product_id);
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

  it('copies dosage defaults once and keeps a deliberate clear through PUT, GET, calculation and mail', async () => {
    const importer = await authToken(101, 'user', 'importer@test.invalid');
    const source = await db.prepare(`
      SELECT si.catalog_product_id AS product_id, pi.id AS product_ingredient_id, pi.ingredient_id
      FROM stack_items si
      JOIN product_ingredients pi ON pi.product_id = si.catalog_product_id AND pi.is_main = 1
      WHERE si.id = 100
    `).first<{ product_id: number; product_ingredient_id: number; ingredient_id: number }>();
    expect(source).not.toBeNull();

    harness.run(`
      UPDATE products
      SET dosage_text = '400 mg täglich', price = 30,
          serving_size = 1, serving_unit = 'Portion',
          servings_per_container = 30, container_count = 1
      WHERE id = ?
    `, source!.product_id);
    harness.run(`
      UPDATE product_ingredients
      SET quantity = 300, unit = 'mg', basis_quantity = 1, basis_unit = 'Portion'
      WHERE id = ?
    `, source!.product_ingredient_id);
    harness.run(`
      INSERT INTO user_products (
        id, user_id, name, price, serving_size, serving_unit,
        servings_per_container, container_count, dosage_text, status
      ) VALUES
        (901, 101, 'Eigenes Produkt mit Standard', 20, 1, 'Portion', 30, 1, '200 mg täglich', 'pending'),
        (902, 101, 'Eigenes Produkt bewusst ohne Zieltext', 10, 1, 'Portion', 30, 1, '100 mg täglich', 'pending')
    `);
    harness.run(`
      INSERT INTO user_product_ingredients (user_product_id, ingredient_id, is_main, search_relevant, quantity, unit, basis_quantity, basis_unit)
      VALUES
        (901, ?, 1, 1, 200, 'mg', 1, 'Portion'),
        (902, ?, 1, 1, 100, 'mg', 1, 'Portion')
    `, source!.ingredient_id, source!.ingredient_id);

    const createResponse = await jsonRequest(harness, '/api/stacks', {
      method: 'POST',
      token: importer,
      body: {
        name: 'Manueller Plan',
        product_ids: [
          { id: source!.product_id, product_type: 'catalog', quantity: 2 },
          { id: 901, product_type: 'user_product', quantity: 1 },
          { id: 902, product_type: 'user_product', quantity: 1, dosage_text: null },
        ],
      },
    });
    expect(createResponse.status).toBe(200);
    const created = await createResponse.json() as { id: number };
    const initialResponse = await jsonRequest(harness, `/api/stacks/${created.id}`, { token: importer });
    expect(initialResponse.status).toBe(200);
    const initial = await initialResponse.json() as {
      stack: { version: number };
      items: Array<{ stack_item_id: number; id: number; product_type: 'catalog' | 'user_product'; version: number; dosage_text: string | null }>;
    };
    const initialCatalog = initial.items.find((item) => item.product_type === 'catalog')!;
    expect(initialCatalog.dosage_text).toBe('400 mg täglich');
    expect(initial.items.find((item) => item.product_type === 'user_product' && item.id === 901)?.dosage_text).toBe('200 mg täglich');
    expect(initial.items.find((item) => item.product_type === 'user_product' && item.id === 902)?.dosage_text).toBeNull();

    const updateResponse = await jsonRequest(harness, `/api/stacks/${created.id}`, {
      method: 'PUT',
      token: importer,
      body: {
        expected_stack_version: initial.stack.version,
        expected_items: initial.items.map((item) => ({ stack_item_id: item.stack_item_id, expected_version: item.version })),
        product_ids: [
          {
            id: source!.product_id,
            product_type: 'catalog',
            quantity: 1,
            intake_interval_days: 2,
            dosage_text: null,
            timing: 'anytime',
            sort_order: 0,
          },
          { id: 901, product_type: 'user_product', quantity: 1, intake_interval_days: 1, sort_order: 1 },
          { id: 902, product_type: 'user_product', quantity: 1, intake_interval_days: 1, sort_order: 2 },
        ],
      },
    });
    expect(updateResponse.status).toBe(200);
    const updated = await updateResponse.json() as { items: Array<{
      stack_item_id: number;
      id: number;
      dosage_text: string | null;
      quantity: number;
      intake_interval_days: number;
      product_price: number;
      serving_size: number;
      serving_unit: string;
      servings_per_container: number;
      container_count: number;
      ingredients: Array<Record<string, unknown>>;
    }> };
    const updatedItem = updated.items.find((item) => item.stack_item_id === initialCatalog.stack_item_id)!;
    expect(updatedItem).toMatchObject({ dosage_text: null, quantity: 1, intake_interval_days: 2 });
    expect(updated.items.find((item) => item.id === 901)?.dosage_text).toBe('200 mg täglich');
    expect(updated.items.find((item) => item.id === 902)?.dosage_text).toBeNull();
    expect(calculateProductUsage(updatedItem, updatedItem.product_price)).toMatchObject({
      servingsPerIntake: 1,
      effectiveDailyUsage: 0.5,
      daysSupply: 60,
      monthlyCost: 15,
      calculationSource: 'manual_quantity',
    });

    const getResponse = await jsonRequest(harness, `/api/stacks/${created.id}`, { token: importer });
    expect(getResponse.status).toBe(200);
    const loaded = await getResponse.json() as { items: Array<{ stack_item_id: number; dosage_text: string | null }> };
    expect(loaded.items.find((item) => item.stack_item_id === initialCatalog.stack_item_id)?.dosage_text).toBeNull();
    expect(await db.prepare('SELECT dosage_text FROM stack_items WHERE id = ?').bind(initialCatalog.stack_item_id).first()).toEqual({ dosage_text: null });

    const mailResponse = await jsonRequest(harness, `/api/stacks/${created.id}/email`, { method: 'POST', token: importer });
    expect(mailResponse.status).toBe(200);
    const html = (sendMailMock.mock.calls[0][1] as { html: string }).html;
    expect(html).not.toContain('400 mg täglich');
  });

  it('returns exact public recovery states and prevents a save after the share becomes unavailable', async () => {
    const creator = await authToken(100, 'user', 'creator@test.invalid');
    const importer = await authToken(101, 'user', 'importer@test.invalid');
    const createdResponse = await jsonRequest(harness, '/api/creator-sharing/shares', {
      method: 'POST', token: creator,
      body: { party_id: 100, stack_id: 100, stack_item_id: 100, type: 'dose_recommendation', title: 'Statuswechsel' },
    });
    const share = await createdResponse.json() as { id: number; token: string };

    const pending = await jsonRequest(harness, `/api/creator-sharing/shares/${share.token}`);
    expect(pending.status).toBe(409);
    expect(await pending.json()).toMatchObject({ code: 'SHARE_PENDING' });

    harness.run(`UPDATE share_links SET moderation_status = 'approved', expires_at = strftime('%s', 'now') - 1 WHERE id = ?`, share.id);
    const expired = await jsonRequest(harness, `/api/creator-sharing/shares/${share.token}`);
    expect(expired.status).toBe(410);
    expect(await expired.json()).toMatchObject({ code: 'SHARE_EXPIRED' });

    harness.run(`UPDATE share_links SET moderation_status = 'blocked', expires_at = NULL WHERE id = ?`, share.id);
    const blocked = await jsonRequest(harness, `/api/creator-sharing/shares/${share.token}`);
    expect(blocked.status).toBe(410);
    expect(await blocked.json()).toEqual(expect.objectContaining({ code: 'SHARE_UNAVAILABLE' }));

    harness.run(`UPDATE share_links SET moderation_status = 'approved', is_revoked = 1 WHERE id = ?`, share.id);
    const revoked = await jsonRequest(harness, `/api/creator-sharing/shares/${share.token}`);
    expect(revoked.status).toBe(410);
    expect(await revoked.json()).toEqual(expect.objectContaining({ code: 'SHARE_UNAVAILABLE' }));

    const unknown = await jsonRequest(harness, '/api/creator-sharing/shares/unknownunknownunknownunknown');
    expect(unknown.status).toBe(404);
    expect(await unknown.json()).toMatchObject({ code: 'SHARE_UNKNOWN' });

    harness.run(`UPDATE share_links SET moderation_status = 'approved', is_revoked = 0, expires_at = NULL WHERE id = ?`, share.id);
    const selection = { target_mode: 'new', stack_name: 'Nicht mehr speichern' };
    const preflightResponse = await jsonRequest(harness, `/api/creator-sharing/shares/${share.token}/preflight`, {
      method: 'POST', token: importer, body: selection,
    });
    expect(preflightResponse.status).toBe(200);
    const preflight = await preflightResponse.json() as { preflight_fingerprint: string; snapshot_hash: string };
    harness.run(`UPDATE share_links SET is_revoked = 1 WHERE id = ?`, share.id);
    const beforeOperations = (await db.prepare('SELECT COUNT(*) AS count FROM share_import_operations').first<{ count: number }>())?.count;
    const save = await jsonRequest(harness, `/api/creator-sharing/shares/${share.token}/import`, {
      method: 'POST', token: importer,
      body: {
        ...selection,
        idempotency_key: 'share-status-race-no-write-0001',
        decision: 'add',
        preflight_fingerprint: preflight.preflight_fingerprint,
        expected_snapshot_hash: preflight.snapshot_hash,
      },
    });
    expect(save.status).toBe(410);
    expect(await save.json()).toMatchObject({ code: 'SHARE_UNAVAILABLE' });
    expect((await db.prepare('SELECT COUNT(*) AS count FROM share_import_operations').first<{ count: number }>())?.count).toBe(beforeOperations);
    expect((await db.prepare('SELECT imports FROM share_links WHERE id = ?').bind(share.id).first<{ imports: number }>())?.imports).toBe(0);
  });

  it('fails closed instead of saving a partial stack and identifies products that need attention', async () => {
    const creator = await authToken(100, 'user', 'creator@test.invalid');
    const source = await db.prepare(`
      SELECT si.catalog_product_id AS product_id, pi.ingredient_id
      FROM stack_items si
      JOIN product_ingredients pi ON pi.product_id = si.catalog_product_id AND pi.is_main = 1
      WHERE si.id = 100 LIMIT 1
    `).first<{ product_id: number; ingredient_id: number }>();
    const platform = await db.prepare(`SELECT id FROM parties WHERE slug = 'platform'`).first<{ id: number }>();
    harness.run(`INSERT INTO products (id, name, price, moderation_status, visibility, owner_party_id) VALUES (998, 'Produkt ohne Shop-Link', 1, 'approved', 'public', ?)`, platform!.id);
    harness.run(`INSERT INTO product_ingredients (product_id, ingredient_id, is_main, quantity, unit) VALUES (998, ?, 1, 1, 'mg')`, source!.ingredient_id);
    harness.run(`INSERT INTO stack_items (id, stack_id, catalog_product_id, quantity, intake_interval_days, sort_order) VALUES (101, 100, 998, 1, 1, 1)`);

    const readiness = await jsonRequest(harness, '/api/creator-sharing/stacks/100/share-readiness?party_id=100', { token: creator });
    expect(readiness.status).toBe(200);
    expect(await readiness.json()).toMatchObject({
      ready: false,
      shareable_stack_item_ids: [100],
      unshareable_products: [{ stack_item_id: 101, product_name: 'Produkt ohne Shop-Link' }],
    });

    const incomplete = await jsonRequest(harness, '/api/creator-sharing/shares', {
      method: 'POST', token: creator,
      body: { party_id: 100, stack_id: 100, type: 'stack', title: 'Darf nicht teilweise entstehen' },
    });
    expect(incomplete.status).toBe(409);
    expect(await incomplete.json()).toMatchObject({
      code: 'STACK_NOT_FULLY_SHAREABLE',
      products: [{ stack_item_id: 101, product_name: 'Produkt ohne Shop-Link' }],
    });
    expect((await db.prepare(`SELECT COUNT(*) AS count FROM share_links`).first<{ count: number }>())?.count).toBe(0);

    const single = await jsonRequest(harness, '/api/creator-sharing/shares', {
      method: 'POST', token: creator,
      body: { party_id: 100, stack_id: 100, stack_item_id: 100, type: 'dose_recommendation', title: 'Teilbares Produkt' },
    });
    expect(single.status).toBe(201);

  });

  it('builds a write-free preflight and exposes a private note only to its owner', async () => {
    const creator = await authToken(100, 'user', 'creator@test.invalid');
    const importer = await authToken(101, 'user', 'importer@test.invalid');
    harness.run(`INSERT INTO users (id, email, password_hash, role, email_verified_at) VALUES (103, 'other@test.invalid', 'x', 'user', CURRENT_TIMESTAMP)`);
    const other = await authToken(103, 'user', 'other@test.invalid');
    const source = await db.prepare(`
      SELECT si.catalog_product_id AS product_id, pi.ingredient_id
      FROM stack_items si
      JOIN product_ingredients pi ON pi.product_id = si.catalog_product_id AND pi.is_main = 1
      WHERE si.id = 100 LIMIT 1
    `).first<{ product_id: number; ingredient_id: number }>();
    expect(source).not.toBeNull();

    const created = await jsonRequest(harness, '/api/creator-sharing/shares', {
      method: 'POST', token: creator,
      body: { party_id: 100, stack_id: 100, stack_item_id: 100, type: 'dose_recommendation', title: 'Meine Empfehlung' },
    });
    const share = await created.json() as { id: number; token: string };
    harness.run(`UPDATE share_links SET moderation_status = 'approved' WHERE id = ?`, share.id);
    harness.run(`INSERT INTO stacks (id, user_id, name) VALUES (101, 101, 'Mein Ziel')`);
    harness.run(`
      INSERT INTO user_products (id, user_id, name, serving_unit, notes)
      VALUES (501, 101, 'Mein eigenes Produkt', 'Tablette', 'Nur für mich sichtbar')
    `);
    harness.run(`INSERT INTO user_product_ingredients (id, user_product_id, ingredient_id, is_main) VALUES (501, 501, ?, 1)`, source!.ingredient_id);
    harness.run(`
      INSERT INTO stack_items (
        id, stack_id, catalog_product_id, user_product_id, quantity,
        intake_interval_days, dosage_text, timing, sort_order, version
      ) VALUES (501, 101, NULL, 501, 2, 2, 'Zwei Tabletten', 'morgens', 8, 3)
    `);

    const publicPreview = await jsonRequest(harness, `/api/creator-sharing/shares/${share.token}`);
    expect(publicPreview.status).toBe(200);
    expect(JSON.stringify(await publicPreview.json())).not.toContain('Nur für mich sichtbar');
    const before = await db.prepare(`
      SELECT
        (SELECT COUNT(*) FROM share_import_operations) AS operations,
        (SELECT COUNT(*) FROM stacks WHERE user_id = 101) AS stacks,
        (SELECT COUNT(*) FROM stack_items WHERE stack_id = 101) AS items,
        (SELECT imports FROM share_links WHERE id = ?) AS imports
    `).bind(share.id).first<{ operations: number; stacks: number; items: number; imports: number }>();

    const preflightResponse = await jsonRequest(harness, `/api/creator-sharing/shares/${share.token}/preflight`, {
      method: 'POST', token: importer,
      body: { target_mode: 'existing', target_stack_id: 101 },
    });
    expect(preflightResponse.status).toBe(200);
    const preflight = await preflightResponse.json() as {
      main_ingredient_names: string[];
      preflight_fingerprint: string;
      similar_products: Array<{ stack_item_id: number; version: number; private_note: string | null; main_ingredient_names: string[] }>;
    };
    expect(preflight.preflight_fingerprint).toMatch(/^[a-f0-9]{64}$/);
    expect(preflight.main_ingredient_names.length).toBeGreaterThan(0);
    expect(preflight.similar_products).toEqual([expect.objectContaining({
      stack_item_id: 501,
      version: 3,
      private_note: 'Nur für mich sichtbar',
      main_ingredient_names: preflight.main_ingredient_names,
    })]);
    const after = await db.prepare(`
      SELECT
        (SELECT COUNT(*) FROM share_import_operations) AS operations,
        (SELECT COUNT(*) FROM stacks WHERE user_id = 101) AS stacks,
        (SELECT COUNT(*) FROM stack_items WHERE stack_id = 101) AS items,
        (SELECT imports FROM share_links WHERE id = ?) AS imports
    `).bind(share.id).first<{ operations: number; stacks: number; items: number; imports: number }>();
    expect(after).toEqual(before);

    const foreign = await jsonRequest(harness, `/api/creator-sharing/shares/${share.token}/preflight`, {
      method: 'POST', token: other,
      body: { target_mode: 'existing', target_stack_id: 101 },
    });
    expect(foreign.status).toBe(409);
    expect(JSON.stringify(await foreign.json())).not.toContain('Nur für mich sichtbar');
  });

  it('keeps without counting and replaces only the chosen stack entry while retaining the own product', async () => {
    const creator = await authToken(100, 'user', 'creator@test.invalid');
    const importer = await authToken(101, 'user', 'importer@test.invalid');
    const source = await db.prepare(`
      SELECT si.catalog_product_id AS product_id, pi.ingredient_id
      FROM stack_items si JOIN product_ingredients pi ON pi.product_id = si.catalog_product_id AND pi.is_main = 1
      WHERE si.id = 100 LIMIT 1
    `).first<{ product_id: number; ingredient_id: number }>();
    const created = await jsonRequest(harness, '/api/creator-sharing/shares', {
      method: 'POST', token: creator,
      body: { party_id: 100, stack_id: 100, stack_item_id: 100, type: 'dose_recommendation', title: 'Ein Produkt' },
    });
    const share = await created.json() as { id: number; token: string };
    harness.run(`UPDATE share_links SET moderation_status = 'approved' WHERE id = ?`, share.id);
    harness.run(`INSERT INTO stacks (id, user_id, name) VALUES (101, 101, 'Zielstack')`);
    harness.run(`INSERT INTO user_products (id, user_id, name, serving_unit, notes) VALUES (501, 101, 'Eigenes Magnesium', 'Tablette', 'Private Erinnerung')`);
    harness.run(`INSERT INTO user_product_ingredients (id, user_product_id, ingredient_id, is_main) VALUES (501, 501, ?, 1)`, source!.ingredient_id);
    harness.run(`
      INSERT INTO stack_items (
        id, stack_id, catalog_product_id, user_product_id, quantity,
        intake_interval_days, dosage_text, timing, sort_order, version
      ) VALUES (501, 101, NULL, 501, 2, 2, 'Zwei Tabletten', 'abends', 8, 3)
    `);

    const selection = { target_mode: 'existing', target_stack_id: 101 };
    const keepPreflightResponse = await jsonRequest(harness, `/api/creator-sharing/shares/${share.token}/preflight`, {
      method: 'POST', token: importer, body: selection,
    });
    const keepPreflight = await keepPreflightResponse.json() as {
      preflight_fingerprint: string;
      snapshot_hash: string;
      similar_products: Array<{ stack_item_id: number; version: number }>;
    };
    const candidate = keepPreflight.similar_products[0];
    const keep = await jsonRequest(harness, `/api/creator-sharing/shares/${share.token}/import`, {
      method: 'POST', token: importer,
      body: {
        ...selection,
        idempotency_key: 'keep-without-counting-0001',
        decision: 'keep',
        selected_stack_item_id: candidate.stack_item_id,
        expected_stack_item_version: candidate.version,
        preflight_fingerprint: keepPreflight.preflight_fingerprint,
        expected_snapshot_hash: keepPreflight.snapshot_hash,
      },
    });
    expect(keep.status).toBe(200);
    expect(await keep.json()).toMatchObject({ action: 'kept_existing', existing_product_name: 'Eigenes Magnesium' });
    expect((await db.prepare('SELECT COUNT(*) AS count FROM share_import_operations').first<{ count: number }>())?.count).toBe(0);
    expect((await db.prepare('SELECT imports FROM share_links WHERE id = ?').bind(share.id).first<{ imports: number }>())?.imports).toBe(0);
    expect(await db.prepare('SELECT user_product_id, sort_order, version FROM stack_items WHERE id = 501').first()).toMatchObject({
      user_product_id: 501, sort_order: 8, version: 3,
    });

    const replacePreflightResponse = await jsonRequest(harness, `/api/creator-sharing/shares/${share.token}/preflight`, {
      method: 'POST', token: importer, body: selection,
    });
    const replacePreflight = await replacePreflightResponse.json() as typeof keepPreflight;
    const replaceCandidate = replacePreflight.similar_products[0];
    const replaceBody = {
      ...selection,
      idempotency_key: 'replace-one-entry-0001',
      decision: 'replace',
      selected_stack_item_id: replaceCandidate.stack_item_id,
      expected_stack_item_version: replaceCandidate.version,
      preflight_fingerprint: replacePreflight.preflight_fingerprint,
      expected_snapshot_hash: replacePreflight.snapshot_hash,
    };
    const replace = await jsonRequest(harness, `/api/creator-sharing/shares/${share.token}/import`, {
      method: 'POST', token: importer, body: replaceBody,
    });
    expect(replace.status).toBe(200);
    expect(await replace.json()).toMatchObject({
      action: 'replaced', replaced_product_name: 'Eigenes Magnesium', replaced_user_product_retained: true,
    });
    expect(await db.prepare(`
      SELECT catalog_product_id, user_product_id, sort_order, version,
        quantity, intake_interval_days, dosage_text, timing
      FROM stack_items WHERE id = 501
    `).first()).toMatchObject({
      catalog_product_id: source!.product_id,
      user_product_id: null,
      sort_order: 8,
      version: 4,
      quantity: 1,
      intake_interval_days: 1,
    });
    expect(await db.prepare('SELECT name, notes FROM user_products WHERE id = 501').first()).toMatchObject({
      name: 'Eigenes Magnesium', notes: 'Private Erinnerung',
    });
    expect((await db.prepare('SELECT COUNT(*) AS count FROM share_import_operations').first<{ count: number }>())?.count).toBe(1);
    expect((await db.prepare('SELECT imports FROM share_links WHERE id = ?').bind(share.id).first<{ imports: number }>())?.imports).toBe(1);
    const replay = await jsonRequest(harness, `/api/creator-sharing/shares/${share.token}/import`, {
      method: 'POST', token: importer, body: replaceBody,
    });
    expect(replay.status).toBe(200);
    expect((await replay.json() as { idempotent_replay: boolean }).idempotent_replay).toBe(true);
    expect((await db.prepare('SELECT imports FROM share_links WHERE id = ?').bind(share.id).first<{ imports: number }>())?.imports).toBe(1);
  });

  it('creates the first target stack atomically, allows the same name and rejects stale preflight state', async () => {
    const creator = await authToken(100, 'user', 'creator@test.invalid');
    const importer = await authToken(101, 'user', 'importer@test.invalid');
    const doseResponse = await jsonRequest(harness, '/api/creator-sharing/shares', {
      method: 'POST', token: creator,
      body: { party_id: 100, stack_id: 100, stack_item_id: 100, type: 'dose_recommendation', title: 'Erste Empfehlung' },
    });
    const dose = await doseResponse.json() as { id: number; token: string };
    harness.run(`UPDATE share_links SET moderation_status = 'approved' WHERE id = ?`, dose.id);
    const firstSave = await preflightAndSave(
      harness,
      dose.token,
      importer,
      { target_mode: 'new', stack_name: 'Mein erster Stack' },
      { idempotency_key: 'first-stack-atomic-save-0001', decision: 'add' },
    );
    expect(firstSave.response.status).toBe(201);
    const firstResult = await firstSave.response.json() as { stack_id: number; action: string; created_stack: boolean };
    expect(firstResult).toMatchObject({ action: 'added', created_stack: true });
    expect(await db.prepare(`
      SELECT stack.name, item.source_share_link_id, binding.stack_item_id
      FROM stacks stack
      JOIN stack_items item ON item.stack_id = stack.id
      JOIN stack_item_link_bindings binding ON binding.stack_item_id = item.id
      WHERE stack.id = ?
    `).bind(firstResult.stack_id).first()).toMatchObject({
      name: 'Mein erster Stack', source_share_link_id: dose.id,
    });
    expect((await db.prepare('SELECT imports FROM share_links WHERE id = ?').bind(dose.id).first<{ imports: number }>())?.imports).toBe(1);

    const stackResponse = await jsonRequest(harness, '/api/creator-sharing/shares', {
      method: 'POST', token: creator,
      body: { party_id: 100, stack_id: 100, type: 'stack', title: 'Portfolio des Creators' },
    });
    const fullStack = await stackResponse.json() as { id: number; token: string };
    harness.run(`UPDATE share_links SET moderation_status = 'approved' WHERE id = ?`, fullStack.id);
    const sameNamePreflightResponse = await jsonRequest(harness, `/api/creator-sharing/shares/${fullStack.token}/preflight`, {
      method: 'POST', token: importer, body: { stack_name: 'Mein erster Stack' },
    });
    const sameNamePreflight = await sameNamePreflightResponse.json() as {
      preflight_fingerprint: string;
      snapshot_hash: string;
      target: { name_already_used: boolean; suggested_stack_name: string };
    };
    expect(sameNamePreflight.target).toMatchObject({
      name_already_used: true,
      suggested_stack_name: 'Mein erster Stack – von Test Creator',
    });
    const sameNameSave = await jsonRequest(harness, `/api/creator-sharing/shares/${fullStack.token}/import`, {
      method: 'POST', token: importer,
      body: {
        idempotency_key: 'same-name-full-stack-0001',
        stack_name: 'Mein erster Stack',
        preflight_fingerprint: sameNamePreflight.preflight_fingerprint,
        expected_snapshot_hash: sameNamePreflight.snapshot_hash,
      },
    });
    expect(sameNameSave.status).toBe(201);
    expect((await db.prepare(`SELECT COUNT(*) AS count FROM stacks WHERE user_id = 101 AND name = 'Mein erster Stack'`).first<{ count: number }>())?.count).toBe(2);

    const stalePreflightResponse = await jsonRequest(harness, `/api/creator-sharing/shares/${dose.token}/preflight`, {
      method: 'POST', token: importer,
      body: { target_mode: 'existing', target_stack_id: firstResult.stack_id },
    });
    const stalePreflight = await stalePreflightResponse.json() as { preflight_fingerprint: string; snapshot_hash: string };
    harness.run(`UPDATE stack_items SET version = version + 1 WHERE stack_id = ?`, firstResult.stack_id);
    const beforeOperations = (await db.prepare('SELECT COUNT(*) AS count FROM share_import_operations').first<{ count: number }>())?.count;
    const beforeImports = (await db.prepare('SELECT imports FROM share_links WHERE id = ?').bind(dose.id).first<{ imports: number }>())?.imports;
    const staleSave = await jsonRequest(harness, `/api/creator-sharing/shares/${dose.token}/import`, {
      method: 'POST', token: importer,
      body: {
        target_mode: 'existing',
        target_stack_id: firstResult.stack_id,
        idempotency_key: 'stale-preflight-no-write-0001',
        decision: 'add',
        preflight_fingerprint: stalePreflight.preflight_fingerprint,
        expected_snapshot_hash: stalePreflight.snapshot_hash,
      },
    });
    expect(staleSave.status).toBe(409);
    expect(await staleSave.json()).toMatchObject({ code: 'PREFLIGHT_CHANGED' });
    expect((await db.prepare('SELECT COUNT(*) AS count FROM share_import_operations').first<{ count: number }>())?.count).toBe(beforeOperations);
    expect((await db.prepare('SELECT imports FROM share_links WHERE id = ?').bind(dose.id).first<{ imports: number }>())?.imports).toBe(beforeImports);
  });

  it('leaves id sequences and import data untouched when the share becomes stale at the batch boundary', async () => {
    const creator = await authToken(100, 'user', 'creator@test.invalid');
    const importer = await authToken(101, 'user', 'importer@test.invalid');
    const created = await jsonRequest(harness, '/api/creator-sharing/shares', {
      method: 'POST', token: creator,
      body: { party_id: 100, stack_id: 100, type: 'stack', title: 'Atomarer Stack' },
    });
    const share = await created.json() as { id: number; token: string };
    harness.run(`UPDATE share_links SET moderation_status = 'approved' WHERE id = ?`, share.id);
    const selection = { stack_name: 'Darf nicht entstehen' };
    const preflightResponse = await jsonRequest(harness, `/api/creator-sharing/shares/${share.token}/preflight`, {
      method: 'POST', token: importer, body: selection,
    });
    expect(preflightResponse.status).toBe(200);
    const preflight = await preflightResponse.json() as { preflight_fingerprint: string; snapshot_hash: string };
    const sequenceBefore = await db.prepare(`
      SELECT name, seq FROM sqlite_sequence
      WHERE name IN ('stacks', 'stack_items') ORDER BY name
    `).all<{ name: string; seq: number }>();
    const stacksBefore = (await db.prepare('SELECT COUNT(*) AS count FROM stacks WHERE user_id = 101').first<{ count: number }>())?.count;

    const hookedDb = harness.db as {
      batch: (statements: unknown[]) => Promise<unknown[]>;
    };
    const originalBatch = hookedDb.batch.bind(hookedDb);
    let intercepted = false;
    hookedDb.batch = async (statements) => {
      if (!intercepted) {
        intercepted = true;
        harness.run(`UPDATE share_links SET is_revoked = 1 WHERE id = ?`, share.id);
      }
      return originalBatch(statements);
    };

    const save = await jsonRequest(harness, `/api/creator-sharing/shares/${share.token}/import`, {
      method: 'POST', token: importer,
      body: {
        ...selection,
        idempotency_key: 'stale-at-batch-boundary-0001',
        preflight_fingerprint: preflight.preflight_fingerprint,
        expected_snapshot_hash: preflight.snapshot_hash,
      },
    });
    hookedDb.batch = originalBatch;

    expect(intercepted).toBe(true);
    expect(save.status).toBe(409);
    expect(await save.json()).toMatchObject({ code: 'PREFLIGHT_CHANGED' });
    expect(await db.prepare(`
      SELECT name, seq FROM sqlite_sequence
      WHERE name IN ('stacks', 'stack_items') ORDER BY name
    `).all<{ name: string; seq: number }>()).toEqual(sequenceBefore);
    expect((await db.prepare('SELECT COUNT(*) AS count FROM stacks WHERE user_id = 101').first<{ count: number }>())?.count).toBe(stacksBefore);
    expect((await db.prepare('SELECT COUNT(*) AS count FROM share_import_operations').first<{ count: number }>())?.count).toBe(0);
    expect((await db.prepare('SELECT imports FROM share_links WHERE id = ?').bind(share.id).first<{ imports: number }>())?.imports).toBe(0);
  });

  it('claims a parallel same-key save exactly once without a second mutation or counter increment', async () => {
    const creator = await authToken(100, 'user', 'creator@test.invalid');
    const importer = await authToken(101, 'user', 'importer@test.invalid');
    const created = await jsonRequest(harness, '/api/creator-sharing/shares', {
      method: 'POST', token: creator,
      body: { party_id: 100, stack_id: 100, stack_item_id: 100, type: 'dose_recommendation', title: 'Einmal speichern' },
    });
    const share = await created.json() as { id: number; token: string };
    harness.run(`UPDATE share_links SET moderation_status = 'approved' WHERE id = ?`, share.id);
    harness.run(`INSERT INTO stacks (id, user_id, name) VALUES (101, 101, 'Paralleles Ziel')`);
    const selection = { target_mode: 'existing', target_stack_id: 101 };
    const preflightResponse = await jsonRequest(harness, `/api/creator-sharing/shares/${share.token}/preflight`, {
      method: 'POST', token: importer, body: selection,
    });
    const preflight = await preflightResponse.json() as { preflight_fingerprint: string; snapshot_hash: string };
    const body = {
      ...selection,
      idempotency_key: 'parallel-same-key-save-0001',
      decision: 'add',
      preflight_fingerprint: preflight.preflight_fingerprint,
      expected_snapshot_hash: preflight.snapshot_hash,
    };

    const [first, second] = await Promise.all([
      jsonRequest(harness, `/api/creator-sharing/shares/${share.token}/import`, { method: 'POST', token: importer, body }),
      jsonRequest(harness, `/api/creator-sharing/shares/${share.token}/import`, { method: 'POST', token: importer, body }),
    ]);
    const responses = [first, second];
    const payloads = await Promise.all(responses.map(async (response) => ({
      status: response.status,
      body: await response.json() as Record<string, unknown>,
    })));

    expect(payloads.every((entry) => entry.status === 200 || entry.status === 201)).toBe(true);
    expect(payloads.filter((entry) => entry.body.idempotent_replay === true)).toHaveLength(1);
    expect(payloads.map((entry) => entry.body.stack_item_id)).toEqual([expect.any(Number), expect.any(Number)]);
    expect(payloads[0].body.stack_item_id).toBe(payloads[1].body.stack_item_id);
    expect(JSON.stringify(payloads)).not.toContain('__attempt_nonce');
    expect((await db.prepare('SELECT COUNT(*) AS count FROM share_import_operations WHERE idempotency_key = ?')
      .bind(body.idempotency_key).first<{ count: number }>())?.count).toBe(1);
    expect((await db.prepare('SELECT COUNT(*) AS count FROM stack_items WHERE stack_id = 101').first<{ count: number }>())?.count).toBe(1);
    expect((await db.prepare(`
      SELECT COUNT(*) AS count FROM stack_item_link_bindings binding
      JOIN stack_items item ON item.id = binding.stack_item_id WHERE item.stack_id = 101
    `).first<{ count: number }>())?.count).toBe(1);
    expect((await db.prepare('SELECT imports FROM share_links WHERE id = ?').bind(share.id).first<{ imports: number }>())?.imports).toBe(1);
  });

  it('keeps v1 snapshot hashes and imports compatible while new previews can expose an honest missing unit', async () => {
    const importer = await authToken(101, 'user', 'importer@test.invalid');
    const source = await db.prepare(`
      SELECT si.catalog_product_id AS product_id, psl.id AS shop_link_id
      FROM stack_items si
      JOIN product_shop_links psl ON psl.product_id = si.catalog_product_id
      WHERE si.id = 100 AND psl.active = 1 AND psl.blocked_at IS NULL
      ORDER BY psl.is_primary DESC, psl.id LIMIT 1
    `).first<{ product_id: number; shop_link_id: number }>();
    const ingredients = await db.prepare(`
      SELECT ingredient_id FROM product_ingredients
      WHERE product_id = ? AND is_main = 1 ORDER BY ingredient_id
    `).bind(source!.product_id).all<{ ingredient_id: number }>();
    const v1 = {
      schema_version: 1 as const,
      type: 'stack' as const,
      creator_party_id: 100,
      published_at: '2026-08-07T08:00:00.000Z',
      title: 'Historische Empfehlung',
      items: [{
        catalog_product_id: source!.product_id,
        shop_link_id: source!.shop_link_id,
        link_binding: { resolution_kind: 'bare' as const, affiliate_version_id: null, resolved_party_id: null },
        main_ingredient_ids: ingredients.results.map((item) => item.ingredient_id),
        quantity: 1,
        intake_interval_days: 1,
        dosage_text: null,
        timing: null,
        creator_statement: null,
        sort_order: 0,
        category_name: 'Historische Kategorie',
      }],
    };
    const parsed = parseCreatorShareSnapshot(v1);
    expect(parsed.error).toBeUndefined();
    expect(canonicalJson(parsed.value)).toBe(canonicalJson(v1));
    expect(Object.prototype.hasOwnProperty.call(parsed.value!.items[0], 'unit')).toBe(false);
    const hash = await snapshotHash(parsed.value!);
    const token = 'legacyv1snapshotabcdefghijklmn';
    harness.run(`
      INSERT INTO share_links (
        token, entity_type, entity_id, snapshot_json, creator_user_id, creator_party_id,
        snapshot_schema_version, snapshot_hash, moderation_status, is_revoked
      ) VALUES (?, 'stack', 100, ?, 100, 100, 1, ?, 'approved', 0)
    `, token, canonicalJson(v1), hash);

    const publicPreview = await jsonRequest(harness, `/api/creator-sharing/shares/${token}`);
    expect(publicPreview.status).toBe(200);
    const publicPayload = await publicPreview.json() as { items: Array<Record<string, unknown>> };
    expect(publicPayload.items[0].unit).toBeNull();
    expect(Object.prototype.hasOwnProperty.call(publicPayload.items[0], 'category_name')).toBe(false);
    const { response: imported } = await preflightAndSave(
      harness,
      token,
      importer,
      { stack_name: 'Historischer Stack' },
      { idempotency_key: 'legacy-v1-import-operation-0001' },
    );
    expect(imported.status).toBe(201);
  });

  it('creates a new immutable link only while the guarded source recommendation is unchanged', async () => {
    const creator = await authToken(100, 'user', 'creator@test.invalid');
    const originalResponse = await jsonRequest(harness, '/api/creator-sharing/shares', {
      method: 'POST', token: creator,
      body: { party_id: 100, stack_id: 100, type: 'stack', title: 'Ursprüngliche Empfehlung' },
    });
    expect(originalResponse.status).toBe(201);
    const original = await originalResponse.json() as { id: number; token: string; snapshot_hash: string };
    harness.run(`UPDATE share_links SET moderation_status = 'blocked' WHERE id = ?`, original.id);
    const oldBefore = await db.prepare(`
      SELECT token, snapshot_json, snapshot_hash, moderation_status, is_revoked, expires_at
      FROM share_links WHERE id = ?
    `).bind(original.id).first<Record<string, unknown>>();
    const guard = {
      share_id: original.id,
      expected_snapshot_hash: original.snapshot_hash,
      expected_status: 'blocked',
      expected_moderation_status: 'blocked',
      expected_is_revoked: 0,
      expected_expires_at: null,
    };

    const matching = await jsonRequest(harness, '/api/creator-sharing/shares', {
      method: 'POST', token: creator,
      body: {
        party_id: 100,
        stack_id: 100,
        type: 'stack',
        title: 'Überarbeitete Empfehlung',
        source_share_guard: guard,
      },
    });
    expect(matching.status).toBe(201);
    const created = await matching.json() as { id: number; token: string };
    expect(created.id).not.toBe(original.id);
    expect(created.token).not.toBe(original.token);
    expect(await db.prepare(`
      SELECT token, snapshot_json, snapshot_hash, moderation_status, is_revoked, expires_at
      FROM share_links WHERE id = ?
    `).bind(original.id).first<Record<string, unknown>>()).toEqual(oldBefore);
    expect(await db.prepare(`SELECT moderation_status, is_revoked FROM share_links WHERE id = ?`).bind(created.id).first()).toMatchObject({
      moderation_status: 'pending',
      is_revoked: 0,
    });
    expect((await db.prepare(`SELECT COUNT(*) AS count FROM share_links`).first<{ count: number }>())?.count).toBe(2);

    harness.run(`UPDATE share_links SET moderation_status = 'approved' WHERE id = ?`, original.id);
    const staleStatus = await jsonRequest(harness, '/api/creator-sharing/shares', {
      method: 'POST', token: creator,
      body: {
        party_id: 100,
        stack_id: 100,
        type: 'stack',
        title: 'Darf nicht entstehen',
        source_share_guard: guard,
      },
    });
    expect(staleStatus.status).toBe(409);
    expect(await staleStatus.json()).toMatchObject({ code: 'SOURCE_SHARE_CHANGED' });
    expect((await db.prepare(`SELECT COUNT(*) AS count FROM share_links`).first<{ count: number }>())?.count).toBe(2);

    harness.run(`INSERT INTO parties (id, type, name, slug, status, auto_catalog_approval) VALUES (200, 'creator', 'Andere Partei', 'andere-partei', 'active', 0)`);
    harness.run(`INSERT INTO party_memberships (party_id, user_id, role, status) VALUES (200, 100, 'owner', 'active')`);
    harness.run(`UPDATE share_links SET moderation_status = 'blocked' WHERE id = ?`, original.id);
    const foreignParty = await jsonRequest(harness, '/api/creator-sharing/shares', {
      method: 'POST', token: creator,
      body: {
        party_id: 200,
        stack_id: 100,
        type: 'stack',
        title: 'Falsche Partei',
        source_share_guard: guard,
      },
    });
    expect(foreignParty.status).toBe(409);
    expect((await db.prepare(`SELECT COUNT(*) AS count FROM share_links`).first<{ count: number }>())?.count).toBe(2);
  });

  it('freezes attribution, imports idempotently, exports the canonical creator mail and tracks without user or stack ids', async () => {
    const creator = await authToken(100, 'user', 'creator@test.invalid');
    const importer = await authToken(101, 'user', 'importer@test.invalid');
    const admin = await authToken(102, 'admin', 'admin@test.invalid');
    const creatorProduct = await db.prepare(`SELECT catalog_product_id AS id FROM stack_items WHERE id = 100`).first<{ id: number }>();
    harness.run(`UPDATE products SET serving_unit = 'Kapsel' WHERE id = ?`, creatorProduct!.id);
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
    const pendingPublic = await jsonRequest(harness, `/api/creator-sharing/shares/${created.token}`);
    expect(pendingPublic.status).toBe(409);
    expect(await pendingPublic.json()).toMatchObject({ code: 'SHARE_PENDING' });

    const moderation = await jsonRequest(harness, `/api/admin/creator-sharing/shares/${created.id}`, {
      method: 'PATCH', token: admin,
      body: { expected_status: 'pending', expected_snapshot_hash: created.snapshot_hash, moderation_status: 'approved', is_revoked: 0 },
    });
    expect(moderation.status).toBe(200);
    const previewResponse = await jsonRequest(harness, `/api/creator-sharing/shares/${created.token}`);
    expect(previewResponse.status).toBe(200);
    const preview = await previewResponse.json() as { creator: { name: string }; disclosure: string; items: Array<{ creator_statement: string; unit: string | null }> };
    expect(preview.creator.name).toBe('Test Creator');
    expect(preview.disclosure).toContain('Affiliate');
    expect(preview.items[0].creator_statement).toContain('Sachlicher Kontext');
    expect(preview.items[0].unit).toBe('Kapsel');
    const storedV3 = await db.prepare(`SELECT snapshot_schema_version, snapshot_json FROM share_links WHERE id = ?`).bind(created.id).first<{ snapshot_schema_version: number; snapshot_json: string }>();
    expect(storedV3?.snapshot_schema_version).toBe(3);
    const storedSnapshot = JSON.parse(storedV3?.snapshot_json ?? '{}') as {
      published_at: string;
      items: Array<Record<string, unknown>>;
    };
    expect(storedSnapshot.items[0].unit).toBe('Kapsel');
    expect(Object.prototype.hasOwnProperty.call(storedSnapshot.items[0], 'category_name')).toBe(false);

    const target = await db.prepare(`SELECT shop_domain_id FROM party_shop_affiliate_versions WHERE id = 100`).first<{ shop_domain_id: number }>();
    harness.run(`UPDATE party_shop_affiliate_versions SET status = 'retired' WHERE id = 100`);
    harness.run(`INSERT INTO party_shop_affiliate_versions (party_id, shop_domain_id, version, code, link_template, status) VALUES (100, ?, 2, 'creator-v2', '{url}?creator={code}', 'current')`, target!.shop_domain_id);

    const importBody = { idempotency_key: 'creator-import-operation-0001', stack_name: 'Importierter Stack' };
    const saved = await preflightAndSave(harness, created.token, importer, { stack_name: importBody.stack_name }, importBody);
    const firstImport = saved.response;
    expect(firstImport.status).toBe(201);
    const imported = await firstImport.json() as { stack_id: number };
    const replay = await jsonRequest(harness, `/api/creator-sharing/shares/${created.token}/import`, {
      method: 'POST', token: importer,
      body: {
        ...importBody,
        preflight_fingerprint: saved.preflight.preflight_fingerprint,
        expected_snapshot_hash: saved.preflight.snapshot_hash,
      },
    });
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

    const description = await jsonRequest(harness, `/api/stacks/${imported.stack_id}`, {
      method: 'PUT',
      token: importer,
      body: { description: 'Meine persönliche Notiz zum importierten Stack.' },
    });
    expect(description.status).toBe(200);
    const mailResponse = await jsonRequest(harness, `/api/stacks/${imported.stack_id}/email`, {
      method: 'POST',
      token: importer,
    });
    expect(mailResponse.status).toBe(200);
    expect(sendMailMock).toHaveBeenCalledTimes(1);
    const mailOptions = sendMailMock.mock.calls[0][1] as { to: string; subject: string; html: string };
    const snapshotDate = new Intl.DateTimeFormat('de-DE', {
      day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'Europe/Berlin',
    }).format(new Date(storedSnapshot.published_at));
    expect(mailOptions.to).toBe('importer@test.invalid');
    expect(mailOptions.html).toContain('Test Creator');
    expect(mailOptions.html).toContain(`Stand der Creator-Empfehlung:</strong> ${snapshotDate}`);
    expect(mailOptions.html).toContain('Meine persönliche Notiz zum importierten Stack.');
    expect(mailOptions.html).toContain('Sachlicher Kontext ohne individuelle Dosierung.');
    expect(mailOptions.html).toContain(
      `href="https://supplementstack.de/api/products/${creatorProduct!.id}/out?stack_item_id=${importedRow!.stack_item_id}&amp;context=creator_stack"`,
    );
    expect(mailOptions.html.toLowerCase()).not.toContain('affiliate');

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
    harness.run(`INSERT INTO stack_items (id, stack_id, catalog_product_id, quantity, intake_interval_days, sort_order) VALUES (101, 101, 999, 1, 1, 0)`);

    const creator = await authToken(100, 'user', 'creator@test.invalid');
    const admin = await authToken(102, 'admin', 'admin@test.invalid');
    const importer = await authToken(101, 'user', 'importer@test.invalid');
    const createdResponse = await jsonRequest(harness, '/api/creator-sharing/shares', { method: 'POST', token: creator, body: { party_id: 100, stack_id: 100, stack_item_id: 100, type: 'dose_recommendation', title: 'D3' } });
    const created = await createdResponse.json() as { id: number; token: string; snapshot_hash: string };
    await jsonRequest(harness, `/api/admin/creator-sharing/shares/${created.id}`, { method: 'PATCH', token: admin, body: { expected_status: 'pending', expected_snapshot_hash: created.snapshot_hash, moderation_status: 'approved' } });
    const { response: imported } = await preflightAndSave(
      harness,
      created.token,
      importer,
      { target_mode: 'existing', target_stack_id: 101 },
      { idempotency_key: 'exact-main-set-operation-0001', decision: 'add' },
    );
    expect(imported.status).toBe(201);
    expect((await imported.json() as { action: string }).action).toBe('added');
  });

  it('requires a concrete choice when several exact conflicts exist', async () => {
    harness.run(`INSERT INTO stacks (id, user_id, name, last_opened_at) VALUES (101, 101, 'Ziel', CURRENT_TIMESTAMP)`);
    const source = await db.prepare(`SELECT catalog_product_id AS product_id FROM stack_items WHERE id = 100`).first<{ product_id: number }>();
    harness.run(`INSERT INTO stack_items (id, stack_id, catalog_product_id, quantity, intake_interval_days, sort_order) VALUES (101, 101, ?, 1, 1, 0)`, source!.product_id);
    harness.run(`INSERT INTO stack_items (id, stack_id, catalog_product_id, quantity, intake_interval_days, sort_order) VALUES (102, 101, ?, 1, 1, 1)`, source!.product_id);
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
    const preflightResponse = await jsonRequest(harness, `/api/creator-sharing/shares/${share.token}/preflight`, {
      method: 'POST', token: importer,
      body: { target_mode: 'existing', target_stack_id: 101 },
    });
    expect(preflightResponse.status).toBe(200);
    const payload = await preflightResponse.json() as {
      preflight_fingerprint: string;
      snapshot_hash: string;
      similar_products: Array<{ stack_item_id: number; version: number }>;
    };
    expect(payload.similar_products.map((entry) => entry.stack_item_id)).toEqual([101, 102]);
    const missingChoice = await jsonRequest(harness, `/api/creator-sharing/shares/${share.token}/import`, {
      method: 'POST', token: importer,
      body: {
        idempotency_key: 'multiple-conflicts-0001', target_mode: 'existing', target_stack_id: 101,
        preflight_fingerprint: payload.preflight_fingerprint, expected_snapshot_hash: payload.snapshot_hash,
      },
    });
    expect(missingChoice.status).toBe(409);
    expect(await missingChoice.json()).toMatchObject({ code: 'CHOICE_REQUIRED' });
    const replace = await jsonRequest(harness, `/api/creator-sharing/shares/${share.token}/import`, {
      method: 'POST', token: importer,
      body: {
        idempotency_key: 'multiple-conflicts-0002', target_mode: 'existing', target_stack_id: 101,
        decision: 'replace', selected_stack_item_id: 102,
        expected_stack_item_version: payload.similar_products[1].version,
        preflight_fingerprint: payload.preflight_fingerprint, expected_snapshot_hash: payload.snapshot_hash,
      },
    });
    expect(replace.status).toBe(200);
    expect((await replace.json() as { stack_item_id: number }).stack_item_id).toBe(102);
  });

  it('exposes only party-owned creator recommendations and revokes them with exact guards', async () => {
    const creator = await authToken(100, 'user', 'creator@test.invalid');
    const importer = await authToken(101, 'user', 'importer@test.invalid');
    const admin = await authToken(102, 'admin', 'admin@test.invalid');
    const create = await jsonRequest(harness, '/api/creator-sharing/shares', {
      method: 'POST', token: creator,
      body: { party_id: 100, stack_id: 100, type: 'stack', title: 'Portfolio-Test' },
    });
    expect(create.status).toBe(201);
    const share = await create.json() as { id: number; token: string; snapshot_hash: string };

    const forbiddenList = await jsonRequest(harness, '/api/creator-sharing/creator-shares?party_id=100', { token: importer });
    expect(forbiddenList.status).toBe(403);
    const pendingList = await jsonRequest(harness, '/api/creator-sharing/creator-shares?party_id=100', { token: creator });
    expect(pendingList.status).toBe(200);
    const pendingPayload = await pendingList.json() as { shares: Array<{ id: number; status: string; source_stack_id: number }> };
    expect(pendingPayload.shares).toContainEqual(expect.objectContaining({ id: share.id, status: 'pending', source_stack_id: 100 }));

    const privatePreview = await jsonRequest(harness, `/api/creator-sharing/creator-shares/${share.id}/preview`, { token: creator });
    expect(privatePreview.status).toBe(200);
    expect((await privatePreview.json() as { title: string; creator_status: string })).toMatchObject({ title: 'Portfolio-Test', creator_status: 'pending' });
    expect((await db.prepare('SELECT views FROM share_links WHERE id = ?').bind(share.id).first<{ views: number }>())?.views).toBe(0);

    expect((await jsonRequest(harness, `/api/creator-sharing/creator-shares/${share.id}/preview`, { token: importer })).status).toBe(403);
    harness.run(`UPDATE share_links SET moderation_status = 'blocked' WHERE id = ?`, share.id);
    const blockedPreview = await jsonRequest(harness, `/api/creator-sharing/creator-shares/${share.id}/preview`, { token: creator });
    expect(blockedPreview.status).toBe(200);
    expect((await blockedPreview.json() as { creator_status: string }).creator_status).toBe('blocked');
    harness.run(`UPDATE share_links SET moderation_status = 'pending', expires_at = strftime('%s', 'now') - 1 WHERE id = ?`, share.id);
    const expiredPreview = await jsonRequest(harness, `/api/creator-sharing/creator-shares/${share.id}/preview`, { token: creator });
    expect(expiredPreview.status).toBe(200);
    expect((await expiredPreview.json() as { creator_status: string }).creator_status).toBe('expired');
    harness.run(`UPDATE share_links SET expires_at = NULL WHERE id = ?`, share.id);

    const moderation = await jsonRequest(harness, `/api/admin/creator-sharing/shares/${share.id}`, {
      method: 'PATCH', token: admin,
      body: { expected_status: 'pending', expected_snapshot_hash: share.snapshot_hash, moderation_status: 'approved', is_revoked: 0 },
    });
    expect(moderation.status).toBe(200);
    const approvedList = await jsonRequest(harness, '/api/creator-sharing/creator-shares?party_id=100', { token: creator });
    const approvedShare = ((await approvedList.json()) as {
      shares: Array<{ id: number; status: string; snapshot_hash: string; moderation_status: string; is_revoked: number }>;
    }).shares.find((entry) => entry.id === share.id);
    expect(approvedShare).toMatchObject({ status: 'approved', moderation_status: 'approved', is_revoked: 0 });
    harness.run(`UPDATE share_links SET expires_at = strftime('%s', 'now') - 1 WHERE id = ?`, share.id);
    const expiredDashboard = await jsonRequest(harness, '/api/creator-sharing/dashboard?party_id=100', { token: creator });
    expect((await expiredDashboard.json() as { active_shares: number }).active_shares).toBe(0);
    harness.run(`UPDATE share_links SET expires_at = NULL WHERE id = ?`, share.id);

    const staleRevoke = await jsonRequest(harness, `/api/creator-sharing/creator-shares/${share.id}/revoke`, {
      method: 'PATCH', token: creator,
      body: { expected_snapshot_hash: '0'.repeat(64), expected_moderation_status: 'approved', expected_is_revoked: 0 },
    });
    expect(staleRevoke.status).toBe(409);
    harness.run(`INSERT INTO party_memberships (party_id, user_id, role, status) VALUES (100, 101, 'viewer', 'active')`);
    expect((await jsonRequest(harness, `/api/creator-sharing/creator-shares/${share.id}/preview`, { token: importer })).status).toBe(200);
    expect((await jsonRequest(harness, `/api/creator-sharing/creator-shares/${share.id}/revoke`, {
      method: 'PATCH', token: importer,
      body: { expected_snapshot_hash: share.snapshot_hash, expected_moderation_status: 'approved', expected_is_revoked: 0 },
    })).status).toBe(403);

    const revoke = await jsonRequest(harness, `/api/creator-sharing/creator-shares/${share.id}/revoke`, {
      method: 'PATCH', token: creator,
      body: { expected_snapshot_hash: share.snapshot_hash, expected_moderation_status: 'approved', expected_is_revoked: 0 },
    });
    expect(revoke.status).toBe(200);
    const revokedList = await jsonRequest(harness, '/api/creator-sharing/creator-shares?party_id=100', { token: creator });
    const revokedShare = ((await revokedList.json()) as { shares: Array<{ id: number; status: string }> }).shares.find((entry) => entry.id === share.id);
    expect(revokedShare).toMatchObject({ status: 'revoked' });
    const revokedPublic = await jsonRequest(harness, `/api/creator-sharing/shares/${share.token}`);
    expect(revokedPublic.status).toBe(410);
    expect(await revokedPublic.json()).toMatchObject({ code: 'SHARE_UNAVAILABLE' });
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
