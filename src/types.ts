// Supplement Stack - Shared Types
// ================================

// Cloudflare Workers Bindings
export type Bindings = {
  DB: D1Database
  MAILERSEND_API_KEY: string
  JWT_SECRET: string
  ENVIRONMENT: string
}

// Hono App Environment (used across all route files)
export type AppEnv = {
  Bindings: Bindings
  Variables: {
    user: {
      id: number
      email: string
      email_verified: boolean
    }
    userId: number
  }
}

// ========================
// DATABASE MODELS
// ========================

export interface User {
  id: number
  email: string
  password_hash: string
  google_id: string | null
  email_verified: boolean
  email_verification_token: string | null
  email_verification_expires_at: string | null
  age: number | null
  gender: 'männlich' | 'weiblich' | 'divers' | null
  weight: number | null
  diet_type: 'omnivore' | 'vegetarisch' | 'vegan' | null
  personal_goals: string | null
  guideline_source: 'DGE' | 'studien' | 'influencer'
  created_at: string
  updated_at: string
}

export interface Nutrient {
  id: number
  name: string
  synonyms: string | null  // JSON
  standard_unit: string
  external_article_url: string | null
  link_label: string | null
  effects: string | null
  deficiency_symptoms: string | null
  excess_symptoms: string | null
  dge_recommended: number | null
  study_recommended: number | null
  influencer_recommended: number | null
  max_safe_dose: number | null
  warning_threshold: number | null
  created_at: string
  updated_at: string
}

export interface Product {
  id: number
  user_id: number
  name: string
  brand: string
  form: string
  price_per_package: number
  servings_per_package: number
  shop_url: string | null
  affiliate_url: string | null
  image_url: string | null
  created_at: string
  updated_at: string
}

export interface ProductNutrient {
  product_id: number
  nutrient_id: number
  amount: number
  unit: string
  amount_standardized: number
}

export interface Stack {
  id: number
  user_id: number
  name: string
  description: string | null
  created_at: string
  updated_at: string
}

export interface StackProduct {
  stack_id: number
  product_id: number
  dosage_per_day: number
  dosage_source: 'DGE' | 'studien' | 'influencer' | 'custom'
  custom_dosage: number | null
}

// ========================
// API RESPONSE TYPES
// ========================

export interface ApiResponse<T = unknown> {
  success: boolean
  data?: T
  error?: string
  message?: string
}

export interface ProductWithNutrients extends Omit<Product, 'user_id'> {
  purchase_price: number
  quantity: number
  price_per_piece: number
  dosage_per_day: number
  days_supply: number
  monthly_cost: number
  main_nutrients: NutrientSummary[]
  secondary_nutrients: NutrientSummary[]
}

export interface NutrientSummary {
  nutrient_id: number
  name: string
  amount_per_unit: number
  unit: string
}

export interface StackWithProducts {
  id: number
  name: string
  description: string
  products: number[]
  created_at: string
}
