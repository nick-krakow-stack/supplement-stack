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

export interface AdminIngredientResearchIngredient {
  id: number;
  name: string;
  unit: string | null;
  category: string | null;
}

export interface AdminIngredientResearchStatus {
  research_status: string;
  calculation_status: string | null;
  internal_notes: string | null;
  blog_url: string | null;
  reviewed_at: string | null;
  review_due_at: string | null;
  raw?: Record<string, unknown>;
}

export interface AdminIngredientResearchListItem {
  ingredient_id: number;
  ingredient_name: string;
  ingredient_unit: string | null;
  category: string | null;
  research_status: string;
  calculation_status: string | null;
  internal_notes: string | null;
  blog_url: string | null;
  reviewed_at: string | null;
  review_due_at: string | null;
  status_reviewed_at: string | null;
  official_source_count: number;
  study_source_count: number;
  warning_count: number;
  no_recommendation_count?: number;
  raw?: Record<string, unknown>;
}

export interface AdminIngredientResearchListResponse {
  items: AdminIngredientResearchListItem[];
  total?: number | null;
  limit?: number;
  offset?: number;
}

export interface AdminIngredientResearchSource {
  id: number;
  ingredient_id: number;
  source_kind: string;
  source_title: string | null;
  source_url: string | null;
  organization: string | null;
  country: string | null;
  region: string | null;
  population: string | null;
  recommendation_type: string | null;
  no_recommendation: number | null;
  notes: string | null;
  dose_min: number | null;
  dose_max: number | null;
  dose_unit: string | null;
  per_kg_body_weight: number | null;
  frequency: string | null;
  study_type: string | null;
  evidence_quality: string | null;
  duration: string | null;
  outcome: string | null;
  finding: string | null;
  doi: string | null;
  pubmed_id: string | null;
  source_date: string | null;
  reviewed_at: string | null;
  raw?: Record<string, unknown>;
}

export interface AdminIngredientResearchWarning {
  id: number;
  ingredient_id: number;
  short_label: string | null;
  popover_text: string | null;
  severity: string | null;
  article_slug: string | null;
  min_amount: number | null;
  unit: string | null;
  active: number | null;
  raw?: Record<string, unknown>;
}

export interface AdminIngredientResearchDetail {
  ingredient: AdminIngredientResearchIngredient;
  status: AdminIngredientResearchStatus;
  sources: AdminIngredientResearchSource[];
  warnings: AdminIngredientResearchWarning[];
}

export interface AdminIngredientResearchStatusPayload {
  research_status?: string | null;
  calculation_status?: string | null;
  internal_notes?: string | null;
  blog_url?: string | null;
  reviewed_at?: string | number | null;
  review_due_at?: string | number | null;
}

export interface AdminIngredientResearchSourcePayload {
  source_kind?: string | null;
  source_title?: string | null;
  source_url?: string | null;
  organization?: string | null;
  country?: string | null;
  region?: string | null;
  population?: string | null;
  recommendation_type?: string | null;
  no_recommendation?: boolean | null;
  notes?: string | null;
  dose_min?: number | null;
  dose_max?: number | null;
  dose_unit?: string | null;
  per_kg_body_weight?: number | null;
  frequency?: string | null;
  study_type?: string | null;
  evidence_quality?: string | null;
  duration?: string | null;
  outcome?: string | null;
  finding?: string | null;
  doi?: string | null;
  pubmed_id?: string | null;
  source_date?: string | number | null;
  reviewed_at?: string | number | null;
}

export interface AdminIngredientResearchWarningPayload {
  short_label?: string | null;
  popover_text?: string | null;
  severity?: string | null;
  article_slug?: string | null;
  min_amount?: number | null;
  unit?: string | null;
  active?: boolean | number | null;
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

function toTextOrNull(value: unknown): string | null {
  if (value === undefined || value === null) return null;
  if (typeof value === 'string') {
    const next = value.trim();
    return next.length === 0 ? null : next;
  }
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) return null;
    return String(value);
  }
  if (typeof value === 'boolean') return value ? '1' : '0';
  return null;
}

function toIntOrNull(value: unknown): number | null {
  if (value === undefined || value === null) return null;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value === 'string') {
    const parsed = Number(value.trim());
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function toBooleanOrNull(value: unknown): boolean | null {
  if (value === undefined || value === null) return null;
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (!normalized) return null;
    if (['1', 'true', 'yes', 'ja', 'on'].includes(normalized)) return true;
    if (['0', 'false', 'no', 'nein', 'off'].includes(normalized)) return false;
  }
  return null;
}

function toDateOrNull(value: unknown): string | null {
  if (value === undefined || value === null) return null;
  if (typeof value === 'number' && Number.isFinite(value)) {
    const asMs = value > 1e12 ? value : value * 1000;
    const date = new Date(asMs);
    return Number.isNaN(date.getTime()) ? null : date.toISOString();
  }
  if (typeof value === 'string') {
    const next = value.trim();
    return next.length === 0 ? null : next;
  }
  return null;
}

function parseIngredientResearchListItem(raw: Record<string, unknown>): AdminIngredientResearchListItem {
  const ingredient = raw.ingredient as Record<string, unknown> | undefined;
  const ingredientId = toIntOrNull(raw.ingredient_id ?? ingredient?.id) ?? 0;
  return {
    ingredient_id: ingredientId,
    ingredient_name:
      toTextOrNull(raw.ingredient_name ?? raw.name ?? ingredient?.name) || `Ingredient ${ingredientId}`,
    ingredient_unit: toTextOrNull(raw.ingredient_unit ?? raw.unit ?? ingredient?.unit),
    category: toTextOrNull(raw.category ?? ingredient?.category),
    research_status: toTextOrNull(raw.research_status) || 'unreviewed',
    calculation_status: toTextOrNull(raw.calculation_status),
    internal_notes: toTextOrNull(raw.internal_notes),
    blog_url: toTextOrNull(raw.blog_url),
    reviewed_at: toDateOrNull(raw.reviewed_at) ?? toDateOrNull(raw.status_reviewed_at),
    review_due_at: toDateOrNull(raw.review_due_at),
    status_reviewed_at: toDateOrNull(raw.status_reviewed_at),
    official_source_count: toIntOrNull(raw.official_source_count) ?? toIntOrNull(raw.official_count) ?? 0,
    study_source_count: toIntOrNull(raw.study_source_count) ?? toIntOrNull(raw.study_count) ?? 0,
    warning_count: toIntOrNull(raw.warning_count) ?? 0,
    no_recommendation_count: toIntOrNull(raw.no_recommendation_count) ?? 0,
    raw,
  };
}

function parseIngredientResearchIngredient(raw: Record<string, unknown>): AdminIngredientResearchIngredient {
  return {
    id: toIntOrNull(raw.id) ?? 0,
    name: toTextOrNull(raw.name) || `Ingredient ${toIntOrNull(raw.id) ?? ''}`,
    unit: toTextOrNull(raw.unit),
    category: toTextOrNull(raw.category),
  };
}

function parseIngredientResearchStatus(raw: Record<string, unknown>): AdminIngredientResearchStatus {
  return {
    research_status: toTextOrNull(raw.research_status) || toTextOrNull(raw.status) || 'unreviewed',
    calculation_status: toTextOrNull(raw.calculation_status),
    internal_notes: toTextOrNull(raw.internal_notes),
    blog_url: toTextOrNull(raw.blog_url),
    reviewed_at: toDateOrNull(raw.reviewed_at),
    review_due_at: toDateOrNull(raw.review_due_at),
    raw,
  };
}

function normalizeSourceType(value: unknown): string {
  const normalized = toTextOrNull(value) ?? 'other';
  return normalized.toLowerCase();
}

function parseIngredientResearchSource(raw: Record<string, unknown>): AdminIngredientResearchSource {
  return {
    id: toIntOrNull(raw.id) ?? 0,
    ingredient_id: toIntOrNull(raw.ingredient_id) ?? 0,
    source_kind: normalizeSourceType(raw.source_kind ?? raw.source_type),
    source_title: toTextOrNull(raw.source_title ?? raw.title ?? raw.name ?? raw.label),
    source_url: toTextOrNull(raw.source_url ?? raw.url ?? raw.link ?? raw.reference_url),
    organization: toTextOrNull(raw.organization),
    country: toTextOrNull(raw.country),
    region: toTextOrNull(raw.region),
    population: toTextOrNull(raw.population),
    recommendation_type: toTextOrNull(raw.recommendation_type),
    no_recommendation: toBooleanOrNull(raw.no_recommendation),
    notes: toTextOrNull(raw.notes ?? raw.note ?? raw.description),
    dose_min: toIntOrNull(raw.dose_min ?? raw.min_dose),
    dose_max: toIntOrNull(raw.dose_max ?? raw.max_dose),
    dose_unit: toTextOrNull(raw.dose_unit ?? raw.unit),
    per_kg_body_weight: toIntOrNull(raw.per_kg_body_weight),
    frequency: toTextOrNull(raw.frequency),
    study_type: toTextOrNull(raw.study_type),
    evidence_quality: toTextOrNull(raw.evidence_quality),
    duration: toTextOrNull(raw.duration),
    outcome: toTextOrNull(raw.outcome),
    finding: toTextOrNull(raw.finding),
    doi: toTextOrNull(raw.doi),
    pubmed_id: toTextOrNull(raw.pubmed_id),
    source_date: toDateOrNull(raw.source_date),
    reviewed_at: toDateOrNull(raw.reviewed_at),
    raw,
  };
}

function parseIngredientResearchWarning(raw: Record<string, unknown>): AdminIngredientResearchWarning {
  return {
    id: toIntOrNull(raw.id) ?? 0,
    ingredient_id: toIntOrNull(raw.ingredient_id) ?? 0,
    short_label: toTextOrNull(raw.short_label ?? raw.warning_type ?? raw.title),
    popover_text: toTextOrNull(raw.popover_text ?? raw.message ?? raw.warning_text),
    severity: toTextOrNull(raw.severity),
    article_slug: toTextOrNull(raw.article_slug),
    min_amount: toIntOrNull(raw.min_amount),
    unit: toTextOrNull(raw.unit),
    active: toIntOrNull(raw.active),
    raw,
  };
}

function normalizeIngredientResearchListResponse(raw: unknown): AdminIngredientResearchListResponse {
  const payload = raw as {
    ingredients?: unknown;
    items?: unknown;
    data?: unknown;
    results?: unknown;
    total?: number | null;
    count?: number | null;
    limit?: number;
    offset?: number;
  };
  const container = payload.ingredients ?? payload.items ?? payload.data ?? payload.results;
  const list = Array.isArray(container) ? container : [];
  return {
    items: list.map((entry) => parseIngredientResearchListItem(entry as Record<string, unknown>)),
    total: payload.total ?? payload.count ?? null,
    limit: payload.limit,
    offset: payload.offset,
  };
}

function normalizeIngredientResearchDetailResponse(raw: unknown): AdminIngredientResearchDetail {
  const payload = raw as {
    ingredient?: unknown;
    status?: unknown;
    sources?: unknown;
    warnings?: unknown;
    data?: unknown;
  };

  const source = (payload.ingredient ??
    ((payload.data as Record<string, unknown> | undefined)?.ingredient as unknown) ??
    {}) as Record<string, unknown>;
  const status = (payload.status ??
    ((payload.data as Record<string, unknown> | undefined)?.status as unknown) ??
    {}) as Record<string, unknown>;
  const rawSources = (payload.sources ?? (payload.data as { sources?: unknown } | undefined)?.sources) as
    | unknown[]
    | undefined;
  const rawWarnings = (payload.warnings ?? (payload.data as { warnings?: unknown } | undefined)?.warnings) as
    | unknown[]
    | undefined;

  return {
    ingredient: source ? parseIngredientResearchIngredient(source) : { id: 0, name: 'Unknown', unit: null, category: null },
    status: status ? parseIngredientResearchStatus(status) : {
      research_status: 'unreviewed',
      calculation_status: null,
      internal_notes: null,
      blog_url: null,
      reviewed_at: null,
      review_due_at: null,
    },
    sources: Array.isArray(rawSources) ? rawSources.map((sourceEntry) => parseIngredientResearchSource(sourceEntry as Record<string, unknown>)) : [],
    warnings: Array.isArray(rawWarnings) ? rawWarnings.map((warningEntry) => parseIngredientResearchWarning(warningEntry as Record<string, unknown>)) : [],
  };
}

function normalizeStatusPayload(payload: AdminIngredientResearchStatusPayload): AdminIngredientResearchStatusPayload {
  return {
    research_status: toTextOrNull(payload.research_status),
    calculation_status: toTextOrNull(payload.calculation_status),
    internal_notes: toTextOrNull(payload.internal_notes),
    blog_url: toTextOrNull(payload.blog_url),
    reviewed_at: payload.reviewed_at !== undefined ? toDateOrNull(payload.reviewed_at) : null,
    review_due_at: payload.review_due_at !== undefined ? toDateOrNull(payload.review_due_at) : null,
  };
}

function normalizeSourcePayload(payload: AdminIngredientResearchSourcePayload): AdminIngredientResearchSourcePayload {
  return {
    source_kind: toTextOrNull(payload.source_kind),
    source_title: toTextOrNull(payload.source_title),
    source_url: toTextOrNull(payload.source_url),
    organization: toTextOrNull(payload.organization),
    country: toTextOrNull(payload.country),
    region: toTextOrNull(payload.region),
    population: toTextOrNull(payload.population),
    recommendation_type: toTextOrNull(payload.recommendation_type),
    no_recommendation: payload.no_recommendation,
    notes: toTextOrNull(payload.notes),
    dose_min: toIntOrNull(payload.dose_min),
    dose_max: toIntOrNull(payload.dose_max),
    dose_unit: toTextOrNull(payload.dose_unit),
    per_kg_body_weight: toIntOrNull(payload.per_kg_body_weight),
    frequency: toTextOrNull(payload.frequency),
    study_type: toTextOrNull(payload.study_type),
    evidence_quality: toTextOrNull(payload.evidence_quality),
    duration: toTextOrNull(payload.duration),
    outcome: toTextOrNull(payload.outcome),
    finding: toTextOrNull(payload.finding),
    doi: toTextOrNull(payload.doi),
    pubmed_id: toTextOrNull(payload.pubmed_id),
    source_date: payload.source_date !== undefined ? toDateOrNull(payload.source_date) : null,
    reviewed_at: payload.reviewed_at !== undefined ? toDateOrNull(payload.reviewed_at) : null,
  };
}

function normalizeWarningPayload(payload: AdminIngredientResearchWarningPayload): AdminIngredientResearchWarningPayload {
  return {
    short_label: toTextOrNull(payload.short_label),
    popover_text: toTextOrNull(payload.popover_text),
    severity: toTextOrNull(payload.severity),
    article_slug: toTextOrNull(payload.article_slug),
    min_amount: toIntOrNull(payload.min_amount),
    unit: toTextOrNull(payload.unit),
    active:
      typeof payload.active === 'number'
        ? payload.active !== 0
        : payload.active,
  };
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

export async function getIngredientResearchItems(params: {
  q?: string;
  category?: string;
  status?: string;
  limit?: number;
  offset?: number;
} = {}): Promise<AdminIngredientResearchListResponse> {
  const query = toQueryParams({
    q: params.q,
    category: params.category,
    status: params.status,
    limit: params.limit,
    offset: params.offset,
  });
  const { data } = await apiClient
    .get('/admin/ingredient-research', {
      params: query,
    })
    .then((response) => response);
  return normalizeIngredientResearchListResponse(data);
}

export async function getIngredientResearchDetail(ingredientId: number): Promise<AdminIngredientResearchDetail> {
  const { data } = await apiClient.get(`/admin/ingredient-research/${ingredientId}`).then((response) => response);
  return normalizeIngredientResearchDetailResponse(data);
}

export async function updateIngredientResearchStatus(
  ingredientId: number,
  payload: AdminIngredientResearchStatusPayload,
): Promise<AdminIngredientResearchStatus> {
  const normalized = normalizeStatusPayload(payload);
  const { data } = await apiClient
    .put(`/admin/ingredient-research/${ingredientId}/status`, normalized)
    .then((response) => response.data);
  const status = data?.status ?? data;
  if (status && typeof status === 'object') return parseIngredientResearchStatus(status as Record<string, unknown>);
  return normalizeIngredientResearchDetailResponse(data).status;
}

export async function createIngredientResearchSource(
  ingredientId: number,
  payload: AdminIngredientResearchSourcePayload,
): Promise<AdminIngredientResearchSource> {
  const normalized = normalizeSourcePayload(payload);
  const { data } = await apiClient
    .post(`/admin/ingredient-research/${ingredientId}/sources`, normalized)
    .then((response) => response.data);
  const created = data?.source ?? data;
  if (created && typeof created === 'object') {
    return parseIngredientResearchSource(created as Record<string, unknown>);
  }
  throw new Error('Could not parse source response.');
}

export async function updateIngredientResearchSource(
  sourceId: number,
  payload: AdminIngredientResearchSourcePayload,
): Promise<AdminIngredientResearchSource> {
  const normalized = normalizeSourcePayload(payload);
  const { data } = await apiClient
    .put(`/admin/ingredient-research/sources/${sourceId}`, normalized)
    .then((response) => response.data);
  const updated = data?.source ?? data;
  if (updated && typeof updated === 'object') {
    return parseIngredientResearchSource(updated as Record<string, unknown>);
  }
  throw new Error('Could not parse source response.');
}

export async function deleteIngredientResearchSource(sourceId: number): Promise<void> {
  await apiClient.delete(`/admin/ingredient-research/sources/${sourceId}`);
}

export async function createIngredientResearchWarning(
  ingredientId: number,
  payload: AdminIngredientResearchWarningPayload,
): Promise<AdminIngredientResearchWarning> {
  const normalized = normalizeWarningPayload(payload);
  const { data } = await apiClient
    .post(`/admin/ingredient-research/${ingredientId}/warnings`, normalized)
    .then((response) => response.data);
  const created = data?.warning ?? data;
  if (created && typeof created === 'object') {
    return parseIngredientResearchWarning(created as Record<string, unknown>);
  }
  throw new Error('Could not parse warning response.');
}

export async function updateIngredientResearchWarning(
  warningId: number,
  payload: AdminIngredientResearchWarningPayload,
): Promise<AdminIngredientResearchWarning> {
  const normalized = normalizeWarningPayload(payload);
  const { data } = await apiClient
    .put(`/admin/ingredient-research/warnings/${warningId}`, normalized)
    .then((response) => response.data);
  const updated = data?.warning ?? data;
  if (updated && typeof updated === 'object') {
    return parseIngredientResearchWarning(updated as Record<string, unknown>);
  }
  throw new Error('Could not parse warning response.');
}

export async function deleteIngredientResearchWarning(warningId: number): Promise<void> {
  await apiClient.delete(`/admin/ingredient-research/warnings/${warningId}`);
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
