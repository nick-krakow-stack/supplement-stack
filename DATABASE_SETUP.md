# Database Setup für Supplement Stack Production

## Problem
Die Authentifizierung funktioniert, aber alle geschützten Seiten (Dashboard, Produkte, Stacks) zeigen Serverfehler an, da die D1-Datenbank keine Tabellen enthält (`num_tables: 0`).

## Lösung
Die Produktionsdatenbank muss mit den erforderlichen Tabellen initialisiert werden.

## Schnelle Lösung (Empfohlen)

### 1. Überprüfe den aktuellen Datenbankstatus
```bash
./check_db_status.sh
```

### 2. Führe das Database-Setup aus
```bash
./setup_production_db.sh
```

Das war's! Die Skripte erledigen alles automatisch.

## Manuelle Ausführung (Falls nötig)

### Voraussetzungen
- Lokale Installation mit Cloudflare-Zugang
- Wrangler CLI authentifiziert

### 1. Cloudflare-Authentifizierung prüfen
```bash
npx wrangler whoami
```

Falls nicht angemeldet:
```bash
npx wrangler login
```

### 2. Datenbank-Migration ausführen
```bash
npx wrangler d1 execute supplementstack-production --file=./complete_migration.sql --env=production
```

### 3. Erfolg überprüfen
```bash
npx wrangler d1 execute supplementstack-production --command="SELECT name FROM sqlite_master WHERE type='table' ORDER BY name;" --env=production
```

## Was wird erstellt?

### Kerntabellen
- `users` - Benutzerkonten mit E-Mail-Verifizierung
- `products` - Supplement-Produkte
- `stacks` - Benutzer-Supplement-Kombinationen  
- `wishlist` - Wunschlisten
- `categories` - Supplement-Kategorien
- `nutrients` - Nährstoffe/Wirkstoffe

### Zusätzliche Tabellen
- `product_nutrients` - Produkt-Nährstoff-Zuordnungen
- `stack_products` - Stack-Produkt-Zuordnungen
- `user_notes` - Benutzernotizen
- `email_verification_tokens` - E-Mail-Verifizierung
- `affiliate_links` - Affiliate-Link-Verwaltung
- `guidelines` - Dosierungsrichtlinien
- `nutrient_interactions` - Nährstoff-Wechselwirkungen

### Indizierung
Alle wichtigen Felder werden indiziert für optimale Performance.

### Seed-Daten
- 10 Supplement-Kategorien (Vitamine, Mineralstoffe, etc.)
- Basis-Nährstoffe (Vitamin D3, Magnesium, B12, etc.)

## Nach der Migration

1. **Teste die Authentifizierung**: Melde dich bei https://supplementstack.de an
2. **Prüfe das Dashboard**: Sollte keine Fehlermeldung mehr zeigen
3. **Teste Produkte/Stacks**: Alle geschützten Bereiche sollten funktionieren

## Fehlerbehebung

### "Database not found"
- Prüfe in `wrangler.toml` die database_id
- Liste verfügbare Datenbanken: `npx wrangler d1 list`

### "Migration failed"  
- Prüfe Wrangler-Authentifizierung: `npx wrangler whoami`
- Aktualisiere Wrangler: `npm install -g wrangler@latest`

### "Tabellen existieren bereits"
- Die Migration verwendet `CREATE TABLE IF NOT EXISTS` - sicher ausführbar

## Wichtige Dateien

- `complete_migration.sql` - Vollständige Datenbank-Migration
- `setup_production_db.sh` - Automatisiertes Setup-Skript  
- `check_db_status.sh` - Status-Überprüfung
- `wrangler.toml` - Cloudflare-Konfiguration mit D1-Bindung