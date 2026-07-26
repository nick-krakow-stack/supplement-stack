# Framework 04: Coverage, Kontroverse und Blueprint

Stage 1.5 erzeugt aus formatagnostischen strict-UTF8 Research-Inventarbytes,
Framework-Katalog und bestehender Seitenstruktur genau ein `coverage_plan.v2`.
Sie recherchiert, extrahiert und schreibt nicht. Der Coverage-Plan ist die
erste strukturierte Runtime-Grenze.

## Gebundene Eingaben

- Run-/Stoff-ID, Scope und Owner-Auftrag aus `nutrient_content_run.v2`;
- vollständige opaque Research-Inventarbytes (Markdown oder JSON) samt
  `research_hash` und gegebenenfalls dokumentierter Priorisierungsregel;
- `research_source_artifact_receipt.v2` samt Hash und den eingefrorenen
  Source-IDs/Locatoren/Bytehashes; die Vollbytes werden nicht gelesen;
- [`framework-catalog.v1.json`](framework-catalog.v1.json);
- deterministisch aus dem autoritativen DB-/Routen-Readback erzeugtes
`site_link_inventory.v2` mit bestehenden Seitenthemen, Slugs und
freigegebenen internen Linkzielen sowie publizierten Titel-/Description-Werten
sowie `article_layer` und sichtbaren `source_urls[]` samt Pfad, Byte- und
Inhaltshash;
- `stage4_requested`, standardmäßig `false`.

Fehlt eine Eingabe oder stimmt ein Hash nicht, ist der Plan `blocked`.
Stage 1.5 schätzt keinen objektiven Score neu und überschreibt keinen
deterministischen Wert.

## Ein Planungsdurchgang

### 1. Cluster und Kontroversen

Wähle nur stoffrelevante Cluster, mindestens geprüft auf Grundlagen/Funktion,
Versorgung, Referenzwerte, klinische Wirksamkeit, Sicherheit/UL,
Interaktionen, vulnerable Gruppen und materielle Kontroversen. Stack-Relevanz
wird nur bei explizitem Stage-4-Auftrag geplant. Jeder erforderliche Cluster
enthält Leserfrage, Source-IDs, Zielartikel und planseitige Risikostufe.
Irrelevantes wird mit knapper Begründung ausgelassen und erzeugt keine leeren
Artikelabschnitte.

Zusätzlich entscheidet der Planner für jeden Stoff explizit, aber
relevance-adaptiv, ob folgende Dimensionen materiell sind:

- Mangel, Versorgungsstatus und valide Statusmarker; bei nicht essenziellen
  Stoffen stattdessen die belastbare Einordnung, dass kein klassischer
  Mangel-/Referenzwertpfad besteht;
- Übermaß, Überdosierung, Obergrenzen und dosisabhängige Safety;
- chemische Formen, Bioverfügbarkeit sowie belastbare Nahrungs- und
  Supplementquellen.

Materielles erzeugt Cluster und Extraktionspflichten. Nicht stoffrelevante
oder im Inventar nicht belastbar adressierbare Dimensionen werden knapp
begründet ausgelassen; sie erzeugen weder Pflichtabschnitt noch leere
Überschrift oder Füllartikel.

Jede materielle Quellenabweichung erhält ein separates `controversy` mit
`controversy_id`, Source-IDs, Streitpunkt, Materialität, Cluster-IDs und
Darstellung `explain|limit_claim|omit_as_immaterial`. Die letzte Option braucht
eine konkrete Begründung. Jede materielle Kontroverse trägt unabhängig von
späterer Darstellungsentscheidung auf Source, Cluster, Pflicht und Plan das
Risikosignal `controversy`; sie wird nie durch ein fehlendes freies Tag
herabgestuft.

### 2. Gängige Annahmen als Evidenzfragen

Der Planner prüft den im Research-Inventar dokumentierten Abschnitt „Gängige
Annahmen und Prüfaufträge“ und bindet pro geplantem Stage-3-Artikel genau einen
`common_assumption_review`:

```json
{
  "status": "identified",
  "discovery_note": "Warum diese Annahmen für Leser materiell sind; kein Prävalenzbeleg.",
  "checks": [{
    "assumption_id": "safe-id",
    "assumption": "neutrale verbreitete Annahme",
    "reader_question": "prüfbare Leserfrage",
    "discovery_basis": "knappe Relevanzbegründung ohne fachliches Vorurteil",
    "source_ids": ["source-id"],
    "cluster_ids": ["cluster-id"],
    "obligation_ids": ["obligation-id"]
  }]
}
```

`status=identified` verlangt mindestens einen Check. Hat der gebundene Suchscope
keine materielle wiederkehrende Annahme ergeben, gilt
`status=none_identified`, `checks=[]` und `discovery_note` dokumentiert den
Suchweg; eine Quote oder Füllannahme ist verboten. `discovery_basis` belegt nur
die Leserrelevanz. Eine Formulierung wie „die meisten Menschen glauben“ darf
später nur entstehen, wenn eine Originalquelle und eine eigene
Extraktionspflicht die Prävalenz tatsächlich messen.

Jeder Check bindet mindestens eine artikelbezogene Source, einen erforderlichen
Cluster und eine Pflicht. Seine Source- und Cluster-Mengen entsprechen exakt
den Mengen seiner Obligation-IDs. Der Planner beantwortet den Check nicht. Der
Packager löst nach dem Facts-Gate aus den Pflichten die exakten Record-IDs auf;
erst Stage 3 formuliert daraus die sichtbare Antwort.

### 3. Extraktionspflichten

Erzeuge für jede benötigte Kombination aus Quelle, Cluster und erwartetem
Claim-Typ genau eine `extraction_obligation`:

```json
{
  "obligation_id": "...",
  "source_id": "...",
  "cluster_id": "...",
  "expected_claim_type": "...",
  "required": true,
  "required_for": ["article-id"],
  "plan_risk_tags": ["safety"]
}
```

Eine Pflicht beschreibt, was in der Originalquelle gesucht werden muss, nicht
was dort angeblich steht. Der Extractor beantwortet sie später ausschließlich
mit `extracted`, `not_reported` oder `blocked`. Freie Tags dürfen die
deterministische Risikostufe nur erhöhen.

`required` verlangt eine terminale Auflösung vor `writers_ready`, löst aber
allein kein Vollreview aus. `required_for` bindet Zielartikel;
`plan_risk_tags` liefern nur planseitige Eskalationssignale für die spätere
deterministische Risikoableitung. Zulässig sind `standard`, `safety`,
`dose_or_reference`, `interaction`, `vulnerable_population`, `controversy`,
`stage4_relevance` und `warning`; `standard` steht immer allein.

### 4. Eindeutige Stage-2-Source-Zuordnung

Der Default ist nicht der kleinste Artikelsatz, sondern genau ein
Stage-2-Artikel pro akzeptierter, aussagekräftiger Source. `ANCHOR` und
`SUPPORTING` steuern Evidenzgewicht und Darstellung, nicht das Recht, eine
Source ohne Relationsnachweis in einem Sammelartikel zu verstecken.

Mehrere Sources dürfen nur in genau zwei Fällen gemeinsam getragen werden:

1. `direct_research_line`: Replikation, unmittelbares Follow-up oder eine
   konkret nachweisbare Population-, Dosis-, Methoden-, Outcome- oder
   Aktualisierungserweiterung. Jede nicht als Anker gesetzte Source erhält eine
   gerichtete Relationskante samt fachlicher Begründung. Gleiche Leserfrage,
   gleiches Thema, korrelierende Ergebnisse oder Cannibalization-Vermeidung
   genügen nicht.
2. `meta_analysis_family`: Der Anker ist eine Meta-Analyse, ein systematischer
   Review oder Umbrella-Review. Die gemeinsam getragenen Sources sind exakt
   die eingeschlossenen Einzelstudien und werden jeweils als
   `meta_constituent` direkt an den Anker gebunden. Für diese Einzelstudien
   entstehen keine separaten Stage-2-Artikel.

Der Einzelfall nutzt `mode=single_source`. Jeder geplante Stage-2-Artikel
bindet `source_assignment{mode,anchor_source_id,relations[]}`. Der Plan bindet
top-level
`stage2_source_assignment_policy=one_meaningful_source_per_stage2.v1`.
Eine Source darf releaseweit nur einen geplanten Stage-2-Carrier besitzen.
Jede Stage-3-Source erscheint genau einmal in
`selected_link_slice.links[].covered_source_ids`; das Ziel ist entweder ein
`same_release`-Stage-2-Artikel oder ein im autoritativen Linkinventar als
`article_layer=single_study` bestätigter Live-Artikel, dessen `source_urls[]`
über normalisierte DOI-/PMID-/Locatoridentität exakt zu den getragenen Sources
passen.

Jeder Stage-2-Artikel erhält eine katalogisierte Framework-ID/-Version samt
tatsächlichem Repositorypfad und Datei-Bytehash, Source-IDs, Cluster,
erwartete Record-Typen, Zielpfad und denselben vollständigen People-first-SEO-
Brief wie Stage 3. Die Source-IDs entsprechen exakt den artikelbezogenen
Extraktionspflichten; der Packager leitet daraus später die sichtbare
Quellenliste ab. Homogene Jobs
werden bevorzugt in Writer-Batches von zwei bis vier Work-Orders geplant; ein
Restjob darf solo laufen. Jede Datei, Identität und Hashbindung bleibt separat.

Jede Source trägt kanonisch `author_or_institution`, `publication_year` als
Integer oder `null`, `title`, `journal_or_publisher`, `doi`/`pmid` soweit
vorhanden sowie unveränderte `url` und normalisierte `canonical_url`. Ihr
`label` ist bytegleich
`<author_or_institution> (<YYYY|o. J.>). <title>. <journal_or_publisher>.[ DOI:
<doi>.][ PMID: <pmid>.]`; optionale Identifierteile entfallen vollständig.
Der Planner übernimmt oder validiert dieses Label, der Writer formatiert es
nicht.

### 5. Stage-3-Blueprint

Der Planner wählt einen approved Stage-3-Katalogeintrag, dessen
`contract_id`/`render_profile` das kanonische `knowledge_magazine_v1` und dessen
Pfad/Bytehash das aktive Magazin-Scaffold binden. Aktuell lösen alle Varianten
auf
[`knowledge_magazine_v1@2.0.3`](03_framework_hauptartikel.md) auf. Die Variante
steuert nur Inhaltsrouting; sie ist keine zweite Authoring-, Markdown- oder
Renderwahrheit. Stoffgerechte H2 dürfen ausgelassen, benannt und umgeordnet
werden; das ist `reuse`.
`adapt_existing` bedeutet eine dauerhafte, wiederverwendbare und versionierte
Revision mit gezieltem Compiler-/Render-Vertragstest und bestandenem
Publication-Pilot. `new_archetype` bedeutet einen neuen Vertragstyp und braucht
zusätzlich Owner-Freigabe. Ein neuer Stoff allein rechtfertigt keinen der
beiden Sonderpfade. `owner_approval_required` wird bereits bei Gap-Erzeugung
gesetzt und später nicht vom Designer umgedeutet. Ein neuer Stage-3-
Inhaltsarchetyp muss das kanonische Magazin-Scaffold als Basis binden; eine
zweite unabhängige Scaffold-Wahrheit darf weder geplant noch aktiviert werden.
Weicht ein Stage-3-Kandidat bei Pfad/Bytehash, `contract_id` oder
`render_profile` vom kanonischen Framework 03 ab, muss er deshalb mindestens
die nötigen Runtime-/Rendererpfade in `technical_change_paths[]` deklarieren
und im externen Technik-Handoff stoppen; der aktuelle Content-Activator darf
ihn nie automatisch als zweites Scaffold aktivieren.

Findet der Planner keinen approved Fit, enthält `coverage_plan.v2` genau die
betroffenen `framework_gaps[]` mit `gap_id`, `article_id`, `stage`,
`decision=adapt_existing|new_archetype`, `reason`, `target_framework_id`,
`target_version`, kollisionsfreiem `target_framework_path` und
`owner_approval_required`. Die drei `target_*`-Felder bezeichnen ausschließlich
die vorgeschlagene neue aktive Identität. `adapt_existing` bindet zusätzlich
die Legacy-Felder `candidate_framework_id` und `candidate_framework_version`;
sie bezeichnen trotz ihres Namens ausschließlich das approved
**Basisframework**, das die Runtime aus dem aktiven Katalog zu
`base_framework{framework_id,version,path,byte_hash}` auflöst. Sie sind nie die
vorgeschlagene Kandidatenidentität. Bei `new_archetype` sind beide Felder
`null` und die Owner-Freigabe ist zwingend. Der Artikel bleibt
`status=blocked`. Die Runtime setzt vor Plan-Parity und Evidence
`WAITING_FOR_FRAMEWORK` und gibt eine scoped `framework_design`-Work-Order an
`article-framework-designer` für genau einen Gap aus. Deren Outputs liegen
ausschließlich unter
`framework-candidates/<gap_id>/`; weder Designer noch Pilot schreiben den
aktiven Katalog oder das freigegebene Frameworkziel. Der Runner stellt dafür
eine `framework_pilot_fixture.v1` aus, die Ziel, aufgelöste Basis,
Katalogbytehash und Runtime-/Frontendhashes bindet.

Der `framework_catalog_candidate.v1` bindet die ausgegebene Work-Order und
Fixture und deklariert `technical_change_paths[]` samt exakter
`technical_change_baseline`. Nur bei leerer Pfadliste dürfen Compiler-, Render-
und Publication-Pilot ihre drei echten Receipts aus derselben Work-Order und
Fixture erzeugen; danach komponiert der Runner das Gesamtpilotreceipt. Eine
nichtleere Liste stoppt den Contentlauf vor jedem Pilot unter
`WAITING_FOR_TECHNICAL_FRAMEWORK_CHANGE` und erzeugt nur die Human-Work-Order
`framework_runtime_change_handoff`. Sie autorisiert keine Änderung. Erst eine
separat ausdrücklich beauftragte technische Implementierung mit Tests,
unabhängigem Technikreview und neuen Runtime-/Frontendhashes kann den Gap
beheben. Danach startet ein neuer Contentlauf; der Runner stellt Kandidat,
Fixture und alle Piloten gegen die neuen Bytes neu aus. Das alte Kandidaten-
oder Reviewreceipt darf den Lauf weder fortsetzen noch aktivieren.

Bei gesetztem
`owner_approval_required` folgt danach ein separates menschliches
`framework_owner_approval_receipt.v1` aus der Human-Work-Order
`framework_owner_approval` an `framework-owner-approver`. Erst der
deterministische
`framework_catalog_activate`-Schritt aktiviert den hashgebundenen Kandidaten
atomar gegen den erwarteten alten Kataloghash und nur bei noch freiem Ziel. Mit
dem neuen Kataloghash wird anschließend der vollständige Coverage-Plan neu
erzeugt, nie ein Plan-Delta. Weitere Gaps werden erst aus diesem neuen Plan
bearbeitet, damit jeder Kandidat den tatsächlich aktuellen Kataloghash bindet.

Jeder Artikel bindet genau einen `seo_brief` mit:

- `primary_intent`, `reader_question` und `reader_promise`;
- `primary_topic_phrase` und drei bis sechs `secondary_questions`;
- `cannibalization_note` und `internal_link_targets`.

Zusätzlich bindet jeder geplante Artikel den aus dem Vollinventar ausgewählten,
nach Pfad sortierten
`selected_link_slice{links[],slice_hash}`. Jeder Link enthält `path`, `title`,
`target_id` als Slug und `target_state=live|same_release`; nur bei
`same_release` kommt `target_article_id` hinzu. Seine Pfadmenge ist exakt
`internal_link_targets`, der Hash bindet kanonisch `{links}`. `live` muss im
autoritativen Inventar existieren. `same_release` muss auf einen anderen
geplanten Artikel desselben Runs und dessen exakte `/wissen/<slug>`-Route
zeigen; die Runtime übernimmt diese Kante als `internal_link_dependencies` und
verlangt beide Artikel im selben atomaren Release. Das Vollinventar bleibt
Plannerinput und wird weder Writer noch Publication-QA weitergereicht. Eine
spätere Änderung eines ausgewählten Ziels plant nur betroffene Artikel neu.

Technischer Title, Meta-Description, Canonical, Robots, JSON-LD und SEO-Hash
sind kein Planoutput; der Compiler leitet sie aus dem finalen Artikel ab und
prüft sie deterministisch. Das Stage-3-Paket bindet zusätzlich:

- `blueprint_id`, Framework-ID/-Version und Zielpfad;
- alle `required_cluster_ids` und `controversy_ids`;
- den vollständigen `common_assumption_review`, dessen Checks ausschließlich
  artikelbezogene Source-, Cluster- und Obligation-IDs verwenden;
- artikelbezogene Source-IDs; die sichtbare Quellenliste entsteht erst
  deterministisch im Facts-Paket;
- `graphic_decision` mit `mode=none|generate`, Begründung und bei `generate`
  den fachlich tragenden `cluster_ids` und `obligation_ids`.

Paket-ID, Gate- und Lockbindung entstehen erst nach Extraktion und Facts-Gate;
der Planner darf sie weder vorhersagen noch als zweite Wahrheit ausgeben.

Standard der Grafikentscheidung ist `none`. `generate` verlangt einen
konkreten visuellen Erklärgewinn und löst die Asset-Pflichten aus Framework 03
aus. Der Planner kennt noch keine Record-IDs; erst der Packager löst nach dem
Facts-Gate aus den gebundenen Pflichten die exakten `record_ids` auf.

### 6. Neu entdeckter Konflikt

Findet die Extraktion einen zuvor nicht planbaren materiellen Konflikt, erzeugt
die Runtime eine neue, auf betroffene Quellen, Cluster, Pflichten,
Kontroversen und Artikel begrenzte `coverage_planning`-Work-Order. Ihr Output
ist erneut ein vollständiger `coverage_plan.v2` mit neuem `content_hash`;
unbetroffene IDs und deren per-article Lineage bleiben stabil. Ein separates
Plan-Delta ist kein aktiver Output. Neue Pflichten werden vor dem Facts-Gate
extrahiert und geprüft.

## Output und Gate

Output ist genau ein `coverage_plan.v2` mit Inputhashes, Planneridentität,
Clustern, Kontroversen, `common_assumption_review`, Extraktionspflichten,
source-granularem Artikelsatz, Writer-Batches, Stage-3-Blueprint, Framework-Fit
und `stage4_requested`. Jede
Frameworkbindung enthält tatsächlichen Repositorypfad und Datei-Bytehash;
`framework_hash` bindet dieses Objekt. Daraus werden vollständige, disjunkte
und parallelisierbare Work-Orders des einen `nutrient_content_run.v2`
abgeleitet; kein zweites Manifest und keine parallele Artikelliste entstehen.

`status=ready` gilt nur, wenn jede materielle Quelle zugeordnet oder begründet
ausgeschlossen ist, jeder Cluster Quellen und Zielartikel besitzt, jede
Kontroverse entschieden ist, jeder Stage-3-Artikel einen konsistenten
Annahmen-Review besitzt, alle Pflichten eindeutig sind, Frameworks im
Katalog auflösbar sind, Zielpfade kollisionsfrei im erlaubten Root liegen und
jede akzeptierte Source genau einen zulässigen Stage-2-Carrier und genau eine
interne Stage-3-Präsentation besitzt. Alte Coverage-Pläne ohne die gebundene
Policy oder ohne `source_assignment` sind für neue Läufe stale und müssen neu
geplant werden.
