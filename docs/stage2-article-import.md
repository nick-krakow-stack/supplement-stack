# Stage-2-Artikel in Runtime v2

Neue Stage-2-Artikel laufen ausschließlich durch die kanonische Kette:

```text
nutrient_content_run.v2
  -> article_result.v2
  -> validation_receipt.v2
  -> article_publication_review.v2
  -> content_release.v2
  -> content_publish_receipt.v2
```

Der Artikelplan im `nutrient_content_run.v2` bestimmt 0..n Stage-2-Jobs,
Artikel-IDs, Slugs, Markdownpfade und Create-/Update-Guards. Das Framework
kommt ausschließlich aus dem lockgebundenen Coverageplan. Es gibt keine feste
Artikelzahl und keinen stoffspezifischen Pfad.

Die vorgelagerte Researchdatei ist bewusst formatagnostisch und wird als
striktes UTF-8 plus Bytehash gebunden. Ein
`research_source_artifact_receipt.v2` friert daneben die einmal beschafften
Originalquellen ein. Der Writer interpretiert weder Research noch Quelldateien
erneut; sein strukturierter Fachinput ist ausschließlich das aus
`coverage_plan.v2` abgeleitete, gelockte Facts-Paket.

```powershell
node scripts/run-nutrient-content.mjs `
  --manifest _research_raw/<stoff>/nutrient-content-run.v2.json
```

## Reines sichtbares v2-Markdown

Ein Stage-2-v2-Writer liefert pro Job eine eigene UTF-8-Markdown-Datei nach dem
im Coverageplan gewählten Framework:

- [`Framework 01`](../codex-files/frameworks/01_framework_single_study.md) für
  Einzelstudien sowie Behörden-/Leitlinien-/Sicherheitsquellen;
- [`Framework 02`](../codex-files/frameworks/02_framework_meta_study.md) für
  systematische Reviews und Metaanalysen.

Die Datei enthält nur publizierbaren Text: H1, Lead, adaptive fachliche
Abschnitte, Fazit und die letzte Quellen-H2 mit
`<!-- sources:auto -->`. Framework, IDs, Status, Kernfelder, Hashes,
Abschlussstatus, Importanweisungen und Reviewdaten sind im sichtbaren Markdown
verboten.

Alle technischen Angaben stehen im `article_result.v2`. Dieses bindet
insbesondere Artikeljob, Writer-Execution, Frameworkversion, Artikelbytes,
lockgebundenes Facts-Paket und Zielidentität. Supporting-Quellen werden im Text
inhaltlich berücksichtigt, bleiben aber in den freigegebenen sichtbaren
Relationen eindeutig von der Primärquelle unterscheidbar.

Nach technisch erfolgreicher terminaler Writerausführung entsteht zusätzlich
am top-level gebundenen Pfad ein `work_order_execution_receipt.v1`. Sein
`result=PASS` bezeichnet nur Executor-Erfolg; `result_hash` bindet den
fachlichen Writeroutput auch bei dessen `FAIL|BLOCKED`. Es enthält keine
Artikelinhalte und ersetzt nicht `article_result.v2`.

Der Coverage-Planner bindet nur die für diesen Artikel vorgesehenen internen
Links im `selected_link_slice`. Der Writer darf keine beliebigen weiteren
`/wissen/`-Ziele hinzufügen; Änderungen an unbeteiligten Seiten invalidieren
den Artikel dafür nicht.

## Start-Gate und Obligations

Ein Writerjob wird nur erzeugt, wenn das Evidence-Gate für genau diesen Job
`writers_ready` berechnet hat. Dafür müssen:

- alle benötigten Cluster und erwarteten Record-Typen vollständig sein;
- High-Risk-Records und die deterministische Niedrigrisiko-Stichprobe bestanden
  haben;
- offene Eskalationen und materielle Kontroversen aufgelöst oder ausdrücklich
  für den Artikel dargestellt sein;
- das Facts-Paket exakt im bestandenen Evidence-Lock gebunden sein.

Ein frei gesetzter `facts_package_path`, ein alter Accepted-Status oder ein
vorhandener Artikel ersetzt dieses Gate nicht. Stage-2-Jobs dürfen nach dem
Gate parallel untereinander sowie parallel zu Stage 3 geschrieben werden.

## Compile, Freeze und Publication-QA

Der v2-Compiler liest das reine Markdown direkt; er erwartet keine Legacy-
Metadatenblöcke. Er assembliert Titel, Summary/Lead, Body, Fazit und automatisch
erzeugte Quellenrelationen und bindet den eingefrorenen Payload in einer
`validation_receipt.v2`. Sichtbare Assets werden mit sicher aufgelöstem Pfad,
Alttext und Bytehash gebunden.

Ein unabhängiges `article_publication_review.v2` prüft anschließend den
vollständigen eingefrorenen Artikelhash. Bei blockierenden Befunden gibt es
höchstens zwei eng begrenzte Writerrevisionen und jeweils nur einen gezielten
Diff-/Nachbarschafts-Recheck.
Eine Änderung erzeugt einen neuen Artikel-/Payloadhash; unveränderte
Nachbarartikel werden nicht neu geschrieben oder reviewt.

Nur bestandene Artikel gelangen unverändert in `content_release.v2`.

## Sichere Ziele und Guards

Artikel-, Sidecar-, Asset-, State- und Releasepfade müssen innerhalb der im Run
zugelassenen Roots liegen. Traversal, absolute/UNC-Pfade außerhalb des Roots,
aufgelöste Verknüpfungen nach außen und Pfadkollisionen blockieren vor dem
ersten Write.

Ein Create-Guard erwartet einen fehlenden Zielrecord. Ein Update-Guard bindet
mindestens eindeutige Identität, erwarteten Status, erwartete Version und alten
Payloadhash. Quellenrelationen und Assets dürfen erst nach bestandenem Guard
auf den freigegebenen Releasezustand gebracht werden.

Der lokale Runner erzeugt und validiert den `content_release.v2`. Fehlt das
`content_publish_receipt.v2`, bleibt der Lauf `READY_TO_PUBLISH` und gibt genau
eine deterministische, guardgebundene `publication_apply`-Work-Order aus. Ein
bereits vorhandenes ungültiges Receipt wird nicht automatisch erneut
angewendet.

## Idempotenz und Readback

Der spätere Publication Executor darf pro Artikel nur melden:

- `applied` mit exakt dem erwarteten geänderten Record; oder
- `already_current` mit `0 changed`, wenn der Zielhash bereits exakt dem
  freigegebenen Hash entspricht.

Der late-bound Publishpfad löst erst nach bestandenem Publication-Gate und nur
bei expliziter Autorisierung Ingredient, Source-Katalog und gegebenenfalls
Assets auf. Erst danach bindet der atomare D1-Release Artikel,
Quellen-/Ingredientrelationen, Originalfacts-Interpretationen und
`same_release`-Abhängigkeiten; Source-/R2-Staging bleibt getrennt additiv und
idempotent.

Das Receipt bindet Guard, resultierende Version, Payload-, Relations- und
Assethashes. Strukturierte Readbacks prüfen den betroffenen Record, `status`,
`article_layer`, `sources_json` v2, Relationen, Interpretationen, öffentliche
Detailantwort, UTF-8 sowie vollständige DOM-/SEO-Projektion des Zielartikels.
Roh-HTML/SSR, Robots und Sitemap sind anschließend ein einziger originweiter
Delivery-Readback; ein reines Site-Policy-Defizit lässt den Artikel publiziert
und erzeugt keinen Writerloop.

Der releaseweite `knowledge_badge_readback.v1` verlangt für jede Ingredient-ID
dieses Stage-2-Releases `studies_rule=REQUIRE_TRUE` und vergleicht frisch
`/api/knowledge` mit dem hydrierten `/wissen`-DOM. Der Studien-Badge folgt dem
publizierten, akzeptierten `single_study`-Artikel unabhängig von Dosisfeldern;
DGE wird nur erhalten beziehungsweise auf API-/DOM-Parität geprüft. Ein Badge-
Mismatch lässt den Artikelbranch `published=true/COMPLETE`, blockiert aber den
Aggregate-Abschluss ohne Rollback, Writer- oder Publication-QA-Rerun.

## Expliziter Legacy-Input-Adapter

Alte Stage-2-Dateien mit `Kernfelder (Metadaten)`, `Artikel`,
`Abschlussstatus`, alten Candidate-Arrays oder `extract_path` sind keine
gültigen v2-Writeroutputs. Sie werden niemals automatisch erkannt oder direkt
in einen v2-Release übernommen.

Für eine Migration muss der Operator ausdrücklich den Legacy-Input-Adapter
wählen. Dieser darf alte Felder nur lesen, um daraus reines Framework-01/02-
Markdown und einen neuen v2-Artikeljob vorzubereiten. Danach gelten ohne
Ausnahme Evidence-Lock, `writers_ready`, neuer Writer-/Compilerhash,
Publication-QA, Guard und Readback der vollständigen v2-Kette. Fehlende
Pflichtwerte werden nicht erfunden; der Adapter blockiert oder übernimmt nur
einen Draft.

`scripts/build-stage2-article-import.mjs` bleibt ein isoliertes Legacy-/
Diagnosewerkzeug. Es kann SQL vorbereiten, wendet es aber nicht an und ist kein
alternativer v2-Publisher. Sein Aufruf muss stets explizit erfolgen:

```powershell
node scripts/build-stage2-article-import.mjs `
  --article-list <legacy-manifest.json> `
  --dry-run

node --test scripts/build-stage2-article-import.test.mjs
node --test scripts/run-nutrient-content.test.mjs
```
