# Stage-3-Magazinartikel in Runtime v2

Neue Hauptartikel werden ausschließlich über die kanonische Runtime-Kette
geplant, geprüft und für den Publish eingefroren:

```text
nutrient_content_run.v2
  -> article_result.v2
  -> validation_receipt.v2
  -> article_publication_review.v2
  -> content_release.v2
  -> content_publish_receipt.v2
```

```powershell
node scripts/run-nutrient-content.mjs `
  --manifest _research_raw/<stoff>/nutrient-content-run.v2.json
```

Das `article_plan.stage3` enthält 0..n eindeutige Artikeljobs mit Slug,
Zielpfad, Renderprofil und Guard. Stoffnamen, Pfade oder Artikelzahlen sind
nicht im Runner verdrahtet.

Research bleibt upstream formatagnostischer, strikt UTF-8-validierter und
bytehashgebundener Inhalt. `research_source_artifact_receipt.v2` friert
zusätzlich jede einmal beschaffte Originalquelle ein. Stage 3 interpretiert
weder Research noch Originaldateien erneut; die strukturierte Grenze beginnt
bei `coverage_plan.v2`, und der Writer arbeitet allein mit seinem daraus
freigegebenen Facts-Paket.

## Einzige Template-Wahrheit

Der vollständige technische Authoringvertrag steht ausschließlich in
[`Framework 03`](../codex-files/frameworks/03_framework_hauptartikel.md).
Diese Importdokumentation kopiert sein Markdown-Skelett nicht, damit
Templateänderungen nicht an zwei Stellen auseinanderlaufen.

Der Compiler erzwingt unter anderem:

- H1 ab Byte 1, genau einen Dek-Absatz und genau einen Magazinmarker;
- `Auf einen Blick` mit exakt drei bis sechs eigenständigen Aussagen;
- nur stoffgerechte, nichtleere adaptive Inhaltsabschnitte;
- genau ein sichtbares Fazit;
- `Quellen` als letzte H2 mit genau einem `<!-- sources:auto -->`;
- keine Writer-Quellenliste, Metadaten, Systemhinweise, Grafikbriefings oder
  Platzhalter.

Die sichtbare Projektion bindet darüber hinaus Abschnittsart und optionale
Kontrollblockart, Nummerierung, TOC, Links, Tabellenpräsentation, alle Bilder,
Fazit, Quellen sowie die festen UI-Elemente des Magazins. Merkkasten und
rechtlicher Hinweis bleiben unnummerierte Kontrollblöcke außerhalb des TOC.
Eine Lebensmittelübersicht muss als semantische Tabelle exakt dieselben
Header-/Zell-Tupel wie das Markdown tragen. Damit reicht ein korrektes
Markdown allein nicht: die tatsächliche Templatewirkung muss ebenfalls exakt
passen.

Magnesium und Vitamin A sind gleichwertige Lesbarkeitsreferenzen. Sie sind
weder Markdown-Template noch Grundlage für das Kopieren einer festen
Abschnittsfolge.

## Writer-Input und `writers_ready`

Stage 3 startet erst, wenn alle Obligations seines Blueprints erfüllt sind und
das Evidence-Gate `writers_ready` berechnet hat. Sein lockgebundenes Facts-Paket
enthält die freigegebenen Records, benötigten Cluster, Kontroversen samt
Darstellungsentscheidung, den `common_assumption_review` mit aufgelösten
Record-/Obligation-Bindungen, sichtbare Quellen, Frameworkversion, Blueprint
und kompakten SEO-Brief.

Zusätzlich enthält das Paket nur den artikelbezogenen
`selected_link_slice`. Das vollständige Seiteninventar bleibt beim
Coverage-Planner. Unbeteiligte neue Seiten lösen deshalb keinen Writer- oder
Reviewlauf aus; ein geänderter ausgewählter Link replaniert vor Evidence nur
die betroffenen Artikelknoten.

Der Writer recherchiert nicht nach, liest keine Stage-2-Prosa als Evidenz und
erzeugt keine artikelabgeleiteten Langextrakte oder RAG-Chunks. Ein manuell
gewähltes Facts-Paket, ein alter Artikel oder ein Accepted-Flag darf das
Facts-Gate nicht umgehen.

Jeder identifizierte Annahmencheck wird im Hauptartikel genau einmal klar
beantwortet und im `article_result.v2.assumption_check_coverage` mit einem
Conclusion-Wert sowie den paketidentischen Record-/Obligation-IDs gebunden.
Discovery-Signale dürfen ohne geprüften Prävalenzrecord nicht als „die meisten
Menschen glauben“ quantifiziert werden.

Stage 2 und Stage 3 laufen nach ihren bestandenen Gate-Aussagen parallel. Stage
3 wartet auf alle Blueprint-Cluster, nicht auf die redaktionelle Fertigstellung
von Stage 2.

## Grafiken sind gebundene Outputs

Eine Grafik ist nur zulässig, wenn der Blueprint einen echten Erklärgewinn
vorsieht und vor dem Publication-Gate:

1. das Asset tatsächlich erzeugt wurde;
2. ausschließlich freigegebene Records visualisiert werden;
3. die Darstellung fachlich geprüft ist;
4. lokaler Pfad, Assetbytes, Caption und Alttext feststehen;
5. die responsive Einbindung im kompilierten Payload enthalten ist.

Jedes integrierte Bild besitzt zusätzlich ein `article_asset.v2`, das lokale
Assetbytes, Rasterdimensionen, Alttext, Caption und die visualisierten
freigegebenen Record-IDs bindet.

`article_asset.v2.asset_path` ist ausschließlich der run-relative lokale
Bytepfad und enthält weder R2-Key noch öffentliche URL. Aus kanonischem Slug,
Bytehash und MIME leiten Compiler und Release deterministisch den internen
R2-Key `knowledge/<canonical-slug>/<sha256>.(png|jpg)` und die sichtbare URL ab.
Der sichtbare Markdownpfad muss exakt
`^/api/r2/knowledge/<canonical-slug>/[a-f0-9]{64}\.(png|jpg)$` erfüllen. Externe
Bild-/Daten-URLs, dateisystemrelative Authoringpfade, Traversal, Root-Ausbruch
und nachträglich veränderte Assetbytes blockieren. Ein Briefing, Prompt oder
TODO ist niemals sichtbarer Artikelinhalt.

## Compile und eingefrorener Payload

Der Writer liefert Markdown plus ein `article_result.v2` mit echter
Writer-Execution und Bindung an Artikeljob, Facts-Paket, Framework und
Dateihash. Der Compiler assembliert daraus exakt einen sichtbaren Payload und
prüft Struktur, UTF-8, Quellenrelationen, Obligations sowie Assets.

Nach technisch erfolgreicher terminaler Writerausführung entsteht zusätzlich
am top-level gebundenen Pfad ein `work_order_execution_receipt.v1`. Sein
`result=PASS` bezeichnet nur Executor-Erfolg; `result_hash` bindet den
fachlichen Writeroutput auch bei dessen `FAIL|BLOCKED`. Es enthält keinen
Artikelinhalt und ersetzt nicht `article_result.v2`.

Bei PASS bindet die `validation_receipt.v2`:

- Artikel- und Payloadhash;
- Facts-Paket und Evidence-Lock;
- Framework-, Renderprofil-, Validator- und Policyversion;
- geordnete sichtbare Quellenrelationen;
- jedes Asset samt Pfad, Bytehash, Alttext und Caption.

Publication-Reviewer, Release, Write und Live-Readback verwenden denselben
eingefrorenen Payload. Es findet dazwischen keine erneute Assembly statt.

Der Stage-3-Compiler vergleicht eine unabhängig abgeleitete Projektion mit dem
React-Render-Snapshot. Zusätzlich hydratisiert ein echter Chrome-/Edge-Lauf die
kanonische `/wissen/:slug`-Route über App, Layout, Page und API-Fixture und
prüft unter anderem linke Navigation, Disclosure-Verhalten, Bilder,
Lebensmittel-Grid und responsive Styles. Dieser teure Browser-PASS ist an
`(validator_version, renderer_style_hash, fixture_hash)` gebunden und wird
artikel- und runübergreifend wiederverwendet. Artikel- oder Snapshot-Hashes
gehören absichtlich nicht in diesen Cache-Key.

Das Fazit liegt im Stage-3-Publish-Payload genau einmal im Body. Die separate
Conclusion-Repräsentation bleibt `null`; dadurch kann das Frontend das Fazit
nicht doppelt darstellen.

## Begrenztes Publication-Gate

Das unabhängige `article_publication_review.v2` prüft den vollständigen
eingefrorenen Hash in zwei Pässen: zuerst Faktentreue/Sicherheit/Quellen, dann
Leserführung/People-first SEO/Templatewirkung. Zählbare Compilerregeln werden
nicht manuell wiederholt.

Blockierende Befunde gehen gebündelt und positionsgenau an den Writer. Pro
Artikel sind höchstens zwei gezielte Revisionen zulässig; ihr neuer Hash wird
erneut kompiliert. Danach prüft derselbe unabhängige Reviewer jeweils nur Diff,
Nachbarabsätze, berührte Claims/Quellen und sichtbare Folgewirkungen.
Verbleibende Blocker stoppen den Lauf statt eine dritte Feedbackschleife oder
eine pauschale Vollprüfung auszulösen.

Unveränderte Artikel und Evidence-Artefakte behalten ihre gültigen Receipts.

## Release, Guard und Publish-Wahrheit

Nur ein vollständig bestandenes, hashidentisches Ergebnis gelangt in
`content_release.v2`. Der Release trägt den eingefrorenen Payload, geordnete
Relationen, Assets, Writer-/Validation-/Reviewbindungen und einen expliziten
Create-/Update-Guard.

Der spätere Publication Executor meldet pro Artikel entweder:

- `applied` mit dem exakt erwarteten geänderten Record; oder
- `already_current` mit `0 changed`, wenn Ziel- und Releasehash bereits gleich
  sind.

Das `content_publish_receipt.v2` bindet Guardresultat, resultierende Version,
Payload-, Relations-, SEO- und Assethashes sowie strukturierte scoped
Readbacks. Erst nach bestandenem Publication-Gate und nur bei explizitem
Publish werden Ingredient, Source-Katalog und gegebenenfalls R2-Assets
late-bound aufgelöst beziehungsweise additiv/idempotent gestaged. Der folgende
atomare D1-Batch umfasst Artikel, Quellen-/Ingredientrelationen,
Originalfacts-Interpretationen und `same_release`-Abhängigkeiten.

Für einen Magazinartikel umfassen die Readbacks den Persistenzrecord,
`status`, `article_layer`, `sources_json` v2, Relationen, öffentliche
Detailantwort, UTF-8 und die vollständige DOM-/SEO-Projektion – insbesondere
Magazinmarker, linke Navigation, Fazit, Bild/Caption und Quellenanzeige. Bei
`already_current` müssen dieselben Zielhashes nachgewiesen werden; `0 changed`
allein reicht nicht. Roh-HTML/SSR, Robots und Sitemap werden danach genau
einmal originweit gelesen. Ist nur die Site-Policy noch nicht live, bleibt der
Artikel publiziert und es entsteht kein Writerloop oder zweiter Publish.

Der separate releaseweite `knowledge_badge_readback.v1` prüft für die
betroffenen Ingredients die gebundene Prestate-Erhaltung oder API-/DOM-Parität
zwischen `/api/knowledge` und `/wissen`; ein Stage-3-Artikel erfindet weder
Studien- noch DGE-Status. Ein Mismatch lässt den korrekten Artikelbranch
`published=true/COMPLETE`, setzt aber das Aggregat ohne Rollback oder Writer-/
Publication-QA-Rerun auf `BLOCKED` und eskaliert Technik/Daten.

Der Runner autorisiert den produktiven Cloudflare-D1-Apply nie implizit. Ohne
vollständig valides Apply-/Readback-Receipt bleibt der Zustand
`READY_TO_PUBLISH`/`published=false` und genau eine deterministische
`publication_apply`-Work-Order beschreibt Guard, Release und gezielten
Readback. Der zentrale Maschinen-Dispatcher führt sie nur mit explizitem
Publish-Flag aus. Ein vorhandenes ungültiges Receipt führt dagegen direkt in
eine Integrity-Eskalation, nicht in einen zweiten Apply.

## Legacy-/Übergangstools

`scripts/build-knowledge-magazine-import.mjs` und
`scripts/build-vitamin-magazine-import.mjs` bleiben explizite
Legacy-/Diagnosewerkzeuge. Alte `stage3_article_import.v2`- oder
`publication_batch.v1`-Daten werden nicht automatisch als neue Runtime-v2-
Artefakte erkannt und dürfen keinen `content_release.v2` umgehen.

Eine Migration muss Legacy-Input ausdrücklich normalisieren und danach die
vollständige v2-Kette ab `article_result.v2` mit neuem Hash, Compiler,
Publication-QA, Guard und Readback durchlaufen. Die Tools können lokal einen
Dry-Run beziehungsweise guarded SQL vorbereiten; sie führen keinen produktiven
D1-Apply aus.

```powershell
node scripts/build-knowledge-magazine-import.mjs `
  --markdown path/to/article.md `
  --meta path/to/stage3-import.json `
  --dry-run

node --test scripts/build-knowledge-magazine-import.test.mjs
node --test scripts/run-nutrient-content.test.mjs
```
