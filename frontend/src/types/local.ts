// Local types for the ingredient search + stack Modal-Flow
// DB/Admin types live in types/index.ts — import from there for backend-facing code

export interface IngredientSynonym {
  synonym: string;
}

export interface IngredientForm {
  name: string;
  comment?: string;
  bioavailability?: string;
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
}

export interface ProductIngredient {
  ingredient_id: number;
  ingredient_name?: string;
  quantity?: number;
  unit?: string;
  is_main?: number;
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
  is_main?: number;
  timing?: string;
  dosage_text?: string;
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

/**
 * UI-only stack item used in the Modal-Flow (SearchPage / DemoPage).
 * Renamed from StackItem to avoid collision with the DB type in types/index.ts.
 */
export interface LocalStackItem {
  product: Product;
  portions: number;
  daysSupply?: number;
  monthlyPrice?: number;
}
