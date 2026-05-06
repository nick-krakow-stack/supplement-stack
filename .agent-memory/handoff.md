# Handoff

Last updated: 2026-05-05

## Continuation Point

Most recent investigation: production D1 demo product data explains the
`385,59 EUR/Monat` demo footer outlier. `/api/demo/products` exposes the main
ingredient row as top-level `quantity`/`unit`; products without `dosage_text`
fall back to that quantity. SchwarzkÃ¼mmelÃ¶l has `quantity=40`, `unit=mg`,
`serving_size=2`, `serving_unit=Kapseln`, `servings_per_container=30`, and
`dosage_text=NULL`, so the current fallback interprets `40 mg` as 40 intake
units/day and produces 1 day supply / 341,70 EUR monthly. Product data is also
incomplete for several demo products (D3/K2, Ginseng, Vitamin C,
SchwarzkÃ¼mmelÃ¶l, Grapefruitkernextrakt, B-Komplex missing dosage text), while
Magnesium's `dosage_text='2 Kapseln tÃ¤glich (888mg)'` conflicts with
`quantity=300mg` and `serving_size=2`. No calculation change was applied after
the user asked to verify DB data first.

Continue from `main` with local email-verification implementation complete but
not committed, remote-migrated, deployed, or live-smoked. Apply/commit only
`d1-migrations/0043_email_verification.sql` for this feature; it uses a separate
`email_verification_tokens` table to avoid legacy user-column collisions; unrelated local
health-claims audit work includes untracked `d1-migrations/0044_health_claim_content_audit.sql`
and must be coordinated separately.

## Restart Startup (exact)

1. `AGENTS.md`
2. `CLAUDE.md`
3. `.agent-memory/current-state.md`
4. `.agent-memory/handoff.md`
5. `.agent-memory/next-steps.md`
6. `git status --short`

## Git / Worktree

- Local email-verification implementation is present and validated:
  - Owned files: `d1-migrations/0043_email_verification.sql`,
    `functions/api/modules/auth.ts`, `functions/api/lib/mail.ts`,
    `functions/api/lib/types.ts`, `frontend/src/api/auth.ts`,
    `frontend/src/contexts/AuthContext.tsx`, `frontend/src/App.tsx`,
    `frontend/src/pages/RegisterPage.tsx`, `frontend/src/pages/LoginPage.tsx`,
    `frontend/src/pages/ProfilePage.tsx`, `frontend/src/pages/VerifyEmailPage.tsx`,
    and `frontend/src/types/index.ts`.
  - Behavior: registration creates a 48-hour verification token, stores its
    SHA-256 hash in `email_verification_tokens`, and sends the raw token via SMTP; mail failure does not block account creation; verify and
    authenticated resend endpoints are rate-limited; frontend has `/verify-email`,
    resend action, and profile/login/register nudges; normal login is not blocked.
  - Checks passed: functions `npx tsc -p tsconfig.json`, frontend
    `npx tsc --noEmit`, frontend lint/build/Vitest, and `git diff --check`
    with CRLF warnings only.
  - Not done: no remote D1 migration, deploy, or live SMTP smoke in this pass.
- Latest committed/deployed launch-readiness bundle:
  - `6a639cd` - Feature: Close launch readiness gaps.
  - Preview URL: `https://d8e1340c.supplementstack.pages.dev`.
  - Live URL: `https://supplementstack.de`.
  - New build asset: `assets/index-BlZlfAwp.js`.
  - Scope: dose/cost calculation hardening, Admin dose-recommendation CRUD,
    Admin sub-ingredient mapping UI, Admin audit-log viewer, legal/consent
    preflight copy, context-near affiliate labels, strict frontend TypeScript
    cleanup, and 5 stack-calculation tests.
  - No D1 migration.
  - Checks passed: frontend `npx tsc --noEmit`, frontend lint/build/Vitest,
    functions TypeScript, and `git diff --check`.
  - Smokes passed: preview/live root 200; preview/live unauth admin audit-log
    and dose-recommendations 401; preview/live demo products 200 with
    `basis_quantity`, `basis_unit`, and `search_relevant` fields.
  - Existing unrelated dirty/untracked files still not related to this task:
    `.claude/SESSION.md`, `.claude/settings.json`, and root `logo.png`.
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
  - Live D3 mail-format smoke: product 23 with `10000 IE tÃ¤glich` and
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

1. Entscheidung (2026-05-05): SearchPage und WishlistPage werden bewusst nur Ã¼ber
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

## 2026-05-05 - Email Verification And Health-Claims Audit Deployed

Continue from `main` after the email-verification and health-claims audit bundle. Code is implemented and deployed; commit still needs to be created if not already present in git history.

Completed:
- Remote D1 migrations `0043_email_verification.sql` and `0044_health_claim_content_audit.sql` applied to `supplementstack-production`.
- Correct Cloudflare Pages project `supplementstack` deployed. Preview: `https://42cd17dd.supplementstack.pages.dev`; live `https://supplementstack.de` uses `assets/index-uekEwu_R.js`.
- Validation passed: functions TypeScript, frontend TypeScript, lint, build, Vitest 5 tests, and diff-check.
- Live smokes passed for root, `/verify-email`, invalid verify API 400, unauth resend 401, demo products count 7, migration journal 0043/0044, token table presence, and zero existing unverified users.

Workspace notes:
- Do not commit unrelated `.claude/SESSION.md`, `.claude/settings.json`, or root `logo.png` unless explicitly requested.
- Health-claims audit is only a conservative wording pass. Final legal sign-off and scientific dose/source validation remain separate work.
- DMARC is not set yet for `_dmarc.supplementstack.de`; MX/SPF point to All-Inkl/Kasserver and default DKIM selector was not found.

## 2026-05-05 - Product Safety Warnings Local Handoff

Continue from `main` with product/ingredient safety warnings implemented locally but not committed, migrated remotely, deployed, or live-smoked.

Owned warning files added/changed:
- `d1-migrations/0046_knowledge_warnings.sql`
- `functions/api/modules/knowledge.ts`
- `functions/api/[[path]].ts`
- `functions/api/modules/products.ts`
- `functions/api/modules/ingredients.ts`
- `functions/api/modules/demo.ts`
- `functions/api/modules/stacks.ts`
- `functions/api/modules/user-products.ts`
- `frontend/src/components/ProductCard.tsx`
- `frontend/src/components/StackWorkspace.tsx`
- `frontend/src/pages/KnowledgeArticlePage.tsx`
- `frontend/src/App.tsx`
- `frontend/src/types/index.ts`

Behavior:
- Product cards show concise ingredient safety labels with an info icon popover and a knowledge-base article link.
- Seeded first warning/article is Beta-Carotin + smokers/high-dose lung cancer risk, based on EFSA, NIH ODS, and NCI sources.
- Warnings are general product/ingredient warnings; no smoker status is stored or used.
- Warning helper suppresses the seeded threshold warning when a comparable per-serving amount is known and below 15 mg; it still attaches when threshold comparison is unavailable.

Validation passed:
- `npx tsc -p tsconfig.json` in `functions/`
- `npx tsc --noEmit` in `frontend/`
- `npm run build` in `frontend/`
- `npm test -- --run` in `frontend/` (5 tests)
- Focused frontend ESLint on touched files
- In-memory SQLite probe for migration 0046 with dummy `ingredients` table and `Beta-Carotin` row
- `git diff --check` with CRLF warnings only

Known blockers/notes:
- Full frontend `npm run lint --if-present` is blocked by unrelated `PrivacyPage.tsx` `react/no-unescaped-entities` errors.
- Concurrent unrelated data-minimization edits are present in auth/profile/type files. Do not revert them.
- Existing unrelated `.claude/SESSION.md`, `.claude/settings.json`, and root `logo.png` remain out of scope.

## 2026-05-05 - Data Minimization Local Handoff

Continue from `main` with account/profile/consent data minimization implemented locally but not committed, remote-migrated, deployed, or live-smoked.

Owned data-minimization files changed/added:
- `d1-migrations/0045_data_minimization_profile_fields.sql`
- `functions/api/modules/auth.ts`
- `frontend/src/api/auth.ts`
- `frontend/src/contexts/AuthContext.tsx`
- `frontend/src/pages/RegisterPage.tsx`
- `frontend/src/pages/ProfilePage.tsx`
- `frontend/src/pages/PrivacyPage.tsx`
- `frontend/src/types/index.ts` (also contains concurrent unrelated safety-warning type additions; do not revert them)

Behavior:
- Registration collects email/password, consent, optional numeric age, and optional guideline source only; gender was removed.
- Profile edit only sends age and guideline source. Gender, weight, diet, goals, and smoker status UI/state/payloads were removed.
- Backend register ignores removed fields and inserts `NULL` into legacy profile columns. Login, `GET /api/me`, and `PUT /api/me` no longer return gender, weight, diet, goals, or `is_smoker`. `PUT /api/me` only updates age and guideline source.
- Privacy and registration consent copy were narrowed to account, optional age, guideline source, saved stacks/products, dosage/intake interval/cost data, and user-submitted product data. It does not claim there is no health-adjacent data.
- Migration 0045 nulls `gender`, `weight`, `diet_type`, and `personal_goals`; `is_smoker` is reset to `0` because existing schema makes it `NOT NULL`.

Validation passed:
- `npx tsc -p tsconfig.json` in `functions/`
- `npx tsc --noEmit` in `frontend/`
- `npm run lint --if-present` in `frontend/`
- `npm run build` in `frontend/`
- `npm test -- --run` in `frontend/` (5 tests)
- Targeted removed-field scans
- `git diff --check` with CRLF warnings only

Known notes:
- `sqlite3` is not installed locally, so migration 0045 was not executed in a SQLite syntax probe.
- Concurrent unrelated product-safety-warning work is present in the same worktree: migration `0046_knowledge_warnings.sql`, knowledge route/page, warning changes in product/demo/stack files, and type additions. Keep it separate from data-minimization commits.
- Existing unrelated `.claude/SESSION.md`, `.claude/settings.json`, and root `logo.png` remain out of scope.

## 2026-05-05 - Data Minimization And Safety Warnings Deployed

Continue from `main` after deploying the data-minimization and product safety-warning bundle.

Completed:
- Remote D1 migrations `0045_data_minimization_profile_fields.sql` and `0046_knowledge_warnings.sql` applied to `supplementstack-production`.
- Cloudflare Pages project `supplementstack` deployed. Preview: `https://33f76fe5.supplementstack.pages.dev`; live `https://supplementstack.de` uses `assets/index-BG4hesq7.js`.
- Registration/profile now collect only email/password, consent, optional age, and optional guideline source. Auth/profile responses no longer expose gender, profile weight, diet, goals, or `is_smoker`.
- Legacy stored values were cleared/reset by migration 0045.
- Product safety warnings and knowledge articles are live, with the first Beta-Carotin article at `/wissen/beta-carotin-raucher-lungenkrebs`.
- The Beta-Carotin warning is form-specific for the existing Vitamin A Beta-Carotin form and does not store smoker status.
- Checks passed: functions TypeScript, frontend TypeScript, frontend lint, frontend build, frontend Vitest 5 tests, and `git diff --check`.
- Smokes passed for root, knowledge article/API, demo products, migration journal, warning seed, profile-field cleanup, profile GET/PUT response shape, and temporary Beta-Carotin user-product warning display. Temporary smoke data was deleted.

Workspace notes:
- Commit the current feature if not already committed in git history.
- Do not commit unrelated `.claude/SESSION.md`, `.claude/settings.json`, or root `logo.png`.
- Remaining follow-up: manual browser QA for the warning popover on hover, keyboard focus, and mobile tap; later admin UI for knowledge/warning content.

## 2026-05-05 - Ingredient Research Admin Cockpit Deployed

Continue from the committed/deployed admin research cockpit work.

Completed:
- Remote D1 migration `0047_ingredient_research_admin.sql` applied to `supplementstack-production`.
- Cloudflare Pages project `supplementstack` deployed. Preview: `https://52db1978.supplementstack.pages.dev`; live `https://supplementstack.de` uses `assets/index-DTMpE7Sg.js`.
- Admin `Wirkstoff-Recherche` tab is wired into `AdminLayout` and `AdminPage`.
- Backend admin routes under `/api/admin/ingredient-research` support list/detail, status upsert, source create/update/delete, and safety-warning create/update/soft-delete.
- Source records hold country/organization, recommendation/no-recommendation data, dose ranges, study findings/outcomes, source links, DOI/PubMed IDs, notes, and review dates.
- Safety warnings reuse existing `ingredient_safety_warnings`; full knowledge article body editing remains separate future work.

Validation:
- `npm run lint` in `frontend/`
- `npm run build` in `frontend/`
- `npx tsc -p tsconfig.json --noEmit` in `functions/`
- `git diff --check`
- Remote D1 table existence check for `ingredient_research_status` and `ingredient_research_sources`
- Preview/live root 200 with asset `assets/index-DTMpE7Sg.js`
- Preview/live unauthenticated `/api/admin/ingredient-research` 401

Workspace notes:
- Existing unrelated `.claude/SESSION.md`, `.claude/settings.json`, and root `logo.png` remain out of scope.
- Next practical check: authenticated admin browser QA for the new tab on desktop and mobile.

## 2026-05-05 - Admin Usability Backend Bundle Local Handoff

Continue from `main` with backend-only admin usability routes implemented locally in `functions/api/modules/admin.ts`.

Completed:
- Added admin-only knowledge article CRUD for existing `knowledge_articles` table under `/api/admin/knowledge-articles`.
- `POST`/`PUT` validate conservative slugs, status `draft|published|archived`, ISO-like `reviewed_at`, and `sources_json` as an array or JSON array string.
- Slug changes are not allowed on update. `DELETE /knowledge-articles/:slug` archives by setting `status='archived'` because warnings may reference article slugs.
- Added `GET /api/admin/ops-dashboard` with compact counts for ingredients, research workflow states, review due rows, sources, warnings, drafts, products, and product QA issues.
- Added `GET /api/admin/product-qa?q=&issue=&limit=100` with computed issue flags and ingredient/main-ingredient counts.
- Added `GET /api/admin/ingredient-research/export`, ordered before the dynamic ingredient research route.
- No migration was created; existing schema is sufficient.

Validation:
- `npx tsc -p tsconfig.json --noEmit` in `functions/` passed.
- `git diff --check -- functions/api/modules/admin.ts` passed with CRLF warning only.

Workspace notes:
- Do not revert unrelated concurrent changes: `.claude/SESSION.md`, `.claude/settings.json`, `frontend/src/api/admin.ts`, untracked `frontend/src/pages/admin/AdminKnowledgeArticlesTab.tsx`, untracked `frontend/src/pages/admin/AdminOpsDashboardTab.tsx`, and root `logo.png`.
- Only intentional backend source change from this session is `functions/api/modules/admin.ts`; memory files were appended per repo handoff protocol.

## 2026-05-05 - Admin Usability Frontend Bundle Local Handoff

Continue from `main` with frontend/admin usability UI implemented locally.

Completed:
- Added typed admin API helpers in `frontend/src/api/admin.ts` for knowledge article list/detail/create/update/archive, ops dashboard counts, product QA listing, and optional ingredient research JSON export.
- Added `frontend/src/pages/admin/AdminOpsDashboardTab.tsx` for the `Admin-Uebersicht` landing cards and JSON export button.
- Added `frontend/src/pages/admin/AdminKnowledgeArticlesTab.tsx` for responsive knowledge article search/filter/list/editor/create/archive flows.
- Added `frontend/src/pages/admin/ProductQATab.tsx` for responsive product QA cards/table, search, issue filter, and issue chips.
- Wired `Wissen`, `Produkt-QA`, and `Admin-Uebersicht` labels/tabs through `frontend/src/components/AdminLayout.tsx` and `frontend/src/pages/AdminPage.tsx`.

Validation:
- `npx tsc --noEmit` in `frontend/` passed.
- `npm run lint --if-present` in `frontend/` passed.
- `npm run build` in `frontend/` passed with the existing Vite chunk-size warning only.

Workspace notes:
- Do not revert unrelated concurrent changes: `.claude/SESSION.md`, `.claude/settings.json`, root `logo.png`, memory file edits, or backend `functions/api/modules/admin.ts`.
- This frontend bundle expects the concurrent backend routes under `/api/admin` described in the task.
## 2026-05-05 - Admin Ops And Knowledge Tools Deployed Handoff

Continue from `main` after deployed admin usability bundle.

Completed:
- Backend admin routes for knowledge article CRUD/archive, ops dashboard counts, product QA listing, and ingredient research JSON export are implemented in `functions/api/modules/admin.ts`.
- Frontend admin tabs are implemented: `Admin-Uebersicht`, `Wissen`, and `Produkt-QA`.
- Frontend integration fixes were applied so Product-QA issue filters match backend issue keys and ops dashboard cards read the flat backend response keys.
- No migration was needed.
- Deployed to Cloudflare Pages project `supplementstack`.

Validation:
- Functions `npx tsc -p tsconfig.json --noEmit` passed.
- Frontend `npx tsc --noEmit`, `npm run lint --if-present`, and `npm run build` passed; Vite chunk-size warning only.
- `git diff --check` passed with CRLF warnings only.
- Smoke checks: preview/live root 200 with `assets/index-DVbWbGLx.js`; preview/live unauthenticated admin routes `/api/admin/ops-dashboard`, `/api/admin/knowledge-articles`, and `/api/admin/product-qa` return 401.

Workspace notes:
- Unrelated `.claude/SESSION.md`, `.claude/settings.json`, and root `logo.png` remain out of scope and should not be committed unless explicitly requested.
- Next practical check is authenticated admin browser QA on desktop and mobile.

## 2026-05-05 - Admin Arbeitsplatz V1 Local Handoff

Continue from `main` with Admin Arbeitsplatz v1 implemented locally but not committed, deployed, or authenticated-browser-smoked.

Completed:
- Extended `GET /api/admin/ops-dashboard` with limited top queue items for product QA, research due, stale/unreviewed research, warnings without article, and draft knowledge articles.
- Added admin-only `PATCH /api/admin/product-qa/:id` for `price`, `shop_link`, `is_affiliate`, `serving_size`, `serving_unit`, `servings_per_container`, and `container_count`, with `ensureAdmin`, validation, and audit logging.
- Added backend and frontend guardrails so knowledge articles cannot be published without non-empty body and at least one source array entry.
- Added frontend admin queue panels for "Heute bearbeiten" and "Spaeter einplanen" with contextual links.
- Added inline Product-QA editing in mobile cards and desktop rows.
- Added `q=` context support to `ProductQATab`, `AdminKnowledgeArticlesTab`, and `IngredientResearchTab`.

Validation:
- `npx tsc -p tsconfig.json --noEmit` in `functions/` passed.
- `npx tsc --noEmit` in `frontend/` passed.
- `npm run lint --if-present` in `frontend/` passed with two unrelated `StackWorkspace.tsx` hook dependency warnings.
- `npm run build` in `frontend/` passed with Vite chunk-size warning only.
- Scoped `git diff --check` passed with CRLF warnings only.

Workspace notes:
- Intentional admin changes: `functions/api/modules/admin.ts`, `frontend/src/api/admin.ts`, `frontend/src/pages/admin/AdminOpsDashboardTab.tsx`, `frontend/src/pages/admin/ProductQATab.tsx`, `frontend/src/pages/admin/AdminKnowledgeArticlesTab.tsx`, and `frontend/src/pages/admin/IngredientResearchTab.tsx`.
- Concurrent unrelated changes are present in stack/family files, `.claude/*`, `frontend/src/styles.css`, `frontend/src/types/index.ts`, `functions/api/[[path]].ts`, `functions/api/lib/types.ts`, `functions/api/modules/stacks.ts`, `d1-migrations/0048_user_stack_rounding.sql`, and root `logo.png`; do not revert them.

## 2026-05-05 - User-Rundung V1 Local Handoff

Continue from `main` with User-Rundung v1 implemented locally but not committed, remote-migrated, deployed, or browser-smoked.

Completed:
- Added migration `d1-migrations/0048_user_stack_rounding.sql` for `family_profiles`, nullable `stacks.family_member_id`, and `product_link_reports`.
- Added authenticated `/api/family` CRUD in `functions/api/modules/family.ts` and mounted it in `functions/api/[[path]].ts`.
- Extended stack list/detail/create/update with family assignment fields and ownership validation.
- Added authenticated rate-limited `POST /api/stacks/link-report` for missing/invalid shop links.
- Added typed frontend `frontend/src/api/family.ts` and `reportProductLink` in `frontend/src/api/stacks.ts`.
- `StackWorkspace` now renders a visible stack cockpit/check panel and real routine grouping by timing. Authenticated conflict status loads `/api/stack-warnings/:id`; demo uses local duplicate effective ingredient checks.
- Product replacement now asks for confirmation before preserving an old dosage onto a product with a different form/serving/ingredient strength signature.
- `ProductCard` now suppresses invalid buy links and shows `Link melden` in stack context.
- Family profile UI is deliberately minimal in `StackWorkspace`: assign self/family member, create member, remove member.

Validation:
- `npx tsc -p tsconfig.json --noEmit` in `functions/` passed.
- `npx tsc --noEmit` in `frontend/` passed.
- `npm run lint --if-present` in `frontend/` passed.
- `npm run build` in `frontend/` passed with Vite chunk-size warning only.
- Path-scoped `git diff --check` over user-stack touched files passed with CRLF warnings only.

Workspace notes:
- Intentional User-Rundung files: `d1-migrations/0048_user_stack_rounding.sql`, `functions/api/modules/family.ts`, `functions/api/modules/stacks.ts`, `functions/api/[[path]].ts`, `functions/api/lib/types.ts`, `frontend/src/api/family.ts`, `frontend/src/api/stacks.ts`, `frontend/src/components/StackWorkspace.tsx`, `frontend/src/components/ProductCard.tsx`, `frontend/src/types/index.ts`, and `frontend/src/styles.css`.
- Concurrent unrelated admin work is dirty in admin files. `.claude/*` and root `logo.png` are also dirty/untracked. Do not revert them.

## 2026-05-05 - Round Experience V1 Deployed Handoff

Continue from `main` after deployed round-experience bundle.

Completed:
- Migration `0048_user_stack_rounding.sql` added and applied remotely. It creates `family_profiles`, adds nullable `stacks.family_member_id`, and creates `product_link_reports`.
- Backend adds `/api/family`, `/api/stacks/link-report`, and `PATCH /api/admin/product-qa/:id`.
- StackWorkspace now includes stack cockpit/check, grouped Einnahmeplan, family profile assignment, link reporting, and replacement confirmation when preserving dosage/timing across a different product signature.
- Admin dashboard includes actionable queues; Product-QA supports inline editing; published knowledge articles require body and at least one source.
- Deployed to Cloudflare Pages project `supplementstack`.

Validation:
- Functions TypeScript, frontend TypeScript, frontend lint, frontend build, and `git diff --check` passed.
- Build warning: Vite chunk-size warning remains.
- Smoke checks: preview/live root 200 with `assets/index-CmCtPS8l.js`; unauthenticated new protected routes return 401; remote D1 confirms 0048 objects and migration journal row.

Workspace notes:
- Unrelated `.claude/SESSION.md`, `.claude/settings.json`, and root `logo.png` remain out of scope.
- Next practical check is authenticated browser QA for the new user/admin workflows.

## 2026-05-05 - Launch Checks And Print Routine Handoff

Continue from `main` after deployed launch-check/print bundle.

Completed:
- Commit `d0b878b` deployed to Cloudflare Pages project `supplementstack`.
- Added admin `Linkmeldungen` tab backed by `/api/admin/link-reports` GET/PATCH for `product_link_reports` status management.
- Added open link report counts and top queue items to `/api/admin/ops-dashboard` and `AdminOpsDashboardTab`.
- Added admin `Go-Live Checks` tab documenting Mail/DNS, legal/trust, monitoring/logs, backups, and remaining manual DNS tasks.
- Added `Plan drucken/PDF` to `StackWorkspace`; print CSS hides app chrome/product cards and prints the cockpit plus Einnahmeplan.
- Fixed small trust copy issues in `LegalDisclaimer` and `ImprintPage`.

Validation:
- Functions TypeScript, frontend TypeScript, frontend lint, frontend build, and `git diff --check` passed.
- Build warning: Vite chunk-size warning remains.
- Smoke checks: preview/live root 200 with `assets/index-BmvNNsmY.js`; unauthenticated protected admin routes return 401.

DNS notes:
- Current DNS check found SPF and MX present.
- `_dmarc.supplementstack.de` TXT is missing.
- Common DKIM selectors were not found; enable/confirm DKIM in All-Inkl/Kasserver and set the provider's DKIM record.

Workspace notes:
- Unrelated `.claude/SESSION.md`, `.claude/settings.json`, and root `logo.png` remain out of scope.
- User wants Google OAuth next before launch.

## 2026-05-05 - DMARC Handoff

Completed:
- Set `_dmarc.supplementstack.de` TXT in Cloudflare DNS.
- Record: `v=DMARC1; p=none; rua=mailto:email@nickkrakow.de; adkim=s; aspf=s; pct=100`.
- Verified DNS propagation via Cloudflare DNS-over-HTTPS.
- Updated and deployed Admin `Go-Live Checks` so DMARC is marked OK and only DKIM remains manual.

Next:
- Enable/confirm DKIM in All-Inkl/Kasserver and set the provided DKIM DNS record.
- After DKIM is active and mail tests are stable, consider raising DMARC from `p=none` to `p=quarantine`, later `p=reject`.

## 2026-05-05 - DKIM Handoff

Completed:
- Set `kas202508251337._domainkey.supplementstack.de` TXT in Cloudflare DNS using the All-Inkl/Kasserver DKIM public key.
- Verified DNS propagation via Cloudflare DNS-over-HTTPS.
- Updated and deployed Admin `Go-Live Checks` so DKIM is marked OK.

Next:
- Send real registration, verification, password reset, and stack emails to external inboxes.
- Check message headers for `DKIM-Signature` with `d=supplementstack.de` and `s=kas202508251337`.
- If SPF/DKIM/DMARC alignment is stable for a while, later consider raising DMARC from `p=none` to `p=quarantine`, then `p=reject`.

## 2026-05-05 - Stack Creation Hotfix Handoff

Completed:
- Fixed stack creation for new accounts by making omitted `family_member_id` default to `null` on `POST /api/stacks`.
- Deployed live and verified with a fresh test account: empty stack creation works, and saving Vitamin D3 2000 IU drops at 10,000 IE daily creates one stack item with `quantity=5`.
- Product selection preview now uses `Inhalt` and contained units/days supply instead of `Packung: X Portionen`.
- Temporary production test accounts matching `qa-stack-%@example.com` were cleaned up.

Next:
- User should hard-refresh/reopen `supplementstack.de`, then retry `Meine Stacks` and adding Vitamin D3.
- If a user still has an old failed in-memory stack state in the tab, reloading the page should force the fixed start-stack creation path.

## 2026-05-05 - Stack Cockpit Simplification Handoff

Completed:
- Removed the visible Stack-Check metric cockpit from the user stack page.
- Intake/routine plan is collapsed by default and toggled by a compact clock button beside the profile controls.
- Bottom bar is now a centered footer overlay with selected product count, one-time cost, monthly cost, and `Alles auswaehlen` / `Alles abwaehlen`.
- Product selection defaults to all products selected on stack load/change; new products are selected automatically.
- Duplicate stack products are blocked in the add-product modal and by backend stack item normalization.
- Deployed to Cloudflare Pages. Preview: `https://2de2b5ec.supplementstack.pages.dev`; live asset: `assets/index-BKappw8q.js`.

Validation:
- Functions TypeScript, frontend TypeScript, frontend ESLint, frontend build, frontend Vitest 5 tests, and `git diff --check` passed.
- Preview/live root returned 200 with the new asset.

Next:
- Manual browser QA on the real stack page: open/close the clock intake plan, select/deselect products, verify footer cost changes, and confirm duplicate add attempts show `Bereits im Stack`.

## 2026-05-05 - Whole-Unit Dosage And Footer Polish Handoff

Completed:
- Product/stack calculation now uses physical intake units for multi-unit portions. If product data says `3 Tropfen = 2000 IE`, calculations derive per-drop potency and round required intake up to whole drops/tablets/capsules.
- D3 examples are covered by tests: `10000 IE tÃ¤glich` -> `15 Tropfen`, `66` days with the existing package data; `800 IE tÃ¤glich` -> `2 Tropfen`.
- Frontend stack/product rendering, print/PDF routine, and backend stack mail use the same whole-unit semantics through their mirrored calculation helpers.
- Stack mail daily amount labels and frontend fallback dose labels now pluralize common count units.
- The footer overlay no longer stays visible on top of stack modals. Desktop legal footer gets extra bottom spacing when the overlay is visible; mobile uses an in-flow sticky bottom bar.
- Touched visible ASCII fallback text was converted to proper German umlauts.
- Deployed to Cloudflare Pages project `supplementstack`. Preview: `https://972cb5fc.supplementstack.pages.dev`.

Validation:
- Frontend `npm test -- --run` passed with 6 tests.
- Frontend `npx tsc --noEmit`, `npm run lint --if-present`, and `npm run build` passed.
- Functions `npx tsc -p tsconfig.json --noEmit` passed.
- `git diff --check` passed with CRLF warnings only.
- Preview root returned 200 with `assets/index-HwTaoKFr.js`.

Important follow-up:
- Live-domain DNS is currently not reliable from recursive resolvers: 1.1.1.1 and 8.8.8.8 returned `SERVFAIL` for `supplementstack.de` after deploy. Cloudflare API shows the zone active and Pages custom domain still attached; direct authoritative queries to Cloudflare nameservers return the expected A records. Recheck this before live-domain QA/launch.

Workspace notes:
- Existing unrelated `.claude/SESSION.md`, `.claude/settings.json`, and root `logo.png` remain out of scope.
- Temporary Browser-Harness screenshots named `qa-*.png` may exist locally and can be deleted after final review.

## 2026-05-06 Stack Product View Toggle Handoff

Completed locally:
- Removed user-facing stack product category grouping and sorting from `StackWorkspace`; products now render directly in stack order.
- Added the `Kacheln`/`Liste` product view toggle with localStorage persistence.
- Added `ProductCard` list display support and responsive CSS for desktop and mobile.

Validation:
- Frontend ESLint passed.
- Frontend TypeScript passed.
- Frontend Vitest passed with 6 stack calculation tests.
- Frontend production build passed with the existing Vite chunk-size warning.
- `git diff --check` passed with CRLF warnings only.

Next:
- Deploy the frontend bundle and smoke-check `/demo` plus authenticated `/stacks` product view switching.

## 2026-05-06 Stack Product View Toggle Deployed Handoff

Completed and deployed:
- Removed heuristic category grouping from the stack product overview.
- Added persisted `Kacheln` / `Liste` toggle.
- Deployed preview `https://336cf419.supplementstack.pages.dev` and live `https://supplementstack.de` with asset `assets/index-vwRdauH5.js`.

Validation:
- Frontend ESLint, TypeScript, Vitest, build, and `git diff --check` passed.
- Preview/live `/` and `/demo` returned HTTP 200.

Next:
- Manual browser QA on authenticated `/stacks` for the view toggle on desktop and mobile.

## 2026-05-06 Product Card Info And Grid Order Handoff

Completed locally:
- ProductCard `Einordnung` changed to a more useful `Wirkung` section.
- Comma/semicolon separated effect summaries are rendered as compact chips, limited to four points.
- Card view grid now flows left-to-right by rows instead of CSS column balancing, so new rows start left.

Validation:
- Frontend ESLint passed.
- Frontend TypeScript passed.
- Frontend Vitest passed with 6 tests.
- Frontend production build passed with the existing Vite chunk-size warning.
- `git diff --check` passed with CRLF warnings only.

Next:
- Deploy and smoke-check preview/live `/demo`.

## 2026-05-06 Product Card Info And Grid Order Deployed Update

Completed and deployed:
- ProductCard shows short Wirkung chips from existing effect summaries.
- Card view uses row-first responsive grid instead of CSS column balancing.
- Deployed preview `https://3f1bbcc8.supplementstack.pages.dev` and live `https://supplementstack.de` with assets `assets/index-BGkjPN9_.js` and `assets/index-428wN7Dg.css`.

Next:
- Manual visual QA on authenticated `/stacks` for card density and row ordering on desktop/mobile.
