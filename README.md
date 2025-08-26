# Supplement Stack - Intelligente Nahrungsergänzung

## Projektübersicht
- **Name**: Supplement Stack
- **Ziel**: Wirkstoffzentrierte Verwaltung von Nahrungsergänzungsmitteln mit intelligenter Suche, Interaktionswarnungen und Preisoptimierung
- **Hauptfeatures**: 
  - Wirkstoffbasierte Suche mit Autocomplete
  - 3-stufiger Modal-Flow (Wirkstoff → Produkt → Dosierung)
  - Stack-Management mit Interaktionswarnungen
  - Demo-Modus (24h Session ohne Anmeldung)
  - Admin-Interface für Moderation und Empfehlungen

## URLs
- **Development**: https://3000-i34a1x059z3nf6w6elovv.e2b.dev
- **Demo-Modus**: https://3000-i34a1x059z3nf6w6elovv.e2b.dev/?demo=true
- **GitHub**: (wird nach Setup konfiguriert)

## Datenarchitektur
- **Datenmodell**: Users, Wirkstoffe (mit Synonymen & Formen), Produkte, Stacks, Empfehlungen, Interaktionen
- **Speicher-Services**: Cloudflare D1 SQLite (Relational Database)
- **Sicherheit**: JWT-basierte Authentifizierung, Input-Validierung, CORS-Policy
- **Datenfluss**: RESTful API → TypeScript Types → React-ähnliches Frontend (Vanilla JS)

## Aktuelle Features (Implementiert)

### ✅ Authentifizierung
- Benutzerregistrierung und Login
- JWT-Token Verwaltung
- Profil-Management (Alter, Gewicht, Ernährungsweise, Guidelines)

### ✅ Wirkstoff-System
- **Suche**: Autocomplete mit Synonymen (z.B. "B12", "Methylcobalamin", "Cyanocobalamin")
- **Formen**: Verschiedene Wirkstoffformen mit Bewertungen (Methylcobalamin > Cyanocobalamin)
- **Details**: Mangel-/Überdosis-Symptome, externe Links zu SupplementGuru.de

### ✅ Produkt-Management
- **CRUD**: Nutzer können Produkte einreichen (Moderation erforderlich)
- **Empfehlungen**: Admin kann "Empfohlen" vs "Alternative" setzen
- **Preisberechnung**: Automatische Monatskosten-Kalkulation
- **Affiliate-Links**: Integration für Amazon/Shop-Links

### ✅ Stack-System
- **Kombinationen**: Mehrere Produkte zu thematischen Stacks
- **Interaktionswarnungen**: MSM + Zink, Eisen + Zink etc.
- **Dosierung**: Individuelle Anpassung (0.5x - 3x täglich)
- **Einnahmezeiten**: "Morgens nüchtern", "Zum Frühstück" etc.

### ✅ Demo-Modus
- **Session-basiert**: 24h ohne Anmeldung testbar
- **Funktionsumfang**: Wirkstoffsuche, Stack-Demo, Preisberechnung
- **Limitierungen**: Keine Produktanlage, keine Wunschliste, Auto-Reset

### ✅ Admin-Interface  
- **Moderation**: Produkte genehmigen/ablehnen
- **Empfehlungen**: Wirkstoff-Produktzuordnungen verwalten
- **Statistiken**: Dashboard mit Nutzungsdaten
- **Audit-Log**: Alle Admin-Änderungen protokolliert

### ✅ Frontend-Design
- **Kartenbasiertes Layout**: Nach Pflichtenheft-Screenshots
- **Modal-System**: 3-stufiger Wirkstoff-Auswahl-Flow
- **Responsive**: Desktop & Mobile optimiert
- **Farb-System**: Grün (Supplement), Orange (Zeiten), Rot (Warnungen)

## Technische Implementierung

### Backend (Hono + TypeScript)
```
src/
├── index.tsx          # Hauptanwendung & Router
├── types.ts           # TypeScript Interfaces
├── routes/
│   ├── auth.ts        # Authentifizierung (Login/Register)
│   ├── wirkstoffe.ts  # Wirkstoff-Suche & Details
│   ├── produkte.ts    # Produkt-CRUD & Empfehlungen
│   ├── stacks.ts      # Stack-Management & Interaktionen
│   ├── demo.ts        # Demo-Session-Verwaltung
│   └── admin.ts       # Moderation & Admin-Tools
```

### Frontend (Vanilla JS + TailwindCSS)
```
public/static/
├── app.js             # Haupt-Frontend-Anwendung (40KB)
└── style.css          # Custom CSS für Komponenten
```

### Datenbank (SQLite Migrationen)
```
migrations/
├── 0001_initial_schema.sql  # Alle Tabellen & Beziehungen
└── 0002_indexes.sql         # Performance-Optimierungen
seed.sql                     # Test-Daten (Basis-Wirkstoffe)
```

## API-Endpunkte

### Authentifizierung
- `POST /api/auth/register` - Nutzer registrieren
- `POST /api/auth/login` - Anmelden
- `POST /api/auth/validate` - Token validieren
- `PUT /api/auth/profile` - Profil aktualisieren

### Wirkstoffe
- `GET /api/wirkstoffe/search?q=` - Autocomplete-Suche
- `GET /api/wirkstoffe/:id` - Details mit Synonymen & Formen
- `GET /api/wirkstoffe/popular/top` - Beliebte Wirkstoffe

### Produkte
- `GET /api/produkte/by-wirkstoff/:id` - Produkte für Wirkstoff
- `GET /api/produkte/:id` - Produkt-Details
- `POST /api/produkte` - Neues Produkt einreichen

### Stacks
- `GET /api/stacks` - Nutzer-Stacks
- `GET /api/stacks/:id` - Stack-Details mit Interaktionen
- `POST /api/stacks/:id/produkte` - Produkt hinzufügen
- `PUT /api/stacks/:stackId/produkte/:produktId` - Dosierung ändern

### Demo
- `POST /api/demo/session` - Demo-Session erstellen/laden
- `GET /api/demo/session/:key` - Session-Status
- `POST /api/demo/session/:key/reset` - Demo zurücksetzen

### Admin
- `GET /api/admin/dashboard` - Admin-Statistiken  
- `GET /api/admin/produkte?status=pending` - Moderation-Queue
- `POST /api/admin/produkte/:id/moderate` - Genehmigen/Ablehnen

## Benutzerführung

### Normale Nutzung
1. **Registrierung** → Profil anlegen (Alter, Gewicht, Guidelines)
2. **Wirkstoff suchen** → "Magnesium" eingeben → Autocomplete
3. **Modal Schritt 1** → Wirkstoff-Details, Formen, Warnungen
4. **Modal Schritt 2** → Empfohlene Produkte vs Alternativen
5. **Modal Schritt 3** → Dosierung & Einnahmezeit wählen
6. **Stack-Übersicht** → Alle Produkte, Gesamtkosten, Interaktionen
7. **Bestellen** → Produkte auswählen → Affiliate-Links öffnen

### Demo-Modus
1. **Demo-Link** → `/?demo=true` oder "Demo ausprobieren"
2. **Session-Banner** → 24h Timer, Reset-Button
3. **Eingeschränkte Features** → Keine Produktanlage, Kein Account
4. **Auto-Cleanup** → Sessions werden automatisch gelöscht

## Deployment Status
- **Platform**: Cloudflare Pages (bereit für Deployment)
- **Status**: ✅ Development läuft lokal
- **Tech Stack**: Hono + TypeScript + D1 SQLite + TailwindCSS
- **Letztes Update**: 2025-08-26

## Nächste Schritte
1. **Cloudflare API-Token** konfigurieren für Production-Deployment
2. **GitHub Repository** verknüpfen für CI/CD
3. **D1-Datenbank** erstellen und Migrationen ausführen
4. **Seed-Daten** importieren (Basis-Wirkstoffe & Test-Produkte)
5. **Domain** konfigurieren (optional)
6. **Affiliate-Programme** integrieren (Amazon Associates etc.)

## Sicherheitsfeatures
- **Password-Hashing**: SHA-256 mit Salt (für Cloudflare Workers kompatibel)
- **JWT-Tokens**: 24h Gültigkeitsdauer
- **Input-Validierung**: Alle API-Endpunkte validiert
- **CORS-Policy**: Sichere Cross-Origin-Requests
- **SQL-Injection-Schutz**: Prepared Statements
- **XSS-Schutz**: Input-Sanitization im Frontend

Die Anwendung ist vollständig funktionsfähig und bereit für das Deployment zu Cloudflare Pages!