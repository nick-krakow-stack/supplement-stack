#!/bin/bash

# Quick Deployment Script für Supplement Stack
# Führen Sie dieses Skript in Ihrem lokalen Terminal aus

echo "🚀 Supplement Stack - Quick Deployment"
echo "====================================="

# API-Token setzen (ersetzen Sie durch Ihren aktuellen Token)
export CLOUDFLARE_API_TOKEN="Ihr-Working-API-Token"
export CLOUDFLARE_ACCOUNT_ID="d8f0c1d7e9e70f806edb067057227cbe"

# Test Authentication
echo "🔐 Teste Cloudflare Authentication..."
npx wrangler whoami

# Build & Deploy in einem Schritt
echo "🔨 Build & Deploy..."
npm run build
npx wrangler d1 migrations apply supplement-stack-production --remote
npx wrangler d1 execute supplement-stack-production --remote --file=./seed.sql
npx wrangler pages deploy dist --project-name supplement-stack

echo "✅ Deployment abgeschlossen!"
echo "📱 https://supplement-stack.pages.dev"