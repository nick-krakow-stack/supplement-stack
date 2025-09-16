# 🌐 Cloudflare Deployment Guide

Dieses Dokument erklärt, wie das Supplement Stack Projekt auf Cloudflare Pages deployed wird.

## 📋 Konfiguration

### Cloudflare-Daten
Die Cloudflare-Konfiguration ist in `.cloudflare-config` gespeichert:

- **Account:** email@nickkrakow.de
- **Domain:** supplementstack.de  
- **Projekt:** supplementstack
- **Branch:** main (Production)

### ⚠️ Sicherheit
- Die `.cloudflare-config` Datei ist **nicht** in Git getrackt
- Alle sensiblen Daten sind lokal gespeichert
- API-Token wird nur für Deployment geladen

## 🚀 Deployment-Befehle

### Schnelles Deployment
```bash
# Komplettes Deployment
./deploy-cloudflare.sh
```

### Helper-Script verwenden
```bash
# Alle verfügbaren Befehle anzeigen
./cf-helper.sh help

# Status prüfen
./cf-helper.sh status

# Database migrieren
./cf-helper.sh db-migrate

# Logs anzeigen
./cf-helper.sh logs
```

### Manuelle Deployment-Befehle
```bash
# Build erstellen
npm run build

# Mit wrangler deployen
wrangler pages deploy dist --project-name=supplementstack
```

## 💾 Database-Management

### Migrationen
```bash
# Produktions-Database
wrangler d1 migrations apply supplementstack-production

# Lokale Database (Entwicklung)
wrangler d1 migrations apply supplementstack-production --local
```

### Seed-Daten
```bash
# Testdaten einfügen
wrangler d1 execute supplementstack-production --file=./seed.sql
```

## 🔧 Nützliche Befehle

### Projekt-Status
```bash
# Pages-Projekte auflisten
wrangler pages project list

# Deployment-History
wrangler pages deployment list --project-name=supplementstack
```

### Database-Abfragen
```bash
# Direkte SQL-Abfragen
wrangler d1 execute supplementstack-production --command="SELECT COUNT(*) FROM users;"

# Database-Schema anzeigen
wrangler d1 execute supplementstack-production --command="SELECT sql FROM sqlite_master WHERE type='table';"
```

## 📊 URLs nach Deployment

- **🌐 Production:** https://supplementstack.de
- **📄 Pages URL:** https://supplementstack.pages.dev  
- **🎮 Demo:** https://supplementstack.de/demo
- **🔐 Login:** https://supplementstack.de/auth

## ⚡ Troubleshooting

### Häufige Probleme

**Build-Fehler:**
```bash
# Dependencies neu installieren
rm -rf node_modules package-lock.json
npm install
```

**Database-Verbindung:**
```bash
# D1-Status prüfen
wrangler d1 info supplementstack-production
```

**Deployment-Fehler:**
```bash
# Wrangler neu authentifizieren
wrangler auth login
```

### Logs einsehen
```bash
# Live-Logs
./cf-helper.sh logs

# Oder direkt:
wrangler pages deployment tail --project-name=supplementstack
```

## 🔄 Workflow

1. **Code ändern** (lokal entwickeln)
2. **Build testen:** `npm run build`
3. **Deployment:** `./deploy-cloudflare.sh`
4. **Status prüfen:** `./cf-helper.sh status`
5. **Live-Test:** https://supplementstack.de

---
**Letztes Update:** $(date)
**Projekt:** Supplement Stack v1.0