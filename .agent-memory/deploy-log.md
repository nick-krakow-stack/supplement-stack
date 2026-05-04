# Deploy Log

Last updated: 2026-05-05

## Latest Known Production State

Phase B database migrations 0026-0035 are live in production D1.
Phase C backend refactor + new dose recommendations API are deployed to Cloudflare Pages.
Demo product loading fix is deployed to Cloudflare Pages preview.
D3 recommendations / product modal data loading fix is deployed to Cloudflare Pages preview.
Preview search API-base fix is deployed to Cloudflare Pages preview.
Affiliate disclosure cleanup is deployed to Cloudflare Pages preview.
Phase D product recommendations rename and admin translations MVP are committed,
remote-migrated, and deployed to Cloudflare Pages preview.
Admin translations expansion is committed and deployed to Cloudflare Pages
preview.
Production custom domain `supplementstack.de` is live and has received the same
recent deploys as the Cloudflare Pages subdomain. Public SEO indexing remains
intentionally disabled/gated.
UX add-product modal focus polish is committed and deployed to Cloudflare Pages.
Targeted User/Demo/Search/Stack UX fixes plus Admin UX fixes are committed and
deployed to Cloudflare Pages preview and live custom domain.
Launch QA flow blockers are committed and deployed to Cloudflare Pages preview
and live custom domain.
Stack-warnings batched interaction lookup is committed and deployed to
Cloudflare Pages preview and live custom domain.
Consent-based GA4 analytics is committed and deployed to Cloudflare Pages
preview and live custom domain.
Legal pages are committed and deployed to Cloudflare Pages preview and live
custom domain.
Demo/session abuse hardening, product creation rate limits, trusted
user-product submitters, and shop-domain host matching are committed,
remote-migrated, and deployed to Cloudflare Pages preview and live custom
domain.
Product ingredient publishing model is committed, remote-migrated, and
deployed to Cloudflare Pages preview and live custom domain.
Sub-ingredient product workflow is committed, remote-migrated, and deployed to
Cloudflare Pages preview and live custom domain.
GitHub Actions D1 backup has run successfully both manually and automatically;
token scopes are verified.

Latest relevant commits:

- `29dcde5` - Feature: Add sub-ingredient product workflow.
- `1272e11` - Feature: Add product ingredient publishing model.
- `18a4141` - Security: Harden demo and user product moderation.
- `9c2c627` - Legal: Add imprint privacy and terms pages.
- `a18136d` - Feature: Add consent-based GA4 analytics.
- `5905a20` - Fix: Batch stack warning interaction lookup.
- `fcb1a6b` - Fix: Close launch QA flow blockers.
- `8fb5431` - UX: Improve stack and admin usability flows.
- `078fc31` - UX: Auto-focus search field in 'Produkt hinzufuegen' modal (Demo + Stack-Workspace).
- `e8f2bbc` - UX: Auto-focus name field when opening 'Produkt hinzufuegen' modal.
- `cebd31a` - Memory: Production domain live, reorganize next-steps.
- `49ed83e` - Feature: Expand admin translation management.
- `862ed57` - Feature: Phase D product recommendations and translations.
- `965d4e4` - Fix: Move affiliate disclosure to footer.
- `b5dba6e` - Fix: Use same-origin API in deployed frontend.
- `2f4248b` - Fix: Restore demo product loading.
- `9107e2e` - Fix: Stabilize dosage and product modal data loading.
- `dd58ba2` - Feature: Add dose recommendations API.
- `b1fd347` - Refactor: Split Pages API into Hono modules.
- `9a5f523` - DB: Phase B complete (migrations 0028-0035).

## Product Ingredient Publishing Model

### 2026-05-05 - D1 + Cloudflare Pages: sub-ingredient product workflow

- Commit: `29dcde5` - Feature: Add sub-ingredient product workflow.
- Remote D1 migration:
  - Applied `d1-migrations/0040_seed_ingredient_sub_ingredients.sql` to
    `supplementstack-production`.
  - Control query confirmed `ingredient_sub_ingredients` count = 6.
  - Control query confirmed mappings:
    `L-Carnitin` -> `Acetyl-L-Carnitin`, `L-Carnitin Tartrat`,
    `L-Carnitin Fumarat`; `Omega-3` -> `EPA`, `DHA`, `DPA`.
  - Control query confirmed `products.source_user_product_id` exists
    (`source_col=1`).
- Scope:
  - Seeded launch mappings for L-Carnitin and Omega-3 sub-ingredients.
  - Public sub-ingredient prompt endpoint is live.
  - Admin sub-ingredient mapping API is live with validation and audit logging.
  - Product and user-product saves validate parent/sub relations before storage
    and cap ingredient arrays at 50 rows.
  - Ingredient product lookup and recommendations are parent/child-aware.
  - Stack warnings dedupe parent/child rows per product.
  - Admin publish uses `products.source_user_product_id` as a unique source
    guard for idempotent publish races.
- Local validation:
  - `npx tsc -p tsconfig.json` in `functions/` passed.
  - `npm run lint --if-present` in `frontend/` passed.
  - `npm run test --if-present -- --run` in `frontend/` passed with no test
    files via passWithNoTests.
  - `npm run build` in `frontend/` passed.
  - `git diff --check` passed.
  - Mojibake scan for touched frontend/backend files passed.
- Preview URL: `https://421f79ea.supplementstack.pages.dev`.
- Live URL: `https://supplementstack.de`.
- Smoke checks on live and preview:
  - `/api/ingredients/10/sub-ingredients` returned HTTP 200 with count 3:
    EPA/DHA/DPA.
  - `/api/ingredients/13/sub-ingredients` returned HTTP 200 with count 3:
    ALCAR/Tartrat/Fumarat.
  - `/api/ingredients/10/products` returned HTTP 200 with count 1 on live.
  - `/api/demo/products` returned HTTP 200 with count 7.
  - `/api/admin/user-products` unauthenticated returned HTTP 401.
- Demo mode note:
  - Current `StackWorkspace` demo flow creates fresh client-side demo state on
    load and does not persist stack edits via `/api/stacks`; demo products come
    from `/api/demo/products`.
- Remaining launch follow-up:
  - Dedicated admin UI for managing sub-ingredient mappings.
  - Legal/compliance wording review before Go-Live.
  - Manual browser QA of product submission flow on desktop/mobile.
  - Affiliate/domain final policy review.

### 2026-05-04 - D1 + Cloudflare Pages: product ingredient publishing model

- Commit: `1272e11` - Feature: Add product ingredient publishing model.
- Remote D1 migration:
  - Applied `d1-migrations/0039_product_ingredient_model.sql` to
    `supplementstack-production`.
  - Control query confirmed `product_ingredients.search_relevant` column = 1,
    `user_product_ingredients` table = 1,
    `ingredient_sub_ingredients` table = 1, and
    `user_products.published_product_id` column = 1.
- Scope:
  - Catalog `product_ingredients` now has search-relevant and basis metadata
    for ingredient-specific public product filtering.
  - `user_product_ingredients` stores durable ingredient rows for user
    products.
  - `ingredient_sub_ingredients` is schema-ready for later prompted
    sub-ingredient entry.
  - `user_products.published_product_id` links approved/private user products
    to published catalog products after admin publish.
  - Admin publish copies checked user products into public approved
    `products` and `product_ingredients`.
  - Trusted submitters create `user_products` as approved/private moderation
    state but are not auto-published into the catalog.
- Local validation before commit/deploy:
  - `npx tsc -p tsconfig.json` in `functions/` passed.
  - `npm run lint --if-present` in `frontend/` passed.
  - Frontend Vitest passed with no test files.
  - `npm run build` in `frontend/` passed.
  - `git diff --check` passed with CRLF warnings only.
  - Mojibake `rg` check passed.
- Frontend build assets: JS `index-BvEYaSZm.js`, CSS `index-BxLAbVeG.css`.
- Deploy command:
  - `wrangler pages deploy frontend/dist --project-name supplementstack`
- Preview URL: `https://0ed675d5.supplementstack.pages.dev`.
- Smoke checks:
  - Preview root returned HTTP 200 and had the new JS asset.
  - Live root returned HTTP 200 and had the new JS asset.
  - Preview `/api/demo/products` returned HTTP 200 with count 7.
  - Live `/api/demo/products` returned HTTP 200 with count 7.
  - Preview `/api/ingredients/1/products` returned HTTP 200 with count 3.
  - Live `/api/ingredients/1/products` returned HTTP 200 with count 3.
  - Preview `/api/admin/user-products` unauthenticated returned HTTP 401.
  - Preview `/api/user-products` unauthenticated returned HTTP 401.
  - Live `/api/admin/user-products` unauthenticated returned HTTP 401.
  - Preview/live `/api/ingredients/1/recommendations` returned HTTP 200 with
    count 4.
- Remaining follow-up:
  - Dedicated admin UI for sub-ingredient mapping management.
  - Final legal/compliance review, authenticated browser/mobile QA, and
    affiliate/domain policy review remain open.
- Workspace note:
  - `.claude/SESSION.md` and `.claude/settings.json` remain dirty and were
    intentionally untouched.

## Demo And User Product Hardening

### 2026-05-04 - D1 + Cloudflare Pages: demo/session abuse and product moderation hardening

- Commit: `18a4141` - Security: Harden demo and user product moderation.
- Remote D1 migration:
  - Applied `d1-migrations/0038_trusted_product_submitters.sql` to
    `supplementstack-production`.
  - Control query confirmed `users.is_trusted_product_submitter` exists.
- Scope:
  - `/api/demo/products` now returns up to 7 starter products.
  - `POST /api/demo/sessions` is KV rate-limited per client IP and no longer
    persists submitted `stack_json` into D1.
  - Legacy `GET /api/demo/sessions/:key` no longer returns stored user stack
    changes.
  - Demo stack descriptions are page-local in React state, not localStorage.
  - `POST /api/user-products` is KV rate-limited per authenticated user.
  - `POST /api/products` is KV rate-limited per authenticated user.
  - New trusted submitter flag:
    `users.is_trusted_product_submitter`.
  - Normal user products remain `pending`; trusted submitters auto-create
    `approved` user products.
  - User-owned `approved` user products are locked against user edit/delete.
  - Admin user-product tab can toggle trusted submitter status.
  - Shop-domain matching now parses hostnames and allows only exact domain or
    subdomain matches, preventing `amazon.de.evil.com` style spoofing.
- Product-model caveat:
  - Superseded by `1272e11`. `user_products.status = 'approved'` remains the
    private moderation/lock state, but durable ingredient mapping and admin
    catalog conversion are now deployed.
- Local validation:
  - `npx tsc -p tsconfig.json` in `functions/` passed.
  - `npm run lint --if-present` in `frontend/` passed.
  - `npm run test --if-present -- --run` in `frontend/` passed with no test
    files via `--passWithNoTests`.
  - `npm run build` in `frontend/` passed.
  - `git diff --check` passed with only LF/CRLF warnings.
- Build assets: JS `assets/index-BMGjisnj.js`, CSS
  `assets/index-BBkQf4zK.css`.
- Deploy prep:
  - Rebuilt `frontend/dist`.
  - Copied `functions/api` to `frontend/dist/functions/api`.
  - Verified `frontend/dist/functions/api/[[path]].ts` exists.
- Deploy command:
  - `. .\scripts\use-supplementstack-cloudflare.local.ps1; npx wrangler pages deploy frontend/dist --project-name supplementstack`
- Preview URL: `https://5b9c9907.supplementstack.pages.dev`.
- Smoke checks:
  - Preview root returned HTTP 200.
  - Live root returned HTTP 200.
  - Preview/live `/api/demo/products` returned HTTP 200 with 7 starter
    products.
  - Preview `POST /api/demo/sessions` returned HTTP 200 with a compatibility
    key, `expiresAt`, and `stack: []`.
  - Preview/live spoof resolve for `https://amazon.de.evil.com/item` returned
    `shop_name: null`.
  - Preview/live real resolve for `https://www.amazon.de/dp/test` returned
    `shop_name: "Amazon"`.
  - Preview/live unauthenticated `/api/admin/user-products` returned HTTP 401.
- Wrangler warning:
  - Dirty worktree warning was expected because `.claude/SESSION.md` and
    `.claude/settings.json` remain dirty and were not part of the commit/deploy.

## Legal Pages

### 2026-05-04 - Cloudflare Pages: imprint, privacy, terms

- Commit: `9c2c627` - Legal: Add imprint privacy and terms pages.
- Scope:
  - Added `/impressum`, `/datenschutz`, `/nutzungsbedingungen`, and `/agb`
    alias.
  - Footer links `Impressum`, `Datenschutz`, `Nutzungsbedingungen`, and
    `Cookie-Einstellungen`.
  - Removed external Google Fonts import; app now uses system fonts.
  - Expanded privacy text for GA4 consent, Cloudflare/GitHub/GitHub Actions,
    Google Analytics, and third-country processing.
  - No Apple/OAuth/Social-Login active-processing wording.
- Research bases: §5 DDG, §25 TDDDG, Art. 13/6 DSGVO, §36 VSBG, §18 MStV,
  EU ODR shutdown on 2025-07-20, and Google GA4 EU privacy/IP notes.
- Local validation:
  - `npm run build` in `frontend/` passed.
  - `git diff --check` passed with only LF/CRLF warnings.
- Build assets: `/assets/index-DtdVqjYU.js` and
  `/assets/index-CieqqPmY.css`.
- Deploy prep: copied `functions/api` to `frontend/dist/functions/api`;
  `frontend/dist/functions/api/[[path]].ts` existed before deploy.
- Preview URL: `https://d6e92688.supplementstack.pages.dev`.
- Smoke checks:
  - Preview `/impressum`, `/datenschutz`, and `/nutzungsbedingungen` returned
    HTTP 200.
  - Live `https://supplementstack.de/impressum`, `/datenschutz`,
    `/nutzungsbedingungen`, and `/agb` returned HTTP 200 and used
    `index-DtdVqjYU.js`.
- Open: final legal review remains recommended/required before SEO indexing;
  DSB/AVV/Cloudflare/GitHub/Google settings should be formally checked.

## Consent-Based GA4 Analytics

### 2026-05-04 - Cloudflare Pages: GA4 analytics with explicit consent

- Commit: `a18136d` - Feature: Add consent-based GA4 analytics.
- Measurement ID: `G-QVHTTK2CNP`.
- Scope: frontend-only GA4 consent banner, `localStorage` accepted/declined
  persistence, lazy `gtag.js` injection after Zustimmung, SPA `page_view`
  tracking only after consent, footer `Datenschutz` and
  `Cookie-Einstellungen`, plus minimal `/datenschutz` page.
- Privacy behavior: GA4 is not statically inserted in `index.html`; Ablehnung
  loads no GA script and sends no GA events. If consent is reset after GA was
  loaded, analytics storage is denied and future pageviews stop until renewed
  consent.
- Local validation:
  - `npm run build` in `frontend/` passed.
  - `git diff --check` passed with only LF/CRLF warnings.
- Deploy prep: copied `functions/api` to `frontend/dist/functions/api`;
  `frontend/dist/functions/api/[[path]].ts` existed before deploy.
- Preview URL: `https://f876ad10.supplementstack.pages.dev`.
- Smoke checks:
  - Preview `/` returned HTTP 200.
  - Preview `/datenschutz` returned HTTP 200.
  - Live `https://supplementstack.de/datenschutz` returned HTTP 200 and used
    `/assets/index-B7aLcsIq.js`.
- Open: Impressum/AGB are still missing; Datenschutzerklaerung is a working
  draft and needs legal review.

## Stack Warnings Performance

### 2026-05-04 - Cloudflare Pages: batched stack warning interaction lookup

- Commit: `5905a20` - Fix: Batch stack warning interaction lookup.
- Scope: `GET /api/stack-warnings/:id` in `functions/api/modules/stacks.ts`
  no longer loads interactions with an O(n^2) pair loop. Stacks with 0 or 1
  ingredient id return `{ warnings: [] }` immediately; otherwise one SQL query
  uses dynamic `IN (...)` placeholders for both ingredient columns.
- Semantics: auth, ownership, 404, and 403 behaviour unchanged.
- Local validation:
  - `npx tsc -p tsconfig.json` in `functions/` passed.
  - `git diff --check` passed with only CRLF warnings.
  - `npm run build` in `frontend/` passed.
- Deploy command: `. .\scripts\use-supplementstack-cloudflare.local.ps1; npx wrangler pages deploy frontend/dist --project-name supplementstack`
- Preview URL: `https://1c23aea8.supplementstack.pages.dev`
- Build assets: JS `index-Dkeio0yL.js`, CSS `index-RAoQ0gyV.css`.
- Smoke checks:
  - Preview root returned HTTP 200 with the expected assets.
  - Preview unauthenticated `/api/stack-warnings/1` returned HTTP 401.
  - Live `https://supplementstack.de/api/stack-warnings/1` returned HTTP 401.
- Wrangler warning: dirty worktree because `.claude/SESSION.md` and
  `.claude/settings.json` were dirty; expected and not part of deploy.

## Profile Self-Service (DSGVO Art. 16 + 17)

### 2026-05-04 - Cloudflare Pages: profile password change + account deletion

- Commit: `78d8925` - Feature: Profile self-service for password change and account deletion.
- Scope:
  - `functions/api/modules/auth.ts`: new `PATCH /api/me/password` and `DELETE /api/me` mounted on the existing `meApp`. Both require `ensureAuth`, re-authenticate via the current password (`verifyPassword`), and are rate-limited (`pwchange:<userId>` 5/15min, `accdel:<userId>` 3/60min).
  - Account deletion runs `c.env.DB.batch([...])` to hard-delete dependent rows in order (`stack_items` via subselect on `stacks`, then `stacks`, `wishlist`, `user_products`, `consent_log`, `users`). Best-effort cleanup loop covers tables from later migrations (`admin_audit_log`, `dose_recommendations`, `share_links`, `blog_posts`, `api_tokens`) — silently skipped if the table doesn't exist in the live DB.
  - `frontend/src/api/auth.ts`: `changePassword`, `deleteAccount`, plus a `preserveTokenOn401` helper. The axios response interceptor in `client.ts:19-21` strips the auth token on any 401; without the helper a wrong-current-password attempt would log the user out.
  - `frontend/src/pages/ProfilePage.tsx`: two new sections. Password-change with current/new/repeat fields and inline success/error messaging. Account-deletion with red warning, confirmation phrase `LÖSCHEN`, password re-entry, disabled red button until both match. On success: `logout()` + `navigate('/', { replace: true })`. No `window.alert`. 44px touch targets.
- Local validation: `npx tsc -p tsconfig.json` (functions/) clean; `npm run build` (frontend/) clean.
- Deploy command: `. .\scripts\use-supplementstack-cloudflare.local.ps1; npx wrangler pages deploy frontend/dist --project-name supplementstack`
- Preview URL: `https://16edb9e2.supplementstack.pages.dev`
- Build assets: JS `index-Dkeio0yL.js`, CSS `index-RAoQ0gyV.css`.
- Smoke checks:
  - Preview root + live `https://supplementstack.de/` returned HTTP 200.
  - Unauthenticated `PATCH /api/me/password` → HTTP 401 `{"error":"Unauthorized"}`.
  - Unauthenticated `DELETE /api/me` → HTTP 401 `{"error":"Unauthorized"}`.
  - Full end-to-end (login → change password → delete account) deferred to avoid creating or deleting real users in production D1.
- Note: live DB is at migration 0022; the optional-cleanup loop in `DELETE /api/me` is intentionally tolerant of missing tables, so this deploy works against the current schema and stays correct after future migrations are applied.

## Pre-Launch Indexing Block

### 2026-05-04 - Cloudflare Pages: robots.txt disallowing search crawlers

- Commit: `1d8b288` - Fix: Disallow search crawlers by name in robots.txt (follow-up to `70aa1f9`).
- Scope: created `frontend/public/robots.txt`. Initial version had only `User-agent: *` `Disallow: /`. After deploy, the live domain returned a Cloudflare-managed AI-bot block prepended at the front with `User-agent: *` `Allow: /`. Hardened the file to also list search crawlers by name (Googlebot, Googlebot-Image, Bingbot, DuckDuckBot, YandexBot, Baiduspider, Slurp), each with `Disallow: /`. Spec-wise a name-specific Disallow takes precedence over a wildcard Allow, so this protects against Cloudflare's prepend behaviour.
- Local validation: `npm run build` (frontend/) clean. Vite copies `frontend/public/*` into `frontend/dist/` automatically.
- Deploy commands: two deploys, the second after the hardening edit.
- Preview URLs: `https://7d3e5fb6.supplementstack.pages.dev` then `https://78a83b47.supplementstack.pages.dev`.
- Smoke checks:
  - Preview `/robots.txt` returned HTTP 200 with the file as written.
  - Live `https://supplementstack.de/robots.txt` returned HTTP 200; visible structure confirms Cloudflare's managed AI-bot block precedes our explicit search-crawler Disallows + wildcard Disallow.
- Follow-up: when legal/compliance is cleared and SEO is intentionally enabled, replace the file with an empty/permissive version (or a per-path policy plus `Sitemap:` reference).

## Registration Data Persistence

### 2026-05-03 - Cloudflare Pages: persist age, gender, guideline_source on register

- Commit: `e832263` - Fix: Persist age, gender, guideline_source on register.
- Scope: `RegisterPage.tsx` collected `age`/`gender`/`guidelineSource` but only `health_consent` was forwarded; values are now passed through `AuthContext.register()` and the `/api/auth/register` endpoint and persisted on the `users` row. Backend validates `age` (integer 1-120), `gender` (`männlich`/`weiblich`/`divers`), `guideline_source` (`DGE`/`Studien`/`Influencer`); empty strings normalize to `NULL`.
- DB schema: columns `users.age`, `users.gender`, `users.guideline_source` already exist (`d1-migrations/0001_initial.sql`); no migration needed.
- Local validation: `npx tsc -p tsconfig.json` (functions/) clean; `npm run build` (frontend/) clean. 3 pre-existing TS errors in `frontend/src/api/admin.ts` and `src/api/base.ts` are unrelated to this change.
- Deploy command: `. .\scripts\use-supplementstack-cloudflare.local.ps1; npx wrangler pages deploy frontend/dist --project-name supplementstack`
- Preview URL: `https://0718b546.supplementstack.pages.dev`
- Build assets: JS `index-zWVCB7vc.js`, CSS `index-Cf3yP80d.css`.
- Smoke checks:
  - Preview root and live `https://supplementstack.de/` returned HTTP 200.
  - `POST /api/auth/register` with `age: 999` returned HTTP 400 with `{"error":"Alter muss eine ganze Zahl zwischen 1 und 120 sein."}` — backend validation confirmed.
  - Full register-flow smoke deferred (would create a real user in production D1; rate-limit window also still relevant).

## Live Domain Hardening

### 2026-05-03 - Cloudflare Pages: FRONTEND_URL + CORS allowlist for live domain

- Commit: `283cbc8` - Fix: Switch FRONTEND_URL and CORS allowlist to live domain.
- Scope:
  - `wrangler.toml`: `FRONTEND_URL` switched from `https://supplementstack.pages.dev` to `https://supplementstack.de` so password-reset mail links land on the live domain.
  - `functions/api/[[path]].ts`: CORS allowlist switched from static array to function-origin. Now allows live domain (`supplementstack.de` + `www.supplementstack.de`), Pages main preview, all Pages preview hash subdomains via regex `/^https:\/\/[a-z0-9-]+\.supplementstack\.pages\.dev$/`, and `localhost:5173`.
- Local validation:
  - `npx tsc -p tsconfig.json` in `functions/` passed.
  - `npm run build` in `frontend/` passed (1444 modules, 1.46s).
- Deploy command: `. .\scripts\use-supplementstack-cloudflare.local.ps1; npx wrangler pages deploy frontend/dist --project-name supplementstack`
- Preview URL: `https://9c8dfe74.supplementstack.pages.dev`
- Build assets: JS `index-Bl-g6o41.js`, CSS `index-Cf3yP80d.css`.
- Smoke checks:
  - Preview root returned HTTP 200.
  - Live `https://supplementstack.de/` returned HTTP 200.
  - Live `/api/ingredients` returned HTTP 200.
  - CORS preflight `OPTIONS /api/auth/forgot-password`:
    - Origin `https://supplementstack.de` → `Access-Control-Allow-Origin: https://supplementstack.de` (echoed) ✓
    - Origin `https://9c8dfe74.supplementstack.pages.dev` → echoed back ✓
    - Origin `https://evil.example.com` → no `Access-Control-Allow-Origin` header (browser would block) ✓

## UX Usability Polish

### 2026-05-03 - Cloudflare Pages: launch QA flow blockers

- Commit: `fcb1a6b` - Fix: Close launch QA flow blockers.
- Scope: wishlist shop-domain response shape, stale frontend API helpers,
  ingredient product visibility/moderation filtering, product-recommendation
  duplicate prevention, stack-warning authorization, and user-product
  validation.
- Local validation:
  - `npm run lint --if-present` in `frontend/` passed.
  - `npm run test --if-present -- --run` in `frontend/` passed with no test
    files via `--passWithNoTests`.
  - `npm run build` in `frontend/` passed.
  - `npx tsc -p tsconfig.json` in `functions/` passed.
  - `git diff --check` had no whitespace errors, only CRLF warnings.
- Deploy command: `. .\scripts\use-supplementstack-cloudflare.local.ps1; npx wrangler pages deploy frontend/dist --project-name supplementstack`
- Preview URL: `https://ae0fa762.supplementstack.pages.dev`
- Build assets: JS `index-Hw7gzAwb.js`, CSS `index-DWw_l_3p.css`.
- Wrangler warning: uncommitted changes existed at deploy time. Expected:
  memory files and `.claude/SESSION.md` were dirty while code commit
  `fcb1a6b` was committed.
- Smoke checks on preview/live:
  - Root returned HTTP 200.
  - D3 search returned HTTP 200.
  - `/api/ingredients/1/products` returned HTTP 200 with approved/public D3
    products.
  - `/api/ingredients/1/recommendations` returned HTTP 200 with 4 dose
    recommendations.
  - `/api/shop-domains` returned HTTP 200 with `{ shops }`.
  - `/api/demo/products` returned HTTP 200.
  - Unauthenticated `/api/stack-warnings/1` returned HTTP 401.
  - Unauthenticated `/api/admin/translations/ingredients` returned HTTP 401.
  - Unauthenticated `/api/user-products` returned HTTP 401.
- Registration note: registration was tested successfully before rate limiting
  kicked in, but final fresh registration smoke after deploy was not completed
  because `/auth/register` returned 429 after repeated QA attempts.
- Follow-up: once the rate-limit window clears, run one fresh browser/API
  registration smoke, then logged-in browser QA for stack, wishlist, own
  products, and admin flows.

### 2026-05-02 - Cloudflare Pages: stack and admin usability flows

- Commit: `8fb5431` - UX: Improve stack and admin usability flows.
- Scope: User/Demo/Search/Stack UX fixes plus Admin UX fixes.
- Local validation:
  - `npm run lint --if-present` in `frontend/` passed.
  - `npm run test --if-present -- --run` in `frontend/` passed with no tests
    via `--passWithNoTests`.
  - `npm run build` in `frontend/` passed.
  - `npx tsc -p tsconfig.json` in `functions/` passed.
  - `git diff --check` had no whitespace errors, only CRLF warnings.
- Deploy prep: `npm run build` in `frontend/`; copied `functions` to
  `frontend/dist/functions`; verified
  `frontend/dist/functions/api/[[path]].ts` with `Test-Path -LiteralPath`.
- Deploy command: `. .\scripts\use-supplementstack-cloudflare.local.ps1; npx wrangler pages deploy frontend/dist --project-name supplementstack`
- Preview URL: `https://2b00223a.supplementstack.pages.dev`
- Wrangler warning: uncommitted changes existed at deploy time. Expected:
  memory files and `.claude/SESSION.md` were dirty while code commit `8fb5431`
  was committed.
- Smoke checks on preview:
  - `/` returned HTTP 200 with JS asset `index-D8jGeaah.js`, CSS asset
    `index-DWw_l_3p.css`, and `x-robots-tag: noindex`.
  - `/api/ingredients/search?q=d3` returned HTTP 200 and contained Vitamin D3.
  - `/api/admin/translations/ingredients` returned HTTP 401, not 404.
  - `/api/ingredients/1/recommendations` returned HTTP 200 with 4 rows.
- Smoke checks on live custom domain:
  - `https://supplementstack.de/` returned HTTP 200 with the same JS/CSS asset
    names as preview.
  - `https://supplementstack.de/api/ingredients/search?q=d3` returned HTTP 200.
  - `https://supplementstack.de/api/admin/translations/ingredients` returned
    HTTP 401, not 404.

### 2026-05-02 13:28:28 - Cloudflare Pages: add-product search focus

- Commit: `078fc31` - UX: Auto-focus search field in 'Produkt hinzufuegen'
  modal (Demo + Stack-Workspace).
- Scope: `frontend/src/components/SearchBar.tsx`,
  `frontend/src/components/StackWorkspace.tsx`.
- Status from `.claude/SESSION.md`: deployed successfully.
- Preview URL: not recorded in `.claude/SESSION.md`; do not invent one.

### 2026-05-02 13:22:20 - Cloudflare Pages: user product name focus

- Commit: `e8f2bbc` - UX: Auto-focus name field when opening 'Produkt
  hinzufuegen' modal.
- Scope: `frontend/src/components/modals/UserProductForm.tsx`.
- Status from `.claude/SESSION.md`: deployed successfully.
- Preview URL: not recorded in `.claude/SESSION.md`; do not invent one.

## Phase D Product Recommendations And Translations

### 2026-05-02 - Cloudflare Pages: admin translations expansion

- Commit: `49ed83e` - Feature: Expand admin translation management.
- Scope: admin translation management now covers Ingredients, Dose
  Recommendations, Verified Profiles, and Blog Posts.
- No D1 migration was needed.
- Local validation from handoff: `npm run lint --if-present`,
  `npm run test --if-present -- --run`, and `npm run build` passed in
  `frontend/`; `npx tsc -p tsconfig.json` passed in `functions/`.
- Deploy prep: `npm run build` in `frontend/`; copied `functions` to
  `frontend/dist/functions`; verified
  `frontend/dist/functions/api/[[path]].ts` exists.
- Deploy command: `. .\scripts\use-supplementstack-cloudflare.local.ps1; npx wrangler pages deploy frontend/dist --project-name supplementstack`
- Preview URL: `https://14cf1dba.supplementstack.pages.dev`
- Smoke checks on preview:
  - `/` returned HTTP 200.
  - `/api/admin/translations/ingredients` returned HTTP 401 Unauthorized,
    confirming the route exists and is auth-protected.
  - `/api/admin/translations/dose-recommendations` returned HTTP 401
    Unauthorized, confirming the route exists and is auth-protected.
  - `/api/admin/translations/verified-profiles` returned HTTP 401
    Unauthorized, confirming the route exists and is auth-protected.
  - `/api/admin/translations/blog-posts` returned HTTP 401 Unauthorized,
    confirming the route exists and is auth-protected.
  - `/api/ingredients/search?q=d3` returned HTTP 200.

### 2026-05-02 - D1 + Cloudflare Pages: Phase D rollout

- Commit: `862ed57` - Feature: Phase D product recommendations and translations.
- Scope: product recommendation table rename, temporary compatibility
  `recommendations` view/triggers, admin ingredient translations MVP, refreshed
  Cloudflare-line docs/CI, npm lockfiles, and generic local setup scripts.
- Local validation: `npm run lint --if-present`, `npm run test --if-present -- --run`, and `npm run build` passed in `frontend/`; `npx tsc -p tsconfig.json` passed in `functions/`.
- Initial command: `. .\scripts\use-supplementstack-cloudflare.local.ps1; npx wrangler d1 migrations apply supplementstack-production --remote`
- Initial migration result: failed before 0036 because remote schema already had Phase B/C objects but `d1_migrations` ended at 0025; migration 0026 tried to seed existing `populations.slug` rows and hit a UNIQUE constraint.
- Journal repair: verified Phase B/C objects were present remotely, then inserted `d1_migrations` rows for already-live migrations 0026-0035.
- Migration result: reran Wrangler migration apply; `0036_rename_recommendations_to_product_recommendations.sql` applied successfully.
- Remote schema verification: no pending migrations; `product_recommendations` is a table, `recommendations` is a view, `recommendations_insert` and `recommendations_delete` triggers exist, and both recommendation-link counts are 0.
- Deploy prep: `npm run build` in `frontend/`; copied `functions` to `frontend/dist/functions`; verified `frontend/dist/functions/api/[[path]].ts` exists.
- Deploy command: `. .\scripts\use-supplementstack-cloudflare.local.ps1; npx wrangler pages deploy frontend/dist --project-name supplementstack`
- Preview URL: `https://66a9ee27.supplementstack.pages.dev`
- Smoke checks on preview:
  - `/` returned HTTP 200.
  - `/api/recommendations?ingredient_id=1` returned HTTP 200 with empty `recommendations`.
  - `/api/ingredients/1/recommendations` returned HTTP 200 with 4 dose recommendations.
  - `/api/ingredients/search?q=d3` returned HTTP 200 with Vitamin D3.
  - `/api/products/1` returned HTTP 200.
  - `/api/admin/translations/ingredients` returned HTTP 401 Unauthorized, confirming the route exists and is auth-protected.

## Affiliate Disclosure Cleanup

### 2026-05-01 - Cloudflare Pages: affiliate disclosure moved to footer

- Commit: `965d4e4` - Fix: Move affiliate disclosure to footer.
- Scope: `frontend/src/components/ProductCard.tsx`, `frontend/src/components/LegalDisclaimer.tsx`.
- Build: `npm run build` from `frontend/` passed.
- Deploy prep: `frontend/dist/functions/api/[[path]].ts` verified present before deploy.
- Command: `. .\scripts\use-supplementstack-cloudflare.local.ps1; npx wrangler pages deploy frontend/dist --project-name supplementstack`
- Preview URL: `https://b4e4ea90.supplementstack.pages.dev`
- Smoke checks: preview root returned HTTP 200; preview JS `/assets/index-DgGBIJBD.js` returned HTTP 200.
- Bundle check: downloaded preview JS and verified the old ProductCard Affiliate badge class was absent. Remaining `Affiliate` strings are expected in footer/legal copy, landing copy, and admin/user-edit surfaces.

## Preview Search API-Base Fix

### 2026-05-01 - Cloudflare Pages: same-origin API in deployed frontend

- Commit: `b5dba6e` - Fix: Use same-origin API in deployed frontend.
- Scope: `frontend/src/api/base.ts`, `frontend/src/api/client.ts`, `frontend/src/components/SearchBar.tsx`, `frontend/src/components/StackWorkspace.tsx`.
- Build: `npm run build` from `frontend/` passed; `npx tsc -p tsconfig.json` from `functions/` passed.
- Deploy prep: `frontend/dist/functions/api/[[path]].ts` verified present before deploy.
- Command: `. .\scripts\use-supplementstack-cloudflare.local.ps1; npx wrangler pages deploy frontend/dist --project-name supplementstack`
- Preview URL: `https://8582e2f6.supplementstack.pages.dev`
- Smoke checks: preview root returned HTTP 200; `GET /api/ingredients/search?q=d3` returned HTTP 200 and contained Vitamin D3.
- Bundle check: downloaded `/assets/index-BXEivzLW.js` from the preview and verified it does not contain `supplementstack.pages.dev/api`.

## Demo Product Loading Fix

### 2026-04-30 - Cloudflare Pages: demo product loading

- Commit: `2f4248b` - Fix: Restore demo product loading.
- Scope: `functions/api/modules/demo.ts`, `frontend/src/components/SearchBar.tsx`, `frontend/src/pages/SearchPage.tsx`.
- Build: `npx tsc -p tsconfig.json` from `functions/` passed; `npm run build` from `frontend/` passed.
- Deploy prep: `frontend/dist/functions/api/[[path]].ts` verified present before deploy.
- Command: `. .\scripts\use-supplementstack-cloudflare.local.ps1; npx wrangler pages deploy frontend/dist --project-name supplementstack`
- Preview URL: `https://aa546170.supplementstack.pages.dev`
- Smoke checks: preview root returned `HTTP/1.1 200 OK`; `GET /api/demo/products` returned `HTTP/1.1 200 OK` with 18 products.
- Open risk: no browser/manual demo UI QA was run in this session.

## Modal Data Loading Fix

### 2026-04-30 - Cloudflare Pages: D3 recommendations / product modal loading

- Commit: `9107e2e` - Fix: Stabilize dosage and product modal data loading.
- Scope: `Modal1Ingredient.tsx`, `Modal2Products.tsx`, `frontend/src/types/local.ts`, `functions/api/modules/ingredients.ts`.
- Build: `npx tsc -p tsconfig.json` from `functions/` passed; `npm run build` from `frontend/` passed.
- Deploy prep: `frontend/dist/functions/api/[[path]].ts` verified present before deploy.
- Command: `. .\scripts\use-supplementstack-cloudflare.local.ps1; npx wrangler pages deploy frontend/dist --project-name supplementstack`
- Preview URL: `https://bc37a09d.supplementstack.pages.dev`
- HTTP status check on preview URL: `HTTP/1.1 200 OK`.
- Open risk: no browser/manual modal QA was run in this session.

## Phase C — Tech-Debt Cleanup

### 2026-04-30 - Cloudflare Pages: Tech-Debt-Cleanup nach Phase C

- Commit: `b866c3d` - Refactor + Ops: Tech-Debt-Cleanup nach Phase C.
- Items: normalizeComparableUnit removed (replaced by normalizeUnit from lib/units.ts); IngredientRow extended with upper_limit/upper_limit_unit/preferred_unit; pages_build_output_dir added to wrangler.toml; next-steps.md reorganized.
- Build: `npx tsc -p tsconfig.json` from `functions/` passed (no errors); `npm run build` from `frontend/` passed (1.45s, 0 errors).
- Command: `npx wrangler pages deploy frontend/dist --project-name supplementstack` (with CF env vars loaded).
- Preview URL: `https://c0f45f5b.supplementstack.pages.dev`
- pages_build_output_dir warning: no "config ignored" warning appeared in deploy output — resolved.
- Smoke test: build and deploy verified; endpoint functional check skipped (no admin JWT in session).

## Phase C Deploys

### 2026-04-30 - Cloudflare Pages: server-side unit conversion

- Commit: `11440f5` - Feature: Server-side Unit-Konvertierung — IU/µg/mg/g für Upper-Limit-Vergleich.
- New `functions/api/lib/units.ts`: `normalizeUnit()`, `convertAmount()` with IU↔µg/mg/g support for Vitamin D, A, E; pure mass conversion µg↔mg↔g generic.
- Integrated into `GET /api/ingredients/:id/recommendations`: cross-unit upper-limit comparison now attempted; `amount_converted_to_upper_limit_unit` field added to response when conversion was performed.
- Build: `npx tsc -p tsconfig.json` from `functions/` passed (no errors); `npm run build` from `frontend/` passed (1.43s, 0 errors).
- Command: `npx wrangler pages deploy frontend/dist --project-name supplementstack` (with CF env vars loaded).
- Preview URL: `https://292a8010.supplementstack.pages.dev`
- HTTP status check: not verified (no admin JWT in this session).
- Smoke test: skipped (no local D1 with mixed-unit rows available).

### 2026-04-29 - Cloudflare Pages: admin audit logging

- Commit: `4482a5f` - Feature: Admin Audit Logging — alle Mutationen in admin_audit_log.
- New `logAdminAction()` helper in `functions/api/lib/helpers.ts`; 16 mutation endpoints in admin.ts, products.ts, ingredients.ts now write to `admin_audit_log`.
- Build: `npx tsc -p tsconfig.json` from `functions/` passed; `npm run build` from `frontend/` passed; `functions/api` copied into `frontend/dist/functions/api` before deploy.
- Command: `. .\scripts\use-supplementstack-cloudflare.local.ps1; npx wrangler pages deploy frontend/dist --project-name supplementstack`
- Preview URL: `https://f8f1e2ef.supplementstack.pages.dev`
- HTTP status check: not verified (no admin JWT available in this session).

### 2026-04-29 - Cloudflare Pages: dose recommendations API

- Commit: `dd58ba2` - Feature: Add dose recommendations API.
- Endpoint: `GET /api/ingredients/:id/recommendations` reading active rows from `dose_recommendations`, joining `populations`, `verified_profiles`, and translation tables.
- Build: `npm run build` from `frontend/`; `functions` copied into `frontend/dist/functions` because Vite build did not include it.
- Command: `. .\scripts\use-supplementstack-cloudflare.local.ps1; npx wrangler pages deploy frontend/dist --project-name supplementstack`
- Preview URL: `https://23fb451d.supplementstack.pages.dev`
- HTTP status check on preview URL: `200`.
- Wrangler warning: `wrangler.toml` lacks `pages_build_output_dir`, so its config was ignored for the Pages deploy.

### 2026-04-29 - Cloudflare Pages: Hono module split

- Commit: `b1fd347` - Refactor: Split Pages API into Hono modules.
- `functions/api/[[path]].ts` is now a composition root mounting modules with `app.route(...)`; logic moved into `functions/api/modules/*` and `functions/api/lib/*`.
- Build: `npx tsc -p tsconfig.json` from `functions/` passed; `npm run build` from `frontend/` passed; `functions/api` copied into `frontend/dist/functions/api` before deploy.
- Command: `. .\scripts\use-supplementstack-cloudflare.local.ps1; npx wrangler pages deploy frontend/dist --project-name supplementstack`
- Preview URL: `https://c29f1c5d.supplementstack.pages.dev`
- HTTP status check on preview URL: `200`.

### 2026-04-28 16:10:17 - Cloudflare Pages

- Commit: `3c14e0d` - Fix: dosage cards show "Keine Empfehlung verfuegbar" instead of fake fallback values.

## Follow-Up

- D1 backup workflow has run successfully both manually and automatically. Token scopes verified.
- `pages_build_output_dir = "frontend/dist"` is already present in `wrangler.toml`; no deploy-log follow-up remains for that warning.

When a future agent deploys or applies migrations, append the exact date, commit, command summary, and verification result here.
