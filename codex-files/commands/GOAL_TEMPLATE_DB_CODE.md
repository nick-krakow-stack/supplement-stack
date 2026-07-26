# /goal-Vorlage: risikorelevante DB-/Code-Eingriffe

Für Schema-/Migrationsänderungen, Runtime-Umbauten, destruktive Datenoperationen
oder Writes ohne bereits getesteten Guard. Nicht für Wirkstoff-Artikel,
kanonisch gegatete Content-Imports oder die Artikel-Fast-Lanes `M`/`E`.

```text
/goal {{AUFGABE konkret beschreiben}}

Arbeite autonom bis zum Ziel. Lies zuerst den relevanten Ist-Zustand in Schema,
Migrationen, Runtime-Lesewegen, Daten und Tests. Erweitere bestehende Strukturen
bevorzugt additiv und schaffe keine konkurrierende Wahrheit.

TECHNISCHER REVIEW VOR APPLY/MERGE:
Rufe `technical-change-reviewer` auf, wenn die Änderung Schema/Migration,
Runtimeverhalten, eine destruktive Operation oder einen noch ungeprüften
Write-Guard betrifft. Der Reviewer prüft ausschließlich:
- Guard und atomare Fehlergrenzen;
- Datenverlust/destruktive Wirkung einschließlich Backup;
- Sichtbarkeits- und Filter-Lecks;
- Enum-, Pflichtfeld- und Rückwärtskompatibilität;
- konkurrierende Wahrheiten und unbewiesene Schema-/Runtime-Annahmen.

Bei `FAIL`: Befund korrigieren und nur den betroffenen Risikobereich erneut
prüfen. Bei `PASS`: anwenden/mergen und proportional testen. Kein technischer
Review ist nötig für rein redaktionelle Änderungen, kanonisch validierte guarded
Content-Imports oder Artikelklasse `M`/`E`.

HARTE GRENZEN:
- Schema, Runtime und API-Felder auf Englisch; sichtbare UI-Texte auf Deutsch.
- Destruktive Änderungen nur, wenn additiv nicht tragfähig ist; vorher einen
  verifizierbaren, eng begrenzten Snapshot/Backup erzeugen.
- Keine erfundenen Pflichtwerte; fehlend bleibt `null` oder der Eintrag entfällt.
- Cloudflare-Worker-, D1-, KV-, R2-, Wrangler- und i18n-Invarianten aus
  `AGENTS.md` einhalten.

ABSCHLUSS:
Nenne geänderten Scope, Tests, technischen Review nur wenn er tatsächlich nötig
war, etwaige FAIL->Fix-Runden, Backup/Guard und verbleibende Risiken.
```
