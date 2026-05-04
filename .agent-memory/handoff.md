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

- Latest committed baseline before this handoff: `18a4141` -
  Security: Harden demo and user product moderation.
- Active local backend/schema WIP implements the product-model follow-up:
  `d1-migrations/0039_product_ingredient_model.sql`,
  `functions/api/modules/admin.ts`, `ingredients.ts`, `products.ts`,
  `stacks.ts`, `user-products.ts`, and `wishlist.ts`.
- `.agent-memory/current-state.md`, `.agent-memory/next-steps.md`,
  `.agent-memory/handoff.md`, and `.agent-memory/decisions.md` were updated
  for this WIP.
- `.claude/SESSION.md` and `.claude/settings.json` remain dirty and must not be
  touched.
- Frontend files are dirty from outside this backend task:
  `frontend/src/components/modals/Modal2Products.tsx`,
  `frontend/src/components/modals/UserProductForm.tsx`,
  `frontend/src/pages/AdminPage.tsx`, and `frontend/src/types/local.ts`.
  Do not revert them without explicit owner instruction.
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

1. Final legal/compliance review (DSB/AVV/provider checks) before SEO indexing.
2. Manual authenticated browser/mobile QA.
3. Review/apply/deploy the local product-model WIP and run remote D1 migration
   0039 before deploying code that queries the new columns.

## Deployed User Product Hardening

- Commit: `18a4141` - Security: Harden demo and user product moderation.
- Remote D1 migration `0038_trusted_product_submitters.sql` applied to
  `supplementstack-production`.
- Preview URL: `https://5b9c9907.supplementstack.pages.dev`.
- `d1-migrations/0038_trusted_product_submitters.sql` adds
  `users.is_trusted_product_submitter`.
- `functions/api/modules/user-products.ts`: POST is rate-limited per user,
  default status remains `pending`, trusted submitters auto-create `approved`
  products, approved user products are locked against user edit/delete, and
  rejected edits resubmit for moderation.
- `functions/api/modules/admin.ts`: admin user-product rows include the trusted
  submitter flag, admins can toggle trusted submitter status, and shop-domain
  resolve uses parsed hostname exact/subdomain matching.
- `functions/api/modules/products.ts`: `POST /api/products` is rate-limited per
  user.
- Frontend updates: Admin user-product tab can toggle trusted users; My
  Products shows status and disables edit/delete for approved products;
  ProductCard uses the same safe host matching.
- Checks passed: functions `npx tsc -p tsconfig.json`, frontend
  `npm run lint --if-present`, frontend `npm run test --if-present -- --run`,
  frontend `npm run build`, and `git diff --check` with CRLF warnings only.
- Smoke checks passed: D1 column exists; spoofed `amazon.de.evil.com` resolves
  to no shop; real `www.amazon.de` resolves to Amazon; unauthenticated admin
  user-products returns HTTP 401.

## Deployed Demo Hardening

- Commit: `18a4141` - Security: Harden demo and user product moderation.
- Preview URL: `https://5b9c9907.supplementstack.pages.dev`.
- `functions/api/modules/demo.ts`: `/api/demo/products` now returns up to 7
  starter products; `POST /api/demo/sessions` is KV rate-limited per IP and
  returns a compatibility key/expiresAt without inserting submitted stack JSON
  into D1; legacy GET returns `{ stack: [] }` for existing unexpired rows.
- `frontend/src/components/StackWorkspace.tsx`: Demo descriptions are kept in
  component state only and are not loaded from or written to localStorage.
- Checks passed: functions `npx tsc -p tsconfig.json`, frontend
  `npm run lint --if-present`, frontend `npm run test --if-present -- --run`,
  frontend `npm run build`, and `git diff --check` with CRLF warnings only.
- Smoke checks passed: preview/live root HTTP 200, preview/live
  `/api/demo/products` HTTP 200 with 7 starter products, and preview
  `POST /api/demo/sessions` HTTP 200 with empty-stack compatibility response.

## Model-Routing Reminder

- `Codex` remains Orchestrator and assigns Sub-Agent models.
- `gpt-5.3-codex-spark` reasoning modes: `medium` (simple), `high` (bounded careful), `xhigh` (more difficult but non-blocker).
- Escalate to `gpt-5.5` (high reasoning) for complex/risky/architectural/security/legal/product-critical or hard-to-test work.
