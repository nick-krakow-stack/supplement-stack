# Historical Agent Planner

Status: historical planning snapshot; it does not describe the current workflow
or implementation state.

This document described the original scaffold-era agent split and data model.
It is no longer the active source of truth for agent workflow, architecture, or
implementation status.

For current startup and context routing, follow `AGENTS.md`. The historical
orientation order below is not an additional must-read list; `AGENTS.md`
decides which context is actually needed:

1. `AGENTS.md` for the authoritative startup and shared agent protocol
2. `.agent-memory/current-state.md` for current architecture and phase context,
   when routed there
3. `.agent-memory/handoff.md` for an explicitly continued unfinished task
4. `.agent-memory/next-steps.md` for additional priorities, when needed

For the current nutrient-content flow, use
[`content-pipeline-v2.md`](content-pipeline-v2.md). Neither that contract nor
the files above make this historical planner a current status source.

The current implementation line is:

- Frontend: `frontend/src/*`
- API: `functions/api/[[path]].ts`, `functions/api/modules/*`,
  `functions/api/lib/*`
- Database: `d1-migrations/*`
- Cloudflare config: `wrangler.toml`

Older mentions of `backend/src/schema.ts`, SQLite, scaffold agents, or
PostgreSQL are retained only as historical context.
