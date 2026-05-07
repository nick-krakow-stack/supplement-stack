// Local frontend-facing types for ingredient, product, and stack UI flows.
// DB/Admin types live in types/index.ts - import from there for backend-facing code

export interface IngredientSynonym {
  synonym: string;
}

export interface IngredientForm {
  id?: number;
  ingredient_id?: number;
  name: string;
  comment?: string;
  score?: number | null;
  bioavailability?: string;
  timing?: string;
  is_recommended?: number;
}

export interface DosageGuideline {
  id: number;
  ingredient_id: number;
  source: 'DGE' | 'EFSA' | 'NIH' | 'study' | 'practice';
  source_title?: string;
  source_url?: string;
  population: string;
  dose_min?: number;
  dose_max?: number;
  unit?: string;
  frequency?: string;
  timing?: string;
  notes?: string;
  is_default: number;
}

export interface Ingredient {
  id: number;
  name: string;
  unit?: string;
  description?: string;
  synonyms?: IngredientSynonym[];
  forms?: IngredientForm[];
  hypo_symptoms?: string;
  hyper_symptoms?: string;
  external_url?: string;
  matched_form_id?: number | null;
  matched_form_name?: string | null;
}

export interface IngredientSubIngredient {
  parent_ingredient_id: number;
  child_ingredient_id: number;
  child_name: string;
  child_unit?: string;
  prompt_label?: string;
  sort_order?: number;
}

export interface ProductIngredient {
  ingredient_id: number;
  ingredient_name?: string;
  form_id?: number | null;
  quantity?: number;
  unit?: string;
  basis_quantity?: number | null;
  basis_unit?: string | null;
  is_main?: number;
  search_relevant?: number | boolean;
}

export interface UserProductIngredient {
  ingredient_id: number;
  form_id?: number | null;
  quantity?: number | null;
  unit?: string | null;
  basis_quantity: number;
  basis_unit: string;
  search_relevant: number | boolean;
  parent_ingredient_id?: number | null;
  ingredient_name?: string;
}

export interface Product {
  id: number;
  product_type?: 'catalog' | 'user_product';
  name: string;
  brand?: string;
  price: number;
  image_url?: string;
  image_r2_key?: string;
  shop_link?: string;
  form?: string;
  visibility?: string;
  /** Absent on user-products / lightweight API responses */
  moderation_status?: string;
  is_affiliate?: number;
  discontinued_at?: string;
  replacement_id?: number;
  serving_size?: number;
  serving_unit?: string;
  servings_per_container?: number;
  container_count?: number;
  /** Present on lightweight product-by-ingredient responses. */
  ingredient_id?: number;
  ingredient_name?: string;
  quantity?: number;
  unit?: string;
  basis_quantity?: number | null;
  basis_unit?: string | null;
  is_main?: number;
  timing?: string;
  ingredient_timing?: string | null;
  ingredient_timing_note?: string | null;
  ingredient_intake_hint?: string | null;
  dosage_text?: string;
  intake_interval_days?: number;
  ingredient_effect_summary?: string | null;
  effect_summary?: string;
  warning_title?: string;
  warning_message?: string;
  warning_type?: string;
  alternative_note?: string;
  ingredients?: ProductIngredient[];
}

export interface Recommendation {
  product_id: number;
  type: 'recommended' | 'alternative';
}

export interface ShopDomain {
  id: number;
  domain: string;
  display_name: string;
}

export interface Stack {
  id: number;
  name: string;
}
