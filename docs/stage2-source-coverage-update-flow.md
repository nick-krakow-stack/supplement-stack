# Stage-2 Source Coverage Update Flow

## Zweck

Dieser Flow repariert bestehende Wirkstoffbestände, deren Stage-2-Abdeckung zu
stark gebündelt, unvollständig oder nicht mehr eindeutig nachvollziehbar ist.
Er ergänzt den normalen Vollflow aus
[`content-pipeline-v2.md`](content-pipeline-v2.md) und verwendet denselben
`nutrient_content_run.v2`-, Facts-, Publication- und Readback-Vertrag.

Der Update-Flow erzeugt nicht pauschal einen Artikel pro URL. Er arbeitet auf
akzeptierten, aussagekräftigen Originalsources und trennt fünf verschiedene
Zahlen, die niemals wieder als eine einzige „Quellen gesamt“-Kennzahl
ausgegeben werden:

| Kennzahl | Bedeutung |
|---|---|
| `research_inventory_total` | deduplizierte Sources im Research-Inventar |
| `selected_for_stage3_total` | fachlich akzeptierte besitzende Sources im Coverage-Plan des Hauptartikels; bei Meta-Familien nur die Anker |
| `selected_as_meta_constituent_total` | deduplizierte Evidenzeinheiten, die ohne eigenen Carrier als nachgewiesene Meta-Konstituenten sichtbar werden |
| `stage2_carried_source_total` | akzeptierte besitzende Sources mit genau einem gültigen Stage-2-Carrier |
| `visible_source_url_total` | öffentlich sichtbare externe Originallokatoren in den Stage-2-Artikeln |

## Verbindliche Granularität

Standard ist ein eigener Stage-2-Artikel für jede akzeptierte,
aussagekräftige Source. Eine Source ist nicht dasselbe wie eine URL:
DOI-/PMID-/Canonical-URL-Dubletten sowie mehrere Locator derselben
Originalpublikation werden vor der Zuordnung zusammengeführt.

Mehrere Sources dürfen nur in einem gemeinsamen Stage-2-Artikel bleiben oder
neu geplant werden, wenn eine der folgenden Regeln vollständig belegt ist:

| Modus | Zulässiger Fall | Pflichtnachweis | Nicht ausreichend |
|---|---|---|---|
| `single_source` | eigenständige akzeptierte Source | genau eine Source, keine Relation | – |
| `direct_research_line` | Replikation, unmittelbares Follow-up oder konkrete Population-, Dosis-, Methoden-, Outcome- bzw. Versionsweiterentwicklung | Anker plus zusammenhängender Relationsgraph; jede Nicht-Anker-Source genau einmal mit Relationstyp und Begründung | gleiches Thema, ähnliche Aussage, korrelierende Ergebnisse, gleiche Suchintention |
| `meta_analysis_family` | Meta-Analyse, systematischer Review oder Umbrella-Review samt unmittelbar eingeschlossenen Evidenzeinheiten | Review als Carrier-Anker; bei Meta-/systematischen Reviews jede eingeschlossene Primärstudie, bei Umbrella-Reviews jeder eingeschlossene Review genau einmal innerhalb dieser Familie als `meta_constituent` direkt am Anker | bloß gemeinsam zitierte oder thematisch passende Studien; erfundene rekursive Verschachtelung |

Damit gelten die drei Referenzfälle:

1. Originalstudie und spätere direkte Replikation: ein Artikel, beide Sources,
   Relation `replication` oder `direct_follow_up`.
2. Originalstudie und Forschung, die denselben Befund für eine konkrete
   Population, Dosis oder Methode präzisiert: ein Artikel, sofern der direkte
   Bezug aus den Quellen belegt ist; passende Extension-Relation.
3. Meta-Analyse mit 36 eingeschlossenen Studien: ein Artikel mit 37 sichtbaren
   Originalsources; die 36 Einzelstudien erhalten keine eigenen Artikel.

Eine Primärstudie kann nachweislich in mehreren ausgewählten Meta-Analysen
enthalten sein. Sie erscheint dann als nicht besitzendes Originalzitat in jeder
betroffenen Meta-Familie, besitzt aber weiterhin keinen eigenen Carrier und
wird nicht selbst als Stage-3-Source präsentiert. Das Exact-Partition-Gate
bezieht sich in diesem Fall auf die Meta-Anker.

Bei einem Umbrella-Review werden die unmittelbar eingeschlossenen Reviews
sichtbar verlinkt. Deren Primärstudien werden nur zusätzlich übernommen, wenn
der Umbrella-Originaltext selbst eine vollständige identitätsgebundene
Zuordnung veröffentlicht; eine fehlende verschachtelte Liste wird nicht
rekonstruiert oder geraten.

## Ausführung pro Wirkstoff

### 0. Auftrag und unveränderliche Grenzen

Der Run bindet Wirkstoff, Sprache, `operation=full_pipeline`, explizites
`publish.required`, Zielumgebung und einen eigenen Artifact-Root. Für jeden
Wirkstoff entsteht eine getrennte Artefaktkette. Produktionswrites bleiben bis
zum bestandenen Publication-Gate gesperrt.

Vor jeder Änderung werden `AGENTS.md`, der relevante Abschnitt aus
`.agent-memory/current-task.md` und `git status --short` gelesen. Bestehende
Nutzeränderungen werden nicht überschrieben.

### 1. Deterministischer Bestands- und Reuse-Preflight

Read-only erfassen:

- aktuelles Research-Inventar samt Bytehash und Source-Artifact-Receipt;
- aktuellen Stage-3-Hauptartikel;
- alle publizierten und nicht publizierten Stage-2-Artikel des Wirkstoffs;
- Artikel→Source-Relationen, `sources_json`, DOI, PMID, Canonical-URL und
  Originallokator;
- Stage-3-Quellenlinks und `article_layer` jedes internen Ziels;
- vorhandene Coverage-, Evidence-, Facts-, Writer-, QA-, Publish- und
  Readback-Receipts.

Pro vorhandenem Stage-2-Artikel wird klassifiziert:

- `REUSE_SINGLE`: genau eine akzeptierte Source;
- `REUSE_DIRECT_LINE`: mehrere Sources mit vollständig belegbarer direkter
  Forschungslinie;
- `REUSE_META_FAMILY`: Review/Meta-Anker plus exakt eingeschlossene Studien;
- `SPLIT_REQUIRED`: mehrere Sources ohne zulässigen Relationsnachweis;
- `SOURCE_GAP`: akzeptierte Source ohne Stage-2-Carrier;
- `STALE_OR_INVALID`: Source-Link, Artikelstatus, Faktenlineage oder
  Publication-Beleg ist nicht verwendbar.

Hashidentische und weiterhin gültige Artikelzweige bleiben unverändert. Ein
Artikel wird nicht allein wegen eines neuen Gesamtlaufs neu geschrieben.

### 2. Research-Reconciliation

Das Research-Inventar wird über DOI, PMID und Canonical-URL dedupliziert. Für
jede Inventarsource wird genau einer dieser Zustände festgehalten:

- `selected_for_stage3`;
- `selected_as_meta_constituent` mit mindestens einem belegten
  `meta_analysis_family`-Anker;
- `excluded` mit konkretem fachlichem Grund;
- `blocked` wegen fehlender oder nicht prüfbarer Pflichtdaten.

Der Planner darf die Menge nicht künstlich auf sechs bis zehn Sources kürzen,
wenn das vorhandene Inventar bereits mehr fachlich akzeptierte, aussagekräftige
Sources enthält. Sechs bis zehn bleibt eine typische Recherchegröße für neue
Runs, kein Backfill-Cap.

### 3. Source-Assignment-Matrix

Für jede `selected_for_stage3`-Source wird genau ein Carrier festgelegt.
`selected_as_meta_constituent`-Sources werden dagegen ohne eigenes
Carrier-Eigentum an jede belegte Meta-Familie gebunden:

```text
source_id -> existing_live_stage2 | same_release_stage2
          -> article_id / slug
          -> assignment.mode
          -> anchor_source_id
          -> relation_type + rationale (nur bei Mehrquellenartikeln)
```

Maschinelle Gates:

- jede akzeptierte Stage-3-Source hat genau einen Carrier; bei Meta-Familien
  ist dies der Anker, nicht die eingeschlossene Studie;
- keine Source hat zwei Stage-2-Carrier; belegte Meta-Konstituenten dürfen als
  nicht besitzende Zitate in mehreren Meta-Familien vorkommen;
- jeder im Run geplante Carrier ist das exakte `same_release`-Linkziel seiner
  besitzenden Source; Meta-Anker sowie Sources direkter Forschungslinien liegen
  in der geplanten Stage-3-Menge, während belegte Meta-Konstituenten nur in den
  sichtbaren Stage-2-Originallinks stehen;
- jeder Mehrquellenartikel erfüllt vollständig `direct_research_line` oder
  `meta_analysis_family`;
- jede Stage-3-Source kommt genau einmal in
  `selected_link_slice.links[].covered_source_ids` vor;
- jedes source-tragende Live-Ziel ist im autoritativen Linkinventar
  `article_layer=single_study` und seine `source_urls[]` entsprechen über DOI,
  PMID oder normalisierten Canonical-/Originallokator exakt den zugeordneten
  Coverage-Sources;
- Stage 3 enthält im sichtbaren Quellenbereich ausschließlich interne
  `/wissen/...`-Links; externe Originallinks liegen in Stage 2.

Fehlt einer dieser Nachweise, ist der Coverage-Plan nicht `ready`.

### 4. Delta-Plan

Der Delta-Plan wird aus der Matrix abgeleitet, nicht aus einer gewünschten
Artikelzahl:

- `REUSE_*`: bestehende Artikel-, Facts- und Publication-Lineage übernehmen;
- `SOURCE_GAP`: genau einen neuen Stage-2-Artikel planen;
- `SPLIT_REQUIRED`: den bestehenden Artikel als fachlichen Altbestand
  behandeln, einen Carrier für die Ankersource bestimmen und für jede übrige
  eigenständige Source einen neuen Stage-2-Artikel planen;
- `STALE_OR_INVALID`: nur den tatsächlich betroffenen Artikelzweig neu bauen;
- Stage 3 als Klasse `L` korrigieren, wenn sich interne Quellenlinks,
  Source-Coverage oder sichtbare Quellenrelationen ändern.

Ein Split löscht keine Produktionsdaten vorab. Neue Artikel und die korrigierte
Stage-3-Verlinkung werden additiv vorbereitet. Eine Deaktivierung eines
ersetzten Sammelartikels gehört, falls überhaupt nötig, in denselben guarded
Release. Der Full-Pipeline-Run deklariert ihn ausschließlich unter
`publish.retire_articles[]` mit `article_id`, `slug`,
`expected_status=published`, `expected_version` und
`expected_payload_hash`. ID oder Slug dürfen mit keinem neuen oder geänderten
Releaseartikel kollidieren.

Der autoritative `article_target_readback` friert dieselbe vollständige
Artikel-/Relations-/Interpretations-Snapshotlineage wie bei einem Update ein.
`publication_apply` setzt im gemeinsamen atomaren D1-Batch ausschließlich
`status=draft` und `version=version+1`; Content, Metadaten, Quellen-,
Ingredient- und Interpretationsrelationen werden nicht umgeschrieben. Ein
Reapply ist nur dann `already_current`, wenn Version, Draftstatus und der aus
dem unveränderten Payload rekonstruierte Vorgängerhash exakt zum Guard passen.
Ein kompensierender Rollback stellt Status und Version exakt wieder her.

### 5. Betroffene v2-Stages

Nur invalidierte Lineage wird ausgeführt:

1. Reuse-Preflight und Source-Radar-Reconciliation;
2. neuer vollständiger `coverage_plan.v2` mit
   `stage2_source_assignment_policy=one_meaningful_source_per_stage2.v1` und
   `stage3_source_label_policy=german_original_title.v1`; jeder Stage-2-
   Carrier bindet den deutschen Originaltitel als
   `source_presentation_label_de`;
3. Originalquellen-Extraktion nur für neue oder geänderte Pflichten;
4. risikobasiertes Facts-Gate für den betroffenen Scope;
5. `writers_ready` erst nach allen geplanten Facts-Gates;
6. neue/geänderte Stage-2-Artikel und Stage-3-Korrektur parallel;
7. deterministischer Compiler/Render;
8. ein unabhängiges Publication-Gate;
9. late-bound Ingredient-/Source-/Asset-Preflight;
10. ein atomarer, idempotenter Publish für alle `same_release`-Kanten;
11. öffentlicher DOM-/API-/SEO-Readback und siteweiter
    Indexability-/Delivery-Status.

Bei einem nur wiederverwendeten Artikel werden Writer und QA nicht wiederholt.
Bei geänderten Quellen, Links, Claims oder Relationen gilt immer Klasse `L`.

### 6. Veröffentlichung und Readback

Ein Run mit Publish-Auftrag ist erst abgeschlossen, wenn
`content_publish_receipt.v2` den vollständigen Release bindet und der
öffentliche Readback für jeden betroffenen Artikel bestätigt:

- HTTP/API erfolgreich und erwarteter `article_layer`;
- Stage-3-Quellenliste enthält ausschließlich interne Stage-2-Links;
- jedes Stage-3-Quellenlabel entspricht bytegleich dem deutschen
  Originaltitel-Label des verlinkten Stage-2-Carriers;
- jedes interne Stage-2-Ziel ist öffentlich erreichbar und
  `single_study`;
- jeder Stage-2-H1 entspricht dem Label und der Artikel gibt Bedingungen,
  Design/Entstehungsgrundlage, Inhalte, Ergebnisse und Grenzen der Quelle auf
  Deutsch wieder; bloße Metaumschreibungen bestehen den Readback nicht;
- Stage-2-Quellenliste enthält die erwarteten externen Originallokatoren;
- Source-Menge, Relation-Hash, sichtbare Payload und SEO-Projektion stimmen;
- `/api/knowledge`, `/wissen`, Robots, Sitemap und Raw-HTML-Indexability sind
  entsprechend dem Pipelinevertrag wahrheitsgemäß ausgewiesen.

Für jedes Retirement bindet `content_publish_receipt.v2` zusätzlich den
Guard-/Resultzustand und frische Negativ-Readbacks: Die Detail-API bestätigt
HTTP 404, `/api/knowledge` enthält den Slug nicht und die öffentliche
`/wissen`-Route enthält keinen Link auf `/wissen/<slug>`. Scheitert einer
dieser Checks, wird der gesamte Artikel-/Retirement-Batch kompensierend auf
den exakten Vorzustand zurückgesetzt.

Ein Badge- oder siteweiter SEO-Delivery-Mismatch rollt korrekte Artikel nicht
zurück, setzt aber den vorgesehenen Aggregate-Status.

## Fortschritts- und Abschlussreport

Der Report pro Wirkstoff enthält mindestens:

| Feld | Berechnung |
|---|---|
| `research_inventory_total` | deduplizierte Inventarsources |
| `selected_for_stage3_total` | akzeptierte Sources im neuen Plan |
| `single_source_carried_total` | Sources in `single_source`-Artikeln |
| `direct_line_carried_total` | Sources in `direct_research_line`-Artikeln |
| `meta_anchor_total` | Meta-/Review-Anker |
| `meta_constituent_total` | unmittelbar eingeschlossene Evidenzeinheiten ohne eigenen Artikel |
| `published_stage2_article_total` | öffentlich publizierte `single_study`-Artikel |
| `visible_source_url_total` | externe Originallokatoren über alle Stage-2-Artikel |
| `uncovered_selected_source_total` | muss `0` sein |
| `duplicate_carrier_source_total` | muss `0` sein |
| `stage3_duplicate_presentation_total` | muss `0` sein |

`COMPLETE` ist nur zulässig, wenn die letzten drei Werte null sind, alle
betroffenen Article-Branches bestanden haben und Publish plus öffentlicher
Readback vollständig receiptgebunden sind. Ein Draftlauf darf entsprechend
dem Hauptvertrag ohne Produktionswrite enden, darf dann aber nicht als
veröffentlicht gemeldet werden.

## Empfohlene Audit-Reihenfolge für den aktuellen Bestand

Die Reihenfolge ist risikobasiert und behauptet nicht vorab, dass jeder
genannte Wirkstoff falsch ist:

1. Vitamin-Backfills mit einem oder sehr wenigen Stage-2-Artikeln trotz vieler
   Research-Sources, insbesondere Vitamin D, B12, K, C, E, B1, B6, B7 und B9;
2. Vitamin B2, B3 und B5 sowie Mineral-/Elektrolyt-Backfills mit gemischter
   Reuse-/Split-Wahrscheinlichkeit;
3. Ginseng und Grapefruitkernextrakt, weil dort mehrere akzeptierte Sources auf
   wenige Stage-2-Artikel verteilt wurden;
4. übrige Wirkstoffe nur anhand derselben Matrix, nicht anhand einer pauschalen
   Mindestartikelzahl.

Für jeden Wirkstoff wird erst der Read-only Audit abgeschlossen. Danach läuft
genau der notwendige Delta-Scope durch alle betroffenen Gates und wird bei
explizitem Publish-Auftrag samt öffentlichem Readback veröffentlicht.
