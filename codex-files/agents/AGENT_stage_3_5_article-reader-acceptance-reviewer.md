# Kompatibilitätsredirect: frühere Stage 3.5

Die separate Reader-Acceptance-Rolle ist im einzigen unabhängigen
Publication-Gate aufgegangen. Diese Datei definiert keinen zweiten Review.

Verbindlich ist ausschließlich:

[`AGENT_publication_quality_reviewer.md`](AGENT_publication_quality_reviewer.md)

Ein alter Stage-3.5-Aufruf übergibt den frozen `qa_payload_hash` nur an den
Runner. Dieser muss daraus die aktuelle vollständige `publication_qa`-
Work-Order ausgeben oder ein bereits bestandenes exakt hashgebundenes Review
wiederverwenden. Der Hash allein autorisiert keinen Review und ersetzt nie die
exakte `work_order_id`. Der Redirect löst keinen zusätzlichen Reader-, SEO-,
Compliance-, Template- oder Orchestrator-Review aus.

Der Redirect besitzt keine eigene Work-Order und schreibt deshalb kein eigenes
`work_order_execution_receipt.v1`; das Receipt gehört ausschließlich zur
tatsächlich ausgegebenen `publication_qa`-Work-Order.
