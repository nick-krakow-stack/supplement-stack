import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';

const migration = readFileSync(new URL('../d1-migrations/0111_publish_central_legal_documents.sql', import.meta.url), 'utf8');
const targets = ['datenschutz', 'impressum', 'nutzungsbedingungen'];
function database() {
  const db = new DatabaseSync(':memory:');
  db.exec(`CREATE TABLE legal_documents (
    slug TEXT PRIMARY KEY, title TEXT NOT NULL, body_md TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'draft', published_at TEXT, updated_by_user_id INTEGER,
    version INTEGER NOT NULL DEFAULT 0, created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
  );
  INSERT INTO legal_documents(slug,title) VALUES
    ('impressum','Impressum'), ('datenschutz','Datenschutz'),
    ('nutzungsbedingungen','Nutzungsbedingungen'), ('cookie-consent','Cookie-Consent'),
    ('affiliate-disclosure','Affiliate-Hinweis');`);
  return db;
}
const rows = db => db.prepare('SELECT * FROM legal_documents ORDER BY slug').all().map(row => ({ ...row }));
function apply(db) {
  db.exec('BEGIN');
  try { db.exec(migration); db.exec('COMMIT'); }
  catch (error) { db.exec('ROLLBACK'); throw error; }
}

test('publishes exactly three empty drafts with full scoped before snapshots and readable copy', () => {
  const db = database();
  const before = rows(db);
  apply(db);
  const after = rows(db);
  for (const row of after) {
    if (!targets.includes(row.slug)) { assert.deepEqual(row, before.find(old => old.slug === row.slug)); continue; }
    assert.equal(row.status, 'published');
    assert.equal(row.version, 1);
    assert.ok(row.body_md.length > 500);
    assert.equal(row.updated_at, row.published_at);
    assert.equal(row.created_at, before.find(old => old.slug === row.slug).created_at);
    assert.match(row.body_md, /email@nickkrakow\.de/);
    assert.doesNotMatch(row.body_md, /[\uFFFD]|N\?hrstoff/);
  }
  for (const slug of ['datenschutz', 'nutzungsbedingungen']) {
    assert.match(after.find(row => row.slug === slug).body_md, /^## Kurz erklärt/);
  }
  const privacy = after.find(row => row.slug === 'datenschutz').body_md;
  for (const topic of ['Welche Daten?', 'Wofür?', 'Wie lange?', 'Welche Rechte hast du?', 'Vollständige Datenschutzerklärung', 'Art. 9 Abs. 2 lit. a', '30 Tagen', '2 Stunden']) assert.ok(privacy.includes(topic), topic);
  const terms = after.find(row => row.slug === 'nutzungsbedingungen').body_md;
  assert.equal((terms.match(/Notfall/g) ?? []).length, 2); // one sentence, Notfall + Notfallversorgung
  assert.doesNotMatch(terms, /haftet nicht|Medizinische Eingabefälle/);
  assert.match(terms, /gesetzlichen Haftungsregelungen bleiben uneingeschränkt anwendbar/);
  const snapshots = db.prepare('SELECT slug,before_snapshot_json FROM legal_document_release_history ORDER BY slug').all();
  assert.equal(snapshots.length, 3);
  for (const saved of snapshots) assert.deepEqual(JSON.parse(saved.before_snapshot_json), before.find(row => row.slug === saved.slug));
  assert.equal(db.prepare("SELECT COUNT(*) AS count FROM sqlite_master WHERE name LIKE '_0111_%'").get().count, 0);
  db.close();
});

test('replay is idempotent and preserves a subsequent central administrator edit', () => {
  const db = database(); apply(db);
  const first = rows(db); apply(db); assert.deepEqual(rows(db), first);
  db.exec("UPDATE legal_documents SET body_md='Spätere zentrale Redaktion',version=2,updated_at='2026-09-07 12:00:00' WHERE slug='datenschutz'");
  const updated = rows(db); apply(db); assert.deepEqual(rows(db), updated);
  assert.equal(db.prepare('SELECT COUNT(*) AS count FROM legal_document_release_history').get().count, 3);
  db.close();
});

for (const [name, mutation] of [
  ['nonempty draft', "UPDATE legal_documents SET body_md='Noch unveröffentlichter eigener Text' WHERE slug='datenschutz'"],
  ['changed version', "UPDATE legal_documents SET version=1 WHERE slug='impressum'"],
  ['changed title', "UPDATE legal_documents SET title='Eigene Fassung' WHERE slug='impressum'"],
  ['already published', "UPDATE legal_documents SET status='published' WHERE slug='datenschutz'"],
  ['existing author edit', "UPDATE legal_documents SET updated_by_user_id=7 WHERE slug='nutzungsbedingungen'"],
  ['prior publication marker', "UPDATE legal_documents SET published_at='2026-09-01' WHERE slug='nutzungsbedingungen'"],
  ['missing target', "DELETE FROM legal_documents WHERE slug='impressum'"],
]) {
  test(`rejects ${name} before changing any legal document`, () => {
    const db = database(); db.exec(mutation); const before = rows(db);
    assert.throws(() => apply(db), /0111: Unerwarteter Rechtstext/);
    assert.deepEqual(rows(db), before);
    assert.equal(db.prepare("SELECT COUNT(*) AS count FROM sqlite_master WHERE name='legal_document_release_history'").get().count, 0);
    db.close();
  });
}

test('a partial update is rejected and the transaction including backup rows is rolled back', () => {
  const db = database(); const before = rows(db);
  db.exec("CREATE TRIGGER test_ignore BEFORE UPDATE ON legal_documents WHEN OLD.slug='datenschutz' BEGIN SELECT RAISE(IGNORE); END;");
  assert.throws(() => apply(db), /0111: Unerwarteter Rechtstext/);
  assert.deepEqual(rows(db), before);
  assert.equal(db.prepare("SELECT COUNT(*) AS count FROM sqlite_master WHERE name='legal_document_release_history'").get().count, 0);
  db.close();
});
