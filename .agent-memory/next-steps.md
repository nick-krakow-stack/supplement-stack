# Next Steps

Last updated: 2026-05-02

## Current Baseline

Phase C is complete. The integrated Phase D rollout is complete:

- Product recommendations rename and temporary compatibility layer are deployed.
- Admin translations MVP and expansion are committed and deployed to Cloudflare Pages preview.
- D1 backup verification is complete: GitHub Actions backup has run manually and automatically, and token scopes are verified.
- Worktree cleanup is complete in `216e2df`: tracked research source files 01/02 are committed and local `.claude/commands/` files are ignored.
- `wrangler.toml` already contains `pages_build_output_dir = "frontend/dist"`.
- Production custom domain `supplementstack.de` is live in parallel to Cloudflare Pages preview URLs. All recent deploys have been published to both the subdomain and live domain. Public SEO indexing is intentionally deferred until legal/compliance is cleared.

D1 backup is done and is not a next step. Production-domain promotion is done and is not a next step.

## Go-Live / Production Readiness

Priority 1 - Usability QA and polish for logged-in user, demo, and admin:

- Run the primary logged-in user flows end to end: register/login, search ingredient, open product modal, add product to stack, edit/remove stack items, wishlist, profile, and user product management.
- Run the demo flows end to end without login, including ingredient search, product selection, add-to-stack, modal focus behavior, and empty/error states.
- Run authenticated admin UI smoke tests, especially product management, dose recommendations, translation editing for Ingredients/Dose Recommendations/Verified Profiles/Blog Posts, affiliate/user link distinction, and moderation states.
- Prioritize mobile ergonomics and obvious next actions for Kevin, Sabine, and Marco before expanding scope.

Priority 2 - Legal and compliance final review (blocker for SEO indexing/public launch, not for live-domain availability):

- Review Impressum, Datenschutz, cookie handling/banner needs, health disclaimer, and affiliate disclosure.
- Confirm German health-claim wording and affiliate labeling before public launch.
- Do not start SEO indexing until legal/compliance is cleared.

Priority 3 - Content, data, and guideline QA:

- Validate D3 and additional ingredient pages against source data and visible UI copy.
- Check product data, product recommendations, affiliate/user link distinction, and dosage recommendation display.
- Verify default German recommendation sources and wording against DGE/D-A-CH, EFSA/BfR, and cited study data where applicable.

Priority 4 - I18n / localization architecture track:

- Launch remains DE-only, but public/i18n translation capability must be planned and built as a real product track, not treated as fully deferred.
- Architecture must support locale plus country/guideline-set selection, not only text translation.
- Use German/DGE/D-A-CH as the default guideline set for DE, while allowing other countries to configure different sources and rules, e.g. USA should not inherit DGE/D-A-CH by default.
- Admin translation management already exists for several entities; public playback, locale routing, country-specific recommendations, and guideline-set metadata still need design and implementation.

Priority 5 - Test coverage baseline:

- Vitest currently passes with `--passWithNoTests`.
- Add targeted API and UI smoke/unit tests for the launch-critical paths instead of relying only on empty-suite success.
- Suggested first coverage: API base behavior, D3 search, dose recommendations response shape, product modal recommendation loading, admin translations route auth/validation.

Priority 6 - SEO and indexing readiness (gated by legal/compliance):

- Prepare robots, sitemap, page metadata, canonical URLs, and OpenGraph/Twitter preview metadata.
- Enable indexing only after legal/compliance approval and final production-domain content checks.

## Deferred / Later

- Compatibility cleanup migration: drop the temporary `recommendations` compatibility view and triggers after old previews/deploy windows are irrelevant.

## Completed Reference

- Production domain:
  - `cebd31a` - Memory: Production domain live, reorganize next-steps (superseded by current usability-first priority order and i18n planning constraint).
- Phase C:
  - `b1fd347` - Hono module split.
  - `dd58ba2` - Public dose recommendations API.
  - `4482a5f` - Admin audit logging.
  - `11440f5` - Server-side unit conversion.
  - `b866c3d` - Phase C tech-debt cleanup and `pages_build_output_dir`.
- Phase D:
  - `862ed57` - Product recommendations rename, admin translations MVP, Cloudflare-line docs/CI.
  - `49ed83e` - Admin translations expansion.
  - `f3fa88c` - Memory: Record admin translations expansion deploy.
  - `216e2df` - Ops: Track research sources and ignore local Claude commands.
- UX polish:
  - `e8f2bbc` - UX: Auto-focus name field when opening 'Produkt hinzufuegen' modal.
  - `078fc31` - UX: Auto-focus search field in 'Produkt hinzufuegen' modal (Demo + Stack-Workspace).
