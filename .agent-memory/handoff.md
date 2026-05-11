# Handoff

Last updated: 2026-05-12 00:48:20 +02:00
Update mode: PreCompactManual

## Latest Notes

Automatic handoff snapshot written by .codex/hooks/agent-protocol.ps1.

## Git Snapshot

- Branch: codex/website-ux-fixes
- Last commit: d9c8916 Add referral attribution dashboard

## Working Tree

~~~text
 M .agent-memory/current-state.md
 M .agent-memory/handoff.md
 M .agent-memory/next-steps.md
 M .claude/settings.json
 M .codex/hooks.json
 M .codex/hooks/README.md
 D .codex/hooks/error-capture.ps1
 D .codex/hooks/orchestrator-guard.ps1
 D .codex/hooks/pre-deploy-check.ps1
 D .codex/hooks/update-agent-handoff.ps1
?? .agent-memory/owner-feedback.md
?? .codex/hooks/agent-protocol.ps1
?? scripts/append-owner-feedback.ps1
?? scripts/hook-regression-check.mjs
~~~

## Required Startup For Next Agent

1. Read `AGENTS.md`.
2. Read `CLAUDE.md`.
3. Read `.agent-memory/current-state.md`.
4. Read this handoff.
5. Read `.agent-memory/next-steps.md`.
6. Run `git status --short`.

## Constraints

- Do not write secrets, tokens, passwords, or raw credential values into memory files.
- Keep implementation compatible with Cloudflare Workers / Pages Functions.
- Review untracked files before deleting or committing them.
- Check `.agent-memory/owner-feedback.md` before continuing after context compression.
