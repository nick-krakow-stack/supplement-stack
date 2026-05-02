# Historical Agent Planner

Status: historical planning artifact.

This document described the original scaffold-era agent split and data model.
It is no longer the active source of truth for agent workflow, architecture, or
implementation status.

Use these files instead:

- `AGENTS.md` for the shared agent protocol
- `CLAUDE.md` for project rules, roles, and constraints
- `.agent-memory/current-state.md` for current architecture and phase state
- `.agent-memory/handoff.md` for the current continuation point
- `.agent-memory/next-steps.md` for active priorities

The current implementation line is:

- Frontend: `frontend/src/*`
- API: `functions/api/[[path]].ts`, `functions/api/modules/*`,
  `functions/api/lib/*`
- Database: `d1-migrations/*`
- Cloudflare config: `wrangler.toml`

Older mentions of `backend/src/schema.ts`, SQLite, scaffold agents, or
PostgreSQL are retained only as historical context.
