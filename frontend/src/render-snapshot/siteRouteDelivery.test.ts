import { JSDOM } from 'jsdom';
import { describe, expect, it, vi } from 'vitest';
import { onRequest } from '../../../functions/_middleware';
import { isKnownAppPath } from '../../../functions/lib/site-routes.mjs';
vi.mock('cloudflare:sockets', () => ({ connect: vi.fn() }));

const shell = '<!doctype html><html><head><title>Generic</title><meta name="robots" content="index,follow"><link rel="canonical" href="https://supplementstack.de/"></head><body><div id="root"></div><script src="/assets/app.js"></script></body></html>';
const makeShell = () => new Response(shell, { headers: { 'Content-Type': 'text/html', ETag: 'old', 'Content-Length': '100' } });

async function request(path: string, response = makeShell(), method = 'GET') {
  const next = vi.fn(async () => response);
  const result = await onRequest({ request: new Request(`https://supplementstack.de${path}`, { method }), next, env: {} } as unknown as Parameters<typeof onRequest>[0]);
  return { result, next };
}

describe('site page HTTP delivery', () => {
  it.each(['/unbekannt', '/wissen/kein/artikel', '/stacks/erfunden', '/administrator/erfunden', '/share/token/extra', '/assets/missing.js', '/<script>alert(1)</script>?secret=private-token'])('returns a real non-reflecting 404 for %s', async (path) => {
    const { result } = await request(path);
    expect(result.status).toBe(404);
    expect(result.headers.get('X-Robots-Tag')).toBe('noindex, nofollow');
    expect(result.headers.get('Cache-Control')).toBe('private, no-store');
    expect(result.headers.has('ETag')).toBe(false);
    expect(result.headers.has('Content-Length')).toBe(false);
    const html = await result.text();
    const document = new JSDOM(html).window.document;
    expect(document.title).toBe('Seite nicht gefunden | Supplement Stack');
    expect(document.querySelector('h1')?.textContent).toBe('Diese Seite gibt es nicht');
    expect(document.querySelector('meta[name="robots"]')?.getAttribute('content')).toBe('noindex,nofollow');
    expect(document.querySelector('link[rel="canonical"]')).toBeNull();
    expect([...document.querySelectorAll('main a')].map((a) => a.getAttribute('href'))).toEqual(['/', '/wissen', '/stacks']);
    expect(html).not.toContain('private-token');
    expect(html).not.toContain('alert(1)');
  });

  it.each(['/agb', '/agb/', '/agb?token=secret&returnTo=https://evil.test'])('permanently canonicalizes %s without copying queries', async (path) => {
    const { result, next } = await request(path);
    expect(result.status).toBe(308);
    expect(result.headers.get('Location')).toBe('https://supplementstack.de/nutzungsbedingungen');
    expect(next).not.toHaveBeenCalled();
  });

  it.each(['/wissen/vitamin-d'])('preserves the existing article handler for %s', async (path) => {
    const original = makeShell();
    const { result } = await request(path, original);
    expect(result).toBe(original);
  });

  it.each(['/profile', '/stacks', '/creator', '/einnahmeplan', '/my-products', '/administrator', '/administrator/knowledge', '/administrator/ingredients/42', '/administrator/products/new', '/administrator/products/18'])('requires authentication before the private app route %s', async (path) => {
    const { result, next } = await request(path);
    expect(result.status).toBe(302);
    expect(result.headers.get('Location')).toBe(`/login?returnTo=${encodeURIComponent(path)}`);
    expect(result.headers.get('Cache-Control')).toBe('private, no-store');
    expect(result.headers.get('X-Robots-Tag')).toBe('noindex,nofollow');
    expect(next).not.toHaveBeenCalled();
  });

  it.each(['/', '/demo', '/login?returnTo=%2Fstacks', '/register', '/forgot-password'])('provides an actual initial page for %s', async (path) => {
    const { result } = await request(path);
    expect(result.status).toBe(200);
    expect(new JSDOM(await result.text()).window.document.querySelectorAll('h1')).toHaveLength(1);
  });

  it.each(['/api', '/api/knowledge', '/api/not-real', '/api/auth/callback', '/robots.txt', '/sitemap.xml'])('leaves backend-owned status and content untouched for %s', async (path) => {
    const original = new Response('backend', { status: 404, headers: { 'Content-Type': 'application/json' } });
    expect((await request(path, original)).result).toBe(original);
  });

  it('preserves real assets, while missing asset HTML fallbacks are covered by the 404 cases', async () => {
    const original = new Response('body { color:red }', { headers: { 'Content-Type': 'text/css' } });
    expect((await request('/assets/existing.css', original)).result).toBe(original);
    const image = new Response(new Uint8Array([1, 2]), { headers: { 'Content-Type': 'image/png' } });
    expect((await request('/logo.png', image)).result).toBe(image);
  });

  it.each(['GET', 'HEAD'])('preserves typed asset304 validators and an empty body for %s', async (method) => {
    const headers = { 'Content-Type': 'application/javascript', ETag: '"asset-v1"', 'Cache-Control': 'public, max-age=14400, must-revalidate', Vary: 'Accept-Encoding' };
    const original = new Response(null, { status: 304, headers });
    const { result, next } = await request('/assets/app.js', original, method);
    expect(result.status).toBe(304);
    expect(await result.text()).toBe('');
    for (const [name, value] of Object.entries(headers)) expect(result.headers.get(name)).toBe(value);
    expect(next).toHaveBeenCalledOnce();
  });

  it('keeps an existing asset200 HEAD response bodyless without losing its metadata', async () => {
    const { result } = await request('/assets/app.js', new Response('asset bytes', { headers: { 'Content-Type': 'application/javascript', ETag: '"v1"', 'Cache-Control': 'public, max-age=14400' } }), 'HEAD');
    expect(result.status).toBe(200);
    expect(await result.text()).toBe('');
    expect(result.headers.get('Content-Type')).toBe('application/javascript');
    expect(result.headers.get('ETag')).toBe('"v1"');
  });

  it.each(['GET', 'HEAD'])('verifies a typeless304 using an unconditional actual asset read for %s', async (method) => {
    const headers = { ETag: '"asset-v1"', 'Cache-Control': 'public, max-age=14400, must-revalidate', Vary: 'Accept-Encoding' };
    const original = new Response(null, { status: 304, headers });
    const next = vi.fn().mockResolvedValueOnce(original).mockResolvedValueOnce(new Response('body { color:red }', { headers: { ...headers, 'Content-Type': 'text/css' } }));
    const result = await onRequest({ request: new Request('https://supplementstack.de/assets/app.css', { method, headers: { 'If-None-Match': '"asset-v1"', 'If-Modified-Since': 'Mon, 07 Sep 2026 10:00:00 GMT', Accept: 'text/css' } }), next, env: {} } as unknown as Parameters<typeof onRequest>[0]);
    expect(result).toBe(original);
    expect(result.status).toBe(304);
    expect(await result.text()).toBe('');
    for (const [name, value] of Object.entries(headers)) expect(result.headers.get(name)).toBe(value);
    expect(next).toHaveBeenCalledTimes(2);
    const verification = next.mock.calls[1][0] as Request;
    expect(verification.url).toBe('https://supplementstack.de/assets/app.css');
    expect(verification.method).toBe('GET');
    expect(verification.headers.has('If-None-Match')).toBe(false);
    expect(verification.headers.has('If-Modified-Since')).toBe(false);
    expect(verification.headers.get('Accept')).toBe('text/css');
  });

  it.each(['GET', 'HEAD'])('keeps typeless304 HTML fallbacks and missing assets at404 for %s', async (method) => {
    for (const path of ['/not-a-page', '/assets/missing.js']) {
      const next = vi.fn().mockResolvedValueOnce(new Response(null, { status: 304, headers: { ETag: 'old' } })).mockResolvedValueOnce(makeShell());
      const result = await onRequest({ request: new Request(`https://supplementstack.de${path}`, { method, headers: { 'If-None-Match': 'old' } }), next, env: {} } as unknown as Parameters<typeof onRequest>[0]);
      expect(result.status).toBe(404);
      expect(result.headers.get('X-Robots-Tag')).toBe('noindex, nofollow');
      expect(result.headers.has('ETag')).toBe(false);
      expect(await result.text()).toEqual(method === 'HEAD' ? '' : expect.stringContaining('Diese Seite gibt es nicht'));
    }
    const { result } = await request('/assets/missing.png', new Response(null, { status: 404, headers: { 'Content-Type': 'image/png' } }), method);
    expect(result.status).toBe(404);
    const html304 = await request('/assets/missing.js', new Response(null, { status: 304, headers: { 'Content-Type': 'text/html' } }), method);
    expect(html304.result.status).toBe(404);
  });

  it('returns a fresh asset if its validator changes during typeless304 verification', async () => {
    const fresh = new Response('new bytes', { headers: { 'Content-Type': 'application/javascript', ETag: '"v2"' } });
    const next = vi.fn().mockResolvedValueOnce(new Response(null, { status: 304, headers: { ETag: '"v1"' } })).mockResolvedValueOnce(fresh);
    const result = await onRequest({ request: new Request('https://supplementstack.de/assets/app.js'), next, env: {} } as unknown as Parameters<typeof onRequest>[0]);
    expect(result).toBe(fresh);
    expect(await result.text()).toBe('new bytes');
  });

  it('HEAD keeps real 404 status and metadata with no response body', async () => {
    const { result } = await request('/unknown', makeShell(), 'HEAD');
    expect(result.status).toBe(404);
    expect(await result.text()).toBe('');
    expect(result.headers.get('X-Robots-Tag')).toBe('noindex, nofollow');
  });

  it('does not whitelist arbitrary app prefixes or deeper article routes', () => {
    expect(isKnownAppPath('/administrator/unknown')).toBe(false);
    expect(isKnownAppPath('/wissen/vitamin-d/unknown')).toBe(false);
    expect(isKnownAppPath('/creator/unknown')).toBe(false);
  });
});
