# Current State

Last updated: 2026-04-29

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

Phase B is complete. Phase C is starting.

Last relevant commit:

- `9a5f523` - DB: Phase B abgeschlossen, migrations 0028-0035, `dosage_guidelines` migrated to `dose_recommendations`.

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
- `functions/api/[[path]].ts` is still a large monolithic Hono app, around 1492 lines at the time this file was created.
- `functions/api/modules/*` and `functions/api/lib/*` exist locally, but the root Hono entry point does not appear to mount those modules yet.
- `functions/api/modules/*` and `functions/api/lib/*` are currently untracked in git status and need review before committing.

## Agent Workflow

- Shared memory lives in `.agent-memory/*`.
- `AGENTS.md` is the generic startup protocol for Codex and future agents.
- `CLAUDE.md` starts with the same startup protocol so Claude Code sees it immediately.
- `.claude/memory.md` is only a pointer to `.agent-memory/*`.
- `scripts/update-agent-handoff.ps1` updates `.agent-memory/handoff.md` without using model tokens.
- `.claude/settings.json` wires that script into Claude Code `PreCompact` and `PostToolUse` for Bash.

## Git / Workspace Notes

The worktree is dirty. Notable untracked or modified paths at the time this file was created included:

- `.claude/*`
- `.wrangler/`
- `_research_raw/*`
- `frontend/dist/`
- `frontend/node_modules/`
- `functions/node_modules/`
- `frontend/package-lock.json`
- `functions/package-lock.json`
- `functions/api/lib/*`
- `functions/api/modules/*`
- `scripts/*`

Do not assume untracked files are disposable. Review before deleting or committing.
