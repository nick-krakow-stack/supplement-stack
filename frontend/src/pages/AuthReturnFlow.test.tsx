// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { resendVerificationEmail, verifyEmail } from '../api/auth';
import LoginPage from './LoginPage';
import RegisterPage from './RegisterPage';
import VerifyEmailPage from './VerifyEmailPage';

const authState = vi.hoisted(() => ({
  user: null as null | { email: string; email_verified_at: string | null; role: string },
  login: vi.fn(),
  register: vi.fn(),
  refreshUser: vi.fn(),
}));

vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({
    user: authState.user,
    login: authState.login,
    register: authState.register,
    refreshUser: authState.refreshUser,
  }),
}));
vi.mock('../api/auth', () => ({
  verifyEmail: vi.fn(),
  resendVerificationEmail: vi.fn(),
}));

function LocationProbe() {
  const location = useLocation();
  return <output aria-label="location">{`${location.pathname}${location.search}${location.hash}`}</output>;
}

const returnTo = '/share/abcdefghijklmnopqrstuvwxyz123456?view=full#details';

describe('authentication return flow', () => {
  beforeEach(() => {
    authState.user = null;
    authState.login.mockReset();
    authState.register.mockReset();
    authState.refreshUser.mockReset().mockResolvedValue(undefined);
    vi.mocked(verifyEmail).mockReset();
    vi.mocked(resendVerificationEmail).mockReset();
    window.localStorage.clear();
    window.sessionStorage.clear();
  });

  afterEach(cleanup);

  it('preserves query and hash through login and the switch to registration', async () => {
    authState.login.mockResolvedValue({ email: 'user@test.invalid', email_verified_at: '2026-08-07', role: 'user' });
    render(
      <MemoryRouter initialEntries={[`/login?returnTo=${encodeURIComponent(returnTo)}`]}>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="*" element={<LocationProbe />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByRole('link', { name: 'Jetzt registrieren' }).getAttribute('href')).toContain(encodeURIComponent(returnTo));
    fireEvent.change(screen.getByLabelText('E-Mail-Adresse'), { target: { value: 'user@test.invalid' } });
    fireEvent.change(screen.getByLabelText('Passwort'), { target: { value: 'password123' } });
    fireEvent.click(screen.getByRole('button', { name: 'Anmelden' }));
    expect((await screen.findByLabelText('location')).textContent).toBe(returnTo);
  });

  it('passes the exact returnTo into registration, verification state and the verification email request', async () => {
    authState.register.mockResolvedValue({
      user: { email: 'new@test.invalid', email_verified_at: null, role: 'user' },
      emailVerificationEmailSent: true,
      message: 'Bitte bestätigen.',
    });
    render(
      <MemoryRouter initialEntries={[`/register?returnTo=${encodeURIComponent(returnTo)}`]}>
        <Routes>
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/verify-email" element={<LocationProbe />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByRole('link', { name: 'Anmelden' }).getAttribute('href')).toContain(encodeURIComponent(returnTo));
    fireEvent.change(screen.getByLabelText(/E-Mail-Adresse/), { target: { value: 'new@test.invalid' } });
    fireEvent.change(screen.getByLabelText(/Passwort/), { target: { value: 'password123' } });
    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.click(screen.getByRole('button', { name: 'Konto erstellen' }));

    await waitFor(() => expect(authState.register).toHaveBeenCalledWith(
      'new@test.invalid',
      'password123',
      expect.objectContaining({ return_to: returnTo }),
    ));
    const verifyLocation = await screen.findByLabelText('location');
    expect(new URLSearchParams(verifyLocation.textContent?.split('?')[1] || '').get('returnTo')).toBe(returnTo);
  });

  it('carries returnTo from login to email verification for an unverified account', async () => {
    authState.login.mockResolvedValue({ email: 'user@test.invalid', email_verified_at: null, role: 'user' });
    render(
      <MemoryRouter initialEntries={[`/login?returnTo=${encodeURIComponent(returnTo)}`]}>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/verify-email" element={<LocationProbe />} />
        </Routes>
      </MemoryRouter>,
    );
    fireEvent.change(screen.getByLabelText('E-Mail-Adresse'), { target: { value: 'user@test.invalid' } });
    fireEvent.change(screen.getByLabelText('Passwort'), { target: { value: 'password123' } });
    fireEvent.click(screen.getByRole('button', { name: 'Anmelden' }));

    const verifyLocation = await screen.findByLabelText('location');
    expect(new URLSearchParams(verifyLocation.textContent?.split('?')[1] || '').get('returnTo')).toBe(returnTo);
  });

  it('keeps the cross-device email target for login and sends it again on resend', async () => {
    vi.mocked(verifyEmail).mockResolvedValue({ message: 'Bestätigt.' });
    const encoded = encodeURIComponent(returnTo);
    const { unmount } = render(
      <MemoryRouter initialEntries={[`/verify-email?token=email-token&returnTo=${encoded}`]}>
        <Routes><Route path="/verify-email" element={<VerifyEmailPage />} /></Routes>
      </MemoryRouter>,
    );
    await waitFor(() => expect(verifyEmail).toHaveBeenCalledWith('email-token'));
    expect(screen.getByRole('link', { name: 'Anmelden' }).getAttribute('href')).toContain(encoded);
    unmount();

    authState.user = { email: 'user@test.invalid', email_verified_at: null, role: 'user' };
    vi.mocked(resendVerificationEmail).mockResolvedValue({ message: 'Neu gesendet.' });
    render(
      <MemoryRouter initialEntries={[`/verify-email?returnTo=${encoded}`]}>
        <Routes><Route path="/verify-email" element={<VerifyEmailPage />} /></Routes>
      </MemoryRouter>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'E-Mail erneut senden' }));
    await waitFor(() => expect(resendVerificationEmail).toHaveBeenCalledWith(returnTo));
    expect(screen.getByRole('link', { name: 'Weiter zu Supplement Stack' }).getAttribute('href')).toBe(returnTo);
  });
});
