import { apiClient } from './client';
import type { User } from '../types';

interface AuthResponse {
  token: string;
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
  // Backend returns { token, email_verification_email_sent, message } on register.
  const res = await apiClient.post<{
    token: string;
    email_verification_email_sent?: boolean;
    message?: string;
  }>('/auth/register', {
    email,
    password,
    ...extra,
  });
  const token = res.data.token;
  // Temporarily set token so getMe() works
  localStorage.setItem('ss_token', token);
  const user = await getMe();
  return {
    token,
    user,
    emailVerificationEmailSent: res.data.email_verification_email_sent ?? false,
    message: res.data.message,
  };
}

export async function login(email: string, password: string): Promise<AuthResponse> {
  // Backend returns { token, profile: {...} }
  const res = await apiClient.post<{ token: string; profile: User }>('/auth/login', { email, password });
  return { token: res.data.token, user: res.data.profile };
}

export async function getMe(): Promise<User> {
  // Backend returns { profile: {...} }
  const res = await apiClient.get<{ profile: User }>('/me');
  return res.data.profile;
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

// Helper: bewahrt das Token vor dem 401-Interceptor in client.ts.
// 401 bei falschem aktuellem Passwort darf den User NICHT ausloggen.
function preserveTokenOn401<T>(fn: () => Promise<T>): Promise<T> {
  const savedToken = localStorage.getItem('ss_token');
  return fn().catch((err) => {
    const status = (err as { response?: { status?: number } })?.response?.status;
    if (status === 401 && savedToken && !localStorage.getItem('ss_token')) {
      localStorage.setItem('ss_token', savedToken);
    }
    throw err;
  });
}

export async function changePassword(payload: {
  current_password: string;
  new_password: string;
}): Promise<{ ok: true }> {
  try {
    const res = await preserveTokenOn401(() =>
      apiClient.patch<{ ok: true }>('/me/password', payload),
    );
    return res.data;
  } catch (err) {
    throw extractError(err, 'Passwort konnte nicht geändert werden.');
  }
}

export async function deleteAccount(payload: { password: string }): Promise<{ ok: true }> {
  try {
    const res = await preserveTokenOn401(() =>
      apiClient.delete<{ ok: true }>('/me', { data: payload }),
    );
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
