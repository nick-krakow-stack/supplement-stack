# Kompatibilitätsredirect: früherer Publication-Executor

Diese Datei definiert keinen aktiven LLM-Agenten. `publication_apply` ist ein
deterministischer guarded Maschinenexecutor und läuft ausschließlich bei
explizitem `manifest.publish.required=true` sowie gültigem Write-Guard.
Ausgeführt wird er nur über
`scripts/lib/nutrient-content-machine-dispatcher.mjs` beziehungsweise
`scripts/apply-content-release.mjs`; der Dispatcher akzeptiert ausschließlich
die exakt ausgegebene `work_order_id`.

Verbindlich sind der Publish-/Readback-Abschnitt aus
[`docs/content-pipeline-v2.md`](../../docs/content-pipeline-v2.md) und das
unveränderte `content_release.v2`. Die Maschine transformiert keine Prosa,
formatiert keine Quellen und erzeugt keine Relations- oder Interpretationfacts.
Erst nach bestandenem Publication-Gate dürfen `ingredient_target_readback`,
`source_catalog_sync` und bei Assets `asset_stage` laufen. Draftläufe lösen
keine dieser Writes aus. Source-/R2-Staging bleibt additiv, idempotent und
receiptgebunden; `atomic=true` gilt ausschließlich für den D1-Batch aus
Artikeln, Quellen-/Ingredientrelationen, originalfacts-basierten Stage-2-
Interpretationen und allen `same_release`-Abhängigkeiten.

Der Executor wendet diesen frozen D1-Satz als einen atomaren, idempotenten Batch
an und
erzeugt `content_publish_receipt.v2` mit tatsächlichem targeted/public
Readback. Der öffentliche DOM-Readback muss die vollständige Release-
`expected_projection` samt `projection_hash` kanonisch reproduzieren; der SEO-
Readback das vollständige `seo`-Objekt samt `seo_hash`. Persistenz/API binden
zusätzlich `status`, `article_layer`, `sources_json` v2, Ingredientrelationen,
Stage-2-Interpretationen und leere Legacy-Hero-/Dosis-/Produktfelder.

Zeitfelder werden unverändert aus dem Release angewandt und gelesen. Create
setzt `published_at=modified_at=reviewed_at`; Update erhält persistiertes
`created_at` als `published_at` und setzt `modified_at` auf das normalisierte
Maximum aus Reviewzeit, persistiertem `updated_at` und `published_at`. Nur das
Update benötigt dafür den autoritativen Article-Target-Prestate.

Der Renderer-Request bindet top-level sortierte eindeutige positive
`affected_ingredient_ids` und gleich geordnete `badge_expectations`. Der
releaseweite `knowledge_badge_readback.v1` liest frisch `/api/knowledge` und
das hydrierte `/wissen`-DOM. Stage-2-Ingredients verlangen
`studies_rule=REQUIRE_TRUE`; sonst gilt `PRESERVE` mit Prestate oder
`API_DOM_PARITY`. DGE nutzt nur `PRESERVE` oder `API_DOM_PARITY`. `Studien`
stammt ausschließlich aus publizierten, akzeptierten `single_study`-Artikeln
und nie aus Dosisfeldern; `DGE` ausschließlich aus aktiven öffentlich
sichtbaren DGE-Werten.

Ein Badge-`MISMATCH` ist ein valides fachliches Receipt bei technisch
erfolgreicher Ausführung. Korrekt committe Artikel bleiben
`published=true/COMPLETE`; der Aggregate-Status wird ohne Rollback und ohne
Writer-/Publication-QA-Rerun `BLOCKED` an Technik/Daten eskaliert. Ein späterer
Repair darf nur Overview/API/Cache und die ableitenden Daten prüfen.

Roh-HTML/SSR-Prerender, `robots` und Sitemap sind ein post-publish siteweiter
Delivery-Readback. Nur dessen Unvollständigkeit lässt den Artikel
`published=true`, setzt aber `seo_live_claim=false` und
`WAITING_FOR_INDEXABILITY_RELEASE`; sie erzeugt weder Rollback noch
Writerauftrag. Dann ist nur ein humaner `indexability_release_handoff` für die
originweite Robots-/Site-Policy und anschließend ein frischer gezielter
Public-Readback zulässig, kein zweiter Publish. Ein Content-/API-/DOM-/SEO-
Projektionsmismatch bleibt dagegen fail-closed und wird kompensierend
zurückgerollt.

Ein alter Agentenaufruf wird nicht als zusätzliche Review- oder LLM-Welle
ausgeführt, sondern an denselben Maschinenexecutor delegiert. Fehlender Guard,
unerwarteter Rowcount oder abweichender Readback blockiert fail-closed.

## Ausführungsreceipt

Zusätzlich zum fachlichen Publish-Receipt schreibt der Maschinenexecutor nach
technisch erfolgreicher terminaler Ausführung an den top-level gebundenen
`execution_receipt.path` genau ein `work_order_execution_receipt.v1`.
`result=PASS` bedeutet nur Executor-Erfolg; `result_hash` bindet das fachliche
Artefakt auch bei dessen `FAIL|BLOCKED`. Ein technischer Abbruch schreibt kein
PASS-Receipt. Es bindet exakte `work_order_id` und
`result_hash`, Klasse/Tier, echte Executor-ID, Start/Ende und seinen eigenen
`content_hash`; es enthält keine Release-/Readbackpayload und ersetzt nicht
`content_publish_receipt.v2`.
