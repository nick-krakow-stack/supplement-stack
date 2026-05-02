# Current State

Last updated: 2026-05-01

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

Phase B is complete. Phase C is complete. Phase D bundle is implemented and checked locally, but not committed, remote-migrated, or deployed.

Phase C Priority 1 (Hono module split), Priority 2 (public dose recommendations API), Priority 3 (admin audit logging), and Priority 4 (server-side unit conversion) are committed and deployed.
Phase C tech-debt sweep complete (commit b866c3d).
Phase C is complete.
Demo product loading fix is committed and deployed to Cloudflare Pages preview.
D3 recommendations / product modal loading fix is committed and deployed to Cloudflare Pages preview.
Preview search API-base fix is committed and deployed to Cloudflare Pages preview: production builds use same-origin `/api` by default, while Vite dev on localhost can still use `VITE_API_BASE_URL`.
Affiliate disclosure cleanup is committed and deployed to Cloudflare Pages preview: product cards no longer show the visible Affiliate badge; the general affiliate disclosure lives in the footer disclaimer.
Admin translations MVP for `ingredient_translations` is implemented locally but not committed or deployed.
Root documentation cleanup is complete locally but not committed/deployed: README, DEPLOYMENT, implementation status, and agent planner now describe the Cloudflare-native line and point old backend/SQLite references to legacy context.
D1 backup workflow was checked locally against `wrangler.toml`: workflow exports `supplementstack-production`, matching the configured D1 database name. Local GitHub Actions dispatch was blocked because `gh` is unavailable and no GitHub token env var is set. Web UI/API test instructions are documented in `DEPLOYMENT.md`.
CI has been refreshed for the Cloudflare line. Local lint/test/build are green. Frontend test tooling now tolerates an empty suite via Vitest `--passWithNoTests`, while still running and failing real tests normally.

Last relevant commits on `main`:

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

Frontend affiliate disclosure cleanup is committed and deployed to Cloudflare Pages preview:

- `frontend/src/components/ProductCard.tsx` no longer renders the visible `Affiliate` badge in product cards.
- `frontend/src/components/LegalDisclaimer.tsx` now uses a general affiliate footnote: some links may be affiliate links, commission may be earned, recommendations remain independent.
- Shop link / buy button behavior was left unchanged.
- Admin and edit surfaces were intentionally not changed; `is_affiliate` remains visible/editable there.
- Validation passed: `npm run build` in `frontend/`.
- Deploy prep passed: `frontend/dist/functions/api/[[path]].ts` was present before deploy.
- Deployed preview: `https://b4e4ea90.supplementstack.pages.dev`.
- Smoke checks passed: preview root HTTP 200; downloaded preview JS no longer contains the old ProductCard Affiliate badge class/text, while allowed affiliate strings remain in footer/admin/edit surfaces.

## Latest Local Work

Phase D bundle has been implemented and checked locally, but no commit, remote D1 migration, or deploy has been performed.

Product recommendations rename is implemented locally:

- Migration `d1-migrations/0036_rename_recommendations_to_product_recommendations.sql` renames `recommendations` to `product_recommendations`.
- Migration 0036 recreates indexes under the new table name.
- Migration 0036 leaves a temporary `recommendations` compatibility view plus `INSTEAD OF INSERT` and `INSTEAD OF DELETE` triggers for the deploy window.
- The public `/api/recommendations` route remains the compatibility API name; code now targets `product_recommendations` where the database table is referenced.
- Safe deploy runbook: apply remote D1 migration 0036 first, then deploy Cloudflare Pages code. The temporary view/triggers allow old live code to keep working during the migration/deploy window.

CI/test tooling is updated locally:

- `.github/workflows/ci.yml` now checks the Cloudflare line: Functions TypeScript compile plus frontend lint, test, build, and build-output verification.
- `frontend/package.json` test script runs `vitest --passWithNoTests`.
- Local Vitest is `0.34.6` and supports `--passWithNoTests`.
- Local checks are green: frontend lint, frontend test, frontend build, and functions TypeScript compile.
- No commit and no deploy were performed.

Admin translations MVP for ingredients has been implemented locally:

- Backend: `functions/api/modules/admin.ts` now serves `GET /api/admin/translations/ingredients` and `PUT /api/admin/translations/ingredients/:ingredientId/:language`.
- The GET route lists ingredients with a LEFT JOIN on `ingredient_translations`, normalizes/validates language, supports `q`, `limit`, and `offset`, and returns `missing`/`translated` status.
- The PUT route validates admin auth, ingredient existence, language, required `name`, optional text fields, upserts `ingredient_translations`, and logs `upsert_ingredient_translation` with entity `ingredient_translation`.
- Frontend: `frontend/src/components/AdminLayout.tsx` and `frontend/src/pages/AdminPage.tsx` expose the new `translations` tab.
- Frontend: `frontend/src/pages/admin/TranslationsTab.tsx` is a new focused component for language selection, search, editable ingredient translation fields, save state, loading, errors, and MVP scope notice.
- Validation passed locally: `npm run build` in `frontend/`; `npx tsc -p tsconfig.json` in `functions/`.
- No commit and no deploy were performed.

D1 backup workflow status:

- Workflow configuration was checked against `wrangler.toml`; the configured D1 database name is `supplementstack-production`.
- Web UI/API workflow dispatch remains externally open because local `gh` is unavailable and no GitHub token env var is set.

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
- Product-to-ingredient recommendation links are now implemented locally against `product_recommendations`; migration 0036 keeps a temporary `recommendations` view/triggers for deploy compatibility. The public `/api/recommendations` route name remains.

## Agent Workflow

- Shared memory lives in `.agent-memory/*`.
- `AGENTS.md` is the generic startup protocol for Codex and future agents.
- `CLAUDE.md` starts with the same startup protocol so Claude Code sees it immediately.
- `.claude/memory.md` is only a pointer to `.agent-memory/*`.
- `scripts/update-agent-handoff.ps1` updates `.agent-memory/handoff.md` without using model tokens.
- `.claude/settings.json` wires that script into Claude Code `PreCompact` and `PostToolUse` for Bash.

## Git / Workspace Notes

`functions/api/lib/*` and `functions/api/modules/*` are now tracked as part of `b1fd347`.

Remaining notable untracked or modified paths typically include:

- `.wrangler/`, `frontend/dist/`, `frontend/node_modules/`, `functions/node_modules/` (build/cache, gitignored or ignorable).
- `_research_raw/*` (research source data — review before committing).
- `docs/cloudflare-accounts.md`, `docs/codex-working-context.md` (project docs, untracked).
- `frontend/package-lock.json`, `functions/package-lock.json` (untracked lockfiles — decide whether to commit).
- `scripts/setup-local-dev.ps1`, `scripts/use-supplementstack-cloudflare.example.ps1` (local dev helpers, untracked).
- `.claude/SESSION.md`, `.claude/commands/` (legacy Claude session log, see `.claude/SESSION.md` header).
- Local Phase D bundle changes are present in docs, CI, frontend/admin UI, API modules, `frontend/package.json`, and `d1-migrations/0036_rename_recommendations_to_product_recommendations.sql`; they are not committed, remote-migrated, or deployed.

`.agent-memory/handoff.md` is regenerated on every PreCompact and after every Bash tool use by `scripts/update-agent-handoff.ps1`. Treat it as a transient snapshot — never store unique information only there.

Do not assume untracked files are disposable. Review before deleting or committing.
