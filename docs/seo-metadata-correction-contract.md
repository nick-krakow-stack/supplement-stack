# Eng begrenzte Korrektur vorhandener SEO-Texte

## Autorisierung und Abgrenzung

Der Owner hat am 14.09.2026 auf die konkrete Frage nach einem abgesicherten,
unabhängig geprüften SEO-Korrekturweg ohne erneuten vollständigen Artikelprozess
die Fertigstellung beauftragt. Dieser Vertrag beschreibt genau diese Ausnahme
für SEO-04, SEO-05 und UXSEO-04. Er stuft Metadatenänderungen nicht zu S oder M
herab und behauptet keine erneute fachliche Freigabe historischer Artikel.

Der Modus `seo_metadata_correction` gehört zur Operation `article_correction`
und nutzt ausschließlich den bestehenden deterministischen
`publication_apply`-Einstieg. Er darf nur die getrennten Suchtexte eines bereits
publizierten Artikels ändern. Eine notwendige fachliche Korrektur am Artikel
bleibt ein normaler betroffener L-Slice; sie wird nicht nebenbei durchgeführt.

## Eine Wahrheit und erhaltene Felder

Die einzige persistente SEO-Wahrheit bleibt `knowledge_articles.seo_json`.
Der Renderer verwendet sie bereits für den technischen Seitentitel und die
Suchbeschreibung. Ein Editorartefakt ist ein eingefrorener Prüfinput, keine
zweite laufend gepflegte Inhaltsquelle. Der normale Compiler bleibt ohne
diesen ausdrücklich gewählten Korrekturmodus unverändert.

Erlaubte Änderungen an Artikelzeilen: ausschließlich `seo_json` und eine technische
Versionserhöhung um eins. Titel/H1, Summary/Dek, Body, Fazit, Originalquellen,
Links, Bilder, Mengenfelder, Status, Aktualisierungsgrund und sämtliche
Artikeldatumswerte bleiben exakt erhalten. Auch Quellen-, Ingredient-, Part-
und Interpretationsrelationen bleiben mit allen Werten, IDs, Reihenfolgen und
Counts identisch. Reviewzeit und technische Applyzeit stehen im Receipt,
nicht als vorgetäuschte neue fachliche Prüfung im Artikel.

Eine bereits vorhandene technische Nebenwirkung bleibt erhalten: der bestehende
Artikel-Update-Trigger erhöht den Invalidierungszähler der Wissensübersicht in
`knowledge_overview_projection_meta`. Der Guard bindet diesen bestehenden
Mechanismus und seinen erwarteten Zähleranstieg; er wird weder abgeschaltet
noch als Änderung von Artikelinhalten ausgegeben. Alle übrigen Felder der
Cachemetazeile bleiben erhalten, abgesehen von ihrem technischen Zeitstempel.
Noops erhöhen auch diesen Zähler nicht. Tatsächliche D1-Schreibzahlen enthalten
diese Triggerwirkung und dürfen nicht mit der Zahl geänderter Artikel verwechselt
werden. Neue oder veränderte ungebundene Trigger blockieren den Write.

Canonical, Robots und Article-JSON-LD werden nicht redaktionell verändert.
Bei bisher fehlendem `seo_json` wird die bereits öffentlich abgeleitete
SEO-Grundstruktur deterministisch übernommen; das sichtbare H1 und die
Artikelbeschreibung im Article-Schema behalten ihren Inhalt. Nur die zwei
Suchtexte dürfen abweichen. Bestehende SEO-Struktur bleibt ansonsten identisch.

## Redaktion und unabhängige Prüfung

Ein Editor erstellt für jedes exakt bezeichnete Ziel einen Vorschlag gegen
den vollständigen eingefrorenen Artikel. Ein unabhängiger Reviewer prüft
jeden Vorschlag einschließlich der im Artikel belegten Einschränkungen.
Review und Vorschlag binden Ziel, vollständigen Vorzustand und exakte Bytes.
Der Reviewer ist nicht der Editor; der Orchestrator ersetzt diese Abnahme nicht.

Die Suchtexte müssen die jeweilige Leserfrage konkret und verständlich
wiedergeben. Pauschale Fülltexte, blindes Abschneiden, neue oder verstärkte
Wirkversprechen, neue Zahlen/Quellen, Dosierungsempfehlungen, Werbung und
abgeschwächte Sicherheitshinweise sind unzulässig. Ein unklarer Vorschlag
blockiert genau sein Ziel. Es wird kein neues Facts-Gate-PASS erfunden.

Deterministische Pflichtprüfungen: valides UTF-8, deutsche Umlaute, reiner
Text, Titel 15–70 und Description 40–180 Zeichen, unterschiedliche Titel und
Description sowie normalisierte Eindeutigkeit gegen alle publizierten
Artikel und innerhalb des Zielpakets. Die bestehenden Grenzen werden nicht
als feste Suchmaschinenlimits dargestellt. Nach Review geänderte Texte
invalidieren die betroffene Freigabe.

## Sicherer, sparsamer Publish

Vor Apply wird ein vollständiger autoritativer Vorzustand mit Datenbank-ID,
Slug, Version, Status, Altwerten und Relationshashes gesichert und gegen den
freigegebenen Zustand geprüft. Ein alter Snapshot allein autorisiert keinen
Write. Schema-/Spaltenabweichungen sind kein Anlass, fehlende Werte zu erfinden.

Der bestehende `publication_apply`-Executor prüft die gebundene unabhängige
Abnahme, eindeutige Zielmenge und exakten Releasehash. Der D1-Batch schützt
vollständige Vor- und Nachzustände atomar. Konkurrenz, fehlende Abnahme,
manipulierte Texte oder falsche Counts führen vor dem Commit zum Abbruch.
Ein identischer gültiger Nachzustand ist ein Noop; er verursacht keine weitere
Versionserhöhung. Ein fehlender öffentlicher Nachweis bleibt ausdrücklich
unvollständig und erlaubt kein behauptetes COMPLETE.

Vorhandene lokale Snapshots dienen der redaktionellen Arbeit. Neue D1-Lese-
zugriffe werden gebündelt, über indizierte Zielschlüssel eingegrenzt und mit
`rows_read`/`rows_written` protokolliert. Keine wiederholten Gesamttabellenscans
pro Artikel, keine zusätzlichen vollständigen Website-Crawls für unveränderte
Routen. Der globale kompakte Eindeutigkeitsbestand wird einmal pro Release
eingelesen und im Speicher geprüft. SQL-Parameter- und Batchgrenzen bleiben
wirksam; technische Portionierung darf notwendige Atomizität nicht vortäuschen.

## Abnahme

Ein risikoproportionaler technischer Review prüft den neuen persistenten Guard
und die Runtimeintegration. Tests decken insbesondere unerlaubte Nebenänderung,
stale Vorversion/Body/Relationen, Reviewunabhängigkeit, Hashmanipulation,
Mehrzielkonkurrenz, atomaren Abbruch und idempotente Wiederholung ab.

Der Nachweis umfasst alle geänderten Ziele: vollständiger D1-Felderhalt,
öffentliche API, Roh-HTML und tatsächlich hydrierten Artikel samt Head und
JSON-LD. Vorhandene unveränderte Layout-/Routennachweise werden weiterverwendet.
Sichtbarer Text, H1, Quellen, Datumswerte und Relationen bleiben gleich;
die neuen Suchtexte müssen auf allen Auslieferungswegen exakt ankommen.
Der Abschluss prüft die gesamte Zielmenge, keine Stichprobe als Ersatz.

Eine fehlgeschlagene oder unvollständige Prüfung wird als solche dokumentiert.
Nach bestandenem unabhängigen unverändertem PASS folgt keine weitere
Reviewrunde. Der Fortschritt und genau ein knapper Deploy-Log je tatsächlicher
Produktionsänderung schließen den Auftrag ab.
