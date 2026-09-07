# Supplement Stack – User-, Creator-, Text- und SEO-Audit

Stand: 16. August 2026

Scope: alle Nicht-Admin-Flächen einschließlich Creator-/Teilen-Funktion

Statusnotation: `[ ]` offen · `[~]` in Arbeit · `[x]` verifiziert · `[!]` blockiert

## 1. Zweck und Bewertungsgrundlage

Dieses Dokument ist die dauerhaft abhakbare Arbeitsgrundlage, um Supplement
Stack aus Sicht normaler Nutzer und Creator auf ein 10/10-Erlebnis zu bringen.
Der Administratorbereich ist ausdrücklich nicht enthalten.

Geprüft wurden:

- alle 19 Nicht-Admin-Routentemplates und ihre wesentlichen Lade-, Leer-,
  Erfolgs-, Fehler-, Berechtigungs- und Tokenzustände;
- Navigation, Cookie-Einwilligung, Footer, Registrierung, Konto, eigene
  Produkte, Stack-Verwaltung, Einnahmeplan, Demo und Demo-Übergabe;
- Creator-Portfolio, Freigabe, öffentlicher Share, Login-Rückweg, Import,
  Vergleich, Konfliktentscheidung und Ergebnis;
- Wissensübersicht, 44 Hauptartikel und 746 Studien-/Quellenseiten;
- Desktop sowie 390 px Mobilbreite, sichtbare Texte, Tastatur-/ARIA-Grundlagen,
  Roh-HTML, Statuscodes, Robots, Sitemap, Metadaten und strukturierte Daten.

### UX-Sterne

| Sterne | Bedeutung |
|---:|---|
| 9–10 | klar, angenehm, vertrauenswürdig und nahezu reibungslos |
| 7–8 | gut nutzbar; erkennbare Reibung oder fehlender Komfort |
| 5–6 | funktional, aber verwirrend, unnötig technisch oder unvollständig |
| 3–4 | deutlicher Widerstand, falsche Erwartung oder fehlende Kernhilfe |
| 1–2 | blockierend, irreführend oder für wichtige Nutzer nicht verlässlich |

### SEO-Score

Der SEO-Score von 0–100 setzt sich zusammen aus Crawl-/Indexierungsziel und
HTTP-Status (25), Title/Description/Canonical/Robots (20), Roh-HTML und Semantik
(20), Open Graph/Twitter/Schema (15), interner Auffindbarkeit/Sitemap (10) sowie
Auslieferungsgrundlagen (10). Bei privaten Seiten bedeutet 100: zuverlässig
`noindex`, korrekter Status, keine privaten oder tokenhaltigen Metadaten und eine
saubere Browserdarstellung – nicht öffentliche Indexierung.

## 2. Wichtigste Ergebnisse

1. **Zwei Rückwege sind funktional defekt:** `Stack jetzt ansehen` übergibt
   `?stack=<id>`, die Stack-Seite wertet die ID aber nicht aus. Außerdem geht der
   Rückweg zum Share über `Passwort vergessen → Passwort zurücksetzen` verloren.
2. **E-Mail-Versand geschieht ohne Bestätigung:** Ein Klick auf das Mail-Symbol
   versendet unmittelbar an die Account-Adresse. Zieladresse und Folge sind vor
   dem Klick nicht sichtbar.
3. **Die Wissensübersicht hat eine zweite Datenwahrheit:** Im Frontend stehen 89
   fest codierte Wirkstoffe, die zentrale API liefert 92. Namen, Kategorien und
   Kurztexte müssen aus der zentralen Wirkstoffquelle kommen.
4. **Referenzwerte wirken wie Dosierungsratschläge:** „DGE Empfehlung",
   „Studien-Referenz“ und „Empfehlung übernehmen“ unterscheiden nicht klar
   zwischen Gesamtzufuhr, untersuchter Menge und Supplementmenge.
5. **Die öffentliche SEO-Basis ist weitgehend unsichtbar:** `robots.txt` sperrt
   alles außer exakt 790 Wissensdetails. Startseite, `/wissen` und Demo sind
   ausgeschlossen; Nicht-Artikel-Routen haben nur eine generische App-Shell.
6. **Nicht vorhandene Seiten sind Soft-404:** Auch beliebige URLs und ungültige
   Share-/Wissenspfade liefern im Rohaufruf `200`.
7. **Creator-Sharing ist fachlich gut abgesichert, visuell aber unfertig:** Die
   Import-Guards sind stark, mehrere entscheidende Buttons und Radio-Felder sind
   jedoch kaum gestaltet; Benachrichtigung, Ablehnungsgrund und Undo fehlen.
8. **Eigene Produkte zeigen einen falschen Preisbezug:** Der als Packungspreis
   eingegebene Wert wird in der Produktliste mit `/Mo.` beschriftet.
9. **Der Einnahmeplan kann Zeitpunkte unterschlagen:** `Morgens & Abends` wird
   nur morgens einsortiert; „zum Essen“ wird ohne Datengrundlage zu mittags.
10. **Barrierefreiheit ist inkonsistent:** Kartenwahl ist per Maus möglich, aber
   nicht sauber per Tastatur; manche Modale haben keinen benannten Dialog,
   dynamische Meldungen selten `role=status/alert`, sehr viele Wissenstexte sind
   mobil kleiner als 12 px.
11. **Die Affiliate-Regel ist richtig:** Keine produktbezogene Kennzeichnung.
    Der globale Footertext reicht aus und bleibt die einzige sichtbare
    Affiliate-Kennzeichnung.

## 3. Globale Oberfläche und wiederkehrende Texte

| Erledigt | ID | Funktion/Text | ★ | Befund | Zielbild 10/10 |
|---|---|---|---:|---|---|
| [x] | G-01 | Desktop-Navigation | 8 | Hauptbereiche sind verständlich und kurz. Der Creator-Link verschwindet bei Lade-/API-Problemen kommentarlos. | Stabilen Creator-Einstieg mit Lade-/Fehlerzustand zeigen; aktive Seite und Kontobereich eindeutig markieren. |
| [x] | G-02 | Mobile Navigation | 7 | Kein horizontaler Überlauf, große Ziele. Der Schalter heißt auch im geöffneten Zustand „Menü öffnen“. | Dynamisch „Menü öffnen“/„Menü schließen“, Fokus in das Menü, Escape zum Schließen und Fokus zurück zum Auslöser. |
| [x] | G-03 | Konto-/Auth-Navigation | 7 | E-Mail als Profil-Link und Abmelden sind verständlich. Login und Registrierung bleiben für bereits angemeldete Nutzer direkt aufrufbar. | Angemeldete Nutzer von Login/Registrierung sinnvoll zu Stacks oder Profil weiterleiten; Rückweg respektieren. |
| [x] | G-04 | Logo/Home-Rückweg | 9 | Logo liefert einen erwartbaren Startseiten-Rückweg. | Fokuszustand und zugänglichen Namen in allen Varianten einheitlich prüfen. |
| [x] | G-05 | Cookie-Einwilligung | 8 | Ablehnen und Zustimmen sind gleichwertig erreichbar; Zweck wird genannt. „Analytics“ und „Skripte“ sind unnötig technisch. | „Nutzungsstatistik“ in Alltagssprache; Details einklappbar; Fokus und erneutes Öffnen vollständig tastaturbedienbar. |
| [x] | G-06 | Footer-Navigation | 9 | Rechtstexte und Cookie-Einstellungen sind zuverlässig erreichbar. | Aktuelles Änderungsdatum der Rechtstexte ergänzen. |
| [x] | G-07 | Globaler Affiliate-Hinweis | 10 | Der vorhandene Footertext erklärt Provision, Mehrkosten und neutrale Reihung ausreichend. | Unverändert als einzige sichtbare Affiliate-Kennzeichnung beibehalten; keine Badges oder Kartentexte ergänzen. |
| [x] | G-08 | Globaler Gesundheitshinweis | 8 | Inhaltlich klar, aber dauerhaft sehr klein und dicht. | Mindestens 12–14 px, kürzerer Hauptsatz plus Link „Warum dieser Hinweis?“. |
| [x] | G-09 | Ladezustände | 6 | Mischung aus Skeleton, Spinner, „Laden...“ und leeren Flächen; selten mit zugänglicher Statusmeldung. | Einheitliches Skeleton/Statusmuster, `aria-live`, verständlicher Bezug („Deine Stacks werden geladen“). |
| [x] | G-10 | Fehlerzustände | 6 | Viele Fehler sind verständlich, manche geben Backendtext oder „Unbekannter Fehler“ aus; Retry fehlt häufig. | Nutzerfreundlicher Haupttext, technische Referenz nur optional, Retry und sicherer Rückweg; `role=alert`. |
| [x] | G-11 | Erfolgszustände | 7 | Erfolgsfeedback existiert, ist teils nur 11 px groß und ohne Live-Region. | Gut sichtbarer Status, `role=status`, konkrete Folge und nächster sinnvoller Schritt. |
| [x] | G-12 | Modale Dialoge | 6 | Gestaltung ist uneinheitlich; nicht alle Dialoge sind benannt oder fangen Fokus/Escape sauber ab. | Einen gemeinsamen Dialogbaustein mit Titelbindung, Fokusfalle, Escape, Fokus-Rückgabe und sicheren Destruktivvarianten verwenden. |
| [x] | G-13 | Mobile Lesbarkeit | 6 | Kein horizontaler Überlauf auf 19 geprüften Routen. Auf `/wissen` sind 128 sichtbare Elemente kleiner als 12 px; Sortierung, Warninfos und mehrere CTAs bleiben unter 44 px. | Keine wichtige Information unter 12 px, Fließtext mindestens 14–16 px, primäre Touchziele mindestens 44×44 px, Zoom und 200-%-Reflow prüfen. |
| [x] | G-14 | Sprache und Ton | 6 | Überwiegend „du“, aber einzelne „Sie“-Texte, Fachwörter und ASCII-Umschriften. | Produktweit „du“, echtes UTF-8, kurze Sätze und Begriffe, die Nutzer ohne Fachwissen verstehen. |
| [x] | G-15 | Seitentitel/H1 und Landmarks | 5 | `/stacks`, Demo und Einnahmeplan besitzen keinen Seiten-H1. Wissen und Wissensartikel verschachteln ein zweites `<main>` im Layout-`<main>`. | Pro Seite genau ein sichtbarer H1 und genau ein `<main>`, passend zu Browser-Titel und Nutzerziel. |

## 4. Startseite `/`

| Erledigt | ID | Funktion/Text | ★ | Befund | Zielbild 10/10 |
|---|---|---|---:|---|---|
| [x] | HOME-01 | Hero und Nutzenversprechen | 8 | „Wissenschaftlich. Einfach. Kostenlos.“ ist stark, aber „wissenschaftlich“ wirkt umfassender als die tatsächliche Orientierungsfunktion. | Präzisieren: „Quellenbasiert planen. Einfach vergleichen. Kostenlos starten.“ und Grenzen direkt sichtbar halten. |
| [x] | HOME-02 | CTA ohne Konto | 9 | Demo und kostenlose Registrierung sind klar getrennt. | Vorab in einem Satz erklären, was in der Demo erhalten bleibt und was ein Konto speichert. |
| [x] | HOME-03 | CTA angemeldet „Wirkstoff suchen“ | 6 | Führt zu `/stacks`, aber nicht direkt zur Suche; Erwartung und Zielzustand passen nicht. | Entweder Suchdialog direkt öffnen oder CTA „Zu meinen Stacks“ nennen. |
| [x] | HOME-04 | Quellen-/Kosten-Chips | 7 | Schnell erfassbar, aber „Kostenlos & ohne Konto nutzbar“ klingt nach vollständiger Nutzung ohne Konto. | „Demo ohne Konto · dauerhaft speichern mit kostenlosem Konto“; „Quellen: DGE, EFSA und NIH“. |
| [x] | HOME-05 | Drei Schritte | 7 | Ablauf ist verständlich. „Richtwert“ und passende Produkte suggerieren eine individuelle Empfehlung. | Gesamtzufuhr, Studienmenge und eigene Planung trennen; keine automatische Eignung versprechen. |
| [ ] | HOME-06 | Feature „Preis-Leistung“ | 6 | „Produkte nach Preis-Leistung“ klingt wie eine Rangliste/Empfehlung, obwohl Produktdaten nur vergleichbar gemacht werden. | „Kosten und Inhaltsangaben vergleichbar anzeigen“; Sortierlogik transparent nennen. |
| [x] | HOME-07 | Eigene Produkte | 8 | Nutzen und Datenbanklücke werden verständlich erklärt. | Moderations-/Freigabefolge vorab in einem Satz nennen. |
| [x] | HOME-08 | Live-Kennzahlen | 7 | Gute Vertrauenssignale, bei Fehlern nur Gedankenstriche. Wissen zeigt gleichzeitig 89 statt 92 Wirkstoffe. | Gemeinsame zentrale Zählung verwenden; bei Ladefehlern neutral „Zurzeit nicht verfügbar“ plus Retry. |
| [x] | HOME-09 | Vertrauensblock | 7 | Keine Heilversprechen und Datenschutz werden angesprochen; mehrere Sätze lesen sich wie Rechtsprosa. | Vier kurze, belegbare Aussagen mit Links „So entstehen Inhalte“, „So vergleichen wir“, „Datenschutz“. |
| [x] | HOME-10 | Abschluss-CTAs | 8 | Wiederholung hilft langen Seiten, Demo und Registrierung bleiben klar. | CTA-Ziel anhand Loginzustand konsistent halten und Wiederholungen textlich verkürzen. |

## 5. Anmeldung, Registrierung und E-Mail

| Erledigt | ID | Funktion/Text | ★ | Befund | Zielbild 10/10 |
|---|---|---|---:|---|---|
| [x] | AUTH-01 | Loginformular | 8 | Kurz, bekannte Felder, gute Autocomplete-Werte. Passwortsichtbarkeit und konkrete Rückkehrbotschaft fehlen. | „Passwort anzeigen“, verständliche Validierung und bei Share-Rückweg „Danach kommst du zu dieser Empfehlung zurück.“ |
| [x] | AUTH-02 | Loginfehler | 7 | Grundsätzlich verständlich, API-Text kann uneinheitlich sein. | Einheitliche Meldung ohne Konto-Offenlegung, Feldbezug und erneuter Versuch ohne Datenverlust. |
| [x] | AUTH-03 | Wechsel Login ↔ Registrierung | 9 | `returnTo` bleibt im normalen Pfad erhalten. | Rückkehrziel zusätzlich sichtbar benennen. |
| [x] | AUTH-04 | „Passwort vergessen?“ | 3 | Der Share-Rückweg wird nicht an Forgot/Reset und den späteren Login weitergereicht. | `returnTo` serverseitig sicher durch Anforderung, Mail, Reset und Login tragen; Tests für Pfad, Query und Hash. |
| [x] | AUTH-05 | Passwort-anfordern-Formular | 9 | Kurz und gegen Nutzererkennung abgesichert. | Rückkehrkontext bewahren und Versandstatus als Live-Region ausgeben. |
| [x] | AUTH-06 | Reset ohne/mit ungültigem Token | 5 | Verständlicher Text, aber kein H1 und keine Unterscheidung abgelaufen/ungültig. | H1, 400/410-Zustand, neuer Link mit erhaltenem Rückweg und klare Ursache ohne technische Details. |
| [x] | AUTH-07 | Neues Passwort | 8 | Regeln und Bestätigung sind klar. | Anzeigen/Verbergen, Caps-Lock-Hinweis, sichere Qualitätsanzeige und Rückweg erhalten. |
| [x] | AUTH-08 | Registrierung: Pflichtfelder | 7 | E-Mail und Passwort sind erwartbar. Optionale Profilfragen erhöhen bereits hier die Last. | Registrierung auf E-Mail, Passwort und notwendige Einwilligung reduzieren; optionale Präferenzen später erklären. |
| [x] | AUTH-09 | „Optional: Alter und bevorzugte Quellenpraeferenz...“ | 3 | Sichtbar falsche Umlaute, langer Begriff und unklarer Nutzen. | „Optional – kannst du später im Profil ergänzen.“ Nutzen je Feld erklären oder Felder aus dem Signup entfernen. |
| [x] | AUTH-10 | „Leitlinienquelle“ und Option „Influencer“ | 4 | Fachbegriff und Kategorien sind nicht selbsterklärend; „Influencer“ ist keine Leitlinie. | „Welche Quellen möchtest du bevorzugt sehen?“ mit „Offizielle Referenzwerte“, „Studien“, „Creator-Empfehlungen“ – oder Präferenz entfernen, solange sie keinen klaren Effekt hat. |
| [x] | AUTH-11 | Einwilligungstext | 3 | Sehr lang, juristisch, ASCII-Umschriften und „DSGVO Art. 9 erforderlich“ überfordern. | Kurzer Hauptsatz: „Ich stimme zu, dass meine Stack- und Produktdaten gespeichert werden.“ Details und Datenliste einklappbar, Rechtstext verlinken, echte Umlaute. |
| [x] | AUTH-12 | E-Mail-Bestätigung | 8 | Lade-, Erfolg-, Fehler- und erneuter Versand sind gut getrennt. | Rückkehrziel konkret benennen, Status als Live-Region, Spam-/Gültigkeits-Hilfe ergänzen. |
| [x] | AUTH-13 | Bereits angemeldet auf Login/Register | 5 | Formulare bleiben erreichbar und erzeugen unnötige Verwirrung. | Sicher zu Rückkehrziel/Stacks weiterleiten oder klar „Du bist bereits angemeldet“ mit Kontowechsel anbieten. |

## 6. Profil `/profile`

| Erledigt | ID | Funktion/Text | ★ | Befund | Zielbild 10/10 |
|---|---|---|---:|---|---|
| [x] | PROF-01 | E-Mail und Bestätigungsstatus | 8 | Status und erneuter Versand sind klar. | Versandstatus zugänglich und mit Zieladresse/Abklingzeit anzeigen. |
| [x] | PROF-02 | „Rolle: user/admin“ | 3 | Interner Rollenwert ist technische Sprache und für normale Nutzer bedeutungslos. | „Kontotyp: Standardkonto“ beziehungsweise verständliche Produktrolle; ganz ausblenden, wenn ohne Nutzen. |
| [x] | PROF-03 | Alter | 5 | Änderbar, aber Zweck und Auswirkung fehlen. Leeren Wert als `undefined` zu senden kann Löschen/Beibehalten uneindeutig machen. | Nutzen direkt erklären, „Keine Angabe“ anbieten und Speichersementik eindeutig machen. |
| [x] | PROF-04 | Quellenpräferenz | 4 | Gleiche unklare Taxonomie wie Registrierung; sichtbare Folge ist nicht erklärt. | Nutzerwirkung erklären, passende Alltagssprache oder Funktion entfernen. |
| [x] | PROF-05 | Profil speichern | 8 | Klare Erfolg-/Fehlermeldung. | Nur geänderte Werte senden, ungespeicherte Änderung markieren und Status live ankündigen. |
| [x] | PROF-06 | Passwort ändern | 8 | Gute Mindestprüfungen und verständliche Texte. | Anzeigen/Verbergen, Caps Lock und nach Erfolg Hinweis auf weiter bestehende/abgemeldete Sitzungen. |
| [x] | PROF-07 | Account löschen | 8 | Bestätigungsphrase und Passwort schützen vor Versehen. | Vorher vollständig aufzählen, was gelöscht wird, Datenexport anbieten und endgültige Folge bestätigen. |
| [x] | PROF-08 | Datenexport/Einwilligungen | 4 | Kein sichtbarer Export und kein zentraler Überblick über Einwilligungen. | „Meine Daten herunterladen“ und verständliche Einwilligungsverwaltung ergänzen. |

## 7. Eigene Produkte `/my-products`

| Erledigt | ID | Funktion/Text | ★ | Befund | Zielbild 10/10 |
|---|---|---|---:|---|---|
| [x] | OWN-01 | Seiteneinstieg und Leerzustand | 8 | Klare Überschrift und hilfreicher Leerzustand, aber zwei nahezu identische Erstellen-CTAs. | Einen primären CTA, kurze Erklärung „Damit kannst du es in deinen Stacks verwenden“. |
| [x] | OWN-02 | Produktliste | 7 | Name, Marke, Form, Portionen und Wirkstoffteile sind erkennbar. Suche, Filter und Sortierung fehlen. | Suche, Statusfilter, Sortierung und klare Anzahl ergänzen. |
| [x] | OWN-03 | Preisanzeige `… €/Mo.` | 3 | `price` wird im Formular als Packungspreis erfasst, in der Liste aber als Monatswert beschriftet. | „Packungspreis: … €“ zeigen oder Monatskosten aus Nutzungsdaten wirklich berechnen und beide Werte getrennt nennen. |
| [x] | OWN-04 | Freigegebenes Produkt gesperrt | 5 | Sperre wird erklärt, aber ohne Statusgeschichte oder Korrekturweg. | „Freigegeben“ als Status, Grund der Sperre und „Änderung vorschlagen/duplizieren“ anbieten. |
| [ ] | OWN-05 | Bearbeiten/Löschen | 7 | Große zugängliche Symbolflächen; Löschen nutzt einen nativen Browserdialog. | Gemeinsamer Bestätigungsdialog, Folge nennen, Erfolg/Fehler zugänglich anzeigen. |
| [x] | OWN-06 | Produktfoto | 7 | Upload und URL sind möglich, aber gleichzeitig sichtbar und ohne Format-/Datenschutzhilfe. | Einen klaren Uploadpfad, Vorschau, Dateigrenzen, Alt-/Rechtehinweis und sicheren Entfernen-Dialog. |
| [x] | OWN-07 | Grunddatenformular | 6 | Vollständig, aber lang; Beispiele teils ohne Leerzeichen („z.B.“) und Fachbezug fehlt. | Schrittweises Formular mit „Produkt“, „Packung“, „Wirkstoffe“, „Optional“; „z. B.“ konsistent. |
| [x] | OWN-08 | „Dosierung pro Portion“ | 4 | Eingaben mischen Wirkstoffmenge und Einnahmeeinheit; Beispiel „400 mg pro 1 Kapsel“ passt nicht eindeutig zu den beiden Feldern. | Erst Packungsangabe („Eine Portion besteht aus … Kapseln“), dann je Wirkstoff „… mg pro Portion“ getrennt erfassen. |
| [x] | OWN-09 | Packungsinhalt/Portionen | 5 | Zwei Zahlenfelder mit langen Platzhaltern, Verhältnis bleibt unklar. | Sichtbare Labels „Portionen je Behälter“ und „Behälter in der Packung“, berechnete Gesamtportionen live zeigen. |
| [x] | OWN-10 | Wirkstoffbereich | 5 | Leistungsfähig, aber sehr technisch: Basis-Wirkstoff, Form, Teile, Bezugsgröße und Suchrelevanz. | Standardmodus für einen Wirkstoff; „Weitere Angaben für Experten“ einklappen; Beispiele und Live-Zusammenfassung. |
| [x] | OWN-11 | „Für Suche und Produktvergleich berücksichtigen“ | 5 | Auswirkung wird nur teilweise erklärt; Nutzer können Daten versehentlich aus der Suche nehmen. | „Diesen Wirkstoff bei der Suche anzeigen“ plus konkrete Folge; Standard sicher vorbelegen. |
| [x] | OWN-12 | Fehler und Validierung | 6 | Fehlerblock vorhanden, viele Regeln erscheinen erst beim Absenden. | Inline-Validierung pro Feld, Fokus auf ersten Fehler, Eingaben behalten und Fehler in Alltagssprache. |
| [x] | OWN-13 | Ungespeicherte Änderungen | 3 | Schließen/Zurück kann lange Formulareingaben verlieren. | Dirty-State, Bestätigung vor Verlassen und optional lokaler Entwurf. |

## 8. Stack-Arbeitsfläche `/stacks` und Demo `/demo`

| Erledigt | ID | Funktion/Text | ★ | Befund | Zielbild 10/10 |
|---|---|---|---:|---|---|
| [x] | STACK-01 | Seitenkopf | 5 | `/stacks` und Demo blenden den vorhandenen `StacksHeader` aus; die Arbeitsfläche beginnt ohne H1 direkt mit Werkzeugen. | H1 „Meine Stacks“ beziehungsweise „Supplement Stack kostenlos testen“ plus kurze Orientierung vor der Arbeitsfläche. |
| [x] | STACK-02 | Demo-Erklärung | 6 | Rücksetzen und Registrierung werden erklärt, aber „Alles nutzbar“ widerspricht gesperrter Mail-, PDF- und Eigenproduktfunktion. Bei angemeldeter Sitzung sagt die Navigation „Abmelden“, die Demo gleichzeitig „nicht angemeldet“. | Exakte Demo-Grenzen nennen; gesperrte Aktionen vorab markieren; Demo- und Accountkontext konsistent darstellen; Übergabe beim Registrieren ankündigen. |
| [x] | STACK-03 | Stack-Auswahl/Erstellen | 8 | Wechsel und „Neuen Stack anlegen“ sind kompakt. | Label außerhalb des Selects, ausgewählten Stack in URL abbilden und Browser-Zurück unterstützen. |
| [x] | STACK-04 | `?stack=<id>` öffnen | 3 | Import-Ergebnis verlinkt die ID, die Arbeitsfläche ignoriert sie und kann einen anderen Stack zeigen. | ID lesen, Besitz prüfen, Stack aktivieren, ungültige ID freundlich melden und Query anschließend bereinigen. |
| [x] | STACK-05 | Symbolleiste | 5 | Bearbeiten, Mail, PDF und Löschen sind ohne sichtbaren Text; Bedeutung hängt von Tooltip/ARIA ab. | Auf Desktop kurze Labels, mobil zugängliches Aktionsmenü; Primär-, Sekundär- und Gefahraktionen visuell trennen. |
| [x] | STACK-06 | Stack per E-Mail | 2 | Ein Klick löst sofort Versand aus; Zieladresse und Inhalt sind vorher unsichtbar. | Dialog mit „An meine Account-Adresse … senden“, Inhalt/Creatorbezug nennen, explizit bestätigen und danach gut sichtbaren Status anbieten. |
| [x] | STACK-07 | Drucken/PDF | 7 | Funktion vorhanden, Bezeichnung „Plan drucken/PDF“ ist holprig. | „Drucken oder als PDF speichern“, Druckvorschau und optimierten Kopf mit Stack/Creator/Snapshot/Disclaimer. |
| [x] | STACK-08 | Stack löschen | 8 | Bestätigung schützt vor Versehen. | Produktanzahl/Folge nennen und, wenn möglich, kurze Wiederherstellung anbieten. |
| [x] | STACK-09 | „Wirkstoffe pro Tag“ | 9 | Nach Korrektur dezent, kompakt und informativ. | Optional einklappbar machen und bei nicht addierbaren Einheiten verständlich erklären. |
| [x] | STACK-10 | Stackbeschreibung | 8 | Sichtbar und verständlich. | Im Bearbeitungsdialog verbleibende Zeichen und Beispiel ohne englischen Stacknamen. |
| [x] | STACK-10A | Speicherung der Stackbeschreibung | 5 | Auch angemeldete Nutzer speichern Beschreibungen nur in `localStorage`; sie fehlen auf anderen Geräten und bilden eine zweite Wahrheit neben dem Backend-Stack. | Beschreibung zentral am Stack persistieren, lokale Werte einmalig und guard-basiert migrieren, danach lokalen Schattenbestand entfernen. |
| [x] | STACK-11 | Sortierung | 7 | A–Z, Tageszeiten und eigene Reihenfolge sind vorhanden. „Eigene“ bleibt ohne Kontext; Drag-and-drop ist nicht tastaturgeeignet. | „Manuell“, kurze Anleitung, Auf/Ab-Tasten als Tastaturalternative und Speichermeldung. |
| [x] | STACK-12 | Kategorien | 7 | Keine/Tageszeiten/eigene Kategorien sind mächtig, aber zusammen mit Sortierung und Ansicht kognitiv dicht. | Bereich „Ansicht anpassen“ zusammenfassen; Kategorien und Reihenfolge mit Vorschau erklären. |
| [x] | STACK-13 | Eigene Kategorien | 7 | Erstellen, Umbenennen, Löschen und Zuweisen vorhanden. | Fokusführung, Status-Live-Region, Produktfolge beim Löschen und Undo ergänzen. |
| [x] | STACK-14 | Kachel-/Listenansicht | 8 | Nutzer kann Dichte wählen. | Auswahl merken und Unterschiede zugänglich benennen. |
| [x] | STACK-15 | Leerzustand | 9 | Sagt klar, wie der erste Schritt funktioniert, und bietet den CTA direkt an. | Bei mehreren Stacks Stackname im Text nennen. |
| [x] | STACK-16 | Auswahl und Kostenleiste | 7 | Einmal- und Monatskosten sind nützlich. Warum Karten ausgewählt/abgewählt werden, ist nicht erklärt. | „In Kostenübersicht enthalten“ direkt an Auswahl erklären und Screenreaderstatus ergänzen. |
| [x] | STACK-17 | Produktkarte: Identität | 8 | Bild, Marke, Name und Zeitpunkt sind schnell erfassbar. Sehr kleine 10–11-px-Texte bremsen. | Mindestschriftgröße erhöhen; fehlendes/defektes Bild mit stabilem Platzhalter. |
| [x] | STACK-18 | Produktkarte: Menge/Reichweite/Intervall | 8 | Wichtige Nutzungsdaten sind kompakt. `unbekannt` oder Strich erklärt die Ursache nicht. | „Nicht berechenbar – Produktangaben fehlen“ mit Reparaturweg für eigene Produkte. |
| [x] | STACK-19 | Produktkontext und Wirkung | 9 | Produktkarten zeigen nur belegte Produkt- und Nutzungsangaben. Ungeprüfte Wirkungsclaims bleiben aus dem kaufnahen Kontext entfernt. | Zentrale Wirkstoffeinordnung ausschließlich in der produktfreien Wissensübersicht; kommerzielle Claims erst mit belegtem Claim- und Mengen-Guard. |
| [x] | STACK-20 | Hinweise/Warnungen | 8 | B12 ist sachlicher Hinweis, echte Risiken bleiben unterscheidbar. Modaltexte „Kurzbeschreibung/Details“ sind technisch und redundant. | Ein klarer Titel, einfache Erklärung, konkrete sichere nächste Handlung und Link „Mehr dazu“. |
| [x] | STACK-21 | Karten-Auswahl per Klick | 4 | Ganze Karte reagiert auf Maus, ist aber kein semantischer Button und nicht zuverlässig per Tastatur wählbar. | Echte Checkbox/Schaltfläche mit sichtbarem Label, Space/Enter, Fokusrahmen und Statusansage. |
| [x] | STACK-22 | Kaufbutton | 8 | Zielshop ist meist im Button erkennbar; öffnet sicher in neuem Tab. | „Öffnet Shop in neuem Tab“ zugänglich ankündigen, defekte Links schnell melden. Keine produktbezogene Affiliate-Kennzeichnung ergänzen. |
| [x] | STACK-23 | Fehlenden Link melden | 7 | Nützlicher Weg vorhanden, aber Erfolg und weitere Folge sind wenig sichtbar. | Bestätigung, was gemeldet wurde, und alternative Handlung anbieten. |
| [x] | STACK-23A | Rückmeldung nach Linkmeldung | 3 | Der Status wird intern gesetzt, aber nicht gerendert; Nutzer sehen weder Erfolg noch Fehler. | Sichtbarer Toast/Inline-Status mit `aria-live`, Retry bei Fehler und eindeutiger Produktbezug. |
| [x] | STACK-24 | Produkt bearbeiten/entfernen | 8 | Aktionen sind groß genug und Entfernen wird bestätigt. | Sichtbare Labels im Aktionsmenü; Fokus nach Entfernen sinnvoll setzen. |

### Produkt-hinzufügen-Flow

| Erledigt | ID | Funktion/Text | ★ | Befund | Zielbild 10/10 |
|---|---|---|---:|---|---|
| [x] | ADD-01 | Sucheinstieg | 5 | „Wirkstoff suchen“ und „Nach Wirkstoff suchen“ doppeln sich; „Beginnen Sie...“ bricht den Du-Ton. | Ein Titel, Suchlabel „Welchen Wirkstoff möchtest du hinzufügen?“, Hilfe „Tippe z. B. Magnesium oder Vitamin D“. |
| [x] | ADD-02 | Suche/Aliasse | 8 | Suche findet Namen und Aliasse schnell. | Treffer erklären, Tastaturnavigation/Ergebnisanzahl und Nulltreffer mit Alternativen ergänzen. |
| [x] | ADD-02A | Suchfeld-Semantik | 6 | Pfeiltasten und Abbruch funktionieren, aber vollständiges Combobox-Muster (`role`, `aria-controls`, Ergebnis-/Ladeansage) fehlt. | WAI-ARIA-Combobox vollständig umsetzen und automatisch testen. |
| [x] | ADD-03 | Bereits vorhandener Wirkstoff | 7 | Ein Dialog verhindert Dubletten und bietet Bearbeiten/Produktwechsel. Der Sprung überrascht ohne Vorankündigung. | „Magnesium ist schon über Produkt X enthalten“ plus drei klar beschriebene Optionen. |
| [x] | ADD-04 | Wirkstoffbeschreibung/Form | 7 | Kontext und Form werden gezeigt; „FORM“ wirkt intern. | „Gewählte Form“ und kurze Erklärung, wann Formen relevant sind. |
| [x] | ADD-04A | Wirkungschips im Dialog | 4 | Die alte Keyword-Heuristik und ungeprüfte Wirkungschips wurden vollständig aus dem kaufnahen Dialog entfernt. | Wirkstoffeinordnung bleibt zentral in `/wissen`; im Hinzufügen-Flow keine Gesundheitswirkung ohne belegten Claim- und Mengen-Guard anzeigen. |
| [x] | ADD-04B | Fehlender Beschreibungstext | 4 | 35 von 92 aktiven Wirkstoffen haben keine `ingredients.description`; der Fallback behauptet pauschal einen DGE-/Studienvergleich, auch wenn Werte fehlen. | Neutralen zentralen Displaytext oder „Noch kein Kurztext verfügbar“ zeigen; DGE/Studien nur nennen, wenn tatsächlich vorhanden. |
| [x] | ADD-05 | „DGE Empfehlung“ | 4 | Kann als Supplementdosierung verstanden werden. Gesamtzufuhr, Zielgruppe und Quelle sind nicht deutlich genug abgegrenzt. | „DGE-Referenzwert für die gesamte tägliche Zufuhr“; Erklärung „kein automatischer Bedarf aus einem Supplement“, Quelle/Stand/Zielgruppe. |
| [ ] | ADD-06 | „Studien-Referenz“ | 3 | Eine einzelne Menge plus „Referenz übernehmen“ wirkt wie eine allgemeine Empfehlung; Studiendesign und Grenzen fehlen. | „In dieser Studie untersuchte Menge“ mit Population, Dauer, Form und Ergebnisgrenze; nicht ungeprüft als persönliche Menge übernehmen. |
| [x] | ADD-07 | „Empfehlung übernehmen“ | 3 | Handlungswort verstärkt medizinische Empfehlung. | „Als Planungswert einsetzen“ erst nach sichtbarer Einordnung; besser eigene Menge bewusst bestätigen lassen. |
| [x] | ADD-08 | Geplante Tagesmenge | 7 | Nutzer kann rechnen lassen, Zweck wird knapp erklärt. | „Mit welcher Menge möchtest du planen?“ und klar sagen, ob Gesamtwirkstoff- oder Produktmenge gemeint ist. |
| [x] | ADD-09 | DGE-Prozenthinweis | 5 | Prozent ist nützlich, aber ohne Einordnung zu Ernährung, Obergrenze oder fehlendem Referenzwert. | Neutraler Vergleich, keine Ampel; Datenart, Zielgruppe und ggf. obere sichere Zufuhr separat erklären. |
| [x] | ADD-10 | Ziel-Stack | 8 | Ziel wird vor Produktauswahl festgelegt und Folge genannt. | Stackname im finalen Button wiederholen. |
| [x] | ADD-11 | Produktauswahl | 7 | Packungs- und Monatskosten, Inhalt und Dosierung sind sichtbar. Vergleich, Sortierung und Unterschiede fehlen. | Vergleichsansicht, Filter/Form, transparente Standardreihenfolge und Button „X zu Stack Y hinzufügen“. |
| [x] | ADD-12 | Eigenes Produkt | 7 | Direkter Weg vorhanden; in Demo verständlicher Registrierungsdialog. | Entwurf des aktuellen Wirkstoffs/Stacks beim Wechsel erhalten und nach Produkterstellung fortsetzen. |
| [x] | ADD-13 | Produkt bearbeiten | 4 | „Fallback“, „Timing“ und „Einnahmeintervall in Tagen“ sind technische Sprache. | „Menge pro Einnahme“, „Wann nimmst du es?“ und Auswahl „täglich / alle X Tage / eigener Rhythmus“; automatische Berechnung verständlich zeigen. |
| [x] | ADD-14 | Stack bearbeiten | 5 | Name/Beschreibung klar; „Familienprofil“ zeigt teilweise nur „Eigener Stack“ und wirkt wie eine tote Funktion. | Feld ausblenden, wenn keine echte Auswahl besteht; sonst Zweck und Auswirkung erklären. |

## 9. Einnahmeplan `/einnahmeplan`

| Erledigt | ID | Funktion/Text | ★ | Befund | Zielbild 10/10 |
|---|---|---|---:|---|---|
| [x] | PLAN-01 | Seiteneinstieg | 6 | Stackname ist H2, ein Seiten-H1 fehlt; bei Gästen erscheint Demoinhalt ohne klare öffentliche Landing-Erklärung. | H1 „Dein Einnahmeplan“, aktiven Stack wählen können und private App klar von öffentlicher Erklärung trennen. |
| [x] | PLAN-02 | Tageszeit-Gruppen | 4 | `morning_evening` erscheint nur morgens; `with_meal` wird pauschal mittags einsortiert. Dadurch können gespeicherte Einnahmezeitpunkte fehlen oder falsch wirken. | Mehrfachtermine in beiden Zeitfenstern zeigen; „zum Essen“ nicht eigenmächtig einer Uhrzeit zuordnen; Original-Timing sichtbar halten. |
| [x] | PLAN-03 | Produktzeile | 7 | Menge, Rhythmus, Monatskosten und Reichweite zusammen sichtbar. Bindestriche und „EUR/Monat“ wirken roh. | Typografisch trennen, `€/Monat`, fehlende Werte erklären, Creator-Hinweis optional anzeigen. |
| [x] | PLAN-04 | Stack mailen | 2 | Sofortversand ohne Ziel-/Inhaltsbestätigung; Creatorname und persönliche Hinweise fehlen in der Mail. | Bestätigungsdialog, Account-Adresse, Inhalt und Datenschutzfolge; Creator/Snapshot/Disclaimer in Mail übernehmen. |
| [x] | PLAN-05 | Drucken/PDF | 7 | Funktion vorhanden und verständlich genug. | „Drucken oder als PDF speichern“, Druckkopf, Datum, Creatorherkunft und Hinweistext. |
| [x] | PLAN-06 | Leere Gruppen | 8 | „Keine Produkte“ ist eindeutig. | Leere Gruppen optional einklappen, ohne Tagesstruktur zu verlieren. |

## 10. Creator-Bereich `/creator`

| Erledigt | ID | Funktion/Text | ★ | Befund | Zielbild 10/10 |
|---|---|---|---:|---|---|
| [x] | CRE-01 | Navigation „Für Creator“ | 10 | Stabiler Einstieg mit getrenntem Lade-, Fehler- und Zugangszustand; berechtigte Nutzer behalten den Menüpunkt. | Erfüllt. |
| [x] | CRE-02 | Nicht freigeschalteter Zugang | 10 | Verständliche Zugangsseite mit Status, Kontaktweg und Rückweg zu den Stacks; kein erfundener Prüfstatus. | Erfüllt. |
| [x] | CRE-03 | Ladefehler | 10 | Berechtigungs- und Ladefehler sind getrennt, zugänglich angesagt und erneut ladbar. | Erfüllt. |
| [x] | CRE-04 | Seiteneinstieg „Empfehlungen teilen“ | 10 | Stack, Einzelprodukt, Prüfung, Portfolio und nächster Schritt werden klar erklärt; keine erfundene Prüfdauer. | Erfüllt. |
| [x] | CRE-05 | Creator-/Markenwechsel | 10 | Rolle ist sichtbar; Partei wird sicher in URL/Session gemerkt und Entwürfe bleiben getrennt. | Erfüllt. |
| [x] | CRE-06 | Nur-Lese-Rolle/„Schreibzugriff“ | 10 | Viewer landen automatisch im Nur-Lese-Portfolio; Bearbeitungsformular und Senden bleiben verborgen. | Erfüllt. |
| [x] | CRE-07 | Drei Aufgaben-Karten | 10 | Zugängliche Tabs besitzen einen eindeutigen aktiven Zustand; URL, Tastatur und Browser-Zurück bleiben synchron. | Erfüllt. |
| [x] | CRE-08 | Stack-Auswahl | 10 | Auswahl, Direktlink, Lade-/Retry-Zustand und exakter Entwurf bleiben bei Navigation und Rückkehr erhalten. | Erfüllt. |
| [x] | CRE-09 | Nicht teilbarer Stack | 10 | Pro betroffenem Produkt erscheint ein verständlicher Grund mit passendem Reparaturweg; Einzelprodukte werden getrennt bewertet. | Erfüllt. |
| [x] | CRE-10 | Fehlendes Originalprodukt | 10 | Fehlend und momentan nicht teilbar werden korrekt unterschieden; kein stiller Ersatz, gezielter Reparaturweg. | Erfüllt. |
| [x] | CRE-11 | Name der Empfehlung | 10 | Beispiel, Zeichenzähler, Zielort und Vorschau sind sichtbar. | Erfüllt. |
| [x] | CRE-12 | „Dein Hinweis (optional)“ | 10 | Alltagssprache, Beispiele, Zeichenzähler und automatisch isolierte Entwurfssicherung sind vorhanden. | Erfüllt. |
| [x] | CRE-13 | Vorschau | 10 | Snapshot-Reihenfolge, Bilder, Produktidentität und verständlicher Einnahmezeitpunkt werden kategoriefrei gezeigt; ungeprüfte Wirkungsclaims bleiben entfernt. | Erfüllt gemäß Owner-Entscheidung: keine Rückkehr von Kategorien und keine Gesundheitswirkung im kaufnahen Produktkontext. |
| [x] | CRE-14 | „Zur Prüfung senden“ | 10 | Bestätigung erklärt Prüfung, Portfolio und Überarbeitungsweg; In-App-Status ist verbindlich, Mail nur ergänzend. | Erfüllt ohne erfundene Prüfdauer oder Zustellgarantie. |
| [x] | CRE-15 | Moderationsrückmeldung | 10 | Grund, betroffene Stelle beziehungsweise Produkt und direkter Deep-Link zum Ansehen oder Überarbeiten sind vorhanden. | Erfüllt; E-Mail-Versuch ist idempotent protokolliert. |
| [x] | CRE-16 | Statusbezeichnungen | 10 | Prüfung, Freigabe, Ablehnung, Pause, Ende und Ablauf samt Folgen und Ablaufdatum sind verständlich getrennt. | Erfüllt. |
| [x] | CRE-17 | Portfolio | 10 | Serverseitige Suche, Statusfilter, Sortierung, Archiv und Cursor-Pagination sind integriert. | Erfüllt. |
| [x] | CRE-18 | Kennzahlen | 10 | Erfasste eindeutige Besuche werden zustimmungsgebunden, dedupliziert, zeitlich definiert und mit Vorperiode erklärt. | Erfüllt; Untererfassung wird transparent benannt. |
| [x] | CRE-19 | Dashboard | 10 | 30-Tage-Karten und Trend zeigen Besuche, Klicks, Speicherungen sowie Produkte und zuordenbare Shops mit festen Definitionen. | Erfüllt. |
| [x] | CRE-20 | Link kopieren/öffnen | 10 | Sichtbare URL, Kopierstatus, manueller Fallback, neues Tab und natives Teilen sind vorhanden. | Erfüllt. |
| [x] | CRE-21 | Link beenden | 10 | Ein Dialog erklärt Pause, Fortsetzen, Ablauf und endgültiges Beenden; abgelaufene Links bleiben terminal. | Erfüllt. |
| [x] | CRE-22 | Überarbeiten/neu erstellen | 10 | Moderationsgrund, Vorbefüllung, veralteter-Stand-Guard sowie exakter Reparatur- und Rückweg sind vorhanden. | Erfüllt. |
| [x] | CRE-23 | Vorschau-Race | 10 | Verspätete Antworten werden durch Request-Identität verworfen und können keine neuere Vorschau überschreiben. | Erfüllt. |
| [x] | CRE-24 | Entwurf bei Reparatur | 10 | Entwürfe sind je Nutzer, Partei, Aufgabe, Stack, Produkt und Ausgangsempfehlung isoliert und werden exakt wieder geöffnet. | Erfüllt. |
| [x] | CRE-25 | Verteilung | 10 | Kopieren, Öffnen, natives Teilen, WhatsApp und E-Mail sind verfügbar. | Erfüllt; bewusst keine zusätzliche produktbezogene Affiliate-Kennzeichnung. |

Abnahme 16.08.2026: User-/Creator-Review `PASS`; technischer Delta-Review
nach den Migrations- und Write-Guard-Korrekturen `PASS`. Kategorien und
produktbezogene Affiliate-Kennzeichnungen bleiben gemäß Owner-Entscheidung
entfernt; die einzige sichtbare Affiliate-Erklärung ist der globale Hinweis.

## 11. Öffentlicher Share und Import `/share/:token`

| Erledigt | ID | Funktion/Text | ★ | Befund | Zielbild 10/10 |
|---|---|---|---:|---|---|
| [x] | SHARE-01 | Kopfzeile | 8 | Creator, Titel und Datum sind klar; ein freiwillig gepflegtes, sicher geprüftes Profilbild erscheint optional. | Kein Profil oder Vertrauensmerkmal erfinden, solange dafür kein autoritatives öffentliches Datenfeld existiert. |
| [x] | SHARE-02 | Snapshot-Erklärung | 9 | Stand und spätere Änderungen werden vorbildlich erklärt. | Nur typografisch kompakt halten. |
| [x] | SHARE-03 | Produktidentität | 5 | Vorhandenes Bild, Marke, Name und persönliche Nutzung werden gezeigt; Kategorien und ungeprüfte Wirkungsclaims bleiben entfernt. | Ausschließlich vorhandene Produkt-/Nutzungsdaten zeigen; Wirkstoffeinordnung bleibt in `/wissen`. |
| [x] | SHARE-04 | Persönliche Nutzung | 8 | Menge, Häufigkeit und Zeitpunkt werden getrennt. Doppelte Mengenangaben sind möglich. | Eine eindeutige Zusammenfassung; fehlende Einheit als Datenproblem sichtbar machen. |
| [x] | SHARE-04A | Zeitpunkt-Übersetzung | 4 | Die öffentliche Vorschau kann interne Werte wie `before_breakfast` ungefiltert anzeigen. | Zentrale Timing-Übersetzung nutzen; unbekannte Schlüssel als „Keine Angabe“, nie roh ausgeben. |
| [x] | SHARE-05 | Dosierungsabgrenzung | 9 | Persönliche Nutzung wird klar von Dosierungsanweisung getrennt. | Beibehalten. |
| [x] | SHARE-06 | Creator-Hinweis | 8 | Sämtliche vorhandenen Aussagen stehen dedupliziert in genau einem allgemeinen, klar dem Creator zugeordneten Hinweisblock. | Keine erfundene Zuordnung zu einzelnen Produkten und keine wiederholten Kartenhinweise. |
| [x] | SHARE-07 | Langer Stack | 5 | Lange Empfehlungen sind in nummerierte 8er-Abschnitte mit Inhaltsübersicht und Sprunglinks gegliedert. | Kategorien bleiben gemäß Owner-Entscheidung entfernt. |
| [x] | SHARE-08 | Nicht verfügbares Produkt | 6 | Transparenter Ersatztext, aber Importfolge bleibt unklar. | Explizit erklären, was gespeichert wird und was fehlt. |
| [x] | SHARE-09 | Vor Anmeldung nichts speichern | 9 | Grenze und zwei Wege sind sehr klar. | CTA um Rückkehrversprechen ergänzen. |
| [x] | SHARE-10 | Passwort-Reset-Rückweg | 3 | Rückkehr zur Empfehlung geht verloren. | Siehe AUTH-04; Ende-zu-Ende-Test ergänzen. |
| [x] | SHARE-11 | Lokaler Importentwurf | 7 | Minimal, tokengebunden, 30 Minuten. Nutzer kennt Speicherung/Ablauf nicht. | Kurz erklären, abgelaufene Entwürfe aktiv aufräumen und Datenschutztext verlinken. |
| [x] | SHARE-12 | Zielwahl | 8 | Neuer/bestehender Stack und Folgen sind verständlich. Radio-Layout erbt globale 100-%-Breite. | `fieldset/legend`, kompakte Radios und Auswahlkarten. |
| [x] | SHARE-13 | Stack-Ladefehler | 8 | Retry blockiert korrekt die Prüfung. | `role=alert`, Fokus auf Fehler/Retry. |
| [x] | SHARE-14 | „Auswahl prüfen“ | 6 | Sicherheitsstufe sinnvoll, aber Schaltfläche kaum gestaltet. | Primärbutton „Änderungen ansehen“ mit klarer Folge. |
| [x] | SHARE-15 | Gleicher Stackname | 9 | Neutral statt Fehler, Alternativname angeboten. | Beibehalten. |
| [x] | SHARE-16 | Ähnliche Produkte | 8 | Kein bedrohliches Konfliktwort; gemeinsame Wirkstoffe sichtbar. | „Ähnlich heißt nicht gleich“ und unterschiedliche Werte hervorheben. |
| [x] | SHARE-17 | Produktvergleich | 8 | Menge, Rhythmus, Zeitpunkt und Notiz nebeneinander. | Abweichungen visuell markieren; barrierefreie Textzusammenfassung. |
| [x] | SHARE-18 | Behalten/Ersetzen | 6 | Folge ist erklärt, Buttons sind visuell schwach. | Große Auswahlkarten; erklären, warum „beide“ fehlt oder sichere Option anbieten. |
| [x] | SHARE-19 | „Das passiert beim Bestätigen“ | 10 | Konkrete, einfache Sprache und vollständige Folgen. | Als Muster für andere Bestätigungen verwenden. |
| [x] | SHARE-20 | „Jetzt bestätigen“ | 6 | Zu allgemein und schwach gestaltet. | Dynamisch „Stack mit 3 Produkten anlegen“ oder „Produkt X ersetzen“. |
| [x] | SHARE-21 | Schreibsicherheit | 9 | Fingerprint, Snapshot-/Versionsguard und Idempotenz verhindern Doppelwrites. | Technische Details weiterhin unsichtbar halten; automatisiert überwachen. |
| [x] | SHARE-22 | Ergebnis „Alles erledigt“ | 8 | Exakte Folge wird genannt. | Primäraktion hervorheben und Undo mit kurzer Frist. |
| [x] | SHARE-23 | „Stack jetzt ansehen“ | 3 | Ziel-ID wird von `/stacks` nicht verarbeitet. | Siehe STACK-04. |
| [x] | SHARE-24 | „Bei der Empfehlung bleiben“ | 5 | Unklar, was passiert. | „Empfehlung weiter ansehen“ oder „In einen weiteren Stack speichern“. |
| [x] | SHARE-25 | Rückgängig machen | 4 | Nach Ersetzen fehlt Undo. | Guarded Undo mit klarer Frist und exakter Änderungsübersicht. |
| [x] | SHARE-26 | Ablauf/Recovery-Texte | 9 | Ausstehend, abgelaufen, beendet/gesperrt und unbekannt sind klar getrennt. | Beibehalten; Statuscodes/Metadaten technisch korrigieren. |
| [x] | SHARE-27 | Recovery-Kopieraktion | 5 | Funktion vorhanden, live nur etwa 24 px hoher transparenter Textbutton. | Vollwertiger 44-px-Button, `role=status`, auswählbarer Textfallback. |
| [x] | SHARE-28 | Meldemöglichkeit | 4 | Irreführende/veraltete Empfehlung kann öffentlich nicht gemeldet werden. | Niedrigschwelliger Meldeweg mit Kategorie, Bestätigung und Moderationsprozess. |
| [x] | SHARE-29 | Dynamische Barrierefreiheit | 6 | Teilweise gute Labels; Fokuswechsel, Live-Regionen, `aria-expanded` und Legends fehlen. | Schrittweisen Fokusplan, Live-Status und komplette Tastaturmatrix umsetzen. |
| [x] | SHARE-30 | Creatorherkunft in Mail/PDF | 4 | Website behält Herkunft/Hinweis; Stack-Mail verliert beide. | Creatorname, Snapshot-Datum und persönliche Hinweise in Mail/PDF übernehmen. |

Abnahme 17.08.2026: User-/Creator-Delta-Review, technischer Review und
Claim-Grenzen-Review jeweils `PASS`. Der 10-Minuten-Undo ist transaktional
guarded; Meldungen sind idempotent und bei unklarem Ausgang exakt
wiederholbar. Kategorien, produktspezifische Affiliate-Texte und ungeprüfte
Wirkungsclaims bleiben aus der öffentlichen Produktempfehlung entfernt.

## 12. Wissensübersicht `/wissen`

| Erledigt | ID | Funktion/Text | ★ | Befund | Zielbild 10/10 |
|---|---|---|---:|---|---|
| [x] | KNOW-01 | Hero/Erklärung | 8 | Nutzerziel und Quellenbezug sind klar. Bindestrich statt Gedankenstrich und einige sehr absolute Kurztexte. | Typografie korrigieren; sachlich „Was bekannt ist, wo es vorkommt und welche Grenzen gelten“. |
| [x] | KNOW-02 | Suche | 9 | Direkt, URL-basiert, Aliasse werden berücksichtigt. | Ergebnisanzahl, Escape/Löschen per Tastatur und Suchvorschläge bei Nulltreffern. |
| [x] | KNOW-03 | Kategorienfilter | 8 | Schnell scanbar und mobil ohne Überlauf. Aktiver Zustand ist visuell, nicht immer semantisch. | `aria-pressed`, Trefferzahl live und Filterparameter kanonisch behandeln. |
| [x] | KNOW-04 | Kennzahlen 89/10/44 | 5 | Frontend zählt 89 fest codierte Einträge, zentrale API aktuell 92 aktive Wirkstoffe. | Zählung und Karten vollständig aus der kanonischen API; keine zweite Wirkstoffliste. |
| [x] | KNOW-05 | Hardcodierte `NUTRIENTS`-Daten | 3 | Namen, Kategorien, Aliasse und Kurztexte werden doppelt gepflegt; dadurch fehlen Molybdän, Natrium und Phosphor. | API/DB als einzige Quelle; reine Präsentationsattribute nur stabil per Ingredient-ID ergänzen. |
| [x] | KNOW-06 | Verfügbare Artikelkarten | 8 | Name, Kurztext, Löslichkeit, Studien/DGE und CTA sind gut scanbar. | Schriftgrößen erhöhen und Statusbegriffe mit Erklärung/Tooltip ergänzen. |
| [x] | KNOW-07 | „Bald“-Karten | 4 | Fokusierbarer `role=button`, aber deaktiviert und ohne Aktion – fühlt sich kaputt an. | Nichtinteraktive Karte mit „Artikel in Vorbereitung“ oder echte Benachrichtigungsfunktion. |
| [x] | KNOW-08 | 89 Wirkstoff-Kurztexte | 5 | Uneinheitlich: teils klar, teils jargonlastig oder unbelegt („vaskuläre Relevanz“, „Immunfokuslage“, „Traditionelle Leberbegleitwirkung“). | Zentral freigegebene, einfache und claim-sichere Kurztexte; keine Wirkung erfinden. Siehe Copy-Register. |
| [x] | KNOW-08A | Sichtbare Sprach-/Encodingfehler | 3 | Beispiele: „Pflanzlicher Stoffstoff“, „Bedeutet als Cofaktor“, „Schlaf- und Rhythmusrhythmus“; die Chrom-Zusammenfassung enthält sichtbare `?` in Wörtern wie „N?hrstoff“. | Zentralen Redaktionspass und UTF-8-/Ersatzzeichen-Gate vor Veröffentlichung; betroffene Daten korrigieren. |
| [x] | KNOW-09 | Fehler/Leerzustand | 6 | Verständlicher Text, aber kein Retry; Fehler und Nulltreffer können gleichzeitig erscheinen. | Zustände exklusiv, Retry, `role=alert`, Such-/Filterreset direkt anbieten. |
| [x] | KNOW-10 | Mobile Textgröße | 5 | 128 sichtbare Elemente unter 12 px. | Labels und Badges mindestens 12 px, wichtige Inhalte 14–16 px; Reflow prüfen. |

## 13. Wissensartikel `/wissen/:slug`

Abschluss 5. September 2026: ARTICLE-01 bis ARTICLE-10 sind implementiert,
unabhängig technisch freigegeben und produktiv geprüft (PR #25, Deployment
33984550402). Alle sechs konkreten Schreibkorrekturen und die BfR-Korrektur
sind veröffentlicht und per API, Roh-HTML und Browser verifiziert. Die
ursprünglichen Bewertungen unten bleiben als Audit-Ausgangslage erhalten.
Einzelheiten, Abschlussbelege und nicht blockierende Folgebeobachtungen:
[`umsetzung_wissensartikel_audit.md`](umsetzung_wissensartikel_audit.md).

| Erledigt | ID | Funktion/Text | ★ | Befund | Zielbild 10/10 |
|---|---|---|---:|---|---|
| [x] | ARTICLE-01 | Rückweg „Zurück“ | 6 | Ziel ist die Übersicht mit Filtern, Text ist aber unspezifisch. | „Zur Wissensübersicht“ und bei erhaltenem Filter dessen Namen ankündigen. |
| [x] | ARTICLE-02 | Hauptartikel-Hero | 9 | Titel, Zusammenfassung, Wirkstoff, Prüfdatum und Lesezeit sind stark. | Teilen/Speichern, Aktualisierungsgrund und verantwortliche Redaktion ergänzen. |
| [x] | ARTICLE-03 | Inhaltsverzeichnis/Fortschritt | 9 | Sticky Navigation, aktive Sektion und Fortschritt helfen langen Artikeln. | Mobil kompakte aufklappbare Inhaltsübersicht und „Nach oben“-Aktion. |
| [x] | ARTICLE-04 | „Auf einen Blick“/Abschnitte | 9 | Sehr scanbar und gute semantische Struktur nach Hydrierung. | Kernaussagen konsequent an Quellen/Unsicherheit binden. |
| [x] | ARTICLE-05 | FAQ | 9 | Akkordeons besitzen `aria-expanded` und Regionen. | Fokus/Deep-Link je Frage und „alle öffnen“ nur bei echtem Bedarf. |
| [x] | ARTICLE-06 | Quellen | 9 | Interne Stage-2-Carrier und sichtbare Quellen sind nachvollziehbar. | Quellenanzahl bereits im geschlossenen Zustand stärker erklären; keine doppelten Links. |
| [x] | ARTICLE-07 | Studien-/Quellenseite | 8 | Ergebnisse, Grenzen und Quellen sind strukturiert; Rückbezug zum Hauptartikel ist zu schwach. | Sichtbarer „Einordnung zu Wirkstoff X“-Rücklink und verwandte Evidenznavigation. |
| [x] | ARTICLE-08 | Lade-/Fehlerzustand | 5 | Text verständlich, aber unbekannter Slug bleibt technisch ein 200-Shell; kein direkter Übersicht-/Suchweg. | Echter 404/410, H1, Übersichtssuche und relevante Artikel. |
| [x] | ARTICLE-09 | Verwandte Inhalte/Teilen | 4 | Kein klarer Bereich für verwandte Artikel, nächste Schritte oder Teilen. | Claim-sichere verwandte Inhalte aus zentralen Relationen, Copy-Link/Share und Rückkehr zum Stack-Kontext. |
| [x] | ARTICLE-10 | SSR-Semantik | 6 | Hydrierte Seite ist gut; serverseitig erscheint Text weitgehend als einfacher Block. | H2/H3, Listen, Tabellen und Links bereits im Roh-HTML semantisch ausgeben. |

### Volltextprüfung aller 790 veröffentlichten Wissensseiten

Für jede Sitemap-Seite wurden Titel, Zusammenfassung, Haupttext und Fazit über
die öffentliche API vollständig geladen. Der Text-UX-Wert im Inventar ist eine
reproduzierbare Erstbewertung aus Lesbarkeit, Satzlänge, sichtbaren
Encodingfehlern und ungerenderten Platzhaltern. Er ersetzt keine fachliche
Redaktionsprüfung: wissenschaftliche Eigennamen und unverändert zu führende
Quellentitel können den Lesbarkeitswert senken, obwohl sie inhaltlich korrekt
sind. Bei der Abarbeitung folgt deshalb auf den automatischen Hinweis immer ein
redaktioneller Review des einzelnen Artikels.

| Text-UX | Seiten | Einordnung und Weg zu 10/10 |
|---:|---:|---|
| 4 | 6 | Sofort korrigieren: fünf Seiten enthalten sichtbare Encodingfehler; die BfR-Vitamin-D-Seite hat zusätzlich besonders schwere Satzstrukturen. Danach fachlicher Einzelreview und Publication-Gate. |
| 5 | 34 | Sehr schwer lesbar oder durch einen sichtbaren Encodingfehler belastet. Kurze Einordnung vor Fachdetails, Sätze teilen und Begriffe direkt erklären; Quellenbedeutung unverändert lassen. |
| 6 | 118 | Verständlichkeit noch zu fachsprachlich. Pro Absatz eine Kernaussage, Abkürzungen erklären und lange Nominalketten auflösen. |
| 7 | 487 | Solide Fachtexte mit lokalem Vereinfachungspotenzial. Kernaussagen, Grenzen und Alltagsbedeutung schneller auffindbar machen. |
| 8 | 141 | Gut verständlich; nur einzelne lange Sätze oder Fachbegriffe glätten. |
| 9 | 4 | Sehr gut verständlich; nach fachlichem und visuellem Review auf 10/10 anheben. |

Readback: 790/790 Artikel waren erreichbar, 44 Hauptartikel und 746
Studien-/Quellenseiten; 0 fehlende Abschnittsstruktur, 0 Artikel ohne
Quellenarray und 0 ungerenderte `undefined`-/`NaN`-Werte. Der mediane
heuristische deutsche Lesbarkeitswert liegt bei 38 und bestätigt, dass einfache
Sprache trotz vollständiger Quellenbindung ein eigener Arbeitsschwerpunkt ist.

| Erledigt | Pfad | ★ | Sichtbarer Fehler | Zielbild 10/10 |
|---|---|---:|---|---|
| [x] | `/wissen/chrom` | 4 | `N?hrstoff`, `ungew?hnlich`, `Sch?tzwerte`, `w?hrend`, `f?r`, `pers?nlicher` | Originalzeichen guarded wiederherstellen, gesamten Artikel auf weitere Schäden prüfen und öffentlich byte-/DOM-verifizieren. |
| [x] | `/wissen/jod-fruehe-schwangerschaft-intelligenz-2026` | 5 | `pers?nliche` | `persönliche` aus der gebundenen Quelle wiederherstellen und Zielartikel-Readback. |
| [x] | `/wissen/jod-who-monitoring-uic-salzjodierung` | 4 | `f?r`, `Schilddr?senmarker`, `Jodmangelst?rungen` | Umlaute guarded wiederherstellen; WHO-Aussagen und Quellenlabel unverändert bewahren. |
| [x] | `/wissen/kupfer-zink-prothesenhaftcreme-jamal` | 4 | `j?hrigen`, `?berm??igem`, `Blutbildver?nderungen` | Umlaute im gesamten Artikel wiederherstellen; Fallbericht nicht verallgemeinern. |
| [x] | `/wissen/mangan-pn-blutspiegel-abdalian` | 4 | `Ern?hrung`, `?ber` | Umlaute im gesamten Artikel wiederherstellen und Quellenbezug readbacken. |
| [x] | `/wissen/saccharomyces-boulardii-chen-hpylori-bismuth-quadruple-meta-2024` | 4 | `ver?ffentlichten`, `b?ndelte`, `unerw?nschten` | Umlaute guarded wiederherstellen; Zahlen, Design und Grenzen bytegleich bewahren. |

Alle 790 individuellen Text-UX-Werte stehen in Abschnitt 21. Der niedrigste
nicht durch Encoding verursachte Wert betrifft
`/wissen/vitamin-d-bfr-hoechstmengen` mit 4/10; hier ist ein fachlich
kontrollierter Lesbarkeitsdurchgang statt einer rein mechanischen Kürzung nötig.
Dieser Durchgang ist am 5. September 2026 als normaler artikelbegrenzter
L-v2-Slice mit unabhängigen Facts-/Publication-Gates abgeschlossen und live.

## 14. Rechtstexte und Fehlerseite

Abgeschlossen am 6. September 2026: LEGAL-01–05 und ERR-01/02 produktiv
veröffentlicht und live geprüft (PR #26, Deployment `34054531443`).
Details und Nachweise: [`umsetzung_rechtstexte_fehlerseite_audit.md`](umsetzung_rechtstexte_fehlerseite_audit.md).
Die ursprünglichen Sterne/Befunde dokumentieren weiterhin die Audit-Ausgangslage.

| Erledigt | ID | Funktion/Text | ★ | Befund | Zielbild 10/10 |
|---|---|---|---:|---|---|
| [x] | LEGAL-01 | Impressum | 9 | Klar, vollständig gegliedert und Kontakt anklickbar. | Änderungsstand anzeigen; Affiliate-Abschnitt mit globaler Formulierung konsistent halten. |
| [x] | LEGAL-02 | Datenschutz | 6 | Inhaltlich ausführlich, aber sehr technisch (D1/KV/R2, TTL, Art.-Ketten) und ohne Kurzüberblick. | Oben „Kurz erklärt“ mit Daten/Zweck/Dauer/Rechten, darunter vollständige Rechtsfassung; Stand anzeigen. |
| [x] | LEGAL-03 | Nutzungsbedingungen | 7 | Gut gegliedert. Notfall- und Haftungstexte wirken für eine Verwaltungsapp wiederholt/streng. | Kurze Alltagssummary, vollständige Fassung darunter; medizinische Grenze einmal präzise statt mehrfach alarmistisch. |
| [x] | LEGAL-04 | Dynamische Rechtsdokumente | 5 | API-Inhalt kann statischen Text nachträglich ersetzen; `updated_at` wird nicht gezeigt, Inline-Markdown nur teilweise gerendert. | Eine nachvollziehbare Quelle, Version/Stand sichtbar, vollständiger sicherer Markdownrenderer und kein inhaltlicher Layoutsprung. |
| [x] | LEGAL-05 | `/agb` | 4 | Identischer Inhalt parallel zu `/nutzungsbedingungen`. | Permanente 301/308-Weiterleitung auf den kanonischen Pfad. |
| [x] | ERR-01 | Visuelle 404-Seite | 8 | Freundlich und klarer Startseitenlink. | Zusätzlich Wissen/Stacks anbieten und gesuchten Pfad nicht wiederholen, wenn tokenhaltig. |
| [x] | ERR-02 | Technischer 404-Status | 2 | Beliebige Pfade liefern HTTP 200 und generische Metadaten. | Echter 404, `noindex`, eigener Titel und serverseitiger H1. |

## 15. Copy-Register: verbindliche einfache Sprache

Die ersten acht Zeilen sind am 6. September 2026 abgeschlossen und produktiv
geprüft (PR #27, Deployment `34061348653`). Details und Nachweise:
[`umsetzung_copy_register_01_08.md`](umsetzung_copy_register_01_08.md).
Die übrigen 58 Registerzeilen sind am 7. September 2026 vollständig abgeschlossen
und live geprüft (PR #28 sowie enger Auslieferungsfix PR #29, finales Deployment
`34119841030`). Zeilenbezogene Nachweise und begründete Aktualisierungen alter
Auditannahmen: [`umsetzung_copy_register_09_66.md`](umsetzung_copy_register_09_66.md).

Die Tabelle deckt alle wiederkehrenden oder konkret problematischen
Oberflächentexte ab. Nicht aufgeführte dynamische Produkt-, Creator- und
Artikelinhalte werden nicht frei umgeschrieben, sondern müssen aus ihrer
kanonischen, geprüften Quelle kommen. Medizinische und rechtliche Prosa durchläuft
vor Veröffentlichung weiterhin den jeweils vorgeschriebenen Fach-/Claim-Review.

| Erledigt | Aktuell | Zieltext beziehungsweise Regel |
|---|---|---|
| [x] | „Menü öffnen“ in beiden Zuständen | „Menü öffnen“ / „Menü schließen“ passend zum Zustand. |
| [x] | E-Mail-Adresse als alleiniger Profil-Link | Sichtbar „Mein Profil“, Adresse nur ergänzend/gekürzt. |
| [x] | „Laden...“ | Vorgang benennen: „Deine Stacks werden geladen …“, „Artikel wird geladen …“. |
| [x] | „Unbekannter Fehler“ | „[Vorgang] hat gerade nicht geklappt. Bitte versuche es erneut.“ plus Retry. |
| [x] | Gesundheitsfooter mit „konsultiere“ und führendem `*` | „Diese Inhalte dienen nur zur Orientierung und ersetzen keine medizinische Beratung. Bei Fragen sprich bitte mit ärztlichem oder pharmazeutischem Fachpersonal. Nahrungsergänzungsmittel ersetzen keine ausgewogene Ernährung.“ Kein unreferenziertes Sternchen. |
| [x] | „Analytics-Einwilligung“ | „Optionale Nutzungsanalyse“; ergänzen: „Die App funktioniert auch, wenn du ablehnst.“ |
| [x] | „DGE · EFSA · NIH Quellen“ | „Quellen: DGE, EFSA und NIH“. |
| [x] | „Preis-pro-Portion Vergleich“ | „Kosten pro Einnahme im Vergleich“. |
| [x] | „Kostenlos & ohne Konto nutzbar“ | „Demo ohne Konto ausprobieren“. |
| [x] | „vollständig ausprobieren“, „Alles nutzbar“, „ohne Risiko“ | „Teste Suche, Stack-Aufbau und Kostenübersicht. Speichern, E-Mail und eigene Produkte gibt es nach kostenloser Anmeldung.“ |
| [x] | „neueste Erkenntnisse“ | „Wissensartikel mit Quellen und Prüfdatum“, solange Aktualität nicht anderweitig garantiert wird. |
| [x] | „geprüfte Inhaltsstoffe“ | Nur bei belegtem Prüfvertrag; sonst „erfasste Inhaltsstoffe“. |
| [x] | „Optional: Alter und bevorzugte Quellenpraeferenz koennen spaeter geaendert werden.“ | „Optional – diese Angaben kannst du später im Profil ergänzen.“ |
| [x] | „Leitlinienquelle“ | Falls wirksam: „Welche Quellen möchtest du zuerst sehen?“ Sonst Feld entfernen. |
| [x] | „Influencer“ als Quellenoption | Einheitlich „Creator-Empfehlungen“; nicht als Leitlinie bezeichnen. |
| [x] | langer Consent mit „DSGVO Art. 9 erforderlich“ | „Ich willige ein, dass Supplement Stack meine Stack-, Produkt- und Einnahmedaten speichert, damit ich die App nutzen kann. Daraus können Rückschlüsse auf meine Gesundheit möglich sein. Mehr dazu im Datenschutz.“ Details aufklappbar. |
| [x] | „Rolle: user/creator“ | Ausblenden oder „Kontotyp: Standardkonto/Creator“. |
| [x] | „Meine Supplement Stacks“ | „Meine Stacks“. |
| [x] | „1 Produkte“ | Zentrale Pluralisierung: „1 Produkt“, „2 Produkte“. |
| [x] | Screenreaderlabels mit `waehlen` | Echtes UTF-8: „wählen“. |
| [x] | Sortierung „Eigene“ | „Manuell“. |
| [x] | Kategorien „Keine“ / „Eigene“ | „Ohne Gruppen“ / „Meine Gruppen“. |
| [x] | amber „Creator-Stack von …“ | Neutrale Infobox: „Ursprünglich empfohlen von {Name}. Du kannst diesen Stack selbst anpassen.“ |
| [x] | unerklärte Auswahl | „Nur ausgewählte Produkte zählen in die Kostenübersicht.“ |
| [x] | doppeltes „Wirkstoff suchen / Nach Wirkstoff suchen“ | Einmal: „Welchen Wirkstoff möchtest du hinzufügen?“ |
| [x] | „Beginnen Sie zu tippen …“ | „Tippe einen Wirkstoff ein, zum Beispiel Magnesium oder Vitamin D.“ |
| [x] | „z.B.“ | Einheitlich „z. B.“. |
| [x] | „FORM“ / unklare „Form“ | „Produktform“ beziehungsweise „Gewählte Form“. |
| [x] | „DGE Empfehlung“ | „DGE-Referenzwert für die gesamte tägliche Zufuhr“. |
| [x] | „Studien-Referenz“ | „In dieser Studie untersuchte Menge“ plus Population, Dauer, Form und Grenze. |
| [x] | „Empfehlung übernehmen“ / „Referenz übernehmen“ | „Als geplante Menge eintragen“, erst nach sichtbarer Einordnung. |
| [x] | „Rund um die DGE Empfehlung“ mit Warnsymbol | Neutral: „Vergleich mit dem DGE-Referenzwert: Deine eingetragene Menge entspricht …“. |
| [x] | Duplikataktionen „Wirkstoffmengen bearbeiten / Produkt ändern / So lassen / Trotzdem …“ | „Einnahme bearbeiten“, „Produkt wechseln“, „Nichts ändern“, „Als zusätzliches Produkt hinzufügen“ – jeweils mit einem Folgensatz. |
| [x] | „Fallback: manuelle Einnahmemenge“ | „Eigene Einnahmeangabe (optional)“. |
| [x] | „Timing“ | „Zeitpunkt“. |
| [x] | „Einnahmeintervall in Tagen“ | „Wie oft nimmst du es?“ mit Presets und optionalem eigenem Abstand. |
| [x] | „Portionen pro Einnahmetag müssen größer als 0 sein.“ | „Trage mindestens 0,1 Portionen pro Einnahme ein.“ |
| [x] | „Familienprofil“ | Nur bei echter Auswahl: „Für wen ist dieser Stack?“ mit erklärter Folge. |
| [x] | „Kategorie X wirklich löschen?“ | „Kategorie ‚X‘ löschen? Die Produkte bleiben erhalten und werden nach ‚Ohne Gruppe‘ verschoben.“ |
| [x] | „Stack wirklich löschen?“ | „Der Stack und seine Zusammenstellung werden gelöscht. Eigene Produkte bleiben unter ‚Eigene Produkte‘ erhalten.“ |
| [x] | „Passend“ ohne Begründung | „Vorgeschlagene Option“ plus sichtbarer Grund oder wertungsfrei „Ausgewählt“. |
| [x] | „unbekannt“ / Strich bei Reichweite | „Nicht berechenbar – Produktangaben fehlen.“ |
| [x] | `/Mo`, `EUR/Monat`, „pro Monat“ gemischt | Einheitlich „… € pro Monat“. |
| [x] | Warnmodal „Warnung / Kurzbeschreibung / Details“ | Nach Schweregrad „Gut zu wissen“, „Wichtig“ oder „Bitte beachten“; „Kurz erklärt“ statt „Kurzbeschreibung“. |
| [x] | „20-30min Abstand zu Kaffee/Tee“ | „20–30 Minuten Abstand zu Kaffee oder Tee“. |
| [x] | „Stack mailen“, „Stack-Mail“, „Stack per E-Mail senden“ | Einheitlich „Einnahmeplan per E-Mail senden“. |
| [x] | Versandbutton ohne Ziel | „An meine Account-Adresse senden“; Zieladresse im Dialog sichtbar. |
| [x] | „Plan drucken/PDF“ | „Drucken oder als PDF speichern“. |
| [x] | Creator „Schreibzugriff“ | „Du kannst die Empfehlungen ansehen, aber nicht ändern. Zum Erstellen oder Beenden brauchst du Bearbeitungsrechte für …“. |
| [x] | „Wird gesendet …“ bei Moderation | „Wird zur Prüfung eingereicht …“. |
| [x] | „Freigabe und Shop-Link“ | Je Produkt konkret: „Shop-Link fehlt“ / „Produkt ist noch nicht freigegeben“. |
| [x] | „1 aktuell freigegebene Links“, „1-mal angesehen/gespeichert“ | „1 freigegebener Link“, „1 Übernahme“; Mehrzahl zentral bilden. Besuche gemäß tatsächlicher Messung als „erfasste eindeutige Besuche“ mit Zustimmungshinweis bezeichnen, nicht als rohe Ansichten. |
| [x] | „über aktive Links gespeichert“ | „in einen Stack übernommen“. |
| [x] | roher Timingwert `before_breakfast` | „Vor dem Frühstück“; alle Werte zentral übersetzen, unbekannt = „Keine Angabe“. |
| [x] | „Du kannst sie danach selbst senden“ | „Füge die kopierte Nachricht anschließend in deinen Messenger oder deine E-Mail ein.“ |
| [x] | „Menge laut Empfehlung“ + „Angabe des Creators“ | Bereich „So nutzt {Name} das Produkt“ mit „Menge“, „Eigene Angabe“, „Wie oft“, „Zeitpunkt“. |
| [x] | „Jetzt bestätigen“ | Dynamisch: „Stack mit 3 Produkten anlegen“, „Produkt hinzufügen“ oder „Produkt ersetzen“. |
| [x] | „Bei der Empfehlung bleiben“ | „Empfehlung weiter ansehen“. |
| [x] | „Das hat gerade nicht geklappt“ | Schritt nennen: „Die Empfehlung konnte nicht geprüft/gespeichert werden.“ |
| [x] | H1 „Co. - einfach erklärt“ | „Alles über Vitamine, Mineralstoffe & Co. – einfach erklärt“. |
| [x] | Suche „Nährstoff suchen - z. B. … ...“ | „Nährstoff suchen – z. B. Vitamin D, Magnesium oder Eisen …“. |
| [x] | „Bald“ | Kein unbelegter Bearbeitungsstatus: Karten ohne Artikel bleiben nichtinteraktiv und ohne „Bald“/„Artikel in Vorbereitung“. |
| [x] | „1 Einträge“ | „1 Eintrag“. |
| [x] | „Pflanzlicher Stoffstoff“, „Bedeutet als Cofaktor“, „Schlaf- und Rhythmusrhythmus“, „Fokuslage“, „Wirkungsdebatten“ | Geprüfte Kurztexte aus der zentralen Quelle; keine lokalen Einzelflicken und gemäß ausdrücklicher Owner-Korrektur keine Systemstatusmeldung als Ersatztext. |
| [x] | Artikel „Zurück“ | „Zur Wissensübersicht“. |
| [x] | Rechtsseiten ohne Datum | „Stand: {Datum}“ aus der kanonischen Dokumentversion. |

## 16. Vollständige SEO-Seitenmatrix

Alle Scores liegen unter 98 und benötigen deshalb die jeweils angegebene
Maßnahme. Die 790 Wissensdetails werden im Seiteninventar am Ende einzeln
aufgeführt.

| Erledigt | Seite/Zustand | Ziel | SEO | Weg auf 100 |
|---|---|---|---:|---|
| [ ] | `/` | indexierbar | 31 | Hero/H1/Nutzen und Hauptlinks serverseitig; eigener Title, Description, Canonical, `index,follow`, OG/Twitter-Bild, `WebSite`/`Organization`/`WebApplication`; Robots erlauben; Sitemap. |
| [ ] | `/wissen` | indexierbar | 38 | Kategorien und 44 Hauptartikel im Roh-HTML; eigener Head; `CollectionPage`/`ItemList`/Breadcrumb; Filter canonicalisieren; Robots und Sitemap. |
| [ ] | `/demo` | indexierbare Produkt-Landingpage | 27 | Stabiler SSR-Introbereich mit H1, Erklärung und Links; eigener Head, OG/Twitter, `WebApplication`; Robots/Sitemap. Interaktive Daten erst hydrieren. |
| [ ] | 44 Hauptartikel | indexierbar | 86 | Separate knappe Meta-Titel/-Descriptions; semantisches SSR; OG-Bild/Twitter; nur ein JSON-LD; Breadcrumb/`about`; ISO-`lastmod`; Edge-Cache; Slash-Redirect. |
| [ ] | 746 Studien-/Quellenseiten | indexierbar | 83 | Wie Hauptartikel; zusätzlich kurzer Meta-Titel neben unverändertem Quellen-H1, sichtbarer Hauptartikel-Rücklink, Evidenznavigation, `citation`/`isPartOf`. |
| [ ] | `/wissen/:slug/` | Alias | 78 | Permanente 301/308 auf Pfad ohne Slash statt parallelem 200. |
| [ ] | `/wissen/:unbekannt` | Fehler | 48 | 404 beziehungsweise 410, `X-Robots-Tag: noindex`, eigener Fehler-Head/H1 und Links zur Übersicht. |
| [ ] | `/stacks` | privat/noindex | 57 | Auth am Edge mit 302/401, `noindex,nofollow`, eigener Titel/H1, `private,no-store`; keine Sitemap. |
| [ ] | `/einnahmeplan` | privat/gemischt | 51 | App-Route noindex/privat mit H1/Titel. Separate öffentliche Erklärseite `/einnahmeplan-erstellen`; keine Nutzerdaten indexieren. |
| [ ] | `/my-products` | privat/noindex | 60 | Serverauth/Noindex, eigener Titel, sichere Shell, `private,no-store`, keine privaten Produktmetadaten. |
| [ ] | `/profile` | privat/noindex | 60 | Wie eigene Produkte; keine persönlichen Werte im Roh-HTML, Referrer-Policy und 401/302. |
| [ ] | `/creator` | privat/noindex | 56 | Dashboard ausdrücklich noindex/privat; optional getrennte, freiwillige öffentliche Creatorprofilroute. |
| [ ] | `/share/:token` gültig | Capability-Link/noindex | 43 | SSR-Share-Shell aus Snapshot; `noindex,nofollow`, kein tokenhaltiges Canonical, `no-referrer`, revokationssicherer Cache; datensparsame dynamische OG/Twitter-Vorschau. |
| [ ] | `/share/:token` ungültig/abgelaufen | Fehler | 35 | 404/410, noindex-Header, neutraler Fehler-Head/H1 und sichere Rückwege. |
| [ ] | `/login` | Utility/noindex | 58 | Crawlbar mit `noindex,follow`, eigener Titel/H1, no-store; `returnTo` nie in Canonical/OG. |
| [ ] | `/register` | Utility/noindex | 57 | Wie Login; eigene Browserdescription, serverseitige Formularsemantik, kein Sitemap-Eintrag. |
| [ ] | `/forgot-password` | Utility/noindex | 57 | Eigener Titel, noindex/no-store, sichere SSR-H1/Formular-Shell. |
| [ ] | `/reset-password` | Tokenroute/noindex | 49 | Token nie in Canonical/OG/Referrer; noindex/no-store; gültig 200, ungültig 400/410; SSR-H1. |
| [ ] | `/verify-email` | Tokenroute/noindex | 54 | Wie Reset; Erfolg/Fehler mit passenden Statuszuständen, keine Tokenweitergabe. |
| [ ] | `/impressum` | Legal/noindex-follow | 58 | Rechtstext/H1 serverseitig, eigener Head, self-canonical, `noindex,follow`; crawlbar, nicht in Sitemap. |
| [ ] | `/datenschutz` | Legal/noindex-follow | 58 | Wie Impressum. |
| [ ] | `/nutzungsbedingungen` | Legal/noindex-follow | 58 | Wie Impressum; kanonisches Ziel der Bedingungen. |
| [ ] | `/agb` | Alias | 42 | 301/308 auf `/nutzungsbedingungen`. |
| [ ] | beliebiges `*` | Fehler | 26 | Echter 404, `noindex`, eigener Title/H1 und hilfreiche Links. |

### Gemessener Zustand der 790 indexierten Wissensseiten

- 790/790 liefern HTTP 200, Roh-HTML-Inhalt, genau einen H1, Title,
  Description, Canonical, `index,follow`, OG-Kern und Article-JSON-LD.
- 0/790 haben serverseitig `og:image`; 0/790 Twitter-Card-Tags.
- 499 Titel sind länger als 60 Zeichen, 248 länger als 70 Zeichen.
- 482 Descriptions sind länger als 160 Zeichen, 370 länger als 180 Zeichen.
- Keine doppelten Titel; drei Description-Dublettenpaare.
- Nur 249 `lastmod`-Werte nutzen ISO-T-Format, 541 SQL-Format mit Leerzeichen.
- Nach Hydrierung stehen doppelte Article-JSON-LD-Blöcke im Head.
- Die Slash-Variante liefert 200 statt permanenter Weiterleitung.

## 17. UX-/SEO-Zielkonflikte und gemeinsame Maximierung

| Konflikt | Schlechte Extrementscheidung | Gemeinsame 10/10-Lösung |
|---|---|---|
| Private App bequem erreichbar vs. nicht indexierbar | Alle App-Seiten per Robots sperren oder persönliche Inhalte indexieren | Öffentliche, serverseitige Erklärseiten und klar getrennte private App-Routen mit Auth, `noindex` und `no-store`. |
| Share-Link schön teilbar vs. Token geheim | Token indexieren oder komplett generische Linkvorschau | Dynamische, datensparsame OG/Twitter-Vorschau aus dem freigegebenen Snapshot, aber `noindex,nofollow`, `no-referrer`, keine Sitemap und sichere Cache-Invalidierung. |
| Creator-Sichtbarkeit vs. Capability-Link | Sharetoken als öffentliches Profil behandeln | Freiwillige kuratierte `/creator/:slug`-Seite separat; `/share/:token` bleibt ephemer/noindex. |
| Wissenschaftlicher Originaltitel vs. kurze Suchdarstellung | H1/Quellenlabel kürzen oder überlange Suchsnippets behalten | Original-H1 und Quellenlabel bytegleich lassen; separates sachlich gleichwertiges `meta_title`/`meta_description`. |
| Wissensfilter vs. Duplicate Content | Jede Query indexieren oder Filter entfernen | UX-Filter behalten; Parameterzustände auf die vollständige `/wissen`-Seite canonicalisieren. |
| Mehr Produkttext vs. unbelegte Gesundheitswerbung | SEO-Keywordtext oder ungesicherte Wirkung direkt neben Kaufaktionen | Produktflächen zeigen belegte Produkt-/Nutzungsdaten; zentrale Wirkstoffeinordnung bleibt in `/wissen`. Kommerzielle Wirkungsclaims erst nach belegtem Claim- und Mengen-Guard. |
| Personalisierter eingeloggter Hero vs. stabiles SSR | Crawler sieht Nutzerdaten oder leere Shell | Öffentlichen stabilen SSR-Inhalt liefern; private CTA/Accountzustände erst nach Hydrierung einsetzen. |
| Freundliche Fehlerseite vs. korrekter Status | Hübsche 200-Seite oder nackter 404 | Dieselbe verständliche UI mit echtem 404/410 und `noindex`. |
| Affiliate-Rechtshinweis vs. ruhige Produktkarten | Badge an jedem Produkt oder gar kein Hinweis | Ausschließlich der vorhandene globale Footerhinweis; keine produktbezogenen Affiliate-Texte. |

## 18. Priorisierter Umsetzungsplan

### Phase A – P0: falsche Folgen, Vertrauen und Datenwahrheit

- [x] `?stack=<id>` sicher auswerten, Zielstack aktivieren und testen.
- [x] Share-`returnTo` durch Forgot/Reset/Mail/Login vollständig erhalten.
- [x] Mailversand mit Ziel-/Inhaltsbestätigung versehen; keinen Sofortversand.
- [x] Falsches `/Mo.` bei eigenen Produkten korrigieren.
- [x] Hardcodierte 89er-Wirkstoffliste durch die zentrale 92er-Datenquelle ersetzen.
- [x] DGE-Gesamtzufuhr, Studienmenge und geplante Supplementmenge klar trennen.
- [x] Einnahmeplan-Zuordnung für Mehrfachzeitpunkte und „zum Essen“ korrigieren.
- [x] Rohe Timing-Schlüssel in Creator-Vorschauen zentral übersetzen.
- [x] Unsichtbare Rückmeldung nach Linkmeldung sichtbar und zugänglich machen.
- [ ] Ungültige Share-/Wissens-/Catch-all-Pfade als 404/410 und noindex ausliefern.
- [ ] Sharetokens mit `noindex`, `no-referrer` und sicherer Cache-Policy schützen.

### Phase B – P1: Kern-UX und einfache Sprache

- [x] Registrierung verkürzen, UTF-8 korrigieren und Einwilligung verständlich staffeln.
- [x] Stack-Symbolleiste, Importbuttons und Radios visuell/semantisch vereinheitlichen.
- [x] Produktkartenwahl, Dialoge, Fokusführung und Live-Status zugänglich machen.
- [x] Produkt-hinzufügen-Texte enttechnisieren und Produktauswahl vergleichbar machen.
- [x] Keyword-Heuristik und ungeprüfte Wirkungschips aus dem Hinzufügen-Dialog entfernen; Wirkstoffeinordnung zentral in `/wissen` halten.
- [x] Stackbeschreibungen zentral statt nur im Browser speichern.
- [x] Eigene-Produkt-Formular in klare Schritte mit sofortiger Validierung teilen.
- [x] Creator-Entwürfe bei Reparatur erhalten; Ablehnungsgrund und Benachrichtigung ergänzen.
- [x] Creatorherkunft und Hinweis in E-Mail/PDF übernehmen.
- [x] Wissens-Kurztexte aus einer zentralen, einfach verständlichen Quelle liefern; unsichere Einträge neutral auslassen.

### Phase C – P1 SEO: öffentliche technische Grundlage

- [ ] Zentralen Route-Head-Vertrag für Indexziel, Head, Schema und Cache einführen.
- [ ] Blanket-`Disallow: /` ersetzen; Start, Wissen und Demo erlauben, Utilityseiten crawlbar-noindex behandeln.
- [ ] SSR/Edge-Prerender für Start, Wissen, Demo, Legal, Auth-Grundzustände und Fehler.
- [ ] Sitemap um kanonische öffentliche Seiten ergänzen und 541 Zeitstempel normalisieren.
- [ ] Wissensrenderer semantisch serverseitig ausgeben, doppeltes JSON-LD entfernen.
- [ ] Meta-Längen über Publication-Gate prüfen; OG-Bild/Twitter ergänzen.
- [ ] Slash- und `/agb`-Aliasse permanent weiterleiten.

### Phase D – P2: Creator-Wachstum und Komfort

- [x] Native Share-Funktion, WhatsApp und E-Mail ergänzen; QR bleibt optional.
- [x] Creator-Dashboard mit belastbaren Zeiträumen/Kennzahlen vervollständigen.
- [x] Portfolio filtern, sortieren, archivieren und paginieren.
- [x] Undo nach Import/Ersetzen und öffentliche Meldemöglichkeit ergänzen.
- [x] Lange öffentliche Stacks ohne Kategorien in nummerierte Abschnitte mit Sprunglinks gliedern.
- [ ] Verwandte Wissensinhalte im öffentlichen Share ergänzen.
- [x] Datenexport und freiwilliges öffentliches Creator-Profilbild ergänzen.
- [ ] Öffentliche Creator-Erklär-Landingpages separat planen.
- [ ] Meldelimit bei Bedarf auf einen atomaren, dauerhaft verfügbaren Zähler statt des optionalen KV-Fallbacks umstellen.
- [ ] Abgelaufene Undo-Nutzdaten regelmäßig löschen beziehungsweise im Export- und Löschkonzept explizit behandeln.
- [ ] Report-Moderation und zugehörigen Admin-Audit bei erhöhtem Compliance-Bedarf in einen atomaren Write-Vertrag überführen.

## 19. Definition of Done je abgehaktem Punkt

- [ ] Verhalten im Code und in allen relevanten Erfolgs-/Fehlerzuständen umgesetzt.
- [ ] Sichtbarer deutscher Text nutzt echtes UTF-8, „du“ und einfache Sprache.
- [ ] Tastatur, Fokus, zugänglicher Name und Live-Feedback geprüft.
- [ ] Desktop und 390 px ohne Überlauf oder Text unter der Mindestgröße geprüft.
- [ ] Keine zweite Datenpflegequelle und kein erfundener Pflichtwert entstanden.
- [ ] Indexziel, Status, Head, Canonical, Sitemap und Cache passend zur Route geprüft.
- [ ] Gezielte Regressionstests und genau ein risikoproportionaler Gesamtcheck bestanden.
- [ ] Bei Runtimeänderung: unabhängiger technischer Review, Merge, Produktionsdeploy und öffentlicher Readback.

## 20. Code- und Live-Belege

- Routen: `frontend/src/App.tsx`
- globale Oberfläche: `frontend/src/components/Layout.tsx`,
  `CookieConsentBanner.tsx`, `LegalDisclaimer.tsx`
- Stack/Plan/Demo: `frontend/src/components/StackWorkspace.tsx`,
  `ProductCard.tsx`, `EditStackModal.tsx`
- Creator/Share: `frontend/src/pages/CreatorSharingPage.tsx`,
  `CreatorShareImportPage.tsx`, `frontend/src/lib/returnTo.ts`
- Wissen: `KnowledgeOverviewPage.tsx`, `KnowledgeArticlePage.tsx`,
  `KnowledgeMagazineArticle.tsx`, `functions/lib/knowledge-indexability.ts`
- Crawl: `functions/robots.txt.ts`, `functions/sitemap.xml.ts`,
  `functions/wissen/[slug].ts`, `frontend/index.html`
- Live geprüft auf `https://supplementstack.de`, Desktop und 390 px. Der
  Wissensvollcrawl umfasste alle 790 Sitemap-URLs.

## 21. Vollständiges Wissensseiten-Inventar

Die folgende Tabelle ordnet jede derzeit in der Produktions-Sitemap enthaltene
Wissensseite ihrem individuellen Pfad, dem geprüften Text-UX-Wert und dem
technischen SEO-Template-Score zu. Die Textwerte sind die in Abschnitt 13
beschriebene reproduzierbare Erstbewertung; die Maßnahmen stehen dort und in
Abschnitt 15. `86` gilt als SEO-Ausgangswert für Hauptartikel, `83` für
Studien-/Quellenseiten. Jeder Pfad wird bei der Umsetzung und nach seinem
öffentlichen Einzelreadback separat abgehakt.

| Erledigt | Pfad | Typ | Text-UX ★ | SEO |
|---|---|---|---:|---:|
| [ ] | `/wissen/alkoholkonsumstorungen-diagnose-und-behandlung-korperliche-014` | Studie/Quelle | 5 | 83 |
| [ ] | `/wissen/alpha-liponsaeure` | Hauptartikel | 8 | 86 |
| [ ] | `/wissen/alpha-liponsaeure-cappellani-ias-case-review-2018` | Studie/Quelle | 7 | 83 |
| [ ] | `/wissen/alpha-liponsaeure-carlson-sodium-r-lipoate-pk-2007` | Studie/Quelle | 8 | 83 |
| [ ] | `/wissen/alpha-liponsaeure-cochrane-dpn-2024` | Studie/Quelle | 7 | 83 |
| [ ] | `/wissen/alpha-liponsaeure-de-oliveira-safety-review-2020` | Studie/Quelle | 7 | 83 |
| [ ] | `/wissen/alpha-liponsaeure-dge-reference-values-nonessentiality` | Studie/Quelle | 6 | 83 |
| [ ] | `/wissen/alpha-liponsaeure-dtu-food-supplement-safety` | Studie/Quelle | 7 | 83 |
| [ ] | `/wissen/alpha-liponsaeure-efsa-ias-safety-2021` | Studie/Quelle | 7 | 83 |
| [ ] | `/wissen/alpha-liponsaeure-ghalichi-overweight-obesity-meta-2025` | Studie/Quelle | 8 | 83 |
| [ ] | `/wissen/alpha-liponsaeure-guo-oral-dpn-meta-2023` | Studie/Quelle | 8 | 83 |
| [ ] | `/wissen/alpha-liponsaeure-karimi-nafld-meta-2026` | Studie/Quelle | 7 | 83 |
| [ ] | `/wissen/alpha-liponsaeure-lpi-lipoic-acid-forms-functions` | Studie/Quelle | 6 | 83 |
| [ ] | `/wissen/alpha-liponsaeure-madadi-dpn-meta-2026` | Studie/Quelle | 7 | 83 |
| [ ] | `/wissen/alpha-liponsaeure-mashayekh-amiri-pcos-meta-2024` | Studie/Quelle | 8 | 83 |
| [ ] | `/wissen/alpha-liponsaeure-mirtaheri-ckd-meta-2025` | Studie/Quelle | 7 | 83 |
| [ ] | `/wissen/alpha-liponsaeure-mohammadi-cardiometabolic-meta-2026` | Studie/Quelle | 7 | 83 |
| [ ] | `/wissen/alpha-liponsaeure-morvaridzadeh-inflammatory-biomarkers-meta-2023` | Studie/Quelle | 7 | 83 |
| [ ] | `/wissen/alpha-liponsaeure-namazi-type-2-diabetes-meta-2022` | Studie/Quelle | 8 | 83 |
| [ ] | `/wissen/alpha-liponsaeure-nccih-dpn-supplement-context` | Studie/Quelle | 7 | 83 |
| [ ] | `/wissen/aspen-konsensempfehlungen-zum-refeeding-syndrom-019` | Studie/Quelle | 6 | 83 |
| [ ] | `/wissen/ausgewahlte-fragen-und-antworten-zu-thiamin-002` | Studie/Quelle | 6 | 83 |
| [ ] | `/wissen/b2-meta-migraine-adult-2026` | Studie/Quelle | 7 | 83 |
| [ ] | `/wissen/b3-safety-efsa-ul-niacin` | Studie/Quelle | 6 | 83 |
| [ ] | `/wissen/b5-safety-bfr-hoechstmengen-pantothensaeure` | Studie/Quelle | 6 | 83 |
| [ ] | `/wissen/bioverfuegbarkeit-kommerzieller-magnesiumpraeparate` | Studie/Quelle | 6 | 83 |
| [ ] | `/wissen/calcium` | Hauptartikel | 7 | 86 |
| [ ] | `/wissen/calcium-bedarf-who-fao-2004` | Studie/Quelle | 7 | 83 |
| [ ] | `/wissen/calcium-ernaehrungsempfehlungen-nnr-2023` | Studie/Quelle | 6 | 83 |
| [ ] | `/wissen/calcium-fachinformationen-nih` | Studie/Quelle | 6 | 83 |
| [ ] | `/wissen/calcium-kardiovaskulaeres-risiko-huo-2023` | Studie/Quelle | 7 | 83 |
| [ ] | `/wissen/calcium-lebensmittel-pflegeeinrichtungen-iuliano-2021` | Studie/Quelle | 6 | 83 |
| [ ] | `/wissen/calcium-levothyroxin-interaktion-zamfirescu-2011` | Studie/Quelle | 5 | 83 |
| [ ] | `/wissen/calcium-meta-masse-2026` | Studie/Quelle | 7 | 83 |
| [ ] | `/wissen/calcium-nierensteine-ernaehrung-taylor-2013` | Studie/Quelle | 7 | 83 |
| [ ] | `/wissen/calcium-praeeklampsie-who-2025` | Studie/Quelle | 6 | 83 |
| [ ] | `/wissen/calcium-reference-efsa-drv-2015` | Studie/Quelle | 7 | 83 |
| [ ] | `/wissen/calcium-referenzwerte-dge` | Studie/Quelle | 7 | 83 |
| [ ] | `/wissen/calcium-referenzwerte-iom-2011` | Studie/Quelle | 8 | 83 |
| [ ] | `/wissen/calcium-safety-bolland-2010` | Studie/Quelle | 6 | 83 |
| [ ] | `/wissen/calcium-safety-efsa-ul-2012` | Studie/Quelle | 6 | 83 |
| [ ] | `/wissen/calcium-und-magnesium-im-trinkwasser` | Studie/Quelle | 6 | 83 |
| [ ] | `/wissen/chlorella` | Hauptartikel | 7 | 86 |
| [ ] | `/wissen/chlorella-algen-allergenitaet-purcell-meyerink-2022` | Studie/Quelle | 6 | 83 |
| [ ] | `/wissen/chlorella-algen-jod-bfr-2007` | Studie/Quelle | 7 | 83 |
| [ ] | `/wissen/chlorella-algen-kontaminanten-efsa-2022` | Studie/Quelle | 7 | 83 |
| [ ] | `/wissen/chlorella-b12-bioverfuegbarkeit-watanabe-2003` | Studie/Quelle | 7 | 83 |
| [ ] | `/wissen/chlorella-b12-mma-merchant-2015` | Studie/Quelle | 7 | 83 |
| [ ] | `/wissen/chlorella-dioxin-muttermilch-nakano-2007` | Studie/Quelle | 7 | 83 |
| [ ] | `/wissen/chlorella-dioxin-schwangerschaft-nakano-2005` | Studie/Quelle | 7 | 83 |
| [ ] | `/wissen/chlorella-immune-claim-efsa-on-hold` | Studie/Quelle | 8 | 83 |
| [ ] | `/wissen/chlorella-kardiometabolik-fallah-2018` | Studie/Quelle | 7 | 83 |
| [ ] | `/wissen/chlorella-kardiometabolik-silva-barros-2025` | Studie/Quelle | 7 | 83 |
| [ ] | `/wissen/chlorella-lebermarker-ebrahimi-mameghani-2021` | Studie/Quelle | 7 | 83 |
| [ ] | `/wissen/chlorella-lipide-sherafati-2022` | Studie/Quelle | 7 | 83 |
| [ ] | `/wissen/chlorella-nafld-glucose-entzuendung-ebrahimi-mameghani-2017` | Studie/Quelle | 7 | 83 |
| [ ] | `/wissen/chlorella-produktqualitaet-rzymski-2025` | Studie/Quelle | 7 | 83 |
| [ ] | `/wissen/chlorella-siga-crossover-otsuki-2011` | Studie/Quelle | 7 | 83 |
| [ ] | `/wissen/chlorella-species-eu-jrc-sante-2024` | Studie/Quelle | 7 | 83 |
| [ ] | `/wissen/chlorella-toxic-metals-rare-earth-wu-2024` | Studie/Quelle | 7 | 83 |
| [ ] | `/wissen/chlorella-typ2-diabetes-hosseini-2021` | Studie/Quelle | 7 | 83 |
| [ ] | `/wissen/chlorella-vulgaris-review-safi-2014` | Studie/Quelle | 7 | 83 |
| [ ] | `/wissen/chlorella-warfarin-yamaguchi-1996` | Studie/Quelle | 7 | 83 |
| [ ] | `/wissen/cholin` | Hauptartikel | 7 | 86 |
| [ ] | `/wissen/cholin-funktionen-und-public-health` | Studie/Quelle | 6 | 83 |
| [ ] | `/wissen/cholin-offizielle-referenzwerte-und-sicherheit` | Studie/Quelle | 7 | 83 |
| [ ] | `/wissen/cholin-schwangerschaft-und-fruehe-entwicklung` | Studie/Quelle | 7 | 83 |
| [ ] | `/wissen/chrom` | Hauptartikel | 4 | 86 |
| [ ] | `/wissen/chrom-adipositas-kardiometabolisch-monfared` | Studie/Quelle | 7 | 83 |
| [ ] | `/wissen/chrom-bfr-hoechstmengen-nem` | Studie/Quelle | 7 | 83 |
| [ ] | `/wissen/chrom-bioverfuegbarkeit-laschinsky` | Studie/Quelle | 7 | 83 |
| [ ] | `/wissen/chrom-efsa-kein-drv-essentialitaet` | Studie/Quelle | 6 | 83 |
| [ ] | `/wissen/chrom-essentialitaet-statusmarker-henriksen-buegel` | Studie/Quelle | 7 | 83 |
| [ ] | `/wissen/chrom-expositionsmarker-atsdr` | Studie/Quelle | 7 | 83 |
| [ ] | `/wissen/chrom-formen-absorption-disilvestro` | Studie/Quelle | 7 | 83 |
| [ ] | `/wissen/chrom-iii-efsa-sicherheit` | Studie/Quelle | 7 | 83 |
| [ ] | `/wissen/chrom-koerperzusammensetzung-t2d-vajdi` | Studie/Quelle | 7 | 83 |
| [ ] | `/wissen/chrom-lipidprofil-umbrella-vajdi` | Studie/Quelle | 7 | 83 |
| [ ] | `/wissen/chrom-nasem-ai-kein-ul` | Studie/Quelle | 7 | 83 |
| [ ] | `/wissen/chrom-nih-ods-factsheet` | Studie/Quelle | 7 | 83 |
| [ ] | `/wissen/chrom-nnr-keine-empfehlung` | Studie/Quelle | 7 | 83 |
| [ ] | `/wissen/chrom-parenterale-ernaehrung-mangel-moukarzel` | Studie/Quelle | 7 | 83 |
| [ ] | `/wissen/chrom-pcos-randkontext-hamsho` | Studie/Quelle | 7 | 83 |
| [ ] | `/wissen/chrom-referenzwerte-dach` | Studie/Quelle | 8 | 83 |
| [ ] | `/wissen/chrom-scf-ul-trivalent` | Studie/Quelle | 7 | 83 |
| [ ] | `/wissen/chrom-statusmarker-hambidge` | Studie/Quelle | 7 | 83 |
| [ ] | `/wissen/chrom-tpn-mangel-jeejeebhoy` | Studie/Quelle | 7 | 83 |
| [ ] | `/wissen/chrom-typ-2-diabetes-glukose-asbaghi` | Studie/Quelle | 7 | 83 |
| [ ] | `/wissen/chrom-vi-kontamination-efsa` | Studie/Quelle | 8 | 83 |
| [ ] | `/wissen/chrom-vkm-sicherheit-hohe-zufuhr` | Studie/Quelle | 8 | 83 |
| [ ] | `/wissen/chrom-who-fao-trace-elements` | Studie/Quelle | 7 | 83 |
| [ ] | `/wissen/chrompicolinat-efsa-sicherheit` | Studie/Quelle | 7 | 83 |
| [ ] | `/wissen/chrompicolinat-gewicht-adipositas-cochrane` | Studie/Quelle | 7 | 83 |
| [ ] | `/wissen/chrompicolinat-niere-wani` | Studie/Quelle | 7 | 83 |
| [ ] | `/wissen/chrompicolinat-toxizitaet-cerulli` | Studie/Quelle | 7 | 83 |
| [ ] | `/wissen/der-verzehr-thiaminangereicherter-fischsauce-im-haushalt-e-028` | Studie/Quelle | 7 | 83 |
| [ ] | `/wissen/efns-leitlinie-zur-diagnose-therapie-und-pravention-der-we-015` | Studie/Quelle | 6 | 83 |
| [ ] | `/wissen/ein-vorhersagemodell-fur-thiaminresponsive-storungen-bei-s-032` | Studie/Quelle | 6 | 83 |
| [ ] | `/wissen/einfluss-einer-vitamin-b1-und-vitamin-b2-supplementierung-045` | Studie/Quelle | 7 | 83 |
| [ ] | `/wissen/eisen` | Hauptartikel | 8 | 86 |
| [ ] | `/wissen/eisen-akute-eisenaufnahme-warnhinweise` | Studie/Quelle | 6 | 83 |
| [ ] | `/wissen/eisen-blutspender` | Studie/Quelle | 7 | 83 |
| [ ] | `/wissen/eisen-daily-vs-alternate-day` | Studie/Quelle | 8 | 83 |
| [ ] | `/wissen/eisen-fatigue-ohne-anaemie` | Studie/Quelle | 8 | 83 |
| [ ] | `/wissen/eisen-ferritin-cutoffs-statusmarker` | Studie/Quelle | 8 | 83 |
| [ ] | `/wissen/eisen-haem-nicht-haem-bioverfuegbarkeit` | Studie/Quelle | 7 | 83 |
| [ ] | `/wissen/eisen-haemochromatose-ueberladung` | Studie/Quelle | 6 | 83 |
| [ ] | `/wissen/eisen-ibd-iv-oral-spezialkontext` | Studie/Quelle | 7 | 83 |
| [ ] | `/wissen/eisen-ida-erwachsene-gi-cutoff` | Studie/Quelle | 7 | 83 |
| [ ] | `/wissen/eisen-interaktionen-vitamin-c-zink-arznei` | Studie/Quelle | 7 | 83 |
| [ ] | `/wissen/eisen-kinder-dosis-dauer-review` | Studie/Quelle | 7 | 83 |
| [ ] | `/wissen/eisen-kinder-malaria-sicherheit` | Studie/Quelle | 7 | 83 |
| [ ] | `/wissen/eisen-lmic-kinder-jugendliche-cosupplementierung` | Studie/Quelle | 8 | 83 |
| [ ] | `/wissen/eisen-menstruierende-frauen-reviews` | Studie/Quelle | 7 | 83 |
| [ ] | `/wissen/eisen-orale-formen-vertraeglichkeit` | Studie/Quelle | 7 | 83 |
| [ ] | `/wissen/eisen-postpartum-anaemie-iv-transfusion` | Studie/Quelle | 7 | 83 |
| [ ] | `/wissen/eisen-public-health-lifecycle-anaemia` | Studie/Quelle | 6 | 83 |
| [ ] | `/wissen/eisen-referenzwerte-dach-efsa-iom-international` | Studie/Quelle | 8 | 83 |
| [ ] | `/wissen/eisen-saeuglinge-low-birth-weight` | Studie/Quelle | 8 | 83 |
| [ ] | `/wissen/eisen-schwangerschaft-daily-intermit-normalstatus` | Studie/Quelle | 7 | 83 |
| [ ] | `/wissen/eisen-schwangerschaft-iv-vs-oral` | Studie/Quelle | 8 | 83 |
| [ ] | `/wissen/eisen-schwangerschaft-lmic-micronutrients` | Studie/Quelle | 7 | 83 |
| [ ] | `/wissen/eisen-schwangerschaft-screening-leitlinien` | Studie/Quelle | 7 | 83 |
| [ ] | `/wissen/eisen-sicherheit-ul-nem-hoechstmengen` | Studie/Quelle | 7 | 83 |
| [ ] | `/wissen/eisen-sport-aktive-frauen` | Studie/Quelle | 7 | 83 |
| [ ] | `/wissen/electrolyte-reference-nasem-2019` | Studie/Quelle | 7 | 83 |
| [ ] | `/wissen/electrolyte-systematic-review-ors-hahn-2001` | Studie/Quelle | 6 | 83 |
| [ ] | `/wissen/elektrolyte` | Hauptartikel | 7 | 86 |
| [ ] | `/wissen/ernahrungsunterstutzung-fur-erwachsene-orale-enterale-und-018` | Studie/Quelle | 5 | 83 |
| [ ] | `/wissen/ginseng` | Hauptartikel | 7 | 86 |
| [ ] | `/wissen/ginseng-fatigue-kim-2013` | Studie/Quelle | 7 | 83 |
| [ ] | `/wissen/ginseng-vertraeglichkeit-song-2018` | Studie/Quelle | 6 | 83 |
| [ ] | `/wissen/globale-schatzung-unzureichender-mikronahrstoffzufuhr-eine-023` | Studie/Quelle | 6 | 83 |
| [ ] | `/wissen/grapefruitkerne-harnwegsinfektionen-studie` | Studie/Quelle | 6 | 83 |
| [ ] | `/wissen/grapefruitkernextrakt` | Hauptartikel | 6 | 86 |
| [ ] | `/wissen/grapefruitkernextrakt-benzethonium-bfr` | Studie/Quelle | 6 | 83 |
| [ ] | `/wissen/hoch-dosiertes-orales-thiamin-gegen-placebo-bei-chronische-050` | Studie/Quelle | 7 | 83 |
| [ ] | `/wissen/hochstmengenvorschlage-fur-vitamin-b1-vitamin-b2-und-panto-013` | Studie/Quelle | 7 | 83 |
| [ ] | `/wissen/hohe-pravalenz-von-thiaminmangel-im-fruhen-kindesalter-in-024` | Studie/Quelle | 7 | 83 |
| [ ] | `/wissen/inositol` | Hauptartikel | 7 | 86 |
| [ ] | `/wissen/inositol-kein-allgemeiner-referenzwert-und-formen` | Studie/Quelle | 6 | 83 |
| [ ] | `/wissen/inositol-pcos-leitlinie-und-subfertilitaet` | Studie/Quelle | 7 | 83 |
| [ ] | `/wissen/inositol-schwangerschaft-und-gestationsdiabetes` | Studie/Quelle | 7 | 83 |
| [ ] | `/wissen/jod` | Hauptartikel | 7 | 86 |
| [ ] | `/wissen/jod-algen-kelp-schilddruese-smyth` | Studie/Quelle | 7 | 83 |
| [ ] | `/wissen/jod-algen-sicherheit-anses` | Studie/Quelle | 7 | 83 |
| [ ] | `/wissen/jod-bfr-hoechstmengen-nem-2025` | Studie/Quelle | 8 | 83 |
| [ ] | `/wissen/jod-braunalgen-bioverfuegbarkeit-review` | Studie/Quelle | 8 | 83 |
| [ ] | `/wissen/jod-efsa-scf-upper-intake-level` | Studie/Quelle | 7 | 83 |
| [ ] | `/wissen/jod-fruehe-schwangerschaft-intelligenz-2026` | Studie/Quelle | 5 | 83 |
| [ ] | `/wissen/jod-iodat-iodid-jodsalz-bfr-mri` | Studie/Quelle | 8 | 83 |
| [ ] | `/wissen/jod-kinder-jugendliche-dgkj-moki` | Studie/Quelle | 7 | 83 |
| [ ] | `/wissen/jod-kinder-statusmarker-montenegro-bethancourt` | Studie/Quelle | 8 | 83 |
| [ ] | `/wissen/jod-korea-hohe-zufuhr-schilddruese-kim` | Studie/Quelle | 8 | 83 |
| [ ] | `/wissen/jod-muetterlicher-status-kind-iq-levie` | Studie/Quelle | 8 | 83 |
| [ ] | `/wissen/jod-nasem-iom-dri-ul` | Studie/Quelle | 8 | 83 |
| [ ] | `/wissen/jod-nih-ods-factsheet` | Studie/Quelle | 7 | 83 |
| [ ] | `/wissen/jod-nnr-scoping-review` | Studie/Quelle | 7 | 83 |
| [ ] | `/wissen/jod-referenzwerte-dach-dge` | Studie/Quelle | 8 | 83 |
| [ ] | `/wissen/jod-referenzwerte-efsa-drv` | Studie/Quelle | 7 | 83 |
| [ ] | `/wissen/jod-schwangerschaft-cochrane-harding` | Studie/Quelle | 7 | 83 |
| [ ] | `/wissen/jod-schwangerschaft-stillzeit-review-ma-brough` | Studie/Quelle | 7 | 83 |
| [ ] | `/wissen/jod-schwangerschaft-supplementierung-dineva-meta` | Studie/Quelle | 7 | 83 |
| [ ] | `/wissen/jod-statusmarker-uic-tg-tsh-review` | Studie/Quelle | 7 | 83 |
| [ ] | `/wissen/jod-thyreoglobulin-biomarker-review` | Studie/Quelle | 7 | 83 |
| [ ] | `/wissen/jod-ueberschuss-schilddruese-katagiri` | Studie/Quelle | 7 | 83 |
| [ ] | `/wissen/jod-ueberschussquellen-farebrother` | Studie/Quelle | 7 | 83 |
| [ ] | `/wissen/jod-vegan-vegetarisch-eveleigh-meta` | Studie/Quelle | 7 | 83 |
| [ ] | `/wissen/jod-vegane-kinder-jugendliche-koller` | Studie/Quelle | 7 | 83 |
| [ ] | `/wissen/jod-vegane-vegetarische-kinder-remerova` | Studie/Quelle | 8 | 83 |
| [ ] | `/wissen/jod-wachstum-salz-supplemente-farebrother` | Studie/Quelle | 8 | 83 |
| [ ] | `/wissen/jod-who-europa-salzjodierung-2024` | Studie/Quelle | 7 | 83 |
| [ ] | `/wissen/jod-who-monitoring-uic-salzjodierung` | Studie/Quelle | 4 | 83 |
| [ ] | `/wissen/jod-who-nlis-uic-schwellen` | Studie/Quelle | 7 | 83 |
| [ ] | `/wissen/jodinduzierte-schilddruesendysfunktion-leung-braverman` | Studie/Quelle | 6 | 83 |
| [ ] | `/wissen/jodprophylaxe-autoimmunitaet-review` | Studie/Quelle | 6 | 83 |
| [ ] | `/wissen/jodsalz-faktenblatt-bmleh` | Studie/Quelle | 7 | 83 |
| [ ] | `/wissen/jodsalz-praevention-review` | Studie/Quelle | 8 | 83 |
| [ ] | `/wissen/jodversorgung-deutschland-bmleh-rki` | Studie/Quelle | 8 | 83 |
| [ ] | `/wissen/kalium` | Hauptartikel | 7 | 86 |
| [ ] | `/wissen/kalium-blutdruck-metaanalyse-granal-2025` | Studie/Quelle | 6 | 83 |
| [ ] | `/wissen/kalium-ernaehrungsempfehlungen-nnr-2023` | Studie/Quelle | 7 | 83 |
| [ ] | `/wissen/kalium-leitlinie-who-2012` | Studie/Quelle | 7 | 83 |
| [ ] | `/wissen/kalium-meta-aburto-2013` | Studie/Quelle | 7 | 83 |
| [ ] | `/wissen/kalium-reference-dge-2026` | Studie/Quelle | 7 | 83 |
| [ ] | `/wissen/kalium-referenzwerte-efsa-2016` | Studie/Quelle | 7 | 83 |
| [ ] | `/wissen/kalium-referenzwerte-nasem-2019` | Studie/Quelle | 7 | 83 |
| [ ] | `/wissen/kalium-risk-kdigo-2020` | Studie/Quelle | 5 | 83 |
| [ ] | `/wissen/kalium-safety-bfr-2021` | Studie/Quelle | 6 | 83 |
| [ ] | `/wissen/kalium-salzersatz-ssass-2021` | Studie/Quelle | 7 | 83 |
| [ ] | `/wissen/kollagen` | Hauptartikel | 7 | 86 |
| [ ] | `/wissen/kollagen-bischof-training-meta-2024` | Studie/Quelle | 8 | 83 |
| [ ] | `/wissen/kollagen-cammilleri-marine-metals-quality-2025` | Studie/Quelle | 7 | 83 |
| [ ] | `/wissen/kollagen-cao-skin-anti-aging-meta-2023` | Studie/Quelle | 8 | 83 |
| [ ] | `/wissen/kollagen-dge-reference-values-nonessentiality` | Studie/Quelle | 5 | 83 |
| [ ] | `/wissen/kollagen-efsa-egg-membrane-hydrolysate-safety-2025` | Studie/Quelle | 7 | 83 |
| [ ] | `/wissen/kollagen-efsa-joint-health-claim-2011` | Studie/Quelle | 7 | 83 |
| [ ] | `/wissen/kollagen-efsa-verisol-skin-elasticity-claim-2013` | Studie/Quelle | 7 | 83 |
| [ ] | `/wissen/kollagen-koenig-bmd-rct-2018` | Studie/Quelle | 7 | 83 |
| [ ] | `/wissen/kollagen-kumar-uc-ii-knee-oa-review-2023` | Studie/Quelle | 8 | 83 |
| [ ] | `/wissen/kollagen-lin-knee-oa-pain-meta-2023` | Studie/Quelle | 8 | 83 |
| [ ] | `/wissen/kollagen-ncbi-collagen-synthesis` | Studie/Quelle | 7 | 83 |
| [ ] | `/wissen/kollagen-ravindran-umbrella-skin-musculoskeletal-2026` | Studie/Quelle | 7 | 83 |
| [ ] | `/wissen/kollagen-yazaki-collagen-peptide-bioavailability-2017` | Studie/Quelle | 8 | 83 |
| [ ] | `/wissen/krilloel` | Hauptartikel | 7 | 86 |
| [ ] | `/wissen/krilloel-dge-fett-essenzielle-fettsaeuren` | Studie/Quelle | 8 | 83 |
| [ ] | `/wissen/krilloel-efsa-drv-fats-2010` | Studie/Quelle | 8 | 83 |
| [ ] | `/wissen/krilloel-efsa-novel-food-antarctic-krill-2014` | Studie/Quelle | 7 | 83 |
| [ ] | `/wissen/krilloel-efsa-ul-epa-dha-dpa-2012` | Studie/Quelle | 7 | 83 |
| [ ] | `/wissen/krilloel-fda-grn-371` | Studie/Quelle | 7 | 83 |
| [ ] | `/wissen/krilloel-health-canada-monograph-2025` | Studie/Quelle | 7 | 83 |
| [ ] | `/wissen/krilloel-huang-cardiovascular-meta-2023` | Studie/Quelle | 7 | 83 |
| [ ] | `/wissen/krilloel-laslett-knee-osteoarthritis-rct-2024` | Studie/Quelle | 8 | 83 |
| [ ] | `/wissen/krilloel-nicholls-severe-hypertriglyceridemia-rct-2022` | Studie/Quelle | 8 | 83 |
| [ ] | `/wissen/krilloel-ramprasath-omega-3-index-rct-2013` | Studie/Quelle | 8 | 83 |
| [ ] | `/wissen/krilloel-sahebkar-krill-vs-fish-oil-network-meta-2020` | Studie/Quelle | 8 | 83 |
| [ ] | `/wissen/krilloel-schuchardt-bioavailability-plasma-phospholipids-2011` | Studie/Quelle | 8 | 83 |
| [ ] | `/wissen/krilloel-xia-knee-osteoarthritis-meta-2025` | Studie/Quelle | 8 | 83 |
| [ ] | `/wissen/kupfer` | Hauptartikel | 7 | 86 |
| [ ] | `/wissen/kupfer-aasld-wilson-summary` | Studie/Quelle | 6 | 83 |
| [ ] | `/wissen/kupfer-alzheimer-nicht-cp-kupfer` | Studie/Quelle | 7 | 83 |
| [ ] | `/wissen/kupfer-bariatrische-chirurgie-gletsu-miller` | Studie/Quelle | 8 | 83 |
| [ ] | `/wissen/kupfer-bfr-nem-hoechstmengen` | Studie/Quelle | 8 | 83 |
| [ ] | `/wissen/kupfer-cupric-oxide-baker` | Studie/Quelle | 7 | 83 |
| [ ] | `/wissen/kupfer-depletion-repletion-kehoe` | Studie/Quelle | 7 | 83 |
| [ ] | `/wissen/kupfer-dge-referenzwerte` | Studie/Quelle | 8 | 83 |
| [ ] | `/wissen/kupfer-easl-ern-wilson-guideline` | Studie/Quelle | 6 | 83 |
| [ ] | `/wissen/kupfer-efsa-hbgv-sicherheit` | Studie/Quelle | 7 | 83 |
| [ ] | `/wissen/kupfer-efsa-referenzwerte` | Studie/Quelle | 8 | 83 |
| [ ] | `/wissen/kupfer-iom-dri-rda-ul` | Studie/Quelle | 8 | 83 |
| [ ] | `/wissen/kupfer-knochen-gutierrez-guerra-review` | Studie/Quelle | 7 | 83 |
| [ ] | `/wissen/kupfer-moderne-statusmarker-chillon` | Studie/Quelle | 7 | 83 |
| [ ] | `/wissen/kupfer-myelopathie-jaiser-winston` | Studie/Quelle | 7 | 83 |
| [ ] | `/wissen/kupfer-nhanes-mortalitaet-wang-zhao` | Studie/Quelle | 7 | 83 |
| [ ] | `/wissen/kupfer-nih-fact-sheet-formen-risiken` | Studie/Quelle | 6 | 83 |
| [ ] | `/wissen/kupfer-nordic-scoping-review` | Studie/Quelle | 7 | 83 |
| [ ] | `/wissen/kupfer-pratt-supplementierung-sicherheit` | Studie/Quelle | 7 | 83 |
| [ ] | `/wissen/kupfer-pure-china-cvd-mortalitaet` | Studie/Quelle | 7 | 83 |
| [ ] | `/wissen/kupfer-scf-ul-2003` | Studie/Quelle | 7 | 83 |
| [ ] | `/wissen/kupfer-serumkupfer-mace-review` | Studie/Quelle | 7 | 83 |
| [ ] | `/wissen/kupfer-statusmarker-harvey-2009` | Studie/Quelle | 7 | 83 |
| [ ] | `/wissen/kupfer-supplementierung-enzyme-jones` | Studie/Quelle | 7 | 83 |
| [ ] | `/wissen/kupfer-who-fao-bedarf` | Studie/Quelle | 7 | 83 |
| [ ] | `/wissen/kupfer-zink-interaktion-fischer` | Studie/Quelle | 7 | 83 |
| [ ] | `/wissen/kupfer-zink-prothesenhaftcreme-jamal` | Studie/Quelle | 4 | 83 |
| [ ] | `/wissen/l-carnitin` | Hauptartikel | 7 | 86 |
| [ ] | `/wissen/l-carnitin-dge-referenzwerte-nichttreffer` | Studie/Quelle | 7 | 83 |
| [ ] | `/wissen/l-carnitin-efsa-tartrate-safety-2003` | Studie/Quelle | 7 | 83 |
| [ ] | `/wissen/l-carnitin-gheysari-diabetes-cvd-risk-2024` | Studie/Quelle | 7 | 83 |
| [ ] | `/wissen/l-carnitin-hamedi-obesity-umbrella-2025` | Studie/Quelle | 7 | 83 |
| [ ] | `/wissen/l-carnitin-health-canada-monograph-2025` | Studie/Quelle | 7 | 83 |
| [ ] | `/wissen/l-carnitin-heinrich-sanchez-tmao-review-2025` | Studie/Quelle | 7 | 83 |
| [ ] | `/wissen/l-carnitin-mielgo-ayuso-exercise-performance-2021` | Studie/Quelle | 7 | 83 |
| [ ] | `/wissen/l-carnitin-nih-ods-health-professional` | Studie/Quelle | 7 | 83 |
| [ ] | `/wissen/l-carnitin-vajdi-hemodialysis-cardiometabolic-2026` | Studie/Quelle | 7 | 83 |
| [ ] | `/wissen/l-carnitin-vkm-risk-assessment-2015` | Studie/Quelle | 8 | 83 |
| [ ] | `/wissen/l-carnitin-wu-gbu-tmao-response-2025` | Studie/Quelle | 7 | 83 |
| [ ] | `/wissen/l-carnitin-zhou-primary-deficiency-screening-2024` | Studie/Quelle | 8 | 83 |
| [ ] | `/wissen/linxian-25-year-2018` | Studie/Quelle | 7 | 83 |
| [ ] | `/wissen/linxian-lung-chemoprevention-2006` | Studie/Quelle | 6 | 83 |
| [ ] | `/wissen/magnesium` | Hauptartikel | 7 | 86 |
| [ ] | `/wissen/magnesium-aufnahme-bioverfuegbarkeit` | Studie/Quelle | 6 | 83 |
| [ ] | `/wissen/magnesium-bei-skelettmuskelkraempfen` | Studie/Quelle | 6 | 83 |
| [ ] | `/wissen/magnesium-fachinformationen-fuer-gesundheitsberufe` | Studie/Quelle | 5 | 83 |
| [ ] | `/wissen/magnesium-meta-zhang-2016` | Studie/Quelle | 6 | 83 |
| [ ] | `/wissen/magnesium-reference-dge-2021` | Studie/Quelle | 8 | 83 |
| [ ] | `/wissen/magnesium-referenzwerte-calcium-phosphor-vitamin-d-fluorid` | Studie/Quelle | 8 | 83 |
| [ ] | `/wissen/magnesium-safety-bfr-2017` | Studie/Quelle | 7 | 83 |
| [ ] | `/wissen/mangan` | Hauptartikel | 7 | 86 |
| [ ] | `/wissen/mangan-atsdr-toxikologie-biomarker` | Studie/Quelle | 6 | 83 |
| [ ] | `/wissen/mangan-bfr-hoechstmengen-nem` | Studie/Quelle | 7 | 83 |
| [ ] | `/wissen/mangan-bioaccessibility-oneal-zheng` | Studie/Quelle | 7 | 83 |
| [ ] | `/wissen/mangan-deutschland-exposition-sachse` | Studie/Quelle | 8 | 83 |
| [ ] | `/wissen/mangan-efsa-safe-level-sicherheit` | Studie/Quelle | 7 | 83 |
| [ ] | `/wissen/mangan-efsa-supplementformen` | Studie/Quelle | 7 | 83 |
| [ ] | `/wissen/mangan-homeostase-aschner` | Studie/Quelle | 7 | 83 |
| [ ] | `/wissen/mangan-internationale-aufnahme-freeland-graves` | Studie/Quelle | 7 | 83 |
| [ ] | `/wissen/mangan-kinder-neuroentwicklung-liu-meta` | Studie/Quelle | 7 | 83 |
| [ ] | `/wissen/mangan-mangel-toxizitaet-freeland-graves` | Studie/Quelle | 7 | 83 |
| [ ] | `/wissen/mangan-metabolisches-syndrom-wong-meta` | Studie/Quelle | 7 | 83 |
| [ ] | `/wissen/mangan-nih-ods-factsheet` | Studie/Quelle | 7 | 83 |
| [ ] | `/wissen/mangan-nnr-scoping-review` | Studie/Quelle | 7 | 83 |
| [ ] | `/wissen/mangan-parenterale-ernaehrung-hardy` | Studie/Quelle | 7 | 83 |
| [ ] | `/wissen/mangan-pn-blutspiegel-abdalian` | Studie/Quelle | 4 | 83 |
| [ ] | `/wissen/mangan-referenzwerte-dach-efsa-nasem` | Studie/Quelle | 8 | 83 |
| [ ] | `/wissen/mangan-saeuglinge-formula-williams` | Studie/Quelle | 7 | 83 |
| [ ] | `/wissen/mangan-saeuglingsnahrung-gehalte-frisbie` | Studie/Quelle | 7 | 83 |
| [ ] | `/wissen/mangan-sicherheit-scf-vkm-health-council` | Studie/Quelle | 7 | 83 |
| [ ] | `/wissen/mangan-tpn-toxizitaet-dewitt` | Studie/Quelle | 7 | 83 |
| [ ] | `/wissen/mangan-trinkwasser-kinder-iyare-review` | Studie/Quelle | 6 | 83 |
| [ ] | `/wissen/mangan-trinkwasser-kinder-rahman-kohorte` | Studie/Quelle | 7 | 83 |
| [ ] | `/wissen/mangan-trinkwasser-who-sicherheit` | Studie/Quelle | 7 | 83 |
| [ ] | `/wissen/mct-oel` | Hauptartikel | 7 | 86 |
| [ ] | `/wissen/mct-oel-chapman-lopez-koh-sport-review-2022` | Studie/Quelle | 7 | 83 |
| [ ] | `/wissen/mct-oel-dge-fettzufuhr-leitlinie-2015` | Studie/Quelle | 7 | 83 |
| [ ] | `/wissen/mct-oel-dge-referenzwerte-fett-essenzielle-fettsaeuren` | Studie/Quelle | 8 | 83 |
| [ ] | `/wissen/mct-oel-efsa-health-claim-body-weight-2011` | Studie/Quelle | 7 | 83 |
| [ ] | `/wissen/mct-oel-fda-grn-449` | Studie/Quelle | 7 | 83 |
| [ ] | `/wissen/mct-oel-fsanz-a563-infant-formula` | Studie/Quelle | 6 | 83 |
| [ ] | `/wissen/mct-oel-he-gewicht-metabolik-meta-2024` | Studie/Quelle | 7 | 83 |
| [ ] | `/wissen/mct-oel-heidt-regulatory-perspectives-2026` | Studie/Quelle | 6 | 83 |
| [ ] | `/wissen/mct-oel-maher-clegg-satiety-food-intake-meta-2021` | Studie/Quelle | 7 | 83 |
| [ ] | `/wissen/mct-oel-mckenzie-blood-lipids-meta-2021` | Studie/Quelle | 7 | 83 |
| [ ] | `/wissen/mct-oel-traul-toxicology-review-2000` | Studie/Quelle | 7 | 83 |
| [ ] | `/wissen/mct-oel-vandenberghe-c8-c10-bhb-glucose-2023` | Studie/Quelle | 8 | 83 |
| [ ] | `/wissen/mct-oel-wu-alzheimer-cognition-meta-2023` | Studie/Quelle | 7 | 83 |
| [ ] | `/wissen/msm` | Hauptartikel | 7 | 86 |
| [ ] | `/wissen/msm-dermatology-review-abdul-rahman-2026` | Studie/Quelle | 7 | 83 |
| [ ] | `/wissen/msm-efsa-joints-claims-2009` | Studie/Quelle | 7 | 83 |
| [ ] | `/wissen/msm-efsa-related-claims-2010` | Studie/Quelle | 8 | 83 |
| [ ] | `/wissen/msm-fda-gras-grn-229` | Studie/Quelle | 7 | 83 |
| [ ] | `/wissen/msm-half-marathon-rct-withee-2017` | Studie/Quelle | 7 | 83 |
| [ ] | `/wissen/msm-hdl-crp-tang-2021` | Studie/Quelle | 8 | 83 |
| [ ] | `/wissen/msm-health-canada-joint-health-products` | Studie/Quelle | 7 | 83 |
| [ ] | `/wissen/msm-human-csf-plasma-engelke-2005` | Studie/Quelle | 8 | 83 |
| [ ] | `/wissen/msm-intestinal-absorption-sulfate-2018` | Studie/Quelle | 8 | 83 |
| [ ] | `/wissen/msm-mild-knee-pain-rct-nakasone-2023` | Studie/Quelle | 8 | 83 |
| [ ] | `/wissen/msm-military-knee-pain-negative-tennent-2017` | Studie/Quelle | 7 | 83 |
| [ ] | `/wissen/msm-oa-meta-analysis-brien-2011` | Studie/Quelle | 8 | 83 |
| [ ] | `/wissen/msm-oa-rct-debbi-2011` | Studie/Quelle | 8 | 83 |
| [ ] | `/wissen/msm-verbraucherzentrale-arthrose-schwefeltherapie-2025` | Studie/Quelle | 7 | 83 |
| [ ] | `/wissen/msm-vkm-risk-assessment-2021` | Studie/Quelle | 7 | 83 |
| [ ] | `/wissen/nahrstoffreferenzwerte-fur-australien-und-neuseeland-thiam-011` | Studie/Quelle | 8 | 83 |
| [ ] | `/wissen/niedrig-dosierte-thiaminsupplementierung-stillender-kambod-029` | Studie/Quelle | 7 | 83 |
| [ ] | `/wissen/nordische-ernaehrungsempfehlungen-2023-magnesium` | Studie/Quelle | 7 | 83 |
| [ ] | `/wissen/nordische-ernahrungsempfehlungen-2023-thiamin-008` | Studie/Quelle | 7 | 83 |
| [ ] | `/wissen/omega-3` | Hauptartikel | 7 | 86 |
| [ ] | `/wissen/omega-3-aha-hypertriglyceridemia-advisory` | Studie/Quelle | 7 | 83 |
| [ ] | `/wissen/omega-3-albert-nz-oxidation-label` | Studie/Quelle | 8 | 83 |
| [ ] | `/wissen/omega-3-arnesen-nnr-scoping-review` | Studie/Quelle | 7 | 83 |
| [ ] | `/wissen/omega-3-ascend-bowman-diabetes-cvd` | Studie/Quelle | 8 | 83 |
| [ ] | `/wissen/omega-3-begtrup-bleeding-risk-review` | Studie/Quelle | 7 | 83 |
| [ ] | `/wissen/omega-3-bernasconi-cvd-dose-meta` | Studie/Quelle | 7 | 83 |
| [ ] | `/wissen/omega-3-bfr-important-but-in-moderation` | Studie/Quelle | 7 | 83 |
| [ ] | `/wissen/omega-3-dge-fett-essenzielle-fettsaeuren` | Studie/Quelle | 8 | 83 |
| [ ] | `/wissen/omega-3-dge-handlungsempfehlungen-schwangerschaft` | Studie/Quelle | 7 | 83 |
| [ ] | `/wissen/omega-3-downie-dry-eye-cochrane` | Studie/Quelle | 7 | 83 |
| [ ] | `/wissen/omega-3-dream-dry-eye-rct` | Studie/Quelle | 8 | 83 |
| [ ] | `/wissen/omega-3-efsa-ul-epa-dha-dpa` | Studie/Quelle | 7 | 83 |
| [ ] | `/wissen/omega-3-fish-oil-oxidative-status-compliance` | Studie/Quelle | 7 | 83 |
| [ ] | `/wissen/omega-3-gencer-atrial-fibrillation-meta` | Studie/Quelle | 8 | 83 |
| [ ] | `/wissen/omega-3-hanson-pufa-cancer-rct-meta` | Studie/Quelle | 8 | 83 |
| [ ] | `/wissen/omega-3-issfal-pregnancy-preterm-statement` | Studie/Quelle | 7 | 83 |
| [ ] | `/wissen/omega-3-khan-cvd-meta` | Studie/Quelle | 8 | 83 |
| [ ] | `/wissen/omega-3-kim-nafld-meta` | Studie/Quelle | 7 | 83 |
| [ ] | `/wissen/omega-3-kleiner-label-amounts` | Studie/Quelle | 8 | 83 |
| [ ] | `/wissen/omega-3-lee-cancer-umbrella` | Studie/Quelle | 7 | 83 |
| [ ] | `/wissen/omega-3-makrides-orip-preterm-delivery` | Studie/Quelle | 8 | 83 |
| [ ] | `/wissen/omega-3-middleton-pregnancy-cochrane` | Studie/Quelle | 8 | 83 |
| [ ] | `/wissen/omega-3-moore-plant-based-nafld-meta` | Studie/Quelle | 7 | 83 |
| [ ] | `/wissen/omega-3-nasem-iom-dri-fatty-acids` | Studie/Quelle | 8 | 83 |
| [ ] | `/wissen/omega-3-nih-ods-fact-sheet` | Studie/Quelle | 7 | 83 |
| [ ] | `/wissen/omega-3-nnr-2023-fat-fatty-acids` | Studie/Quelle | 7 | 83 |
| [ ] | `/wissen/omega-3-reduce-it-bhatt-icosapent-ethyl` | Studie/Quelle | 7 | 83 |
| [ ] | `/wissen/omega-3-strength-nicholls-epa-dha-corn-oil` | Studie/Quelle | 7 | 83 |
| [ ] | `/wissen/omega-3-sydenham-cognition-cochrane` | Studie/Quelle | 8 | 83 |
| [ ] | `/wissen/omega-3-vital-manson-cvd-cancer` | Studie/Quelle | 8 | 83 |
| [ ] | `/wissen/omega-3-wang-dry-eye-meta` | Studie/Quelle | 7 | 83 |
| [ ] | `/wissen/omega-3-wang-dyslipidemia-meta` | Studie/Quelle | 8 | 83 |
| [ ] | `/wissen/omega-3-wang-ra-meta` | Studie/Quelle | 7 | 83 |
| [ ] | `/wissen/omega-3-zhang-blood-pressure-meta` | Studie/Quelle | 8 | 83 |
| [ ] | `/wissen/opc` | Hauptartikel | 7 | 86 |
| [ ] | `/wissen/opc-anjom-shoae-gse-dyslipidaemia-2020` | Studie/Quelle | 7 | 83 |
| [ ] | `/wissen/opc-asbaghi-gse-metabolic-markers-2020` | Studie/Quelle | 7 | 83 |
| [ ] | `/wissen/opc-bayer-hoegger-pycnogenol-pk-2024` | Studie/Quelle | 7 | 83 |
| [ ] | `/wissen/opc-efsa-meganatural-bp-claim-2021` | Studie/Quelle | 7 | 83 |
| [ ] | `/wissen/opc-foshati-gse-fmd-blood-pressure-2022` | Studie/Quelle | 7 | 83 |
| [ ] | `/wissen/opc-harnly-grape-polyphenol-standardization-2021` | Studie/Quelle | 7 | 83 |
| [ ] | `/wissen/opc-health-canada-nhp-monograph-2024` | Studie/Quelle | 6 | 83 |
| [ ] | `/wissen/opc-health-canada-safety-assessment-2024` | Studie/Quelle | 6 | 83 |
| [ ] | `/wissen/opc-nccih-grape-seed-safety-2025` | Studie/Quelle | 7 | 83 |
| [ ] | `/wissen/opc-ren-proanthocyanidins-blood-pressure-2020` | Studie/Quelle | 7 | 83 |
| [ ] | `/wissen/opc-robertson-pine-bark-cochrane-2020` | Studie/Quelle | 7 | 83 |
| [ ] | `/wissen/opc-sica-gse-quality-characterization-2018` | Studie/Quelle | 7 | 83 |
| [ ] | `/wissen/opc-unusan-grape-seed-proanthocyanidins-2020` | Studie/Quelle | 5 | 83 |
| [ ] | `/wissen/opc-usp-nf-grape-seeds-opc-standard` | Studie/Quelle | 7 | 83 |
| [ ] | `/wissen/opc-wren-gspe-bioavailability-pk` | Studie/Quelle | 7 | 83 |
| [ ] | `/wissen/orale-magnesiumsupplementierung-schlaflosigkeit-aeltere-erwachsene` | Studie/Quelle | 7 | 83 |
| [ ] | `/wissen/perinataler-verzehr-thiaminangereicherter-fischsauce-im-la-027` | Studie/Quelle | 8 | 83 |
| [ ] | `/wissen/probiotika` | Hauptartikel | 7 | 86 |
| [ ] | `/wissen/probiotika-aga-gi-guideline-2020` | Studie/Quelle | 6 | 83 |
| [ ] | `/wissen/probiotika-bfr-infant-formula-benefit-safety-2026` | Studie/Quelle | 7 | 83 |
| [ ] | `/wissen/probiotika-chieng-bv-recurrence-meta-2022` | Studie/Quelle | 7 | 83 |
| [ ] | `/wissen/probiotika-cochrane-urti-2022` | Studie/Quelle | 7 | 83 |
| [ ] | `/wissen/probiotika-collinson-acute-infectious-diarrhoea-cochrane-2020` | Studie/Quelle | 7 | 83 |
| [ ] | `/wissen/probiotika-ding-functional-constipation-meta-2024` | Studie/Quelle | 8 | 83 |
| [ ] | `/wissen/probiotika-efsa-qps-update-2026` | Studie/Quelle | 6 | 83 |
| [ ] | `/wissen/probiotika-fda-preterm-invasive-disease-warning-2023` | Studie/Quelle | 7 | 83 |
| [ ] | `/wissen/probiotika-fsai-food-supplement-safety-2024` | Studie/Quelle | 6 | 83 |
| [ ] | `/wissen/probiotika-goldenberg-cdi-cochrane-2017` | Studie/Quelle | 8 | 83 |
| [ ] | `/wissen/probiotika-goodman-adult-aad-meta-2021` | Studie/Quelle | 7 | 83 |
| [ ] | `/wissen/probiotika-guo-pediatric-aad-cochrane-2019` | Studie/Quelle | 8 | 83 |
| [ ] | `/wissen/probiotika-hill-isapp-definition-2014` | Studie/Quelle | 7 | 83 |
| [ ] | `/wissen/probiotika-kelly-acg-cdi-guideline-2021` | Studie/Quelle | 7 | 83 |
| [ ] | `/wissen/probiotika-kim-atopic-dermatitis-meta-2025` | Studie/Quelle | 7 | 83 |
| [ ] | `/wissen/probiotika-lacy-acg-ibs-guideline-2021` | Studie/Quelle | 7 | 83 |
| [ ] | `/wissen/probiotika-liu-metabolic-syndrome-meta-2025` | Studie/Quelle | 7 | 83 |
| [ ] | `/wissen/probiotika-merenstein-commercial-product-quality-2019` | Studie/Quelle | 7 | 83 |
| [ ] | `/wissen/probiotika-nih-ods-fact-sheet-2025` | Studie/Quelle | 7 | 83 |
| [ ] | `/wissen/probiotika-sanders-safety-review-2023` | Studie/Quelle | 6 | 83 |
| [ ] | `/wissen/probiotika-tang-ibs-meta-tsa-2026` | Studie/Quelle | 7 | 83 |
| [ ] | `/wissen/q10` | Hauptartikel | 7 | 86 |
| [ ] | `/wissen/q10-bakri-male-infertility-2025` | Studie/Quelle | 7 | 83 |
| [ ] | `/wissen/q10-bfr-sicherheit-risiken-2023` | Studie/Quelle | 7 | 83 |
| [ ] | `/wissen/q10-dai-oxidative-stress-2022` | Studie/Quelle | 8 | 83 |
| [ ] | `/wissen/q10-deng-exercise-performance-2025` | Studie/Quelle | 7 | 83 |
| [ ] | `/wissen/q10-efsa-health-claims-2010` | Studie/Quelle | 6 | 83 |
| [ ] | `/wissen/q10-genereviews-primary-deficiency` | Studie/Quelle | 7 | 83 |
| [ ] | `/wissen/q10-health-canada-ubiquinone-monograph` | Studie/Quelle | 6 | 83 |
| [ ] | `/wissen/q10-karimi-blood-pressure-heart-rate-2025` | Studie/Quelle | 8 | 83 |
| [ ] | `/wissen/q10-kennedy-statin-myalgia-2020` | Studie/Quelle | 7 | 83 |
| [ ] | `/wissen/q10-kovacic-statin-myopathy-2025` | Studie/Quelle | 7 | 83 |
| [ ] | `/wissen/q10-lin-dor-ivf-2024` | Studie/Quelle | 8 | 83 |
| [ ] | `/wissen/q10-liu-lipid-profiles-2022` | Studie/Quelle | 7 | 83 |
| [ ] | `/wissen/q10-mei-ubiquinol-cocrystal-bioavailability-2026` | Studie/Quelle | 8 | 83 |
| [ ] | `/wissen/q10-mortensen-q-symbio-heart-failure-2014` | Studie/Quelle | 7 | 83 |
| [ ] | `/wissen/q10-musazadeh-glycemic-umbrella-2026` | Studie/Quelle | 7 | 83 |
| [ ] | `/wissen/q10-parkinson-qe3-negative-2014` | Studie/Quelle | 7 | 83 |
| [ ] | `/wissen/q10-pravst-formulation-bioavailability-2020` | Studie/Quelle | 7 | 83 |
| [ ] | `/wissen/q10-sazali-migraine-meta-2021` | Studie/Quelle | 7 | 83 |
| [ ] | `/wissen/q10-talebi-exercise-muscle-damage-2024` | Studie/Quelle | 7 | 83 |
| [ ] | `/wissen/q10-vkm-risk-assessment-2015` | Studie/Quelle | 8 | 83 |
| [ ] | `/wissen/q10-xu-heart-failure-meta-2024` | Studie/Quelle | 8 | 83 |
| [ ] | `/wissen/q10-zhang-metabolic-markers-2026` | Studie/Quelle | 7 | 83 |
| [ ] | `/wissen/quercetin` | Hauptartikel | 7 | 86 |
| [ ] | `/wissen/quercetin-atemwegsinfekte-rct-2010` | Studie/Quelle | 7 | 83 |
| [ ] | `/wissen/quercetin-efsa-health-claims-2011` | Studie/Quelle | 7 | 83 |
| [ ] | `/wissen/quercetin-im-blut-form-und-lebensmittelmatrix` | Studie/Quelle | 7 | 83 |
| [ ] | `/wissen/quercetin-kardiometabolische-marker-meta-analyse` | Studie/Quelle | 7 | 83 |
| [ ] | `/wissen/quercetin-masld-leberfett-meta-analyse` | Studie/Quelle | 7 | 83 |
| [ ] | `/wissen/quercetin-safety-review-2018` | Studie/Quelle | 6 | 83 |
| [ ] | `/wissen/quercetin-sport-leistung-erholung` | Studie/Quelle | 7 | 83 |
| [ ] | `/wissen/referenzwerte-fur-die-nahrstoffzufuhr-thiamin-001` | Studie/Quelle | 7 | 83 |
| [ ] | `/wissen/referenzwerte-fur-die-zufuhr-von-thiamin-003` | Studie/Quelle | 7 | 83 |
| [ ] | `/wissen/referenzwerte-fur-thiamin-riboflavin-niacin-vitamin-b6-fol-005` | Studie/Quelle | 7 | 83 |
| [ ] | `/wissen/rolle-der-thiaminsupplementierung-bei-der-behandlung-chron-044` | Studie/Quelle | 7 | 83 |
| [ ] | `/wissen/saccharomyces-boulardii` | Hauptartikel | 8 | 86 |
| [ ] | `/wissen/saccharomyces-boulardii-acg-cdi-guideline-2021` | Studie/Quelle | 7 | 83 |
| [ ] | `/wissen/saccharomyces-boulardii-aga-probiotics-guideline-2020` | Studie/Quelle | 6 | 83 |
| [ ] | `/wissen/saccharomyces-boulardii-chen-hpylori-bismuth-quadruple-meta-2024` | Studie/Quelle | 4 | 83 |
| [ ] | `/wissen/saccharomyces-boulardii-efsa-cncm-i-1079-health-claim-2012` | Studie/Quelle | 8 | 83 |
| [ ] | `/wissen/saccharomyces-boulardii-ehrhardt-aad-rct-2016` | Studie/Quelle | 6 | 83 |
| [ ] | `/wissen/saccharomyces-boulardii-esmaeilinezhad-cdad-cochrane-2025` | Studie/Quelle | 8 | 83 |
| [ ] | `/wissen/saccharomyces-boulardii-famhp-fungaemia-warning-2018` | Studie/Quelle | 6 | 83 |
| [ ] | `/wissen/saccharomyces-boulardii-health-canada-probiotics-monograph-2026` | Studie/Quelle | 6 | 83 |
| [ ] | `/wissen/saccharomyces-boulardii-li-xie-hpylori-adjuvant-meta-2025` | Studie/Quelle | 7 | 83 |
| [ ] | `/wissen/saccharomyces-boulardii-mcfarland-goh-travellers-diarrhea-meta-2019` | Studie/Quelle | 7 | 83 |
| [ ] | `/wissen/saccharomyces-boulardii-mcfarland-li-pediatric-acute-diarrhea-china-2025` | Studie/Quelle | 8 | 83 |
| [ ] | `/wissen/saccharomyces-boulardii-rannikko-fungemia-case-control-2021` | Studie/Quelle | 7 | 83 |
| [ ] | `/wissen/saccharomyces-boulardii-szajewska-kolodziej-aad-meta-2015` | Studie/Quelle | 8 | 83 |
| [ ] | `/wissen/saccharomyces-boulardii-szajewska-pediatric-age-update-2020` | Studie/Quelle | 7 | 83 |
| [ ] | `/wissen/schwarzkuemmeloel` | Hauptartikel | 7 | 86 |
| [ ] | `/wissen/schwarzkuemmeloel-abdel-razek-oil-quality-2024` | Studie/Quelle | 7 | 83 |
| [ ] | `/wissen/schwarzkuemmeloel-efsa-botanical-claims-on-hold-2021` | Studie/Quelle | 8 | 83 |
| [ ] | `/wissen/schwarzkuemmeloel-hannan-phytochemistry-safety-2021` | Studie/Quelle | 7 | 83 |
| [ ] | `/wissen/schwarzkuemmeloel-he-rhinitis-2024` | Studie/Quelle | 7 | 83 |
| [ ] | `/wissen/schwarzkuemmeloel-he-xu-asthma-2020` | Studie/Quelle | 8 | 83 |
| [ ] | `/wissen/schwarzkuemmeloel-health-canada-npn-80124888` | Studie/Quelle | 7 | 83 |
| [ ] | `/wissen/schwarzkuemmeloel-jafari-cvd-risk-dose-response-2025` | Studie/Quelle | 7 | 83 |
| [ ] | `/wissen/schwarzkuemmeloel-kavyani-blood-pressure-2023` | Studie/Quelle | 7 | 83 |
| [ ] | `/wissen/schwarzkuemmeloel-lan-xia-inflammation-oxidative-stress-2025` | Studie/Quelle | 7 | 83 |
| [ ] | `/wissen/schwarzkuemmeloel-majeed-5pct-tq-oil-allergy-2024` | Studie/Quelle | 7 | 83 |
| [ ] | `/wissen/schwarzkuemmeloel-mashayekhi-sardoo-safety-2020` | Studie/Quelle | 6 | 83 |
| [ ] | `/wissen/schwarzkuemmeloel-musazadeh-cardiometabolic-2026` | Studie/Quelle | 7 | 83 |
| [ ] | `/wissen/schwarzkuemmeloel-nasiri-skin-disease-2022` | Studie/Quelle | 7 | 83 |
| [ ] | `/wissen/schwarzkuemmeloel-rasff-pah-contamination-2025` | Studie/Quelle | 7 | 83 |
| [ ] | `/wissen/schwarzkuemmeloel-razmpoosh-liver-kidney-2020` | Studie/Quelle | 7 | 83 |
| [ ] | `/wissen/schwarzkuemmeloel-tekbas-thymoquinone-oil-serum-2023` | Studie/Quelle | 7 | 83 |
| [ ] | `/wissen/schwarzkuemmeloel-thomas-tq-rich-oil-safety-2022` | Studie/Quelle | 7 | 83 |
| [ ] | `/wissen/selen` | Hauptartikel | 7 | 86 |
| [ ] | `/wissen/selen-bfr-hoechstmengen-bvl-abgrenzung` | Studie/Quelle | 7 | 83 |
| [ ] | `/wissen/selen-catalyst-larsen-qol` | Studie/Quelle | 7 | 83 |
| [ ] | `/wissen/selen-cvd-mortalitaet-jenkins` | Studie/Quelle | 7 | 83 |
| [ ] | `/wissen/selen-dach-referenzwerte-kipp-dge` | Studie/Quelle | 8 | 83 |
| [ ] | `/wissen/selen-diabetes-review-vinceti` | Studie/Quelle | 7 | 83 |
| [ ] | `/wissen/selen-efsa-drv-2014` | Studie/Quelle | 7 | 83 |
| [ ] | `/wissen/selen-efsa-ul-2023` | Studie/Quelle | 7 | 83 |
| [ ] | `/wissen/selen-entzuendung-crp-review` | Studie/Quelle | 7 | 83 |
| [ ] | `/wissen/selen-formen-bioverfuegbarkeit-review` | Studie/Quelle | 7 | 83 |
| [ ] | `/wissen/selen-gestationsdiabetes-kong` | Studie/Quelle | 8 | 83 |
| [ ] | `/wissen/selen-graves-hyperthyreose-grass` | Studie/Quelle | 8 | 83 |
| [ ] | `/wissen/selen-graves-orbitopathie-marcocci-kahaly` | Studie/Quelle | 8 | 83 |
| [ ] | `/wissen/selen-hashimoto-huwiler-meta` | Studie/Quelle | 7 | 83 |
| [ ] | `/wissen/selen-hashimoto-ohne-mangel-toriah` | Studie/Quelle | 7 | 83 |
| [ ] | `/wissen/selen-hashimoto-zhang-update` | Studie/Quelle | 8 | 83 |
| [ ] | `/wissen/selen-herzchirurgie-stoppe` | Studie/Quelle | 7 | 83 |
| [ ] | `/wissen/selen-human-selenose-yang` | Studie/Quelle | 7 | 83 |
| [ ] | `/wissen/selen-internationale-referenzwerte-who-nasem-nnr` | Studie/Quelle | 8 | 83 |
| [ ] | `/wissen/selen-kashin-beck-kinder-defizienzregion` | Studie/Quelle | 7 | 83 |
| [ ] | `/wissen/selen-krebspraevention-cochrane-vinceti` | Studie/Quelle | 7 | 83 |
| [ ] | `/wissen/selen-kritisch-kranke-alhazzani` | Studie/Quelle | 7 | 83 |
| [ ] | `/wissen/selen-l-selenomethionin-efsa` | Studie/Quelle | 6 | 83 |
| [ ] | `/wissen/selen-lipide-urbano-dosiswirkung` | Studie/Quelle | 7 | 83 |
| [ ] | `/wissen/selen-mangel-keshan-kashin-beck` | Studie/Quelle | 7 | 83 |
| [ ] | `/wissen/selen-npc-clark-krebshypothese` | Studie/Quelle | 7 | 83 |
| [ ] | `/wissen/selen-npc-diabetes-stranges-algotar` | Studie/Quelle | 8 | 83 |
| [ ] | `/wissen/selen-schwangerschaft-review-mcdougall` | Studie/Quelle | 7 | 83 |
| [ ] | `/wissen/selen-selcel-lance-adenome-diabetes` | Studie/Quelle | 8 | 83 |
| [ ] | `/wissen/selen-select-kristal-hochstatus` | Studie/Quelle | 7 | 83 |
| [ ] | `/wissen/selen-select-lippman-krebs-sicherheit` | Studie/Quelle | 7 | 83 |
| [ ] | `/wissen/selen-selenhefe-efsa-rayman` | Studie/Quelle | 7 | 83 |
| [ ] | `/wissen/selen-sprint-praeeklampsie-marker` | Studie/Quelle | 8 | 83 |
| [ ] | `/wissen/selen-statusabhaengigkeit-u-kurve-rayman` | Studie/Quelle | 6 | 83 |
| [ ] | `/wissen/selen-statusmarker-combs-selenoprotein-p` | Studie/Quelle | 7 | 83 |
| [ ] | `/wissen/selen-supplement-toxizitaet-macfarquhar` | Studie/Quelle | 7 | 83 |
| [ ] | `/wissen/selen-versorgung-europa-schweiz-finnland` | Studie/Quelle | 7 | 83 |
| [ ] | `/wissen/spirulina` | Hauptartikel | 6 | 86 |
| [ ] | `/wissen/spirulina-allergie-gromek-2024-review` | Studie/Quelle | 7 | 83 |
| [ ] | `/wissen/spirulina-anses-sicherheit-2017` | Studie/Quelle | 5 | 83 |
| [ ] | `/wissen/spirulina-b12-bioavailability-watanabe-2003` | Studie/Quelle | 7 | 83 |
| [ ] | `/wissen/spirulina-blue-green-algae-microcystins-fda-2024` | Studie/Quelle | 7 | 83 |
| [ ] | `/wissen/spirulina-blutdruck-machowiec-2021-meta` | Studie/Quelle | 7 | 83 |
| [ ] | `/wissen/spirulina-body-composition-meta-2025` | Studie/Quelle | 7 | 83 |
| [ ] | `/wissen/spirulina-crp-meta-2025` | Studie/Quelle | 7 | 83 |
| [ ] | `/wissen/spirulina-french-production-microcystins-2023` | Studie/Quelle | 7 | 83 |
| [ ] | `/wissen/spirulina-fu-2025-kardiometabolik-exercise-meta` | Studie/Quelle | 7 | 83 |
| [ ] | `/wissen/spirulina-glucose-ghanbari-2022-meta` | Studie/Quelle | 7 | 83 |
| [ ] | `/wissen/spirulina-limnospira-microcystin-taxonomie-pinchart-2024` | Studie/Quelle | 7 | 83 |
| [ ] | `/wissen/spirulina-lipide-rahnama-2023-dose-response` | Studie/Quelle | 7 | 83 |
| [ ] | `/wissen/spirulina-livertox-leber-sicherheit` | Studie/Quelle | 6 | 83 |
| [ ] | `/wissen/spirulina-microcystin-supplements-gilroy-2000` | Studie/Quelle | 7 | 83 |
| [ ] | `/wissen/spirulina-microcystins-who-2020-background` | Studie/Quelle | 6 | 83 |
| [ ] | `/wissen/spirulina-naehrstoffprofil-usda-fooddata` | Studie/Quelle | 9 | 83 |
| [ ] | `/wissen/spirulina-pseudovitamin-b12-watanabe-1999` | Studie/Quelle | 7 | 83 |
| [ ] | `/wissen/spirulina-retail-microbiota-cyanotoxins-2023` | Studie/Quelle | 6 | 83 |
| [ ] | `/wissen/strategien-zur-thiaminanreicherung-in-landern-mit-niedrige-022` | Studie/Quelle | 5 | 83 |
| [ ] | `/wissen/systematischer-review-zur-thiaminsupplementierung-bei-diab-046` | Studie/Quelle | 6 | 83 |
| [ ] | `/wissen/thiamin-fachinformationen-fur-gesundheitsberufe-004` | Studie/Quelle | 7 | 83 |
| [ ] | `/wissen/thiaminmangel-bei-gambischen-frauen-im-gebarfahigen-alter-031` | Studie/Quelle | 7 | 83 |
| [ ] | `/wissen/thiaminmangel-bei-kambodschanischen-sauglingen-mit-und-ohn-025` | Studie/Quelle | 7 | 83 |
| [ ] | `/wissen/thiaminmangel-und-herzfunktionsstorungen-bei-kambodschanis-026` | Studie/Quelle | 7 | 83 |
| [ ] | `/wissen/thiaminmangel-und-seine-pravention-und-kontrolle-in-grosse-006` | Studie/Quelle | 5 | 83 |
| [ ] | `/wissen/thiaminmangelerkrankungen-diagnose-pravalenz-und-fahrplan-020` | Studie/Quelle | 5 | 83 |
| [ ] | `/wissen/vitamin-a` | Hauptartikel | 8 | 86 |
| [ ] | `/wissen/vitamin-a-10-antioxidant-supplements-for-prevention-of-mortality-in-healthy-participants-2012` | Studie/Quelle | 6 | 83 |
| [ ] | `/wissen/vitamin-a-17-vitamin-a-supplements-for-preventing-mortality-illness-and-blindness-2011` | Studie/Quelle | 7 | 83 |
| [ ] | `/wissen/vitamin-a-21-biomarkers-of-nutrition-for-development-bond-vitamin-a-review-2016` | Studie/Quelle | 7 | 83 |
| [ ] | `/wissen/vitamin-a-22-vitamin-a-update-forms-sources-kinetics-detection-function-deficiency-2021` | Studie/Quelle | 6 | 83 |
| [ ] | `/wissen/vitamin-a-29-vitamin-a-intake-and-hip-fractures-among-postmenopausal-women-2002` | Studie/Quelle | 7 | 83 |
| [ ] | `/wissen/vitamin-a-30-vitamin-a-and-bone-fractures-systematic-review-and-meta-2021` | Studie/Quelle | 8 | 83 |
| [ ] | `/wissen/vitamin-a-43-vitamin-a-and-beta-carotene-a-scoping-review-for-2023` | Studie/Quelle | 7 | 83 |
| [ ] | `/wissen/vitamin-a-5-vitamin-a-supplementation-for-preventing-morbidity-and-mortality-in-2022` | Studie/Quelle | 7 | 83 |
| [ ] | `/wissen/vitamin-a-56-nepal-child-mortality-1991` | Studie/Quelle | 7 | 83 |
| [ ] | `/wissen/vitamin-a-57-vitamin-a-supplementation-in-northern-ghana-1993` | Studie/Quelle | 7 | 83 |
| [ ] | `/wissen/vitamin-a-58-trends-and-mortality-effects-of-vitamin-a-deficiency-in-2015` | Studie/Quelle | 7 | 83 |
| [ ] | `/wissen/vitamin-a-59-vitamin-a-supplements-and-mortality-related-to-measles-1987` | Studie/Quelle | 7 | 83 |
| [ ] | `/wissen/vitamin-a-6-vitamin-a-supplementation-during-pregnancy-for-maternal-and-newborn-2015` | Studie/Quelle | 7 | 83 |
| [ ] | `/wissen/vitamin-a-61-nepal-maternal-mortality-1999` | Studie/Quelle | 7 | 83 |
| [ ] | `/wissen/vitamin-a-62-effect-of-vitamin-a-supplementation-in-women-of-reproductive-age-on-maternal-survival-in-ghana-obaapavita-2010` | Studie/Quelle | 7 | 83 |
| [ ] | `/wissen/vitamin-a-64-vitamin-a-supplementation-for-infants-one-to-six-months-2016` | Studie/Quelle | 8 | 83 |
| [ ] | `/wissen/vitamin-a-65-neonatal-vitamin-a-supplementation-for-prevention-of-mortality-and-2017` | Studie/Quelle | 7 | 83 |
| [ ] | `/wissen/vitamin-a-67-epidemiology-of-vitamin-a-deficiency-and-xerophthalmia-2012` | Studie/Quelle | 5 | 83 |
| [ ] | `/wissen/vitamin-a-7-vitamin-a-supplementation-for-postpartum-women-2016` | Studie/Quelle | 7 | 83 |
| [ ] | `/wissen/vitamin-a-70-mortality-in-randomized-trials-of-antioxidant-supplements-for-primary-2007` | Studie/Quelle | 7 | 83 |
| [ ] | `/wissen/vitamin-a-71-beta-carotene-supplementation-and-mortality-risk-2022` | Studie/Quelle | 7 | 83 |
| [ ] | `/wissen/vitamin-a-72-beta-carotene-supplementation-and-risk-of-cardiovascular-disease-2022` | Studie/Quelle | 6 | 83 |
| [ ] | `/wissen/vitamin-a-73-use-of-antioxidant-vitamins-for-the-prevention-of-cardiovascular-disease-2003` | Studie/Quelle | 7 | 83 |
| [ ] | `/wissen/vitamin-a-74-vitamin-a-and-retinoid-derivatives-for-lung-cancer-2011` | Studie/Quelle | 6 | 83 |
| [ ] | `/wissen/vitamin-a-75-dietary-vitamin-a-and-beta-carotene-intake-and-risk-2015` | Studie/Quelle | 7 | 83 |
| [ ] | `/wissen/vitamin-a-76-blood-concentrations-of-carotenoids-and-retinol-and-lung-cancer-2016` | Studie/Quelle | 7 | 83 |
| [ ] | `/wissen/vitamin-a-77-areds-report-35-amd-2013` | Studie/Quelle | 7 | 83 |
| [ ] | `/wissen/vitamin-a-79-retinol-intake-and-bone-fracture-risk-a-meta-analysis-2014` | Studie/Quelle | 7 | 83 |
| [ ] | `/wissen/vitamin-a-8-vitamin-a-for-treating-measles-in-children-2005` | Studie/Quelle | 7 | 83 |
| [ ] | `/wissen/vitamin-a-80-vitamin-a-and-risk-of-fracture-a-meta-analysis-2017` | Studie/Quelle | 7 | 83 |
| [ ] | `/wissen/vitamin-a-81-vitamin-a-supplementation-and-fracture-risk-intervention-follow-up-2013` | Studie/Quelle | 7 | 83 |
| [ ] | `/wissen/vitamin-a-9-vitamin-a-supplementation-to-prevent-mortality-and-short-and-2016` | Studie/Quelle | 7 | 83 |
| [ ] | `/wissen/vitamin-a-areds-original-2001` | Studie/Quelle | 7 | 83 |
| [ ] | `/wissen/vitamin-a-areds2-2013` | Studie/Quelle | 7 | 83 |
| [ ] | `/wissen/vitamin-a-areds2-report-28-2022` | Studie/Quelle | 7 | 83 |
| [ ] | `/wissen/vitamin-a-atbc-1994` | Studie/Quelle | 7 | 83 |
| [ ] | `/wissen/vitamin-a-caret-1996` | Studie/Quelle | 7 | 83 |
| [ ] | `/wissen/vitamin-a-devta-2013` | Studie/Quelle | 7 | 83 |
| [ ] | `/wissen/vitamin-a-elbw-infants-1999` | Studie/Quelle | 7 | 83 |
| [ ] | `/wissen/vitamin-a-jivita-1-2011` | Studie/Quelle | 7 | 83 |
| [ ] | `/wissen/vitamin-a-linxian-follow-up-2009` | Studie/Quelle | 8 | 83 |
| [ ] | `/wissen/vitamin-a-linxian-nutrition-intervention-1993` | Studie/Quelle | 7 | 83 |
| [ ] | `/wissen/vitamin-a-physicians-health-1996` | Studie/Quelle | 7 | 83 |
| [ ] | `/wissen/vitamin-a-rothman-1995` | Studie/Quelle | 7 | 83 |
| [ ] | `/wissen/vitamin-a-severe-measles-hussey-klein-1990` | Studie/Quelle | 7 | 83 |
| [ ] | `/wissen/vitamin-b1` | Hauptartikel | 6 | 86 |
| [ ] | `/wissen/vitamin-b12` | Hauptartikel | 7 | 86 |
| [ ] | `/wissen/vitamin-b12-5-deoxyadenosylcobalamin-and-methylcobalamin-as-sources-fo-441` | Studie/Quelle | 6 | 83 |
| [ ] | `/wissen/vitamin-b12-a-systematic-review-and-meta-analysis-of-functional-vitami-468` | Studie/Quelle | 5 | 83 |
| [ ] | `/wissen/vitamin-b12-ausgewahlte-fragen-und-antworten-zu-vitamin-b12-435` | Studie/Quelle | 7 | 83 |
| [ ] | `/wissen/vitamin-b12-cancer-incidence-and-mortality-after-treatment-with-folic-489` | Studie/Quelle | 7 | 83 |
| [ ] | `/wissen/vitamin-b12-clinical-practice-vitamin-b12-deficiency-458` | Studie/Quelle | 6 | 83 |
| [ ] | `/wissen/vitamin-b12-cobalamin-coenzyme-forms-are-not-likely-to-be-superior-to-479` | Studie/Quelle | 6 | 83 |
| [ ] | `/wissen/vitamin-b12-dietary-reference-intakes-tables-reference-values-for-vita-452` | Studie/Quelle | 7 | 83 |
| [ ] | `/wissen/vitamin-b12-effects-of-vitamin-b12-and-folate-deficiency-on-brain-deve-473` | Studie/Quelle | 7 | 83 |
| [ ] | `/wissen/vitamin-b12-elevated-plasma-vitamin-b12-levels-as-a-marker-for-cancer-490` | Studie/Quelle | 8 | 83 |
| [ ] | `/wissen/vitamin-b12-eu-register-of-nutrition-and-health-claims-made-on-foods-455` | Studie/Quelle | 7 | 83 |
| [ ] | `/wissen/vitamin-b12-global-estimation-of-dietary-micronutrient-inadequacies-a-462` | Studie/Quelle | 6 | 83 |
| [ ] | `/wissen/vitamin-b12-hochstmengen-fur-vitamin-b12-in-lebensmitteln-inklusive-na-450` | Studie/Quelle | 7 | 83 |
| [ ] | `/wissen/vitamin-b12-how-common-is-vitamin-b-12-deficiency-460` | Studie/Quelle | 7 | 83 |
| [ ] | `/wissen/vitamin-b12-how-prevalent-is-vitamin-b12-deficiency-among-vegetarians-465` | Studie/Quelle | 6 | 83 |
| [ ] | `/wissen/vitamin-b12-kinetics-of-cellular-cobalamin-uptake-and-conversion-compa-480` | Studie/Quelle | 6 | 83 |
| [ ] | `/wissen/vitamin-b12-long-term-metformin-use-and-vitamin-b12-deficiency-in-the-482` | Studie/Quelle | 7 | 83 |
| [ ] | `/wissen/vitamin-b12-long-term-supplemental-one-carbon-metabolism-related-vitam-488` | Studie/Quelle | 7 | 83 |
| [ ] | `/wissen/vitamin-b12-long-term-treatment-with-metformin-in-patients-with-type-2-481` | Studie/Quelle | 8 | 83 |
| [ ] | `/wissen/vitamin-b12-monitoring-of-vitamin-b-12-nutritional-status-in-the-unite-461` | Studie/Quelle | 7 | 83 |
| [ ] | `/wissen/vitamin-b12-neubewertung-der-dge-position-zu-veganer-ernahrung-2024-436` | Studie/Quelle | 6 | 83 |
| [ ] | `/wissen/vitamin-b12-nutrient-reference-values-for-australia-and-new-zealand-in-453` | Studie/Quelle | 7 | 83 |
| [ ] | `/wissen/vitamin-b12-prevalence-of-vitamin-b-12-insufficiency-during-pregnancy-472` | Studie/Quelle | 7 | 83 |
| [ ] | `/wissen/vitamin-b12-proton-pump-inhibitor-and-histamine-2-receptor-antagonist-483` | Studie/Quelle | 8 | 83 |
| [ ] | `/wissen/vitamin-b12-sacn-statement-on-nutrition-and-older-adults-living-in-the-454` | Studie/Quelle | 7 | 83 |
| [ ] | `/wissen/vitamin-b12-scientific-opinion-on-dietary-reference-values-for-cobalam-439` | Studie/Quelle | 7 | 83 |
| [ ] | `/wissen/vitamin-b12-scientific-opinion-on-the-substantiation-of-health-claims-440` | Studie/Quelle | 6 | 83 |
| [ ] | `/wissen/vitamin-b12-the-revised-d-a-ch-reference-values-for-the-intake-of-vita-438` | Studie/Quelle | 8 | 83 |
| [ ] | `/wissen/vitamin-b12-vitamin-and-mineral-requirements-in-human-nutrition-2nd-ed-444` | Studie/Quelle | 8 | 83 |
| [ ] | `/wissen/vitamin-b12-vitamin-b-12-and-perinatal-health-471` | Studie/Quelle | 6 | 83 |
| [ ] | `/wissen/vitamin-b12-vitamin-b12-a-scoping-review-for-nordic-nutrition-recommen-446` | Studie/Quelle | 7 | 83 |
| [ ] | `/wissen/vitamin-b12-vitamin-b12-among-vegetarians-status-assessment-and-supple-466` | Studie/Quelle | 6 | 83 |
| [ ] | `/wissen/vitamin-b12-vitamin-b12-bei-pflanzenbasierter-ernahrung-besonders-auf-451` | Studie/Quelle | 7 | 83 |
| [ ] | `/wissen/vitamin-b12-vitamin-b12-cobalamine-referenzwerte-434` | Studie/Quelle | 8 | 83 |
| [ ] | `/wissen/vitamin-b12-vitamin-b12-containing-plant-food-sources-for-vegetarians-464` | Studie/Quelle | 7 | 83 |
| [ ] | `/wissen/vitamin-b12-vitamin-b12-deficiency-457` | Studie/Quelle | 7 | 83 |
| [ ] | `/wissen/vitamin-b12-vitamin-b12-deficiency-a-21st-century-perspective-459` | Studie/Quelle | 6 | 83 |
| [ ] | `/wissen/vitamin-b12-vitamin-b12-dietary-reference-intakes-for-thiamin-riboflav-443` | Studie/Quelle | 7 | 83 |
| [ ] | `/wissen/vitamin-b12-vitamin-b12-health-professional-fact-sheet-442` | Studie/Quelle | 7 | 83 |
| [ ] | `/wissen/vitamin-b12-vitamin-b12-in-health-and-disease-456` | Studie/Quelle | 7 | 83 |
| [ ] | `/wissen/vitamin-b12-vitamin-b12-nordic-nutrition-recommendations-2023-445` | Studie/Quelle | 7 | 83 |
| [ ] | `/wissen/vitamin-b12-vitamin-b12-sources-and-bioavailability-463` | Studie/Quelle | 6 | 83 |
| [ ] | `/wissen/vitamin-b12-vitamin-b12-status-and-supplementation-in-plant-based-diet-469` | Studie/Quelle | 7 | 83 |
| [ ] | `/wissen/vitamin-b2` | Hauptartikel | 7 | 86 |
| [ ] | `/wissen/vitamin-b2-evidenzueberblick` | Studie/Quelle | 6 | 83 |
| [ ] | `/wissen/vitamin-b3` | Hauptartikel | 7 | 86 |
| [ ] | `/wissen/vitamin-b3-evidenzueberblick` | Studie/Quelle | 5 | 83 |
| [ ] | `/wissen/vitamin-b5` | Hauptartikel | 7 | 86 |
| [ ] | `/wissen/vitamin-b5-evidenzueberblick` | Studie/Quelle | 5 | 83 |
| [ ] | `/wissen/vitamin-b6` | Hauptartikel | 7 | 86 |
| [ ] | `/wissen/vitamin-b6-evidenz-versorgung-sicherheit` | Studie/Quelle | 6 | 83 |
| [ ] | `/wissen/vitamin-b7` | Hauptartikel | 8 | 86 |
| [ ] | `/wissen/vitamin-b7-evidenz-biotin-status-labortests` | Studie/Quelle | 6 | 83 |
| [ ] | `/wissen/vitamin-b9` | Hauptartikel | 7 | 86 |
| [ ] | `/wissen/vitamin-b9-evidenz-folat-versorgung-sicherheit` | Studie/Quelle | 5 | 83 |
| [ ] | `/wissen/vitamin-c` | Hauptartikel | 7 | 86 |
| [ ] | `/wissen/vitamin-c-aufnahme-weltweit-modellierung` | Studie/Quelle | 7 | 83 |
| [ ] | `/wissen/vitamin-c-bekanntes-unbekanntes-richtiges-mass` | Studie/Quelle | 6 | 83 |
| [ ] | `/wissen/vitamin-c-biomarker-herz-kreislauf-umbrella-review` | Studie/Quelle | 5 | 83 |
| [ ] | `/wissen/vitamin-c-dge-referenzwerte` | Studie/Quelle | 7 | 83 |
| [ ] | `/wissen/vitamin-c-efsa-referenzwerte` | Studie/Quelle | 7 | 83 |
| [ ] | `/wissen/vitamin-c-erkaeltungen-vorbeugung-behandlung` | Studie/Quelle | 7 | 83 |
| [ ] | `/wissen/vitamin-c-fachinformation-gesundheitsberufe` | Studie/Quelle | 7 | 83 |
| [ ] | `/wissen/vitamin-c-fragen-und-antworten-dge` | Studie/Quelle | 7 | 83 |
| [ ] | `/wissen/vitamin-c-lungenentzuendung-praevention-behandlung` | Studie/Quelle | 7 | 83 |
| [ ] | `/wissen/vitamin-c-mangel-australien-scoping-review` | Studie/Quelle | 7 | 83 |
| [ ] | `/wissen/vitamin-c-nordische-ernaehrungsempfehlungen-2023` | Studie/Quelle | 7 | 83 |
| [ ] | `/wissen/vitamin-c-obere-aufnahmemenge-efsa` | Studie/Quelle | 7 | 83 |
| [ ] | `/wissen/vitamin-c-pharmakokinetik-gesunde-freiwillige` | Studie/Quelle | 7 | 83 |
| [ ] | `/wissen/vitamin-c-physicians-health-study-herz-kreislauf` | Studie/Quelle | 7 | 83 |
| [ ] | `/wissen/vitamin-c-praeparate-nierensteine-maenner` | Studie/Quelle | 7 | 83 |
| [ ] | `/wissen/vitamin-c-scoping-review-nnr-2023` | Studie/Quelle | 7 | 83 |
| [ ] | `/wissen/vitamin-c-sekundaerpraevention-frauen-herz-kreislauf` | Studie/Quelle | 7 | 83 |
| [ ] | `/wissen/vitamin-c-status-einflussfaktoren-global` | Studie/Quelle | 5 | 83 |
| [ ] | `/wissen/vitamin-c-status-mangel-global-review` | Studie/Quelle | 6 | 83 |
| [ ] | `/wissen/vitamin-c-zufuhr-nierensteine-kohorten` | Studie/Quelle | 7 | 83 |
| [ ] | `/wissen/vitamin-d` | Hauptartikel | 7 | 86 |
| [ ] | `/wissen/vitamin-d-atemwegsinfektionen-aktualisierte-meta` | Studie/Quelle | 5 | 83 |
| [ ] | `/wissen/vitamin-d-atemwegsinfektionen-ipd-meta` | Studie/Quelle | 5 | 83 |
| [ ] | `/wissen/vitamin-d-bfr-hoechstmengen` | Studie/Quelle | 4 | 83 |
| [ ] | `/wissen/vitamin-d-calcifediol-cholecalciferol` | Studie/Quelle | 6 | 83 |
| [ ] | `/wissen/vitamin-d-calcium-frakturen-stuerze` | Studie/Quelle | 6 | 83 |
| [ ] | `/wissen/vitamin-d-dge-referenzwerte` | Studie/Quelle | 6 | 83 |
| [ ] | `/wissen/vitamin-d-dge-versorgung` | Studie/Quelle | 7 | 83 |
| [ ] | `/wissen/vitamin-d-diabetes-praevention-d2d` | Studie/Quelle | 7 | 83 |
| [ ] | `/wissen/vitamin-d-efsa-obergrenze-sicherheit` | Studie/Quelle | 5 | 83 |
| [ ] | `/wissen/vitamin-d-efsa-referenzwerte` | Studie/Quelle | 5 | 83 |
| [ ] | `/wissen/vitamin-d-endocrine-society-leitlinie` | Studie/Quelle | 5 | 83 |
| [ ] | `/wissen/vitamin-d-finnische-studie-krebs-herz` | Studie/Quelle | 7 | 83 |
| [ ] | `/wissen/vitamin-d-gesundheitsoutcomes-umbrella-review` | Studie/Quelle | 6 | 83 |
| [ ] | `/wissen/vitamin-d-herz-kreislauf-meta` | Studie/Quelle | 6 | 83 |
| [ ] | `/wissen/vitamin-d-hochdosis-knochendichte` | Studie/Quelle | 6 | 83 |
| [ ] | `/wissen/vitamin-d-knochendichte-meta` | Studie/Quelle | 6 | 83 |
| [ ] | `/wissen/vitamin-d-krebs-meta` | Studie/Quelle | 6 | 83 |
| [ ] | `/wissen/vitamin-d-langzeitsicherheit-meta` | Studie/Quelle | 6 | 83 |
| [ ] | `/wissen/vitamin-d-mangel-europa` | Studie/Quelle | 6 | 83 |
| [ ] | `/wissen/vitamin-d-nasem-referenzwerte` | Studie/Quelle | 5 | 83 |
| [ ] | `/wissen/vitamin-d-nih-fachinformation` | Studie/Quelle | 6 | 83 |
| [ ] | `/wissen/vitamin-d-nordische-empfehlungen` | Studie/Quelle | 5 | 83 |
| [ ] | `/wissen/vitamin-d-outcomes-trial-sequential-meta` | Studie/Quelle | 6 | 83 |
| [ ] | `/wissen/vitamin-d-rachitis-konsensus` | Studie/Quelle | 6 | 83 |
| [ ] | `/wissen/vitamin-d-sacn-bericht` | Studie/Quelle | 5 | 83 |
| [ ] | `/wissen/vitamin-d-status-degs1` | Studie/Quelle | 7 | 83 |
| [ ] | `/wissen/vitamin-d-status-weltweit-2014` | Studie/Quelle | 6 | 83 |
| [ ] | `/wissen/vitamin-d-status-weltweit-2025` | Studie/Quelle | 7 | 83 |
| [ ] | `/wissen/vitamin-d-supplementierung-sterblichkeit` | Studie/Quelle | 5 | 83 |
| [ ] | `/wissen/vitamin-d-toxizitaet-klinische-perspektive` | Studie/Quelle | 6 | 83 |
| [ ] | `/wissen/vitamin-d-vital-fortgeschrittener-krebs` | Studie/Quelle | 6 | 83 |
| [ ] | `/wissen/vitamin-d-vital-frakturen` | Studie/Quelle | 6 | 83 |
| [ ] | `/wissen/vitamin-d2-d3-meta-2012` | Studie/Quelle | 7 | 83 |
| [ ] | `/wissen/vitamin-d2-d3-meta-2021` | Studie/Quelle | 7 | 83 |
| [ ] | `/wissen/vitamin-e` | Hauptartikel | 7 | 86 |
| [ ] | `/wissen/vitamin-e-evidenzquellen` | Studie/Quelle | 6 | 83 |
| [ ] | `/wissen/vitamin-k` | Hauptartikel | 7 | 86 |
| [ ] | `/wissen/vitamin-k-a-high-menaquinone-intake-reduces-the-incidence-of-coronar-686` | Studie/Quelle | 8 | 83 |
| [ ] | `/wissen/vitamin-k-association-between-circulating-vitamin-k1-and-coronary-ca-641` | Studie/Quelle | 8 | 83 |
| [ ] | `/wissen/vitamin-k-chapter-10-vitamin-k-606` | Studie/Quelle | 6 | 83 |
| [ ] | `/wissen/vitamin-k-cis-and-trans-isomers-of-the-vitamin-menaquinone-7-which-o-674` | Studie/Quelle | 7 | 83 |
| [ ] | `/wissen/vitamin-k-comparative-dietary-intake-and-sources-of-phylloquinone-vi-629` | Studie/Quelle | 7 | 83 |
| [ ] | `/wissen/vitamin-k-comparison-of-menaquinone-4-and-menaquinone-7-bioavailabil-672` | Studie/Quelle | 8 | 83 |
| [ ] | `/wissen/vitamin-k-comparison-of-phylloquinone-bioavailability-from-food-sour-626` | Studie/Quelle | 8 | 83 |
| [ ] | `/wissen/vitamin-k-concepts-and-controversies-in-evaluating-vitamin-k-status-630` | Studie/Quelle | 7 | 83 |
| [ ] | `/wissen/vitamin-k-dietary-intake-of-menaquinone-is-associated-with-a-reduced-648` | Studie/Quelle | 8 | 83 |
| [ ] | `/wissen/vitamin-k-dietary-reference-intakes-for-japanese-2020-612` | Studie/Quelle | 6 | 83 |
| [ ] | `/wissen/vitamin-k-dietary-reference-intakes-tables-reference-values-for-vita-609` | Studie/Quelle | 7 | 83 |
| [ ] | `/wissen/vitamin-k-dietary-reference-values-for-vitamin-k-603` | Studie/Quelle | 6 | 83 |
| [ ] | `/wissen/vitamin-k-dietary-vitamin-k1-intake-is-associated-with-lower-long-te-647` | Studie/Quelle | 8 | 83 |
| [ ] | `/wissen/vitamin-k-effect-of-low-dose-supplements-of-menaquinone-7-vitamin-k2-698` | Studie/Quelle | 7 | 83 |
| [ ] | `/wissen/vitamin-k-effect-of-vitamin-k-on-bone-mineral-density-and-fracture-r-633` | Studie/Quelle | 7 | 83 |
| [ ] | `/wissen/vitamin-k-efficacy-of-vitamin-k2-in-the-prevention-and-treatment-of-676` | Studie/Quelle | 6 | 83 |
| [ ] | `/wissen/vitamin-k-further-assessment-on-vitamin-k2-and-contribution-to-the-n-661` | Studie/Quelle | 7 | 83 |
| [ ] | `/wissen/vitamin-k-high-dietary-menaquinone-intake-is-associated-with-reduced-685` | Studie/Quelle | 9 | 83 |
| [ ] | `/wissen/vitamin-k-hoechstmengenvorschlaege-fuer-vitamin-k-in-lebensmitteln-i-613` | Studie/Quelle | 8 | 83 |
| [ ] | `/wissen/vitamin-k-intake-of-dietary-phylloquinone-and-menaquinones-and-risk-646` | Studie/Quelle | 8 | 83 |
| [ ] | `/wissen/vitamin-k-les-references-nutritionnelles-en-vitamines-et-mineraux-vi-611` | Studie/Quelle | 6 | 83 |
| [ ] | `/wissen/vitamin-k-low-dose-daily-intake-of-vitamin-k2-menaquinone-7-improves-682` | Studie/Quelle | 7 | 83 |
| [ ] | `/wissen/vitamin-k-maximal-dose-response-of-vitamin-k2-menaquinone-4-on-under-683` | Studie/Quelle | 7 | 83 |
| [ ] | `/wissen/vitamin-k-menaquinone-content-of-cheese-670` | Studie/Quelle | 7 | 83 |
| [ ] | `/wissen/vitamin-k-menaquinones-bacteria-and-the-food-supply-the-relevance-of-668` | Studie/Quelle | 5 | 83 |
| [ ] | `/wissen/vitamin-k-multiple-vitamin-k-forms-exist-in-dairy-foods-669` | Studie/Quelle | 7 | 83 |
| [ ] | `/wissen/vitamin-k-nordic-nutrition-recommendations-2023-vitamin-k-chapter-608` | Studie/Quelle | 7 | 83 |
| [ ] | `/wissen/vitamin-k-perspective-evidence-before-enthusiasm-a-critical-review-o-688` | Studie/Quelle | 7 | 83 |
| [ ] | `/wissen/vitamin-k-phylloquinone-c31h46o2-cid-5284607-620` | Studie/Quelle | 7 | 83 |
| [ ] | `/wissen/vitamin-k-phylloquinone-intakes-and-food-sources-and-vitamin-k-statu-628` | Studie/Quelle | 7 | 83 |
| [ ] | `/wissen/vitamin-k-safe-upper-levels-for-vitamins-and-minerals-616` | Studie/Quelle | 6 | 83 |
| [ ] | `/wissen/vitamin-k-safety-of-vitamin-k2-added-for-nutritional-purposes-as-a-s-662` | Studie/Quelle | 5 | 83 |
| [ ] | `/wissen/vitamin-k-scientific-opinion-on-the-substantiation-of-health-claims-617` | Studie/Quelle | 7 | 83 |
| [ ] | `/wissen/vitamin-k-the-study-of-bioavailability-and-endogenous-circadian-rhyt-673` | Studie/Quelle | 7 | 83 |
| [ ] | `/wissen/vitamin-k-the-use-of-vitamin-k-supplementation-to-achieve-inr-stabil-650` | Studie/Quelle | 7 | 83 |
| [ ] | `/wissen/vitamin-k-us-pharmacopeial-convention-safety-evaluation-of-menaquino-663` | Studie/Quelle | 6 | 83 |
| [ ] | `/wissen/vitamin-k-use-of-vitamins-in-foods-risk-assessment-of-vitamin-k-614` | Studie/Quelle | 5 | 83 |
| [ ] | `/wissen/vitamin-k-vegetables-and-mixed-dishes-are-top-contributors-to-phyllo-627` | Studie/Quelle | 8 | 83 |
| [ ] | `/wissen/vitamin-k-vitamin-k-622` | Studie/Quelle | 5 | 83 |
| [ ] | `/wissen/vitamin-k-vitamin-k-a-scoping-review-for-nordic-nutrition-recommenda-621` | Studie/Quelle | 7 | 83 |
| [ ] | `/wissen/vitamin-k-vitamin-k-antagonists-and-cardiovascular-calcification-a-s-700` | Studie/Quelle | 8 | 83 |
| [ ] | `/wissen/vitamin-k-vitamin-k-assessment-of-proposed-maximum-limits-in-food-su-615` | Studie/Quelle | 7 | 83 |
| [ ] | `/wissen/vitamin-k-vitamin-k-containing-dietary-supplements-comparison-of-syn-671` | Studie/Quelle | 6 | 83 |
| [ ] | `/wissen/vitamin-k-vitamin-k-deficiency-bleeding-619` | Studie/Quelle | 8 | 83 |
| [ ] | `/wissen/vitamin-k-vitamin-k-dge-referenzwerte-602` | Studie/Quelle | 6 | 83 |
| [ ] | `/wissen/vitamin-k-vitamin-k-dietary-reference-intakes-for-vitamin-a-vitamin-605` | Studie/Quelle | 7 | 83 |
| [ ] | `/wissen/vitamin-k-vitamin-k-double-bonds-beyond-coagulation-insights-into-di-665` | Studie/Quelle | 6 | 83 |
| [ ] | `/wissen/vitamin-k-vitamin-k-food-composition-and-dietary-intakes-624` | Studie/Quelle | 7 | 83 |
| [ ] | `/wissen/vitamin-k-vitamin-k-health-professional-fact-sheet-604` | Studie/Quelle | 7 | 83 |
| [ ] | `/wissen/vitamin-k-vitamin-k-intake-and-atherosclerotic-cardiovascular-diseas-687` | Studie/Quelle | 9 | 83 |
| [ ] | `/wissen/vitamin-k-vitamin-k-intake-and-the-risk-of-fractures-a-meta-analysis-634` | Studie/Quelle | 8 | 83 |
| [ ] | `/wissen/vitamin-k-vitamin-k-nutrient-reference-values-610` | Studie/Quelle | 7 | 83 |
| [ ] | `/wissen/vitamin-k-vitamin-k-sources-physiological-role-kinetics-deficiency-d-623` | Studie/Quelle | 7 | 83 |
| [ ] | `/wissen/vitamin-k-vitamin-k-status-cardiovascular-disease-and-all-cause-mort-645` | Studie/Quelle | 9 | 83 |
| [ ] | `/wissen/vitamin-k-vitamin-k-status-supplementation-and-vascular-disease-a-sy-643` | Studie/Quelle | 7 | 83 |
| [ ] | `/wissen/vitamin-k-vitamin-k-supplementation-and-vascular-calcification-a-sys-690` | Studie/Quelle | 7 | 83 |
| [ ] | `/wissen/vitamin-k-vitamin-k-supplementation-for-the-prevention-of-cardiovasc-642` | Studie/Quelle | 7 | 83 |
| [ ] | `/wissen/vitamin-k-vitamin-k2-and-d-in-patients-with-aortic-valve-calcificati-692` | Studie/Quelle | 7 | 83 |
| [ ] | `/wissen/vitamin-k-vitamin-k2-in-health-and-disease-a-clinical-perspective-667` | Studie/Quelle | 7 | 83 |
| [ ] | `/wissen/vitamin-k-vitamins-and-minerals-vitamin-k-618` | Studie/Quelle | 7 | 83 |
| [ ] | `/wissen/vitamin-und-mineralstoffbedarf-des-menschen-kapitel-thiami-007` | Studie/Quelle | 6 | 83 |
| [ ] | `/wissen/vitamin-und-mineralstoffbedarf-vitamin-c-who-fao` | Studie/Quelle | 7 | 83 |
| [ ] | `/wissen/welche-thiamindosis-ist-zur-behandlung-oder-pravention-der-017` | Studie/Quelle | 6 | 83 |
| [ ] | `/wissen/wirksamkeit-der-vitamine-b1-und-b6-als-zusatztherapie-zu-l-051` | Studie/Quelle | 7 | 83 |
| [ ] | `/wissen/wirkung-einer-thiaminsupplementierung-auf-glykamische-endp-033` | Studie/Quelle | 7 | 83 |
| [ ] | `/wissen/wirkungen-einer-thiaminsupplementierung-auf-die-allgemeine-047` | Studie/Quelle | 8 | 83 |
| [ ] | `/wissen/wirkungen-einer-zwolfmonatigen-benfotiaminbehandlung-auf-m-048` | Studie/Quelle | 5 | 83 |
| [ ] | `/wissen/wissenschaftliches-gutachten-referenzwerte-magnesium-efsa-2015` | Studie/Quelle | 7 | 83 |
| [ ] | `/wissen/zeolith` | Hauptartikel | 7 | 86 |
| [ ] | `/wissen/zeolith-bulog-pma-zeolite-review-2024` | Studie/Quelle | 6 | 83 |
| [ ] | `/wissen/zeolith-commercial-products-metalloids-pavlovich-2023` | Studie/Quelle | 7 | 83 |
| [ ] | `/wissen/zeolith-disease-context-human-studies-nontransferability` | Studie/Quelle | 7 | 83 |
| [ ] | `/wissen/zeolith-efsa-feedap-regulatory-context-2025` | Studie/Quelle | 7 | 83 |
| [ ] | `/wissen/zeolith-kraljevic-pavelic-blood-parameters-2022` | Studie/Quelle | 7 | 83 |
| [ ] | `/wissen/zeolith-kraljevic-pavelic-critical-review-2018` | Studie/Quelle | 5 | 83 |
| [ ] | `/wissen/zeolith-lamprecht-intestinal-barrier-sport-rct-2015` | Studie/Quelle | 8 | 83 |
| [ ] | `/wissen/zeolith-lead-uptake-tracer-samekova-2021` | Studie/Quelle | 8 | 83 |
| [ ] | `/wissen/zeolith-novel-food-rasff-consumer-context-2026` | Studie/Quelle | 7 | 83 |
| [ ] | `/wissen/zink` | Hauptartikel | 7 | 86 |
| [ ] | `/wissen/zink-areds-amd-hochdosis` | Studie/Quelle | 8 | 83 |
| [ ] | `/wissen/zink-bfr-nahrungsergaenzungsmittel-hoechstmenge` | Studie/Quelle | 7 | 83 |
| [ ] | `/wissen/zink-bioverfuegbarkeit-phytat-formen` | Studie/Quelle | 8 | 83 |
| [ ] | `/wissen/zink-diabetes-stoffwechsel-reviews` | Studie/Quelle | 7 | 83 |
| [ ] | `/wissen/zink-erkaeltung-cochrane-kontroverse` | Studie/Quelle | 8 | 83 |
| [ ] | `/wissen/zink-interaktionen-eisen-kupfer` | Studie/Quelle | 7 | 83 |
| [ ] | `/wissen/zink-kinder-praevention-wachstum-morbiditaet` | Studie/Quelle | 8 | 83 |
| [ ] | `/wissen/zink-kinder-ul-sicherheit` | Studie/Quelle | 7 | 83 |
| [ ] | `/wissen/zink-kinderdurchfall-review-dosisvergleich` | Studie/Quelle | 8 | 83 |
| [ ] | `/wissen/zink-mangel-statusmarker-risikogruppen` | Studie/Quelle | 7 | 83 |
| [ ] | `/wissen/zink-pneumoniepraevention-kinder` | Studie/Quelle | 8 | 83 |
| [ ] | `/wissen/zink-prostata-kontroverse` | Studie/Quelle | 8 | 83 |
| [ ] | `/wissen/zink-prothesenhaftcreme-kupfermangel` | Studie/Quelle | 7 | 83 |
| [ ] | `/wissen/zink-referenzwerte-dach-efsa-international` | Studie/Quelle | 8 | 83 |
| [ ] | `/wissen/zink-schwangerschaft-infant-outcomes` | Studie/Quelle | 8 | 83 |
| [ ] | `/wissen/zink-sicherheit-ul-kupferstatus-erwachsene` | Studie/Quelle | 7 | 83 |
| [ ] | `/wissen/zink-wundheilung-pressure-injuries` | Studie/Quelle | 7 | 83 |
