// @vitest-environment node

import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';

type SqlBinding = string | number | null;

type SqliteStatement = {
  all: (...bindings: SqlBinding[]) => unknown[];
  get: (...bindings: SqlBinding[]) => unknown;
  run: (...bindings: SqlBinding[]) => unknown;
};

type SqliteDatabase = {
  close: () => void;
  exec: (sql: string) => void;
  prepare: (sql: string) => SqliteStatement;
};

const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite') as {
  DatabaseSync: new (location: string) => SqliteDatabase;
};

const migration0100 = readFileSync(
  new URL('../../../d1-migrations/0100_complete_ingredient_effect_summaries.sql', import.meta.url),
  'utf8',
);
const migration0108 = readFileSync(
  new URL('../../../d1-migrations/0108_knowledge_overview_central_copy_projection.sql', import.meta.url),
  'utf8',
);
const migration0109 = readFileSync(
  new URL('../../../d1-migrations/0109_simplify_ingredient_effect_summaries.sql', import.meta.url),
  'utf8',
);

type ExpectedSummary = {
  name: string;
  isActive: number;
  oldSummary: string;
  newSummary: string | null;
};

type SeededDatabaseOptions = {
  omitNames?: readonly string[];
  oldSummaryOverrides?: Readonly<Record<string, string>>;
  translationSummaryOverrides?: Readonly<Record<string, string>>;
  isActiveOverrides?: Readonly<Record<string, number>>;
  extraRows?: readonly ExpectedSummary[];
};

type CentralSummaryRow = {
  name: string;
  isActive: number;
  baseSummary: string | null;
  translatedSummary: string | null;
  profileVersion: number;
};

const productionMissingNames = ['Vitamin D3', 'Vitamin K2', 'Vitamin K1'] as const;
const productionVitaminDOldSummary = 'Immunsystem, Knochen, Hormone';

function unescapeSqlText(value: string): string {
  return value.replaceAll("''", "'");
}

function parse0100Summaries(): Map<string, string> {
  const valuesBlock = migration0100.match(
    /INSERT INTO _0100_expected_ingredient_effects \(ingredient_name, effect_summary\)\s+VALUES([\s\S]*?);\s+\n\s*CREATE TABLE _0100_ingredient_effect_guard/,
  )?.[1] ?? '';
  return new Map([...valuesBlock.matchAll(/\('((?:[^']|'')+)', '((?:[^']|'')+)'\)/g)].map((match) => [
    unescapeSqlText(match[1]),
    unescapeSqlText(match[2]),
  ]));
}

function parse0109Summaries(): ExpectedSummary[] {
  const valuesBlock = migration0109.match(
    /INSERT INTO _0109_expected_effect_summaries[\s\S]*?\)\s+VALUES([\s\S]*?);\s+\n\s*CREATE TABLE _0109_effect_summary_guard/,
  )?.[1] ?? '';
  return [...valuesBlock.matchAll(
    /\('((?:[^']|'')+)', ([01]), '((?:[^']|'')+)', (?:NULL|'((?:[^']|'')+)')\)/g,
  )].map((match) => ({
    name: unescapeSqlText(match[1]),
    isActive: Number(match[2]),
    oldSummary: unescapeSqlText(match[3]),
    newSummary: match[4] === undefined ? null : unescapeSqlText(match[4]),
  }));
}

function createSeededDatabase(
  rows: ExpectedSummary[],
  options: SeededDatabaseOptions = {},
): SqliteDatabase {
  const database = new DatabaseSync(':memory:');
  database.exec(`
    PRAGMA foreign_keys = ON;
    CREATE TABLE ingredients (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL,
      is_active INTEGER NOT NULL
    );
    CREATE TABLE ingredient_synonyms (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ingredient_id INTEGER NOT NULL,
      synonym TEXT NOT NULL
    );
    CREATE TABLE ingredient_display_profiles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ingredient_id INTEGER NOT NULL,
      form_id INTEGER,
      part_id INTEGER,
      sub_ingredient_id INTEGER,
      effect_summary TEXT,
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      version INTEGER NOT NULL DEFAULT 1
    );
    CREATE TABLE display_profile_translations (
      display_profile_id INTEGER NOT NULL,
      language TEXT NOT NULL,
      effect_summary TEXT,
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      PRIMARY KEY (display_profile_id, language)
    );
    CREATE TABLE knowledge_overview_projection_meta (
      id INTEGER PRIMARY KEY,
      source_version INTEGER NOT NULL,
      updated_at TEXT NOT NULL
    );
    INSERT INTO knowledge_overview_projection_meta (id, source_version, updated_at)
    VALUES (1, 7, datetime('now'));
  `);

  const insertIngredient = database.prepare('INSERT INTO ingredients (name, is_active) VALUES (?, ?)');
  const insertProfile = database.prepare(`
    INSERT INTO ingredient_display_profiles (ingredient_id, effect_summary)
    SELECT id, ? FROM ingredients WHERE name = ?
  `);
  const insertTranslation = database.prepare(`
    INSERT INTO display_profile_translations (display_profile_id, language, effect_summary)
    SELECT profile.id, 'de', ?
    FROM ingredient_display_profiles profile
    JOIN ingredients ingredient ON ingredient.id = profile.ingredient_id
    WHERE ingredient.name = ?
  `);

  const omittedNames = new Set(options.omitNames ?? []);
  const seededRows = [
    ...rows.filter((row) => !omittedNames.has(row.name)),
    ...(options.extraRows ?? []),
  ];

  seededRows.forEach((row) => {
    const oldSummary = options.oldSummaryOverrides?.[row.name] ?? row.oldSummary;
    insertIngredient.run(row.name, options.isActiveOverrides?.[row.name] ?? row.isActive);
    insertProfile.run(oldSummary, row.name);
    insertTranslation.run(
      options.translationSummaryOverrides?.[row.name] ?? oldSummary,
      row.name,
    );
  });

  database.exec(migration0108);
  return database;
}

function readCentralSummaries(database: SqliteDatabase): CentralSummaryRow[] {
  return database.prepare(`
    SELECT
      ingredient.name,
      ingredient.is_active AS isActive,
      profile.effect_summary AS baseSummary,
      translation.effect_summary AS translatedSummary,
      profile.version AS profileVersion
    FROM ingredients ingredient
    JOIN ingredient_display_profiles profile ON profile.ingredient_id = ingredient.id
    JOIN display_profile_translations translation
      ON translation.display_profile_id = profile.id
     AND translation.language = 'de'
    WHERE profile.form_id IS NULL
      AND profile.part_id IS NULL
      AND profile.sub_ingredient_id IS NULL
    ORDER BY ingredient.name
  `).all() as CentralSummaryRow[];
}

function readSourceVersion(database: SqliteDatabase): { source_version: number } {
  return database.prepare(
    'SELECT source_version FROM knowledge_overview_projection_meta WHERE id = 1',
  ).get() as { source_version: number };
}

describe('0109 central ingredient short-copy repair', () => {
  it('updates all 97 guarded base profiles and de translations with 13 deliberate null fallbacks', () => {
    const oldSummaries = parse0100Summaries();
    const rows = parse0109Summaries();

    expect(rows).toHaveLength(97);
    expect(rows.filter((row) => row.isActive === 1)).toHaveLength(92);
    expect(rows.filter((row) => row.newSummary === null).map((row) => row.name).sort()).toEqual([
      'Birkenporling',
      'Boswellia (Weihrauch)',
      'Brennnessel',
      'Grüner Tee (EGCG)',
      'Mariendistel (Silymarin)',
      'Mönchspfeffer',
      'Pfefferminz',
      'Probiotika',
      'Saccharomyces boulardii',
      'Shiitake',
      'Spirulina',
      'Sägepalme',
      'Zunderschwamm',
    ].sort());
    const publishedSummaries = rows.flatMap((row) => row.newSummary ?? []);
    expect(publishedSummaries).toHaveLength(84);
    expect(publishedSummaries.every((summary) => summary.length <= 160)).toBe(true);
    expect(publishedSummaries.join('\n')).not.toMatch(/[,;]/);
    expect(new Set(rows.map((row) => row.name))).toHaveLength(97);
    rows.forEach((row) => expect(row.oldSummary).toBe(
      row.name === 'Vitamin D3'
        ? 'Immunsystem, Knochen, Hormone'
        : oldSummaries.get(row.name),
    ));

    const database = createSeededDatabase(rows);
    const sourceVersionBefore = database.prepare(
      'SELECT source_version FROM knowledge_overview_projection_meta WHERE id = 1',
    ).get() as { source_version: number };

    database.exec(migration0109);

    const repaired = database.prepare(`
      SELECT
        ingredient.name,
        ingredient.is_active AS isActive,
        profile.effect_summary AS baseSummary,
        translation.effect_summary AS translatedSummary
      FROM ingredients ingredient
      JOIN ingredient_display_profiles profile ON profile.ingredient_id = ingredient.id
      JOIN display_profile_translations translation
        ON translation.display_profile_id = profile.id
       AND translation.language = 'de'
      WHERE profile.form_id IS NULL
        AND profile.part_id IS NULL
        AND profile.sub_ingredient_id IS NULL
      ORDER BY ingredient.name
    `).all() as Array<{
      name: string;
      isActive: number;
      baseSummary: string | null;
      translatedSummary: string | null;
    }>;
    const repairedByName = new Map(repaired.map((row) => [row.name, row]));

    expect(repaired).toHaveLength(97);
    rows.forEach((expected) => {
      expect(repairedByName.get(expected.name)).toMatchObject({
        isActive: expected.isActive,
        baseSummary: expected.newSummary,
        translatedSummary: expected.newSummary,
      });
    });
    expect(repairedByName.get('Vitamin K2')?.baseSummary).toBe(
      'Vitamin K2 ist eine Form von Vitamin K und steht mit bestimmten körpereigenen Proteinen in Zusammenhang.',
    );
    expect(repairedByName.get('Ginseng')?.baseSummary).toBe(
      'Quellen beschreiben Ginseng im Zusammenhang mit Energie und Stress.',
    );
    expect(repairedByName.get('Grapefruitkernextrakt')?.baseSummary).toBe(
      'Grapefruitkernextrakt wird traditionell verwendet. Seine Wirksamkeit ist wissenschaftlich umstritten.',
    );
    expect(repairedByName.get('L-Arginin')?.baseSummary).toBe(
      'L-Arginin ist eine Aminosäure und Vorstufe von Stickstoffmonoxid.',
    );
    expect(rows.flatMap((row) => row.newSummary ?? []).join('\n')).not.toMatch(
      /Gla-Proteine|Stressresistenz|Gefäßkontext|Fokuslage|Immunfokuslage|Rhythmusrhythmus/,
    );

    const sourceVersionAfter = database.prepare(
      'SELECT source_version FROM knowledge_overview_projection_meta WHERE id = 1',
    ).get() as { source_version: number };
    expect(sourceVersionAfter.source_version - sourceVersionBefore.source_version).toBe(194);
    database.close();
  });

  it('updates the exact 94-row production inventory with its historical Vitamin-D old value', () => {
    const rows = parse0109Summaries();
    const productionRows = rows.filter((row) => !productionMissingNames.includes(
      row.name as (typeof productionMissingNames)[number],
    ));
    const database = createSeededDatabase(rows, {
      omitNames: productionMissingNames,
      oldSummaryOverrides: { 'Vitamin D': productionVitaminDOldSummary },
    });
    const sourceVersionBefore = readSourceVersion(database);

    database.exec(migration0109);

    const repaired = readCentralSummaries(database);
    const repairedByName = new Map(repaired.map((row) => [row.name, row]));
    expect(repaired).toHaveLength(94);
    expect(repaired.every((row) => row.profileVersion === 2)).toBe(true);
    productionRows.forEach((expected) => {
      expect(repairedByName.get(expected.name)).toMatchObject({
        isActive: expected.isActive,
        baseSummary: expected.newSummary,
        translatedSummary: expected.newSummary,
      });
    });
    productionMissingNames.forEach((name) => expect(repairedByName.has(name)).toBe(false));
    expect(readSourceVersion(database).source_version - sourceVersionBefore.source_version).toBe(188);
    database.close();
  });

  it.each([
    {
      label: 'a hybrid legacy inventory',
      options: { omitNames: ['Vitamin D3'] },
    },
    {
      label: 'an unexpected inactive ingredient',
      options: {
        extraRows: [{
          name: 'Unerwarteter Wirkstoff',
          isActive: 0,
          oldSummary: 'Unerwarteter Alttext',
          newSummary: null,
        }],
      },
    },
    {
      label: 'a wrong active status',
      options: { isActiveOverrides: { Ginseng: 0 } },
    },
    {
      label: 'the canonical Vitamin-D old value in the production inventory',
      options: { omitNames: productionMissingNames },
    },
  ] satisfies Array<{ label: string; options: SeededDatabaseOptions }>) (
    'fails closed before central writes for $label',
    ({ options }) => {
      const rows = parse0109Summaries();
      const database = createSeededDatabase(rows, options);
      const centralBefore = readCentralSummaries(database);
      const sourceVersionBefore = readSourceVersion(database);

      expect(() => database.exec(migration0109)).toThrow(/0109: Unerwarteter Wirkstoff- oder Kurztextbestand/);

      expect(readCentralSummaries(database)).toEqual(centralBefore);
      expect(readSourceVersion(database)).toEqual(sourceVersionBefore);
      database.close();
    },
  );

  it('fails closed before either central table changes when one old de value differs', () => {
    const rows = parse0109Summaries();
    const database = createSeededDatabase(rows, {
      translationSummaryOverrides: {
        Ginseng: 'Energie, Stressresistenz, Immunsystem (abweichend)',
      },
    });
    const sourceVersionBefore = database.prepare(
      'SELECT source_version FROM knowledge_overview_projection_meta WHERE id = 1',
    ).get() as { source_version: number };

    expect(() => database.exec(migration0109)).toThrow(/0109: Unerwarteter Wirkstoff- oder Kurztextbestand/);

    const ginseng = database.prepare(`
      SELECT profile.effect_summary AS baseSummary, translation.effect_summary AS translatedSummary
      FROM ingredients ingredient
      JOIN ingredient_display_profiles profile ON profile.ingredient_id = ingredient.id
      JOIN display_profile_translations translation
        ON translation.display_profile_id = profile.id
       AND translation.language = 'de'
      WHERE ingredient.name = 'Ginseng'
    `).get() as { baseSummary: string; translatedSummary: string };
    expect(ginseng.baseSummary).toBe('Energie, Stressresistenz, Immunsystem');
    expect(ginseng.translatedSummary).toBe('Energie, Stressresistenz, Immunsystem (abweichend)');
    expect(database.prepare(
      'SELECT source_version FROM knowledge_overview_projection_meta WHERE id = 1',
    ).get()).toEqual(sourceVersionBefore);
    database.close();
  });
});
