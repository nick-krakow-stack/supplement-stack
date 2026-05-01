# Handoff

Last updated: 2026-05-01 23:07:30 +02:00
Update mode: Manual Ops-Worker deploy handoff

## Latest Notes

Ops-Worker committed and deployed the Preview search API-base fix.

- Root cause: preview bundle could embed `https://supplementstack.pages.dev/api` from `frontend/.env.local`, causing preview pages to call production API cross-origin. Production CORS does not allow arbitrary preview origins, so SearchBar surfaced `Suche fehlgeschlagen. Bitte erneut versuchen.`.
- Implemented `frontend/src/api/base.ts` as centralized API-base logic.
- Production builds now use same-origin `/api` by default and ignore `VITE_API_BASE_URL`.
- Vite dev on local browser hosts (`localhost`, `127.0.0.1`, `::1`) can still use `VITE_API_BASE_URL`; otherwise it falls back to `/api`.
- `frontend/src/api/client.ts`, `frontend/src/components/SearchBar.tsx`, and `frontend/src/components/StackWorkspace.tsx` now share the helper.
- Fix commit: `b5dba6e` - Fix: Use same-origin API in deployed frontend.
- Validation passed: `npm run build` in `frontend/`; `npx tsc -p tsconfig.json` in `functions/`.
- Deploy prep passed: `frontend/dist/functions/api/[[path]].ts` was present before deploy.
- Deployed preview: `https://8582e2f6.supplementstack.pages.dev`.
- Smoke checks passed: preview root HTTP 200; `/api/ingredients/search?q=d3` HTTP 200 and response contained Vitamin D3; downloaded preview JS bundle did not contain `supplementstack.pages.dev/api`.

## Git Snapshot

- Branch: main
- Latest commit: Memory: Record same-origin API deploy
- Last code commit: `b5dba6e` Fix: Use same-origin API in deployed frontend

## Working Tree

Expected remaining uncommitted/untracked files are memory/docs/local-helper artifacts and should not be assumed disposable.

~~~text
M .agent-memory/current-state.md
M .agent-memory/deploy-log.md
M .agent-memory/handoff.md
M .agent-memory/next-steps.md
?? .claude/commands/
?? _research_raw/01_fat_soluble_vitamins.json
?? _research_raw/02_b_vitamins_vitamin_c.json
?? docs/cloudflare-accounts.md
?? docs/codex-working-context.md
?? frontend/package-lock.json
?? functions/package-lock.json
?? scripts/setup-local-dev.ps1
?? scripts/use-supplementstack-cloudflare.example.ps1
~~~

## Current State Summary

- Frontend: React, Vite, TypeScript, Tailwind CSS.
- Backend: Cloudflare Pages Functions with Hono.
- Database: Cloudflare D1.
- Storage: Cloudflare R2 for product images.
- KV: rate limiting / cache-related bindings.
- Deployment: Wrangler CLI preferred, GitHub Actions as fallback.
- Active source of truth: `functions/api/[[path]].ts`, `functions/api/modules/*`, `functions/api/lib/*`, `frontend/src/*`, `d1-migrations/*`, `wrangler.toml`.
- Phase C is complete; Phase D has not been formally scoped yet.

## Next Planned Work

## Phase D - Next Phase (scope to be defined by Nick)

- Rename old `recommendations` table to `product_recommendations` (isolated migration, no logic change).
- Expand admin CMS with translations tab (see i18n plan in CLAUDE.md - `*_translations` tables are ready).
- First manual run of GitHub Actions D1 backup workflow to verify token scopes.
- Root documentation cleanup now that Phase C is stable.

## Required Startup For Next Agent

1. Read `AGENTS.md`.
2. Read `CLAUDE.md`.
3. Read `.agent-memory/current-state.md`.
4. Read this handoff.
5. Read `.agent-memory/next-steps.md`.
6. Run `git status --short`.

## Constraints

- Do not write secrets, tokens, passwords, or raw credential values into memory files.
- Do not touch the old `recommendations` table during Phase C.
- Use `dose_recommendations` for dosage recommendations.
- Keep implementation compatible with Cloudflare Workers / Pages Functions.
- Review untracked files before deleting or committing them.
