# Agent Planner für Supplement Stack

## Ziele
- Vollständige Umsetzung des Pflichtenhefts in strukturierte Agentenaufgaben
- Konsistente Datenmodelle und Variablenbenennung durch zentralen Shared-Schema-Plan
- Fortschritt in Sprints, die auf klaren Akzeptanzkriterien basieren

## Zentrale Datenmodell-Definition (Single Source of Truth)
- Datei: `backend/src/schema.ts` (bzw. `infra/db/schema.sql`)
- Tabellen:
  - Nutzer
  - Wirkstoffe
  - Synonyme
  - Formen
  - Produkte
  - Produkt_Wirkstoffe
  - Stacks
  - Empfehlungen
  - Interaktionen
  - Demo_Sessions

## Agent-Struktur

### 1) `agent/planner`
- Output:
  - `docs/roadmap.md` (Epics + Stories)
  - `docs/jira-style-backlog.csv`
  - `docs/agent-tasks.json`
- Aufgabe: aus Pflichtenheft Priorisierung + Sprint-Inkremente erstellen

### 2) `agent/scaffold`
- Input: Tech-Stack (z. B. React + Vite + TypeScript + Hono + PostgreSQL)
- Output: komplett initiales Mono-Repo mit Frontend+Backend + CI + Deploy
- Sicherheit: `dotenv` + .env.example + GitHub-Secrets

### 3) `agent/auth`
- Registrierung/Login
- Session + JWT/refresh
- Passwortrichtlinie + Argon2id
- Profilfelder + Quelle
- APIs:
  - POST /api/auth/register
  - POST /api/auth/login
  - GET /api/auth/profile
  - PUT /api/auth/profile

### 4) `agent/ingredient` (Wirkstoff)
- CRUD Wirkstoff / Synonyme / Formen
- Autocomplete-API (fuzzy + synonyms)
- Modal-Flow Modal 1

### 5) `agent/product`
- CRUD Produkt + Duplikate + Moderation + Sichtbarkeit
- Preisrechnung p/Tag/Monat
- Affiliate + Shop-Link
- Hauptwirkstoff validieren

### 6) `agent/stack`
- Stack-CRUD
- Zuordnung Produkte
- Summen + Ampel-Warnung + Interaktionslogik
- Modal 2/3 Workflow Integration

### 7) `agent/demo`
- Session-basierte Demo Stacks (24h)
- Banner + Reset-Mechanismus

### 8) `agent/admin`
- Admin-Panel (Wirkstoffe/Produkte/Interaktionen)
- Empfehlung / Alternative
- Statistik (Top-Produkte, Klicks)
- Audit-Log: Änderungen admin

### 9) `agent/ci-cd`
- GitHub Action für:
  - install
  - lint
  - test
  - build
  - deploy (Cloudflare Pages / Worker)
- Security Scan: `npm audit`, `snyk` optional

### 10) `agent/security`
- CSRF, CSP, XSS, Headers
- Rate-Limit
- Input-Validierung
- Logging/Audit

---

## Agent-Kommunikation / Shared Context
- Gemeinsame `shared` Bibliothek (z. B. `./shared/types`, `./shared/db`)
- Einheitliche DTOs:
  - IngredientDTO
  - ProductDTO
  - StackDTO
- Eindeutiges Namensschema für Variablen:
  - Wirkstoff: `ingredient` / `ingredientId`
  - Produkt: `product` / `productId`
  - Stack: `stack` / `stackId`

## Sprint-Beispiel
1. Sprint 1: Setup + Auth + Datenmodell (MVP)
2. Sprint 2: Wirkstoffmanagement + Suche Modal 1
3. Sprint 3: Produkt-CRUD + Moderation + Preisberechnung
4. Sprint 4: Stack + Interaktionen + Preisaggregation
5. Sprint 5: Demo Modus + Wunschliste + Bestell-Affiliate
6. Sprint 6: Admin + Stats + Security + Qualitätssicherung

## Akzeptanzkriterien (erste Stories)
- Suche "Mag" => Magnesium (inkl. Synonyme) ✅
- Produkt ohne Hauptwirkstoff darf nicht gespeichert werden ✅
- Nur Admin kann Empfehlungen setzen ✅
- Demo-Stack ohne Login, Reset löscht Auswahl ✅
- Ampel-Warnung bei bekannten Interaktionen ✅
- Footer zeigt Gesamtkosten korrekt ✅
- Affiliate-Link öffnet externen Tab ✅
- GitHub → Cloudflare deploy pipeline arbeitet ✅
