import { apiClient } from './client';
import type { AdminStats, Interaction } from '../types';

export async function getAdminStats(): Promise<AdminStats> {
  const res = await apiClient.get('/admin/stats');
  return res.data;
}

export async function getInteractions(): Promise<Interaction[]> {
  const res = await apiClient.get('/interactions');
  return res.data.interactions ?? [];
}

export async function createInteraction(data: {
  ingredient_a_id: number;
  ingredient_b_id: number;
  type: string;
  comment?: string;
}): Promise<Interaction> {
  const res = await apiClient.post('/interactions', data);
  return res.data.interaction ?? res.data;
}

export async function deleteInteraction(id: number): Promise<void> {
  await apiClient.delete(`/interactions/${id}`);
}
