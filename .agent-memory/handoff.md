# Handoff

Last updated: 2026-05-04
Update mode: Manual memory-worker cleanup

## Current State

Supplement Stack is on the Cloudflare-native line:

- Frontend: React, Vite, TypeScript, Tailwind CSS.
- Backend: Cloudflare Pages Functions with Hono.
- Database: Cloudflare D1.
- Storage: Cloudflare R2 for product images.
- Deployment: Wrangler CLI / Cloudflare Pages.

Phase B, Phase C, and the integrated Phase D rollout are complete. Production
custom domain `https://supplementstack.de/` is live in parallel with Pages
preview URLs. Public SEO indexing remains intentionally blocked until legal and
compliance sign-off.

## Latest Relevant Work

Mobile core-flow polish is no longer local-only. It is committed and deployed:

- Commit: `c76bcf4` - UX: Improve mobile core flows.
- Preview URL: `https://d5b331fd.supplementstack.pages.dev`.
- Live domain `https://supplementstack.de/` returned HTTP 200 after deploy with
  JS `assets/index-Bl-g6o41.js` and CSS `assets/index-Cf3yP80d.css`.
- Checks passed: frontend `npm run lint --if-present`, frontend
  `npm run build`, and `git diff --check` with only LF/CRLF warnings.

Mobile polish scope completed for core flows: responsive header/nav, product
cards, SearchPage stack footer/chips, modal bottom sheets and touch targets,
product selection modal, dosage modal, user product form, and My Products
mobile rows.

P1 mobile collision fix is included: `ModalWrapper` uses `z-[60]`, and the
SearchPage fixed footer is hidden while a modal is open.

Claude has since committed robots and memory changes. Recent commits include:

- `1df7616` - Memory: Record robots.txt deploy and Top-7 sprint status.
- `1d8b288` - Fix: Disallow search crawlers by name in robots.txt.
- `70aa1f9` - Fix: Add robots.txt blocking all indexing pre-launch.
- `c76bcf4` - UX: Improve mobile core flows.

D1 backup verification is complete and must not be listed as an active next
step.

## Dirty Worktree

Expected unrelated dirty files from Claude/Profile work must remain dirty:

```text
M .claude/SESSION.md
M .claude/settings.json
M frontend/src/api/auth.ts
M frontend/src/pages/ProfilePage.tsx
M functions/api/modules/auth.ts
```

Memory files may also be dirty from this cleanup:

```text
M .agent-memory/current-state.md
M .agent-memory/handoff.md
M .agent-memory/next-steps.md
```

Do not undo, restage, or rework Claude's robots commits or unrelated dirty
Profile/auth files.

## Next Step

Run real-device/browser QA at 375px, 390px, and 430px for:

- Demo flow.
- Logged-in user flow.
- Admin flow.

Continue usability polish only if QA finds issues. Current focus is validation,
not deployment.

## Constraints For Next Agent

- Required startup: read `AGENTS.md`, `CLAUDE.md`,
  `.agent-memory/current-state.md`, this handoff, and
  `.agent-memory/next-steps.md`, then run `git status --short`.
- Do not write secrets, tokens, passwords, or raw credential values into memory
  files.
- Do not touch `.claude/SESSION.md`, `.claude/settings.json`,
  `frontend/src/api/auth.ts`, `frontend/src/pages/ProfilePage.tsx`,
  `functions/api/modules/auth.ts`, or robots/public files unless Nick
  explicitly asks.
- Keep implementation compatible with Cloudflare Workers / Pages Functions.
- Use code and migrations as source of truth when docs conflict.
