-- Optimierte Indizes für bessere Performance

-- Users
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);

-- Wirkstoffe
CREATE INDEX IF NOT EXISTS idx_wirkstoffe_name ON wirkstoffe(name);

-- Synonyme für Suche
CREATE INDEX IF NOT EXISTS idx_wirkstoff_synonyme_synonym ON wirkstoff_synonyme(synonym);
CREATE INDEX IF NOT EXISTS idx_wirkstoff_synonyme_wirkstoff_id ON wirkstoff_synonyme(wirkstoff_id);

-- Formen
CREATE INDEX IF NOT EXISTS idx_wirkstoff_formen_wirkstoff_id ON wirkstoff_formen(wirkstoff_id);
CREATE INDEX IF NOT EXISTS idx_wirkstoff_formen_score ON wirkstoff_formen(score DESC);

-- Produkte
CREATE INDEX IF NOT EXISTS idx_produkte_name ON produkte(name);
CREATE INDEX IF NOT EXISTS idx_produkte_marke ON produkte(marke);
CREATE INDEX IF NOT EXISTS idx_produkte_status ON produkte(moderation_status);
CREATE INDEX IF NOT EXISTS idx_produkte_sichtbarkeit ON produkte(sichtbarkeit);
CREATE INDEX IF NOT EXISTS idx_produkte_preis ON produkte(preis);

-- Produkt-Wirkstoffe für schnelle Suche
CREATE INDEX IF NOT EXISTS idx_produkt_wirkstoffe_produkt_id ON produkt_wirkstoffe(produkt_id);
CREATE INDEX IF NOT EXISTS idx_produkt_wirkstoffe_wirkstoff_id ON produkt_wirkstoffe(wirkstoff_id);
CREATE INDEX IF NOT EXISTS idx_produkt_wirkstoffe_hauptwirkstoff ON produkt_wirkstoffe(ist_hauptwirkstoff);

-- Stacks
CREATE INDEX IF NOT EXISTS idx_stacks_user_id ON stacks(user_id);
CREATE INDEX IF NOT EXISTS idx_stacks_demo ON stacks(is_demo);
CREATE INDEX IF NOT EXISTS idx_stacks_session_key ON stacks(demo_session_key);
CREATE INDEX IF NOT EXISTS idx_stacks_expires ON stacks(expires_at);

-- Stack-Produkte
CREATE INDEX IF NOT EXISTS idx_stack_produkte_stack_id ON stack_produkte(stack_id);
CREATE INDEX IF NOT EXISTS idx_stack_produkte_produkt_id ON stack_produkte(produkt_id);

-- Empfehlungen
CREATE INDEX IF NOT EXISTS idx_wirkstoff_empfehlungen_wirkstoff_id ON wirkstoff_empfehlungen(wirkstoff_id);
CREATE INDEX IF NOT EXISTS idx_wirkstoff_empfehlungen_typ ON wirkstoff_empfehlungen(typ);
CREATE INDEX IF NOT EXISTS idx_wirkstoff_empfehlungen_reihenfolge ON wirkstoff_empfehlungen(reihenfolge);

-- Interaktionen
CREATE INDEX IF NOT EXISTS idx_wirkstoff_interaktionen_a ON wirkstoff_interaktionen(wirkstoff_a_id);
CREATE INDEX IF NOT EXISTS idx_wirkstoff_interaktionen_b ON wirkstoff_interaktionen(wirkstoff_b_id);
CREATE INDEX IF NOT EXISTS idx_wirkstoff_interaktionen_typ ON wirkstoff_interaktionen(typ);

-- Wunschliste
CREATE INDEX IF NOT EXISTS idx_wunschliste_user_id ON wunschliste(user_id);

-- Demo-Sessions für Cleanup
CREATE INDEX IF NOT EXISTS idx_demo_sessions_expires ON demo_sessions(expires_at);
CREATE INDEX IF NOT EXISTS idx_demo_sessions_key ON demo_sessions(session_key);