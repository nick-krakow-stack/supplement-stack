-- Users table
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  name TEXT,
  alter INTEGER,
  geschlecht TEXT CHECK (geschlecht IN ('m', 'w', 'd')),
  gewicht REAL,
  ernaehrungsweise TEXT,
  ziele TEXT,
  guideline_quelle TEXT CHECK (guideline_quelle IN ('DGE', 'Studien', 'Influencer')) DEFAULT 'DGE',
  role TEXT CHECK (role IN ('user', 'admin')) DEFAULT 'user',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Wirkstoffe (Active Ingredients)
CREATE TABLE IF NOT EXISTS wirkstoffe (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT UNIQUE NOT NULL,
  einheit TEXT DEFAULT 'mg', -- mg, mcg, IE, g etc.
  beschreibung TEXT,
  hypo_symptome TEXT, -- Mangelsymptome
  hyper_symptome TEXT, -- Überdosis-Symptome
  external_url TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Synonyme für Wirkstoffe (z.B. B12, Methylcobalamin, Zyano)
CREATE TABLE IF NOT EXISTS wirkstoff_synonyme (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  wirkstoff_id INTEGER NOT NULL,
  synonym TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (wirkstoff_id) REFERENCES wirkstoffe(id) ON DELETE CASCADE,
  UNIQUE(wirkstoff_id, synonym)
);

-- Formen der Wirkstoffe (z.B. verschiedene B12-Formen)
CREATE TABLE IF NOT EXISTS wirkstoff_formen (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  wirkstoff_id INTEGER NOT NULL,
  name TEXT NOT NULL, -- z.B. "Methylcobalamin", "Cyanocobalamin"
  kommentar TEXT, -- z.B. "Zyano nicht empfohlen"
  tags TEXT, -- JSON array für zusätzliche Tags
  score INTEGER DEFAULT 0, -- Bewertung der Form (höher = besser)
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (wirkstoff_id) REFERENCES wirkstoffe(id) ON DELETE CASCADE
);

-- Produkte
CREATE TABLE IF NOT EXISTS produkte (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  marke TEXT,
  form TEXT, -- Tablette, Kapsel, Pulver, etc.
  preis REAL NOT NULL,
  einheit_anzahl INTEGER DEFAULT 1, -- Anzahl Kapseln/Tabletten
  einheit_text TEXT DEFAULT 'Stück', -- "Stück", "g", "ml"
  shop_link TEXT,
  affiliate_link TEXT,
  bild_url TEXT,
  moderation_status TEXT CHECK (moderation_status IN ('pending', 'approved', 'rejected')) DEFAULT 'pending',
  sichtbarkeit BOOLEAN DEFAULT TRUE,
  einreichung_user_id INTEGER, -- Wer hat das Produkt eingereicht
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (einreichung_user_id) REFERENCES users(id)
);

-- Wirkstoffe in Produkten (Many-to-Many Beziehung)
CREATE TABLE IF NOT EXISTS produkt_wirkstoffe (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  produkt_id INTEGER NOT NULL,
  wirkstoff_id INTEGER NOT NULL,
  ist_hauptwirkstoff BOOLEAN DEFAULT FALSE, -- TRUE für primäre Wirkstoffe
  menge REAL NOT NULL, -- Dosierung pro Portion
  einheit TEXT DEFAULT 'mg',
  form_id INTEGER, -- Referenz auf wirkstoff_formen
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (produkt_id) REFERENCES produkte(id) ON DELETE CASCADE,
  FOREIGN KEY (wirkstoff_id) REFERENCES wirkstoffe(id) ON DELETE CASCADE,
  FOREIGN KEY (form_id) REFERENCES wirkstoff_formen(id),
  UNIQUE(produkt_id, wirkstoff_id)
);

-- Stacks (Nutzerkombinationen)
CREATE TABLE IF NOT EXISTS stacks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER, -- NULL für Demo-Sessions
  name TEXT NOT NULL,
  beschreibung TEXT,
  is_demo BOOLEAN DEFAULT FALSE,
  demo_session_key TEXT, -- Für Demo-Sessions
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  expires_at DATETIME, -- Für Demo-Sessions (24h)
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Produkte in Stacks
CREATE TABLE IF NOT EXISTS stack_produkte (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  stack_id INTEGER NOT NULL,
  produkt_id INTEGER NOT NULL,
  dosierung REAL DEFAULT 1, -- Faktor (1 = normale Dosis, 0.5 = halbe Dosis)
  einnahmezeit TEXT, -- "Morgens", "Zum Frühstück", etc.
  notiz TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (stack_id) REFERENCES stacks(id) ON DELETE CASCADE,
  FOREIGN KEY (produkt_id) REFERENCES produkte(id) ON DELETE CASCADE,
  UNIQUE(stack_id, produkt_id)
);

-- Empfehlungen pro Wirkstoff (nur Admin)
CREATE TABLE IF NOT EXISTS wirkstoff_empfehlungen (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  wirkstoff_id INTEGER NOT NULL,
  produkt_id INTEGER NOT NULL,
  typ TEXT CHECK (typ IN ('empfohlen', 'alternative')) NOT NULL,
  reihenfolge INTEGER DEFAULT 0, -- Sortierung
  kommentar TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (wirkstoff_id) REFERENCES wirkstoffe(id) ON DELETE CASCADE,
  FOREIGN KEY (produkt_id) REFERENCES produkte(id) ON DELETE CASCADE,
  UNIQUE(wirkstoff_id, produkt_id, typ)
);

-- Interaktionen zwischen Wirkstoffen
CREATE TABLE IF NOT EXISTS wirkstoff_interaktionen (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  wirkstoff_a_id INTEGER NOT NULL,
  wirkstoff_b_id INTEGER NOT NULL,
  typ TEXT CHECK (typ IN ('warnung', 'vorsicht', 'positiv', 'neutral')) DEFAULT 'warnung',
  kommentar TEXT NOT NULL,
  schwere TEXT CHECK (schwere IN ('niedrig', 'mittel', 'hoch')) DEFAULT 'mittel',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (wirkstoff_a_id) REFERENCES wirkstoffe(id) ON DELETE CASCADE,
  FOREIGN KEY (wirkstoff_b_id) REFERENCES wirkstoffe(id) ON DELETE CASCADE,
  UNIQUE(wirkstoff_a_id, wirkstoff_b_id)
);

-- Wunschliste
CREATE TABLE IF NOT EXISTS wunschliste (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  produkt_id INTEGER NOT NULL,
  notiz TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (produkt_id) REFERENCES produkte(id) ON DELETE CASCADE,
  UNIQUE(user_id, produkt_id)
);

-- Audit Log für Admin-Änderungen
CREATE TABLE IF NOT EXISTS audit_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER,
  action TEXT NOT NULL,
  table_name TEXT NOT NULL,
  record_id INTEGER,
  old_values TEXT, -- JSON
  new_values TEXT, -- JSON
  ip_address TEXT,
  user_agent TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Sessions für Demo-Modus
CREATE TABLE IF NOT EXISTS demo_sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_key TEXT UNIQUE NOT NULL,
  stack_json TEXT, -- JSON der aktuellen Stack-Konfiguration
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  expires_at DATETIME NOT NULL,
  last_accessed DATETIME DEFAULT CURRENT_TIMESTAMP
);