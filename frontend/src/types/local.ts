// Local types for the ingredient search + stack features

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

export interface Product {
  id: number;
  name: string;
  brand?: string;
  price: number;
  image_url?: string;
  shop_link?: string;
  form?: string;
  visibility?: string;
  is_affiliate?: number;
  discontinued_at?: string;
  serving_size?: number;
  serving_unit?: string;
  servings_per_container?: number;
  container_count?: number;
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

export interface StackItem {
  product: Product;
  portions: number;
  daysSupply?: number;
  monthlyPrice?: number;
}
