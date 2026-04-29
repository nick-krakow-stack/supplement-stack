# Claude Memory Pointer

Last updated: 2026-04-29

The canonical shared project memory has moved to `.agent-memory/`.

Claude Code must read these files at the start of every session:

1. `AGENTS.md`
2. `CLAUDE.md`
3. `.agent-memory/current-state.md`
4. `.agent-memory/handoff.md`
5. `.agent-memory/next-steps.md`

Use `.agent-memory/decisions.md` for durable decisions and `.agent-memory/deploy-log.md` for deploy and migration history.

Do not treat this file as the source of truth. It exists only so older Claude workflows that open `.claude/memory.md` immediately discover the shared memory location.

