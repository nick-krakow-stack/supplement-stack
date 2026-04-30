# Next Steps

Last updated: 2026-04-30

## Phase D — Next Phase (scope to be defined by Nick)

Phase C is fully complete. Phase D has not been formally scoped yet.
Nick to decide which of the following candidates to prioritize:

- Rename old `recommendations` table to `product_recommendations` (isolated migration, no logic change).
- Expand admin CMS with translations tab (see i18n plan in CLAUDE.md — `*_translations` tables are ready).
- First manual run of GitHub Actions D1 backup workflow to verify token scopes.
- Root documentation cleanup now that Phase C is stable.

---

## Completed (Phase C)

All Phase C items are merged to `main` and deployed to Cloudflare Pages.

| Priority | Item | Commit | Status |
|---|---|---|---|
| 0 | Shared agent workflow (AGENTS.md, .agent-memory/*, .claude/settings.json, scripts/update-agent-handoff.ps1) | `2ca9382` | Done |
| 1 | Hono module split — entry point is now composer, modules under `functions/api/modules/*`, helpers under `functions/api/lib/*` | `b1fd347` | Done |
| 2 | New dose recommendations API (`GET /api/ingredients/:id/recommendations` from `dose_recommendations`) | `dd58ba2` | Done |
| 3 | Admin audit logging — `logAdminAction()` in `lib/helpers.ts`, 16 mutations wired | `4482a5f` | Done |
| 4 | Server-side unit conversion — `lib/units.ts` with `normalizeUnit()` + `convertAmount()`, IU coverage for D/A/E | `11440f5` | Done |
| — | Tech-debt cleanup: deduplicate normalizeComparableUnit, extend IngredientRow, add pages_build_output_dir, reorganize next-steps | *(this commit)* | Done |
