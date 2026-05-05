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
  no_recommendation_count: number;
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
  no_recommendation: boolean | null;
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

export interface AdminKnowledgeArticle {
  slug: string;
  title: string;
  summary: string | null;
  body: string | null;
  status: string;
  reviewed_at: string | null;
  sources_json: unknown;
  created_at?: string | null;
  updated_at?: string | null;
  archived_at?: string | null;
  raw?: Record<string, unknown>;
}

export interface AdminKnowledgeArticlePayload {
  slug?: string;
  title: string;
  summary?: string | null;
  body?: string | null;
  status?: string | null;
  reviewed_at?: string | null;
  sources_json?: unknown;
}

export interface AdminKnowledgeArticlesResponse {
  articles: AdminKnowledgeArticle[];
  total?: number | null;
}

export interface AdminOpsDashboard {
  research: {
    due_reviews: number;
    unreviewed: number;
    researching: number;
    stale: number;
  };
  knowledge: {
    drafts: number;
  };
  warnings: {
    without_article: number;
  };
  product_qa: {
    issues: number;
  };
  totals: Record<string, number>;
  queues: {
    product_qa: AdminProductQAProduct[];
    research_due: AdminOpsResearchQueueItem[];
    research_later: AdminOpsResearchQueueItem[];
    warnings_without_article: AdminOpsWarningQueueItem[];
    knowledge_drafts: AdminOpsKnowledgeDraftItem[];
  };
  raw?: Record<string, unknown>;
}

export interface AdminOpsResearchQueueItem {
  ingredient_id: number;
  ingredient_name: string;
  research_status: string;
  review_due_at: string | null;
  reviewed_at: string | null;
  calculation_status: string | null;
  raw?: Record<string, unknown>;
}

export interface AdminOpsWarningQueueItem {
  id: number;
  ingredient_id: number | null;
  ingredient_name: string | null;
  form_id: number | null;
  form_name: string | null;
  short_label: string | null;
  article_slug: string | null;
  severity: string | null;
  raw?: Record<string, unknown>;
}

export interface AdminOpsKnowledgeDraftItem {
  slug: string;
  title: string;
  status: string;
  reviewed_at: string | null;
  updated_at: string | null;
  raw?: Record<string, unknown>;
}

export interface AdminProductQAProduct {
  id: number;
  name: string;
  brand: string | null;
  price: number | null;
  shop_link: string | null;
  image_url: string | null;
  is_affiliate: number | null;
  serving_size: number | null;
  serving_unit: string | null;
  servings_per_container: number | null;
  container_count: number | null;
  ingredient_count: number;
  main_ingredient_count: number;
  issues: string[];
  raw?: Record<string, unknown>;
}

export interface AdminProductQAResponse {
  products: AdminProductQAProduct[];
}

export interface AdminProductQAPatch {
  price?: number | null;
  shop_link?: string | null;
  is_affiliate?: number | boolean | null;
  serving_size?: number | null;
  serving_unit?: string | null;
  servings_per_container?: number | null;
  container_count?: number | null;
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

function toNumberOrNull(value: unknown): number | null {
  if (value === undefined || value === null) return null;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value === 'string') {
    const parsed = Number(value.trim().replace(',', '.'));
    return Number.isFinite(parsed) ? parsed : null;
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

function readCount(raw: Record<string, unknown>, keys: string[]): number {
  for (const key of keys) {
    const value = toNumberOrNull(raw[key]);
    if (value !== null) return value;
  }
  return 0;
}

function parseCountMap(value: unknown): Record<string, number> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return Object.entries(value as Record<string, unknown>).reduce<Record<string, number>>((acc, [key, entry]) => {
    const parsed = toNumberOrNull(entry);
    if (parsed !== null) acc[key] = parsed;
    return acc;
  }, {});
}

function parseTotals(payload: Record<string, unknown>): Record<string, number> {
  const totals = parseCountMap(payload.totals);
  Object.entries(payload).forEach(([key, value]) => {
    if (!key.endsWith('_total')) return;
    const parsed = toNumberOrNull(value);
    if (parsed !== null) totals[key] = parsed;
  });
  return totals;
}

function parseKnowledgeArticle(raw: Record<string, unknown>): AdminKnowledgeArticle {
  const slug = toTextOrNull(raw.slug) || '';
  return {
    slug,
    title: toTextOrNull(raw.title) || slug || 'Unbenannter Artikel',
    summary: toTextOrNull(raw.summary),
    body: toTextOrNull(raw.body),
    status: toTextOrNull(raw.status) || 'draft',
    reviewed_at: toDateOrNull(raw.reviewed_at),
    sources_json: raw.sources_json ?? raw.sources ?? null,
    created_at: toDateOrNull(raw.created_at),
    updated_at: toDateOrNull(raw.updated_at),
    archived_at: toDateOrNull(raw.archived_at),
    raw,
  };
}

function normalizeKnowledgeArticlePayload(
  payload: AdminKnowledgeArticlePayload,
): AdminKnowledgeArticlePayload {
  return {
    slug: payload.slug !== undefined ? toTextOrNull(payload.slug) ?? '' : undefined,
    title: toTextOrNull(payload.title) ?? '',
    summary: toTextOrNull(payload.summary),
    body: toTextOrNull(payload.body),
    status: toTextOrNull(payload.status) ?? 'draft',
    reviewed_at: payload.reviewed_at !== undefined ? toDateOrNull(payload.reviewed_at) : null,
    sources_json: payload.sources_json ?? null,
  };
}

function normalizeOpsDashboard(raw: unknown): AdminOpsDashboard {
  const root = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const payload = (root.dashboard && typeof root.dashboard === 'object'
    ? root.dashboard
    : root) as Record<string, unknown>;
  const researchStatus = parseCountMap(payload.research_status ?? payload.researchStatus);
  const dueReviews = (payload.due_reviews && typeof payload.due_reviews === 'object')
    ? payload.due_reviews as Record<string, unknown>
    : {};
  const warnings = (payload.warnings && typeof payload.warnings === 'object')
    ? payload.warnings as Record<string, unknown>
    : {};
  const knowledge = (payload.knowledge && typeof payload.knowledge === 'object')
    ? payload.knowledge as Record<string, unknown>
    : {};
  const productQa = (payload.product_qa && typeof payload.product_qa === 'object')
    ? payload.product_qa as Record<string, unknown>
    : {};
  const queues = (payload.queues && typeof payload.queues === 'object')
    ? payload.queues as Record<string, unknown>
    : {};

  return {
    research: {
      due_reviews: readCount(payload, [
        'research_review_due_count',
        'due_reviews',
        'research_due_reviews',
        'review_due_count',
      ]) ||
        readCount(dueReviews, ['count', 'total', 'ingredients']),
      unreviewed: researchStatus.unreviewed ?? readCount(payload, [
        'ingredient_research_unreviewed',
        'unreviewed',
        'research_unreviewed',
      ]),
      researching: researchStatus.researching ?? readCount(payload, [
        'ingredient_research_researching',
        'researching',
        'research_status_researching',
      ]),
      stale: researchStatus.stale ?? readCount(payload, [
        'ingredient_research_stale',
        'stale',
        'research_stale',
      ]),
    },
    knowledge: {
      drafts: readCount(payload, ['knowledge_draft_count', 'knowledge_drafts', 'draft_articles']) ||
        readCount(knowledge, ['drafts', 'draft']),
    },
    warnings: {
      without_article: readCount(payload, [
        'warnings_without_article_count',
        'warnings_without_article',
        'warnings_missing_article',
      ]) ||
        readCount(warnings, ['without_article', 'missing_article']),
    },
    product_qa: {
      issues: readCount(payload, ['product_qa_issue_count', 'product_qa_issues', 'products_with_issues']) ||
        readCount(productQa, ['issues', 'products']),
    },
    totals: parseTotals(payload),
    queues: {
      product_qa: parseQueueList(queues.product_qa, parseProductQAProduct),
      research_due: parseQueueList(queues.research_due, parseResearchQueueItem),
      research_later: parseQueueList(queues.research_later, parseResearchQueueItem),
      warnings_without_article: parseQueueList(queues.warnings_without_article, parseWarningQueueItem),
      knowledge_drafts: parseQueueList(queues.knowledge_drafts, parseKnowledgeDraftItem),
    },
    raw: payload,
  };
}

function parseProductQAProduct(raw: Record<string, unknown>): AdminProductQAProduct {
  const issues = Array.isArray(raw.issues)
    ? raw.issues.map((issue) => toTextOrNull(issue)).filter((issue): issue is string => Boolean(issue))
    : [];
  return {
    id: toIntOrNull(raw.id) ?? 0,
    name: toTextOrNull(raw.name) || `Produkt ${toIntOrNull(raw.id) ?? ''}`,
    brand: toTextOrNull(raw.brand),
    price: toNumberOrNull(raw.price),
    shop_link: toTextOrNull(raw.shop_link),
    image_url: toTextOrNull(raw.image_url),
    is_affiliate: toIntOrNull(raw.is_affiliate),
    serving_size: toNumberOrNull(raw.serving_size),
    serving_unit: toTextOrNull(raw.serving_unit),
    servings_per_container: toNumberOrNull(raw.servings_per_container),
    container_count: toNumberOrNull(raw.container_count),
    ingredient_count: toIntOrNull(raw.ingredient_count) ?? 0,
    main_ingredient_count: toIntOrNull(raw.main_ingredient_count) ?? 0,
    issues,
    raw,
  };
}

function parseResearchQueueItem(raw: Record<string, unknown>): AdminOpsResearchQueueItem {
  return {
    ingredient_id: toIntOrNull(raw.ingredient_id) ?? 0,
    ingredient_name: toTextOrNull(raw.ingredient_name) || `Wirkstoff ${toIntOrNull(raw.ingredient_id) ?? ''}`,
    research_status: toTextOrNull(raw.research_status) || 'unreviewed',
    review_due_at: toDateOrNull(raw.review_due_at),
    reviewed_at: toDateOrNull(raw.reviewed_at),
    calculation_status: toTextOrNull(raw.calculation_status),
    raw,
  };
}

function parseWarningQueueItem(raw: Record<string, unknown>): AdminOpsWarningQueueItem {
  return {
    id: toIntOrNull(raw.id) ?? 0,
    ingredient_id: toIntOrNull(raw.ingredient_id),
    ingredient_name: toTextOrNull(raw.ingredient_name),
    form_id: toIntOrNull(raw.form_id),
    form_name: toTextOrNull(raw.form_name),
    short_label: toTextOrNull(raw.short_label),
    article_slug: toTextOrNull(raw.article_slug),
    severity: toTextOrNull(raw.severity),
    raw,
  };
}

function parseKnowledgeDraftItem(raw: Record<string, unknown>): AdminOpsKnowledgeDraftItem {
  const slug = toTextOrNull(raw.slug) || '';
  return {
    slug,
    title: toTextOrNull(raw.title) || slug || 'Unbenannter Entwurf',
    status: toTextOrNull(raw.status) || 'draft',
    reviewed_at: toDateOrNull(raw.reviewed_at),
    updated_at: toDateOrNull(raw.updated_at),
    raw,
  };
}

function parseQueueList<T>(
  value: unknown,
  parser: (raw: Record<string, unknown>) => T,
): T[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((entry): entry is Record<string, unknown> => Boolean(entry) && typeof entry === 'object')
    .map((entry) => parser(entry));
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

export async function getOpsDashboard(): Promise<AdminOpsDashboard> {
  const res = await apiClient.get('/admin/ops-dashboard');
  return normalizeOpsDashboard(res.data);
}

export async function getKnowledgeArticles(params: {
  q?: string;
  status?: string;
} = {}): Promise<AdminKnowledgeArticlesResponse> {
  const query = toQueryParams({
    q: params.q,
    status: params.status,
  });
  const res = await apiClient.get<{
    articles?: unknown;
    total?: number | null;
    count?: number | null;
  }>('/admin/knowledge-articles', { params: query });
  const list = Array.isArray(res.data.articles) ? res.data.articles : [];
  return {
    articles: list.map((article) => parseKnowledgeArticle(article as Record<string, unknown>)),
    total: res.data.total ?? res.data.count ?? null,
  };
}

export async function getKnowledgeArticle(slug: string): Promise<AdminKnowledgeArticle> {
  const res = await apiClient.get<{ article?: unknown }>(
    `/admin/knowledge-articles/${encodeURIComponent(slug)}`,
  );
  const article = (res.data.article ?? res.data) as Record<string, unknown>;
  return parseKnowledgeArticle(article);
}

export async function createKnowledgeArticle(
  payload: AdminKnowledgeArticlePayload,
): Promise<AdminKnowledgeArticle> {
  const res = await apiClient.post<{ article?: unknown }>(
    '/admin/knowledge-articles',
    normalizeKnowledgeArticlePayload(payload),
  );
  const article = (res.data.article ?? res.data) as Record<string, unknown>;
  return parseKnowledgeArticle(article);
}

export async function updateKnowledgeArticle(
  slug: string,
  payload: AdminKnowledgeArticlePayload,
): Promise<AdminKnowledgeArticle> {
  const normalized = normalizeKnowledgeArticlePayload(payload);
  const res = await apiClient.put<{ article?: unknown }>(
    `/admin/knowledge-articles/${encodeURIComponent(slug)}`,
    normalized,
  );
  const article = (res.data.article ?? res.data) as Record<string, unknown>;
  return parseKnowledgeArticle(article);
}

export async function archiveKnowledgeArticle(slug: string): Promise<AdminKnowledgeArticle> {
  const res = await apiClient.delete<{ ok?: boolean; article?: unknown }>(
    `/admin/knowledge-articles/${encodeURIComponent(slug)}`,
  );
  const article = (res.data.article ?? {}) as Record<string, unknown>;
  return parseKnowledgeArticle(article);
}

export async function getProductQA(params: {
  q?: string;
  issue?: string;
  limit?: number;
} = {}): Promise<AdminProductQAResponse> {
  const query = toQueryParams({
    q: params.q,
    issue: params.issue,
    limit: params.limit ?? 100,
  });
  const res = await apiClient.get<{ products?: unknown }>('/admin/product-qa', { params: query });
  const products = Array.isArray(res.data.products) ? res.data.products : [];
  return {
    products: products.map((product) => parseProductQAProduct(product as Record<string, unknown>)),
  };
}

export async function updateProductQA(
  productId: number,
  payload: AdminProductQAPatch,
): Promise<AdminProductQAProduct> {
  const res = await apiClient.patch<{ product?: unknown }>(
    `/admin/product-qa/${productId}`,
    payload,
  );
  const product = (res.data.product ?? res.data) as Record<string, unknown>;
  return parseProductQAProduct(product);
}

export async function getIngredientResearchExport(): Promise<unknown> {
  const res = await apiClient.get('/admin/ingredient-research/export');
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
