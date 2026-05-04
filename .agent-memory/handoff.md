# Handoff

Last updated: 2026-05-04

## Continuation Point

Continue from `main` using the top queue in this file.

## Restart Startup (exact)

1. `AGENTS.md`
2. `CLAUDE.md`
3. `.agent-memory/current-state.md`
4. `.agent-memory/handoff.md`
5. `.agent-memory/next-steps.md`
6. `git status --short`

## Git / Worktree

- Latest committed baseline before this restart handoff: `2457345` — Docs: Record
  Codex model routing policy. A later memory-hand-off commit only snapshots this
  restart state.
- Worktree is expected dirty only in `.claude/SESSION.md` and `.claude/settings.json`
  (do not modify `.claude/*`).
- Branch: `main`.

## Closed Baseline

- Legal/legal-pages deploy is live: `/impressum`, `/datenschutz`, `/nutzungsbedingungen`, `/agb` (via
  `https://d6e92688.supplementstack.pages.dev` and `supplementstack.de`) with HTTP 200.
- GA4 consent implementation is live with Measurement ID `G-QVHTTK2CNP`; no static GA tag; gtag loads only after consent.
- Google Fonts import removed; system fonts only.
- D1 backup is verified and not an open action.
- Domain and core launch blockers in code already closed (profile DSGVO, product metadata, stack warning N+1,
  legal/footer pages, GA consent, mobile core flows, auth/session UX fixes, etc.).

## Open Top Queue

1. Demo session DoS rate limit in `functions/api/modules/demo.ts`.
2. Product POST rate limit in product write path.
3. `shop-domains/resolve` exact host matching in `functions/api/modules/admin.ts`.
4. Final legal/compliance review (DSB/AVV/provider checks) before SEO indexing.
5. Manual authenticated browser/mobile QA.

## Model-Routing Reminder

- `Codex` remains Orchestrator and assigns Sub-Agent models.
- `gpt-5.3-codex-spark` reasoning modes: `medium` (simple), `high` (bounded careful), `xhigh` (more difficult but non-blocker).
- Escalate to `gpt-5.5` (high reasoning) for complex/risky/architectural/security/legal/product-critical or hard-to-test work.
