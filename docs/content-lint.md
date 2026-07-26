# Content-Compiler und deterministischer Lint

Der Content-Lint prüft technische, reproduzierbare Eigenschaften eines
Artikeloutputs. Er ersetzt weder Source-Facts-Review noch das unabhängige
Publication-Gate. Im kanonischen Lauf sitzt er genau hier:

Die fachliche Lineage davor beginnt mit formatagnostischen, strikt
UTF-8-validierten und hashgebundenen Researchbytes. Der Lint erfindet dafür
kein Feldschema; strukturierte Validierung beginnt bei `coverage_plan.v2` und
den daraus gelockten Facts-Paketen.

```text
nutrient_content_run.v2
  -> article_result.v2
  -> validation_receipt.v2
  -> article_publication_review.v2
  -> content_release.v2
  -> content_publish_receipt.v2
```

Der Writer liefert sichtbares Markdown plus `article_result.v2`. Der Compiler
assembliert daraus genau einen eingefrorenen sichtbaren Payload, prüft ihn und
erzeugt bei PASS eine `validation_receipt.v2`. Nur dieser kompilierte Hash darf
an Publication-QA, Release, Write und Readback weitergereicht werden.

## Deterministische Prüfungen

Der Lint prüft je nach Artikeltyp insbesondere:

- striktes UTF-8, Mojibake und verbotene System-/Workflow-Sprache;
- H1/H2-Struktur, Pflichtmarker, leere Abschnitte und Platzhalter;
- Markdown-Links, für generierte Artikelassets exakt
  `^/api/r2/knowledge/<canonical-slug>/[a-f0-9]{64}\.(png|jpg)$` und nichtleere
  Alttexte;
- Quellenmarker und die ausschließlich aus freigegebenen Relationen erzeugte
  Quellenliste;
- Slug, Framework-/Renderprofil und Sidecar-/Hashbindung;
- Zahlen-/Einheitentokens und andere maschinell prüfbare Obligations gegen das
  lockgebundene Facts-Paket;
- interne `/wissen/`-Links ausschließlich gegen den artikelgebundenen
  `selected_link_slice`; das vollständige Linkinventar erreicht Writer und
  Reviewer nicht;
- Runtime-kompatible Assembly ohne doppelte Fazit- oder Quellenrepräsentation.

`## Quellen` mit ausschließlich `<!-- sources:auto -->` ist kein leerer
Abschnitt. Writer dürfen dort keine manuellen Quellen-URLs ergänzen.

### Reines Stage-2-v2-Markdown

Stage 2 verwendet ausschließlich das sichtbare Markdown aus dem ausgewählten
[`Framework 01`](../codex-files/frameworks/01_framework_single_study.md) oder
[`Framework 02`](../codex-files/frameworks/02_framework_meta_study.md). Blöcke
wie `Kernfelder (Metadaten)`, `Artikel`, `Abschlussstatus`, Hashes oder
Reviewstatus sind im v2-Artikel verboten. Technische Daten stehen nur im
`article_result.v2` und den lockgebundenen Inputs.

Ein alter Stage-2-Container wird nie automatisch als v2 interpretiert. Er muss
über den ausdrücklich gewählten Legacy-Input-Adapter zuerst in reines Markdown
und ein v2-Sidecar normalisiert werden.

### Stage-3-Magazin

Für Stage 3 ist ausschließlich
[`Framework 03`](../codex-files/frameworks/03_framework_hauptartikel.md)
kanonisch. Der Compiler prüft dessen exakte Struktur, einschließlich Byte-1-H1,
einem Dek, Magazinmarker, drei bis sechs Kernaussagen, adaptivem Inhalt, Fazit
und letzter Quellen-H2 mit genau einem Auto-Quellenmarker. Die Dokumentation
kopiert dieses Skelett bewusst nicht als zweite Wahrheit.

Die unabhängige Projektionsprüfung bindet zusätzlich die sichtbare UI und
Semantik des Magazinrenderers: Abschnittstyp und optionale Kontrollblockart,
TOC-Ziele, Daten- versus Lebensmittel-Tabellen, jede integrierte Grafik,
Quellenlabels/-anzahl, Lesezeit und feste UI-Texte. Merkkasten und rechtlicher
Hinweis bleiben explizite Kontrollblöcke und werden nie als gewöhnlicher
nummerierter Inhaltsabschnitt oder TOC-Eintrag behandelt.

Ein separater echter Browser-PASS hydratisiert die kanonische
`/wissen/:slug`-Route einschließlich App, Layout, API-Fixture und Disclosure-
Interaktionen. Sein Cache-Key ist
`(validator_version, renderer_style_hash, fixture_hash)`; er enthält keine
Artikel- oder Snapshot-Hashes und wird deshalb für alle Artikel wiederverwendet,
solange Route, Styles, Build-/Paketversionen und Fixture unverändert sind.
Ein beschädigter lokaler Cache wird aus dem validierten gemeinsamen Receipt
rekonstruiert oder einmal neu geprüft. Browser-/Renderer-Infrastrukturfehler
gehen direkt in eine technische Integrity-Eskalation und niemals als
sinnlose Textrevision an den Writer.

## Eingefrorener Payload und Assets

Die `validation_receipt.v2` bindet mindestens:

- Artikelbytes und `article_result.v2`;
- kompilierten Review-/Publish-Payload;
- Facts-Paket und Evidence-Lock;
- Framework-, Renderprofil-, Validator- und Policyversion;
- geordnete Quellenrelationen;
- jedes sichtbare Asset über ein `article_asset.v2` mit aufgelöstem Pfad,
  Bytehash, Dimensionen, Alttext, Caption und freigegebenen Record-IDs.

Publication-QA liest den eingefrorenen Payload und seine gebundenen Assets,
nicht eine später veränderbare Neuberechnung. Eine Änderung an Markdown,
Quellenreihenfolge, Caption, Alttext oder Assetbytes erzeugt einen neuen
Payloadhash und macht Validation und Publication-Review des Artikels ungültig.

Lokale Assetpfade werden nur innerhalb des erlaubten Asset-Roots aufgelöst.
Absolute/UNC-/Traversal-Pfade, aus dem Root aufgelöste Verknüpfungen, externe
Bild-URLs und Daten-URLs werden im kanonischen Magazinpfad abgewiesen. Vor dem
Release werden Existenz und Bytehash erneut geprüft.

## Source-aware bedeutet echte Evidenzbindung

Ein Receipt darf `source_aware=true` nur tragen, wenn der Validator tatsächlich
den Evidence-Lock, das zugehörige Facts-Paket, seine freigegebenen Record-IDs,
Quellenrelationen und alle für den Artikel geltenden Obligations geprüft hat.
Ein reiner Text-/Strukturlint ist nützlich, aber nicht source-aware.

`writers_ready` aus dem Evidence-Gate ist Voraussetzung, kein Ersatz für den
Artikellint. Umgekehrt kann ein strukturell sauberer Artikel ein fehlendes oder
gescheitertes Facts-Gate nicht heilen.

## Cache, Revision und gezielter Recheck

Eine Prüfung wird pro
`(payload_hash, validator_version, policy_version)` höchstens einmal
inhaltlich ausgeführt. Bei Cachetreffern werden Receipt und sämtliche
Dependency-/Outputbytes dennoch rekonstruiert und verglichen.

Ergibt Publication-QA blockierende Befunde, erhält der Writer eine gebündelte,
präzise Revision-Work-Order. Der neue Artikelhash durchläuft die betroffenen
deterministischen Prüfungen erneut. Anschließend erhält der Reviewer nur Diff,
Nachbarabsätze, berührte Claims/Quellen und sichtbare Folgewirkungen. Pro
Artikel sind höchstens zwei solche zielgerichteten Revisionen/Rechecks
(`revision=1` und `revision=2`) zulässig; ein weiterer Blocker stoppt den Lauf.
Eine wissenschaftliche oder vollständige Review wird nur bei einer
substanziellen Claim-, Safety- oder Strukturänderung neu geöffnet.

Compiler-/Assetfehler besitzen eine noch härtere Kante: pro
`(article_id, revision, failure_fingerprint)` genau ein Reparaturversuch und
höchstens zwei verschiedene Fingerprints. Derselbe Fehler nach seinem Versuch
oder ein dritter verschiedener Fehler eskaliert, statt eine Endlosschleife zu
erzeugen.

## Diagnose-CLI

Der direkte Aufruf bleibt für lokale Diagnose und Legacy-Fixtures verfügbar:

```powershell
node scripts/content-lint.mjs --file artikel.md --type stage3
node scripts/content-lint.mjs `
  --file artikel.md `
  --type stage2 `
  --coverage coverage-plan.json `
  --evidence source-evidence-bundle.json `
  --source-review review-01.json `
  --facts-gate facts-completeness-gate.json

node --test scripts/content-lint.test.mjs
```

Relative Diagnosepfade benötigen eine eindeutige Root-/Bundle-Basis. Das
aktuelle Arbeitsverzeichnis oder der Speicherort eines kopierten Pakets darf
nicht stillschweigend als Provenienz dienen.

Exitcode `0` bedeutet PASS, `1` gefundene Lintfehler und `2` ungültige
CLI-Eingabe. Ein CLI-PASS erzeugt für sich allein keine Publication-Freigabe;
im v2-Lauf ist dafür die vollständig gebundene `validation_receipt.v2`
erforderlich.
