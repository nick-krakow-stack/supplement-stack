// ---------------------------------------------------------------------------
// Admin module
// Routes (mounted at /api/admin):
//   GET /products           — all products list (admin)
//   GET /products/:id/shop-links — product shop-link list (admin)
//   POST /products/:id/shop-links — create product shop link (admin)
//   PATCH /products/:id/shop-links/:shopLinkId — update product shop link (admin)
//   DELETE /products/:id/shop-links/:shopLinkId — delete product shop link (admin)
//   POST /products/:id/shop-links/:shopLinkId/recheck — recheck product shop link (admin)
//   GET /stats              — platform statistics (admin)
//   GET /shop-domains       — shop domains list (admin)
//   POST /shop-domains      — create shop domain (admin)
//   DELETE /shop-domains/:id — delete shop domain (admin)
//   GET /managed-lists/:listKey — managed admin list items (admin)
//   POST /managed-lists/:listKey — create managed admin list item (admin)
//   PATCH /managed-lists/:listKey/reorder — reorder managed admin list items (admin)
//   PATCH /managed-lists/:listKey/:itemId — update managed admin list item (admin)
//   DELETE /managed-lists/:listKey/:itemId — deactivate managed admin list item (admin)
//   GET /product-rankings   — product rankings (admin)
//   PUT /product-rankings/:productId — upsert ranking (admin)
//   GET /user-products?status= — user-submitted products (admin)
//   PUT /user-products/bulk-approve (admin)
//   PUT /user-products/:id/approve (admin)
//   PUT /user-products/:id/publish  (admin)
//   PUT /user-products/:id/reject  (admin)
//   DELETE /user-products/:id      (admin)
//   GET /ingredient-sub-ingredients (admin)
//   PUT /ingredient-sub-ingredients (admin)
//   DELETE /ingredient-sub-ingredients/:parentId/:childId (admin)
//   GET /ingredients/:id/task-status (admin)
//   PUT /ingredients/:id/task-status/:taskKey (admin)
//   GET /ingredients/:id/product-recommendations (admin)
//   PUT /ingredients/:id/product-recommendations/:slot (admin)
//   DELETE /ingredients/:id/product-recommendations/:slot (admin)
//   GET /ingredients/:id/precursors (admin)
//   POST /ingredients/:id/precursors (admin)
//   DELETE /ingredients/:id/precursors/:precursorId (admin)
//   GET /ingredient-research (admin)
//   GET /ingredient-research/export (admin)
//   GET /ingredient-research/:ingredientId (admin)
//   PUT /ingredient-research/:ingredientId/status (admin)
//   POST /ingredient-research/:ingredientId/sources (admin)
//   PUT /ingredient-research/sources/:sourceId (admin)
//   DELETE /ingredient-research/sources/:sourceId (admin)
//   POST /ingredient-research/:ingredientId/warnings (admin)
//   PUT /ingredient-research/warnings/:warningId (admin)
//   DELETE /ingredient-research/warnings/:warningId (admin)
//   PUT /ingredient-research/:ingredientId/display-profile (admin)
//   GET /translations/ingredients — ingredient translations list (admin)
//   PUT /translations/ingredients/:ingredientId/:language — upsert ingredient translation (admin)
//   GET /translations/dose-recommendations — dose recommendation translations list (admin)
//   PUT /translations/dose-recommendations/:doseRecommendationId/:language — upsert dose recommendation translation (admin)
//   GET /translations/verified-profiles — verified profile translations list (admin)
//   PUT /translations/verified-profiles/:verifiedProfileId/:language — upsert verified profile translation (admin)
//   GET /translations/blog-posts — blog translations list (admin)
//   PUT /translations/blog-posts/:blogPostId/:language — upsert blog translation (admin)
//   GET /ops-dashboard    — operational queues and counts (admin)
//   GET /product-qa       — suspicious product data list (admin)
//   PATCH /product-qa/:id — update high-impact product QA fields (admin)
//   GET /link-reports     — product link reports queue (admin)
//   PATCH /link-reports/:id — update product link report status (admin)
//   GET /export?entity=   — CSV export for allowlisted admin entities (admin)
//   GET /users           — user account list (admin)
//   PATCH /users/:id     — update safe user admin fields (admin)
//   GET /health          — admin health dashboard snapshot (admin)
//   GET /launch-checks   — live launch readiness checks (admin)
// Plus public shop-domain routes (mounted at /api/shop-domains):
//   GET /resolve?url=       — resolve shop name from URL (public)
//   GET /                   — list shop domains (public)
// Plus interaction routes (mounted at /api/interactions):
//   GET /                   — list all, optionally filtered by ingredient_id (admin)
//   POST /                  — create (admin)
//   DELETE /:id             — delete (admin)
// ---------------------------------------------------------------------------

import { Hono } from 'hono'
import type { Context } from 'hono'
import type { AppContext, CountRow, ProductRow } from '../lib/types'
import { csvEscape } from '../lib/csv'
import { ensureAuth, requireAdmin, ensureAdmin, logAdminAction } from '../lib/helpers'
import {
  getProductImageExtension,
  isSupportedProductImageType,
  PRODUCT_IMAGE_MAX_UPLOAD_BYTES,
} from '../lib/product-images'
import { loadCatalogProductSafetyWarnings } from './knowledge'

const admin = new Hono<AppContext>()

type IngredientTranslationRow = {
  ingredient_id: number
  source_name: string
  source_description: string | null
  source_hypo_symptoms: string | null
  source_hyper_symptoms: string | null
  language: string
  name: string | null
  description: string | null
  hypo_symptoms: string | null
  hyper_symptoms: string | null
  status: 'missing' | 'translated'
}

type DoseRecommendationTranslationRow = {
  dose_recommendation_id: number
  ingredient_name: string
  source_type: string
  base_source_label: string
  base_timing: string | null
  base_context_note: string | null
  dose_min: number | null
  dose_max: number
  unit: string
  per_kg_body_weight: number | null
  per_kg_cap: number | null
  population_slug: string | null
  purpose: string
  sex_filter: string | null
  is_athlete: number
  is_active: number
  language: string
  source_label: string | null
  timing: string | null
  context_note: string | null
  status: 'missing' | 'translated'
}

type VerifiedProfileTranslationRow = {
  verified_profile_id: number
  base_name: string
  base_slug: string
  base_credentials: string | null
  base_bio: string | null
  language: string
  credentials: string | null
  bio: string | null
  status: 'missing' | 'translated'
}

type BlogTranslationRow = {
  blog_post_id: number
  r2_key: string
  post_status: string
  published_at: number | null
  language: string
  title: string | null
  slug: string | null
  excerpt: string | null
  meta_description: string | null
  status: 'missing' | 'translated'
}

type UserProductIngredientRow = {
  id: number
  user_product_id: number
  ingredient_id: number
  form_id: number | null
  quantity: number | null
  unit: string | null
  basis_quantity: number | null
  basis_unit: string | null
  search_relevant: number
  parent_ingredient_id: number | null
  is_main: number
  ingredient_name: string
  ingredient_unit: string | null
  parent_ingredient_name: string | null
}

type UserProductBulkModerationRow = {
  id: number
  status: string | null
  approved_at: string | null
}

type UserProductBulkApproveResult = {
  id: number
  ok: boolean
  status: 'approved' | 'failed'
  previous_status?: string | null
  approved_at?: string | null
  error?: string
}

type ProductWarningSeverity = 'info' | 'caution' | 'warning' | 'danger'

type ProductWarningRow = {
  id: number
  product_id: number
  severity: ProductWarningSeverity | string | null
  title: string
  message: string
  alternative_note: string | null
  active: number | null
  created_at: string | null
  updated_at: string | null
  version: number | null
}

type ProductWarningPayload = {
  severity: ProductWarningSeverity
  title: string
  message: string
  alternative_note: string | null
  active: number
}

type AdminUserRow = {
  id: number
  email: string
  role: string | null
  created_at: string
  health_consent: number | null
  health_consent_at: string | null
  email_verified_at: string | null
  deleted_at: string | null
  is_trusted_product_submitter: number
  stack_count: number
  stack_item_count: number
  link_click_count: number
  last_stack_at: string | null
  user_product_count: number
  pending_user_product_count: number
  approved_user_product_count: number
  blocked_user_product_count: number
}

type IngredientSubIngredientAdminRow = {
  parent_ingredient_id: number
  parent_name: string
  parent_unit: string | null
  child_ingredient_id: number
  child_name: string
  child_unit: string | null
  prompt_label: string | null
  is_default_prompt: number
  sort_order: number
  created_at: string
}

type DoseRecommendationAdminRow = {
  id: number
  ingredient_id: number
  ingredient_name: string
  population_id: number
  population_slug: string | null
  population_name_de: string | null
  source_type: DoseRecommendationSourceType
  source_label: string
  source_url: string | null
  dose_min: number | null
  dose_max: number
  unit: string
  per_kg_body_weight: number | null
  per_kg_cap: number | null
  timing: string | null
  context_note: string | null
  sex_filter: DoseRecommendationSexFilter
  is_athlete: number
  purpose: DoseRecommendationPurpose
  is_default: number
  is_active: number
  relevance_score: number
  created_by_user_id: number | null
  created_by_email: string | null
  is_public: number
  verified_profile_id: number | null
  verified_profile_slug: string | null
  verified_profile_name: string | null
  category_name: string | null
  published_at: number | null
  verified_at: number | null
  review_due_at: number | null
  superseded_by_id: number | null
  created_at: number
  updated_at: number
  version: number | null
  sources: DoseRecommendationLinkedSource[]
}

type DoseRecommendationLinkedSource = {
  id: number
  dose_recommendation_id: number
  research_source_id: number
  source_ingredient_id: number
  relevance_weight: number
  is_primary: number
  note: string | null
  created_at: number
  source_kind: IngredientResearchSourceKind
  organization: string | null
  country: string | null
  region: string | null
  population: string | null
  recommendation_type: string | null
  no_recommendation: number
  dose_min: number | null
  dose_max: number | null
  dose_unit: string | null
  per_kg_body_weight: number
  frequency: string | null
  study_type: string | null
  evidence_quality: string | null
  duration: string | null
  outcome: string | null
  finding: string | null
  source_title: string | null
  source_url: string | null
  doi: string | null
  pubmed_id: string | null
  notes: string | null
  source_date: string | null
  reviewed_at: string | null
  is_retracted: number
  retraction_checked_at: string | null
  retraction_notice_url: string | null
  evidence_grade: EvidenceGrade | null
}

type DoseRecommendationSourceMutation = {
  research_source_id: number
  relevance_weight: number
  is_primary: number
  note: string | null
}

type DoseRecommendationMutation = {
  ingredient_id: number
  population_id: number
  source_type: DoseRecommendationSourceType
  source_label: string
  source_url: string | null
  dose_min: number | null
  dose_max: number
  unit: string
  per_kg_body_weight: number | null
  per_kg_cap: number | null
  timing: string | null
  context_note: string | null
  sex_filter: DoseRecommendationSexFilter
  is_athlete: number
  purpose: DoseRecommendationPurpose
  is_default: number
  is_active: number
  relevance_score: number
  created_by_user_id: number | null
  is_public: number
  verified_profile_id: number | null
  category_name: string | null
  population_slug: string
  verified_profile_name: string | null
  published_at: number | null
  verified_at: number | null
  review_due_at: number | null
  superseded_by_id: number | null
  sources: DoseRecommendationSourceMutation[] | undefined
}

type ValidationFailure = {
  ok: false
  error: string
  status?: 400 | 404 | 409 | 502
}

type ValidationSuccess<T> = {
  ok: true
  value: T
}

type ValidationResult<T> = ValidationSuccess<T> | ValidationFailure

type PopulationLookupRow = {
  id: number
  slug: string
  name_de: string
}

type VerifiedProfileLookupRow = {
  id: number
  slug: string
  name: string
}

type AuditLogDbRow = {
  id: number
  user_id: number | null
  user_email: string | null
  action: string
  entity_type: string
  entity_id: number | null
  changes: string | null
  reason: string | null
  ip_address: string | null
  user_agent: string | null
  created_at: number
}

type IngredientResearchStatusValue = typeof INGREDIENT_RESEARCH_STATUSES[number]
type IngredientCalculationStatusValue = typeof INGREDIENT_CALCULATION_STATUSES[number]
type IngredientResearchSourceKind = typeof INGREDIENT_RESEARCH_SOURCE_KINDS[number]
type IngredientWarningSeverity = typeof INGREDIENT_WARNING_SEVERITIES[number]
type EvidenceGrade = typeof EVIDENCE_GRADES[number]
type NutrientReferenceValueKind = typeof NUTRIENT_REFERENCE_VALUE_KINDS[number]

type IngredientResearchListRow = {
  ingredient_id: number
  name: string
  category: string | null
  unit: string | null
  research_status: IngredientResearchStatusValue
  calculation_status: IngredientCalculationStatusValue
  internal_notes: string | null
  blog_url: string | null
  status_reviewed_at: string | null
  review_due_at: string | null
  status_updated_at: string | null
  official_source_count: number
  study_source_count: number
  warning_count: number
  no_recommendation_count: number
  latest_source_reviewed_at: string | null
}

type IngredientResearchStatusRow = {
  ingredient_id: number
  research_status: IngredientResearchStatusValue
  calculation_status: IngredientCalculationStatusValue
  internal_notes: string | null
  blog_url: string | null
  reviewed_at: string | null
  review_due_at: string | null
  created_at: string
  updated_at: string
  version: number | null
}

type IngredientResearchSourceRow = {
  id: number
  ingredient_id: number
  source_kind: IngredientResearchSourceKind
  organization: string | null
  country: string | null
  region: string | null
  population: string | null
  recommendation_type: string | null
  no_recommendation: number
  dose_min: number | null
  dose_max: number | null
  dose_unit: string | null
  per_kg_body_weight: number
  frequency: string | null
  study_type: string | null
  evidence_quality: string | null
  duration: string | null
  outcome: string | null
  finding: string | null
  source_title: string | null
  source_url: string | null
  doi: string | null
  pubmed_id: string | null
  notes: string | null
  source_date: string | null
  reviewed_at: string | null
  is_retracted: number
  retraction_checked_at: string | null
  retraction_notice_url: string | null
  evidence_grade: EvidenceGrade | null
  created_at: string
  updated_at: string
  version: number | null
}

type NutrientReferenceValueRow = {
  id: number
  ingredient_id: number
  population_id: number | null
  organization: string
  region: string | null
  kind: NutrientReferenceValueKind
  value: number
  value_min: number | null
  value_max: number | null
  unit: string
  source_url: string | null
  source_label: string | null
  source_year: number | null
  notes: string | null
  note: string | null
  created_at: string | null
  updated_at: string | null
  version: number | null
}

type NutrientReferenceValueMutation = {
  ingredient_id: number
  population_id: number | null
  organization: string
  region: string | null
  kind: NutrientReferenceValueKind
  value: number
  unit: string
  source_url: string | null
  source_label: string | null
  source_year: number | null
  notes: string | null
}

type IngredientSafetyWarningAdminRow = {
  id: number
  ingredient_id: number
  ingredient_name: string | null
  form_id: number | null
  form_name: string | null
  short_label: string
  popover_text: string
  severity: IngredientWarningSeverity
  article_slug: string | null
  article_title: string | null
  min_amount: number | null
  unit: string | null
  active: number
  created_at: string
  version: number | null
}

type IngredientFormAdminRow = {
  id: number
  ingredient_id: number
  name: string
  timing: string | null
  comment: string | null
}

type IngredientPrecursorAdminRow = {
  ingredient_id: number
  precursor_ingredient_id: number
  precursor_name: string
  precursor_unit: string | null
  sort_order: number
  note: string | null
  created_at: string | null
}

type IngredientDisplayProfileRow = {
  id: number
  ingredient_id: number
  form_id: number | null
  sub_ingredient_id: number | null
  effect_summary: string | null
  timing: string | null
  timing_note: string | null
  intake_hint: string | null
  card_note: string | null
  created_at: string
  updated_at: string
  version: number | null
}

type IngredientResearchSourceMutation = Omit<IngredientResearchSourceRow, 'id' | 'created_at' | 'updated_at' | 'version'>
type IngredientSafetyWarningMutation = Omit<IngredientSafetyWarningAdminRow, 'id' | 'ingredient_name' | 'form_name' | 'article_title' | 'created_at' | 'version'>

type KnowledgeArticleStatus = typeof KNOWLEDGE_ARTICLE_STATUSES[number]

type KnowledgeArticleDbRow = {
  slug: string
  title: string
  summary: string
  body: string
  status: KnowledgeArticleStatus
  reviewed_at: string | null
  sources_json: string
  conclusion: string | null
  featured_image_r2_key: string | null
  featured_image_url: string | null
  dose_min: number | null
  dose_max: number | null
  dose_unit: string | null
  product_note: string | null
  created_at: string
  updated_at: string
  version: number | null
}

type KnowledgeArticleListDbRow = Omit<KnowledgeArticleDbRow, 'body' | 'created_at'>

type KnowledgeArticlePayload = {
  slug: string
  title: string
  summary: string
  body: string
  status: KnowledgeArticleStatus
  reviewed_at: string | null
  sources_json: string
  sources: KnowledgeArticleSourceInput[]
  ingredient_ids: number[]
  conclusion: string | null
  featured_image_r2_key: string | null
  featured_image_url: string | null
  dose_min: number | null
  dose_max: number | null
  dose_unit: string | null
  product_note: string | null
}

type ParsedKnowledgeArticle<T extends KnowledgeArticleDbRow | KnowledgeArticleListDbRow> =
  Omit<T, 'sources_json'> & {
    sources_json: unknown[]
    sources: KnowledgeArticleSourcePayload[]
    ingredient_ids: number[]
    ingredients: KnowledgeArticleIngredientPayload[]
  }

type KnowledgeArticleSourceInput = {
  label: string
  url: string
  sort_order: number
}

type KnowledgeArticleSourcePayload = KnowledgeArticleSourceInput & {
  id: number | null
  name: string
  link: string
}

type KnowledgeArticleIngredientPayload = {
  ingredient_id: number
  name: string | null
  sort_order: number
}

type KnowledgeArticleSourceRow = {
  id: number
  article_slug: string
  label: string
  url: string
  sort_order: number
}

type KnowledgeArticleIngredientRow = {
  article_slug: string
  ingredient_id: number
  name: string | null
  sort_order: number
}

type ProductQaIssue = typeof PRODUCT_QA_ISSUES[number]
type AffiliateLinkHealthStatus = 'unchecked' | 'ok' | 'failed' | 'timeout' | 'invalid'

type AffiliateLinkHealth = {
  url: string | null
  status: AffiliateLinkHealthStatus | null
  http_status: number | null
  failure_reason: string | null
  last_checked_at: string | null
  last_success_at: string | null
  consecutive_failures: number | null
  response_time_ms: number | null
  final_url: string | null
  redirected: number | null
}

type ProductShopLinkHealth = AffiliateLinkHealth

type AffiliateLinkHealthSelectRow = {
  lh_product_id: number | null
  lh_url: string | null
  lh_status: string | null
  lh_http_status: number | null
  lh_failure_reason: string | null
  lh_last_checked_at: string | null
  lh_last_success_at: string | null
  lh_consecutive_failures: number | null
  lh_response_time_ms: number | null
  lh_final_url: string | null
  lh_redirected: number | null
}

type ProductShopLinkHealthSelectRow = {
  pslh_shop_link_id: number | null
  pslh_url: string | null
  pslh_status: string | null
  pslh_http_status: number | null
  pslh_failure_reason: string | null
  pslh_last_checked_at: string | null
  pslh_last_success_at: string | null
  pslh_consecutive_failures: number | null
  pslh_response_time_ms: number | null
  pslh_final_url: string | null
  pslh_redirected: number | null
}

type ProductShopLinkRow = {
  id: number
  product_id: number
  shop_domain_id: number | null
  shop_name: string | null
  url: string
  normalized_host: string | null
  is_affiliate: number
  affiliate_owner_type: AffiliateOwnerType
  affiliate_owner_user_id: number | null
  source_type: string
  submitted_by_user_id: number | null
  is_primary: number
  active: number
  sort_order: number
  version: number | null
  created_at: string | null
  updated_at: string | null
} & Partial<ProductShopLinkHealthSelectRow>

type ProductShopLink = Omit<ProductShopLinkRow, keyof ProductShopLinkHealthSelectRow> & {
  health: ProductShopLinkHealth | null
}

type IngredientAdminTaskStatusRow = {
  ingredient_id: number
  task_key: IngredientAdminTaskKey
  status: IngredientAdminTaskStatus
  note: string | null
  updated_at: string | null
  updated_by_user_id: number | null
}

type IngredientProductRecommendationRow = {
  id: number
  ingredient_id: number
  product_id: number
  type: string
  shop_link_id: number | null
  recommendation_slot: IngredientProductRecommendationSlot
  sort_order: number
  product_name: string
  product_brand: string | null
  product_shop_link: string | null
  product_moderation_status: string | null
  product_visibility: string | null
  shop_link_url: string | null
  shop_link_name: string | null
  shop_link_host: string | null
}

type ProductShopLinkMutation = {
  shop_domain_id?: number | null
  shop_name?: string | null
  url?: string
  normalized_host?: string | null
  is_affiliate?: number
  affiliate_owner_type?: AffiliateOwnerType
  affiliate_owner_user_id?: number | null
  source_type?: string
  is_primary?: number
  active?: number
  sort_order?: number
}

type ProductShopLinkCheckStatus = Exclude<AffiliateLinkHealthStatus, 'unchecked'>
type ProductShopLinkCheckMethod = 'HEAD' | 'GET'
type ProductShopLinkCheckResult = {
  status: ProductShopLinkCheckStatus
  url: string
  host: string
  http_status: number | null
  failure_reason: string | null
  check_method: ProductShopLinkCheckMethod | null
  final_url: string | null
  redirected: number
  response_time_ms: number | null
}

type ManagedListItemRow = {
  id: number
  list_key: string
  value: string
  label: string
  plural_label: string | null
  description: string | null
  sort_order: number
  active: number
  version: number | null
  created_at: string | null
  updated_at: string | null
}

type ManagedListItemMutation = {
  value?: string
  label?: string
  plural_label?: string | null
  description?: string | null
  sort_order?: number
  active?: number
}

type ManagedListReorderItem = {
  id: number
  sort_order: number
  version?: number | null
}

type ProductQaRow = {
  id: number
  name: string
  brand: string | null
  form: string | null
  price: number
  shop_link: string | null
  image_url: string | null
  image_r2_key: string | null
  is_affiliate: number
  affiliate_owner_type: AffiliateOwnerType | null
  affiliate_owner_user_id: number | null
  serving_size: number | null
  serving_unit: string | null
  servings_per_container: number | null
  container_count: number | null
  moderation_status: string
  visibility: string
  created_at: string
  ingredient_count: number
  main_ingredient_count: number
  missing_image: number
  missing_shop_link: number
  missing_serving_data: number
  suspicious_price_zero_or_high: number
  missing_ingredient_rows: number
  no_affiliate_flag_on_shop_link: number
  version: number | null
} & Partial<AffiliateLinkHealthSelectRow>

type ProductQaIssueSummaryRow = Record<ProductQaIssue, number> & {
  total: number
}

type ProductQaPatch = {
  name?: string
  brand?: string | null
  form?: string | null
  price?: number | null
  shop_link?: string | null
  image_url?: string | null
  is_affiliate?: number
  affiliate_owner_type?: AffiliateOwnerType
  affiliate_owner_user_id?: number | null
  moderation_status?: ProductModerationStatus
  visibility?: ProductVisibility
  serving_size?: number | null
  serving_unit?: string | null
  servings_per_container?: number | null
  container_count?: number | null
}

type ProductCreatePayload = ProductQaPatch & {
  name: string
  price: number
}

type ProductLinkReportStatus = typeof PRODUCT_LINK_REPORT_STATUSES[number]

type ProductLinkReportRow = {
  id: number
  user_id: number
  user_email: string | null
  stack_id: number | null
  stack_name: string | null
  product_type: 'catalog' | 'user_product'
  product_id: number
  product_name: string | null
  shop_link_snapshot: string | null
  current_shop_link: string | null
  reason: string
  status: ProductLinkReportStatus
  created_at: string
}

type ProductLinkReportStatusSummaryRow = {
  total: number
  open: number
  reviewed: number
  closed: number
}

type AdminProductIngredientRow = {
  id: number
  product_id: number
  ingredient_id: number
  ingredient_name: string
  ingredient_unit: string | null
  ingredient_description: string | null
  form_id: number | null
  form_name: string | null
  parent_ingredient_id: number | null
  parent_ingredient_name: string | null
  is_main: number
  search_relevant: number
  quantity: number | null
  unit: string | null
  basis_quantity: number | null
  basis_unit: string | null
  effect_summary: string | null
  timing: string | null
  timing_note: string | null
  intake_hint: string | null
  card_note: string | null
}

type ProductIngredientPayload = {
  ingredient_id: number
  is_main: number
  quantity: number | null
  unit: string | null
  form_id: number | null
  basis_quantity: number | null
  basis_unit: string | null
  search_relevant: number
  parent_ingredient_id: number | null
}

type IngredientResearchExportRow = {
  ingredient_id: number
  name: string
  category: string | null
  unit: string | null
  research_status: IngredientResearchStatusValue
  calculation_status: IngredientCalculationStatusValue
  reviewed_at: string | null
  review_due_at: string | null
  source_count: number
  official_source_count: number
  study_source_count: number
  no_recommendation_count: number
  warning_count: number
  warning_slugs: string | null
}

const DOSE_RECOMMENDATION_SOURCE_TYPES = ['official', 'study', 'profile', 'user_private', 'user_public'] as const
type DoseRecommendationSourceType = typeof DOSE_RECOMMENDATION_SOURCE_TYPES[number]

const DOSE_RECOMMENDATION_PURPOSES = ['maintenance', 'deficiency_correction', 'therapeutic'] as const
type DoseRecommendationPurpose = typeof DOSE_RECOMMENDATION_PURPOSES[number]

const DOSE_RECOMMENDATION_SEX_FILTERS = ['male', 'female'] as const
type DoseRecommendationSexFilter = typeof DOSE_RECOMMENDATION_SEX_FILTERS[number] | null

const INGREDIENT_RESEARCH_STATUSES = ['unreviewed', 'researching', 'needs_review', 'reviewed', 'stale', 'blocked'] as const
const INGREDIENT_CALCULATION_STATUSES = ['not_started', 'in_progress', 'needs_review', 'ready', 'not_applicable', 'blocked'] as const
const INGREDIENT_RESEARCH_SOURCE_KINDS = ['official', 'study'] as const
const INGREDIENT_WARNING_SEVERITIES = ['info', 'caution', 'danger'] as const
const EVIDENCE_GRADES = ['A', 'B', 'C', 'D', 'F'] as const
const NUTRIENT_REFERENCE_VALUE_KINDS = ['rda', 'ai', 'ear', 'ul', 'pri', 'ar', 'lti', 'ri', 'nrv'] as const
const KNOWLEDGE_ARTICLE_STATUSES = ['draft', 'published', 'archived'] as const
const AFFILIATE_OWNER_TYPES = ['none', 'nick', 'user'] as const
const PRODUCT_MODERATION_STATUSES = ['pending', 'approved', 'rejected', 'blocked'] as const
const PRODUCT_VISIBILITIES = ['hidden', 'public'] as const
const PRODUCT_SHOP_LINK_SOURCE_TYPES = ['admin', 'legacy_product', 'user_product', 'user_submission'] as const
const INGREDIENT_ADMIN_TASK_KEYS = ['forms', 'dge', 'precursors', 'synonyms'] as const
const INGREDIENT_ADMIN_TASK_STATUSES = ['open', 'done', 'none'] as const
const INGREDIENT_PRODUCT_RECOMMENDATION_SLOTS = ['primary', 'alternative_1', 'alternative_2'] as const
const ADMIN_HIDDEN_TOP_LEVEL_INGREDIENT_NAMES = ['B-Vitamin-Komplex', 'DPA'] as const
const ADMIN_INGREDIENT_GROUPS = [
  { value: 'vitamins', label: 'Vitamine' },
  { value: 'minerals', label: 'Mineralstoffe' },
  { value: 'trace_elements', label: 'Spurenelemente' },
  { value: 'enzymes', label: 'Enzyme' },
  { value: 'amino_acids', label: 'Aminosäuren' },
  { value: 'fatty_acids', label: 'Fettsäuren' },
  { value: 'plant_extracts', label: 'Pflanzenstoffe' },
  { value: 'adaptogens', label: 'Adaptogene' },
  { value: 'other', label: 'Sonstige' },
] as const
const PRODUCT_SHOP_LINK_RECHECK_TIMEOUT_MS = 6000
const PRODUCT_SHOP_LINK_RECHECK_MAX_REDIRECTS = 5
type AffiliateOwnerType = typeof AFFILIATE_OWNER_TYPES[number]
type ProductModerationStatus = typeof PRODUCT_MODERATION_STATUSES[number]
type ProductVisibility = typeof PRODUCT_VISIBILITIES[number]
type ProductShopLinkSourceType = typeof PRODUCT_SHOP_LINK_SOURCE_TYPES[number]
type IngredientAdminTaskKey = typeof INGREDIENT_ADMIN_TASK_KEYS[number]
type IngredientAdminTaskStatus = typeof INGREDIENT_ADMIN_TASK_STATUSES[number]
type IngredientProductRecommendationSlot = typeof INGREDIENT_PRODUCT_RECOMMENDATION_SLOTS[number]
type AdminIngredientGroupKey = typeof ADMIN_INGREDIENT_GROUPS[number]['value']
type AffiliateOwnership = {
  affiliate_owner_type: AffiliateOwnerType
  affiliate_owner_user_id: number | null
  is_affiliate: number
}
const PRODUCT_QA_ISSUES = [
  'missing_image',
  'missing_shop_link',
  'missing_serving_data',
  'suspicious_price_zero_or_high',
  'missing_ingredient_rows',
  'no_affiliate_flag_on_shop_link',
] as const
const PRODUCT_LINK_REPORT_STATUSES = ['open', 'reviewed', 'closed'] as const
const ADMIN_EXPORT_ENTITIES = ['products', 'ingredients', 'user-products', 'product-qa', 'link-reports'] as const
const ADMIN_EXPORT_MAX_ROWS = 5000
type AdminExportEntity = typeof ADMIN_EXPORT_ENTITIES[number]
type AdminExportColumn = {
  key: string
  header: string
}
type AdminExportQuery = {
  columns: AdminExportColumn[]
  sql: string
  bindings: Array<string | number>
}

type LaunchCheckStatus = 'ok' | 'warning' | 'danger' | 'info' | 'unknown'
type LaunchCheckSeverity = 'info' | 'warning' | 'critical'
type LaunchCheckSource = 'db' | 'env' | 'http' | 'dns' | 'manual'

type LaunchCheck = {
  id: string
  title: string
  status: LaunchCheckStatus
  severity: LaunchCheckSeverity
  source: LaunchCheckSource
  details: string
  action?: string
  observed_count?: number
  configured?: boolean
}

type LaunchCheckSection = {
  id: string
  title: string
  checks: LaunchCheck[]
}

type LaunchCheckCountRule = {
  id: string
  title: string
  sql: string
  details: (count: number) => string
  okWhen: (count: number) => boolean
  severity: LaunchCheckSeverity
  action?: string
}

type DnsJsonResponse = {
  Status?: number
  Answer?: Array<{ name?: string; type?: number; data?: string }>
}

type AdminHealthStatus = 'ok' | 'warning' | 'critical'
type AdminHealthSeverity = 'info' | 'warning' | 'critical'

type AdminHealthMetric = {
  id: string
  label: string
  value: number
  status: AdminHealthStatus
  href?: string
}

type AdminHealthCheck = {
  id: string
  title: string
  status: AdminHealthStatus
  severity: AdminHealthSeverity
  details: string
  action?: string
  href?: string
  observed_count?: number
}

type AdminHealthSection = {
  id: string
  title: string
  checks: AdminHealthCheck[]
}

type AdminHealthCountRule = {
  id: string
  title: string
  label: string
  sql: string
  severity: AdminHealthSeverity
  okWhen: (count: number) => boolean
  details: (count: number) => string
  action?: string
  href?: string
}

type AdminAffiliateLinkHealthRollupRow = {
  total_checked_rows: number
  ok_count: number | null
  failed_count: number | null
  timeout_count: number | null
  invalid_count: number | null
  unchecked_count: number | null
  stale_count: number | null
  failed_or_timeout_count: number | null
  not_checked_products: number
}

type AdminAffiliateLinkHealthRollup = {
  section: AdminHealthSection
  metrics: AdminHealthMetric[]
}

type AdminSearchResultType = 'ingredient' | 'product' | 'user_product' | 'knowledge' | 'route'

type AdminSearchResult = {
  id: string
  type: AdminSearchResultType
  title: string
  subtitle?: string
  href: string
}

type AdminSearchRoute = AdminSearchResult & {
  keywords: string
}

type AdminIngredientSearchRow = {
  id: number
  name: string
  unit: string | null
  description: string | null
}

type AdminProductSearchRow = {
  id: number
  name: string
  brand: string | null
  form: string | null
  moderation_status: string | null
  visibility: string | null
}

type AdminUserProductSearchRow = {
  id: number
  name: string
  brand: string | null
  form: string | null
  status: string | null
  user_email: string | null
}

type AdminKnowledgeSearchRow = {
  slug: string
  title: string
  summary: string | null
  status: string | null
}

type PubMedLookupQuery = {
  pmid?: string
  doi?: string
}

type PubMedLookup = {
  pmid: string
  doi?: string
  title: string
  journal?: string
  source_url: string
  source_date?: string
  authors?: string[]
  source_kind: 'study'
  organization: 'PubMed'
  country: null
  region: null
  study_type: null
  evidence_quality: null
  notes?: string
}

type PubMedFetchResult = ValidationResult<unknown>
type PubMedLookupCachePayload = {
  lookup: PubMedLookup
}

const ADMIN_SEARCH_DEFAULT_LIMIT = 12
const ADMIN_SEARCH_MAX_LIMIT = 20
const PUBMED_LOOKUP_TIMEOUT_MS = 5000
const PUBMED_AUTHOR_LIMIT = 25
const PUBMED_LOOKUP_CACHE_TTL_SECONDS = 24 * 60 * 60
const AFFILIATE_LINK_HEALTH_STALE_DAYS = 7
const ADMIN_MANAGED_LIST_KEYS = ['serving_unit'] as const

type AdminManagedListKey = (typeof ADMIN_MANAGED_LIST_KEYS)[number]

const ADMIN_SEARCH_ROUTES: AdminSearchRoute[] = [
  {
    id: 'route:dashboard',
    type: 'route',
    title: 'Dashboard',
    subtitle: 'Admin-Uebersicht und operative Kennzahlen',
    href: '/administrator/dashboard',
    keywords: 'dashboard uebersicht admin start',
  },
  {
    id: 'route:ingredients',
    type: 'route',
    title: 'Wirkstoffe',
    subtitle: 'Wirkstoff-Recherche, Profile und Quellen',
    href: '/administrator/ingredients',
    keywords: 'wirkstoffe ingredients research wirkstoff recherche',
  },
  {
    id: 'route:products',
    type: 'route',
    title: 'Produkte',
    subtitle: 'Katalogprodukte und Affiliate-Daten',
    href: '/administrator/products',
    keywords: 'produkte products katalog affiliate',
  },
  {
    id: 'route:user-products',
    type: 'route',
    title: 'User-Produkte',
    subtitle: 'Nutzer-Einreichungen moderieren',
    href: '/administrator/user-products',
    keywords: 'user produkte submissions einreichungen moderation',
  },
  {
    id: 'route:product-qa',
    type: 'route',
    title: 'Produkt-QA',
    subtitle: 'Produktdaten pruefen und korrigieren',
    href: '/administrator/product-qa',
    keywords: 'produkt qa quality daten pruefen',
  },
  {
    id: 'route:link-reports',
    type: 'route',
    title: 'Linkmeldungen',
    subtitle: 'Gemeldete fehlende oder defekte Shop-Links',
    href: '/administrator/link-reports',
    keywords: 'linkmeldungen links reports shop broken defekt',
  },
  {
    id: 'route:health',
    type: 'route',
    title: 'Health',
    subtitle: 'Admin-Systemzustand und offene Checks',
    href: '/administrator/health',
    keywords: 'health system checks status',
  },
  {
    id: 'route:translations',
    type: 'route',
    title: 'Uebersetzungen',
    subtitle: 'i18n-Inhalte und Sprachstatus',
    href: '/administrator/translations',
    keywords: 'uebersetzungen translations i18n sprache language',
  },
  {
    id: 'route:management',
    type: 'route',
    title: 'Verwaltung',
    subtitle: 'Zentrale Admin-Listen und Einheiten',
    href: '/administrator/management',
    keywords: 'verwaltung einheiten units serving unit config',
  },
]

const SENSITIVE_AUDIT_KEY_PARTS = [
  'password',
  'token',
  'secret',
  'authorization',
  'cookie',
  'jwt',
  'api_key',
  'apikey',
  'smtp',
]

function normalizeTranslationLanguage(value: string | undefined): string | null {
  if (!value) return null
  const normalized = value.trim().toLowerCase().replace(/_/g, '-')
  if (!/^[a-z]{2}(?:-[a-z]{2})?$/.test(normalized)) return null
  return normalized
}

function parsePagination(value: string | undefined, fallback: number, max: number): number {
  const parsed = Number(value)
  if (!Number.isFinite(parsed) || parsed < 0) return fallback
  return Math.min(Math.floor(parsed), max)
}

function parseAdminSearchLimit(value: string | undefined): number {
  const parsed = Number(value)
  if (!Number.isFinite(parsed) || parsed <= 0) return ADMIN_SEARCH_DEFAULT_LIMIT
  return Math.min(Math.floor(parsed), ADMIN_SEARCH_MAX_LIMIT)
}

function escapeAdminSearchLike(value: string): string {
  return value.replace(/[\\%_]/g, (char) => `\\${char}`)
}

function adminSearchLike(query: string): string {
  return `%${escapeAdminSearchLike(query)}%`
}

function adminSearchSubtitle(parts: Array<string | null | undefined>): string | undefined {
  const subtitle = parts
    .map((part) => part?.trim())
    .filter((part): part is string => Boolean(part))
    .join(' - ')
  return subtitle || undefined
}

function adminSearchPreview(value: string | null | undefined, maxLength = 90): string | null {
  if (!value) return null
  const normalized = value.replace(/\s+/g, ' ').trim()
  if (!normalized) return null
  return normalized.length > maxLength ? `${normalized.slice(0, maxLength - 1)}...` : normalized
}

function isAdminExportEntity(value: string): value is AdminExportEntity {
  return (ADMIN_EXPORT_ENTITIES as readonly string[]).includes(value)
}

function rowsToCsv(columns: AdminExportColumn[], rows: Array<Record<string, unknown>>): string {
  const lines = [
    columns.map((column) => csvEscape(column.header)).join(','),
    ...rows.map((row) => columns.map((column) => csvEscape(row[column.key])).join(',')),
  ]
  return lines.join('\r\n')
}

function csvAttachmentFilename(entity: AdminExportEntity): string {
  const date = new Date().toISOString().slice(0, 10)
  return `supplement-stack-${entity}-${date}.csv`
}

function buildAdminExportQuery(entity: AdminExportEntity, query: {
  q: string
  status: string
  issue: string
}): ValidationResult<AdminExportQuery> {
  const q = query.q.trim()
  const statusParam = query.status.trim()
  const issueParam = query.issue.trim()

  if (entity === 'products') {
    const where: string[] = []
    const bindings: Array<string | number> = []
    if (q) {
      const like = `%${q}%`
      where.push(`(
        p.name LIKE ?
        OR COALESCE(p.brand, '') LIKE ?
        OR COALESCE(p.form, '') LIKE ?
        OR COALESCE(p.shop_link, '') LIKE ?
        OR CAST(p.id AS TEXT) LIKE ?
      )`)
      bindings.push(like, like, like, like, like)
    }
    const whereSql = where.length > 0 ? `WHERE ${where.join(' AND ')}` : ''
    return {
      ok: true,
      value: {
        columns: [
          { key: 'id', header: 'id' },
          { key: 'name', header: 'name' },
          { key: 'brand', header: 'brand' },
          { key: 'form', header: 'form' },
          { key: 'price', header: 'price' },
          { key: 'shop_link', header: 'shop_link' },
          { key: 'is_affiliate', header: 'is_affiliate' },
          { key: 'affiliate_owner_type', header: 'affiliate_owner_type' },
          { key: 'serving_size', header: 'serving_size' },
          { key: 'serving_unit', header: 'serving_unit' },
          { key: 'servings_per_container', header: 'servings_per_container' },
          { key: 'container_count', header: 'container_count' },
          { key: 'moderation_status', header: 'moderation_status' },
          { key: 'visibility', header: 'visibility' },
          { key: 'discontinued_at', header: 'discontinued_at' },
          { key: 'created_at', header: 'created_at' },
        ],
        sql: `
          SELECT
            p.id,
            p.name,
            p.brand,
            p.form,
            p.price,
            p.shop_link,
            COALESCE(p.is_affiliate, 0) AS is_affiliate,
            COALESCE(
              p.affiliate_owner_type,
              CASE WHEN COALESCE(p.is_affiliate, 0) = 1 THEN 'nick' ELSE 'none' END
            ) AS affiliate_owner_type,
            p.serving_size,
            p.serving_unit,
            p.servings_per_container,
            p.container_count,
            p.moderation_status,
            p.visibility,
            p.discontinued_at,
            p.created_at
          FROM products p
          ${whereSql}
          ORDER BY p.created_at DESC, p.id DESC
          LIMIT ?
        `,
        bindings: [...bindings, ADMIN_EXPORT_MAX_ROWS],
      },
    }
  }

  if (entity === 'ingredients') {
    const where: string[] = []
    const bindings: Array<string | number> = []
    if (q) {
      const like = `%${q}%`
      where.push(`(
        i.name LIKE ?
        OR COALESCE(i.unit, '') LIKE ?
        OR COALESCE(i.category, '') LIKE ?
        OR CAST(i.id AS TEXT) LIKE ?
      )`)
      bindings.push(like, like, like, like)
    }
    const whereSql = where.length > 0 ? `WHERE ${where.join(' AND ')}` : ''
    return {
      ok: true,
      value: {
        columns: [
          { key: 'id', header: 'id' },
          { key: 'name', header: 'name' },
          { key: 'unit', header: 'unit' },
          { key: 'category', header: 'category' },
          { key: 'research_status', header: 'research_status' },
          { key: 'calculation_status', header: 'calculation_status' },
          { key: 'product_count', header: 'product_count' },
          { key: 'dose_recommendation_count', header: 'dose_recommendation_count' },
          { key: 'warning_count', header: 'warning_count' },
          { key: 'created_at', header: 'created_at' },
        ],
        sql: `
          SELECT
            i.id,
            i.name,
            i.unit,
            i.category,
            COALESCE(rs.research_status, 'unreviewed') AS research_status,
            COALESCE(rs.calculation_status, 'not_started') AS calculation_status,
            COALESCE(product_counts.product_count, 0) AS product_count,
            COALESCE(dose_counts.dose_recommendation_count, 0) AS dose_recommendation_count,
            COALESCE(warning_counts.warning_count, 0) AS warning_count,
            i.created_at
          FROM ingredients i
          LEFT JOIN ingredient_research_status rs ON rs.ingredient_id = i.id
          LEFT JOIN (
            SELECT ingredient_id, COUNT(DISTINCT product_id) AS product_count
            FROM product_ingredients
            GROUP BY ingredient_id
          ) product_counts ON product_counts.ingredient_id = i.id
          LEFT JOIN (
            SELECT ingredient_id, COUNT(*) AS dose_recommendation_count
            FROM dose_recommendations
            GROUP BY ingredient_id
          ) dose_counts ON dose_counts.ingredient_id = i.id
          LEFT JOIN (
            SELECT ingredient_id, COUNT(*) AS warning_count
            FROM ingredient_safety_warnings
            WHERE active = 1
            GROUP BY ingredient_id
          ) warning_counts ON warning_counts.ingredient_id = i.id
          ${whereSql}
          ORDER BY COALESCE(i.category, '') ASC, i.name ASC, i.id ASC
          LIMIT ?
        `,
        bindings: [...bindings, ADMIN_EXPORT_MAX_ROWS],
      },
    }
  }

  if (entity === 'user-products') {
    const where: string[] = []
    const bindings: Array<string | number> = []
    if (statusParam && statusParam !== 'all') {
      if (!['pending', 'approved', 'rejected', 'blocked'].includes(statusParam)) {
        return validationError('status must be one of pending, approved, rejected, blocked, all')
      }
      where.push('up.status = ?')
      bindings.push(statusParam)
    }
    if (q) {
      const like = `%${q}%`
      where.push(`(
        up.name LIKE ?
        OR COALESCE(up.brand, '') LIKE ?
        OR COALESCE(up.form, '') LIKE ?
        OR COALESCE(up.shop_link, '') LIKE ?
        OR COALESCE(u.email, '') LIKE ?
        OR CAST(up.id AS TEXT) LIKE ?
      )`)
      bindings.push(like, like, like, like, like, like)
    }
    const whereSql = where.length > 0 ? `WHERE ${where.join(' AND ')}` : ''
    return {
      ok: true,
      value: {
        columns: [
          { key: 'id', header: 'id' },
          { key: 'name', header: 'name' },
          { key: 'brand', header: 'brand' },
          { key: 'form', header: 'form' },
          { key: 'price', header: 'price' },
          { key: 'shop_link', header: 'shop_link' },
          { key: 'is_affiliate', header: 'is_affiliate' },
          { key: 'serving_size', header: 'serving_size' },
          { key: 'serving_unit', header: 'serving_unit' },
          { key: 'servings_per_container', header: 'servings_per_container' },
          { key: 'container_count', header: 'container_count' },
          { key: 'status', header: 'status' },
          { key: 'approved_at', header: 'approved_at' },
          { key: 'published_product_id', header: 'published_product_id' },
          { key: 'published_at', header: 'published_at' },
          { key: 'user_email', header: 'user_email' },
          { key: 'user_is_trusted_product_submitter', header: 'user_is_trusted_product_submitter' },
          { key: 'created_at', header: 'created_at' },
        ],
        sql: `
          SELECT
            up.id,
            up.name,
            up.brand,
            up.form,
            up.price,
            up.shop_link,
            COALESCE(up.is_affiliate, 0) AS is_affiliate,
            up.serving_size,
            up.serving_unit,
            up.servings_per_container,
            up.container_count,
            up.status,
            up.approved_at,
            up.published_product_id,
            up.published_at,
            u.email AS user_email,
            COALESCE(u.is_trusted_product_submitter, 0) AS user_is_trusted_product_submitter,
            up.created_at
          FROM user_products up
          LEFT JOIN users u ON up.user_id = u.id
          ${whereSql}
          ORDER BY up.created_at DESC, up.id DESC
          LIMIT ?
        `,
        bindings: [...bindings, ADMIN_EXPORT_MAX_ROWS],
      },
    }
  }

  if (entity === 'product-qa') {
    const where: string[] = []
    const bindings: Array<string | number> = []
    const issue = issueParam && issueParam !== 'all' ? enumValue(issueParam, PRODUCT_QA_ISSUES) : null
    if (issueParam && issueParam !== 'all' && !issue) {
      return validationError(`issue must be one of ${PRODUCT_QA_ISSUES.join(', ')}, all`)
    }
    if (q) {
      const like = `%${q}%`
      where.push('(name LIKE ? OR COALESCE(brand, \'\') LIKE ? OR COALESCE(form, \'\') LIKE ?)')
      bindings.push(like, like, like)
    }
    if (issue) {
      where.push(`${issue} = 1`)
    }
    const whereSql = where.length > 0 ? `WHERE ${where.join(' AND ')}` : ''
    return {
      ok: true,
      value: {
        columns: [
          { key: 'id', header: 'id' },
          { key: 'name', header: 'name' },
          { key: 'brand', header: 'brand' },
          { key: 'form', header: 'form' },
          { key: 'price', header: 'price' },
          { key: 'shop_link', header: 'shop_link' },
          { key: 'is_affiliate', header: 'is_affiliate' },
          { key: 'affiliate_owner_type', header: 'affiliate_owner_type' },
          { key: 'serving_size', header: 'serving_size' },
          { key: 'serving_unit', header: 'serving_unit' },
          { key: 'servings_per_container', header: 'servings_per_container' },
          { key: 'container_count', header: 'container_count' },
          { key: 'moderation_status', header: 'moderation_status' },
          { key: 'visibility', header: 'visibility' },
          { key: 'ingredient_count', header: 'ingredient_count' },
          { key: 'main_ingredient_count', header: 'main_ingredient_count' },
          { key: 'missing_image', header: 'missing_image' },
          { key: 'missing_shop_link', header: 'missing_shop_link' },
          { key: 'missing_serving_data', header: 'missing_serving_data' },
          { key: 'suspicious_price_zero_or_high', header: 'suspicious_price_zero_or_high' },
          { key: 'missing_ingredient_rows', header: 'missing_ingredient_rows' },
          { key: 'no_affiliate_flag_on_shop_link', header: 'no_affiliate_flag_on_shop_link' },
          { key: 'created_at', header: 'created_at' },
        ],
        sql: `
          WITH ingredient_counts AS (
            SELECT
              product_id,
              COUNT(*) AS ingredient_count,
              SUM(CASE WHEN is_main = 1 THEN 1 ELSE 0 END) AS main_ingredient_count
            FROM product_ingredients
            GROUP BY product_id
          ),
          qa AS (
            SELECT
              p.id,
              p.name,
              p.brand,
              p.form,
              p.price,
              p.shop_link,
              COALESCE(p.is_affiliate, 0) AS is_affiliate,
              COALESCE(
                p.affiliate_owner_type,
                CASE WHEN COALESCE(p.is_affiliate, 0) = 1 THEN 'nick' ELSE 'none' END
              ) AS affiliate_owner_type,
              p.serving_size,
              p.serving_unit,
              p.servings_per_container,
              p.container_count,
              p.moderation_status,
              p.visibility,
              p.created_at,
              COALESCE(ic.ingredient_count, 0) AS ingredient_count,
              COALESCE(ic.main_ingredient_count, 0) AS main_ingredient_count,
              CASE WHEN COALESCE(p.image_url, '') = '' AND COALESCE(p.image_r2_key, '') = '' THEN 1 ELSE 0 END AS missing_image,
              CASE WHEN COALESCE(p.shop_link, '') = '' THEN 1 ELSE 0 END AS missing_shop_link,
              CASE
                WHEN p.serving_size IS NULL
                  OR p.serving_size <= 0
                  OR COALESCE(p.serving_unit, '') = ''
                  OR p.servings_per_container IS NULL
                  OR p.servings_per_container <= 0
                  OR p.container_count IS NULL
                  OR p.container_count <= 0
                THEN 1 ELSE 0
              END AS missing_serving_data,
              CASE WHEN p.price <= 0 OR p.price > 300 THEN 1 ELSE 0 END AS suspicious_price_zero_or_high,
              CASE WHEN COALESCE(ic.ingredient_count, 0) = 0 THEN 1 ELSE 0 END AS missing_ingredient_rows,
              CASE
                WHEN COALESCE(p.shop_link, '') <> ''
                  AND COALESCE(p.affiliate_owner_type, '') = ''
                THEN 1 ELSE 0
              END AS no_affiliate_flag_on_shop_link
            FROM products p
            LEFT JOIN ingredient_counts ic ON ic.product_id = p.id
          )
          SELECT *
          FROM qa
          ${whereSql}
          ORDER BY
            missing_image DESC,
            missing_shop_link DESC,
            missing_serving_data DESC,
            suspicious_price_zero_or_high DESC,
            missing_ingredient_rows DESC,
            no_affiliate_flag_on_shop_link DESC,
            created_at DESC,
            id DESC
          LIMIT ?
        `,
        bindings: [...bindings, ADMIN_EXPORT_MAX_ROWS],
      },
    }
  }

  const where: string[] = []
  const bindings: Array<string | number> = []
  const status = statusParam && statusParam !== 'all' ? enumValue(statusParam, PRODUCT_LINK_REPORT_STATUSES) : null
  if (statusParam && statusParam !== 'all' && !status) {
    return validationError(`status must be one of ${PRODUCT_LINK_REPORT_STATUSES.join(', ')}, all`)
  }
  if (status) {
    where.push('r.status = ?')
    bindings.push(status)
  }
  if (q) {
    const like = `%${q}%`
    where.push(`(
      COALESCE(r.product_name, '') LIKE ?
      OR COALESCE(u.email, '') LIKE ?
      OR COALESCE(s.name, '') LIKE ?
      OR COALESCE(r.shop_link_snapshot, '') LIKE ?
      OR COALESCE(p.shop_link, '') LIKE ?
      OR COALESCE(up.shop_link, '') LIKE ?
    )`)
    bindings.push(like, like, like, like, like, like)
  }
  const whereSql = where.length > 0 ? `WHERE ${where.join(' AND ')}` : ''
  return {
    ok: true,
    value: {
      columns: [
        { key: 'id', header: 'id' },
        { key: 'user_email', header: 'user_email' },
        { key: 'stack_id', header: 'stack_id' },
        { key: 'stack_name', header: 'stack_name' },
        { key: 'product_type', header: 'product_type' },
        { key: 'product_id', header: 'product_id' },
        { key: 'product_name', header: 'product_name' },
        { key: 'shop_link_snapshot', header: 'shop_link_snapshot' },
        { key: 'current_shop_link', header: 'current_shop_link' },
        { key: 'reason', header: 'reason' },
        { key: 'status', header: 'status' },
        { key: 'created_at', header: 'created_at' },
      ],
      sql: `
        SELECT
          r.id,
          u.email AS user_email,
          r.stack_id,
          s.name AS stack_name,
          r.product_type,
          r.product_id,
          r.product_name,
          r.shop_link_snapshot,
          CASE
            WHEN r.product_type = 'catalog' THEN p.shop_link
            ELSE up.shop_link
          END AS current_shop_link,
          r.reason,
          r.status,
          r.created_at
        FROM product_link_reports r
        LEFT JOIN users u ON u.id = r.user_id
        LEFT JOIN stacks s ON s.id = r.stack_id
        LEFT JOIN products p ON r.product_type = 'catalog' AND p.id = r.product_id
        LEFT JOIN user_products up ON r.product_type = 'user_product' AND up.id = r.product_id
        ${whereSql}
        ORDER BY
          CASE r.status WHEN 'open' THEN 0 WHEN 'reviewed' THEN 1 ELSE 2 END,
          r.created_at ASC,
          r.id ASC
        LIMIT ?
      `,
      bindings: [...bindings, ADMIN_EXPORT_MAX_ROWS],
    },
  }
}

function adminRouteSearchResults(query: string): AdminSearchResult[] {
  const normalized = query.trim().toLowerCase()
  const routes = normalized.length < 2
    ? ADMIN_SEARCH_ROUTES
    : ADMIN_SEARCH_ROUTES.filter((route) => {
        const haystack = `${route.title} ${route.subtitle ?? ''} ${route.href} ${route.keywords}`.toLowerCase()
        return haystack.includes(normalized)
      })

  return routes.map(({ keywords: _keywords, ...route }) => route)
}

function optionalText(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

function parseBooleanFilter(value: string | undefined): boolean | null | undefined {
  if (value === undefined || value.trim() === '') return undefined
  const normalized = value.trim().toLowerCase()
  if (['1', 'true', 'yes', 'ja'].includes(normalized)) return true
  if (['0', 'false', 'no', 'nein'].includes(normalized)) return false
  return null
}

function parseBooleanMutation(value: unknown): boolean | null {
  if (value === true || value === 1) return true
  if (value === false || value === 0) return false
  if (typeof value === 'string') {
    const parsed = parseBooleanFilter(value)
    return parsed === undefined ? null : parsed
  }
  return null
}

function parsePositiveId(value: string): number | null {
  const parsed = Number(value)
  if (!Number.isInteger(parsed) || parsed <= 0) return null
  return parsed
}

function hasOwnKey(data: Record<string, unknown>, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(data, key)
}

function envFlagConfigured(value: unknown): boolean {
  if (typeof value === 'string') return value.trim().length > 0
  return value !== undefined && value !== null
}

function launchCheckStatus(ok: boolean, severity: LaunchCheckSeverity): LaunchCheckStatus {
  if (ok) return 'ok'
  return severity === 'critical' ? 'danger' : 'warning'
}

async function runLaunchCountCheck(db: D1Database, rule: LaunchCheckCountRule): Promise<LaunchCheck> {
  try {
    const row = await db.prepare(rule.sql).first<CountRow>()
    const count = row?.count ?? 0
    const ok = rule.okWhen(count)
    return {
      id: rule.id,
      title: rule.title,
      status: launchCheckStatus(ok, rule.severity),
      severity: rule.severity,
      source: 'db',
      details: rule.details(count),
      action: ok ? undefined : rule.action,
      observed_count: count,
    }
  } catch {
    return {
      id: rule.id,
      title: rule.title,
      status: 'danger',
      severity: 'critical',
      source: 'db',
      details: 'Datenbank-Check konnte nicht ausgefuehrt werden.',
      action: 'Schema, Migrationen und D1-Bindung pruefen.',
    }
  }
}

function buildLaunchEnvChecks(env: AppContext['Bindings']): LaunchCheck[] {
  const flags: Array<{
    id: string
    title: string
    value: unknown
    severity: LaunchCheckSeverity
    details: string
    action: string
  }> = [
    {
      id: 'env-jwt-secret',
      title: 'JWT Secret',
      value: env.JWT_SECRET,
      severity: 'critical',
      details: 'Session-Signatur ist als Secret-Binding konfiguriert.',
      action: 'JWT_SECRET als Cloudflare Pages Secret setzen.',
    },
    {
      id: 'env-frontend-url',
      title: 'Frontend URL',
      value: env.FRONTEND_URL,
      severity: 'warning',
      details: 'Canonical Frontend-URL ist konfiguriert.',
      action: 'FRONTEND_URL fuer Live-Domain setzen.',
    },
    {
      id: 'env-smtp-host',
      title: 'SMTP Host',
      value: env.SMTP_HOST,
      severity: 'warning',
      details: 'SMTP-Host ist vorhanden.',
      action: 'SMTP_HOST in der Pages-Umgebung setzen.',
    },
    {
      id: 'env-smtp-username',
      title: 'SMTP Username',
      value: env.SMTP_USERNAME,
      severity: 'warning',
      details: 'SMTP-Benutzer ist vorhanden.',
      action: 'SMTP_USERNAME in der Pages-Umgebung setzen.',
    },
    {
      id: 'env-smtp-password',
      title: 'SMTP Password',
      value: env.SMTP_PASSWORD,
      severity: 'critical',
      details: 'SMTP-Passwort ist als Secret-Binding vorhanden.',
      action: 'SMTP_PASSWORD als Cloudflare Pages Secret setzen.',
    },
    {
      id: 'env-smtp-from-email',
      title: 'SMTP From Email',
      value: env.SMTP_FROM_EMAIL,
      severity: 'warning',
      details: 'Absenderadresse ist konfiguriert.',
      action: 'SMTP_FROM_EMAIL fuer ausgehende Mails setzen.',
    },
    {
      id: 'env-rate-limiter',
      title: 'Rate Limiter KV',
      value: env.RATE_LIMITER,
      severity: 'warning',
      details: 'Rate-Limiter KV-Binding ist vorhanden.',
      action: 'RATE_LIMITER KV-Binding fuer Produktionsschutz verbinden.',
    },
    {
      id: 'env-product-images',
      title: 'Product Images R2',
      value: env.PRODUCT_IMAGES,
      severity: 'warning',
      details: 'Produktbild-R2-Bucket ist verbunden.',
      action: 'PRODUCT_IMAGES R2-Binding fuer Bilduploads verbinden.',
    },
  ]

  return flags.map((flag) => {
    const configured = envFlagConfigured(flag.value)
    return {
      id: flag.id,
      title: flag.title,
      status: launchCheckStatus(configured, flag.severity),
      severity: flag.severity,
      source: 'env',
      details: configured ? flag.details : 'Nicht konfiguriert.',
      action: configured ? undefined : flag.action,
      configured,
    }
  })
}

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs: number): Promise<Response> {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs)
  try {
    return await fetch(url, { ...init, signal: controller.signal })
  } finally {
    clearTimeout(timeoutId)
  }
}

function normalizePubMedLookupQuery(rawPmid: string | undefined, rawDoi: string | undefined): ValidationResult<PubMedLookupQuery> {
  const pmid = rawPmid?.trim() ?? ''
  const doi = rawDoi?.trim() ?? ''
  const hasPmid = pmid.length > 0
  const hasDoi = doi.length > 0

  if (hasPmid === hasDoi) return validationError('Provide exactly one of pmid or doi')
  if (hasPmid) {
    if (!/^[1-9][0-9]{0,9}$/.test(pmid)) return validationError('pmid must be numeric')
    return { ok: true, value: { pmid } }
  }

  if (doi.length < 6 || doi.length > 255) return validationError('doi must be between 6 and 255 characters')
  if (!/^10\.[0-9]{4,9}\/[A-Z0-9._;()/:+-]+$/i.test(doi)) {
    return validationError('doi must be a valid DOI string')
  }
  return { ok: true, value: { doi } }
}

function pubMedESummaryUrl(pmid: string): string {
  const url = new URL('https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi')
  url.searchParams.set('db', 'pubmed')
  url.searchParams.set('id', pmid)
  url.searchParams.set('retmode', 'json')
  return url.toString()
}

function pubMedESearchDoiUrl(doi: string): string {
  const url = new URL('https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi')
  url.searchParams.set('db', 'pubmed')
  url.searchParams.set('term', `${doi}[AID]`)
  url.searchParams.set('retmode', 'json')
  url.searchParams.set('retmax', '1')
  return url.toString()
}

function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === 'AbortError'
}

async function fetchPubMedJson(url: string): Promise<PubMedFetchResult> {
  let response: Response
  try {
    response = await fetchWithTimeout(url, { headers: { accept: 'application/json' } }, PUBMED_LOOKUP_TIMEOUT_MS)
  } catch (error) {
    return validationError(isAbortError(error) ? 'PubMed lookup timed out' : 'PubMed lookup failed upstream', 502)
  }

  if (!response.ok) return validationError('PubMed lookup failed upstream', 502)

  try {
    const body: unknown = await response.json()
    return { ok: true, value: body }
  } catch {
    return validationError('PubMed lookup failed upstream', 502)
  }
}

function asJsonRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null
}

function jsonStringField(record: Record<string, unknown>, key: string): string | undefined {
  const value = record[key]
  if (typeof value !== 'string') return undefined
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : undefined
}

function jsonRecordArrayField(record: Record<string, unknown>, key: string): Array<Record<string, unknown>> {
  const value = record[key]
  if (!Array.isArray(value)) return []
  return value.map(asJsonRecord).filter((entry): entry is Record<string, unknown> => entry !== null)
}

function pubMedESearchFirstPmid(body: unknown): string | null {
  const root = asJsonRecord(body)
  const esearch = root ? asJsonRecord(root.esearchresult) : null
  const idlist = esearch?.idlist
  if (!Array.isArray(idlist)) return null
  const first = idlist.find((value) => typeof value === 'string' && /^[1-9][0-9]{0,9}$/.test(value))
  return typeof first === 'string' ? first : null
}

function pubMedESummaryRecord(body: unknown, requestedPmid: string): Record<string, unknown> | null {
  const root = asJsonRecord(body)
  const result = root ? asJsonRecord(root.result) : null
  if (!result) return null

  const requestedRecord = asJsonRecord(result[requestedPmid])
  if (requestedRecord && !jsonStringField(requestedRecord, 'error')) return requestedRecord

  const uids = result.uids
  if (!Array.isArray(uids)) return null
  for (const uid of uids) {
    if (typeof uid !== 'string') continue
    const record = asJsonRecord(result[uid])
    if (record && !jsonStringField(record, 'error')) return record
  }
  return null
}

function pubMedArticleId(record: Record<string, unknown>, idType: string): string | undefined {
  for (const item of jsonRecordArrayField(record, 'articleids')) {
    const currentType = jsonStringField(item, 'idtype')?.toLowerCase()
    const value = jsonStringField(item, 'value')
    if (currentType === idType && value) return value
  }
  return undefined
}

function pubMedAuthors(record: Record<string, unknown>): { authors: string[]; truncated: boolean } {
  const names = jsonRecordArrayField(record, 'authors')
    .map((author) => jsonStringField(author, 'name'))
    .filter((name): name is string => Boolean(name))
  return {
    authors: names.slice(0, PUBMED_AUTHOR_LIMIT),
    truncated: names.length > PUBMED_AUTHOR_LIMIT,
  }
}

function pubMedLookupFromSummary(record: Record<string, unknown>, fallbackPmid: string, fallbackDoi?: string): PubMedLookup | null {
  const pmid = pubMedArticleId(record, 'pubmed') ?? jsonStringField(record, 'uid') ?? fallbackPmid
  if (!/^[1-9][0-9]{0,9}$/.test(pmid)) return null

  const title = jsonStringField(record, 'title')
  if (!title) return null

  const journal = jsonStringField(record, 'fulljournalname') ?? jsonStringField(record, 'source')
  const sourceDate = jsonStringField(record, 'pubdate')
  const doi = pubMedArticleId(record, 'doi') ?? fallbackDoi
  const authorResult = pubMedAuthors(record)

  return {
    pmid,
    ...(doi ? { doi } : {}),
    title,
    ...(journal ? { journal } : {}),
    source_url: `https://pubmed.ncbi.nlm.nih.gov/${pmid}/`,
    ...(sourceDate ? { source_date: sourceDate } : {}),
    ...(authorResult.authors.length > 0 ? { authors: authorResult.authors } : {}),
    source_kind: 'study',
    organization: 'PubMed',
    country: null,
    region: null,
    study_type: null,
    evidence_quality: null,
    ...(authorResult.truncated ? { notes: `Author list truncated to ${PUBMED_AUTHOR_LIMIT} names.` } : {}),
  }
}

function normalizedPubMedDoiCachePart(doi: string): string {
  return doi.trim().toLowerCase()
}

function pubMedLookupCacheKeyForPmid(pmid: string): string {
  return `admin:pubmed:pmid:${pmid}`
}

function pubMedLookupCacheKeyForQuery(query: PubMedLookupQuery): string {
  if (query.pmid) return pubMedLookupCacheKeyForPmid(query.pmid)
  return `admin:pubmed:doi:${normalizedPubMedDoiCachePart(query.doi ?? '')}`
}

function pubMedLookupFromCacheValue(value: unknown): PubMedLookup | null {
  const root = asJsonRecord(value)
  const record = root ? asJsonRecord(root.lookup) : null
  if (!record) return null

  const pmid = jsonStringField(record, 'pmid')
  const title = jsonStringField(record, 'title')
  const sourceUrl = jsonStringField(record, 'source_url')
  if (!pmid || !/^[1-9][0-9]{0,9}$/.test(pmid) || !title || !sourceUrl) return null

  const authorsValue = record.authors
  const authors = Array.isArray(authorsValue)
    ? authorsValue
        .filter((author): author is string => typeof author === 'string' && author.trim().length > 0)
        .map((author) => author.trim())
        .slice(0, PUBMED_AUTHOR_LIMIT)
    : []

  const doi = jsonStringField(record, 'doi')
  const journal = jsonStringField(record, 'journal')
  const sourceDate = jsonStringField(record, 'source_date')
  const notes = jsonStringField(record, 'notes')

  return {
    pmid,
    ...(doi ? { doi } : {}),
    title,
    ...(journal ? { journal } : {}),
    source_url: sourceUrl,
    ...(sourceDate ? { source_date: sourceDate } : {}),
    ...(authors.length > 0 ? { authors } : {}),
    source_kind: 'study',
    organization: 'PubMed',
    country: null,
    region: null,
    study_type: null,
    evidence_quality: null,
    ...(notes ? { notes } : {}),
  }
}

async function readPubMedLookupCache(kv: KVNamespace | undefined, cacheKey: string): Promise<PubMedLookup | null> {
  if (!kv) return null
  try {
    const cached = await kv.get(cacheKey)
    if (!cached) return null
    return pubMedLookupFromCacheValue(JSON.parse(cached) as unknown)
  } catch {
    return null
  }
}

async function writePubMedLookupCache(
  kv: KVNamespace | undefined,
  cacheKey: string,
  lookup: PubMedLookup,
): Promise<void> {
  if (!kv) return
  const payload: PubMedLookupCachePayload = { lookup }
  try {
    await kv.put(cacheKey, JSON.stringify(payload), { expirationTtl: PUBMED_LOOKUP_CACHE_TTL_SECONDS })
  } catch {
    // Cache errors must not block the live PubMed lookup path.
  }
}

function dnsJson(value: unknown): DnsJsonResponse {
  if (!value || typeof value !== 'object') return {}
  const raw = value as Record<string, unknown>
  const answers = Array.isArray(raw.Answer)
    ? raw.Answer
        .filter((entry): entry is Record<string, unknown> => Boolean(entry) && typeof entry === 'object')
        .map((entry) => ({
          name: typeof entry.name === 'string' ? entry.name : undefined,
          type: typeof entry.type === 'number' ? entry.type : undefined,
          data: typeof entry.data === 'string' ? entry.data : undefined,
        }))
    : undefined
  return {
    Status: typeof raw.Status === 'number' ? raw.Status : undefined,
    Answer: answers,
  }
}

async function runDnsPresenceCheck(id: string, title: string, name: string, type: string, matcher?: (data: string) => boolean): Promise<LaunchCheck> {
  try {
    const url = `https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(name)}&type=${encodeURIComponent(type)}`
    const response = await fetchWithTimeout(url, { headers: { accept: 'application/dns-json' } }, 2500)
    if (!response.ok) {
      return {
        id,
        title,
        status: 'unknown',
        severity: 'warning',
        source: 'dns',
        details: 'DNS-over-HTTPS Check ist nicht erreichbar.',
        action: 'DNS manuell gegen einen zweiten Resolver pruefen.',
      }
    }
    const body = dnsJson(await response.json())
    const answers = body.Answer ?? []
    const hasRecord = body.Status === 0 && answers.some((answer) => {
      if (!answer.data) return false
      return matcher ? matcher(answer.data) : true
    })
    return {
      id,
      title,
      status: hasRecord ? 'ok' : 'warning',
      severity: 'warning',
      source: 'dns',
      details: hasRecord ? 'DNS-Record ist oeffentlich auffindbar.' : 'DNS-Record wurde nicht gefunden.',
      action: hasRecord ? undefined : 'DNS-Zone und Provider-Konfiguration pruefen.',
      configured: hasRecord,
    }
  } catch {
    return {
      id,
      title,
      status: 'unknown',
      severity: 'warning',
      source: 'dns',
      details: 'DNS-Check konnte nicht stabil ausgefuehrt werden.',
      action: 'DNS manuell gegen authoritative Nameserver pruefen.',
    }
  }
}

async function runDomainReachabilityCheck(): Promise<LaunchCheck> {
  try {
    const response = await fetchWithTimeout('https://supplementstack.de', { method: 'HEAD' }, 3000)
    const ok = response.status >= 200 && response.status < 400
    return {
      id: 'domain-https-head',
      title: 'supplementstack.de HTTPS',
      status: ok ? 'ok' : 'warning',
      severity: 'warning',
      source: 'http',
      details: ok
        ? `Live-Domain antwortet per HTTPS HEAD mit HTTP ${response.status}.`
        : `Live-Domain antwortet per HTTPS HEAD mit HTTP ${response.status}.`,
      action: ok ? undefined : 'Pages Custom Domain, DNS und Functions-Deploy pruefen.',
    }
  } catch {
    return {
      id: 'domain-https-head',
      title: 'supplementstack.de HTTPS',
      status: 'unknown',
      severity: 'warning',
      source: 'http',
      details: 'Live-Domain konnte per HTTPS HEAD nicht stabil erreicht werden.',
      action: 'Domain manuell im Browser und per Cloudflare Pages pruefen.',
    }
  }
}

async function buildDomainChecks(): Promise<LaunchCheck[]> {
  const results = await Promise.all([
    runDomainReachabilityCheck(),
    runDnsPresenceCheck('dns-root-a', 'Root Domain A', 'supplementstack.de', 'A'),
    runDnsPresenceCheck('dns-spf-txt', 'SPF TXT', 'supplementstack.de', 'TXT', (data) => data.includes('v=spf1')),
    runDnsPresenceCheck('dns-dmarc-txt', 'DMARC TXT', '_dmarc.supplementstack.de', 'TXT', (data) => data.includes('v=DMARC1')),
    runDnsPresenceCheck(
      'dns-dkim-txt',
      'DKIM TXT',
      'kas202508251337._domainkey.supplementstack.de',
      'TXT',
      (data) => data.includes('v=DKIM1') || data.includes('p='),
    ),
  ])
  return results
}

function summarizeLaunchSections(sections: LaunchCheckSection[]) {
  const byStatus: Record<LaunchCheckStatus, number> = {
    ok: 0,
    warning: 0,
    danger: 0,
    info: 0,
    unknown: 0,
  }
  const bySeverity: Record<LaunchCheckSeverity, number> = {
    info: 0,
    warning: 0,
    critical: 0,
  }
  let total = 0
  for (const section of sections) {
    for (const check of section.checks) {
      total += 1
      byStatus[check.status] += 1
      bySeverity[check.severity] += 1
    }
  }
  return {
    total,
    by_status: byStatus,
    by_severity: bySeverity,
    blocking: byStatus.danger,
    needs_attention: byStatus.warning + byStatus.unknown,
  }
}

function adminHealthStatus(ok: boolean, severity: AdminHealthSeverity): AdminHealthStatus {
  if (ok) return 'ok'
  return severity === 'critical' ? 'critical' : 'warning'
}

async function runAdminHealthCountCheck(db: D1Database, rule: AdminHealthCountRule): Promise<AdminHealthCheck> {
  try {
    const row = await db.prepare(rule.sql).first<CountRow>()
    const count = row?.count ?? 0
    const ok = rule.okWhen(count)
    return {
      id: rule.id,
      title: rule.title,
      status: adminHealthStatus(ok, rule.severity),
      severity: rule.severity,
      details: rule.details(count),
      action: ok ? undefined : rule.action,
      href: rule.href,
      observed_count: count,
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown database error'
    return {
      id: rule.id,
      title: rule.title,
      status: adminHealthStatus(false, rule.severity),
      severity: rule.severity,
      details: `Check konnte nicht ausgefuehrt werden: ${message}`,
      action: 'Schema/Migrationen fuer diesen Health-Check pruefen.',
      href: rule.href,
    }
  }
}

function summarizeAdminHealthSections(sections: AdminHealthSection[]) {
  let okCount = 0
  let warningCount = 0
  let criticalCount = 0

  for (const section of sections) {
    for (const check of section.checks) {
      if (check.status === 'ok') okCount += 1
      if (check.status === 'warning') warningCount += 1
      if (check.status === 'critical') criticalCount += 1
    }
  }

  return {
    status: criticalCount > 0 ? 'critical' : warningCount > 0 ? 'warning' : 'ok',
    ok_count: okCount,
    warning_count: warningCount,
    critical_count: criticalCount,
  } satisfies {
    status: AdminHealthStatus
    ok_count: number
    warning_count: number
    critical_count: number
  }
}

function metricFromAdminHealthCheck(check: AdminHealthCheck, label: string): AdminHealthMetric {
  return {
    id: check.id,
    label,
    value: check.observed_count ?? 0,
    status: check.status,
    href: check.href,
  }
}

function adminHealthMetric(
  id: string,
  label: string,
  value: number,
  status: AdminHealthStatus,
  href?: string,
): AdminHealthMetric {
  return { id, label, value, status, href }
}

function adminHealthCount(value: number | null | undefined): number {
  return value ?? 0
}

async function getAdminAffiliateLinkHealthRollup(db: D1Database): Promise<AdminAffiliateLinkHealthRollup> {
  const href = '/administrator/products'
  const tableExists = await hasAffiliateLinkHealthTable(db)
  if (!tableExists) {
    return {
      section: {
        id: 'affiliate-link-health',
        title: 'Affiliate Link Health',
        checks: [
          {
            id: 'affiliate-link-health-table-missing',
            title: 'Affiliate-Link-Health Tabelle',
            status: 'warning',
            severity: 'info',
            details: 'Optionale Tabelle affiliate_link_health ist in dieser Umgebung nicht vorhanden.',
            action: 'Migration 0054 nur in Umgebungen anwenden, in denen Link-Health beobachtet werden soll.',
            href,
          },
        ],
      },
      metrics: [],
    }
  }

  try {
    const row = await db.prepare(`
      WITH products_with_shop_link AS (
        SELECT id
        FROM products
        WHERE trim(COALESCE(shop_link, '')) <> ''
      )
      SELECT
        COUNT(lh.product_id) AS total_checked_rows,
        COALESCE(SUM(CASE WHEN lh.status = 'ok' THEN 1 ELSE 0 END), 0) AS ok_count,
        COALESCE(SUM(CASE WHEN lh.status = 'failed' THEN 1 ELSE 0 END), 0) AS failed_count,
        COALESCE(SUM(CASE WHEN lh.status = 'timeout' THEN 1 ELSE 0 END), 0) AS timeout_count,
        COALESCE(SUM(CASE WHEN lh.status = 'invalid' THEN 1 ELSE 0 END), 0) AS invalid_count,
        COALESCE(SUM(CASE WHEN lh.status = 'unchecked' OR lh.last_checked_at IS NULL THEN 1 ELSE 0 END), 0) AS unchecked_count,
        COALESCE(SUM(
          CASE
            WHEN lh.last_checked_at IS NOT NULL
             AND datetime(lh.last_checked_at) <= datetime('now', ?)
            THEN 1
            ELSE 0
          END
        ), 0) AS stale_count,
        COALESCE(SUM(CASE WHEN lh.status IN ('failed', 'timeout') THEN 1 ELSE 0 END), 0) AS failed_or_timeout_count,
        (
          SELECT COUNT(*)
          FROM products_with_shop_link p
          LEFT JOIN affiliate_link_health missing_lh ON missing_lh.product_id = p.id
          WHERE missing_lh.product_id IS NULL
        ) AS not_checked_products
      FROM affiliate_link_health lh
    `).bind(`-${AFFILIATE_LINK_HEALTH_STALE_DAYS} days`).first<AdminAffiliateLinkHealthRollupRow>()

    const totalCheckedRows = adminHealthCount(row?.total_checked_rows)
    const okCount = adminHealthCount(row?.ok_count)
    const failedCount = adminHealthCount(row?.failed_count)
    const timeoutCount = adminHealthCount(row?.timeout_count)
    const invalidCount = adminHealthCount(row?.invalid_count)
    const uncheckedCount = adminHealthCount(row?.unchecked_count)
    const staleCount = adminHealthCount(row?.stale_count)
    const failedOrTimeoutCount = adminHealthCount(row?.failed_or_timeout_count)
    const notCheckedProducts = adminHealthCount(row?.not_checked_products)
    const uncheckedOrStaleCount = uncheckedCount + staleCount
    const brokenStatusCount = failedOrTimeoutCount + invalidCount
    const coverageGapCount = notCheckedProducts + uncheckedOrStaleCount

    const checks: AdminHealthCheck[] = []
    if (totalCheckedRows === 0) {
      checks.push({
        id: 'affiliate-link-health-no-run',
        title: 'Link-Health Lauf',
        status: 'warning',
        severity: 'info',
        details: `Noch kein Link-Health-Lauf beobachtet. ${notCheckedProducts} Produkt(e) mit Shop-Link haben noch keinen Health-Row.`,
        action: 'Maintenance Worker/Cron nach dem naechsten Lauf pruefen.',
        href,
        observed_count: totalCheckedRows,
      })
    } else {
      checks.push({
        id: 'affiliate-link-health-rollup',
        title: 'Link-Health Rollup',
        status: brokenStatusCount > 0 ? 'warning' : 'ok',
        severity: brokenStatusCount > 0 ? 'warning' : 'info',
        details: `${totalCheckedRows} Health-Row(s): ${okCount} ok, ${failedCount} failed, ${timeoutCount} timeout, ${invalidCount} invalid.`,
        action: brokenStatusCount > 0 ? 'Failed/Timeout/Invalid Links im Produktkatalog pruefen.' : undefined,
        href,
        observed_count: failedOrTimeoutCount,
      })

      checks.push({
        id: 'affiliate-link-health-coverage',
        title: 'Link-Health Abdeckung',
        status: coverageGapCount > 0 ? 'warning' : 'ok',
        severity: 'info',
        details: `${notCheckedProducts} Produkt(e) mit Shop-Link ohne Health-Row, ${uncheckedCount} unchecked, ${staleCount} stale > ${AFFILIATE_LINK_HEALTH_STALE_DAYS} Tage.`,
        action: coverageGapCount > 0 ? 'Naechsten Maintenance-Lauf beobachten oder einzelne Produktlinks pruefen.' : undefined,
        href,
        observed_count: coverageGapCount,
      })
    }

    return {
      section: {
        id: 'affiliate-link-health',
        title: 'Affiliate Link Health',
        checks,
      },
      metrics: [
        adminHealthMetric(
          'affiliate-link-health-total-checked-rows',
          'Link-Health Rows',
          totalCheckedRows,
          totalCheckedRows > 0 ? 'ok' : 'warning',
          href,
        ),
        adminHealthMetric('affiliate-link-health-ok', 'Links ok', okCount, 'ok', href),
        adminHealthMetric(
          'affiliate-link-health-failed',
          'Links failed',
          failedCount,
          failedCount > 0 ? 'warning' : 'ok',
          href,
        ),
        adminHealthMetric(
          'affiliate-link-health-timeout',
          'Links timeout',
          timeoutCount,
          timeoutCount > 0 ? 'warning' : 'ok',
          href,
        ),
        adminHealthMetric(
          'affiliate-link-health-invalid',
          'Links invalid',
          invalidCount,
          invalidCount > 0 ? 'warning' : 'ok',
          href,
        ),
        adminHealthMetric(
          'affiliate-link-health-unchecked-stale',
          'Unchecked/Stale',
          uncheckedOrStaleCount,
          uncheckedOrStaleCount > 0 ? 'warning' : 'ok',
          href,
        ),
        adminHealthMetric(
          'affiliate-link-health-not-checked-products',
          'Produkte ohne Health-Row',
          notCheckedProducts,
          notCheckedProducts > 0 ? 'warning' : 'ok',
          href,
        ),
        adminHealthMetric(
          'affiliate-link-health-failed-or-timeout',
          'Failed/Timeout',
          failedOrTimeoutCount,
          failedOrTimeoutCount > 0 ? 'warning' : 'ok',
          href,
        ),
      ],
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown database error'
    return {
      section: {
        id: 'affiliate-link-health',
        title: 'Affiliate Link Health',
        checks: [
          {
            id: 'affiliate-link-health-rollup-error',
            title: 'Link-Health Rollup',
            status: 'warning',
            severity: 'warning',
            details: `Link-Health-Rollup konnte nicht berechnet werden: ${message}`,
            action: 'affiliate_link_health Schema und Maintenance Worker pruefen.',
            href,
          },
        ],
      },
      metrics: [],
    }
  }
}

function normalizeSlug(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const slug = value.trim().toLowerCase()
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) return null
  return slug
}

function isUniqueConstraintError(error: unknown): boolean {
  return error instanceof Error && /unique|constraint/i.test(error.message)
}

function normalizeShopHostname(value: string): string | null {
  const raw = value.trim().toLowerCase()
  if (!raw) return null
  const withScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(raw) ? raw : `https://${raw}`
  try {
    const url = new URL(withScheme)
    const hostname = url.hostname.toLowerCase().replace(/\.$/, '')
    if (!hostname || hostname.includes('..')) return null
    return hostname
  } catch {
    return null
  }
}

function shopHostMatchesDomain(hostname: string, domain: string): boolean {
  return hostname === domain || hostname.endsWith(`.${domain}`)
}

function booleanFlag(value: unknown): number | undefined {
  if (value === undefined) return undefined
  if (value === true || value === 1) return 1
  if (value === false || value === 0) return 0
  return undefined
}

function parseAffiliateOwnerType(value: unknown): AffiliateOwnerType | undefined {
  if (typeof value !== 'string') return undefined
  const normalized = value.trim()
  return (AFFILIATE_OWNER_TYPES as readonly string[]).includes(normalized)
    ? normalized as AffiliateOwnerType
    : undefined
}

function normalizeAffiliateOwnership(
  body: Record<string, unknown>,
  fallback: Partial<AffiliateOwnership> = {},
): ValidationResult<AffiliateOwnership> {
  const hasOwnerType = hasOwnKey(body, 'affiliate_owner_type')
  const hasOwnerUserId = hasOwnKey(body, 'affiliate_owner_user_id')
  const hasLegacyAffiliate = hasOwnKey(body, 'is_affiliate')

  if (hasOwnerUserId && !hasOwnerType) {
    return validationError('affiliate_owner_user_id requires affiliate_owner_type')
  }

  let ownerType: AffiliateOwnerType = fallback.affiliate_owner_type ?? 'none'
  let ownerUserId: number | null = fallback.affiliate_owner_user_id ?? null

  if (hasOwnerType) {
    const parsedType = parseAffiliateOwnerType(body.affiliate_owner_type)
    if (!parsedType) return validationError(`affiliate_owner_type must be one of ${AFFILIATE_OWNER_TYPES.join(', ')}`)
    ownerType = parsedType
    const parsedUserId = optionalPositiveIntegerField(body, 'affiliate_owner_user_id')
    if (!parsedUserId.ok) return parsedUserId
    ownerUserId = parsedUserId.value ?? null
  } else if (hasLegacyAffiliate) {
    const legacyFlag = booleanFlag(body.is_affiliate)
    if (legacyFlag === undefined) return validationError('is_affiliate must be true/false or 1/0')
    ownerType = legacyFlag === 1 ? 'nick' : 'none'
    ownerUserId = null
  }

  if (ownerType === 'none' || ownerType === 'nick') {
    ownerUserId = null
  }

  if (ownerType === 'user' && ownerUserId === null) {
    return validationError('affiliate_owner_user_id is required when affiliate_owner_type is user')
  }

  return {
    ok: true,
    value: {
      affiliate_owner_type: ownerType,
      affiliate_owner_user_id: ownerUserId,
      is_affiliate: ownerType === 'none' ? 0 : 1,
    },
  }
}

async function validateAffiliateOwnerUser(db: D1Database, ownership: AffiliateOwnership): Promise<ValidationResult<AffiliateOwnership>> {
  if (ownership.affiliate_owner_type !== 'user') return { ok: true, value: ownership }
  const user = await db.prepare('SELECT id FROM users WHERE id = ?').bind(ownership.affiliate_owner_user_id).first<{ id: number }>()
  if (!user) return validationError('affiliate_owner_user_id must reference an existing user')
  return { ok: true, value: ownership }
}

function normalizeInteger(value: unknown): number | undefined {
  if (value === undefined) return undefined
  const parsed = typeof value === 'number' ? value : typeof value === 'string' && value.trim() !== '' ? Number(value) : Number.NaN
  return Number.isInteger(parsed) ? parsed : undefined
}

function validationError(error: string, status: 400 | 404 | 409 | 502 = 400): ValidationFailure {
  return { ok: false, error, status }
}

function enumValue<T extends readonly string[]>(value: unknown, allowed: T): T[number] | null {
  if (typeof value !== 'string') return null
  const normalized = value.trim()
  return (allowed as readonly string[]).includes(normalized) ? normalized as T[number] : null
}

function ingredientAdminTaskKey(value: string): IngredientAdminTaskKey | null {
  return enumValue(value, INGREDIENT_ADMIN_TASK_KEYS)
}

function ingredientAdminTaskStatus(value: unknown): IngredientAdminTaskStatus | null {
  return enumValue(value, INGREDIENT_ADMIN_TASK_STATUSES)
}

function ingredientProductRecommendationSlot(value: string): IngredientProductRecommendationSlot | null {
  return enumValue(value, INGREDIENT_PRODUCT_RECOMMENDATION_SLOTS)
}

function ingredientProductRecommendationType(slot: IngredientProductRecommendationSlot): 'recommended' | 'alternative' {
  return slot === 'primary' ? 'recommended' : 'alternative'
}

function ingredientProductRecommendationSortOrder(slot: IngredientProductRecommendationSlot): number {
  if (slot === 'primary') return 0
  if (slot === 'alternative_1') return 10
  return 20
}

function adminManagedListKey(value: string | undefined): AdminManagedListKey | null {
  if (!value) return null
  return enumValue(value, ADMIN_MANAGED_LIST_KEYS)
}

function normalizePriceCents(value: number): number {
  return Math.round(value * 100) / 100
}

function emptyIngredientProductRecommendationSlots(): Record<IngredientProductRecommendationSlot, IngredientProductRecommendationRow | null> {
  return {
    primary: null,
    alternative_1: null,
    alternative_2: null,
  }
}

function requiredTextField(data: Record<string, unknown>, key: string, maxLength: number): ValidationResult<string> {
  const value = optionalText(data[key])
  if (!value) return validationError(`${key} is required`)
  if (value.length > maxLength) return validationError(`${key} must be at most ${maxLength} characters`)
  return { ok: true, value }
}

function optionalTextField(data: Record<string, unknown>, key: string, maxLength: number): ValidationResult<string | null | undefined> {
  if (!hasOwnKey(data, key)) return { ok: true, value: undefined }
  const value = optionalText(data[key])
  if (value && value.length > maxLength) return validationError(`${key} must be at most ${maxLength} characters`)
  return { ok: true, value }
}

function optionalPositiveIntegerField(data: Record<string, unknown>, key: string): ValidationResult<number | null | undefined> {
  if (!hasOwnKey(data, key)) return { ok: true, value: undefined }
  const raw = data[key]
  if (raw === null || raw === '') return { ok: true, value: null }
  const parsed = normalizeInteger(raw)
  if (parsed === undefined || parsed <= 0) return validationError(`${key} must be a positive integer`)
  return { ok: true, value: parsed }
}

function optionalBooleanField(data: Record<string, unknown>, key: string): ValidationResult<number | undefined> {
  if (!hasOwnKey(data, key)) return { ok: true, value: undefined }
  const flag = booleanFlag(data[key])
  if (flag === undefined) return validationError(`${key} must be true/false or 1/0`)
  return { ok: true, value: flag }
}

function validateProductWarningPayload(
  body: Record<string, unknown>,
  existing: ProductWarningRow | null,
): ValidationResult<ProductWarningPayload> {
  const severity = hasOwnKey(body, 'severity')
    ? enumValue(body.severity, PRODUCT_WARNING_SEVERITIES)
    : existing?.severity && PRODUCT_WARNING_SEVERITIES.includes(existing.severity as ProductWarningSeverity)
      ? existing.severity as ProductWarningSeverity
      : null
  if (!severity) return validationError(`severity must be one of ${PRODUCT_WARNING_SEVERITIES.join(', ')}`)

  const title = hasOwnKey(body, 'title')
    ? requiredTextField(body, 'title', 255)
    : existing ? { ok: true as const, value: existing.title } : validationError('title is required')
  if (!title.ok) return title

  const message = hasOwnKey(body, 'message')
    ? requiredTextField(body, 'message', 2000)
    : existing ? { ok: true as const, value: existing.message } : validationError('message is required')
  if (!message.ok) return message

  const alternativeNote = optionalTextField(body, 'alternative_note', 2000)
  if (!alternativeNote.ok) return alternativeNote

  const active = optionalBooleanField(body, 'active')
  if (!active.ok) return active

  return {
    ok: true,
    value: {
      severity,
      title: title.value,
      message: message.value,
      alternative_note: alternativeNote.value === undefined
        ? existing?.alternative_note ?? null
        : alternativeNote.value,
      active: active.value ?? existing?.active ?? 1,
    },
  }
}

async function validateProductIngredientPayload(
  db: D1Database,
  body: Record<string, unknown>,
  existing: AdminProductIngredientRow | null,
): Promise<ValidationResult<ProductIngredientPayload>> {
  const allowedFields = new Set([
    'ingredient_id',
    'is_main',
    'quantity',
    'unit',
    'form_id',
    'basis_quantity',
    'basis_unit',
    'search_relevant',
    'parent_ingredient_id',
    'version',
  ])
  for (const key of Object.keys(body)) {
    if (!allowedFields.has(key)) return validationError(`${key} cannot be updated on product ingredient rows`)
  }

  const rawIngredientId = hasOwnKey(body, 'ingredient_id')
    ? normalizeInteger(body.ingredient_id)
    : existing?.ingredient_id
  if (!rawIngredientId || rawIngredientId <= 0) return validationError('ingredient_id must be a positive integer')
  if (!(await ingredientExists(db, rawIngredientId))) return validationError('Ingredient not found', 404)

  const formId = optionalPositiveIntegerField(body, 'form_id')
  if (!formId.ok) return formId
  const finalFormId = formId.value === undefined ? existing?.form_id ?? null : formId.value
  if (finalFormId !== null && !(await formBelongsToIngredient(db, finalFormId, rawIngredientId))) {
    return validationError('form_id must belong to the selected ingredient')
  }

  const parentIngredientId = optionalPositiveIntegerField(body, 'parent_ingredient_id')
  if (!parentIngredientId.ok) return parentIngredientId
  const finalParentIngredientId = parentIngredientId.value === undefined
    ? existing?.parent_ingredient_id ?? null
    : parentIngredientId.value
  if (finalParentIngredientId !== null && !(await ingredientExists(db, finalParentIngredientId))) {
    return validationError('parent_ingredient_id must reference an existing ingredient', 404)
  }

  const quantity = optionalNumberField(body, 'quantity', { min: 0, max: 1000000000 })
  if (!quantity.ok) return quantity
  const basisQuantity = optionalNumberField(body, 'basis_quantity', { min: 0, max: 1000000000 })
  if (!basisQuantity.ok) return basisQuantity

  const unit = optionalTextField(body, 'unit', 64)
  if (!unit.ok) return unit
  const basisUnit = optionalTextField(body, 'basis_unit', 64)
  if (!basisUnit.ok) return basisUnit

  const isMain = optionalBooleanField(body, 'is_main')
  if (!isMain.ok) return isMain
  const searchRelevant = optionalBooleanField(body, 'search_relevant')
  if (!searchRelevant.ok) return searchRelevant

  return {
    ok: true,
    value: {
      ingredient_id: rawIngredientId,
      is_main: isMain.value ?? existing?.is_main ?? 0,
      quantity: quantity.value === undefined ? existing?.quantity ?? null : quantity.value,
      unit: unit.value === undefined ? existing?.unit ?? null : unit.value,
      form_id: finalFormId,
      basis_quantity: basisQuantity.value === undefined ? existing?.basis_quantity ?? null : basisQuantity.value,
      basis_unit: basisUnit.value === undefined ? existing?.basis_unit ?? null : basisUnit.value,
      search_relevant: searchRelevant.value ?? existing?.search_relevant ?? 1,
      parent_ingredient_id: finalParentIngredientId,
    },
  }
}

function optionalNumberField(
  data: Record<string, unknown>,
  key: string,
  options: { min?: number; minExclusive?: boolean; max?: number; integer?: boolean } = {},
): ValidationResult<number | null | undefined> {
  if (!hasOwnKey(data, key)) return { ok: true, value: undefined }
  const raw = data[key]
  if (raw === null || raw === '') return { ok: true, value: null }
  const parsed = typeof raw === 'number' ? raw : typeof raw === 'string' && raw.trim() !== '' ? Number(raw) : Number.NaN
  if (!Number.isFinite(parsed)) return validationError(`${key} must be a number`)
  if (options.integer && !Number.isInteger(parsed)) return validationError(`${key} must be an integer`)
  if (options.min !== undefined) {
    if (options.minExclusive ? parsed <= options.min : parsed < options.min) {
      return validationError(`${key} must be ${options.minExclusive ? '>' : '>='} ${options.min}`)
    }
  }
  if (options.max !== undefined && parsed > options.max) return validationError(`${key} must be <= ${options.max}`)
  return { ok: true, value: parsed }
}

function optionalUnixTimestampField(data: Record<string, unknown>, key: string): ValidationResult<number | null | undefined> {
  return optionalNumberField(data, key, { min: 0, integer: true })
}

function normalizeSourceUrl(value: unknown): ValidationResult<string | null | undefined> {
  if (value === undefined) return { ok: true, value: undefined }
  if (value === null || value === '') return { ok: true, value: null }
  if (typeof value !== 'string') return validationError('source_url must be a URL string')
  const trimmed = value.trim()
  if (!trimmed) return { ok: true, value: null }
  if (trimmed.length > 2048) return validationError('source_url must be at most 2048 characters')
  try {
    const url = new URL(trimmed)
    if (url.protocol !== 'https:' && url.protocol !== 'http:') {
      return validationError('source_url must use http or https')
    }
    return { ok: true, value: url.toString() }
  } catch {
    return validationError('source_url must be a valid URL')
  }
}

function normalizeHttpUrlField(data: Record<string, unknown>, key: string): ValidationResult<string | null | undefined> {
  if (!hasOwnKey(data, key)) return { ok: true, value: undefined }
  const result = normalizeSourceUrl(data[key])
  if (!result.ok) return validationError(result.error.replace('source_url', key), result.status)
  return result
}

function normalizeProductImageUrlField(data: Record<string, unknown>, key: string): ValidationResult<string | null | undefined> {
  if (!hasOwnKey(data, key)) return { ok: true, value: undefined }
  const raw = data[key]
  if (raw === null || raw === '') return { ok: true, value: null }
  if (typeof raw !== 'string') return validationError(`${key} must be a URL string`)
  const value = raw.trim()
  if (!value) return { ok: true, value: null }
  if (value.length > 2048) return validationError(`${key} must be at most 2048 characters`)
  if (value.startsWith('/')) return { ok: true, value }
  const result = normalizeSourceUrl(value)
  if (!result.ok) return validationError(result.error.replace('source_url', key), result.status)
  return { ok: true, value: result.value ?? null }
}

function optionalDateTextField(data: Record<string, unknown>, key: string): ValidationResult<string | null | undefined> {
  const result = optionalTextField(data, key, 40)
  if (!result.ok || result.value === undefined || result.value === null) return result
  if (!/^\d{4}(?:-\d{2}(?:-\d{2})?)?(?:[T ][0-9:.+-Z]+)?$/.test(result.value)) {
    return validationError(`${key} must be an ISO-like date string`)
  }
  return result
}

function ingredientResearchEvidenceSelect(columns: Set<string>, tableAlias = ''): string {
  const prefix = tableAlias ? `${tableAlias}.` : ''
  return [
    columns.has('is_retracted') ? `${prefix}is_retracted AS is_retracted` : '0 AS is_retracted',
    columns.has('retraction_checked_at') ? `${prefix}retraction_checked_at AS retraction_checked_at` : 'NULL AS retraction_checked_at',
    columns.has('retraction_notice_url') ? `${prefix}retraction_notice_url AS retraction_notice_url` : 'NULL AS retraction_notice_url',
    columns.has('evidence_grade') ? `${prefix}evidence_grade AS evidence_grade` : 'NULL AS evidence_grade',
  ].join(',\n      ')
}

function parseEvidenceGradeField(
  body: Record<string, unknown>,
  existing: IngredientResearchSourceRow | null,
): ValidationResult<EvidenceGrade | null> {
  if (!hasOwnKey(body, 'evidence_grade')) return { ok: true, value: existing?.evidence_grade ?? null }
  if (body.evidence_grade === null || body.evidence_grade === '') return { ok: true, value: null }
  const grade = enumValue(body.evidence_grade, EVIDENCE_GRADES)
  if (!grade) return validationError(`evidence_grade must be one of ${EVIDENCE_GRADES.join(', ')} or null`)
  return { ok: true, value: grade }
}

function evidenceQualityToGrade(value: string | null): EvidenceGrade | null {
  const quality = value?.trim().toLowerCase() ?? ''
  if (!quality) return null
  if (quality.includes('high') || quality.includes('hoch')) return 'B'
  if (quality.includes('moderate') || quality.includes('medium') || quality.includes('mittel')) return 'C'
  if (quality.includes('very low') || quality.includes('poor') || quality.includes('sehr niedrig')) return 'F'
  if (quality.includes('low') || quality.includes('niedrig')) return 'D'
  return null
}

function nutrientReferenceValueSelect(columns: Set<string>): string {
  const valueExpr = columns.has('value')
    ? 'value'
    : columns.has('value_min')
      ? 'value_min'
      : columns.has('value_max')
        ? 'value_max'
        : 'NULL'
  const noteExpr = columns.has('notes')
    ? 'notes'
    : columns.has('note')
      ? 'note'
      : 'NULL'
  const legacyNoteExpr = columns.has('note')
    ? 'note'
    : columns.has('notes')
      ? 'notes'
      : 'NULL'

  return [
    'id',
    'ingredient_id',
    columns.has('population_id') ? 'population_id' : 'NULL AS population_id',
    'organization',
    columns.has('region') ? 'region' : 'NULL AS region',
    'kind',
    `${valueExpr} AS value`,
    columns.has('value_min') ? 'value_min' : `${valueExpr} AS value_min`,
    columns.has('value_max') ? 'value_max' : 'NULL AS value_max',
    'unit',
    columns.has('source_url') ? 'source_url' : 'NULL AS source_url',
    columns.has('source_label') ? 'source_label' : 'NULL AS source_label',
    columns.has('source_year') ? 'source_year' : 'NULL AS source_year',
    `${noteExpr} AS notes`,
    `${legacyNoteExpr} AS note`,
    columns.has('created_at') ? 'created_at' : 'NULL AS created_at',
    columns.has('updated_at') ? 'updated_at' : 'NULL AS updated_at',
    columns.has('version') ? 'version' : 'NULL AS version',
  ].join(',\n      ')
}

function parseKnowledgeSourcesJson(value: string): unknown[] {
  try {
    const parsed = JSON.parse(value)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function normalizeKnowledgeSourceObject(source: unknown, sortOrder: number): KnowledgeArticleSourceInput | null {
  if (!source || typeof source !== 'object') return null
  const row = source as Record<string, unknown>
  const label = typeof row.name === 'string'
    ? row.name.trim()
    : typeof row.label === 'string'
      ? row.label.trim()
      : ''
  const url = typeof row.link === 'string'
    ? row.link.trim()
    : typeof row.url === 'string'
      ? row.url.trim()
      : ''
  if (!label && !url) return null
  if (!label || !url) return null
  try {
    const parsed = new URL(url)
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null
  } catch {
    return null
  }
  return { label, url, sort_order: sortOrder }
}

function parseKnowledgeSources(value: unknown): ValidationResult<KnowledgeArticleSourceInput[]> {
  if (value === undefined || value === null || value === '') return { ok: true, value: [] }
  const parsed = typeof value === 'string'
    ? (() => {
        try {
          return JSON.parse(value) as unknown
        } catch {
          return null
        }
      })()
    : value
  if (!Array.isArray(parsed)) return validationError('sources must be an array')
  const sources: KnowledgeArticleSourceInput[] = []
  for (let index = 0; index < parsed.length; index += 1) {
    const normalized = normalizeKnowledgeSourceObject(parsed[index], index)
    if (!normalized) {
      return validationError('Each source needs a name and a valid http(s) link')
    }
    sources.push(normalized)
  }
  return { ok: true, value: sources }
}

function serializeKnowledgeSources(value: unknown): ValidationResult<string> {
  if (value === undefined || value === null || value === '') return { ok: true, value: '[]' }
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value)
      if (!Array.isArray(parsed)) return validationError('sources_json must be a JSON array')
      return { ok: true, value: JSON.stringify(parsed) }
    } catch {
      return validationError('sources_json must be a valid JSON array')
    }
  }
  if (!Array.isArray(value)) return validationError('sources_json must be a JSON array')
  return { ok: true, value: JSON.stringify(value) }
}

function serializeKnowledgeSourcesFromStructured(sources: KnowledgeArticleSourceInput[]): string {
  return JSON.stringify(sources.map((source) => ({
    label: source.label,
    url: source.url,
  })))
}

function parseKnowledgeIngredientIds(value: unknown, existing?: number[]): ValidationResult<number[]> {
  if (value === undefined) return { ok: true, value: existing ?? [] }
  if (value === null || value === '') return { ok: true, value: [] }
  if (!Array.isArray(value)) return validationError('ingredient_ids must be an array')
  const ids: number[] = []
  for (const raw of value) {
    const id = normalizeInteger(raw)
    if (!id || id <= 0) return validationError('ingredient_ids must contain positive integers')
    if (!ids.includes(id)) ids.push(id)
  }
  return { ok: true, value: ids }
}

function sourcePayloadFromInput(source: KnowledgeArticleSourceInput, id: number | null = null): KnowledgeArticleSourcePayload {
  return {
    id,
    label: source.label,
    url: source.url,
    name: source.label,
    link: source.url,
    sort_order: source.sort_order,
  }
}

function parseKnowledgeArticle<T extends KnowledgeArticleDbRow | KnowledgeArticleListDbRow>(
  row: T,
): ParsedKnowledgeArticle<T> {
  const sources = parseKnowledgeSourcesJson(row.sources_json)
    .map((source, index) => normalizeKnowledgeSourceObject(source, index))
    .filter((source): source is KnowledgeArticleSourceInput => source !== null)
  return {
    ...row,
    sources_json: parseKnowledgeSourcesJson(row.sources_json),
    sources: sources.map((source) => sourcePayloadFromInput(source)),
    ingredient_ids: [],
    ingredients: [],
  }
}

async function loadKnowledgeArticleSources(
  db: D1Database,
  slugs: string[],
): Promise<Map<string, KnowledgeArticleSourcePayload[]>> {
  const uniqueSlugs = [...new Set(slugs.filter(Boolean))]
  const mapped = new Map<string, KnowledgeArticleSourcePayload[]>()
  if (uniqueSlugs.length === 0 || !(await hasTable(db, 'knowledge_article_sources'))) return mapped
  const placeholders = uniqueSlugs.map(() => '?').join(',')
  const { results } = await db.prepare(`
    SELECT id, article_slug, label, url, sort_order
    FROM knowledge_article_sources
    WHERE article_slug IN (${placeholders})
    ORDER BY article_slug ASC, sort_order ASC, id ASC
  `).bind(...uniqueSlugs).all<KnowledgeArticleSourceRow>()
  for (const row of results ?? []) {
    const list = mapped.get(row.article_slug) ?? []
    list.push(sourcePayloadFromInput({
      label: row.label,
      url: row.url,
      sort_order: row.sort_order,
    }, row.id))
    mapped.set(row.article_slug, list)
  }
  return mapped
}

async function loadKnowledgeArticleIngredients(
  db: D1Database,
  slugs: string[],
): Promise<Map<string, KnowledgeArticleIngredientPayload[]>> {
  const uniqueSlugs = [...new Set(slugs.filter(Boolean))]
  const mapped = new Map<string, KnowledgeArticleIngredientPayload[]>()
  if (uniqueSlugs.length === 0 || !(await hasTable(db, 'knowledge_article_ingredients'))) return mapped
  const placeholders = uniqueSlugs.map(() => '?').join(',')
  const { results } = await db.prepare(`
    SELECT kai.article_slug, kai.ingredient_id, i.name, kai.sort_order
    FROM knowledge_article_ingredients kai
    LEFT JOIN ingredients i ON i.id = kai.ingredient_id
    WHERE kai.article_slug IN (${placeholders})
    ORDER BY kai.article_slug ASC, kai.sort_order ASC, i.name ASC
  `).bind(...uniqueSlugs).all<KnowledgeArticleIngredientRow>()
  for (const row of results ?? []) {
    const list = mapped.get(row.article_slug) ?? []
    list.push({
      ingredient_id: row.ingredient_id,
      name: row.name,
      sort_order: row.sort_order,
    })
    mapped.set(row.article_slug, list)
  }
  return mapped
}

async function hydrateKnowledgeArticles<T extends KnowledgeArticleDbRow | KnowledgeArticleListDbRow>(
  db: D1Database,
  rows: T[],
): Promise<Array<ParsedKnowledgeArticle<T>>> {
  const parsed = rows.map((row) => parseKnowledgeArticle(row))
  const slugs = parsed.map((row) => row.slug)
  const [sourcesBySlug, ingredientsBySlug] = await Promise.all([
    loadKnowledgeArticleSources(db, slugs),
    loadKnowledgeArticleIngredients(db, slugs),
  ])
  return parsed.map((article) => {
    const structuredSources = sourcesBySlug.get(article.slug)
    const ingredients = ingredientsBySlug.get(article.slug) ?? []
    return {
      ...article,
      sources: structuredSources && structuredSources.length > 0 ? structuredSources : article.sources,
      ingredient_ids: ingredients.map((ingredient) => ingredient.ingredient_id),
      ingredients,
    }
  })
}

async function validateKnowledgeArticleIngredientIds(db: D1Database, ids: number[]): Promise<ValidationResult<true>> {
  if (ids.length === 0) return { ok: true, value: true }
  const placeholders = ids.map(() => '?').join(',')
  const { results } = await db.prepare(`
    SELECT id
    FROM ingredients
    WHERE id IN (${placeholders})
  `).bind(...ids).all<{ id: number }>()
  const found = new Set((results ?? []).map((row) => row.id))
  const missing = ids.filter((id) => !found.has(id))
  if (missing.length > 0) return validationError(`Unknown ingredient_ids: ${missing.join(', ')}`, 400)
  return { ok: true, value: true }
}

async function syncKnowledgeArticleRelations(
  db: D1Database,
  slug: string,
  sources: KnowledgeArticleSourceInput[],
  ingredientIds: number[],
): Promise<void> {
  if (await hasTable(db, 'knowledge_article_sources')) {
    await db.prepare('DELETE FROM knowledge_article_sources WHERE article_slug = ?').bind(slug).run()
    for (const source of sources) {
      await db.prepare(`
        INSERT INTO knowledge_article_sources (article_slug, label, url, sort_order, created_at, updated_at)
        VALUES (?, ?, ?, ?, datetime('now'), datetime('now'))
      `).bind(slug, source.label, source.url, source.sort_order).run()
    }
  }

  if (await hasTable(db, 'knowledge_article_ingredients')) {
    await db.prepare('DELETE FROM knowledge_article_ingredients WHERE article_slug = ?').bind(slug).run()
    for (let index = 0; index < ingredientIds.length; index += 1) {
      await db.prepare(`
        INSERT OR IGNORE INTO knowledge_article_ingredients (article_slug, ingredient_id, sort_order, created_at)
        VALUES (?, ?, ?, datetime('now'))
      `).bind(slug, ingredientIds[index], index).run()
    }
  }
}

const AFFILIATE_LINK_HEALTH_SELECT = `
  lh.product_id AS lh_product_id,
  lh.url AS lh_url,
  lh.status AS lh_status,
  lh.http_status AS lh_http_status,
  lh.failure_reason AS lh_failure_reason,
  lh.last_checked_at AS lh_last_checked_at,
  lh.last_success_at AS lh_last_success_at,
  lh.consecutive_failures AS lh_consecutive_failures,
  lh.response_time_ms AS lh_response_time_ms,
  lh.final_url AS lh_final_url,
  lh.redirected AS lh_redirected
`

const PRODUCT_SHOP_LINK_HEALTH_SELECT = `
  pslh.shop_link_id AS pslh_shop_link_id,
  pslh.url AS pslh_url,
  pslh.status AS pslh_status,
  pslh.http_status AS pslh_http_status,
  pslh.failure_reason AS pslh_failure_reason,
  pslh.last_checked_at AS pslh_last_checked_at,
  pslh.last_success_at AS pslh_last_success_at,
  pslh.consecutive_failures AS pslh_consecutive_failures,
  pslh.response_time_ms AS pslh_response_time_ms,
  pslh.final_url AS pslh_final_url,
  pslh.redirected AS pslh_redirected
`

const AFFILIATE_LINK_HEALTH_STATUSES = new Set<string>(['unchecked', 'ok', 'failed', 'timeout', 'invalid'])
const PRODUCT_WARNING_SEVERITIES = ['info', 'caution', 'warning', 'danger'] as const

async function hasAffiliateLinkHealthTable(db: D1Database): Promise<boolean> {
  try {
    const row = await db.prepare(`
      SELECT name
      FROM sqlite_master
      WHERE type = 'table'
        AND name = 'affiliate_link_health'
    `).first<{ name: string }>()
    return row?.name === 'affiliate_link_health'
  } catch {
    return false
  }
}

async function hasProductWarningsTable(db: D1Database): Promise<boolean> {
  try {
    const row = await db.prepare(`
      SELECT name
      FROM sqlite_master
      WHERE type = 'table'
        AND name = 'product_warnings'
    `).first<{ name: string }>()
    return row?.name === 'product_warnings'
  } catch {
    return false
  }
}

async function productWarningsHasActiveColumn(db: D1Database): Promise<boolean> {
  try {
    const { results } = await db.prepare(`PRAGMA table_info(product_warnings)`).all<{ name: string }>()
    return (results ?? []).some((row) => row.name === 'active')
  } catch {
    return false
  }
}

async function hasTable(db: D1Database, tableName: string): Promise<boolean> {
  try {
    const row = await db.prepare(`
      SELECT name
      FROM sqlite_master
      WHERE type = 'table'
        AND name = ?
    `).bind(tableName).first<{ name: string }>()
    return row?.name === tableName
  } catch {
    return false
  }
}

async function getTableColumns(db: D1Database, tableName: string): Promise<Set<string>> {
  try {
    const { results } = await db.prepare(`PRAGMA table_info(${tableName})`).all<{ name: string }>()
    return new Set((results ?? []).map((row) => row.name))
  } catch {
    return new Set()
  }
}

type ReferralSourceRow = {
  referrer_host: string
  referrer_source: string | null
  visitors: number
  pageviews: number
  registrations: number
  last_visit_at: string | null
  last_signup_at: string | null
}

async function loadReferralSources(
  db: D1Database,
  currentRangeCondition: (column: string) => string,
  options: {
    hasPageViewEvents: boolean
    hasPageViewVisitorId: boolean
    hasSignupAttribution: boolean
  },
): Promise<ReferralSourceRow[]> {
  if (!options.hasPageViewEvents && !options.hasSignupAttribution) return []

  if (options.hasPageViewEvents && options.hasSignupAttribution) {
    const visitorCountSql = options.hasPageViewVisitorId
      ? "COUNT(DISTINCT COALESCE(visitor_id, 'pv-' || id))"
      : 'COUNT(*)'
    const { results } = await db.prepare(`
      WITH page_sources AS (
        SELECT
          referrer_host,
          referrer_source,
          COUNT(*) AS pageviews,
          ${visitorCountSql} AS visitors,
          MAX(created_at) AS last_visit_at
        FROM page_view_events
        WHERE referrer_host IS NOT NULL
          AND referrer_source IN ('external', 'google', 'bing', 'duckduckgo')
          AND ${currentRangeCondition('created_at')}
        GROUP BY referrer_host, referrer_source
      ),
      signup_sources AS (
        SELECT
          COALESCE(last_referrer_host, first_referrer_host) AS referrer_host,
          COALESCE(last_referrer_source, first_referrer_source) AS referrer_source,
          COUNT(*) AS registrations,
          MAX(created_at) AS last_signup_at
        FROM signup_attribution
        WHERE COALESCE(last_referrer_host, first_referrer_host) IS NOT NULL
          AND COALESCE(last_referrer_source, first_referrer_source) IN ('external', 'google', 'bing', 'duckduckgo')
          AND ${currentRangeCondition('created_at')}
        GROUP BY COALESCE(last_referrer_host, first_referrer_host), COALESCE(last_referrer_source, first_referrer_source)
      ),
      source_keys AS (
        SELECT referrer_host, referrer_source FROM page_sources
        UNION
        SELECT referrer_host, referrer_source FROM signup_sources
      )
      SELECT
        source_keys.referrer_host,
        source_keys.referrer_source,
        COALESCE(page_sources.visitors, 0) AS visitors,
        COALESCE(page_sources.pageviews, 0) AS pageviews,
        COALESCE(signup_sources.registrations, 0) AS registrations,
        page_sources.last_visit_at,
        signup_sources.last_signup_at
      FROM source_keys
      LEFT JOIN page_sources
        ON page_sources.referrer_host = source_keys.referrer_host
       AND COALESCE(page_sources.referrer_source, '') = COALESCE(source_keys.referrer_source, '')
      LEFT JOIN signup_sources
        ON signup_sources.referrer_host = source_keys.referrer_host
       AND COALESCE(signup_sources.referrer_source, '') = COALESCE(source_keys.referrer_source, '')
      ORDER BY registrations DESC, visitors DESC, pageviews DESC, source_keys.referrer_host ASC
      LIMIT 8
    `).all<ReferralSourceRow>()
    return results ?? []
  }

  if (options.hasPageViewEvents) {
    const visitorCountSql = options.hasPageViewVisitorId
      ? "COUNT(DISTINCT COALESCE(visitor_id, 'pv-' || id))"
      : 'COUNT(*)'
    const { results } = await db.prepare(`
      SELECT
        referrer_host,
        referrer_source,
        ${visitorCountSql} AS visitors,
        COUNT(*) AS pageviews,
        0 AS registrations,
        MAX(created_at) AS last_visit_at,
        NULL AS last_signup_at
      FROM page_view_events
      WHERE referrer_host IS NOT NULL
        AND referrer_source IN ('external', 'google', 'bing', 'duckduckgo')
        AND ${currentRangeCondition('created_at')}
      GROUP BY referrer_host, referrer_source
      ORDER BY visitors DESC, pageviews DESC, referrer_host ASC
      LIMIT 8
    `).all<ReferralSourceRow>()
    return results ?? []
  }

  const { results } = await db.prepare(`
    SELECT
      COALESCE(last_referrer_host, first_referrer_host) AS referrer_host,
      COALESCE(last_referrer_source, first_referrer_source) AS referrer_source,
      0 AS visitors,
      0 AS pageviews,
      COUNT(*) AS registrations,
      NULL AS last_visit_at,
      MAX(created_at) AS last_signup_at
    FROM signup_attribution
    WHERE COALESCE(last_referrer_host, first_referrer_host) IS NOT NULL
      AND COALESCE(last_referrer_source, first_referrer_source) IN ('external', 'google', 'bing', 'duckduckgo')
      AND ${currentRangeCondition('created_at')}
    GROUP BY COALESCE(last_referrer_host, first_referrer_host), COALESCE(last_referrer_source, first_referrer_source)
    ORDER BY registrations DESC, referrer_host ASC
    LIMIT 8
  `).all<ReferralSourceRow>()
  return results ?? []
}

function ingredientTaskStatusSelect(hasTaskStatusTable: boolean): string {
  if (!hasTaskStatusTable) {
    return `
        NULL AS forms_task_status,
        NULL AS dge_task_status,
        NULL AS precursors_task_status,
        NULL AS synonyms_task_status`
  }
  return `
        task_status.forms_task_status,
        task_status.dge_task_status,
        task_status.precursors_task_status,
        task_status.synonyms_task_status`
}

function ingredientTaskStatusJoin(hasTaskStatusTable: boolean): string {
  if (!hasTaskStatusTable) return ''
  return `
      LEFT JOIN (
        SELECT
          ingredient_id,
          MAX(CASE WHEN task_key = 'forms' THEN status END) AS forms_task_status,
          MAX(CASE WHEN task_key = 'dge' THEN status END) AS dge_task_status,
          MAX(CASE WHEN task_key = 'precursors' THEN status END) AS precursors_task_status,
          MAX(CASE WHEN task_key = 'synonyms' THEN status END) AS synonyms_task_status
        FROM ingredient_admin_task_status
        GROUP BY ingredient_id
      ) task_status ON task_status.ingredient_id = i.id
    `
}

function adminHiddenIngredientCondition(alias = 'i'): string {
  const hiddenNames = ADMIN_HIDDEN_TOP_LEVEL_INGREDIENT_NAMES
    .map((name) => `'${name.replace(/'/g, "''").toLowerCase()}'`)
    .join(', ')
  return `lower(${alias}.name) NOT IN (${hiddenNames})`
}

function ingredientGroupCaseExpression(alias = 'i'): string {
  return `CASE
    WHEN lower(COALESCE(${alias}.category, '')) LIKE 'vitamin%' THEN 'vitamins'
    WHEN lower(COALESCE(${alias}.category, '')) = 'mineral' THEN 'minerals'
    WHEN lower(COALESCE(${alias}.category, '')) = 'trace_element' THEN 'trace_elements'
    WHEN lower(COALESCE(${alias}.category, '')) LIKE '%enzyme%' THEN 'enzymes'
    WHEN lower(COALESCE(${alias}.category, '')) = 'amino_acid' THEN 'amino_acids'
    WHEN lower(COALESCE(${alias}.category, '')) = 'fatty_acid' THEN 'fatty_acids'
    WHEN lower(COALESCE(${alias}.category, '')) = 'plant_extract' THEN 'plant_extracts'
    WHEN lower(COALESCE(${alias}.category, '')) = 'adaptogen' THEN 'adaptogens'
    ELSE 'other'
  END`
}

function ingredientGroupLabel(value: AdminIngredientGroupKey): string {
  return ADMIN_INGREDIENT_GROUPS.find((group) => group.value === value)?.label ?? value
}

function ingredientGroupKey(value: string): AdminIngredientGroupKey | null {
  return ADMIN_INGREDIENT_GROUPS.find((group) => group.value === value)?.value ?? null
}

function ingredientGroupCondition(group: AdminIngredientGroupKey): string {
  return `${ingredientGroupCaseExpression('i')} = '${group}'`
}

function ingredientTaskDoneCondition(taskKey: IngredientAdminTaskKey, hasTaskStatusTable: boolean): string {
  if (!hasTaskStatusTable) return '0 = 1'
  return `EXISTS (
    SELECT 1
    FROM ingredient_admin_task_status its
    WHERE its.ingredient_id = i.id
      AND its.task_key = '${taskKey}'
      AND its.status IN ('done', 'none')
  )`
}

function ingredientTaskMissingCondition(
  task: IngredientAdminTaskKey | 'knowledge' | 'dosing',
  hasTaskStatusTable: boolean,
  hasPrecursorsTable: boolean,
): string {
  if (task === 'forms') {
    return `NOT EXISTS (SELECT 1 FROM ingredient_forms f WHERE f.ingredient_id = i.id)
      AND NOT ${ingredientTaskDoneCondition('forms', hasTaskStatusTable)}`
  }
  if (task === 'dge') {
    return `NOT EXISTS (
        SELECT 1
        FROM ingredient_research_sources irs
        WHERE irs.ingredient_id = i.id
          AND irs.source_kind = 'official'
          AND (
            lower(COALESCE(irs.organization, '')) LIKE '%dge%'
            OR lower(COALESCE(irs.source_title, '')) LIKE '%dge%'
            OR lower(COALESCE(irs.source_url, '')) LIKE '%dge.de%'
            OR lower(COALESCE(irs.organization, '')) LIKE '%deutsche gesellschaft%'
            OR lower(COALESCE(irs.source_title, '')) LIKE '%deutsche gesellschaft%'
            OR lower(COALESCE(irs.organization, '')) LIKE '%gesellschaft fuer ernaehrung%'
            OR lower(COALESCE(irs.source_title, '')) LIKE '%gesellschaft fuer ernaehrung%'
            OR lower(COALESCE(irs.organization, '')) LIKE '%gesellschaft fur ernahrung%'
            OR lower(COALESCE(irs.source_title, '')) LIKE '%gesellschaft fur ernahrung%'
          )
      )
      AND NOT ${ingredientTaskDoneCondition('dge', hasTaskStatusTable)}`
  }
  if (task === 'precursors') {
    const precursorMissing = hasPrecursorsTable
      ? 'NOT EXISTS (SELECT 1 FROM ingredient_precursors ip WHERE ip.ingredient_id = i.id)'
      : '1 = 1'
    return `${precursorMissing}
      AND NOT ${ingredientTaskDoneCondition('precursors', hasTaskStatusTable)}`
  }
  if (task === 'synonyms') {
    return `NOT EXISTS (SELECT 1 FROM ingredient_synonyms s WHERE s.ingredient_id = i.id)
      AND NOT ${ingredientTaskDoneCondition('synonyms', hasTaskStatusTable)}`
  }
  if (task === 'dosing') {
    return 'NOT EXISTS (SELECT 1 FROM dose_recommendations dr WHERE dr.ingredient_id = i.id)'
  }
  return `(
    COALESCE((SELECT rs.blog_url FROM ingredient_research_status rs WHERE rs.ingredient_id = i.id), '') = ''
    AND NOT EXISTS (
      SELECT 1
      FROM ingredient_safety_warnings w
      JOIN knowledge_articles a ON a.slug = w.article_slug
      WHERE w.ingredient_id = i.id
        AND w.active = 1
        AND w.article_slug IS NOT NULL
        AND a.status <> 'archived'
    )
  )`
}

function ingredientRecommendationSummarySelect(hasRecommendationSlots: boolean, hasShopLinks: boolean): string {
  if (!hasRecommendationSlots) {
    return INGREDIENT_PRODUCT_RECOMMENDATION_SLOTS.map((slot) => `
        NULL AS ${slot}_recommendation_id,
        NULL AS ${slot}_recommendation_product_id,
        NULL AS ${slot}_recommendation_product_name,
        NULL AS ${slot}_recommendation_shop_link_id,
        NULL AS ${slot}_recommendation_shop_name`).join(',')
  }

  return INGREDIENT_PRODUCT_RECOMMENDATION_SLOTS.map((slot) => {
    const shopNameExpression = hasShopLinks
      ? `(
          SELECT COALESCE(psl.shop_name, psl.normalized_host, psl.url)
          FROM product_recommendations r
          LEFT JOIN product_shop_links psl ON psl.id = r.shop_link_id
          WHERE r.ingredient_id = i.id
            AND r.recommendation_slot = '${slot}'
          ORDER BY r.sort_order ASC, r.id ASC
          LIMIT 1
        )`
      : 'NULL'
    return `
        (
          SELECT r.id
          FROM product_recommendations r
          WHERE r.ingredient_id = i.id
            AND r.recommendation_slot = '${slot}'
          ORDER BY r.sort_order ASC, r.id ASC
          LIMIT 1
        ) AS ${slot}_recommendation_id,
        (
          SELECT r.product_id
          FROM product_recommendations r
          WHERE r.ingredient_id = i.id
            AND r.recommendation_slot = '${slot}'
          ORDER BY r.sort_order ASC, r.id ASC
          LIMIT 1
        ) AS ${slot}_recommendation_product_id,
        (
          SELECT p.name
          FROM product_recommendations r
          JOIN products p ON p.id = r.product_id
          WHERE r.ingredient_id = i.id
            AND r.recommendation_slot = '${slot}'
          ORDER BY r.sort_order ASC, r.id ASC
          LIMIT 1
        ) AS ${slot}_recommendation_product_name,
        (
          SELECT r.shop_link_id
          FROM product_recommendations r
          WHERE r.ingredient_id = i.id
            AND r.recommendation_slot = '${slot}'
          ORDER BY r.sort_order ASC, r.id ASC
          LIMIT 1
        ) AS ${slot}_recommendation_shop_link_id,
        ${shopNameExpression} AS ${slot}_recommendation_shop_name`
  }).join(',')
}

function versionSelect(columns: Set<string>, alias?: string): string {
  if (!columns.has('version')) return 'NULL AS version'
  return alias ? `${alias}.version AS version` : 'version'
}

function parseVersionValue(value: unknown): number | null {
  if (typeof value === 'number' && Number.isInteger(value) && value >= 0) return value
  if (typeof value !== 'string') return null
  const normalized = value.trim().replace(/^W\//i, '').replace(/^"|"$/g, '')
  if (!/^\d+$/.test(normalized)) return null
  return Number(normalized)
}

function requestVersion(c: Context<AppContext>, body?: Record<string, unknown>): number | null {
  return parseVersionValue(c.req.header('If-Match')) ?? parseVersionValue(body?.version)
}

async function requestVersionFromRequest(c: Context<AppContext>): Promise<number | null> {
  const headerVersion = parseVersionValue(c.req.header('If-Match'))
  if (headerVersion !== null) return headerVersion
  if (!c.req.header('Content-Type')?.toLowerCase().includes('application/json')) return null
  try {
    const body = await c.req.json<Record<string, unknown>>()
    return parseVersionValue(body?.version)
  } catch {
    return null
  }
}

function validateOptimisticLock(
  hasVersion: boolean,
  currentVersion: number | null,
  expectedVersion: number | null,
): ValidationResult<{ enforce: boolean; expectedVersion: number | null }> {
  if (!hasVersion || currentVersion === null) return { ok: true, value: { enforce: false, expectedVersion: null } }
  if (expectedVersion !== currentVersion) return validationError('Version conflict', 409)
  return { ok: true, value: { enforce: true, expectedVersion } }
}

function d1ChangeCount(result: D1Result): number | null {
  const meta = result.meta as { changes?: unknown }
  return typeof meta.changes === 'number' ? meta.changes : null
}

function optimisticWhere(column = 'id'): string {
  return `${column} = ? AND version = ?`
}

function formatAffiliateLinkHealth(row: Partial<AffiliateLinkHealthSelectRow>): AffiliateLinkHealth | null {
  if (row.lh_product_id === undefined || row.lh_product_id === null) return null
  const status = row.lh_status && AFFILIATE_LINK_HEALTH_STATUSES.has(row.lh_status)
    ? row.lh_status as AffiliateLinkHealthStatus
    : null

  return {
    url: row.lh_url ?? null,
    status,
    http_status: row.lh_http_status ?? null,
    failure_reason: row.lh_failure_reason ?? null,
    last_checked_at: row.lh_last_checked_at ?? null,
    last_success_at: row.lh_last_success_at ?? null,
    consecutive_failures: row.lh_consecutive_failures ?? null,
    response_time_ms: row.lh_response_time_ms ?? null,
    final_url: row.lh_final_url ?? null,
    redirected: row.lh_redirected ?? null,
  }
}

function withAffiliateLinkHealth<T extends object>(
  row: T & Partial<AffiliateLinkHealthSelectRow>,
): T & { link_health: AffiliateLinkHealth | null } {
  const {
    lh_product_id: _lhProductId,
    lh_url: _lhUrl,
    lh_status: _lhStatus,
    lh_http_status: _lhHttpStatus,
    lh_failure_reason: _lhFailureReason,
    lh_last_checked_at: _lhLastCheckedAt,
    lh_last_success_at: _lhLastSuccessAt,
    lh_consecutive_failures: _lhConsecutiveFailures,
    lh_response_time_ms: _lhResponseTimeMs,
    lh_final_url: _lhFinalUrl,
    lh_redirected: _lhRedirected,
    ...rest
  } = row

  return {
    ...(rest as T),
    link_health: formatAffiliateLinkHealth(row),
  }
}

function withProductListLinkHealth<T extends object>(
  row: T & Partial<AffiliateLinkHealthSelectRow> & Partial<ProductShopLinkHealthSelectRow>,
): T & { link_health: AffiliateLinkHealth | null } {
  const {
    lh_product_id: _lhProductId,
    lh_url: _lhUrl,
    lh_status: _lhStatus,
    lh_http_status: _lhHttpStatus,
    lh_failure_reason: _lhFailureReason,
    lh_last_checked_at: _lhLastCheckedAt,
    lh_last_success_at: _lhLastSuccessAt,
    lh_consecutive_failures: _lhConsecutiveFailures,
    lh_response_time_ms: _lhResponseTimeMs,
    lh_final_url: _lhFinalUrl,
    lh_redirected: _lhRedirected,
    pslh_shop_link_id: _pslhShopLinkId,
    pslh_url: _pslhUrl,
    pslh_status: _pslhStatus,
    pslh_http_status: _pslhHttpStatus,
    pslh_failure_reason: _pslhFailureReason,
    pslh_last_checked_at: _pslhLastCheckedAt,
    pslh_last_success_at: _pslhLastSuccessAt,
    pslh_consecutive_failures: _pslhConsecutiveFailures,
    pslh_response_time_ms: _pslhResponseTimeMs,
    pslh_final_url: _pslhFinalUrl,
    pslh_redirected: _pslhRedirected,
    ...rest
  } = row

  return {
    ...(rest as T),
    link_health: formatProductShopLinkHealth(row) ?? formatAffiliateLinkHealth(row),
  }
}

function formatProductShopLinkHealth(row: Partial<ProductShopLinkHealthSelectRow>): ProductShopLinkHealth | null {
  if (row.pslh_shop_link_id === undefined || row.pslh_shop_link_id === null) return null
  const status = row.pslh_status && AFFILIATE_LINK_HEALTH_STATUSES.has(row.pslh_status)
    ? row.pslh_status as AffiliateLinkHealthStatus
    : null

  return {
    url: row.pslh_url ?? null,
    status,
    http_status: row.pslh_http_status ?? null,
    failure_reason: row.pslh_failure_reason ?? null,
    last_checked_at: row.pslh_last_checked_at ?? null,
    last_success_at: row.pslh_last_success_at ?? null,
    consecutive_failures: row.pslh_consecutive_failures ?? null,
    response_time_ms: row.pslh_response_time_ms ?? null,
    final_url: row.pslh_final_url ?? null,
    redirected: row.pslh_redirected ?? null,
  }
}

function formatProductShopLink(row: ProductShopLinkRow): ProductShopLink {
  const {
    pslh_shop_link_id: _pslhShopLinkId,
    pslh_url: _pslhUrl,
    pslh_status: _pslhStatus,
    pslh_http_status: _pslhHttpStatus,
    pslh_failure_reason: _pslhFailureReason,
    pslh_last_checked_at: _pslhLastCheckedAt,
    pslh_last_success_at: _pslhLastSuccessAt,
    pslh_consecutive_failures: _pslhConsecutiveFailures,
    pslh_response_time_ms: _pslhResponseTimeMs,
    pslh_final_url: _pslhFinalUrl,
    pslh_redirected: _pslhRedirected,
    ...link
  } = row

  return {
    ...link,
    health: formatProductShopLinkHealth(row),
  }
}

function normalizedHostFromUrl(url: string): string | null {
  return normalizeShopHostname(url)
}

function validateProductShopLinkMutation(
  body: Record<string, unknown>,
  existing: ProductShopLinkRow | null,
): ValidationResult<ProductShopLinkMutation> {
  const allowedFields = new Set([
    'shop_domain_id',
    'shop_name',
    'url',
    'is_affiliate',
    'affiliate_owner_type',
    'affiliate_owner_user_id',
    'source_type',
    'is_primary',
    'active',
    'sort_order',
    'version',
  ])
  for (const key of Object.keys(body)) {
    if (!allowedFields.has(key)) return validationError(`${key} cannot be updated on product shop links`)
  }

  const url = normalizeHttpUrlField(body, 'url')
  if (!url.ok) return url
  if (!existing && !url.value) return validationError('url is required')

  const shopDomainId = optionalPositiveIntegerField(body, 'shop_domain_id')
  if (!shopDomainId.ok) return shopDomainId
  const shopName = optionalTextField(body, 'shop_name', 255)
  if (!shopName.ok) return shopName
  const isPrimary = optionalBooleanField(body, 'is_primary')
  if (!isPrimary.ok) return isPrimary
  const active = optionalBooleanField(body, 'active')
  if (!active.ok) return active
  const sortOrder = optionalNumberField(body, 'sort_order', { integer: true, min: -1000000, max: 1000000 })
  if (!sortOrder.ok) return sortOrder

  let sourceType: ProductShopLinkSourceType | undefined
  if (hasOwnKey(body, 'source_type')) {
    const parsedSourceType = enumValue(body.source_type, PRODUCT_SHOP_LINK_SOURCE_TYPES)
    if (!parsedSourceType) return validationError(`source_type must be one of ${PRODUCT_SHOP_LINK_SOURCE_TYPES.join(', ')}`)
    sourceType = parsedSourceType
  }

  const hasAffiliateInput = hasOwnKey(body, 'affiliate_owner_type') ||
    hasOwnKey(body, 'affiliate_owner_user_id') ||
    hasOwnKey(body, 'is_affiliate')
  const ownership = normalizeAffiliateOwnership(body, existing ? {
    affiliate_owner_type: existing.affiliate_owner_type,
    affiliate_owner_user_id: existing.affiliate_owner_user_id,
    is_affiliate: existing.is_affiliate,
  } : {})
  if (!ownership.ok) return ownership

  return {
    ok: true,
    value: {
      ...(shopDomainId.value !== undefined ? { shop_domain_id: shopDomainId.value } : {}),
      ...(shopName.value !== undefined ? { shop_name: shopName.value } : {}),
      ...(url.value !== undefined && url.value !== null ? { url: url.value, normalized_host: normalizedHostFromUrl(url.value) } : {}),
      ...(sourceType !== undefined ? { source_type: sourceType } : {}),
      ...(isPrimary.value !== undefined ? { is_primary: isPrimary.value } : {}),
      ...(active.value !== undefined ? { active: active.value } : {}),
      ...(sortOrder.value !== undefined ? { sort_order: sortOrder.value ?? 0 } : {}),
      ...(!existing || hasAffiliateInput ? {
        is_affiliate: ownership.value.is_affiliate,
        affiliate_owner_type: ownership.value.affiliate_owner_type,
        affiliate_owner_user_id: ownership.value.affiliate_owner_user_id,
      } : {}),
    },
  }
}

function formatManagedListItem(row: ManagedListItemRow): ManagedListItemRow {
  return {
    id: row.id,
    list_key: row.list_key,
    value: row.value,
    label: row.label,
    plural_label: row.plural_label ?? null,
    description: row.description ?? null,
    sort_order: row.sort_order,
    active: row.active,
    version: row.version ?? null,
    created_at: row.created_at ?? null,
    updated_at: row.updated_at ?? null,
  }
}

function validateManagedListItemMutation(
  body: Record<string, unknown>,
  existing: ManagedListItemRow | null,
): ValidationResult<ManagedListItemMutation> {
  const allowedFields = new Set(['value', 'label', 'plural_label', 'description', 'sort_order', 'active', 'version'])
  for (const key of Object.keys(body)) {
    if (!allowedFields.has(key)) return validationError(`${key} cannot be updated on managed list items`)
  }

  const value = hasOwnKey(body, 'value')
    ? requiredTextField(body, 'value', 80)
    : existing ? { ok: true as const, value: existing.value } : validationError('value is required')
  if (!value.ok) return value
  if (!/^[\p{L}\p{N}µ%/(). -]+$/u.test(value.value)) {
    return validationError('value contains unsupported characters')
  }

  const label = hasOwnKey(body, 'label')
    ? requiredTextField(body, 'label', 120)
    : existing ? { ok: true as const, value: existing.label } : validationError('label is required')
  if (!label.ok) return label

  const pluralLabel = optionalTextField(body, 'plural_label', 120)
  if (!pluralLabel.ok) return pluralLabel
  const description = optionalTextField(body, 'description', 500)
  if (!description.ok) return description
  const sortOrder = optionalNumberField(body, 'sort_order', { integer: true, min: -1000000, max: 1000000 })
  if (!sortOrder.ok) return sortOrder
  const active = optionalBooleanField(body, 'active')
  if (!active.ok) return active

  const data: ManagedListItemMutation = {}
  if (hasOwnKey(body, 'value') || !existing) data.value = value.value
  if (hasOwnKey(body, 'label') || !existing) data.label = label.value
  if (pluralLabel.value !== undefined) data.plural_label = pluralLabel.value
  if (description.value !== undefined) data.description = description.value
  if (sortOrder.value !== undefined) data.sort_order = sortOrder.value ?? 0
  if (active.value !== undefined) data.active = active.value
  return { ok: true, value: data }
}

function managedListSelect(columns: Set<string>): string {
  return [
    'id',
    'list_key',
    'value',
    'label',
    columns.has('plural_label') ? 'plural_label' : 'NULL AS plural_label',
    'description',
    'sort_order',
    'active',
    'version',
    'created_at',
    'updated_at',
  ].join(', ')
}

async function loadManagedListItems(
  db: D1Database,
  listKey: AdminManagedListKey,
  includeInactive: boolean,
): Promise<ManagedListItemRow[]> {
  const columns = await getTableColumns(db, 'managed_list_items')
  const whereSql = includeInactive ? 'list_key = ?' : 'list_key = ? AND active = 1'
  const { results } = await db.prepare(`
    SELECT ${managedListSelect(columns)}
    FROM managed_list_items
    WHERE ${whereSql}
    ORDER BY sort_order ASC, active DESC, label ASC, id ASC
  `).bind(listKey).all<ManagedListItemRow>()
  return results ?? []
}

function validateManagedListReorderItems(body: unknown): ValidationResult<ManagedListReorderItem[]> {
  if (!Array.isArray(body)) return validationError('Reorder payload must be an array')
  if (body.length === 0) return validationError('Reorder payload must not be empty')
  if (body.length > 250) return validationError('Reorder payload is too large')

  const seenIds = new Set<number>()
  const items: ManagedListReorderItem[] = []
  for (const entry of body) {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
      return validationError('Each reorder item must be an object')
    }
    const record = entry as Record<string, unknown>
    const id = typeof record.id === 'number' && Number.isInteger(record.id) && record.id > 0 ? record.id : null
    if (id === null) return validationError('Each reorder item needs a positive id')
    if (seenIds.has(id)) return validationError('Duplicate managed list item id in reorder payload')
    seenIds.add(id)

    const sortOrder = typeof record.sort_order === 'number' && Number.isInteger(record.sort_order)
      ? record.sort_order
      : null
    if (sortOrder === null || sortOrder < -1000000 || sortOrder > 1000000) {
      return validationError('Each reorder item needs an integer sort_order')
    }

    const version = record.version === undefined || record.version === null
      ? null
      : typeof record.version === 'number' && Number.isInteger(record.version) && record.version >= 0
        ? record.version
        : undefined
    if (version === undefined) return validationError('version must be an integer when provided')

    items.push({ id, sort_order: sortOrder, version })
  }

  return { ok: true, value: items }
}

async function syncPrimaryProductShopLinkFromProduct(db: D1Database, productId: number): Promise<void> {
  if (!(await hasTable(db, 'product_shop_links'))) return

  const product = await db.prepare(`
    SELECT
      id,
      shop_link,
      COALESCE(is_affiliate, 0) AS is_affiliate,
      COALESCE(
        affiliate_owner_type,
        CASE WHEN COALESCE(is_affiliate, 0) = 1 THEN 'nick' ELSE 'none' END
      ) AS affiliate_owner_type,
      affiliate_owner_user_id
    FROM products
    WHERE id = ?
  `).bind(productId).first<{
    id: number
    shop_link: string | null
    is_affiliate: number
    affiliate_owner_type: AffiliateOwnerType
    affiliate_owner_user_id: number | null
  }>()
  if (!product) return

  await db.prepare(`
    UPDATE product_shop_links
    SET is_primary = 0,
        updated_at = datetime('now'),
        version = COALESCE(version, 0) + 1
    WHERE product_id = ?
  `).bind(productId).run()

  const shopLink = typeof product.shop_link === 'string' ? product.shop_link.trim() : ''
  if (!shopLink) return

  const existing = await db.prepare(`
    SELECT id
    FROM product_shop_links
    WHERE product_id = ?
      AND url = ?
    ORDER BY id ASC
    LIMIT 1
  `).bind(productId, shopLink).first<{ id: number }>()

  if (existing) {
    await db.prepare(`
      UPDATE product_shop_links
      SET is_primary = 1,
          active = 1,
          is_affiliate = ?,
          affiliate_owner_type = ?,
          affiliate_owner_user_id = ?,
          source_type = COALESCE(source_type, 'admin'),
          updated_at = datetime('now'),
          version = COALESCE(version, 0) + 1
      WHERE id = ?
    `).bind(
      product.is_affiliate,
      product.affiliate_owner_type,
      product.affiliate_owner_user_id,
      existing.id,
    ).run()
    return
  }

  await db.prepare(`
    INSERT INTO product_shop_links (
      product_id,
      url,
      is_affiliate,
      affiliate_owner_type,
      affiliate_owner_user_id,
      source_type,
      is_primary,
      active,
      sort_order,
      created_at,
      updated_at
    )
    VALUES (?, ?, ?, ?, ?, 'admin', 1, 1, 0, datetime('now'), datetime('now'))
  `).bind(
    productId,
    shopLink,
    product.is_affiliate,
    product.affiliate_owner_type,
    product.affiliate_owner_user_id,
  ).run()
}

async function syncProductLegacyShopLinkFromPrimary(db: D1Database, productId: number): Promise<void> {
  if (!(await hasTable(db, 'product_shop_links'))) return

  const primary = await db.prepare(`
    SELECT
      url,
      COALESCE(is_affiliate, 0) AS is_affiliate,
      COALESCE(affiliate_owner_type, 'none') AS affiliate_owner_type,
      affiliate_owner_user_id
    FROM product_shop_links
    WHERE product_id = ?
      AND active = 1
    ORDER BY is_primary DESC, sort_order ASC, id ASC
    LIMIT 1
  `).bind(productId).first<{
    url: string
    is_affiliate: number
    affiliate_owner_type: AffiliateOwnerType
    affiliate_owner_user_id: number | null
  }>()

  await db.prepare(`
    UPDATE products
    SET shop_link = ?,
        is_affiliate = ?,
        affiliate_owner_type = ?,
        affiliate_owner_user_id = ?
    WHERE id = ?
  `).bind(
    primary?.url ?? null,
    primary?.is_affiliate ?? 0,
    primary?.affiliate_owner_type ?? 'none',
    primary?.affiliate_owner_user_id ?? null,
    productId,
  ).run()
}

function isPrivateIpv4Host(host: string): boolean {
  const parts = host.split('.')
  if (parts.length !== 4) return false
  const octets = parts.map((part) => Number(part))
  if (octets.some((octet, index) => !Number.isInteger(octet) || octet < 0 || octet > 255 || String(octet) !== parts[index])) {
    return false
  }
  const [first, second] = octets
  return (
    first === 0 ||
    first === 10 ||
    first === 127 ||
    (first === 169 && second === 254) ||
    (first === 172 && second >= 16 && second <= 31) ||
    (first === 192 && second === 168) ||
    (first === 100 && second >= 64 && second <= 127)
  )
}

function isUnsafeLinkHealthHost(host: string): boolean {
  const normalized = host.toLowerCase().replace(/\.$/, '')
  const withoutBrackets = normalized.replace(/^\[(.*)\]$/, '$1')
  if (!withoutBrackets) return true
  if (withoutBrackets === 'localhost' || withoutBrackets.endsWith('.localhost')) return true
  if (withoutBrackets.includes(':')) return true
  return isPrivateIpv4Host(withoutBrackets)
}

function normalizeShopLinkForCheck(rawUrl: string): ValidationResult<{ url: string; host: string }> {
  const trimmed = rawUrl.trim()
  if (!trimmed) return validationError('empty_url')
  if (trimmed.length > 2048) return validationError('url_too_long')

  let parsed: URL
  try {
    parsed = new URL(trimmed)
  } catch {
    return validationError('invalid_url')
  }

  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return validationError('unsupported_protocol')
  if (parsed.username || parsed.password) return validationError('url_credentials_not_allowed')
  if (parsed.port && parsed.port !== '80' && parsed.port !== '443') return validationError('non_standard_port')

  const host = parsed.hostname.toLowerCase().replace(/\.$/, '')
  if (isUnsafeLinkHealthHost(host)) return validationError('unsafe_host')

  parsed.hash = ''
  return { ok: true, value: { url: parsed.toString(), host } }
}

function isShopLinkRedirectStatus(status: number): boolean {
  return status === 301 || status === 302 || status === 303 || status === 307 || status === 308
}

function isHealthyShopLinkStatus(status: number): boolean {
  return status >= 200 && status < 400
}

function shopLinkCheckErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

async function fetchShopLinkOnce(url: string, method: ProductShopLinkCheckMethod): Promise<{
  response: Response | null
  responseTimeMs: number
  timedOut: boolean
  error: string | null
}> {
  const controller = new AbortController()
  const startedAt = Date.now()
  const timeoutId = setTimeout(() => controller.abort('timeout'), PRODUCT_SHOP_LINK_RECHECK_TIMEOUT_MS)

  try {
    const response = await fetch(url, {
      method,
      redirect: 'manual',
      signal: controller.signal,
      headers: {
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Cache-Control': 'no-cache',
        'User-Agent': 'SupplementStack-LinkHealth/1.0 (+https://supplementstack.de)',
        ...(method === 'GET' ? { Range: 'bytes=0-0' } : {}),
      },
    })
    return {
      response,
      responseTimeMs: Date.now() - startedAt,
      timedOut: false,
      error: null,
    }
  } catch (error) {
    return {
      response: null,
      responseTimeMs: Date.now() - startedAt,
      timedOut: controller.signal.aborted,
      error: shopLinkCheckErrorMessage(error).slice(0, 240),
    }
  } finally {
    clearTimeout(timeoutId)
  }
}

async function closeShopLinkResponseBody(response: Response): Promise<void> {
  if (!response.body) return
  try {
    await response.body.cancel()
  } catch {
    // The status line is enough for this health check.
  }
}

async function performProductShopLinkHttpCheck(
  normalized: { url: string; host: string },
  method: ProductShopLinkCheckMethod,
): Promise<ProductShopLinkCheckResult> {
  let currentUrl = normalized.url
  let redirected = false
  let responseTimeMs = 0

  for (let redirectCount = 0; redirectCount <= PRODUCT_SHOP_LINK_RECHECK_MAX_REDIRECTS; redirectCount += 1) {
    const attempt = await fetchShopLinkOnce(currentUrl, method)
    responseTimeMs += attempt.responseTimeMs

    if (!attempt.response) {
      return {
        status: attempt.timedOut ? 'timeout' : 'failed',
        url: normalized.url,
        host: normalized.host,
        http_status: null,
        failure_reason: attempt.timedOut ? 'timeout' : attempt.error ?? 'fetch_error',
        check_method: method,
        final_url: currentUrl,
        redirected: redirected ? 1 : 0,
        response_time_ms: responseTimeMs,
      }
    }

    const response = attempt.response
    await closeShopLinkResponseBody(response)

    if (!isShopLinkRedirectStatus(response.status)) {
      return {
        status: isHealthyShopLinkStatus(response.status) ? 'ok' : 'failed',
        url: normalized.url,
        host: normalized.host,
        http_status: response.status,
        failure_reason: isHealthyShopLinkStatus(response.status) ? null : `http_${response.status}`,
        check_method: method,
        final_url: currentUrl,
        redirected: redirected ? 1 : 0,
        response_time_ms: responseTimeMs,
      }
    }

    const location = response.headers.get('Location')
    if (!location) {
      return {
        status: 'failed',
        url: normalized.url,
        host: normalized.host,
        http_status: response.status,
        failure_reason: 'redirect_without_location',
        check_method: method,
        final_url: currentUrl,
        redirected: redirected ? 1 : 0,
        response_time_ms: responseTimeMs,
      }
    }

    let nextUrl: string
    try {
      nextUrl = new URL(location, currentUrl).toString()
    } catch {
      return {
        status: 'failed',
        url: normalized.url,
        host: normalized.host,
        http_status: response.status,
        failure_reason: 'invalid_redirect_location',
        check_method: method,
        final_url: currentUrl,
        redirected: redirected ? 1 : 0,
        response_time_ms: responseTimeMs,
      }
    }

    const next = normalizeShopLinkForCheck(nextUrl)
    if (!next.ok) {
      return {
        status: 'failed',
        url: normalized.url,
        host: normalized.host,
        http_status: response.status,
        failure_reason: `unsafe_redirect:${next.error}`,
        check_method: method,
        final_url: nextUrl.slice(0, 2048),
        redirected: 1,
        response_time_ms: responseTimeMs,
      }
    }

    currentUrl = next.value.url
    redirected = true
  }

  return {
    status: 'failed',
    url: normalized.url,
    host: normalized.host,
    http_status: null,
    failure_reason: 'too_many_redirects',
    check_method: method,
    final_url: currentUrl,
    redirected: redirected ? 1 : 0,
    response_time_ms: responseTimeMs,
  }
}

function shouldRetryShopLinkHeadWithGet(result: ProductShopLinkCheckResult): boolean {
  return (
    result.status !== 'ok' &&
    result.http_status !== null &&
    [400, 403, 404, 405, 406, 408, 409, 410, 418, 421, 425, 429, 500, 501, 502, 503, 504].includes(result.http_status)
  )
}

async function checkProductShopLink(rawUrl: string): Promise<ProductShopLinkCheckResult> {
  const normalized = normalizeShopLinkForCheck(rawUrl)
  if (!normalized.ok) {
    return {
      status: 'invalid',
      url: rawUrl.trim().slice(0, 2048),
      host: '',
      http_status: null,
      failure_reason: normalized.error,
      check_method: null,
      final_url: null,
      redirected: 0,
      response_time_ms: null,
    }
  }

  const headResult = await performProductShopLinkHttpCheck(normalized.value, 'HEAD')
  if (headResult.status === 'ok') return headResult
  return shouldRetryShopLinkHeadWithGet(headResult)
    ? await performProductShopLinkHttpCheck(normalized.value, 'GET')
    : headResult
}

async function persistProductShopLinkHealth(
  db: D1Database,
  shopLinkId: number,
  result: ProductShopLinkCheckResult,
  checkedAt: string,
): Promise<void> {
  await db.prepare(`
    INSERT INTO product_shop_link_health (
      shop_link_id,
      url,
      status,
      http_status,
      failure_reason,
      final_url,
      redirected,
      response_time_ms,
      consecutive_failures,
      last_success_at,
      last_checked_at,
      updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
    ON CONFLICT(shop_link_id) DO UPDATE SET
      url = excluded.url,
      status = excluded.status,
      http_status = excluded.http_status,
      failure_reason = excluded.failure_reason,
      final_url = excluded.final_url,
      redirected = excluded.redirected,
      response_time_ms = excluded.response_time_ms,
      last_checked_at = excluded.last_checked_at,
      last_success_at = CASE
        WHEN excluded.status = 'ok' THEN excluded.last_checked_at
        ELSE product_shop_link_health.last_success_at
      END,
      consecutive_failures = CASE
        WHEN excluded.status = 'ok' THEN 0
        WHEN product_shop_link_health.url <> excluded.url THEN 1
        ELSE product_shop_link_health.consecutive_failures + 1
      END,
      updated_at = datetime('now')
  `).bind(
    shopLinkId,
    result.url,
    result.status,
    result.http_status,
    result.failure_reason,
    result.final_url,
    result.redirected,
    result.response_time_ms,
    result.status === 'ok' ? 0 : 1,
    result.status === 'ok' ? checkedAt : null,
    checkedAt,
  ).run()
}

async function getProductShopLinkRow(
  db: D1Database,
  productId: number,
  shopLinkId: number,
  includeHealth: boolean,
): Promise<ProductShopLinkRow | null> {
  const healthSelect = includeHealth ? `,${PRODUCT_SHOP_LINK_HEALTH_SELECT}` : ``
  const healthJoin = includeHealth ? 'LEFT JOIN product_shop_link_health pslh ON pslh.shop_link_id = psl.id' : ''
  return await db.prepare(`
    SELECT
      psl.*${healthSelect}
    FROM product_shop_links psl
    ${healthJoin}
    WHERE psl.product_id = ?
      AND psl.id = ?
  `).bind(productId, shopLinkId).first<ProductShopLinkRow>()
}

async function productExists(db: D1Database, productId: number): Promise<boolean> {
  const row = await db.prepare('SELECT id FROM products WHERE id = ?').bind(productId).first<{ id: number }>()
  return Boolean(row)
}

async function getProductVersionRow(
  db: D1Database,
  productId: number,
  columns?: Set<string>,
): Promise<{ id: number; version: number | null } | null> {
  const productColumns = columns ?? await getTableColumns(db, 'products')
  const versionExpr = productColumns.has('version') ? 'version' : 'NULL AS version'
  return await db.prepare(`SELECT id, ${versionExpr} FROM products WHERE id = ?`)
    .bind(productId)
    .first<{ id: number; version: number | null }>()
}

async function reserveProductVersionForMutation(
  db: D1Database,
  productId: number,
  columns: Set<string>,
  expectedVersion: number | null,
): Promise<
  | { ok: true; productVersion: number | null }
  | { ok: false; error: string; current_version: number | null }
> {
  if (!columns.has('version')) return { ok: true, productVersion: null }
  if (expectedVersion === null) return { ok: true, productVersion: null }

  const updateResult = await db.prepare(`
    UPDATE products
    SET version = COALESCE(version, 0) + 1
    WHERE id = ? AND version = ?
  `).bind(productId, expectedVersion).run()
  if (d1ChangeCount(updateResult) === 0) {
    const current = await getProductVersionRow(db, productId, columns)
    return { ok: false, error: 'Version conflict', current_version: current?.version ?? null }
  }

  const current = await getProductVersionRow(db, productId, columns)
  return { ok: true, productVersion: current?.version ?? null }
}

async function incrementProductVersionAfterMutation(
  db: D1Database,
  productId: number,
  columns: Set<string>,
): Promise<number | null> {
  if (!columns.has('version')) return null
  await db.prepare(`
    UPDATE products
    SET version = COALESCE(version, 0) + 1
    WHERE id = ?
  `).bind(productId).run()
  const current = await getProductVersionRow(db, productId, columns)
  return current?.version ?? null
}

async function getProductIngredientRow(
  db: D1Database,
  productId: number,
  rowId: number,
): Promise<AdminProductIngredientRow | null> {
  return await db.prepare(`
    SELECT
      pi.id,
      pi.product_id,
      pi.ingredient_id,
      i.name AS ingredient_name,
      i.unit AS ingredient_unit,
      i.description AS ingredient_description,
      pi.form_id,
      f.name AS form_name,
      pi.parent_ingredient_id,
      parent.name AS parent_ingredient_name,
      COALESCE(pi.is_main, 0) AS is_main,
      COALESCE(pi.search_relevant, 1) AS search_relevant,
      pi.quantity,
      pi.unit,
      pi.basis_quantity,
      pi.basis_unit,
      COALESCE(idp_form.effect_summary, idp_base.effect_summary) AS effect_summary,
      COALESCE(idp_form.timing, idp_base.timing) AS timing,
      COALESCE(idp_form.timing_note, idp_base.timing_note) AS timing_note,
      COALESCE(idp_form.intake_hint, idp_base.intake_hint) AS intake_hint,
      COALESCE(idp_form.card_note, idp_base.card_note) AS card_note
    FROM product_ingredients pi
    JOIN ingredients i ON i.id = pi.ingredient_id
    LEFT JOIN ingredient_forms f ON f.id = pi.form_id
    LEFT JOIN ingredients parent ON parent.id = pi.parent_ingredient_id
    LEFT JOIN ingredient_display_profiles idp_form
      ON idp_form.ingredient_id = pi.ingredient_id
     AND idp_form.form_id = pi.form_id
     AND idp_form.sub_ingredient_id IS NULL
    LEFT JOIN ingredient_display_profiles idp_base
      ON idp_base.ingredient_id = pi.ingredient_id
     AND idp_base.form_id IS NULL
     AND idp_base.sub_ingredient_id IS NULL
    WHERE pi.product_id = ?
      AND pi.id = ?
  `).bind(productId, rowId).first<AdminProductIngredientRow>()
}

async function loadProductWarnings(db: D1Database, productId: number, includeInactive = false): Promise<ProductWarningRow[]> {
  if (!(await hasProductWarningsTable(db))) return []
  try {
    const columns = await getTableColumns(db, 'product_warnings')
    const activeWhere = includeInactive ? '' : 'AND COALESCE(active, 1) = 1'
    const { results } = await db.prepare(`
      SELECT
        id,
        product_id,
        severity,
        title,
        message,
        alternative_note,
        active,
        created_at,
        updated_at,
        ${versionSelect(columns)}
      FROM product_warnings
      WHERE product_id = ?
        ${activeWhere}
      ORDER BY
        COALESCE(active, 1) DESC,
        CASE severity
          WHEN 'danger' THEN 0
          WHEN 'warning' THEN 1
          WHEN 'caution' THEN 2
          WHEN 'info' THEN 3
          ELSE 4
        END,
        id DESC
    `).bind(productId).all<ProductWarningRow>()
    return results ?? []
  } catch {
    return []
  }
}

async function getProductWarningRow(db: D1Database, productId: number, warningId: number): Promise<ProductWarningRow | null> {
  if (!(await hasProductWarningsTable(db))) return null
  try {
    const columns = await getTableColumns(db, 'product_warnings')
    return await db.prepare(`
      SELECT
        id,
        product_id,
        severity,
        title,
        message,
        alternative_note,
        active,
        created_at,
        updated_at,
        ${versionSelect(columns)}
      FROM product_warnings
      WHERE id = ?
        AND product_id = ?
    `).bind(warningId, productId).first<ProductWarningRow>()
  } catch {
    return null
  }
}

function productQaIssues(row: ProductQaRow): ProductQaIssue[] {
  return PRODUCT_QA_ISSUES.filter((issue) => row[issue] === 1)
}

async function getProductQaRow(
  db: D1Database,
  productId: number,
  includeLinkHealth = false,
): Promise<ProductQaRow | null> {
  const productColumns = await getTableColumns(db, 'products')
  const productVersionSelect = productColumns.has('version') ? 'p.version AS version,' : 'NULL AS version,'
  const linkHealthSelect = includeLinkHealth ? `,${AFFILIATE_LINK_HEALTH_SELECT}` : ''
  const linkHealthJoin = includeLinkHealth ? 'LEFT JOIN affiliate_link_health lh ON lh.product_id = p.id' : ''

  return db.prepare(`
    WITH ingredient_counts AS (
      SELECT
        product_id,
        COUNT(*) AS ingredient_count,
        SUM(CASE WHEN is_main = 1 THEN 1 ELSE 0 END) AS main_ingredient_count
      FROM product_ingredients
      WHERE product_id = ?
      GROUP BY product_id
    ),
    qa AS (
      SELECT
        p.id,
        p.name,
        p.brand,
        p.form,
        p.price,
        p.shop_link,
        p.image_url,
        p.image_r2_key,
        COALESCE(p.is_affiliate, 0) AS is_affiliate,
        COALESCE(
          p.affiliate_owner_type,
          CASE WHEN COALESCE(p.is_affiliate, 0) = 1 THEN 'nick' ELSE 'none' END
        ) AS affiliate_owner_type,
        p.affiliate_owner_user_id,
        p.serving_size,
        p.serving_unit,
        p.servings_per_container,
        p.container_count,
        p.moderation_status,
        p.visibility,
        p.created_at,
        ${productVersionSelect}
        COALESCE(ic.ingredient_count, 0) AS ingredient_count,
        COALESCE(ic.main_ingredient_count, 0) AS main_ingredient_count,
        CASE WHEN COALESCE(p.image_url, '') = '' AND COALESCE(p.image_r2_key, '') = '' THEN 1 ELSE 0 END AS missing_image,
        CASE WHEN COALESCE(p.shop_link, '') = '' THEN 1 ELSE 0 END AS missing_shop_link,
        CASE
          WHEN p.serving_size IS NULL
            OR p.serving_size <= 0
            OR COALESCE(p.serving_unit, '') = ''
            OR p.servings_per_container IS NULL
            OR p.servings_per_container <= 0
            OR p.container_count IS NULL
            OR p.container_count <= 0
          THEN 1 ELSE 0
        END AS missing_serving_data,
        CASE WHEN p.price <= 0 OR p.price > 300 THEN 1 ELSE 0 END AS suspicious_price_zero_or_high,
        CASE WHEN COALESCE(ic.ingredient_count, 0) = 0 THEN 1 ELSE 0 END AS missing_ingredient_rows,
        CASE
          WHEN COALESCE(p.shop_link, '') <> ''
            AND COALESCE(p.affiliate_owner_type, '') = ''
          THEN 1 ELSE 0
        END AS no_affiliate_flag_on_shop_link
        ${linkHealthSelect}
      FROM products p
      LEFT JOIN ingredient_counts ic ON ic.product_id = p.id
      ${linkHealthJoin}
      WHERE p.id = ?
    )
    SELECT *
    FROM qa
  `).bind(productId, productId).first<ProductQaRow>()
}

function formatProductQaRow(row: ProductQaRow) {
  return withAffiliateLinkHealth({
    ...row,
    issues: productQaIssues(row),
  })
}

function validateProductQaPatch(body: Record<string, unknown>): ValidationResult<ProductQaPatch> {
  const allowedFields = new Set([
    'name',
    'brand',
    'price',
    'shop_link',
    'image_url',
    'is_affiliate',
    'affiliate_owner_type',
    'affiliate_owner_user_id',
    'moderation_status',
    'visibility',
    'serving_size',
    'serving_unit',
    'servings_per_container',
    'container_count',
  ])
  for (const key of Object.keys(body)) {
    if (!allowedFields.has(key)) return validationError(`${key} cannot be updated from product QA`)
  }
  if (Object.keys(body).length === 0) return validationError('At least one product QA field is required')

  const data: ProductQaPatch = {}

  const name = hasOwnKey(body, 'name') ? requiredTextField(body, 'name', 240) : { ok: true as const, value: undefined }
  if (!name.ok) return name
  if (name.value !== undefined) data.name = name.value

  const brand = optionalTextField(body, 'brand', 240)
  if (!brand.ok) return brand
  if (brand.value !== undefined) data.brand = brand.value

  const price = optionalNumberField(body, 'price', { min: 0, minExclusive: true, max: 300 })
  if (!price.ok) return price
  if (price.value === null) return validationError('price is required')
  if (price.value !== undefined) data.price = normalizePriceCents(price.value)

  const shopLink = normalizeHttpUrlField(body, 'shop_link')
  if (!shopLink.ok) return shopLink
  if (shopLink.value !== undefined) data.shop_link = shopLink.value

  const imageUrl = normalizeProductImageUrlField(body, 'image_url')
  if (!imageUrl.ok) return imageUrl
  if (imageUrl.value !== undefined) data.image_url = imageUrl.value

  if (hasOwnKey(body, 'moderation_status')) {
    const moderationStatus = enumValue(body.moderation_status, PRODUCT_MODERATION_STATUSES)
    if (!moderationStatus) return validationError(`moderation_status must be one of ${PRODUCT_MODERATION_STATUSES.join(', ')}`)
    data.moderation_status = moderationStatus
  }

  if (hasOwnKey(body, 'visibility')) {
    const visibility = enumValue(body.visibility, PRODUCT_VISIBILITIES)
    if (!visibility) return validationError(`visibility must be one of ${PRODUCT_VISIBILITIES.join(', ')}`)
    data.visibility = visibility
  }

  const isAffiliate = optionalBooleanField(body, 'is_affiliate')
  if (!isAffiliate.ok) return isAffiliate
  if (isAffiliate.value !== undefined) data.is_affiliate = isAffiliate.value

  const servingSize = optionalNumberField(body, 'serving_size', { min: 0, minExclusive: true, max: 100000 })
  if (!servingSize.ok) return servingSize
  if (servingSize.value === null) return validationError('serving_size is required')
  if (servingSize.value !== undefined) data.serving_size = servingSize.value

  const servingUnit = optionalTextField(body, 'serving_unit', 40)
  if (!servingUnit.ok) return servingUnit
  if (servingUnit.value !== undefined) {
    if (servingUnit.value === null) return validationError('serving_unit is required')
    if (servingUnit.value !== null && !/^[\p{L}\p{N}µ%/(). -]+$/u.test(servingUnit.value)) {
      return validationError('serving_unit contains unsupported characters')
    }
    data.serving_unit = servingUnit.value
  }

  const servingsPerContainer = optionalNumberField(body, 'servings_per_container', {
    min: 0,
    minExclusive: true,
    max: 10000,
    integer: true,
  })
  if (!servingsPerContainer.ok) return servingsPerContainer
  if (servingsPerContainer.value === null) return validationError('servings_per_container is required')
  if (servingsPerContainer.value !== undefined) data.servings_per_container = servingsPerContainer.value

  const containerCount = optionalNumberField(body, 'container_count', {
    min: 0,
    minExclusive: true,
    max: 1000,
    integer: true,
  })
  if (!containerCount.ok) return containerCount
  if (containerCount.value === null) return validationError('container_count is required')
  if (containerCount.value !== undefined) data.container_count = containerCount.value

  return { ok: true, value: data }
}

function validateProductCreatePayload(body: Record<string, unknown>): ValidationResult<ProductCreatePayload> {
  const allowedFields = new Set([
    'name',
    'brand',
    'form',
    'price',
    'shop_link',
    'is_affiliate',
    'affiliate_owner_type',
    'affiliate_owner_user_id',
    'moderation_status',
    'visibility',
    'serving_size',
    'serving_unit',
    'servings_per_container',
    'container_count',
  ])
  for (const key of Object.keys(body)) {
    if (!allowedFields.has(key)) return validationError(`${key} cannot be set when creating products`)
  }

  const name = requiredTextField(body, 'name', 240)
  if (!name.ok) return name

  const brand = optionalTextField(body, 'brand', 240)
  if (!brand.ok) return brand

  const form = optionalTextField(body, 'form', 120)
  if (!form.ok) return form

  const price = optionalNumberField(body, 'price', { min: 0, minExclusive: true, max: 300 })
  if (!price.ok) return price
  if (price.value === undefined || price.value === null) return validationError('price is required')

  const shopLink = normalizeHttpUrlField(body, 'shop_link')
  if (!shopLink.ok) return shopLink

  const moderationStatus = hasOwnKey(body, 'moderation_status')
    ? enumValue(body.moderation_status, PRODUCT_MODERATION_STATUSES)
    : 'pending'
  if (!moderationStatus) return validationError(`moderation_status must be one of ${PRODUCT_MODERATION_STATUSES.join(', ')}`)

  const visibility = hasOwnKey(body, 'visibility')
    ? enumValue(body.visibility, PRODUCT_VISIBILITIES)
    : 'hidden'
  if (!visibility) return validationError(`visibility must be one of ${PRODUCT_VISIBILITIES.join(', ')}`)

  const servingSize = optionalNumberField(body, 'serving_size', { min: 0, minExclusive: true, max: 100000 })
  if (!servingSize.ok) return servingSize
  const servingUnit = optionalTextField(body, 'serving_unit', 40)
  if (!servingUnit.ok) return servingUnit
  if (servingUnit.value !== undefined && servingUnit.value !== null && !/^[\p{L}\p{N}Âµ%/(). -]+$/u.test(servingUnit.value)) {
    return validationError('serving_unit contains unsupported characters')
  }
  const servingsPerContainer = optionalNumberField(body, 'servings_per_container', {
    min: 0,
    minExclusive: true,
    max: 10000,
    integer: true,
  })
  if (!servingsPerContainer.ok) return servingsPerContainer
  const containerCount = optionalNumberField(body, 'container_count', {
    min: 0,
    minExclusive: true,
    max: 1000,
    integer: true,
  })
  if (!containerCount.ok) return containerCount

  const fallbackOwner: Partial<AffiliateOwnership> = shopLink.value
    ? { affiliate_owner_type: 'nick', affiliate_owner_user_id: null, is_affiliate: 1 }
    : { affiliate_owner_type: 'none', affiliate_owner_user_id: null, is_affiliate: 0 }
  const ownership = normalizeAffiliateOwnership(body, fallbackOwner)
  if (!ownership.ok) return ownership

  return {
    ok: true,
    value: {
      name: name.value,
      brand: brand.value ?? null,
      form: form.value ?? null,
      price: normalizePriceCents(price.value),
      shop_link: shopLink.value ?? null,
      is_affiliate: shopLink.value ? ownership.value.is_affiliate : 0,
      affiliate_owner_type: shopLink.value ? ownership.value.affiliate_owner_type : 'none',
      affiliate_owner_user_id: shopLink.value ? ownership.value.affiliate_owner_user_id : null,
      moderation_status: moderationStatus,
      visibility,
      serving_size: servingSize.value ?? null,
      serving_unit: servingUnit.value ?? null,
      servings_per_container: servingsPerContainer.value ?? null,
      container_count: containerCount.value ?? null,
    },
  }
}

function parseWarningSlugs(value: string | null): string[] {
  if (!value) return []
  return value.split('||').filter((slug) => slug.length > 0)
}

function validateKnowledgeArticlePayload(
  body: Record<string, unknown>,
  existing: KnowledgeArticleDbRow | null,
): ValidationResult<KnowledgeArticlePayload> {
  const rawSlug = hasOwnKey(body, 'slug') ? body.slug : existing?.slug
  const slug = normalizeSlug(rawSlug)
  if (!slug) return validationError('slug must use lowercase letters, numbers, and single hyphens only')
  if (slug.length > 160) return validationError('slug must be at most 160 characters')

  const title = hasOwnKey(body, 'title')
    ? requiredTextField(body, 'title', 240)
    : existing
      ? { ok: true as const, value: existing.title }
      : validationError('title is required')
  if (!title.ok) return title

  const summary = hasOwnKey(body, 'summary')
    ? requiredTextField(body, 'summary', 2000)
    : existing
      ? { ok: true as const, value: existing.summary }
      : validationError('summary is required')
  if (!summary.ok) return summary

  const bodyText = hasOwnKey(body, 'body')
    ? requiredTextField(body, 'body', 200000)
    : existing
      ? { ok: true as const, value: existing.body }
      : validationError('body is required')
  if (!bodyText.ok) return bodyText

  const statusInput = hasOwnKey(body, 'status') ? body.status : existing?.status ?? 'draft'
  const status = enumValue(statusInput, KNOWLEDGE_ARTICLE_STATUSES)
  if (!status) return validationError(`status must be one of ${KNOWLEDGE_ARTICLE_STATUSES.join(', ')}`)

  const reviewedAt = optionalDateTextField(body, 'reviewed_at')
  if (!reviewedAt.ok) return reviewedAt

  const legacySources = serializeKnowledgeSources(existing?.sources_json ?? undefined)
  if (!legacySources.ok) return legacySources
  const sourceInput = hasOwnKey(body, 'sources')
    ? body.sources
    : hasOwnKey(body, 'sources_json')
      ? body.sources_json
      : parseKnowledgeSourcesJson(legacySources.value)
  const sources = parseKnowledgeSources(sourceInput)
  if (!sources.ok) return sources
  const sourcesJson = serializeKnowledgeSourcesFromStructured(sources.value)

  const ingredientIds = parseKnowledgeIngredientIds(body.ingredient_ids)
  if (!ingredientIds.ok) return ingredientIds

  const conclusion = optionalTextField(body, 'conclusion', 10000)
  if (!conclusion.ok) return conclusion
  const featuredImageR2Key = optionalTextField(body, 'featured_image_r2_key', 1000)
  if (!featuredImageR2Key.ok) return featuredImageR2Key
  const featuredImageUrl = normalizeHttpUrlField(body, 'featured_image_url')
  if (!featuredImageUrl.ok) return featuredImageUrl
  const doseMin = optionalNumberField(body, 'dose_min', { min: 0 })
  if (!doseMin.ok) return doseMin
  const doseMax = optionalNumberField(body, 'dose_max', { min: 0 })
  if (!doseMax.ok) return doseMax
  const doseUnit = optionalTextField(body, 'dose_unit', 50)
  if (!doseUnit.ok) return doseUnit
  const productNote = optionalTextField(body, 'product_note', 10000)
  if (!productNote.ok) return productNote

  const finalDoseMin = doseMin.value === undefined ? existing?.dose_min ?? null : doseMin.value
  const finalDoseMax = doseMax.value === undefined ? existing?.dose_max ?? null : doseMax.value
  if (finalDoseMin !== null && finalDoseMax !== null && finalDoseMin > finalDoseMax) {
    return validationError('dose_min must be <= dose_max')
  }

  if (status === 'published') {
    if (!bodyText.value.trim()) return validationError('Published knowledge articles need a non-empty body')
    if (sources.value.length === 0) return validationError('Published knowledge articles need at least one source')
  }

  return {
    ok: true,
    value: {
      slug,
      title: title.value,
      summary: summary.value,
      body: bodyText.value,
      status,
      reviewed_at: reviewedAt.value === undefined ? existing?.reviewed_at ?? null : reviewedAt.value,
      sources_json: sourcesJson,
      sources: sources.value,
      ingredient_ids: ingredientIds.value,
      conclusion: conclusion.value === undefined ? existing?.conclusion ?? null : conclusion.value,
      featured_image_r2_key: featuredImageR2Key.value === undefined ? existing?.featured_image_r2_key ?? null : featuredImageR2Key.value,
      featured_image_url: featuredImageUrl.value === undefined ? existing?.featured_image_url ?? null : featuredImageUrl.value,
      dose_min: finalDoseMin,
      dose_max: finalDoseMax,
      dose_unit: doseUnit.value === undefined ? existing?.dose_unit ?? null : doseUnit.value,
      product_note: productNote.value === undefined ? existing?.product_note ?? null : productNote.value,
    },
  }
}

function redactAuditSecrets(value: unknown, depth = 0): unknown {
  if (depth > 8) return '[redacted: max depth]'
  if (Array.isArray(value)) return value.map((item) => redactAuditSecrets(item, depth + 1))
  if (value && typeof value === 'object') {
    const redacted: Record<string, unknown> = {}
    for (const [key, nestedValue] of Object.entries(value as Record<string, unknown>)) {
      const lowered = key.toLowerCase()
      redacted[key] = SENSITIVE_AUDIT_KEY_PARTS.some((part) => lowered.includes(part))
        ? '[redacted]'
        : redactAuditSecrets(nestedValue, depth + 1)
    }
    return redacted
  }
  return value
}

function parseAuditChanges(changes: string | null): unknown {
  if (!changes) return null
  try {
    return redactAuditSecrets(JSON.parse(changes))
  } catch {
    return null
  }
}

function formatDoseRecommendationValidation(error: ValidationFailure): { error: string; status: 400 | 404 | 409 | 502 } {
  return { error: error.error, status: error.status ?? 400 }
}

async function ingredientExists(db: D1Database, ingredientId: number): Promise<boolean> {
  const row = await db.prepare('SELECT id FROM ingredients WHERE id = ?')
    .bind(ingredientId)
    .first<{ id: number }>()
  return Boolean(row)
}

async function loadIngredientPrecursors(
  db: D1Database,
  ingredientId: number,
): Promise<IngredientPrecursorAdminRow[]> {
  if (!(await hasTable(db, 'ingredient_precursors'))) return []
  const { results } = await db.prepare(`
    SELECT
      p.ingredient_id,
      p.precursor_ingredient_id,
      pre.name AS precursor_name,
      pre.unit AS precursor_unit,
      p.sort_order,
      p.note,
      p.created_at
    FROM ingredient_precursors p
    JOIN ingredients pre ON pre.id = p.precursor_ingredient_id
    WHERE p.ingredient_id = ?
    ORDER BY p.sort_order ASC, pre.name ASC, p.precursor_ingredient_id ASC
  `).bind(ingredientId).all<IngredientPrecursorAdminRow>()
  return results ?? []
}

function formatIngredientTaskStatuses(rows: IngredientAdminTaskStatusRow[]): Record<IngredientAdminTaskKey, IngredientAdminTaskStatusRow | null> {
  const statuses: Record<IngredientAdminTaskKey, IngredientAdminTaskStatusRow | null> = {
    forms: null,
    dge: null,
    precursors: null,
    synonyms: null,
  }
  for (const row of rows) {
    if (INGREDIENT_ADMIN_TASK_KEYS.includes(row.task_key)) statuses[row.task_key] = row
  }
  return statuses
}

async function loadIngredientTaskStatuses(
  db: D1Database,
  ingredientId: number,
): Promise<Record<IngredientAdminTaskKey, IngredientAdminTaskStatusRow | null>> {
  if (!(await hasTable(db, 'ingredient_admin_task_status'))) {
    return formatIngredientTaskStatuses([])
  }
  const { results } = await db.prepare(`
    SELECT ingredient_id, task_key, status, note, updated_at, updated_by_user_id
    FROM ingredient_admin_task_status
    WHERE ingredient_id = ?
    ORDER BY task_key ASC
  `).bind(ingredientId).all<IngredientAdminTaskStatusRow>()
  return formatIngredientTaskStatuses(results ?? [])
}

async function loadIngredientProductRecommendations(
  db: D1Database,
  ingredientId: number,
): Promise<{
  recommendations: IngredientProductRecommendationRow[]
  slots: Record<IngredientProductRecommendationSlot, IngredientProductRecommendationRow | null>
}> {
  const recommendationColumns = await getTableColumns(db, 'product_recommendations')
  if (!recommendationColumns.has('recommendation_slot') || !recommendationColumns.has('shop_link_id')) {
    return { recommendations: [], slots: emptyIngredientProductRecommendationSlots() }
  }
  const hasShopLinks = await hasTable(db, 'product_shop_links')
  const shopLinkSelect = hasShopLinks
    ? `
      psl.url AS shop_link_url,
      psl.shop_name AS shop_link_name,
      psl.normalized_host AS shop_link_host`
    : `
      NULL AS shop_link_url,
      NULL AS shop_link_name,
      NULL AS shop_link_host`
  const shopLinkJoin = hasShopLinks ? 'LEFT JOIN product_shop_links psl ON psl.id = r.shop_link_id' : ''
  const { results } = await db.prepare(`
    SELECT
      r.id,
      r.ingredient_id,
      r.product_id,
      r.type,
      r.shop_link_id,
      r.recommendation_slot,
      COALESCE(r.sort_order, 0) AS sort_order,
      p.name AS product_name,
      p.brand AS product_brand,
      p.shop_link AS product_shop_link,
      p.moderation_status AS product_moderation_status,
      p.visibility AS product_visibility,
      ${shopLinkSelect}
    FROM product_recommendations r
    JOIN products p ON p.id = r.product_id
    ${shopLinkJoin}
    WHERE r.ingredient_id = ?
      AND r.recommendation_slot IN ('primary', 'alternative_1', 'alternative_2')
    ORDER BY r.sort_order ASC, r.id ASC
  `).bind(ingredientId).all<IngredientProductRecommendationRow>()
  const recommendations = results ?? []
  const slots = emptyIngredientProductRecommendationSlots()
  for (const row of recommendations) {
    if (!slots[row.recommendation_slot]) slots[row.recommendation_slot] = row
  }
  return { recommendations, slots }
}

async function formBelongsToIngredient(db: D1Database, formId: number, ingredientId: number): Promise<boolean> {
  const row = await db.prepare('SELECT id FROM ingredient_forms WHERE id = ? AND ingredient_id = ?')
    .bind(formId, ingredientId)
    .first<{ id: number }>()
  return Boolean(row)
}

async function articleSlugExists(db: D1Database, articleSlug: string): Promise<boolean> {
  const row = await db.prepare('SELECT slug FROM knowledge_articles WHERE slug = ?')
    .bind(articleSlug)
    .first<{ slug: string }>()
  return Boolean(row)
}

async function getKnowledgeArticleRow(db: D1Database, slug: string): Promise<KnowledgeArticleDbRow | null> {
  const columns = await getTableColumns(db, 'knowledge_articles')
  return await db.prepare(`
    SELECT
      slug,
      title,
      summary,
      body,
      status,
      reviewed_at,
      sources_json,
      ${columns.has('conclusion') ? 'conclusion' : 'NULL AS conclusion'},
      ${columns.has('featured_image_r2_key') ? 'featured_image_r2_key' : 'NULL AS featured_image_r2_key'},
      ${columns.has('featured_image_url') ? 'featured_image_url' : 'NULL AS featured_image_url'},
      ${columns.has('dose_min') ? 'dose_min' : 'NULL AS dose_min'},
      ${columns.has('dose_max') ? 'dose_max' : 'NULL AS dose_max'},
      ${columns.has('dose_unit') ? 'dose_unit' : 'NULL AS dose_unit'},
      ${columns.has('product_note') ? 'product_note' : 'NULL AS product_note'},
      created_at,
      updated_at,
      ${versionSelect(columns)}
    FROM knowledge_articles
    WHERE slug = ?
  `).bind(slug).first<KnowledgeArticleDbRow>()
}

async function getIngredientResearchStatusRow(db: D1Database, ingredientId: number): Promise<IngredientResearchStatusRow | null> {
  const columns = await getTableColumns(db, 'ingredient_research_status')
  return await db.prepare(`
    SELECT
      ingredient_id,
      research_status,
      calculation_status,
      internal_notes,
      blog_url,
      reviewed_at,
      review_due_at,
      created_at,
      updated_at,
      ${versionSelect(columns)}
    FROM ingredient_research_status
    WHERE ingredient_id = ?
  `).bind(ingredientId).first<IngredientResearchStatusRow>()
}

async function getIngredientResearchSourceRow(db: D1Database, sourceId: number): Promise<IngredientResearchSourceRow | null> {
  const columns = await getTableColumns(db, 'ingredient_research_sources')
  return await db.prepare(`
    SELECT
      id,
      ingredient_id,
      source_kind,
      organization,
      country,
      region,
      population,
      recommendation_type,
      no_recommendation,
      dose_min,
      dose_max,
      dose_unit,
      per_kg_body_weight,
      frequency,
      study_type,
      evidence_quality,
      duration,
      outcome,
      finding,
      source_title,
      source_url,
      doi,
      pubmed_id,
      notes,
      source_date,
      reviewed_at,
      ${ingredientResearchEvidenceSelect(columns)},
      created_at,
      updated_at,
      ${versionSelect(columns)}
    FROM ingredient_research_sources
    WHERE id = ?
  `).bind(sourceId).first<IngredientResearchSourceRow>()
}

async function getIngredientSafetyWarningAdminRow(db: D1Database, warningId: number): Promise<IngredientSafetyWarningAdminRow | null> {
  const columns = await getTableColumns(db, 'ingredient_safety_warnings')
  return await db.prepare(`
    SELECT
      w.id,
      w.ingredient_id,
      i.name AS ingredient_name,
      w.form_id,
      f.name AS form_name,
      w.short_label,
      w.popover_text,
      w.severity,
      w.article_slug,
      a.title AS article_title,
      w.min_amount,
      w.unit,
      w.active,
      w.created_at,
      ${versionSelect(columns, 'w')}
    FROM ingredient_safety_warnings w
    LEFT JOIN ingredients i ON i.id = w.ingredient_id
    LEFT JOIN ingredient_forms f ON f.id = w.form_id
    LEFT JOIN knowledge_articles a ON a.slug = w.article_slug
    WHERE w.id = ?
  `).bind(warningId).first<IngredientSafetyWarningAdminRow>()
}

async function validateIngredientResearchStatusPayload(
  body: Record<string, unknown>,
  existing: IngredientResearchStatusRow | null,
): Promise<ValidationResult<Omit<IngredientResearchStatusRow, 'ingredient_id' | 'created_at' | 'updated_at' | 'version'>>> {
  const researchStatusInput = hasOwnKey(body, 'research_status')
    ? body.research_status
    : hasOwnKey(body, 'status')
      ? body.status
      : undefined
  const researchStatus =
    enumValue(researchStatusInput, INGREDIENT_RESEARCH_STATUSES) ??
    existing?.research_status ??
    'unreviewed'
  if (!researchStatus) return validationError(`research_status must be one of ${INGREDIENT_RESEARCH_STATUSES.join(', ')}`)

  const calculationStatus = hasOwnKey(body, 'calculation_status')
    ? enumValue(body.calculation_status, INGREDIENT_CALCULATION_STATUSES)
    : existing?.calculation_status ?? 'not_started'
  if (!calculationStatus) return validationError(`calculation_status must be one of ${INGREDIENT_CALCULATION_STATUSES.join(', ')}`)

  const internalNotes = optionalTextField(body, 'internal_notes', 10000)
  if (!internalNotes.ok) return internalNotes

  const blogUrl = normalizeHttpUrlField(body, 'blog_url')
  if (!blogUrl.ok) return blogUrl

  const reviewedAt = optionalDateTextField(body, 'reviewed_at')
  if (!reviewedAt.ok) return reviewedAt

  const reviewDueAt = optionalDateTextField(body, 'review_due_at')
  if (!reviewDueAt.ok) return reviewDueAt

  return {
    ok: true,
    value: {
      research_status: researchStatus,
      calculation_status: calculationStatus,
      internal_notes: internalNotes.value === undefined ? existing?.internal_notes ?? null : internalNotes.value,
      blog_url: blogUrl.value === undefined ? existing?.blog_url ?? null : blogUrl.value,
      reviewed_at: reviewedAt.value === undefined ? existing?.reviewed_at ?? null : reviewedAt.value,
      review_due_at: reviewDueAt.value === undefined ? existing?.review_due_at ?? null : reviewDueAt.value,
    },
  }
}

async function validateIngredientResearchSourcePayload(
  db: D1Database,
  body: Record<string, unknown>,
  ingredientId: number,
  existing: IngredientResearchSourceRow | null,
): Promise<ValidationResult<IngredientResearchSourceMutation>> {
  const sourceKindInput = hasOwnKey(body, 'source_kind')
    ? body.source_kind
    : hasOwnKey(body, 'source_type')
      ? body.source_type
      : undefined
  const sourceKind =
    enumValue(sourceKindInput, INGREDIENT_RESEARCH_SOURCE_KINDS) ??
    existing?.source_kind ??
    null
  if (!sourceKind) return validationError(`source_kind must be one of ${INGREDIENT_RESEARCH_SOURCE_KINDS.join(', ')}`)

  const fields = [
    ['organization', 255],
    ['country', 100],
    ['region', 100],
    ['population', 255],
    ['recommendation_type', 255],
    ['dose_unit', 50],
    ['frequency', 255],
    ['study_type', 255],
    ['evidence_quality', 100],
    ['duration', 255],
    ['outcome', 1000],
    ['finding', 10000],
    ['doi', 255],
    ['pubmed_id', 100],
    ['notes', 10000],
  ] as const

  const textValues: Record<string, string | null> = {}
  for (const [key, maxLength] of fields) {
    const result = optionalTextField(body, key, maxLength)
    if (!result.ok) return result
    textValues[key] = result.value === undefined
      ? (existing?.[key as keyof IngredientResearchSourceRow] as string | null | undefined) ?? null
      : result.value
  }

  const sourceTitle = hasOwnKey(body, 'source_title')
    ? optionalTextField(body, 'source_title', 1000)
    : hasOwnKey(body, 'title')
      ? optionalTextField(body, 'title', 1000)
      : existing
        ? { ok: true as const, value: existing.source_title }
        : { ok: true as const, value: undefined }
  if (!sourceTitle.ok) return sourceTitle
  const finalSourceTitle = sourceTitle.value === undefined ? existing?.source_title ?? null : sourceTitle.value

  const doseUnit = hasOwnKey(body, 'dose_unit')
    ? optionalTextField(body, 'dose_unit', 50)
    : hasOwnKey(body, 'unit')
      ? optionalTextField(body, 'unit', 50)
      : existing
        ? { ok: true as const, value: existing.dose_unit }
        : { ok: true as const, value: undefined }
  if (!doseUnit.ok) return doseUnit
  const finalDoseUnit = doseUnit.value === undefined ? existing?.dose_unit ?? null : doseUnit.value

  const noRecommendation = optionalBooleanField(body, 'no_recommendation')
  if (!noRecommendation.ok) return noRecommendation

  const perKgBodyWeight = optionalBooleanField(body, 'per_kg_body_weight')
  if (!perKgBodyWeight.ok) return perKgBodyWeight

  const doseMin = optionalNumberField(body, 'dose_min', { min: 0 })
  if (!doseMin.ok) return doseMin

  const doseMax = optionalNumberField(body, 'dose_max', { min: 0 })
  if (!doseMax.ok) return doseMax

  const sourceUrl = normalizeHttpUrlField(body, 'source_url')
  if (!sourceUrl.ok) return sourceUrl

  const sourceDate = optionalDateTextField(body, 'source_date')
  if (!sourceDate.ok) return sourceDate

  const reviewedAt = optionalDateTextField(body, 'reviewed_at')
  if (!reviewedAt.ok) return reviewedAt

  const isRetracted = optionalBooleanField(body, 'is_retracted')
  if (!isRetracted.ok) return isRetracted

  const retractionCheckedAt = optionalDateTextField(body, 'retraction_checked_at')
  if (!retractionCheckedAt.ok) return retractionCheckedAt

  const retractionNoticeUrl = normalizeHttpUrlField(body, 'retraction_notice_url')
  if (!retractionNoticeUrl.ok) return retractionNoticeUrl

  const evidenceGrade = parseEvidenceGradeField(body, existing)
  if (!evidenceGrade.ok) return evidenceGrade

  const finalDoseMin = doseMin.value === undefined ? existing?.dose_min ?? null : doseMin.value
  const finalDoseMax = doseMax.value === undefined ? existing?.dose_max ?? null : doseMax.value
  if (finalDoseMin !== null && finalDoseMax !== null && finalDoseMin > finalDoseMax) {
    return validationError('dose_min must be <= dose_max')
  }

  if (!(await ingredientExists(db, ingredientId))) return validationError('Ingredient not found', 404)

  return {
    ok: true,
    value: {
      ingredient_id: ingredientId,
      source_kind: sourceKind,
      organization: textValues.organization,
      country: textValues.country,
      region: textValues.region,
      population: textValues.population,
      recommendation_type: textValues.recommendation_type,
      no_recommendation: noRecommendation.value === undefined ? existing?.no_recommendation ?? 0 : noRecommendation.value,
      dose_min: finalDoseMin,
      dose_max: finalDoseMax,
      dose_unit: finalDoseUnit,
      per_kg_body_weight: perKgBodyWeight.value === undefined ? existing?.per_kg_body_weight ?? 0 : perKgBodyWeight.value,
      frequency: textValues.frequency,
      study_type: textValues.study_type,
      evidence_quality: textValues.evidence_quality,
      duration: textValues.duration,
      outcome: textValues.outcome,
      finding: textValues.finding,
      source_title: finalSourceTitle,
      source_url: sourceUrl.value === undefined ? existing?.source_url ?? null : sourceUrl.value,
      doi: textValues.doi,
      pubmed_id: textValues.pubmed_id,
      notes: textValues.notes,
      source_date: sourceDate.value === undefined ? existing?.source_date ?? null : sourceDate.value,
      reviewed_at: reviewedAt.value === undefined ? existing?.reviewed_at ?? null : reviewedAt.value,
      is_retracted: isRetracted.value === undefined ? existing?.is_retracted ?? 0 : isRetracted.value,
      retraction_checked_at: retractionCheckedAt.value === undefined ? existing?.retraction_checked_at ?? null : retractionCheckedAt.value,
      retraction_notice_url: retractionNoticeUrl.value === undefined ? existing?.retraction_notice_url ?? null : retractionNoticeUrl.value,
      evidence_grade: evidenceGrade.value,
    },
  }
}

async function validateIngredientWarningPayload(
  db: D1Database,
  body: Record<string, unknown>,
  ingredientId: number,
  existing: IngredientSafetyWarningAdminRow | null,
): Promise<ValidationResult<IngredientSafetyWarningMutation>> {
  const targetIngredientId = hasOwnKey(body, 'ingredient_id')
    ? normalizeInteger(body.ingredient_id)
    : ingredientId
  if (!targetIngredientId || targetIngredientId <= 0) return validationError('ingredient_id must be a positive integer')
  if (!(await ingredientExists(db, targetIngredientId))) return validationError('Ingredient not found', 404)

  const formId = optionalPositiveIntegerField(body, 'form_id')
  if (!formId.ok) return formId
  const finalFormId = formId.value === undefined ? existing?.form_id ?? null : formId.value
  if (finalFormId !== null && !(await formBelongsToIngredient(db, finalFormId, targetIngredientId))) {
    return validationError('form_id must belong to the warning ingredient')
  }

  const shortLabel = hasOwnKey(body, 'short_label')
    ? requiredTextField(body, 'short_label', 255)
    : hasOwnKey(body, 'title')
      ? requiredTextField(body, 'title', 255)
      : existing
        ? { ok: true as const, value: existing.short_label }
        : requiredTextField(body, 'short_label', 255)
  if (!shortLabel.ok) return shortLabel

  const popoverText = hasOwnKey(body, 'popover_text')
    ? requiredTextField(body, 'popover_text', 2000)
    : hasOwnKey(body, 'message')
      ? requiredTextField(body, 'message', 2000)
      : existing
        ? { ok: true as const, value: existing.popover_text }
        : requiredTextField(body, 'popover_text', 2000)
  if (!popoverText.ok) return popoverText

  const severity = hasOwnKey(body, 'severity')
    ? enumValue(body.severity, INGREDIENT_WARNING_SEVERITIES)
    : existing?.severity ?? 'caution'
  if (!severity) return validationError(`severity must be one of ${INGREDIENT_WARNING_SEVERITIES.join(', ')}`)

  const articleSlug = optionalTextField(body, 'article_slug', 255)
  if (!articleSlug.ok) return articleSlug
  const finalArticleSlug = articleSlug.value === undefined ? existing?.article_slug ?? null : articleSlug.value
  if (finalArticleSlug && !(await articleSlugExists(db, finalArticleSlug))) {
    return validationError('article_slug not found', 404)
  }

  const minAmount = optionalNumberField(body, 'min_amount', { min: 0 })
  if (!minAmount.ok) return minAmount

  const unit = optionalTextField(body, 'unit', 50)
  if (!unit.ok) return unit

  const active = optionalBooleanField(body, 'active')
  if (!active.ok) return active

  return {
    ok: true,
    value: {
      ingredient_id: targetIngredientId,
      form_id: finalFormId,
      short_label: shortLabel.value,
      popover_text: popoverText.value,
      severity,
      article_slug: finalArticleSlug,
      min_amount: minAmount.value === undefined ? existing?.min_amount ?? null : minAmount.value,
      unit: unit.value === undefined ? existing?.unit ?? null : unit.value,
      active: active.value === undefined ? existing?.active ?? 1 : active.value,
    },
  }
}

type IngredientDisplayProfileMutation = Omit<IngredientDisplayProfileRow, 'id' | 'created_at' | 'updated_at' | 'version'>

async function getIngredientDisplayProfileRow(
  db: D1Database,
  ingredientId: number,
  formId: number | null,
  subIngredientId: number | null,
): Promise<IngredientDisplayProfileRow | null> {
  const columns = await getTableColumns(db, 'ingredient_display_profiles')
  return await db.prepare(`
    SELECT
      id,
      ingredient_id,
      form_id,
      sub_ingredient_id,
      effect_summary,
      timing,
      timing_note,
      intake_hint,
      card_note,
      created_at,
      updated_at,
      ${versionSelect(columns)}
    FROM ingredient_display_profiles
    WHERE ingredient_id = ?
      AND ((form_id IS NULL AND ? IS NULL) OR form_id = ?)
      AND ((sub_ingredient_id IS NULL AND ? IS NULL) OR sub_ingredient_id = ?)
  `).bind(ingredientId, formId, formId, subIngredientId, subIngredientId).first<IngredientDisplayProfileRow>()
}

async function validateIngredientDisplayProfilePayload(
  db: D1Database,
  body: Record<string, unknown>,
  ingredientId: number,
): Promise<ValidationResult<IngredientDisplayProfileMutation>> {
  if (!(await ingredientExists(db, ingredientId))) return validationError('Ingredient not found', 404)

  const formIdResult = optionalPositiveIntegerField(body, 'form_id')
  if (!formIdResult.ok) return formIdResult
  const subIngredientIdResult = optionalPositiveIntegerField(body, 'sub_ingredient_id')
  if (!subIngredientIdResult.ok) return subIngredientIdResult

  const formId = formIdResult.value ?? null
  const subIngredientId = subIngredientIdResult.value ?? null

  if (formId !== null && !(await formBelongsToIngredient(db, formId, ingredientId))) {
    return validationError('form_id must belong to the ingredient')
  }
  if (subIngredientId !== null) {
    const relation = await db.prepare(`
      SELECT 1 AS exists_flag
      FROM ingredient_sub_ingredients
      WHERE parent_ingredient_id = ?
        AND child_ingredient_id = ?
    `).bind(ingredientId, subIngredientId).first<{ exists_flag: number }>()
    if (!relation) return validationError('sub_ingredient_id must be a configured child of the ingredient')
  }

  const effectSummary = optionalTextField(body, 'effect_summary', 500)
  if (!effectSummary.ok) return effectSummary
  const timing = optionalTextField(body, 'timing', 255)
  if (!timing.ok) return timing
  const timingNote = optionalTextField(body, 'timing_note', 2000)
  if (!timingNote.ok) return timingNote
  const intakeHint = optionalTextField(body, 'intake_hint', 2000)
  if (!intakeHint.ok) return intakeHint
  const cardNote = optionalTextField(body, 'card_note', 2000)
  if (!cardNote.ok) return cardNote

  return {
    ok: true,
    value: {
      ingredient_id: ingredientId,
      form_id: formId,
      sub_ingredient_id: subIngredientId,
      effect_summary: effectSummary.value ?? null,
      timing: timing.value ?? null,
      timing_note: timingNote.value ?? null,
      intake_hint: intakeHint.value ?? null,
      card_note: cardNote.value ?? null,
    },
  }
}

async function getDoseRecommendationSourceMap(
  db: D1Database,
  recommendationIds: number[],
): Promise<Map<number, DoseRecommendationLinkedSource[]>> {
  const sourceMap = new Map<number, DoseRecommendationLinkedSource[]>()
  const ids = Array.from(new Set(recommendationIds.filter((id) => Number.isInteger(id) && id > 0)))
  if (ids.length === 0) return sourceMap

  const placeholders = ids.map(() => '?').join(', ')
  const researchColumns = await getTableColumns(db, 'ingredient_research_sources')
  const { results } = await db.prepare(`
    SELECT
      drs.id,
      drs.dose_recommendation_id,
      drs.research_source_id,
      irs.ingredient_id AS source_ingredient_id,
      drs.relevance_weight,
      drs.is_primary,
      drs.note,
      drs.created_at,
      irs.source_kind,
      irs.organization,
      irs.country,
      irs.region,
      irs.population,
      irs.recommendation_type,
      irs.no_recommendation,
      irs.dose_min,
      irs.dose_max,
      irs.dose_unit,
      irs.per_kg_body_weight,
      irs.frequency,
      irs.study_type,
      irs.evidence_quality,
      irs.duration,
      irs.outcome,
      irs.finding,
      irs.source_title,
      irs.source_url,
      irs.doi,
      irs.pubmed_id,
      irs.notes,
      irs.source_date,
      irs.reviewed_at,
      ${ingredientResearchEvidenceSelect(researchColumns, 'irs')}
    FROM dose_recommendation_sources drs
    JOIN ingredient_research_sources irs ON irs.id = drs.research_source_id
    WHERE drs.dose_recommendation_id IN (${placeholders})
    ORDER BY drs.dose_recommendation_id ASC, drs.is_primary DESC, drs.relevance_weight DESC, drs.id ASC
  `).bind(...ids).all<DoseRecommendationLinkedSource>()

  for (const source of results) {
    const current = sourceMap.get(source.dose_recommendation_id) ?? []
    current.push(source)
    sourceMap.set(source.dose_recommendation_id, current)
  }
  return sourceMap
}

async function attachDoseRecommendationSources(
  db: D1Database,
  rows: DoseRecommendationAdminRow[],
): Promise<DoseRecommendationAdminRow[]> {
  const sourceMap = await getDoseRecommendationSourceMap(db, rows.map((row) => row.id))
  return rows.map((row) => ({
    ...row,
    sources: sourceMap.get(row.id) ?? [],
  }))
}

async function validateDoseRecommendationSources(
  db: D1Database,
  rawSources: unknown,
  ingredientId: number,
): Promise<ValidationResult<DoseRecommendationSourceMutation[]>> {
  if (!Array.isArray(rawSources)) return validationError('sources must be an array')
  if (rawSources.length > 50) return validationError('sources must contain at most 50 items')

  const sources: DoseRecommendationSourceMutation[] = []
  const seenSourceIds = new Set<number>()
  let primaryCount = 0

  for (const [index, rawSource] of rawSources.entries()) {
    if (!rawSource || typeof rawSource !== 'object' || Array.isArray(rawSource)) {
      return validationError(`sources[${index}] must be an object`)
    }
    const sourceData = rawSource as Record<string, unknown>
    const rawSourceId = hasOwnKey(sourceData, 'research_source_id')
      ? sourceData.research_source_id
      : sourceData.source_id
    const sourceId = normalizeInteger(rawSourceId)
    if (sourceId === undefined || sourceId <= 0) {
      return validationError(`sources[${index}].research_source_id must be a positive integer`)
    }
    if (seenSourceIds.has(sourceId)) {
      return validationError('sources must not contain duplicate research_source_id values')
    }
    seenSourceIds.add(sourceId)

    const relevanceWeight = hasOwnKey(sourceData, 'relevance_weight')
      ? optionalNumberField(sourceData, 'relevance_weight', { min: 0, max: 100, integer: true })
      : { ok: true as const, value: 50 }
    if (!relevanceWeight.ok) return relevanceWeight
    if (relevanceWeight.value === null || relevanceWeight.value === undefined) {
      return validationError(`sources[${index}].relevance_weight is required`)
    }

    const isPrimary = hasOwnKey(sourceData, 'is_primary')
      ? optionalBooleanField(sourceData, 'is_primary')
      : { ok: true as const, value: 0 }
    if (!isPrimary.ok) return isPrimary
    const primary = isPrimary.value ?? 0
    primaryCount += primary === 1 ? 1 : 0
    if (primaryCount > 1) return validationError('Only one linked source can be primary')

    const note = optionalTextField(sourceData, 'note', 2000)
    if (!note.ok) return note

    sources.push({
      research_source_id: sourceId,
      relevance_weight: relevanceWeight.value,
      is_primary: primary,
      note: note.value ?? null,
    })
  }

  if (sources.length === 0) return { ok: true, value: [] }

  const placeholders = sources.map(() => '?').join(', ')
  const { results: sourceRows } = await db.prepare(`
    SELECT id, ingredient_id
    FROM ingredient_research_sources
    WHERE id IN (${placeholders})
  `).bind(...sources.map((source) => source.research_source_id)).all<{ id: number; ingredient_id: number }>()

  if (sourceRows.length !== sources.length) return validationError('All source research_source_id values must exist', 404)
  const sourceIngredientById = new Map(sourceRows.map((row) => [row.id, row.ingredient_id]))
  for (const source of sources) {
    if (sourceIngredientById.get(source.research_source_id) !== ingredientId) {
      return validationError('All linked sources must belong to the same ingredient as the dose recommendation')
    }
  }

  return { ok: true, value: sources }
}

async function replaceDoseRecommendationSources(
  db: D1Database,
  recommendationId: number,
  sources: DoseRecommendationSourceMutation[],
): Promise<void> {
  const statements = [
    db.prepare('DELETE FROM dose_recommendation_sources WHERE dose_recommendation_id = ?').bind(recommendationId),
    ...sources.map((source) => db.prepare(`
      INSERT INTO dose_recommendation_sources (
        dose_recommendation_id,
        research_source_id,
        relevance_weight,
        is_primary,
        note
      ) VALUES (?, ?, ?, ?, ?)
    `).bind(
      recommendationId,
      source.research_source_id,
      source.relevance_weight,
      source.is_primary,
      source.note,
    )),
  ]
  await db.batch(statements)
}

async function getDoseRecommendationAdminRow(db: D1Database, id: number): Promise<DoseRecommendationAdminRow | null> {
  const columns = await getTableColumns(db, 'dose_recommendations')
  const row = await db.prepare(`
    SELECT
      dr.id,
      dr.ingredient_id,
      i.name AS ingredient_name,
      dr.population_id,
      p.slug AS population_slug,
      p.name_de AS population_name_de,
      dr.source_type,
      dr.source_label,
      dr.source_url,
      dr.dose_min,
      dr.dose_max,
      dr.unit,
      dr.per_kg_body_weight,
      dr.per_kg_cap,
      dr.timing,
      dr.context_note,
      dr.sex_filter,
      dr.is_athlete,
      dr.purpose,
      dr.is_default,
      dr.is_active,
      dr.relevance_score,
      dr.created_by_user_id,
      u.email AS created_by_email,
      dr.is_public,
      dr.verified_profile_id,
      vp.slug AS verified_profile_slug,
      COALESCE(vp.name, dr.verified_profile_name) AS verified_profile_name,
      dr.category_name,
      dr.published_at,
      dr.verified_at,
      dr.review_due_at,
      dr.superseded_by_id,
      dr.created_at,
      dr.updated_at,
      ${versionSelect(columns, 'dr')}
    FROM dose_recommendations dr
    JOIN ingredients i ON i.id = dr.ingredient_id
    JOIN populations p ON p.id = dr.population_id
    LEFT JOIN users u ON u.id = dr.created_by_user_id
    LEFT JOIN verified_profiles vp ON vp.id = dr.verified_profile_id
    WHERE dr.id = ?
  `).bind(id).first<DoseRecommendationAdminRow>()
  if (!row) return null
  const [withSources] = await attachDoseRecommendationSources(db, [row])
  return withSources
}

async function validateDoseRecommendationPayload(
  db: D1Database,
  body: Record<string, unknown>,
  existing: DoseRecommendationAdminRow | null,
): Promise<ValidationResult<DoseRecommendationMutation>> {
  const isCreate = existing === null

  const ingredientId = hasOwnKey(body, 'ingredient_id')
    ? normalizeInteger(body.ingredient_id)
    : existing?.ingredient_id
  if (!ingredientId || ingredientId <= 0) return validationError('ingredient_id must be a positive integer')

  const ingredient = await db.prepare('SELECT id FROM ingredients WHERE id = ?')
    .bind(ingredientId)
    .first<{ id: number }>()
  if (!ingredient) return validationError('Ingredient not found', 404)

  let population: PopulationLookupRow | null = null
  if (hasOwnKey(body, 'population_id')) {
    const populationId = normalizeInteger(body.population_id)
    if (!populationId || populationId <= 0) return validationError('population_id must be a positive integer')
    population = await db.prepare('SELECT id, slug, name_de FROM populations WHERE id = ?')
      .bind(populationId)
      .first<PopulationLookupRow>()
  } else if (hasOwnKey(body, 'population_slug')) {
    const populationSlug = optionalText(body.population_slug)
    if (!populationSlug) return validationError('population_slug is required when provided')
    population = await db.prepare('SELECT id, slug, name_de FROM populations WHERE slug = ?')
      .bind(populationSlug)
      .first<PopulationLookupRow>()
  } else if (existing) {
    population = await db.prepare('SELECT id, slug, name_de FROM populations WHERE id = ?')
      .bind(existing.population_id)
      .first<PopulationLookupRow>()
  }
  if (!population) {
    return validationError(isCreate ? 'population_id or population_slug is required' : 'Population not found', isCreate ? 400 : 404)
  }

  const sourceType = hasOwnKey(body, 'source_type')
    ? enumValue(body.source_type, DOSE_RECOMMENDATION_SOURCE_TYPES)
    : existing?.source_type
  if (!sourceType) return validationError(`source_type must be one of ${DOSE_RECOMMENDATION_SOURCE_TYPES.join(', ')}`)

  const sourceLabelResult = hasOwnKey(body, 'source_label')
    ? requiredTextField(body, 'source_label', 255)
    : existing ? { ok: true as const, value: existing.source_label } : validationError('source_label is required')
  if (!sourceLabelResult.ok) return sourceLabelResult

  const sourceUrlResult = hasOwnKey(body, 'source_url')
    ? normalizeSourceUrl(body.source_url)
    : { ok: true as const, value: existing?.source_url }
  if (!sourceUrlResult.ok) return sourceUrlResult
  const sourceUrl = sourceUrlResult.value ?? null

  const sourceLinksResult = hasOwnKey(body, 'sources')
    ? await validateDoseRecommendationSources(db, body.sources, ingredientId)
    : existing
      ? { ok: true as const, value: undefined }
      : { ok: true as const, value: [] }
  if (!sourceLinksResult.ok) return sourceLinksResult

  if (!hasOwnKey(body, 'sources') && existing?.sources.some((source) => source.source_ingredient_id !== ingredientId)) {
    return validationError('Existing linked sources do not belong to the target ingredient; provide a replacement sources array')
  }

  const effectiveLinkedSourceCount = sourceLinksResult.value !== undefined
    ? sourceLinksResult.value.length
    : existing?.sources.length ?? 0
  if ((sourceType === 'official' || sourceType === 'study' || sourceType === 'user_public') && !sourceUrl && effectiveLinkedSourceCount === 0) {
    return validationError('At least one linked source or source_url fallback is required for official, study, and user_public recommendations')
  }

  const doseMaxResult = hasOwnKey(body, 'dose_max')
    ? optionalNumberField(body, 'dose_max', { min: 0, minExclusive: true, max: 1000000000 })
    : existing ? { ok: true as const, value: existing.dose_max } : validationError('dose_max is required')
  if (!doseMaxResult.ok) return doseMaxResult
  if (doseMaxResult.value === null || doseMaxResult.value === undefined) return validationError('dose_max is required')
  const doseMax = doseMaxResult.value

  const doseMinResult = hasOwnKey(body, 'dose_min')
    ? optionalNumberField(body, 'dose_min', { min: 0, max: 1000000000 })
    : { ok: true as const, value: existing?.dose_min ?? null }
  if (!doseMinResult.ok) return doseMinResult
  const doseMin = doseMinResult.value ?? null
  if (doseMin !== null && doseMin > doseMax) return validationError('dose_min must be <= dose_max')

  const unitResult = hasOwnKey(body, 'unit')
    ? requiredTextField(body, 'unit', 32)
    : existing ? { ok: true as const, value: existing.unit } : validationError('unit is required')
  if (!unitResult.ok) return unitResult

  const perKgResult = hasOwnKey(body, 'per_kg_body_weight')
    ? optionalNumberField(body, 'per_kg_body_weight', { min: 0, minExclusive: true, max: 1000000000 })
    : { ok: true as const, value: existing?.per_kg_body_weight ?? null }
  if (!perKgResult.ok) return perKgResult

  const perKgCapResult = hasOwnKey(body, 'per_kg_cap')
    ? optionalNumberField(body, 'per_kg_cap', { min: 0, minExclusive: true, max: 1000000000 })
    : { ok: true as const, value: existing?.per_kg_cap ?? null }
  if (!perKgCapResult.ok) return perKgCapResult

  const timingResult = optionalTextField(body, 'timing', 500)
  if (!timingResult.ok) return timingResult
  const contextNoteResult = optionalTextField(body, 'context_note', 2000)
  if (!contextNoteResult.ok) return contextNoteResult
  const categoryNameResult = optionalTextField(body, 'category_name', 255)
  if (!categoryNameResult.ok) return categoryNameResult

  const sexFilter = hasOwnKey(body, 'sex_filter')
    ? body.sex_filter === null || body.sex_filter === ''
      ? null
      : enumValue(body.sex_filter, DOSE_RECOMMENDATION_SEX_FILTERS)
    : existing?.sex_filter ?? null
  if (sexFilter === null && hasOwnKey(body, 'sex_filter') && body.sex_filter !== null && body.sex_filter !== '') {
    return validationError(`sex_filter must be null, male, or female`)
  }

  const isAthleteResult = optionalBooleanField(body, 'is_athlete')
  if (!isAthleteResult.ok) return isAthleteResult
  const isDefaultResult = optionalBooleanField(body, 'is_default')
  if (!isDefaultResult.ok) return isDefaultResult
  const isActiveResult = optionalBooleanField(body, 'is_active')
  if (!isActiveResult.ok) return isActiveResult
  const isPublicResult = optionalBooleanField(body, 'is_public')
  if (!isPublicResult.ok) return isPublicResult

  const purpose = hasOwnKey(body, 'purpose')
    ? enumValue(body.purpose, DOSE_RECOMMENDATION_PURPOSES)
    : existing?.purpose ?? 'maintenance'
  if (!purpose) return validationError(`purpose must be one of ${DOSE_RECOMMENDATION_PURPOSES.join(', ')}`)

  const relevanceResult = hasOwnKey(body, 'relevance_score')
    ? optionalNumberField(body, 'relevance_score', { min: 0, max: 100, integer: true })
    : { ok: true as const, value: existing?.relevance_score ?? 50 }
  if (!relevanceResult.ok) return relevanceResult
  if (relevanceResult.value === null || relevanceResult.value === undefined) return validationError('relevance_score is required')

  const createdByUserResult = optionalPositiveIntegerField(body, 'created_by_user_id')
  if (!createdByUserResult.ok) return createdByUserResult
  const createdByUserId = createdByUserResult.value === undefined ? existing?.created_by_user_id ?? null : createdByUserResult.value
  if (createdByUserId !== null) {
    const user = await db.prepare('SELECT id FROM users WHERE id = ?').bind(createdByUserId).first<{ id: number }>()
    if (!user) return validationError('created_by_user_id not found', 404)
  }

  const verifiedProfileResult = optionalPositiveIntegerField(body, 'verified_profile_id')
  if (!verifiedProfileResult.ok) return verifiedProfileResult
  const verifiedProfileId = verifiedProfileResult.value === undefined ? existing?.verified_profile_id ?? null : verifiedProfileResult.value
  let verifiedProfile: VerifiedProfileLookupRow | null = null
  if (verifiedProfileId !== null) {
    verifiedProfile = await db.prepare('SELECT id, slug, name FROM verified_profiles WHERE id = ?')
      .bind(verifiedProfileId)
      .first<VerifiedProfileLookupRow>()
    if (!verifiedProfile) return validationError('verified_profile_id not found', 404)
  }
  if (sourceType === 'profile' && verifiedProfileId === null) {
    return validationError('verified_profile_id is required for profile recommendations')
  }

  const publishedAtResult = optionalUnixTimestampField(body, 'published_at')
  if (!publishedAtResult.ok) return publishedAtResult
  const verifiedAtResult = optionalUnixTimestampField(body, 'verified_at')
  if (!verifiedAtResult.ok) return verifiedAtResult
  const reviewDueAtResult = optionalUnixTimestampField(body, 'review_due_at')
  if (!reviewDueAtResult.ok) return reviewDueAtResult

  const supersededResult = optionalPositiveIntegerField(body, 'superseded_by_id')
  if (!supersededResult.ok) return supersededResult
  const supersededById = supersededResult.value === undefined ? existing?.superseded_by_id ?? null : supersededResult.value
  if (supersededById !== null) {
    if (existing && supersededById === existing.id) return validationError('superseded_by_id must not reference the same row')
    const superseding = await db.prepare('SELECT id FROM dose_recommendations WHERE id = ?')
      .bind(supersededById)
      .first<{ id: number }>()
    if (!superseding) return validationError('superseded_by_id not found', 404)
  }

  const mutation: DoseRecommendationMutation = {
    ingredient_id: ingredientId,
    population_id: population.id,
    source_type: sourceType,
    source_label: sourceLabelResult.value,
    source_url: sourceUrl,
    dose_min: doseMin,
    dose_max: doseMax,
    unit: unitResult.value,
    per_kg_body_weight: perKgResult.value ?? null,
    per_kg_cap: perKgCapResult.value ?? null,
    timing: timingResult.value === undefined ? existing?.timing ?? null : timingResult.value,
    context_note: contextNoteResult.value === undefined ? existing?.context_note ?? null : contextNoteResult.value,
    sex_filter: sexFilter,
    is_athlete: isAthleteResult.value ?? existing?.is_athlete ?? 0,
    purpose,
    is_default: isDefaultResult.value ?? existing?.is_default ?? 0,
    is_active: isActiveResult.value ?? existing?.is_active ?? 1,
    relevance_score: relevanceResult.value,
    created_by_user_id: createdByUserId,
    is_public: isPublicResult.value ?? existing?.is_public ?? 0,
    verified_profile_id: verifiedProfileId,
    category_name: categoryNameResult.value === undefined ? existing?.category_name ?? null : categoryNameResult.value,
    population_slug: population.slug,
    verified_profile_name: verifiedProfile?.name ?? null,
    published_at: publishedAtResult.value === undefined ? existing?.published_at ?? null : publishedAtResult.value,
    verified_at: verifiedAtResult.value === undefined ? existing?.verified_at ?? null : verifiedAtResult.value,
    review_due_at: reviewDueAtResult.value === undefined ? existing?.review_due_at ?? null : reviewDueAtResult.value,
    superseded_by_id: supersededById,
    sources: sourceLinksResult.value,
  }

  if (mutation.is_default === 1 && mutation.is_active === 1) {
    const defaultConflict = await db.prepare(`
      SELECT id
      FROM dose_recommendations
      WHERE ingredient_id = ?
        AND population_id = ?
        AND COALESCE(sex_filter, '_') = COALESCE(?, '_')
        AND purpose = ?
        AND is_athlete = ?
        AND is_default = 1
        AND is_active = 1
        AND (? IS NULL OR id <> ?)
      LIMIT 1
    `).bind(
      mutation.ingredient_id,
      mutation.population_id,
      mutation.sex_filter,
      mutation.purpose,
      mutation.is_athlete,
      existing?.id ?? null,
      existing?.id ?? null,
    ).first<{ id: number }>()
    if (defaultConflict) {
      return validationError('An active default recommendation already exists for this ingredient/population/targeting combination', 409)
    }
  }

  return { ok: true, value: mutation }
}

async function getNutrientReferenceValueRow(
  db: D1Database,
  id: number,
): Promise<NutrientReferenceValueRow | null> {
  if (!(await hasTable(db, 'nutrient_reference_values'))) return null
  const columns = await getTableColumns(db, 'nutrient_reference_values')
  if (!columns.has('id') || !columns.has('ingredient_id') || !columns.has('organization') || !columns.has('kind') || !columns.has('unit')) {
    return null
  }
  return await db.prepare(`
    SELECT
      ${nutrientReferenceValueSelect(columns)}
    FROM nutrient_reference_values
    WHERE id = ?
  `).bind(id).first<NutrientReferenceValueRow>()
}

async function validateNutrientReferenceValuePayload(
  db: D1Database,
  body: Record<string, unknown>,
  routeIngredientId: number | null,
  existing: NutrientReferenceValueRow | null,
): Promise<ValidationResult<NutrientReferenceValueMutation>> {
  const bodyIngredientId = hasOwnKey(body, 'ingredient_id')
    ? normalizeInteger(body.ingredient_id)
    : undefined
  if (hasOwnKey(body, 'ingredient_id') && (!bodyIngredientId || bodyIngredientId <= 0)) {
    return validationError('ingredient_id must be a positive integer')
  }
  if (routeIngredientId !== null && bodyIngredientId !== undefined && bodyIngredientId !== routeIngredientId) {
    return validationError('ingredient_id must match the route ingredient id')
  }
  const ingredientId = routeIngredientId ?? bodyIngredientId ?? existing?.ingredient_id
  if (!ingredientId || ingredientId <= 0) return validationError('ingredient_id must be a positive integer')
  if (!(await ingredientExists(db, ingredientId))) return validationError('Ingredient not found', 404)

  const populationIdResult = optionalPositiveIntegerField(body, 'population_id')
  if (!populationIdResult.ok) return populationIdResult
  const populationId = populationIdResult.value === undefined ? existing?.population_id ?? null : populationIdResult.value
  if (populationId !== null) {
    const population = await db.prepare('SELECT id FROM populations WHERE id = ?')
      .bind(populationId)
      .first<{ id: number }>()
    if (!population) return validationError('population_id must reference an existing population', 404)
  }

  const organization = hasOwnKey(body, 'organization')
    ? requiredTextField(body, 'organization', 255)
    : existing ? { ok: true as const, value: existing.organization } : validationError('organization is required')
  if (!organization.ok) return organization

  const kind = hasOwnKey(body, 'kind')
    ? enumValue(body.kind, NUTRIENT_REFERENCE_VALUE_KINDS)
    : existing?.kind
  if (!kind) return validationError(`kind must be one of ${NUTRIENT_REFERENCE_VALUE_KINDS.join(', ')}`)

  const valueResult = hasOwnKey(body, 'value')
    ? optionalNumberField(body, 'value', { min: 0 })
    : existing ? { ok: true as const, value: existing.value } : validationError('value is required')
  if (!valueResult.ok) return valueResult
  if (valueResult.value === null || valueResult.value === undefined) return validationError('value is required')

  const unit = hasOwnKey(body, 'unit')
    ? requiredTextField(body, 'unit', 50)
    : existing ? { ok: true as const, value: existing.unit } : validationError('unit is required')
  if (!unit.ok) return unit

  const region = optionalTextField(body, 'region', 100)
  if (!region.ok) return region

  const sourceUrl = normalizeHttpUrlField(body, 'source_url')
  if (!sourceUrl.ok) return sourceUrl

  const sourceLabel = optionalTextField(body, 'source_label', 255)
  if (!sourceLabel.ok) return sourceLabel

  const sourceYear = optionalNumberField(body, 'source_year', { min: 1900, max: 2100, integer: true })
  if (!sourceYear.ok) return sourceYear

  const notesInput = hasOwnKey(body, 'notes')
    ? optionalTextField(body, 'notes', 5000)
    : hasOwnKey(body, 'note')
      ? optionalTextField(body, 'note', 5000)
      : { ok: true as const, value: undefined }
  if (!notesInput.ok) return notesInput

  return {
    ok: true,
    value: {
      ingredient_id: ingredientId,
      population_id: populationId,
      organization: organization.value,
      region: region.value === undefined ? existing?.region ?? null : region.value,
      kind,
      value: valueResult.value,
      unit: unit.value,
      source_url: sourceUrl.value === undefined ? existing?.source_url ?? null : sourceUrl.value,
      source_label: sourceLabel.value === undefined ? existing?.source_label ?? null : sourceLabel.value,
      source_year: sourceYear.value === undefined ? existing?.source_year ?? null : sourceYear.value,
      notes: notesInput.value === undefined ? existing?.notes ?? existing?.note ?? null : notesInput.value,
    },
  }
}

function buildNutrientReferenceValueFields(
  columns: Set<string>,
  data: NutrientReferenceValueMutation,
): Array<[string, string | number | null]> {
  const fields: Array<[string, string | number | null]> = [
    ['ingredient_id', data.ingredient_id],
    ['organization', data.organization],
    ['kind', data.kind],
    ['unit', data.unit],
  ]
  if (columns.has('population_id')) fields.push(['population_id', data.population_id])
  if (columns.has('region')) fields.push(['region', data.region])
  if (columns.has('value')) fields.push(['value', data.value])
  if (columns.has('value_min')) fields.push(['value_min', data.value])
  if (columns.has('value_max')) fields.push(['value_max', columns.has('value_min') || columns.has('value') ? null : data.value])
  if (columns.has('source_url')) fields.push(['source_url', data.source_url])
  if (columns.has('source_label')) fields.push(['source_label', data.source_label])
  if (columns.has('source_year')) fields.push(['source_year', data.source_year])
  if (columns.has('notes')) fields.push(['notes', data.notes])
  if (columns.has('note')) fields.push(['note', data.notes])
  return fields
}

function nrvSchemaSupportsMutation(columns: Set<string>): boolean {
  return (
    columns.has('id') &&
    columns.has('ingredient_id') &&
    columns.has('organization') &&
    columns.has('kind') &&
    columns.has('unit') &&
    (columns.has('value') || columns.has('value_min') || columns.has('value_max'))
  )
}

function normalizeDoseUnit(unit: string | null | undefined): string | null {
  if (!unit) return null
  const normalized = unit.trim().toLowerCase()
  if (['ug', 'mcg', '\u00b5g', '\u03bcg'].includes(normalized)) return 'ug'
  if (normalized === 'mg') return 'mg'
  if (normalized === 'g') return 'g'
  if (['iu', 'ie'].includes(normalized)) return 'iu'
  return normalized || null
}

function convertDoseUnit(value: number, fromUnit: string, toUnit: string): number | null {
  const from = normalizeDoseUnit(fromUnit)
  const to = normalizeDoseUnit(toUnit)
  if (!from || !to) return null
  const massFactors: Record<string, number> = { ug: 0.001, mg: 1, g: 1000 }
  if (from in massFactors && to in massFactors) return value * massFactors[from] / massFactors[to]
  if (from === to) return value
  return null
}

type DosePlausibilityWarning = {
  source: 'ingredient_upper_limit' | 'nutrient_reference_values'
  severity: 'near_upper_limit' | 'exceeds_upper_limit'
  message: string
  dose_value: number
  dose_unit: string
  compared_value: number
  compared_unit: string
  ratio: number
  organization?: string | null
  source_url?: string | null
  note?: string | null
}

function makeDosePlausibilityWarning(
  source: DosePlausibilityWarning['source'],
  doseMax: number,
  doseUnit: string,
  limitValue: number | null,
  limitUnit: string | null,
  metadata: { organization?: string | null; source_url?: string | null; note?: string | null } = {},
): DosePlausibilityWarning | null {
  if (limitValue === null || limitValue <= 0 || !limitUnit) return null
  const convertedDose = convertDoseUnit(doseMax, doseUnit, limitUnit)
  if (convertedDose === null) return null
  const ratio = convertedDose / limitValue
  if (ratio < 0.9) return null
  const severity = ratio > 1 ? 'exceeds_upper_limit' : 'near_upper_limit'
  return {
    source,
    severity,
    message: severity === 'exceeds_upper_limit'
      ? 'Die gespeicherte Dosis liegt ueber einem bekannten Upper-Limit-Signal.'
      : 'Die gespeicherte Dosis liegt nahe an einem bekannten Upper-Limit-Signal.',
    dose_value: doseMax,
    dose_unit: doseUnit,
    compared_value: limitValue,
    compared_unit: limitUnit,
    ratio: Math.round(ratio * 1000) / 1000,
    ...metadata,
  }
}

async function buildDosePlausibilityWarnings(
  db: D1Database,
  recommendation: DoseRecommendationAdminRow | DoseRecommendationMutation | null,
): Promise<DosePlausibilityWarning[]> {
  if (!recommendation || (recommendation.per_kg_body_weight ?? 0) > 0) return []
  const warnings: DosePlausibilityWarning[] = []
  const ingredientLimit = await db.prepare(`
    SELECT upper_limit, upper_limit_unit, upper_limit_note
    FROM ingredients
    WHERE id = ?
  `).bind(recommendation.ingredient_id).first<{
    upper_limit: number | null
    upper_limit_unit: string | null
    upper_limit_note: string | null
  }>()
  const ingredientWarning = makeDosePlausibilityWarning(
    'ingredient_upper_limit',
    recommendation.dose_max,
    recommendation.unit,
    ingredientLimit?.upper_limit ?? null,
    ingredientLimit?.upper_limit_unit ?? null,
    { note: ingredientLimit?.upper_limit_note ?? null },
  )
  if (ingredientWarning) warnings.push(ingredientWarning)

  if (!(await hasTable(db, 'nutrient_reference_values'))) return warnings
  const columns = await getTableColumns(db, 'nutrient_reference_values')
  if (!nrvSchemaSupportsMutation(columns)) return warnings
  const valueExpr = columns.has('value')
    ? 'value'
    : columns.has('value_min') && columns.has('value_max')
      ? 'COALESCE(value_max, value_min)'
      : columns.has('value_max')
        ? 'value_max'
        : 'value_min'
  const noteExpr = columns.has('notes')
    ? 'notes'
    : columns.has('note')
      ? 'note'
      : 'NULL'
  const organizationExpr = columns.has('organization') ? 'organization' : 'NULL'
  const sourceUrlExpr = columns.has('source_url') ? 'source_url' : 'NULL'
  const populationPredicate = columns.has('population_id')
    ? 'AND (population_id = ? OR population_id IS NULL)'
    : ''
  const orderByPopulation = columns.has('population_id')
    ? 'CASE WHEN population_id = ? THEN 0 ELSE 1 END,'
    : ''
  const bindings = columns.has('population_id')
    ? [recommendation.ingredient_id, recommendation.population_id, recommendation.population_id]
    : [recommendation.ingredient_id]
  const { results } = await db.prepare(`
    SELECT
      ${valueExpr} AS value,
      unit,
      ${organizationExpr} AS organization,
      ${sourceUrlExpr} AS source_url,
      ${noteExpr} AS note
    FROM nutrient_reference_values
    WHERE ingredient_id = ?
      AND kind = 'ul'
      ${populationPredicate}
    ORDER BY ${orderByPopulation} value ASC, id ASC
    LIMIT 5
  `).bind(...bindings).all<{
    value: number | null
    unit: string | null
    organization: string | null
    source_url: string | null
    note: string | null
  }>()

  for (const row of results ?? []) {
    const warning = makeDosePlausibilityWarning(
      'nutrient_reference_values',
      recommendation.dose_max,
      recommendation.unit,
      row.value,
      row.unit,
      {
        organization: row.organization,
        source_url: row.source_url,
        note: row.note,
      },
    )
    if (warning) warnings.push(warning)
  }
  return warnings
}

async function getSubIngredientMapping(
  db: D1Database,
  parentIngredientId: number,
  childIngredientId: number,
): Promise<IngredientSubIngredientAdminRow | null> {
  return await db.prepare(`
    SELECT
      isi.parent_ingredient_id,
      parent.name AS parent_name,
      parent.unit AS parent_unit,
      isi.child_ingredient_id,
      child.name AS child_name,
      child.unit AS child_unit,
      isi.prompt_label,
      isi.is_default_prompt,
      isi.sort_order,
      isi.created_at
    FROM ingredient_sub_ingredients isi
    JOIN ingredients parent ON parent.id = isi.parent_ingredient_id
    JOIN ingredients child ON child.id = isi.child_ingredient_id
    WHERE isi.parent_ingredient_id = ? AND isi.child_ingredient_id = ?
  `).bind(parentIngredientId, childIngredientId).first<IngredientSubIngredientAdminRow>()
}

async function attachUserProductIngredients(
  db: D1Database,
  products: Record<string, unknown>[],
): Promise<Array<Record<string, unknown> & { ingredients: UserProductIngredientRow[] }>> {
  if (products.length === 0) return []
  const ids = products
    .map((product) => Number(product.id))
    .filter((id) => Number.isInteger(id) && id > 0)
  if (ids.length === 0) return products.map((product) => ({ ...product, ingredients: [] }))

  const placeholders = ids.map(() => '?').join(',')
  const { results } = await db.prepare(`
    SELECT upi.*, i.name as ingredient_name, i.unit as ingredient_unit,
           parent.name as parent_ingredient_name
    FROM user_product_ingredients upi
    JOIN ingredients i ON i.id = upi.ingredient_id
    LEFT JOIN ingredients parent ON parent.id = upi.parent_ingredient_id
    WHERE upi.user_product_id IN (${placeholders})
    ORDER BY upi.user_product_id ASC, upi.is_main DESC, upi.search_relevant DESC, upi.id ASC
  `).bind(...ids).all<UserProductIngredientRow>()

  const byProduct = new Map<number, UserProductIngredientRow[]>()
  for (const row of results) {
    const list = byProduct.get(row.user_product_id) ?? []
    list.push(row)
    byProduct.set(row.user_product_id, list)
  }

  return products.map((product) => ({
    ...product,
    ingredients: byProduct.get(Number(product.id)) ?? [],
  }))
}

function buildProductIngredientInsert(
  db: D1Database,
  productId: number,
  ingredient: UserProductIngredientRow,
): D1PreparedStatement {
  return db.prepare(`
    INSERT INTO product_ingredients (
      product_id, ingredient_id, is_main, quantity, unit, form_id,
      basis_quantity, basis_unit, search_relevant, parent_ingredient_id
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    productId,
    ingredient.ingredient_id,
    ingredient.is_main === 1 ? 1 : 0,
    ingredient.quantity,
    ingredient.unit,
    ingredient.form_id,
    ingredient.basis_quantity,
    ingredient.basis_unit,
    ingredient.search_relevant,
    ingredient.parent_ingredient_id,
  )
}

async function getProductPublishPayloadByProductId(
  db: D1Database,
  productId: number,
): Promise<{ product: ProductRow; ingredients: unknown[] } | null> {
  const product = await db.prepare('SELECT * FROM products WHERE id = ?').bind(productId).first<ProductRow>()
  if (!product) return null
  const { results: ingredients } = await db.prepare(`
    SELECT pi.*, i.name as ingredient_name, i.unit as ingredient_unit,
           parent.name as parent_ingredient_name
    FROM product_ingredients pi
    JOIN ingredients i ON i.id = pi.ingredient_id
    LEFT JOIN ingredients parent ON parent.id = pi.parent_ingredient_id
    WHERE pi.product_id = ?
    ORDER BY pi.is_main DESC, pi.search_relevant DESC, pi.id ASC
  `).bind(productId).all()
  return { product, ingredients }
}

async function getProductPublishPayloadBySourceUserProductId(
  db: D1Database,
  userProductId: number,
): Promise<{ product: ProductRow; ingredients: unknown[] } | null> {
  const product = await db.prepare(
    'SELECT * FROM products WHERE source_user_product_id = ?'
  ).bind(userProductId).first<ProductRow>()
  if (!product) return null
  return getProductPublishPayloadByProductId(db, product.id)
}

async function validateUserProductPublish(
  db: D1Database,
  ingredients: UserProductIngredientRow[],
): Promise<string | null> {
  const maxRows = 50
  if (ingredients.length === 0) return 'Mindestens ein Wirkstoff ist fuer Publish erforderlich.'
  if (ingredients.length > maxRows) return `Maximal ${maxRows} Wirkstoffzeilen sind erlaubt.`

  const duplicateKeys = new Set<string>()
  let searchRelevantCount = 0

  for (const row of ingredients) {
    const duplicateKey = `${row.ingredient_id}:${row.form_id ?? ''}:${row.parent_ingredient_id ?? ''}`
    if (duplicateKeys.has(duplicateKey)) return 'Doppelte Wirkstoffzeilen sind nicht erlaubt.'
    duplicateKeys.add(duplicateKey)

    if (row.search_relevant === 1) {
      searchRelevantCount += 1
      if (
        row.quantity === null ||
        row.quantity <= 0 ||
        !row.unit ||
        row.unit.trim().length === 0 ||
        row.basis_quantity === null ||
        row.basis_quantity <= 0 ||
        !row.basis_unit ||
        row.basis_unit.trim().length === 0
      ) {
        return 'Suchrelevante Wirkstoffe brauchen quantity, unit, basis_quantity und basis_unit.'
      }
    }
  }

  if (searchRelevantCount === 0) return 'Mindestens ein suchrelevanter Wirkstoff ist fuer Publish erforderlich.'

  const ingredientIds = [...new Set(ingredients.map((row) => row.ingredient_id))]
  const ingredientPlaceholders = ingredientIds.map(() => '?').join(',')
  const ingredientCount = await db.prepare(
    `SELECT COUNT(*) as count FROM ingredients WHERE id IN (${ingredientPlaceholders})`
  ).bind(...ingredientIds).first<CountRow>()
  if ((ingredientCount?.count ?? 0) !== ingredientIds.length) return 'Mindestens ein Wirkstoff existiert nicht.'

  const formRows = ingredients.filter((row) => row.form_id !== null)
  if (formRows.length > 0) {
    const formIds = [...new Set(formRows.map((row) => row.form_id as number))]
    const formPlaceholders = formIds.map(() => '?').join(',')
    const { results: forms } = await db.prepare(
      `SELECT id, ingredient_id FROM ingredient_forms WHERE id IN (${formPlaceholders})`
    ).bind(...formIds).all<{ id: number; ingredient_id: number }>()
    const formMap = new Map(forms.map((row) => [row.id, row.ingredient_id]))
    for (const row of formRows) {
      if (formMap.get(row.form_id as number) !== row.ingredient_id) {
        return 'Mindestens eine form_id gehoert nicht zum angegebenen Wirkstoff.'
      }
    }
  }

  const parentRows = ingredients.filter((row) => row.parent_ingredient_id !== null)
  if (parentRows.length > 0) {
    const parentIds = [...new Set(parentRows.map((row) => row.parent_ingredient_id as number))]
    const parentPlaceholders = parentIds.map(() => '?').join(',')
    const parentCount = await db.prepare(
      `SELECT COUNT(*) as count FROM ingredients WHERE id IN (${parentPlaceholders})`
    ).bind(...parentIds).first<CountRow>()
    if ((parentCount?.count ?? 0) !== parentIds.length) return 'Mindestens ein Parent-Wirkstoff existiert nicht.'

    const relationClauses = parentRows.map(() => '(parent_ingredient_id = ? AND child_ingredient_id = ?)').join(' OR ')
    const relationBindings = parentRows.flatMap((row) => [row.parent_ingredient_id as number, row.ingredient_id])
    const { results: relations } = await db.prepare(
      `SELECT parent_ingredient_id, child_ingredient_id
       FROM ingredient_sub_ingredients
       WHERE ${relationClauses}`
    ).bind(...relationBindings).all<{ parent_ingredient_id: number; child_ingredient_id: number }>()
    const allowedRelations = new Set(relations.map((row) => `${row.parent_ingredient_id}:${row.child_ingredient_id}`))
    for (const row of parentRows) {
      if (!allowedRelations.has(`${row.parent_ingredient_id}:${row.ingredient_id}`)) {
        return 'Mindestens eine Parent/Sub-Wirkstoff-Beziehung ist nicht zugelassen.'
      }
    }
  }

  return null
}

// GET /api/admin/search?q=&limit=12 (admin only)
admin.get('/search', async (c) => {
  const authErr = await ensureAdmin(c)
  if (authErr) return authErr

  const query = c.req.query('q')?.trim() ?? ''
  const limit = parseAdminSearchLimit(c.req.query('limit'))
  const routeResults = adminRouteSearchResults(query)

  if (query.length < 2) {
    return c.json({
      query,
      results: routeResults.slice(0, limit),
    })
  }

  const like = adminSearchLike(query)

  const [ingredientResults, productResults, userProductResults, knowledgeResults] = await Promise.all([
    (async (): Promise<AdminSearchResult[]> => {
      try {
        const { results } = await c.env.DB.prepare(`
          SELECT
            id,
            name,
            unit,
            description
          FROM ingredients
          WHERE name LIKE ? ESCAPE '\\'
             OR COALESCE(unit, '') LIKE ? ESCAPE '\\'
             OR COALESCE(description, '') LIKE ? ESCAPE '\\'
             OR CAST(id AS TEXT) LIKE ? ESCAPE '\\'
          ORDER BY name ASC, id ASC
          LIMIT ?
        `).bind(like, like, like, like, limit).all<AdminIngredientSearchRow>()

        return (results ?? []).map((row) => ({
          id: `ingredient:${row.id}`,
          type: 'ingredient',
          title: row.name,
          subtitle: adminSearchSubtitle([
            row.unit ? `Einheit: ${row.unit}` : null,
            adminSearchPreview(row.description),
          ]),
          href: `/administrator/ingredients/${row.id}`,
        }))
      } catch {
        return []
      }
    })(),
    (async (): Promise<AdminSearchResult[]> => {
      try {
        const { results } = await c.env.DB.prepare(`
          SELECT
            id,
            name,
            brand,
            form,
            moderation_status,
            visibility
          FROM products
          WHERE name LIKE ? ESCAPE '\\'
             OR COALESCE(brand, '') LIKE ? ESCAPE '\\'
             OR COALESCE(form, '') LIKE ? ESCAPE '\\'
             OR COALESCE(moderation_status, '') LIKE ? ESCAPE '\\'
             OR COALESCE(visibility, '') LIKE ? ESCAPE '\\'
             OR CAST(id AS TEXT) LIKE ? ESCAPE '\\'
          ORDER BY created_at DESC, id DESC
          LIMIT ?
        `).bind(like, like, like, like, like, like, limit).all<AdminProductSearchRow>()

        return (results ?? []).map((row) => ({
          id: `product:${row.id}`,
          type: 'product',
          title: row.name,
          subtitle: adminSearchSubtitle([
            row.brand,
            row.form,
            row.moderation_status ? `Status: ${row.moderation_status}` : null,
            row.visibility ? `Sichtbarkeit: ${row.visibility}` : null,
          ]),
          href: `/administrator/products/${row.id}`,
        }))
      } catch {
        return []
      }
    })(),
    (async (): Promise<AdminSearchResult[]> => {
      try {
        const { results } = await c.env.DB.prepare(`
          SELECT
            up.id,
            up.name,
            up.brand,
            up.form,
            up.status,
            u.email AS user_email
          FROM user_products up
          LEFT JOIN users u ON u.id = up.user_id
          WHERE up.name LIKE ? ESCAPE '\\'
             OR COALESCE(up.brand, '') LIKE ? ESCAPE '\\'
             OR COALESCE(up.form, '') LIKE ? ESCAPE '\\'
             OR COALESCE(up.status, '') LIKE ? ESCAPE '\\'
             OR COALESCE(u.email, '') LIKE ? ESCAPE '\\'
             OR CAST(up.id AS TEXT) LIKE ? ESCAPE '\\'
          ORDER BY
            CASE up.status
              WHEN 'pending' THEN 0
              WHEN 'approved' THEN 1
              WHEN 'rejected' THEN 2
              ELSE 3
            END,
            up.created_at DESC,
            up.id DESC
          LIMIT ?
        `).bind(like, like, like, like, like, like, limit).all<AdminUserProductSearchRow>()

        return (results ?? []).map((row) => {
          const hrefStatus = row.status && ['pending', 'approved', 'rejected', 'blocked'].includes(row.status)
            ? row.status
            : 'pending'
          return {
            id: `user_product:${row.id}`,
            type: 'user_product',
            title: row.name,
            subtitle: adminSearchSubtitle([
              row.brand,
              row.form,
              row.status ? `Status: ${row.status}` : null,
              row.user_email,
            ]),
            href: `/administrator/user-products?status=${encodeURIComponent(hrefStatus)}`,
          }
        })
      } catch {
        return []
      }
    })(),
    (async (): Promise<AdminSearchResult[]> => {
      try {
        const { results } = await c.env.DB.prepare(`
          SELECT
            slug,
            title,
            summary,
            status
          FROM knowledge_articles
          WHERE slug LIKE ? ESCAPE '\\'
             OR title LIKE ? ESCAPE '\\'
             OR COALESCE(summary, '') LIKE ? ESCAPE '\\'
             OR COALESCE(status, '') LIKE ? ESCAPE '\\'
          ORDER BY updated_at DESC, slug ASC
          LIMIT ?
        `).bind(like, like, like, like, limit).all<AdminKnowledgeSearchRow>()

        return (results ?? []).map((row) => ({
          id: `knowledge:${row.slug}`,
          type: 'knowledge',
          title: row.title,
          subtitle: adminSearchSubtitle([
            row.status ? `Status: ${row.status}` : null,
            adminSearchPreview(row.summary),
          ]),
          href: `/administrator/knowledge?article=${encodeURIComponent(row.slug)}`,
        }))
      } catch {
        return []
      }
    })(),
  ])

  return c.json({
    query,
    results: [
      ...routeResults,
      ...ingredientResults,
      ...productResults,
      ...userProductResults,
      ...knowledgeResults,
    ].slice(0, limit),
  })
})

// GET /api/admin/export?entity=products|ingredients|user-products|product-qa|link-reports (admin only)
admin.get('/export', async (c) => {
  const authErr = await ensureAdmin(c)
  if (authErr) return authErr

  const entity = c.req.query('entity')?.trim() ?? ''
  if (!isAdminExportEntity(entity)) {
    return c.json({
      error: 'Invalid entity',
      allowed: ADMIN_EXPORT_ENTITIES,
    }, 400)
  }

  const query = buildAdminExportQuery(entity, {
    q: c.req.query('q') ?? '',
    status: c.req.query('status') ?? '',
    issue: c.req.query('issue') ?? '',
  })
  if (!query.ok) {
    return c.json({ error: query.error }, query.status ?? 400)
  }

  const { results } = await c.env.DB.prepare(query.value.sql)
    .bind(...query.value.bindings)
    .all<Record<string, unknown>>()
  const csv = rowsToCsv(query.value.columns, results ?? [])
  const filename = csvAttachmentFilename(entity)

  return new Response(csv, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store',
    },
  })
})

// GET /api/admin/research/pubmed-lookup?pmid=&doi= (admin only)
admin.get('/research/pubmed-lookup', async (c) => {
  const authErr = await ensureAdmin(c)
  if (authErr) return authErr

  const query = normalizePubMedLookupQuery(c.req.query('pmid'), c.req.query('doi'))
  if (!query.ok) return c.json({ error: query.error }, query.status ?? 400)

  const cacheKey = pubMedLookupCacheKeyForQuery(query.value)
  const cachedLookup = await readPubMedLookupCache(c.env.RATE_LIMITER, cacheKey)
  if (cachedLookup) return c.json({ lookup: cachedLookup })

  let pmid = query.value.pmid
  const doi = query.value.doi

  if (!pmid && doi) {
    const searchResult = await fetchPubMedJson(pubMedESearchDoiUrl(doi))
    if (!searchResult.ok) return c.json({ error: searchResult.error }, searchResult.status ?? 502)
    pmid = pubMedESearchFirstPmid(searchResult.value) ?? undefined
    if (!pmid) return c.json({ error: 'PubMed record not found' }, 404)
  }

  if (!pmid) return c.json({ error: 'PubMed record not found' }, 404)

  const summaryResult = await fetchPubMedJson(pubMedESummaryUrl(pmid))
  if (!summaryResult.ok) return c.json({ error: summaryResult.error }, summaryResult.status ?? 502)

  const record = pubMedESummaryRecord(summaryResult.value, pmid)
  if (!record) return c.json({ error: 'PubMed record not found' }, 404)

  const lookup = pubMedLookupFromSummary(record, pmid, doi)
  if (!lookup) return c.json({ error: 'PubMed record not found' }, 404)

  await writePubMedLookupCache(c.env.RATE_LIMITER, cacheKey, lookup)
  if (doi) {
    const pmidCacheKey = pubMedLookupCacheKeyForPmid(lookup.pmid)
    if (pmidCacheKey !== cacheKey) {
      await writePubMedLookupCache(c.env.RATE_LIMITER, pmidCacheKey, lookup)
    }
  }

  return c.json({ lookup })
})

// GET /api/admin/products?q=&page=1&limit=50 (admin only)
admin.get('/products', async (c) => {
  const authErr = await ensureAdmin(c)
  if (authErr) return authErr

  const includeLinkHealth = await hasAffiliateLinkHealthTable(c.env.DB)
  const includeShopLinkHealth = await hasTable(c.env.DB, 'product_shop_link_health')
  const hasShopLinks = await hasTable(c.env.DB, 'product_shop_links')
  const hasLinkClicks = await hasTable(c.env.DB, 'product_link_clicks')
  const includeProductListShopLinkHealth = hasShopLinks && includeShopLinkHealth
  const linkHealthSelect = includeLinkHealth ? `,${AFFILIATE_LINK_HEALTH_SELECT}` : ''
  const linkHealthJoin = includeLinkHealth ? 'LEFT JOIN affiliate_link_health lh ON lh.product_id = p.id' : ''
  const shopLinkHealthSelect = includeProductListShopLinkHealth ? `,${PRODUCT_SHOP_LINK_HEALTH_SELECT}` : ''
  const shopLinkHealthJoin = includeProductListShopLinkHealth
    ? `
      LEFT JOIN product_shop_links psl_effective ON psl_effective.id = (
        SELECT psl_inner.id
        FROM product_shop_links psl_inner
        WHERE psl_inner.product_id = p.id
          AND psl_inner.active = 1
        ORDER BY psl_inner.is_primary DESC, psl_inner.sort_order ASC, psl_inner.id ASC
        LIMIT 1
      )
      LEFT JOIN product_shop_link_health pslh ON pslh.shop_link_id = psl_effective.id`
    : ''
  const linkClickSelect = hasLinkClicks ? ', COALESCE(plc.link_click_count, 0) AS link_click_count' : ', 0 AS link_click_count'
  const linkClickJoin = hasLinkClicks
    ? `
      LEFT JOIN (
        SELECT product_id, COUNT(*) AS link_click_count
        FROM product_link_clicks
        WHERE product_type = 'catalog'
        GROUP BY product_id
      ) plc ON plc.product_id = p.id`
    : ''
  const hasPagedRequest = (
    c.req.query('q') !== undefined ||
    c.req.query('page') !== undefined ||
    c.req.query('limit') !== undefined ||
    c.req.query('ingredient_id') !== undefined ||
    c.req.query('moderation') !== undefined ||
    c.req.query('affiliate') !== undefined ||
    c.req.query('image') !== undefined ||
    c.req.query('deadlinks') !== undefined ||
    c.req.query('link_status') !== undefined
  )
  const q = c.req.query('q')?.trim() ?? ''
  const moderation = c.req.query('moderation')?.trim() ?? ''
  const ingredientIdParam = c.req.query('ingredient_id')
  const ingredientId = ingredientIdParam === undefined ? null : parsePositiveId(ingredientIdParam)
  const affiliate = c.req.query('affiliate')?.trim() ?? ''
  const image = c.req.query('image')?.trim() ?? ''
  const deadlinks = c.req.query('deadlinks') === '1' || c.req.query('link_status') === 'dead'
  const linkStatus = c.req.query('link_status')?.trim() ?? ''

  if (moderation && moderation !== 'all' && !PRODUCT_MODERATION_STATUSES.includes(moderation as ProductModerationStatus)) {
    return c.json({ error: `moderation must be one of all, ${PRODUCT_MODERATION_STATUSES.join(', ')}` }, 400)
  }
  if (ingredientIdParam !== undefined && ingredientId === null) {
    return c.json({ error: 'ingredient_id must be a positive integer' }, 400)
  }
  if (affiliate && !['all', 'partner', 'no_partner', 'nick', 'user'].includes(affiliate)) {
    return c.json({ error: 'affiliate must be one of all, partner, no_partner, nick, user' }, 400)
  }
  if (image && !['all', 'with', 'without'].includes(image)) {
    return c.json({ error: 'image must be one of all, with, without' }, 400)
  }
  if (linkStatus && !['all', 'dead', 'unchecked', 'ok'].includes(linkStatus)) {
    return c.json({ error: 'link_status must be one of all, dead, unchecked, ok' }, 400)
  }

  if (!hasPagedRequest) {
    const { results } = await c.env.DB.prepare(`
      SELECT p.*${linkHealthSelect}${shopLinkHealthSelect}${linkClickSelect}
      FROM products p
      ${linkHealthJoin}
      ${shopLinkHealthJoin}
      ${linkClickJoin}
      ORDER BY p.created_at DESC, p.id DESC
    `).all<ProductRow & Partial<AffiliateLinkHealthSelectRow> & Partial<ProductShopLinkHealthSelectRow> & { link_click_count?: number }>()
    const products = results ?? []
    return c.json({
      products: products.map((product) => ({
        ...withProductListLinkHealth(product),
        link_click_count: product.link_click_count ?? 0,
      })),
      total: products.length,
      page: 1,
      limit: Math.max(1, products.length),
      total_pages: 1,
    })
  }

  const page = Math.max(1, parsePagination(c.req.query('page'), 1, 100000))
  const limit = Math.max(1, parsePagination(c.req.query('limit'), 50, 250))
  const offset = (page - 1) * limit
  const where: string[] = []
  const bindings: Array<string | number> = []

  if (q) {
    const like = `%${q}%`
    where.push(`(
      p.name LIKE ?
      OR COALESCE(p.brand, '') LIKE ?
      OR COALESCE(p.shop_link, '') LIKE ?
      OR CAST(p.id AS TEXT) LIKE ?
    )`)
    bindings.push(like, like, like, like)
  }
  if (ingredientId !== null) {
    where.push(`EXISTS (
      SELECT 1
      FROM product_ingredients pi
      WHERE pi.product_id = p.id
        AND pi.ingredient_id = ?
        AND COALESCE(pi.search_relevant, 1) = 1
    )`)
    bindings.push(ingredientId)
  }
  if (moderation && moderation !== 'all') {
    where.push('p.moderation_status = ?')
    bindings.push(moderation)
  }
  if (affiliate === 'partner') {
    where.push(hasShopLinks
      ? `(COALESCE(p.is_affiliate, 0) = 1 OR EXISTS (
          SELECT 1
          FROM product_shop_links psl
          WHERE psl.product_id = p.id
            AND psl.active = 1
            AND COALESCE(psl.is_affiliate, 0) = 1
        ))`
      : 'COALESCE(p.is_affiliate, 0) = 1')
  } else if (affiliate === 'no_partner') {
    where.push(hasShopLinks
      ? `COALESCE(p.is_affiliate, 0) = 0
        AND NOT EXISTS (
          SELECT 1
          FROM product_shop_links psl
          WHERE psl.product_id = p.id
            AND psl.active = 1
            AND COALESCE(psl.is_affiliate, 0) = 1
        )`
      : 'COALESCE(p.is_affiliate, 0) = 0')
  } else if (affiliate === 'nick' || affiliate === 'user') {
    where.push(hasShopLinks
      ? `(COALESCE(p.affiliate_owner_type, CASE WHEN COALESCE(p.is_affiliate, 0) = 1 THEN ? ELSE ? END) = ?
        OR EXISTS (
          SELECT 1
          FROM product_shop_links psl
          WHERE psl.product_id = p.id
            AND psl.active = 1
            AND COALESCE(psl.is_affiliate, 0) = 1
            AND psl.affiliate_owner_type = ?
        ))`
      : 'COALESCE(p.affiliate_owner_type, CASE WHEN COALESCE(p.is_affiliate, 0) = 1 THEN ? ELSE ? END) = ?')
    bindings.push('nick', 'none', affiliate, ...(hasShopLinks ? [affiliate] : []))
  }
  if (image === 'with') {
    where.push("(COALESCE(p.image_url, '') <> '' OR COALESCE(p.image_r2_key, '') <> '')")
  } else if (image === 'without') {
    where.push("COALESCE(p.image_url, '') = '' AND COALESCE(p.image_r2_key, '') = ''")
  }
  if (deadlinks || linkStatus === 'dead') {
    if (includeProductListShopLinkHealth) {
      where.push(`EXISTS (
        SELECT 1
        FROM product_shop_links psl
        JOIN product_shop_link_health pslh ON pslh.shop_link_id = psl.id
        WHERE psl.product_id = p.id
          AND psl.active = 1
          AND pslh.status IN ('failed', 'timeout', 'invalid')
      )`)
    } else if (includeLinkHealth) {
      where.push("lh.status IN ('failed', 'timeout', 'invalid')")
    } else {
      where.push('1 = 0')
    }
  } else if (linkStatus === 'unchecked') {
    if (includeProductListShopLinkHealth) {
      where.push(`EXISTS (
        SELECT 1
        FROM product_shop_links psl
        LEFT JOIN product_shop_link_health pslh ON pslh.shop_link_id = psl.id
        WHERE psl.product_id = p.id
          AND psl.active = 1
          AND COALESCE(pslh.status, 'unchecked') = 'unchecked'
      )`)
    } else if (includeLinkHealth) {
      where.push("COALESCE(lh.status, 'unchecked') = 'unchecked'")
    }
  } else if (linkStatus === 'ok') {
    if (includeProductListShopLinkHealth) {
      where.push(`EXISTS (
        SELECT 1
        FROM product_shop_links psl
        JOIN product_shop_link_health pslh ON pslh.shop_link_id = psl.id
        WHERE psl.product_id = p.id
          AND psl.active = 1
          AND pslh.status = 'ok'
      )`)
    } else if (includeLinkHealth) {
      where.push("lh.status = 'ok'")
    }
  }

  const whereSql = where.length > 0 ? `WHERE ${where.join(' AND ')}` : ''
  const [totalRow, listResult] = await Promise.all([
    c.env.DB.prepare(`
      SELECT COUNT(*) AS count
      FROM products p
      ${linkHealthJoin}
      ${whereSql}
    `).bind(...bindings).first<CountRow>(),
    c.env.DB.prepare(`
      SELECT p.*${linkHealthSelect}${shopLinkHealthSelect}${linkClickSelect}
      FROM products p
      ${linkHealthJoin}
      ${shopLinkHealthJoin}
      ${linkClickJoin}
      ${whereSql}
      ORDER BY p.created_at DESC, p.id DESC
      LIMIT ? OFFSET ?
    `).bind(...bindings, limit, offset).all<ProductRow & Partial<AffiliateLinkHealthSelectRow> & Partial<ProductShopLinkHealthSelectRow> & { link_click_count?: number }>(),
  ])

  const total = totalRow?.count ?? 0
  return c.json({
    products: (listResult.results ?? []).map((product) => ({
      ...withProductListLinkHealth(product),
      link_click_count: product.link_click_count ?? 0,
    })),
    total,
    page,
    limit,
    total_pages: Math.max(1, Math.ceil(total / limit)),
  })
})

// POST /api/admin/products (admin only)
admin.post('/products', async (c) => {
  const authErr = await ensureAdmin(c)
  if (authErr) return authErr

  let body: Record<string, unknown>
  try {
    body = await c.req.json()
  } catch {
    return c.json({ error: 'Invalid JSON' }, 400)
  }

  const validation = validateProductCreatePayload(body)
  if (!validation.ok) return c.json({ error: validation.error }, validation.status)

  const data = validation.value
  if (data.serving_unit !== undefined && data.serving_unit !== null && await hasTable(c.env.DB, 'managed_list_items')) {
    const managedUnit = await c.env.DB.prepare(`
      SELECT id
      FROM managed_list_items
      WHERE list_key = 'serving_unit'
        AND value = ?
        AND active = 1
    `).bind(data.serving_unit).first<{ id: number }>()
    if (!managedUnit) return c.json({ error: 'serving_unit must be an active managed serving unit' }, 400)
  }

  const affiliateOwner = await validateAffiliateOwnerUser(c.env.DB, {
    affiliate_owner_type: data.affiliate_owner_type ?? 'none',
    affiliate_owner_user_id: data.affiliate_owner_user_id ?? null,
    is_affiliate: data.is_affiliate ?? 0,
  })
  if (!affiliateOwner.ok) return c.json({ error: affiliateOwner.error }, affiliateOwner.status)
  data.affiliate_owner_type = data.shop_link ? affiliateOwner.value.affiliate_owner_type : 'none'
  data.affiliate_owner_user_id = data.shop_link ? affiliateOwner.value.affiliate_owner_user_id : null
  data.is_affiliate = data.shop_link ? affiliateOwner.value.is_affiliate : 0

  const productColumns = await getTableColumns(c.env.DB, 'products')
  const createFields = [
    'name',
    'brand',
    'form',
    'price',
    'shop_link',
    'is_affiliate',
    'affiliate_owner_type',
    'affiliate_owner_user_id',
    'moderation_status',
    'visibility',
    'serving_size',
    'serving_unit',
    'servings_per_container',
    'container_count',
  ] as const
  const fields: Array<[string, string | number | null]> = []
  for (const field of createFields) {
    if (productColumns.has(field)) fields.push([field, data[field] ?? null])
  }
  if (productColumns.has('version')) fields.push(['version', 1])

  const insertResult = await c.env.DB.prepare(`
    INSERT INTO products (
      ${fields.map(([field]) => field).join(',\n      ')}
    )
    VALUES (${fields.map(() => '?').join(', ')})
  `).bind(...fields.map(([, value]) => value)).run()
  const productId = Number(insertResult.meta.last_row_id)
  if (!Number.isInteger(productId) || productId <= 0) {
    return c.json({ error: 'Product could not be created' }, 500)
  }

  if (data.shop_link) {
    await syncPrimaryProductShopLinkFromProduct(c.env.DB, productId)
  }

  const includeLinkHealth = await hasAffiliateLinkHealthTable(c.env.DB)
  const product = await getProductQaRow(c.env.DB, productId, includeLinkHealth)
  if (!product) return c.json({ error: 'Product not found after create' }, 404)

  await logAdminAction(c, {
    action: 'create_product',
    entity_type: 'product',
    entity_id: productId,
    changes: data,
  })

  return c.json({ product: formatProductQaRow(product) }, 201)
})

// GET /api/admin/ingredients?q=&page=1&limit=50 (admin only)
admin.get('/ingredients', async (c) => {
  const authErr = await ensureAdmin(c)
  if (authErr) return authErr

  const hasPagedRequest = (
    c.req.query('q') !== undefined ||
    c.req.query('task') !== undefined ||
    c.req.query('ingredient_group') !== undefined ||
    c.req.query('page') !== undefined ||
    c.req.query('limit') !== undefined
  )
  const q = c.req.query('q')?.trim() ?? ''
  const groupFilterRaw = c.req.query('ingredient_group')?.trim() ?? ''
  const groupFilter = groupFilterRaw && groupFilterRaw !== 'all' ? ingredientGroupKey(groupFilterRaw) : null
  if (groupFilterRaw && groupFilterRaw !== 'all' && groupFilter === null) {
    return c.json({ error: `ingredient_group must be one of all, ${ADMIN_INGREDIENT_GROUPS.map((group) => group.value).join(', ')}` }, 400)
  }
  const taskFilterRaw = c.req.query('task')?.trim() ?? ''
  const taskFilter = taskFilterRaw
    ? (ingredientAdminTaskKey(taskFilterRaw) ?? (taskFilterRaw === 'knowledge' || taskFilterRaw === 'dosing' ? taskFilterRaw : null))
    : null
  if (taskFilterRaw && taskFilter === null) {
    return c.json({ error: 'task must be one of forms, dge, precursors, synonyms, knowledge, dosing' }, 400)
  }
  const page = Math.max(1, parsePagination(c.req.query('page'), 1, 100000))
  const limit = Math.max(1, parsePagination(c.req.query('limit'), hasPagedRequest ? 50 : 250, 250))
  const offset = (page - 1) * limit
  const where: string[] = [adminHiddenIngredientCondition('i')]
  const bindings: Array<string | number> = []

  if (q) {
    const like = `%${q}%`
    where.push(`(
      i.name LIKE ?
      OR COALESCE(i.unit, '') LIKE ?
      OR COALESCE(i.category, '') LIKE ?
      OR CAST(i.id AS TEXT) LIKE ?
    )`)
    bindings.push(like, like, like, like)
  }

  const hasPrecursorsTable = await hasTable(c.env.DB, 'ingredient_precursors')
  const hasTaskStatusTable = await hasTable(c.env.DB, 'ingredient_admin_task_status')
  const recommendationColumns = await getTableColumns(c.env.DB, 'product_recommendations')
  const hasRecommendationSlots = recommendationColumns.has('recommendation_slot') && recommendationColumns.has('shop_link_id')
  const hasShopLinks = await hasTable(c.env.DB, 'product_shop_links')
  if (taskFilter !== null) {
    where.push(ingredientTaskMissingCondition(taskFilter, hasTaskStatusTable, hasPrecursorsTable))
  }
  if (groupFilter !== null) {
    where.push(ingredientGroupCondition(groupFilter))
  }
  const whereSql = where.length > 0 ? `WHERE ${where.join(' AND ')}` : ''
  const precursorCountSelect = hasPrecursorsTable
    ? 'COALESCE(precursor_counts.precursor_count, 0) AS precursor_count'
    : '0 AS precursor_count'
  const precursorCountJoin = hasPrecursorsTable
    ? `
      LEFT JOIN (
        SELECT ingredient_id, COUNT(*) AS precursor_count
        FROM ingredient_precursors
        GROUP BY ingredient_id
      ) precursor_counts ON precursor_counts.ingredient_id = i.id
    `
    : ''
  const groupCountsPromise = c.env.DB.prepare(`
    SELECT ingredient_group, COUNT(*) AS count
    FROM (
      SELECT ${ingredientGroupCaseExpression('i')} AS ingredient_group
      FROM ingredients i
      WHERE ${adminHiddenIngredientCondition('i')}
    )
    GROUP BY ingredient_group
  `).all<{ ingredient_group: AdminIngredientGroupKey; count: number }>()

  const [totalRow, listResult, groupCountsResult] = await Promise.all([
    c.env.DB.prepare(`
      SELECT COUNT(*) AS count
      FROM ingredients i
      ${whereSql}
    `).bind(...bindings).first<CountRow>(),
    c.env.DB.prepare(`
      SELECT
        i.id,
        i.name,
        i.unit,
        i.category,
        COALESCE(rs.research_status, 'unreviewed') AS research_status,
        COALESCE(rs.calculation_status, 'not_started') AS calculation_status,
        CASE
          WHEN rs.blog_url IS NOT NULL AND TRIM(rs.blog_url) <> '' THEN 1
          ELSE 0
        END AS has_blog_url,
        COALESCE(product_counts.product_count, 0) AS product_count,
        COALESCE(dose_counts.dose_recommendation_count, 0) AS dose_recommendation_count,
        COALESCE(source_counts.source_count, 0) AS source_count,
        COALESCE(source_counts.official_source_count, 0) AS official_source_count,
        COALESCE(source_counts.dge_source_count, 0) AS dge_source_count,
        COALESCE(source_counts.study_source_count, 0) AS study_source_count,
        COALESCE(source_counts.no_recommendation_count, 0) AS no_recommendation_count,
        COALESCE(nrv_counts.nrv_count, 0) AS nrv_count,
        COALESCE(dose_source_counts.dose_source_link_count, 0) AS dose_source_link_count,
        COALESCE(dose_source_counts.sourced_dose_recommendation_count, 0) AS sourced_dose_recommendation_count,
        COALESCE(display_profile_counts.display_profile_count, 0) AS display_profile_count,
        COALESCE(knowledge_counts.knowledge_article_count, 0) AS knowledge_article_count,
        COALESCE(warning_counts.warning_count, 0) AS warning_count,
        COALESCE(form_counts.form_count, 0) AS form_count,
        COALESCE(synonym_counts.synonym_count, 0) AS synonym_count,
        ${precursorCountSelect},
        ${ingredientTaskStatusSelect(hasTaskStatusTable)},
        ${ingredientRecommendationSummarySelect(hasRecommendationSlots, hasShopLinks)}
      FROM ingredients i
      LEFT JOIN ingredient_research_status rs ON rs.ingredient_id = i.id
      LEFT JOIN (
        SELECT ingredient_id, COUNT(DISTINCT product_id) AS product_count
        FROM product_ingredients
        GROUP BY ingredient_id
      ) product_counts ON product_counts.ingredient_id = i.id
      LEFT JOIN (
        SELECT ingredient_id, COUNT(*) AS dose_recommendation_count
        FROM dose_recommendations
        GROUP BY ingredient_id
      ) dose_counts ON dose_counts.ingredient_id = i.id
      LEFT JOIN (
        SELECT
          ingredient_id,
          COUNT(*) AS source_count,
          SUM(CASE WHEN source_kind = 'official' THEN 1 ELSE 0 END) AS official_source_count,
          SUM(CASE WHEN source_kind = 'study' THEN 1 ELSE 0 END) AS study_source_count,
          SUM(CASE WHEN no_recommendation = 1 THEN 1 ELSE 0 END) AS no_recommendation_count,
          SUM(CASE
            WHEN source_kind = 'official'
              AND (
                lower(COALESCE(organization, '')) LIKE '%dge%'
                OR lower(COALESCE(source_title, '')) LIKE '%dge%'
                OR lower(COALESCE(source_url, '')) LIKE '%dge.de%'
                OR lower(COALESCE(organization, '')) LIKE '%deutsche gesellschaft%'
                OR lower(COALESCE(source_title, '')) LIKE '%deutsche gesellschaft%'
                OR lower(COALESCE(organization, '')) LIKE '%gesellschaft fuer ernaehrung%'
                OR lower(COALESCE(source_title, '')) LIKE '%gesellschaft fuer ernaehrung%'
                OR lower(COALESCE(organization, '')) LIKE '%gesellschaft fur ernahrung%'
                OR lower(COALESCE(source_title, '')) LIKE '%gesellschaft fur ernahrung%'
              )
            THEN 1
            ELSE 0
          END) AS dge_source_count
        FROM ingredient_research_sources
        GROUP BY ingredient_id
      ) source_counts ON source_counts.ingredient_id = i.id
      LEFT JOIN (
        SELECT ingredient_id, COUNT(*) AS nrv_count
        FROM nutrient_reference_values
        GROUP BY ingredient_id
      ) nrv_counts ON nrv_counts.ingredient_id = i.id
      LEFT JOIN (
        SELECT
          dr.ingredient_id,
          COUNT(*) AS dose_source_link_count,
          COUNT(DISTINCT dr.id) AS sourced_dose_recommendation_count
        FROM dose_recommendations dr
        JOIN dose_recommendation_sources drs ON drs.dose_recommendation_id = dr.id
        GROUP BY dr.ingredient_id
      ) dose_source_counts ON dose_source_counts.ingredient_id = i.id
      LEFT JOIN (
        SELECT ingredient_id, COUNT(*) AS display_profile_count
        FROM ingredient_display_profiles
        WHERE COALESCE(TRIM(effect_summary), '') <> ''
          OR COALESCE(TRIM(timing), '') <> ''
          OR COALESCE(TRIM(timing_note), '') <> ''
          OR COALESCE(TRIM(intake_hint), '') <> ''
          OR COALESCE(TRIM(card_note), '') <> ''
        GROUP BY ingredient_id
      ) display_profile_counts ON display_profile_counts.ingredient_id = i.id
      LEFT JOIN (
        SELECT
          w.ingredient_id,
          COUNT(DISTINCT w.article_slug) AS knowledge_article_count
        FROM ingredient_safety_warnings w
        JOIN knowledge_articles a ON a.slug = w.article_slug
        WHERE w.active = 1
          AND w.article_slug IS NOT NULL
          AND a.status <> 'archived'
        GROUP BY w.ingredient_id
      ) knowledge_counts ON knowledge_counts.ingredient_id = i.id
      LEFT JOIN (
        SELECT ingredient_id, COUNT(*) AS warning_count
        FROM ingredient_safety_warnings
        WHERE active = 1
        GROUP BY ingredient_id
      ) warning_counts ON warning_counts.ingredient_id = i.id
      LEFT JOIN (
        SELECT ingredient_id, COUNT(*) AS form_count
        FROM ingredient_forms
        GROUP BY ingredient_id
      ) form_counts ON form_counts.ingredient_id = i.id
      LEFT JOIN (
        SELECT ingredient_id, COUNT(*) AS synonym_count
        FROM ingredient_synonyms
        GROUP BY ingredient_id
      ) synonym_counts ON synonym_counts.ingredient_id = i.id
      ${precursorCountJoin}
      ${ingredientTaskStatusJoin(hasTaskStatusTable)}
      ${whereSql}
      ORDER BY COALESCE(i.category, '') ASC, i.name ASC, i.id ASC
      LIMIT ? OFFSET ?
    `).bind(...bindings, limit, offset).all<Record<string, string | number | null>>(),
    groupCountsPromise,
  ])

  const total = totalRow?.count ?? 0
  const groupCounts = new Map((groupCountsResult.results ?? []).map((row) => [row.ingredient_group, row.count]))
  return c.json({
    ingredients: listResult.results ?? [],
    total,
    page,
    limit,
    total_pages: Math.max(1, Math.ceil(total / limit)),
    summary: {
      total,
      groups: ADMIN_INGREDIENT_GROUPS
        .map((group) => ({
          value: group.value,
          label: ingredientGroupLabel(group.value),
          count: groupCounts.get(group.value) ?? 0,
        }))
        .filter((group) => group.count > 0 || ['vitamins', 'minerals', 'trace_elements', 'enzymes'].includes(group.value)),
    },
  })
})

// GET /api/admin/ingredients/:id/task-status (admin only)
admin.get('/ingredients/:id/task-status', async (c) => {
  const authErr = await ensureAdmin(c)
  if (authErr) return authErr

  const ingredientId = parsePositiveId(c.req.param('id'))
  if (ingredientId === null) return c.json({ error: 'Invalid ingredient id' }, 400)
  if (!(await ingredientExists(c.env.DB, ingredientId))) return c.json({ error: 'Ingredient not found' }, 404)

  return c.json({ statuses: await loadIngredientTaskStatuses(c.env.DB, ingredientId) })
})

// PUT /api/admin/ingredients/:id/task-status/:taskKey (admin only)
admin.put('/ingredients/:id/task-status/:taskKey', async (c) => {
  const authErr = await ensureAdmin(c)
  if (authErr) return authErr

  const ingredientId = parsePositiveId(c.req.param('id'))
  if (ingredientId === null) return c.json({ error: 'Invalid ingredient id' }, 400)
  if (!(await ingredientExists(c.env.DB, ingredientId))) return c.json({ error: 'Ingredient not found' }, 404)
  if (!(await hasTable(c.env.DB, 'ingredient_admin_task_status'))) {
    return c.json({ error: 'ingredient_admin_task_status migration is not applied' }, 409)
  }

  const taskKey = ingredientAdminTaskKey(c.req.param('taskKey'))
  if (!taskKey) return c.json({ error: `taskKey must be one of ${INGREDIENT_ADMIN_TASK_KEYS.join(', ')}` }, 400)

  let body: Record<string, unknown>
  try {
    body = await c.req.json()
  } catch {
    return c.json({ error: 'Invalid JSON' }, 400)
  }

  const status = ingredientAdminTaskStatus(body.status)
  if (!status) return c.json({ error: `status must be one of ${INGREDIENT_ADMIN_TASK_STATUSES.join(', ')}` }, 400)
  const note = optionalText(body.note)
  const user = c.get('user')
  const existing = await c.env.DB.prepare(`
    SELECT ingredient_id, task_key, status, note, updated_at, updated_by_user_id
    FROM ingredient_admin_task_status
    WHERE ingredient_id = ? AND task_key = ?
  `).bind(ingredientId, taskKey).first<IngredientAdminTaskStatusRow>()

  await c.env.DB.prepare(`
    INSERT INTO ingredient_admin_task_status (
      ingredient_id,
      task_key,
      status,
      note,
      updated_at,
      updated_by_user_id
    )
    VALUES (?, ?, ?, ?, datetime('now'), ?)
    ON CONFLICT(ingredient_id, task_key) DO UPDATE SET
      status = excluded.status,
      note = excluded.note,
      updated_at = datetime('now'),
      updated_by_user_id = excluded.updated_by_user_id
  `).bind(ingredientId, taskKey, status, note, user?.userId ?? null).run()

  const statuses = await loadIngredientTaskStatuses(c.env.DB, ingredientId)
  await logAdminAction(c, {
    action: 'upsert_ingredient_admin_task_status',
    entity_type: 'ingredient_admin_task_status',
    entity_id: ingredientId,
    changes: { before: existing, after: statuses[taskKey] },
  })

  return c.json({ status: statuses[taskKey], statuses })
})

// GET /api/admin/ingredients/:id/product-recommendations (admin only)
admin.get('/ingredients/:id/product-recommendations', async (c) => {
  const authErr = await ensureAdmin(c)
  if (authErr) return authErr

  const ingredientId = parsePositiveId(c.req.param('id'))
  if (ingredientId === null) return c.json({ error: 'Invalid ingredient id' }, 400)
  if (!(await ingredientExists(c.env.DB, ingredientId))) return c.json({ error: 'Ingredient not found' }, 404)

  const payload = await loadIngredientProductRecommendations(c.env.DB, ingredientId)
  return c.json(payload)
})

// PUT /api/admin/ingredients/:id/product-recommendations/:slot (admin only)
admin.put('/ingredients/:id/product-recommendations/:slot', async (c) => {
  const authErr = await ensureAdmin(c)
  if (authErr) return authErr

  const ingredientId = parsePositiveId(c.req.param('id'))
  if (ingredientId === null) return c.json({ error: 'Invalid ingredient id' }, 400)
  if (!(await ingredientExists(c.env.DB, ingredientId))) return c.json({ error: 'Ingredient not found' }, 404)

  const slot = ingredientProductRecommendationSlot(c.req.param('slot'))
  if (!slot) return c.json({ error: `slot must be one of ${INGREDIENT_PRODUCT_RECOMMENDATION_SLOTS.join(', ')}` }, 400)

  const recommendationColumns = await getTableColumns(c.env.DB, 'product_recommendations')
  if (!recommendationColumns.has('recommendation_slot') || !recommendationColumns.has('shop_link_id')) {
    return c.json({ error: 'product_recommendations slot columns are not available' }, 409)
  }

  let body: Record<string, unknown>
  try {
    body = await c.req.json()
  } catch {
    return c.json({ error: 'Invalid JSON' }, 400)
  }

  const productId = optionalPositiveIntegerField(body, 'product_id')
  if (!productId.ok) return c.json({ error: productId.error }, productId.status ?? 400)
  if (productId.value === undefined || productId.value === null) {
    return c.json({ error: 'product_id is required' }, 400)
  }
  if (!(await productExists(c.env.DB, productId.value))) return c.json({ error: 'Product not found' }, 404)
  const linkedProductIngredient = await c.env.DB.prepare(`
    SELECT 1 AS linked
    FROM product_ingredients
    WHERE product_id = ?
      AND ingredient_id = ?
      AND COALESCE(search_relevant, 1) = 1
    LIMIT 1
  `).bind(productId.value, ingredientId).first<{ linked: number }>()
  if (!linkedProductIngredient) {
    return c.json({ error: 'Product is not linked to this ingredient' }, 400)
  }

  const shopLinkId = optionalPositiveIntegerField(body, 'shop_link_id')
  if (!shopLinkId.ok) return c.json({ error: shopLinkId.error }, shopLinkId.status ?? 400)
  if (shopLinkId.value !== undefined && shopLinkId.value !== null) {
    if (!(await hasTable(c.env.DB, 'product_shop_links'))) {
      return c.json({ error: 'product_shop_links is not available in this environment' }, 409)
    }
    const link = await c.env.DB.prepare(`
      SELECT id
      FROM product_shop_links
      WHERE id = ?
        AND product_id = ?
    `).bind(shopLinkId.value, productId.value).first<{ id: number }>()
    if (!link) return c.json({ error: 'shop_link_id must belong to the selected product' }, 400)
  }

  const before = await loadIngredientProductRecommendations(c.env.DB, ingredientId)
  const type = ingredientProductRecommendationType(slot)
  const sortOrder = ingredientProductRecommendationSortOrder(slot)

  await c.env.DB.batch([
    c.env.DB.prepare(`
      DELETE FROM product_recommendations
      WHERE ingredient_id = ?
        AND recommendation_slot = ?
    `).bind(ingredientId, slot),
    c.env.DB.prepare(`
      INSERT INTO product_recommendations (
        ingredient_id,
        product_id,
        type,
        shop_link_id,
        recommendation_slot,
        sort_order
      )
      VALUES (?, ?, ?, ?, ?, ?)
    `).bind(ingredientId, productId.value, type, shopLinkId.value ?? null, slot, sortOrder),
  ])

  const after = await loadIngredientProductRecommendations(c.env.DB, ingredientId)
  await logAdminAction(c, {
    action: 'upsert_ingredient_product_recommendation',
    entity_type: 'product_recommendation',
    entity_id: after.slots[slot]?.id ?? ingredientId,
    changes: { ingredient_id: ingredientId, slot, before: before.slots[slot], after: after.slots[slot] },
  })

  return c.json(after)
})

// DELETE /api/admin/ingredients/:id/product-recommendations/:slot (admin only)
admin.delete('/ingredients/:id/product-recommendations/:slot', async (c) => {
  const authErr = await ensureAdmin(c)
  if (authErr) return authErr

  const ingredientId = parsePositiveId(c.req.param('id'))
  if (ingredientId === null) return c.json({ error: 'Invalid ingredient id' }, 400)
  if (!(await ingredientExists(c.env.DB, ingredientId))) return c.json({ error: 'Ingredient not found' }, 404)

  const slot = ingredientProductRecommendationSlot(c.req.param('slot'))
  if (!slot) return c.json({ error: `slot must be one of ${INGREDIENT_PRODUCT_RECOMMENDATION_SLOTS.join(', ')}` }, 400)

  const recommendationColumns = await getTableColumns(c.env.DB, 'product_recommendations')
  if (!recommendationColumns.has('recommendation_slot') || !recommendationColumns.has('shop_link_id')) {
    return c.json({ error: 'product_recommendations slot columns are not available' }, 409)
  }

  const before = await loadIngredientProductRecommendations(c.env.DB, ingredientId)
  const result = await c.env.DB.prepare(`
    DELETE FROM product_recommendations
    WHERE ingredient_id = ?
      AND recommendation_slot = ?
  `).bind(ingredientId, slot).run()
  if ((d1ChangeCount(result) ?? 0) === 0) return c.json({ error: 'Not found' }, 404)

  const after = await loadIngredientProductRecommendations(c.env.DB, ingredientId)
  await logAdminAction(c, {
    action: 'delete_ingredient_product_recommendation',
    entity_type: 'product_recommendation',
    entity_id: before.slots[slot]?.id ?? ingredientId,
    changes: { ingredient_id: ingredientId, slot, before: before.slots[slot] },
  })

  return c.json(after)
})

// GET /api/admin/ingredients/:id/precursors (admin only)
admin.get('/ingredients/:id/precursors', async (c) => {
  const authErr = await ensureAdmin(c)
  if (authErr) return authErr

  const ingredientId = parsePositiveId(c.req.param('id'))
  if (ingredientId === null) return c.json({ error: 'Invalid ingredient id' }, 400)
  if (!(await ingredientExists(c.env.DB, ingredientId))) return c.json({ error: 'Ingredient not found' }, 404)

  return c.json({ precursors: await loadIngredientPrecursors(c.env.DB, ingredientId) })
})

// POST /api/admin/ingredients/:id/precursors (admin only)
admin.post('/ingredients/:id/precursors', async (c) => {
  const authErr = await ensureAdmin(c)
  if (authErr) return authErr

  const ingredientId = parsePositiveId(c.req.param('id'))
  if (ingredientId === null) return c.json({ error: 'Invalid ingredient id' }, 400)
  if (!(await ingredientExists(c.env.DB, ingredientId))) return c.json({ error: 'Ingredient not found' }, 404)
  if (!(await hasTable(c.env.DB, 'ingredient_precursors'))) {
    return c.json({ error: 'ingredient_precursors migration is not applied' }, 503)
  }

  let body: Record<string, unknown>
  try {
    body = await c.req.json()
  } catch {
    return c.json({ error: 'Invalid JSON' }, 400)
  }

  const precursorId = optionalPositiveIntegerField(body, 'precursor_ingredient_id')
  if (!precursorId.ok) return c.json({ error: precursorId.error }, precursorId.status ?? 400)
  if (precursorId.value === undefined || precursorId.value === null) {
    return c.json({ error: 'precursor_ingredient_id is required' }, 400)
  }
  if (precursorId.value === ingredientId) {
    return c.json({ error: 'ingredient_id and precursor_ingredient_id must be different' }, 400)
  }
  if (!(await ingredientExists(c.env.DB, precursorId.value))) {
    return c.json({ error: 'Precursor ingredient not found' }, 404)
  }

  const rawSortOrder = body.sort_order
  const sortOrder = rawSortOrder === undefined || rawSortOrder === null || rawSortOrder === ''
    ? 0
    : Number(rawSortOrder)
  if (!Number.isInteger(sortOrder)) return c.json({ error: 'sort_order must be an integer' }, 400)
  const note = optionalText(body.note)

  const existing = await c.env.DB.prepare(`
    SELECT ingredient_id, precursor_ingredient_id
    FROM ingredient_precursors
    WHERE ingredient_id = ? AND precursor_ingredient_id = ?
  `).bind(ingredientId, precursorId.value).first<{ ingredient_id: number; precursor_ingredient_id: number }>()
  if (existing) return c.json({ error: 'Precursor relationship already exists' }, 409)

  await c.env.DB.prepare(`
    INSERT INTO ingredient_precursors (ingredient_id, precursor_ingredient_id, sort_order, note)
    VALUES (?, ?, ?, ?)
  `).bind(ingredientId, precursorId.value, sortOrder, note).run()

  await logAdminAction(c, {
    action: 'create_ingredient_precursor',
    entity_type: 'ingredient_precursor',
    entity_id: ingredientId,
    changes: {
      ingredient_id: ingredientId,
      precursor_ingredient_id: precursorId.value,
      sort_order: sortOrder,
      note,
    },
  })

  const created = (await loadIngredientPrecursors(c.env.DB, ingredientId))
    .find((row) => row.precursor_ingredient_id === precursorId.value)
  return c.json({ precursor: created ?? null }, 201)
})

// DELETE /api/admin/ingredients/:id/precursors/:precursorId (admin only)
admin.patch('/ingredients/:id/precursors/:precursorId', async (c) => {
  const authErr = await ensureAdmin(c)
  if (authErr) return authErr

  const ingredientId = parsePositiveId(c.req.param('id'))
  const precursorId = parsePositiveId(c.req.param('precursorId'))
  if (ingredientId === null) return c.json({ error: 'Invalid ingredient id' }, 400)
  if (precursorId === null) return c.json({ error: 'Invalid precursor ingredient id' }, 400)
  if (!(await hasTable(c.env.DB, 'ingredient_precursors'))) {
    return c.json({ error: 'ingredient_precursors migration is not applied' }, 503)
  }

  const existing = await c.env.DB.prepare(`
    SELECT ingredient_id, precursor_ingredient_id, sort_order, note, created_at
    FROM ingredient_precursors
    WHERE ingredient_id = ? AND precursor_ingredient_id = ?
  `).bind(ingredientId, precursorId).first<{
    ingredient_id: number
    precursor_ingredient_id: number
    sort_order: number
    note: string | null
    created_at: string | null
  }>()
  if (!existing) return c.json({ error: 'Not found' }, 404)

  let body: Record<string, unknown>
  try {
    body = await c.req.json()
  } catch {
    return c.json({ error: 'Invalid JSON' }, 400)
  }

  const fields: Array<[string, string | number | null]> = []
  if (hasOwnKey(body, 'note')) fields.push(['note', optionalText(body.note)])
  if (hasOwnKey(body, 'sort_order')) {
    const sortOrder = normalizeInteger(body.sort_order)
    if (sortOrder === undefined) return c.json({ error: 'sort_order must be an integer' }, 400)
    fields.push(['sort_order', sortOrder])
  }
  if (fields.length === 0) return c.json({ error: 'No supported fields provided' }, 400)

  await c.env.DB.prepare(`
    UPDATE ingredient_precursors
    SET ${fields.map(([key]) => `${key} = ?`).join(', ')}
    WHERE ingredient_id = ? AND precursor_ingredient_id = ?
  `).bind(...fields.map(([, value]) => value), ingredientId, precursorId).run()

  const updated = (await loadIngredientPrecursors(c.env.DB, ingredientId))
    .find((row) => row.precursor_ingredient_id === precursorId)
  await logAdminAction(c, {
    action: 'update_ingredient_precursor',
    entity_type: 'ingredient_precursor',
    entity_id: ingredientId,
    changes: {
      before: existing,
      after: updated ?? null,
    },
  })

  return c.json({ precursor: updated ?? null })
})

// DELETE /api/admin/ingredients/:id/precursors/:precursorId (admin only)
admin.delete('/ingredients/:id/precursors/:precursorId', async (c) => {
  const authErr = await ensureAdmin(c)
  if (authErr) return authErr

  const ingredientId = parsePositiveId(c.req.param('id'))
  const precursorId = parsePositiveId(c.req.param('precursorId'))
  if (ingredientId === null) return c.json({ error: 'Invalid ingredient id' }, 400)
  if (precursorId === null) return c.json({ error: 'Invalid precursor ingredient id' }, 400)
  if (!(await hasTable(c.env.DB, 'ingredient_precursors'))) {
    return c.json({ error: 'ingredient_precursors migration is not applied' }, 503)
  }

  const result = await c.env.DB.prepare(`
    DELETE FROM ingredient_precursors
    WHERE ingredient_id = ? AND precursor_ingredient_id = ?
  `).bind(ingredientId, precursorId).run()
  if ((d1ChangeCount(result) ?? 0) === 0) return c.json({ error: 'Not found' }, 404)

  await logAdminAction(c, {
    action: 'delete_ingredient_precursor',
    entity_type: 'ingredient_precursor',
    entity_id: ingredientId,
    changes: {
      ingredient_id: ingredientId,
      precursor_ingredient_id: precursorId,
    },
  })

  return c.json({ ok: true })
})

// GET /api/admin/ingredients/:id/evidence-summary (admin only)
admin.get('/ingredients/:id/evidence-summary', async (c) => {
  const authErr = await ensureAdmin(c)
  if (authErr) return authErr

  const ingredientId = parsePositiveId(c.req.param('id'))
  if (ingredientId === null) return c.json({ error: 'Invalid ingredient id' }, 400)
  if (!(await ingredientExists(c.env.DB, ingredientId))) return c.json({ error: 'Ingredient not found' }, 404)

  if (!(await hasTable(c.env.DB, 'ingredient_research_sources'))) {
    return c.json({
      ingredient_id: ingredientId,
      counts: {
        total: 0,
        usable_active: 0,
        no_recommendation: 0,
        retracted: 0,
      },
      by_quality: {},
      by_evidence_grade: {},
      latest_checked_at: null,
      suggested_grade: null,
    })
  }

  const researchColumns = await getTableColumns(c.env.DB, 'ingredient_research_sources')
  const { results } = await c.env.DB.prepare(`
    SELECT
      source_kind,
      no_recommendation,
      evidence_quality,
      reviewed_at,
      ${ingredientResearchEvidenceSelect(researchColumns)}
    FROM ingredient_research_sources
    WHERE ingredient_id = ?
  `).bind(ingredientId).all<Pick<IngredientResearchSourceRow,
    'source_kind' | 'no_recommendation' | 'evidence_quality' | 'reviewed_at' |
    'is_retracted' | 'retraction_checked_at' | 'evidence_grade'
  >>()

  const byQuality: Record<string, number> = {}
  const byEvidenceGrade: Record<string, number> = {}
  let usableActive = 0
  let noRecommendation = 0
  let retracted = 0
  let latestCheckedAt: string | null = null
  const gradeRank = new Map<string, number>(EVIDENCE_GRADES.map((grade, index) => [grade, index]))
  let bestGrade: EvidenceGrade | null = null
  let bestFallbackGrade: EvidenceGrade | null = null

  for (const row of results ?? []) {
    const quality = optionalText(row.evidence_quality)?.toLowerCase() ?? 'unspecified'
    byQuality[quality] = (byQuality[quality] ?? 0) + 1
    const grade = row.evidence_grade ?? 'unspecified'
    byEvidenceGrade[grade] = (byEvidenceGrade[grade] ?? 0) + 1

    if (row.no_recommendation === 1) noRecommendation += 1
    if (row.is_retracted === 1) retracted += 1
    const usable = row.no_recommendation !== 1 && row.is_retracted !== 1
    if (usable) {
      usableActive += 1
      if (row.evidence_grade) {
        if (bestGrade === null || (gradeRank.get(row.evidence_grade) ?? 99) < (gradeRank.get(bestGrade) ?? 99)) {
          bestGrade = row.evidence_grade
        }
      } else {
        const fallback = evidenceQualityToGrade(row.evidence_quality)
        if (fallback && (bestFallbackGrade === null || (gradeRank.get(fallback) ?? 99) < (gradeRank.get(bestFallbackGrade) ?? 99))) {
          bestFallbackGrade = fallback
        }
      }
    }

    const checkedAt = row.retraction_checked_at ?? row.reviewed_at
    if (checkedAt && (!latestCheckedAt || checkedAt > latestCheckedAt)) latestCheckedAt = checkedAt
  }

  return c.json({
    ingredient_id: ingredientId,
    counts: {
      total: (results ?? []).length,
      usable_active: usableActive,
      no_recommendation: noRecommendation,
      retracted,
    },
    by_quality: byQuality,
    by_evidence_grade: byEvidenceGrade,
    latest_checked_at: latestCheckedAt,
    suggested_grade: bestGrade ?? bestFallbackGrade,
  })
})

// GET /api/admin/ingredients/:id/nutrient-reference-values (admin only)
admin.get('/ingredients/:id/nutrient-reference-values', async (c) => {
  const authErr = await ensureAdmin(c)
  if (authErr) return authErr

  const ingredientId = parsePositiveId(c.req.param('id'))
  if (ingredientId === null) return c.json({ error: 'Invalid ingredient id' }, 400)
  if (!(await ingredientExists(c.env.DB, ingredientId))) return c.json({ error: 'Ingredient not found' }, 404)

  if (!(await hasTable(c.env.DB, 'nutrient_reference_values'))) {
    return c.json({ nutrient_reference_values: [], items: [] })
  }
  const columns = await getTableColumns(c.env.DB, 'nutrient_reference_values')
  if (!nrvSchemaSupportsMutation(columns)) {
    return c.json({ nutrient_reference_values: [], items: [] })
  }
  const nrvRegionOrder = columns.has('region') ? "COALESCE(region, '') ASC," : ''

  const { results } = await c.env.DB.prepare(`
    SELECT
      ${nutrientReferenceValueSelect(columns)}
    FROM nutrient_reference_values
    WHERE ingredient_id = ?
    ORDER BY
      CASE kind WHEN 'ul' THEN 0 WHEN 'rda' THEN 1 WHEN 'ai' THEN 2 ELSE 3 END,
      ${nrvRegionOrder}
      organization ASC,
      id ASC
  `).bind(ingredientId).all<NutrientReferenceValueRow>()

  return c.json({ nutrient_reference_values: results ?? [], items: results ?? [] })
})

// POST /api/admin/ingredients/:id/nutrient-reference-values (admin only)
admin.post('/ingredients/:id/nutrient-reference-values', async (c) => {
  const authErr = await ensureAdmin(c)
  if (authErr) return authErr

  const ingredientId = parsePositiveId(c.req.param('id'))
  if (ingredientId === null) return c.json({ error: 'Invalid ingredient id' }, 400)

  if (!(await hasTable(c.env.DB, 'nutrient_reference_values'))) {
    return c.json({ error: 'nutrient_reference_values table is not available in this environment' }, 409)
  }
  const columns = await getTableColumns(c.env.DB, 'nutrient_reference_values')
  if (!nrvSchemaSupportsMutation(columns)) {
    return c.json({ error: 'nutrient_reference_values schema is not writable in this environment' }, 409)
  }

  let body: Record<string, unknown>
  try {
    body = await c.req.json()
  } catch {
    return c.json({ error: 'Invalid JSON' }, 400)
  }

  const validation = await validateNutrientReferenceValuePayload(c.env.DB, body, ingredientId, null)
  if (!validation.ok) return c.json({ error: validation.error }, validation.status ?? 400)

  const data = validation.value
  const fields = buildNutrientReferenceValueFields(columns, data)
  if (columns.has('created_at')) fields.push(['created_at', new Date().toISOString()])
  if (columns.has('updated_at')) fields.push(['updated_at', new Date().toISOString()])
  if (columns.has('version')) fields.push(['version', 1])

  let result: D1Result
  try {
    result = await c.env.DB.prepare(`
      INSERT INTO nutrient_reference_values (
        ${fields.map(([key]) => key).join(',\n        ')}
      )
      VALUES (${fields.map(() => '?').join(', ')})
    `).bind(...fields.map(([, value]) => value)).run()
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      return c.json({ error: 'A nutrient reference value already exists for this ingredient, organization, population, and kind' }, 409)
    }
    throw error
  }

  const id = result.meta.last_row_id as number
  const nutrientReferenceValue = await getNutrientReferenceValueRow(c.env.DB, id)
  await logAdminAction(c, {
    action: 'create_nutrient_reference_value',
    entity_type: 'nutrient_reference_value',
    entity_id: id,
    changes: data,
  })
  return c.json({ nutrient_reference_value: nutrientReferenceValue }, 201)
})

// PUT /api/admin/nutrient-reference-values/:id (admin only)
admin.put('/nutrient-reference-values/:id', async (c) => {
  const authErr = await ensureAdmin(c)
  if (authErr) return authErr

  const id = parsePositiveId(c.req.param('id'))
  if (id === null) return c.json({ error: 'Invalid nutrient reference value id' }, 400)
  if (!(await hasTable(c.env.DB, 'nutrient_reference_values'))) {
    return c.json({ error: 'nutrient_reference_values table is not available in this environment' }, 409)
  }
  const columns = await getTableColumns(c.env.DB, 'nutrient_reference_values')
  if (!nrvSchemaSupportsMutation(columns)) {
    return c.json({ error: 'nutrient_reference_values schema is not writable in this environment' }, 409)
  }

  const existing = await getNutrientReferenceValueRow(c.env.DB, id)
  if (!existing) return c.json({ error: 'Nutrient reference value not found' }, 404)

  let body: Record<string, unknown>
  try {
    body = await c.req.json()
  } catch {
    return c.json({ error: 'Invalid JSON' }, 400)
  }

  const validation = await validateNutrientReferenceValuePayload(c.env.DB, body, null, existing)
  if (!validation.ok) return c.json({ error: validation.error }, validation.status ?? 400)

  const lock = validateOptimisticLock(columns.has('version'), existing.version, requestVersion(c, body))
  if (!lock.ok) return c.json({ error: lock.error, current_version: existing.version }, 409)

  const data = validation.value
  const fields = buildNutrientReferenceValueFields(columns, data).filter(([key]) => key !== 'ingredient_id')
  if (columns.has('ingredient_id')) fields.unshift(['ingredient_id', data.ingredient_id])
  if (columns.has('updated_at')) fields.push(['updated_at', new Date().toISOString()])
  const versionSet = lock.value.enforce ? ',\n        version = COALESCE(version, 0) + 1' : ''
  const whereSql = lock.value.enforce ? optimisticWhere() : 'id = ?'
  const bindings = fields.map(([, value]) => value)
  bindings.push(id)
  if (lock.value.enforce && lock.value.expectedVersion !== null) bindings.push(lock.value.expectedVersion)

  try {
    const updateResult = await c.env.DB.prepare(`
      UPDATE nutrient_reference_values
      SET
        ${fields.map(([key]) => `${key} = ?`).join(',\n        ')}${versionSet}
      WHERE ${whereSql}
    `).bind(...bindings).run()
    if (lock.value.enforce && d1ChangeCount(updateResult) === 0) {
      const current = await getNutrientReferenceValueRow(c.env.DB, id)
      return c.json({ error: 'Version conflict', current_version: current?.version ?? existing.version }, 409)
    }
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      return c.json({ error: 'A nutrient reference value already exists for this ingredient, organization, population, and kind' }, 409)
    }
    throw error
  }

  const nutrientReferenceValue = await getNutrientReferenceValueRow(c.env.DB, id)
  await logAdminAction(c, {
    action: 'update_nutrient_reference_value',
    entity_type: 'nutrient_reference_value',
    entity_id: id,
    changes: { before: existing, after: nutrientReferenceValue },
  })
  return c.json({ nutrient_reference_value: nutrientReferenceValue })
})

// DELETE /api/admin/nutrient-reference-values/:id (admin only)
admin.delete('/nutrient-reference-values/:id', async (c) => {
  const authErr = await ensureAdmin(c)
  if (authErr) return authErr

  const id = parsePositiveId(c.req.param('id'))
  if (id === null) return c.json({ error: 'Invalid nutrient reference value id' }, 400)
  if (!(await hasTable(c.env.DB, 'nutrient_reference_values'))) {
    return c.json({ error: 'nutrient_reference_values table is not available in this environment' }, 409)
  }
  const columns = await getTableColumns(c.env.DB, 'nutrient_reference_values')
  const existing = await getNutrientReferenceValueRow(c.env.DB, id)
  if (!existing) return c.json({ error: 'Nutrient reference value not found' }, 404)

  const expectedVersion = await requestVersionFromRequest(c)
  const lock = validateOptimisticLock(columns.has('version'), existing.version, expectedVersion)
  if (!lock.ok) return c.json({ error: lock.error, current_version: existing.version }, 409)
  const whereSql = lock.value.enforce ? optimisticWhere() : 'id = ?'
  const deleteBindings = lock.value.enforce ? [id, lock.value.expectedVersion] : [id]

  const deleteResult = await c.env.DB.prepare(`
    DELETE FROM nutrient_reference_values
    WHERE ${whereSql}
  `).bind(...deleteBindings).run()
  if (lock.value.enforce && d1ChangeCount(deleteResult) === 0) {
    const current = await getNutrientReferenceValueRow(c.env.DB, id)
    return c.json({ error: 'Version conflict', current_version: current?.version ?? existing.version }, 409)
  }
  await logAdminAction(c, {
    action: 'delete_nutrient_reference_value',
    entity_type: 'nutrient_reference_value',
    entity_id: id,
    changes: { before: existing },
  })
  return c.json({ ok: true })
})

// GET /api/admin/products/:id/shop-links (admin only)
admin.get('/products/:id/shop-links', async (c) => {
  const authErr = await ensureAdmin(c)
  if (authErr) return authErr

  const productId = parsePositiveId(c.req.param('id'))
  if (productId === null) return c.json({ error: 'Invalid product id' }, 400)
  if (!(await hasTable(c.env.DB, 'product_shop_links'))) {
    return c.json({ error: 'product_shop_links is not available in this environment' }, 409)
  }
  if (!(await productExists(c.env.DB, productId))) return c.json({ error: 'Product not found' }, 404)

  const includeHealth = await hasTable(c.env.DB, 'product_shop_link_health')
  const healthSelect = includeHealth ? `,${PRODUCT_SHOP_LINK_HEALTH_SELECT}` : ''
  const healthJoin = includeHealth ? 'LEFT JOIN product_shop_link_health pslh ON pslh.shop_link_id = psl.id' : ''
  const { results } = await c.env.DB.prepare(`
    SELECT
      psl.*${healthSelect}
    FROM product_shop_links psl
    ${healthJoin}
    WHERE psl.product_id = ?
    ORDER BY psl.active DESC, psl.is_primary DESC, psl.sort_order ASC, psl.id ASC
  `).bind(productId).all<ProductShopLinkRow>()

  return c.json({
    links: (results ?? []).map(formatProductShopLink),
    health_available: includeHealth,
  })
})

// POST /api/admin/products/:id/shop-links (admin only)
admin.post('/products/:id/shop-links', async (c) => {
  const authErr = await ensureAdmin(c)
  if (authErr) return authErr

  const productId = parsePositiveId(c.req.param('id'))
  if (productId === null) return c.json({ error: 'Invalid product id' }, 400)
  if (!(await hasTable(c.env.DB, 'product_shop_links'))) {
    return c.json({ error: 'product_shop_links is not available in this environment' }, 409)
  }
  if (!(await productExists(c.env.DB, productId))) return c.json({ error: 'Product not found' }, 404)

  let body: Record<string, unknown>
  try {
    body = await c.req.json()
  } catch {
    return c.json({ error: 'Invalid JSON' }, 400)
  }

  const validation = validateProductShopLinkMutation(body, null)
  if (!validation.ok) return c.json({ error: validation.error }, validation.status)
  const data = validation.value
  if (!data.url) return c.json({ error: 'url is required' }, 400)
  const url = data.url
  const affiliateOwner = await validateAffiliateOwnerUser(c.env.DB, {
    affiliate_owner_type: data.affiliate_owner_type ?? 'none',
    affiliate_owner_user_id: data.affiliate_owner_user_id ?? null,
    is_affiliate: data.is_affiliate ?? 0,
  })
  if (!affiliateOwner.ok) return c.json({ error: affiliateOwner.error }, affiliateOwner.status)

  if (data.shop_domain_id !== undefined && data.shop_domain_id !== null) {
    const domain = await c.env.DB.prepare('SELECT id FROM shop_domains WHERE id = ?')
      .bind(data.shop_domain_id)
      .first<{ id: number }>()
    if (!domain) return c.json({ error: 'shop_domain_id must reference an existing shop domain' }, 400)
  }

  const activeLinkCount = await c.env.DB.prepare(`
    SELECT COUNT(*) AS count
    FROM product_shop_links
    WHERE product_id = ?
      AND active = 1
  `).bind(productId).first<CountRow>()
  const maxSortRow = await c.env.DB.prepare(`
    SELECT MAX(sort_order) AS sort_order
    FROM product_shop_links
    WHERE product_id = ?
  `).bind(productId).first<{ sort_order: number | null }>()

  const active = data.active ?? 1
  const isPrimary = data.is_primary ?? ((activeLinkCount?.count ?? 0) === 0 && active === 1 ? 1 : 0)
  const sortOrder = data.sort_order ?? ((maxSortRow?.sort_order ?? -10) + 10)

  if (isPrimary === 1 && active === 1) {
    await c.env.DB.prepare(`
      UPDATE product_shop_links
      SET is_primary = 0,
          updated_at = datetime('now'),
          version = COALESCE(version, 0) + 1
      WHERE product_id = ?
    `).bind(productId).run()
  }

  const result = await c.env.DB.prepare(`
    INSERT INTO product_shop_links (
      product_id,
      shop_domain_id,
      shop_name,
      url,
      normalized_host,
      is_affiliate,
      affiliate_owner_type,
      affiliate_owner_user_id,
      source_type,
      is_primary,
      active,
      sort_order,
      created_at,
      updated_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
  `).bind(
    productId,
    data.shop_domain_id ?? null,
    data.shop_name ?? null,
    url,
    data.normalized_host ?? null,
    affiliateOwner.value.is_affiliate,
    affiliateOwner.value.affiliate_owner_type,
    affiliateOwner.value.affiliate_owner_user_id,
    data.source_type ?? 'admin',
    isPrimary,
    active,
    sortOrder,
  ).run()

  const shopLinkId = result.meta.last_row_id as number
  const includeHealth = await hasTable(c.env.DB, 'product_shop_link_health')
  if (includeHealth) {
    await c.env.DB.prepare(`
      INSERT OR IGNORE INTO product_shop_link_health (
        shop_link_id,
        url,
        status,
        created_at,
        updated_at
      )
      VALUES (?, ?, 'unchecked', datetime('now'), datetime('now'))
    `).bind(shopLinkId, url).run()
  }

  await syncProductLegacyShopLinkFromPrimary(c.env.DB, productId)
  const row = await getProductShopLinkRow(c.env.DB, productId, shopLinkId, includeHealth)

  await logAdminAction(c, {
    action: 'create_product_shop_link',
    entity_type: 'product_shop_link',
    entity_id: shopLinkId,
    changes: { product_id: productId, after: row },
  })

  return c.json({ ok: true, link: row ? formatProductShopLink(row) : null }, 201)
})

// PATCH /api/admin/products/:id/shop-links/:shopLinkId (admin only)
admin.patch('/products/:id/shop-links/:shopLinkId', async (c) => {
  const authErr = await ensureAdmin(c)
  if (authErr) return authErr

  const productId = parsePositiveId(c.req.param('id'))
  if (productId === null) return c.json({ error: 'Invalid product id' }, 400)
  const shopLinkId = parsePositiveId(c.req.param('shopLinkId'))
  if (shopLinkId === null) return c.json({ error: 'Invalid product shop link id' }, 400)
  if (!(await hasTable(c.env.DB, 'product_shop_links'))) {
    return c.json({ error: 'product_shop_links is not available in this environment' }, 409)
  }

  const includeHealth = await hasTable(c.env.DB, 'product_shop_link_health')
  const existing = await getProductShopLinkRow(c.env.DB, productId, shopLinkId, includeHealth)
  if (!existing) return c.json({ error: 'Product shop link not found' }, 404)

  let body: Record<string, unknown>
  try {
    body = await c.req.json()
  } catch {
    return c.json({ error: 'Invalid JSON' }, 400)
  }

  const validation = validateProductShopLinkMutation(body, existing)
  if (!validation.ok) return c.json({ error: validation.error }, validation.status)
  const data = validation.value
  if (Object.keys(data).length === 0) return c.json({ error: 'At least one product shop link field is required' }, 400)

  if (
    data.affiliate_owner_type !== undefined ||
    data.affiliate_owner_user_id !== undefined ||
    data.is_affiliate !== undefined
  ) {
    const affiliateOwner = await validateAffiliateOwnerUser(c.env.DB, {
      affiliate_owner_type: data.affiliate_owner_type ?? existing.affiliate_owner_type,
      affiliate_owner_user_id: data.affiliate_owner_user_id ?? existing.affiliate_owner_user_id,
      is_affiliate: data.is_affiliate ?? existing.is_affiliate,
    })
    if (!affiliateOwner.ok) return c.json({ error: affiliateOwner.error }, affiliateOwner.status)
    data.affiliate_owner_type = affiliateOwner.value.affiliate_owner_type
    data.affiliate_owner_user_id = affiliateOwner.value.affiliate_owner_user_id
    data.is_affiliate = affiliateOwner.value.is_affiliate
  }

  if (data.shop_domain_id !== undefined && data.shop_domain_id !== null) {
    const domain = await c.env.DB.prepare('SELECT id FROM shop_domains WHERE id = ?')
      .bind(data.shop_domain_id)
      .first<{ id: number }>()
    if (!domain) return c.json({ error: 'shop_domain_id must reference an existing shop domain' }, 400)
  }

  const lock = validateOptimisticLock(true, existing.version, requestVersion(c, body))
  if (!lock.ok) return c.json({ error: lock.error, current_version: existing.version }, 409)

  const nextActive = data.active ?? existing.active
  const nextPrimary = data.is_primary ?? existing.is_primary
  if (nextPrimary === 1 && nextActive === 1) {
    await c.env.DB.prepare(`
      UPDATE product_shop_links
      SET is_primary = 0,
          updated_at = datetime('now'),
          version = COALESCE(version, 0) + 1
      WHERE product_id = ?
        AND id <> ?
    `).bind(productId, shopLinkId).run()
  }

  const fields = [
    'shop_domain_id',
    'shop_name',
    'url',
    'normalized_host',
    'is_affiliate',
    'affiliate_owner_type',
    'affiliate_owner_user_id',
    'source_type',
    'is_primary',
    'active',
    'sort_order',
  ] as const
  const setClauses: string[] = []
  const bindings: Array<string | number | null> = []
  const before: Record<string, unknown> = {}
  const after: Record<string, unknown> = {}
  for (const field of fields) {
    if (!hasOwnKey(data, field)) continue
    setClauses.push(`${field} = ?`)
    bindings.push(data[field] ?? null)
    before[field] = existing[field]
    after[field] = data[field] ?? null
  }
  setClauses.push("updated_at = datetime('now')", 'version = COALESCE(version, 0) + 1')
  const whereSql = lock.value.enforce ? 'product_id = ? AND id = ? AND version = ?' : 'product_id = ? AND id = ?'

  const updateResult = await c.env.DB.prepare(`
    UPDATE product_shop_links
    SET ${setClauses.join(', ')}
    WHERE ${whereSql}
  `).bind(
    ...bindings,
    productId,
    shopLinkId,
    ...(lock.value.enforce ? [lock.value.expectedVersion] : []),
  ).run()
  if (lock.value.enforce && d1ChangeCount(updateResult) === 0) {
    const current = await getProductShopLinkRow(c.env.DB, productId, shopLinkId, includeHealth)
    return c.json({ error: 'Version conflict', current_version: current?.version ?? existing.version }, 409)
  }

  if (hasOwnKey(data, 'url') && includeHealth) {
    await c.env.DB.prepare('DELETE FROM product_shop_link_health WHERE shop_link_id = ?').bind(shopLinkId).run()
    await c.env.DB.prepare(`
      INSERT INTO product_shop_link_health (
        shop_link_id,
        url,
        status,
        created_at,
        updated_at
      )
      VALUES (?, ?, 'unchecked', datetime('now'), datetime('now'))
    `).bind(shopLinkId, data.url).run()
  }

  await syncProductLegacyShopLinkFromPrimary(c.env.DB, productId)
  const row = await getProductShopLinkRow(c.env.DB, productId, shopLinkId, includeHealth)

  await logAdminAction(c, {
    action: 'update_product_shop_link',
    entity_type: 'product_shop_link',
    entity_id: shopLinkId,
    changes: { product_id: productId, before, after },
  })

  return c.json({ ok: true, link: row ? formatProductShopLink(row) : null })
})

// DELETE /api/admin/products/:id/shop-links/:shopLinkId (admin only)
admin.delete('/products/:id/shop-links/:shopLinkId', async (c) => {
  const authErr = await ensureAdmin(c)
  if (authErr) return authErr

  const productId = parsePositiveId(c.req.param('id'))
  if (productId === null) return c.json({ error: 'Invalid product id' }, 400)
  const shopLinkId = parsePositiveId(c.req.param('shopLinkId'))
  if (shopLinkId === null) return c.json({ error: 'Invalid product shop link id' }, 400)
  if (!(await hasTable(c.env.DB, 'product_shop_links'))) {
    return c.json({ error: 'product_shop_links is not available in this environment' }, 409)
  }

  const includeHealth = await hasTable(c.env.DB, 'product_shop_link_health')
  const existing = await getProductShopLinkRow(c.env.DB, productId, shopLinkId, includeHealth)
  if (!existing) return c.json({ error: 'Product shop link not found' }, 404)

  const lock = validateOptimisticLock(true, existing.version, await requestVersionFromRequest(c))
  if (!lock.ok) return c.json({ error: lock.error, current_version: existing.version }, 409)
  const whereSql = lock.value.enforce ? 'product_id = ? AND id = ? AND version = ?' : 'product_id = ? AND id = ?'
  const deleteResult = await c.env.DB.prepare(`
    DELETE FROM product_shop_links
    WHERE ${whereSql}
  `).bind(
    productId,
    shopLinkId,
    ...(lock.value.enforce ? [lock.value.expectedVersion] : []),
  ).run()
  if (lock.value.enforce && d1ChangeCount(deleteResult) === 0) {
    const current = await getProductShopLinkRow(c.env.DB, productId, shopLinkId, includeHealth)
    return c.json({ error: 'Version conflict', current_version: current?.version ?? existing.version }, 409)
  }

  await syncProductLegacyShopLinkFromPrimary(c.env.DB, productId)
  await logAdminAction(c, {
    action: 'delete_product_shop_link',
    entity_type: 'product_shop_link',
    entity_id: shopLinkId,
    changes: { product_id: productId, before: existing },
  })

  return c.json({ ok: true })
})

// POST /api/admin/products/:id/shop-links/:shopLinkId/recheck (admin only)
admin.post('/products/:id/shop-links/:shopLinkId/recheck', async (c) => {
  const authErr = await ensureAdmin(c)
  if (authErr) return authErr

  const productId = parsePositiveId(c.req.param('id'))
  if (productId === null) return c.json({ error: 'Invalid product id' }, 400)
  const shopLinkId = parsePositiveId(c.req.param('shopLinkId'))
  if (shopLinkId === null) return c.json({ error: 'Invalid product shop link id' }, 400)
  if (!(await hasTable(c.env.DB, 'product_shop_links'))) {
    return c.json({ error: 'product_shop_links is not available in this environment' }, 409)
  }
  if (!(await hasTable(c.env.DB, 'product_shop_link_health'))) {
    return c.json({ error: 'product_shop_link_health is not available in this environment' }, 409)
  }

  const existing = await getProductShopLinkRow(c.env.DB, productId, shopLinkId, true)
  if (!existing) return c.json({ error: 'Product shop link not found' }, 404)

  const checkedAt = new Date().toISOString()
  const result = await checkProductShopLink(existing.url)
  await persistProductShopLinkHealth(c.env.DB, shopLinkId, result, checkedAt)

  const row = await getProductShopLinkRow(c.env.DB, productId, shopLinkId, true)
  await logAdminAction(c, {
    action: 'recheck_product_shop_link',
    entity_type: 'product_shop_link',
    entity_id: shopLinkId,
    changes: { product_id: productId, result },
  })

  return c.json({ ok: true, result, link: row ? formatProductShopLink(row) : null })
})

// GET /api/admin/products/:id (admin only)
admin.get('/products/:id', async (c) => {
  const authErr = await ensureAdmin(c)
  if (authErr) return authErr

  const id = parsePositiveId(c.req.param('id'))
  if (id === null) return c.json({ error: 'Invalid product id' }, 400)

  const includeLinkHealth = await hasAffiliateLinkHealthTable(c.env.DB)
  const linkHealthSelect = includeLinkHealth ? `,${AFFILIATE_LINK_HEALTH_SELECT}` : ''
  const linkHealthJoin = includeLinkHealth ? 'LEFT JOIN affiliate_link_health lh ON lh.product_id = p.id' : ''
  const product = await c.env.DB.prepare(
    `
      SELECT p.*${linkHealthSelect}
      FROM products p
      ${linkHealthJoin}
      WHERE p.id = ?
    `
  ).bind(id).first<ProductRow & Partial<AffiliateLinkHealthSelectRow>>()
  if (!product) return c.json({ error: 'Product not found' }, 404)

  const [
    ingredientsResult,
    qa,
    productWarnings,
    warningsByProduct,
    linkReportsResult,
    linkReportCounts,
    auditRowsResult,
    auditCount,
  ] = await Promise.all([
    c.env.DB.prepare(`
      SELECT
        pi.id,
        pi.product_id,
        pi.ingredient_id,
        i.name AS ingredient_name,
        i.unit AS ingredient_unit,
        i.description AS ingredient_description,
        pi.form_id,
        f.name AS form_name,
        pi.parent_ingredient_id,
        parent.name AS parent_ingredient_name,
        COALESCE(pi.is_main, 0) AS is_main,
        COALESCE(pi.search_relevant, 1) AS search_relevant,
        pi.quantity,
        pi.unit,
        pi.basis_quantity,
        pi.basis_unit,
        COALESCE(idp_form.effect_summary, idp_base.effect_summary) AS effect_summary,
        COALESCE(idp_form.timing, idp_base.timing) AS timing,
        COALESCE(idp_form.timing_note, idp_base.timing_note) AS timing_note,
        COALESCE(idp_form.intake_hint, idp_base.intake_hint) AS intake_hint,
        COALESCE(idp_form.card_note, idp_base.card_note) AS card_note
      FROM product_ingredients pi
      JOIN ingredients i ON i.id = pi.ingredient_id
      LEFT JOIN ingredient_forms f ON f.id = pi.form_id
      LEFT JOIN ingredients parent ON parent.id = pi.parent_ingredient_id
      LEFT JOIN ingredient_display_profiles idp_form
        ON idp_form.ingredient_id = pi.ingredient_id
       AND idp_form.form_id = pi.form_id
       AND idp_form.sub_ingredient_id IS NULL
      LEFT JOIN ingredient_display_profiles idp_base
        ON idp_base.ingredient_id = pi.ingredient_id
       AND idp_base.form_id IS NULL
       AND idp_base.sub_ingredient_id IS NULL
      WHERE pi.product_id = ?
      ORDER BY pi.is_main DESC, pi.search_relevant DESC, i.name ASC, pi.id ASC
    `).bind(id).all<AdminProductIngredientRow>(),
    getProductQaRow(c.env.DB, id, includeLinkHealth),
    loadProductWarnings(c.env.DB, id),
    loadCatalogProductSafetyWarnings(c.env.DB, [id]),
    c.env.DB.prepare(`
      SELECT
        r.id,
        r.user_id,
        u.email AS user_email,
        r.stack_id,
        s.name AS stack_name,
        r.product_type,
        r.product_id,
        r.product_name,
        r.shop_link_snapshot,
        p.shop_link AS current_shop_link,
        r.reason,
        r.status,
        r.created_at
      FROM product_link_reports r
      LEFT JOIN users u ON u.id = r.user_id
      LEFT JOIN stacks s ON s.id = r.stack_id
      LEFT JOIN products p ON p.id = r.product_id
      WHERE r.product_type = 'catalog'
        AND r.product_id = ?
      ORDER BY
        CASE r.status WHEN 'open' THEN 0 WHEN 'reviewed' THEN 1 ELSE 2 END,
        r.created_at DESC,
        r.id DESC
      LIMIT 20
    `).bind(id).all<ProductLinkReportRow>(),
    c.env.DB.prepare(`
      SELECT
        COUNT(*) AS count,
        SUM(CASE WHEN status = 'open' THEN 1 ELSE 0 END) AS open_count
      FROM product_link_reports
      WHERE product_type = 'catalog'
        AND product_id = ?
    `).bind(id).first<{ count: number; open_count: number | null }>(),
    c.env.DB.prepare(`
      SELECT
        aal.id,
        aal.user_id,
        u.email AS user_email,
        aal.action,
        aal.entity_type,
        aal.entity_id,
        aal.changes,
        aal.reason,
        aal.ip_address,
        aal.user_agent,
        aal.created_at
      FROM admin_audit_log aal
      LEFT JOIN users u ON u.id = aal.user_id
      WHERE aal.entity_type = 'product'
        AND aal.entity_id = ?
      ORDER BY aal.created_at DESC, aal.id DESC
      LIMIT 10
    `).bind(id).all<AuditLogDbRow>(),
    c.env.DB.prepare(`
      SELECT COUNT(*) AS count
      FROM admin_audit_log
      WHERE entity_type = 'product'
        AND entity_id = ?
    `).bind(id).first<CountRow>(),
  ])

  const qaIssues = qa ? productQaIssues(qa) : []
  const warnings = warningsByProduct.get(id) ?? []
  const activeProductWarnings = productWarnings.filter((warning) => warning.active !== 0)
  const linkReportCount = linkReportCounts?.count ?? 0
  const openLinkReportCount = linkReportCounts?.open_count ?? 0

  return c.json({
    product: withAffiliateLinkHealth(product),
    ingredients: ingredientsResult.results ?? [],
    qa: qa ? formatProductQaRow(qa) : null,
    qa_counts: {
      ingredient_count: qa?.ingredient_count ?? ingredientsResult.results?.length ?? 0,
      main_ingredient_count: qa?.main_ingredient_count ?? 0,
      issue_count: qaIssues.length,
      warning_count: warnings.length,
      product_warning_count: activeProductWarnings.length,
      link_report_count: linkReportCount,
      open_link_report_count: openLinkReportCount,
      audit_count: auditCount?.count ?? 0,
    },
    warnings,
    product_warnings: productWarnings,
    link_reports: linkReportsResult.results ?? [],
    audit_logs: (auditRowsResult.results ?? []).map((row) => ({
      id: row.id,
      user_id: row.user_id,
      user_email: row.user_email,
      action: row.action,
      entity_type: row.entity_type,
      entity_id: row.entity_id,
      changes: parseAuditChanges(row.changes),
      reason: row.reason,
      ip_address: row.ip_address,
      user_agent: row.user_agent,
      created_at: row.created_at,
    })),
  })
})

// POST /api/admin/products/:id/image (admin only)
admin.post('/products/:id/image', async (c) => {
  const authErr = await ensureAdmin(c)
  if (authErr) return authErr

  const id = parsePositiveId(c.req.param('id'))
  if (id === null) return c.json({ error: 'Invalid product id' }, 400)
  if (!c.env.PRODUCT_IMAGES) return c.json({ error: 'Product image storage is not configured' }, 501)

  const productColumns = await getTableColumns(c.env.DB, 'products')
  if (!productColumns.has('image_url') || !productColumns.has('image_r2_key')) {
    return c.json({ error: 'Product image columns are not available in this environment' }, 409)
  }

  const productVersionSelect = productColumns.has('version') ? 'version' : 'NULL AS version'
  const existing = await c.env.DB.prepare(`
    SELECT id, image_url, image_r2_key, ${productVersionSelect}
    FROM products
    WHERE id = ?
  `).bind(id).first<{
    id: number
    image_url: string | null
    image_r2_key: string | null
    version: number | null
  }>()
  if (!existing) return c.json({ error: 'Product not found' }, 404)

  let formData: FormData
  try {
    formData = await c.req.formData()
  } catch {
    return c.json({ error: 'Invalid multipart form data' }, 400)
  }

  const fileEntry = formData.get('image') ?? formData.get('file')
  if (!fileEntry || typeof fileEntry === 'string') return c.json({ error: 'image field required' }, 400)
  const file = fileEntry as unknown as {
    type: string
    size: number
    arrayBuffer(): Promise<ArrayBuffer>
  }

  if (!isSupportedProductImageType(file.type)) return c.json({ error: 'Only JPEG, PNG or WebP images are allowed' }, 415)
  if (file.size > PRODUCT_IMAGE_MAX_UPLOAD_BYTES) return c.json({ error: 'Max 1 MB after image optimization' }, 413)

  const expectedVersion = parseVersionValue(c.req.header('If-Match')) ?? parseVersionValue(formData.get('version'))
  const lock = validateOptimisticLock(productColumns.has('version'), existing.version, expectedVersion)
  if (!lock.ok) return c.json({ error: lock.error, current_version: existing.version }, 409)

  const ext = getProductImageExtension(file.type) ?? 'jpg'
  const filename = `${crypto.randomUUID()}.${ext}`
  const r2Key = `products/${id}/${filename}`
  const imageUrl = `/api/r2/products/${id}/${filename}`

  const buffer = await file.arrayBuffer()
  await c.env.PRODUCT_IMAGES.put(r2Key, buffer, {
    httpMetadata: { contentType: file.type },
  })

  const versionSet = lock.value.enforce ? ', version = COALESCE(version, 0) + 1' : ''
  const whereSql = lock.value.enforce ? optimisticWhere() : 'id = ?'
  const updateResult = await c.env.DB.prepare(`
    UPDATE products
    SET image_url = ?,
        image_r2_key = ?${versionSet}
    WHERE ${whereSql}
  `).bind(
    imageUrl,
    r2Key,
    id,
    ...(lock.value.enforce ? [lock.value.expectedVersion] : []),
  ).run()

  if (lock.value.enforce && d1ChangeCount(updateResult) === 0) {
    await c.env.PRODUCT_IMAGES.delete(r2Key).catch(() => undefined)
    const current = await getProductVersionRow(c.env.DB, id, productColumns)
    return c.json({ error: 'Version conflict', current_version: current?.version ?? existing.version }, 409)
  }

  const current = await getProductVersionRow(c.env.DB, id, productColumns)
  await logAdminAction(c, {
    action: 'upload_admin_product_image',
    entity_type: 'product',
    entity_id: id,
    changes: {
      before: {
        image_url: existing.image_url,
        image_r2_key: existing.image_r2_key,
      },
      after: {
        image_url: imageUrl,
        image_r2_key: r2Key,
      },
    },
  })

  return c.json({
    image_url: imageUrl,
    image_r2_key: r2Key,
    product_version: current?.version ?? null,
  })
})

// DELETE /api/admin/products/:id/image (admin only)
admin.delete('/products/:id/image', async (c) => {
  const authErr = await ensureAdmin(c)
  if (authErr) return authErr

  const id = parsePositiveId(c.req.param('id'))
  if (id === null) return c.json({ error: 'Invalid product id' }, 400)

  const productColumns = await getTableColumns(c.env.DB, 'products')
  if (!productColumns.has('image_url') || !productColumns.has('image_r2_key')) {
    return c.json({ error: 'Product image columns are not available in this environment' }, 409)
  }

  const productVersionSelect = productColumns.has('version') ? 'version' : 'NULL AS version'
  const existing = await c.env.DB.prepare(`
    SELECT id, image_url, image_r2_key, ${productVersionSelect}
    FROM products
    WHERE id = ?
  `).bind(id).first<{
    id: number
    image_url: string | null
    image_r2_key: string | null
    version: number | null
  }>()
  if (!existing) return c.json({ error: 'Product not found' }, 404)

  const expectedVersion = await requestVersionFromRequest(c)
  const lock = validateOptimisticLock(productColumns.has('version'), existing.version, expectedVersion)
  if (!lock.ok) return c.json({ error: lock.error, current_version: existing.version }, 409)

  const versionSet = lock.value.enforce ? ', version = COALESCE(version, 0) + 1' : ''
  const whereSql = lock.value.enforce ? optimisticWhere() : 'id = ?'
  const updateResult = await c.env.DB.prepare(`
    UPDATE products
    SET image_url = NULL,
        image_r2_key = NULL${versionSet}
    WHERE ${whereSql}
  `).bind(
    id,
    ...(lock.value.enforce ? [lock.value.expectedVersion] : []),
  ).run()

  if (lock.value.enforce && d1ChangeCount(updateResult) === 0) {
    const current = await getProductVersionRow(c.env.DB, id, productColumns)
    return c.json({ error: 'Version conflict', current_version: current?.version ?? existing.version }, 409)
  }

  if (existing.image_r2_key && c.env.PRODUCT_IMAGES) {
    await c.env.PRODUCT_IMAGES.delete(existing.image_r2_key).catch(() => undefined)
  }

  const current = await getProductVersionRow(c.env.DB, id, productColumns)
  await logAdminAction(c, {
    action: 'delete_admin_product_image',
    entity_type: 'product',
    entity_id: id,
    changes: {
      before: {
        image_url: existing.image_url,
        image_r2_key: existing.image_r2_key,
      },
      after: {
        image_url: null,
        image_r2_key: null,
      },
    },
  })

  return c.json({
    ok: true,
    image_url: null,
    image_r2_key: null,
    product_version: current?.version ?? null,
  })
})

// POST /api/admin/products/:id/ingredients (admin only)
admin.post('/products/:id/ingredients', async (c) => {
  const authErr = await ensureAdmin(c)
  if (authErr) return authErr

  const productId = parsePositiveId(c.req.param('id'))
  if (productId === null) return c.json({ error: 'Invalid product id' }, 400)
  const productColumns = await getTableColumns(c.env.DB, 'products')
  const productVersion = await getProductVersionRow(c.env.DB, productId, productColumns)
  if (!productVersion) return c.json({ error: 'Product not found' }, 404)

  let body: Record<string, unknown>
  try {
    body = await c.req.json()
  } catch {
    return c.json({ error: 'Invalid JSON' }, 400)
  }

  const validation = await validateProductIngredientPayload(c.env.DB, body, null)
  if (!validation.ok) return c.json({ error: validation.error }, validation.status ?? 400)
  const data = validation.value

  const lock = await reserveProductVersionForMutation(c.env.DB, productId, productColumns, requestVersion(c, body))
  if (!lock.ok) return c.json({ error: lock.error, current_version: lock.current_version }, 409)

  const result = await c.env.DB.prepare(`
    INSERT INTO product_ingredients (
      product_id,
      ingredient_id,
      is_main,
      quantity,
      unit,
      form_id,
      basis_quantity,
      basis_unit,
      search_relevant,
      parent_ingredient_id
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    productId,
    data.ingredient_id,
    data.is_main,
    data.quantity,
    data.unit,
    data.form_id,
    data.basis_quantity,
    data.basis_unit,
    data.search_relevant,
    data.parent_ingredient_id,
  ).run()

  const rowId = result.meta.last_row_id as number
  const row = await getProductIngredientRow(c.env.DB, productId, rowId)
  const productVersionAfter = lock.productVersion ?? await incrementProductVersionAfterMutation(c.env.DB, productId, productColumns)
  await logAdminAction(c, {
    action: 'create_product_ingredient',
    entity_type: 'product',
    entity_id: productId,
    changes: { after: row },
  })

  return c.json({ ok: true, ingredient: row, row, product_version: productVersionAfter }, 201)
})

// PUT /api/admin/products/:id/ingredients/:rowId (admin only)
admin.put('/products/:id/ingredients/:rowId', async (c) => {
  const authErr = await ensureAdmin(c)
  if (authErr) return authErr

  const productId = parsePositiveId(c.req.param('id'))
  if (productId === null) return c.json({ error: 'Invalid product id' }, 400)
  const rowId = parsePositiveId(c.req.param('rowId'))
  if (rowId === null) return c.json({ error: 'Invalid product ingredient row id' }, 400)

  const productColumns = await getTableColumns(c.env.DB, 'products')
  const productVersion = await getProductVersionRow(c.env.DB, productId, productColumns)
  if (!productVersion) return c.json({ error: 'Product not found' }, 404)

  const existing = await getProductIngredientRow(c.env.DB, productId, rowId)
  if (!existing) return c.json({ error: 'Product ingredient row not found' }, 404)

  let body: Record<string, unknown>
  try {
    body = await c.req.json()
  } catch {
    return c.json({ error: 'Invalid JSON' }, 400)
  }

  const validation = await validateProductIngredientPayload(c.env.DB, body, existing)
  if (!validation.ok) return c.json({ error: validation.error }, validation.status ?? 400)
  const data = validation.value

  const lock = await reserveProductVersionForMutation(c.env.DB, productId, productColumns, requestVersion(c, body))
  if (!lock.ok) return c.json({ error: lock.error, current_version: lock.current_version }, 409)

  await c.env.DB.prepare(`
    UPDATE product_ingredients
    SET
      ingredient_id = ?,
      is_main = ?,
      quantity = ?,
      unit = ?,
      form_id = ?,
      basis_quantity = ?,
      basis_unit = ?,
      search_relevant = ?,
      parent_ingredient_id = ?
    WHERE id = ?
      AND product_id = ?
  `).bind(
    data.ingredient_id,
    data.is_main,
    data.quantity,
    data.unit,
    data.form_id,
    data.basis_quantity,
    data.basis_unit,
    data.search_relevant,
    data.parent_ingredient_id,
    rowId,
    productId,
  ).run()

  const row = await getProductIngredientRow(c.env.DB, productId, rowId)
  const productVersionAfter = lock.productVersion ?? await incrementProductVersionAfterMutation(c.env.DB, productId, productColumns)
  await logAdminAction(c, {
    action: 'update_product_ingredient',
    entity_type: 'product',
    entity_id: productId,
    changes: { before: existing, after: row },
  })

  return c.json({ ok: true, ingredient: row, row, product_version: productVersionAfter })
})

// DELETE /api/admin/products/:id/ingredients/:rowId (admin only)
admin.delete('/products/:id/ingredients/:rowId', async (c) => {
  const authErr = await ensureAdmin(c)
  if (authErr) return authErr

  const productId = parsePositiveId(c.req.param('id'))
  if (productId === null) return c.json({ error: 'Invalid product id' }, 400)
  const rowId = parsePositiveId(c.req.param('rowId'))
  if (rowId === null) return c.json({ error: 'Invalid product ingredient row id' }, 400)

  const productColumns = await getTableColumns(c.env.DB, 'products')
  const productVersion = await getProductVersionRow(c.env.DB, productId, productColumns)
  if (!productVersion) return c.json({ error: 'Product not found' }, 404)

  const existing = await getProductIngredientRow(c.env.DB, productId, rowId)
  if (!existing) return c.json({ error: 'Product ingredient row not found' }, 404)

  const lock = await reserveProductVersionForMutation(c.env.DB, productId, productColumns, await requestVersionFromRequest(c))
  if (!lock.ok) return c.json({ error: lock.error, current_version: lock.current_version }, 409)

  await c.env.DB.prepare(`
    DELETE FROM product_ingredients
    WHERE id = ?
      AND product_id = ?
  `).bind(rowId, productId).run()

  const productVersionAfter = lock.productVersion ?? await incrementProductVersionAfterMutation(c.env.DB, productId, productColumns)
  await logAdminAction(c, {
    action: 'delete_product_ingredient',
    entity_type: 'product',
    entity_id: productId,
    changes: { before: existing },
  })

  return c.json({ ok: true, product_version: productVersionAfter })
})

// POST /api/admin/products/:id/warnings (admin only)
admin.post('/products/:id/warnings', async (c) => {
  const authErr = await ensureAdmin(c)
  if (authErr) return authErr

  const productId = parsePositiveId(c.req.param('id'))
  if (productId === null) return c.json({ error: 'Invalid product id' }, 400)
  if (!(await productExists(c.env.DB, productId))) return c.json({ error: 'Product not found' }, 404)
  if (!(await hasProductWarningsTable(c.env.DB))) {
    return c.json({ error: 'product_warnings table is not available in this environment' }, 409)
  }

  let body: Record<string, unknown>
  try {
    body = await c.req.json()
  } catch {
    return c.json({ error: 'Invalid JSON' }, 400)
  }

  const validation = validateProductWarningPayload(body, null)
  if (!validation.ok) return c.json({ error: validation.error }, validation.status ?? 400)
  const data = validation.value

  const result = await c.env.DB.prepare(`
    INSERT INTO product_warnings (
      product_id,
      severity,
      title,
      message,
      alternative_note,
      active
    )
    VALUES (?, ?, ?, ?, ?, ?)
  `).bind(
    productId,
    data.severity,
    data.title,
    data.message,
    data.alternative_note,
    data.active,
  ).run()

  const warningId = result.meta.last_row_id as number
  const warning = await getProductWarningRow(c.env.DB, productId, warningId)
  await logAdminAction(c, {
    action: 'create_product_warning',
    entity_type: 'product_warning',
    entity_id: warningId,
    changes: { product_id: productId, ...data },
  })

  return c.json({ warning }, 201)
})

// PUT /api/admin/products/:id/warnings/:warningId (admin only)
admin.put('/products/:id/warnings/:warningId', async (c) => {
  const authErr = await ensureAdmin(c)
  if (authErr) return authErr

  const productId = parsePositiveId(c.req.param('id'))
  if (productId === null) return c.json({ error: 'Invalid product id' }, 400)
  const warningId = parsePositiveId(c.req.param('warningId'))
  if (warningId === null) return c.json({ error: 'Invalid warning id' }, 400)
  if (!(await hasProductWarningsTable(c.env.DB))) {
    return c.json({ error: 'product_warnings table is not available in this environment' }, 409)
  }
  const columns = await getTableColumns(c.env.DB, 'product_warnings')

  const existing = await getProductWarningRow(c.env.DB, productId, warningId)
  if (!existing) return c.json({ error: 'Warning not found' }, 404)

  let body: Record<string, unknown>
  try {
    body = await c.req.json()
  } catch {
    return c.json({ error: 'Invalid JSON' }, 400)
  }

  const validation = validateProductWarningPayload(body, existing)
  if (!validation.ok) return c.json({ error: validation.error }, validation.status ?? 400)
  const data = validation.value
  const lock = validateOptimisticLock(columns.has('version'), existing.version, requestVersion(c, body))
  if (!lock.ok) return c.json({ error: lock.error, current_version: existing.version }, 409)
  const versionSet = lock.value.enforce ? ', version = COALESCE(version, 0) + 1' : ''
  const whereSql = lock.value.enforce
    ? 'id = ? AND product_id = ? AND version = ?'
    : 'id = ? AND product_id = ?'

  const updateResult = await c.env.DB.prepare(`
    UPDATE product_warnings
    SET
      severity = ?,
      title = ?,
      message = ?,
      alternative_note = ?,
      active = ?,
      updated_at = CURRENT_TIMESTAMP${versionSet}
    WHERE ${whereSql}
  `).bind(
    data.severity,
    data.title,
    data.message,
    data.alternative_note,
    data.active,
    warningId,
    productId,
    ...(lock.value.enforce ? [lock.value.expectedVersion] : []),
  ).run()
  if (lock.value.enforce && d1ChangeCount(updateResult) === 0) {
    const current = await getProductWarningRow(c.env.DB, productId, warningId)
    return c.json({ error: 'Version conflict', current_version: current?.version ?? existing.version }, 409)
  }

  const warning = await getProductWarningRow(c.env.DB, productId, warningId)
  await logAdminAction(c, {
    action: 'update_product_warning',
    entity_type: 'product_warning',
    entity_id: warningId,
    changes: { before: existing, after: warning },
  })

  return c.json({ warning })
})

// DELETE /api/admin/products/:id/warnings/:warningId (admin only)
admin.delete('/products/:id/warnings/:warningId', async (c) => {
  const authErr = await ensureAdmin(c)
  if (authErr) return authErr

  const productId = parsePositiveId(c.req.param('id'))
  if (productId === null) return c.json({ error: 'Invalid product id' }, 400)
  const warningId = parsePositiveId(c.req.param('warningId'))
  if (warningId === null) return c.json({ error: 'Invalid warning id' }, 400)
  if (!(await hasProductWarningsTable(c.env.DB))) {
    return c.json({ error: 'product_warnings table is not available in this environment' }, 409)
  }
  const columns = await getTableColumns(c.env.DB, 'product_warnings')

  const existing = await getProductWarningRow(c.env.DB, productId, warningId)
  if (!existing) return c.json({ error: 'Warning not found' }, 404)
  const expectedVersion = await requestVersionFromRequest(c)
  const lock = validateOptimisticLock(columns.has('version'), existing.version, expectedVersion)
  if (!lock.ok) return c.json({ error: lock.error, current_version: existing.version }, 409)
  const versionSet = lock.value.enforce ? ', version = COALESCE(version, 0) + 1' : ''
  const whereSql = lock.value.enforce
    ? 'id = ? AND product_id = ? AND version = ?'
    : 'id = ? AND product_id = ?'
  const whereBindings = lock.value.enforce
    ? [warningId, productId, lock.value.expectedVersion]
    : [warningId, productId]

  const hasActive = await productWarningsHasActiveColumn(c.env.DB)
  if (hasActive) {
    const deactivateResult = await c.env.DB.prepare(`
      UPDATE product_warnings
      SET active = 0,
          updated_at = CURRENT_TIMESTAMP${versionSet}
      WHERE ${whereSql}
    `).bind(...whereBindings).run()
    if (lock.value.enforce && d1ChangeCount(deactivateResult) === 0) {
      const current = await getProductWarningRow(c.env.DB, productId, warningId)
      return c.json({ error: 'Version conflict', current_version: current?.version ?? existing.version }, 409)
    }
  } else {
    const deleteResult = await c.env.DB.prepare(`
      DELETE FROM product_warnings
      WHERE ${whereSql}
    `).bind(...whereBindings).run()
    if (lock.value.enforce && d1ChangeCount(deleteResult) === 0) {
      const current = await getProductWarningRow(c.env.DB, productId, warningId)
      return c.json({ error: 'Version conflict', current_version: current?.version ?? existing.version }, 409)
    }
  }

  const warning = await getProductWarningRow(c.env.DB, productId, warningId)
  await logAdminAction(c, {
    action: hasActive ? 'deactivate_product_warning' : 'delete_product_warning',
    entity_type: 'product_warning',
    entity_id: warningId,
    changes: hasActive
      ? { before: { active: existing.active }, after: { active: warning?.active ?? 0 } }
      : existing,
  })

  return c.json({ ok: true, warning })
})

// GET /api/admin/stats (admin only)
admin.get('/stats', async (c) => {
  const authErr = await ensureAuth(c)
  if (authErr) return authErr
  const admErr = requireAdmin(c)
  if (admErr) return admErr

  const rangeParam = c.req.query('range') ?? '30d'
  const range = ['30d', '60d', '1y', 'this_month', 'last_month', 'all'].includes(rangeParam)
    ? rangeParam
    : '30d'
  const rangeWindow = (column: string, period: 'current' | 'previous'): string => {
    if (range === 'all') return period === 'current' ? '1 = 1' : '0 = 1'
    if (range === '60d') {
      return period === 'current'
        ? `${column} >= datetime('now', '-60 days')`
        : `${column} >= datetime('now', '-120 days') AND ${column} < datetime('now', '-60 days')`
    }
    if (range === '1y') {
      return period === 'current'
        ? `${column} >= datetime('now', '-1 year')`
        : `${column} >= datetime('now', '-2 years') AND ${column} < datetime('now', '-1 year')`
    }
    if (range === 'this_month') {
      return period === 'current'
        ? `${column} >= date('now', 'start of month')`
        : `${column} >= date('now', 'start of month', '-1 month') AND ${column} < date('now', 'start of month')`
    }
    if (range === 'last_month') {
      return period === 'current'
        ? `${column} >= date('now', 'start of month', '-1 month') AND ${column} < date('now', 'start of month')`
        : `${column} >= date('now', 'start of month', '-2 months') AND ${column} < date('now', 'start of month', '-1 month')`
    }
    return period === 'current'
      ? `${column} >= datetime('now', '-30 days')`
      : `${column} >= datetime('now', '-60 days') AND ${column} < datetime('now', '-30 days')`
  }
  const currentRangeCondition = (column: string): string => rangeWindow(column, 'current')
  const previousRangeCondition = (column: string): string => rangeWindow(column, 'previous')
  const buildTrend = (current: number, previous: number) => ({
    current,
    previous,
    delta: current - previous,
    delta_percent: previous > 0 ? ((current - previous) / previous) * 100 : null,
  })

  const hasLinkClicks = await hasTable(c.env.DB, 'product_link_clicks')
  const hasShopLinkHealth = await hasTable(c.env.DB, 'product_shop_link_health')
  const hasLegacyLinkHealth = await hasAffiliateLinkHealthTable(c.env.DB)
  const hasShopLinks = await hasTable(c.env.DB, 'product_shop_links')
  const hasLinkReports = await hasTable(c.env.DB, 'product_link_reports')
  const hasStackEmailEvents = await hasTable(c.env.DB, 'stack_email_events')
  const hasAccountDeletionEvents = await hasTable(c.env.DB, 'account_deletion_events')
  const hasPageViewEvents = await hasTable(c.env.DB, 'page_view_events')
  const hasSignupAttribution = await hasTable(c.env.DB, 'signup_attribution')
  const hasUserProducts = await hasTable(c.env.DB, 'user_products')
  const hasKnowledgeArticleIngredients = await hasTable(c.env.DB, 'knowledge_article_ingredients')
  const pageViewColumns = hasPageViewEvents ? await getTableColumns(c.env.DB, 'page_view_events') : new Set<string>()
  const hasPageViewVisitorId = pageViewColumns.has('visitor_id')
  const userColumns = await getTableColumns(c.env.DB, 'users')
  const hasLastSeenAt = userColumns.has('last_seen_at')
  const inactiveCondition = (() => {
    if (!hasLastSeenAt || range === 'all') return '0 = 1'
    if (range === '60d') return "(u.last_seen_at IS NULL OR u.last_seen_at < datetime('now', '-60 days'))"
    if (range === '1y') return "(u.last_seen_at IS NULL OR u.last_seen_at < datetime('now', '-1 year'))"
    if (range === 'this_month') return "(u.last_seen_at IS NULL OR u.last_seen_at < date('now', 'start of month'))"
    if (range === 'last_month') return "(u.last_seen_at IS NULL OR u.last_seen_at < date('now', 'start of month', '-1 month'))"
    return "(u.last_seen_at IS NULL OR u.last_seen_at < datetime('now', '-30 days'))"
  })()

  const [
    usersRow,
    activeUsersRow,
    registrationsRow,
    previousRegistrationsRow,
    activationsRow,
    previousActivationsRow,
    ingredientsRow,
    productsRow,
    stacksRow,
    stacksRangeRow,
    previousStacksRangeRow,
    pendingRow,
    blockedRow,
    linkClicksRow,
    previousLinkClicksRow,
    affiliateLinkClicksRow,
    previousAffiliateLinkClicksRow,
    nonAffiliateLinkClicksRow,
    productsClickedWithoutActiveLinkRow,
    openLinkReportsRow,
    deadlinksRow,
    staleDeadlinksRow,
    topProductsResult,
    topShopsResult,
  ] = await Promise.all([
    c.env.DB.prepare('SELECT COUNT(*) as count FROM users').first<CountRow>(),
    c.env.DB.prepare('SELECT COUNT(*) as count FROM users WHERE email_verified_at IS NOT NULL').first<CountRow>(),
    c.env.DB.prepare(`SELECT COUNT(*) as count FROM users WHERE ${currentRangeCondition('created_at')}`).first<CountRow>(),
    c.env.DB.prepare(`SELECT COUNT(*) as count FROM users WHERE ${previousRangeCondition('created_at')}`).first<CountRow>(),
    c.env.DB.prepare(`SELECT COUNT(*) as count FROM users WHERE email_verified_at IS NOT NULL AND ${currentRangeCondition('created_at')}`).first<CountRow>(),
    c.env.DB.prepare(`SELECT COUNT(*) as count FROM users WHERE email_verified_at IS NOT NULL AND ${previousRangeCondition('created_at')}`).first<CountRow>(),
    c.env.DB.prepare('SELECT COUNT(*) as count FROM ingredients').first<CountRow>(),
    c.env.DB.prepare('SELECT COUNT(*) as count FROM products').first<CountRow>(),
    c.env.DB.prepare('SELECT COUNT(*) as count FROM stacks').first<CountRow>(),
    c.env.DB.prepare(`SELECT COUNT(*) as count FROM stacks WHERE ${currentRangeCondition('created_at')}`).first<CountRow>(),
    c.env.DB.prepare(`SELECT COUNT(*) as count FROM stacks WHERE ${previousRangeCondition('created_at')}`).first<CountRow>(),
    c.env.DB.prepare(
      `SELECT COUNT(*) as count FROM products WHERE moderation_status = 'pending'`
    ).first<CountRow>(),
    c.env.DB.prepare(
      `SELECT COUNT(*) as count FROM products WHERE moderation_status = 'blocked'`
    ).first<CountRow>(),
    hasLinkClicks
      ? c.env.DB.prepare(`SELECT COUNT(*) as count FROM product_link_clicks WHERE ${currentRangeCondition('clicked_at')}`).first<CountRow>()
      : Promise.resolve({ count: 0 }),
    hasLinkClicks
      ? c.env.DB.prepare(`SELECT COUNT(*) as count FROM product_link_clicks WHERE ${previousRangeCondition('clicked_at')}`).first<CountRow>()
      : Promise.resolve({ count: 0 }),
    hasLinkClicks
      ? c.env.DB.prepare(`
          SELECT COUNT(*) as count
          FROM product_link_clicks
          WHERE is_affiliate = 1
            AND ${currentRangeCondition('clicked_at')}
        `).first<CountRow>()
      : Promise.resolve({ count: 0 }),
    hasLinkClicks
      ? c.env.DB.prepare(`
          SELECT COUNT(*) as count
          FROM product_link_clicks
          WHERE is_affiliate = 1
            AND ${previousRangeCondition('clicked_at')}
        `).first<CountRow>()
      : Promise.resolve({ count: 0 }),
    hasLinkClicks
      ? c.env.DB.prepare(`
          SELECT COUNT(*) as count
          FROM product_link_clicks
          WHERE COALESCE(is_affiliate, 0) = 0
            AND ${currentRangeCondition('clicked_at')}
        `).first<CountRow>()
      : Promise.resolve({ count: 0 }),
    hasLinkClicks && hasShopLinks
      ? c.env.DB.prepare(`
          SELECT COUNT(DISTINCT plc.product_id) as count
          FROM product_link_clicks plc
          WHERE plc.product_type = 'catalog'
            AND ${currentRangeCondition('plc.clicked_at')}
            AND NOT EXISTS (
              SELECT 1
              FROM product_shop_links psl
              WHERE psl.product_id = plc.product_id
                AND psl.active = 1
            )
        `).first<CountRow>()
      : Promise.resolve({ count: 0 }),
    hasLinkReports
      ? c.env.DB.prepare("SELECT COUNT(*) as count FROM product_link_reports WHERE status = 'open'").first<CountRow>()
      : Promise.resolve({ count: 0 }),
    hasShopLinkHealth
      ? c.env.DB.prepare(`
          SELECT COUNT(*) as count
          FROM product_shop_link_health
          WHERE status IN ('failed', 'timeout', 'invalid')
        `).first<CountRow>()
      : hasLegacyLinkHealth
        ? c.env.DB.prepare(`
            SELECT COUNT(*) as count
            FROM affiliate_link_health
            WHERE status IN ('failed', 'timeout', 'invalid')
          `).first<CountRow>()
        : Promise.resolve({ count: 0 }),
    hasShopLinkHealth
      ? c.env.DB.prepare(`
          SELECT COUNT(*) as count
          FROM product_shop_link_health
          WHERE status IN ('failed', 'timeout', 'invalid')
            AND COALESCE(last_checked_at, updated_at, created_at) <= datetime('now', '-7 days')
        `).first<CountRow>()
      : hasLegacyLinkHealth
        ? c.env.DB.prepare(`
            SELECT COUNT(*) as count
            FROM affiliate_link_health
            WHERE status IN ('failed', 'timeout', 'invalid')
              AND COALESCE(last_checked_at, updated_at, created_at) <= datetime('now', '-7 days')
          `).first<CountRow>()
        : Promise.resolve({ count: 0 }),
    hasLinkClicks
      ? c.env.DB.prepare(`
          SELECT
            plc.product_id,
            COALESCE(p.name, 'Produkt ' || plc.product_id) AS name,
            p.brand,
            COUNT(*) AS clicks,
            SUM(CASE WHEN COALESCE(plc.is_affiliate, 0) = 1 THEN 1 ELSE 0 END) AS affiliate_clicks
          FROM product_link_clicks plc
          LEFT JOIN products p ON plc.product_type = 'catalog' AND p.id = plc.product_id
          WHERE plc.product_type = 'catalog'
            AND ${currentRangeCondition('plc.clicked_at')}
          GROUP BY plc.product_id, COALESCE(p.name, 'Produkt ' || plc.product_id), p.brand
          ORDER BY clicks DESC, affiliate_clicks DESC, name ASC
          LIMIT 5
        `).all<{
          product_id: number
          name: string
          brand: string | null
          clicks: number
          affiliate_clicks: number
        }>()
      : Promise.resolve({ results: [] }),
    hasLinkClicks && hasShopLinks
      ? c.env.DB.prepare(`
          SELECT
            COALESCE(NULLIF(psl.shop_name, ''), NULLIF(psl.normalized_host, ''), 'Unbekannter Shop') AS shop,
            COUNT(*) AS clicks,
            SUM(CASE WHEN COALESCE(plc.is_affiliate, 0) = 1 THEN 1 ELSE 0 END) AS affiliate_clicks
          FROM product_link_clicks plc
          LEFT JOIN product_shop_links psl ON psl.id = plc.shop_link_id
          WHERE ${currentRangeCondition('plc.clicked_at')}
          GROUP BY COALESCE(NULLIF(psl.shop_name, ''), NULLIF(psl.normalized_host, ''), 'Unbekannter Shop')
          ORDER BY clicks DESC, affiliate_clicks DESC, shop ASC
          LIMIT 5
        `).all<{
          shop: string
          clicks: number
          affiliate_clicks: number
        }>()
      : Promise.resolve({ results: [] }),
  ])

  const [
    stackEmailSendsRow,
    accountDeletionsRow,
    inactiveUsersRow,
    backlinksRow,
    googlePageviewsRow,
    deadlinkClicksRow,
    userAffiliateLinksActiveRow,
    linkReportUsersRow,
    userProductsPendingRow,
    userProductsPendingInRangeRow,
    ingredientsWithoutArticleRow,
    referralSourcesResult,
  ] = await Promise.all([
    hasStackEmailEvents
      ? c.env.DB.prepare(`
          SELECT COALESCE(SUM(stack_count), 0) AS count
          FROM stack_email_events
          WHERE ${currentRangeCondition('created_at')}
        `).first<CountRow>()
      : Promise.resolve({ count: 0 }),
    hasAccountDeletionEvents
      ? c.env.DB.prepare(`
          SELECT COUNT(*) AS count
          FROM account_deletion_events
          WHERE ${currentRangeCondition('created_at')}
        `).first<CountRow>()
      : Promise.resolve({ count: 0 }),
    hasLastSeenAt
      ? c.env.DB.prepare(`
          SELECT COUNT(*) AS count
          FROM users u
          WHERE COALESCE(u.role, 'user') <> 'admin'
            AND ${inactiveCondition}
        `).first<CountRow>()
      : Promise.resolve({ count: 0 }),
    hasPageViewEvents
      ? c.env.DB.prepare(`
          SELECT COUNT(DISTINCT referrer_host) AS count
          FROM page_view_events
          WHERE referrer_source = 'external'
            AND referrer_host IS NOT NULL
            AND ${currentRangeCondition('created_at')}
        `).first<CountRow>()
      : Promise.resolve({ count: 0 }),
    hasPageViewEvents
      ? c.env.DB.prepare(`
          SELECT COUNT(*) AS count
          FROM page_view_events
          WHERE referrer_source = 'google'
            AND ${currentRangeCondition('created_at')}
        `).first<CountRow>()
      : Promise.resolve({ count: 0 }),
    hasLinkClicks && hasShopLinkHealth
      ? c.env.DB.prepare(`
          SELECT COUNT(*) AS count
          FROM product_link_clicks plc
          JOIN product_shop_link_health pslh ON pslh.shop_link_id = plc.shop_link_id
          WHERE pslh.status IN ('failed', 'timeout', 'invalid')
            AND ${currentRangeCondition('plc.clicked_at')}
        `).first<CountRow>()
      : hasLinkClicks && hasLegacyLinkHealth
        ? c.env.DB.prepare(`
            SELECT COUNT(*) AS count
            FROM product_link_clicks plc
            JOIN affiliate_link_health lh ON lh.product_id = plc.product_id
            WHERE plc.product_type = 'catalog'
              AND lh.status IN ('failed', 'timeout', 'invalid')
              AND ${currentRangeCondition('plc.clicked_at')}
          `).first<CountRow>()
        : Promise.resolve({ count: 0 }),
    hasShopLinks
      ? c.env.DB.prepare(`
          SELECT COUNT(*) AS count
          FROM product_shop_links
          WHERE active = 1
            AND COALESCE(is_affiliate, 0) = 1
            AND affiliate_owner_type = 'user'
        `).first<CountRow>()
      : Promise.resolve({ count: 0 }),
    hasLinkReports
      ? c.env.DB.prepare(`
          SELECT COUNT(DISTINCT user_id) AS count
          FROM product_link_reports
          WHERE user_id IS NOT NULL
            AND ${currentRangeCondition('created_at')}
        `).first<CountRow>()
      : Promise.resolve({ count: 0 }),
    hasUserProducts
      ? c.env.DB.prepare("SELECT COUNT(*) AS count FROM user_products WHERE status = 'pending'").first<CountRow>()
      : Promise.resolve({ count: 0 }),
    hasUserProducts
      ? c.env.DB.prepare(`
          SELECT COUNT(*) AS count
          FROM user_products
          WHERE status = 'pending'
            AND ${currentRangeCondition('created_at')}
        `).first<CountRow>()
      : Promise.resolve({ count: 0 }),
    hasKnowledgeArticleIngredients
      ? c.env.DB.prepare(`
          SELECT COUNT(*) AS count
          FROM ingredients i
          LEFT JOIN ingredient_research_status rs ON rs.ingredient_id = i.id
          WHERE COALESCE(rs.blog_url, '') = ''
            AND NOT EXISTS (
              SELECT 1
              FROM knowledge_article_ingredients kai
              WHERE kai.ingredient_id = i.id
            )
            AND NOT EXISTS (
              SELECT 1
              FROM ingredient_safety_warnings w
              JOIN knowledge_articles a ON a.slug = w.article_slug
              WHERE w.ingredient_id = i.id
                AND w.active = 1
                AND w.article_slug IS NOT NULL
            )
        `).first<CountRow>()
      : Promise.resolve({ count: 0 }),
    loadReferralSources(c.env.DB, currentRangeCondition, {
      hasPageViewEvents,
      hasPageViewVisitorId,
      hasSignupAttribution,
    }),
  ])

  const registrations = registrationsRow?.count ?? 0
  const previousRegistrations = previousRegistrationsRow?.count ?? 0
  const activatedUsers = activationsRow?.count ?? 0
  const previousActivatedUsers = previousActivationsRow?.count ?? 0
  const stacksInRange = stacksRangeRow?.count ?? 0
  const previousStacksInRange = previousStacksRangeRow?.count ?? 0
  const linkClicks = linkClicksRow?.count ?? 0
  const previousLinkClicks = previousLinkClicksRow?.count ?? 0
  const affiliateLinkClicks = affiliateLinkClicksRow?.count ?? 0
  const previousAffiliateLinkClicks = previousAffiliateLinkClicksRow?.count ?? 0

  return c.json({
    range,
    users: usersRow?.count ?? 0,
    active_users: activeUsersRow?.count ?? 0,
    registrations,
    activated_users: activatedUsers,
    ingredients: ingredientsRow?.count ?? 0,
    products: productsRow?.count ?? 0,
    products_total: productsRow?.count ?? 0,
    stacks: stacksRow?.count ?? 0,
    stacks_in_range: stacksInRange,
    stack_email_sends: stackEmailSendsRow?.count ?? 0,
    account_deletions: accountDeletionsRow?.count ?? 0,
    inactive_users: inactiveUsersRow?.count ?? 0,
    backlinks: backlinksRow?.count ?? 0,
    google_pageviews: googlePageviewsRow?.count ?? 0,
    pending_products: pendingRow?.count ?? 0,
    products_pending: pendingRow?.count ?? 0,
    user_products_pending: userProductsPendingRow?.count ?? 0,
    user_products_pending_in_range: userProductsPendingInRangeRow?.count ?? 0,
    blocked_products: blockedRow?.count ?? 0,
    link_clicks: linkClicks,
    affiliate_link_clicks: affiliateLinkClicks,
    non_affiliate_link_clicks: nonAffiliateLinkClicksRow?.count ?? 0,
    products_clicked_without_active_link: productsClickedWithoutActiveLinkRow?.count ?? 0,
    deadlink_clicks: deadlinkClicksRow?.count ?? 0,
    user_affiliate_links_active: userAffiliateLinksActiveRow?.count ?? 0,
    link_report_users: linkReportUsersRow?.count ?? 0,
    ingredients_without_article: ingredientsWithoutArticleRow?.count ?? 0,
    open_link_reports: openLinkReportsRow?.count ?? 0,
    deadlinks: deadlinksRow?.count ?? 0,
    deadlinks_over_7_days: staleDeadlinksRow?.count ?? 0,
    previous: {
      registrations: previousRegistrations,
      activated_users: previousActivatedUsers,
      stacks_in_range: previousStacksInRange,
      link_clicks: previousLinkClicks,
      affiliate_link_clicks: previousAffiliateLinkClicks,
    },
    trends: {
      registrations: buildTrend(registrations, previousRegistrations),
      activated_users: buildTrend(activatedUsers, previousActivatedUsers),
      stacks_in_range: buildTrend(stacksInRange, previousStacksInRange),
      link_clicks: buildTrend(linkClicks, previousLinkClicks),
      affiliate_link_clicks: buildTrend(affiliateLinkClicks, previousAffiliateLinkClicks),
    },
    top_clicked_products: topProductsResult.results ?? [],
    top_shops: topShopsResult.results ?? [],
    referral_sources: referralSourcesResult,
  })
})

// GET /api/admin/legal-documents (admin only)
admin.get('/legal-documents', async (c) => {
  const authErr = await ensureAdmin(c)
  if (authErr) return authErr
  if (!(await hasTable(c.env.DB, 'legal_documents'))) {
    return c.json({ documents: [], total: 0 })
  }

  const { results } = await c.env.DB.prepare(`
    SELECT slug, title, body_md, status, published_at, updated_by_user_id, version, created_at, updated_at
    FROM legal_documents
    ORDER BY
      CASE slug
        WHEN 'impressum' THEN 1
        WHEN 'datenschutz' THEN 2
        WHEN 'nutzungsbedingungen' THEN 3
        WHEN 'cookie-consent' THEN 4
        WHEN 'affiliate-disclosure' THEN 5
        ELSE 99
      END,
      slug ASC
  `).all()

  return c.json({ documents: results ?? [], total: results?.length ?? 0 })
})

// PUT /api/admin/legal-documents/:slug (admin only)
admin.put('/legal-documents/:slug', async (c) => {
  const authErr = await ensureAdmin(c)
  if (authErr) return authErr
  if (!(await hasTable(c.env.DB, 'legal_documents'))) {
    return c.json({ error: 'Legal documents table is not available' }, 409)
  }

  const slug = normalizeSlug(c.req.param('slug'))
  if (!slug) return c.json({ error: 'Invalid slug' }, 400)

  let body: Record<string, unknown>
  try {
    body = await c.req.json()
  } catch {
    return c.json({ error: 'Invalid JSON' }, 400)
  }

  const title = optionalText(body.title)
  if (!title) return c.json({ error: 'title is required' }, 400)
  const bodyMd = typeof body.body_md === 'string' ? body.body_md : ''
  const status = typeof body.status === 'string' && ['draft', 'published'].includes(body.status)
    ? body.status
    : 'draft'
  const user = c.get('user')

  await c.env.DB.prepare(`
    INSERT INTO legal_documents (
      slug,
      title,
      body_md,
      status,
      published_at,
      updated_by_user_id,
      version,
      created_at,
      updated_at
    )
    VALUES (?, ?, ?, ?, CASE WHEN ? = 'published' THEN datetime('now') ELSE NULL END, ?, 0, datetime('now'), datetime('now'))
    ON CONFLICT(slug) DO UPDATE SET
      title = excluded.title,
      body_md = excluded.body_md,
      status = excluded.status,
      published_at = CASE WHEN excluded.status = 'published' THEN COALESCE(legal_documents.published_at, datetime('now')) ELSE legal_documents.published_at END,
      updated_by_user_id = excluded.updated_by_user_id,
      version = COALESCE(legal_documents.version, 0) + 1,
      updated_at = datetime('now')
  `).bind(slug, title, bodyMd, status, status, user?.userId ?? null).run()

  const document = await c.env.DB.prepare(`
    SELECT slug, title, body_md, status, published_at, updated_by_user_id, version, created_at, updated_at
    FROM legal_documents
    WHERE slug = ?
  `).bind(slug).first()

  await logAdminAction(c, {
    action: 'update_legal_document',
    entity_type: 'legal_document',
    entity_id: null,
    changes: { slug, title, status },
  })

  return c.json({ document })
})

// GET /api/admin/knowledge-articles?q=&status= (admin only)
admin.get('/knowledge-articles', async (c) => {
  const authErr = await ensureAdmin(c)
  if (authErr) return authErr

  const q = c.req.query('q')?.trim() ?? ''
  const statusParam = c.req.query('status')?.trim() ?? ''
  const where: string[] = []
  const bindings: Array<string | number> = []

  if (q) {
    const like = `%${q}%`
    where.push('(slug LIKE ? OR title LIKE ? OR summary LIKE ?)')
    bindings.push(like, like, like)
  }

  if (statusParam) {
    const status = enumValue(statusParam, KNOWLEDGE_ARTICLE_STATUSES)
    if (!status) return c.json({ error: `status must be one of ${KNOWLEDGE_ARTICLE_STATUSES.join(', ')}` }, 400)
    where.push('status = ?')
    bindings.push(status)
  }

  const columns = await getTableColumns(c.env.DB, 'knowledge_articles')
  const whereSql = where.length > 0 ? `WHERE ${where.join(' AND ')}` : ''
  const { results } = await c.env.DB.prepare(`
    SELECT
      slug,
      title,
      summary,
      status,
      reviewed_at,
      sources_json,
      ${columns.has('conclusion') ? 'conclusion' : 'NULL AS conclusion'},
      ${columns.has('featured_image_r2_key') ? 'featured_image_r2_key' : 'NULL AS featured_image_r2_key'},
      ${columns.has('featured_image_url') ? 'featured_image_url' : 'NULL AS featured_image_url'},
      ${columns.has('dose_min') ? 'dose_min' : 'NULL AS dose_min'},
      ${columns.has('dose_max') ? 'dose_max' : 'NULL AS dose_max'},
      ${columns.has('dose_unit') ? 'dose_unit' : 'NULL AS dose_unit'},
      ${columns.has('product_note') ? 'product_note' : 'NULL AS product_note'},
      updated_at,
      ${versionSelect(columns)}
    FROM knowledge_articles
    ${whereSql}
    ORDER BY updated_at DESC, slug ASC
  `).bind(...bindings).all<KnowledgeArticleListDbRow>()

  const articles = await hydrateKnowledgeArticles(c.env.DB, results)
  return c.json({
    articles,
    total: results.length,
  })
})

// POST /api/admin/knowledge-articles (admin only)
admin.post('/knowledge-articles', async (c) => {
  const authErr = await ensureAdmin(c)
  if (authErr) return authErr

  let body: Record<string, unknown>
  try {
    body = await c.req.json()
  } catch {
    return c.json({ error: 'Invalid JSON' }, 400)
  }

  const validation = validateKnowledgeArticlePayload(body, null)
  if (!validation.ok) return c.json({ error: validation.error }, validation.status ?? 400)

  const data = validation.value
  const ingredientValidation = await validateKnowledgeArticleIngredientIds(c.env.DB, data.ingredient_ids)
  if (!ingredientValidation.ok) return c.json({ error: ingredientValidation.error }, ingredientValidation.status ?? 400)
  const columns = await getTableColumns(c.env.DB, 'knowledge_articles')
  const extraFields: Array<[string, string | number | null]> = []
  if (columns.has('conclusion')) extraFields.push(['conclusion', data.conclusion])
  if (columns.has('featured_image_r2_key')) extraFields.push(['featured_image_r2_key', data.featured_image_r2_key])
  if (columns.has('featured_image_url')) extraFields.push(['featured_image_url', data.featured_image_url])
  if (columns.has('dose_min')) extraFields.push(['dose_min', data.dose_min])
  if (columns.has('dose_max')) extraFields.push(['dose_max', data.dose_max])
  if (columns.has('dose_unit')) extraFields.push(['dose_unit', data.dose_unit])
  if (columns.has('product_note')) extraFields.push(['product_note', data.product_note])
  try {
    await c.env.DB.prepare(`
      INSERT INTO knowledge_articles (
        slug,
        title,
        summary,
        body,
        status,
        reviewed_at,
        sources_json,
        ${extraFields.length > 0 ? `${extraFields.map(([key]) => key).join(',\n        ')},` : ''}
        created_at,
        updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ${extraFields.map(() => '?').join(', ')}${extraFields.length > 0 ? ', ' : ''}datetime('now'), datetime('now'))
    `).bind(
      data.slug,
      data.title,
      data.summary,
      data.body,
      data.status,
      data.reviewed_at,
      data.sources_json,
      ...extraFields.map(([, value]) => value),
    ).run()
  } catch (error) {
    if (isUniqueConstraintError(error)) return c.json({ error: `Knowledge article "${data.slug}" already exists` }, 409)
    throw error
  }
  await syncKnowledgeArticleRelations(c.env.DB, data.slug, data.sources, data.ingredient_ids)

  const article = await getKnowledgeArticleRow(c.env.DB, data.slug)
  const hydrated = article ? (await hydrateKnowledgeArticles(c.env.DB, [article]))[0] : null
  await logAdminAction(c, {
    action: 'create_knowledge_article',
    entity_type: 'knowledge_article',
    entity_id: null,
    changes: { slug: data.slug, article: hydrated },
  })

  return c.json({ article: hydrated }, 201)
})

// GET /api/admin/knowledge-articles/:slug (admin only)
admin.get('/knowledge-articles/:slug', async (c) => {
  const authErr = await ensureAdmin(c)
  if (authErr) return authErr

  const slug = normalizeSlug(c.req.param('slug'))
  if (!slug) return c.json({ error: 'Invalid article slug' }, 400)

  const article = await getKnowledgeArticleRow(c.env.DB, slug)
  if (!article) return c.json({ error: 'Knowledge article not found' }, 404)
  const hydrated = (await hydrateKnowledgeArticles(c.env.DB, [article]))[0]
  return c.json({ article: hydrated })
})

// PUT /api/admin/knowledge-articles/:slug (admin only; slug is immutable)
admin.put('/knowledge-articles/:slug', async (c) => {
  const authErr = await ensureAdmin(c)
  if (authErr) return authErr

  const slug = normalizeSlug(c.req.param('slug'))
  if (!slug) return c.json({ error: 'Invalid article slug' }, 400)

  const existing = await getKnowledgeArticleRow(c.env.DB, slug)
  if (!existing) return c.json({ error: 'Knowledge article not found' }, 404)

  let body: Record<string, unknown>
  try {
    body = await c.req.json()
  } catch {
    return c.json({ error: 'Invalid JSON' }, 400)
  }

  if (hasOwnKey(body, 'slug')) {
    const bodySlug = normalizeSlug(body.slug)
    if (!bodySlug || bodySlug !== slug) return c.json({ error: 'slug is immutable' }, 400)
  }

  const columns = await getTableColumns(c.env.DB, 'knowledge_articles')
  const lock = validateOptimisticLock(columns.has('version'), existing.version, requestVersion(c, body))
  if (!lock.ok) return c.json({ error: lock.error, current_version: existing.version }, 409)

  const validation = validateKnowledgeArticlePayload(body, existing)
  if (!validation.ok) return c.json({ error: validation.error }, validation.status ?? 400)
  const data = validation.value
  if (!hasOwnKey(body, 'ingredient_ids')) {
    const currentIngredients = (await loadKnowledgeArticleIngredients(c.env.DB, [slug])).get(slug) ?? []
    data.ingredient_ids = currentIngredients.map((ingredient) => ingredient.ingredient_id)
  }
  const ingredientValidation = await validateKnowledgeArticleIngredientIds(c.env.DB, data.ingredient_ids)
  if (!ingredientValidation.ok) return c.json({ error: ingredientValidation.error }, ingredientValidation.status ?? 400)
  const versionSet = lock.value.enforce ? ', version = COALESCE(version, 0) + 1' : ''
  const whereSql = lock.value.enforce ? optimisticWhere('slug') : 'slug = ?'
  const extraFields: Array<[string, string | number | null]> = []
  if (columns.has('conclusion')) extraFields.push(['conclusion', data.conclusion])
  if (columns.has('featured_image_r2_key')) extraFields.push(['featured_image_r2_key', data.featured_image_r2_key])
  if (columns.has('featured_image_url')) extraFields.push(['featured_image_url', data.featured_image_url])
  if (columns.has('dose_min')) extraFields.push(['dose_min', data.dose_min])
  if (columns.has('dose_max')) extraFields.push(['dose_max', data.dose_max])
  if (columns.has('dose_unit')) extraFields.push(['dose_unit', data.dose_unit])
  if (columns.has('product_note')) extraFields.push(['product_note', data.product_note])
  const updateBindings: Array<string | number | null> = [
    data.title,
    data.summary,
    data.body,
    data.status,
    data.reviewed_at,
    data.sources_json,
    ...extraFields.map(([, value]) => value),
    slug,
  ]
  if (lock.value.enforce && lock.value.expectedVersion !== null) updateBindings.push(lock.value.expectedVersion)

  const updateResult = await c.env.DB.prepare(`
    UPDATE knowledge_articles
    SET
      title = ?,
      summary = ?,
      body = ?,
      status = ?,
      reviewed_at = ?,
      sources_json = ?,
      ${extraFields.length > 0 ? `${extraFields.map(([key]) => `${key} = ?`).join(',\n      ')},` : ''}
      updated_at = datetime('now')${versionSet}
    WHERE ${whereSql}
  `).bind(...updateBindings).run()
  if (lock.value.enforce && d1ChangeCount(updateResult) === 0) {
      const current = await getKnowledgeArticleRow(c.env.DB, slug)
      return c.json({ error: 'Version conflict', current_version: current?.version ?? existing.version }, 409)
  }
  await syncKnowledgeArticleRelations(c.env.DB, slug, data.sources, data.ingredient_ids)

  const article = await getKnowledgeArticleRow(c.env.DB, slug)
  const hydrated = article ? (await hydrateKnowledgeArticles(c.env.DB, [article]))[0] : null
  await logAdminAction(c, {
    action: 'update_knowledge_article',
    entity_type: 'knowledge_article',
    entity_id: null,
    changes: { slug, before: existing, after: hydrated },
  })

  return c.json({ article: hydrated })
})

// DELETE /api/admin/knowledge-articles/:slug (admin only; archive instead of hard delete)
admin.delete('/knowledge-articles/:slug', async (c) => {
  const authErr = await ensureAdmin(c)
  if (authErr) return authErr

  const slug = normalizeSlug(c.req.param('slug'))
  if (!slug) return c.json({ error: 'Invalid article slug' }, 400)

  const existing = await getKnowledgeArticleRow(c.env.DB, slug)
  if (!existing) return c.json({ error: 'Knowledge article not found' }, 404)
  const columns = await getTableColumns(c.env.DB, 'knowledge_articles')
  const lock = validateOptimisticLock(columns.has('version'), existing.version, requestVersion(c))
  if (!lock.ok) return c.json({ error: lock.error, current_version: existing.version }, 409)
  const versionSet = lock.value.enforce ? ', version = COALESCE(version, 0) + 1' : ''
  const whereSql = lock.value.enforce ? optimisticWhere('slug') : 'slug = ?'
  const archiveBindings: Array<string | number> = [slug]
  if (lock.value.enforce && lock.value.expectedVersion !== null) archiveBindings.push(lock.value.expectedVersion)

  const archiveResult = await c.env.DB.prepare(`
    UPDATE knowledge_articles
    SET status = 'archived',
        updated_at = datetime('now')${versionSet}
    WHERE ${whereSql}
  `).bind(...archiveBindings).run()
  if (lock.value.enforce && d1ChangeCount(archiveResult) === 0) {
    const current = await getKnowledgeArticleRow(c.env.DB, slug)
    return c.json({ error: 'Version conflict', current_version: current?.version ?? existing.version }, 409)
  }

  const article = await getKnowledgeArticleRow(c.env.DB, slug)
  const hydrated = article ? (await hydrateKnowledgeArticles(c.env.DB, [article]))[0] : null
  await logAdminAction(c, {
    action: 'archive_knowledge_article',
    entity_type: 'knowledge_article',
    entity_id: null,
    changes: { slug, before: { status: existing.status }, after: { status: article?.status ?? 'archived' } },
  })

  return c.json({ ok: true, article: hydrated })
})

// POST /api/admin/knowledge-articles/:slug/image (admin only)
admin.post('/knowledge-articles/:slug/image', async (c) => {
  const authErr = await ensureAdmin(c)
  if (authErr) return authErr

  const slug = normalizeSlug(c.req.param('slug'))
  if (!slug) return c.json({ error: 'Invalid article slug' }, 400)
  if (!c.env.PRODUCT_IMAGES) return c.json({ error: 'Image storage is not configured' }, 501)

  const columns = await getTableColumns(c.env.DB, 'knowledge_articles')
  if (!columns.has('featured_image_url') || !columns.has('featured_image_r2_key')) {
    return c.json({ error: 'Knowledge article image columns are not available' }, 409)
  }

  const existing = await c.env.DB.prepare(`
    SELECT slug, featured_image_url, featured_image_r2_key, ${versionSelect(columns)}
    FROM knowledge_articles
    WHERE slug = ?
  `).bind(slug).first<{
    slug: string
    featured_image_url: string | null
    featured_image_r2_key: string | null
    version: number | null
  }>()
  if (!existing) return c.json({ error: 'Knowledge article not found' }, 404)

  const formData = await c.req.formData()
  const fileEntry = formData.get('image') ?? formData.get('file')
  if (!fileEntry || typeof fileEntry === 'string') return c.json({ error: 'image field required' }, 400)
  const file = fileEntry as File
  if (!isSupportedProductImageType(file.type)) return c.json({ error: 'Only JPEG, PNG or WebP images are allowed' }, 415)
  if (file.size > PRODUCT_IMAGE_MAX_UPLOAD_BYTES) return c.json({ error: 'Max 1 MB after image optimization' }, 413)

  const ext = getProductImageExtension(file.type) ?? 'jpg'
  const filename = `${crypto.randomUUID()}.${ext}`
  const r2Key = `knowledge/${slug}/${filename}`
  const buffer = await file.arrayBuffer()
  await c.env.PRODUCT_IMAGES.put(r2Key, buffer, {
    httpMetadata: { contentType: file.type },
  })
  const imageUrl = `/api/r2/knowledge/${slug}/${filename}`
  const versionSet = columns.has('version') ? ', version = COALESCE(version, 0) + 1' : ''

  try {
    await c.env.DB.prepare(`
      UPDATE knowledge_articles
      SET featured_image_url = ?,
          featured_image_r2_key = ?,
          updated_at = datetime('now')${versionSet}
      WHERE slug = ?
    `).bind(imageUrl, r2Key, slug).run()
  } catch (error) {
    await c.env.PRODUCT_IMAGES.delete(r2Key).catch(() => undefined)
    throw error
  }

  if (existing.featured_image_r2_key && existing.featured_image_r2_key !== r2Key) {
    await c.env.PRODUCT_IMAGES.delete(existing.featured_image_r2_key).catch(() => undefined)
  }

  const article = await getKnowledgeArticleRow(c.env.DB, slug)
  await logAdminAction(c, {
    action: 'upload_knowledge_article_image',
    entity_type: 'knowledge_article',
    entity_id: null,
    changes: {
      slug,
      before: {
        featured_image_url: existing.featured_image_url,
        featured_image_r2_key: existing.featured_image_r2_key,
      },
      after: {
        featured_image_url: imageUrl,
        featured_image_r2_key: r2Key,
      },
    },
  })

  return c.json({
    image_url: imageUrl,
    image_r2_key: r2Key,
    version: article?.version ?? null,
  })
})

// GET /api/admin/ops-dashboard (admin only)
admin.get('/ops-dashboard', async (c) => {
  const authErr = await ensureAdmin(c)
  if (authErr) return authErr

  const [
    ingredientsTotal,
    researchStatusCounts,
    researchDue,
    sourcesTotal,
    sourcesNoRecommendation,
    warningsActive,
    warningsWithoutArticle,
    knowledgeDrafts,
    productsTotal,
    linkReportsOpen,
    productQaIssues,
    productQaTopItems,
    linkReportTopItems,
    researchDueItems,
    researchLaterItems,
    warningsWithoutArticleItems,
    knowledgeDraftItems,
  ] = await c.env.DB.batch([
    c.env.DB.prepare('SELECT COUNT(*) AS count FROM ingredients'),
    c.env.DB.prepare(`
      SELECT COALESCE(rs.research_status, 'unreviewed') AS status, COUNT(*) AS count
      FROM ingredients i
      LEFT JOIN ingredient_research_status rs ON rs.ingredient_id = i.id
      GROUP BY COALESCE(rs.research_status, 'unreviewed')
    `),
    c.env.DB.prepare(`
      SELECT COUNT(*) AS count
      FROM ingredient_research_status
      WHERE review_due_at IS NOT NULL
        AND review_due_at <= date('now')
    `),
    c.env.DB.prepare('SELECT COUNT(*) AS count FROM ingredient_research_sources'),
    c.env.DB.prepare('SELECT COUNT(*) AS count FROM ingredient_research_sources WHERE no_recommendation = 1'),
    c.env.DB.prepare('SELECT COUNT(*) AS count FROM ingredient_safety_warnings WHERE active = 1'),
    c.env.DB.prepare(`
      SELECT COUNT(*) AS count
      FROM ingredient_safety_warnings w
      LEFT JOIN knowledge_articles a ON a.slug = w.article_slug
      WHERE w.active = 1
        AND (w.article_slug IS NULL OR a.slug IS NULL)
    `),
    c.env.DB.prepare("SELECT COUNT(*) AS count FROM knowledge_articles WHERE status = 'draft'"),
    c.env.DB.prepare('SELECT COUNT(*) AS count FROM products'),
    c.env.DB.prepare(`
      SELECT COUNT(*) AS count
      FROM product_link_reports
      WHERE status = 'open'
    `),
    c.env.DB.prepare(`
      WITH ingredient_counts AS (
        SELECT
          product_id,
          COUNT(*) AS ingredient_count,
          SUM(CASE WHEN is_main = 1 THEN 1 ELSE 0 END) AS main_ingredient_count
        FROM product_ingredients
        GROUP BY product_id
      )
      SELECT COUNT(*) AS count
      FROM products p
      LEFT JOIN ingredient_counts ic ON ic.product_id = p.id
      WHERE (COALESCE(p.image_url, '') = '' AND COALESCE(p.image_r2_key, '') = '')
         OR COALESCE(p.shop_link, '') = ''
         OR p.serving_size IS NULL
         OR p.serving_size <= 0
         OR COALESCE(p.serving_unit, '') = ''
         OR p.servings_per_container IS NULL
         OR p.servings_per_container <= 0
         OR p.container_count IS NULL
         OR p.container_count <= 0
         OR p.price <= 0
         OR p.price > 300
         OR COALESCE(ic.ingredient_count, 0) = 0
         OR (
           COALESCE(p.shop_link, '') <> ''
           AND COALESCE(p.affiliate_owner_type, '') = ''
         )
    `),
    c.env.DB.prepare(`
      WITH ingredient_counts AS (
        SELECT
          product_id,
          COUNT(*) AS ingredient_count,
          SUM(CASE WHEN is_main = 1 THEN 1 ELSE 0 END) AS main_ingredient_count
        FROM product_ingredients
        GROUP BY product_id
      ),
      qa AS (
        SELECT
          p.id,
          p.name,
          p.brand,
          p.form,
          p.price,
          p.shop_link,
          p.image_url,
          p.image_r2_key,
          COALESCE(p.is_affiliate, 0) AS is_affiliate,
          COALESCE(
            p.affiliate_owner_type,
            CASE WHEN COALESCE(p.is_affiliate, 0) = 1 THEN 'nick' ELSE 'none' END
          ) AS affiliate_owner_type,
          p.affiliate_owner_user_id,
          p.serving_size,
          p.serving_unit,
          p.servings_per_container,
          p.container_count,
          p.moderation_status,
          p.visibility,
          p.created_at,
          COALESCE(ic.ingredient_count, 0) AS ingredient_count,
          COALESCE(ic.main_ingredient_count, 0) AS main_ingredient_count,
          CASE WHEN COALESCE(p.image_url, '') = '' AND COALESCE(p.image_r2_key, '') = '' THEN 1 ELSE 0 END AS missing_image,
          CASE WHEN COALESCE(p.shop_link, '') = '' THEN 1 ELSE 0 END AS missing_shop_link,
          CASE
            WHEN p.serving_size IS NULL
              OR p.serving_size <= 0
              OR COALESCE(p.serving_unit, '') = ''
              OR p.servings_per_container IS NULL
              OR p.servings_per_container <= 0
              OR p.container_count IS NULL
              OR p.container_count <= 0
            THEN 1 ELSE 0
          END AS missing_serving_data,
          CASE WHEN p.price <= 0 OR p.price > 300 THEN 1 ELSE 0 END AS suspicious_price_zero_or_high,
          CASE WHEN COALESCE(ic.ingredient_count, 0) = 0 THEN 1 ELSE 0 END AS missing_ingredient_rows,
          CASE
            WHEN COALESCE(p.shop_link, '') <> ''
              AND COALESCE(p.affiliate_owner_type, '') = ''
            THEN 1 ELSE 0
          END AS no_affiliate_flag_on_shop_link
        FROM products p
        LEFT JOIN ingredient_counts ic ON ic.product_id = p.id
      )
      SELECT *
      FROM qa
      WHERE missing_image = 1
         OR missing_shop_link = 1
         OR missing_serving_data = 1
         OR suspicious_price_zero_or_high = 1
         OR missing_ingredient_rows = 1
         OR no_affiliate_flag_on_shop_link = 1
      ORDER BY
        missing_shop_link DESC,
        missing_serving_data DESC,
        suspicious_price_zero_or_high DESC,
        no_affiliate_flag_on_shop_link DESC,
        missing_ingredient_rows DESC,
        missing_image DESC,
        created_at DESC,
        id DESC
      LIMIT 5
    `),
    c.env.DB.prepare(`
      SELECT
        r.id,
        r.user_id,
        u.email AS user_email,
        r.stack_id,
        s.name AS stack_name,
        r.product_type,
        r.product_id,
        r.product_name,
        r.shop_link_snapshot,
        CASE
          WHEN r.product_type = 'catalog' THEN p.shop_link
          ELSE up.shop_link
        END AS current_shop_link,
        r.reason,
        r.status,
        r.created_at
      FROM product_link_reports r
      LEFT JOIN users u ON u.id = r.user_id
      LEFT JOIN stacks s ON s.id = r.stack_id
      LEFT JOIN products p ON r.product_type = 'catalog' AND p.id = r.product_id
      LEFT JOIN user_products up ON r.product_type = 'user_product' AND up.id = r.product_id
      WHERE r.status = 'open'
      ORDER BY r.created_at ASC, r.id ASC
      LIMIT 5
    `),
    c.env.DB.prepare(`
      SELECT
        i.id AS ingredient_id,
        i.name AS ingredient_name,
        COALESCE(rs.research_status, 'unreviewed') AS research_status,
        rs.review_due_at,
        rs.reviewed_at,
        rs.calculation_status
      FROM ingredient_research_status rs
      JOIN ingredients i ON i.id = rs.ingredient_id
      WHERE rs.review_due_at IS NOT NULL
        AND rs.review_due_at <= date('now')
      ORDER BY rs.review_due_at ASC, i.name ASC
      LIMIT 5
    `),
    c.env.DB.prepare(`
      SELECT
        i.id AS ingredient_id,
        i.name AS ingredient_name,
        COALESCE(rs.research_status, 'unreviewed') AS research_status,
        rs.review_due_at,
        rs.reviewed_at,
        rs.calculation_status
      FROM ingredients i
      LEFT JOIN ingredient_research_status rs ON rs.ingredient_id = i.id
      WHERE COALESCE(rs.research_status, 'unreviewed') IN ('stale', 'unreviewed')
      ORDER BY
        CASE COALESCE(rs.research_status, 'unreviewed') WHEN 'stale' THEN 0 ELSE 1 END,
        COALESCE(rs.review_due_at, '9999-12-31') ASC,
        i.name ASC
      LIMIT 5
    `),
    c.env.DB.prepare(`
      SELECT
        w.id,
        w.ingredient_id,
        i.name AS ingredient_name,
        w.form_id,
        f.name AS form_name,
        w.short_label,
        w.article_slug,
        w.severity
      FROM ingredient_safety_warnings w
      LEFT JOIN ingredients i ON i.id = w.ingredient_id
      LEFT JOIN ingredient_forms f ON f.id = w.form_id
      LEFT JOIN knowledge_articles a ON a.slug = w.article_slug
      WHERE w.active = 1
        AND (w.article_slug IS NULL OR a.slug IS NULL)
      ORDER BY
        CASE w.severity WHEN 'danger' THEN 0 WHEN 'caution' THEN 1 ELSE 2 END,
        w.id DESC
      LIMIT 5
    `),
    c.env.DB.prepare(`
      SELECT slug, title, status, reviewed_at, updated_at
      FROM knowledge_articles
      WHERE status = 'draft'
      ORDER BY updated_at DESC, slug ASC
      LIMIT 5
    `),
  ])

  const researchCounts = new Map<string, number>()
  for (const row of (researchStatusCounts.results ?? []) as Array<{ status: string; count: number }>) {
    researchCounts.set(row.status, row.count)
  }

  return c.json({
    ingredients_total: ((ingredientsTotal.results?.[0] as CountRow | undefined)?.count) ?? 0,
    ingredient_research_unreviewed: researchCounts.get('unreviewed') ?? 0,
    ingredient_research_researching: researchCounts.get('researching') ?? 0,
    ingredient_research_needs_review: researchCounts.get('needs_review') ?? 0,
    ingredient_research_reviewed: researchCounts.get('reviewed') ?? 0,
    ingredient_research_stale: researchCounts.get('stale') ?? 0,
    ingredient_research_blocked: researchCounts.get('blocked') ?? 0,
    research_review_due_count: ((researchDue.results?.[0] as CountRow | undefined)?.count) ?? 0,
    sources_total: ((sourcesTotal.results?.[0] as CountRow | undefined)?.count) ?? 0,
    sources_no_recommendation_count: ((sourcesNoRecommendation.results?.[0] as CountRow | undefined)?.count) ?? 0,
    warnings_active_count: ((warningsActive.results?.[0] as CountRow | undefined)?.count) ?? 0,
    warnings_without_article_count: ((warningsWithoutArticle.results?.[0] as CountRow | undefined)?.count) ?? 0,
    knowledge_draft_count: ((knowledgeDrafts.results?.[0] as CountRow | undefined)?.count) ?? 0,
    products_total: ((productsTotal.results?.[0] as CountRow | undefined)?.count) ?? 0,
    product_qa_issue_count: ((productQaIssues.results?.[0] as CountRow | undefined)?.count) ?? 0,
    link_reports_open_count: ((linkReportsOpen.results?.[0] as CountRow | undefined)?.count) ?? 0,
    queues: {
      product_qa: ((productQaTopItems.results ?? []) as ProductQaRow[]).map((row) => formatProductQaRow(row)),
      link_reports: linkReportTopItems.results ?? [],
      research_due: researchDueItems.results ?? [],
      research_later: researchLaterItems.results ?? [],
      warnings_without_article: warningsWithoutArticleItems.results ?? [],
      knowledge_drafts: knowledgeDraftItems.results ?? [],
    },
  })
})

// GET /api/admin/health (admin only)
admin.get('/health', async (c) => {
  const authErr = await ensureAdmin(c)
  if (authErr) return authErr

  const missingDefaultDosesRule: AdminHealthCountRule = {
    id: 'missing-default-doses',
    title: 'Fehlende Default-Dosen',
    label: 'Fehlende Default-Dosen',
    severity: 'critical',
    href: '/administrator/dosing',
    sql: `
      SELECT COUNT(*) AS count
      FROM ingredients i
      WHERE NOT EXISTS (
        SELECT 1
        FROM dose_recommendations dr
        WHERE dr.ingredient_id = i.id
          AND dr.is_active = 1
          AND dr.is_default = 1
      )
    `,
    okWhen: (count) => count === 0,
    details: (count) => count === 0
      ? 'Alle Wirkstoffe haben eine aktive Default-Dosis.'
      : `${count} Wirkstoff(e) haben keine aktive Default-Dosis.`,
    action: 'Default-Dosis in /administrator/dosing ergaenzen oder bewusst deaktivierte Wirkstoffe aus der Pruefung nehmen.',
  }

  const staleResearchRule: AdminHealthCountRule = {
    id: 'stale-overdue-ingredient-research',
    title: 'Ueberfaellige Wirkstoff-Recherche',
    label: 'Research ueberfaellig',
    severity: 'warning',
    href: '/administrator/ingredients',
    sql: `
      SELECT COUNT(*) AS count
      FROM ingredient_research_status
      WHERE research_status = 'stale'
         OR (
           review_due_at IS NOT NULL
           AND date(review_due_at) <= date('now')
         )
    `,
    okWhen: (count) => count === 0,
    details: (count) => count === 0
      ? 'Keine stale oder ueberfaellige Wirkstoff-Recherche gefunden.'
      : `${count} Wirkstoff-Recherche-Eintrag/Eintraege sind stale oder ueberfaellig.`,
    action: 'Research-Status, Quellen und Review-Datum im Wirkstoff-Cockpit aktualisieren.',
  }

  const missingEnglishTranslationsRule: AdminHealthCountRule = {
    id: 'missing-english-ingredient-translations',
    title: 'Fehlende englische Wirkstoff-Uebersetzungen',
    label: 'EN-Uebersetzungen fehlen',
    severity: 'warning',
    href: '/administrator/translations?entity=ingredients&language=en&status=missing',
    sql: `
      SELECT COUNT(*) AS count
      FROM ingredients i
      LEFT JOIN ingredient_translations t
        ON t.ingredient_id = i.id
       AND t.language = 'en'
      WHERE t.ingredient_id IS NULL
         OR trim(COALESCE(t.name, '')) = ''
    `,
    okWhen: (count) => count === 0,
    details: (count) => count === 0
      ? 'Alle Wirkstoffe haben eine englische Namens-Uebersetzung.'
      : `${count} Wirkstoff(e) haben keine englische Namens-Uebersetzung.`,
    action: 'Fehlende englische Wirkstoff-Uebersetzungen im Translations-Bereich pflegen.',
  }

  const oldPendingUserProductsRule: AdminHealthCountRule = {
    id: 'old-pending-user-products',
    title: 'Aeltere pending User-Produkte',
    label: 'Pending > 7 Tage',
    severity: 'warning',
    href: '/administrator/user-products?status=pending',
    sql: `
      SELECT COUNT(*) AS count
      FROM user_products
      WHERE status = 'pending'
        AND datetime(created_at) <= datetime('now', '-7 days')
    `,
    okWhen: (count) => count === 0,
    details: (count) => count === 0
      ? 'Keine pending User-Produkte aelter als 7 Tage.'
      : `${count} pending User-Produkt(e) sind aelter als 7 Tage.`,
    action: 'User-Produkte moderieren, ablehnen oder publizieren.',
  }

  const openProductQaRule: AdminHealthCountRule = {
    id: 'open-product-qa',
    title: 'Offene Produkt-QA',
    label: 'Produkt-QA offen',
    severity: 'warning',
    href: '/administrator/product-qa',
    sql: `
      WITH ingredient_counts AS (
        SELECT product_id, COUNT(*) AS ingredient_count
        FROM product_ingredients
        GROUP BY product_id
      )
      SELECT COUNT(*) AS count
      FROM products p
      LEFT JOIN ingredient_counts ic ON ic.product_id = p.id
      WHERE COALESCE(p.shop_link, '') = ''
         OR p.serving_size IS NULL
         OR p.serving_size <= 0
         OR COALESCE(p.serving_unit, '') = ''
         OR p.servings_per_container IS NULL
         OR p.servings_per_container <= 0
         OR p.container_count IS NULL
         OR p.container_count <= 0
         OR p.price <= 0
         OR p.price > 300
         OR COALESCE(ic.ingredient_count, 0) = 0
    `,
    okWhen: (count) => count === 0,
    details: (count) => count === 0
      ? 'Keine offenen Produkt-QA-Auffaelligkeiten gefunden.'
      : `${count} Produkt(e) haben offene QA-Auffaelligkeiten.`,
    action: 'Produkt-QA-Liste pruefen und Katalogdaten korrigieren.',
  }

  const openLinkReportsRule: AdminHealthCountRule = {
    id: 'open-link-reports',
    title: 'Offene Linkmeldungen',
    label: 'Linkmeldungen offen',
    severity: 'warning',
    href: '/administrator/link-reports?status=open',
    sql: `
      SELECT COUNT(*) AS count
      FROM product_link_reports
      WHERE status = 'open'
    `,
    okWhen: (count) => count === 0,
    details: (count) => count === 0
      ? 'Keine offenen Linkmeldungen.'
      : `${count} Linkmeldung(en) sind offen.`,
    action: 'Gemeldete Links pruefen und den Report schliessen.',
  }

  const productsMissingShopLinkRule: AdminHealthCountRule = {
    id: 'products-missing-shop-link',
    title: 'Produkte ohne Shop-Link',
    label: 'Produkte ohne Shop-Link',
    severity: 'critical',
    href: '/administrator/products',
    sql: `
      SELECT COUNT(*) AS count
      FROM products
      WHERE COALESCE(shop_link, '') = ''
    `,
    okWhen: (count) => count === 0,
    details: (count) => count === 0
      ? 'Alle Produkte haben einen Shop-Link.'
      : `${count} Produkt(e) haben keinen Shop-Link.`,
    action: 'Shop-Link im Produktdetail oder in der Produkt-QA ergaenzen.',
  }

  const [
    missingDefaultDosesCheck,
    staleResearchCheck,
    missingEnglishTranslationsCheck,
    oldPendingUserProductsCheck,
    openProductQaCheck,
    openLinkReportsCheck,
    productsMissingShopLinkCheck,
    affiliateLinkHealthRollup,
  ] = await Promise.all([
    runAdminHealthCountCheck(c.env.DB, missingDefaultDosesRule),
    runAdminHealthCountCheck(c.env.DB, staleResearchRule),
    runAdminHealthCountCheck(c.env.DB, missingEnglishTranslationsRule),
    runAdminHealthCountCheck(c.env.DB, oldPendingUserProductsRule),
    runAdminHealthCountCheck(c.env.DB, openProductQaRule),
    runAdminHealthCountCheck(c.env.DB, openLinkReportsRule),
    runAdminHealthCountCheck(c.env.DB, productsMissingShopLinkRule),
    getAdminAffiliateLinkHealthRollup(c.env.DB),
  ])

  const sections: AdminHealthSection[] = [
    {
      id: 'science-content',
      title: 'Science und Content',
      checks: [
        missingDefaultDosesCheck,
        staleResearchCheck,
        missingEnglishTranslationsCheck,
      ],
    },
    {
      id: 'operations',
      title: 'Operations',
      checks: [
        oldPendingUserProductsCheck,
        openProductQaCheck,
        openLinkReportsCheck,
      ],
    },
    {
      id: 'catalog',
      title: 'Katalog',
      checks: [productsMissingShopLinkCheck],
    },
    affiliateLinkHealthRollup.section,
  ]

  const metrics: AdminHealthMetric[] = [
    metricFromAdminHealthCheck(missingDefaultDosesCheck, missingDefaultDosesRule.label),
    metricFromAdminHealthCheck(staleResearchCheck, staleResearchRule.label),
    metricFromAdminHealthCheck(missingEnglishTranslationsCheck, missingEnglishTranslationsRule.label),
    metricFromAdminHealthCheck(oldPendingUserProductsCheck, oldPendingUserProductsRule.label),
    metricFromAdminHealthCheck(openProductQaCheck, openProductQaRule.label),
    metricFromAdminHealthCheck(openLinkReportsCheck, openLinkReportsRule.label),
    metricFromAdminHealthCheck(productsMissingShopLinkCheck, productsMissingShopLinkRule.label),
    ...affiliateLinkHealthRollup.metrics,
  ]

  return c.json({
    generated_at: new Date().toISOString(),
    summary: summarizeAdminHealthSections(sections),
    metrics,
    sections,
  })
})

// GET /api/admin/launch-checks (admin only)
admin.get('/launch-checks', async (c) => {
  const authErr = await ensureAdmin(c)
  if (authErr) return authErr

  const dbRules: LaunchCheckCountRule[] = [
    {
      id: 'db-basic-query',
      title: 'D1 Basic Query',
      sql: 'SELECT 1 AS count',
      details: () => 'D1 beantwortet eine minimale Query.',
      okWhen: (count) => count === 1,
      severity: 'critical',
      action: 'D1-Binding und Cloudflare Pages Functions pruefen.',
    },
    {
      id: 'db-users',
      title: 'User-Tabelle',
      sql: 'SELECT COUNT(*) AS count FROM users',
      details: (count) => `${count} User-Konto/Konten vorhanden.`,
      okWhen: (count) => count >= 1,
      severity: 'critical',
      action: 'Produktionsdatenbank und User-Migrationen pruefen.',
    },
    {
      id: 'db-admin-users',
      title: 'Admin-Konten',
      sql: "SELECT COUNT(*) AS count FROM users WHERE COALESCE(role, 'user') = 'admin'",
      details: (count) => `${count} Admin-Konto/Konten vorhanden.`,
      okWhen: (count) => count >= 1,
      severity: 'critical',
      action: 'Mindestens ein Admin-Konto benoetigt.',
    },
    {
      id: 'db-products',
      title: 'Produktkatalog',
      sql: 'SELECT COUNT(*) AS count FROM products',
      details: (count) => `${count} Produkt(e) im Katalog.`,
      okWhen: (count) => count >= 1,
      severity: 'critical',
      action: 'Seed-/Produktdaten pruefen.',
    },
    {
      id: 'db-product-ingredients',
      title: 'Produkt-Wirkstoffzeilen',
      sql: 'SELECT COUNT(*) AS count FROM product_ingredients',
      details: (count) => `${count} Produkt-Wirkstoffzeile(n) vorhanden.`,
      okWhen: (count) => count >= 1,
      severity: 'critical',
      action: 'Produkt-Wirkstoffmodell und Migrationen pruefen.',
    },
    {
      id: 'db-ingredients',
      title: 'Wirkstoffdatenbank',
      sql: 'SELECT COUNT(*) AS count FROM ingredients',
      details: (count) => `${count} Wirkstoff(e) vorhanden.`,
      okWhen: (count) => count >= 1,
      severity: 'critical',
      action: 'Ingredient-Seeds/Migrationen pruefen.',
    },
    {
      id: 'db-active-dose-recommendations',
      title: 'Aktive Dosis-Richtwerte',
      sql: 'SELECT COUNT(*) AS count FROM dose_recommendations WHERE is_active = 1',
      details: (count) => `${count} aktive Dosis-Richtwert(e).`,
      okWhen: (count) => count >= 1,
      severity: 'warning',
      action: 'Dosing-Bereich pruefen und fehlende Richtwerte ergaenzen.',
    },
    {
      id: 'db-dose-source-links',
      title: 'Richtwert-Quellenlinks',
      sql: 'SELECT COUNT(*) AS count FROM dose_recommendation_sources',
      details: (count) => `${count} verknuepfte Richtwert-Quelle(n).`,
      okWhen: (count) => count >= 1,
      severity: 'warning',
      action: 'Dosis-Richtwerte in /administrator/dosing mit Research-Quellen verknuepfen.',
    },
    {
      id: 'db-open-link-reports',
      title: 'Offene Linkmeldungen',
      sql: "SELECT COUNT(*) AS count FROM product_link_reports WHERE status = 'open'",
      details: (count) => `${count} offene Linkmeldung(en).`,
      okWhen: (count) => count === 0,
      severity: 'warning',
      action: 'Linkmeldungen vor Launch abarbeiten.',
    },
    {
      id: 'db-pending-user-products',
      title: 'Pending User-Produkte',
      sql: "SELECT COUNT(*) AS count FROM user_products WHERE status = 'pending'",
      details: (count) => `${count} offene User-Produkt-Einreichung(en).`,
      okWhen: (count) => count === 0,
      severity: 'warning',
      action: 'User-Produkte moderieren oder bewusst fuer nach Launch einplanen.',
    },
    {
      id: 'db-knowledge-drafts',
      title: 'Knowledge Drafts',
      sql: "SELECT COUNT(*) AS count FROM knowledge_articles WHERE status = 'draft'",
      details: (count) => `${count} Wissensartikel-Draft(s).`,
      okWhen: (count) => count === 0,
      severity: 'info',
      action: 'Drafts vor SEO/Indexing pruefen.',
    },
    {
      id: 'db-warnings-without-article',
      title: 'Warnungen ohne Artikel',
      sql: `
        SELECT COUNT(*) AS count
        FROM ingredient_safety_warnings w
        LEFT JOIN knowledge_articles a ON a.slug = w.article_slug
        WHERE w.active = 1
          AND (w.article_slug IS NULL OR a.slug IS NULL)
      `,
      details: (count) => `${count} aktive Warnung(en) ohne verlinkten Wissensartikel.`,
      okWhen: (count) => count === 0,
      severity: 'warning',
      action: 'Warnungen mit Knowledge-Artikeln verknuepfen oder bewusst freigeben.',
    },
    {
      id: 'db-product-qa-issues',
      title: 'Produkt-QA Issues',
      sql: `
        WITH ingredient_counts AS (
          SELECT
            product_id,
            COUNT(*) AS ingredient_count,
            SUM(CASE WHEN is_main = 1 THEN 1 ELSE 0 END) AS main_ingredient_count
          FROM product_ingredients
          GROUP BY product_id
        )
        SELECT COUNT(*) AS count
        FROM products p
        LEFT JOIN ingredient_counts ic ON ic.product_id = p.id
        WHERE (COALESCE(p.image_url, '') = '' AND COALESCE(p.image_r2_key, '') = '')
           OR COALESCE(p.shop_link, '') = ''
           OR p.serving_size IS NULL
           OR p.serving_size <= 0
           OR COALESCE(p.serving_unit, '') = ''
           OR p.servings_per_container IS NULL
           OR p.servings_per_container <= 0
           OR p.container_count IS NULL
           OR p.container_count <= 0
           OR p.price <= 0
           OR p.price > 300
           OR COALESCE(ic.ingredient_count, 0) = 0
           OR (
             COALESCE(p.shop_link, '') <> ''
             AND COALESCE(p.affiliate_owner_type, '') = ''
           )
      `,
      details: (count) => `${count} Produkt(e) mit QA-Auffaelligkeiten.`,
      okWhen: (count) => count === 0,
      severity: 'warning',
      action: 'Produkt-QA vor Launch abarbeiten.',
    },
  ]

  const dbChecks = await Promise.all(dbRules.map((rule) => runLaunchCountCheck(c.env.DB, rule)))
  const envChecks = buildLaunchEnvChecks(c.env)
  const domainChecks = await buildDomainChecks()

  const manualChecks: LaunchCheck[] = [
    {
      id: 'manual-legal-review',
      title: 'Legal/Compliance Review',
      status: 'info',
      severity: 'warning',
      source: 'manual',
      details: 'Finale juristische Pruefung ist nicht automatisierbar und bleibt vor SEO/Indexing manuell.',
      action: 'Impressum, Datenschutz, AGB, Health Claims und Affiliate-Hinweis extern/fachlich pruefen.',
    },
    {
      id: 'manual-mail-deliverability',
      title: 'Mail-Zustellung extern',
      status: 'info',
      severity: 'warning',
      source: 'manual',
      details: 'Echte Registrierung, Verifizierung, Passwort-Reset und Stack-Mail muessen in externen Inboxen geprueft werden.',
      action: 'Header auf SPF/DKIM/DMARC alignment und Spam-Placement pruefen.',
    },
    {
      id: 'manual-d1-backup',
      title: 'D1 Backup vor Freigabe',
      status: 'info',
      severity: 'warning',
      source: 'manual',
      details: 'Backup-Freshness laesst sich ohne Deployment-/Backup-API nicht sicher aus der App verifizieren.',
      action: 'Frischen Export im Deploy-Log dokumentieren.',
    },
  ]

  const sections: LaunchCheckSection[] = [
    { id: 'database', title: 'Datenbank und Operations', checks: dbChecks },
    { id: 'environment', title: 'Konfiguration', checks: envChecks },
    { id: 'domain', title: 'Domain und DNS', checks: domainChecks },
    { id: 'manual', title: 'Manuelle Freigaben', checks: manualChecks },
  ]

  return c.json({
    generated_at: new Date().toISOString(),
    domain: 'supplementstack.de',
    source: 'live',
    admin_only: true,
    summary: summarizeLaunchSections(sections),
    sections,
  })
})

// GET /api/admin/product-qa?q=&issue=&page=1&limit=50 (admin only)
admin.get('/product-qa', async (c) => {
  const authErr = await ensureAdmin(c)
  if (authErr) return authErr

  const q = c.req.query('q')?.trim() ?? ''
  const issueParam = c.req.query('issue')?.trim() ?? ''
  const issue = issueParam ? enumValue(issueParam, PRODUCT_QA_ISSUES) : null
  if (issueParam && !issue) return c.json({ error: `issue must be one of ${PRODUCT_QA_ISSUES.join(', ')}` }, 400)

  const page = Math.max(1, parsePagination(c.req.query('page'), 1, 100000))
  const limit = Math.max(1, parsePagination(c.req.query('limit'), 50, 250))
  const offset = (page - 1) * limit
  const where: string[] = []
  const bindings: Array<string | number> = []
  const summaryWhere: string[] = []
  const summaryBindings: Array<string | number> = []

  if (q) {
    const like = `%${q}%`
    const searchSql = '(name LIKE ? OR COALESCE(brand, \'\') LIKE ? OR COALESCE(form, \'\') LIKE ?)'
    where.push(searchSql)
    summaryWhere.push(searchSql)
    bindings.push(like, like, like)
    summaryBindings.push(like, like, like)
  }

  if (issue) {
    where.push(`${issue} = 1`)
  }

  const whereSql = where.length > 0 ? `WHERE ${where.join(' AND ')}` : ''
  const summaryWhereSql = summaryWhere.length > 0 ? `WHERE ${summaryWhere.join(' AND ')}` : ''
  const includeLinkHealth = await hasAffiliateLinkHealthTable(c.env.DB)
  const productColumns = await getTableColumns(c.env.DB, 'products')
  const productVersionSelect = productColumns.has('version') ? 'p.version AS version,' : 'NULL AS version,'
  const linkHealthSelect = includeLinkHealth ? `,${AFFILIATE_LINK_HEALTH_SELECT}` : ''
  const linkHealthJoin = includeLinkHealth ? 'LEFT JOIN affiliate_link_health lh ON lh.product_id = p.id' : ''
  const productQaCte = `
    WITH ingredient_counts AS (
      SELECT
        product_id,
        COUNT(*) AS ingredient_count,
        SUM(CASE WHEN is_main = 1 THEN 1 ELSE 0 END) AS main_ingredient_count
      FROM product_ingredients
      GROUP BY product_id
    ),
    qa AS (
      SELECT
        p.id,
        p.name,
        p.brand,
        p.form,
        p.price,
        p.shop_link,
        p.image_url,
        p.image_r2_key,
        COALESCE(p.is_affiliate, 0) AS is_affiliate,
        COALESCE(
          p.affiliate_owner_type,
          CASE WHEN COALESCE(p.is_affiliate, 0) = 1 THEN 'nick' ELSE 'none' END
        ) AS affiliate_owner_type,
        p.affiliate_owner_user_id,
        p.serving_size,
        p.serving_unit,
        p.servings_per_container,
        p.container_count,
        p.moderation_status,
        p.visibility,
        p.created_at,
        ${productVersionSelect}
        COALESCE(ic.ingredient_count, 0) AS ingredient_count,
        COALESCE(ic.main_ingredient_count, 0) AS main_ingredient_count,
        CASE WHEN COALESCE(p.image_url, '') = '' AND COALESCE(p.image_r2_key, '') = '' THEN 1 ELSE 0 END AS missing_image,
        CASE WHEN COALESCE(p.shop_link, '') = '' THEN 1 ELSE 0 END AS missing_shop_link,
        CASE
          WHEN p.serving_size IS NULL
            OR p.serving_size <= 0
            OR COALESCE(p.serving_unit, '') = ''
            OR p.servings_per_container IS NULL
            OR p.servings_per_container <= 0
            OR p.container_count IS NULL
            OR p.container_count <= 0
          THEN 1 ELSE 0
        END AS missing_serving_data,
        CASE WHEN p.price <= 0 OR p.price > 300 THEN 1 ELSE 0 END AS suspicious_price_zero_or_high,
        CASE WHEN COALESCE(ic.ingredient_count, 0) = 0 THEN 1 ELSE 0 END AS missing_ingredient_rows,
        CASE
          WHEN COALESCE(p.shop_link, '') <> ''
            AND COALESCE(p.affiliate_owner_type, '') = ''
          THEN 1 ELSE 0
        END AS no_affiliate_flag_on_shop_link
        ${linkHealthSelect}
      FROM products p
      LEFT JOIN ingredient_counts ic ON ic.product_id = p.id
      ${linkHealthJoin}
    )
  `

  const [totalRow, summaryRow, listResult] = await Promise.all([
    c.env.DB.prepare(`
      ${productQaCte}
      SELECT COUNT(*) AS count
      FROM qa
      ${whereSql}
    `).bind(...bindings).first<CountRow>(),
    c.env.DB.prepare(`
      ${productQaCte}
      SELECT
        COUNT(*) AS total,
        COALESCE(SUM(missing_image), 0) AS missing_image,
        COALESCE(SUM(missing_shop_link), 0) AS missing_shop_link,
        COALESCE(SUM(missing_serving_data), 0) AS missing_serving_data,
        COALESCE(SUM(suspicious_price_zero_or_high), 0) AS suspicious_price_zero_or_high,
        COALESCE(SUM(missing_ingredient_rows), 0) AS missing_ingredient_rows,
        COALESCE(SUM(no_affiliate_flag_on_shop_link), 0) AS no_affiliate_flag_on_shop_link
      FROM qa
      ${summaryWhereSql}
    `).bind(...summaryBindings).first<ProductQaIssueSummaryRow>(),
    c.env.DB.prepare(`
      ${productQaCte}
    SELECT *
    FROM qa
    ${whereSql}
    ORDER BY
      missing_image DESC,
      missing_shop_link DESC,
      missing_serving_data DESC,
      suspicious_price_zero_or_high DESC,
      missing_ingredient_rows DESC,
      no_affiliate_flag_on_shop_link DESC,
      created_at DESC,
      id DESC
      LIMIT ? OFFSET ?
    `).bind(...bindings, limit, offset).all<ProductQaRow>(),
  ])

  const issueSummary = PRODUCT_QA_ISSUES.reduce((acc, issueKey) => {
    acc[issueKey] = Number(summaryRow?.[issueKey] ?? 0)
    return acc
  }, {} as Record<ProductQaIssue, number>)

  return c.json({
    products: (listResult.results ?? []).map((row) => ({
      ...row,
      issues: productQaIssues(row),
    })),
    total: totalRow?.count ?? 0,
    page,
    limit,
    summary: {
      total: Number(summaryRow?.total ?? 0),
      issues: issueSummary,
    },
    issue_summary: issueSummary,
    available_issues: PRODUCT_QA_ISSUES,
  })
})

// PATCH /api/admin/product-qa/:id (admin only)
admin.patch('/product-qa/:id', async (c) => {
  const authErr = await ensureAdmin(c)
  if (authErr) return authErr

  const id = parsePositiveId(c.req.param('id'))
  if (id === null) return c.json({ error: 'Invalid product id' }, 400)

  const includeLinkHealth = await hasAffiliateLinkHealthTable(c.env.DB)
  const productColumns = await getTableColumns(c.env.DB, 'products')
  const existing = await getProductQaRow(c.env.DB, id, includeLinkHealth)
  if (!existing) return c.json({ error: 'Product not found' }, 404)

  let body: Record<string, unknown>
  try {
    body = await c.req.json()
  } catch {
    return c.json({ error: 'Invalid JSON' }, 400)
  }

  const validation = validateProductQaPatch(body)
  if (!validation.ok) return c.json({ error: validation.error }, validation.status)
  const data = validation.value
  if (data.serving_unit !== undefined && await hasTable(c.env.DB, 'managed_list_items')) {
    const managedUnit = await c.env.DB.prepare(`
      SELECT id
      FROM managed_list_items
      WHERE list_key = 'serving_unit'
        AND value = ?
        AND active = 1
    `).bind(data.serving_unit).first<{ id: number }>()
    if (!managedUnit) return c.json({ error: 'serving_unit must be an active managed serving unit' }, 400)
  }
  const lock = validateOptimisticLock(productColumns.has('version'), existing.version, requestVersion(c))
  if (!lock.ok) return c.json({ error: lock.error, current_version: existing.version }, 409)

  const ownership = normalizeAffiliateOwnership(body, {
    affiliate_owner_type: existing.affiliate_owner_type ?? (existing.is_affiliate === 1 ? 'nick' : 'none'),
    affiliate_owner_user_id: existing.affiliate_owner_user_id,
    is_affiliate: existing.is_affiliate === 1 ? 1 : 0,
  })
  if (!ownership.ok) return c.json({ error: ownership.error }, ownership.status)
  const affiliateOwner = await validateAffiliateOwnerUser(c.env.DB, ownership.value)
  if (!affiliateOwner.ok) return c.json({ error: affiliateOwner.error }, affiliateOwner.status)
  if (
    hasOwnKey(body, 'affiliate_owner_type') ||
    hasOwnKey(body, 'affiliate_owner_user_id') ||
    hasOwnKey(body, 'is_affiliate')
  ) {
    data.affiliate_owner_type = affiliateOwner.value.affiliate_owner_type
    data.affiliate_owner_user_id = affiliateOwner.value.affiliate_owner_user_id
    data.is_affiliate = affiliateOwner.value.is_affiliate
  }

  const fields = [
    'name',
    'brand',
    'price',
    'shop_link',
    'image_url',
    'is_affiliate',
    'affiliate_owner_type',
    'affiliate_owner_user_id',
    'moderation_status',
    'visibility',
    'serving_size',
    'serving_unit',
    'servings_per_container',
    'container_count',
  ] as const
  const setClauses: string[] = []
  const bindings: Array<string | number | null> = []
  const before: Record<string, unknown> = {}
  const after: Record<string, unknown> = {}

  for (const field of fields) {
    if (!hasOwnKey(data, field)) continue
    setClauses.push(`${field} = ?`)
    bindings.push(data[field] ?? null)
    before[field] = existing[field]
    after[field] = data[field] ?? null
  }

  if (setClauses.length === 0) return c.json({ error: 'At least one product QA field is required' }, 400)
  if (lock.value.enforce) setClauses.push('version = COALESCE(version, 0) + 1')
  const whereSql = lock.value.enforce ? 'id = ? AND version = ?' : 'id = ?'

  const updateResult = await c.env.DB.prepare(`
    UPDATE products
    SET ${setClauses.join(', ')}
    WHERE ${whereSql}
  `).bind(...bindings, id, ...(lock.value.enforce ? [lock.value.expectedVersion] : [])).run()
  if (lock.value.enforce && d1ChangeCount(updateResult) === 0) {
    const current = await getProductQaRow(c.env.DB, id, includeLinkHealth)
    return c.json({ error: 'Version conflict', current_version: current?.version ?? existing.version }, 409)
  }

  if (hasOwnKey(data, 'shop_link') && includeLinkHealth) {
    await c.env.DB.prepare(`
      DELETE FROM affiliate_link_health
      WHERE product_id = ?
        AND COALESCE(url, '') <> COALESCE(?, '')
    `).bind(id, data.shop_link ?? null).run()
  }

  if (
    hasOwnKey(data, 'shop_link') ||
    hasOwnKey(data, 'is_affiliate') ||
    hasOwnKey(data, 'affiliate_owner_type') ||
    hasOwnKey(data, 'affiliate_owner_user_id')
  ) {
    await syncPrimaryProductShopLinkFromProduct(c.env.DB, id)
  }

  const updated = await getProductQaRow(c.env.DB, id, includeLinkHealth)
  if (!updated) return c.json({ error: 'Product not found after update' }, 404)

  await logAdminAction(c, {
    action: 'update_product_qa_fields',
    entity_type: 'product',
    entity_id: id,
    changes: { before, after },
  })

  return c.json({ product: formatProductQaRow(updated) })
})

// GET /api/admin/link-reports?status=&q=&page=1&limit=50 (admin only)
admin.get('/link-reports', async (c) => {
  const authErr = await ensureAdmin(c)
  if (authErr) return authErr

  const q = c.req.query('q')?.trim() ?? ''
  const statusParam = c.req.query('status')?.trim() ?? ''
  const status = statusParam ? enumValue(statusParam, PRODUCT_LINK_REPORT_STATUSES) : null
  if (statusParam && !status) {
    return c.json({ error: `status must be one of ${PRODUCT_LINK_REPORT_STATUSES.join(', ')}` }, 400)
  }
  const page = Math.max(1, parsePagination(c.req.query('page'), 1, 100000))
  const limit = Math.max(1, parsePagination(c.req.query('limit'), 50, 250))
  const offset = (page - 1) * limit
  const where: string[] = []
  const bindings: Array<string | number> = []
  const summaryWhere: string[] = []
  const summaryBindings: Array<string | number> = []

  if (status) {
    where.push('r.status = ?')
    bindings.push(status)
  }

  if (q) {
    const like = `%${q}%`
    const searchSql = `(
      COALESCE(r.product_name, '') LIKE ?
      OR COALESCE(u.email, '') LIKE ?
      OR COALESCE(s.name, '') LIKE ?
      OR COALESCE(r.shop_link_snapshot, '') LIKE ?
      OR COALESCE(p.shop_link, '') LIKE ?
      OR COALESCE(up.shop_link, '') LIKE ?
    )`
    where.push(searchSql)
    summaryWhere.push(searchSql)
    bindings.push(like, like, like, like, like, like)
    summaryBindings.push(like, like, like, like, like, like)
  }

  const whereSql = where.length > 0 ? `WHERE ${where.join(' AND ')}` : ''
  const summaryWhereSql = summaryWhere.length > 0 ? `WHERE ${summaryWhere.join(' AND ')}` : ''
  const linkReportsFromSql = `
    FROM product_link_reports r
    LEFT JOIN users u ON u.id = r.user_id
    LEFT JOIN stacks s ON s.id = r.stack_id
    LEFT JOIN products p ON r.product_type = 'catalog' AND p.id = r.product_id
    LEFT JOIN user_products up ON r.product_type = 'user_product' AND up.id = r.product_id
  `

  const [totalRow, summaryRow, listResult] = await Promise.all([
    c.env.DB.prepare(`
      SELECT COUNT(*) AS count
      ${linkReportsFromSql}
      ${whereSql}
    `).bind(...bindings).first<CountRow>(),
    c.env.DB.prepare(`
      SELECT
        COUNT(*) AS total,
        COALESCE(SUM(CASE WHEN r.status = 'open' THEN 1 ELSE 0 END), 0) AS open,
        COALESCE(SUM(CASE WHEN r.status = 'reviewed' THEN 1 ELSE 0 END), 0) AS reviewed,
        COALESCE(SUM(CASE WHEN r.status = 'closed' THEN 1 ELSE 0 END), 0) AS closed
      ${linkReportsFromSql}
      ${summaryWhereSql}
    `).bind(...summaryBindings).first<ProductLinkReportStatusSummaryRow>(),
    c.env.DB.prepare(`
    SELECT
      r.id,
      r.user_id,
      u.email AS user_email,
      r.stack_id,
      s.name AS stack_name,
      r.product_type,
      r.product_id,
      r.product_name,
      r.shop_link_snapshot,
      CASE
        WHEN r.product_type = 'catalog' THEN p.shop_link
        ELSE up.shop_link
      END AS current_shop_link,
      r.reason,
      r.status,
      r.created_at
    ${linkReportsFromSql}
    ${whereSql}
    ORDER BY
      CASE r.status WHEN 'open' THEN 0 WHEN 'reviewed' THEN 1 ELSE 2 END,
      r.created_at ASC,
      r.id ASC
      LIMIT ? OFFSET ?
    `).bind(...bindings, limit, offset).all<ProductLinkReportRow>(),
  ])

  const statusSummary = {
    open: Number(summaryRow?.open ?? 0),
    reviewed: Number(summaryRow?.reviewed ?? 0),
    closed: Number(summaryRow?.closed ?? 0),
  }

  return c.json({
    reports: listResult.results ?? [],
    total: totalRow?.count ?? 0,
    page,
    limit,
    summary: {
      total: Number(summaryRow?.total ?? 0),
      statuses: statusSummary,
    },
    status_summary: statusSummary,
    available_statuses: PRODUCT_LINK_REPORT_STATUSES,
  })
})

// PATCH /api/admin/link-reports/:id (admin only)
admin.patch('/link-reports/:id', async (c) => {
  const authErr = await ensureAdmin(c)
  if (authErr) return authErr

  const id = parsePositiveId(c.req.param('id'))
  if (id === null) return c.json({ error: 'Invalid link report id' }, 400)

  let body: Record<string, unknown>
  try {
    body = await c.req.json()
  } catch {
    return c.json({ error: 'Invalid JSON' }, 400)
  }

  const status = enumValue(body.status, PRODUCT_LINK_REPORT_STATUSES)
  if (!status) return c.json({ error: `status must be one of ${PRODUCT_LINK_REPORT_STATUSES.join(', ')}` }, 400)

  const existing = await c.env.DB.prepare(`
    SELECT *
    FROM product_link_reports
    WHERE id = ?
  `).bind(id).first<ProductLinkReportRow>()
  if (!existing) return c.json({ error: 'Link report not found' }, 404)

  await c.env.DB.prepare(`
    UPDATE product_link_reports
    SET status = ?
    WHERE id = ?
  `).bind(status, id).run()

  const updated = await c.env.DB.prepare(`
    SELECT
      r.id,
      r.user_id,
      u.email AS user_email,
      r.stack_id,
      s.name AS stack_name,
      r.product_type,
      r.product_id,
      r.product_name,
      r.shop_link_snapshot,
      CASE
        WHEN r.product_type = 'catalog' THEN p.shop_link
        ELSE up.shop_link
      END AS current_shop_link,
      r.reason,
      r.status,
      r.created_at
    FROM product_link_reports r
    LEFT JOIN users u ON u.id = r.user_id
    LEFT JOIN stacks s ON s.id = r.stack_id
    LEFT JOIN products p ON r.product_type = 'catalog' AND p.id = r.product_id
    LEFT JOIN user_products up ON r.product_type = 'user_product' AND up.id = r.product_id
    WHERE r.id = ?
  `).bind(id).first<ProductLinkReportRow>()

  await logAdminAction(c, {
    action: 'update_product_link_report_status',
    entity_type: 'product_link_report',
    entity_id: id,
    changes: { before: { status: existing.status }, after: { status } },
  })

  return c.json({ report: updated })
})

// GET /api/admin/dose-recommendations?ingredient_id=&q=&active=&public=&source_type=&page=1&limit=50 (admin only)
admin.get('/dose-recommendations', async (c) => {
  const authErr = await ensureAdmin(c)
  if (authErr) return authErr

  const page = Math.max(1, parsePagination(c.req.query('page'), 1, 100000))
  const limit = parsePagination(c.req.query('limit'), 50, 100)
  const offset = (page - 1) * limit
  const q = c.req.query('q')?.trim() ?? ''
  const like = `%${q}%`

  const where: string[] = []
  const bindings: Array<string | number> = []

  const ingredientIdParam = c.req.query('ingredient_id')
  if (ingredientIdParam) {
    const ingredientId = parsePositiveId(ingredientIdParam)
    if (ingredientId === null) return c.json({ error: 'Invalid ingredient_id' }, 400)
    where.push('dr.ingredient_id = ?')
    bindings.push(ingredientId)
  }

  const sourceTypeParam = c.req.query('source_type')
  if (sourceTypeParam) {
    const sourceType = enumValue(sourceTypeParam, DOSE_RECOMMENDATION_SOURCE_TYPES)
    if (!sourceType) return c.json({ error: `source_type must be one of ${DOSE_RECOMMENDATION_SOURCE_TYPES.join(', ')}` }, 400)
    where.push('dr.source_type = ?')
    bindings.push(sourceType)
  }

  const activeParam = c.req.query('active')
  if (activeParam !== undefined) {
    const active = booleanFlag(activeParam === 'true' ? true : activeParam === 'false' ? false : Number(activeParam))
    if (active === undefined) return c.json({ error: 'active must be true/false or 1/0' }, 400)
    where.push('dr.is_active = ?')
    bindings.push(active)
  }

  const publicParam = c.req.query('public')
  if (publicParam !== undefined) {
    const publicFlag = booleanFlag(publicParam === 'true' ? true : publicParam === 'false' ? false : Number(publicParam))
    if (publicFlag === undefined) return c.json({ error: 'public must be true/false or 1/0' }, 400)
    where.push('dr.is_public = ?')
    bindings.push(publicFlag)
  }

  if (q) {
    where.push(`(
      i.name LIKE ?
      OR dr.source_label LIKE ?
      OR COALESCE(dr.source_url, '') LIKE ?
      OR COALESCE(dr.context_note, '') LIKE ?
      OR EXISTS (
        SELECT 1
        FROM dose_recommendation_sources drs_q
        JOIN ingredient_research_sources irs_q ON irs_q.id = drs_q.research_source_id
        WHERE drs_q.dose_recommendation_id = dr.id
          AND (
            COALESCE(irs_q.source_title, '') LIKE ?
            OR COALESCE(irs_q.source_url, '') LIKE ?
            OR COALESCE(irs_q.organization, '') LIKE ?
            OR COALESCE(irs_q.outcome, '') LIKE ?
          )
      )
    )`)
    bindings.push(like, like, like, like, like, like, like, like)
  }

  const columns = await getTableColumns(c.env.DB, 'dose_recommendations')
  const whereSql = where.length > 0 ? `WHERE ${where.join(' AND ')}` : ''
  const totalRow = await c.env.DB.prepare(`
    SELECT COUNT(*) AS count
    FROM dose_recommendations dr
    JOIN ingredients i ON i.id = dr.ingredient_id
    ${whereSql}
  `).bind(...bindings).first<CountRow>()

  const { results } = await c.env.DB.prepare(`
    SELECT
      dr.id,
      dr.ingredient_id,
      i.name AS ingredient_name,
      dr.population_id,
      p.slug AS population_slug,
      p.name_de AS population_name_de,
      dr.source_type,
      dr.source_label,
      dr.source_url,
      dr.dose_min,
      dr.dose_max,
      dr.unit,
      dr.per_kg_body_weight,
      dr.per_kg_cap,
      dr.timing,
      dr.context_note,
      dr.sex_filter,
      dr.is_athlete,
      dr.purpose,
      dr.is_default,
      dr.is_active,
      dr.relevance_score,
      dr.created_by_user_id,
      u.email AS created_by_email,
      dr.is_public,
      dr.verified_profile_id,
      vp.slug AS verified_profile_slug,
      COALESCE(vp.name, dr.verified_profile_name) AS verified_profile_name,
      dr.category_name,
      dr.published_at,
      dr.verified_at,
      dr.review_due_at,
      dr.superseded_by_id,
      dr.created_at,
      dr.updated_at,
      ${versionSelect(columns, 'dr')}
    FROM dose_recommendations dr
    JOIN ingredients i ON i.id = dr.ingredient_id
    JOIN populations p ON p.id = dr.population_id
    LEFT JOIN users u ON u.id = dr.created_by_user_id
    LEFT JOIN verified_profiles vp ON vp.id = dr.verified_profile_id
    ${whereSql}
    ORDER BY dr.is_active DESC, dr.relevance_score DESC, dr.updated_at DESC, dr.id DESC
    LIMIT ? OFFSET ?
  `).bind(...bindings, limit, offset).all<DoseRecommendationAdminRow>()
  const recommendations = await attachDoseRecommendationSources(c.env.DB, results)

  return c.json({ recommendations, page, limit, total: totalRow?.count ?? 0 })
})

// POST /api/admin/dose-recommendations (admin only)
admin.post('/dose-recommendations', async (c) => {
  const authErr = await ensureAdmin(c)
  if (authErr) return authErr

  let body: Record<string, unknown>
  try {
    body = await c.req.json()
  } catch {
    return c.json({ error: 'Invalid JSON' }, 400)
  }

  const validation = await validateDoseRecommendationPayload(c.env.DB, body, null)
  if (!validation.ok) {
    const failure = formatDoseRecommendationValidation(validation)
    return c.json({ error: failure.error }, failure.status)
  }

  const data = validation.value
  let result: D1Result
  try {
    result = await c.env.DB.prepare(`
      INSERT INTO dose_recommendations (
        ingredient_id,
        population_id,
        source_type,
        source_label,
        source_url,
        dose_min,
        dose_max,
        unit,
        per_kg_body_weight,
        per_kg_cap,
        timing,
        context_note,
        sex_filter,
        is_athlete,
        purpose,
        is_default,
        is_active,
        relevance_score,
        created_by_user_id,
        is_public,
        verified_profile_id,
        category_name,
        population_slug,
        verified_profile_name,
        published_at,
        verified_at,
        review_due_at,
        superseded_by_id,
        created_at,
        updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, strftime('%s','now'), strftime('%s','now'))
    `).bind(
      data.ingredient_id,
      data.population_id,
      data.source_type,
      data.source_label,
      data.source_url,
      data.dose_min,
      data.dose_max,
      data.unit,
      data.per_kg_body_weight,
      data.per_kg_cap,
      data.timing,
      data.context_note,
      data.sex_filter,
      data.is_athlete,
      data.purpose,
      data.is_default,
      data.is_active,
      data.relevance_score,
      data.created_by_user_id,
      data.is_public,
      data.verified_profile_id,
      data.category_name,
      data.population_slug,
      data.verified_profile_name,
      data.published_at,
      data.verified_at,
      data.review_due_at,
      data.superseded_by_id,
    ).run()
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      return c.json({ error: 'An active default recommendation already exists for this ingredient/population/targeting combination' }, 409)
    }
    throw error
  }

  const id = result.meta.last_row_id as number
  if (data.sources !== undefined) {
    await replaceDoseRecommendationSources(c.env.DB, id, data.sources)
  }
  const recommendation = await getDoseRecommendationAdminRow(c.env.DB, id)
  const plausibilityWarnings = await buildDosePlausibilityWarnings(c.env.DB, recommendation)

  await logAdminAction(c, {
    action: 'create_dose_recommendation',
    entity_type: 'dose_recommendation',
    entity_id: id,
    changes: data,
  })

  return c.json({ recommendation, plausibility_warnings: plausibilityWarnings }, 201)
})

// GET /api/admin/dose-recommendations/:id (admin only)
admin.get('/dose-recommendations/:id', async (c) => {
  const authErr = await ensureAdmin(c)
  if (authErr) return authErr

  const id = parsePositiveId(c.req.param('id'))
  if (id === null) return c.json({ error: 'Invalid dose recommendation id' }, 400)

  const recommendation = await getDoseRecommendationAdminRow(c.env.DB, id)
  if (!recommendation) return c.json({ error: 'Dose recommendation not found' }, 404)
  return c.json({ recommendation })
})

// PUT /api/admin/dose-recommendations/:id (admin only)
admin.put('/dose-recommendations/:id', async (c) => {
  const authErr = await ensureAdmin(c)
  if (authErr) return authErr

  const id = parsePositiveId(c.req.param('id'))
  if (id === null) return c.json({ error: 'Invalid dose recommendation id' }, 400)

  const existing = await getDoseRecommendationAdminRow(c.env.DB, id)
  if (!existing) return c.json({ error: 'Dose recommendation not found' }, 404)

  let body: Record<string, unknown>
  try {
    body = await c.req.json()
  } catch {
    return c.json({ error: 'Invalid JSON' }, 400)
  }

  const validation = await validateDoseRecommendationPayload(c.env.DB, body, existing)
  if (!validation.ok) {
    const failure = formatDoseRecommendationValidation(validation)
    return c.json({ error: failure.error }, failure.status)
  }

  const columns = await getTableColumns(c.env.DB, 'dose_recommendations')
  const lock = validateOptimisticLock(columns.has('version'), existing.version, requestVersion(c, body))
  if (!lock.ok) return c.json({ error: lock.error, current_version: existing.version }, 409)

  const data = validation.value
  const versionSet = lock.value.enforce ? ', version = COALESCE(version, 0) + 1' : ''
  const whereSql = lock.value.enforce ? optimisticWhere() : 'id = ?'
  const updateBindings: Array<string | number | null> = [
    data.ingredient_id,
    data.population_id,
    data.source_type,
    data.source_label,
    data.source_url,
    data.dose_min,
    data.dose_max,
    data.unit,
    data.per_kg_body_weight,
    data.per_kg_cap,
    data.timing,
    data.context_note,
    data.sex_filter,
    data.is_athlete,
    data.purpose,
    data.is_default,
    data.is_active,
    data.relevance_score,
    data.created_by_user_id,
    data.is_public,
    data.verified_profile_id,
    data.category_name,
    data.population_slug,
    data.verified_profile_name,
    data.published_at,
    data.verified_at,
    data.review_due_at,
    data.superseded_by_id,
    id,
  ]
  if (lock.value.enforce && lock.value.expectedVersion !== null) updateBindings.push(lock.value.expectedVersion)
  try {
    const updateResult = await c.env.DB.prepare(`
      UPDATE dose_recommendations
      SET
        ingredient_id = ?,
        population_id = ?,
        source_type = ?,
        source_label = ?,
        source_url = ?,
        dose_min = ?,
        dose_max = ?,
        unit = ?,
        per_kg_body_weight = ?,
        per_kg_cap = ?,
        timing = ?,
        context_note = ?,
        sex_filter = ?,
        is_athlete = ?,
        purpose = ?,
        is_default = ?,
        is_active = ?,
        relevance_score = ?,
        created_by_user_id = ?,
        is_public = ?,
        verified_profile_id = ?,
        category_name = ?,
        population_slug = ?,
        verified_profile_name = ?,
        published_at = ?,
        verified_at = ?,
        review_due_at = ?,
        superseded_by_id = ?,
        updated_at = strftime('%s','now')${versionSet}
      WHERE ${whereSql}
    `).bind(...updateBindings).run()
    if (lock.value.enforce && d1ChangeCount(updateResult) === 0) {
      const current = await getDoseRecommendationAdminRow(c.env.DB, id)
      return c.json({ error: 'Version conflict', current_version: current?.version ?? existing.version }, 409)
    }
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      return c.json({ error: 'An active default recommendation already exists for this ingredient/population/targeting combination' }, 409)
    }
    throw error
  }
  if (data.sources !== undefined) {
    await replaceDoseRecommendationSources(c.env.DB, id, data.sources)
  }

  const recommendation = await getDoseRecommendationAdminRow(c.env.DB, id)
  const plausibilityWarnings = await buildDosePlausibilityWarnings(c.env.DB, recommendation)

  await logAdminAction(c, {
    action: 'update_dose_recommendation',
    entity_type: 'dose_recommendation',
    entity_id: id,
    changes: { before: existing, after: recommendation },
  })

  return c.json({ recommendation, plausibility_warnings: plausibilityWarnings })
})

// DELETE /api/admin/dose-recommendations/:id (admin only; soft delete via is_active=0)
admin.delete('/dose-recommendations/:id', async (c) => {
  const authErr = await ensureAdmin(c)
  if (authErr) return authErr

  const id = parsePositiveId(c.req.param('id'))
  if (id === null) return c.json({ error: 'Invalid dose recommendation id' }, 400)

  const existing = await getDoseRecommendationAdminRow(c.env.DB, id)
  if (!existing) return c.json({ error: 'Dose recommendation not found' }, 404)
  const columns = await getTableColumns(c.env.DB, 'dose_recommendations')
  const lock = validateOptimisticLock(columns.has('version'), existing.version, requestVersion(c))
  if (!lock.ok) return c.json({ error: lock.error, current_version: existing.version }, 409)
  const versionSet = lock.value.enforce ? ', version = COALESCE(version, 0) + 1' : ''
  const whereSql = lock.value.enforce ? optimisticWhere() : 'id = ?'
  const deactivateBindings: number[] = [id]
  if (lock.value.enforce && lock.value.expectedVersion !== null) deactivateBindings.push(lock.value.expectedVersion)

  const deactivateResult = await c.env.DB.prepare(`
    UPDATE dose_recommendations
    SET is_active = 0,
        is_default = 0,
        updated_at = strftime('%s','now')${versionSet}
    WHERE ${whereSql}
  `).bind(...deactivateBindings).run()
  if (lock.value.enforce && d1ChangeCount(deactivateResult) === 0) {
    const current = await getDoseRecommendationAdminRow(c.env.DB, id)
    return c.json({ error: 'Version conflict', current_version: current?.version ?? existing.version }, 409)
  }

  const recommendation = await getDoseRecommendationAdminRow(c.env.DB, id)
  await logAdminAction(c, {
    action: 'deactivate_dose_recommendation',
    entity_type: 'dose_recommendation',
    entity_id: id,
    changes: {
      before: {
        is_active: existing.is_active,
        is_default: existing.is_default,
      },
      after: {
        is_active: recommendation?.is_active ?? 0,
        is_default: recommendation?.is_default ?? 0,
      },
    },
  })

  return c.json({ ok: true, recommendation })
})

// GET /api/admin/ingredient-research?q=&category=&status= (admin only)
admin.get('/ingredient-research', async (c) => {
  const authErr = await ensureAdmin(c)
  if (authErr) return authErr

  const q = c.req.query('q')?.trim() ?? ''
  const category = c.req.query('category')?.trim() ?? ''
  const statusParam = c.req.query('status')?.trim() ?? ''
  const like = `%${q}%`

  const where: string[] = []
  const bindings: Array<string | number> = []

  if (q) {
    where.push('(i.name LIKE ? OR COALESCE(i.category, \'\') LIKE ?)')
    bindings.push(like, like)
  }

  if (category) {
    where.push('COALESCE(i.category, \'\') = ?')
    bindings.push(category)
  }

  if (statusParam) {
    const status = enumValue(statusParam, INGREDIENT_RESEARCH_STATUSES)
    if (!status) return c.json({ error: `status must be one of ${INGREDIENT_RESEARCH_STATUSES.join(', ')}` }, 400)
    where.push('COALESCE(rs.research_status, \'unreviewed\') = ?')
    bindings.push(status)
  }

  const whereSql = where.length > 0 ? `WHERE ${where.join(' AND ')}` : ''

  const { results } = await c.env.DB.prepare(`
    SELECT
      i.id AS ingredient_id,
      i.name,
      i.category,
      i.unit,
      COALESCE(rs.research_status, 'unreviewed') AS research_status,
      COALESCE(rs.calculation_status, 'not_started') AS calculation_status,
      rs.internal_notes,
      rs.blog_url,
      rs.reviewed_at AS status_reviewed_at,
      rs.review_due_at,
      rs.updated_at AS status_updated_at,
      COALESCE(source_counts.official_source_count, 0) AS official_source_count,
      COALESCE(source_counts.study_source_count, 0) AS study_source_count,
      COALESCE(warning_counts.warning_count, 0) AS warning_count,
      COALESCE(source_counts.no_recommendation_count, 0) AS no_recommendation_count,
      source_counts.latest_source_reviewed_at
    FROM ingredients i
    LEFT JOIN ingredient_research_status rs ON rs.ingredient_id = i.id
    LEFT JOIN (
      SELECT
        ingredient_id,
        SUM(CASE WHEN source_kind = 'official' THEN 1 ELSE 0 END) AS official_source_count,
        SUM(CASE WHEN source_kind = 'study' THEN 1 ELSE 0 END) AS study_source_count,
        SUM(CASE WHEN no_recommendation = 1 THEN 1 ELSE 0 END) AS no_recommendation_count,
        MAX(reviewed_at) AS latest_source_reviewed_at
      FROM ingredient_research_sources
      GROUP BY ingredient_id
    ) source_counts ON source_counts.ingredient_id = i.id
    LEFT JOIN (
      SELECT ingredient_id, COUNT(*) AS warning_count
      FROM ingredient_safety_warnings
      WHERE active = 1
      GROUP BY ingredient_id
    ) warning_counts ON warning_counts.ingredient_id = i.id
    ${whereSql}
    ORDER BY COALESCE(i.category, '') ASC, i.name ASC
  `).bind(...bindings).all<IngredientResearchListRow>()

  return c.json({ ingredients: results, items: results, total: results.length })
})

// GET /api/admin/ingredient-research/export (admin only)
admin.get('/ingredient-research/export', async (c) => {
  const authErr = await ensureAdmin(c)
  if (authErr) return authErr

  const { results } = await c.env.DB.prepare(`
    SELECT
      i.id AS ingredient_id,
      i.name,
      i.category,
      i.unit,
      COALESCE(rs.research_status, 'unreviewed') AS research_status,
      COALESCE(rs.calculation_status, 'not_started') AS calculation_status,
      rs.reviewed_at,
      rs.review_due_at,
      COALESCE(source_counts.source_count, 0) AS source_count,
      COALESCE(source_counts.official_source_count, 0) AS official_source_count,
      COALESCE(source_counts.study_source_count, 0) AS study_source_count,
      COALESCE(source_counts.no_recommendation_count, 0) AS no_recommendation_count,
      COALESCE(warning_counts.warning_count, 0) AS warning_count,
      warning_counts.warning_slugs
    FROM ingredients i
    LEFT JOIN ingredient_research_status rs ON rs.ingredient_id = i.id
    LEFT JOIN (
      SELECT
        ingredient_id,
        COUNT(*) AS source_count,
        SUM(CASE WHEN source_kind = 'official' THEN 1 ELSE 0 END) AS official_source_count,
        SUM(CASE WHEN source_kind = 'study' THEN 1 ELSE 0 END) AS study_source_count,
        SUM(CASE WHEN no_recommendation = 1 THEN 1 ELSE 0 END) AS no_recommendation_count
      FROM ingredient_research_sources
      GROUP BY ingredient_id
    ) source_counts ON source_counts.ingredient_id = i.id
    LEFT JOIN (
      SELECT
        ingredient_id,
        COUNT(*) AS warning_count,
        group_concat(COALESCE(article_slug, ''), '||') AS warning_slugs
      FROM ingredient_safety_warnings
      WHERE active = 1
      GROUP BY ingredient_id
    ) warning_counts ON warning_counts.ingredient_id = i.id
    ORDER BY COALESCE(i.category, '') ASC, i.name ASC
  `).all<IngredientResearchExportRow>()

  return c.json({
    exported_at: new Date().toISOString(),
    ingredients: results.map((row) => ({
      ...row,
      warning_slugs: parseWarningSlugs(row.warning_slugs),
    })),
    total: results.length,
  })
})

// GET /api/admin/ingredient-research/:ingredientId (admin only)
admin.get('/ingredient-research/:ingredientId', async (c) => {
  const authErr = await ensureAdmin(c)
  if (authErr) return authErr

  const ingredientId = parsePositiveId(c.req.param('ingredientId'))
  if (ingredientId === null) return c.json({ error: 'Invalid ingredient id' }, 400)

  const ingredient = await c.env.DB.prepare(`
    SELECT id, name, category, unit, description, external_url
    FROM ingredients
    WHERE id = ?
  `).bind(ingredientId).first()
  if (!ingredient) return c.json({ error: 'Ingredient not found' }, 404)

  const status = await getIngredientResearchStatusRow(c.env.DB, ingredientId)
  const researchSourceColumns = await getTableColumns(c.env.DB, 'ingredient_research_sources')
  const warningColumns = await getTableColumns(c.env.DB, 'ingredient_safety_warnings')
  const displayProfileColumns = await getTableColumns(c.env.DB, 'ingredient_display_profiles')

  const { results: sources } = await c.env.DB.prepare(`
    SELECT
      id,
      ingredient_id,
      source_kind,
      organization,
      country,
      region,
      population,
      recommendation_type,
      no_recommendation,
      dose_min,
      dose_max,
      dose_unit,
      per_kg_body_weight,
      frequency,
      study_type,
      evidence_quality,
      duration,
      outcome,
      finding,
      source_title,
      source_url,
      doi,
      pubmed_id,
      notes,
      source_date,
      reviewed_at,
      ${ingredientResearchEvidenceSelect(researchSourceColumns)},
      created_at,
      updated_at,
      ${versionSelect(researchSourceColumns)}
    FROM ingredient_research_sources
    WHERE ingredient_id = ?
    ORDER BY source_kind ASC, COALESCE(reviewed_at, source_date, created_at) DESC, id DESC
  `).bind(ingredientId).all<IngredientResearchSourceRow>()

  const { results: warnings } = await c.env.DB.prepare(`
    SELECT
      w.id,
      w.ingredient_id,
      i.name AS ingredient_name,
      w.form_id,
      f.name AS form_name,
      w.short_label,
      w.popover_text,
      w.severity,
      w.article_slug,
      a.title AS article_title,
      w.min_amount,
      w.unit,
      w.active,
      w.created_at,
      ${versionSelect(warningColumns, 'w')}
    FROM ingredient_safety_warnings w
    LEFT JOIN ingredients i ON i.id = w.ingredient_id
    LEFT JOIN ingredient_forms f ON f.id = w.form_id
    LEFT JOIN knowledge_articles a ON a.slug = w.article_slug
    WHERE w.ingredient_id = ?
    ORDER BY w.active DESC, w.severity DESC, w.id DESC
  `).bind(ingredientId).all<IngredientSafetyWarningAdminRow>()

  const { results: forms } = await c.env.DB.prepare(`
    SELECT id, ingredient_id, name, timing, comment
    FROM ingredient_forms
    WHERE ingredient_id = ?
    ORDER BY score DESC, name ASC, id ASC
  `).bind(ingredientId).all<IngredientFormAdminRow>()

  const { results: displayProfiles } = await c.env.DB.prepare(`
    SELECT
      id,
      ingredient_id,
      form_id,
      sub_ingredient_id,
      effect_summary,
      timing,
      timing_note,
      intake_hint,
      card_note,
      created_at,
      updated_at,
      ${versionSelect(displayProfileColumns)}
    FROM ingredient_display_profiles
    WHERE ingredient_id = ?
    ORDER BY
      CASE
        WHEN form_id IS NULL AND sub_ingredient_id IS NULL THEN 0
        WHEN form_id IS NOT NULL AND sub_ingredient_id IS NULL THEN 1
        WHEN form_id IS NULL AND sub_ingredient_id IS NOT NULL THEN 2
        ELSE 3
      END ASC,
      form_id ASC,
      sub_ingredient_id ASC,
      id ASC
  `).bind(ingredientId).all<IngredientDisplayProfileRow>()
  const precursors = await loadIngredientPrecursors(c.env.DB, ingredientId)

  return c.json({
    ingredient,
    status: status ?? {
      ingredient_id: ingredientId,
      research_status: 'unreviewed',
      calculation_status: 'not_started',
      internal_notes: null,
      blog_url: null,
      reviewed_at: null,
      review_due_at: null,
      created_at: null,
      updated_at: null,
      version: null,
    },
    sources,
    warnings,
    forms,
    precursors,
    display_profiles: displayProfiles,
  })
})

// PUT /api/admin/ingredient-research/:ingredientId/status (admin only)
admin.put('/ingredient-research/:ingredientId/status', async (c) => {
  const authErr = await ensureAdmin(c)
  if (authErr) return authErr

  const ingredientId = parsePositiveId(c.req.param('ingredientId'))
  if (ingredientId === null) return c.json({ error: 'Invalid ingredient id' }, 400)
  if (!(await ingredientExists(c.env.DB, ingredientId))) return c.json({ error: 'Ingredient not found' }, 404)

  let body: Record<string, unknown>
  try {
    body = await c.req.json()
  } catch {
    return c.json({ error: 'Invalid JSON' }, 400)
  }

  const existing = await getIngredientResearchStatusRow(c.env.DB, ingredientId)
  const validation = await validateIngredientResearchStatusPayload(body, existing)
  if (!validation.ok) return c.json({ error: validation.error }, validation.status ?? 400)

  const data = validation.value
  const columns = await getTableColumns(c.env.DB, 'ingredient_research_status')
  const lock = validateOptimisticLock(columns.has('version') && existing !== null, existing?.version ?? null, requestVersion(c, body))
  if (!lock.ok) return c.json({ error: lock.error, current_version: existing?.version ?? null }, 409)
  const insertColumns = columns.has('version')
    ? `
      ingredient_id,
      research_status,
      calculation_status,
      internal_notes,
      blog_url,
      reviewed_at,
      review_due_at,
      version,
      created_at,
      updated_at
    `
    : `
      ingredient_id,
      research_status,
      calculation_status,
      internal_notes,
      blog_url,
      reviewed_at,
      review_due_at,
      created_at,
      updated_at
    `
  const insertValues = columns.has('version')
    ? '?, ?, ?, ?, ?, ?, ?, 1, datetime(\'now\'), datetime(\'now\')'
    : '?, ?, ?, ?, ?, ?, ?, datetime(\'now\'), datetime(\'now\')'
  const versionSet = columns.has('version') ? ', version = COALESCE(ingredient_research_status.version, 0) + 1' : ''
  const conflictWhere = lock.value.enforce ? ' WHERE ingredient_research_status.version = ?' : ''
  const statusBindings: Array<string | number | null> = [
    ingredientId,
    data.research_status,
    data.calculation_status,
    data.internal_notes,
    data.blog_url,
    data.reviewed_at,
    data.review_due_at,
  ]
  if (lock.value.enforce && lock.value.expectedVersion !== null) statusBindings.push(lock.value.expectedVersion)
  const statusResult = await c.env.DB.prepare(`
    INSERT INTO ingredient_research_status (
      ${insertColumns}
    )
    VALUES (${insertValues})
    ON CONFLICT(ingredient_id) DO UPDATE SET
      research_status = excluded.research_status,
      calculation_status = excluded.calculation_status,
      internal_notes = excluded.internal_notes,
      blog_url = excluded.blog_url,
      reviewed_at = excluded.reviewed_at,
      review_due_at = excluded.review_due_at,
      updated_at = datetime('now')${versionSet}${conflictWhere}
  `).bind(...statusBindings).run()
  if (lock.value.enforce && d1ChangeCount(statusResult) === 0) {
    const current = await getIngredientResearchStatusRow(c.env.DB, ingredientId)
    return c.json({ error: 'Version conflict', current_version: current?.version ?? existing?.version ?? null }, 409)
  }

  const status = await getIngredientResearchStatusRow(c.env.DB, ingredientId)
  await logAdminAction(c, {
    action: 'upsert_ingredient_research_status',
    entity_type: 'ingredient_research_status',
    entity_id: ingredientId,
    changes: { before: existing, after: status },
  })

  return c.json({ status })
})

// PUT /api/admin/ingredient-research/:ingredientId/display-profile (admin only)
admin.put('/ingredient-research/:ingredientId/display-profile', async (c) => {
  const authErr = await ensureAdmin(c)
  if (authErr) return authErr

  const ingredientId = parsePositiveId(c.req.param('ingredientId'))
  if (ingredientId === null) return c.json({ error: 'Invalid ingredient id' }, 400)

  let body: Record<string, unknown>
  try {
    body = await c.req.json()
  } catch {
    return c.json({ error: 'Invalid JSON' }, 400)
  }

  const validation = await validateIngredientDisplayProfilePayload(c.env.DB, body, ingredientId)
  if (!validation.ok) return c.json({ error: validation.error }, validation.status ?? 400)

  const data = validation.value
  const existing = await getIngredientDisplayProfileRow(c.env.DB, ingredientId, data.form_id, data.sub_ingredient_id)
  const columns = await getTableColumns(c.env.DB, 'ingredient_display_profiles')
  const lock = validateOptimisticLock(columns.has('version') && existing !== null, existing?.version ?? null, requestVersion(c, body))
  if (!lock.ok) return c.json({ error: lock.error, current_version: existing?.version ?? null }, 409)
  if (existing) {
    const versionSet = lock.value.enforce ? ', version = COALESCE(version, 0) + 1' : ''
    const whereSql = lock.value.enforce ? optimisticWhere() : 'id = ?'
    const profileBindings: Array<string | number | null> = [
      data.effect_summary,
      data.timing,
      data.timing_note,
      data.intake_hint,
      data.card_note,
      existing.id,
    ]
    if (lock.value.enforce && lock.value.expectedVersion !== null) profileBindings.push(lock.value.expectedVersion)
    const profileResult = await c.env.DB.prepare(`
      UPDATE ingredient_display_profiles
      SET
        effect_summary = ?,
        timing = ?,
        timing_note = ?,
        intake_hint = ?,
        card_note = ?,
        updated_at = datetime('now')${versionSet}
      WHERE ${whereSql}
    `).bind(...profileBindings).run()
    if (lock.value.enforce && d1ChangeCount(profileResult) === 0) {
      const current = await getIngredientDisplayProfileRow(c.env.DB, ingredientId, data.form_id, data.sub_ingredient_id)
      return c.json({ error: 'Version conflict', current_version: current?.version ?? existing.version }, 409)
    }
  } else {
    await c.env.DB.prepare(`
      INSERT INTO ingredient_display_profiles (
        ingredient_id,
        form_id,
        sub_ingredient_id,
        effect_summary,
        timing,
        timing_note,
        intake_hint,
        card_note,
        created_at,
        updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
    `).bind(
      data.ingredient_id,
      data.form_id,
      data.sub_ingredient_id,
      data.effect_summary,
      data.timing,
      data.timing_note,
      data.intake_hint,
      data.card_note,
    ).run()
  }

  const profile = await getIngredientDisplayProfileRow(c.env.DB, ingredientId, data.form_id, data.sub_ingredient_id)
  await logAdminAction(c, {
    action: 'upsert_ingredient_display_profile',
    entity_type: 'ingredient_display_profile',
    entity_id: profile?.id ?? ingredientId,
    changes: { before: existing, after: profile },
  })

  return c.json({ profile })
})

// POST /api/admin/ingredient-research/:ingredientId/sources (admin only)
admin.post('/ingredient-research/:ingredientId/sources', async (c) => {
  const authErr = await ensureAdmin(c)
  if (authErr) return authErr

  const ingredientId = parsePositiveId(c.req.param('ingredientId'))
  if (ingredientId === null) return c.json({ error: 'Invalid ingredient id' }, 400)

  let body: Record<string, unknown>
  try {
    body = await c.req.json()
  } catch {
    return c.json({ error: 'Invalid JSON' }, 400)
  }

  const validation = await validateIngredientResearchSourcePayload(c.env.DB, body, ingredientId, null)
  if (!validation.ok) return c.json({ error: validation.error }, validation.status ?? 400)

  const data = validation.value
  const researchColumns = await getTableColumns(c.env.DB, 'ingredient_research_sources')
  const fields: Array<[string, string | number | null]> = [
    ['ingredient_id', data.ingredient_id],
    ['source_kind', data.source_kind],
    ['organization', data.organization],
    ['country', data.country],
    ['region', data.region],
    ['population', data.population],
    ['recommendation_type', data.recommendation_type],
    ['no_recommendation', data.no_recommendation],
    ['dose_min', data.dose_min],
    ['dose_max', data.dose_max],
    ['dose_unit', data.dose_unit],
    ['per_kg_body_weight', data.per_kg_body_weight],
    ['frequency', data.frequency],
    ['study_type', data.study_type],
    ['evidence_quality', data.evidence_quality],
    ['duration', data.duration],
    ['outcome', data.outcome],
    ['finding', data.finding],
    ['source_title', data.source_title],
    ['source_url', data.source_url],
    ['doi', data.doi],
    ['pubmed_id', data.pubmed_id],
    ['notes', data.notes],
    ['source_date', data.source_date],
    ['reviewed_at', data.reviewed_at],
  ]
  if (researchColumns.has('is_retracted')) fields.push(['is_retracted', data.is_retracted])
  if (researchColumns.has('retraction_checked_at')) fields.push(['retraction_checked_at', data.retraction_checked_at])
  if (researchColumns.has('retraction_notice_url')) fields.push(['retraction_notice_url', data.retraction_notice_url])
  if (researchColumns.has('evidence_grade')) fields.push(['evidence_grade', data.evidence_grade])
  const result = await c.env.DB.prepare(`
    INSERT INTO ingredient_research_sources (
      ${fields.map(([key]) => key).join(',\n      ')},
      created_at,
      updated_at
    )
    VALUES (${fields.map(() => '?').join(', ')}, datetime('now'), datetime('now'))
  `).bind(...fields.map(([, value]) => value)).run()

  const sourceId = result.meta.last_row_id as number
  const source = await getIngredientResearchSourceRow(c.env.DB, sourceId)
  await logAdminAction(c, {
    action: 'create_ingredient_research_source',
    entity_type: 'ingredient_research_source',
    entity_id: sourceId,
    changes: data,
  })

  return c.json({ source }, 201)
})

// PUT /api/admin/ingredient-research/sources/:sourceId (admin only)
admin.put('/ingredient-research/sources/:sourceId', async (c) => {
  const authErr = await ensureAdmin(c)
  if (authErr) return authErr

  const sourceId = parsePositiveId(c.req.param('sourceId'))
  if (sourceId === null) return c.json({ error: 'Invalid source id' }, 400)

  const existing = await getIngredientResearchSourceRow(c.env.DB, sourceId)
  if (!existing) return c.json({ error: 'Source not found' }, 404)

  let body: Record<string, unknown>
  try {
    body = await c.req.json()
  } catch {
    return c.json({ error: 'Invalid JSON' }, 400)
  }

  const ingredientId = hasOwnKey(body, 'ingredient_id')
    ? normalizeInteger(body.ingredient_id)
    : existing.ingredient_id
  if (!ingredientId || ingredientId <= 0) return c.json({ error: 'ingredient_id must be a positive integer' }, 400)

  const validation = await validateIngredientResearchSourcePayload(c.env.DB, body, ingredientId, existing)
  if (!validation.ok) return c.json({ error: validation.error }, validation.status ?? 400)

  const data = validation.value
  const researchColumns = await getTableColumns(c.env.DB, 'ingredient_research_sources')
  const lock = validateOptimisticLock(researchColumns.has('version'), existing.version, requestVersion(c, body))
  if (!lock.ok) return c.json({ error: lock.error, current_version: existing.version }, 409)
  const fields: Array<[string, string | number | null]> = [
    ['ingredient_id', data.ingredient_id],
    ['source_kind', data.source_kind],
    ['organization', data.organization],
    ['country', data.country],
    ['region', data.region],
    ['population', data.population],
    ['recommendation_type', data.recommendation_type],
    ['no_recommendation', data.no_recommendation],
    ['dose_min', data.dose_min],
    ['dose_max', data.dose_max],
    ['dose_unit', data.dose_unit],
    ['per_kg_body_weight', data.per_kg_body_weight],
    ['frequency', data.frequency],
    ['study_type', data.study_type],
    ['evidence_quality', data.evidence_quality],
    ['duration', data.duration],
    ['outcome', data.outcome],
    ['finding', data.finding],
    ['source_title', data.source_title],
    ['source_url', data.source_url],
    ['doi', data.doi],
    ['pubmed_id', data.pubmed_id],
    ['notes', data.notes],
    ['source_date', data.source_date],
    ['reviewed_at', data.reviewed_at],
  ]
  if (researchColumns.has('is_retracted')) fields.push(['is_retracted', data.is_retracted])
  if (researchColumns.has('retraction_checked_at')) fields.push(['retraction_checked_at', data.retraction_checked_at])
  if (researchColumns.has('retraction_notice_url')) fields.push(['retraction_notice_url', data.retraction_notice_url])
  if (researchColumns.has('evidence_grade')) fields.push(['evidence_grade', data.evidence_grade])
  const versionSet = lock.value.enforce ? ', version = COALESCE(version, 0) + 1' : ''
  const whereSql = lock.value.enforce ? optimisticWhere() : 'id = ?'
  const sourceBindings: Array<string | number | null> = [...fields.map(([, value]) => value), sourceId]
  if (lock.value.enforce && lock.value.expectedVersion !== null) sourceBindings.push(lock.value.expectedVersion)
  const sourceUpdateResult = await c.env.DB.prepare(`
    UPDATE ingredient_research_sources
    SET
      ${fields.map(([key]) => `${key} = ?`).join(',\n      ')},
      updated_at = datetime('now')${versionSet}
    WHERE ${whereSql}
  `).bind(...sourceBindings).run()
  if (lock.value.enforce && d1ChangeCount(sourceUpdateResult) === 0) {
    const current = await getIngredientResearchSourceRow(c.env.DB, sourceId)
    return c.json({ error: 'Version conflict', current_version: current?.version ?? existing.version }, 409)
  }

  const source = await getIngredientResearchSourceRow(c.env.DB, sourceId)
  await logAdminAction(c, {
    action: 'update_ingredient_research_source',
    entity_type: 'ingredient_research_source',
    entity_id: sourceId,
    changes: { before: existing, after: source },
  })

  return c.json({ source })
})

// DELETE /api/admin/ingredient-research/sources/:sourceId (admin only)
admin.delete('/ingredient-research/sources/:sourceId', async (c) => {
  const authErr = await ensureAdmin(c)
  if (authErr) return authErr

  const sourceId = parsePositiveId(c.req.param('sourceId'))
  if (sourceId === null) return c.json({ error: 'Invalid source id' }, 400)

  const existing = await getIngredientResearchSourceRow(c.env.DB, sourceId)
  if (!existing) return c.json({ error: 'Source not found' }, 404)
  const researchColumns = await getTableColumns(c.env.DB, 'ingredient_research_sources')
  const lock = validateOptimisticLock(researchColumns.has('version'), existing.version, requestVersion(c))
  if (!lock.ok) return c.json({ error: lock.error, current_version: existing.version }, 409)

  const linkedDoseCount = await c.env.DB.prepare(`
    SELECT COUNT(*) AS count
    FROM dose_recommendation_sources
    WHERE research_source_id = ?
  `).bind(sourceId).first<CountRow>()
  if ((linkedDoseCount?.count ?? 0) > 0) {
    return c.json({ error: 'Source is linked to dose recommendations and cannot be deleted' }, 409)
  }

  const deleteResult = await c.env.DB.prepare(
    lock.value.enforce
      ? 'DELETE FROM ingredient_research_sources WHERE id = ? AND version = ?'
      : 'DELETE FROM ingredient_research_sources WHERE id = ?',
  )
    .bind(...(lock.value.enforce && lock.value.expectedVersion !== null ? [sourceId, lock.value.expectedVersion] : [sourceId]))
    .run()
  if (lock.value.enforce && d1ChangeCount(deleteResult) === 0) {
    const current = await getIngredientResearchSourceRow(c.env.DB, sourceId)
    return c.json({ error: 'Version conflict', current_version: current?.version ?? existing.version }, 409)
  }

  await logAdminAction(c, {
    action: 'delete_ingredient_research_source',
    entity_type: 'ingredient_research_source',
    entity_id: sourceId,
    changes: existing,
  })

  return c.json({ ok: true })
})

// POST /api/admin/ingredient-research/:ingredientId/warnings (admin only)
admin.post('/ingredient-research/:ingredientId/warnings', async (c) => {
  const authErr = await ensureAdmin(c)
  if (authErr) return authErr

  const ingredientId = parsePositiveId(c.req.param('ingredientId'))
  if (ingredientId === null) return c.json({ error: 'Invalid ingredient id' }, 400)

  let body: Record<string, unknown>
  try {
    body = await c.req.json()
  } catch {
    return c.json({ error: 'Invalid JSON' }, 400)
  }

  const validation = await validateIngredientWarningPayload(c.env.DB, body, ingredientId, null)
  if (!validation.ok) return c.json({ error: validation.error }, validation.status ?? 400)

  const data = validation.value
  const result = await c.env.DB.prepare(`
    INSERT INTO ingredient_safety_warnings (
      ingredient_id,
      form_id,
      short_label,
      popover_text,
      severity,
      article_slug,
      min_amount,
      unit,
      active
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    data.ingredient_id,
    data.form_id,
    data.short_label,
    data.popover_text,
    data.severity,
    data.article_slug,
    data.min_amount,
    data.unit,
    data.active,
  ).run()

  const warningId = result.meta.last_row_id as number
  const warning = await getIngredientSafetyWarningAdminRow(c.env.DB, warningId)
  await logAdminAction(c, {
    action: 'create_ingredient_safety_warning',
    entity_type: 'ingredient_safety_warning',
    entity_id: warningId,
    changes: data,
  })

  return c.json({ warning }, 201)
})

// PUT /api/admin/ingredient-research/warnings/:warningId (admin only)
admin.put('/ingredient-research/warnings/:warningId', async (c) => {
  const authErr = await ensureAdmin(c)
  if (authErr) return authErr

  const warningId = parsePositiveId(c.req.param('warningId'))
  if (warningId === null) return c.json({ error: 'Invalid warning id' }, 400)

  const existing = await getIngredientSafetyWarningAdminRow(c.env.DB, warningId)
  if (!existing) return c.json({ error: 'Warning not found' }, 404)

  let body: Record<string, unknown>
  try {
    body = await c.req.json()
  } catch {
    return c.json({ error: 'Invalid JSON' }, 400)
  }

  const validation = await validateIngredientWarningPayload(c.env.DB, body, existing.ingredient_id, existing)
  if (!validation.ok) return c.json({ error: validation.error }, validation.status ?? 400)

  const data = validation.value
  const columns = await getTableColumns(c.env.DB, 'ingredient_safety_warnings')
  const lock = validateOptimisticLock(columns.has('version'), existing.version, requestVersion(c, body))
  if (!lock.ok) return c.json({ error: lock.error, current_version: existing.version }, 409)
  const versionSet = lock.value.enforce ? ', version = COALESCE(version, 0) + 1' : ''
  const whereSql = lock.value.enforce ? optimisticWhere() : 'id = ?'
  const warningBindings: Array<string | number | null> = [
    data.ingredient_id,
    data.form_id,
    data.short_label,
    data.popover_text,
    data.severity,
    data.article_slug,
    data.min_amount,
    data.unit,
    data.active,
    warningId,
  ]
  if (lock.value.enforce && lock.value.expectedVersion !== null) warningBindings.push(lock.value.expectedVersion)
  const warningUpdateResult = await c.env.DB.prepare(`
    UPDATE ingredient_safety_warnings
    SET
      ingredient_id = ?,
      form_id = ?,
      short_label = ?,
      popover_text = ?,
      severity = ?,
      article_slug = ?,
      min_amount = ?,
      unit = ?,
      active = ?${versionSet}
    WHERE ${whereSql}
  `).bind(...warningBindings).run()
  if (lock.value.enforce && d1ChangeCount(warningUpdateResult) === 0) {
    const current = await getIngredientSafetyWarningAdminRow(c.env.DB, warningId)
    return c.json({ error: 'Version conflict', current_version: current?.version ?? existing.version }, 409)
  }

  const warning = await getIngredientSafetyWarningAdminRow(c.env.DB, warningId)
  await logAdminAction(c, {
    action: 'update_ingredient_safety_warning',
    entity_type: 'ingredient_safety_warning',
    entity_id: warningId,
    changes: { before: existing, after: warning },
  })

  return c.json({ warning })
})

// DELETE /api/admin/ingredient-research/warnings/:warningId (admin only; soft delete via active=0)
admin.delete('/ingredient-research/warnings/:warningId', async (c) => {
  const authErr = await ensureAdmin(c)
  if (authErr) return authErr

  const warningId = parsePositiveId(c.req.param('warningId'))
  if (warningId === null) return c.json({ error: 'Invalid warning id' }, 400)

  const existing = await getIngredientSafetyWarningAdminRow(c.env.DB, warningId)
  if (!existing) return c.json({ error: 'Warning not found' }, 404)
  const columns = await getTableColumns(c.env.DB, 'ingredient_safety_warnings')
  const lock = validateOptimisticLock(columns.has('version'), existing.version, requestVersion(c))
  if (!lock.ok) return c.json({ error: lock.error, current_version: existing.version }, 409)
  const versionSet = lock.value.enforce ? ', version = COALESCE(version, 0) + 1' : ''
  const whereSql = lock.value.enforce ? optimisticWhere() : 'id = ?'
  const warningBindings: number[] = [warningId]
  if (lock.value.enforce && lock.value.expectedVersion !== null) warningBindings.push(lock.value.expectedVersion)

  const warningDeactivateResult = await c.env.DB.prepare(`UPDATE ingredient_safety_warnings SET active = 0${versionSet} WHERE ${whereSql}`)
    .bind(...warningBindings)
    .run()
  if (lock.value.enforce && d1ChangeCount(warningDeactivateResult) === 0) {
    const current = await getIngredientSafetyWarningAdminRow(c.env.DB, warningId)
    return c.json({ error: 'Version conflict', current_version: current?.version ?? existing.version }, 409)
  }

  const warning = await getIngredientSafetyWarningAdminRow(c.env.DB, warningId)
  await logAdminAction(c, {
    action: 'deactivate_ingredient_safety_warning',
    entity_type: 'ingredient_safety_warning',
    entity_id: warningId,
    changes: {
      before: { active: existing.active },
      after: { active: warning?.active ?? 0 },
    },
  })

  return c.json({ ok: true, warning })
})

// GET /api/admin/shop-domains (admin only)
admin.get('/shop-domains', async (c) => {
  const authErr = await ensureAuth(c)
  if (authErr) return authErr
  const admErr = requireAdmin(c)
  if (admErr) return admErr
  const { results: shops } = await c.env.DB.prepare(
    'SELECT * FROM shop_domains ORDER BY display_name ASC'
  ).all()
  return c.json({ shops })
})

// POST /api/admin/shop-domains (admin only)
admin.post('/shop-domains', async (c) => {
  const authErr = await ensureAuth(c)
  if (authErr) return authErr
  const admErr = requireAdmin(c)
  if (admErr) return admErr
  const body = await c.req.json()
  if (!body.domain || !body.display_name) return c.json({ error: 'domain und display_name erforderlich' }, 400)
  const normalizedDomain = normalizeShopHostname(String(body.domain))
  if (!normalizedDomain) return c.json({ error: 'ungueltige Domain' }, 400)
  const result = await c.env.DB.prepare(
    'INSERT INTO shop_domains (domain, display_name) VALUES (?, ?)'
  ).bind(normalizedDomain, String(body.display_name).trim()).run()
  await logAdminAction(c, {
    action: 'create_shop_domain',
    entity_type: 'shop_domain',
    entity_id: result.meta.last_row_id as number,
    changes: { ...body, domain: normalizedDomain },
  })
  return c.json({ id: result.meta.last_row_id }, 201)
})

// DELETE /api/admin/shop-domains/:id (admin only)
admin.delete('/shop-domains/:id', async (c) => {
  const authErr = await ensureAuth(c)
  if (authErr) return authErr
  const admErr = requireAdmin(c)
  if (admErr) return admErr
  const id = c.req.param('id')
  await c.env.DB.prepare('DELETE FROM shop_domains WHERE id = ?').bind(id).run()
  await logAdminAction(c, {
    action: 'delete_shop_domain',
    entity_type: 'shop_domain',
    entity_id: Number(id),
  })
  return c.json({ ok: true })
})

// GET /api/admin/managed-lists/:listKey (admin only)
admin.get('/managed-lists/:listKey', async (c) => {
  const authErr = await ensureAdmin(c)
  if (authErr) return authErr

  const listKey = adminManagedListKey(c.req.param('listKey'))
  if (!listKey) return c.json({ error: `list_key must be one of ${ADMIN_MANAGED_LIST_KEYS.join(', ')}` }, 400)
  if (!(await hasTable(c.env.DB, 'managed_list_items'))) {
    return c.json({ error: 'managed_list_items is not available in this environment' }, 409)
  }

  const includeInactive = c.req.query('include_inactive') === '1'
  const results = await loadManagedListItems(c.env.DB, listKey, includeInactive)

  return c.json({
    list_key: listKey,
    items: results.map(formatManagedListItem),
  })
})

// POST /api/admin/managed-lists/:listKey (admin only)
admin.post('/managed-lists/:listKey', async (c) => {
  const authErr = await ensureAdmin(c)
  if (authErr) return authErr

  const listKey = adminManagedListKey(c.req.param('listKey'))
  if (!listKey) return c.json({ error: `list_key must be one of ${ADMIN_MANAGED_LIST_KEYS.join(', ')}` }, 400)
  if (!(await hasTable(c.env.DB, 'managed_list_items'))) {
    return c.json({ error: 'managed_list_items is not available in this environment' }, 409)
  }

  let body: Record<string, unknown>
  try {
    body = await c.req.json()
  } catch {
    return c.json({ error: 'Invalid JSON' }, 400)
  }

  const validation = validateManagedListItemMutation(body, null)
  if (!validation.ok) return c.json({ error: validation.error }, validation.status)
  const data = validation.value
  const columns = await getTableColumns(c.env.DB, 'managed_list_items')
  const supportsPluralLabel = columns.has('plural_label')
  const nextSortOrder = data.sort_order ?? (
    await c.env.DB.prepare(`
      SELECT COALESCE(MAX(sort_order), 0) + 10 AS sort_order
      FROM managed_list_items
      WHERE list_key = ?
    `).bind(listKey).first<{ sort_order: number | null }>()
  )?.sort_order ?? 10

  const insertColumns = [
    'list_key',
    'value',
    'label',
    ...(supportsPluralLabel ? ['plural_label'] : []),
    'description',
    'sort_order',
    'active',
    'created_at',
    'updated_at',
  ]
  const valuePlaceholders = insertColumns.slice(0, -2).map(() => '?').join(', ')
  const insertBindings: Array<string | number | null> = [
    listKey,
    data.value ?? '',
    data.label ?? '',
    ...(supportsPluralLabel ? [data.plural_label ?? null] : []),
    data.description ?? null,
    nextSortOrder,
    data.active ?? 1,
  ]

  try {
    const result = await c.env.DB.prepare(`
      INSERT INTO managed_list_items (${insertColumns.join(', ')})
      VALUES (${valuePlaceholders}, datetime('now'), datetime('now'))
    `).bind(...insertBindings).run()

    const itemId = result.meta.last_row_id as number
    const item = await c.env.DB.prepare(`SELECT ${managedListSelect(columns)} FROM managed_list_items WHERE id = ?`)
      .bind(itemId)
      .first<ManagedListItemRow>()

    await logAdminAction(c, {
      action: 'create_managed_list_item',
      entity_type: 'managed_list_item',
      entity_id: itemId,
      changes: { list_key: listKey, after: item },
    })

    return c.json({ ok: true, item: item ? formatManagedListItem(item) : null }, 201)
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      return c.json({ error: 'value already exists in this managed list' }, 409)
    }
    throw error
  }
})

// PATCH /api/admin/managed-lists/:listKey/reorder (admin only)
admin.patch('/managed-lists/:listKey/reorder', async (c) => {
  const authErr = await ensureAdmin(c)
  if (authErr) return authErr

  const listKey = adminManagedListKey(c.req.param('listKey'))
  if (!listKey) return c.json({ error: `list_key must be one of ${ADMIN_MANAGED_LIST_KEYS.join(', ')}` }, 400)
  if (!(await hasTable(c.env.DB, 'managed_list_items'))) {
    return c.json({ error: 'managed_list_items is not available in this environment' }, 409)
  }

  let body: unknown
  try {
    body = await c.req.json()
  } catch {
    return c.json({ error: 'Invalid JSON' }, 400)
  }

  const validation = validateManagedListReorderItems(body)
  if (!validation.ok) return c.json({ error: validation.error }, validation.status)
  const reorderItems = validation.value
  const columns = await getTableColumns(c.env.DB, 'managed_list_items')
  const placeholders = reorderItems.map(() => '?').join(', ')
  const { results: existingRows } = await c.env.DB.prepare(`
    SELECT ${managedListSelect(columns)}
    FROM managed_list_items
    WHERE list_key = ?
      AND id IN (${placeholders})
  `).bind(listKey, ...reorderItems.map((item) => item.id)).all<ManagedListItemRow>()

  const existingById = new Map((existingRows ?? []).map((row) => [row.id, row]))
  for (const item of reorderItems) {
    const existing = existingById.get(item.id)
    if (!existing) return c.json({ error: `Managed list item ${item.id} not found` }, 404)
    if (item.version !== null && item.version !== undefined && existing.version !== item.version) {
      return c.json({ error: 'Version conflict', current_version: existing.version, item_id: item.id }, 409)
    }
  }

  await c.env.DB.batch(reorderItems.map((item) => c.env.DB.prepare(`
    UPDATE managed_list_items
    SET sort_order = ?,
        updated_at = datetime('now'),
        version = COALESCE(version, 0) + 1
    WHERE id = ?
      AND list_key = ?
  `).bind(item.sort_order, item.id, listKey)))

  const items = await loadManagedListItems(c.env.DB, listKey, false)

  await logAdminAction(c, {
    action: 'reorder_managed_list_items',
    entity_type: 'managed_list_item',
    changes: {
      list_key: listKey,
      items: reorderItems,
    },
  })

  return c.json({
    ok: true,
    list_key: listKey,
    items: items.map(formatManagedListItem),
  })
})

// PATCH /api/admin/managed-lists/:listKey/:itemId (admin only)
admin.patch('/managed-lists/:listKey/:itemId', async (c) => {
  const authErr = await ensureAdmin(c)
  if (authErr) return authErr

  const listKey = adminManagedListKey(c.req.param('listKey'))
  if (!listKey) return c.json({ error: `list_key must be one of ${ADMIN_MANAGED_LIST_KEYS.join(', ')}` }, 400)
  const itemId = parsePositiveId(c.req.param('itemId'))
  if (itemId === null) return c.json({ error: 'Invalid managed list item id' }, 400)
  if (!(await hasTable(c.env.DB, 'managed_list_items'))) {
    return c.json({ error: 'managed_list_items is not available in this environment' }, 409)
  }

  const columns = await getTableColumns(c.env.DB, 'managed_list_items')
  const existing = await c.env.DB.prepare(`SELECT ${managedListSelect(columns)} FROM managed_list_items WHERE id = ? AND list_key = ?`)
    .bind(itemId, listKey)
    .first<ManagedListItemRow>()
  if (!existing) return c.json({ error: 'Managed list item not found' }, 404)

  let body: Record<string, unknown>
  try {
    body = await c.req.json()
  } catch {
    return c.json({ error: 'Invalid JSON' }, 400)
  }

  const validation = validateManagedListItemMutation(body, existing)
  if (!validation.ok) return c.json({ error: validation.error }, validation.status)
  const data = validation.value
  if (Object.keys(data).length === 0) return c.json({ error: 'At least one managed list item field is required' }, 400)

  const lock = validateOptimisticLock(true, existing.version, requestVersion(c, body))
  if (!lock.ok) return c.json({ error: lock.error, current_version: existing.version }, 409)

  const fields = ['value', 'label', 'plural_label', 'description', 'sort_order', 'active'] as const
  const setClauses: string[] = []
  const bindings: Array<string | number | null> = []
  const before: Record<string, unknown> = {}
  const after: Record<string, unknown> = {}
  for (const field of fields) {
    if (field === 'plural_label' && !columns.has('plural_label')) continue
    if (!hasOwnKey(data, field)) continue
    setClauses.push(`${field} = ?`)
    bindings.push(data[field] ?? null)
    before[field] = existing[field]
    after[field] = data[field] ?? null
  }
  setClauses.push("updated_at = datetime('now')", 'version = COALESCE(version, 0) + 1')

  try {
    const updateResult = await c.env.DB.prepare(`
      UPDATE managed_list_items
      SET ${setClauses.join(', ')}
      WHERE id = ?
        AND list_key = ?
        AND version = ?
    `).bind(...bindings, itemId, listKey, lock.value.expectedVersion).run()
    if (d1ChangeCount(updateResult) === 0) {
      const current = await c.env.DB.prepare('SELECT version FROM managed_list_items WHERE id = ? AND list_key = ?')
        .bind(itemId, listKey)
        .first<{ version: number | null }>()
      return c.json({ error: 'Version conflict', current_version: current?.version ?? existing.version }, 409)
    }
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      return c.json({ error: 'value already exists in this managed list' }, 409)
    }
    throw error
  }

  const item = await c.env.DB.prepare(`SELECT ${managedListSelect(columns)} FROM managed_list_items WHERE id = ? AND list_key = ?`)
    .bind(itemId, listKey)
    .first<ManagedListItemRow>()

  await logAdminAction(c, {
    action: 'update_managed_list_item',
    entity_type: 'managed_list_item',
    entity_id: itemId,
    changes: { list_key: listKey, before, after },
  })

  return c.json({ ok: true, item: item ? formatManagedListItem(item) : null })
})

// DELETE /api/admin/managed-lists/:listKey/:itemId (admin only)
admin.delete('/managed-lists/:listKey/:itemId', async (c) => {
  const authErr = await ensureAdmin(c)
  if (authErr) return authErr

  const listKey = adminManagedListKey(c.req.param('listKey'))
  if (!listKey) return c.json({ error: `list_key must be one of ${ADMIN_MANAGED_LIST_KEYS.join(', ')}` }, 400)
  const itemId = parsePositiveId(c.req.param('itemId'))
  if (itemId === null) return c.json({ error: 'Invalid managed list item id' }, 400)
  if (!(await hasTable(c.env.DB, 'managed_list_items'))) {
    return c.json({ error: 'managed_list_items is not available in this environment' }, 409)
  }

  const columns = await getTableColumns(c.env.DB, 'managed_list_items')
  const existing = await c.env.DB.prepare(`SELECT ${managedListSelect(columns)} FROM managed_list_items WHERE id = ? AND list_key = ?`)
    .bind(itemId, listKey)
    .first<ManagedListItemRow>()
  if (!existing) return c.json({ error: 'Managed list item not found' }, 404)

  const lock = validateOptimisticLock(true, existing.version, requestVersion(c))
  if (!lock.ok) return c.json({ error: lock.error, current_version: existing.version }, 409)

  const updateResult = await c.env.DB.prepare(`
    UPDATE managed_list_items
    SET active = 0,
        updated_at = datetime('now'),
        version = COALESCE(version, 0) + 1
    WHERE id = ?
      AND list_key = ?
      AND version = ?
  `).bind(itemId, listKey, lock.value.expectedVersion).run()
  if (d1ChangeCount(updateResult) === 0) {
    const current = await c.env.DB.prepare('SELECT version FROM managed_list_items WHERE id = ? AND list_key = ?')
      .bind(itemId, listKey)
      .first<{ version: number | null }>()
    return c.json({ error: 'Version conflict', current_version: current?.version ?? existing.version }, 409)
  }

  await logAdminAction(c, {
    action: 'deactivate_managed_list_item',
    entity_type: 'managed_list_item',
    entity_id: itemId,
    changes: { list_key: listKey, before: { active: existing.active }, after: { active: 0 } },
  })

  return c.json({ ok: true })
})

// GET /api/admin/product-rankings (admin only)
admin.get('/product-rankings', async (c) => {
  const authErr = await ensureAuth(c)
  if (authErr) return authErr
  const admErr = requireAdmin(c)
  if (admErr) return admErr
  const { results: rankings } = await c.env.DB.prepare(`
    SELECT pr.*, p.name as product_name
    FROM product_rankings pr
    JOIN products p ON p.id = pr.product_id
    ORDER BY pr.rank_score DESC
  `).all()
  return c.json({ rankings })
})

// PUT /api/admin/product-rankings/:productId (admin only)
admin.put('/product-rankings/:productId', async (c) => {
  const authErr = await ensureAuth(c)
  if (authErr) return authErr
  const admErr = requireAdmin(c)
  if (admErr) return admErr
  const productId = c.req.param('productId')
  const body = await c.req.json()
  if (body.rank_score === undefined) return c.json({ error: 'rank_score erforderlich' }, 400)
  await c.env.DB.prepare(`
    INSERT INTO product_rankings (product_id, rank_score, notes, ranked_at)
    VALUES (?, ?, ?, datetime('now'))
    ON CONFLICT(product_id) DO UPDATE SET
      rank_score = excluded.rank_score,
      notes = COALESCE(excluded.notes, product_rankings.notes),
      ranked_at = datetime('now')
  `).bind(productId, body.rank_score, body.notes ?? null).run()
  await logAdminAction(c, {
    action: 'upsert_product_ranking',
    entity_type: 'product_ranking',
    entity_id: Number(productId),
    changes: { rank_score: body.rank_score, notes: body.notes ?? null },
  })
  return c.json({ ok: true })
})

// GET /api/admin/user-products?status=pending&page=1&limit=50 (admin)
admin.get('/user-products', async (c) => {
  const authErr = await ensureAdmin(c)
  if (authErr) return authErr
  const status = c.req.query('status') ?? 'pending'
  if (!['pending', 'approved', 'rejected', 'blocked'].includes(status)) {
    return c.json({ error: 'Invalid status' }, 400)
  }
  const page = Math.max(1, parsePagination(c.req.query('page'), 1, 100000))
  const limit = Math.max(1, parsePagination(c.req.query('limit'), 50, 100))
  const offset = (page - 1) * limit

  const [totalRow, summaryRow, listResult] = await Promise.all([
    c.env.DB.prepare(`
      SELECT COUNT(*) AS count
      FROM user_products up
      WHERE up.status = ?
    `).bind(status).first<CountRow>(),
    c.env.DB.prepare(`
      SELECT
        COUNT(*) AS total,
        COALESCE(SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END), 0) AS pending,
        COALESCE(SUM(CASE WHEN status = 'approved' THEN 1 ELSE 0 END), 0) AS approved,
        COALESCE(SUM(CASE WHEN status = 'rejected' THEN 1 ELSE 0 END), 0) AS rejected,
        COALESCE(SUM(CASE WHEN status = 'blocked' THEN 1 ELSE 0 END), 0) AS blocked
      FROM user_products
    `).first<Record<'total' | 'pending' | 'approved' | 'rejected' | 'blocked', number>>(),
    c.env.DB.prepare(`
      SELECT up.*, u.email as user_email, u.is_trusted_product_submitter as user_is_trusted_product_submitter
      FROM user_products up
      LEFT JOIN users u ON up.user_id = u.id
      WHERE up.status = ?
      ORDER BY up.created_at DESC, up.id DESC
      LIMIT ? OFFSET ?
    `).bind(status, limit, offset).all(),
  ])

  const products = await attachUserProductIngredients(c.env.DB, (listResult.results ?? []) as Record<string, unknown>[])
  const total = totalRow?.count ?? 0
  const statusSummary = {
    pending: Number(summaryRow?.pending ?? 0),
    approved: Number(summaryRow?.approved ?? 0),
    rejected: Number(summaryRow?.rejected ?? 0),
    blocked: Number(summaryRow?.blocked ?? 0),
  }
  return c.json({
    products,
    total,
    page,
    limit,
    total_pages: Math.max(1, Math.ceil(total / limit)),
    summary: {
      total: Number(summaryRow?.total ?? 0),
      statuses: statusSummary,
    },
    status_summary: statusSummary,
  })
})

// PUT /api/admin/user-products/bulk-approve (admin)
admin.put('/user-products/bulk-approve', async (c) => {
  const authErr = await ensureAdmin(c)
  if (authErr) return authErr

  let body: unknown
  try {
    body = await c.req.json()
  } catch {
    return c.json({ error: 'Invalid JSON' }, 400)
  }

  let rawIds: unknown[] | null = null
  if (Array.isArray(body)) {
    rawIds = body
  } else if (body && typeof body === 'object') {
    const bodyRecord = body as Record<string, unknown>
    rawIds = Array.isArray(bodyRecord.ids) ? bodyRecord.ids : null
  }

  if (!rawIds) return c.json({ error: 'ids array is required' }, 400)
  if (rawIds.length === 0) return c.json({ error: 'ids array must not be empty' }, 400)
  if (rawIds.length > 100) return c.json({ error: 'Bulk approve is limited to 100 ids per request' }, 400)

  const ids: number[] = []
  const seen = new Set<number>()
  for (const rawId of rawIds) {
    const id = normalizeInteger(rawId)
    if (id === undefined || id <= 0) {
      return c.json({ error: 'ids must contain positive integers' }, 400)
    }
    if (!seen.has(id)) {
      seen.add(id)
      ids.push(id)
    }
  }

  const placeholders = ids.map(() => '?').join(', ')
  const { results: existingRows } = await c.env.DB.prepare(`
    SELECT id, status, approved_at
    FROM user_products
    WHERE id IN (${placeholders})
  `).bind(...ids).all<UserProductBulkModerationRow>()

  const existingById = new Map<number, UserProductBulkModerationRow>(
    (existingRows ?? []).map((row) => [row.id, row]),
  )
  const results: UserProductBulkApproveResult[] = []
  let approved = 0

  for (const id of ids) {
    const existing = existingById.get(id)
    if (!existing) {
      results.push({
        id,
        ok: false,
        status: 'failed',
        error: 'not_found',
      })
      continue
    }

    if (existing.status !== 'pending') {
      results.push({
        id,
        ok: false,
        status: 'failed',
        previous_status: existing.status,
        approved_at: existing.approved_at,
        error: 'not_pending',
      })
      continue
    }

    try {
      const updateResult = await c.env.DB.prepare(`
        UPDATE user_products
        SET status = 'approved',
            approved_at = datetime('now')
        WHERE id = ?
          AND status = 'pending'
      `).bind(id).run()

      if (updateResult.meta.changes === 0) {
        const current = await c.env.DB.prepare(`
          SELECT id, status, approved_at
          FROM user_products
          WHERE id = ?
        `).bind(id).first<UserProductBulkModerationRow>()
        results.push({
          id,
          ok: false,
          status: 'failed',
          previous_status: current?.status ?? existing.status,
          approved_at: current?.approved_at ?? existing.approved_at,
          error: current ? 'status_changed' : 'not_found',
        })
        continue
      }

      approved += 1
      results.push({
        id,
        ok: true,
        status: 'approved',
        previous_status: existing.status,
      })
    } catch {
      results.push({
        id,
        ok: false,
        status: 'failed',
        previous_status: existing.status,
        approved_at: existing.approved_at,
        error: 'update_failed',
      })
    }
  }

  const failed = results.length - approved
  await logAdminAction(c, {
    action: 'bulk_approve_user_products',
    entity_type: 'user_product',
    entity_id: null,
    changes: {
      requested: rawIds.length,
      unique: ids.length,
      approved,
      failed,
      ids,
      failed_ids: results.filter((result) => !result.ok).map((result) => result.id),
    },
  })

  return c.json({
    ok: failed === 0,
    requested: rawIds.length,
    unique: ids.length,
    approved,
    failed,
    results,
  })
})

// PUT /api/admin/user-products/:id/approve (admin)
admin.put('/user-products/:id/approve', async (c) => {
  const authErr = await ensureAdmin(c)
  if (authErr) return authErr
  const id = c.req.param('id')
  const result = await c.env.DB.prepare(`
    UPDATE user_products SET status = 'approved', approved_at = datetime('now') WHERE id = ?
  `).bind(id).run()
  if (result.meta.changes === 0) return c.json({ error: 'User product not found' }, 404)
  await logAdminAction(c, {
    action: 'approve_user_product',
    entity_type: 'user_product',
    entity_id: Number(id),
  })
  return c.json({ ok: true })
})

// PUT /api/admin/user-products/:id/publish (admin)
admin.put('/user-products/:id/publish', async (c) => {
  const authErr = await ensureAdmin(c)
  if (authErr) return authErr
  const id = parsePositiveId(c.req.param('id'))
  if (id === null) return c.json({ error: 'Invalid user product id' }, 400)

  let body: Record<string, unknown> = {}
  try {
    const text = await c.req.text()
    body = text.trim().length > 0 ? JSON.parse(text) as Record<string, unknown> : {}
  } catch {
    return c.json({ error: 'Invalid JSON' }, 400)
  }

  const isAffiliate = booleanFlag(body.is_affiliate)
  if (hasOwnKey(body, 'is_affiliate') && isAffiliate === undefined) {
    return c.json({ error: 'is_affiliate must be true/false or 1/0' }, 400)
  }

  const userProduct = await c.env.DB.prepare(
    'SELECT * FROM user_products WHERE id = ?'
  ).bind(id).first<Record<string, unknown>>()
  if (!userProduct) return c.json({ error: 'User product not found' }, 404)

  const sourceUserId = normalizeInteger(userProduct.user_id)
  if (sourceUserId === undefined || sourceUserId <= 0) {
    return c.json({ error: 'User product has no valid owner user id' }, 400)
  }
  const sourceHasShopLink = typeof userProduct.shop_link === 'string' && userProduct.shop_link.trim().length > 0
  const explicitOwnerInput = hasOwnKey(body, 'affiliate_owner_type') || hasOwnKey(body, 'affiliate_owner_user_id')
  let ownership: AffiliateOwnership
  if (explicitOwnerInput) {
    const normalizedOwner = normalizeAffiliateOwnership(body)
    if (!normalizedOwner.ok) return c.json({ error: normalizedOwner.error }, normalizedOwner.status)
    const ownerUser = await validateAffiliateOwnerUser(c.env.DB, normalizedOwner.value)
    if (!ownerUser.ok) return c.json({ error: ownerUser.error }, ownerUser.status)
    ownership = ownerUser.value
  } else {
    const ownerType: AffiliateOwnerType = sourceHasShopLink ? 'user' : isAffiliate === 1 ? 'nick' : 'none'
    ownership = {
      affiliate_owner_type: ownerType,
      affiliate_owner_user_id: ownerType === 'user' ? sourceUserId : null,
      is_affiliate: ownerType === 'none' ? 0 : 1,
    }
  }

  const existingPublishedId = Number(userProduct.published_product_id)
  if (Number.isInteger(existingPublishedId) && existingPublishedId > 0) {
    const existingPayload = await getProductPublishPayloadByProductId(c.env.DB, existingPublishedId)
    if (existingPayload) {
      return c.json({ ok: true, product: existingPayload.product, ingredients: existingPayload.ingredients, idempotent: true })
    }
  }

  const existingSourcePayload = await getProductPublishPayloadBySourceUserProductId(c.env.DB, id)
  if (existingSourcePayload) {
    await c.env.DB.prepare(`
      UPDATE user_products
      SET status = 'approved',
          approved_at = COALESCE(approved_at, datetime('now')),
          published_product_id = ?,
          published_at = COALESCE(published_at, datetime('now'))
      WHERE id = ?
    `).bind(existingSourcePayload.product.id, id).run()
    return c.json({ ok: true, product: existingSourcePayload.product, ingredients: existingSourcePayload.ingredients, idempotent: true })
  }

  const { results: ingredients } = await c.env.DB.prepare(`
    SELECT upi.*, i.name as ingredient_name, i.unit as ingredient_unit,
           parent.name as parent_ingredient_name
    FROM user_product_ingredients upi
    JOIN ingredients i ON i.id = upi.ingredient_id
    LEFT JOIN ingredients parent ON parent.id = upi.parent_ingredient_id
    WHERE upi.user_product_id = ?
    ORDER BY upi.is_main DESC, upi.search_relevant DESC, upi.id ASC
  `).bind(id).all<UserProductIngredientRow>()

  const validationError = await validateUserProductPublish(c.env.DB, ingredients)
  if (validationError) return c.json({ error: validationError }, 400)

  let productId: number
  try {
    const result = await c.env.DB.prepare(`
      INSERT INTO products (
        name, brand, form, price, shop_link, image_url, moderation_status, visibility,
        is_affiliate, affiliate_owner_type, affiliate_owner_user_id,
        serving_size, serving_unit, servings_per_container, container_count,
        dosage_text, warning_title, warning_message,
        warning_type, alternative_note, source_user_product_id
      ) VALUES (?, ?, ?, ?, ?, ?, 'approved', 'public', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      userProduct.name,
      userProduct.brand,
      userProduct.form,
      userProduct.price,
      userProduct.shop_link ?? null,
      userProduct.image_url ?? null,
      ownership.is_affiliate,
      ownership.affiliate_owner_type,
      ownership.affiliate_owner_user_id,
      userProduct.serving_size,
      userProduct.serving_unit,
      userProduct.servings_per_container,
      userProduct.container_count,
      userProduct.dosage_text ?? null,
      userProduct.warning_title ?? null,
      userProduct.warning_message ?? null,
      userProduct.warning_type ?? null,
      userProduct.alternative_note ?? null,
      id,
    ).run()
    productId = result.meta.last_row_id as number
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      const payload = await getProductPublishPayloadBySourceUserProductId(c.env.DB, id)
      if (payload) {
        await c.env.DB.prepare(`
          UPDATE user_products
          SET status = 'approved',
              approved_at = COALESCE(approved_at, datetime('now')),
              published_product_id = ?,
              published_at = COALESCE(published_at, datetime('now'))
          WHERE id = ?
        `).bind(payload.product.id, id).run()
        return c.json({ ok: true, product: payload.product, ingredients: payload.ingredients, idempotent: true })
      }
    }
    throw error
  }

  try {
    await c.env.DB.batch([
      ...ingredients.map((ingredient) => buildProductIngredientInsert(c.env.DB, productId, ingredient)),
      c.env.DB.prepare(`
        UPDATE user_products
        SET status = 'approved',
            approved_at = COALESCE(approved_at, datetime('now')),
            published_product_id = ?,
            published_at = datetime('now')
        WHERE id = ?
      `).bind(productId, id),
    ])
  } catch (error) {
    await c.env.DB.prepare('DELETE FROM products WHERE id = ?').bind(productId).run()
    throw error
  }

  await syncPrimaryProductShopLinkFromProduct(c.env.DB, productId)

  const payload = await getProductPublishPayloadByProductId(c.env.DB, productId)

  await logAdminAction(c, {
    action: 'publish_user_product',
    entity_type: 'user_product',
    entity_id: id,
    changes: { published_product_id: productId, ...ownership },
  })

  return c.json({ ok: true, product: payload?.product ?? null, ingredients: payload?.ingredients ?? [], idempotent: false }, 201)
})

// PUT /api/admin/user-products/:id/reject (admin)
admin.put('/user-products/:id/reject', async (c) => {
  const authErr = await ensureAdmin(c)
  if (authErr) return authErr
  const id = c.req.param('id')
  const result = await c.env.DB.prepare(`
    UPDATE user_products SET status = 'rejected', approved_at = NULL WHERE id = ?
  `).bind(id).run()
  if (result.meta.changes === 0) return c.json({ error: 'User product not found' }, 404)
  await logAdminAction(c, {
    action: 'reject_user_product',
    entity_type: 'user_product',
    entity_id: Number(id),
  })
  return c.json({ ok: true })
})

// DELETE /api/admin/user-products/:id (admin)
admin.delete('/user-products/:id', async (c) => {
  const authErr = await ensureAdmin(c)
  if (authErr) return authErr
  const id = c.req.param('id')
  const result = await c.env.DB.prepare('DELETE FROM user_products WHERE id = ?').bind(id).run()
  if (result.meta.changes === 0) return c.json({ error: 'User product not found' }, 404)
  await logAdminAction(c, {
    action: 'delete_user_product',
    entity_type: 'user_product',
    entity_id: Number(id),
  })
  return c.json({ ok: true })
})

// GET /api/admin/users?q=&role=&trusted=&verified=&page=1&limit=25 (admin)
admin.get('/users', async (c) => {
  const authErr = await ensureAdmin(c)
  if (authErr) return authErr

  const q = optionalText(c.req.query('q'))
  const role = optionalText(c.req.query('role'))
  if (role && !['user', 'admin'].includes(role)) {
    return c.json({ error: 'role must be user or admin' }, 400)
  }

  const trusted = parseBooleanFilter(c.req.query('trusted'))
  if (trusted === null) return c.json({ error: 'trusted must be true or false' }, 400)

  const verified = parseBooleanFilter(c.req.query('verified'))
  if (verified === null) return c.json({ error: 'verified must be true or false' }, 400)

  const blocked = parseBooleanFilter(c.req.query('blocked'))
  if (blocked === null) return c.json({ error: 'blocked must be true or false' }, 400)

  const page = Math.max(1, parsePagination(c.req.query('page'), 1, 100000))
  const limit = parsePagination(c.req.query('limit'), 25, 100)
  const offset = (page - 1) * limit

  const where: string[] = []
  const bindings: Array<string | number> = []

  if (q) {
    where.push('(u.email LIKE ? OR CAST(u.id AS TEXT) = ?)')
    bindings.push(`%${q}%`, q)
  }
  if (role) {
    where.push("COALESCE(u.role, 'user') = ?")
    bindings.push(role)
  }
  if (trusted !== undefined) {
    where.push('u.is_trusted_product_submitter = ?')
    bindings.push(trusted ? 1 : 0)
  }
  if (verified !== undefined) {
    where.push(verified ? 'u.email_verified_at IS NOT NULL' : 'u.email_verified_at IS NULL')
  }
  if (blocked !== undefined) {
    where.push('u.is_blocked_product_submitter = ?')
    bindings.push(blocked ? 1 : 0)
  }

  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : ''
  const hasStackItems = await hasTable(c.env.DB, 'stack_items')
  const hasLinkClicks = await hasTable(c.env.DB, 'product_link_clicks')
  const stackItemSelect = hasStackItems ? 'COALESCE(sic.stack_item_count, 0) AS stack_item_count' : '0 AS stack_item_count'
  const stackItemJoin = hasStackItems
    ? `
    LEFT JOIN (
      SELECT s.user_id, COUNT(si.id) AS stack_item_count
      FROM stacks s
      JOIN stack_items si ON si.stack_id = s.id
      GROUP BY s.user_id
    ) sic ON sic.user_id = u.id`
    : ''
  const linkClickSelect = hasLinkClicks ? 'COALESCE(plc.link_click_count, 0) AS link_click_count' : '0 AS link_click_count'
  const linkClickJoin = hasLinkClicks
    ? `
    LEFT JOIN (
      SELECT user_id, COUNT(*) AS link_click_count
      FROM product_link_clicks
      WHERE user_id IS NOT NULL
      GROUP BY user_id
    ) plc ON plc.user_id = u.id`
    : ''
  const countQuery = `SELECT COUNT(*) AS count FROM users u ${whereSql}`
  const countStmt = c.env.DB.prepare(countQuery)
  const totalRow = bindings.length
    ? await countStmt.bind(...bindings).first<CountRow>()
    : await countStmt.first<CountRow>()

  const listBindings = [...bindings, limit, offset]
  const { results: users } = await c.env.DB.prepare(`
    SELECT
      u.id,
      u.email,
      COALESCE(u.role, 'user') AS role,
      u.created_at,
      u.health_consent,
      u.health_consent_at,
      u.email_verified_at,
      u.deleted_at,
      u.is_trusted_product_submitter,
      u.is_blocked_product_submitter,
      u.product_submission_blocked_at,
      u.product_submission_block_reason,
      COALESCE(sc.stack_count, 0) AS stack_count,
      ${stackItemSelect},
      ${linkClickSelect},
      sc.last_stack_at,
      COALESCE(upc.user_product_count, 0) AS user_product_count,
      COALESCE(upc.pending_user_product_count, 0) AS pending_user_product_count,
      COALESCE(upc.approved_user_product_count, 0) AS approved_user_product_count,
      COALESCE(upc.blocked_user_product_count, 0) AS blocked_user_product_count
    FROM users u
    LEFT JOIN (
      SELECT user_id, COUNT(*) AS stack_count, MAX(created_at) AS last_stack_at
      FROM stacks
      GROUP BY user_id
    ) sc ON sc.user_id = u.id
    ${stackItemJoin}
    ${linkClickJoin}
    LEFT JOIN (
      SELECT
        user_id,
        COUNT(*) AS user_product_count,
        SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) AS pending_user_product_count,
        SUM(CASE WHEN status = 'approved' THEN 1 ELSE 0 END) AS approved_user_product_count,
        SUM(CASE WHEN status = 'blocked' THEN 1 ELSE 0 END) AS blocked_user_product_count
      FROM user_products
      GROUP BY user_id
    ) upc ON upc.user_id = u.id
    ${whereSql}
    ORDER BY u.created_at DESC, u.id DESC
    LIMIT ? OFFSET ?
  `).bind(...listBindings).all<AdminUserRow>()

  const summaryRow = await c.env.DB.prepare(`
    SELECT
      COUNT(*) AS total,
      SUM(CASE WHEN COALESCE(role, 'user') = 'admin' THEN 1 ELSE 0 END) AS admins,
      SUM(CASE WHEN is_trusted_product_submitter = 1 THEN 1 ELSE 0 END) AS trusted,
      SUM(CASE WHEN is_blocked_product_submitter = 1 THEN 1 ELSE 0 END) AS blocked_submitters,
      SUM(CASE WHEN email_verified_at IS NOT NULL THEN 1 ELSE 0 END) AS verified,
      SUM(CASE WHEN email_verified_at IS NULL THEN 1 ELSE 0 END) AS unverified,
      SUM(CASE WHEN deleted_at IS NOT NULL THEN 1 ELSE 0 END) AS deleted
    FROM users
  `).first<{
    total: number
    admins: number | null
    trusted: number | null
    blocked_submitters: number | null
    verified: number | null
    unverified: number | null
    deleted: number | null
  }>()

  return c.json({
    users,
    total: totalRow?.count ?? 0,
    page,
    limit,
    summary: {
      total: summaryRow?.total ?? 0,
      admins: summaryRow?.admins ?? 0,
      trusted: summaryRow?.trusted ?? 0,
      blocked_submitters: summaryRow?.blocked_submitters ?? 0,
      verified: summaryRow?.verified ?? 0,
      unverified: summaryRow?.unverified ?? 0,
      deleted: summaryRow?.deleted ?? 0,
    },
  })
})

// PATCH /api/admin/users/:id (admin)
admin.patch('/users/:id', async (c) => {
  const authErr = await ensureAdmin(c)
  if (authErr) return authErr

  const userId = parsePositiveId(c.req.param('id'))
  if (userId === null) return c.json({ error: 'Invalid user id' }, 400)

  let body: Record<string, unknown>
  try {
    body = await c.req.json()
  } catch {
    return c.json({ error: 'Invalid JSON' }, 400)
  }

  const existing = await c.env.DB.prepare(`
    SELECT id, email, COALESCE(role, 'user') AS role, is_trusted_product_submitter, is_blocked_product_submitter
    FROM users
    WHERE id = ?
  `).bind(userId).first<{
    id: number
    email: string
    role: string
    is_trusted_product_submitter: number
    is_blocked_product_submitter: number
  }>()
  if (!existing) return c.json({ error: 'User not found' }, 404)

  const setClauses: string[] = []
  const values: Array<string | number | null> = []
  const changes: Record<string, { before: string | number; after: string | number }> = {}

  if (hasOwnKey(body, 'role')) {
    if (typeof body.role !== 'string' || !['user', 'admin'].includes(body.role)) {
      return c.json({ error: 'role must be user or admin' }, 400)
    }
    const nextRole = body.role
    const currentUser = c.get('user')
    if (existing.role === 'admin' && nextRole !== 'admin') {
      if (currentUser?.userId === userId) {
        return c.json({ error: 'Admins cannot demote their own account.' }, 400)
      }
      const adminCount = await c.env.DB.prepare(
        `SELECT COUNT(*) AS count FROM users WHERE COALESCE(role, 'user') = 'admin'`
      ).first<CountRow>()
      if ((adminCount?.count ?? 0) <= 1) {
        return c.json({ error: 'Cannot demote the last admin account.' }, 400)
      }
    }
    if (nextRole !== existing.role) {
      setClauses.push('role = ?')
      values.push(nextRole)
      changes.role = { before: existing.role, after: nextRole }
    }
  }

  if (hasOwnKey(body, 'trusted_submitter') || hasOwnKey(body, 'is_trusted_product_submitter')) {
    const rawTrusted = hasOwnKey(body, 'trusted_submitter')
      ? body.trusted_submitter
      : body.is_trusted_product_submitter
    const trusted = parseBooleanMutation(rawTrusted)
    if (trusted === null) return c.json({ error: 'trusted_submitter must be true or false' }, 400)
    const nextTrusted = trusted ? 1 : 0
    if (nextTrusted !== existing.is_trusted_product_submitter) {
      setClauses.push('is_trusted_product_submitter = ?')
      values.push(nextTrusted)
      changes.is_trusted_product_submitter = {
        before: existing.is_trusted_product_submitter,
        after: nextTrusted,
      }
    }
  }

  if (hasOwnKey(body, 'blocked_submitter') || hasOwnKey(body, 'is_blocked_product_submitter')) {
    const rawBlocked = hasOwnKey(body, 'blocked_submitter')
      ? body.blocked_submitter
      : body.is_blocked_product_submitter
    const blockedSubmitter = parseBooleanMutation(rawBlocked)
    if (blockedSubmitter === null) return c.json({ error: 'blocked_submitter must be true or false' }, 400)
    const nextBlocked = blockedSubmitter ? 1 : 0
    if (nextBlocked !== existing.is_blocked_product_submitter) {
      setClauses.push('is_blocked_product_submitter = ?')
      values.push(nextBlocked)
      setClauses.push('product_submission_blocked_at = ?')
      values.push(nextBlocked === 1 ? new Date().toISOString() : null)
      setClauses.push('product_submission_blocked_by_user_id = ?')
      values.push(nextBlocked === 1 ? c.get('user')?.userId ?? null : null)
      setClauses.push('product_submission_block_reason = ?')
      const reason = typeof body.product_submission_block_reason === 'string'
        ? body.product_submission_block_reason.trim().slice(0, 500)
        : ''
      values.push(nextBlocked === 1 ? reason || null : null)
      changes.is_blocked_product_submitter = {
        before: existing.is_blocked_product_submitter,
        after: nextBlocked,
      }
    }
  }

  if (setClauses.length === 0) {
    return c.json({
      ok: true,
      user: {
        id: existing.id,
        email: existing.email,
        role: existing.role,
        is_trusted_product_submitter: existing.is_trusted_product_submitter,
        is_blocked_product_submitter: existing.is_blocked_product_submitter,
      },
      unchanged: true,
    })
  }

  await c.env.DB.prepare(`
    UPDATE users
    SET ${setClauses.join(', ')}
    WHERE id = ?
  `).bind(...values, userId).run()

  await logAdminAction(c, {
    action: 'update_user_admin_fields',
    entity_type: 'user',
    entity_id: userId,
    changes,
  })

  const updated = await c.env.DB.prepare(`
    SELECT id, email, COALESCE(role, 'user') AS role, is_trusted_product_submitter, is_blocked_product_submitter
    FROM users
    WHERE id = ?
  `).bind(userId).first<{
    id: number
    email: string
    role: string
    is_trusted_product_submitter: number
    is_blocked_product_submitter: number
  }>()

  return c.json({ ok: true, user: updated })
})

// PUT /api/admin/users/:id/trusted-product-submitter (admin)
admin.put('/users/:id/trusted-product-submitter', async (c) => {
  const authErr = await ensureAdmin(c)
  if (authErr) return authErr

  const userId = parsePositiveId(c.req.param('id'))
  if (userId === null) return c.json({ error: 'Invalid user id' }, 400)

  let body: Record<string, unknown>
  try {
    body = await c.req.json()
  } catch {
    return c.json({ error: 'Invalid JSON' }, 400)
  }

  const trusted = body.is_trusted_product_submitter === true || body.is_trusted_product_submitter === 1 ? 1 : 0
  const result = await c.env.DB.prepare(
    'UPDATE users SET is_trusted_product_submitter = ? WHERE id = ?'
  ).bind(trusted, userId).run()
  if (result.meta.changes === 0) return c.json({ error: 'User not found' }, 404)

  await logAdminAction(c, {
    action: trusted ? 'trust_product_submitter' : 'untrust_product_submitter',
    entity_type: 'user',
    entity_id: userId,
    changes: { is_trusted_product_submitter: trusted },
  })

  return c.json({ ok: true, user_id: userId, is_trusted_product_submitter: trusted })
})

// GET /api/admin/ingredient-sub-ingredients?parent_ingredient_id=123 (admin)
admin.get('/ingredient-sub-ingredients', async (c) => {
  const authErr = await ensureAdmin(c)
  if (authErr) return authErr

  const parentIngredientIdParam = c.req.query('parent_ingredient_id')
  const parentIngredientId = parentIngredientIdParam ? parsePositiveId(parentIngredientIdParam) : null
  if (parentIngredientIdParam && parentIngredientId === null) {
    return c.json({ error: 'Invalid parent_ingredient_id' }, 400)
  }

  const baseQuery = `
    SELECT
      isi.parent_ingredient_id,
      parent.name AS parent_name,
      parent.unit AS parent_unit,
      isi.child_ingredient_id,
      child.name AS child_name,
      child.unit AS child_unit,
      isi.prompt_label,
      isi.is_default_prompt,
      isi.sort_order,
      isi.created_at
    FROM ingredient_sub_ingredients isi
    JOIN ingredients parent ON parent.id = isi.parent_ingredient_id
    JOIN ingredients child ON child.id = isi.child_ingredient_id
    WHERE (? IS NULL OR isi.parent_ingredient_id = ?)
    ORDER BY parent.name ASC, isi.sort_order ASC, child.name ASC, isi.child_ingredient_id ASC
  `

  const { results } = await c.env.DB.prepare(baseQuery)
    .bind(parentIngredientId, parentIngredientId)
    .all<IngredientSubIngredientAdminRow>()

  return c.json({ mappings: results })
})

// PUT /api/admin/ingredient-sub-ingredients (admin)
admin.put('/ingredient-sub-ingredients', async (c) => {
  const authErr = await ensureAdmin(c)
  if (authErr) return authErr

  let body: Record<string, unknown>
  try {
    body = await c.req.json()
  } catch {
    return c.json({ error: 'Invalid JSON' }, 400)
  }

  const parentIngredientId = normalizeInteger(body.parent_ingredient_id)
  const childIngredientId = normalizeInteger(body.child_ingredient_id)
  if (!parentIngredientId || parentIngredientId <= 0) return c.json({ error: 'parent_ingredient_id must be a positive integer' }, 400)
  if (!childIngredientId || childIngredientId <= 0) return c.json({ error: 'child_ingredient_id must be a positive integer' }, 400)
  if (parentIngredientId === childIngredientId) return c.json({ error: 'parent_ingredient_id and child_ingredient_id must differ' }, 400)

  const sortOrder = hasOwnKey(body, 'sort_order') ? normalizeInteger(body.sort_order) : 0
  if (sortOrder === undefined) return c.json({ error: 'sort_order must be an integer' }, 400)

  const defaultPrompt = hasOwnKey(body, 'is_default_prompt') ? booleanFlag(body.is_default_prompt) : 0
  if (defaultPrompt === undefined) return c.json({ error: 'is_default_prompt must be true/false or 1/0' }, 400)

  const promptLabel = optionalText(body.prompt_label)

  const placeholders = '?,?'
  const ingredientCount = await c.env.DB.prepare(
    `SELECT COUNT(*) AS count FROM ingredients WHERE id IN (${placeholders})`
  ).bind(parentIngredientId, childIngredientId).first<CountRow>()
  if ((ingredientCount?.count ?? 0) !== 2) return c.json({ error: 'Parent or child ingredient not found' }, 404)

  await c.env.DB.prepare(`
    INSERT INTO ingredient_sub_ingredients (
      parent_ingredient_id,
      child_ingredient_id,
      sort_order,
      prompt_label,
      is_default_prompt
    )
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(parent_ingredient_id, child_ingredient_id) DO UPDATE SET
      sort_order = excluded.sort_order,
      prompt_label = excluded.prompt_label,
      is_default_prompt = excluded.is_default_prompt
  `).bind(
    parentIngredientId,
    childIngredientId,
    sortOrder,
    promptLabel,
    defaultPrompt,
  ).run()

  const mapping = await getSubIngredientMapping(c.env.DB, parentIngredientId, childIngredientId)

  await logAdminAction(c, {
    action: 'upsert_ingredient_sub_ingredient',
    entity_type: 'ingredient_sub_ingredient',
    entity_id: parentIngredientId,
    changes: {
      parent_ingredient_id: parentIngredientId,
      child_ingredient_id: childIngredientId,
      sort_order: sortOrder,
      prompt_label: promptLabel,
      is_default_prompt: defaultPrompt,
    },
  })

  return c.json({ mapping })
})

// DELETE /api/admin/ingredient-sub-ingredients/:parentId/:childId (admin)
admin.delete('/ingredient-sub-ingredients/:parentId/:childId', async (c) => {
  const authErr = await ensureAdmin(c)
  if (authErr) return authErr

  const parentIngredientId = parsePositiveId(c.req.param('parentId'))
  const childIngredientId = parsePositiveId(c.req.param('childId'))
  if (parentIngredientId === null || childIngredientId === null) {
    return c.json({ error: 'Invalid mapping ids' }, 400)
  }

  const existing = await getSubIngredientMapping(c.env.DB, parentIngredientId, childIngredientId)
  if (!existing) return c.json({ error: 'Mapping not found' }, 404)

  await c.env.DB.prepare(
    'DELETE FROM ingredient_sub_ingredients WHERE parent_ingredient_id = ? AND child_ingredient_id = ?'
  ).bind(parentIngredientId, childIngredientId).run()

  await logAdminAction(c, {
    action: 'delete_ingredient_sub_ingredient',
    entity_type: 'ingredient_sub_ingredient',
    entity_id: parentIngredientId,
    changes: {
      parent_ingredient_id: parentIngredientId,
      child_ingredient_id: childIngredientId,
      prompt_label: existing.prompt_label,
      is_default_prompt: existing.is_default_prompt,
      sort_order: existing.sort_order,
    },
  })

  return c.json({ ok: true })
})

// GET /api/admin/translations/ingredients?language=de&q=&limit=50&offset=0 (admin)
admin.get('/translations/ingredients', async (c) => {
  const authErr = await ensureAdmin(c)
  if (authErr) return authErr

  const language = normalizeTranslationLanguage(c.req.query('language') ?? 'de')
  if (!language) return c.json({ error: 'Invalid language' }, 400)

  const q = c.req.query('q')?.trim() ?? ''
  const limit = parsePagination(c.req.query('limit'), 50, 100)
  const offset = parsePagination(c.req.query('offset'), 0, 100000)
  const like = `%${q}%`

  const baseQuery = `
    SELECT
      i.id as ingredient_id,
      i.name as source_name,
      i.description as source_description,
      i.hypo_symptoms as source_hypo_symptoms,
      i.hyper_symptoms as source_hyper_symptoms,
      ? as language,
      t.name as name,
      t.description as description,
      t.hypo_symptoms as hypo_symptoms,
      t.hyper_symptoms as hyper_symptoms,
      CASE WHEN t.ingredient_id IS NULL THEN 'missing' ELSE 'translated' END as status
    FROM ingredients i
    LEFT JOIN ingredient_translations t
      ON t.ingredient_id = i.id AND t.language = ?
    WHERE (? = '' OR i.name LIKE ? OR COALESCE(t.name, '') LIKE ?)
    ORDER BY
      CASE WHEN t.ingredient_id IS NULL THEN 0 ELSE 1 END ASC,
      i.name ASC
    LIMIT ? OFFSET ?
  `

  const { results } = await c.env.DB.prepare(baseQuery)
    .bind(language, language, q, like, like, limit, offset)
    .all<IngredientTranslationRow>()

  return c.json({ language, translations: results, limit, offset })
})

// PUT /api/admin/translations/ingredients/:ingredientId/:language (admin)
admin.put('/translations/ingredients/:ingredientId/:language', async (c) => {
  const authErr = await ensureAdmin(c)
  if (authErr) return authErr

  const ingredientId = parsePositiveId(c.req.param('ingredientId'))
  if (ingredientId === null) {
    return c.json({ error: 'Invalid ingredient id' }, 400)
  }

  const language = normalizeTranslationLanguage(c.req.param('language'))
  if (!language) return c.json({ error: 'Invalid language' }, 400)

  const ingredient = await c.env.DB.prepare('SELECT id FROM ingredients WHERE id = ?')
    .bind(ingredientId)
    .first<{ id: number }>()
  if (!ingredient) return c.json({ error: 'Ingredient not found' }, 404)

  let body: Record<string, unknown>
  try {
    body = await c.req.json()
  } catch {
    return c.json({ error: 'Invalid JSON' }, 400)
  }

  const name = optionalText(body.name)
  if (!name) return c.json({ error: 'name is required' }, 400)

  const description = optionalText(body.description)
  const hypoSymptoms = optionalText(body.hypo_symptoms)
  const hyperSymptoms = optionalText(body.hyper_symptoms)

  await c.env.DB.prepare(`
    INSERT INTO ingredient_translations (
      ingredient_id,
      language,
      name,
      description,
      hypo_symptoms,
      hyper_symptoms
    )
    VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(ingredient_id, language) DO UPDATE SET
      name = excluded.name,
      description = excluded.description,
      hypo_symptoms = excluded.hypo_symptoms,
      hyper_symptoms = excluded.hyper_symptoms
  `).bind(
    ingredientId,
    language,
    name,
    description,
    hypoSymptoms,
    hyperSymptoms,
  ).run()

  const translation = await c.env.DB.prepare(`
    SELECT ingredient_id, language, name, description, hypo_symptoms, hyper_symptoms
    FROM ingredient_translations
    WHERE ingredient_id = ? AND language = ?
  `).bind(ingredientId, language).first()

  await logAdminAction(c, {
    action: 'upsert_ingredient_translation',
    entity_type: 'ingredient_translation',
    entity_id: ingredientId,
    changes: {
      ingredient_id: ingredientId,
      language,
      name,
      description,
      hypo_symptoms: hypoSymptoms,
      hyper_symptoms: hyperSymptoms,
    },
  })

  return c.json({ translation })
})

// GET /api/admin/translations/dose-recommendations?language=de&q=&limit=50&offset=0 (admin)
admin.get('/translations/dose-recommendations', async (c) => {
  const authErr = await ensureAdmin(c)
  if (authErr) return authErr

  const language = normalizeTranslationLanguage(c.req.query('language') ?? 'de')
  if (!language) return c.json({ error: 'Invalid language' }, 400)

  const q = c.req.query('q')?.trim() ?? ''
  const limit = parsePagination(c.req.query('limit'), 50, 100)
  const offset = parsePagination(c.req.query('offset'), 0, 100000)
  const like = `%${q}%`

  const { results } = await c.env.DB.prepare(`
    SELECT
      dr.id as dose_recommendation_id,
      i.name as ingredient_name,
      dr.source_type as source_type,
      dr.source_label as base_source_label,
      dr.timing as base_timing,
      dr.context_note as base_context_note,
      dr.dose_min as dose_min,
      dr.dose_max as dose_max,
      dr.unit as unit,
      dr.per_kg_body_weight as per_kg_body_weight,
      dr.per_kg_cap as per_kg_cap,
      dr.population_slug as population_slug,
      dr.purpose as purpose,
      dr.sex_filter as sex_filter,
      dr.is_athlete as is_athlete,
      dr.is_active as is_active,
      ? as language,
      t.source_label as source_label,
      t.timing as timing,
      t.context_note as context_note,
      CASE WHEN t.dose_recommendation_id IS NULL THEN 'missing' ELSE 'translated' END as status
    FROM dose_recommendations dr
    JOIN ingredients i ON i.id = dr.ingredient_id
    LEFT JOIN dose_recommendation_translations t
      ON t.dose_recommendation_id = dr.id AND t.language = ?
    WHERE (
      ? = ''
      OR i.name LIKE ?
      OR dr.source_label LIKE ?
      OR COALESCE(dr.timing, '') LIKE ?
      OR COALESCE(dr.context_note, '') LIKE ?
      OR COALESCE(t.source_label, '') LIKE ?
      OR COALESCE(t.timing, '') LIKE ?
      OR COALESCE(t.context_note, '') LIKE ?
    )
    ORDER BY
      CASE WHEN t.dose_recommendation_id IS NULL THEN 0 ELSE 1 END ASC,
      i.name ASC,
      dr.id ASC
    LIMIT ? OFFSET ?
  `).bind(
    language,
    language,
    q,
    like,
    like,
    like,
    like,
    like,
    like,
    like,
    limit,
    offset,
  ).all<DoseRecommendationTranslationRow>()

  return c.json({ language, translations: results, limit, offset })
})

// PUT /api/admin/translations/dose-recommendations/:doseRecommendationId/:language (admin)
admin.put('/translations/dose-recommendations/:doseRecommendationId/:language', async (c) => {
  const authErr = await ensureAdmin(c)
  if (authErr) return authErr

  const doseRecommendationId = parsePositiveId(c.req.param('doseRecommendationId'))
  if (doseRecommendationId === null) {
    return c.json({ error: 'Invalid dose recommendation id' }, 400)
  }

  const language = normalizeTranslationLanguage(c.req.param('language'))
  if (!language) return c.json({ error: 'Invalid language' }, 400)

  const doseRecommendation = await c.env.DB.prepare('SELECT id FROM dose_recommendations WHERE id = ?')
    .bind(doseRecommendationId)
    .first<{ id: number }>()
  if (!doseRecommendation) return c.json({ error: 'Dose recommendation not found' }, 404)

  let body: Record<string, unknown>
  try {
    body = await c.req.json()
  } catch {
    return c.json({ error: 'Invalid JSON' }, 400)
  }

  const sourceLabel = optionalText(body.source_label)
  const timing = optionalText(body.timing)
  const contextNote = optionalText(body.context_note)

  await c.env.DB.prepare(`
    INSERT INTO dose_recommendation_translations (
      dose_recommendation_id,
      language,
      source_label,
      timing,
      context_note
    )
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(dose_recommendation_id, language) DO UPDATE SET
      source_label = excluded.source_label,
      timing = excluded.timing,
      context_note = excluded.context_note
  `).bind(
    doseRecommendationId,
    language,
    sourceLabel,
    timing,
    contextNote,
  ).run()

  const translation = await c.env.DB.prepare(`
    SELECT dose_recommendation_id, language, source_label, timing, context_note
    FROM dose_recommendation_translations
    WHERE dose_recommendation_id = ? AND language = ?
  `).bind(doseRecommendationId, language).first()

  await logAdminAction(c, {
    action: 'upsert_dose_recommendation_translation',
    entity_type: 'dose_recommendation_translation',
    entity_id: doseRecommendationId,
    changes: {
      dose_recommendation_id: doseRecommendationId,
      language,
      source_label: sourceLabel,
      timing,
      context_note: contextNote,
    },
  })

  return c.json({ translation })
})

// GET /api/admin/translations/verified-profiles?language=de&q=&limit=50&offset=0 (admin)
admin.get('/translations/verified-profiles', async (c) => {
  const authErr = await ensureAdmin(c)
  if (authErr) return authErr

  const language = normalizeTranslationLanguage(c.req.query('language') ?? 'de')
  if (!language) return c.json({ error: 'Invalid language' }, 400)

  const q = c.req.query('q')?.trim() ?? ''
  const limit = parsePagination(c.req.query('limit'), 50, 100)
  const offset = parsePagination(c.req.query('offset'), 0, 100000)
  const like = `%${q}%`

  const { results } = await c.env.DB.prepare(`
    SELECT
      vp.id as verified_profile_id,
      vp.name as base_name,
      vp.slug as base_slug,
      vp.credentials as base_credentials,
      vp.bio as base_bio,
      ? as language,
      t.credentials as credentials,
      t.bio as bio,
      CASE WHEN t.verified_profile_id IS NULL THEN 'missing' ELSE 'translated' END as status
    FROM verified_profiles vp
    LEFT JOIN verified_profile_translations t
      ON t.verified_profile_id = vp.id AND t.language = ?
    WHERE (
      ? = ''
      OR vp.name LIKE ?
      OR vp.slug LIKE ?
      OR COALESCE(vp.credentials, '') LIKE ?
      OR COALESCE(vp.bio, '') LIKE ?
      OR COALESCE(t.credentials, '') LIKE ?
      OR COALESCE(t.bio, '') LIKE ?
    )
    ORDER BY
      CASE WHEN t.verified_profile_id IS NULL THEN 0 ELSE 1 END ASC,
      vp.name ASC
    LIMIT ? OFFSET ?
  `).bind(
    language,
    language,
    q,
    like,
    like,
    like,
    like,
    like,
    like,
    limit,
    offset,
  ).all<VerifiedProfileTranslationRow>()

  return c.json({ language, translations: results, limit, offset })
})

// PUT /api/admin/translations/verified-profiles/:verifiedProfileId/:language (admin)
admin.put('/translations/verified-profiles/:verifiedProfileId/:language', async (c) => {
  const authErr = await ensureAdmin(c)
  if (authErr) return authErr

  const verifiedProfileId = parsePositiveId(c.req.param('verifiedProfileId'))
  if (verifiedProfileId === null) {
    return c.json({ error: 'Invalid verified profile id' }, 400)
  }

  const language = normalizeTranslationLanguage(c.req.param('language'))
  if (!language) return c.json({ error: 'Invalid language' }, 400)

  const verifiedProfile = await c.env.DB.prepare('SELECT id FROM verified_profiles WHERE id = ?')
    .bind(verifiedProfileId)
    .first<{ id: number }>()
  if (!verifiedProfile) return c.json({ error: 'Verified profile not found' }, 404)

  let body: Record<string, unknown>
  try {
    body = await c.req.json()
  } catch {
    return c.json({ error: 'Invalid JSON' }, 400)
  }

  const bio = optionalText(body.bio)
  const credentials = optionalText(body.credentials)

  await c.env.DB.prepare(`
    INSERT INTO verified_profile_translations (
      verified_profile_id,
      language,
      bio,
      credentials
    )
    VALUES (?, ?, ?, ?)
    ON CONFLICT(verified_profile_id, language) DO UPDATE SET
      bio = excluded.bio,
      credentials = excluded.credentials
  `).bind(
    verifiedProfileId,
    language,
    bio,
    credentials,
  ).run()

  const translation = await c.env.DB.prepare(`
    SELECT verified_profile_id, language, bio, credentials
    FROM verified_profile_translations
    WHERE verified_profile_id = ? AND language = ?
  `).bind(verifiedProfileId, language).first()

  await logAdminAction(c, {
    action: 'upsert_verified_profile_translation',
    entity_type: 'verified_profile_translation',
    entity_id: verifiedProfileId,
    changes: {
      verified_profile_id: verifiedProfileId,
      language,
      bio,
      credentials,
    },
  })

  return c.json({ translation })
})

// GET /api/admin/translations/blog-posts?language=de&q=&limit=50&offset=0 (admin)
admin.get('/translations/blog-posts', async (c) => {
  const authErr = await ensureAdmin(c)
  if (authErr) return authErr

  const language = normalizeTranslationLanguage(c.req.query('language') ?? 'de')
  if (!language) return c.json({ error: 'Invalid language' }, 400)

  const q = c.req.query('q')?.trim() ?? ''
  const limit = parsePagination(c.req.query('limit'), 50, 100)
  const offset = parsePagination(c.req.query('offset'), 0, 100000)
  const like = `%${q}%`

  const { results } = await c.env.DB.prepare(`
    SELECT
      bp.id as blog_post_id,
      bp.r2_key as r2_key,
      bp.status as post_status,
      bp.published_at as published_at,
      ? as language,
      t.title as title,
      t.slug as slug,
      t.excerpt as excerpt,
      t.meta_description as meta_description,
      CASE WHEN t.blog_post_id IS NULL THEN 'missing' ELSE 'translated' END as status
    FROM blog_posts bp
    LEFT JOIN blog_translations t
      ON t.blog_post_id = bp.id AND t.language = ?
    WHERE (
      ? = ''
      OR bp.r2_key LIKE ?
      OR bp.status LIKE ?
      OR COALESCE(t.title, '') LIKE ?
      OR COALESCE(t.slug, '') LIKE ?
      OR COALESCE(t.excerpt, '') LIKE ?
      OR COALESCE(t.meta_description, '') LIKE ?
    )
    ORDER BY
      CASE WHEN t.blog_post_id IS NULL THEN 0 ELSE 1 END ASC,
      COALESCE(bp.published_at, bp.updated_at, bp.created_at) DESC,
      bp.id DESC
    LIMIT ? OFFSET ?
  `).bind(
    language,
    language,
    q,
    like,
    like,
    like,
    like,
    like,
    like,
    limit,
    offset,
  ).all<BlogTranslationRow>()

  return c.json({ language, translations: results, limit, offset })
})

// PUT /api/admin/translations/blog-posts/:blogPostId/:language (admin)
admin.put('/translations/blog-posts/:blogPostId/:language', async (c) => {
  const authErr = await ensureAdmin(c)
  if (authErr) return authErr

  const blogPostId = parsePositiveId(c.req.param('blogPostId'))
  if (blogPostId === null) {
    return c.json({ error: 'Invalid blog post id' }, 400)
  }

  const language = normalizeTranslationLanguage(c.req.param('language'))
  if (!language) return c.json({ error: 'Invalid language' }, 400)

  const blogPost = await c.env.DB.prepare('SELECT id FROM blog_posts WHERE id = ?')
    .bind(blogPostId)
    .first<{ id: number }>()
  if (!blogPost) return c.json({ error: 'Blog post not found' }, 404)

  let body: Record<string, unknown>
  try {
    body = await c.req.json()
  } catch {
    return c.json({ error: 'Invalid JSON' }, 400)
  }

  const title = optionalText(body.title)
  if (!title) return c.json({ error: 'title is required' }, 400)

  const slug = normalizeSlug(body.slug)
  if (!slug) {
    return c.json({ error: 'slug must use lowercase letters, numbers, and single hyphens only' }, 400)
  }

  const existingSlug = await c.env.DB.prepare(`
    SELECT blog_post_id
    FROM blog_translations
    WHERE language = ? AND slug = ? AND blog_post_id <> ?
  `).bind(language, slug, blogPostId).first<{ blog_post_id: number }>()
  if (existingSlug) {
    return c.json({ error: `Slug "${slug}" is already used for ${language}.` }, 409)
  }

  const excerpt = optionalText(body.excerpt)
  const metaDescription = optionalText(body.meta_description)

  try {
    await c.env.DB.prepare(`
      INSERT INTO blog_translations (
        blog_post_id,
        language,
        title,
        slug,
        excerpt,
        meta_description
      )
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(blog_post_id, language) DO UPDATE SET
        title = excluded.title,
        slug = excluded.slug,
        excerpt = excluded.excerpt,
        meta_description = excluded.meta_description
    `).bind(
      blogPostId,
      language,
      title,
      slug,
      excerpt,
      metaDescription,
    ).run()
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      return c.json({ error: `Slug "${slug}" is already used for ${language}.` }, 409)
    }
    throw error
  }

  const translation = await c.env.DB.prepare(`
    SELECT blog_post_id, language, title, slug, excerpt, meta_description
    FROM blog_translations
    WHERE blog_post_id = ? AND language = ?
  `).bind(blogPostId, language).first()

  await logAdminAction(c, {
    action: 'upsert_blog_translation',
    entity_type: 'blog_translation',
    entity_id: blogPostId,
    changes: {
      blog_post_id: blogPostId,
      language,
      title,
      slug,
      excerpt,
      meta_description: metaDescription,
    },
  })

  return c.json({ translation })
})

export default admin

// ---------------------------------------------------------------------------
// Shop domains public sub-app (mounted at /api/shop-domains)
// ---------------------------------------------------------------------------

export const shopDomainsPublicApp = new Hono<AppContext>()

// GET /api/shop-domains/resolve?url=... (public)
shopDomainsPublicApp.get('/resolve', async (c) => {
  const url = c.req.query('url') || ''
  if (!url) return c.json({ shop_name: null, button_text: 'Jetzt kaufen' })
  const hostname = normalizeShopHostname(url)
  if (!hostname) return c.json({ shop_name: null, button_text: 'Jetzt kaufen' })
  const { results: shops } = await c.env.DB.prepare('SELECT domain, display_name FROM shop_domains').all<{ domain: string; display_name: string }>()
  const match = shops.find((shop) => {
    const domain = normalizeShopHostname(shop.domain)
    return domain ? shopHostMatchesDomain(hostname, domain) : false
  })
  if (!match) return c.json({ shop_name: null, button_text: 'Jetzt kaufen' })
  return c.json({ shop_name: match.display_name, button_text: `Bei ${match.display_name} kaufen` })
})

// GET /api/shop-domains (public — for client-side URL matching)
shopDomainsPublicApp.get('/', async (c) => {
  const { results: shops } = await c.env.DB.prepare(
    'SELECT id, domain, display_name FROM shop_domains ORDER BY display_name ASC'
  ).all()
  return c.json({ shops })
})

// ---------------------------------------------------------------------------
// Interactions sub-app (mounted at /api/interactions)
// ---------------------------------------------------------------------------

export const interactionsApp = new Hono<AppContext>()

const INTERACTION_PARTNER_TYPES = ['ingredient', 'food', 'medication', 'condition'] as const
type InteractionPartnerType = (typeof INTERACTION_PARTNER_TYPES)[number]
const INTERACTION_SEVERITIES = ['info', 'medium', 'high', 'danger'] as const
type InteractionSeverity = (typeof INTERACTION_SEVERITIES)[number]
type InteractionTypeValue = 'avoid' | 'caution' | 'danger' | string

function severityFromLegacyInteractionType(type: InteractionTypeValue): InteractionSeverity {
  if (type === 'danger') return 'danger'
  if (type === 'avoid') return 'high'
  if (type === 'caution') return 'medium'
  return 'medium'
}

type InteractionAdminRow = {
  id: number
  ingredient_id: number
  partner_type: InteractionPartnerType
  partner_ingredient_id: number | null
  partner_label: string | null
  type: InteractionTypeValue | null
  severity: InteractionSeverity | null
  mechanism: string | null
  comment: string | null
  source_url: string | null
  source_label: string | null
  is_active: number
  version: number | null
  ingredient_a_name: string
  ingredient_b_name: string | null
}

type InteractionMutation = {
  ingredient_id: number
  partner_type: InteractionPartnerType
  partner_ingredient_id: number | null
  partner_label: string | null
  type: InteractionTypeValue
  severity: InteractionSeverity
  mechanism: string | null
  comment: string | null
  source_url: string | null
  source_label: string | null
  is_active: number
}

function formatAdminInteraction(row: InteractionAdminRow) {
  return {
    ...row,
    ingredient_a_id: row.ingredient_id,
    ingredient_b_id: row.partner_type === 'ingredient' ? row.partner_ingredient_id : null,
    ingredient_b_name: row.partner_type === 'ingredient'
      ? row.ingredient_b_name
      : row.partner_label ?? row.ingredient_b_name,
  }
}

async function loadAdminInteractionById(
  db: D1Database,
  id: number,
  columns?: Set<string>,
): Promise<InteractionAdminRow | null> {
  const interactionColumns = columns ?? await getTableColumns(db, 'interactions')
  return db.prepare(`
    SELECT
      ix.id,
      ix.ingredient_id,
      ix.partner_type,
      ix.partner_ingredient_id,
      ix.partner_label,
      ix.type,
      ix.severity,
      ix.mechanism,
      ix.comment,
      ix.source_url,
      ix.source_label,
      ix.is_active,
      ${versionSelect(interactionColumns, 'ix')},
      ia.name AS ingredient_a_name,
      COALESCE(ib.name, ix.partner_label) AS ingredient_b_name
    FROM interactions ix
    JOIN ingredients ia ON ia.id = ix.ingredient_id
    LEFT JOIN ingredients ib ON ib.id = ix.partner_ingredient_id
    WHERE ix.id = ?
  `).bind(id).first<InteractionAdminRow>()
}

function validateInteractionMutation(
  data: Record<string, unknown>,
  existing: InteractionAdminRow,
): ValidationResult<InteractionMutation> {
  const rawIngredientId = hasOwnKey(data, 'ingredient_id')
    ? data.ingredient_id
    : hasOwnKey(data, 'ingredient_a_id')
      ? data.ingredient_a_id
      : existing.ingredient_id
  const ingredientId = normalizeInteger(rawIngredientId)
  if (ingredientId === undefined || ingredientId <= 0) {
    return validationError('ingredient_id must be a positive integer')
  }

  const rawPartnerType = hasOwnKey(data, 'partner_type') ? data.partner_type : existing.partner_type
  const partnerType = enumValue(rawPartnerType, INTERACTION_PARTNER_TYPES)
  if (!partnerType) {
    return validationError(`partner_type must be one of: ${INTERACTION_PARTNER_TYPES.join(', ')}`)
  }

  let partnerIngredientId: number | null = null
  let partnerLabel: string | null = null
  if (partnerType === 'ingredient') {
    const rawPartnerIngredientId = hasOwnKey(data, 'partner_ingredient_id')
      ? data.partner_ingredient_id
      : hasOwnKey(data, 'ingredient_b_id')
        ? data.ingredient_b_id
        : existing.partner_type === 'ingredient'
          ? existing.partner_ingredient_id
          : undefined
    const parsedPartnerIngredientId = normalizeInteger(rawPartnerIngredientId)
    if (parsedPartnerIngredientId === undefined || parsedPartnerIngredientId <= 0) {
      return validationError('partner_ingredient_id must be a positive integer')
    }
    if (parsedPartnerIngredientId === ingredientId) {
      return validationError('ingredient_id and partner_ingredient_id must not be identical')
    }
    partnerIngredientId = parsedPartnerIngredientId
  } else {
    const partnerLabelResult = hasOwnKey(data, 'partner_label')
      ? requiredTextField(data, 'partner_label', 250)
      : existing.partner_type === partnerType && existing.partner_label
        ? { ok: true as const, value: existing.partner_label }
        : validationError('partner_label is required')
    if (!partnerLabelResult.ok) return partnerLabelResult
    partnerLabel = partnerLabelResult.value
  }

  let interactionType: InteractionTypeValue
  if (hasOwnKey(data, 'type')) {
    const interactionTypeResult = optionalTextField(data, 'type', 120)
    if (!interactionTypeResult.ok) return interactionTypeResult
    if (interactionTypeResult.value === null || interactionTypeResult.value === undefined) {
      return validationError('type must be a non-empty string')
    }
    interactionType = interactionTypeResult.value
  } else {
    interactionType = existing.type ?? 'avoid'
  }

  const severity = hasOwnKey(data, 'severity')
    ? enumValue(data.severity, INTERACTION_SEVERITIES)
    : existing.severity && INTERACTION_SEVERITIES.includes(existing.severity)
      ? existing.severity
      : severityFromLegacyInteractionType(interactionType)
  if (!severity) {
    return validationError(`severity must be one of: ${INTERACTION_SEVERITIES.join(', ')}`)
  }

  const commentResult = optionalTextField(data, 'comment', 2000)
  if (!commentResult.ok) return commentResult

  const mechanismResult = optionalTextField(data, 'mechanism', 2000)
  if (!mechanismResult.ok) return mechanismResult

  const sourceUrlResult = normalizeSourceUrl(hasOwnKey(data, 'source_url') ? data.source_url : undefined)
  if (!sourceUrlResult.ok) return sourceUrlResult

  const sourceLabelResult = optionalTextField(data, 'source_label', 250)
  if (!sourceLabelResult.ok) return sourceLabelResult

  const isActiveResult = optionalBooleanField(data, 'is_active')
  if (!isActiveResult.ok) return isActiveResult

  return {
    ok: true,
    value: {
      ingredient_id: ingredientId,
      partner_type: partnerType,
      partner_ingredient_id: partnerIngredientId,
      partner_label: partnerLabel,
      type: interactionType,
      severity,
      mechanism: mechanismResult.value === undefined ? existing.mechanism : mechanismResult.value,
      comment: commentResult.value === undefined ? existing.comment : commentResult.value,
      source_url: sourceUrlResult.value === undefined ? existing.source_url : sourceUrlResult.value,
      source_label: sourceLabelResult.value === undefined ? existing.source_label : sourceLabelResult.value,
      is_active: isActiveResult.value ?? existing.is_active,
    },
  }
}

// GET /api/admin/interactions/:id (admin only)
admin.get('/interactions/:id', async (c) => {
  const authErr = await ensureAdmin(c)
  if (authErr) return authErr

  const id = parsePositiveId(c.req.param('id'))
  if (id === null) return c.json({ error: 'Invalid interaction id' }, 400)

  const interaction = await loadAdminInteractionById(c.env.DB, id)
  if (!interaction) return c.json({ error: 'Interaction not found' }, 404)

  return c.json({ interaction: formatAdminInteraction(interaction) })
})

// PUT /api/admin/interactions/:id (admin only)
admin.put('/interactions/:id', async (c) => {
  const authErr = await ensureAdmin(c)
  if (authErr) return authErr

  const id = parsePositiveId(c.req.param('id'))
  if (id === null) return c.json({ error: 'Invalid interaction id' }, 400)

  let body: Record<string, unknown>
  try {
    body = await c.req.json()
  } catch {
    return c.json({ error: 'Invalid JSON' }, 400)
  }

  const columns = await getTableColumns(c.env.DB, 'interactions')
  const existing = await loadAdminInteractionById(c.env.DB, id, columns)
  if (!existing) return c.json({ error: 'Interaction not found' }, 404)

  const lock = validateOptimisticLock(columns.has('version'), existing.version, requestVersion(c, body))
  if (!lock.ok) return c.json({ error: lock.error, current_version: existing.version }, 409)

  const validation = validateInteractionMutation(body, existing)
  if (!validation.ok) return c.json({ error: validation.error }, validation.status)
  const data = validation.value

  const ingredient = await c.env.DB.prepare('SELECT id FROM ingredients WHERE id = ?')
    .bind(data.ingredient_id)
    .first<{ id: number }>()
  if (!ingredient) return c.json({ error: 'Ingredient not found' }, 404)

  if (data.partner_type === 'ingredient') {
    const partnerIngredient = await c.env.DB.prepare('SELECT id FROM ingredients WHERE id = ?')
      .bind(data.partner_ingredient_id)
      .first<{ id: number }>()
    if (!partnerIngredient) return c.json({ error: 'Partner ingredient not found' }, 404)
  }

  const versionSet = lock.value.enforce ? ', version = COALESCE(version, 0) + 1' : ''
  const whereSql = lock.value.enforce ? 'id = ? AND version = ?' : 'id = ?'
  const bindings: Array<string | number | null> = [
    data.ingredient_id,
    data.partner_type,
    data.partner_ingredient_id,
    data.partner_label,
    data.type,
    data.severity,
    data.mechanism,
    data.comment,
    data.source_url,
    data.source_label,
    data.is_active,
    id,
  ]
  if (lock.value.enforce) bindings.push(lock.value.expectedVersion)

  let updateResult: D1Result
  try {
    updateResult = await c.env.DB.prepare(`
      UPDATE interactions
      SET ingredient_id = ?,
          partner_type = ?,
          partner_ingredient_id = ?,
          partner_label = ?,
          type = ?,
          severity = ?,
          mechanism = ?,
          comment = ?,
          source_url = ?,
          source_label = ?,
          is_active = ?${versionSet}
      WHERE ${whereSql}
    `).bind(...bindings).run()
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      return c.json({ error: 'Interaction relation already exists' }, 409)
    }
    throw error
  }

  if (lock.value.enforce && d1ChangeCount(updateResult) === 0) {
    const current = await loadAdminInteractionById(c.env.DB, id, columns)
    return c.json({ error: 'Version conflict', current_version: current?.version ?? existing.version }, 409)
  }

  const updated = await loadAdminInteractionById(c.env.DB, id, columns)
  if (!updated) return c.json({ error: 'Interaction not found after update' }, 404)

  await logAdminAction(c, {
    action: 'update_interaction',
    entity_type: 'interaction',
    entity_id: id,
    changes: {
      before: {
        ingredient_id: existing.ingredient_id,
        partner_type: existing.partner_type,
        partner_ingredient_id: existing.partner_ingredient_id,
        partner_label: existing.partner_label,
        type: existing.type,
        severity: existing.severity,
        mechanism: existing.mechanism,
        comment: existing.comment,
        source_url: existing.source_url,
        source_label: existing.source_label,
        is_active: existing.is_active,
        version: existing.version,
      },
      after: {
        ...data,
        version: updated.version,
      },
    },
  })

  return c.json({ interaction: formatAdminInteraction(updated) })
})

// DELETE /api/admin/interactions/:id (admin only)
admin.delete('/interactions/:id', async (c) => {
  const authErr = await ensureAdmin(c)
  if (authErr) return authErr

  const id = parsePositiveId(c.req.param('id'))
  if (id === null) return c.json({ error: 'Invalid interaction id' }, 400)

  const columns = await getTableColumns(c.env.DB, 'interactions')
  const interaction = await loadAdminInteractionById(c.env.DB, id, columns)
  if (!interaction) return c.json({ error: 'Interaction not found' }, 404)

  const expectedVersion = await requestVersionFromRequest(c)
  const lock = validateOptimisticLock(columns.has('version'), interaction.version, expectedVersion)
  if (!lock.ok) return c.json({ error: lock.error, current_version: interaction.version }, 409)

  const deleteResult = lock.value.enforce
    ? await c.env.DB.prepare('DELETE FROM interactions WHERE id = ? AND version = ?')
      .bind(id, lock.value.expectedVersion)
      .run()
    : await c.env.DB.prepare('DELETE FROM interactions WHERE id = ?').bind(id).run()
  if (lock.value.enforce && d1ChangeCount(deleteResult) === 0) {
    const current = await loadAdminInteractionById(c.env.DB, id, columns)
    return c.json({ error: 'Version conflict', current_version: current?.version ?? interaction.version }, 409)
  }

  await logAdminAction(c, {
    action: 'delete_interaction',
    entity_type: 'interaction',
    entity_id: id,
    changes: {
      before: formatAdminInteraction(interaction),
    },
  })

  return c.json({ ok: true })
})

// GET /api/interactions
interactionsApp.get('/', async (c) => {
  const authErr = await ensureAdmin(c)
  if (authErr) return authErr

  const columns = await getTableColumns(c.env.DB, 'interactions')
  const ingredientFilter = c.req.query('ingredient_id')
  const ingredientId = ingredientFilter === undefined ? null : parsePositiveId(ingredientFilter)
  if (ingredientFilter !== undefined && ingredientId === null) {
    return c.json({ error: 'Invalid ingredient_id' }, 400)
  }

  const filterSql = ingredientId === null
    ? ''
    : 'WHERE ix.ingredient_id = ? OR ix.partner_ingredient_id = ?'
  const stmt = c.env.DB.prepare(`
    SELECT
      ix.id,
      ix.ingredient_id,
      ix.partner_type,
      ix.partner_ingredient_id,
      ix.partner_label,
      ix.type,
      ix.severity,
      ix.mechanism,
      ix.comment,
      ix.source_url,
      ix.source_label,
      ix.is_active,
      ${versionSelect(columns, 'ix')},
      ia.name AS ingredient_a_name,
      COALESCE(ib.name, ix.partner_label) AS ingredient_b_name,
      ix.ingredient_id AS ingredient_a_id,
      CASE
        WHEN ix.partner_type = 'ingredient' THEN ix.partner_ingredient_id
        ELSE NULL
      END AS ingredient_b_id
    FROM interactions ix
    JOIN ingredients ia ON ia.id = ix.ingredient_id
    LEFT JOIN ingredients ib ON ib.id = ix.partner_ingredient_id
    ${filterSql}
    ORDER BY ix.id DESC
  `)
  const { results: interactions } = ingredientId === null
    ? await stmt.all()
    : await stmt.bind(ingredientId, ingredientId).all()
  return c.json({ interactions })
})

// POST /api/interactions (admin only)
interactionsApp.post('/', async (c) => {
  const authErr = await ensureAdmin(c)
  if (authErr) return authErr
  let data: Record<string, unknown>
  try {
    data = await c.req.json()
  } catch {
    return c.json({ error: 'Invalid JSON' }, 400)
  }

  const rawIngredientId = hasOwnKey(data, 'ingredient_id') ? data.ingredient_id : data.ingredient_a_id
  const ingredientId = normalizeInteger(rawIngredientId)
  if (ingredientId === undefined || ingredientId <= 0) {
    return c.json({ error: 'ingredient_id is required and must be a positive integer' }, 400)
  }

  const rawPartnerType = data.partner_type
  const partnerType = hasOwnKey(data, 'partner_type')
    ? enumValue(rawPartnerType, INTERACTION_PARTNER_TYPES)
    : 'ingredient'
  if (rawPartnerType !== undefined && !partnerType) {
    return c.json({ error: `partner_type must be one of: ${INTERACTION_PARTNER_TYPES.join(', ')}` }, 400)
  }

  let partnerIngredientId: number | null = null
  let partnerLabel: string | null = null

  if (partnerType === 'ingredient') {
    const rawPartnerIngredientId = hasOwnKey(data, 'partner_ingredient_id')
      ? data.partner_ingredient_id
      : data.ingredient_b_id
    const parsedPartnerIngredientId = normalizeInteger(rawPartnerIngredientId)
    if (!hasOwnKey(data, 'partner_ingredient_id') && !hasOwnKey(data, 'ingredient_b_id')) {
      return c.json({ error: 'partner_ingredient_id is required for ingredient partner_type' }, 400)
    }
    if (parsedPartnerIngredientId === undefined || parsedPartnerIngredientId <= 0) {
      return c.json({ error: 'partner_ingredient_id must be a positive integer' }, 400)
    }
    if (parsedPartnerIngredientId === ingredientId) {
      return c.json({ error: 'ingredient_id and partner_ingredient_id must not be identical' }, 400)
    }
    partnerIngredientId = parsedPartnerIngredientId
  } else {
    const partnerLabelResult = requiredTextField(data, 'partner_label', 250)
    if (!partnerLabelResult.ok) return c.json({ error: partnerLabelResult.error }, 400)
    partnerLabel = partnerLabelResult.value
  }

  let interactionType: InteractionTypeValue
  if (hasOwnKey(data, 'type')) {
    const interactionTypeResult = optionalTextField(data, 'type', 120)
    if (!interactionTypeResult.ok) return c.json({ error: interactionTypeResult.error }, 400)
    if (interactionTypeResult.value === null || interactionTypeResult.value === undefined) {
      return c.json({ error: 'type must be a non-empty string' }, 400)
    }
    interactionType = interactionTypeResult.value
  } else {
    interactionType = 'avoid'
  }

  const rawSeverity = data.severity
  const severity = hasOwnKey(data, 'severity')
    ? enumValue(rawSeverity, INTERACTION_SEVERITIES)
    : severityFromLegacyInteractionType(interactionType)
  if (rawSeverity !== undefined && !severity) {
    return c.json({ error: `severity must be one of: ${INTERACTION_SEVERITIES.join(', ')}` }, 400)
  }

  const commentResult = optionalTextField(data, 'comment', 2000)
  if (!commentResult.ok) return c.json({ error: commentResult.error }, 400)

  const mechanismResult = optionalTextField(data, 'mechanism', 2000)
  if (!mechanismResult.ok) return c.json({ error: mechanismResult.error }, 400)

  const sourceUrlResult = normalizeSourceUrl(data.source_url)
  if (!sourceUrlResult.ok) return c.json({ error: sourceUrlResult.error }, 400)

  const sourceLabelResult = optionalTextField(data, 'source_label', 250)
  if (!sourceLabelResult.ok) return c.json({ error: sourceLabelResult.error }, 400)

  const isActiveResult = optionalBooleanField(data, 'is_active')
  if (!isActiveResult.ok) return c.json({ error: isActiveResult.error }, 400)
  const isActive = isActiveResult.value ?? 1
  const mechanism = mechanismResult.value ?? null
  const comment = commentResult.value ?? null
  const sourceUrl = sourceUrlResult.value ?? null
  const sourceLabel = sourceLabelResult.value ?? null
  const columns = await getTableColumns(c.env.DB, 'interactions')
  const rawInteractionId = hasOwnKey(data, 'id') ? normalizeInteger(data.id) : undefined
  if (hasOwnKey(data, 'id') && (rawInteractionId === undefined || rawInteractionId <= 0)) {
    return c.json({ error: 'id must be a positive integer' }, 400)
  }
  const existing = await c.env.DB.prepare(`
    SELECT
      id,
      ${versionSelect(columns)}
    FROM interactions
    WHERE ingredient_id = ?
      AND partner_type = ?
      AND COALESCE(partner_ingredient_id, -1) = COALESCE(?, -1)
      AND COALESCE(partner_label, '_') = COALESCE(?, '_')
    ORDER BY id DESC
    LIMIT 1
  `).bind(
    ingredientId,
    partnerType,
    partnerIngredientId,
    partnerLabel,
  ).first<{ id: number; version: number | null }>()
  if (columns.has('version') && existing && rawInteractionId !== undefined && rawInteractionId !== existing.id) {
    return c.json({ error: 'Version conflict', current_version: existing.version }, 409)
  }
  const shouldLockExisting = Boolean(columns.has('version') && existing && (rawInteractionId !== undefined || hasOwnKey(data, 'version')))
  const lock = shouldLockExisting
    ? validateOptimisticLock(true, existing?.version ?? null, requestVersion(c, data))
    : { ok: true as const, value: { enforce: false, expectedVersion: null } }
  if (!lock.ok) return c.json({ error: lock.error, current_version: existing?.version ?? null }, 409)
  const versionSet = columns.has('version') ? ', version = COALESCE(interactions.version, 0) + 1' : ''
  const conflictWhere = lock.value.enforce ? ' WHERE interactions.version = ?' : ''
  const upsertBindings: Array<string | number | null> = [
    ingredientId,
    partnerType,
    partnerIngredientId,
    partnerLabel,
    interactionType,
    severity,
    mechanism,
    comment,
    sourceUrl,
    sourceLabel,
    isActive,
  ]
  if (lock.value.enforce) upsertBindings.push(lock.value.expectedVersion)

  const upsertResult = await c.env.DB.prepare(`
    INSERT INTO interactions (
      ingredient_id,
      partner_type,
      partner_ingredient_id,
      partner_label,
      type,
      severity,
      mechanism,
      comment,
      source_url,
      source_label,
      is_active
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(
      ingredient_id,
      partner_type,
      COALESCE(partner_ingredient_id, -1),
      COALESCE(partner_label, '_')
    ) DO UPDATE SET
      type = excluded.type,
      severity = excluded.severity,
      mechanism = excluded.mechanism,
      comment = excluded.comment,
      source_url = excluded.source_url,
      source_label = excluded.source_label,
      is_active = excluded.is_active${versionSet}${conflictWhere}
  `).bind(...upsertBindings).run()
  if (lock.value.enforce && d1ChangeCount(upsertResult) === 0) {
    const current = await c.env.DB.prepare(`
      SELECT ${versionSelect(columns)}
      FROM interactions
      WHERE id = ?
    `).bind(existing?.id ?? rawInteractionId).first<{ version: number | null }>()
    return c.json({ error: 'Version conflict', current_version: current?.version ?? existing?.version ?? null }, 409)
  }

  const { results: interactions } = await c.env.DB.prepare(`
    SELECT
      ix.id,
      ix.ingredient_id,
      ix.partner_type,
      ix.partner_ingredient_id,
      ix.partner_label,
      ix.type,
      ix.severity,
      ix.mechanism,
      ix.comment,
      ix.source_url,
      ix.source_label,
      ix.is_active,
      ${versionSelect(columns, 'ix')},
      ia.name AS ingredient_a_name,
      COALESCE(ib.name, ix.partner_label) AS ingredient_b_name
    FROM interactions ix
    JOIN ingredients ia ON ia.id = ix.ingredient_id
    LEFT JOIN ingredients ib ON ib.id = ix.partner_ingredient_id
    WHERE ix.ingredient_id = ?
      AND ix.partner_type = ?
      AND COALESCE(ix.partner_ingredient_id, -1) = COALESCE(?, -1)
      AND COALESCE(ix.partner_label, '_') = COALESCE(?, '_')
    ORDER BY ix.id DESC
    LIMIT 1
  `).bind(
    ingredientId,
    partnerType,
    partnerIngredientId,
    partnerLabel,
  ).all<{
    id: number
    ingredient_id: number
    partner_type: InteractionPartnerType
    partner_ingredient_id: number | null
    partner_label: string | null
    type: InteractionTypeValue | null
    severity: InteractionSeverity | null
    mechanism: string | null
    comment: string | null
    source_url: string | null
    source_label: string | null
    is_active: number
    version: number | null
    ingredient_a_name: string
    ingredient_b_name: string | null
  }>()

  const interaction = interactions[0]
  const responseInteraction = interaction
    ? {
        ...interaction,
        ingredient_a_id: interaction.ingredient_id,
        ingredient_b_id: interaction.partner_type === 'ingredient'
          ? interaction.partner_ingredient_id
          : null,
        ingredient_b_name: interaction.partner_type === 'ingredient'
          ? interaction.ingredient_b_name
          : interaction.partner_label ?? interaction.ingredient_b_name,
      }
    : null

  await logAdminAction(c, {
    action: 'upsert_interaction',
    entity_type: 'interaction',
    entity_id: interaction?.id ?? null,
    changes: {
      ingredient_id: ingredientId,
      partner_type: partnerType,
      partner_ingredient_id: partnerIngredientId,
      partner_label: partnerLabel,
      type: interactionType,
      severity,
      mechanism,
      comment,
      source_url: sourceUrl,
      source_label: sourceLabel,
      is_active: isActive,
    },
  })
  return c.json({ interaction: responseInteraction })
})

// DELETE /api/interactions/:id (admin only)
interactionsApp.delete('/:id', async (c) => {
  const authErr = await ensureAdmin(c)
  if (authErr) return authErr
  const id = c.req.param('id')
  const columns = await getTableColumns(c.env.DB, 'interactions')
  const interaction = await c.env.DB.prepare(`
    SELECT
      id,
      ${versionSelect(columns)}
    FROM interactions
    WHERE id = ?
  `).bind(id).first<{ id: number; version: number | null }>()
  if (!interaction) return c.json({ error: 'Not found' }, 404)
  const expectedVersion = await requestVersionFromRequest(c)
  const lock = validateOptimisticLock(columns.has('version'), interaction.version, expectedVersion)
  if (!lock.ok) return c.json({ error: lock.error, current_version: interaction.version }, 409)
  const deleteResult = lock.value.enforce
    ? await c.env.DB.prepare('DELETE FROM interactions WHERE id = ? AND version = ?').bind(id, lock.value.expectedVersion).run()
    : await c.env.DB.prepare('DELETE FROM interactions WHERE id = ?').bind(id).run()
  if (lock.value.enforce && d1ChangeCount(deleteResult) === 0) {
    const current = await c.env.DB.prepare(`
      SELECT ${versionSelect(columns)}
      FROM interactions
      WHERE id = ?
    `).bind(id).first<{ version: number | null }>()
    return c.json({ error: 'Version conflict', current_version: current?.version ?? interaction.version }, 409)
  }
  await logAdminAction(c, {
    action: 'delete_interaction',
    entity_type: 'interaction',
    entity_id: Number(id),
  })
  return c.json({ ok: true })
})
