export interface AdminStatsTrend {
  current: number;
  previous: number;
  delta: number;
  delta_percent: number | null;
}

export interface AdminStatsTopProduct {
  product_id: number;
  name: string;
  brand?: string | null;
  clicks: number;
  affiliate_clicks: number;
}

export interface AdminStatsTopShop {
  shop: string;
  clicks: number;
  affiliate_clicks: number;
}

export interface User {
  id: number;
  email: string;
  age?: number;
  guideline_source?: string;
  health_consent?: number;   // 0 or 1
  health_consent_at?: string;
  email_verified_at?: string | null;
  role: 'user' | 'admin';
}

export interface AdminStats {
  range?: string;
  users?: number;
  active_users?: number;
  registrations?: number;
  activated_users?: number;
  ingredients?: number;
  products_total?: number;
  products_pending?: number;
  products?: number;
  pending_products?: number;
  blocked_products?: number;
  stacks?: number;
  stacks_in_range?: number;
  stack_email_sends?: number;
  account_deletions?: number;
  inactive_users?: number;
  backlinks?: number;
  google_pageviews?: number;
  link_clicks?: number;
  affiliate_link_clicks?: number;
  non_affiliate_link_clicks?: number;
  products_clicked_without_active_link?: number;
  deadlink_clicks?: number;
  user_affiliate_links_active?: number;
  link_report_users?: number;
  ingredients_without_article?: number;
  user_products_pending?: number;
  user_products_pending_in_range?: number;
  open_link_reports?: number;
  deadlinks?: number;
  deadlinks_over_7_days?: number;
  previous?: {
    registrations?: number;
    activated_users?: number;
    stacks_in_range?: number;
    link_clicks?: number;
    affiliate_link_clicks?: number;
  };
  trends?: {
    registrations?: AdminStatsTrend;
    activated_users?: AdminStatsTrend;
    stacks_in_range?: AdminStatsTrend;
    link_clicks?: AdminStatsTrend;
    affiliate_link_clicks?: AdminStatsTrend;
  };
  top_clicked_products?: AdminStatsTopProduct[];
  top_shops?: AdminStatsTopShop[];
}

export interface IngredientSynonym {
  id: number;
  ingredient_id: number;
  synonym: string;
  language?: string | null;
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
  matched_form_id?: number | null;
  matched_form_name?: string | null;
}

export interface ProductIngredient {
  id: number;
  product_id: number;
  ingredient_id: number;
  is_main: boolean;
  quantity?: number;
  unit?: string;
  basis_quantity?: number | null;
  basis_unit?: string | null;
  form_id?: number;
  ingredient_name?: string;
  search_relevant?: number | boolean;
}

export interface ProductSafetyWarning {
  id: number;
  ingredient_id: number;
  short_label: string;
  popover_text: string;
  severity: 'info' | 'caution' | 'danger';
  article_slug?: string | null;
  article_title?: string | null;
  article_url?: string | null;
}

export interface FamilyMember {
  id: number;
  user_id?: number;
  first_name: string;
  age?: number | null;
  weight?: number | null;
  created_at?: string;
  updated_at?: string;
}

export interface Product {
  id: number;
  product_type?: 'catalog' | 'user_product';
  name: string;
  brand?: string;
  form?: string;
  price: number;
  shop_link?: string;
  click_url?: string;
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
  warnings?: ProductSafetyWarning[];
}

export interface StackItem {
  id: number;
  stack_id: number;
  product_id: number;
  product_type?: 'catalog' | 'user_product';
  quantity: number;
  intake_interval_days?: number;
  dosage_text?: string;
  timing?: string;
  ingredients?: Array<Pick<ProductIngredient, 'ingredient_id' | 'form_id' | 'quantity' | 'unit' | 'basis_quantity' | 'basis_unit' | 'search_relevant'>>;
  product?: Product;
}

export interface Stack {
  id: number;
  user_id?: number;
  name: string;
  family_member_id?: number | null;
  family_member_first_name?: string | null;
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

export interface KnowledgeArticleSource {
  label: string;
  url: string;
  name?: string;
  link?: string;
}

export interface KnowledgeArticleIngredient {
  ingredient_id: number;
  name: string | null;
  sort_order?: number | null;
}

export interface KnowledgeArticle {
  slug: string;
  title: string;
  summary: string;
  body: string;
  reviewed_at?: string | null;
  conclusion?: string | null;
  featured_image_url?: string | null;
  dose_min?: number | null;
  dose_max?: number | null;
  dose_unit?: string | null;
  product_note?: string | null;
  sources: KnowledgeArticleSource[];
  ingredients?: KnowledgeArticleIngredient[];
  ingredient_ids?: number[];
  created_at?: string;
  updated_at?: string;
}
