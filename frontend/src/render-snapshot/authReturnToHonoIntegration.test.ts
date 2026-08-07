import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { buildEmailVerificationMessage } from '../../../functions/api/lib/mail';
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
});
