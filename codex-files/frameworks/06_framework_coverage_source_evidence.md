# Framework 06: Coverage, Originalquellen und Facts-Gate v2

Dieses Framework ist die einzige fachliche Schemawahrheit zwischen Recherche
und Writer-Start. Artikel sind niemals Faktenquellen. Alle JSON-Artefakte sind
striktes UTF-8, deterministisch kanonisiert und über SHA-256 gebunden.

## Invarianten

1. Ein `nutrient_content_run.v2` besitzt genau eine Stoff-/Sprachidentität,
   einen erlaubten Run-Root und eine Artikelplanung.
2. Pfade werden relativ zum passenden Run- oder Repository-Root aufgelöst,
   müssen vollständig darin liegen und dürfen weder kollidieren noch Eingaben
   überschreiben. IDs dürfen keine Pfade oder Traversalbestandteile enthalten.
3. Originalquellenbytes, Coverage, Shards, Reviews, Gate, Pakete und Lock sind
   content-addressed. Eine fehlende, fremde oder veraltete Bindung blockiert
   fail-closed.
4. Es gibt keinen universellen Artefakt-Envelope und kein zweites
   Run-Manifest. Jedes Schema trägt nur seine eigenen fachlichen Felder und den
   dafür definierten Hash.
5. Extractor und Facts-Reviewer sind unterschiedliche Ausführungsidentitäten.
   Zusätzlich erzwingt die Laufzeit: Writer ≠ Facts-Reviewer, Writer ≠
   Publication-Reviewer und Facts-Reviewer ≠ Publication-Reviewer.
6. Erst ein einziges run-weites `writers_ready=true` nach allen geplanten
   Extraktions-, Review-, Artikel- und Lock-Prüfungen öffnet Stage 2 und Stage 3
   gemeinsam.
7. Globale Artefakte bezeugen die Run-Vollständigkeit; sie sind keine pauschale
   Artikel-Cachelineage. Ein geänderter Geschwisterartikel oder neu gebauter
   Run-Lock invalidiert keinen Artikel, dessen per-article
   `evidence_membership_hash` unverändert ist.

## Ausführbare Work-Orders

Jeder LLM-Aufruf sowie jeder externe Maschinen- oder Human-Schritt erhält genau
eine oder mehrere ausdrücklich kompatible `nutrient_content_work_order.v2`.
Jede Order besitzt immer dieselben Top-Level-Keys:

```text
schema, run_id, kind, execution_class, reasoning_tier, wave_index, reason,
substance{slug,language},
scope{mode,source_ids,cluster_ids,obligation_ids,article_ids},
assignee{role,independent_from_ids}, inputs[], reused_sources[],
link_inventory, outputs[], task{}, constraints{},
execution_receipt{root,path,schema}, work_order_id
```

`execution_class` ist exakt `llm|deterministic|human`.
`reasoning_tier=standard|high|xhigh` ist ein top-level Vertragsfeld und Teil
des `work_order_id`; weder Rolle noch Executor dürfen es nach Ausgabe ändern.
Die Runtime setzt mindestens:

- `standard` für Research/Freeze, initiale Source-Extraktion, reine
  Low-Risk-Facts-Stichproben, M-Korrektur/-Kurzreview und deterministische
  Maschinenarbeit sowie den humanen Site-Indexability-Handoff;
- `high` für Coverage, Source-Extraktionsrepair, High-/Full-Risk-Facts-Review
  und die erweiterte Reviewrunde, Stage-2-/Stage-3-Writer samt Revision und
  Repair, Publication-QA, Stage 4 und Owner-Freigabe;
- `xhigh` ausschließlich für einen echten Framework-/Runtime-Gap oder eine
  ausdrücklich eskalierte wiederholte materielle Konfliktlage.

Die Runtime darf ein Minimum wegen gebundener Risikosignale erhöhen, nie
senken; der ausführende Agent wählt sein Tier nicht selbst. Modell- oder
Providername sind kein Vertragsfeld. Nur LLM-Orders tragen einen positiven
`wave_index`; bei Maschinen- und Human-Orders ist er `null`.
`scope.mode` ist `run|sources|obligations|articles`; alle vier ID-Arrays sind
sortiert, eindeutig und gegebenenfalls leer. Jede `inputs[]`-Bindung enthält
exakt `name`, `root=run|repo`, `path`, `byte_hash`, `content_hash` und `schema`.
Bei opaken Markdown-/PDF-Bytes entspricht `content_hash` dem Bytehash; nur
`schema` ist `null`. `reused_sources[]` enthält exakt `source_id`, `root`,
`path`, `byte_hash` und `content_hash` für unverändert wiederverwendete
Originalquellen.

`link_inventory` ist entweder `null` oder eine Inputbindung mit festem
`name=link_inventory`. Nur `coverage_planning` bindet damit das vollständige
`site_link_inventory.v2`; bei Writer, Writer-Repair/-Revision, Publication-QA
und allen anderen Orders ist das Feld `null`. Diese Rollen erhalten den
artikelbezogenen `selected_link_slice` ausschließlich im Facts-Paket.
Jede `outputs[]`-Bindung enthält exakt
`name`, `root`, `path`, `schema` und `media_type`; genau eines der letzten
beiden Felder ist ungleich `null`. `task` trägt nur kind-spezifische Steuerdaten;
vollständige semantische Payloads werden nicht aus `inputs[]` dorthin kopiert.
Bei Writer-Orders enthält `task` ausschließlich Artikel/Stage/Slug/Revision,
Paket-, Mitgliedschafts-, Artikel-, Framework- und Versionshashes,
`render_profile`, `asset_contracts` sowie gegebenenfalls `previous`,
`bundled_findings`, `recheck_scope` und `repair`. Blueprint, SEO-Brief,
Kontroversen, Grafikentscheidung, Quellen und Link-Slice stehen genau einmal im
Facts-Paket. Bei Publication-QA enthält `task` nur Artikel-/Reviewsteuerung und
die nötigen Lineage-/Scopehashes, Assetbindungen und Finding-Keys; der volle
`article_qa_payload.v2` steht ausschließlich im Input `compiled_article` mit
`schema=compiled_article.v2`. Dieses Compilerartefakt bindet genau einmal
Frozen-Publish-Payload, sichtbare AST, Quellenrelationen, Assets, SEO, Render-
Request/-Snapshot, erwartete Projektion und `qa_payload` mit
`schema=article_qa_payload.v2`; dessen `content_hash` ist der
`qa_payload_hash` der Work-Order. Es gibt kein zweites QA-Payload-Feld in
`task`. `constraints` enthält nur Verhaltensinvarianten und
Limits; Pfad-/Hashbindungen bleiben ausschließlich in `inputs[]`,
Unabhängigkeits-IDs ausschließlich in `assignee.independent_from_ids`.
`assignee` enthält vor Ausführung keine erfundene Execution-ID; diese erscheint
erst im Result oder Review.

Jede Work-Order enthält top-level genau
`execution_receipt{root=run,path,schema=work_order_execution_receipt.v1}`; die
Bindung gehört zum vollständigen Work-Order-Hash. Nach technisch erfolgreich
abgeschlossener terminaler Ausführung schreibt ausschließlich ihr Executor an
diesem Pfad genau ein
`work_order_execution_receipt.v1` mit `run_id`, exakter `work_order_id`,
`execution_class`, `reasoning_tier`, echter `executor{role,id}`, `started_at`,
`finished_at`, `result=PASS`, dem Hash des fachlichen Resultats als
`result_hash` und eigenem `content_hash`. `result=PASS` bezeichnet hier nur den
Executor-Erfolg: `result_hash` bindet das fachliche Outputartefakt auch bei
dessen Urteil `FAIL|BLOCKED`. Ein technischer Abbruch schreibt kein
PASS-Receipt. Dieses kleine Execution-/Timing-Receipt enthält keine Fakten,
Entscheidungen, Findings oder Payload. Es bleibt vom fachlichen Output in
`outputs[]` und dessen etwaigem Fachreceipt strikt getrennt und ersetzt keines
von beiden.

`work_order_id` ist der SHA-256 über die kanonische Serialisierung des
vollständigen Work-Order-Bodys ohne das ID-Feld. Damit bindet er auch Scope,
Inputbytes, wiederverwendete Sources, Link-Inventar, Outputpfade, Findings,
serverseitigen Diffscope und Constraints. Zwei parallel laufende Orders dürfen
weder denselben Output schreiben noch überlappende fachliche Records erzeugen.
Batching ist nur bei gleichem `kind`, Framework und disjunkten Outputs erlaubt;
jeder Artikel behält eigene Order und Receipt.

Ein veraltetes Input- oder Reviewbinding wird nicht per Hand überschrieben.
Die Runtime erzeugt eine neue Work-Order aus dem aktuellen Zustand. Bereits
bestandene, hashidentische Outputs werden als Reuse gebunden und nicht erneut
bearbeitet.

Stage 0 ist davon ausgenommen: Es ist eine rein interne Runnerfunktion ohne
Work-Order, Receipt, Rolle oder LLM-Aufruf. Externe deterministische Orders
laufen ausschließlich über
`scripts/lib/nutrient-content-machine-dispatcher.mjs`. Die CLIs sind
`scripts/export-site-link-inventory.mjs`,
`scripts/apply-content-release.mjs` und
`scripts/dispatch-nutrient-content-machines.mjs`. Der Dispatcher vergleicht
immer die vollständige aktuell ausgegebene Order und deren exakte
`work_order_id`; ein Kindname oder Dateipfad allein autorisiert keine Aktion.

Das Run-Manifest trägt `operation=full_pipeline|article_correction`.
`full_pipeline` nutzt die v2-Evidence-Kette. Die ausführbaren Korrekturverträge
stehen im Abschnitt Artikelkorrekturen; beide Operationen enden bei Bedarf im
gleichen `publication_apply`-Maschinenexecutor.

Jede erstmals ausgegebene Order wird außerdem append-only als
`nutrient_content_work_order_event.v2` in
`state_dir/work-orders-history.v2.jsonl` gesichert. Das Event bindet Run,
Manifest, Ausgabezeit, vollständige Work-Order und `event_hash`; dadurch kann
die Runtime ein späteres Receipt gegen genau den tatsächlich ausgegebenen
Vertrag statt nur gegen die aktuelle Statusdatei prüfen.

### Deterministisches Link-Inventar

`site_link_inventory.v2` ist ein gecachter Preflight-Output, keine LLM-Arbeit.
Ein read-only Maschinenexport liest ausschließlich den vom Manifest unter
`inputs.link_inventory_source_path` gebundenen autoritativen DB-/Routen-
Readback und schreibt genau
`state_dir/preflight/site-link-inventory.v2.json`. Das Artefakt bindet
Erfassungszeit, kanonische Wissensrouten mit Pfad, Slug, sichtbarem Titel und
publizierter `meta_description` sowie `article_layer=main_article|single_study`,
die sortierten sichtbaren `source_urls[]`, den Source-Bytehash und seinen
`content_hash`;
Reihenfolge und Dubletten werden deterministisch normalisiert. Der aktuelle
Maschinenexport gewinnt `meta_description` aus `knowledge_articles.summary`
und `article_layer` aus `knowledge_articles.article_layer`; `source_urls[]`
stammen aus den geordneten `knowledge_article_sources.url`-Relationen. Ein
alter Source-Readback ohne diese Felder gilt als stale: Die Runtime setzt
`WAITING_FOR_LINK_INVENTORY` und fordert einen neuen Maschinenexport an. Ohne
beide Felder darf er weder Live-Description-Eindeutigkeit noch einen
Stage-2-Carrier nachweisen.

Bei unveränderten Sourcebytes wird das Inventar wiederverwendet. Fehlt der
autoritativ gebundene Source-Input, setzt die Runtime
`WAITING_FOR_LINK_INVENTORY` und emittiert den Maschinenauftrag
`link_inventory_source_readback` an `deterministic-link-inventory-exporter`.
Er darf parallel zu ohnehin fehlender Research-Arbeit laufen, ist aber keine
eigene LLM-Welle. Planner und Writer starten nicht; ein Agent darf keine Route
oder Seite ergänzen.

Der Planner schreibt pro geplantem Artikel exakt
`selected_link_slice{links[],slice_hash}`. `links` ist eindeutig nach `path`
sortiert; jedes Element bindet `path`, `title`, `target_id` als Slug und
`target_state=live|same_release`. Nur bei `same_release` ist zusätzlich
`target_article_id` Pflicht. Seine Pfadmenge entspricht exakt
`seo_brief.internal_link_targets`, `slice_hash` ist der kanonische Hash über
`{links}`.

Ein `live`-Ziel muss bytegenau im autoritativen Inventar stehen. Ein
`same_release`-Ziel muss ein anderer geplanter Artikel desselben Runs sein;
`target_id` entspricht dessen Slug und `path` exakt `/wissen/<slug>`. Diese
Kante wird als `internal_link_dependencies` in den Release übernommen. Alle
Abhängigkeiten müssen im selben `content_release.v2` mit `atomic=true` liegen,
sonst blockiert Releasebau. Nur der Slice geht in Artikel-Lineage und Writer-/
QA-Paket ein. Vor jedem Compiler-Cachehit werden Liveziele gegen das Inventar
und Same-Release-Ziele gegen den aktuellen Plan geprüft. Eine Änderung eines
ausgewählten Ziels löst nur scoped Coverage-Neuplanung der betroffenen Artikel
aus; unbeteiligte neue oder geänderte Routen invalidieren keinen Artikel.

## Kanonische Evidence-Kette

```text
strict-UTF8 research inventory bytes (opaque Markdown or JSON)
  + research_source_artifact_receipt.v2 + frozen original bytes
  -> coverage_plan.v2
  -> source_evidence_shard.v2[]
  -> source_evidence_bundle.v2
  -> review_sample_manifest.v2
  -> source_facts_review_input.v2
  -> source_facts_review.v2[]
  -> facts_completeness_gate.v2
  -> facts_package_for_stage2.v2[] + facts_package_for_stage3.v2[]
     + optional facts_package_for_stage4.v2
  -> evidence_pipeline_lock.v2 (`writers_ready=true`)
     -> only if requested: standalone stack_projection.v2
```

Der Runner leitet daraus `nutrient_content_work_order.v2` ab. Gültige
hashidentische Stufen werden wiederverwendet; ein geänderter Hash invalidiert
nur abhängige Knoten.

## Formatagnostisches Research-Inventar

Stage 1 schreibt genau die in der Work-Order adressierte Datei als striktes
UTF-8. Markdown und JSON sind zulässig; die Runtime behandelt den Inhalt als
opaque Bytes, verlangt kein Schema, keine Version und keinen universellen
Envelope. Sie bindet ausschließlich den Bytehash als
`coverage_plan.v2.research_hash`.

Im selben Research-Aufruf werden die typischerweise sechs bis zehn ausgewählten
operativen Originalquellen genau einmal unverändert im erlaubten Artifact-Root
gespeichert. Wird eine Meta-Analyse, ein systematischer oder Umbrella-Review
ausgewählt, kommen alle eindeutig identifizierbaren unmittelbar
eingeschlossenen Evidenzeinheiten hinzu: bei Meta-Analysen/systematischen
Reviews die Primärstudien, bei Umbrella-Reviews deren eingeschlossene Reviews
und nur bei einer im Umbrella-Originaltext vollständigen Zuordnung zusätzlich
deren Primärstudien. Eine nicht veröffentlichte verschachtelte Liste wird nicht
rekursiv erfunden. Diese begründete `meta_constituent`-Menge unterliegt
keinem 10-Source-Cap.
`research_source_artifact_receipt.v2` enthält exakt `schema`, `run_id`,
`research_hash`, `artifact_root`, sortierte eindeutige
`sources[{source_id,path,byte_hash,content_type,locator}]` und `content_hash`.
Alle Pfade liegen innerhalb des gebundenen Roots, jeder Bytehash passt zur
tatsächlichen Datei, und Locator/Source-ID sind eindeutig. Das Receipt ist
reine Lineage und weder zweites Researchinventar noch Score-/Analyseartefakt.

Für die redaktionelle Nutzbarkeit sollen die frei strukturierten Bytes Quellen
stabil erkennbar machen und Recherchezeitpunkt, Query-/Auswahlweg,
DOI/PMID/kanonische URL, Version/Korrekturstatus, Zugriff/Locator,
Deduplizierung, potenzielle Cluster sowie Ausschlussgründe nachvollziehbar
dokumentieren. Das ist Inhaltsorientierung, kein maschinenvalidiertes
Feldschema.

Die Bytes enthalten außerdem einen klar erkennbaren Abschnitt „Gängige
Annahmen und Prüfaufträge“. Er dokumentiert die materiellsten wiederkehrenden
öffentlichen Annahmen als neutrale Behauptung plus prüfbare Leserfrage,
Discovery-Begründung und mögliche Source-/Clusterhinweise. Suchvorschläge,
FAQ-Muster oder wiederkehrende Nutzerfragen sind nur Relevanzsignale, keine
Evidenz für die fachliche Antwort und ohne Originalquelle kein Nachweis einer
quantifizierten Verbreitung. Ergibt der gebundene Suchscope keine materielle
Annahme, wird dieses negative Ergebnis samt Suchweg dokumentiert; Füllannahmen
sind unzulässig.

Es entsteht keine separate Score-Matrix. Eine deterministische
Priorisierungsregel darf im selben Inventar nachvollziehbar dokumentiert sein;
die erste strukturierte Runtime-Grenze bleibt `coverage_plan.v2`. Für den
typischen Lauf werden sechs bis zehn operative Originalquellen gewählt;
weitere Treffer bleiben begründet ausgeschlossen, statt die Extraktion
aufzublähen. Eingeschlossene Einzelstudien einer ausgewählten Meta-/Review-
Source sind keine beliebigen weiteren Treffer: Sie werden vollständig als
`meta_constituent` inventarisiert, sofern sie eindeutig identifizierbar und
öffentlich als Originalsource zu verlinken sind.

## `coverage_plan.v2`

Der Plan bindet `run_id`, `research_hash`, Stoff, Sprache, Planneridentität,
`stage4_requested`, Sources, Cluster, Artikel, Kontroversen,
Extraktionspflichten,
`stage2_source_assignment_policy=one_meaningful_source_per_stage2.v1` und
`stage3_source_label_policy=german_original_title.v1` sowie
`content_hash`.

### Sources, Cluster und Artikel

- Jede Source bindet `source_id`, Typ, `author_or_institution`,
  `publication_year` als Integer `1000..aktuelles Jahr` oder `null`, `title`,
  `journal_or_publisher`, normalisierte `doi`/`pmid` oder `null`, unveränderte
  `url`, normalisierte `canonical_url`, `label` und `source_content_hash`;
  letzterer entspricht exakt dem `byte_hash` derselben Source im Research-
  Artifact-Receipt. Das deterministisch erzeugte Label lautet bytegleich
  `<author_or_institution> (<YYYY|o. J.>). <title>. <journal_or_publisher>.[
  DOI: <doi>.][ PMID: <pmid>.]`; fehlende Identifierteile entfallen. Weder
  Writer noch Publication-Executor formatieren es neu oder ersetzen die
  Original-URL durch einen Artikel-/Internlink.
- Jeder Cluster bindet `cluster_id`, `required`, Source-IDs und planseitige
  `plan_risk_tags`.
- Jeder Artikel bindet `article_id`, `stage=stage2|stage3`,
  `status=planned|blocked|excluded`, Slug, Framework-ID/-Version,
  tatsächlichen Frameworkpfad/-Bytehash, `framework_hash`,
  `required_cluster_ids`, Source-IDs und genau einen People-first-SEO-Brief.
  Die Source-IDs müssen exakt den artikelbezogenen Extraktionspflichten
  entsprechen; erst der Packager leitet daraus die eine sichtbare Quellenliste
  ab.
- Jeder geplante Stage-2-Artikel bindet genau ein
  `source_assignment{mode,anchor_source_id,relations[]}` und genau ein
  `source_presentation_label_de`. Dieses Label ist der sinngenau ins Deutsche
  übertragene Titel der Anker-Originalquelle und später bytegleich Stage-2-H1
  sowie internes Stage-3-Quellenlabel. `mode=single_source`
  verlangt exakt eine Source und keine Relation. `direct_research_line`
  verlangt mindestens zwei Sources, einen zusammenhängenden Relationsgraphen
  und für jede Nicht-Anker-Source genau eine begründete Kante vom Typ
  `replication|direct_follow_up|population_extension|dose_extension|method_extension|outcome_extension|superseding_update`.
  `meta_analysis_family` verlangt als Anker eine Meta-Analyse, einen
  systematischen oder Umbrella-Review; jede unmittelbar eingeschlossene
  Evidenzeinheit mit `source_kind=study` wird genau einmal
  als `meta_constituent` direkt an diesen Anker gebunden. Andere
  Relationstypen, bloße Themenähnlichkeit und nicht begründete Sammelartikel
  sind ungültig. Carrier-Eigentum entsteht bei `meta_analysis_family` nur für
  den Anker; Konstituenten sind sichtbare Originalzitate ohne eigenen Carrier.
  Dieselbe Primärstudie darf als nachgewiesener Konstituent in mehreren
  ausgewählten Meta-Familien vorkommen, erhält dann aber keinen separaten
  Stage-2-Artikel und erscheint nicht selbst in der Stage-3-Source-Menge.
  Außer dieser belegten Meta-Überlappung darf eine Source in höchstens einem
  geplanten Stage-2-Artikel vorkommen. Sobald ein Stage-3-Artikel geplant ist,
  darf kein geplanter Stage-2-Carrier-Anker beziehungsweise keine Source einer
  direkten Forschungslinie außerhalb der vereinigten Stage-3-Source-Menge
  liegen.
- Stage 2 darf jeden fachlich passenden approved Katalogeintrag binden. Stage 3
  bindet dagegen stets einen approved Eintrag mit
  `contract_id=render_profile=knowledge_magazine_v1`, dessen Pfad/Bytehash das
  eine aktive kanonische Magazin-Scaffold auflöst; aktuell ist dies Framework
  03@2.0.3. Seine `variant` steuert nur stofftypische Inhaltswahl und darf das
  Scaffold weder kopieren noch überschreiben. Ein unabhängiges zweites
  Stage-3-Scaffold ist kein gültiger `planned`-Fit. Jeder Stage-3-Kandidat, der
  bei Pfad/Bytehash, `contract_id` oder `render_profile` vom kanonischen
  Framework 03 abweicht, muss nichtleere `technical_change_paths[]`
  deklarieren und im externen Runtime-Handoff stoppen; der Content-Activator
  darf ihn nie automatisch als zweite Scaffolddatei aktivieren.
- Der SEO-Brief enthält ausschließlich `primary_intent`, `reader_question`,
  `reader_promise`, `primary_topic_phrase`, drei bis sechs
  `secondary_questions`, `cannibalization_note` und
  `internal_link_targets`. Technischer Title und Meta-Description sind kein
  Planoutput und werden erst aus dem finalen Artikel abgeleitet.
- Jeder geplante Artikel bindet zusätzlich genau den mengengleichen
  `selected_link_slice` nach obigem Vertrag; Writer dürfen keinen sichtbaren
  `/wissen/`-Link außerhalb dieses Slices ergänzen.
- Bei Stage 3 partitionieren die
  `selected_link_slice.links[].covered_source_ids` die artikelbezogenen
  Source-IDs exakt: jede Originalsource kommt genau einmal vor. Das Linkziel
  ist ein interner Stage-2-Artikel. `same_release` muss auf einen geplanten
  Stage-2-Artikel zeigen; existiert für die Source ein geplanter Carrier, muss
  exakt dieser Carrier das `same_release`-Ziel sein und `link.title` muss
  bytegleich dessen `source_presentation_label_de` sein. `live` muss im
  autoritativen Linkinventar zusätzlich
  `article_layer=single_study` tragen und seine `source_urls[]` müssen über
  normalisierte DOI-, PMID- oder Canonical-/Originallokator-Identität exakt
  beidseitig zu den `covered_source_ids` passen. Stage 3 zeigt keine externe
  Originalsource direkt an; deren Originallokator bleibt im zugehörigen
  Stage-2-Artikel sichtbar.
- Ein Stage-3-Artikel bindet zusätzlich Blueprint, Kontroversen und genau einen
  `common_assumption_review`. Dieser trägt
  `status=identified|none_identified`, eine `discovery_note` und `checks[]`.
  Jeder Check bindet `assumption_id`, neutrale `assumption`,
  `reader_question`, `discovery_basis` sowie artikelbezogene `source_ids`,
  `cluster_ids` und `obligation_ids`. `identified` verlangt mindestens einen
  Check; `none_identified` verlangt `checks=[]` und eine konkrete negative
  Suchbegründung. Source- und Cluster-Mengen entsprechen exakt den durch die
  Check-Obligations referenzierten Mengen. Record-IDs sind vor dem Facts-Gate
  verboten.
- Ein Stage-3-Artikel bindet außerdem `graphic_decision`. Diese enthält
  `mode=none|generate`, Begründung und bei
  `generate` fachlich tragende `cluster_ids` und `obligation_ids`; Record-IDs
  existieren erst nach dem Facts-Gate im Paket.

Nur `planned`-Artikel erzeugen Pflichten und Writerpakete. Blockierte oder
ausgeschlossene Artikel dürfen keine erwarteten Outputs vortäuschen.

Existiert für einen Artikel kein approved Framework-Fit, darf er ausschließlich
mit `status=blocked` und einem korrespondierenden `framework_gaps[]`-Eintrag
vorliegen. Dieser enthält `gap_id`, `article_id`, `stage`,
`decision=adapt_existing|new_archetype`, `reason`, `target_framework_id`,
`target_version`, einen sicheren kollisionsfreien `target_framework_path` und
`owner_approval_required`. Die drei `target_*`-Felder sind die einzige
vorgeschlagene neue aktive Identität. Nur `adapt_existing` bindet zusätzlich
die aus Kompatibilitätsgründen so benannten `candidate_framework_id` und
`candidate_framework_version`; sie bezeichnen ausschließlich die approved
**Basis**, nie den vorgeschlagenen Kandidaten. Die Runtime löst sie aus dem
aktiven Katalog zu `base_framework{framework_id,version,path,byte_hash}` auf
und bindet dieses Objekt in `framework_pilot_fixture.v1` sowie die Basisbytes
als Work-Order-Input. Bei `new_archetype` sind beide Legacy-Felder `null`;
`owner_approval_required` ist genau bei `new_archetype` wahr und wird bereits
hier festgelegt. Die Runtime erkennt den Gap vor Plan-Parity und Evidence,
setzt `WAITING_FOR_FRAMEWORK` und erzeugt genau eine `framework_design`-
Work-Order an `article-framework-designer` für genau einen Gap. Nach dessen
Aktivierung folgt die vollständige Neuplanung gegen den neuen Kataloghash;
weitere Gaps werden erst daraus bearbeitet.

Der Designer schreibt ausschließlich unter
`framework-candidates/<gap_id>/`: `candidate-framework.md` und
`framework-catalog-candidate.v1.json` mit Schema
`framework_catalog_candidate.v1`. Vorher stellt der Runner eine
`framework_pilot_fixture.v1` aus; sie bindet Gap, Ziel, aufgelöste Basis,
aktuellen Katalogbytehash, Runtime-/Frontendpfade mit Bytehash und eine
technische Artikelfixture. Der Katalogkandidat bindet exakt `work_order_id`,
`pilot_fixture_hash`, eindeutige `technical_change_paths[]` und die
mengengleiche `technical_change_baseline[{path,byte_hash}]`; die Liste entsteht
erst aus dem konkreten Kandidaten und ist im Normalfall leer.

Nur bei `technical_change_paths=[]` dürfen echte Compiler-, Render- und
Publication-Piloten aus derselben `framework_design`-Work-Order und exakt der
runnerausgegebenen Fixture dort
`framework_compiler_pilot_receipt.v1`,
`framework_render_pilot_receipt.v1` und
`framework_publication_pilot_receipt.v1`. Jedes bindet exakte Work-Order,
Executor-/Toolversion, erfolgreiche Ausführungszeit und Exitcode,
Argumenthash, Fixture, Output und Execution-Log mit Bytehash sowie die
schemaspezifischen Checks. Der Designer darf keinen Composite-PASS selbst
behaupten.

Bei nichtleeren `technical_change_paths[]` entstehen keine Pilotreceipts. Der
Contentlauf wechselt zu `WAITING_FOR_TECHNICAL_FRAMEWORK_CHANGE` und emittiert
nur die Human-Work-Order `framework_runtime_change_handoff` an
`framework-runtime-change-owner`. Sie bindet Kandidat, Katalogkandidat,
Fixture, technische Pfade und Baseline und verlangt in einem neuen,
ausdrücklich autorisierten Auftrag Implementierung, Tests, unabhängigen
Technikreview, geänderte Hashes und erneuten Contentlauf. Der Contentrunner
ändert keine Runtime und akzeptiert weder ein altes Technikreview noch alte
Piloten als Fortsetzung. Nach der externen Änderung invalidieren die neuen
Bytes Kandidat und Fixture; eine neue `framework_design`-Order muss Kandidat
und alle Piloten neu ausstellen.

Nur aus drei validierten deklarativen Einzelpiloten erzeugt der Runner
anschließend deterministisch
`article_framework_pilot_receipt.v2` und bindet Kandidat sowie jedes
erforderliche Einzelreceipt mit Byte- und Inhaltshash.

Bei `owner_approval_required=true` muss danach ein Mensch ein getrenntes
`framework_owner_approval_receipt.v1` für denselben Kandidatenhash ausstellen.
Dafür emittiert die Runtime genau eine Human-Work-Order
`framework_owner_approval` an `framework-owner-approver`, die Kandidaten-,
Katalogkandidaten- und Composite-Pilothash vollständig bindet.
Erst die deterministische `framework_catalog_activate`-Work-Order darf
Framework und Katalog atomar aktivieren. Ihr
`framework_catalog_activation_receipt.v1` belegt erwarteten alten Kataloghash,
noch fehlendes Ziel, No-overwrite und den resultierenden Kataloghash. Designer,
Pilot und Owner-Receipt schreiben keine aktiven Dateien. Erst nach dieser
Aktivierung entsteht ein neuer vollständiger Coverage-Plan; ein Plan-Delta ist
ungültig.

### `extraction_obligations`

Für jede aktive Kombination aus Source × Cluster × `expected_claim_type`
existiert genau eine Pflicht:

```json
{
  "obligation_id": "safe-id",
  "source_id": "safe-id",
  "cluster_id": "safe-id",
  "expected_claim_type": "safe-id",
  "required": true,
  "required_for": ["article-id"],
  "plan_risk_tags": ["safety"]
}
```

`required` verlangt eine terminale Auflösung vor `writers_ready`, ist allein
aber kein High-Risk-Signal. `required_for` bindet die Zielartikel;
`plan_risk_tags` bilden nur planseitige Eskalationssignale ab. `standard` darf
nicht mit erhöhten Tags kombiniert werden. Zulässig sind `standard`, `safety`,
`dose_or_reference`, `interaction`, `vulnerable_population`, `controversy`,
`stage4_relevance` und `warning`. Freie Rollen dürfen Tags nur ergänzen und
damit eskalieren, nie deterministisch erkannte Risiken entfernen.

Jede materielle Kontroverse eskaliert unabhängig von freier Annotation ihre
Sources, Cluster, Pflichten und Planbindung mit `controversy`. Eine
Darstellungsentscheidung wie `limit_claim` oder begründetes Weglassen hebt
diese Risikoeinstufung nicht auf.

### Begrenzte Neuplanung bei neuem Konflikt

Ein bei der Originalquellenextraktion neu gefundener materieller Konflikt
erzeugt eine neue `coverage_planning`-Work-Order, deren Scope nur betroffene
Sources, Cluster, Pflichten, Kontroversen und Artikel umfasst. Output ist
erneut genau ein vollständiger `coverage_plan.v2` mit neuem `content_hash`.
Unbetroffene IDs und per-article Lineages bleiben stabil. Ein separates
Plan-Delta ist kein aktives Austauschformat. Neue Pflichten werden vor dem
Gate extrahiert und geprüft; ein bereits bestandenes Gate wird nie umgangen.

## Originalquellenextraktion

Das rein technische `evidence_pipeline_build.v2` wird deterministisch aus
Coverage, Source-Artifact-Receipt, sicheren Pfaden und `C=4` erzeugt/gecached;
es braucht keinen Coordinator-Agenten. Jede Source gehört danach genau einem
Extractor-Shard. Vor dem Lesen werden die bereits eingefrorenen Bytes gegen
Receipt und `source_content_hash` geprüft. Re-Fetch oder alternativer Locator
ist verboten. Der Extractor
beantwortet jede aktive Pflicht terminal:

- `extracted`: mindestens ein atomarer Record;
- `not_reported`: die gebundene Quelle berichtet den erwarteten Claim-Typ
  nach nachweisbarer Prüfung nicht;
- `blocked`: Quelle, Locator, Hash oder Aussage ist nicht verlässlich prüfbar.

`not_reported` ist ein fachliches Ergebnis, kein erfundener Nullwert. Es löst
die gebundene Pflicht terminal auf, erzeugt aber keinen Claim und zählt allein
niemals als Deckung eines Pflichtclusters. Der Cluster muss durch andere
bestandene Records getragen werden oder der betroffene Artikel bleibt
blockiert. `blocked` schließt `writers_ready`.

### `source_evidence_record.v2`

Jeder atomare Record bindet mindestens:

- `record_id`, `obligation_id`, `source_id`, `cluster_id` und `claim_type`;
- stabile `subject_key` und `predicate_key`;
- `claim`, strukturierter `context` und optional `conflict_set_id`;
- Population/Bezugsrahmen, `value` oder `null`, `unit` oder `null`, Richtung
  und Unsicherheit;
- präzisen Originallokator sowie optionale, nur eskalierende
  `extractor_risk_tags`;
- nur bei explizitem Stage-4-Auftrag optional `stage4_relevance` mit
  `status=candidate`, quellengedeckter Begründung und Locator.

Evidence-Record, Shard und Bundle dürfen niemals eine operative
`stack_projection.v2`, `stack_role`, Auswahl/Default, Sichtbarkeit oder
Lifecycle-Entscheidung enthalten. `stage4_relevance` behauptet nur, dass die
Originalquelle potenziell nutzbare Stage-4-Fakten trägt; sie trifft keine
Stackentscheidung.

Jeder numerische Wert braucht eine Einheit; `µ` bleibt korrektes UTF-8. Ein
Record enthält genau eine prüfbare Aussage. `subject_key`, `predicate_key` und
Kontext erlauben deterministische Dubletten- und Konflikterkennung; materielle
Abweichungen teilen eine `conflict_set_id`.

### `source_evidence_shard.v2` und Bundle

Ein Shard bindet Coverage-ID/-Hash, eindeutige Sources, Extractoridentität,
Extraktionszeit, Records, Warnungen, alle terminalen `obligation_results` und
`content_hash`. Resultat und `record_ids` müssen übereinstimmen.

Der deterministische Merger prüft Sourcebytes, Bindungen, Eindeutigkeit und
vollständige Pflichtabdeckung, sortiert ohne inhaltliche Transformation und
erzeugt genau ein `source_evidence_bundle.v2`. Der Merger besitzt eine andere
Identität als alle Extractor-Identitäten.

## Deterministisches effektives Risiko

Die Laufzeit berechnet pro Pflicht `effective_risk=low|high` und
`full_review_required` neu. `high` gilt, wenn mindestens eine der folgenden
Bedingungen zutrifft:

- Claim-Typ oder Cluster betrifft Referenzwert/UL, Sicherheit, Nebenwirkung,
  Interaktion/Kontraindikation, vulnerable Population, materielle Kontroverse,
  `stage4_relevance.status=candidate` oder Warnung;
- Ergebnis ist `not_reported`;
- Source-, Cluster-, Plan-, Record- oder Warnungsdaten eskalieren entsprechend.

Eine gewöhnliche Studienzahl oder Einheit (`study_quantity`,
`numeric_result`) wird vollständig deterministisch auf Typ, Einheit, Kontext
und Sourcebindung geprüft, ist allein aber kein Full-Review-Signal. Alles
andere ist `low`. `required=true` erzwingt lediglich ein terminales
Pflichtergebnis für das Gate. Plan- und Extractor-Tags können ausschließlich von
`low` nach `high` eskalieren. Weder ein fehlendes Tag noch `standard` darf eine
objektiv erkannte High-Risk-Bedingung herabstufen.

## Unabhängiges Facts-Review

### Reproduzierbare Auswahl

High-Risk-Pflichten einschließlich `not_reported` werden vollständig geprüft.
Low-Risk-Pflichten werden mit
`algorithm=extractor_quality_sha256_v3` je Extractor-Stratum reproduzierbar
nach SHA-256-Rang ausgewählt:

```text
sample(n) = min(n, 10, max(min(3, n), ceil(0.20 × n)))
```

Für `n < 3` werden damit alle geprüft. Cluster-ID und Source-Typ fließen pro
Pflicht in das SHA-256-Rankmaterial ein und stehen als sortierte
`cluster_ids`/`source_types` im Manifest, erzeugen aber keine eigenen
Mindestquoten. Dadurch bleibt systematische Extractorqualität kontrolliert,
ohne viele kleine Cluster × Source-Typ × Extractor-Strata versehentlich fast
vollständig zu reviewen. Ein Fehler in einer Low-Risk-Stichprobe eskaliert
genau den betroffenen Extractor-Scope einmal auf vollständige Prüfung; ein
weiterer Fehler blockiert. Es gibt höchstens diese eine
Stichprobenerweiterung. Die Auswahl wird als hashgebundenes
`review_sample_manifest.v2` eingefroren und nie vom Reviewer frei gewählt.

Bei der Erweiterung enthält `selected[]` ausschließlich das bisher ungeprüfte
Delta. Bereits bestandene Einheiten werden nicht erneut geprüft, sondern als
`carried_forward[]` mit exakt `obligation_id`, `prior_review_id`,
`prior_review_hash`, `prior_sample_manifest_hash` und `mode` gebunden. Diese
Nachweise sind Teil des neuen Manifest- und Work-Order-Hashes; nur das
ungeprüfte Delta erscheint in neuen Reviewoutputs.

### `source_facts_review_input.v2`

Der Runner friert pro Auswahlrunde `sampling_round=0|1` die gemeinsame Auswahl
ein und partitioniert das ungeprüfte `selected[]` in höchstens vier disjunkte
Shards. Das Evidence-Manifest bindet sie vollständig als
`source_facts_review_slices[{sampling_round,shard_id,path}]`; Pfade und
`shard_id` sind eindeutig, Pflichten überlappen nicht. Jeder daraus abgeleitete
Reviewinput bindet Run, Coverage- und Bundlehash, Sample-Manifest, genau seinen
`selected[]`-Slice, die unveränderlichen `carried_forward[]`, ausgewählte
Pflichtresultate/Records, Originalquellenbindungen und genau einen erlaubten
Outputpfad. Der Reviewer darf weder Auswahl noch Bundle verändern.

Die Runtime hält Reasoning-Slices möglichst tierhomogen: eine reine initiale
Low-Risk-Stichprobe läuft `standard`; Full-/High-Risk-Auswahl und jede
`sampling_round=1` laufen `high`. Enthält eine Runde beides und stehen
mindestens zwei Shards zur Verfügung, trennt sie High und Low in disjunkte
Shards. Passt nur ein gemeinsamer Shard, gilt für ihn das höhere Tier. Der
Reviewer übernimmt das ausgegebene `reasoning_tier` und stuft es nicht selbst
um.

Aktive Shards derselben Runde müssen verschiedene `reviewer.id` tragen. Die
zweite Runde enthält ausschließlich das noch ungeprüfte Delta eines nach
Sample-Fail erweiterten Stratums; bestandene Einheiten bleiben carried forward.

### `source_facts_review.v2`

Jeder Review-Shard bindet Bundle- und Samplehash, Revieweridentität,
Reviewzeit, exakt die ausgewählten `obligation_results` und alle Records
extrahierter ausgewählter Pflichten. Geprüft werden Originalfundstelle,
Vollständigkeit, Claim, Kontext, Zahl, Einheit, Unsicherheit, Konflikt und
Risikoeinstufung. Resultate sind `PASS|FAIL`; PASS behält keine Findings.

Ein fachlicher Review-FAIL repariert nicht das Review und startet keine
Voll-Extraktion. Die Runtime darf genau einmal je betroffenen Extraktionsslice
eine `source_extraction_repair`-Work-Order mit `high` ausgeben. Sie bindet
Vorgängershard, Failure-Fingerprint und fehlgeschlagene Reviews, beschränkt den
aktiven Scope auf `failed_obligation_ids`, verwendet nur die eingefrorenen
Originalbytes und verlangt
`repair_lineage{work_order_id,predecessor_shard_hash,failure_fingerprint,
repair_generation=1}`. Alle unbetroffenen Obligations bleiben bytegleich im am
selben deklarierten Pfad ersetzten Shard. Danach laufen Merge und nur die
dadurch invalidierten Facts-Prüfungen neu. Scheitert der unabhängige Review
dieses einmal reparierten Shards erneut, endet der Scope als
`REPAIR_EXHAUSTED`; es gibt keine zweite Repairgeneration.

## Gate, Pakete und Lock

`facts_completeness_gate.v2` wird erst nach exakter Reviewabdeckung erzeugt. Es
bindet Plan, Bundle, Sample, alle Reviews, Artikelgates und Validiereridentität.
Es bleibt geschlossen, wenn eine aktive Pflicht fehlt oder `blocked` ist, ein
Review fehlt/fehlschlägt, eine erforderliche Clusterabdeckung fehlt, eine
Bindung veraltet ist oder eine Rollenidentität kollidiert.

`not_reported` schließt eine Pflicht terminal, deckt aber keinen Pflichtcluster.
Das Gate darf nur öffnen, wenn andere bestandene Records die verbleibende
Clusterabdeckung und den geplanten Artikel tragen. Es erfindet keinen
Ersatzclaim.

Für jeden geplanten Artikel entsteht genau ein Paket:

- `facts_package_for_stage2.v2` bindet Artikel, tatsächliche Frameworkdatei,
  Cluster, Pflichten, Resultate, freigegebene Records, sichtbare Quellen,
  das exakt planseitige `source_assignment`, `source_presentation_label_de`,
  vollständigen SEO-Brief und den
  artikelbezogenen `selected_link_slice`;
- `facts_package_for_stage3.v2` bindet zusätzlich Blueprint,
  `required_cluster_ids`, Kontroversen, den `common_assumption_review` und die
  Grafikentscheidung. Der Packager ergänzt jeden Annahmencheck um die exakten
  bestandenen `record_ids`, die aus dessen Obligation-IDs entstehen. Bei `generate`
  löst der Packager die planseitigen `cluster_ids` und `obligation_ids` in die
  exakten bestandenen `record_ids` auf; bei `none` bleiben alle drei Mengen
  leer.

Jedes Artikelpaket bindet außerdem `facts_reviewer_ids` als vollständige,
sortierte Reviewer-ID-Menge des global bestandenen Gates und
`direct_facts_reviewer_ids` als Teilmenge der Reviewer, die Pflichten dieses
Artikels direkt geprüft haben. Wurde ein Artikel durch die bestandene
Low-Risk-Stichprobe ohne direkt ausgewählte eigene Pflicht akzeptiert, ist
`direct_facts_reviewer_ids=[]` gültig und wird nicht durch ein zusätzliches
Artikelreview aufgefüllt.

Jedes Paket trägt neben seinem vollständigen `package_content_hash` einen
stabilen `article_package_hash`, gebildet aus Artikel-ID, Stage und
`evidence_membership_hash`. Der Content-Hash belegt die gesamten Paketbytes im
Lock; der Article-Package-Hash ist die artikel-lokale fachliche Bindung für
Writer, Compiler und Review. Änderungen an fremden Paketslices ändern ihn
nicht.

Nur wenn `stage4_requested=true`, erzeugt der deterministische Packager nach
bestandenem Gate und vor dem finalen Evidence-Lock zusätzlich genau ein
`facts_package_for_stage4.v2`. Es bindet Run, Coverage, Bundle, Gate, alle
vollständig geprüften `stage4_relevance.status=candidate`-Records, deren Facts
und Source-Locators. Es enthält weder `stack_role` noch
Ingredient-/Population-Auswahl, Sichtbarkeit, Default, Lifecycle oder eine
fertige Projektion. Das Paket ist kein Writerinput und enthält ausdrücklich
keinen Evidence-Lock-Hash.

`evidence_pipeline_lock.v2` bindet Originalforschung,
`research_source_artifact_receipt.v2`, finalen Coverage-Plan, Sourcebytes,
Shards, Bundle, Sample, Reviews, Gate, Framework-Katalog,
Stil-Snapshot sowie die tatsächlichen Framework- und Stildateien und jedes
Writerpaket mit erlaubtem Pfad, Bytehash und Inhaltshash. Bei
`stage4_requested=true` bindet er zusätzlich das Stage-4-Paket
mit Pfad, Byte- und Inhaltshash. Nur wenn alle geplanten Artikelgates `PASS`
sind und alle Writerpakete exakt im Lock stehen, setzt er einmal
`writers_ready=true`. Stage 2 und Stage 3 starten danach parallel; kein
Einzelpaket darf den run-weiten Start vorziehen. `writers_ready` wird weiterhin
ausschließlich aus den Artikelgates abgeleitet.

Beim Artikelimport wird jedes Writerpaket erneut gegen Lock, Gate, Artikel-ID,
Stoff, Sprache, Cluster-, Pflicht- und Recordmenge geprüft. Das Stage-4-Paket
wird im separaten Zweig gegen Lock, Gate und seine exakte Candidate-Recordmenge
geprüft. Ein frei angegebener alternativer Pfad ist niemals ausreichend.

Für jedes Artikelpaket berechnet die Runtime zusätzlich einen stabilen
`article_lineage_hash` aus dem artikelbezogenen Plan, den relevanten Clustern,
Pflichten, Pflichtergebnissen, Records, sichtbaren Quellen, Artikelgate,
`framework_hash`, Policy- und Validator-Version. Der
`evidence_membership_hash` bindet Artikel-ID, Stage, diesen Lineage-Hash,
`framework_hash`, Policy- und Validator-Version. Er bindet bewusst weder den
selbstreferenziellen Paket-Inhaltshash noch den globalen Lockhash. Der aktuelle
Evidence-Lock muss Paketbytes und Mitgliedschaft getrennt bezeugen. Damit
invalidiert eine Änderung nur Artikel, deren tatsächliche Mitgliedschaft oder
eigene Abhängigkeit betroffen ist.

## Writer-, Asset- und Publication-Bindung

### Framework- und Style-Lineage

Jede Frameworkbindung hat exakt `framework_id`, `version`, `variant`, `path`
und `byte_hash`; `framework_hash` ist der kanonische Hash dieses vollständigen
Objekts. `path` bezeichnet die tatsächlich gelesene Repositorydatei, deren
Bytes mit Katalog und Bytehash übereinstimmen müssen. Bei Stage 3 werden
Stilannotation und Stil-Snapshot-Manifest zusätzlich als getrennte
Pfad-/Byte-/Inhaltshash-Bindungen geführt. Ein Versionsstring ohne reale
Dateibindung reicht nicht. Die im Manifest referenzierten Vollsnapshots werden
beim Lockaufbau gegen ihre Bytehashes validiert, aber nicht in jede Writer- oder
QA-Work-Order eingebettet. Nur eine konkrete Stilunklarheit rechtfertigt das
gezielte Öffnen eines manifestgebundenen Snapshots.

### `article_result.v2`

Writer erzeugen pro Work-Order sichtbares Markdown und genau ein Receipt mit
exakt diesen Feldern:

```json
{
  "schema": "article_result.v2",
  "execution_id": "safe-id",
  "article_id": "safe-id",
  "stage": "stage2",
  "slug": "safe-slug",
  "writer": { "role": "clinical-study-interpreter", "id": "safe-id" },
  "written_at": "2026-07-14T12:00:00.000Z",
  "revision": 0,
  "work_order_id": "sha256:...",
  "markdown_path": "run-relative/path.md",
  "article_byte_hash": "sha256:...",
  "facts_package_hash": "sha256:...",
  "evidence_membership_hash": "sha256:...",
  "framework": {
    "framework_id": "stage2.clinical_single_study",
    "version": "2.0.1",
    "variant": "clinical_single_study",
    "path": "codex-files/frameworks/01_framework_single_study.md",
    "byte_hash": "sha256:..."
  },
  "framework_hash": "sha256:...",
  "used_record_ids": [],
  "used_source_ids": [],
  "assumption_check_coverage": [],
  "asset_ids": [],
  "policy_version": "safe-version",
  "render_profile": "study_article_v2",
  "previous_review_id": null,
  "previous_compiled_payload_hash": null,
  "content_hash": "sha256:..."
}
```

Stage 3 verwendet die entsprechende Writerrolle und
`render_profile=knowledge_magazine_v1`. `revision` liegt in `0..2`. Revision 0
setzt beide `previous_*`-Felder auf `null`; Revision 1/2 bindet den unmittelbar
vorigen Review und kompilierten Payload. `facts_package_hash` entspricht dabei
dem stabilen `facts_package.article_package_hash`; Pfad, Bytes und
`package_content_hash` des vollständigen Paketfiles bleiben getrennte
Work-Order-/Lock-Bindungen. Ein separater Hash des vorigen Reviews ist kein
Receiptfeld: Die vollständige revisionierte Work-Order bindet Reviewhash,
Findings, `diff_hash` und serverseitigen Scope, und `work_order_id` bezeugt
exakt diese Order. `used_record_ids`, `used_source_ids`,
`assumption_check_coverage` und `asset_ids` müssen der Paket-/Markdownwirkung
exakt entsprechen. Stage 2 setzt `assumption_check_coverage=[]`; Stage 3 führt
jeden geplanten Check genau einmal mit `assumption_id`, einem Conclusion-Wert
aus `supported|partly_supported|not_supported|contradicted|context_dependent|unclear`
sowie den paketidentischen `obligation_ids` und `record_ids`. `content_hash` wird über das
kanonische Objekt ohne sich selbst gebildet. Stage 2 enthält keine technischen
Blöcke im Markdown.

### `article_asset.v2`

Standard ist keine Grafik. Bei `graphic_decision.mode=generate` existiert vor
QA exakt eine integrierte Rastergrafik und genau ein Receipt mit:

```text
schema, asset_id, article_id, asset_index, asset_path, asset_byte_hash,
mime_type, width, height, alt, caption, position{index,markdown_offset},
record_ids, creator{role=article-graphic-generator,id,writer_execution_id},
work_order_id, created_at, content_hash
```

Pfad und Bytes müssen existieren, MIME und Dimensionen aus denselben Bytes
stammen, Alt/Caption/Position mit dem sichtbaren Markdown übereinstimmen und
`record_ids` exakt die vom Packager aufgelöste Grafikentscheidung tragen.
`creator.writer_execution_id` und `work_order_id` müssen exakt dieselbe Stage-
3-Writer-Ausführung und die tatsächlich ausgegebene Writer-Work-Order wie
`article_result.v2` binden. `article-graphic-generator` bezeichnet nur die
Creator-Funktion innerhalb dieses Jobs; es ist keine separate assignee-fähige
Agentenrolle oder zusätzliche Work-Order.
`asset_path` bindet ausschließlich den run-relativen lokalen Bytepfad; R2-Key
und öffentliche URL sind keine Felder des Writer-Receipts. Der Compiler leitet
aus kanonischem Slug, Bytehash und MIME deterministisch den R2-Key
`knowledge/<canonical-slug>/<sha256>.(png|jpg)` und die sichtbare URL ab. Das
Markdown-Bild verwendet einen nichtleeren Alt-Text und erfüllt exakt
`^/api/r2/knowledge/<canonical-slug>/[a-f0-9]{64}\.(png|jpg)$`; die nächste
nichtleere Zeile ist die kursiv formatierte, receiptgleiche Caption. Ohne
vollständiges Asset blockiert der Compiler; ein Briefing oder zweites Asset ist
unzulässig.

### Compiler, echter Render und QA-Input

Der Compiler prüft Quellenparität: verwendete Source-IDs, geordnete sichtbare
Quellen und Quellenrelationen entsprechen exakt dem Paket. Interne Links
stammen ausschließlich aus dessen gebundenem `selected_link_slice`; Writer und
QA erhalten kein Vollinventar. Der deterministische Compiler darf das gecachte
Inventar nur als Link-/SEO-Uniqueness-Index lesen und keinen weiteren Link
auswählen. Sein Cache bindet neben dem Slice den aus allen fremden Live-Routen
normalisierten Titel-/Description-Uniqueness-Hash, damit eine echte neue
Kollision den betroffenen Artikel invalidiert. Er expandiert Quellen und
Assets einmal und friert den Publish-Payload ein; technischen Title und
Meta-Description leitet er erst aus dem finalen Artikel ab.

Zusätzlich erzeugt er genau ein `seo`-Objekt mit `meta_title`,
`meta_description`, `primary_intent`, `internal_link_targets`,
`canonical_url`, `canonical_path`, `robots=index,follow`, `indexable=true`,
Article-`json_ld`, `validated_checks` und `seo_hash`. Der Hash bindet die
öffentliche Teilprojektion aus Meta-Titel/-Description, Canonical-URL/-Pfad,
Robots, Indexierbarkeit und JSON-LD; `primary_intent`, Linktargets und
`validated_checks` bleiben Compilerlineage. Die deterministischen Checks
umfassen striktes UTF-8,
eindeutige Titel und Descriptions innerhalb des Releases sowie gegen das
Live-Inventar, inhaltsproportionale Längen, exakte Canonical-Route,
Indexierbarkeit/Robots und valides Article-JSON-LD. Keyworddichte oder ein
zweites LLM-SEO-Gate sind kein Vertrag.

Jeder Input trägt `schema: article_render_request.v2`, Artikel-ID, Route
`/wissen/<slug>`, `article_byte_hash`, `visible_payload_hash`, den kanonischen
`payload_hash`, `publish_payload` mit `schema: article_visible_payload.v2` und
die compilerseitige `expected_projection` samt `projection_hash`.

Für Stage 3 lautet der echte React-Renderaufruf:

```text
node frontend/render-knowledge-magazine-snapshot.mjs --input <article-render-request.v2.json> [--out <article-render-snapshot.v2.json>]
```

Seine `article_render_projection.v2` enthält exakt `schema`, Artikel-ID, Route,
`template=magazine`, H1, Dek,
`ui{contract_version,eyebrow,toc_title,ingredient_chip,reviewed_date,reading_time,sources_label,sources_count}`,
`sections[{section_id,kind,control_type,heading,order,number,normalized_text,links[{label,url}],tables[{presentation,headers,rows}],assets[{src,alt,caption}]}]`,
`toc[{section_id,label,href}]`, `fazit{section_id,normalized_text}` und
`sources[{source_id,label,url,order}]`. `kind` ist
`overview|content|fazit|control|sources`, `control_type` ist nur bei
`kind=control` `merkkasten|legal_notice`, und `presentation` ist
`data_table|food_grid`. Der Renderer verwendet die echte
React-Komponente mit `renderToStaticMarkup`, `StaticRouter` und JSDOM.

Stage 2 verwendet dagegen ohne zusätzliche Browserwelle
`mode=deterministic-study-projection`. Seine Projektion trägt
`template=study_article_v2`, den vollständigen H1/Dek-/UI-Vertrag und alle
geordneten Content-, Fazit- und Quellenabschnitte samt normalisiertem Text,
Links, Tabellen und Assets. Request und Snapshot binden zusätzlich den
aktuellen `route_fingerprint`; der Snapshot nennt
`renderer.component=deterministic-study-projection` und
`contract_version=deterministic-study-projection.v2`. `actual_projection` ist
vollständig und kanonisch identisch zur unabhängigen Compilerprojektion. Dieser
Pre-Publish-Nachweis behauptet keinen zweiten React-Render: die reale
Stage-2-Route wird nach Publish zwingend durch den öffentlichen vollständigen
DOM-Projektionsreadback bewiesen.

Beide Zweige erzeugen `schema: article_render_snapshot.v2` mit `request_hash`,
Renderer-/Contractversion, denselben Lineage-Hashes, `html_hash`, `dom_hash`,
vollständiger `actual_projection`, `projection_checks`, Checks, stabilen
Fehlercodes, `result` und `content_hash`. PASS verlangt kanonisch exakte
Projektion, `errors=[]` und nur bestandene Checks. Stage 3 bindet zusätzlich
`structure_hash`, `actual_projection_hash` und detaillierte echte DOM-Werte;
`actual_projection_hash=projection_hash` ist dort Pflicht.
`compiled_payload_hash` darf nur optional ohne Hashzirkel gebunden werden. Beim
Stage-3-CLI ist Exitcode 0 PASS, 1 struktureller FAIL mit Snapshot, 2
Input/Usage und 3 interner Rendererfehler.

Ein getrenntes `renderer_style_validation.v2` validiert im echten Browser die
Computed Styles. Es bindet Validatorversion
`knowledge-magazine-route-browser-contract.v2.2.0`, `renderer_style_hash`,
`fixture_hash`, `route_fingerprint=renderer_style_hash`, die vollständigen
`route_fingerprint_parts{files[],resolved_versions}`, den tatsächlich
hydrierten `route_contract`, Browser, Viewport, Checks, Errors, Result und
`content_hash`. Artikel- oder Snapshot-Hashes gehören nicht hinein. Die
Runtime erzeugt beziehungsweise validiert es genau einmal pro unverändertem
`{validator_version,renderer_style_hash,fixture_hash}` und verwendet den PASS
gecacht für alle Artikel dieses Route-/UI-Vertrags.

Compiler- und Assetfehler werden mit einem deterministischen
`failure_fingerprint` aus Fehlercode, Artikel, Revision und betroffenem Scope
dedupliziert. Alle im selben Compilerlauf gleichzeitig beobachteten Fehler
werden normalisiert, sortiert und in genau einem `bundled_findings`-Paket samt
einem zusammengesetzten Fingerprint gebunden; parallele Reparaturorders je
Einzelfinding sind verboten. Pro `(article_id,revision,failure_fingerprint)`
darf die Runtime genau einen scoped Writer-Reparaturauftrag ausgeben. Ein
zweiter unterschiedlicher Fingerprint ist nur für einen nach dieser Reparatur
neu beobachteten Fehlerbund zulässig, nicht für ein schon im ersten Lauf
bekanntes Geschwisterfinding. Eine Wiederholung oder ein dritter Fingerprint
blockiert hart und startet weder Stofflauf noch freien Review.

Die `publication_qa`-Work-Order bindet `compiled_article.v2` samt einmaligem
QA-Payload, Validation-Receipt, Writerreceipt, Facts-Paket, Assets,
Renderrequest/-snapshot und `projection_hash` jeweils mit erlaubtem Pfad,
tatsächlichem Bytehash und Inhaltshash. Bei Stage 3 bindet sie zusätzlich das
gecachte Style-PASS-Attest; die normalen Styledateien sind genau Annotation und
Snapshot-Manifest, die Vollreferenzen keine eingebetteten Standardinputs. Bei
Stage 2 bindet sie stattdessen den vollständigen
`deterministic-study-projection.v2`-Snapshot mit Route-Fingerprint; ein leerer
oder nur aus Überschriften gebauter Markdown-Snapshot reicht nicht.

### `article_publication_review.v2`

Das Review bindet `review_id`, die tatsächlich ausgegebene `work_order_id`,
Artikel, Stage, Revision,
`review_type=full|targeted_recheck`, kompilierten, sichtbaren und QA-Payload,
Render-Snapshot, Validation-Receipt, Facts-Paket, Writer-Execution-ID,
Assethashes, Revieweridentität, Zeitpunkt, `result`, Prüfpässe,
`reader_questions`, `findings` und `content_hash`. Initial gilt `full`;
Revisionen 1/2 binden `previous_review_id`,
`previous_compiled_payload_hash` und den serverseitigen `recheck_scope` samt
`diff_hash`.

Eine `targeted_recheck`-Work-Order bindet als echte Inputs
`previous_publication_review`, `previous_compiled_article` und für jedes
gebundene Asset paarweise `asset_<n>` plus `asset_receipt_<n>`. Ihr `task`
enthält zusätzlich exakt `previous_review_hash`, `previous_findings_hash`,
`allowed_finding_keys`, `asset_bindings` und
`required_scoped_passes=["A","B"]`. Fehlende Assetbytes oder nur frei notierte
Pfade blockieren.

Full Review und Recheck sind nur gültig, wenn `work_order_id` die exakte
ausgegebene `publication_qa`-Order samt Artikel, Revision, QA-/Renderhash,
Writer-Execution, Kerninputs, Outputpfad und
`assignee.independent_from_ids` bezeugt. Ein nur schema- und
payloadpassendes, aber nicht ausgegebenes Receipt ist ungültig.

PASS ist ausschließlich bei Q1/Q2/Q3 = `Ja`/`Ja`/`Nein`, beiden Prüfpässen
PASS und ohne blockierendes Finding zulässig. FAIL speichert die tatsächlichen
Antworten und mindestens ein blockierendes Finding. Jedes Finding besitzt
exakt `category`, `pass=A|B`, `location`, `target`, `record_ids`,
`minimal_scope`, `code` und `message`; `minimal_scope` ist ein konkreter
nichtleerer String, vage Fundstellen oder pauschale Umschreibaufträge sind
ungültig. Der `recheck_scope` enthält `diff_hash`, `changed_lines`,
`neighbour_paragraphs`, `touched_claims`, `touched_sources`, `touched_assets`
und `visible_side_effects`. `passes.facts_safety_sources` und
`passes.reader_seo_template` sind bei Full Review wie Recheck immer vorhanden;
im Recheck bindet jedes Passobjekt den erwarteten `scope_hash`. Nach einer
gebündelten Feedbackrunde gibt es höchstens zwei `targeted_recheck`-Runden. Sie
prüfen ausschließlich serverseitigen Diffscope, Nachbarabsätze und abhängige
sichtbare Wirkung; Finding-Keys müssen Teil von `allowed_finding_keys` sein und
es entsteht keine neue freie Findingliste.

Ein Review für veraltete Inputbytes wird nicht weiterverwendet und ist kein
Grund für eine freie Vollwiederholung: Die Runtime erzeugt eine neue
hashgebundene QA-Work-Order. Compiler, Publication-Gate, `content_release.v2`,
Executor und `content_publish_receipt.v2` binden exakt dieselbe eingefrorene
Payload samt Quellen und Assets. Details stehen im
[`Pipelinevertrag`](../../docs/content-pipeline-v2.md).

## Release, öffentlicher Readback und Korrekturen

Ingredient-/Source-Auflösung und R2-Asset-Staging sind late-bound Publish-
Preflight, keine Research-/Evidence-/Writerbarriere. Erst nach bestandenem
Publication-Gate und nur bei `manifest.publish.required=true` darf die Runtime
folgende Maschinenorders emittieren; unabhängige Orders laufen parallel. Ein
Draftlauf erzeugt weder D1-/R2-Write noch Phantomreceipt:

- `ingredient_target_readback` ist read-only und erzeugt
  `ingredient_target_receipt.v1`. Es bindet Schema, Run, kanonischen Selector,
  `captured_at`, Authority, exakt
  `target{ingredient_id,canonical_name,canonical_slug,status=active,version,
  identity_hash}`, die ausgegebene Work-Order und `content_hash`. Fehlend,
  inaktiv oder mehrdeutig führt zu `WAITING_FOR_INGREDIENT_TARGET`; implizite
  Anlage ist verboten.
- `source_catalog_sync_request.v1` bindet Run, Ingredient-ID/-Identityhash und
  die sortierten Sources mit lokaler ID, Typ/Kind, Label, kanonischer URL,
  DOI/PMID und Originalbytehash. `source_catalog_sync` darf nur bei expliziter
  Publish-Autorisierung pro Ingredient plus DOI, PMID oder kanonischer URL
  additiv/idempotent auflösen oder anlegen. Cross-Ingredient-, Identifier- oder
  Mehrdeutigkeitskonflikte scheitern geschlossen.
- `source_resolution_receipt.v1` bindet ausgegebene Work-Order, Run, Request-
  und Ingredienthash/-ID, Zeitpunkt, `result=PASS`, die mengengleichen
  `mappings[{source_id,resolved_source_id,resolution=existing|created,
  canonical_url,doi,pubmed_id,persisted_version,persisted_hash}]` und
  `content_hash`. Es schreibt keinen Artikel und ist kein Fakteninput.
- Nur bei tatsächlich gebundenen Assets erzeugt die Runtime genau ein
  `asset_deployment_request.v1`. `asset_stage` läuft deterministisch unter
  `WAITING_FOR_ASSET_DEPLOYMENT` und erzeugt
  `asset_deployment_receipt.v1`; Request und Receipt binden Run,
  Artikel-/Assetidentität, lokale Bytes, MIME, Maße, den deterministisch
  abgeleiteten R2-Key `knowledge/<canonical-slug>/<sha256>.(png|jpg)`, die
  einzige öffentliche URL nach
  `^/api/r2/knowledge/<canonical-slug>/[a-f0-9]{64}\.(png|jpg)$`, exakte
  Work-Order und einen öffentlichen GET-Readback von Bytes, MIME und Maßen.
  Ohne Asset existiert weder Order noch Receipt. Staging braucht denselben expliziten
  Publish-Guard und bleibt additiv/idempotent.

R2-Asset- und Source-Katalog-Staging sind getrennte versionierte,
idempotente, additive, receiptgebundene Vorstufen; es wird keine
serviceübergreifende Atomizität behauptet. Ein späterer Fail darf nur
unreferenzierte staged Assets oder Sourcezeilen zurücklassen. `atomic=true` im
Release gilt ausschließlich für den D1-Batch aus Artikeln, Ingredient-/
Quellenrelationen, Stage-2-Interpretationen und allen `same_release`-Artikeln;
dieser Satz wird vollständig oder gar nicht sichtbar.

`content_release.v2` trägt `atomic=true`. Jeder Artikel bindet neben frozen
Payload, Relations, Assets, Gates und Guard genau seine
`internal_link_dependencies`; diese sind exakt mengengleich zu
den Einträgen aus `selected_link_slice.links` mit
`target_state=same_release`. `live`-Links bleiben im Slice, in Artikellineage,
sichtbarer Payload und Readback, sind aber keine Release-Abhängigkeiten.
Zusätzlich bindet er das vollständige Compiler-
`seo`-Objekt samt `seo_hash` sowie `expected_projection` samt
`projection_hash`. Jede
`target_state=same_release`-Kante muss auf einen anderen Artikel desselben
Release zeigen; der Publisher wendet den gesamten Satz atomar oder gar nicht
an.

Die Zeitfelder werden erst im Release late-bound. Bei `write_guard.mode=create`
gilt `published_at=modified_at=reviewed_at` der bestandenen Publication-QA. Nur
ein Update benötigt den autoritativen Article-Target-Readback: `published_at`
bleibt dessen persistiertes `created_at`, `modified_at` ist das ISO-normalisierte
Maximum aus Publication-`reviewed_at`, persistiertem `updated_at` und
`published_at`. Persistenz und öffentliche Detail-API müssen diese drei Werte
exakt reproduzieren; Writer berechnen oder ändern sie nicht.

Der Release bindet außerdem exakt ein aktives Ingredient, die mengengleiche
`ingredient_ids`-Relation, den `source_resolution_receipt_hash` und
`source_projection` mit
`schema=knowledge_article_sources_projection.v2`, Facts-Paket-/Relationshash
und Ingredient-IDs. Bei Stage 2 enthält sie die unveränderten externen
Originalquellenrelationen mit kanonischem bibliografischem Label und
Originallokator. Bei Stage 3 enthält sie ausschließlich die geordneten internen
Stage-2-Carrier mit bytegleichem deutschem `source_presentation_label_de` und
gebundener `/wissen/...`-Route. Genau diese stage-spezifische Projektion wird
als `sources_json` v2 gespeichert; Relationstabelle, API und öffentliche
Quellenanzeige müssen dieselben IDs, Labels und URLs in derselben Reihenfolge
liefern.

Für Stage 2 enthält `stage2_interpretation_projection[]` pro sichtbarer Source
genau eine `status=accepted`-Interpretation mit Ingredient-ID, lokaler und
aufgelöster Source-ID, Artikel-Slug sowie
`structured_summary{schema=study_interpretation_summary.v1,
source_content_hash,facts_package_hash,evidence_membership_hash,record_ids,
facts[]}`. Diese Facts sind die freigegebenen Originalquellenrecords; Artikel-
Markdown oder artikelabgeleitete Extrakte sind keine Datenquelle. Stage 3
erzeugt keine eigene Interpretation.

`publication_apply` wird ausschließlich durch den Maschinen-Dispatcher mit
der exakt ausgegebenen Work-Order gestartet. Der öffentliche DOM-Readback im
`content_publish_receipt.v2` enthält unter
`readbacks.dom.actual.projection` die vollständig beobachtete Projektion und
unter `readbacks.dom.actual.projection_hash` ihren Hash. Die kanonische
Serialisierung muss exakt mit der Releaseprojektion übereinstimmen,
einschließlich TOC, Sections, Links, Quellen, Controls, UI, Tabellen und
Assets. Der SEO-Readback vergleicht analog das
vollständige öffentliche SEO-Teilobjekt und den `seo_hash`; einzelne
Stichproben oder bloße PASS-Strings reichen nicht.

Der Renderer-Request bindet top-level außerdem sortierte, eindeutige, positive
`affected_ingredient_ids` und gleich geordnete `badge_expectations`. Jeder
Eintrag lautet exakt
`{ingredient_id,studies_rule,expected_has_studies,dge_rule,expected_has_dge}`.
Ein Stage-2-Artikel setzt `studies_rule=REQUIRE_TRUE` und
`expected_has_studies=true`; andernfalls gilt bei gebundenem Prestate
`PRESERVE`, ohne Prestate `API_DOM_PARITY`. Für DGE gilt ausschließlich
`PRESERVE` mit gebundenem Prestate, sonst `API_DOM_PARITY`; der Artikellauf
erzeugt keinen DGE-Wert. Erwartungswerte sind bei Parity `null`.

Das separate `knowledge_badge_readback.v1` bindet Releasehash, dieselben IDs,
Regeln und Erwartungswerte sowie pro Ingredient und Origin den frischen Status
aus `/api/knowledge` und dem hydrierten DOM unter `/wissen`, `result` und alle
Mismatches. `Studien` folgt fachlich ausschließlich mit dem Ingredient
verknüpften `status=published`, `article_layer=single_study`-Artikeln mit
`study_interpretation_records.status=accepted`, unabhängig von Dosisfeldern;
`DGE` folgt ausschließlich aktiven öffentlich sichtbaren DGE-Werten. Ein
`MISMATCH` ist ein valides Receipt und technisch erfolgreicher Executor-Lauf:
korrekt committe Artikel bleiben `published=true`, ihr Artikelbranch bleibt
`COMPLETE`, der Aggregate-Status wird jedoch `BLOCKED` mit Technical-/Data-
Eskalation. Es gibt keinen Rollback, Writer-/Publication-QA-Rerun oder
Aggregate-`COMPLETE`; ein späterer Repair prüft nur Overview/API/Cache und die
ableitenden Daten.

Der Persistenzreadback bindet zusätzlich `status`, `article_layer`, Version,
vollständige `sources_json`-v2-Projektion, Ingredientrelationen und – nur bei
Stage 2 – Originalfacts-Interpretationen. Pipelinefremde oder mehrdeutige
Interpretationszeilen blockieren; Legacyfelder für Hero, Dosis und Produktnote
bleiben `null`, und Stage-3-Fazit/-Asset existieren nur in der kanonischen
Body-/Assetprojektion. Create/Update/Already-current binden den jeweiligen
Status- und Layerzustand im Guard.

Roh-HTML/SSR-Prerender, `robots` und Sitemap werden danach genau einmal als
siteweiter SEO-Delivery-Readback erhoben. Sie sind keine Writer- oder
Publication-QA-Eingabe. `CLIENT_RENDERED_ONLY`, fehlende Sitemapaufnahme oder
eine siteweite Robots-Sperre dürfen einen in Inhalt, API, DOM und SEO-
Teilprojektion exakt publizierten Artikel nicht zurückrollen: Der
Artikelbranch bleibt `published=true`, aber `seo_live_claim=false` und der
Aggregate-Status lautet `WAITING_FOR_INDEXABILITY_RELEASE`. Erst die
Site-Infrastruktur schließt diesen Status. Zulässig ist ausschließlich eine
humane `indexability_release_handoff`-Work-Order an
`site-indexability-release-owner`, gebunden an Release und Publish-Receipt.
Sie ändert keine Artikelbytes, führt keinen D1-Write oder zweiten Publish aus
und darf nur die originweite Robots-/Site-Policy freigeben; danach folgt ein
frischer gezielter Public-Readback. Es entsteht keine neue Content-/LLM-Work-
Order.

Bei `operation=article_correction` friert die Runtime vor jeder Bearbeitung ein
`article_correction_input_receipt.v1` mit Vorher-, Kandidaten- und Patchbytes
ein. Das zugrunde liegende `article_correction_request.v1` bindet je genau einen
Vorher-/Kandidatenartikel samt Markdownpfad und vollständig publishbarem
Release-Artikel. Das Receipt enthält deren Byte-/Releasehashes,
`semantic_fingerprint`, `affected_article_ids` und den deterministischen
`article_correction_patch.v1` mit Änderungen, Nachbarschaft und `patch_hash`.
Die Klasse ist vor Zuweisung fest und darf nur nach oben eskalieren:

- `S`: keine LLM-Work-Order; Gleichheit von normalisiertem sichtbarem Text,
  Headings, Tabellen, Links, Zahl-/Einheit-Tokens, Quellenrelationen,
  Identität, Metadaten, Assets, Extracts und badge-treibenden Daten; danach
  direkt `content_release.v2`;
- `M`: genau `article_correction` an `article-correction-editor` mit Output
  `article_correction_result.v1`, danach genau `article_correction_review` an
  die unabhängige Rolle `article-correction-reviewer` mit Output
  `article_correction_review.v1`. Headings, Tabellen, Links, Zahl-/Einheit-
  Tokens, Quellenrelationen, Identität, Metadaten, Assets, Extracts und badge-
  treibende Daten bleiben exakt; nur lokaler sichtbarer Text darf sich ändern.
  Der Review prüft genau `changed_lines_and_neighbourhood`, `readability`,
  `no_system_language` und `unchanged_scientific_meaning`; beide Receipts
  binden die tatsächlich ausgegebene `work_order_id`;
- `L`: ein `affected_pipeline_manifest`, dessen Artikelscope exakt nur
  `affected_article_ids` enthält, danach der normale v2-Facts-/Writer-/QA-
  Slice für diese IDs.

### Exakte M-Korrekturreceipts

Der Editor erzeugt genau ein `article_correction_result.v1` mit:

```text
schema, result=PASS, input_receipt_hash, candidate_markdown_byte_hash,
candidate_release_article_hash, patch_hash,
editor{role=article-correction-editor,id}, edited_at, work_order_id, content_hash
```

Der unabhängige Kurzreview erzeugt genau ein `article_correction_review.v1`
mit:

```text
schema, result=PASS|FAIL, input_receipt_hash, correction_result_hash,
patch_hash, reviewer{role=article-correction-reviewer,id}, reviewed_at,
work_order_id,
checks{changed_lines_and_neighbourhood,readability,no_system_language,
unchanged_scientific_meaning}, findings[], content_hash
```

Jeder Check ist exakt `PASS|FAIL`. Ein Review-PASS verlangt vier PASS und leere
`findings`; ein FAIL benennt mindestens den fehlgeschlagenen Check und einen
konkreten lokalen Befund. Beide `content_hash`-Werte sind der kanonische
SHA-256 des vollständigen Objekts ohne `content_hash`; beide Receipts binden
die tatsächlich ausgegebene `work_order_id` und ISO-8601-Zeitpunkte.

Der M-Reviewer bindet in `assignee.independent_from_ids` mindestens
`article_correction_result.v1.editor.id`. S/M öffnen keine Research- oder
globalen Auditwellen. Alle Klassen verwenden bei explizitem Publish denselben
guarded `publication_apply`-Executor und proportionalen Readback.

## Messereignisse

Jeder Zustandsabschluss hängt genau ein JSONL-Ereignis an
`state_dir/metrics/run-metrics.v2.jsonl` an; bestehende Zeilen werden
nie überschrieben. `nutrient_content_run_metric_event.v2` bindet mindestens
`run_id`, `manifest_hash`, `recorded_at`, `state`, `runner_version`,
`wave_index`, `invocation_elapsed_ms`, `e2e_elapsed_ms`,
`llm_wallclock_ms`, `deterministic_elapsed_ms`, `publish_readback_ms`,
`cache{evidence_hits,evidence_misses,article_hits,article_misses}`,
`revision_counts`, `gate_timings_ms`, `gate_results`, `article_count`,
`work_order_count`, `work_order_counts_by_kind`, `llm_wave_index`,
`llm_work_order_count`, `llm_work_order_counts_by_kind`,
`work_order_timings[]` und `event_hash`. Jeder Timing-Eintrag wird nur aus
einem gültigen `work_order_execution_receipt.v1` abgeleitet und bindet
Work-Order-ID, Kind, Execution-Klasse, `reasoning_tier`, Welle, Start, Ende,
`elapsed_ms`, `result_hash` und Receipt-Hash.
`wave_index` zählt Statusereignisse, `llm_wave_index` nur tatsächliche
LLM-Wellen; Stage 4 erscheint getrennt in Gatezeit/-resultat. Objektzähler
verwenden stabile Schlüssel; `event_hash` bindet den vollständigen Eventbody
ohne sich selbst. Damit werden kritischer Pfad, Reusequote und Schleifen nicht
aus Dateizeitpunkten geschätzt. Parallele Intervalle werden je Welle vereinigt,
sodass Überschneidung nur einmal zählt; LLM-Wallclock,
deterministische Laufzeit und Publish-/Readbackzeit bleiben getrennt. Fehlende
Zeitbelege werden nie geschätzt und ergeben für die Kennzahl
`NOT_MEASURABLE`.

## Separater optionaler Stage-4-Zweig

Nur `stage4_requested=true`, ein bestandenes `facts_completeness_gate.v2` und
das exakte lockgebundene `facts_package_for_stage4.v2` öffnen Stage 4. Erst dort
entsteht das standalone `stack_projection.v2` mit eigenem `records[]`-Array. Es
bindet Run, Coverage-, Bundle-, Gate-, Paket- und Lockhash sowie die exakte
Facts-/Recordmenge. Operative Entscheidungen zu Ingredient, Population,
normalisierter Menge, Stackrolle, Auswahl, Sichtbarkeit und Lifecycle stehen
ausschließlich in diesem standalone Artefakt nach
[`Framework 05`](05_framework_stage_4_stack_sync.md).

Die Runtime emittiert genau eine `stage4_stack_sync`-Work-Order an
`stage4-stack-sync`, gebunden an Paket, Lock, Framework 05, Ziel und den
vollständigen `atomic_projection_replace`-Guard. Der Child-Branch darf parallel
zu den Writern laufen. Er endet mit einem hashgebundenen
`stack_sync_receipt.v2` und eigenem Status/Metrik; Artikelstatus und -Publish
bleiben unabhängig. Der kombinierte Parentauftrag ist erst erfolgreich, wenn
alle angeforderten Branches PASS sind, ein Stage-4-Fail rollt Artikel aber nie
zurück.

Jede projizierte Population, Menge, Einheit, Quelle, Zweck- und
Geltungsgrenze muss ohne Erweiterung aus den gebundenen Paketfacts und exakten
Evidence-Record-IDs folgen. `facts_hash` umfasst die kanonisch geordneten
verwendeten Facts. `recommended_amount` ist nur bei ausdrücklicher
autoritativer Originalquellenklassifikation für exakt dieselbe Population,
Menge, Einheit und Geltungsgrenze zulässig; sonst bleibt die Angabe getestet,
`null` oder blockiert.

Die Projektion wird niemals in Evidence, Facts-Pakete, Writerinputs oder
Artikel zurückgeschrieben. Artikelabgeleitete Langextrakte und RAG-Aufbereitung
laufen separat und dürfen weder Facts-Gate noch Stage-4-Projektion speisen.

Receipt-, Guard-, Idempotenz- und Readbackfelder stehen ausschließlich in
Framework 05. Ein vorhandenes invalides oder lineage-fremdes Receipt blockiert
den Child-Branch ohne automatischen Rewrite.

### Legacy-Inputadapter

Historische eingebettete `source_evidence_record.stack_projection`-Objekte sind
nur read-only Legacy-Input. Der Adapter darf daraus quellengestützte Fakten und
`stage4_relevance` gewinnen, übernimmt aber keine alte operative Entscheidung.
Eine aktuelle standalone Projektion wird nach dem v2-Facts-Gate neu erstellt;
neue Evidence-Artefakte schreiben die Embedded-Form niemals.
