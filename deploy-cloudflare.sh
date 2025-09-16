#!/bin/bash

# Supplement Stack - Cloudflare Deployment Script
# Lädt automatisch die Cloudflare-Konfiguration und deployt das Projekt

set -e  # Exit on error

echo "🚀 Supplement Stack - Cloudflare Deployment"
echo "=========================================="

# Check if config file exists
if [[ ! -f ".cloudflare-config" ]]; then
    echo "❌ Fehler: .cloudflare-config Datei nicht gefunden!"
    echo "   Bitte erstellen Sie die Konfigurationsdatei mit Ihren Cloudflare-Daten."
    exit 1
fi

# Load configuration
echo "📋 Lade Cloudflare-Konfiguration..."
source .cloudflare-config

# Verify required variables
if [[ -z "$CLOUDFLARE_API_TOKEN" || -z "$PROJECT_NAME" || -z "$CLOUDFLARE_ACCOUNT_ID" ]]; then
    echo "❌ Fehler: Unvollständige Konfiguration in .cloudflare-config"
    echo "   Erforderlich: CLOUDFLARE_API_TOKEN, PROJECT_NAME, CLOUDFLARE_ACCOUNT_ID"
    exit 1
fi

echo "✅ Konfiguration geladen:"
echo "   📧 Account: $CLOUDFLARE_EMAIL"
echo "   🏷️  Projekt: $PROJECT_NAME"
echo "   🌐 Domain: $CLOUDFLARE_DOMAIN"
echo "   🔗 Branch: $PRODUCTION_BRANCH"

# Set environment variables for wrangler
export CLOUDFLARE_API_TOKEN="$CLOUDFLARE_API_TOKEN"
export CLOUDFLARE_ACCOUNT_ID="$CLOUDFLARE_ACCOUNT_ID"

echo ""
echo "🔨 Building project..."
npm run build

if [[ $? -ne 0 ]]; then
    echo "❌ Build failed! Deployment aborted."
    exit 1
fi

echo "✅ Build successful!"

echo ""
echo "📦 Deploying to Cloudflare Pages..."
echo "   Target: $PROJECT_NAME"
echo "   URL: https://$PROJECT_NAME.pages.dev"

# Deploy using wrangler
wrangler pages deploy dist \
    --project-name="$PROJECT_NAME"

if [[ $? -eq 0 ]]; then
    echo ""
    echo "🎉 Deployment erfolgreich!"
    echo ""
    echo "📊 Deployment Details:"
    echo "   🌐 Production URL: https://$CLOUDFLARE_DOMAIN"
    echo "   📄 Pages URL: https://$PROJECT_NAME.pages.dev"
    echo "   💾 Database: $DATABASE_NAME"
    echo ""
    echo "🔧 Nächste Schritte:"
    echo "   1. Domain-Konfiguration überprüfen"
    echo "   2. SSL-Zertifikat verifizieren"
    echo "   3. Database-Migrationen prüfen"
    echo ""
    echo "✨ Deployment abgeschlossen!"
else
    echo "❌ Deployment fehlgeschlagen!"
    exit 1
fi