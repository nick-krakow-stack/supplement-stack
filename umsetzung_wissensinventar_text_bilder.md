# Umsetzung: vollständiges Wissensseiten-Inventar, Textqualität und Bilder

Stand: 15.09.2026 · Status: IN ARBEIT — autorisierte Fortsetzung im neuen Worktree

## Vollständiger Auftrag

Abschnitt 21 des Audits umfasst derzeit 790 Wissensseiten: 44 Hauptartikel und
746 Studien-/Quellenartikel. Jede Seite wird einzeln nachgewiesen. Hauptartikel
müssen das Thema tatsächlich erklären, nicht den Rechercheprozess beschreiben.
Zielgruppe ist ausdrücklich Klasse 7–8; diese Vorgabe ist strenger als die
bisherige Zehntklässler-Vorgabe des Qualitätsvertrags.

- Hauptartikel: Text-UX 10/10 und technischer SEO-Score mindestens 98/100.
- Quellenartikel: Text-UX mindestens 7/10 und SEO mindestens 90/100 als obere
  Grenze des angeforderten Zielbereichs 85–90; bessere Ergebnisse bleiben erhalten.
- Hauptartikel: sichtbare Bildbriefings finden, fachlich passende Bilder wenn
  möglich erstellen und wirklich einbinden. Nicht selbst erfüllbare Bildaufträge
  kommen mit Artikel, Stelle, Motiv und benötigten Angaben auf eine Abschlussliste.
- Quellenartikel: keine neuen Bilder; versehentliche Bildbriefings entfernen.
- Verständlichkeit verbessern, ohne Quellen, Zahlen, Einschränkungen und
  Sicherheitsinformationen zu verfälschen. Keine ungeprüften Fakten ergänzen.
- Geschützt veröffentlichen/deployen und den jeweils betroffenen Umfang prüfen.

## Fortschritt

- [x] Auftrag, Abschnitt 21, Bewertungsgrundlage und Korrekturverträge lesen.
- [x] Vorhandene 790er-Daten und aktuelle Releasebelege sparsam zusammenführen;
  vollständiges Einzelinventar mit Herkunft und Prüffundstellen erzeugen.
- [x] Alle 44 Hauptartikel auf Inhalt, Sprache und Bilder vollständig lesen.
- [ ] Alle 746 Quellenartikel auf Mindestverständlichkeit und Bildbriefings prüfen.
- [ ] Pro notwendiger Korrektur Klasse S/M/L vor Writerzuweisung festlegen;
  bestehende Originalquellen-/Facts-Lineage deterministisch auf Wiederverwendung prüfen.
- [ ] Betroffene Artikel korrigieren; geeignete Bilder innerhalb des jeweiligen
  Writerauftrags erstellen und integrieren oder präzise offene Bildliste führen.
- [ ] Unabhängige Publikationsprüfung einschließlich Text-UX-Kriterien; notwendiges
  Feedback einmal gebündelt an Autoren, danach nur betroffene Deltas nachprüfen.
- [ ] Bestehenden Publisher und gebundene Vorzustände nutzen; keine freien
  Produktionspatches und keine Ausweitung der reinen SEO-Vertragsausnahme auf Prosa.
- [ ] Technische SEO-Nachweise je Seite und vollständige Zielartikel-Readbacks;
  unveränderte Template-/Site-Nachweise wiederverwenden.
- [ ] Alle 790 Einzelzeilen im Audit mit tatsächlichen Ergebnissen abschließen,
  Bildliste, Checkliste, Deploy-Log und Goal-Abnahme fertigstellen.

## Bewertungsregeln

### Autorisierte Fortsetzung im Worktree df83

Die Research-Reconciliation-Erweiterung ist implementiert: sechs gezielte
Tests und unabhängiger technischer Review bestanden. Der festgestellte
Verzeichnisalias-Sonderfall ist behoben und separat getestet. Release läuft;
noch keine neue Artikelpublikation. Paket D ist jetzt60/60 vollständig gelesen
(42 neue Lektüren); Paket E und das disjunkte Paket F laufen weiter.
Die übernommenen Originaldateien bleiben bytegleich; Transferbeleg und Review
liegen unter `.agent-memory/wissensinventar-20260914/`.

### Zwischenstand vom 15.09.2026

211 von 746 Quellenartikeln sind vollständig gelesen, ohne Überschneidungen:
13 priorisierte Artikel, Pakete A/B/C mit jeweils 60 und Paket D mit 18.
535 Quellenartikel sind noch offen. Die Befunde sind redaktionelle Erstprüfungen,
keine Fakten- oder Publikationsfreigaben. Paket D bleibt mit 42 ungelesenen
Zielen wiederaufnehmbar. Noch keine Artikelinhalte dieses Auftrags veröffentlicht.

Der unabhängige DGE-Korrekturlauf hat die Originalquellen-Extraktion abgeschlossen
und die Faktenprüfung erreicht. Sein echter Vorzustand kostete 18 D1-Lesezeilen;
das gemeinsame Linkinventar und vorhandene Originaldateien wurden wiederverwendet.

Die zuvor dokumentierten Fortsetzungshindernisse werden im autorisierten neuen
Worktree bearbeitet:

- Alpha-Liponsäure braucht einen gezielten semantischen Quellennachzug. Der
  bestehende Runner kann dafür weder den fehlenden Suchscope noch die 22
  wiederverwendbaren Quellen in einer neuen Research-Order binden. Er setzt
  `reused_sources=[]` und allgemeine Suchbereiche fest. Ein reiner Source-Freeze
  darf diese semantische Lücke nicht ersetzen. Der abgeschlossene Freeze hat
  alle 22 Dateien unverändert erhalten; der Salinas-Volltext bleibt unzugänglich.
  Die eng begrenzte technische Erweiterung ist inzwischen ausdrücklich
  autorisiert und wird vor der Artikelüberarbeitung implementiert, unabhängig
  geprüft und deployed. Keine manipulierten Work-Orders.
- Die aktuelle Aufgabe meldet beim Start weiterer unabhängiger Agenten
  `agent thread limit reached`. Die Fakten- und Publikationsprüfung darf nicht
  durch umbenannte bereits beteiligte Agenten simuliert werden. Für die
  erforderlichen unabhängigen Rollen ist eine neue Aufgabe mit der gesicherten
  Übergabe nötig; der Owner hat diese Fortsetzung ausdrücklich beauftragt.
  Neue echte Agenten sind gestartet; bisherige Rollenidentitäten bleiben erhalten.

Keine weiteren D1-Abfragen oder Produktionsänderungen für diese Diagnose.

SEO behält die sechs Kategorien des Audits: Status/Indexierung 25,
Head-Metadaten 20, Roh-HTML/Semantik 20, Social/Schema 15, Auffindbarkeit 10,
Auslieferung 10. Jeder Punkt braucht einen konkreten Nachweis; keine pauschale
Erhöhung der bisherigen Templatewerte und keine Garantie eines Google-Rankings.

Text-UX bewertet Einstieg, tatsächliche Themenantwort, Lernreihenfolge,
erklärte Fachbegriffe, Satz-/Absatzverständlichkeit, hilfreiche Überschriften,
konkrete Einordnung, erhaltene Unsicherheit/Sicherheit, sinnvolle Darstellung
und hilfreiches Fazit. Die unabhängige redaktionelle Prüfung begründet den
Wert am jeweiligen Text. Automatische Lesbarkeitswerte dienen nur als Hinweise;
wissenschaftliche Originaltitel oder Literaturangaben werden nicht für einen
höheren Lesbarkeitswert verfälscht. Kein 10/10 nur wegen bestandener Softwaretests.

## Arbeits- und Datenbankgrenzen

Erst lokale vollständige Artikel und gespeicherte öffentliche Beobachtungen
nutzen. Ihre Herkunft wird ausgewiesen; sie ersetzen keinen frischen Write-Guard.
Aktuelle Produktion wird mit kompaktem gebündeltem Inventar abgeglichen;
vollständige Vorzustände werden nur für tatsächlich geänderte Ziele gelesen.
Keine pro Artikel wiederholten Gesamttabellenabfragen. Keine erneute Vollsuite
oder Vollcrawls ohne reale Änderung. Kein separater Bildagent oder zusätzliches
LLM-SEO-Gate. Bilder, Alttexte und Bildunterschriften gehören zur Artikelprüfung.

Belege: `.agent-memory/wissensinventar-20260914/`.

## Bestandsprüfung abgeschlossen, Korrekturen offen

Alle 44 Hauptartikel sind vollständig gelesen; die Fundstellenzitate wurden
gegen die lokalen Volltexte bestätigt. In 18 Hauptartikeln stehen echte
Bildbriefings. Zwei automatische Treffer in Quellenartikeln sind dagegen
inhaltliche Sätze und bleiben erhalten. Die Hauptartikel benötigen nach der
Erstprüfung jeweils eine Klasse-L-Korrektur; das ist keine Publikationsfreigabe.

Der aktuelle kompakte Produktionsabgleich bestätigt 790 Artikel ohne
Bestands-/Versionsabweichung zum rekonstruierten lokalen Inventar. Erfolgreicher
Abgleich: 916 D1-Lesezeilen, keine Schreibzeilen. Er ist kein vollständiger
Write-Guard. Quellenartikel werden zunächst lokal geprüft; historische niedrige
Scores lösen ohne aktuellen Textbefund keine erneute Korrektur aus.

### Technische Erweiterung vor Artikelkorrekturen freigegeben

Der vorhandene `authoritative_before`-Weg verlangt ausdrücklich sowohl
`article.seo_json === null` als auch `state.seo === null` und fehlende alte
Compiler-Lineage (`scripts/lib/article-correction-v1.mjs`,
`validateAuthoritativeCorrectionBeforeV1`; entsprechender Pipelinevertrag).
Alpha-Liponsäure hat nach dem abgeschlossenen SEO-Release bereits gespeicherte
SEO-Daten und erfüllt diese Voraussetzung nicht. Eine SEO-only-Freigabe ist
keine ursprüngliche Artikel-/Facts-/Compiler-Lineage.

Der Owner hat die eng begrenzte Erweiterung für historische Artikel mit
vorhandenen SEO-Daten am 14.09.2026 ausdrücklich freigegeben.
Keine SEO-Daten löschen, keine alten Compiler-Receipts erfinden und keinen
alternativen freien Publisher verwenden. Die vollständige Altzustandsbindung,
Version, Identität, Relationen, erwartete Counts, Fakten-/Publikationsprüfung
und der atomare Apply samt Readback müssen erhalten bleiben. Eine Umsetzung
benötigt gezielte Positiv-/Negativtests und unabhängigen technischen Review.
Der Befund wurde lokal festgestellt, ohne zusätzlichen D1-Zugriff.

- [x] Owner-Freigabe zur engen Kompatibilitätserweiterung.
- [x] Vorhandene SEO-Daten korrekt validieren und vollständig an den Altzustand binden.
- [x] Gezielte Erfolgs-, Fehler-, Konkurrenz-, Noop- und Rollbacktests: 7/7 lokal bestanden.
- [x] Unabhängiger technischer Review des fertigen Diffs: PASS, gebundene Dateihashes und 7/7 Tests.
- [x] Bestehenden Releaseweg verwenden und Veröffentlichung bestätigen: Deployment 34880186676 und gezielter Live-Readback PASS.
- [x] Normalen Artikelkorrekturlauf mit echten Vorzuständen fortsetzen: Alpha-Liponsäure erreicht `WAITING_FOR_RESEARCH`.

Technischer Release: PR #35, Merge `8fa344b`; PR-CI `34879886173`,
Main-CI `34880186660` und Deployment `34880186676` bestanden. Pages:
`74bb22ba.supplementstack.pages.dev`. Keine Migrationen erforderlich.
Öffentliche API bestätigt den unveränderten Artikelinhalt; die neue
Pages-Auslieferung liefert den Artikel mit H1 und korrekter Canonical-Adresse.
Ein zuerst falsch angenommener API-Wrapper wurde nur im lokalen Prüfskript
korrigiert; zwei gezielte Abrufe anschließend bestanden, kein Vollcrawl.
Der echte L-Vorzustand samt kanonischem Linkinventar wurde mit insgesamt
10.956 D1-Lesezeilen und 0 Schreibzeilen erfasst. Davon entfallen 10.908 auf
das gemeinsame Linkinventar, das nicht je Artikel erneut abgefragt werden soll.
Ein abgelaufener Login wurde nach einem HTTP-401 über die vorhandene Sitzung
erneuert; keine neuen Zugangsdaten nötig. Noch kein Artikelpublish.

## Bildaufträge aus den tatsächlichen Fundstellen

Arbeitsliste, noch keine Aufforderung an den Owner, selbst Bilder zu erstellen.
Die Motive sind noch nicht fachlich freigegeben. Pro Artikel wird höchstens eine
Grafik im Writerauftrag erstellt; bei mehreren alten Briefings ersetzt eine
passende Grafik den erklärungsbedürftigsten Zusammenhang. Übrige Briefingtexte
dürfen nicht sichtbar bleiben. Alttext, Bildunterschrift und Mobilansicht gehören
zur Abnahme. Keine Dosisempfehlungen, Heilversprechen oder erfundenen Zahlen.

| Erledigt | Artikel | Vorgesehenes Motiv und besondere Grenze |
|---|---|---|
| [ ] | Alpha-Liponsäure | Gebundener Helfer im Zellstoffwechsel gegenüber freier Aufnahme; keine automatische Nutzenverbindung. |
| [ ] | Cholin | Zusammenhang mit Zellmembranen, Fetttransport, Botenstoff und Betain; Begriffe direkt erklären. |
| [ ] | Chrom | Chrom(III) und Chrom(VI) klar unterscheiden; keinen gesicherten Bedarf suggerieren. |
| [ ] | Kollagen | Körpereigene Bildung bis zur Faser; kein direkter Pfeil vom Supplement zur Haut oder zum Gelenk. |
| [ ] | Kupfer | Aufnahme, Transport, Leber/Galle und Verwendung; keine irreführende Zink-Kupfer-Waage. |
| [ ] | Mangan | Unterschiedliche Aufnahmewege; keine Gleichsetzung ihrer Risiken. |
| [ ] | MCT-Öl | Darm, Leber und Ketonkörper; keine Wirkungspfeile zu Krankheiten oder Gewichtsverlust. |
| [ ] | Omega-3 | ALA, EPA und DHA samt begrenzter Umwandlung; keine unbelegten Prozentangaben. |
| [ ] | OPC | Aufnahme/Umbau nur nach Klärung der Human- und Extraktgrenzen; Tierbefunde nicht als menschlichen Ablauf zeigen. |
| [ ] | Probiotika | Stamm, Produkt, lebende Menge, untersuchte Gruppe und Ergebnis getrennt einordnen. |
| [ ] | Q10 | Zellfunktion, Blutwert und Studienergebnis als unterschiedliche Ebenen. |
| [ ] | Saccharomyces boulardii | Hefe, Stamm, Menge, Produkt und untersuchte Gruppe; keine Behandlungsanleitung. |
| [ ] | Selen | Qualitative Versorgungsbereiche; keine skalierte U-Kurve oder individuelle optimale Menge. |
| [ ] | Vitamin B2 | Aufnahme und Helferformen FMN/FAD; einen Versorgungstest davon trennen. |
| [ ] | Vitamin B3 | Ausgangsstoffe und NAD/NADP; Rechenäquivalente nicht als biologische Station darstellen. |
| [ ] | Vitamin B5 | Aufnahme und Coenzym A; Pantethin getrennt, keine behauptete Akne-/Blutfettwirkung. |
| [ ] | Vitamin E | Vereinfachte Membran und Unterbrechung oxidativer Ketten; keine Krankheitsprävention versprechen. |
| [ ] | Zeolith | Studienmaterial, Futtermittel und Marktprodukt unterscheiden; keine Entgiftungs- oder Zulassungssymbole. |

Vitamin A enthält bereits drei echte SVG-Verweise und keinen Bildauftrag.
Diese vorhandenen Grafiken benötigen eine tatsächliche Sichtprüfung, keine
automatische Neuerstellung. Die beiden Quellenartikel-Treffer zu Vitamin A
waren Fehlalarme; die betreffenden Sicherheit-/Populationssätze bleiben erhalten.
