# Handoff

Last updated: 2026-05-08

## Exact Continuation Point

Admin post-launch dashboard and human admin-copy pass is deployed:

- Preview: `https://89b9f726.supplementstack.pages.dev`
- Live: `https://supplementstack.de`
- No new D1 migration was required for this pass.
- Dashboard is now built for post-launch operation, not pre-launch QA:
  `Heute zu tun`, range-aware KPIs, `Umsatzsignale`, catalog/content modules,
  and recent operator activity.
- `/api/admin/stats` returns current/previous values, trend metadata, top
  products, top shops, affiliate/non-affiliate click signals, open link
  reports, deadlink counts, and link-potential counts.
- Admin page subtitles were rewritten from a human/operator perspective across
  the visible admin pages; remaining obvious ASCII-only German copy remnants in
  admin pages were cleaned up.
- Validation passed:
  - `frontend`: `npx tsc --noEmit`
  - `functions`: `npx tsc -p tsconfig.json --noEmit`
  - `frontend`: `npm run build`
  - `git diff --check` with existing LF/CRLF warnings only
- Smoke checks passed:
  - Preview/live `/`, `/administrator/dashboard`, and `/api/products` returned
    HTTP 200.
  - Preview/live served the new assets `index-vSLb5La9.js` and
    `index-C0Tt9RG_.css`.
  - Preview/live unauthenticated `/api/admin/stats` and
    `/api/admin/ops-dashboard` returned HTTP 401.
- Authenticated browser QA is still open because no admin session or
  credentials are available in this environment.

Previous Knowledge/Wirkstoff implementation details:

- Wissensdatenbank admin now stores sources in
  `knowledge_article_sources` (`Name` + `Link`) and mirrors them into
  `sources_json` for compatibility/fallback.
- Wissensdatenbank also supports conclusion, article image upload, dose
  min/max/unit, ingredient assignments through `knowledge_article_ingredients`,
  and optional product note.
- Public knowledge articles can render the new image/dose/ingredient/product
  note/conclusion fields.
- Wirkstoff task modals now support inline edit for existing forms, synonyms,
  precursor notes/order, and DGE source add/edit/delete.
- Recommendation modal can select a concrete `shop_link_id` when product shop
  links are available; if not, it saves the product slot without one.

Previous deployed admin QA context remains below.

Admin QA shop-link/legal/audit finalization is implemented and deployed:

- Preview: `https://417e6dc4.supplementstack.pages.dev`
- Live: `https://supplementstack.de`
- Product Detail `Shop-Link` tab now uses the multi-shop-link editor:
  - `GET /api/admin/products/:id/shop-links`
  - `POST /api/admin/products/:id/shop-links`
  - `PATCH /api/admin/products/:id/shop-links/:shopLinkId`
  - `DELETE /api/admin/products/:id/shop-links/:shopLinkId`
  - `POST /api/admin/products/:id/shop-links/:shopLinkId/recheck`
- Shop-link CRUD syncs the active primary/first link back into legacy
  `products.shop_link`, `is_affiliate`, and affiliate owner columns.
- Public legal pages read published DB documents via
  `/api/legal-documents/:slug` and keep the static fallback when no published
  DB document exists.
- Visible Audit-Log UI/API was removed:
  - `frontend/src/pages/administrator/AdministratorAuditLogPage.tsx` deleted.
  - `/administrator/audit-log` no longer has a React route and falls through to
    the admin catch-all redirect.
  - `/api/admin/audit-log` returns HTTP 404.
- `.agent-memory/deployment_images/` is intentionally retained with `.gitkeep`;
  all completed reference PNGs are deleted.
- Validation passed:
  - `functions`: `npx tsc -p tsconfig.json --noEmit`
  - `frontend`: `npx tsc --noEmit`
  - `frontend`: `npm run build`
  - `git diff --check` with LF/CRLF warnings only
  - remote D1 migration list reported no pending migrations
  - remote D1 postflight confirmed latest migration `0072`, products, and
    product shop links
  - preview/live `/api/products` HTTP 200
  - preview/live unauthenticated `/api/admin/stats` and
    `/api/admin/products/1/shop-links` HTTP 401
  - preview/live public legal pages HTTP 200 with DB fallback behavior checked

Older completed work is kept below for context.

Admin dashboard/command-palette visual TODO polish is complete locally:

- Implemented `.agent-memory/deployment_images/search_modal.png` in
  `frontend/src/pages/administrator/AdministratorCommandPalette.tsx` and
  `frontend/src/pages/administrator/admin.css` with grouped command results,
  result initials, larger modal spacing, and a keyboard footer.
- Implemented `.agent-memory/deployment_images/user_stacks_card.png` in the
  shared dashboard metric card styling in
  `frontend/src/pages/administrator/admin.css`.
- Implemented `.agent-memory/deployment_images/was_passiert.png` in
  `frontend/src/pages/administrator/AdministratorDashboardPage.tsx` and
  `frontend/src/pages/administrator/admin.css` with a structured activity-feed
  card.
- Deleted the three completed reference PNGs and kept
  `.agent-memory/deployment_images/.gitkeep`.
- Validation passed:
  - `frontend`: `npx tsc --noEmit`
  - `frontend`: `npm run lint --if-present`
  - `frontend`: `npm run build`
- No backend files were touched for this visual task.

Admin operations core migration is implemented, remote-migrated, deployed, and
postflight-checked:

- Preview: `https://e44d85f2.supplementstack.pages.dev`
- Live: `https://supplementstack.de`
- `.agent-memory/admin_qa.md` now contains the agreed implementation plan and
  latest analytics rule:
  - `Anmeldungen` counts registrations in the selected date range
  - the card subtext counts activations where `email_verified_at IS NOT NULL`
  - no separate "Neue Besucher" signup-callout card should be added
- Remote D1 migration `0072_admin_operations_core.sql` is applied to
  `supplementstack-production`.
- New/updated data model:
  - `product_shop_links`
  - `product_shop_link_health`
  - `product_link_clicks`
  - `legal_documents`
  - blocked product submitter columns on `users`
  - shop-link slot columns on `product_recommendations`
- Public catalog products now use `/api/products/:id/out` for shop redirects
  and minimal first-party click tracking. IP and User-Agent are not stored.
- Admin dashboard now has range-aware stats and the agreed
  `Anmeldungen`/activation card.
- Admin products now support moderation, affiliate, image, and link-health
  filters; `blocked` moderation status; and product image delete.
- Admin user management now supports blocking/unblocking future product
  submissions. Blocked submitters can still see their own blocked products in
  stack flows.
- `/administrator/legal` exists for admin legal-document editing backed by
  `legal_documents`; public legal-page DB reading was completed in the later
  shop-link/legal/audit finalization pass.
- The visible admin sidebar menu is reduced to the owner-approved primary
  areas; secondary/legacy pages may still exist by direct route.
- Validation passed:
  - `functions`: `npx tsc -p tsconfig.json --noEmit`
  - `frontend`: `npx tsc --noEmit`
  - `frontend`: `npm run build`
  - `git diff --check` with existing LF/CRLF warnings only
- Remote postflight:
  - D1 table counts returned `product_shop_links`, `product_link_clicks`, and
    `legal_documents` as expected after migration/backfill.
- Smoke checks:
  - Preview/live `/api/products` returned HTTP 200.
  - Preview/live unauthenticated `/api/admin/stats` returned HTTP 401.
- Authenticated admin/browser QA was not run because no admin session or
  credentials were available in the local environment.

Admin sidebar density retune is implemented and deployed:

- Preview: `https://a9e5e4d0.supplementstack.pages.dev`
- Live: `https://supplementstack.de`
- The new `menu_soll.png` / `menu_ist.png` references were applied only to
  admin menu typography and spacing; menu items were not changed.
- Desktop sidebar width, brand sizing, nav row height, icon size, group gaps,
  badges, and active-state border/shadow were compacted so the full menu fits
  much closer to the owner reference.
- Completed images were deleted:
  - `.agent-memory/deployment_images/menu_soll.png`
  - `.agent-memory/deployment_images/menu_ist.png`
- `.agent-memory/deployment_images/` still exists and should be retained for
  future open visual TODO images. It has a `.gitkeep` sentinel; delete
  completed images only, not the folder.
- Validation passed: frontend typecheck, frontend lint, frontend build,
  admin smoke-script syntax, and `git diff --check` with existing LF/CRLF
  warnings only.
- Preview/live `/administrator/dashboard` and
  `/administrator/interactions` returned HTTP 200.
- Preview/live unauthenticated `/api/interactions` returned HTTP 401.

Admin typography and Wechselwirkungs-Matrix redesign is implemented and
deployed:

- Preview: `https://4f190a86.supplementstack.pages.dev`
- Live: `https://supplementstack.de`
- The admin sidebar follows the `Schriftarten.png` typography/color reference.
- `/administrator/interactions` follows the `Wechselwirkungs-Matrix.png`
  reference with a primary visual grid, count pills, legend, and hover detail.
- The create form opens from `Hinzufuegen`.
- The completed reference images from that pass were deleted. The
  `.agent-memory/deployment_images/` folder was later recreated and should be
  retained.
- Validation passed: frontend typecheck, frontend lint, frontend build, and
  admin smoke-script syntax.
- Preview/live `/administrator/interactions` and
  `/administrator/user-products` returned HTTP 200.
- Preview/live unauthenticated `/api/interactions` returned HTTP 401.

Product image WebP normalization is implemented and deployed:

- Preview: `https://c07d6e4d.supplementstack.pages.dev`
- Live: `https://supplementstack.de`
- `ImageCropModal` exports 512 x 512 px WebP at quality `0.84`.
- JPEG fallback is automatic if a browser cannot export WebP.
- `/api/admin/products/:id/image` and `/api/products/:id/image` share
  `functions/api/lib/product-images.ts`.
- Upload routes enforce a 1 MB post-optimization limit and store R2 filenames
  by actual uploaded content type.
- Validation passed: functions typecheck, frontend typecheck, frontend lint,
  frontend build, smoke script syntax checks, and `git diff --check`.
- Preview/live `/administrator/product-qa` and `/administrator/products/1`
  returned HTTP 200.
- Preview/live unauthenticated `POST /api/admin/products/1/image` returned
  HTTP 401.

The Wirkstoffe/Formen rebuild has been implemented, remote-migrated, deployed,
and postflight-checked.

Remote D1 `supplementstack-production` has these migrations applied:

- `0069_ingredient_lookup_indexes.sql`
- `0070_ingredient_precursors.sql`
- `0071_consolidate_l_carnitine_forms.sql`

Latest deployed preview:

- `https://a9e5e4d0.supplementstack.pages.dev`
- Live domain: `https://supplementstack.de`

## What Changed

- Ingredient search is now canonical-Wirkstoff centered and can return optional
  `matched_form_id` / `matched_form_name`.
- `/api/ingredients/:id/products` accepts optional `form_id` filtering.
- `ingredient_precursors` exists for editorial precursor relationships, with
  admin CRUD under `/api/admin/ingredients/:id/precursors`.
- Stack add flow now has an optional form-selection step before dosage/products.
- Administrator Ingredient Detail has a `Wirkstoffteile` tab.
- Administrator Ingredients list shows counts for forms, synonyms, and
  precursors.
- L-Carnitin is canonical ingredient `13`.
- Old ingredient `60` Acetyl-L-Carnitin was consolidated into form `155`.
- Old ingredient `65` L-Carnitin Tartrat was consolidated into form `154`.
- Old ingredient `66` L-Carnitin Fumarat was consolidated into form `158`.
- Old form `189` was merged into form `155`.

## Verification Already Done

- `functions`: `npx tsc -p tsconfig.json --noEmit`
- `frontend`: `npx tsc --noEmit`
- `frontend`: `npm run lint --if-present`
- `frontend`: `npm run build`
- `node --check scripts/admin-browser-smoke.mjs`
- `node --check scripts/user-browser-smoke.mjs`
- `git diff --check`
- Remote D1 postflight:
  - no references to old ingredient IDs `60`, `65`, or `66`
  - no old form `189`
  - no ingredient/form parent mismatches in user product ingredients
  - no ingredient self-interactions
  - no duplicate normalized synonyms under ingredient `13`
  - `PRAGMA foreign_key_check` returned no rows
- Live and preview `/api/ingredients/search?q=alcar` return L-Carnitin with
  `matched_form_id: 155`.
- Live and preview `/api/ingredients/13/products?form_id=155` exercise the
  product form filter.
- Live `/administrator/ingredients` and
  `/administrator/ingredients/13?section=precursors` return HTTP 200.
- Unauthenticated `/api/admin/ingredients/13/precursors` returns HTTP 401.

## Remaining Work

- Authenticated owner browser QA remains open:
  - redesigned Wechselwirkungs-Matrix and admin sidebar visual QA
  - login/session persistence
  - stack create/edit/product add/remove/replacement
  - stack form selection for Wirkstoffe with forms
  - user product submit with ingredient/form rows
  - Product Detail/Product-QA image upload and `.webp` R2 URL confirmation
  - Product Detail overview/moderation/affiliate/Wirkstoffe/image flows
  - Product-QA harmless save
  - product warnings
  - Dosing source links
  - Interaction edit/delete
  - Ingredient Research source/warning and NRV CRUD
  - one stale-version `409` check
- If local D1 migration apply is needed, fix/reset the old local
  `0009_auth_profile_extensions.sql` journal/schema mismatch first
  (`no such column: google_id`).
- Continue ingredient-by-ingredient research/copywriting through
  `/administrator/ingredients`.
- External inbox mail tests and content/science/legal review remain launch
  gates.

## Required Startup For Next Agent

1. Read `AGENTS.md`.
2. Read `CLAUDE.md`.
3. Read `.agent-memory/current-state.md`.
4. Read this handoff.
5. Read `.agent-memory/next-steps.md`.
6. Run `git status --short`.

## Constraints

- Do not write secrets, tokens, passwords, or raw credential values into memory
  files.
- Use code and migrations as final source of truth if docs conflict.
- Keep `/administrator` as the frontend admin path and `/api/admin` as the
  backend admin namespace.
- Keep implementation compatible with Cloudflare Workers / Pages Functions.
- Review untracked files before deleting or committing them.
