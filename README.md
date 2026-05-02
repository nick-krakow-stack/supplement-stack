# Supplement Stack

Supplement Stack ist eine wirkstoffzentrierte Supplement-Verwaltung mit Suche,
Demo-Modus, Stack-Planung, Wishlist, Produktverwaltung, Admin-Funktionen und
wissenschaftlich getrennten Dosierungsempfehlungen.

## Aktive Linie

Die produktionsnahe Entwicklung laeuft auf Cloudflare:

- Frontend: React, TypeScript, Vite, Tailwind CSS in `frontend/`
- API: Cloudflare Pages Functions mit Hono in `functions/api/`
- Datenbank: Cloudflare D1, Migrationen in `d1-migrations/`
- Datei-Storage: Cloudflare R2 fuer Produktbilder
- KV: Cloudflare KV fuer Rate-Limit-/Cache-nahe Bindings
- Deployment und Ops: Wrangler CLI und GitHub Actions
- Konfiguration: `wrangler.toml`

Code und D1-Migrationen sind die finale Quelle, wenn alte Dokumentation
abweicht.

## Schnellstart

```powershell
.\scripts\setup-local-dev.ps1
cd frontend
npm run dev
```

Das lokale Frontend nutzt in Vite-Dev optional `VITE_API_BASE_URL`, wenn es auf
`localhost`, `127.0.0.1` oder `::1` laeuft. Produktionsbuilds verwenden
same-origin `/api`.

Cloudflare-Befehle sollten mit dem projektlokalen Cloudflare-Kontext laufen:

```powershell
. .\scripts\use-supplementstack-cloudflare.local.ps1
npx wrangler whoami
```

Die lokale `.local.ps1`-Datei enthaelt Zugangsdaten und darf nicht committed
werden.

## Projektstruktur

- `frontend/src/*` - React-App, Pages, Komponenten und API-Client
- `functions/api/[[path]].ts` - Hono Composition Root fuer Pages Functions
- `functions/api/modules/*` - API-Module fuer Auth, Ingredients, Products,
  Stacks, Wishlist, Demo, Admin und User-Produkte
- `functions/api/lib/*` - gemeinsame Worker-kompatible Helper
- `d1-migrations/*` - D1-Schema- und Datenmigrationen
- `wrangler.toml` - Cloudflare Pages/D1/R2/KV-Bindings
- `.github/workflows/*` - CI, Pages-Deploy und D1-Backup
- `.agent-memory/*` - aktueller gemeinsamer Agent-Kontext
- `docs/*` - Projekt- und historische Planungsdokumente

## Legacy-Hinweis

Falls ein klassisches `backend/` oder alte SQLite-Dokumentation auftaucht, ist
das historische bzw. lokale Kontextinformation. Neue produktionsnahe Arbeit
gehoert auf die Cloudflare-Linie unter `functions/`, `frontend/`,
`d1-migrations/` und `wrangler.toml`.

## Deployment

Der regulaere Deploy laeuft ueber Cloudflare Pages:

1. Frontend-Abhaengigkeiten installieren.
2. Functions-Abhaengigkeiten installieren.
3. `frontend` bauen.
4. D1-Migrationen remote anwenden.
5. `functions/` in `frontend/dist/` kopieren.
6. `frontend/dist` nach Cloudflare Pages deployen.

Siehe `DEPLOYMENT.md` fuer genaue Wrangler- und GitHub-Actions-Angaben.

## Wichtige Features

- Email/Passwort-Auth und Rollen
- Wirkstoffsuche mit Synonymen, Formen und Detailmodal
- Produktlisten, Produktdetails und Produktmoderation
- Stack-Erstellung mit Kosten- und Interaktionslogik
- Wishlist und eigene Produkte
- 24h-Demo-Modus
- Admin-Backend fuer Inhalte, Produktdaten und Audit-Logging
- Public Dose-Recommendations-API auf Basis von `dose_recommendations`
