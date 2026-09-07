import { describe, expect, it } from 'vitest';
import { countLabel, formatMonthlyCost, pluralLabel, timingLabel } from './displayCopy';

describe('shared display copy', () => {
  it.each([[0, '0 Produkte'], [1, '1 Produkt'], [2, '2 Produkte']])('pluralizes the actual count %s', (count, expected) => {
    expect(countLabel(Number(count), 'Produkt', 'Produkte')).toBe(expected);
  });
  it('handles other nouns and monthly money centrally without changing the numeric value', () => {
    expect(countLabel(1, 'Eintrag', 'Einträge')).toBe('1 Eintrag');
    expect(countLabel(2, 'Eintrag', 'Einträge')).toBe('2 Einträge');
    expect(pluralLabel(1, 'Portion', 'Portionen')).toBe('Portion');
    expect(formatMonthlyCost(19.9)).toBe('19,90 € pro Monat');
    expect(formatMonthlyCost(0)).toBe('0,00 € pro Monat');
  });
  it.each([
    ['before_breakfast', null, 'Vor dem Frühstück'], ['with_breakfast', null, 'Zum Frühstück'],
    ['zum_frühstück', null, 'Zum Frühstück'], ['morning_evening', null, 'Morgens & Abends'],
    ['anytime', null, 'Zeit flexibel'], ['unknown_value', null, 'Keine Angabe'],
    [null, null, 'Keine Angabe'], ['morning', 'before_breakfast', 'Vor dem Frühstück'],
    ['morning', 'before_lunch', 'Keine Angabe'], ['morning', 'Unmittelbar nach dem Frühstück', 'Unmittelbar nach dem Frühstück'],
  ])('keeps a real timing label and hides unknown technical keys (%s / %s)', (value, managed, expected) => {
    expect(timingLabel(value, managed)).toBe(expected);
  });
});
