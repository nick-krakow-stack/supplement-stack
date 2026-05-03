import { apiClient } from './client';
import type { DemoSession } from '../types';

export async function createDemoSession(stackJson?: string): Promise<DemoSession> {
  const stack = stackJson ? JSON.parse(stackJson) : [];
  const res = await apiClient.post<DemoSession>('/demo/sessions', { stack });
  return res.data;
}

export async function getDemoSession(key: string): Promise<DemoSession> {
  const res = await apiClient.get<DemoSession>(`/demo/sessions/${key}`);
  return res.data;
}
