export interface User {
  id: number;
  email: string;
  age?: number;
  gender?: string;
  weight?: number;
  diet?: string;
  goals?: string;
  guideline_source?: string;
  is_smoker?: number;        // 0 or 1
  health_consent?: number;   // 0 or 1
  health_consent_at?: string;
  role: 'user' | 'admin';
}

export interface IngredientSynonym {
  id: number;
  ingredient_id: number;
  synonym: string;
}

export interface IngredientForm {
  id: number;
  ingredient_id: number;
  name: string;
  comment?: string;
  tags?: string;
  score?: number;
}

export interface Ingredient {
  id: number;
  name: string;
  unit?: string;
  description?: string;
  hypo_symptoms?: string;
  hyper_symptoms?: string;
  external_url?: string;
  synonyms?: IngredientSynonym[];
  forms?: IngredientForm[];
}

export interface ProductIngredient {
  id: number;
  product_id: number;
  ingredient_id: number;
  is_main: boolean;
  quantity?: number;
  unit?: string;
  form_id?: number;
  ingredient_name?: string;
}

export interface Product {
  id: number;
  product_type?: 'catalog' | 'user_product';
  name: string;
  brand?: string;
  form?: string;
  price: number;
  shop_link?: string;
  image_url?: string;
  moderation_status: string;
  visibility: string;
  ingredients?: ProductIngredient[];
  is_affiliate?: number;         // 0 or 1
  image_r2_key?: string;
  discontinued_at?: string;
  replacement_id?: number;
  serving_size?: number;
  serving_unit?: string;
  servings_per_container?: number;
  container_count?: number;
  timing?: string;
  dosage_text?: string;
  effect_summary?: string;
  warning_title?: string;
  warning_message?: string;
  warning_type?: string;
  alternative_note?: string;
}

export interface StackItem {
  id: number;
  stack_id: number;
  product_id: number;
  product_type?: 'catalog' | 'user_product';
  quantity: number;
  product?: Product;
}

export interface Stack {
  id: number;
  user_id?: number;
  name: string;
  created_at: string;
  items?: StackItem[];
}

export interface Recommendation {
  id: number;
  ingredient_id: number;
  product_id: number;
  type: 'recommended' | 'alternative';
  product?: Product;
}

export interface Interaction {
  id: number;
  ingredient_a_id: number;
  ingredient_b_id: number;
  type: string;
  comment?: string;
  ingredient_a_name?: string;
  ingredient_b_name?: string;
}

export interface DemoSession {
  key: string;
  stack_json: string;
  expires_at: string;
}

export interface WishlistItem {
  id: number;
  user_id: number;
  product_id: number;
  product?: Product;
}
