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
- Latest documented admin cleanup preview:
  `https://6cd86fa0.supplementstack.pages.dev`.
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

- Current cleanup validation still needs to run after this local work:
  - functions TypeScript
  - frontend TypeScript
  - frontend lint/build
  - smoke-script syntax checks
- Authenticated owner browser QA remains the final acceptance gate for the new
  admin/user workflows.

## Known Remaining Work

- Final authenticated owner browser QA:
  - login/session persistence
  - stack create/edit/product add/remove/replacement
  - user product submit
  - Product Detail overview/moderation/affiliate/Wirkstoffe/image flows
  - Product-QA harmless save
  - product warnings
  - Dosing source links
  - Interaction edit/delete
  - Ingredient Research source/warning and NRV CRUD
  - one stale-version `409` check
- Continue ingredient-by-ingredient research and copywriting data entry through
  `/administrator/ingredients`.
- Content/science/legal review remains before SEO indexing/go-live confidence.
- External inbox mail tests remain before launch confidence.
