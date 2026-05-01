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

Treat these as historical or possibly stale unless verified against code:

- `README.md`
- `DEPLOYMENT.md`
- `docs/implementation-status.md`
- parts of `.claude/SESSION.md`

## Current Phase

Phase B is complete. Phase C backend refactor is in progress.

Phase C Priority 1 (Hono module split), Priority 2 (public dose recommendations API), Priority 3 (admin audit logging), and Priority 4 (server-side unit conversion) are committed and deployed.
Phase C tech-debt sweep complete (commit b866c3d).
Phase C is complete.
Demo product loading fix is committed and deployed to Cloudflare Pages preview.
D3 recommendations / product modal loading fix is committed and deployed to Cloudflare Pages preview.
Preview search API-base fix is committed and deployed to Cloudflare Pages preview: production builds use same-origin `/api` by default, while Vite dev on localhost can still use `VITE_API_BASE_URL`.

Last relevant commits on `main`:

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

## Latest Local Work

Uncommitted frontend affiliate disclosure cleanup is in progress locally:

- `frontend/src/components/ProductCard.tsx` no longer renders the visible `Affiliate` badge in product cards.
- `frontend/src/components/LegalDisclaimer.tsx` now uses a general affiliate footnote: some links may be affiliate links, commission may be earned, recommendations remain independent.
- Shop link / buy button behavior was left unchanged.
- Admin and edit surfaces were intentionally not changed; `is_affiliate` remains visible/editable there.
- Validation passed: `npm run build` in `frontend/`.

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
- The old product `recommendations` table and `/api/recommendations` route remain unchanged.

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

`.agent-memory/handoff.md` is regenerated on every PreCompact and after every Bash tool use by `scripts/update-agent-handoff.ps1`. Treat it as a transient snapshot — never store unique information only there.

Do not assume untracked files are disposable. Review before deleting or committing.
