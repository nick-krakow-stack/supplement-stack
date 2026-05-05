// ---------------------------------------------------------------------------
// Admin module
// Routes (mounted at /api/admin):
//   GET /products           — all products list (admin)
//   GET /stats              — platform statistics (admin)
//   GET /shop-domains       — shop domains list (admin)
//   POST /shop-domains      — create shop domain (admin)
//   DELETE /shop-domains/:id — delete shop domain (admin)
//   GET /product-rankings   — product rankings (admin)
//   PUT /product-rankings/:productId — upsert ranking (admin)
//   GET /user-products?status= — user-submitted products (admin)
//   PUT /user-products/:id/approve (admin)
//   PUT /user-products/:id/publish  (admin)
//   PUT /user-products/:id/reject  (admin)
//   DELETE /user-products/:id      (admin)
//   GET /ingredient-sub-ingredients (admin)
//   PUT /ingredient-sub-ingredients (admin)
//   DELETE /ingredient-sub-ingredients/:parentId/:childId (admin)
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
// Plus public shop-domain routes (mounted at /api/shop-domains):
//   GET /resolve?url=       — resolve shop name from URL (public)
//   GET /                   — list shop domains (public)
// Plus interaction routes (mounted at /api/interactions):
//   GET /                   — list all (public)
//   POST /                  — create (admin)
//   DELETE /:id             — delete (admin)
// ---------------------------------------------------------------------------

import { Hono } from 'hono'
import type { AppContext, CountRow, ProductRow, InteractionRow } from '../lib/types'
import { ensureAuth, requireAdmin, ensureAdmin, logAdminAction } from '../lib/helpers'

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
}

type ValidationFailure = {
  ok: false
  error: string
  status?: 400 | 404 | 409
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
  created_at: string
  updated_at: string
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
}

type IngredientResearchSourceMutation = Omit<IngredientResearchSourceRow, 'id' | 'created_at' | 'updated_at'>
type IngredientSafetyWarningMutation = Omit<IngredientSafetyWarningAdminRow, 'id' | 'ingredient_name' | 'form_name' | 'article_title' | 'created_at'>

type KnowledgeArticleStatus = typeof KNOWLEDGE_ARTICLE_STATUSES[number]

type KnowledgeArticleDbRow = {
  slug: string
  title: string
  summary: string
  body: string
  status: KnowledgeArticleStatus
  reviewed_at: string | null
  sources_json: string
  created_at: string
  updated_at: string
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
}

type ParsedKnowledgeArticle<T extends KnowledgeArticleDbRow | KnowledgeArticleListDbRow> =
  Omit<T, 'sources_json'> & {
    sources_json: unknown[]
  }

type ProductQaIssue = typeof PRODUCT_QA_ISSUES[number]

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
}

type ProductQaPatch = {
  price?: number | null
  shop_link?: string | null
  is_affiliate?: number
  serving_size?: number | null
  serving_unit?: string | null
  servings_per_container?: number | null
  container_count?: number | null
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
const KNOWLEDGE_ARTICLE_STATUSES = ['draft', 'published', 'archived'] as const
const PRODUCT_QA_ISSUES = [
  'missing_image',
  'missing_shop_link',
  'missing_serving_data',
  'suspicious_price_zero_or_high',
  'missing_ingredient_rows',
  'no_affiliate_flag_on_shop_link',
] as const

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

function optionalText(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

function parsePositiveId(value: string): number | null {
  const parsed = Number(value)
  if (!Number.isInteger(parsed) || parsed <= 0) return null
  return parsed
}

function hasOwnKey(data: Record<string, unknown>, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(data, key)
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

function normalizeInteger(value: unknown): number | undefined {
  if (value === undefined) return undefined
  const parsed = typeof value === 'number' ? value : typeof value === 'string' && value.trim() !== '' ? Number(value) : Number.NaN
  return Number.isInteger(parsed) ? parsed : undefined
}

function validationError(error: string, status: 400 | 404 | 409 = 400): ValidationFailure {
  return { ok: false, error, status }
}

function enumValue<T extends readonly string[]>(value: unknown, allowed: T): T[number] | null {
  if (typeof value !== 'string') return null
  const normalized = value.trim()
  return (allowed as readonly string[]).includes(normalized) ? normalized as T[number] : null
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

function optionalDateTextField(data: Record<string, unknown>, key: string): ValidationResult<string | null | undefined> {
  const result = optionalTextField(data, key, 40)
  if (!result.ok || result.value === undefined || result.value === null) return result
  if (!/^\d{4}(?:-\d{2}(?:-\d{2})?)?(?:[T ][0-9:.+-Z]+)?$/.test(result.value)) {
    return validationError(`${key} must be an ISO-like date string`)
  }
  return result
}

function parseKnowledgeSourcesJson(value: string): unknown[] {
  try {
    const parsed = JSON.parse(value)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
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

function parseKnowledgeArticle<T extends KnowledgeArticleDbRow | KnowledgeArticleListDbRow>(
  row: T,
): ParsedKnowledgeArticle<T> {
  return {
    ...row,
    sources_json: parseKnowledgeSourcesJson(row.sources_json),
  }
}

function productQaIssues(row: ProductQaRow): ProductQaIssue[] {
  return PRODUCT_QA_ISSUES.filter((issue) => row[issue] === 1)
}

async function getProductQaRow(db: D1Database, productId: number): Promise<ProductQaRow | null> {
  return db.prepare(`
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
        CASE WHEN COALESCE(p.shop_link, '') <> '' AND COALESCE(p.is_affiliate, 0) = 0 THEN 1 ELSE 0 END AS no_affiliate_flag_on_shop_link
      FROM products p
      LEFT JOIN ingredient_counts ic ON ic.product_id = p.id
      WHERE p.id = ?
    )
    SELECT *
    FROM qa
  `).bind(productId).first<ProductQaRow>()
}

function formatProductQaRow(row: ProductQaRow) {
  return {
    ...row,
    issues: productQaIssues(row),
  }
}

function validateProductQaPatch(body: Record<string, unknown>): ValidationResult<ProductQaPatch> {
  const allowedFields = new Set([
    'price',
    'shop_link',
    'is_affiliate',
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

  const price = optionalNumberField(body, 'price', { min: 0, minExclusive: true, max: 300 })
  if (!price.ok) return price
  if (price.value === null) return validationError('price is required')
  if (price.value !== undefined) data.price = price.value

  const shopLink = normalizeHttpUrlField(body, 'shop_link')
  if (!shopLink.ok) return shopLink
  if (shopLink.value !== undefined) data.shop_link = shopLink.value

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

  const sources = serializeKnowledgeSources(
    hasOwnKey(body, 'sources_json') ? body.sources_json : existing?.sources_json ?? undefined,
  )
  if (!sources.ok) return sources
  const parsedSources = parseKnowledgeSourcesJson(sources.value)
  if (status === 'published') {
    if (!bodyText.value.trim()) return validationError('Published knowledge articles need a non-empty body')
    if (parsedSources.length === 0) return validationError('Published knowledge articles need at least one source')
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
      sources_json: sources.value,
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

function parseAuditDate(value: string | undefined, endOfDay: boolean): number | null | undefined {
  if (!value) return undefined
  if (/^\d+$/.test(value)) return Number(value)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null
  const suffix = endOfDay ? 'T23:59:59Z' : 'T00:00:00Z'
  const timestamp = Date.parse(`${value}${suffix}`)
  if (!Number.isFinite(timestamp)) return null
  return Math.floor(timestamp / 1000)
}

function formatDoseRecommendationValidation(error: ValidationFailure): { error: string; status: 400 | 404 | 409 } {
  return { error: error.error, status: error.status ?? 400 }
}

async function ingredientExists(db: D1Database, ingredientId: number): Promise<boolean> {
  const row = await db.prepare('SELECT id FROM ingredients WHERE id = ?')
    .bind(ingredientId)
    .first<{ id: number }>()
  return Boolean(row)
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
  return await db.prepare(`
    SELECT
      slug,
      title,
      summary,
      body,
      status,
      reviewed_at,
      sources_json,
      created_at,
      updated_at
    FROM knowledge_articles
    WHERE slug = ?
  `).bind(slug).first<KnowledgeArticleDbRow>()
}

async function getIngredientResearchStatusRow(db: D1Database, ingredientId: number): Promise<IngredientResearchStatusRow | null> {
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
      updated_at
    FROM ingredient_research_status
    WHERE ingredient_id = ?
  `).bind(ingredientId).first<IngredientResearchStatusRow>()
}

async function getIngredientResearchSourceRow(db: D1Database, sourceId: number): Promise<IngredientResearchSourceRow | null> {
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
      created_at,
      updated_at
    FROM ingredient_research_sources
    WHERE id = ?
  `).bind(sourceId).first<IngredientResearchSourceRow>()
}

async function getIngredientSafetyWarningAdminRow(db: D1Database, warningId: number): Promise<IngredientSafetyWarningAdminRow | null> {
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
      w.created_at
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
): Promise<ValidationResult<Omit<IngredientResearchStatusRow, 'ingredient_id' | 'created_at' | 'updated_at'>>> {
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

async function getDoseRecommendationAdminRow(db: D1Database, id: number): Promise<DoseRecommendationAdminRow | null> {
  return await db.prepare(`
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
      dr.updated_at
    FROM dose_recommendations dr
    JOIN ingredients i ON i.id = dr.ingredient_id
    JOIN populations p ON p.id = dr.population_id
    LEFT JOIN users u ON u.id = dr.created_by_user_id
    LEFT JOIN verified_profiles vp ON vp.id = dr.verified_profile_id
    WHERE dr.id = ?
  `).bind(id).first<DoseRecommendationAdminRow>()
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
  if ((sourceType === 'official' || sourceType === 'study' || sourceType === 'user_public') && !sourceUrl) {
    return validationError('source_url is required for official, study, and user_public recommendations')
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

// GET /api/admin/products (admin only)
admin.get('/products', async (c) => {
  const authErr = await ensureAuth(c)
  if (authErr) return authErr
  const admErr = requireAdmin(c)
  if (admErr) return admErr
  const { results: products } = await c.env.DB.prepare(
    'SELECT * FROM products ORDER BY created_at DESC'
  ).all<ProductRow>()
  return c.json({ products })
})

// GET /api/admin/stats (admin only)
admin.get('/stats', async (c) => {
  const authErr = await ensureAuth(c)
  if (authErr) return authErr
  const admErr = requireAdmin(c)
  if (admErr) return admErr
  const usersRow = await c.env.DB.prepare('SELECT COUNT(*) as count FROM users').first<CountRow>()
  const ingredientsRow = await c.env.DB.prepare('SELECT COUNT(*) as count FROM ingredients').first<CountRow>()
  const productsRow = await c.env.DB.prepare('SELECT COUNT(*) as count FROM products').first<CountRow>()
  const stacksRow = await c.env.DB.prepare('SELECT COUNT(*) as count FROM stacks').first<CountRow>()
  const pendingRow = await c.env.DB.prepare(
    `SELECT COUNT(*) as count FROM products WHERE moderation_status = 'pending'`
  ).first<CountRow>()
  return c.json({
    users: usersRow?.count ?? 0,
    ingredients: ingredientsRow?.count ?? 0,
    products: productsRow?.count ?? 0,
    stacks: stacksRow?.count ?? 0,
    pending_products: pendingRow?.count ?? 0,
  })
})

// GET /api/admin/audit-log?action=&entity_type=&user_id=&date=&date_from=&date_to=&page=1&limit=50 (admin only)
admin.get('/audit-log', async (c) => {
  const authErr = await ensureAdmin(c)
  if (authErr) return authErr

  const action = optionalText(c.req.query('action'))
  const entityType = optionalText(c.req.query('entity_type'))
  const userIdParam = c.req.query('user_id')
  let userId: number | null | undefined
  if (userIdParam === 'system') {
    userId = null
  } else if (userIdParam) {
    const parsedUserId = parsePositiveId(userIdParam)
    if (parsedUserId === null) return c.json({ error: 'Invalid user_id' }, 400)
    userId = parsedUserId
  }

  const singleDate = c.req.query('date')
  const dateFrom = parseAuditDate(c.req.query('date_from') ?? singleDate, false)
  const dateTo = parseAuditDate(c.req.query('date_to') ?? singleDate, true)
  if (dateFrom === null) return c.json({ error: 'date/date_from must be YYYY-MM-DD or unix seconds' }, 400)
  if (dateTo === null) return c.json({ error: 'date/date_to must be YYYY-MM-DD or unix seconds' }, 400)
  if (dateFrom !== undefined && dateTo !== undefined && dateFrom > dateTo) {
    return c.json({ error: 'date_from must be <= date_to' }, 400)
  }

  const page = Math.max(1, parsePagination(c.req.query('page'), 1, 100000))
  const limit = parsePagination(c.req.query('limit'), 50, 100)
  const offset = (page - 1) * limit

  const where: string[] = []
  const bindings: Array<string | number | null> = []
  if (action) {
    where.push('aal.action = ?')
    bindings.push(action)
  }
  if (entityType) {
    where.push('aal.entity_type = ?')
    bindings.push(entityType)
  }
  if (userId !== undefined) {
    where.push(userId === null ? 'aal.user_id IS NULL' : 'aal.user_id = ?')
    if (userId !== null) bindings.push(userId)
  }
  if (dateFrom !== undefined) {
    where.push('aal.created_at >= ?')
    bindings.push(dateFrom)
  }
  if (dateTo !== undefined) {
    where.push('aal.created_at <= ?')
    bindings.push(dateTo)
  }

  const whereSql = where.length > 0 ? `WHERE ${where.join(' AND ')}` : ''
  const totalRow = await c.env.DB.prepare(`
    SELECT COUNT(*) AS count
    FROM admin_audit_log aal
    ${whereSql}
  `).bind(...bindings).first<CountRow>()

  const { results } = await c.env.DB.prepare(`
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
    ${whereSql}
    ORDER BY aal.created_at DESC, aal.id DESC
    LIMIT ? OFFSET ?
  `).bind(...bindings, limit, offset).all<AuditLogDbRow>()

  return c.json({
    logs: results.map((row) => ({
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
    page,
    limit,
    total: totalRow?.count ?? 0,
  })
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

  const whereSql = where.length > 0 ? `WHERE ${where.join(' AND ')}` : ''
  const { results } = await c.env.DB.prepare(`
    SELECT
      slug,
      title,
      summary,
      status,
      reviewed_at,
      sources_json,
      updated_at
    FROM knowledge_articles
    ${whereSql}
    ORDER BY updated_at DESC, slug ASC
  `).bind(...bindings).all<KnowledgeArticleListDbRow>()

  return c.json({
    articles: results.map((row) => parseKnowledgeArticle(row)),
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
        created_at,
        updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
    `).bind(
      data.slug,
      data.title,
      data.summary,
      data.body,
      data.status,
      data.reviewed_at,
      data.sources_json,
    ).run()
  } catch (error) {
    if (isUniqueConstraintError(error)) return c.json({ error: `Knowledge article "${data.slug}" already exists` }, 409)
    throw error
  }

  const article = await getKnowledgeArticleRow(c.env.DB, data.slug)
  await logAdminAction(c, {
    action: 'create_knowledge_article',
    entity_type: 'knowledge_article',
    entity_id: null,
    changes: { slug: data.slug, article },
  })

  return c.json({ article: article ? parseKnowledgeArticle(article) : null }, 201)
})

// GET /api/admin/knowledge-articles/:slug (admin only)
admin.get('/knowledge-articles/:slug', async (c) => {
  const authErr = await ensureAdmin(c)
  if (authErr) return authErr

  const slug = normalizeSlug(c.req.param('slug'))
  if (!slug) return c.json({ error: 'Invalid article slug' }, 400)

  const article = await getKnowledgeArticleRow(c.env.DB, slug)
  if (!article) return c.json({ error: 'Knowledge article not found' }, 404)
  return c.json({ article: parseKnowledgeArticle(article) })
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

  const validation = validateKnowledgeArticlePayload(body, existing)
  if (!validation.ok) return c.json({ error: validation.error }, validation.status ?? 400)
  const data = validation.value

  await c.env.DB.prepare(`
    UPDATE knowledge_articles
    SET
      title = ?,
      summary = ?,
      body = ?,
      status = ?,
      reviewed_at = ?,
      sources_json = ?,
      updated_at = datetime('now')
    WHERE slug = ?
  `).bind(
    data.title,
    data.summary,
    data.body,
    data.status,
    data.reviewed_at,
    data.sources_json,
    slug,
  ).run()

  const article = await getKnowledgeArticleRow(c.env.DB, slug)
  await logAdminAction(c, {
    action: 'update_knowledge_article',
    entity_type: 'knowledge_article',
    entity_id: null,
    changes: { slug, before: existing, after: article },
  })

  return c.json({ article: article ? parseKnowledgeArticle(article) : null })
})

// DELETE /api/admin/knowledge-articles/:slug (admin only; archive instead of hard delete)
admin.delete('/knowledge-articles/:slug', async (c) => {
  const authErr = await ensureAdmin(c)
  if (authErr) return authErr

  const slug = normalizeSlug(c.req.param('slug'))
  if (!slug) return c.json({ error: 'Invalid article slug' }, 400)

  const existing = await getKnowledgeArticleRow(c.env.DB, slug)
  if (!existing) return c.json({ error: 'Knowledge article not found' }, 404)

  await c.env.DB.prepare(`
    UPDATE knowledge_articles
    SET status = 'archived',
        updated_at = datetime('now')
    WHERE slug = ?
  `).bind(slug).run()

  const article = await getKnowledgeArticleRow(c.env.DB, slug)
  await logAdminAction(c, {
    action: 'archive_knowledge_article',
    entity_type: 'knowledge_article',
    entity_id: null,
    changes: { slug, before: { status: existing.status }, after: { status: article?.status ?? 'archived' } },
  })

  return c.json({ ok: true, article: article ? parseKnowledgeArticle(article) : null })
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
    productQaIssues,
    productQaTopItems,
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
         OR (COALESCE(p.shop_link, '') <> '' AND COALESCE(p.is_affiliate, 0) = 0)
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
          CASE WHEN COALESCE(p.shop_link, '') <> '' AND COALESCE(p.is_affiliate, 0) = 0 THEN 1 ELSE 0 END AS no_affiliate_flag_on_shop_link
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
    queues: {
      product_qa: ((productQaTopItems.results ?? []) as ProductQaRow[]).map((row) => formatProductQaRow(row)),
      research_due: researchDueItems.results ?? [],
      research_later: researchLaterItems.results ?? [],
      warnings_without_article: warningsWithoutArticleItems.results ?? [],
      knowledge_drafts: knowledgeDraftItems.results ?? [],
    },
  })
})

// GET /api/admin/product-qa?q=&issue=&limit=100 (admin only)
admin.get('/product-qa', async (c) => {
  const authErr = await ensureAdmin(c)
  if (authErr) return authErr

  const q = c.req.query('q')?.trim() ?? ''
  const issueParam = c.req.query('issue')?.trim() ?? ''
  const issue = issueParam ? enumValue(issueParam, PRODUCT_QA_ISSUES) : null
  if (issueParam && !issue) return c.json({ error: `issue must be one of ${PRODUCT_QA_ISSUES.join(', ')}` }, 400)

  const limit = parsePagination(c.req.query('limit'), 100, 250)
  const where: string[] = []
  const bindings: Array<string | number> = []

  if (q) {
    const like = `%${q}%`
    where.push('(name LIKE ? OR COALESCE(brand, \'\') LIKE ? OR COALESCE(form, \'\') LIKE ?)')
    bindings.push(like, like, like)
  }

  if (issue) {
    where.push(`${issue} = 1`)
  }

  const whereSql = where.length > 0 ? `WHERE ${where.join(' AND ')}` : ''
  const { results } = await c.env.DB.prepare(`
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
        CASE WHEN COALESCE(p.shop_link, '') <> '' AND COALESCE(p.is_affiliate, 0) = 0 THEN 1 ELSE 0 END AS no_affiliate_flag_on_shop_link
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
  `).bind(...bindings, limit).all<ProductQaRow>()

  return c.json({
    products: results.map((row) => ({
      ...row,
      issues: productQaIssues(row),
    })),
    total: results.length,
    limit,
    available_issues: PRODUCT_QA_ISSUES,
  })
})

// PATCH /api/admin/product-qa/:id (admin only)
admin.patch('/product-qa/:id', async (c) => {
  const authErr = await ensureAdmin(c)
  if (authErr) return authErr

  const id = parsePositiveId(c.req.param('id'))
  if (id === null) return c.json({ error: 'Invalid product id' }, 400)

  const existing = await getProductQaRow(c.env.DB, id)
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

  const fields = [
    'price',
    'shop_link',
    'is_affiliate',
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

  await c.env.DB.prepare(`
    UPDATE products
    SET ${setClauses.join(', ')}
    WHERE id = ?
  `).bind(...bindings, id).run()

  const updated = await getProductQaRow(c.env.DB, id)
  if (!updated) return c.json({ error: 'Product not found after update' }, 404)

  await logAdminAction(c, {
    action: 'update_product_qa_fields',
    entity_type: 'product',
    entity_id: id,
    changes: { before, after },
  })

  return c.json({ product: formatProductQaRow(updated) })
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
    where.push('(i.name LIKE ? OR dr.source_label LIKE ? OR COALESCE(dr.source_url, \'\') LIKE ? OR COALESCE(dr.context_note, \'\') LIKE ?)')
    bindings.push(like, like, like, like)
  }

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
      dr.updated_at
    FROM dose_recommendations dr
    JOIN ingredients i ON i.id = dr.ingredient_id
    JOIN populations p ON p.id = dr.population_id
    LEFT JOIN users u ON u.id = dr.created_by_user_id
    LEFT JOIN verified_profiles vp ON vp.id = dr.verified_profile_id
    ${whereSql}
    ORDER BY dr.is_active DESC, dr.relevance_score DESC, dr.updated_at DESC, dr.id DESC
    LIMIT ? OFFSET ?
  `).bind(...bindings, limit, offset).all<DoseRecommendationAdminRow>()

  return c.json({ recommendations: results, page, limit, total: totalRow?.count ?? 0 })
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
  const recommendation = await getDoseRecommendationAdminRow(c.env.DB, id)

  await logAdminAction(c, {
    action: 'create_dose_recommendation',
    entity_type: 'dose_recommendation',
    entity_id: id,
    changes: data,
  })

  return c.json({ recommendation }, 201)
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

  const data = validation.value
  try {
    await c.env.DB.prepare(`
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
        updated_at = strftime('%s','now')
      WHERE id = ?
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
      id,
    ).run()
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      return c.json({ error: 'An active default recommendation already exists for this ingredient/population/targeting combination' }, 409)
    }
    throw error
  }

  const recommendation = await getDoseRecommendationAdminRow(c.env.DB, id)

  await logAdminAction(c, {
    action: 'update_dose_recommendation',
    entity_type: 'dose_recommendation',
    entity_id: id,
    changes: { before: existing, after: recommendation },
  })

  return c.json({ recommendation })
})

// DELETE /api/admin/dose-recommendations/:id (admin only; soft delete via is_active=0)
admin.delete('/dose-recommendations/:id', async (c) => {
  const authErr = await ensureAdmin(c)
  if (authErr) return authErr

  const id = parsePositiveId(c.req.param('id'))
  if (id === null) return c.json({ error: 'Invalid dose recommendation id' }, 400)

  const existing = await getDoseRecommendationAdminRow(c.env.DB, id)
  if (!existing) return c.json({ error: 'Dose recommendation not found' }, 404)

  await c.env.DB.prepare(`
    UPDATE dose_recommendations
    SET is_active = 0,
        is_default = 0,
        updated_at = strftime('%s','now')
    WHERE id = ?
  `).bind(id).run()

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
      created_at,
      updated_at
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
      w.created_at
    FROM ingredient_safety_warnings w
    LEFT JOIN ingredients i ON i.id = w.ingredient_id
    LEFT JOIN ingredient_forms f ON f.id = w.form_id
    LEFT JOIN knowledge_articles a ON a.slug = w.article_slug
    WHERE w.ingredient_id = ?
    ORDER BY w.active DESC, w.severity DESC, w.id DESC
  `).bind(ingredientId).all<IngredientSafetyWarningAdminRow>()

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
    },
    sources,
    warnings,
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
  await c.env.DB.prepare(`
    INSERT INTO ingredient_research_status (
      ingredient_id,
      research_status,
      calculation_status,
      internal_notes,
      blog_url,
      reviewed_at,
      review_due_at,
      created_at,
      updated_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
    ON CONFLICT(ingredient_id) DO UPDATE SET
      research_status = excluded.research_status,
      calculation_status = excluded.calculation_status,
      internal_notes = excluded.internal_notes,
      blog_url = excluded.blog_url,
      reviewed_at = excluded.reviewed_at,
      review_due_at = excluded.review_due_at,
      updated_at = datetime('now')
  `).bind(
    ingredientId,
    data.research_status,
    data.calculation_status,
    data.internal_notes,
    data.blog_url,
    data.reviewed_at,
    data.review_due_at,
  ).run()

  const status = await getIngredientResearchStatusRow(c.env.DB, ingredientId)
  await logAdminAction(c, {
    action: 'upsert_ingredient_research_status',
    entity_type: 'ingredient_research_status',
    entity_id: ingredientId,
    changes: { before: existing, after: status },
  })

  return c.json({ status })
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
  const result = await c.env.DB.prepare(`
    INSERT INTO ingredient_research_sources (
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
      created_at,
      updated_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
  `).bind(
    data.ingredient_id,
    data.source_kind,
    data.organization,
    data.country,
    data.region,
    data.population,
    data.recommendation_type,
    data.no_recommendation,
    data.dose_min,
    data.dose_max,
    data.dose_unit,
    data.per_kg_body_weight,
    data.frequency,
    data.study_type,
    data.evidence_quality,
    data.duration,
    data.outcome,
    data.finding,
    data.source_title,
    data.source_url,
    data.doi,
    data.pubmed_id,
    data.notes,
    data.source_date,
    data.reviewed_at,
  ).run()

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
  await c.env.DB.prepare(`
    UPDATE ingredient_research_sources
    SET
      ingredient_id = ?,
      source_kind = ?,
      organization = ?,
      country = ?,
      region = ?,
      population = ?,
      recommendation_type = ?,
      no_recommendation = ?,
      dose_min = ?,
      dose_max = ?,
      dose_unit = ?,
      per_kg_body_weight = ?,
      frequency = ?,
      study_type = ?,
      evidence_quality = ?,
      duration = ?,
      outcome = ?,
      finding = ?,
      source_title = ?,
      source_url = ?,
      doi = ?,
      pubmed_id = ?,
      notes = ?,
      source_date = ?,
      reviewed_at = ?,
      updated_at = datetime('now')
    WHERE id = ?
  `).bind(
    data.ingredient_id,
    data.source_kind,
    data.organization,
    data.country,
    data.region,
    data.population,
    data.recommendation_type,
    data.no_recommendation,
    data.dose_min,
    data.dose_max,
    data.dose_unit,
    data.per_kg_body_weight,
    data.frequency,
    data.study_type,
    data.evidence_quality,
    data.duration,
    data.outcome,
    data.finding,
    data.source_title,
    data.source_url,
    data.doi,
    data.pubmed_id,
    data.notes,
    data.source_date,
    data.reviewed_at,
    sourceId,
  ).run()

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

  await c.env.DB.prepare('DELETE FROM ingredient_research_sources WHERE id = ?')
    .bind(sourceId)
    .run()

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
  await c.env.DB.prepare(`
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
      active = ?
    WHERE id = ?
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
    warningId,
  ).run()

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

  await c.env.DB.prepare('UPDATE ingredient_safety_warnings SET active = 0 WHERE id = ?')
    .bind(warningId)
    .run()

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

// GET /api/admin/user-products?status=pending (admin)
admin.get('/user-products', async (c) => {
  const authErr = await ensureAdmin(c)
  if (authErr) return authErr
  const status = c.req.query('status') ?? 'pending'
  if (!['pending', 'approved', 'rejected'].includes(status)) {
    return c.json({ error: 'Invalid status' }, 400)
  }
  const { results } = await c.env.DB.prepare(`
    SELECT up.*, u.email as user_email, u.is_trusted_product_submitter as user_is_trusted_product_submitter
    FROM user_products up
    LEFT JOIN users u ON up.user_id = u.id
    WHERE up.status = ?
    ORDER BY up.created_at DESC
  `).bind(status).all()
  const products = await attachUserProductIngredients(c.env.DB, results as Record<string, unknown>[])
  return c.json({ products })
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

  const affiliateValue = isAffiliate ?? (userProduct.is_affiliate === 1 ? 1 : 0)
  let productId: number
  try {
    const result = await c.env.DB.prepare(`
      INSERT INTO products (
        name, brand, form, price, shop_link, image_url, moderation_status, visibility,
        is_affiliate, serving_size, serving_unit, servings_per_container, container_count,
        timing, dosage_text, effect_summary, warning_title, warning_message,
        warning_type, alternative_note, source_user_product_id
      ) VALUES (?, ?, ?, ?, ?, ?, 'approved', 'public', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      userProduct.name,
      userProduct.brand,
      userProduct.form,
      userProduct.price,
      userProduct.shop_link ?? null,
      userProduct.image_url ?? null,
      affiliateValue,
      userProduct.serving_size,
      userProduct.serving_unit,
      userProduct.servings_per_container,
      userProduct.container_count,
      userProduct.timing ?? null,
      userProduct.dosage_text ?? null,
      userProduct.effect_summary ?? null,
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

  const payload = await getProductPublishPayloadByProductId(c.env.DB, productId)

  await logAdminAction(c, {
    action: 'publish_user_product',
    entity_type: 'user_product',
    entity_id: id,
    changes: { published_product_id: productId, is_affiliate: affiliateValue },
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

// GET /api/interactions
interactionsApp.get('/', async (c) => {
  const { results: interactions } = await c.env.DB.prepare(`
    SELECT ix.*,
           ia.name as ingredient_a_name,
           ib.name as ingredient_b_name
    FROM interactions ix
    JOIN ingredients ia ON ia.id = ix.ingredient_a_id
    JOIN ingredients ib ON ib.id = ix.ingredient_b_id
    ORDER BY ix.id DESC
  `).all()
  return c.json({ interactions })
})

// POST /api/interactions (admin only)
interactionsApp.post('/', async (c) => {
  const authErr = await ensureAuth(c)
  if (authErr) return authErr
  const user = c.get('user')
  if (user.role !== 'admin') return c.json({ error: 'Forbidden' }, 403)
  let data: Record<string, unknown>
  try {
    data = await c.req.json()
  } catch {
    return c.json({ error: 'Invalid JSON' }, 400)
  }
  if (!data.ingredient_a_id || !data.ingredient_b_id) return c.json({ error: 'Missing fields' }, 400)
  const interactionResult = await c.env.DB.prepare(
    'INSERT OR REPLACE INTO interactions (ingredient_a_id, ingredient_b_id, type, comment) VALUES (?, ?, ?, ?)'
  ).bind(
    data.ingredient_a_id,
    data.ingredient_b_id,
    (data.type as string) || 'avoid',
    (data.comment as string) || null,
  ).run()
  await logAdminAction(c, {
    action: 'upsert_interaction',
    entity_type: 'interaction',
    entity_id: interactionResult.meta.last_row_id as number ?? null,
    changes: data,
  })
  return c.json({ ok: true })
})

// DELETE /api/interactions/:id (admin only)
interactionsApp.delete('/:id', async (c) => {
  const authErr = await ensureAuth(c)
  if (authErr) return authErr
  const admErr = requireAdmin(c)
  if (admErr) return admErr
  const id = c.req.param('id')
  const interaction = await c.env.DB.prepare('SELECT id FROM interactions WHERE id = ?').bind(id).first<InteractionRow>()
  if (!interaction) return c.json({ error: 'Not found' }, 404)
  await c.env.DB.prepare('DELETE FROM interactions WHERE id = ?').bind(id).run()
  await logAdminAction(c, {
    action: 'delete_interaction',
    entity_type: 'interaction',
    entity_id: Number(id),
  })
  return c.json({ ok: true })
})
