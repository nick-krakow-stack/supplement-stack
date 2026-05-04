# Handoff

Last updated: 2026-05-04

## Continuation Point

Use `.agent-memory/next-steps.md` as the source of truth for the current
top-queue. This handoff is only a short restart note.

## Git / Worktree

- Branch: `main`.
- Current last commit: `326050f` - Memory: Promote N+1 to top-of-queue
  cross-agent TODO list.
- Worktree is expected to be dirty from `.claude/SESSION.md` and
  `.claude/settings.json`; memory files may also be dirty from this cleanup.
- Do not treat `.claude/*` as part of the current implementation task.

## Closed Baseline

- Profile DSGVO self-service is closed in `78d8925`, deployed, and recorded in
  `808f228`.
- Product required package metadata hardening is live: data migration 0037 and
  API/frontend validation from `52ead1f` are both live per
  `.agent-memory/next-steps.md`.
- Robots pre-launch indexing block is closed.
- D1 backup verification is done.

## Open Top Queue

Pick from `.agent-memory/next-steps.md` first:

1. Stack-warnings N+1 query in `functions/api/modules/stacks.ts`.
2. Footer legal links: Impressum / Datenschutz / AGB.
3. Demo session DoS rate limit in `functions/api/modules/demo.ts`.

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
