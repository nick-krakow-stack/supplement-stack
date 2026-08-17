import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { buildEmailVerificationMessage, buildPasswordResetMessage } from '../../../functions/api/lib/mail';
import { hashPassword, hashResetToken } from '../../../functions/api/lib/helpers';
import { validateReturnTo } from '../../../functions/api/lib/return-to';
import { fetchAuthReturnToHono } from './authReturnToHonoHandlers.mjs';
import { createProductionKnowledgeHonoHarness, type ProductionKnowledgeHonoHarness } from './productionKnowledgeHonoTestHarness';

vi.mock('cloudflare:sockets', () => ({ connect: vi.fn() }));

const JWT_SECRET = 'auth-return-to-test-secret-that-is-long-enough';
type TestDatabase = {
  prepare: (sql: string) => {
    bind: (...values: unknown[]) => { first: <T>() => Promise<T | null> };
    first: <T>() => Promise<T | null>;
  };
};

async function authToken(userId: number, email: string): Promise<string> {
  const encode = (value: string) => Buffer.from(value).toString('base64url');
  const header = encode(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const payload = encode(JSON.stringify({ userId, role: 'user', email, exp: Math.floor(Date.now() / 1000) + 3600 }));
  const input = `${header}.${payload}`;
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(JWT_SECRET), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(input));
  return `${input}.${Buffer.from(signature).toString('base64url')}`;
}

function applyAllMigrations(harness: ProductionKnowledgeHonoHarness): void {
  const directory = resolve(process.cwd(), '..', 'd1-migrations');
  for (const file of readdirSync(directory).filter((name) => /^\d+.*\.sql$/.test(name)).sort()) {
    harness.exec(readFileSync(resolve(directory, file), 'utf8'));
  }
}

describe('auth returnTo backend contract', () => {
  let harness: ProductionKnowledgeHonoHarness;

  beforeEach(() => {
    harness = createProductionKnowledgeHonoHarness();
    applyAllMigrations(harness);
  });

  afterEach(() => harness.close());

  it('accepts only internal return targets and HTML-escapes the verification link', () => {
    const returnTo = '/share/abcdefghijklmnopqrstuvwxyz123456?view=full&tab=1#details';
    expect(validateReturnTo(returnTo)).toBe(returnTo);
    for (const unsafe of [
      'https://evil.example/path',
      '//evil.example/path',
      '/\\evil.example/path',
      '/%5cevil.example/path',
      '/%255cevil.example/path',
      '/%2f%2fevil.example/path',
      '/%252f%252fevil.example/path',
    ]) expect(validateReturnTo(unsafe)).toBeNull();

    const message = buildEmailVerificationMessage('https://supplementstack.de', 'token<&"', returnTo);
    const parsed = new URL(message.verifyUrl);
    expect(parsed.searchParams.get('token')).toBe('token<&"');
    expect(parsed.searchParams.get('returnTo')).toBe(returnTo);
    expect(message.html).toContain('&amp;returnTo=');
    expect(message.html).not.toContain(`href="${message.verifyUrl}"`);
    expect(message.html).not.toContain('token<&"');

    const passwordMessage = buildPasswordResetMessage('https://supplementstack.de', 'reset<&"', returnTo);
    const passwordUrl = new URL(passwordMessage.resetUrl);
    expect(passwordUrl.searchParams.get('token')).toBe('reset<&"');
    expect(passwordUrl.searchParams.get('returnTo')).toBe(returnTo);
    expect(passwordMessage.html).toContain('&amp;returnTo=');
    expect(passwordMessage.html).not.toContain('reset<&"');
  });

  it('validates registration and resend return_to independently', async () => {
    const db = harness.db as TestDatabase;
    const request = async (path: string, body: unknown, token?: string) => {
      const headers = new Headers({ 'Content-Type': 'application/json' });
      if (token) headers.set('Authorization', `Bearer ${token}`);
      return fetchAuthReturnToHono(new Request(`https://supplementstack.de${path}`, {
        method: 'POST', headers, body: JSON.stringify(body),
      }), {
        DB: harness.db,
        JWT_SECRET,
        FRONTEND_URL: 'https://supplementstack.de',
      }, { waitUntil() {}, passThroughOnException() {}, props: {} });
    };

    const rejected = await request('/api/auth/register', {
      email: 'unsafe@test.invalid', password: 'password123', health_consent: true,
      return_to: '/%252f%252fevil.example',
    });
    expect(rejected.status).toBe(400);
    expect((await db.prepare(`SELECT COUNT(*) AS count FROM users WHERE email = 'unsafe@test.invalid'`).first<{ count: number }>())?.count).toBe(0);

    const returnTo = '/share/abcdefghijklmnopqrstuvwxyz123456?view=full#details';
    const registered = await request('/api/auth/register', {
      email: 'safe@test.invalid', password: 'password123', health_consent: true, return_to: returnTo,
    });
    expect(registered.status).toBe(200);
    const userId = (await db.prepare(`SELECT id FROM users WHERE email = 'safe@test.invalid'`).first<{ id: number }>())?.id ?? 0;
    expect(userId).toBeGreaterThan(0);
    expect((await db.prepare(`SELECT COUNT(*) AS count FROM email_verification_tokens WHERE user_id = ?`).bind(userId).first<{ count: number }>())?.count).toBe(1);

    const token = await authToken(userId, 'safe@test.invalid');
    const resendRejected = await request('/api/auth/resend-verification', { return_to: 'https://evil.example' }, token);
    expect(resendRejected.status).toBe(400);
    expect((await db.prepare(`SELECT COUNT(*) AS count FROM email_verification_tokens WHERE user_id = ?`).bind(userId).first<{ count: number }>())?.count).toBe(1);
  });

  it('exports the signed-in account data without secrets or retired family-profile fields', async () => {
    const userId = 501;
    const email = 'export@test.invalid';
    harness.run(`
      INSERT INTO users (
        id, email, password_hash, age, guideline_source, health_consent,
        health_consent_at, email_verified_at
      ) VALUES (?, ?, ?, ?, ?, 1, datetime('now'), datetime('now'))
    `, userId, email, 'not-exported-password-hash', 37, null);
    harness.run(
      `INSERT INTO consent_log (user_id, consent_type, granted) VALUES (?, 'health_data', 1)`,
      userId,
    );
    harness.run(`INSERT INTO stacks (id, user_id, name) VALUES (?, ?, ?)`, 601, userId, 'Mein Export-Stack');

    const token = await authToken(userId, email);
    const response = await fetchAuthReturnToHono(new Request('https://supplementstack.de/api/me/export', {
      headers: { Authorization: `Bearer ${token}` },
    }), {
      DB: harness.db,
      JWT_SECRET,
      FRONTEND_URL: 'https://supplementstack.de',
    }, { waitUntil() {}, passThroughOnException() {}, props: {} });

    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('private, no-store');
    expect(response.headers.get('content-disposition')).toMatch(/^attachment; filename="supplement-stack-daten-\d{4}-\d{2}-\d{2}\.json"$/);
    const payload = await response.json() as Record<string, unknown>;
    expect(payload.format).toBe('supplement_stack_user_data.v1');
    expect(payload.account).toMatchObject({ id: userId, email, age: 37, guideline_source: null });
    expect(payload.consent_history).toEqual(expect.arrayContaining([
      expect.objectContaining({ consent_type: 'health_data', granted: 1 }),
    ]));
    expect(payload.stacks).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 601, name: 'Mein Export-Stack' }),
    ]));
    expect(payload).not.toHaveProperty('family_profiles');
    expect(JSON.stringify(payload)).not.toContain('not-exported-password-hash');
    expect(JSON.stringify(payload)).not.toContain('reset_token');
  });

  it('deletes active and expired share undo records with the account and confirms the exact event', async () => {
    const userId = 504;
    const email = 'delete-with-undo@test.invalid';
    const password = 'delete-password-123';
    const passwordHash = await hashPassword(password);
    harness.run(`
      INSERT INTO users (
        id, email, password_hash, health_consent, health_consent_at, email_verified_at
      ) VALUES (?, ?, ?, 1, datetime('now'), datetime('now'))
    `, userId, email, passwordHash);
    harness.run(`INSERT INTO stacks (id, user_id, name) VALUES (704, ?, 'Zu löschender Stack')`, userId);
    harness.run(`
      INSERT INTO share_links (token, entity_type, entity_id, snapshot_json)
      VALUES ('account-delete-share-token-0001', 'stack', 704, '{}')
    `);
    const shareId = (await (harness.db as TestDatabase).prepare(`
      SELECT id FROM share_links WHERE token = 'account-delete-share-token-0001'
    `).first<{ id: number }>())?.id ?? 0;
    expect(shareId).toBeGreaterThan(0);
    const now = Math.floor(Date.now() / 1000);
    for (const entry of [
      { operationId: 804, key: 'account-delete-active-undo-0001', hash: 'a'.repeat(64), itemId: 904, expiresAt: now + 600 },
      { operationId: 805, key: 'account-delete-expired-undo-001', hash: 'b'.repeat(64), itemId: 905, expiresAt: now - 600 },
    ]) {
      harness.run(`
        INSERT INTO share_import_operations (
          id, idempotency_key, share_link_id, user_id, target_stack_id, result_json
        ) VALUES (?, ?, ?, ?, 704, '{}')
      `, entry.operationId, entry.key, shareId, userId);
      harness.run(`
        INSERT INTO creator_share_import_undos (
          operation_id, undo_token_hash, user_id, target_stack_id, stack_item_id,
          action, previous_item_json, previous_binding_json, expected_item_json,
          expected_binding_json, summary, expires_at, version
        ) VALUES (?, ?, ?, 704, ?, 'replaced', '{}', NULL, '{}', '{}', 'Rückgängig-Test', ?, 1)
      `, entry.operationId, entry.hash, userId, entry.itemId, entry.expiresAt);
    }

    const token = await authToken(userId, email);
    const response = await fetchAuthReturnToHono(new Request('https://supplementstack.de/api/me', {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    }), {
      DB: harness.db,
      JWT_SECRET,
      FRONTEND_URL: 'https://supplementstack.de',
    }, { waitUntil() {}, passThroughOnException() {}, props: {} });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true });
    const deleted = await (harness.db as TestDatabase).prepare(`
      SELECT
        (SELECT COUNT(*) FROM users WHERE id = 504) AS users,
        (SELECT COUNT(*) FROM stacks WHERE user_id = 504) AS stacks,
        (SELECT COUNT(*) FROM share_import_operations WHERE user_id = 504) AS operations,
        (SELECT COUNT(*) FROM creator_share_import_undos WHERE user_id = 504) AS undos
    `).first<Record<string, number>>();
    expect(deleted).toEqual({ users: 0, stacks: 0, operations: 0, undos: 0 });
    expect(await (harness.db as TestDatabase).prepare(`
      SELECT had_verified_email, stack_count, user_product_count
      FROM account_deletion_events WHERE deleted_user_id = 504
    `).first()).toEqual({ had_verified_email: 1, stack_count: 1, user_product_count: 0 });
  });

  it('does not record an account deletion event when the guarded delete batch rolls back', async () => {
    const userId = 505;
    const email = 'blocked-delete@test.invalid';
    const password = 'delete-password-123';
    harness.run(`
      INSERT INTO users (id, email, password_hash, health_consent, health_consent_at)
      VALUES (?, ?, ?, 1, datetime('now'))
    `, userId, email, await hashPassword(password));
    harness.exec(`
      CREATE TRIGGER block_test_account_delete
      BEFORE DELETE ON users
      WHEN OLD.id = 505
      BEGIN
        SELECT RAISE(ABORT, 'blocked test account delete');
      END;
    `);
    const token = await authToken(userId, email);
    const expectedError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    let response: Response;
    try {
      response = await fetchAuthReturnToHono(new Request('https://supplementstack.de/api/me', {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      }), {
        DB: harness.db,
        JWT_SECRET,
        FRONTEND_URL: 'https://supplementstack.de',
      }, { waitUntil() {}, passThroughOnException() {}, props: {} });
    } finally {
      expectedError.mockRestore();
    }

    expect(response.status).toBe(500);
    expect((await (harness.db as TestDatabase).prepare(`
      SELECT COUNT(*) AS count FROM users WHERE id = 505
    `).first<{ count: number }>())?.count).toBe(1);
    expect((await (harness.db as TestDatabase).prepare(`
      SELECT COUNT(*) AS count FROM account_deletion_events WHERE deleted_user_id = 505
    `).first<{ count: number }>())?.count).toBe(0);
  });

  it('allows only the two source preferences and keeps an explicit empty choice', async () => {
    const userId = 502;
    const email = 'preference@test.invalid';
    harness.run(`
      INSERT INTO users (id, email, password_hash, guideline_source, health_consent, health_consent_at)
      VALUES (?, ?, ?, NULL, 1, datetime('now'))
    `, userId, email, 'password-hash');
    const token = await authToken(userId, email);
    const request = (guidelineSource: unknown) => fetchAuthReturnToHono(new Request('https://supplementstack.de/api/me', {
      method: 'PUT',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ guideline_source: guidelineSource }),
    }), {
      DB: harness.db,
      JWT_SECRET,
      FRONTEND_URL: 'https://supplementstack.de',
    }, { waitUntil() {}, passThroughOnException() {}, props: {} });

    expect((await request('influencer')).status).toBe(400);
    const official = await request('DGE');
    expect(official.status).toBe(200);
    expect(await official.json()).toMatchObject({ profile: { guideline_source: 'DGE' } });
    const studies = await request('studien');
    expect(studies.status).toBe(200);
    expect(await studies.json()).toMatchObject({ profile: { guideline_source: 'studien' } });
    const empty = await request(null);
    expect(empty.status).toBe(200);
    expect(await empty.json()).toMatchObject({ profile: { guideline_source: null } });
  });

  it('distinguishes invalid and expired password-reset links', async () => {
    const userId = 503;
    const email = 'reset@test.invalid';
    const expiredRawToken = 'expired-reset-token';
    const expiredHash = await hashResetToken(expiredRawToken);
    harness.run(`
      INSERT INTO users (
        id, email, password_hash, reset_token, reset_token_expires_at,
        health_consent, health_consent_at
      ) VALUES (?, ?, ?, ?, ?, 1, datetime('now'))
    `, userId, email, 'password-hash', expiredHash, Date.now() - 1_000);

    const resetRequest = (token: string) => fetchAuthReturnToHono(new Request('https://supplementstack.de/api/auth/reset-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, password: 'new-password-123' }),
    }), {
      DB: harness.db,
      JWT_SECRET,
      FRONTEND_URL: 'https://supplementstack.de',
    }, { waitUntil() {}, passThroughOnException() {}, props: {} });

    const invalid = await resetRequest('unknown-reset-token');
    expect(invalid.status).toBe(400);
    expect(await invalid.json()).toMatchObject({ error: expect.stringContaining('ungültig') });
    const expired = await resetRequest(expiredRawToken);
    expect(expired.status).toBe(410);
    expect(await expired.json()).toMatchObject({ error: expect.stringContaining('abgelaufen') });
  });
});
