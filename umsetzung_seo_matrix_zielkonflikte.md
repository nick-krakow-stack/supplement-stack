# Umsetzung: SEO-Seitenmatrix und UX-/SEO-Zielkonflikte

Stand: 8. September 2026 · Status: IN ARBEIT

Auftrag: `audit_user_creator_ux_seo.md`, Abschnitte 16 und 17 vollständig mit
dem aktuellen Stand abgleichen und sämtliche noch fehlenden Anforderungen
umsetzen. Der Abschluss von Phase A/C ist ein Wiederverwendungsbeleg, keine
pauschale Freigabe dieser weitergehenden Anforderungen.

## Ablauf und Fortschritt

- [x] Auftrag, AGENTS, aktuelle Runtimebasis `53d56d9` und vorherigen Release lesen.
- [x] Jede Matrixzeile und jeden Zielkonflikt mit konkreten Code-/Test-/Live-Belegen einordnen.
- [x] Aktuellen öffentlichen Artikelbestand und technische Metadaten read-only einfrieren; alte Bestandsdaten nicht als aktuelle Schreibgrundlage verwenden.
- [ ] Fehlende technische Funktionen in disjunkten Aufgaben implementieren.
- [ ] Separate kurze Suchtexte sachlich gleichwertig und zentral gebunden fertigstellen; Original-H1, sichtbare Artikeltexte und Quellen erhalten.
- [ ] Geänderte Funktionen einmal unabhängig aus User-/Creator- und technischer Sicht prüfen; notwendiges Feedback an die Autoren, nur Delta nachprüfen.
- [ ] Proportionale Tests, UTF-8 und relevante Publikations-/Write-Guards bestehen.
- [ ] Veröffentlichen und vollständigen betroffenen Bestand gezielt live zurücklesen.
- [ ] Audit, Einzelbelege, Checkliste und genau einen Deploy-Log je Produktionsänderung abschließen.

## 16. Matrix: verbindliche Abnahme

| ID | Erledigt | Route / Bestand | Vollständiger Nachweis |
|---|---|---|---|
| SEO-01 | [ ] | `/` | Öffentliches SSR, eigener vollständiger Head/Schema, Crawl/Sitemap. |
| SEO-02 | [ ] | `/wissen` | Zentrale Kategorien/Hauptartikel im SSR, Collection/ItemList/Breadcrumb, kanonische Filter. |
| SEO-03 | [ ] | `/demo` | Stabiles öffentliches SSR mit eigenem Head und interaktiver Hydrierung. |
| SEO-04 | [ ] | 44 Hauptartikel | Separate knappe Suchtexte, semantisches SSR, Social/Schema, Zeitstempel/Cache/Redirect. |
| SEO-05 | [ ] | 746 Quellenartikel | Wie SEO-04; Original-H1 unverändert, belegte Hauptartikel-/Quellenbeziehungen und Navigation. |
| SEO-06 | [ ] | Artikel-Slash-Alias | Permanente kanonische Weiterleitung. |
| SEO-07 | [ ] | Unbekannter Artikel | Echter Fehlerstatus/noindex, eigener Head/H1 und nutzbarer Rückweg. |
| SEO-08 | [ ] | `/stacks` | Edge-Auth, privater Head/H1/no-store, keine öffentliche Datenprojektion. |
| SEO-09 | [ ] | `/einnahmeplan` | Private Route; getrennte indexierbare Erklärseite ohne Nutzerdaten. |
| SEO-10 | [ ] | `/my-products` | Auth/noindex/no-store, eigene sichere Seitendarstellung. |
| SEO-11 | [ ] | `/profile` | Auth/noindex/no-store und keine personenbezogenen öffentlichen Metadaten. |
| SEO-12 | [ ] | `/creator` | Privates Dashboard; öffentliche Sichtbarkeit ausschließlich getrennt und freiwillig. |
| SEO-13 | [ ] | Gültiger Share | Freigegebener Snapshot, datensparsame dynamische Vorschau, noindex/no-referrer/revokationssicher. |
| SEO-14 | [ ] | Ungültiger/abgelaufener Share | Echter 404/410 mit sicherem Head und hilfreichen Rückwegen. |
| SEO-15 | [ ] | `/login` | Crawlbar noindex, eigener Head/H1, keine Rückwegparameter in Metadaten. |
| SEO-16 | [ ] | `/register` | Eigene serverseitige Formularsemantik/Head, noindex/no-store. |
| SEO-17 | [ ] | `/forgot-password` | Eigener Head und sichere SSR-Formularhülle. |
| SEO-18 | [ ] | `/reset-password` | Token-/Statusgrenzen und read-only SSR, keine Tokenweitergabe. |
| SEO-19 | [ ] | `/verify-email` | Erfolg/Fehler/Token sicher; SSR konsumiert nichts. |
| SEO-20 | [ ] | `/impressum` | Kanonischer Rechtstext im SSR, eigener Head, noindex/follow. |
| SEO-21 | [ ] | `/datenschutz` | Wie SEO-20. |
| SEO-22 | [ ] | `/nutzungsbedingungen` | Wie SEO-20, kanonisches Ziel. |
| SEO-23 | [ ] | `/agb` | Permanente Weiterleitung zum kanonischen Ziel. |
| SEO-24 | [ ] | Catch-all | Echter 404/noindex, eigener Head/H1 und Orientierung. |

Die Bestandszahlen werden beim aktuellen Read-only-Abgleich bestätigt.
Technische Längengrenzen bleiben gemäß vorhandenem Vertrag 15–70 Zeichen
für Titel und 40–180 für Descriptions; 60/160 sind Audit-Messschwellen,
keine universellen Suchmaschinenlimits. Kürze allein ist kein Qualitätsbeweis.

## 17. Gemeinsame UX-/SEO-Lösungen

| ID | Erledigt | Anforderung |
|---|---|---|
| UXSEO-01 | [ ] | Öffentliche Erklärung und private authentifizierte App getrennt halten. |
| UXSEO-02 | [ ] | Attraktive, datensparsame Sharevorschau ohne Tokenindexierung oder alte widerrufene Snapshots. |
| UXSEO-03 | [ ] | Freiwillige kuratierte öffentliche Creator-Seite getrennt vom Capability-Link. Kein automatisches Veröffentlichen vorhandener Konten oder privater Daten. |
| UXSEO-04 | [ ] | Wissenschaftlichen Originaltitel/Quellenlabel unverändert lassen, separate sachlich gleichwertige Suchtexte. |
| UXSEO-05 | [ ] | Nutzbare Wissensfilter ohne separate indexierbare Parameterseiten. |
| UXSEO-06 | [ ] | Belegte Produkt-/Nutzungsdaten, Wirkstoffwissen zentral; keine ungeprüften kommerziellen Wirkungsclaims. |
| UXSEO-07 | [ ] | Stabiler öffentlicher SSR-Hero, private Accountzustände erst nach Hydrierung. |
| UXSEO-08 | [ ] | Verständliche Fehleroberfläche mit korrektem HTTP-Status. |
| UXSEO-09 | [ ] | Ausschließlich globaler Affiliate-Footer, keine produktbezogenen Badges oder Ersatztexte. |

## Zuständigkeiten und feste Grenzen

- Root: aktueller Gesamtplan, verbindlicher Korrektur-/Releaseweg, Integration und Veröffentlichung.
- Agent A: Nicht-Artikel-Routen, Share-/Creator-Funktionen und deren konkrete Lücken.
- Agent B: Artikelmetadaten, Bestands-/Lineage-Reuse und bestehende Korrekturpfade.
- Unabhängiger Reviewer: neue P1-Risiken und spätere geänderte Runtime-/Write-Guards; kein erneutes unverändertes Phase-A/C-Gate.

Artikelmetadaten werden vor Zuweisung als Klasse L behandelt. Kein freier
D1-Massenpatch und keine Umdeklaration zu S/M. Es gibt derzeit keinen
belegten bestehenden Meta-only-Publishpfad: Der normale Compiler leitet die
Description aus dem sichtbaren Dek ab. Ein technischer Gap oder notwendige
Ownerentscheidung wird ausdrücklich dokumentiert, nicht durch eine zweite
Inhaltsquelle oder ein erfundenes Gate umgangen. Reuse benötigt echte
hashgebundene Originalartefakte. Unveränderte bestandene Tests/Reviews werden
nicht ohne nachgewiesenen Bedarf neu gestartet.

Belege: `.agent-memory/seo-matrix-20260908/`.

## Aktueller Umsetzungsstand

- Vollständige Bestandszuordnung: `routes-gap-inventory.json`; frühere öffentliche
  Auslieferungsnachweise werden wiederverwendet. Die offenen neuen Pakete sind
  Share-Head-Konsistenz, freiwillige öffentliche Creatorprofile und Artikelmetas.
- Aktueller Artikel-Snapshot mit 790 vollständigen Artikeln, Quellen und Relationen:
  `published-article-prestate.v1.json`; Hash
  `38e72008432c2911630142332ccfa4a5e41916d370813cbfdbe15aa43767909d`.
  25.708 Datenbankzeilen gelesen, keine geschrieben. 443 Prüfkandidaten bestätigt.
- Für eine reine SEO-Korrektur wurde eine ausdrückliche Owner-Entscheidung
  angefordert. Solange diese fehlt, bleiben Artikel und Publikationsvertrag
  unverändert. Ein breiter Gesamtauftrag ersetzt diese konkrete Grenze nicht.
- Das freiwillige Creatorprofil verwendet vorhandenen Namen, Slug und Avatar;
  nur der kurze Vorstellungstext ist ein neues Pflegefeld. Einreichung und
  Veröffentlichung sind explizit, die Freigabe bindet aktuelle Identität und
  Revision. Ausblenden beendet auch ausstehende Veröffentlichung. Keine
  privaten Stacks, Kontodaten oder Sharetokens werden veröffentlicht.
- Bewusst kleiner Revisionsflow, aus Creator-Sicht bestätigt: erneutes
  Einreichen blendet die bisherige Seite bis zur Freigabe aus. Dieser Effekt
  wird vor dem Absenden genannt. Eine parallel weiter sichtbare Altversion
  ist P2-Komfort und benötigt kein zweites Pflegemodell in diesem Auftrag.
