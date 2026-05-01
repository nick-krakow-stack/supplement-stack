# Handoff

Last updated: 2026-05-01
Update mode: Manual Ops-Worker affiliate disclosure deploy handoff

## Latest Notes

Ops-Worker committed and deployed the frontend affiliate disclosure cleanup.

- Removed the visible `Affiliate` badge from `frontend/src/components/ProductCard.tsx`.
- Kept product shop link / buy button behavior unchanged.
- Updated `frontend/src/components/LegalDisclaimer.tsx` affiliate variant to a general footnote: links can be affiliate links, commission may be earned, recommendations remain independent.
- Admin/editing surfaces were not changed; `is_affiliate` remains visible/editable in admin and user product forms.
- Commit: `965d4e4` - Fix: Move affiliate disclosure to footer.
- Validation passed: `npm run build` in `frontend/`.
- Deploy prep passed: `frontend/dist/functions/api/[[path]].ts` was present before deploy.
- Deployed preview: `https://b4e4ea90.supplementstack.pages.dev`.
- Smoke checks passed: preview root HTTP 200; preview JS `/assets/index-DgGBIJBD.js` HTTP 200; old ProductCard Affiliate badge class was absent. Remaining `Affiliate` strings are from footer/legal copy, landing copy, and admin/user-edit surfaces.

## Git Snapshot

- Branch: main
- Latest commit: `965d4e4` Fix: Move affiliate disclosure to footer
- Last code commit: `965d4e4` Fix: Move affiliate disclosure to footer

## Working Tree

Expected remaining uncommitted/untracked files are docs/local-helper/research artifacts. Do not assume untracked files are disposable.

~~~text
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
