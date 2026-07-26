# Framework 00: Globale redaktionelle Regeln

Diese Regeln gelten für alle sichtbaren Stage-2- und Stage-3-Artikel. Die
stagespezifische Struktur steht ausschließlich im gewählten Artikelframework.

## Fachliche Grenzen

- Keine Diagnose, Therapie, Behandlung oder individuelle Dosierungsanweisung.
- Keine Produkt-/Markenrangliste, Werbung oder unbelegte medizinische Aussage.
- Beobachtung, Assoziation, Mechanismus und Kausalität klar unterscheiden.
- Population, Menge, Dauer, Endpunkt und Unsicherheit nennen, wenn sie die
  Aussage begrenzen.
- Sicherheitsinformationen, Interaktionen, vulnerable Gruppen und rechtliche
  Einordnung weder verkürzen noch dramatisieren.
- Nur Claims, Zahlen, Einheiten und Quellen aus dem lock-/gategebundenen
  Faktenpaket verwenden. Fehlende Fakten nicht erfinden.

## Statische Rechtsgrenze

Diese Grenze gilt in jedem Standardlauf ohne zusätzliche Legal-Welle. Sobald
Artikelwortlaut, Produktkontext, Affiliate-Verknüpfung oder CTA eine
kommerzielle nährwert- oder gesundheitsbezogene Aussage bilden kann, muss sie
mit der [Verordnung (EG) Nr. 1924/2006](https://eur-lex.europa.eu/legal-content/DE/TXT/?uri=CELEX:32006R1924),
dem [EU-Register](https://food.ec.europa.eu/food-safety/labelling-and-nutrition/nutrition-and-health-claims/eu-register-health-claims_en)
und den konkreten Verwendungsbedingungen vereinbar sein. Eine Studien- oder
Mechanismusdarstellung wird nie als zugelassener Produktclaim ausgegeben.

Unabhängig davon sind irreführende Erfolgs-, Sicherheits- oder
Produkteigenschaftsangaben sowie Aussagen zur Verhütung, Behandlung oder
Heilung von Krankheiten verboten; maßgebliche statische Grenzen sind
insbesondere [§ 3 HWG](https://www.gesetze-im-internet.de/heilmwerbg/__3.html),
[§ 11 LFGB](https://www.gesetze-im-internet.de/lfgb/__11.html) und
[§ 5 UWG](https://www.gesetze-im-internet.de/uwg_2004/__5.html). Ist der
kommerzielle Zweck einer Affiliate-Verknüpfung nicht unmittelbar erkennbar,
muss er zusätzlich nach
[§ 5a Abs. 4 UWG](https://www.gesetze-im-internet.de/uwg_2004/__5a.html)
kenntlich sein. Kann der
Publication-Reviewer ein konkretes Rechtsrisiko nicht anhand dieser festen
Grenzen entscheiden, blockiert nur dieser Artikel für einen separat vom Owner
beauftragten Legal-Review. Ein Rechtsreview ist weder Standardrolle noch
pauschales Stoffgate.

## Leser und Sprache

- Deutsch-first, valides UTF-8, echte Umlaute und `µ`.
- Kernaussage zuerst; kurze bis mittlere Sätze; Fachbegriffe beim ersten Einsatz
  in Alltagssprache erklären.
- Zielniveau: Ein Zehntklässler versteht den Gedankengang und kann daraus ein
  sachlich korrektes Referat vorbereiten.
- Präzise, ruhig und konkret schreiben. Keine System-, Agenten-, Workflow- oder
  Prompt-Sprache im sichtbaren Text.
- Keine Wiederholungen für Länge oder Keyword-Dichte. Tabelle, FAQ und Liste nur
  bei echter Verständnis- oder Auffindbarkeitsfunktion.

## Quellen, Assets und Darstellung

- Sichtbare Quellenlabels/-URLs entsprechen exakt der freigegebenen Liste. Das
  vom Packager erzeugte Label lautet bytegleich
  `<Autor/Institution> (<YYYY|o. J.>). <Titel>. <Journal/Publisher>.[ DOI:
  <doi>.][ PMID: <pmid>.]`; fehlende DOI/PMID-Teile entfallen, ein fehlendes
  Jahr wird nicht erfunden. Die Originallocator-URL bleibt unverändert.
  Supporting-Quellen werden integriert und sichtbar verlinkt. Verwendete
  Source-IDs, expandierte Quellenrelationen und sichtbare Quellenliste müssen
  mengen- und reihenfolgegleich zum Facts-Paket bleiben.
- Interne Links stammen ausschließlich aus dem artikelbezogenen
  `selected_link_slice`, den der Planner aus dem gebundenen
  `site_link_inventory.v2` gewählt hat,
  beantworten eine Leserfrage und werden nicht allein für Linkdichte gesetzt.
- Keine langen urheberrechtlich geschützten Auszüge.
- Keine leeren Überschriften, Grafikbriefings, Platzhalter oder sichtbaren
  Metadaten-/Statusblöcke.
- Grafikstandard ist `none`. Eine geplante Grafik ist nur mit tatsächlichem
  Asset, bestandener Faktenprüfung und vollständigem `article_asset.v2`
  zulässig.
- Der Compiler erzeugt den einzigen frozen sichtbaren Payload. Writer und
  Executor führen keine alternative Assembly durch.

## SEO

Beantworte `primary_intent`, `reader_question` und `reader_promise` vollständig
und natürlich. `primary_topic_phrase`, Synonyme, `secondary_questions` und
`internal_link_targets` dienen dem Leser. Keyword-Stuffing,
Suchmaschinenprosa und redundante SEO-Fassungen sind verboten. Planner und
Writer verantworten People-first Intent; technischer Title und Meta-Description
werden erst aus dem finalen Artikel abgeleitet. Canonical, strukturierte Daten,
Sitemap, Indexierbarkeit und Social Cards sind Runtime-Verantwortung.
Roh-HTML/SSR-Prerender, `robots` und Sitemap sind siteweite Delivery-
Eigenschaften: Ein Defizit dort erzeugt einen Technik-/SEO-Delivery-Status,
niemals eine Writerrevision.
