-- Cloudflare D1 Database Schema für Supplement Stack
-- Erstellt: 2025-08-25
-- Kompatibel mit SQLite (D1 Database)

-- Products Tabelle - Einzelne Supplement-Produkte
CREATE TABLE IF NOT EXISTS products (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    brand TEXT NOT NULL,
    serving_size TEXT NOT NULL,
    cost_per_serving REAL NOT NULL,
    servings_per_container INTEGER NOT NULL,
    total_cost REAL GENERATED ALWAYS AS (cost_per_serving * servings_per_container) STORED,
    category TEXT,
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Stacks Tabelle - Supplement-Kombinationen
CREATE TABLE IF NOT EXISTS stacks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT,
    goal TEXT,
    is_active BOOLEAN DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Stack Items Tabelle - Produkte innerhalb eines Stacks
CREATE TABLE IF NOT EXISTS stack_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    stack_id INTEGER NOT NULL,
    product_id INTEGER NOT NULL,
    daily_servings REAL NOT NULL DEFAULT 1.0,
    timing TEXT, -- z.B. "morning", "evening", "pre-workout"
    notes TEXT,
    is_active BOOLEAN DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (stack_id) REFERENCES stacks(id) ON DELETE CASCADE,
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
);

-- Ingredients Tabelle - Inhaltsstoffe (für zukünftige Features)
CREATE TABLE IF NOT EXISTS ingredients (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    category TEXT,
    unit TEXT DEFAULT 'mg',
    description TEXT,
    daily_value REAL,
    upper_limit REAL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Product Ingredients Tabelle - Verknüpfung Produkte zu Inhaltsstoffen
CREATE TABLE IF NOT EXISTS product_ingredients (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    product_id INTEGER NOT NULL,
    ingredient_id INTEGER NOT NULL,
    amount_per_serving REAL NOT NULL,
    unit TEXT DEFAULT 'mg',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
    FOREIGN KEY (ingredient_id) REFERENCES ingredients(id) ON DELETE CASCADE,
    UNIQUE(product_id, ingredient_id)
);

-- Users Tabelle - Einfache Benutzerverwaltung (für zukünftige Multi-User Features)
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE,
    name TEXT,
    preferences TEXT, -- JSON für Benutzereinstellungen
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Indexes für Performance
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);
CREATE INDEX IF NOT EXISTS idx_products_brand ON products(brand);
CREATE INDEX IF NOT EXISTS idx_stack_items_stack_id ON stack_items(stack_id);
CREATE INDEX IF NOT EXISTS idx_stack_items_product_id ON stack_items(product_id);
CREATE INDEX IF NOT EXISTS idx_product_ingredients_product_id ON product_ingredients(product_id);
CREATE INDEX IF NOT EXISTS idx_product_ingredients_ingredient_id ON product_ingredients(ingredient_id);

-- Trigger für updated_at Felder
CREATE TRIGGER IF NOT EXISTS update_products_timestamp 
    AFTER UPDATE ON products
    BEGIN
        UPDATE products SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
    END;

CREATE TRIGGER IF NOT EXISTS update_stacks_timestamp 
    AFTER UPDATE ON stacks
    BEGIN
        UPDATE stacks SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
    END;

CREATE TRIGGER IF NOT EXISTS update_users_timestamp 
    AFTER UPDATE ON users
    BEGIN
        UPDATE users SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
    END;