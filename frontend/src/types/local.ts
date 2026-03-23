// Local types for the ingredient search feature
// These are defined here so each component can import from one place,
// but remain independent of any shared types that may not be merged yet.

export interface IngredientSynonym {
  synonym: string;
}

export interface IngredientForm {
  name: string;
  comment?: string;
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
}

export interface Product {
  id: number;
  name: string;
  brand?: string;
  price: number;
  image_url?: string;
  form?: string;
  visibility?: string;
  ingredients?: ProductIngredient[];
}

export interface Recommendation {
  product_id: number;
  type: 'recommended' | 'alternative';
}

export interface Stack {
  id: number;
  name: string;
}

export interface StackItem {
  product: Product;
  portions: number;
}
