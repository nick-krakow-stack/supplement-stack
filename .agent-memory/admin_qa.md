# Admin QA durch User

## Allgemein
- Filter-Boxen:
-- Filter nebeneinander, nicht untereinander, dabei auf Breite achten
-- Moderneres Design fÃ¼r alle Listen, recherchiere gerne vorher nach modernem Design und intuitivem Aufbau

## MenÃ¼
- Admin User anklickbar machen mit Profilanzeige und PasswortÃ¤nderung

## Dashboard
- Schau dir die dashboard_riesig.png an
-- Karten und alles kleiner machen, so ist das riesig am Desktop
-- Zeitraum-Filter nach oben rechts verlegen (links neben "live"), ohne Box drumherum, kleiner, kein Titel

## Wirkstoffe
- Statt "Ãœbersicht Ã¼ber Recherche, Quellen, Dosisdaten, Blogartikel und Anzeigeprofile je Wirkstoff." unter der Ãœberschrift lieber "XX Wirkstoffe gelistet"
- Unter "Wirkstoff-Katalog" den Sub-Text rausnehmen
- Die ID-Nummer muss nicht angezeigt werden, ebenso wenig die Gewichtsangabe. In der Spalte "Wirkstoff" reicht der Name des Wirkstoffs
- Statt "Recherche-Abdeckung" mÃ¶chte ich lieber "Bearbeitungsstand". Dort steht dann alles, was erledigt ist oder noch getan werden muss. Die Spalte "Arbeitsstand" kannst du lÃ¶schen.
- Klicke ich auf eine Sache, die noch zu tun ist, sollte sich das entsprechende Fenster Ã¶ffnen. Ich klicke auf DGE, dann sollte ich dorthin kommen, wo ich das bearbeiten kann. Bestenfalls ein einfaches Modal bei den Dingen, die leicht einzutragen sind. Und nur bei Dingen wie Blog-Artikeln Ã¶ffnet sich dann wirklich die Unterseite mit den Blog-Artikeln.
- Folgende Dinge mÃ¶chte ich darin haben:
-- "Formen" als Modal. Da kann ich die mÃ¶glichen Formen eintragen oder einen Haken setzen bei "Keine speziellen Darreichungsformen vorhanden". Ist das angeklickt, gilt die Bearbeitung als erledigt und alle Felder werden nicht klickbar ausgegraut. Wenn ich Formen angebe, steht dort zum Beispiel "Formen (2)". Klicke ich dann drauf, Ã¶ffnet sich das Modal, ich kann sie sehen, bearbeiten und neue hinzufÃ¼gen oder lÃ¶schen.
-- "DGE" als Modal. Dort kann ich die Daten der DGE sowie einen Link eintragen und einen Kommentar, wenn ich das fÃ¼r nÃ¶tig halte. Dazu gibt es einen Haken fÃ¼r "Keine Empfehlungen oder EinschrÃ¤nkungen laut DGE". Kreuze ich das an, gilt das als erledigt und alle anderen Felder werden ausgegraut.
-- "Wirkstoffteile" behandeln wir Ã¤hnlich wie Formen. Ein Modal, in dem ich alles eintragen, hinzufÃ¼gen und bearbeiten kann. Klicke ich auf "Keine speziellen Wirkstoffteile vorhanden", werden die Felder unbeschreibbar ausgegraut und die Sache zÃ¤hlt als erledigt. Wenn ich Wirkstoffteile angebe, steht dort zum Beispiel "Wirkstoffteile (5)". Klicke ich dann drauf, Ã¶ffnet sich das Modal, ich kann sie sehen, bearbeiten und neue hinzufÃ¼gen oder lÃ¶schen.
-- "Synonyme" machen wir auch so. "Keine Synonyme" im Modal anklicken und es zÃ¤hlt als erledigt. Wenn ich Synonyme angebe, steht dort zum Beispiel "Synonyme (3)". Klicke ich dann drauf, Ã¶ffnet sich das Modal, ich kann sie sehen, bearbeiten und neue hinzufÃ¼gen oder lÃ¶schen.
-- Blog / Wissen. Klicke ich drauf, Ã¶ffnet sich die Blog-Seite des Wirkstoffs zum Bearbeiten. Da wir in den Blogartikeln auch die Verlinkungen zu Studien machen, brauchen wir im Wirkstoff-Katalog keine Dosis-Quellen.
-- Filter-Dropdown-MenÃ¼ fÃ¼r diese Punkte
- Spalte "Empfehlung" hinzufÃ¼gen
-- Hauptempfehlung (Klick -> Modal Ã¶ffnet sich -> Hauptprodukt zum Wirkstoff auswÃ¤hlen, falls mehr als 1 Shop-Link zum Produkt vorhanden Shop-Link auswÃ¤hlen)
-- Alternative 1 (Klick -> Modal Ã¶ffnet sich -> Alternativ-Empfehlung zum Wirkstoff auswÃ¤hlen, falls mehr als 1 Shop-Link zum Produkt vorhanden Shop-Link auswÃ¤hlen)
-- Alternative 2 (Klick -> Modal Ã¶ffnet sich -> Alternativ-Empfehlung zum Wirkstoff auswÃ¤hlen, falls mehr als 1 Shop-Link zum Produkt vorhanden Shop-Link auswÃ¤hlen)
--- Wichtig: Wir nennen das bei der Nutzer dann aber nicht "Empfehlung", wir sortieren die Produkte nur danach. Was empfohlen ist, wird angezeigt. Alles andere erst wenn jemand "Mehr anzeigen" klickt oder ein spezielles Produkt sucht
- "Dosiswerte" in "Richtwerte" umbenennen
-- Bei Klick darauf nicht due aktuelle Detailseite, sondern direkt die Detailseite, die aktuell unter "Dosis-Richtwerte" zu finden ist inkl. dem Namen des Wirkstoffs in der Suchleiste, damit auch nur dieser angezeigt wird

## Produkte
- Ich muss Produkte keinem Nutzer zuordnen kÃ¶nnen
- Beim Klick auf das Bild sollte sich ein Modal Ã¶ffnen. In dem Modal kann ich das aktuelle Bild lÃ¶schen und ein neues Bild hochladen
- Die ID kann weg
- Wir brauchen Filter
-- "Freigegeben", "Nicht freigegeben", "Gesperrt", "Alle" (Standard: Alle)
-- "Partnerlink", "Kein Partnerlink", "UngeprÃ¼fter Link", "Alle" (Standard: Alle)
-- "Bild vorhanden", "Kein Bild vorhanden", "Alle" (Standard: Alle)
-- "Deadlinks", "Alle" (Standard: Alle). KÃ¶nnte man auch als simple Checkbox "Nur Deadlinks" machen
- "sichtbar"-Label kann weg
- "Nutzer"-Label kann weg.
- Wenn ich einen Link eintrage, muss ich an- oder abhaken kÃ¶nnen, ob es ein Affiliate-Link ist oder nicht (Standard: Ja). Kann sein, dass ich Shops freigebe, aber dort kein Affiliate bin. Das ist aber etwas anderes als ein Link, der von einem User eingetragen wurde. Diese Ãœbersicht reicht vÃ¶llig. "Welcher User" ist irrelevant in dem Kontext
- Der Status "Gesperrt" sperrt ein Produkt fÃ¼r die Allgemeinheit, sodass es nur der User sehen kann, der es eingetragen hat. Dies kÃ¶nnen wir fÃ¼r einzelne Produkte machen oder auch fÃ¼r einen User an sich, sodass neu eingereichte Links gar nicht erst zur PrÃ¼fung auftauchen, sondern direkt als "Gesperrt" eingetragen werden.
- Beim Shop-Link brauchen wir noch "Weiteren Link eintragen". So kÃ¶nnen wir spÃ¤ter die Nutzer entscheiden lassen, bei welchem Shop sie bestellen wollen. Der erste angezeigte Link ist der ausgewÃ¤hlte Haupt-Link aus der Produktempfehlung

## Dosis-Richtwerte
- EHA und DPA kÃ¶nnen weg, das gibt es sowieso nur im Kontext zu Omega 3
- Was User fÃ¼r sich selber eintragen, muss ich nicht sehen. Irrelevant
- Filter:
-- Der Quellen-Filter sollte sortieren nach "Offiziell", "Studien vorhanden" und "Keine Studien vorhanden" sowie "Alle" (Standard: Alle)
-- "Aktiv / Inaktiv" kann weg. Warum sollte ein Wirkstoff inaktiv sein?
-- "Public / Privat" kann auch weg. Das gibt es bei Dosierungen nicht. Was ein User fÃ¼r sich eintrÃ¤gt ist fÃ¼r mich irrelevant
-- Es bleiben also nur die Filter fÃ¼r den Wirkstoff und die Quellen
- ID kann weg
- Label fÃ¼r "Externer Link" (rot) und "Interner Link" (grÃ¼n). Nicht auswÃ¤hlbar, sondern automatisch gesetzt, je nachdem, ob der Verweis zum Richtwert zu einer Unterseite fÃ¼hrt oder einen externen Quelle
- Auch dafÃ¼r ein Filter

## Wissen
- Quellen nicht als JSON, sondern in 2 Feldern als "Name" und als Link eingeben
- Mehrfachquellen mÃ¶glich
- Optional Artikelbild hochladen und einfÃ¼gen
- Fazit-Bereich einbauen (KurzÃ¼bersicht Ã¼ber Erkenntnisse)
- Details zu Dosierungen (Minimum / Maximum inkl. Dropdown der MaÃŸeinheit)
- Dropdown fÃ¼r Wirkstoff-Zuordnung (Rekursiv. Ist also egal, ob ich beim Wirkstoff via Dropdown den Blogartikel auswÃ¤hle oder ob ich im Blogartikel den Wirkstoff auswÃ¤hle. Wird beides gleich gespeichert und abgerufen)
- Hinweistext (optional) fÃ¼r das Produkt

## Ãœbersetzungen
- Formatierungen prÃ¼fen. Teils fehlt die Left-Margin
- Beim Abschnitt "Original" sollte klar sein, was welche Kategorie ist, also "Name", "Beschreibung", "Mangel-Symptome" und "Ãœberschuss-Symptome"
- Was sind "Expertenprofile"? Haben wir nicht. Kann weg.
- Blogartikel werden aktuell nicht angezeigt. Bitte Ã¤ndern

## Wechselwirkungs-Matrix
- Bitte kleiner machen. Kleinere Schriftart, weniger AbstÃ¤nde. Das macht es Ã¼bersichtlicher
- Die Hover-Details sollte man immer sehen kÃ¶nnen, sonst ergibt es keinen Sinn, die unter der Liste anzuzeigen. Beispielsweise als Footer Overlay (Dann musst du nur auf den Matrix-Abstand achten, damit man auch alles sieht, wenn man bis unten scrollt).
- DarÃ¼ber eine Checkbox-Reihe mit den aktiven Wirkstoffen, um bewusst bestimmte Dinge kontrollieren zu kÃ¶nnen
- Formatierung prÃ¼fen. An vielen Stellen ist der Abstand falsch, beispielsweise bei den Dropdows fehlt die Left-Margin und in der Matrix selbst Ã¼berlappen die Wirkstoffnamen teils die Felder

## Benutzerverwaltung
- Statt "Nur Rolle und Trusted-Submitter-Status sind editierbar. Weitere Kontodaten bleiben bewusst read-only" besser "XX Benutzer, davon XX aktiv" (Aktiv bedeutet, dass der Account aktiviert wurde)
- Karte "Gesperrt" hinzufÃ¼gen
- Spalte "Verifizierung" kann raus
- Spalte "Status" kann raus
- Spalte "Rolle" kann raus. Jemanden zum Admin ernennen kann ich in den Details machen, so brauche ich das nicht wirklich
- "Nutzer"-Spalte:
-- ID kann raus
-- Stattdessen in Nutzer-Spalte "Name, Email", "Erstellt am" (nur Datum, keine Uhrzeit)
- Spalte "Nutzung":
-- Anzahl Stacks, Anzahl Produkte im Stack, Link-Klicks
- Spalte "Beitrag"
-- Eingereichte Produkte, Verifizierte Produkte, Gesperrte Produkte

## Shop-Domains
- Der Button "Aktualisieren" kann bitte in dieselbe Zeite wie die Suchleiste. Spart Platz
- Daneben kann ein Plus auf grÃ¼ndem Hintergrund als Symbol, um eine neue Domain anzulegen. Klick drauf, Modal Ã¶ffnet sich, dort kÃ¶nnen Domain und Name eingetragen und gespeichert werden.

## Einstellungen
- Die aktuelle Ãœbersicht hilft mir nicht
- Dort kÃ¶nnen wir besser Systemeinstellungen machen
- Ãœberleg dir was sinnvolles. Wenn es nichts gibt, streich den Punkt

## Abgestimmte Entscheidungen nach RÃ¼ckfrage

- Audit-Log kann vollstÃ¤ndig aus dem Admin verschwinden:
-- Kein MenÃ¼punkt.
-- Kein Button in "Was passiert gerade".
-- Bestehende Audit-Daten kÃ¶nnen intern weiter fÃ¼r Nachvollziehbarkeit/API/Debugging bleiben, bekommen aber keine eigene Admin-OberflÃ¤che.

- "Gesperrt" bedeutet:
-- Ein gesperrtes Produkt ist fÃ¼r die Allgemeinheit nicht sichtbar.
-- Der User, der es eingetragen hat, darf es weiterhin sehen.
-- Admin kann einzelne Produkte sperren.
-- Admin kann einen User/Submitter so markieren, dass neu eingereichte Links/Produkte dieses Users automatisch als "Gesperrt" angelegt werden und gar nicht erst in der normalen PrÃ¼fung auftauchen.
-- Technisch als eigener Produktstatus/Sichtbarkeitszustand abbilden, nicht nur als Label.

- Mehrere Shop-Links pro Produkt:
-- Pro Produkt sind mehrere Shop-Links mÃ¶glich.
-- Pro Link speichern:
--- Shop/Domain bzw. Shop-Name.
--- URL.
--- Affiliate-Link ja/nein, Standard: ja.
--- Hauptlink ja/nein.
--- Aktiv ja/nein.
--- letzter Linkcheck inkl. Status/HTTP-Code/Fehlergrund, wenn vorhanden.
-- Der erste in Nutzeransichten angezeigte Link ist der Hauptlink aus der Produktempfehlung.
-- Wenn eine Wirkstoff-Empfehlung auf ein Produkt zeigt und dieses Produkt mehrere Shop-Links hat, muss im Empfehlungs-Modal der konkrete Shop-Link ausgewÃ¤hlt werden.

- Link-Klicks und Besucherzahlen:
-- Besucherzahlen sollen mÃ¶glichst Ã¼ber die bereits eingebauten Analytics laufen.
-- FÃ¼r Dashboard-Kennzahlen, Filter und Nutzer-/Produkt-Auswertungen brauchen Produkt-Link-Klicks trotzdem eine first-party Tracking-Tabelle in unserer DB.
-- Grund: Externe Analytics sind fÃ¼r UI-Auswertungen, Produktfilter und Affiliate/Nicht-Affiliate-AufschlÃ¼sselung nicht zuverlÃ¤ssig genug direkt querybar.
-- Produktlinks sollten deshalb Ã¼ber einen internen Redirect-/Tracking-Endpunkt laufen, der den Klick zÃ¤hlt und danach zum Shop weiterleitet.
-- Erfasst werden sollten mindestens: Produkt, Shop-Link, User optional/anonym, Stack optional, Affiliate ja/nein, Zeitpunkt, Referrer-Kontext.

- Einstellungen:
-- Den Punkt "Einstellungen" vorerst streichen.
-- Falls spÃ¤ter echte Systemeinstellungen entstehen, kÃ¶nnen sie neu geplant werden, z. B. Feature Flags, Cron-Intervalle, Legal/Consent-Konfiguration oder Integrationsstatus.

## ErgÃ¤nzter Umsetzungsplan

### Phase 1 - Admin-MenÃ¼ und Dashboard-Konsolidierung

- MenÃ¼ entschlacken und umbenennen:
-- "Wissen" -> "Wissensdatenbank".
-- "Dosis-Richtwerte" -> "Richtwerte".
-- Audit-Log, Go-Live-Checks, Health, Rankings, Sub-Wirkstoffe und Einstellungen entfernen.
-- Nutzer-Produkte, ProduktprÃ¼fung und Linkmeldungen aus dem MenÃ¼ entfernen, sobald die Funktionen in Produkte integriert sind.
-- "Rechtliches" hinzufÃ¼gen.

- Dashboard:
-- Suche/Command-Palette nach `search_modal.png` umbauen.
-- Sub-Ãœberschrift: "Ãœberblick Â· AktivitÃ¤ten Â· Top-Aufgaben".
-- Offene Wirkstoff-, Produkt- und LinkprÃ¼fungen klickbar machen.
-- User-Stacks-Karte nach `user_stacks_card.png` gestalten.
-- "Was passiert gerade" nach `was_passiert.png` als echte Ã„nderungsÃ¼bersicht bauen, ohne Audit-Log-Button.
-- Zeitraumfilter einfÃ¼hren: 30 Tage, 60 Tage, 1 Jahr, Diesen Monat, Letzten Monat, Gesamt.
-- Neue Top-Karten: Benutzer, Link-Klicks, Deadlinks, Anmeldungen.
-- Keine Dashboard-Karte "Neue Besucher" mit Anmeldungen-Subtext.
-- Stattdessen Karte "Anmeldungen": Hauptzahl = registrierte Nutzer im Zeitraum; Subtext = davon aktivierte Nutzer, also Nutzer mit geklicktem E-Mail-Aktivierungslink (`email_verified_at IS NOT NULL`).

### Phase 2 - Produkte als zentrale Operations-Seite

- Nutzer-Produkte, ProduktprÃ¼fung und Linkmeldungen in die Produktseite integrieren.
- Produktliste vereinfachen:
-- ID ausblenden.
-- sichtbar-/Nutzer-Labels entfernen.
-- Bildklick Ã¶ffnet Bild-Modal mit LÃ¶schen und Upload.
-- Filter fÃ¼r Freigabe, Partnerlink, Bildstatus, Deadlinks und Gesperrt.
- Mehrere Shop-Links pro Produkt einfÃ¼hren.
- Produktstatus "Gesperrt" inklusive User-Submitter-Automatik einfÃ¼hren.
- Deadlink-Filter fÃ¼hrt aus Dashboard direkt auf Produkte mit fehlerhaften Links.
- Link erneut prÃ¼fen direkt aus Produktliste/Modal ermÃ¶glichen.

### Phase 3 - Wirkstoffe-Bearbeitungsstand und Empfehlungen

- Wirkstoffliste vereinfachen:
-- Untertitel als "XX Wirkstoffe gelistet".
-- ID und Gewichtsangabe entfernen.
-- "Recherche-Abdeckung" -> "Bearbeitungsstand".
-- Spalte "Arbeitsstand" entfernen.
- Bearbeitungsstand als klickbare Aufgaben/Badges:
-- Formen als Modal mit "Keine speziellen Darreichungsformen vorhanden".
-- DGE als Modal mit Daten, Link, Kommentar und "Keine Empfehlungen oder EinschrÃ¤nkungen laut DGE".
-- Wirkstoffteile als Modal mit "Keine speziellen Wirkstoffteile vorhanden".
-- Synonyme als Modal mit "Keine Synonyme".
-- Blog/Wissen Ã¶ffnet die Wissensdatenbank bzw. den Artikelkontext.
-- Filter-Dropdown fÃ¼r Bearbeitungsstand-Punkte.
- Empfehlungen-Spalte:
-- Hauptempfehlung, Alternative 1, Alternative 2.
-- Auswahl von Produkt plus konkretem Shop-Link.
-- Nutzeransicht nutzt diese Daten zur Sortierung/Anzeige, nennt es aber nicht "Empfehlung".
- "Dosiswerte" -> "Richtwerte"; Klick fÃ¼hrt zur Richtwerte-Seite mit Wirkstoff in der Suche.

### Phase 4 - Richtwerte, Wissen, Ãœbersetzungen, Matrix

- Richtwerte:
-- EHA/DPA entfernen.
-- User-private/public Dosierungen aus Adminansicht entfernen.
-- Nur Wirkstoff- und Quellenfilter behalten/verbessern.
-- Offiziell/Studien vorhanden/Keine Studien vorhanden/Alle.
-- Externer/interner Link automatisch labeln und filterbar machen.

- Wissensdatenbank:
-- Quellen aus JSON in strukturierte Mehrfachquellen mit Name und Link migrieren.
-- Optionales Artikelbild.
-- Fazit-Bereich.
-- Dosierungsdetails mit Minimum/Maximum und Einheit.
-- Wirkstoff-Zuordnung bidirektional speichern/anzeigen.
-- Optionaler Hinweistext fÃ¼r Produkte.

- Ãœbersetzungen:
-- Left-Margin/Formatierung prÃ¼fen.
-- Originalfelder klar labeln.
-- Expertenprofile entfernen.
-- Blogartikel anzeigen.

- Wechselwirkungs-Matrix:
-- Dichte weiter reduzieren.
-- Hover-Details dauerhaft sichtbar machen, z. B. als Footer-Overlay.
-- Checkbox-Reihe fÃ¼r aktive Wirkstoffe.
-- Dropdown-/Matrix-AbstÃ¤nde und NamensÃ¼berlappungen korrigieren.

### Phase 5 - Benutzer, Shop-Domains, Rechtliches

- Benutzerverwaltung:
-- Kopftext: "XX Benutzer, davon XX aktiv".
-- Karte "Gesperrt".
-- Verifizierung, Status und Rolle aus Tabelle entfernen.
-- Nutzer-Spalte: Name, Email, Erstellt am.
-- Nutzung: Stacks, Produkte im Stack, Link-Klicks.
-- Beitrag: Eingereichte, verifizierte, gesperrte Produkte.
-- Admin-Rolle und Sperrstatus in Details bearbeiten.

- Shop-Domains:
-- Aktualisieren-Button in Suchleisten-Zeile.
-- GrÃ¼ner Plus-Icon-Button fÃ¼r neue Domain.
-- Anlage per Modal mit Domain und Name.

- Rechtliches:
-- Neue Admin-Seite fÃ¼r Impressum, Datenschutz, Cookie Consent und verwandte Texte.
-- Live-Rechtsseiten lesen aus DB mit statischem Fallback, damit keine leeren Rechtstexte ausgeliefert werden.

## Umsetzung 2026-05-07 - Core-Migrationsblock

- Angelegt/umgesetzt:
-- `0072_admin_operations_core.sql` mit `product_shop_links`, `product_shop_link_health`, `product_link_clicks`, Submitter-Sperrstatus, Empfehlung-Shoplink-Feldern und `legal_documents`.
-- Produktstatus `blocked` backend- und frontendseitig erlaubt.
-- Ã–ffentliche Produktdetails liefern nur noch `approved/public`.
-- Produktklicks laufen fÃ¼r Katalog-Produkte Ã¼ber `/api/products/:id/out` und schreiben minimalistische Klickdaten ohne IP/User-Agent.
-- Dashboard nutzt keine Besucher-Karte, sondern `Anmeldungen` mit Aktivierungen per `email_verified_at`.
-- Admin-MenÃ¼ zeigt nur noch die abgestimmten Kernpunkte inkl. Rechtliches.
-- Produkte-Seite hat Filter fÃ¼r Freigabe, Partnerlink, Bildstatus und Linkcheck sowie Bild-Upload/-LÃ¶schen.
-- Benutzerverwaltung kann Submitter sperren; kÃ¼nftige User-Produkte gesperrter Submitter werden automatisch `blocked`.
-- Scheduled Link-Health schreibt zusÃ¤tzlich linkbasierte Health-Daten.

- Noch offen aus diesem Plan:
-- Wirkstoff-Bearbeitungsstand-Modals, Empfehlungsslots mit konkreter Shoplink-Auswahl.
-- Strukturierte Wissensquellen.
-- Matrix/Shop-Domains/Ãœbersetzungen final nach QA-Bildern polieren.

## Umsetzung 2026-05-07 - Shop-Link/Legal/Audit-Finalisierung

- Angelegt/umgesetzt:
-- Produktdetail `Shop-Link` nutzt jetzt den Mehrfach-Shoplink-Editor.
-- Shop-Links kÃ¶nnen angelegt, bearbeitet, gelÃ¶scht, sortiert, aktiviert/deaktiviert, als Hauptlink markiert und einem Owner-Typ zugeordnet werden.
-- Manueller Link-Check ist pro Shop-Link im UI verfÃ¼gbar und nutzt die `product_shop_link_health`-Tabelle.
-- Der aktive Hauptlink bzw. erste aktive Link wird weiterhin in die Legacy-Felder am Produkt gespiegelt.
-- Live-Rechtsseiten lesen verÃ¶ffentlichte DB-Rechtstexte und fallen sonst auf statische Inhalte zurÃ¼ck.
-- Sichtbarer Audit-Log wurde entfernt: keine Admin-Seite, keine React-Route, kein `/api/admin/audit-log`.
-- Alle erledigten Bilder in `.agent-memory/deployment_images/` wurden geloescht; der Ordner bleibt mit `.gitkeep` bestehen.

## Umsetzung 2026-05-08 - Admin-QA Restpunkte Wissen/Wirkstoffe

- Angelegt/umgesetzt:
-- `0074_knowledge_article_admin_fields.sql` mit strukturierten Quellen,
   Artikelbild-Feldern, Fazit, Dosis-Min/Max/Einheit, Produkt-Hinweis und
   Wirkstoff-Zuordnung.
-- Wissensdatenbank-Quellen werden im Admin als `Name` + `Link` gepflegt,
   nicht mehr als JSON-Eingabe. `sources_json` bleibt als
   Kompatibilitaets-Spiegel/Fallback erhalten.
-- Wissensdatenbank-Artikel koennen Artikelbild, Fazit, Dosisdetails,
   Wirkstoff-Zuordnung und Produkt-Hinweis speichern und public rendern.
-- Formen, Synonyme und Wirkstoffteile koennen in den Wirkstoff-Modals nicht
   nur angelegt/geloescht, sondern auch bestehend bearbeitet werden.
-- DGE-Quellen koennen im Wirkstoff-Modal angelegt, bearbeitet und geloescht
   werden; gespeichert wird weiterhin in `ingredient_research_sources`.
-- DGE-Erkennung erkennt neben `dge`/`dge.de` auch ausgeschriebene
   Deutsche-Gesellschaft-fuer-Ernaehrung-Varianten.

- Deploy/Validierung:
-- Remote D1 Migration `0074_knowledge_article_admin_fields.sql` angewendet.
-- Pages Deployment: `https://39db2d7f.supplementstack.pages.dev` und live
   `https://supplementstack.de`.
-- `frontend`: `npx tsc --noEmit` bestanden.
-- `functions`: `npx tsc -p tsconfig.json --noEmit` bestanden.
-- `frontend`: `npm run build` bestanden.
-- `git diff --check` bestanden, nur bekannte LF/CRLF-Warnungen.

- Offen:
-- Authentifizierte Browser-QA durch den Owner.
