// @vitest-environment jsdom
import { StrictMode } from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { Link, MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import LegalDocumentPage from './LegalDocumentPage';
import RouteMetadata from './RouteMetadata';
import type { LegalDocument, LegalSlug } from '../lib/legalDocumentClient';

function documentFor(slug: LegalSlug, overrides: Partial<LegalDocument> = {}): LegalDocument {
  return { slug, title: slug === 'datenschutz' ? 'Datenschutzerklärung' : 'Impressum',
    body_md: '## Kurz erklärt\n\nEin **klarer** Text.\n\n- [Kontakt](mailto:kontakt@example.org)\n- [Nutzungsbedingungen](/nutzungsbedingungen)',
    status: 'published', updated_at: '2026-09-06T10:00:00Z', published_at: '2026-09-05T10:00:00Z', version: 3, ...overrides };
}

function bootstrap(payload: unknown) {
  const script = document.createElement('script');
  script.id = 'legal-document-bootstrap';
  script.type = 'application/json';
  script.textContent = JSON.stringify(payload);
  document.body.appendChild(script);
  const prerender = document.createElement('div');
  prerender.id = 'legal-prerender';
  prerender.textContent = 'SSR projection';
  document.body.appendChild(prerender);
}

function response(document: LegalDocument) {
  return new Response(JSON.stringify({ document }), { status: 200, headers: { 'Content-Type': 'application/json' } });
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => { resolve = done; });
  return { promise, resolve };
}

function renderLegal(initial = '/datenschutz') {
  return render(<StrictMode><MemoryRouter initialEntries={[initial]}>
    <RouteMetadata />
    <nav><Link to="/datenschutz">Datenschutz öffnen</Link><Link to="/impressum">Impressum öffnen</Link><Link to="/">Start</Link></nav>
    <Routes>
      <Route path="/datenschutz" element={<LegalDocumentPage slug="datenschutz" title="Datenschutzerklärung" />} />
      <Route path="/impressum" element={<LegalDocumentPage slug="impressum" title="Impressum" />} />
      <Route path="/" element={<p>Startseite</p>} />
    </Routes>
  </MemoryRouter></StrictMode>);
}

describe('central legal document UI', () => {
  beforeEach(() => {
    vi.stubGlobal('scrollTo', vi.fn());
    vi.stubGlobal('fetch', vi.fn());
  });
  afterEach(() => {
    cleanup();
    document.getElementById('legal-document-bootstrap')?.remove();
    document.getElementById('legal-prerender')?.remove();
    document.head.querySelectorAll('meta[name="robots"],link[rel="canonical"]').forEach((node) => node.remove());
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('uses the exact initial projection without a second fetch, static fallback or duplicate H1', () => {
    const legal = documentFor('datenschutz');
    legal.body_md = `# ${legal.title}\n\n${legal.body_md}`;
    bootstrap({ document: legal });
    const { container } = renderLegal();
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    expect(container.querySelector('strong')?.textContent).toBe('klarer');
    expect(screen.getByRole('link', { name: 'Kontakt' }).getAttribute('href')).toBe('mailto:kontakt@example.org');
    expect(screen.getByText('Version 3 · Stand: 6. September 2026')).toBeTruthy();
    expect(fetch).not.toHaveBeenCalled();
    expect(document.getElementById('legal-prerender')).toBeNull();
    expect(document.getElementById('legal-document-bootstrap')).toBeNull();
    expect(document.title).toBe('Datenschutzerklärung | Supplement Stack');
    expect(document.head.querySelector('meta[name="robots"]')?.getAttribute('content')).toBe('noindex,follow');
    expect(document.head.querySelector('link[rel="canonical"]')?.getAttribute('href')).toBe('https://supplementstack.de/datenschutz');
  });

  it('shows loading only, and never a competing legal fallback, while the exact route is fetched', () => {
    vi.mocked(fetch).mockReturnValue(new Promise<Response>(() => {}));
    renderLegal();
    expect(screen.getByRole('status').textContent).toBe('Der Text wird geladen …');
    expect(screen.queryByRole('heading', { name: 'Kurz erklärt' })).toBeNull();
    expect(document.head.querySelector('link[rel="canonical"]')).toBeNull();
  });

  it('removes the prior text immediately on a slug change and ignores late cancelled responses', async () => {
    bootstrap({ document: documentFor('datenschutz', { body_md: 'Alte Datenschutzfassung.' }) });
    const imprint = deferred<Response>();
    const privacy = deferred<Response>();
    vi.mocked(fetch).mockImplementation((url) => (String(url).endsWith('/impressum') ? imprint.promise : privacy.promise).then((result) => result.clone()));
    renderLegal();
    fireEvent.click(screen.getByRole('link', { name: 'Impressum öffnen' }));
    expect(screen.queryByText('Alte Datenschutzfassung.')).toBeNull();
    expect(screen.getByRole('status')).toBeTruthy();
    fireEvent.click(screen.getByRole('link', { name: 'Datenschutz öffnen' }));
    const imprintCalls = vi.mocked(fetch).mock.calls.filter(([url]) => String(url).endsWith('/impressum'));
    expect(imprintCalls.every(([, options]) => options?.signal?.aborted)).toBe(true);
    await act(async () => privacy.resolve(response(documentFor('datenschutz', { body_md: 'Aktuelle Datenschutzfassung.', version: 4 }))));
    expect(await screen.findByText('Aktuelle Datenschutzfassung.')).toBeTruthy();
    await act(async () => imprint.resolve(response(documentFor('impressum', { body_md: 'Verspätetes Impressum.' }))));
    expect(screen.queryByText('Verspätetes Impressum.')).toBeNull();
    expect(screen.getByText('Version 4 · Stand: 6. September 2026')).toBeTruthy();
    expect(window.scrollTo).toHaveBeenCalledWith(0, 0);
  });

  it('loads the current published version after leaving and revisiting an initially projected page', async () => {
    bootstrap({ document: documentFor('datenschutz', { body_md: 'Erste Fassung.' }) });
    vi.mocked(fetch).mockImplementation(async () => response(documentFor('datenschutz', { body_md: 'Neue Fassung.', version: 4 })));
    renderLegal();
    fireEvent.click(screen.getByRole('link', { name: 'Start' }));
    fireEvent.click(screen.getByRole('link', { name: 'Datenschutz öffnen' }));
    expect(await screen.findByText('Neue Fassung.')).toBeTruthy();
    expect(screen.queryByText('Erste Fassung.')).toBeNull();
    expect(fetch).toHaveBeenCalledWith('/api/legal-documents/datenschutz', expect.objectContaining({ signal: expect.any(AbortSignal) }));
  });

  it.each([404, 503])('preserves initial HTTP %s and offers a working retry', async (status) => {
    bootstrap({ document: null, status });
    vi.mocked(fetch).mockResolvedValue(response(documentFor('datenschutz')));
    renderLegal();
    expect(fetch).not.toHaveBeenCalled();
    expect(screen.getByRole('alert').textContent).toContain(status === 404 ? 'gerade nicht verfügbar' : 'Bitte versuche es erneut');
    expect(document.head.querySelector('meta[name="robots"]')?.getAttribute('content')).toBe('noindex,nofollow');
    fireEvent.click(screen.getByRole('button', { name: 'Erneut versuchen' }));
    expect(await screen.findByRole('heading', { name: 'Kurz erklärt' })).toBeTruthy();
    expect(document.head.querySelector('meta[name="robots"]')?.getAttribute('content')).toBe('noindex,follow');
  });

  it('rejects a bootstrap and an API response for another slug', async () => {
    bootstrap({ document: documentFor('impressum', { body_md: 'Falscher Inhalt.' }) });
    vi.mocked(fetch).mockImplementation(async () => response(documentFor('impressum', { body_md: 'Noch immer falsch.' })));
    renderLegal();
    expect(await screen.findByRole('alert')).toBeTruthy();
    expect(screen.queryByText('Falscher Inhalt.')).toBeNull();
    expect(screen.queryByText('Noch immer falsch.')).toBeNull();
    expect(fetch).toHaveBeenCalledWith('/api/legal-documents/datenschutz', expect.anything());
  });

  it('does not invent version or date metadata, and escapes untrusted raw HTML', () => {
    bootstrap({ document: documentFor('datenschutz', { version: null, updated_at: null, published_at: null,
      body_md: 'Ein <script>alert(1)</script> Text.\n\n[Unsicher](javascript:alert%281%29)' }) });
    const { container } = renderLegal();
    expect(container.querySelector('.legal-document-version')).toBeNull();
    expect(container.querySelector('script')).toBeNull();
    expect(container.querySelector('a[href^="javascript:"]')).toBeNull();
    expect(container.textContent).toContain('<script>alert(1)</script>');
  });
});
