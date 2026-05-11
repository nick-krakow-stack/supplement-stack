# Deploy Log

Last updated: 2026-05-11

## 2026-05-11 Website UX Fixes Preview

- Scope:
  - Added combined `/routine` email delivery through
    `POST /api/stacks/routine/email`.
  - Completed user stack UX follow-ups: target-stack-aware duplicate Wirkstoff
    handling, touch/click warning details, demo mail/PDF account CTA modal,
    list-view add row, and empty demo-stack transfer on registration.
  - Fixed admin Knowledge/User deep-link filters so dashboard/query URLs
    initialize the matching admin filters.
- Remote D1 migrations:
  - No new migration required.
- Pages preview:
  - Project: `supplementstack`.
  - Preview URL: `https://6c3c538e.supplementstack.pages.dev`.
  - Alias URL: `https://codex-website-ux-fixes.supplementstack.pages.dev`.
- Validation:
  - `node scripts/backend-regression-check.mjs` passed.
  - `node scripts/user-ux-regression-check.mjs` passed.
  - `functions`: `npx tsc -p tsconfig.json --noEmit` passed.
  - `frontend`: `npx tsc --noEmit` passed.
  - `frontend`: `npm test -- --run` passed with 11 tests.
  - `frontend`: `npm run lint --if-present` passed.
  - `frontend`: `npm run build` passed.
  - `git diff --check` passed with existing LF/CRLF warnings only.
- Smoke checks:
  - Preview `/`, `/demo`, and `/api/products` returned HTTP 200.
  - Preview unauthenticated `POST /api/stacks/routine/email` returned HTTP
    401.
  - Browser QA on preview confirmed the demo shared header, demo mail CTA
    modal, list-view add row, and product delete confirmation.
- Notes:
  - Authenticated admin preview QA is pending a preview-domain login session.

## 2026-05-11 Tobias QA Landing/Demo Product Flow Deployed

- Scope:
  - Landing hero claim changed from `Wissenschaftlich. Einfach. Kosteneffizient.`
    to `Wissenschaftlich. Einfach. Kostenlos.`.
  - `AddProductModal` no longer forces a separate ingredient-form step.
  - Ingredient forms remain available as an optional product-list filter on
    the product-selection step, defaulting to `Alle Formen`.
  - Added `scripts/tobias-qa-regression-check.mjs`.
- GitHub:
  - Local commit: `74cc5bd` (`Streamline demo product form selection`).
  - Remote branch: `codex/streamline-demo-product-form-selection`.
  - PR `#4` merged to `main` as `9c67ed7`.
- Validation:
  - `node scripts/tobias-qa-regression-check.mjs` passed.
  - `node scripts/admin-qa-regression-check.mjs` passed.
  - `node --check scripts/tobias-qa-regression-check.mjs` passed.
  - `frontend`: `npx tsc --noEmit` passed.
  - `frontend`: `npm run build` passed.
  - `git diff --cached --check` passed before commit.
- Deploy command:
  - `. .\scripts\use-supplementstack-cloudflare.local.ps1; npx wrangler pages deploy frontend/dist --project-name supplementstack`
- Preview URL: `https://71809f56.supplementstack.pages.dev`.
- Live URL: `https://supplementstack.de`.
- Browser QA:
  - Preview landing page showed the new `Kostenlos` hero copy, no old
    `Kosteneffizient` hero copy, and no browser console errors.
  - Live landing page showed the new `Kostenlos` hero copy and no browser
    console errors.
  - Preview `/demo` Vitamin D3 flow went directly from ingredient selection to
    dosage, then to product selection.
  - Product selection showed the optional `Form` dropdown with `Alle Formen`
    selected by default.
  - With the `2000 IE` study value and `Alle Formen`, products were listed,
    including `Vitamin D3 2000 IU Tropfen` and `Vitamin D3 5000 IU`.

## 2026-05-10 Admin Dosing URL Filter Fix Deployed

- Scope:
  - Fixed `/administrator/dosing?ingredient_id=3&q=Magnesium` so the admin
    page initializes the visible query and ingredient filters from URL search
    params instead of showing the unfiltered list.
  - Extended `scripts/admin-qa-regression-check.mjs` to guard the URL-filter
    initialization.
  - Continued authenticated admin human-flow QA across dashboard, products,
    product detail shop links, ingredients, dosing, users, user-products, shop
    domains, and legal routes.
- Remote D1 migrations:
  - No new migration required.
- GitHub:
  - Commit: `d9ef6cc` (`Guard admin dosing URL filters`).
  - Commit: `5733d8f` (`Initialize admin dosing filters from URL`).
  - Pushed to `origin/main` through the GitHub connector.
- Pages deploy:
  - Project: `supplementstack`.
  - Production deployment short id: `5a0b8826`.
  - Live URL: `https://supplementstack.de`.
  - Cloudflare API reported production deployment success for commit
    `5733d8f`.
- Validation:
  - `node scripts/admin-qa-regression-check.mjs` passed.
  - `frontend`: `npx tsc --noEmit` passed.
  - `node --check scripts/admin-qa-regression-check.mjs` passed.
  - `frontend`: `npm run build` passed.
  - `git diff --check` passed with existing LF/CRLF warnings only.
- Smoke checks:
  - Live authenticated browser check confirmed the Magnesium dosing deep-link
    renders `4 Richtwerte`, keeps Magnesium selected, and captures no console
    warnings/errors.

## 2026-05-10 Admin Dosing Visibility Fix Deployed

- Scope:
  - Fixed `/administrator/dosing` so the admin maintenance view no longer hides
    unpublished `dose_recommendations`.
  - Added `scripts/admin-qa-regression-check.mjs` to guard the admin dosing
    visibility rule.
  - Ran read-only authenticated browser QA across the core admin routes and
    selected modals/drawers.
- Remote D1 migrations:
  - No new migration required.
- GitHub:
  - Commit: `2ffeec6` (`Fix admin dosing visibility`).
  - Pushed to `origin/main`.
- Pages deploy:
  - Project: `supplementstack`.
  - Preview URL: `https://575850b1.supplementstack.pages.dev`.
  - Live URL: `https://supplementstack.de`.
  - Cloudflare API reported production deployment success for commit
    `2ffeec6`.
- Validation:
  - `node scripts/admin-qa-regression-check.mjs` passed.
  - `node scripts/backend-regression-check.mjs` passed.
  - `frontend`: `npx tsc --noEmit` passed.
  - `frontend`: `npm run build` passed.
  - `node --check scripts/admin-qa-regression-check.mjs` passed.
  - `git diff --check` passed with existing LF/CRLF warnings only.
- Smoke checks:
  - Live authenticated browser check confirmed `/administrator/dosing` renders
    dosing rows again and no console warnings/errors were captured for the
    route.

## 2026-05-10 Backend P2 Hardening Deployed

- Scope:
  - Hardened `/api/auth/register`, `/api/auth/login`,
    `/api/auth/forgot-password`, and `/api/auth/reset-password` so malformed
    JSON returns HTTP 400 instead of HTTP 500.
  - Removed raw mail transport debug fields from password-reset and stack-mail
    API JSON responses.
  - Hardened admin CSV exports against spreadsheet formula prefixes.
  - Added `scripts/backend-regression-check.mjs` for lightweight backend
    regression checks without Vite/esbuild.
- Remote D1 migrations:
  - No new migration required.
- GitHub:
  - Commit: `78a3565` (`Harden backend error handling and exports`).
  - Pushed to `origin/main`.
- Pages deploy:
  - Project: `supplementstack`.
  - Preview URL: `https://e0367e43.supplementstack.pages.dev`.
  - Live URL: `https://supplementstack.de`.
  - Cloudflare API reported production deployment success for commit
    `78a3565`.
- Validation:
  - `node scripts/backend-regression-check.mjs` passed.
  - `functions`: `npx tsc -p tsconfig.json --noEmit` passed.
  - `node --check scripts/backend-regression-check.mjs` passed.
  - `git diff --check` passed with existing LF/CRLF warnings only.
- Smoke checks:
  - Preview/live malformed JSON POSTs to `/api/auth/login`,
    `/api/auth/forgot-password`, `/api/auth/reset-password`, and
    `/api/auth/register` returned HTTP 400 with `{"error":"Invalid JSON"}`.

## 2026-05-08 Admin Post-Launch Dashboard And Human Copy Pass Deployed

- Scope:
  - Rebuilt `/administrator/dashboard` as a post-launch operator dashboard:
    `Heute zu tun`, range-aware KPIs, `Umsatzsignale`, catalog/content
    maintenance modules, and recent admin activity.
  - Extended `/api/admin/stats` with current/previous range windows, trends,
    top clicked products, top shops, affiliate/non-affiliate click signals,
    open link reports, deadlink counts, and link-potential counts.
  - Reviewed visible admin subtitles from a human/operator perspective and
    rewrote them across the admin pages; removed technical migration copy and
    obvious ASCII-only German text remnants from those surfaces.
- Remote D1 migrations:
  - No new migration required.
- Pages deploy:
  - Project: `supplementstack`.
  - Preview URL: `https://89b9f726.supplementstack.pages.dev`.
  - Live URL: `https://supplementstack.de`.
- Validation:
  - `functions`: `npx tsc -p tsconfig.json --noEmit` passed.
  - `frontend`: `npx tsc --noEmit` passed.
  - `frontend`: `npm run build` passed.
  - `git diff --check` passed with existing LF/CRLF warnings only.
- Smoke checks:
  - Preview/live `/` returned HTTP 200 and served `index-vSLb5La9.js` plus
    `index-C0Tt9RG_.css`.
  - Preview/live `/administrator/dashboard` returned HTTP 200.
  - Preview/live `/api/products` returned HTTP 200.
  - Preview/live unauthenticated `/api/admin/stats` and
    `/api/admin/ops-dashboard` returned HTTP 401.
- Notes:
  - Authenticated browser QA is still open because no admin session or
    credentials are available in the environment.

## 2026-05-08 Admin QA Knowledge/Wirkstoff Remainder Deployed

- Scope:
  - Wissensdatenbank gained structured sources (`Name` + `Link`) backed by
    `knowledge_article_sources`, with `sources_json` retained as a
    compatibility mirror/fallback.
  - Added article conclusion, optional image upload/URL, dose min/max/unit,
    ingredient assignments, and optional product note.
  - Public knowledge article route can render the new fields.
  - Wirkstoff task modals now support inline edit for existing forms,
    synonyms, precursor notes/order, and DGE source add/edit/delete.
  - DGE source detection was broadened to recognize spelled-out Deutsche
    Gesellschaft fuer Ernaehrung variants.
- Remote D1 migrations:
  - Applied to `supplementstack-production`:
    `0074_knowledge_article_admin_fields.sql`.
  - Post-apply migration list reported no pending migrations.
- Pages deploy:
  - Project: `supplementstack`.
  - Preview URL: `https://39db2d7f.supplementstack.pages.dev`.
  - Live URL: `https://supplementstack.de`.
- Validation:
  - `functions`: `npx tsc -p tsconfig.json --noEmit` passed.
  - `frontend`: `npx tsc --noEmit` passed.
  - `frontend`: `npm run build` passed.
  - `git diff --check` passed with existing LF/CRLF warnings only.
- Remote D1 postflight:
  - `knowledge_articles` has `conclusion`, `featured_image_r2_key`,
    `featured_image_url`, `dose_min`, `dose_max`, `dose_unit`, and
    `product_note`.
  - `knowledge_article_sources` and `knowledge_article_ingredients` exist.
- Smoke checks:
  - Preview/live `/` returned HTTP 200 and served `index-CSf4JTu0.js`.
  - Preview/live `/api/products` returned HTTP 200.
  - Preview `/administrator/ingredients` returned HTTP 200.
  - Preview/live unauthenticated `/api/admin/knowledge-articles` returned
    HTTP 401.
- Notes:
  - Authenticated browser QA is still open because no admin session or
    credentials are available in the environment.

## 2026-05-08 Admin QA Consolidated Pass Deployed

- Scope:
  - Dashboard compacted after `dashboard_riesig.png`: smaller cards/gaps and
    range selector moved into the header meta beside `live`.
  - Shared compact admin filter/list pattern added and applied to the main
    Admin-QA list surfaces.
  - Benutzerverwaltung rebuilt with compact columns, usage/contribution
    counts, desktop detail drawer, mobile full-screen sheet, and blocked
    submitter controls in details.
  - Added `/administrator/profile` and made the admin sidebar footer/avatar
    link to the profile/password-change page.
  - Produkte list now keeps quick edit for the main link, affiliate yes/no,
    moderation status, image modal/delete, and a `weitere Links` modal for
    multi-shop-link CRUD/recheck.
  - Wirkstoffe list restored and rebuilt with `Bearbeitungsstand` badges,
    task-status modals, recommendation slots, and `Richtwerte` links.
  - Richtwerte, Uebersetzungen, Wechselwirkungs-Matrix, and Shop-Domains were
    compacted/polished according to `admin_qa.md`.
  - Deleted completed reference PNGs:
    `dashboard_riesig.png`, `filter_ansicht.png`, and
    `benutzerkonten_liste.png`; `.agent-memory/deployment_images/.gitkeep`
    remains.
- Remote D1 migrations:
  - Applied to `supplementstack-production`:
    `0073_ingredient_admin_task_status.sql`.
  - Post-apply migration list reported no pending migrations.
- Pages deploy:
  - Project: `supplementstack`.
  - Preview URL: `https://bd3e3f6e.supplementstack.pages.dev`.
  - Live URL: `https://supplementstack.de`.
- Validation:
  - `functions`: `npx tsc -p tsconfig.json --noEmit` passed.
  - `frontend`: `npx tsc --noEmit` passed.
  - `frontend`: `npm run build` passed.
  - `git diff --check` passed with existing LF/CRLF warnings only.
- Remote D1 postflight:
  - Latest migrations returned `0073_ingredient_admin_task_status.sql`,
    `0072_admin_operations_core.sql`, and
    `0071_consolidate_l_carnitine_forms.sql`.
  - `sqlite_master` confirmed `ingredient_admin_task_status` exists.
- Smoke checks:
  - Preview/live `/`, `/administrator/dashboard`,
    `/administrator/ingredients`, `/administrator/products`,
    `/administrator/users`, `/administrator/dosing`,
    `/administrator/interactions`, `/administrator/shop-domains`, and
    `/api/products` returned HTTP 200.
  - Preview/live unauthenticated `/api/admin/stats`,
    `/api/admin/ingredients?limit=1`, and
    `/api/admin/products/1/shop-links` returned HTTP 401.
  - Preview/live `/api/admin/audit-log` returned HTTP 404.
- Notes:
  - Authenticated browser QA is still open because no admin session or
    credentials are available in the environment.
  - Lightweight Wirkstoff modals intentionally stop short of full inline edit
    for existing Formen/Synonyme and full DGE source add/edit; those remain in
    the detailed research/admin flows if needed later.

## 2026-05-07 Admin QA Shop-Link/Legal/Audit Finalization Deployed

- Scope:
  - Completed Product Detail multi-shop-link UI on top of
    `product_shop_links`.
  - Added admin shop-link create/edit/delete, primary link, active status,
    owner labels, sorting, and manual recheck controls.
  - Wired public Impressum, Datenschutz, and Nutzungsbedingungen pages to
    published `legal_documents` records with static fallback.
  - Removed the visible Audit-Log page, route, and admin API endpoint.
  - Deleted completed visual TODO PNGs from `.agent-memory/deployment_images/`
    and kept the folder with `.gitkeep`.
- Remote D1 migrations:
  - No migrations pending; latest remote migration is
    `0072_admin_operations_core.sql`.
- Pages deploy:
  - Project: `supplementstack`.
  - Preview URL: `https://417e6dc4.supplementstack.pages.dev`.
  - Live URL: `https://supplementstack.de`.
- Validation:
  - `functions`: `npx tsc -p tsconfig.json --noEmit` passed.
  - `frontend`: `npx tsc --noEmit` passed.
  - `frontend`: `npm run build` passed.
  - `git diff --check` passed with existing LF/CRLF warnings only.
- Remote D1 postflight:
  - Latest migration returned `0072_admin_operations_core.sql`.
  - Products count returned `33`.
  - Product shop links count returned `13`.
- Smoke checks:
  - Preview/live `/api/products` returned HTTP 200.
  - Preview/live unauthenticated `/api/admin/stats` and
    `/api/admin/products/1/shop-links` returned HTTP 401.
  - Preview/live `/api/legal-documents/impressum` returned HTTP 404 when no
    published DB legal document exists.
  - Preview/live `/impressum`, `/datenschutz`, and `/nutzungsbedingungen`
    returned HTTP 200 through static fallback.
  - Preview/live `/api/admin/audit-log` returned HTTP 404.
- Notes:
  - Authenticated admin browser QA is still open because no admin session or
    credentials are available in the environment.

## 2026-05-07 Admin Operations Core Migration Deployed

- Scope:
  - Implemented the Admin-QA core migration slice from
    `.agent-memory/admin_qa.md`.
  - Dashboard signup analytics now uses `Anmeldungen` for registrations in
    the selected range and activation subtext for users with
    `email_verified_at IS NOT NULL`; no separate "Neue Besucher" card is used.
  - Added product shop-link core tables, link-health storage, first-party
    product link click tracking, and editable legal-document storage.
  - Backfilled `product_shop_links` from legacy `products.shop_link`.
  - Added `/api/products/:id/out` redirect tracking for catalog product cards.
  - Added admin product filters for moderation, affiliate status, image status,
    and link health; added product image delete and `blocked` moderation.
  - Added blocked product-submitter controls to admin user management.
  - Added `/administrator/legal` backed by admin legal-document CRUD.
  - Reduced visible admin sidebar menu to the owner-approved primary areas.
- Remote D1 migrations:
  - Applied to `supplementstack-production`:
    `0072_admin_operations_core.sql`.
- Pages deploy:
  - Project: `supplementstack`.
  - Preview URL: `https://e44d85f2.supplementstack.pages.dev`.
  - Live URL: `https://supplementstack.de`.
- Validation:
  - `functions`: `npx tsc -p tsconfig.json --noEmit` passed.
  - `frontend`: `npx tsc --noEmit` passed.
  - `frontend`: `npm run build` passed.
  - `git diff --check` passed with existing LF/CRLF warnings only.
- Remote D1 postflight:
  - `product_shop_links`, `product_link_clicks`, and `legal_documents`
    returned expected table counts after migration/backfill.
- Smoke checks:
  - Preview/live `/api/products` returned HTTP 200.
  - Preview/live unauthenticated `/api/admin/stats` returned HTTP 401.
- Notes:
  - Authenticated browser QA remains open because no admin session was
    available locally.
  - `.agent-memory/deployment_images/search_modal.png`,
    `.agent-memory/deployment_images/user_stacks_card.png`, and
    `.agent-memory/deployment_images/was_passiert.png` remain open TODO
    references and were intentionally not deleted.

## 2026-05-07 Admin Sidebar Density Retune Deployed

- Scope:
  - Applied owner-provided `menu_soll.png` / `menu_ist.png` references to
    admin menu typography and spacing only.
  - Reduced desktop sidebar width, brand logo/name/subtitle sizing, nav row
    height, icon size, label spacing, badge size, and group gaps.
  - Replaced the heavy active navigation outline with a compact neutral card
    treatment matching the denser target menu.
  - Deleted only the completed images:
    `.agent-memory/deployment_images/menu_soll.png` and
    `.agent-memory/deployment_images/menu_ist.png`.
  - Retained `.agent-memory/deployment_images/` for future open visual TODO
    images and added `.gitkeep` so the folder persists.
- Remote D1 migrations:
  - No migration required.
- Pages deploy:
  - Project: `supplementstack`.
  - Preview URL: `https://a9e5e4d0.supplementstack.pages.dev`.
  - Live URL: `https://supplementstack.de`.
- Validation:
  - `frontend`: `npx tsc --noEmit` passed.
  - `frontend`: `npm run lint --if-present` passed.
  - `frontend`: `npm run build` passed.
  - `node --check scripts/admin-browser-smoke.mjs` passed.
  - `git diff --check` passed with existing LF/CRLF warnings only.
- Smoke checks:
  - Preview/live `/administrator/dashboard` returned HTTP 200.
  - Preview/live `/administrator/interactions` returned HTTP 200.
  - Preview/live unauthenticated `/api/interactions` returned HTTP 401.
- Notes:
  - Authenticated visual QA remains open because no admin browser session was
    available locally.

## 2026-05-07 Admin Typography And Interaction Matrix Redesign Deployed

- Scope:
  - Applied the owner-provided `Schriftarten.png` admin typography/color
    direction to the admin shell/sidebar.
  - Reworked `/administrator/interactions` toward the provided
    `Wechselwirkungs-Matrix.png` reference: page hero, severity count pills,
    compact grid matrix, vertical column labels, diagonal self markers,
    legend, and hover detail.
  - Moved the interaction create form behind the `Hinzufuegen` action so the
    matrix is the primary first-viewport surface.
  - Deleted the completed reference images from that pass. The
    `.agent-memory/deployment_images/` folder is now retained for future open
    visual TODO images.
- Remote D1 migrations:
  - No migration required.
- Pages deploy:
  - Project: `supplementstack`.
  - Preview URL: `https://4f190a86.supplementstack.pages.dev`.
  - Live URL: `https://supplementstack.de`.
- Validation:
  - `frontend`: `npx tsc --noEmit` passed.
  - `frontend`: `npm run lint --if-present` passed.
  - `frontend`: `npm run build` passed.
  - `node --check scripts/admin-browser-smoke.mjs` passed.
- Smoke checks:
  - Preview/live `/administrator/interactions` returned HTTP 200.
  - Preview/live `/administrator/user-products` returned HTTP 200.
  - Preview/live unauthenticated `/api/interactions` returned HTTP 401.
- Notes:
  - Authenticated visual QA remains open because no admin browser session was
    available locally.

## 2026-05-07 Product Image WebP Normalization Deployed

- Scope:
  - `ImageCropModal` now exports cropped product images as 512 x 512 px WebP
    at quality `0.84`, with automatic JPEG fallback when WebP export is not
    available.
  - Product image uploads keep the same user-facing flow; conversion happens
    invisibly before upload.
  - Admin and legacy product image upload routes now share
    `functions/api/lib/product-images.ts` for supported content types and a
    1 MB post-optimization upload limit.
  - R2 filenames now use the actual uploaded content type, so modern browser
    uploads are stored as `.webp`.
- Remote D1 migrations:
  - No migration required.
- Pages deploy:
  - Project: `supplementstack`.
  - Preview URL: `https://c07d6e4d.supplementstack.pages.dev`.
  - Live URL: `https://supplementstack.de`.
- Validation:
  - `functions`: `npx tsc -p tsconfig.json --noEmit` passed.
  - `frontend`: `npx tsc --noEmit` passed.
  - `frontend`: `npm run lint --if-present` passed.
  - `frontend`: `npm run build` passed.
  - `node --check scripts/admin-browser-smoke.mjs` passed.
  - `node --check scripts/user-browser-smoke.mjs` passed.
  - `git diff --check` passed with existing LF/CRLF warnings only.
- Smoke checks:
  - Preview/live `/administrator/product-qa` returned HTTP 200.
  - Preview/live `/administrator/products/1` returned HTTP 200.
  - Preview/live unauthenticated `POST /api/admin/products/1/image` returned
    HTTP 401.
- Notes:
  - Authenticated image upload QA remains open because no admin session was
    available locally.

## 2026-05-07 Wirkstoffe/Formen Rebuild Remote-Migrated And Deployed

- Scope:
  - Implemented canonical Wirkstoff search across ingredient names, synonyms,
    and forms with optional `matched_form_id` / `matched_form_name`.
  - Added optional `form_id` filtering to `/api/ingredients/:id/products`.
  - Added `ingredient_precursors` plus admin CRUD and Administrator
    `Wirkstoffteile` UI.
  - Added form-selection step to the stack add flow.
  - Consolidated L-Carnitin duplicates: old ingredients `60`, `65`, and `66`
    into canonical ingredient `13` with forms `155`, `154`, and `158`.
  - Merged old form `189` into form `155`.
- Remote D1 migrations:
  - Applied to `supplementstack-production`:
    `0069_ingredient_lookup_indexes.sql`,
    `0070_ingredient_precursors.sql`,
    `0071_consolidate_l_carnitine_forms.sql`.
  - Follow-up migration list reported no migrations to apply.
- Pages deploy:
  - Project: `supplementstack`.
  - First preview before final search-ranking patch:
    `https://c9131194.supplementstack.pages.dev`.
  - Final preview after the ALCAR ranking patch:
    `https://e3bb987b.supplementstack.pages.dev`.
  - Live URL: `https://supplementstack.de`.
- Validation:
  - `functions`: `npx tsc -p tsconfig.json --noEmit` passed.
  - `frontend`: `npx tsc --noEmit` passed.
  - `frontend`: `npm run lint --if-present` passed.
  - `frontend`: `npm run build` passed.
  - `node --check scripts/admin-browser-smoke.mjs` passed.
  - `node --check scripts/user-browser-smoke.mjs` passed.
  - Final patch revalidation: functions typecheck, frontend build, and
    `git diff --check` passed.
- Remote D1 postflight:
  - Only ingredient `13` remains from IDs `13`, `60`, `65`, and `66`.
  - No references remain to ingredient IDs `60`, `65`, or `66`.
  - Form `189` is removed; forms `154`, `155`, and `158` remain under
    ingredient `13`.
  - No mismatched form parents, no ingredient self-interactions, no duplicate
    normalized synonyms under ingredient `13`, and `PRAGMA foreign_key_check`
    returned no rows.
- Smoke checks:
  - Live and final preview `/api/ingredients/search?q=alcar` returned
    L-Carnitin with `matched_form_id: 155`.
  - Live and final preview `/api/ingredients/13/products?form_id=155`
    exercised the new form filter.
  - Live `/administrator/ingredients` and
    `/administrator/ingredients/13?section=precursors` returned HTTP 200.
  - Live unauthenticated `/api/admin/ingredients/13/precursors` returned
    HTTP 401.
- Notes:
  - Authenticated owner browser QA remains open because no admin session was
    available locally.
  - Local D1 apply still needs the old local
    `0009_auth_profile_extensions.sql` journal/schema mismatch fixed first if
    local migration replay is required.

## 2026-05-07 Admin Browser-QA Text/UX Cleanup Deployed

- Scope:
  - Cleaned productive admin/user UI text after owner browser-QA feedback:
    removed development notes, replaced visible ASCII fallback German, and
    simplified technical wording.
  - Removed German from translation targets.
  - Fixed `Linkmeldungen` search input spacing around the search icon.
  - Reworked Product-QA labels and added direct admin product image upload from
    QA rows.
  - Added German labels/options to the Interaction Matrix filters/create form.
  - Added German comma decimal handling to touched admin/user entry/display
    surfaces while leaving backend/database values numeric.
- Remote D1 migrations:
  - No new migration required.
- Pages deploy:
  - Project: `supplementstack`.
  - Preview URL: `https://6cd86fa0.supplementstack.pages.dev`.
  - Live URL: `https://supplementstack.de`.
- Validation:
  - `frontend`: `npx tsc --noEmit` passed.
  - `frontend`: `npm run lint --if-present` passed.
  - `frontend`: `npm run build` passed.
  - `node --check scripts/admin-browser-smoke.mjs` passed.
  - Wrangler Pages deploy compiled the Functions bundle successfully.
- Smoke checks:
  - Preview/live `/administrator`, `/administrator/product-qa`,
    `/administrator/interactions`, `/administrator/translations`, and `/admin`
    returned HTTP 200.
  - Preview/live unauthenticated `/api/admin/health` returned HTTP 401.

## 2026-05-07 Ingredient Research Coverage List Deployed

- Scope:
  - Extended `GET /api/admin/ingredients` with ingredient research/content
    coverage counts from existing tables.
  - Updated `/administrator/ingredients` to show automatic checklist badges for
    Blog/Wissen, DGE, official sources, studies, NRV/UL, Dosing,
    Dosis-Quellen, and display profile.
  - Added direct row actions to ingredient detail Research and Dosing tabs.
- Remote D1 migrations:
  - No new migration required.
  - `npx wrangler d1 migrations list supplementstack-production --remote`
    returned: no migrations to apply.
- Pages deploy:
  - Project: `supplementstack`.
  - Preview URL: `https://d363ade8.supplementstack.pages.dev`.
  - Live URL: `https://supplementstack.de`.
- Validation:
  - `functions`: `npx tsc -p tsconfig.json --noEmit` passed.
  - `frontend`: `npx tsc --noEmit` passed.
  - `frontend`: `npm run lint --if-present` passed.
  - `frontend`: `npm run build` passed.
  - Scoped `git diff --check` passed with existing LF/CRLF warnings only.
  - Remote D1 read-only coverage SQL returned one row successfully.
- Smoke checks:
  - Preview/live `/administrator/ingredients` returned HTTP 200.
  - Preview/live unauthenticated `/api/admin/ingredients` returned HTTP 401.

## 2026-05-06 Administrator Final Code Pass Deployed

- Scope:
  - Removed the old frontend Admin monolith while preserving `/admin` as an
    alias to `/administrator`.
  - Added editable Product Ingredient rows in Product Detail.
  - Added versioned Admin Product Image upload backed by R2.
  - Added NRV update/delete optimistic locking.
  - Removed the dead Administrator placeholder page.
- Remote D1 migrations:
  - No new migration required.
  - `npx wrangler d1 migrations list supplementstack-production --remote`
    returned: no migrations to apply.
- Pages deploy:
  - Project: `supplementstack`.
  - Preview URL: `https://7db85497.supplementstack.pages.dev`.
  - Live URL: `https://supplementstack.de`.
- Validation:
  - `functions`: `npx tsc -p tsconfig.json --noEmit` passed.
  - `frontend`: `npx tsc --noEmit` passed.
  - `frontend`: `npm run lint --if-present` passed.
  - `frontend`: `npm run build` passed.
  - `node --check scripts/admin-browser-smoke.mjs` passed.
  - `node --check scripts/user-browser-smoke.mjs` passed.
  - Admin guard smoke passed on preview/live.
  - User public/guard browser smoke passed on preview/live.
  - `git diff --check` passed with existing LF/CRLF warnings only.
- Smoke checks:
  - Preview/live `/`, `/administrator`, `/administrator/products/1`,
    `/administrator/products/1?section=wirkstoffe`,
    `/administrator/products/1?section=overview`,
    `/administrator/ingredients/1?section=nrv`, `/administrator/health`,
    `/admin`, and `/admin/products/1` returned HTTP 200.
  - Preview/live unauthenticated Product Detail, Product Ingredient mutation,
    Admin Product Image upload, NRV mutation, and Health API checks returned
    HTTP 401.
- Notes:
  - Authenticated browser QA remains the final owner feedback gate by request.

## 2026-05-06 Admin/User Code Completion Pass Deployed

- Scope:
  - Closed final code-side admin completion gaps after Critic review:
    legacy `/admin` now routes into `/administrator`, Dosing is in sidebar,
    Product Detail has edit/save for high-impact product fields, and
    Interactions have dedicated admin-by-id GET/PUT/DELETE endpoints with
    version conflict handling.
  - Added cookie mutation Origin/Referer hardening while keeping Bearer tooling
    available.
  - Added route-level lazy loading and split frontend chunks.
  - Expanded admin/user smoke scripts and added CI syntax checks for them.
- Remote D1 migrations:
  - No new migrations required; remote list returned no pending migrations.
- Pages deploy:
  - Project: `supplementstack`.
  - Preview URL: `https://93454a26.supplementstack.pages.dev`.
  - Live URL: `https://supplementstack.de`.
- Validation:
  - `functions`: `npx tsc -p tsconfig.json --noEmit` passed.
  - `frontend`: `npx tsc --noEmit` passed.
  - `frontend`: `npm run lint --if-present` passed.
  - `frontend`: `npm run build` passed with no Vite chunk-size warning.
  - `node --check scripts/admin-browser-smoke.mjs` passed.
  - `node --check scripts/user-browser-smoke.mjs` passed.
  - Admin guard smoke passed on preview/live.
  - User public/guard browser smoke passed on preview/live.
  - `git diff --check` passed with existing LF/CRLF warnings only.
- Smoke checks:
  - Preview/live `/`, `/administrator`, `/administrator/dosing`, `/admin`,
    `/admin/products/1` returned HTTP 200.
  - Preview/live unauthenticated `/api/admin/stats`, `/api/admin/health`, and
    `/api/admin/interactions/1` returned HTTP 401.
- Notes:
  - Authenticated browser QA remains owner feedback gate because no admin/user
    QA credentials were present in the local process.

## 2026-05-06 Admin Rebuild Batch Deployed

- Scope:
  - Deployed the current `/administrator` rebuild batch: version-aware admin
    edit paths, structured Product Warnings, Research Evidence Grade/retraction
    fields, Evidence Summary, NRV CRUD, Dosing plausibility warnings, Product-QA
    versioning, Interaction detail/global improvements, and cookie-only
    frontend auth.
- Remote D1 migrations:
  - Applied to `supplementstack-production`: `0055_add_version_columns.sql`,
    `0056_display_profile_translations.sql`,
    `0058_product_warnings.sql`,
    `0060_ingredient_synonyms_language.sql`,
    `0062_admin_audit_structured_diff.sql`,
    `0067_research_evidence_flags.sql`,
    `0068_nutrient_reference_values.sql`.
  - Follow-up migration list check returned: no migrations to apply.
- Pages deploy:
  - Project: `supplementstack`.
  - Preview URL: `https://31301b17.supplementstack.pages.dev`.
  - Live URL: `https://supplementstack.de`.
- Validation:
  - `functions`: `npx tsc -p tsconfig.json --noEmit` passed.
  - `frontend`: `npm run build` passed with known Vite chunk-size warning.
  - `ADMIN_QA_GUARD_ONLY=1 node scripts/admin-browser-smoke.mjs` passed
    against the new preview URL.
  - Preview/live `/` and `/administrator` returned HTTP 200.
  - Preview/live unauthenticated `/api/admin/stats` and `/api/admin/health`
    returned HTTP 401.
- Notes:
  - Authenticated browser QA was not run because no `ADMIN_QA_TOKEN`,
    `SUPPLEMENTSTACK_ADMIN_TOKEN`, `ADMIN_TOKEN`, `ADMIN_QA_EMAIL`, or
    `ADMIN_QA_PASSWORD` was present in the local process.

## 2026-05-06 Admin Local Build Remote Blocked

- Superseded by `2026-05-06 Admin Rebuild Batch Deployed`; the token was later
  loaded from the documented local script, migrations were applied, and Pages
  was deployed.
- No deployment or remote migration was performed for the latest local admin
  rebuild batch.
- Remote check attempted:
  `npx wrangler d1 migrations list supplementstack-production --remote`.
- Result: blocked by Cloudflare auth:
  `Authentication error [code: 10000]` and
  `Invalid access token [code: 9109]`.
- Next deployment step is to restore a valid Cloudflare token, apply pending
  admin migrations, then deploy Pages and run authenticated smoke checks.

## Latest Known Production State

Phase B database migrations 0026-0035 are live in production D1.
Phase C backend refactor + new dose recommendations API are deployed to Cloudflare Pages.
Demo product loading fix is deployed to Cloudflare Pages preview.
D3 recommendations / product modal data loading fix is deployed to Cloudflare Pages preview.
Preview search API-base fix is deployed to Cloudflare Pages preview.
Affiliate disclosure cleanup is deployed to Cloudflare Pages preview.
Phase D product recommendations rename and admin translations MVP are committed,
remote-migrated, and deployed to Cloudflare Pages preview.
Admin translations expansion is committed and deployed to Cloudflare Pages
preview.
Production custom domain `supplementstack.de` is live and has received the same
recent deploys as the Cloudflare Pages subdomain. Public SEO indexing remains
intentionally disabled/gated.
UX add-product modal focus polish is committed and deployed to Cloudflare Pages.
Targeted User/Demo/Search/Stack UX fixes plus Admin UX fixes are committed and
deployed to Cloudflare Pages preview and live custom domain.
Launch QA flow blockers are committed and deployed to Cloudflare Pages preview
and live custom domain.
Stack-warnings batched interaction lookup is committed and deployed to
Cloudflare Pages preview and live custom domain.
Consent-based GA4 analytics is committed and deployed to Cloudflare Pages
preview and live custom domain.
Legal pages are committed and deployed to Cloudflare Pages preview and live
custom domain.
Demo/session abuse hardening, product creation rate limits, trusted
user-product submitters, and shop-domain host matching are committed,
remote-migrated, and deployed to Cloudflare Pages preview and live custom
domain.
Product ingredient publishing model is committed, remote-migrated, and
deployed to Cloudflare Pages preview and live custom domain.
Sub-ingredient product workflow is committed, remote-migrated, and deployed to
Cloudflare Pages preview and live custom domain.
Launch QA stack/profile fixes, stack item explicit product references, demo
D3/K2 dosage reduction, and guideline-source normalization are committed,
remote-migrated, deployed, and live-smoked on preview/live.
Stack item intake intervals and stack product replacement are committed,
remote-migrated where needed, deployed, and live-smoked on preview/live.
Search/Wishlist dead-code cleanup is committed, deployed, and smoke-checked on
preview/live.
Launch-readiness implementation bundle is committed, deployed, and
smoke-checked on preview/live.
GitHub Actions D1 backup has run successfully both manually and automatically;
token scopes are verified.
Administrator User-Produkte server pagination and expanded admin browser-smoke
coverage are deployed to Cloudflare Pages preview and live custom domain.
Administrator live Launch-Checks and URL-backed Ingredient detail tabs are
deployed to Cloudflare Pages preview and live custom domain.
Backend Auth dual-mode cookies and read-only Ingredient Interactions are
deployed to Cloudflare Pages preview and live custom domain.
Frontend cookie-aware auth and form-specific Ingredient display-profile editing
are deployed to Cloudflare Pages preview and live custom domain.
Administrator Ingredient i18n deeplink bridge is deployed to Cloudflare Pages
preview and live custom domain.
Administrator Health dashboard is API-backed and deployed to Cloudflare Pages
preview and live custom domain.
Administrator Command Palette/search is deployed to Cloudflare Pages preview
and live custom domain.
Administrator CSV export is deployed to Cloudflare Pages preview and live
custom domain.
Administrator PubMed lookup is deployed to Cloudflare Pages preview and live
custom domain.
Administrator Plausibility-Warner, Audit Diff improvement, remote
`0054_affiliate_link_health`, and the separate `supplement-stack-maintenance`
cron Worker are deployed.
Administrator Link Health visibility is deployed in Product Detail and
Product-QA.
Administrator Link Health rollups are deployed in Health and Products list.
Administrator PubMed KV cache, Evidence Source UI, and Link-Health Critic fixes
are deployed.
Administrator rebuild batch with versioning, structured warnings, evidence
flags, NRV CRUD, dosing plausibility warnings, and interaction/Product-QA
locking support is remote-migrated and deployed to preview/live.
Admin/User code completion pass is deployed: legacy admin routes into
`/administrator`, product detail editing is live, Dosing is navigable, cookie
mutation Origin/Referer hardening is live, and smoke tooling is expanded.

## 2026-05-06 Administrator PubMed Cache + Evidence UI Deployed

- Scope:
  - Added optional 24h `RATE_LIMITER` KV cache to PubMed lookup.
  - Added source/evidence filters and badges to Ingredient Research tab.
  - Included checked `link_health.url` in Admin API parsing.
  - Deleted stale Link-Health rows when product `shop_link` changes.
  - Broadened Maintenance Worker HEAD fallback to sparse Range GET for common
    non-ok statuses.
- Remote D1 migrations:
  - No new migration in this slice.
- Maintenance Worker deploy:
  - Config: `wrangler.maintenance.toml`.
  - Worker: `supplement-stack-maintenance`.
  - URL: `https://supplement-stack-maintenance.email-d8f.workers.dev`.
  - Cron: `17 2 * * *`.
  - Version ID: `a6c74b9a-7ff8-452c-9a14-09996a3d16f2`.
- Pages deploy:
  - Preview URL: `https://77f16bd6.supplementstack.pages.dev`.
  - Live URL: `https://supplementstack.de`.
- Validation:
  - `npx wrangler deploy -c wrangler.maintenance.toml --dry-run` passed.
  - `npx wrangler deploy -c wrangler.maintenance.toml` passed.
  - `npx tsc -p tsconfig.json --noEmit` from `functions/` passed.
  - `npx tsc --noEmit` from `frontend/` passed.
  - `npm run lint --if-present` from `frontend/` passed.
  - `npm run build` from `frontend/` passed with known Vite chunk-size
    warning.
  - `node --check scripts/admin-browser-smoke.mjs` passed.
  - `ADMIN_QA_GUARD_ONLY=1 node scripts/admin-browser-smoke.mjs` passed.
  - Scoped `git diff --check` passed with CRLF warnings only.
- Smoke checks:
  - Preview/live `/`, `/administrator/ingredients/1?section=research`,
    `/administrator/products`, `/administrator/product-qa`, and
    `/administrator/health` returned HTTP 200.
  - Preview/live unauthenticated PubMed lookup, Products, Product-QA, Health,
    and `/api/me` returned HTTP 401.
  - Maintenance Worker root returned HTTP 404.
- Notes:
  - Authenticated cache/payload/edit-flow QA remains blocked by missing admin
    token/session.

## 2026-05-06 Administrator Link Health Rollups Deployed

- Scope:
  - Added Affiliate Link Health rollup section/metrics to
    `GET /api/admin/health`.
  - Product list rows now show compact technical Link-Health badges.
  - Inline Product save preserves returned `link_health`.
- Remote D1 migrations:
  - No new migration in this slice; `0054_affiliate_link_health.sql` was
    already applied.
- Validation:
  - `npx tsc -p tsconfig.json --noEmit` from `functions/` passed.
  - `npx tsc --noEmit` from `frontend/` passed.
  - `npm run lint --if-present` from `frontend/` passed.
  - `npm run build` from `frontend/` passed with the known Vite chunk-size
    warning.
  - Scoped `git diff --check` passed with CRLF warnings only.
  - `ADMIN_QA_GUARD_ONLY=1 node scripts/admin-browser-smoke.mjs` passed.
- Deploy prep:
  - Copied `functions/` to `frontend/dist/functions`.
  - Verified `frontend/dist/functions/api/[[path]].ts` exists with
    `Test-Path -LiteralPath`.
- Deploy command:
  - `. .\scripts\use-supplementstack-cloudflare.local.ps1; npx wrangler pages deploy frontend/dist --project-name supplementstack`
- Preview URL: `https://922f705f.supplementstack.pages.dev`.
- Live URL: `https://supplementstack.de`.
- Smoke checks:
  - Preview/live `/`, `/administrator/products`,
    `/administrator/products/1`, `/administrator/product-qa`, and
    `/administrator/health` returned HTTP 200.
  - Preview/live unauthenticated Products, Product Detail, Product-QA,
    Health, and `/api/me` returned HTTP 401.
- Notes:
  - Authenticated Health payload inspection is still blocked by missing admin
    token/session.

## 2026-05-06 Administrator Link Health Visibility Deployed

- Scope:
  - Admin Products/Product Detail/Product-QA endpoints now include optional
    `link_health` data from `affiliate_link_health`.
  - Product-QA update responses keep returning normalized products with
    `link_health`.
  - Product Detail and Product-QA render technical link health status beside
    shop-link context.
  - Admin smoke script now includes direct Ingredient section deep links and
    unauthenticated API guard checks.
- Remote D1 migrations:
  - No new migration in this slice; `0054_affiliate_link_health.sql` was
    already applied in the prior slice.
- Validation:
  - `npx tsc -p tsconfig.json --noEmit` from `functions/` passed.
  - `npx tsc --noEmit` from `frontend/` passed.
  - `npm run lint --if-present` from `frontend/` passed.
  - `npm run build` from `frontend/` passed with the known Vite chunk-size
    warning.
  - `node --check scripts/admin-browser-smoke.mjs` passed.
  - `ADMIN_QA_GUARD_ONLY=1 node scripts/admin-browser-smoke.mjs` passed.
  - Scoped `git diff --check` passed with CRLF warnings only.
- Deploy prep:
  - Copied `functions/` to `frontend/dist/functions`.
  - Verified `frontend/dist/functions/api/[[path]].ts` exists with
    `Test-Path -LiteralPath`.
- Deploy command:
  - `. .\scripts\use-supplementstack-cloudflare.local.ps1; npx wrangler pages deploy frontend/dist --project-name supplementstack`
- Preview URL: `https://aafb0e9e.supplementstack.pages.dev`.
- Live URL: `https://supplementstack.de`.
- Smoke checks:
  - Preview/live `/`, `/administrator/products`,
    `/administrator/products/1`, `/administrator/product-qa`,
    `/administrator/ingredients/1?section=dosing`,
    `/administrator/audit-log`, and `/administrator/health` returned HTTP
    200.
  - Preview/live unauthenticated Products, Product Detail, Product-QA, PubMed
    lookup, CSV export, Health, User-Product bulk approve, and `/api/me`
    returned HTTP 401.
- Notes:
  - Authenticated payload verification of actual `link_health` JSON remains
    blocked by missing admin token/session.

## 2026-05-06 Administrator Plausibility, Audit Diff, Link Health Worker Deployed

- Scope:
  - Added non-blocking dose plausibility warnings to Ingredient detail Dosing
    and research-source dose forms.
  - Improved Audit-Log rendering for top-level `{ before, after }` change
    objects.
  - Added `affiliate_link_health` table for latest product shop-link health
    state.
  - Added separate maintenance Worker config and Worker entry for nightly link
    checks.
- Remote D1 migrations:
  - Applied `0054_affiliate_link_health.sql` to
    `supplementstack-production`.
- Maintenance Worker deploy:
  - Config: `wrangler.maintenance.toml`.
  - Worker: `supplement-stack-maintenance`.
  - URL: `https://supplement-stack-maintenance.email-d8f.workers.dev`.
  - Cron: `17 2 * * *`.
  - Version ID: `70128ee7-5fdd-476c-a3a9-6a69fd02f8f1`.
- Pages deploy:
  - Preview URL: `https://0cc971cc.supplementstack.pages.dev`.
  - Live URL: `https://supplementstack.de`.
- Validation:
  - `npx wrangler deploy -c wrangler.maintenance.toml --dry-run` passed.
  - `npx tsc -p tsconfig.json --noEmit` from `functions/` passed.
  - `npx tsc --noEmit` from `frontend/` passed.
  - `npm run lint --if-present` from `frontend/` passed.
  - `npm run build` from `frontend/` passed with the known Vite chunk-size
    warning.
  - `node --check scripts/admin-browser-smoke.mjs` passed.
  - Scoped `git diff --check` passed with CRLF warnings only.
  - Remote D1 table check confirmed `affiliate_link_health` exists.
  - Remote migration list reports no pending migrations.
- Smoke checks:
  - Preview/live `/`, `/administrator/ingredients/1?section=dosing`,
    `/administrator/ingredients/1?section=research`,
    `/administrator/audit-log`, `/administrator/health`, and
    `/administrator/products` returned HTTP 200.
  - Preview/live unauthenticated PubMed lookup, CSV export, Health,
    User-Product bulk approve, and `/api/me` returned HTTP 401.
  - Preview/live `/api/scheduled` returned HTTP 404.
  - Maintenance Worker root returned HTTP 404.
- Notes:
  - Cron Triggers run on UTC; the first scheduled row writes should be checked
    after the next `17 2 * * *` run.
  - Authenticated admin/browser QA remains blocked by missing admin token or
    credentials.

## 2026-05-06 Administrator PubMed Lookup Deployed

- Scope:
  - Added admin-only `GET /api/admin/research/pubmed-lookup?pmid=&doi=`.
  - PMID lookup loads PubMed ESummary directly.
  - DOI lookup resolves a PubMed ID through ESearch before loading ESummary.
  - Ingredient research-source forms can fill source title, URL, DOI, PMID,
    organization, date, journal/authors notes, and source kind from PubMed.
- Remote D1 migrations:
  - No new migration required.
- Validation:
  - `npx tsc -p tsconfig.json --noEmit` from `functions/` passed.
  - `npx tsc --noEmit` from `frontend/` passed.
  - `npm run lint --if-present` from `frontend/` passed.
  - `npm run build` from `frontend/` passed with the known Vite chunk-size
    warning.
  - `node --check scripts/admin-browser-smoke.mjs` passed.
  - Scoped `git diff --check` passed with CRLF warnings only.
- Deploy prep:
  - Copied `functions/` to `frontend/dist/functions`.
  - Verified `frontend/dist/functions/api/[[path]].ts` exists with
    `Test-Path -LiteralPath`.
- Deploy command:
  - `. .\scripts\use-supplementstack-cloudflare.local.ps1; npx wrangler pages deploy frontend/dist --project-name supplementstack`
- Preview URL: `https://f7299c4d.supplementstack.pages.dev`.
- Live URL: `https://supplementstack.de`.
- Smoke checks:
  - Preview/live `/`, `/administrator/ingredients/1?section=research`,
    `/administrator/ingredients/1?section=i18n&language=en`, and
    `/administrator/health` returned HTTP 200.
  - Preview/live unauthenticated PubMed lookup by PMID, PubMed lookup by DOI,
    CSV export, and `/api/me` returned HTTP 401.
- Notes:
  - Authenticated PubMed lookup/form-save QA is still open because no admin
    token or admin credentials are available in the environment.

## 2026-05-06 Administrator CSV Export Deployed

- Scope:
  - Added admin-only `GET /api/admin/export?entity=...`.
  - Allowlisted entities: `products`, `ingredients`, `user-products`,
    `product-qa`, and `link-reports`.
  - CSV export uses explicit safe columns, no raw auth/secrets, correct CSV
    escaping, `Content-Disposition` filenames, no-store caching, and a
    5,000-row cap.
  - Export filters support `q`, `status`, and `issue` where relevant.
  - Admin shell shows a compact CSV button only on matching list/queue pages.
- Remote D1 migrations:
  - No new migration required.
- Validation:
  - `npx tsc -p tsconfig.json --noEmit` from `functions/` passed.
  - `npx tsc --noEmit` from `frontend/` passed.
  - `npm run lint --if-present` from `frontend/` passed.
  - `npm run build` from `frontend/` passed with the known Vite chunk-size
    warning.
  - `node --check scripts/admin-browser-smoke.mjs` passed.
  - Scoped `git diff --check` passed with CRLF warnings only.
- Deploy prep:
  - Copied `functions/` to `frontend/dist/functions`.
  - Verified `frontend/dist/functions/api/[[path]].ts` exists with
    `Test-Path -LiteralPath`.
- Deploy command:
  - `. .\scripts\use-supplementstack-cloudflare.local.ps1; npx wrangler pages deploy frontend/dist --project-name supplementstack`
- Preview URL: `https://3355b7d1.supplementstack.pages.dev`.
- Live URL: `https://supplementstack.de`.
- Smoke checks:
  - Preview/live `/`, `/administrator/products`,
    `/administrator/ingredients`, `/administrator/user-products?status=pending`,
    `/administrator/product-qa?issue=missing_shop_link`, and
    `/administrator/link-reports?status=open` returned HTTP 200.
  - Preview/live unauthenticated exports for `products`, `ingredients`,
    `user-products`, `product-qa`, `link-reports`, and invalid entity returned
    HTTP 401, as did unauthenticated Search and `/api/me`.
- Notes:
  - Authenticated browser/mobile QA and actual CSV download verification are
    still open because no admin token or admin credentials are available in
    the environment.

## 2026-05-06 Administrator Command Palette Deployed

- Scope:
  - Added admin-only `GET /api/admin/search?q=&limit=`.
  - Short queries return curated core `/administrator` route results.
  - Search queries look across ingredients, products, user-products, and
    knowledge articles with per-entity defensive fallback.
  - Added `AdministratorCommandPalette.tsx` and wired it into the admin
    topbar.
  - Palette opens via the topbar search trigger and Ctrl/Cmd+K, then supports
    autofocus, Escape close, ArrowUp/ArrowDown, Enter open, and click
    navigation.
- Remote D1 migrations:
  - No new migration required.
- Validation:
  - `npx tsc -p tsconfig.json --noEmit` from `functions/` passed.
  - `npx tsc --noEmit` from `frontend/` passed.
  - `npm run lint --if-present` from `frontend/` passed.
  - `npm run build` from `frontend/` passed with the known Vite chunk-size
    warning.
  - `node --check scripts/admin-browser-smoke.mjs` passed.
  - Scoped `git diff --check` passed with CRLF warnings only.
- Deploy prep:
  - Copied `functions/` to `frontend/dist/functions`.
  - Verified `frontend/dist/functions/api/[[path]].ts` exists with
    `Test-Path -LiteralPath`.
- Deploy command:
  - `. .\scripts\use-supplementstack-cloudflare.local.ps1; npx wrangler pages deploy frontend/dist --project-name supplementstack`
- Preview URL: `https://e9f73506.supplementstack.pages.dev`.
- Live URL: `https://supplementstack.de`.
- Smoke checks:
  - Preview/live `/`, `/administrator/dashboard`, `/administrator/health`,
    `/administrator/ingredients/1?section=i18n&language=en`, and
    `/administrator/translations?entity=ingredients&language=en&q=Magnesium&status=all&focus=ingredients:1:en&returnTo=/administrator/ingredients/1?section=i18n&language=en`
    returned HTTP 200.
  - Preview/live unauthenticated `/api/admin/search?q=mag&limit=12`,
    `/api/admin/health`,
    `/api/admin/translations/ingredients?language=en&q=Magnesium&limit=5&offset=0`,
    and `/api/me` returned HTTP 401.
- Notes:
  - Authenticated browser/mobile QA is still open because no admin token or
    admin credentials are available in the environment.

## 2026-05-06 Administrator Health Dashboard Deployed

- Scope:
  - Added admin-only `GET /api/admin/health`.
  - Health response contains `generated_at`, `summary`, `metrics`, and
    `sections` with safe operational checks.
  - Checks cover missing default doses, stale/overdue ingredient research,
    missing English ingredient translations, pending user-products older than
    7 days, product-QA issues, open link reports, and products missing shop
    links.
  - `/administrator/health` now renders the API snapshot with refresh/retry,
    summary cards, metric cards, check sections, and admin links.
- Remote D1 migrations:
  - No new migration required.
- Validation:
  - `npx tsc -p tsconfig.json --noEmit` from `functions/` passed.
  - `npx tsc --noEmit` from `frontend/` passed.
  - `npm run lint --if-present` from `frontend/` passed.
  - `npm run build` from `frontend/` passed with the known Vite chunk-size
    warning.
  - `node --check scripts/admin-browser-smoke.mjs` passed.
  - Scoped `git diff --check` passed with CRLF warnings only.
- Deploy prep:
  - Copied `functions/` to `frontend/dist/functions`.
  - Verified `frontend/dist/functions/api/[[path]].ts` exists with
    `Test-Path -LiteralPath`.
- Deploy command:
  - `. .\scripts\use-supplementstack-cloudflare.local.ps1; npx wrangler pages deploy frontend/dist --project-name supplementstack`
- Preview URL: `https://3ba2cb28.supplementstack.pages.dev`.
- Live URL: `https://supplementstack.de`.
- Smoke checks:
  - Preview/live `/`, `/administrator/health`,
    `/administrator/ingredients/1?section=i18n&language=en`,
    `/administrator/translations?entity=ingredients&language=en&q=Magnesium&status=all&focus=ingredients:1:en&returnTo=/administrator/ingredients/1?section=i18n&language=en`,
    and `/administrator/launch-checks` returned HTTP 200.
  - Preview/live unauthenticated `/api/admin/health`,
    `/api/admin/translations/ingredients?language=en&q=Magnesium&limit=5&offset=0`,
    `/api/me`, and `/api/admin/launch-checks` returned HTTP 401.
- Notes:
  - Authenticated browser/mobile QA is still open because no admin token or
    admin credentials are available in the environment.

## 2026-05-06 Administrator i18n Deeplink Bridge Deployed

- Scope:
  - `/administrator/ingredients/:id?section=i18n&language=<code>` now bridges
    to the central translations workspace.
  - `/administrator/translations` accepts URL-backed `entity`, `language`,
    `q`, `status`, `page`, `focus`, and safe `/administrator/...` `returnTo`
    state.
  - Focused translation rows are highlighted when present in the loaded page.
- Remote D1 migrations:
  - No new migration required.
- Validation:
  - `npx tsc -p tsconfig.json --noEmit` from `functions/` passed.
  - `npx tsc --noEmit` from `frontend/` passed.
  - `npm run lint --if-present` from `frontend/` passed.
  - `npm run build` from `frontend/` passed with the known Vite chunk-size
    warning.
  - `node --check scripts/admin-browser-smoke.mjs` passed.
  - Scoped `git diff --check` passed with CRLF warnings only.
- Deploy prep:
  - Copied `functions/` to `frontend/dist/functions`.
  - Verified `frontend/dist/functions/api/[[path]].ts` exists with
    `Test-Path -LiteralPath`.
- Deploy command:
  - `. .\scripts\use-supplementstack-cloudflare.local.ps1; npx wrangler pages deploy frontend/dist --project-name supplementstack`
- Preview URL: `https://f1445601.supplementstack.pages.dev`.
- Live URL: `https://supplementstack.de`.
- Smoke checks:
  - Preview/live `/`,
    `/administrator/ingredients/1?section=i18n&language=en`,
    `/administrator/translations?entity=ingredients&language=en&q=Magnesium&status=all&focus=ingredients:1:en&returnTo=/administrator/ingredients/1?section=i18n&language=en`,
    `/administrator/ingredients/1?section=display`, and
    `/administrator/launch-checks` returned HTTP 200.
  - Preview/live unauthenticated
    `/api/admin/translations/ingredients?language=en&q=Magnesium&limit=5&offset=0`,
    `/api/me`, and `/api/admin/launch-checks` returned HTTP 401.
- Notes:
  - Authenticated browser/mobile QA is still open because no admin token or
    admin credentials are available in the environment.

## 2026-05-05 - Launch Readiness Implementation Bundle

- Commit: `6a639cd` - Feature: Close launch readiness gaps.
- No D1 migration.
- Preview: `https://d8e1340c.supplementstack.pages.dev`.
- Live: `https://supplementstack.de`.
- Build asset: `assets/index-BlZlfAwp.js`.
- Scope:
  - Stack/Product cost calculations now account for selected target dose,
    `basis_quantity`/`basis_unit`, compatible mass-unit conversion, and intake
    interval. IU/IE is normalized only.
  - Added frontend/backend stack-calculation helpers and 5 Vitest cases.
  - Added Admin dose-recommendation CRUD backend/API/UI.
  - Added Admin sub-ingredient mapping UI.
  - Added Admin audit-log endpoint/viewer with sensitive key redaction and
    detail-only IP/User-Agent display.
  - Updated legal/consent preflight copy for privacy, terms, imprint,
    registration, landing, and `LegalDisclaimer`.
  - Added context-near affiliate labels in ProductCard and stack emails
    temporarily; this was later superseded by the 2026-05-06 Affiliate CTA
    Cleanup decision that product-near CTAs do not explicitly mark affiliate
    links.
  - Fixed strict frontend TypeScript (`npx tsc --noEmit`) via targeted types.
- Validation passed: frontend `npx tsc --noEmit`, frontend
  `npm run lint --if-present`, frontend `npm run build`, frontend
  `npm test -- --run` (5 tests), functions `npx tsc -p tsconfig.json`, and
  `git diff --check`.
- Smoke checks passed: preview/live root 200 with `assets/index-BlZlfAwp.js`;
  preview/live `GET /api/admin/audit-log` 401 unauthenticated;
  preview/live `GET /api/admin/dose-recommendations` 401 unauthenticated;
  preview/live `GET /api/demo/products` 200 with 7 products and top-level
  `basis_quantity`, `basis_unit`, and `search_relevant` fields.

## 2026-05-05 - Search/Wishlist Dead-Code Cleanup

- Commit: `ee273a9` - Cleanup: Remove unused search and wishlist flows.
- No D1 migration.
- Preview: `https://0e174354.supplementstack.pages.dev`.
- Live: `https://supplementstack.de`.
- Removed un-routed `SearchPage`/`WishlistPage`, the old Search-only modal
  components, frontend wishlist API helper, backend wishlist module mount/file,
  ProductCard wishlist props/action UI, unused wishlist/local modal-flow types,
  and active PrivacyPage Wishlist wording.
- Left wishlist DB tables/migrations and account-delete cleanup untouched.
- Validation passed: frontend lint, frontend build, frontend Vitest no-test run,
  functions TypeScript compile, and `git diff --check` with CRLF warnings only.
- Smoke checks passed: preview/live root 200 with `assets/index-BIAACOZy.js`;
  preview/live `GET /api/wishlist` 404; preview/live `/search` and `/wishlist`
  serve the SPA fallback asset for generic React 404 handling.

Latest relevant commits:

- `f5dfa74` - UX: Allow replacing stack products.
- `6c22463` - Feature: Add stack intake intervals.
- `9babeae` - Fix: Calculate stack email costs from daily dose.
- `eff1c6a` - Feature: Send stack emails via SMTP.
- `ba92cd5` - UX: Align authenticated headers with app shell.
- `03ae0f9` - Brand: Use uploaded logo in headers.
- `24b10b5` - Fix: Normalize guideline source values.
- `cb76cf3` - Fix: Remove D1 run success check from profile update.
- `1a3b8e6` - Fix: Build profile response from target values.
- `baa91a5` - Fix: Close live profile and stack warning smokes.
- `0b29fe0` - Fix: Launch QA stack and profile flows.
- `29dcde5` - Feature: Add sub-ingredient product workflow.
- `1272e11` - Feature: Add product ingredient publishing model.
- `18a4141` - Security: Harden demo and user product moderation.
- `9c2c627` - Legal: Add imprint privacy and terms pages.
- `a18136d` - Feature: Add consent-based GA4 analytics.
- `5905a20` - Fix: Batch stack warning interaction lookup.
- `fcb1a6b` - Fix: Close launch QA flow blockers.
- `8fb5431` - UX: Improve stack and admin usability flows.
- `078fc31` - UX: Auto-focus search field in 'Produkt hinzufuegen' modal (Demo + Stack-Workspace).
- `e8f2bbc` - UX: Auto-focus name field when opening 'Produkt hinzufuegen' modal.
- `cebd31a` - Memory: Production domain live, reorganize next-steps.
- `49ed83e` - Feature: Expand admin translation management.
- `862ed57` - Feature: Phase D product recommendations and translations.
- `965d4e4` - Fix: Move affiliate disclosure to footer.
- `b5dba6e` - Fix: Use same-origin API in deployed frontend.
- `2f4248b` - Fix: Restore demo product loading.
- `9107e2e` - Fix: Stabilize dosage and product modal data loading.
- `dd58ba2` - Feature: Add dose recommendations API.
- `b1fd347` - Refactor: Split Pages API into Hono modules.
- `9a5f523` - DB: Phase B complete (migrations 0028-0035).

## Stack Intake Intervals And Product Replacement

### 2026-05-05 - Cloudflare Pages: stack intake intervals and product replacement

- Commit: `6c22463` - Feature: Add stack intake intervals.
- Follow-up commit: `f5dfa74` - UX: Allow replacing stack products.
- Remote D1 migration: `0042_stack_item_intake_interval.sql` applied
  successfully to `supplementstack-production`.
- Final preview URL: `https://7abb76e8.supplementstack.pages.dev`.
- Live URL: `https://supplementstack.de`.
- Scope:
  - Added `stack_items.intake_interval_days` with default 1 and CHECK
    `intake_interval_days >= 1`.
  - Stack create/update/load and mail item rows handle `intake_interval_days`.
  - Stack email renders intake interval separately and calculates package range
    and monthly cost from effective daily usage.
  - Missing shop links in stack emails show `Kauf-Link fehlt - bitte Produkt
    melden`.
  - Stack detail/update responses include product ingredient rows per item.
  - ProductCard range/monthly cost calculation derives servings from parsed
    dosage plus ingredient rows before quantity fallback.
  - StackWorkspace supports in-place stack product editing for dosage, timing,
    and intake interval with an amber icon-only edit pencil.
  - Stack product replacement is supported from `EditProductModal` via
    `Produkt wechseln`, which opens `AddProductModal` in replace mode for the
    same stack, replaces instead of adding, preserves `dosage_text`, `timing`,
    and `intake_interval_days`, and blocks duplicate products in that stack.
- Validation passed:
  - Functions `npx tsc -p tsconfig.json`.
  - Frontend `npm run lint --if-present`.
  - Frontend `npm run build`.
  - Frontend `npm test -- --run` with no test files.
  - `git diff --check` with CRLF warnings only.
- Smoke checks passed:
  - Preview and live root returned 200 with asset `assets/index-BZB9HYiO.js`.
  - Preview and live unauthenticated `POST /api/stacks/test/email` returned
    401.
  - Remote pragma confirmed `intake_interval_days` exists (`has_col=1`).
  - Live temporary API smoke created stack id 21 with interval 2 and one
    ingredient row, then deleted the temporary account.

## Product Ingredient Publishing Model

### 2026-05-05 - Cloudflare Pages: stack email format and daily-dose costs

- Commit: `9babeae` - Fix: Calculate stack email costs from daily dose.
- Scope:
  - Stack emails now show product image, product/brand, active ingredient daily
    amounts, daily intake amount, timing, interaction notes, package price,
    monthly cost based on daily dose, and buy buttons.
  - Email package price and `GET /api/stacks/:id` total no longer multiply by
    `stack_items.quantity`.
  - Existing bad stack rows where `quantity` contains a product ingredient
    amount, e.g. D3 `quantity=2000`, are handled by parsing `dosage_text` and
    product ingredient quantity to compute servings/day.
  - Frontend stack persistence now stores servings/day instead of flat product
    ingredient quantity for newly saved stack items.
- Local validation:
  - `npx tsc -p tsconfig.json` in `functions/` passed.
  - `npm run build`, `npm run lint`, and `npm test -- --run` in `frontend/`
    passed; Vitest has no test files.
  - `git diff --check` passed with CRLF warnings only.
- Build assets: JS `assets/index-DFKRmH2i.js`, CSS
  `assets/index-CtyPP7gA.css`.
- Deploy command:
  - `. .\scripts\use-supplementstack-cloudflare.local.ps1`
  - `npx wrangler pages deploy frontend/dist --project-name supplementstack`
- Preview URL: `https://c673fd9a.supplementstack.pages.dev`.
- Live smoke:
  - Temporary user on `noreply@supplementstack.de`, stack product 23
    `Vitamin D3 2000 IU Tropfen`, `dosage_text='10000 IE tÃƒÂ¤glich'`, and
    old-style `quantity=2000`.
  - `GET /api/stacks/:id` returned total `12.5`.
  - `POST /api/stacks/:id/email` returned ok.
  - Temporary stack/account were deleted afterward.

### 2026-05-05 - Cloudflare Pages: All-Inkl SMTP stack email sending

- Commit: `eff1c6a` - Feature: Send stack emails via SMTP.
- Scope:
  - Added `functions/api/lib/mail.ts`, a Worker-compatible SMTP-over-TLS mail
    helper using `cloudflare:sockets`.
  - Added `POST /api/stacks/:id/email` to send a stack summary to the
    authenticated user's own email address.
  - Stack email sends are rate-limited to 5 per hour per authenticated user.
  - Forgot-password mail now uses the SMTP helper instead of the old Resend
    route.
  - `wrangler.toml` stores non-secret All-Inkl SMTP config for
    `noreply@supplementstack.de`.
- Secret status:
  - Cloudflare Pages production secrets include `JWT_SECRET`, `RESEND_API_KEY`,
    and encrypted `SMTP_PASSWORD`.
  - The raw mailbox password was not stored in code, memory, or command
    history.
- DNS status:
  - MX for `supplementstack.de` resolves to `w020a88d.kasserver.com`.
  - SPF TXT includes `spf.kasserver.com`.
  - DMARC remains deferred until pre-launch.
- Local validation:
  - `npx tsc -p tsconfig.json` in `functions/` passed.
  - `npm run build`, `npm run lint`, and `npm test -- --run` in `frontend/`
    passed; Vitest has no test files.
  - `git diff --check` passed with CRLF warnings only.
- Build assets: JS `assets/index-DzSpIHA6.js`, CSS
  `assets/index-CtyPP7gA.css`.
- Deploy prep:
  - Rebuilt `frontend/dist`.
  - Copied `functions/api` to `frontend/dist/functions/api`.
  - Verified `frontend/dist/functions/api/[[path]].ts` exists.
- Deploy command:
  - `. .\scripts\use-supplementstack-cloudflare.local.ps1`
  - `npx wrangler pages deploy frontend/dist --project-name supplementstack`
- Initial preview URL: `https://76fde482.supplementstack.pages.dev`.
- Redeploy after secret set: `https://71204e0a.supplementstack.pages.dev`.
- Smoke checks:
  - Live unauthenticated `POST /api/stacks/test/email` returned HTTP 401,
    confirming the deployed route is present and protected.
  - Live temporary-account stack email smoke created a stack, called
    `POST /api/stacks/:id/email`, received `{ ok: true }`, and deleted the
    temporary stack/account afterward.
  - Live temporary-account forgot-password smoke returned the expected generic
    success response and deleted the temporary account afterward.

### 2026-05-05 - Cloudflare Pages: authenticated app-shell header alignment

- Commit: `ba92cd5` - UX: Align authenticated headers with app shell.
- Scope:
  - `/stacks` now renders inside the normal app `Layout` so it uses the same
    header as the start page, profile, and own-products routes.
  - Demo keeps the standalone demo header.
  - `StackWorkspace` supports a `standaloneHeader` prop and defaults it to
    demo-only.
  - `MyProductsPage` no longer wraps itself in a separate full-screen gradient
    shell.
- Local validation:
  - `npm run build` in `frontend/` passed.
  - `npm run lint` in `frontend/` passed.
  - `npm test -- --run` in `frontend/` passed with no test files.
  - `git diff --check` passed with CRLF warnings only.
- Build assets: JS `assets/index-DdLiBTCO.js`, CSS
  `assets/index-CtyPP7gA.css`.
- Deploy prep:
  - Copied `functions/api` to `frontend/dist/functions/api`.
  - Verified `frontend/dist/functions/api/[[path]].ts` exists.
- Deploy command:
  - `. .\scripts\use-supplementstack-cloudflare.local.ps1; npx wrangler pages deploy frontend/dist --project-name supplementstack`
- Preview URL: `https://3c09e165.supplementstack.pages.dev`.
- Smoke checks:
  - Preview/live root returned HTTP 200 with asset `index-DdLiBTCO.js`.
  - Browser-harness confirmed `/stacks`, `/my-products`, and `/profile` render
    the normal nav, exactly one `/logo.png`, and no standalone `.site-header`.

### 2026-05-05 - Cloudflare Pages: logo/header branding

- Commit: `03ae0f9` - Brand: Use uploaded logo in headers.
- Scope:
  - Cleaned user-provided root `logo.png` into
    `frontend/public/logo.png` by removing the baked checkerboard background
    and cropping transparent padding.
  - Added shared `frontend/src/components/AppLogo.tsx`.
  - Replaced the normal app header logo, Stacks/Demo standalone header logo,
    and Admin sidebar logo with the shared deployed asset.
- Local validation:
  - `npm run build` in `frontend/` passed.
  - `npm run lint` in `frontend/` passed.
  - `npm test -- --run` in `frontend/` passed with no test files.
  - `git diff --check` passed with CRLF warnings only.
- Build assets: JS `assets/index-DtO4pi6t.js`, CSS
  `assets/index-DwT9aRyA.css`.
- Deploy prep:
  - Copied `functions/api` to `frontend/dist/functions/api`.
  - Verified `frontend/dist/functions/api/[[path]].ts` exists.
- Deploy command:
  - `. .\scripts\use-supplementstack-cloudflare.local.ps1; npx wrangler pages deploy frontend/dist --project-name supplementstack`
- Preview URL: `https://47c4db46.supplementstack.pages.dev`.
- Smoke checks:
  - Preview/live `/` returned HTTP 200.
  - Preview/live `/logo.png` returned HTTP 200 with `image/png`.
  - Browser-harness confirmed `/logo.png` rendering in root, `/demo`, and
    `/forgot-password` headers on the live domain.
- Workspace note:
  - Root `logo.png` remains untracked and intentionally untouched as the
    user-supplied source asset.

### 2026-05-05 - D1 + Cloudflare Pages: launch QA stack/profile bundle

- Commits:
  - `0b29fe0` - launch QA stack/profile flows.
  - `baa91a5` - live profile + stack warning smokes.
  - `1a3b8e6` - profile response path.
  - `cb76cf3` - D1 run handling.
  - `24b10b5` - guideline normalization.
- Remote D1 migration:
  - Applied `d1-migrations/0041_stack_item_product_sources.sql` to
    `supplementstack-production`.
  - Migration rebuilds `stack_items` with explicit `catalog_product_id` and
    `user_product_id` columns plus a CHECK requiring exactly one reference.
    Existing legacy `product_id` values are backfilled to
    `catalog_product_id`.
- Scope:
  - `PUT /api/me` uses validated existing-profile load, final target value
    computation, plain D1 `UPDATE`, and response construction from target
    values.
  - Register and `PUT /api/me` normalize guideline source input to the live
    DB CHECK values: `DGE`, `studien`, `influencer`.
  - `PUT /api/me` validates `gender` and `diet` before DB update.
  - Stack API accepts legacy `{ id }` catalog payloads and new
    `{ id, product_type: 'catalog' | 'user_product' }` payloads, stores them
    through explicit reference columns, validates all items before replace, and
    uses `stack.user_id` for user-product ownership.
  - `GET /api/stacks/:id` returns `product_type`; stack warnings evaluate both
    catalog `product_ingredients` and stack-owner-constrained
    `user_product_ingredients`.
  - `StackWorkspace` keeps string keys `catalog:id` and `user_product:id`,
    loads own pending/approved user products, and hides user products whose
    `published_product_id` already exists in the loaded catalog list.
  - Demo D3/K2 product seed/backfill uses 2,000 IU D3 instead of 10,000 IU.
  - Search/Wishlist remain intentionally outside App/Layout routes and nav;
    raw paths are SPA fallback only.
- Validation:
  - Functions `npx tsc -p tsconfig.json` passed.
  - Frontend `npm run lint --if-present` passed.
  - Frontend `npm run build` passed.
  - Frontend tests with no files passed earlier.
  - `git diff --check` passed.
  - Local Wrangler migration apply remains blocked before 0041 by old local
    state migration 0009 on missing `google_id`; remote migration 0041 is
    applied successfully.
- Preview URL: `https://5fb3de86.supplementstack.pages.dev`.
- Live URL: `https://supplementstack.de`; live root uses asset
  `index-BfFUmB15.js`.
- Final live smokes:
  - Profile `PUT /api/me` returned HTTP 200 with age 34, weight 82, gender
    `divers`, `guideline_source=studien`, and `is_smoker=0`.
  - Invalid gender `PUT /api/me` returned HTTP 400.
  - Own pending user product `QA L-Carnitin Triple Komplex` was added to a
    temporary stack; `GET /api/stacks/:id` returned
    `product_type=user_product`; `GET /api/stack-warnings/:id` returned HTTP
    200 with 0 warnings; the temporary stack was deleted.
  - `/api/demo/products` returned 7 products and the D3 product quantity is
    2,000 IU.
  - Preview root and live root returned HTTP 200 with asset
    `index-BfFUmB15.js`.
  - `/forgot-password` returned HTTP 200.
  - `/search` and `/wishlist` have no explicit App/Layout routes or nav links.
- Workspace note:
  - `.claude/SESSION.md` and `.claude/settings.json` remain dirty and were
    intentionally untouched.

### 2026-05-05 - D1 + Cloudflare Pages: sub-ingredient product workflow

- Commit: `29dcde5` - Feature: Add sub-ingredient product workflow.
- Remote D1 migration:
  - Applied `d1-migrations/0040_seed_ingredient_sub_ingredients.sql` to
    `supplementstack-production`.
  - Control query confirmed `ingredient_sub_ingredients` count = 6.
  - Control query confirmed mappings:
    `L-Carnitin` -> `Acetyl-L-Carnitin`, `L-Carnitin Tartrat`,
    `L-Carnitin Fumarat`; `Omega-3` -> `EPA`, `DHA`, `DPA`.
  - Control query confirmed `products.source_user_product_id` exists
    (`source_col=1`).
- Scope:
  - Seeded launch mappings for L-Carnitin and Omega-3 sub-ingredients.
  - Public sub-ingredient prompt endpoint is live.
  - Admin sub-ingredient mapping API is live with validation and audit logging.
  - Product and user-product saves validate parent/sub relations before storage
    and cap ingredient arrays at 50 rows.
  - Ingredient product lookup and recommendations are parent/child-aware.
  - Stack warnings dedupe parent/child rows per product.
  - Admin publish uses `products.source_user_product_id` as a unique source
    guard for idempotent publish races.
- Local validation:
  - `npx tsc -p tsconfig.json` in `functions/` passed.
  - `npm run lint --if-present` in `frontend/` passed.
  - `npm run test --if-present -- --run` in `frontend/` passed with no test
    files via passWithNoTests.
  - `npm run build` in `frontend/` passed.
  - `git diff --check` passed.
  - Mojibake scan for touched frontend/backend files passed.
- Preview URL: `https://421f79ea.supplementstack.pages.dev`.
- Live URL: `https://supplementstack.de`.
- Smoke checks on live and preview:
  - `/api/ingredients/10/sub-ingredients` returned HTTP 200 with count 3:
    EPA/DHA/DPA.
  - `/api/ingredients/13/sub-ingredients` returned HTTP 200 with count 3:
    ALCAR/Tartrat/Fumarat.
  - `/api/ingredients/10/products` returned HTTP 200 with count 1 on live.
  - `/api/demo/products` returned HTTP 200 with count 7.
  - `/api/admin/user-products` unauthenticated returned HTTP 401.
- Demo mode note:
  - Current `StackWorkspace` demo flow creates fresh client-side demo state on
    load and does not persist stack edits via `/api/stacks`; demo products come
    from `/api/demo/products`.
- Remaining launch follow-up:
  - Dedicated admin UI for managing sub-ingredient mappings.
  - Legal/compliance wording review before Go-Live.
  - Manual browser QA of product submission flow on desktop/mobile.
  - Affiliate/domain final policy review.

### 2026-05-04 - D1 + Cloudflare Pages: product ingredient publishing model

- Commit: `1272e11` - Feature: Add product ingredient publishing model.
- Remote D1 migration:
  - Applied `d1-migrations/0039_product_ingredient_model.sql` to
    `supplementstack-production`.
  - Control query confirmed `product_ingredients.search_relevant` column = 1,
    `user_product_ingredients` table = 1,
    `ingredient_sub_ingredients` table = 1, and
    `user_products.published_product_id` column = 1.
- Scope:
  - Catalog `product_ingredients` now has search-relevant and basis metadata
    for ingredient-specific public product filtering.
  - `user_product_ingredients` stores durable ingredient rows for user
    products.
  - `ingredient_sub_ingredients` is schema-ready for later prompted
    sub-ingredient entry.
  - `user_products.published_product_id` links approved/private user products
    to published catalog products after admin publish.
  - Admin publish copies checked user products into public approved
    `products` and `product_ingredients`.
  - Trusted submitters create `user_products` as approved/private moderation
    state but are not auto-published into the catalog.
- Local validation before commit/deploy:
  - `npx tsc -p tsconfig.json` in `functions/` passed.
  - `npm run lint --if-present` in `frontend/` passed.
  - Frontend Vitest passed with no test files.
  - `npm run build` in `frontend/` passed.
  - `git diff --check` passed with CRLF warnings only.
  - Mojibake `rg` check passed.
- Frontend build assets: JS `index-BvEYaSZm.js`, CSS `index-BxLAbVeG.css`.
- Deploy command:
  - `wrangler pages deploy frontend/dist --project-name supplementstack`
- Preview URL: `https://0ed675d5.supplementstack.pages.dev`.
- Smoke checks:
  - Preview root returned HTTP 200 and had the new JS asset.
  - Live root returned HTTP 200 and had the new JS asset.
  - Preview `/api/demo/products` returned HTTP 200 with count 7.
  - Live `/api/demo/products` returned HTTP 200 with count 7.
  - Preview `/api/ingredients/1/products` returned HTTP 200 with count 3.
  - Live `/api/ingredients/1/products` returned HTTP 200 with count 3.
  - Preview `/api/admin/user-products` unauthenticated returned HTTP 401.
  - Preview `/api/user-products` unauthenticated returned HTTP 401.
  - Live `/api/admin/user-products` unauthenticated returned HTTP 401.
  - Preview/live `/api/ingredients/1/recommendations` returned HTTP 200 with
    count 4.
- Remaining follow-up:
  - Dedicated admin UI for sub-ingredient mapping management.
  - Final legal/compliance review, authenticated browser/mobile QA, and
    affiliate/domain policy review remain open.
- Workspace note:
  - `.claude/SESSION.md` and `.claude/settings.json` remain dirty and were
    intentionally untouched.

## Demo And User Product Hardening

### 2026-05-04 - D1 + Cloudflare Pages: demo/session abuse and product moderation hardening

- Commit: `18a4141` - Security: Harden demo and user product moderation.
- Remote D1 migration:
  - Applied `d1-migrations/0038_trusted_product_submitters.sql` to
    `supplementstack-production`.
  - Control query confirmed `users.is_trusted_product_submitter` exists.
- Scope:
  - `/api/demo/products` now returns up to 7 starter products.
  - `POST /api/demo/sessions` is KV rate-limited per client IP and no longer
    persists submitted `stack_json` into D1.
  - Legacy `GET /api/demo/sessions/:key` no longer returns stored user stack
    changes.
  - Demo stack descriptions are page-local in React state, not localStorage.
  - `POST /api/user-products` is KV rate-limited per authenticated user.
  - `POST /api/products` is KV rate-limited per authenticated user.
  - New trusted submitter flag:
    `users.is_trusted_product_submitter`.
  - Normal user products remain `pending`; trusted submitters auto-create
    `approved` user products.
  - User-owned `approved` user products are locked against user edit/delete.
  - Admin user-product tab can toggle trusted submitter status.
  - Shop-domain matching now parses hostnames and allows only exact domain or
    subdomain matches, preventing `amazon.de.evil.com` style spoofing.
- Product-model caveat:
  - Superseded by `1272e11`. `user_products.status = 'approved'` remains the
    private moderation/lock state, but durable ingredient mapping and admin
    catalog conversion are now deployed.
- Local validation:
  - `npx tsc -p tsconfig.json` in `functions/` passed.
  - `npm run lint --if-present` in `frontend/` passed.
  - `npm run test --if-present -- --run` in `frontend/` passed with no test
    files via `--passWithNoTests`.
  - `npm run build` in `frontend/` passed.
  - `git diff --check` passed with only LF/CRLF warnings.
- Build assets: JS `assets/index-BMGjisnj.js`, CSS
  `assets/index-BBkQf4zK.css`.
- Deploy prep:
  - Rebuilt `frontend/dist`.
  - Copied `functions/api` to `frontend/dist/functions/api`.
  - Verified `frontend/dist/functions/api/[[path]].ts` exists.
- Deploy command:
  - `. .\scripts\use-supplementstack-cloudflare.local.ps1; npx wrangler pages deploy frontend/dist --project-name supplementstack`
- Preview URL: `https://5b9c9907.supplementstack.pages.dev`.
- Smoke checks:
  - Preview root returned HTTP 200.
  - Live root returned HTTP 200.
  - Preview/live `/api/demo/products` returned HTTP 200 with 7 starter
    products.
  - Preview `POST /api/demo/sessions` returned HTTP 200 with a compatibility
    key, `expiresAt`, and `stack: []`.
  - Preview/live spoof resolve for `https://amazon.de.evil.com/item` returned
    `shop_name: null`.
  - Preview/live real resolve for `https://www.amazon.de/dp/test` returned
    `shop_name: "Amazon"`.
  - Preview/live unauthenticated `/api/admin/user-products` returned HTTP 401.
- Wrangler warning:
  - Dirty worktree warning was expected because `.claude/SESSION.md` and
    `.claude/settings.json` remain dirty and were not part of the commit/deploy.

## Legal Pages

### 2026-05-04 - Cloudflare Pages: imprint, privacy, terms

- Commit: `9c2c627` - Legal: Add imprint privacy and terms pages.
- Scope:
  - Added `/impressum`, `/datenschutz`, `/nutzungsbedingungen`, and `/agb`
    alias.
  - Footer links `Impressum`, `Datenschutz`, `Nutzungsbedingungen`, and
    `Cookie-Einstellungen`.
  - Removed external Google Fonts import; app now uses system fonts.
  - Expanded privacy text for GA4 consent, Cloudflare/GitHub/GitHub Actions,
    Google Analytics, and third-country processing.
  - No Apple/OAuth/Social-Login active-processing wording.
- Research bases: Ã‚Â§5 DDG, Ã‚Â§25 TDDDG, Art. 13/6 DSGVO, Ã‚Â§36 VSBG, Ã‚Â§18 MStV,
  EU ODR shutdown on 2025-07-20, and Google GA4 EU privacy/IP notes.
- Local validation:
  - `npm run build` in `frontend/` passed.
  - `git diff --check` passed with only LF/CRLF warnings.
- Build assets: `/assets/index-DtdVqjYU.js` and
  `/assets/index-CieqqPmY.css`.
- Deploy prep: copied `functions/api` to `frontend/dist/functions/api`;
  `frontend/dist/functions/api/[[path]].ts` existed before deploy.
- Preview URL: `https://d6e92688.supplementstack.pages.dev`.
- Smoke checks:
  - Preview `/impressum`, `/datenschutz`, and `/nutzungsbedingungen` returned
    HTTP 200.
  - Live `https://supplementstack.de/impressum`, `/datenschutz`,
    `/nutzungsbedingungen`, and `/agb` returned HTTP 200 and used
    `index-DtdVqjYU.js`.
- Open: final legal review remains recommended/required before SEO indexing;
  DSB/AVV/Cloudflare/GitHub/Google settings should be formally checked.

## Consent-Based GA4 Analytics

### 2026-05-04 - Cloudflare Pages: GA4 analytics with explicit consent

- Commit: `a18136d` - Feature: Add consent-based GA4 analytics.
- Measurement ID: `G-QVHTTK2CNP`.
- Scope: frontend-only GA4 consent banner, `localStorage` accepted/declined
  persistence, lazy `gtag.js` injection after Zustimmung, SPA `page_view`
  tracking only after consent, footer `Datenschutz` and
  `Cookie-Einstellungen`, plus minimal `/datenschutz` page.
- Privacy behavior: GA4 is not statically inserted in `index.html`; Ablehnung
  loads no GA script and sends no GA events. If consent is reset after GA was
  loaded, analytics storage is denied and future pageviews stop until renewed
  consent.
- Local validation:
  - `npm run build` in `frontend/` passed.
  - `git diff --check` passed with only LF/CRLF warnings.
- Deploy prep: copied `functions/api` to `frontend/dist/functions/api`;
  `frontend/dist/functions/api/[[path]].ts` existed before deploy.
- Preview URL: `https://f876ad10.supplementstack.pages.dev`.
- Smoke checks:
  - Preview `/` returned HTTP 200.
  - Preview `/datenschutz` returned HTTP 200.
  - Live `https://supplementstack.de/datenschutz` returned HTTP 200 and used
    `/assets/index-B7aLcsIq.js`.
- Open: Impressum/AGB are still missing; Datenschutzerklaerung is a working
  draft and needs legal review.

## Stack Warnings Performance

### 2026-05-04 - Cloudflare Pages: batched stack warning interaction lookup

- Commit: `5905a20` - Fix: Batch stack warning interaction lookup.
- Scope: `GET /api/stack-warnings/:id` in `functions/api/modules/stacks.ts`
  no longer loads interactions with an O(n^2) pair loop. Stacks with 0 or 1
  ingredient id return `{ warnings: [] }` immediately; otherwise one SQL query
  uses dynamic `IN (...)` placeholders for both ingredient columns.
- Semantics: auth, ownership, 404, and 403 behaviour unchanged.
- Local validation:
  - `npx tsc -p tsconfig.json` in `functions/` passed.
  - `git diff --check` passed with only CRLF warnings.
  - `npm run build` in `frontend/` passed.
- Deploy command: `. .\scripts\use-supplementstack-cloudflare.local.ps1; npx wrangler pages deploy frontend/dist --project-name supplementstack`
- Preview URL: `https://1c23aea8.supplementstack.pages.dev`
- Build assets: JS `index-Dkeio0yL.js`, CSS `index-RAoQ0gyV.css`.
- Smoke checks:
  - Preview root returned HTTP 200 with the expected assets.
  - Preview unauthenticated `/api/stack-warnings/1` returned HTTP 401.
  - Live `https://supplementstack.de/api/stack-warnings/1` returned HTTP 401.
- Wrangler warning: dirty worktree because `.claude/SESSION.md` and
  `.claude/settings.json` were dirty; expected and not part of deploy.

## Profile Self-Service (DSGVO Art. 16 + 17)

### 2026-05-04 - Cloudflare Pages: profile password change + account deletion

- Commit: `78d8925` - Feature: Profile self-service for password change and account deletion.
- Scope:
  - `functions/api/modules/auth.ts`: new `PATCH /api/me/password` and `DELETE /api/me` mounted on the existing `meApp`. Both require `ensureAuth`, re-authenticate via the current password (`verifyPassword`), and are rate-limited (`pwchange:<userId>` 5/15min, `accdel:<userId>` 3/60min).
  - Account deletion runs `c.env.DB.batch([...])` to hard-delete dependent rows in order (`stack_items` via subselect on `stacks`, then `stacks`, `wishlist`, `user_products`, `consent_log`, `users`). Best-effort cleanup loop covers tables from later migrations (`admin_audit_log`, `dose_recommendations`, `share_links`, `blog_posts`, `api_tokens`) Ã¢â‚¬â€ silently skipped if the table doesn't exist in the live DB.
  - `frontend/src/api/auth.ts`: `changePassword`, `deleteAccount`, plus a `preserveTokenOn401` helper. The axios response interceptor in `client.ts:19-21` strips the auth token on any 401; without the helper a wrong-current-password attempt would log the user out.
  - `frontend/src/pages/ProfilePage.tsx`: two new sections. Password-change with current/new/repeat fields and inline success/error messaging. Account-deletion with red warning, confirmation phrase `LÃƒâ€“SCHEN`, password re-entry, disabled red button until both match. On success: `logout()` + `navigate('/', { replace: true })`. No `window.alert`. 44px touch targets.
- Local validation: `npx tsc -p tsconfig.json` (functions/) clean; `npm run build` (frontend/) clean.
- Deploy command: `. .\scripts\use-supplementstack-cloudflare.local.ps1; npx wrangler pages deploy frontend/dist --project-name supplementstack`
- Preview URL: `https://16edb9e2.supplementstack.pages.dev`
- Build assets: JS `index-Dkeio0yL.js`, CSS `index-RAoQ0gyV.css`.
- Smoke checks:
  - Preview root + live `https://supplementstack.de/` returned HTTP 200.
  - Unauthenticated `PATCH /api/me/password` Ã¢â€ â€™ HTTP 401 `{"error":"Unauthorized"}`.
  - Unauthenticated `DELETE /api/me` Ã¢â€ â€™ HTTP 401 `{"error":"Unauthorized"}`.
  - Full end-to-end (login Ã¢â€ â€™ change password Ã¢â€ â€™ delete account) deferred to avoid creating or deleting real users in production D1.
- Note: live DB is at migration 0022; the optional-cleanup loop in `DELETE /api/me` is intentionally tolerant of missing tables, so this deploy works against the current schema and stays correct after future migrations are applied.

## Pre-Launch Indexing Block

### 2026-05-04 - Cloudflare Pages: robots.txt disallowing search crawlers

- Commit: `1d8b288` - Fix: Disallow search crawlers by name in robots.txt (follow-up to `70aa1f9`).
- Scope: created `frontend/public/robots.txt`. Initial version had only `User-agent: *` `Disallow: /`. After deploy, the live domain returned a Cloudflare-managed AI-bot block prepended at the front with `User-agent: *` `Allow: /`. Hardened the file to also list search crawlers by name (Googlebot, Googlebot-Image, Bingbot, DuckDuckBot, YandexBot, Baiduspider, Slurp), each with `Disallow: /`. Spec-wise a name-specific Disallow takes precedence over a wildcard Allow, so this protects against Cloudflare's prepend behaviour.
- Local validation: `npm run build` (frontend/) clean. Vite copies `frontend/public/*` into `frontend/dist/` automatically.
- Deploy commands: two deploys, the second after the hardening edit.
- Preview URLs: `https://7d3e5fb6.supplementstack.pages.dev` then `https://78a83b47.supplementstack.pages.dev`.
- Smoke checks:
  - Preview `/robots.txt` returned HTTP 200 with the file as written.
  - Live `https://supplementstack.de/robots.txt` returned HTTP 200; visible structure confirms Cloudflare's managed AI-bot block precedes our explicit search-crawler Disallows + wildcard Disallow.
- Follow-up: when legal/compliance is cleared and SEO is intentionally enabled, replace the file with an empty/permissive version (or a per-path policy plus `Sitemap:` reference).

## Registration Data Persistence

### 2026-05-03 - Cloudflare Pages: persist age, gender, guideline_source on register

- Commit: `e832263` - Fix: Persist age, gender, guideline_source on register.
- Scope: `RegisterPage.tsx` collected `age`/`gender`/`guidelineSource` but only `health_consent` was forwarded; values are now passed through `AuthContext.register()` and the `/api/auth/register` endpoint and persisted on the `users` row. Backend validates `age` (integer 1-120), `gender` (`mÃƒÂ¤nnlich`/`weiblich`/`divers`), `guideline_source` (`DGE`/`Studien`/`Influencer`); empty strings normalize to `NULL`.
- DB schema: columns `users.age`, `users.gender`, `users.guideline_source` already exist (`d1-migrations/0001_initial.sql`); no migration needed.
- Local validation: `npx tsc -p tsconfig.json` (functions/) clean; `npm run build` (frontend/) clean. 3 pre-existing TS errors in `frontend/src/api/admin.ts` and `src/api/base.ts` are unrelated to this change.
- Deploy command: `. .\scripts\use-supplementstack-cloudflare.local.ps1; npx wrangler pages deploy frontend/dist --project-name supplementstack`
- Preview URL: `https://0718b546.supplementstack.pages.dev`
- Build assets: JS `index-zWVCB7vc.js`, CSS `index-Cf3yP80d.css`.
- Smoke checks:
  - Preview root and live `https://supplementstack.de/` returned HTTP 200.
  - `POST /api/auth/register` with `age: 999` returned HTTP 400 with `{"error":"Alter muss eine ganze Zahl zwischen 1 und 120 sein."}` Ã¢â‚¬â€ backend validation confirmed.
  - Full register-flow smoke deferred (would create a real user in production D1; rate-limit window also still relevant).

## Live Domain Hardening

### 2026-05-03 - Cloudflare Pages: FRONTEND_URL + CORS allowlist for live domain

- Commit: `283cbc8` - Fix: Switch FRONTEND_URL and CORS allowlist to live domain.
- Scope:
  - `wrangler.toml`: `FRONTEND_URL` switched from `https://supplementstack.pages.dev` to `https://supplementstack.de` so password-reset mail links land on the live domain.
  - `functions/api/[[path]].ts`: CORS allowlist switched from static array to function-origin. Now allows live domain (`supplementstack.de` + `www.supplementstack.de`), Pages main preview, all Pages preview hash subdomains via regex `/^https:\/\/[a-z0-9-]+\.supplementstack\.pages\.dev$/`, and `localhost:5173`.
- Local validation:
  - `npx tsc -p tsconfig.json` in `functions/` passed.
  - `npm run build` in `frontend/` passed (1444 modules, 1.46s).
- Deploy command: `. .\scripts\use-supplementstack-cloudflare.local.ps1; npx wrangler pages deploy frontend/dist --project-name supplementstack`
- Preview URL: `https://9c8dfe74.supplementstack.pages.dev`
- Build assets: JS `index-Bl-g6o41.js`, CSS `index-Cf3yP80d.css`.
- Smoke checks:
  - Preview root returned HTTP 200.
  - Live `https://supplementstack.de/` returned HTTP 200.
  - Live `/api/ingredients` returned HTTP 200.
  - CORS preflight `OPTIONS /api/auth/forgot-password`:
    - Origin `https://supplementstack.de` Ã¢â€ â€™ `Access-Control-Allow-Origin: https://supplementstack.de` (echoed) Ã¢Å“â€œ
    - Origin `https://9c8dfe74.supplementstack.pages.dev` Ã¢â€ â€™ echoed back Ã¢Å“â€œ
    - Origin `https://evil.example.com` Ã¢â€ â€™ no `Access-Control-Allow-Origin` header (browser would block) Ã¢Å“â€œ

## UX Usability Polish

### 2026-05-03 - Cloudflare Pages: launch QA flow blockers

- Commit: `fcb1a6b` - Fix: Close launch QA flow blockers.
- Scope: wishlist shop-domain response shape, stale frontend API helpers,
  ingredient product visibility/moderation filtering, product-recommendation
  duplicate prevention, stack-warning authorization, and user-product
  validation.
- Local validation:
  - `npm run lint --if-present` in `frontend/` passed.
  - `npm run test --if-present -- --run` in `frontend/` passed with no test
    files via `--passWithNoTests`.
  - `npm run build` in `frontend/` passed.
  - `npx tsc -p tsconfig.json` in `functions/` passed.
  - `git diff --check` had no whitespace errors, only CRLF warnings.
- Deploy command: `. .\scripts\use-supplementstack-cloudflare.local.ps1; npx wrangler pages deploy frontend/dist --project-name supplementstack`
- Preview URL: `https://ae0fa762.supplementstack.pages.dev`
- Build assets: JS `index-Hw7gzAwb.js`, CSS `index-DWw_l_3p.css`.
- Wrangler warning: uncommitted changes existed at deploy time. Expected:
  memory files and `.claude/SESSION.md` were dirty while code commit
  `fcb1a6b` was committed.
- Smoke checks on preview/live:
  - Root returned HTTP 200.
  - D3 search returned HTTP 200.
  - `/api/ingredients/1/products` returned HTTP 200 with approved/public D3
    products.
  - `/api/ingredients/1/recommendations` returned HTTP 200 with 4 dose
    recommendations.
  - `/api/shop-domains` returned HTTP 200 with `{ shops }`.
  - `/api/demo/products` returned HTTP 200.
  - Unauthenticated `/api/stack-warnings/1` returned HTTP 401.
  - Unauthenticated `/api/admin/translations/ingredients` returned HTTP 401.
  - Unauthenticated `/api/user-products` returned HTTP 401.
- Registration note: registration was tested successfully before rate limiting
  kicked in, but final fresh registration smoke after deploy was not completed
  because `/auth/register` returned 429 after repeated QA attempts.
- Follow-up: once the rate-limit window clears, run one fresh browser/API
  registration smoke, then logged-in browser QA for stack, wishlist, own
  products, and admin flows.

### 2026-05-02 - Cloudflare Pages: stack and admin usability flows

- Commit: `8fb5431` - UX: Improve stack and admin usability flows.
- Scope: User/Demo/Search/Stack UX fixes plus Admin UX fixes.
- Local validation:
  - `npm run lint --if-present` in `frontend/` passed.
  - `npm run test --if-present -- --run` in `frontend/` passed with no tests
    via `--passWithNoTests`.
  - `npm run build` in `frontend/` passed.
  - `npx tsc -p tsconfig.json` in `functions/` passed.
  - `git diff --check` had no whitespace errors, only CRLF warnings.
- Deploy prep: `npm run build` in `frontend/`; copied `functions` to
  `frontend/dist/functions`; verified
  `frontend/dist/functions/api/[[path]].ts` with `Test-Path -LiteralPath`.
- Deploy command: `. .\scripts\use-supplementstack-cloudflare.local.ps1; npx wrangler pages deploy frontend/dist --project-name supplementstack`
- Preview URL: `https://2b00223a.supplementstack.pages.dev`
- Wrangler warning: uncommitted changes existed at deploy time. Expected:
  memory files and `.claude/SESSION.md` were dirty while code commit `8fb5431`
  was committed.
- Smoke checks on preview:
  - `/` returned HTTP 200 with JS asset `index-D8jGeaah.js`, CSS asset
    `index-DWw_l_3p.css`, and `x-robots-tag: noindex`.
  - `/api/ingredients/search?q=d3` returned HTTP 200 and contained Vitamin D3.
  - `/api/admin/translations/ingredients` returned HTTP 401, not 404.
  - `/api/ingredients/1/recommendations` returned HTTP 200 with 4 rows.
- Smoke checks on live custom domain:
  - `https://supplementstack.de/` returned HTTP 200 with the same JS/CSS asset
    names as preview.
  - `https://supplementstack.de/api/ingredients/search?q=d3` returned HTTP 200.
  - `https://supplementstack.de/api/admin/translations/ingredients` returned
    HTTP 401, not 404.

### 2026-05-02 13:28:28 - Cloudflare Pages: add-product search focus

- Commit: `078fc31` - UX: Auto-focus search field in 'Produkt hinzufuegen'
  modal (Demo + Stack-Workspace).
- Scope: `frontend/src/components/SearchBar.tsx`,
  `frontend/src/components/StackWorkspace.tsx`.
- Status from `.claude/SESSION.md`: deployed successfully.
- Preview URL: not recorded in `.claude/SESSION.md`; do not invent one.

### 2026-05-02 13:22:20 - Cloudflare Pages: user product name focus

- Commit: `e8f2bbc` - UX: Auto-focus name field when opening 'Produkt
  hinzufuegen' modal.
- Scope: `frontend/src/components/modals/UserProductForm.tsx`.
- Status from `.claude/SESSION.md`: deployed successfully.
- Preview URL: not recorded in `.claude/SESSION.md`; do not invent one.

## Phase D Product Recommendations And Translations

### 2026-05-02 - Cloudflare Pages: admin translations expansion

- Commit: `49ed83e` - Feature: Expand admin translation management.
- Scope: admin translation management now covers Ingredients, Dose
  Recommendations, Verified Profiles, and Blog Posts.
- No D1 migration was needed.
- Local validation from handoff: `npm run lint --if-present`,
  `npm run test --if-present -- --run`, and `npm run build` passed in
  `frontend/`; `npx tsc -p tsconfig.json` passed in `functions/`.
- Deploy prep: `npm run build` in `frontend/`; copied `functions` to
  `frontend/dist/functions`; verified
  `frontend/dist/functions/api/[[path]].ts` exists.
- Deploy command: `. .\scripts\use-supplementstack-cloudflare.local.ps1; npx wrangler pages deploy frontend/dist --project-name supplementstack`
- Preview URL: `https://14cf1dba.supplementstack.pages.dev`
- Smoke checks on preview:
  - `/` returned HTTP 200.
  - `/api/admin/translations/ingredients` returned HTTP 401 Unauthorized,
    confirming the route exists and is auth-protected.
  - `/api/admin/translations/dose-recommendations` returned HTTP 401
    Unauthorized, confirming the route exists and is auth-protected.
  - `/api/admin/translations/verified-profiles` returned HTTP 401
    Unauthorized, confirming the route exists and is auth-protected.
  - `/api/admin/translations/blog-posts` returned HTTP 401 Unauthorized,
    confirming the route exists and is auth-protected.
  - `/api/ingredients/search?q=d3` returned HTTP 200.

### 2026-05-02 - D1 + Cloudflare Pages: Phase D rollout

- Commit: `862ed57` - Feature: Phase D product recommendations and translations.
- Scope: product recommendation table rename, temporary compatibility
  `recommendations` view/triggers, admin ingredient translations MVP, refreshed
  Cloudflare-line docs/CI, npm lockfiles, and generic local setup scripts.
- Local validation: `npm run lint --if-present`, `npm run test --if-present -- --run`, and `npm run build` passed in `frontend/`; `npx tsc -p tsconfig.json` passed in `functions/`.
- Initial command: `. .\scripts\use-supplementstack-cloudflare.local.ps1; npx wrangler d1 migrations apply supplementstack-production --remote`
- Initial migration result: failed before 0036 because remote schema already had Phase B/C objects but `d1_migrations` ended at 0025; migration 0026 tried to seed existing `populations.slug` rows and hit a UNIQUE constraint.
- Journal repair: verified Phase B/C objects were present remotely, then inserted `d1_migrations` rows for already-live migrations 0026-0035.
- Migration result: reran Wrangler migration apply; `0036_rename_recommendations_to_product_recommendations.sql` applied successfully.
- Remote schema verification: no pending migrations; `product_recommendations` is a table, `recommendations` is a view, `recommendations_insert` and `recommendations_delete` triggers exist, and both recommendation-link counts are 0.
- Deploy prep: `npm run build` in `frontend/`; copied `functions` to `frontend/dist/functions`; verified `frontend/dist/functions/api/[[path]].ts` exists.
- Deploy command: `. .\scripts\use-supplementstack-cloudflare.local.ps1; npx wrangler pages deploy frontend/dist --project-name supplementstack`
- Preview URL: `https://66a9ee27.supplementstack.pages.dev`
- Smoke checks on preview:
  - `/` returned HTTP 200.
  - `/api/recommendations?ingredient_id=1` returned HTTP 200 with empty `recommendations`.
  - `/api/ingredients/1/recommendations` returned HTTP 200 with 4 dose recommendations.
  - `/api/ingredients/search?q=d3` returned HTTP 200 with Vitamin D3.
  - `/api/products/1` returned HTTP 200.
  - `/api/admin/translations/ingredients` returned HTTP 401 Unauthorized, confirming the route exists and is auth-protected.

## Affiliate Disclosure Cleanup

### 2026-05-01 - Cloudflare Pages: affiliate disclosure moved to footer

- Commit: `965d4e4` - Fix: Move affiliate disclosure to footer.
- Scope: `frontend/src/components/ProductCard.tsx`, `frontend/src/components/LegalDisclaimer.tsx`.
- Build: `npm run build` from `frontend/` passed.
- Deploy prep: `frontend/dist/functions/api/[[path]].ts` verified present before deploy.
- Command: `. .\scripts\use-supplementstack-cloudflare.local.ps1; npx wrangler pages deploy frontend/dist --project-name supplementstack`
- Preview URL: `https://b4e4ea90.supplementstack.pages.dev`
- Smoke checks: preview root returned HTTP 200; preview JS `/assets/index-DgGBIJBD.js` returned HTTP 200.
- Bundle check: downloaded preview JS and verified the old ProductCard Affiliate badge class was absent. Remaining `Affiliate` strings are expected in footer/legal copy, landing copy, and admin/user-edit surfaces.

## Preview Search API-Base Fix

### 2026-05-01 - Cloudflare Pages: same-origin API in deployed frontend

- Commit: `b5dba6e` - Fix: Use same-origin API in deployed frontend.
- Scope: `frontend/src/api/base.ts`, `frontend/src/api/client.ts`, `frontend/src/components/SearchBar.tsx`, `frontend/src/components/StackWorkspace.tsx`.
- Build: `npm run build` from `frontend/` passed; `npx tsc -p tsconfig.json` from `functions/` passed.
- Deploy prep: `frontend/dist/functions/api/[[path]].ts` verified present before deploy.
- Command: `. .\scripts\use-supplementstack-cloudflare.local.ps1; npx wrangler pages deploy frontend/dist --project-name supplementstack`
- Preview URL: `https://8582e2f6.supplementstack.pages.dev`
- Smoke checks: preview root returned HTTP 200; `GET /api/ingredients/search?q=d3` returned HTTP 200 and contained Vitamin D3.
- Bundle check: downloaded `/assets/index-BXEivzLW.js` from the preview and verified it does not contain `supplementstack.pages.dev/api`.

## Demo Product Loading Fix

### 2026-04-30 - Cloudflare Pages: demo product loading

- Commit: `2f4248b` - Fix: Restore demo product loading.
- Scope: `functions/api/modules/demo.ts`, `frontend/src/components/SearchBar.tsx`, `frontend/src/pages/SearchPage.tsx`.
- Build: `npx tsc -p tsconfig.json` from `functions/` passed; `npm run build` from `frontend/` passed.
- Deploy prep: `frontend/dist/functions/api/[[path]].ts` verified present before deploy.
- Command: `. .\scripts\use-supplementstack-cloudflare.local.ps1; npx wrangler pages deploy frontend/dist --project-name supplementstack`
- Preview URL: `https://aa546170.supplementstack.pages.dev`
- Smoke checks: preview root returned `HTTP/1.1 200 OK`; `GET /api/demo/products` returned `HTTP/1.1 200 OK` with 18 products.
- Open risk: no browser/manual demo UI QA was run in this session.

## Modal Data Loading Fix

### 2026-04-30 - Cloudflare Pages: D3 recommendations / product modal loading

- Commit: `9107e2e` - Fix: Stabilize dosage and product modal data loading.
- Scope: `Modal1Ingredient.tsx`, `Modal2Products.tsx`, `frontend/src/types/local.ts`, `functions/api/modules/ingredients.ts`.
- Build: `npx tsc -p tsconfig.json` from `functions/` passed; `npm run build` from `frontend/` passed.
- Deploy prep: `frontend/dist/functions/api/[[path]].ts` verified present before deploy.
- Command: `. .\scripts\use-supplementstack-cloudflare.local.ps1; npx wrangler pages deploy frontend/dist --project-name supplementstack`
- Preview URL: `https://bc37a09d.supplementstack.pages.dev`
- HTTP status check on preview URL: `HTTP/1.1 200 OK`.
- Open risk: no browser/manual modal QA was run in this session.

## Phase C Ã¢â‚¬â€ Tech-Debt Cleanup

### 2026-04-30 - Cloudflare Pages: Tech-Debt-Cleanup nach Phase C

- Commit: `b866c3d` - Refactor + Ops: Tech-Debt-Cleanup nach Phase C.
- Items: normalizeComparableUnit removed (replaced by normalizeUnit from lib/units.ts); IngredientRow extended with upper_limit/upper_limit_unit/preferred_unit; pages_build_output_dir added to wrangler.toml; next-steps.md reorganized.
- Build: `npx tsc -p tsconfig.json` from `functions/` passed (no errors); `npm run build` from `frontend/` passed (1.45s, 0 errors).
- Command: `npx wrangler pages deploy frontend/dist --project-name supplementstack` (with CF env vars loaded).
- Preview URL: `https://c0f45f5b.supplementstack.pages.dev`
- pages_build_output_dir warning: no "config ignored" warning appeared in deploy output Ã¢â‚¬â€ resolved.
- Smoke test: build and deploy verified; endpoint functional check skipped (no admin JWT in session).

## Phase C Deploys

### 2026-04-30 - Cloudflare Pages: server-side unit conversion

- Commit: `11440f5` - Feature: Server-side Unit-Konvertierung Ã¢â‚¬â€ IU/Ã‚Âµg/mg/g fÃƒÂ¼r Upper-Limit-Vergleich.
- New `functions/api/lib/units.ts`: `normalizeUnit()`, `convertAmount()` with IUÃ¢â€ â€Ã‚Âµg/mg/g support for Vitamin D, A, E; pure mass conversion Ã‚ÂµgÃ¢â€ â€mgÃ¢â€ â€g generic.
- Integrated into `GET /api/ingredients/:id/recommendations`: cross-unit upper-limit comparison now attempted; `amount_converted_to_upper_limit_unit` field added to response when conversion was performed.
- Build: `npx tsc -p tsconfig.json` from `functions/` passed (no errors); `npm run build` from `frontend/` passed (1.43s, 0 errors).
- Command: `npx wrangler pages deploy frontend/dist --project-name supplementstack` (with CF env vars loaded).
- Preview URL: `https://292a8010.supplementstack.pages.dev`
- HTTP status check: not verified (no admin JWT in this session).
- Smoke test: skipped (no local D1 with mixed-unit rows available).

### 2026-04-29 - Cloudflare Pages: admin audit logging

- Commit: `4482a5f` - Feature: Admin Audit Logging Ã¢â‚¬â€ alle Mutationen in admin_audit_log.
- New `logAdminAction()` helper in `functions/api/lib/helpers.ts`; 16 mutation endpoints in admin.ts, products.ts, ingredients.ts now write to `admin_audit_log`.
- Build: `npx tsc -p tsconfig.json` from `functions/` passed; `npm run build` from `frontend/` passed; `functions/api` copied into `frontend/dist/functions/api` before deploy.
- Command: `. .\scripts\use-supplementstack-cloudflare.local.ps1; npx wrangler pages deploy frontend/dist --project-name supplementstack`
- Preview URL: `https://f8f1e2ef.supplementstack.pages.dev`
- HTTP status check: not verified (no admin JWT available in this session).

### 2026-04-29 - Cloudflare Pages: dose recommendations API

- Commit: `dd58ba2` - Feature: Add dose recommendations API.
- Endpoint: `GET /api/ingredients/:id/recommendations` reading active rows from `dose_recommendations`, joining `populations`, `verified_profiles`, and translation tables.
- Build: `npm run build` from `frontend/`; `functions` copied into `frontend/dist/functions` because Vite build did not include it.
- Command: `. .\scripts\use-supplementstack-cloudflare.local.ps1; npx wrangler pages deploy frontend/dist --project-name supplementstack`
- Preview URL: `https://23fb451d.supplementstack.pages.dev`
- HTTP status check on preview URL: `200`.
- Wrangler warning: `wrangler.toml` lacks `pages_build_output_dir`, so its config was ignored for the Pages deploy.

### 2026-04-29 - Cloudflare Pages: Hono module split

- Commit: `b1fd347` - Refactor: Split Pages API into Hono modules.
- `functions/api/[[path]].ts` is now a composition root mounting modules with `app.route(...)`; logic moved into `functions/api/modules/*` and `functions/api/lib/*`.
- Build: `npx tsc -p tsconfig.json` from `functions/` passed; `npm run build` from `frontend/` passed; `functions/api` copied into `frontend/dist/functions/api` before deploy.
- Command: `. .\scripts\use-supplementstack-cloudflare.local.ps1; npx wrangler pages deploy frontend/dist --project-name supplementstack`
- Preview URL: `https://c29f1c5d.supplementstack.pages.dev`
- HTTP status check on preview URL: `200`.

### 2026-04-28 16:10:17 - Cloudflare Pages

- Commit: `3c14e0d` - Fix: dosage cards show "Keine Empfehlung verfuegbar" instead of fake fallback values.

## Follow-Up

- D1 backup workflow has run successfully both manually and automatically. Token scopes verified.
- `pages_build_output_dir = "frontend/dist"` is already present in `wrangler.toml`; no deploy-log follow-up remains for that warning.

When a future agent deploys or applies migrations, append the exact date, commit, command summary, and verification result here.

## 2026-05-05 - Email Verification And Health-Claims Audit

- Remote D1 migrations:
  - `0043_email_verification.sql` applied successfully to `supplementstack-production`.
  - `0044_health_claim_content_audit.sql` applied successfully to `supplementstack-production`.
- Deploy command: `npx wrangler pages deploy frontend/dist --project-name supplementstack`.
- Correct production Pages project: `supplementstack`.
- Preview URL: `https://42cd17dd.supplementstack.pages.dev`.
- Live URL: `https://supplementstack.de`.
- Build asset: `assets/index-uekEwu_R.js`.
- Scope:
  - Added email verification with `/verify-email`, `POST /api/auth/verify-email`, authenticated `POST /api/auth/resend-verification`, SMTP verification mails, `email_verified_at`, and hashed token storage in `email_verification_tokens.token`.
  - Existing users were backfilled as verified.
  - Health-claims/content wording was softened across focused frontend copy and live/seed DB text via migration 0044.
- Validation passed: functions `npx tsc -p tsconfig.json`, frontend `npx tsc --noEmit`, frontend `npm run lint --if-present`, frontend `npm run build`, frontend `npm test -- --run` (5 tests), and `git diff --check`.
- Smoke checks passed: preview/live root 200, preview/live `/verify-email` 200, preview/live unauthenticated resend endpoint 401, live invalid verify endpoint 400, live `/api/demo/products` 200 with 7 products, D1 migration journal shows 0043/0044, `email_verification_tokens` table exists, and existing users have no `email_verified_at IS NULL` rows.
- DNS note: `_dmarc.supplementstack.de` has no TXT record yet; MX/SPF are present for All-Inkl/Kasserver, and `default._domainkey.supplementstack.de` was not found.

## 2026-05-05 - Data Minimization And Product Safety Warnings

- Remote D1 migrations:
  - `0045_data_minimization_profile_fields.sql` applied successfully to `supplementstack-production`.
  - `0046_knowledge_warnings.sql` applied successfully to `supplementstack-production`.
- Deploy command: `npx wrangler pages deploy frontend/dist --project-name supplementstack`.
- Correct production Pages project: `supplementstack`.
- Preview URL: `https://33f76fe5.supplementstack.pages.dev`.
- Live URL: `https://supplementstack.de`.
- Build asset: `assets/index-BG4hesq7.js`.
- Scope:
  - Removed gender, profile weight, diet, goals, and smoker status from registration/profile/auth response surfaces.
  - Cleared legacy stored values for those removed profile fields.
  - Added `knowledge_articles` and `ingredient_safety_warnings`.
  - Added `/api/knowledge/:slug` and frontend `/wissen/:slug`.
  - Added product-card safety warning labels with info popover and article link.
  - Seeded first source-backed warning/article for high-dose Beta-Carotin and lung-cancer risk in smokers/high-risk groups.
  - Made the warning form-specific for the existing Vitamin A Beta-Carotin form.
- Validation passed: functions TypeScript, frontend TypeScript, frontend lint, frontend build, frontend Vitest 5 tests, and `git diff --check`.
- Smoke checks passed: preview/live root 200, preview/live knowledge article route 200, preview/live knowledge API 200, preview/live demo products 200, D1 migration journal shows 0045/0046, article is published, warning row exists for Vitamin A + Beta-Carotin form, legacy profile-field residual count is 0, live profile GET/PUT no longer returns removed fields, and a temporary Beta-Carotin user product returned the warning plus article link. Temporary smoke user/product data was deleted.

## 2026-05-05 - Ingredient Research Admin Cockpit

- Remote D1 migration:
  - `0047_ingredient_research_admin.sql` applied successfully to `supplementstack-production`.
- Deploy command: `npx wrangler pages deploy frontend/dist --project-name supplementstack`.
- Correct production Pages project: `supplementstack`.
- Preview URL: `https://52db1978.supplementstack.pages.dev`.
- Live URL: `https://supplementstack.de`.
- Build asset: `assets/index-DTMpE7Sg.js`.
- Scope:
  - Added `ingredient_research_status` and `ingredient_research_sources`.
  - Added admin `/api/admin/ingredient-research` list/detail/status/source/warning routes.
  - Added admin `Wirkstoff-Recherche` tab with category-grouped ingredient list, responsive detail editor, source management, and warning management.
  - Existing `ingredient_safety_warnings` remains the product-card warning source; the cockpit manages warning rows but not full knowledge article bodies.
- Validation passed: frontend `npm run lint`, frontend `npm run build`, functions `npx tsc -p tsconfig.json --noEmit`, and `git diff --check` with CRLF warnings only.
- Smoke checks passed: remote D1 confirms `ingredient_research_status` and `ingredient_research_sources`, production ingredient count is 66, preview/live root 200 with `assets/index-DTMpE7Sg.js`, and preview/live unauthenticated `/api/admin/ingredient-research` returns 401.
- Commit after deploy: `7dd9a6b` - Feature: Add ingredient research admin cockpit.

## 2026-05-05 - Admin Ops And Knowledge Tools

- Deploy command: `npx wrangler pages deploy frontend/dist --project-name supplementstack` after loading local Cloudflare context.
- Correct production Pages project: `supplementstack`.
- Preview URL: `https://f74b20b0.supplementstack.pages.dev`.
- Live URL: `https://supplementstack.de`.
- Build asset: `assets/index-DVbWbGLx.js`.
- Scope:
  - Added admin knowledge article list/detail/create/update/archive routes and responsive `Wissen` editor.
  - Added admin ops dashboard counts and responsive `Admin-Uebersicht` cards.
  - Added admin product QA endpoint and responsive `Produkt-QA` card/table review surface.
  - Added ingredient research JSON export endpoint.
  - No D1 migration required.
- Validation passed: functions TypeScript, frontend TypeScript, frontend lint, frontend build, and `git diff --check` with CRLF warnings only.
- Smoke checks passed: preview/live root 200 with `assets/index-DVbWbGLx.js`; preview/live unauthenticated `/api/admin/ops-dashboard`, `/api/admin/knowledge-articles`, and `/api/admin/product-qa` return 401.
- Commit after deploy: `2908e8f` - Feature: Add admin ops and knowledge tools.

## 2026-05-05 - Round Experience V1

- Remote D1 migration:
  - `0048_user_stack_rounding.sql` applied successfully to `supplementstack-production`.
- Deploy command: `npx wrangler pages deploy frontend/dist --project-name supplementstack` after loading local Cloudflare context.
- Correct production Pages project: `supplementstack`.
- Preview URL: `https://f9870d82.supplementstack.pages.dev`.
- Live URL: `https://supplementstack.de`.
- Build asset: `assets/index-CmCtPS8l.js`.
- Scope:
  - Added family profile MVP and stack assignment.
  - Added visible stack cockpit/check and grouped Einnahmeplan.
  - Added product replacement confirmation for preserved dosage assumptions.
  - Added missing/invalid product link reporting.
  - Added admin work queues, inline Product-QA editing, and knowledge article publish guardrails.
- Validation passed: functions TypeScript, frontend TypeScript, frontend lint, frontend build, and `git diff --check` with CRLF warnings only.
- Smoke checks passed: preview/live root 200 with `assets/index-CmCtPS8l.js`; preview/live unauthenticated `/api/family`, `/api/stacks/link-report`, `/api/admin/product-qa/1`, and `/api/admin/ops-dashboard` return 401; remote D1 confirms `family_profiles`, `product_link_reports`, `idx_stacks_family_member_id`, and migration 0048 applied.
- Commit after deploy: `00ec3d4` - Feature: Add round stack and admin workflows.

## 2026-05-05 - Launch Checks And Print Routine

- Deploy command: `npx wrangler pages deploy frontend/dist --project-name supplementstack` after loading local Cloudflare context.
- Correct production Pages project: `supplementstack`.
- Preview URL: `https://f97becf1.supplementstack.pages.dev`.
- Live URL: `https://supplementstack.de`.
- Build asset: `assets/index-BmvNNsmY.js`.
- Scope:
  - Added admin `Linkmeldungen` tab and `/api/admin/link-reports` GET/PATCH.
  - Added link report counts/top queue items to admin ops dashboard.
  - Added admin `Go-Live Checks` tab for Mail/DNS, legal/trust, monitoring, and backups.
  - Added StackWorkspace `Plan drucken/PDF` plus print CSS for cockpit/Einnahmeplan.
  - Fixed small affiliate/trust copy typos.
- Validation passed: functions TypeScript, frontend TypeScript, frontend lint, frontend build, and `git diff --check` with CRLF warnings only.
- Smoke checks passed: preview/live root 200 with `assets/index-BmvNNsmY.js`; unauthenticated preview `/api/admin/link-reports` and `/api/admin/ops-dashboard`, plus live `/api/admin/link-reports`, return 401.
- DNS check: SPF and MX present; DMARC missing; common DKIM selectors not found.
- Commit after deploy: `d0b878b` - Feature: Add launch checks and print routine.

## 2026-05-05 - DMARC DNS Update

- Cloudflare DNS change: created `_dmarc.supplementstack.de` TXT.
- Value: `v=DMARC1; p=none; rua=mailto:email@nickkrakow.de; adkim=s; aspf=s; pct=100`.
- Verification: Cloudflare DNS-over-HTTPS returns the TXT record with status 0.
- Deploy command: `npx wrangler pages deploy frontend/dist --project-name supplementstack` after updating Admin Go-Live checklist.
- Preview URL: `https://4a2e4ba7.supplementstack.pages.dev`.
- Live URL: `https://supplementstack.de`.
- Build asset: `assets/index-BeN1jbtz.js`.
- Commit after deploy: `55e44f4` - Update launch checklist DMARC status.

## 2026-05-05 - DKIM DNS Update

- Cloudflare DNS change: created `kas202508251337._domainkey.supplementstack.de` TXT.
- Value: All-Inkl/Kasserver DKIM public key supplied by owner, beginning `v=DKIM1; k=rsa; p=MIIB...`.
- Verification: Cloudflare DNS-over-HTTPS returns the TXT record with status 0.
- Deploy command: `npx wrangler pages deploy frontend/dist --project-name supplementstack` after updating Admin Go-Live checklist.
- Preview URL: `https://eb099bd2.supplementstack.pages.dev`.
- Live URL: `https://supplementstack.de`.
- Build asset: `assets/index-Bsg3uhC-.js`.
- Commit after deploy: `7f9c67a` - Update launch checklist DKIM status.

## 2026-05-05 - Stack Creation And Content Preview Hotfix

- Deploy command: `npx wrangler pages deploy frontend/dist --project-name supplementstack`.
- Preview URL: `https://a9ed6e3e.supplementstack.pages.dev`.
- Live URL: `https://supplementstack.de`.
- Build asset: `assets/index-CTRHry5S.js`.
- Scope:
  - Fixed `POST /api/stacks` omitted `family_member_id` handling.
  - Improved frontend stack error propagation.
  - Changed add-product preview from `Packung`/`Portionen` to `Inhalt` with contained units and days supply.
- Validation passed: functions TypeScript, frontend TypeScript, frontend lint, frontend build, and `git diff --check` with CRLF warnings only.
- Smoke checks passed: fresh test account created stack and saved D3 stack item; temporary test data was deleted afterward.
- Commit after deploy: `6d0cff4` - Fix stack creation and content preview.

## 2026-05-05 - Stack Cockpit Simplification

- Deploy command: `npx wrangler pages deploy frontend/dist --project-name supplementstack`.
- Preview URL: `https://2de2b5ec.supplementstack.pages.dev`.
- Live URL: `https://supplementstack.de`.
- Build asset: `assets/index-BKappw8q.js`.
- Scope:
  - Removed the visible Stack-Check metric tiles from the stack page.
  - Made the intake plan collapsed by default behind the profile-adjacent clock button.
  - Converted the bottom bar into a centered cost/product footer overlay.
  - Blocked duplicate product additions in the modal and backend stack payload validation.
- Validation passed: functions TypeScript, frontend TypeScript, frontend lint, frontend build, frontend Vitest 5 tests, and `git diff --check` with CRLF warnings only.
- Smoke checks passed: preview/live root returned 200 with `assets/index-BKappw8q.js`.
- Commit before deploy: `8768854` - UX: Simplify stack cockpit and bottom summary.

## 2026-05-05 - Whole-Unit Dosage And Footer Polish

- Deployed Cloudflare Pages project `supplementstack`.
- Preview URL: `https://972cb5fc.supplementstack.pages.dev`.
- Preview root returned 200 with `assets/index-HwTaoKFr.js`.
- Validation passed before deploy: frontend tests, frontend TypeScript, lint, build, functions TypeScript, and `git diff --check`.
- Live-domain smoke was blocked by recursive DNS `SERVFAIL` for `supplementstack.de`; Cloudflare zone/project checks and authoritative nameserver checks look healthy.

## 2026-05-06 Stack Product View Toggle Deployed

- Latest stack product view toggle commit deployed to Cloudflare Pages project `supplementstack`.
- Preview URL: `https://336cf419.supplementstack.pages.dev`.
- Live URL: `https://supplementstack.de`, asset `assets/index-vwRdauH5.js`.
- User stack product overview no longer groups products into heuristic categories. Products render in stack order.
- Added persisted `Kacheln` / `Liste` toggle for the product overview.
- Validation passed before deploy: frontend ESLint, frontend TypeScript, frontend Vitest 6 tests, frontend build, and `git diff --check` with CRLF warnings only.
- Smoke checks passed after deploy: preview/live `/` and `/demo` return HTTP 200 with the new asset.

## 2026-05-06 Product Card Info And Grid Order Deployed

- Commit `f85093b` deployed to Cloudflare Pages project `supplementstack`.
- Preview URL: `https://3f1bbcc8.supplementstack.pages.dev`.
- Live URL: `https://supplementstack.de`, assets `assets/index-BGkjPN9_.js` and `assets/index-428wN7Dg.css`.
- Product cards now show existing `effect_summary` as compact `Wirkung` chips where possible.
- The stack card view now uses a row-first responsive CSS grid instead of CSS multi-column balancing, so new rows start on the left.
- Validation passed before deploy: frontend ESLint, frontend TypeScript, frontend Vitest 6 tests, frontend build, and `git diff --check` with CRLF warnings only.
- Smoke checks passed after deploy: preview/live `/` and `/demo` return HTTP 200 with the new assets.

## 2026-05-06 Masonry Reverted Deployed

- Commit `c9ad631` deployed to Cloudflare Pages project `supplementstack`.
- Preview URL: `https://ff838684.supplementstack.pages.dev`.
- Live URL: `https://supplementstack.de`, assets `assets/index-Dsg5FQl8.js` and `assets/index-BSJnq_M0.css`.
- Restored true CSS-column Masonry for the stack card view after user clarified that Masonry should remain for larger stacks.
- ProductCard `Wirkung` chips from the previous card improvement remain live.
- Validation passed before deploy: frontend ESLint, frontend TypeScript, frontend Vitest 6 tests, frontend build, and `git diff --check` with CRLF warnings only.
- Smoke checks passed after deploy: preview/live `/` and `/demo` return HTTP 200 with the new assets.

## 2026-05-06 Product Card Wirkung Data Deployed

- Commit `9cefe68` deployed to Cloudflare Pages project `supplementstack`.
- Remote D1 migration `0049_seed_product_effect_summaries.sql` applied successfully to `supplementstack-production`.
- Preview URL: `https://1ea620af.supplementstack.pages.dev`.
- Live URL: `https://supplementstack.de`, asset `assets/index-QxFzPxGu.js`.
- ProductCard no longer falls back from missing `effect_summary` to product `form`, preventing wrong Wirkung values such as `Tropfen`.
- Initial public catalog products now have short Wirkung summaries; verified D3 `Immunsystem, Knochen, Hormone` and Magnesium `Muskel- & Nervenfunktion, Entspannung` through preview/live `/api/demo/products`.
- Validation passed before deploy: frontend ESLint, frontend TypeScript, frontend Vitest 6 tests, frontend build, and `git diff --check` with CRLF warnings only.
- Smoke checks passed after deploy: preview/live `/demo` and `/api/demo/products` return HTTP 200 with the expected summaries.

## 2026-05-06 Ingredient Display Profiles Deployed

- Remote D1 migrations:
  - `0050_ingredient_display_profiles.sql` applied successfully.
  - `0051_backfill_product_ingredient_forms_normalized.sql` applied
    successfully.
- Deploy command: `npx wrangler pages deploy frontend/dist --project-name supplementstack`.
- Correct production Pages project: `supplementstack`.
- Latest preview URL: `https://72d5b8ca.supplementstack.pages.dev`.
- Scope:
  - Added `ingredient_display_profiles` for ingredient/form/sub-ingredient UI
    metadata.
  - Seeded base profile summaries from existing product card summaries and
    imported form timing/comment data from `ingredient_forms`.
  - Backfilled obvious and separator-normalized catalog/user-product form links.
  - Added admin API and UI for display profile upsert inside
    `Wirkstoff-Recherche`.
  - Updated product, ingredient-products, demo, and stack APIs to use profile
    effect/timing data.
  - Stopped admin product detail edits and product update validation from
    writing product-level `timing` or `effect_summary`.
  - Updated user product form to persist selected `form_id`.
- Validation passed: functions TypeScript, frontend TypeScript, frontend lint,
  frontend build, and `git diff --check`.
- Smoke checks passed: preview root 200; unauthenticated admin ingredient
  research detail 401; preview `/api/demo/products` returns D3 and Magnesium
  with profile-backed fields; live `https://supplementstack.de/` returns 200
  and live `/api/demo/products` returns the same D3/Magnesium profile-backed
  fields; remote D1 shows 209 display profiles and linked
  Magnesiumcitrat/Bisglycinat/Malat form IDs.

## 2026-05-06 Affiliate CTA Cleanup Deployed

- Deploy command: `npx wrangler pages deploy frontend/dist --project-name supplementstack`.
- Correct production Pages project: `supplementstack`.
- Preview URL: `https://5e59a3f6.supplementstack.pages.dev`.
- Live URL: `https://supplementstack.de`, asset `assets/index-DnxszgO5.js`.
- Scope:
  - Product-card buy buttons no longer append affiliate wording.
  - Stack email buy buttons no longer append affiliate wording or secondary
    affiliate labels.
  - User product submission no longer exposes an Affiliate checkbox.
  - Footer/legal disclosure remains general; the footer disclaimer no longer
    claims individual links are marked in the interface.
  - Admin Go-Live checklist records that product cards/buttons do not mark
    individual links explicitly.
- Validation passed: functions TypeScript, frontend TypeScript, frontend lint,
  frontend build, and `git diff --check`.
- Smoke checks passed: preview/live root 200 and preview/live
  `/api/demo/products` returns 7 products.

## 2026-05-06 Admin Rebuild Phase 0 Deployed

- Scope:
  - New `/administrator` admin surface remains active alongside legacy `/admin`.
  - Phase 0.1 interactions compatibility is deployed; `GET /api/interactions`
    is now admin-protected.
  - Phase 0.2 Affiliate-Ownership is deployed with
    `products.affiliate_owner_type` / `affiliate_owner_user_id` and legacy
    `is_affiliate` dual-write compatibility.
  - Phase 0.3 Dose-Source-Bridge is deployed with
    `dose_recommendation_sources`, admin dose source-link read/write support,
    `/administrator/dosing`, and linked-source delete guard.
- Remote D1 migrations:
  - `0052_product_affiliate_ownership.sql` applied successfully.
  - `0053_dose_recommendation_sources.sql` applied successfully.
  - Post-apply `wrangler d1 migrations list supplementstack-production --remote`
    returned no pending migrations.
- Deploy prep:
  - `npx tsc -p tsconfig.json --noEmit` from `functions/` passed.
  - `npm run build` from `frontend/` passed with the known Vite chunk-size
    warning.
  - Copied `functions/` to `frontend/dist/functions`; verified
    `frontend/dist/functions/api/[[path]].ts` exists.
- Deploy command:
  - `. .\scripts\use-supplementstack-cloudflare.local.ps1; npx wrangler pages deploy frontend/dist --project-name supplementstack`
- Preview URL: `https://e3331f0b.supplementstack.pages.dev`.
- Live URL: `https://supplementstack.de`.
- Deployed asset: `assets/index-BC8IufAV.js` and `assets/index-DDNI4ZzM.css`.
- Smoke checks:
  - Preview/live `/` returned HTTP 200.
  - Preview/live `/administrator/dosing` returned HTTP 200.
  - Preview/live unauthenticated `/api/admin/dose-recommendations` returned
    HTTP 401.
  - Preview/live unauthenticated `/api/interactions` returned HTTP 401.
  - Remote D1 schema smoke returned `product_owner_cols=2`,
    `dose_source_table=1`, and `primary_index=1`.
  - Remote D1 data smoke returned `invalid_affiliate_owner_rows=0`,
    `linked_dose_sources=0`, and `primary_dose_sources=0`.
- Notes:
  - `linked_dose_sources=0` means production had no matching
    `(ingredient_id, source_url)` rows for automatic bridge backfill; existing
    dose recommendations need manual source linking in `/administrator/dosing`.
  - Wrangler warned about uncommitted changes during deploy. Expected for this
    active admin rebuild worktree; unrelated `.claude/*`, `logo.png`, and
    `qa-preview-demo-bottombar-no-cookie.png` were not intentionally changed by
    this deploy pass.

## 2026-05-06 Administrator Design + Operations Slice Deployed

- Scope:
  - `/administrator` design shell deployed live alongside legacy `/admin`.
  - New `/administrator/user-products` page with status filters, per-row
    approve/reject/publish/delete, Trusted-Submitter toggle, checkbox
    selection, and frontend-chunked bulk approve.
  - New `/administrator/audit-log` page with filters, pagination, endpoint
    source badge, action badges, and expandable changes/reason/request metadata.
  - Remaining planned routes stay as explicit placeholders instead of
    redirecting.
- Remote D1 migrations:
  - `wrangler d1 migrations list supplementstack-production --remote` returned
    no pending migrations before deploy.
- Validation:
  - `npx tsc -p tsconfig.json --noEmit` from `functions/` passed.
  - `npx tsc --noEmit`, `npm run lint --if-present`, and `npm run build` from
    `frontend/` passed. Vite chunk-size warning remains known.
  - Scoped `git diff --check` passed with CRLF warning only.
  - Local mocked Playwright smoke passed for administrator dashboard,
    user-products, audit-log, and 390px mobile user-products.
- Deploy prep:
  - Copied `functions/` to `frontend/dist/functions`.
  - Verified `frontend/dist/functions/api/[[path]].ts` exists.
- Deploy command:
  - `. .\scripts\use-supplementstack-cloudflare.local.ps1; npx wrangler pages deploy frontend/dist --project-name supplementstack`
- Preview URL: `https://bee102d9.supplementstack.pages.dev`.
- Live URL: `https://supplementstack.de`.
- Smoke checks:
  - Preview/live `/` returned HTTP 200.
  - Preview/live `/administrator/dashboard` returned HTTP 200.
  - Preview/live `/administrator/user-products` returned HTTP 200.
  - Preview/live `/administrator/audit-log` returned HTTP 200.
  - Preview/live unauthenticated `/api/admin/dose-recommendations` returned
    HTTP 401.
  - Preview/live unauthenticated `/api/interactions` returned HTTP 401.
- Notes:
  - Deploy ran with expected Wrangler dirty-worktree warning because the admin
    rebuild remains an active uncommitted worktree.

## 2026-05-06 Administrator Broad UI Slice Deployed

- Scope:
  - `/administrator/products/:id` product detail page with tabs for overview,
    ingredients, moderation, affiliate, warnings, and audit context.
  - `/administrator/ingredients/:id` ingredient detail page with tabs for
    overview, forms, dosing, research, interactions, warnings, display, and
    i18n context.
  - Real pages replacing placeholders for Product-QA, Linkmeldungen, Wissen,
    Go-Live-Checks, Uebersetzungen, Sub-Wirkstoffe, Shop-Domains, and Rankings.
  - Shell navigation and breadcrumbs updated for product/ingredient detail
    routes and Sub-Wirkstoffe.
  - Follow-up review fixes: real `GET /api/admin/products/:id` endpoint added;
    product detail no longer loads all products client-side; ingredient lookup
    helper no longer swallows API/auth failures; Sub-Wirkstoffe shows lookup
    load errors; mobile-only cards no longer duplicate desktop tables on
    Shop-Domains/Rankings; translations draft keys include language and
    pagination is based on backend-loaded rows.
- Remote D1 migrations:
  - No new migration required for this slice.
  - Earlier `0052_product_affiliate_ownership.sql` and
    `0053_dose_recommendation_sources.sql` remain applied.
- Validation:
  - `npx tsc -p tsconfig.json --noEmit` from `functions/` passed.
  - `npx tsc --noEmit` from `frontend/` passed.
  - `npm run lint --if-present` from `frontend/` passed.
  - `npm run build` from `frontend/` passed with the known Vite chunk-size
    warning.
  - Scoped `git diff --check` passed with CRLF warnings only.
- Deploy prep:
  - Copied `functions/` to `frontend/dist/functions`.
  - Verified `frontend/dist/functions/api/[[path]].ts` exists with
    `Test-Path -LiteralPath`.
- Deploy command:
  - `. .\scripts\use-supplementstack-cloudflare.local.ps1; npx wrangler pages deploy frontend/dist --project-name supplementstack`
- Preview URL: `https://3b7180e8.supplementstack.pages.dev`.
- Live URL: `https://supplementstack.de`.
- Deployed asset: `assets/index-OUTVBOeo.js` and `assets/index-1L_skzTs.css`.
- Smoke checks:
  - Preview/live `/` returned HTTP 200.
  - Preview/live `/administrator/products`, `/administrator/products/1`,
    `/administrator/ingredients/1`, `/administrator/product-qa`,
    `/administrator/link-reports`, `/administrator/knowledge`,
    `/administrator/translations`, `/administrator/sub-ingredients`,
    `/administrator/shop-domains`, and `/administrator/rankings` returned
    HTTP 200.
  - Preview/live unauthenticated `/api/admin/product-qa` returned HTTP 401.
  - Preview/live unauthenticated `/api/admin/products/1` returned HTTP 401.
- Notes:
  - `/administrator/users` and `/administrator/settings` remain placeholders.
  - Product-QA/Linkmeldungen counters are loaded-window counts, not global
    backend totals.
  - Go-Live-Checks are currently a static admin checklist and do not yet verify
    live DNS/backup state.
  - Wrangler warned about uncommitted changes during deploy, expected for this
    active admin rebuild worktree.

## 2026-05-06 Administrator Users + Settings Slice Deployed

- Scope:
  - `/administrator/users` is now a real admin user-management page.
  - `/administrator/settings` is now a real system/readiness overview page.
  - Backend added `GET /api/admin/users` with q/role/trusted/verified/page/limit
    filters, summary counts, and product/stack usage counts.
  - Backend added `PATCH /api/admin/users/:id` for safe admin fields only:
    `role` and `trusted_submitter`. The route audits changes, blocks
    self-demotion, and blocks demoting the last admin.
  - Frontend route imports wired Users and Settings pages instead of
    placeholders.
  - P1 review fixes: ingredient-detail save helpers now parse actual Axios
    response data; dosing payload normalization now includes `is_public`.
  - Administrator shell removed inert hard-coded nav badges and no-op search /
    notification controls.
  - Mobile CSS polish added for admin drawer, toolbars, tables, tab strips,
    forms, touch targets, and overflow handling at 375px-430px.
- Remote D1 migrations:
  - `wrangler d1 migrations list supplementstack-production --remote` returned
    no migrations to apply.
- Validation:
  - `npx tsc -p tsconfig.json --noEmit` from `functions/` passed.
  - `npx tsc --noEmit` from `frontend/` passed.
  - `npm run lint --if-present` from `frontend/` passed.
  - `npm run build` from `frontend/` passed with the known Vite chunk-size
    warning.
  - Scoped `git diff --check` passed with CRLF warnings only.
- Deploy prep:
  - Copied `functions/` to `frontend/dist/functions`.
  - Verified `frontend/dist/functions/api/[[path]].ts` exists with
    `Test-Path -LiteralPath`.
- Deploy command:
  - `. .\scripts\use-supplementstack-cloudflare.local.ps1; npx wrangler pages deploy frontend/dist --project-name supplementstack`
- Preview URL: `https://97eea08f.supplementstack.pages.dev`.
- Live URL: `https://supplementstack.de`.
- Deployed asset: `assets/index-CUsuTl-I.js` and `assets/index-Cb18eqEl.css`.
- Smoke checks:
  - Preview/live `/`, `/administrator/users`, `/administrator/settings`,
    `/administrator/products/1`, `/administrator/ingredients/1`,
    `/administrator/product-qa`, `/administrator/link-reports`, and
    `/administrator/sub-ingredients` returned HTTP 200.
  - Preview/live unauthenticated `GET /api/admin/users`,
    `PATCH /api/admin/users/1`, `/api/admin/product-qa`,
    `/api/admin/link-reports`, `/api/admin/dose-recommendations`, and
    `/api/interactions` returned HTTP 401.
- Notes:
  - `GET /api/admin/users/1` is not implemented and returns 404; the supported
    mutation contract is `PATCH /api/admin/users/:id`.
  - Authenticated browser/mobile QA is still open.
  - Next technical slice is Product Detail depth: real ingredient rows,
    warnings, QA flags, and recent audit context.

## 2026-05-06 Administrator Product Detail Depth Deployed

- Scope:
  - `GET /api/admin/products/:id` now returns product-scoped detail data:
    ingredient rows with form/parent/potency/basis/display-profile context,
    QA row/counts, active safety warnings, catalog link-report counts/details,
    and recent product audit rows.
  - `/administrator/products/:id` renders real ingredient tables/cards,
    QA flags, link report context, warning details, and recent audit entries.
  - Existing affiliate save behavior remains on the Product-QA patch path.
  - Product-QA and Linkmeldungen mobile rendering now hides the desktop
    `AdminCard` wrapper below `md`, avoiding duplicate mobile cards plus an
    empty desktop table shell.
- Remote D1 migrations:
  - No new migration required.
- Validation:
  - `npx tsc -p tsconfig.json --noEmit` from `functions/` passed.
  - `npx tsc --noEmit` from `frontend/` passed.
  - `npm run lint --if-present` from `frontend/` passed.
  - `npm run build` from `frontend/` passed with the known Vite chunk-size
    warning.
  - Scoped `git diff --check` passed with CRLF warnings only.
- Deploy prep:
  - Copied `functions/` to `frontend/dist/functions`.
  - Verified `frontend/dist/functions/api/[[path]].ts` exists with
    `Test-Path -LiteralPath`.
- Deploy command:
  - `. .\scripts\use-supplementstack-cloudflare.local.ps1; npx wrangler pages deploy frontend/dist --project-name supplementstack`
- Preview URL: `https://3cf7797e.supplementstack.pages.dev`.
- Live URL: `https://supplementstack.de`.
- Deployed asset: `assets/index-D9Io4Pi3.js` and `assets/index-Cb18eqEl.css`.
- Smoke checks:
  - Preview/live `/`, `/administrator/products/1`, `/administrator/users`,
    `/administrator/settings`, `/administrator/product-qa`, and
    `/administrator/link-reports` returned HTTP 200.
  - Preview/live unauthenticated `/api/admin/products/1`,
    `/api/admin/users`, `/api/admin/product-qa`, `/api/admin/link-reports`,
    `/api/admin/dose-recommendations`, and `/api/interactions` returned
    HTTP 401.
- Notes:
  - Audit context is limited to recent `admin_audit_log` rows with
    `entity_type='product'` and matching `entity_id`.
  - Link report status editing remains in the dedicated Linkmeldungen page.
  - Authenticated browser/mobile QA is still open.
  - Next technical slice is Ingredient Detail editing/source-to-dose linking.

## 2026-05-06 Administrator Ingredient Detail Editor Deployed

- Scope:
  - `/administrator/ingredients/:id` now supports create/edit/delete UI for
    ingredient research sources.
  - `/administrator/ingredients/:id` now supports create/edit/deactivate UI for
    ingredient safety warnings.
  - Ingredient dosing tab now loads dose recommendations for the current
    ingredient, shows linked sources, and can link/unlink existing research
    sources as primary or secondary using the existing dose recommendation
    `sources` payload.
  - Existing research status and display-profile editing remains intact.
  - `/administrator/products/:id` tab state is URL-backed via `?section=`.
- Remote D1 migrations:
  - No new migration required.
- Validation:
  - `npx tsc -p tsconfig.json --noEmit` from `functions/` passed.
  - `npx tsc --noEmit` from `frontend/` passed.
  - `npm run lint --if-present` from `frontend/` passed.
  - `npm run build` from `frontend/` passed with the known Vite chunk-size
    warning.
  - Scoped `git diff --check` passed with CRLF warnings only.
- Deploy prep:
  - Copied `functions/` to `frontend/dist/functions`.
  - Verified `frontend/dist/functions/api/[[path]].ts` exists with
    `Test-Path -LiteralPath`.
- Deploy command:
  - `. .\scripts\use-supplementstack-cloudflare.local.ps1; npx wrangler pages deploy frontend/dist --project-name supplementstack`
- Preview URL: `https://ef57c67b.supplementstack.pages.dev`.
- Live URL: `https://supplementstack.de`.
- Deployed asset: `assets/index-ZD0Mcdfm.js` and `assets/index-DmIdTXWw.css`.
- Smoke checks:
  - Preview/live `/`, `/administrator/ingredients/1`,
    `/administrator/ingredients/1?section=research`,
    `/administrator/ingredients/1?section=dosing`,
    `/administrator/products/1?section=audit`, `/administrator/users`, and
    `/administrator/settings` returned HTTP 200.
  - Preview/live unauthenticated `/api/admin/ingredient-research/1`,
    `/api/admin/dose-recommendations?ingredient_id=1&limit=5`,
    `/api/admin/products/1`, `/api/admin/users`, and `/api/interactions`
    returned HTTP 401.
- Notes:
  - Authenticated browser/mobile QA is still open.
  - Research source deletion may return 409 when the source is linked to a dose
    recommendation; the UI surfaces that backend error.
  - Next technical slice is shared pagination/counts for Product-QA and
    Linkmeldungen.

## 2026-05-06 Administrator Product-QA + Linkmeldungen Pagination Deployed

- Scope:
  - `GET /api/admin/product-qa` now accepts `page`, `limit`, `issue`, and `q`;
    returns paged products plus real `total`, `page`, `limit`,
    `summary.issues`, and `issue_summary`.
  - `GET /api/admin/link-reports` now accepts `page`, `limit`, `status`, and
    `q`; returns paged reports plus real `total`, `page`, `limit`,
    `summary.statuses`, and `status_summary`.
  - `/administrator/product-qa` and `/administrator/link-reports` now show real
    totals, page range, page-size selectors, previous/next controls, and global
    summary chips instead of loaded-window counts.
  - Existing filters, inline Product-QA edits, Linkmeldungen status actions,
    and mobile cards were preserved.
- Remote D1 migrations:
  - No new migration required.
- Validation:
  - `npx tsc -p tsconfig.json --noEmit` from `functions/` passed.
  - `npx tsc --noEmit` from `frontend/` passed.
  - `npm run lint --if-present` from `frontend/` passed.
  - `npm run build` from `frontend/` passed with the known Vite chunk-size
    warning.
  - Scoped `git diff --check` passed with CRLF warnings only.
- Deploy prep:
  - Copied `functions/` to `frontend/dist/functions`.
  - Verified `frontend/dist/functions/api/[[path]].ts` exists with
    `Test-Path -LiteralPath`.
- Deploy command:
  - `. .\scripts\use-supplementstack-cloudflare.local.ps1; npx wrangler pages deploy frontend/dist --project-name supplementstack`
- Preview URL: `https://606be06f.supplementstack.pages.dev`.
- Live URL: `https://supplementstack.de`.
- Deployed asset: `assets/index-DwQj58i8.js` and `assets/index-DmIdTXWw.css`.
- Smoke checks:
  - Preview/live `/`, `/administrator/product-qa`,
    `/administrator/link-reports`, `/administrator/ingredients/1?section=dosing`,
    and `/administrator/products/1?section=audit` returned HTTP 200.
  - Preview/live unauthenticated `/api/admin/product-qa?page=1&limit=5`,
    `/api/admin/link-reports?page=1&limit=5`,
    `/api/admin/ingredient-research/1`, `/api/admin/products/1`, and
    `/api/interactions` returned HTTP 401.
- Notes:
  - Authenticated browser/mobile QA is still open.
  - Next technical slice is paginated Products and Ingredients list endpoints.

## 2026-05-06 Administrator Product/Ingredient List Pagination Deployed

- Scope:
  - `GET /api/admin/products` now supports admin `q`, `page`, and `limit`
    pagination for `/administrator/products`.
  - Legacy no-query `GET /api/admin/products` remains unbounded for old
    `/admin` compatibility.
  - `GET /api/admin/ingredients` now supports admin `q`, `page`, and `limit`
    pagination, with lightweight product, dose, warning, and research status
    counts for `/administrator/ingredients`.
  - `/administrator/products` and `/administrator/ingredients` now use
    server-side search, total counts, page ranges, page-size selectors, and
    previous/next controls.
  - UI/Mobile polish added focus-visible states, mobile drawer ARIA/Escape
    behavior, touch target and overflow guards, and thin admin scrollbars.
  - Added read-only authenticated QA harness:
    `scripts/admin-browser-smoke.mjs` plus `scripts/admin-browser-smoke.md`.
- Remote D1 migrations:
  - No new migration required.
- Validation:
  - `npx tsc -p tsconfig.json --noEmit` from `functions/` passed.
  - `npx tsc --noEmit` from `frontend/` passed.
  - `npm run lint --if-present` from `frontend/` passed.
  - `npm run build` from `frontend/` passed with the known Vite chunk-size
    warning.
  - `node --check scripts/admin-browser-smoke.mjs` passed.
  - `node scripts/admin-browser-smoke.mjs --help` passed.
  - Scoped `git diff --check` passed with CRLF warnings only.
- Deploy prep:
  - Copied `functions/` to `frontend/dist/functions`.
  - Verified `frontend/dist/functions/api/[[path]].ts` exists with
    `Test-Path -LiteralPath`.
- Deploy command:
  - `. .\scripts\use-supplementstack-cloudflare.local.ps1; npx wrangler pages deploy frontend/dist --project-name supplementstack`
- Preview URL: `https://a192265c.supplementstack.pages.dev`.
- Live URL: `https://supplementstack.de`.
- Deployed asset: `assets/index-CIEnKZf8.js` and `assets/index-Bs8Bs153.css`.
- Smoke checks:
  - Preview/live `/`, `/administrator/dashboard`, `/administrator/products`,
    `/administrator/ingredients`, `/administrator/product-qa`,
    `/administrator/link-reports`, `/administrator/users`,
    `/administrator/settings`, and `/administrator/health` returned HTTP 200.
  - Preview/live unauthenticated
    `/api/admin/products?page=1&limit=5`,
    `/api/admin/ingredients?page=1&limit=5`, `/api/admin/products/1`,
    `/api/admin/product-qa?page=1&limit=5`,
    `/api/admin/link-reports?page=1&limit=5`, and `/api/interactions`
    returned HTTP 401.
- Notes:
  - The authenticated browser smoke harness was not run against a real admin
    session in this pass because no admin token or admin credentials were
    provided in the environment.
  - Wrangler warned about uncommitted changes during deploy, expected for this
    active admin rebuild worktree.

## 2026-05-06 Administrator Operations Polish Deployed

- Scope:
  - Added `PUT /api/admin/user-products/bulk-approve`, admin-guarded and
    capped at 100 IDs per request, with deduplication, per-item results,
    partial failure reporting, and one audit-log summary action.
  - `/administrator/user-products` now uses the backend bulk endpoint instead
    of sending one approve request per selected product.
  - `/administrator/audit-log` now renders common `changes` payloads as
    before/after rows or readable field cards, with JSON fallback for nested
    structures.
  - Legacy `/admin` interaction creation now maps old `type` values to
    severity when no explicit `severity` is sent, preserving `type: danger`
    as `severity: danger`.
- Remote D1 migrations:
  - No new migration required.
- Validation:
  - `npx tsc -p tsconfig.json --noEmit` from `functions/` passed.
  - `npx tsc --noEmit` from `frontend/` passed.
  - `npm run lint --if-present` from `frontend/` passed.
  - `npm run build` from `frontend/` passed with the known Vite chunk-size
    warning.
  - `node --check scripts/admin-browser-smoke.mjs` passed.
  - Scoped `git diff --check` passed with CRLF warnings only.
- Deploy prep:
  - Copied `functions/` to `frontend/dist/functions`.
  - Verified `frontend/dist/functions/api/[[path]].ts` exists with
    `Test-Path -LiteralPath`.
- Deploy command:
  - `. .\scripts\use-supplementstack-cloudflare.local.ps1; npx wrangler pages deploy frontend/dist --project-name supplementstack`
- Preview URL: `https://01af0df1.supplementstack.pages.dev`.
- Live URL: `https://supplementstack.de`.
- Deployed asset: `assets/index-iMjuWDij.js` and `assets/index-ahA9uoPv.css`.
- Smoke checks:
  - Preview/live `/`, `/administrator/user-products`,
    `/administrator/audit-log`, `/administrator/interactions`,
    `/administrator/products`, and `/administrator/ingredients` returned
    HTTP 200.
  - Preview/live unauthenticated `/api/interactions`,
    `/api/admin/audit-log?page=1&limit=5`,
    `/api/admin/user-products?status=pending`, and
    `PUT /api/admin/user-products/bulk-approve` returned HTTP 401.
- Notes:
  - `/api/admin/user-products` still needs server-side pagination; the bulk
    endpoint only fixes the write path scale issue.

## 2026-05-06 Administrator User-Produkte Pagination + Smoke Harness Deployed

- Scope:
  - `GET /api/admin/user-products` now accepts `status`, `page`, and `limit`,
    returns paged products plus `total`, `page`, `limit`, `total_pages`,
    `summary`, and `status_summary`.
  - `/administrator/user-products` now uses backend pagination controls,
    status totals, page ranges, and page-size selectors while preserving the
    existing bulk approve endpoint.
  - `scripts/admin-browser-smoke.mjs` default route coverage now spans the
    current `/administrator` surface, including product/ingredient details and
    ingredient detail tab clicks; docs were updated.
- Remote D1 migrations:
  - No new migration required.
- Validation:
  - `npx tsc -p tsconfig.json --noEmit` from `functions/` passed.
  - `npx tsc --noEmit` from `frontend/` passed.
  - `npm run lint --if-present` from `frontend/` passed.
  - `npm run build` from `frontend/` passed with the known Vite chunk-size
    warning.
  - `node --check scripts/admin-browser-smoke.mjs` passed.
  - `node scripts/admin-browser-smoke.mjs --help` passed.
  - Scoped `git diff --check` passed with CRLF warnings only.
- Deploy prep:
  - Copied `functions/` to `frontend/dist/functions`.
  - Verified `frontend/dist/functions/api/[[path]].ts` exists with
    `Test-Path -LiteralPath`.
- Deploy command:
  - `. .\scripts\use-supplementstack-cloudflare.local.ps1; npx wrangler pages deploy frontend/dist --project-name supplementstack`
- Preview URL: `https://bbdb6c99.supplementstack.pages.dev`.
- Live URL: `https://supplementstack.de`.
- Smoke checks:
  - Preview/live `/`, `/administrator/user-products`,
    `/administrator/audit-log`, `/administrator/products`, and
    `/administrator/ingredients` returned HTTP 200.
  - Preview/live unauthenticated
    `/api/admin/user-products?status=pending&page=1&limit=5`,
    `PUT /api/admin/user-products/bulk-approve`,
    `/api/admin/products?page=1&limit=5`, and `/api/interactions` returned
    HTTP 401.
- Notes:
  - Authenticated browser/mobile QA is still open because no admin token or
    admin credentials are available in the environment.

## 2026-05-06 Administrator Launch Checks + Ingredient URL Tabs Deployed

- Scope:
  - Added `GET /api/admin/launch-checks`, admin-only behind `ensureAdmin`.
  - Endpoint returns safe launch-readiness checks for D1 basic/count queries,
    operations queues, configured/missing env flags, public HTTPS/DNS signals
    for `supplementstack.de`, and manual legal/mail/backup sign-offs.
  - Raw secret values and DNS TXT contents are not returned.
  - `/administrator/launch-checks` now renders the API snapshot with refresh,
    loading, error, status, and severity states.
  - `/administrator/ingredients/:id` tabs now use `?section=...` so direct
    links, refresh, and browser history preserve the selected tab.
- Remote D1 migrations:
  - No new migration required.
- Validation:
  - `npx tsc -p tsconfig.json --noEmit` from `functions/` passed.
  - `npx tsc --noEmit` from `frontend/` passed.
  - `npm run lint --if-present` from `frontend/` passed.
  - `npm run build` from `frontend/` passed with the known Vite chunk-size
    warning.
  - `node --check scripts/admin-browser-smoke.mjs` passed.
  - Scoped `git diff --check` passed with CRLF warnings only.
- Deploy prep:
  - Copied `functions/` to `frontend/dist/functions`.
  - Verified `frontend/dist/functions/api/[[path]].ts` exists with
    `Test-Path -LiteralPath`.
- Deploy command:
  - `. .\scripts\use-supplementstack-cloudflare.local.ps1; npx wrangler pages deploy frontend/dist --project-name supplementstack`
- Preview URL: `https://d3c2fc10.supplementstack.pages.dev`.
- Live URL: `https://supplementstack.de`.
- Smoke checks:
  - Preview/live `/`, `/administrator/launch-checks`,
    `/administrator/ingredients/1?section=dosing`,
    `/administrator/ingredients/1?section=display`,
    `/administrator/user-products`, and `/administrator/products` returned
    HTTP 200.
  - Preview/live unauthenticated `/api/admin/launch-checks`,
    `/api/admin/user-products?status=pending&page=1&limit=5`,
    `/api/admin/products?page=1&limit=5`, and `/api/interactions` returned
    HTTP 401.
- Notes:
  - Authenticated browser/mobile QA is still open because no admin token or
    admin credentials are available in the environment.

## 2026-05-06 Auth Backend Dual-Mode + Ingredient Interactions Deployed

- Scope:
  - `ensureAuth` now accepts HttpOnly `session` cookie first and falls back to
    `Authorization: Bearer ...`.
  - Login/register still return body token and additionally set
    `session=<jwt>; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=604800`.
  - Logout clears the same cookie with `Max-Age=0`.
  - CORS now includes credentials support for the existing explicit allowlist
    and Pages preview subdomains; no origin was added.
  - `GET /api/interactions?ingredient_id=:id` filters the admin-only
    interactions list for one ingredient.
  - `/administrator/ingredients/:id?section=interactions` renders a read-only
    Interaction table with source/mechanism/comment/status and link to the
    global editor.
- Remote D1 migrations:
  - No new migration required.
- Validation:
  - `npx tsc -p tsconfig.json --noEmit` from `functions/` passed.
  - `npx tsc --noEmit` from `frontend/` passed.
  - `npm run lint --if-present` from `frontend/` passed.
  - `npm run build` from `frontend/` passed with the known Vite chunk-size
    warning.
  - `node --check scripts/admin-browser-smoke.mjs` passed.
  - Scoped `git diff --check` passed with CRLF warnings only.
- Deploy prep:
  - Copied `functions/` to `frontend/dist/functions`.
  - Verified `frontend/dist/functions/api/[[path]].ts` exists with
    `Test-Path -LiteralPath`.
- Deploy command:
  - `. .\scripts\use-supplementstack-cloudflare.local.ps1; npx wrangler pages deploy frontend/dist --project-name supplementstack`
- Preview URL: `https://03a81657.supplementstack.pages.dev`.
- Live URL: `https://supplementstack.de`.
- Smoke checks:
  - Preview/live `/`, `/administrator/ingredients/1?section=interactions`,
    `/administrator/interactions`, and `/administrator/launch-checks` returned
    HTTP 200.
  - Preview/live unauthenticated `/api/interactions`,
    `/api/interactions?ingredient_id=1`, `/api/interactions?ingredient_id=bad`,
    `/api/admin/launch-checks`, and `/api/me` returned HTTP 401.
  - Preview CORS smoke with `Origin: https://supplementstack.de` returned
    `Access-Control-Allow-Origin: https://supplementstack.de` and
    `Access-Control-Allow-Credentials: true`.
- Notes:
  - Login Set-Cookie, cookie-only `/api/me`, and authenticated browser/mobile
    QA remain open because no admin/user credentials are available in the
    environment.

## 2026-05-06 Auth Frontend Cookie-Aware + Form Display Profiles Deployed

- Scope:
  - Frontend Axios sends `withCredentials: true`.
  - Auth bootstrap now attempts `getMe()` even without a local token; 401 is
    treated as logged-out state.
  - Login/register continue storing the body token for Bearer fallback.
  - Logout calls backend `POST /api/auth/logout` and clears local state even if
    the request fails.
  - Manual auth fetch callsites now send `credentials: 'include'` while keeping
    Bearer headers where available.
  - `/administrator/ingredients/:id?section=display` supports edit/create for
    form-specific display profiles via the existing display-profile upsert API.
- Remote D1 migrations:
  - No new migration required.
- Validation:
  - `npx tsc -p tsconfig.json --noEmit` from `functions/` passed.
  - `npx tsc --noEmit` from `frontend/` passed.
  - `npm run lint --if-present` from `frontend/` passed.
  - `npm run build` from `frontend/` passed with the known Vite chunk-size
    warning.
  - `node --check scripts/admin-browser-smoke.mjs` passed.
  - Scoped `git diff --check` passed with CRLF warnings only.
- Deploy prep:
  - Copied `functions/` to `frontend/dist/functions`.
  - Verified `frontend/dist/functions/api/[[path]].ts` exists with
    `Test-Path -LiteralPath`.
- Deploy command:
  - `. .\scripts\use-supplementstack-cloudflare.local.ps1; npx wrangler pages deploy frontend/dist --project-name supplementstack`
- Preview URL: `https://f5585a23.supplementstack.pages.dev`.
- Live URL: `https://supplementstack.de`.
- Smoke checks:
  - Preview/live `/`, `/administrator/ingredients/1?section=display`,
    `/administrator/ingredients/1?section=interactions`,
    `/administrator/launch-checks`, `/my-products`, and `/stacks` returned
    HTTP 200.
  - Preview/live unauthenticated `/api/me`,
    `/api/interactions?ingredient_id=1`, `/api/admin/launch-checks`,
    `/api/user-products`, and `/api/stacks` returned HTTP 401.
  - Preview CORS smoke with `Origin: https://supplementstack.de` returned
    `Access-Control-Allow-Origin: https://supplementstack.de` and
    `Access-Control-Allow-Credentials: true`.
- Notes:
  - Authenticated cookie-only login/logout and admin browser/mobile QA remain
    open because no admin/user credentials are available in the environment.

## 2026-05-11 Demo Stack UI Polish Preview Deployed

- Scope:
  - Public demo/stack text encoding cleanup for German umlauts and Euro signs.
  - Demo toolbar polish: `Stack erstellen` in dropdown, stack actions as
    icon-only buttons, delete icon before divider, green `Produkt hinzufügen`
    after divider.
  - Demo banner copy updated to the approved reset/signup wording.
  - Public `Studien & mehr` header nav plus `/wissen` index page.
  - Larger list-view product images/placeholders.
- Remote D1 migrations:
  - No new migration required.
- Validation:
  - `node scripts/user-ux-regression-check.mjs` passed.
  - `npx tsc --noEmit` from `frontend/` passed.
  - `npm run lint --if-present` from `frontend/` passed.
  - `npm test -- --run` from `frontend/` passed, 11 tests.
  - `npm run build` from `frontend/` passed.
  - `git diff --check` passed with CRLF warnings only.
- Deploy prep:
  - Built `frontend/dist`.
  - Copied `functions/` to `frontend/dist/functions`.
  - Verified `frontend/dist/functions/api/[[path]].ts` exists.
  - Copied `frontend/dist` into stable temp snapshot before Wrangler upload.
- Deploy command:
  - `. .\scripts\use-supplementstack-cloudflare.local.ps1; npx wrangler pages deploy <snapshot> --project-name supplementstack --branch codex-website-ux-fixes --commit-dirty=true`
- Preview URL:
  - `https://be7266ea.supplementstack.pages.dev`
- Branch alias:
  - `https://codex-website-ux-fixes.supplementstack.pages.dev`
- Browser smoke:
  - `/demo` rendered with no mojibake.
  - Approved banner copy was visible.
  - `Studien & mehr` header nav was visible.
  - Toolbar order verified: stack select, edit/mail/PDF/delete icon buttons,
    divider, `Produkt hinzufügen`.
  - List-view images measured `58x58`.
  - `/wissen` rendered with no mojibake and the knowledge index content.

## 2026-05-11 Website UX Review Follow-Ups Preview Deployed

- Scope:
  - Owner review comments for `/demo` and `/wissen` on branch
    `codex/website-ux-fixes`.
  - Stack toolbar icon polish, JSON share/import modals, demo banner copy,
    draggable product ordering, compact list/list-add refinements, and
    left-aligned `Link melden` card action.
  - `/wissen` rebuilt with approved headline/copy, search, keyword chips,
    masonry feature cards, remaining-entry list, and a source-interpretation
    disclaimer.
  - Schwarzkümmelöl product metadata corrected from mg-based demo data to a
    500 ml bottle with 40 ml daily dose.
- Remote D1 migrations:
  - Applied `0075_fix_black_seed_oil_volume.sql` to
    `supplementstack-production`.
- Validation:
  - `node scripts/user-ux-regression-check.mjs` passed.
  - `npx tsc --noEmit` from `frontend/` passed.
  - `npx tsc -p tsconfig.json --noEmit` from `functions/` passed.
  - `npm run lint --if-present` from `frontend/` passed.
  - `npm test -- --run` from `frontend/` passed, 12 tests.
  - `npm run build` from `frontend/` passed.
  - `git diff --check` passed with CRLF warnings only.
- Deploy prep:
  - Built `frontend/dist`.
  - Copied `functions/` to `frontend/dist/functions`.
  - Verified `frontend/dist/functions/api/[[path]].ts` exists.
  - Copied `frontend/dist` into a stable temp snapshot before Wrangler upload.
- Deploy command:
  - `. .\scripts\use-supplementstack-cloudflare.local.ps1; npx wrangler pages deploy <snapshot> --project-name supplementstack --branch codex-website-ux-fixes --commit-dirty=true`
- Preview URL:
  - `https://59a52a7d.supplementstack.pages.dev`
- Branch alias:
  - `https://codex-website-ux-fixes.supplementstack.pages.dev`
- Browser smoke:
  - `/demo` rendered with no mojibake.
  - Demo banner contains `um deinen Stack dauerhaft zu speichern`.
  - `Übersicht` title rendered.
  - Six draggable product cards were detected; add tile/row remains separate.
  - Toolbar share/import buttons and modals rendered.
  - Schwarzkümmelöl rendered `40 ml täglich`, `12 Tage`, and `28,48 €/Mo`.
  - `/wissen` rendered the new headline, search field, tag cloud, and filtered
   results for `magnesium`.

## 2026-05-11 Admin Dashboard Owner Comments Preview Deployed

- Scope:
  - Owner comments from live `/administrator/dashboard` implemented on branch
    `codex/website-ux-fixes`.
  - Dashboard KPI labels/order changed to `Neuanmeldungen`, `Neue Stacks`,
    `Backlinks`, and `Abmeldungen`.
  - Added stack email send tracking, account deletion tracking, last-seen user
    activity, and consented referrer/pageview tracking for Google/external
    referrer metrics.
  - Katalog/Content module labels changed to `offene Freigaben`,
    `Ohne Affiliate-Link`, `Wirkstoffe ohne Artikel`, and `Deadlinks`.
  - Product filters now support `Nick-Partnerlink` and `User-Partnerlink`
    across legacy product fields and active `product_shop_links`.
- Remote D1 migrations:
  - Applied `0076_admin_dashboard_tracking.sql` to
    `supplementstack-production`.
- Validation:
  - `node scripts/admin-qa-regression-check.mjs` passed.
  - `npx tsc -p tsconfig.json --noEmit` from `functions/` passed.
  - `npx tsc --noEmit` from `frontend/` passed.
  - `npm run lint --if-present` from `frontend/` passed.
  - `npm test -- --run` from `frontend/` passed, 12 tests.
  - `npm run build` from `frontend/` passed.
  - `git diff --check` passed with CRLF warnings only.
- Deploy prep:
  - Built `frontend/dist`.
  - Copied `functions/` to `frontend/dist/functions`.
  - Verified `frontend/dist/functions/api/[[path]].ts` exists.
  - Copied `frontend/dist` into stable temp snapshot before Wrangler upload.
- Deploy command:
  - `. .\scripts\use-supplementstack-cloudflare.local.ps1; npx wrangler pages deploy <snapshot> --project-name supplementstack --branch codex-website-ux-fixes --commit-dirty=true`
- Preview URL:
  - `https://8f774ddf.supplementstack.pages.dev`
- Branch alias:
  - `https://codex-website-ux-fixes.supplementstack.pages.dev`
- Remote postflight:
  - `wrangler d1 migrations list supplementstack-production --remote` reported
    no pending migrations.
  - Preview `/` returned 200.
  - Preview `/api/products` returned 200.
  - Preview unauthenticated `/api/admin/stats` returned 401.
  - Preview `POST /api/analytics/pageview` returned 200.

## 2026-05-11 Admin Dashboard Owner Comments Production Deployed

- Scope:
  - Same verified dashboard metrics build from commit
    `204b51a Update admin dashboard metrics`.
  - Owner requested direct Cloudflare production deploys under
    `https://supplementstack.de` now and in future.
- Remote D1 migrations:
  - `wrangler d1 migrations list supplementstack-production --remote` reported
    no migrations to apply; `0076_admin_dashboard_tracking.sql` was already
    applied before the preview deploy.
- Validation before production deploy:
  - `npm run build` from `frontend/` passed.
- Deploy prep:
  - Built `frontend/dist`.
  - Copied `functions/` to `frontend/dist/functions`.
  - Verified `frontend/dist/functions/api/[[path]].ts` exists.
  - Copied `frontend/dist` into stable temp snapshot before Wrangler upload.
- Deploy command:
  - `. .\scripts\use-supplementstack-cloudflare.local.ps1; npx wrangler pages deploy <snapshot> --project-name supplementstack --branch main --commit-dirty=true`
- Production deployment URL:
  - `https://15debffb.supplementstack.pages.dev`
- Live domain:
  - `https://supplementstack.de`
- Live postflight:
  - Live `/` returned 200.
  - Live `/api/products` returned 200.
  - Live unauthenticated `/api/admin/stats` returned 401.
  - Live `POST /api/analytics/pageview` returned 200.

## 2026-05-11 Phase 1 Referral Attribution Production Deployed

- Scope:
  - Implemented free first-party referral attribution for the admin dashboard.
  - Added local visitor id and first/last source state in frontend analytics.
  - Added `visitor_id` storage to pageview events.
  - Added `signup_attribution` writes during registration.
  - Added `referral_sources` to `/api/admin/stats`.
  - Added `Quellen & Anmeldungen` module to `/administrator/dashboard`.
- Remote D1 migrations:
  - Applied `0077_signup_referral_attribution.sql` to
    `supplementstack-production`.
- Validation:
  - `node scripts/admin-qa-regression-check.mjs` passed.
  - `npx tsc -p tsconfig.json --noEmit` from `functions/` passed.
  - `npx tsc --noEmit` from `frontend/` passed.
  - `npm run lint --if-present` from `frontend/` passed.
  - `npm test -- --run` from `frontend/` passed, 12 tests.
  - `npm run build` from `frontend/` passed.
  - `git diff --check` passed with CRLF warnings only.
- Deploy prep:
  - Built `frontend/dist`.
  - Copied `functions/` to `frontend/dist/functions`.
  - Verified `frontend/dist/functions/api/[[path]].ts` exists.
  - Copied `frontend/dist` into stable temp snapshot before Wrangler upload.
- Deploy command:
  - `. .\scripts\use-supplementstack-cloudflare.local.ps1; npx wrangler pages deploy <snapshot> --project-name supplementstack --branch main --commit-dirty=true`
- Production deployment URL:
  - `https://e345663e.supplementstack.pages.dev`
- Live domain:
  - `https://supplementstack.de`
- Live postflight:
  - Live `/` returned 200.
  - Live `/api/products` returned 200.
  - Live unauthenticated `/api/admin/stats` returned 401.
  - Live `POST /api/analytics/pageview` returned 200.
  - Remote D1 confirmed test pageview attribution:
    `visitor_id = ssv-postflight`, `referrer_host = example-blog.de`.
