# Next Steps

Last updated: 2026-05-02

## Current Baseline

Phase C is complete. The integrated Phase D rollout is complete:

- Product recommendations rename and temporary compatibility layer are deployed.
- Admin translations MVP and expansion are committed and deployed to Cloudflare Pages preview.
- D1 backup verification is complete: GitHub Actions backup has run manually and automatically, and token scopes are verified.
- Worktree cleanup is complete in `216e2df`: tracked research source files 01/02 are committed and local `.claude/commands/` files are ignored.
- `wrangler.toml` already contains `pages_build_output_dir = "frontend/dist"`.

D1 backup is done and is not a next step.

## Go-Live / Production Readiness

Priority 1 - Production deploy and live-domain verification:

- Confirm the current preview build that should become production.
- Verify whether the production/custom domain points at the intended Cloudflare Pages deployment.
- Promote or redeploy the approved build to production.
- Smoke test production/custom domain: root page, D3 search, dose recommendation API, product modal/product detail, admin translation routes returning 401 unauthenticated.

Priority 2 - Legal and compliance final review:

- Review Impressum, Datenschutz, cookie handling/banner needs, health disclaimer, and affiliate disclosure.
- Confirm German health-claim wording and affiliate labeling before public launch.
- Do not start SEO indexing until legal/compliance is cleared.

Priority 3 - Content and data QA:

- Validate D3 and additional ingredient pages against source data and visible UI copy.
- Check product data, product recommendations, affiliate/user link distinction, and dosage recommendation display.
- Run an authenticated admin UI smoke test, including translation editing for Ingredients, Dose Recommendations, Verified Profiles, and Blog Posts.

Priority 4 - Public i18n decision / playback:

- Only needed if launch should be multilingual.
- Admin translation management exists; public-facing translation playback is separate and was not changed.
- Decide whether public pages remain DE-only for launch or need language selection/fallback behavior first.

Priority 5 - Test coverage baseline:

- Vitest currently passes with `--passWithNoTests`.
- Add targeted API and UI smoke/unit tests for the launch-critical paths instead of relying only on empty-suite success.
- Suggested first coverage: API base behavior, D3 search, dose recommendations response shape, product modal recommendation loading, admin translations route auth/validation.

Priority 6 - SEO and indexing readiness:

- Prepare robots, sitemap, page metadata, canonical URLs, and OpenGraph/Twitter preview metadata.
- Enable indexing only after secret rotation, production-domain verification, and legal/compliance approval.

Priority 7 - Later compatibility cleanup:

- Add a cleanup migration later to drop the temporary `recommendations` compatibility view and triggers after old previews/deploy windows are irrelevant.

## Completed Reference

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
