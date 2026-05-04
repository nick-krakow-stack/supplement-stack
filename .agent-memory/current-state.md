# Current State

Last updated: 2026-05-04

## Project

Supplement Stack is a Cloudflare-native supplement management app.

- Frontend: React, Vite, TypeScript, Tailwind CSS.
- Backend: Cloudflare Pages Functions with Hono.
- Database: Cloudflare D1.
- Storage: Cloudflare R2 for product images.
- KV: rate limiting / cache-related bindings.
- Deployment: Wrangler CLI preferred, GitHub Actions as fallback.

## Active Source Of Truth

Use these files and directories for production-like development:

- `functions/api/[[path]].ts`
- `functions/api/modules/*`
- `functions/api/lib/*`
- `frontend/src/*`
- `d1-migrations/*`
- `wrangler.toml`

Recently refreshed docs for the Cloudflare line:

- `README.md`
- `DEPLOYMENT.md`
- `docs/implementation-status.md`
- `docs/agent-planner.md`

Treat parts of `.claude/SESSION.md` and older scaffold-era notes as historical
unless verified against code.

## Current Phase

Phase B is complete. Phase C is complete. Phase D bundle is committed,
remote-migrated, and deployed to Cloudflare Pages preview.

Product required package metadata hardening is committed, remote-migrated, and
live:

- Code commit: `52ead1f` - Data: Require complete product package metadata.
- Remote D1 migration
  `d1-migrations/0037_backfill_product_required_metadata.sql` was applied to
  `supplementstack-production`.
- Remote D1 control query for legacy products 1-21 returned
  `missing_count = 0` for missing required fields: brand, serving size/unit,
  servings per container, container count, and main ingredient quantity/unit.
- Live `/api/demo/products` returned HTTP 200 from the remote database and
  shows the backfilled data, e.g. `Vitamin D3/K2 Tropfen` with brand
  `Supplement Stack Demo`, `serving_size=1`, `serving_unit=Tropfen`, and
  `servings_per_container=30`.
- The committed API/frontend validation changes from `52ead1f` rode along with
  the Profile DSGVO deploy on 2026-05-04. Preview:
  `https://16edb9e2.supplementstack.pages.dev`; build assets:
  `index-Dkeio0yL.js` / `index-RAoQ0gyV.css`.
- Both the product metadata code validation and the backfilled data are live.
- Checks before commit passed: frontend `npm run lint --if-present`, frontend
  `npm run build`, functions `npx tsc -p tsconfig.json`, and
  `git diff --check` with CRLF warnings only.
- Later product-model follow-up: user products need real ingredient mapping or
  separate handling in ingredient-specific product selection.

Production custom domain `supplementstack.de` is live in parallel to the
Cloudflare Pages preview URLs. All recent deploys have been published to both
the subdomain and live domain. Public SEO indexing is intentionally deferred
until legal/compliance is cleared.

Stack-warnings N+1 is fixed, committed, and deployed:

- Commit: `5905a20` - Fix: Batch stack warning interaction lookup.
- `GET /api/stack-warnings/:id` in `functions/api/modules/stacks.ts` no longer
  runs an O(n^2) pair loop with one query per ingredient pair.
- It now returns `{ warnings: [] }` immediately for stacks with 0 or 1
  ingredient id, and otherwise uses one SQL query with dynamic `IN (...)`
  placeholders for both `ingredient_a_id` and `ingredient_b_id`.
- Auth, ownership, 404, and 403 semantics are unchanged.
- Checks passed: `npx tsc -p tsconfig.json` in `functions`; `git diff --check`
  with only CRLF warnings; `npm run build` in `frontend`.
- Deploy command: `. .\scripts\use-supplementstack-cloudflare.local.ps1; npx wrangler pages deploy frontend/dist --project-name supplementstack`.
- Preview URL: `https://1c23aea8.supplementstack.pages.dev`.
- Preview root returned HTTP 200 with assets `index-Dkeio0yL.js` /
  `index-RAoQ0gyV.css`; preview unauth `/api/stack-warnings/1` returned HTTP
  401; live `https://supplementstack.de/api/stack-warnings/1` returned HTTP
  401.
- Wrangler warned about a dirty worktree because `.claude/SESSION.md` and
  `.claude/settings.json` were dirty; expected and not part of deploy.

Phase C Priority 1 (Hono module split), Priority 2 (public dose recommendations API), Priority 3 (admin audit logging), and Priority 4 (server-side unit conversion) are committed and deployed.
Phase C tech-debt sweep complete (commit b866c3d).
Phase C is complete.
Demo product loading fix is committed and deployed to Cloudflare Pages preview.
D3 recommendations / product modal loading fix is committed and deployed to Cloudflare Pages preview.
Preview search API-base fix is committed and deployed to Cloudflare Pages preview: production builds use same-origin `/api` by default, while Vite dev on localhost can still use `VITE_API_BASE_URL`.
Affiliate disclosure cleanup is committed and deployed to Cloudflare Pages preview: product cards no longer show the visible Affiliate badge; the general affiliate disclosure lives in the footer disclaimer.
Admin translations MVP for `ingredient_translations` is committed and deployed to Cloudflare Pages preview.
Admin translations expansion for Ingredients, Dose Recommendations, Verified
Profiles, and Blog Posts is committed and deployed to Cloudflare Pages preview.
Root documentation cleanup is committed: README, DEPLOYMENT, implementation status, and agent planner now describe the Cloudflare-native line and point old backend/SQLite references to legacy context.
D1 backup workflow is verified: GitHub Actions D1 backup has run successfully both manually and automatically, and token scopes are confirmed. Backup verification is no longer an open next step.
CI has been refreshed for the Cloudflare line. Local lint/test/build are green. Frontend test tooling now tolerates an empty suite via Vitest `--passWithNoTests`, while still running and failing real tests normally.
Worktree cleanup is committed in `216e2df`: `_research_raw/01_fat_soluble_vitamins.json` and `_research_raw/02_b_vitamins_vitamin_c.json` are tracked as migration 0006 source material, and local `.claude/commands/` files are ignored without deleting them.
Memory update `cebd31a` recorded the production custom-domain state. The domain
itself is no longer a promotion/verification next step; only SEO/indexing stays
gated.
Recent UX work is committed and deployed. `e8f2bbc` auto-focuses the name
field when opening the user product add modal, `078fc31` auto-focuses the
product search field in the add-product modal for Demo and Stack Workspace
flows, and `8fb5431` ships the targeted User/Demo/Search/Stack UX fixes plus
the targeted Admin UX fixes.
Planning constraint: launch remains DE-only, but i18n/localization must be
planned as locale + country + guideline-set support, not text translation only.
German/DGE/D-A-CH is the DE default; other countries need configurable rule and
source sets, e.g. USA must not inherit DGE/D-A-CH by default.
Auth planning constraint: Google OAuth is a later standalone task. Apple Login
is omitted for now. Amazon Login may be evaluated later but is not a launch
blocker. Health Consent remains mandatory with OAuth; OAuth only replaces the
password login path and does not bypass consent, profile, recommendation, or
guideline logic. Existing backend stubs and `google_id` are not a complete
provider identity/callback/user-linking design.

Targeted user/demo/admin usability fixes are committed and deployed in
`8fb5431` (`UX: Improve stack and admin usability flows`) and verified on
Cloudflare Pages preview plus the live custom domain. The fixes cover
SearchPage stack persistence/removal behavior, auth redirects to `/stacks`,
StackWorkspace duplicate/empty/mail states, SearchBar no-results behavior,
Modal2 retry without full reload, Wishlist empty CTA routing, Modal3 temporary
Demo copy, admin stats product-key fallbacks, direct Nick-affiliate toggle
persistence with rollback on failure, clear Nick-affiliate vs shop/user-link
labeling, admin-product loading for recommendation prep, user-product
moderation error handling, 404s for no-row moderation actions, and small mobile
touch improvements.

Launch QA flow blockers are fixed, committed, and deployed.

- Commit: `fcb1a6b` - Fix: Close launch QA flow blockers.
- Preview URL: `https://ae0fa762.supplementstack.pages.dev`.
- Build assets: JS `index-Hw7gzAwb.js`, CSS `index-DWw_l_3p.css`.
- Local checks passed: `npm run lint --if-present`,
  `npm run test --if-present -- --run` with no test files via
  `--passWithNoTests`, and `npm run build` in `frontend/`;
  `npx tsc -p tsconfig.json` in `functions/`; `git diff --check` only CRLF
  warnings.
- Preview/live smoke checks passed: root HTTP 200; D3 search HTTP 200;
  `/api/ingredients/1/products` HTTP 200 with approved/public D3 products;
  `/api/ingredients/1/recommendations` HTTP 200 with 4 dose recommendations;
  `/api/shop-domains` HTTP 200 with `{ shops }`; `/api/demo/products`
  HTTP 200; unauthenticated `/api/stack-warnings/1` HTTP 401;
  unauthenticated `/api/admin/translations/ingredients` HTTP 401;
  unauthenticated `/api/user-products` HTTP 401.
- Wrangler warned about uncommitted changes because memory files and
  `.claude/SESSION.md` were dirty; expected.

Step 1 status: code-level QA blockers are fixed and deployed. Browser-level
authenticated QA remains manual validation, not an implementation blocker.
Registration was tested successfully before rate limiting kicked in, but a
final fresh registration smoke after deploy was not completed because
`/auth/register` returned 429 after repeated QA attempts.

Mobile-first polish round 1 is committed and deployed:

- Commit: `c76bcf4` - UX: Improve mobile core flows.
- Preview URL: `https://d5b331fd.supplementstack.pages.dev`.
- Live domain `https://supplementstack.de/` returned HTTP 200 after deploy
  with new build assets JS `assets/index-Bl-g6o41.js` and CSS
  `assets/index-Cf3yP80d.css`.
- Local checks passed: `npm run lint --if-present` in `frontend/`,
  `npm run build` in `frontend/`, and `git diff --check` with only LF/CRLF
  warnings.
- Functions were not changed, so no Functions TypeScript compile was run.
- Browser/device QA at 375px, 390px, and 430px remains the next validation
  step for demo, logged-in, and admin flows.

Scope was frontend-only and targeted 375px-430px ergonomics:

- `frontend/src/styles.css`
- `frontend/src/components/Layout.tsx`
- `frontend/src/components/ProductCard.tsx`
- `frontend/src/components/modals/ModalWrapper.tsx`
- `frontend/src/components/modals/Modal2Products.tsx`
- `frontend/src/components/modals/Modal3Dosage.tsx`
- `frontend/src/components/modals/UserProductForm.tsx`
- `frontend/src/pages/SearchPage.tsx`
- `frontend/src/pages/MyProductsPage.tsx`

Implemented: responsive header/nav, product cards, SearchPage stack footer and
chips, modal bottom sheets and touch targets, product selection modal, dosage
modal, user product form, My Products mobile rows, StackWorkspace toolbar and
bottom bar wrapping, 44px touch targets for key controls, safe-area modal
padding, product modal rows that stack below 431px, dosage footer and portion
controls with touch-sized buttons, SearchPage fixed footer/chips/remove
controls hardened for narrow screens, MyProducts rows/form actions stacked on
xs screens, and Layout mobile nav/email/menu touch improvements.

P1 z-index/footer collision is fixed via `ModalWrapper` `z-[60]` plus hiding
the SearchPage footer while a modal is open.

Last relevant commits on `main`:

- `5905a20` - Fix: Batch stack warning interaction lookup.
- `52ead1f` - Data: Require complete product package metadata.
- `1df7616` - Memory: Record robots.txt deploy and Top-7 sprint status.
- `1d8b288` - Fix: Disallow search crawlers by name in robots.txt.
- `70aa1f9` - Fix: Add robots.txt blocking all indexing pre-launch.
- `1126d15` - Memory: Record register data-persistence deploy.
- `e832263` - Fix: Persist age, gender, guideline_source on register.
- `081af3d` - Memory: Record live-domain CORS + FRONTEND_URL deploy.
- `283cbc8` - Fix: Switch FRONTEND_URL and CORS allowlist to live domain.
- `c76bcf4` - UX: Improve mobile core flows.
- `fcb1a6b` - Fix: Close launch QA flow blockers.
- `8fb5431` - UX: Improve stack and admin usability flows.
- `078fc31` - UX: Auto-focus search field in 'Produkt hinzufuegen' modal (Demo + Stack-Workspace).
- `e8f2bbc` - UX: Auto-focus name field when opening 'Produkt hinzufuegen' modal.
- `cebd31a` - Memory: Production domain live, reorganize next-steps (superseded by current usability-first next steps and i18n planning constraint).
- `216e2df` - Ops: Track research sources and ignore local Claude commands.
- `f3fa88c` - Memory: Record admin translations expansion deploy.
- `49ed83e` - Feature: Expand admin translation management (admin translation GET/PUT routes and UI for Ingredients, Dose Recommendations, Verified Profiles, and Blog Posts).
- `862ed57` - Feature: Phase D product recommendations and translations (migration 0036, admin translations MVP, Cloudflare-line CI/docs, lockfiles, local setup scripts).
- `965d4e4` - Fix: Move affiliate disclosure to footer (removed visible product-card Affiliate badge; generalized footer affiliate note).
- `b5dba6e` - Fix: Use same-origin API in deployed frontend (central API base helper, same-origin `/api` for production builds, local dev override only on localhost).
- `2f4248b` - Fix: Restore demo product loading (`GET /api/demo/products`, frontend API-base consistency for SearchBar/SearchPage).
- `9107e2e` - Fix: Stabilize dosage and product modal data loading (source-tab dosage dedupe, resilient product modal recommendation loading, flat product ingredient metadata, product `is_main` from ingredient join).
- `b866c3d` - Refactor + Ops: Tech-Debt-Cleanup nach Phase C (normalizeComparableUnit removed, IngredientRow extended, pages_build_output_dir added, next-steps reorganized).
- `11440f5` - Feature: Server-side Unit-Konvertierung — IU/µg/mg/g für Upper-Limit-Vergleich.
- `4482a5f` - Feature: Admin Audit Logging — alle Mutationen in admin_audit_log.
- `dd58ba2` - Feature: Add dose recommendations API (`GET /api/ingredients/:id/recommendations` from `dose_recommendations`).
- `b1fd347` - Refactor: Split Pages API into Hono modules (`functions/api/[[path]].ts` is now a composer; modules under `functions/api/modules/*`, helpers under `functions/api/lib/*`).
- `2ca9382` - Ops: Shared agent memory and auto-handoff workflow (`AGENTS.md`, `.agent-memory/*`, `scripts/update-agent-handoff.ps1`, `.claude/settings.json`, `.claude/memory.md` as pointer).
- `9a5f523` - DB: Phase B abgeschlossen, migrations 0028-0035, `dosage_guidelines` migrated to `dose_recommendations`.

## Latest Deployed Work

Stack-warnings batched interaction lookup is committed and deployed:

- Commit: `5905a20` - Fix: Batch stack warning interaction lookup.
- Deploy command: `. .\scripts\use-supplementstack-cloudflare.local.ps1; npx wrangler pages deploy frontend/dist --project-name supplementstack`
- Preview URL: `https://1c23aea8.supplementstack.pages.dev`
- Build assets: JS `index-Dkeio0yL.js`, CSS `index-RAoQ0gyV.css`.
- Local checks passed: functions TypeScript compile, frontend build, and
  `git diff --check` with only CRLF warnings.
- Smoke checks passed: preview root HTTP 200; preview unauthenticated
  `/api/stack-warnings/1` HTTP 401; live unauthenticated
  `/api/stack-warnings/1` HTTP 401.
- Browser/mobile QA and legal/compliance review remain open.

Launch QA flow blockers are committed and deployed:

- Commit: `fcb1a6b` - Fix: Close launch QA flow blockers.
- Deploy command: `. .\scripts\use-supplementstack-cloudflare.local.ps1; npx wrangler pages deploy frontend/dist --project-name supplementstack`
- Preview URL: `https://ae0fa762.supplementstack.pages.dev`
- Build assets: JS `index-Hw7gzAwb.js`, CSS `index-DWw_l_3p.css`.
- Local checks passed: frontend lint, frontend test with no test files via
  `--passWithNoTests`, frontend build, functions TypeScript compile, and
  `git diff --check` with only CRLF warnings.
- Smoke checks passed on preview/live: root HTTP 200; D3 search HTTP 200;
  approved/public ingredient products; dose recommendations; shop domains;
  demo products; unauthenticated stack warnings, admin translations, and
  user-products return HTTP 401.
- Fresh registration post-deploy remains a follow-up because rate limiting
  returned 429 after repeated QA attempts.

Targeted User/Demo/Search/Stack UX fixes and Admin UX fixes are also committed
and deployed:

- Commit: `8fb5431` - UX: Improve stack and admin usability flows.
- Local checks passed: `npm run lint --if-present` in `frontend/`;
  `npm run test --if-present -- --run` in `frontend/` with
  `--passWithNoTests`; `npm run build` in `frontend/`;
  `npx tsc -p tsconfig.json` in `functions/`; `git diff --check` without
  whitespace errors, only CRLF warnings.
- Deploy prep: `npm run build` in `frontend/`; functions copied to
  `frontend/dist/functions`; `frontend/dist/functions/api/[[path]].ts`
  verified with `Test-Path -LiteralPath`.
- Deploy command: `. .\scripts\use-supplementstack-cloudflare.local.ps1; npx wrangler pages deploy frontend/dist --project-name supplementstack`
- Preview URL: `https://2b00223a.supplementstack.pages.dev`
- Smoke checks passed: preview root HTTP 200 with JS `index-D8jGeaah.js`, CSS
  `index-DWw_l_3p.css`, and `x-robots-tag: noindex`; preview
  `/api/ingredients/search?q=d3` HTTP 200 with Vitamin D3; preview
  `/api/admin/translations/ingredients` HTTP 401, not 404; preview
  `/api/ingredients/1/recommendations` HTTP 200 with 4 rows; live root
  `https://supplementstack.de/` HTTP 200 with the same JS/CSS asset names; live
  D3 search HTTP 200; live admin translations unauth HTTP 401, not 404.
- Wrangler warned that uncommitted changes existed. That was expected because
  memory files and `.claude/SESSION.md` were dirty while the code commit itself
  was committed.

## Previous Deployed Work

Admin translations expansion is committed and deployed to Cloudflare Pages
preview:

- Commit: `49ed83e` - Feature: Expand admin translation management.
- No D1 migration was needed.
- Deployed preview: `https://14cf1dba.supplementstack.pages.dev`.
- Smoke checks passed: root HTTP 200; unauthenticated
  `/api/admin/translations/ingredients`,
  `/api/admin/translations/dose-recommendations`,
  `/api/admin/translations/verified-profiles`, and
  `/api/admin/translations/blog-posts` returned HTTP 401, not 404;
  `/api/ingredients/search?q=d3` returned HTTP 200.

Phase D product recommendations and translations are committed, remote-migrated,
and deployed to Cloudflare Pages preview:

- Commit: `862ed57` - Feature: Phase D product recommendations and translations.
- Remote D1: `0036_rename_recommendations_to_product_recommendations.sql`
  applied successfully after repairing the remote `d1_migrations` journal for
  already-live 0026-0035 migrations.
- Remote schema now has `product_recommendations` as table plus temporary
  `recommendations` view and `recommendations_insert`/`recommendations_delete`
  triggers for deploy compatibility.
- Deployed preview: `https://66a9ee27.supplementstack.pages.dev`.
- Smoke checks passed: root HTTP 200; `/api/recommendations?ingredient_id=1`
  HTTP 200; `/api/ingredients/1/recommendations` HTTP 200;
  `/api/ingredients/search?q=d3` HTTP 200; `/api/products/1` HTTP 200;
  unauthenticated `/api/admin/translations/ingredients` returned 401, not 404.

Admin Translations extension is now committed and deployed. Public i18n playback
was not changed.

- Backend: `functions/api/modules/admin.ts` now also serves admin-only GET/PUT
  routes for `dose_recommendation_translations`,
  `verified_profile_translations`, and `blog_translations`.
- Dose recommendation translation upsert validates the source
  `dose_recommendations` row, stores optional `source_label`, `timing`, and
  `context_note` with empty strings normalized to `NULL`, and audits
  `upsert_dose_recommendation_translation` as
  `dose_recommendation_translation`.
- Verified profile translation upsert validates the source
  `verified_profiles` row, stores optional `bio` and `credentials` with empty
  strings normalized to `NULL`, and audits
  `upsert_verified_profile_translation` as `verified_profile_translation`.
- Blog translation upsert validates the source `blog_posts` row, requires
  `title` and normalized lowercase `slug`, validates slug format, returns a
  409 for per-language slug conflicts, and audits `upsert_blog_translation` as
  `blog_translation`.
- Frontend: `frontend/src/pages/admin/TranslationsTab.tsx` now has an entity
  selector for Ingredients, Dose Recommendations, Verified Profiles, and Blog
  Posts while preserving the existing Ingredient editor behavior.
- Frontend: `frontend/src/pages/admin/TranslationsTab.tsx` now guards
  `loadTranslations()` with AbortController plus a monotonic request id so stale
  entity/language/search responses cannot overwrite rows, drafts, loading,
  saved state, or errors.
- Frontend: `frontend/.eslintignore` was added so local generated
  `frontend/dist/` output is not linted by `npm run lint --if-present`.
- Local checks passed: `npm run lint --if-present`,
  `npm run test --if-present -- --run`, and `npm run build` in `frontend/`;
  `npx tsc -p tsconfig.json` in `functions/`.

D1 backup workflow remains verified: GitHub Actions backup has run manually and
automatically, token scopes are confirmed, and backup verification is not an
open next step.

Product recommendations rename is deployed:

- Migration `d1-migrations/0036_rename_recommendations_to_product_recommendations.sql` renames `recommendations` to `product_recommendations`.
- Migration 0036 recreates indexes under the new table name.
- Migration 0036 leaves a temporary `recommendations` compatibility view plus `INSTEAD OF INSERT` and `INSTEAD OF DELETE` triggers for the deploy window.
- The public `/api/recommendations` route remains the compatibility API name; code now targets `product_recommendations` where the database table is referenced.
- Safe deploy runbook was followed: remote D1 migration 0036 first, then Cloudflare Pages code deploy. The temporary view/triggers allow old live code to keep working during the migration/deploy window.

CI/test tooling is committed:

- `.github/workflows/ci.yml` now checks the Cloudflare line: Functions TypeScript compile plus frontend lint, test, build, and build-output verification.
- `frontend/package.json` test script runs `vitest --passWithNoTests`.
- Local Vitest is `0.34.6` and supports `--passWithNoTests`.
- Local checks are green: frontend lint, frontend test, frontend build, and functions TypeScript compile.

Admin translations MVP for ingredients is committed and deployed:

- Backend: `functions/api/modules/admin.ts` now serves `GET /api/admin/translations/ingredients` and `PUT /api/admin/translations/ingredients/:ingredientId/:language`.
- The GET route lists ingredients with a LEFT JOIN on `ingredient_translations`, normalizes/validates language, supports `q`, `limit`, and `offset`, and returns `missing`/`translated` status.
- The PUT route validates admin auth, ingredient existence, language, required `name`, optional text fields, upserts `ingredient_translations`, and logs `upsert_ingredient_translation` with entity `ingredient_translation`.
- Frontend: `frontend/src/components/AdminLayout.tsx` and `frontend/src/pages/AdminPage.tsx` expose the new `translations` tab.
- Frontend: `frontend/src/pages/admin/TranslationsTab.tsx` is a new focused component for language selection, search, editable ingredient translation fields, save state, loading, errors, and MVP scope notice.
- Validation passed locally: `npm run build` in `frontend/`; `npx tsc -p tsconfig.json` in `functions/`.

D1 backup workflow status:

- Workflow configuration was checked against `wrangler.toml`; the configured D1 database name is `supplementstack-production`.
- GitHub Actions D1 backup was successfully executed manually and automatically.
- Token scopes for the backup workflow are verified.
- Previous local CLI dispatch limitations are historical only; backup verification is complete and no longer an open task.

## Phase B Result

Production D1 migrations 0026-0035 are considered live according to the previous memory:

- `0026`: `populations` lookup with 5 seed rows.
- `0027`: `dose_recommendations`.
- `0028`: `verified_profiles`.
- `0029`: `admin_audit_log`.
- `0030`: translation tables.
- `0031`: `blog_posts`.
- `0032`: `share_links`.
- `0033`: `api_tokens`.
- `0034`: rebuilt `interactions` and added `ingredients.preferred_unit`.
- `0035`: migrated 136 of 136 rows from old `dosage_guidelines` to `dose_recommendations`; old table renamed to `dosage_guidelines_legacy`.

## Current Code Shape

- Frontend routes and pages are already present: landing, demo, search, stacks, wishlist, admin, auth, profile, user products, forgot/reset password.
- Frontend API base is centralized in `frontend/src/api/base.ts`: production builds use same-origin `/api`; only Vite dev on localhost/127.0.0.1/::1 may use `VITE_API_BASE_URL`.
- `functions/api/[[path]].ts` is now a Hono composition root with CORS setup and `app.route(...)` mounts for auth/me, ingredients/recommendations, products/r2, admin/shop-domains/interactions, stacks/stack-warnings, wishlist, user-products, and demo.
- Business logic has moved out of the entry point into modules under `functions/api/modules/*`.
- `functions/api/modules/user-products.ts` and `functions/api/modules/demo.ts` were added from the previous monolith behavior.
- `GET /api/ingredients/:id/recommendations` now reads active public rows from `dose_recommendations`, joins `populations`, optionally joins `verified_profiles`, `dose_recommendation_translations`, and `verified_profile_translations`, and returns upper-limit comparison metadata.
- Product-to-ingredient recommendation links target `product_recommendations`;
  migration 0036 keeps a temporary `recommendations` view/triggers for deploy
  compatibility. The public `/api/recommendations` route name remains.
- `GET /api/stack-warnings/:id` now keeps the existing auth/ownership
  behaviour and fetches all matching interaction warnings through one batched
  SQL `IN (...)` lookup instead of an O(n^2) per-pair query loop.

## Agent Workflow

- Shared memory lives in `.agent-memory/*`.
- `AGENTS.md` is the generic startup protocol for Codex and future agents.
- `CLAUDE.md` starts with the same startup protocol so Claude Code sees it immediately.
- `.claude/memory.md` is only a pointer to `.agent-memory/*`.
- `scripts/update-agent-handoff.ps1` updates `.agent-memory/handoff.md` without using model tokens.
- `.claude/settings.json` wires that script into Claude Code `PreCompact` and `PostToolUse` for Bash.

## Git / Workspace Notes

`functions/api/lib/*` and `functions/api/modules/*` are tracked.

Remaining notable local paths typically include:

- `.wrangler/`, `frontend/dist/`, `frontend/node_modules/`, `functions/node_modules/` (build/cache, gitignored or ignorable).
- `_research_raw/*` may contain future research source data. Files 01/02/03 are already tracked; review any new research files before committing.
- `.claude/SESSION.md`, `.claude/commands/` (legacy Claude session log, see `.claude/SESSION.md` header).
- `frontend/dist/` may be present from the latest build/deploy prep and is not committed.
- Phase D source files, docs, lockfiles, and generic setup scripts are committed in `862ed57`.

`.agent-memory/handoff.md` is regenerated on every PreCompact and after every Bash tool use by `scripts/update-agent-handoff.ps1`. Treat it as a transient snapshot — never store unique information only there.

Do not assume untracked files are disposable. Review before deleting or committing.
