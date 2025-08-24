# 🚀 Supplement Stack PHP - Intelligente Supplement-Verwaltung

> **Vollständiges PHP-System für All-Inkl Privat Plus Server**  
> Konvertiert von Hono/Cloudflare zu PHP/MySQL für traditionelle Webserver

## 📦 Schnelle Installation (3 Schritte)

### 1. Download
- **📥 ZIP herunterladen:** [`supplement-stack-php-v1.0.zip`](https://github.com/nick-krakow-stack/supplement-stack/blob/main/supplement-stack-php-v1.0.zip)
- **🗂️ Entpacken** mit WinRAR/7-Zip

### 2. Upload
- **📤 Per FTP** alle Dateien in dein Webroot-Verzeichnis hochladen
- **📁 Struktur:** Alle Dateien direkt in `public_html/` oder `www/`

### 3. Installation
```
🌐 Browser öffnen: https://deine-domain.de/install_simple.php
```

## 🔧 Bei Problemen

### Internal Server Error / Not Found?
```
🔍 Debug-Script: https://deine-domain.de/debug.php
```
Zeigt PHP-Version, Extensions, Berechtigungen und mögliche Fehlerursachen.

### Alternative Installation:
Falls `install_simple.php` nicht funktioniert:
```
🛠️ Original Installer: https://deine-domain.de/install.php
```

## ✅ System-Features

### 🔐 Benutzer-Management
- **Registrierung & Login** mit sicherer Passwort-Verschlüsselung
- **Profil-Management** mit Gesundheitsdaten
- **Session-basierte Authentifizierung**

### 💊 Supplement-Verwaltung
- **Produktdatenbank** mit flexiblen Einheiten
- **Stack-System** für Supplement-Kombinationen
- **Kostenrechner** mit automatischen Berechnungen
- **Import/Export** Funktionen

### 📊 Dashboard & Analyse
- **Benutzer-Dashboard** mit Statistiken
- **Analyse-Tools** (in Entwicklung)
- **Responsive Design** mit TailwindCSS

### ⚖️ Legal Compliance
- **DSGVO-konform** mit Cookie-Consent
- **Datenschutzerklärung, AGB, Impressum**
- **Privacy-by-Design** Architektur

## 🏗️ Technische Details

### 📋 Systemanforderungen
- **PHP 8.0+** (bei All-Inkl aktivieren)
- **MySQL 5.7+** oder MariaDB
- **Extensions:** PDO, PDO_MySQL, JSON, OpenSSL
- **Apache** mit mod_rewrite Support

### 🗄️ Datenbank-Schema
```sql
-- Vollständiges MySQL-Schema inkludiert
-- Automatische Migration durch Installer
-- 7 Tabellen: users, products, stacks, ingredients, etc.
```

### 🛡️ Sicherheits-Features
- **CSRF-Schutz** mit Token-Validation
- **Rate Limiting** für API-Endpunkte
- **SQL-Injection Schutz** mit PDO Prepared Statements
- **XSS-Schutz** mit HTML-Escaping
- **Session-Sicherheit** mit HttpOnly Cookies

## 📁 Projekt-Struktur

```
supplement-stack-php/
├── 🏠 index.php              # Landing Page
├── 🔐 login.php              # Benutzer-Anmeldung
├── 📊 dashboard.php          # Hauptdashboard
├── 💊 products.php           # Produktverwaltung
├── 📚 stacks.php             # Stack-Management
├── 📈 analysis.php           # Analyse-Tools
├── 👤 profile.php            # Benutzerprofil
├── ⚙️ settings.php           # Einstellungen
├── 🛠️ install_simple.php     # Vereinfachter Installer
├── 🔍 debug.php              # Fehlerdiagnose
├── config/                   # Konfigurationsdateien
├── api/                      # AJAX API-Endpunkte
├── assets/                   # CSS, JavaScript, Images
├── database/                 # SQL Schema-Dateien
├── includes/                 # Wiederverwendbare PHP-Includes
├── legal/                    # DSGVO-konforme Legal Pages
└── 📋 README.md              # Diese Dokumentation
```

## 🚀 API-Endpunkte

### Authentication
- `POST /api/csrf-token.php` - CSRF Token generieren
- `POST /login.php` - Benutzer anmelden
- `POST /register.php` - Neuen Benutzer registrieren

### Products & Stacks
- `GET/POST /api/products.php` - Produktverwaltung
- `GET/POST /api/stacks.php` - Stack-Management
- `POST /api/cost-calculator.php` - Kostenberechnungen

## 🔄 Migration von Cloudflare

Diese PHP-Version ist eine vollständige Konvertierung des ursprünglichen Hono/Cloudflare Systems:

### ✅ Konvertiert:
- **Hono Framework** → **PHP 8.x**
- **Cloudflare D1** → **MySQL/MariaDB**
- **Cloudflare Workers** → **Apache/All-Inkl**
- **Edge Functions** → **PHP Includes**
- **Worker KV** → **MySQL Sessions**

### 📈 Verbesserungen:
- **Erweiterte Fehlerbehandlung**
- **Debug-Tools für Entwicklung**  
- **All-Inkl spezifische Optimierungen**
- **Vereinfachte Installation**

## 📞 Support & Dokumentation

### 📖 Zusätzliche Dokumentation:
- **[`INSTALLATION_SCHNELL.md`](INSTALLATION_SCHNELL.md)** - 3-Schritte Schnellstart
- **[`FEHLERBEHEBUNG.md`](FEHLERBEHEBUNG.md)** - Häufige Probleme & Lösungen

### 🆘 Bei Problemen:
1. **Debug-Script ausführen:** `debug.php`
2. **GitHub Issues:** Bug-Reports und Feature-Requests
3. **All-Inkl Support:** Für Server-spezifische Fragen

## ⚡ Next Steps nach Installation

### 1. Sicherheit
- [ ] **Install-Dateien löschen:** `install.php`, `install_simple.php`, `debug.php`
- [ ] **Admin-Passwort** stark wählen
- [ ] **SSL-Zertifikat** bei All-Inkl aktivieren

### 2. Konfiguration
- [ ] **Site-Name** anpassen in `config/database.php`
- [ ] **Legal Pages** mit deinen Daten anpassen
- [ ] **E-Mail-Settings** für Benachrichtigungen

### 3. Erste Schritte
- [ ] **Admin-Login** testen
- [ ] **Erste Supplemente** hinzufügen
- [ ] **Test-Stack** erstellen
- [ ] **Backup-Strategie** einrichten

## 🎯 Roadmap

### 🔮 Geplante Features:
- [ ] **Interaktions-Checker** - Supplement-Wechselwirkungen
- [ ] **Erweiterte Analysen** - Nährstoff-Dashboards
- [ ] **Shop-Integration** - Preisvergleiche
- [ ] **Mobile App** - PWA-Support
- [ ] **API-Integration** - Externe Datenquellen
- [ ] **Multi-Language** - Internationalisierung

### 🛠️ Technische Verbesserungen:
- [ ] **Caching-System** für bessere Performance
- [ ] **Background Jobs** mit Cron-Integration
- [ ] **Advanced Security** mit 2FA
- [ ] **Monitoring** mit Health-Checks

---

## 📜 Lizenz & Credits

**Erstellt:** 2025-08-24  
**Version:** 1.0  
**Kompatibilität:** All-Inkl Privat Plus  
**PHP:** 8.0+  
**Database:** MySQL 5.7+  

**🎉 Bereit für Production Deployment!**

---

> **💡 Tipp:** Nach erfolgreicher Installation unbedingt die Installer-Dateien löschen!