# Next Steps

Last updated: 2026-05-07

## Immediate

- Wirkstoffe/Formen rebuild is remote-migrated and deployed. Use
  `https://supplementstack.de` or preview
  `https://a9e5e4d0.supplementstack.pages.dev` for follow-up QA.
- For future visual TODOs, keep `.agent-memory/deployment_images/` and delete
  only completed images inside it.
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
