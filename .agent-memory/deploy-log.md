# Deploy Log

Last updated: 2026-05-01

## Latest Known Production State

Phase B database migrations 0026-0035 are live in production D1.
Phase C backend refactor + new dose recommendations API are deployed to Cloudflare Pages.
Demo product loading fix is deployed to Cloudflare Pages preview.
D3 recommendations / product modal data loading fix is deployed to Cloudflare Pages preview.
Preview search API-base fix is deployed to Cloudflare Pages preview.

Latest relevant commits:

- `b5dba6e` - Fix: Use same-origin API in deployed frontend.
- `2f4248b` - Fix: Restore demo product loading.
- `9107e2e` - Fix: Stabilize dosage and product modal data loading.
- `dd58ba2` - Feature: Add dose recommendations API.
- `b1fd347` - Refactor: Split Pages API into Hono modules.
- `9a5f523` - DB: Phase B complete (migrations 0028-0035).

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

## Phase C — Tech-Debt Cleanup

### 2026-04-30 - Cloudflare Pages: Tech-Debt-Cleanup nach Phase C

- Commit: `b866c3d` - Refactor + Ops: Tech-Debt-Cleanup nach Phase C.
- Items: normalizeComparableUnit removed (replaced by normalizeUnit from lib/units.ts); IngredientRow extended with upper_limit/upper_limit_unit/preferred_unit; pages_build_output_dir added to wrangler.toml; next-steps.md reorganized.
- Build: `npx tsc -p tsconfig.json` from `functions/` passed (no errors); `npm run build` from `frontend/` passed (1.45s, 0 errors).
- Command: `npx wrangler pages deploy frontend/dist --project-name supplementstack` (with CF env vars loaded).
- Preview URL: `https://c0f45f5b.supplementstack.pages.dev`
- pages_build_output_dir warning: no "config ignored" warning appeared in deploy output — resolved.
- Smoke test: build and deploy verified; endpoint functional check skipped (no admin JWT in session).

## Phase C Deploys

### 2026-04-30 - Cloudflare Pages: server-side unit conversion

- Commit: `11440f5` - Feature: Server-side Unit-Konvertierung — IU/µg/mg/g für Upper-Limit-Vergleich.
- New `functions/api/lib/units.ts`: `normalizeUnit()`, `convertAmount()` with IU↔µg/mg/g support for Vitamin D, A, E; pure mass conversion µg↔mg↔g generic.
- Integrated into `GET /api/ingredients/:id/recommendations`: cross-unit upper-limit comparison now attempted; `amount_converted_to_upper_limit_unit` field added to response when conversion was performed.
- Build: `npx tsc -p tsconfig.json` from `functions/` passed (no errors); `npm run build` from `frontend/` passed (1.43s, 0 errors).
- Command: `npx wrangler pages deploy frontend/dist --project-name supplementstack` (with CF env vars loaded).
- Preview URL: `https://292a8010.supplementstack.pages.dev`
- HTTP status check: not verified (no admin JWT in this session).
- Smoke test: skipped (no local D1 with mixed-unit rows available).

### 2026-04-29 - Cloudflare Pages: admin audit logging

- Commit: `4482a5f` - Feature: Admin Audit Logging — alle Mutationen in admin_audit_log.
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

- D1 backup workflow has been triggered both manually and automatically. Token scopes verified.
- Consider adding `pages_build_output_dir = "frontend/dist"` to `wrangler.toml` in a separate scoped task so Pages deploys consume config directly.

When a future agent deploys or applies migrations, append the exact date, commit, command summary, and verification result here.
