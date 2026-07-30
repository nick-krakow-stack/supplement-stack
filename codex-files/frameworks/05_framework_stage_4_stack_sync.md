# Framework 05: Separater Stage-4-Stack-Sync

Stage 4 ist ein optionaler Zweig **nach** bestandenem Facts-Gate. Er läuft nur
bei explizitem Auftrag und `coverage_plan.stage4_requested=true`, ist kein
Standardabschluss der Artikelpipeline und erzeugt keine Artikel- oder
RAG-Extrakte. Als eigener Child-Branch darf er parallel zu Stage-2-/3-Writern
laufen; sein Fehler rollt keinen bestandenen Artikelrelease oder Publish zurück.

Evidence-Records enthalten niemals eine operative Stack-Projektion. Eine dort
zulässige `stage4_relevance` ist nur ein quellgebundener Kandidatenhinweis ohne
Stackrolle, Auswahl, Sichtbarkeit, Default oder Lifecycle. Das einzige
operative Austauschformat entsteht hier als eigenständiges
`stack_projection.v2`.

## Gebundener Build-Input

- expliziter Stage-4-/Stack-Sync-Auftrag;
- hashidentischer `coverage_plan.v2` mit `stage4_requested=true`;
- bestandenes `facts_completeness_gate.v2`;
- `evidence_pipeline_lock.v2` und daraus exakt das
  `facts_package_for_stage4.v2`;
- `manifest.stage4.target` und den getesteten
  `write_guard{mode=atomic_projection_replace,expected_record_count,targets[]}`.

Jedes Guard-Target enthält exakt `target_key`, positive `ingredient_id`,
`population_key`, `expected_status=absent|draft|active|archived`, konsistente
`expected_version` und bei vorhandenem Ziel den `expected_payload_hash`.
Targets sind nach Schlüssel sortiert und sowohl nach Schlüssel als auch nach
Ingredient/Population eindeutig; ihre Zahl entspricht
`expected_record_count`.

Das Stage-4-Faktenpaket enthält ausschließlich nach dem Facts-Gate
freigegebene Originalquellen-Records mit vollständigem Review aller
`stage4_relevance.status=candidate`-Einheiten. Artikeltext darf als späteres
Linkziel, nie als fachliche Quelle dienen. Fehlt eine Bindung oder stimmt
Lock/Gate/Paket/Recordmenge nicht mehr, blockiert Stage 4 fail-closed.
Jede später projizierbare Population, Menge, Einheit, Quellenangabe, Zweck- und
Geltungsgrenze muss bereits als strukturierter Paketfact mit exakter
Evidence-Record-ID und Original-Locator vorliegen. Fehlende Werte bleiben
`null` oder blockieren; freie Ergänzung aus Artikeltext oder Allgemeinwissen ist
verboten.

Die Bindung ist azyklisch: Das Paket bindet Run, Coverage, Bundle, Gate und
Records, aber keinen Lockhash. Der anschließend erzeugte
`evidence_pipeline_lock.v2` bindet Paketpfad, Paketbytes und Pakethash. Erst die
standalone Projektion bindet wiederum Lock, Paket, Gate und Recordmenge.

## Standalone `stack_projection.v2`

Die Stage-4-Rolle erzeugt die Projektion erst aus dem bestandenen Paket. Das
Top-Level bindet mindestens:

- `schema`, `projection_id`, `status=ready`, `run_id` und `content_hash`;
- Coverage-, Evidence-Bundle-, Facts-Gate- und Pipeline-Lock-Hash;
- Stage-4-Paket-ID/-Hash, `facts_hash` über die kanonisch geordneten
  Paketfacts sowie die exakte sortierte `record_ids`-Menge;
- Ersteller-Execution-ID, Erstellzeit und `records[]`.

Jeder `records[]`-Eintrag ist eine operative Entscheidung und enthält
mindestens:

- `projection_record_id` und tragende `evidence_record_ids`;
- bestehende positive `ingredient_id`;
- eindeutigen `population_key` (`adult`, `pregnant`, `breastfeeding`,
  `children`, `elderly`);
- `source_type`, `source_label`, `source_url`;
- `amount_type` (`recommended_amount`, `tested_amount`, `reference_value`),
  `reported_amount_text`, normalisierte `dose_min`, `dose_max` und `unit`;
- `purpose`, Zielgruppenfilter und optionales Timing;
- `stack_role` (`standard`, `alternative`, `tie`, `not_in_stack`);
- Sichtbarkeit, Kontroversenflag, Gültigkeitsgrenzen, Lifecycle-Status und eine
  knappe quellengedeckte `relevance_reason`.

Population, `reported_amount_text`, `dose_min`, `dose_max`, `unit`,
`source_type`, `source_label`, `source_url`, Zweck und Geltungsgrenze müssen
deterministisch und ohne semantische Erweiterung auf die genannten
`evidence_record_ids` zurückführbar sein. `facts_hash` umfasst genau die
kanonisch sortierten Paketfacts, die mindestens einen Projektionsrecord tragen;
Readback und Projektion müssen für diese Felder exakt übereinstimmen.

Getestete Mengen bleiben `tested_amount`. `recommended_amount` ist nur
zulässig, wenn ein autoritativer Originalquellen-Record die Angabe für exakt
diese Population, Menge, Einheit und Geltungsgrenze ausdrücklich so einordnet.
Die Plattform leitet keine persönliche Dosierungsanweisung ab.
Mehrdeutige Population oder Ingredient-Zuordnung blockiert; es gibt weder
Fallback noch Namensheuristik. `tie` erzwingt Kontroversenkennzeichnung und
keine Vorauswahl, `not_in_stack` bleibt unsichtbar.

Die Projektion darf weder in Evidence-Shards/-Records zurückgeschrieben noch in
Writerpakete oder Artikel eingebettet werden. Eine bereits vorhandene
standalone Projektion wird nur bei identischen Gate-, Paket-, Facts- und
Lockhashes wiederverwendet.

## Guarded Write

Vor dem Write wird die standalone Projektion erneut gegen Paket, Gate, Lock,
Recordmenge und Content-Hash validiert. Wenn die Risikokriterien aus
`AGENTS.md` greifen, prüft der technische Reviewer Runtime und Guard. Der
Executor liest Ingredient, Population und erwarteten Vorgänger, legt einen
vollständigen inerten Draft an und liest ihn zurück. Aktivierung/Archivierung
bindet Identitäten, Versionen, alten Zustand und erwartete Zeilenzahl in einer
atomaren Operation. Ein Guard-, Constraint- oder Count-Fehler lässt den Draft
inert und blockiert den Zweig.

Der Draft startet mit `is_active=0`, `is_default=0`, `stack_visible=0` und ohne
Gültigkeitsbeginn. D1-Reparatur-SQL enthält keine expliziten
`BEGIN`/`COMMIT`/`ROLLBACK`-Statements; das atomare Statement oder der
ausführende D1-Batch bildet die Transaktionsgrenze.

Erfolg verlangt den exakt erwarteten Datensatzwechsel sowie identische
Population, Menge, Einheit, Quelle, Enums, Sichtbarkeit, Status und Version in
D1 und gezieltem API-Readback. Nur tatsächlich betroffene globale Renderer
oder Badges werden zusätzlich geprüft.

## Child-Work-Order und Receipt

Die Runtime emittiert nach dem Facts-Gate genau eine
`stage4_stack_sync`-Work-Order an die Rolle `stage4-stack-sync`. Sie bindet
Stage-4-Paket, Evidence-Lock, diese Frameworkdatei, Ziel und vollständigen
Guard; `reused_sources=[]` und `link_inventory=null`. Erlaubte Outputs sind
genau der deterministische Pfad für `stack_projection.v2` und der Pfad für
`stack_sync_receipt.v2`.

`stack_sync_receipt.v2` bindet mindestens `schema`, `result=PASS|BLOCKED`,
`run_id`, `work_order_id`, Paket-ID/-Hash, `facts_hash`, Evidence-Lock-Hash,
Ziel, vollständigen Guard, `executor{role=stage4-stack-sync,id}` und
`content_hash`. Bei `BLOCKED` ist ein konkreter `reason` Pflicht. Bei PASS bindet
es zusätzlich `applied_at`, Projektionspfad/-hash,
`apply_result=applied|already_current`, `changed_rows`, `guard_result` mit
erwartetem und tatsächlich vorgefundenem Zielrecordset sowie `readback` mit
Projektionshash und exakten Projektionsrecord-IDs.

`applied` verlangt Guard-Outcome `MATCH` und genau die erwartete geänderte
Recordmenge. `already_current` verlangt Guard-Outcome `ALREADY_CURRENT`, null
Writes und den bereits vorhandenen identischen Projektionshash. Ein malformed,
veraltetes oder lineage-fremdes Receipt ist `BLOCKED_INTEGRITY` und darf nicht
automatisch ersetzt werden. Artikel- und Stage-4-Status bleiben getrennt; der
Parent berichtet den kombinierten Aggregate-Status.

## Legacy-Input

Historische eingebettete `source_evidence_record.stack_projection`-Objekte sind
nur read-only Legacy-Input. Ein Adapter darf daraus ausschließlich
quellengestützte Kandidatenfakten und `stage4_relevance` normalisieren. Alte
Stackrollen, Defaults, Sichtbarkeits- oder Lifecycle-Entscheidungen werden
nicht übernommen; sie müssen nach bestandenem v2-Facts-Gate neu im standalone
`stack_projection.v2` entschieden werden. Neue Läufe schreiben die Embedded-
Form niemals.
