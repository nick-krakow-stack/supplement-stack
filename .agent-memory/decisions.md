# Decisions

Last updated: 2026-05-05

## Stack Item Product References

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
