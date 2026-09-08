// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Link, MemoryRouter, Route, Routes } from 'react-router-dom';
import CreatorShareImportPage from './CreatorShareImportPage';
import RouteMetadata from '../components/RouteMetadata';
import { getCreatorShare, importCreatorShare, preflightCreatorShare, type CreatorSharePreview } from '../api/creatorSharing';
import { projectShareHead, publicShareFailure } from '../../../functions/lib/share-head-projection.mjs';
import { renderRouteHeadHtml } from '../../../functions/lib/route-head-contract.mjs';
import { sharePageProjection } from '../../../functions/lib/site-public-html';

vi.mock('../api/creatorSharing', () => ({ creatorSharingEnabled: true, getCreatorShare: vi.fn(), importCreatorShare: vi.fn(), preflightCreatorShare: vi.fn(), reportCreatorShare: vi.fn(), undoCreatorShareImport: vi.fn() }));
vi.mock('../api/stacks', () => ({ getStacks: vi.fn() }));
vi.mock('../contexts/AuthContext', () => ({ useAuth: () => ({ user: null, loading: false }) }));

const tokenA = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
const tokenB = 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb';
const preview = (token = tokenA, title = 'Mein Abend-Stack'): CreatorSharePreview => ({
  token, title, type: 'stack', creator: { id: 7, type: 'creator', name: 'Alex Alltag' },
  published_at: '2026-08-07T08:00:00.000Z', items: [],
});
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => { resolve = done; });
  return { promise, resolve };
}
function mount() {
  return render(<MemoryRouter initialEntries={[`/share/${tokenA}`]}>
    <RouteMetadata />
    <Link to={`/share/${tokenB}`}>Andere Empfehlung</Link><Link to="/wissen">Wissen öffnen</Link>
    <Routes><Route path="/share/:token" element={<CreatorShareImportPage />} /><Route path="/wissen" element={<h1>Wissen</h1>} /></Routes>
  </MemoryRouter>);
}
function expectSafeShareHead(title: string) {
  expect(document.title).toBe(`${title} | Supplement Stack`);
  for (const selector of ['title', 'meta[name="description"]', 'meta[name="robots"]', 'meta[name="referrer"]', 'meta[property="og:title"]', 'meta[name="twitter:title"]']) {
    expect(document.head.querySelectorAll(selector)).toHaveLength(1);
  }
  expect(document.head.querySelector('meta[property="og:title"]')?.getAttribute('content')).toBe(document.title);
  expect(document.head.querySelector('meta[name="twitter:title"]')?.getAttribute('content')).toBe(document.title);
  expect(document.head.querySelector('meta[name="robots"]')?.getAttribute('content')).toBe('noindex,nofollow');
  expect(document.head.querySelector('meta[name="referrer"]')?.getAttribute('content')).toBe('no-referrer');
  expect(document.head.querySelectorAll('link[rel="canonical"], meta[property="og:url"], script[type="application/ld+json"]')).toHaveLength(0);
  expect(document.head.innerHTML).not.toMatch(new RegExp(`${tokenA}|${tokenB}|not-for-metadata|tracker.test`));
}

beforeEach(() => {
  document.head.innerHTML = '';
  window.history.replaceState(null, '', '/');
  window.localStorage.clear();
  vi.mocked(getCreatorShare).mockReset();
  vi.mocked(importCreatorShare).mockClear();
  vi.mocked(preflightCreatorShare).mockClear();
  if (!crypto.randomUUID) Object.defineProperty(crypto, 'randomUUID', { configurable: true, value: () => '00000000-0000-4000-8000-000000000000' });
});
afterEach(() => {
  cleanup();
  document.getElementById('site-page-prerender')?.remove();
  document.getElementById('site-delivery-bootstrap')?.remove();
  document.head.innerHTML = '';
  window.history.replaceState(null, '', '/');
});

describe('source-bound share head ownership', () => {
  it('preserves the initial SSR projection while loading and keeps the same head after the authoritative GET', async () => {
    const next = deferred<CreatorSharePreview>();
    vi.mocked(getCreatorShare).mockReturnValue(next.promise);
    window.history.replaceState(null, '', `/share/${tokenA}`);
    const share = { status: 200 as const, title: preview().title, creatorName: preview().creator.name, productNames: [] };
    const ssr = sharePageProjection(`/share/${tokenA}`, share);
    document.head.innerHTML = renderRouteHeadHtml(ssr.head);
    document.body.insertAdjacentHTML('beforeend', '<div id="site-page-prerender"></div><script id="site-delivery-bootstrap" type="application/json">{"pageKind":"share","status":200}</script>');
    mount();
    expectSafeShareHead('Mein Abend-Stack');
    await act(async () => next.resolve(preview()));
    expectSafeShareHead('Mein Abend-Stack');
    expect(document.head.querySelector('meta[name="description"]')?.getAttribute('content')).toBe(ssr.head.description);
    expect(importCreatorShare).not.toHaveBeenCalled();
    expect(preflightCreatorShare).not.toHaveBeenCalled();
  });

  it('clears the previous snapshot on a token switch, ignores late results and releases metadata on navigation away', async () => {
    const first = deferred<CreatorSharePreview>();
    const second = deferred<CreatorSharePreview>();
    vi.mocked(getCreatorShare).mockImplementation((token) => token === tokenA ? first.promise : second.promise);
    mount();
    expectSafeShareHead('Empfehlung wird geladen');
    fireEvent.click(screen.getByRole('link', { name: 'Andere Empfehlung' }));
    expectSafeShareHead('Empfehlung wird geladen');
    await act(async () => first.resolve(preview(tokenA, 'Veraltete Empfehlung')));
    expectSafeShareHead('Empfehlung wird geladen');
    await act(async () => second.resolve(preview(tokenB, 'Neue Empfehlung')));
    expectSafeShareHead('Neue Empfehlung');
    fireEvent.click(screen.getByRole('link', { name: 'Wissen öffnen' }));
    expect(document.title).not.toContain('Empfehlung');
    expect(document.head.querySelector('meta[name="robots"]')?.getAttribute('content')).toBe('index,follow');
  });

  it.each([
    [404, 'SHARE_UNKNOWN', 'Empfehlung nicht gefunden'],
    [409, 'SHARE_PENDING', 'Empfehlung gerade nicht verfügbar'],
    [409, 'SHARE_PAUSED', 'Empfehlung gerade nicht verfügbar'],
    [410, 'SHARE_EXPIRED', 'Empfehlung nicht mehr verfügbar'],
    [410, 'SHARE_UNAVAILABLE', 'Empfehlung nicht mehr verfügbar'],
    [503, 'INTERNAL', 'Empfehlung gerade nicht verfügbar'],
    [404, undefined, 'Empfehlung nicht gefunden'],
    [409, undefined, 'Empfehlung gerade nicht verfügbar'],
    [410, undefined, 'Empfehlung nicht mehr verfügbar'],
  ] as const)('uses the same safe SSR/SPA error projection for %s/%s', async (status, code, title) => {
    vi.mocked(getCreatorShare).mockRejectedValue({ response: { status, data: { code, error: `private ${tokenA}` } } });
    mount();
    await waitFor(() => expect(document.title).toBe(`${title} | Supplement Stack`));
    expectSafeShareHead(title);
    const expected = sharePageProjection(`/share/${tokenA}`, publicShareFailure(status, code)).head;
    expect(document.head.querySelector('meta[name="description"]')?.getAttribute('content')).toBe(expected.description);
  });

  it('replaces a successful snapshot when the next share GET says the link is expired', async () => {
    vi.mocked(getCreatorShare).mockResolvedValueOnce(preview()).mockRejectedValueOnce({ response: { status: 410, data: { code: 'SHARE_EXPIRED' } } });
    mount();
    await waitFor(() => expect(document.title).toBe('Mein Abend-Stack | Supplement Stack'));
    fireEvent.click(screen.getByRole('link', { name: 'Andere Empfehlung' }));
    await waitFor(() => expect(document.title).toBe('Empfehlung nicht mehr verfügbar | Supplement Stack'));
    expectSafeShareHead('Empfehlung nicht mehr verfügbar');
    expect(document.head.innerHTML).not.toContain('Alex Alltag');
  });

  it('shows a neutral loading head during a manual read retry, then restores only the new successful snapshot', async () => {
    const retry = deferred<CreatorSharePreview>();
    vi.mocked(getCreatorShare).mockRejectedValueOnce({ response: { status: 503 } }).mockReturnValueOnce(retry.promise);
    mount();
    fireEvent.click(await screen.findByRole('button', { name: 'Erneut versuchen' }));
    expectSafeShareHead('Empfehlung wird geladen');
    await act(async () => retry.resolve(preview()));
    expectSafeShareHead('Mein Abend-Stack');
    expect(getCreatorShare).toHaveBeenCalledTimes(2);
    expect(importCreatorShare).not.toHaveBeenCalled();
    expect(preflightCreatorShare).not.toHaveBeenCalled();
  });

  it('does not reuse an old document marker for a different SPA token and never promotes private fields into metadata', async () => {
    const next = deferred<CreatorSharePreview>();
    vi.mocked(getCreatorShare).mockReturnValue(next.promise);
    window.history.replaceState(null, '', `/share/${tokenB}`);
    document.head.innerHTML = renderRouteHeadHtml(projectShareHead({ status: 200, title: 'Old snapshot' }).head);
    document.body.insertAdjacentHTML('beforeend', '<div id="site-page-prerender"></div><script id="site-delivery-bootstrap" type="application/json">{"pageKind":"share","status":200}</script>');
    mount();
    expectSafeShareHead('Empfehlung wird geladen');
    await act(async () => next.resolve({ ...preview(), title: `Mein ${tokenA} <script> $& Stack`, creator: { ...preview().creator, name: `Alex ${tokenA}`, profile_image_url: `https://tracker.test/${tokenA}` }, items: [{ catalog_product_id: 1, product_name: 'not-for-metadata', brand: null, quantity: 9, unit: 'mg', intake_interval_days: 1, dosage_text: 'not-for-metadata', timing: null, creator_statement: 'not-for-metadata' }] }));
    expectSafeShareHead('Mein <script> $& Stack');
    expect(document.head.querySelectorAll('script')).toHaveLength(0);
  });
});
