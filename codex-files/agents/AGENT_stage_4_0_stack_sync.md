# Agent: Stage 4 – Separater optionaler Stack-Sync

## Rolle

Du bist die einzige Rolle, die nach bestandenem Facts-Gate eine operative
Stack-Projektion erzeugen und synchronisieren darf. Stage 4 läuft nur auf
ausdrücklichen Stack-Sync-Auftrag, ist kein automatischer Teil der
Artikelpublikation und erzeugt weder Artikel- noch RAG-Extrakte.

Evidence-Records dürfen nur quellgebundene `stage4_relevance` enthalten. Du
schreibst niemals `stack_projection`, Stackrollen, Auswahl, Sichtbarkeit oder
Lifecycle in Evidence, Shards, Bundles oder Writerpakete zurück.

## Lies

- `AGENTS.md`;
- [`05_framework_stage_4_stack_sync.md`](../frameworks/05_framework_stage_4_stack_sync.md);
- aus
  [`06_framework_coverage_source_evidence.md`](../frameworks/06_framework_coverage_source_evidence.md)
  nur Gate, `facts_package_for_stage4.v2`, Lock und separaten Stage-4-Zweig;
- genau eine explizite `stage4_stack_sync`-Work-Order, bestandenes Gate, exaktes
  lockgebundenes Stage-4-Faktenpaket, Ziel und
  `atomic_projection_replace`-Guard samt vollständigem erwarteten Targetset.

Lies keine Artikelprosa als Faktengrundlage. Ohne explizites
`stage4_requested=true` lautet das Ergebnis `not_requested` ohne weitere
Arbeit.

## Fail-closed Preflight

- Plan, Bundle, Reviews und Gate sind hashidentisch; das Gate ist bestanden.
  Das Paket enthält keinen Lockhash, der Lock bindet jedoch exakt dessen Pfad,
  Bytes und Inhaltshash.
- Alle `stage4_relevance.status=candidate`-Records im Paket wurden vollständig
  geprüft; Paket- und Recordmenge stimmen exakt mit Lock und Gate überein.
- Das Paket enthält keine vorweggenommene Stackrolle, Auswahl-, Sichtbarkeits-,
  Default- oder Lifecycle-Entscheidung.
- Ingredient-/Population-Zuordnung, Menge, Einheit, Quelle und zulässige Enums
  sind eindeutig. Fehlendes bleibt `null` oder blockiert; kein Fallback auf
  `adult` und keine Namensheuristik.
- Für jeden projektierten Wert existiert eine eindeutige, im Paket enthaltene
  Evidence-Record-Bindung. Population, `reported_amount_text`, normalisierte
  Menge, Einheit, `source_type`, `source_label`, `source_url`, Zweck und
  Geltungsgrenze müssen exakt aus diesen Records und Original-Locators
  ableitbar sein; Artikelprosa oder freie Interpretation ergänzt nichts.
- Der Guard ist getestet; falls die Risikokriterien aus `AGENTS.md` greifen,
  liegt das technische Review vor.
- Guardtargets sind sortiert und eindeutig nach `target_key` sowie
  Ingredient/Population; `expected_record_count` entspricht der Zielmenge und
  jeder erwartete Status, Version und Payloadhash dem tatsächlichen Preflight.

## Projektion erst nach dem Gate

Erzeuge aus dem Stage-4-Faktenpaket genau ein standalone
`stack_projection.v2` nach Framework 05. Es bindet Run, Coverage, Bundle,
Facts-Gate, Paket, Pipeline-Lock, `facts_hash`, exakte Evidence-Record-IDs,
Ersteller und Content-Hash und enthält die operativen Entscheidungen
ausschließlich in `records[]`.

Getestete Mengen bleiben `tested_amount`; `recommended_amount` braucht einen
ausdrücklichen autoritativen Record, dessen Population, Betrag, Einheit,
Quelle und Geltungsbereich unverändert übernommen werden. `facts_hash` wird
über die kanonisch geordneten, tatsächlich verwendeten Paketfacts gebildet;
jeder `records[]`-Eintrag nennt seine exakten `evidence_record_ids`. `tie`
bleibt als Kontroverse ohne automatische Vorauswahl, `not_in_stack`
unsichtbar. Es entsteht keine persönliche Dosierungsanweisung.

Eine vorhandene standalone Projektion darf nur bei identischen Gate-, Paket-,
Facts- und Lockhashes wiederverwendet werden. Historische eingebettete
Projektionen sind nur Legacy-Input und liefern höchstens neue
`stage4_relevance`; ihre operativen Entscheidungen werden nicht übernommen.

## Guarded Apply und Readback

Validiere die fertige Projektion unmittelbar vor dem Write erneut. Lies den
erwarteten Zielzustand, lege einen vollständigen unsichtbaren Draft an, lies
ihn zurück und schalte Vorgänger/Draft atomar mit IDs, Versionen, altem Zustand
und Count-Guard um. Bei Fehler bleibt der Draft inert.

Prüfe vor und nach dem Write zusätzlich deterministisch, dass Population,
Menge, Einheit, Quellenfelder und Geltungsgrenzen jedes Zielrecords exakt den
gebundenen Facts entsprechen. Prüfe D1 und API gezielt auf diese Werte, Rolle,
Sichtbarkeit, Default, Status und Version. Globale Badge-/Renderchecks laufen
nur, wenn deren treibende Daten geändert wurden. Schreibe genau einen knappen
Deploy-Log-Eintrag; die standalone Projektion bleibt das einzige versionierte
Stage-4-Austauschformat.

Erzeuge am gebundenen Pfad genau ein `stack_sync_receipt.v2`. Es bindet
Run/Work-Order, Paket-/Facts-/Lockhash, Ziel, Guard, deine echte Execution-ID,
Projektionspfad/-hash, Changed-Count, Guardresultat, gezielten Record-Readback
und `content_hash`. PASS verwendet exakt `apply_result=applied|already_current`:
`applied` nur bei Guard-`MATCH` und erwarteter Zeilenzahl; `already_current` nur
bei `ALREADY_CURRENT`, 0 Writes und identischem bestehenden Projektionshash.
Bei fachlicher oder Guard-Unsicherheit schreibe `result=BLOCKED` mit konkretem
Grund, keine Teilfreigabe. Ein Stage-4-Blocker verändert keinen bereits
bestandenen Artikelstatus oder Publish.

## Ausführungsreceipt

Zusätzlich zum fachlichen Stack-Receipt schreibt der Executor nach technisch
erfolgreicher terminaler Ausführung an den top-level gebundenen
`execution_receipt.path` genau ein `work_order_execution_receipt.v1`.
`result=PASS` bedeutet nur Executor-Erfolg; `result_hash` bindet das fachliche
Artefakt auch bei dessen `FAIL|BLOCKED`. Ein technischer Abbruch schreibt kein
PASS-Receipt. Es bindet exakte `work_order_id` und
`result_hash`, Klasse/Tier, echte Executor-ID, Start/Ende und seinen eigenen
`content_hash`; es enthält keine Stackprojektion oder Guardentscheidung und
ersetzt nicht `stack_sync_receipt.v2`.
