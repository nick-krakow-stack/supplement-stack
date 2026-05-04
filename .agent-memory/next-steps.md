# Next Steps

Last updated: 2026-05-04

## Current Baseline

Phase C is complete. The integrated Phase D rollout is complete:

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

Product required package metadata hardening is committed in `52ead1f`
(`Data: Require complete product package metadata`). Remote D1 migration
`0037_backfill_product_required_metadata.sql` has been applied to
`supplementstack-production`; DB backfill data is live. The API/frontend
validation changes from `52ead1f` rode along with the Profile DSGVO deploy
on 2026-05-04 (preview `https://16edb9e2.supplementstack.pages.dev`,
build `index-Dkeio0yL.js` / `index-RAoQ0gyV.css`) — both code and data are
live.

D1 backup is done and is not a next step. Production-domain promotion is done and is not a next step.

## Open Cross-Agent TODOs (top of the queue)

Pick from this list first when you have an open slot. These are the highest-
signal items any agent — Claude, Codex, anyone — can pick up directly.

1. ⚠️ **Stack-warnings N+1 query**
   - File: `functions/api/modules/stacks.ts:159-166` (the only remaining ⚠️ in the Top-7).
   - Current: nested `for (a) for (b > a)` loop firing one DB query per ingredient pair → O(n²) round-trips on every warnings fetch.
   - Target: single SQL query against `interactions` using `IN (?,?,…)` for both `ingredient_a_id` and `ingredient_b_id`, returning all matching pairs at once.
   - Acceptance: same response shape as today (`{ warnings: InteractionRow[] }`), same auth/ownership behaviour (Auth + IDOR were already closed in `fcb1a6b`). Add a smoke check that a stack with N ingredients fires exactly one DB query.
   - Effort: M.

2. ❌ **Footer legal links (Impressum / Datenschutz / AGB)**
   - File: `frontend/src/components/Layout.tsx`.
   - Even stub pages with placeholder content help — they unblock the legal/compliance review which is currently the only thing gating SEO indexing.
   - Effort: XS for stubs, M for real legal copy.

3. ❌ **Demo session DoS vector**
   - File: `functions/api/modules/demo.ts:46-75`.
   - Currently no rate limit on demo session creation. Add per-IP KV throttle before launch traffic ramps up.
   - Effort: S.

The longer audit backlog is below in "Additional Open Items"; treat that as the secondary queue.

## Later Product-Model Follow-Up

- User-Produkte need a real ingredient mapping or must be handled separately
  in ingredient-specific product selection. Open question for the product
  track, not a launch blocker.

## Audit Top-7 Bugfix Sprint Status

Snapshot from the 2026-05-03 risk/UX audit (User-UX, Admin-UX, Risk forks).
Each item lists the issue, file:line where applicable, and current status.
Pick up the next ❌ item when continuing work.

1. ✅ **CORS + `FRONTEND_URL` for live domain** — closed in `283cbc8`. Reset-mail link now points to `supplementstack.de`; CORS allowlist accepts live, www, all `*.supplementstack.pages.dev` previews, and `localhost:5173`.
2. ✅ **RegisterPage `age`/`gender`/`guideline_source` data loss** — closed in `e832263`. Values flow through all layers; backend validates `age` 1-120, `gender` enum, `guideline_source` enum, empty strings → `NULL`.
3. ✅ **Admin Stats field-name mismatch** — already mitigated by Codex; `frontend/src/pages/AdminPage.tsx:1157-1158` accepts both key forms (`products_total`/`products` and `products_pending`/`pending_products`).
4. ⚠️ **`stack-warnings/:id` Auth + N+1** — Auth/IDOR closed in `fcb1a6b`. **N+1 still open**: `functions/api/modules/stacks.ts:159-166` uses an O(n²) double-loop firing one DB query per ingredient pair. Replace with a single `IN (...)` query joining the interactions table. M-effort.
5. ✅ **`ingredients/:id/products` moderation filter** — closed in `fcb1a6b` (`functions/api/modules/ingredients.ts:427`).
6. ✅ **`robots.txt` blocking indexing pre-launch** — closed in `1d8b288`. Note: Cloudflare auto-prepends a managed AI-bot block; if Cloudflare ever changes that prepend or if a new search-crawler user-agent emerges, revisit `frontend/public/robots.txt`.
7. ✅ **Profile self-service (DSGVO Art. 16 + 17)** — closed in `78d8925`. New endpoints `PATCH /api/me/password` and `DELETE /api/me` require re-auth via current password and are rate-limited. Account deletion hard-deletes via `db.batch([...])` for `stack_items`/`stacks`/`wishlist`/`user_products`/`consent_log`/`users` plus a best-effort cleanup loop for tables from later migrations. ProfilePage has two new sections; deletion requires typing `LÖSCHEN` plus password.

## Additional Open Items From The Audit (Beyond Top-7)

- ❌ **Footer legal links missing** — `frontend/src/components/Layout.tsx` has only generic disclaimer lines; Impressum, Datenschutz, AGB links are absent. Stub pages would already help. Blocks Legal/Compliance sign-off.
- ⚠️ **Pre-existing TS errors** — `frontend/src/api/admin.ts` and `frontend/src/api/base.ts` together have 3 latent TypeScript errors that don't block `npm run build` (Vite's esbuild) but show under `npx tsc --noEmit`. Not introduced by recent fixes.
- ⚠️ **Mobile-polish browser-QA outstanding** — `c76bcf4` was deployed; manual validation at 375px, 390px, and 430px in a real browser is still pending for demo, logged-in, and admin flows, including Search, StackWorkspace, product modal, dosage modal, My Products, and mobile nav.
- ❌ **Demo session DoS vector** — `functions/api/modules/demo.ts:46-75` allows unbounded session creation. Add per-IP rate limit (KV) before launch traffic ramps up.
- ❌ **No rate-limit on `POST /api/products`** — open from audit; review whether to add per-user/per-IP throttling.
- ❌ **`shop-domains/resolve` substring spoofing** — `functions/api/modules/admin.ts:879-885` matches by substring, can be spoofed. Switch to exact host match.
- ❌ **`stack_items.product_id` FK ambiguity** — `d1-migrations/0001_initial.sql:78-85` doesn't distinguish catalog `products` from `user_products`. Schema concern; needs a discriminator column or separate FKs. Requires migration — coordinate before touching.
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
- Run logged-in browser QA for stack, wishlist, own products, and admin flows.
  Code-level QA blockers are fixed and deployed; authenticated browser QA
  remains manual validation, not an implementation blocker.
- Targeted user/demo/admin usability fixes are committed and deployed in
  `8fb5431`. Preview/live smoke checks passed; browser-level QA remains open.
- Admin TranslationsTab draft preservation and pagination remain explicit follow-up
  work; they were intentionally not changed in the targeted admin usability pass.
- Run the primary logged-in user flows end to end: register/login, search ingredient, open product modal, add product to stack, edit/remove stack items, wishlist, profile, and user product management.
- Run the demo flows end to end without login, including ingredient search, product selection, add-to-stack, modal focus behavior, and empty/error states.
- Run authenticated admin UI smoke tests, especially product management, dose recommendations, translation editing for Ingredients/Dose Recommendations/Verified Profiles/Blog Posts, affiliate/user link distinction, and moderation states.
- Capture any additional UX polish findings from manual browser QA and decide
  whether they are launch blockers or later polish.
- Prioritize mobile ergonomics and obvious next actions for Kevin, Sabine, and Marco before expanding scope.
- Validate the deployed mobile-first polish in a browser or real device at
  375px, 390px, and 430px for demo, logged-in, and admin flows. Cover Search,
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
