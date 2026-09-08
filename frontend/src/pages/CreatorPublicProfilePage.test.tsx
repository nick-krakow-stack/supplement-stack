// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Link, MemoryRouter, Route, Routes } from 'react-router-dom';
import CreatorPublicProfilePage from './CreatorPublicProfilePage';
import { getPublicCreatorProfile } from '../api/publicCreatorProfile';
import type { PublicCreatorProfile } from '../../../functions/lib/creator-profile-projection.mjs';

vi.mock('../api/publicCreatorProfile', () => ({ getPublicCreatorProfile: vi.fn() }));
const getProfile = vi.mocked(getPublicCreatorProfile);
const profile: PublicCreatorProfile = { slug: 'creator-one', name: 'Creator One', type: 'creator', profile_image_url: null, description: 'Eine kurze Vorstellung zu meiner Planung im Alltag und zu meinem öffentlichen Profil.', published_at: '2026-09-08 12:00:00' };
function openPage() {
  return render(<MemoryRouter initialEntries={['/creator/creator-one']}><Link to="/creator/creator-two">Anderer Creator</Link><Routes><Route path="/creator/:slug" element={<CreatorPublicProfilePage />} /></Routes></MemoryRouter>);
}
beforeEach(() => { vi.clearAllMocks(); vi.spyOn(window, 'scrollTo').mockImplementation(() => undefined); });
afterEach(() => { cleanup(); vi.restoreAllMocks(); document.head.innerHTML = ''; document.getElementById('creator-profile-bootstrap')?.remove(); document.getElementById('site-page-prerender')?.remove(); window.history.replaceState(null, '', '/'); });

describe('public creator page navigation', () => {
  it('shows the creator without an account, preserves the central description and offers the honest next steps', async () => {
    getProfile.mockResolvedValue(profile);
    openPage();
    expect(await screen.findByRole('heading', { level: 1, name: profile.name })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Wissen entdecken' }).getAttribute('href')).toBe('/wissen');
    expect(screen.getByRole('link', { name: 'Demo ohne Konto ausprobieren' }).getAttribute('href')).toBe('/demo');
    expect(document.querySelector('meta[name="description"]')?.getAttribute('content')).toBe(profile.description);
    expect(document.querySelectorAll('script[type="application/ld+json"]')).toHaveLength(1);
    expect(window.scrollTo).toHaveBeenCalledWith({ top: 0, left: 0, behavior: 'auto' });
  });

  it('removes an old creator immediately during a slug switch and ignores a late old response', async () => {
    let firstResolve: (value: PublicCreatorProfile) => void = () => undefined;
    let nextResolve: (value: PublicCreatorProfile) => void = () => undefined;
    getProfile.mockImplementation((slug) => new Promise((resolve) => { if (slug === 'creator-one') firstResolve = resolve; else nextResolve = resolve; }));
    openPage();
    fireEvent.click(screen.getByRole('link', { name: 'Anderer Creator' }));
    expect(document.title).not.toContain('Creator One');
    expect(document.querySelector('link[rel="canonical"]')).toBeNull();
    await act(async () => { firstResolve(profile); });
    expect(screen.queryByRole('heading', { name: profile.name })).toBeNull();
    await act(async () => { nextResolve({ ...profile, slug: 'creator-two', name: 'Creator Two' }); });
    expect(screen.getByRole('heading', { name: 'Creator Two' })).toBeTruthy();
    expect(document.querySelector('link[rel="canonical"]')?.getAttribute('href')).toContain('/creator/creator-two');
  });

  it('revalidates an initial SSR profile and removes it after withdrawal', async () => {
    window.history.replaceState(null, '', '/creator/creator-one');
    const ssr = document.createElement('div'); ssr.id = 'site-page-prerender'; document.body.appendChild(ssr);
    const bootstrap = document.createElement('script'); bootstrap.type = 'application/json'; bootstrap.id = 'creator-profile-bootstrap'; bootstrap.textContent = JSON.stringify({ slug: profile.slug, state: { status: 200, profile } }); document.body.appendChild(bootstrap);
    getProfile.mockRejectedValue({ response: { status: 404 } });
    openPage();
    expect(screen.getByRole('heading', { name: profile.name })).toBeTruthy();
    expect(await screen.findByRole('heading', { name: 'Diese Creator-Seite ist nicht verfügbar' })).toBeTruthy();
    expect(document.title).not.toContain(profile.name);
    expect(document.querySelector('link[rel="canonical"]')).toBeNull();
    expect(document.querySelector('script[type="application/ld+json"]')).toBeNull();
  });

  it('provides a working retry after temporary failure', async () => {
    getProfile.mockRejectedValueOnce(new Error('private DB failure')).mockResolvedValueOnce(profile);
    openPage();
    fireEvent.click(await screen.findByRole('button', { name: 'Noch einmal versuchen' }));
    await waitFor(() => expect(screen.getByRole('heading', { name: profile.name })).toBeTruthy());
    expect(screen.queryByText('private DB failure')).toBeNull();
  });
});
