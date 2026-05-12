# Handoff

Last updated: 2026-05-12 15:05:32 +02:00
Update mode: Stop

## Latest Notes

Automatic handoff snapshot written by .codex/hooks/agent-protocol.ps1.

## Git Snapshot

- Branch: main
- Last commit: 74cc5bd Streamline demo product form selection

## Working Tree

~~~text
 M .agent-memory/current-state.md
 M .agent-memory/decisions.md
 M .agent-memory/handoff.md
 M .agent-memory/next-steps.md
 D .claude/hooks/error-capture.sh
 D .claude/hooks/pre-deploy-check.sh
 D .claude/memory.md
 D .claude/settings.json
 M .gitignore
 M CLAUDE.md
 D scripts/update-agent-handoff.ps1
?? .agent-memory/progress.md
?? .codex/
?? scripts/hook-regression-check.mjs
~~~

## Current State Summary

See .agent-memory/current-state.md.

## Next Planned Work

See .agent-memory/next-steps.md.

## Required Startup For Next Agent

1. Read AGENTS.md.
2. Read CLAUDE.md.
3. Read .agent-memory/current-state.md.
4. Read this handoff.
5. Read .agent-memory/next-steps.md.
6. Run git status --short.

## Constraints

- Do not write secrets, tokens, passwords, or raw credential values into memory files.
- Use code and migrations as final source of truth if docs conflict.
- Keep implementation compatible with Cloudflare Workers / Pages Functions.
