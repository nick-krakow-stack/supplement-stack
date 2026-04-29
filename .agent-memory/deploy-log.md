# Deploy Log

Last updated: 2026-04-29

## Latest Known Production State

According to prior memory, Phase B database migrations 0026-0035 are live in production D1.

Latest relevant DB commit:

- `9a5f523` - Phase B DB refactor complete.

Latest deploy explicitly recorded in `.claude/SESSION.md`:

- 2026-04-28 16:10:17
- Commit `3c14e0d`
- Cloudflare Pages deploy
- Fix: dosage cards show "Keine Empfehlung verfuegbar" instead of fake fallback values.

## Follow-Up

The D1 backup workflow exists but should be manually triggered once in GitHub Actions to verify token scopes:

- Actions -> "D1 Daily Backup" -> Run workflow.

When a future agent deploys or applies migrations, append the exact date, commit, command summary, and verification result here.

