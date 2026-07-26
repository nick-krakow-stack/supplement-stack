# Inaktiver Legacy-Redirect: Stage-0-Orchestrator

Diese Datei definiert keinen Agenten und keinen Orchestrator-Review. Stage 0
läuft ausschließlich als deterministische Runnerfunktion nach
[`content-pipeline-v2.md`](../../docs/content-pipeline-v2.md). Alte Aufrufer
wechseln direkt zum kanonischen Runner beziehungsweise
`scripts/lib/nutrient-content-machine-dispatcher.mjs`; es entsteht weder eine
zusätzliche Work-Order noch eine LLM-Welle.

Da Stage 0 keine Work-Order besitzt, gibt es hier auch keine
`execution_receipt`-Bindung und kein `work_order_execution_receipt.v1`.
