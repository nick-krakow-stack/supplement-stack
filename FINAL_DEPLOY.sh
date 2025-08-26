#!/bin/bash

# SUPPLEMENT STACK - FINAL DEPLOYMENT SCRIPT
# Führen Sie dieses Skript in Ihrem lokalen Terminal aus

echo "🚀 SUPPLEMENT STACK - PRODUCTION DEPLOYMENT"
echo "============================================"

# 1. Cloudflare Credentials setzen
export CLOUDFLARE_API_KEY="6de775cfcd599b036dae4a07cf8309d956f6d"
export CLOUDFLARE_EMAIL="IHRE-EMAIL@domain.com"  # <-- BITTE ANPASSEN!
export CLOUDFLARE_ACCOUNT_ID="d8f0c1d7e9e70f806edb067057227cbe"

# 2. Authentication testen
echo "🔐 Teste Cloudflare Authentication..."
npx wrangler whoami
if [ $? -ne 0 ]; then
    echo "❌ Authentication fehlgeschlagen!"
    echo "Bitte überprüfen Sie Ihre E-Mail-Adresse und API-Key."
    exit 1
fi

echo "✅ Authentication erfolgreich!"

# 3. Dependencies installieren
echo "📦 Installiere Dependencies..."
npm ci

# 4. Build erstellen
echo "🔨 Erstelle Production Build..."
npm run build

# 5. D1 Datenbank prüfen/erstellen
echo "🗄️  Prüfe D1 Datenbank..."
npx wrangler d1 list | grep -q "supplement-stack-production" || {
    echo "🆕 Erstelle D1 Datenbank..."
    npx wrangler d1 create supplement-stack-production
    echo "⚠️  Database ID bereits in wrangler.jsonc konfiguriert"
}

# 6. Migrationen ausführen
echo "🔄 Führe Datenbank-Migrationen aus..."
npx wrangler d1 migrations apply supplement-stack-production --remote

# 7. Seed-Daten importieren
echo "🌱 Importiere Seed-Daten..."
npx wrangler d1 execute supplement-stack-production --remote --file=./seed.sql

# 8. Pages-Projekt prüfen/erstellen
echo "⚡ Prüfe Cloudflare Pages Projekt..."
npx wrangler pages project list | grep -q "supplement-stack" || {
    echo "🆕 Erstelle Pages-Projekt..."
    npx wrangler pages project create supplement-stack --production-branch main
}

# 9. Deployment durchführen
echo "🚀 Deploye zu Cloudflare Pages..."
npx wrangler pages deploy dist --project-name supplement-stack

# 10. Erfolgsmeldung
echo ""
echo "🎉 DEPLOYMENT ERFOLGREICH ABGESCHLOSSEN!"
echo "=========================================="
echo ""
echo "📱 Live-URL: https://supplement-stack.pages.dev"
echo "🔧 Admin-Interface: https://supplement-stack.pages.dev/admin"
echo "🎮 Demo-Modus: https://supplement-stack.pages.dev/?demo=true"
echo ""
echo "🔑 Test-Logins:"
echo "- Admin: admin@supplementstack.dev"
echo "- Demo: Direkt über Demo-Link"
echo ""
echo "✅ Ihre Supplement Stack App ist jetzt live!"