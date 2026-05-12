# Handoff

Last updated: 2026-05-12 17:42:51 +02:00
Update mode: Stop

## Latest Notes

Automatic handoff snapshot written by .codex/hooks/agent-protocol.ps1.
Current task status is tracked in .agent-memory/current-task.md.
Owner and browser feedback are persisted in .agent-memory/feedback.md.

## Git Snapshot

- Branch: main
- Last commit: 0b55f7f Make AGENTS protocol canonical

## Working Tree

~~~text
M  .agent-memory/current-state.md
AM .agent-memory/current-task.md
M  .agent-memory/decisions.md
M  .agent-memory/feedback.md
MM .agent-memory/handoff.md
M  .agent-memory/next-steps.md
MM .agent-memory/progress.md
M  .codex/hooks/README.md
M  .codex/hooks/agent-protocol.ps1
M  AGENTS.md
M  scripts/hook-regression-check.mjs
~~~

## Current State Summary

See .agent-memory/current-state.md.

## Next Planned Work

See .agent-memory/next-steps.md.

## Required Startup For Next Agent

1. Read AGENTS.md.
2. Read .agent-memory/current-state.md.
3. Read this handoff.
4. Read .agent-memory/next-steps.md.
5. Run git status --short.

## Constraints

- Do not write secrets, tokens, passwords, or raw credential values into memory files.
- Use code and migrations as final source of truth if docs conflict.
- Keep implementation compatible with Cloudflare Workers / Pages Functions.
