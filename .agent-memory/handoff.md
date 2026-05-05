# Handoff

Last updated: 2026-05-05

## Continuation Point

Continue from `main` after Search/Wishlist dead-code cleanup was committed,
deployed, and smoke-checked. No DB migrations were changed.

## Restart Startup (exact)

1. `AGENTS.md`
2. `CLAUDE.md`
3. `.agent-memory/current-state.md`
4. `.agent-memory/handoff.md`
5. `.agent-memory/next-steps.md`
6. `git status --short`

## Git / Worktree

- Latest committed/deployed cleanup:
  - `ee273a9` - Cleanup: Remove unused search and wishlist flows.
  - Preview URL: `https://0e174354.supplementstack.pages.dev`.
  - Live URL: `https://supplementstack.de`.
  - Deleted `frontend/src/pages/SearchPage.tsx`,
    `frontend/src/pages/WishlistPage.tsx`, `frontend/src/api/wishlist.ts`,
    `frontend/src/components/modals/Modal1Ingredient.tsx`,
    `frontend/src/components/modals/Modal2Products.tsx`,
    `frontend/src/components/modals/Modal3Dosage.tsx`, and
    `functions/api/modules/wishlist.ts`.
  - Removed wishlist import/mount from `functions/api/[[path]].ts`.
  - Removed `ProductCard` wishlist props/action block and stale
    `showWishlistButton={false}` use in `StackWorkspace`.
  - Removed unused `WishlistItem` and `LocalStackItem`; updated the
    `types/local.ts` file comment.
  - Updated `PrivacyPage` to stop listing Wishlist as an active processing
    purpose/data category.
  - Left DB tables/migrations and `functions/api/modules/auth.ts` account-delete
    wishlist cleanup untouched by request.
  - Reference scan has no remaining source hits for deleted Search/Wishlist
    pages, old modal components, frontend wishlist API, ProductCard wishlist
    props, or backend wishlist module. The only remaining `wishlist` source hit
    is `functions/api/modules/auth.ts:314`, the intentional account-delete
    cleanup.
  - Checks passed: frontend `npm run lint --if-present`; frontend
    `npm run build`; frontend `npm test -- --run` with no test files; functions
    `npx tsc -p tsconfig.json`.
  - Smoke checks passed: preview/live root 200 with
    `assets/index-BIAACOZy.js`; preview/live `GET /api/wishlist` 404;
    preview/live `/search` and `/wishlist` serve the SPA fallback asset for
    generic React 404 handling.
  - Existing unrelated dirty/untracked files still not related to this task:
    `.claude/SESSION.md`, `.claude/settings.json`, and root `logo.png`.
- Latest committed/deployed stack interval work:
  - `6c22463` - Feature: Add stack intake intervals.
  - `f5dfa74` - UX: Allow replacing stack products.
  - Remote D1 migration `0042_stack_item_intake_interval.sql` applied
    successfully to `supplementstack-production`.
  - Preview URL: `https://7abb76e8.supplementstack.pages.dev`.
  - Live URL: `https://supplementstack.de`.
  - Stack detail/update responses include ingredient rows on each item;
    ProductCard derives servings from parsed dosage plus product ingredient
    quantity before stack quantity fallback; the edit action is an amber
    icon-only pencil; the manual amount edit field is clearly marked as
    fallback.
  - Product replacement is in the stack edit flow: `EditProductModal` has
    `Produkt wechseln`, opens `AddProductModal` in replace mode for the same
    stack, replaces instead of adding, preserves `dosage_text`, `timing`, and
    `intake_interval_days`, and blocks duplicates in the same stack while
    exempting the replaced item.
  - Checks passed: functions `npx tsc -p tsconfig.json`; frontend
    `npm run lint --if-present`; frontend `npm run build`; frontend
    `npm test -- --run` with no test files; `git diff --check` with CRLF
    warnings only.
  - Smokes passed: preview/live root 200 with asset
    `assets/index-BZB9HYiO.js`; preview/live unauthenticated
    `POST /api/stacks/test/email` 401; remote pragma `has_col=1`; live temp
    API smoke created stack id 21 with interval 2 and one ingredient row, then
    deleted the temporary account.
  - Existing dirty/untracked files still not related to this task:
    `.claude/SESSION.md`, `.claude/settings.json`, and root `logo.png`.
- Latest committed/deployed work:
  - `f5dfa74` - UX: Allow replacing stack products.
  - `6c22463` - Feature: Add stack intake intervals.
  - `9babeae` - Fix: Calculate stack email costs from daily dose.
  - `eff1c6a` - Feature: Send stack emails via SMTP.
  - `ba92cd5` - UX: Align authenticated headers with app shell.
  - `03ae0f9` - Brand: Use uploaded logo in headers.
- Latest preview URL: `https://7abb76e8.supplementstack.pages.dev`.
- Live URL: `https://supplementstack.de`.
- Scope:
  - `functions/api/lib/mail.ts` adds a Worker SMTP-over-TLS helper via
    `cloudflare:sockets`.
  - `POST /api/stacks/:id/email` sends the authenticated user's stack summary
    to their own account email and is rate-limited to 5 sends/hour/user.
  - Stack email now includes product image, product/brand, active ingredient
    daily amounts, daily intake amount, timing, interaction notes, package
    price, monthly cost based on daily dose, and buy buttons.
  - Existing bad `stack_items.quantity` rows containing ingredient quantities
    are ignored for mail cost calculation when `dosage_text` plus product
    ingredient quantity can determine servings/day.
  - Forgot-password mail now uses SMTP instead of the Resend helper.
  - Non-secret SMTP config is in `wrangler.toml`; encrypted `SMTP_PASSWORD` is
    present in Cloudflare Pages production secrets.
  - `/stacks` now renders inside normal `Layout`; Demo still uses its standalone
    demo header.
  - `MyProductsPage` no longer uses an extra full-screen gradient shell.
  - Cleaned the user-supplied logo into `frontend/public/logo.png`.
  - Added shared `frontend/src/components/AppLogo.tsx`.
  - Normal app header, Stacks/Demo header, and Admin sidebar now use the same
    responsive logo asset.
- Checks passed:
  - Functions `npx tsc -p tsconfig.json`.
  - Frontend `npm run build`.
  - Frontend `npm run lint`.
  - Frontend `npm test -- --run` with no test files.
  - `git diff --check`.
  - Cloudflare Pages deploy compiled/uploaded successfully.
  - Live unauthenticated `POST /api/stacks/test/email` returned HTTP 401.
  - Live temporary-account smoke for logged-in `Stack mailen` returned
    `{ ok: true }`; the temporary stack/account were deleted afterward.
  - Live temporary-account forgot-password smoke returned the expected generic
    success response; the temporary account was deleted afterward.
  - Live D3 mail-format smoke: product 23 with `10000 IE täglich` and
    old-style `quantity=2000` returned stack total `12.5`, sent mail
    successfully, and deleted the temporary stack/account afterward.
  - Preview/live root asset check for `index-DdLiBTCO.js`.
  - Browser-harness checks confirmed `/stacks`, `/my-products`, and `/profile`
    have normal nav, one `/logo.png`, and no `.site-header`.
  - Preview/live HTTP checks for `/` and `/logo.png`.
  - Browser-harness checks on live root, `/demo`, and `/forgot-password`.
- Workspace note:
  - Root `logo.png` remains untracked and intentionally untouched as the
    source file supplied by the user.
  - `.claude/SESSION.md` and `.claude/settings.json` remain dirty and must not
    be touched.
- Prior launch-QA bundle:
  - `0b29fe0` - launch QA stack/profile flows.
  - `baa91a5` - live profile + stack warning smokes.
  - `1a3b8e6` - profile response path.
  - `cb76cf3` - D1 run handling.
  - `24b10b5` - guideline normalization.
- Remote D1 migration `0041_stack_item_product_sources.sql` was applied
  successfully to `supplementstack-production`.
- Latest preview: `https://5fb3de86.supplementstack.pages.dev`.
- Live `https://supplementstack.de` uses asset `index-BfFUmB15.js`.
- Final live smokes passed:
  - Profile `PUT /api/me` returned 200 with age 34, weight 82, gender
    `divers`, `guideline_source=studien`, and `is_smoker=0`.
  - Invalid gender `PUT /api/me` returned 400.
  - Own pending user product `QA L-Carnitin Triple Komplex` could be added to
    a temporary stack; `GET /api/stacks/:id` returned
    `product_type=user_product`; `GET /api/stack-warnings/:id` returned 200
    with 0 warnings; temp stack was deleted.
  - `/api/demo/products` returned 7 products and the D3 product quantity is
    2,000 IU.
  - Preview root and live root returned 200 with asset `index-BfFUmB15.js`;
    `/forgot-password` returned 200.
  - `/search` and `/wishlist` were SPA fallback only with no nav links and
    no explicit App/Layout routes before the local cleanup removed the page
    source files.
- Checks passed: functions `npx tsc -p tsconfig.json`; frontend
  `npm run lint --if-present`; frontend `npm run build`; frontend tests with
  no files passed earlier; `git diff --check`.
- Local Wrangler migration apply is still blocked before 0041 by the existing
  local state failing migration 0009 on missing `google_id`; remote is fine.
- `.claude/SESSION.md` and `.claude/settings.json` remain dirty and must not be
  touched.
- Branch: `main`.
- Current deployed implementation:
  - `PUT /api/me` validates profile payloads, loads the existing profile,
    computes final target values, runs a plain `UPDATE`, and builds the
    response from the target values.
  - `d1-migrations/0041_stack_item_product_sources.sql` rebuilds
    `stack_items` with explicit `catalog_product_id` and `user_product_id`
    plus a CHECK requiring exactly one reference. Legacy `product_id` is only
    read during backfill.
  - Stack API accepts legacy `{ id }` catalog payloads and new
    `{ id, product_type }` payloads, validates all rows before replace, uses
    `stack.user_id` for user-product ownership, and returns `product_type` in
    stack item responses.
  - Stack warnings UNION `product_ingredients` and
    `user_product_ingredients`, constrain user-product rows to the stack
    owner, and query the live `interactions.ingredient_id` /
    `partner_ingredient_id` schema with compatibility aliases.
  - `StackWorkspace` uses `catalog:id` / `user_product:id` keys, loads own
    pending/approved user products in add-product selection, and persists
    `product_type`.
  - Demo D3/K2 product seed/backfill now uses 2,000 IU D3 instead of 10,000 IU.
  - App/Layout route check found no active `/search` or `/wishlist` routes/nav
    links; local cleanup now removes their un-routed source files.
- Checks already passed locally: functions `npx tsc -p tsconfig.json`;
  frontend `npm run lint --if-present`; frontend `npm run build`;
  `git diff --check` with CRLF warnings only; isolated Python/SQLite migration
  0041 schema check; remote D1 syntax probe for the interactions query.
- Local `wrangler d1 migrations apply supplementstack-production --local`
  failed before 0041 at old migration `0009_auth_profile_extensions.sql`
  because the existing local Wrangler state lacks `google_id`.

## Closed Baseline

- Legal/legal-pages deploy is live: `/impressum`, `/datenschutz`, `/nutzungsbedingungen`, `/agb` (via
  `https://d6e92688.supplementstack.pages.dev` and `supplementstack.de`) with HTTP 200.
- GA4 consent implementation is live with Measurement ID `G-QVHTTK2CNP`; no static GA tag; gtag loads only after consent.
- Google Fonts import removed; system fonts only.
- D1 backup is verified and not an open action.
- Domain and core launch blockers in code already closed (profile DSGVO, product metadata, stack warning N+1,
  legal/footer pages, GA consent, mobile core flows, auth/session UX fixes, etc.).

## Open Top Queue

1. Entscheidung (2026-05-05): SearchPage und WishlistPage werden bewusst nur über
   Wildcard/404 erreicht; Roh-`raw`-Flags aus SearchPage-Daten gelten nicht mehr als
   Launch-Blocker. (Superseded by local cleanup: the source files are now deleted.)

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
