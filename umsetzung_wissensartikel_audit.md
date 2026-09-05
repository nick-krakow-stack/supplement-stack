# Umsetzung: Wissensartikel aus Audit Abschnitt 13

Stand: 5. September 2026 · Status: abgeschlossen und veröffentlicht

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

- [x] Chrom: beschädigte Umlaute im vollständigen Zielartikel wiederherstellen.
- [x] Jod / frühe Schwangerschaft und Intelligenz 2026: `persönliche`.
- [x] Jod / WHO-Monitoring: beschädigte Umlaute wiederherstellen.
- [x] Kupfer / Zink-Prothesenhaftcreme (Jamal): Umlaute wiederherstellen.
- [x] Mangan / parenterale Ernährung (Abdalian): Umlaute wiederherstellen.
- [x] Saccharomyces boulardii / Chen 2024: Umlaute wiederherstellen.
- [x] Vitamin D / BfR-Höchstmengen: fachlich kontrollierte lokale
  Verständlichkeitskorrekturen umsetzen.

Artikelkorrekturen werden vor Bearbeitung nach S/M/L klassifiziert und mit
dem zugehörigen Prüf-/Publikationsweg ausgeführt. Bestehende Fakten, Zahlen,
Quellen und Grenzen bleiben gebunden. Die pauschalen Text-UX-Wertungen aller
790 Artikel sind kein Auftrag für eine unkontrollierte Neufassung.

## Abnahme und Veröffentlichung

- [x] Programmieraufgaben mit getrennten Dateibereichen umgesetzt.
- [x] Nutzer-/Creator-Feedback zu fertigen Aufgaben eingeholt und konkrete
  notwendige Änderungen direkt an den jeweiligen Programmierer zurückgegeben.
- [x] Risikoproportionale Tests, UTF-8-Prüfung und unabhängiger technischer
  Review bestanden; Artikelkorrekturen separat im vorgeschriebenen Verfahren.

  Code und M-Übernahme: technischer PASS für 39 Releasepfade; 7/7 neue
  Guard-/Rollback-/Idempotenztests, 4/4 SSR-/Relationsfälle, 1/1 Admin-
  Grenzwert/Erhalt, 33/33 Markdown und 12/12 neue Artikel-UX-/Journeyfälle.
  Build, Lint, Functions-Typecheck und UTF-8 bestanden. Die vollständige
  Node-22-PR-CI ist mit 377/377 Frontendtests grün (Run 33984404639);
  zusätzlich 34/34 gezielte L-Guard-/Publisher-Tests und 7/7 M-Guardtests.
  PR #25 ist als f796e71 zusammengeführt. Deployment 33984550402 ist erfolgreich.
- [x] Auditstatus aktualisiert; Commit, PR, Merge und Deployment erfolgreich.
- [x] Produktionsreadback für Artikeltypen, Fehlerstatus, Navigation,
  Desktop/Mobil, semantisches HTML und korrigierte Zielartikel bestanden.
- [x] Knappe Deploy-Log-Einträge je Produktionsaktion und aktuelle Live-Checkliste.

Abschlussbelege: sechs M-Artikel mit 8 Feldern und 27 Zeichenreparaturen;
vollständiger Altwert-/Versionsguard, unabhängiger Kurzreview und öffentlicher
API-/Roh-HTML-/Desktop-/Mobilabgleich `COMPLETE`. Der Abschlussretry änderte
0 Zeilen und erzeugte keine zusätzliche Version. DOM-Beleg
`3c83e749…`, Publishreceipt `6511bc68…`; alle sechs Zielartikel bei 1440 und
390 px ohne horizontalen Überlauf. BfR: normaler L-Slice mit unabhängigen
Facts-/Publication-Gates, Version 1 → 2; Child und Parent `COMPLETE`,
Publishreceipt `5f1080b6…`, `HYDRATED_DOM_MATCH`, `RAW_HTML_MATCH`,
`INDEXABLE`, Sitemap `INCLUDED`, Badge `MATCH`.

Live bestätigt: echte 404-Seite mit H1 und `noindex,nofollow`, semantisches
Roh-HTML (Chrom: 18 H2, 10 H3, 7 Listen, 9 Tabellen), acht zentrale verwandte
Vitamin-D-Inhalte, sichtbarer Änderungsgrund und Hauptartikel-Rückweg bei
Scrollposition 0. FAQ-Direktlink öffnet und fokussiert die konkrete Frage;
„Nach oben“ setzt Scrollposition 0 und H1-Fokus.

Nicht blockierender P2 für einen späteren Darstellungsdurchgang: Ein kalter
direkter Chrom-FAQ-Aufruf platzierte die korrekt geöffnete/fokussierte Frage
nahe dem unteren Bildschirmrand. Eine stabilere obere Ausrichtung wäre
angenehmer; kein weiterer Review-/Release-Zyklus nur für diese Feinheit.
Der historische Chrom-Text enthält außerdem sichtbare Grafik-Briefings;
deren inhaltliche Entfernung ist kein bedeutungsfreier M-Umlautpatch und
bleibt einem getrennten fachlichen Artikelkorrekturauftrag vorbehalten.

## Verbindliche Grenzen

Implementierung und Veröffentlichungsabnahme abgeschlossen. Die sechs
Schreibkorrekturen wurden unabhängig als M geprüft und veröffentlicht. BfR
blieb Klasse L und durchlief einen neuen, auf diesen Artikel begrenzten
normalen v2-Slice. Fehlende historische Pipeline-Belege wurden nicht
nachträglich erfunden.


Zentrale Daten bleiben die einzige Pflegequelle. Fehlende Autorennamen,
Prüfungen, Aktualisierungsgründe oder fachliche Belege werden nicht erfunden.
Produktbezogene Affiliate-Kennzeichnungen bleiben ausgeschlossen; der globale
Footer bleibt bestehen. Neue Artikelaufrufe starten am Seitenanfang,
gezielte Abschnittslinks behalten ihr Sprungziel.
