# Handoff

Last updated: 2026-05-07

## Exact Continuation Point

The Wirkstoffe/Formen rebuild has been implemented, remote-migrated, deployed,
and postflight-checked.

Remote D1 `supplementstack-production` has these migrations applied:

- `0069_ingredient_lookup_indexes.sql`
- `0070_ingredient_precursors.sql`
- `0071_consolidate_l_carnitine_forms.sql`

Final deployed preview:

- `https://e3bb987b.supplementstack.pages.dev`
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
  - login/session persistence
  - stack create/edit/product add/remove/replacement
  - stack form selection for Wirkstoffe with forms
  - user product submit with ingredient/form rows
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
