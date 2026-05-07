# Current State

Last updated: 2026-05-07

## Active Baseline

- Production-like line is the Cloudflare Pages/Workers line:
  - Backend: `functions/api/[[path]].ts`, `functions/api/modules/*`,
    `functions/api/lib/*`
  - Frontend: `frontend/src/*`
  - Database migrations: `d1-migrations/*`
  - Cloudflare config: `wrangler.toml` and `wrangler.maintenance.toml`
- Live domain: `https://supplementstack.de`.
- Latest documented deployed preview:
  `https://c07d6e4d.supplementstack.pages.dev`.
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
- Active admin routes include dashboard, health, interactions, products,
  product detail, ingredients, ingredient detail, dosing, user-products,
  audit-log, product-qa, link-reports, knowledge, launch-checks, translations,
  sub-ingredients, shop-domains, rankings, users, and settings.
- Admin pages use scoped shared UI/CSS in:
  - `frontend/src/pages/administrator/AdminUi.tsx`
  - `frontend/src/pages/administrator/admin.css`
- Backend admin code is still concentrated in
  `functions/api/modules/admin.ts`; splitting it by domain remains a later
  refactor candidate.

## Latest Completed Work

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
  - login/session persistence
  - stack create/edit/product add/remove/replacement
  - stack form selection for ingredients with forms
  - user product submit
  - Product Detail overview/moderation/affiliate/Wirkstoffe/image flows
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
