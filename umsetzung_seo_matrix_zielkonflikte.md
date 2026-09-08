# Umsetzung: SEO-Seitenmatrix und UX-/SEO-Zielkonflikte

Stand: 8. September 2026 · Status: TECHNISCH LIVE — ARTIKELMETAS WARTEN AUF OWNER-ENTSCHEIDUNG

Auftrag: `audit_user_creator_ux_seo.md`, Abschnitte 16 und 17 vollständig mit
dem aktuellen Stand abgleichen und sämtliche noch fehlenden Anforderungen
umsetzen. Der Abschluss von Phase A/C ist ein Wiederverwendungsbeleg, keine
pauschale Freigabe dieser weitergehenden Anforderungen.

## Ablauf und Fortschritt

- [x] Auftrag, AGENTS, aktuelle Runtimebasis `53d56d9` und vorherigen Release lesen.
- [x] Jede Matrixzeile und jeden Zielkonflikt mit konkreten Code-/Test-/Live-Belegen einordnen.
- [x] Aktuellen öffentlichen Artikelbestand und technische Metadaten read-only einfrieren; alte Bestandsdaten nicht als aktuelle Schreibgrundlage verwenden.
- [x] Technisches Share-/Creator-Paket in disjunkten Aufgaben implementieren; Artikel-Korrekturweg separat offen.
- [ ] Separate kurze Suchtexte sachlich gleichwertig und zentral gebunden fertigstellen; Original-H1, sichtbare Artikeltexte und Quellen erhalten.
- [x] Technisches Share-/Creator-Paket einmal unabhängig aus User-/Creator- und technischer Sicht prüfen; notwendiges Feedback an die Autoren, nur Delta nachprüfen.
- [x] Proportionale Tests, UTF-8 und Write-Guards für das technische Paket bestehen.
- [x] Technisches Paket veröffentlichen und den betroffenen Lieferumfang gezielt live zurücklesen; keine echten Profile zu Testzwecken aktivieren.
- [ ] Audit, Einzelbelege, Checkliste und genau einen Deploy-Log je Produktionsänderung abschließen.

## 16. Matrix: verbindliche Abnahme

| ID | Erledigt | Route / Bestand | Vollständiger Nachweis |
|---|---|---|---|
| SEO-01 | [x] | `/` | Öffentliches SSR, eigener vollständiger Head/Schema, Crawl/Sitemap. |
| SEO-02 | [x] | `/wissen` | Zentrale Kategorien/Hauptartikel im SSR, Collection/ItemList/Breadcrumb, kanonische Filter. |
| SEO-03 | [x] | `/demo` | Stabiles öffentliches SSR mit eigenem Head und interaktiver Hydrierung. |
| SEO-04 | [ ] | 44 Hauptartikel | Separate knappe Suchtexte, semantisches SSR, Social/Schema, Zeitstempel/Cache/Redirect. |
| SEO-05 | [ ] | 746 Quellenartikel | Wie SEO-04; Original-H1 unverändert, belegte Hauptartikel-/Quellenbeziehungen und Navigation. |
| SEO-06 | [x] | Artikel-Slash-Alias | Permanente kanonische Weiterleitung. |
| SEO-07 | [x] | Unbekannter Artikel | Echter Fehlerstatus/noindex, eigener Head/H1 und nutzbarer Rückweg. |
| SEO-08 | [x] | `/stacks` | Edge-Auth, privater Head/H1/no-store, keine öffentliche Datenprojektion. |
| SEO-09 | [x] | `/einnahmeplan` | Private Route; getrennte indexierbare Erklärseite ohne Nutzerdaten. |
| SEO-10 | [x] | `/my-products` | Auth/noindex/no-store, eigene sichere Seitendarstellung. |
| SEO-11 | [x] | `/profile` | Auth/noindex/no-store und keine personenbezogenen öffentlichen Metadaten. |
| SEO-12 | [x] | `/creator` | Privates Dashboard; öffentliche Sichtbarkeit ausschließlich getrennt und freiwillig. |
| SEO-13 | [x] | Gültiger Share | Freigegebener Snapshot, datensparsame dynamische Vorschau, noindex/no-referrer/revokationssicher. |
| SEO-14 | [x] | Ungültiger/abgelaufener Share | Echter 404/410 mit sicherem Head und hilfreichen Rückwegen. |
| SEO-15 | [x] | `/login` | Crawlbar noindex, eigener Head/H1, keine Rückwegparameter in Metadaten. |
| SEO-16 | [x] | `/register` | Eigene serverseitige Formularsemantik/Head, noindex/no-store. |
| SEO-17 | [x] | `/forgot-password` | Eigener Head und sichere SSR-Formularhülle. |
| SEO-18 | [x] | `/reset-password` | Token-/Statusgrenzen und read-only SSR, keine Tokenweitergabe. |
| SEO-19 | [x] | `/verify-email` | Erfolg/Fehler/Token sicher; SSR konsumiert nichts. |
| SEO-20 | [x] | `/impressum` | Kanonischer Rechtstext im SSR, eigener Head, noindex/follow. |
| SEO-21 | [x] | `/datenschutz` | Wie SEO-20. |
| SEO-22 | [x] | `/nutzungsbedingungen` | Wie SEO-20, kanonisches Ziel. |
| SEO-23 | [x] | `/agb` | Permanente Weiterleitung zum kanonischen Ziel. |
| SEO-24 | [x] | Catch-all | Echter 404/noindex, eigener Head/H1 und Orientierung. |

Die Bestandszahlen werden beim aktuellen Read-only-Abgleich bestätigt.
Technische Längengrenzen bleiben gemäß vorhandenem Vertrag 15–70 Zeichen
für Titel und 40–180 für Descriptions; 60/160 sind Audit-Messschwellen,
keine universellen Suchmaschinenlimits. Kürze allein ist kein Qualitätsbeweis.

## 17. Gemeinsame UX-/SEO-Lösungen

| ID | Erledigt | Anforderung |
|---|---|---|
| UXSEO-01 | [x] | Öffentliche Erklärung und private authentifizierte App getrennt halten. |
| UXSEO-02 | [x] | Attraktive, datensparsame Sharevorschau ohne Tokenindexierung oder alte widerrufene Snapshots. |
| UXSEO-03 | [x] | Freiwillige kuratierte öffentliche Creator-Seite getrennt vom Capability-Link. Kein automatisches Veröffentlichen vorhandener Konten oder privater Daten. |
| UXSEO-04 | [ ] | Wissenschaftlichen Originaltitel/Quellenlabel unverändert lassen, separate sachlich gleichwertige Suchtexte. |
| UXSEO-05 | [x] | Nutzbare Wissensfilter ohne separate indexierbare Parameterseiten. |
| UXSEO-06 | [x] | Belegte Produkt-/Nutzungsdaten, Wirkstoffwissen zentral; keine ungeprüften kommerziellen Wirkungsclaims. |
| UXSEO-07 | [x] | Stabiler öffentlicher SSR-Hero, private Accountzustände erst nach Hydrierung. |
| UXSEO-08 | [x] | Verständliche Fehleroberfläche mit korrektem HTTP-Status. |
| UXSEO-09 | [x] | Ausschließlich globaler Affiliate-Footer, keine produktbezogenen Badges oder Ersatztexte. |

## Zuständigkeiten und feste Grenzen

- Root: aktueller Gesamtplan, verbindlicher Korrektur-/Releaseweg, Integration und Veröffentlichung.
- Agent A: Nicht-Artikel-Routen, Share-/Creator-Funktionen und deren konkrete Lücken.
- Agent B: Artikelinventar/Reuse, danach Owner-/Admin-Profiloberfläche und fokussierte Tests.
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

## Veröffentlichung und verbleibender Auftrag

Das technische Paket ist über PR #31, Merge `b0d3dcc`, veröffentlicht.
Deployment `34217336082` ist erfolgreich; URL
`https://a62c98ff.supplementstack.pages.dev`, produktiv auf
`https://supplementstack.de`, Browserpaket `index-4uWI6Ujn.js`.
Migration 0112 ist angewendet, ohne bestehende Profile zu veröffentlichen.

- 649/649 Tests, PR-/Main-CI und Veröffentlichung bestanden. Ein veralteter
  Routingtest wurde in `d46f398` an die ausdrücklich neue Profilroute angepasst;
  unbekannte/nicht öffentliche Profile liefern weiterhin 404. Keine
  Runtimekorrektur oder Abschwächung von Guards dafür.
- Unabhängige Belege: `share-head-review.json` und `creator-profile-review.json`.
- Live: 11 gezielte HTTP-/Head-/Zugriffs-/Sitemapfälle bestanden. Sitemap
  weiterhin 794 URLs, davon 790 Artikel und 0 öffentliche Creatorprofile.
- Browser: vier Zustände auf 1440-/390px; eigene Titel, keine doppelten
  Überschriften/Metadaten, kein horizontaler Überlauf, Demo-Rückweg funktioniert.
  Positive Freigabe-/Widerrufsfälle wurden isoliert mit echter SQLite/Hono-
  Integration geprüft, nicht durch Einwilligungen echter Produktionskonten.

Damit sind 22/24 Matrixzeilen und 8/9 Zielkonflikte vollständig belegt.
Offen bleiben **SEO-04, SEO-05 und UXSEO-04** für die 443 Metadatenkandidaten.
Der gesamte Goal ist ausdrücklich noch nicht abgeschlossen. Der engere
SEO-only-Korrekturvertrag ist noch nicht vom Owner bestätigt und wurde weder
implementiert noch durch freie Datenbankwrites umgangen.

### Nicht blockierende Folgepunkte (P2)

- [ ] Bei nachträglich geänderter Identität auch die Admin-Ablehnung deaktivieren,
  da der strikte Serverguard sie bereits mit 409 blockiert.
- [ ] Nach Wechsel des ursprünglichen zustimmenden Owners den privaten
  Status direkt aus tatsächlicher öffentlicher Berechtigung ableiten;
  öffentliche Ausgabe und Sitemap sind bereits sicher auf 404/ausgeblendet.
