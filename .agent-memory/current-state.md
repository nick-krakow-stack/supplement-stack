# Current State

Last updated: 2026-05-12

## 2026-05-12 - Hook-Steuerung

- Codex ist Orchestrator-only und arbeitet über Sub-Agents; `.agent-memory/current-task.md` ist die aktive Aufgabe-/To-do-Liste.
- Browser-Feedback, Diff-Kommentare und Owner-Feedback landen dauerhaft in `.agent-memory/feedback.md`; Stop führt vollständiges Memory/Handoff-Update aus.

- Claude-Hooks wurden vollständig aus der aktiven Projektkonfiguration entfernt.
- Legacy `.claude/hooks/error-capture.sh`, `.claude/hooks/pre-deploy-check.sh`, `.claude/settings.json` und `.claude/memory.md` sind entfernt.
- Zentrale Codex-Hook-Steuerung ist aktiv und versioniert: `.codex/hooks.json` mit `UserPromptSubmit` und `Stop` auf `.codex/hooks/agent-protocol.ps1`.
- `PreCompact` ist in beiden Konfigurationen absichtlich nicht aktiv.
- `AGENTS.md` ist die zentrale Startup-Datei für Agent-Regeln; `CLAUDE.md` ist aus dem Pflichtstart entfernt.

## Active Baseline

- Production-like line is the Cloudflare Pages/Workers line:
  - Backend: `functions/api/[[path]].ts`, `functions/api/modules/*`,
    `functions/api/lib/*`
  - Frontend: `frontend/src/*`
  - Database migrations: `d1-migrations/*`
  - Cloudflare config: `wrangler.toml` and `wrangler.maintenance.toml`
- Live domain: `https://supplementstack.de`.
- Latest documented deployed preview:
  `https://89b9f726.supplementstack.pages.dev`.
- The active admin frontend is `/administrator`.
- `/api/admin` remains the backend API namespace.
- The old frontend `/admin` route was removed during cleanup. Use
  `/administrator` for the admin UI.

## Admin State

- The old frontend admin monolith has been removed from active code:
  - `frontend/src/pages/AdminPage.tsx`
  - `frontend/src/components/AdminLayout.tsx`
  - `frontend/src/pages/admin/*`
- Active admin pages live in `frontend/src/pages/administrator/*`.
- Active admin menu now shows the reduced operator set: Dashboard,
  Wirkstoffe, Produkte, Richtwerte, Wissensdatenbank, Uebersetzungen,
  Wechselwirkungs-Matrix, Benutzerverwaltung, Shop-Domains, and Rechtliches.
- Several older admin pages still have direct routes for compatibility or later
  cleanup, but they are no longer primary sidebar destinations.
- Admin pages use scoped shared UI/CSS in:
  - `frontend/src/pages/administrator/AdminUi.tsx`
  - `frontend/src/pages/administrator/admin.css`
- Backend admin code is still concentrated in
  `functions/api/modules/admin.ts`; splitting it by domain remains a later
  refactor candidate.

## Latest Completed Work

### 2026-05-10 Backend P2 Hardening - Deployed

- Implemented the backend review P2 fixes:
  - malformed JSON on `/api/auth/register`, `/api/auth/login`,
    `/api/auth/forgot-password`, and `/api/auth/reset-password` now returns
    HTTP 400 instead of bubbling into HTTP 500.
  - password-reset and stack-mail failures no longer expose raw transport
    debug details in JSON responses; details are kept in server logs.
  - admin CSV export escaping now neutralizes spreadsheet formula prefixes
    before attachment download.
- Added `scripts/backend-regression-check.mjs` as a lightweight regression
  check that runs without Vite/esbuild, because Vitest is blocked in the
  current Codex sandbox by `spawn EPERM`.
- Validation passed:
  - `node scripts/backend-regression-check.mjs`
  - `functions`: `npx tsc -p tsconfig.json --noEmit`
  - `node --check scripts/backend-regression-check.mjs`
  - `git diff --check` passed with the existing LF/CRLF warnings only.
- Commit `78a3565` was pushed to `origin/main`.
- Cloudflare Pages production deployment succeeded for commit `78a3565`.
  - Preview URL: `https://e0367e43.supplementstack.pages.dev`
  - Live URL: `https://supplementstack.de`
- Preview and live malformed JSON smokes passed for `/api/auth/login`,
  `/api/auth/forgot-password`, `/api/auth/reset-password`, and
  `/api/auth/register`: each returned HTTP 400 with `{"error":"Invalid JSON"}`.

### 2026-05-08 Admin Post-Launch Dashboard And Human Copy Pass - Deployed

- Pages deploy completed:
  - preview `https://89b9f726.supplementstack.pages.dev`
  - live `https://supplementstack.de`
- Admin dashboard is now a post-launch operator dashboard:
  - `Heute zu tun` is the first focus area.
  - KPI cards cover registrations/activations, active users, link clicks, and
    catalog risk.
  - `Umsatzsignale` separates affiliate/non-affiliate click signals, top
    products, top shops, deadlinks, and link-report potential.
  - `Katalogpflege`, `Content & Vertrauen`, and `Was passiert gerade` group the
    ongoing operator work.
- `/api/admin/stats` now returns range-aware current/previous values, trend
  metadata, top clicked products, top shops, open link reports, and link-health
  signal counts for the dashboard.
- Admin page subtitles were reviewed from an operator/human perspective and
  rewritten across the visible admin pages; technical wording such as migration
  notes and ASCII-only copy remnants was removed from those surfaces.
- Validation passed:
  - `frontend`: `npx tsc --noEmit`
  - `functions`: `npx tsc -p tsconfig.json --noEmit`
  - `frontend`: `npm run build`
  - `git diff --check` with existing LF/CRLF warnings only
- Preview/live smoke checks passed for `/`, `/administrator/dashboard`,
  `/api/products`, and unauthenticated admin guards for `/api/admin/stats` and
  `/api/admin/ops-dashboard`.

### 2026-05-08 Admin QA Remaining Knowledge/Wirkstoff Pass - Remote-Migrated And Deployed

- Remote D1 migration `0074_knowledge_article_admin_fields.sql` was applied to
  `supplementstack-production`.
- Pages deploy completed:
  - preview `https://39db2d7f.supplementstack.pages.dev`
  - live `https://supplementstack.de`
- Wissensdatenbank now has structured admin fields for:
  - sources as repeated `Name` + `Link` rows, with `sources_json` retained as
    a compatibility mirror/fallback
  - article conclusion
  - optional article image upload/URL
  - dose minimum, maximum, and unit
  - ingredient relation rows through `knowledge_article_ingredients`
  - optional product note
- Public knowledge articles can render the new image, dose details,
  ingredient relations, product note, and conclusion where present.
- Wirkstoff task modals now support inline editing of existing forms,
  synonyms, and precursor notes/order.
- The DGE task modal now supports DGE source add/edit/delete directly and uses
  the existing ingredient research source storage.
- DGE source detection now also recognizes spelled-out Deutsche Gesellschaft
  fuer Ernaehrung variants, not only `dge`/`dge.de`.
- Validation passed:
  - `frontend`: `npx tsc --noEmit`
  - `functions`: `npx tsc -p tsconfig.json --noEmit`
  - `frontend`: `npm run build`
  - `git diff --check` with existing LF/CRLF warnings only
- Remote postflight confirmed no pending migrations and the new
  `knowledge_articles` columns plus `knowledge_article_sources` /
  `knowledge_article_ingredients` tables.
- Preview/live smoke checks passed for `/`, `/administrator/ingredients`,
  `/api/products`, and unauthenticated `/api/admin/knowledge-articles` guard.

### 2026-05-08 Admin QA Consolidated Pass - Remote-Migrated And Deployed

- Remote D1 migration `0073_ingredient_admin_task_status.sql` was applied to
  `supplementstack-production`.
- Pages deploy completed:
  - preview `https://bd3e3f6e.supplementstack.pages.dev`
  - live `https://supplementstack.de`
- Admin dashboard was compacted after the owner reference image:
  - smaller cards/gaps
  - range selector moved into `AdminPageHeader.meta`
  - refresh as compact header icon
- Admin list/filter UI now uses the compact filter-bar pattern across the main
  QA surfaces: Benutzer, Produkte, Wirkstoffe, Richtwerte, Uebersetzungen,
  Matrix, and Shop-Domains.
- Benutzerverwaltung now has:
  - header `XX Benutzer, davon XX aktiv`
  - compact Nutzer/Nutzung/Beitrag columns
  - role/trusted/blocked controls moved into desktop drawer/mobile sheet
  - backend counts for stack items and product link clicks
- Added `/administrator/profile` and made the admin sidebar footer/avatar
  clickable; password change uses the existing `/api/me/password` flow.
- Produkte now has compact operations:
  - main-link quick edit
  - affiliate yes/no
  - moderation status including `blocked`
  - image modal/delete
  - `weitere Links` modal backed by product shop-link CRUD/recheck APIs
- Wirkstoffe now has:
  - `Bearbeitungsstand` badges
  - task status persistence through `ingredient_admin_task_status`
  - lightweight modals for Formen, DGE, Wirkstoffteile, and Synonyme
  - Hauptempfehlung, Alternative 1, Alternative 2 with optional concrete
    `shop_link_id`
  - public ingredient product ordering now prefers recommendation slots.
- Richtwerte, Uebersetzungen, Wechselwirkungs-Matrix, and Shop-Domains were
  compacted/polished per `admin_qa.md`.
- Completed reference PNGs were removed from
  `.agent-memory/deployment_images/`; the folder remains with `.gitkeep`.
- Validation passed:
  - `frontend`: `npx tsc --noEmit`
  - `functions`: `npx tsc -p tsconfig.json --noEmit`
  - `frontend`: `npm run build`
  - `git diff --check` with existing LF/CRLF warnings only
- Preview/live smoke checks passed for core admin routes, `/api/products`,
  unauthenticated admin API guards, and removed Audit-Log API behavior.

### 2026-05-08 Wirkstoff Admin QA Recovery - Local

- Restored the deleted active page
  `frontend/src/pages/administrator/AdministratorIngredientsPage.tsx` from
  `HEAD` and rebuilt it for the owner Wirkstoff-QA requirements.
- `/administrator/ingredients` now shows:
  - header subtitle `XX Wirkstoffe gelistet`
  - compact search/status toolbar with refresh and `Richtwerte` link
  - simplified table without visible ingredient ID/unit/weight details
  - `Bearbeitungsstand` badges for Formen, DGE, Wirkstoffteile, Synonyme,
    Blog/Wissen, and Richtwerte
  - recommendation slots for Hauptempfehlung, Alternative 1, and Alternative 2
- Added modal flows on the page using existing APIs:
  - forms and synonyms display/add/delete plus persistent task status
  - DGE source display plus persistent task status/comment
  - precursors display/add/delete plus persistent task status
  - product recommendation product search and optional shop-link selection
- Reviewed the existing intermediate admin API changes and fixed two scoped
  backend issues:
  - ingredient task status now writes `updated_by_user_id` from `userId`
  - product recommendation delete now checks ingredient existence and slot
    column availability before issuing slot-column SQL
- Validation passed:
  - `frontend`: `npx tsc --noEmit`
  - `functions`: `npx tsc -p tsconfig.json --noEmit`
  - scoped `git diff --check` for the requested files passed with only the
    existing LF/CRLF warnings.

### 2026-05-07 Product Shop-Link Admin API - Deployed

- Added admin CRUD APIs in `functions/api/modules/admin.ts` for catalog
  product shop links:
  - `GET /api/admin/products/:id/shop-links`
  - `POST /api/admin/products/:id/shop-links`
  - `PATCH /api/admin/products/:id/shop-links/:shopLinkId`
  - `DELETE /api/admin/products/:id/shop-links/:shopLinkId`
  - `POST /api/admin/products/:id/shop-links/:shopLinkId/recheck`
- Responses include `product_shop_link_health` data as `health` when the
  table is present.
- Create/update/delete keeps legacy `products.shop_link` and affiliate owner
  fields synced from the active primary/first shop link.
- Manual recheck uses Worker-compatible `fetch` with a 6s abort timeout,
  redirect limit, and basic unsafe-host guards before writing
  `product_shop_link_health`.
- Validation passed:
  - `functions`: `npx tsc -p tsconfig.json --noEmit`
  - `git diff --check -- functions/api/modules/admin.ts` passed with the
    existing LF/CRLF warning only.

### 2026-05-07 Admin Dashboard Visual TODO Polish - Local

- Implemented the remaining `.agent-memory/deployment_images` visual TODOs in
  the active administrator UI:
  - `search_modal.png`: command palette now uses grouped result sections,
    larger search field treatment, result initials, side labels, and a
    keyboard shortcut footer
  - `user_stacks_card.png`: dashboard metric cards now use the softer bordered
    card treatment with larger serif values and warmer secondary copy
  - `was_passiert.png`: Dashboard "Was passiert gerade" now uses a more
    structured activity-feed layout
- Completed reference images were removed:
  - `.agent-memory/deployment_images/search_modal.png`
  - `.agent-memory/deployment_images/user_stacks_card.png`
  - `.agent-memory/deployment_images/was_passiert.png`
- `.agent-memory/deployment_images/` remains in place with `.gitkeep`.
- Validation passed:
  - `frontend`: `npx tsc --noEmit`
  - `frontend`: `npm run lint --if-present`
  - `frontend`: `npm run build`

### 2026-05-07 Admin Operations Core Migration - Remote-Migrated And Deployed

- `.agent-memory/admin_qa.md` was expanded with the agreed implementation plan
  and the latest analytics decision:
  - dashboard uses `Anmeldungen` as the registration metric in the selected
    date range
  - card subtext counts activations where `email_verified_at IS NOT NULL`
  - no separate "Neue Besucher" card is used for signup calls-to-action
- Remote D1 migration `0072_admin_operations_core.sql` was applied to
  `supplementstack-production`.
- Added operational tables for product shop links, shop-link health, product
  link click tracking, and editable legal documents.
- Backfilled `product_shop_links` from legacy `products.shop_link` and kept
  the primary shop link synced from existing product-admin write paths.
- Public catalog product cards now route shop clicks through
  `/api/products/:id/out`, logging minimal first-party click rows without IP or
  User-Agent storage before redirecting.
- Admin dashboard now supports date ranges and shows Benutzer, Link-Klicks,
  Deadlinks, and Anmeldungen with activation subtext.
- Admin products gained moderation/affiliate/image/link-health filters, product
  image delete, and `blocked` moderation status handling.
- User management gained product-submission block/unblock support; blocked
  submitters can still see their own blocked products in stack workflows.
- Added admin legal-document CRUD at `/administrator/legal` with DB storage;
  public legal-page DB reading was completed in the later
  shop-link/legal/audit finalization pass.
- Admin sidebar menu was reduced per owner QA; Audit-Log and other secondary
  admin pages are no longer visible in the main menu.
- Deployed preview: `https://e44d85f2.supplementstack.pages.dev`.
- Live domain: `https://supplementstack.de`.
- Remote postflight confirmed `product_shop_links`, `product_link_clicks`, and
  `legal_documents` are present and populated/backfilled as expected.

### 2026-05-07 Admin Sidebar Density Retune - Deployed

- Applied the new owner-provided `.agent-memory/deployment_images` references:
  - `menu_soll.png`
  - `menu_ist.png`
- Scope was intentionally limited to admin menu typography and spacing, not
  menu content:
  - desktop admin sidebar width reduced from `286px` to `248px`
  - brand logo/name/subtitle scaled down to keep `Supplement Stack` on one
    line
  - nav group, label, item, icon, badge, and active-state spacing reduced
  - active nav outline changed from heavy dark border to a quieter compact
    card treatment
- Completed reference images were removed after implementation:
  - `.agent-memory/deployment_images/menu_soll.png`
  - `.agent-memory/deployment_images/menu_ist.png`
- The `.agent-memory/deployment_images/` folder was intentionally retained for
  future open visual TODO images and now has a `.gitkeep` sentinel.
- Deployed preview: `https://a9e5e4d0.supplementstack.pages.dev`.
- Preview/live route smokes passed for `/administrator/dashboard` and
  `/administrator/interactions`; unauthenticated `/api/interactions` returned
  HTTP 401.

### 2026-05-07 Admin Typography And Interaction Matrix Redesign - Deployed

- Applied the two `.agent-memory/deployment_images` visual references:
  - admin sidebar typography, spacing, palette, logo sizing, and active nav
    style now follow `Schriftarten.png`
  - `/administrator/interactions` now uses a quieter visual matrix inspired by
    `Wechselwirkungs-Matrix.png`, with vertical column labels, compact
    severity cells, count pills, legend, and hover detail
- The interaction create form is now behind the `Hinzufuegen` action instead
  of always occupying the top of the page.
- Reference images were removed after implementation:
  - `.agent-memory/deployment_images/Schriftarten.png`
  - `.agent-memory/deployment_images/Wechselwirkungs-Matrix.png`
- Deployed preview: `https://4f190a86.supplementstack.pages.dev`.
- Preview/live route smokes passed for `/administrator/interactions` and
  `/administrator/user-products`; unauthenticated `/api/interactions` returned
  HTTP 401.

### 2026-05-07 Product Image WebP Normalization - Deployed

- Product image crop/upload now keeps the user flow unchanged but stores
  browser-normalized images:
  - `ImageCropModal` renders the selected crop to 512 x 512 px
  - preferred output is `image/webp` at quality `0.84`
  - browsers without WebP support fall back to JPEG
- Product image upload endpoints now share a central content-type/limit helper:
  - `functions/api/lib/product-images.ts`
  - `/api/admin/products/:id/image`
  - `/api/products/:id/image`
- Upload endpoints still accept JPEG/PNG/WebP for compatibility, but enforce a
  1 MB post-optimization limit and store R2 filenames by actual content type.
- Deployed preview: `https://c07d6e4d.supplementstack.pages.dev`.
- Live route smokes passed for `/administrator/product-qa` and
  `/administrator/products/1`; unauthenticated upload guard returned HTTP 401.

### 2026-05-07 Wirkstoffe/Formen Rebuild - Remote-Migrated And Deployed

- `.agent-memory/wirkstoffe_rebuild.md` was normalized into a concrete
  implementation plan and updated to the current implementation state.
- Implemented the Wirkstoffe/Formen rebuild:
  - normalized ingredient search across canonical names, synonyms, and forms
  - suppression of old ingredient rows that are identifiable as forms under a
    different canonical ingredient
  - optional `matched_form_id` / `matched_form_name` in search results
  - optional `form_id` product filtering for `/api/ingredients/:id/products`
  - `ingredient_precursors` migration and admin CRUD API
  - Stack modal form-selection step before dosage/products
  - Administrator Ingredient Detail `Wirkstoffteile` tab
  - Administrator Ingredients list structure counts for forms, synonyms, and
    precursors
- Current modeling decision:
  - canonical Wirkstoffe remain in `ingredients`
  - forms/derivatives/salts/esters move to `ingredient_forms`
  - spelling variants and abbreviations stay in `ingredient_synonyms`
  - editorial precursor relationships use the `ingredient_precursors` table
  - L-Carnitin is canonical; Acetyl-L-Carnitin is treated as a form/derivative
    of L-Carnitin for search/product structure
- Remote read-only audit was written to
  `_research_raw/ingredient_consolidation_audit.md`.
- Remote D1 migrations applied successfully to `supplementstack-production`:
  - `0069_ingredient_lookup_indexes.sql`
  - `0070_ingredient_precursors.sql`
  - `0071_consolidate_l_carnitine_forms.sql`
- L-Carnitin consolidation is complete in remote D1:
  - old ingredient `60` Acetyl-L-Carnitin -> ingredient `13`, form `155`
  - old ingredient `65` L-Carnitin Tartrat -> ingredient `13`, form `154`
  - old ingredient `66` L-Carnitin Fumarat -> ingredient `13`, form `158`
  - old form `189` was merged into form `155`
  - old product/user-product ingredient, interaction, synonym, display-profile,
    dose, sub-ingredient, and JSON blog references were remapped or removed
    without remaining references to `60`, `65`, `66`, or `189`
- Live API checks passed after deploy:
  - `/api/ingredients/search?q=alcar` returns `13` L-Carnitin with
    `matched_form_id: 155`
  - `/api/ingredients/13/products?form_id=155` uses the new form filter
  - `/administrator/ingredients` and
    `/administrator/ingredients/13?section=precursors` returned HTTP 200

### 2026-05-07 Worktree Cleanup - Local

- Removed local-only artifacts:
  - `admin-preview/`
  - root `logo.png` duplicate; canonical logo remains
    `frontend/public/logo.png`
  - `qa-preview-demo-bottombar-no-cookie.png`
- Replaced large temporary admin analysis/plan dumps with compact
  `.agent-memory/admin-rebuild-plan.md`.
- Removed legacy `.claude/SESSION.md` deploy logging and
  `.claude/hooks/post-deploy-log.sh`.
- `.agent-memory/deploy-log.md` is the canonical deploy/migration log.
- Added ignore rules for local design/browser-QA artifacts and Claude
  deploy-error logs.
- Removed the old frontend `/admin` compatibility redirect and related admin
  status copy.
- Active code search found no remaining imports or active code references to
  the deleted old frontend admin monolith. False-positive references to
  `AdminPageHeader` are from the new `AdminUi` helper.

### 2026-05-07 Admin Browser-QA Text/UX Cleanup - Deployed

- Productive admin copy was cleaned up: development notes removed, touched UI
  text normalized to clear German, and raw enum/status labels mapped to German
  display labels.
- Translation maintenance no longer offers German as a target language; German
  remains the source language.
- `Linkmeldungen` search input spacing was fixed.
- `Produktprüfung` now has clearer labels, row-level image upload, and German
  comma decimal handling in touched fields.
- `Wechselwirkungen` now has visible German field/filter labels and German
  severity/type labels.
- Touched stack/product entry surfaces use German comma notation for decimal
  numbers and Euro amounts.
- Validation passed before deploy:
  - `frontend`: `npx tsc --noEmit`
  - `frontend`: `npm run lint --if-present`
  - `frontend`: `npm run build`
  - `node --check scripts/admin-browser-smoke.mjs`
  - Wrangler Pages deploy compiled Functions successfully.
- Preview/live smokes passed before the later route cleanup for `/administrator`,
  `/administrator/product-qa`, `/administrator/interactions`,
  `/administrator/translations`, `/admin`, and unauthenticated admin API guard
  checks.

### 2026-05-07 Ingredient Research Coverage List - Deployed

- `/administrator/ingredients` is now the operational ingredient research
  coverage checklist.
- The admin ingredients API returns coverage counts for sources, official/DGE
  sources, studies, NRV/UL rows, dose recommendations, dose-source links,
  display profiles, warnings/knowledge, and blog URLs.
- The list shows automatic badges for Blog/Wissen, DGE, official sources,
  studies, NRV/UL, Dosing, Dosis-Quellen, and display profile.
- Validation passed before deploy:
  - `functions`: `npx tsc -p tsconfig.json --noEmit`
  - `frontend`: `npx tsc --noEmit`
  - `frontend`: `npm run lint --if-present`
  - `frontend`: `npm run build`
  - remote D1 read-only coverage query
  - remote D1 migration list reported no pending migrations
  - preview/live route and unauthenticated API guard smokes.

### 2026-05-07 Admin QA Shop-Link/Legal/Audit Finalization - Deployed

- Product Detail `Shop-Link` now uses the multi-shop-link editor backed by
  `product_shop_links`.
- Admins can create, edit, delete, activate/deactivate, sort, mark primary,
  assign owner type, and manually recheck product shop links.
- Primary/first active shop links continue to mirror into the legacy
  `products.shop_link` and affiliate owner columns for compatibility.
- Public legal pages now read published documents from
  `/api/legal-documents/:slug` and fall back to the static legal copy when no
  published DB document exists.
- The visible Audit-Log admin route/page/API was removed. Internal audit rows
  remain available to product-detail data where existing code still reads them,
  but there is no active `/administrator/audit-log` route or
  `/api/admin/audit-log` endpoint.
- Completed visual TODO images were deleted; `.agent-memory/deployment_images/`
  remains with `.gitkeep`.

## Validation Status

- Cleanup validation passed before commit `cec3f89`:
  - `functions`: `npx tsc -p tsconfig.json --noEmit`
  - `frontend`: `npx tsc --noEmit`
  - `frontend`: `npm run lint --if-present`
  - `frontend`: `npm run build`
  - `node --check scripts/admin-browser-smoke.mjs`
  - `node --check scripts/user-browser-smoke.mjs`
  - `git diff --check`
- Current Wirkstoffe/Formen validation passed before remote deploy:
  - `functions`: `npx tsc -p tsconfig.json --noEmit`
  - `frontend`: `npx tsc --noEmit`
  - `frontend`: `npm run lint --if-present`
  - `frontend`: `npm run build`
  - `node --check scripts/admin-browser-smoke.mjs`
  - `node --check scripts/user-browser-smoke.mjs`
  - `git diff --check`
- Additional validation after the final ALCAR search-ranking patch passed:
  - `functions`: `npx tsc -p tsconfig.json --noEmit`
  - `frontend`: `npm run build`
  - `git diff --check`
- Product image WebP normalization validation passed:
  - `functions`: `npx tsc -p tsconfig.json --noEmit`
  - `frontend`: `npx tsc --noEmit`
  - `frontend`: `npm run lint --if-present`
  - `frontend`: `npm run build`
  - `node --check scripts/admin-browser-smoke.mjs`
  - `node --check scripts/user-browser-smoke.mjs`
  - `git diff --check`
- Admin typography/matrix redesign validation passed:
  - `frontend`: `npx tsc --noEmit`
  - `frontend`: `npm run lint --if-present`
  - `frontend`: `npm run build`
  - `node --check scripts/admin-browser-smoke.mjs`
- Admin sidebar density retune validation passed:
  - `frontend`: `npx tsc --noEmit`
  - `frontend`: `npm run lint --if-present`
  - `frontend`: `npm run build`
  - `node --check scripts/admin-browser-smoke.mjs`
  - `git diff --check` passed with existing LF/CRLF warnings only.
- Admin operations core migration validation passed:
  - `functions`: `npx tsc -p tsconfig.json --noEmit`
  - `frontend`: `npx tsc --noEmit`
  - `frontend`: `npm run build`
  - `git diff --check` passed with existing LF/CRLF warnings only.
  - Remote D1 migration `0072_admin_operations_core.sql` applied successfully.
  - Preview/live `/api/products` returned HTTP 200.
  - Preview/live unauthenticated `/api/admin/stats` returned HTTP 401.
  - Remote D1 postflight counted shop-link, click, and legal-document tables.
- Admin QA shop-link/legal/audit finalization validation passed:
  - `functions`: `npx tsc -p tsconfig.json --noEmit`
  - `frontend`: `npx tsc --noEmit`
  - `frontend`: `npm run build`
  - `git diff --check` passed with existing LF/CRLF warnings only.
  - Remote D1 migration list reported no pending migrations.
  - Remote D1 postflight confirmed latest migration `0072_admin_operations_core.sql`,
    `33` products, and `13` product shop links.
  - Pages deployed preview `https://417e6dc4.supplementstack.pages.dev`;
    live `https://supplementstack.de` smoke checks passed.
  - Preview/live `/api/products` returned HTTP 200.
  - Preview/live unauthenticated `/api/admin/stats` and
    `/api/admin/products/1/shop-links` returned HTTP 401.
  - Preview/live `/api/legal-documents/impressum` returned HTTP 404 when no
    published DB document exists; public static fallback pages for Impressum,
    Datenschutz, and Nutzungsbedingungen returned HTTP 200.
  - Preview/live `/api/admin/audit-log` returned HTTP 404.
- Remote D1 postflight passed:
  - no old references to ingredient IDs `60`, `65`, or `66`
  - no old form `189`
  - no ingredient/form parent mismatches in user product ingredients
  - no ingredient self-interactions
  - no duplicate normalized synonyms under ingredient `13`
  - `PRAGMA foreign_key_check` returned no rows
- Local D1 migration apply is blocked before the new migrations by an old local
  schema/journal mismatch at `0009_auth_profile_extensions.sql`
  (`no such column: google_id`). Remote D1 migration and postflight worked.
- Authenticated owner browser QA remains the final acceptance gate for the new
  admin/user workflows.

## Known Remaining Work

- Final authenticated owner browser QA:
  - Admin dashboard range cards, especially `Anmeldungen` and activation
    subtext
  - Admin products filters, blocked status, product image delete, and redirect
    click tracking
  - User-management blocked-submitter toggle
  - Legal-document editor save flow
  - login/session persistence
  - stack create/edit/product add/remove/replacement
  - stack form selection for ingredients with forms
  - user product submit
  - Product Detail overview/moderation/shop-link/Wirkstoffe/image flows
  - Product-QA harmless save
  - Product Detail and Product-QA image upload with WebP normalization
  - product warnings
  - Dosing source links
  - Interaction edit/delete
  - Ingredient Research source/warning and NRV CRUD
  - one stale-version `409` check
- Continue ingredient-by-ingredient research and copywriting data entry through
  `/administrator/ingredients`.
- Content/science/legal review remains before SEO indexing/go-live confidence.
- External inbox mail tests remain before launch confidence.
- No open `.agent-memory/deployment_images` PNG visual TODOs remain; keep the
  folder and `.gitkeep` for future owner reference images.
- Authenticated owner browser QA remains open for the new admin flows.
