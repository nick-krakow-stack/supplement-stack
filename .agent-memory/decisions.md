# Decisions

Last updated: 2026-05-06

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

- `AGENTS.md` and `CLAUDE.md` must point to `.agent-memory/*`.
- `.claude/memory.md` is now a pointer/compatibility file, not the canonical memory.

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

Decision: use `scripts/update-agent-handoff.ps1` for cheap automatic handoff snapshots.

Claude Code integration:

- `.claude/settings.json` runs the script on `PreCompact`.
- `.claude/settings.json` also runs the script after Bash tool use.

Rationale:

- Protects against token/session limits without requiring manual handoff.
- Avoids model-token usage because the snapshot is generated from git status and existing memory files.
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
