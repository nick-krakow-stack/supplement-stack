# Wirkstoffe und Formen: konkreter Umsetzungsplan

Stand: 2026-05-07
Status: Remote-Migration abgeschlossen und auf `https://supplementstack.de`
deployed.

## Zielbild

Supplement Stack trennt kuenftig sauber zwischen:

- `ingredients`: genau ein kanonischer Wirkstoff pro fachlichem Wirkstoff.
- `ingredient_forms`: chemische Formen, Salze, Ester, Derivate und etikettennahe Formen, die keine eigene kanonische Wirkstoffseite bekommen sollen.
- `ingredient_synonyms`: alternative Namen, Abkuerzungen, Schreibweisen und Sprachvarianten.
- `ingredient_sub_ingredients`: echte Bestandteil-Beziehungen, z. B. Omega-3 zu EPA/DHA. Diese Tabelle wird in dieser Iteration nicht umgebaut.
- `ingredient_precursors`: neue redaktionelle Beziehung fuer Vorstufen/Bausteine, z. B. Lysin und Methionin zu L-Carnitin. Diese Beziehung dient Admin- und Content-Arbeit, nicht dem Suchindex.

Suchergebnisse bleiben wirkstoffzentriert. Auch wenn der Nutzer nach einer Form oder einem Synonym sucht, gibt die Suche den kanonischen Wirkstoff zurueck und optional die getroffene Form als `matched_form_id` / `matched_form_name`.

## Fachliche Entscheidung

L-Carnitin ist der kanonische Wirkstoff.

Acetyl-L-Carnitin wird in dieser Struktur nicht als eigener kanonischer Wirkstoff fuer die Suche und Wirkstoffseite gefuehrt, sondern als Form/Derivat von L-Carnitin modelliert. Die Form kann als `Acetyl-L-Carnitin` gefuehrt werden; `Acetyl L Carnitin`, `ALCAR` und aehnliche Schreibweisen gehoeren in `ingredient_synonyms` oder als formbezogene Suchbegriffe in die Konsolidierungslogik.

Lysin und Methionin sind eigenstaendige kanonische Wirkstoffe und werden redaktionell ueber `ingredient_precursors` mit L-Carnitin verbunden.

Wichtig: Diese Entscheidung betrifft die Produkt-/Suchstruktur. Dosierungs-, Sicherheits- und Studienlogik muss spaeter pruefen, ob fuer eine Form eigene Hinweise notwendig sind.

## Grundsaetze

- Keine automatische Massenloeschung aus `ingredients`.
- Jede Konsolidierung eines Duplikat-Wirkstoffs wird explizit auditiert, geplant und migriert.
- Vor dem Loeschen eines Ingredient-Duplikats muessen alle referenzierenden Tabellen geprueft und konfliktfrei umgebogen sein.
- Migrationen muessen idempotent sein und mit bestehenden Unique Constraints umgehen.
- Alte Admin-Pfade werden nicht wieder eingefuehrt. Frontend-Admin liegt unter `/administrator`, Backend-Admin unter `/api/admin`.
- Code und Migrationen sind die finale Quelle der Wahrheit, nicht alte Plan- oder Memory-Dateien.

## Umsetzungsstand

Abgeschlossen:

1. Schema- und Referenz-Audit erstellt:
   `_research_raw/ingredient_consolidation_audit.md`.
2. Datenklassifikation erstellt: kanonischer Wirkstoff, Form, Synonym,
   Precursor.
3. Lookup-Indizes ergaenzt:
   `d1-migrations/0069_ingredient_lookup_indexes.sql`.
4. `ingredient_precursors` eingefuehrt:
   `d1-migrations/0070_ingredient_precursors.sql`.
5. Bestaetigte L-Carnitin-Duplikate konsolidiert:
   `d1-migrations/0071_consolidate_l_carnitine_forms.sql`.
6. Backend-Suche wirkstoffzentriert umgebaut.
7. Produktendpoint optional nach `form_id` filterbar gemacht.
8. Admin-API fuer Precursors ergaenzt.
9. Stack-Modal um optionalen Form-Schritt erweitert.
10. Administrator-UI fuer Formen/Synonyme/Precursors abgerundet.
11. Remote D1 migriert, Pages deployed, live/postflight validiert.

## Schritt 1: Audit vor jeder Migration

Ziel: Alle aktuellen Referenzen auf `ingredients.id` finden, bevor Duplikate zusammengefuehrt werden.

Zu pruefen:

- `PRAGMA foreign_key_list(...)` fuer alle Tabellen.
- Alle Tabellen mit Spalten wie `ingredient_id`, `parent_ingredient_id`, `child_ingredient_id`, `partner_ingredient_id`, `precursor_ingredient_id`.
- JSON- oder Textreferenzen, insbesondere `blog_posts.linked_ingredient_ids`.
- Tabellen mit Unique Constraints, die beim Umbiegen kollidieren koennen:
  - `ingredient_display_profiles`
  - `nutrient_reference_values`
  - `interactions`
  - `ingredient_synonyms`
  - `ingredient_forms`
  - alle Translation-/I18n-Tabellen mit Ingredient-Bezug

Ergebnisdatei:

- `_research_raw/ingredient_consolidation_audit.md`

Diese Datei soll je Kandidat enthalten:

- Duplicate-Ingredient: ID, Name.
- Ziel-Wirkstoff: ID, Name.
- Ziel-Form: vorhandene `ingredient_forms.id` oder neu anzulegende Form.
- Alle betroffenen Tabellen mit Row Counts.
- Erwartete Konflikte durch Unique Constraints.
- Empfehlung: migrieren, nicht migrieren, oder manuelle Rueckfrage.

Stop-Gate: Nach dem Audit wird nicht direkt migriert. Die Kandidatenliste muss zuerst geprueft werden.

## Schritt 2: Klassifikationsregeln

Fuer jeden Kandidaten aus dem Audit gilt:

- Wirkstoff bleibt in `ingredients`, wenn er eigene Dosierung, eigene Sicherheitslogik, eigene Studienlage oder eigene Produktrolle braucht.
- Form geht nach `ingredient_forms`, wenn sie eine chemische Form, Salzform, Esterform, Derivat-/Transportform oder etikettennahe Form eines kanonischen Wirkstoffs ist.
- Synonym geht nach `ingredient_synonyms`, wenn es nur eine alternative Bezeichnung, Abkuerzung, Schreibweise oder Sprachvariante ist.
- Precursor geht nach `ingredient_precursors`, wenn es ein eigenstaendiger Wirkstoff ist, der redaktionell als Vorstufe/Baustein eines anderen Wirkstoffs erklaert werden soll.
- `ingredient_sub_ingredients` bleibt fuer echte Bestandteil-Beziehungen reserviert und wird in dieser Iteration nicht als Ersatz fuer Formen benutzt.

Konkrete Entscheidung fuer diese Iteration:

- `L-Carnitin`: kanonischer Wirkstoff.
- `Acetyl-L-Carnitin`: Form/Derivat von L-Carnitin.
- `ALCAR`, `Acetyl L Carnitin`: Synonyme/Suchschreibweisen, die auf L-Carnitin mit passender Form fuehren.
- `Lysin`, `Methionin`: kanonische Wirkstoffe.
- `Lysin -> L-Carnitin`, `Methionin -> L-Carnitin`: `ingredient_precursors`.

## Schritt 3: Migration 0071, Konsolidierung bestaetigter Ingredient-Duplikate

Datei:

- `d1-migrations/0071_consolidate_l_carnitine_forms.sql`

Status: umgesetzt, remote angewendet und postflight-geprueft.

Ergebnis:

- `60` Acetyl-L-Carnitin -> `13` L-Carnitin, form `155`.
- `65` L-Carnitin Tartrat -> `13` L-Carnitin, form `154`.
- `66` L-Carnitin Fumarat -> `13` L-Carnitin, form `158`.
- `189` Acetyl-L-Carnitin freie Form -> in form `155` gemerged.
- ID-60-Dosis-, Display-, Interaktions- und Synonymdaten wurden
  konfliktbewusst erhalten, remapped oder in den Zielkontext uebernommen.
- Remote Postflight zeigte keine alten Referenzen, keine Self-Interactions,
  keine Form-Parent-Mismatches und keine Foreign-Key-Fehler.

## Schritt 4: Lookup-Strategie

Datei:

- `d1-migrations/0069_ingredient_lookup_indexes.sql`

Der alte Vorschlag mit einfachen `lower(name)`-Indizes reicht voraussichtlich nicht, weil die Suche normalisiert mit entfernten Leerzeichen, Bindestrichen und Unterstrichen arbeitet.

Bevorzugte Loesung:

- Expression-Indizes auf exakt dieselbe Normalisierungsfunktion wie in der Query:
  - `ingredients`
  - `ingredient_synonyms`
  - `ingredient_forms`

Normalisierung:

```sql
lower(replace(replace(replace(name, ' ', ''), '-', ''), '_', ''))
```

Bei Synonymen wird `synonym` verwendet, bei Formen `name`.

Alternative, falls Expression-Indizes in D1 fuer diesen Zweck unzuverlaessig sind:

- `normalized_name` / `normalized_synonym` Spalten einfuehren und in Code/Migration pflegen.

Entscheidungspunkt: Vor Umsetzung kurz lokal mit D1 testen, ob die Expression-Indizes akzeptiert werden.

## Schritt 5: Neue Precursor-Tabelle

Datei:

- `d1-migrations/0070_ingredient_precursors.sql`

Schema:

- `ingredient_id`: Ziel-Wirkstoff, z. B. L-Carnitin.
- `precursor_ingredient_id`: Precursor-Wirkstoff, z. B. Lysin.
- `sort_order`
- `note`
- `created_at`
- Composite Primary Key auf `(ingredient_id, precursor_ingredient_id)`.
- Check gegen Self-Reference.
- Foreign Keys mit `ON DELETE CASCADE`.

Seed nur nach fachlicher Freigabe:

- Lysin -> L-Carnitin.
- Methionin -> L-Carnitin.

Diese Beziehung wird nicht in die normale Suche aufgenommen.

## Schritt 6: Backend-Suche umbauen

Datei:

- `functions/api/modules/ingredients.ts`

Bereich:

- `ingredients.get('/search', ...)`

Anforderungen:

- Eingabe normalisieren: lowercase, Whitespace, Bindestriche und Unterstriche entfernen.
- Trefferquellen:
  - Ingredient-Name, Rank 0.
  - Synonym, Rank 1.
  - Form, Rank 2, mit `matched_form_id` und `matched_form_name`.
- Ergebnis wird auf `ingredient_id` dedupliziert.
- Pro Ingredient wird deterministisch der beste Treffer gewaehlt.
- Wenn nur die Form matched, bleibt das Ergebnis trotzdem der Parent-Wirkstoff.
- API bleibt rueckwaertskompatibel und ergaenzt nur optionale Felder:
  - `matched_form_id`
  - `matched_form_name`

Technischer Vorschlag:

- CTE mit `UNION ALL`.
- Danach per Aggregation oder Window Function den besten Treffer pro `ingredient_id` bestimmen.
- Erst danach `LIMIT`.
- Keine reine TypeScript-Dedupe-Loesung, weil das Ranking sonst von SQL-Zwischenergebnissen abhaengt.

Wichtig:

- `ingredient_synonyms.language` beruecksichtigen. Default ist Deutsch, Suche sollte mindestens deutsche und sprachneutrale Eintraege finden. Falls keine sprachneutrale Konvention existiert, vorerst nicht filtern.

## Schritt 7: Produktendpoint mit optionalem Form-Filter

Datei:

- `functions/api/modules/ingredients.ts`

Bereich:

- `ingredients.get('/:id/products', ...)`

Anforderungen:

- Optionalen Query-Parameter `form_id` einlesen.
- `form_id` validieren.
- Wenn gesetzt, nur Produkt-Ingredient-Zeilen mit passender `pi.form_id` liefern.
- Ohne `form_id` bleibt das heutige Verhalten unveraendert.
- Sub-Ingredient- und Parent-Ingredient-Logik nicht nebenbei umbauen.

Zu klaeren beim Implementieren:

- Ob Produkte, die ueber `parent_ingredient_id` matchen, bei gesetzter Form nur dann erscheinen sollen, wenn dieselbe Zeile auch `form_id` traegt. Default-Entscheidung: ja, weil der Nutzer eine konkrete Form gewaehlt hat.

## Schritt 8: Admin-API fuer Precursors

Bevorzugter Ort:

- `functions/api/modules/admin.ts`

Begruendung:

- Neue Admin-Erweiterungen sollen konsistent unter `/api/admin` liegen.
- Bestehende historische Ingredient-Admin-Endpunkte in `functions/api/modules/ingredients.ts` koennen bleiben, werden aber nicht als Muster fuer neue Admin-Flaechen erweitert, wenn es nicht noetig ist.

Endpoints:

- `GET /api/admin/ingredients/:id/precursors`
- `POST /api/admin/ingredients/:id/precursors`
- `DELETE /api/admin/ingredients/:id/precursors/:precursorId`

Anforderungen:

- Admin-Auth wie in bestehenden Admin-Routen.
- Duplicate-Pruefung ueber Composite Key.
- Keine Self-Reference erlauben.
- Audit-Log schreiben:
  - `create_ingredient_precursor`
  - `delete_ingredient_precursor`
- Response liefert Precursor-Name, Unit, Sortierung und Note.

Zusatz:

- Der bestehende Ingredient-Detail-Admin-Loader soll Precursors direkt mitliefern, wenn die Detailseite sie braucht.

## Schritt 9: Stack-Modal um Form-Schritt erweitern

Datei:

- `frontend/src/components/StackWorkspace.tsx`

Anforderungen:

- Step-Union erweitern:
  - `search`
  - `form`
  - `dosage`
  - `products`
- Nach Auswahl eines Wirkstoffs Detaildaten laden, damit `forms` bekannt sind.
- Wenn keine Formen existieren: direkt weiter zu Dosierung.
- Wenn Formen existieren: Form-Schritt anzeigen.
- Form-Schritt ist immer optional.
- Standardauswahl:
  - `matched_form_id`, falls Suche ueber eine Form kam.
  - sonst `null` fuer "Alle Formen".
- Nutzer kann immer "Alle Formen" waehlen.
- Dosierungslogik bleibt wirkstoffbasiert.
- Produktliste wird nur gefiltert, wenn `selectedFormId !== null`.
- Beim Schliessen des Modals werden `forms` und `selectedFormId` zurueckgesetzt.

Typen:

- `frontend/src/types/local.ts`: `Ingredient` um `matched_form_id` und `matched_form_name` erweitern.
- `frontend/src/types/index.ts`: dieselben optionalen Felder ergaenzen, falls dort ebenfalls Ingredient-Suchergebnisse typisiert sind.
- Nested Product-Ingredient-Typen in `StackWorkspace.tsx` pruefen und `form_id` ergaenzen, damit User-Produkte clientseitig korrekt gefiltert werden koennen.

UX:

- "Alle Formen" ist die erste Option.
- Form-Karten zeigen Name, optional Kommentar und Score/Qualitaet, sofern vorhanden.
- Zurueck aus Dosierung fuehrt zu Form, wenn Formen existieren, sonst zur Suche.

## Schritt 10: Administrator-UI

Dateien:

- `frontend/src/pages/administrator/AdministratorIngredientDetailPage.tsx`
- `frontend/src/pages/administrator/AdministratorIngredientsPage.tsx`
- `frontend/src/api/admin.ts`

Detailseite:

- Tab `Wirkstoffteile` oder `Precursors` ergaenzen.
- Liste bestehender Precursors anzeigen.
- Precursor per Wirkstoffsuche hinzufuegen.
- `sort_order` und `note` editierbar oder zumindest beim Anlegen setzbar machen.
- Delete-Aktion mit bestehendem Admin-Pattern.

Listenseite:

- Coverage-Badges oder Spalten fuer:
  - Formen
  - Synonyme
  - Wirkstoffteile
- Backend-Admin-List-Endpoint um Counts erweitern.
- Falls `ingredient_precursors` in einer lokalen Alt-DB noch fehlt, soll der Admin-Endpoint entweder nach Migration laufen oder defensiv mit leerem Count umgehen. Bevorzugt: Migration lokal anwenden, bevor UI getestet wird.

Pfad:

- Links gehen auf `/administrator/ingredients/:id`, nicht auf alte `/admin`-Pfade.

## Schritt 11: Validierung

Pflichtchecks:

```powershell
Set-Location functions
npx tsc -p tsconfig.json --noEmit
Set-Location ..
Set-Location frontend
npx tsc --noEmit
npm run lint --if-present
npm run build
Set-Location ..
node --check scripts/admin-browser-smoke.mjs
node --check scripts/user-browser-smoke.mjs
git diff --check
```

Migrationen lokal:

```powershell
wrangler d1 migrations apply SUPPLEMENTSTACK_DB --local
```

Manuelle Smoke-Tests:

- Suche `Magnesiumbisglycinat`: ein Treffer `Magnesium`, Form vorbelegt.
- Suche `Magnesium Bisglycinat`: gleiches Ergebnis.
- Suche `Acetyl L Carnitin`: Treffer `L-Carnitin`, Form `Acetyl-L-Carnitin` vorbelegt, falls vorhanden.
- Suche `ALCAR`: Treffer `L-Carnitin`.
- Suche `Mg`: Treffer `Magnesium`.
- Suche `Niacin`: Treffer `Vitamin B3`.
- Stack-Modal mit Magnesium: Form-Schritt erscheint.
- Stack-Modal mit Wirkstoff ohne Formen: Form-Schritt wird uebersprungen.
- Stack-Modal mit konkreter Form: Produktliste wird gefiltert.
- Stack-Modal mit "Alle Formen": Produktliste bleibt breit.
- Administrator-Detail: Precursors koennen angelegt und geloescht werden.
- Administrator-Liste: Counts fuer Formen/Synonyme/Precursors sind plausibel.

## Schritt 12: Deployment- und Memory-Regeln

Vor Abschluss einer Implementierung:

- `.agent-memory/current-state.md` aktualisieren, wenn die Funktion umgesetzt wurde.
- `.agent-memory/decisions.md` aktualisieren:
  - kanonische Wirkstoffe in `ingredients`
  - Formen/Derivate in `ingredient_forms`
  - alternative Bezeichnungen in `ingredient_synonyms`
  - redaktionelle Vorstufen in `ingredient_precursors`
  - L-Carnitin-Entscheidung
- `.agent-memory/next-steps.md` aktualisieren, falls Restarbeiten bleiben.
- `.agent-memory/handoff.md` mit konkretem Fortsetzungspunkt aktualisieren.
- `.agent-memory/deploy-log.md` nur nach echter Migration, Deployment oder Produktionspruefung aktualisieren.

Keine Secrets oder Roh-Credentials in Memory-Dateien schreiben.

## Offene Punkte nach Implementierung

- Authenticated owner browser QA fuer die neuen Admin- und User-Flows.
- Optional: migrierte L-Carnitin/ALCAR Legacy-Notizen redaktionell in finalen
  Admin-Content umformulieren.
- Lokale D1-Migrationen laufen erst nach Behebung des alten lokalen
  `0009_auth_profile_extensions.sql` Journal/Schema-Mismatches sauber durch.

## Nicht Teil dieser Iteration

- Keine wissenschaftliche Neubewertung von Dosierungen, Claims oder Sicherheit.
- Keine globale Blog-Struktur-Reform.
- Keine Form-I18n-Tabelle.
- Keine automatische Klassifikation aller Wirkstoffe.
- Kein Re-Import kompletter Produktdaten.
- Kein Reaktivieren alter `/admin`-Frontend-Pfade.
