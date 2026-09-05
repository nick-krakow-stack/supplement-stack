# Umsetzung: Wissensartikel aus Audit Abschnitt 13

Stand: 5. September 2026 · Status: in Arbeit

Auftrag: ARTICLE-01 bis ARTICLE-10 aus `audit_user_creator_ux_seo.md`
einschließlich der konkreten Schreibweisen- und Textkorrekturen in Abschnitt 13
vollständig bis zum geprüften Produktionsrelease umsetzen.

`[ ]` offen · `[~]` in Arbeit · `[x]` geprüft · `[!]` blockiert

## Funktionen

- [x] ARTICLE-01: Verständlicher Rückweg zur Wissensübersicht mit erhaltenem
  Filter-/Suchkontext.
- [x] ARTICLE-02: Teilen und Speichern, nachvollziehbare redaktionelle
  Verantwortung und belegter Aktualisierungsgrund im Artikelkopf.
- [x] ARTICLE-03: Kompakte mobile Inhaltsübersicht, zugängliche Navigation und
  Aktion zum Seitenanfang.
- [x] ARTICLE-04: Kernaussagen mit zugänglicher Quellen-/Grenzeneinordnung;
  fachliche Aussagen und bestehende Belegbeziehungen erhalten.
- [x] ARTICLE-05: Einzelne FAQ-Fragen direkt verlinken, öffnen und fokussieren.
- [x] ARTICLE-06: Quellenumfang verständlich erklären und echte doppelte
  Quellenlinks vermeiden.
- [x] ARTICLE-07: Von Studien zu zugehörigen Hauptartikeln und verwandten
  Studien navigieren; Beziehungen aus dem zentralen Bestand.
- [x] ARTICLE-08: Fehlende Artikel mit echtem HTTP-Fehlerstatus,
  verständlicher Überschrift, Suche und weiterführenden Artikeln behandeln.
- [x] ARTICLE-09: Verwandte Inhalte, saubere Teilen-/Kopieren-Funktionen und
  Rückkehr zum Stack-Kontext.
- [x] ARTICLE-10: Semantisches serverseitiges Artikel-HTML mit Überschriften,
  Listen, Tabellen und sicheren Links.

## Konkret benannte Artikelkorrekturen

- [ ] Chrom: beschädigte Umlaute im vollständigen Zielartikel wiederherstellen.
- [ ] Jod / frühe Schwangerschaft und Intelligenz 2026: `persönliche`.
- [ ] Jod / WHO-Monitoring: beschädigte Umlaute wiederherstellen.
- [ ] Kupfer / Zink-Prothesenhaftcreme (Jamal): Umlaute wiederherstellen.
- [ ] Mangan / parenterale Ernährung (Abdalian): Umlaute wiederherstellen.
- [ ] Saccharomyces boulardii / Chen 2024: Umlaute wiederherstellen.
- [ ] Vitamin D / BfR-Höchstmengen: fachlich kontrollierte lokale
  Verständlichkeitskorrekturen umsetzen.

Artikelkorrekturen werden vor Bearbeitung nach S/M/L klassifiziert und mit
dem zugehörigen Prüf-/Publikationsweg ausgeführt. Bestehende Fakten, Zahlen,
Quellen und Grenzen bleiben gebunden. Die pauschalen Text-UX-Wertungen aller
790 Artikel sind kein Auftrag für eine unkontrollierte Neufassung.

## Abnahme und Veröffentlichung

- [x] Programmieraufgaben mit getrennten Dateibereichen umgesetzt.
- [x] Nutzer-/Creator-Feedback zu fertigen Aufgaben eingeholt und konkrete
  notwendige Änderungen direkt an den jeweiligen Programmierer zurückgegeben.
- [ ] Risikoproportionale Tests, UTF-8-Prüfung und unabhängiger technischer
  Review bestanden; Artikelkorrekturen separat im vorgeschriebenen Verfahren.

  Code und M-Übernahme: technischer PASS für 39 Releasepfade; 7/7 neue
  Guard-/Rollback-/Idempotenztests, 4/4 SSR-/Relationsfälle, 1/1 Admin-
  Grenzwert/Erhalt, 33/33 Markdown und 12/12 neue Artikel-UX-/Journeyfälle.
  Build, Lint, Functions-Typecheck und UTF-8 bestanden. Bekannte lokale
  Node-24-Importprobleme der übrigen Vollsuite werden in Node-22-CI abgegrenzt.
- [ ] Auditstatus aktualisiert; Commit, PR, Merge und Deployment erfolgreich.
- [ ] Produktionsreadback für Artikeltypen, Fehlerstatus, Navigation,
  Desktop/Mobil, semantisches HTML und korrigierte Zielartikel bestanden.
- [ ] Ein knapper Deploy-Log-Eintrag und aktuelle Live-Checkliste.

## Verbindliche Grenzen

Implementierung lokal geprüft; Veröffentlichungsabnahme separat noch offen.
Die sechs Schreibkorrekturen sind unabhängig als M geprüft (6 Artikel,
8 Felder, 27 Zeichenreparaturen). BfR bleibt Klasse L und durchläuft einen
neuen, auf diesen Artikel begrenzten normalen v2-Slice. Fehlende historische
Pipeline-Belege werden nicht nachträglich erfunden.


Zentrale Daten bleiben die einzige Pflegequelle. Fehlende Autorennamen,
Prüfungen, Aktualisierungsgründe oder fachliche Belege werden nicht erfunden.
Produktbezogene Affiliate-Kennzeichnungen bleiben ausgeschlossen; der globale
Footer bleibt bestehen. Neue Artikelaufrufe starten am Seitenanfang,
gezielte Abschnittslinks behalten ihr Sprungziel.
