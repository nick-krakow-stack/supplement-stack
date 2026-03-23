import { apiClient } from './client';
import type { DemoSession } from '../types';

export async function createDemoSession(stackJson?: string): Promise<DemoSession> {
  const res = await apiClient.post<DemoSession>('/demo', { stack_json: stackJson });
  return res.data;
}

export async function getDemoSession(key: string): Promise<DemoSession> {
  const res = await apiClient.get<DemoSession>(`/demo/${key}`);
  return res.data;
}
