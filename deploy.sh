#!/bin/bash

# Supplement Stack - Production Deployment Script
# Führen Sie dieses Skript in Ihrem lokalen Terminal aus

set -e

echo "🚀 Supplement Stack - Production Deployment"
echo "=========================================="

# Prüfe ob Wrangler authentifiziert ist
echo "📋 Prüfe Cloudflare Authentication..."
if ! npx wrangler whoami &>/dev/null; then
    echo "❌ Nicht bei Cloudflare angemeldet."
    echo "Führen Sie zuerst aus: npx wrangler auth login"
    echo "Oder setzen Sie den API-Token: export CLOUDFLARE_API_TOKEN='Ihr-Key'"
    exit 1
fi

echo "✅ Cloudflare Authentication erfolgreich"

# 1. Dependencies installieren
echo "📦 Installiere Dependencies..."
npm ci

# 2. Build erstellen
echo "🔨 Erstelle Production Build..."
npm run build

# 3. D1 Datenbank erstellen (falls nicht vorhanden)
echo "🗄️  Prüfe D1 Datenbank..."
if ! npx wrangler d1 list | grep -q "supplement-stack-production"; then
    echo "🆕 Erstelle neue D1 Datenbank..."
    npx wrangler d1 create supplement-stack-production
    echo "⚠️  WICHTIG: Kopieren Sie die Database ID in wrangler.jsonc!"
    read -p "Drücken Sie Enter wenn Sie die Database ID eingetragen haben..."
else
    echo "✅ D1 Datenbank bereits vorhanden"
fi

# 4. Migrationen anwenden
echo "🔄 Führe Datenbank-Migrationen aus..."
npx wrangler d1 migrations apply supplement-stack-production --remote

# 5. Seed-Daten importieren
echo "🌱 Importiere Seed-Daten..."
npx wrangler d1 execute supplement-stack-production --remote --file=./seed.sql

# 6. Pages-Projekt erstellen (falls nicht vorhanden)
echo "⚡ Prüfe Cloudflare Pages Projekt..."
if ! npx wrangler pages project list | grep -q "supplement-stack"; then
    echo "🆕 Erstelle Cloudflare Pages Projekt..."
    npx wrangler pages project create supplement-stack --production-branch main
else
    echo "✅ Pages Projekt bereits vorhanden"
fi

# 7. Deployment durchführen
echo "🚀 Starte Production Deployment..."
npx wrangler pages deploy dist --project-name supplement-stack

# 8. Erfolg-Meldung
echo ""
echo "🎉 Deployment erfolgreich abgeschlossen!"
echo "📱 Live-URL: https://supplement-stack.pages.dev"
echo "🔧 Admin-Interface: https://supplement-stack.pages.dev/admin"
echo "🎮 Demo-Modus: https://supplement-stack.pages.dev/?demo=true"
echo ""
echo "📊 Nächste Schritte:"
echo "- Testen Sie die Live-URL"
echo "- Erstellen Sie einen Admin-Account"
echo "- Konfigurieren Sie Custom Domain (optional)"