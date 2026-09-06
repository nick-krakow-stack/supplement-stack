-- Immutable release seed, not a second runtime/fallback source.
-- Public legal_documents are the sole live editing surface after this migration.
-- The three empty v0 drafts were verified remotely on 2026-09-06.
-- Additive scoped snapshots preserve every previous field. No existing prose is overwritten.
-- D1 migrations run transactionally; a mismatch aborts the release before content writes.
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS legal_document_release_history (
  release_key TEXT NOT NULL,
  slug TEXT NOT NULL,
  before_snapshot_json TEXT NOT NULL CHECK (json_valid(before_snapshot_json)),
  applied_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (release_key, slug)
);

CREATE TABLE _0111_legal_targets (
  slug TEXT PRIMARY KEY,
  old_title TEXT NOT NULL,
  new_title TEXT NOT NULL,
  new_body_md TEXT NOT NULL
);
INSERT INTO _0111_legal_targets (slug, old_title, new_title, new_body_md) VALUES
('impressum', 'Impressum', 'Impressum', '## Angaben nach § 5 DDG

Nick Krakow
Einzelunternehmer
Brockesstr. 58
23554 Lübeck
Deutschland

E-Mail: [email@nickkrakow.de](mailto:email@nickkrakow.de)

## Umsatzsteuer

Kleinunternehmer gemäß § 19 UStG; Umsatzsteuer wird nicht ausgewiesen; eine USt-IdNr. ist nicht vorhanden.

## Verantwortlich für Inhalte

Verantwortlich im Sinne des § 18 Abs. 2 MStV:
Nick Krakow, Brockesstr. 58, 23554 Lübeck

## Streitbeilegung

Ich bin weder bereit noch verpflichtet, an Streitbeilegungsverfahren vor einer Verbraucherschlichtungsstelle teilzunehmen.

## Affiliate-Hinweis

Einige Produktlinks können Affiliate-Links sein. Wenn du darüber kaufst, erhält der Betreiber ggf. eine Provision. Für dich entstehen dadurch keine zusätzlichen Kosten und die Produktreihung orientiert sich nicht am Provisionsmodell.

Die Nutzung der App bleibt kostenlos.'),
('datenschutz', 'Datenschutz', 'Datenschutzerklärung', '## Kurz erklärt

- **Welche Daten?** Je nach Nutzung speichern wir Kontodaten, deine Stacks und Produkte sowie technische Daten für den sicheren Betrieb. Angaben zu deiner Supplement-Nutzung können gesundheitsbezogene Rückschlüsse zulassen.
- **Wofür?** Damit du dich anmelden, deine Einträge verwalten und gewünschte E-Mails erhalten kannst. Eine optionale Nutzungsanalyse erfolgt nur nach deiner Zustimmung.
- **Wie lange?** Konto- und App-Daten bleiben grundsätzlich gespeichert, solange dein Konto besteht oder du die jeweilige Funktion nutzt. Bei einer Kontolöschung werden die zugehörigen App-Daten gelöscht, soweit keine gesetzlichen Pflichten entgegenstehen. Weitere Speicherfristen stehen unten unter „Speicherdauer“ und „Hosting und technische Dienstleister“.
- **Welche Rechte hast du?** Du kannst unter den gesetzlichen Voraussetzungen Auskunft, Berichtigung, Löschung und weitere Datenschutzrechte verlangen. Eine Einwilligung kannst du für die Zukunft widerrufen. Deine Wahl zur Nutzungsanalyse änderst du über „Cookie-Einstellungen“ im Fußbereich der Seite.
- **An wen kannst du dich wenden?** An [email@nickkrakow.de](mailto:email@nickkrakow.de). Auch die zuständige Datenschutzaufsicht und weitere Rechte findest du in der vollständigen Erklärung.

Dieser Überblick erleichtert den Einstieg. Die vollständige Datenschutzerklärung mit den Einzelheiten folgt direkt darunter.

## Vollständige Datenschutzerklärung

Diese Datenschutzerklärung informiert darüber, wie Supplement Stack personenbezogene Daten verarbeitet, wenn du die Website und die App nutzt.

Verantwortlicher: Nick Krakow, Brockesstr. 58, 23554 Lübeck, E-Mail: [email@nickkrakow.de](mailto:email@nickkrakow.de).

### Verarbeitete Daten

Supplement Stack folgt dem Grundsatz der Datenminimierung. Je nach Nutzung verarbeiten wir Account-Daten wie E-Mail-Adresse, Login-Informationen, Passwort-Hash und E-Mail-Bestätigung, außerdem optionales Alter, die gewählte Quellenpräferenz, der Status deiner Einwilligung zur Speicherung, gespeicherte Stacks und Produkte, Dosierungs-, Einnahmeintervall- und Kostendaten sowie von dir eingereichte Produktdaten.

Die App fragt keine Diagnose-, Krankheits-, Medikamenten-, Geschlechts-, Ernährungs-, Ziel- oder Raucherstatus-Felder ab. Stack-, Produkt- und Dosierungsdaten können dennoch gesundheitsnah sein, weil sie Rückschlüsse auf Supplement-Nutzung zulassen können.

Zusätzliche E-Mail-Funktionen verarbeiten:
- E-Mail-Adresse und einmaligen Passwort-Reset-Link für "Passwort vergessen"
- Stack-Mail-Inhalte (Stackname, Produktdaten, Inhaltsangaben, Dosierungen, Einnahmeintervalle und Kosteninformationen), wenn du "Stack mailen" nutzt.

Außerdem werden technische Sicherheits- und Serverlogdaten verarbeitet, etwa IP-Adresse, Zeitpunkt, angefragte URL, Statuscode, Browser- und Gerätedaten. Die Cookie- und Analytics-Entscheidung wird lokal in deinem Browser gespeichert.

### Zwecke und Rechtsgrundlagen

Die Verarbeitung erfolgt zur Bereitstellung von Account, Login, E-Mail-Bestätigung, Stack-Verwaltung, eigenen Produkten und App-Sicherheit auf Grundlage von Art. 6 Abs. 1 lit. b DSGVO, soweit sie für die Nutzung des Dienstes erforderlich ist.

Sicherheitslogs, Missbrauchserkennung und technische Stabilität beruhen auf Art. 6 Abs. 1 lit. f DSGVO. Gesetzliche Aufbewahrungspflichten, soweit sie entstehen, beruhen auf Art. 6 Abs. 1 lit. c DSGVO.

Gesundheitsnahe Stack-, Produkt- und Dosierungsdaten sowie der Health Consent werden auf Grundlage deiner Einwilligung verarbeitet, soweit sie einen besonderen Kategorienbezug im Sinne von Art. 9 DSGVO haben können, insbesondere Art. 9 Abs. 2 lit. a DSGVO. E-Mail-Zwecke, Analytics- und nicht erforderliche Informationen im Endgerät beruhen auf deiner Einwilligung (Art. 6 Abs. 1 lit. a DSGVO und § 25 TDDDG). Einwilligungen können mit Wirkung für die Zukunft widerrufen werden.

### Hosting und technische Dienstleister

Die App läuft auf Cloudflare Pages und Cloudflare Functions. Daten werden für die App-Funktionalität in Cloudflare D1 verarbeitet. Cloudflare KV und Cloudflare R2 werden außerdem als technische Speicherorte genutzt (z. B. Missbrauchsschutz-Zähler und Produktbilder).

Passwort-Reset-Mails, E-Mail-Bestätigung und Stack-Mails werden über den konfigurierten SMTP-Dienst versendet. In der aktuellen Konfiguration erfolgt der Versand über All-Inkl/SMTP (Host: w020a88d.kasserver.com, Port 465).

Für Quellcode, Deployment und D1-Backups wird GitHub und GitHub Actions verwendet. D1-Backups werden als Workflow-Artefakt erstellt und nach 30 Tagen automatisch gelöscht.

Diese Dienste werden nur im Rahmen ihrer technischen Aufgabe als Auftragsverarbeiter eingesetzt.

Bei Cloudflare, GitHub beziehungsweise Google Analytics können Verarbeitungen oder Übermittlungen in Drittländer, insbesondere die USA, nicht ausgeschlossen werden. Soweit erforderlich, werden vertragliche oder gesetzliche Garantien genutzt.

### Cookies, lokaler Speicher und Google Analytics

Supplement Stack nutzt einen Cookie- beziehungsweise Analytics-Banner. Deine Entscheidung wird im lokalen Speicher deines Browsers gespeichert, damit die Auswahl bei späteren Besuchen berücksichtigt werden kann.

Google Analytics 4 wird nur verwendet, wenn du aktiv zustimmst. Vor deiner Zustimmung wird das Google-Analytics-Skript nicht geladen und es werden keine Analytics-Events an Google gesendet.

Nach Zustimmung können Seitenaufrufe innerhalb der App an Google Analytics (Google LLC / Google Ireland Limited) übermittelt werden. Dabei werden technische Informationen wie aufgerufene URL, Zeitpunkt, Browser- und Geräteinformationen verarbeitet.

Google Signals ist nicht aktiviert. Ad-Storage, Ad-User-Data und Ad-Personalisierung werden per Consent-Konfiguration weiterhin als "denied" geführt.

Die Speicherung der Analytics-Daten richtet sich nach den Aufbewahrungseinstellungen der jeweiligen Google-Analytics-Property. Du kannst deine gespeicherte Entscheidung jederzeit über den Link **Cookie-Einstellungen** im Footer ändern.

### Speicherdauer

Account- und App-Daten werden grundsätzlich gespeichert, solange dein Account besteht oder die jeweilige App-Funktion genutzt wird. Wenn du deinen Account löschst, werden zugehörige App-Daten gelöscht, soweit keine gesetzlichen Pflichten entgegenstehen.

Technische Logdaten und Cloudflare-KV-Daten (z. B. Rate-Limits, Sicherheitszähler) werden nur so lange gespeichert, wie sie für Sicherheit und Missbrauchsschutz erforderlich sind. Aufgrund der aktuellen TTL-Logik enden diese Datensätze typischerweise innerhalb kurzer Zeit bis zu ca. 2 Stunden.

Cloudflare R2 speichert Produktbilder in Verbindung mit Produkt- und Nutzerangaben. Diese Daten werden solange gehalten, wie die jeweiligen Datensätze aktiv sind oder bis eine Löschung erfolgt.

### Deine Rechte

Du hast nach Maßgabe der DSGVO Rechte auf Auskunft, Berichtigung, Löschung, Einschränkung der Verarbeitung, Datenübertragbarkeit und Widerspruch. Soweit eine Verarbeitung auf Einwilligung beruht, kannst du diese Einwilligung jederzeit mit Wirkung für die Zukunft widerrufen.

Datenschutzaufsicht:
Unabhängige Landesstelle für Datenschutz Schleswig-Holstein (ULD Schleswig-Holstein), Holstenstraße 98, 24103 Kiel, [https://www.datenschutzzentrum.de/](https://www.datenschutzzentrum.de/).

Für individuelle Rechte kannst du dich außerdem an den Verantwortlichen wenden: [email@nickkrakow.de](mailto:email@nickkrakow.de). Eingeloggte Nutzer können Profil- und Account-Funktionen direkt in der App nutzen.'),
('nutzungsbedingungen', 'Nutzungsbedingungen', 'Nutzungsbedingungen', '## Kurz erklärt

- **Wobei hilft die App?** Du kannst Supplement-Stacks und Produktinformationen verwalten. Der Dienst ist kostenlos; ein Abonnement ist derzeit nicht vorgesehen.
- **Was brauchst du zum Speichern?** Ein Konto. Halte deine Zugangsdaten geheim und achte auf richtige Angaben sowie die Rechte anderer.
- **Was sind die Grenzen?** Die App stellt Informationen und Berechnungen bereit. Die medizinischen Grenzen sind an einer Stelle in Abschnitt 3 erklärt.
- **Was kann sich ändern?** Wartung oder Störungen können die Nutzung unterbrechen. Funktionen können weiterentwickelt oder eingestellt werden. Für die Haftung gelten die gesetzlichen Regeln.

Dieser Überblick ersetzt die vollständigen Nutzungsbedingungen nicht. Sie folgen direkt darunter.

## Vollständige Nutzungsbedingungen

### 1. Anbieter und Geltungsbereich

Diese Nutzungsbedingungen gelten für die Nutzung von Supplement Stack, angeboten durch Nick Krakow, Brockesstr. 58, 23554 Lübeck, E-Mail: [email@nickkrakow.de](mailto:email@nickkrakow.de).

Supplement Stack ist ein kostenloser Dienst zur Verwaltung von Supplement-Stacks, Produktinformationen, gespeicherten Daten und eigenen Produktdaten. Eine kostenpflichtige Version oder ein Abonnement ist aktuell nicht vorgesehen.

### 2. Account und Nutzung

Nutzer können einen Account anlegen, um Stacks und eigene Produkte zu speichern. Du bist dafür verantwortlich, deine Zugangsdaten vertraulich zu behandeln und korrekte Angaben zu machen.

Die App darf nicht missbräuchlich genutzt werden, insbesondere nicht zur Störung des Betriebs, Umgehung von Sicherheitsfunktionen oder Eingabe rechtswidriger Inhalte.

### 3. Medizinische Grenzen

Supplement Stack stellt allgemeine Informationen, Berechnungen und Verwaltungsfunktionen bereit. Sie ersetzen keine ärztliche Beratung, Diagnose, Behandlung, Therapie oder medizinische Überwachung. Die Inhalte sind nicht auf deine persönliche gesundheitliche Situation abgestimmt; eine entsprechende Eignung wird nicht zugesichert.

Wenn du Medikamente einnimmst, eine Erkrankung hast, schwanger bist oder stillst, besprich Änderungen an deiner Supplement-Nutzung oder Dosierung vorher mit ärztlichem Fachpersonal. Bei Fragen zu Wechselwirkungen, Gegenanzeigen oder vermuteten Nebenwirkungen wende dich an eine Arztpraxis oder Apotheke. In einem medizinischen Notfall nutze den Notruf oder die ärztliche Notfallversorgung.

### 4. Eigene Produkte und Inhalte

Du kannst eigene Produkte und Stack-Daten speichern. Du bist dafür verantwortlich, dass deine Eingaben richtig sind und keine Rechte Dritter verletzen. Supplement Stack kann Inhalte entfernen oder Funktionen einschränken, wenn Missbrauch oder ein Rechtsverstoß naheliegt.

### 5. Verfügbarkeit und Änderungen

Es besteht kein Anspruch auf jederzeitige Verfügbarkeit. Wartung, technische Störungen oder Weiterentwicklung können die Nutzung zeitweise einschränken. Funktionen können geändert, erweitert oder eingestellt werden.

### 6. Affiliate-Links

Einige Produktlinks können Affiliate-Links sein. Wenn du darüber kaufst, erhält der Betreiber ggf. eine Provision. Für dich entstehen dadurch keine zusätzlichen Kosten und die Produktreihung orientiert sich nicht am Provisionsmodell.

### 7. Haftung

Die App wird sorgfältig betrieben und weiterentwickelt. Eine Garantie für Vollständigkeit, Richtigkeit oder Aktualität der Inhalte und Produktdaten wird nicht übernommen.

Die gesetzlichen Haftungsregelungen bleiben uneingeschränkt anwendbar.

### 8. Schlussbestimmungen

Es gilt deutsches Recht. Sollten einzelne Regelungen unwirksam sein, bleibt die Wirksamkeit der übrigen Regelungen unberührt.');

CREATE TABLE _0111_legal_guard (reason TEXT);
CREATE TRIGGER _0111_legal_guard_abort BEFORE INSERT ON _0111_legal_guard
BEGIN SELECT RAISE(ABORT, '0111: Unerwarteter Rechtstext-Vorzustand; kein Entwurf wird überschrieben.'); END;

-- Only the complete known draft set, or a completely recorded earlier apply,
-- is valid. A later administrator edit is never reset by a migration replay.
INSERT INTO _0111_legal_guard (reason)
SELECT 'prestate'
WHERE NOT (
  (SELECT COUNT(*) FROM legal_document_release_history WHERE release_key = 'legal_ux_20260906') = 3
  AND (SELECT COUNT(*) FROM legal_document_release_history h JOIN _0111_legal_targets t ON t.slug = h.slug WHERE h.release_key = 'legal_ux_20260906') = 3
)
AND NOT (
  (SELECT COUNT(*) FROM legal_document_release_history WHERE release_key = 'legal_ux_20260906') = 0
  AND (SELECT COUNT(*) FROM legal_documents d JOIN _0111_legal_targets t ON t.slug = d.slug
    WHERE d.title = t.old_title AND d.body_md = '' AND d.status = 'draft' AND d.version = 0
      AND d.published_at IS NULL AND d.updated_by_user_id IS NULL) = 3
);

CREATE TABLE _0111_legal_apply (should_apply INTEGER NOT NULL CHECK (should_apply IN (0, 1)));
INSERT INTO _0111_legal_apply SELECT CASE WHEN EXISTS (
  SELECT 1 FROM legal_document_release_history WHERE release_key = 'legal_ux_20260906'
) THEN 0 ELSE 1 END;

INSERT INTO legal_document_release_history (release_key, slug, before_snapshot_json)
SELECT 'legal_ux_20260906', d.slug, json_object(
  'slug', d.slug, 'title', d.title, 'body_md', d.body_md, 'status', d.status,
  'published_at', d.published_at, 'updated_by_user_id', d.updated_by_user_id,
  'version', d.version, 'created_at', d.created_at, 'updated_at', d.updated_at
)
FROM legal_documents d JOIN _0111_legal_targets t ON t.slug = d.slug
WHERE (SELECT should_apply FROM _0111_legal_apply) = 1;

UPDATE legal_documents
SET title = (SELECT new_title FROM _0111_legal_targets WHERE slug = legal_documents.slug),
    body_md = (SELECT new_body_md FROM _0111_legal_targets WHERE slug = legal_documents.slug),
    status = 'published', version = version + 1,
    published_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
WHERE slug IN (SELECT slug FROM _0111_legal_targets)
  AND status = 'draft' AND version = 0 AND body_md = ''
  AND published_at IS NULL AND updated_by_user_id IS NULL
  AND title = (SELECT old_title FROM _0111_legal_targets WHERE slug = legal_documents.slug)
  AND (SELECT should_apply FROM _0111_legal_apply) = 1;

INSERT INTO _0111_legal_guard (reason)
SELECT 'apply-count-and-values'
WHERE (SELECT should_apply FROM _0111_legal_apply) = 1 AND (
  changes() <> 3 OR
  (SELECT COUNT(*) FROM legal_documents d JOIN _0111_legal_targets t ON t.slug = d.slug
    WHERE d.title = t.new_title AND d.body_md = t.new_body_md AND d.status = 'published'
      AND d.version = 1 AND d.published_at IS NOT NULL AND d.updated_at = d.published_at
      AND d.updated_by_user_id IS NULL) <> 3
);

DROP TABLE _0111_legal_apply;
DROP TRIGGER _0111_legal_guard_abort;
DROP TABLE _0111_legal_guard;
DROP TABLE _0111_legal_targets;
