# GitHub Secrets Setup für automatisches Cloudflare Deployment

Um automatisches Deployment über GitHub Actions zu aktivieren, müssen die folgenden Secrets im GitHub Repository gesetzt werden:

## Repository Settings > Secrets and Variables > Actions

### Required Secrets:

1. **CLOUDFLARE_API_TOKEN**
   - Value: `IrSFUcV2uMusmZA2hlGHBmlxUSdy-Im8du_teCSi`
   - Description: Cloudflare API Token für Deployment-Berechtigung

2. **CLOUDFLARE_ACCOUNT_ID** 
   - Value: `d8f0c1d7e9e70f806edb067057227cbe`
   - Description: Cloudflare Account ID

## Setup Steps:

1. Gehe zu: https://github.com/nick-krakow-stack/supplement-stack/settings/secrets/actions
2. Klicke auf "New repository secret"
3. Füge beide Secrets hinzu wie oben beschrieben
4. Nach dem Setup deployt GitHub automatisch bei jedem Push auf den main-Branch

## Deployment Status:

Nach dem Setup kannst du den Deployment-Status hier verfolgen:
- https://github.com/nick-krakow-stack/supplement-stack/actions

## Live URLs:

- **Cloudflare Pages URL**: https://supplementstack.pages.dev
- **Custom Domain**: https://supplementstack.de (falls konfiguriert)
- **Current Deployment**: https://624680ee.supplementstack.pages.dev

## Manual Deployment:

Falls nötig, kannst du auch manuell deployen mit:
```bash
npm run build
npx wrangler pages deploy dist
```