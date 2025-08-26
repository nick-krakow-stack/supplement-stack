# 🚀 Supplement Stack - Deployment Guide

## Schnell-Deployment (Lokales Terminal)

### 1. API-Token setzen
```bash
# In Ihrem lokalen Terminal:
export CLOUDFLARE_API_TOKEN="Ihr-Global-API-Key"
export CLOUDFLARE_ACCOUNT_ID="d8f0c1d7e9e70f806edb067057227cbe"
```

### 2. Automatisches Deployment starten
```bash
./deploy.sh
```

Das war's! 🎉

---

## Manual Deployment (Schritt für Schritt)

### 1. Cloudflare Authentication
```bash
# Option A: Mit API-Token
export CLOUDFLARE_API_TOKEN="Ihr-Key"
npx wrangler whoami

# Option B: Interactive Login
npx wrangler auth login
```

### 2. Build erstellen
```bash
npm run build
```

### 3. D1 Datenbank (falls neu)
```bash
# Datenbank erstellen
npx wrangler d1 create supplement-stack-production

# Database ID in wrangler.jsonc eintragen
# Bereits konfiguriert: 3f817330-b78c-45b2-a0f3-f93cf3157e2f

# Migrationen anwenden
npx wrangler d1 migrations apply supplement-stack-production --remote

# Seed-Daten importieren
npx wrangler d1 execute supplement-stack-production --remote --file=./seed.sql
```

### 4. Pages Deployment
```bash
# Pages-Projekt erstellen (einmalig)
npx wrangler pages project create supplement-stack --production-branch main

# Deployment durchführen
npx wrangler pages deploy dist --project-name supplement-stack
```

---

## GitHub Actions (Automatisch)

### 1. GitHub Secrets konfigurieren
In Ihrem GitHub Repository → Settings → Secrets and Variables → Actions:

- `CLOUDFLARE_API_TOKEN`: Ihr Global API Key
- `CLOUDFLARE_ACCOUNT_ID`: d8f0c1d7e9e70f806edb067057227cbe

### 2. Automatisches Deployment
Jeder Push auf `main` branch triggert automatisches Deployment via `.github/workflows/deploy.yml`

---

## 🔧 Troubleshooting

### Problem: "Database not found"
```bash
# Prüfen ob Datenbank existiert
npx wrangler d1 list

# Falls nicht, neu erstellen
npx wrangler d1 create supplement-stack-production
```

### Problem: "Project already exists"
```bash
# Pages-Projekt anzeigen
npx wrangler pages project list

# Deployment zu bestehendem Projekt
npx wrangler pages deploy dist --project-name supplement-stack
```

### Problem: "Unauthorized"
```bash
# Token prüfen
npx wrangler whoami

# Neu anmelden
npx wrangler auth login
```

---

## 🎯 Nach erfolgreichem Deployment

### URLs:
- **Live-App**: https://supplement-stack.pages.dev
- **Admin-Panel**: https://supplement-stack.pages.dev/admin  
- **Demo-Modus**: https://supplement-stack.pages.dev/?demo=true

### Test-Accounts:
- **Admin**: admin@supplementstack.dev (Passwort siehe seed.sql)
- **Demo**: Automatisch generiert bei Demo-Zugang

### Nächste Schritte:
1. ✅ Live-URL testen
2. ✅ Admin-Account anlegen/testen
3. ✅ Demo-Modus ausprobieren
4. ⚡ Custom Domain konfigurieren (optional)
5. 📊 Analytics einrichten (optional)

---

## 🚨 Wichtige Sicherheitshinweise

- ❌ **Nie API-Keys in Code oder Chat teilen**
- ✅ **Immer Umgebungsvariablen oder GitHub Secrets nutzen**
- ✅ **API-Keys regelmäßig rotieren**
- ✅ **Minimale Berechtigungen für Token verwenden**