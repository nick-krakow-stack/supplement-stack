# Umsetzung: Copy-Register, Punkte 09–66

Stand: 7. September 2026 · Status: COMPLETE — COPY-09 BIS COPY-66 LIVE

Auftrag: Den gesamten Rest von Abschnitt 15 des UX-/SEO-Audits umsetzen,
prüfen und produktiv veröffentlichen. Die Nummerierung zählt alle Tabellenzeilen
ab Abschnitt 15 durch; COPY-01–08 bleiben bereits abgeschlossen.

## Verbindlicher Umfang

| Erledigt | ID | Ausgangstext | Zieltext beziehungsweise Regel |
|---|---|---|---|
| [x] | COPY-09 | „Kostenlos & ohne Konto nutzbar“ | „Demo ohne Konto ausprobieren“. |
| [x] | COPY-10 | „vollständig ausprobieren“, „Alles nutzbar“, „ohne Risiko“ | „Teste Suche, Stack-Aufbau und Kostenübersicht. Speichern, E-Mail und eigene Produkte gibt es nach kostenloser Anmeldung.“ |
| [x] | COPY-11 | „neueste Erkenntnisse“ | „Wissensartikel mit Quellen und Prüfdatum“, solange Aktualität nicht anderweitig garantiert wird. |
| [x] | COPY-12 | „geprüfte Inhaltsstoffe“ | Nur bei belegtem Prüfvertrag; sonst „erfasste Inhaltsstoffe“. |
| [x] | COPY-13 | „Optional: Alter und bevorzugte Quellenpraeferenz koennen spaeter geaendert werden.“ | „Optional – diese Angaben kannst du später im Profil ergänzen.“ |
| [x] | COPY-14 | „Leitlinienquelle“ | Falls wirksam: „Welche Quellen möchtest du zuerst sehen?“ Sonst Feld entfernen. |
| [x] | COPY-15 | „Influencer“ als Quellenoption | Einheitlich „Creator-Empfehlungen“; nicht als Leitlinie bezeichnen. |
| [x] | COPY-16 | langer Consent mit „DSGVO Art. 9 erforderlich“ | „Ich willige ein, dass Supplement Stack meine Stack-, Produkt- und Einnahmedaten speichert, damit ich die App nutzen kann. Daraus können Rückschlüsse auf meine Gesundheit möglich sein. Mehr dazu im Datenschutz.“ Details aufklappbar. |
| [x] | COPY-17 | „Rolle: user/creator“ | Ausblenden oder „Kontotyp: Standardkonto/Creator“. |
| [x] | COPY-18 | „Meine Supplement Stacks“ | „Meine Stacks“. |
| [x] | COPY-19 | „1 Produkte“ | Zentrale Pluralisierung: „1 Produkt“, „2 Produkte“. |
| [x] | COPY-20 | Screenreaderlabels mit `waehlen` | Echtes UTF-8: „wählen“. |
| [x] | COPY-21 | Sortierung „Eigene“ | „Manuell“. |
| [x] | COPY-22 | Kategorien „Keine“ / „Eigene“ | „Ohne Gruppen“ / „Meine Gruppen“. |
| [x] | COPY-23 | amber „Creator-Stack von …“ | Neutrale Infobox: „Ursprünglich empfohlen von {Name}. Du kannst diesen Stack selbst anpassen.“ |
| [x] | COPY-24 | unerklärte Auswahl | „Nur ausgewählte Produkte zählen in die Kostenübersicht.“ |
| [x] | COPY-25 | doppeltes „Wirkstoff suchen / Nach Wirkstoff suchen“ | Einmal: „Welchen Wirkstoff möchtest du hinzufügen?“ |
| [x] | COPY-26 | „Beginnen Sie zu tippen …“ | „Tippe einen Wirkstoff ein, zum Beispiel Magnesium oder Vitamin D.“ |
| [x] | COPY-27 | „z.B.“ | Einheitlich „z. B.“. |
| [x] | COPY-28 | „FORM“ / unklare „Form“ | „Produktform“ beziehungsweise „Gewählte Form“. |
| [x] | COPY-29 | „DGE Empfehlung“ | „DGE-Referenzwert für die gesamte tägliche Zufuhr“. |
| [x] | COPY-30 | „Studien-Referenz“ | „In dieser Studie untersuchte Menge“ plus Population, Dauer, Form und Grenze. |
| [x] | COPY-31 | „Empfehlung übernehmen“ / „Referenz übernehmen“ | „Als geplante Menge eintragen“, erst nach sichtbarer Einordnung. |
| [x] | COPY-32 | „Rund um die DGE Empfehlung“ mit Warnsymbol | Neutral: „Vergleich mit dem DGE-Referenzwert: Deine eingetragene Menge entspricht …“. |
| [x] | COPY-33 | Duplikataktionen „Wirkstoffmengen bearbeiten / Produkt ändern / So lassen / Trotzdem …“ | „Einnahme bearbeiten“, „Produkt wechseln“, „Nichts ändern“, „Als zusätzliches Produkt hinzufügen“ – jeweils mit einem Folgensatz. |
| [x] | COPY-34 | „Fallback: manuelle Einnahmemenge“ | „Eigene Einnahmeangabe (optional)“. |
| [x] | COPY-35 | „Timing“ | „Zeitpunkt“. |
| [x] | COPY-36 | „Einnahmeintervall in Tagen“ | „Wie oft nimmst du es?“ mit Presets und optionalem eigenem Abstand. |
| [x] | COPY-37 | „Portionen pro Einnahmetag müssen größer als 0 sein.“ | „Trage mindestens 0,1 Portionen pro Einnahme ein.“ |
| [x] | COPY-38 | „Familienprofil“ | Nur bei echter Auswahl: „Für wen ist dieser Stack?“ mit erklärter Folge. |
| [x] | COPY-39 | „Kategorie X wirklich löschen?“ | „Kategorie ‚X‘ löschen? Die Produkte bleiben erhalten und werden nach ‚Ohne Gruppe‘ verschoben.“ |
| [x] | COPY-40 | „Stack wirklich löschen?“ | „Der Stack und seine Zusammenstellung werden gelöscht. Eigene Produkte bleiben unter ‚Eigene Produkte‘ erhalten.“ |
| [x] | COPY-41 | „Passend“ ohne Begründung | „Vorgeschlagene Option“ plus sichtbarer Grund oder wertungsfrei „Ausgewählt“. |
| [x] | COPY-42 | „unbekannt“ / Strich bei Reichweite | „Nicht berechenbar – Produktangaben fehlen.“ |
| [x] | COPY-43 | `/Mo`, `EUR/Monat`, „pro Monat“ gemischt | Einheitlich „… € pro Monat“. |
| [x] | COPY-44 | Warnmodal „Warnung / Kurzbeschreibung / Details“ | Nach Schweregrad „Gut zu wissen“, „Wichtig“ oder „Bitte beachten“; „Kurz erklärt“ statt „Kurzbeschreibung“. |
| [x] | COPY-45 | „20-30min Abstand zu Kaffee/Tee“ | „20–30 Minuten Abstand zu Kaffee oder Tee“. |
| [x] | COPY-46 | „Stack mailen“, „Stack-Mail“, „Stack per E-Mail senden“ | Einheitlich „Einnahmeplan per E-Mail senden“. |
| [x] | COPY-47 | Versandbutton ohne Ziel | „An meine Account-Adresse senden“; Zieladresse im Dialog sichtbar. |
| [x] | COPY-48 | „Plan drucken/PDF“ | „Drucken oder als PDF speichern“. |
| [x] | COPY-49 | Creator „Schreibzugriff“ | „Du kannst die Empfehlungen ansehen, aber nicht ändern. Zum Erstellen oder Beenden brauchst du Bearbeitungsrechte für …“. |
| [x] | COPY-50 | „Wird gesendet …“ bei Moderation | „Wird zur Prüfung eingereicht …“. |
| [x] | COPY-51 | „Freigabe und Shop-Link“ | Je Produkt konkret: „Shop-Link fehlt“ / „Produkt ist noch nicht freigegeben“. |
| [x] | COPY-52 | „1 aktuell freigegebene Links“, „1-mal angesehen/gespeichert“ | „1 freigegebener Link“, „1 Übernahme“; Mehrzahl zentral bilden. Besuche gemäß tatsächlicher Messung als „erfasste eindeutige Besuche“ mit Zustimmungshinweis bezeichnen, nicht als rohe Ansichten. |
| [x] | COPY-53 | „über aktive Links gespeichert“ | „in einen Stack übernommen“. |
| [x] | COPY-54 | roher Timingwert `before_breakfast` | „Vor dem Frühstück“; alle Werte zentral übersetzen, unbekannt = „Keine Angabe“. |
| [x] | COPY-55 | „Du kannst sie danach selbst senden“ | „Füge die kopierte Nachricht anschließend in deinen Messenger oder deine E-Mail ein.“ |
| [x] | COPY-56 | „Menge laut Empfehlung“ + „Angabe des Creators“ | Bereich „So nutzt {Name} das Produkt“ mit „Menge“, „Eigene Angabe“, „Wie oft“, „Zeitpunkt“. |
| [x] | COPY-57 | „Jetzt bestätigen“ | Dynamisch: „Stack mit 3 Produkten anlegen“, „Produkt hinzufügen“ oder „Produkt ersetzen“. |
| [x] | COPY-58 | „Bei der Empfehlung bleiben“ | „Empfehlung weiter ansehen“. |
| [x] | COPY-59 | „Das hat gerade nicht geklappt“ | Schritt nennen: „Die Empfehlung konnte nicht geprüft/gespeichert werden.“ |
| [x] | COPY-60 | H1 „Co. - einfach erklärt“ | „Alles über Vitamine, Mineralstoffe & Co. – einfach erklärt“. |
| [x] | COPY-61 | Suche „Nährstoff suchen - z. B. … ...“ | „Nährstoff suchen – z. B. Vitamin D, Magnesium oder Eisen …“. |
| [x] | COPY-62 | „Bald“ | Kein unbelegter Bearbeitungsstatus: Karten ohne Artikel bleiben nichtinteraktiv und ohne „Bald“/„Artikel in Vorbereitung“. |
| [x] | COPY-63 | „1 Einträge“ | „1 Eintrag“. |
| [x] | COPY-64 | „Pflanzlicher Stoffstoff“, „Bedeutet als Cofaktor“, „Schlaf- und Rhythmusrhythmus“, „Fokuslage“, „Wirkungsdebatten“ | Geprüfte Kurztexte aus der zentralen Quelle; keine lokalen Einzelflicken und gemäß ausdrücklicher Owner-Korrektur keine Systemstatusmeldung als Ersatztext. |
| [x] | COPY-65 | Artikel „Zurück“ | „Zur Wissensübersicht“. |
| [x] | COPY-66 | Rechtsseiten ohne Datum | „Stand: {Datum}“ aus der kanonischen Dokumentversion. |

## Maßgebliche Grenzen

- COPY-64: Die explizite Owner-Korrektur gegen Systemstatusmeldungen hat Vorrang
  vor dem veralteten Audit-Fallback. „Kurztext wird geprüft“ wird nicht wieder
  eingeführt. Geprüfte zentrale Texte bleiben die einzige Quelle; fehlende
  belastbare Texte werden nicht erfunden.
- Keine Artikel-/Rechtsdaten frei umschreiben, keine Produkt-Affiliate-Hinweise,
  keine erfundenen Studien-/Dosis-/Personenwerte oder zweite Pflegequelle.
- Bedeutungen, Quellen, Einwilligungseffekt und persistente Guards erhalten.
  Bedingte Registerpunkte werden anhand der tatsächlichen Funktion umgesetzt;
  Hinweise dürfen keine nicht vorhandene Wirkung oder Auswahl suggerieren.

Bereits entfernte Funktionen (COPY-22/38/39) sind anhand der aktuellen
Oberfläche ausdrücklich als nicht vorhanden bestätigt; Gruppen-/Familienfelder
und erfundene Verschiebungsfolgen werden nicht wieder eingeführt. COPY-40 nennt
den tatsächlichen Papierkorb mit sieben Tagen Wiederherstellung und den Erhalt
eigener Produkte. COPY-52/62/64 folgen den oben präzisierten Daten-/Ownerregeln.
Die zentrale Wissensübersicht enthält 92 Einträge mit 79 vorhandenen Kurztexten
und 13 leeren Werten; leere Angaben bleiben ohne erfundene Ersatztexte.

## Zusammenarbeit und Abschluss

- [x] Jede Zeile anhand aktueller Fundstellen implementiert oder bereits passend bestätigt; zeilenbezogener Nachweis vorhanden.
- [x] Paket A: Einstieg/Konto/Creator/Wissen/Rechtsstand (09–17, 49–66) mit zugehörigen Tests.
- [x] Paket B: Stack/Suche/Produkt/Einnahme/Anzeige/Druck/Versand (18–48) mit zugehörigen Tests.
- [x] Paketübergreifende Copy-Normalisierung und serverseitige Anzeige-/E-Mail-Texte abgeglichen; keine konkurrierenden Formatierungshelfer.
- [x] Unabhängiges Nutzer-/Creator-Feedback eingeholt; nötige Korrekturen an Autoren zurückgegeben und diffbegrenzt nachgeprüft.
- [x] Proportionale Tests, UTF-8, Build und genau ein unabhängiger technischer Gesamtcheck bestanden.
- [x] Commit/PR/Merge, Deployment, öffentliche Desktop-/Mobilprüfung und angemeldete/Fehlerzustände proportional verifiziert.
- [x] Alle 58 Zeilen im Audit/Umsetzungsdokument abgeschlossen; jede der beiden Produktionsänderungen einmal im Deploy-Log dokumentiert.

## Nachweise

Zentrale Belege für diesen Lauf: `.agent-memory/copy-rest-20260907/`.
Kein grüner Abschluss ohne konkrete Zuordnung jeder der 58 Zeilen.

Implementierung: PR #28, Commit `7e45632`, Merge `743afe9`.
PR-CI `34117854783`: 500/500 Tests in 46 Dateien, Lint, Build,
Functions-Typecheck und bestehende Skript-/Migrationsguards PASS.
Gezielte Pakete: A 109, B 78 und Root 4 Fälle PASS.
Unabhängiger Gesamtbeleg `review.json`: 58/58 Kriterien PASS, 46 Pfadhashes,
keine notwendige Nachbesserung und keine weitere unveränderte Reviewrunde.

Release-Hinweis: Main-CI `34118242770`, erster Versuch, hatte zwei
`BROWSER_LAUNCH_FAILED`-Infrastrukturfehler im unveränderten Magazin-Browsertest
(498/500 Fälle bestanden). PR-CI und parallele Deployment-Tests waren 500/500
PASS. Nur der betroffene Main-CI-Job wird deshalb unverändert wiederholt;
keine Tests abgeschwächt, keine zusätzliche Runtime-Änderung.

Der unveränderte Main-CI-Retry ist mit 500/500 Tests bestanden. Der öffentliche
Release-Readback deckte zusätzlich einen bestehenden P1-Auslieferungsfehler auf:
Der seit PR #26 vorhandene Asset-Passthrough verwandelte gültige 304-Antworten
in 404. Für den zuverlässigen Releaseabschluss wird ausschließlich dieser
304-Pfad mit gezieltem Regressionstest korrigiert und unabhängig geprüft.

Korrektur: PR #29, `d47d035` / Merge `a4f6f96`, ausschließlich Middleware
und Regressionstest. 47/47 gezielte Fälle, Functions-Typecheck und enger
unabhängiger Delta-Review PASS; PR-CI `34119520505` mit 508/508 Tests PASS.

## Live-Abschluss

- Copy-Deployment `34118242767`, Korrekturdeployment `34119841030` und finale
  Main-CI `34119841079` PASS; keine Datenmigrationen notwendig.
- 13 öffentlich referenzierte UI-Pakete mit Zieltexten und unverändert zentraler
  Wissensindex geprüft. 58/58 Auditzeilen mit tatsächlichen Fundstellen belegt.
- Landing bei 1280 px, Demo, Produktsuche/Einordnung, Druck-/PDF-Auswahl,
  Einwilligungsdetails und Wissen bei 390 px live geprüft, kein horizontaler
  Überlauf. Das Planfeld bleibt zuerst leer und wird nur ausdrücklich gefüllt;
  der Testentwurf wurde ohne Speichern geschlossen.
- Wissenssuche zeigt den neuen Suchtext, genau einen Treffer für Sägepalme und
  keine Systemstatus-/Vorbereitungsplatzhalter. Die Seite lädt nach der
  Auslieferungskorrektur wieder erfolgreich. Testtab geschlossen; keine Konten
  angelegt, Daten geändert oder E-Mails versendet.
- Angemeldete Creator-/Profil-/Import- und Fehlerzustände wurden isoliert
  getestet und über die tatsächlich veröffentlichten UI-Pakete abgeglichen.
  Kein vorgetäuschter Live-Account-/E-Mail-Test.
- Cache-Readback: Hauptdomain liefert für bedingte GET/HEAD korrekt 304,
  Pages-Direktdomain liefert eine sichere frische 200-Antwort mit identischem
  ETag und bytegleichen Assetdaten; fehlende Dateien bleiben auf beiden 404.
  Der konservative 200-Fallback ist höchstens eine spätere Cache-Optimierung,
  kein offener Funktionsfehler und kein Anlass für einen weiteren Release.

Belege: `package-a.json` (27 IDs), `package-b.json` (31 IDs),
`package-root.json`, `review.json`, `review-asset-revalidation.json`,
`live-readback.json` und `live-browser-check.json` im oben genannten Belegordner.
