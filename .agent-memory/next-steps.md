# Next Steps

Last updated: 2026-05-12

## 2026-05-12 - Hook-Betrieb

- Claude-Hooks aus der aktiven Projektkonfiguration entfernt.
- Legacy Hook-Dateien in `.claude/hooks` entfernt.
- Zentrale Codex-Hooks aktiv und versioniert: `UserPromptSubmit` + `Stop` auf `.codex/hooks/agent-protocol.ps1`.
- PreCompact/PreToolUse/PostToolUse werden nur noch manuell im Prozess dokumentiert, nicht automatisch verdrahtet.
- `AGENTS.md` ist jetzt die einzige zentrale Startup-Datei; `CLAUDE.md` ist aus der Pflichtstartliste entfernt.
- Nächster operativer Fokus: aktive To-do-Datei `.agent-memory/current-task.md` als Fortschritts-Checklist führen, jede Step-/Feedback-Erfassung in `.agent-memory/feedback.md` persistieren, Stop/Handoff nach jeder Aufgabe aktualisieren.

## Immediate

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
