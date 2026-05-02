# Supplement Stack Deployment

Status: Cloudflare-native line is active. Do not use the old SQLite/backend
deployment notes for production-like work.

## Runtime

- Frontend: React + Vite + TypeScript + Tailwind CSS
- API: Cloudflare Pages Functions with Hono
- Database: Cloudflare D1, database name `supplementstack-production`
- Product images: Cloudflare R2 bucket `supplement-stack-images`
- KV binding: `RATE_LIMITER`
- Build output: `frontend/dist`
- Cloudflare config: `wrangler.toml`

## Cloudflare Bindings

`wrangler.toml` is the deployment source of truth for Cloudflare bindings:

- D1 binding `DB`
- D1 migrations directory `./d1-migrations`
- R2 binding `PRODUCT_IMAGES`
- KV binding `RATE_LIMITER`
- Pages build output directory `frontend/dist`

Do not duplicate raw secrets or token values in documentation. GitHub Actions
and local shells should receive Cloudflare credentials from secret stores or
local ignored scripts.

## Local Setup

```powershell
.\scripts\setup-local-dev.ps1
```

For frontend development:

```powershell
cd frontend
npm run dev
```

For project-specific Cloudflare commands, load the local ignored context first:

```powershell
. .\scripts\use-supplementstack-cloudflare.local.ps1
npx wrangler whoami
```

Create the local file from `scripts/use-supplementstack-cloudflare.example.ps1`
and fill it with local values outside Git.

## Manual Wrangler Operations

Apply remote D1 migrations:

```powershell
npx wrangler d1 migrations apply supplementstack-production --remote
```

Build and deploy Pages manually:

```powershell
cd frontend
npm run build
cd ..
Copy-Item -Recurse -Force functions frontend/dist/functions
npx wrangler pages deploy frontend/dist --project-name supplementstack
```

The deploy workflow performs the same broad sequence in CI.

## GitHub Actions

Active workflow files:

- `.github/workflows/deploy.yml` - builds frontend, installs functions deps,
  applies D1 migrations, copies `functions/` into `frontend/dist/`, deploys to
  Cloudflare Pages.
- `.github/workflows/d1-backup.yml` - scheduled and manual D1 export workflow.
- `.github/workflows/ci.yml` - Cloudflare-line CI for frontend and Pages
  Functions checks.

Required GitHub repository secrets:

- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`

The Cloudflare token must have the scopes required for Pages deploys, D1
migrations/exports, R2/KV binding access as needed, and account/project reads.

## D1 Backup Workflow

`.github/workflows/d1-backup.yml` runs daily at 03:00 UTC and supports
`workflow_dispatch`.

It exports the configured production D1 database with:

```bash
npx wrangler d1 export supplementstack-production --remote --output "$BACKUP_FILE"
```

Then it uploads the SQL export as a GitHub Actions artifact with 30-day
retention.

Manual web UI test:

1. Open the GitHub repository.
2. Go to Actions.
3. Select `D1 Daily Backup`.
4. Choose `Run workflow` on `main`.
5. Wait for the run to finish.
6. Open the completed run and confirm the artifact named
   `d1-backup-<run-id>-<date>.sql` exists.
7. Inspect the log only for command success/failure, not for secret values.

CLI/API test requires GitHub CLI or an authenticated GitHub API request. Do not
paste tokens into commands or docs.

## Verification Checklist

- `npm run build` succeeds in `frontend/`.
- `frontend/dist/functions/api/[[path]].ts` exists before Pages deploy.
- `npx wrangler d1 migrations list supplementstack-production --remote`
  reflects the expected migration state.
- Pages preview root returns HTTP 200.
- API smoke checks use same-origin `/api` on deployed previews.
- D1 backup workflow can be manually triggered and produces a retained
  artifact.

## Legacy Notes

Older docs may mention SQLite, a separate backend server, `infra/`, or
`rebuild-main`. Treat those as historical unless verified against current code
and migrations.
