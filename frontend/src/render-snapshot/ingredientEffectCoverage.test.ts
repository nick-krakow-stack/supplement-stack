// @vitest-environment node

import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const migrationSql = readFileSync(
  new URL('../../../d1-migrations/0100_complete_ingredient_effect_summaries.sql', import.meta.url),
  'utf8',
);

function expectedEffectRows(): Map<string, string> {
  const valuesBlock = migrationSql.match(
    /INSERT INTO _0100_expected_ingredient_effects \(ingredient_name, effect_summary\)\s+VALUES([\s\S]*?);\s+\n\s*CREATE TABLE _0100_ingredient_effect_guard/,
  )?.[1] ?? '';
  const rows = new Map<string, string>();
  for (const match of valuesBlock.matchAll(/\('((?:[^']|'')+)', '((?:[^']|'')+)'\)/g)) {
    rows.set(match[1].replaceAll("''", "'"), match[2].replaceAll("''", "'"));
  }
  return rows;
}

describe('ingredient effect migration coverage', () => {
  it('covers the complete canonical and retained legacy ingredient set once', () => {
    const rows = expectedEffectRows();

    expect(rows.size).toBe(97);
    expect(rows.get('Vitamin K2')).toBe('Knochen, Gefäße, Gla-Proteine');
    expect(rows.get('Vitamin B12')).toBe('Blutbildung, Nervensystem, Energiestoffwechsel');
    expect(rows.get('Magnesium')).toBe('Muskel- & Nervenfunktion, Entspannung');
    expect(rows.get('Boswellia (Weihrauch)')).toBe('Traditionelle Anwendung, Pflanzenextrakt');
    expect(rows.get('Saccharomyces boulardii')).toBe('Probiotischer Hefestamm, Darmbereich');
  });

  it('keeps exact catalog and readback guards in the migration', () => {
    expect(migrationSql).toContain('(SELECT COUNT(*) FROM ingredients WHERE is_active = 1) <> 92');
    expect(migrationSql).toContain('FROM product_ingredients product_ingredient');
    expect(migrationSql).toContain('FROM user_product_ingredients product_ingredient');
    expect(migrationSql).toContain('WITH target_ingredients AS');
    expect(migrationSql).toContain('trim(COALESCE(ingredient_display_profiles.effect_summary, \'\')) = \'\'');
    expect(migrationSql).toContain("trim(COALESCE(translation.effect_summary, '')) = ''");
  });
});
