# Next Steps

Last updated: 2026-05-05

## Current Baseline

## Health-Claims Audit Follow-Up

- Local cleanup is implemented in `0044_health_claim_content_audit.sql` plus focused frontend copy edits, but it is not committed, deployed, or remote-migrated yet.
- Before deployment: coordinate with the owner of `0043_email_verification.sql`; apply migrations in numeric order and keep `0044` after `0043`.
- Remaining content/data risk: this was a conservative wording pass, not a full legal sign-off or scientific dosing validation. A final German legal/compliance review and fachliche dose/source validation are still open before SEO indexing/public launch.
Phase C is complete. The integrated Phase D rollout is complete:

- Email verification is implemented locally but not committed, migrated remotely,
  or deployed. New owned migration is `d1-migrations/0043_email_verification.sql`;
  existing users are backfilled as verified, new registrations store only a
  SHA-256 token hash in `email_verification_tokens`, SMTP sends the raw token, `/verify-email` handles token
  verification, and authenticated resend is rate-limited. Normal login/app usage
  remains allowed for unverified accounts with visible nudges.
- Launch-readiness bundle is committed, deployed, and smoke-checked in
  `6a639cd` (`Feature: Close launch readiness gaps`). It includes stack/product
  calculation hardening, selected-dose product preview costs, basis-quantity and
  mass-unit handling, Admin dose-recommendation CRUD, Admin sub-ingredient
  mapping UI, Admin audit-log viewer, legal/consent preflight copy, context-near
  affiliate labels, strict frontend TypeScript cleanup, and 5 calculation
  tests. Preview/live run `assets/index-BlZlfAwp.js`. Validation passed:
  frontend `npx tsc --noEmit`, frontend lint/build/Vitest, functions
  TypeScript, and `git diff --check`. Smokes passed for root, unauth admin
  endpoints, and demo-product basis fields.

- Search/Wishlist dead-code cleanup is committed, deployed, and smoke-checked
  in `ee273a9` (`Cleanup: Remove unused search and wishlist flows`). Removed
  the un-routed Search/Wishlist pages, old
  Search-only modal components, frontend wishlist API helper, backend wishlist
  module mount/file, ProductCard wishlist props/action UI, unused wishlist/local
  modal-flow types, and active PrivacyPage Wishlist wording. DB
  tables/migrations and account-delete cleanup were intentionally left intact.
  Checks passed: frontend lint, build, Vitest no-test run, and functions
  TypeScript compile. Preview/live root return 200 with
  `assets/index-BIAACOZy.js`; preview/live `GET /api/wishlist` returns 404.

- Stack item intake intervals and stack product replacement are committed,
  remote-migrated where needed, deployed, and live-smoked in `6c22463`
  (`Feature: Add stack intake intervals`) and `f5dfa74` (`UX: Allow replacing
  stack products`). Remote D1 migration `0042_stack_item_intake_interval.sql`
  applied successfully. Final preview:
  `https://7abb76e8.supplementstack.pages.dev`; live:
  `https://supplementstack.de`. The bundle includes backend create/update/load
  support, stack email interval-aware package/monthly cost calculation, missing
  shop-link mail notice, `StackWorkspace` in-place product editing for
  dosage/timing/interval, stack detail/update ingredient rows per item,
  ProductCard parsed-dosage cost/range calculation, the amber icon-only edit
  pencil, and product replacement through `EditProductModal` -> `Produkt
  wechseln` -> `AddProductModal` replace mode for the same stack. Replacement
  preserves `dosage_text`, `timing`, and `intake_interval_days`, replaces
  instead of adding, and blocks duplicates in the same stack. Validation passed:
  functions TypeScript, frontend lint, frontend build, frontend Vitest no-test
  run, and `git diff --check` with CRLF warnings only. Smokes passed:
  preview/live root 200 with `assets/index-BZB9HYiO.js`, preview/live unauth
  stack email 401, remote pragma `has_col=1`, and live temp stack
  interval/ingredient API smoke with cleanup.

- All-Inkl SMTP mail sending is committed and deployed in `eff1c6a`
  (`Feature: Send stack emails via SMTP`). Preview:
  `https://76fde482.supplementstack.pages.dev`; live:
  `https://supplementstack.de`. Stack email sending now uses
  `POST /api/stacks/:id/email` for authenticated users, and forgot-password
  mail uses the same Worker SMTP helper. Non-secret SMTP config is in
  `wrangler.toml`; encrypted `SMTP_PASSWORD` is present in Cloudflare Pages
  production secrets. DNS MX/SPF checks passed; DMARC is still deferred until
  pre-launch. Live smoke tests passed for logged-in `Stack mailen` and
  forgot-password using temporary users that were deleted afterward.
- Stack email format/cost fix is committed and deployed in `9babeae`
  (`Fix: Calculate stack email costs from daily dose`). Preview:
  `https://c673fd9a.supplementstack.pages.dev`; live:
  `https://supplementstack.de`. The mail now includes product image, product,
  active ingredient daily amounts, daily intake amount, timing, interaction
  notes, package price, monthly cost based on daily dose, and buy buttons.
  D3 10,000 IE/day was live-smoked with product 23 and old-style
  `quantity=2000`; stack total returned 12.5 and email send returned ok.
- Logo/header branding is complete and deployed in `03ae0f9`
  (`Brand: Use uploaded logo in headers`). Preview:
  `https://47c4db46.supplementstack.pages.dev`; live:
  `https://supplementstack.de`. The normal header, Stacks/Demo standalone
  header, and Admin sidebar all use the shared `AppLogo` component and
  deployed `/logo.png`. Browser-harness rendering checks passed on root,
  `/demo`, and `/forgot-password`.
- Authenticated app-shell header alignment is complete and deployed in
  `ba92cd5` (`UX: Align authenticated headers with app shell`). Preview:
  `https://3c09e165.supplementstack.pages.dev`; live:
  `https://supplementstack.de`. `/stacks`, `/my-products`, and `/profile`
  were checked with browser-harness and now render the normal nav/header logo
  with no standalone `.site-header`.
- Product recommendations rename and temporary compatibility layer are deployed.
- Admin translations MVP and expansion are committed and deployed to Cloudflare Pages preview.
- D1 backup verification is complete: GitHub Actions backup has run manually and automatically, and token scopes are verified.
- Worktree cleanup is complete in `216e2df`: tracked research source files 01/02 are committed and local `.claude/commands/` files are ignored.
- `wrangler.toml` already contains `pages_build_output_dir = "frontend/dist"`.
- Production custom domain `supplementstack.de` is live in parallel to Cloudflare Pages preview URLs. All recent deploys have been published to both the subdomain and live domain. Public SEO indexing is intentionally deferred until legal/compliance is cleared.
- Targeted User/Demo/Search/Stack UX fixes plus Admin UX fixes are committed
  and deployed in `8fb5431` (`UX: Improve stack and admin usability flows`).
- Launch QA fixes for wishlist shop-domain response shape, stale frontend API
  helpers, ingredient product visibility/moderation filtering,
  product-recommendation duplicate prevention, stack-warning authorization, and
  user-product validation are committed and deployed in `fcb1a6b`
  (`Fix: Close launch QA flow blockers`).
- SearchPage/Wishlist werden als normale Fallback-/404-Routen behandelt; `raw`-Flags
  von SearchPage-Eingaben zählen nicht mehr zu den Launch-Blockern.
- Launch QA stack/profile fixes are committed, remote-migrated, deployed, and
  live-smoked in bundle commits `0b29fe0`, `baa91a5`, `1a3b8e6`, `cb76cf3`,
  and `24b10b5`. Remote D1 migration
  `0041_stack_item_product_sources.sql` applied successfully to
  `supplementstack-production`. Latest preview:
  `https://5fb3de86.supplementstack.pages.dev`; live
  `https://supplementstack.de` uses asset `index-BfFUmB15.js`. Final live
  smokes passed for profile `PUT /api/me`, invalid gender validation, own
  pending user-product stack add/load/warnings/delete, demo products count 7
  with D3 quantity 2,000 IU, root/forgot-password routes, and Search/Wishlist
  fallback/no-nav state. Checks passed: functions TypeScript, frontend lint,
  frontend build, frontend tests with no files earlier, and `git diff --check`.
  Local Wrangler migration apply is still blocked before 0041 by the existing
  local state failing migration 0009 on missing `google_id`; remote is fine.
- Mobile-first polish round 1 for 375px-430px is committed and deployed in
  `c76bcf4` (`UX: Improve mobile core flows`). Preview:
  `https://d5b331fd.supplementstack.pages.dev`; live domain returned HTTP 200
  with JS `assets/index-Bl-g6o41.js` and CSS `assets/index-Cf3yP80d.css`.
  Browser/device QA at 375px, 390px, and 430px is still open.
- Live-domain hardening: `FRONTEND_URL` switched to `https://supplementstack.de`,
  CORS allowlist now includes live domain + Pages preview hash subdomains,
  committed and deployed in `283cbc8`.
- Registration data-loss bug closed: `age`/`gender`/`guideline_source` are now
  persisted via `RegisterPage` → `AuthContext` → API → DB with backend
  validation, committed and deployed in `e832263`.
- Pre-launch indexing block: `frontend/public/robots.txt` disallows search
  crawlers by name (Googlebot, Bingbot, etc.) plus wildcard, committed and
  deployed in `1d8b288`. Cloudflare prepends a managed AI-bot block on the
  live domain; specific Disallows take precedence over Cloudflare's wildcard
  Allow.
- Profile self-service (DSGVO Art. 16 + 17) closed in `78d8925`: new
  `PATCH /api/me/password` and `DELETE /api/me` endpoints with re-auth and
  rate limits, plus matching ProfilePage sections with `LÖSCHEN` confirmation
  phrase. Account deletion is hard-delete in a batch transaction with
  best-effort cleanup for later-migration tables.
- Stack-warnings N+1 is closed in `5905a20`
  (`Fix: Batch stack warning interaction lookup`). `GET /api/stack-warnings/:id`
  now returns early with `{ warnings: [] }` for 0/1 ingredient id and otherwise
  loads matching `interactions` rows with a single SQL query using dynamic
  `IN (...)` placeholders for both ingredient columns. Auth, ownership, 404,
  and 403 semantics are unchanged. Preview:
  `https://1c23aea8.supplementstack.pages.dev`; preview root and unauth
  stack-warnings smoke checks passed, and live unauth stack-warnings returned
  HTTP 401.
- GA4 consent implementation is closed in `a18136d`
  (`Feature: Add consent-based GA4 analytics`) and deployed to
  `https://f876ad10.supplementstack.pages.dev`. Measurement ID:
  `G-QVHTTK2CNP`. GA4 is not statically loaded in `index.html`; `gtag.js` is
  injected only after Zustimmung, Ablehnung is persisted, SPA pageviews run only
  after consent, and the footer exposes `Datenschutz` plus
  `Cookie-Einstellungen`. Preview `/` and `/datenschutz` returned HTTP 200;
  live `https://supplementstack.de/datenschutz` returned HTTP 200 with
  `/assets/index-B7aLcsIq.js`. Local checks passed: `npm run build` in
  `frontend/` and `git diff --check` with only LF/CRLF warnings.
- Legal pages are closed in `9c2c627`
  (`Legal: Add imprint privacy and terms pages`) and deployed to
  `https://d6e92688.supplementstack.pages.dev`. Routes:
  `/impressum`, `/datenschutz`, `/nutzungsbedingungen`, and `/agb` alias.
  Footer links all legal pages plus `Cookie-Einstellungen`. Google Fonts import
  removed; system fonts only. Privacy covers GA4 consent, Cloudflare,
  GitHub/GitHub Actions, Google Analytics, and third-country processing. No
  Apple/OAuth/Social-Login processing is described as active. Research bases:
  §5 DDG, §25 TDDDG, Art. 13/6 DSGVO, §36 VSBG, §18 MStV, EU ODR shutdown
  2025-07-20, and Google GA4 EU privacy/IP. Checks passed: frontend build and
  `git diff --check` with only LF/CRLF warnings. Preview legal routes and live
  legal routes returned HTTP 200 with asset `index-DtdVqjYU.js`.

Product required package metadata hardening is committed in `52ead1f`
(`Data: Require complete product package metadata`). Remote D1 migration
`0037_backfill_product_required_metadata.sql` has been applied to
`supplementstack-production`; DB backfill data is live. The API/frontend
validation changes from `52ead1f` rode along with the Profile DSGVO deploy
on 2026-05-04 (preview `https://16edb9e2.supplementstack.pages.dev`,
build `index-Dkeio0yL.js` / `index-RAoQ0gyV.css`) — both code and data are
live.

D1 backup is done and is not a next step. Production-domain promotion is done and is not a next step.

Demo session DoS hardening is closed in `18a4141` and deployed to
`https://5b9c9907.supplementstack.pages.dev` plus the live custom domain:
`POST /api/demo/sessions` is KV rate-limited per IP, no longer persists
submitted `stack_json`, legacy GET returns an empty stack for existing unexpired
keys, and Demo UI state remains page-local.

User product moderation and shop-domain hardening is implemented and deployed
in `18a4141`: trusted submitter flag migration, default pending
user-products with trusted auto-approval, approved-product user edit/delete
locks, admin trusted toggles, product creation rate limits, and parsed
hostname-based shop-domain matching.

Product-model follow-up is closed in `1272e11`
(`Feature: Add product ingredient publishing model`) and deployed:

- Remote D1 migration `0039_product_ingredient_model.sql` applied successfully
  to `supplementstack-production`.
- Remote control query confirmed:
  `product_ingredients.search_relevant` column = 1,
  `user_product_ingredients` table = 1,
  `ingredient_sub_ingredients` table = 1, and
  `user_products.published_product_id` column = 1.
- User-product APIs accept optional ingredient rows and return them.
- Admin has idempotent `PUT /api/admin/user-products/:id/publish` to convert a
  user product to approved/public catalog `products` plus
  `product_ingredients`.
- Public ingredient product lists, product recommendations, stack-warning
  interaction lookup, stacks, and wishlist now use approved/public catalog
  products and search-relevant ingredient rows where applicable.
- Trusted submitters create approved/private user-products but are not
  auto-published. Public catalog visibility requires admin publish after
  checking search-relevant ingredient rows.
- Preview URL: `https://0ed675d5.supplementstack.pages.dev`.
- Build assets: JS `index-BvEYaSZm.js`, CSS `index-BxLAbVeG.css`.
- Smoke checks passed on preview/live for root assets, demo products count 7,
  D3 products count 3, D3 recommendations count 4, and unauth product/admin
  product endpoints returning 401.

## Latest Closed Backend Work

Sub-ingredient product workflow is closed in `29dcde5`
(`Feature: Add sub-ingredient product workflow`) and deployed:

- Remote D1 migration `0040_seed_ingredient_sub_ingredients.sql` applied
  successfully to `supplementstack-production`.
- Migration control confirmed `ingredient_sub_ingredients` count = 6:
  L-Carnitin children ALCAR/Tartrat/Fumarat and Omega-3 children EPA/DHA/DPA.
- Migration control confirmed `products.source_user_product_id` exists
  (`source_col=1`).
- Public/admin backend APIs, parent/sub validation, parent/child-aware product
  lookup, stack-warning dedupe, publish race guard, and 50-row save limits are
  live.
- Preview: `https://421f79ea.supplementstack.pages.dev`; live:
  `https://supplementstack.de`.
- Smoke checks passed on live and preview for sub-ingredient endpoints, Omega-3
  products, demo products count 7, and unauthenticated admin 401.
- Demo mode note: current `StackWorkspace` demo flow creates fresh client-side
  demo state on load and does not persist stack edits via `/api/stacks`; demo
  products come from `/api/demo/products`.

## Open Cross-Agent TODOs (top of the queue)

Pick from this list first when you have an open slot. These are the highest-
signal items any agent — Claude, Codex, anyone — can pick up directly.

1. ⚠️ **Final legal/compliance review**
   - Impressum, Datenschutz, Nutzungsbedingungen, health disclaimer, and
     affiliate disclosure now have frontend surfaces but still need final
     German legal review before SEO indexing/public launch.
   - Also formally check DSB need/status, AVV/DPA setup, and Cloudflare,
     GitHub, Google Analytics property/settings before indexing.
   - Effort: Legal review dependent.

2. [x] **Set and verify SMTP password secret**
   - Cloudflare Pages production secret `SMTP_PASSWORD` exists.
   - The Pages bundle was redeployed after the secret was set.
   - Live smokes passed for logged-in `Stack mailen` and forgot-password using
     temporary users that were deleted afterward.

3. ❌ **Admin UI for sub-ingredient mappings**
   - Backend APIs exist and migration 0040 seeded launch mappings, but there is
     no dedicated admin UI yet for creating/removing parent/child prompt
     mappings.
   - Needed for non-technical management of L-Carnitin forms, Omega-3
     EPA/DHA/DPA, and future mappings.
   - Effort: M.

4. ❌ **Manual product-submission browser QA**
   - Run product submission and moderation/publish flows on desktop and mobile,
     including sub-ingredient prompts, parent/sub validation errors, and 50-row
     ingredient limit behavior.
   - Effort: S/M.

5. ❌ **Affiliate/domain final policy review**
   - Review affiliate disclosure, shop-domain matching assumptions, and final
     domain/policy wording before Go-Live.
   - Effort: S.

The longer audit backlog is below in "Additional Open Items"; treat that as the secondary queue.

## Later Product-Model Follow-Up

- User-product ingredient mapping and catalog conversion are deployed in
  `1272e11`.
- Sub-ingredient backend/schema work is deployed in `29dcde5`.
- Remaining product-model work: dedicated admin UI for managing
  `ingredient_sub_ingredients`, manual product-submission QA on desktop/mobile,
  and final affiliate/domain policy review.

## Audit Top-7 Bugfix Sprint Status

Snapshot from the 2026-05-03 risk/UX audit (User-UX, Admin-UX, Risk forks).
Each item lists the issue, file:line where applicable, and current status.
Pick up the next ❌ item when continuing work.

1. ✅ **CORS + `FRONTEND_URL` for live domain** — closed in `283cbc8`. Reset-mail link now points to `supplementstack.de`; CORS allowlist accepts live, www, all `*.supplementstack.pages.dev` previews, and `localhost:5173`.
2. ✅ **RegisterPage `age`/`gender`/`guideline_source` data loss** — closed in `e832263`. Values flow through all layers; backend validates `age` 1-120, `gender` enum, `guideline_source` enum, empty strings → `NULL`.
3. ✅ **Admin Stats field-name mismatch** — already mitigated by Codex; `frontend/src/pages/AdminPage.tsx:1157-1158` accepts both key forms (`products_total`/`products` and `products_pending`/`pending_products`).
4. ✅ **`stack-warnings/:id` Auth + N+1** — Auth/IDOR closed in `fcb1a6b`; N+1 closed in `5905a20`. `GET /api/stack-warnings/:id` now batches interaction lookup into one SQL query with dynamic `IN (...)` placeholders for both ingredient columns, returns `{ warnings: [] }` immediately for 0/1 ingredient id, and preserves auth/ownership/404/403 semantics.
5. ✅ **`ingredients/:id/products` moderation filter** — closed in `fcb1a6b` (`functions/api/modules/ingredients.ts:427`).
6. ✅ **`robots.txt` blocking indexing pre-launch** — closed in `1d8b288`. Note: Cloudflare auto-prepends a managed AI-bot block; if Cloudflare ever changes that prepend or if a new search-crawler user-agent emerges, revisit `frontend/public/robots.txt`.
7. ✅ **Profile self-service (DSGVO Art. 16 + 17)** — closed in `78d8925`. New endpoints `PATCH /api/me/password` and `DELETE /api/me` require re-auth via current password and are rate-limited. Account deletion hard-deletes via `db.batch([...])` for `stack_items`/`stacks`/`wishlist`/`user_products`/`consent_log`/`users` plus a best-effort cleanup loop for tables from later migrations. ProfilePage has two new sections; deletion requires typing `LÖSCHEN` plus password.

## Additional Open Items From The Audit (Beyond Top-7)

- Demo session DoS vector is fixed and deployed in `18a4141`. The older
  open bullet below is superseded by the deployed changes in
  `functions/api/modules/demo.ts` and `frontend/src/components/StackWorkspace.tsx`.

- ✅ **Footer legal links/pages present and deployed** — Impressum, Datenschutz, Nutzungsbedingungen, and `/agb` alias are implemented and deployed in `9c2c627`. Final legal/compliance sign-off still blocks SEO indexing/public launch.
- ⚠️ **Pre-existing TS errors** — `frontend/src/api/admin.ts` and `frontend/src/api/base.ts` together have 3 latent TypeScript errors that don't block `npm run build` (Vite's esbuild) but show under `npx tsc --noEmit`. Not introduced by recent fixes.
- ⚠️ **Mobile-polish browser-QA outstanding** — `c76bcf4` was deployed; manual validation at 375px, 390px, and 430px in a real browser is still pending for demo, logged-in, and admin flows, including Search, StackWorkspace, product modal, dosage modal, My Products, and mobile nav.
- ✅ **Demo session DoS vector** — fixed and deployed in `18a4141`: `POST /api/demo/sessions` now uses KV per-IP rate limiting and no longer persists submitted `stack_json`; legacy GET returns an empty stack instead of stored user changes.
- ✅ **No rate-limit on `POST /api/products`** — fixed and deployed in `18a4141`: creation is now KV rate-limited per authenticated user.
- ✅ **`shop-domains/resolve` substring spoofing** — fixed and deployed in `18a4141`: resolve and ProductCard matching parse hostnames and allow only exact domain or subdomain matches.
- ✅ **`stack_items.product_id` FK ambiguity** — closed, committed,
  remote-migrated, deployed, and live-smoked by
  `d1-migrations/0041_stack_item_product_sources.sql`, which rebuilds
  `stack_items` with explicit `catalog_product_id` and `user_product_id`.
  Own pending user-product stack add/load/warnings/delete was verified live.
- ❌ **Migration 0036 missing UPDATE trigger** — `d1-migrations/0036_rename_recommendations_to_product_recommendations.sql:27-41` has compatibility view + INSERT/DELETE triggers but no UPDATE trigger. Compatibility window is temporary; the deferred cleanup migration in "Deferred / Later" will drop the view entirely, so this may be moot.
- ❌ **No email verification on register** — open question whether this is launch-blocking. Currently anyone can register with any address.
- ❌ **`window.alert` usage in admin** — replace with toast/dialog component for consistent UX.
- ❌ **Admin `dose_recommendations` CRUD missing** — admin can edit translations but not the underlying `dose_recommendations` rows. Read-only currently.
- ❌ **Admin audit-log viewer missing** — `admin_audit_log` is written to but has no UI surface.
- ❌ **Admin TranslationsTab draft preservation + pagination** — explicit follow-up flagged in earlier UX pass; not done.

## Go-Live / Production Readiness

Priority 1 - Manual authenticated browser QA:

- Once the rate-limit window clears, run one fresh browser/API registration
  smoke. A registration was tested successfully before deploy, but the final
  post-deploy fresh-register smoke hit HTTP 429 after repeated QA attempts.
- Run logged-in browser QA for stack, own products, profile, and admin flows.
  Code-level QA blockers are fixed and deployed; authenticated browser QA
  remains manual validation, not an implementation blocker.
- Targeted user/demo/admin usability fixes are committed and deployed in
  `8fb5431`. Preview/live smoke checks passed; browser-level QA remains open.
- Admin TranslationsTab draft preservation and pagination remain explicit follow-up
  work; they were intentionally not changed in the targeted admin usability pass.
- Run the primary logged-in user flows end to end: register/login, add products to stack, edit/remove stack items, profile, and user product management.
- Run the demo flows end to end without login, including ingredient search, product selection, add-to-stack, modal focus behavior, and empty/error states.
- Run authenticated admin UI smoke tests, especially product management, dose recommendations, translation editing for Ingredients/Dose Recommendations/Verified Profiles/Blog Posts, affiliate/user link distinction, and moderation states.
- Capture any additional UX polish findings from manual browser QA and decide
  whether they are launch blockers or later polish.
- Prioritize mobile ergonomics and obvious next actions for Kevin, Sabine, and Marco before expanding scope.
- Validate the deployed mobile-first polish in a browser or real device at
  375px, 390px, and 430px for demo, logged-in, and admin flows. Cover
  StackWorkspace, product modal, dosage modal, My Products, mobile nav, and
  admin touch/layout behavior.

Priority 2 - Legal and compliance final review (blocker for SEO indexing/public launch, not for live-domain availability):

- Review Impressum, Datenschutz, cookie handling/banner needs, health disclaimer, and affiliate disclosure.
- Confirm German health-claim wording and affiliate labeling before public launch.
- Do not start SEO indexing until legal/compliance is cleared.

Priority 3 - Content, data, and guideline QA:

- Validate D3 and additional ingredient pages against source data and visible UI copy.
- Check product data, product recommendations, affiliate/user link distinction, and dosage recommendation display.
- Verify default German recommendation sources and wording against DGE/D-A-CH, EFSA/BfR, and cited study data where applicable.

Priority 4 - I18n / localization architecture track:

- Launch remains DE-only, but public/i18n translation capability must be planned and built as a real product track, not treated as fully deferred.
- Architecture must support locale plus country/guideline-set selection, not only text translation.
- Use German/DGE/D-A-CH as the default guideline set for DE, while allowing other countries to configure different sources and rules, e.g. USA should not inherit DGE/D-A-CH by default.
- Admin translation management already exists for several entities; public playback, locale routing, country-specific recommendations, and guideline-set metadata still need design and implementation.

Priority 5 - Test coverage baseline:

- Vitest currently passes with `--passWithNoTests`.
- Add targeted API and UI smoke/unit tests for the launch-critical paths instead of relying only on empty-suite success.
- Suggested first coverage: API base behavior, D3 search, dose recommendations response shape, product modal recommendation loading, admin translations route auth/validation.

Priority 6 - SEO and indexing readiness (gated by legal/compliance):

- Prepare robots, sitemap, page metadata, canonical URLs, and OpenGraph/Twitter preview metadata.
- Enable indexing only after legal/compliance approval and final production-domain content checks.

Priority 7 - Auth/OAuth track (later, not a launch blocker):

- Google OAuth is accepted as a later standalone task, not part of the current polish/QA pass.
- Apple Login is intentionally omitted for now.
- Amazon Login can be evaluated later as an optional provider, but must not block launch.
- Current priority remains User/Demo/Admin browser QA plus persistence/onboarding polish before OAuth implementation.
- Health Consent remains mandatory even with OAuth. OAuth replaces only password login, not consent, profile, recommendation, or guideline logic.
- Existing backend has Google OAuth stubs and the database already has `google_id`, but real provider identity modeling, OAuth callback handling, and user-linking/account-merge behavior are still open design work.

## Deferred / Later

- Compatibility cleanup migration: drop the temporary `recommendations` compatibility view and triggers after old previews/deploy windows are irrelevant.

## Completed Reference

- Production domain:
  - `cebd31a` - Memory: Production domain live, reorganize next-steps (superseded by current usability-first priority order and i18n planning constraint).
- Phase C:
  - `b1fd347` - Hono module split.
  - `dd58ba2` - Public dose recommendations API.
  - `4482a5f` - Admin audit logging.
  - `11440f5` - Server-side unit conversion.
  - `b866c3d` - Phase C tech-debt cleanup and `pages_build_output_dir`.
- Phase D:
  - `862ed57` - Product recommendations rename, admin translations MVP, Cloudflare-line docs/CI.
  - `49ed83e` - Admin translations expansion.
  - `f3fa88c` - Memory: Record admin translations expansion deploy.
  - `216e2df` - Ops: Track research sources and ignore local Claude commands.
- UX polish:
  - `8fb5431` - UX: Improve stack and admin usability flows.
  - `e8f2bbc` - UX: Auto-focus name field when opening 'Produkt hinzufuegen' modal.
  - `078fc31` - UX: Auto-focus search field in 'Produkt hinzufuegen' modal (Demo + Stack-Workspace).

## 2026-05-05 Update

Closed in the latest deployed bundle:
- Email verification on registration and resend/verify flow.
- Health-claims/content wording cleanup.
- Remote D1 migrations 0043/0044.
- Live deploy to `supplementstack` Pages project and smoke checks.

Still open:
- Set/verify DMARC and DKIM with the mail provider/DNS.
- Product data and dosage data scientific validation: check which recommendations, dose ranges, sources, and visible wording are correct and how they should be corrected.
- Final legal/compliance sign-off before SEO indexing.

## 2026-05-05 Product Safety Warnings Follow-Up

- Apply remote D1 migration `0046_knowledge_warnings.sql` after the owner of migration 0045 completes their work and migration order is clear.
- Deploy the safety-warning bundle and smoke-check `/api/knowledge/beta-carotin-raucher-lungenkrebs`, `/wissen/beta-carotin-raucher-lungenkrebs`, `/api/demo/products`, and a Beta-Carotin product card.
- Add follow-up UX/browser QA for the ProductCard warning popover on desktop hover, keyboard focus, and mobile tap.
- Consider a later admin UI for managing `knowledge_articles` and `ingredient_safety_warnings`; the first version is seeded by migration only.
- Full frontend lint still needs unrelated `PrivacyPage.tsx` unescaped quote cleanup.

## 2026-05-05 Data Minimization Follow-Up

- Apply remote D1 migration `0045_data_minimization_profile_fields.sql` before any later migration such as `0046_knowledge_warnings.sql`.
- Deploy and smoke-check registration, `/api/auth/login`, `/api/me`, and `PUT /api/me` to confirm responses no longer include gender, weight, diet, goals, or `is_smoker`.
- Note for migration review: `users.is_smoker` is `NOT NULL` in the existing schema, so 0045 resets it to `0` instead of nulling it. A future table rebuild can make it nullable if strict null retention is required.
- Full frontend lint now passes after the PrivacyPage quote cleanup that also unblocked the product-safety-warning lint note.

## 2026-05-05 Data Minimization And Warnings Update

Closed in the latest deployed bundle:
- Account/profile data minimization.
- Remote D1 migrations 0045/0046.
- Product safety-warning model plus first Beta-Carotin knowledge article.
- Form-specific Beta-Carotin warning matching under Vitamin A.
- Live deploy to `supplementstack` Pages project and smoke checks.

Still open:
- UX/browser QA for the warning popover on hover, keyboard focus, and mobile tap during the next manual browser QA pass.
- Admin UI for maintaining `knowledge_articles` and `ingredient_safety_warnings` later; first version is migration-seeded only.
- Product data and dosage data scientific validation remains a separate content workstream.
- DMARC/DKIM and final legal/compliance sign-off remain pre-indexing tasks.

## 2026-05-05 Purchase-Link Follow-Up

- Later follow-up: if a product ever has no purchase link, product cards/stack surfaces should offer a simple report action so the missing or broken link can be corrected. Current production product data is expected to have purchase links; this is a resilience/maintenance flow, not a blocker for the deployed warning/data-minimization bundle.

## 2026-05-05 Ingredient Research Admin Cockpit Update

Closed in the latest deployed bundle:
- Admin `Wirkstoff-Recherche` tab for category-grouped ingredient research management.
- Remote D1 migration 0047 for `ingredient_research_status` and `ingredient_research_sources`.
- Admin CRUD routes for research status, official/study source rows, and ingredient safety warnings.

Still open:
- Authenticated browser QA of the new admin tab on desktop and mobile, including creating/editing/deleting one test source row and one test warning row.
- Admin UI for full `knowledge_articles` article/body editing is still not built; the cockpit links warnings to existing article slugs.
- Product data and dosage data scientific validation can now use the new cockpit as the working surface, but content still needs to be entered/reviewed ingredient by ingredient.

## 2026-05-05 Admin Usability Backend Follow-Up

Closed locally:
- Backend endpoints for knowledge article editing, ops dashboard counts, product QA listing, and ingredient research JSON export are implemented in `functions/api/modules/admin.ts`.
- No D1 migration is required for this backend bundle.

Next:
- Review or continue the concurrent frontend admin UI work against these response shapes.
- Run authenticated admin browser/API QA for the new endpoints after frontend integration.
- Commit/deploy only after coordinating with the concurrent frontend admin files currently present in the worktree.

## 2026-05-05 Admin Usability Frontend Follow-Up

Closed locally:
- Frontend admin UI for the new backend usability routes is implemented: Admin-Uebersicht ops cards, Wissen article CRUD/archive editor, and Produkt-QA listing/filtering.
- Typed frontend API helpers exist for `/api/admin/knowledge-articles`, `/api/admin/ops-dashboard`, `/api/admin/product-qa`, and optional `/api/admin/ingredient-research/export`.

Next:
- Coordinate commit/deploy with the concurrent backend admin route changes in `functions/api/modules/admin.ts`.
- Run authenticated admin browser QA on desktop and mobile for `Admin-Uebersicht`, `Wissen`, and `Produkt-QA`, including creating/saving/archiving a test knowledge article and checking product QA filters.
- If the export route is absent in an environment, the frontend button should show the unavailable state and not block the tab.
## 2026-05-05 Admin Ops And Knowledge Tools Follow-Up

Closed in the latest deployed bundle:
- Admin `Admin-Uebersicht` with operational counts and ingredient research JSON export.
- Admin `Wissen` editor for knowledge article create/edit/archive flows.
- Admin `Produkt-QA` for missing/suspicious product data review.
- Backend routes for knowledge article CRUD/archive, ops dashboard, product QA, and research export.

Still open:
- Authenticated browser QA of `Admin-Uebersicht`, `Wissen`, and `Produkt-QA` on desktop and mobile, including creating/editing/archiving one harmless test knowledge article.
- Product data and dosage data scientific validation remains a content workstream; the admin tools now provide the maintenance surface.
- Later enhancement: promotion/review workflow that copies vetted research rows into live `dose_recommendations` only after explicit review.

## 2026-05-05 Admin Arbeitsplatz V1 Follow-Up

Closed locally:
- Admin overview now includes actionable top work queues, not only count cards.
- Product-QA now supports inline editing for the high-impact package/link fields and persists through a new admin-only audited backend route.
- Knowledge article publish guardrail is enforced in backend and frontend.

Next:
- Run authenticated admin browser QA on desktop and mobile for `Admin-Uebersicht`, `Produkt-QA`, `Wissen`, and `Wirkstoff-Recherche` queue links.
- In Product-QA, test saving one harmless product change and confirm audit-log entry `update_product_qa_fields` appears.
- In Wissen, verify a draft without sources cannot be published and a sourced article can be saved as published.

## 2026-05-05 User-Rundung V1 Follow-Up

Closed locally:
- Stack cockpit/check panel, grouped routine plan, missing-link report affordance, dosage-preservation confirmation on replacement, and minimal family profile assignment are implemented.
- Migration 0048 is ready but not applied remotely.

Next:
- Review migration 0048 before remote apply because it adds new user-side tables and a nullable column on `stacks`.
- Run browser QA for StackWorkspace on desktop and 375px mobile: cockpit wrapping, family selector/create/remove, routine grouping, replacement confirmation, `Link melden`, and authenticated stack warning display.
- Decide whether family profile editing beyond create/remove is needed later; current MVP intentionally avoids sensitive health data and keeps only first name, age, optional weight.

## 2026-05-05 Round Experience V1 Follow-Up

Closed in the latest deployed bundle:
- User stack cockpit/check, simple Einnahmeplan, product replacement confirmation, missing-link reporting, and family profile MVP.
- Admin operational queues, inline Product-QA fixes, and knowledge article publish guardrails.
- Remote D1 migration 0048 and Cloudflare Pages deploy.

Still open:
- Authenticated browser QA on desktop and mobile for family profile create/delete, stack assignment, link reporting, Product-QA inline save, and knowledge article publish validation.
- Product/dosage scientific validation remains a content workflow; the admin surfaces now make it easier to work through.
- Later: deeper family-specific dosage logic, review assignments, QA pagination/deep links, routine export/print, and promotion workflow from research rows into live dose recommendations.

## 2026-05-05 Launch Checks And Print Follow-Up

Closed in the latest deployed bundle:
- Admin `Linkmeldungen` queue for reported missing/broken product purchase links.
- Admin `Go-Live Checks` tab for Mail/DNS, trust/legal visibility, monitoring, and backup checklist.
- Stack `Plan drucken/PDF` print routine using browser print/save-as-PDF.
- Live deploy on `supplementstack.de` with asset `assets/index-BmvNNsmY.js`.

Still open before launch:
- Set DNS manually: add DMARC TXT for `_dmarc.supplementstack.de` and enable/confirm DKIM through the mail provider.
- After DNS propagation, send real registration, verification, password reset, and stack emails to external inboxes and check spam placement.
- Run authenticated admin browser QA for `Linkmeldungen`, `Go-Live Checks`, and the print/PDF routine on desktop and mobile.
- Next requested engineering task: Google OAuth before launch.

## 2026-05-05 DMARC Follow-Up

Closed:
- DMARC TXT for `_dmarc.supplementstack.de` is set and publicly resolving.
- Admin Go-Live checklist reflects DMARC as OK.

Still open before launch:
- DKIM provider setup/verification.
- External inbox mail tests for registration, verification, password reset, and stack mail.
- Later DMARC hardening from `p=none` to `p=quarantine`/`p=reject` after mail alignment is confirmed.

## 2026-05-05 DKIM Follow-Up

Closed:
- DKIM TXT for `kas202508251337._domainkey.supplementstack.de` is set and publicly resolving.
- Admin Go-Live checklist reflects DKIM as OK.

Still open before launch:
- External inbox mail tests for registration, verification, password reset, and stack mail.
- Verify outbound headers include `DKIM-Signature: ... d=supplementstack.de; s=kas202508251337`.
- Later DMARC hardening after mail alignment is confirmed.
