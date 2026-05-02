# Handoff

Last updated: 2026-05-02
Update mode: Manual memory update after user domain/i18n/usability info and Claude UX deploys

## Continuation Point

Next work should start with usability QA and polish for the actual product
surfaces:

- Logged-in user: register/login, search, product modal, add product to stack,
  edit/remove stack items, wishlist, profile, and user product management.
- Demo: no-login ingredient search, product selection, add-to-stack, modal focus
  behavior, empty states, and error states.
- Admin: product management, dose recommendations, translation editing,
  affiliate/user link distinction, and moderation states.

After usability, continue with legal/content/i18n/test/SEO work in that order:

- Legal/compliance remains the blocker for SEO indexing/public launch copy:
  Impressum, Datenschutz, cookie/cookie-banner needs, health disclaimer,
  affiliate disclosure, German health-claim wording, and affiliate labeling.
- Content/data QA remains required for D3 and other ingredient pages, product
  data, product recommendations, dosage display, and German default guideline
  wording against source data.
- I18n/localization is a planned track. Launch remains DE-only, but architecture
  must support locale + country + guideline-set, not just translated text.
  German/DGE/D-A-CH is the DE default; other countries need configurable
  recommendation sources and rules, e.g. USA must not inherit DGE/D-A-CH by
  default.
- Add targeted API/UI smoke and unit tests for launch-critical paths.
- SEO/indexing preparation can continue, but indexing stays gated until
  legal/compliance approval and final production-domain content checks.

## Current Baseline

- Production custom domain `supplementstack.de` is live in parallel to
  Cloudflare Pages preview URLs and intentionally not indexed yet.
- Recent deploys have been published to both the subdomain and live domain.
- Phase B, Phase C, and Phase D rollout are complete.
- Product recommendations rename and temporary compatibility layer are deployed.
- Admin translations MVP and expansion are committed and deployed.
- D1 backup verification is complete.
- `wrangler.toml` already contains `pages_build_output_dir = "frontend/dist"`.
- Compatibility cleanup remains later: drop the temporary `recommendations`
  compatibility view and triggers after old previews/deploy windows are
  irrelevant.

## Latest Commits / Deploys

- `078fc31` - UX: Auto-focus search field in 'Produkt hinzufuegen' modal
  (Demo + Stack-Workspace). Cloudflare Pages deploy successful per
  `.claude/SESSION.md` at 2026-05-02 13:28:28; preview URL not recorded.
- `e8f2bbc` - UX: Auto-focus name field when opening 'Produkt hinzufuegen'
  modal. Cloudflare Pages deploy successful per `.claude/SESSION.md` at
  2026-05-02 13:22:20; preview URL not recorded.
- `cebd31a` - Memory: Production domain live, reorganize next-steps.
- `216e2df` - Ops: Track research sources and ignore local Claude commands.
- `49ed83e` - Feature: Expand admin translation management.
- `862ed57` - Feature: Phase D product recommendations and translations.

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
- Do not revert unrelated or user/Claude changes.
- Use `dose_recommendations` for dosage recommendations.
- Keep implementation compatible with Cloudflare Workers / Pages Functions.
- Review untracked files before deleting or committing them.
