import { JSDOM } from 'jsdom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { onRequest } from '../../../functions/_middleware';
import type { Env } from '../../../functions/api/lib/types';
import creatorSharing from '../../../functions/api/modules/creator-sharing';
import * as knowledge from '../../../functions/api/modules/knowledge-overview-projection';
import { hashResetToken } from '../../../functions/api/lib/helpers';

vi.mock('cloudflare:sockets', () => ({ connect: vi.fn() }));
const shell = '<!doctype html><html><head><title>Old</title><meta property="og:url" content="https://bad.test/secret"><meta name="twitter:title" content="Old"><script type="application/ld+json">{"old":true}</script></head><body><div id="root"></div><script src="/assets/app.js"></script></body></html>';
const JWT_SECRET = 'site-delivery-auth-test-secret';
const token = 'abcdefghijklmnopqrstuvwxyz123456';

async function page(path: string, env: Partial<Env> = {}, method = 'GET', headers: Record<string, string> = {}) {
  const next = vi.fn(async (request?: Request) => { void request; return new Response(shell, { headers: { 'Content-Type': 'text/html', ETag: 'shell', 'Content-Length': '10' } }); });
  const response = await onRequest({ request: new Request(`https://supplementstack.de${path}`, { method, headers }), next, env: { JWT_SECRET, ...env } } as unknown as Parameters<typeof onRequest>[0]);
  return { response, html: await response.text(), next };
}

function database(row: unknown) {
  const first = vi.fn(async () => row);
  const bind = vi.fn(() => ({ first }));
  const prepare = vi.fn((sql: string) => { void sql; return { bind }; });
  return { db: { prepare } as unknown as Env['DB'], prepare, bind };
}

afterEach(() => vi.restoreAllMocks());

describe('public SSR and private delivery boundaries', () => {
  it.each(['/', '/demo', '/einnahmeplan-erstellen'])('has real public copy and query-free canonical social data at %s', async (path) => {
    const { response, html, next } = await page(`${path}?token=do-not-leak`, {}, 'GET', { 'If-None-Match': 'shell' });
    expect(response.status).toBe(200);
    const doc = new JSDOM(html).window.document;
    expect(doc.querySelectorAll('main h1')).toHaveLength(1);
    expect(doc.querySelector('main')?.textContent?.length).toBeGreaterThan(180);
    expect(doc.querySelector('a[href="/register"]')).not.toBeNull();
    expect(doc.querySelector('link[rel="canonical"]')?.getAttribute('href')).toBe(`https://supplementstack.de${path}`);
    expect(doc.querySelectorAll('script[type="application/ld+json"]').length).toBeLessThanOrEqual(1);
    expect(html).not.toContain('do-not-leak');
    expect(html).not.toContain('bad.test');
    const shellRequest = next.mock.calls[0][0] as Request;
    expect(shellRequest.headers.has('If-None-Match')).toBe(false);
    const head = await page(path, {}, 'HEAD');
    expect(head.response.status).toBe(200);
    expect(head.html).toBe('');
    expect(head.response.headers.get('Cache-Control')).toBe(response.headers.get('Cache-Control'));
  });

  it('renders all central published main-article links, real categories and the same ItemList, independent of filter query', async () => {
    const articles = Array.from({ length: 47 }, (_, i) => ({ slug: `artikel-${i}`, title: `Artikel ${i} <script>`, summary: '', reviewed_at: null, updated_at: null, created_at: null, sources_count: 0, ingredients: [], ingredient_ids: [] }));
    const payload = { articles, total: articles.length, nutrient_statuses: [{ ingredient_id: 1, name: 'Vitamin X', category: 'vitamin', category_key: 'vitamine', solubility: null, description: null, aliases: [], has_dge: false, has_studies: false }] };
    const loader = vi.spyOn(knowledge, 'loadKnowledgeOverview').mockResolvedValue({ payload, projection: {} as knowledge.KnowledgeOverviewProjectionState, used_projection: false, refresh_scheduled: true, live_rows: [] });
    const { html, response } = await page('/wissen?category=vitamine&q=private');
    const doc = new JSDOM(html).window.document;
    expect(response.status).toBe(200);
    expect(loader).toHaveBeenCalledOnce();
    expect(doc.querySelector('main')?.textContent).toContain('Vitamine');
    expect(doc.querySelector('main')?.textContent).toContain('Vitamin X');
    expect(doc.querySelectorAll('main a[href^="/wissen/"]')).toHaveLength(47);
    expect(doc.querySelector('main script')).toBeNull();
    const jsonLd = JSON.parse(doc.querySelector('script[type="application/ld+json"]')?.textContent ?? '');
    expect(jsonLd['@graph'].find((node: { '@type': string }) => node['@type'] === 'CollectionPage').mainEntity.itemListElement).toHaveLength(47);
    expect(JSON.parse(doc.querySelector('#knowledge-overview-bootstrap')?.textContent ?? '')).toEqual(payload);
    expect(doc.querySelector('link[rel="canonical"]')?.getAttribute('href')).toBe('https://supplementstack.de/wissen');
    expect(html).not.toContain('q=private');
  });

  it('reports central knowledge storage failure as503 rather than publishing a fabricated empty list', async () => {
    vi.spyOn(knowledge, 'loadKnowledgeOverview').mockRejectedValue(new Error('secret D1 failure'));
    const { response, html } = await page('/wissen');
    expect(response.status).toBe(503);
    expect(response.headers.get('Cache-Control')).toBe('private, no-store');
    expect(html).not.toContain('secret D1 failure');
  });

  it('does not turn a broken app-shell response into a successful page', async () => {
    for (const next of [async () => new Response('private upstream failure', { status: 503 }), async () => { throw new Error('private transport failure'); }]) {
      const response = await onRequest({ request: new Request('https://supplementstack.de/login'), next, env: {} } as unknown as Parameters<typeof onRequest>[0]);
      expect(response.status).toBe(503);
      expect(response.headers.get('X-Robots-Tag')).toBe('noindex, nofollow');
      expect(await response.text()).not.toMatch(/private (upstream|transport) failure/);
    }
  });

  it.each(['/stacks?stack=42', '/profile', '/creator'])('redirects unauthenticated private navigation safely while preserving the real target %s', async (path) => {
    const { response, next } = await page(path);
    expect(response.status).toBe(302);
    expect(response.headers.get('Location')).toBe(`/login?returnTo=${encodeURIComponent(path)}`);
    expect(response.headers.get('Referrer-Policy')).toBe('no-referrer');
    expect(next).not.toHaveBeenCalled();
  });

  it('uses actual session authentication and admin role checks without putting account values in SSR', async () => {
    const encoded = (value: unknown) => Buffer.from(JSON.stringify(value)).toString('base64url');
    const input = `${encoded({ alg: 'HS256', typ: 'JWT' })}.${encoded({ userId: 7, email: 'private@test.invalid', role: 'user', exp: Math.floor(Date.now() / 1000) + 600 })}`;
    const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(JWT_SECRET), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
    const signed = `${input}.${Buffer.from(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(input))).toString('base64url')}`;
    const own = await page('/profile', {}, 'GET', { Cookie: `session=${signed}` });
    expect(own.response.status).toBe(200);
    expect(own.response.headers.get('Cache-Control')).toBe('private, no-store');
    expect(own.html).not.toContain('private@test.invalid');
    expect(own.html).not.toContain(signed);
    const admin = await page('/administrator', {}, 'GET', { Cookie: `session=${signed}` });
    expect(admin.response.status).toBe(403);
    expect(admin.html).toContain('keinen Zugriff');
  });
});

describe('read-only token page delivery', () => {
  it.each(['/login', '/register', '/forgot-password'])('has labelled non-submitting SSR controls and never reflects returnTo at %s', async (path) => {
    const { html, response } = await page(`${path}?returnTo=/share/${token}`);
    const doc = new JSDOM(html).window.document;
    expect(response.status).toBe(200);
    expect(doc.querySelector('meta[name="robots"]')?.getAttribute('content')).toBe('noindex,follow');
    expect(doc.querySelector('fieldset[disabled] label input[type="email"]')).not.toBeNull();
    expect(doc.querySelector('button[type="submit"]')).toBeNull();
    expect(doc.querySelector('link[rel="canonical"]')).toBeNull();
    expect(html).not.toContain(token);
  });

  it.each(['reset-password', 'verify-email'])('only hashes and SELECTs %s tokens for GET and HEAD, including valid, unknown and expired states', async (kind) => {
    for (const [row, status] of [[null, 400], [kind === 'reset-password' ? { id: 7, reset_token_expires_at: Date.now() + 60000 } : { user_id: 7, expires_at: Date.now() + 60000 }, 200], [kind === 'reset-password' ? { id: 7, reset_token_expires_at: 1 } : { user_id: 7, expires_at: '1' }, 410]] as const) {
      const db = database(row);
      for (const method of ['GET', 'HEAD']) {
        const { response, html } = await page(`/${kind}?token=${token}&returnTo=/share/other-secret`, { DB: db.db }, method);
        expect(response.status).toBe(status);
        expect(response.headers.get('Cache-Control')).toBe('private, no-store');
        expect(response.headers.get('Referrer-Policy')).toBe('no-referrer');
        expect(response.headers.get('X-Robots-Tag')).toBe('noindex, nofollow');
        expect(html).not.toContain(token);
        expect(html).not.toContain('other-secret');
        if (method === 'HEAD') expect(html).toBe('');
      }
      expect(db.bind).toHaveBeenCalledWith(await hashResetToken(token));
      expect(db.prepare.mock.calls.every(([sql]) => /^SELECT /.test(sql as string))).toBe(true);
    }
  });

  it('keeps the no-token verification onboarding page, rejects missing reset tokens and binds technical failure to the client', async () => {
    expect((await page('/verify-email')).response.status).toBe(200);
    expect((await page('/reset-password')).response.status).toBe(400);
    const { response, html } = await page(`/reset-password?token=${token}`, { DB: { prepare() { throw new Error('private failure'); } } as unknown as Env['DB'] });
    expect(response.status).toBe(503);
    expect(html).not.toContain('private failure');
    expect(JSON.parse(new JSDOM(html).window.document.querySelector('#site-delivery-bootstrap')?.textContent ?? '')).toEqual({ status: 503, pageKind: 'error', pathname: '/reset-password' });
  });
});

describe('approved public-share projection', () => {
  it('uses the exact read-only authoritative GET and exposes only a minimal escaped snapshot projection', async () => {
    const fetch = vi.spyOn(creatorSharing, 'fetch').mockResolvedValue(new Response(JSON.stringify({ token, title: 'Mein <script>Stack</script>', creator: { id: 1, name: 'Creator A', private_email: 'not-public@test.invalid' }, items: [{ product_name: 'Produkt <img src=x>', dosage_text: 'not-for-metadata', creator_statement: 'not-for-metadata', image_url: `https://tracker.test/${token}` }] }), { headers: { 'Content-Type': 'application/json' } }));
    const { response, html } = await page(`/share/${token}?secret=other`, { CREATOR_STACK_SHARING_ENABLED: 'true' });
    expect(response.status).toBe(200);
    expect(fetch).toHaveBeenCalledOnce();
    const request = fetch.mock.calls[0][0] as Request;
    expect(request.method).toBe('GET');
    expect(new URL(request.url).pathname).toBe(`/shares/${token}`);
    const doc = new JSDOM(html).window.document;
    expect(doc.querySelector('h1')?.textContent).toBe('Mein <script>Stack</script>');
    expect(doc.querySelector('meta[property="og:description"]')?.getAttribute('content')).toContain('Creator A');
    expect(doc.querySelector('link[rel="canonical"]')).toBeNull();
    expect(doc.querySelector('meta[property="og:url"]')).toBeNull();
    expect(doc.querySelector('main img')).toBeNull();
    for (const privateValue of [token, 'not-public@test.invalid', 'not-for-metadata', 'tracker.test', 'secret=other']) expect(html).not.toContain(privateValue);
    expect(response.headers.get('Cache-Control')).toBe('private, no-store');
    expect(response.headers.get('Referrer-Policy')).toBe('no-referrer');
    expect(response.headers.get('X-Robots-Tag')).toBe('noindex, nofollow');
  });

  it.each([[404, 'SHARE_UNKNOWN'], [409, 'SHARE_PAUSED'], [410, 'SHARE_EXPIRED'], [410, 'SHARE_UNAVAILABLE'], [500, 'INTERNAL']] as const)('preserves unavailable share status %s for GET/HEAD without leaking internal errors', async (status, code) => {
    vi.spyOn(creatorSharing, 'fetch').mockImplementation(async () => new Response(JSON.stringify({ code, error: `private error ${token}` }), { status, headers: { 'Retry-After': '300' } }));
    for (const method of ['GET', 'HEAD']) {
      const { response, html } = await page(`/share/${token}`, {}, method);
      expect(response.status).toBe(status >= 500 ? 503 : status);
      expect(response.headers.get('Cache-Control')).toBe('private, no-store');
      expect(response.headers.get('Referrer-Policy')).toBe('no-referrer');
      expect(response.headers.get('X-Robots-Tag')).toBe('noindex, nofollow');
      expect(html).not.toContain(token);
      expect(html).not.toContain('private error');
      if (method === 'HEAD') expect(html).toBe('');
    }
  });

  it('retains the real feature and malformed-token guard before database access', async () => {
    const db = database(null);
    expect((await page(`/share/${token}`, { DB: db.db, CREATOR_STACK_SHARING_ENABLED: 'false' })).response.status).toBe(404);
    expect((await page('/share/short', { DB: db.db, CREATOR_STACK_SHARING_ENABLED: 'true' })).response.status).toBe(404);
    expect(db.prepare).not.toHaveBeenCalled();
  });
});
