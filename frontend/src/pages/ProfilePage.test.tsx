// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import {
  downloadMyData,
  updateMe,
} from '../api/auth';
import { useAuth } from '../contexts/AuthContext';
import { initializeAnalytics, persistAnalyticsConsent, readStoredAnalyticsConsent, revokeAnalyticsConsent } from '../lib/analytics';
import ProfilePage from './ProfilePage';

vi.mock('../contexts/AuthContext', () => ({ useAuth: vi.fn() }));
vi.mock('../api/auth', () => ({
  changePassword: vi.fn(),
  deleteAccount: vi.fn(),
  downloadMyData: vi.fn(),
  resendVerificationEmail: vi.fn(),
  updateMe: vi.fn(),
}));
vi.mock('../lib/analytics', () => ({
  initializeAnalytics: vi.fn(),
  persistAnalyticsConsent: vi.fn(),
  readStoredAnalyticsConsent: vi.fn(),
  revokeAnalyticsConsent: vi.fn(),
}));

const refreshUser = vi.fn();
const logout = vi.fn();

function renderProfile(overrides: Record<string, unknown> = {}) {
  vi.mocked(useAuth).mockReturnValue({
    user: {
      id: 42,
      email: 'profil@example.test',
      role: 'user',
      age: 37,
      guideline_source: null,
      health_consent: 1,
      health_consent_at: '2026-08-01 12:00:00',
      email_verified_at: '2026-08-02 12:00:00',
      created_at: '2026-08-01 12:00:00',
      ...overrides,
    },
    isAdmin: false,
    loading: false,
    login: vi.fn(),
    register: vi.fn(),
    logout,
    refreshUser,
  });
  return render(<MemoryRouter><ProfilePage /></MemoryRouter>);
}

describe('ProfilePage preferences and privacy controls', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    refreshUser.mockResolvedValue(undefined);
    vi.mocked(updateMe).mockResolvedValue({
      id: 42,
      email: 'profil@example.test',
      role: 'user',
      guideline_source: null,
    });
    vi.mocked(readStoredAnalyticsConsent).mockReturnValue(null);
    Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: vi.fn(() => 'blob:test-export') });
    Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: vi.fn() });
  });

  afterEach(cleanup);

  it('hides internal account roles and offers only official values or studies', () => {
    renderProfile();

    expect(screen.queryByText(/Rolle:/i)).toBeNull();
    expect(screen.queryByText(/Kontotyp/i)).toBeNull();
    expect(screen.queryByText(/Influencer/i)).toBeNull();
    expect((screen.getByLabelText('Welche Quellen möchtest du zuerst sehen?') as HTMLSelectElement).value).toBe('');
    expect(screen.getByText(/Bis dahin werden offizielle Referenzwerte zuerst gezeigt/i)).toBeTruthy();
    expect(screen.getAllByRole('option').map((option) => option.textContent)).toEqual([
      'Bitte auswählen',
      'Offizielle Referenzwerte',
      'Studien',
    ]);
    expect(screen.getByText(/Öffentlich geteilte Creator-Empfehlungen können als Inhalt der Creator-Organisation bestehen bleiben/i)).toBeTruthy();
  });

  it('sends only a changed source preference and announces the saved result', async () => {
    renderProfile();

    fireEvent.change(screen.getByLabelText('Welche Quellen möchtest du zuerst sehen?'), {
      target: { value: 'studien' },
    });
    expect(screen.getByText('Noch nicht gespeichert')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Änderungen speichern' }));

    await waitFor(() => expect(updateMe).toHaveBeenCalledWith({ guideline_source: 'studien' }));
    expect(refreshUser).toHaveBeenCalledTimes(1);
    expect(await screen.findByText('Deine Profilangaben wurden gespeichert.')).toBeTruthy();
  });

  it('sends an explicit null when the age is removed', async () => {
    renderProfile({ guideline_source: 'DGE' });

    fireEvent.click(screen.getByRole('button', { name: 'Angabe entfernen' }));
    fireEvent.click(screen.getByRole('button', { name: 'Änderungen speichern' }));

    await waitFor(() => expect(updateMe).toHaveBeenCalledWith({ age: null }));
  });

  it('downloads the real export response and reports completion', async () => {
    vi.mocked(downloadMyData).mockResolvedValue(new Blob(['{"format":"supplement_stack_user_data.v1"}'], { type: 'application/json' }));
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
    renderProfile();

    fireEvent.click(screen.getAllByRole('button', { name: 'Meine Daten herunterladen' })[0]);

    await waitFor(() => expect(downloadMyData).toHaveBeenCalledTimes(1));
    expect(click).toHaveBeenCalledTimes(1);
    expect(await screen.findByText('Deine Datendatei wurde erstellt und heruntergeladen.')).toBeTruthy();
    click.mockRestore();
  });

  it('explains optional analysis without changing acceptance or revocation', () => {
    renderProfile();
    expect(screen.getByRole('group', { name: 'Optionale Nutzungsanalyse' })).toBeTruthy();
    expect(screen.getByText(/Die App funktioniert auch, wenn du ablehnst\./)).toBeTruthy();
    expect(screen.queryByText('Freiwillige Nutzungsstatistik')).toBeNull();
    expect(initializeAnalytics).not.toHaveBeenCalled();
    expect(persistAnalyticsConsent).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('radio', { name: 'Zulassen' }));
    expect(persistAnalyticsConsent).toHaveBeenLastCalledWith('accepted');
    expect(initializeAnalytics).toHaveBeenCalledTimes(1);
    expect((screen.getByRole('radio', { name: 'Zulassen' }) as HTMLInputElement).checked).toBe(true);

    fireEvent.click(screen.getByRole('radio', { name: 'Nicht zulassen' }));
    expect(persistAnalyticsConsent).toHaveBeenLastCalledWith('declined');
    expect(revokeAnalyticsConsent).toHaveBeenCalledTimes(1);
    expect((screen.getByRole('radio', { name: 'Nicht zulassen' }) as HTMLInputElement).checked).toBe(true);
    expect(initializeAnalytics).toHaveBeenCalledTimes(1);
  });
});
