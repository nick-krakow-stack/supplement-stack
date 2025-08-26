# Cloudflare Deployment Guide - Supplement Stack

## 📋 **Deployment Checklist**

### ✅ Vorbereitet:
- [x] GitHub Repository: https://github.com/nick-krakow-stack/supplement-stack
- [x] Build System: Hono + TypeScript + Cloudflare Pages
- [x] Database Schema: D1 SQLite Migrationen bereit
- [x] Project Name: `supplement-stack`
- [x] Account ID: `d8f0c1d7e9e70f806edb067057227cbe`

### 🔑 **Token-Berechtigungen erforderlich:**
- Account: `Cloudflare Pages:Edit`, `D1:Edit`, `Account Settings:Read`
- Zone: `Zone Settings:Read`, `Zone:Read` 
- User: `User Details:Read`

### 🚀 **Deployment-Schritte (nach Token-Update):**

1. **D1 Datenbank erstellen:**
   ```bash
   npx wrangler d1 create supplement-stack-production
   ```

2. **Database ID in wrangler.jsonc eintragen**

3. **Migrationen anwenden:**
   ```bash
   npx wrangler d1 migrations apply supplement-stack-production
   ```

4. **Seed-Daten importieren:**
   ```bash
   npx wrangler d1 execute supplement-stack-production --file=./seed.sql
   ```

5. **Cloudflare Pages Projekt erstellen:**
   ```bash
   npx wrangler pages project create supplement-stack --production-branch main
   ```

6. **Deployment:**
   ```bash
   npm run deploy:prod
   ```

## 🎯 **Nach erfolgreichem Deployment:**
- Live-URL: `https://supplement-stack.pages.dev`
- Admin-Interface: `/admin`
- Demo-Modus: `/?demo=true`
- API-Dokumentation: Siehe README.md

## 🔧 **Local Development:**
```bash
npm run db:migrate:local  # Lokale DB
npm run db:seed           # Test-Daten
npm run dev:d1            # Development mit D1
```