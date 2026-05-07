# Next Steps

Last updated: 2026-05-07

## Immediate

- Run cleanup validation:
  - `functions`: `npx tsc -p tsconfig.json --noEmit`
  - `frontend`: `npx tsc --noEmit`
  - `frontend`: `npm run lint --if-present`
  - `frontend`: `npm run build`
  - `node --check scripts/admin-browser-smoke.mjs`
  - `node --check scripts/user-browser-smoke.mjs`
- Commit the current deployed admin code plus cleanup so the worktree is clean.
- Do not delete or revert the new `/administrator` implementation, migrations,
  smoke scripts, or backend admin/security changes.

## Admin QA

- Use the next owner browser-QA pass for detailed usability notes on:
  - Product-QA
  - Product Detail
  - Ingredient Detail
  - Interactions
  - user stack/product entry surfaces
- Final authenticated QA order:
  1. Login/session persistence.
  2. Stack create/edit/product add/remove/replacement and user product submit.
  3. Product Detail overview/moderation/affiliate save.
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
  and stack mail.
- Verify outbound headers include DKIM alignment for
  `supplementstack.de`.
- Keep content/science/legal review as a separate pre-indexing gate.

## Later Refactors

- Split `functions/api/modules/admin.ts` by domain after authenticated QA.
- Keep `/administrator` as the only frontend admin route. `/api/admin` remains
  the backend API namespace.
- Consider table-rebuild cleanup migrations only after the current admin panel
  is QA-accepted.
