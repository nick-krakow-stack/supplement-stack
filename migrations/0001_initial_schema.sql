-- Supplement Stack - Initial Database Schema
-- Based on the detailed Pflichtenheft requirements

-- Users table with profile information
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  google_id TEXT UNIQUE,
  
  -- Profile fields from requirement 2.1
  age INTEGER,
  gender TEXT CHECK (gender IN ('männlich', 'weiblich', 'divers')),
  weight REAL,
  diet_type TEXT CHECK (diet_type IN ('omnivore', 'vegetarisch', 'vegan')),
  personal_goals TEXT,
  
  -- Guideline source preference
  guideline_source TEXT CHECK (guideline_source IN ('DGE', 'studien', 'influencer')) DEFAULT 'DGE',
  
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Nutrients/Wirkstoffe table
CREATE TABLE IF NOT EXISTS nutrients (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  synonyms TEXT, -- JSON array of alternative names
  standard_unit TEXT NOT NULL, -- mg, µg, IU, etc.
  external_article_url TEXT NOT NULL, -- Required field for external links
  link_label TEXT, -- Optional label for the link
  
  -- Reference values for different sources
  dge_recommended REAL,
  study_recommended REAL,
  influencer_recommended REAL,
  
  -- Safety information
  max_safe_dose REAL,
  warning_threshold REAL,
  
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Products table with all supplement information
CREATE TABLE IF NOT EXISTS products (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  
  -- Basic product info
  name TEXT NOT NULL,
  brand TEXT NOT NULL,
  form TEXT NOT NULL, -- Kapsel, Öl, Pulver, etc.
  
  -- Pricing and packaging
  price_per_package REAL NOT NULL,
  servings_per_package INTEGER NOT NULL,
  
  -- Links and media
  shop_url TEXT NOT NULL,
  affiliate_url TEXT, -- Processed affiliate link
  image_url TEXT,
  
  -- Duplicate detection
  is_duplicate BOOLEAN DEFAULT FALSE,
  duplicate_of INTEGER,
  
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (duplicate_of) REFERENCES products(id)
);

-- Product ingredients/Wirkstoffe - many-to-many relationship
CREATE TABLE IF NOT EXISTS product_nutrients (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id INTEGER NOT NULL,
  nutrient_id INTEGER NOT NULL,
  amount REAL NOT NULL,
  unit TEXT NOT NULL,
  amount_standardized REAL NOT NULL, -- Converted to standard unit
  
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
  FOREIGN KEY (nutrient_id) REFERENCES nutrients(id),
  UNIQUE(product_id, nutrient_id)
);

-- Stacks table
CREATE TABLE IF NOT EXISTS stacks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Stack products with dosages
CREATE TABLE IF NOT EXISTS stack_products (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  stack_id INTEGER NOT NULL,
  product_id INTEGER NOT NULL,
  dosage_per_day REAL NOT NULL,
  dosage_source TEXT CHECK (dosage_source IN ('DGE', 'studien', 'influencer', 'custom')) DEFAULT 'custom',
  custom_dosage REAL,
  
  FOREIGN KEY (stack_id) REFERENCES stacks(id) ON DELETE CASCADE,
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
  UNIQUE(stack_id, product_id)
);

-- User notes for products (requirement 2.5)
CREATE TABLE IF NOT EXISTS user_notes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  product_id INTEGER NOT NULL,
  note TEXT NOT NULL,
  
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
  UNIQUE(user_id, product_id)
);

-- Wishlist (requirement 2.6)
CREATE TABLE IF NOT EXISTS wishlist (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  product_id INTEGER NOT NULL,
  
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
  UNIQUE(user_id, product_id)
);

-- Affiliate link management (requirement 3.1)
CREATE TABLE IF NOT EXISTS affiliate_links (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  original_url TEXT NOT NULL,
  affiliate_url TEXT,
  click_count INTEGER DEFAULT 0,
  needs_processing BOOLEAN DEFAULT TRUE,
  
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  processed_at DATETIME
);

-- Affiliate click tracking
CREATE TABLE IF NOT EXISTS affiliate_clicks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  affiliate_link_id INTEGER NOT NULL,
  user_id INTEGER,
  ip_address TEXT, -- Anonymized/hashed
  user_agent TEXT,
  
  clicked_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  
  FOREIGN KEY (affiliate_link_id) REFERENCES affiliate_links(id),
  FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Guidelines/Sources table
CREATE TABLE IF NOT EXISTS guidelines (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  source_name TEXT NOT NULL, -- DGE, Studien, Influencer
  source_type TEXT NOT NULL,
  nutrient_id INTEGER NOT NULL,
  recommended_dose REAL NOT NULL,
  unit TEXT NOT NULL,
  reference_url TEXT,
  
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  
  FOREIGN KEY (nutrient_id) REFERENCES nutrients(id)
);

-- Interaction warnings between nutrients
CREATE TABLE IF NOT EXISTS nutrient_interactions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nutrient_a_id INTEGER NOT NULL,
  nutrient_b_id INTEGER NOT NULL,
  interaction_type TEXT CHECK (interaction_type IN ('positive', 'negative', 'caution')) NOT NULL,
  description TEXT NOT NULL,
  reference_url TEXT,
  
  FOREIGN KEY (nutrient_a_id) REFERENCES nutrients(id),
  FOREIGN KEY (nutrient_b_id) REFERENCES nutrients(id),
  UNIQUE(nutrient_a_id, nutrient_b_id)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_products_user_id ON products(user_id);
CREATE INDEX IF NOT EXISTS idx_products_duplicate ON products(is_duplicate, duplicate_of);
CREATE INDEX IF NOT EXISTS idx_product_nutrients_product ON product_nutrients(product_id);
CREATE INDEX IF NOT EXISTS idx_product_nutrients_nutrient ON product_nutrients(nutrient_id);
CREATE INDEX IF NOT EXISTS idx_stacks_user_id ON stacks(user_id);
CREATE INDEX IF NOT EXISTS idx_stack_products_stack ON stack_products(stack_id);
CREATE INDEX IF NOT EXISTS idx_user_notes_user_product ON user_notes(user_id, product_id);
CREATE INDEX IF NOT EXISTS idx_wishlist_user_id ON wishlist(user_id);
CREATE INDEX IF NOT EXISTS idx_affiliate_clicks_link ON affiliate_clicks(affiliate_link_id);
CREATE INDEX IF NOT EXISTS idx_guidelines_nutrient ON guidelines(nutrient_id);