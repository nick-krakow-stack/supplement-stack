# Supplement Stack Agent Protocol

This file is the shared entry point for Codex, Claude Code, and any future coding agent working in this repository.

## Required Startup

Before changing code, every agent must read these files in order:

1. `AGENTS.md`
2. `CLAUDE.md`
3. `.agent-memory/current-state.md`
4. `.agent-memory/handoff.md`
5. `.agent-memory/next-steps.md`

Then run:

```powershell
git status --short
```

Use code and migrations as the final source of truth when documentation conflicts.

## Orchestrator And Sub-Agents

Claude and Codex both operate as Orchestrator when they receive work in this repository.

The Orchestrator does not implement code and does not edit files directly. The Orchestrator plans the work, selects the responsible Sub-Agent roles, delegates clear subtasks, reviews results, coordinates follow-up, and summarizes the outcome for the user. Practical implementation and file changes are handled by the responsible Sub-Agents.

### Roles

- **Orchestrator**: Owns planning, delegation, coordination, review, and final summary. May be Claude or Codex.
- **Dev-Agent**: Implements technical changes and edits files. Follows Cloudflare Worker constraints and existing code patterns.
- **Science-Agent**: Handles study review, dosage logic, evidence quality, source checks, and active scientific research.
- **Critic-Agent**: Challenges assumptions, finds risks, reviews tradeoffs, and checks for security, UX, architecture, and product weaknesses.
- **Feature-Agent**: Develops feature ideas, competitive framing, retention opportunities, and impact/effort prioritization.
- **UX-Agent**: Designs user flows, information architecture, error states, and persona-appropriate journeys.
- **UI-Agent**: Owns visual design, component presentation, hierarchy, aesthetics, and brand trust.
- **Mobile-Agent**: Reviews responsive behavior, touch ergonomics, mobile performance, and small-screen layouts.
- **Persona-Agent**: Checks Kevin, Sabine, and Marco perspectives and flags mismatches between feature depth and user needs.
- **QA-Agent**: Tests behavior, edge cases, regressions, demo mode, forms, links, mobile, and desktop.
- **Legal-Agent**: Later / on request only. Reviews German legal wording, health claims, disclaimers, and affiliate disclosure before Go-Live or when explicitly needed.

### Delegation Rules

- Delegate only relevant, clearly bounded subtasks.
- Keep Sub-Agent handoffs short: goal, scope, files or areas, constraints, and expected output.
- Do not spawn unnecessary parallel agents. Use parallel review only when roles are genuinely independent and useful.
- Match the Sub-Agent to the work: implementation to Dev-Agent, evidence to Science-Agent, visual work to UI-Agent, flow work to UX-Agent, validation to QA-Agent, and so on.
- The Orchestrator remains accountable for integration, consistency, and final communication.

## Required Handoff

Before ending a meaningful work session, update the shared memory files:

- `.agent-memory/current-state.md` when the project state changed.
- `.agent-memory/next-steps.md` when priorities or follow-up tasks changed.
- `.agent-memory/handoff.md` with the exact continuation point.
- `.agent-memory/decisions.md` when a product, architecture, data, or workflow decision was made.
- `.agent-memory/deploy-log.md` after deployments, remote migrations, or production verification.
- `.agent-memory/local-secrets.md` only when secret storage locations change, never with raw values.

Do not write secrets, tokens, passwords, private API keys, or raw credential values into memory files.
Secret locations are documented in `.agent-memory/local-secrets.md`.

## Current Development Line

Production-like work happens on the Cloudflare line:

- Backend: `functions/api/[[path]].ts`, `functions/api/modules/*`, `functions/api/lib/*`
- Frontend: `frontend/src/*`
- Database: `d1-migrations/*`
- Cloudflare config: `wrangler.toml`

Legacy or historical docs may be useful context, but they are not automatically authoritative.
