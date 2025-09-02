// Supplement Stack - TypeScript Type Definitions
// Based on database schema and requirements

export interface User {
  id: number;
  email: string;
  password_hash: string;
  google_id?: string;
  age?: number;
  gender?: 'männlich' | 'weiblich' | 'divers';
  weight?: number;
  diet_type?: 'omnivore' | 'vegetarisch' | 'vegan';
  personal_goals?: string;
  guideline_source: 'DGE' | 'studien' | 'influencer';
  created_at: string;
  updated_at: string;
}

export interface Nutrient {
  id: number;
  name: string;
  synonyms: string; // JSON string array
  standard_unit: string;
  external_article_url: string;
  link_label?: string;
  dge_recommended?: number;
  study_recommended?: number;
  influencer_recommended?: number;
  max_safe_dose?: number;
  warning_threshold?: number;
  category_id?: number;
  created_at: string;
}

// Category type for supplement classification
export interface Category {
  id: number;
  name: string;
  description?: string;
  sort_order: number;
  created_at: string;
}

// Extended Nutrient with category information
export interface NutrientWithCategory extends Nutrient {
  category_name?: string;
  category_description?: string;
}

export interface Product {
  id: number;
  user_id: number;
  name: string;
  brand: string;
  form: string;
  price_per_package: number;
  servings_per_package: number;
  shop_url: string;
  affiliate_url?: string;
  image_url?: string;
  // Erweiterte Supplement-Informationen
  description?: string; // Kurzbeschreibung
  benefits?: string; // Wozu ist es gut? (JSON Array)
  warnings?: string; // Warnhinweise
  dosage_recommendation?: string; // Dosierungsempfehlung
  category_id?: number; // Reference to categories table
  is_duplicate: boolean;
  duplicate_of?: number;
  created_at: string;
  updated_at: string;
}

// Extended Product with category information
export interface ProductWithCategory extends Product {
  category_name?: string;
  category_description?: string;
}

export interface ProductNutrient {
  id: number;
  product_id: number;
  nutrient_id: number;
  amount: number;
  unit: string;
  amount_standardized: number;
}

export interface Stack {
  id: number;
  user_id: number;
  name: string;
  description?: string;
  created_at: string;
  updated_at: string;
}

export interface StackProduct {
  id: number;
  stack_id: number;
  product_id: number;
  dosage_per_day: number;
  dosage_source: 'DGE' | 'studien' | 'influencer' | 'custom';
  custom_dosage?: number;
}

export interface UserNote {
  id: number;
  user_id: number;
  product_id: number;
  note: string;
  created_at: string;
  updated_at: string;
}

export interface WishlistItem {
  id: number;
  user_id: number;
  product_id: number;
  created_at: string;
}

export interface AffiliateLink {
  id: number;
  original_url: string;
  affiliate_url?: string;
  click_count: number;
  needs_processing: boolean;
  created_at: string;
  processed_at?: string;
}

export interface AffiliateClick {
  id: number;
  affiliate_link_id: number;
  user_id?: number;
  ip_address?: string;
  user_agent?: string;
  clicked_at: string;
}

export interface Guideline {
  id: number;
  source_name: string;
  source_type: string;
  nutrient_id: number;
  recommended_dose: number;
  unit: string;
  reference_url?: string;
  created_at: string;
}

export interface NutrientInteraction {
  id: number;
  nutrient_a_id: number;
  nutrient_b_id: number;
  interaction_type: 'positive' | 'negative' | 'caution';
  description: string;
  reference_url?: string;
}

// Extended types with relationships
export interface ProductWithNutrients extends Product {
  nutrients: (ProductNutrient & { nutrient: Nutrient })[];
}

export interface StackWithProducts extends Stack {
  products: (StackProduct & { product: ProductWithNutrients })[];
  // Erweiterte Kostenfelder
  daily_cost?: number;
  monthly_cost?: number;
  total_purchase_cost?: number;
  avg_days_supply?: number;
  product_count?: number;
}

// API Request/Response types
export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
  age?: number;
  gender?: 'männlich' | 'weiblich' | 'divers';
  weight?: number;
  diet_type?: 'omnivore' | 'vegetarisch' | 'vegan';
  personal_goals?: string;
}

export interface CreateProductRequest {
  name: string;
  brand: string;
  form: string;
  price_per_package: number;
  servings_per_package: number;
  shop_url: string;
  image_url?: string;
  // Erweiterte Felder
  description?: string;
  benefits?: string; // JSON string
  warnings?: string;
  dosage_recommendation?: string;
  category_id?: number; // Reference to categories table
  nutrients: {
    nutrient_id: number;
    amount: number;
    unit: string;
  }[];
}

export interface CreateStackRequest {
  name: string;
  description?: string;
  products: {
    product_id: number;
    dosage_per_day: number;
    dosage_source: 'DGE' | 'studien' | 'influencer' | 'custom';
    custom_dosage?: number;
  }[];
}

// Calculation types
export interface StackCalculation {
  total_daily_nutrients: {
    nutrient_id: number;
    nutrient_name: string;
    total_amount: number;
    unit: string;
    dge_recommended?: number;
    study_recommended?: number;
    warning_level: 'safe' | 'caution' | 'warning' | 'danger';
  }[];
  daily_cost: number;
  monthly_cost: number;
  total_purchase_cost: number; // Gesamter Kaufpreis aller Produkte
  avg_days_supply: number; // Durchschnittliche Haltbarkeit
  product_consumption: {
    product_id: number;
    product_name: string;
    product_brand: string;
    product_image?: string;
    purchase_price: number; // Preis pro Packung
    days_until_empty: number; // Wie lange eine Packung hält
    cost_per_day: number; // Kosten pro Tag
    cost_per_month: number; // Kosten pro Monat (× 30)
    dosage_per_day: number; // Dosierung täglich
    shop_url: string;
    affiliate_url?: string;
  }[];
  warnings: {
    type: 'overdose' | 'interaction' | 'missing';
    message: string;
    reference_url?: string;
  }[];
}

// Session/Auth types
export interface SessionUser {
  id: number;
  email: string;
  guideline_source: 'DGE' | 'studien' | 'influencer';
}

// Cloudflare bindings
export interface Bindings {
  DB: D1Database;
  JWT_SECRET: string;
  MAILERSEND_API_KEY?: string;
}