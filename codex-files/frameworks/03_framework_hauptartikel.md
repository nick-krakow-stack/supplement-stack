# Framework 03: Stage-3-Magazinartikel

- Contract-ID: `knowledge_magazine_v1`
- Framework-Version: `2.0.3`
- Zweck: einziger byte-genauer Authoring- und Rendervertrag für
  Stage-3-Hauptartikel

Magnesium und Vitamin A kalibrieren Lesbarkeit und Erklärlogik; sie sind keine
Templates. Globale Regeln stehen in
[`00_globale_regeln.md`](00_globale_regeln.md), der Qualitätsmaßstab im
[`Qualitätsvertrag`](../../docs/nutrient-content-article-quality-contract.md).

## Gebundener Input

Stage 3 erhält genau ein vollständiges, nach Framework 06 gehashtes
`nutrient_content_work_order.v2` mit:

- Stoff, Sprache, Artikelscope, `blueprint_id` und eindeutigen Zielpfaden;
- Framework-ID/-Version sowie tatsächlichem Repositorypfad und Bytehash dieser
  Datei; Stilannotation und Stil-Snapshot-Manifest ebenfalls mit tatsächlichem
  Pfad, Byte- und Inhaltshash;
- allen `required_cluster_ids` und `controversy_ids`;
- dem `common_assumption_review` mit explizitem Discovery-Status und bei
  identifizierten Annahmen den source-, cluster-, obligation- und
  recordgebundenen Prüfaufträgen;
- dem `seo_brief` mit genau `primary_intent`, `reader_question`,
  `reader_promise`, `primary_topic_phrase`, drei bis sechs
  `secondary_questions`, `cannibalization_note` und
  `internal_link_targets`;
- sichtbaren Quellen und dem artikelbezogenen `selected_link_slice` aus dem
  Facts-Paket; nur der Planner liest das vollständige `site_link_inventory.v2`;
- `graphic_decision.mode=none|generate`, Begründung sowie bei `generate`
  `cluster_ids` und `obligation_ids`; das Facts-Paket löst daraus die exakten
  bestandenen `record_ids` auf;
- einem hash- und lockgebundenen `facts_package_for_stage3.v2`.

Alle benötigten Cluster, Kontroversen und Extraktionspflichten müssen im
Facts-Gate bestanden sein. Stage-2-Prosa, Artikel als Faktenquelle,
ungeprüfte Records, freie Webrecherche, RAG-Chunks und alte Templates sind
keine Eingaben.

## Einziges byte-genaues Authoring-Skelett

```markdown
# [präziser, lesbarer Titel]

[genau ein Dek-Absatz]

<!-- knowledge-template:magazine -->

## Auf einen Blick

- [3–6 eigenständige Kernaussagen]

## [adaptive, stoffgerechte Abschnitte]

[verständlicher Fließtext; weitere adaptive H2/H3 nach Bedarf]

## Fazit

[knappe, abgewogene Schlussfolgerung]

## Quellen

<!-- sources:auto -->
```

Kein anderes Agenten-, Framework- oder Pipeline-Dokument darf dieses Skelett
kopieren. Andere Verträge referenzieren ausschließlich
`knowledge_magazine_v1@2.0.3`.

## Deterministisch prüfbare Regeln

1. Byte 1 ist `# `; es gibt genau eine H1 und davor weder Frontmatter noch
   Kommentar oder Leerraum.
2. Direkt nach der H1 folgt genau ein nichtleerer Dek-Absatz: keine Liste,
   Tabelle, H2 oder zweite Absatzgruppe.
3. Der Magazinmarker steht exakt einmal, allein und unmittelbar nach dem Dek.
   Er aktiviert Magazinlayout, linke Navigation und Quellen-/Lesedarstellung.
4. Danach folgt exakt eine H2 `Auf einen Blick` mit drei bis sechs
   eigenständigen, nicht redundanten Kernaussagen.
5. Zwischen `Auf einen Blick` und `Fazit` stehen nur adaptive, stoffgerechte H2
   und bei Bedarf H3; leere Überschriften sind verboten.
6. Die optionalen H2 `Merkkasten` und `Rechtlicher Hinweis` sind reservierte
   Controls. Nur diese Titel, nach Trim case-insensitiv exakt gleich, werden als
   `kind=control` mit `control_type=merkkasten|legal_notice` gerendert; sie sind
   unnummeriert und erscheinen nicht im TOC. Zusätze im Titel machen daraus
   normalen Inhalt. Ein verwendetes Control muss nichtleer sein.
7. `Fazit` steht exakt einmal nach dem Inhalt und enthält mindestens einen
   nichtleeren, abgewogenen Absatz.
8. `Quellen` ist die letzte H2. Darunter steht nur der Quellenmarker; manueller
   Quellenblock und weiterer sichtbarer Inhalt sind verboten.
9. Compiler und Render-Test weisen nach, dass H1, Dek, Navigation, Fazit,
   Quellenanzeige, Links und Assets in der publizierten Darstellung erhalten
   sind.

Zählbare Verstöße sind Compilerfehler. Der Publication-Reviewer prüft sie nicht
erneut durch freies Nachzählen.

## Adaptive Inhaltslogik

Der Blueprint wählt ausschließlich Abschnitte, die eine Leserfrage beantworten
und durch das Facts-Paket gedeckt sind. Je nach Stoff können Grundlagen,
Funktion, Versorgung, Referenzwerte, Studienlage, praktische Einordnung,
Sicherheit, Interaktionen, vulnerable Gruppen und Kontroversen sinnvoll sein.
Nicht relevante Bedarf-, Mangel-, UL-, FAQ-, Tabellen- oder Mechanismusblöcke
entfallen vollständig. Ein Supporting-Thema fließt in den passenden Abschnitt
ein und wird zusätzlich intern verlinkt, sofern der Link Leserwert besitzt.

Bei `common_assumption_review.status=identified` beantwortet der Artikel jeden
gebundenen Check genau einmal. Er nennt die Annahme neutral, gibt eine klare
evidenzgerechte Kurzantwort und erklärt anschließend Population, Situation,
Bedingungen, Unsicherheit oder Gegenbefunde. Die Antwort kann im passenden
Sachabschnitt oder in einem gemeinsamen stoffgerechten Annahmenabschnitt stehen;
ein fixes H2 und ein künstlicher „Mythen“-Block sind nicht vorgeschrieben. Bei
`none_identified` entsteht kein Leer- oder Füllabschnitt. Discovery-Signale
belegen nur Leserrelevanz, nicht die fachliche Antwort oder eine quantifizierte
Verbreitung. „Die meisten Menschen glauben …“ ist deshalb nur mit einem
freigegebenen Prävalenzrecord zulässig.

FAQ ist nur zulässig, wenn mindestens zwei echte Such- oder Leserfragen im
Fließtext noch nicht klar beantwortet werden. Bereits erklärte Aussagen werden
nicht als FAQ wiederholt. Tabellen erscheinen nur, wenn sie einen Vergleich
deutlich schneller verständlich machen.

Eine Tabelle wird genau dann als `food_grid` gerendert, wenn sie valides
Pipe-Table-Markdown mit mindestens drei Spalten und gleich breiten Datenzeilen
ist und nach `trim().toLowerCase()`:

- Header 1 auf
  `/(lebensmittel|nahrungs|quellen?)(gruppe|kategorie)?/` passt;
- Header 2 auf `/(beispiel|lebensmittel|vorkommen)/` passt.

Alle anderen Tabellen sind `data_table`. Als klare Standardform für eine
Lebensmittelübersicht dient etwa `Lebensmittelgruppe | Beispiele |
Einordnung`; die dritte und weitere Spalten dürfen der konkreten Leserfrage
folgen. Der Writer darf die Klassifikation nicht über HTML, Kommentare oder
unsichtbare Marker erzwingen.

## Leser- und Stilziel

- Kernaussage vor Detail, Bekanntes vor Neuem, Alltagssprache vor Fachbegriff.
- Fachbegriffe beim ersten Auftreten kurz, korrekt und anschaulich erklären.
- Kurze bis mittlere Sätze und Absätze; ein Absatz trägt einen Hauptgedanken.
- Zahlen immer mit Einheit, Population/Bezugsrahmen, Bedeutung und
  Unsicherheit verbinden.
- Mechanismus nie als nachgewiesenen klinischen Nutzen ausgeben.
- Verbreitete Annahmen früh und eindeutig beantworten; Teilgruppen,
  Anwendungssituation und Evidenzgrenzen nicht in ein pauschales Ja/Nein
  pressen.
- Wissenschaftlich präzise schreiben, aber den Gedankengang für eine
  zehnte Klasse nachvollziehbar machen.
- Magnesium und Vitamin A gleichwertig für Klarheit, Lernlogik, ruhige
  Übergänge und verständliche Sicherheitsunterscheidung nutzen; nie deren
  Gliederung oder Formulierungen kopieren.

## People-first SEO

`primary_intent` steuert die Informationsfolge. Die `reader_question` wird früh
beantwortet und die `reader_promise` vollständig erfüllt.
`primary_topic_phrase`, passende Synonyme und drei bis sechs
`secondary_questions` erscheinen natürlich, ohne Keyworddichte.
`internal_link_targets` müssen inhaltlich helfen und die
`cannibalization_note` beachten. Writer erzeugen weder technischen Title noch
Meta-Description, Schema.org, Keywordliste, SEO-Zweitfassung oder sichtbare
Suchmaschinenanweisung; Title und Meta werden erst aus dem finalen Artikel
abgeleitet. Keyword-Stuffing, erzwungene Wiederholungen und Text nur für einen
Crawler sind ein Fehler.

Der Compiler erzeugt aus dem finalen sichtbaren Artikel genau ein `seo`-Objekt
mit `meta_title`, `meta_description`, `primary_intent`,
`internal_link_targets`, `canonical_url`, `canonical_path`,
`robots=index,follow`, `indexable=true`, Article-`json_ld`,
`validated_checks` und `seo_hash`. Der Hash bindet exakt die öffentliche SEO-
Projektion aus Meta-Titel/-Description, Canonical-URL/-Pfad, Robots,
Indexierbarkeit und JSON-LD; Planintent, Linktargets und Checkliste bleiben
Compilerlineage. Das deterministische Gate prüft striktes UTF-8, eindeutige
Titel/Descriptions im
Release und gegen das Live-Inventar, inhaltsproportionale Längen, Canonical,
Indexierbarkeit, Robots und gültiges Article-JSON-LD. Ein LLM-SEO-Gate oder
eine zweite Textfassung ist verboten.

## Grafikentscheidung und Asset

Standard ist `graphic_decision.mode=none`. `generate` ist nur zulässig, wenn der
Blueprint einen konkreten Erklärgewinn nennt. Dann wird die Grafik im selben
Lauf tatsächlich erzeugt und eingebunden; ein Briefing oder Platzhalter darf
nicht sichtbar werden. Vor dem Writer-Abschluss existiert genau ein
`article_asset.v2` mit exakt:

- `schema`, `asset_id`, `article_id`, `asset_index`, `asset_path`,
  `asset_byte_hash`, `mime_type`, `width`, `height`;
- präzisem `alt`, verständlicher `caption` und
  `position{index,markdown_offset}`;
- den vom Packager aufgelösten tragenden `record_ids`;
- `creator{role=article-graphic-generator,id,writer_execution_id}` sowie
  `work_order_id`, das exakt dieselbe Writer-Work-Order bindet;
- `created_at` und `content_hash`.

`article-graphic-generator` ist dabei nur das Asset-Creator-Label innerhalb
derselben Writer-Ausführung, keine assignee-fähige Agentenrolle, Work-Order oder
zusätzliche Pipelinewelle. Das Asset darf intern durch ein Bildwerkzeug
entstehen; Work-Order und Execution-Lineage bleiben beim Writer.

`asset_path` bezeichnet ausschließlich den run-relativen Pfad zu den lokal
erzeugten Bytes. Writer und Receipt führen weder R2-Key noch öffentliche URL
als zweite Wahrheit. Aus kanonischem Artikelslug, `asset_byte_hash` und MIME-Typ
leitet der Compiler deterministisch den internen R2-Key
`knowledge/<canonical-slug>/<sha256>.(png|jpg)` und die einzige zulässige
öffentliche URL ab.

Die sichtbare Einbindung besteht aus genau einem Markdown-Bild mit nichtleerem
Alt-Text. Seine URL erfüllt exakt
`^/api/r2/knowledge/<canonical-slug>/[a-f0-9]{64}\.(png|jpg)$`; dabei ist
`<canonical-slug>` der aufgelöste kanonische Artikelslug und der Dateiname der
kleingeschriebene SHA-256 der Assetbytes ohne `sha256:`-Präfix. Unmittelbar in
der nächsten nichtleeren Zeile folgt die kursiv formatierte Caption; Alt,
Caption und Markdownposition stimmen bytegenau mit dem Asset-Receipt überein.

Asset, Alt-Text, Caption und Record-Bindung sind Teil von Compilerprüfung,
`visible_payload_hash`, Publication-Gate, Release und Readback. Fehlt bei
`generate` ein Pflichtfeld oder die tatsächliche Einbindung, blockiert der
Artikel.

## Writer-Output und eingefrorene Payload

Der Writer erzeugt sichtbares Markdown nach diesem Vertrag und genau das
vollständige `article_result.v2` aus Framework 06; technische Provenienz oder
Prüfprosa steht nie im Artikel. Das Receipt bindet die vollständige ausgegebene
Work-Order, per-article Evidence-Lineage, tatsächliche Frameworkdatei,
Writerrevision, Quellen, Record-IDs, Markdown-Bytehash, den vollständigen
`assumption_check_coverage` und optionale Asset-ID.

Der Compiler expandiert anschließend Quellen und Assets genau einmal, erzeugt
die eine sichtbare AST und friert `article_qa_payload.v2` ein. Der echte
React-Renderer erzeugt daraus über
`frontend/render-knowledge-magazine-snapshot.mjs` genau ein
`article_render_snapshot.v2`; eine zweite Template- oder
Markdown-Snapshot-Implementierung ist verboten. Der
`visible_payload_hash` ist der SHA-256 über die kanonische Serialisierung von
Titel, Dek, geordneter sichtbarer AST, Überschriften, Tabellen, Links, Fazit,
expandierten Quellen und Assets. Der Snapshot bindet mindestens
`article_byte_hash`, `visible_payload_hash` und den kanonischen `payload_hash`
des eingefrorenen Publish-Payloads; `compiled_payload_hash` nur ohne
Hash-Zirkel. Reviewer und Executor erhalten exakt diese Payload; der Executor
darf sie weder umformatieren noch erneut kompilieren.

Vor dem Renderer erzeugt der Compiler unabhängig eine
`article_render_projection.v2` und bindet sie als `expected_projection` samt
`projection_hash` im Request. Sie beschreibt Artikel/Route/Template, H1/Dek,
den sichtbaren `ui`-Vertrag, jede geordnete Section mit `section_id`, `kind`,
optionalem `control_type`, Heading, Order, Nummer, `normalized_text`, Links,
Tabellen samt `presentation` und Assets, außerdem TOC, Fazit und geordnete
Quellen. Der echte Snapshot muss dieselbe `actual_projection` und denselben Hash
liefern; alle `projection_checks` und DOM-Checks müssen PASS sein.

`content_release.v2` übernimmt die vollständige `expected_projection` und
deren `projection_hash`. Der öffentliche DOM-Readback schreibt sie unter
`readbacks.dom.actual.projection` samt Hash zurück und muss die kanonisch exakte
Gleichheit für TOC, Sections, Links, Quellen, Controls, UI, Tabellen und Assets
belegen. Einzelne Stichproben oder bloße PASS-Strings ersetzen diese Projektion
nicht. Der SEO-Readback vergleicht analog die vollständige öffentliche SEO-
Projektion samt `seo_hash`.

Der reale CSS-/Layoutnachweis ist ein getrennt gecachtes
`renderer_style_validation.v2` mit
`validator_version=knowledge-magazine-route-browser-contract.v2.2.0`. Er läuft
im Browser nur einmal pro unverändertem
`{validator_version,renderer_style_hash,fixture_hash}`, nicht pro Artikel.
`route_fingerprint` entspricht dem `renderer_style_hash`; das Receipt bindet
die vollständigen Frontend-Datei-/Versionsbestandteile, die kanonische Fixture,
den hydrierten Route-/UI-Zustand, Browser/Viewport, Checks und Fehler, aber keine
Artikel-/Snapshothashes. Ohne dieses PASS-Attest ist Stage 3 nicht
publication-ready.
Das Stage-3-Fazit wird physisch genau einmal im sichtbaren Body/AST gespeichert;
ein paralleles Conclusion-Feld bleibt leer und darf den Text nicht duplizieren.

Writer-seitig fertig ist der Artikel erst, wenn alle Blueprint-Cluster,
Kontroversen und gebundenen Annahmenchecks verständlich verarbeitet, alle
Claims gedeckt, der Supplement-Zweck erhalten und keine Systemprosa sichtbar
ist.
