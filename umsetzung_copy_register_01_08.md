# Umsetzung: Copy-Register, Punkte 1–8

Stand: 6. September 2026 · Status: abgeschlossen und produktiv veröffentlicht

Abschluss: PR #27 / Merge `d08ae8e`; PR-CI `34061191730`, Main-CI
`34061348675` und Deployment `34061348653` PASS. Vollständige Frontend-Suite:
470/470 Tests in 45 Dateien. Paket A: 19/19, Paket B: 47/47 gezielte Tests.
Unabhängiges Nutzer-/Creator-Feedback und einmaliger enger Runtime-/Retry-Check
für `aa13892` PASS, keine notwendigen Nachbesserungen. Produktionsbuild
(1516 Module), UTF-8 der 22 Änderungsdateien und Diffprüfung bestanden.
Der veröffentlichte Runtime-Stand ist identisch zum geprüften Commit.

Auftrag: Die ersten acht Zeilen aus Abschnitt 15 von
`audit_user_creator_ux_seo.md` vollständig umsetzen, prüfen und deployen.
Die Nummern unten dienen nur der eindeutigen Zuordnung dieser acht Zeilen.

## Verbindlicher Umfang

- [x] COPY-01: „Menü öffnen“ beziehungsweise „Menü schließen“ folgt dem Zustand.
- [x] COPY-02: Profil-Link zeigt „Mein Profil“, E-Mail nur ergänzend/gekürzt.
- [x] COPY-03: Ladeanzeigen nennen den jeweiligen Vorgang statt allein „Laden...“.
- [x] COPY-04: Unbekannte Fehler nennen den gescheiterten Vorgang verständlich und bieten einen passenden erneuten Versuch.
- [x] COPY-05: Gesundheitsfooter verwendet den vorgegebenen Orientierungstext ohne unreferenziertes Sternchen oder „konsultiere“.
- [x] COPY-06: „Optionale Nutzungsanalyse“ und „Die App funktioniert auch, wenn du ablehnst.“; Consent-Wirkung bleibt unverändert.
- [x] COPY-07: „Quellen: DGE, EFSA und NIH“ statt der bisherigen Kurzform.
- [x] COPY-08: „Kosten pro Einnahme im Vergleich“ statt „Preis-pro-Portion Vergleich“.

## Prüfung und Veröffentlichung

- [x] Bestehende und geänderte Fundstellen je Punkt dokumentiert; weitere Copy-Register-Zeilen und Artikeltexte unverändert.
- [x] Programmierpakete unabhängig aus Nutzer-/Creator-Sicht geprüft; notwendige Rückmeldungen vom jeweiligen Autor eingearbeitet.
- [x] Gezielte Regressionstests, UTF-8 und proportionale Gesamtprüfung bestanden; bei verändertem Runtime-Verhalten zusätzlich genau ein unabhängiger Technikreview.
- [x] Commit, PR, Merge und Produktionsdeployment abgeschlossen.
- [x] Öffentliche Desktop-/Mobilansicht und relevante Zustände geprüft; Audit und Deploy-Log aktualisiert.

## Grenzen

Keine neue Pflegequelle oder freie Änderung medizinischer Artikel, Datenbank-
oder Rechtstextbestände. Globale Affiliate-Formulierung und Zustimmungseffekt
bleiben erhalten. Vorhandene sichere Retry-/Validierungswege werden genutzt;
kein pauschales Wiederholen schreibender Aktionen.

## Fundstellen und Nachweise

| Punkt | Autoritative Oberfläche | Nachweis |
|---|---|---|
| 01–02 | Gemeinsames `Layout`: mobile Navigation und Profil-Link | Vorhandene Layout-Tests; mobile Menüprüfung live, Profilzustand im Komponententest. |
| 03 | Routen-Ladeanzeige, eigene Produkte und verbleibende allgemeine Admin-Ladeanzeigen | Vollständiger UI-Textabgleich; gezielte Tests auf kontextbezogene Statusanzeigen. Bereits konkrete Artikel-/Creator-/Stack-Ladeanzeigen bleiben bestehen. |
| 04 | Eigenes Produktformular und Wechselwirkungsverwaltung | Fehlerfälle und erneute manuelle Versuche in gezielten Tests; kein automatisches Wiederholen von Schreibvorgängen. |
| 05 | Gemeinsamer Gesundheitsfooter | Exakter Zieltext im bestehenden dezenten Aufklappbereich; Affiliate-Textvergleich und öffentliche Ansicht. |
| 06 | Cookie-Auswahl und Profil | Einheitlicher Name/Folgesatz; Zustimmung, Ablehnung und erneutes Öffnen in Tests, öffentliche Auswahl live. |
| 07–08 | Startseiten-Einstieg und Funktionsbeschreibung | Zieltexte in Tests und produktiver Desktop-/Mobilansicht. |

Öffentliche UI-Zustände wurden live geprüft. Angemeldete Profil-/Admin- und
künstlich ausgelöste Fehlerzustände wurden isoliert in Komponententests geprüft,
ohne dafür Produktionsdaten zu ändern oder Fehler in der Live-App zu erzwingen.

Live-Beleg: Aktueller Einstieg samt insgesamt acht ausgelieferten UI-Paketen enthält die
Zieltexte. Auf 1440 und 390 px kein horizontaler Überlauf. Die Startseite zeigt
Quellen-/Kostenbegriff jeweils im Einstieg und Funktionsbereich. Gesundheits-
details öffnen mit den drei exakten Zielsätzen; globaler Affiliate-Footer ist
unverändert. Die Cookie-Auswahl zeigt Titel und Ablehnungsfolgesatz; beide
Schaltflächen liegen mobil vollständig im sichtbaren Bereich. Nach Ablehnen
lässt sich die Demo öffnen; „Die Demo wird geladen …“ und anschließend die
funktionsfähige Stack-Ansicht samt korrekt geschlossenem Menü wurden beobachtet.

Belege: `.agent-memory/copy-register-20260906/review.json` (23 Pfadhashes),
`live-readback.json`, `live-browser-check.json` sowie das vollständige Lade-/
Fehlerinventar `.agent-memory/copy-ux-20260906/copy03-04-inventory.md`.
