# Current State

Last updated: 2026-05-11

## Active Baseline

- Production-like line is the Cloudflare Pages/Workers line:
  - Backend: `functions/api/[[path]].ts`, `functions/api/modules/*`,
    `functions/api/lib/*`
  - Frontend: `frontend/src/*`
  - Database migrations: `d1-migrations/*`
  - Cloudflare config: `wrangler.toml` and `wrangler.maintenance.toml`
- Live domain: `https://supplementstack.de`.
- Latest documented deployed preview:
  `https://71809f56.supplementstack.pages.dev`.
- The active admin frontend is `/administrator`.
- `/api/admin` remains the backend API namespace.
- The old frontend `/admin` route was removed during cleanup. Use
  `/administrator` for the admin UI.

## Admin State

- The old frontend admin monolith has been removed from active code:
  - `frontend/src/pages/AdminPage.tsx`
  - `frontend/src/components/AdminLayout.tsx`
  - `frontend/src/pages/admin/*`
- Active admin pages live in `frontend/src/pages/administrator/*`.
- Active admin menu now shows the reduced operator set: Dashboard,
  Wirkstoffe, Produkte, Richtwerte, Wissensdatenbank, Uebersetzungen,
  Wechselwirkungs-Matrix, Benutzerverwaltung, Shop-Domains, and Rechtliches.
- Several older admin pages still have direct routes for compatibility or later
  cleanup, but they are no longer primary sidebar destinations.
- Admin pages use scoped shared UI/CSS in:
  - `frontend/src/pages/administrator/AdminUi.tsx`
  - `frontend/src/pages/administrator/admin.css`
- Backend admin code is still concentrated in
  `functions/api/modules/admin.ts`; splitting it by domain remains a later
  refactor candidate.

## Latest Completed Work

### 2026-05-11 Routine Email Endpoint - Local Implementation

- Implemented real authenticated `/routine` mail sending locally; not deployed
  yet.
- Added `POST /api/stacks/routine/email` under the existing stacks module and
  placed it before dynamic `/:id` routes so Hono does not match `routine` as a
  stack id.
- The endpoint loads all stacks for the current user, prepares stack items with
  the existing Stack-Mail helpers, groups the email by timing
  (`morning`/`noon`/`evening`/`flexible`), includes warnings, and adds a total
  Wirkstoff overview.
- Routine mail uses its own stricter rate-limit key:
  `routine-email:${user.userId}` with 3 sends/hour.
- `frontend/src/pages/RoutinePage.tsx` now calls the real endpoint from
  `Plan mailen`, shows sending/success/error states, and no longer uses the
  placeholder status text.
- Added regression coverage to `scripts/backend-regression-check.mjs` for
  route existence/order, routine rate-limit key, dedicated HTML builder, and
  frontend endpoint usage.
- Verification:
  - TDD red: `node scripts/backend-regression-check.mjs` failed before
    implementation with `Routine email endpoint must exist`.
  - `node scripts/backend-regression-check.mjs` passed.
  - `functions`: `npx tsc -p tsconfig.json --noEmit` passed.
  - `frontend`: `npx tsc --noEmit` passed.
  - `frontend`: `npm run build` passed.
  - `git diff --check` passed with existing LF/CRLF warnings only.

### 2026-05-11 User UX Follow-Ups - Preview Implementation

- Implemented the post-QA user UX follow-ups and deployed them to the
  `codex-website-ux-fixes` Pages preview.
- Stack create/edit now owns family/profile assignment:
  - `Stack erstellen` opens a modal for name, description, and profile instead
    of immediately creating `Stack 2`.
  - `Stack bearbeiten` can save name, description, and assigned family member.
  - The cockpit now shows the assignment and keeps profile management secondary.
- Product replacement from `Produkt bearbeiten` now preserves the current
  product's ingredient/dose/form context and opens directly into product
  selection where possible.
- Stack deletion now uses an in-app confirmation dialog instead of native
  `window.confirm`.
- Product selection now explains DGE vs. study values and the product ordering.
- Bottom selection bar now explicitly describes the sum of selected products.
- Stack product list mode was rebuilt as a compact scan-friendly list with
  German timing labels for raw timing values such as `evening`.
- `/profile` now uses a responsive desktop layout instead of a narrow
  mobile-like column.
- Own-product creation now has clearer guidance that it should be used only
  when the product is missing from normal product search, with simpler
  packaging/label-entry hints.
- `Influencer` remains the stored profile value for compatibility, but the
  visible label is now `Community-basierte Empfehlung`.
- Verification:
  - `frontend`: `npx tsc --noEmit` passed.
  - `frontend`: `npm run lint` passed.
  - `frontend`: `npm run build` passed.
  - `frontend`: `npm test -- --run` is blocked locally by Vite/esbuild
    `spawn EPERM` while loading `vite.config.ts`.
  - Browser sanity on local production build via static `dist` server passed
    for landing, demo load, stack-create modal/profile assignment visibility,
    and list-view toggle. Text entry in the in-app browser was limited by a
    missing virtual clipboard, so full create/delete interaction still needs
    deployment or a working dev server.

### 2026-05-11 Authenticated User Browser QA - Tobias

- Authenticated user QA was run on live `https://supplementstack.de` as
  `email@nickkrakow.de` with Tobias-style human thoughts.
- Covered:
  - logged-in landing page
  - `/stacks` empty stack and existing-stack workspace
  - stack creation and cleanup of QA stack `Stack 2`
  - stack edit modal
  - product add flow: search -> dosage -> product selection -> add
  - product edit modal and product replacement entry point
  - list/grid toggle and Einnahmeplan
  - `/my-products` empty state and own-product form
  - `/profile`
  - footer affiliate/medical/legal trust signals
- Important findings for next update:
  - Family/profile assignment belongs in `Stack anlegen` / `Stack bearbeiten`,
    not as a prominent separate cockpit control.
  - `Produkt bearbeiten` -> `Produkt wechseln` should open product selection
    directly with existing Wirkstoff/dose context preserved.
  - `/profile` needs a flexible desktop width; it currently feels too narrow /
    mobile-like on desktop.
  - Product add flow is much better after removing the forced form step.
  - Existing stack cards show useful costs, reach, and warnings, but raw timing
    labels like `evening` still appear.
  - Own-product creation is powerful but too complex for normal users without
    stronger guidance.
  - Stack delete still uses native `window.confirm`; functional but not ideal
    for a polished user flow.

### 2026-05-11 Tobias QA Updates - Deployed

- Landing page hero claim now says `Wissenschaftlich. Einfach. Kostenlos.`
  instead of `Wissenschaftlich. Einfach. Kosteneffizient.`.
- Normal and demo `AddProductModal` in `frontend/src/components/StackWorkspace.tsx`
  no longer has a separate `form` step in the product-add flow.
- Ingredient forms are still loaded after ingredient selection, but
  `selectedFormId` stays `null` by default and the flow goes directly to
  dosage.
- Product selection now exposes an optional form dropdown when forms exist,
  defaulting to `Alle Formen`; selecting a form reloads the product list with
  the form filter.
- Back navigation from dosage now returns to search.
- Added `scripts/tobias-qa-regression-check.mjs`.
- TDD red run passed as expected by failing before implementation with 10
  Tobias QA issues.
- Validation passed:
  - `node scripts/tobias-qa-regression-check.mjs`
  - `node scripts/admin-qa-regression-check.mjs`
  - `node --check scripts/tobias-qa-regression-check.mjs`
  - `frontend`: `npx tsc --noEmit`
  - `frontend`: `npm run build`
- GitHub:
  - Local commit `74cc5bd` pushed to branch
    `codex/streamline-demo-product-form-selection`.
  - PR `#4` merged to `main` as `9c67ed7`.
- Deployment:
  - Cloudflare Pages preview `https://71809f56.supplementstack.pages.dev`.
  - Live alias `https://supplementstack.de`.
- Browser QA:
  - Preview landing page shows `Wissenschaftlich. Einfach. Kostenlos.`
    and no longer shows `Kosteneffizient`.
  - Live landing page shows the same copy and no browser console errors.
  - Preview `/demo` Vitamin D3 flow goes directly from ingredient selection
    to dosage, then to product selection with optional `Form` dropdown
    defaulting to `Alle Formen`.
  - `Vitamin D3 2000 IU Tropfen` and `Vitamin D3 5000 IU` appeared in the
    product selection for the `2000 IE` study value with `Alle Formen`.

### 2026-05-11 Tobias Browser-QA Persona And First User QA - Memory

- New standard human browser-QA persona exists in
  `.agent-memory/browser-qa-persona.md`: Tobias, 30, normal
  health-interested user; covers user flows plus admin-operator overlay.
- Persona file was committed as `b694b4c`
  (`Add Tobias browser QA persona memory`).
- First Tobias QA covered landing page, demo, and Vitamin D/D3.
- Findings:
  - landing page communicates free/no-signup positioning well.
  - direct demo CTA was not visible in the logged-in admin context, so that
    observation is test-limited.
  - `/demo` is directly usable and explains demo mode.
  - D3 search finds Vitamin D3.
  - form selection is scientifically strong but cognitively heavy for normal
    users.
  - choosing `Cholecalciferol (D3)` + `2000 IE` returned
    `Keine Produkte fuer diesen Wirkstoff gefunden`, which can disrupt the
    demo core flow.

### 2026-05-10 Admin Human-Flow QA And Dosing URL Filter Fix - Deployed

- Authenticated admin QA was extended from a human/operator perspective across
  dashboard, products, product detail shop links, ingredients, dosing, users,
  user-products, shop domains, and legal routes.
- Found and fixed a live admin deep-link bug:
  `/administrator/dosing?ingredient_id=3&q=Magnesium` selected Magnesium in
  the filters but still rendered the unfiltered 100-row dosing list.
- `AdministratorDosingPage` now initializes `q` and `ingredient_id` filters
  from URL search params.
- `scripts/admin-qa-regression-check.mjs` now guards the URL filter
  initialization in addition to the previous admin dosing visibility rule.
- Validation passed:
  - `node scripts/admin-qa-regression-check.mjs`
  - `frontend`: `npx tsc --noEmit`
  - `node --check scripts/admin-qa-regression-check.mjs`
  - `frontend`: `npm run build`
  - `git diff --check` passed with existing LF/CRLF warnings only.
- GitHub commits on `main`:
  - `d9ef6cc` (`Guard admin dosing URL filters`)
  - `5733d8f` (`Initialize admin dosing filters from URL`)
- Cloudflare Pages production deployment succeeded for commit `5733d8f`.
  - Production deployment short id: `5a0b8826`
  - Live URL: `https://supplementstack.de`
- Live authenticated browser verification confirmed the Magnesium dosing
  deep-link now renders `4 Richtwerte` and no console warnings/errors.
- Admin usability findings from the pass:
  - `/administrator/user-products` is useful but not discoverable in the main
    sidebar.
  - The user-products `Markieren` button changes trusted status and is too
    ambiguous beside row selection.
  - The ingredient forms modal works but is long and cognitively heavy.
  - Native confirm dialogs are brittle in browser QA and less polished for
    destructive admin actions than in-app confirmation dialogs.
  - Shop-domain create/edit fields are understandable, but text-entry testing
    was blocked by the in-app browser automation clipboard limitation.

### 2026-05-10 Admin Browser QA And Dosing Visibility Fix - Deployed

- Authenticated browser QA was run against `https://supplementstack.de/administrator/`.
- A stale in-app browser tab was hanging on `/login`; a fresh tab loaded the
  active authenticated admin session correctly.
- Read-only admin QA passed without browser console errors on:
  `/administrator/dashboard`, `/administrator/products`,
  `/administrator/ingredients`, `/administrator/users`,
  `/administrator/dosing`, `/administrator/knowledge`,
  `/administrator/interactions`, `/administrator/shop-domains`,
  `/administrator/legal`, and `/administrator/profile`.
- Product shop-link modal, ingredient form modal, user detail drawer, command
  palette, and mobile dashboard/products/users layouts were smoke-tested
  without state-changing saves or deletes.
- Found and fixed an admin-only data visibility bug:
  `/administrator/dosing` hid all unpublished `dose_recommendations`, while
  production data currently stores all 136 dosing rows as unpublished.
  Admin maintenance views must show these rows.
- Added `scripts/admin-qa-regression-check.mjs` to guard against reintroducing
  the unpublished-dose hiding rule in the admin dosing list.
- Validation passed:
  - `node scripts/admin-qa-regression-check.mjs`
  - `node scripts/backend-regression-check.mjs`
  - `frontend`: `npx tsc --noEmit`
  - `frontend`: `npm run build`
  - `node --check scripts/admin-qa-regression-check.mjs`
  - `git diff --check` passed with existing LF/CRLF warnings only.
- Commit `2ffeec6` was pushed to `origin/main`.
- Cloudflare Pages production deployment succeeded for commit `2ffeec6`.
  - Preview URL: `https://575850b1.supplementstack.pages.dev`
  - Live URL: `https://supplementstack.de`
- Live authenticated browser verification confirmed `/administrator/dosing`
  now renders dosing rows again.

### 2026-05-10 Backend P2 Hardening - Deployed

- Implemented the backend review P2 fixes:
  - malformed JSON on `/api/auth/register`, `/api/auth/login`,
    `/api/auth/forgot-password`, and `/api/auth/reset-password` now returns
    HTTP 400 instead of bubbling into HTTP 500.
  - password-reset and stack-mail failures no longer expose raw transport
    debug details in JSON responses; details are kept in server logs.
  - admin CSV export escaping now neutralizes spreadsheet formula prefixes
    before attachment download.
- Added `scripts/backend-regression-check.mjs` as a lightweight regression
  check that runs without Vite/esbuild, because Vitest is blocked in the
  current Codex sandbox by `spawn EPERM`.
- Validation passed:
  - `node scripts/backend-regression-check.mjs`
  - `functions`: `npx tsc -p tsconfig.json --noEmit`
  - `node --check scripts/backend-regression-check.mjs`
  - `git diff --check` passed with the existing LF/CRLF warnings only.
- Commit `78a3565` was pushed to `origin/main`.
- Cloudflare Pages production deployment succeeded for commit `78a3565`.
  - Preview URL: `https://e0367e43.supplementstack.pages.dev`
  - Live URL: `https://supplementstack.de`
- Preview and live malformed JSON smokes passed for `/api/auth/login`,
  `/api/auth/forgot-password`, `/api/auth/reset-password`, and
  `/api/auth/register`: each returned HTTP 400 with `{"error":"Invalid JSON"}`.

### 2026-05-08 Admin Post-Launch Dashboard And Human Copy Pass - Deployed

- Pages deploy completed:
  - preview `https://89b9f726.supplementstack.pages.dev`
  - live `https://supplementstack.de`
- Admin dashboard is now a post-launch operator dashboard:
  - `Heute zu tun` is the first focus area.
  - KPI cards cover registrations/activations, active users, link clicks, and
    catalog risk.
  - `Umsatzsignale` separates affiliate/non-affiliate click signals, top
    products, top shops, deadlinks, and link-report potential.
  - `Katalogpflege`, `Content & Vertrauen`, and `Was passiert gerade` group the
    ongoing operator work.
- `/api/admin/stats` now returns range-aware current/previous values, trend
  metadata, top clicked products, top shops, open link reports, and link-health
  signal counts for the dashboard.
- Admin page subtitles were reviewed from an operator/human perspective and
  rewritten across the visible admin pages; technical wording such as migration
  notes and ASCII-only copy remnants was removed from those surfaces.
- Validation passed:
  - `frontend`: `npx tsc --noEmit`
  - `functions`: `npx tsc -p tsconfig.json --noEmit`
  - `frontend`: `npm run build`
  - `git diff --check` with existing LF/CRLF warnings only
- Preview/live smoke checks passed for `/`, `/administrator/dashboard`,
  `/api/products`, and unauthenticated admin guards for `/api/admin/stats` and
  `/api/admin/ops-dashboard`.

### 2026-05-08 Admin QA Remaining Knowledge/Wirkstoff Pass - Remote-Migrated And Deployed

- Remote D1 migration `0074_knowledge_article_admin_fields.sql` was applied to
  `supplementstack-production`.
- Pages deploy completed:
  - preview `https://39db2d7f.supplementstack.pages.dev`
  - live `https://supplementstack.de`
- Wissensdatenbank now has structured admin fields for:
  - sources as repeated `Name` + `Link` rows, with `sources_json` retained as
    a compatibility mirror/fallback
  - article conclusion
  - optional article image upload/URL
  - dose minimum, maximum, and unit
  - ingredient relation rows through `knowledge_article_ingredients`
  - optional product note
- Public knowledge articles can render the new image, dose details,
  ingredient relations, product note, and conclusion where present.
- Wirkstoff task modals now support inline editing of existing forms,
  synonyms, and precursor notes/order.
- The DGE task modal now supports DGE source add/edit/delete directly and uses
  the existing ingredient research source storage.
- DGE source detection now also recognizes spelled-out Deutsche Gesellschaft
  fuer Ernaehrung variants, not only `dge`/`dge.de`.
- Validation passed:
  - `frontend`: `npx tsc --noEmit`
  - `functions`: `npx tsc -p tsconfig.json --noEmit`
  - `frontend`: `npm run build`
  - `git diff --check` with existing LF/CRLF warnings only
- Remote postflight confirmed no pending migrations and the new
  `knowledge_articles` columns plus `knowledge_article_sources` /
  `knowledge_article_ingredients` tables.
- Preview/live smoke checks passed for `/`, `/administrator/ingredients`,
  `/api/products`, and unauthenticated `/api/admin/knowledge-articles` guard.

### 2026-05-08 Admin QA Consolidated Pass - Remote-Migrated And Deployed

- Remote D1 migration `0073_ingredient_admin_task_status.sql` was applied to
  `supplementstack-production`.
- Pages deploy completed:
  - preview `https://bd3e3f6e.supplementstack.pages.dev`
  - live `https://supplementstack.de`
- Admin dashboard was compacted after the owner reference image:
  - smaller cards/gaps
  - range selector moved into `AdminPageHeader.meta`
  - refresh as compact header icon
- Admin list/filter UI now uses the compact filter-bar pattern across the main
  QA surfaces: Benutzer, Produkte, Wirkstoffe, Richtwerte, Uebersetzungen,
  Matrix, and Shop-Domains.
- Benutzerverwaltung now has:
  - header `XX Benutzer, davon XX aktiv`
  - compact Nutzer/Nutzung/Beitrag columns
  - role/trusted/blocked controls moved into desktop drawer/mobile sheet
  - backend counts for stack items and product link clicks
- Added `/administrator/profile` and made the admin sidebar footer/avatar
  clickable; password change uses the existing `/api/me/password` flow.
- Produkte now has compact operations:
  - main-link quick edit
  - affiliate yes/no
  - moderation status including `blocked`
  - image modal/delete
  - `weitere Links` modal backed by product shop-link CRUD/recheck APIs
- Wirkstoffe now has:
  - `Bearbeitungsstand` badges
  - task status persistence through `ingredient_admin_task_status`
  - lightweight modals for Formen, DGE, Wirkstoffteile, and Synonyme
  - Hauptempfehlung, Alternative 1, Alternative 2 with optional concrete
    `shop_link_id`
  - public ingredient product ordering now prefers recommendation slots.
- Richtwerte, Uebersetzungen, Wechselwirkungs-Matrix, and Shop-Domains were
  compacted/polished per `admin_qa.md`.
- Completed reference PNGs were removed from
  `.agent-memory/deployment_images/`; the folder remains with `.gitkeep`.
- Validation passed:
  - `frontend`: `npx tsc --noEmit`
  - `functions`: `npx tsc -p tsconfig.json --noEmit`
  - `frontend`: `npm run build`
  - `git diff --check` with existing LF/CRLF warnings only
- Preview/live smoke checks passed for core admin routes, `/api/products`,
  unauthenticated admin API guards, and removed Audit-Log API behavior.

### 2026-05-08 Wirkstoff Admin QA Recovery - Local

- Restored the deleted active page
  `frontend/src/pages/administrator/AdministratorIngredientsPage.tsx` from
  `HEAD` and rebuilt it for the owner Wirkstoff-QA requirements.
- `/administrator/ingredients` now shows:
  - header subtitle `XX Wirkstoffe gelistet`
  - compact search/status toolbar with refresh and `Richtwerte` link
  - simplified table without visible ingredient ID/unit/weight details
  - `Bearbeitungsstand` badges for Formen, DGE, Wirkstoffteile, Synonyme,
    Blog/Wissen, and Richtwerte
  - recommendation slots for Hauptempfehlung, Alternative 1, and Alternative 2
- Added modal flows on the page using existing APIs:
  - forms and synonyms display/add/delete plus persistent task status
  - DGE source display plus persistent task status/comment
  - precursors display/add/delete plus persistent task status
  - product recommendation product search and optional shop-link selection
- Reviewed the existing intermediate admin API changes and fixed two scoped
  backend issues:
  - ingredient task status now writes `updated_by_user_id` from `userId`
  - product recommendation delete now checks ingredient existence and slot
    column availability before issuing slot-column SQL
- Validation passed:
  - `frontend`: `npx tsc --noEmit`
  - `functions`: `npx tsc -p tsconfig.json --noEmit`
  - scoped `git diff --check` for the requested files passed with only the
    existing LF/CRLF warnings.

### 2026-05-07 Product Shop-Link Admin API - Deployed

- Added admin CRUD APIs in `functions/api/modules/admin.ts` for catalog
  product shop links:
  - `GET /api/admin/products/:id/shop-links`
  - `POST /api/admin/products/:id/shop-links`
  - `PATCH /api/admin/products/:id/shop-links/:shopLinkId`
  - `DELETE /api/admin/products/:id/shop-links/:shopLinkId`
  - `POST /api/admin/products/:id/shop-links/:shopLinkId/recheck`
- Responses include `product_shop_link_health` data as `health` when the
  table is present.
- Create/update/delete keeps legacy `products.shop_link` and affiliate owner
  fields synced from the active primary/first shop link.
- Manual recheck uses Worker-compatible `fetch` with a 6s abort timeout,
  redirect limit, and basic unsafe-host guards before writing
  `product_shop_link_health`.
- Validation passed:
  - `functions`: `npx tsc -p tsconfig.json --noEmit`
  - `git diff --check -- functions/api/modules/admin.ts` passed with the
    existing LF/CRLF warning only.

### 2026-05-07 Admin Dashboard Visual TODO Polish - Local

- Implemented the remaining `.agent-memory/deployment_images` visual TODOs in
  the active administrator UI:
  - `search_modal.png`: command palette now uses grouped result sections,
    larger search field treatment, result initials, side labels, and a
    keyboard shortcut footer
  - `user_stacks_card.png`: dashboard metric cards now use the softer bordered
    card treatment with larger serif values and warmer secondary copy
  - `was_passiert.png`: Dashboard "Was passiert gerade" now uses a more
    structured activity-feed layout
- Completed reference images were removed:
  - `.agent-memory/deployment_images/search_modal.png`
  - `.agent-memory/deployment_images/user_stacks_card.png`
  - `.agent-memory/deployment_images/was_passiert.png`
- `.agent-memory/deployment_images/` remains in place with `.gitkeep`.
- Validation passed:
  - `frontend`: `npx tsc --noEmit`
  - `frontend`: `npm run lint --if-present`
  - `frontend`: `npm run build`

### 2026-05-07 Admin Operations Core Migration - Remote-Migrated And Deployed

- `.agent-memory/admin_qa.md` was expanded with the agreed implementation plan
  and the latest analytics decision:
  - dashboard uses `Anmeldungen` as the registration metric in the selected
    date range
  - card subtext counts activations where `email_verified_at IS NOT NULL`
  - no separate "Neue Besucher" card is used for signup calls-to-action
- Remote D1 migration `0072_admin_operations_core.sql` was applied to
  `supplementstack-production`.
- Added operational tables for product shop links, shop-link health, product
  link click tracking, and editable legal documents.
- Backfilled `product_shop_links` from legacy `products.shop_link` and kept
  the primary shop link synced from existing product-admin write paths.
- Public catalog product cards now route shop clicks through
  `/api/products/:id/out`, logging minimal first-party click rows without IP or
  User-Agent storage before redirecting.
- Admin dashboard now supports date ranges and shows Benutzer, Link-Klicks,
  Deadlinks, and Anmeldungen with activation subtext.
- Admin products gained moderation/affiliate/image/link-health filters, product
  image delete, and `blocked` moderation status handling.
- User management gained product-submission block/unblock support; blocked
  submitters can still see their own blocked products in stack workflows.
- Added admin legal-document CRUD at `/administrator/legal` with DB storage;
  public legal-page DB reading was completed in the later
  shop-link/legal/audit finalization pass.
- Admin sidebar menu was reduced per owner QA; Audit-Log and other secondary
  admin pages are no longer visible in the main menu.
- Deployed preview: `https://e44d85f2.supplementstack.pages.dev`.
- Live domain: `https://supplementstack.de`.
- Remote postflight confirmed `product_shop_links`, `product_link_clicks`, and
  `legal_documents` are present and populated/backfilled as expected.

### 2026-05-07 Admin Sidebar Density Retune - Deployed

- Applied the new owner-provided `.agent-memory/deployment_images` references:
  - `menu_soll.png`
  - `menu_ist.png`
- Scope was intentionally limited to admin menu typography and spacing, not
  menu content:
  - desktop admin sidebar width reduced from `286px` to `248px`
  - brand logo/name/subtitle scaled down to keep `Supplement Stack` on one
    line
  - nav group, label, item, icon, badge, and active-state spacing reduced
  - active nav outline changed from heavy dark border to a quieter compact
    card treatment
- Completed reference images were removed after implementation:
  - `.agent-memory/deployment_images/menu_soll.png`
  - `.agent-memory/deployment_images/menu_ist.png`
- The `.agent-memory/deployment_images/` folder was intentionally retained for
  future open visual TODO images and now has a `.gitkeep` sentinel.
- Deployed preview: `https://a9e5e4d0.supplementstack.pages.dev`.
- Preview/live route smokes passed for `/administrator/dashboard` and
  `/administrator/interactions`; unauthenticated `/api/interactions` returned
  HTTP 401.

### 2026-05-07 Admin Typography And Interaction Matrix Redesign - Deployed

- Applied the two `.agent-memory/deployment_images` visual references:
  - admin sidebar typography, spacing, palette, logo sizing, and active nav
    style now follow `Schriftarten.png`
  - `/administrator/interactions` now uses a quieter visual matrix inspired by
    `Wechselwirkungs-Matrix.png`, with vertical column labels, compact
    severity cells, count pills, legend, and hover detail
- The interaction create form is now behind the `Hinzufuegen` action instead
  of always occupying the top of the page.
- Reference images were removed after implementation:
  - `.agent-memory/deployment_images/Schriftarten.png`
  - `.agent-memory/deployment_images/Wechselwirkungs-Matrix.png`
- Deployed preview: `https://4f190a86.supplementstack.pages.dev`.
- Preview/live route smokes passed for `/administrator/interactions` and
  `/administrator/user-products`; unauthenticated `/api/interactions` returned
  HTTP 401.

### 2026-05-07 Product Image WebP Normalization - Deployed

- Product image crop/upload now keeps the user flow unchanged but stores
  browser-normalized images:
  - `ImageCropModal` renders the selected crop to 512 x 512 px
  - preferred output is `image/webp` at quality `0.84`
  - browsers without WebP support fall back to JPEG
- Product image upload endpoints now share a central content-type/limit helper:
  - `functions/api/lib/product-images.ts`
  - `/api/admin/products/:id/image`
  - `/api/products/:id/image`
- Upload endpoints still accept JPEG/PNG/WebP for compatibility, but enforce a
  1 MB post-optimization limit and store R2 filenames by actual content type.
- Deployed preview: `https://c07d6e4d.supplementstack.pages.dev`.
- Live route smokes passed for `/administrator/product-qa` and
  `/administrator/products/1`; unauthenticated upload guard returned HTTP 401.

### 2026-05-07 Wirkstoffe/Formen Rebuild - Remote-Migrated And Deployed

- `.agent-memory/wirkstoffe_rebuild.md` was normalized into a concrete
  implementation plan and updated to the current implementation state.
- Implemented the Wirkstoffe/Formen rebuild:
  - normalized ingredient search across canonical names, synonyms, and forms
  - suppression of old ingredient rows that are identifiable as forms under a
    different canonical ingredient
  - optional `matched_form_id` / `matched_form_name` in search results
  - optional `form_id` product filtering for `/api/ingredients/:id/products`
  - `ingredient_precursors` migration and admin CRUD API
  - Stack modal form-selection step before dosage/products
  - Administrator Ingredient Detail `Wirkstoffteile` tab
  - Administrator Ingredients list structure counts for forms, synonyms, and
    precursors
- Current modeling decision:
  - canonical Wirkstoffe remain in `ingredients`
  - forms/derivatives/salts/esters move to `ingredient_forms`
  - spelling variants and abbreviations stay in `ingredient_synonyms`
  - editorial precursor relationships use the `ingredient_precursors` table
  - L-Carnitin is canonical; Acetyl-L-Carnitin is treated as a form/derivative
    of L-Carnitin for search/product structure
- Remote read-only audit was written to
  `_research_raw/ingredient_consolidation_audit.md`.
- Remote D1 migrations applied successfully to `supplementstack-production`:
  - `0069_ingredient_lookup_indexes.sql`
  - `0070_ingredient_precursors.sql`
  - `0071_consolidate_l_carnitine_forms.sql`
- L-Carnitin consolidation is complete in remote D1:
  - old ingredient `60` Acetyl-L-Carnitin -> ingredient `13`, form `155`
  - old ingredient `65` L-Carnitin Tartrat -> ingredient `13`, form `154`
  - old ingredient `66` L-Carnitin Fumarat -> ingredient `13`, form `158`
  - old form `189` was merged into form `155`
  - old product/user-product ingredient, interaction, synonym, display-profile,
    dose, sub-ingredient, and JSON blog references were remapped or removed
    without remaining references to `60`, `65`, `66`, or `189`
- Live API checks passed after deploy:
  - `/api/ingredients/search?q=alcar` returns `13` L-Carnitin with
    `matched_form_id: 155`
  - `/api/ingredients/13/products?form_id=155` uses the new form filter
  - `/administrator/ingredients` and
    `/administrator/ingredients/13?section=precursors` returned HTTP 200

### 2026-05-07 Worktree Cleanup - Local

- Removed local-only artifacts:
  - `admin-preview/`
  - root `logo.png` duplicate; canonical logo remains
    `frontend/public/logo.png`
  - `qa-preview-demo-bottombar-no-cookie.png`
- Replaced large temporary admin analysis/plan dumps with compact
  `.agent-memory/admin-rebuild-plan.md`.
- Removed legacy `.claude/SESSION.md` deploy logging and
  `.claude/hooks/post-deploy-log.sh`.
- `.agent-memory/deploy-log.md` is the canonical deploy/migration log.
- Added ignore rules for local design/browser-QA artifacts and Claude
  deploy-error logs.
- Removed the old frontend `/admin` compatibility redirect and related admin
  status copy.
- Active code search found no remaining imports or active code references to
  the deleted old frontend admin monolith. False-positive references to
  `AdminPageHeader` are from the new `AdminUi` helper.

### 2026-05-07 Admin Browser-QA Text/UX Cleanup - Deployed

- Productive admin copy was cleaned up: development notes removed, touched UI
  text normalized to clear German, and raw enum/status labels mapped to German
  display labels.
- Translation maintenance no longer offers German as a target language; German
  remains the source language.
- `Linkmeldungen` search input spacing was fixed.
- `Produktprüfung` now has clearer labels, row-level image upload, and German
  comma decimal handling in touched fields.
- `Wechselwirkungen` now has visible German field/filter labels and German
  severity/type labels.
- Touched stack/product entry surfaces use German comma notation for decimal
  numbers and Euro amounts.
- Validation passed before deploy:
  - `frontend`: `npx tsc --noEmit`
  - `frontend`: `npm run lint --if-present`
  - `frontend`: `npm run build`
  - `node --check scripts/admin-browser-smoke.mjs`
  - Wrangler Pages deploy compiled Functions successfully.
- Preview/live smokes passed before the later route cleanup for `/administrator`,
  `/administrator/product-qa`, `/administrator/interactions`,
  `/administrator/translations`, `/admin`, and unauthenticated admin API guard
  checks.

### 2026-05-07 Ingredient Research Coverage List - Deployed

- `/administrator/ingredients` is now the operational ingredient research
  coverage checklist.
- The admin ingredients API returns coverage counts for sources, official/DGE
  sources, studies, NRV/UL rows, dose recommendations, dose-source links,
  display profiles, warnings/knowledge, and blog URLs.
- The list shows automatic badges for Blog/Wissen, DGE, official sources,
  studies, NRV/UL, Dosing, Dosis-Quellen, and display profile.
- Validation passed before deploy:
  - `functions`: `npx tsc -p tsconfig.json --noEmit`
  - `frontend`: `npx tsc --noEmit`
  - `frontend`: `npm run lint --if-present`
  - `frontend`: `npm run build`
  - remote D1 read-only coverage query
  - remote D1 migration list reported no pending migrations
  - preview/live route and unauthenticated API guard smokes.

### 2026-05-07 Admin QA Shop-Link/Legal/Audit Finalization - Deployed

- Product Detail `Shop-Link` now uses the multi-shop-link editor backed by
  `product_shop_links`.
- Admins can create, edit, delete, activate/deactivate, sort, mark primary,
  assign owner type, and manually recheck product shop links.
- Primary/first active shop links continue to mirror into the legacy
  `products.shop_link` and affiliate owner columns for compatibility.
- Public legal pages now read published documents from
  `/api/legal-documents/:slug` and fall back to the static legal copy when no
  published DB document exists.
- The visible Audit-Log admin route/page/API was removed. Internal audit rows
  remain available to product-detail data where existing code still reads them,
  but there is no active `/administrator/audit-log` route or
  `/api/admin/audit-log` endpoint.
- Completed visual TODO images were deleted; `.agent-memory/deployment_images/`
  remains with `.gitkeep`.

## Validation Status

- Cleanup validation passed before commit `cec3f89`:
  - `functions`: `npx tsc -p tsconfig.json --noEmit`
  - `frontend`: `npx tsc --noEmit`
  - `frontend`: `npm run lint --if-present`
  - `frontend`: `npm run build`
  - `node --check scripts/admin-browser-smoke.mjs`
  - `node --check scripts/user-browser-smoke.mjs`
  - `git diff --check`
- Current Wirkstoffe/Formen validation passed before remote deploy:
  - `functions`: `npx tsc -p tsconfig.json --noEmit`
  - `frontend`: `npx tsc --noEmit`
  - `frontend`: `npm run lint --if-present`
  - `frontend`: `npm run build`
  - `node --check scripts/admin-browser-smoke.mjs`
  - `node --check scripts/user-browser-smoke.mjs`
  - `git diff --check`
- Additional validation after the final ALCAR search-ranking patch passed:
  - `functions`: `npx tsc -p tsconfig.json --noEmit`
  - `frontend`: `npm run build`
  - `git diff --check`
- Product image WebP normalization validation passed:
  - `functions`: `npx tsc -p tsconfig.json --noEmit`
  - `frontend`: `npx tsc --noEmit`
  - `frontend`: `npm run lint --if-present`
  - `frontend`: `npm run build`
  - `node --check scripts/admin-browser-smoke.mjs`
  - `node --check scripts/user-browser-smoke.mjs`
  - `git diff --check`
- Admin typography/matrix redesign validation passed:
  - `frontend`: `npx tsc --noEmit`
  - `frontend`: `npm run lint --if-present`
  - `frontend`: `npm run build`
  - `node --check scripts/admin-browser-smoke.mjs`
- Admin sidebar density retune validation passed:
  - `frontend`: `npx tsc --noEmit`
  - `frontend`: `npm run lint --if-present`
  - `frontend`: `npm run build`
  - `node --check scripts/admin-browser-smoke.mjs`
  - `git diff --check` passed with existing LF/CRLF warnings only.
- Admin operations core migration validation passed:
  - `functions`: `npx tsc -p tsconfig.json --noEmit`
  - `frontend`: `npx tsc --noEmit`
  - `frontend`: `npm run build`
  - `git diff --check` passed with existing LF/CRLF warnings only.
  - Remote D1 migration `0072_admin_operations_core.sql` applied successfully.
  - Preview/live `/api/products` returned HTTP 200.
  - Preview/live unauthenticated `/api/admin/stats` returned HTTP 401.
  - Remote D1 postflight counted shop-link, click, and legal-document tables.
- Admin QA shop-link/legal/audit finalization validation passed:
  - `functions`: `npx tsc -p tsconfig.json --noEmit`
  - `frontend`: `npx tsc --noEmit`
  - `frontend`: `npm run build`
  - `git diff --check` passed with existing LF/CRLF warnings only.
  - Remote D1 migration list reported no pending migrations.
  - Remote D1 postflight confirmed latest migration `0072_admin_operations_core.sql`,
    `33` products, and `13` product shop links.
  - Pages deployed preview `https://417e6dc4.supplementstack.pages.dev`;
    live `https://supplementstack.de` smoke checks passed.
  - Preview/live `/api/products` returned HTTP 200.
  - Preview/live unauthenticated `/api/admin/stats` and
    `/api/admin/products/1/shop-links` returned HTTP 401.
  - Preview/live `/api/legal-documents/impressum` returned HTTP 404 when no
    published DB document exists; public static fallback pages for Impressum,
    Datenschutz, and Nutzungsbedingungen returned HTTP 200.
  - Preview/live `/api/admin/audit-log` returned HTTP 404.
- Remote D1 postflight passed:
  - no old references to ingredient IDs `60`, `65`, or `66`
  - no old form `189`
  - no ingredient/form parent mismatches in user product ingredients
  - no ingredient self-interactions
  - no duplicate normalized synonyms under ingredient `13`
  - `PRAGMA foreign_key_check` returned no rows
- Local D1 migration apply is blocked before the new migrations by an old local
  schema/journal mismatch at `0009_auth_profile_extensions.sql`
  (`no such column: google_id`). Remote D1 migration and postflight worked.
- Authenticated owner browser QA remains the final acceptance gate for the new
  admin/user workflows.

## 2026-05-11 - Website UX Fixes Preview

- Website UX fixes for the stack/demo surface are implemented on branch
  `codex/website-ux-fixes` and deployed to the Pages preview alias
  `https://codex-website-ux-fixes.supplementstack.pages.dev`.
- Demo now renders inside the shared public `Layout` header instead of the
  standalone StackWorkspace header.
- Demo mail/PDF actions no longer show a static unavailable text; buttons stay
  visible and expose a registration tooltip/click notice.
- Product removal from a stack now uses an in-app confirmation dialog.
- Product list cards were compacted; warnings now show a short `Achtung`
  summary with detail available through the info affordance.
- Product selection now offers an own-product CTA; demo users get a register
  modal, authenticated users are linked to `/my-products`.
- Duplicate Wirkstoff selection is intercepted before dosage selection and
  offers edit amount, change product, leave unchanged, or deliberately add a
  second product with the same Wirkstoff.
- Stack create/edit modals now own family/profile assignment; the cockpit no
  longer renders profile management or the routine clock.
- New protected routes were added:
  - `/family` for family member management and local main-stack selection.
  - `/routine` for a first standalone Einnahmeplan overview with print action.
- Demo stacks are persisted in localStorage and imported into real stacks after
  successful registration when possible.
- Verification passed:
  - `frontend`: `npx tsc --noEmit`
  - `frontend`: `npm run lint`
  - `frontend`: `npm test -- --run`
  - `frontend`: `npm run build`
  - Browser smoke on local Vite: `/demo` shared header, demo mail tooltip,
    protected `/family` login redirect. Local demo products stayed empty
    because the pure Vite dev server does not serve `/api/demo/products`.

### 2026-05-11 Website UX QA Gaps - Preview Follow-Up

- Fixed the remaining QA UX gaps and deployed them to the
  `codex-website-ux-fixes` Pages preview.
- Add-product duplicate Wirkstoff checks now follow the selected target stack:
  - target stack selection appears before ingredient search
  - changing the target stack after choosing an ingredient re-runs the duplicate
    check
  - continuing from dosage re-checks the current target stack before products
- Short product warnings in card and list view now open click/touch in-app
  detail popovers instead of relying on `title`/hover text.
- Demo `Stack mailen` and `Plan drucken/PDF` now open an in-app account CTA
  modal instead of native `window.alert`.
- List view now renders a compact add-product row at the end, matching the
  grid view plus tile affordance.
- Demo stack carryover now uses the shared `stackFlow` snapshot/transfer helper
  and imports empty demo stacks with `product_ids: []` when the API accepts the
  create call.
- Added `scripts/user-ux-regression-check.mjs` plus stackFlow coverage for
  empty demo stack transfer.
- Verification passed:
  - `node scripts/user-ux-regression-check.mjs`
  - `node --check scripts/user-ux-regression-check.mjs`
  - `frontend`: `npx tsc --noEmit`
  - `frontend`: `npm test -- --run src/lib/stackFlow.test.ts`
  - `frontend`: `npm test -- --run`
  - `frontend`: `npm run lint --if-present`
  - `frontend`: `npm run build`
  - `git diff --check` passed with existing LF/CRLF warnings only.
- Preview browser smoke confirmed the demo shared header, account CTA modal,
  list-view add row, and product delete confirmation. Authenticated admin
  preview QA still requires a preview-domain login session.

## Known Remaining Work

- Later simplify the normal product-add flow: do not force a separate form
  selection step before product selection. Keep forms for DB/product matching,
  but expose them as an optional product-list filter defaulting to `Alle`.
- Final authenticated owner browser QA:
  - Admin dashboard range cards, especially `Anmeldungen` and activation
    subtext
  - Admin products filters, blocked status, product image delete, and redirect
    click tracking
  - User-management blocked-submitter toggle
  - Legal-document editor save flow
  - login/session persistence
  - stack create/edit/product add/remove/replacement
  - stack form selection for ingredients with forms
  - user product submit
  - Product Detail overview/moderation/shop-link/Wirkstoffe/image flows
  - Product-QA harmless save
  - Product Detail and Product-QA image upload with WebP normalization
  - product warnings
  - Dosing source links
  - Interaction edit/delete
  - Ingredient Research source/warning and NRV CRUD
  - one stale-version `409` check
- Continue ingredient-by-ingredient research and copywriting data entry through
  `/administrator/ingredients`.
- Content/science/legal review remains before SEO indexing/go-live confidence.
- External inbox mail tests remain before launch confidence.
- No open `.agent-memory/deployment_images` PNG visual TODOs remain; keep the
  folder and `.gitkeep` for future owner reference images.
- Authenticated owner browser QA remains open for the new admin flows.

## 2026-05-11 Admin Knowledge/Users Deep-Link Filters - Preview

- Admin deep-link filter fix implemented and deployed to the
  `codex-website-ux-fixes` Pages preview.
- `/administrator/knowledge` now initializes `q` and `status` from URL search
  params and keeps the URL in sync when those filters change. This fixes
  dashboard links such as `/administrator/knowledge?status=draft`.
- `/administrator/users` now initializes `q`, `trusted`, and `blocked` from URL
  search params and updates the URL when filters are applied, cleared, or set
  from the summary cards.
- Added a static guard to `scripts/user-ux-regression-check.mjs` that ensures
  `AdministratorKnowledgePage` uses `useSearchParams` and initializes `status`
  from the URL.
- Verification passed:
  - `node scripts/user-ux-regression-check.mjs`
  - `frontend`: `npx tsc --noEmit`

## 2026-05-11 Demo Stack UI Polish - Local

- Implemented the current demo/stack UI polish locally on
  `codex/website-ux-fixes`; not deployed yet.
- Stack/Demo visible copy in `StackWorkspace.tsx` was normalized from
  mojibake and ASCII transliterations to proper German umlauts, including
  `Produkt hinzufügen`, `Stack löschen`, `Übersicht`, `verfügbar`,
  `Änderungen`, Euro signs, and close/delete labels.
- Grid add-product tile now has its own `masonry-add-tile` styling: same
  column width as product tiles, lower height than normal product cards.
- List-view product cards now use a compact scan layout:
  Wirkstoff + timing in the header, product name and dosage below, ingredient
  amount parentheses stripped from list dosage, Kosten/Reicht-für in one
  column, and buy/edit/delete actions arranged as one wide buy row plus two
  narrow icon buttons.
- `scripts/user-ux-regression-check.mjs` now guards the new layout/copy
  requirements and fails on mojibake in the public stack/demo components.
- Verification passed:
  - TDD red: `node scripts/user-ux-regression-check.mjs` failed before
    implementation with `StackWorkspace.tsx must not contain mojibake on
    public stack/demo screens`.
  - `node scripts/user-ux-regression-check.mjs`
  - `node --check scripts/user-ux-regression-check.mjs`
  - `frontend`: `npx tsc --noEmit`
  - `frontend`: `npm run lint --if-present`
  - `frontend`: `npm test -- --run`
  - `frontend`: `npm run build`
- Browser visual smoke was not run in this Codex session because the Browser
  plugin did not expose a usable navigate/screenshot tool through
  `tool_search`; preview/local browser QA remains useful before deploy.

## 2026-05-11 Demo Stack UI Polish - Preview Deployed

- Demo/stack UI polish is deployed to the Pages branch alias:
  `https://codex-website-ux-fixes.supplementstack.pages.dev`.
- Public stack/demo surfaces now have normalized German umlauts and Euro signs
  in `StackWorkspace.tsx` and `ProductCard.tsx`; browser smoke confirmed no
  mojibake in `/demo`.
- Toolbar updates:
  - `Stack erstellen` moved into the stack dropdown as the last option.
  - Stack edit/mail/PDF/delete are icon-only accessible buttons.
  - Delete icon sits before a vertical divider, followed by the green
    `Produkt hinzufügen` button.
- Demo banner copy now says the demo stack resets on reload and points to free
  signup for permanent storage.
- Header now includes a public `Studien & mehr` nav item backed by `/wissen`
  and a simple knowledge index page.
- List view product images/placeholders are larger (`58px`), and list dosage
  remains compact without ingredient amount parentheses.
- Verification passed:
  - `node scripts/user-ux-regression-check.mjs`
  - `frontend`: `npx tsc --noEmit`
  - `frontend`: `npm run lint --if-present`
  - `frontend`: `npm test -- --run`
  - `frontend`: `npm run build`
  - `git diff --check` with CRLF warnings only
  - Playwright browser smoke on `/demo` and `/wissen`

## 2026-05-11 Website UX Review Follow-Ups - Preview Deployed

- Implemented and deployed the owner review follow-ups to the
  `codex-website-ux-fixes` Pages preview.
- Stack toolbar now has distinct icon backgrounds for mail/PDF, plus new
  JSON share and JSON import actions with in-app modals.
- Product cards place `Link melden` as the leftmost grid action.
- Demo banner now says `um deinen Stack dauerhaft zu speichern`.
- Product section title is shortened to `Übersicht`.
- Demo product cards are draggable for manual ordering; the green add tile/row
  remains fixed at the end. Authenticated reorder persists through the existing
  stack update flow.
- List cards vertically center their columns and the list add row now only says
  `Produkt hinzufügen`.
- `/wissen` now has the approved headline/copy, search field, keyword-backed
  filtering, tag cloud, masonry-style feature cards, a remaining-entry list, and
  a source-interpretation disclaimer.
- Schwarzkümmelöl product metadata was corrected through D1 migration
  `0075_fix_black_seed_oil_volume.sql`: 500 ml bottle, 40 ml daily dose, ml
  calculation support in frontend and backend.
- Remote D1 migration `0075_fix_black_seed_oil_volume.sql` was applied to
  `supplementstack-production`.
- Latest preview deploy:
  `https://59a52a7d.supplementstack.pages.dev`, alias
  `https://codex-website-ux-fixes.supplementstack.pages.dev`.
- Verification passed:
  - `node scripts/user-ux-regression-check.mjs`
  - `frontend`: `npx tsc --noEmit`
  - `functions`: `npx tsc -p tsconfig.json --noEmit`
  - `frontend`: `npm run lint --if-present`
  - `frontend`: `npm test -- --run`
  - `frontend`: `npm run build`
  - `git diff --check` with CRLF warnings only
  - Playwright preview smoke confirmed `/demo` and `/wissen`, including
    no mojibake, drag affordance count, share/import modals, and
    Schwarzkümmelöl now showing `40 ml täglich`, `12 Tage`, `28,48 €/Mo`.
