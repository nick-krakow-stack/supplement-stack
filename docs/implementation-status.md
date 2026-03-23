# Supplement Stack – Implementierungsstatus

Stand: 2026-03-23

---

## Backend (Hono + SQLite)

### ✅ Vollständig implementiert
- DB-Schema: alle 11 Tabellen (users, ingredients, ingredient_synonyms, ingredient_forms, products, product_ingredients, stacks, stack_items, recommendations, interactions, demo_sessions)
- Auth: Register, Login (JWT + Argon2id), GET /api/me
- Ingredients: GET /api/ingredients, GET /api/ingredients/search (inkl. Synonyme), POST /api/ingredients (Admin)
- Products: GET /api/products, POST /api/products (mit Main-Ingredient-Validierung + Duplikat-Check)
- Stacks: POST /api/stacks, GET /api/stacks/:id, GET /api/stack-warnings/:id
- Interactions: POST /api/interactions (Admin)
- Demo: POST /api/demo/sessions, GET /api/demo/sessions/:key, GET /api/demo/reset

### ❌ Fehlende Backend-Endpoints
- `PUT /api/me` – Profil aktualisieren
- `PUT /api/ingredients/:id` – Wirkstoff bearbeiten (Admin)
- `POST /api/ingredients/:id/synonyms` – Synonym hinzufügen (Admin)
- `DELETE /api/ingredients/:id/synonyms/:synId` – Synonym löschen (Admin)
- `POST /api/ingredients/:id/forms` – Form hinzufügen (Admin)
- `DELETE /api/ingredients/:id/forms/:formId` – Form löschen (Admin)
- `GET /api/recommendations?ingredient_id=x` – Empfehlungen abrufen
- `POST /api/recommendations` – Empfehlung setzen (Admin)
- `DELETE /api/recommendations/:id` – Empfehlung löschen (Admin)
- `GET /api/products/:id` – Produktdetails mit Wirkstoffen
- `PUT /api/products/:id/status` – Moderation: Status/Sichtbarkeit (Admin)
- `GET /api/stacks` – Alle Stacks des eingeloggten Nutzers
- `DELETE /api/stacks/:id` – Stack löschen
- `PUT /api/stacks/:id` – Stack umbenennen / Produkte ändern
- `POST /api/wishlist` – Wunschliste hinzufügen
- `GET /api/wishlist` – Wunschliste abrufen
- `DELETE /api/wishlist/:id` – Aus Wunschliste entfernen
- `GET /api/admin/products` – Alle Produkte inkl. pending (Admin)
- `GET /api/admin/stats` – Statistiken (Admin)
- `GET /api/interactions` – Alle Interaktionen abrufen
- `DELETE /api/interactions/:id` – Interaktion löschen (Admin)

---

## Frontend (React + Vite + Tailwind)

### ✅ Vollständig implementiert
- Vite + React + TypeScript Setup
- Tailwind CSS + PostCSS konfiguriert (tailwind.config.js erstellt)
- GitHub Actions → Cloudflare Pages Deployment funktioniert
- Minimales Test-UI: Login/Register, Wirkstoffsuche, Produktliste

### ❌ Fehlende Frontend-Bereiche (nahezu alles)

**Architektur:**
- React Router mit Seiten/Routen
- Modulare Komponentenstruktur (src/components/, src/pages/, src/hooks/, src/api/)
- Zentraler API-Client (axios-basiert, JWT-Handling)
- Globales State-Management (Auth-Context)

**Seiten & Features:**
- Login- / Register-Seite (eigene Seiten, nicht Inline-Form)
- Profil-Seite (Felder: Alter, Geschlecht, Gewicht, Ernährung, Ziele, Guideline-Quelle)
- Wirkstoffsuche mit Autocomplete (inkl. Synonyme)
  - Modal 1: Wirkstoffdetails (Infos, Formen, Warnungen, Empfehlungen)
  - Modal 2: Produktliste für Wirkstoff (empfohlen + Alternativen)
  - Modal 3: Dosierungsauswahl, Stack-Zuordnung, Preisberechnung
- Produktkarten (Bild, Name, Wirkstoffe, Dosis, Preis/Monat, Kauf-Button, Warnungen)
- Stack-Management-Seite (erstellen, umbenennen, Produkte verwalten, Interaktionswarnungen, Ampel)
- Wunschliste-Seite
- Demo-Modus / Playground (ohne Login, Banner, Session-Reset)
- Admin-Panel:
  - Produktmoderation (pending → approve/reject/hide)
  - Wirkstoff-CRUD (inkl. Synonyme, Formen)
  - Recommendations & Alternativen setzen
  - Interaktionen pflegen
  - Statistiken
- Footer: aktuelle Auswahl + Gesamtkosten, „Alle auswählen/abwählen"
- Responsive Design (Mobile + Desktop)

---

## Infrastruktur

### ✅ Implementiert
- GitHub Actions CI (backend + frontend build/test)
- GitHub Actions Deploy → Cloudflare Pages
- PostCSS/Tailwind Build-Pipeline

### ❌ Fehlt
- Backend-Hosting (derzeit kein Server – nur statisches Frontend deployed)
- Umgebungsvariablen für Production-Backend-URL im Frontend
- Wishlist-Tabelle fehlt noch im DB-Schema
