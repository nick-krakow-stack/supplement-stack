# Handoff

Last updated: 2026-04-29 20:14:16 +02:00
Update mode: PostToolUseBash

## Latest Notes

Automatic handoff snapshot written by scripts/update-agent-handoff.ps1.

## Git Snapshot

- Branch: main
- Last commit: dd58ba2 Feature: Add dose recommendations API

## Working Tree

~~~text
M .agent-memory/current-state.md
M .agent-memory/deploy-log.md
M .agent-memory/handoff.md
M .claude/SESSION.md
M .claude/settings.json
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
- `functions/api/[[path]].ts`
- `functions/api/modules/*`
- `functions/api/lib/*`
- `frontend/src/*`
- `d1-migrations/*`
- `wrangler.toml`
- `README.md`
- `DEPLOYMENT.md`
- `docs/implementation-status.md`
- parts of `.claude/SESSION.md`
## Current Phase
Phase B is complete. Phase C backend refactor is in progress.
Phase C Priority 1 (Hono module split) and Priority 2 (public dose recommendations API) are committed and deployed.
Phase C Priority 3 (admin audit logging) and Priority 4 (server-side unit conversion) are still open.
- `dd58ba2` - Feature: Add dose recommendations API (`GET /api/ingredients/:id/recommendations` from `dose_recommendations`).
- `b1fd347` - Refactor: Split Pages API into Hono modules (`functions/api/[[path]].ts` is now a composer; modules under `functions/api/modules/*`, helpers under `functions/api/lib/*`).
- `2ca9382` - Ops: Shared agent memory and auto-handoff workflow (`AGENTS.md`, `.agent-memory/*`, `scripts/update-agent-handoff.ps1`, `.claude/settings.json`, `.claude/memory.md` as pointer).
- `9a5f523` - DB: Phase B abgeschlossen, migrations 0028-0035, `dosage_guidelines` migrated to `dose_recommendations`.
- `0026`: `populations` lookup with 5 seed rows.

## Next Planned Work

## Priority 1: Phase C Backend Refactor
Goal: split the monolithic Hono app in `functions/api/[[path]].ts` into maintainable modules under `functions/api/modules/` and shared helpers under `functions/api/lib/`.
Important:
- Confirm whether the existing untracked module files are complete, partial, or generated drafts.
- Mount modules from the entry point only after checking route parity.
- Keep Cloudflare Worker constraints: Web APIs only, no Node runtime assumptions, no filesystem dependencies.
## Priority 0: Commit Shared Agent Workflow
- `AGENTS.md`
- `.agent-memory/*`
- `.claude/memory.md`
- `.claude/settings.json`
- `scripts/update-agent-handoff.ps1`
- `.gitignore`
- `CLAUDE.md`
## Priority 2: New Dose Recommendations API
Add a new public endpoint based on `dose_recommendations`:
- Read from `dose_recommendations`, not the legacy `recommendations` table.
- Include relevant population/profile/source metadata.
- Sort by relevance, evidence quality, and year.
- Include automatic upper-limit warnings when available.
- Validate `verified_profile_id` in backend code because the column has no FK constraint.
## Priority 3: Admin Audit Logging
Wire all Admin mutations to `admin_audit_log`.
- Log user id, action, entity type, entity id, before/after payload where reasonable, and timestamp.
- Use a shared helper or middleware so future Admin endpoints do not forget logging.
## Priority 4: Server-Side Unit Conversion
Implement server-side unit conversion for supplement dose comparisons.
- mg to g and g to mg.
- IU to micrograms where ingredient-specific conversion factors are known.
- ingredient-specific rules for vitamins and other compounds where simple mass conversion is not enough.
## Later / Do Not Mix Into Phase C
- Rename old `recommendations` table to `product_recommendations` in a separate task.
- Expand admin CMS for translations.
- First manual run of GitHub Actions D1 backup workflow to verify token scopes.
- Root documentation cleanup after Phase C stabilizes.

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
