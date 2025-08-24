# Supplement Stack Manager - PHP Version

Ein intelligentes Nahrungsergänzungsmittel-Management-System für All-Inkl Privat Plus Webserver.

## 🎯 Projektübersicht

**Supplement Stack Manager** ist eine webbasierte PHP-Anwendung zur professionellen Verwaltung von Nahrungsergänzungsmitteln. Die Anwendung ermöglicht es Benutzern, ihre Supplements zu dokumentieren, Stacks zu erstellen, Dosierungen zu berechnen und Kosten zu überwachen.

### 🌟 Hauptfunktionen

- **Produkt-Management**: Erfassung von Supplements mit detaillierten Inhaltsstoffen
- **Stack-Verwaltung**: Erstellung personalisierter Supplement-Kombinationen
- **Dosierungsberechnung**: Intelligente Berechnung basierend auf Benutzerprofil
- **Kostenüberwachung**: Automatische Berechnung von Tages-, Wochen- und Monatskosten
- **Nährstoff-Analyse**: Überwachung der Nährstoffzufuhr mit Warnsystemen
- **DSGVO-Konformität**: Vollständige Datenschutz-Compliance für deutsche Nutzer

## 🏗️ Technische Architektur

### Backend
- **PHP 8.x** mit objektorientierter Programmierung
- **MySQL** Datenbank mit optimierten Indizes
- **PDO** für sichere Datenbankoperationen
- **Session-Management** mit Datenbank-Persistierung
- **CSRF-Schutz** und Rate-Limiting
- **Password-Hashing** mit modernen Algorithmen

### Frontend
- **JavaScript ES6+** mit AJAX-Kommunikation
- **TailwindCSS** für responsive UI
- **FontAwesome** Icons
- **Vanilla JavaScript** (keine Framework-Abhängigkeiten)

### Sicherheit
- SSL/TLS-Verschlüsselung
- Input-Sanitization und Validierung
- Prepared Statements gegen SQL-Injection
- Session-Sicherheit mit HTTP-Only Cookies
- Aktivitäts-Logging für Sicherheitsüberwachung

## 📊 Datenbankschema

### Haupttabellen
- `users` - Benutzerkonten und Profile
- `products` - Supplement-Produkte
- `ingredients` - Nährstoff-Datenbank
- `product_ingredients` - Produkt-Nährstoff-Zuordnungen
- `stacks` - Supplement-Kombinationen
- `stack_items` - Elemente in Stacks
- `user_sessions` - Session-Management
- `activity_logs` - Aktivitätsprotokolle

## 🚀 Installation auf All-Inkl Webserver

### Voraussetzungen
- All-Inkl Privat Plus Hosting-Paket
- PHP 8.x aktiviert
- MySQL-Datenbank verfügbar
- FTP-Zugang zum Webserver

### Installationsschritte

1. **Dateien hochladen**
   ```bash
   # Alle Dateien per FTP in das Hauptverzeichnis hochladen
   # Struktur: /supplement-stack-php/*
   ```

2. **Datenbank einrichten**
   ```sql
   -- MySQL-Datenbank erstellen
   CREATE DATABASE supplement_stack CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
   
   -- Schema importieren
   SOURCE database/schema.sql;
   ```

3. **Konfiguration anpassen**
   ```php
   // config/database.php - Datenbankverbindung anpassen
   define('DB_HOST', 'localhost');
   define('DB_NAME', 'IHR_DB_NAME');
   define('DB_USER', 'IHR_DB_USER');
   define('DB_PASS', 'IHR_DB_PASSWORT');
   
   // Sicherheits-Salt anpassen
   define('PASSWORD_SALT', 'IHR_INDIVIDUELLER_SALT');
   ```

4. **E-Mail-Konfiguration**
   ```php
   // config/config.php - SMTP-Einstellungen für All-Inkl
   define('ADMIN_EMAIL', 'ihre-email@ihre-domain.de');
   define('SMTP_USERNAME', 'ihre-email@ihre-domain.de');
   define('SMTP_PASSWORD', 'ihr-email-passwort');
   ```

5. **Verzeichnis-Berechtigungen**
   ```bash
   chmod 755 /uploads
   chmod 755 /logs
   chmod 644 .htaccess
   ```

## 🎨 Benutzer-Funktionen

### Registrierung und Profil
- Sichere Benutzerregistrierung mit optionalen Profildaten
- Personalisierte Dosierungsempfehlungen basierend auf:
  - Alter, Geschlecht, Gewicht, Körpergröße
  - Aktivitätslevel und Gesundheitsziele
  - Medizinische Bedingungen und Allergien

### Produkt-Management
- Detaillierte Supplement-Erfassung
- Inhaltsstoff-Datenbank mit 20+ Standard-Nährstoffen
- Dosierungen, Kosten und Haltbarkeitsdaten
- Automatische Dubletten-Erkennung

### Stack-Erstellung
- Intelligente Supplement-Kombinationen
- Flexible Dosierung pro Produkt
- Einnahme-Timing und Häufigkeit
- Kosten-Optimierung

### Analyse und Überwachung
- Nährstoff-Bilanz mit Überdosierungs-Warnungen
- Kostenanalyse (täglich/wöchentlich/monatlich/jährlich)
- Verbrauchsvorhersagen
- Export-Funktionen

## 🛡️ Datenschutz und Compliance

### DSGVO-Konformität
- Vollständige Datenschutzerklärung
- Benutzerrechte (Auskunft, Berichtigung, Löschung)
- Datenminimierung und Zweckbindung
- Sichere Datenverarbeitung

### Rechtliche Absicherung
- Umfassende AGB
- Medizinischer Haftungsausschluss
- Vollständiges Impressum
- Cookie-Consent-Management

## 📱 Benutzeroberfläche

### Responsive Design
- Mobile-First Ansatz
- Touch-optimierte Bedienung
- Intuitive Navigation
- Barrierefreie Gestaltung

### Dashboard-Features
- Übersichtliche Statistiken
- Schnellaktionen
- Aktivitäts-Feed
- Kosten-Widgets

## 🔧 API-Endpunkte

### Produkt-Management
- `GET /api/products.php` - Produktliste abrufen
- `POST /api/products.php` - Neues Produkt erstellen
- `PUT /api/products.php?id=X` - Produkt bearbeiten
- `DELETE /api/products.php?id=X` - Produkt löschen

### Stack-Management
- `GET /api/stacks.php` - Stack-Liste abrufen
- `POST /api/stacks.php` - Neuen Stack erstellen
- `PUT /api/stacks.php?id=X` - Stack bearbeiten
- `DELETE /api/stacks.php?id=X` - Stack löschen

### Kostenberechnung
- `POST /api/cost-calculator.php` - Kosten für ausgewählte Produkte berechnen

## 🚨 Wichtige Hinweise

### Medizinischer Disclaimer
⚠️ **Diese Anwendung stellt keine medizinische Beratung dar!**

- Keine Heilversprechen oder medizinische Empfehlungen
- Dient ausschließlich der persönlichen Dokumentation
- Bei Gesundheitsfragen immer Arzt oder Apotheker konsultieren
- Keine Haftung für gesundheitliche Schäden

### Sicherheitshinweise
- Regelmäßige Updates erforderlich
- Sichere Passwörter verwenden
- Backup-Strategie implementieren
- SSL-Zertifikat aktivieren

## 📈 Entwicklungsroadmap

### Version 1.0 (Aktuell)
- ✅ Basis-Funktionalität implementiert
- ✅ DSGVO-Compliance
- ✅ All-Inkl Kompatibilität
- ✅ Responsive Design

### Version 1.1 (Geplant)
- [ ] PDF-Export von Supplement-Listen
- [ ] E-Mail-Benachrichtigungen
- [ ] Erweiterte Nährstoff-Datenbank
- [ ] Import/Export-Funktionen

### Version 1.2 (Zukunft)
- [ ] Mobile App (PWA)
- [ ] Barcode-Scanner Integration
- [ ] Community-Features
- [ ] Multi-Language Support

## 🤝 Beitragen

Dieses Projekt ist Open Source. Beiträge sind willkommen:

1. Fork des Repositories
2. Feature Branch erstellen
3. Änderungen committen
4. Pull Request erstellen

## 📄 Lizenz

Dieses Projekt steht unter der MIT-Lizenz. Siehe [LICENSE](LICENSE) für Details.

## 📞 Support und Kontakt

**Entwickler:** Nick Krakow  
**E-Mail:** [Ihre E-Mail]  
**GitHub:** [Ihr GitHub-Profil]

### Support-Kanäle
- GitHub Issues für Bug-Reports
- E-Mail für allgemeine Anfragen
- Dokumentation im Wiki

## 🙏 Danksagungen

- TailwindCSS Team für das hervorragende CSS-Framework
- FontAwesome für die Icon-Bibliothek
- All-Inkl.com für zuverlässiges Hosting
- PHP und MySQL Communities

---

**© 2025 Nick Krakow. Alle Rechte vorbehalten.**

*Diese Anwendung stellt keine medizinische Beratung dar. Bei gesundheitlichen Fragen konsultieren Sie qualifiziertes Fachpersonal.*