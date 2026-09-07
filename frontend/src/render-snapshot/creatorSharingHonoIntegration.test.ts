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

vi.mock('cloudflare:sockets', () => ({ connect: vi.fn() }));

vi.mock('../../../functions/api/lib/mail', async (importOriginal) => ({
  ...await importOriginal<typeof import('../../../functions/api/lib/mail')>(),
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
  options: {
    method?: string; token?: string; cookie?: string; body?: unknown; feature?: boolean;
    userAgent?: string; drainRun?: string; clientIp?: string; rateLimiter?: KVNamespace;
  } = {},
): Promise<Response> {
  const headers = new Headers();
  if (options.token) headers.set('Authorization', `Bearer ${options.token}`);
  if (options.cookie) headers.set('Cookie', `session=${options.cookie}`);
  if (options.body !== undefined) headers.set('Content-Type', 'application/json');
  if (options.userAgent) headers.set('User-Agent', options.userAgent);
  if (options.drainRun) headers.set('X-Creator-Drain-Run', options.drainRun);
  if (options.clientIp) headers.set('CF-Connecting-IP', options.clientIp);
  const request = new Request(`https://supplementstack.de${path}`, {
    method: options.method ?? 'GET',
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });
  return fetchCreatorSharingHono(request, {
    DB: harness.db,
    JWT_SECRET,
    FRONTEND_URL: 'https://supplementstack.de',
    CREATOR_STACK_SHARING_ENABLED: options.feature === false ? 'false' : 'true',
    RATE_LIMITER: options.rateLimiter,
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

function applyPostdeployMigrations(harness: ProductionKnowledgeHonoHarness): void {
  const directory = resolve(process.cwd(), '..', 'd1-postdeploy-migrations');
  for (const file of readdirSync(directory).filter((name) => /^\d+.*\.sql$/.test(name)).sort()) {
    harness.exec(readFileSync(resolve(directory, file), 'utf8'));
  }
}

const importSourceBoundaryMutations: Array<[
  string,
  (harness: ProductionKnowledgeHonoHarness, shareId: number) => void,
]> = [
  ['Share-Version', (testHarness, shareId) => {
    testHarness.run(`UPDATE share_links SET version = version + 1 WHERE id = ?`, shareId);
  }],
  ['Produktlink', (testHarness, shareId) => {
    testHarness.run(`
      UPDATE product_shop_links
      SET normalized_host = normalized_host || '.changed'
      WHERE id = CAST(json_extract(
        (SELECT snapshot_json FROM share_links WHERE id = ?),
        '$.items[0].shop_link_id'
      ) AS INTEGER)
    `, shareId);
  }],
  ['Produkteigentümer', (testHarness, shareId) => {
    testHarness.run(`
      UPDATE parties
      SET version = version + 1
      WHERE id = (
        SELECT product.owner_party_id
        FROM products product
        WHERE product.id = CAST(json_extract(
          (SELECT snapshot_json FROM share_links WHERE id = ?),
          '$.items[0].catalog_product_id'
        ) AS INTEGER)
      )
    `, shareId);
  }],
  ['Hauptwirkstoffrelation', (testHarness, shareId) => {
    testHarness.run(`
      UPDATE product_ingredients
      SET is_main = 0
      WHERE product_id = CAST(json_extract(
        (SELECT snapshot_json FROM share_links WHERE id = ?),
        '$.items[0].catalog_product_id'
      ) AS INTEGER)
        AND is_main = 1
    `, shareId);
  }],
];

const shareSourceBoundaryMutations: Array<[
  string,
  (harness: ProductionKnowledgeHonoHarness) => void,
]> = [
  ['Stack-Version', (testHarness) => {
    testHarness.run(`UPDATE stacks SET version = version + 1 WHERE id = 100`);
  }],
  ['Positions-Version', (testHarness) => {
    testHarness.run(`UPDATE stack_items SET version = version + 1 WHERE id = 100`);
  }],
  ['Positions-Feld ohne Versionssprung', (testHarness) => {
    testHarness.run(`UPDATE stack_items SET dosage_text = 'Am Schreibrand geändert' WHERE id = 100`);
  }],
  ['Positions-Anzahl', (testHarness) => {
    testHarness.run(`
      INSERT INTO stack_items (
        id, stack_id, catalog_product_id, quantity, intake_interval_days,
        dosage_text, timing, sort_order, version
      )
      SELECT 199, stack_id, catalog_product_id, 1, 1, NULL, NULL, 1, 1
      FROM stack_items WHERE id = 100
    `);
  }],
  ['Snapshot-Einheit', (testHarness) => {
    testHarness.run(`
      UPDATE products
      SET serving_unit = serving_unit || '-changed'
      WHERE id = (SELECT catalog_product_id FROM stack_items WHERE id = 100)
    `);
  }],
  ['Produktlink-Relation', (testHarness) => {
    testHarness.run(`
      UPDATE product_shop_links
      SET url = url || CASE WHEN instr(url, '?') = 0 THEN '?race=1' ELSE '&race=1' END
      WHERE id = (
        SELECT psl.id
        FROM stack_items item
        JOIN product_shop_links psl ON psl.product_id = item.catalog_product_id
        WHERE item.id = 100 AND psl.active = 1 AND psl.blocked_at IS NULL
        ORDER BY psl.is_primary DESC,
          CASE WHEN psl.link_kind = 'base_target' THEN 0 ELSE 1 END,
          psl.sort_order, psl.id
        LIMIT 1
      )
    `);
  }],
];

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

  it('publishes only an explicitly maintained safe creator image and exposes no invented profile fallback', async () => {
    const creator = await authToken(100, 'user', 'creator@test.invalid');
    const admin = await authToken(102, 'admin', 'admin@test.invalid');
    const createdResponse = await jsonRequest(harness, '/api/creator-sharing/shares', {
      method: 'POST', token: creator,
      body: { party_id: 100, stack_id: 100, type: 'stack', title: 'Profilbild-Grenze' },
    });
    const share = await createdResponse.json() as { id: number; token: string };
    harness.run(`UPDATE share_links SET moderation_status = 'approved' WHERE id = ?`, share.id);

    const withoutImage = await jsonRequest(harness, `/api/creator-sharing/shares/${share.token}`);
    expect(withoutImage.status).toBe(200);
    expect((await withoutImage.json() as { creator: { profile_image_url: string | null } }).creator.profile_image_url).toBeNull();

    const unsafe = await jsonRequest(harness, '/api/admin/creator-sharing/parties/100', {
      method: 'PATCH', token: admin,
      body: { expected_version: 1, public_profile_image_url: 'javascript:alert(1)' },
    });
    expect(unsafe.status).toBe(400);
    expect((await db.prepare('SELECT public_profile_image_url FROM parties WHERE id = 100')
      .first<{ public_profile_image_url: string | null }>())?.public_profile_image_url).toBeNull();
    const unsafeRelative = await jsonRequest(harness, '/api/admin/creator-sharing/parties/100', {
      method: 'PATCH', token: admin,
      body: { expected_version: 1, public_profile_image_url: '/api/r2/../auth/session' },
    });
    expect(unsafeRelative.status).toBe(400);

    const maintained = await jsonRequest(harness, '/api/admin/creator-sharing/parties/100', {
      method: 'PATCH', token: admin,
      body: { expected_version: 1, public_profile_image_url: 'https://images.example/creator.jpg' },
    });
    expect(maintained.status).toBe(200);
    const publicPreview = await jsonRequest(harness, `/api/creator-sharing/shares/${share.token}`);
    expect(publicPreview.status).toBe(200);
    expect(publicPreview.headers.get('Cache-Control')).toBe('private, no-store');
    expect(publicPreview.headers.get('X-Robots-Tag')).toBe('noindex, nofollow, noarchive');
    expect(publicPreview.headers.get('Referrer-Policy')).toBe('no-referrer');
    expect((await publicPreview.json() as { creator: { profile_image_url: string | null } }).creator.profile_image_url)
      .toBe('https://images.example/creator.jpg');

    const cleared = await jsonRequest(harness, '/api/admin/creator-sharing/parties/100', {
      method: 'PATCH', token: admin,
      body: { expected_version: 2, public_profile_image_url: null },
    });
    expect(cleared.status).toBe(200);
    expect((await cleared.json() as { party: { public_profile_image_url: string | null } }).party.public_profile_image_url).toBeNull();
    harness.run(`UPDATE parties SET public_profile_image_url = 'javascript:alert(1)' WHERE id = 100`);
    const unsafeStoredValue = await jsonRequest(harness, `/api/creator-sharing/shares/${share.token}`);
    expect(unsafeStoredValue.status).toBe(200);
    expect((await unsafeStoredValue.json() as { creator: { profile_image_url: string | null } }).creator.profile_image_url).toBeNull();
  });

  it('accepts a minimal public report idempotently and gives admins an exact guarded moderation path', async () => {
    const creator = await authToken(100, 'user', 'creator@test.invalid');
    const admin = await authToken(102, 'admin', 'admin@test.invalid');
    const rateValues = new Map<string, string>();
    const rateLimiter = {
      get: async (key: string) => rateValues.get(key) ?? null,
      put: async (key: string, value: string) => { rateValues.set(key, value); },
    } as unknown as KVNamespace;
    const createdResponse = await jsonRequest(harness, '/api/creator-sharing/shares', {
      method: 'POST', token: creator,
      body: { party_id: 100, stack_id: 100, type: 'stack', title: 'Meldbare Empfehlung' },
    });
    const share = await createdResponse.json() as { id: number; token: string };
    harness.run(`UPDATE share_links SET moderation_status = 'approved' WHERE id = ?`, share.id);

    const invalid = await jsonRequest(harness, `/api/creator-sharing/shares/${share.token}/report`, {
      method: 'POST', body: { idempotency_key: 'report-invalid-category-0001', category: 'spam' },
    });
    expect(invalid.status).toBe(400);

    const payload = {
      idempotency_key: 'report-public-flow-000001',
      category: 'misleading',
      details: 'Die Angabe zum Zeitpunkt ist schwer verständlich.',
    };
    const submitted = await jsonRequest(harness, `/api/creator-sharing/shares/${share.token}/report`, {
      method: 'POST', body: payload, clientIp: '203.0.113.14', rateLimiter,
    });
    expect(submitted.status).toBe(201);
    expect(submitted.headers.get('Cache-Control')).toBe('private, no-store');
    const submittedBody = await submitted.json() as { report_id: number; status: string };
    expect(submittedBody).toMatchObject({ status: 'pending' });

    const replay = await jsonRequest(harness, `/api/creator-sharing/shares/${share.token}/report`, {
      method: 'POST', body: payload, clientIp: '203.0.113.14', rateLimiter,
    });
    expect(replay.status).toBe(200);
    expect(await replay.json()).toMatchObject({ report_id: submittedBody.report_id, status: 'pending' });

    const changedReplay = await jsonRequest(harness, `/api/creator-sharing/shares/${share.token}/report`, {
      method: 'POST', clientIp: '203.0.113.14', rateLimiter,
      body: {
        ...payload,
        category: 'safety',
        details: 'Nach unklarer Antwort nachträglich geänderte Meldung.',
      },
    });
    expect(changedReplay.status).toBe(409);
    expect(await changedReplay.json()).toMatchObject({ code: 'REPORT_PAYLOAD_CHANGED' });
    expect(await db.prepare(`
      SELECT category, details FROM creator_share_reports WHERE id = ?
    `).bind(submittedBody.report_id).first()).toEqual({
      category: payload.category,
      details: payload.details,
    });

    const schemaColumns = (await db.prepare('PRAGMA table_info(creator_share_reports)').all<{ name: string }>()).results
      .map((column) => column.name);
    expect(schemaColumns).not.toContain('ip_address');
    expect(schemaColumns).not.toContain('user_agent');
    const queue = await jsonRequest(harness, '/api/admin/creator-sharing/reports?status=open', { token: admin });
    expect(queue.status).toBe(200);
    expect(await queue.json()).toMatchObject({
      reports: [expect.objectContaining({
        id: submittedBody.report_id,
        category: 'misleading',
        details: payload.details,
        status: 'pending',
        share_link_id: share.id,
        creator_name: 'Test Creator',
      })],
    });
    for (let index = 1; index <= 4; index += 1) {
      const extra = await jsonRequest(harness, `/api/creator-sharing/shares/${share.token}/report`, {
        method: 'POST', clientIp: '203.0.113.14', rateLimiter,
        body: { idempotency_key: `report-rate-extra-${String(index).padStart(4, '0')}`, category: 'other' },
      });
      expect(extra.status).toBe(201);
    }
    const limited = await jsonRequest(harness, `/api/creator-sharing/shares/${share.token}/report`, {
      method: 'POST', clientIp: '203.0.113.14', rateLimiter,
      body: { idempotency_key: 'report-rate-limited-0001', category: 'other' },
    });
    expect(limited.status).toBe(429);

    const reviewed = await jsonRequest(harness, `/api/admin/creator-sharing/reports/${submittedBody.report_id}`, {
      method: 'PATCH', token: admin,
      body: { expected_version: 1, expected_status: 'pending', status: 'reviewed' },
    });
    expect(reviewed.status).toBe(200);
    expect(await reviewed.json()).toMatchObject({ report: { version: 2, status: 'reviewed', reviewed_by_user_id: 102 } });
    const stale = await jsonRequest(harness, `/api/admin/creator-sharing/reports/${submittedBody.report_id}`, {
      method: 'PATCH', token: admin,
      body: { expected_version: 1, expected_status: 'pending', status: 'resolved' },
    });
    expect(stale.status).toBe(409);
    const resolved = await jsonRequest(harness, `/api/admin/creator-sharing/reports/${submittedBody.report_id}`, {
      method: 'PATCH', token: admin,
      body: { expected_version: 2, expected_status: 'reviewed', status: 'resolved', resolution_note: 'Geprüft und erledigt.' },
    });
    expect(resolved.status).toBe(200);
    expect(await resolved.json()).toMatchObject({ report: { version: 3, status: 'resolved' } });
    const terminal = await jsonRequest(harness, `/api/admin/creator-sharing/reports/${submittedBody.report_id}`, {
      method: 'PATCH', token: admin,
      body: { expected_version: 3, expected_status: 'resolved', status: 'dismissed' },
    });
    expect(terminal.status).toBe(409);

    const unchangedShare = await db.prepare('SELECT moderation_status, is_revoked FROM share_links WHERE id = ?')
      .bind(share.id).first<{ moderation_status: string; is_revoked: number }>();
    expect(unchangedShare).toEqual({ moderation_status: 'approved', is_revoked: 0 });
    const audit = await db.prepare(`
      SELECT COUNT(*) AS count FROM admin_audit_log
      WHERE action = 'moderate_creator_share_report' AND entity_id = ?
    `).bind(submittedBody.report_id).first<{ count: number }>();
    expect(audit?.count).toBe(2);
  });

  it('writes moderation and its outbox atomically in both expand and active schemas', async () => {
    const creator = await authToken(100, 'user', 'creator@test.invalid');
    const admin = await authToken(102, 'admin', 'admin@test.invalid');
    const moderate = async (
      share: { id: number; snapshot_hash: string; version: number },
      status: 'approved' | 'blocked',
    ): Promise<Response> => jsonRequest(harness, `/api/admin/creator-sharing/shares/${share.id}`, {
      method: 'PATCH',
      token: admin,
      body: {
        expected_version: share.version,
        expected_snapshot_hash: share.snapshot_hash,
        expected_moderation_status: 'pending',
        expected_is_revoked: 0,
        expected_paused_at: null,
        expected_expires_at: null,
        expected_archived_at: null,
        moderation_status: status,
        moderation_reason: status === 'blocked' ? 'Bitte einfacher erklären.' : null,
        moderation_target: status === 'blocked' ? 'general' : null,
        moderation_item_index: null,
      },
    });
    const create = async (title: string): Promise<{ id: number; snapshot_hash: string; version: number }> => {
      const response = await jsonRequest(harness, '/api/creator-sharing/shares', {
        method: 'POST', token: creator,
        body: { party_id: 100, stack_id: 100, type: 'stack', title },
      });
      expect(response.status).toBe(201);
      return response.json() as Promise<{ id: number; snapshot_hash: string; version: number }>;
    };

    const expandShare = await create('Moderation im Expand-Schema');
    expect((await moderate(expandShare, 'approved')).status).toBe(200);
    expect(await db.prepare(`
      SELECT version, moderation_status,
        (SELECT COUNT(*) FROM creator_share_notification_events event
          WHERE event.share_link_id = share_links.id) AS events
      FROM share_links WHERE id = ?
    `).bind(expandShare.id).first()).toEqual({ version: 2, moderation_status: 'approved', events: 1 });

    applyPostdeployMigrations(harness);
    expect(await db.prepare(`
      SELECT phase FROM creator_share_workflow_rollouts
      WHERE rollout_key = 'creator_portfolio_v1'
    `).first()).toEqual({ phase: 'active' });

    const activeShare = await create('Moderation im Aktiv-Schema');
    expect((await moderate(activeShare, 'blocked')).status).toBe(200);
    expect(await db.prepare(`
      SELECT version, moderation_status, is_revoked,
        (SELECT COUNT(*) FROM creator_share_notification_events event
          WHERE event.share_link_id = share_links.id) AS events
      FROM share_links WHERE id = ?
    `).bind(activeShare.id).first()).toEqual({
      version: 2,
      moderation_status: 'blocked',
      is_revoked: 0,
      events: 1,
    });
  });

  it('drains postdeploy legacy events once and keeps a failed SMTP attempt terminal across an explicit retry', async () => {
    const creator = await authToken(100, 'user', 'creator@test.invalid');
    const createdResponse = await jsonRequest(harness, '/api/creator-sharing/shares', {
      method: 'POST', token: creator,
      body: { party_id: 100, stack_id: 100, type: 'stack', title: 'Legacy Zustellung' },
    });
    const legacyShare = await createdResponse.json() as { id: number; snapshot_hash: string };
    harness.run(`
      UPDATE share_links
      SET moderation_status = 'approved', is_revoked = 0,
        moderated_by_user_id = 102, moderated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND moderation_status = 'pending' AND snapshot_hash = ?
    `, legacyShare.id, legacyShare.snapshot_hash);
    harness.run(`
      INSERT INTO admin_audit_log (
        user_id, action, entity_type, entity_id, changes, created_at
      )
      SELECT 102, 'moderate_creator_share', 'share_link', id, ?,
        CAST(strftime('%s', moderated_at) AS INTEGER)
      FROM share_links WHERE id = ?
    `, JSON.stringify({ expected_status: 'pending', moderation_status: 'approved', is_revoked: 0 }), legacyShare.id);
    applyPostdeployMigrations(harness);

    const nonce = 'ab'.repeat(32);
    const capabilityHash = Buffer.from(await crypto.subtle.digest(
      'SHA-256',
      new TextEncoder().encode(nonce),
    )).toString('hex');
    harness.run(`
      INSERT INTO creator_share_notification_drain_runs (run_key, capability_hash, status)
      VALUES ('legacy-drain-success', ?, 'ready')
    `, capabilityHash);
    const firstDrain = await jsonRequest(harness, '/api/creator-sharing/internal/notification-drain', {
      method: 'POST', token: nonce, drainRun: 'legacy-drain-success',
    });
    expect(firstDrain.status).toBe(200);
    expect(await firstDrain.json()).toMatchObject({ complete: true, claimed: 1, failed: 0 });
    expect(sendMailMock).toHaveBeenCalledTimes(1);
    expect(await db.prepare(`
      SELECT origin, status, attempts, last_error
      FROM creator_share_notification_events WHERE share_link_id = ?
    `).bind(legacyShare.id).first()).toEqual({
      origin: 'legacy_activation', status: 'sent', attempts: 1, last_error: null,
    });

    const repeatedDrain = await jsonRequest(harness, '/api/creator-sharing/internal/notification-drain', {
      method: 'POST', token: nonce, drainRun: 'legacy-drain-success',
    });
    expect(repeatedDrain.status).toBe(200);
    expect(await repeatedDrain.json()).toMatchObject({ complete: true, claimed: 0 });
    expect(sendMailMock).toHaveBeenCalledTimes(1);

    const failedShareResponse = await jsonRequest(harness, '/api/creator-sharing/shares', {
      method: 'POST', token: creator,
      body: { party_id: 100, stack_id: 100, type: 'stack', title: 'Terminaler Mailfehler' },
    });
    const failedShare = await failedShareResponse.json() as { id: number };
    harness.run(`
      UPDATE share_links
      SET moderation_status = 'approved', version = version + 1
      WHERE id = ? AND moderation_status = 'pending'
    `, failedShare.id);
    harness.run(`
      INSERT INTO creator_share_notification_events (
        share_link_id, share_version, event_type, origin, status, attempts
      ) VALUES (?, 2, 'moderation_approved', 'legacy_activation', 'pending', 0)
    `, failedShare.id);
    const failedNonce = 'cd'.repeat(32);
    const failedCapabilityHash = Buffer.from(await crypto.subtle.digest(
      'SHA-256',
      new TextEncoder().encode(failedNonce),
    )).toString('hex');
    harness.run(`
      INSERT INTO creator_share_notification_drain_runs (run_key, capability_hash, status)
      VALUES ('legacy-drain-failed', ?, 'ready')
    `, failedCapabilityHash);
    sendMailMock.mockReset();
    sendMailMock.mockResolvedValue({ ok: false, error: 'transient' });

    const failedDrain = await jsonRequest(harness, '/api/creator-sharing/internal/notification-drain', {
      method: 'POST', token: failedNonce, drainRun: 'legacy-drain-failed',
    });
    expect(failedDrain.status).toBe(503);
    expect(await failedDrain.json()).toMatchObject({ complete: false, claimed: 1, failed: 1 });
    expect(sendMailMock).toHaveBeenCalledTimes(1);
    expect(await db.prepare(`
      SELECT status, attempts, last_error
      FROM creator_share_notification_events WHERE share_link_id = ?
    `).bind(failedShare.id).first()).toEqual({
      status: 'failed', attempts: 1, last_error: 'mail_delivery_failed',
    });

    const failedRetry = await jsonRequest(harness, '/api/creator-sharing/internal/notification-drain', {
      method: 'POST', token: failedNonce, drainRun: 'legacy-drain-failed',
    });
    expect(failedRetry.status).toBe(200);
    expect(await failedRetry.json()).toMatchObject({ complete: true, claimed: 0, failed: 0 });
    expect(sendMailMock).toHaveBeenCalledTimes(1);
    expect(await db.prepare(`
      SELECT status, attempts FROM creator_share_notification_events WHERE share_link_id = ?
    `).bind(failedShare.id).first()).toEqual({ status: 'failed', attempts: 1 });

    const uncertainShareResponse = await jsonRequest(harness, '/api/creator-sharing/shares', {
      method: 'POST', token: creator,
      body: { party_id: 100, stack_id: 100, type: 'stack', title: 'Unbestätigter Altversuch' },
    });
    const uncertainShare = await uncertainShareResponse.json() as { id: number };
    harness.run(`
      UPDATE share_links
      SET moderation_status = 'approved', version = version + 1
      WHERE id = ? AND moderation_status = 'pending'
    `, uncertainShare.id);
    harness.run(`
      INSERT INTO creator_share_notification_events (
        share_link_id, share_version, event_type, origin, status, attempts, claim_run_key
      ) VALUES (?, 2, 'moderation_approved', 'legacy_activation', 'sending', 1, 'older-deploy-run')
    `, uncertainShare.id);
    const recoveryNonce = 'ef'.repeat(32);
    const recoveryCapabilityHash = Buffer.from(await crypto.subtle.digest(
      'SHA-256',
      new TextEncoder().encode(recoveryNonce),
    )).toString('hex');
    harness.run(`
      INSERT INTO creator_share_notification_drain_runs (run_key, capability_hash, status)
      VALUES ('legacy-drain-recovery', ?, 'ready')
    `, recoveryCapabilityHash);
    const recoveredDrain = await jsonRequest(harness, '/api/creator-sharing/internal/notification-drain', {
      method: 'POST', token: recoveryNonce, drainRun: 'legacy-drain-recovery',
    });
    expect(recoveredDrain.status).toBe(200);
    expect(await recoveredDrain.json()).toMatchObject({ complete: true, claimed: 0, failed: 0 });
    expect(sendMailMock).toHaveBeenCalledTimes(1);
    expect(await db.prepare(`
      SELECT status, attempts, last_error
      FROM creator_share_notification_events WHERE share_link_id = ?
    `).bind(uncertainShare.id).first()).toEqual({
      status: 'failed', attempts: 1, last_error: 'delivery_unconfirmed',
    });
  });

  it('keeps central effect copy out of private and public commercial previews while projecting image and plain timing', async () => {
    const creator = await authToken(100, 'user', 'creator@test.invalid');
    const source = await db.prepare(`
      SELECT item.catalog_product_id AS product_id, ingredient.ingredient_id
      FROM stack_items item
      JOIN product_ingredients ingredient
        ON ingredient.product_id = item.catalog_product_id AND ingredient.is_main = 1
      WHERE item.id = 100
    `).first<{ product_id: number; ingredient_id: number }>();
    harness.run(`UPDATE products SET image_url = '/images/creator-preview.webp' WHERE id = ?`, source!.product_id);
    harness.run(`UPDATE ingredient_display_profiles SET effect_summary = 'Zentral gepflegte Wirkung' WHERE ingredient_id = ?`, source!.ingredient_id);
    harness.run(`UPDATE stack_items SET timing = 'RAW_INTERNAL_CODE' WHERE id = 100`);

    const createResponse = await jsonRequest(harness, '/api/creator-sharing/shares', {
      method: 'POST', token: creator,
      body: { party_id: 100, stack_id: 100, type: 'stack', title: 'Gemeinsame Projektion' },
    });
    const share = await createResponse.json() as { id: number; token: string };
    const privateResponse = await jsonRequest(harness, `/api/creator-sharing/creator-shares/${share.id}/preview`, { token: creator });
    expect(privateResponse.status).toBe(200);
    const privatePayload = await privateResponse.json() as { items: Array<Record<string, unknown>> } & Record<string, unknown>;
    expect(privatePayload.items[0]).toMatchObject({
      image_url: '/images/creator-preview.webp',
      timing: null,
      timing_label: 'Keine Angabe',
    });
    expect(privatePayload.items[0]).not.toHaveProperty('effect_summary');
    expect(privatePayload).toMatchObject({ entity_id: 100, source_stack_id: 100, source_stack_name: 'Creator Stack' });

    harness.run(`UPDATE share_links SET moderation_status = 'approved' WHERE id = ?`, share.id);
    const publicResponse = await jsonRequest(harness, `/api/creator-sharing/shares/${share.token}`);
    expect(publicResponse.status).toBe(200);
    const publicPayload = await publicResponse.json() as { items: Array<Record<string, unknown>> } & Record<string, unknown>;
    expect(publicPayload.items[0]).toMatchObject(privatePayload.items[0]);
    expect(JSON.stringify(publicPayload)).not.toContain('RAW_INTERNAL_CODE');
    for (const privateKey of [
      'entity_id', 'source_stack_id', 'source_stack_name', 'share_id', 'version',
      'snapshot_hash', 'moderation_reason', 'moderation_target', 'moderation_item_index',
      'moderation_item_name', 'is_revoked', 'paused_at', 'archived_at', 'supersedes_share_link_id',
    ]) {
      expect(publicPayload).not.toHaveProperty(privateKey);
    }
    expect(JSON.stringify(publicPayload).toLocaleLowerCase('de-DE')).not.toContain('affiliate');
  });

  it('distinguishes missing timing from an explicitly flexible timing in private and public projections', async () => {
    const creator = await authToken(100, 'user', 'creator@test.invalid');
    const product = await db.prepare(`SELECT catalog_product_id AS id FROM stack_items WHERE id = 100`).first<{ id: number }>();
    harness.run(`UPDATE stack_items SET timing = NULL WHERE id = 100`);
    harness.run(`UPDATE products SET timing = NULL WHERE id = ?`, product!.id);
    harness.run(`
      UPDATE ingredient_display_profiles SET timing = NULL
      WHERE ingredient_id IN (SELECT ingredient_id FROM product_ingredients WHERE product_id = ?)
    `, product!.id);

    for (const scenario of [
      { raw: null, title: 'Ohne Zeitangabe', timing: null, label: 'Keine Angabe' },
      { raw: 'anytime', title: 'Explizit flexibel', timing: 'anytime', label: 'Zeit flexibel' },
    ]) {
      harness.run(`UPDATE stack_items SET timing = ? WHERE id = 100`, scenario.raw);
      const created = await jsonRequest(harness, '/api/creator-sharing/shares', {
        method: 'POST', token: creator,
        body: { party_id: 100, stack_id: 100, type: 'stack', title: scenario.title },
      });
      expect(created.status).toBe(201);
      const share = await created.json() as { id: number; token: string };
      const privatePayload = await (await jsonRequest(
        harness,
        `/api/creator-sharing/creator-shares/${share.id}/preview`,
        { token: creator },
      )).json() as { items: Array<{ timing: string | null; timing_label: string }> };
      expect(privatePayload.items[0]).toMatchObject({ timing: scenario.timing, timing_label: scenario.label });
      harness.run(`UPDATE share_links SET moderation_status = 'approved' WHERE id = ?`, share.id);
      const publicPayload = await (await jsonRequest(harness, `/api/creator-sharing/shares/${share.token}`)).json() as {
        items: Array<{ timing: string | null; timing_label: string }>;
      };
      expect(publicPayload.items[0]).toMatchObject({ timing: scenario.timing, timing_label: scenario.label });
      expect(publicPayload.items[0].timing_label).not.toMatch(/[\u00c3\u00c2]/u);
    }
  });

  it('freezes the effective stack timing and rejects a profile race at the final share insert', async () => {
    const creator = await authToken(100, 'user', 'creator@test.invalid');
    const source = await db.prepare(`
      SELECT item.catalog_product_id AS product_id, relation.ingredient_id, relation.form_id
      FROM stack_items item
      JOIN product_ingredients relation ON relation.id = (
        SELECT candidate.id FROM product_ingredients candidate
        WHERE candidate.product_id = item.catalog_product_id
        ORDER BY candidate.is_main DESC, candidate.search_relevant DESC, candidate.id ASC
        LIMIT 1
      )
      WHERE item.id = 100
    `).first<{ product_id: number; ingredient_id: number; form_id: number | null }>();
    harness.run(`UPDATE stack_items SET timing = NULL WHERE id = 100`);
    harness.run(`UPDATE products SET timing = NULL WHERE id = ?`, source!.product_id);
    harness.run(`
      INSERT OR IGNORE INTO ingredient_display_profiles (ingredient_id, form_id, timing)
      VALUES (?, ?, 'evening')
    `, source!.ingredient_id, source!.form_id);
    harness.run(`
      UPDATE ingredient_display_profiles
      SET timing = 'evening', version = version + 1
      WHERE ingredient_id = ? AND form_id IS ?
        AND part_id IS NULL AND sub_ingredient_id IS NULL
    `, source!.ingredient_id, source!.form_id);
    const profile = await db.prepare(`
      SELECT id FROM ingredient_display_profiles
      WHERE ingredient_id = ? AND form_id IS ?
        AND part_id IS NULL AND sub_ingredient_id IS NULL
    `).bind(source!.ingredient_id, source!.form_id).first<{ id: number }>();

    const stackPayload = await (await jsonRequest(harness, '/api/stacks/100', { token: creator })).json() as {
      items: Array<{ stack_item_id: number; timing: string | null }>;
    };
    expect(stackPayload.items.find((item) => item.stack_item_id === 100)?.timing).toBe('evening');
    const created = await jsonRequest(harness, '/api/creator-sharing/shares', {
      method: 'POST', token: creator,
      body: { party_id: 100, stack_id: 100, type: 'stack', title: 'Profilzeit' },
    });
    expect(created.status).toBe(201);
    const share = await created.json() as { id: number; token: string };
    const privatePayload = await (await jsonRequest(
      harness,
      `/api/creator-sharing/creator-shares/${share.id}/preview`,
      { token: creator },
    )).json() as { items: Array<{ timing: string | null; timing_label: string }> };
    expect(privatePayload.items[0]).toMatchObject({ timing: 'evening', timing_label: 'Abends' });
    harness.run(`UPDATE share_links SET moderation_status = 'approved' WHERE id = ?`, share.id);
    const publicPayload = await (await jsonRequest(harness, `/api/creator-sharing/shares/${share.token}`)).json() as {
      items: Array<{ timing: string | null; timing_label: string }>;
    };
    expect(publicPayload.items[0]).toMatchObject({ timing: 'evening', timing_label: 'Abends' });

    const sharesBefore = (await db.prepare(`SELECT COUNT(*) AS count FROM share_links`).first<{ count: number }>())?.count;
    const hookedDb = harness.db as { batch: (statements: unknown[]) => Promise<unknown[]> };
    const originalBatch = hookedDb.batch.bind(hookedDb);
    let intercepted = false;
    hookedDb.batch = async (statements) => {
      if (!intercepted) {
        intercepted = true;
        harness.run(`UPDATE ingredient_display_profiles SET timing = 'morning', version = version + 1 WHERE id = ?`, profile!.id);
      }
      return originalBatch(statements);
    };
    const raced = await jsonRequest(harness, '/api/creator-sharing/shares', {
      method: 'POST', token: creator,
      body: { party_id: 100, stack_id: 100, type: 'stack', title: 'Veraltete Profilzeit' },
    });
    hookedDb.batch = originalBatch;
    expect(intercepted).toBe(true);
    expect(raced.status).toBe(409);
    expect((await db.prepare(`SELECT COUNT(*) AS count FROM share_links`).first<{ count: number }>())?.count).toBe(sharesBefore);
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

    harness.run(`UPDATE share_links SET moderation_status = 'blocked', moderation_reason = 'Bitte überarbeiten.', moderation_target = 'general', expires_at = NULL WHERE id = ?`, share.id);
    const blocked = await jsonRequest(harness, `/api/creator-sharing/shares/${share.token}`);
    expect(blocked.status).toBe(410);
    expect(await blocked.json()).toEqual(expect.objectContaining({ code: 'SHARE_UNAVAILABLE' }));

    harness.run(`UPDATE share_links SET moderation_status = 'approved', moderation_reason = NULL, moderation_target = NULL, moderation_item_index = NULL, is_revoked = 1 WHERE id = ?`, share.id);
    const revoked = await jsonRequest(harness, `/api/creator-sharing/shares/${share.token}`);
    expect(revoked.status).toBe(410);
    expect(await revoked.json()).toEqual(expect.objectContaining({ code: 'SHARE_UNAVAILABLE' }));

    const unknown = await jsonRequest(harness, '/api/creator-sharing/shares/unknownunknownunknownunknown');
    expect(unknown.status).toBe(404);
    expect(await unknown.json()).toMatchObject({ code: 'SHARE_UNKNOWN' });

    const raceShareResponse = await jsonRequest(harness, '/api/creator-sharing/shares', {
      method: 'POST', token: creator,
      body: { party_id: 100, stack_id: 100, stack_item_id: 100, type: 'dose_recommendation', title: 'Speicher-Rennen' },
    });
    const raceShare = await raceShareResponse.json() as { id: number; token: string };
    harness.run(`UPDATE share_links SET moderation_status = 'approved' WHERE id = ?`, raceShare.id);
    const selection = { target_mode: 'new', stack_name: 'Nicht mehr speichern' };
    const preflightResponse = await jsonRequest(harness, `/api/creator-sharing/shares/${raceShare.token}/preflight`, {
      method: 'POST', token: importer, body: selection,
    });
    expect(preflightResponse.status).toBe(200);
    const preflight = await preflightResponse.json() as { preflight_fingerprint: string; snapshot_hash: string };
    harness.run(`UPDATE share_links SET is_revoked = 1 WHERE id = ?`, raceShare.id);
    const beforeOperations = (await db.prepare('SELECT COUNT(*) AS count FROM share_import_operations').first<{ count: number }>())?.count;
    const save = await jsonRequest(harness, `/api/creator-sharing/shares/${raceShare.token}/import`, {
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
    expect((await db.prepare('SELECT imports FROM share_links WHERE id = ?').bind(raceShare.id).first<{ imports: number }>())?.imports).toBe(0);
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
    harness.run(`UPDATE stack_items SET timing = 'evening' WHERE id = 100`);

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
      ) VALUES (501, 101, NULL, 501, 2, 2, 'Zwei Tabletten', NULL, 8, 3)
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
      recommendation: { timing: string | null; timing_label: string };
      similar_products: Array<{
        stack_item_id: number;
        version: number;
        private_note: string | null;
        main_ingredient_names: string[];
        comparison: { timing: string | null; timing_label: string };
      }>;
    };
    expect(preflight.preflight_fingerprint).toMatch(/^[a-f0-9]{64}$/);
    expect(preflight.main_ingredient_names.length).toBeGreaterThan(0);
    expect(preflight.recommendation).toMatchObject({ timing: 'evening', timing_label: 'Abends' });
    expect(preflight.similar_products).toEqual([expect.objectContaining({
      stack_item_id: 501,
      version: 3,
      private_note: 'Nur für mich sichtbar',
      main_ingredient_names: preflight.main_ingredient_names,
      comparison: expect.objectContaining({ timing: null, timing_label: 'Keine Angabe' }),
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
    const replacePayload = await replace.json() as {
      action: string;
      undo: { token: string; version: number; stack_id: number; stack_item_id: number; summary: string };
    };
    expect(replacePayload).toMatchObject({
      action: 'replaced', replaced_product_name: 'Eigenes Magnesium', replaced_user_product_retained: true,
      undo: { version: 1, stack_id: 101, stack_item_id: 501 },
    });
    expect(replacePayload.undo.token).toMatch(/^undo_[a-f0-9-]{36}$/i);
    expect(replacePayload.undo.summary).toContain('Eigenes Magnesium');
    const storedOperation = await db.prepare(`
      SELECT result_json FROM share_import_operations WHERE idempotency_key = ?
    `).bind(replaceBody.idempotency_key).first<{ result_json: string }>();
    expect(storedOperation?.result_json).not.toContain(replacePayload.undo.token);
    expect(storedOperation?.result_json).not.toContain('"undo"');
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
    const replayPayload = await replay.json() as { idempotent_replay: boolean; undo?: unknown };
    expect(replayPayload.idempotent_replay).toBe(true);
    expect(replayPayload.undo).toBeUndefined();
    expect((await db.prepare('SELECT imports FROM share_links WHERE id = ?').bind(share.id).first<{ imports: number }>())?.imports).toBe(1);

    const undo = await jsonRequest(harness, `/api/creator-sharing/shares/${share.token}/import/undo`, {
      method: 'POST', token: importer,
      body: {
        undo_token: replacePayload.undo.token,
        expected_version: replacePayload.undo.version,
        expected_stack_id: replacePayload.undo.stack_id,
        expected_stack_item_id: replacePayload.undo.stack_item_id,
      },
    });
    expect(undo.status).toBe(200);
    const undoPayload = await undo.json() as {
      ok: boolean;
      stack_id: number;
      stack_name: string;
      summary: string;
      restored_summary: string;
    };
    expect(undoPayload).toMatchObject({
      ok: true,
      stack_id: 101,
      stack_name: 'Zielstack',
      restored_summary: 'Der vorherige Stand in „Zielstack“ wurde wiederhergestellt.',
    });
    expect(undoPayload.summary).toContain('wird');
    expect(undoPayload.restored_summary).not.toContain(' wird ');
    expect(await db.prepare(`
      SELECT catalog_product_id, user_product_id, quantity, intake_interval_days,
        dosage_text, timing, sort_order, version
      FROM stack_items WHERE id = 501
    `).first()).toMatchObject({
      catalog_product_id: null,
      user_product_id: 501,
      quantity: 2,
      intake_interval_days: 2,
      dosage_text: 'Zwei Tabletten',
      timing: 'abends',
      sort_order: 8,
      version: 5,
    });
    expect((await db.prepare('SELECT COUNT(*) AS count FROM stack_item_link_bindings WHERE stack_item_id = 501').first<{ count: number }>())?.count).toBe(0);
    const repeatedUndo = await jsonRequest(harness, `/api/creator-sharing/shares/${share.token}/import/undo`, {
      method: 'POST', token: importer,
      body: {
        undo_token: replacePayload.undo.token,
        expected_version: 1,
        expected_stack_id: 101,
        expected_stack_item_id: 501,
      },
    });
    expect(repeatedUndo.status).toBe(409);
    expect(await repeatedUndo.json()).toMatchObject({ code: 'UNDO_ALREADY_USED' });
  });

  it('allows exactly one guarded undo attempt and preserves an identical previous link binding', async () => {
    const creator = await authToken(100, 'user', 'creator@test.invalid');
    const importer = await authToken(101, 'user', 'importer@test.invalid');
    const source = await db.prepare(`
      SELECT si.catalog_product_id AS product_id
      FROM stack_items si WHERE si.id = 100
    `).first<{ product_id: number }>();
    const created = await jsonRequest(harness, '/api/creator-sharing/shares', {
      method: 'POST', token: creator,
      body: { party_id: 100, stack_id: 100, stack_item_id: 100, type: 'dose_recommendation', title: 'Parallel Undo' },
    });
    const share = await created.json() as { id: number; token: string };
    harness.run(`UPDATE share_links SET moderation_status = 'approved' WHERE id = ?`, share.id);
    const snapshotBinding = await db.prepare(`
      SELECT
        CAST(json_extract(snapshot_json, '$.items[0].shop_link_id') AS INTEGER) AS shop_link_id,
        json_extract(snapshot_json, '$.items[0].link_binding.resolution_kind') AS resolution_kind,
        CAST(json_extract(snapshot_json, '$.items[0].link_binding.affiliate_version_id') AS INTEGER) AS affiliate_version_id,
        CAST(json_extract(snapshot_json, '$.items[0].link_binding.resolved_party_id') AS INTEGER) AS resolved_party_id
      FROM share_links WHERE id = ?
    `).bind(share.id).first<{
      shop_link_id: number;
      resolution_kind: string;
      affiliate_version_id: number | null;
      resolved_party_id: number | null;
    }>();
    expect(snapshotBinding).not.toBeNull();
    harness.run(`INSERT INTO stacks (id, user_id, name) VALUES (101, 101, 'Parallelziel')`);
    harness.run(`
      INSERT INTO stack_items (
        id, stack_id, catalog_product_id, quantity, intake_interval_days,
        dosage_text, timing, sort_order, version
      ) VALUES (501, 101, ?, 2, 2, 'Vorherige Angabe', 'morning', 4, 3)
    `, source!.product_id);
    harness.run(`
      INSERT INTO stack_item_link_bindings (
        stack_item_id, shop_link_id, resolution_kind, affiliate_version_id,
        resolved_party_id, bound_at
      ) VALUES (501, ?, ?, ?, ?, '2026-08-01 10:00:00')
    `, snapshotBinding!.shop_link_id, snapshotBinding!.resolution_kind,
    snapshotBinding!.affiliate_version_id, snapshotBinding!.resolved_party_id);

    const selection = { target_mode: 'existing', target_stack_id: 101 };
    const preflightResponse = await jsonRequest(harness, `/api/creator-sharing/shares/${share.token}/preflight`, {
      method: 'POST', token: importer, body: selection,
    });
    const preflight = await preflightResponse.json() as {
      preflight_fingerprint: string;
      snapshot_hash: string;
      similar_products: Array<{ stack_item_id: number; version: number }>;
    };
    const saved = await jsonRequest(harness, `/api/creator-sharing/shares/${share.token}/import`, {
      method: 'POST', token: importer,
      body: {
        ...selection,
        idempotency_key: 'parallel-undo-replace-0001',
        decision: 'replace',
        selected_stack_item_id: 501,
        expected_stack_item_version: preflight.similar_products[0].version,
        preflight_fingerprint: preflight.preflight_fingerprint,
        expected_snapshot_hash: preflight.snapshot_hash,
      },
    });
    expect(saved.status).toBe(200);
    const payload = await saved.json() as {
      undo: { token: string; version: number; stack_id: number; stack_item_id: number };
    };
    const undoBody = {
      undo_token: payload.undo.token,
      expected_version: payload.undo.version,
      expected_stack_id: payload.undo.stack_id,
      expected_stack_item_id: payload.undo.stack_item_id,
    };
    const [first, second] = await Promise.all([
      jsonRequest(harness, `/api/creator-sharing/shares/${share.token}/import/undo`, { method: 'POST', token: importer, body: undoBody }),
      jsonRequest(harness, `/api/creator-sharing/shares/${share.token}/import/undo`, { method: 'POST', token: importer, body: undoBody }),
    ]);
    expect([first.status, second.status].sort()).toEqual([200, 409]);
    const finalItem = await db.prepare(`
      SELECT catalog_product_id, quantity, intake_interval_days, dosage_text,
        timing, sort_order, version
      FROM stack_items WHERE id = 501
    `).first();
    expect(finalItem).toMatchObject({
      catalog_product_id: source!.product_id,
      quantity: 2,
      intake_interval_days: 2,
      dosage_text: 'Vorherige Angabe',
      timing: 'morning',
      sort_order: 4,
      version: 5,
    });
    expect(await db.prepare(`
      SELECT shop_link_id, resolution_kind, affiliate_version_id,
        resolved_party_id, bound_at
      FROM stack_item_link_bindings WHERE stack_item_id = 501
    `).first()).toEqual({ ...snapshotBinding, bound_at: '2026-08-01 10:00:00' });
    expect(await db.prepare(`
      SELECT version, undone_at IS NOT NULL AS is_undone,
        write_claim_token IS NOT NULL AS has_claim
      FROM creator_share_import_undos WHERE stack_item_id = 501
    `).first()).toEqual({ version: 2, is_undone: 1, has_claim: 1 });
  });

  it('rolls the whole undo batch back when its final exact postcondition is tampered', async () => {
    const creator = await authToken(100, 'user', 'creator@test.invalid');
    const importer = await authToken(101, 'user', 'importer@test.invalid');
    const source = await db.prepare('SELECT catalog_product_id AS product_id FROM stack_items WHERE id = 100')
      .first<{ product_id: number }>();
    const created = await jsonRequest(harness, '/api/creator-sharing/shares', {
      method: 'POST', token: creator,
      body: { party_id: 100, stack_id: 100, stack_item_id: 100, type: 'dose_recommendation', title: 'Undo-Receipt' },
    });
    const share = await created.json() as { id: number; token: string };
    harness.run('UPDATE share_links SET moderation_status = ? WHERE id = ?', 'approved', share.id);
    harness.run(`INSERT INTO stacks (id, user_id, name) VALUES (101, 101, 'Receipt-Ziel')`);
    harness.run(`
      INSERT INTO stack_items (
        id, stack_id, catalog_product_id, quantity, intake_interval_days,
        dosage_text, timing, sort_order, version
      ) VALUES (501, 101, ?, 2, 2, 'Vorherige Angabe', 'morning', 4, 3)
    `, source!.product_id);

    const selection = { target_mode: 'existing', target_stack_id: 101 };
    const preflightResponse = await jsonRequest(harness, `/api/creator-sharing/shares/${share.token}/preflight`, {
      method: 'POST', token: importer, body: selection,
    });
    const preflight = await preflightResponse.json() as {
      preflight_fingerprint: string;
      snapshot_hash: string;
      similar_products: Array<{ stack_item_id: number; version: number }>;
    };
    const saved = await jsonRequest(harness, `/api/creator-sharing/shares/${share.token}/import`, {
      method: 'POST', token: importer,
      body: {
        ...selection,
        idempotency_key: 'receipt-bound-undo-replace-0001',
        decision: 'replace',
        selected_stack_item_id: 501,
        expected_stack_item_version: preflight.similar_products[0].version,
        preflight_fingerprint: preflight.preflight_fingerprint,
        expected_snapshot_hash: preflight.snapshot_hash,
      },
    });
    expect(saved.status).toBe(200);
    const payload = await saved.json() as {
      undo: { token: string; version: number; stack_id: number; stack_item_id: number };
    };

    const undoBefore = await db.prepare(`
      SELECT version, undone_at, write_claim_token
      FROM creator_share_import_undos WHERE stack_item_id = 501
    `).first<Record<string, unknown>>();
    const itemBefore = await db.prepare(`
      SELECT catalog_product_id, user_product_id, quantity, dosage_text, timing,
        intake_interval_days, sort_order, source_share_link_id,
        creator_statement_snapshot, amount_source, version
      FROM stack_items WHERE id = 501
    `).first<Record<string, unknown>>();
    const bindingBefore = await db.prepare(`
      SELECT shop_link_id, resolution_kind, affiliate_version_id,
        resolved_party_id, bound_at
      FROM stack_item_link_bindings WHERE stack_item_id = 501
    `).first<Record<string, unknown>>();

    // Simulate an in-transaction mutation after the imported binding is
    // removed. The final SQL assertion must abort and roll back every write.
    harness.exec(`
      CREATE TRIGGER tamper_creator_share_undo_receipt
      AFTER DELETE ON stack_item_link_bindings
      WHEN OLD.stack_item_id = 501
      BEGIN
        UPDATE creator_share_import_undos
        SET write_claim_token = 'claim_tampered_receipt_0001'
        WHERE stack_item_id = 501 AND undone_at IS NOT NULL;
      END;
    `);
    const undoResponse = await jsonRequest(harness, `/api/creator-sharing/shares/${share.token}/import/undo`, {
      method: 'POST', token: importer,
      body: {
        undo_token: payload.undo.token,
        expected_version: payload.undo.version,
        expected_stack_id: payload.undo.stack_id,
        expected_stack_item_id: payload.undo.stack_item_id,
      },
    });
    expect(undoResponse.status).toBe(409);
    const failure = await undoResponse.json() as Record<string, unknown>;
    expect(failure).toMatchObject({ code: 'UNDO_TARGET_CHANGED' });
    expect(failure).not.toHaveProperty('undone_at');
    expect(failure).not.toHaveProperty('ok', true);
    expect(await db.prepare(`
      SELECT version, undone_at, write_claim_token
      FROM creator_share_import_undos WHERE stack_item_id = 501
    `).first()).toEqual(undoBefore);
    expect(await db.prepare(`
      SELECT catalog_product_id, user_product_id, quantity, dosage_text, timing,
        intake_interval_days, sort_order, source_share_link_id,
        creator_statement_snapshot, amount_source, version
      FROM stack_items WHERE id = 501
    `).first()).toEqual(itemBefore);
    expect(await db.prepare(`
      SELECT shop_link_id, resolution_kind, affiliate_version_id,
        resolved_party_id, bound_at
      FROM stack_item_link_bindings WHERE stack_item_id = 501
    `).first()).toEqual(bindingBefore);
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

  it.each(importSourceBoundaryMutations)(
    'rejects a %s mutation at the import batch boundary without writes or sequence movement',
    async (_label, mutateSource) => {
      const creator = await authToken(100, 'user', 'creator@test.invalid');
      const importer = await authToken(101, 'user', 'importer@test.invalid');
      const created = await jsonRequest(harness, '/api/creator-sharing/shares', {
        method: 'POST', token: creator,
        body: { party_id: 100, stack_id: 100, type: 'stack', title: 'Relationsgebundener Import' },
      });
      const share = await created.json() as { id: number; token: string };
      harness.run(`UPDATE share_links SET moderation_status = 'approved' WHERE id = ?`, share.id);
      const selection = { stack_name: 'Darf bei Quellenkonflikt nicht entstehen' };
      const preflightResponse = await jsonRequest(harness, `/api/creator-sharing/shares/${share.token}/preflight`, {
        method: 'POST', token: importer, body: selection,
      });
      expect(preflightResponse.status).toBe(200);
      const preflight = await preflightResponse.json() as { preflight_fingerprint: string; snapshot_hash: string };
      const sequenceBefore = await db.prepare(`
        SELECT name, seq FROM sqlite_sequence
        WHERE name IN ('stacks', 'stack_items', 'share_import_operations')
        ORDER BY name
      `).all<{ name: string; seq: number }>();

      const hookedDb = harness.db as { batch: (statements: unknown[]) => Promise<unknown[]> };
      const originalBatch = hookedDb.batch.bind(hookedDb);
      let intercepted = false;
      hookedDb.batch = async (statements) => {
        if (!intercepted) {
          intercepted = true;
          mutateSource(harness, share.id);
        }
        return originalBatch(statements);
      };
      const save = await jsonRequest(harness, `/api/creator-sharing/shares/${share.token}/import`, {
        method: 'POST', token: importer,
        body: {
          ...selection,
          idempotency_key: 'relation-boundary-import-0001',
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
        WHERE name IN ('stacks', 'stack_items', 'share_import_operations')
        ORDER BY name
      `).all<{ name: string; seq: number }>()).toEqual(sequenceBefore);
      expect((await db.prepare(`SELECT COUNT(*) AS count FROM share_import_operations`).first<{ count: number }>())?.count).toBe(0);
      expect((await db.prepare(`SELECT COUNT(*) AS count FROM stacks WHERE user_id = 101`).first<{ count: number }>())?.count).toBe(0);
      expect((await db.prepare(`SELECT COUNT(*) AS count FROM stack_items WHERE stack_id IN (SELECT id FROM stacks WHERE user_id = 101)`).first<{ count: number }>())?.count).toBe(0);
      expect((await db.prepare(`SELECT imports FROM share_links WHERE id = ?`).bind(share.id).first<{ imports: number }>())?.imports).toBe(0);
    },
  );

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
    harness.run(`UPDATE share_links SET moderation_status = 'blocked', moderation_reason = 'Bitte überarbeiten.', moderation_target = 'general' WHERE id = ?`, original.id);
    const oldBefore = await db.prepare(`
      SELECT token, snapshot_json, snapshot_hash, moderation_status, is_revoked, expires_at
      FROM share_links WHERE id = ?
    `).bind(original.id).first<Record<string, unknown>>();
    const guard = {
      share_id: original.id,
      expected_version: 1,
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

    harness.run(`UPDATE share_links SET moderation_status = 'approved', moderation_reason = NULL, moderation_target = NULL, moderation_item_index = NULL WHERE id = ?`, original.id);
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
    harness.run(`UPDATE share_links SET moderation_status = 'blocked', moderation_reason = 'Bitte überarbeiten.', moderation_target = 'general' WHERE id = ?`, original.id);
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

  it.each(shareSourceBoundaryMutations)(
    'rejects a %s mutation at the final share insert without creating a partial link',
    async (_label, mutateSource) => {
      const creator = await authToken(100, 'user', 'creator@test.invalid');
      const sharesBefore = (await db.prepare(`SELECT COUNT(*) AS count FROM share_links`).first<{ count: number }>())?.count;
      const shareSequenceBefore = await db.prepare(`SELECT seq FROM sqlite_sequence WHERE name = 'share_links'`).first<{ seq: number }>();
      const hookedDb = harness.db as { batch: (statements: unknown[]) => Promise<unknown[]> };
      const originalBatch = hookedDb.batch.bind(hookedDb);
      let intercepted = false;
      hookedDb.batch = async (statements) => {
        if (!intercepted) {
          intercepted = true;
          mutateSource(harness);
        }
        return originalBatch(statements);
      };

      const response = await jsonRequest(harness, '/api/creator-sharing/shares', {
        method: 'POST', token: creator,
        body: { party_id: 100, stack_id: 100, type: 'stack', title: 'Darf nicht entstehen' },
      });
      hookedDb.batch = originalBatch;

      expect(intercepted).toBe(true);
      expect(response.status).toBe(409);
      expect(await response.json()).toMatchObject({ code: 'SOURCE_STACK_CHANGED' });
      expect((await db.prepare(`SELECT COUNT(*) AS count FROM share_links`).first<{ count: number }>())?.count).toBe(sharesBefore);
      expect(await db.prepare(`SELECT seq FROM sqlite_sequence WHERE name = 'share_links'`).first<{ seq: number }>()).toEqual(shareSequenceBefore);
    },
  );

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
      body: {
        expected_version: 1,
        expected_snapshot_hash: created.snapshot_hash,
        expected_moderation_status: 'pending',
        expected_is_revoked: 0,
        expected_paused_at: null,
        expected_expires_at: null,
        expected_archived_at: null,
        moderation_status: 'approved',
        moderation_reason: null,
        moderation_target: null,
        moderation_item_index: null,
      },
    });
    expect(moderation.status).toBe(200);
    const previewResponse = await jsonRequest(harness, `/api/creator-sharing/shares/${created.token}`);
    expect(previewResponse.status).toBe(200);
    const preview = await previewResponse.json() as { creator: { name: string }; items: Array<{ creator_statement: string; unit: string | null }> };
    expect(preview.creator.name).toBe('Test Creator');
    expect(Object.prototype.hasOwnProperty.call(preview, 'disclosure')).toBe(false);
    expect(Object.prototype.hasOwnProperty.call(preview.items[0], 'has_affiliate_attribution')).toBe(false);
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
    expect(sendMailMock).toHaveBeenCalledTimes(1);
    expect((sendMailMock.mock.calls[0][1] as { html: string }).html).toContain('/creator?bereich=portfolio&amp;editShare=');
    sendMailMock.mockClear();

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
    const importedStackResponse = await jsonRequest(harness, `/api/stacks/${imported.stack_id}`, { token: importer });
    expect(importedStackResponse.status).toBe(200);
    const importedStack = await importedStackResponse.json() as { items: Array<{ creator_party_name: string | null }> };
    expect(importedStack.items[0]?.creator_party_name).toBe('Test Creator');
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
    expect(mailOptions.subject).toBe('Dein Einnahmeplan: Importierter Stack');
    expect(mailOptions.html).toMatch(/€ pro Monat/);
    expect(mailOptions.html).not.toContain('/Monat');
    expect(mailOptions.html).not.toContain('Stack-Mail');
    expect(mailOptions.html).toContain('Test Creator');
    expect(mailOptions.html).toContain(`Stand der Creator-Empfehlung:</strong> ${snapshotDate}`);
    expect(mailOptions.html).toContain('Meine persönliche Notiz zum importierten Stack.');
    expect(mailOptions.html).toContain('Sachlicher Kontext ohne individuelle Dosierung.');
    expect(mailOptions.html).toContain('Allgemeiner Creator-Hinweis:');
    expect((mailOptions.html.match(/Sachlicher Kontext ohne individuelle Dosierung\./g) ?? [])).toHaveLength(1);
    expect(mailOptions.html).toContain('Deine geplante Menge pro Einnahmetag');
    expect(mailOptions.html).not.toContain('Tagesdosis');
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
    const created = await createdResponse.json() as { id: number; token: string; snapshot_hash: string; version: number };
    await jsonRequest(harness, `/api/admin/creator-sharing/shares/${created.id}`, { method: 'PATCH', token: admin, body: {
      expected_version: created.version, expected_snapshot_hash: created.snapshot_hash,
      expected_moderation_status: 'pending', expected_is_revoked: 0,
      expected_paused_at: null, expected_expires_at: null, expected_archived_at: null,
      moderation_status: 'approved', moderation_reason: null, moderation_target: null, moderation_item_index: null,
    } });
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
    const share = await create.json() as { id: number; token: string; snapshot_hash: string; version: number };
    await jsonRequest(harness, `/api/admin/creator-sharing/shares/${share.id}`, {
      method: 'PATCH', token: admin,
      body: {
        expected_version: share.version, expected_snapshot_hash: share.snapshot_hash,
        expected_moderation_status: 'pending', expected_is_revoked: 0,
        expected_paused_at: null, expected_expires_at: null, expected_archived_at: null,
        moderation_status: 'approved', moderation_reason: null, moderation_target: null, moderation_item_index: null,
      },
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
    harness.run(`UPDATE share_links SET moderation_status = 'blocked', moderation_reason = 'Bitte überarbeiten.', moderation_target = 'general' WHERE id = ?`, share.id);
    const blockedPreview = await jsonRequest(harness, `/api/creator-sharing/creator-shares/${share.id}/preview`, { token: creator });
    expect(blockedPreview.status).toBe(200);
    expect((await blockedPreview.json() as { creator_status: string }).creator_status).toBe('blocked');
    harness.run(`UPDATE share_links SET moderation_status = 'pending', moderation_reason = NULL, moderation_target = NULL, moderation_item_index = NULL, expires_at = strftime('%s', 'now') - 1 WHERE id = ?`, share.id);
    const expiredPreview = await jsonRequest(harness, `/api/creator-sharing/creator-shares/${share.id}/preview`, { token: creator });
    expect(expiredPreview.status).toBe(200);
    expect((await expiredPreview.json() as { creator_status: string }).creator_status).toBe('expired');
    harness.run(`UPDATE share_links SET expires_at = NULL WHERE id = ?`, share.id);

    const moderation = await jsonRequest(harness, `/api/admin/creator-sharing/shares/${share.id}`, {
      method: 'PATCH', token: admin,
      body: {
        expected_version: 1, expected_snapshot_hash: share.snapshot_hash,
        expected_moderation_status: 'pending', expected_is_revoked: 0,
        expected_paused_at: null, expected_expires_at: null, expected_archived_at: null,
        moderation_status: 'approved', moderation_reason: null, moderation_target: null, moderation_item_index: null,
      },
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
      body: { expected_version: 2, expected_snapshot_hash: '0'.repeat(64), expected_moderation_status: 'approved', expected_is_revoked: 0, expected_paused_at: null, expected_expires_at: null },
    });
    expect(staleRevoke.status).toBe(409);
    harness.run(`INSERT INTO party_memberships (party_id, user_id, role, status) VALUES (100, 101, 'viewer', 'active')`);
    expect((await jsonRequest(harness, `/api/creator-sharing/creator-shares/${share.id}/preview`, { token: importer })).status).toBe(200);
    expect((await jsonRequest(harness, `/api/creator-sharing/creator-shares/${share.id}/revoke`, {
      method: 'PATCH', token: importer,
      body: { expected_version: 2, expected_snapshot_hash: share.snapshot_hash, expected_moderation_status: 'approved', expected_is_revoked: 0, expected_paused_at: null, expected_expires_at: null },
    })).status).toBe(403);

    const revoke = await jsonRequest(harness, `/api/creator-sharing/creator-shares/${share.id}/revoke`, {
      method: 'PATCH', token: creator,
      body: { expected_version: 2, expected_snapshot_hash: share.snapshot_hash, expected_moderation_status: 'approved', expected_is_revoked: 0, expected_paused_at: null, expected_expires_at: null },
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

  it('ignores recognizable bots and fails closed across creator APIs when the party is blocked', async () => {
    const creator = await authToken(100, 'user', 'creator@test.invalid');
    const importer = await authToken(101, 'user', 'importer@test.invalid');
    const createdResponse = await jsonRequest(harness, '/api/creator-sharing/shares', {
      method: 'POST', token: creator,
      body: { party_id: 100, stack_id: 100, type: 'stack', title: 'Sicherheitsprüfung' },
    });
    const share = await createdResponse.json() as { id: number; token: string };
    harness.run(`UPDATE share_links SET moderation_status = 'approved' WHERE id = ?`, share.id);

    const viewsBefore = await db.prepare(`SELECT views FROM share_links WHERE id = ?`).bind(share.id).first<{ views: number }>();
    expect((await jsonRequest(harness, `/api/creator-sharing/shares/${share.token}`)).status).toBe(200);
    expect((await jsonRequest(harness, `/api/creator-sharing/shares/${share.token}`)).status).toBe(200);
    expect((await db.prepare(`SELECT views FROM share_links WHERE id = ?`).bind(share.id).first<{ views: number }>())?.views).toBe(viewsBefore?.views);

    const eventCountBefore = (await db.prepare(`SELECT COUNT(*) AS count FROM page_view_events`).first<{ count: number }>())?.count ?? 0;
    const bot = await jsonRequest(harness, '/api/analytics/pageview', {
      method: 'POST',
      userAgent: 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
      body: { path: `/share/${share.token}`, visitor_id: 'bot-visitor' },
    });
    expect(bot.status).toBe(200);
    expect((await db.prepare(`SELECT COUNT(*) AS count FROM page_view_events`).first<{ count: number }>())?.count).toBe(eventCountBefore);
    const browser = await jsonRequest(harness, '/api/analytics/pageview', {
      method: 'POST',
      userAgent: 'Mozilla/5.0 Chrome/140.0 Safari/537.36',
      body: { path: `/share/${share.token}?quelle=test#abschnitt`, visitor_id: 'browser-visitor' },
    });
    expect(browser.status).toBe(200);
    expect((await db.prepare(`SELECT COUNT(*) AS count FROM page_view_events`).first<{ count: number }>())?.count).toBe(eventCountBefore + 1);

    harness.run(`UPDATE parties SET status = 'blocked' WHERE id = 100`);
    const access = await jsonRequest(harness, '/api/creator-sharing/parties', { token: creator });
    expect(await access.json()).toMatchObject({ access_state: 'blocked', parties: [] });
    expect((await jsonRequest(harness, '/api/creator-sharing/creator-shares?party_id=100', { token: creator })).status).toBe(404);
    expect((await jsonRequest(harness, '/api/creator-sharing/dashboard?party_id=100', { token: creator })).status).toBe(404);
    expect((await jsonRequest(harness, `/api/creator-sharing/creator-shares/${share.id}/preview`, { token: creator })).status).toBe(403);
    const publicResponse = await jsonRequest(harness, `/api/creator-sharing/shares/${share.token}`);
    expect(publicResponse.status).toBe(410);
    expect(await publicResponse.json()).toMatchObject({ code: 'SHARE_UNAVAILABLE' });
    const importResponse = await jsonRequest(harness, `/api/creator-sharing/shares/${share.token}/preflight`, {
      method: 'POST', token: importer, body: { target_mode: 'new', stack_name: 'Gesperrt' },
    });
    expect(importResponse.status).toBe(410);
    expect(await importResponse.json()).toMatchObject({ code: 'SHARE_UNAVAILABLE' });
  });

  it('keeps moderation feedback private, never revokes on admin block and sends one escaped post-commit mail', async () => {
    const creator = await authToken(100, 'user', 'creator@test.invalid');
    const admin = await authToken(102, 'admin', 'admin@test.invalid');
    const createdResponse = await jsonRequest(harness, '/api/creator-sharing/shares', {
      method: 'POST', token: creator,
      body: {
        party_id: 100,
        stack_id: 100,
        type: 'stack',
        title: 'Titel <script>alert(1)</script>',
        creator_statements: { 100: 'Hinweis' },
      },
    });
    const share = await createdResponse.json() as { id: number; token: string; snapshot_hash: string; version: number };

    const missingReason = await jsonRequest(harness, `/api/admin/creator-sharing/shares/${share.id}`, {
      method: 'PATCH', token: admin,
      body: {
        expected_version: share.version, expected_snapshot_hash: share.snapshot_hash,
        expected_moderation_status: 'pending', expected_is_revoked: 0,
        expected_paused_at: null, expected_expires_at: null, expected_archived_at: null,
        moderation_status: 'blocked', moderation_reason: '', moderation_target: 'general', moderation_item_index: null,
      },
    });
    expect(missingReason.status).toBe(400);

    const blocked = await jsonRequest(harness, `/api/admin/creator-sharing/shares/${share.id}`, {
      method: 'PATCH', token: admin,
      body: {
        expected_version: share.version, expected_snapshot_hash: share.snapshot_hash,
        expected_moderation_status: 'pending', expected_is_revoked: 0,
        expected_paused_at: null, expected_expires_at: null, expected_archived_at: null,
        moderation_status: 'blocked',
        moderation_reason: 'Bitte <img src=x onerror=alert(2)> einfacher erklären.',
        moderation_target: 'creator_statement', moderation_item_index: 0,
      },
    });
    expect(blocked.status).toBe(200);
    expect(await blocked.json()).toMatchObject({ notification_status: 'sent' });
    const stored = await db.prepare(`
      SELECT moderation_status, moderation_reason, moderation_target,
        moderation_item_index, is_revoked, version
      FROM share_links WHERE id = ?
    `).bind(share.id).first<Record<string, unknown>>();
    expect(stored).toMatchObject({
      moderation_status: 'blocked',
      moderation_target: 'creator_statement',
      moderation_item_index: 0,
      is_revoked: 0,
      version: 2,
    });
    expect(sendMailMock).toHaveBeenCalledTimes(1);
    const moderationMail = sendMailMock.mock.calls[0][1] as { to: string; html: string };
    expect(moderationMail.to).toBe('creator@test.invalid');
    expect(moderationMail.html).toContain('/creator?bereich=portfolio&amp;editShare=');
    expect(moderationMail.html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
    expect(moderationMail.html).toContain('&lt;img src=x onerror=alert(2)&gt;');
    expect(moderationMail.html).not.toContain('<script>');
    expect(moderationMail.html).not.toContain('<img src=x');

    const notification = await db.prepare(`
      SELECT status, attempts, last_error
      FROM creator_share_notification_events
      WHERE share_link_id = ? AND share_version = 2
    `).bind(share.id).first<Record<string, unknown>>();
    expect(notification).toMatchObject({ status: 'sent', attempts: 1, last_error: null });

    const creatorList = await jsonRequest(harness, '/api/creator-sharing/creator-shares?party_id=100', { token: creator });
    const listShare = ((await creatorList.json()) as { shares: Array<Record<string, unknown>> }).shares[0];
    expect(listShare).toMatchObject({
      moderation_reason: 'Bitte <img src=x onerror=alert(2)> einfacher erklären.',
      moderation_target: 'creator_statement', moderation_item_index: 0,
    });
    expect(typeof listShare.moderation_item_name).toBe('string');
    expect(listShare).not.toHaveProperty('views');
    const privatePreview = await jsonRequest(harness, `/api/creator-sharing/creator-shares/${share.id}/preview`, { token: creator });
    const privatePreviewPayload = await privatePreview.json() as Record<string, unknown>;
    expect(privatePreviewPayload).toMatchObject({
      entity_id: 100,
      source_stack_id: 100,
      moderation_reason: 'Bitte <img src=x onerror=alert(2)> einfacher erklären.',
      moderation_target: 'creator_statement', moderation_item_index: 0,
    });
    expect(privatePreviewPayload.moderation_item_name).toBe(listShare.moderation_item_name);
    const publicResponse = await jsonRequest(harness, `/api/creator-sharing/shares/${share.token}`);
    expect(publicResponse.status).toBe(410);
    const publicPayload = await publicResponse.json() as Record<string, unknown>;
    expect(publicPayload).not.toHaveProperty('moderation_reason');
    expect(publicPayload).not.toHaveProperty('entity_id');
    expect(publicPayload).not.toHaveProperty('source_stack_id');
    expect(publicPayload).not.toHaveProperty('source_stack_name');
    expect(publicPayload).not.toHaveProperty('version');
    expect(publicPayload).not.toHaveProperty('snapshot_hash');
    expect(publicPayload).not.toHaveProperty('archived_at');
    expect(JSON.stringify(publicPayload)).not.toContain('einfacher erklären');

    const stale = await jsonRequest(harness, `/api/admin/creator-sharing/shares/${share.id}`, {
      method: 'PATCH', token: admin,
      body: {
        expected_version: 1, expected_snapshot_hash: share.snapshot_hash,
        expected_moderation_status: 'pending', expected_is_revoked: 0,
        expected_paused_at: null, expected_expires_at: null, expected_archived_at: null,
        moderation_status: 'approved', moderation_reason: null, moderation_target: null, moderation_item_index: null,
      },
    });
    expect(stale.status).toBe(409);
    expect(sendMailMock).toHaveBeenCalledTimes(1);
    expect((await db.prepare(`SELECT COUNT(*) AS count FROM creator_share_notification_events WHERE share_link_id = ?`).bind(share.id).first<{ count: number }>())?.count).toBe(1);

    harness.run(`UPDATE share_links SET is_revoked = 1 WHERE id = ?`, share.id);
    const endedByCreator = await jsonRequest(harness, `/api/admin/creator-sharing/shares/${share.id}`, {
      method: 'PATCH', token: admin,
      body: {
        expected_version: 2, expected_snapshot_hash: share.snapshot_hash,
        expected_moderation_status: 'blocked', expected_is_revoked: 1,
        expected_paused_at: null, expected_expires_at: null, expected_archived_at: null,
        moderation_status: 'approved', moderation_reason: null, moderation_target: null, moderation_item_index: null,
      },
    });
    expect(endedByCreator.status).toBe(409);
    expect(sendMailMock).toHaveBeenCalledTimes(1);
    expect((await db.prepare(`SELECT COUNT(*) AS count FROM creator_share_notification_events WHERE share_link_id = ?`).bind(share.id).first<{ count: number }>())?.count).toBe(1);

    const adminList = await jsonRequest(harness, '/api/admin/creator-sharing/shares', { token: admin });
    const adminShare = ((await adminList.json()) as { shares: Array<Record<string, unknown>> }).shares.find((entry) => entry.id === share.id)!;
    expect(adminShare).not.toHaveProperty('views');
    expect(adminShare).not.toHaveProperty('imports');
  });

  it('records failed and skipped moderation mail once and claims a parallel delivery once', async () => {
    const creator = await authToken(100, 'user', 'creator@test.invalid');
    const admin = await authToken(102, 'admin', 'admin@test.invalid');
    const createShare = async (title: string) => {
      const response = await jsonRequest(harness, '/api/creator-sharing/shares', {
        method: 'POST', token: creator,
        body: { party_id: 100, stack_id: 100, type: 'stack', title },
      });
      expect(response.status).toBe(201);
      return response.json() as Promise<{ id: number; snapshot_hash: string; version: number }>;
    };
    const approvalBody = (share: { snapshot_hash: string; version: number }) => ({
      expected_version: share.version,
      expected_snapshot_hash: share.snapshot_hash,
      expected_moderation_status: 'pending',
      expected_is_revoked: 0,
      expected_paused_at: null,
      expected_expires_at: null,
      expected_archived_at: null,
      moderation_status: 'approved',
      moderation_reason: null,
      moderation_target: null,
      moderation_item_index: null,
    });

    const failedShare = await createShare('Mail schlägt fehl');
    sendMailMock.mockResolvedValueOnce({ ok: false, error: 'provider detail must not persist' });
    const failed = await jsonRequest(harness, `/api/admin/creator-sharing/shares/${failedShare.id}`, {
      method: 'PATCH', token: admin, body: approvalBody(failedShare),
    });
    expect(failed.status).toBe(200);
    expect(await failed.json()).toMatchObject({ notification_status: 'failed' });
    expect(await db.prepare(`
      SELECT status, attempts, last_error
      FROM creator_share_notification_events WHERE share_link_id = ?
    `).bind(failedShare.id).first()).toEqual({
      status: 'failed', attempts: 1, last_error: 'mail_delivery_failed',
    });

    const skippedShare = await createShare('Kein Empfänger');
    harness.run(`UPDATE share_links SET creator_user_id = NULL WHERE id = ?`, skippedShare.id);
    const skipped = await jsonRequest(harness, `/api/admin/creator-sharing/shares/${skippedShare.id}`, {
      method: 'PATCH', token: admin, body: approvalBody(skippedShare),
    });
    expect(skipped.status).toBe(200);
    expect(await skipped.json()).toMatchObject({ notification_status: 'skipped' });
    expect(await db.prepare(`
      SELECT status, attempts, last_error
      FROM creator_share_notification_events WHERE share_link_id = ?
    `).bind(skippedShare.id).first()).toEqual({
      status: 'skipped', attempts: 1, last_error: 'recipient_unavailable',
    });
    expect(sendMailMock).toHaveBeenCalledTimes(1);

    const parallelShare = await createShare('Parallel nur einmal');
    const parallelBody = approvalBody(parallelShare);
    const parallel = await Promise.all([
      jsonRequest(harness, `/api/admin/creator-sharing/shares/${parallelShare.id}`, {
        method: 'PATCH', token: admin, body: parallelBody,
      }),
      jsonRequest(harness, `/api/admin/creator-sharing/shares/${parallelShare.id}`, {
        method: 'PATCH', token: admin, body: parallelBody,
      }),
    ]);
    expect(parallel.map((response) => response.status).sort()).toEqual([200, 409]);
    expect(sendMailMock).toHaveBeenCalledTimes(2);
    expect((await db.prepare(`
      SELECT COUNT(*) AS count
      FROM creator_share_notification_events WHERE share_link_id = ?
    `).bind(parallelShare.id).first<{ count: number }>())?.count).toBe(1);
    expect(await db.prepare(`
      SELECT status, attempts
      FROM creator_share_notification_events WHERE share_link_id = ?
    `).bind(parallelShare.id).first()).toEqual({ status: 'sent', attempts: 1 });
  });

  it('binds pause and archive races and keeps paused links unavailable for preview and import', async () => {
    const creator = await authToken(100, 'user', 'creator@test.invalid');
    const admin = await authToken(102, 'admin', 'admin@test.invalid');
    const importer = await authToken(101, 'user', 'importer@test.invalid');
    const createdResponse = await jsonRequest(harness, '/api/creator-sharing/shares', {
      method: 'POST', token: creator,
      body: { party_id: 100, stack_id: 100, type: 'stack', title: 'Lebenszyklus' },
    });
    const share = await createdResponse.json() as { id: number; token: string; snapshot_hash: string; version: number };
    const approval = await jsonRequest(harness, `/api/admin/creator-sharing/shares/${share.id}`, {
      method: 'PATCH', token: admin,
      body: {
        expected_version: 1, expected_snapshot_hash: share.snapshot_hash,
        expected_moderation_status: 'pending', expected_is_revoked: 0,
        expected_paused_at: null, expected_expires_at: null, expected_archived_at: null,
        moderation_status: 'approved', moderation_reason: null, moderation_target: null, moderation_item_index: null,
      },
    });
    expect(approval.status).toBe(200);

    const pause = await jsonRequest(harness, `/api/creator-sharing/creator-shares/${share.id}/lifecycle`, {
      method: 'PATCH', token: creator,
      body: {
        action: 'pause', expected_version: 2, expected_snapshot_hash: share.snapshot_hash,
        expected_status: 'approved', expected_moderation_status: 'approved', expected_is_revoked: 0,
        expected_paused_at: null, expected_expires_at: null,
      },
    });
    expect(pause.status).toBe(200);
    const paused = await pause.json() as { version: number; paused_at: number; status: string };
    expect(paused).toMatchObject({ version: 3, status: 'paused' });
    const stalePause = await jsonRequest(harness, `/api/creator-sharing/creator-shares/${share.id}/lifecycle`, {
      method: 'PATCH', token: creator,
      body: {
        action: 'pause', expected_version: 2, expected_snapshot_hash: share.snapshot_hash,
        expected_status: 'approved', expected_moderation_status: 'approved', expected_is_revoked: 0,
        expected_paused_at: null, expected_expires_at: null,
      },
    });
    expect(stalePause.status).toBe(409);
    const pausedPublic = await jsonRequest(harness, `/api/creator-sharing/shares/${share.token}`);
    expect(pausedPublic.status).toBe(409);
    expect(await pausedPublic.json()).toMatchObject({ code: 'SHARE_PAUSED' });
    const pausedImport = await jsonRequest(harness, `/api/creator-sharing/shares/${share.token}/preflight`, {
      method: 'POST', token: importer, body: { target_mode: 'new', stack_name: 'Pausiert' },
    });
    expect(pausedImport.status).toBe(409);
    expect(await pausedImport.json()).toMatchObject({ code: 'SHARE_PAUSED' });

    const archived = await jsonRequest(harness, `/api/creator-sharing/creator-shares/${share.id}/archive`, {
      method: 'PATCH', token: creator,
      body: { archived: true, expected_version: 3, expected_snapshot_hash: share.snapshot_hash, expected_archived_at: null },
    });
    expect(archived.status).toBe(200);
    const archivedPayload = await archived.json() as { version: number; archived_at: number };
    expect(archivedPayload.version).toBe(4);
    expect((await jsonRequest(harness, '/api/creator-sharing/creator-shares?party_id=100&archive=active', { token: creator }).then((response) => response.json()) as { shares: unknown[] }).shares).toHaveLength(0);
    expect((await jsonRequest(harness, '/api/creator-sharing/creator-shares?party_id=100&archive=archived', { token: creator }).then((response) => response.json()) as { shares: unknown[] }).shares).toHaveLength(1);
    const archivedDeepLink = await jsonRequest(harness, `/api/creator-sharing/creator-shares/${share.id}/preview`, { token: creator });
    expect(archivedDeepLink.status).toBe(200);
    expect(await archivedDeepLink.json()).toMatchObject({
      share_id: share.id,
      entity_id: 100,
      source_stack_id: 100,
      archived_at: archivedPayload.archived_at,
      version: 4,
    });
    const staleArchive = await jsonRequest(harness, `/api/creator-sharing/creator-shares/${share.id}/archive`, {
      method: 'PATCH', token: creator,
      body: { archived: false, expected_version: 3, expected_snapshot_hash: share.snapshot_hash, expected_archived_at: null },
    });
    expect(staleArchive.status).toBe(409);

    const boundaryResponse = await jsonRequest(harness, '/api/creator-sharing/shares', {
      method: 'POST', token: creator,
      body: { party_id: 100, stack_id: 100, type: 'stack', title: 'Bereits abgelaufen' },
    });
    const boundary = await boundaryResponse.json() as { id: number; token: string; snapshot_hash: string; version: number };
    const expiredAt = Math.floor(Date.now() / 1000) - 1;
    harness.run(`UPDATE share_links SET moderation_status = 'approved', expires_at = ? WHERE id = ?`, expiredAt, boundary.id);
    const staleStatus = await jsonRequest(harness, `/api/creator-sharing/creator-shares/${boundary.id}/lifecycle`, {
      method: 'PATCH', token: creator,
      body: {
        action: 'pause', expected_version: boundary.version, expected_snapshot_hash: boundary.snapshot_hash,
        expected_status: 'approved', expected_moderation_status: 'approved', expected_is_revoked: 0,
        expected_paused_at: null, expected_expires_at: expiredAt,
      },
    });
    expect(staleStatus.status).toBe(409);
    expect(await db.prepare(`SELECT version, paused_at FROM share_links WHERE id = ?`).bind(boundary.id).first())
      .toEqual({ version: boundary.version, paused_at: null });

    for (const expiryAction of ['clear_expiry', 'set_expiry'] as const) {
      const expiredMutation = await jsonRequest(harness, `/api/creator-sharing/creator-shares/${boundary.id}/lifecycle`, {
        method: 'PATCH', token: creator,
        body: {
          action: expiryAction,
          ...(expiryAction === 'set_expiry' ? { expires_at: Math.floor(Date.now() / 1000) + 86_400 } : {}),
          expected_version: boundary.version,
          expected_snapshot_hash: boundary.snapshot_hash,
          expected_status: 'expired',
          expected_moderation_status: 'approved',
          expected_is_revoked: 0,
          expected_paused_at: null,
          expected_expires_at: expiredAt,
        },
      });
      expect(expiredMutation.status).toBe(409);
      expect(await expiredMutation.json()).toMatchObject({
        error: expect.stringContaining('Neuauflage'),
      });
      expect(await db.prepare(`
        SELECT version, expires_at, paused_at, is_revoked
        FROM share_links WHERE id = ?
      `).bind(boundary.id).first()).toEqual({
        version: boundary.version,
        expires_at: expiredAt,
        paused_at: null,
        is_revoked: 0,
      });
      const expiredPublic = await jsonRequest(harness, `/api/creator-sharing/shares/${boundary.token}`);
      expect(expiredPublic.status).toBe(410);
      expect(await expiredPublic.json()).toMatchObject({ code: 'SHARE_EXPIRED' });
    }
  });

  it('counts exact consented token routes in two equal visible 30-day windows and groups clicks by shop', async () => {
    const creator = await authToken(100, 'user', 'creator@test.invalid');
    const firstResponse = await jsonRequest(harness, '/api/creator-sharing/shares', {
      method: 'POST', token: creator,
      body: { party_id: 100, stack_id: 100, type: 'stack', title: 'Metrik Alpha' },
    });
    const secondResponse = await jsonRequest(harness, '/api/creator-sharing/shares', {
      method: 'POST', token: creator,
      body: { party_id: 100, stack_id: 100, type: 'stack', title: 'Metrik Beta' },
    });
    const first = await firstResponse.json() as { id: number; snapshot_hash: string };
    const second = await secondResponse.json() as { id: number };
    const firstToken = 'metric_token_abcdefghijkl';
    const secondToken = 'metricXtoken_abcdefghijkl';
    harness.run(`UPDATE share_links SET token = ?, moderation_status = 'approved', views = 777, created_at = 200 WHERE id = ?`, firstToken, first.id);
    harness.run(`UPDATE share_links SET token = ?, moderation_status = 'approved', views = 888, created_at = 100 WHERE id = ?`, secondToken, second.id);

    harness.run(`INSERT INTO page_view_events (path, visitor_id, created_at) VALUES (?, 'same-browser', datetime('now', '-2 days'))`, `/share/${firstToken}`);
    harness.run(`INSERT INTO page_view_events (path, visitor_id, created_at) VALUES (?, 'same-browser', datetime('now', '-1 day'))`, `/share/${firstToken}?quelle=mail`);
    harness.run(`INSERT INTO page_view_events (path, visitor_id, created_at) VALUES (?, 'hash-browser', datetime('now'))`, `/share/${firstToken}#produkt`);
    harness.run(`INSERT INTO page_view_events (path, visitor_id, created_at) VALUES (?, 'current-boundary', date('now', '-29 days'))`, `/share/${firstToken}`);
    harness.run(`INSERT INTO page_view_events (path, visitor_id, created_at) VALUES (?, 'other-token', datetime('now'))`, `/share/${secondToken}`);
    harness.run(`INSERT INTO page_view_events (path, visitor_id, created_at) VALUES (?, 'prefix-collision', datetime('now'))`, `/share/${firstToken}suffix?x=1`);
    harness.run(`INSERT INTO page_view_events (path, visitor_id, created_at) VALUES (?, NULL, datetime('now'))`, `/share/${firstToken}`);
    harness.run(`INSERT INTO page_view_events (path, visitor_id, created_at) VALUES (?, 'previous-last', date('now', '-30 days'))`, `/share/${firstToken}`);
    harness.run(`INSERT INTO page_view_events (path, visitor_id, created_at) VALUES (?, 'previous-first', date('now', '-59 days'))`, `/share/${firstToken}`);
    harness.run(`INSERT INTO page_view_events (path, visitor_id, created_at) VALUES (?, 'too-old', date('now', '-60 days'))`, `/share/${firstToken}`);
    harness.run(`INSERT INTO page_view_events (path, visitor_id, created_at) VALUES (?, 'too-new', date('now', '+1 day'))`, `/share/${firstToken}`);

    harness.run(`INSERT INTO share_import_operations (idempotency_key, share_link_id, user_id, result_json, created_at) VALUES ('metric-save-current-0001', ?, 101, '{}', datetime('now'))`, first.id);
    harness.run(`INSERT INTO share_import_operations (idempotency_key, share_link_id, user_id, result_json, created_at) VALUES ('metric-save-current-0002', ?, 101, '{}', datetime('now', '-1 day'))`, first.id);
    harness.run(`INSERT INTO share_import_operations (idempotency_key, share_link_id, user_id, result_json, created_at) VALUES ('metric-save-previous-001', ?, 101, '{}', date('now', '-30 days'))`, first.id);

    const target = await db.prepare(`
      SELECT id, product_id, shop_domain_id, url
      FROM product_shop_links
      WHERE shop_domain_id IS NOT NULL AND active = 1
      ORDER BY id LIMIT 1
    `).first<{ id: number; product_id: number; shop_domain_id: number; url: string }>();
    harness.run(`
      INSERT INTO product_shop_links (
        product_id, shop_domain_id, url, is_affiliate, affiliate_owner_type,
        source_type, is_primary, active, sort_order, link_kind
      ) VALUES (?, ?, ?, 0, 'none', 'admin', 0, 1, 99, 'base_target')
    `, target!.product_id, target!.shop_domain_id, `${target!.url}${target!.url.includes('?') ? '&' : '?'}variant=2`);
    const secondLink = await db.prepare(`SELECT MAX(id) AS id FROM product_shop_links`).first<{ id: number }>();
    harness.run(`
      INSERT INTO product_link_clicks (
        product_type, product_id, shop_link_id, is_affiliate, url_snapshot,
        creator_context_party_id, clicked_at
      ) VALUES ('catalog', ?, ?, 0, ?, 100, datetime('now'))
    `, target!.product_id, target!.id, target!.url);
    harness.run(`
      INSERT INTO product_link_clicks (
        product_type, product_id, shop_link_id, is_affiliate, url_snapshot,
        creator_context_party_id, clicked_at
      ) VALUES ('catalog', ?, ?, 0, ?, 100, datetime('now'))
    `, target!.product_id, secondLink!.id, target!.url);

    const portfolioResponse = await jsonRequest(harness, '/api/creator-sharing/creator-shares?party_id=100&q=alpha&status=approved&sort=newest&limit=1', { token: creator });
    expect(portfolioResponse.status).toBe(200);
    const portfolio = await portfolioResponse.json() as {
      shares: Array<{ id: number; metrics: Record<string, number> }>;
      metrics_period: { days: number; from: string; to: string; previous_from: string; previous_to: string; unique_visitors_definition: string };
    };
    expect(portfolio.shares).toHaveLength(1);
    expect(portfolio.shares[0]).toMatchObject({
      id: first.id,
      metrics: { unique_visitors: 3, previous_unique_visitors: 2, saves: 2, previous_saves: 1 },
    });
    expect(portfolio.shares[0]).not.toHaveProperty('views');
    expect(portfolio.metrics_period.days).toBe(30);
    expect((new Date(portfolio.metrics_period.to).getTime() - new Date(portfolio.metrics_period.from).getTime()) / 86_400_000).toBe(29);
    expect((new Date(portfolio.metrics_period.previous_to).getTime() - new Date(portfolio.metrics_period.previous_from).getTime()) / 86_400_000).toBe(29);
    expect(portfolio.metrics_period.unique_visitors_definition).toContain('soweit sie erkennbar sind');

    const firstPage = await jsonRequest(harness, '/api/creator-sharing/creator-shares?party_id=100&archive=active&sort=newest&limit=1', { token: creator });
    const firstPagePayload = await firstPage.json() as { shares: Array<{ id: number }>; has_more: boolean; next_cursor: string };
    expect(firstPagePayload).toMatchObject({ shares: [{ id: first.id }], has_more: true });
    const nextPage = await jsonRequest(harness, `/api/creator-sharing/creator-shares?party_id=100&archive=active&sort=newest&limit=1&cursor=${encodeURIComponent(firstPagePayload.next_cursor)}`, { token: creator });
    expect(await nextPage.json()).toMatchObject({ shares: [{ id: second.id }], has_more: false });

    const dashboardResponse = await jsonRequest(harness, '/api/creator-sharing/dashboard?party_id=100&period_days=30', { token: creator });
    expect(dashboardResponse.status).toBe(200);
    const dashboard = await dashboardResponse.json() as {
      current: Record<string, number>;
      previous: Record<string, number>;
      period: { from: string; to: string; previous_from: string; previous_to: string; definitions: Record<string, string> };
      trend: Array<{ date: string; unique_visitors: number }>;
    };
    expect(dashboard.current).toMatchObject({ unique_visitors: 4, clicks: 2, saves: 2, clicked_shops: 1 });
    expect(dashboard.period.definitions.saves).toContain('Übernahmen in einen Stack');
    expect(dashboard.period.definitions.saves).toContain('nicht einzelne Produkte');
    expect(dashboard.period.definitions.imported_stacks).toContain('nicht im Papierkorb');
    expect(dashboard.previous).toMatchObject({ unique_visitors: 2, saves: 1 });
    expect(dashboard.trend).toHaveLength(30);
    expect(dashboard.trend[0].date).toBe(dashboard.period.from.slice(0, 10));
    expect(dashboard.trend[dashboard.trend.length - 1]?.date).toBe(dashboard.period.to.slice(0, 10));
    expect(dashboard.period.definitions.clicked_shops).toContain('Shop-Domain');

    const publicBefore = (await db.prepare(`SELECT views FROM share_links WHERE id = ?`).bind(first.id).first<{ views: number }>())?.views;
    expect((await jsonRequest(harness, `/api/creator-sharing/shares/${firstToken}`)).status).toBe(200);
    expect((await db.prepare(`SELECT views FROM share_links WHERE id = ?`).bind(first.id).first<{ views: number }>())?.views).toBe(publicBefore);
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
