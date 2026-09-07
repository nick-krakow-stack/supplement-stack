import { JSDOM } from 'jsdom';
import { describe, expect, it, vi } from 'vitest';
import legal from '../../../functions/api/modules/legal';
import { onRequest } from '../../../functions/_middleware';
import type { Env } from '../../../functions/api/lib/types';
import type { PublicLegalDocument } from '../../../functions/lib/legal-documents';
import { formatLegalDocumentDate, legalDocumentVersionText, normalizeLegalLink, renderLegalMarkdown } from '../../../functions/lib/legal-document-renderer.mjs';
vi.mock('cloudflare:sockets', () => ({ connect: vi.fn() }));

const document: PublicLegalDocument = {
  slug: 'impressum', title: 'Impressum', body_md: '# Impressum\n\n## Kontakt\n\n**Name** und *Anschrift*\nZweite Zeile\n\n- [E-Mail](mailto:kontakt@example.test)\n- [Telefon](tel:+491234567)\n\n1. [Datenschutz](/datenschutz)\n2. [Original](https://example.test/?a=1&b=2)\n\n| Spalte | Inhalt |\n| --- | --- |\n| A | **Text** |', status: 'published', published_at: '2026-09-06 09:00:00', updated_at: '2026-09-06 12:30:00', version: 1,
};
const shell = '<!doctype html><html><head><title>Generic</title></head><body><div id="root"></div><script src="/assets/app.js"></script></body></html>';

function database(row: unknown = document, fail = false) {
  const first = vi.fn(async () => { if (fail) throw new Error('private database details'); return row; });
  const bind = vi.fn(() => ({ first }));
  const prepare = vi.fn(() => ({ bind }));
  return { db: { prepare } as unknown as D1Database, prepare, bind, first };
}

async function page(db: D1Database, slug = 'impressum', method = 'GET') {
  return onRequest({ request: new Request(`https://supplementstack.de/${slug}?secret=not-public`, { method }), env: { DB: db }, next: async () => new Response(shell, { headers: { 'Content-Type': 'text/html' } }) } as unknown as Parameters<typeof onRequest>[0]);
}

describe('canonical legal documents API, initial HTML and safe rendering', () => {
  it('delivers identical canonical API and JSON bootstrap data with already readable SSR', async () => {
    const { db, prepare, bind } = database();
    const api = await legal.request('/impressum', undefined, { DB: db } as Env);
    const apiPayload = await api.json();
    const response = await page(db);
    const dom = new JSDOM(await response.text()).window.document;
    expect(response.status).toBe(200);
    expect(response.headers.get('X-Robots-Tag')).toBe('noindex, follow');
    expect(dom.querySelector('meta[name="robots"]')?.getAttribute('content')).toBe('noindex,follow');
    expect(api.status).toBe(200);
    expect(JSON.parse(dom.querySelector('#legal-document-bootstrap')?.textContent ?? '')).toEqual(apiPayload);
    expect(apiPayload).toEqual({ document });
    expect(dom.querySelector('#legal-prerender h1')?.textContent).toBe('Impressum');
    expect(dom.querySelectorAll('h1')).toHaveLength(1);
    expect(dom.querySelector('.legal-document-body')?.innerHTML).toBe(new JSDOM(renderLegalMarkdown(document.body_md, document.title)).window.document.body.innerHTML);
    expect(dom.querySelector('.legal-document-version')?.textContent).toBe(legalDocumentVersionText(document));
    expect(dom.querySelector('link[rel="canonical"]')?.getAttribute('href')).toBe('https://supplementstack.de/impressum');
    expect(dom.documentElement.outerHTML).not.toContain('not-public');
    expect(dom.querySelector('#legal-prerender')?.nextElementSibling?.id).toBe('legal-document-bootstrap');
    expect(prepare.mock.calls[0]?.[0]).toMatch(/status = 'published'/);
    expect(prepare.mock.calls[0]?.[0]).toMatch(/TRIM\(COALESCE\(body_md/);
    expect(bind).toHaveBeenCalledWith('impressum');
  });

  it.each(['datenschutz', 'nutzungsbedingungen'])('uses the identical canonical loader for %s', async (slug) => {
    const { db } = database({ ...document, slug, title: slug });
    const response = await page(db, slug);
    expect(response.status).toBe(200);
    expect(new JSDOM(await response.text()).window.document.querySelector('link[rel="canonical"]')?.getAttribute('href')).toBe(`https://supplementstack.de/${slug}`);
  });

  it.each([null, { ...document, status: 'draft' }, { ...document, body_md: ' \n' }, { ...document, slug: 'private' }])('never publishes missing/private/empty or mismatched rows', async (row) => {
    const { db } = database(row);
    const response = await page(db);
    expect(response.status).toBe(404);
    expect(response.headers.get('X-Robots-Tag')).toBe('noindex, nofollow');
    const dom = new JSDOM(await response.text()).window.document;
    expect(JSON.parse(dom.querySelector('#legal-document-bootstrap')?.textContent ?? '')).toEqual({ document: null, status: 404 });
    expect(dom.querySelector('.legal-document-body')).toBeNull();
    expect((await legal.request('/impressum', undefined, { DB: db } as Env)).status).toBe(404);
  });

  it('distinguishes temporary storage failure from missing documents without private error details', async () => {
    const { db } = database(null, true);
    const response = await page(db);
    expect(response.status).toBe(503);
    expect(response.headers.get('Retry-After')).toBe('60');
    expect(await response.text()).not.toContain('private database details');
    expect((await legal.request('/impressum', undefined, { DB: db } as Env)).status).toBe(503);
  });

  it('rejects unknown API slugs before accessing storage and supports legal HEAD responses', async () => {
    const { db, prepare } = database();
    expect((await legal.request('/unknown', undefined, { DB: db } as Env)).status).toBe(404);
    expect(prepare).not.toHaveBeenCalled();
    const response = await page(db, 'impressum', 'HEAD');
    expect(response.status).toBe(200);
    expect(await response.text()).toBe('');
  });

  it('renders supported inline and block formatting with safe contact/navigation links', () => {
    const dom = new JSDOM(renderLegalMarkdown(document.body_md, document.title)).window.document;
    expect(dom.querySelector('h2')?.textContent).toBe('Kontakt');
    expect(dom.querySelector('strong')?.textContent).toBe('Name');
    expect(dom.querySelector('em')?.textContent).toBe('Anschrift');
    expect(dom.querySelectorAll('br')).toHaveLength(1);
    expect(dom.querySelectorAll('ul li')).toHaveLength(2);
    expect(dom.querySelectorAll('ol li')).toHaveLength(2);
    expect(dom.querySelector('table td strong')?.textContent).toBe('Text');
    expect(dom.querySelector('a[href="mailto:kontakt@example.test"]')).not.toBeNull();
    expect(dom.querySelector('a[href="tel:+491234567"]')).not.toBeNull();
  });

  it('escapes HTML/script terminators, URL payloads and dollar replacement markers without loading untrusted images', async () => {
    const bad = '</script><script>alert(1)</script> $& $` $\'\n\n[bad](javascript:alert%281%29) [bad](data:text/html,x) [bad](//evil.test)\n\n![tracker](https://evil.test/tracker.svg)';
    const { db } = database({ ...document, body_md: bad, title: '<img src=x onerror=alert(1)>' });
    const response = await page(db);
    const dom = new JSDOM(await response.text()).window.document;
    expect(dom.querySelectorAll('script')).toHaveLength(2);
    expect(dom.querySelectorAll('img')).toHaveLength(0);
    expect(dom.querySelectorAll('a')).toHaveLength(0);
    expect(dom.querySelector('.legal-document-body')?.textContent).toContain('$& $` $\'');
    expect(dom.querySelectorAll('#root')).toHaveLength(1);
    expect(JSON.parse(dom.querySelector('#legal-document-bootstrap')?.textContent ?? '').document.body_md).toBe(bad);
    for (const value of ['javascript:alert(1)', '//evil.test', '/\\evil.test', 'mailto:x%0aBCC@evil.test', 'mailto:owner?bcc=attacker@evil.test', 'tel:+49%0a123']) expect(normalizeLegalLink(value)).toBeNull();
  });

  it('uses explicit UTC dates and omits unavailable or invalid editorial metadata', () => {
    expect(formatLegalDocumentDate('2026-09-06 23:59:00')).toEqual({ dateTime: '2026-09-06', label: '6. September 2026' });
    expect(formatLegalDocumentDate('2026-02-31')).toBeNull();
    expect(formatLegalDocumentDate('unavailable')).toBeNull();
    expect(legalDocumentVersionText({ updated_at: null, published_at: null, version: 0 })).toBe('');
    expect(legalDocumentVersionText(document)).toBe('Version 1 · Stand: 6. September 2026');
  });
});
