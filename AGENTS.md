# Supplement Stack Agent Protocol

This file is the shared entry point for Codex, Claude Code, and any future coding agent working in this repository.

## Required Startup

Before changing code, every agent must read these files in order:

1. `AGENTS.md`
2. `.agent-memory/current-state.md`
3. `.agent-memory/handoff.md`
4. `.agent-memory/next-steps.md`

### Hook-and-Memory Operational Rules

- The active orchestration model is Orchestrator-only: Codex coordinates and delegates to Sub-Agents; only Sub-Agents perform implementation.
- For every task, the active checklist is maintained in `.agent-memory/current-task.md` as the canonical live To-do list and updated when steps are completed or reprioritized.
- All browser feedback, diff comments, and owner feedback points are persisted in `.agent-memory/feedback.md` for continuity across compact/restart.
- After each stop/assignment boundary, the handoff state is refreshed via hooks so `.agent-memory/handoff.md` and `.agent-memory/progress.md` remain current.
- After every Sub-Agent final response, the Orchestrator updates `.agent-memory/current-task.md` immediately and marks completed items before delegating again or sending a final response.

Then run:

```powershell
git status --short
```

Use code and migrations as the final source of truth when documentation conflicts.

`AGENTS.md` is the authoritative protocol file. `CLAUDE.md` is removed and must not be required for startup.

## Core Scope

- Product goal: best supplement management workflow with clear scientific basis.
- Monetization: affiliate links managed in admin; users may add their own links.
- Trust and quality rules: transparent sourcing, clear disclaimers, science-backed dosage/content.

## Technology and Cloudflare Rules

- Frontend: React + TypeScript + Vite + Tailwind CSS
- Backend: Cloudflare Workers with Hono (`functions/api/[[path]].ts`, `functions/api/modules/*`, `functions/api/lib/*`)
- Data: Cloudflare D1 (`d1-migrations/*`)
- Files/Assets: Cloudflare R2
- Session/cache: Cloudflare KV
- Deployment/config: Wrangler (`wrangler.toml`, `wrangler.maintenance.toml`)

### Cloudflare constraints (no exceptions for production line)

- No Node.js-only runtime patterns for Worker logic.
- No local filesystem in runtime code.
- Use D1 for persistence and KV for sessions/caching.
- Keep CPU/binding usage compact and efficient.
- Keep schema and migration changes explicit and reviewable.
- Respect Wrangler config as source of truth for bindings and secrets.
- Prefer additive migration paths.

## i18n Decision

Decision is fixed to a translation-table architecture instead of `*_de/_en` suffix columns.

Canonical approach is to keep base entities and add tables like `ingredient_translations`, `recommendation_translations`, `blog_translations`, and `verified_profile_translations` with a `language` field.

Current platform is DE-first; phase B migration and extension uses translation tables with `language='de'`.

## Existing Codebase

This project is already implemented; changes should extend existing code over rebuilding.

- Frontend pages: `LandingPage`, `DemoPage`, `SearchPage`, `StacksPage`, `WishlistPage`, `AdministratorShell`, `LoginPage`, `RegisterPage`, `ProfilePage`, `MyProductsPage`.
- Core components: `ProductCard`, `SearchBar`, `Layout`, `Modal` stack, `ImageCropModal`, `UserProductForm`, auth context/guards.
- API modules: `auth`, `admin`, `stacks`, `ingredients`, `products`, `demo`, `wishlist`, `client`.
- Data foundation: D1 migrations and study material in `_research_raw/`.

## Personas

- Kevin (28): deep stack users, wants detail and traceable evidence.
- Sabine (44): low friction and clarity, wants practical clear guidance.
- Marco (32): performance-oriented, cost-aware, clear routines.

## Agent Team and Role Rules

### Shared roles

- Orchestrator: coordinates, delegates, validates, and reports outcomes.
- Dev-Agent: writes and edits code. Follows Cloudflare constraints and strict patterns.
- Science-Agent: validates dosing, evidence hierarchy, and source quality.
- Critic-Agent: stress-tests assumptions, risk, security, and value.
- Feature-Agent: roadmap and retention.
- UX-Agent: flow and interaction architecture.
- UI-Agent: visual hierarchy and trust tone.
- Mobile-Agent: responsive and touch-first behavior.
- Persona-Agent: persona-specific fit check.
- QA-Agent: edge cases, regressions, platform matrix.
- Legal-Agent: German legal review for pre-go-live claims and disclosures (on request, DE market).

### Agent Detail Rules

- **Dev-Agent**:
  - keep strict typing, avoid `any`.
  - read existing code before rewriting.
  - follow Cloudflare Worker constraints, and avoid Node-only runtime patterns.
  - prefer additive schema/data changes and existing modules.
- **Science-Agent**:
  - keep doses/recommendations linked to source links and hierarchy checks.
  - flag conflicting evidence and explain uncertainty.
- **UI/UX/Mobile-Agent**:
  - keep designs useful on small screens, with clear hierarchy and no hover-only actions.
  - keep product and safety information understandable without overloading.
- **Persona-Agent**:
  - cross-check each flow against Kevin, Sabine, Marco.
  - avoid depth-heavy choices that block clarity or speed.
- **QA-Agent**:
  - test empty states, invalid input, and failure paths.
  - validate admin/public flows for both desktop and mobile.
- **Critic-Agent**:
  - explicitly surface highest-risk failure mode and alternative solutions.

### Orchestrator Model Routing

- Use `gpt-5.3-codex-spark` with:
  - `medium` for routine scoped tasks
  - `high` for cautionary policy/review tasks
  - `xhigh` for trickier but bounded risk tasks
- Use `gpt-5.5` with high reasoning for complex, risky, architectural, security, legal, product-critical, or hard-to-test work.
- Escalate where ambiguity or quality risk rises.

## Required Handoff

Before ending a meaningful work session, update:

- `.agent-memory/current-state.md` when project state changed.
- `.agent-memory/next-steps.md` when priorities or follow-up tasks changed.
- `.agent-memory/handoff.md` with the exact continuation point.
- `.agent-memory/decisions.md` for product/architecture/data/workflow decisions.
- `.agent-memory/deploy-log.md` after deployments/migrations/production checks.
- `.agent-memory/local-secrets.md` only when secret storage locations change.

Do not write secrets, tokens, passwords, private API keys, or raw credential values into memory files.
Secret locations are documented in `.agent-memory/local-secrets.md`.

## Current Development Line

Production-like work happens on the Cloudflare line:

- Backend: `functions/api/[[path]].ts`, `functions/api/modules/*`, `functions/api/lib/*`
- Frontend: `frontend/src/*`
- Database: `d1-migrations/*`
- Cloudflare config: `wrangler.toml`

Legacy or historical docs may help, but this protocol and memory files are canonical for day-to-day operation.

## Definition of Done

Ein Feature is complete only when all of the following are true:

- Dev changes are validated against Cloudflare runtime constraints.
- Science/claims are source-backed with direct links.
- UX/Persona checks are considered before delivery.
- Mobile and desktop behavior is coherent and stable.
- QA has checked edge/error paths.
- Critic has reviewed for risks and regressions.
- Repo state reflects actual changes in the memory files.

## Never-Do Rules

- Orchestrator does not implement code or edit files directly.
- Add medical claims without citable sources and explicit links.
- Show affiliate labeling on individual product/CTA elements.
- Ignore existing code and rebuild from scratch without reason.
- Break Cloudflare worker constraints.
- Skip required handoff/progress updates needed by central hooks.
