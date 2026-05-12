# Decisions

Last updated: 2026-05-12

## 2026-05-12 - Hook Ownership Migration

Decision: Operational Hook-Ereignisse werden aus der Claude-Projektkonfiguration entfernt und auf eine zentrale, minimale Codex-Konfiguration migriert.

Operational rules:

- `.claude/settings.json` und `.claude/memory.md` sind nicht mehr Teil der
  aktiven Projektkonfiguration.
- `.codex/hooks.json` enthält nur:
  - `UserPromptSubmit`
  - `Stop`
- Beide Codex-Hook-Events laufen auf `.codex/hooks/agent-protocol.ps1`.
- `.codex/hooks.json`, `.codex/hooks/agent-protocol.ps1` und
  `.codex/hooks/README.md` werden trotz lokalem `.codex/*`-Ignore explizit
  versioniert.
- `UserPromptSubmit` fängt Owner-Feedback auf.
- `Stop` schreibt zentrale Memory-/Handoff-Progress-Daten.
- Kein aktiver automatischer PreCompact-Workflow; manuelle Behandlung bleibt
  als Doku/Fallback im Prozess dokumentiert.

Rationale:

- Der Nutzer hat den Claude-Teilnehmerzugriff beendet; offene Hook-Dateien in
  `.claude` sollen keine versteckten Review-Pflichten mehr auslösen.

## 2026-05-12 - AGENTS as Canonical Protocol

Decision: `AGENTS.md` bleibt die zentrale, dauerhafte Start- und Protokolldatei; `CLAUDE.md` wurde aus dem Pflichtstart und aus den zentralen Arbeitsdokumenten entfernt.

Operational rules:

- `.agent-memory/current-state.md`, `.agent-memory/next-steps.md`, `.agent-memory/handoff.md` and `.agent-memory/decisions.md` reference `AGENTS.md` as the canonical startup anchor.
- Hook handoff output from `.codex/hooks/agent-protocol.ps1` must use the AGENTS-only startup list.
- Scripted checks must confirm that no `.claude` hook configuration remains active and that AGENTS startup requirements do not include `CLAUDE.md`.

## 2026-05-08 - Admin Dashboard Is Post-Launch Operations

Decision: the admin dashboard should represent the post-launch operator view,
not a temporary pre-launch checklist.

Operational rules:

- Lead with `Heute zu tun`, because urgent maintenance work is the first thing
  an operator needs to see.
- Show registrations and activations together; activations remain defined by
  `users.email_verified_at IS NOT NULL`.
- Use `Umsatzsignale` rather than revenue promises. The dashboard can show
  affiliate clicks, non-affiliate clicks, top clicked products, top shops,
  deadlinks, and link reports as operational signals.
- Keep catalog/content maintenance visible: product QA, link reports, due
  Wirkstoff reviews, warnings without articles, and knowledge drafts.
- Write admin subtitles for humans doing work, not for system taxonomy. Counts
  belong in meta text or cards; subtitles should explain what the operator can
  understand or act on.

Rationale:

- After launch, the owner needs a fast operational overview: what needs
  attention, where users are active, where link revenue may be leaking, and
  which content/catalog areas need maintenance.

## 2026-05-08 - Knowledge Article Structured Sources

Decision: Wissensdatenbank sources are edited as structured rows, while
`sources_json` remains a compatibility mirror/fallback.

Operational rules:

- Admin users enter article sources as repeated `Name` + `Link` fields.
- Canonical storage for new edits is `knowledge_article_sources`.
- `knowledge_articles.sources_json` may remain populated as a JSON mirror so
  existing public/API code and older content keep working during transition.
- Article-to-ingredient links are stored in `knowledge_article_ingredients`;
  selecting the article from a Wirkstoff context or selecting Wirkstoffe from
  the article editor should represent the same relation.
- Optional article image, conclusion, dose min/max/unit, and product note live
  on `knowledge_articles`.

Rationale:

- The owner should not have to write JSON for one to five sources.
- Keeping the JSON mirror avoids a brittle one-shot compatibility break while
  still moving the editor and data model to normal relational rows.

## 2026-05-08 - Admin QA Task Status And Recommendation Slots

Decision: lightweight admin completion states for Wirkstoffe use a generic
task-status table, while product ordering per Wirkstoff uses explicit
recommendation slots.

Operational rules:

- `ingredient_admin_task_status` stores per-ingredient statuses for
  `forms`, `dge`, `precursors`, and `synonyms`.
- Status values are `open`, `done`, and `none`.
- `none` means the admin intentionally confirmed that no special entry exists,
  e.g. no special forms or no DGE recommendation/restriction.
- Product recommendation slots are `primary`, `alternative_1`, and
  `alternative_2`.
- A recommendation slot points to a product and may optionally point to a
  concrete `product_shop_links.id`.
- When a concrete `shop_link_id` is set, the API validates that the shop link
  belongs to the selected product.
- Public ingredient product ordering may use these slots for sorting, but the
  user-facing UI should not force the word `Empfehlung`.

Rationale:

- The status table avoids schema churn for each admin checklist item.
- Explicit slots match the owner's editing workflow and preserve flexibility
  for multiple shop links per product.

## 2026-05-07 - Admin Operations Metrics And Shop-Link Core

Decision: admin operations should track registrations and verified activations,
not a separate signup-callout metric based on visitor copy.

Operational rules:

- Dashboard card label is `Anmeldungen`.
- The main number counts users created in the selected date range.
- The subtext counts activations in the same selected range, defined by
  `users.email_verified_at IS NOT NULL`.
- Do not add a separate "Neue Besucher" card for registration-callout copy.
- Product shop clicks use first-party redirect tracking through
  `/api/products/:id/out`; store only minimal click context and avoid IP or
  User-Agent storage.
- Product shop-link data should move toward `product_shop_links` as the
  canonical multi-link model while legacy `products.shop_link` remains synced
  for compatibility during the transition.
- Audit-Log is no longer a primary admin navigation item and may be removed
  from the visible operator menu.

Rationale:

- Activated users are the meaningful post-registration signal because the
  product uses email-link verification as the second factor in the signup
  funnel.
- The multi-shoplink/link-health/click tables let admin operations evolve
  without overloading the legacy single `products.shop_link` field.

## 2026-05-07 - Admin Visual Reference Applied

Decision: the current admin visual system follows the owner-provided
`Schriftarten.png` and `Wechselwirkungs-Matrix.png` references.

Operational rules:

- Admin sidebar typography should stay serif-forward for the brand and larger,
  calmer, high-contrast navigation labels, but the desktop menu must remain
  compact enough to avoid routine sidebar scrolling.
- Admin active navigation uses a subtle neutral card treatment rather than a
  heavy outline, so the compact menu density stays close to the owner
  `menu_soll.png` reference.
- Admin palette remains warm off-white with muted taupe text and soft semantic
  pills for info/medium/high/danger.
- The interaction matrix is the preferred visual pattern for ingredient-pair
  interactions: vertical column labels, compact horizontal rows, small
  severity cells, a legend, and hover details.
- Create/edit controls should not dominate the first viewport of the matrix;
  the add form opens from `Hinzufuegen`.

Rationale:

- The owner provided these references as the desired admin look, and they are
  materially clearer and more scannable than the previous dense table.

## 2026-05-07 - Product Image Upload Normalization

Decision: product-image uploads should be normalized before storage instead of
storing arbitrary original camera files.

Operational rules:

- The user upload flow stays unchanged: select/drop image, choose crop, save.
- The browser cropper renders the selected image to 512 x 512 px.
- Preferred stored format is WebP with quality `0.84`.
- JPEG remains an automatic fallback only for browsers that cannot export WebP.
- Backend upload routes accept JPEG/PNG/WebP for compatibility, but enforce a
  1 MB post-optimization limit and store the R2 object extension/content type
  from the actual uploaded blob.
- Cloudflare Worker-side image decoding/resizing is not introduced for this
  pass; if full server-side image processing is required later, use Cloudflare
  Images/Image Resizing or a separate processing service.

Rationale:

- Normalizing in the browser avoids extra user steps and keeps the Worker
  inside Cloudflare runtime constraints.
- 512 x 512 WebP is sharp enough for product cards and stack views while
  avoiding oversized 4000 px source images in R2/page loads.

## 2026-05-07 - Wirkstoffe Forms And Precursors Model

Decision: the ingredient rebuild keeps `ingredients` canonical and uses
separate relationship tables for forms, synonyms, and editorial precursors.

Operational rules:

- `ingredients` contains one canonical row per Wirkstoff.
- `ingredient_forms` contains salts, esters, derivatives, and label-facing
  forms that should not become separate canonical Wirkstoff pages.
- `ingredient_synonyms` contains abbreviations, spelling variants, and
  alternative names.
- `ingredient_sub_ingredients` remains reserved for true component
  relationships and is not the forms mechanism.
- `ingredient_precursors` stores editorial precursor relationships, not normal
  search expansion.
- The admin UI remains under `/administrator`; new admin APIs should prefer
  `/api/admin`.

Concrete classification:

- L-Carnitin is canonical.
- Acetyl-L-Carnitin is treated as a form/derivative of L-Carnitin for search
  and product structure.
- ALCAR and `Acetyl L Carnitin` are search/synonym spellings that should lead
  to L-Carnitin with the Acetyl-L-Carnitin form preselected when possible.
- Lysin and Methionin remain canonical ingredients and may link to L-Carnitin
  through `ingredient_precursors`.

Implementation status:

- Implemented, remote-migrated, and deployed on 2026-05-07.
- Remote D1 migrations `0069_ingredient_lookup_indexes.sql`,
  `0070_ingredient_precursors.sql`, and
  `0071_consolidate_l_carnitine_forms.sql` are applied to
  `supplementstack-production`.
- Ingredient IDs `60`, `65`, and `66` were removed after remapping to
  canonical L-Carnitin `13` with forms `155`, `154`, and `158`.
- Old form `189` was merged into form `155`.
- `ALCAR` search now returns L-Carnitin with `matched_form_id: 155`.

Rationale:

- Product entry and search should avoid duplicate ingredient pages while still
  preserving form-level filtering.
- Precursor relationships are useful for admin/content explanation but should
  not pollute the user-facing ingredient search.

## 2026-05-07 - Cleanup Canonical Memory And Artifacts

Decision: keep only compact, canonical continuation state in shared memory and
remove local-only artifacts from version control consideration.

Operational rules:

- `.agent-memory/deploy-log.md` is the canonical deploy/migration log.
- Do not revive `.claude/SESSION.md` or a hook that appends deploy history to
  it.
- Do not commit local browser-QA screenshots, root-level scratch logos, or
  one-off design reference dumps such as `admin-preview/`.
- Keep `.agent-memory/deployment_images/` as the inbox for open owner-provided
  visual TODOs. Delete completed images inside it after implementation, but do
  not delete the folder itself; `.gitkeep` exists only to keep the empty folder
  tracked.
- Temporary analysis plans should be deleted or reduced once their outcome is
  reflected in current state, handoff, next steps, and durable decisions.

## 2026-05-07 - German Admin UI Wording Standard

Decision: productive admin/user UI copy should use clear German for normal
operators, not development notes, raw enum values, or internal technical terms.

Operational rules:

- German is the source language and should not be offered as a translation
  target in the Translation admin tool.
- Visible decimal input/output in German UI should use comma notation; backend
  and database values remain numeric/dot-normalized internally.
- Visible admin labels should prefer understandable German terms such as
  `Nutzer`, `Link gehoert zu`, `Shop-Link`, `Freigabe`, and `Sichtbarkeit`
  instead of raw words such as `User`, `Owner`, `Affiliate`, `Pending`, or
  `Publish-Guardrails`.
- Raw enum values may remain internal API/database values, but pages should map
  them to German labels before display.

## 2026-05-07 - Ingredient Research Checklist Source

Decision: the per-ingredient research checklist is computed from canonical
admin data instead of being stored as a separate manual checkbox table.

Rationale:

- A separate checklist would drift from the actual content/source state.
- The admin already has canonical stores for research sources, NRV/UL rows,
  dose recommendations, dose-source links, display profiles, warnings,
  knowledge articles, and blog URLs.
- `/administrator/ingredients` can therefore show reliable automatic Haken for
  what exists and clear missing badges for what still needs research or
  copywriting.

Operational rule:

- Use `/administrator/ingredients` as the high-level progress board, then edit
  the underlying data in Ingredient Detail, Research, Dosing, Warnings,
  Display, and Knowledge.

## 2026-05-06 - Administrator Final Code Boundary

Decision: the new `/administrator` code path is now considered code-complete
for the current admin rebuild, pending only owner-run authenticated browser QA
and feedback.

Rationale:

- Every planned sidebar destination has a real page; no active placeholder page
  remains.
- The old frontend admin monolith is removed. `/admin` is retained only as a
  compatibility alias to `/administrator`.
- Product Detail now covers the high-impact catalog maintenance actions:
  product fields, moderation, affiliate ownership, structured warnings,
  product ingredient rows, image upload, link context, QA context, and audit
  context.
- Ingredient Detail covers research sources/warnings, dosing source links,
  display profiles, i18n bridge, interactions context, evidence summary, and
  NRV CRUD with update/delete locking.

Kept deliberately:

- Backend Bearer fallback remains until final authenticated browser QA confirms
  cookie-only browser operation under real owner usage.
- Big cleanup migrations that drop legacy columns/tables and the `admin.ts`
  module split remain post-QA/refactor work. They are not required for the
  current deployed admin behavior.

## 2026-05-06 - Code Completion Acceptance Boundary

Decision: after the admin code-completion pass, remaining launch acceptance is
treated as authenticated owner browser QA feedback, not an unimplemented
code-build blocker.

Rationale: the Critic P1 code gaps were closed: new admin product detail
editing exists, Dosing is navigable, legacy `/admin` routes into
`/administrator`, Interactions have admin-by-id versioned endpoints, and
cookie-backed mutations have Origin/Referer validation.

Kept deliberately:

- Bearer auth fallback remains for API/QA tooling until authenticated browser
  QA is complete.
- Product detail image editing is URL-based in `/administrator`; full upload
  crop remains on user/product-submission surfaces.
- Product ingredient rows remain read-only in product detail because detailed
  ingredient/dose maintenance lives in ingredient/dosing admin surfaces.

## 2026-05-06 - Administrator Versioning And Evidence Scope

Decision: admin edit concurrency is enforced opportunistically through additive
`version` columns and `If-Match` headers, while non-migrated environments keep
working without the column.

Operational rules:

- If a table has no `version` column, admin reads return `version: null` and
  writes continue without conflict enforcement.
- If a table has a `version` column and an existing row is being updated or
  soft-deleted, callers should send `If-Match: <version>` or payload
  `version`.
- Conflict responses use HTTP `409` with
  `{ error: "Version conflict", current_version: <number|null> }`.
- New rows rely on database defaults for initial version values.
- The existing `/api/interactions` relation-upsert contract remains
  compatibility-first; full strict locking for interaction metadata should be
  implemented later with a dedicated `PUT /api/interactions/:id`.

Decision: PubMed retraction/evidence-grade handling is manual/admin-maintained
for now, not an automated external medical-data sync.

Operational rules:

- `ingredient_research_sources` may store `is_retracted`,
  `retraction_checked_at`, `retraction_notice_url`, and `evidence_grade`.
- `evidence_grade` is restricted to `A`, `B`, `C`, `D`, `F`, or null.
- The app may summarize evidence counts for admin workflow, but should not make
  stronger medical claims from these fields.
- No raw external PubMed/NCBI retraction state should be assumed unless a later
  sourced, tested sync job is explicitly built.

## 2026-05-06 - Administrator Auth Cookie-Only Frontend

Decision: normal frontend API calls should rely on the HttpOnly `session`
cookie and `credentials: include`, not persisted frontend JWT storage or Bearer
headers.

Operational rules:

- Do not reintroduce `ss_token` localStorage usage in `frontend/src`.
- Do not add frontend `Authorization: Bearer` fallback for normal app/admin API
  calls.
- The browser smoke harness may accept `ADMIN_QA_TOKEN`, but must convert it to
  a browser `session` cookie for `/administrator` page checks.
- Keep backend Bearer fallback during the transition for API-level token
  verification and QA preflight unless a later security pass explicitly removes
  it.

Rationale:

- The backend already sets and clears HttpOnly Secure SameSite=Lax session
  cookies.
- Removing frontend token persistence reduces exposure of admin/user sessions
  to script-readable storage while preserving a practical admin QA path.

## Email Verification Flow

Decision: email verification is a trust/account-integrity nudge, not a hard
login gate for the current product surface.

Implementation status:

- Implemented locally in the email-verification worktree; not yet committed,
  remote-migrated, deployed, or live-smoked.
- New accounts get `email_verified_at = NULL` and a 48-hour verification token stored in `email_verification_tokens`.
- Existing accounts are backfilled as verified in migration 0043 to avoid
  suddenly warning or degrading already-created accounts.
- Only a SHA-256 hash of the verification token is stored in D1, in the dedicated token table. The raw token
  is sent only in the SMTP email link.
- Resend requires authentication and is rate-limited per user.

Rationale:

- Blocking login immediately would add friction and could strand users if SMTP
  is temporarily unavailable.
- The product currently has no high-risk action that must be blocked solely by
  email verification; visible nudges plus resend preserve UX while improving
  account trust.

## 2026-05-06 - Administrator Admin Slice

Decision: Do not rewrite legacy `/admin` during the first rebuild slice. Build the
new admin surface under `/administrator` and keep `/admin` as a legacy/fallback
route until migration completion.
Stage-1 analysis source is `.agent-memory/admin-overhaul-analysis.md`; Stage-2
implementation plan is `.agent-memory/admin-rebuild-plan.md`.

Operational rule:

- New code paths for `Phase 0` and subsequent slices should use
  `/administrator/*`.
- New route files are `frontend/src/pages/administrator/*` and `frontend/src/App.tsx`
  wiring keeps redirect `/administrator -> /administrator/dashboard`.
- `/api/interactions` has compatibility aliases so legacy payloads remain supported.
- Next explicit phase in this migration sequence is `Phase 0.2 Affiliate-Ownership`.

Rationale:

- This avoids risky one-shot rewrites of existing admin workflows.
- Legacy admin users keep access while `/administrator` stabilizes.

## 2026-05-06 - Admin Phase 0 Data Integrity

Decision: Phase 0 schema fixes are additive and deploy-gated by migration
order.

Operational rules:

- Apply `0052_product_affiliate_ownership.sql` before deploying code that reads
  or writes `products.affiliate_owner_type` / `products.affiliate_owner_user_id`.
- Apply `0053_dose_recommendation_sources.sql` before deploying code that reads
  or writes `dose_recommendation_sources`.
- Keep `products.is_affiliate` as a compatibility column and dual-write it
  until the later cleanup/drop migration.
- Keep `dose_recommendations.source_label` / `source_url` as fallback until
  the later cleanup/drop migration.
- `/api/interactions` remains mounted for compatibility, but the list endpoint
  is admin-only; create a separate active-only public endpoint if public
  interaction data is needed later.

Rationale:

- The admin backend now selects the new columns/tables directly, so code-before-
  migration deploys would produce runtime failures.
- The old fallback fields keep existing data editable while the new
  `/administrator` workflows are filled in.

## 2026-05-06 - Auth Cookie Dual-Mode

Decision: Roll out HttpOnly cookie auth in dual mode, not as a hard cutover.

Operational rules:

- Backend accepts `session` cookie first and `Authorization: Bearer ...` as
  fallback.
- Login and register continue returning the body token for compatibility and
  additionally set `session=<jwt>; HttpOnly; Secure; SameSite=Lax; Path=/`.
- Cookie `Max-Age` matches current JWT lifetime: 604800 seconds / 7 days.
- Logout clears the cookie but does not revoke already issued stateless JWTs.
- CORS credentials are allowed only for the existing explicit allowlist and
  Pages preview subdomain pattern.
- Frontend localStorage/Bearer removal is deferred until a second cookie-aware
  frontend deploy and authenticated browser smoke pass.

## 2026-05-06 - Auth Cookie Cutover Status Update

Superseding note: the frontend localStorage/Bearer removal phase is now
implemented locally for normal app/admin API flows (`credentials: include` + no
frontend token reads/writes), while production verification remains gated on
authenticated browser smoke. Backend Bearer fallback is intentionally still in
place for remote verification.

Rationale:

- A one-shot switch away from localStorage would risk logging out or breaking
  active admin sessions.
- Secure cookies do not work on plain `http://localhost`, so Bearer fallback
  remains necessary during the migration/dev window.
## Stack Item Product References

## Legal-Text Preflight Scope Boundaries

Decision: On frontend-only legal copy update, only wording/compliance text was changed in:

- `frontend/src/pages/PrivacyPage.tsx`
- `frontend/src/pages/TermsPage.tsx`
- `frontend/src/pages/ImprintPage.tsx`
- `frontend/src/pages/RegisterPage.tsx`
- `frontend/src/pages/LandingPage.tsx`
- `frontend/src/components/LegalDisclaimer.tsx`

No backend data model, analytics implementation, affiliate tagging logic, or Admin
product-card logic were altered in this pass.

Rationale:

- Requirement was explicitly preflight/legal text harmonization without changing
  calculation, API, or Admin behavior.

Decision: `stack_items` must not use one ambiguous `product_id` for both
catalog `products` and private `user_products`.

Implementation status:

- Implemented, committed, remote-migrated, deployed, and live-smoked in the
  Launch-QA stack/profile bundle (`0b29fe0`, `baa91a5`, `1a3b8e6`,
  `cb76cf3`, `24b10b5`).
- Remote D1 migration `0041_stack_item_product_sources.sql` applied
  successfully to `supplementstack-production`.
- Migration 0041 rebuilds `stack_items` with nullable
  `catalog_product_id` and `user_product_id` columns.
- A CHECK constraint requires exactly one of the two columns to be non-NULL.
- Existing stack rows are backfilled from legacy `product_id` into
  `catalog_product_id`; the rebuilt table no longer keeps `product_id` as a
  schema source.

Operational rule:

- API backward compatibility remains: old payloads `{ id }` mean catalog
  products.
- New stack payloads may use `{ id, product_type: 'catalog' }` or
  `{ id, product_type: 'user_product' }`.
- Backend validation maps those payloads to the correct column and validates
  all items before deleting/reinserting stack rows.
- User product validation must use the stack owner (`stack.user_id`) so admin
  edits of another user's stack still validate against that user's products.
- Stack item responses include `product_type` so frontend keys stay
  collision-free as `catalog:id` or `user_product:id`.
- Stack warnings must combine `product_ingredients` for catalog products and
  `user_product_ingredients` for user products.

Rationale:

- `products.id` and `user_products.id` can collide.
- A discriminator plus one numeric ID is still easy to misuse in SQL and keeps
  the ambiguity at the schema boundary.
- Explicit nullable references encode intent directly and keep legacy payload
  compatibility in the API instead of the table design.

## Sub-Ingredient Prompt Mapping

Decision: product and user-product ingredient rows may reference a
`parent_ingredient_id` only when the pair exists in
`ingredient_sub_ingredients`.

Deployment status:

- Implemented, committed, remote-migrated, and deployed in `29dcde5`
  (`Feature: Add sub-ingredient product workflow`).
- Remote D1 migration `0040_seed_ingredient_sub_ingredients.sql` is applied to
  `supplementstack-production`.
- Remote verification confirmed `ingredient_sub_ingredients` count = 6:
  L-Carnitin children ALCAR/Tartrat/Fumarat and Omega-3 children EPA/DHA/DPA.
- Remote verification confirmed `products.source_user_product_id` exists
  (`source_col=1`).

Operational rule:

- The public prompt API is `GET /api/ingredients/:id/sub-ingredients` and
  returns the parent plus sorted child prompt rows.
- `GET /api/ingredients/:id` may include the same `sub_ingredients` array for
  efficient UI hydration.
- Admin-only management uses
  `GET /api/admin/ingredient-sub-ingredients`,
  `PUT /api/admin/ingredient-sub-ingredients`, and
  `DELETE /api/admin/ingredient-sub-ingredients/:parentId/:childId`.
- `POST/PUT /api/products` and `POST/PUT /api/user-products` validate
  ingredient existence, form ownership, parent existence, parent != child, and
  allowed parent/sub relation before saving.
- Sub-ingredient mappings are prompt and validation metadata only. They do not
  imply automatic quantity calculation.
- Parent product lookup treats matching child rows with
  `parent_ingredient_id = :id` as matches for the parent, dedupes products, and
  prefers an explicit parent row when both parent and child rows are present.
- Stack-warning ingredient evaluation is per product: child rows win over a
  simultaneous parent row for the same parent in the same product, then
  effective ingredient IDs are deduped across the stack.
- Admin publish has a source guard through `products.source_user_product_id`
  with a unique partial index, so concurrent publish attempts for one
  user-product return the existing catalog product instead of creating a
  duplicate.

Rationale:

- Bad private product data should not enter moderation storage and then fail
  only later during admin publish.
- Mapping-based validation keeps parent prompts configurable without encoding
  supplement-specific logic in product save handlers.

## User Product Publication And Catalog Conversion

Decision: `user_products.status = 'approved'` remains the user-edit lock, but
public/nutzbare products now require conversion into the catalog `products`
table via `user_products.published_product_id`.

Deployment status:

- Implemented, committed, remote-migrated, and deployed in `1272e11`
  (`Feature: Add product ingredient publishing model`).
- Remote D1 migration `0039_product_ingredient_model.sql` is applied to
  `supplementstack-production`.
- Remote schema verification confirmed `product_ingredients.search_relevant`,
  `user_product_ingredients`, `ingredient_sub_ingredients`, and
  `user_products.published_product_id`.

Operational rule:

- Normal users create user products as `pending`.
- Trusted product submitters create user products as `approved` immediately,
  but they are not auto-published to the public catalog.
- Trusted submitter approval is a private moderation state only; public catalog
  visibility still requires admin publish so verified search-relevant
  ingredient rows are copied into `products` and `product_ingredients`.
- Users cannot edit or delete their own `approved` user products.
- Rejected products may be edited by their owner; editing resubmits as
  `pending`, or `approved` if the owner is trusted at that time.
- Admins may still approve, reject, delete, and mark/unmark trusted submitters.
- Admins publish a checked user product through
  `PUT /api/admin/user-products/:id/publish`.
- Publish copies the user product into `products` and its ingredient rows into
  `product_ingredients`, sets `products.moderation_status='approved'` and
  `visibility='public'`, and writes `user_products.published_product_id` plus
  `published_at`.
- Wishlist still accepts approved/public catalog `products.id` values only.
- Stacks may store either approved/public catalog products or the stack
  owner's own pending/approved user products through the explicit
  `catalog_product_id` / `user_product_id` schema introduced by migration 0041.

Rationale:

- `stack_items.product_id`, `wishlist.product_id`, recommendations, and public
  ingredient product lists all point at catalog `products`.
- A dedicated publish conversion keeps raw user submissions separate from
  public/nutzbare catalog products while preserving idempotent moderation.

## Demo Session Storage

Decision: active Demo mode must not use long-lived server-side stack storage.

Operational rule:

- The current Demo UI flow loads starter products from `/api/demo/products` and
  keeps user edits in browser page state only.
- `POST /api/demo/sessions` is compatibility-only, rate-limited by IP with KV,
  and must not persist submitted Stack JSON into D1.
- `GET /api/demo/sessions/:key` must not return persisted user changes; legacy
  keys may return an empty stack or 404.

Rationale:

- Prevent old clients or abusive callers from filling D1 with arbitrary demo
  stack payloads.
- Ensure reloading Demo always returns to the curated starter stack.

## Shared Agent Memory

Decision: this repository uses `.agent-memory/*` as the canonical shared memory for Codex, Claude Code, and future agents.

Rationale:

- Avoid separate stale memories per tool.
- Make handoff state versionable and reviewable.
- Ensure each agent starts with the same project context.

Operational rule:

- `AGENTS.md` points to `.agent-memory/*` as the canonical workspace memory.
- `.claude/memory.md` is not used in active startup; `.agent-memory/*` is canonical.

## Orchestrator And Sub-Agent Operating Model

Decision: Claude and Codex both operate as Orchestrator in this repository, and practical implementation or file changes are delegated to responsible Sub-Agent roles.

Sub-Agent roles:

- Orchestrator
- Dev-Agent
- Science-Agent
- Critic-Agent
- Feature-Agent
- UX-Agent
- UI-Agent
- Mobile-Agent
- Persona-Agent
- QA-Agent
- Legal-Agent later / on request

Operational rule:

- The Orchestrator plans, delegates, reviews, coordinates, and summarizes.
- The Orchestrator does not implement code or edit files directly.
- Implementation and file edits are delegated to the responsible Sub-Agent, especially Dev-Agent for code changes.
- Delegation must stay efficient: only relevant bounded subtasks, short handoffs, and no unnecessary parallel agents.

Decision: Codex remains Orchestrator and applies an explicit model-routing policy for future Sub-Agent execution.

Operational rule:

- Codex is the default Orchestrator and selects model variants per task.
- Use `gpt-5.3-codex-spark` with explicit reasoning mode:
  - `medium` for simple, routine tasks.
  - `high` for bounded tasks that need more caution.
  - `xhigh` for more difficult tasks that are still suitable for Spark.
- Use `gpt-5.5` (high-reasoning profile) for complex, risky, architectural, security,
  legal, product-critical, or hard-to-test tasks.
- Orchestrator review remains mandatory for all tasks:
  - validate outputs,
  - test and verify quality,
  - escalate or rerun any Spark assignment if risk, ambiguity, or quality concerns appear.

Decision: Initial Codex model-routing policy was recorded in commit `2457345`.

- This handoff extends it with Spark `medium/high/xhigh` mode guidance and keeps the
  rule to use `gpt-5.5` for high-stakes, hard-to-test, or high-risk tasks.

## Automatic Handoff Snapshots

Superseded on 2026-05-12 by the Codex-only hook protocol above.

Decision: automatic handoff snapshots are written by `.codex/hooks/agent-protocol.ps1`
through the active `Stop` hook. The old Claude integration and
`scripts/update-agent-handoff.ps1` were removed.

Rationale:

- Keeps the Hook UI free of hidden Claude review entries.
- Keeps hook behavior centralized in one Codex dispatcher.
- Keeps `.agent-memory/handoff.md` current enough for the next agent to resume.

## Secret Handling

Decision: local development secrets may remain in local-only files, but memory files only document locations and rules.

Canonical location index:

- `.agent-memory/local-secrets.md`

Operational rule:

- Never write raw token, password, API key, bearer token, or credential values into shared memory, docs, or handoff.

## Backend Line

Decision: continue production-like backend development in `functions/api/*`.

Rationale:

- The active app is Cloudflare Pages Functions + D1 + R2.
- Any older local backend line is behind the Cloudflare implementation.

## Internationalization

Decision: use separate translation tables instead of language suffix columns.

Pattern:

- `ingredient_translations`
- `dose_recommendation_translations`
- `verified_profile_translations`
- `blog_translations`

Rationale:

- New languages do not require schema changes.
- Admin editing can treat translations as first-class content.

## Admin Translations MVP

Decision: the first admin translations surface only manages `ingredient_translations`.

Operational rule:

- Admin route prefix is `/api/admin/translations/ingredients`.
- Public i18n playback remains separate and unchanged.
- `dose_recommendation_translations`, `verified_profile_translations`, and `blog_translations` stay out of the MVP UI until explicitly scoped.

## Recommendation Table Naming

Decision: keep dosage/science recommendations and product-to-ingredient recommendation links in separate tables with explicit names.

Important:

- `dose_recommendations` is the dosage/science recommendation table.
- `product_recommendations` is the product-to-ingredient recommendation links table.
- Migration 0036 renames the old `recommendations` table to `product_recommendations`.
- The public `/api/recommendations` route name remains for compatibility.
- Migration 0036 keeps a temporary `recommendations` view plus insert/delete triggers for deploy compatibility.
- Deploy order for this rename: apply remote D1 migration 0036 first, then deploy Cloudflare Pages code.

## Verified Profile Constraint

Decision: `dose_recommendations.verified_profile_id` has no database FK constraint.

Rationale:

- SQLite/D1 ALTER TABLE limitations during migration.

Operational rule:

- Backend code must validate referenced verified profiles where needed.

## D1 Migration Journal Repair

Decision: repair the remote `supplementstack-production` `d1_migrations`
journal when Wrangler's journal lags behind schema objects that are already live.

Context:

- On 2026-05-02, applying migration 0036 initially failed because Wrangler
  attempted to rerun 0026 against a database where Phase B/C schema objects
  already existed.
- The failure was `UNIQUE constraint failed: populations.slug`, confirming 0026
  seed data was already present.
- Before repair, remote schema verification confirmed Phase B/C objects existed,
  including `populations`, `dose_recommendations`, translation tables,
  `blog_posts`, `share_links`, `api_tokens`, and `dosage_guidelines_legacy`.

Operational rule:

- Only repair the migration journal after verifying the corresponding schema
  objects/data exist remotely.
- Record the repair in `.agent-memory/deploy-log.md`.
- Prefer normal `wrangler d1 migrations apply` after journal repair so the new
  migration itself is applied and recorded by Wrangler.

## Search/Wishlist Source Cleanup

Decision: SearchPage, WishlistPage, the old Search-only three-step modal flow,
and the active Wishlist API/module surfaces are removed from source.

Operational rule:

- Keep existing wishlist database tables/migrations and account-delete cleanup
  unless a separate DB cleanup task is explicitly scoped.
- `/search` and `/wishlist` should continue to fall through to the generic SPA
  fallback/404 behavior unless a new active flow is intentionally introduced.

## Launch Readiness Bundle

Decision: close launch-readiness implementation gaps in one coordinated bundle
without adding new schema migrations.

Operational rule:

- Keep stack/product cost logic dose-based and interval-aware. Use
  `basis_quantity`/`basis_unit` when present and only convert compatible mass
  units. Normalize IU/IE but do not convert IU to mass units.
- Admin dose-recommendation editing is admin-only and mutating actions must be
  audit-logged.
- Audit-log viewing is admin-only; sensitive keys are redacted and IP/User-Agent
  should not be part of the default table view.
- Legal copy updates are technical preflight improvements only. External legal
  sign-off remains required before SEO indexing/public launch.

## 2026-05-05 - Email Verification Storage

Decision: use the existing remote-compatible `email_verification_tokens` table shape and store the SHA-256 token hash in its `token` column.

Rationale:
- Production D1 already had legacy email-verification columns/table from an older schema shape.
- Using the compatible `token` column avoids duplicate-column migration failures while still ensuring the raw verification token is never stored.
- Existing users are backfilled as verified through `users.email_verified_at` to avoid suddenly warning active accounts.

Operational rule:
- New verification tokens delete any existing row for that user, insert a new hash into `email_verification_tokens.token`, and set an expiry timestamp.
- Verification looks up the hash, checks expiry and `used_at IS NULL`, sets `users.email_verified_at`, and deletes the consumed token row.

## 2026-05-05 - Product Safety Warning Model

Decision: model safety warnings as ingredient-linked records with optional knowledge-base article links, and attach them to product response objects as a lightweight `warnings` array.

Rationale:
- Warnings are general product/ingredient safety notices, not personalized user state.
- Ingredient-based matching works for catalog products, user products, demo products, and stack items without storing smoker status.
- Knowledge articles keep longer context and source links out of compact product cards.

Operational rule:
- Do not store or infer smoker status for this feature.
- Use migration `0046_knowledge_warnings.sql`; do not use migration 0045.
- Keep product card labels short, with concise popover context and a `/wissen/:slug` article link for sources/details.

## 2026-05-05 - Account/Profile Data Minimization

Decision: stop collecting and returning gender, diet, goals, smoker status, and account-level weight.

Rationale:
- Product direction is data minimization: keep only email/password, email verification, optional age, optional guideline source, and app data needed for stacks/products/dosage/intake interval/cost behavior.
- Account-level weight has no active dependency in the current stack/dose calculations; per-kg dose recommendation metadata remains an admin/content field, not a user profile field.
- Stack/product/dosage data can still be health-adjacent, so consent/privacy wording should be narrow rather than claiming no health-related processing at all.

Operational rule:
- Do not reintroduce gender, diet, goals, smoker status, or profile weight into registration/profile payloads without a new explicit product/legal decision.
- Keep legacy DB columns for compatibility. Migration 0045 clears old values, but `users.is_smoker` currently remains schema-level `NOT NULL`; reset stored values rather than rebuilding `users` unless a future migration explicitly scopes that rebuild.

## 2026-05-05 - Form-Specific Beta-Carotin Warnings

Decision: Beta-Carotin warnings are attached by ingredient plus optional `form_id`, not just by ingredient name.

Rationale:
- Current production data models Beta-Carotin as a form/synonym under Vitamin A, not as a standalone ingredient.
- A Vitamin A ingredient-level warning would incorrectly flag Retinol products.
- Matching on `form_id` lets the product card warn only for Beta-Carotin rows, while retaining a fallback for future standalone Beta-Carotin ingredients.

Operational rule:
- For form-specific safety risks, set `ingredient_safety_warnings.form_id` and match warnings only when the product ingredient row uses the same form.
- Use `form_id IS NULL` only for warnings that apply to the whole ingredient.

## 2026-05-05 - Ingredient Research Admin Data Model

Decision: ingredient research data is managed in dedicated admin tables, while public-facing dose recommendations remain in `dose_recommendations` until reviewed content is intentionally promoted.

Rationale:
- The owner needs a working cockpit for research status, official recommendations, study findings, notes, and warning maintenance before those values become calculation truth.
- Official/no-recommendation metadata belongs to source rows, because country and organization differ per source.
- Safety warnings should continue to use `ingredient_safety_warnings`, so product-card warnings and admin maintenance share one table.

Operational rule:
- Use `ingredient_research_status` for per-ingredient workflow state only.
- Use `ingredient_research_sources` for official and study evidence, including country, organization, recommendation type, no-recommendation marker, dose ranges, findings/outcomes, and source links.
- Use `ingredient_safety_warnings` for short product-card warnings. Longer context and source detail should live in knowledge articles linked by `article_slug`.
- Do not treat research rows as live dosage calculation rows until a future promotion/review workflow writes the vetted data into `dose_recommendations`.

## 2026-05-05 - Admin Knowledge Article Slugs

Decision: admin knowledge article updates keep `knowledge_articles.slug` immutable; delete archives by status instead of hard-deleting.

Rationale:
- `ingredient_safety_warnings.article_slug` may reference article slugs.
- Immutable slugs avoid broken warning/article links and avoid needing cascading slug migration logic in the first admin editor API.
- Archiving preserves historical warning context while removing articles from published use.

Operational rule:
- To change a slug, create a new article and explicitly relink warnings in a separate reviewed operation.
- `DELETE /api/admin/knowledge-articles/:slug` should remain a soft archive operation unless a future maintenance task explicitly handles reference migration.

## 2026-05-05 - User-Rundung V1 Scope

Decision: User-Rundung v1 keeps stack rounding pragmatic and user-side only: cockpit/routine/link reports are immediate UX features, while family profiles are a minimal stack-assignment MVP.

Rationale:
- The must-have UX gaps are stack-level clarity, timing routine, missing-link reporting, and safer product replacement assumptions.
- Family support is useful but should avoid sensitive health data and broad profile modelling in v1.
- Link reports need a small authenticated backend record so missing affiliate/user links can be corrected later without blocking the user flow.

Operational rule:
- Family profiles store only `first_name`, `age`, and optional `weight`; do not add diagnoses, medications, goals, or other sensitive health fields for this MVP.
- Stack conflict display should use `/api/stack-warnings/:id` for authenticated stacks and a simple local fallback for demo.
- Preserving dosage during product replacement must remain explicit when product form/serving/ingredient strength changes.

## 2026-05-05 - Launch Print And DNS Scope

Decision: implement PDF output as a browser print/save-as-PDF routine for the stack cockpit and Einnahmeplan, and treat mail authentication records as manual DNS/provider tasks documented in the admin Go-Live checklist.

Rationale:
- Browser print/PDF is enough for launch and avoids adding a PDF rendering dependency or server-side document generation surface.
- The printable user value is the current stack summary and intake plan; product cards and app navigation are intentionally hidden in print CSS.
- DMARC/DKIM/SPF live outside the codebase. The app can document and verify expected state, but DNS records must be set in the domain/mail-provider control panels.

Operational rule:
- Keep `Plan drucken/PDF` as a client-side `window.print()` flow until users need branded PDFs, sharing, or server-generated documents.
- Before launch, manually set `_dmarc.supplementstack.de` and enable/confirm DKIM in the mail provider; then retest registration, verification, reset, and stack emails against external inboxes.
- Product link reports should be worked from Admin `Linkmeldungen`; do not silently accept products without purchase links.

## 2026-05-05 - Whole Physical Intake Units For Stack Calculations

Decision: stack range, monthly cost, product preview, mail, and print/PDF must calculate from whole physical intake units, not abstract product portions. Product ingredient potency is derived per physical unit from `basis_quantity` where available, or from multi-unit `serving_size` as a fallback. Required units per intake day are always rounded up to whole units. Example: `3 Tropfen = 2000 IE` means one drop is about `666.67 IE`; therefore `800 IE` requires `2 Tropfen`, and `10000 IE` requires `15 Tropfen`.

## 2026-05-06 - Ingredient/Form Display Profiles

Decision: product-facing Wirkung, Timing, timing notes, intake hints, and card
notes belong to ingredient/form display profiles, not to product rows.

Operational rule:
- Use `ingredient_display_profiles` for base ingredient profiles,
  form-specific profiles, sub-ingredient profiles, and form+sub-ingredient
  profiles.
- Product rows keep only product/package/shop/photo metadata.
- Potency and unit semantics live in `product_ingredients` and
  `user_product_ingredients`, including `quantity`, `unit`, optional
  `basis_quantity`, `basis_unit`, and `form_id`.
- Public product, ingredient-product, demo, stack, stack-mail, and print/PDF
  surfaces should prefer display profile data over legacy product
  `effect_summary` or `timing`.
- Admin product details should not edit product-level `effect_summary` or
  `timing`; maintain those texts in Admin `Wirkstoff-Recherche`.
- Legacy product/user_product columns may remain for deploy compatibility until
  a later cleanup migration explicitly rebuilds those tables.

Rationale:
- Wirkung and Wechsel-/Einnahmelogik are determined by the Wirkstoff and often
  by the Wirkstoffform, not by the seller product.
- Centralizing this data prevents duplicated product maintenance and keeps
  future calculations/content review anchored in one fachliche source.

## 2026-05-06 - Affiliate Disclosure Placement

Decision: do not explicitly mark individual product cards, buy buttons, stack
emails, or other product-near calls to action as affiliate links.

Operational rule:
- Buy buttons should say `Bei <Shop> kaufen` when the shop is known, otherwise
  `Jetzt kaufen`.
- Do not append `(Affiliate-Link)`, show affiliate badges, or add separate
  affiliate labels directly on product cards, product buttons, stack email buy
  buttons, or similar product-near surfaces.
- Keep the general disclosure in footer/legal surfaces only, e.g. footer
  disclaimer, Impressum, and Nutzungsbedingungen.
- Internal admin/product QA fields may still track whether a link is an
  affiliate/partner link for operations and policy review, but this tracking
  must not leak into user-facing product CTAs.

Rationale:
- The owner explicitly wants product cards and buy buttons to stay clean and
  shop-focused; the general footer/legal disclosure is the accepted disclosure
  surface.

## 2026-05-06 - Catalog Affiliate Ownership

Decision: catalog products use `affiliate_owner_type` (`none`, `nick`, `user`)
plus optional `affiliate_owner_user_id` as the canonical ownership model while
legacy `products.is_affiliate` remains dual-written for compatibility.

Operational rule:
- `none` and `nick` always clear `affiliate_owner_user_id`.
- `user` requires an existing `users.id` on admin write paths.
- `/api/products` authenticated create cannot assign another user's id; user
  ownership is forced to the current user when requested there.
- Publishing a user-submitted product with its submitted link/source creates a
  user-owned catalog product and writes `is_affiliate=1` for compatibility.
- Product-QA must not flag every normal non-affiliate shop link; the retained
  legacy issue key only represents missing/unknown owner data.

## 2026-05-06 - Administrator Visual System

Decision: the new `/administrator` surface uses `admin-preview/Admin Panel.html`
as the visual reference and keeps the admin design system scoped to the
administrator route.

Operational rule:
- Keep admin styling in `frontend/src/pages/administrator/admin.css` and shared
  primitives in `AdminUi.tsx`; do not leak the warm paper admin tokens into the
  public app.
- Use the three-group sidebar: Katalog, Operations, Konfiguration.
- Use warm neutral cards, hairline borders, subdued shadows, serif page/card
  headings, neutral active nav state, and dark ink primary buttons.
- Use placeholders for planned routes only as temporary handoff surfaces; replace
  them with real slices rather than expanding placeholder logic.
- Hide public cookie-consent UI on `/administrator` so admin tools are not
  obstructed.

Rationale:
- The user supplied the local HTML as design Vorlage; scoping the CSS allows the
  new admin to match it without disturbing existing public stack/product pages.

## 2026-05-06 - Administrator Operations Slice Shipping

Decision: ship the new `/administrator` design shell with two real Operations
slices now, while keeping legacy `/admin` as fallback and keeping the remaining
planned sections as explicit placeholders.

Operational rule:
- `/administrator/user-products` may use frontend-chunked calls to the existing
  single approve endpoint for the first deploy; add a backend bulk endpoint only
  when queue volume or failure handling requires it.
- `/administrator/audit-log` should render current `changes` JSON safely and
  keep expandable details; a richer before/after diff remains a later sprint.
- Do not remove or rewrite legacy `/admin` tabs until matching
  `/administrator` slices are functionally equivalent and verified.

Rationale:
- The user asked to get the current Admin rebuild deployable. Shipping the shell
  plus User-Produkte and Audit-Log gives operational value without new
  migrations or risky backend contract changes.

## 2026-05-06 - Administrator Parallel Slice Integration

Decision: continue the `/administrator` rebuild as separate routed pages and
thin frontend slices over existing admin contracts where possible, adding only
small targeted backend contracts when an existing endpoint would force brittle
client behavior.

Operational rule:
- Keep legacy `/admin` as fallback until the `/administrator` equivalents are
  functionally complete and browser-tested with an authenticated admin session.
- Product detail uses `GET /api/admin/products/:id`; do not regress it to a
  full list fetch plus client-side lookup.
- Ingredient lookup helpers should surface API/auth failures to calling admin
  pages; do not convert these failures to empty data unless the page explicitly
  marks the lookup as optional.
- It is acceptable for Go-Live-Checks to remain a static checklist for this
  deploy slice, but mark live DNS/backup verification as a follow-up rather
  than implying automatic verification.
- Avoid schema changes for UI-only admin slices unless data integrity or a
  missing backend contract requires them.

Rationale:
- The user asked to build out as much of the new admin panel as possible and
  deploy the current state. Separate routed slices reduce collision risk between
  agents and avoid rewriting the legacy monolith before parity is reached.

## 2026-05-06 - Administrator User Management Safety Scope

Decision: `/administrator/users` may manage only operationally necessary,
low-surface admin fields for now: user role and trusted-product-submitter
status.

Operational rule:
- Do not expose password hashes, reset tokens, verification tokens, raw session
  data, or secrets in the user-management page/API.
- Role changes must be audited.
- Admins cannot demote their own account.
- The last remaining admin account cannot be demoted.
- Broader account operations such as delete, impersonation, password reset,
  consent editing, or raw profile editing require a separate explicit design
  and risk review before implementation.

Rationale:
- User management is sensitive and production-facing. The current admin need is
  operational visibility plus trusted-submitter control; broader controls would
  increase support/security risk without being needed to finish the admin
  navigation parity slice.

## 2026-05-06 - Administrator List Pagination Compatibility

Decision: new `/administrator` list pages use paginated admin endpoints, while
legacy no-query `/api/admin/products` remains unbounded until `/admin` is fully
retired.

Operational rule:
- `/administrator/products` must pass explicit `q`, `page`, and `limit`.
- `/administrator/ingredients` must pass explicit `q`, `page`, and `limit`.
- Existing legacy `/admin` callers that fetch `/api/admin/products` without
  query parameters keep receiving the full catalog for compatibility.
- Do not remove that compatibility behavior before the legacy `/admin` product
  and recommendation dropdown flows are either migrated or explicitly retired.

Rationale:
- Server-side pagination prevents the new admin from loading/filtering broad
  catalog data client-side.
- The old monolith still has no pagination controls and uses the no-query
  products endpoint in more than one place, so changing that default would
  silently truncate legacy admin workflows.

## 2026-05-06 - User-Produkte Bulk Moderation

Decision: `/administrator/user-products` uses one capped backend bulk endpoint
for approve actions instead of frontend-chunking single approve calls.

Operational rule:
- Bulk approve endpoint is `PUT /api/admin/user-products/bulk-approve`.
- Accept at most 100 unique positive IDs per request.
- Return per-item result rows and allow partial failures.
- Audit one summary action rather than one audit entry per selected row.
- Keep existing single approve, reject, publish, and delete endpoints for row
  actions and compatibility.

Rationale:
- Frontend loops over single mutation endpoints are fragile under network
  failures and scale poorly as the moderation queue grows.
- A capped backend endpoint keeps Worker/D1 work bounded while giving the UI a
  single authoritative partial-success response.

## 2026-05-06 - Admin Product Image Upload

Decision: product image upload from the new Administrator product detail uses a
dedicated admin endpoint instead of reusing the legacy public product-module
admin route.

Operational rule:
- Use `POST /api/admin/products/:id/image` for `/administrator/products/:id`.
- Send the loaded `products.version` as `If-Match` when present.
- Store files in the existing `PRODUCT_IMAGES` R2 bucket under
  `products/:id/:uuid.ext`.
- Update both `products.image_url` and `products.image_r2_key`, bump
  `products.version` when the column exists, and audit before/after image
  fields.
- Keep `POST /api/products/:id/image` compatible for existing
  `UserProductForm` / `ImageCropModal` usage.

Rationale:
- Admin Product Detail needs the same optimistic-locking semantics as other
  admin mutations.
- The existing non-versioned route remains useful compatibility surface, but
  should not be the write path for the rebuilt admin editor.

## 2026-05-07 - Admin Shop Links, Public Legal Fallback, Audit-Log Removal

Decision: Product Detail owns product shop-link editing, public legal pages use
published DB documents with static fallback, and the visible Audit-Log surface is
removed.

Operational rule:
- Use `/api/admin/products/:id/shop-links` for product shop-link CRUD.
- A product may have multiple shop links, but the active primary link is mirrored
  into legacy `products.shop_link` and affiliate owner columns for older public
  and admin compatibility paths.
- Manual link rechecks use the admin recheck endpoint and persist
  `product_shop_link_health`.
- Public legal pages fetch `/api/legal-documents/:slug`; if no published
  document exists, they render the static legal copy.
- Do not re-add `/administrator/audit-log` or `/api/admin/audit-log` unless the
  owner explicitly requests a new audit review surface.

Rationale:
- The owner wants shop management directly at the product, including multiple
  shops and link-health handling.
- Legal copy should be editable from admin without risking empty public legal
  pages during transition.
- Audit-Log was explicitly removed from the admin workflow to reduce surface
  area before launch.
