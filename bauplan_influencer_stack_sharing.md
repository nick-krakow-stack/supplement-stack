# Bauplan: Influencer-Stack-Sharing — runtime-kompatible Umsetzung

Ergänzt [`konzept_influencer_stack_sharing.md`](konzept_influencer_stack_sharing.md).
Das Konzept beschreibt Produktziel und Nutzerfluss; dieser Bauplan beschreibt die
Umsetzung auf Basis der vorhandenen Cloudflare-D1-/Hono-/React-Runtime.
Bei technischen Detailwidersprüchen zwischen beiden Dateien hat dieser
runtime-kompatible Bauplan Vorrang; Produktziel und Nutzererlebnis des Konzepts
bleiben maßgeblich.

**Status:** Planungsdokument, noch keine Implementierung und kein Publish.

## 0. Verbindliche Architekturregeln

1. Code und Migrationen sind Runtime-Wahrheit. SQL in diesem Dokument ist ein
   additiver Zielentwurf und wird vor Umsetzung gegen den dann aktuellen
   Produktions- und Migrationsstand geprüft.
2. Produkt-Auswahl und Link-Auflösung bleiben zwei getrennte zentrale Funktionen.
3. Ein Affiliate-Link ist keine Produkteigenschaft. Er entsteht aus einem sicheren
   Produktziel, einer versionierten Partei-Shop-Zuordnung und dem Stack-Kontext.
4. Bestehende Tabellen werden erweitert; gleichbedeutende Paralleltabellen sind
   unzulässig.
5. IDs neuer relationaler Entitäten sind `INTEGER`, passend zum Bestand. Öffentliche
   Share-Tokens bleiben nicht erratbare `TEXT`-Werte.
6. Alle Migrationen sind additiv. Bestehende Produkte, Stacks und Links werden nicht
   verworfen. Kein Produktionswrite und kein Publish ohne separaten Auftrag,
   Write-Guard und Readback.
7. Das MVP enthält keinen Gewichts- oder Dosierungsrechner und erzeugt keine
   individuelle Dosierungsanweisung.
8. Alle neuen öffentlichen Routen bleiben bis zur ausdrücklichen Aktivierung hinter
   einer standardmäßig deaktivierten Runtime-Feature-Flag.

## 1. Bereits vorhandene Wahrheiten

Diese Strukturen werden weiterverwendet:

| Fachbereich | Kanonischer Bestand |
|---|---|
| Nutzer | `users` |
| Katalogprodukte | `products` |
| Produkt-Wirkstoffe | `product_ingredients` mit `is_main` |
| Nutzereingaben/Produktvorschläge | `user_products`, `user_product_ingredients` |
| Shops | `shop_domains` |
| Produktziele je Shop | `product_shop_links` |
| Stacks | `stacks`, `stack_items` |
| Shares | `share_links` mit `snapshot_json`, Token und Widerruf |
| Klicks | `product_link_clicks` |
| Referenzwerte | `nutrient_reference_values` |
| Einheitenumrechnung | `functions/api/lib/units.ts`, `ingredients.preferred_unit` |

Folglich werden **keine** neuen Tabellen namens `product`, `product_wirkstoff`,
`shop`, `share`, `affiliate_click`, `unit`, `unit_alias` oder
`wirkstoff_einheit` angelegt.

### 1.1 Bestehende Übergangsfelder

`products.shop_link`, `products.is_affiliate`, `products.affiliate_owner_*` und
die Affiliate-Eigentümerfelder in `product_shop_links` sind historisch gewachsen.
Für das neue Feature gilt:

- `product_shop_links` ist die einzige Produktziel-Wahrheit.
- Neue Influencer-/Creator-Writes schreiben nie zusätzlich nach
  `products.shop_link` oder in Produkt-Affiliate-Felder.
- Vor Phase 2 werden alle aktiven Leser/Schreiber dieser Legacy-Felder inventarisiert.
  Die neue zentrale Auflösung darf erst aktiviert werden, wenn der Runtimepfad
  eindeutig über `product_shop_links` läuft.
- Legacy-Felder bleiben zunächst nur für Abwärtskompatibilität erhalten. Ihr späterer
  physischer Rückbau ist ein eigener Auftrag.
- Bereits gespeicherte vollständige Affiliate-URLs werden nicht heuristisch in Code
  und Ziel-URL zerlegt. Sie werden als klassifizierte Legacy-Ziele übernommen und
  später kontrolliert normalisiert.

`user_products` bleibt Eingabe-, Privat- und Moderationsschicht. Ein Produkt, das
von anderen Nutzern importiert werden darf, benötigt eine kanonische, moderierte
`products`-Zeile. Fremde `user_products` werden niemals direkt in einen Stack
eingebunden. Die vorhandene Herkunftsverknüpfung über
`products.source_user_product_id` beziehungsweise `user_products.published_product_id`
verhindert doppelte manuelle Pflege: Änderungen am Nutzervorschlag sind Vorschläge,
nicht automatisch eine zweite veröffentlichte Wahrheit.

## 2. Präzise Snapshot-Semantik

„Eingefroren“ hat zwei Ebenen:

1. **Share-Snapshot:** `share_links.snapshot_json` friert beim Veröffentlichen
   Produktauswahl, Shopziel, Mengen-/Stackdaten, Creator-Aussage und sortiertes
   Hauptwirkstoff-Set ein. Ein bestehender Snapshot wird nie inhaltlich verändert;
   eine neue Veröffentlichung erzeugt einen neuen Share.
2. **Import-Bindung:** Beim Import beziehungsweise beim späteren Hinzufügen oder
   Wechseln eines Produkts in einem Creator-Stack wird die zu diesem Zeitpunkt
   aufgelöste Attribution unveränderlich an die Stack-Position gebunden.

Spätere Änderungen an Creator-Picks, Default-Shop, Aussage, Affiliate-Code oder
Link-Template verändern bestehende Importe nicht. Produktbezeichnung,
Sicherheitsstatus und Moderationsinformationen dürfen weiterhin zentral korrigiert
werden; eingefroren sind Produktauswahl, Nutzungsdaten, Aussage, Shopziel und
Attribution, nicht unsichere Altinformationen.

Eine neue Affiliate-Konfiguration ersetzt keine alte Zeile, sondern erzeugt eine
neue Version. Alte, bereits gebundene Versionen bleiben verwendbar, solange sie
nicht abgelaufen oder aus Sicherheits-/Compliance-Gründen blockiert sind.

**Sicherheitsausnahme:** Ist ein gebundenes Produktziel, eine Partei oder eine
Affiliate-Version blockiert, darf der Redirect nicht auf den eingefrorenen Link
führen. Dann gilt kontrolliert: aktuelle zulässige Plattform-Version für denselben
Shop, sonst sichere nackte Produkt-URL, sonst blockierter Klick. Diese Ausnahme wird
pro Klick als tatsächlich aufgelöste Partei protokolliert und mutiert den Snapshot
nicht.

## 3. Additives Zieldatenmodell

Die endgültige Migration erhält die nächste freie Migrationsnummer. Vorher werden
Tabellen-/Spaltenexistenz, Produktionszählungen und Legacy-Linkklassen read-only
erfasst.

### 3.1 Parteien

```sql
CREATE TABLE IF NOT EXISTS parties (
  id                    INTEGER PRIMARY KEY AUTOINCREMENT,
  type                  TEXT NOT NULL
                        CHECK (type IN ('platform','creator','brand','user')),
  name                  TEXT NOT NULL,
  slug                  TEXT NOT NULL UNIQUE,
  status                TEXT NOT NULL DEFAULT 'active'
                        CHECK (status IN ('active','blocked')),
  auto_catalog_approval INTEGER NOT NULL DEFAULT 0
                        CHECK (auto_catalog_approval IN (0, 1)),
  created_at            TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at            TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS party_memberships (
  party_id   INTEGER NOT NULL REFERENCES parties(id) ON DELETE CASCADE,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role       TEXT NOT NULL CHECK (role IN ('owner','editor','viewer')),
  status     TEXT NOT NULL DEFAULT 'active'
             CHECK (status IN ('active','revoked')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (party_id, user_id)
);
```

Die Plattform ist genau eine Partei mit stabilem `slug='platform'`. Ihre ID wird
über den Slug aufgelöst, nicht im Anwendungscode fest verdrahtet. Creator-Aussagen
gehören nicht global an `parties`, sondern in den moderierten Share-Snapshot.
Kontozugriff läuft ausschließlich über `party_memberships`; dadurch kann ein Nutzer
später mehrere Creator-/Markenparteien verwalten, ohne `users.role` oder eine
einzelne `parties.user_id`-Zuordnung zur zweiten Rechtewahrheit zu machen.

### 3.2 Produkteigentümer und globale Sichtbarkeit

```sql
ALTER TABLE products
  ADD COLUMN owner_party_id INTEGER REFERENCES parties(id) ON DELETE RESTRICT;

CREATE INDEX IF NOT EXISTS idx_products_owner_party
  ON products(owner_party_id);
```

Alle Bestandsprodukte werden guarded der Plattform-Partei zugeordnet. Das vorhandene
`products.visibility` erhält danach diese eindeutige Semantik:

- `public`: einzeln global freigegeben;
- `auto`: folgt `owner_party.auto_catalog_approval`;
- `hidden`: einzeln gesperrt beziehungsweise nicht global sichtbar.

Global sichtbar ist ein Produkt nur, wenn es moderiert freigegeben ist, die Partei
aktiv ist und `visibility='public'` oder
`visibility='auto' AND auto_catalog_approval=1` gilt. Eine View darf diese
Ableitung zentralisieren; Runtime-Queries dürfen sie nicht unterschiedlich
nachbauen.

Im Creator-Kontext ist zusätzlich ein moderiertes, nicht `hidden` gesetztes Produkt
des `stacks.origin_party_id` sichtbar. `party.status='blocked'` schlägt jede
Einzelfreigabe und jeden Kontextzugriff. Bereits vorhandene Stack-Positionen bleiben
referenziell erhalten, werden aber sicherheitskonform behandelt.

### 3.3 Shops, Produktziele und Legacy-Links

`shop_domains` bleibt Shop-Wahrheit. Die erlaubte Domain wird aus
`shop_domains.domain` geprüft; eine zweite `basis_url` wird nicht gespeichert.

`product_shop_links` bleibt Produktziel-Wahrheit und wird additiv klassifiziert:

```sql
ALTER TABLE product_shop_links
  ADD COLUMN link_kind TEXT;
-- Zunächst NULL; guarded Backfill auf 'base_target' | 'legacy_resolved'.
-- Die neue Runtime bleibt blockiert, solange aktive Zeilen NULL enthalten.

ALTER TABLE product_shop_links
  ADD COLUMN legacy_party_id INTEGER REFERENCES parties(id) ON DELETE RESTRICT;

ALTER TABLE product_shop_links ADD COLUMN blocked_at TEXT;
ALTER TABLE product_shop_links ADD COLUMN blocked_reason TEXT;
```

- `base_target`: sichere, affiliate-freie Produktziel-URL; eine versionierte
  Affiliate-Konfiguration darf darauf angewendet werden.
- `legacy_resolved`: vorhandene vollständige Affiliate-URL; die verdienende Partei
  steht in `legacy_party_id`. Darauf wird kein zweites Template angewendet.
- Neue oder geänderte Ziel-URLs werden als neue `product_shop_links`-Zeile angelegt.
  Die alte Zeile wird `active=0`, bleibt aber für vorhandene Snapshot-Bindungen
  erhalten. URL und Domain eines bereits gebundenen Links werden nicht überschrieben.
- `active=1` bedeutet für neue Auswahl verfügbar. `active=0` ohne `blocked_at`
  bedeutet historisch/ersetzt und bleibt für bestehende Bindungen lesbar.
  `blocked_at IS NOT NULL` blockiert auch bestehende Bindungen.
- Jede URL muss `http` oder `https` verwenden und nach Normalisierung unter der
  gebundenen `shop_domains.domain` liegen. Nutzerinfo, alternative Protokolle,
  Domain-Tricks und unerlaubte Redirectziele werden abgelehnt.

Die vorhandenen Admin-Updatepfade werden vor Aktivierung von In-place-URL-Updates
auf append-only Zielversionen umgestellt.

### 3.4 Versionierte Affiliate-Konfiguration

```sql
CREATE TABLE IF NOT EXISTS party_shop_affiliate_versions (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  party_id        INTEGER NOT NULL REFERENCES parties(id) ON DELETE RESTRICT,
  shop_domain_id  INTEGER NOT NULL REFERENCES shop_domains(id) ON DELETE RESTRICT,
  version         INTEGER NOT NULL,
  code            TEXT NOT NULL,
  link_template   TEXT NOT NULL,
  tracking_domain TEXT,
  status          TEXT NOT NULL DEFAULT 'current'
                  CHECK (status IN ('current','retired','blocked')),
  valid_from      TEXT,
  valid_until     TEXT,
  created_at      TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (party_id, shop_domain_id, version)
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_party_shop_current_affiliate
  ON party_shop_affiliate_versions(party_id, shop_domain_id)
  WHERE status = 'current';
```

Code, Template oder Tracking-Domain werden nach Erstellung nicht geändert. Eine fachliche Änderung
legt in einer Transaktion eine neue Version an und setzt die alte auf `retired`.
`retired` bleibt für bestehende Bindungen nutzbar; `blocked` nicht. Templates dürfen
nur die erlaubten Platzhalter `{url}` und `{code}` enthalten. `tracking_domain` ist
bei einem externen Redirect-Template der exakt erlaubte Zielhost; ohne externen
Redirect muss der erzeugte Link unter der gebundenen Shopdomain bleiben. Ziel und
Code werden kontextgerecht URL-kodiert; bestehende Query-Parameter werden korrekt
behandelt.

### 3.5 Creator-Präferenzen

```sql
CREATE TABLE IF NOT EXISTS party_default_shops (
  party_id       INTEGER PRIMARY KEY REFERENCES parties(id) ON DELETE CASCADE,
  shop_domain_id INTEGER NOT NULL REFERENCES shop_domains(id) ON DELETE RESTRICT,
  updated_at     TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS party_product_picks (
  party_id      INTEGER NOT NULL REFERENCES parties(id) ON DELETE CASCADE,
  ingredient_id INTEGER NOT NULL REFERENCES ingredients(id) ON DELETE CASCADE,
  product_id    INTEGER NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  updated_at    TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (party_id, ingredient_id)
);
```

Ein Pick muss zum Creator-Kontext sichtbar sein und den Wirkstoff als
`product_ingredients.is_main=1` führen. Das wird beim Write und erneut beim Read
geprüft.

### 3.6 Stacks und Stack-Positionen

```sql
ALTER TABLE stacks
  ADD COLUMN origin_party_id INTEGER REFERENCES parties(id) ON DELETE RESTRICT;

ALTER TABLE stacks ADD COLUMN last_opened_at TEXT;

ALTER TABLE stack_items
  ADD COLUMN source_share_link_id INTEGER REFERENCES share_links(id) ON DELETE SET NULL;

ALTER TABLE stack_items ADD COLUMN creator_statement_snapshot TEXT;
ALTER TABLE stack_items ADD COLUMN amount_source TEXT;
-- Anwendungsguard: 'direct' | 'creator_snapshot'
```

`origin_party_id IS NULL` bezeichnet einen eigenen Stack. Bestandsstacks bleiben
unverändert `NULL`. Ein ganzer Creator-Stack erhält die Herkunftspartei. Ein
Einzelimport in einen eigenen Stack ändert dessen Herkunft nicht; die importierte
Position trägt ihre eigene Share-/Attributionsbindung.

Die vorhandenen `catalog_product_id`-/`user_product_id`-Spalten und ihre exklusive
CHECK-Regel bleiben erhalten. Importierte fremde Produkte verwenden ausschließlich
`catalog_product_id`.

Attribution wird genau einmal pro Position gebunden:

```sql
CREATE TABLE IF NOT EXISTS stack_item_link_bindings (
  stack_item_id       INTEGER PRIMARY KEY
                      REFERENCES stack_items(id) ON DELETE CASCADE,
  shop_link_id        INTEGER NOT NULL
                      REFERENCES product_shop_links(id) ON DELETE RESTRICT,
  resolution_kind    TEXT NOT NULL
                      CHECK (resolution_kind IN
                        ('creator_version','platform_version','legacy_resolved','bare')),
  affiliate_version_id INTEGER
                      REFERENCES party_shop_affiliate_versions(id) ON DELETE RESTRICT,
  resolved_party_id  INTEGER REFERENCES parties(id) ON DELETE RESTRICT,
  bound_at           TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK (
    (resolution_kind IN ('creator_version','platform_version')
      AND affiliate_version_id IS NOT NULL AND resolved_party_id IS NOT NULL)
    OR
    (resolution_kind = 'legacy_resolved'
      AND affiliate_version_id IS NULL AND resolved_party_id IS NOT NULL)
    OR
    (resolution_kind = 'bare'
      AND affiliate_version_id IS NULL AND resolved_party_id IS NULL)
  )
);
```

Der Write-Guard stellt zusätzlich sicher, dass `shop_link_id` zum Produkt der
Stack-Position gehört, die Affiliate-Version denselben Shop referenziert und
`resolved_party_id` der Partei dieser Version entspricht. Diese Relationen dürfen
nicht nur der UI vertraut werden.

Wechselt der Nutzer Produkt oder Shop, wird die Bindung in derselben atomaren
Operation bewusst durch eine neu aufgelöste Bindung ersetzt. Änderungen am Creator
allein ändern sie nicht.

Das bestehende `ON DELETE CASCADE` von Produkten auf `stack_items` wird in diesem
Feature nicht beiläufig per Tabellen-Rebuild geändert. Statt Hard-Delete gelten
Status/Visibility und ein persistenter Anwendungs-Write-Guard. Ein späterer Wechsel
auf `RESTRICT` benötigt einen eigenen, inventarisierten Migrationsauftrag.

### 3.7 Shares und idempotente Importe

`share_links` wird erweitert, nicht ersetzt:

```sql
ALTER TABLE share_links
  ADD COLUMN creator_party_id INTEGER REFERENCES parties(id) ON DELETE RESTRICT;

ALTER TABLE share_links ADD COLUMN snapshot_schema_version INTEGER;
ALTER TABLE share_links ADD COLUMN snapshot_hash TEXT;
ALTER TABLE share_links ADD COLUMN moderation_status TEXT;
ALTER TABLE share_links
  ADD COLUMN moderated_by_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE share_links ADD COLUMN moderated_at TEXT;
```

Anwendungsguards:

- `snapshot_schema_version=1` ist Pflicht für neue Shares.
- `snapshot_hash` bindet die kanonisch serialisierten Snapshotbytes.
- `moderation_status` ist `pending`, `approved` oder `blocked`.
- Nur `approved`, nicht widerrufene und nicht abgelaufene Shares sind importierbar.
- `creator_user_id` bleibt vorerst ein Legacy-Kompatibilitätsfeld; neue Logik nutzt
  `creator_party_id`.
- Ein veröffentlichter Snapshot wird nicht überschrieben. Korrekturen erzeugen einen
  neuen Token beziehungsweise eine neue Share-Zeile.

Das Snapshot-Schema enthält mindestens:

```json
{
  "schema_version": 1,
  "type": "dose_recommendation|stack",
  "creator_party_id": 123,
  "published_at": "ISO-8601",
  "items": [
    {
      "catalog_product_id": 456,
      "shop_link_id": 789,
      "link_binding": {
        "resolution_kind": "creator_version",
        "affiliate_version_id": 321,
        "resolved_party_id": 123
      },
      "main_ingredient_ids": [1, 2],
      "quantity": 1,
      "intake_interval_days": 1,
      "dosage_text": "optional",
      "timing": "optional",
      "creator_statement": "optional"
    }
  ]
}
```

`main_ingredient_ids` ist sortiert und wird aus `product_ingredients` mit
`is_main=1` gebildet. `link_binding` besitzt dieselben Invarianten wie
`stack_item_link_bindings` und friert die Attribution bereits beim Veröffentlichen
ein. Der Import übernimmt diese Bindung; er löst sie nicht gegen inzwischen aktuelle
Creator-Codes neu auf. Der Import prüft Snapshot-Hash, Relationen und aktuelle
Sicherheits-/Moderationslage erneut. Hat sich das Hauptwirkstoff-Set des zentralen
Produkts geändert, wird der alte Snapshot nicht still umgedeutet, sondern blockiert
beziehungsweise zur erneuten Freigabe vorgelegt. Fehlende Pflichtwerte werden nicht
erfunden.

Netzwerk- oder UI-Wiederholungen dürfen keinen Doppelimport erzeugen:

```sql
CREATE TABLE IF NOT EXISTS share_import_operations (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  idempotency_key TEXT NOT NULL UNIQUE,
  share_link_id   INTEGER NOT NULL REFERENCES share_links(id) ON DELETE RESTRICT,
  user_id         INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  target_stack_id INTEGER REFERENCES stacks(id) ON DELETE SET NULL,
  result_json     TEXT,
  created_at      TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
```

Ein bewusst erneut gestarteter Import erhält einen neuen Idempotency-Key. Der Import,
die Stack-/Positionswrites, Bindungen, Importoperation und Erhöhung von
`share_links.imports` laufen in einem D1-Batch beziehungsweise einer gleichwertig
atomaren, wiederholbaren Operation.

### 3.8 Klicktracking erweitern

```sql
ALTER TABLE product_link_clicks
  ADD COLUMN resolved_party_id INTEGER REFERENCES parties(id) ON DELETE SET NULL;

ALTER TABLE product_link_clicks
  ADD COLUMN creator_context_party_id INTEGER REFERENCES parties(id) ON DELETE SET NULL;

ALTER TABLE product_link_clicks
  ADD COLUMN affiliate_version_id INTEGER
  REFERENCES party_shop_affiliate_versions(id) ON DELETE SET NULL;

ALTER TABLE product_link_clicks
  ADD COLUMN source_share_link_id INTEGER REFERENCES share_links(id) ON DELETE SET NULL;
```

Der Creator-Pfad speichert keine E-Mail, IP, Referrer-URL mit personenbezogenen
Parametern oder sonstige direkt rückverfolgbare Nutzerdaten. `user_id` bleibt dort
`NULL`. Das Creator-Dashboard erhält nur aggregierte Ergebnisse und niemals Stack-,
Nutzer- oder Click-IDs. Falls `stack_id` für Missbrauchsschutz benötigt wird, ist
vor Umsetzung ein eigener Datenschutzentscheid nötig; standardmäßig bleibt es für
Creator-Klicks `NULL`.

## 4. Zentrale Runtime-Funktionen

### 4.1 Produkt-Auswahl

```text
select_default_product(stack, ingredient):
  if stack.origin_party_id is set and party is active:
    use valid party_product_pick for (party, ingredient), if context-visible
    else use best context-visible product from party_default_shop
  else:
    use existing platform/user-default selection
```

Die Auswahl liefert Produkt und Shopziel, aber keinen Affiliate-Link. Kandidaten
werden gebündelt geladen; keine N+1-Abfragen.

### 4.2 Attribution beim Hinzufügen oder Importieren

```text
bind_stack_item_link(stack_item, shop_link, context_party):
  reject unsafe, blocked or mismatched shop target
  if shop_link is legacy_resolved:
    bind its legacy party
  else if context_party has current valid affiliate version for the shop:
    bind that exact creator version
  else if platform has current valid affiliate version for the shop:
    bind that exact platform version
  else:
    bind bare target
```

Diese Funktion gilt für neu erstellte oder manuell geänderte Positionen. Beim Import
wird stattdessen die validierte, bereits im Share eingefrorene `link_binding`
übernommen. Nur die Sicherheitsausnahme aus Abschnitt 2 darf davon abweichen.

Bei einem Einzelimport ist `context_party` die Creator-Partei des Shares, auch wenn
der Ziel-Stack ein eigener Stack bleibt. Bei einem vollständigen importierten Stack
ist sie `stacks.origin_party_id`. Bei später hinzugefügten Positionen in diesem Stack
wird die dann aktuelle Konfiguration einmalig gebunden.

### 4.3 Link-Auflösung beim Klick

Die vorhandene Route `GET /api/products/:id/out` wird nicht durch eine zweite
Redirect-Implementierung ergänzt. Sie erhält einen stackpositionsgebundenen Kontext
oder eine serverseitig validierte, nicht manipulierbare Referenz.

```text
resolve_outbound_link(product, optional stack_item):
  stack item present:
    verify authenticated ownership/access
    load its immutable binding, target and affiliate version in one query
    apply frozen binding if still safe and permitted
    otherwise apply documented security fallback
  no stack item:
    use current platform version for selected product target, else bare target
  create one click event with the party actually used
  redirect only to the validated resulting http(s) URL
```

Ein frei übergebener `stack_id` darf Attribution nicht bestimmen. Der Server leitet
Kontext aus der autorisierten Stack-Position oder einem signierten/opaque Kontext ab.
Templates werden ausschließlich in dieser zentralen Funktion angewendet.

## 5. Import-Flows

### 5.1 Gemeinsamer Einstieg

1. Öffentlicher Aufruf über den bestehenden Share-Token.
2. Serverseitige Share-, Hash-, Moderations-, Ablauf- und Sicherheitsprüfung.
3. Vorschau mit Creator-Herkunft, Produkten, Mengen-/Nutzungsdaten,
   Creator-Aussagen und Affiliate-Kennzeichnung.
4. Nicht eingeloggte Nutzer werden nach Login/Registrierung exakt zu diesem
   bestätigungspflichtigen Import zurückgeführt. Der Import wird vorher nicht
   ausgeführt.
5. Erst nach ausdrücklicher Bestätigung entsteht ein Idempotency-Key und der
   persistente Import.

### 5.2 Einzel-Empfehlung

- Standardziel ist der Stack mit größtem `last_opened_at`; fehlt dieser Wert, wird
  keine beliebige Reihenfolge angenommen, sondern ein Stack sichtbar vorausgewählt.
- Der Nutzer kann das Ziel ändern.
- Das Hauptwirkstoff-Set des eingehenden Katalogprodukts wird mit jedem vorhandenen
  Set verglichen. Für Katalogprodukte kommt es aus `product_ingredients`, für eigene
  Nutzerprodukte aus `user_product_ingredients`.
- Kein identisches Set: neue Position.
- Genau ein identisches Set: sichtbare Wahl „bestehende Position behalten“ oder
  „durch Snapshot ersetzen“.
- Mehrere identische Sets: alle Treffer anzeigen und eine konkrete Auswahl verlangen;
  niemals still den ersten Treffer überschreiben.
- Beim Ersetzen werden Produkt, Shopziel, Nutzungsdaten, Aussage, Share-Herkunft und
  Attribution atomar ersetzt. Die Menge wird nicht aus Freitext berechnet.

### 5.3 Ganzer Stack

- Es entsteht immer ein neuer Stack des Nutzers.
- `origin_party_id` wird aus dem freigegebenen Share übernommen.
- Reihenfolge und Positionen werden aus dem validierten Snapshot übernommen.
  Stack-Kategorien sind seit Snapshot v3 vollständig aus dem aktiven Modell
  entfernt. Historische v1/v2-Snapshots bleiben lesbar; ein dort vorhandener
  Kategoriename wird weder angezeigt noch beim Import neu angelegt.
- Für jede Position wird die Share-Attribution separat gebunden. Ein partieller
  Import ist nicht erlaubt: Der D1-Batch ist vollständig oder wirkungslos.
- Der neue Stack wird nach Erfolg als zuletzt geöffnet markiert.

## 6. Creator-Aussagen, Mengen und Einheiten

Creator-Aussagen sind sharebezogene, moderierte Snapshot-Felder. Ein globales
`party.creator_statement` wird nicht angelegt.

Unzulässig sind insbesondere Diagnose, Behandlung, Heilversprechen,
krankheitsbezogene Empfehlung, individuelle Dosierung und Rechenregeln wie
„X IE pro kg Körpergewicht“. Ein Hinweis oder Disclaimer macht unzulässige Inhalte
nicht zulässig. Neue Shares mit Freitext bleiben bis zur Freigabe `pending`.

Das MVP übernimmt nur bereits strukturierte Stack-Nutzungsdaten (`quantity`,
`intake_interval_days`, `dosage_text`, `timing`) und kennzeichnet ihre Herkunft mit
`amount_source`. Es berechnet keine persönliche Menge.

Für Einheiten werden keine neuen allgemeinen Tabellen angelegt. Es gelten:

- `ingredients.preferred_unit` für die Anzeige;
- `product_ingredients.quantity/unit` und vorhandene Basisfelder für
  Produktmengen;
- `nutrient_reference_values` für Referenz- und UL-Werte;
- die zentrale Worker-kompatible Logik in `functions/api/lib/units.ts`.

Vor Anzeige eines Vergleichs muss eine bestehende, fachlich gültige Umrechnung
möglich sein. 1000 IE Vitamin D und 25 µg Vitamin D müssen identisch vergleichbar
sein. Stoff- oder formabhängig unklare Umrechnungen werden nicht erfunden; dann
entfällt der numerische Vergleich. Eine spätere datengetriebene Erweiterung erhält
höchstens eine eng gefasste, quellengestützte Konversionstabelle pro Wirkstoff und
ersetzt die entsprechende Hardcodierung, statt `unit`-Paralleltabellen aufzubauen.

## 7. Kennzeichnung, Moderation und Sichtbarkeit

- Affiliate-Kennzeichnung steht ausschließlich im dauerhaft sichtbaren globalen
  Footer-Hinweis. In Produktkarten, an Kaufbuttons, in Stacks, Importen und
  Creator-Empfehlungen gibt es weder Badge noch zusätzlichen Text wie „Affiliate“,
  „Affiliate-Link“ oder „Affiliate-Hinweis“. Diese feste Produktentscheidung darf
  nicht erneut als fehlende Kennzeichnung oder UX-Fehler behandelt werden.
- Auch ein zusätzlicher Affiliate-FAQ-Block in normalen Produktseiten ist nicht
  erforderlich; der globale Footer ist die einzige sichtbare Kennzeichnung.
- Creator-Shares und Creator-Produkte sind vor öffentlicher Nutzung moderiert.
- `parties.status='blocked'` verhindert neue Shares, neue Bindungen und globale
  Sichtbarkeit. Bestehende ausgehende Links folgen der Sicherheitsausnahme aus
  Abschnitt 2.
- Normale Nutzer erhalten keine Admin-, Creator- oder fremden Affiliate-Rechte.
- Creator-Self-Service-Onboarding und automatische Provisionserfassung gehören
  nicht zum MVP.

## 8. Tracking und Ansichten

### 8.1 Admin-Ansicht „Plattform-Code fehlt“

Grundlage sind aktive `product_shop_links` samt `shop_domain_id` und das Fehlen einer
aktuell gültigen `party_shop_affiliate_versions`-Zeile für die Plattform-Partei.
Die Abfrage verwendet weder das nicht vorhandene Feld `link_param` noch
Produkt-Affiliate-Felder. Sie zeigt Shops und betroffene Produkte als Drilldown.

### 8.2 Creator-Dashboard

Nur Aggregationen:

- Klicks gesamt und pro Zeitraum;
- Veränderung zum vorherigen Vergleichszeitraum;
- Anzahl aktiver importierter Stacks mit dieser Herkunft;
- Anzahl verwendeter Produkte beziehungsweise Shops mit Creator-Attribution;
- keine Einnahmen;
- keine Nutzer-, Stack-, Click- oder Referrer-Details.

Zählungen werden gegen klare Definitionen getestet. „Stack-Nutzer“ ist nicht die
Summe von Klicks, sondern die Anzahl aktiver importierter Stacks beziehungsweise
eindeutiger Eigentümer nach der festgelegten Datenschutzaggregation.

## 9. Bau- und Gate-Reihenfolge

### Phase 0 — Ist-Inventar und Migrationsentscheid

1. Produktionsschema, Migrationsstand und Tabellenzählungen read-only erfassen.
2. Alle Leser/Schreiber der Legacy-Produktlink-/Affiliate-Felder inventarisieren.
3. Aktive `product_shop_links` deterministisch als sichere Basisziele,
   `legacy_resolved` oder Blocker klassifizieren; keine Code-Extraktion raten.
4. Datenmapping, Backfill-Counts, Write-Guards und Rollback-/Backup-Scope festlegen.
5. Snapshot-, Status- und Sicherheitssemantik gegen diesen Bauplan einfrieren.

**Gate:** Kein Schemawrite, solange ein Link oder Eigentümer nicht eindeutig
klassifiziert ist. Unauflösbare Fälle gehen als konkrete Admin-/Owner-Liste in den
Handoff.

### Phase 1 — Additives Fundament

1. Parteien und Plattform-Partei anlegen.
2. Bestandsprodukte guarded der Plattform zuordnen.
3. Produktziele und Legacy-Links ohne Inhaltsverlust klassifizieren.
4. Versionierte Affiliate-Konfiguration, Präferenzen, Stack-Herkunft,
   Positionsbindung, Share-Erweiterungen, Idempotenz und Klickfelder migrieren.
5. Zentrale Linkauflösung samt URL-/Domain-Guard implementieren.
6. Bestandsstacks mit `origin_party_id=NULL` unverändert testen.

**Gate:** Migrationstests, Legacy-Read-Kompatibilität, exakte Backfill-Counts,
Linkmatrix und persistenter Write-Guard `PASS`.

### Phase 2 — Creator-Kontext und Auswahl

1. Creator zunächst ausschließlich administrativ anlegen und freigeben.
2. Default-Shop und Produkt-Picks pflegen.
3. Kontextsichtbarkeit und `select_default_product` zentral implementieren.
4. Neuanlage/Wechsel einer Stack-Position bindet Attribution atomar.

**Gate:** Creator- und eigener Stack wählen erwartete Produkte; keine
creator-scoped Produkte gelangen ungewollt in den globalen Katalog.

### Phase 3 — Share und Import

1. Versioniertes Snapshot-Schema und Hashvalidierung implementieren.
2. Share-Erstellung, Moderation, Widerruf und Vorschau bauen.
3. Login-/Registrierungs-Rückkehr ohne Vorabimport umsetzen.
4. Einzel- und Stack-Import samt Konfliktwahl und Idempotenz bauen.
5. Kennzeichnung und FAQ integrieren.

**Gate:** Beide Flows sind transaktional, wiederholbar und verändern keine fremden
Stacks oder Produkte.

### Phase 4 — Tracking und Dashboards

1. Bestehenden Outbound-Redirect auf tatsächliche Parteienauflösung erweitern.
2. Datensparsame Click-Events schreiben.
3. Admin-Ansicht und Creator-Aggregate bereitstellen.
4. Feature-Flag bleibt deaktiviert; kein Publish.

**Gate:** Aggregationen stimmen mit Fixture-Events überein und geben keine
rückverfolgbaren Datensätze aus.

### Phase 5 — Abschluss

1. Genau ein risikoproportionaler Gesamtcheck.
2. Functions-TypeScript, Frontendtests/-build, Migrations-/Integrationstests und
   UTF-8-Check.
3. Technischer Review, weil Schema, Migrationen, Runtimeverhalten und persistente
   Writes betroffen sind.
4. Live-Checkliste aktualisieren. Deploy/Publish bleibt ein separater Auftrag.

## 10. Verbindliche Testmatrix

1. **27. Produkt:** Creator-Version vorhanden → Creator; sonst Plattform-Version;
   sonst nacktes sicheres Ziel.
2. **Snapshot:** Neuer Creator-Code oder Pick verändert weder eine bestehende
   Position noch die spätere Attribution eines zuvor veröffentlichten Shares.
3. **Sicherheitsausnahme:** Blockierte/abgelaufene Version verwendet kontrollierten
   Fallback und protokolliert die tatsächlich verdienende Partei.
4. **Eigener vs. Creator-Stack:** Dasselbe Produkt kann ohne Produktduplikat
   unterschiedliche Attributionen besitzen.
5. **Einzelimport in eigenen Stack:** Stack-Herkunft bleibt `NULL`, Position behält
   Creator-Snapshot und -Attribution.
6. **Ganzer Stack:** Neuer Stack trägt Creator-Herkunft; alle Positionen werden
   atomar gebunden.
7. **D3 vs. D3+K2:** Nur exakt gleiche sortierte Hauptwirkstoff-Sets kollidieren.
8. **Mehrfachtreffer:** Kein stilles Überschreiben des ersten Treffers.
9. **Aktiver Stack:** Größtes `last_opened_at`; fehlender Wert führt zu sichtbarer
   Auswahl, nicht zu einer zufälligen DB-Reihenfolge.
10. **Einheiten:** 1000 IE Vitamin D = 25 µg; unbekannte Umrechnung blockiert den
    Vergleich.
11. **URL-Schutz:** Fremddomain, Nutzerinfo, ungültiges Protokoll und manipuliertes
    Stack-/Linkziel werden abgelehnt.
12. **Creator sperren:** Keine neuen Shares/Bindungen und keine globale Sichtbarkeit;
    bestehende Position bleibt referenziell intakt.
13. **Idempotenz:** Derselbe Request-Key erzeugt keinen zweiten Import und keinen
    zweiten Zähleranstieg.
14. **Legacy:** Bestandsstacks und bestehende Produktlinks funktionieren nach dem
    Backfill unverändert oder werden explizit als Blocker ausgewiesen.
15. **Keine doppelte Pflege:** Neue Writes landen nur in kanonischen Tabellen; Tests
    verhindern erneute Dual-Writes in Legacy-Produktfelder.
16. **Performance:** Stackanzeige und Linkauflösung verwenden gebündelte Queries,
    keine produktweise N+1-Schleife.
17. **Datenschutz:** Creator-API liefert ausschließlich Aggregate und Click-Writes
    enthalten keine direkten Nutzerdaten.
18. **Feature-Flag:** Alle neuen öffentlichen Pfade sind bei Standardkonfiguration
    deaktiviert.

## 11. Nicht Teil des MVP

- Creator-Self-Service-Onboarding;
- automatische Einnahmen-/Provisionsimporte;
- Marken-Rechner oder eingebettete Dosierungsrechner;
- individuelle Dosierungsanweisungen;
- physisches Entfernen der Legacy-Spalten;
- produktionsweites FK-Rebuild von `CASCADE` auf `RESTRICT`;
- Deploy, D1-Produktionsmigration oder öffentliche Aktivierung.

## 12. Fertigdefinition für den späteren Goal-Auftrag

Der Implementierungsauftrag ist erst abgeschlossen, wenn:

- keine konkurrierende Produkt-, Wirkstoff-, Shop-, Share-, Klick- oder
  Einheitenwahrheit entstanden ist;
- alle neuen persistenten Writes Identität, erwarteten Altzustand und Count binden;
- Snapshot- und Sicherheitssemantik nachweislich zusammen funktionieren;
- alle Gates und die Testmatrix bestanden sind;
- der technische Review unverändert `PASS` meldet;
- Feature-Flag und Produktionszustand unverändert deaktiviert beziehungsweise
  unveröffentlicht bleiben.
