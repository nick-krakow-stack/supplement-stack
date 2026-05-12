import { apiClient } from './client';
import type { AxiosError } from 'axios';
import type { AdminStats, Interaction } from '../types';

export type AdminMutationOptions = {
  version?: number | null;
};

export type AdminInteractionSeverity = 'info' | 'medium' | 'high' | 'danger';
export type AdminInteractionPartnerType = 'ingredient' | 'food' | 'medication' | 'condition';

export interface AdminInteraction {
  id: number;
  ingredient_id: number;
  partner_type: AdminInteractionPartnerType | string;
  partner_ingredient_id: number | null;
  partner_label: string | null;
  type: string;
  comment?: string | null;
  severity: AdminInteractionSeverity | string | null;
  mechanism: string | null;
  source_label: string | null;
  source_url: string | null;
  is_active: number | boolean | null;
  ingredient_a_id: number;
  ingredient_b_id: number | null;
  ingredient_a_name?: string;
  ingredient_b_name?: string | null;
  version: number | null;
}

export interface AdminInteractionPayload {
  id?: number | null;
  ingredient_id: number;
  partner_type: AdminInteractionPartnerType | string;
  partner_ingredient_id?: number | null;
  partner_label?: string | null;
  type: string;
  severity?: AdminInteractionSeverity | string | null;
  mechanism?: string | null;
  comment?: string | null;
  source_label?: string | null;
  source_url?: string | null;
  is_active?: number | boolean | null;
  version?: number | null;
}

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
  matched_form_id?: number | null;
  matched_form_name?: string | null;
}

export interface AdminIngredientListItem extends IngredientLookup {
  category: string | null;
  research_status: string | null;
  calculation_status: string | null;
  product_count: number;
  dose_recommendation_count: number;
  source_count: number;
  official_source_count: number;
  dge_source_count: number;
  study_source_count: number;
  no_recommendation_count: number;
  nrv_count: number;
  dose_source_link_count: number;
  sourced_dose_recommendation_count: number;
  display_profile_count: number;
  knowledge_article_count: number;
  warning_count: number;
  form_count: number;
  synonym_count: number;
  precursor_count: number;
  has_blog_url: boolean;
  task_statuses: AdminIngredientTaskStatusMap;
  product_recommendations: AdminIngredientProductRecommendationSlots;
  raw?: Record<string, unknown>;
}

export type AdminIngredientTaskKey = 'forms' | 'dge' | 'precursors' | 'synonyms';
export type AdminIngredientTaskStatusValue = 'open' | 'done' | 'none';

export interface AdminIngredientTaskStatus {
  ingredient_id: number;
  task_key: AdminIngredientTaskKey;
  status: AdminIngredientTaskStatusValue;
  note: string | null;
  updated_at: string | null;
  updated_by_user_id: number | null;
  raw?: Record<string, unknown>;
}

export type AdminIngredientTaskStatusMap = Partial<Record<AdminIngredientTaskKey, AdminIngredientTaskStatus>>;

export type AdminIngredientProductRecommendationSlot = 'primary' | 'alternative_1' | 'alternative_2';

export interface AdminIngredientProductRecommendation {
  id: number;
  ingredient_id: number;
  product_id: number;
  type: string;
  shop_link_id: number | null;
  recommendation_slot: AdminIngredientProductRecommendationSlot;
  sort_order: number;
  product_name: string;
  product_brand: string | null;
  product_shop_link: string | null;
  product_moderation_status: string | null;
  product_visibility: string | null;
  shop_link_url: string | null;
  shop_link_name: string | null;
  shop_link_host: string | null;
  raw?: Record<string, unknown>;
}

export type AdminIngredientProductRecommendationSlots = Record<
  AdminIngredientProductRecommendationSlot,
  AdminIngredientProductRecommendation | null
>;

export interface AdminIngredientProductRecommendationsResponse {
  recommendations: AdminIngredientProductRecommendation[];
  slots: AdminIngredientProductRecommendationSlots;
}

export interface AdminIngredientsResponse {
  ingredients: AdminIngredientListItem[];
  total: number;
  page: number;
  limit: number;
  total_pages: number;
  summary?: {
    total: number;
    groups?: AdminIngredientGroupOption[];
  };
}

export interface AdminIngredientGroupOption {
  value: string;
  label: string;
  count: number;
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
  version: number | null;
  sources?: AdminDoseRecommendationSource[];
  plausibility_warnings?: AdminDosePlausibilityWarning[];
}

export interface AdminDosePlausibilityWarning {
  code: string | null;
  severity: string | null;
  label: string | null;
  detail: string;
  raw?: Record<string, unknown>;
}

export interface AdminDoseRecommendationSource {
  id?: number | null;
  dose_recommendation_id?: number | null;
  research_source_id: number;
  relevance_weight: number;
  is_primary: number;
  note?: string | null;
  source_kind?: string | null;
  source_title?: string | null;
  source_url?: string | null;
  organization?: string | null;
  study_type?: string | null;
  evidence_quality?: string | null;
  outcome?: string | null;
  reviewed_at?: string | null;
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
  version?: number | null;
  sources?: AdminDoseRecommendationSourcePayload[];
}

export interface AdminDoseRecommendationSourcePayload {
  research_source_id: number;
  relevance_weight?: number | null;
  is_primary?: number | boolean | null;
  note?: string | null;
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

export interface AdminBulkApproveUserProductResult {
  id: number;
  ok: boolean;
  status: 'approved' | 'failed';
  previous_status?: string | null;
  approved_at?: string | null;
  error?: string | null;
}

export interface AdminBulkApproveUserProductsResponse {
  ok: boolean;
  requested: number;
  unique: number;
  approved: number;
  failed: number;
  results: AdminBulkApproveUserProductResult[];
}

export type AdminUserProductStatus = 'pending' | 'approved' | 'rejected' | 'blocked';

export interface AdminUserProductIngredient {
  ingredient_id: number;
  ingredient_name?: string | null;
  quantity?: number | null;
  unit?: string | null;
  basis_quantity?: number | null;
  basis_unit?: string | null;
  search_relevant?: number | boolean | null;
  parent_ingredient_id?: number | null;
}

export interface AdminUserProduct {
  id: number;
  user_id: number;
  user_email?: string | null;
  name: string;
  brand?: string | null;
  form?: string | null;
  price: number;
  shop_link?: string | null;
  serving_size?: number | null;
  serving_unit?: string | null;
  servings_per_container?: number | null;
  container_count?: number | null;
  is_affiliate?: number | null;
  notes?: string | null;
  status: AdminUserProductStatus;
  approved_at?: string | null;
  created_at: string;
  user_is_trusted_product_submitter?: number | null;
  published_product_id?: number | null;
  ingredients?: AdminUserProductIngredient[];
  raw?: Record<string, unknown>;
}

export interface AdminUserProductsResponse {
  products: AdminUserProduct[];
  total: number;
  page: number;
  limit: number;
  total_pages: number;
  summary?: {
    total: number;
    statuses: Record<AdminUserProductStatus, number>;
  };
  status_summary?: Record<AdminUserProductStatus, number>;
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
  version: number | null;
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
  is_retracted: boolean | null;
  retraction_checked_at: string | null;
  retraction_notice_url: string | null;
  evidence_grade: string | null;
  version: number | null;
  raw?: Record<string, unknown>;
}

export interface AdminEvidenceSummary {
  total_sources: number;
  official_sources: number;
  study_sources: number;
  other_sources: number;
  no_recommendation_count: number;
  retracted_count: number;
  grade_counts: Record<string, number>;
  suggested_grade: string | null;
  raw?: Record<string, unknown>;
}

export type AdminNutrientReferenceValueKind =
  | 'rda'
  | 'ai'
  | 'ear'
  | 'ul'
  | 'pri'
  | 'ar'
  | 'lti'
  | 'ri'
  | 'nrv';

export interface AdminNutrientReferenceValue {
  id: number;
  ingredient_id: number;
  population_id: number | null;
  organization: string;
  region: string | null;
  kind: AdminNutrientReferenceValueKind | string;
  value: number | null;
  unit: string;
  source_url: string | null;
  source_label: string | null;
  source_year: number | null;
  notes: string | null;
  created_at: string | null;
  updated_at: string | null;
  version: number | null;
  raw?: Record<string, unknown>;
}

export interface AdminNutrientReferenceValuePayload {
  population_id?: number | null;
  organization: string;
  region?: string | null;
  kind: AdminNutrientReferenceValueKind | string;
  value: number | null;
  unit: string;
  source_url?: string | null;
  source_label?: string | null;
  source_year?: number | null;
  notes?: string | null;
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
  version: number | null;
  raw?: Record<string, unknown>;
}

export interface AdminIngredientResearchForm {
  id: number;
  ingredient_id: number;
  name: string;
  timing: string | null;
  comment: string | null;
  raw?: Record<string, unknown>;
}

export interface AdminIngredientPrecursor {
  ingredient_id: number;
  precursor_ingredient_id: number;
  precursor_name: string;
  precursor_unit: string | null;
  sort_order: number;
  note: string | null;
  created_at: string | null;
  raw?: Record<string, unknown>;
}

export interface AdminIngredientDisplayProfile {
  id: number;
  ingredient_id: number;
  form_id: number | null;
  sub_ingredient_id: number | null;
  effect_summary: string | null;
  timing: string | null;
  timing_note: string | null;
  intake_hint: string | null;
  card_note: string | null;
  version: number | null;
  raw?: Record<string, unknown>;
}

export interface AdminIngredientResearchDetail {
  ingredient: AdminIngredientResearchIngredient;
  status: AdminIngredientResearchStatus;
  sources: AdminIngredientResearchSource[];
  warnings: AdminIngredientResearchWarning[];
  forms: AdminIngredientResearchForm[];
  precursors: AdminIngredientPrecursor[];
  display_profiles: AdminIngredientDisplayProfile[];
}

export interface AdminIngredientResearchStatusPayload {
  research_status?: string | null;
  calculation_status?: string | null;
  internal_notes?: string | null;
  blog_url?: string | null;
  reviewed_at?: string | number | null;
  review_due_at?: string | number | null;
  version?: number | null;
}

export interface AdminIngredientResearchSourcePayload {
  ingredient_id?: number | null;
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
  is_retracted?: boolean | number | null;
  retraction_checked_at?: string | number | null;
  retraction_notice_url?: string | null;
  evidence_grade?: string | null;
  version?: number | null;
}

export interface AdminPubMedLookup {
  pmid: string;
  doi: string | null;
  title: string;
  journal: string | null;
  source_url: string;
  source_date: string | null;
  authors: string[];
  source_kind: 'study';
  organization: 'PubMed';
  notes: string | null;
}

export interface AdminIngredientResearchWarningPayload {
  short_label?: string | null;
  popover_text?: string | null;
  severity?: string | null;
  article_slug?: string | null;
  min_amount?: number | null;
  unit?: string | null;
  active?: boolean | number | null;
  version?: number | null;
}

export interface AdminIngredientDisplayProfilePayload {
  form_id?: number | null;
  sub_ingredient_id?: number | null;
  effect_summary?: string | null;
  timing?: string | null;
  timing_note?: string | null;
  intake_hint?: string | null;
  card_note?: string | null;
  version?: number | null;
}

export interface AdminKnowledgeArticle {
  slug: string;
  title: string;
  summary: string | null;
  body: string | null;
  status: string;
  reviewed_at: string | null;
  sources_json: unknown;
  sources: AdminKnowledgeArticleSource[];
  ingredient_ids: number[];
  ingredients: AdminKnowledgeArticleIngredient[];
  conclusion: string | null;
  featured_image_r2_key: string | null;
  featured_image_url: string | null;
  dose_min: number | null;
  dose_max: number | null;
  dose_unit: string | null;
  product_note: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  archived_at?: string | null;
  version: number | null;
  raw?: Record<string, unknown>;
}

export interface AdminKnowledgeArticleSource {
  id?: number | null;
  name: string;
  link: string;
  label?: string;
  url?: string;
  sort_order?: number | null;
}

export interface AdminKnowledgeArticleIngredient {
  ingredient_id: number;
  name: string | null;
  sort_order?: number | null;
}

export interface AdminKnowledgeArticlePayload {
  slug?: string;
  title: string;
  summary?: string | null;
  body?: string | null;
  status?: string | null;
  reviewed_at?: string | null;
  sources_json?: unknown;
  sources?: AdminKnowledgeArticleSource[];
  ingredient_ids?: number[];
  conclusion?: string | null;
  featured_image_r2_key?: string | null;
  featured_image_url?: string | null;
  dose_min?: number | null;
  dose_max?: number | null;
  dose_unit?: string | null;
  product_note?: string | null;
  version?: number | null;
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
  link_reports: {
    open: number;
  };
  totals: Record<string, number>;
  queues: {
    product_qa: AdminProductQAProduct[];
    link_reports: AdminProductLinkReport[];
    research_due: AdminOpsResearchQueueItem[];
    research_later: AdminOpsResearchQueueItem[];
    warnings_without_article: AdminOpsWarningQueueItem[];
    knowledge_drafts: AdminOpsKnowledgeDraftItem[];
  };
  raw?: Record<string, unknown>;
}

export type AdminLaunchCheckStatus = 'ok' | 'warning' | 'danger' | 'info' | 'unknown';
export type AdminLaunchCheckSeverity = 'info' | 'warning' | 'critical';
export type AdminLaunchCheckSource = 'db' | 'env' | 'http' | 'dns' | 'manual';

export interface AdminLaunchCheck {
  id: string;
  title: string;
  status: AdminLaunchCheckStatus;
  severity: AdminLaunchCheckSeverity;
  source: AdminLaunchCheckSource;
  details: string;
  action?: string;
  observed_count?: number;
  configured?: boolean;
}

export interface AdminLaunchCheckSection {
  id: string;
  title: string;
  checks: AdminLaunchCheck[];
}

export interface AdminLaunchChecksResponse {
  generated_at: string;
  domain: string;
  source: 'live';
  admin_only: boolean;
  summary: {
    total: number;
    by_status: Record<AdminLaunchCheckStatus, number>;
    by_severity: Record<AdminLaunchCheckSeverity, number>;
    blocking: number;
    needs_attention: number;
  };
  sections: AdminLaunchCheckSection[];
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

export type AdminAffiliateLinkHealthStatus = 'unchecked' | 'ok' | 'failed' | 'timeout' | 'invalid';

export interface AdminAffiliateLinkHealth {
  url: string | null;
  status: AdminAffiliateLinkHealthStatus | null;
  http_status: number | null;
  failure_reason: string | null;
  last_checked_at: string | null;
  last_success_at: string | null;
  consecutive_failures: number | null;
  response_time_ms: number | null;
  final_url: string | null;
  redirected: number | null;
}

export type AdminProductShopLinkOwnerType = 'none' | 'nick' | 'user';

export interface AdminProductShopLink {
  id: number;
  product_id: number;
  shop_domain_id: number | null;
  shop_name: string | null;
  url: string;
  normalized_host: string | null;
  is_affiliate: number;
  affiliate_owner_type: AdminProductShopLinkOwnerType;
  affiliate_owner_user_id: number | null;
  source_type: string;
  submitted_by_user_id: number | null;
  is_primary: number;
  active: number;
  sort_order: number;
  version: number | null;
  created_at: string | null;
  updated_at: string | null;
  health: AdminAffiliateLinkHealth | null;
  raw?: Record<string, unknown>;
}

export interface AdminProductShopLinksResponse {
  links: AdminProductShopLink[];
  health_available: boolean;
}

export interface AdminProductShopLinkPayload {
  shop_domain_id?: number | null;
  shop_name?: string | null;
  url?: string;
  is_affiliate?: number | boolean;
  affiliate_owner_type?: AdminProductShopLinkOwnerType;
  affiliate_owner_user_id?: number | null;
  source_type?: string;
  is_primary?: number | boolean;
  active?: number | boolean;
  sort_order?: number;
  version?: number | null;
}

export interface AdminProductShopLinkCheckResult {
  status: Exclude<AdminAffiliateLinkHealthStatus, 'unchecked'> | string;
  url: string;
  host: string;
  http_status: number | null;
  failure_reason: string | null;
  check_method: 'HEAD' | 'GET' | string | null;
  final_url: string | null;
  redirected: number;
  response_time_ms: number | null;
}

export interface AdminProductQAProduct {
  id: number;
  name: string;
  brand: string | null;
  price: number | null;
  shop_link: string | null;
  image_url: string | null;
  is_affiliate: number | null;
  affiliate_owner_type: 'none' | 'nick' | 'user' | null;
  affiliate_owner_user_id: number | null;
  moderation_status: string | null;
  visibility: string | null;
  serving_size: number | null;
  serving_unit: string | null;
  servings_per_container: number | null;
  container_count: number | null;
  ingredient_count: number;
  main_ingredient_count: number;
  issues: string[];
  link_health: AdminAffiliateLinkHealth | null;
  version: number | null;
  raw?: Record<string, unknown>;
}

export interface AdminProductQAResponse {
  products: AdminProductQAProduct[];
  total: number;
  page: number;
  limit: number;
  summary: {
    total: number;
    issues: Record<string, number>;
  };
  available_issues?: string[];
}

export interface AdminProductQAPatch {
  name?: string;
  brand?: string | null;
  price?: number | null;
  shop_link?: string | null;
  image_url?: string | null;
  is_affiliate?: number | boolean | null;
  affiliate_owner_type?: 'none' | 'nick' | 'user' | null;
  affiliate_owner_user_id?: number | null;
  moderation_status?: 'pending' | 'approved' | 'rejected' | 'blocked';
  visibility?: 'hidden' | 'public';
  serving_size?: number | null;
  serving_unit?: string | null;
  servings_per_container?: number | null;
  container_count?: number | null;
}

export interface AdminProductImageUploadResponse {
  image_url: string;
  image_r2_key: string | null;
  product_version: number | null;
}

export interface AdminCatalogProduct {
  id: number;
  name: string;
  brand: string | null;
  form: string | null;
  price: number | null;
  shop_link: string | null;
  image_url: string | null;
  image_r2_key?: string | null;
  is_affiliate: number | null;
  affiliate_owner_type: 'none' | 'nick' | 'user' | null;
  affiliate_owner_user_id: number | null;
  moderation_status: string | null;
  visibility: string | null;
  created_at: string | null;
  serving_size?: number | null;
  serving_unit?: string | null;
  servings_per_container?: number | null;
  container_count?: number | null;
  dosage_text?: string | null;
  warning_title?: string | null;
  warning_message?: string | null;
  warning_type?: string | null;
  alternative_note?: string | null;
  link_health: AdminAffiliateLinkHealth | null;
  version: number | null;
  raw?: Record<string, unknown>;
}

export interface AdminCatalogProductsResponse {
  products: AdminCatalogProduct[];
  total: number;
  page: number;
  limit: number;
  total_pages: number;
}

export interface AdminProductIngredient {
  id: number;
  product_id: number;
  ingredient_id: number;
  ingredient_name: string;
  ingredient_unit: string | null;
  ingredient_description: string | null;
  form_id: number | null;
  form_name: string | null;
  parent_ingredient_id: number | null;
  parent_ingredient_name: string | null;
  is_main: number;
  search_relevant: number;
  quantity: number | null;
  unit: string | null;
  basis_quantity: number | null;
  basis_unit: string | null;
  effect_summary: string | null;
  timing: string | null;
  timing_note: string | null;
  intake_hint: string | null;
  card_note: string | null;
  raw?: Record<string, unknown>;
}

export interface AdminProductIngredientPayload {
  ingredient_id: number;
  is_main?: number | boolean;
  quantity?: number | null;
  unit?: string | null;
  form_id?: number | null;
  basis_quantity?: number | null;
  basis_unit?: string | null;
  search_relevant?: number | boolean;
  parent_ingredient_id?: number | null;
  version?: number | null;
}

export interface AdminProductSafetyWarning {
  id: number;
  ingredient_id: number;
  short_label: string;
  popover_text: string | null;
  severity: 'info' | 'caution' | 'danger';
  article_slug: string | null;
  article_title: string | null;
  article_url: string | null;
  raw?: Record<string, unknown>;
}

export type AdminProductWarningSeverity = 'info' | 'caution' | 'warning' | 'danger';

export interface AdminProductWarning {
  id: number;
  product_id: number;
  severity: AdminProductWarningSeverity;
  title: string;
  message: string;
  alternative_note: string | null;
  active: number;
  created_at: string | null;
  updated_at: string | null;
  version: number | null;
  raw?: Record<string, unknown>;
}

export interface AdminProductWarningPayload {
  severity: AdminProductWarningSeverity;
  title: string;
  message: string;
  alternative_note?: string | null;
  active?: number | boolean;
}

export interface AdminProductDetail extends AdminCatalogProduct {
  ingredients: AdminProductIngredient[];
  qa: AdminProductQAProduct | null;
  qa_counts: {
    ingredient_count: number;
    main_ingredient_count: number;
    issue_count: number;
    warning_count: number;
    product_warning_count: number;
    link_report_count: number;
    open_link_report_count: number;
    audit_count: number;
  };
  warnings: AdminProductSafetyWarning[];
  product_warnings: AdminProductWarning[];
  link_reports: AdminProductLinkReport[];
  audit_logs: AdminAuditLogEntry[];
}

export type AdminProductLinkReportStatus = 'open' | 'reviewed' | 'closed';

export interface AdminProductLinkReport {
  id: number;
  user_id: number;
  user_email: string | null;
  stack_id: number | null;
  stack_name: string | null;
  product_type: 'catalog' | 'user_product';
  product_id: number;
  product_name: string | null;
  shop_link_snapshot: string | null;
  current_shop_link: string | null;
  reason: string;
  status: AdminProductLinkReportStatus;
  created_at: string | null;
  raw?: Record<string, unknown>;
}

export interface AdminProductLinkReportsResponse {
  reports: AdminProductLinkReport[];
  total: number;
  page: number;
  limit: number;
  summary: {
    total: number;
    statuses: Record<AdminProductLinkReportStatus, number>;
  };
  available_statuses?: AdminProductLinkReportStatus[];
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

function withIfMatch(
  payload?: { version?: number | null },
  options: AdminMutationOptions = {},
): { headers: { 'If-Match': string } } | undefined {
  const version = options.version ?? payload?.version ?? null;
  return version === null || version === undefined
    ? undefined
    : { headers: { 'If-Match': String(version) } };
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
  const sourcesRaw = Array.isArray(raw.sources) ? raw.sources : [];
  const sources: AdminKnowledgeArticleSource[] = sourcesRaw
    .map((entry, index) => {
      const source = (entry && typeof entry === 'object' ? entry : {}) as Record<string, unknown>;
      const name = toTextOrNull(source.name) ?? toTextOrNull(source.label) ?? '';
      const link = toTextOrNull(source.link) ?? toTextOrNull(source.url) ?? '';
      if (!name && !link) return null;
      return {
        id: toIntOrNull(source.id),
        name,
        link,
        label: name,
        url: link,
        sort_order: toIntOrNull(source.sort_order) ?? index,
      };
    })
    .filter((source) => source !== null);
  const ingredientsRaw = Array.isArray(raw.ingredients) ? raw.ingredients : [];
  const ingredients: AdminKnowledgeArticleIngredient[] = ingredientsRaw
    .map((entry, index) => {
      const ingredient = (entry && typeof entry === 'object' ? entry : {}) as Record<string, unknown>;
      const ingredientId = toIntOrNull(ingredient.ingredient_id ?? ingredient.id);
      if (!ingredientId) return null;
      return {
        ingredient_id: ingredientId,
        name: toTextOrNull(ingredient.name),
        sort_order: toIntOrNull(ingredient.sort_order) ?? index,
      };
    })
    .filter((ingredient) => ingredient !== null);
  const ingredientIds = Array.isArray(raw.ingredient_ids)
    ? raw.ingredient_ids.map((value) => toIntOrNull(value)).filter((value): value is number => value !== null)
    : ingredients.map((ingredient) => ingredient.ingredient_id);
  return {
    slug,
    title: toTextOrNull(raw.title) || slug || 'Unbenannter Artikel',
    summary: toTextOrNull(raw.summary),
    body: toTextOrNull(raw.body),
    status: toTextOrNull(raw.status) || 'draft',
    reviewed_at: toDateOrNull(raw.reviewed_at),
    sources_json: raw.sources_json ?? raw.sources ?? null,
    sources,
    ingredient_ids: ingredientIds,
    ingredients,
    conclusion: toTextOrNull(raw.conclusion),
    featured_image_r2_key: toTextOrNull(raw.featured_image_r2_key),
    featured_image_url: toTextOrNull(raw.featured_image_url),
    dose_min: toNumberOrNull(raw.dose_min),
    dose_max: toNumberOrNull(raw.dose_max),
    dose_unit: toTextOrNull(raw.dose_unit),
    product_note: toTextOrNull(raw.product_note),
    created_at: toDateOrNull(raw.created_at),
    updated_at: toDateOrNull(raw.updated_at),
    archived_at: toDateOrNull(raw.archived_at),
    version: toIntOrNull(raw.version),
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
    sources_json: payload.sources_json ?? payload.sources?.map((source) => ({ label: source.name, url: source.link })) ?? null,
    sources: payload.sources?.map((source, index) => ({
      name: toTextOrNull(source.name) ?? '',
      link: toTextOrNull(source.link) ?? '',
      sort_order: source.sort_order ?? index,
    })),
    ingredient_ids: payload.ingredient_ids ?? [],
    conclusion: toTextOrNull(payload.conclusion),
    featured_image_r2_key: toTextOrNull(payload.featured_image_r2_key),
    featured_image_url: toTextOrNull(payload.featured_image_url),
    dose_min: toNumberOrNull(payload.dose_min),
    dose_max: toNumberOrNull(payload.dose_max),
    dose_unit: toTextOrNull(payload.dose_unit),
    product_note: toTextOrNull(payload.product_note),
    version: payload.version ?? null,
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
    link_reports: {
      open: readCount(payload, ['link_reports_open_count', 'open_link_reports', 'link_reports_open']),
    },
    totals: parseTotals(payload),
    queues: {
      product_qa: parseQueueList(queues.product_qa, parseProductQAProduct),
      link_reports: parseQueueList(queues.link_reports, parseProductLinkReport),
      research_due: parseQueueList(queues.research_due, parseResearchQueueItem),
      research_later: parseQueueList(queues.research_later, parseResearchQueueItem),
      warnings_without_article: parseQueueList(queues.warnings_without_article, parseWarningQueueItem),
      knowledge_drafts: parseQueueList(queues.knowledge_drafts, parseKnowledgeDraftItem),
    },
    raw: payload,
  };
}

function parseAffiliateLinkHealth(value: unknown): AdminAffiliateLinkHealth | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const raw = value as Record<string, unknown>;
  const status = toTextOrNull(raw.status);

  return {
    url: toTextOrNull(raw.url),
    status: status === 'unchecked' || status === 'ok' || status === 'failed' || status === 'timeout' || status === 'invalid'
      ? status
      : null,
    http_status: toIntOrNull(raw.http_status),
    failure_reason: toTextOrNull(raw.failure_reason),
    last_checked_at: toDateOrNull(raw.last_checked_at),
    last_success_at: toDateOrNull(raw.last_success_at),
    consecutive_failures: toIntOrNull(raw.consecutive_failures),
    response_time_ms: toIntOrNull(raw.response_time_ms),
    final_url: toTextOrNull(raw.final_url),
    redirected: toIntOrNull(raw.redirected),
  };
}

function parseProductShopLink(raw: Record<string, unknown>): AdminProductShopLink {
  const ownerType = toTextOrNull(raw.affiliate_owner_type);
  return {
    id: toIntOrNull(raw.id) ?? 0,
    product_id: toIntOrNull(raw.product_id) ?? 0,
    shop_domain_id: toIntOrNull(raw.shop_domain_id),
    shop_name: toTextOrNull(raw.shop_name),
    url: toTextOrNull(raw.url) ?? '',
    normalized_host: toTextOrNull(raw.normalized_host),
    is_affiliate: toIntOrNull(raw.is_affiliate) ?? (toBooleanOrNull(raw.is_affiliate) ? 1 : 0),
    affiliate_owner_type: ownerType === 'nick' || ownerType === 'user' || ownerType === 'none' ? ownerType : 'none',
    affiliate_owner_user_id: toIntOrNull(raw.affiliate_owner_user_id),
    source_type: toTextOrNull(raw.source_type) ?? 'admin',
    submitted_by_user_id: toIntOrNull(raw.submitted_by_user_id),
    is_primary: toIntOrNull(raw.is_primary) ?? (toBooleanOrNull(raw.is_primary) ? 1 : 0),
    active: toIntOrNull(raw.active) ?? (toBooleanOrNull(raw.active) === false ? 0 : 1),
    sort_order: toIntOrNull(raw.sort_order) ?? 0,
    version: toIntOrNull(raw.version),
    created_at: toDateOrNull(raw.created_at),
    updated_at: toDateOrNull(raw.updated_at),
    health: parseAffiliateLinkHealth(raw.health),
    raw,
  };
}

function normalizeProductShopLinkPayload(payload: AdminProductShopLinkPayload): AdminProductShopLinkPayload {
  const normalized: AdminProductShopLinkPayload = { ...payload };
  if (typeof normalized.is_affiliate === 'boolean') normalized.is_affiliate = normalized.is_affiliate ? 1 : 0;
  if (typeof normalized.is_primary === 'boolean') normalized.is_primary = normalized.is_primary ? 1 : 0;
  if (typeof normalized.active === 'boolean') normalized.active = normalized.active ? 1 : 0;
  return normalized;
}

function parseIngredientTaskStatus(raw: Record<string, unknown>): AdminIngredientTaskStatus | null {
  const taskKey = toTextOrNull(raw.task_key);
  const status = toTextOrNull(raw.status);
  if (taskKey !== 'forms' && taskKey !== 'dge' && taskKey !== 'precursors' && taskKey !== 'synonyms') return null;
  if (status !== 'open' && status !== 'done' && status !== 'none') return null;
  return {
    ingredient_id: toIntOrNull(raw.ingredient_id) ?? 0,
    task_key: taskKey,
    status,
    note: toTextOrNull(raw.note),
    updated_at: toDateOrNull(raw.updated_at),
    updated_by_user_id: toIntOrNull(raw.updated_by_user_id),
    raw,
  };
}

function emptyIngredientTaskStatusMap(): AdminIngredientTaskStatusMap {
  return {};
}

function parseIngredientTaskStatusMap(value: unknown): AdminIngredientTaskStatusMap {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return emptyIngredientTaskStatusMap();
  const result: AdminIngredientTaskStatusMap = {};
  for (const key of ['forms', 'dge', 'precursors', 'synonyms'] as const) {
    const rawEntry = (value as Record<string, unknown>)[key];
    if (!rawEntry || typeof rawEntry !== 'object' || Array.isArray(rawEntry)) continue;
    const parsed = parseIngredientTaskStatus(rawEntry as Record<string, unknown>);
    if (parsed) result[key] = parsed;
  }
  return result;
}

function parseIngredientRecommendationSlot(value: unknown): AdminIngredientProductRecommendationSlot | null {
  const text = toTextOrNull(value);
  return text === 'primary' || text === 'alternative_1' || text === 'alternative_2' ? text : null;
}

function parseIngredientProductRecommendation(raw: Record<string, unknown>): AdminIngredientProductRecommendation | null {
  const slot = parseIngredientRecommendationSlot(raw.recommendation_slot);
  if (!slot) return null;
  return {
    id: toIntOrNull(raw.id) ?? 0,
    ingredient_id: toIntOrNull(raw.ingredient_id) ?? 0,
    product_id: toIntOrNull(raw.product_id) ?? 0,
    type: toTextOrNull(raw.type) ?? (slot === 'primary' ? 'recommended' : 'alternative'),
    shop_link_id: toIntOrNull(raw.shop_link_id),
    recommendation_slot: slot,
    sort_order: toIntOrNull(raw.sort_order) ?? 0,
    product_name: toTextOrNull(raw.product_name) ?? `Produkt ${toIntOrNull(raw.product_id) ?? ''}`,
    product_brand: toTextOrNull(raw.product_brand),
    product_shop_link: toTextOrNull(raw.product_shop_link),
    product_moderation_status: toTextOrNull(raw.product_moderation_status),
    product_visibility: toTextOrNull(raw.product_visibility),
    shop_link_url: toTextOrNull(raw.shop_link_url),
    shop_link_name: toTextOrNull(raw.shop_link_name),
    shop_link_host: toTextOrNull(raw.shop_link_host),
    raw,
  };
}

function emptyIngredientProductRecommendationSlots(): AdminIngredientProductRecommendationSlots {
  return {
    primary: null,
    alternative_1: null,
    alternative_2: null,
  };
}

function parseIngredientProductRecommendationSlots(value: unknown): AdminIngredientProductRecommendationSlots {
  const slots = emptyIngredientProductRecommendationSlots();
  if (!value || typeof value !== 'object' || Array.isArray(value)) return slots;
  for (const key of ['primary', 'alternative_1', 'alternative_2'] as const) {
    const rawEntry = (value as Record<string, unknown>)[key];
    if (!rawEntry || typeof rawEntry !== 'object' || Array.isArray(rawEntry)) continue;
    slots[key] = parseIngredientProductRecommendation(rawEntry as Record<string, unknown>);
  }
  return slots;
}

function parseIngredientRecommendationSummary(
  raw: Record<string, unknown>,
  slot: AdminIngredientProductRecommendationSlot,
): AdminIngredientProductRecommendation | null {
  const id = toIntOrNull(raw[`${slot}_recommendation_id`]);
  const productId = toIntOrNull(raw[`${slot}_recommendation_product_id`]);
  if (!id || !productId) return null;
  return {
    id,
    ingredient_id: toIntOrNull(raw.id ?? raw.ingredient_id) ?? 0,
    product_id: productId,
    type: slot === 'primary' ? 'recommended' : 'alternative',
    shop_link_id: toIntOrNull(raw[`${slot}_recommendation_shop_link_id`]),
    recommendation_slot: slot,
    sort_order: slot === 'primary' ? 0 : slot === 'alternative_1' ? 10 : 20,
    product_name: toTextOrNull(raw[`${slot}_recommendation_product_name`]) ?? `Produkt ${productId}`,
    product_brand: null,
    product_shop_link: null,
    product_moderation_status: null,
    product_visibility: null,
    shop_link_url: null,
    shop_link_name: toTextOrNull(raw[`${slot}_recommendation_shop_name`]),
    shop_link_host: null,
    raw,
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
    affiliate_owner_type: (() => {
      const value = toTextOrNull(raw.affiliate_owner_type);
      return value === 'none' || value === 'nick' || value === 'user' ? value : null;
    })(),
    affiliate_owner_user_id: toIntOrNull(raw.affiliate_owner_user_id),
    moderation_status: toTextOrNull(raw.moderation_status),
    visibility: toTextOrNull(raw.visibility),
    serving_size: toNumberOrNull(raw.serving_size),
    serving_unit: toTextOrNull(raw.serving_unit),
    servings_per_container: toNumberOrNull(raw.servings_per_container),
    container_count: toNumberOrNull(raw.container_count),
    ingredient_count: toIntOrNull(raw.ingredient_count) ?? 0,
    main_ingredient_count: toIntOrNull(raw.main_ingredient_count) ?? 0,
    issues,
    link_health: parseAffiliateLinkHealth(raw.link_health),
    version: toIntOrNull(raw.version),
    raw,
  };
}

function parseCatalogProduct(raw: Record<string, unknown>): AdminCatalogProduct {
  return {
    id: toIntOrNull(raw.id) ?? 0,
    name: toTextOrNull(raw.name) || `Produkt ${toIntOrNull(raw.id) ?? ''}`,
    brand: toTextOrNull(raw.brand),
    form: toTextOrNull(raw.form),
    price: toNumberOrNull(raw.price),
    shop_link: toTextOrNull(raw.shop_link),
    image_url: toTextOrNull(raw.image_url),
    image_r2_key: toTextOrNull(raw.image_r2_key),
    is_affiliate: toIntOrNull(raw.is_affiliate),
    affiliate_owner_type: (() => {
      const value = toTextOrNull(raw.affiliate_owner_type);
      return value === 'none' || value === 'nick' || value === 'user' ? value : null;
    })(),
    affiliate_owner_user_id: toIntOrNull(raw.affiliate_owner_user_id),
    moderation_status: toTextOrNull(raw.moderation_status),
    visibility: toTextOrNull(raw.visibility),
    created_at: toDateOrNull(raw.created_at),
    serving_size: toNumberOrNull(raw.serving_size),
    serving_unit: toTextOrNull(raw.serving_unit),
    servings_per_container: toNumberOrNull(raw.servings_per_container),
    container_count: toNumberOrNull(raw.container_count),
    dosage_text: toTextOrNull(raw.dosage_text),
    warning_title: toTextOrNull(raw.warning_title),
    warning_message: toTextOrNull(raw.warning_message),
    warning_type: toTextOrNull(raw.warning_type),
    alternative_note: toTextOrNull(raw.alternative_note),
    link_health: parseAffiliateLinkHealth(raw.link_health),
    version: toIntOrNull(raw.version),
    raw,
  };
}

function parseAdminIngredientListItem(raw: Record<string, unknown>): AdminIngredientListItem {
  const ingredientId = toIntOrNull(raw.id ?? raw.ingredient_id) ?? 0;
  const task_statuses: AdminIngredientTaskStatusMap = {};
  for (const key of ['forms', 'dge', 'precursors', 'synonyms'] as const) {
    const status = toTextOrNull(raw[`${key}_task_status`]);
    if (status === 'open' || status === 'done' || status === 'none') {
      task_statuses[key] = {
        ingredient_id: ingredientId,
        task_key: key,
        status,
        note: null,
        updated_at: null,
        updated_by_user_id: null,
      };
    }
  }
  const product_recommendations = emptyIngredientProductRecommendationSlots();
  for (const slot of ['primary', 'alternative_1', 'alternative_2'] as const) {
    product_recommendations[slot] = parseIngredientRecommendationSummary(raw, slot);
  }
  return {
    id: ingredientId,
    name: toTextOrNull(raw.name ?? raw.ingredient_name) || `Wirkstoff ${toIntOrNull(raw.id ?? raw.ingredient_id) ?? ''}`,
    unit: toTextOrNull(raw.unit ?? raw.ingredient_unit),
    category: toTextOrNull(raw.category),
    research_status: toTextOrNull(raw.research_status),
    calculation_status: toTextOrNull(raw.calculation_status),
    product_count: toIntOrNull(raw.product_count) ?? 0,
    dose_recommendation_count: toIntOrNull(raw.dose_recommendation_count) ?? 0,
    source_count: toIntOrNull(raw.source_count) ?? 0,
    official_source_count: toIntOrNull(raw.official_source_count) ?? 0,
    dge_source_count: toIntOrNull(raw.dge_source_count) ?? 0,
    study_source_count: toIntOrNull(raw.study_source_count) ?? 0,
    no_recommendation_count: toIntOrNull(raw.no_recommendation_count) ?? 0,
    nrv_count: toIntOrNull(raw.nrv_count) ?? 0,
    dose_source_link_count: toIntOrNull(raw.dose_source_link_count) ?? 0,
    sourced_dose_recommendation_count: toIntOrNull(raw.sourced_dose_recommendation_count) ?? 0,
    display_profile_count: toIntOrNull(raw.display_profile_count) ?? 0,
    knowledge_article_count: toIntOrNull(raw.knowledge_article_count) ?? 0,
    warning_count: toIntOrNull(raw.warning_count) ?? 0,
    form_count: toIntOrNull(raw.form_count) ?? 0,
    synonym_count: toIntOrNull(raw.synonym_count) ?? 0,
    precursor_count: toIntOrNull(raw.precursor_count) ?? 0,
    has_blog_url: toBooleanOrNull(raw.has_blog_url) ?? (toIntOrNull(raw.has_blog_url) ?? 0) > 0,
    task_statuses,
    product_recommendations,
    raw,
  };
}

function parseProductIngredient(raw: Record<string, unknown>): AdminProductIngredient {
  return {
    id: toIntOrNull(raw.id) ?? 0,
    product_id: toIntOrNull(raw.product_id) ?? 0,
    ingredient_id: toIntOrNull(raw.ingredient_id) ?? 0,
    ingredient_name: toTextOrNull(raw.ingredient_name) || `Wirkstoff ${toIntOrNull(raw.ingredient_id) ?? ''}`,
    ingredient_unit: toTextOrNull(raw.ingredient_unit),
    ingredient_description: toTextOrNull(raw.ingredient_description),
    form_id: toIntOrNull(raw.form_id),
    form_name: toTextOrNull(raw.form_name),
    parent_ingredient_id: toIntOrNull(raw.parent_ingredient_id),
    parent_ingredient_name: toTextOrNull(raw.parent_ingredient_name),
    is_main: toBooleanOrNull(raw.is_main) ? 1 : 0,
    search_relevant: toBooleanOrNull(raw.search_relevant) === false ? 0 : 1,
    quantity: toNumberOrNull(raw.quantity),
    unit: toTextOrNull(raw.unit),
    basis_quantity: toNumberOrNull(raw.basis_quantity),
    basis_unit: toTextOrNull(raw.basis_unit),
    effect_summary: toTextOrNull(raw.effect_summary),
    timing: toTextOrNull(raw.timing),
    timing_note: toTextOrNull(raw.timing_note),
    intake_hint: toTextOrNull(raw.intake_hint),
    card_note: toTextOrNull(raw.card_note),
    raw,
  };
}

function parseProductSafetyWarning(raw: Record<string, unknown>): AdminProductSafetyWarning {
  const severity = toTextOrNull(raw.severity);
  return {
    id: toIntOrNull(raw.id) ?? 0,
    ingredient_id: toIntOrNull(raw.ingredient_id) ?? 0,
    short_label: toTextOrNull(raw.short_label) || 'Warnung',
    popover_text: toTextOrNull(raw.popover_text),
    severity: severity === 'info' || severity === 'danger' ? severity : 'caution',
    article_slug: toTextOrNull(raw.article_slug),
    article_title: toTextOrNull(raw.article_title),
    article_url: toTextOrNull(raw.article_url),
    raw,
  };
}

function parseProductWarning(raw: Record<string, unknown>): AdminProductWarning {
  const severity = toTextOrNull(raw.severity);
  return {
    id: toIntOrNull(raw.id) ?? 0,
    product_id: toIntOrNull(raw.product_id) ?? 0,
    severity:
      severity === 'info' || severity === 'danger' || severity === 'warning' || severity === 'caution'
        ? severity
        : 'caution',
    title: toTextOrNull(raw.title) || 'Produktwarnung',
    message: toTextOrNull(raw.message) || '',
    alternative_note: toTextOrNull(raw.alternative_note),
    active: toBooleanOrNull(raw.active) === false ? 0 : 1,
    created_at: toDateOrNull(raw.created_at),
    updated_at: toDateOrNull(raw.updated_at),
    version: toIntOrNull(raw.version),
    raw,
  };
}

function parseProductDetail(raw: Record<string, unknown>): AdminProductDetail {
  const productPayload = (raw.product && typeof raw.product === 'object' ? raw.product : raw) as Record<string, unknown>;
  const product = parseCatalogProduct(productPayload);
  const ingredients = Array.isArray(raw.ingredients) ? raw.ingredients : [];
  const warnings = Array.isArray(raw.warnings) ? raw.warnings : [];
  const productWarnings = Array.isArray(raw.product_warnings) ? raw.product_warnings : [];
  const linkReports = Array.isArray(raw.link_reports) ? raw.link_reports : [];
  const auditLogs = Array.isArray(raw.audit_logs) ? raw.audit_logs : [];
  const qaRaw = raw.qa && typeof raw.qa === 'object' ? raw.qa as Record<string, unknown> : null;
  const countsRaw = raw.qa_counts && typeof raw.qa_counts === 'object' ? raw.qa_counts as Record<string, unknown> : {};

  return {
    ...product,
    ingredients: ingredients.map((entry) => parseProductIngredient(entry as Record<string, unknown>)),
    qa: qaRaw ? parseProductQAProduct(qaRaw) : null,
    qa_counts: {
      ingredient_count: toIntOrNull(countsRaw.ingredient_count) ?? ingredients.length,
      main_ingredient_count: toIntOrNull(countsRaw.main_ingredient_count) ?? 0,
      issue_count: toIntOrNull(countsRaw.issue_count) ?? (qaRaw ? parseProductQAProduct(qaRaw).issues.length : 0),
      warning_count: toIntOrNull(countsRaw.warning_count) ?? warnings.length,
      product_warning_count: toIntOrNull(countsRaw.product_warning_count) ?? productWarnings.length,
      link_report_count: toIntOrNull(countsRaw.link_report_count) ?? linkReports.length,
      open_link_report_count: toIntOrNull(countsRaw.open_link_report_count) ?? 0,
      audit_count: toIntOrNull(countsRaw.audit_count) ?? auditLogs.length,
    },
    warnings: warnings.map((entry) => parseProductSafetyWarning(entry as Record<string, unknown>)),
    product_warnings: productWarnings.map((entry) => parseProductWarning(entry as Record<string, unknown>)),
    link_reports: linkReports.map((entry) => parseProductLinkReport(entry as Record<string, unknown>)),
    audit_logs: parseAuditEntries({ logs: auditLogs }),
    raw,
  };
}

function parseProductLinkReport(raw: Record<string, unknown>): AdminProductLinkReport {
  const status = toTextOrNull(raw.status) as AdminProductLinkReportStatus | null;
  const productType = toTextOrNull(raw.product_type);
  return {
    id: toIntOrNull(raw.id) ?? 0,
    user_id: toIntOrNull(raw.user_id) ?? 0,
    user_email: toTextOrNull(raw.user_email),
    stack_id: toIntOrNull(raw.stack_id),
    stack_name: toTextOrNull(raw.stack_name),
    product_type: productType === 'user_product' ? 'user_product' : 'catalog',
    product_id: toIntOrNull(raw.product_id) ?? 0,
    product_name: toTextOrNull(raw.product_name),
    shop_link_snapshot: toTextOrNull(raw.shop_link_snapshot),
    current_shop_link: toTextOrNull(raw.current_shop_link),
    reason: toTextOrNull(raw.reason) || 'missing_link',
    status: status === 'reviewed' || status === 'closed' ? status : 'open',
    created_at: toDateOrNull(raw.created_at),
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
    version: toIntOrNull(raw.version),
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
    is_retracted: toBooleanOrNull(raw.is_retracted),
    retraction_checked_at: toDateOrNull(raw.retraction_checked_at),
    retraction_notice_url: toTextOrNull(raw.retraction_notice_url),
    evidence_grade: toTextOrNull(raw.evidence_grade),
    version: toIntOrNull(raw.version),
    raw,
  };
}

function parseEvidenceSummary(raw: Record<string, unknown>): AdminEvidenceSummary {
  const countsRaw = (raw.counts && typeof raw.counts === 'object' ? raw.counts : raw) as Record<string, unknown>;
  const gradeCounts = parseCountMap(
    raw.grade_counts ??
      raw.evidence_grade_counts ??
      countsRaw.grade_counts ??
      countsRaw.evidence_grade_counts,
  );
  return {
    total_sources: readCount(countsRaw, ['total_sources', 'total', 'source_count']),
    official_sources: readCount(countsRaw, ['official_sources', 'official', 'official_source_count']),
    study_sources: readCount(countsRaw, ['study_sources', 'study', 'study_source_count']),
    other_sources: readCount(countsRaw, ['other_sources', 'other', 'other_source_count']),
    no_recommendation_count: readCount(countsRaw, ['no_recommendation_count', 'no_recommendation']),
    retracted_count: readCount(countsRaw, ['retracted_count', 'retracted', 'is_retracted']),
    grade_counts: gradeCounts,
    suggested_grade: toTextOrNull(raw.suggested_grade ?? countsRaw.suggested_grade),
    raw,
  };
}

function normalizeNutrientReferenceValueKind(value: unknown): AdminNutrientReferenceValueKind | string {
  const normalized = toTextOrNull(value)?.toLowerCase() ?? 'nrv';
  return normalized;
}

function parseNutrientReferenceValue(raw: Record<string, unknown>): AdminNutrientReferenceValue {
  return {
    id: toIntOrNull(raw.id) ?? 0,
    ingredient_id: toIntOrNull(raw.ingredient_id) ?? 0,
    population_id: toIntOrNull(raw.population_id),
    organization: toTextOrNull(raw.organization) ?? '',
    region: toTextOrNull(raw.region),
    kind: normalizeNutrientReferenceValueKind(raw.kind),
    value: toNumberOrNull(raw.value ?? raw.value_min ?? raw.value_max),
    unit: toTextOrNull(raw.unit) ?? '',
    source_url: toTextOrNull(raw.source_url),
    source_label: toTextOrNull(raw.source_label),
    source_year: toIntOrNull(raw.source_year),
    notes: toTextOrNull(raw.notes ?? raw.note),
    created_at: toDateOrNull(raw.created_at),
    updated_at: toDateOrNull(raw.updated_at),
    version: toIntOrNull(raw.version),
    raw,
  };
}

function parsePubMedLookup(raw: Record<string, unknown>): AdminPubMedLookup {
  const authors = Array.isArray(raw.authors)
    ? raw.authors.map((entry) => toTextOrNull(entry)).filter((entry): entry is string => Boolean(entry))
    : [];
  return {
    pmid: toTextOrNull(raw.pmid) ?? '',
    doi: toTextOrNull(raw.doi),
    title: toTextOrNull(raw.title) ?? '',
    journal: toTextOrNull(raw.journal),
    source_url: toTextOrNull(raw.source_url) ?? '',
    source_date: toTextOrNull(raw.source_date),
    authors,
    source_kind: 'study',
    organization: 'PubMed',
    notes: toTextOrNull(raw.notes),
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
    version: toIntOrNull(raw.version),
    raw,
  };
}

function parseIngredientResearchForm(raw: Record<string, unknown>): AdminIngredientResearchForm {
  return {
    id: toIntOrNull(raw.id) ?? 0,
    ingredient_id: toIntOrNull(raw.ingredient_id) ?? 0,
    name: toTextOrNull(raw.name) || `Form ${toIntOrNull(raw.id) ?? ''}`,
    timing: toTextOrNull(raw.timing),
    comment: toTextOrNull(raw.comment),
    raw,
  };
}

function parseIngredientPrecursor(raw: Record<string, unknown>): AdminIngredientPrecursor {
  const precursorId = toIntOrNull(raw.precursor_ingredient_id ?? raw.id) ?? 0;
  return {
    ingredient_id: toIntOrNull(raw.ingredient_id) ?? 0,
    precursor_ingredient_id: precursorId,
    precursor_name: toTextOrNull(raw.precursor_name ?? raw.name) || `Wirkstoff ${precursorId}`,
    precursor_unit: toTextOrNull(raw.precursor_unit ?? raw.unit),
    sort_order: toIntOrNull(raw.sort_order) ?? 0,
    note: toTextOrNull(raw.note),
    created_at: toDateOrNull(raw.created_at),
    raw,
  };
}

function parseIngredientDisplayProfile(raw: Record<string, unknown>): AdminIngredientDisplayProfile {
  return {
    id: toIntOrNull(raw.id) ?? 0,
    ingredient_id: toIntOrNull(raw.ingredient_id) ?? 0,
    form_id: toIntOrNull(raw.form_id),
    sub_ingredient_id: toIntOrNull(raw.sub_ingredient_id),
    effect_summary: toTextOrNull(raw.effect_summary),
    timing: toTextOrNull(raw.timing),
    timing_note: toTextOrNull(raw.timing_note),
    intake_hint: toTextOrNull(raw.intake_hint),
    card_note: toTextOrNull(raw.card_note),
    version: toIntOrNull(raw.version),
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
    forms?: unknown;
    precursors?: unknown;
    display_profiles?: unknown;
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
  const rawForms = (payload.forms ?? (payload.data as { forms?: unknown } | undefined)?.forms) as
    | unknown[]
    | undefined;
  const rawPrecursors = (payload.precursors ?? (payload.data as { precursors?: unknown } | undefined)?.precursors) as
    | unknown[]
    | undefined;
  const rawDisplayProfiles = (payload.display_profiles ?? (payload.data as { display_profiles?: unknown } | undefined)?.display_profiles) as
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
      version: null,
    },
    sources: Array.isArray(rawSources) ? rawSources.map((sourceEntry) => parseIngredientResearchSource(sourceEntry as Record<string, unknown>)) : [],
    warnings: Array.isArray(rawWarnings) ? rawWarnings.map((warningEntry) => parseIngredientResearchWarning(warningEntry as Record<string, unknown>)) : [],
    forms: Array.isArray(rawForms) ? rawForms.map((formEntry) => parseIngredientResearchForm(formEntry as Record<string, unknown>)) : [],
    precursors: Array.isArray(rawPrecursors) ? rawPrecursors.map((entry) => parseIngredientPrecursor(entry as Record<string, unknown>)) : [],
    display_profiles: Array.isArray(rawDisplayProfiles)
      ? rawDisplayProfiles.map((profileEntry) => parseIngredientDisplayProfile(profileEntry as Record<string, unknown>))
      : [],
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
    version: payload.version ?? null,
  };
}

function normalizeSourcePayload(payload: AdminIngredientResearchSourcePayload): AdminIngredientResearchSourcePayload {
  return {
    ingredient_id: toIntOrNull(payload.ingredient_id),
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
    is_retracted:
      typeof payload.is_retracted === 'number'
        ? payload.is_retracted !== 0
        : payload.is_retracted ?? null,
    retraction_checked_at:
      payload.retraction_checked_at !== undefined ? toDateOrNull(payload.retraction_checked_at) : null,
    retraction_notice_url: toTextOrNull(payload.retraction_notice_url),
    evidence_grade: toTextOrNull(payload.evidence_grade)?.toUpperCase() ?? null,
    version: payload.version ?? null,
  };
}

function normalizeNutrientReferenceValuePayload(
  payload: AdminNutrientReferenceValuePayload,
): AdminNutrientReferenceValuePayload {
  return {
    population_id: payload.population_id ?? null,
    organization: toTrimmedOrNull(payload.organization) ?? '',
    region: toTrimmedOrNull(payload.region),
    kind: normalizeNutrientReferenceValueKind(payload.kind),
    value: toNumberOrNull(payload.value),
    unit: toTrimmedOrNull(payload.unit) ?? '',
    source_url: toTrimmedOrNull(payload.source_url),
    source_label: toTrimmedOrNull(payload.source_label),
    source_year: toIntOrNull(payload.source_year),
    notes: toTrimmedOrNull(payload.notes),
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
    version: payload.version ?? null,
  };
}

function normalizeDisplayProfilePayload(
  payload: AdminIngredientDisplayProfilePayload,
): AdminIngredientDisplayProfilePayload {
  return {
    form_id: payload.form_id ?? null,
    sub_ingredient_id: payload.sub_ingredient_id ?? null,
    effect_summary: toTextOrNull(payload.effect_summary),
    timing: toTextOrNull(payload.timing),
    timing_note: toTextOrNull(payload.timing_note),
    intake_hint: toTextOrNull(payload.intake_hint),
    card_note: toTextOrNull(payload.card_note),
    version: payload.version ?? null,
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

function parseBulkApproveUserProductsResponse(raw: unknown): AdminBulkApproveUserProductsResponse {
  const payload = raw && typeof raw === 'object' ? raw as Record<string, unknown> : {};
  const rawResults = Array.isArray(payload.results) ? payload.results : [];
  const results: AdminBulkApproveUserProductResult[] = rawResults.map((entry) => {
    const row = entry as Record<string, unknown>;
    const status = toTextOrNull(row.status);
    return {
      id: toIntOrNull(row.id) ?? 0,
      ok: toBooleanOrNull(row.ok) === true,
      status: status === 'approved' ? 'approved' : 'failed',
      previous_status: toTextOrNull(row.previous_status),
      approved_at: toDateOrNull(row.approved_at),
      error: toTextOrNull(row.error),
    };
  });
  return {
    ok: toBooleanOrNull(payload.ok) === true,
    requested: toIntOrNull(payload.requested) ?? results.length,
    unique: toIntOrNull(payload.unique) ?? results.length,
    approved: toIntOrNull(payload.approved) ?? results.filter((result) => result.ok).length,
    failed: toIntOrNull(payload.failed) ?? results.filter((result) => !result.ok).length,
    results,
  };
}

function parseAdminUserProductIngredient(raw: Record<string, unknown>): AdminUserProductIngredient {
  return {
    ingredient_id: toIntOrNull(raw.ingredient_id) ?? 0,
    ingredient_name: toTextOrNull(raw.ingredient_name),
    quantity: toNumberOrNull(raw.quantity),
    unit: toTextOrNull(raw.unit),
    basis_quantity: toNumberOrNull(raw.basis_quantity),
    basis_unit: toTextOrNull(raw.basis_unit),
    search_relevant: toBooleanOrNull(raw.search_relevant) ?? toIntOrNull(raw.search_relevant),
    parent_ingredient_id: toIntOrNull(raw.parent_ingredient_id),
  };
}

function parseAdminUserProduct(raw: Record<string, unknown>): AdminUserProduct {
  const status = toTextOrNull(raw.status);
  const ingredients = Array.isArray(raw.ingredients)
    ? raw.ingredients.map((entry) => parseAdminUserProductIngredient(entry as Record<string, unknown>))
    : [];
  return {
    id: toIntOrNull(raw.id) ?? 0,
    user_id: toIntOrNull(raw.user_id) ?? 0,
    user_email: toTextOrNull(raw.user_email),
    name: toTextOrNull(raw.name) ?? 'Unbenanntes Produkt',
    brand: toTextOrNull(raw.brand),
    form: toTextOrNull(raw.form),
    price: toNumberOrNull(raw.price) ?? 0,
    shop_link: toTextOrNull(raw.shop_link),
    serving_size: toNumberOrNull(raw.serving_size),
    serving_unit: toTextOrNull(raw.serving_unit),
    servings_per_container: toNumberOrNull(raw.servings_per_container),
    container_count: toNumberOrNull(raw.container_count),
    is_affiliate: toIntOrNull(raw.is_affiliate),
    notes: toTextOrNull(raw.notes),
    status: status === 'approved' || status === 'rejected' || status === 'blocked' ? status : 'pending',
    approved_at: toDateOrNull(raw.approved_at),
    created_at: toDateOrNull(raw.created_at) ?? '',
    user_is_trusted_product_submitter: toIntOrNull(raw.user_is_trusted_product_submitter),
    published_product_id: toIntOrNull(raw.published_product_id),
    ingredients,
    raw,
  };
}

function normalizeDoseListResponse(raw: unknown): AdminDoseRecommendation[] {
  const payload = raw as AdminListResponse;
  const candidates = payload.recommendations ?? payload.dose_recommendments ?? payload.dose_recommendment ?? [];
  if (!Array.isArray(candidates)) return [];
  return candidates.map((entry) => parseDoseRecommendation(entry as unknown as Record<string, unknown>));
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
    version: null,
  };
}

function parseDoseRecommendationSource(raw: Record<string, unknown>): AdminDoseRecommendationSource | null {
  const researchSourceId = toIntOrNull(raw.research_source_id ?? raw.source_id ?? raw.id);
  if (researchSourceId === null || researchSourceId <= 0) return null;
  return {
    id: toIntOrNull(raw.id),
    dose_recommendation_id: toIntOrNull(raw.dose_recommendation_id),
    research_source_id: researchSourceId,
    relevance_weight: toIntOrNull(raw.relevance_weight ?? raw.weight) ?? 50,
    is_primary: toBooleanOrNull(raw.is_primary ?? raw.primary) ? 1 : 0,
    note: toTextOrNull(raw.note ?? raw.notes),
    source_kind: toTextOrNull(raw.source_kind ?? raw.source_type),
    source_title: toTextOrNull(raw.source_title ?? raw.title ?? raw.label),
    source_url: toTextOrNull(raw.source_url ?? raw.url),
    organization: toTextOrNull(raw.organization),
    study_type: toTextOrNull(raw.study_type),
    evidence_quality: toTextOrNull(raw.evidence_quality),
    outcome: toTextOrNull(raw.outcome),
    reviewed_at: toDateOrNull(raw.reviewed_at),
  };
}

function parseDosePlausibilityWarnings(value: unknown): AdminDosePlausibilityWarning[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry): AdminDosePlausibilityWarning | null => {
      if (typeof entry === 'string') {
        const detail = entry.trim();
        return detail ? { code: null, severity: null, label: null, detail } : null;
      }
      if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return null;
      const raw = entry as Record<string, unknown>;
      const detail =
        toTextOrNull(raw.detail ?? raw.message ?? raw.warning ?? raw.text) ??
        toTextOrNull(raw.label) ??
        '';
      if (!detail) return null;
      return {
        code: toTextOrNull(raw.code),
        severity: toTextOrNull(raw.severity),
        label: toTextOrNull(raw.label ?? raw.title),
        detail,
        raw,
      };
    })
    .filter((entry): entry is AdminDosePlausibilityWarning => entry !== null);
}

function parseDoseRecommendation(raw: Record<string, unknown>): AdminDoseRecommendation {
  const rawSources = Array.isArray(raw.sources) ? raw.sources : [];
  const sources = rawSources
    .map((entry) => parseDoseRecommendationSource(entry as Record<string, unknown>))
    .filter((entry): entry is AdminDoseRecommendationSource => entry !== null);
  const plausibilityWarnings = parseDosePlausibilityWarnings(raw.plausibility_warnings);

  return {
    id: toIntOrNull(raw.id ?? raw.dose_recommendation_id) ?? 0,
    ingredient_id: toIntOrNull(raw.ingredient_id),
    ingredient_name: toTextOrNull(raw.ingredient_name),
    population_id: toIntOrNull(raw.population_id),
    population_slug: toTextOrNull(raw.population_slug),
    source_type: toTextOrNull(raw.source_type),
    source_label: toTextOrNull(raw.source_label),
    source_url: toTextOrNull(raw.source_url),
    dose_min: toNumberOrNull(raw.dose_min),
    dose_max: toNumberOrNull(raw.dose_max),
    unit: toTextOrNull(raw.unit),
    per_kg_body_weight: toNumberOrNull(raw.per_kg_body_weight),
    per_kg_cap: toNumberOrNull(raw.per_kg_cap),
    timing: toTextOrNull(raw.timing),
    context_note: toTextOrNull(raw.context_note),
    sex_filter: toTextOrNull(raw.sex_filter),
    is_athlete: toIntOrNull(raw.is_athlete),
    purpose: toTextOrNull(raw.purpose),
    is_default: toIntOrNull(raw.is_default),
    is_active: toIntOrNull(raw.is_active),
    relevance_score: toIntOrNull(raw.relevance_score),
    verified_profile_id: toIntOrNull(raw.verified_profile_id),
    verified_profile_name: toTextOrNull(raw.verified_profile_name),
    category_name: toTextOrNull(raw.category_name),
    created_by_user_id: toIntOrNull(raw.created_by_user_id),
    is_public: toIntOrNull(raw.is_public),
    version: toIntOrNull(raw.version),
    sources,
    plausibility_warnings: plausibilityWarnings,
  };
}

function normalizeDoseSources(
  sources?: AdminDoseRecommendationSourcePayload[],
): AdminDoseRecommendationSourcePayload[] | undefined {
  if (!Array.isArray(sources)) return undefined;
  return sources
    .map((source) => ({
      research_source_id: toIntOrNull(source.research_source_id) ?? 0,
      relevance_weight: Math.min(100, Math.max(0, toIntOrNull(source.relevance_weight) ?? 50)),
      is_primary: typeof source.is_primary === 'boolean'
        ? source.is_primary
        : toBooleanOrNull(source.is_primary) ?? false,
      note: toTextOrNull(source.note),
    }))
    .filter((source) => source.research_source_id > 0);
}

function normalizeDosePayload(payload: AdminDoseRecommendationPayload): AdminDoseRecommendationPayload {
  const normalized: AdminDoseRecommendationPayload = {
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
    is_public: payload.is_public,
    relevance_score: payload.relevance_score ?? null,
    verified_profile_id: payload.verified_profile_id ?? null,
    category_name: toTrimmedOrNull(payload.category_name),
    version: payload.version ?? null,
  };
  const sources = normalizeDoseSources(payload.sources);
  if (sources !== undefined) normalized.sources = sources;
  return normalized;
}

function parseDoseMutationResponse(data: unknown): AdminDoseRecommendation {
  const payload = data && typeof data === 'object' ? (data as Record<string, unknown>) : {};
  const recommendationRaw =
    payload.recommendation ??
    payload.dose_recommendment ??
    payload.dose_recommendments ??
    payload;
  const recommendation = parseDoseRecommendation(recommendationRaw as Record<string, unknown>);
  const responseWarnings = parseDosePlausibilityWarnings(payload.plausibility_warnings);
  if (responseWarnings.length > 0) {
    return {
      ...recommendation,
      plausibility_warnings: responseWarnings,
    };
  }
  return recommendation;
}

export async function getAdminStats(range?: string): Promise<AdminStats> {
  const res = await apiClient.get('/admin/stats', {
    params: range ? { range } : undefined,
  });
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
  options: AdminMutationOptions = {},
): Promise<AdminKnowledgeArticle> {
  const normalized = normalizeKnowledgeArticlePayload(payload);
  const res = await apiClient.put<{ article?: unknown }>(
    `/admin/knowledge-articles/${encodeURIComponent(slug)}`,
    normalized,
    withIfMatch(normalized, options),
  );
  const article = (res.data.article ?? res.data) as Record<string, unknown>;
  return parseKnowledgeArticle(article);
}

export async function archiveKnowledgeArticle(
  slug: string,
  options: AdminMutationOptions = {},
): Promise<AdminKnowledgeArticle> {
  const res = await apiClient.delete<{ ok?: boolean; article?: unknown }>(
    `/admin/knowledge-articles/${encodeURIComponent(slug)}`,
    withIfMatch(undefined, options),
  );
  const article = (res.data.article ?? {}) as Record<string, unknown>;
  return parseKnowledgeArticle(article);
}

export async function getAdminUserProducts(params: {
  status?: AdminUserProductStatus;
  page?: number;
  limit?: number;
} = {}): Promise<AdminUserProductsResponse> {
  const query = toQueryParams({
    status: params.status ?? 'pending',
    page: params.page,
    limit: params.limit ?? 50,
  });
  const res = await apiClient.get<Record<string, unknown>>('/admin/user-products', { params: query });
  const products = Array.isArray(res.data.products) ? res.data.products : [];
  const total = toIntOrNull(res.data.total) ?? products.length;
  const page = toIntOrNull(res.data.page) ?? params.page ?? 1;
  const limit = toIntOrNull(res.data.limit) ?? params.limit ?? Math.max(1, products.length);
  const summaryRaw = res.data.summary && typeof res.data.summary === 'object'
    ? res.data.summary as Record<string, unknown>
    : {};
  const statusSummaryRaw = summaryRaw.statuses && typeof summaryRaw.statuses === 'object'
    ? summaryRaw.statuses as Record<string, unknown>
    : res.data.status_summary && typeof res.data.status_summary === 'object'
      ? res.data.status_summary as Record<string, unknown>
      : {};
  const statuses: Record<AdminUserProductStatus, number> = {
    pending: toIntOrNull(statusSummaryRaw.pending) ?? 0,
    approved: toIntOrNull(statusSummaryRaw.approved) ?? 0,
    rejected: toIntOrNull(statusSummaryRaw.rejected) ?? 0,
    blocked: toIntOrNull(statusSummaryRaw.blocked) ?? 0,
  };
  return {
    products: products.map((product) => parseAdminUserProduct(product as Record<string, unknown>)),
    total,
    page,
    limit,
    total_pages: toIntOrNull(res.data.total_pages) ?? Math.max(1, Math.ceil(total / limit)),
    summary: {
      total: toIntOrNull(summaryRaw.total) ?? statuses.pending + statuses.approved + statuses.rejected + statuses.blocked,
      statuses,
    },
    status_summary: statuses,
  };
}

export async function bulkApproveUserProducts(ids: number[]): Promise<AdminBulkApproveUserProductsResponse> {
  const res = await apiClient.put<Record<string, unknown>>('/admin/user-products/bulk-approve', { ids });
  return parseBulkApproveUserProductsResponse(res.data);
}

export async function getProductQA(params: {
  q?: string;
  issue?: string;
  page?: number;
  limit?: number;
} = {}): Promise<AdminProductQAResponse> {
  const query = toQueryParams({
    q: params.q,
    issue: params.issue,
    page: params.page,
    limit: params.limit ?? 50,
  });
  const res = await apiClient.get<Record<string, unknown>>('/admin/product-qa', { params: query });
  const products = Array.isArray(res.data.products) ? res.data.products : [];
  const summaryRaw = res.data.summary && typeof res.data.summary === 'object'
    ? res.data.summary as Record<string, unknown>
    : {};
  const issueSummaryRaw = summaryRaw.issues ?? res.data.issue_summary;
  const availableIssues = Array.isArray(res.data.available_issues)
    ? res.data.available_issues.map((entry) => toTextOrNull(entry)).filter((entry): entry is string => Boolean(entry))
    : undefined;
  return {
    products: products.map((product) => parseProductQAProduct(product as Record<string, unknown>)),
    total: toIntOrNull(res.data.total) ?? products.length,
    page: toIntOrNull(res.data.page) ?? params.page ?? 1,
    limit: toIntOrNull(res.data.limit) ?? params.limit ?? 50,
    summary: {
      total: toIntOrNull(summaryRaw.total) ?? 0,
      issues: parseCountMap(issueSummaryRaw),
    },
    available_issues: availableIssues,
  };
}

export async function updateProductQA(
  productId: number,
  payload: AdminProductQAPatch,
  options: AdminMutationOptions = {},
): Promise<AdminProductQAProduct> {
  const res = await apiClient.patch<{ product?: unknown }>(
    `/admin/product-qa/${productId}`,
    payload,
    withIfMatch(undefined, options),
  );
  const product = (res.data.product ?? res.data) as Record<string, unknown>;
  return parseProductQAProduct(product);
}

export async function getAdminProducts(params: {
  q?: string;
  page?: number;
  limit?: number;
  ingredient_id?: number;
  moderation?: string;
  affiliate?: string;
  image?: string;
  link_status?: string;
  deadlinks?: boolean;
} = {}): Promise<AdminCatalogProductsResponse> {
  const query = toQueryParams({
    q: params.q,
    page: params.page,
    limit: params.limit,
    ingredient_id: params.ingredient_id,
    moderation: params.moderation,
    affiliate: params.affiliate,
    image: params.image,
    link_status: params.link_status,
    deadlinks: params.deadlinks ? '1' : undefined,
  });
  const res = await apiClient.get<Record<string, unknown>>('/admin/products', { params: query });
  const products = Array.isArray(res.data.products) ? res.data.products : [];
  const total = toIntOrNull(res.data.total) ?? products.length;
  const page = toIntOrNull(res.data.page) ?? params.page ?? 1;
  const limit = toIntOrNull(res.data.limit) ?? params.limit ?? Math.max(1, products.length);
  return {
    products: products.map((product) => parseCatalogProduct(product as Record<string, unknown>)),
    total,
    page,
    limit,
    total_pages: toIntOrNull(res.data.total_pages) ?? Math.max(1, Math.ceil(total / limit)),
  };
}

export async function getAdminProduct(productId: number): Promise<AdminProductDetail> {
  const res = await apiClient.get<{ product?: unknown }>(`/admin/products/${productId}`);
  return parseProductDetail(res.data as Record<string, unknown>);
}

export async function getAdminProductShopLinks(productId: number): Promise<AdminProductShopLinksResponse> {
  const res = await apiClient.get<Record<string, unknown>>(`/admin/products/${productId}/shop-links`);
  const links = Array.isArray(res.data.links) ? res.data.links : [];
  return {
    links: links.map((entry) => parseProductShopLink(entry as Record<string, unknown>)),
    health_available: toBooleanOrNull(res.data.health_available) ?? false,
  };
}

export async function createAdminProductShopLink(
  productId: number,
  payload: AdminProductShopLinkPayload,
): Promise<AdminProductShopLink> {
  const normalized = normalizeProductShopLinkPayload(payload);
  const res = await apiClient.post<Record<string, unknown>>(`/admin/products/${productId}/shop-links`, normalized);
  const link = (res.data.link ?? res.data) as Record<string, unknown>;
  return parseProductShopLink(link);
}

export async function updateAdminProductShopLink(
  productId: number,
  shopLinkId: number,
  payload: AdminProductShopLinkPayload,
  options: AdminMutationOptions = {},
): Promise<AdminProductShopLink> {
  const normalized = normalizeProductShopLinkPayload(payload);
  const res = await apiClient.patch<Record<string, unknown>>(
    `/admin/products/${productId}/shop-links/${shopLinkId}`,
    normalized,
    withIfMatch(normalized, options),
  );
  const link = (res.data.link ?? res.data) as Record<string, unknown>;
  return parseProductShopLink(link);
}

export async function deleteAdminProductShopLink(
  productId: number,
  shopLinkId: number,
  options: AdminMutationOptions = {},
): Promise<void> {
  await apiClient.delete(`/admin/products/${productId}/shop-links/${shopLinkId}`, withIfMatch(undefined, options));
}

export async function recheckAdminProductShopLink(
  productId: number,
  shopLinkId: number,
): Promise<{ link: AdminProductShopLink | null; result: AdminProductShopLinkCheckResult | null }> {
  const res = await apiClient.post<Record<string, unknown>>(`/admin/products/${productId}/shop-links/${shopLinkId}/recheck`);
  const link = res.data.link && typeof res.data.link === 'object'
    ? parseProductShopLink(res.data.link as Record<string, unknown>)
    : null;
  const result = res.data.result && typeof res.data.result === 'object'
    ? res.data.result as AdminProductShopLinkCheckResult
    : null;
  return { link, result };
}

export async function uploadAdminProductImage(
  productId: number,
  file: Blob,
  options: AdminMutationOptions = {},
): Promise<AdminProductImageUploadResponse> {
  const formData = new FormData();
  const filename = file.type === 'image/webp'
    ? 'product.webp'
    : file.type === 'image/png'
      ? 'product.png'
      : 'product.jpg';
  formData.append('image', file, filename);
  if (options.version !== null && options.version !== undefined) {
    formData.append('version', String(options.version));
  }
  const res = await apiClient.post<Record<string, unknown>>(
    `/admin/products/${productId}/image`,
    formData,
    withIfMatch(undefined, options),
  );
  return {
    image_url: toTextOrNull(res.data.image_url) ?? '',
    image_r2_key: toTextOrNull(res.data.image_r2_key),
    product_version: toIntOrNull(res.data.product_version),
  };
}

export async function deleteAdminProductImage(
  productId: number,
  options: AdminMutationOptions = {},
): Promise<AdminProductImageUploadResponse> {
  const res = await apiClient.delete<Record<string, unknown>>(
    `/admin/products/${productId}/image`,
    withIfMatch(undefined, options),
  );
  return {
    image_url: toTextOrNull(res.data.image_url) ?? '',
    image_r2_key: toTextOrNull(res.data.image_r2_key),
    product_version: toIntOrNull(res.data.product_version),
  };
}

export async function uploadKnowledgeArticleImage(
  slug: string,
  file: Blob,
): Promise<{ image_url: string; image_r2_key: string | null; version: number | null }> {
  const formData = new FormData();
  const filename = file.type === 'image/webp'
    ? 'article.webp'
    : file.type === 'image/png'
      ? 'article.png'
      : 'article.jpg';
  formData.append('image', file, filename);
  const res = await apiClient.post<Record<string, unknown>>(
    `/admin/knowledge-articles/${encodeURIComponent(slug)}/image`,
    formData,
  );
  return {
    image_url: toTextOrNull(res.data.image_url) ?? '',
    image_r2_key: toTextOrNull(res.data.image_r2_key),
    version: toIntOrNull(res.data.version),
  };
}

export async function createAdminProductIngredient(
  productId: number,
  payload: AdminProductIngredientPayload,
  options: AdminMutationOptions = {},
): Promise<AdminProductIngredient> {
  const res = await apiClient.post<{ ingredient?: unknown; row?: unknown }>(
    `/admin/products/${productId}/ingredients`,
    payload,
    withIfMatch(payload, options),
  );
  const row = (res.data.ingredient ?? res.data.row ?? res.data) as Record<string, unknown>;
  return parseProductIngredient(row);
}

export async function updateAdminProductIngredient(
  productId: number,
  rowId: number,
  payload: AdminProductIngredientPayload,
  options: AdminMutationOptions = {},
): Promise<AdminProductIngredient> {
  const res = await apiClient.put<{ ingredient?: unknown; row?: unknown }>(
    `/admin/products/${productId}/ingredients/${rowId}`,
    payload,
    withIfMatch(payload, options),
  );
  const row = (res.data.ingredient ?? res.data.row ?? res.data) as Record<string, unknown>;
  return parseProductIngredient(row);
}

export async function deleteAdminProductIngredient(
  productId: number,
  rowId: number,
  options: AdminMutationOptions = {},
): Promise<void> {
  await apiClient.delete(
    `/admin/products/${productId}/ingredients/${rowId}`,
    withIfMatch(undefined, options),
  );
}

export async function createAdminProductWarning(
  productId: number,
  payload: AdminProductWarningPayload,
): Promise<AdminProductWarning> {
  const res = await apiClient.post<{ warning?: unknown }>(`/admin/products/${productId}/warnings`, payload);
  const warning = (res.data.warning ?? res.data) as Record<string, unknown>;
  return parseProductWarning(warning);
}

export async function updateAdminProductWarning(
  productId: number,
  warningId: number,
  payload: AdminProductWarningPayload,
  options: AdminMutationOptions = {},
): Promise<AdminProductWarning> {
  const res = await apiClient.put<{ warning?: unknown }>(
    `/admin/products/${productId}/warnings/${warningId}`,
    payload,
    withIfMatch(undefined, options),
  );
  const warning = (res.data.warning ?? res.data) as Record<string, unknown>;
  return parseProductWarning(warning);
}

export async function deleteAdminProductWarning(
  productId: number,
  warningId: number,
  options: AdminMutationOptions = {},
): Promise<AdminProductWarning | null> {
  const res = await apiClient.delete<{ warning?: unknown }>(
    `/admin/products/${productId}/warnings/${warningId}`,
    withIfMatch(undefined, options),
  );
  if (!res.data.warning || typeof res.data.warning !== 'object') return null;
  return parseProductWarning(res.data.warning as Record<string, unknown>);
}

export async function getAdminIngredients(params: {
  q?: string;
  task?: string;
  ingredient_group?: string;
  page?: number;
  limit?: number;
} = {}): Promise<AdminIngredientsResponse> {
  const query = toQueryParams({
    q: params.q,
    task: params.task,
    ingredient_group: params.ingredient_group,
    page: params.page,
    limit: params.limit,
  });
  const res = await apiClient.get<Record<string, unknown>>('/admin/ingredients', { params: query });
  const ingredients = Array.isArray(res.data.ingredients) ? res.data.ingredients : [];
  const total = toIntOrNull(res.data.total) ?? ingredients.length;
  const page = toIntOrNull(res.data.page) ?? params.page ?? 1;
  const limit = toIntOrNull(res.data.limit) ?? params.limit ?? Math.max(1, ingredients.length);
  const summaryRaw = res.data.summary && typeof res.data.summary === 'object'
    ? res.data.summary as Record<string, unknown>
    : {};
  const groups = Array.isArray(summaryRaw.groups)
    ? summaryRaw.groups.map((entry) => {
        const raw = entry && typeof entry === 'object' ? entry as Record<string, unknown> : {};
        return {
          value: toTextOrNull(raw.value) ?? '',
          label: toTextOrNull(raw.label) ?? '',
          count: toIntOrNull(raw.count) ?? 0,
        };
      }).filter((entry): entry is AdminIngredientGroupOption => Boolean(entry.value && entry.label))
    : undefined;
  return {
    ingredients: ingredients.map((ingredient) => parseAdminIngredientListItem(ingredient as Record<string, unknown>)),
    total,
    page,
    limit,
    total_pages: toIntOrNull(res.data.total_pages) ?? Math.max(1, Math.ceil(total / limit)),
    summary: {
      total: toIntOrNull(summaryRaw.total) ?? total,
      groups,
    },
  };
}

export async function getProductLinkReports(params: {
  q?: string;
  status?: AdminProductLinkReportStatus | '';
  page?: number;
  limit?: number;
} = {}): Promise<AdminProductLinkReportsResponse> {
  const query = toQueryParams({
    q: params.q,
    status: params.status,
    page: params.page,
    limit: params.limit ?? 50,
  });
  const res = await apiClient.get<Record<string, unknown>>(
    '/admin/link-reports',
    { params: query },
  );
  const reports = Array.isArray(res.data.reports) ? res.data.reports : [];
  const summaryRaw = res.data.summary && typeof res.data.summary === 'object'
    ? res.data.summary as Record<string, unknown>
    : {};
  const statusSummary = parseCountMap(summaryRaw.statuses ?? res.data.status_summary);
  const availableStatuses = Array.isArray(res.data.available_statuses)
    ? res.data.available_statuses
        .map((entry) => toTextOrNull(entry))
        .filter((entry): entry is AdminProductLinkReportStatus => (
          entry === 'open' || entry === 'reviewed' || entry === 'closed'
        ))
    : undefined;
  return {
    reports: reports.map((report) => parseProductLinkReport(report as Record<string, unknown>)),
    total: toIntOrNull(res.data.total) ?? reports.length,
    page: toIntOrNull(res.data.page) ?? params.page ?? 1,
    limit: toIntOrNull(res.data.limit) ?? params.limit ?? 50,
    summary: {
      total: toIntOrNull(summaryRaw.total) ?? 0,
      statuses: {
        open: statusSummary.open ?? 0,
        reviewed: statusSummary.reviewed ?? 0,
        closed: statusSummary.closed ?? 0,
      },
    },
    available_statuses: availableStatuses,
  };
}

export async function updateProductLinkReportStatus(
  reportId: number,
  status: AdminProductLinkReportStatus,
): Promise<AdminProductLinkReport> {
  const res = await apiClient.patch<{ report?: unknown }>(
    `/admin/link-reports/${reportId}`,
    { status },
  );
  const report = (res.data.report ?? res.data) as Record<string, unknown>;
  return parseProductLinkReport(report);
}

export async function getIngredientResearchExport(): Promise<unknown> {
  const res = await apiClient.get('/admin/ingredient-research/export');
  return res.data;
}

export async function getLaunchChecks(): Promise<AdminLaunchChecksResponse> {
  const res = await apiClient.get<AdminLaunchChecksResponse>('/admin/launch-checks');
  return res.data;
}

function parseAdminInteraction(raw: Record<string, unknown>): AdminInteraction {
  return {
    id: toIntOrNull(raw.id) ?? 0,
    ingredient_id: toIntOrNull(raw.ingredient_id) ?? toIntOrNull(raw.ingredient_a_id) ?? 0,
    partner_type: toTextOrNull(raw.partner_type) ?? 'ingredient',
    partner_ingredient_id: toIntOrNull(raw.partner_ingredient_id),
    partner_label: toTextOrNull(raw.partner_label),
    type: toTextOrNull(raw.type) ?? 'caution',
    comment: toTextOrNull(raw.comment),
    severity: toTextOrNull(raw.severity),
    mechanism: toTextOrNull(raw.mechanism),
    source_label: toTextOrNull(raw.source_label),
    source_url: toTextOrNull(raw.source_url),
    is_active: toIntOrNull(raw.is_active) ?? (toBooleanOrNull(raw.is_active) === false ? 0 : 1),
    ingredient_a_id: toIntOrNull(raw.ingredient_a_id) ?? toIntOrNull(raw.ingredient_id) ?? 0,
    ingredient_b_id: toIntOrNull(raw.ingredient_b_id) ?? toIntOrNull(raw.partner_ingredient_id),
    ingredient_a_name: toTextOrNull(raw.ingredient_a_name) ?? undefined,
    ingredient_b_name: toTextOrNull(raw.ingredient_b_name),
    version: toIntOrNull(raw.version),
  };
}

export async function getInteractions(params: {
  ingredient_id?: number;
} = {}): Promise<AdminInteraction[]> {
  const query = toQueryParams({
    ingredient_id: params.ingredient_id,
  });
  const res = await apiClient.get<{ interactions?: unknown[] }>('/interactions', { params: query });
  const interactions = Array.isArray(res.data.interactions) ? res.data.interactions : [];
  return interactions.map((interaction) => parseAdminInteraction(interaction as Record<string, unknown>));
}

export async function upsertAdminInteraction(payload: AdminInteractionPayload): Promise<AdminInteraction> {
  const res = await apiClient.post<{ interaction?: unknown }>('/interactions', payload, withIfMatch(payload));
  const interaction = (res.data.interaction ?? res.data) as Record<string, unknown>;
  return parseAdminInteraction(interaction);
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

export async function deleteInteraction(id: number, options: AdminMutationOptions = {}): Promise<void> {
  await apiClient.delete(`/interactions/${id}`, withIfMatch(undefined, options));
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
  const res = await apiClient.get<IngredientListResponse>('/ingredients');
  return res.data.ingredients ?? [];
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

export async function getAdminIngredientTaskStatuses(ingredientId: number): Promise<AdminIngredientTaskStatusMap> {
  const { data } = await apiClient.get<Record<string, unknown>>(`/admin/ingredients/${ingredientId}/task-status`);
  return parseIngredientTaskStatusMap(data.statuses);
}

export async function updateAdminIngredientTaskStatus(
  ingredientId: number,
  taskKey: AdminIngredientTaskKey,
  payload: {
    status: AdminIngredientTaskStatusValue;
    note?: string | null;
  },
): Promise<AdminIngredientTaskStatusMap> {
  const { data } = await apiClient.put<Record<string, unknown>>(
    `/admin/ingredients/${ingredientId}/task-status/${taskKey}`,
    {
      status: payload.status,
      note: toTrimmedOrNull(payload.note),
    },
  );
  return parseIngredientTaskStatusMap(data.statuses);
}

export async function getAdminIngredientProductRecommendations(
  ingredientId: number,
): Promise<AdminIngredientProductRecommendationsResponse> {
  const { data } = await apiClient.get<Record<string, unknown>>(
    `/admin/ingredients/${ingredientId}/product-recommendations`,
  );
  const recommendationsRaw = Array.isArray(data.recommendations) ? data.recommendations : [];
  const recommendations = recommendationsRaw
    .map((entry) => parseIngredientProductRecommendation(entry as Record<string, unknown>))
    .filter((entry): entry is AdminIngredientProductRecommendation => entry !== null);
  return {
    recommendations,
    slots: parseIngredientProductRecommendationSlots(data.slots),
  };
}

export async function upsertAdminIngredientProductRecommendation(
  ingredientId: number,
  slot: AdminIngredientProductRecommendationSlot,
  payload: {
    product_id: number;
    shop_link_id?: number | null;
  },
): Promise<AdminIngredientProductRecommendationsResponse> {
  const { data } = await apiClient.put<Record<string, unknown>>(
    `/admin/ingredients/${ingredientId}/product-recommendations/${slot}`,
    {
      product_id: payload.product_id,
      shop_link_id: payload.shop_link_id ?? null,
    },
  );
  return {
    recommendations: (Array.isArray(data.recommendations) ? data.recommendations : [])
      .map((entry) => parseIngredientProductRecommendation(entry as Record<string, unknown>))
      .filter((entry): entry is AdminIngredientProductRecommendation => entry !== null),
    slots: parseIngredientProductRecommendationSlots(data.slots),
  };
}

export async function deleteAdminIngredientProductRecommendation(
  ingredientId: number,
  slot: AdminIngredientProductRecommendationSlot,
): Promise<AdminIngredientProductRecommendationsResponse> {
  const { data } = await apiClient.delete<Record<string, unknown>>(
    `/admin/ingredients/${ingredientId}/product-recommendations/${slot}`,
  );
  return {
    recommendations: (Array.isArray(data.recommendations) ? data.recommendations : [])
      .map((entry) => parseIngredientProductRecommendation(entry as Record<string, unknown>))
      .filter((entry): entry is AdminIngredientProductRecommendation => entry !== null),
    slots: parseIngredientProductRecommendationSlots(data.slots),
  };
}

export async function getIngredientPrecursors(ingredientId: number): Promise<AdminIngredientPrecursor[]> {
  const { data } = await apiClient.get<Record<string, unknown>>(`/admin/ingredients/${ingredientId}/precursors`);
  const rows = Array.isArray(data.precursors) ? data.precursors : [];
  return rows.map((entry) => parseIngredientPrecursor(entry as Record<string, unknown>));
}

export async function createIngredientPrecursor(
  ingredientId: number,
  payload: {
    precursor_ingredient_id: number;
    sort_order?: number | null;
    note?: string | null;
  },
): Promise<AdminIngredientPrecursor> {
  const { data } = await apiClient.post<Record<string, unknown>>(
    `/admin/ingredients/${ingredientId}/precursors`,
    {
      precursor_ingredient_id: payload.precursor_ingredient_id,
      sort_order: payload.sort_order ?? 0,
      note: toTrimmedOrNull(payload.note),
    },
  );
  const created = data.precursor ?? data;
  if (created && typeof created === 'object') {
    return parseIngredientPrecursor(created as Record<string, unknown>);
  }
  throw new Error('Could not parse precursor response.');
}

export async function updateIngredientPrecursor(
  ingredientId: number,
  precursorIngredientId: number,
  payload: {
    sort_order?: number | null;
    note?: string | null;
  },
): Promise<AdminIngredientPrecursor> {
  const { data } = await apiClient.patch<Record<string, unknown>>(
    `/admin/ingredients/${ingredientId}/precursors/${precursorIngredientId}`,
    {
      sort_order: payload.sort_order ?? 0,
      note: toTrimmedOrNull(payload.note),
    },
  );
  const updated = data.precursor ?? data;
  if (updated && typeof updated === 'object') {
    return parseIngredientPrecursor(updated as Record<string, unknown>);
  }
  throw new Error('Could not parse precursor response.');
}

export async function deleteIngredientPrecursor(
  ingredientId: number,
  precursorIngredientId: number,
): Promise<void> {
  await apiClient.delete(`/admin/ingredients/${ingredientId}/precursors/${precursorIngredientId}`);
}

export async function updateIngredientResearchStatus(
  ingredientId: number,
  payload: AdminIngredientResearchStatusPayload,
  options: AdminMutationOptions = {},
): Promise<AdminIngredientResearchStatus> {
  const normalized = normalizeStatusPayload(payload);
  const { data } = await apiClient.put(
    `/admin/ingredient-research/${ingredientId}/status`,
    normalized,
    withIfMatch(normalized, options),
  );
  const status = data?.status ?? data;
  if (status && typeof status === 'object') return parseIngredientResearchStatus(status as Record<string, unknown>);
  return normalizeIngredientResearchDetailResponse(data).status;
}

export async function upsertIngredientDisplayProfile(
  ingredientId: number,
  payload: AdminIngredientDisplayProfilePayload,
  options: AdminMutationOptions = {},
): Promise<AdminIngredientDisplayProfile> {
  const normalized = normalizeDisplayProfilePayload(payload);
  const { data } = await apiClient.put(
    `/admin/ingredient-research/${ingredientId}/display-profile`,
    normalized,
    withIfMatch(normalized, options),
  );
  const profile = data?.profile ?? data;
  if (profile && typeof profile === 'object') {
    return parseIngredientDisplayProfile(profile as Record<string, unknown>);
  }
  throw new Error('Could not parse display profile response.');
}

export async function createIngredientResearchSource(
  ingredientId: number,
  payload: AdminIngredientResearchSourcePayload,
): Promise<AdminIngredientResearchSource> {
  const normalized = normalizeSourcePayload(payload);
  const { data } = await apiClient.post(`/admin/ingredient-research/${ingredientId}/sources`, normalized);
  const created = data?.source ?? data;
  if (created && typeof created === 'object') {
    return parseIngredientResearchSource(created as Record<string, unknown>);
  }
  throw new Error('Could not parse source response.');
}

export async function getAdminEvidenceSummary(ingredientId: number): Promise<AdminEvidenceSummary> {
  const { data } = await apiClient.get<Record<string, unknown>>(
    `/admin/ingredients/${ingredientId}/evidence-summary`,
  );
  const summary = (data.summary ?? data.evidence_summary ?? data) as Record<string, unknown>;
  return parseEvidenceSummary(summary);
}

export async function getAdminNutrientReferenceValues(
  ingredientId: number,
): Promise<AdminNutrientReferenceValue[]> {
  const { data } = await apiClient.get<unknown>(
    `/admin/ingredients/${ingredientId}/nutrient-reference-values`,
  );
  const payload = data && typeof data === 'object' && !Array.isArray(data)
    ? (data as Record<string, unknown>)
    : {};
  const values = Array.isArray(data)
    ? data
    : Array.isArray(payload.values)
      ? payload.values
      : Array.isArray(payload.nutrient_reference_values)
        ? payload.nutrient_reference_values
        : [];
  return values.map((entry) => parseNutrientReferenceValue(entry as Record<string, unknown>));
}

export async function createAdminNutrientReferenceValue(
  ingredientId: number,
  payload: AdminNutrientReferenceValuePayload,
): Promise<AdminNutrientReferenceValue> {
  const normalized = normalizeNutrientReferenceValuePayload(payload);
  const { data } = await apiClient.post<Record<string, unknown>>(
    `/admin/ingredients/${ingredientId}/nutrient-reference-values`,
    normalized,
  );
  const value = (data.value ?? data.nutrient_reference_value ?? data) as Record<string, unknown>;
  return parseNutrientReferenceValue(value);
}

export async function updateAdminNutrientReferenceValue(
  valueId: number,
  payload: AdminNutrientReferenceValuePayload,
  options: AdminMutationOptions = {},
): Promise<AdminNutrientReferenceValue> {
  const normalized = normalizeNutrientReferenceValuePayload(payload);
  const { data } = await apiClient.put<Record<string, unknown>>(
    `/admin/nutrient-reference-values/${valueId}`,
    normalized,
    withIfMatch(undefined, options),
  );
  const value = (data.value ?? data.nutrient_reference_value ?? data) as Record<string, unknown>;
  return parseNutrientReferenceValue(value);
}

export async function deleteAdminNutrientReferenceValue(
  valueId: number,
  options: AdminMutationOptions = {},
): Promise<void> {
  await apiClient.delete(`/admin/nutrient-reference-values/${valueId}`, withIfMatch(undefined, options));
}

export async function updateIngredientResearchSource(
  sourceId: number,
  payload: AdminIngredientResearchSourcePayload,
  options: AdminMutationOptions = {},
): Promise<AdminIngredientResearchSource> {
  const normalized = normalizeSourcePayload(payload);
  const { data } = await apiClient.put(
    `/admin/ingredient-research/sources/${sourceId}`,
    normalized,
    withIfMatch(normalized, options),
  );
  const updated = data?.source ?? data;
  if (updated && typeof updated === 'object') {
    return parseIngredientResearchSource(updated as Record<string, unknown>);
  }
  throw new Error('Could not parse source response.');
}

export async function lookupPubMedResearchSource(params: {
  pmid?: string | null;
  doi?: string | null;
}): Promise<AdminPubMedLookup> {
  const query = toQueryParams({
    pmid: toTrimmedOrNull(params.pmid),
    doi: toTrimmedOrNull(params.doi),
  });
  const { data } = await apiClient.get<Record<string, unknown>>('/admin/research/pubmed-lookup', {
    params: query,
  });
  const lookup = (data.lookup ?? data) as Record<string, unknown>;
  return parsePubMedLookup(lookup);
}

export async function deleteIngredientResearchSource(
  sourceId: number,
  options: AdminMutationOptions = {},
): Promise<void> {
  await apiClient.delete(`/admin/ingredient-research/sources/${sourceId}`, withIfMatch(undefined, options));
}

export async function createIngredientResearchWarning(
  ingredientId: number,
  payload: AdminIngredientResearchWarningPayload,
): Promise<AdminIngredientResearchWarning> {
  const normalized = normalizeWarningPayload(payload);
  const { data } = await apiClient.post(`/admin/ingredient-research/${ingredientId}/warnings`, normalized);
  const created = data?.warning ?? data;
  if (created && typeof created === 'object') {
    return parseIngredientResearchWarning(created as Record<string, unknown>);
  }
  throw new Error('Could not parse warning response.');
}

export async function updateIngredientResearchWarning(
  warningId: number,
  payload: AdminIngredientResearchWarningPayload,
  options: AdminMutationOptions = {},
): Promise<AdminIngredientResearchWarning> {
  const normalized = normalizeWarningPayload(payload);
  const { data } = await apiClient.put(
    `/admin/ingredient-research/warnings/${warningId}`,
    normalized,
    withIfMatch(normalized, options),
  );
  const updated = data?.warning ?? data;
  if (updated && typeof updated === 'object') {
    return parseIngredientResearchWarning(updated as Record<string, unknown>);
  }
  throw new Error('Could not parse warning response.');
}

export async function deleteIngredientResearchWarning(
  warningId: number,
  options: AdminMutationOptions = {},
): Promise<void> {
  await apiClient.delete(`/admin/ingredient-research/warnings/${warningId}`, withIfMatch(undefined, options));
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
  return parseDoseMutationResponse(data);
}

export async function updateDoseRecommendation(
  doseRecommendationId: number,
  payload: AdminDoseRecommendationPayload,
  options: AdminMutationOptions = {},
): Promise<AdminDoseRecommendation> {
  const normalized = normalizeDosePayload(payload);
  const paths = [
    `/admin/dose-recommendations/${doseRecommendationId}`,
    `/admin/dose_recommendments/${doseRecommendationId}`,
  ] as const;
  const { data } = await requestWithFallback<unknown>(paths, (path) =>
    apiClient.put(path, normalized, withIfMatch(normalized, options)).then((response) => response.data),
  );
  return parseDoseMutationResponse(data);
}

export async function deleteDoseRecommendation(
  doseRecommendationId: number,
  options: AdminMutationOptions = {},
): Promise<void> {
  const paths = [
    `/admin/dose-recommendations/${doseRecommendationId}`,
    `/admin/dose_recommendments/${doseRecommendationId}`,
  ] as const;
  await requestWithFallback<{ ok: boolean }>(paths, async (path) => {
    await apiClient.delete(path, withIfMatch(undefined, options));
    return { ok: true };
  });
}
