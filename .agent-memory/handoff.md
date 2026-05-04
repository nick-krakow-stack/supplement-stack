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

- Latest committed/deployed baseline before this handoff: `29dcde5` -
  Feature: Add sub-ingredient product workflow.
- Sub-ingredient backend/schema work is committed, remote-migrated, and
  deployed.
- Remote D1 migration `0040_seed_ingredient_sub_ingredients.sql` was applied
  successfully to `supplementstack-production`.
- Migration control confirmed six `ingredient_sub_ingredients` rows:
  L-Carnitin children ALCAR/Tartrat/Fumarat and Omega-3 children EPA/DHA/DPA.
- Migration control confirmed `products.source_user_product_id` exists
  (`source_col=1`).
- Pages deploy succeeded. Preview:
  `https://421f79ea.supplementstack.pages.dev`; live:
  `https://supplementstack.de`.
- Local checks passed: functions `npx tsc -p tsconfig.json`; frontend
  `npm run lint --if-present`; frontend
  `npm run test --if-present -- --run` with no test files via
  passWithNoTests; frontend `npm run build`; `git diff --check`; mojibake scan
  for touched frontend/backend files.
- Smoke checks passed on live and preview:
  `/api/ingredients/10/sub-ingredients` 200 count 3 EPA/DHA/DPA;
  `/api/ingredients/13/sub-ingredients` 200 count 3 ALCAR/Tartrat/Fumarat;
  `/api/ingredients/10/products` 200 count 1 on live;
  `/api/demo/products` 200 count 7; `/api/admin/user-products`
  unauthenticated 401.
- Demo mode note: current `StackWorkspace` demo flow creates fresh client-side
  demo state on load and does not persist stack edits via `/api/stacks`; demo
  products come from `/api/demo/products`.
- Product-model and sub-ingredient backend follow-ups are deployed; remaining
  launch work is UI/admin management, manual QA, and policy/legal review.
- `.agent-memory/current-state.md`, `.agent-memory/next-steps.md`,
  `.agent-memory/handoff.md`, `.agent-memory/decisions.md`, and
  `.agent-memory/deploy-log.md` were updated for the completed deploy.
- `.claude/SESSION.md` and `.claude/settings.json` remain dirty and must not be
  touched.
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
3. Build a dedicated admin UI for managing sub-ingredient mappings; backend
   APIs already exist.
4. Manual browser QA of product submission flow on desktop/mobile, including
   sub-ingredient prompts and validation errors.
5. Affiliate/domain final policy review before Go-Live.

## Deployed Sub-Ingredient Product Workflow

- Commit: `29dcde5` - Feature: Add sub-ingredient product workflow.
- Remote D1 migration `0040_seed_ingredient_sub_ingredients.sql` applied to
  `supplementstack-production`.
- Seeded mappings: `L-Carnitin` -> `Acetyl-L-Carnitin`,
  `L-Carnitin Tartrat`, `L-Carnitin Fumarat`; `Omega-3` -> `EPA`, `DHA`,
  `DPA`.
- Public API exposes `GET /api/ingredients/:id/sub-ingredients`; ingredient
  detail may include `sub_ingredients`.
- Admin mapping API exists with audit logging, but no dedicated admin UI exists
  yet.
- Product and user-product saves validate parent/sub relations and max 50
  ingredient rows.
- Parent/child-aware product lookup, stack-warning dedupe, and admin publish
  race guard are live.

## Deployed Product Ingredient Publishing Model

- Commit: `1272e11` - Feature: Add product ingredient publishing model.
- Remote D1 migration `0039_product_ingredient_model.sql` applied successfully
  to `supplementstack-production`.
- Remote control query confirmed:
  `product_ingredients.search_relevant` column = 1,
  `user_product_ingredients` table = 1,
  `ingredient_sub_ingredients` table = 1, and
  `user_products.published_product_id` column = 1.
- Frontend build assets: JS `index-BvEYaSZm.js`, CSS `index-BxLAbVeG.css`.
- Deploy command: `wrangler pages deploy frontend/dist --project-name supplementstack`.
- Preview URL: `https://0ed675d5.supplementstack.pages.dev`.
- Smoke checks passed: preview/live root 200 with new asset; preview/live
  `/api/demo/products` 200 count 7; preview/live
  `/api/ingredients/1/products` 200 count 3; preview/live
  `/api/ingredients/1/recommendations` 200 count 4; preview/live
  unauthenticated product/admin product endpoints returned 401 as expected.
- Local checks before commit/deploy passed: functions
  `npx tsc -p tsconfig.json`, frontend lint, frontend Vitest with no test
  files, frontend build, `git diff --check` with CRLF warnings only, and
  mojibake `rg` check.
- Decision reminder: trusted submitters create approved/private
  `user_products`, but public catalog visibility requires admin publish into
  `products` / `product_ingredients`.

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
