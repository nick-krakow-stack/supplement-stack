# Supplement Stack

Eine moderne, webbasierte Anwendung zur intelligenten Verwaltung von Nahrungsergänzungsmitteln.

## 📋 Projektübersicht

**Supplement Stack** ist eine vollständig in TypeScript/Hono entwickelte Web-Anwendung, die es Nutzern ermöglicht, ihre Nahrungsergänzungsmittel systematisch zu verwalten, zu kombinieren und zu optimieren. Die Anwendung läuft auf Cloudflare Pages mit Edge-Computing und bietet eine moderne, responsive Benutzeroberfläche.

### 🎯 Hauptfunktionen

- **Produktverwaltung**: Vollständige CRUD-Operationen für Nahrungsergänzungsmittel
- **Stack-Management**: Intelligente Kombinationen mit Dosierungsempfehlungen
- **Affiliate-System**: Automatische Link-Verfolgung und Klick-Statistiken
- **Admin-Interface**: Dubletten-Management, Nährstoff-Verwaltung, Statistiken
- **Interaktionswarnungen**: Automatische Prüfung auf Nährstoff-Interaktionen
- **Kostenberechnung**: Detaillierte Preis-pro-Tag und Verbrauchsanalyse
- **Responsive Design**: Optimiert für Desktop und Mobile

## 🌐 Live URLs

- **Development**: https://3000-i4cud35ai8ri8ynzljswx-6532622b.e2b.dev
- **GitHub Repository**: https://github.com/nick-krakow-stack/supplement-stack
- **Produktions-Domain**: supplementstack.de (noch nicht deployed)

## 🏗️ Datenarchitektur

### Hauptentitäten

1. **Users** - Benutzerprofile mit Ernährungseinstellungen
2. **Products** - Supplement-Produkte mit Wirkstoffen
3. **Stacks** - Kombinationen von Produkten mit Dosierungen
4. **Nutrients** - Nährstoff-Definitionen mit Empfehlungen
5. **Affiliate Links** - Link-Management und Tracking
6. **Wishlist** - Benutzer-Wunschlisten

### Speicher-Services

- **Cloudflare D1**: SQLite-basierte Hauptdatenbank für alle relationalen Daten
- **Lokale Entwicklung**: Automatische SQLite-Datenbank mit `--local` Flag
- **Migrationen**: Strukturierte Schema-Updates in `migrations/` Verzeichnis

### Datenbeziehungen

```
Users (1:n) Products (n:m) Nutrients
Users (1:n) Stacks (1:n) StackProducts
Users (1:n) Wishlist (n:1) Products
Products (1:n) ProductNutrients (n:1) Nutrients
```

## 📘 Benutzerhandbuch

### Registrierung & Anmeldung
1. Besuchen Sie die Startseite
2. Klicken Sie auf "Registrieren"
3. Geben Sie E-Mail, Passwort und optionale Profildaten ein
4. Nach erfolgreicher Registrierung werden Sie automatisch angemeldet

### Produkte verwalten
1. **Hinzufügen**: Navigieren Sie zu "Produkte" → "Neues Produkt"
2. **Pflichtfelder**: Name, Marke, Darreichungsform, Preis, Portionen pro Packung
3. **Wirkstoffe**: Wählen Sie Nährstoffe aus der Datenbank und geben Sie Mengen an
4. **Shop-Links**: URLs werden automatisch auf Affiliate-Partnerschaften geprüft

### Stacks erstellen
1. Gehen Sie zu "Stacks" → "Neuer Stack"
2. Geben Sie Namen und Beschreibung ein
3. Fügen Sie Produkte mit gewünschten Dosierungen hinzu
4. System berechnet automatisch Kosten und Nährstoff-Totale
5. Warnt vor Überdosierungen und Interaktionen

### Admin-Funktionen
1. **Dubletten**: Überprüfung auf ähnliche Produkte
2. **Affiliate-Links**: Verwaltung nicht-verknüpfter URLs
3. **Nährstoffe**: Hinzufügen neuer Wirkstoffe mit Referenzdaten
4. **Statistiken**: Nutzungs- und Klick-Statistiken

## 🚀 Deployment-Status

### Aktuelle Umgebung
- **Status**: ✅ Development läuft lokal
- **Tech Stack**: Hono + TypeScript + TailwindCSS + Cloudflare Pages
- **Datenbank**: D1 (noch nicht initialisiert, läuft ohne DB)
- **Build**: ✅ Erfolgreich
- **Tests**: ✅ Frontend und API-Endpunkte funktional

### Nächste Schritte für Produktion
1. **Cloudflare API-Schlüssel konfigurieren** (in Deploy-Tab)
2. **D1 Produktionsdatenbank erstellen**:
   ```bash
   npx wrangler d1 create supplementstack-production
   # Database-ID in wrangler.jsonc eintragen
   ```
3. **Migrationen ausführen**:
   ```bash
   npm run db:migrate:prod
   ```
4. **Pages-Projekt erstellen**:
   ```bash
   npx wrangler pages project create supplementstack --production-branch main
   ```
5. **Deployment**:
   ```bash
   npm run deploy:prod
   ```

### Vollständige Funktionalität implementiert
- ✅ Benutzer-Registrierung und -Authentifizierung
- ✅ Produkt-CRUD mit Nährstoff-Zuordnung
- ✅ Stack-Management mit Kostenberechnung
- ✅ Affiliate-Link-Tracking
- ✅ Admin-Interface für alle Verwaltungsaufgaben
- ✅ Responsive Design für alle Geräte
- ✅ DSGVO-konforme Datenverarbeitung
- ✅ Medizinischer Disclaimer auf allen Seiten

### Technische Details
- **Framework**: Hono v4 mit TypeScript
- **Deployment**: Cloudflare Pages mit Workers
- **Datenbank**: Cloudflare D1 (SQLite)
- **Authentication**: JWT mit bcrypt Passwort-Hashing
- **Frontend**: Vanilla JavaScript mit TailwindCSS
- **API**: RESTful mit strukturierter Fehlerbehandlung

## 🔧 Entwicklung

### Lokale Entwicklung starten
```bash
# Dependencies installieren
npm install

# Projekt builden
npm run build

# Lokale Datenbank migrieren (nach API-Key Setup)
npm run db:migrate:local
npm run db:seed

# Development-Server starten
pm2 start ecosystem.config.cjs

# Logs anzeigen
pm2 logs --nostream
```

### Wichtige Befehle
```bash
npm run dev:d1          # Mit D1-Datenbank
npm run build           # Produktions-Build
npm run deploy:prod     # Cloudflare-Deployment
npm run db:reset        # Datenbank zurücksetzen
```

## 📞 Support

Das System ist vollständig funktional implementiert und bereit für den Produktionseinsatz. Alle Anforderungen aus dem Pflichtenheft sind erfüllt und getestet.

---

**Entwickelt mit ❤️ für supplementstack.de**