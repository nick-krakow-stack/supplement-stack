# Evidence-Aufbau und Übergabe an Runtime v2

Der Evidence-Builder erzeugt aus bereits vorhandenen Originalquellen-
Extraktionen und unabhängigen Source-Facts-Reviews die fachlich freigegebenen
Writer-Pakete. Er recherchiert nicht, schreibt keine Artikel und veröffentlicht
nichts. Für neue Stoffläufe wird er ausschließlich durch den generischen Runner
aufgerufen:

```powershell
node scripts/run-nutrient-content.mjs `
  --manifest _research_raw/<stoff>/nutrient-content-run.v2.json
```

Ein `--resume`-Flag gibt es nicht. Jeder normale Aufruf prüft die gebundenen
Bytes und setzt am frühesten ungültigen Knoten fort.

## Eine kanonische Runtime-Kette

Ab dem Run-Manifest gibt es genau diese ausführbare Kette:

```text
nutrient_content_run.v2
  -> article_result.v2
  -> validation_receipt.v2
  -> article_publication_review.v2
  -> content_release.v2
  -> content_publish_receipt.v2
```

Vor dem Coverageplan bindet `research_source_artifact_receipt.v2` die
Researchbytes und jede einmal heruntergeladene Originalquelle über
`source_id`, Pfad, Bytehash, Content-Type und verifizierten Locator. Coverage-,
Evidence-, Sampling- und Facts-Gate-Artefakte bleiben fachliche Inputs der
Artikelkette. Sie bilden keine zweite Publication-Kette. Insbesondere
sind `article_provenance.v1`, `content_lint_result.v1`,
`publication_quality_review.v1`, `publication_bundle.v1` und
`publication_receipt.v1` keine Outputs eines neuen v2-Laufs.

Der Runner erzeugt keine scheinbaren LLM-Ergebnisse. Fehlen Research,
Extraktion, Source-Review, Writer-Output oder Publication-Review, gibt er nur
die kleinste disjunkte Menge hashgebundener Work-Orders aus und stoppt im
zuständigen Zustand. Unabhängige Jobs derselben Welle laufen parallel.

Jede externe Work-Order bindet top-level `reasoning_tier` und
`execution_receipt{root,path,schema=work_order_execution_receipt.v1}` in ihrer
exakten `work_order_id`. Nach technisch erfolgreicher terminaler Ausführung
schreibt der Executor das kleine Timingreceipt mit exakter Order und
`result_hash`; dessen `result=PASS` bezeichnet nur Executor-Erfolg, auch wenn
das fachliche Artefakt `FAIL|BLOCKED` meldet. Ein technischer Abbruch schreibt
kein PASS-Receipt. Fachliche Outputs bleiben separat.

Research bleibt formatagnostischer, strikt als UTF-8 dekodierbarer Inhalt. Die
Runtime erfindet dafür kein zweites semantisches JSON-Schema. Stage 1 erzeugt
aber im selben LLM-Lauf die Researchdatei, unveränderte lokale Bytes jeder
ausgewählten Originalquelle und genau ein
`research_source_artifact_receipt.v2`. Fehlt bei bereits vorhandener Research
nur diese Freeze-Grenze, entsteht eine kleine `research_source_freeze`-
Work-Order ohne erneute Recherche. Downstream-Agenten lesen ausschließlich die
eingefrorenen Bytes; Netzwerk-Refetches sind verboten.

Die Researchdatei dokumentiert zusätzlich die gängigsten materiellen
öffentlichen Annahmen als neutrale, prüfbare Leserfragen. Diese Discovery-
Signale sind keine wissenschaftlichen Facts. Erst der Coverageplan bindet sie
als `common_assumption_review` an Sources, Cluster und Obligations; das
Stage-3-Paket ergänzt nach dem Facts-Gate die aufgelösten Record-IDs.

Die normale Research-Work-Order hat ein hartes Budget von höchstens 30
Suchabfragen beziehungsweise 25 Minuten und stoppt früher, sobald die
materiellen Cluster abgedeckt sind. Eine reine Freeze-Nachholung hat
`query_budget=0` und höchstens acht Minuten. Diese Budgets verhindern, dass
bereits ausreichende Recherche den späteren Artikelpfad künstlich verlängert.

## Evidence-Eingaben und Outputs

Der deterministische Builder `scripts/build-evidence-pipeline.mjs` liest für
neue Läufe ausschließlich ein `evidence_pipeline_build.v2` mit:

- genau einem an Researchbytes, Run, Stoff und Sprache gebundenen
  `coverage_plan.v2`;
- dem exakten Pfad und Inhaltshash des
  `research_source_artifact_receipt.v2`;
- disjunkten `source_evidence_shard.v2`-Dateien;
- einer Zuordnung jeder `source_id` zur wirklich gehashten Originaldatei;
- unabhängigen `source_facts_review.v2`-Ergebnissen;
- dem kanonischen Framework-Katalog und den darin gebundenen Versionen;
- stabilen Extractor-, Reviewer-, Merger- und Validatoridentitäten;
- den deterministischen Sampling-Parametern;
- optional quellgebundener `stage4_relevance` in Records, aber nur bei
  `stage4_requested=true`; operative Stackentscheidungen sind in Evidence
  verboten.

Der Runner erzeugt dieses Build-Manifest deterministisch aus Coverage und
Source-Receipt. Er plant sortierte Extraktions-Slices mit höchstens vier
Originalquellen und schreibt feste Shard-/Reviewpfade, IDs und Sampling-Seeds.
Dafür existiert weder eine `evidence-pipeline-coordinator`-Work-Order noch eine
LLM-Welle. Nur die tatsächlich fehlenden Shards gehen parallel an
`source-evidence-extractor`; jeder liest ausschließlich seine maximal vier
eingefrorenen Quelldateien. Merge, Sampling und Gate bleiben deterministische
Funktionen.

Er erzeugt reproduzierbar:

- ein zusammengeführtes `source_evidence_bundle.v2`;
- das eingefrorene `review_sample_manifest.v2`;
- das bestandene `facts_completeness_gate.v2`;
- genau ein lockgebundenes Stage-2-Paket je freigegebenem Artikeljob;
- genau ein vollständiges Stage-3-Paket je geplantem Hauptartikel;
- bei explizitem Stage-4-Auftrag genau ein
  `facts_package_for_stage4.v2` mit den freigegebenen Candidate-Records;
- einen `evidence_pipeline_lock.v2` mit Pfad-, Byte- und Inhaltshashes.

Der v2-Runner validiert diesen Lock vor jedem Writerstart. Die spätere
`validation_receipt.v2` gehört dagegen zum Artikelcompiler und bindet den
eingefrorenen Artikelpayload; sie ist kein zweites Evidence-Gate.

Manuell im Run-Manifest eingetragene Ersatzpfade dürfen ein erzeugtes
Facts-Paket nicht überschreiben. Writer erhalten ausschließlich die Pakete, die
im bestandenen Evidence-Lock für ihren Artikeljob gebunden sind.

## Obligations, Risikoprüfung und `writers_ready`

Der Coverageplan definiert pro Artikeljob die fachlichen Obligations: benötigte
Cluster, erwartete Record-Typen, Kontroversen, Quellen und – bei Stage 3 –
Blueprint, `common_assumption_review` und SEO-Brief. Der Gate-Builder prüft
diese Obligations gegen die
tatsächlich freigegebenen Records. Ein vorhandenes Paket ist daher noch keine
Writer-Freigabe. Feldschema und Hashbildung sind ausschließlich in
[`Framework 06`](../codex-files/frameworks/06_framework_coverage_source_evidence.md)
kanonisch.

Der Planner entscheidet je Stoff explizit, ob (a) Mangel, Versorgungsstatus
oder dokumentierte Nicht-Essenzialität, (b) Übermaß/Überdosierung/Obergrenzen
und (c) Formen, Bioverfügbarkeit sowie Nahrungs-/Supplementquellen materiell
sind. Relevantes wird als Cluster/Obligation geplant; begründet Irrelevantes
erzeugt weder leeren Abschnitt noch künstlichen Supporting-Artikel.

Die Source-Facts-Prüfmenge entsteht deterministisch vor dem Reviewer:

- Vollprüfung für Safety, UL, Referenzwerte, Interaktionen,
  Kontraindikationen, vulnerable Gruppen, Kontroversen, Widersprüche,
  `not_reported`, `stage4_relevance.status=candidate` sowie materielle
  Locator-/OCR-/Extraktionswarnungen;
- reproduzierbares, stratifiziertes Sampling der verbleibenden
  Niedrigrisiko-Obligations je Extractor; alle Records einer ausgewählten
  Obligation werden geprüft;
- genau eine automatische Eskalation des betroffenen Extractor-Scopes auf
  Vollprüfung;
  ein weiterer Fehler blockiert.

Eine gewöhnliche `study_quantity` oder ein `numeric_result` wird immer
deterministisch auf Zahl, Einheit, Kontext und Sourcebindung geprüft, ist
allein aber **kein** High-Risk- oder Vollreview-Signal. Auch `required=true`
erzwingt nur ein terminales Ergebnis vor `writers_ready`.

Die Niedrigrisiko-Menge verwendet
`algorithm=extractor_quality_sha256_v3` mit genau einem Stratum je
`extractor_id`. Aus `n` Niedrigrisiko-Obligations werden
`min(n, 10, max(min(3, n), ceil(0.20 × n)))` nach dem in Framework 06
gebundenen SHA-256-Rang ausgewählt. Cluster und Source-Typ bleiben im
Rankmaterial und als sortierte Manifestfelder erhalten, erzeugen aber keine
eigenen Mindestquoten. Reviewer wählen die Stichprobe nicht selbst.

Reine initiale Low-Risk-Shards laufen `reasoning_tier=standard`; High-/Full-
Risk und die einmalige Erweiterungsrunde laufen `high`. Wenn mindestens zwei
Shards verfügbar sind, trennt die Runtime beide Klassen tierhomogen. Ein
fachlicher Review-FAIL erzeugt höchstens eine `source_extraction_repair`-Order
mit `high` je betroffenem Extraktionsslice. Sie bindet Vorgängershard,
Failure-Fingerprint und fehlgeschlagene Obligations, bewahrt unbetroffene
Records bytegleich und verwendet nur eingefrorene Originalbytes. Nach erneutem
FAIL ist `REPAIR_EXHAUSTED`; es gibt weder Review-Pingpong noch zweite
Repairgeneration.

High-Risk wird aus Claim-Typ, Cluster, Status, Source-, Record- und
Warnungsfeldern abgeleitet. `plan_risk_tags` und `extractor_risk_tags` dürfen
die Prüfmenge nur erweitern, nie ein objektiv erkanntes Risiko herabstufen.

`writers_ready` ist eine berechnete Gate-Aussage, kein vom Planner oder Writer
setzbarer Shortcut. Sie darf nur wahr sein, wenn für jeden freigegebenen Job:

1. alle Obligations erfüllt sind;
2. alle benötigten Cluster bestanden haben;
3. High-Risk- und ausgewählte Sample-Records korrekt geprüft sind;
4. keine Eskalation oder Kontroverse ungeklärt ist;
5. das zugehörige Writer-Paket byte- und hashidentisch im Evidence-Lock liegt.

Nur im Coverageplan ausdrücklich zur Ausführung freigegebene Jobs gehören zur
erwarteten Writer- und Stage-2-Paketmenge. Blockierte, verworfene oder nur als
Supporting-Zuordnung geführte Kandidaten erzeugen weder ein leeres Paket noch
einen künstlichen Writerjob.

Stage 2 und Stage 3 dürfen danach parallel starten. Stage 3 wartet auf alle
Cluster seines Blueprints, aber nicht auf fertige Stage-2-Prosa.

Coverage bindet je geplantem Artikel außerdem genau einen
`selected_link_slice`: nur die für diesen Artikel freigegebenen internen
Zielpfade, Titel und Slugs plus Slice-Hash. Das vollständige Seiteninventar
geht ausschließlich an den Coverage-Planner. Writer, Compiler und
Publication-QA erhalten nur ihren Slice. Neue, für den Artikel unbeteiligte
Routen sind damit cache-neutral; eine Änderung an einem ausgewählten Ziel
erzeugt vor Evidence/Writer genau eine auf die betroffenen Artikelknoten
begrenzte Coverage-Replanung.

Ein Stoffname löst nie automatisch ein neues Framework aus. Normalfall ist ein
bereits freigegebenes Katalog-Framework. Nur ein expliziter
`framework_gap` führt in den seltenen Pfad
`adapt_existing -> Pilot -> Katalogversion` oder
`new_archetype -> bedingte Owner-Freigabe -> Pilot -> Katalogversion`. Ein rein
deklarativer Kandidat braucht reale Compiler-, Render- und Publication-Piloten,
aber keinen pauschalen Technical-Review. Enthält der Gap Runtimepfade, stoppt
der Contentlauf stattdessen vor Pilot und Aktivierung für einen separat
autorisierten Technikauftrag; danach werden Kandidat und Piloten gegen die
neuen Bytes neu ausgestellt. Erst nach allen tatsächlich erforderlichen Gates
wird der vollständige Coverageplan gegen den neuen Kataloghash neu erzeugt.

## Sichere Pfadauflösung

Produktionsnahe v2-Pfade werden von einem expliziten erlaubten Root aus
aufgelöst. Relative Pfade dürfen diesen Root weder mit `..`, absolutem Pfad,
UNC-Pfad, Laufwerkswechsel noch über eine aufgelöste Verknüpfung verlassen.
Eingänge, generierte Zustandsdateien, Writer-/Review-Sidecars, Assets, Release
und Publish-Receipt müssen in ihren jeweils erlaubten Roots liegen und dürfen
nicht kollidieren. Der Runner löscht oder ersetzt ausschließlich selbst
verwaltete Ausgaben innerhalb dieses Roots.

Im isolierten Testmodus ist das Manifestverzeichnis der explizite Root;
Manifestpfade bleiben auch dort relativ und traversal-frei. Ein solcher Lock
ist nie produktionsverwendbar. Pfade aus einem Artikel- oder Package-Sidecar
erweitern die Root-Freigabe nicht.

## Hashcache und selektive Invalidierung

Eine deterministische Prüfung ist mindestens an
`(payload_hash, validator_version, policy_version)` gebunden. Ein Cachetreffer
ist nur gültig, wenn sämtliche Dependency- und Outputbytes erneut zu ihrem
Receipt passen. Research, Stoff, Sprache, Coverageplan, Originalquellen,
Evidence-Lock, Framework-/Style-Versionen und optionale Assets gehören zur
Lineage, sobald sie den Output beeinflussen.

Ein lokaler Artikeldiff invalidiert nur dessen `article_result.v2`, Compile-
Receipt, Publication-Review und den Release. Eine geänderte Originalquelle oder
ein geändertes Facts-Gate invalidiert dagegen alle tatsächlichen Nachfahren.
Andere Artikel werden nicht vorsorglich neu geschrieben oder reviewt.

Für Stage 3 ist der reale Browser-/Style-PASS nicht artikelgebunden. Ein
kanonischer Fingerprint umfasst die tatsächlich hydratisierte
`/wissen/:slug`-Route mit App, Layout, Page, Markdownrenderer, CSS,
Buildkonfiguration, Package-Lock und aufgelösten Paketversionen. Zusammen mit
der kanonischen Route-Fixture und Validatorversion bildet er einen
repoübergreifend wiederverwendbaren PASS-Cache. Ein unveränderter Renderer wird
damit einmal geprüft, nicht erneut pro Artikel oder Render-Snapshot.

## Optionale Stage 4

Stage 4 ist standardmäßig aus. Ein Evidence-Record darf niemals eine operative
`stack_projection` enthalten. Nur bei `stage4_requested=true` ist die kleine
quellgebundene Kennzeichnung `stage4_relevance` mit exakt `status=candidate`,
Begründung und Locator zulässig. Sie enthält keine Stackrolle, Auswahl,
Sichtbarkeit, Default- oder Lifecycle-Entscheidung und erzwingt für die
betroffene Obligation Vollreview.

Erst nach bestandenem Facts-Gate erzeugt der Builder ein lockgebundenes
`facts_package_for_stage4.v2`. Es enthält exakt die vollständig geprüften
Candidate-Records; Stage-2- und Stage-3-Pakete übernehmen die
`stage4_relevance` nicht. Der ausdrücklich angeforderte
`stage4_stack_sync` startet danach als echter Child-Branch parallel zu den
Writern. Seine `stack_projection.v2` bindet Coverage-, Evidence-Bundle-,
Facts-Gate-, Evidence-Lock- und Stage-4-Pakethash sowie exakt dieselbe
eindeutige Menge aus `ingredient_id × population_key`, die der atomare
Write-Guard nennt. Der PASS-Receipt belegt `applied` oder
`already_current`, exakten Changed-Count und Record-Readback.

Der Artikelzweig kann unabhängig `COMPLETE` werden. `aggregate_status` bleibt
bis zum Stage-4-Receipt `WAITING_FOR_STAGE4` oder wird bei einem terminalen
Stage-4-Problem `BLOCKED`; ein Stage-4-Fehler rollt einen bestandenen oder
publizierten Artikel niemals zurück. Artikeltext ist nie fachliche Quelle der
Projektion.

Der read-only D1-Resolver-Preflight bleibt ein optionaler, eigener Schritt für
diesen Zweig. Ohne Stage-4-Auftrag sind Resolver, Population-Mapping und
Stage-4-Outputs weder erforderlich noch zulässig.

## Legacy nur über expliziten Adapter

Bestehende `publication_batch.v1`-, `stage2_article_import.v3`- und
`stage3_article_import.v2`-Inputs können für Diagnose oder Migration weiterhin
von ihren Legacy-Tools gelesen werden. Der v2-Runner erkennt oder übernimmt sie
nicht stillschweigend. Ein Legacy-Input muss ausdrücklich durch den passenden
Adapter normalisiert werden; sein Output durchläuft danach die komplette obige
v2-Kette. Legacy-Accepted-/Published-Felder, alte Q1–Q3-Receipts und erzeugtes
SQL erteilen keine v2-Publikationsfreigabe.

Auch ein altes `evidence_pipeline_build.v1` wird nur mit dem expliziten
`contract_profile: "legacy_v1"` vom Diagnose-Builder akzeptiert; der v2-Runner
akzeptiert es nie als Evidence-Input.

## Direkter Builder-Aufruf und Tests

Der direkte Builder-Aufruf ist für Diagnose, Fixtures und die isolierte
Evidence-Entwicklung gedacht:

```powershell
node scripts/build-evidence-pipeline.mjs `
  --manifest _research_raw/<stoff>/evidence-pipeline-build.v2.json `
  --out _research_raw/<stoff>/evidence-build

node --test scripts/build-evidence-pipeline.test.mjs
node --test scripts/run-nutrient-content.test.mjs
```

Der Builder und der v2-Runner täuschen keinen produktiven Erfolg vor. Fehlt nur
das Apply-/Readback-Receipt, endet der Runner bei `READY_TO_PUBLISH` und gibt
genau eine deterministische `publication_apply`-Work-Order aus. Ein bereits
vorhandenes, aber ungültiges oder stale Receipt wird nie automatisch erneut
angewendet, sondern blockiert mit einer menschlichen Integrity-Eskalation.
