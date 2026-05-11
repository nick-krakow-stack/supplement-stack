# Handoff

Last updated: 2026-05-11 23:14:45 +02:00
Update mode: SessionEnd

## Latest Notes

Admin dashboard owner comments implemented, migrated, preview-deployed, and verified. PostToolUse handoff updates disabled to keep the tree clean.

## Git Snapshot

- Branch: codex/website-ux-fixes
- Last commit: e9bf831 Update admin dashboard metrics

## Working Tree

~~~text
M .agent-memory/current-state.md
M .agent-memory/handoff.md
M .agent-memory/next-steps.md
M .codex/hooks.json
M .codex/hooks/update-agent-handoff.ps1
~~~

## Current State Summary

- Implemented the owner comments from live `/administrator/dashboard` on branch
- Remote D1 migration `0076_admin_dashboard_tracking.sql` was applied to
- New dashboard tracking/storage:
- Dashboard KPI copy and order now follows the owner comments:
- Katalog/Content module labels and links were adjusted:
- Admin Products affiliate filter now includes `Nick-Partnerlink` and
- Important limitation: `Backlinks` is currently an app-measured external
- Verification passed:
- Preview deployment:
- Remote postflight:
- Hook failures in the Codex App were traced to Bash-only hook commands on
- Hook entry points are now centralized under `.codex/hooks/` as PowerShell
- `.codex/hooks.json` points to those PowerShell scripts.
- `update-agent-handoff.ps1` remains available for PreCompact/manual handoff
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

## Next Planned Work

## Hook Maintenance
- Codex/Claude hook files are centralized under `.codex/hooks/` and should stay
- Do not reintroduce Bash-only hooks unless the Windows Codex environment is
- Hook failure logs are written to `.agent-memory/deploy-errors.log`, which is
- Do not wire `update-agent-handoff.ps1` back into every `PostToolUse` shell
## Immediate
- Admin dashboard owner comments are implemented and deployed to the
- The new dashboard metrics only have history from 2026-05-11 onward:
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
