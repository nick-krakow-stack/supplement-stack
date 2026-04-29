# Next Steps

Last updated: 2026-04-29

## Priority 1: Phase C Backend Refactor

Goal: split the monolithic Hono app in `functions/api/[[path]].ts` into maintainable modules under `functions/api/modules/` and shared helpers under `functions/api/lib/`.

Important:

- Confirm whether the existing untracked module files are complete, partial, or generated drafts.
- Mount modules from the entry point only after checking route parity.
- Keep Cloudflare Worker constraints: Web APIs only, no Node runtime assumptions, no filesystem dependencies.

## Priority 0: Commit Shared Agent Workflow

Before substantial Phase C implementation, commit the shared agent workflow files so Claude Code and Codex both start from the same versioned contract:

- `AGENTS.md`
- `.agent-memory/*`
- `.claude/memory.md`
- `.claude/settings.json`
- `scripts/update-agent-handoff.ps1`
- `.gitignore`
- `CLAUDE.md`

## Priority 2: New Dose Recommendations API

Add a new public endpoint based on `dose_recommendations`:

```text
GET /api/ingredients/:id/recommendations
```

Expected behavior:

- Read from `dose_recommendations`, not the legacy `recommendations` table.
- Include relevant population/profile/source metadata.
- Sort by relevance, evidence quality, and year.
- Include automatic upper-limit warnings when available.
- Validate `verified_profile_id` in backend code because the column has no FK constraint.

## Priority 3: Admin Audit Logging

Wire all Admin mutations to `admin_audit_log`.

Expected behavior:

- Log user id, action, entity type, entity id, before/after payload where reasonable, and timestamp.
- Use a shared helper or middleware so future Admin endpoints do not forget logging.

## Priority 4: Server-Side Unit Conversion

Implement server-side unit conversion for supplement dose comparisons.

Known needs:

- mg to g and g to mg.
- IU to micrograms where ingredient-specific conversion factors are known.
- ingredient-specific rules for vitamins and other compounds where simple mass conversion is not enough.

## Later / Do Not Mix Into Phase C

- Rename old `recommendations` table to `product_recommendations` in a separate task.
- Expand admin CMS for translations.
- First manual run of GitHub Actions D1 backup workflow to verify token scopes.
- Root documentation cleanup after Phase C stabilizes.
