# Framework 01: Einzelstudie oder Behörden-/Leitlinienquelle

Version: `2.0.1`
Gilt für `clinical_single_study` und `authority_guideline_safety`.

Globale Grenzen stehen in
[`00_globale_regeln.md`](00_globale_regeln.md), Evidenzbindung in
[`06_framework_coverage_source_evidence.md`](06_framework_coverage_source_evidence.md).

## Input und Batch

Der Writer erhält pro Artikel eine vollständige, nach Framework 06 gehashte
`writer`-Work-Order aus `nutrient_content_run.v2`. Sie bindet Stoff, Sprache,
Artikelscope, genau ein bestandenes `facts_package_for_stage2.v2`, die
  tatsächliche Frameworkdatei mit Pfad/Bytehash, Zielpfade, sichtbare Quellen im
  Faktenpaket und dessen artikelbezogenen `selected_link_slice`. Originalquellenartefakte
  oder `reused_sources` sind kein Writerinput. Der People-first-SEO-Brief enthält
genau `primary_intent`, `reader_question`, `reader_promise`,
`primary_topic_phrase`, drei bis sechs `secondary_questions`,
`cannibalization_note` und `internal_link_targets`. Zwei bis vier homogene Jobs
dürfen gemeinsam ausgeführt werden; jeder Output bleibt eine eigene Datei mit
eigenem `article_result.v2`.

## Sichtbares Markdown

Die Datei enthält ausschließlich publizierbaren Artikeltext:

```markdown
# [source_presentation_label_de: deutscher Titel der Originalquelle]

[ein kurzer Lead: wichtigste Aussage und Einordnung]

## [Warum diese Quelle relevant ist]

[Kontext und Leserfrage]

## [Design oder Entstehungsgrundlage]

[Studientyp/Behördenprozess, Population, Vergleich, Dauer und Endpunkte – nur soweit vorhanden]

## [Ergebnisse oder Kernaussagen]

[absolute Werte und Unsicherheit, wenn freigegeben]

## [Grenzen und Einordnung]

[was die Quelle zeigt und nicht zeigt; Supporting-Evidenz]

## Fazit

[knappe abgewogene Schlussfolgerung]

## Quellen

<!-- sources:auto -->
```

Adaptive H2 werden leserfreundlich benannt. Bei Behörde, Leitlinie oder
Sicherheitsquelle ersetzt die passende Bewertungslogik das klinische
Studiendesign. Irrelevante Abschnitte entfallen; `Fazit` und `Quellen` bleiben.

## Inhaltliche Pflicht

- Der H1 entspricht bytegleich `source_presentation_label_de` und damit dem
  deutschen Titel der Originalstudie beziehungsweise institutionellen Quelle.
- Der Artikel gibt die Quelle selbst auf Deutsch wieder: Fragestellung,
  Bedingungen, Design/Entstehungsgrundlage, Population,
  Intervention/Exposition, Vergleich, Dauer, Endpunkte, zentrale Ergebnisse,
  Grenzen und Einordnung – jeweils soweit freigegebene Records vorliegen.
- Eine gekürzte Wiedergabe ist zulässig. Reine Metaumschreibungen wie „In der
  Studie geht es um …“ oder „Die Studie bezieht sich auf …“ ohne substantielle
  Inhalts- und Ergebniswiedergabe sind unzulässig.
- Primärquelle und Supporting-Quellen unterscheidbar halten.
- Design, Population, Intervention/Exposition, Vergleich, Dauer und Endpunkte
  nur mit freigegebenen Records nennen.
- Relative Effekte nicht ohne verfügbaren absoluten Kontext aufblasen.
- Primäre, sekundäre und explorative Endpunkte unterscheiden, wenn relevant.
- Keine Wirksamkeitsbehauptung aus Mechanismus, Surrogat oder Beobachtung.
- Bei Behörde/Leitlinie Geltungsbereich, Adressaten, Stand und rechtlichen
  Status erklären; keine individuelle Anweisung ableiten.
- Limitierungen und Übertragbarkeit sichtbar machen.
- Jede materielle Zahl, Einheit und Safety-Aussage auf freigegebene Record-IDs
  zurückführen.
- Primäre Suchintention und Nebenfragen natürlich beantworten, nur gebundene
  interne Links setzen und exakte Parität zwischen verwendeten Source-IDs,
  sichtbarer Quellenliste und Facts-Paket erhalten.

## Receipt und Fertigstellung

Technische Metadaten stehen nie im Markdown. Der Writer liefert separat genau
das vollständige `article_result.v2` aus dem Abschnitt „Writer-, Asset- und
Publication-Bindung“ von Framework 06; Teilreceipts oder zusätzliche Sidecars
sind ungültig. Der Compiler leitet technischen Title und Meta-Description aus
dem finalen Artikel ab und erzeugt danach frozen sichtbaren Payload sowie
`validation_receipt.v2`.

Writer-seitig fertig ist der Artikel bei gedeckten Aussagen, verständlicher
Struktur, gültigem Quellenmarker und passendem Receipt. Publication-Freigabe
erteilt erst `article_publication_review.v2`.
