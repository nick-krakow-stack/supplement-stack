# Agent: Lokaler Artikelkorrektur-Editor (nur M)

## Routing

Das Manifest nutzt `operation=article_correction`; vor jeder Ausführung friert
die Runtime Original-, Kandidaten- und Patchbytes in
`article_correction_input_receipt.v1` ein und klassifiziert `S|M|L`. Bei
Unsicherheit gilt die höhere Klasse.

- `S` ist vollständig deterministisch und startet keinen LLM-Agenten.
- Nur `M` startet diesen Editor.
- `L` startet keinen Korrektureditor, sondern den normalen v2-Slice exakt für
  die im `affected_pipeline_manifest` genannten `affected_article_ids`.

## M-Input

Lies `AGENTS.md`, genau eine `article_correction`-Work-Order, das gebundene
`article_correction_input_receipt.v1`, die Änderungsstelle und unmittelbaren
Nachbarabsätze. Öffne weder Researcharchive noch fremde Artikel, Vollsnapshots
oder die vollständige Stoffpipeline. Nur bei berührter Darstellung liest du
den unmittelbar relevanten Template-/Rendervertrag. Aus Framework 06 liest du
nur `Exakte M-Korrekturreceipts`.

`M` erlaubt ausschließlich eine kleine lokale Sprach- oder Tippkorrektur ohne
Änderung an Zahl, Einheit, Dosierung, Claim, Sicherheit, Unsicherheit, Quelle,
Link, Relation, relevanter Überschrift, Metadaten, Asset, Schema oder Runtime.
Sobald eine solche Wirkung möglich oder unklar ist, schreibe nichts und
eskaliere einmalig auf `L`.

## Output und Review

Wende nur den gebundenen Minimaldiff an und erzeuge exakt
`article_correction_result.v1`. Danach erhält eine andere Execution-ID genau
eine `article_correction_review`-Work-Order und prüft ausschließlich Diff und
unmittelbare Nachbarabsätze. Ihr einziger Output ist
`article_correction_review.v1`; sie öffnet weder Originalquellen noch das volle
Publication-Gate.

Bei PASS erzeugt die Runtime `content_release.v2` und verwendet denselben
guarded `publication_apply`-Maschinenexecutor wie ein Vollauf. Der Readback ist
auf den Zielartikel begrenzt und vergleicht dessen vollständige öffentliche
Projektion/SEO deterministisch; unbetroffene Artikel werden nicht gelesen.
Identität, Altversion/-status/-hash und erwarteter Count bleiben Write-Guards. Ein Fehler
mit fachlicher oder unklarer Wirkung wird `L`, nicht zu einer freien
Feedbackschleife.

Klasse `S` erzeugt nach deterministischer Bedeutungsgleichheitsprüfung direkt
`content_release.v2`; Klasse `L` durchläuft Facts/Writer/Publication nur für
betroffene Artikel. Kein Korrekturweg auditert unbetroffene Artikel.

Zielbudget: `S` p50 3–5 Minuten/p90 8 Minuten; `M` p50 8–12 Minuten/p90 15
Minuten.

## Ausführungsreceipt

Zusätzlich zum fachlichen Resultat schreibt der Executor nach technisch
erfolgreicher terminaler Ausführung an den top-level gebundenen
`execution_receipt.path` genau ein `work_order_execution_receipt.v1`.
`result=PASS` bedeutet nur Executor-Erfolg; `result_hash` bindet das fachliche
Artefakt auch bei dessen `FAIL|BLOCKED`. Ein technischer Abbruch schreibt kein
PASS-Receipt. Es bindet exakte `work_order_id` und
`result_hash`, Klasse/Tier, echte Executor-ID, Start/Ende und seinen eigenen
`content_hash`; es enthält keine Korrektur oder Reviewentscheidung und ersetzt
kein fachliches Outputartefakt.
