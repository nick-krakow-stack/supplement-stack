import { afterEach, describe, expect, it } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  createProductionKnowledgeHonoHarness,
  type ProductionKnowledgeHonoHarness,
} from './productionKnowledgeHonoTestHarness';

type TestStatement = {
  bind: (...values: unknown[]) => TestStatement;
  first: <T>() => Promise<T | null>;
  all: <T>() => Promise<{ results: T[] }>;
};
type TestDatabase = { prepare: (sql: string) => TestStatement };

function migrationPath(file: string): string {
  return resolve(process.cwd(), '..', 'd1-migrations', file);
}

function applyThrough(harness: ProductionKnowledgeHonoHarness, lastFile: string): void {
  const directory = resolve(process.cwd(), '..', 'd1-migrations');
  for (const file of readdirSync(directory).filter((name) => /^\d+.*\.sql$/.test(name)).sort()) {
    if (file > lastFile) break;
    const sql = readFileSync(resolve(directory, file), 'utf8');
    harness.exec(file === '0104_remove_stack_categories.sql'
      ? `BEGIN IMMEDIATE;\n${sql}\nCOMMIT;`
      : sql);
  }
}

describe('Release-B destructive stack migrations', () => {
  let harness: ProductionKnowledgeHonoHarness | null = null;

  afterEach(() => {
    harness?.close();
    harness = null;
  });

  it('removes categories after an exact guarded snapshot and preserves every item and creator binding byte', async () => {
    harness = createProductionKnowledgeHonoHarness();
    applyThrough(harness, '0103_stack_trash_description.sql');
    const db = harness.db as TestDatabase;
    harness.run("INSERT INTO users (id, email, password_hash, role, email_verified_at) VALUES (9100, 'stack-fixture@test.invalid', 'x', 'user', CURRENT_TIMESTAMP)");
    harness.run("INSERT INTO parties (id, type, name, slug, status, auto_catalog_approval) VALUES (9100, 'creator', 'Fixture Creator', 'fixture-creator', 'active', 0)");
    harness.run("INSERT INTO stacks (id, user_id, name, origin_party_id) VALUES (9100, 9100, 'Morgen', 9100), (9101, 9100, 'Abend', 9100)");
    harness.run("INSERT INTO stack_categories (id, stack_id, name, name_normalized, sort_order, is_default) VALUES (9100, 9100, 'Basis', 'basis', 0, 1), (9101, 9100, 'Sport', 'sport', 1, 0), (9102, 9101, 'Abend', 'abend', 0, 1)");

    const target = await db.prepare(`
      SELECT psl.id AS shop_link_id, psl.product_id
      FROM product_shop_links psl
      JOIN products product ON product.id = psl.product_id
      ORDER BY psl.id ASC
      LIMIT 1
    `).first<{ shop_link_id: number; product_id: number }>();
    expect(target).not.toBeNull();
    harness.run(`
      INSERT INTO stack_items (
        id, stack_id, catalog_product_id, quantity, dosage_text, timing,
        intake_interval_days, sort_order, category_id, creator_statement_snapshot,
        amount_source, version
      ) VALUES
        (9100, 9100, ?, 2, '250 µg täglich', 'morning', 2, 4, 9101, 'Creator sagt: regelmäßig.', 'creator_snapshot', 7),
        (9101, 9101, ?, 1, NULL, 'evening', 1, 8, 9102, NULL, 'user', 3)
    `, target!.product_id, target!.product_id);
    harness.run(`
      INSERT INTO stack_item_link_bindings (
        stack_item_id, shop_link_id, resolution_kind, affiliate_version_id,
        resolved_party_id, bound_at
      ) VALUES
        (9100, ?, 'legacy_resolved', NULL, 9100, '2026-08-16 12:00:00.123+02:00'),
        (9101, ?, 'bare', NULL, NULL, '2026-08-16T10:00:00Z')
    `, target!.shop_link_id, target!.shop_link_id);

    const itemSql = `
      SELECT id, stack_id, catalog_product_id, user_product_id, quantity,
             dosage_text, timing, intake_interval_days, sort_order,
             source_share_link_id, creator_statement_snapshot, amount_source, version
      FROM stack_items WHERE id IN (9100, 9101) ORDER BY id
    `;
    const bindingSql = `
      SELECT stack_item_id, shop_link_id, resolution_kind, affiliate_version_id,
             resolved_party_id, bound_at
      FROM stack_item_link_bindings WHERE stack_item_id IN (9100, 9101)
      ORDER BY stack_item_id
    `;
    const beforeItems = (await db.prepare(itemSql).all<Record<string, unknown>>()).results;
    const beforeBindings = (await db.prepare(bindingSql).all<Record<string, unknown>>()).results;
    const categoryCount = await db.prepare('SELECT COUNT(*) AS count FROM stack_categories').first<{ count: number }>();
    const assignmentCount = await db.prepare('SELECT COUNT(*) AS count FROM stack_items WHERE category_id IS NOT NULL').first<{ count: number }>();
    expect(categoryCount?.count).toBe(3);
    expect(assignmentCount?.count).toBe(2);
    expect(beforeBindings).toHaveLength(2);
    expect((await db.prepare('PRAGMA foreign_keys').first<{ foreign_keys: number }>())?.foreign_keys).toBe(1);

    const migrationSql = readFileSync(migrationPath('0104_remove_stack_categories.sql'), 'utf8');
    expect(migrationSql).toContain('PRAGMA defer_foreign_keys = ON');
    expect(migrationSql).not.toContain('PRAGMA foreign_keys = OFF');
    expect(migrationSql).toContain('stack_item_link_binding_archive_0104');
    expect(migrationSql).toContain('(SELECT COUNT(*) FROM stack_category_archive_0104) =');
    expect(migrationSql).toContain('(SELECT COUNT(*) FROM stack_item_category_archive_0104) =');
    harness.exec(`BEGIN IMMEDIATE;\n${migrationSql}\nCOMMIT;`);

    const afterItems = (await db.prepare(itemSql).all<Record<string, unknown>>()).results;
    const afterBindings = (await db.prepare(bindingSql).all<Record<string, unknown>>()).results;
    expect(afterItems).toEqual(beforeItems);
    expect(afterBindings).toEqual(beforeBindings);

    const columns = (await db.prepare('PRAGMA table_info(stack_items)').all<{ name: string }>()).results.map((row) => row.name);
    expect(columns).not.toContain('category_id');
    const retiredTables = (await db.prepare(`
      SELECT name FROM sqlite_master
      WHERE type = 'table' AND name IN (
        'stack_categories',
        'stack_category_archive_0104',
        'stack_item_category_archive_0104',
        'stack_item_link_binding_archive_0104',
        'stack_category_migration_guard_0104'
      )
    `).all<{ name: string }>()).results;
    expect(retiredTables).toEqual([]);
    expect((await db.prepare('PRAGMA foreign_key_check').all()).results).toEqual([]);
  });

  it('removes the empty family-profile schema without leaving broken foreign keys', async () => {
    harness = createProductionKnowledgeHonoHarness();
    applyThrough(harness, '0104_remove_stack_categories.sql');
    const db = harness.db as TestDatabase;

    const migrationSql = readFileSync(migrationPath('0105_remove_family_profiles.sql'), 'utf8');
    harness.exec(migrationSql);

    const stackColumns = (await db.prepare('PRAGMA table_info(stacks)').all<{ name: string }>()).results.map((row) => row.name);
    expect(stackColumns).not.toContain('family_member_id');
    const retiredTables = (await db.prepare(`
      SELECT name FROM sqlite_master
      WHERE type = 'table' AND name IN ('family_profiles', 'family_profile_retirement_guard_0105')
    `).all<{ name: string }>()).results;
    expect(retiredTables).toEqual([]);
    expect((await db.prepare('PRAGMA foreign_key_check').all()).results).toEqual([]);
  });

  it('fails closed and preserves family data when a linked profile still exists', async () => {
    harness = createProductionKnowledgeHonoHarness();
    applyThrough(harness, '0104_remove_stack_categories.sql');
    const db = harness.db as TestDatabase;
    harness.run("INSERT INTO users (id, email, password_hash, role, email_verified_at) VALUES (9200, 'family-fixture@test.invalid', 'x', 'user', CURRENT_TIMESTAMP)");
    harness.run("INSERT INTO family_profiles (id, user_id, first_name, age, weight) VALUES (9200, 9200, 'Mia', 12, 42.5)");
    harness.run("INSERT INTO stacks (id, user_id, name, family_member_id) VALUES (9200, 9200, 'Familien-Stack', 9200)");

    const beforeProfile = await db.prepare(`
      SELECT id, user_id, first_name, age, weight, created_at, updated_at
      FROM family_profiles WHERE id = 9200
    `).first<Record<string, unknown>>();
    const beforeStack = await db.prepare(`
      SELECT id, user_id, name, family_member_id
      FROM stacks WHERE id = 9200
    `).first<Record<string, unknown>>();

    const migrationSql = readFileSync(migrationPath('0105_remove_family_profiles.sql'), 'utf8');
    expect(() => harness!.exec(migrationSql)).toThrow();

    const stackColumns = (await db.prepare('PRAGMA table_info(stacks)').all<{ name: string }>()).results.map((row) => row.name);
    expect(stackColumns).toContain('family_member_id');
    const profileTable = await db.prepare(`
      SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'family_profiles'
    `).first<{ name: string }>();
    expect(profileTable?.name).toBe('family_profiles');
    expect(await db.prepare(`
      SELECT id, user_id, first_name, age, weight, created_at, updated_at
      FROM family_profiles WHERE id = 9200
    `).first<Record<string, unknown>>()).toEqual(beforeProfile);
    expect(await db.prepare(`
      SELECT id, user_id, name, family_member_id
      FROM stacks WHERE id = 9200
    `).first<Record<string, unknown>>()).toEqual(beforeStack);
  });
});
