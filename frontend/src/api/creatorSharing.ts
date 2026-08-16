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
  product_name: string | null;
  brand: string | null;
  quantity: number;
  unit: string | null;
  intake_interval_days: number | null;
  dosage_text: string | null;
  timing: string | null;
  creator_statement: string | null;
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

export type CreatorShareComparison = {
  product_name: string;
  quantity: number;
  unit: string | null;
  intake_interval_days: number | null;
  dosage_text: string | null;
  timing: string | null;
};

export type CreatorShareSimilarProduct = {
  stack_item_id: number;
  version: number;
  product_type: 'catalog' | 'user_product';
  main_ingredient_names: string[];
  comparison: CreatorShareComparison;
  private_note: string | null;
};

export type CreatorShareTargetSelection = {
  target_mode?: 'new' | 'existing';
  target_stack_id?: number;
  stack_name?: string;
};

export type CreatorSharePreflight = {
  type: 'dose_recommendation' | 'stack';
  snapshot_hash: string;
  title: string;
  creator: { id: number; name: string };
  target: {
    mode: 'new' | 'existing';
    stack_id: number | null;
    stack_name: string;
    name_already_used: boolean;
    suggested_stack_name: string | null;
  };
  main_ingredient_names: string[];
  recommendation: CreatorShareComparison | null;
  similar_products: CreatorShareSimilarProduct[];
  stack_item_count: number;
  preflight_fingerprint: string;
};

export type CreatorShareSaveResult = {
  ok: true;
  type: 'dose_recommendation' | 'stack';
  action: 'stack_created' | 'added' | 'kept_existing' | 'replaced';
  stack_id: number;
  stack_name: string;
  stack_item_id?: number;
  imported_items?: number;
  creator_product_name?: string;
  created_stack?: boolean;
  existing_product_name?: string;
  replaced_product_name?: string;
  replaced_user_product_retained?: boolean;
  idempotent_replay?: boolean;
};

export type CreatorShareStatus = 'pending' | 'approved' | 'blocked' | 'revoked' | 'expired';

export type CreatorOwnedShare = {
  id: number;
  token: string;
  type: 'dose_recommendation' | 'stack';
  entity_id: number;
  source_stack_id: number | null;
  source_stack_name: string | null;
  title: string;
  published_at: string;
  created_at: number;
  expires_at: number | null;
  status: CreatorShareStatus;
  moderation_status: 'pending' | 'approved' | 'blocked';
  is_revoked: number;
  snapshot_hash: string;
  views: number;
  saves: number;
};

export type CreatorOwnedSharePreview = CreatorSharePreview & {
  share_id: number;
  creator_status: CreatorShareStatus;
  snapshot_hash: string;
  moderation_status: 'pending' | 'approved' | 'blocked';
  is_revoked: number;
  expires_at: number | null;
};

export type CreatorSourceShareGuard = {
  share_id: number;
  expected_snapshot_hash: string;
  expected_status: 'blocked' | 'revoked' | 'expired';
  expected_moderation_status: 'pending' | 'approved' | 'blocked';
  expected_is_revoked: number;
  expected_expires_at: number | null;
};

export type CreatorShareReadiness = {
  ready: boolean;
  shareable_stack_item_ids: number[];
  unshareable_products: Array<{ stack_item_id: number; product_name: string }>;
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
  source_share_guard?: CreatorSourceShareGuard;
}): Promise<{ id: number; token: string; moderation_status: 'pending' }> {
  const response = await apiClient.post('/creator-sharing/shares', input);
  return response.data;
}

export async function getCreatorOwnedShares(partyId: number): Promise<CreatorOwnedShare[]> {
  const response = await apiClient.get<{ shares: CreatorOwnedShare[] }>(
    `/creator-sharing/creator-shares?party_id=${partyId}`,
  );
  return response.data.shares;
}

export async function getCreatorOwnedSharePreview(shareId: number): Promise<CreatorOwnedSharePreview> {
  const response = await apiClient.get<CreatorOwnedSharePreview>(
    `/creator-sharing/creator-shares/${shareId}/preview`,
  );
  return response.data;
}

export async function getCreatorShareReadiness(stackId: number, partyId: number): Promise<CreatorShareReadiness> {
  const response = await apiClient.get<CreatorShareReadiness>(
    `/creator-sharing/stacks/${stackId}/share-readiness?party_id=${partyId}`,
  );
  return response.data;
}

export async function revokeCreatorShare(share: Pick<CreatorOwnedShare, 'id' | 'snapshot_hash' | 'moderation_status' | 'is_revoked'>): Promise<void> {
  await apiClient.patch(`/creator-sharing/creator-shares/${share.id}/revoke`, {
    expected_snapshot_hash: share.snapshot_hash,
    expected_moderation_status: share.moderation_status,
    expected_is_revoked: share.is_revoked,
  });
}

export async function getCreatorShare(token: string): Promise<CreatorSharePreview> {
  const response = await apiClient.get<CreatorSharePreview>(`/creator-sharing/shares/${encodeURIComponent(token)}`);
  return response.data;
}

export async function preflightCreatorShare(
  token: string,
  input: CreatorShareTargetSelection,
): Promise<CreatorSharePreflight> {
  const response = await apiClient.post<CreatorSharePreflight>(
    `/creator-sharing/shares/${encodeURIComponent(token)}/preflight`,
    input,
  );
  return response.data;
}

export async function importCreatorShare(token: string, input: CreatorShareTargetSelection & {
  idempotency_key: string;
  preflight_fingerprint: string;
  expected_snapshot_hash: string;
  decision?: 'add' | 'keep' | 'replace';
  selected_stack_item_id?: number;
  expected_stack_item_version?: number;
}): Promise<CreatorShareSaveResult> {
  const response = await apiClient.post<CreatorShareSaveResult>(`/creator-sharing/shares/${encodeURIComponent(token)}/import`, input);
  return response.data;
}

export async function getCreatorDashboard(partyId: number): Promise<CreatorDashboard> {
  const response = await apiClient.get<CreatorDashboard>(`/creator-sharing/dashboard?party_id=${partyId}`);
  return response.data;
}

export async function markStackOpened(stackId: number): Promise<void> {
  await apiClient.post(`/creator-sharing/stacks/${stackId}/open`);
}
