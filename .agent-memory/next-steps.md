# Next Steps

Last updated: 2026-05-02

## Completed And Deployed

- Phase D bundle:
  - Committed as `862ed57` - Feature: Phase D product recommendations and translations.
  - Remote D1 migration `0036_rename_recommendations_to_product_recommendations.sql` is applied on `supplementstack-production`.
  - Migration 0036 keeps a temporary `recommendations` compatibility view plus `INSTEAD OF INSERT` and `INSTEAD OF DELETE` triggers for old live code during the deploy window.
  - Admin translations MVP for `ingredient_translations` is deployed.
  - Root docs and implementation status are refreshed for the Cloudflare line and committed.
  - CI is refreshed for the Cloudflare line and committed.
  - Local checks are green: frontend lint, frontend test, frontend build, and functions TypeScript compile.
  - Preview deploy: `https://66a9ee27.supplementstack.pages.dev`.
  - Smoke checks passed for root, product recommendation API, dose recommendation API, D3 search, product 1, and admin translations auth routing.
  - GitHub Actions D1 backup has run successfully both manually and automatically; token scopes are verified.

- Frontend test tooling CI guard:
  - `frontend/package.json` test script now runs `vitest --passWithNoTests`.
  - `.github/workflows/ci.yml` frontend job calls `npm run test --if-present -- --run`, so the workflow inherits `--passWithNoTests` while no test files exist.
  - Check passed: `npm run test --if-present -- --run` in `frontend/` exits 0 when no test files exist.

- Admin translations MVP for `ingredient_translations`:
  - `GET /api/admin/translations/ingredients?language=de&q=&limit=50&offset=0`
  - `PUT /api/admin/translations/ingredients/:ingredientId/:language`
  - Admin `translations` tab with language selector, search, editable fields, save/loading/error/saved states, and explicit MVP note.
  - Checks passed: `npm run build` in `frontend/`; `npx tsc -p tsconfig.json` in `functions/`.
  - Public i18n playback remains out of scope.

## Completed Locally - Not Committed Or Deployed

- Admin translations have been extended beyond Ingredients:
  - `GET /api/admin/translations/dose-recommendations?language=de&q=&limit=50&offset=0`
  - `PUT /api/admin/translations/dose-recommendations/:doseRecommendationId/:language`
  - `GET /api/admin/translations/verified-profiles?language=de&q=&limit=50&offset=0`
  - `PUT /api/admin/translations/verified-profiles/:verifiedProfileId/:language`
  - `GET /api/admin/translations/blog-posts?language=de&q=&limit=50&offset=0`
  - `PUT /api/admin/translations/blog-posts/:blogPostId/:language`
- `frontend/src/pages/admin/TranslationsTab.tsx` now has an entity selector for
  Ingredients, Dose Recommendations, Verified Profiles, and Blog Posts.
- Public i18n playback remains unchanged.
- D1 backup is verified and must not be treated as open work.
- Checks passed locally:
  - `npm run lint --if-present` in `frontend/`
  - `npm run test --if-present -- --run` in `frontend/`
  - `npm run build` in `frontend/`
  - `npx tsc -p tsconfig.json` in `functions/`

## Phase D - Next Required Actions

Phase C and the integrated Phase D rollout are complete.

- Keep the temporary `recommendations` view/triggers until a later cleanup
  migration after deployed code no longer needs old-table compatibility.
- Consider a later cleanup migration that drops the compatibility
  `recommendations` view and triggers once old previews are irrelevant.
- Public i18n playback remains separate and was not changed.

## Completed Locally (Docs/Ops)

- Root documentation cleanup for the Cloudflare line is complete locally in
  `README.md`, `DEPLOYMENT.md`, `docs/implementation-status.md`, and
  `docs/agent-planner.md`.
- `.github/workflows/ci.yml` has been refreshed for the Cloudflare line.
- Backup workflow was checked against `wrangler.toml`; D1 database name matches
  `supplementstack-production`.
- GitHub Actions D1 backup workflow verification is complete: manual and
  automatic runs succeeded, and token scopes are verified.
- Secret-pattern review of the requested untracked docs/scripts/lockfiles found
  placeholders and references only, not raw token values in the checked files;
  those docs/scripts/lockfiles are now committed in `862ed57`.

## Completed (Phase C)

All Phase C items are merged to `main` and deployed to Cloudflare Pages.

| Priority | Item | Commit | Status |
|---|---|---|---|
| 0 | Shared agent workflow (AGENTS.md, .agent-memory/*, .claude/settings.json, scripts/update-agent-handoff.ps1) | `2ca9382` | Done |
| 1 | Hono module split - entry point is now composer, modules under `functions/api/modules/*`, helpers under `functions/api/lib/*` | `b1fd347` | Done |
| 2 | New dose recommendations API (`GET /api/ingredients/:id/recommendations` from `dose_recommendations`) | `dd58ba2` | Done |
| 3 | Admin audit logging - `logAdminAction()` in `lib/helpers.ts`, 16 mutations wired | `4482a5f` | Done |
| 4 | Server-side unit conversion - `lib/units.ts` with `normalizeUnit()` + `convertAmount()`, IU coverage for D/A/E | `11440f5` | Done |
| - | Tech-debt cleanup: deduplicate normalizeComparableUnit, extend IngredientRow, add pages_build_output_dir, reorganize next-steps | `b866c3d` | Done |
