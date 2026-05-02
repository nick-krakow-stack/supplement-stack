# Codex Working Context

Stand: 2026-04-16

Diese Datei ist die laufende Arbeitsreferenz fuer die Weiterentwicklung von `supplement-stack`.
Die aelteren Markdown-Dateien im Projekt bleiben als Kontext erhalten, gelten aber nicht mehr automatisch als Source of Truth.

## Source Of Truth

- Aktiver Branch im Root-Repo: `main`
- Primaere App-Logik fuer produktionsnahe Entwicklung:
  - `functions/api/[[path]].ts`
  - `frontend/src/*`
  - `d1-migrations/*`
  - `wrangler.toml`
- Das klassische lokale Backend unter `backend/src/*` existiert weiter, ist aber funktional hinter der Cloudflare-/D1-Version zurueck.

## Projektstatus

- Frontend ist deutlich weiter entwickelt als die alte Doku vermuten laesst.
- Die aktive App nutzt React, Vite, TypeScript und einen `/api`-Client.
- Routing, Auth-Context, Search-Flow, Admin-UI, Demo-Flow, Wishlist, Stacks und User-Products sind bereits vorhanden.
- Das produktionsnahe Backend laeuft als Hono-App in `functions/api/[[path]].ts`.
- D1-, R2- und Pages-Konfiguration sind im Repo vorbereitet.

## Wichtige Architekturentscheidung

Es gibt aktuell zwei Backend-Linien:

1. `backend/src/*`
   - lokales Hono + SQLite
   - brauchbar fuer einfache lokale Entwicklung
   - nicht mehr die vollstaendigste Implementierung

2. `functions/api/[[path]].ts`
   - Hono auf Cloudflare Pages / Workers
   - D1 + R2 + produktionsnaehere Endpunkte
   - diese Linie ist fuer Weiterentwicklung zu bevorzugen

Fuer neue Features, Bugfixes und Datenmodellarbeit wird primaer die `functions`-Variante weitergefuehrt.

## Bereits bestaetigt

- Git-Remote:
  - `origin -> https://github.com/nick-krakow-stack/supplement-stack.git`
- Cloudflare ist lokal grundsaetzlich nutzbar:
  - `wrangler` ist installiert
  - lokales Cloudflare-Login ist vorhanden
  - Schreibrechte fuer `pages` und `d1` wurden bestaetigt
- Es besteht aktuell ein Account-Mismatch zwischen globalem Wrangler-Kontext und diesem Projekt.

## Cloudflare-Workflow

Da parallel an mehreren Projekten mit verschiedenen Cloudflare-Accounts gearbeitet wird, soll dieses Projekt nicht ueber das global aktive Wrangler-Login betrieben werden.

Stattdessen gilt:

- fuer `supplement-stack` projektlokalen Token + projektlokale Account-ID verwenden
- lokale Session ueber ein separates PowerShell-Skript laden
- GitHub Actions weiterhin ueber GitHub-Secrets laufen lassen

Hilfsdateien:

- `docs/cloudflare-accounts.md`
- `scripts/use-supplementstack-cloudflare.example.ps1`

Empfohlenes lokales Setup:

```powershell
Copy-Item .\scripts\use-supplementstack-cloudflare.example.ps1 .\scripts\use-supplementstack-cloudflare.local.ps1
. .\scripts\use-supplementstack-cloudflare.local.ps1
npx wrangler whoami
```

## Lokale Entwicklungsbasis

Das Frontend kann lokal direkt gegen die produktionsnahe Cloudflare-API entwickelt werden.

- lokale Datei: `frontend/.env.local`
- aktueller Wert:
  - `VITE_API_BASE_URL=https://supplementstack.pages.dev/api`

Damit ist lokale Frontend-Entwicklung nicht mehr vom alten SQLite-Backend abhaengig.
Das Legacy-Backend unter `backend/src/*` bleibt optionaler Fallback, ist aber nicht mehr Voraussetzung, um mit der App weiterzuarbeiten.

## Sicherheits- und Zugangshinweise

- Im lokalen Workspace existieren Hinweise auf echte Zugangsdaten in lokaler Tool-Konfiguration.
- Diese Werte werden waehrend der Arbeit nicht in Antworten ausgeschrieben.
- Vor echtem Launch sollten alle produktiven Tokens und Secrets rotiert werden.
- Bis dahin darf mit den vorhandenen lokalen Zugangsdaten gearbeitet werden, solange bewusst ist, dass sie spaeter ersetzt werden.

## Doku-Status

Folgende Dateien sind als historische oder potenziell veraltete Doku zu behandeln:

- `README.md`
- `DEPLOYMENT.md`
- `docs/implementation-status.md`
- `docs/agent-planner.md`

Sie bleiben nuetzlich fuer Kontext, spiegeln aber nicht zwingend den aktuellen Implementierungsstand wider.

## Arbeitsregeln Ab Jetzt

- Bei Unklarheiten gilt Code vor Doku.
- Bei Backend-Aenderungen zuerst die `functions`-Implementierung pruefen.
- Bei Datenmodell-Aenderungen immer relevante Migrationen mitpruefen.
- Bei Deployment-Fragen den projektlokalen Cloudflare-Kontext bevorzugen.
- Neue Erkenntnisse, Architekturentscheidungen oder operative Stolperstellen zuerst in dieser Datei festhalten.

## Naechste sinnvolle Schritte

- richtigen projektlokalen Cloudflare-Account fuer `supplement-stack` fest verdrahten
- produktionsnahe lokale Entwicklungsroutine festziehen
- Root-Doku spaeter bereinigen oder konsolidieren
- danach Feature-Entwicklung direkt auf Basis der `functions`- und `frontend`-Linie fortsetzen

## UI-Richtung Produktkarten

Produktkarten sollen nicht mehr als einfache Preis-/Packungs-Karten erscheinen.
Neue Zielrichtung:

- Masonry-/Kachel-Layout fuer Stack- und Demo-Uebersichten
- kleines rundes Produktbild statt grossem leerem Placeholder
- Hersteller/Brand prominent unterstuetzen
- Dosierung, Reichweite, Wirkung und Einnahmezeitpunkt direkt in der Karte anzeigen
- Warnhinweise sichtbar in der Karte platzieren
- Einmalkosten und Monatskosten getrennt berechnen
- direkter Shop-/Amazon-CTA
- Auswahlstatus direkt an der Karte plus Sticky-Auswahlfooter

Erster Umsetzungsschritt:

- `frontend/src/components/ProductCard.tsx` wurde auf diese Premium-Kartenlogik umgebaut
- `frontend/src/pages/DemoPage.tsx` nutzt responsive Masonry-Spalten und einen Sticky-Auswahlfooter
