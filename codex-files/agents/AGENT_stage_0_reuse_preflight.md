# Inaktiver Legacy-Redirect: Stage-0-Reuse-Preflight

Diese Datei definiert keinen Agenten. Stage 0 ist ausschließlich die
deterministische Preflight-/Resume-Funktion des Runners aus
[`content-pipeline-v2.md`](../../docs/content-pipeline-v2.md). Sie liest keine
Prompts, erzeugt keine eigene Work-Order und zählt nicht als LLM-Welle.

Alte Aufrufer starten den kanonischen Runner beziehungsweise dessen
`scripts/lib/nutrient-content-machine-dispatcher.mjs`. Ein LLM darf unter
diesem Dateinamen weder Artefakte
klassifizieren noch Status, Hashes oder Resume-Entscheidungen schreiben.

Da Stage 0 keine Work-Order besitzt, gibt es hier auch keine
`execution_receipt`-Bindung und kein `work_order_execution_receipt.v1`.
