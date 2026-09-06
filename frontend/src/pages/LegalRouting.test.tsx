// @vitest-environment jsdom
import type { ReactNode } from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, useLocation, useNavigate } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App from '../App';

vi.mock('../contexts/AuthContext', () => ({ AuthProvider: ({ children }: { children: ReactNode }) => children, useAuth: () => ({ user: null }) }));
vi.mock('../components/Layout', () => ({ default: ({ children }: { children: ReactNode }) => <main>{children}</main> }));
vi.mock('../components/CookieConsentBanner', () => ({ default: () => null }));
vi.mock('./LandingPage', () => ({ default: () => <h1>Startseite</h1> }));

function NavigationProbe() {
  const location = useLocation();
  const navigate = useNavigate();
  return <><output data-testid="location">{location.pathname}{location.search}</output><button onClick={() => navigate(-1)}>Zurück im Verlauf</button></>;
}

describe('legal aliases and safe missing-page recovery', () => {
  beforeEach(() => {
    vi.stubGlobal('scrollTo', vi.fn());
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ document: {
      slug: 'nutzungsbedingungen', title: 'Nutzungsbedingungen', body_md: '## Kurz erklärt\n\nVeröffentlichter Testtext.',
      status: 'published', version: 1, updated_at: '2026-09-06', published_at: '2026-09-06',
    } }), { status: 200 })));
  });
  afterEach(() => {
    cleanup();
    document.getElementById('site-not-found-prerender')?.remove();
    document.head.querySelectorAll('meta[name="robots"],link[rel="canonical"]').forEach((node) => node.remove());
    vi.unstubAllGlobals();
  });

  it('never repeats an unknown sensitive URL and restores home metadata when leaving the error', async () => {
    const prerender = document.createElement('div');
    prerender.id = 'site-not-found-prerender';
    document.body.appendChild(prerender);
    const { container } = render(<MemoryRouter initialEntries={['/missing/private-secret?token=private-secret']}><App /></MemoryRouter>);
    expect(await screen.findByRole('heading', { name: 'Diese Seite gibt es nicht' })).toBeTruthy();
    expect(container.textContent).not.toContain('private-secret');
    expect(document.head.innerHTML).not.toContain('private-secret');
    expect(document.getElementById('site-not-found-prerender')).toBeNull();
    expect(screen.getByRole('link', { name: 'Wissen entdecken' }).getAttribute('href')).toBe('/wissen');
    expect(screen.getByRole('link', { name: 'Meine Stacks' }).getAttribute('href')).toBe('/stacks');
    expect(document.title).toBe('Seite nicht gefunden | Supplement Stack');
    expect(document.head.querySelector('meta[name="robots"]')?.getAttribute('content')).toBe('noindex,nofollow');
    expect(document.head.querySelector('link[rel="canonical"]')).toBeNull();
    fireEvent.click(screen.getByRole('link', { name: 'Startseite' }));
    expect(await screen.findByRole('heading', { name: 'Startseite' })).toBeTruthy();
    await waitFor(() => expect(document.title).toBe('Supplement Stack – quellenbasiert planen und vergleichen'));
    expect(document.head.querySelector('meta[name="robots"]')?.getAttribute('content')).toBe('index,follow');
    expect(document.head.querySelector('link[rel="canonical"]')?.getAttribute('href')).toBe('https://supplementstack.de/');
  });

  it('redirects /agb to the canonical page without query and replaces the alias history entry', async () => {
    render(<MemoryRouter initialEntries={['/', '/agb?token=private-secret']} initialIndex={1}><App /><NavigationProbe /></MemoryRouter>);
    expect(await screen.findByText('Veröffentlichter Testtext.')).toBeTruthy();
    expect(screen.getByTestId('location').textContent).toBe('/nutzungsbedingungen');
    expect(document.head.querySelector('link[rel="canonical"]')?.getAttribute('href')).toBe('https://supplementstack.de/nutzungsbedingungen');
    fireEvent.click(screen.getByRole('button', { name: 'Zurück im Verlauf' }));
    expect(await screen.findByRole('heading', { name: 'Startseite' })).toBeTruthy();
    expect(screen.getByTestId('location').textContent).toBe('/');
  });
});
