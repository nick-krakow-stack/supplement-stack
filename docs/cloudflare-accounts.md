# Cloudflare Accounts

Dieses Projekt sollte mit einem eigenen Cloudflare-Token und der richtigen Account-ID betrieben werden, statt sich auf das globale Wrangler-Login zu verlassen.

## Empfohlener Workflow

1. Nutze `scripts/use-supplementstack-cloudflare.local.ps1`
2. Trage dort den Token fuer den `supplement-stack`-Account ein
3. Lade die Session vor Deploys oder Remote-Migrationen:

```powershell
. .\scripts\use-supplementstack-cloudflare.local.ps1
```

Danach laufen `wrangler`-Befehle fuer dieses Projekt mit den projektlokalen Zugangsdaten statt mit dem global aktiven Cloudflare-Login.

## Warum so?

- Zwei verschiedene Cloudflare-Accounts kollidieren sonst schnell ueber den globalen Wrangler-Status
- Projektlokale Tokens sind reproduzierbar und terminalunabhaengig
- Das andere Projekt bleibt unberuehrt

## Typische Befehle

```powershell
. .\scripts\use-supplementstack-cloudflare.local.ps1
npx wrangler whoami
npx wrangler d1 migrations apply supplementstack-production --remote
npx wrangler pages deploy frontend/dist --project-name supplementstack
```

## Hinweise

- `scripts/*.local.ps1` bleibt lokal und wird ueber `.git/info/exclude` ignoriert
- Die `supplement-stack`-Account-ID ist bereits in `scripts/use-supplementstack-cloudflare.local.ps1` vorbelegt
- `wrangler.toml` enthaelt bereits die projektspezifischen Bindings fuer D1 und R2
- Fuer GitHub Actions bleiben die Secrets separat in GitHub hinterlegt
