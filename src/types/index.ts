export interface User {
  id: number;
  email: string;
  name?: string;
  age?: number;
  gender?: 'male' | 'female' | 'other';
  weight?: number;
  diet_type?: 'vegan' | 'vegetarian' | 'omnivore';
  personal_goals?: string;
  guideline_source: 'dge' | 'studies' | 'influencer';
  is_admin: boolean;
  google_id?: string;
  created_at: string;
  updated_at: string;
}

export interface Product {
  id: number;
  name: string;
  brand?: string;
  form?: string;
  price_per_package?: number;
  servings_per_package?: number;
  shop_url?: string;
  affiliate_url?: string;
  image_url?: string;
  user_id: number;
  is_public: boolean;
  created_at: string;
  updated_at: string;
  nutrients?: ProductNutrient[];
}

export interface Nutrient {
  id: number;
  name: string;
  synonyms?: string[];
  standard_unit: string;
  external_article_url: string;
  article_link_label?: string;
  description?: string;
  created_at: string;
  updated_at: string;
}

export interface ProductNutrient {
  id: number;
  product_id: number;
  nutrient_id: number;
  amount: number;
  unit: string;
  amount_normalized?: number;
  nutrient?: Nutrient;
}

export interface Stack {
  id: number;
  name: string;
  description?: string;
  user_id: number;
  is_public: boolean;
  created_at: string;
  updated_at: string;
  products?: StackProduct[];
}

export interface StackProduct {
  id: number;
  stack_id: number;
  product_id: number;
  servings_per_day: number;
  dosage_source: 'dge' | 'studies' | 'influencer' | 'user';
  notes?: string;
  product?: Product;
}

export interface GuidelineSource {
  id: number;
  name: string;
  code: string;
  description?: string;
  website_url?: string;
}

export interface DosageRecommendation {
  id: number;
  nutrient_id: number;
  guideline_source_id: number;
  recommended_amount: number;
  unit: string;
  max_amount?: number;
  age_group: string;
  gender: 'male' | 'female' | 'both';
  notes?: string;
  study_url?: string;
}

export interface NutrientInteraction {
  id: number;
  nutrient_a_id: number;
  nutrient_b_id: number;
  interaction_type: 'positive' | 'negative' | 'caution';
  description?: string;
  severity: 'low' | 'medium' | 'high';
  source_url?: string;
}

export interface Session {
  id: string;
  user_id: number;
  expires_at: string;
}

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}