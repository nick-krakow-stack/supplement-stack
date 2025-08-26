# 🔑 Cloudflare API Token Setup für Supplement Stack

## Problem: Token ungültig
Ihr aktueller Custom Token `IrSFUcV2uMusmZA2hIGHBmlxUSdy-Im8du_teCSi` wird von der Cloudflare API abgelehnt.

## ✅ Lösung: Neuen Token erstellen

### Schritt 1: Cloudflare Dashboard öffnen
1. Gehen Sie zu: https://dash.cloudflare.com/profile/api-tokens
2. Klicken Sie auf "Create Token"
3. Wählen Sie "Custom token"

### Schritt 2: Token-Konfiguration
**Token Name:** `Supplement Stack Deployment`

**Permissions:**
- `Account` → `Cloudflare Pages:Edit`
- `Account` → `Account Settings:Read` 
- `Account` → `D1:Edit`
- `Zone` → `Zone Settings:Read`
- `User` → `User Details:Read`

**Account Resources:**
- `Include` → `All accounts` (oder spezifisch Ihr Account)

**Zone Resources:**
- `Include` → `All zones` (falls Sie Custom Domain verwenden)

### Schritt 3: Token verwenden
Nach der Erstellung erhalten Sie einen neuen Token. Verwenden Sie diesen dann so:

```bash
export CLOUDFLARE_API_TOKEN="Ihr-Neuer-Token"
export CLOUDFLARE_ACCOUNT_ID="d8f0c1d7e9e70f806edb067057227cbe"
npx wrangler whoami
```

## 🚀 Alternative: Global API Key
Falls Custom Token Probleme macht, verwenden Sie Ihren Global API Key:

1. Dashboard → API Keys → Global API Key → View
2. Verwenden Sie diesen Key direkt

```bash
export CLOUDFLARE_API_KEY="Ihr-Global-Key"
export CLOUDFLARE_EMAIL="Ihre-Email@domain.com"
export CLOUDFLARE_ACCOUNT_ID="d8f0c1d7e9e70f806edb067057227cbe"
```

## ⚡ Sofort-Deployment
Sobald Sie einen funktionierenden Token haben, führe ich diese Schritte aus:

1. ✅ Authentication testen
2. ✅ Build erstellen (`npm run build`)
3. ✅ D1 Datenbank Migrationen (`wrangler d1 migrations apply`)
4. ✅ Seed-Daten importieren (`wrangler d1 execute`)
5. ✅ Pages Deployment (`wrangler pages deploy`)

**Dann ist Ihre App live unter: https://supplement-stack.pages.dev** 🎉