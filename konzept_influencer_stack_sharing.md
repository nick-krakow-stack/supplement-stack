# Konzept: Influencer-/Creator-Stack-Sharing mit Affiliate-Vererbung

Planungsdokument — noch keine Implementierung. Ziel: ein System, in dem Creator
(Influencer, Ernährungsberater, Marken wie ESN, Network-Marketer) ihre Stacks und
einzelne Empfehlungen teilen, andere sie importieren, und *innerhalb des
importierten Stacks* die Produkte und Affiliate-Links des Creators gelten —
außerhalb die Plattform-Standards (Nick).

---

## 0. Die zwei Kernentscheidungen vorab

Bevor irgendetwas gebaut wird, müssen zwei Design-Entscheidungen stehen, weil
alles andere davon abhängt:

**Entscheidung 1 — Auswahl ≠ Link.** „Welches Produkt wird vorausgewählt" und
„welcher Affiliate-Link zieht" sind ZWEI getrennte Auflösungen. Sie dürfen nie in
einem Feld vermischt werden. (Details in Abschnitt 2.)

**Entscheidung 2 — Attribution: eingefroren oder live?** Wenn Fabian später seinen
Link oder sein Standard-Produkt ändert — ändert sich das in schon importierten
Stacks? Empfehlung unten (Abschnitt 5), aber das ist deine Entscheidung und sie
prägt das Datenmodell.

---

## 1. Die Vererbungslogik (das Herzstück, präzise)

Zwei getrennte Funktionen. Nie vermischen.

### 1a. Produkt-Auswahl — welches Produkt wird vorgeschlagen?

Gilt, wenn ein Nutzer in einem Stack einen Wirkstoff hinzufügt.

```
eigener Stack:
    → Plattform-Standardprodukt für den Wirkstoff
      (oder Produkt aus dem Lieblings-Shop des Nutzers, falls gesetzt)

importierter Stack (von Creator C):
    1. Hat C ein spezifisches Produkt für diesen Wirkstoff hinterlegt?
         JA  → dieses Produkt
    2. sonst: Hat C einen Default-Shop, und gibt es dort ein Produkt für den Wirkstoff?
         JA  → dieses Produkt aus Cs Default-Shop
    3. sonst → Plattform-Standardprodukt

    Der Nutzer kann IMMER manuell wechseln.
```

### 1b. Link-Auflösung — welcher Affiliate-Link zieht auf ein Produkt?

Gilt bei Anzeige/Klick, für JEDES Produkt in einem Stack — unabhängig davon, wie
es ausgewählt wurde (auch nach manuellem Wechsel).

```
eigener Stack:
    → Nicks Affiliate-Code für den Shop des Produkts, falls vorhanden
    → sonst Produkt-URL ohne Affiliate-Code

importierter Stack (von Creator C):
    → Hat C einen Affiliate-Code für den Shop dieses Produkts?
         JA  → Produkt-URL + Cs Code
    → sonst: Nicks Code für den Shop, falls vorhanden
    → sonst: Produkt-URL ohne Code
```

**Warum getrennt:** Der Nutzer wählt in Fabians Stack manuell ein Produkt aus
einem Shop, für den Fabian einen Code hat → Fabian verdient. Wählt er ein Produkt
aus einem Shop, für den Fabian KEINEN Code hat → Nick verdient (oder niemand).
Das ist der „27. Produkt"-Fall, und er fällt automatisch richtig, weil die
Link-Auflösung immer per (Stack-Kontext, Shop) läuft, nie am Produkt selbst klebt.

**Konsequenz fürs Datenmodell:** Ein Affiliate-Link ist NIE eine Eigenschaft eines
Produkts. Er ist immer das Ergebnis aus (Partei, Shop) + Produkt-URL, aufgelöst im
Stack-Kontext. Deshalb kann dasselbe Produkt in drei Stacks drei verschiedene
Links tragen, ohne dass irgendetwas dupliziert wird.

---

## 2. Nutzerflow rückwärts (vom Ergebnis zum Anfang)

Das gewünschte ENDERGEBNIS: Ein Nutzer hat einen Stack, in dem jedes Produkt beim
Klick zum richtigen Shop mit dem richtigen Affiliate-Tracking führt, die richtige
Partei verdient, und der Creator seine Klicks im Dashboard sieht.

Rückwärts aufgelöst — jede Zeile bedingt die darüber:

| # | Damit … funktioniert | … muss vorher existieren |
|---|---|---|
| 8 | Creator sieht Klick-Statistik | Klick-Tracking pro (Stack-Herkunft, Produkt, Partei) |
| 7 | richtiger Link beim Klick | Link-Auflösung (1b) zur Anzeige-/Klickzeit |
| 6 | Link-Auflösung weiß den Kontext | Stack trägt `herkunft_creator_id` |
| 5 | Stack kennt seine Herkunft | Import-Vorgang taggt den Stack beim Import |
| 4 | Import funktioniert | geteilte Einheit existiert (Einzel-Empfehlung ODER ganzer Stack) |
| 3 | geteilte Einheit trägt Creator-Links | Creator-Produkte + Creator-Affiliate-Codes pro Shop |
| 2 | Creator kann teilen | Creator-Rolle + Freigabe-Flow + teilbarer Link |
| 1 | alles baut darauf auf | Produkte mit Shop-Zuordnung + Wirkstoff-Bezug |

Daraus ergibt sich die Baureihenfolge (Abschnitt 6) fast von selbst: von unten
nach oben.

### Die zwei Import-Flows konkret

**Flow A — Einzel-Empfehlung importieren** (Fabians D3-Berechnung):
1. Nutzer klickt Link in YouTube-Beschreibung → `/import/{creator}/{share_id}`.
2. Nicht eingeloggt → Registrierung/Login, dann zurück zum Import.
3. System erkennt: Einzel-Empfehlung „Vitamin D3, Fabians Menge, Fabians Produkt".
4. In welchen Stack? (Nutzer wählt Stack, Default = aktiver Stack.)
5. D3 schon im Ziel-Stack? → Fragen: überschreiben oder zusätzlich hinzufügen.
6. Personalisierung wie gewohnt: Nutzer gibt Gewicht ein ODER Menge direkt.
7. Produkt wird NICHT neu ausgewählt → Fabians hinterlegtes Nature-Heart-Produkt
   inkl. Fabians Link wird direkt gesetzt.
8. Im Backend/Admin dokumentiert: Affiliate-Link vorhanden, Partei = Fabian.

**Flow B — Ganzen Stack importieren:**
1. Nutzer klickt Stack-Link → `/import/{creator}/{stack_share_id}`.
2. Registrierung/Login falls nötig.
3. Kompletter Stack wird als NEUER Stack des Nutzers angelegt, getaggt mit
   `herkunft_creator_id = Fabian`.
4. Ab jetzt gilt in diesem Stack die Vererbungslogik (1a/1b) mit C = Fabian.
5. Nutzer fügt später einen neuen Wirkstoff hinzu → Auswahl nach 1a (Fabians
   Default-Shop Nature Heart wird bevorzugt), Link nach 1b (Fabians Code).

---

## 3. Datenmodell (Entitäten und Beziehungen)

Nur die neuen/erweiterten Strukturen; bestehende Tabellen (Wirkstoffe,
dose_recommendations) bleiben.

### Partei (`party`)
Wer verdienen/teilen kann. Nick selbst ist auch eine Partei (die Plattform-Default-Partei).
- `id`, `typ` (`plattform` | `creator` | `marke` | `nutzer`), `name`, `slug`, `status`.
- `freigabe_pauschal` (bool): Creator und einzeln freigeschaltete Nutzer = `true`
  (ihre Produkte gehen automatisch global). Normale Nutzer = `false` (Produkte
  bleiben scoped, bis Nick sie einzeln oder den Nutzer pauschal freigibt).
- `creator_statement` (Text, nullable): frei wählbarer Satz, den der Creator zu
  einer Empfehlung anzeigt („Ich nehme 1000 IE pro 7 kg Körpergewicht"). Beim
  Ausfüllen erhält der Creator einen Hinweis, dass Heilversprechen/Empfehlungen
  (außer bei Ärzten) unzulässig sind, mit erlaubten Beispielen. Verstößt er
  trotzdem, haftet er selbst; die Plattform ist ihrer Aufklärungspflicht nachgekommen.

### Shop (`shop`)
- `id`, `name`, `basis_url`, `link_schema` (wie der Tracking-Code angehängt wird,
  z. B. Query-Param-Name).

### Affiliate-Code (`affiliate_code`)
Der Kern der Vererbung. Pro (Partei, Shop) EIN Code.
- `id`, `party_id`, `shop_id`, `code`, `aktiv` (bool), `gueltig_ab`, `gueltig_bis`.
- Beispiel: (Fabian, Nature Heart, „fabian123"). (Nick, Nature Heart, „nick777").

### Produkt (`product`)
- `id`, `shop_id`, `name`, `produkt_url`, `menge_pro_einheit`,
  `owner_party_id` (wer es angelegt hat), `einzelstatus`
  (`neutral` | `einzeln_freigegeben` | `einzeln_gesperrt`).
- **Mehrere Hauptwirkstoffe möglich** (z. B. D3+K2): eigene Verknüpfungstabelle
  `product_wirkstoff` (product_id, wirkstoff_id, `menge`, `ist_hauptwirkstoff`).
  Das Hauptwirkstoff-Set plus Mengen ist die Grundlage der Überschreib-Regel.
- **Kein Affiliate-Link-Feld.** Der Link entsteht immer aus `produkt_url` +
  passendem `affiliate_code` zur Laufzeit.
- **Globale Sichtbarkeit ist ABGELEITET, kein gespeicherter Schalter:**
  ```
  global_sichtbar =
      einzelstatus == 'einzeln_freigegeben'
      ODER (owner.freigabe_pauschal == true UND einzelstatus != 'einzeln_gesperrt')
  ```
  Folge: Sperrt Nick einen Creator (owner.freigabe_pauschal → false), fallen alle
  dessen nicht einzeln freigegebenen Produkte automatisch aus dem globalen Katalog —
  ohne Einzelbearbeitung. Bereits in fremde Stacks importierte Produkte bleiben dort
  funktionsfähig, solange die Produktzeile existiert; sie werden nur nicht mehr
  global gefunden. Erst echtes Löschen der Zeile entfernt sie auch aus Stacks.

### Überschreib-Regel beim Import (Hauptwirkstoff-Set)
Beim Import eines Einzelprodukts oder Stack-Items in einen Stack, der den Wirkstoff
schon enthält:
- Überschreiben nur, wenn das **Hauptwirkstoff-Set exakt übereinstimmt** (dieselben
  Hauptwirkstoffe). Die Menge wird dabei ERSETZT — das ist ja der Zweck (die neue
  Dosis ersetzt die bisherige). D3 ersetzt D3; D3+K2 ersetzt D3+K2.
- D3 ersetzt NICHT D3+K2 und umgekehrt — dann wird zusätzlich hinzugefügt.
- Bei exakter Übereinstimmung: Nutzer wird gefragt (überschreiben / behalten).

### Creator-Präferenzen
- `creator_default_shop`: (party_id, shop_id) — Fabians Haupt-Partner.
- `creator_product_pick`: (party_id, wirkstoff_id, product_id) — Fabians
  spezifisch hinterlegtes Produkt je Wirkstoff.

### Stack (`stack`)
- `id`, `user_id`, `name`, `herkunft_creator_id` (nullable — null = eigener Stack),
  `zuletzt_geoeffnet` (Zeitstempel — bestimmt den „aktiven Stack" für Einzel-Importe).
- Ein Nutzer kann mehrere Stacks haben, jeder mit eigener Herkunft. Drei Influencer
  = drei Stacks, jeder mit seiner eigenen `herkunft_creator_id`.

### Stack-Position (`stack_item`)
- `id`, `stack_id`, `product_id` (aktuell gewähltes Produkt),
  `menge_wert`, `mengen_quelle` (`gewicht_berechnet` | `direkt` | `creator_uebernommen`),
  `creator_statement_snapshot` (der beim Import eingefrorene Creator-Satz, nullable).
- Hauptwirkstoff-Bezug läuft über das verknüpfte Produkt (`product_wirkstoff`).

### Geteilte Einheit (`share`)
- `id`, `creator_party_id`, `typ` (`einzel` | `stack`), `share_slug`,
  `ziel_ref` (Wirkstoff+Menge+Produkt bei einzel; Stack-Vorlage bei stack),
  `aktiv`.
- Das ist das Ziel des YouTube-Links.

### Klick-Tracking (`affiliate_click`)
- `id`, `zeit`, `stack_id`, `product_id`, `shop_id`, `aufgeloeste_party_id`
  (wer den Klick verdient hat), `creator_context_id` (aus welchem Creator-Stack).
- Aggregat speist die Dashboards.

---

## 4. Doppelte Sichtbarkeit von Produkten (Nicks „fehlender Link"-Ansicht)

Nick will im Admin sehen, welche Creator-/Marken-Produkte noch KEINEN eigenen
(Nick-)Affiliate-Link haben — um seinen Code für den Außer-Stack-Gebrauch zu
ergänzen, OHNE Fabians Link im Stack zu überschreiben.

Das fällt automatisch, weil der Link nie am Produkt klebt:
- Fabians Produkt hat einen `affiliate_code` (Fabian, Shop).
- Nick kann für denselben Shop einen eigenen `affiliate_code` (Nick, Shop) anlegen.
- Im importierten Stack zieht 1b → Fabians Code. Außerhalb → Nicks Code.
- Die Admin-Ansicht „fehlt Nick-Code" ist einfach: alle Shops, für die Produkte
  existieren, aber kein `affiliate_code` mit party = Nick vorliegt.

Creator-Produkte, die noch nicht global freigegeben sind (`sichtbarkeit =
creator_scoped`), tauchen NICHT im globalen Katalog auf, sind aber über den Import
ihres Creators auffindbar. So kann Fabian eigene Produkte teilen, ohne dass sie
Nicks Hauptkatalog „verschmutzen".

---

## 5. Gelockte Entscheidungen

**(a) Attribution: EINGEFROREN.** Importiert ist importiert. Ein importierter Stack
und seine Produkte/Links ändern sich NICHT automatisch, wenn der Creator später
etwas ändert. Will der Nutzer eine Aktualisierung, importiert er die Einzel-
Empfehlung neu (überschreibt) oder ändert die Werte selbst. Das ist einfacher und
für den Nutzer erwartbar. `stack_item` speichert daher auch den Creator-Satz als
`creator_statement_snapshot` eingefroren.

**(b) Überschreiben nach Hauptwirkstoff-Set.** Siehe Überschreib-Regel in
Abschnitt 3. Nur bei exakt gleichem Hauptwirkstoff-Set wird gefragt und ggf.
überschrieben (die Menge wird ersetzt); bei abweichendem Set wird hinzugefügt.

**(c) Moderation über abgeleitete Sichtbarkeit.** Creator werden von Nick händisch
freigeschaltet und bekommen `freigabe_pauschal = true` → ihre Produkte gehen
automatisch global (einzeln sperrbar). Normale Nutzer haben `freigabe_pauschal =
false` → ihre Produkte bleiben scoped, sichtbar nur innerhalb eines Stacks, der sie
teilt. Spam ist damit weitgehend entschärft: Ein nicht freigegebener Spam-Stack
belästigt nur die, die ihn bewusst importieren; Stack löschen genügt. Nichts davon
erreicht den globalen Katalog. Sperrt Nick später einen Creator, verschwinden dessen
nicht einzeln freigegebene Produkte automatisch global (abgeleitete Sichtbarkeit,
Abschnitt 3).

**(d) Creator-Angabe, Nutzer-Menge, KEIN Rechner.** Getrennt gespeichert
(`mengen_quelle`). Zwei sichtbare Bausteine:
- Freitextfeld „[Creator] sagt dazu:" mit dem eingefrorenen Creator-Satz.
- Der automatische Mengen-Rechner ENTFÄLLT (rechtlich heikel, Rundungsproblematik).
  Stattdessen nur Anzeige der Creator-Angabe neben DGE-Wert und Sicherheitsobergrenze
  — in normalisierter Einheit (siehe Einheiten-Schema im Bauplan), damit nicht IE
  gegen µg verglichen wird. Der Nutzer rechnet selbst.

**(e) Dashboard, nur Klicks/Reichweite.** Klicks, Anzahl Stack-Nutzer, Anzahl
Produkte mit Creator-Link, Entwicklung zum Vormonat/über Zeit. KEINE Einnahmen,
keine rückverfolgbaren Nutzerdaten.

**Aktiver Stack:** der zuletzt geöffnete (`stack.zuletzt_geoeffnet`).

---

## 6. Rechtliche Fundamente (Positionen festgelegt — finale Prüfung vor Live-Gang)

Ich bin kein Anwalt. Die folgenden Positionen sind festgelegt und vor dem Live-Gang
noch einmal vollständig rechtlich zu prüfen (v. a. Datenschutzbereich).

- **Affiliate-Kennzeichnung: Fußnote, nicht pro Produkt.** Eine gut sichtbare (nicht
  versteckte) Fußnote weist darauf hin, dass einige Links Affiliate-Links sein können
  und dass die Plattform oder die Stack-Anbieter damit Geld verdienen können. Kein
  Hinweis am einzelnen Produkt (sieht schlecht aus, ist nicht nötig, und ein
  wachsender Anteil der Shops bietet ohnehin gar kein Affiliate an — Amazon ja,
  Nature Heart evtl., Forever nur als Partner). Zusätzlich eine FAQ-Frage „Hier ist
  alles kostenlos — wie verdient ihr Geld?".
- **HWG / HCVO über das Creator-Statement-Feld.** Geteilte Aussagen laufen über das
  Feld „[Creator] sagt dazu:". Beim Ausfüllen wird der Creator ausdrücklich
  hingewiesen, dass Heilversprechen/Empfehlungen (außer bei Ärzten) unzulässig sind,
  mit erlaubten Beispielen („Ich nehme täglich 800 mg Magnesium", „1000 IE pro 7 kg
  Körpergewicht"). Schreibt er trotzdem „Ich empfehle gegen Magenkrämpfe …", haftet
  er selbst; die Plattform hat ihre Aufklärungspflicht erfüllt.
- **Plattformhaftung — bewusst niedrig gehalten.** Creator können nur Wirkstoffe
  empfehlen, die bereits existieren. Nick zahlt keine Provision; Provisionen kommen
  vom jeweiligen Shop direkt an den Creator, nicht über Nick. Viele Anbieter
  (Ärzte, Studios) werden ohne Provision teilen. Die Plattform zeigt bei jeder Menge
  ohnehin den DGE-/UL-Vergleich. Das ist eine bewusste Risiko-Minimierungs-Position,
  die der Anwalt bestätigen soll — kein Ersatz für die Prüfung.
- **DSGVO.** Nur aggregiertes Dashboard, keine rückverfolgbaren Nutzerdaten. Vor
  Live-Gang wird der Datenschutzbereich vollständig geprüft.

---

## 7. Baureihenfolge (von unten nach oben, MVP zuerst)

**Phase 1 — Fundament (ohne das nichts geht):**
1. `party`, `shop`, `affiliate_code`, `product` (mit `owner`/`sichtbarkeit`).
2. Link-Auflösung (1b) als zentrale Funktion — EINE Stelle im Code.
3. Bestehende Stacks mit `herkunft_creator_id = null` migrieren (alle sind erst „eigen").

**Phase 2 — Creator anlegen (manuell, ohne Self-Service):**
4. Creator-Rolle, `creator_default_shop`, `creator_product_pick`.
5. Produkt-Auswahl (1a) mit Creator-Kontext.
6. Du legst Fabian als ersten Creator von Hand an (kein Onboarding-Flow nötig für Test).

**Phase 3 — Teilen & Importieren:**
7. `share` (einzel + stack), teilbarer Link `/import/{creator}/{share_slug}`.
8. Import-Flow A (Einzel) und B (Stack) inkl. Overwrite/Add-Prompt.
9. Kennzeichnungs-UI (wer verdient) — rechtlicher Pflichtbaustein.

**Phase 4 — Auswertung:**
10. `affiliate_click`-Tracking.
11. Admin-Ansicht „fehlender Nick-Code".
12. Creator-Dashboard (Klicks/Reichweite, keine Einnahmen).

**Später (nicht MVP):** Creator-Self-Service-Onboarding, Marken-Rechner-Einbettung
(ESN), API-Einnahmen-Import, Backup/Restore (das simple Feature fällt hier als
Nebenprodukt ab).

---

## 8. Verbleibende offene Punkte
Fast alles ist entschieden. Offen bleibt:
- **Rechner ja/nein final:** Der Mengen-Rechner wird nur mit der Pflicht-
  Sicherheitsrahmung gebaut (Abschnitt 5d). Wenn die Rahmung in der Umsetzung
  wackelt, lieber weglassen und die Leute selbst rechnen lassen.
- **Vollständige Rechts-/Datenschutzprüfung vor Live-Gang** (Positionen in
  Abschnitt 6 sind gesetzt, aber final zu bestätigen).
- **Creator-Onboarding-Details** (Dashboard-Umfang, wie Creator ihre
  Produkte/Default-Shop pflegen) — erst relevant, wenn Fabian als erster echter
  Creator live geht.
