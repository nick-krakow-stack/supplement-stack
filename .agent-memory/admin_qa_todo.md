# Admin QA Todo

Last updated: 2026-05-08

Ziel: Abschlussstand der Umsetzung aus `.agent-memory/admin_qa.md` plus
aktueller Code-/Deploy-Pruefung festhalten.

## Status

- Admin-QA Rest-Implementierung ist deployed.
- Preview: `https://39db2d7f.supplementstack.pages.dev`
- Live: `https://supplementstack.de`
- Remote D1 Migrationen bis `0074_knowledge_article_admin_fields.sql` sind
  angewendet.
- `.agent-memory/deployment_images/` bleibt bestehen und enthaelt nur noch
  `.gitkeep`; die erledigten PNGs wurden geloescht.

## Erledigt

- Allgemeines Admin-UI:
  - Kompakte Filterleisten fuer die Hauptlisten.
  - Weniger hohe Listen-/Toolbar-Bereiche.
  - Moderneres, dichteres Admin-Listenmuster.
- Dashboard:
  - Karten, Werte, Abstaende und Aktivitaetsbereiche kompakter.
  - Zeitraum-Auswahl oben rechts im Header neben `live`.
  - Refresh als kompakter Header-Button.
- Benutzerverwaltung:
  - Header `XX Benutzer, davon XX aktiv`.
  - Status/Verifizierung/Rolle aus der Haupttabelle entfernt.
  - Nutzer/Nutzung/Beitrag-Spalten nach QA-Vorgabe.
  - Desktop-Detail-Drawer.
  - Mobile Fullscreen-Sheet mit Zurueck-Button.
  - Admin-Profilseite mit Passwortaenderung.
  - Backend liefert Produkte-im-Stack und Link-Klicks pro User.
- Produkte:
  - Kompakte Filter fuer Freigabe, Partnerlink, Linkcheck und Bildstatus.
  - ID/Nutzer-Zuordnung aus Standardansicht entfernt.
  - Quick-Edit fuer Hauptlink, Affiliate ja/nein und Freigabe.
  - `weitere Links`-Modal fuer mehrere Shoplinks.
  - Bildklick oeffnet Bildmodal; Bildloeschen bleibt verfuegbar.
  - Deadlink-Dashboard-Link fuehrt auf Produktliste mit Deadlink-Filter.
- Wirkstoffe:
  - Header `XX Wirkstoffe gelistet`.
  - ID/Gewicht/Einheit aus Standardansicht entfernt.
  - `Bearbeitungsstand` ersetzt `Recherche-Abdeckung`.
  - Spalte `Arbeitsstand` entfernt.
  - Klickbare Badges fuer Formen, DGE, Wirkstoffteile, Synonyme,
    Blog/Wissen und Richtwerte.
  - Modals fuer Formen, DGE, Wirkstoffteile und Synonyme.
  - Persistente Task-Status-Tabelle fuer `keine ...`/erledigt-Zustaende.
  - Empfehlungsspalte mit Hauptempfehlung, Alternative 1 und Alternative 2.
  - Produktempfehlungen koennen optional einen konkreten `shop_link_id`
    speichern.
  - Nutzer-/Public-Produktlisten bevorzugen die Empfehlungsslots bei der
    Sortierung, ohne das Wort `Empfehlung` in der Nutzeransicht zu erzwingen.
  - Bestehende Formen und Synonyme koennen im Modal inline bearbeitet werden.
  - Bestehende Wirkstoffteile koennen im Modal mit Notiz/Reihenfolge bearbeitet
    werden.
  - DGE-Quellen koennen im Modal angelegt, bearbeitet und geloescht werden.
- Richtwerte:
  - Titel/Labels auf `Richtwerte`.
  - Sichtbare Filter reduziert auf Wirkstoff, Quellenstatus und Linktyp.
  - Aktiv/Public-Filter aus Adminansicht entfernt.
  - ID aus Standardliste entfernt.
  - Interner/externer Link wird automatisch gelabelt.
- Uebersetzungen:
  - `Expertenprofile` aus UI-Auswahl entfernt.
  - Blogartikel bleibt als Entity sichtbar.
  - Originalfelder klarer beschriftet.
  - Layout/Filter verdichtet.
- Wechselwirkungs-Matrix:
  - Weitere Dichte-Reduktion.
  - Checkbox-Reihe fuer aktive Wirkstoffe.
  - Matrix filtert auf aktive Auswahl.
  - Detail-/Hoverbereich dauerhaft sichtbar/sticky im Matrixbereich.
- Shop-Domains:
  - Suche, Refresh und gruener Plus-Button in einer Zeile.
  - Neue Domain per Modal statt dauerhafter grosser Card.
- Rechtliches:
  - Admin-Seite und DB-Fallback existieren.
- Audit-Log:
  - Sichtbare Admin-Seite/Route/API entfernt.
- Einstellungen:
  - Direkte Route bleibt fuer spaeter, aber nicht in der Hauptnavigation.
- Wissensdatenbank:
  - Quellen werden in der Admin-Oberflaeche als `Name` + `Link` gepflegt.
  - Mehrfachquellen werden in `knowledge_article_sources` gespeichert und
    zusaetzlich in `sources_json` gespiegelt.
  - Artikelbild, Fazit, Dosierungsdetails, Wirkstoff-Zuordnung und
    Produkt-Hinweis sind umgesetzt.
  - Public-Artikel rendern die neuen Felder, wenn sie gepflegt sind.

## Bekannte Restgrenzen

- Authentifizierte Browser-QA ist noch offen, weil lokal keine Admin-Session
  oder Credentials verfuegbar sind.
- Die offenen Implementierungspunkte aus Wirkstoff-Modals und
  Wissensdatenbank-Deep-Features sind umgesetzt. Offen bleibt die
  authentifizierte Browser-QA durch den Owner.
- Richtwerte-Quellenstatus und Linktyp werden in der Adminliste aus
  vorhandenen Feldern abgeleitet; ein eigener persistenter Backend-Status ist
  nicht eingefuehrt.

## Validierung

- `frontend`: `npx tsc --noEmit` bestanden.
- `functions`: `npx tsc -p tsconfig.json --noEmit` bestanden.
- `frontend`: `npm run build` bestanden.
- `git diff --check` bestanden, nur bestehende LF/CRLF-Warnungen.
- Remote D1:
  - `0073_ingredient_admin_task_status.sql` angewendet.
  - `ingredient_admin_task_status` in `sqlite_master` bestaetigt.
  - `0074_knowledge_article_admin_fields.sql` angewendet.
  - neue `knowledge_articles`-Spalten, `knowledge_article_sources` und
    `knowledge_article_ingredients` remote bestaetigt.
- Preview/live:
  - `/`, `/administrator/dashboard`, `/administrator/ingredients`,
    `/administrator/products`, `/administrator/users`,
    `/administrator/dosing`, `/administrator/interactions`,
    `/administrator/shop-domains` und `/api/products` liefern HTTP 200.
  - unauthentifizierte `/api/admin/stats`,
    `/api/admin/ingredients?limit=1` und
    `/api/admin/products/1/shop-links` liefern HTTP 401.
  - `/api/admin/audit-log` liefert HTTP 404.
  - aktuelle Live/Preview-Startseite liefert Asset `index-CSf4JTu0.js`.
  - unauthentifizierte `/api/admin/knowledge-articles` liefert HTTP 401.

## Naechste sinnvolle QA

1. Mit Admin-Login im Browser die neuen Detail-Drawer/Modals einmal
   durchklicken.
2. Produkt-Hauptlink und `weitere Links` fuer ein Testprodukt speichern.
3. Wirkstoff-Task-Status und Empfehlungsslots fuer einen Testwirkstoff
   speichern.
4. Dashboard-Range umschalten und Werte plausibilisieren.
5. Mobile Breite fuer Benutzer-Details, Produktmodal und Wirkstoffmodal
   pruefen.
