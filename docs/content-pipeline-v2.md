# Content-Pipeline v2

## Ziel und Autorität

Diese Pipeline erzeugt aus hashgebundenen Originalquellen möglichst schnell
hochwertige Stage-2-Studienartikel und einen people-first Stage-3-Hauptartikel.
Sie minimiert LLM-Übergaben, wiederholt bestandene Arbeit nicht und hält genau
drei unabhängige Qualitätsgrenzen:

1. Originalquelle → strukturierte Fakten;
2. freigegebene Fakten → sichtbarer Artikel;
3. eingefrorener Artikel → veröffentlichte Darstellung.

[`AGENTS.md`](../AGENTS.md) routet Rollen. Evidenzschemas stehen in
[`Framework 06`](../codex-files/frameworks/06_framework_coverage_source_evidence.md),
der einzige byte-genaue Stage-3-Vertrag in
[`Framework 03`](../codex-files/frameworks/03_framework_hauptartikel.md) und
Artikelqualität im
[`Qualitätsvertrag`](nutrient-content-article-quality-contract.md). Bei
Widerspruch sind Code und Migrationen Runtime-Wahrheit.

## Eine kanonische Runtime-Kette

Aktive Artikeloutputs folgen ausschließlich:

```text
nutrient_content_run.v2
  -> article_result.v2
  -> validation_receipt.v2
  -> article_publication_review.v2
  -> content_release.v2
  -> content_publish_receipt.v2
```

`nutrient_content_run.v2` ist die einzige Zustandsmaschine und besitzt genau
ein Manifest. `nutrient_content_work_order.v2` sind abgeleitete Arbeitsaufträge,
keine konkurrierenden Manifeste. Evidence-Artefakte bilden die in Framework 06
definierte hashgebundene Unterkette. Es gibt keinen universellen
Artefakt-Envelope und keinen freien Erfolgsstatus neben den kanonischen
Receipts.

Das Manifest setzt exakt `operation=full_pipeline|article_correction`.
`full_pipeline` folgt der obigen Kette; `article_correction` verwendet die
proportionalen S/M/L-Verträge und mündet bei Publish in denselben
`content_release.v2 -> content_publish_receipt.v2`-Abschluss.

### Zustände

| Zustand | Einzige noch zulässige Arbeit |
|---|---|
| `WAITING_FOR_CORRECTION` | genau die gebundene Klasse-`M`-Stelle lokal bearbeiten; `S` überspringt diesen Zustand, `L` wechselt in den betroffenen Vollpipeline-Slice |
| `WAITING_FOR_CORRECTION_REVIEW` | genau den M-Diff und seine unmittelbare Nachbarschaft unabhängig kurzprüfen |
| `WAITING_FOR_RESEARCH` | fehlende Research- oder Coverage-Inputs erzeugen |
| `WAITING_FOR_LINK_INVENTORY` | autoritativen read-only DB-/Routen-Readback exportieren und daraus deterministisch das gecachte Link-Inventar bauen |
| `WAITING_FOR_FRAMEWORK` | genau einen gebundenen Framework-Gap bauen, bei rein deklarativem Kandidaten pilotieren/freigeben und guarded aktivieren; danach vollständig neu planen |
| `WAITING_FOR_TECHNICAL_FRAMEWORK_CHANGE` | nur den Framework-Runtime-Gap an einen Menschen übergeben; keine technische Änderung, kein Pilot und keine Aktivierung im Contentlauf |
| `WAITING_FOR_SOURCE_EXTRACTION` | Originalquellen-Shards oder scoped Neuplanung vervollständigen |
| `WAITING_FOR_SOURCE_REVIEW` | deterministisch ausgewählte Facts prüfen und Gate schließen |
| `WAITING_FOR_WRITERS` | alle freigegebenen Stage-2/3-Work-Orders parallel schreiben/korrigieren |
| `WAITING_FOR_PUBLICATION_QA` | frozen Payloads unabhängig prüfen oder gezielt rechecken |
| `WAITING_FOR_INGREDIENT_TARGET` | nur nach bestandenem Artikelgate und explizitem Publish: genau ein bestehendes aktives Ingredient read-only auflösen |
| `WAITING_FOR_SOURCE_CATALOG_SYNC` | nur nach bestandenem Artikelgate und explizitem Publish: Quellen gegen das Ingredient idempotent auflösen/ergänzen; kein Artikelwrite |
| `WAITING_FOR_ASSET_DEPLOYMENT` | nur nach bestandenem Artikelgate und explizitem Publish: tatsächlich gebundene Assets content-addressed und idempotent in R2 stagen; kein Artikelwrite |
| `WAITING_FOR_STAGE4` | nur kombinierter Aggregate-Status: angeforderter Stage-4-Child-Branch wartet auf sein eigenes Receipt |
| `WAITING_FOR_INDEXABILITY_RELEASE` | nur Aggregate-Status nach erfolgreichem Artikelpublish: siteweite Roh-HTML-/SSR-, Robots- oder Sitemap-Delivery ist noch nicht live; keine Artikelarbeit |
| `READY_TO_PUBLISH` | exakt den freigegebenen Release anwenden |
| `COMPLETE` | Release ist validiert und, falls gefordert, mit Readback publiziert |
| `BLOCKED` | begründeter, nicht automatisch behebbarer Fail-closed-Zustand |

`READY_TO_PUBLISH` ist kein Publish-Erfolg. `COMPLETE` mit `published=true`
setzt ein gültiges `content_publish_receipt.v2` voraus.

Ingredient-/Source-Catalog-Auflösung und Asset-Staging sind ausdrücklich
**keine** Start- oder Writerbarriere. Sie beginnen erst nach bestandenem
Publication-Gate und nur bei `manifest.publish.required=true`. Ein Draftlauf
(`false`) erreicht ohne D1-/R2- oder sonstigen persistenten Write seinen
fachlichen Abschluss; fehlendes Netzwerk, D1 oder R2 darf Research, Facts,
Writer und QA nicht blockieren. Bei Publish laufen voneinander unabhängige
Maschinen-Preflights parallel, soweit ihre Datenabhängigkeiten das erlauben.

Indexability ist kein weiterer Preflight: Roh-HTML/SSR-Prerender, `robots` und
Sitemap werden genau einmal im bestehenden Publish-Readback nach dem D1-Commit
als siteweite Delivery-Eigenschaft geprüft. Ist nur diese Delivery noch nicht
live, bleibt der Artikel `published=true`; `seo_live_claim=false` und
`aggregate_status=WAITING_FOR_INDEXABILITY_RELEASE`. Es gibt weder Rollback
noch Writer-/QA-Wiederholung.

`state` beschreibt den Artikelbranch. `stage4.status` beschreibt unabhängig
`NOT_REQUESTED|WAITING|PASS|BLOCKED|BLOCKED_INTEGRITY`; erst
`aggregate_status` kombiniert beide. Nach fertigem Artikel darf daher
`state=COMPLETE` und gleichzeitig `aggregate_status=WAITING_FOR_STAGE4` gelten.
`success_claimed=true` verlangt den erfolgreichen Abschluss aller
angeforderten Branches. Ein Stage-4-Blocker ändert weder Artikelreceipt noch
bereits bestandenen Publish.

### State → Work-Order → Output

Jeder externe Schritt ist in dieser Matrix auflösbar. Ein Zustand darf keine
hier nicht genannte Phantomrolle starten; mehrere disjunkte Orders derselben
Zeile laufen parallel.

| Artikel-/Aggregate-Zustand | Work-Order-Kind | `execution_class` / ausführende Rolle | Verbindlicher Output | Nächste Grenze |
|---|---|---|---|---|
| `WAITING_FOR_CORRECTION` | `article_correction` | `llm` / `article-correction-editor` | `article_correction_result.v1`, exakt an Input/Patch/issued Order gebunden | unabhängiger Kurzreview |
| `WAITING_FOR_CORRECTION_REVIEW` | `article_correction_review` | `llm` / `article-correction-reviewer` | `article_correction_review.v1` mit vier lokalen Checks | Release oder L-Eskalation |
| `WAITING_FOR_RESEARCH` | `research` | `llm` / `nutrient-research-analyst` | opaque Researchbytes, eingefrorene Originalbytes, `research_source_artifact_receipt.v2` | Coverage |
| `WAITING_FOR_RESEARCH` | `research_source_freeze` nur bei vorhandenen Legacy-/Resume-Researchbytes | `llm` / `nutrient-research-analyst` | eingefrorene Originalbytes und Source-Receipt, kein zweites Inventar | Coverage |
| `WAITING_FOR_RESEARCH` | `coverage_planning` | `llm` / `coverage-planner` | vollständiger `coverage_plan.v2`; bei scoped Link-/Konfliktänderung bleiben unbetroffene Artikelknoten bytegleich | Framework-/Evidence-Preflight |
| `WAITING_FOR_LINK_INVENTORY` oder parallel zu fehlendem Research | `link_inventory_source_readback` | `deterministic` / `deterministic-link-inventory-exporter` | `site_link_inventory_source.v2`; die Runtime baut daraus den Cache | Coverage |
| `WAITING_FOR_FRAMEWORK` | `framework_design` | `llm` / `article-framework-designer` | Kandidat und Katalogkandidat für genau einen Gap; nur bei `technical_change_paths=[]` zusätzlich drei reale Einzelpilotreceipts aus derselben runnerausgegebenen Fixture, deren Composite der Runner baut | technischer Handoff, Owner-Gate oder Aktivierung |
| `WAITING_FOR_TECHNICAL_FRAMEWORK_CHANGE` | `framework_runtime_change_handoff` | `human` / `framework-runtime-change-owner` | kein Contentartefakt; hashgebundene Übergabe an einen separat autorisierten Entwicklungs-/Test-/Technikreview-Auftrag | neuer Contentlauf nach geänderten Runtimebytes oder weiterhin wartend |
| `WAITING_FOR_FRAMEWORK` und `owner_approval_required=true` | `framework_owner_approval` | `human` / `framework-owner-approver` | separates `framework_owner_approval_receipt.v1` für exakt gebundene Kandidaten-, Katalog- und Pilothashes | Aktivierung |
| `WAITING_FOR_FRAMEWORK` nach allen Pflichtgates | `framework_catalog_activate` | `deterministic` / `deterministic-framework-catalog-activator` | `framework_catalog_activation_receipt.v1` mit altem/neuem Kataloghash, Target-absent- und Atomizitätsnachweis | vollständige Coverage-Neuplanung |
| `WAITING_FOR_SOURCE_EXTRACTION` | `source_extraction` | `llm` / `source-evidence-extractor` | ein `source_evidence_shard.v2` je disjunktem Slice | deterministischer Merge/Sampling |
| `WAITING_FOR_SOURCE_EXTRACTION` nach Facts-FAIL | `source_extraction_repair` | `llm` / `source-evidence-extractor` | einmalig reparierter `source_evidence_shard.v2` nur für den gebundenen Failure-Scope, unbetroffene Obligations bytegleich | Merge und invalidierter Facts-Scope |
| `WAITING_FOR_SOURCE_REVIEW` | `source_facts_review` | `llm` / `source-facts-reviewer` | `source_facts_review.v2` für den eingefrorenen Review-Scope | Facts-Gate/Packager |
| `WAITING_FOR_WRITERS` | `writer` | `llm` / `clinical-study-interpreter` oder `german-health-science-writer` | Markdown, `article_result.v2`, optional genau ein Asset plus `article_asset.v2` | Compiler |
| `WAITING_FOR_WRITERS` | `writer_repair` | `llm` / betroffener Writer | derselbe Artikeloutput für genau einen gebundenen Fehlerfingerprint | Compiler-Retry oder terminaler Blocker |
| `WAITING_FOR_WRITERS` | `writer_revision` | `llm` / betroffener Writer | revisioniertes Markdown/Receipt nur für gebündelte Publication-Findings | Compiler und gezielter Recheck |
| `WAITING_FOR_PUBLICATION_QA` | `publication_qa` | `llm` / stabiler Rollenwert `article-reader-acceptance-reviewer` | `article_publication_review.v2` mit zwei Pässen in einem Aufruf | Release oder scoped Revision |
| `WAITING_FOR_INGREDIENT_TARGET` | `ingredient_target_readback` | `deterministic` / `deterministic-ingredient-target-resolver` | `ingredient_target_receipt.v1` für exakt ein bestehendes, aktives, versioniertes Ingredient | Source-Auflösung |
| `WAITING_FOR_SOURCE_CATALOG_SYNC` | `source_catalog_sync` | `deterministic` / `deterministic-source-catalog-sync` | `source_resolution_receipt.v1` für exakt alle geplanten Quellen; nur explizit autorisierte additive/idempotente Writes | Releasebau |
| `WAITING_FOR_ASSET_DEPLOYMENT` | `asset_stage` | `deterministic` / `deterministic-article-asset-stager` | `asset_deployment_receipt.v1` mit content-addressed R2-Staging und exaktem Byte-/MIME-/Maß-Readback | Releasebau |
| Child-Status `WAITING`, parallel ab Writerbarriere | `stage4_stack_sync` | `llm` / `stage4-stack-sync` | `stack_projection.v2` und `stack_sync_receipt.v2` | Child `PASS|BLOCKED` |
| `READY_TO_PUBLISH` | `publication_apply` | `deterministic` / `deterministic-content-publication-executor` | `content_publish_receipt.v2` mit Apply/Already-current und Readback | Artikel `COMPLETE` |
| `WAITING_FOR_INDEXABILITY_RELEASE` | `indexability_release_handoff` | `human` / `site-indexability-release-owner` | kein Contentartefakt; an Release/Publish-Receipt gebundener Infrastruktur-Handoff für originweite Robots-/Site-Policy und danach frischen gezielten Public-Readback | Delivery bestätigt oder weiterhin wartend |
| `BLOCKED` oder `BLOCKED_INTEGRITY` | `*_escalation` | `human` / `content-pipeline-escalation-owner` | explizite menschliche Entscheidung; kein erfundenes PASS-Receipt | neuer autorisierter Auftrag oder terminal |
| `COMPLETE` | keine | – | vorhandene hashgebundene Receipts | keine weitere Arbeit |

Der stabile Runtime-Rollenwert des Publication-Gates bleibt zur
Receipt-Kompatibilität `article-reader-acceptance-reviewer`; seine einzige aktive
Definition ist `AGENT_publication_quality_reviewer.md`. Der
`content-pipeline-escalation-owner`, `framework-owner-approver` und
`site-indexability-release-owner` sind Menschen, keine fehlenden
Agentendateien.

### Interne deterministische Knoten ohne Agent

Folgende Schritte erzeugen absichtlich keine eigene Work-Order und keine
LLM-Welle: Linkinventar-Normalisierung; Evidence-Buildmanifest; Shard-Merge;
Risiko- und Stichprobenauswahl; Facts-/Coverage-Gates; Stage-2/3/4-Packager und
Evidence-Lock; Compiler/Lint; Stage-3-React-Snapshot beziehungsweise Stage-2-
Deterministic-Projection; pro
`renderer_style_hash` gecachtes Browser-Styleattest; Releasebau;
Receiptvalidierung; Status- und Metrikschreiben. Es gibt insbesondere keinen
Evidence-Coordinator, SEO-Agenten, Template-Agenten, Orchestrator-Rereviewer
oder LLM-Publisher.

Auch der post-publish Roh-HTML-/SSR-, Robots- und Sitemap-Readback ist Teil des
einen `publication_apply`; `WAITING_FOR_INDEXABILITY_RELEASE` emittiert keine
Content-/LLM-Work-Order. Es darf ausschließlich den humanen
`indexability_release_handoff` für die fehlende originweite Robots-/Site-
Policy-Freigabe ausgeben. Dieser Handoff ändert keine Artikelbytes, führt
keinen D1-Write und keinen zweiten Publish aus; nach der Infrastrukturänderung
ist nur ein frischer gezielter Public-Readback zulässig.

### Ein Maschinen-Dispatcher

Stage 0 bleibt eine interne Runnerfunktion ohne Work-Order oder Receipt.
Externe deterministische Arbeit läuft ausschließlich über
`scripts/lib/nutrient-content-machine-dispatcher.mjs`:

```text
scripts/export-site-link-inventory.mjs
scripts/apply-content-release.mjs
scripts/dispatch-nutrient-content-machines.mjs
```

Der Dispatcher lädt die aktuell ausgegebene Order aus der append-only Historie
und verlangt die exakte `work_order_id`. Er routet insbesondere
`link_inventory_source_readback`, `ingredient_target_readback`,
`source_catalog_sync`, `asset_stage`, `framework_catalog_activate` und
`publication_apply`; weder ein Agentenname noch ein frei angegebener Pfad darf
einen Maschinenwrite autorisieren. Stage 0 selbst dispatcht, publiziert und
aktiviert nichts.

## Run-, Pfad- und Rollenregeln

Das Run-Manifest bindet Run-ID, Stoff, Sprache, Policy-Version,
`render_profile`, Research-/Coverage-/Evidence-Pfade, Artikelplan,
Write-Guards, Output-Root und Publishziel. Die Runtime:

- löst jeden Pfad nur innerhalb des erlaubten Run- oder Repository-Roots auf;
- verwirft Traversal, unsichere IDs, Pfadkollisionen sowie Input-/Output-
  Überschreibung;
- entfernt oder schreibt nie außerhalb des gebundenen Roots;
- akzeptiert Facts-Pakete nur am exakten Pfad aus
  `evidence_pipeline_lock.v2`, mit Byte- und Inhaltshash;
- vergleicht Ausführungsidentitäten maschinell: Extractor ≠ Facts-Reviewer,
  Writer ≠ Facts-Reviewer, Writer ≠ Publication-Reviewer und Facts-Reviewer ≠
  Publication-Reviewer.

Ein Rollenname allein beweist keine Unabhängigkeit. Jede relevante
Execution-ID steht im nachfolgenden Receipt.

### Statische Rechtsgrenze statt Legal-Standardwelle

Writer und Publication-QA wenden dieselbe feste Grenze an: In kommerziellem
Kontext dürfen nährwert- und gesundheitsbezogene Aussagen nur im Rahmen der
[Verordnung (EG) Nr. 1924/2006](https://eur-lex.europa.eu/legal-content/DE/TXT/?uri=CELEX:32006R1924)
und der konkreten Bedingungen des
[EU-Registers](https://food.ec.europa.eu/food-safety/labelling-and-nutrition/nutrition-and-health-claims/eu-register-health-claims_en)
erscheinen; eine Studieninterpretation wird nie zum Produktclaim umgedeutet.
Irreführende Wirkungs-/Sicherheitsangaben sowie Krankheitsprävention,
Behandlung oder Heilung bleiben nach den statischen Grenzen insbesondere aus
HWG, LFGB und UWG verboten. Ist der kommerzielle Zweck einer Affiliate-
Verknüpfung nicht unmittelbar erkennbar, muss er nach
[§ 5a Abs. 4 UWG](https://www.gesetze-im-internet.de/uwg_2004/__5a.html)
sichtbar kenntlich sein.

Das erzeugt keinen siebten Standardagenten. Nur ein konkreter nicht eindeutig
auflösbarer Rechtsbefund oder ausdrücklicher Owner-Auftrag blockiert den
betroffenen Artikel für einen separat autorisierten Legal-Review; unbetroffene
Artikel und bestandene Gates bleiben bestehen.

### Vollständige Work-Orders statt implizitem Kontext

Jeder LLM-Aufruf sowie jeder externe Maschinen- oder Human-Schritt wird aus
genau einer oder mehreren kompatiblen `nutrient_content_work_order.v2`
ausgeführt. Jede Order bindet `kind`, Ausführungsklasse, Reasoning-Tier,
LLM-Welle,
Rolle, Stoff und Sprache, einen positiven disjunkten Scope, alle Inputs mit
erlaubtem Pfad/Byte-/Inhaltshash, gültig wiederverwendete Sources, bei
Planung das aktuelle Vollinventar beziehungsweise bei Text nur den im Facts-
Paket gebundenen `selected_link_slice`, eindeutige Outputs und sämtliche
Constraints. Framework- und Styledateien stehen mit tatsächlichem
Repositorypfad und Datei-Bytehash in der Order; ein Versionsstring allein ist
kein Inputnachweis.

Der gemeinsame Body lautet exakt:

```text
schema, run_id, kind, execution_class, reasoning_tier, wave_index, reason,
substance{slug,language},
scope{mode,source_ids,cluster_ids,obligation_ids,article_ids},
assignee{role,independent_from_ids}, inputs[], reused_sources[],
link_inventory, outputs[], task{}, constraints{},
execution_receipt{root,path,schema}, work_order_id
```

`execution_class` ist exakt `llm|deterministic|human`.
`reasoning_tier=standard|high|xhigh` ist top-level Teil des vollständigen
Work-Order-Hashes. Die Runtime setzt das rollenbasierte Minimum und akzeptiert
nur ein Upgrade: `standard` für Research/Freeze, initiale Extraktion, reine
Low-Risk-Facts-Stichproben, M-Korrektur/-Kurzreview und deterministische Arbeit;
der humane Site-Indexability-Handoff bleibt ebenfalls `standard`.
`high` für Coverage, Extraktionsrepair, High-/Full-Risk-Facts-Review, die
erweiterte Reviewrunde, Writer/Revision/Repair, Publication-QA, Stage 4 und
Owner-Freigabe; `xhigh`
nur für echte Framework-/Runtime-Gaps oder ausdrücklich eskalierte wiederholte
materielle Konflikte. Gebundene Risikosignale dürfen ein Minimum erhöhen, nie
senken. Executor und Agent ändern es nicht; Modellnamen sind keine
Vertragsdaten. Nur `llm` erhält einen positiven `wave_index`, sonst ist er
`null`. `scope.mode` ist
`run|sources|obligations|articles`; ID-Arrays sind sortiert
und eindeutig. Inputbindungen tragen `name`, `root=run|repo`, `path`,
`byte_hash`, `content_hash`, `schema`; bei opaken Bytes sind beide Hashes
identisch und `schema=null`. Reused-Sources tragen dieselbe Byte-/
Inhaltshashbindung plus Source-ID. `link_inventory` ist nur bei
`coverage_planning` Pflicht und bindet das vollständige deterministisch erzeugte
`site_link_inventory.v2`; bei Writer, QA und allen anderen Orders ist es
`null`. Diese erhalten ausschließlich den artikelbezogenen Link-Slice im
Facts-Paket. Outputbindungen tragen `name`, `root`, `path`,
`schema`, `media_type`, wobei genau eines der letzten beiden Felder gesetzt
ist. Kind-spezifische Auswahl, Revision, Findings und Recheckscope stehen in
`task`; die Execution-ID entsteht erst im Output.

Jede Work-Order bindet top-level genau
`execution_receipt{root=run,path,schema=work_order_execution_receipt.v1}`.
Diese Bindung gehört zum vollständigen Work-Order-Hash. Nach technisch
erfolgreich abgeschlossener terminaler Ausführung schreibt ausschließlich der
Executor an diesem Pfad genau ein
`work_order_execution_receipt.v1` mit `run_id`, exakter `work_order_id`,
`execution_class`, `reasoning_tier`, echter `executor{role,id}`, `started_at`,
`finished_at`, `result=PASS`, dem Hash des fachlichen Resultats als
`result_hash` und eigenem `content_hash`. `result=PASS` bezeichnet hier nur den
Executor-Erfolg: `result_hash` bindet das fachliche Outputartefakt auch dann,
wenn dessen Urteil `FAIL|BLOCKED` lautet. Ein technischer Abbruch schreibt kein
PASS-Receipt. Das kleine Receipt belegt nur Ausführung und Timing: Es enthält
keine Fakten, Entscheidung, Findings oder Payload und ersetzt weder einen
fachlichen Output aus `outputs[]` noch dessen eigenes Fach-/
Publikationsreceipt.

`work_order_id` ist der SHA-256 des vollständigen kanonischen Bodys ohne das
ID-Feld. Der Hash umfasst deshalb auch Reuse-Liste, Outputpfade, Findings,
serverseitigen Diffscope und Revision. Parallel ausführbare Orders haben
disjunkte fachliche Scopes und kollisionsfreie Outputs; Batch-Orders sind nur
bei gleichem Typ/Framework zulässig, während jedes Artikelreceipt separat
bleibt. Veraltete Inputs oder Reviews führen zu einer neuen kleinen Work-Order,
nicht zu einem Pfad-Override oder einer pauschalen Vollwiederholung.

Erstmals ausgegebene Orders werden append-only als
`nutrient_content_work_order_event.v2` in
`state_dir/work-orders-history.v2.jsonl` gesichert. Run, Manifest,
Ausgabezeit, vollständige Order und `event_hash` erlauben später den exakten
Receipt-Abgleich auch dann, wenn die aktuelle Statusdatei schon eine neue Welle
zeigt.

### Per-article Lineage

Der globale Evidence-Lock bezeugt die Run-Vollständigkeit, ist aber kein
pauschaler Artikel-Cachekey. Pro Artikel bindet ein stabiler
`article_lineage_hash` den artikelbezogenen Plan samt Cluster-, Pflicht-,
Record- und Source-Lineage. Daraus bindet `evidence_membership_hash`
Artikel-ID/Stage, tatsächliches Framework, Policy und Validator. Paketbytes und
globaler Lock werden getrennt bezeugt und gehören nicht selbstreferenziell in
diesen Cachekey. Nur eine Änderung der Mitgliedschaft oder eines
artikel-eigenen Inputs invalidiert Writer, Compiler und QA; ein neu erzeugter
globaler Lock oder geänderter Geschwisterartikel allein tut das nicht.

## Ablauf im Normalfall

### 0. Reuse-Preflight

Stage 0 ist ausschließlich eine deterministische Runnerfunktion, kein Agent
und keine Work-Order. Sie prüft aus Manifest, Artefaktbindungen und Status IDs,
Root-Containment, Kollisionen, Framework-/Policy-Versionen, Originalbytes,
Locks und Hashes, ohne Prompts oder Volltexte zu öffnen. Ein deterministischer
Maschinenauftrag erzeugt parallel zur Recherche aus
`inputs.link_inventory_source_path` genau
`state_dir/preflight/site-link-inventory.v2.json`. Quelle ist ausschließlich
der autoritative read-only DB-/Routen-Readback; der Output wird nach dessen
Bytes gecacht und nie von einem LLM zusammengestellt. Neue Maschinenexports
binden pro Route Pfad, Slug, sichtbaren Titel, den aus der persistierten
SEO-Projektion gelesenen `meta_title`, die dortige `meta_description`,
`article_layer` und die geordneten
`knowledge_article_sources.url` als `source_urls[]`. Legacy-Inputs ohne
technischen Meta-Titel, Description, Layer oder Source-URLs dürfen weder Produktions-Eindeutigkeit noch einen live
wiederverwendeten Stage-2-Carrier vortäuschen; die Runtime setzt in diesem Fall
`WAITING_FOR_LINK_INVENTORY` und fordert den Maschinenexport neu an. Ein alter
Coverage-Plan ohne die aktive Stage-2-Source-Assignment-Policy wird nicht
wiederverwendet, sondern vollständig neu geplant.

Fehlt dieser Source-Input, lautet der Zustand `WAITING_FOR_LINK_INVENTORY` und
die einzige Zusatzarbeit ist `link_inventory_source_readback` durch
`deterministic-link-inventory-exporter`. Es startet weder Planung noch eine
weitere Agentenwelle mit erfundenen Routen.

Hashidentische bestandene Knoten werden wiederverwendet. Geänderte Inputs
invalidieren nur ihre Nachfolger. Erst der Runner-Dispatcher leitet aus dem
Preflight-Ergebnis die im aktuellen Zustand fehlenden Work-Orders ab. Stage 0
selbst dispatcht nicht, baut keine zweite Checkliste, wiederholt kein
Specialist-Gate und zählt weder als Agenten- noch als LLM-Welle.

### 1. Quellenradar in einer Welle

Stage 1 sucht Behörden-/Referenzwertquellen, relevante Leitlinien,
systematische Reviews, zentrale Primärstudien sowie Sicherheits-,
Interaktions- und Vulnerable-Groups-Quellen parallel. Stoffrelevant umfasst
das auch Mangel-/Statusmarker oder Nicht-Essenzialität, Übermaß/Überdosierung
sowie Formen/Bioverfügbarkeit und Nahrungs-/Supplementquellen. Sie
dedupliziert über
DOI/PMID/kanonische URL, prüft Version, Korrektur/Retraktion, Zugriff und
Original-Locator und schreibt genau eine semantische strict-UTF8-Datei am
gebundenen Researchpfad. Markdown oder JSON sind zulässig; die Runtime behandelt
die Bytes opaque und verlangt weder Schema noch Envelope. Im selben Aufruf
friert Stage 1 jede ausgewählte operative Originalquelle unverändert unter dem
gebundenen Artifact-Root ein und erzeugt genau ein
`research_source_artifact_receipt.v2` mit `run_id`, `research_hash`,
`artifact_root`, sortierten
`sources[{source_id,path,byte_hash,content_type,locator}]` und `content_hash`.
Das Receipt ist nur Maschinenlineage, kein zweites Analyseinventar.

Eine deterministische Priorisierung darf in der einen semantischen Datei
nachvollziehbar dokumentiert werden; es entsteht kein zweites Score-Artefakt.
Artikel, Snippets und Sekundärseiten sind ausschließlich Wegweiser zur
Originalquelle. Typischer operativer Umfang: sechs bis zehn Quellen. Eine
ausgewählte Meta-Analyse, ein systematischer oder Umbrella-Review zieht jedoch
alle eindeutig identifizierbaren unmittelbar eingeschlossenen Evidenzeinheiten
als `meta_constituent`-Sources nach: bei Meta-Analysen/systematischen Reviews
die Primärstudien, bei Umbrella-Reviews die eingeschlossenen Reviews und nur
bei vollständig publizierter Zuordnung zusätzlich deren Primärstudien. Eine
nicht veröffentlichte verschachtelte Liste wird nicht rekursiv erfunden; die
ermittelte Menge wird nicht auf zehn gekürzt. Für jede
ausgewählte Source hält das Inventar `author_or_institution`, berichtetes
`publication_year` oder `null`, `title`, `journal_or_publisher`, DOI/PMID und
Originallokator bereit; fehlende bibliografische Werte werden nicht erfunden.
Dasselbe Inventar erfasst die gängigsten materiellen öffentlichen Annahmen als
neutrale Behauptung plus prüfbare Leserfrage. Such- und FAQ-Muster sind dabei
nur Discovery-Signale; die wissenschaftliche Antwort und jede quantifizierte
Verbreitungsbehauptung benötigen weiterhin freigegebene Originalquellen.

### 1.5 Coverage, Kontroverse und Blueprint

Stage 1.5 erhält die opaque Researchbytes samt Bytehash, Framework-Katalog und
das hashgebundene Source-Artifact-Receipt sowie eine hashgebundene Liste
bestehender Seitenthemen, Slugs, Titel-/Description-Werte und interner
Linkziele. In einem Durchgang legt
sie fest:

- erforderliche/ausgelassene Cluster und echte Leserfragen;
- je Stoff eine explizite Relevanzentscheidung zu (a) Mangel,
  Versorgungsstatus und Statusmarkern beziehungsweise Nicht-Essenzialität,
  (b) Übermaß, Überdosierung und Obergrenzen sowie (c) Formen,
  Bioverfügbarkeit und belastbaren Nahrungs-/Supplementquellen; nur
  Materielles erzeugt Cluster/Pflichten, nie Pflicht-Leerblöcke;
- materielle Kontroversen als separate Objekte;
- je geplantem Stage-3-Artikel einen `common_assumption_review`: identifizierte
  Checks binden Annahme, Leserfrage, Discovery-Begründung sowie Source-,
  Cluster- und Obligation-IDs; ein begründetes `none_identified` bleibt ohne
  Füllannahmen zulässig;
- für jede akzeptierte, aussagekräftige Source standardmäßig genau einen
  Stage-2-Carrier; eine gemeinsame Zuordnung nur bei nachgewiesener direkter
  Forschungslinie oder als Meta-Analyse/-Review mit eingeschlossenen
  Einzelstudien;
- je Stage-2-Artikel ein hashgebundenes
  `source_assignment{mode,anchor_source_id,relations[]}` unter
  `stage2_source_assignment_policy=one_meaningful_source_per_stage2.v1`;
- je Stage-2-Artikel ein `source_presentation_label_de` mit dem deutschen Titel
  der Anker-Originalquelle unter
  `stage3_source_label_policy=german_original_title.v1`; dasselbe Label ist
  bytegleich Stage-2-H1 und sichtbarer interner Stage-3-Quellenname;
- Wiederverwendung vorhandener Supporting-Inhalte nur dann als Source-Carrier,
  wenn das Live-Ziel als `article_layer=single_study` bestätigt ist;
- Stage-2-Frameworks und homogene Writer-Batches von zwei bis vier Artikeln;
- einen adaptiven Stage-3-Blueprint;
- pro Stage-2-/Stage-3-Artikel genau einen People-first-SEO-Brief mit
  `primary_intent`, `reader_question`, `reader_promise`,
  `primary_topic_phrase`, drei bis sechs `secondary_questions`,
  `cannibalization_note` und `internal_link_targets` sowie den exakt
  mengengleichen, nach Pfad sortierten
  `selected_link_slice{links[],slice_hash}`; jeder Link bindet `path`, `title`,
  `target_id` und `target_state=live|same_release`, bei `same_release`
  zusätzlich `target_article_id`;
- artikelbezogene Source-IDs samt kanonischen bibliografischen Feldern,
  Originallokator und deterministischem bytegleichem Label
  `<Autor/Institution> (<YYYY|o. J.>). <Titel>. <Journal/Publisher>.[ DOI:
  <doi>.][ PMID: <pmid>.]`, aus denen der Packager die sichtbaren Quellen
  ableitet, und bei Stage 3 eine Grafikentscheidung mit
  `mode=none|generate`, Begründung sowie bei `generate` tragenden
  `cluster_ids` und `obligation_ids`;
- jede Extraktionspflicht pro Source × Cluster × erwartetem Claim-Typ samt
  Zielartikeln und planseitigem Risiko.

`single_source` ist der Normalfall. `direct_research_line` ist ausschließlich
für Replikationen, unmittelbare Follow-ups oder konkret population-, dosis-,
methoden-, outcome- bzw. versionsbezogene Erweiterungen zulässig.
`meta_analysis_family` bindet eine Meta-Analyse, einen systematischen oder
Umbrella-Review als Anker und die von ihr unmittelbar eingeschlossenen
Evidenzeinheiten als `meta_constituent`; für diese eingeschlossenen Quellen
entstehen keine eigenen
Stage-2-Artikel. Der Meta-Anker besitzt den Carrier; Konstituenten bleiben
nicht besitzende sichtbare Originalzitate. Eine nachweislich in mehreren
ausgewählten Meta-Analysen eingeschlossene Primärstudie darf deshalb in deren
Stage-2-Quellenlisten mehrfach erscheinen, wird aber weder selbst zur
Stage-3-Source noch erhält sie einen separaten Carrier. Gleiche Suchintention, Themenähnlichkeit, korrelierende
Ergebnisse oder ein kleinerer Artikelsatz sind keine Gruppierungsgründe.

Jede Stage-3-Source – bei Meta-Familien der Anker, nicht deren Konstituenten – wird genau einmal über
`selected_link_slice.links[].covered_source_ids` einem internen Stage-2-Ziel
zugeordnet. Bei `same_release` muss dieses Ziel ein geplanter Stage-2-Artikel
sein; bei einem im Run geplanten Carrier muss exakt dieser Artikel das Ziel
sein und `link.title` dessen `source_presentation_label_de` entsprechen. Geplante Stage-2-Carrier-Anker sowie Sources direkter
Forschungslinien dürfen nicht außerhalb der vereinigten Stage-3-Source-Menge
liegen. Die nicht besitzenden Meta-Konstituenten bleiben ausschließlich in den
sichtbaren Stage-2-Originallinks. Bei `live` bestätigt das autoritative Linkinventar
`article_layer=single_study`; zusätzlich müssen dessen autoritative
`source_urls[]` über normalisierte DOI-, PMID- oder Canonical-/Originallokator-
Identität exakt beidseitig zu den `covered_source_ids` passen. Die externen
Originallinks erscheinen erst im Stage-2-Artikel.

Normalfall ist `reuse` eines bestehenden Frameworks. Optionale Stage-3-Blöcke
dürfen stoffgerecht entfallen, heißen oder angeordnet sein. Nur wenn kein
approved Fit existiert, bindet `framework_gaps[]` Artikel/Stage, Entscheidung,
Grund, Ziel-ID/-Version/-Pfad und Approvalbedarf. Diese `target_*`-Felder sind
die vorgeschlagene neue Identität. `adapt_existing` bindet zudem die
Legacy-Felder `candidate_framework_id`/-`version`; sie meinen ausschließlich
das approved Basisframework, das die Runtime samt Pfad/Bytehash als
`base_framework` auflöst, nie den vorgeschlagenen Kandidaten. Der Artikel
bleibt blockiert und
die Runtime setzt `WAITING_FOR_FRAMEWORK`. `adapt_existing` erzeugt eine
versionierte Revision als Kandidat; `new_archetype` setzt bereits im Gap
`owner_approval_required=true`. Der Designer schreibt ausschließlich unter
`framework-candidates/<gap_id>/`. Der Runner gibt
`framework_pilot_fixture.v1` mit Ziel, Basis, Katalog- und Runtimehashes aus.
Für Stage 3 bleiben `contract_id=render_profile=knowledge_magazine_v1` sowie
kanonischer Framework-03-Pfad/-Bytehash zwingend. Jede Kandidatenabweichung
muss nichtleere technische Pfade deklarieren und in den externen Handoff; der
Content-Activator darf keine zweite Scaffolddatei aktivieren.
Der Katalogkandidat bindet Work-Order, Fixture,
`technical_change_paths[]` und deren exakte Baseline. Nur bei leerer Liste
dürfen echte Compiler-, Render- und Publication-Piloten reale Toolausführung,
dieselbe Fixture, Output, Log und spezifische Checks binden; ihren Composite
baut der Runner deterministisch.

Bei nichtleerer Liste entstehen weder Pilot noch Technikreview im Contentlauf:
Er stoppt unter `WAITING_FOR_TECHNICAL_FRAMEWORK_CHANGE` und gibt nur
`framework_runtime_change_handoff` an einen Menschen aus. Ein separat
autorisierter Entwicklungsauftrag muss Implementierung, Tests und unabhängigen
Technikreview erledigen. Danach erzwingen neue Runtime-/Frontendhashes einen
neuen Contentlauf mit neuem Kandidaten, neuer Fixture und neuen Piloten; alte
Belege dürfen nicht fortgesetzt werden. Falls erforderlich folgt erst nach dem
deklarativen Composite ein separates menschliches
`framework_owner_approval_receipt.v1`. Erst
`framework_catalog_activate` vergleicht den alten Kataloghash, verlangt ein
noch freies Ziel und aktiviert atomar ohne Überschreiben. Danach plant Stage 1.5
mit neuem Kataloghash vollständig neu; ein neuer Stoff allein ist kein
Framework-Gap. Weitere Gaps werden erst aus diesem neuen Plan bearbeitet, damit
kein Kandidat gegen einen veralteten Kataloghash aktiviert wird.

`live`-Links müssen im autoritativen Inventar existieren; source-tragende
Live-Ziele müssen dort `article_layer=single_study` sowie exakt passende
`source_urls[]` ausweisen. `same_release` zeigt
auf einen anderen geplanten Artikel desselben Runs; Slug und
`/wissen/<slug>`-Pfad müssen exakt passen. Diese Kanten werden später als
`internal_link_dependencies` übernommen und erzwingen einen gemeinsamen
atomaren Release. Writer und QA sehen weiterhin nur den Slice, nie das
Vollinventar. Der deterministische Compiler darf das Inventar ausschließlich
als aktuellen Link-/SEO-Uniqueness-Index lesen; der Slice bleibt seine einzige
Link-Whitelist.

Output ist genau ein `coverage_plan.v2`, die erste strukturierte
Runtime-Grenze; sein `research_hash` bindet die unveränderten Researchbytes.
Technischer Title, Meta-Description, Canonical, Robots, JSON-LD und SEO-Hash
sind kein Planoutput. Ein später neu
erkannter materieller Konflikt erzeugt eine auf betroffene Quellen, Cluster,
Pflichten, Kontroversen und Artikel begrenzte `coverage_planning`-Work-Order
mit erneut vollständigem Plan und neuem Hash. Ein separates Plan-Delta ist
kein aktiver Output; unbetroffene IDs und per-article Lineages bleiben stabil.
Jede materielle Kontroverse bleibt unabhängig von ihrer Darstellung High Risk.

### 2. Originalquellenextraktion

Nicht überlappende Sources werden bis zur verfügbaren Concurrency parallel
extrahiert. Sie lesen ausschließlich die bereits in Stage 1 eingefrorenen,
receiptgebundenen Originalbytes; ein erneuter Download ist verboten. Jede
Pflicht endet als `extracted`, `not_reported` oder `blocked`.
Records tragen stabile Subject-/Predicate-Keys, Kontext, optionales Conflict-
Set, Zahl/Einheit, Unsicherheit und präzisen Locator. Artikeltext ist niemals
Quelle. Der deterministische Merger erzeugt das eine
`source_evidence_bundle.v2`, ohne Claims umzuschreiben.

Evidence-Records, Shards und Bundle enthalten keine operative
`stack_projection.v2`. Bei explizitem Stage-4-Auftrag ist höchstens
`stage4_relevance.status=candidate` mit quellengedeckter Begründung und Locator
zulässig. Stackrolle, Auswahl/Default, Sichtbarkeit und Lifecycle werden in der
Extraktion nicht entschieden.

`blocked` schließt das Gate. `not_reported` ist ein nachprüfbares Ergebnis und
wird im Review wie ein High-Risk-Fall behandelt; es darf nicht durch eine
erfundene Null oder Vermutung ersetzt werden. Es beendet seine Pflicht
terminal, liefert aber keinen positiven Record und deckt deshalb allein nie
einen Pflichtcluster. Fehlt anderweitige Recorddeckung, bleibt der betroffene
Artikel blockiert oder wird scoped neu geplant.

Das rein technische `evidence_pipeline_build.v2` wird vor der Extraktion
deterministisch aus Coverage, Source-Artifact-Receipt, sicheren Pfadregeln und
`C=4` gebaut und gecacht. Es trifft keine redaktionelle Entscheidung und
erzeugt weder Coordinator-Agent noch zusätzliche LLM-Welle.

### 3. Risikobasiertes Facts-Gate

Die Runtime leitet effektives Risiko aus Pflichtstatus, planseitigen
Risikosignalen, Claim-Typ, Cluster, Referenzwert/UL, Sicherheit,
Interaktionen, vulnerablen Gruppen, materiellen Kontroversen,
`stage4_relevance.status=candidate` und Warnungen ab. Freie Tags dürfen
ausschließlich eskalieren. Gewöhnliche Studienzahlen und Einheiten werden
vollständig deterministisch validiert, lösen allein aber kein Full Review aus.

- High Risk einschließlich `not_reported`: vollständige Prüfung.
- Low Risk mit `extractor_quality_sha256_v3` je Extractor: 20 %, mindestens
  drei beziehungsweise bei kleinerem Scope alle, höchstens zehn,
  reproduzierbar per SHA-256-Rang. Cluster und Source-Typ bleiben im
  Rankmaterial/Manifest, erzeugen aber keine eigenen Mindestquoten.
- Fehler in einer Stichprobe: genau diesen Extractor-Scope einmal vollständig
  prüfen.

Bei dieser einen Erweiterung enthält das neue `selected[]` nur das bisher
ungeprüfte Delta. Bestandene Einheiten werden nicht nochmals geprüft, sondern
als `carried_forward[]` mit `obligation_id`, `prior_review_id`,
`prior_review_hash`, `prior_sample_manifest_hash` und `mode` hashgebunden
übernommen. Ein weiterer Fehler blockiert; es gibt keine dritte Auswahlrunde.

Der Runner friert Auswahl und Bindungen in `source_facts_review_input.v2` ein.
Pro `sampling_round=0|1` partitioniert er den ungeprüften Scope in höchstens
vier disjunkte `source_facts_review_slices[]` mit eindeutigem `shard_id` und
Outputpfad. Die bis zu vier unabhängigen Reviewer laufen parallel und müssen in
derselben Runde verschiedene `reviewer.id` tragen. Jeder prüft direkt gegen die
Originalstelle und erzeugt genau einen `source_facts_review.v2`-Shard; keiner
ändert Records. Das Gate bleibt geschlossen, bis alle ausgewählten Pflichten/
Records exakt bestanden, alle aktiven Pflichten terminal, alle erforderlichen
Cluster gedeckt und alle Rollenbindungen gültig sind.

Reine initiale Low-Risk-Shards laufen `reasoning_tier=standard`; Full-/High-
Risk-Auswahl und `sampling_round=1` laufen `high`. Sind beide Klassen in einer
Runde vertreten und mindestens zwei Shards möglich, trennt die Runtime sie
tierhomogen. Ein unvermeidbar gemischter einzelner Shard erhält das höhere
Tier. So hebt eine einzelne risikoreiche Einheit nicht alle parallelen
Low-Risk-Reviewer unnötig an.

Ein fachlicher Facts-FAIL erzeugt statt eines Review-Pingpongs genau einmal je
betroffenen Extraktionsslice `source_extraction_repair` mit `high`. Diese Order
bindet Vorgängershard, Failure-Fingerprint und fehlgeschlagene Reviews, arbeitet
nur auf den `failed_obligation_ids` gegen eingefrorene Originalbytes und muss
alle unbetroffenen Obligations bytegleich erhalten. Der ersetzte Shard trägt
`repair_lineage` für die exakte Work-Order und `repair_generation=1`; danach
werden nur Merge und invalidierter Facts-Scope wiederholt. Ein erneuter
unabhängiger FAIL wird `REPAIR_EXHAUSTED` und blockiert ohne zweite
Repairgeneration.

Danach erzeugt der Packager je geplantem Artikel ein lockgebundenes
`facts_package_for_stage2.v2` oder `facts_package_for_stage3.v2`. Das Stage-3-
Paket enthält zwingend Blueprint, alle erforderlichen Cluster, Kontroversen,
SEO-Brief, `selected_link_slice`, sichtbare Quellen und Grafikentscheidung.
Stage-2-Pakete enthalten denselben People-first-SEO-Brief und ausschließlich
ihren `selected_link_slice`. Bei
`generate` löst ausschließlich der Packager die planseitigen Cluster-/
Obligation-IDs in die exakten bestandenen `record_ids` auf; der Planner
erfindet keine Record-IDs.

Jedes Paket bindet `facts_reviewer_ids` als vollständige Reviewer-ID-Menge des
globalen Gates und `direct_facts_reviewer_ids` als direkte Teilmenge für seinen
Artikelscope. Bei akzeptierter Low-Risk-Stichprobe darf
`direct_facts_reviewer_ids=[]` sein; das ist kein Grund für ein zusätzliches
Artikelreview.

Jedes Artikelpaket trägt `package_content_hash` für die vollständigen
Paketbytes im Lock und einen stabilen `article_package_hash` aus Artikel-ID,
Stage und `evidence_membership_hash`. Writer, Compiler und Review verwenden
letzteren als artikel-lokalen `facts_package_hash`; ein veränderter fremder
Paketslice invalidiert den Artikel dadurch nicht.

Nur bei `stage4_requested=true` erzeugt der deterministische Packager nach dem
bestandenen Gate und vor dem finalen Lock ein
`facts_package_for_stage4.v2`. Es bindet Run, Coverage, Bundle, Gate und die
vollständig geprüften Stage-4-Kandidatenfakten, aber weder Evidence-Lock noch
operative Stackentscheidung. Der anschließend erzeugte
`evidence_pipeline_lock.v2` bindet Pfad, Bytes und Inhaltshash des Pakets.
Er bindet außerdem Katalog sowie tatsächlich gelesene Framework-/Stildateien
mit Pfad und Bytehash.

Erst wenn sämtliche geplanten Artikelgates und Writerpakete bestanden und im
finalen `evidence_pipeline_lock.v2` gebunden sind, setzt die Runtime genau
einmal das run-weite `writers_ready=true`. Bei angefordertem Stage 4 bindet
derselbe Lock zusätzlich das Stage-4-Paket. Dieses Paket fügt kein eigenes
LLM-Gate hinzu; `writers_ready` wird weiterhin ausschließlich aus
Artikelgates abgeleitet. Stage 2/3 warten auf keinen Stage-4-LLM-Schritt.

### 4. Stage 2 und Stage 3 parallel

Nach `writers_ready` starten alle Stage-2-Batches und Stage 3 parallel.
Stage-3-Start vor vollständiger Freigabe aller Blueprintcluster ist verboten.

Stage 2 verarbeitet bevorzugt zwei bis vier homogene Work-Orders pro Aufruf.
Jeder Artikel bleibt eine eigene sichtbare Markdown-Datei mit eigenem
`article_result.v2`. Technische Metadatenblöcke, Abschlussstatus, Importhinweise
oder Batchindex sind im Markdown verboten. Der Writer beantwortet den
gebundenen SEO-Brief natürlich, setzt nur freigegebene interne Links und hält
verwendete Source-IDs, sichtbare Quellen und Paketquellen exakt in Parität.
Das Stage-2-Paket bindet außerdem das planseitige `source_assignment`; bei
einer direkten Forschungslinie erklärt der Artikel die gebundene Entwicklung,
bei `meta_analysis_family` die Meta-Ebene samt eingeschlossenen Studien.

Stage 3 erhält ausschließlich sein vollständiges Facts-Paket und folgt dem
kataloggebundenen kanonischen `knowledge_magazine_v1`-Scaffold, aktuell
Framework 03@2.0.3. Die katalogisierte Variante steuert nur Inhaltsrouting und
darf das Scaffold nicht kopieren oder überschreiben. Magnesium und Vitamin A
dienen nur als Lesbarkeitsreferenzen. Der Artikel beantwortet Leserfragen früh,
erklärt Fachbegriffe unmittelbar, integriert Supporting-Fakten und Links und
beantwortet jeden im Facts-Paket gebundenen Annahmencheck genau einmal anhand
seines aufgelösten Evidenzslices. Ohne Prävalenzrecord formuliert er keine
unbelegte Mehrheit. Er erzeugt keine separate SEO-Datei. Das
kataloggebundene Magazin-Scaffold bleibt
die einzige byte-genaue Strukturwahrheit; Framework- und Stilinput werden über ihre
tatsächlichen Datei-Bytes gebunden. Standardinputs sind Framework,
Stilannotation und Snapshot-Manifest. Die beiden manifestgebundenen
Vollreferenzen werden beim Lock validiert, aber nicht in jeden Prompt kopiert;
Writer öffnen sie nur bei einer konkreten, mit der Annotation nicht lösbaren
Stilfrage.

Grafikstandard ist `none`. Bei `generate` wird höchstens eine geplante Grafik
im selben Lauf erzeugt und direkt eingebunden. `article_asset.v2` bindet
exakt `asset_id`, Artikel/Index/Pfad, `asset_byte_hash`, MIME, `width`,
`height`, `alt`, Caption, `position{index,markdown_offset}`, vom Packager
aufgelöste `record_ids`, `creator{role,id,writer_execution_id}`,
`work_order_id`, Zeitpunkt und `content_hash`. Creator, Execution und Order
entsprechen exakt demselben Stage-3-Writerreceipt. Der Creator-Rollenwert
`article-graphic-generator` ist nur ein Funktionslabel im Writerjob, keine
eigene Work-Order oder Pipelinewelle. Briefings, Prompts und Platzhalter sind
kein Artikelinhalt.

Das vollständige `article_result.v2` bindet `execution_id`, Artikel, Stage,
Slug, `writer{role,id}`, Zeitpunkt, Revision `0..2`, `work_order_id`,
Markdownpfad/-Bytehash, Facts-Paket, `evidence_membership_hash`,
`framework{framework_id,version,variant,path,byte_hash}` samt
`framework_hash`, verwendete Record-/Source-/Asset-IDs, Policy,
`render_profile`, `previous_review_id`, `previous_compiled_payload_hash` und
`content_hash`. Revision 0 setzt beide `previous_*`-Felder auf `null`; spätere
Revisionen binden den unmittelbaren Vorgänger. Der Reviewhash steckt im
vollständigen revisionierten Work-Order-Hash und ist kein zusätzliches
Receiptfeld.

Dabei entspricht `article_result.facts_package_hash` exakt dem stabilen
`facts_package.article_package_hash`. Work-Order und Evidence-Lock binden das
vollständige Paket zusätzlich mit Pfad, Bytehash und `package_content_hash`.

### 5. Ein Compilerlauf pro eingefrorenem Hash

Der Compiler validiert striktes UTF-8, Markdownvertrag, tatsächliche
Framework-/Stildatei, den ausgewählten Link-Slice, Assets, Facts-/Lockbindung und Rollenreceipt. Er
verlangt exakte Parität von verwendeten Source-IDs, sichtbaren Quellen und
Quellenrelationen, expandiert Quellen/Assets genau einmal und baut die eine
sichtbare Payload. Technischer Title und Meta-Description werden jetzt – und
nicht im SEO-Brief – aus dem finalen Artikel abgeleitet.
Sichtbare Zahlen-/Einheiten-Tokens müssen aus dem strukturierten Wert, dem
Claim oder einem freigegebenen Stringfeld des gebundenen Fact-Kontexts stammen;
andere Artikel- oder externe Eingaben erweitern diese Allowlist nicht.

Der sichtbare H1 beziehungsweise `publish_payload.title` bleibt dabei
unverändert. Nur der technische `meta_title` wird nach NFC- und
Whitespace-Normalisierung bei mehr als 70 Zeichen deterministisch an der
letzten nutzbaren Wortgrenze gekürzt und mit `…` abgeschlossen; nur wenn bis
dahin keine nutzbare Wortgrenze existiert, greift ein harter 69-Zeichen-
Fallback. Der Compiler erzeugt genau ein `seo`-Objekt mit `meta_title`,
`meta_description`, `primary_intent`, `internal_link_targets`,
`canonical_url`, `canonical_path`, `robots=index,follow`, `indexable=true`,
Article-`json_ld`, `validated_checks` und `seo_hash`. Der Hash bindet die
öffentliche Teilprojektion aus Meta-Titel/-Description, Canonical-URL/-Pfad,
Robots, Indexierbarkeit und JSON-LD. Deterministisch geprüft werden striktes
UTF-8, Eindeutigkeit von Titel/Description im Release und gegen Live-Seiten,
inhaltsproportionale Längen, exakte Canonical-Route, Indexierbarkeit/Robots und
gültiges Article-JSON-LD. Es gibt keine Keyworddichte und kein LLM-SEO-Gate.
Die öffentliche SEO-Teilprojektion wird getrennt vom sichtbaren H1/Dek in
`knowledge_articles.seo_json` persistiert, von der Detail-API ausgeliefert und
von Hydration sowie Roh-HTML-Prerender bytegleich für Meta-Tags und JSON-LD
verwendet. Legacy-Zeilen ohne diese Projektion fallen auf Titel und Summary
zurück.

Die exakte Zuordnung der reservierten Stage-3-H2 zu Controls sowie die
deterministische `food_grid|data_table`-Klassifikation stehen ausschließlich in
Framework 03; Pipeline und Reviewer kopieren oder interpretieren sie nicht neu.

`visible_payload_hash` ist exakt der SHA-256 über die kanonische
Serialisierung von:

```text
title + dek + ordered visible AST + headings + tables + links + conclusion
+ expanded sources + assets
```

Der Compiler erzeugt genau ein `compiled_article.v2`; darin stehen die frozen
Publish-Payload, sichtbare AST, Quellenrelationen, Assets, SEO, Renderdaten und
genau ein `qa_payload` mit `schema=article_qa_payload.v2`. Publication-QA bindet
dieses Artefakt als Input `compiled_article`; `task` enthält nur dessen
`qa_payload_hash`, keine Payloadkopie. Daneben entsteht
`validation_receipt.v2`. Stage 3 führt den echten React-Rendernachweis aus:

```text
node frontend/render-knowledge-magazine-snapshot.mjs --input <article-render-request.v2.json> [--out <article-render-snapshot.v2.json>]
```

Der Request bindet `schema: article_render_request.v2`, Artikel-ID, Route
`/wissen/<slug>`, `article_byte_hash`, `visible_payload_hash`, den kanonischen
`payload_hash` des eingefrorenen Publish-Payloads und `publish_payload` mit
`schema: article_visible_payload.v2`, Slug, Title, Dek, Body, Conclusion und
Sources; Ingredients und Prüfdatum sind optional. Zusätzlich baut der Compiler
unabhängig vom Renderer genau eine `expected_projection` mit
`schema=article_render_projection.v2` und bindet sie durch `projection_hash`.
Sie enthält Artikel/Route/Template, H1/Dek, den sichtbaren `ui`-Vertrag,
geordnete Sections samt stabiler ID, `kind`, optionalem `control_type`, Heading,
Nummer, normalisiertem Text, Links, Tabellen inklusive
`presentation=data_table|food_grid` und Assets, TOC, Fazit und geordnete
Quellen. Für Stage 3 rendert der Renderer die echte `KnowledgeMagazineArticle`
mit `renderToStaticMarkup`, `StaticRouter` und JSDOM. Eine zweite Template- oder
Markdown-Snapshot-Implementierung ist verboten.

Stage 2 verwendet denselben Request-/Snapshot-Schemarand mit
`mode=deterministic-study-projection`, `template=study_article_v2` und
`contract_version=deterministic-study-projection.v2`. Die unabhängige
Compilerprojektion und die vollständige `actual_projection` enthalten H1/Dek,
UI-Vertrag, alle geordneten Content-/Fazit-/Quellenabschnitte, Links, Tabellen
und Assets und sind kanonisch identisch; Request und Snapshot binden den
aktuellen `route_fingerprint`. Dafür startet keine zweite Browserwelle. Dieser
Pre-Publish-Check wird nicht als React-Render ausgegeben: die echte Stage-2-
Route muss im finalen öffentlichen DOM-Projektionsreadback vollständig der
Releaseprojektion entsprechen.

Output ist in beiden Zweigen `schema: article_render_snapshot.v2` mit
`request_hash`, Renderer-/Contractversion, Lineage-Hashes, `html_hash`,
`dom_hash`, vollständiger `actual_projection`, `projection_checks`, Checks,
stabilen Fehlercodes, `result` und `content_hash`. Stage 3 enthält zusätzlich
`structure_hash`, `actual_projection_hash` und die detaillierten realen
DOM-Werte. PASS verlangt kanonisch exakte Projektionsgleichheit,
`result=PASS`, `errors=[]` und nur bestandene Checks. `compiled_payload_hash`
ist nur optional, wenn der Snapshot nicht Teil seines eigenen Hashmaterials
ist. Beim Stage-3-CLI bedeutet Exitcode 0 PASS, 1 strukturellen FAIL mit
Snapshot, 2 ungültigen Input/Usage und 3 internen Rendererfehler.

Layout/CSS wird separat im echten Browser durch
`renderer_style_validation.v2` mit Validator
`knowledge-magazine-route-browser-contract.v2.2.0` bezeugt. Das Receipt bindet
`renderer_style_hash`, `fixture_hash`, den damit identischen
`route_fingerprint`, dessen vollständige Datei-/Versionsbestandteile, den
hydrierten `route_contract`, Browser/Viewport, Checks, Errors, Result und
Inhaltshash. Es enthält keine Artikel- oder Snapshot-Hashes. Es läuft nicht pro
Artikel, sondern genau einmal pro unverändertem
`{validator_version,renderer_style_hash,fixture_hash}` und wird dann gecacht.
Stage-3-QA und Executor scheitern geschlossen bei jedem Mismatch oder
Nicht-0-Exit.
Bei identischem Artikelinput und unverändertem Route-/Fixture-Fingerprint
werden Snapshot, Styleattest und Receipt wiederverwendet.

Vor jedem Cachehit gleicht der Compiler die im Artikel-Slice ausgewählten
`live`-Routen gegen das aktuelle autoritative Vollinventar,
`same_release`-Ziele gegen den aktuellen Runplan und den aus allen fremden
Live-Routen normalisierten Titel-/Description-Uniqueness-Hash ab. Entfernte
oder umbenannte Ziele erzeugen eine auf die betroffenen Artikel begrenzte
Coverage-Neuplanung; eine fremde Route invalidiert einen Artikel nur, wenn ihr
neuer Titel oder ihre Description tatsächlich mit dessen SEO-Projektion
kollidiert. Ohne ausgewählte Linkwirkung oder SEO-Kollision invalidiert eine
neue oder geänderte fremde Route weder Writer noch Compiler oder QA. Sichtbare
`/wissen/`-Links außerhalb des Slices sind
Compilerfehler.

Ein deterministischer Compiler- oder Assetfehler erzeugt keinen freien
Writerloop. Alle im selben Compilerlauf ko-beobachteten Findings werden
normalisiert, sortiert und als ein `bundled_findings`-Paket mit genau einem
zusammengesetzten Fingerprint in denselben kleinstmöglichen Reparaturauftrag
gegeben; ein Auftrag je Einzelfinding ist verboten. Pro
`(article_id,revision,failure_fingerprint)` ist genau ein Auftrag zulässig. Ein
zweiter unterschiedlicher Fingerprint darf nur für einen nach der ersten
Reparatur neu beobachteten Fehlerbund entstehen, nie für ein zuvor schon
bekanntes Geschwisterfinding. Derselbe verbleibende Fehler oder ein dritter
unterschiedlicher Fingerprint endet `BLOCKED`, ohne Stofflauf oder globalen
Rereview.

### 6. Ein unabhängiges Publication-Gate

Der Publication-Reviewer erhält ausschließlich eine `publication_qa`-
Work-Order. Sie bindet `compiled_article.v2` samt einmaligem QA-Payload,
Validation-Receipt, Writerreceipt, Facts-Paket, Assets, Renderrequest/-snapshot,
`projection_hash` und tatsächliche Frameworkdatei jeweils mit erlaubtem Pfad,
Byte- und Inhaltshash. Stage 3 bindet zusätzlich das gecachte
`renderer_style_validation.v2` sowie Stilannotation/-Manifest; die
Vollreferenzen werden nur bei konkreter Stilunklarheit manifestgebunden
geöffnet. Das Styleattest bindet den Frontend-Routenfingerprint, die kanonische
Fixture und den hydrierten Route-/UI-Zustand. Stage 2 bindet stattdessen den
vollständigen `deterministic-study-projection.v2`-Snapshot samt
Route-Fingerprint; sein echter öffentlicher DOM-Nachweis folgt erst im
Publish-Readback. Ein leerer oder nur aus Überschriften gebauter Snapshot reicht
nicht.
Er führt pro Artikelhash zwei getrennte Prüfpässe aus, liefert aber nur eine
gebündelte Feedbackrunde:

- Pass A: Fakten, Zahlen/Einheiten, Sicherheit, Unsicherheit,
  Quellenzuordnung und Blueprint-Coverage;
- Pass B: Lesbarkeit, Leserlogik, Struktur, SEO-Nutzen, Template- und
  Renderwirkung.

Die drei Leserfragen sind genau:

1. Q1: Würde ein fachfremder Leser den Artikel gern lesen und verstehen?
   Erwartet: `Ja`.
2. Q2: Ist der Artikel klar, interessant, relevant und sicher eingeordnet?
   Erwartet: `Ja`.
3. Q3: Ist sichtbare System-, Prompt-, Prüf- oder Metasprache enthalten?
   Erwartet: `Nein`.

Findings verwenden ausschließlich `blocking_facts`, `blocking_reader` oder
`polish`. Jedes Finding enthält exakt `category`, `pass=A|B`, `location`,
`target`, `record_ids`, `minimal_scope`, `code` und `message`; Fundstelle und
Zielzustand müssen prüfbar und `minimal_scope` ein konkreter nichtleerer String
sein. Output ist genau ein
`article_publication_review.v2` mit `review_type=full|targeted_recheck`.
Es bindet die tatsächlich ausgegebene `work_order_id`; die Runtime verifiziert
daran Kind, Artikel/Revision, QA-/Renderhash, Writer-Execution, Kerninputs,
Outputpfad und den vollständigen Unabhängigkeitsscope.

`result=PASS` ist ausschließlich bei beiden Pässen PASS, ohne blockierendes
Finding und den Antworten `Ja`/`Ja`/`Nein` zulässig. Ein FAIL enthält die
tatsächlich festgestellten Q1–Q3-Antworten und mindestens ein blockierendes
Finding; es darf die Antworten nicht auf den PASS-Sollwert normalisieren.

Bei Blockern geht eine einzige gebündelte Rückmeldung an den Writer. Für jede
Revision erzeugt die Runtime eine neue Work-Order, die vorigen Reviewhash,
Findings, `diff_hash`, serverseitigen `recheck_scope` mit `changed_lines`,
`neighbour_paragraphs`, `touched_claims`, `touched_sources`, `touched_assets`
und `visible_side_effects`, neue Inputs und Outputs vollständig in ihrer ID
bindet. Bei `review_type=targeted_recheck` heißen die zusätzlichen Inputs
`previous_publication_review`, `previous_compiled_article` und für jedes
gebundene Asset paarweise `asset_<n>` plus `asset_receipt_<n>`. `task` bindet
`previous_review_hash`, `previous_findings_hash`, `allowed_finding_keys`,
`asset_bindings` und `required_scoped_passes=["A","B"]`.

Der Reviewer prüft nur Diff, benannte Nachbarabsätze, berührte Claims/Quellen/
Assets und abhängige sichtbare Wirkung; Scope und Finding-Keys werden nicht
frei erweitert. Beide Receipt-Pässe
`passes.facts_safety_sources` und `passes.reader_seo_template` bleiben
vorhanden und tragen beim Recheck ihren `scope_hash`. Höchstens zwei Rechecks,
also Revisionen `0..2`, sind zulässig; ein verbleibender Blocker endet
`BLOCKED`. Ein Review für veraltete Bytes wird verworfen und durch eine neue
aktuelle Work-Order ersetzt. Der Orchestrator wiederholt oder rereviewt das
Publication-Gate nicht.

### 7. Release, Publish und Readback

Erst nach allen bestandenen Artikelgates und nur für einen expliziten Publish
läuft der late-bound Maschinen-Preflight. `ingredient_target_readback` liest
ohne Mutation exakt ein bestehendes aktives Ingredient anhand kanonischem Namen
und optional erwarteter ID und erzeugt `ingredient_target_receipt.v1` mit ID,
Name, Slug, Status, Version und `identity_hash`. Fehlend, inaktiv oder mehrdeutig
ergibt `WAITING_FOR_INGREDIENT_TARGET`; ein Ingredient wird nie implizit
angelegt.

Parallel dazu erzeugt die Runtime nur bei tatsächlich gebundenen Assets einen
`asset_deployment_request.v1`. Die deterministische `asset_stage`-Order unter
`WAITING_FOR_ASSET_DEPLOYMENT` staged sie content-addressed und idempotent in
R2. `asset_deployment_receipt.v1` bindet Run, Request, Work-Order,
Artikel-/Assetidentität, lokale Bytes, MIME, Maße, den deterministisch
abgeleiteten R2-Key `knowledge/<canonical-slug>/<sha256>.(png|jpg)`, die einzige
öffentliche URL gemäß
`^/api/r2/knowledge/<canonical-slug>/[a-f0-9]{64}\.(png|jpg)$` und deren exakten
öffentlichen GET-Readback von Bytes, MIME und Maßen. Der schlanke
`article_asset.v2` des Writers führt nur den run-relativen `asset_path`, weder
R2-Key noch URL. Ohne Asset gibt es weder Order noch Receipt.

Nach aufgelöstem Ingredient baut die Runtime aus den bereits freigegebenen
Coverage-Sources genau
ein `source_catalog_sync_request.v1`. `source_catalog_sync` löst pro lokaler
Source über Ingredient-ID plus DOI, PMID oder kanonische URL genau einen
autoritativen `ingredient_research_sources.id` auf und darf fehlende Zeilen nur
bei expliziter Publish-Autorisierung additiv/idempotent ergänzen. Identifier-
Konflikt, Cross-Ingredient-Treffer oder Mehrdeutigkeit scheitern geschlossen.
`source_resolution_receipt.v1` bindet Request-/Ingredienthash und die
vollständige lokale→numerische Mappingmenge samt Auflösungsart, persistierter
Version und Hash. Dieser Preflight schreibt keinen Artikel und wird bei
`publish.required=false` vollständig übersprungen.

Jede Source bindet dabei `author_or_institution`, `publication_year` als
Integer oder `null`, `title`, `journal_or_publisher`, normalisierte DOI/PMID,
unveränderte Originallokator-URL und normalisierte Canonical-URL. `label` muss
bytegleich der Runtimeprojektion
`<Autor/Institution> (<YYYY|o. J.>). <Titel>. <Journal/Publisher>.[ DOI:
<doi>.][ PMID: <pmid>.]` sein. Writer und Publisher formatieren es nicht.

Es gibt keine behauptete serviceübergreifende Transaktion über R2,
Source-Katalog und Artikel-D1. Source-/Asset-Staging ist versioniert,
idempotent, additiv und receiptgebunden. Erst der anschließende D1-Batch für
Artikel, Quellen-/Ingredient-Relationen, Stage-2-Interpretationen und alle
`same_release`-Artikel ist atomar. Ein späterer Fail darf daher höchstens
harmlose unreferenzierte staged Assets oder Sourcezeilen hinterlassen, niemals
einen halben Artikel oder eine halbe Relationsmenge.

Der deterministische Packager nimmt ausschließlich bestandene, hashidentische
Artikel in genau ein `content_release.v2` auf. Es bindet frozen Payload,
Validation, Publication-Review, Facts-Paket, Relations, Assets, Zielidentität
und Write-Guard. Bei Publish bindet es zusätzlich Ingredient-Target- und
Source-Resolution-Receipt; Stage-2-Interpretationen verwenden ausschließlich
deren numerische IDs. `atomic=true` bezeichnet ausschließlich den eigentlichen
Artikel-/Relationen-/Interpretations-D1-Batch samt `same_release`, nicht die
vorigen Stagingservices. Jeder Artikel bindet
`internal_link_dependencies`, vollständige `expected_projection` samt
`projection_hash` und das vollständige Compiler-`seo`-Objekt samt `seo_hash`.
Jede `same_release`-Abhängigkeit muss auf einen anderen Artikel desselben Releases
zeigen. Der Executor transformiert nichts: keine neue Assembly, Umformatierung,
Quellenexpansion, Fazitverschiebung oder Assetersetzung.

Ein Full-Pipeline-Release darf optional `retire_articles[]` enthalten. Jedes
Ziel bindet exakt `article_id`, `slug`, `expected_status=published`,
`expected_version`, `expected_payload_hash`, `desired_status=draft` und das
Publishziel. Retirement-IDs/-Slugs sind untereinander eindeutig und dürfen
mit keinem aktiven Releaseartikel kollidieren. Dieselbe autoritative
`article_target_receipt.v1`-Lineage bindet Updates und Retirements. Im atomaren
D1-Batch ändert ein Retirement nur Status und Version; Artikelbytes,
Zeitstempel, Quellen-, Ingredient- und Interpretationsrelationen bleiben
unverändert. Es gibt keine separate D1-Schreibroute außerhalb
`publication_apply`.

Publikationszeiten werden ausschließlich beim Releasebau gebunden. Create setzt
`published_at=modified_at=reviewed_at` der bestandenen Publication-QA. Nur ein
Update liest dafür den autoritativen Article-Target-Prestate:
`published_at=persisted.created_at` und
`modified_at=max(reviewed_at,persisted.updated_at,published_at)`, jeweils als
normalisiertes ISO-Datum. Persistenz und öffentliche Detail-API müssen diese
Werte exakt zurückgeben; Writer und Publication-QA erzeugen sie nicht.

`sources_json` speichert exakt die stage-spezifische
`knowledge_article_sources_projection.v2` aus Facts-Paket-/Relationshash und
Ingredient-IDs. Stage 2 projiziert die geordneten externen
Originalquellenrelationen mit kanonischem bibliografischem Label und
Originallokator. Stage 3 projiziert ausschließlich die geordneten internen
Stage-2-Carrier mit bytegleichem deutschem `source_presentation_label_de` und
gebundener `/wissen/...`-Route. D1-Relationstabelle, öffentliche API und
sichtbare Quellen müssen für die jeweilige Stage dieselben IDs, Labels und URLs
in derselben Reihenfolge reproduzieren. `knowledge_article_ingredients`
enthält exakt die Release-Ingredientmenge.

Nur Stage 2 schreibt pro sichtbarer Source eine
`stage2_interpretation_projection` mit `status=accepted`, Ingredient-ID,
lokaler/aufgelöster Source-ID, Artikel-Slug und
`study_interpretation_summary.v1`. Dessen Record-IDs und Facts stammen exakt
aus dem bestandenen Originalquellen-Faktenpaket, nie aus Artikelprosa. Create,
Update und Already-current binden `status` und `article_layer`; ungebundene
Legacyfelder für Hero, Dosis und Produktnote bleiben `null`, Stage-3-Fazit und
-Asset existieren nur in ihrer kanonischen Body-/Assetprojektion.

`publication_apply` ist keine Agenten- oder LLM-Welle. Nur bei explizitem
`manifest.publish.required=true` und gültigem Write-Guard führt der deterministische
Maschinenexecutor über den zentralen Dispatcher den Release als einen atomaren,
idempotenten Batch aus:

- `applied`: exakt eine geänderte Artikelzeile;
- `already_current`: exakt null geänderte Artikelzeilen und der zuvor gelesene
  `compiled_payload_hash` entspricht bereits exakt dem Releaseartikel.

`content_publish_receipt.v2` enthält pro Artikel tatsächliche statt bloßer
PASS-Werte und unter `article_results[]` exakt
`result=applied|already_current`: Guardmodus, erwartete/beobachtete
Vorversion/-status/-hash,
Changed-Row-Count, resultierende Version/Status/Payloadhash, erwartete und
tatsächliche Relations-/Assethashes sowie konkrete targeted/public
Readbackwerte. Jeder publizierte Artikel bindet konkrete vollständige DOM-
Projektions- und öffentliche SEO-Werte; bei `S`/`M` bleibt nur das LLM-Review
lokal, der eine Maschinenreadback umfasst ausschließlich den Zielartikel.
Snapshot-, Payload- und Livewerte müssen dieselbe Lineage bezeugen. Ein
unerwarteter Count, Hash, Guard, Asset- oder Readbackwert blockiert den
Abschluss.

`retirement_results[]` bindet analog `applied|already_current`, beobachteten
Vorzustand, resultierenden `draft`-Status und exakt `expected_version+1`.
`already_current` ist nur zulässig, wenn sich aus dem aktuellen unveränderten
Payload mit dem gebundenen Vorgängerstatus exakt `expected_payload_hash`
rekonstruieren lässt. Der öffentliche Negativ-Readback bindet den HTTP-404-
Status der Detail-API,
Overview-API und `/wissen`; der Retirement-Slug darf nirgends mehr öffentlich
ausgeliefert beziehungsweise gelistet sein. Ein Mismatch löst den vorhandenen
kompensierenden Snapshot-Rollback aus, der bei Retirement Status und Version
exakt wiederherstellt.

Der öffentliche DOM-Readback schreibt unter
`readbacks.dom.actual.projection` die vollständig beobachtete Projektion und
unter `readbacks.dom.actual.projection_hash` ihren Hash. Der kanonische
Vergleich mit der Releaseprojektion muss TOC, Sections, Links, Quellen,
Controls, UI, Tabellen und Assets vollständig abdecken. Der SEO-Readback
vergleicht die gesamte öffentliche SEO-Projektion und den `seo_hash`.
Stichprobenfelder oder bloße `PASS`-Strings ersetzen keinen dieser Vergleiche.

Der Renderer-Request bindet top-level sortierte eindeutige positive
`affected_ingredient_ids` und gleich geordnete
`badge_expectations[{ingredient_id,studies_rule,expected_has_studies,dge_rule,
expected_has_dge}]`. Für jede Ingredient-ID mit neu publiziertem Stage-2-
Artikel gilt `studies_rule=REQUIRE_TRUE` und `expected_has_studies=true`; sonst
gilt mit gebundenem Prestate `PRESERVE`, ohne Prestate `API_DOM_PARITY`. Für DGE
ist nur `PRESERVE` mit Prestate oder sonst `API_DOM_PARITY` zulässig; Parity-
Erwartungswerte sind `null`.

Genau ein releaseweites `knowledge_badge_readback.v1` bindet Releasehash, IDs,
Regeln/Erwartungen und pro Ingredient/Origin den frischen API-Status aus
`/api/knowledge` sowie das hydrierte DOM unter `/wissen`, dazu `result` und
Mismatches. `Studien` wird ausschließlich aus publizierten, akzeptierten
`single_study`-Artikeln abgeleitet und ist unabhängig von Dosisfeldern; `DGE`
nur aus aktiven öffentlich sichtbaren DGE-Werten. Ein Badge-`MISMATCH` ist ein
valides Receipt und kein Executor-Crash: Die artikelbezogenen Readbacks bleiben
`MATCH`, korrekt committe Artikelbranches bleiben `published=true/COMPLETE`,
aber der Aggregate-Status wird `BLOCKED` mit Technical-/Data-Eskalation. Es gibt
keinen Rollback, keinen Writer-/Publication-QA-Rerun und kein Aggregate-
`COMPLETE`; ein späterer Repair ist auf Overview/API/Cache und ableitende Daten
begrenzt.

Roh-HTML/SSR-Prerender, `robots` und Sitemap sind davon getrennte siteweite
SEO-Delivery-Eigenschaften. `publication_apply` erhebt sie nach dem D1-Commit
genau einmal im selben öffentlichen Lauf. Ein Zustand
`CLIENT_RENDERED_ONLY`, `NOT_INCLUDED`, `NOT_AVAILABLE` oder
`BLOCKED_BY_SITE_POLICY` lässt einen in Persistenz, API, DOM und SEO-
Teilprojektion exakten Artikel `published=true`, setzt aber
`seo_live_claim=false` und
`aggregate_status=WAITING_FOR_INDEXABILITY_RELEASE`. Er rollt den Artikel nicht
zurück, startet keinen Writer und wird ausschließlich durch einen separaten
Site-Technik-/SEO-Deploy geschlossen. Ein echter Content-, DOM- oder SEO-
Projektionsmismatch bleibt dagegen fail-closed und wird kompensierend
zurückgerollt.

Nur ein vollständig fehlendes Receipt löst `publication_apply` aus. Ein
vorhandenes malformed, manipuliertes oder veraltetes Receipt sowie jeder
Guard-/Readback-Mismatch endet ohne automatischen Retry `BLOCKED` und geht als
konkreter Befund an den menschlichen Owner.

## Bestehende Artikel: S/M/L-Fast-Lanes

Jede Korrektur setzt `manifest.operation=article_correction`. Vor der
Zuweisung friert die Runtime Original-, Kandidaten- und Patchbytes in
`article_correction_input_receipt.v1` ein und klassifiziert; bei Unsicherheit
gilt die höhere Klasse.

| Klasse | Erlaubter Scope | Minimalweg | Zielzeit |
|---|---|---|---|
| `S` | nachweislich semantikfreie Repräsentation: Wrapper, Whitespace, identisches Encoding, exakte nichtsemantische Dublette | kein LLM: deterministischer Diff-/Bedeutungsgleichheitscheck, direkt `content_release.v2`, optional guarded Publish plus ein Vollprojektions-/SEO-Readback nur des Zielartikels | 3–8 min |
| `M` | lokale Formulierung/Tippfehler ohne Fach-, Quellen-, Struktur- oder Metadatenwirkung | genau `article_correction` → `article_correction_result.v1`, unabhängig `article_correction_review` → `article_correction_review.v1`; bei Publish derselbe maschinelle Zielartikel-Readback | 8–15 min |
| `L` | Evidenz, Claim, Zahl, Einheit, Sicherheit, Quelle, relevante Struktur/Metadaten, neues Framework oder unklare Wirkung | `affected_pipeline_manifest` exakt für `affected_article_ids`, danach nur deren normaler v2-Facts-/Writer-/Publication-Slice und vollständiger DOM-/SEO-Readback | 20–45 min |

`S` erhält Bedeutung, Zahlen/Einheiten, Links, Quellen, Relationen und
badge-treibende Daten exakt. `M` darf keine Zahl, Einheit, Dosierung,
Sicherheit, Claim, Unsicherheit, Quelle, relevante Überschrift, Relation,
Schema oder Runtime berühren. Globale Audits laufen nur bei globaler Daten-
oder Renderwirkung. Ein Kommafehler löst niemals automatisch einen kompletten
Stofflauf aus.

### Entscheidungsbaum

```text
Ändert der Diff möglicherweise Bedeutung, Claim, Zahl/Einheit, Dosierung,
Safety/Unsicherheit, Quelle/Link/Relation, relevante Überschrift, Metadaten,
Schema, Runtime oder Framework?
  Ja oder unklar -> L.
  Nein -> Ist der Diff byte-/DOM-seitig nachweislich bedeutungsgleich und nur
          Wrapper, Whitespace, identisches Encoding oder exakte
          nichtsemantische Dublette?
            Ja -> S.
            Nein -> Ist es eine kleine lokale Sprach-/Tippkorrektur, deren
                    Änderung und Nachbarabsätze denselben fachlichen Inhalt,
                    dieselben Quellen und dieselbe Struktur behalten?
                      Ja -> M.
                      Nein -> L.
```

Die Klasse wird vor Zuweisung gespeichert. Ein während der Bearbeitung
entdeckter höherer Einfluss eskaliert einmal nach oben; eine Herabstufung nach
Beginn ist nicht zulässig.

Bei `M` läuft `article-correction-editor` genau einmal; anschließend prüft
`article-correction-reviewer` mit anderer Execution-ID nur Diff und unmittelbare
Nachbarabsätze. Der Reviewauftrag bindet in `independent_from_ids` mindestens
`article_correction_result.v1.editor.id`. Beide Receipts binden ihre tatsächlich
ausgegebene `work_order_id`. S/M öffnen weder Research noch Facts- oder volles
Publication-Gate; L auditiert keine unbetroffenen Artikel. Alle Klassen nutzen
bei Publish denselben zentralen `publication_apply`-Executor und Write-Guard.

Historische Artikel ohne rekonstruierbare Compiler-Lineage dürfen für rein
lokale Klasse-M-Umlautreparaturen den begrenzten `legacy_field_patch`-Modus
desselben Executors verwenden: höchstens sechs explizite, publizierte
Version-1-Ziele ohne gespeicherte SEO-Payload; nur `summary`/`conclusion` und
nachweislich einzelne `?`→Umlaut/`ß`-Ersetzungen. Ein eingefrorener echter
Editorvorschlag, unabhängiger lokaler Kurzreview samt exakter ausgegebener
Order und Executionreceipt sind Pflicht. Der Guard bindet vollständige
Artikelzeilen, Quellen-, Ingredient-, Interpretations- und Partzeilen samt
Counts vor und nach dem atomaren Batch; ausschließlich die neue nullable
`update_reason`-Spalte wird bei älteren Snapshots zu `null` ergänzt. Erst beim
Apply steigen Version und technisches Änderungsdatum. Vorher wird ein echter
Snapshot gesichert, danach werden D1, öffentliche API und Zielartikel-DOM/SEO
auf Desktop/Mobil geprüft. Ein gültiger identischer Nachzustand ist ein Noop;
fehlender öffentlicher Readback bleibt ausdrücklich unvollständig und kann
idempotent nachgeholt werden. Es werden keine historischen Facts-, Render-
oder Publication-Belege erfunden. Klasse L ist in diesem Modus unzulässig
und verwendet weiterhin ausschließlich den normalen betroffenen v2-Slice.

Für einen historischen L-Artikel ohne gespeicherte Compiler-/SEO-Lineage darf
der Parent ausschließlich seinen Altzustand als echten
`article_correction_authoritative_before.v1`-Readback binden:
`before.authoritative_snapshot_path` erzeugt einen L-Input mit
`mode=authoritative_before`, ausdrücklich ohne erfundenes altes oder vorab
kompiliertes Kandidaten-Release. Der normale Ein-Artikel-Child bindet unter
`article_plan.*[].authoritative_before` denselben `path` und `content_hash`
sowie einen echten `update_reason`; Identität und Update-Guard müssen zum
Parent passen. Neue Extraktion, Facts, Writer, Compiler und Publication-Gate
bleiben unverändert verpflichtend. Erst der normale `publication_apply`
speichert einen frischen Vorher-Snapshot und prüft vollständige Artikel-,
Quellen-, Ingredient-, Interpretations- und Partzeilen samt Counts atomar.
Artikelteile bleiben unverändert; gültige Wiederholungen sind Noops.
Der normale vollständige öffentliche DOM-/SEO-Readback bleibt erforderlich;
ein Rücksetzen nach fehlgeschlagenem Readback restauriert auch den alten
Aktualisierungsgrund unter demselben exakten Snapshot-Guard.

## Optionaler Stage-4-Stack-Sync

Stage 4 läuft nur bei explizitem Auftrag und zweigt nach bestandenem
`facts_completeness_gate.v2` ab. Sie konsumiert ausschließlich das exakte
`facts_package_for_stage4.v2` aus dem Evidence-Lock. Erst die Stage-4-Rolle
erzeugt daraus ein eigenständiges `stack_projection.v2` mit `records[]`,
gebunden an Run, Coverage, Bundle, Gate, Paket, Lock, `facts_hash` und exakte
Evidence-Record-IDs.

`manifest.stage4.enabled=true` bindet eigenes Ziel und einen
`atomic_projection_replace`-Guard mit `expected_record_count` sowie eindeutigen,
sortierten
`targets[{target_key,ingredient_id,population_key,expected_status,expected_version,expected_payload_hash}]`.
Nach dem Facts-Gate emittiert die Runtime genau eine hashgebundene
`stage4_stack_sync`-Work-Order an `stage4-stack-sync`. Sie bindet Stage-4-Paket,
Evidence-Lock, Framework 05, Ziel und Guard; `reused_sources=[]` und
`link_inventory=null`. Sie darf parallel zur Writerwelle laufen und blockiert
weder Writer noch Artikelpublish.

Ingredient-/Population-Zuordnung, normalisierte Menge, Stackrolle,
Auswahl/Default, Sichtbarkeit und Lifecycle existieren ausschließlich in
diesem standalone Stage-4-Artefakt. Es wird niemals in Evidence, Writerpakete
oder Artikel zurückgeschrieben. RAG, semantische Knowledge Base und
artikelabgeleitete Langextrakte sind ein separater späterer Lauf und weder
Writerinput noch Facts-Gate. Stage 4 gehört nicht zum obigen Artikel-Zeitmodell
und wird bei Auftrag separat gemessen.

Jeder Projektionswert bindet exakte Evidence-Record-IDs. Population,
`reported_amount_text`, normalisierte Menge, Einheit, Source-Typ/-Label/-URL,
Zweck und Geltungsgrenze müssen ohne semantische Ergänzung den gebundenen
Paketfacts entsprechen; `facts_hash` umfasst genau diese kanonisch geordneten
Facts. `recommended_amount` ist nur zulässig, wenn eine autoritative
Originalquelle genau diese Klassifikation für dieselbe Population, Menge,
Einheit und Geltungsgrenze trägt. Fehlendes bleibt `null` oder blockiert.

Output sind genau `stack_projection.v2` und `stack_sync_receipt.v2`. Das Receipt
bindet Resultat `PASS|BLOCKED`, Run/Work-Order, Paket-/Facts-/Lockhash, Ziel,
Guard, echte Executor-ID, Projektionspfad/-hash, Apply-Ergebnis, Changed-Count,
Guard-Readback, gezielten Record-Readback und `content_hash`. Bei PASS ist
`apply_result=applied|already_current`: `applied` verlangt exakte Guardparität
und erwartete Zeilenzahl, `already_current` null Writes plus identischen
bestehenden Projektionshash. Ein malformed oder lineage-fremdes Receipt wird
`BLOCKED_INTEGRITY` und nie automatisch überschrieben.

Der Artikelbranch führt seinen eigenen `state`, Stage 4 seinen eigenen Status
und eigene Gate-Metrik. Der Parent setzt `aggregate_status` erst auf `COMPLETE`,
wenn beide angeforderten Branches PASS sind. Stage-4-FAIL bleibt terminal
sichtbar, rollt aber keinen bestandenen Artikelrelease oder Publish zurück.

## Sechs LLM-Wellen und Parallelitätsplan

Deterministische Preflight-, Merge-, Packager-, Compiler-, Release- und
Publishschritte zählen nicht als LLM-Welle. Der normale Erstlauf besitzt genau
sechs LLM-Wellen; zusätzliche Aufrufe entstehen nur durch einen konkreten
scoped Fail:

| Welle | LLM-Arbeit | Parallelität und Barriere |
|---:|---|---|
| 1 | Quellenradar, öffentliche Annahmen als Prüfaufträge, ein Research-Inventar und einmaliges Einfrieren der ausgewählten Originalbytes | Annahmen-, Behörden-, Review-, Studien- und Safety-Suche parallel innerhalb eines Stage-1-Aufrufs; Source-Receipt und deterministischer Link-Inventar-Export erzeugen keine weitere LLM-Welle |
| 2 | Coverage, Kontroversen, Annahmenchecks, Artikelsatz, SEO und Blueprint | ein Planner-Aufruf; kein Extrahieren oder Schreiben; bei neuem Konflikt später nur scoped Neuplanung |
| 3 | Originalquellenextraktion | disjunkte Source-Shards bis `C=4` parallel; deterministischer Merge danach |
| 4 | unabhängiges Facts-Review | High-Risk und reproduzierbare Low-Risk-Auswahl in disjunkten Batches bis `C=4`; bestandene Samples werden carried forward |
| 5 | Stage-2-/Stage-3-Writer | alle homogenen Stage-2-Batches und Stage 3 nach dem einen `writers_ready` parallel bis `C=4`; eine Grafik bleibt im Stage-3-Job |
| 6 | unabhängige Publication-QA | Artikel parallel bis `C=4`, je Artikel zwei Prüfpässe in einem Aufruf und eine gebündelte Rückmeldung |

Bei explizitem Stage 4 läuft dessen eine optionale LLM-Work-Order nach dem
Facts-Gate möglichst parallel zu Welle 5. Sie wird separat gemessen und erhöht
nicht den kritischen Artikelpfad.

Stage 3 startet nie vor vollständiger Freigabe aller Blueprintfakten. Ein
Writer-Fail eröffnet keinen neuen Stofflauf, sondern höchstens zwei
artikel-lokale Revision/Recheck-Paare. Ein Facts-Sample-Fail eröffnet nur das
ungeprüfte Delta seines Stratums. Damit bleibt der kritische Pfad sechs
LLM-Wellen im Normalfall. Nur ein tatsächlicher `framework_gap` erzeugt davor
eine scoped Designer-Sonderwelle; sie ist selten, gemessen und kein Bestandteil
des Sechs-Wellen-Ziels.

## Messvertrag

Nach jedem Zustands- oder Wellenabschluss hängt die Runtime genau ein Ereignis
an `state_dir/metrics/run-metrics.v2.jsonl` an; bestehende Zeilen
werden nie ersetzt. Jedes `nutrient_content_run_metric_event.v2` bindet
`run_id`, `manifest_hash`, `recorded_at`, `state`, `runner_version`,
`wave_index`, `invocation_elapsed_ms`, `e2e_elapsed_ms`,
`llm_wallclock_ms`, `deterministic_elapsed_ms`, `publish_readback_ms`,
`cache{evidence_hits,evidence_misses,article_hits,article_misses}`,
`revision_counts`, `gate_timings_ms`, `gate_results`, `article_count`,
`work_order_count`, `work_order_counts_by_kind`, `llm_wave_index`,
`llm_work_order_count`, `llm_work_order_counts_by_kind`,
`work_order_timings[]` und `event_hash`. Jeder Timing-Eintrag wird
ausschließlich aus einem gültigen `work_order_execution_receipt.v1` abgeleitet
und bindet `work_order_id`, Kind, Execution-Klasse, `reasoning_tier`, Welle,
`started_at`, `finished_at`, `elapsed_ms`, `result_hash` und Receipt-Hash an den
ausgegebenen Auftrag.
`wave_index` zählt Statusereignisse; nur `llm_wave_index` zählt tatsächliche
LLM-Wellen. `gate_results.stage4` und `gate_timings_ms.stage4` messen den
optionalen Child-Branch getrennt.
`event_hash` bindet den vollständigen Eventbody ohne sich selbst.
Runzusammenfassungen werden daraus reproduzierbar berechnet, nicht als
überschriebenes Wahrheitsdokument geführt.

Parallel laufende Intervalle werden je Welle vereinigt; ihre Überschneidung
zählt nur einmal. Bei gemeinsamem Start entspricht das dem längsten Auftrag,
nie der Summe aller parallelen Aufträge. `llm_wallclock_ms` ist die Summe dieser
LLM-Intervallunionen über die Wellen; `deterministic_elapsed_ms` analog für
Maschinenintervalle. `publish_readback_ms` ist der exakt gemessene Apply- plus
öffentliche Readbackanteil. Fehlende Start-/Endbelege werden nicht geschätzt,
sondern machen die betroffene relative Kennzahl `NOT_MEASURABLE`.
Cachehitquote, Revisionsquote, Recheckzahl und Gate-Fails müssen neben p50/p90
ausgewiesen werden; sonst ist eine Zeitersparnis nicht vergleichbar.

## Zeitmodell und 80-%-Ziel

### Altbaseline einmalig einfrieren

Vor dem ersten v2-Piloten wird genau eine vergleichbare Altbaseline als
`content_pipeline_baseline.v1` eingefroren. Sie verwendet bevorzugt die letzten
drei vollständigen Alt-Läufe mit demselben Messprofil; fehlen strukturierte
Logs, sind belegte Start-/Endzeitpunkte aus Task-, Agent- und Publish-Historie
zulässig. Das Artefakt bindet pro Lauf `run_id`, Stoff, Artikel- und
Quellenanzahl, Grafikanzahl, Start, Ende, LLM-Wallclock soweit messbar,
Revisionszahl und die Pfade oder IDs der Zeitnachweise sowie den kanonischen
`content_hash`. Unbelegte Zeiten werden nicht geschätzt.

Die Referenz enthält getrennt `baseline_median_e2e` und, sofern vollständig
belegt, `baseline_median_llm_wallclock`. Die relativen Zielwerte lauten exakt
`pilot_median_e2e <= 0.20 * baseline_median_e2e` sowie
`pilot_median_llm_wallclock <= 0.20 * baseline_median_llm_wallclock`. Sind nicht
wenigstens drei belastbare Alt-Läufe vorhanden, bleiben die absoluten p50-/p90-
Budgets verbindlich, die jeweilige relative 80-%-Aussage wird aber als
`NOT_MEASURABLE` statt als PASS ausgewiesen.
Änderungen an der Baseline nach Beginn der Piloten sind nur mit dokumentiertem
Scopefehler und neuer Version zulässig.

Der typische Messlauf ist verbindlich definiert als:

- 6–10 operative Originalquellen;
- 40–80 Evidence-Records;
- 1 Stage-3-Hauptartikel und typischerweise 6–10 Stage-2-Artikel; weniger nur
  bei nachgewiesenen direkten Forschungslinien oder Meta-/Review-Familien;
- bestehendes Framework, höchstens 1 Grafik;
- maximale aktive Concurrency `C=4`.

Mit Extraktionsshards `X`, Facts-Review-Batches `F`, Stage-2-Writer-Batches
`W2`, Gesamtartikeln `A`, Grafikindikator `G∈{0,1}` und tatsächlich benötigten
Revision/Recheck-Runden `V∈{0,1,2}` gilt:

```text
T_run = T0 + T1 + Tplan
      + ceil(X/C) × Tx + Tmerge
      + ceil(F/C) × Tf
      + max(ceil(W2/C) × T2, T3 + G × Tgraphic)
      + Tcompiler
      + ceil(A/C) × Tqa
      + V × (Trevision + Trecheck)
      + Tpublish
```

`F` entsteht erst nach deterministischer Vollprüf-/Stichprobenauswahl; `W2`
zählt echte Batches, nicht Artikel. Der kritische Pfad addiert daher keine
parallel laufenden Extractor-, Writer- oder QA-Zeiten.

Planbudgets für den typischen Erstlauf:

| Kritischer Abschnitt | p50-Budget | p90-Budget |
|---|---:|---:|
| Reuse-Preflight | 1–2 min | 3 min |
| LLM-Welle 1: Recherche | 18–21 min | 25 min |
| LLM-Welle 2: Coverage/Blueprint | 5–6 min | 9 min |
| LLM-Welle 3: Extraktion + deterministischer Merge | 11–14 min | 19 min |
| LLM-Welle 4: Facts-Review + Gate | 8–11 min | 15 min |
| LLM-Welle 5: parallele Stage-2/3-Writer | 18–22 min | 28 min |
| Compiler + LLM-Welle 6: Publication-QA | 10–15 min | 20 min |
| Publish + Readback | 3–5 min | 8 min |

Runbudget ist `p50 ≤90 min` und `p90 ≤115 min`. Das 80-%-Ziel gilt zusätzlich
für End-to-End und, bei messbarer Baseline, für LLM-Wallclock; schnellere lokale
Tools dürfen fehlende LLM-Einsparung nicht kaschieren. Die Tabellenzeilen sind
separat gemessene marginale p50-/p90-Quantile. Sie werden nicht addiert: Die
langsamsten Wellen stammen nicht zwingend aus demselben Lauf; maßgeblich sind
die direkt gemessenen Gesamtquantile.

### Drei Piloten und Rollout-Gate

Vor breitem Rollout laufen drei vollständige, instrumentierte Piloten nach
demselben Messprofil:

1. ein neuer Stoff mit bestehendem Framework und ohne Grafik;
2. ein typischer Stoff mit 6–10 getrennten Stage-2-Artikeln plus Stage 3 und
   Supporting-Links;
3. ein risikoreicherer Stoff mit Kontroverse/Safety und – nur bei echtem
   Erklärgewinn – einer Grafik.

Rollout ist bestanden, wenn alle drei ohne manuellen Schema-/Hash-/Publish-
Hotfix Evidence-, Compiler-, Stage-3-Render-/Stage-2-Projektions-, Publication-
und Readback-Gates bestehen, kanonisches Magazin-Markdown, Quellenparität und
People-first-Qualität ohne
Regression erfüllen, kein Safety-/Source-Fehler publiziert wird, der Median
`≤90 min` und der Nearest-Rank-p90 der drei Runs `≤115 min` bleibt,
`pilot_median_e2e <= 0.20 * baseline_median_e2e` gilt und bei messbarer
LLM-Baseline auch
`pilot_median_llm_wallclock <= 0.20 * baseline_median_llm_wallclock` gilt. Eine
nicht messbare relative Kennzahl wird ausdrücklich `NOT_MEASURABLE`, nie PASS.
Zusätzlich dürfen höchstens ein Pilot eine Writerrevision und keiner mehr als
zwei Rechecks benötigen. Scheitert ein Kriterium, bleibt v2 im Pilotmodus; die
append-only Metriken benennen vor dem nächsten Dreierlauf die konkrete
langsamste Welle oder Gate-Ursache.

## Alt → Neu: entfernte Bremsen

| Alter Flow | Kanonischer v2-Flow |
|---|---|
| mehrere Manifeste, universeller Envelope und manuelle Checklisten | ein `nutrient_content_run.v2`, daraus vollständig gehashte Work-Orders |
| erneutes Lesen aller Memory-/Statusdateien pro Rolle | `AGENTS.md` plus nur relevanter Current-Task-Abschnitt; Handoff nur bei echter Übernahme |
| Stage 1 notiert Links, Extractor lädt dieselbe Quelle erneut | Stage 1 friert ausgewählte Originalbytes im selben Aufruf einmal ein; Receipt und Extractor verwenden exakt diese Bytes |
| eigener Agent für Linkliste oder Evidence-Buildmanifest | Link-Inventar und disjunktes Buildmanifest deterministisch aus autoritativen Inputs bauen/cachen |
| separate Score-Matrix | nachvollziehbare Priorisierung im einen Research-Inventar; objektive Werte deterministisch |
| Plan-Delta als zusätzliches Austauschschema | scoped Neuplanung mit erneut vollständigem Plan; unbetroffene Lineage bleibt stabil |
| Artikel oder artikelabgeleiteter Extract als Faktenquelle | einmalige Originalquellen-Extraktion; RAG/Langextract separat nach Publikation |
| globale Lockänderung invalidiert alle Artikel | stabiler `evidence_membership_hash` pro Artikel |
| alle Facts mehrfach vollreviewen | High Risk voll, reproduzierbares Low-Risk-Sample, bestandene Einheiten carried forward |
| Stage 2 vor Stage 3 und Orchestrator als zusätzlicher Review | Stage 2/3 nach einem `writers_ready` parallel; genau ein unabhängiges Publication-Gate |
| Writer-Selbstgate, Stage 3.5 und erneuter Orchestrator-Check | Writer schreibt ohne eigenes Freigabegate; ein Compiler und ein zweipassiges unabhängiges Publication-Gate prüfen genau einmal |
| mehrfach kopierte Artikeltemplates | ein kataloggebundenes kanonisches Magazin-Scaffold (aktuell Framework 03) als einzige byte-genaue Strukturwahrheit |
| Grafikbriefing oder Platzhalter im Artikel | standardmäßig keine Grafik, sonst exakt ein erzeugtes/eingebundenes Asset |
| getrennte SEO-, Meta- und Compliance-Dokumente | ein People-first-SEO-Brief; technische Meta erst aus finalem Artikel |
| Markdown-Simulation als Rendernachweis | Stage-3-React-/Router-/JSDOM-Snapshot; Stage-2-Vollprojektion plus zwingender öffentlicher DOM-Readback |
| jeder kleine Artikeldiff startet den Stofflauf neu | S/M/L-Fast-Lanes mit proportionalem Review und Readback |
| freie Feedbackschleifen und kompletter Rereview | eine gebündelte Runde, maximal zwei serverseitig gescopte `targeted_recheck` |
| Publisher assembliert oder korrigiert Inhalt erneut | frozen Release unverändert, atomar und idempotent anwenden |
| LLM-Publication-Executor für mechanischen Write | explizit aktivierter guarded `publication_apply`-Maschinenexecutor mit strukturiertem Readback |
| Stage 4 und Extrakte als Standardabschluss | Stage 4 nur explizit und quellgebunden; RAG eigener späterer Lauf |

Entfernt werden damit keine fachlichen Grenzen, sondern konkurrierende
Wahrheiten, Wiederholungen und pauschale Kontrollinstanzen. Originalquellen-
Gate, deterministischer Compiler, unabhängiges Publication-Gate und guarded
Publish bleiben als die drei tatsächlichen Qualitätsgrenzen plus Write-Schutz
erhalten.

## Legacy-Inputadapter, niemals aktive Outputs

Bestehende Altartefakte dürfen ausschließlich über einen expliziten,
read-only Normalizer eingelesen werden. Dazu gehören insbesondere
`pipeline_run_manifest.v2`, `source_inventory.v1`, `score_matrix.v1`,
`coverage_plan.v1`, `source_evidence_shard.v1`,
`source_evidence_bundle.v1`, `review_sample_manifest.v1`,
`source_facts_review.v1`, `facts_completeness_gate.v1`,
`facts_package_for_stage2.v1`, `facts_package_for_stage3.v1`,
`article_job.v1`, `article_provenance.v1`, `content_lint_result.v1`,
`publication_quality_review.v1`, `publication_bundle.v1`,
`publication_receipt.v1` und `stack_projection.v1`.

Ein Adapter validiert alte Bytes, erzeugt einmal einen aktuellen v2-Input mit
neuem Hash und schreibt nie wieder ein Legacy-Schema. Legacy-Dateinamen,
Erfolgsfelder oder Sidecars sind keine zulässigen Outputs eines neuen Laufs.
Auch historische eingebettete `source_evidence_record.stack_projection`-
Objekte – unabhängig von ihrer Versionsangabe – sind ausschließlich Legacy-
Input. Der Adapter darf nur quellengestützte Fakten und `stage4_relevance`
übernehmen; operative Entscheidungen werden nach dem aktuellen Facts-Gate neu
im standalone `stack_projection.v2` getroffen.

## Fertig

Ein Lauf ist fachlich fertig, wenn alle geplanten Artikel exakt den
Framework-/Qualitätsvertrag erfüllen und Evidence-, Compiler- und
Publication-Gates bestanden sind. Er ist publiziert fertig, wenn derselbe
Release atomar angewendet oder nachweislich bereits aktuell war,
`content_publish_receipt.v2` alle tatsächlichen Werte bindet und der gezielte
Readback die öffentliche Darstellung bestätigt.
