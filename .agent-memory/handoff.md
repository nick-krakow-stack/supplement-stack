# Handoff

Last updated: 2026-05-07

## Exact Continuation Point

1. Finish local cleanup validation:
   - `functions`: `npx tsc -p tsconfig.json --noEmit`
   - `frontend`: `npx tsc --noEmit`
   - `frontend`: `npm run lint --if-present`
   - `frontend`: `npm run build`
   - `node --check scripts/admin-browser-smoke.mjs`
   - `node --check scripts/user-browser-smoke.mjs`
2. If validation passes, commit the current deployed admin code plus cleanup so
   `git status --short` is clean.
3. Do not revert the deployed admin work. The large dirty tree contains the new
   `/administrator` implementation, migrations, smoke scripts, and backend
   admin/security changes.
4. Do not treat `/api/admin` as legacy; it is the backend admin API namespace.
5. The old frontend `/admin` route has been removed. Use `/administrator` for
   the admin UI.

## Completed In Latest Local Cleanup

- Deleted local-only artifacts:
  - `admin-preview/`
  - root `logo.png`
  - `qa-preview-demo-bottombar-no-cookie.png`
- Added `.gitignore` entries for local design/browser-QA artifacts and Claude
  deploy-error logs.
- Removed legacy `.claude/SESSION.md` and `.claude/hooks/post-deploy-log.sh`.
- Updated `.claude/settings.json` so it no longer appends deploy history to the
  legacy session file.
- Kept `.agent-memory/deploy-log.md` as canonical deploy/migration history.
- Replaced the large temporary admin rebuild analysis/plan files with compact
  `.agent-memory/admin-rebuild-plan.md`.
- Compressed required startup memory files to current state only.
- Updated `CLAUDE.md` to reference the `AdministratorShell` admin surface and
  clarify `.agent-memory/*` as canonical memory.
- Verified by search that active frontend/functions/scripts/CI code no longer
  imports the deleted old frontend admin monolith files.
- Removed the old frontend `/admin` compatibility redirect and related admin
  status copy.

## Last Deployed Functional Work

- Admin Browser-QA Text/UX Cleanup:
  - Preview: `https://6cd86fa0.supplementstack.pages.dev`
  - Live: `https://supplementstack.de`
  - No D1 migration required.
  - Frontend TypeScript, lint, build, smoke-script syntax, Pages deploy, route
    smokes, and unauthenticated admin API guard checks passed.
- Ingredient Research Coverage List:
  - Preview: `https://d363ade8.supplementstack.pages.dev`
  - Live: `https://supplementstack.de`
  - No D1 migration required.
  - Functions/frontend validation, remote D1 read-only coverage query, remote
    migration list, route smokes, and unauthenticated admin API guard checks
    passed.

## Remaining Acceptance Gate

- Final authenticated owner browser QA and feedback.
- Suggested order:
  1. Login/session persistence.
  2. Stack create/edit/product add/remove/replacement and user product submit.
  3. Admin Product Detail overview/moderation/affiliate save.
  4. Admin Product Detail Wirkstoff row add/edit/delete.
  5. Admin Product Detail image upload and image URL save.
  6. Product-QA harmless save.
  7. Product Warning create/edit/deactivate.
  8. Dosing save with source links and plausibility display.
  9. Interaction edit/delete through admin-by-id endpoints.
  10. Ingredient Research source/warning and NRV CRUD.
  11. One stale-version `409` check.
