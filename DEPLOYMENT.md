# 🚀 Cloudflare Pages Deployment Guide

## ✅ Vorbereitung (Bereits erledigt)
- [x] GitHub Repository aktualisiert
- [x] Production Build konfiguriert
- [x] MailerSend System implementiert
- [x] DNS Records bei Cloudflare konfiguriert

## 📋 Manuelle Deployment Schritte

### 1. Cloudflare Pages Projekt erstellen

1. **Gehe zu Cloudflare Dashboard**: https://dash.cloudflare.com/
2. **Pages** → **Create a project**
3. **Connect to Git** → **GitHub** auswählen
4. **Repository**: `nick-krakow-stack/supplement-stack` auswählen
5. **Project Name**: `supplement-stack`
6. **Production Branch**: `main`

### 2. Build Settings konfigurieren

```
Build command: npm run build
Build output directory: dist
Root directory: /
Node.js version: 18
```

### 3. Environment Variables setzen

**In Cloudflare Pages → Settings → Environment variables:**

```bash
# Production Environment Variables
JWT_SECRET=your-secure-jwt-secret-here
MAILERSEND_API_KEY=mlsn.b93df73e534656b9e6fecf1dadb07c3b960a19d789482e559ac531b79b8ce745
ENVIRONMENT=production
```

### 4. Custom Domain hinzufügen

1. **Pages → supplement-stack → Custom domains**
2. **Set up a custom domain**
3. **Domain**: `supplementstack.de`
4. **Activate domain** (DNS wird automatisch konfiguriert)

### 5. D1 Database Setup

1. **Workers & Pages → D1**
2. **Create database**: `supplementstack-production`
3. **Bind to Pages project**: `supplement-stack`
4. **Binding name**: `DB`

### 6. Database Migration

**In Cloudflare Dashboard oder CLI:**

```bash
# Falls CLI verfügbar ist
npx wrangler d1 execute supplementstack-production --file=migrations/0001_initial_schema.sql
npx wrangler d1 execute supplementstack-production --file=migrations/0002_email_verification.sql
```

**Oder manuell in D1 Console:**
- Führe SQL aus `migrations/0001_initial_schema.sql` aus
- Führe SQL aus `migrations/0002_email_verification.sql` aus

## ✅ Nach dem Deployment

### URLs:
- **Live Site**: https://supplementstack.de
- **Admin**: https://dash.cloudflare.com/

### Tests:
1. **Registrierung testen**: https://supplementstack.de/auth
2. **E-Mail erhalten**: MailerSend sollte funktionieren
3. **E-Mail-Bestätigung**: Klick auf Link in E-Mail
4. **Welcome E-Mail**: Nach Bestätigung
5. **Password Reset**: Teste "Passwort vergessen"

## 🔧 Troubleshooting

### MailerSend Probleme:
- Überprüfe Domain-Verifizierung bei MailerSend
- DNS Records müssen korrekt sein
- E-Mail-Adressen müssen @supplementstack.de verwenden

### Build Probleme:
- Node.js Version auf 18 setzen
- Build command: `npm run build`
- Output directory: `dist`

### Database Probleme:
- D1 Binding muss korrekt sein
- Migrations müssen ausgeführt werden
- Environment Variables müssen gesetzt sein

## 📧 MailerSend Configuration

**Domain**: supplementstack.de  
**API Key**: mlsn.b93df73e534656b9e6fecf1dadb07c3b960a19d789482e559ac531b79b8ce745  
**From Email**: noreply@supplementstack.de  
**DNS**: Bereits bei Cloudflare konfiguriert  

## 🎉 Nach erfolgreichem Deployment

Das komplette System mit allen E-Mail-Templates funktioniert dann:
- ✅ Registration mit E-Mail-Bestätigung
- ✅ Login mit 2FA
- ✅ Password Reset
- ✅ Welcome E-Mails
- ✅ Professional HTML E-Mail Templates
- ✅ DSGVO-konforme Prozesse

**Live URL**: https://supplementstack.de