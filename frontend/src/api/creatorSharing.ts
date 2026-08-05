import { apiClient } from './client';

export const creatorSharingEnabled = import.meta.env.VITE_CREATOR_STACK_SHARING_ENABLED === 'true';

export type CreatorParty = {
  id: number;
  type: 'creator' | 'brand' | 'user';
  name: string;
  slug: string;
  role: 'owner' | 'editor' | 'viewer';
};

export type CreatorShareItem = {
  catalog_product_id: number;
  product_name: string;
  brand: string | null;
  quantity: number;
  intake_interval_days: number;
  dosage_text: string | null;
  timing: string | null;
  creator_statement: string | null;
  category_name: string | null;
  has_affiliate_attribution: boolean;
};

export type CreatorSharePreview = {
  token: string;
  type: 'dose_recommendation' | 'stack';
  title: string;
  creator: { id: number; name: string; type: string };
  published_at: string;
  disclosure: string;
  items: CreatorShareItem[];
};

export type CreatorDashboard = {
  party: { id: number; name: string; type: string };
  period_days: number;
  clicks_total: number;
  clicks: number;
  previous_clicks: number;
  imported_stacks: number;
  clicked_products: number;
  clicked_shops: number;
  active_shares: number;
  imports: number;
};

export async function getCreatorParties(): Promise<CreatorParty[]> {
  const response = await apiClient.get<{ parties: CreatorParty[] }>('/creator-sharing/parties');
  return response.data.parties;
}

export async function createCreatorShare(input: {
  party_id: number;
  stack_id: number;
  type: 'stack' | 'dose_recommendation';
  title: string;
  stack_item_id?: number;
  creator_statements?: Record<string, string>;
}): Promise<{ id: number; token: string; moderation_status: 'pending' }> {
  const response = await apiClient.post('/creator-sharing/shares', input);
  return response.data;
}

export async function getCreatorShare(token: string): Promise<CreatorSharePreview> {
  const response = await apiClient.get<CreatorSharePreview>(`/creator-sharing/shares/${encodeURIComponent(token)}`);
  return response.data;
}

export async function importCreatorShare(token: string, input: {
  idempotency_key: string;
  stack_name?: string;
  target_stack_id?: number;
  conflict_action?: 'keep' | 'replace';
  replace_stack_item_id?: number;
  expected_stack_item_version?: number;
}): Promise<Record<string, unknown>> {
  const response = await apiClient.post(`/creator-sharing/shares/${encodeURIComponent(token)}/import`, input);
  return response.data;
}

export async function getCreatorDashboard(partyId: number): Promise<CreatorDashboard> {
  const response = await apiClient.get<CreatorDashboard>(`/creator-sharing/dashboard?party_id=${partyId}`);
  return response.data;
}

export async function markStackOpened(stackId: number): Promise<void> {
  await apiClient.post(`/creator-sharing/stacks/${stackId}/open`);
}
