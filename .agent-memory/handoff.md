# Handoff

Last updated: 2026-04-29 18:30:53 +02:00
Update mode: ManualTest

## Latest Notes

Shared agent workflow now includes automatic handoff snapshots via Claude Code hooks and documented local secret locations.
Codex Orchestrator rule and shared Sub-Agent definitions were added to `AGENTS.md`; `.agent-memory/decisions.md` now records the Orchestrator/Sub-Agent operating model.

## Git Snapshot

- Branch: main
- Last commit: 9a5f523 DB: Phase B abgeschlossen — Migrations 0028–0035, dosage_guidelines→dose_recommendations migriert

## Working Tree

~~~text
M .claude/SESSION.md
M .gitignore
M CLAUDE.md
?? .agent-memory/
?? .claude/commands/
?? .claude/hooks/error-capture.sh
?? .claude/hooks/post-deploy-log.sh
?? .claude/memory.md
?? .claude/settings.json
?? AGENTS.md
?? _research_raw/01_fat_soluble_vitamins.json
?? _research_raw/02_b_vitamins_vitamin_c.json
?? docs/cloudflare-accounts.md
?? docs/codex-working-context.md
?? frontend/package-lock.json
?? functions/api/lib/
?? functions/api/modules/
?? functions/package-lock.json
?? scripts/
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
Phase B is complete. Phase C is starting.
- `9a5f523` - DB: Phase B abgeschlossen, migrations 0028-0035, `dosage_guidelines` migrated to `dose_recommendations`.
- `0026`: `populations` lookup with 5 seed rows.
- `0027`: `dose_recommendations`.
- `0028`: `verified_profiles`.
- `0029`: `admin_audit_log`.
- `0030`: translation tables.
- `0031`: `blog_posts`.

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
