# Stage-2 Source Coverage Backfill – Fortschritt

Stand: 2026-07-22

Dieses Dokument verfolgt die Wirkstoffe, deren Stage-2-Abdeckung nach dem
artikelorientierten Standard aus
[`stage2-source-coverage-update-flow.md`](stage2-source-coverage-update-flow.md)
neu auditiert werden muss. Ein Eintrag in dieser Liste bedeutet zunächst
`AUDIT_REQUIRED`, nicht automatisch, dass alle bestehenden Artikel falsch sind.

## Verbindliche Reihenfolge

| Priorität | Wirkstoff | Research-Inventar | Bisher Stage 2 | Bisher gemappte Sources | Status | Nächster Schritt |
|---:|---|---:|---:|---:|---|---|
| 1 | Vitamin D | 1.108 global deduplizierte Sources | 34 granulare Live-Carrier; alter Sammelcarrier zurückgezogen | 909 operative Originallokatoren | `PUBLISHED_READBACK_PASS` | Abgeschlossen; Release `sha256:85a4c2c10b1555bef72bd9f1b8dc725fd25f55e2a5ffc3044c2c7ac29ef4b932` |
| 2 | Vitamin K | 191 global reconciled | 60 granulare Live-Carrier; alter Sammelcarrier zurückgezogen | 170 operative Originallokatoren | `PUBLISHED_READBACK_PASS` | Abgeschlossen; Release `sha256:d1d8db3a305d790e72359755dad03b4fcd338c2cef537e5adb46c70203c6a5ef` |
| 3 | Vitamin B12 | 58 dedupliziert; 136 operative Sources nach Meta-Auflösung | 42 granulare Live-Carrier; alter Sammelcarrier zurückgezogen | 136 operative Originallokatoren | `PUBLISHED_READBACK_PASS` | Abgeschlossen; Release `sha256:12ea3e1c95c05143ff194219e17172af25a9dc205ad92f37f37c66003c3fe06f` |
| 4 | Vitamin C | 442 global deduplizierte operative Sources | 21 granulare Live-Carrier; alter Sammelcarrier zurückgezogen | 442 eindeutige Originallokatoren in 591 sichtbaren Relationen | `PUBLISHED_READBACK_PASS` | Abgeschlossen; Release `sha256:3c94f6a8c3966132395f7e4a0a79887989dfbdbc00760b6c02625bccc0ebf31c` |
| 5 | Magnesium | 60 operative Originalsources | 12 granulare Live-Carrier | 60 operative Originallokatoren | `PUBLISHED_READBACK_PASS` | Abgeschlossen; Release `sha256:ceb1c54dd72087c3fa61c57fec11ab56f8fd3dabe1dc79b92dc8d01785658764` |
| 6 | Calcium | 90 operative Originalsources | 14 granulare Live-Carrier | 90 operative Originallokatoren | `PUBLISHED_READBACK_PASS` | Abgeschlossen; Release `sha256:b4188d0e7d41db31245356068d108867618b2ebb83394ed33305aecb53841027` |
| 7 | Kalium | 55 operative Originalsources | 10 granulare Live-Carrier | 55 operative Originallokatoren | `PUBLISHED_READBACK_PASS` | Abgeschlossen; Release `sha256:b0c000efc7333999cdf25d066441138e200dd71a2bfaf1812a49c96d05d3b281` |

Die Zahlen unterscheiden bewusst zwischen Research-Inventar, ausgewählten
beziehungsweise gemappten Sources und Artikeln. Sie werden nach jedem
Reconciliation-Preflight durch die vier finalen Kennzahlen
`research_inventory_total`, `selected_for_stage3_total`,
`stage2_carried_source_total` und `visible_source_url_total` ersetzt.

## Weitere Auditkandidaten

| Gruppe | Wirkstoffe | Status | Grund |
|---|---|---|---|
| stark gruppierte Vitamin-Backfills | Vitamin B1, B6, B7, B9, E | `AUDIT_REQUIRED` | nur ein publizierter Stage-2-Carrier trotz mehrerer gemappter Sources |
| gemischte Vitamin-Backfills | Vitamin B2, B3, B5 | `AUDIT_REQUIRED` | wenige Carrier; zulässige direkte Linien und Einzelartikel noch nicht neu klassifiziert |
| Mineralstoffe und Elektrolyte | Elektrolyte | `AUDIT_REQUIRED` | gemischte aktive/inaktive Artikel und mögliche historische Sammelzuordnung; Magnesium, Calcium und Kalium abgeschlossen |
| weitere niedrige Abdeckung | Cholin, Inositol | `AUDIT_REQUIRED` | geringe Artikelzahl gegenüber vorhandenem Research-/Mapping-Bestand |
| neue Vollpipelines unter altem Gruppierungsstandard | Ginseng, Grapefruitkernextrakt | `AUDIT_REQUIRED` | mehrere akzeptierte Sources auf wenige Stage-2-Artikel verteilt |

Wirkstoffe oberhalb dieser auffälligen Gruppe – von Vitamin A bis Zeolith –
werden nicht pauschal neu geschrieben. Sie erhalten nach Abschluss der
priorisierten Liste einen strukturellen Carrier-Audit; nur echte Gaps oder
unzulässige Mehrquellenartikel wechseln in einen Content-Backfill.

## Abgeschlossener Auditbefund: Calcium

- `90` operative Originalsources sind über `14` zulässige Stage-2-Carrier
  vollständig getragen; drei Meta-Familien behalten ihre nicht besitzenden
  Konstituenten als sichtbare externe Originalquellen.
- Der Hauptartikel beantwortet `11/11` gebundene Alltagsannahmen und zeigt
  exakt `14` interne Stage-2-Quellen mit deutschen Originaltiteln; externe
  Links im Hauptartikel: `0`.
- Release `sha256:b4188d0e7d41db31245356068d108867618b2ebb83394ed33305aecb53841027`
  ist atomar `COMMITTED`; `15/15` öffentliche API-, DOM-, Roh-HTML-, SEO-,
  Sitemap- und Indexability-Readbacks sowie DGE-/Studien-Badges sind `MATCH`.
- Der explizite Stage-4-Zweig bleibt fachlich korrekt `BLOCKED`, weil vier
  Kandidaten keine belastbare numerische Menge/Einheit für die gebundene
  Erwachsenenpopulation liefern. Der veröffentlichte Artikelbranch ist davon
  unberührt.

## Abgeschlossener Auditbefund: Kalium

- `55` operative Originalsources sind über `10` zulässige Stage-2-Carrier
  vollständig getragen; `122/122` Extraktionspflichten und `231/231`
  Evidenzrecords wurden in vier unabhängigen Facts-Review-Shards bestanden.
- Der Hauptartikel beantwortet `11/11` gebundene Alltagsannahmen und zeigt
  exakt `10` interne Stage-2-Quellen mit deutschen Originaltiteln; externe
  Links im Hauptartikel: `0`.
- Release `sha256:b0c000efc7333999cdf25d066441138e200dd71a2bfaf1812a49c96d05d3b281`
  ist atomar `COMMITTED`; `11/11` öffentliche API-, DOM-, Roh-HTML-, SEO-,
  Sitemap- und Indexability-Readbacks sowie DGE-/Studien-Badges sind `MATCH`.
- Der explizite Stage-4-Zweig bleibt fachlich korrekt `BLOCKED`: Das gebundene
  Paket enthält 23 populations- beziehungsweise targetheterogene Kandidaten,
  die nicht ohne freie Ergänzungen vollständig auf den Erwachsenen-Guard
  projiziert werden dürfen. Bestehende DGE-Zeilen blieben unverändert; der
  veröffentlichte Artikelbranch ist davon unberührt.

## Bestätigter Auditbefund: Vitamin D

- Das deduplizierte Inventar enthält `58` Sources: `35` Studienentscheidungen
  und `23` offizielle Kontextquellen. Bei den Studien wurden `30` behalten,
  `4` zunächst als Meta-Konstituenten markiert und `1` überholter Review
  ausgeschlossen.
- Öffentlich bestehen genau der Hauptartikel und der gruppierte Stage-2-Artikel
  `vitamin-d-evidenzquellen`. Der Carrier trägt `16` Sources, mischt jedoch
  zehn institutionelle Quellen mit sechs fachlich unabhängigen Studien- und
  Review-Sources. Er ist nach dem aktuellen Vertrag `SPLIT_REQUIRED`.
- Die Reconciliation ordnet alle `58/58` Inventarsources eindeutig zu:
  `2` vorläufige Single-Source-Reuse-Kandidaten, `3` Publikationen einer
  möglichen VITAL-Forschungslinie, `19` Meta-Familien-Kandidaten, `20` offene
  Einzelcarrier und `14` ausgeschlossene beziehungsweise nicht ausgewählte
  Kontextsources.
- Bei allen `15` operativen Meta-/Review-Ankern fehlt im Altbestand die
  vollständige identitätsgebundene Liste der eingeschlossenen Primärstudien.
  Die Originalanhänge wurden deshalb vollständig materialisiert. Meta-A enthält
  `1.031` deduplizierte Evidenzeinheiten aus `1.074` Parent-Relationen,
  darunter `107` unmittelbar eingeschlossene Reviews des Umbrella-Reviews;
  Meta-B enthält `136` deduplizierte Publikationen aus `180`
  Parent-Mitgliedschaften.
- Von den Meta-A-Einträgen besitzen `849` einen öffentlichen
  Original-Locator; `182` sind mit konkretem Locator-Blocker markiert. Source
  `520` nennt nur aggregierte Mengen ohne öffentlich vollständige Liste und
  bleibt blockiert. Source `528` sowie der narrative Review `545` sind
  Single-Source-Carrier, keine Meta-Familien.
- Der Nicht-Meta-Audit bestätigt `23` Carrier für `25` Sources: `22`
  Single-Source-Artikel und eine zulässige VITAL-Forschungslinie aus den
  Sources `522`, `523` und `549`.
- Der globale Dedupe korrigiert diese Vorstufe: `522`, `539`, `543`, `546` und
  `547` sind bereits echte Meta-Konstituenten und erhalten nach der
  Owner-Regel keinen zweiten Carrier. `523` und `549` werden deshalb getrennte
  Single-Source-Carrier. Final geplant sind `20` Nicht-Meta-Carrier plus `14`
  Meta-Familien, insgesamt `34` Stage-2-Artikel.
- Der globale Bestand umfasst `1.108` Sources. Nach dem letzten
  Identitätsabgleich gelten `34` als `selected_for_stage3` und `875` als
  veröffentlichbare Meta-Konstituenten; ein bloßer Faculty-Opinions-
  Empfehlungsdatensatz zum bereits getragenen ViDiCO-PMID wurde als Derivat
  entfernt. Der formale Lauf friert damit `909` operative Originalsources ein;
  `14` bleiben ausgeschlossen und `184` mit transparentem Blocker außerhalb
  des operativen Laufs.
- Research-Receipt, Coverage-Plan, `1.075/1.075` Extraktionspflichten und das
  unabhängige Facts-Gate sind `PASS`. `34` Stage-2-Artikel und der Stage-3-
  Hauptartikel sind geschrieben, kompiliert und render-validiert; das
  Publication-Gate läuft.
- Sieben lokale Altartikel bleiben redaktionelle Vorarbeiten. Nur der
  DEGS1-Artikel und der EFSA-UL-Artikel sind vorläufig quellengenaue
  Reuse-Kandidaten; auch sie benötigen neue v2-Lineage, Facts-Gate,
  Publication-Gate und Live-Readback.

## Abgeschlossener Auditbefund: Vitamin C

- `442` global deduplizierte operative Originalsources sind vollständig
  eingefroren und über `489/489` bestandene Extraktionspflichten facts-geprüft.
- `15` Single-Source-Carrier und `6` vollständig aufgelöste Meta-/Review-
  Familien ergeben `21` granulare Stage-2-Artikel. Die Meta-Familien enthalten
  `421` nicht besitzende Konstituenten; über zulässige Überschneidungen ergeben
  sich `591` sichtbare Stage-2-Originallinks.
- Alle `21` Stage-2-Artikel geben Bedingungen beziehungsweise Grundlage,
  Design, grobe Inhalte, zentrale Ergebnisse und Grenzen der Quelle auf Deutsch
  wieder. Reine Metaumschreibungen waren im Publication-Gate blockierend.
- Der Hauptartikel beantwortet `7/7` gebundene Alltagsannahmen und zeigt exakt
  `21` interne Stage-2-Quellen mit deutschen Originaltiteln; externe Links im
  Hauptartikel: `0`.
- Release `sha256:3c94f6a8c3966132395f7e4a0a79887989dfbdbc00760b6c02625bccc0ebf31c`
  ist `COMPLETE` und atomar `COMMITTED`. API, Roh-HTML, Hydration, SEO,
  Sitemap, Robots und DGE-/Studien-Badges sind `MATCH`; der alte Sammelcarrier
  `vitamin-c-evidenzquellen` ist öffentlich abwesend.

## Bestätigter Auditbefund: Vitamin B12

- Das historische Inventar enthält `58` eindeutige Sources: `37`
  Studienquellen und `21` institutionelle Quellen. DOI-, PMID- und
  URL-Normalisierung ergeben keine Publikationsdublette.
- Die vollständige Reconciliation akzeptiert `47` Owner-Sources: `17`
  institutionelle Quellen und die `30` bereits fachlich behaltenen Studien.
  Weitere `2` Studien sind bekannte nicht besitzende Meta-Konstituenten; `9`
  Sources sind begründet ausgeschlossen. Darunter sind fünf therapeutische
  Mangelbehandlungsstudien, drei Diagnose-/Therapiedokumente und eine
  redundante DGE-Presseableitung.
- Der Carrier-Entwurf umfasst `41` `single_source`-Artikel und `6`
  `meta_analysis_family`-Artikel. Eine direkte Forschungslinie ist nicht
  belegt. Die sechs Meta-Anker bleiben bis zur vollständigen Auflösung aller
  unmittelbar eingeschlossenen Evidenzeinheiten blockiert.
- Die zwei bisher bekannten Konstituenten besitzen zwei explizite
  Mitgliedschaftsrelationen. Vor der noch offenen Meta-Erweiterung umfasst der
  operative Bestand damit mindestens `49` eindeutige Sources und `49`
  sichtbare Stage-2-Quellenrelationen.
- Ein frischer read-only Produktionssnapshot bestätigt genau einen
  Stage-3-Hauptartikel (`version=2`) und einen gruppierten Stage-2-Artikel
  (`version=1`) mit `8` gemappten Originalsources.
- Der Acht-Quellen-Sammelartikel mischt Behördenquellen, Reviews,
  Meta-Analysen und ein RCT ohne belegte gemeinsame Forschungslinie. Er ist
  deshalb `SPLIT_REQUIRED` und kein gültiger Mehrquellen-Carrier nach dem
  aktuellen Vertrag.
- Für sieben der acht gemappten Sources existieren lokale Einzelentwürfe. Sie
  sind Inhaltskandidaten, aber noch keine formal wiederverwendbaren v2-Zweige.
  Die acht eingefrorenen Originaldateien stimmen dagegen bytegenau mit ihrem
  Source-Artifact-Receipt überein und können im neuen Lauf wiederverwendet
  werden. Der reproduzierbare Coverage-Blueprint plant derzeit `96`
  Extraktionspflichten in `14` Writer-Batches; beide Zahlen wachsen um die
  vollständig materialisierten Meta-Konstituenten.

## Bestätigter Auditbefund: Vitamin K

- Das kombinierte historische Rohinventar enthält `99` Sources: `69`
  Studienquellen und `30` offizielle Quellen, aufgeteilt auf `50` K1- und `49`
  K2-Sources.
- Die ältere Fachbewertung führte `61` historische Studienkandidaten: `48`
  Studien wurden behalten und `13` als mögliche Meta-Konstituenten markiert.
  Weitere `5` Studien galten als überholt und `3` als nicht passende
  Spezialpopulationen.
- Öffentlich bestehen genau ein Stage-3-Hauptartikel und ein gruppierter
  Stage-2-Artikel. Alle `7` akzeptierten Live-Mappings zeigen auf
  `vitamin-k-evidenzquellen`.
- Dieser Sieben-Quellen-Artikel mischt eine Behördenbewertung, Reviews,
  Meta-Analysen und eine Einzelstudie ohne vollständigen zulässigen
  Relationsgraphen. Er ist deshalb `SPLIT_REQUIRED` und muss durch
  Single-Source-Carrier beziehungsweise vollständig belegte Meta-Familien
  ersetzt werden.
- Die deutsche und die englische Fassung derselben BfR-Höchstmengenbewertung
  wurden ebenso wie weitere Locator derselben WHO/FAO-, NNR- und
  Health-Canada-Publikationen zusammengeführt. DOI-, PMID-, URL- und diese
  nachgewiesenen Publikationsdubletten reduzieren `99` Rohzeilen auf `84`
  eindeutige Sources; `15` redundante Zeilen liegen in `14` Identitätsgruppen.
- Die beiden Meta-Inventargruppen enthalten `146` lokale
  Konstituentenzeilen. Die globale DOI→PMID→URL-Reconciliation führt sie zu
  `124` Evidenzeinheiten und `168` Parent→Konstituenten-Relationen zusammen;
  `22` gruppenübergreifende Dubletten wurden entfernt. Zusammen mit dem
  historischen Inventar entstehen `191` eindeutige Sources: `64` Owner,
  `121` nicht besitzende Meta-Konstituenten und `6` weiterhin ausgeschlossene
  Sources. Eine zuvor ausgeschlossene Einzelstudie ist im Originalgraphen als
  Meta-Konstituent belegt und wird deshalb nicht mehr global ausgeschlossen.
- Der Carrier-Entwurf umfasst unverändert `53`
  `single_source`-Artikel und `11` `meta_analysis_family`-Artikel; eine direkte
  Forschungslinie ist nicht belegt. Die 53 Single-Source-Carrier blieben unter
  dem Planobjekt-Hash
  `sha256:7dba0f53d7363676c6a7775e96ab470f2a5b4ca284d2b6a8c58b836ddccc6f07`
  unverändert.
- `7` Meta-Owner sind jetzt `ready_for_source_freeze`; `4` bleiben
  transparent blockiert: Violi wegen `15` nicht identitätsgebundener
  Einschlussslots, El-Sabban wegen widersprüchlicher Originaltabellen und
  einer eingeschlossenen retrahierten Publikation, Kramps wegen der nicht
  bytegebundenen Originalreferenzliste und Mott wegen eines nur auf den
  Konferenzband zeigenden Container-DOI. Damit sind `185` operative eindeutige
  Sources und `232` sichtbare Stage-2-Quellenrelationen geplant; `60` der `64`
  Carrier sind vor dem Source-Freeze plan-ready.
- Die `7` eingefrorenen Originalartefakte stimmen bytegenau mit ihrem
  Source-Artifact-Receipt überein und sind wiederverwendbar. Die historischen
  Einzelartikelentwürfe bleiben dagegen nur redaktionelle Vorarbeiten, bis sie
  eine gültige v2-Lineage und alle aktuellen Gates erhalten haben.

## Statusdefinitionen

| Status | Bedeutung |
|---|---|
| `AUDIT_REQUIRED` | noch keine neue Source→Carrier-Matrix |
| `AUDIT_RUNNING` | read-only Bestands- und Research-Reconciliation läuft |
| `AUDIT_COMPLETE_RECONCILIATION_REQUIRED` | Vorab-Audit abgeschlossen; vollständige Deduplizierung und neue Source→Carrier-Zuordnung stehen aus |
| `PREFLIGHT_PREPARED_META_FREEZE_PENDING` | Research-Reconciliation, Carrier- und Coverage-Blueprint stehen; vollständige Meta-Konstituenten, Source-Freeze und finale Runtime-Inputs fehlen noch |
| `META_CONSTITUENT_RESEARCH_RUNNING` | Source-Reconciliation abgeschlossen; vollständige Meta-/Review-Konstituenten werden aus Originalquellen ergänzt |
| `GLOBAL_RECONCILIATION_RUNNING` | Parent-Listen vollständig; globale Deduplizierung, Locator-Gates und finale Carrier-Matrix laufen |
| `FORMAL_PIPELINE_PREPARATION` | globale Reconciliation bestanden; ein v2-Manifest, Source-Receipt, Coverage-Plan und Evidence-Build werden materialisiert |
| `PUBLICATION_QA_RUNNING` | Facts-Gate, Writer und Compiler bestanden; das unabhängige Publication-Gate läuft |
| `PLANNED` | neuer `coverage_plan.v2` besteht alle Source-Assignment-Gates |
| `WRITING_QA` | Facts-Gate bestanden; betroffene Stage-2-/Stage-3-Jobs laufen |
| `READY_TO_PUBLISH` | Publication-Gate und late-bound Preflights bestanden |
| `PUBLISHED_READBACK_PASS` | guarded veröffentlicht; öffentlicher DOM-/API-/SEO-Readback vollständig |
| `BLOCKED` | konkreter fachlicher, technischer oder externer Blocker dokumentiert |

## Abschlussmatrix

Nach jedem Wirkstoff wird eine Zeile ergänzt:

| Wirkstoff | Inventar | Für Stage 3 akzeptiert | Single-Source getragen | Direct-Line getragen | Meta-Anker | Meta-Konstituenten | Stage-2-Artikel live | Sichtbare Originallokatoren | Uncovered | Duplicate Carrier | Stage-3-Duplikate | Ergebnis |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---|
| Vitamin D | 1.108 | 34 Owner-Sources | 20 Nicht-Meta-Carrier | 0; VITAL-Anker 522 als Meta-Konstituent absorbiert | 14 | 875 veröffentlichbare Evidenzeinheiten | 34 live; alter Sammelcarrier draft | 909 operative Originallokatoren | 0 im finalen Plan, Source 520/183 Locatorfälle transparent blockiert | 0 | 0 | `PUBLISHED_READBACK_PASS` |
| Vitamin K | 191 global | 60 plan-ready Owner-Sources | 51 | 0 | 9 | 110 operative nicht besitzende Konstituenten | 60 live; alter Sammelcarrier draft | 170 operative Originallokatoren | 0 im finalen Plan; 2 Meta-Familien upstream transparent blockiert | 0 | 0 | `PUBLISHED_READBACK_PASS` |
| Vitamin B12 | 136 operative Sources | 42 Owner-Sources | 40 | 0 | 2 | 94 operative nicht besitzende Konstituenten | 42 live; alter Sammelcarrier draft | 136 operative Originallokatoren | 0 | 0 | 0 | `PUBLISHED_READBACK_PASS` |
| Vitamin C | 442 operative Sources | 21 Owner-Sources | 15 | 0 | 6 | 421 nicht besitzende Konstituenten | 21 live; alter Sammelcarrier draft | 442 eindeutige Locator / 591 sichtbare Relationen | 0 | 0 | 0 | `PUBLISHED_READBACK_PASS` |

`PUBLISHED_READBACK_PASS` ist nur zulässig, wenn `Uncovered`,
`Duplicate Carrier` und `Stage-3-Duplikate` jeweils `0` sind und das
`content_publish_receipt.v2` samt öffentlichem Readback vollständig gebunden
ist.
