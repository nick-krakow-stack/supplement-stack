import { apiClient } from './client';
import type { AxiosError } from 'axios';
import type { AdminStats, Interaction } from '../types';

export interface AdminIngredientSubIngredient {
  parent_ingredient_id: number;
  parent_name: string;
  parent_unit?: string | null;
  child_ingredient_id: number;
  child_name: string;
  child_unit?: string | null;
  prompt_label: string | null;
  is_default_prompt: number;
  sort_order: number;
  created_at?: number | string | null;
}

export interface IngredientLookup {
  id: number;
  name: string;
  unit?: string | null;
}

export interface AdminDoseRecommendation {
  id: number;
  ingredient_id?: number | null;
  ingredient_name?: string | null;
  population_id?: number | null;
  population_slug?: string | null;
  source_type?: string | null;
  source_label?: string | null;
  source_url?: string | null;
  dose_min?: number | null;
  dose_max?: number | null;
  unit?: string | null;
  per_kg_body_weight?: number | null;
  per_kg_cap?: number | null;
  timing?: string | null;
  context_note?: string | null;
  sex_filter?: string | null;
  is_athlete?: number | null;
  purpose?: string | null;
  is_default?: number | null;
  is_active?: number | null;
  relevance_score?: number | null;
  verified_profile_id?: number | null;
  verified_profile_name?: string | null;
  category_name?: string | null;
  created_by_user_id?: number | null;
  is_public?: number | null;
}

export interface AdminDoseRecommendationPayload {
  ingredient_id?: number | null;
  population_id?: number | null;
  population_slug?: string | null;
  source_type?: string | null;
  source_label?: string | null;
  source_url?: string | null;
  dose_min?: number | null;
  dose_max?: number | null;
  unit?: string | null;
  per_kg_body_weight?: number | null;
  per_kg_cap?: number | null;
  timing?: string | null;
  context_note?: string | null;
  sex_filter?: string | null;
  is_athlete?: number | null;
  purpose?: string | null;
  is_default?: number | null;
  is_active?: number | null;
  is_public?: number | null;
  relevance_score?: number | null;
  verified_profile_id?: number | null;
  category_name?: string | null;
}

export interface AdminDoseRecommendationResponse {
  recommendations: AdminDoseRecommendation[];
  total?: number | null;
  limit?: number;
  offset?: number;
  page?: number;
  source: 'admin' | 'fallback-translations';
}

export interface AdminAuditLogEntry {
  id: number;
  action: string;
  entity_type: string;
  entity_id: number | null;
  user_email?: string | null;
  user_id?: number | null;
  reason?: string | null;
  changes?: Record<string, unknown> | null;
  ip_address?: string | null;
  user_agent?: string | null;
  created_at: string;
}

export interface AdminAuditLogResponse {
  entries: AdminAuditLogEntry[];
  total?: number | null;
  limit?: number;
  page?: number;
  offset?: number;
  source: string;
}

interface AuditFilterParams {
  action?: string;
  entity_type?: string;
  user_id?: number | string;
  date_from?: string;
  date_to?: string;
  date?: string;
  from?: string;
  to?: string;
  page?: number;
  limit?: number;
}

interface IngredientListResponse {
  ingredients: IngredientLookup[];
  limit?: number;
  offset?: number;
}

interface AdminListResponse {
  recommendations?: AdminDoseRecommendation[];
  dose_recommendments?: AdminDoseRecommendation[];
  dose_recommendment?: AdminDoseRecommendation;
  dose_recommendations?: AdminDoseRecommendation[];
  total?: number | null;
  count?: number;
  limit?: number;
  offset?: number;
}

interface TranslationDoseRow {
  dose_recommendation_id: number;
  ingredient_name: string;
  source_type: string;
  base_source_label: string;
  base_timing: string | null;
  base_context_note: string | null;
  dose_min: number | null;
  dose_max: number | null;
  unit: string;
  per_kg_body_weight: number | null;
  per_kg_cap: number | null;
  population_slug: string | null;
  purpose: string;
  sex_filter: string | null;
  is_athlete: number;
  is_active: number;
  timing: string | null;
  context_note: string | null;
}

type QueryParams = Record<string, string | number | boolean | undefined | null>;

const DOSE_RECOMMENDATION_ENDPOINTS = [
  '/admin/dose-recommendations',
  '/admin/dose_recommendments',
] as const;

const AUDIT_LOG_ENDPOINTS = [
  '/admin/audit-log',
  '/admin/audit-logs',
  '/admin/audit',
] as const;

function toQueryParams(input: QueryParams): Record<string, string> {
  const params: Record<string, string> = {};
  Object.entries(input).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') return;
    params[key] = String(value);
  });
  return params;
}

function toTrimmedOrNull(value?: string | null): string | null {
  if (value === undefined) return null;
  if (value === null) return null;
  const next = value.trim();
  return next.length === 0 ? null : next;
}

function isNotFoundError(error: unknown): error is AxiosError {
  return (
    typeof error === 'object' &&
    error !== null &&
    (error as AxiosError).isAxiosError === true &&
    typeof (error as AxiosError).response?.status === 'number' &&
    (error as AxiosError).response?.status === 404
  );
}

export function isEndpointMissingError(error: unknown): boolean {
  return isNotFoundError(error);
}

async function requestWithFallback<T>(
  paths: readonly string[],
  request: (path: string) => Promise<T>,
): Promise<{ path: string; data: T }> {
  let lastError: unknown = null;
  for (const path of paths) {
    try {
      const data = await request(path);
      return { path, data };
    } catch (error) {
      if (!isNotFoundError(error)) {
        throw error;
      }
      lastError = error;
    }
  }
  throw lastError;
}

function parseAuditEntries(raw: unknown): AdminAuditLogEntry[] {
  const container = raw as {
    entries?: unknown;
    logs?: unknown;
    data?: unknown;
  };
  const candidate = (container.entries ?? container.logs ?? container.data) as unknown;
  if (!Array.isArray(candidate)) return [];

  return (candidate as unknown[]).map((entry, index) => {
    const row = entry as Record<string, unknown>;
    const createdAt =
      row.created_at !== undefined && row.created_at !== null
        ? typeof row.created_at === 'number'
          ? new Date(row.created_at * 1000).toISOString()
          : String(row.created_at)
        : '';
    return {
      id: typeof row.id === 'number' ? row.id : -index - 1,
      action: typeof row.action === 'string' ? row.action : '',
      entity_type: typeof row.entity_type === 'string' ? row.entity_type : '',
      entity_id: typeof row.entity_id === 'number' ? row.entity_id : null,
      user_email: typeof row.user_email === 'string' ? row.user_email : null,
      user_id: typeof row.user_id === 'number' ? row.user_id : null,
      reason: typeof row.reason === 'string' ? row.reason : null,
      changes:
        typeof row.changes === 'object' && row.changes !== null
          ? (row.changes as Record<string, unknown>)
          : null,
      ip_address: typeof row.ip_address === 'string' ? row.ip_address : null,
      user_agent: typeof row.user_agent === 'string' ? row.user_agent : null,
      created_at: createdAt,
    };
  });
}

function normalizeDoseListResponse(raw: unknown): AdminDoseRecommendation[] {
  const payload = raw as AdminListResponse;
  const candidates = payload.recommendations ?? payload.dose_recommendments ?? payload.dose_recommendment ?? [];
  if (!Array.isArray(candidates)) return [];
  return candidates;
}

function mapTranslationDoseRowToAdmin(row: TranslationDoseRow): AdminDoseRecommendation {
  return {
    id: row.dose_recommendation_id,
    ingredient_name: row.ingredient_name,
    source_type: row.source_type,
    source_label: row.base_source_label,
    source_url: null,
    dose_min: row.dose_min,
    dose_max: row.dose_max,
    unit: row.unit,
    per_kg_body_weight: row.per_kg_body_weight,
    per_kg_cap: row.per_kg_cap,
    population_slug: row.population_slug,
    timing: row.timing ?? row.base_timing,
    context_note: row.context_note ?? row.base_context_note,
    sex_filter: row.sex_filter,
    is_athlete: row.is_athlete,
    purpose: row.purpose,
    is_active: row.is_active,
    is_default: 0,
  };
}

function normalizeDosePayload(payload: AdminDoseRecommendationPayload): AdminDoseRecommendationPayload {
  return {
    ingredient_id: payload.ingredient_id,
    population_id: payload.population_id,
    population_slug: toTrimmedOrNull(payload.population_slug),
    source_type: toTrimmedOrNull(payload.source_type),
    source_label: toTrimmedOrNull(payload.source_label),
    source_url: toTrimmedOrNull(payload.source_url),
    dose_min: payload.dose_min ?? null,
    dose_max: payload.dose_max ?? null,
    unit: toTrimmedOrNull(payload.unit),
    per_kg_body_weight: payload.per_kg_body_weight ?? null,
    per_kg_cap: payload.per_kg_cap ?? null,
    timing: toTrimmedOrNull(payload.timing),
    context_note: toTrimmedOrNull(payload.context_note),
    sex_filter: toTrimmedOrNull(payload.sex_filter),
    is_athlete: payload.is_athlete,
    purpose: toTrimmedOrNull(payload.purpose),
    is_default: payload.is_default,
    is_active: payload.is_active,
    relevance_score: payload.relevance_score ?? null,
    verified_profile_id: payload.verified_profile_id ?? null,
  };
}

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
  return (res.data.interaction ?? res.data) as Interaction;
}

export async function deleteInteraction(id: number): Promise<void> {
  await apiClient.delete(`/interactions/${id}`);
}

export async function searchIngredients(query: string): Promise<IngredientLookup[]> {
  const trimmedQuery = query.trim();
  if (!trimmedQuery) return [];
  const res = await apiClient.get<{ ingredients: IngredientLookup[] }>('/ingredients/search', {
    params: { q: trimmedQuery },
  });
  return res.data.ingredients ?? [];
}

export async function getAllIngredients(): Promise<IngredientLookup[]> {
  try {
    const res = await apiClient.get<IngredientListResponse>('/ingredients');
    return res.data.ingredients ?? [];
  } catch {
    return [];
  }
}

export async function getIngredientSubIngredients(params?: {
  parentIngredientId?: number | null;
}): Promise<AdminIngredientSubIngredient[]> {
  const query = params?.parentIngredientId
    ? { parent_ingredient_id: params.parentIngredientId }
    : {};
  const res = await apiClient.get<{ mappings: AdminIngredientSubIngredient[] }>(
    '/admin/ingredient-sub-ingredients',
    {
      params: query,
    },
  );
  return res.data.mappings ?? [];
}

export async function upsertIngredientSubIngredient(payload: {
  parent_ingredient_id: number;
  child_ingredient_id: number;
  sort_order: number;
  prompt_label?: string | null;
  is_default_prompt?: number | boolean;
}): Promise<AdminIngredientSubIngredient> {
  const normalizedPayload = {
    parent_ingredient_id: payload.parent_ingredient_id,
    child_ingredient_id: payload.child_ingredient_id,
    sort_order: payload.sort_order,
    prompt_label: toTrimmedOrNull(payload.prompt_label),
    is_default_prompt:
      typeof payload.is_default_prompt === 'boolean'
        ? payload.is_default_prompt
          ? 1
          : 0
        : payload.is_default_prompt ?? 0,
  };
  const res = await apiClient.put<{ mapping: AdminIngredientSubIngredient }>(
    '/admin/ingredient-sub-ingredients',
    normalizedPayload,
  );
  return res.data.mapping;
}

export async function deleteIngredientSubIngredient(
  parentIngredientId: number,
  childIngredientId: number,
): Promise<void> {
  await apiClient.delete(`/admin/ingredient-sub-ingredients/${parentIngredientId}/${childIngredientId}`);
}

export async function getDoseRecommendations(params: {
  q?: string;
  page?: number;
  limit?: number;
  ingredient_id?: number;
  source_type?: string;
  active?: boolean | number | string;
  public?: boolean | number | string;
} = {}): Promise<AdminDoseRecommendationResponse> {
  const page = params.page && params.page > 0 ? Math.floor(params.page) : 1;
  const limit = params.limit && params.limit > 0 ? Math.floor(params.limit) : 50;
  const offset = (page - 1) * limit;

  const query = toQueryParams({
    q: params.q,
    page,
    limit,
    offset,
    ingredient_id: params.ingredient_id,
    source_type: params.source_type,
    active: params.active,
    public: params.public,
  });

  try {
    const { data } = await requestWithFallback<AdminListResponse>(DOSE_RECOMMENDATION_ENDPOINTS, (path) =>
      apiClient.get<AdminListResponse>(path, { params: query }).then((response) => response.data),
    );
    const recommendations = normalizeDoseListResponse(data);
    return {
      recommendations,
      total: (data as { total?: number | null; count?: number }).total ?? 0,
      limit: (data as { limit?: number }).limit,
      offset: (data as { offset?: number }).offset,
      page: (data as { page?: number }).page ?? page,
      source: 'admin',
    };
  } catch (adminErr) {
    if (!isEndpointMissingError(adminErr)) throw adminErr;
  }

  try {
    const translationRes = await apiClient.get<{
      translations?: TranslationDoseRow[];
      total?: number | null;
      count?: number;
      limit?: number;
      offset?: number;
    }>('/admin/translations/dose-recommendations', { params: query });

    const recommendations = Array.isArray(translationRes.data.translations)
      ? translationRes.data.translations.map(mapTranslationDoseRowToAdmin)
      : [];

    return {
      recommendations,
      total: translationRes.data.total ?? translationRes.data.count ?? null,
      limit: translationRes.data.limit,
      offset: translationRes.data.offset,
      page: page,
      source: 'fallback-translations',
    };
  } catch (fallbackErr) {
    if (isEndpointMissingError(fallbackErr)) {
      throw new Error('Dose recommendations endpoint is not available in this environment.');
    }
    throw fallbackErr;
  }
}

export async function createDoseRecommendation(
  payload: AdminDoseRecommendationPayload,
): Promise<AdminDoseRecommendation> {
  const normalized = normalizeDosePayload(payload);
  const { data } = await requestWithFallback<unknown>(DOSE_RECOMMENDATION_ENDPOINTS, (path) =>
    apiClient.post(path, normalized).then((response) => response.data),
  );
  const mapped = data as {
    recommendation?: AdminDoseRecommendation;
    dose_recommendment?: AdminDoseRecommendation;
  };
  if (mapped.recommendation) return mapped.recommendation;
  if (mapped.dose_recommendment) return mapped.dose_recommendment;
  return data as AdminDoseRecommendation;
}

export async function updateDoseRecommendation(
  doseRecommendationId: number,
  payload: AdminDoseRecommendationPayload,
): Promise<AdminDoseRecommendation> {
  const normalized = normalizeDosePayload(payload);
  const paths = [
    `/admin/dose-recommendations/${doseRecommendationId}`,
    `/admin/dose_recommendments/${doseRecommendationId}`,
  ] as const;
  const { data } = await requestWithFallback<unknown>(paths, (path) =>
    apiClient.put(path, normalized).then((response) => response.data),
  );
  const mapped = data as {
    recommendation?: AdminDoseRecommendation;
    dose_recommendment?: AdminDoseRecommendation;
    dose_recommendments?: AdminDoseRecommendation;
  };
  if (mapped.recommendation) return mapped.recommendation;
  if (mapped.dose_recommendment) return mapped.dose_recommendment;
  if (mapped.dose_recommendments) return mapped.dose_recommendments;
  return data as AdminDoseRecommendation;
}

export async function deleteDoseRecommendation(doseRecommendationId: number): Promise<void> {
  const paths = [
    `/admin/dose-recommendations/${doseRecommendationId}`,
    `/admin/dose_recommendments/${doseRecommendationId}`,
  ] as const;
  await requestWithFallback<{ ok: boolean }>(paths, async (path) => {
    await apiClient.delete(path);
    return { ok: true };
  });
}

export async function getAuditLog(filters: AuditFilterParams = {}): Promise<AdminAuditLogResponse> {
  const page = filters.page && filters.page > 0 ? Math.floor(filters.page) : 1;
  const limit = filters.limit && filters.limit > 0 ? Math.floor(filters.limit) : 50;
  const from = filters.date_from ?? filters.from;
  const to = filters.date_to ?? filters.to;
  const query = toQueryParams({
    action: filters.action,
    entity_type: filters.entity_type,
    user_id: filters.user_id,
    date_from: from,
    date_to: to,
    date: filters.date,
    page,
    limit,
  });

  try {
    const { path, data } = await requestWithFallback<Record<string, unknown>>(AUDIT_LOG_ENDPOINTS, (endpoint) =>
      apiClient.get(endpoint, { params: query }).then((response) => response.data),
    );
    const count = data.total ?? data.count ?? null;
    const resolvedLimit = typeof data.limit === 'number' ? data.limit : limit;
    const resolvedOffset = typeof data.offset === 'number' ? data.offset : (page - 1) * resolvedLimit;
    return {
      entries: parseAuditEntries(data),
      total: typeof count === 'number' ? count : undefined,
      page: typeof data.page === 'number' ? data.page : page,
      limit: resolvedLimit,
      offset: resolvedOffset,
      source: path,
    };
  } catch (error) {
    if (isEndpointMissingError(error)) {
      return {
        entries: [],
        total: 0,
        page,
        limit,
        offset: (page - 1) * limit,
        source: 'audlog-endpoint-unavailable',
      };
    }
    throw error;
  }
}
