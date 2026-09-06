# Umsetzung: Copy-Register, Punkte 1–8

Stand: 6. September 2026 · Status: in Arbeit

Zwischenstand: Alle acht Punkte implementiert beziehungsweise bereits korrekte
Umsetzung bestätigt. Paket A: 19/19 gezielte Tests und unabhängiges Nutzer-/
Creator-Feedback PASS. Paket B: 47/47 gezielte Tests PASS; unabhängiger
Runtime-/Retry- und Nutzer-/Creator-Check läuft. Produktionsbuild (1516 Module),
UTF-8 der 22 Änderungsdateien und Diffprüfung bestanden. Veröffentlichung und
Live-Abnahme stehen noch aus.

Auftrag: Die ersten acht Zeilen aus Abschnitt 15 von
`audit_user_creator_ux_seo.md` vollständig umsetzen, prüfen und deployen.
Die Nummern unten dienen nur der eindeutigen Zuordnung dieser acht Zeilen.

## Verbindlicher Umfang

- [ ] COPY-01: „Menü öffnen“ beziehungsweise „Menü schließen“ folgt dem Zustand.
- [ ] COPY-02: Profil-Link zeigt „Mein Profil“, E-Mail nur ergänzend/gekürzt.
- [ ] COPY-03: Ladeanzeigen nennen den jeweiligen Vorgang statt allein „Laden...“.
- [ ] COPY-04: Unbekannte Fehler nennen den gescheiterten Vorgang verständlich und bieten einen passenden erneuten Versuch.
- [ ] COPY-05: Gesundheitsfooter verwendet den vorgegebenen Orientierungstext ohne unreferenziertes Sternchen oder „konsultiere“.
- [ ] COPY-06: „Optionale Nutzungsanalyse“ und „Die App funktioniert auch, wenn du ablehnst.“; Consent-Wirkung bleibt unverändert.
- [ ] COPY-07: „Quellen: DGE, EFSA und NIH“ statt der bisherigen Kurzform.
- [ ] COPY-08: „Kosten pro Einnahme im Vergleich“ statt „Preis-pro-Portion Vergleich“.

## Prüfung und Veröffentlichung

- [ ] Bestehende und geänderte Fundstellen je Punkt dokumentiert; weitere Copy-Register-Zeilen und Artikeltexte unverändert.
- [ ] Programmierpakete unabhängig aus Nutzer-/Creator-Sicht geprüft; notwendige Rückmeldungen vom jeweiligen Autor eingearbeitet.
- [ ] Gezielte Regressionstests, UTF-8 und proportionale Gesamtprüfung bestanden; bei verändertem Runtime-Verhalten zusätzlich genau ein unabhängiger Technikreview.
- [ ] Commit, PR, Merge und Produktionsdeployment abgeschlossen.
- [ ] Öffentliche Desktop-/Mobilansicht und relevante Zustände geprüft; Audit und Deploy-Log aktualisiert.

## Grenzen

Keine neue Pflegequelle oder freie Änderung medizinischer Artikel, Datenbank-
oder Rechtstextbestände. Globale Affiliate-Formulierung und Zustimmungseffekt
bleiben erhalten. Vorhandene sichere Retry-/Validierungswege werden genutzt;
kein pauschales Wiederholen schreibender Aktionen.

## Fundstellen und Nachweisplan

| Punkt | Autoritative Oberfläche | Nachweis |
|---|---|---|
| 01–02 | Gemeinsames `Layout`: mobile Navigation und Profil-Link | Vorhandene Layout-Tests; mobile Menüprüfung live, Profilzustand im Komponententest. |
| 03 | Routen-Ladeanzeige, eigene Produkte und verbleibende allgemeine Admin-Ladeanzeigen | Vollständiger UI-Textabgleich; gezielte Tests auf kontextbezogene Statusanzeigen. Bereits konkrete Artikel-/Creator-/Stack-Ladeanzeigen bleiben bestehen. |
| 04 | Eigenes Produktformular und Wechselwirkungsverwaltung | Fehlerfälle und erneute manuelle Versuche in gezielten Tests; kein automatisches Wiederholen von Schreibvorgängen. |
| 05 | Gemeinsamer Gesundheitsfooter | Exakter Zieltext im bestehenden dezenten Aufklappbereich; Affiliate-Textvergleich und öffentliche Ansicht. |
| 06 | Cookie-Auswahl und Profil | Einheitlicher Name/Folgesatz; Zustimmung, Ablehnung und erneutes Öffnen in Tests, öffentliche Auswahl live. |
| 07–08 | Startseiten-Einstieg und Funktionsbeschreibung | Zieltexte in Tests und produktiver Desktop-/Mobilansicht. |

Öffentliche UI-Zustände werden live geprüft. Angemeldete Profil-/Admin- und
künstlich ausgelöste Fehlerzustände werden isoliert in Komponententests geprüft,
ohne dafür Produktionsdaten zu ändern oder Fehler in der Live-App zu erzwingen.
