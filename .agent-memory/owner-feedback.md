# Pending Owner Feedback

Durable capture for owner browser QA, diff feedback, and multi-change
website/admin requests that must survive context compression.

Automatic capture comes from the UserPromptSubmit hook when prompt text is
available. Manual fallback:
`powershell -NoProfile -ExecutionPolicy Bypass -File ./scripts/append-owner-feedback.ps1 -Text "<feedback>"`.

Use this file for pending owner feedback only. Move completed work into
`.agent-memory/current-state.md` or `.agent-memory/handoff.md` when it is
implemented, verified, or explicitly deferred.

## Pending Entries

### 2026-05-12 - Production Dashboard Deploy Mismatch

- Source: owner live browser QA on `https://supplementstack.de/administrator/dashboard`
- Status: pending fix after hook stabilization

The owner reported that the dashboard on `supplementstack.de` still looked
unchanged although Cloudflare showed a deployment.

Evidence gathered locally before pausing for hook work:

- Local source contains the dashboard changes in
  `frontend/src/pages/administrator/AdministratorDashboardPage.tsx`.
- Local `frontend/dist/assets/AdministratorDashboardPage-D2NgP-5_.js`
  contains `Neuanmeldungen`, `Neue Stacks`, `Backlinks`,
  `Abmeldungen`, and `Quellen & Anmeldungen`.
- Live `https://supplementstack.de/administrator/dashboard` referenced
  `assets/index-BzefRACG.js`.
- Fetching live assets found no `Neuanmeldungen`, `Neue Stacks`,
  `Quellen & Anmeldungen`, `Stacks im Zeitraum`, or `Katalog-Risiko` in the
  live JS bundle.
- `wrangler pages deployment list --project-name supplementstack` showed a
  latest production deployment with source `9c67ed7`, while the local branch
  HEAD was `d9c8916 Add referral attribution dashboard`.

Required outcome:

- Ensure the production deployment under `https://supplementstack.de` actually
  serves a build containing the current dashboard code.
- Verify by fetching live JS/assets and by browser QA on the live admin
  dashboard.
- Avoid claiming deployed/fixed until live assets prove the new strings are
  present.

### 2026-05-12 - Admin Wirkstoffe Page Owner Comments

- Source: owner browser diff comments on
  `https://supplementstack.de/administrator/ingredients`
- Status: pending implementation after hook stabilization

Owner requested the following changes for the Wirkstoffe page:

1. Bearbeitungsstand badges should not repeat nouns after counts.
   Example: `Synonyme: 1 Synonym` should become `Synonyme: 1`, or
   `Synonyme: fehlt` when missing. Apply the same rule to all completion badges.
2. The modal opened by `Haupt setzen` should manage all three recommendation
   slots at once: `Haupt`, `Alt. 1`, `Alt. 2`.
3. That recommendation modal must auto-filter/set the current Wirkstoff.
   Example: for Magnesium, it must not allow selecting unrelated products like
   Omega-3 oil.
4. `B-Vitamin-Komplex` should not be treated as a Wirkstoff. Individual
   B-vitamins should be listed instead.
5. `DPA` belongs under Omega-3 as a sub-Wirkstoff and should not appear as a
   separate top-level Wirkstoff.
6. Remove the right actions column. `Details` should open by clicking the
   Wirkstoff name in the left column. `Wissen` and `Richtwerte` are already
   represented in the second column.
7. Fix the overlap between the search icon and placeholder `Wirkstoff suchen`.
8. Add a Wirkstoffgruppe dropdown filter, with groups such as `Vitamine`,
   `Mineralstoffe`, `Spurenelemente`, `Enzyme`, and all other existing groups.

Relevant code areas already identified:

- `frontend/src/pages/administrator/AdministratorIngredientsPage.tsx`
- `frontend/src/pages/administrator/admin.css`
- `frontend/src/api/admin.ts`
- `functions/api/modules/admin.ts`
- D1 migrations may be needed only if data cleanup cannot be handled safely by
  filtering/sub-Wirkstoff relationships.

