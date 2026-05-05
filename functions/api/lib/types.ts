// ---------------------------------------------------------------------------
// Shared types for all API modules
// ---------------------------------------------------------------------------

export type Env = {
  DB: D1Database
  JWT_SECRET: string
  DEMO_SESSION_TTL_MINUTES: string
  GOOGLE_CLIENT_ID: string
  GOOGLE_CLIENT_SECRET: string
  FRONTEND_URL: string
  CF_IMAGES_ACCOUNT_HASH: string
  SMTP_HOST?: string
  SMTP_PORT?: string
  SMTP_USERNAME?: string
  SMTP_PASSWORD?: string
  SMTP_FROM_EMAIL?: string
  SMTP_FROM_NAME?: string
  PRODUCT_IMAGES?: R2Bucket
  RATE_LIMITER?: KVNamespace
  RESEND_API_KEY?: string
}

export type Variables = { user: { userId: number; email: string; role: string } }
export type AppContext = { Bindings: Env; Variables: Variables }

// ---------------------------------------------------------------------------
// Row types (DB query result shapes)
// ---------------------------------------------------------------------------

export type UserRow = {
  id: number
  email: string
  password_hash: string
  age: number | null
  gender: string | null
  weight: number | null
  diet_type: string | null
  personal_goals: string | null
  guideline_source: string | null
  role: string | null
  created_at: string
  google_id: string | null
  is_smoker: number
  health_consent: number
  health_consent_at: string | null
  email_verified_at: string | null
  deleted_at: string | null
  is_trusted_product_submitter: number
}

export type IngredientRow = {
  id: number
  name: string
  unit: string | null
  description: string | null
  hypo_symptoms: string | null
  hyper_symptoms: string | null
  external_url: string | null
  created_at: string
  upper_limit: number | null
  upper_limit_unit: string | null
  preferred_unit: string | null
}

export type ProductRow = {
  id: number
  name: string
  brand: string | null
  form: string | null
  price: number
  shop_link: string | null
  image_url: string | null
  moderation_status: string
  visibility: string
  created_at: string
  is_affiliate: number
  image_r2_key: string | null
  discontinued_at: string | null
  replacement_id: number | null
  serving_size: number | null
  serving_unit: string | null
  servings_per_container: number | null
  container_count: number
  timing: string | null
  dosage_text: string | null
  effect_summary: string | null
  warning_title: string | null
  warning_message: string | null
  warning_type: string | null
  alternative_note: string | null
}

export type StackRow = {
  id: number
  user_id: number
  name: string
  family_member_id: number | null
  family_member_first_name?: string | null
  created_at: string
}

export type StackItemRow = {
  id: number
  stack_id: number
  product_id: number
  quantity: number
  intake_interval_days: number
  product_name: string
  product_price: number
}

export type InteractionRow = {
  id: number
  ingredient_a_id: number
  ingredient_b_id: number
  type: string | null
  comment: string | null
}

export type DemoSessionRow = {
  id: number
  key: string
  stack_json: string | null
  expires_at: string | null
  created_at: string
}

export type CountRow = { count: number }
