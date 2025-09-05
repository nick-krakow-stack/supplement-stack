# Supplement Stack - Nährstoffbasiertes System

Eine moderne, webbasierte Anwendung zur intelligenten Verwaltung von Nahrungsergänzungsmitteln mit **nährstoffbasierter Architektur**.

## 📋 Projektübersicht

**Supplement Stack** ist eine vollständig in TypeScript/Hono entwickelte Web-Anwendung, die es Nutzern ermöglicht, ihre Nahrungsergänzungsmittel systematisch über **Nährstoffe und Wirkstoffe** zu verwalten, zu kombinieren und zu optimieren. Die Anwendung läuft auf Cloudflare Pages mit Edge-Computing und bietet eine moderne, responsive Benutzeroberfläche.

### 🎯 Hauptfunktionen

- **✨ Nährstoffbasiertes System**: Produkte werden Wirkstoffen zugeordnet (Vitamin D3, Magnesium, etc.)
- **🧮 Automatische Dosierungsberechnung**: Gewünschte Nährstoffmenge → benötigte Produkteinheiten
- **📊 DGE-Empfehlungen**: Integrierte Deutsche Gesellschaft für Ernährung Referenzwerte
- **📱 Tab-basierte Details**: Mobile-optimierte Modals mit Übersicht, Nährstoff, Dosierung, Kosten
- **🔄 Intelligenter Stack-Workflow**: Wirkstoff wählen → DGE-Empfehlung → Anpassung → Produktauswahl
- **💊 Moderne Produktverwaltung**: Klare, intuitive Formulare mit Live-Berechnung
- **📱 Mobile-First Design**: Komplett optimiert für Smartphones und Tablets
- **🎮 Vollständige Demo**: Funktionale Demo mit nährstoffbasiertem CRUD-System

## 🌐 Live URLs

- **🏠 Landing Page**: https://3000-i4cud35ai8ri8ynzljswx-6532622b.e2b.dev
- **🔐 Login/Registrierung**: https://3000-i4cud35ai8ri8ynzljswx-6532622b.e2b.dev/auth
- **🎮 Demo-System**: https://3000-i4cud35ai8ri8ynzljswx-6532622b.e2b.dev/demo ✨ **NEU: Nährstoffbasiertes System!**
- **📊 Dashboard**: https://3000-i4cud35ai8ri8ynzljswx-6532622b.e2b.dev/dashboard
- **📋 Produkte**: https://3000-i4cud35ai8ri8ynzljswx-6532622b.e2b.dev/products
- **🔧 Admin**: https://3000-i4cud35ai8ri8ynzljswx-6532622b.e2b.dev/admin
- **📂 GitHub Repository**: https://github.com/nick-krakow-stack/supplement-stack
- **🌍 Produktions-Domain**: supplementstack.de (bereit für Deployment)

## 🧬 Nährstoffbasierte Architektur

### Kernkonzept

Das System basiert auf der **Zuordnung von Produkten zu Wirkstoffen** anstatt auf reiner Produktverwaltung:

1. **Nährstoff-Datenbank**: 8 wichtige Nährstoffe (Vitamine, Mineralstoffe, Fettsäuren)
2. **Produkt-Nährstoff-Verknüpfung**: Jedes Produkt hat einen Hauptwirkstoff + Gehalt pro Einheit
3. **Automatische Berechnung**: System berechnet benötigte Einheiten basierend auf gewünschter Nährstoffmenge
4. **DGE-Integration**: Deutsche Gesellschaft für Ernährung Empfehlungen + studienbasierte Werte

### Nährstoff-Datenbank

**Vitamine:**
- Vitamin D3 (µg) - DGE: 20µg, Studien: 75µg
- Vitamin B12 (µg) - DGE: 4µg, Studien: 250µg
- Vitamin C (mg) - DGE: 110mg, Studien: 1000mg

**Mineralstoffe:**
- Magnesium (mg) - DGE: 375mg, Studien: 400mg
- Zink (mg) - DGE: 10mg, Studien: 15mg
- Eisen (mg) - DGE: 15mg, Studien: 18mg

**Fettsäuren:**
- EPA (mg) - DGE: 250mg, Studien: 1000mg
- DHA (mg) - DGE: 250mg, Studien: 1000mg

### Beispiel-Workflow

**Magnesium-Beispiel:**
1. **Benutzer wählt**: "Magnesium" als gewünschten Nährstoff
2. **System zeigt**: DGE-Empfehlung (375mg) + Studien-Empfehlung (400mg)
3. **Benutzer wählt**: 1200mg täglich (persönlicher Bedarf)
4. **System findet**: "Qidosha Magnesiumcitrat" mit 760mg pro Kapsel
5. **Automatische Berechnung**: 1200mg ÷ 760mg = 2 Kapseln täglich
6. **Zusatzinformationen**: Packung (60 Kapseln) reicht 30 Tage, Kosten pro Monat

## 🏗️ Datenarchitektur

### Hauptentitäten

1. **Users** - Benutzerprofile mit Ernährungseinstellungen
2. **Products** - Supplement-Produkte mit **nutrient_id** und **nutrient_amount_per_unit**
3. **Nutrients** - Nährstoff-Definitionen mit DGE + Studien-Empfehlungen
4. **Stacks** - Nährstoffbasierte Kombinationen mit automatischer Dosierung
5. **Affiliate Links** - Link-Management und Tracking
6. **Wishlist** - Benutzer-Wunschlisten

### Nährstoff-Struktur

```typescript
interface Nutrient {
  id: number
  name: string                    // "Vitamin D3", "Magnesium"
  category: string               // "Vitamine", "Mineralstoffe"
  unit: string                   // "µg", "mg"
  dge_recommended: number        // DGE-Empfehlung
  study_recommended: number      // Studienbasierte Empfehlung
  warning_threshold: number      // Warnschwelle für Überdosierung
  description: string           // Funktionen und Nutzen
}
```

### Produkt-Nährstoff-Verknüpfung

```typescript
interface Product {
  // ... Standard-Felder
  nutrient_id: number           // Verknüpfung zum Hauptwirkstoff
  nutrient_amount_per_unit: number // z.B. 760mg Magnesium pro Kapsel
}
```

## 📘 Benutzerhandbuch (Nährstoffbasiert)

### Nährstoffbasierten Stack erstellen (NEU!)

1. **Klicken Sie auf "Nährstoff-Stack"** in der Demo
2. **Schritt 1 - Nährstoff wählen**: Wählen Sie gewünschten Wirkstoff (z.B. Magnesium)
3. **Schritt 2 - Gewünschte Menge**: 
   - System zeigt DGE-Empfehlung (375mg) und Studien-Empfehlung (400mg)
   - Sie können einen eigenen Wert eingeben (z.B. 1200mg)
4. **Schritt 3 - Produkt wählen**: System zeigt verfügbare Produkte mit automatischer Berechnung
5. **Schritt 4 - Berechnung**: Genaue Dosierung, Packungsdauer, Kosten pro Monat

### Produkte mit Nährstoffen verwalten

1. **Neues Produkt hinzufügen**:
   - **Schritt 1**: Wirkstoff aus Datenbank wählen (automatische Kategoriezuordnung)
   - **Schritt 2**: Produktinformationen (Name, Marke, Form, Preis)
   - **Schritt 3**: Wirkstoffgehalt pro Einheit (z.B. 760mg Magnesium pro Kapsel)
   - **Live-Berechnung**: Tägliche Aufnahme, DGE-Abdeckung, Packungsdauer

2. **Details-Modal (Tab-basiert)**:
   - **Übersicht**: Produktinfo, Beschreibung, Vorteile
   - **Nährstoff**: Wirkstoff-Details, Empfehlungsvergleich, Dosierungsbalken
   - **Dosierung**: Empfohlene Anwendung, Warnhinweise
   - **Kosten**: Detailierte Kostenaufschlüsselung

### Mobile-Optimierung

- **Touch-freundliche Buttons**: Mindestens 44px Höhe
- **Kompakte Tab-Navigation**: Übersichtliche 4-Tab-Struktur
- **Responsive Modals**: Automatische Anpassung an Bildschirmgröße
- **Hamburger-Menü**: Mobile Navigation für Demo-Aktionen

## 🚀 Deployment-Status

### ✅ Vollständig implementierte Features

**🧬 Nährstoffbasiertes System**
- ✅ Vollständige Nährstoff-Datenbank (8 Wirkstoffe in 3 Kategorien)
- ✅ Produkt-Nährstoff-Zuordnung mit Gehalt pro Einheit
- ✅ Automatische Dosierungsberechnung
- ✅ DGE + Studien-Empfehlungen integriert
- ✅ Warnschwellen für Überdosierung

**📱 Mobile-First UX**
- ✅ Tab-basierte Details-Modals (4 Tabs: Übersicht, Nährstoff, Dosierung, Kosten)
- ✅ Moderne, intuitive Add/Edit-Modals mit klaren Textfeldern
- ✅ Live-Berechnungen bei Eingabe
- ✅ Touch-freundliche Bedienelemente

**🔄 Intelligenter Stack-Workflow**
- ✅ Nährstoff-first Ansatz (Wirkstoff → Menge → Produkt)
- ✅ Automatische Produktempfehlungen basierend auf Nährstoffbedarf
- ✅ Vergleich verschiedener Produkte mit Kostenanalyse
- ✅ Ein-Klick DGE/Studien-Empfehlungen

**🎮 Demo-System**
- ✅ Realistische Nährstoff-zugeordnete Produkte
- ✅ Vollständige CRUD-Operationen
- ✅ Nährstoffbasierter Stack-Builder
- ✅ Mobile-optimierte Benutzeroberfläche

### Technische Exzellenz
- **Framework**: Hono v4 mit TypeScript
- **Deployment**: Cloudflare Pages mit Workers
- **Datenbank**: Cloudflare D1 (SQLite) - ready for production
- **Authentication**: JWT mit bcrypt Passwort-Hashing
- **Frontend**: Vanilla JavaScript mit TailwindCSS
- **API**: RESTful mit strukturierter Fehlerbehandlung
- **Mobile**: Responsive Design mit Touch-Optimierung

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

## 🌟 Besondere Features

### Nährstoffbasierte Innovation
- **Wissenschaftlich fundiert**: Basiert auf DGE-Empfehlungen und aktuellen Studien
- **Automatisiert**: Keine manuellen Berechnungen mehr nötig
- **Benutzerfreundlich**: Intuitive Workflows von Nährstoffbedarf zu Produktauswahl
- **Kostentransparent**: Automatische Berechnung von Tages-, Monats- und Jahreskosten

### Mobile-First Approach
- **Tab-Navigation**: Übersichtliche Aufteilung komplexer Informationen
- **Touch-Optimierung**: Alle Interaktionselemente mindestens 44px
- **Responsive Modals**: Automatische Anpassung an verschiedene Bildschirmgrößen
- **Progressive Enhancement**: Funktioniert auf allen Geräten perfekt

## 📞 Support

Das nährstoffbasierte System ist vollständig implementiert und getestet. Alle Major-Features sind funktional:

- ✅ Nährstoff-Datenbank und Produkt-Zuordnung
- ✅ Automatische Dosierungsberechnung  
- ✅ Tab-basierte mobile Details-Modals
- ✅ Moderne Add/Edit-Formulare
- ✅ Intelligenter Stack-Builder Workflow
- ✅ Live-Berechnungen und DGE-Integration

Das System ist bereit für den Produktionseinsatz mit Cloudflare D1 Datenbank.

---

**Entwickelt mit 🧬 für nährstoffbasierte Supplement-Verwaltung**# Deployment Fri Sep  5 14:42:11 UTC 2025
