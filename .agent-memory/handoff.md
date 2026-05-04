# Handoff

Last updated: 2026-05-04

## Continuation Point

Google Analytics 4 consent work is committed and deployed. Use
`.agent-memory/next-steps.md` for the current queue.

## Git / Worktree

- Branch: `main`.
- Current last code commit: `a18136d` - Feature: Add consent-based GA4
  analytics.
- Worktree is expected to be dirty from `.claude/SESSION.md` and
  `.claude/settings.json`; memory files may also be dirty from this cleanup.
- Do not treat `.claude/*` as part of the current implementation task.

## Closed Baseline

- Profile DSGVO self-service is closed in `78d8925`, deployed, and recorded in
  `808f228`.
- Product required package metadata hardening is live: data migration 0037 and
  API/frontend validation from `52ead1f` are both live per
  `.agent-memory/next-steps.md`.
- Stack-warnings N+1 is closed in `5905a20`: `GET /api/stack-warnings/:id`
  now fetches interactions with one batched SQL `IN (...)` lookup and preserves
  existing auth/ownership/404/403 semantics.
- GA4 consent implementation is closed in `a18136d` and deployed to
  `https://f876ad10.supplementstack.pages.dev`: no static GA script, lazy
  `gtag.js` after consent, localStorage choice persistence, SPA pageviews after
  consent, footer `Datenschutz` / `Cookie-Einstellungen`, and a minimal
  `/datenschutz` page. Live `/datenschutz` returns HTTP 200.
- Robots pre-launch indexing block is closed.
- D1 backup verification is done.

## Open Top Queue

Pick from `.agent-memory/next-steps.md` first:

1. Footer legal links: Impressum / AGB still missing; Datenschutz exists.
2. Demo session DoS rate limit in `functions/api/modules/demo.ts`.
3. Continue with the remaining audit backlog in `.agent-memory/next-steps.md`.

## Still Open

- Manual authenticated browser/mobile QA remains open.
- Legal/compliance review remains open and gates SEO indexing/public launch.

## Required Startup For Next Agent

1. Read `AGENTS.md`.
2. Read `CLAUDE.md`.
3. Read `.agent-memory/current-state.md`.
4. Read `.agent-memory/handoff.md`.
5. Read `.agent-memory/next-steps.md`.
6. Run `git status --short`.
