# Supplement Stack Implementation Status

Stand: 2026-05-01

This file is a snapshot. For the most current operational context, read:

1. `AGENTS.md`
2. `CLAUDE.md`
3. `.agent-memory/current-state.md`
4. `.agent-memory/handoff.md`
5. `.agent-memory/next-steps.md`

When this file conflicts with code, migrations, or memory, use code and
migrations first, then `.agent-memory/*`.

## Current Phase

- Phase B is complete.
- Phase C is complete.
- Phase D is in progress / being scoped.

Phase C completed the Hono module split, public dose recommendations API,
admin audit logging, server-side unit conversion, and follow-up tech-debt work.

Current Phase D candidates include:

- Rename the old product recommendation table to `product_recommendations`
  without changing runtime behavior.
- Expand the admin CMS with translations support.
- Verify the GitHub Actions D1 backup workflow manually.
- Keep root documentation aligned with the Cloudflare line.

## Active Architecture

Production-like development is Cloudflare-native:

- Frontend: `frontend/src/*`
- API: `functions/api/[[path]].ts`
- API modules: `functions/api/modules/*`
- API helpers: `functions/api/lib/*`
- Database migrations: `d1-migrations/*`
- Cloudflare bindings/config: `wrangler.toml`

The older local backend/SQLite references in historical docs are not the active
production line.

## Backend Status

Implemented on Cloudflare Pages Functions with Hono:

- Auth and current-user endpoints
- Ingredient search, ingredient products, and public dose recommendations
- Product data, product images via R2-related routes, and metadata loading
- Stack CRUD and stack warning flows
- Wishlist routes
- User product routes
- Demo routes, including demo products
- Admin routes for moderation and maintenance surfaces
- Admin audit logging for mutations
- Server-side unit conversion for recommendation/upper-limit comparisons

The current dosage source is `dose_recommendations`. The older
`recommendations` concept is product recommendation data, not dosage guidance.

## Frontend Status

Implemented in React/Vite:

- Landing, demo, search, stacks, wishlist, admin, auth, profile, and user
  product pages
- Centralized API base handling in `frontend/src/api/base.ts`
- Auth context and protected route logic
- Product cards and modal flow for ingredient/product/dosage details
- Legal disclaimer with general affiliate disclosure in the footer
- Production builds use same-origin `/api`; local Vite dev may use
  `VITE_API_BASE_URL`

## Database Status

D1 migrations live in `d1-migrations/`. Local migration files include:

- `0026` populations lookup
- `0027` dose recommendations
- `0028` verified profiles
- `0029` admin audit log
- `0030` translation tables
- `0031` blog posts
- `0032` share links
- `0033` API tokens
- `0034` interactions and ingredient preferred unit changes
- `0035` migration from legacy dosage guidelines to dose recommendations
- `0036` rename of old recommendations to product recommendations, currently
  part of the local Phase D workstream unless remote state confirms otherwise

Confirm remote migration state with Wrangler before deployment decisions.

## Infrastructure Status

- Cloudflare Pages deploy is configured in `.github/workflows/deploy.yml`.
- D1 daily backup is configured in `.github/workflows/d1-backup.yml`.
- Cloudflare-line CI is configured in `.github/workflows/ci.yml`.
- Cloudflare bindings are configured in `wrangler.toml`.
- Local Cloudflare account selection should use a local ignored
  `scripts/use-supplementstack-cloudflare.local.ps1`.
