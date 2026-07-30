# Qualitätsvertrag für Nährstoff- und Supplementartikel

## Zweck und Geltung

Dieser Vertrag definiert die sichtbare und fachliche Publikationsqualität für
Stage-2-Studienartikel und Stage-3-Hauptartikel. Er ersetzt weder die
Originalquellenprüfung noch einen Artikelframeworkvertrag.

Für Stage 3 ist ausschließlich das im aktiven Katalog gebundene kanonische
`knowledge_magazine_v1` die byte-genaue Scaffold-Wahrheit; aktuell ist das
[`Framework 03@2.0.3`](../codex-files/frameworks/03_framework_hauptartikel.md).
Eine katalogisierte Inhaltsvariante darf es nicht kopieren oder überschreiben.
Dieses Dokument kopiert das Skelett ebenfalls nicht. Magnesium und Vitamin A
kalibrieren Lesbarkeit und Lernlogik; sie liefern weder Fakten noch
Templateabschnitte.

## Unverhandelbare Publikationsgrenzen

- Fakten stammen nur aus dem lockgebundenen v2-Facts-Paket aus
  Originalquellen, nie aus einem bestehenden oder neu geschriebenen Artikel.
- Keine Diagnose, Therapie, Behandlung, individuelle Dosierungsanweisung,
  Produkt-/Markenrangliste, Werbung oder unbelegte medizinische Aussage.
- Zahl, Einheit, Population/Bezugsrahmen, Richtung und Unsicherheit bleiben
  zusammen.
- Mechanismus, Assoziation und klinischer Nutzen werden nicht vermischt.
- Referenzwert, getestete Menge, Obergrenze und persönliche Empfehlung sind
  sichtbar verschieden.
- Fehlende Information wird ausgelassen oder als Unsicherheit benannt; sie wird
  nicht ergänzt, geglättet oder aus einem anderen Kontext übertragen.
- Sichtbarer deutscher Text ist valides UTF-8 mit echten Umlauten und `µ`.

Die feste Rechtsgrenze erzeugt keine zusätzliche Standardwelle. Sobald
Artikelwortlaut, Produktnähe, Affiliate-Link oder CTA eine kommerzielle
nährwert- oder gesundheitsbezogene Aussage bilden kann, gelten die
[Verordnung (EG) Nr. 1924/2006](https://eur-lex.europa.eu/legal-content/DE/TXT/?uri=CELEX:32006R1924)
und die konkreten Bedingungen des
[EU-Registers](https://food.ec.europa.eu/food-safety/labelling-and-nutrition/nutrition-and-health-claims/eu-register-health-claims_en).
Eine Studieninterpretation wird nicht zum zugelassenen Produktclaim
umgedeutet. Irreführende Wirkungs-/Sicherheitsangaben und Aussagen zur
Prävention, Behandlung oder Heilung von Krankheiten bleiben insbesondere nach
[§ 3 HWG](https://www.gesetze-im-internet.de/heilmwerbg/__3.html),
[§ 11 LFGB](https://www.gesetze-im-internet.de/lfgb/__11.html) und
[§ 5 UWG](https://www.gesetze-im-internet.de/uwg_2004/__5.html) verboten. Ist
der kommerzielle Zweck einer Affiliate-
Verknüpfung nicht unmittelbar erkennbar, ist er nach
[§ 5a Abs. 4 UWG](https://www.gesetze-im-internet.de/uwg_2004/__5a.html)
kenntlich zu machen. Nur ein konkreter nicht eindeutig entscheidbarer
Rechtsbefund oder ausdrücklicher Owner-Auftrag eröffnet einen separaten Legal-
Review für den betroffenen Artikel; er ist kein normales Publication-Gate.

## Writer-Vertrag

Jeder Writer erhält eine vollständige, ausführbare
`nutrient_content_work_order.v2` nach
[`Framework 06`](../codex-files/frameworks/06_framework_coverage_source_evidence.md),
ein exakt im `evidence_pipeline_lock.v2` gebundenes Facts-Paket, tatsächliche
Framework-/Stildateien, Zielpfade, Policy, ausschließlich den artikelbezogenen
`selected_link_slice` und bereits deterministisch formatierte sichtbare
Quellen. Bei Stage 2 lautet das externe Originalquellenlabel bytegleich
`<Autor/Institution> (<YYYY|o. J.>). <Titel>. <Journal/Publisher>.[ DOI:
<doi>.][ PMID: <pmid>.]`; der Writer ergänzt oder formatiert es nicht und die
Originallokator-URL bleibt erhalten. Bei Stage 3 sind stattdessen ausschließlich
interne Stage-2-Carrier sichtbar; ihr Label ist bytegleich deren deutsches
`source_presentation_label_de`, ihr Ziel die gebundene `/wissen/...`-Route.
Das vollständige deterministische
DB-/Routen-Inventar ist nur Plannerinput. Die Execution-ID muss von allen
Facts-Reviewer-IDs verschieden sein.

Bei Stage 3 sind Stilannotation und Snapshot-Manifest die normalen
Work-Order-Inputs. Die manifestgebundenen Magnesium-/Vitamin-A-Vollsnapshots
werden beim Lockaufbau hashvalidiert, aber nur bei einer konkreten, durch die
Annotation nicht lösbaren Stilfrage geöffnet und nie in jeden Prompt kopiert.

Stage 2 erzeugt reine sichtbare Markdown-Prosa nach dem exakt katalog- und
Work-Order-gebundenen approved Stage-2-Framework; aktuell löst dieses auf
Framework 01 oder 02 auf. Dazu kommt genau ein `article_result.v2`. Technische
Metadatenblöcke, IDs, Hashes,
Abschlussstatus, Importhinweise, Reviewprosa und alternative Sidecars sind im
Artikel verboten.

Jedes Stage-2-Paket bindet ein geprüftes `source_assignment`. Standard ist ein
Artikel für genau eine akzeptierte, aussagekräftige Source. Mehrquellenartikel
sind nur als nachgewiesene direkte Forschungslinie oder als Meta-Analyse/
systematischer beziehungsweise Umbrella-Review samt eingeschlossenen
Einzelstudien zulässig. Stage 3 zeigt im Quellenbereich ausschließlich interne
Stage-2-Artikel und ordnet jede verwendete Originalsource genau einem solchen
Ziel zu; externe Originallinks bleiben in Stage 2.

Jeder geplante Stage-2-Carrier bindet zusätzlich
`source_presentation_label_de`: den sinngenau ins Deutsche übertragenen Titel
seiner Originalstudie beziehungsweise institutionellen Originalquelle. Dieser
Text ist bytegleich der Stage-2-H1 und dem sichtbaren internen Quellenlabel in
Stage 3. Der Stage-2-Text gibt die Quelle selbst auf Deutsch wieder –
mindestens Fragestellung, Bedingungen, Design oder Entstehungsgrundlage,
Population, Intervention/Exposition und Vergleich soweit vorhanden, relevante
Endpunkte, zentrale Ergebnisse, Grenzen und belastbare Einordnung. Kürzung ist
zulässig; reine Metaformulierungen darüber, worum es in der Studie „geht“ oder
worauf sie sich „bezieht“, erfüllen den Vertrag nicht.

Stage 3 erhält zusätzlich Blueprint, alle benötigten Cluster, Kontroversen,
den `common_assumption_review`, den kanonischen People-first-SEO-Brief und die
Grafikentscheidung. Er folgt dem
gebundenen kanonischen Magazin-Scaffold exakt,
aber passt seine inhaltlichen Abschnitte an den Stoff an. Leere Überschriften,
irrelevante Pflichtblöcke, kopierte Referenzgliederungen, Grafikbriefings und
Platzhalter sind verboten.

Der Writer liefert exakt das vollständige `article_result.v2` aus Framework 06.
Teilreceipts und zusätzliche Provenienz-Sidecars sind ungültig. Die
per-article Lineage verwendet `evidence_membership_hash`; ein globaler
Lockwechsel allein invalidiert keinen unveränderten Geschwisterartikel. Der
Writer erfindet keinen `visible_payload_hash`; diesen berechnet der Compiler.

Nach technisch erfolgreicher terminaler Ausführung schreibt der Executor am
top-level gebundenen `execution_receipt.path` zusätzlich genau ein
`work_order_execution_receipt.v1`. Sein `result=PASS` bezeichnet nur Executor-
Erfolg; `result_hash` bindet den fachlichen Output auch bei dessen
`FAIL|BLOCKED`. Das Timingreceipt enthält keine Artikelbytes oder Findings und
ersetzt kein Fachartefakt; ein technischer Abbruch schreibt kein PASS-Receipt.

## Leserqualität

### Verständlichkeit

- Ein fachfremder Leser versteht im Einstieg, worum es geht und warum der
  Inhalt relevant ist.
- Kernaussage kommt vor Detail, Bekanntes vor Neuem und Alltagssprache vor
  Fachbegriff.
- Fachbegriffe werden beim ersten Auftreten kurz und korrekt erklärt.
- Sätze und Absätze sind überwiegend kurz bis mittel; ein Absatz trägt einen
  Hauptgedanken.
- Kausalketten werden schrittweise erklärt. Wissenschaftliche Genauigkeit darf
  nicht in Gutachtenstil oder unaufgelösten Jargon kippen.
- Ein Zehntklässler kann dem Hauptartikel folgen und daraus ein sachlich
  richtiges Referat vorbereiten.

### Struktur und Lernlogik

- Titel und Dek versprechen nur, was der Artikel tatsächlich leistet.
- Der Einstieg beantwortet die primäre Leserfrage früh.
- Überschriften sind stoffgerecht, aussagekräftig und nicht leer.
- Listen und Tabellen lösen eine konkrete Verständnis- oder Vergleichsaufgabe.
- Supporting-Fakten werden in den passenden Gedankengang integriert;
  hilfreiche bestehende Supporting-Seiten werden zusätzlich verlinkt.
- Das Fazit verdichtet Nutzen, Grenze und sichere Einordnung, ohne den Artikel
  bloß zu wiederholen.
- Jede gebundene gängige Annahme wird genau einmal klar beantwortet. Die kurze
  Antwort steht früh oder im sachlich passenden Abschnitt; Bedingungen,
  Teilgruppen und Unsicherheit folgen unmittelbar, ohne redundanten
  „Mythen“- oder FAQ-Füllblock.

### People-first SEO

Der Artikel erfüllt `primary_intent`, `reader_question` und `reader_promise`,
verwendet `primary_topic_phrase`, Synonyme und `secondary_questions` natürlich
und beachtet `cannibalization_note`. `internal_link_targets` stammen aus dem
Planner-seitig gebundenen `site_link_inventory.v2`; Writer und Reviewer erhalten
nur den hashgebundenen artikelbezogenen `selected_link_slice`. Die Links stehen
nur dort, wo sie konkret helfen. Jeder Link trägt `target_state=live|same_release`;
ein `same_release`-Ziel bindet zusätzlich den anderen geplanten Artikel und
muss mit ihm im selben atomaren Release publiziert werden.
Keyworddichte, sichtbare SEO-Anweisungen, eine zweite SEO-Fassung und
Writer-erzeugte Meta-/Schema-Dateien sind verboten. Technischer Title und
Meta-Description werden erst aus dem finalen Artikel abgeleitet. Der Compiler
erzeugt außerdem Canonical, `robots=index,follow`, Indexierbarkeit und Article-
JSON-LD. Ein deterministisches Gate prüft UTF-8, Eindeutigkeit im Release und
gegen das Live-Inventar, inhaltsproportionale Längen, Canonical/Robots/
Indexierbarkeit, JSON-LD und den `seo_hash` der vollständigen öffentlichen SEO-
Projektion; es gibt kein
zusätzliches LLM-SEO-Gate.
Roh-HTML/SSR-Prerender, tatsächliche Robots-Policy und Sitemapaufnahme sind
siteweite Delivery-Eigenschaften. Ein Defizit dort löst nie Writer- oder
Publication-QA-Arbeit aus.

## Fachliche Qualität

Jeder materielle Claim muss auf freigegebene Record-IDs zurückführbar sein. Zu
prüfen sind insbesondere:

- Aussageart und Richtung;
- Population, Vergleich, Zeitraum und Endpunkt;
- Zahl, Einheit, Bezugsgröße, Umrechnung und Rundung;
- Evidenzstärke, Unsicherheit, Grenzen und Übertragbarkeit;
- Sicherheit, Nebenwirkungen, Interaktionen, vulnerable Gruppen und
  Kontroversen;
- sichtbare Quellenrelation und hilfreicher Originalquellenzugang.
- bei Stage 2: inhaltliche deutsche Wiedergabe der gebundenen Quelle statt
  bloßer Themenbeschreibung sowie exakte H1-Parität mit
  `source_presentation_label_de`;
- bei Stage 3: interne Quellenlabels entsprechen exakt den deutschen
  Originaltitel-Labels ihrer Stage-2-Carrier;
- bei Stage 3: vollständige, zum Facts-Paket passende Beantwortung aller
  `common_assumption_review.checks` samt Conclusion- und Record-/Obligation-
  Bindung; Discovery-Signale allein tragen weder die Antwort noch eine
  Mehrheits- oder Prävalenzbehauptung.
- soweit der Blueprint sie als stoffrelevant ausweist: Mangel/
  Versorgungsstatus und Statusmarker beziehungsweise Nicht-Essenzialität,
  Übermaß/Überdosierung/Obergrenzen sowie Formen, Bioverfügbarkeit und
  Nahrungs-/Supplementquellen. Begründet irrelevante Dimensionen erzeugen keine
  leeren Abschnitte.

Ein `not_reported`-Ergebnis darf nicht in einen positiven oder negativen Claim
umgedeutet werden. Es beendet seine Pflicht, deckt aber allein keinen
Pflichtcluster. Konfligierende Records bleiben sichtbar abgewogen und werden
nicht durch Mehrheitsformulierung versteckt.

## Abgrenzung zum Stage-4-Stack-Sync

Eine quellgebundene `stage4_relevance` in Evidence ist nur ein
Kandidatenhinweis und weder Stackempfehlung noch Auswahl-, Sichtbarkeits- oder
Lifecycle-Entscheidung. Evidence-Records und Writerpakete dürfen keine
operative `stack_projection.v2` enthalten.

Das standalone `stack_projection.v2` entsteht ausschließlich im expliziten
Stage-4-Zweig nach bestandenem Facts-Gate aus dem vom Evidence-Lock gebundenen
`facts_package_for_stage4.v2`; das Paket selbst referenziert den Lock nicht. Es
ist kein Artikelinput und wird niemals in
Artikel-Markdown, QA-Payload oder Content-Release eingebettet. Artikelclaims
bleiben allein an ihr Stage-2-/Stage-3-Faktenpaket gebunden.

Der Child-Branch besitzt eine eigene `stage4_stack_sync`-Work-Order, ein
eigenes `stack_sync_receipt.v2` und einen eigenen Status. Er darf parallel zur
Writerwelle laufen; sein Blocker darf einen bestandenen Artikelrelease oder
Publish weder invalidieren noch zurückrollen.

## Grafiken

Standard ist `graphic_decision.mode=none`.
`graphic_decision.mode=generate` ist nur bei benanntem Erklärgewinn zulässig
und verlangt vor QA exakt eine tatsächlich eingebundene Grafik mit dem
vollständigen `article_asset.v2` aus Framework 06. Der Planner bindet Cluster-
und Obligation-IDs; erst der Packager löst die exakten Record-IDs auf. Grafik,
Alt und Caption dürfen nur freigegebene Fakten zeigen und sind Teil von
Payloadhash, Review, Release und Readback. `article_asset.v2` bindet dabei nur
den run-relativen lokalen `asset_path`; Compiler und Release leiten R2-Key und
die einzige sichtbare URL
`^/api/r2/knowledge/<canonical-slug>/[a-f0-9]{64}\.(png|jpg)$` deterministisch
aus kanonischem Slug, Bytehash und MIME ab.

Das Asset gehört derselben Writer-Ausführung: `creator` bindet Rolle, ID und
`writer_execution_id`, `work_order_id` exakt dieselbe Writer-Work-Order. Eine
separate assignee-fähige Graphic-Agent-Rolle oder zusätzliche Pipelinewelle
existiert nicht; `article-graphic-generator` ist nur das Creator-Label innerhalb
des Writerjobs.

## Compiler- und Rendervertrag

Der Compiler verarbeitet Writer-Markdown genau einmal. Er validiert striktes
UTF-8, tatsächliche Framework-/Stildatei, Links, Quellenparität, Assets,
Facts-/Lock- und Writerbindung, expandiert Quellen/Assets und friert eine
einzige sichtbare AST ein.

Vor einem Cachehit gleicht er nur den artikelbezogenen `selected_link_slice`
gegen die aktuelle autoritative Routenliste beziehungsweise bei
`target_state=same_release` gegen den anderen geplanten Artikel desselben Runs
ab. Ein ausgewähltes entferntes oder umbenanntes Ziel verlangt scoped Coverage-
Neuplanung; eine Änderung an einer unbeteiligten Route invalidiert den Artikel
nur dann, wenn ihr normalisierter Titel oder ihre Description eine echte
Kollision mit der aktuellen SEO-Projektion erzeugt. Sichtbare interne
Wissenslinks außerhalb des Slices sind unzulässig.

Der `visible_payload_hash` ist exakt der SHA-256 über die kanonische
Serialisierung von Titel, Dek, geordneter sichtbarer AST, Überschriften,
Tabellen, Links, Fazit, expandierten Quellen und Assets. Dieselbe eingefrorene
Payload steht genau einmal im `compiled_article.v2`. Dieses Compilerartefakt
enthält außerdem genau ein `qa_payload` mit
`schema=article_qa_payload.v2`; Publication-QA bindet es als Input
`compiled_article` und kopiert die Payload nicht nach `task`. Dieselbe Payload
speist:

- `article_qa_payload.v2`;
- `article_render_request.v2` und den stage-spezifischen
  `article_render_snapshot.v2` für die sichtbare Prüfung;
- die compilerseitige `article_render_projection.v2`;
- `validation_receipt.v2`;
- Publication-Review, Release, Publisher und Readback.

Stage 3 bindet daneben den payloadunabhängigen, pro unverändertem
Route-/UI-Fingerprint gecachten echten Browsernachweis
`renderer_style_validation.v2`; er wird nicht pro Artikel neu erzeugt.

Der Compiler erzeugt unabhängig vom Renderer die erwartete
`article_render_projection.v2` über H1/Dek, sichtbaren UI-Vertrag, Sections
samt Typ/Control-Typ, TOC, Fazit, Quellen, Links, Tabellenpräsentation und
Assets. Stage 3 nutzt den echten React-Snapshot; PASS verlangt
`actual_projection_hash=projection_hash`, kanonische Gleichheit, leere
Fehlerlisten und bestandene Projection-/DOM-Checks. Damit weist er insbesondere
Magazinlayout, linke Navigation, Titel, Dek, Fazit, Quellen, Links und Assets
im realen DOM nach.

Stage 2 nutzt ohne zusätzliche Browserwelle
`mode=deterministic-study-projection` mit
`contract_version=deterministic-study-projection.v2`. Erwartete und
vollständige tatsächliche Projektion enthalten alle Content-, Fazit- und
Quellenabschnitte samt Links, Tabellen und Assets, sind kanonisch identisch und
binden den aktuellen Route-Fingerprint. Das ist kein behaupteter React-Render;
die echte öffentliche Stage-2-Darstellung muss nach Publish im vollständigen
DOM-Projektionsreadback exakt der Releaseprojektion entsprechen.

Computed CSS/Layout prüft separat `renderer_style_validation.v2` im echten
Browser. Dieses Attest bindet den vollständigen Frontend-Routenfingerprint,
die kanonische Fixture und den hydrierten Route-/UI-Zustand. Es wird nur einmal
pro unverändertem `{validator_version,renderer_style_hash,fixture_hash}`
erzeugt und danach wiederverwendet; eine per-article Wiederholung ist verboten.
Compilerfehler gehen gezielt an
Writer oder Runtime; der Publication-Reviewer zählt deterministische
Strukturregeln nicht frei erneut.

Stage 3 speichert das Fazit genau einmal im sichtbaren Body/AST; ein paralleles
Conclusion-Feld bleibt leer. Stage 2 darf sein Framework-Fazit in einem
separaten Zielfeld ablegen, aber ebenfalls nur in einer sichtbaren
Repräsentation.

Compiler-/Asset-Reparaturen sind hart begrenzt: Alle im selben Lauf
ko-beobachteten Findings werden normalisiert und als ein gebündelter
Fehlerfingerprint in genau einen Auftrag gegeben, nie als getrennte
Einzelfinding-Loops. Ein zweiter Fingerprint ist nur für einen nach der ersten
Reparatur neu auftretenden Fehlerbund zulässig. Wiederholt derselbe Bund sich
oder entsteht ein dritter Fingerprint, endet der Artikel `BLOCKED` statt in
einer freien Writerschleife.

## Unabhängiges Publication-Gate

Der Publication-Reviewer ist weder Writer noch Facts-Reviewer. Seine
`publication_qa`-Work-Order bindet `compiled_article.v2` samt frozen Payload,
Projection-Hash, Facts-Paket, Validation-Receipt, Writerreceipt, Assets und
tatsächliche Frameworkdatei jeweils mit Pfad, Byte- und Inhaltshash. Für Stage
3 kommen echter React-Snapshot, gecachtes Style-PASS-Attest, Stilannotation und
Snapshot-Manifest hinzu, nicht die eingebetteten Vollreferenzen. Stage 2 bindet
den vollständigen deterministischen Projektionssnapshot samt
Route-Fingerprint; der echte DOM-Nachweis bleibt dem Publish-Readback
vorbehalten. Pro
eingefrorenem Artikelhash führt er zwei
getrennte Prüfpässe aus:

- Pass A: Claims, Zahlen/Einheiten, Sicherheit, Unsicherheit,
  Quellenzuordnung, Kontroversen und Blueprint-Coverage;
- Pass B: Verständlichkeit, Leserlogik, Struktur, People-first SEO,
  Framework- und Renderwirkung.

Die Leserfragen und erwarteten Antworten lauten exakt:

| Frage | Erwartet |
|---|---|
| Q1: Würde ein fachfremder Leser den Artikel gern lesen und verstehen? | `Ja` |
| Q2: Ist der Artikel klar, interessant, relevant und sicher eingeordnet? | `Ja` |
| Q3: Ist sichtbare System-, Prompt-, Prüf- oder Metasprache enthalten? | `Nein` |

Findings dürfen nur `blocking_facts`, `blocking_reader` oder `polish` sein und
verwenden exakt die präzisen Findingfelder aus Framework 06. `PASS` setzt
beide Pässe, alle Pflichtchecks und `Ja/Ja/Nein` voraus. Ein FAIL speichert die
tatsächlich ermittelten Antworten. Output ist genau ein
`article_publication_review.v2` nach Framework 06. Es bindet die tatsächlich
ausgegebene `publication_qa`-`work_order_id`; ein nur inhaltlich passend
aussehendes, aber nicht für diese Inputs und diesen Scope ausgegebenes Receipt
ist ungültig.

Es gibt höchstens eine gebündelte Feedbackrunde. Danach werden unter
`review_type=targeted_recheck` nur serverseitiger Diffscope, notwendige
Nachbarabsätze und abhängige Payloadteile geprüft. Die Work-Order bindet
`previous_publication_review`, `previous_compiled_article`, jedes gebundene
`asset_<n>`/`asset_receipt_<n>`-Paar sowie in `task`
`previous_review_hash`, `previous_findings_hash`, `allowed_finding_keys`,
`asset_bindings` und `required_scoped_passes=["A","B"]`. Beide Passobjekte
bleiben vorhanden und tragen ihren `scope_hash`; neue Finding-Keys sind
verboten. Maximal zwei Rechecks, also Revisionen `0..2`, sind zulässig; ein
offener Blocker endet `BLOCKED`. Veraltete Reviewinputs erzeugen eine neue
Work-Order. `polish` allein erzwingt keine Schleife.

## Release und veröffentlichte Gleichheit

Nur Artikel mit gültigem `article_result.v2`, bestandenem
`validation_receipt.v2` und bestandenem unabhängigen
`article_publication_review.v2` gelangen in `content_release.v2`. Der
Ingredient-/Source-Persistenz- und Asset-Preflight ist late-bound: Er beginnt
erst nach diesen Gates und nur bei `manifest.publish.required=true`.
Draftläufe schließen ohne D1-/R2-Write ab; Netzwerk, D1 oder R2 dürfen
Research, Facts, Writer und QA nicht blockieren. Beim Publish bindet
`ingredient_target_receipt.v1` genau ein
bestehendes aktives Ingredient, `source_resolution_receipt.v1` die eindeutige
lokale→autoritative Source-ID-Menge. Fehlende Pflichtwerte werden nicht
erfunden.

Nur für tatsächlich gebundene Assets erzeugt `asset_stage` ein
`asset_deployment_receipt.v1` mit content-addressed R2-Key, der daraus
abgeleiteten öffentlichen `/api/r2/knowledge/...`-URL sowie exaktem
öffentlichen GET-Readback von Bytes, MIME und Maßen. Ingredient- und
Asset-Preflight laufen unabhängig
parallel; Source-Sync folgt dem aufgelösten Ingredient. Ohne Asset existiert
kein Phantomreceipt.

Der
deterministische `publication_apply`-Maschinenexecutor publiziert nur bei
explizitem `manifest.publish.required=true` und gültigem Write-Guard die frozen Payload
ohne Transformation; er ist keine weitere LLM-Rolle. Der Release trägt
`atomic=true`; das meint ausschließlich den D1-Batch aus Artikeln, Ingredient-/
Quellenrelationen, Stage-2-Interpretationen und `same_release`-Artikeln. R2-
Assets und Source-Katalog werden vorher nur versioniert, additiv, idempotent und
receiptgebunden gestaged; serviceübergreifende Atomizität wird nicht behauptet.
Ein Fail darf dort höchstens harmlose unreferenzierte Zeilen/Objekte
hinterlassen, nie einen halben sichtbaren Artikel. Jeder Artikel bindet seine
`internal_link_dependencies`,
vollständige `expected_projection` samt `projection_hash` und das vollständige
Compiler-`seo`-Objekt samt `seo_hash`. Alle `same_release`-Ziele müssen im
selben Batch liegen.

`sources_json` ist ausschließlich die stage-spezifische
`knowledge_article_sources_projection.v2` aus Facts-Paket-/Relationshash und
Ingredient-IDs. Bei Stage 2 enthält sie die geordneten externen
Originalquellenrelationen mit kanonischem bibliografischem Label und
unverändertem Originallokator. Bei Stage 3 enthält sie ausschließlich die
geordneten internen Stage-2-Carrier mit bytegleichem deutschem
`source_presentation_label_de` und gebundener `/wissen/...`-Route. Für die
jeweilige Stage müssen Relationstabelle, API und sichtbare Quellen exakt
dieselben IDs, Labels und URLs in derselben Reihenfolge liefern.
`knowledge_article_ingredients` entspricht exakt der Release-Ingredientmenge.

Nur Stage 2 persistiert pro sichtbarer Source eine `status=accepted`-
Interpretation. Ihre `study_interpretation_summary.v1` enthält ausschließlich
die freigegebenen Originalquellen-Record-IDs und Facts samt Paket-/Membership-
Hash; Artikelprosa ist weder Source noch Extrakt. Persistenz- und Already-
current-Guards binden Status und `article_layer`; öffentliche Legacyfelder für
Hero, Dosis und Produktnote bleiben `null`.

Release-Zeitfelder sind late-bound: Bei Create gilt
`published_at=modified_at=reviewed_at` der bestandenen Publication-QA. Nur beim
Update stammt `published_at` aus dem persistierten `created_at` des
autoritativen Article-Target-Readbacks; `modified_at` ist das normalisierte
Maximum aus `reviewed_at`, persistiertem `updated_at` und `published_at`.
Persistenz und öffentliche Detail-API müssen diese Werte exakt reproduzieren;
sie sind keine Writerentscheidung.

`content_publish_receipt.v2` beweist pro Artikel die tatsächliche Wirkung:

- `result=applied` mit exakt einer geänderten Artikelzeile oder
  `result=already_current` mit exakt null und identischem vorherigem
  Payloadhash;
- erwartete und beobachtete Guards, Vorversion, Vorstatus und Vorhash;
- resultierende Version, Status und Payloadhash;
- erwartete/tatsächliche Relations- und Assethashes;
- konkrete targeted/public Readbackwerte;
- für jeden publizierten Artikel konkrete vollständige DOM-Projektions- und
  öffentliche SEO-Werte. Bei `S`/`M` bleibt das redaktionelle Review lokal;
  der Maschinenreadback ist ein einzelner Vollvergleich nur des Zielartikels.

Der öffentliche DOM-Readback enthält unter
`readbacks.dom.actual.projection` die vollständig beobachtete Projektion samt
Hash. Sie muss der Releaseprojektion kanonisch exakt entsprechen – TOC,
Sections, Links, Quellen, Controls, UI, Tabellen und Assets eingeschlossen.
Der SEO-Readback vergleicht analog die vollständige öffentliche SEO-Projektion
und den Hash.

Der Renderer-Request bindet außerdem sortierte eindeutige positive
`affected_ingredient_ids` und gleich geordnete `badge_expectations`. Stage 2
verlangt für seine Ingredients `studies_rule=REQUIRE_TRUE` und
`expected_has_studies=true`; sonst gilt mit Prestate `PRESERVE`, ohne Prestate
`API_DOM_PARITY`. DGE verwendet ausschließlich `PRESERVE` mit Prestate oder
sonst `API_DOM_PARITY`; der Artikellauf erzeugt keinen DGE-Wert.

Das separate `knowledge_badge_readback.v1` vergleicht releaseweit frisch
`/api/knowledge` mit dem hydrierten `/wissen`-DOM. Es bindet Releasehash, IDs,
Regeln, Erwartungswerte, API-/DOM-Status pro Ingredient/Origin, `result` und
Mismatches. `Studien` folgt nur publizierten, akzeptierten `single_study`-
Artikeln, unabhängig von Dosisfeldern; `DGE` nur aktiven öffentlich sichtbaren
DGE-Werten. Ein valides `MISMATCH` lässt korrekt committe Artikelbranches
`published=true/COMPLETE`, blockiert aber den Aggregate-Abschluss mit
Technical-/Data-Eskalation. Es gibt weder Rollback noch Writer-/Publication-QA-
Rerun; spätere Reparatur bleibt auf Overview/API/Cache und ableitende Daten
beschränkt.

Danach dokumentiert derselbe Publishlauf einmal die siteweite Roh-HTML-/SSR-,
Robots- und Sitemap-Delivery. Nur dortige Unvollständigkeit lässt den Artikel
`published=true`, setzt jedoch `seo_live_claim=false` und
`aggregate_status=WAITING_FOR_INDEXABILITY_RELEASE`; sie rollt Content nicht
zurück und startet keinen Writer. Dann ist ausschließlich ein humaner,
Release-/Receipt-gebundener `indexability_release_handoff` für die originweite
Site-Policy und danach ein frischer gezielter Public-Readback zulässig; kein
zweiter Publish oder D1-Write. Ein echter Content-, API-, DOM- oder SEO-
Projektionsmismatch bleibt fail-closed und wird kompensierend zurückgerollt.

Bloße PASS-Strings anstelle der gelesenen Werte reichen nicht. Stimmen Release,
Persistenz, API oder sichtbare Darstellung nicht exakt überein, ist der Artikel
nicht fertig publiziert.

Nur ein fehlendes Publish-Receipt darf den Maschinenexecutor starten. Ein
vorhandenes ungültiges, veraltetes oder manipuliertes Receipt sowie ein Guard-
oder Readback-Mismatch blockiert ohne automatischen Retry.

## Korrekturen

Bestehende Artikel folgen der S/M/L-Klassifikation aus `AGENTS.md` und dem
Pipelinevertrag. Das Manifest setzt `operation=article_correction` und friert
vorherige, Kandidaten- und Patchbytes in
`article_correction_input_receipt.v1` ein. `S` läuft ohne LLM direkt zur
deterministisch validierten Releasebildung. `M` erzeugt über genau eine
`article_correction`- und eine unabhängige `article_correction_review`-Order
`article_correction_result.v1` und `article_correction_review.v1`. Nur eine
fachliche, strukturelle oder unklare Änderung (`L`) erzeugt ein
`affected_pipeline_manifest` mit exakt `affected_article_ids` und öffnet deren
normalen Facts-/Writer-/Publication-Slice. Unbetroffene Artikel und bestandene
hashidentische Gates bleiben gültig; alle Wege nutzen denselben
`publication_apply`-Executor.
