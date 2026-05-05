import { apiClient } from './client';
import type { Stack, Interaction } from '../types';

interface StackProductInput {
  id: number;
  product_type?: 'catalog' | 'user_product';
  quantity?: number;
  intake_interval_days?: number;
  dosage_text?: string;
  timing?: string;
}

interface ProductLinkReportInput {
  product_id: number;
  product_type?: 'catalog' | 'user_product';
  stack_id?: number | string | null;
  reason?: 'missing_link' | 'invalid_link';
}

export async function getStacks(): Promise<{ stacks: Stack[] }> {
  const res = await apiClient.get<{ stacks: Stack[] }>('/stacks');
  return res.data;
}

export async function getStack(id: number): Promise<Stack> {
  const res = await apiClient.get<Stack>(`/stacks/${id}`);
  return res.data;
}

export async function createStack(name: string, productIds: number[] = []): Promise<Stack> {
  const res = await apiClient.post<{ id: number; name: string }>('/stacks', {
    name,
    product_ids: productIds.map((id) => ({ id, quantity: 1 })),
  });
  return { id: res.data.id, name: res.data.name, created_at: new Date().toISOString() };
}

export async function deleteStack(id: number): Promise<void> {
  await apiClient.delete(`/stacks/${id}`);
}

export async function updateStack(id: number, data: { name?: string; product_ids?: StackProductInput[] }): Promise<Stack> {
  const res = await apiClient.put<Stack>(`/stacks/${id}`, data);
  return res.data;
}

export async function reportProductLink(input: ProductLinkReportInput): Promise<void> {
  await apiClient.post('/stacks/link-report', input);
}

export async function getStackWarnings(id: number): Promise<Interaction[]> {
  // Backend endpoint: GET /api/stack-warnings/:id
  const res = await apiClient.get<{ interactions?: Interaction[]; warnings?: Interaction[] }>(`/stack-warnings/${id}`);
  return res.data.interactions ?? res.data.warnings ?? [];
}
