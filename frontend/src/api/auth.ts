import { apiClient } from './client';
import type { User } from '../types';

interface AuthResponse {
  token: string;
  user: User;
}

export async function register(
  email: string,
  password: string,
  extra?: { health_consent?: boolean } & Partial<Pick<User, 'age' | 'gender' | 'guideline_source'>>
): Promise<AuthResponse> {
  // Backend returns only { token } on register — fetch profile separately
  const res = await apiClient.post<{ token: string }>('/auth/register', {
    email,
    password,
    ...extra,
  });
  const token = res.data.token;
  // Temporarily set token so getMe() works
  localStorage.setItem('ss_token', token);
  const user = await getMe();
  return { token, user };
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

export async function updateMe(data: Partial<Omit<User, 'id' | 'email' | 'role'>>): Promise<User> {
  // Backend returns { profile: {...} }
  const res = await apiClient.put<{ profile: User }>('/me', data);
  return res.data.profile;
}
