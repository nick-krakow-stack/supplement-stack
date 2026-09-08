# Umsetzung: Phase A abschließen, Phase C vollständig

Stand: 8. September 2026 · Status: COMPLETE — PHASE A/C LIVE

PR #30 (`ee48e31`) ist veröffentlicht. Unabhängige User-/Creator-/Technik-
Abnahme und 571 Tests sind bestanden. Deployment `34137602863`, Versuch 2,
lief nach dem D1-Reset am 08.09.2026 um 09:00 UTC vollständig durch:
`https://337975f3.supplementstack.pages.dev`, Produktion `https://supplementstack.de`.
Alle 790 Artikel sind per GET/HEAD samt Head/Schema geprüft, dazu öffentliche,
private und fehlerhafte Routen, Robots/Sitemap/Assets sowie 16 Browserzustände
auf Desktop/390 px. Keine Inhalts-, Schema- oder Produkt-Affiliate-Änderung.

Quelle: `audit_user_creator_ux_seo.md`, Abschnitt 18, Phase A und C;
konkrete Routen-/Zustandskriterien aus Abschnitt 16 sowie Definition of Done
aus Abschnitt 19. Bereits bestandene unveränderte UX-/Artikel-Gates werden
nicht neu gestartet. Phase B/D sind kein zusätzlicher Auftrag.

## Verbindliche Checkliste

- [x] A10: Ungültige Share-, Wissens- und Catch-all-Pfade liefern echte 404/410 und noindex, inklusive GET/HEAD und hilfreicher sichtbarer Fehlerseite.
- [x] A11: Alle Sharezustände schützen Tokens mit noindex/nofollow, no-referrer und revokationssicherer Cache-Policy; keine Tokens in Canonical, OG-URL oder Sitemap.
- [x] C01: Ein zentraler Route-Head-Vertrag steuert Indexziel, Titel/Description, Canonical, Social-Metadaten, Schema und Cache für SSR und SPA.
- [x] C02: Robots enthält keine globale Crawl-Sperre mehr; Start/Wissen/Demo sind erlaubt, Utilityseiten crawlbar-noindex; keine Freigabe privater Inhalte.
- [x] C03: Start, Wissen, Demo, Legal, Auth-Grundzustände und Fehler liefern sinnvoll strukturiertes Roh-HTML. Private Routen bleiben authentifiziert/noindex/no-store, ohne persönliche Daten in öffentlicher SSR-Ausgabe.
- [x] C04: Sitemap enthält kanonische öffentliche Seiten und alle aktuell veröffentlichten Artikel; gültige Zeitstempel einheitlich ISO, keine erfundenen Daten/Utility-/Token-/Privatrouten.
- [x] C05: Wissensrenderer liefert die bestehende semantische Artikelstruktur serverseitig; nach Hydrierung genau ein gebundener JSON-LD-Graph, keine Altmetadaten nach Routenwechsel.
- [x] C06: Meta-Längen werden im Publication-Gate geprüft; OG-Bild/Twitter und konsistente Artikel-/Quellenbeziehungen ergänzen. Wissenschaftliche H1, Quellenlabel und fachliche Artikelinhalte bleiben unverändert.
- [x] C07: Slash- und /agb-Aliasse leiten permanent und sicher auf kanonische Ziele weiter; Tokenparameter gelangen nicht in öffentliche Metadaten.
- [x] Bestehende neun Phase-A-Punkte auf unveränderte Gültigkeit anhand der vorhandenen Umsetzung/Gates abgleichen.
- [x] Unabhängiges User-/Creator-Feedback und einmaliger technischer Gesamtcheck; nötiges Feedback an Autoren, nur veränderte Teile nachprüfen.
- [x] Proportionale Tests, UTF-8, Build und Commit/PR/Merge bestanden.
- [x] Deployment bestanden — Versuch 2 nach D1-Reset, keine Migrationen ausstehend.
- [x] Öffentlicher HTTP-/DOM-/Head-/Robots-/Sitemap-Readback über den vollständigen betroffenen Routenbestand; Desktop/Mobil und Hydrierungs-/Navigationsfälle geprüft.
- [x] Audit, Checkliste und knapper Deploy-Log abgeschlossen.

## Zuständigkeiten und Grenzen

- Root: zentraler Route-Head-/Crawl-/Sitemap-Vertrag, frontendweite Metadaten,
  Integration, Nachweise und Veröffentlichung.
- Implementierer A: öffentliche Seiten-/Share-/Auth-Auslieferung, SSR-Shells,
  passende Status-/Cache-/Referrergrenzen und öffentliche Roh-HTML-Inhalte.
- Implementierer B: Wissensartikel-Head/Schema/semantisches SSR, Hydrierung,
  Artikel-Cache sowie Publication-Metadatengate.
- Unabhängiger Reviewer: konkrete Risiken und Nutzer-/Creator-Kriterien;
  kein Implementierungscode, kein doppelter unveränderter PASS.

Die zentrale Datenbank bleibt die einzige Inhaltsquelle. Keine freien
Artikel-/Rechtsdatenkorrekturen, keine erfundenen Autoren, Prüf-/Publikationsdaten,
Quellen, Studienmengen oder Grafiken. Der bestehende globale Affiliate-Hinweis
bleibt; keine produktbezogenen Hinweise. Statische SSR-Grundzustände dürfen
keine Registrierung, Einwilligung, E-Mail-Verifikation oder Datenwrites auslösen.
Sharevorschauen verwenden ausschließlich freigegebene öffentliche Snapshots.

Belegordner: `.agent-memory/phase-a-c-20260907/`.

Abschlussbelege: `release-status.json`, `review.json`,
`live-delivery-readback.json`, `live-delivery-readback-delta.json` und
`live-browser-check.json`. Der Vollbeleg bewahrt 816 bestandene Fälle und
drei ursprüngliche, zu pauschale Linkanzahl-Fehler unverändert. Die drei
routenspezifischen Deltafälle bestätigen den vollständigen Vertrag mit
Kontaktlink beziehungsweise Rücklink plus Suchformular. Zusammen 819 PASS;
kein zweiter Vollcrawl und keine daraus abgeleitete Produktänderung.

## Bestandsmetadaten: technische Grenze und offene Redaktion

Der vorhandene Publication-Compiler prüft separate technische Titel auf 15–70
und Descriptions auf 40–180 Zeichen; die Quellen-H1 bleibt unangetastet.
Diese Vertragsgrenzen werden belegt und in CI abgesichert, nicht still durch
die Audit-Messschwellen 60/160 ersetzt.

Das aktuelle read-only Inventar umfasst 790 Artikel (44 Hauptartikel, 746
Quellenartikel): 97 mit gespeicherter SEO-Projektion, 693 Legacy-Fallbacks.
246 Titel überschreiten 70 und 370 Descriptions 180 Zeichen. Das technische
Gate ist **keine** Freigabe dieser historischen Kurzmetadaten. Deren Neufassung
bleibt eine separate, kanonisch gebundene Contentkorrektur; keine freien
Massenänderungen, H1-Kürzungen oder ungeprüft entfernten Einschränkungen.
