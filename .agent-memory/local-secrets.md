# Local Secret Locations

Last updated: 2026-04-29

This file documents where local development credentials live. It must never contain raw secret values.

## Local Files

- `scripts/use-supplementstack-cloudflare.local.ps1`: local Cloudflare token/account environment for this project.
- `frontend/.env.local`: local frontend environment values such as API base URL.
- `functions/.dev.vars`: optional local Pages/Workers development secrets if needed.
- `.claude/settings.local.json`: Claude Code local permissions/settings. May reference local-only credentials or command allowlists.

## Remote / Hosted Secrets

- Cloudflare Pages secrets: managed through Wrangler / Cloudflare Dashboard.
- GitHub Actions secrets: managed in the GitHub repository settings.

## Rules

- Do not commit raw secret values.
- Do not copy raw secret values into `.agent-memory/*`, `AGENTS.md`, `CLAUDE.md`, docs, or chat summaries.
- It is acceptable to document the location and intended use of a secret.
- Before public launch / Google indexing, rotate production tokens and secrets.

