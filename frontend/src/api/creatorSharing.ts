import { apiClient } from './client';

export const creatorSharingEnabled = import.meta.env.VITE_CREATOR_STACK_SHARING_ENABLED === 'true';

export type CreatorAccessState = 'active' | 'not_invited' | 'blocked';
export type CreatorPartyRole = 'owner' | 'editor' | 'viewer';

export type CreatorParty = {
  id: number;
  type: 'creator' | 'brand';
  name: string;
  slug: string;
  role: CreatorPartyRole;
  status: 'active' | 'blocked';
};

export type CreatorAccess = {
  access_state: CreatorAccessState;
  parties: CreatorParty[];
};

export type CreatorShareItem = {
  catalog_product_id: number;
  product_name: string | null;
  brand: string | null;
  image_url?: string | null;
  effect_summary?: string | null;
  quantity: number;
  unit: string | null;
  intake_interval_days: number | null;
  dosage_text: string | null;
  timing: string | null;
  timing_label?: string | null;
  creator_statement: string | null;
};

export type CreatorSharePreview = {
  token: string;
  type: 'dose_recommendation' | 'stack';
  title: string;
  creator: { id: number; name: string; type: string; slug?: string };
  published_at: string;
  items: CreatorShareItem[];
};

export type CreatorShareComparison = {
  product_name: string;
  quantity: number;
  unit: string | null;
  intake_interval_days: number | null;
  dosage_text: string | null;
  timing_label: string | null;
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

export type CreatorShareStatus = 'pending' | 'approved' | 'blocked' | 'paused' | 'revoked' | 'expired';
export type CreatorModerationStatus = 'pending' | 'approved' | 'blocked';

export type CreatorShareMetrics = {
  unique_visitors: number;
  saves: number;
  previous_unique_visitors: number;
  previous_saves: number;
};

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
  paused_at: number | null;
  archived_at: number | null;
  supersedes_share_link_id: number | null;
  status: CreatorShareStatus;
  moderation_status: CreatorModerationStatus;
  moderation_reason: string | null;
  moderation_target: string | null;
  moderation_item_index: number | null;
  moderation_item_name: string | null;
  is_revoked: number;
  snapshot_hash: string;
  version: number;
  metrics: CreatorShareMetrics;
};

export type CreatorOwnedSharePreview = CreatorSharePreview & {
  share_id: number;
  entity_id: number;
  source_stack_id: number | null;
  source_stack_name: string | null;
  creator_status: CreatorShareStatus;
  snapshot_hash: string;
  version: number;
  moderation_status: CreatorModerationStatus;
  moderation_reason: string | null;
  moderation_target: string | null;
  moderation_item_index: number | null;
  moderation_item_name: string | null;
  is_revoked: number;
  paused_at: number | null;
  archived_at: number | null;
  expires_at: number | null;
};

export type CreatorSourceShareGuard = {
  share_id: number;
  expected_version: number;
  expected_snapshot_hash: string;
  expected_status: 'blocked' | 'revoked' | 'expired';
  expected_moderation_status: CreatorModerationStatus;
  expected_is_revoked: number;
  expected_expires_at: number | null;
};

export type CreatorReadinessReasonCode =
  | 'product_missing'
  | 'own_product_not_published'
  | 'not_approved'
  | 'not_visible'
  | 'owner_inactive'
  | 'shop_link_missing'
  | 'shop_link_unsafe'
  | 'intake_missing'
  | 'main_ingredient_missing';

export type CreatorReadinessRepairKind = 'own_product' | 'stack_product' | 'contact_owner';

export type CreatorReadinessProduct = {
  stack_item_id: number;
  product_name: string;
  shareable: boolean;
  reason_code: CreatorReadinessReasonCode | null;
  repair_kind: CreatorReadinessRepairKind | null;
};

export type CreatorShareReadiness = {
  ready: boolean;
  shareable_stack_item_ids: number[];
  unshareable_products: Array<{ stack_item_id: number; product_name: string }>;
  products: CreatorReadinessProduct[];
};

export type CreatorPortfolioArchiveFilter = 'active' | 'archived' | 'all';
export type CreatorPortfolioSort = 'newest' | 'oldest';

export type CreatorMetricsPeriod = {
  days: number;
  from: string;
  to: string;
  previous_from: string;
  previous_to: string;
  unique_visitors_definition: string;
  saves_definition: string;
};

export type CreatorPortfolioQuery = {
  party_id: number;
  q?: string;
  status?: CreatorShareStatus;
  archive?: CreatorPortfolioArchiveFilter;
  sort?: CreatorPortfolioSort;
  cursor?: string;
  limit?: number;
};

export type CreatorPortfolioPage = {
  party: { id: number; name: string; type: string };
  items: CreatorOwnedShare[];
  next_cursor: string | null;
  has_more: boolean;
  metrics_period: CreatorMetricsPeriod;
};

export type CreatorDashboardMetricSet = {
  unique_visitors: number;
  clicks: number;
  saves: number;
  imported_stacks: number;
  clicked_products: number;
  clicked_shops: number;
};

export type CreatorDashboard = {
  party: { id: number; name: string; type: string };
  period: {
    days: number;
    from: string;
    to: string;
    previous_from: string;
    previous_to: string;
    definitions: Record<keyof CreatorDashboardMetricSet, string>;
  };
  current: CreatorDashboardMetricSet;
  previous: CreatorDashboardMetricSet;
  active_shares: number;
  trend: Array<{ date: string; unique_visitors: number; clicks: number; saves: number }>;
};

export type CreatorLifecycleAction = 'pause' | 'resume' | 'set_expiry' | 'clear_expiry' | 'end';

export async function getCreatorAccess(): Promise<CreatorAccess> {
  const response = await apiClient.get<CreatorAccess>('/creator-sharing/parties');
  return response.data;
}

export async function createCreatorShare(input: {
  party_id: number;
  stack_id: number;
  type: 'stack' | 'dose_recommendation';
  title: string;
  stack_item_id?: number;
  creator_statements?: Record<string, string>;
  source_share_guard?: CreatorSourceShareGuard;
}): Promise<{ id: number; token: string; moderation_status: 'pending'; snapshot_hash: string; version: number }> {
  const response = await apiClient.post('/creator-sharing/shares', input);
  return response.data;
}

export async function getCreatorPortfolio(query: CreatorPortfolioQuery): Promise<CreatorPortfolioPage> {
  const params = new URLSearchParams({
    party_id: String(query.party_id),
    archive: query.archive ?? 'active',
    sort: query.sort ?? 'newest',
    limit: String(query.limit ?? 20),
  });
  if (query.q?.trim()) params.set('q', query.q.trim());
  if (query.status) params.set('status', query.status);
  if (query.cursor) params.set('cursor', query.cursor);
  const response = await apiClient.get<{
    party: CreatorPortfolioPage['party'];
    shares: CreatorOwnedShare[];
    next_cursor: string | null;
    has_more: boolean;
    metrics_period: CreatorMetricsPeriod;
  }>(`/creator-sharing/creator-shares?${params.toString()}`);
  return {
    party: response.data.party,
    items: response.data.shares,
    next_cursor: response.data.next_cursor,
    has_more: response.data.has_more,
    metrics_period: response.data.metrics_period,
  };
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

export async function updateCreatorShareLifecycle(
  share: Pick<CreatorOwnedShare, 'id' | 'version' | 'snapshot_hash' | 'status' | 'moderation_status' | 'is_revoked' | 'paused_at' | 'expires_at'>,
  action: CreatorLifecycleAction,
  expiresAt?: number,
): Promise<{ ok: true; status: CreatorShareStatus; version: number; paused_at: number | null; expires_at: number | null; is_revoked: number }> {
  const response = await apiClient.patch(`/creator-sharing/creator-shares/${share.id}/lifecycle`, {
    action,
    expires_at: action === 'set_expiry' ? expiresAt : undefined,
    expected_version: share.version,
    expected_snapshot_hash: share.snapshot_hash,
    expected_status: share.status,
    expected_moderation_status: share.moderation_status,
    expected_is_revoked: share.is_revoked,
    expected_paused_at: share.paused_at,
    expected_expires_at: share.expires_at,
  });
  return response.data;
}

export async function setCreatorShareArchived(
  share: Pick<CreatorOwnedShare, 'id' | 'version' | 'snapshot_hash' | 'archived_at'>,
  archived: boolean,
): Promise<{ ok: true; version: number; archived_at: number | null }> {
  const response = await apiClient.patch(`/creator-sharing/creator-shares/${share.id}/archive`, {
    archived,
    expected_version: share.version,
    expected_snapshot_hash: share.snapshot_hash,
    expected_archived_at: share.archived_at,
  });
  return response.data;
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

export async function getCreatorDashboard(partyId: number, periodDays = 30): Promise<CreatorDashboard> {
  const response = await apiClient.get<CreatorDashboard>(
    `/creator-sharing/dashboard?party_id=${partyId}&period_days=${periodDays}`,
  );
  return response.data;
}

export async function markStackOpened(stackId: number): Promise<void> {
  await apiClient.post(`/creator-sharing/stacks/${stackId}/open`);
}
