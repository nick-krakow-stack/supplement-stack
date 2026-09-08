import { readFileSync } from 'node:fs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createProductionKnowledgeHonoHarness, type ProductionKnowledgeHonoHarness } from './productionKnowledgeHonoTestHarness';
import { fetchCreatorSharingHono } from './creatorSharingHonoHandlers.mjs';
import { listPublicCreatorProfiles, loadPublicCreatorProfile, publicProfileDescription } from '../../../functions/api/lib/creator-public-profile';
import type { Env } from '../../../functions/api/lib/types';

vi.mock('cloudflare:sockets', () => ({ connect: vi.fn() }));
const SECRET = 'public-creator-profile-integration-secret';
const description = 'Ich stelle hier meinen Alltag und meine persönliche Organisation vor.';
type PrivatePayload = {
  party: { id: number; name: string; slug: string; type: 'creator' | 'brand'; profile_image_url: string | null };
  identity_hash: string; consent_version: string;
  profile: null | { status: string; description: string; version: number; review_fingerprint: string; identity_matches: boolean; published_at: string | null; moderation_reason: string | null };
};
let harness: ProductionKnowledgeHonoHarness;
let db: Env['DB'];
let ownerToken: string;
let editorToken: string;
let adminToken: string;
async function token(userId: number, role: string) {
  const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString('base64url');
  const data = `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode({ userId, role, email: 'private@test.invalid', exp: Math.floor(Date.now() / 1000) + 3600 })}`;
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(SECRET), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return `${data}.${Buffer.from(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(data))).toString('base64url')}`;
}
async function request(path: string, auth?: string, body?: unknown, options: { feature?: boolean; method?: string; cookieOrigin?: string; database?: Env['DB'] } = {}) {
  const headers = new Headers();
  if (auth) headers.set(options.cookieOrigin ? 'Cookie' : 'Authorization', options.cookieOrigin ? `session=${auth}` : `Bearer ${auth}`);
  if (options.cookieOrigin) headers.set('Origin', options.cookieOrigin);
  if (body !== undefined) headers.set('Content-Type', 'application/json');
  return fetchCreatorSharingHono(new Request(`https://supplementstack.de/api/${path}`, {
    method: options.method ?? (body === undefined ? 'GET' : 'POST'), headers, body: body === undefined ? undefined : JSON.stringify(body),
  }), { DB: options.database ?? db, JWT_SECRET: SECRET, FRONTEND_URL: 'https://supplementstack.de', CREATOR_STACK_SHARING_ENABLED: options.feature === false ? 'false' : 'true' }, { waitUntil() {}, passThroughOnException() {}, props: {} });
}
async function ownerState(id = 100) {
  const response = await request(`creator-sharing/parties/${id}/public-profile`, ownerToken);
  expect(response.status).toBe(200);
  return response.json() as Promise<PrivatePayload>;
}
async function submit(id = 100, text = description) {
  const state = await ownerState(id);
  const response = await request(`creator-sharing/parties/${id}/public-profile/submit`, ownerToken, {
    expected_version: state.profile?.version ?? null, expected_identity_hash: state.identity_hash,
    description: text, consent: true, consent_version: state.consent_version,
  });
  expect(response.status).toBe(200);
  return response.json() as Promise<PrivatePayload>;
}
async function review(state: PrivatePayload, decision = 'approve', reason?: string) {
  return request(`admin/creator-sharing/parties/${state.party.id}/public-profile/review`, adminToken, {
    expected_version: state.profile!.version, expected_review_fingerprint: state.profile!.review_fingerprint, decision, reason,
  });
}
async function approve(id = 100) {
  const pending = await submit(id);
  const response = await review(pending);
  expect(response.status).toBe(200);
  return response.json() as Promise<PrivatePayload>;
}
function beforeProfileWrite(action: () => void) {
  const original = db.prepare.bind(db);
  let fired = false;
  vi.spyOn(db, 'prepare').mockImplementation((sql: string) => {
    const wrap = (statement: ReturnType<Env['DB']['prepare']>): ReturnType<Env['DB']['prepare']> => new Proxy(statement, {
      get(target, property) {
        if (property === 'bind') return (...values: unknown[]) => wrap(target.bind(...values));
        if (property === 'run') return async () => { if (!fired) { fired = true; action(); } return target.run(); };
        const value: unknown = Reflect.get(target, property, target);
        return typeof value === 'function' ? value.bind(target) : value;
      },
    });
    const statement = original(sql);
    return /^(?:INSERT INTO|UPDATE) creator_public_profiles/.test(sql.trim()) ? wrap(statement) : statement;
  });
}

beforeEach(async () => {
  harness = createProductionKnowledgeHonoHarness();
  db = harness.db as Env['DB'];
  harness.exec(`
    CREATE TABLE users(id INTEGER PRIMARY KEY, email TEXT, role TEXT, deleted_at TEXT);
    CREATE TABLE parties(id INTEGER PRIMARY KEY, name TEXT, slug TEXT UNIQUE, type TEXT, status TEXT,
      public_profile_image_url TEXT, auto_catalog_approval INTEGER DEFAULT 0, version INTEGER DEFAULT 1, updated_at TEXT);
    CREATE TABLE party_memberships(party_id INTEGER REFERENCES parties(id), user_id INTEGER REFERENCES users(id), role TEXT, status TEXT, PRIMARY KEY(party_id,user_id));
    CREATE TABLE admin_audit_log(user_id INTEGER, action TEXT, entity_type TEXT, entity_id INTEGER, changes TEXT, reason TEXT, ip_address TEXT, user_agent TEXT);
    INSERT INTO users VALUES(100,'private-owner@test.invalid','user',NULL),(101,'private-editor@test.invalid','user',NULL),(102,'private-admin@test.invalid','admin',NULL);
    INSERT INTO parties(id,name,slug,type,status) VALUES(100,'Alex Alltag','alex-alltag','creator','active'),(101,'Beispiel Marke','beispiel--marke','brand','active');
    INSERT INTO party_memberships VALUES(100,100,'owner','active'),(100,101,'editor','active'),(101,100,'owner','active');
  `);
  harness.exec(readFileSync(new URL('../../../d1-migrations/0112_creator_public_profiles.sql', import.meta.url), 'utf8'));
  [ownerToken, editorToken, adminToken] = await Promise.all([token(100, 'user'), token(101, 'user'), token(102, 'admin')]);
});
afterEach(() => { vi.restoreAllMocks(); harness.close(); });

describe('opt-in public creator profile contract', () => {
  it('adds an empty publication table without publishing or changing existing identities', async () => {
    expect((await ownerState()).profile).toBeNull();
    expect(await listPublicCreatorProfiles(db)).toEqual([]);
    expect((await request('creator-sharing/public-profiles/alex-alltag')).status).toBe(404);
    expect(await db.prepare('SELECT name FROM parties WHERE id=100').first('name')).toBe('Alex Alltag');
  });
  it('requires explicit current consent, expected identity and owner authority', async () => {
    const state = await ownerState();
    const payload = { expected_version: null, expected_identity_hash: state.identity_hash, description, consent: true, consent_version: state.consent_version };
    expect((await request('creator-sharing/parties/100/public-profile/submit', undefined, payload)).status).toBe(401);
    expect((await request('creator-sharing/parties/100/public-profile/submit', editorToken, payload)).status).toBe(403);
    expect((await request('creator-sharing/parties/100/public-profile/submit', ownerToken, { ...payload, consent: false })).status).toBe(400);
    expect((await request('creator-sharing/parties/100/public-profile/submit', ownerToken, { ...payload, consent_version: 'old' })).status).toBe(400);
    expect((await request('creator-sharing/parties/100/public-profile/submit', ownerToken, { ...payload, expected_identity_hash: 'wrong' })).status).toBe(409);
    expect((await ownerState()).profile).toBeNull();
  });
  it('keeps submissions hidden until exact revision approval and outputs only the public contract', async () => {
    const pending = await submit();
    expect(pending.profile?.status).toBe('pending');
    expect(await loadPublicCreatorProfile(db, 'alex-alltag')).toBeNull();
    const response = await review(pending);
    expect(response.status).toBe(200);
    const publicResponse = await request('creator-sharing/public-profiles/alex-alltag');
    expect(publicResponse.status).toBe(200);
    expect(publicResponse.headers.get('Cache-Control')).toBe('private, no-store');
    const body = await publicResponse.json() as { profile: Record<string, unknown> };
    expect(Object.keys(body.profile).sort()).toEqual(['description', 'name', 'profile_image_url', 'published_at', 'slug', 'type']);
    expect(JSON.stringify(body)).not.toMatch(/private-|party_id|consent|moderation|token|snapshot/);
    expect(await listPublicCreatorProfiles(db)).toEqual([{ slug: 'alex-alltag', published_at: body.profile.published_at }]);
    const head = await request('creator-sharing/public-profiles/alex-alltag', undefined, undefined, { method: 'HEAD' });
    expect(head.status).toBe(200);
    expect(await head.text()).toBe('');
  });
  it('supports Brand identity and the shared slug grammar without a second catalogue', async () => {
    await approve(101);
    expect((await loadPublicCreatorProfile(db, 'beispiel--marke'))?.type).toBe('brand');
    expect((await listPublicCreatorProfiles(db)).map((row) => row.slug)).toEqual(['beispiel--marke']);
  });
  it('hides approved content immediately on resubmission and rejects stale approval or withdrawal', async () => {
    const approved = await approve();
    const next = await submit(100, 'Hier beschreibe ich meine Organisation und teile meinen persönlichen Alltag.');
    expect(await loadPublicCreatorProfile(db, 'alex-alltag')).toBeNull();
    expect((await review(approved)).status).toBe(409);
    expect((await request('creator-sharing/parties/100/public-profile/withdraw', ownerToken, { expected_version: approved.profile!.version })).status).toBe(409);
    expect(next.profile?.version).toBe(3);
  });
  it('withdraws without deleting identity, and cannot be resurrected by an old admin response', async () => {
    const pending = await submit();
    const response = await request('creator-sharing/parties/100/public-profile/withdraw', ownerToken, { expected_version: pending.profile!.version });
    expect(response.status).toBe(200);
    expect((await review(pending)).status).toBe(409);
    expect(await listPublicCreatorProfiles(db)).toEqual([]);
    expect(await db.prepare('SELECT count(*) AS n FROM parties').first('n')).toBe(2);
    const current = await ownerState();
    expect((await request('creator-sharing/parties/100/public-profile/withdraw', ownerToken, { expected_version: current.profile!.version })).status).toBe(200);
  });
  it('requires a useful rejection reason and returns it only to the private owner/admin flow', async () => {
    const pending = await submit();
    expect((await review(pending, 'reject', 'kurz')).status).toBe(400);
    expect((await review(pending, 'reject', 'Bitte beschreibe deine Tätigkeit ohne Gesundheitsversprechen.')).status).toBe(200);
    expect((await ownerState()).profile?.moderation_reason).toContain('Gesundheitsversprechen');
    expect(await loadPublicCreatorProfile(db, 'alex-alltag')).toBeNull();
  });
  it.each(['name', 'slug', 'type', 'public_profile_image_url'] as const)('invalidates %s changes irreversibly until fresh consent, while unrelated settings stay eligible', async (field) => {
    await approve();
    harness.run('UPDATE parties SET auto_catalog_approval=1, version=version+1 WHERE id=100');
    expect(await loadPublicCreatorProfile(db, 'alex-alltag')).not.toBeNull();
    const original = await db.prepare(`SELECT ${field} AS value FROM parties WHERE id=100`).first<{ value: string | null }>();
    const next = field === 'type' ? 'brand' : field === 'public_profile_image_url' ? 'https://example.com/avatar.png' : 'changed';
    harness.run(`UPDATE parties SET ${field}=? WHERE id=100`, next);
    harness.run(`UPDATE parties SET ${field}=? WHERE id=100`, original!.value);
    expect((await ownerState()).profile?.identity_matches).toBe(false);
    expect(await loadPublicCreatorProfile(db, 'alex-alltag')).toBeNull();
    expect(await listPublicCreatorProfiles(db)).toEqual([]);
    const newConsent = await submit();
    expect(newConsent.profile?.identity_matches).toBe(true);
    expect((await review(newConsent)).status).toBe(200);
    expect(await loadPublicCreatorProfile(db, 'alex-alltag')).not.toBeNull();
  });
  it.each([
    "UPDATE parties SET status='blocked' WHERE id=100",
    "UPDATE party_memberships SET status='revoked' WHERE party_id=100 AND user_id=100",
    "UPDATE users SET deleted_at=CURRENT_TIMESTAMP WHERE id=100",
  ])('public API and sitemap both hide an ineligible owner/party: %s', async (sql) => {
    await approve();
    harness.run(sql);
    expect(await loadPublicCreatorProfile(db, 'alex-alltag')).toBeNull();
    expect(await listPublicCreatorProfiles(db)).toEqual([]);
  });
  it.each([
    "UPDATE party_memberships SET status='revoked' WHERE party_id=100 AND user_id=100",
    "UPDATE parties SET status='blocked' WHERE id=100",
    "UPDATE parties SET name='Changed during submit' WHERE id=100",
  ])('guards the first INSERT against a change after the owner preflight: %s', async (sql) => {
    const state = await ownerState();
    beforeProfileWrite(() => harness.run(sql));
    const response = await request('creator-sharing/parties/100/public-profile/submit', ownerToken, { expected_version: null, expected_identity_hash: state.identity_hash, description, consent: true, consent_version: state.consent_version });
    expect(response.status).toBe(409);
    expect(await db.prepare('SELECT count(*) AS n FROM creator_public_profiles').first('n')).toBe(0);
  });
  it.each([
    "UPDATE users SET role='user' WHERE id=102",
    "UPDATE party_memberships SET status='revoked' WHERE party_id=100 AND user_id=100",
    "UPDATE parties SET name='Changed during review' WHERE id=100",
    "UPDATE creator_public_profiles SET status='withdrawn', withdrawn_at=CURRENT_TIMESTAMP, version=version+1 WHERE party_id=100",
  ])('guards review UPDATE against concurrent authority/content/withdrawal changes: %s', async (sql) => {
    const pending = await submit();
    beforeProfileWrite(() => harness.run(sql));
    expect((await review(pending)).status).toBe(409);
    expect(await loadPublicCreatorProfile(db, 'alex-alltag')).toBeNull();
  });
  it('rejects consent replay after a competing first submission', async () => {
    const before = await ownerState();
    await submit();
    const response = await request('creator-sharing/parties/100/public-profile/submit', ownerToken, { expected_version: null, expected_identity_hash: before.identity_hash, description, consent: true, consent_version: before.consent_version });
    expect(response.status).toBe(409);
    expect((await ownerState()).profile?.version).toBe(1);
  });
  it('guards owner resubmission against a concurrent identity edit after preflight', async () => {
    await approve();
    const state = await ownerState();
    beforeProfileWrite(() => harness.run("UPDATE parties SET name='New identity' WHERE id=100"));
    const response = await request('creator-sharing/parties/100/public-profile/submit', ownerToken, { expected_version: state.profile!.version, expected_identity_hash: state.identity_hash, description, consent: true, consent_version: state.consent_version });
    expect(response.status).toBe(409);
    expect((await ownerState()).profile?.identity_matches).toBe(false);
    expect(await loadPublicCreatorProfile(db, 'alex-alltag')).toBeNull();
  });
  it('guards owner withdrawal against a revoked membership at the actual UPDATE', async () => {
    const state = await approve();
    beforeProfileWrite(() => harness.run("UPDATE party_memberships SET status='revoked' WHERE party_id=100 AND user_id=100"));
    const response = await request('creator-sharing/parties/100/public-profile/withdraw', ownerToken, { expected_version: state.profile!.version });
    expect(response.status).toBe(409);
    expect(await db.prepare('SELECT status FROM creator_public_profiles WHERE party_id=100').first('status')).toBe('approved');
    expect(await loadPublicCreatorProfile(db, 'alex-alltag')).toBeNull();
  });
  it('does not apply the new profile feature middleware to existing administrative onboarding', async () => {
    const response = await request('admin/creator-sharing/parties', adminToken, { type: 'creator', name: 'Weiterer Creator', slug: 'weiterer-creator', owner_user_id: 100 }, { feature: false });
    expect(response.status).toBe(201);
    expect(await db.prepare('SELECT count(*) AS n FROM creator_public_profiles').first('n')).toBe(0);
  });
  it('keeps feature-disabled routes and malformed slugs away from storage; preserves real503 and cookie-origin guards', async () => {
    const broken = { prepare() { throw new Error('private database detail'); } } as unknown as Env['DB'];
    expect((await request('creator-sharing/public-profiles/alex-alltag', undefined, undefined, { feature: false, database: broken })).status).toBe(404);
    expect(await loadPublicCreatorProfile(broken, '../secret')).toBeNull();
    const failed = await request('creator-sharing/public-profiles/alex-alltag', undefined, undefined, { database: broken });
    expect(failed.status).toBe(503);
    expect(failed.headers.get('Cache-Control')).toBe('private, no-store');
    expect(await failed.text()).not.toContain('private database detail');
    expect((await request('creator-sharing/parties/100/public-profile/submit', ownerToken, {}, { cookieOrigin: 'https://evil.example' })).status).toBe(403);
  });
  it('counts Unicode codepoints and rejects control characters, markup and invalid lengths', () => {
    expect(publicProfileDescription('ä'.repeat(40))).toBe('ä'.repeat(40));
    expect(publicProfileDescription('ä'.repeat(180))).toBe('ä'.repeat(180));
    for (const bad of ['x'.repeat(39), 'x'.repeat(181), `<b>${description}</b>`, `${description}\u200b`, `${description}\nTest`]) expect(publicProfileDescription(bad)).toBeNull();
  });
});
