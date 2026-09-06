# Umsetzung: Rechtstexte und Fehlerseite aus Audit Abschnitt 14

Stand: 6. September 2026 · Status: abgeschlossen und produktiv veröffentlicht

Auftrag: LEGAL-01 bis LEGAL-05 und ERR-01/ERR-02 vollständig umsetzen,
testen, unabhängig technisch prüfen, deployen und öffentlich verifizieren.

`[ ]` offen · `[~]` in Arbeit · `[x]` geprüft · `[!]` blockiert

## Verbindlicher Umfang

- [x] LEGAL-01: Impressum mit nachvollziehbarem Änderungsstand und mit dem globalen Affiliate-Hinweis konsistentem Abschnitt.
- [x] LEGAL-02: Datenschutz mit „Kurz erklärt“ zu Daten, Zweck, Dauer und Rechten; vollständige Rechtsfassung und sichtbarer Stand.
- [x] LEGAL-03: Nutzungsbedingungen mit kurzer Alltagseinordnung und vollständiger Fassung; medizinische Grenze präzise und ohne wiederholte Alarmtexte.
- [x] LEGAL-04: Eine zentrale veröffentlichte Rechtstextquelle, sichtbare Version/Stand, vollständige sichere Markdownformatierung und kein nachträglicher Austausch einer abweichenden statischen Fassung.
- [x] LEGAL-05: `/agb` leitet dauerhaft mit HTTP 301/308 auf `/nutzungsbedingungen` weiter; auch interne Navigation verwendet den kanonischen Weg.
- [x] ERR-01: Freundliche Fehlerseite mit Startseite, Wissen und Stacks; keine Wiedergabe tokenhaltiger Pfade.
- [x] ERR-02: Unbekannte Seiten liefern tatsächlich HTTP 404, `noindex`, eigenen Titel und serverseitige H1. Bekannte Routen, Assets und API bleiben funktionsfähig.

## Zusammenarbeit und Abschluss

Abschluss: PR #26 / Merge `753f6f2`; PR-CI `34054342552`, Main-CI
`34054531410` und Deployment `34054531443` erfolgreich. Vollständige
Frontend-Suite: 438/438 Tests; zusätzlich 10/10 Migrationsguards im CI.
Gezielte Nachweise umfassen 51 Backend-/HTTP-/Renderfälle und 10 UI-Fälle.
Build, Lint, UTF-8 und unabhängiger Technikreview der 26 technischen Dateien
PASS. Nutzer-/Creator-Feedback eingearbeitet; keine offenen Befunde.

Live: Drei zentrale Dokumente mit freigegebenem Inhalt, Version 1 und echtem
Datum veröffentlicht. Vollständige Vorher-Snapshots stimmen exakt; beide
Nichtziel-Dokumente bleiben unverändert. API, SSR-Bootstrap und ausgelieferter
Inhalt stimmen überein. Cloudflares E-Mail-Verschleierung wurde ausschließlich
als dokumentierte Transportkodierung normalisiert; die tatsächlichen
E-Mail-Adressen und `mailto:`-Links wurden zusätzlich im Browser bestätigt.

Alle drei Rechtsseiten live bei 1440 und 390 px mit genau einem Textcontainer,
identischem Inhalt und ohne Überlauf geprüft; lokal zusätzlich 320 px.
`/agb` mit und ohne Testparameter: 308 zum festen kanonischen Ziel ohne
Queryübernahme. Unbekannte Seiten: 404, `noindex,nofollow`, eigene H1/Titel,
keine geheime Pfadausgabe. GET/HEAD-Parität und bestehende öffentliche Routen
bestätigt. Browser-Rückkehr zur gültigen Seite setzt `index,follow` und
Seitenanfang korrekt. Das widersprüchliche pauschale Footer-Datum ist entfernt;
der globale Affiliate-Hinweis bleibt unverändert.

Belege: `.agent-memory/legal-ux-20260906/` mit Vorzustand,
Text-/User-/Creator-Feedback, Technikreview, lokalem Browsercheck und
`live-readback.json` plus `live-browser-check.json`.

- [x] Aktuelle Daten-/Runtime-Wahrheit und Artikel-unabhängigen Rechtstextweg inventarisiert.
- [x] Getrennte Programmier- und Textaufgaben umgesetzt; Nutzer-/Creator-Feedback an den jeweiligen Bearbeiter zurückgegeben und notwendige Änderungen eingearbeitet.
- [x] Datenänderungen exakt vorzustands-/versionsgebunden und gesichert; keine Doppelpflege oder erfundenen Angaben.
- [x] Gezielte Tests, UTF-8, ein risikoproportionaler Gesamtcheck und unabhängiger technischer Review bestanden.
- [x] Commit, PR, Merge und Produktionsdeployment erfolgreich.
- [x] Live-Readback von allen drei Rechtsseiten, `/agb`, unbekannten Seiten, wichtigen gültigen Routen, Desktop/Mobil und Datenstand bestanden.
- [x] Audit und Checkliste abgehakt, knapper Deploy-Log-Eintrag je Produktionsaktion.

## Grenzen

Zusammenfassungen ändern keine Rechtsposition und ersetzen die vollständige
Fassung nicht. Kontaktdaten, Fristen, Einwilligungszwecke und Haftungsrechte
werden nicht erfunden oder still verändert. Die bestehenden zentralen
Rechtsdokumente bleiben administrierbar. Es werden keine Produkt-Affiliate-
Badges oder zusätzlichen Produktkennzeichnungen eingeführt.
