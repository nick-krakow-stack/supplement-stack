# Handoff

Last updated: 2026-05-12 02:25:59 +02:00
Update mode: Stop

## Latest Notes

Automatic handoff snapshot written by .codex/hooks/agent-protocol.ps1.

## Snapshot: Stop

### Completed
- Central dispatcher kept in .codex/hooks/agent-protocol.ps1
- Active hooks wired for UserPromptSubmit, Stop, PreCompact auto/manual
- Stop/PreCompact snapshots write handoff and progress-snapshots memory
- hook-regression-check.mjs validates active hooks, forbidden tool hooks, memory rules, and silent simulations
- Memory docs updated for current-state, decisions, next-steps, handoff, and progress snapshots

### Open
- Owner-feedback pending items remain in .agent-memory/owner-feedback.md for later triage

### Next Steps
- Keep PreToolUse and PostToolUse inactive
- Keep hook-regression-check.mjs passing after hook or memory-rule edits

### Checks/Status
- node scripts\hook-regression-check.mjs passed
- node --check scripts\hook-regression-check.mjs passed
- git diff --check passed with LF/CRLF warnings only

### Git Snapshot

- Branch: codex/website-ux-fixes
- Last commit: 8de5d6c Consolidate hook state cleanup

~~~text
 M .agent-memory/current-state.md
 M .agent-memory/decisions.md
 M .agent-memory/handoff.md
 M .agent-memory/next-steps.md
 M .agent-memory/owner-feedback.md
 M .claude/settings.json
 M .codex/hooks.json
 M .codex/hooks/README.md
 M .codex/hooks/agent-protocol.ps1
 M scripts/hook-regression-check.mjs
?? .agent-memory/progress-snapshots.md
~~~

## Git Snapshot

- Branch: codex/website-ux-fixes
- Last commit: 8de5d6c Consolidate hook state cleanup

## Working Tree

~~~text
 M .agent-memory/current-state.md
 M .agent-memory/decisions.md
 M .agent-memory/handoff.md
 M .agent-memory/next-steps.md
 M .agent-memory/owner-feedback.md
 M .claude/settings.json
 M .codex/hooks.json
 M .codex/hooks/README.md
 M .codex/hooks/agent-protocol.ps1
 M scripts/hook-regression-check.mjs
?? .agent-memory/progress-snapshots.md
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
- Put durable completed state in `.agent-memory/current-state.md` and durable priorities in `.agent-memory/next-steps.md`.
