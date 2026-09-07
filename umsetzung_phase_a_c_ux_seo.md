# Umsetzung: Phase A abschließen, Phase C vollständig

Stand: 7. September 2026 · Status: CODE FERTIG — VERÖFFENTLICHUNG BLOCKIERT

PR #30 ist als `ee48e31` zusammengeführt. Unabhängige User-/Creator-/Technik-
Abnahme und 571 Tests sind bestanden. Deployment `34137602863` stoppte vor
Pages am ausgeschöpften Cloudflare-D1-Leselimit (Fehler 7500). Deshalb bleiben
die End-to-End-Fertigboxen bis Deployment und Live-Abnahme offen; die neue
Version ist **noch nicht live**. Reset: 8. September, 02:00 Uhr Berlin.

Quelle: `audit_user_creator_ux_seo.md`, Abschnitt 18, Phase A und C;
konkrete Routen-/Zustandskriterien aus Abschnitt 16 sowie Definition of Done
aus Abschnitt 19. Bereits bestandene unveränderte UX-/Artikel-Gates werden
nicht neu gestartet. Phase B/D sind kein zusätzlicher Auftrag.

## Verbindliche Checkliste

- [ ] A10: Ungültige Share-, Wissens- und Catch-all-Pfade liefern echte 404/410 und noindex, inklusive GET/HEAD und hilfreicher sichtbarer Fehlerseite.
- [ ] A11: Alle Sharezustände schützen Tokens mit noindex/nofollow, no-referrer und revokationssicherer Cache-Policy; keine Tokens in Canonical, OG-URL oder Sitemap.
- [ ] C01: Ein zentraler Route-Head-Vertrag steuert Indexziel, Titel/Description, Canonical, Social-Metadaten, Schema und Cache für SSR und SPA.
- [ ] C02: Robots enthält keine globale Crawl-Sperre mehr; Start/Wissen/Demo sind erlaubt, Utilityseiten crawlbar-noindex; keine Freigabe privater Inhalte.
- [ ] C03: Start, Wissen, Demo, Legal, Auth-Grundzustände und Fehler liefern sinnvoll strukturiertes Roh-HTML. Private Routen bleiben authentifiziert/noindex/no-store, ohne persönliche Daten in öffentlicher SSR-Ausgabe.
- [ ] C04: Sitemap enthält kanonische öffentliche Seiten und alle aktuell veröffentlichten Artikel; gültige Zeitstempel einheitlich ISO, keine erfundenen Daten/Utility-/Token-/Privatrouten.
- [ ] C05: Wissensrenderer liefert die bestehende semantische Artikelstruktur serverseitig; nach Hydrierung genau ein gebundener JSON-LD-Graph, keine Altmetadaten nach Routenwechsel.
- [ ] C06: Meta-Längen werden im Publication-Gate geprüft; OG-Bild/Twitter und konsistente Artikel-/Quellenbeziehungen ergänzen. Wissenschaftliche H1, Quellenlabel und fachliche Artikelinhalte bleiben unverändert.
- [ ] C07: Slash- und /agb-Aliasse leiten permanent und sicher auf kanonische Ziele weiter; Tokenparameter gelangen nicht in öffentliche Metadaten.
- [x] Bestehende neun Phase-A-Punkte auf unveränderte Gültigkeit anhand der vorhandenen Umsetzung/Gates abgleichen.
- [x] Unabhängiges User-/Creator-Feedback und einmaliger technischer Gesamtcheck; nötiges Feedback an Autoren, nur veränderte Teile nachprüfen.
- [x] Proportionale Tests, UTF-8, Build und Commit/PR/Merge bestanden.
- [ ] Deployment bestanden — wartet auf D1-Kapazität.
- [ ] Öffentlicher HTTP-/DOM-/Head-/Robots-/Sitemap-Readback über den vollständigen betroffenen Routenbestand; Desktop/Mobil und Hydrierungs-/Navigationsfälle geprüft.
- [ ] Audit, Checkliste und knapper Deploy-Log abgeschlossen.

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
