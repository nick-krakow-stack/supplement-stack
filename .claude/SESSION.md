# SESSION.md — Supplement Stack
> Wird automatisch vor jedem Compact und nach jedem Deploy aktualisiert.

---

## Aktueller Stand (2026-04-19)

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
