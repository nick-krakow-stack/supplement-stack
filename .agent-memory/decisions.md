# Decisions

Last updated: 2026-05-01

## Shared Agent Memory

Decision: this repository uses `.agent-memory/*` as the canonical shared memory for Codex, Claude Code, and future agents.

Rationale:

- Avoid separate stale memories per tool.
- Make handoff state versionable and reviewable.
- Ensure each agent starts with the same project context.

Operational rule:

- `AGENTS.md` and `CLAUDE.md` must point to `.agent-memory/*`.
- `.claude/memory.md` is now a pointer/compatibility file, not the canonical memory.

## Orchestrator And Sub-Agent Operating Model

Decision: Claude and Codex both operate as Orchestrator in this repository, and practical implementation or file changes are delegated to responsible Sub-Agent roles.

Sub-Agent roles:

- Orchestrator
- Dev-Agent
- Science-Agent
- Critic-Agent
- Feature-Agent
- UX-Agent
- UI-Agent
- Mobile-Agent
- Persona-Agent
- QA-Agent
- Legal-Agent later / on request

Operational rule:

- The Orchestrator plans, delegates, reviews, coordinates, and summarizes.
- The Orchestrator does not implement code or edit files directly.
- Implementation and file edits are delegated to the responsible Sub-Agent, especially Dev-Agent for code changes.
- Delegation must stay efficient: only relevant bounded subtasks, short handoffs, and no unnecessary parallel agents.

## Automatic Handoff Snapshots

Decision: use `scripts/update-agent-handoff.ps1` for cheap automatic handoff snapshots.

Claude Code integration:

- `.claude/settings.json` runs the script on `PreCompact`.
- `.claude/settings.json` also runs the script after Bash tool use.

Rationale:

- Protects against token/session limits without requiring manual handoff.
- Avoids model-token usage because the snapshot is generated from git status and existing memory files.
- Keeps `.agent-memory/handoff.md` current enough for the next agent to resume.

## Secret Handling

Decision: local development secrets may remain in local-only files, but memory files only document locations and rules.

Canonical location index:

- `.agent-memory/local-secrets.md`

Operational rule:

- Never write raw token, password, API key, bearer token, or credential values into shared memory, docs, or handoff.

## Backend Line

Decision: continue production-like backend development in `functions/api/*`.

Rationale:

- The active app is Cloudflare Pages Functions + D1 + R2.
- Any older local backend line is behind the Cloudflare implementation.

## Internationalization

Decision: use separate translation tables instead of language suffix columns.

Pattern:

- `ingredient_translations`
- `dose_recommendation_translations`
- `verified_profile_translations`
- `blog_translations`

Rationale:

- New languages do not require schema changes.
- Admin editing can treat translations as first-class content.

## Admin Translations MVP

Decision: the first admin translations surface only manages `ingredient_translations`.

Operational rule:

- Admin route prefix is `/api/admin/translations/ingredients`.
- Public i18n playback remains separate and unchanged.
- `dose_recommendation_translations`, `verified_profile_translations`, and `blog_translations` stay out of the MVP UI until explicitly scoped.

## Recommendation Table Naming

Decision: keep dosage/science recommendations and product-to-ingredient recommendation links in separate tables with explicit names.

Important:

- `dose_recommendations` is the dosage/science recommendation table.
- `product_recommendations` is the product-to-ingredient recommendation links table.
- Migration 0036 renames the old `recommendations` table to `product_recommendations`.
- The public `/api/recommendations` route name remains for compatibility.
- Migration 0036 keeps a temporary `recommendations` view plus insert/delete triggers for deploy compatibility.
- Deploy order for this rename: apply remote D1 migration 0036 first, then deploy Cloudflare Pages code.

## Verified Profile Constraint

Decision: `dose_recommendations.verified_profile_id` has no database FK constraint.

Rationale:

- SQLite/D1 ALTER TABLE limitations during migration.

Operational rule:

- Backend code must validate referenced verified profiles where needed.
