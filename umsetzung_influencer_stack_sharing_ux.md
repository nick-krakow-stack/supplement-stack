# Umsetzung: Creator-Sharing aus User- und Creator-Sicht

Stand: 2026-08-07  
Status: `ABGESCHLOSSEN — PRODUKTIV VERÖFFENTLICHT UND ABGENOMMEN`  
Grundlage: `konzept_influencer_stack_sharing.md`,
`bauplan_influencer_stack_sharing.md`, produktiver MVP und die abgestimmte
User-/Creator-Runde vom 2026-08-06.

Dieses Dokument ist die verbindliche, fortlaufend aktualisierte Checkliste für
den aktiven UX-Folgelauf.

## 1. Statusregeln

- `[ ]` offen
- `[~]` in Arbeit
- `[x]` umgesetzt und mit dem angegebenen Gate bestätigt
- `[!]` blockiert; Grund und benötigte Entscheidung direkt am Punkt ergänzen
- `[–]` bewusst ausgeschlossen; Begründung darf nicht entfernt werden

Es darf immer nur eine materielle Aufgabe je Agent `[~]` sein. Ein Punkt wird
erst `[x]`, wenn Implementierung, zugehörige Tests und die vorgesehene
User-/Creator-Abnahme bestanden sind. Reine Code-Fertigstellung reicht nicht.

## 2. Fester Scope und Produktentscheidungen

- [x] Der bestehende Creator-Sharing-MVP bleibt die technische Basis; keine
  zweite Produkt-, Wirkstoff-, Shop-, Share-, Klick-, Stack- oder
  Einheitenwahrheit anlegen.
- [x] User-Sicht und Creator-Sicht vollständig optimieren. Der Admin-Bereich ist
  in diesem Lauf ausdrücklich nicht enthalten.
- [x] Creator-Menü als Sackgasse beseitigen.
- [x] Exakten Rückweg durch Login, Registrierung und E-Mail-Bestätigung erhalten.
- [x] Ähnliche Produkte neutral und leicht verständlich erklären; nur echte
  technische Fehler rot darstellen.
- [x] Folgen jeder Auswahl vor dem Speichern konkret nennen.
- [x] Technische Begriffe aus sichtbaren Nutzertexten entfernen.
- [x] Orientierung durch Creator, Datum, Status, Ziel-Stack und klare Rückwege
  herstellen.
- [x] Fehlende Werte und Einheiten niemals erfinden.
- [x] Affiliate-Kennzeichnung bleibt ausschließlich der bestehende globale
  Footer-Hinweis. `[–]` Kein Badge und kein zusätzlicher Text an Produkt,
  Kaufbutton, Stack, Import oder Creator-Empfehlung. Das ist eine dauerhafte
  Produktentscheidung und darf nicht erneut als UX-Fehler gemeldet werden.
- [x] Keine individuelle Dosierungsanweisung und kein Rechner.
- [x] Nach erfolgreichem Gesamtgate committen, veröffentlichen, deployen und die
  produktive User-/Creator-Strecke auf Desktop und Mobilgerät prüfen.

## 3. Verbindlicher Orchestrierungs- und Feedbackvertrag

### 3.1 Rollen

- **Orchestrator:** hält diese Datei und die Live-Checkliste aktuell, verteilt nur
  disjunkte Scopes, schützt fremde Änderungen, bündelt Feedback und entscheidet
  anhand der Gates über den nächsten Schritt.
- **Programmierer-Agent:** setzt genau sein Arbeitspaket um, ergänzt gezielte
  Tests und nennt geänderte Dateien, bestandene Prüfungen und offene Risiken.
- **Creator-Prüfer:** nutzt die Funktion gedanklich und, sobald ausführbar, real
  als freigeschalteter Creator. Er bewertet Auffindbarkeit, Sprache,
  Erwartungssicherheit, Vorschau, Status und Rückwege.
- **User-Prüfer:** nutzt die Funktion als normaler Nutzer, der über einen Creator-
  Link kommt. Er bewertet Vorschau, Anmeldung, Zielwahl, ähnliche Produkte,
  Folgen, Ergebnis und Wiederherstellung.
- **Technischer Reviewer:** prüft am Ende genau einmal die zusammengeführte
  Runtime-, Auth-, Snapshot- und Write-Guard-Änderung gemäß
  `codex-files/agents/AGENT_technical_change_reviewer.md`.

### 3.2 Pflichtschleife nach jedem Programmierer-Arbeitspaket

Für jedes Paket `P1` bis `P6` gilt ohne Ausnahme:

1. [x] Programmierer setzt den abgegrenzten Scope um und meldet ihn als
   prüfbereit; noch kein endgültiges `[x]`.
2. [x] Der im Paket genannte User- oder Creator-Prüfer testet den fertigen Stand
   aus seiner Rolle. Bei gemeinsam genutzten Flächen prüfen beide Rollen.
3. [x] Prüfer nennt getrennt: klar/einfach, verwirrend, fehlend und blockierend.
4. [x] Bei Beanstandungen sendet der Orchestrator das konkrete, gebündelte
   Feedback an denselben Programmierer-Agenten zurück.
5. [x] Programmierer passt den Scope einschließlich Tests an und meldet den Diff
   erneut prüfbereit.
6. [x] Derselbe Rollenprüfer bestätigt `PASS` oder nennt verbleibende konkrete
   Abweichungen. Nach unverändertem `PASS` endet die Schleife; keine weitere
   Geschmacksrunde.
7. [x] Orchestrator markiert das Paket erst danach `[x]` und hält Beleg sowie
   gegebenenfalls dokumentierte, nicht blockierende P2-Punkte fest.

Ein Rollenprüfer verändert keinen Code. Ein Programmierer erklärt Feedback nicht
eigenmächtig für erledigt. Bei widersprüchlichem User-/Creator-Feedback gilt die
abgestimmte Produktentscheidung aus Abschnitt 2; ein echter, dort nicht lösbarer
Zielkonflikt wird `[!]` und dem Owner vorgelegt.

## 4. Arbeitspakete

### P0 — Preflight und Runtime-Abgleich

Verantwortlich: Orchestrator, read-only; bei Bedarf ein abgegrenzter Analyse-Agent.

- [x] Aktuellen Branch, Arbeitsbaum und produktiven Ausgangsstand erfassen.
- [x] Bestehende Creator-Routen, UI-Komponenten, Auth-Rückwege, Snapshot-Version,
  Import-/Write-Pfade und Tests inventarisieren.
- [x] Produktivschema und Migration `0099` read-only gegen die benötigten Felder
  prüfen; vorhandene kanonische Tabellen weiterverwenden.
- [x] Für jeden folgenden Punkt festhalten: reine UI-Änderung, API-Erweiterung,
  Snapshot-Versionierung oder echte Migration. Eine Migration nur anlegen, wenn
  JSON-/Runtime-Kompatibilität nicht ausreicht.
- [x] Bestehende uncommittete Änderungen fremder Herkunft abgrenzen und schützen.
- [x] Verbindliche Dateigrenzen für parallel laufende Programmierer festlegen;
  überlappende Dateien werden nacheinander bearbeitet.

Gate P0:

- [x] Kein Parallelmodell und keine doppelte Pflege geplant.
- [x] Persistente Writes, Versions-/Hash-Guards und Rückwärtskompatibilität sind
  pro Arbeitspaket benannt.
- [x] Orchestrator hat die ausführbare Verteilung für `P1` bis `P6` in der
  Live-Checkliste eingetragen.

### P1 — Creator-Zugang und Orientierung

Primärer Prüfer: Creator-Prüfer.  
Voraussichtlicher Scope: Navigation, geschützte Creator-Route,
`CreatorSharingPage`, Creator-Berechtigungsabfrage und gezielte Frontendtests.

- [x] „Für Creator“ erst nach positiv geladener aktiver Creator-/Marken-
  Mitgliedschaft anzeigen; kein kurzes Aufblitzen für normale Nutzer.
- [x] Direkter Aufruf ohne Berechtigung zeigt keine Sackgasse, sondern:
  „Creator-Bereich nicht freigeschaltet“, eine einfache Erklärung und
  „Zu meinen Stacks“.
- [x] Keine nicht vorhandenen Support- oder Onboarding-Wege erfinden.
- [x] Creator-Start bietet drei klare Einstiege:
  „Ganzen Stack teilen“, „Ein Produkt empfehlen“, „Meine Empfehlungen“.
- [x] Formulare verwenden verständliche Bezeichnungen:
  „Wer teilt die Empfehlung?“, „Welchen Stack möchtest du teilen?“,
  „Welches Produkt möchtest du empfehlen?“, „Name der Empfehlung“ und
  „Dein Hinweis (optional)“.
- [x] Interne Creator-Vorschau verwendet dieselbe Anzeige-Komponente wie die
  öffentliche Empfehlung.
- [x] Stand-Hinweis erklärt, dass spätere Stack-Änderungen den Link nicht ändern.
- [x] Absenden heißt „Zur Prüfung senden“; Erfolg erklärt Prüfung und späteren
  Fundort des Links unter „Meine Empfehlungen“.

Gate P1:

- [x] Berechtigter Creator findet alle drei Aufgaben ohne Umweg.
- [x] Normaler Nutzer landet weder im Creator-Menü noch in einer Sackgasse.
- [x] Creator-Prüfer hat die Pflichtschleife aus Abschnitt 3.2 mit `PASS`
  abgeschlossen.

### P2 — Creator-Portfolio, Status und Überarbeitung

Primärer Prüfer: Creator-Prüfer.  
Voraussichtlicher Scope: eigene Share-API, Creator-Portfolio, private Vorschau,
Statusaktionen und gezielte API-/Frontendtests.

- [x] „Meine Empfehlungen“ listet nur eigene Empfehlungen mit verständlichen
  Statusbezeichnungen: „Wird geprüft“, „Freigegeben“, „Nicht freigegeben“,
  „Von dir beendet“, „Abgelaufen“.
- [x] Aufrufe und tatsächliche Speicherungen werden verständlich angezeigt;
  interne Vorschau zählt nicht als öffentlicher Aufruf.
- [x] Private Vorschau ist in jedem Status verfügbar.
- [x] Freigegebene Empfehlung bietet „Link kopieren“ und
  „Öffentliche Seite öffnen“.
- [x] Nicht freigegebene Empfehlung kann vorausgefüllt überarbeitet und erneut
  gesendet werden. Dabei entsteht ein neuer unveränderlicher Prüfstand mit neuem
  Link; der alte Link ändert sich nie still.
- [x] Beendete oder abgelaufene Empfehlung kann aus dem aktuellen Stand neu
  erstellt werden.
- [x] Beenden, Neu-Erstellen und erneutes Senden besitzen Rollen-, Eigentümer-,
  Status- und Versions-Guards.

Gate P2:

- [x] Creator versteht jeden Status und weiß jeweils, was als Nächstes möglich
  ist.
- [x] Fremde oder normale Nutzer können Creator-Daten und Aktionen nicht nutzen.
- [x] Creator-Prüfer hat die Pflichtschleife aus Abschnitt 3.2 mit `PASS`
  abgeschlossen.

### P3 — Öffentliche Empfehlung und verständliche Darstellung

Primäre Prüfer: User-Prüfer und Creator-Prüfer.  
Voraussichtlicher Scope: gemeinsame Empfehlungs-Komponente, öffentliche Share-
Seite, Snapshot-Parser/-Version und Formatierer.

- [x] Kopf zeigt „Empfohlen von [Name]“, Titel und „Stand: [Datum]“.
- [x] Direkt darunter steht, dass die Empfehlung diesen Stand zeigt und spätere
  Änderungen des Creators nicht enthalten sind.
- [x] Nutzung heißt „So nutzt [Creator] das Produkt:“ und wird durch
  „Das ist die persönliche Nutzung des Creators und keine Dosierungsanweisung
  für dich.“ eingeordnet.
- [x] Neue Snapshot-Version bindet die tatsächlich verwendete Produkteinheit.
- [x] Alte Snapshots ohne Einheit bleiben lesbar und zeigen ehrlich:
  „Menge laut Empfehlung: [Wert] (Einheit nicht angegeben)“.
- [x] Vorhandene freie Einnahmetexte werden unverändert und verständlich gezeigt;
  fehlende Einheiten oder Werte werden nicht ergänzt.
- [x] Datum, Einheit und Einnahmeintervall werden zentral und auf Deutsch
  formatiert.
- [x] Kein zusätzlicher Affiliate-Hinweis in der Empfehlung; ausschließlich der
  globale Footer-Hinweis bleibt sichtbar. Kein Badge und keine Zuordnung am
  einzelnen Produkt.
- [x] Creator-interne und öffentliche Vorschau verwenden dieselben sichtbaren
  Daten und dieselbe Kernkomponente.

Gate P3:

- [x] Alte und neue Snapshots rendern ohne erfundene Daten.
- [x] User und Creator sehen in der Vorschau denselben freigegebenen Inhalt.
- [x] Beide Rollenprüfer haben die Pflichtschleife aus Abschnitt 3.2 mit `PASS`
  abgeschlossen.

### P4 — Sicherer Login-/Registrierungs-Rückweg

Primärer Prüfer: User-Prüfer.  
Voraussichtlicher Scope: zentraler `returnTo`-Vertrag, geschützte Route, Login,
Registrierung, E-Mail-Bestätigung/-Neuversand und kurzlebiger Browser-Entwurf.

- [x] Exakter interner Pfad inklusive Share-Token, Query und Fragment bleibt über
  geschützte Route, Login, Wechsel zu Registrierung, Registrierung,
  E-Mail-Bestätigung und Bestätigungs-Neuversand erhalten.
- [x] Eine zentrale Validierung erlaubt ausschließlich sichere interne Ziele und
  blockiert externe URLs, `//`, Backslashes sowie kodierte Umgehungsversuche.
- [x] Bestätigungslinks übernehmen nur validierte und korrekt HTML-escaped Ziele.
- [x] Gerätewechsel öffnet mindestens wieder exakt die ursprüngliche Empfehlung.
- [x] Derselbe Browser darf einen kurzlebigen, an den Share-Token gebundenen
  Entwurf für Formwerte und Zielauswahl wiederherstellen.
- [x] Auf einem anderen Gerät wird die Vorprüfung neu aufgebaut; eine frühere
  Auswahl bei ähnlichen Produkten wird nie blind übernommen.
- [x] Vor der Anmeldung steht:
  „Möchtest du die Empfehlung in deinen Stacks speichern?“ und
  „Vor der Anmeldung wird nichts gespeichert.“ mit den Aktionen
  „Anmelden und weitermachen“ und „Konto erstellen“.

Gate P4:

- [x] Alle Auth-Wege kehren zur exakten Empfehlung zurück.
- [x] Open-Redirect- und Encoding-Testfälle sind blockiert.
- [x] User-Prüfer hat die Pflichtschleife aus Abschnitt 3.2 mit `PASS`
  abgeschlossen.

### P5 — Zielwahl, Vorprüfung und ähnliche Produkte

Primärer Prüfer: User-Prüfer.  
Voraussichtlicher Scope: read-only Import-Vorprüfung, Importseite,
Ähnlichkeitsvergleich, Zielwahl und atomare Einzel-/Stack-Writes.

- [x] Vor jedem persistenten Write läuft eine read-only Vorprüfung; der finale
  Write prüft Share, Ziel, Status und Version erneut.
- [x] Ein ganzer Creator-Stack wird immer als neuer, umbenennbarer Stack angelegt;
  bestehende Stacks bleiben unverändert.
- [x] Ein bereits verwendeter Stackname ist kein Fehler. Erklärung:
  „Diesen Namen verwendest du bereits.“ Dazu ein freier Vorschlag
  „[Name] – von [Creator]“, bei Bedarf deterministisch nummeriert.
- [x] Ein einzelnes Produkt kann in einen bestehenden oder einen neuen Stack
  gespeichert werden. Neuer Stack und Produkt entstehen erst beim finalen Klick
  gemeinsam und atomar; dies funktioniert auch beim ersten Stack eines neuen
  Nutzers.
- [x] Ähnlichkeit erscheint in einer neutralen Box mit
  „Ein ähnliches Produkt ist schon in diesem Stack.“
- [x] Begründung nennt die tatsächlichen wichtigsten Inhaltsstoffe, nicht interne
  Sets oder technische Regeln.
- [x] Vergleich zeigt „Bereits in deinem Stack“ und „Empfehlung des Creators“ mit
  Produkt, Menge, Einnahmetext/-rhythmus und Zeitpunkt, soweit vorhanden.
- [x] Sichtbare Texte enthalten nicht: „Konflikt“, „Hauptwirkstoff-Set“,
  „Snapshot“, „Position“, „Import“ oder „Idempotenz“.
- [x] „Mein Produkt behalten“ erklärt, dass das vorhandene Produkt unverändert
  bleibt und die Creator-Empfehlung nicht hinzugefügt wird.
- [x] „Empfehlung des Creators übernehmen“ nennt den konkreten Ziel-Stack, das
  ersetzte Produkt und alle ersetzten Angaben; andere Stacks und Produkte bleiben
  ausdrücklich unverändert.
- [x] Bei eigenem Produkt bleibt dieses samt privater Notiz gespeichert; nur die
  Anzeige in diesem Stack wechselt. Keine neue Notizspalte und kein paralleles
  Notizmodell anlegen.
- [x] Private Notiz wird nur dem angemeldeten Eigentümer geliefert, niemals
  öffentlich, im Snapshot, Tracking oder an fremde Nutzer.
- [x] Kategorie und Reihenfolge bleiben beim Ersetzen erhalten.
- [x] Bei mehreren ähnlichen Treffern muss der Nutzer genau einen auswählen;
  stilles Ersetzen des ersten Treffers ist verboten.
- [x] Änderung von Ziel oder Vorprüfung verwirft eine veraltete Auswahl.
- [x] „Behalten“ erhöht keinen Speicherzähler; nur tatsächliches Hinzufügen,
  Ersetzen oder Speichern eines ganzen Stacks zählt.
- [x] Idempotenz, Share-Hash/-Status/-Ablauf, Eigentümer, Ziel und betroffene
  Datensatzversion werden beim finalen Write erneut gebunden.

Gate P5:

- [x] Vorprüfung verändert keine Daten und gibt private Notizen nur an den
  Eigentümer aus.
- [x] Hinzufügen, Behalten, Ersetzen sowie neuer und bestehender Ziel-Stack folgen
  exakt der erklärten Wirkung.
- [x] User-Prüfer hat die Pflichtschleife aus Abschnitt 3.2 mit `PASS`
  abgeschlossen.

### P6 — Ergebnis, Rückwege und nicht verfügbare Empfehlungen

Primärer Prüfer: User-Prüfer.  
Voraussichtlicher Scope: Ergebniszustände, statusabhängige öffentliche Fehler und
Wiederherstellungsaktionen.

- [x] Nach dem Speichern keine stille Weiterleitung.
- [x] Erfolg nennt die konkrete Wirkung:
  hinzugefügt, vorhandenes Produkt behalten oder nur in diesem Stack ersetzt.
- [x] Aktionen: „Stack jetzt ansehen“ und „Bei der Empfehlung bleiben“; bei einem
  ersetzten eigenen Produkt zusätzlich der bestehende Weg
  „Eigene Produkte ansehen“.
- [x] Öffentliche Zustände werden unterschieden, ohne Moderationsgründe zu leaken:
  noch nicht freigegeben, Link abgelaufen, nicht mehr verfügbar und unbekannt.
- [x] „Nachricht an Creator kopieren“ erklärt:
  „Du kannst sie danach selbst senden.“ Die Plattform behauptet nie, die Nachricht
  zu versenden.
- [x] Zusätzlich „Zu meinen Stacks“ oder „Zur Startseite“ anbieten.
- [x] Nur echte technische Fehler sind rot und sagen einfach:
  „Das hat gerade nicht geklappt. Bitte versuche es noch einmal.“ mit
  „Erneut versuchen“.

Gate P6:

- [x] Nutzer weiß nach jedem Ergebnis und jedem nicht verfügbaren Link, was
  passiert ist und was er als Nächstes tun kann.
- [x] User-Prüfer hat die Pflichtschleife aus Abschnitt 3.2 mit `PASS`
  abgeschlossen.

## 5. Zusammenführung und verbindliche Testmatrix

Verantwortlich: Orchestrator koordiniert; Programmierer schließen nur noch
konkrete Integrationslücken. Keine neue UX-Geschmacksrunde nach Rollen-`PASS`.

### Frontend

- [x] Creator-Navigation: Berechtigung, kein Aufblitzen, direkter unberechtigter
  Aufruf und Rückweg.
- [x] Creator-Portfolio: Status, private Vorschau, Link, Beenden, Überarbeiten und
  Neu-Erstellen.
- [x] Gemeinsame Vorschau: öffentliche/interne Parität, deutsches Datum,
  Einheiten/Intervalle, alte Snapshots ohne Einheit und kein zusätzlicher
  Affiliate-Hinweis außerhalb des globalen Footers.
- [x] User-Flow: Zielwahl, neutraler Ähnlichkeitsvergleich, Folgen, Mehrfachtreffer,
  Zielwechsel, Ergebnis und Wiederherstellung.
- [x] Verständlichkeit: keine verbotenen technischen Begriffe in sichtbaren
  Nutzertexten; neutrale Hinweise nicht rot.

### Auth und Sicherheit

- [x] Deep Link über geschützte Route, Login, Registrierung, E-Mail-Bestätigung
  und Neuversand.
- [x] Sichere interne `returnTo`-Ziele sowie Tests gegen externe, doppelte Slash-,
  Backslash- und Encoding-Varianten.
- [x] Gleicher Browser mit kurzlebigem Entwurf; anderes Gerät mit exakter
  Empfehlung und neuer Vorprüfung.

### API, Snapshot und Writes

- [x] Rollen-/Eigentümer-Guards für Creator-Liste, Vorschau und Statusaktionen.
- [x] Statusauflösung ohne Leck interner Moderationsgründe.
- [x] Rückwärtskompatible alte und neue Snapshot-Versionen.
- [x] Interne Vorschau erhöht keinen öffentlichen Aufrufszähler.
- [x] Read-only Vorprüfung ist write-frei; private Notiz bleibt privat.
- [x] Ganzer Stack immer neu; einzelnes Produkt atomar in bestehenden oder neuen
  Stack; gleicher Name, Behalten, Hinzufügen, Ersetzen und Mehrfachtreffer.
- [x] Eigenes Produkt und private Notiz bleiben gespeichert; Kategorie und
  Reihenfolge bleiben im Ziel-Stack erhalten.
- [x] Alle Share-, Hash-, Status-, Ablauf-, Versions-, Eigentümer- und
  Idempotenz-Guards greifen auch beim finalen Write.
- [x] Speicherstatistik zählt nur tatsächliches Hinzufügen, Ersetzen oder einen
  ganzen Stack, nicht Vorprüfung oder Behalten.

### Proportionaler Abschlusscheck

- [x] Gezielte Frontend- und Integrationstests bestanden.
- [x] Functions-TypeScript, gezieltes ESLint, Frontend-Produktionsbuild,
  Encoding-Prüfung und `git diff --check` bestanden.
- [x] Genau ein risikoproportionaler Gesamtcheck bestanden; kein redundanter
  zweiter Volllauf ohne nachgewiesenen Flake, Migration oder Release-Grund.

## 6. Technischer Review

- [x] Ein unabhängiger technischer Reviewer prüft genau einmal den unveränderten
  Kandidaten mit Fokus auf Snapshot-Rückwärtskompatibilität, Auth-Rückweg,
  Open-Redirect-Schutz, private Notizen, Statusleaks, Race zwischen Vorprüfung und
  Write, Idempotenz und atomare Stack-/Produkt-Writes.
- [x] `FAIL`: Befunde einmal gebündelt an die zuständigen Programmierer geben,
  gezielt korrigieren und nur die betroffenen Gates erneut prüfen.
- [x] `PASS`: Review beenden; keine weitere Kontrollinstanz ohne neues konkretes
  P0-/P1-Risiko.

## 7. Veröffentlichung und Live-Abnahme

- [x] Abschlussdiff gegen Scope und geschützte Fremdänderungen prüfen.
- [x] Änderungen committen und pushen; PR erstellen beziehungsweise den im Repo
  gültigen Veröffentlichungsweg nutzen.
- [x] Erfolgreich mergen.
- [x] Produktionsdeploy einschließlich nötiger Migrationen ausführen. Falls keine
  Migration nötig ist, dies im Abschlussbeleg ausdrücklich festhalten.
- [x] Deployment bis zum endgültigen Erfolg verfolgen.
- [x] Produktiver Readback auf Desktop und Mobilgerät: Creator-Zugang/-Portfolio,
  öffentliche Empfehlung, Login-Rückweg, Zielwahl, ähnliche Produkte, Ergebnis-
  und Fehlerzustände sowie ausschließlich den globalen Affiliate-Footerhinweis.
- [x] Genau einen knappen Eintrag in `.agent-memory/deploy-log.md` ergänzen.
- [x] Diese Datei und die aktive Live-Checkliste auf vollständig `[x]` setzen.

## 8. Fertigdefinition

Der Goal-Auftrag ist erst abgeschlossen, wenn alle folgenden Punkte erfüllt sind:

- [x] `P0` bis `P6` und die jeweils verpflichtende Rollenabnahme sind `[x]`.
- [x] Kein Admin-UI-Scope wurde unbemerkt aufgenommen.
- [x] Keine doppelte Datenpflege und keine erfundenen Werte entstanden.
- [x] Affiliate bleibt ausschließlich im globalen Footer; keine Kennzeichnung an
  Produkt, Kaufbutton, Stack, Import oder Empfehlung.
- [x] Nutzertexte sind leicht verständlich und erklären die konkrete Wirkung vor
  dem Speichern.
- [x] Technischer Review und proportionaler Gesamtcheck melden `PASS`.
- [x] Änderungen sind gemergt, produktiv deployt und öffentlich auf Desktop und
  Mobilgerät verifiziert.
- [x] Abschlussbericht nennt Umsetzung, Rollenfeedback, Tests, Review, Deploy,
  Live-Readback und nur tatsächlich verbleibende Risiken.

## 9. Laufprotokoll

Nur materielle Phasenwechsel, Rollenübergaben, Blocker und Gate-Belege eintragen.

| Zeitpunkt | Paket | Agent/Rolle | Status | Beleg oder nächster Schritt |
|---|---|---|---|---|
| 2026-08-06 | Planung | Orchestrator | bereit | Checkliste erstellt; wartet auf separaten Goal-Befehl |
| 2026-08-07 | P0 | Orchestrator | in Arbeit | Goal aktiviert; Runtime-/Schema-Abgleich und Agent-Slices gestartet |
| 2026-08-07 | P0 | Orchestrator + Programmierer | PASS | 0099 und Runtime reichen; keine neue Tabelle/Migration, disjunkte Slices festgelegt |
| 2026-08-07 | P1–P2 | Programmierer | in Arbeit | Creator-Zugang/-Portfolio; danach Creator-Rollenprüfung |
| 2026-08-07 | P1–P2 | Programmierer | prüfbereit | 16/16 gezielte Tests, Builds, Functions-Typecheck, ESLint und Diff-Check PASS |
| 2026-08-07 | P1–P2 | Creator-Prüfer | NO PASS | Stille Snapshot-Teilmenge, Ersatzprodukt-/Parteien-Race und fehlende P2-Guards/UX-Tests; gebündelt zurück an denselben Programmierer |
| 2026-08-07 | P1–P2 | Programmierer | Korrektur in Arbeit | Fail-closed Vollständigkeit, gemeinsame öffentliche Vorschau, sichere Vorbelegung und party-gebundene Requests |
| 2026-08-07 | P1–P2 | Programmierer | erneut prüfbereit | 24/24 gezielte Tests sowie ESLint, Functions-Typecheck, Build und Diff-Check PASS |
| 2026-08-07 | P1–P2 | Creator-Prüfer | NO PASS | Zehn Befunde geschlossen, 26/26 Nachprüfung PASS; letzter Source-Share-Zustands-/Hash-Guard für Überarbeiten/Neu-Erstellen fehlt |
| 2026-08-07 | P1–P2 | Programmierer | Korrektur in Arbeit | Erwartungsgebundener Source-Share-Guard, stale 409 ohne Insert und genauer Recoverytext |
| 2026-08-07 | P1–P2 | Programmierer | final prüfbereit | Source-ID/Partei/Hash/Status/Revoke/Ablauf atomar gebunden; stale 409 ohne Insert; 23/23 Delta-Tests PASS |
| 2026-08-07 | P1–P2 | Creator-Prüfer | PASS | Keine Befunde; frühere Korrekturen unverändert; `CREATOR PASS P1/P2` |
| 2026-08-07 | P3–P4 | Programmierer | in Arbeit | Snapshot-Einheit, gemeinsame Darstellung und sicherer Auth-/E-Mail-Rückweg |
| 2026-08-07 | P3–P4 | Programmierer | prüfbereit | 47/47 Zieltests sowie Typecheck, ESLint, aktiver Build und Diff-Check PASS |
| 2026-08-07 | P3–P4 | User-Prüfer | NO PASS → PASS | Mail-Link im neuen Tab verlor sessionStorage-Draft; browserweites tokengebundenes 30-Minuten-localStorage korrigiert, 7/7 Delta-Tests und `USER PASS P3/P4` |
| 2026-08-07 | P3–P4 | Creator-Prüfer | NO PASS | Pluralform und Route-Token A→B übernehmen Zustand; gezielt zurück an denselben Programmierer |
| 2026-08-07 | P3–P4 | Programmierer | Korrektur in Arbeit | zentrale Einheiten-Pluralform und vollständiger tokengebundener Seiten-Reset inklusive Idempotency-Key |
| 2026-08-07 | P3–P4 | Programmierer | erneut prüfbereit | Pluralformen, token-keyed Remount, getrennte Drafts/Writes und late-response-Schutz; 7/7 Delta-Tests plus Build/Lint/Diff PASS |
| 2026-08-07 | P3–P4 | Creator-Prüfer | PASS | 10/10 Nachtests, keine Befunde; `CREATOR PASS P3/P4` |
| 2026-08-07 | P5–P6 | Programmierer | in Arbeit | read-only Vorprüfung, Zielwahl, neutrale Entscheidung, atomare Writes, Ergebnis und Recovery |
| 2026-08-07 | P5–P6 | Programmierer | Architektur PASS | Keine Migration; reproduzierbarer Preflight-Fingerprint, batchgebundene Writes, write-freies Behalten und private Notiz nur für Eigentümer |
| 2026-08-07 | P5–P6 | Programmierer | prüfbereit | 27/27 UI-/Runtimefälle sowie Functions-Typecheck, ESLint, aktiver Build, UTF-8 und Diff-Check PASS; User-Prüfung gestartet |
| 2026-08-07 | P5–P6 | User-Prüfer | NO PASS | Direkter Stack-Link, richtiger Stacklisten-Retry/Ladeguard und sichtbarer Clipboard-Retry fehlen; gezielt zurück an denselben Programmierer |
| 2026-08-07 | P5–P6 | Programmierer | Korrektur in Arbeit | Nur drei User-P1-Punkte und zugehörige Delta-Tests |
| 2026-08-07 | P5–P6 | Programmierer | erneut prüfbereit | Direkter Ziel-Stack-Link, echter Stacklisten-Reload mit Ladeguard und sichtbarer Clipboard-Retry; 33/33 UI-/Runtimefälle, ESLint, Build, UTF-8 und Diff-Check PASS |
| 2026-08-07 | P5–P6 | User-Prüfer | PASS | Alle drei Erstbefunde geschlossen; keine verbleibenden klaren, verwirrenden, fehlenden oder blockierenden Punkte; `USER PASS P5/P6` |
| 2026-08-07 | Integration | Orchestrator | in Arbeit | Einmaliger risikoproportionaler Gesamtcheck und danach unabhängiger technischer Review |
| 2026-08-07 | Integration | Orchestrator + Programmierer | Flake → PASS | Erster Gesamtcheck 69/70 wegen zu früher Testabfrage; ausschließlich Test auf Vorschau-Fertigzustand synchronisiert, gezielter Flake-Nachweis 1/1 und zulässiger Gesamt-Recheck 70/70 PASS |
| 2026-08-07 | Technikreview | unabhängiger Reviewer | in Arbeit | Unveränderter Kandidat; Fokus auf Snapshot/Auth/Privatsphäre/Status/Write-Guards/Atomarität/Idempotenz |
| 2026-08-07 | Technikreview | unabhängiger Reviewer | FAIL | Vorbereitende `sqlite_sequence`-Writes und nur global key-gebundene Folgewrites verletzen stale-409-ohne-Writes beziehungsweise Race-Atomarität; zwei zusammenhängende P1-Befunde gebündelt zurück an denselben Programmierer |
| 2026-08-07 | P5 Technik | Programmierer | Korrektur in Arbeit | Write-freie ID-Zuteilung oder claim-gebundene Reservierung; versuchsspezifischer Batch-Claim und gezielte Stale-/Same-Key-Race-Regressionen, ohne Migration/UX-Änderung |
| 2026-08-07 | P5 Technik | Programmierer | prüfbereit | Read-only ID-Kandidaten und serverseitige Nonce binden alle Folgewrites an exakt den gewonnenen Claim; stale 0 Writes/Sequenzänderung, Same-Key exakt 1 Wirkung; Runtime 18/18 plus Typecheck/ESLint/UTF-8/Diff PASS |
| 2026-08-07 | P5 Technik | User-Prüfer | PASS | UI, Wording, API und Flow unverändert; `USER PASS P5/P6 TECH-FIX` |
| 2026-08-07 | Technikreview | derselbe unabhängige Reviewer | PASS | Beide ursprünglichen P1-Befunde im korrigierten Diff geschlossen; Review beendet, keine weitere Kontrollinstanz |
| 2026-08-07 | Release | Orchestrator | in Arbeit | Abschlussdiff, Commit/Push/PR/Merge, Produktionsdeploy und Desktop-/Mobil-Readback |
| 2026-08-07 | Release | GitHub | PASS | Commit `f36a384`, PR #12; erster CI-Versuch 194/195 wegen unabhängigem Browser-Start-Flake, unveränderter Wiederholungslauf vollständig PASS; Squash-Merge `b0ae113` |
| 2026-08-07 | Deploy | GitHub Actions + Cloudflare | PASS | Main-CI und Cloudflare-Run `31185868885` erfolgreich; keine neue Migration, vorhandener Migrationsschritt ohne offene Änderung PASS |
| 2026-08-07 | Live-Readback | Orchestrator | PASS | Desktop: `/creator` → `/login?returnTo=%2Fcreator`, exakter Share-Query-/Hash-Rückweg bis Registrierung, verständlicher unbekannter Link und Clipboard-Fehler; Mobil 390×844 ohne horizontalen Überlauf, mobiles Menü, Recovery und globaler Affiliate-Footerhinweis. Keine Browserfehler; eingeloggtes Portfolio zusätzlich durch Rollen-/Runtimegates verifiziert, da keine Produktionsanmeldedaten verwendet wurden. |
