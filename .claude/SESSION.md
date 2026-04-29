# SESSION.md — Supplement Stack (LEGACY)

> **Hinweis (2026-04-29):** Diese Datei ist Legacy. Kanonisches Memory liegt jetzt unter `.agent-memory/*` (siehe `AGENTS.md`).
> Der "Aktueller Stand"-Abschnitt unten ist eingefroren auf 2026-04-19/20 und wird nicht mehr gepflegt.
> Was hier weiterhin lebt: die "Deploy-Historie" wird durch `.claude/hooks/post-deploy-log.sh` automatisch nach jedem Wrangler-Deploy ergänzt — dieser Hook ist der einzige Grund, die Datei nicht zu löschen.
> Aktuelle Deploys werden zusätzlich in `.agent-memory/deploy-log.md` dokumentiert.

---

## Aktueller Stand (2026-04-19, EINGEFROREN — siehe `.agent-memory/current-state.md`)

### Aktive Arbeit
- Ultraplan implementiert: alle kritischen Bugs + Sicherheits-Fixes + Deployment-Fix

### Erledigte Fixes (dieses Session)
- ✅ Bug 1: WishlistPage — `data.wishlist` statt falscher Key-Chain
- ✅ Bug 2: SearchPage `saveProductToStack` — korrektes `PUT /stacks/:id` mit `product_ids`
- ✅ S1: `/api/products` zeigt nur `visibility='public' AND moderation_status='approved'`
- ✅ S2: CORS auf supplementstack.pages.dev + localhost:5173 eingeschränkt
- ✅ E1: deploy.yml kopiert `functions/` in `frontend/dist/` vor Upload
- ✅ F: Migration 0024 — 12 Seed-Produkte (2× D3, K2, Mg, C, Zink, B12)

### Offene Technische Schulden
- Rate Limiting (S3): noch nicht implementiert — braucht KV-Namespace in Cloudflare
- Google OAuth: Backend-Stubs (501), Frontend fehlt komplett
- R2 Bildupload: Upload-Endpoint fehlt (nur externe URLs funktionieren)
- fetch() → apiClient Migration (A3): SearchPage/WishlistPage teils raw fetch
- StackWorkspace (A2): noch in DemoPage inline, nicht extrahiert
- backend/ Verzeichnis: totes Artefakt, sollte gelöscht werden
- Keine Tests

### Nächste Schritte (priorisiert)
1. 🔴 Git commit + push (deploy.yml fix ist kritisch)
2. Migration 0024 in Production deployen
3. E2E testen: Register → Search → Wirkstoff → Produkt → Stack
4. WishlistPage testen: Produkt hinzufügen → erscheint in Liste
5. Rate Limiting via KV (braucht Cloudflare Dashboard: KV Namespace erstellen)

---

## Deploy-Historie

### 🚀 Deploy: 2026-04-17
- **Commit:** `e2e401f` — ci: Redeploy um JWT_SECRET zu aktivieren
- **Typ:** Cloudflare Pages (Frontend + Functions)
- **Status:** ✅ CI/CD getriggert

### 🚀 Deploy: 2026-04-17
- **Commit:** `2538547` — Fix: Kritische Bugs + UX-Verbesserungen (Block 1+2)
- **Typ:** Cloudflare Pages (Frontend + Functions) + D1 Migrations 0021+0022
- **Status:** ✅ Erfolgreich deployed

---

## Zuletzt deployete Versionen

| Komponente | Version/Commit | Datum |
|---|---|---|
| Frontend + Functions | e2e401f | 2026-04-17 |
| D1 Migrations | 0001–0022 alle applied | 2026-04-17 |
| JWT_SECRET | gesetzt via wrangler pages secret | 2026-04-17 |
| Migration 0024 | pending — nächster Deploy | — |

---
### 🚀 Deploy: 2026-04-19 23:18:01
- **Commit:** `4d7cf38` — Feature: R2 Image Upload, Rate Limiting, StackWorkspace Refactor
- **Typ:** Cloudflare Pages (Frontend + Functions)
- **Befehl:** `cd "C:/Users/email/supplement-stack" && npx wrangler pages deploy frontend/dist --project-name supplementstack 2>&1`
- **Status:** ✅ Erfolgreich

---
### 🗄️ Deploy: 2026-04-19 23:30:25
- **Commit:** `c5d3542` — ci: Remove dead backend/ steps from deploy workflow
- **Typ:** D1 Migrations
- **Befehl:** `cd "C:/Users/email/supplement-stack" && npx wrangler d1 migrations apply supplementstack-production --remote 2>&1`
- **Status:** ✅ Erfolgreich

---
### 🚀 Deploy: 2026-04-19 23:30:55
- **Commit:** `c5d3542` — ci: Remove dead backend/ steps from deploy workflow
- **Typ:** Cloudflare Pages (Frontend + Functions)
- **Befehl:** `cp -r "C:/Users/email/supplement-stack/functions" "C:/Users/email/supplement-stack/frontend/dist/" && cd "C:/Users/email`
- **Status:** ✅ Erfolgreich

---
### 🚀 Deploy: 2026-04-19 23:33:37
- **Commit:** `140a1e9` — Feature: Passwort-Reset via Resend + Hook-Fix
- **Typ:** Cloudflare Pages (Frontend + Functions)
- **Befehl:** `cd "C:/Users/email/supplement-stack/frontend" && npm run build 2>&1 | tail -3 && cp -r "../functions" "dist/" && cd .. &`
- **Status:** ✅ Erfolgreich

---
### 🚀 Deploy: 2026-04-19 23:40:42
- **Commit:** `3e36362` — Fix: Resend Absender auf stack@dragoncity.eu umgestellt
- **Typ:** Cloudflare Pages (Frontend + Functions)
- **Befehl:** `cd "C:/Users/email/supplement-stack/frontend" && npm run build 2>&1 | tail -3 && cp -r "../functions" "dist/" && cd .. &`
- **Status:** ✅ Erfolgreich

---
### 🚀 Deploy: 2026-04-19 23:50:29
- **Commit:** `3e36362` — Fix: Resend Absender auf stack@dragoncity.eu umgestellt
- **Typ:** Cloudflare Pages (Frontend + Functions)
- **Befehl:** `cd "C:/Users/email/supplement-stack/frontend" && npm run build 2>&1 | tail -2 && cp -r "../functions" "dist/" && cd .. &`
- **Status:** ✅ Erfolgreich

---
### 🚀 Deploy: 2026-04-19 23:57:24
- **Commit:** `3e36362` — Fix: Resend Absender auf stack@dragoncity.eu umgestellt
- **Typ:** Cloudflare Pages (Frontend + Functions)
- **Befehl:** `cd "C:/Users/email/supplement-stack/frontend" && npm run build 2>&1 | tail -2 && cp -r "../functions" "dist/" && cd .. &`
- **Status:** ✅ Erfolgreich

---
### 🚀 Deploy: 2026-04-20 00:03:58
- **Commit:** `fc2da38` — UI: ProductCard Redesign — moderner Card-Stil mit Schatten, Ring, Pill-Badges
- **Typ:** Cloudflare Pages (Frontend + Functions)
- **Befehl:** `cd "C:/Users/email/supplement-stack/frontend" && npm run build 2>&1 | tail -3 && cp -r "../functions" "dist/" && cd .. &`
- **Status:** ✅ Erfolgreich

---
### 🚀 Deploy: 2026-04-20 12:01:36
- **Commit:** `fc2da38` — UI: ProductCard Redesign — moderner Card-Stil mit Schatten, Ring, Pill-Badges
- **Typ:** Cloudflare Pages (Frontend + Functions)
- **Befehl:** `cp -r "C:/Users/email/supplement-stack/functions" "C:/Users/email/supplement-stack/frontend/dist/" && cd "C:/Users/email`
- **Status:** ✅ Erfolgreich

---
### 🚀 Deploy: 2026-04-20 12:07:16
- **Commit:** `a170003` — UI: ProductCard — größeres Bild, Kategorie-Badge, Info-Rows, Warning-bg
- **Typ:** Cloudflare Pages (Frontend + Functions)
- **Befehl:** `cp -r "C:/Users/email/supplement-stack/functions" "C:/Users/email/supplement-stack/frontend/dist/" && cd "C:/Users/email`
- **Status:** ✅ Erfolgreich

---
### 🚀 Deploy: 2026-04-20 14:40:05
- **Commit:** `48facb3` — UI: ProductCard exakt nach Designvorlage — Emoji-Icon, Timing-Badge, Meta-Grid, Warning-List, #eef0f7 Bg
- **Typ:** Cloudflare Pages (Frontend + Functions)
- **Befehl:** `cp -r "C:/Users/email/supplement-stack/functions" "C:/Users/email/supplement-stack/frontend/dist/" && cd "C:/Users/email`
- **Status:** ✅ Erfolgreich

---
### 🚀 Deploy: 2026-04-20 19:29:28
- **Commit:** `48facb3` — UI: ProductCard exakt nach Designvorlage — Emoji-Icon, Timing-Badge, Meta-Grid, Warning-List, #eef0f7 Bg
- **Typ:** Cloudflare Pages (Frontend + Functions)
- **Befehl:** `cd C:/Users/email/supplement-stack && npx wrangler pages deploy frontend/dist --project-name supplementstack 2>&1 | tail`
- **Status:** ✅ Erfolgreich

---
### 🚀 Deploy: 2026-04-27 23:05:28
- **Commit:** `9e41439` — Design: Stacks & Demo komplett nach HTML-Spec (warm header, masonry, bottom-bar, edit-modal)
- **Typ:** Cloudflare Pages (Frontend + Functions)
- **Befehl:** `npx wrangler pages deploy frontend/dist --project-name=supplementstack 2>&1`
- **Status:** ✅ Erfolgreich

---
### 🚀 Deploy: 2026-04-28 16:10:17
- **Commit:** `3c14e0d` — Fix: Dosage-Karten zeigen "Keine Empfehlung verfügbar" statt fake 1/2-Fallback
- **Typ:** Cloudflare Pages (Frontend + Functions)
- **Befehl:** `npx wrangler pages deploy frontend/dist --project-name supplementstack 2>&1`
- **Status:** ✅ Erfolgreich
