# Framework 02: Systematischer Review oder Metaanalyse

Version: `2.0.1`
Gilt für `systematic_review_or_meta_analysis`.

Globale Grenzen stehen in
[`00_globale_regeln.md`](00_globale_regeln.md), Evidenzbindung in
[`06_framework_coverage_source_evidence.md`](06_framework_coverage_source_evidence.md).

## Input und Batch

Pro Artikel liegt eine vollständige, nach Framework 06 gehashte
`writer`-Work-Order aus `nutrient_content_run.v2` vor. Sie bindet Stoff,
Sprache, Artikelscope, genau ein bestandenes `facts_package_for_stage2.v2`,
sichtbare Quellen im Paket, die tatsächliche Frameworkdatei mit Pfad/Bytehash,
Zielpfade und dessen artikelbezogenen `selected_link_slice`. Originalquellenartefakte
oder `reused_sources` sind kein Writerinput. Der
People-first-SEO-Brief enthält genau `primary_intent`, `reader_question`,
`reader_promise`, `primary_topic_phrase`, drei bis sechs
`secondary_questions`, `cannibalization_note` und `internal_link_targets`.
Zwei bis vier homogene Review-/Meta-Jobs dürfen gemeinsam geschrieben werden;
Dateien, Receipts, frozen Payloads und Publication-Gates bleiben getrennt.

## Sichtbares Markdown

```markdown
# [source_presentation_label_de: deutscher Titel des Reviews/der Metaanalyse]

[ein kurzer Lead: Gesamtbefund plus wichtigste Einschränkung]

## [Welche Frage wurde untersucht?]

[Population, Intervention/Exposition, Vergleich und Zielgrößen]

## [Wie wurde die Evidenz zusammengeführt?]

[Such-/Auswahlrahmen, Studientypen, Umfang und Synthesemethode – nur soweit berichtet]

## [Was zeigt der Gesamtbefund?]

[Effekt, Heterogenität, Unsicherheit und relevante Untergruppen]

## [Wie belastbar ist das Ergebnis?]

[Bias, Inkonsistenz, Übertragbarkeit, Publikationsbias, Grenzen]

## [Einordnung für Supplement Stack]

[nüchterne Leserbedeutung und Supporting-Evidenz]

## Fazit

[knappe, abgewogene Schlussfolgerung]

## Quellen

<!-- sources:auto -->
```

Adaptive H2 dürfen stoffgerecht benannt und irrelevante Blöcke ausgelassen
werden. `Fazit` und `Quellen` bleiben Pflicht.

## Inhaltliche Pflicht

- Der H1 entspricht bytegleich `source_presentation_label_de` und damit dem
  deutschen Titel des Originalreviews beziehungsweise der Originalmetaanalyse.
- Der Artikel gibt den Review selbst auf Deutsch wieder: Frage, Bedingungen,
  Such-/Auswahlrahmen, eingeschlossene Populationen und Studien,
  Synthesemethode, zentrale Gesamtergebnisse, Heterogenität, Grenzen und
  Einordnung – jeweils soweit freigegebene Records vorliegen.
- Eine gekürzte Wiedergabe ist zulässig. Reine Metaumschreibungen über das
  Thema oder den Bezug des Reviews ohne substantielle Inhalts- und
  Ergebniswiedergabe sind unzulässig.
- Reviewtyp korrekt benennen; narrativer Review ist keine Metaanalyse.
- Studien-/Teilnehmerzahl, Population und Endpunkte nur mit freigegebenen
  Angaben quantifizieren.
- Gepoolten Effekt samt Einheit, Richtung und Unsicherheit erklären, wenn
  berichtet.
- Heterogenität kontextbezogen statt als Qualitätslabel erklären.
- Subgruppen, Sensitivitätsanalysen und Meta-Regressionen nicht kausal
  überinterpretieren.
- Bias, Publikationsbias, Inkonsistenz und Übertragbarkeit sichtbar machen.
- Supporting-Evidenz einordnend verwenden, ohne den Reviewbefund zu ersetzen.
- Jede materielle Zahl, Einheit und Safety-Aussage auf freigegebene Record-IDs
  zurückführen.
- Primäre Suchintention und Nebenfragen natürlich beantworten, nur gebundene
  interne Links setzen und exakte Parität zwischen verwendeten Source-IDs,
  sichtbarer Quellenliste und Facts-Paket erhalten.

## Receipt und Fertigstellung

Das sichtbare Markdown enthält keine IDs, Hashes, Kernfelder, Abschlussstatus
oder Importblöcke. Der Writer liefert separat genau das vollständige
`article_result.v2` aus dem Abschnitt „Writer-, Asset- und
Publication-Bindung“ von Framework 06; Teilreceipts oder zusätzliche Sidecars
sind ungültig. Der Compiler leitet technischen Title und Meta-Description erst
aus dem finalen Artikel ab. Compiler und unabhängiges Publication-Gate erteilen
die Freigabe.
