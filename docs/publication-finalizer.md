# Runtime-v2-Release, Publication-QA und Publish-Receipt

Der generische Einstieg für einen Stofflauf ist:

```powershell
node scripts/run-nutrient-content.mjs `
  --manifest _research_raw/<stoff>/nutrient-content-run.v2.json
```

Jeder erneute Aufruf ist ein idempotenter Resume-Versuch: Der Runner validiert
vorhandene Artefakte und gibt nur die kleinste noch erforderliche Menge
disjunkter, parallel ausführbarer Work-Orders aus. Er führt keine Recherche,
Writerarbeit, fachliche Review oder produktive
Publikation scheinbar selbst aus.

Die Research-Vorstufe bleibt formatagnostischer, strikt UTF-8-validierter und
über `coverage.research_hash` gebundener Inhalt. Zusätzlich friert
`research_source_artifact_receipt.v2` jede einmal beschaffte Originalquelle
mit Locator und Bytehash ein. Kein Downstream-Agent lädt sie erneut. Das
Publication-Gate erfindet dafür kein paralleles Fakten- oder Extract-Schema;
seine Artikel-Lineage beginnt beim validierten `coverage_plan.v2` und dem
Evidence-Lock.

## Verbindliche Artefaktkette

Für neue Läufe gilt ausschließlich:

```text
nutrient_content_run.v2
  -> article_result.v2
  -> validation_receipt.v2
  -> article_publication_review.v2
  -> content_release.v2
  -> content_publish_receipt.v2
```

| Artefakt | Verantwortlich | Bindet |
|---|---|---|
| `nutrient_content_run.v2` | Runner/Orchestrator | Scope, Stoff, Sprache, Policy, sichere Roots, Inputs, Artikelplan, Guards und optional Stage 4 |
| `article_result.v2` | Writer-Wrapper | Artikelbytes, Writeridentität, lockgebundenes Facts-Paket, Framework und Ziel |
| `validation_receipt.v2` | Compiler/Lint | eingefrorenen Payload, Quellen, Assets, Dependencies sowie Validator-/Policyversion |
| `article_publication_review.v2` | unabhängiger Publication-Reviewer | genau diesen Payloadhash, beide Prüfpässe und gegebenenfalls den begrenzten Recheck |
| `content_release.v2` | deterministischer Finalizer | nur vollständig bestandene Artikel, Guards, Payloads, Relationen und Assets |
| `content_publish_receipt.v2` | Publication Executor | Apply-/Already-current-Ergebnis und strukturierte gezielte Readbacks |

Die alten Artefakte `article_provenance.v1`, `content_lint_result.v1`,
`publication_quality_review.v1`, `publication_bundle.v1` und
`publication_receipt.v1` sind keine parallelen v2-Ausgaben.

## Run-Manifest und sichere Pfade

Stage-2- und Stage-3-Mengen werden vollständig aus dem Artikelplan gelesen;
beide dürfen 0..n Einträge enthalten. Artikel-ID und Slug sind laufweit
eindeutig. Jeder Eintrag besitzt einen expliziten Create- oder Update-Guard.

Alle Eingabe- und Ausgabepfade werden gegen die im Run zugelassenen Roots
aufgelöst. Der Runner weist insbesondere zurück:

- Traversal, absolute/UNC-Pfade und Laufwerkswechsel außerhalb des Roots;
- aufgelöste Symlinks/Junctions, die den Root verlassen;
- Kollisionen zwischen Input, Artikel, Sidecar, Asset, State, Release und
  Publish-Receipt;
- frei gewählte Facts-Pakete, die nicht im bestandenen Evidence-Lock gebunden
  sind;
- Lösch- oder Replace-Ziele außerhalb selbst verwalteter Run-Ausgaben.

Test-Fixtures dürfen nur über den ausdrücklichen Testmodus abweichende Roots
verwenden. Ein Test-Lock ist nicht produktionsfähig.

## Zustände und `writers_ready`

Der Runner kann abhängig vom frühesten fehlenden oder ungültigen Knoten unter
anderem auf Research, Source-Extraktion, Source-Review, Writer oder
Publication-QA warten. Nach vollständigem Gate endet er bei
`READY_TO_PUBLISH`; `COMPLETE` ist nur mit dem unten beschriebenen Receipt oder
bei einem ausdrücklich nicht publizierenden Validierungsrun zulässig.

`writers_ready` wird aus Coverage-Obligations, risikobasiertem Source-Review,
bestandenen Cluster-Gates und lockgebundenen Writer-Paketen berechnet. Ein
manuelles Flag oder lediglich vorhandene JSON-Dateien reichen nicht. Erst dann
werden Stage 2 und Stage 3 parallel geplant.

Die Dispatch-Matrix ist fail-closed. Ein Zustand darf nur die zugehörigen
Work-Order-Arten ausgeben; unbekannte Phantomrollen stoppen vor dem Write:

| Zustand | Zulässige aktive Work-Orders | Ausführung |
|---|---|---|
| `WAITING_FOR_RESEARCH` | `research`, `research_source_freeze`, optional paralleler `link_inventory_source_readback`, oder `coverage_planning` | LLM; Linkexport deterministisch |
| `WAITING_FOR_LINK_INVENTORY` | `link_inventory_source_readback` | deterministisch |
| `WAITING_FOR_FRAMEWORK` | `framework_design`, bedingt `framework_owner_approval`, danach `framework_catalog_activate` | seltene LLM-Ausnahme; bedingt Mensch; Aktivierung deterministisch |
| `WAITING_FOR_TECHNICAL_FRAMEWORK_CHANGE` | `framework_runtime_change_handoff` | menschlicher Handoff, kein Contentpilot |
| `WAITING_FOR_SOURCE_EXTRACTION` | `source_extraction` oder einmalig `source_extraction_repair` | parallele LLM-Slices, höchstens vier Quellen; Repair nur gebundener Failure-Scope |
| `WAITING_FOR_SOURCE_REVIEW` | `source_facts_review` | unabhängiges LLM-Review |
| `WAITING_FOR_WRITERS` | `writer`, `writer_revision` oder `writer_repair`; optional `stage4_stack_sync` | LLM |
| `WAITING_FOR_PUBLICATION_QA` | `publication_qa`; optional `stage4_stack_sync` | LLM |
| `WAITING_FOR_INGREDIENT_TARGET` | `ingredient_target_readback` | deterministisch, read-only und erst nach QA bei explizitem Publish |
| `WAITING_FOR_SOURCE_CATALOG_SYNC` | `source_catalog_sync` | deterministisch, additiv/idempotent und erst nach QA bei explizitem Publish |
| `WAITING_FOR_ASSET_DEPLOYMENT` | `asset_stage`, abhängig davon parallel auch Ingredient-/Source-Order | deterministisch, additiv/idempotent und erst nach QA bei explizitem Publish |
| `READY_TO_PUBLISH` | exakt ein `publication_apply`; optional der Stage-4-Child | deterministisch; Stage 4 LLM |
| `WAITING_FOR_INDEXABILITY_RELEASE` | `indexability_release_handoff` | nur humaner Site-Policy-Handoff nach COMMITTED Publish; kein Content-/LLM-Schritt |
| `COMPLETE` | keine Artikel-Work-Order; nur ein noch unabhängiger Stage-4-Child darf fortbestehen | kein weiterer Artikellauf |
| `BLOCKED` | explizite Integrity-/Owner-Eskalation, optional Stage-4-Child | menschlich |

Jede Work-Order bindet top-level `reasoning_tier=standard|high|xhigh` und
`execution_receipt{root,path,schema=work_order_execution_receipt.v1}` in ihrer
exakten `work_order_id`. Deterministische und menschliche Work-Orders tragen
`wave_index=null` und erhöhen die LLM-Wellenmetrik nicht. Nach technisch
erfolgreicher terminaler Ausführung schreibt ihr Executor das kleine
Timingreceipt mit Order- und `result_hash`. Dessen `result=PASS` bedeutet nur
Executor-Erfolg und gilt auch bei fachlichem `FAIL|BLOCKED`; ein technischer
Abbruch schreibt kein PASS-Receipt. Fachliche Outputs bleiben separat:
`publication_apply` bindet etwa `content_publish_receipt.v2`, Stage 4 Projektion
plus `stack_sync_receipt.v2`.

### Normalpfad: höchstens sechs LLM-Wellen

Ein kalter Lauf ohne seltenen Framework-Gap besitzt eine feste kritische
Kette:

1. Research und Source-Freeze in derselben LLM-Welle; Linkexport parallel und
   deterministisch;
2. ein Coverageplan;
3. alle fehlenden Source-Extraktions-Slices parallel;
4. bis zu vier disjunkte Source-Facts-Reviews pro erforderlicher Runde
   parallel; reine initiale Low-Risk-Shards `standard`, High-/Full-Risk und
   Erweiterungsrunde `high`;
5. alle Stage-2-/Stage-3-Writer und der optionale Stage-4-Child parallel;
6. alle Publication-Reviews parallel.

Merge, Sampling, Facts-Gate, Compiler, Lint, Release und Publish-Dispatch sind
deterministisch und erzeugen keine LLM-Welle. Ein Resume überspringt jeden
hashidentischen Knoten. Nach bestandenem Facts-Gate liegen damit zwischen
vollständigen Fakten und einem publish-bereiten Artikel im Normalfall nur noch
Writer- und QA-Welle.

## Writer, Compiler und eingefrorener Payload

Ein Writer erhält nur seinen Artikeljob, sein bestandendes Facts-Paket,
sichtbare Quellen und den gewählten Framework-/Stilvertrag. Sein
`article_result.v2` bindet eine echte Execution-ID und den geschriebenen
Dateihash. Writer-, Extractor-, Source-Facts-Reviewer- und
Publication-Reviewer-Identitäten müssen gemäß Rollenvertrag unabhängig sein.

Der Compiler erzeugt anschließend genau einen Review-/Publish-Payload. Die
`validation_receipt.v2` bindet dessen Hash, den QA-Payload, den Render-Snapshot,
die geordneten Quellenrelationen und jede sichtbare Assetdatei samt Bytehash.
Publication-QA liest diese eingefrorenen Bytes. Der `content_release.v2`
übernimmt dieselben Payload-, QA-, Render-, Relations- und Assethashes ohne
Neuassembly; das Publish-Receipt muss genau diese Hashes bestätigen.

Für Stage-3-Magazine liegt das sichtbare Fazit genau einmal im Body;
`conclusion=null` verhindert eine doppelte Persistenz. Stage 2 nutzt seine
eigene, im Framework definierte Fazit-/Payloadrepräsentation.

## Begrenzte Publication-QA

Jeder publizierbare Artikelhash erhält ein vollständiges unabhängiges
`article_publication_review.v2` mit zwei Pässen:

1. Faktentreue, Sicherheit, Unsicherheit und Quellen;
2. Leserführung, People-first SEO und sichtbare Templatewirkung.

Bei blockierenden Befunden erzeugt der Runner eine gebündelte, eng begrenzte
Revision-Work-Order für den Writer. Die Revision erhält einen neuen Hash und
wird neu kompiliert. Danach prüft QA nur Diff, Nachbarabsätze, berührte
Claims/Quellen und sichtbare Folgewirkungen. Höchstens zwei solche gezielten
Revisionen/Rechecks sind zulässig; eine dritte Schleife wird nie begonnen.
Verbleibende Blocker stoppen und eskalieren den Lauf. Eine vollständige
wissenschaftliche Neufreigabe ist nur bei substantieller Claim-, Safety- oder
großer Strukturänderung erforderlich.

Unveränderte Artikel behalten ihre Writer-, Validation- und Review-Receipts.

## `content_release.v2`

Ein Release wird erst erzeugt, wenn jeder enthaltene Artikel:

- ein lockgebundenes `article_result.v2` besitzt;
- einen vollständig rekonstruierten `validation_receipt.v2`-PASS hat;
- ein unabhängiges, hashidentisches Publication-PASS besitzt;
- einen eindeutigen Guard und Zielzustand besitzt;
- exakt gebundene Payload-, Relations- und Assethashes trägt.

`atomic=true` gilt exakt für den D1-Batch aus Artikeln, Quellen-/Ingredient-
Relationen, Originalfacts-basierten Stage-2-Interpretationen und allen
`same_release`-Abhängigkeiten. Das vorherige Source-Katalog- und R2-Asset-
Staging bleibt getrennt, additiv, idempotent und receiptgebunden; eine
serviceübergreifende Transaktion wird nicht behauptet. Ein lokaler Artikeldiff
invalidiert den Release, aber nicht die bestandenen Receipts unveränderter
Artikel.

## Idempotenter Apply und strukturierter Readback

Ein gültiges `content_publish_receipt.v2` enthält pro Artikel genau eines der
Ergebnisse:

- `applied`: der Guard passte und exakt der erwartete Datensatz wurde geändert;
- `already_current`: Zielhash und freigegebener Hash waren bereits identisch,
  daher `0 changed` ohne erneuten Write.

Beide Erfolgswege binden Release-, Payload-, QA-, Render-, Relations- und
Assethashes, Guardresultat, tatsächliche Zielidentität, resultierenden Status
und resultierende Version. `applied` weist den exakten beobachteten Vorgänger
nach; `already_current` weist den bereits vorhandenen freigegebenen
Compiled-Hash nach. Ein fremder Altzustand, unerwarteter Count, Teilapply oder
eine Hashabweichung ist kein `already_current`, sondern ein Blocker.

Create bindet `published_at=modified_at=reviewed_at` der bestandenen
Publication-QA. Nur ein Update benötigt den autoritativen Article-Target-
Prestate: `published_at` bleibt dessen persistiertes `created_at`,
`modified_at=max(reviewed_at,persisted.updated_at,published_at)`. Persistenz und
öffentliche Detail-API müssen die normalisierten ISO-Werte exakt zurückgeben.

Readbacks sind strukturierte, scoped Ergebnisse statt pauschaler PASS-Strings.
Sie belegen den betroffenen Persistenzrecord, `status`, `article_layer`,
`sources_json` v2, Quellen-/Ingredientrelationen, Stage-2-Interpretationen,
öffentliche Detailantwort, UTF-8-Integrität sowie vollständige DOM- und SEO-
Projektion des Zielartikels. Bei `S`/`M` bleibt dieser Vollvergleich auf genau
den korrigierten Artikel begrenzt; unbetroffene Artikel werden nicht gelesen.
Jeder Readback nennt Ziel, geprüfte Felder/Selektoren, erwartete Hashes oder
Werte und das tatsächliche Ergebnis.

Der Renderer-Request enthält top-level sortierte eindeutige positive
`affected_ingredient_ids` und gleich geordnete
`badge_expectations[{ingredient_id,studies_rule,expected_has_studies,dge_rule,
expected_has_dge}]`. Neue Stage-2-Artikel erzwingen `studies_rule=REQUIRE_TRUE`;
ansonsten gilt `PRESERVE` mit Prestate oder `API_DOM_PARITY`. DGE verwendet nur
`PRESERVE` beziehungsweise `API_DOM_PARITY`.

Das separate releaseweite `knowledge_badge_readback.v1` bindet Releasehash,
IDs, Regeln/Erwartungen, den frischen `/api/knowledge`-Status und das hydrierte
`/wissen`-DOM pro Ingredient/Origin sowie `result` und Mismatches. Der Studien-
Badge folgt nur publizierten, akzeptierten `single_study`-Artikeln und ist von
Dosisfeldern unabhängig; der DGE-Badge nur aktiven öffentlich sichtbaren DGE-
Werten. `MISMATCH` ist ein valides Receipt: Artikel bleiben
`published=true/COMPLETE`, der Aggregate-Status wird ohne Rollback oder Writer-/
Publication-QA-Rerun `BLOCKED` mit Technical-/Data-Eskalation. Spätere Prüfung
bleibt auf Overview/API/Cache und ableitende Daten begrenzt.

Roh-HTML/SSR-Prerender, Robots-Policy und Sitemap werden nach dem D1-Commit
genau einmal originweit im selben Publishlauf gelesen. Ist nur diese Delivery
noch nicht live, bleibt der Artikel `published=true`, aber
`seo_live_claim=false` und der Aggregate-Status
`WAITING_FOR_INDEXABILITY_RELEASE`. Dann ist ausschließlich ein humaner
`indexability_release_handoff` für die Site-Policy mit anschließendem frischem
gezieltem Public-Readback zulässig; kein Writer, Rollback, D1-Write oder zweiter
Publish.

Der Runner validiert ein solches Receipt und autorisiert den produktiven Apply
nie implizit. Bei fehlendem Receipt gibt er genau eine deterministische,
guardgebundene `publication_apply`-Work-Order an den zentralen
Maschinen-Dispatcher und bleibt bis zur expliziten Publish-Autorisierung
ehrlich bei `READY_TO_PUBLISH`/`published=false`. Ein vorhandenes ungültiges,
stale oder widersprüchliches Receipt erzeugt keine Apply-Wiederholung, sondern
`BLOCKED` mit menschlicher Integrity-Eskalation.

## Optionale Stage 4

Stage 4 bleibt außerhalb des normalen Artikelpublishes. Evidence-Records
enthalten höchstens eine quellgebundene `stage4_relevance`, niemals die
operative Projektion. Nur ein Run mit `stage4_requested=true` erzeugt nach dem
bestandenen Facts-Gate ein lockgebundenes `facts_package_for_stage4.v2`. Erst
ein separater, expliziter Stack-Sync darf daraus eine standalone
`stack_projection.v2` erzeugen; sie bindet Gate-, Lock-, Paket- und exakte
Record-Hashes. Projektion und atomarer Guard müssen dieselbe eindeutige
`ingredient_id × population_key`-Zielmenge besitzen. Der Child-Branch startet
parallel zu den Writern, kann den Artikelzweig nicht zurückrollen und hat einen
eigenen Status. Nach Artikel-`COMPLETE` bleibt `aggregate_status` bis zu seinem
Receipt `WAITING_FOR_STAGE4` beziehungsweise bei einem terminalen Problem
`BLOCKED`.

## Legacy-Finalizer

`scripts/finalize-publication-batches.mjs` kann alte, ausdrücklich angegebene
Publication-Batches für Diagnose oder Migration lesen. Diese Inputs werden
nicht automatisch erkannt und erteilen keine v2-Freigabe. Ein neuer Stofflauf
verwendet ausschließlich das `nutrient_content_run.v2` und die oben genannte
Kette; stoff- oder kardinalitätsspezifische Finalizer sind verboten.
