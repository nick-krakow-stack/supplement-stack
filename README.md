# Supplement Stack

## 🎯 Projektübersicht
**Supplement Stack** ist eine moderne Web-Anwendung für das intelligente Management von Nahrungsergänzungsmitteln. Die Plattform ermöglicht es Nutzern, ihre Supplements zu verwalten, Stacks zu erstellen, Überdosierungen zu vermeiden und die besten Angebote über Affiliate-Links zu finden.

### ✨ Hauptfunktionen
- **Produktverwaltung**: Erfassung und Verwaltung von Supplements mit Nährstoffprofilen
- **Stack-Erstellung**: Kombinationen von Supplements mit automatischer Dosierungsberechnung
- **Überdosierungsschutz**: Automatische Warnungen bei kritischen Dosierungen
- **Interaktionscheck**: Prüfung auf Nährstoff-Interaktionen
- **Affiliate-System**: Monetarisierung über Partner-Links
- **Admin-Backend**: Dubletten-Management, Datenpflege, Statistiken

## 🌐 URLs

### Entwicklungsumgebung
- **Live-Demo**: https://3000-i4cud35ai8ri8ynzljswx-6532622b.e2b.dev
- **Health Check**: https://3000-i4cud35ai8ri8ynzljswx-6532622b.e2b.dev/health
- **GitHub Repository**: https://github.com/nick-krakow-stack/supplement-stack

### Produktionsumgebung (geplant)
- **Domain**: supplementstack.de (Cloudflare Pages)
- **Produktions-URLs**: Werden nach Deployment verfügbar sein

## 📊 Datenarchitektur

### 🗄️ Hauptdatenmodelle
- **Users**: Benutzerverwaltung mit Profilen und Präferenzen
- **Products**: Supplement-Produkte mit Nährstoffprofilen
- **Stacks**: Supplement-Kombinationen mit Dosierungen
- **Nutrients**: Nährstoff-Datenbank mit Empfehlungen
- **Affiliate Links**: Link-Management für Monetarisierung

### 🏗️ Speicherdienste
- **Cloudflare D1**: SQLite-basierte Datenbank für relationale Daten
- **Lokale Entwicklung**: Automatische lokale SQLite mit `--local` Flag
- **Produktionsdatenbank**: Globale D1-Verteilung für optimale Performance

### 🔄 Datenfluss
1. **Benutzer-Input**: Produkt- und Stack-Erstellung über Frontend
2. **Validierung**: Backend-Validierung und Nährstoff-Normalisierung  
3. **Berechnung**: Automatische Dosierungs- und Kostenberechnungen
4. **Warnungen**: Echtzeit-Überdosierungs- und Interaktionswarnungen
5. **Affiliate-Tracking**: Transparente Link-Weiterleitung mit Statistiken

## 👥 Benutzerhandbuch

### 🚀 Erste Schritte
1. **Registrierung**: E-Mail + Passwort, optional Profildaten (Alter, Gewicht, Ernährung)
2. **Dashboard**: Übersicht über Produkte, Stacks und Wunschliste
3. **Produkt hinzufügen**: Name, Marke, Nährstoffe mit Dosierung erfassen
4. **Stack erstellen**: Produkte kombinieren mit gewünschter Tagesdosis

### 📋 Kernfunktionen
- **Produktkatalog**: Persönlicher und öffentlicher Katalog von Supplements
- **Stack-Management**: Erstellen, bearbeiten und analysieren von Supplement-Kombinationen
- **Dosierungsempfehlungen**: Wahl zwischen DGE, Studien oder Influencer-Empfehlungen
- **Warnsystem**: Automatische Alerts bei Überdosierungen oder Interaktionen
- **Einkaufshilfe**: Preisvergleich und direkter Kauf über Affiliate-Links

### 🔧 Erweiterte Features
- **Dubletten-Erkennung**: Automatische Prüfung auf bereits vorhandene Produkte
- **Notizen-System**: Private Notizen zu jedem Produkt
- **Wunschliste**: Favoriten für spätere Käufe
- **Verbrauchsübersicht**: Berechnung der Nachkauftermine
- **PDF-Export**: Einnahmepläne als PDF (geplant)

## 🚀 Deployment

### ✅ Aktueller Status
- **Entwicklung**: ✅ Läuft lokal mit PM2 und Wrangler
- **Frontend**: ✅ Responsive Design mit TailwindCSS
- **Backend**: ✅ Hono API mit vollständigem Routing
- **Datenbank**: ✅ Schema erstellt, lokale Entwicklung bereit
- **Cloudflare Setup**: ⏳ Bereit für Deployment

### 🛠️ Tech Stack
- **Framework**: Hono (TypeScript) auf Cloudflare Workers
- **Frontend**: Vanilla JavaScript + TailwindCSS + FontAwesome
- **Datenbank**: Cloudflare D1 (SQLite)
- **Deployment**: Cloudflare Pages
- **Entwicklung**: Vite + PM2 für lokale Entwicklung
- **Versionskontrolle**: Git mit GitHub Integration

### 📋 Deployment-Schritte
1. **Cloudflare API Setup**: API-Key konfigurieren
2. **D1 Datenbank**: Produktionsdatenbank erstellen
3. **Migrationen**: Schema in Produktionsumgebung anwenden  
4. **Pages Deployment**: Build und Deployment nach Cloudflare
5. **DNS Setup**: Domain supplementstack.de konfigurieren

## ✨ Aktuell implementierte Features

### 🔐 Authentifizierung
- [x] Registrierung mit E-Mail/Passwort
- [x] Login/Logout mit Sessions
- [x] Benutzerprofil mit Präferenzen
- [x] Admin-Rolle für Backend-Verwaltung

### 📦 Produktmanagement
- [x] CRUD-Operationen für Produkte
- [x] Nährstoff-Zuordnung mit Mengen/Einheiten
- [x] Dubletten-Erkennung
- [x] Öffentliche vs. private Produkte
- [x] Notizen-System

### 🥞 Stack-Management
- [x] Stack-Erstellung und -Verwaltung
- [x] Produkt-Zuordnung mit Dosierungen
- [x] Dosierungsquellen (DGE, Studien, Influencer)
- [x] Kostenkalkulation (täglich/monatlich)

### 💼 Affiliate-System
- [x] Link-Management und Tracking
- [x] Klick-Statistiken
- [x] Redirect-Service
- [x] Backend-Queue für unbearbeitete Links

### 👨‍💼 Admin-Backend
- [x] Benutzer- und Produktstatistiken
- [x] Nährstoff-Verwaltung
- [x] Dubletten-Management
- [x] Affiliate-Link-Bearbeitung

## 🔄 Geplante Features

### 📊 Erweiterte Funktionen
- [ ] Interaktions-Check zwischen Nährstoffen
- [ ] Überdosierungs-Warnungen
- [ ] Verbrauchsplanung mit Nachkauferinnerungen
- [ ] PDF-Export von Einnahmeplänen
- [ ] Social Login (Google OAuth)

### 🎯 Monetarisierung
- [ ] Erweiterte Affiliate-Partner Integration
- [ ] Premium-Features für Power-User
- [ ] E-Mail-Marketing für Nachkauferinnerungen
- [ ] Partner-Shop Integrationen

## 🏗️ Entwicklungsnotizen

### 🚀 Nächste Schritte
1. **Cloudflare API**: Setup für Deployment vorbereiten
2. **D1 Produktionsdatenbank**: Erstellen und Migrationen anwenden
3. **Domain-Konfiguration**: supplementstack.de für Cloudflare Pages
4. **Monitoring**: Error-Tracking und Performance-Monitoring
5. **Tests**: Unit- und Integrationstests hinzufügen

### 🔧 Technische Verbesserungen
- [ ] TypeScript-Typen vollständig implementieren
- [ ] Error-Handling und Logging verbessern  
- [ ] Rate-Limiting für API-Endpunkte
- [ ] Caching-Strategien für bessere Performance
- [ ] Progressive Web App (PWA) Features

### 📈 Skalierung
- [ ] Multi-Region Deployment
- [ ] CDN-Optimierung für statische Assets
- [ ] Datenbank-Indexierung optimieren
- [ ] Background-Jobs für zeitaufwändige Operationen

---

**Letzte Aktualisierung**: 25. August 2024
**Entwickler**: Nick (nick-krakow-stack)
**Lizenz**: Proprietär

⚠️ **Wichtiger Hinweis**: Diese Anwendung ersetzt keine medizinische Beratung. Bei gesundheitlichen Fragen konsultieren Sie immer einen Arzt.