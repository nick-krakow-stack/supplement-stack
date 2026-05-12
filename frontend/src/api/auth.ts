import { apiClient } from './client';
import type { User } from '../types';
import { getSignupAttribution } from '../lib/analytics';

interface AuthResponse {
  user: User;
}

export interface RegisterResponse extends AuthResponse {
  emailVerificationEmailSent: boolean;
  message?: string;
}

export async function register(
  email: string,
  password: string,
  extra?: { health_consent?: boolean } & Partial<Pick<User, 'age' | 'guideline_source'>>
): Promise<RegisterResponse> {
  // Backend sets the session cookie and returns verification metadata on register.
  const res = await apiClient.post<{
    profile?: User;
    email_verification_email_sent?: boolean;
    message?: string;
  }>('/auth/register', {
    email,
    password,
    ...extra,
    attribution: getSignupAttribution(),
  });
  const user = res.data.profile ?? await getMe();
  return {
    user,
    emailVerificationEmailSent: res.data.email_verification_email_sent ?? false,
    message: res.data.message,
  };
}

export async function login(email: string, password: string): Promise<AuthResponse> {
  // Backend returns { token, profile: {...} } and sets the HttpOnly session cookie.
  const res = await apiClient.post<{ token: string; profile: User }>('/auth/login', { email, password });
  return { user: res.data.profile };
}

export async function getMe(): Promise<User> {
  // Backend returns { profile: {...} }
  const res = await apiClient.get<{ profile: User }>('/me');
  return res.data.profile;
}

export async function logout(): Promise<{ ok: true }> {
  const res = await apiClient.post<{ ok: true }>('/auth/logout');
  return res.data;
}

export async function updateMe(
  data: Partial<Pick<User, 'age' | 'guideline_source'>>
): Promise<User> {
  // Backend returns { profile: {...} }
  const res = await apiClient.put<{ profile: User }>('/me', data);
  return res.data.profile;
}

function extractError(err: unknown, fallback: string): Error {
  const msg =
    (err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? fallback;
  return new Error(msg);
}

export async function changePassword(payload: {
  current_password: string;
  new_password: string;
}): Promise<{ ok: true }> {
  try {
    const res = await apiClient.patch<{ ok: true }>('/me/password', payload);
    return res.data;
  } catch (err) {
    throw extractError(err, 'Passwort konnte nicht geändert werden.');
  }
}

export async function deleteAccount(payload: { password: string }): Promise<{ ok: true }> {
  try {
    const res = await apiClient.delete<{ ok: true }>('/me', { data: payload });
    return res.data;
  } catch (err) {
    throw extractError(err, 'Account konnte nicht gelöscht werden.');
  }
}

export async function verifyEmail(token: string): Promise<{ message: string }> {
  try {
    const res = await apiClient.post<{ message: string }>('/auth/verify-email', { token });
    return res.data;
  } catch (err) {
    throw extractError(err, 'E-Mail-Adresse konnte nicht bestätigt werden.');
  }
}

export async function resendVerificationEmail(): Promise<{
  message: string;
  already_verified?: boolean;
}> {
  try {
    const res = await apiClient.post<{ message: string; already_verified?: boolean }>(
      '/auth/resend-verification',
    );
    return res.data;
  } catch (err) {
    throw extractError(err, 'Bestätigungs-E-Mail konnte nicht gesendet werden.');
  }
}
