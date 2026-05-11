# Handoff

Last updated: 2026-05-11 21:23:20 +02:00
Update mode: ManualHookFinal

## Latest Notes

Automatic handoff snapshot written by .codex/hooks/update-agent-handoff.ps1.

## Git Snapshot

- Branch: codex/website-ux-fixes
- Last commit: 1986997 Polish stack demo and knowledge index

## Working Tree

~~~text
M .agent-memory/current-state.md
M .agent-memory/decisions.md
M .agent-memory/handoff.md
M .agent-memory/next-steps.md
D .claude/hooks/error-capture.sh
D .claude/hooks/pre-deploy-check.sh
M .claude/settings.json
M .gitignore
D scripts/orchestrator-guard.ps1
D scripts/update-agent-handoff.ps1
?? .codex/
~~~

## Current State Summary

- Hook failures in the Codex App were traced to Bash-only hook commands on
- Hook entry points are now centralized under `.codex/hooks/` as PowerShell
- `.codex/hooks.json` points to those PowerShell scripts.
- `.claude/settings.json` also points to the same `.codex/hooks/*.ps1` scripts
- `.gitignore` now keeps Codex local app state ignored while allowing the
- Old duplicate Bash hook files under `.codex/hooks/*.sh` and
- Manual verification passed:
- Production-like line is the Cloudflare Pages/Workers line:
- Live domain: `https://supplementstack.de`.
- Latest documented deployed preview:
- The active admin frontend is `/administrator`.
- `/api/admin` remains the backend API namespace.
- The old frontend `/admin` route was removed during cleanup. Use
- The old frontend admin monolith has been removed from active code:
- Active admin pages live in `frontend/src/pages/administrator/*`.
- Active admin menu now shows the reduced operator set: Dashboard,
- Several older admin pages still have direct routes for compatibility or later
- Admin pages use scoped shared UI/CSS in:
- Backend admin code is still concentrated in
- Implemented real authenticated `/routine` mail sending locally; not deployed
- Added `POST /api/stacks/routine/email` under the existing stacks module and
- The endpoint loads all stacks for the current user, prepares stack items with
- Routine mail uses its own stricter rate-limit key:
- `frontend/src/pages/RoutinePage.tsx` now calls the real endpoint from
- Added regression coverage to `scripts/backend-regression-check.mjs` for

## Next Planned Work

## Hook Maintenance
- Codex/Claude hook files are centralized under `.codex/hooks/` and should stay
- Do not reintroduce Bash-only hooks unless the Windows Codex environment is
- Hook failure logs are written to `.agent-memory/deploy-errors.log`, which is
## Immediate
- Admin knowledge/users deep-link filter fix is implemented and deployed to
- User UX follow-ups from the authenticated Tobias QA are implemented locally
- Before deployment, do one final local/source review of the changed user
- After deployment, run live authenticated owner QA for:
- Tobias QA landing/demo updates are implemented, merged, deployed, and
- Use `.agent-memory/browser-qa-persona.md` as the standard Tobias human
- First Tobias QA covered landing page, `/demo`, and Vitamin D/D3:
- Admin browser QA found two production-visible admin dosing bugs and both are
- Read-only authenticated admin QA covered dashboard, products, product detail
- Remaining authenticated QA that changes data should be run deliberately on
- Admin comfort follow-ups from browser QA:
- Backend review P2 hardening is deployed:
- Admin post-launch dashboard and human admin-copy pass is deployed:
- Dashboard is now oriented around post-launch operation:
- Visible admin subtitles were reviewed from a human/operator perspective and
- Remaining Admin-QA limit is authenticated owner browser QA. The previously
- `.agent-memory/admin_qa_todo.md` is now the current Admin-QA status file.
- Dashboard signup analytics decision is implemented: main metric
- For future visual TODOs, keep `.agent-memory/deployment_images/` and delete
- No open `.agent-memory/deployment_images` PNG visual TODOs remain. Keep the
- Run authenticated owner QA for:
- Run authenticated owner QA for the new user/admin flows, especially stack
- In the same owner QA pass, upload one Product Detail/Product-QA image and
- Review L-Carnitin/ALCAR display copy in admin content if the migrated legacy
- Fix or reset the local D1 migration journal/schema mismatch if local
- Keep `/administrator` as the frontend admin surface and `/api/admin` as the
## Wirkstoffe/Formen Rebuild
- Model canonical Wirkstoffe in `ingredients`.
- Model salts, esters, derivatives, and forms in `ingredient_forms`.
- Model spelling variants and abbreviations in `ingredient_synonyms`.

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
