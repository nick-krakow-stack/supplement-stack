import { JSDOM } from 'jsdom';
import { describe, expect, it, vi } from 'vitest';
import { onRequest } from '../../../functions/_middleware';
import { isKnownAppPath } from '../../../functions/lib/site-routes.mjs';

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
    expect(result.headers.get('Cache-Control')).toBe('no-store');
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

  it.each(['/', '/login?returnTo=%2Fstacks', '/register', '/reset-password?token=secret', '/verify-email?token=secret', '/forgot-password', '/profile', '/stacks', '/demo', '/creator', '/einnahmeplan', '/my-products', '/wissen', '/wissen/vitamin-d', '/share/AbC_123-opaque', '/administrator', '/administrator/knowledge', '/administrator/ingredients/42', '/administrator/products/new', '/administrator/products/18'])('preserves the actual app route %s', async (path) => {
    const original = makeShell();
    const { result } = await request(path, original);
    expect(result).toBe(original);
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
