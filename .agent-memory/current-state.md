# Current State

Last updated: 2026-05-05

Model-routing workflow policy for Codex/Sub-Agent delegation is initially recorded in
commit `2457345`; this restart handoff extends it with Spark
`medium/high/xhigh` mode guidance.

## Project

Supplement Stack is a Cloudflare-native supplement management app.

- Frontend: React, Vite, TypeScript, Tailwind CSS.
- Backend: Cloudflare Pages Functions with Hono.
- Database: Cloudflare D1.
- Storage: Cloudflare R2 for product images.
- KV: rate limiting / cache-related bindings.
- Deployment: Wrangler CLI preferred, GitHub Actions as fallback.

## Active Source Of Truth

Use these files and directories for production-like development:

- `functions/api/[[path]].ts`
- `functions/api/modules/*`
- `functions/api/lib/*`
- `frontend/src/*`
- `d1-migrations/*`
- `wrangler.toml`

Recently refreshed docs for the Cloudflare line:

- `README.md`
- `DEPLOYMENT.md`
- `docs/implementation-status.md`
- `docs/agent-planner.md`

Treat parts of `.claude/SESSION.md` and older scaffold-era notes as historical
unless verified against code.

## Current Phase

## Email Verification - Local

Email verification is implemented locally but not committed, migrated remotely,
or deployed:

- New owned migration: `d1-migrations/0043_email_verification.sql`.
- Migration 0043 adds `users.email_verified_at`, backfills existing users as
  verified, and creates `email_verification_tokens` for hashed token storage
  with expiry metadata. It intentionally does not add duplicate legacy token
  columns to `users`.
- Registration creates a 48-hour verification token, stores only its SHA-256
  hash in `email_verification_tokens`, sends the raw token through the existing SMTP helper, and still returns
  a login token if SMTP sending fails. The frontend then routes the user to
  `/verify-email` with a clear status.
- New backend routes:
  - `POST /api/auth/verify-email` verifies a raw token and clears token fields.
  - `POST /api/auth/resend-verification` is authenticated and rate-limited to
    3 sends/hour/user.
- `/api/auth/login`, `/api/me`, and `PUT /api/me` now expose
  `email_verified_at` to the frontend.
- Frontend adds `VerifyEmailPage`, `/verify-email`, resend actions, login and
  registration nudges, and an unobtrusive profile status. Normal login and app
  usage are not blocked for unverified accounts.
- Validation passed locally: functions `npx tsc -p tsconfig.json`, frontend
  `npx tsc --noEmit`, frontend `npm run lint --if-present`, frontend
  `npm run build`, frontend `npm test -- --run` (5 tests), and
  `git diff --check` with CRLF warnings only.
- Coordination note: unrelated health-claims audit work is also present in the
  same worktree, including untracked `d1-migrations/0044_health_claim_content_audit.sql`.
## Health-Claims Content Audit - Local

Health-claims/content audit cleanup is implemented locally but not committed or deployed:

- New migration: `d1-migrations/0044_health_claim_content_audit.sql`.
- Scope: conservative German wording cleanup only. No dose numbers, units, source URLs, product prices, or product-recommendation relationships changed.
- Frontend wording now avoids stronger health-claim language in the landing page, profile goals placeholder, stack dose-selection labels, ProductCard fallback warnings, admin dose wording, product-ranking/admin labels, user-product ingredient hints, privacy wording, and affiliate disclaimer.
- Seed/live-data cleanup in 0044 targets high-risk wording in current `ingredients`, `ingredient_forms`, `dose_recommendations`, `interactions`, `products`, and German `ingredient_translations` fields. Examples include replacing detox/heavy-metal wording, Goldstandard/therapeutic wording, disease-context notes, and strong outcome verbs with source/context language.
- Official audit baseline used: EU Commission Nutrition and Health Claims page, EU Register page, and Regulation (EC) No 1924/2006 principle that claims in EU labelling/presentation/advertising must be clear, accurate, evidence-based, non-misleading, and authorized/condition-bound where used.
- Local validation passed: frontend `npx tsc --noEmit`, frontend `npm run lint --if-present`, frontend `npm run build`, frontend `npm test -- --run` (5 tests), functions `npx tsc -p tsconfig.json`, minimal SQLite execution of migration 0044, targeted frontend risk-term scan, and `git diff --check` with CRLF warnings only.
- Concurrent unrelated email-verification work is present in the worktree, including owned migration `d1-migrations/0043_email_verification.sql`. Migration 0043 was not edited by this audit pass.
Launch-readiness implementation bundle is committed, deployed, and smoke-checked:

- Commit: `6a639cd` - Feature: Close launch readiness gaps.
- Preview: `https://d8e1340c.supplementstack.pages.dev`.
- Live: `https://supplementstack.de`.
- Stack/Product calculations now use `basis_quantity`/`basis_unit`, compatible
  mass-unit conversion (`g`/`mg`/`ug`/`µg`), interval-aware cost/range math, and
  selected target dose in Stack product previews. IU/IE is normalized but not
  converted to mass units.
- D3 reference case is covered by tests: `2000 IU` per `3 Tropfen`, target
  `10000 IE` daily => `15 Tropfen`, `66` days, dose-based monthly cost.
- Admin now has UI/API surfaces for sub-ingredient mappings,
  dose-recommendation CRUD, and audit-log viewing. New admin backend routes are
  admin-guarded; audit-log response redacts sensitive `changes` keys and the UI
  only shows IP/User-Agent inside expanded details.
- Legal/compliance preflight text updates are live on privacy, terms, imprint,
  registration consent, landing copy, and `LegalDisclaimer`. This is a
  technical preflight, not external legal sign-off.
- Context-near affiliate labels were added to ProductCard buy buttons and stack
  email buy links.
- Strict frontend TypeScript is now clean via `npx tsc --noEmit`; the previous
  frontend latent TypeScript issues were fixed as part of the integration.
- Validation passed: frontend `npx tsc --noEmit`, frontend
  `npm run lint --if-present`, frontend `npm run build`, frontend
  `npm test -- --run` (5 tests), functions `npx tsc -p tsconfig.json`, and
  `git diff --check`.
- Smoke checks passed: preview/live root 200 with `assets/index-BlZlfAwp.js`;
  preview/live `GET /api/admin/audit-log` and
  `GET /api/admin/dose-recommendations` return 401 unauthenticated;
  preview/live `GET /api/demo/products` returns 7 products and top-level
  `basis_quantity`, `basis_unit`, and `search_relevant` fields.

Phase B is complete. Phase C is complete. Phase D bundle is committed,
remote-migrated, and deployed to Cloudflare Pages preview.

Search/Wishlist dead-code cleanup is committed, deployed, and smoke-checked:

- Commit: `ee273a9` - Cleanup: Remove unused search and wishlist flows.
- Preview: `https://0e174354.supplementstack.pages.dev`.
- Live: `https://supplementstack.de`.
- Deleted `frontend/src/pages/SearchPage.tsx`,
  `frontend/src/pages/WishlistPage.tsx`, `frontend/src/api/wishlist.ts`,
  `frontend/src/components/modals/Modal1Ingredient.tsx`,
  `frontend/src/components/modals/Modal2Products.tsx`,
  `frontend/src/components/modals/Modal3Dosage.tsx`, and
  `functions/api/modules/wishlist.ts`.
- Removed the `/api/wishlist` Hono module import/mount from
  `functions/api/[[path]].ts`.
- Removed unused wishlist props/action UI from `ProductCard` and the stale
  `showWishlistButton={false}` caller in `StackWorkspace`.
- Removed unused wishlist/local modal-flow types and updated active privacy
  wording so it no longer describes Wishlist as an app feature.
- DB schema/migrations and account-delete cleanup for the existing wishlist
  table were intentionally left untouched.
- Reference scan passed: no remaining source references to deleted SearchPage,
  WishlistPage, old modal components, wishlist frontend API, ProductCard
  wishlist props, or wishlist backend module remain. The only remaining
  `wishlist` source hit is the intentional account-delete cleanup in
  `functions/api/modules/auth.ts`.
- Validation passed: frontend `npm run lint --if-present`, frontend
  `npm run build`, frontend `npm test -- --run` with no test files, and
  functions `npx tsc -p tsconfig.json`.
- Smoke checks passed: preview/live root return 200 with
  `assets/index-BIAACOZy.js`; preview/live `GET /api/wishlist` returns 404;
  preview/live `/search` and `/wishlist` return the SPA fallback asset and the
  React app handles them through generic 404 routing.

Stack item intake intervals and stack product replacement are committed,
remote-migrated where needed, deployed, and live-smoked:

- Commit: `6c22463` - Feature: Add stack intake intervals.
- Follow-up commit: `f5dfa74` - UX: Allow replacing stack products.
- Remote D1 migration `0042_stack_item_intake_interval.sql` applied
  successfully to `supplementstack-production`.
- Final preview: `https://7abb76e8.supplementstack.pages.dev`.
- Live: `https://supplementstack.de`.
- Migration 0042 adds
  `stack_items.intake_interval_days INTEGER NOT NULL DEFAULT 1 CHECK
  (intake_interval_days >= 1)`.
- Backend stack create/update now accepts and persists `intake_interval_days`;
  `loadStackItems` and stack-mail item rows return it.
- Stack email keeps dose/intake amount on the intake day, renders the interval
  separately as `tÃ¤glich` or `alle X Tage`, and calculates package range and
  monthly cost from effective daily usage (`servingsPerIntake / intervalDays`).
- Missing shop links in stack emails now show `Kauf-Link fehlt - bitte Produkt
  melden` instead of the normal `Kein Link` placeholder.
- `StackWorkspace` now lets stack products be edited in place for dosage,
  timing, portions per intake day, and intake interval; demo updates stay local
  and authenticated updates persist through the existing stack PUT flow.
- Review follow-up: `GET /api/stacks/:id` and stack `PUT` responses now attach
  product ingredient rows to each item via the existing stack-mail ingredient
  loader/grouping (`ingredient_id`, `quantity`, `unit`, `search_relevant`).
  `ProductCard` now uses the same parsed `dosage_text` + ingredient-quantity
  logic before falling back to stack quantity, preventing old bad rows such as
  D3 `quantity=2000` from corrupting range/monthly-cost calculations after
  reload. The product edit action is now an amber icon-only pencil button, and
  the manual amount field is labeled as fallback.
- Product replacement is supported in the stack edit flow: `EditProductModal`
  has `Produkt wechseln`, opens `AddProductModal` in replace mode for the same
  stack, replaces the old product instead of adding another item, preserves
  `dosage_text`, `timing`, and `intake_interval_days`, and blocks duplicates in
  the same stack while exempting the replaced product itself.
- Validation passed: functions `npx tsc -p tsconfig.json`, frontend
  `npm run lint --if-present`, frontend `npm run build`, frontend
  `npm test -- --run` with no test files, and `git diff --check` with CRLF
  warnings only.
- Smoke checks passed: preview/live root returned 200 with asset
  `assets/index-BZB9HYiO.js`; preview/live unauthenticated
  `POST /api/stacks/test/email` returned 401; remote pragma confirmed
  `intake_interval_days` exists (`has_col=1`); live temporary API smoke created
  stack id 21 with `intake_interval_days=2` and one ingredient row, then
  deleted the temporary account.

All-Inkl SMTP mail sending is committed and deployed:

- Latest mail-format/cost fix: `9babeae` - Fix: Calculate stack email costs
  from daily dose. Preview: `https://c673fd9a.supplementstack.pages.dev`;
  live: `https://supplementstack.de`.
- Stack emails now render product image, product/brand, active ingredient daily
  amounts, daily intake amount, timing, stack interaction notes, package price,
  monthly cost based on daily dose, and buy buttons.
- Mail cost calculation no longer multiplies package price by
  `stack_items.quantity`. Existing bad rows such as D3 `quantity=2000` are
  handled by parsing `dosage_text` and product ingredient quantity.
- D3 example verified live: product 23 (`Vitamin D3 2000 IU Tropfen`), target
  `10000 IE tÃ¤glich`, and old-style `quantity=2000` produced stack total
  `12.5` and sent mail successfully; temporary smoke user/stack were deleted.
- Commit: `eff1c6a` - Feature: Send stack emails via SMTP.
- Preview: `https://76fde482.supplementstack.pages.dev`.
- Live: `https://supplementstack.de`.
- `functions/api/lib/mail.ts` implements a Cloudflare Worker SMTP-over-TLS
  helper via `cloudflare:sockets`.
- `POST /api/stacks/:id/email` sends the authenticated user's stack summary to
  their own account email and is rate-limited to 5 sends per hour per user.
- Forgot-password mail now uses the same SMTP helper instead of the old Resend
  path.
- `wrangler.toml` contains non-secret All-Inkl SMTP settings for
  `noreply@supplementstack.de`; the raw mailbox password is intentionally not
  stored in code, memory, or command history.
- Cloudflare Pages has the required encrypted `SMTP_PASSWORD` secret.
- DNS checks passed: MX points to `w020a88d.kasserver.com` and SPF includes
  `spf.kasserver.com`; DMARC remains a pre-launch follow-up.
- Validation passed: functions TypeScript compile, frontend build, frontend
  lint, frontend Vitest no-test run, `git diff --check` with CRLF warnings
  only, Pages deploy compile/upload, live unauthenticated
  `POST /api/stacks/test/email` returning HTTP 401, logged-in temporary stack
  email smoke to the All-Inkl mailbox, and forgot-password smoke to the same
  mailbox. Temporary smoke users/stacks were deleted afterward.

- Logo/header branding is committed and deployed:

  - Commit: `03ae0f9` - Brand: Use uploaded logo in headers.
  - The user-supplied root `logo.png` was cleaned into
    `frontend/public/logo.png` by removing the baked checkerboard background
    and cropping transparent padding.
  - New shared `frontend/src/components/AppLogo.tsx` centralizes logo usage.
  - Normal app header, Stacks/Demo standalone header, and Admin sidebar now use
    the same `/logo.png` asset with responsive sizing.
  - Preview: `https://47c4db46.supplementstack.pages.dev`.
  - Live: `https://supplementstack.de`.
  - Validation passed: frontend `npm run build`, frontend `npm run lint`,
    frontend `npm test -- --run` with no test files, `git diff --check`, HTTP
    checks for preview/live `/` and `/logo.png`, and browser-harness checks for
    root, `/demo`, and `/forgot-password` logo rendering on the live domain.
  - The original root-level `logo.png` remains untracked and intentionally
    untouched as the source file supplied by the user.

- Authenticated app-shell header alignment is committed and deployed:

  - Commit: `ba92cd5` - UX: Align authenticated headers with app shell.
  - `/stacks` now renders inside the normal `Layout` header instead of the
    standalone StacksHeader. Demo keeps the standalone demo header.
  - `StackWorkspace` supports `standaloneHeader` and defaults it to demo-only.
  - `MyProductsPage` no longer wraps itself in an extra full-screen gradient
    shell, so it visually belongs to the normal app layout.
  - Preview: `https://3c09e165.supplementstack.pages.dev`.
  - Live: `https://supplementstack.de`.
  - Validation passed: frontend build, frontend lint, frontend Vitest no-test
    run, `git diff --check`, preview/live root asset check, and
    browser-harness checks confirming `/stacks`, `/my-products`, and
    `/profile` have one `/logo.png`, normal nav, and no `.site-header`.

- Decision update (2026-05-05): SearchPage/WishlistPage and the old
  Search-only modal flow have been removed from active source. `/search` and
  `/wishlist` now rely on the generic SPA fallback/404 behavior rather than
  retained page files.

Launch QA stack/profile fixes are committed, remote-migrated, deployed, and
live-smoked:

- `PUT /api/me` now validates profile payloads, loads the existing profile,
  computes final target values with explicit omitted-vs-provided key handling,
  runs a plain `UPDATE`, and builds the response from those target values so no
  post-mutation SELECT/RETURNING/batch parsing can turn persistence into a 500.
- Guideline source input is normalized in register and `PUT /api/me`: accepted
  values are `DGE`, `Studien`/`studien`, and `Influencer`/`influencer`, stored
  as `DGE`, `studien`, or `influencer`. `PUT /api/me` also validates `gender`
  and `diet` before DB update.
- Remote D1 migration `0041_stack_item_product_sources.sql` was applied
  successfully to `supplementstack-production`; it rebuilds `stack_items`
  from ambiguous `product_id` to explicit nullable `catalog_product_id` and
  `user_product_id` columns with a CHECK requiring exactly one reference.
  Existing `product_id` values are backfilled into `catalog_product_id`.
- Stack create/update still accepts legacy `{ id }` payloads as catalog
  products and accepts `{ id, product_type: 'catalog' | 'user_product' }`.
  Backend validation checks catalog products against approved/public
  `products`, and user products against the stack owner with status
  `pending` or `approved`.
- `GET /api/stacks/:id` returns a UNION of catalog products and user products
  with `product_type` in each item. User-product joins are constrained to the
  stack owner. `GET /api/stack-warnings/:id` evaluates both
  `product_ingredients` and `user_product_ingredients`, uses the live
  `interactions.ingredient_id` / `partner_ingredient_id` schema, and aliases
  results back to `ingredient_a_id` / `ingredient_b_id`.
- `StackWorkspace` keeps string keys `catalog:id` and `user_product:id`,
  loads own pending/approved user products into the add-product modal, and
  persists the source discriminator in stack payloads.
- Demo D3/K2 seed was reduced from 10,000 IU to 2,000 IU D3 in both the fresh
  seed and migration 0041 backfill for existing databases.
- Route/header check found no active `/search` or `/wishlist` App/Layout routes
  or nav links; the previously un-routed page files were later removed in the
  local Search/Wishlist dead-code cleanup.
- Bundle commits: `0b29fe0` (launch QA stack/profile flows), `baa91a5` (live
  profile + stack warning smokes), `1a3b8e6` (profile response path),
  `cb76cf3` (D1 run handling), and `24b10b5` (guideline normalization).
- Latest preview: `https://5fb3de86.supplementstack.pages.dev`; live
  `https://supplementstack.de` uses asset `index-BfFUmB15.js`.
- Final live smokes passed: profile `PUT /api/me` returned 200 with age 34,
  weight 82, gender `divers`, `guideline_source=studien`, `is_smoker=0`;
  invalid gender returned 400; own pending user product
  `QA L-Carnitin Triple Komplex` could be added to a temporary stack,
  `GET /api/stacks/:id` returned `product_type=user_product`,
  `GET /api/stack-warnings/:id` returned 200 with 0 warnings, and the temp
  stack was deleted; `/api/demo/products` returned 7 products with D3 product
  quantity 2,000 IU; preview/live root returned 200 with
  `index-BfFUmB15.js`; `/forgot-password` returned 200; `/search` and
  `/wishlist` remain SPA fallback only with no nav links or explicit App/Layout
  routes.
- Checks passed: functions `npx tsc -p tsconfig.json`; frontend
  `npm run lint --if-present`; frontend `npm run build`; frontend tests with
  no files passed earlier; `git diff --check` with CRLF warnings only; isolated
  Python/SQLite check for migration 0041. A remote D1 syntax probe for the new
  interactions query returned the D3/K2 row successfully.
- `wrangler d1 migrations apply supplementstack-production --local` could not
  reach 0041 because the existing local Wrangler state fails earlier at
  `0009_auth_profile_extensions.sql` with missing `google_id`; this is a local
  state issue and not an 0041 syntax failure.

Sub-ingredient product workflow is committed, remote-migrated, and deployed:

- Commit: `29dcde5` - Feature: Add sub-ingredient product workflow.
- Remote D1 migration `0040_seed_ingredient_sub_ingredients.sql` was applied
  successfully to `supplementstack-production`.
- Migration control confirmed `ingredient_sub_ingredients` count = 6:
  `L-Carnitin` -> `Acetyl-L-Carnitin`, `L-Carnitin Tartrat`,
  `L-Carnitin Fumarat`; `Omega-3` -> `EPA`, `DHA`, `DPA`.
- Migration control confirmed `products.source_user_product_id` exists
  (`source_col=1`).
- Public API has `GET /api/ingredients/:id/sub-ingredients`, and
  `GET /api/ingredients/:id` also includes `sub_ingredients`.
- Admin API has sub-ingredient mapping CRUD with admin auth, validation, and
  audit logging. A dedicated admin UI for managing mappings is still open.
- `POST/PUT /api/products` and `POST/PUT /api/user-products` validate
  ingredient existence, form ownership, parent/sub relations, and cap ingredient
  arrays at 50 rows before saving.
- Parent ingredient product lookup and recommendation joins are parent/child
  aware and dedupe product results.
- Stack warnings evaluate effective ingredient IDs per product so child rows
  win over a simultaneous parent row for the same parent.
- Admin publish sets `products.source_user_product_id` and returns existing
  published payloads idempotently on source races.
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

Product-model follow-up is committed, remote-migrated, and deployed:

- Commit: `1272e11` - Feature: Add product ingredient publishing model.
- Remote D1 migration `d1-migrations/0039_product_ingredient_model.sql` was
  applied successfully to `supplementstack-production`.
- Remote control query confirmed:
  `product_ingredients.search_relevant` column = 1,
  `user_product_ingredients` table = 1,
  `ingredient_sub_ingredients` table = 1, and
  `user_products.published_product_id` column = 1.
- The migration extends catalog `product_ingredients`, adds durable
  `user_product_ingredients`, adds `ingredient_sub_ingredients`, and adds
  `user_products.published_product_id` plus `published_at`.
- `functions/api/modules/products.ts` no longer requires exactly one
  `is_main` ingredient; `is_main` is now legacy/display metadata.
- `functions/api/modules/user-products.ts` accepts optional `ingredients`
  arrays, stores rows in `user_product_ingredients`, and returns ingredient
  rows on list/create/update.
- `functions/api/modules/admin.ts` returns user-product ingredient rows and
  adds idempotent `PUT /api/admin/user-products/:id/publish` to convert a
  user product into public approved catalog `products` + `product_ingredients`.
- Public ingredient product lists, product recommendations, stack-warning
  interaction lookup, stacks, and wishlist now rely on approved/public catalog
  products and search-relevant ingredient rows where applicable.
- Trusted submitters create `user_products` as approved/private moderation
  state, but not auto-published into the catalog. Public catalog visibility
  requires admin publish so verified search-relevant ingredient rows are copied
  into `products` / `product_ingredients`.
- Local checks before commit/deploy passed: functions
  `npx tsc -p tsconfig.json`; frontend lint; frontend Vitest with no test
  files; frontend build; `git diff --check` with CRLF warnings only; mojibake
  `rg` check.
- Frontend build assets: JS `index-BvEYaSZm.js`, CSS `index-BxLAbVeG.css`.
- Deploy command: `wrangler pages deploy frontend/dist --project-name supplementstack`.
- Preview URL: `https://0ed675d5.supplementstack.pages.dev`.
- Smoke checks passed: preview root 200 and has new asset; live root 200 and
  has new asset; preview/live `/api/demo/products` 200 count 7; preview/live
  `/api/ingredients/1/products` 200 count 3; preview/live
  `/api/ingredients/1/recommendations` 200 count 4; preview/live unauth admin
  or user product endpoints returned 401 as expected.
- Product-model sub-ingredient backend follow-up is superseded by `29dcde5`;
  the remaining gap is a dedicated admin UI for managing mappings and manual
  browser QA of the product submission flow.

Demo session hardening is committed, migrated, and deployed:

- Commit: `18a4141` - Security: Harden demo and user product moderation.
- Preview URL: `https://5b9c9907.supplementstack.pages.dev`.
- `functions/api/modules/demo.ts` now limits `/api/demo/products` to 7 starter
  products server-side.
- `POST /api/demo/sessions` uses the existing KV `checkRateLimit` helper per
  client IP (`10` requests per 15 minutes) and no longer writes submitted
  `stack_json` into D1.
- `GET /api/demo/sessions/:key` no longer returns persisted Stack JSON; existing
  unexpired legacy rows resolve to `{ stack: [] }`, while missing/expired keys
  return 404.
- `frontend/src/components/StackWorkspace.tsx` keeps Demo stack descriptions in
  component state only; Demo mode does not load or write the localStorage
  description cache.
- Local checks passed: `npx tsc -p tsconfig.json` in `functions/`,
  `npm run lint --if-present` in `frontend/`,
  `npm run test --if-present -- --run` in `frontend/` with no test files via
  `--passWithNoTests`, `npm run build` in `frontend/`, and `git diff --check`
  with CRLF warnings only.
- Smoke checks passed on preview/live: root HTTP 200, `/api/demo/products`
  HTTP 200 with 7 starter products, and preview `POST /api/demo/sessions`
  HTTP 200 with an empty-stack compatibility response.

User product moderation and shop-domain hardening is implemented and deployed:

- Commit: `18a4141` - Security: Harden demo and user product moderation.
- New D1 migration
  `d1-migrations/0038_trusted_product_submitters.sql` adds
  `users.is_trusted_product_submitter`.
- Remote D1 migration `0038_trusted_product_submitters.sql` was applied to
  `supplementstack-production`; control query confirmed
  `users.is_trusted_product_submitter` exists.
- `POST /api/user-products` is KV rate-limited per user and creates products as
  `pending` by default, or `approved` immediately for trusted submitters.
- User-owned `approved` user products are server-side locked against user
  update/delete; rejected edits resubmit as pending unless the submitter is
  trusted.
- Admin user-product moderation now returns the submitter trusted flag and has
  `PUT /api/admin/users/:id/trusted-product-submitter` with audit logging.
- `POST /api/products` is KV rate-limited per user.
- `/api/shop-domains/resolve` and ProductCard shop matching now parse hostnames
  and allow only exact domain or subdomain matches, preventing spoofed hosts
  such as `amazon.de.evil.com`.
- Admin and My Products UI expose trusted submitter controls, user-product
  status badges, and edit/delete lock messaging for approved user products.
- Local checks passed: `npx tsc -p tsconfig.json` in `functions/`,
  `npm run lint --if-present` in `frontend/`,
  `npm run test --if-present -- --run` in `frontend/` with no test files via
  `--passWithNoTests`, `npm run build` in `frontend/`, and `git diff --check`
  with CRLF warnings only.
- Smoke checks passed on preview/live: `/api/shop-domains/resolve` rejects
  `amazon.de.evil.com`, accepts `www.amazon.de`, and unauthenticated
  `/api/admin/user-products` returns HTTP 401.
- Product-model caveat superseded by `1272e11`: user products now have durable
  ingredient rows and admin catalog publishing through
  `user_products.published_product_id`. `approved` remains the private
  moderation/lock state; public visibility requires admin publish.

Product required package metadata hardening is committed, remote-migrated, and
live:

- Code commit: `52ead1f` - Data: Require complete product package metadata.
- Remote D1 migration
  `d1-migrations/0037_backfill_product_required_metadata.sql` was applied to
  `supplementstack-production`.
- Remote D1 control query for legacy products 1-21 returned
  `missing_count = 0` for missing required fields: brand, serving size/unit,
  servings per container, container count, and main ingredient quantity/unit.
- Live `/api/demo/products` returned HTTP 200 from the remote database and
  shows the backfilled data, e.g. `Vitamin D3/K2 Tropfen` with brand
  `Supplement Stack Demo`, `serving_size=1`, `serving_unit=Tropfen`, and
  `servings_per_container=30`.
- The committed API/frontend validation changes from `52ead1f` rode along with
  the Profile DSGVO deploy on 2026-05-04. Preview:
  `https://16edb9e2.supplementstack.pages.dev`; build assets:
  `index-Dkeio0yL.js` / `index-RAoQ0gyV.css`.
- Both the product metadata code validation and the backfilled data are live.
- Checks before commit passed: frontend `npm run lint --if-present`, frontend
  `npm run build`, functions `npx tsc -p tsconfig.json`, and
  `git diff --check` with CRLF warnings only.
- Later product-model follow-up is superseded by `29dcde5`; remaining launch
  work is admin UI mapping management, product-submission browser QA, and final
  affiliate/domain policy review.

Production custom domain `supplementstack.de` is live in parallel to the
Cloudflare Pages preview URLs. All recent deploys have been published to both
the subdomain and live domain. Public SEO indexing is intentionally deferred
until legal/compliance is cleared.

Stack-warnings N+1 is fixed, committed, and deployed:

- Commit: `5905a20` - Fix: Batch stack warning interaction lookup.
- `GET /api/stack-warnings/:id` in `functions/api/modules/stacks.ts` no longer
  runs an O(n^2) pair loop with one query per ingredient pair.
- It now returns `{ warnings: [] }` immediately for stacks with 0 or 1
  ingredient id, and otherwise uses one SQL query with dynamic `IN (...)`
  placeholders for both `ingredient_a_id` and `ingredient_b_id`.
- Auth, ownership, 404, and 403 semantics are unchanged.
- Checks passed: `npx tsc -p tsconfig.json` in `functions`; `git diff --check`
  with only CRLF warnings; `npm run build` in `frontend`.
- Deploy command: `. .\scripts\use-supplementstack-cloudflare.local.ps1; npx wrangler pages deploy frontend/dist --project-name supplementstack`.
- Preview URL: `https://1c23aea8.supplementstack.pages.dev`.
- Preview root returned HTTP 200 with assets `index-Dkeio0yL.js` /
  `index-RAoQ0gyV.css`; preview unauth `/api/stack-warnings/1` returned HTTP
  401; live `https://supplementstack.de/api/stack-warnings/1` returned HTTP
  401.
- Wrangler warned about a dirty worktree because `.claude/SESSION.md` and
  `.claude/settings.json` were dirty; expected and not part of deploy.

Google Analytics 4 consent implementation is committed and deployed:

- Commit: `a18136d` - Feature: Add consent-based GA4 analytics.
- Measurement ID: `G-QVHTTK2CNP`.
- Frontend-only changes added a mobile consent banner, lazy GA script loading
  only after explicit consent, localStorage persistence for accepted/declined
  choices, SPA `page_view` tracking after consent, a footer
  `Cookie-Einstellungen` reset that reopens the banner and denies future
  analytics storage/events until renewed consent, and a minimal `/datenschutz`
  page.
- GA is not inserted statically in `index.html`; `gtag.js` is requested only
  after Zustimmung by `CookieConsentBanner` / `analytics.ts`.
- Footer now links `Datenschutz` and `Cookie-Einstellungen`.
- Local validation passed: `npm run build` in `frontend/` and
  `git diff --check` with only LF/CRLF warnings.
- Deploy prep copied `functions/api` to `frontend/dist/functions/api`;
  `frontend/dist/functions/api/[[path]].ts` existed before deploy.
- Cloudflare Pages preview: `https://f876ad10.supplementstack.pages.dev`.
- Preview `/` and `/datenschutz` returned HTTP 200.
- Live `https://supplementstack.de/datenschutz` returned HTTP 200 and uses
  `/assets/index-B7aLcsIq.js`.
- Superseded by the later legal-pages deploy in `9c2c627`.

Legal pages are committed and deployed:

- Commit: `9c2c627` - Legal: Add imprint privacy and terms pages.
- Added `/impressum`, `/nutzungsbedingungen`, and `/agb` routes in the
  frontend.
- Added `frontend/src/pages/ImprintPage.tsx` and
  `frontend/src/pages/TermsPage.tsx`; expanded
  `frontend/src/pages/PrivacyPage.tsx`.
- Footer now links `Impressum`, `Datenschutz`, `Nutzungsbedingungen`, and
  `Cookie-Einstellungen`.
- Removed the external Google Fonts `@import` from `frontend/src/styles.css`
  and switched to a system font stack so font loading does not bypass consent.
- Privacy text now notes possible third-country processing for Cloudflare,
  GitHub/GitHub Actions, and Google Analytics with non-absolute safeguards
  wording. No Apple/OAuth/Social-Login processing is described as active.
- Scope is frontend-only; no backend or DB changes.
- Research/legal bases used: Â§5 DDG, Â§25 TDDDG, Art. 13/6 DSGVO, Â§36 VSBG,
  Â§18 MStV, EU ODR shutdown on 2025-07-20, and Google GA4 EU privacy/IP
  notes.
- Local checks passed: `npm run build` in `frontend/` and `git diff --check`
  with only LF/CRLF warnings.
- Build assets: `/assets/index-DtdVqjYU.js` and
  `/assets/index-CieqqPmY.css`.
- Deploy prep copied `functions/api` to `frontend/dist/functions/api`;
  `frontend/dist/functions/api/[[path]].ts` existed before deploy.
- Cloudflare Pages preview: `https://d6e92688.supplementstack.pages.dev`.
- Preview smoke: `/impressum`, `/datenschutz`, and `/nutzungsbedingungen`
  returned HTTP 200.
- Live smoke: `https://supplementstack.de/impressum`, `/datenschutz`,
  `/nutzungsbedingungen`, and `/agb` returned HTTP 200 and used
  `index-DtdVqjYU.js`.
- Open risk: final legal review plus DSB/AVV/Cloudflare/GitHub/Google settings
  checks remain recommended/required before SEO indexing.

Phase C Priority 1 (Hono module split), Priority 2 (public dose recommendations API), Priority 3 (admin audit logging), and Priority 4 (server-side unit conversion) are committed and deployed.
Phase C tech-debt sweep complete (commit b866c3d).
Phase C is complete.
Demo product loading fix is committed and deployed to Cloudflare Pages preview.
D3 recommendations / product modal loading fix is committed and deployed to Cloudflare Pages preview.
Preview search API-base fix is committed and deployed to Cloudflare Pages preview: production builds use same-origin `/api` by default, while Vite dev on localhost can still use `VITE_API_BASE_URL`.
Affiliate disclosure cleanup is committed and deployed to Cloudflare Pages preview: product cards no longer show the visible Affiliate badge; the general affiliate disclosure lives in the footer disclaimer.
Admin translations MVP for `ingredient_translations` is committed and deployed to Cloudflare Pages preview.
Admin translations expansion for Ingredients, Dose Recommendations, Verified
Profiles, and Blog Posts is committed and deployed to Cloudflare Pages preview.
Root documentation cleanup is committed: README, DEPLOYMENT, implementation status, and agent planner now describe the Cloudflare-native line and point old backend/SQLite references to legacy context.
D1 backup workflow is verified: GitHub Actions D1 backup has run successfully both manually and automatically, and token scopes are confirmed. Backup verification is no longer an open next step.
CI has been refreshed for the Cloudflare line. Local lint/test/build are green. Frontend test tooling now tolerates an empty suite via Vitest `--passWithNoTests`, while still running and failing real tests normally.
Worktree cleanup is committed in `216e2df`: `_research_raw/01_fat_soluble_vitamins.json` and `_research_raw/02_b_vitamins_vitamin_c.json` are tracked as migration 0006 source material, and local `.claude/commands/` files are ignored without deleting them.
Memory update `cebd31a` recorded the production custom-domain state. The domain
itself is no longer a promotion/verification next step; only SEO/indexing stays
gated.
Recent UX work is committed and deployed. `e8f2bbc` auto-focuses the name
field when opening the user product add modal, `078fc31` auto-focuses the
product search field in the add-product modal for Demo and Stack Workspace
flows, and `8fb5431` ships the targeted User/Demo/Search/Stack UX fixes plus
the targeted Admin UX fixes.
Planning constraint: launch remains DE-only, but i18n/localization must be
planned as locale + country + guideline-set support, not text translation only.
German/DGE/D-A-CH is the DE default; other countries need configurable rule and
source sets, e.g. USA must not inherit DGE/D-A-CH by default.
Auth planning constraint: Google OAuth is a later standalone task. Apple Login
is omitted for now. Amazon Login may be evaluated later but is not a launch
blocker. Health Consent remains mandatory with OAuth; OAuth only replaces the
password login path and does not bypass consent, profile, recommendation, or
guideline logic. Existing backend stubs and `google_id` are not a complete
provider identity/callback/user-linking design.

Targeted user/demo/admin usability fixes are committed and deployed in
`8fb5431` (`UX: Improve stack and admin usability flows`) and verified on
Cloudflare Pages preview plus the live custom domain. The fixes cover
SearchPage stack persistence/removal behavior, auth redirects to `/stacks`,
StackWorkspace duplicate/empty/mail states, SearchBar no-results behavior,
Modal2 retry without full reload, Wishlist empty CTA routing, Modal3 temporary
Demo copy, admin stats product-key fallbacks, direct Nick-affiliate toggle
persistence with rollback on failure, clear Nick-affiliate vs shop/user-link
labeling, admin-product loading for recommendation prep, user-product
moderation error handling, 404s for no-row moderation actions, and small mobile
touch improvements.

Launch QA flow blockers are fixed, committed, and deployed.

- Commit: `fcb1a6b` - Fix: Close launch QA flow blockers.
- Preview URL: `https://ae0fa762.supplementstack.pages.dev`.
- Build assets: JS `index-Hw7gzAwb.js`, CSS `index-DWw_l_3p.css`.
- Local checks passed: `npm run lint --if-present`,
  `npm run test --if-present -- --run` with no test files via
  `--passWithNoTests`, and `npm run build` in `frontend/`;
  `npx tsc -p tsconfig.json` in `functions/`; `git diff --check` only CRLF
  warnings.
- Preview/live smoke checks passed: root HTTP 200; D3 search HTTP 200;
  `/api/ingredients/1/products` HTTP 200 with approved/public D3 products;
  `/api/ingredients/1/recommendations` HTTP 200 with 4 dose recommendations;
  `/api/shop-domains` HTTP 200 with `{ shops }`; `/api/demo/products`
  HTTP 200; unauthenticated `/api/stack-warnings/1` HTTP 401;
  unauthenticated `/api/admin/translations/ingredients` HTTP 401;
  unauthenticated `/api/user-products` HTTP 401.
- Wrangler warned about uncommitted changes because memory files and
  `.claude/SESSION.md` were dirty; expected.

Step 1 status: code-level QA blockers are fixed and deployed. Browser-level
authenticated QA remains manual validation, not an implementation blocker.
Registration was tested successfully before rate limiting kicked in, but a
final fresh registration smoke after deploy was not completed because
`/auth/register` returned 429 after repeated QA attempts.

Mobile-first polish round 1 is committed and deployed:

- Commit: `c76bcf4` - UX: Improve mobile core flows.
- Preview URL: `https://d5b331fd.supplementstack.pages.dev`.
- Live domain `https://supplementstack.de/` returned HTTP 200 after deploy
  with new build assets JS `assets/index-Bl-g6o41.js` and CSS
  `assets/index-Cf3yP80d.css`.
- Local checks passed: `npm run lint --if-present` in `frontend/`,
  `npm run build` in `frontend/`, and `git diff --check` with only LF/CRLF
  warnings.
- Functions were not changed, so no Functions TypeScript compile was run.
- Browser/device QA at 375px, 390px, and 430px remains the next validation
  step for demo, logged-in, and admin flows.

Scope was frontend-only and targeted 375px-430px ergonomics:

- `frontend/src/styles.css`
- `frontend/src/components/Layout.tsx`
- `frontend/src/components/ProductCard.tsx`
- `frontend/src/components/modals/ModalWrapper.tsx`
- `frontend/src/components/modals/Modal2Products.tsx`
- `frontend/src/components/modals/Modal3Dosage.tsx`
- `frontend/src/components/modals/UserProductForm.tsx`
- `frontend/src/pages/SearchPage.tsx`
- `frontend/src/pages/MyProductsPage.tsx`

Implemented: responsive header/nav, product cards, SearchPage stack footer and
chips, modal bottom sheets and touch targets, product selection modal, dosage
modal, user product form, My Products mobile rows, StackWorkspace toolbar and
bottom bar wrapping, 44px touch targets for key controls, safe-area modal
padding, product modal rows that stack below 431px, dosage footer and portion
controls with touch-sized buttons, SearchPage fixed footer/chips/remove
controls hardened for narrow screens, MyProducts rows/form actions stacked on
xs screens, and Layout mobile nav/email/menu touch improvements.

P1 z-index/footer collision is fixed via `ModalWrapper` `z-[60]` plus hiding
the SearchPage footer while a modal is open.

Last relevant commits on `main`:

- `29dcde5` - Feature: Add sub-ingredient product workflow.
- `1272e11` - Feature: Add product ingredient publishing model.
- `9c2c627` - Legal: Add imprint privacy and terms pages.
- `a18136d` - Feature: Add consent-based GA4 analytics.
- `5905a20` - Fix: Batch stack warning interaction lookup.
- `52ead1f` - Data: Require complete product package metadata.
- `1df7616` - Memory: Record robots.txt deploy and Top-7 sprint status.
- `1d8b288` - Fix: Disallow search crawlers by name in robots.txt.
- `70aa1f9` - Fix: Add robots.txt blocking all indexing pre-launch.
- `1126d15` - Memory: Record register data-persistence deploy.
- `e832263` - Fix: Persist age, gender, guideline_source on register.
- `081af3d` - Memory: Record live-domain CORS + FRONTEND_URL deploy.
- `283cbc8` - Fix: Switch FRONTEND_URL and CORS allowlist to live domain.
- `c76bcf4` - UX: Improve mobile core flows.
- `fcb1a6b` - Fix: Close launch QA flow blockers.
- `8fb5431` - UX: Improve stack and admin usability flows.
- `078fc31` - UX: Auto-focus search field in 'Produkt hinzufuegen' modal (Demo + Stack-Workspace).
- `e8f2bbc` - UX: Auto-focus name field when opening 'Produkt hinzufuegen' modal.
- `cebd31a` - Memory: Production domain live, reorganize next-steps (superseded by current usability-first next steps and i18n planning constraint).
- `216e2df` - Ops: Track research sources and ignore local Claude commands.
- `f3fa88c` - Memory: Record admin translations expansion deploy.
- `49ed83e` - Feature: Expand admin translation management (admin translation GET/PUT routes and UI for Ingredients, Dose Recommendations, Verified Profiles, and Blog Posts).
- `862ed57` - Feature: Phase D product recommendations and translations (migration 0036, admin translations MVP, Cloudflare-line CI/docs, lockfiles, local setup scripts).
- `965d4e4` - Fix: Move affiliate disclosure to footer (removed visible product-card Affiliate badge; generalized footer affiliate note).
- `b5dba6e` - Fix: Use same-origin API in deployed frontend (central API base helper, same-origin `/api` for production builds, local dev override only on localhost).
- `2f4248b` - Fix: Restore demo product loading (`GET /api/demo/products`, frontend API-base consistency for SearchBar/SearchPage).
- `9107e2e` - Fix: Stabilize dosage and product modal data loading (source-tab dosage dedupe, resilient product modal recommendation loading, flat product ingredient metadata, product `is_main` from ingredient join).
- `b866c3d` - Refactor + Ops: Tech-Debt-Cleanup nach Phase C (normalizeComparableUnit removed, IngredientRow extended, pages_build_output_dir added, next-steps reorganized).
- `11440f5` - Feature: Server-side Unit-Konvertierung â€” IU/Âµg/mg/g fÃ¼r Upper-Limit-Vergleich.
- `4482a5f` - Feature: Admin Audit Logging â€” alle Mutationen in admin_audit_log.
- `dd58ba2` - Feature: Add dose recommendations API (`GET /api/ingredients/:id/recommendations` from `dose_recommendations`).
- `b1fd347` - Refactor: Split Pages API into Hono modules (`functions/api/[[path]].ts` is now a composer; modules under `functions/api/modules/*`, helpers under `functions/api/lib/*`).
- `2ca9382` - Ops: Shared agent memory and auto-handoff workflow (`AGENTS.md`, `.agent-memory/*`, `scripts/update-agent-handoff.ps1`, `.claude/settings.json`, `.claude/memory.md` as pointer).
- `9a5f523` - DB: Phase B abgeschlossen, migrations 0028-0035, `dosage_guidelines` migrated to `dose_recommendations`.

## Latest Deployed Work

Logo/header branding is committed and deployed:

- Commit: `03ae0f9` - Brand: Use uploaded logo in headers.
- Preview URL: `https://47c4db46.supplementstack.pages.dev`.
- Live URL: `https://supplementstack.de`.
- `frontend/public/logo.png` is the cleaned deployed logo asset.
- `frontend/src/components/AppLogo.tsx` is the shared logo component used by
  the normal app header, Stacks/Demo header, and Admin sidebar.
- Checks passed: frontend build, lint, Vitest no-test run, diff-check, HTTP
  `/logo.png` checks on preview/live, and browser-harness logo rendering checks
  for root, demo, and forgot-password pages.

Authenticated app-shell header alignment is committed and deployed:

- Commit: `ba92cd5` - UX: Align authenticated headers with app shell.
- Preview URL: `https://3c09e165.supplementstack.pages.dev`.
- Live URL: `https://supplementstack.de`.
- `/stacks` now uses the global Layout/nav header; Demo remains standalone.
- `MyProductsPage` no longer uses its own full-screen gradient shell.
- Checks passed: frontend build, lint, Vitest no-test run, diff-check, and
  browser-harness verification that `/stacks`, `/my-products`, and `/profile`
  render the normal nav logo and no standalone `.site-header`.

Launch QA stack/profile fixes are committed, remote-migrated, deployed, and
live-smoked:

- Bundle commits: `0b29fe0`, `baa91a5`, `1a3b8e6`, `cb76cf3`, `24b10b5`.
- Remote D1 migration `0041_stack_item_product_sources.sql` applied
  successfully to `supplementstack-production`.
- Preview URL: `https://5fb3de86.supplementstack.pages.dev`.
- Live URL: `https://supplementstack.de`; live root uses asset
  `index-BfFUmB15.js`.
- Final live smokes passed for `PUT /api/me`, invalid profile validation,
  own pending user product stack add/load/warnings/delete, demo products count
  7 with D3 quantity 2,000 IU, root/forgot-password routes, and Search/Wishlist
  fallback/no-nav state.

Sub-ingredient product workflow is committed, remote-migrated, and deployed:

- Commit: `29dcde5` - Feature: Add sub-ingredient product workflow.
- Remote D1 migration `0040_seed_ingredient_sub_ingredients.sql` applied
  successfully to `supplementstack-production`.
- Remote control confirmed six mappings: L-Carnitin children
  `Acetyl-L-Carnitin`, `L-Carnitin Tartrat`, `L-Carnitin Fumarat`; Omega-3
  children `EPA`, `DHA`, `DPA`.
- Remote control confirmed `products.source_user_product_id` exists
  (`source_col=1`).
- Preview URL: `https://421f79ea.supplementstack.pages.dev`.
- Live URL: `https://supplementstack.de`.
- Smoke checks passed on live and preview for sub-ingredient endpoints, Omega-3
  products, demo products count 7, and unauthenticated admin 401.
- Remaining launch follow-up: dedicated admin UI for sub-ingredient mapping,
  legal/compliance wording review, manual desktop/mobile product submission QA,
  and affiliate/domain final policy review.

Product ingredient publishing model is committed, remote-migrated, and
deployed:

- Commit: `1272e11` - Feature: Add product ingredient publishing model.
- Remote D1 migration `0039_product_ingredient_model.sql` applied successfully
  to `supplementstack-production`.
- Remote control query confirmed required 0039 schema objects/columns exist:
  `product_ingredients.search_relevant`, `user_product_ingredients`,
  `ingredient_sub_ingredients`, and `user_products.published_product_id`.
- Frontend build assets: JS `index-BvEYaSZm.js`, CSS `index-BxLAbVeG.css`.
- Deploy command: `wrangler pages deploy frontend/dist --project-name supplementstack`.
- Preview URL: `https://0ed675d5.supplementstack.pages.dev`.
- Smoke checks passed on preview/live: root uses the new asset,
  `/api/demo/products` returns 7 products, `/api/ingredients/1/products`
  returns 3 products, `/api/ingredients/1/recommendations` returns 4 rows, and
  unauthenticated admin/user product endpoints return 401.

Legal pages are committed and deployed:

- Commit: `9c2c627` - Legal: Add imprint privacy and terms pages.
- Preview URL: `https://d6e92688.supplementstack.pages.dev`.
- Routes: `/impressum`, `/datenschutz`, `/nutzungsbedingungen`, and `/agb`
  alias.
- Footer now links `Impressum`, `Datenschutz`, `Nutzungsbedingungen`, and
  `Cookie-Einstellungen`.
- Google Fonts import removed; app uses system fonts.
- Privacy text covers GA4 consent, Cloudflare/GitHub/GitHub Actions/Google
  Analytics, and third-country processing. No Apple/OAuth/Social-Login
  processing is described as active.
- Checks passed: frontend build and `git diff --check` with only LF/CRLF
  warnings.
- Build assets: `/assets/index-DtdVqjYU.js` and
  `/assets/index-CieqqPmY.css`.
- Smoke checks passed: preview legal routes HTTP 200; live `/impressum`,
  `/datenschutz`, `/nutzungsbedingungen`, and `/agb` HTTP 200 with
  `index-DtdVqjYU.js`.
- Open: final legal review plus DSB/AVV/provider settings review before SEO
  indexing.

Consent-based GA4 analytics is committed and deployed:

- Commit: `a18136d` - Feature: Add consent-based GA4 analytics.
- Measurement ID: `G-QVHTTK2CNP`.
- Preview URL: `https://f876ad10.supplementstack.pages.dev`.
- GA4 is not statically loaded in `index.html`; `gtag.js` is injected only
  after Zustimmung, while Ablehnung is persisted and sends no GA events.
- Footer has `Datenschutz` and `Cookie-Einstellungen`; `/datenschutz` is a
  working draft and still requires legal review.
- Checks passed: frontend build and `git diff --check` with only LF/CRLF
  warnings.
- Smoke checks passed: preview `/` and `/datenschutz` HTTP 200; live
  `https://supplementstack.de/datenschutz` HTTP 200 with
  `/assets/index-B7aLcsIq.js`.

Stack-warnings batched interaction lookup is committed and deployed:

- Commit: `5905a20` - Fix: Batch stack warning interaction lookup.
- Deploy command: `. .\scripts\use-supplementstack-cloudflare.local.ps1; npx wrangler pages deploy frontend/dist --project-name supplementstack`
- Preview URL: `https://1c23aea8.supplementstack.pages.dev`
- Build assets: JS `index-Dkeio0yL.js`, CSS `index-RAoQ0gyV.css`.
- Local checks passed: functions TypeScript compile, frontend build, and
  `git diff --check` with only CRLF warnings.
- Smoke checks passed: preview root HTTP 200; preview unauthenticated
  `/api/stack-warnings/1` HTTP 401; live unauthenticated
  `/api/stack-warnings/1` HTTP 401.
- Browser/mobile QA and legal/compliance review remain open.

Launch QA flow blockers are committed and deployed:

- Commit: `fcb1a6b` - Fix: Close launch QA flow blockers.
- Deploy command: `. .\scripts\use-supplementstack-cloudflare.local.ps1; npx wrangler pages deploy frontend/dist --project-name supplementstack`
- Preview URL: `https://ae0fa762.supplementstack.pages.dev`
- Build assets: JS `index-Hw7gzAwb.js`, CSS `index-DWw_l_3p.css`.
- Local checks passed: frontend lint, frontend test with no test files via
  `--passWithNoTests`, frontend build, functions TypeScript compile, and
  `git diff --check` with only CRLF warnings.
- Smoke checks passed on preview/live: root HTTP 200; D3 search HTTP 200;
  approved/public ingredient products; dose recommendations; shop domains;
  demo products; unauthenticated stack warnings, admin translations, and
  user-products return HTTP 401.
- Fresh registration post-deploy remains a follow-up because rate limiting
  returned 429 after repeated QA attempts.

Targeted User/Demo/Search/Stack UX fixes and Admin UX fixes are also committed
and deployed:

- Commit: `8fb5431` - UX: Improve stack and admin usability flows.
- Local checks passed: `npm run lint --if-present` in `frontend/`;
  `npm run test --if-present -- --run` in `frontend/` with
  `--passWithNoTests`; `npm run build` in `frontend/`;
  `npx tsc -p tsconfig.json` in `functions/`; `git diff --check` without
  whitespace errors, only CRLF warnings.
- Deploy prep: `npm run build` in `frontend/`; functions copied to
  `frontend/dist/functions`; `frontend/dist/functions/api/[[path]].ts`
  verified with `Test-Path -LiteralPath`.
- Deploy command: `. .\scripts\use-supplementstack-cloudflare.local.ps1; npx wrangler pages deploy frontend/dist --project-name supplementstack`
- Preview URL: `https://2b00223a.supplementstack.pages.dev`
- Smoke checks passed: preview root HTTP 200 with JS `index-D8jGeaah.js`, CSS
  `index-DWw_l_3p.css`, and `x-robots-tag: noindex`; preview
  `/api/ingredients/search?q=d3` HTTP 200 with Vitamin D3; preview
  `/api/admin/translations/ingredients` HTTP 401, not 404; preview
  `/api/ingredients/1/recommendations` HTTP 200 with 4 rows; live root
  `https://supplementstack.de/` HTTP 200 with the same JS/CSS asset names; live
  D3 search HTTP 200; live admin translations unauth HTTP 401, not 404.
- Wrangler warned that uncommitted changes existed. That was expected because
  memory files and `.claude/SESSION.md` were dirty while the code commit itself
  was committed.

## Previous Deployed Work

Admin translations expansion is committed and deployed to Cloudflare Pages
preview:

- Commit: `49ed83e` - Feature: Expand admin translation management.
- No D1 migration was needed.
- Deployed preview: `https://14cf1dba.supplementstack.pages.dev`.
- Smoke checks passed: root HTTP 200; unauthenticated
  `/api/admin/translations/ingredients`,
  `/api/admin/translations/dose-recommendations`,
  `/api/admin/translations/verified-profiles`, and
  `/api/admin/translations/blog-posts` returned HTTP 401, not 404;
  `/api/ingredients/search?q=d3` returned HTTP 200.

Phase D product recommendations and translations are committed, remote-migrated,
and deployed to Cloudflare Pages preview:

- Commit: `862ed57` - Feature: Phase D product recommendations and translations.
- Remote D1: `0036_rename_recommendations_to_product_recommendations.sql`
  applied successfully after repairing the remote `d1_migrations` journal for
  already-live 0026-0035 migrations.
- Remote schema now has `product_recommendations` as table plus temporary
  `recommendations` view and `recommendations_insert`/`recommendations_delete`
  triggers for deploy compatibility.
- Deployed preview: `https://66a9ee27.supplementstack.pages.dev`.
- Smoke checks passed: root HTTP 200; `/api/recommendations?ingredient_id=1`
  HTTP 200; `/api/ingredients/1/recommendations` HTTP 200;
  `/api/ingredients/search?q=d3` HTTP 200; `/api/products/1` HTTP 200;
  unauthenticated `/api/admin/translations/ingredients` returned 401, not 404.

Admin Translations extension is now committed and deployed. Public i18n playback
was not changed.

- Backend: `functions/api/modules/admin.ts` now also serves admin-only GET/PUT
  routes for `dose_recommendation_translations`,
  `verified_profile_translations`, and `blog_translations`.
- Dose recommendation translation upsert validates the source
  `dose_recommendations` row, stores optional `source_label`, `timing`, and
  `context_note` with empty strings normalized to `NULL`, and audits
  `upsert_dose_recommendation_translation` as
  `dose_recommendation_translation`.
- Verified profile translation upsert validates the source
  `verified_profiles` row, stores optional `bio` and `credentials` with empty
  strings normalized to `NULL`, and audits
  `upsert_verified_profile_translation` as `verified_profile_translation`.
- Blog translation upsert validates the source `blog_posts` row, requires
  `title` and normalized lowercase `slug`, validates slug format, returns a
  409 for per-language slug conflicts, and audits `upsert_blog_translation` as
  `blog_translation`.
- Frontend: `frontend/src/pages/admin/TranslationsTab.tsx` now has an entity
  selector for Ingredients, Dose Recommendations, Verified Profiles, and Blog
  Posts while preserving the existing Ingredient editor behavior.
- Frontend: `frontend/src/pages/admin/TranslationsTab.tsx` now guards
  `loadTranslations()` with AbortController plus a monotonic request id so stale
  entity/language/search responses cannot overwrite rows, drafts, loading,
  saved state, or errors.
- Frontend: `frontend/.eslintignore` was added so local generated
  `frontend/dist/` output is not linted by `npm run lint --if-present`.
- Local checks passed: `npm run lint --if-present`,
  `npm run test --if-present -- --run`, and `npm run build` in `frontend/`;
  `npx tsc -p tsconfig.json` in `functions/`.

D1 backup workflow remains verified: GitHub Actions backup has run manually and
automatically, token scopes are confirmed, and backup verification is not an
open next step.

Product recommendations rename is deployed:

- Migration `d1-migrations/0036_rename_recommendations_to_product_recommendations.sql` renames `recommendations` to `product_recommendations`.
- Migration 0036 recreates indexes under the new table name.
- Migration 0036 leaves a temporary `recommendations` compatibility view plus `INSTEAD OF INSERT` and `INSTEAD OF DELETE` triggers for the deploy window.
- The public `/api/recommendations` route remains the compatibility API name; code now targets `product_recommendations` where the database table is referenced.
- Safe deploy runbook was followed: remote D1 migration 0036 first, then Cloudflare Pages code deploy. The temporary view/triggers allow old live code to keep working during the migration/deploy window.

CI/test tooling is committed:

- `.github/workflows/ci.yml` now checks the Cloudflare line: Functions TypeScript compile plus frontend lint, test, build, and build-output verification.
- `frontend/package.json` test script runs `vitest --passWithNoTests`.
- Local Vitest is `0.34.6` and supports `--passWithNoTests`.
- Local checks are green: frontend lint, frontend test, frontend build, and functions TypeScript compile.

Admin translations MVP for ingredients is committed and deployed:

- Backend: `functions/api/modules/admin.ts` now serves `GET /api/admin/translations/ingredients` and `PUT /api/admin/translations/ingredients/:ingredientId/:language`.
- The GET route lists ingredients with a LEFT JOIN on `ingredient_translations`, normalizes/validates language, supports `q`, `limit`, and `offset`, and returns `missing`/`translated` status.
- The PUT route validates admin auth, ingredient existence, language, required `name`, optional text fields, upserts `ingredient_translations`, and logs `upsert_ingredient_translation` with entity `ingredient_translation`.
- Frontend: `frontend/src/components/AdminLayout.tsx` and `frontend/src/pages/AdminPage.tsx` expose the new `translations` tab.
- Frontend: `frontend/src/pages/admin/TranslationsTab.tsx` is a new focused component for language selection, search, editable ingredient translation fields, save state, loading, errors, and MVP scope notice.
- Validation passed locally: `npm run build` in `frontend/`; `npx tsc -p tsconfig.json` in `functions/`.

D1 backup workflow status:

- Workflow configuration was checked against `wrangler.toml`; the configured D1 database name is `supplementstack-production`.
- GitHub Actions D1 backup was successfully executed manually and automatically.
- Token scopes for the backup workflow are verified.
- Previous local CLI dispatch limitations are historical only; backup verification is complete and no longer an open task.

## Phase B Result

Production D1 migrations 0026-0035 are considered live according to the previous memory:

- `0026`: `populations` lookup with 5 seed rows.
- `0027`: `dose_recommendations`.
- `0028`: `verified_profiles`.
- `0029`: `admin_audit_log`.
- `0030`: translation tables.
- `0031`: `blog_posts`.
- `0032`: `share_links`.
- `0033`: `api_tokens`.
- `0034`: rebuilt `interactions` and added `ingredients.preferred_unit`.
- `0035`: migrated 136 of 136 rows from old `dosage_guidelines` to `dose_recommendations`; old table renamed to `dosage_guidelines_legacy`.

## Current Code Shape

- Frontend routes and pages are already present: landing, demo, stacks, admin,
  auth, profile, user products, forgot/reset password, and legal pages.
- Frontend API base is centralized in `frontend/src/api/base.ts`: production builds use same-origin `/api`; only Vite dev on localhost/127.0.0.1/::1 may use `VITE_API_BASE_URL`.
- `functions/api/[[path]].ts` is now a Hono composition root with CORS setup
  and `app.route(...)` mounts for auth/me, ingredients/recommendations,
  products/r2, admin/shop-domains/interactions, stacks/stack-warnings,
  user-products, and demo.
- Business logic has moved out of the entry point into modules under `functions/api/modules/*`.
- `functions/api/modules/user-products.ts` and `functions/api/modules/demo.ts` were added from the previous monolith behavior.
- `GET /api/ingredients/:id/recommendations` now reads active public rows from `dose_recommendations`, joins `populations`, optionally joins `verified_profiles`, `dose_recommendation_translations`, and `verified_profile_translations`, and returns upper-limit comparison metadata.
- Product-to-ingredient recommendation links target `product_recommendations`;
  migration 0036 keeps a temporary `recommendations` view/triggers for deploy
  compatibility. The public `/api/recommendations` route name remains.
- `GET /api/stack-warnings/:id` now keeps the existing auth/ownership
  behaviour and fetches all matching interaction warnings through one batched
  SQL `IN (...)` lookup instead of an O(n^2) per-pair query loop.

## Agent Workflow

- Shared memory lives in `.agent-memory/*`.
- `AGENTS.md` is the generic startup protocol for Codex and future agents.
- `CLAUDE.md` starts with the same startup protocol so Claude Code sees it immediately.
- `.claude/memory.md` is only a pointer to `.agent-memory/*`.
- `scripts/update-agent-handoff.ps1` updates `.agent-memory/handoff.md` without using model tokens.
- `.claude/settings.json` wires that script into Claude Code `PreCompact` and `PostToolUse` for Bash.

## Git / Workspace Notes

`functions/api/lib/*` and `functions/api/modules/*` are tracked.

Remaining notable local paths typically include:

- `.wrangler/`, `frontend/dist/`, `frontend/node_modules/`, `functions/node_modules/` (build/cache, gitignored or ignorable).
- `_research_raw/*` may contain future research source data. Files 01/02/03 are already tracked; review any new research files before committing.
- `.claude/SESSION.md`, `.claude/commands/` (legacy Claude session log, see `.claude/SESSION.md` header).
- `frontend/dist/` may be present from the latest build/deploy prep and is not committed.
- Phase D source files, docs, lockfiles, and generic setup scripts are committed in `862ed57`.

`.agent-memory/handoff.md` is regenerated on every PreCompact and after every Bash tool use by `scripts/update-agent-handoff.ps1`. Treat it as a transient snapshot â€” never store unique information only there.

Do not assume untracked files are disposable. Review before deleting or committing.

## 2026-05-05 Email Verification And Health-Claims Audit Deployed

- Remote D1 migrations `0043_email_verification.sql` and `0044_health_claim_content_audit.sql` are applied to `supplementstack-production`.
- Email verification is live: new registrations get a 48-hour verification link, only the SHA-256 token hash is stored in `email_verification_tokens.token`, `/verify-email` verifies tokens, and authenticated resend is rate-limited. Existing users were backfilled as verified via `users.email_verified_at`.
- Health-claims/content cleanup is live: frontend wording and selected seeded/live DB text were softened to conservative source/context wording. This was a wording risk pass, not final legal sign-off and not scientific dose validation.
- Deployment target: Cloudflare Pages project `supplementstack`.
- Preview: `https://42cd17dd.supplementstack.pages.dev`.
- Live: `https://supplementstack.de`, asset `assets/index-uekEwu_R.js`.
- Validation passed: functions `npx tsc -p tsconfig.json`, frontend `npx tsc --noEmit`, frontend `npm run lint --if-present`, frontend `npm run build`, frontend `npm test -- --run` (5 tests), and `git diff --check`.
- Live smokes passed: root 200, `/verify-email` 200, invalid `POST /api/auth/verify-email` 400, unauthenticated `POST /api/auth/resend-verification` 401, `/api/demo/products` 200 with 7 products, D1 migration log shows 0043/0044, token table exists, and existing users have no `email_verified_at IS NULL` rows.
- DNS check: MX/SPF are present for All-Inkl/Kasserver; `_dmarc.supplementstack.de` is not set; `default._domainkey.supplementstack.de` was not found.

## 2026-05-05 Product Safety Warnings - Local

- First version of product/ingredient safety warnings is implemented locally, not committed, remote-migrated, deployed, or smoke-checked.
- New owned migration: `d1-migrations/0046_knowledge_warnings.sql`. Do not use 0045; another agent owns that slot.
- Migration 0046 creates `knowledge_articles` and `ingredient_safety_warnings`, seeds the published article slug `beta-carotin-raucher-lungenkrebs`, and conditionally seeds the Beta-Carotin smoker warning only when a matching ingredient exists.
- Backend adds `functions/api/modules/knowledge.ts`, mounted at `/api/knowledge`, with `GET /api/knowledge/:slug` and shared warning attachment helpers.
- Product warning attachment is wired into public catalog products, ingredient product lists, demo products, authenticated stack detail items, and user product loading.
- Frontend adds `/wissen/:slug` via `KnowledgeArticlePage`; `ProductCard` now renders concise warning labels with an info popover and a knowledge-article icon link.
- No user smoker status is stored or used. Warnings are general product/ingredient warnings.
- Source basis checked against official pages: EFSA Journal 2012 beta-carotene heavy-smoker statement, NIH ODS Vitamin A and Carotenoids fact sheet, and NCI Lung Cancer Prevention PDQ.
- Validation passed: functions `npx tsc -p tsconfig.json`, frontend `npx tsc --noEmit`, frontend build, frontend Vitest 5 tests, focused ESLint on touched frontend files, migration 0046 in-memory SQLite probe, and `git diff --check` with CRLF warnings only.
- Full frontend lint is currently blocked by unrelated `PrivacyPage.tsx` `react/no-unescaped-entities` errors.

## 2026-05-05 Data Minimization - Local

- Account/profile/consent data minimization is implemented locally, not committed, remote-migrated, deployed, or live-smoked.
- New owned migration: `d1-migrations/0045_data_minimization_profile_fields.sql`.
- Registration UI no longer asks for gender. It keeps email/password, optional age, optional guideline source, email verification, and narrowed consent wording.
- Profile UI no longer shows or sends gender, weight, diet, goals, or smoker status. It only edits age and guideline source, plus existing email verification/password/delete-account sections.
- Frontend auth/user types no longer expose gender, weight, diet, goals, or `is_smoker`.
- Backend register ignores removed profile fields and inserts `NULL` for legacy `gender`, `weight`, `diet_type`, and `personal_goals` columns. `GET /api/me`, login profile, and `PUT /api/me` no longer return removed profile fields. `PUT /api/me` only updates age and guideline source.
- Migration 0045 nulls existing `gender`, `weight`, `diet_type`, and `personal_goals`. Because `users.is_smoker` is `NOT NULL` from migration 0009, migration 0045 resets it to `0` instead of rebuilding `users`.
- Privacy and registration consent wording now describe account, optional age, guideline source, saved stacks/products, dosage/intake interval/cost data, and user-submitted product data; they explicitly avoid diagnosis/illness/medication/gender/diet/goals/smoker fields while noting stack/dosage data can be health-adjacent.
- Validation passed: functions `npx tsc -p tsconfig.json`, frontend `npx tsc --noEmit`, frontend `npm run lint --if-present`, frontend `npm run build`, frontend `npm test -- --run` (5 tests), targeted removed-field scans, and `git diff --check` with CRLF warnings only.
- SQLite CLI was not available locally, so migration 0045 was not executed in a local SQLite probe.
- Concurrent unrelated product-safety-warning work remains in the worktree, including migration `0046_knowledge_warnings.sql` and knowledge/product warning files. Do not revert it.

## 2026-05-05 Data Minimization And Safety Warnings Deployed

- Remote D1 migrations `0045_data_minimization_profile_fields.sql` and `0046_knowledge_warnings.sql` are applied to `supplementstack-production`.
- Deployment target: Cloudflare Pages project `supplementstack`.
- Preview: `https://33f76fe5.supplementstack.pages.dev`.
- Live: `https://supplementstack.de`, asset `assets/index-BG4hesq7.js`.
- Registration/profile data minimization is live: registration asks for email/password, consent, optional age, and optional guideline source only. Profile editing only updates age and guideline source.
- Auth/profile responses no longer expose gender, account weight, diet, goals, or `is_smoker`. Migration 0045 cleared legacy gender/weight/diet/goals data and reset `is_smoker` to 0 because the existing schema column is NOT NULL.
- Product safety warnings are live through `knowledge_articles` and `ingredient_safety_warnings`. The first article is `/wissen/beta-carotin-raucher-lungenkrebs`.
- The Beta-Carotin warning is form-specific: current production data models Beta-Carotin as `ingredient_forms.name='Beta-Carotin'` under Vitamin A (`ingredient_id=32`, production `form_id=79`), so the warning matches product ingredient rows only when their `form_id` is the Beta-Carotin form. A fallback remains for future standalone Beta-Carotin ingredients.
- Product cards can show a short warning label, an info popover, and a knowledge-base article icon link. No smoker status is stored or inferred.
- Validation passed: functions `npx tsc -p tsconfig.json`, frontend `npx tsc --noEmit`, frontend `npm run lint --if-present`, frontend `npm run build`, frontend `npm test -- --run` (5 tests), and `git diff --check`.
- Live/preview smokes passed: root 200, knowledge article route 200, knowledge API 200, demo products 200, D1 migration journal shows 0045/0046, article is published, warning row exists for Vitamin A + Beta-Carotin form, legacy profile-field residual count is 0, profile GET/PUT responses have no removed fields, and a temporary Beta-Carotin user product returned the warning plus `/wissen/beta-carotin-raucher-lungenkrebs`. Temporary smoke data was deleted.

## 2026-05-05 Ingredient Research Admin Cockpit Deployed

- Remote D1 migration `0047_ingredient_research_admin.sql` is applied to `supplementstack-production`.
- Deployment target: Cloudflare Pages project `supplementstack`.
- Preview: `https://52db1978.supplementstack.pages.dev`.
- Live: `https://supplementstack.de`, asset `assets/index-DTMpE7Sg.js`.
- Admin now has a `Wirkstoff-Recherche` tab. It lists all ingredients grouped by category and opens a detail editor per ingredient.
- New research tables:
  - `ingredient_research_status` tracks per-ingredient research/calculation status, internal notes, blog URL, reviewed date, and review due date.
  - `ingredient_research_sources` tracks official and study sources with country/organization, population, recommendation type, no-recommendation marker, dose range/unit, study/finding/outcome metadata, source links, DOI/PubMed IDs, notes, and review dates.
- Existing `ingredient_safety_warnings` are now manageable through the same cockpit for ingredient-linked short warning labels, popover text, severity, knowledge article slug, threshold amount, and unit.
- Backend admin routes under `/api/admin/ingredient-research` are admin-only and audit-logged. The list route returns both `ingredients` and `items` aliases for frontend compatibility.
- Validation passed: frontend `npm run lint`, frontend `npm run build`, functions `npx tsc -p tsconfig.json --noEmit`, and `git diff --check` with CRLF warnings only.
- Smoke checks passed: remote D1 contains `ingredient_research_status` and `ingredient_research_sources`, production has 66 ingredients, preview/live root return 200 with `assets/index-DTMpE7Sg.js`, and unauthenticated preview/live `/api/admin/ingredient-research` returns 401.

## 2026-05-05 Admin Usability Backend Bundle - Local

- Backend-only admin usability routes are implemented locally in `functions/api/modules/admin.ts`; not committed, deployed, or live-smoked.
- No migration was added. Existing `knowledge_articles`, `ingredient_research_status`, `ingredient_research_sources`, `ingredient_safety_warnings`, `products`, and `product_ingredients` tables were sufficient.
- New admin-only routes under `/api/admin`: `GET /knowledge-articles`, `GET /knowledge-articles/:slug`, `POST /knowledge-articles`, `PUT /knowledge-articles/:slug`, `DELETE /knowledge-articles/:slug`, `GET /ops-dashboard`, `GET /product-qa`, and `GET /ingredient-research/export`.
- Knowledge article writes validate conservative slugs, `draft|published|archived` status, ISO-like `reviewed_at`, and `sources_json` as an array or JSON array string. Article slug is intentionally immutable on update because warnings may reference it. Delete archives instead of hard-deleting.
- Product QA computes issue flags for missing image, missing shop link, missing serving data, suspicious zero/high price, missing ingredient rows, and shop links without the affiliate flag. It also returns ingredient/main-ingredient counts.
- Validation passed: `npx tsc -p tsconfig.json --noEmit` in `functions/` and `git diff --check -- functions/api/modules/admin.ts` with CRLF warning only.
- Concurrent unrelated worktree changes appeared during the session: `.claude/SESSION.md`, `.claude/settings.json`, `frontend/src/api/admin.ts`, untracked frontend admin tab files, and root `logo.png`. Do not revert them unless explicitly requested.

## 2026-05-05 Admin Usability Frontend Bundle - Local

- Frontend/admin half of the admin usability bundle is implemented locally; not committed, deployed, or authenticated-browser-smoked.
- `frontend/src/api/admin.ts` now has typed helpers for admin knowledge articles, ops dashboard counts, product QA listing, and optional ingredient research JSON export.
- Admin navigation keeps `/admin?tab=stats` as the landing route but labels it `Admin-Uebersicht`; it also adds `Wissen` and `Produkt-QA`.
- New tabs:
  - `AdminOpsDashboardTab` shows compact cards for due research, unreviewed/researching/stale research status, knowledge drafts, warnings without article, and product QA issues, with links to related admin tabs and a non-blocking `Recherche-JSON` button.
  - `AdminKnowledgeArticlesTab` provides a responsive two-pane/stacked editor for searching/filtering articles, editing title/summary/body/status/reviewed date/sources JSON, creating new slugs, saving, and archiving.
  - `ProductQATab` provides search, issue filtering, responsive card/table layouts, and issue chips for suspicious product records.
- Validation passed: frontend `npx tsc --noEmit`, `npm run lint --if-present`, and `npm run build` (Vite chunk-size warning only).
- Concurrent non-owned work remains in the worktree, including backend `functions/api/modules/admin.ts`, `.claude/*`, `.agent-memory/*`, and root `logo.png`; do not revert it.
## 2026-05-05 Admin Ops And Knowledge Tools Deployed

- Admin usability bundle is deployed to Cloudflare Pages project `supplementstack`.
- Preview URL: `https://f74b20b0.supplementstack.pages.dev`.
- Live URL: `https://supplementstack.de`, asset `assets/index-DVbWbGLx.js`.
- No D1 migration was required; the bundle uses existing `knowledge_articles`, `ingredient_research_status`, `ingredient_research_sources`, `ingredient_safety_warnings`, `products`, and `product_ingredients` tables.
- New admin backend routes are live: `/api/admin/knowledge-articles`, `/api/admin/knowledge-articles/:slug`, `/api/admin/ops-dashboard`, `/api/admin/product-qa`, and `/api/admin/ingredient-research/export`.
- Admin UI now has `Admin-Uebersicht`, `Wissen`, and `Produkt-QA` tabs. The article editor supports search/filter, create, edit, save, source JSON, status/review date, and archive. Product QA supports search, issue filters, mobile cards, and desktop table view.
- Integration fix: Product-QA frontend issue filters now match backend issue keys, and the ops dashboard reads the flat backend count keys.
- Validation passed: functions `npx tsc -p tsconfig.json --noEmit`, frontend `npx tsc --noEmit`, frontend `npm run lint --if-present`, frontend `npm run build`, and `git diff --check` with CRLF warnings only.
- Smoke checks passed: preview/live root return 200 with `assets/index-DVbWbGLx.js`; preview/live unauthenticated `/api/admin/ops-dashboard`, `/api/admin/knowledge-articles`, and `/api/admin/product-qa` return 401.

## 2026-05-05 Admin Arbeitsplatz V1 - Local

- Admin Arbeitsplatz v1 is implemented locally; not committed, deployed, or authenticated-browser-smoked.
- Backend `functions/api/modules/admin.ts` now extends `/api/admin/ops-dashboard` with limited top queue items for product QA, due research, stale/unreviewed research, warnings without article, and knowledge drafts.
- Backend adds admin-only `PATCH /api/admin/product-qa/:id` for high-impact QA fields only: `price`, `shop_link`, `is_affiliate`, `serving_size`, `serving_unit`, `servings_per_container`, and `container_count`. It uses `ensureAdmin`, conservative validation, and `logAdminAction` audit logging.
- Backend knowledge article validation now blocks `status='published'` unless body is non-empty and `sources_json` contains at least one source array entry.
- Frontend admin API types/helpers cover the new queue payloads and Product-QA patch helper.
- `AdminOpsDashboardTab` now separates "Heute bearbeiten" and "Spaeter einplanen" with actionable top items and contextual admin-tab links.
- `ProductQATab` now has compact inline editing in mobile cards and desktop rows for shop link, affiliate flag, price, serving size/unit, servings per container, and container count.
- `AdminKnowledgeArticlesTab`, `IngredientResearchTab`, and `ProductQATab` read `q=` from admin links so queue links open with relevant context where those tabs support search.
- Validation passed: functions `npx tsc -p tsconfig.json --noEmit`, frontend `npx tsc --noEmit`, frontend `npm run lint --if-present` (two unrelated warnings in `frontend/src/components/StackWorkspace.tsx`), frontend `npm run build` (Vite chunk-size warning only), and scoped `git diff --check` with CRLF warnings only.
- Concurrent unrelated worktree changes are present in stack/family files and `.claude/*`; do not revert them.

## 2026-05-05 User-Rundung V1 - Local

- User-side stack rounding v1 is implemented locally; not committed, remote-migrated, deployed, or browser-smoked.
- New migration `d1-migrations/0048_user_stack_rounding.sql` adds `family_profiles`, nullable `stacks.family_member_id`, and `product_link_reports` for missing/broken link reports.
- Backend adds `functions/api/modules/family.ts`, mounted at `/api/family`, with authenticated CRUD for first name, age, and optional weight only.
- Stack backend now returns/updates `family_member_id` and `family_member_first_name`, validates member ownership, and adds authenticated rate-limited `POST /api/stacks/link-report`.
- `StackWorkspace` now shows a compact stack cockpit with monthly cost, one-time cost, product count, product warning count, duplicate effective ingredients, missing links, products running out soon, and a visible conflict state. Authenticated stacks load `/api/stack-warnings/:id`; demo stacks use simple local duplicate-ingredient checks.
- `StackWorkspace` now includes a grouped `Einnahmeplan` by morning/noon/evening/flexible with dosage, interval label, monthly cost, and days supply.
- Product replacement now prompts for confirmation when preserving an old dosage across a product with different form/serving/ingredient strength signature.
- `ProductCard` now validates shop links before rendering a buy link and shows `Link melden` for missing/invalid links in stack context. Demo uses a friendly placeholder; authenticated stacks submit to the new backend route.
- Family profiles are intentionally MVP-level: selector, create form, and remove action in `StackWorkspace`; no sensitive health data beyond optional age/weight.
- Validation passed: functions `npx tsc -p tsconfig.json --noEmit`, frontend `npx tsc --noEmit`, frontend `npm run lint --if-present`, frontend `npm run build` (Vite chunk-size warning only), and path-scoped `git diff --check` with CRLF warnings only.
- Concurrent unrelated admin work remains dirty in admin files, plus `.claude/*` and root `logo.png`; do not revert it.

## 2026-05-05 Round Experience V1 Deployed

- Remote D1 migration `0048_user_stack_rounding.sql` applied successfully to `supplementstack-production`.
- Cloudflare Pages project `supplementstack` deployed.
- Preview URL: `https://f9870d82.supplementstack.pages.dev`.
- Live URL: `https://supplementstack.de`, asset `assets/index-CmCtPS8l.js`.
- User stack experience now has a visible stack cockpit/check, grouped Einnahmeplan, product replacement confirmation for preserved dosage assumptions, missing-link reporting, and a minimal family profile MVP with stack assignment.
- Admin workspace now has expanded work queues, inline Product-QA editing for high-impact fields, and publish guardrails for knowledge articles requiring body plus at least one source.
- New backend routes/modules: `/api/family`, `/api/stacks/link-report`, and `PATCH /api/admin/product-qa/:id`.
- Validation passed: functions `npx tsc -p tsconfig.json --noEmit`, frontend `npx tsc --noEmit`, frontend `npm run lint --if-present`, frontend `npm run build`, and `git diff --check` with CRLF warnings only.
- Smoke checks passed: preview/live root 200 with `assets/index-CmCtPS8l.js`; preview/live unauthenticated `/api/family`, `/api/stacks/link-report`, `/api/admin/product-qa/1`, and `/api/admin/ops-dashboard` return 401; remote D1 confirms `family_profiles`, `product_link_reports`, `idx_stacks_family_member_id`, and migration 0048 applied.

## 2026-05-05 Launch Checks And Print Routine Deployed

- Commit `d0b878b` is deployed to Cloudflare Pages project `supplementstack`.
- Preview URL: `https://f97becf1.supplementstack.pages.dev`.
- Live URL: `https://supplementstack.de`, asset `assets/index-BmvNNsmY.js`.
- Admin now has `Linkmeldungen` for `product_link_reports`, including search/filter, current vs reported shop link, and status updates (`open`, `reviewed`, `closed`) via audited `/api/admin/link-reports`.
- Admin `Admin-Uebersicht` now counts open link reports and shows the top link-report queue items.
- Admin now has `Go-Live Checks` with launch notes for Mail/DNS, legal/trust visibility, Cloudflare log checks, D1 backups, and remaining manual DNS tasks.
- StackWorkspace now has `Plan drucken/PDF`, using browser print/save-as-PDF with print-specific CSS that focuses on the stack cockpit and Einnahmeplan.
- Trust copy cleanup: fixed affiliate disclaimer grammar and Impressum product-area typo.
- DNS check via Cloudflare DNS on 2026-05-05: SPF TXT and MX are present; `_dmarc.supplementstack.de` TXT is missing; common DKIM selectors were not found, so DKIM must be enabled/confirmed in the mail provider.
- Validation passed: functions `npx tsc -p tsconfig.json --noEmit`, frontend `npx tsc --noEmit`, frontend `npm run lint --if-present`, frontend `npm run build`, and `git diff --check` with CRLF warnings only.
- Smoke checks passed: preview/live root 200 with `assets/index-BmvNNsmY.js`; unauthenticated preview `/api/admin/link-reports` and `/api/admin/ops-dashboard`, plus live `/api/admin/link-reports`, return 401.

## 2026-05-05 DMARC Record Set

- Cloudflare DNS zone `supplementstack.de` updated via API.
- Created TXT record `_dmarc.supplementstack.de` with `v=DMARC1; p=none; rua=mailto:email@nickkrakow.de; adkim=s; aspf=s; pct=100`.
- Verified through Cloudflare API and public Cloudflare DNS-over-HTTPS: record resolves successfully.
- Admin `Go-Live Checks` tab updated to mark DMARC as set; DKIM remains manual/provider-side.
- Deployed updated frontend checklist to Cloudflare Pages project `supplementstack`.
- Preview URL: `https://4a2e4ba7.supplementstack.pages.dev`.
- Live URL: `https://supplementstack.de`, asset `assets/index-BeN1jbtz.js`.
- Validation passed: frontend `npx tsc --noEmit`, frontend `npm run lint --if-present`, frontend `npm run build`, and scoped `git diff --check` with CRLF warnings only.
- Commit: `55e44f4` - Update launch checklist DMARC status.

## 2026-05-05 DKIM Record Set

- Cloudflare DNS zone `supplementstack.de` updated via API.
- Created TXT record `kas202508251337._domainkey.supplementstack.de` with the All-Inkl/Kasserver DKIM public key supplied by the owner.
- Verified through public Cloudflare DNS-over-HTTPS: DKIM TXT resolves successfully.
- Admin `Go-Live Checks` tab updated to mark DKIM as set; the remaining manual mail task is real outbound mail testing.
- Deployed updated frontend checklist to Cloudflare Pages project `supplementstack`.
- Preview URL: `https://eb099bd2.supplementstack.pages.dev`.
- Live URL: `https://supplementstack.de`, asset `assets/index-Bsg3uhC-.js`.
- Validation passed: frontend `npx tsc --noEmit`, frontend `npm run lint --if-present`, frontend `npm run build`, and scoped `git diff --check` with CRLF warnings only.
- Commit: `7f9c67a` - Update launch checklist DKIM status.

## 2026-05-05 Stack Creation And Content Preview Hotfix Deployed

- Commit `6d0cff4` deployed to Cloudflare Pages project `supplementstack`.
- Preview URL: `https://a9ed6e3e.supplementstack.pages.dev`.
- Live URL: `https://supplementstack.de`, asset `assets/index-CTRHry5S.js`.
- Fixed `POST /api/stacks`: omitted `family_member_id` is now treated as `null` / self profile instead of invalid input. This unblocks first-stack creation for new accounts.
- Frontend stack create/update paths now surface backend error messages instead of always showing generic stack save/create text.
- Product selection preview now shows product `Inhalt` instead of `Packung`/`Portionen`, using total contained units plus calculated days supply for the selected target dose. Example: D3 drops at 10,000 IE display as roughly `1.000 Tropfen (reicht für 66 Tage)`.
- Validation passed: functions `npx tsc -p tsconfig.json --noEmit`, frontend `npx tsc --noEmit`, frontend `npm run lint --if-present`, frontend `npm run build`, and `git diff --check` with CRLF warnings only.
- Smoke checks passed: fresh test account could create an empty stack and save Vitamin D3 2000 IU drops at 10,000 IE daily (`quantity=5`). Preview/live root 200 with `assets/index-CTRHry5S.js`.
- Temporary `qa-stack-%@example.com` test users/stacks/tokens/consents were deleted from production after verification; remaining count is 0.

## 2026-05-05 Stack Cockpit Simplification Deployed

- Commit `8768854` deployed to Cloudflare Pages project `supplementstack`.
- Preview URL: `https://2de2b5ec.supplementstack.pages.dev`.
- Live URL: `https://supplementstack.de`, asset `assets/index-BKappw8q.js`.
- The visible `Stack-Check` cockpit was simplified: middle metric tiles for warnings, duplicate ingredients, missing links, and stock/range were removed from the user stack page.
- The stack header area now focuses on stack name, profile assignment, family profile creation, and a compact clock button.
- The intake/routine plan is collapsed by default and expands from the clock button next to the profile controls. It remains rendered for print/PDF via print CSS.
- The bottom fixed bar is now a centered footer overlay showing selected product count, one-time cost, monthly cost, and `Alles auswaehlen` / `Alles abwaehlen`.
- Product selection defaults to all products selected when a stack loads or changes; newly added products are selected automatically.
- Duplicate products are blocked earlier in the add-product modal and are rejected by stack payload normalization on the backend.
- Validation passed: functions `npx tsc -p tsconfig.json --noEmit`, frontend `npx tsc --noEmit`, frontend `npm run lint --if-present`, frontend `npm run build`, frontend `npm test -- --run` (5 tests), and `git diff --check` with CRLF warnings only.
- Smoke checks passed: preview/live root return 200 with `assets/index-BKappw8q.js`.

## 2026-05-05 Whole-Unit Dosage And Footer Polish Deployed

- Cloudflare Pages project `supplementstack` deployed.
- Preview URL: `https://972cb5fc.supplementstack.pages.dev`.
- Preview asset: `assets/index-HwTaoKFr.js`.
- Stack/product calculations now treat product ingredient potency as amount per physical intake unit when `basis_quantity` or multi-unit `serving_size` data exists. Example: `3 Tropfen = 2000 IE` becomes about `666.67 IE` per drop, so `800 IE` rounds up to `2 Tropfen` and `10000 IE` rounds up to `15 Tropfen`.
- Package range and monthly costs now use total physical intake units (`servings_per_container * serving_size * container_count`) and floor the range in whole days.
- The same calculation path is mirrored in frontend stack/product rendering and backend stack mail rendering. Print/PDF uses the frontend stack/routine rendering, so it inherits the whole-unit range/cost logic.
- Product cards, routine fallback labels, and stack mail daily unit labels now pluralize common units such as Kapsel/Kapseln, Tablette/Tabletten, Portion/Portionen, and Softgel/Softgels.
- Stack footer overlay is hidden while stack modals are open; the page footer receives extra desktop bottom spacing while the overlay is visible, and mobile uses an in-flow sticky footer bar to reduce overlap.
- Visible ASCII fallback texts in the touched stack/product surfaces were corrected, including `FrÃ¼hstÃ¼ck`, `wÃ¤hlbar`, `verfÃ¼gbar`, and `Ã¶ffnen`.
- Validation passed: frontend `npm test -- --run` (6 tests), frontend `npx tsc --noEmit`, frontend `npm run lint --if-present`, frontend `npm run build`, functions `npx tsc -p tsconfig.json --noEmit`, and `git diff --check` with CRLF warnings only.
- Preview smoke passed: preview root returned 200 with `assets/index-HwTaoKFr.js`; preview `/demo` rendered the updated stack UI and bottom bar. Browser-Harness screenshots were taken during QA and should be treated as temporary artifacts only.
- Live-domain note: after deploy, public recursive DNS checks for `supplementstack.de` returned `SERVFAIL` from 1.1.1.1 and 8.8.8.8. The Cloudflare zone is active, Pages still lists `supplementstack.de`, Cloudflare DNS records exist, and direct queries against `piper.ns.cloudflare.com` / `sonny.ns.cloudflare.com` return the expected A records. This looks like a recursive DNS/delegation-resolution issue to recheck before relying on the live-domain smoke.

## 2026-05-06 Stack Product View Toggle - Local

- User stack product overview now renders products in stack order without the former client-side category buckets such as "Allgemeine Versorgung" or "Entgiftung".
- `StackWorkspace` has a persisted product view toggle for `Kacheln` and `Liste`, stored in browser localStorage under `supplement-stack-product-view`.
- Product cards support a `display="list"` variant with responsive CSS that becomes a compact row on desktop and a stacked card on tablet/mobile.
- Validation passed locally: frontend ESLint, frontend TypeScript, frontend Vitest stack calculation tests, frontend production build, and `git diff --check` with CRLF warnings only.

## 2026-05-06 Stack Product View Toggle Deployed

- Latest stack product view toggle commit deployed to Cloudflare Pages project `supplementstack`.
- Preview: `https://336cf419.supplementstack.pages.dev`.
- Live: `https://supplementstack.de`, asset `assets/index-vwRdauH5.js`.
- Stack products now render in stack order without heuristic category grouping, and users can switch between `Kacheln` and `Liste` with localStorage persistence.
- Smokes passed for preview/live `/` and `/demo`.

## 2026-05-06 Product Card Info And Grid Order Deployed

- Product cards now render `effect_summary` as a `Wirkung` section with up to four short chips when the text is comma/semicolon separated, keeping the card informative without long copy.
- The stack card view no longer uses CSS multi-column balancing. The existing `masonry-grid` class now uses a responsive row-first CSS grid so new cards start on the left in the next row.
- Validation passed locally: frontend ESLint, frontend TypeScript, frontend Vitest 6 tests, frontend production build, and `git diff --check` with CRLF warnings only.

## 2026-05-06 Product Card Info And Grid Order Deployed Update

- Commit `f85093b` deployed to Cloudflare Pages project `supplementstack`.
- Preview: `https://3f1bbcc8.supplementstack.pages.dev`.
- Live: `https://supplementstack.de`, assets `assets/index-BGkjPN9_.js` and `assets/index-428wN7Dg.css`.
- Product cards show short `Wirkung` chips from existing effect summaries.
- Card view is row-first so new rows begin on the left.
- Smokes passed for preview/live `/` and `/demo`.
