# Umsetzung: Rechtstexte und Fehlerseite aus Audit Abschnitt 14

Stand: 6. September 2026 · Status: in Arbeit

Auftrag: LEGAL-01 bis LEGAL-05 und ERR-01/ERR-02 vollständig umsetzen,
testen, unabhängig technisch prüfen, deployen und öffentlich verifizieren.

`[ ]` offen · `[~]` in Arbeit · `[x]` geprüft · `[!]` blockiert

## Verbindlicher Umfang

- [ ] LEGAL-01: Impressum mit nachvollziehbarem Änderungsstand und mit dem globalen Affiliate-Hinweis konsistentem Abschnitt.
- [ ] LEGAL-02: Datenschutz mit „Kurz erklärt“ zu Daten, Zweck, Dauer und Rechten; vollständige Rechtsfassung und sichtbarer Stand.
- [ ] LEGAL-03: Nutzungsbedingungen mit kurzer Alltagseinordnung und vollständiger Fassung; medizinische Grenze präzise und ohne wiederholte Alarmtexte.
- [ ] LEGAL-04: Eine zentrale veröffentlichte Rechtstextquelle, sichtbare Version/Stand, vollständige sichere Markdownformatierung und kein nachträglicher Austausch einer abweichenden statischen Fassung.
- [ ] LEGAL-05: `/agb` leitet dauerhaft mit HTTP 301/308 auf `/nutzungsbedingungen` weiter; auch interne Navigation verwendet den kanonischen Weg.
- [ ] ERR-01: Freundliche Fehlerseite mit Startseite, Wissen und Stacks; keine Wiedergabe tokenhaltiger Pfade.
- [ ] ERR-02: Unbekannte Seiten liefern tatsächlich HTTP 404, `noindex`, eigenen Titel und serverseitige H1. Bekannte Routen, Assets und API bleiben funktionsfähig.

## Zusammenarbeit und Abschluss

Zwischenstand: Gemeinsame API-/SSR-/Client-Projektion und sichere
Markdowndarstellung sind implementiert. 51 Backend-/HTTP-/Renderfälle,
10 UI-/Navigationsfälle und 10 Migrationsfälle bestanden; Produktionsbuild
und Lint bestanden. Nutzer-/Creator-Textfeedback PASS. Tatsächlicher Browser
bestätigt 390/320 px ohne Überlauf, einen Artikelcontainer, formatierte
Kurztexte, Seitenwechsel am Anfang, vertrauliche Pfade ohne Wiedergabe und
korrekte Rückkehr von `noindex` zu `index,follow`. Das widersprüchliche
pauschale Footer-Datum wurde auf direktes Nutzerfeedback entfernt.
Unabhängiger Technikreview und vollständige Release-CI laufen separat.

- [x] Aktuelle Daten-/Runtime-Wahrheit und Artikel-unabhängigen Rechtstextweg inventarisiert.
- [ ] Getrennte Programmier- und Textaufgaben umgesetzt; Nutzer-/Creator-Feedback an den jeweiligen Bearbeiter zurückgegeben und notwendige Änderungen eingearbeitet.
- [ ] Datenänderungen exakt vorzustands-/versionsgebunden und gesichert; keine Doppelpflege oder erfundenen Angaben.
- [ ] Gezielte Tests, UTF-8, ein risikoproportionaler Gesamtcheck und unabhängiger technischer Review bestanden.
- [ ] Commit, PR, Merge und Produktionsdeployment erfolgreich.
- [ ] Live-Readback von allen drei Rechtsseiten, `/agb`, unbekannten Seiten, wichtigen gültigen Routen, Desktop/Mobil und Datenstand bestanden.
- [ ] Audit und Checkliste abgehakt, knapper Deploy-Log-Eintrag je Produktionsaktion.

## Grenzen

Zusammenfassungen ändern keine Rechtsposition und ersetzen die vollständige
Fassung nicht. Kontaktdaten, Fristen, Einwilligungszwecke und Haftungsrechte
werden nicht erfunden oder still verändert. Die bestehenden zentralen
Rechtsdokumente bleiben administrierbar. Es werden keine Produkt-Affiliate-
Badges oder zusätzlichen Produktkennzeichnungen eingeführt.
