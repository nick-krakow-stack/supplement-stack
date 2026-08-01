import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { DatabaseSync } from 'node:sqlite'

const migration = readFileSync(
  new URL('../d1-migrations/0097_ingredient_part_amounts.sql', import.meta.url),
  'utf8',
)
const sequenceMigration = readFileSync(
  new URL('../d1-migrations/0098_normalize_subpart_id_sequences.sql', import.meta.url),
  'utf8',
)

function createFixture({
  conflict = false,
  catalogConflict = conflict,
  userConflict = conflict,
  searchRelevant = 0,
} = {}) {
  const db = new DatabaseSync(':memory:')
  db.exec(`
    PRAGMA foreign_keys = ON;
    CREATE TABLE ingredients (
      id INTEGER PRIMARY KEY,
      name TEXT NOT NULL UNIQUE
    );
    CREATE TABLE ingredient_forms (
      id INTEGER PRIMARY KEY,
      ingredient_id INTEGER NOT NULL REFERENCES ingredients(id),
      name TEXT NOT NULL
    );
    CREATE TABLE ingredient_parts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      type TEXT,
      internal_comment TEXT,
      status TEXT NOT NULL DEFAULT 'active',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE ingredient_part_synonyms (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      part_id INTEGER NOT NULL REFERENCES ingredient_parts(id) ON DELETE CASCADE,
      synonym TEXT NOT NULL,
      language TEXT NOT NULL DEFAULT 'de',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(part_id, synonym, language)
    );
    CREATE TABLE ingredient_part_links (
      ingredient_id INTEGER NOT NULL REFERENCES ingredients(id),
      part_id INTEGER NOT NULL REFERENCES ingredient_parts(id),
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      PRIMARY KEY (ingredient_id, part_id)
    );
    CREATE TABLE products (id INTEGER PRIMARY KEY);
    CREATE TABLE product_ingredients (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      product_id INTEGER NOT NULL REFERENCES products(id),
      ingredient_id INTEGER NOT NULL REFERENCES ingredients(id),
      is_main INTEGER NOT NULL DEFAULT 0,
      quantity REAL,
      unit TEXT,
      form_id INTEGER REFERENCES ingredient_forms(id),
      basis_quantity REAL,
      basis_unit TEXT,
      search_relevant INTEGER NOT NULL DEFAULT 1,
      parent_ingredient_id INTEGER REFERENCES ingredients(id)
    );
    CREATE TABLE user_products (id INTEGER PRIMARY KEY);
    CREATE TABLE user_product_ingredients (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_product_id INTEGER NOT NULL REFERENCES user_products(id),
      ingredient_id INTEGER NOT NULL REFERENCES ingredients(id),
      form_id INTEGER REFERENCES ingredient_forms(id),
      quantity REAL,
      unit TEXT,
      basis_quantity REAL,
      basis_unit TEXT,
      search_relevant INTEGER NOT NULL DEFAULT 1,
      parent_ingredient_id INTEGER REFERENCES ingredients(id),
      is_main INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE ingredient_display_profiles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ingredient_id INTEGER NOT NULL REFERENCES ingredients(id),
      form_id INTEGER REFERENCES ingredient_forms(id),
      sub_ingredient_id INTEGER REFERENCES ingredients(id),
      effect_summary TEXT,
      timing TEXT,
      timing_note TEXT,
      intake_hint TEXT,
      card_note TEXT,
      updated_at TEXT,
      version INTEGER NOT NULL DEFAULT 1
    );
    CREATE TABLE display_profile_translations (
      display_profile_id INTEGER NOT NULL REFERENCES ingredient_display_profiles(id) ON DELETE CASCADE,
      language TEXT NOT NULL,
      effect_summary TEXT,
      timing TEXT,
      timing_note TEXT,
      intake_hint TEXT,
      card_note TEXT,
      PRIMARY KEY (display_profile_id, language)
    );
    CREATE TABLE populations (id INTEGER PRIMARY KEY);
    CREATE TABLE dose_recommendations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ingredient_id INTEGER NOT NULL REFERENCES ingredients(id),
      population_id INTEGER NOT NULL REFERENCES populations(id),
      sex_filter TEXT,
      purpose TEXT NOT NULL,
      is_athlete INTEGER NOT NULL DEFAULT 0,
      is_default INTEGER NOT NULL DEFAULT 0,
      is_active INTEGER NOT NULL DEFAULT 0,
      relevance_score INTEGER NOT NULL DEFAULT 0,
      source_label TEXT,
      context_note TEXT,
      updated_at INTEGER,
      version INTEGER NOT NULL DEFAULT 1
    );
    CREATE TABLE dose_recommendation_translations (
      dose_recommendation_id INTEGER NOT NULL REFERENCES dose_recommendations(id),
      language TEXT NOT NULL,
      source_label TEXT,
      context_note TEXT,
      PRIMARY KEY (dose_recommendation_id, language)
    );
    CREATE TABLE ingredient_safety_warnings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ingredient_id INTEGER NOT NULL REFERENCES ingredients(id),
      form_id INTEGER REFERENCES ingredient_forms(id),
      active INTEGER NOT NULL DEFAULT 1,
      short_label TEXT NOT NULL,
      article_slug TEXT,
      version INTEGER NOT NULL DEFAULT 1
    );
    CREATE TABLE knowledge_articles (slug TEXT PRIMARY KEY);

    INSERT INTO ingredients (id, name) VALUES (10, 'Omega-3'), (13, 'L-Carnitin');
    INSERT INTO ingredient_forms (id, ingredient_id, name) VALUES
      (154, 13, 'L-Carnitin Tartrat'),
      (157, 13, 'L-Carnitin L-Tartrat (flüssig)');
    INSERT INTO products (id) VALUES (1);
    INSERT INTO user_products (id) VALUES (1);
    INSERT INTO populations (id) VALUES (1);
  `)

  const secondCatalogQuantity = catalogConflict ? 800 : 500
  const insertCatalog = db.prepare(`
    INSERT INTO product_ingredients
      (product_id, ingredient_id, is_main, quantity, unit, form_id,
       basis_quantity, basis_unit, search_relevant, parent_ingredient_id)
    VALUES (1, 13, 1, ?, 'mg', ?, 2, 'Kapseln', ?, NULL)
  `)
  insertCatalog.run(500, 154, searchRelevant)
  insertCatalog.run(secondCatalogQuantity, 157, searchRelevant)

  const insertUser = db.prepare(`
    INSERT INTO user_product_ingredients
      (user_product_id, ingredient_id, form_id, quantity, unit,
       basis_quantity, basis_unit, search_relevant, parent_ingredient_id, is_main)
    VALUES (1, 13, ?, ?, 'mg', 2, 'Kapseln', ?, NULL, 1)
  `)
  insertUser.run(154, 500, searchRelevant)
  insertUser.run(157, userConflict ? 800 : 500, searchRelevant)
  return db
}

function applyMigration(db) {
  db.exec(`BEGIN IMMEDIATE;\n${migration}\nCOMMIT;`)
}

test('identical tartrate aliases deduplicate and preserve a false search flag', () => {
  const db = createFixture({ searchRelevant: 0 })
  applyMigration(db)

  for (const [parentTable, partTable, ownerColumn] of [
    ['product_ingredients', 'product_ingredient_parts', 'product_ingredient_id'],
    ['user_product_ingredients', 'user_product_ingredient_parts', 'user_product_ingredient_id'],
  ]) {
    const parents = db.prepare(`SELECT * FROM ${parentTable}`).all()
    assert.equal(parents.length, 1)
    assert.equal(parents[0].form_id, null)
    assert.equal(parents[0].quantity, null)
    assert.equal(parents[0].search_relevant, 0)

    const parts = db.prepare(`SELECT * FROM ${partTable}`).all()
    assert.equal(parts.length, 1)
    assert.equal(parts[0][ownerColumn], parents[0].id)
    assert.equal(parts[0].quantity, 500)
    assert.equal(parts[0].unit, 'mg')
    assert.equal(parts[0].basis_quantity, 2)
    assert.equal(parts[0].basis_unit, 'Kapseln')
    assert.equal(parts[0].search_relevant, 0)
  }

  assert.equal(db.prepare('SELECT count(*) AS count FROM ingredient_forms WHERE id IN (154, 157)').get().count, 0)
  assert.equal(db.prepare('PRAGMA foreign_key_check').all().length, 0)
})

test('the production-shaped L-Carnitin user product retains its parent and three contained amounts', () => {
  const db = createFixture()
  db.exec(`
    DELETE FROM product_ingredients;
    DELETE FROM user_product_ingredients;
    DELETE FROM ingredient_forms;
    INSERT INTO ingredient_forms (id, ingredient_id, name) VALUES
      (154, 13, 'L-Carnitin Tartrat'),
      (155, 13, 'Acetyl-L-Carnitin (ALCAR)'),
      (156, 13, 'Propionyl-L-Carnitin'),
      (157, 13, 'L-Carnitin L-Tartrat (flüssig)'),
      (158, 13, 'L-Carnitin Fumarat');
    INSERT INTO user_product_ingredients
      (id, user_product_id, ingredient_id, form_id, quantity, unit,
       basis_quantity, basis_unit, search_relevant, parent_ingredient_id, is_main)
    VALUES
      (1, 1, 13, NULL, 3000, 'mg', 4, 'Kapseln', 1, NULL, 1),
      (2, 1, 13, 155, 1000, 'mg', 4, 'Kapseln', 1, NULL, 0),
      (3, 1, 13, 154, 1000, 'mg', 4, 'Kapseln', 1, NULL, 0),
      (4, 1, 13, 158, 1000, 'mg', 4, 'Kapseln', 1, NULL, 0);
  `)

  applyMigration(db)

  const parent = db.prepare('SELECT * FROM user_product_ingredients').get()
  assert.equal(parent.id, 1)
  assert.equal(parent.quantity, 3000)
  assert.equal(parent.unit, 'mg')
  const parts = db.prepare(`
    SELECT part.name, child.quantity, child.unit, child.basis_quantity, child.basis_unit
    FROM user_product_ingredient_parts child
    JOIN ingredient_parts part ON part.id = child.part_id
    ORDER BY part.name
  `).all()
  assert.deepEqual(parts.map((row) => ({ ...row })), [
    { name: 'Acetyl-L-Carnitin', quantity: 1000, unit: 'mg', basis_quantity: 4, basis_unit: 'Kapseln' },
    { name: 'L-Carnitin-Fumarat', quantity: 1000, unit: 'mg', basis_quantity: 4, basis_unit: 'Kapseln' },
    { name: 'L-Carnitin-Tartrat', quantity: 1000, unit: 'mg', basis_quantity: 4, basis_unit: 'Kapseln' },
  ])
  assert.equal(db.prepare('SELECT count(*) AS count FROM ingredient_forms WHERE id BETWEEN 154 AND 158').get().count, 0)
  assert.equal(db.prepare('PRAGMA foreign_key_check').all().length, 0)
})

test('conflicting tartrate aliases abort atomically and retain the exact legacy state', () => {
  const db = createFixture({ conflict: true, searchRelevant: 1 })
  const beforeCatalog = db.prepare('SELECT * FROM product_ingredients ORDER BY id').all()
  const beforeUser = db.prepare('SELECT * FROM user_product_ingredients ORDER BY id').all()
  const beforeForms = db.prepare('SELECT * FROM ingredient_forms ORDER BY id').all()

  assert.throws(
    () => applyMigration(db),
    /0097: Katalogprodukt enthaelt widerspruechliche Legacy-Formzeilen/,
  )
  if (db.isTransaction) db.exec('ROLLBACK;')

  assert.deepEqual(db.prepare('SELECT * FROM product_ingredients ORDER BY id').all(), beforeCatalog)
  assert.deepEqual(db.prepare('SELECT * FROM user_product_ingredients ORDER BY id').all(), beforeUser)
  assert.deepEqual(db.prepare('SELECT * FROM ingredient_forms ORDER BY id').all(), beforeForms)
  assert.equal(
    db.prepare("SELECT count(*) AS count FROM sqlite_master WHERE name = 'product_ingredient_parts'").get().count,
    0,
  )
  assert.equal(db.prepare('SELECT count(*) AS count FROM ingredient_parts').get().count, 0)
})

test('the user-product conflict guard also aborts before canonical writes', () => {
  const db = createFixture({ userConflict: true, searchRelevant: 1 })
  const before = db.prepare('SELECT * FROM user_product_ingredients ORDER BY id').all()

  assert.throws(
    () => applyMigration(db),
    /0097: Nutzerprodukt enthaelt widerspruechliche Legacy-Formzeilen/,
  )
  if (db.isTransaction) db.exec('ROLLBACK;')

  assert.deepEqual(db.prepare('SELECT * FROM user_product_ingredients ORDER BY id').all(), before)
  assert.equal(db.prepare('SELECT count(*) AS count FROM ingredient_parts').get().count, 0)
})

test('a pre-existing cross-table normalized collision is guarded before seeds', () => {
  const db = createFixture()
  db.exec(`
    INSERT INTO ingredient_parts (id, name, status) VALUES
      (100, 'Alpha-Beta', 'active'),
      (101, 'Gamma', 'active');
    INSERT INTO ingredient_part_synonyms (part_id, synonym, language)
    VALUES (101, 'alpha beta', 'de');
  `)

  assert.throws(
    () => applyMigration(db),
    /Normalisierter Part-Name ist bereits vergeben/,
  )
  if (db.isTransaction) db.exec('ROLLBACK;')

  assert.equal(db.prepare('SELECT count(*) AS count FROM ingredient_parts').get().count, 2)
  assert.equal(db.prepare('SELECT count(*) AS count FROM ingredient_part_synonyms').get().count, 1)
  assert.equal(
    db.prepare("SELECT count(*) AS count FROM sqlite_master WHERE name = 'uq_ingredient_parts_name_norm'").get().count,
    0,
  )
})

test('normalized part names and synonyms are globally unique on insert and update', () => {
  const db = createFixture()
  applyMigration(db)

  const tartrateId = db.prepare("SELECT id FROM ingredient_parts WHERE name = 'L-Carnitin-Tartrat'").get().id
  const epaId = db.prepare("SELECT id FROM ingredient_parts WHERE name = 'EPA'").get().id

  assert.throws(
    () => db.prepare("INSERT INTO ingredient_part_synonyms (part_id, synonym, language) VALUES (?, 'l carnitin_tartrat', 'de')").run(tartrateId),
    /Normalisiertes Part-Synonym ist bereits vergeben/,
  )
  db.prepare("INSERT INTO ingredient_part_synonyms (part_id, synonym, language) VALUES (?, 'Race Name', 'de')").run(epaId)
  assert.throws(
    () => db.prepare("INSERT INTO ingredient_part_synonyms (part_id, synonym, language) VALUES (?, 'race-name', 'en')").run(tartrateId),
    /Normalisiertes Part-Synonym ist bereits vergeben/,
  )
  assert.throws(
    () => db.prepare("INSERT INTO ingredient_parts (name, status) VALUES ('race_name', 'active')").run(),
    /Normalisierter Part-Name ist bereits vergeben/,
  )

  db.prepare('UPDATE ingredient_parts SET name = name WHERE id = ?').run(tartrateId)
  db.prepare("UPDATE ingredient_part_synonyms SET synonym = synonym WHERE synonym = 'Race Name'").run()
  assert.throws(
    () => db.prepare("UPDATE ingredient_part_synonyms SET synonym = 'D-H-A' WHERE synonym = 'Race Name'").run(),
    /Normalisiertes Part-Synonym ist bereits vergeben/,
  )
  assert.equal(db.prepare('PRAGMA foreign_key_check').all().length, 0)
})

test('duplicate AUTOINCREMENT metadata is normalized and reserves disjoint ranges', () => {
  const db = new DatabaseSync(':memory:')
  for (const table of [
    'products',
    'product_ingredients',
    'user_products',
    'user_product_ingredients',
    'ingredient_parts',
  ]) {
    db.exec(`CREATE TABLE ${table} (id INTEGER PRIMARY KEY AUTOINCREMENT);`)
    db.prepare(`INSERT INTO ${table} (id) VALUES (?)`).run(table === 'user_product_ingredients' ? 5 : 2)
    db.prepare('INSERT INTO sqlite_sequence(name, seq) VALUES (?, ?)').run(table, 1)
  }

  db.exec(sequenceMigration)
  for (const table of [
    'products',
    'product_ingredients',
    'user_products',
    'user_product_ingredients',
    'ingredient_parts',
  ]) {
    const rows = db.prepare('SELECT seq FROM sqlite_sequence WHERE name = ?').all(table)
    assert.equal(rows.length, 1)
    const before = Number(rows[0].seq)
    const first = db.prepare(`
      UPDATE sqlite_sequence
      SET seq = MAX(seq, (SELECT COALESCE(MAX(id), 0) FROM ${table})) + 2
      WHERE name = ?
      RETURNING seq - 2 + 1 AS first_id
    `).get(table).first_id
    const second = db.prepare(`
      UPDATE sqlite_sequence
      SET seq = MAX(seq, (SELECT COALESCE(MAX(id), 0) FROM ${table})) + 2
      WHERE name = ?
      RETURNING seq - 2 + 1 AS first_id
    `).get(table).first_id
    assert.equal(first, before + 1)
    assert.equal(second, before + 3)
  }
})
