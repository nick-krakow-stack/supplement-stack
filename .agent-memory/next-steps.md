# Next Steps

Last updated: 2026-05-11

## Hook Maintenance

- Codex/Claude hook files are centralized under `.codex/hooks/` and should stay
  PowerShell-based for Windows Codex App compatibility.
- Do not reintroduce Bash-only hooks unless the Windows Codex environment is
  explicitly changed to provide `bash`.
- Hook failure logs are written to `.agent-memory/deploy-errors.log`, which is
  ignored as local runtime output.
- Do not wire `update-agent-handoff.ps1` back into every `PostToolUse` shell
  command; it makes `.agent-memory/handoff.md` dirty after normal commands.
  Keep handoff updates on PreCompact/manual/session-end paths.

## Immediate

- Default deployment target from now on: after verified changes, deploy directly
  to Cloudflare Pages production under `https://supplementstack.de`, unless the
  owner explicitly asks for preview-only.
- Phase 1 referral attribution is implemented and deployed to production:
  - observed external/search referrers are tracked in `page_view_events`
  - registrations can be attributed through `signup_attribution`
  - the admin dashboard shows `Quellen & Anmeldungen`
  - history starts from remote migration `0077_signup_referral_attribution.sql`
- Do not add backlink crawler complexity yet. Revisit Google Search Console API
  or a paid backlink provider only if source attribution starts driving enough
  affiliate revenue to justify the extra setup/maintenance.
- Admin dashboard owner comments are implemented and deployed to production.
  Next useful QA:
  - open `https://supplementstack.de/administrator/dashboard` with an
    authenticated admin session.
  - confirm the new cards `Neuanmeldungen`, `Neue Stacks`, `Backlinks`, and
    `Abmeldungen`.
  - confirm the new `Quellen & Anmeldungen` module after real referrer/signup
    data accumulates.
  - confirm dashboard links for `User-Partnerlink`, `Linkmeldungen`,
    `offene Freigaben`, and `Wirkstoffe ohne Artikel`.
  - Decide whether the current app-measured `Backlinks` metric is sufficient or
    whether a real external backlink source should be integrated later.
- The new dashboard metrics only have history from 2026-05-11 onward:
  stack emails, account deletions, last-seen activity, referrer events, and
  Google pageviews were not tracked before migration `0076`.
- Admin knowledge/users deep-link filter fix is implemented and deployed to
  the `codex-website-ux-fixes` preview. It still needs authenticated
  preview/live smoke with an admin session:
  - `/administrator/knowledge?status=draft` should show draft knowledge
    articles, not published ones.
  - `/administrator/users?q=...&trusted=true&blocked=false` should initialize
    the visible filters and API request from the URL.
- User UX follow-ups from the authenticated Tobias QA are implemented locally
  and still need final deploy/live owner QA:
  - family/profile assignment lives in `Stack anlegen` / `Stack bearbeiten`
  - `Produkt bearbeiten` -> `Produkt wechseln` preserves ingredient, dose, and
    form context and opens product selection directly where possible
  - `/profile` uses a responsive desktop layout
  - stack product list mode is compact and scan-friendly
  - own-product flow has clearer missing-product and label-entry guidance
  - stack delete uses an in-app confirmation dialog
  - DGE vs. study values and product ordering are explained in the add flow
- Before deployment, do one final local/source review of the changed user
  screens and confirm the known Vitest `spawn EPERM` issue is not a code
  regression.
- After deployment, run live authenticated owner QA for:
  - stack create/edit with family/profile assignment
  - product replacement preserving Wirkstoff/dose context
  - product list compact mode with real products
  - `/profile` desktop layout
  - own-product create/edit guidance
  - stack delete confirmation
- Tobias QA landing/demo updates are implemented, merged, deployed, and
  browser-verified:
  - commit `74cc5bd`, PR `#4`, merge `9c67ed7`
  - preview `https://71809f56.supplementstack.pages.dev`
  - live `https://supplementstack.de`
  - homepage hero now uses `Wissenschaftlich. Einfach. Kostenlos.`
  - product-add flow no longer forces a separate form-selection step
  - forms remain available as an optional product-list filter defaulting to
    `Alle Formen`
- Use `.agent-memory/browser-qa-persona.md` as the standard Tobias human
  Browser-QA persona. Commit `b694b4c` added the persona memory.
- First Tobias QA covered landing page, `/demo`, and Vitamin D/D3:
  landing page explains free/no-signup well; `/demo` is directly usable; D3
  search works; the former forced form-selection step was too cognitively
  heavy for normal users and is now removed.
- Admin browser QA found two production-visible admin dosing bugs and both are
  fixed and deployed:
  - `/administrator/dosing` now shows unpublished production dosing rows in the
    admin maintenance list again (`2ffeec6`).
  - `/administrator/dosing?ingredient_id=3&q=Magnesium` now initializes the
    filter state from URL params and renders the filtered Magnesium list
    (`5733d8f`, production deployment `5a0b8826`).
- Read-only authenticated admin QA covered dashboard, products, product detail
  shop-link edit/recheck, ingredients/forms modal, users drawer, user-products
  moderation queue, dosing deep-links, shop domains, legal, profile, command
  palette, and selected mobile layouts.
- Remaining authenticated QA that changes data should be run deliberately on
  known test objects:
  - product shop-link create/edit/delete/recheck
  - ingredient form/source/synonym/precursor edits
  - legal document save
  - user blocked-submitter toggle
  - image upload/delete
  - interaction/dosing save flows
- Admin comfort follow-ups from browser QA:
  - add `/administrator/user-products` to the main admin navigation or link it
    prominently from `Heute zu tun` when pending submissions exist.
  - rename the user-products trusted toggle from ambiguous `Markieren` to
    explicit labels such as `Als trusted markieren` / `Trusted entfernen`.
  - make `/administrator/ingredients` more card-like on narrow mobile screens;
    it is functional but denser than products/users at 390px.
  - polish command-palette/admin labels that still use ASCII transliterations
    such as `Uebersetzungen`/`pruefen`.
  - consider splitting the long ingredient forms modal into clearer existing
    forms vs. add/edit sections.
  - replace native destructive `confirm()` dialogs with in-app confirmation
    dialogs for better admin ergonomics and more reliable browser QA.
- Backend review P2 hardening is deployed:
  - malformed auth JSON -> HTTP 400
  - mail transport debug fields removed from API JSON responses
  - admin CSV export formula cells neutralized
  - preview/live malformed JSON smokes passed after Cloudflare Pages deploy.
- Admin post-launch dashboard and human admin-copy pass is deployed:
  - preview `https://89b9f726.supplementstack.pages.dev`
  - live `https://supplementstack.de`
  - no new D1 migration was required
  - frontend/functions typechecks, frontend build, and `git diff --check`
    passed
  - preview/live route and unauthenticated admin API smokes passed
- Dashboard is now oriented around post-launch operation:
  - `Heute zu tun`
  - registrations plus activations
  - active users
  - link clicks and affiliate signal
  - catalog risk, deadlinks, link reports, product/shop click leaders
  - content/trust maintenance and recent admin activity
- Visible admin subtitles were reviewed from a human/operator perspective and
  rewritten; obvious admin-page ASCII copy remnants were removed.
- Remaining Admin-QA limit is authenticated owner browser QA. The previously
  open lightweight-modal implementation gaps are now closed:
  - DGE source add/edit/delete exists in the modal.
  - existing forms/synonyms can be inline-edited in the modal.
  - existing precursor notes/order can be inline-edited in the modal.
  - Wissensdatenbank sources are entered as `Name` + `Link`, not raw JSON.
- `.agent-memory/admin_qa_todo.md` is now the current Admin-QA status file.
  It records the completed pass and the few remaining authenticated/browser
  QA limits.
- Dashboard signup analytics decision is implemented: main metric
  `Anmeldungen` counts registrations in the selected range; subtext counts
  activations where the email verification link was clicked
  (`email_verified_at IS NOT NULL`). Do not add a separate "Neue Besucher"
  signup card.
- For future visual TODOs, keep `.agent-memory/deployment_images/` and delete
  only completed images inside it.
- No open `.agent-memory/deployment_images` PNG visual TODOs remain. Keep the
  folder and `.gitkeep` for future owner reference images.
- Run authenticated owner QA for:
  - admin dashboard ranges and the `Anmeldungen`/activation card
  - admin product filters, image delete, and `blocked` moderation status
  - Product Detail multi-shop-link editor, including create/edit/delete,
    primary link, active status, owner label, sort order, and manual recheck
  - Wissensdatenbank structured sources, article image upload, conclusion,
    dose details, ingredient assignment, and product note
  - Wirkstoff task modals: forms/synonyms edit, DGE source edit, and precursor
    edit
  - user blocked-submitter toggle
  - `/administrator/legal` document editing
  - public shop-link redirect behavior from product cards
- Run authenticated owner QA for the new user/admin flows, especially stack
  form selection, user-product ingredient entry, and Administrator Ingredient
  `Wirkstoffteile`.
- In the same owner QA pass, upload one Product Detail/Product-QA image and
  confirm the stored R2 URL ends in `.webp` on modern browsers.
- Review L-Carnitin/ALCAR display copy in admin content if the migrated legacy
  notes should be rewritten into final editorial wording.
- Fix or reset the local D1 migration journal/schema mismatch if local
  migration apply is required; current failure happens at old migration
  `0009_auth_profile_extensions.sql`, before the new migrations run.
- Keep `/administrator` as the frontend admin surface and `/api/admin` as the
  backend admin namespace.

## Wirkstoffe/Formen Rebuild

- Model canonical Wirkstoffe in `ingredients`.
- Model salts, esters, derivatives, and forms in `ingredient_forms`.
- Model spelling variants and abbreviations in `ingredient_synonyms`.
- Use `ingredient_precursors` for editorial precursor relationships.
- Treat L-Carnitin as canonical and Acetyl-L-Carnitin as a form/derivative of
  L-Carnitin for search/product structure.

## Admin QA

- Use the next owner browser-QA pass for detailed usability notes on:
  - new reduced admin menu and Dashboard
  - Products filter/edit/image delete flow
  - user blocked-submitter controls
  - Legal documents editor
  - redesigned Wechselwirkungs-Matrix
  - compact revised admin sidebar typography/palette/menu density
  - Product-QA
  - Product Detail
  - Ingredient Detail
  - Interactions
  - user stack/product entry surfaces
- Final authenticated QA order:
  1. Login/session persistence.
  2. Stack create/edit/product add/remove/replacement and user product submit.
  3. Product Detail overview/moderation/shop-link save.
  4. Product Detail Wirkstoff row add/edit/delete.
  5. Product Detail image upload and image URL save.
  6. Product-QA harmless save.
  7. Product Warning create/edit/deactivate.
  8. Dosing save with source links and plausibility display.
  9. Interaction edit/delete.
  10. Ingredient Research source/warning and NRV CRUD.
  11. One stale-version `409` check.

## Research And Content

- Continue entering ingredient research/copywriting data through
  `/administrator/ingredients`.
- For each ingredient, fill:
  - official sources, including DGE if applicable
  - study sources with DOI/PMID where available
  - NRV/UL rows
  - dose recommendations and dose-source links
  - display profile text
  - warnings plus linked knowledge article if needed
  - blog URL or related knowledge article when copywriting is done
- Use the missing badges in `/administrator/ingredients` as the source of truth
  for what still needs data.

## Launch Confidence

- Run external inbox mail tests for registration, verification, password reset,
  single stack mail, and combined routine mail.
- Verify outbound headers include DKIM alignment for
  `supplementstack.de`.
- Keep content/science/legal review as a separate pre-indexing gate.

## Later Refactors

- Split `functions/api/modules/admin.ts` by domain after authenticated QA.
- Keep `/administrator` as the only frontend admin route. `/api/admin` remains
  the backend API namespace.
- Consider table-rebuild cleanup migrations only after the current admin panel
  is QA-accepted.

## Website UX Fixes Preview QA

- Current demo/stack UI polish is deployed to
  `https://codex-website-ux-fixes.supplementstack.pages.dev`.
- Preview browser smoke passed for:
  - no mojibake on `/demo`
  - approved demo reset/signup banner copy
  - `Studien & mehr` header nav and `/wissen`
  - stack toolbar order: stack icons, delete icon, divider, then
    `Produkt hinzufügen`
  - compact list card layout and larger `58px` list images
- Run authenticated browser QA against the local Pages/Workers stack or preview
  deployment for the new stack flows:
  - duplicate Wirkstoff modal with target-stack selection before search and
    stack changes after ingredient selection
  - own-product CTA from product selection
  - stack create/edit family assignment
  - product delete confirmation
  - short warning detail popovers in card and list view on touch/click
  - demo mail/PDF account CTA modal instead of native alert
  - list-view compact add-product row
  - `/family` and `/routine` as logged-in user
  - `/routine` Plan mailen against the real `POST /api/stacks/routine/email`
    endpoint with a configured external inbox
  - demo stack import after registration, including an empty created demo stack
- The local Vite smoke cannot verify demo catalog products because `/api` is not
  available from Vite alone.
- Preview browser QA has confirmed the demo header, demo account CTA modal,
  list-view add row, and product delete confirmation. Remaining browser QA is
  authenticated preview/live admin and logged-in user smoke, especially
  `/routine` mail with an external inbox.

## Website UX Review Follow-Ups

- Owner review follow-ups for `/demo` and `/wissen` are implemented and
  deployed to
  `https://codex-website-ux-fixes.supplementstack.pages.dev`.
- Remote D1 migration `0075_fix_black_seed_oil_volume.sql` was applied to
  `supplementstack-production`.
- Preview browser smoke passed for:
  - no mojibake on `/demo`
  - banner copy `um deinen Stack dauerhaft zu speichern`
  - `Übersicht` product section title
  - draggable product cards with the add tile/row fixed at the end
  - JSON share/import toolbar buttons and modals
  - Schwarzkümmelöl as `40 ml täglich`, `12 Tage`, `28,48 €/Mo`
  - `/wissen` headline, search field, tag cloud, and filtered search results
- Next useful QA:
  - authenticated user smoke for reorder persistence on a real stack
  - share/import JSON roundtrip with a non-demo account
  - admin/content review of the new `/wissen` placeholder entries before SEO
    indexing
  - legal/science wording review of the public source-interpretation disclaimer
