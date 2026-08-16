// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import Layout from './Layout';

vi.mock('../api/creatorSharing', () => ({ creatorSharingEnabled: true }));
vi.mock('../contexts/AuthContext', () => ({ useAuth: vi.fn() }));

const authMethods = {
  isAdmin: false,
  loading: false,
  login: vi.fn(),
  register: vi.fn(),
  logout: vi.fn(),
  refreshUser: vi.fn(),
};

describe('Layout creator navigation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });
  afterEach(cleanup);

  it('keeps the creator entry stable for signed-in users even before access is known', () => {
    vi.mocked(useAuth).mockReturnValue({
      ...authMethods,
      user: { id: 42, email: 'user@example.test', role: 'user', guideline_source: 'DGE' },
    });

    render(<MemoryRouter><Layout><div>Inhalt</div></Layout></MemoryRouter>);

    expect(screen.getAllByRole('link', { name: 'Für Creator' }).length).toBeGreaterThan(0);
  });

  it('names and marks the profile link clearly', () => {
    vi.mocked(useAuth).mockReturnValue({
      ...authMethods,
      user: { id: 42, email: 'user@example.test', role: 'user', guideline_source: 'DGE' },
    });

    render(<MemoryRouter initialEntries={['/profile']}><Layout><div>Profilinhalt</div></Layout></MemoryRouter>);

    const profileLinks = screen.getAllByRole('link', { name: /Mein Profil user@example\.test/i });
    expect(profileLinks.some((link) => link.getAttribute('aria-current') === 'page')).toBe(true);
  });

  it('moves focus into the mobile menu and returns it after Escape', async () => {
    vi.mocked(useAuth).mockReturnValue({ ...authMethods, user: null });
    render(<MemoryRouter><Layout><div>Inhalt</div></Layout></MemoryRouter>);

    const toggle = screen.getByRole('button', { name: 'Menü öffnen' });
    fireEvent.click(toggle);

    expect(screen.getByRole('button', { name: 'Menü schließen' })).toBe(toggle);
    await waitFor(() => expect(document.activeElement).toBe(screen.getAllByRole('link', { name: 'Wissen' })[1]));
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.getByRole('button', { name: 'Menü öffnen' })).toBe(toggle);
    expect(document.activeElement).toBe(toggle);
  });

  it('does not offer the protected creator entry to guests', () => {
    vi.mocked(useAuth).mockReturnValue({ ...authMethods, user: null });

    render(<MemoryRouter><Layout><div>Inhalt</div></Layout></MemoryRouter>);

    expect(screen.queryByRole('link', { name: 'Für Creator' })).toBeNull();
  });
});
