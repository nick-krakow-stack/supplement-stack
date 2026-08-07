export function formatRecommendationNumber(value: number): string {
  return value.toLocaleString('de-DE', { maximumFractionDigits: 6 });
}

export function formatRecommendationDate(value: string): string | null {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return null;
  return new Intl.DateTimeFormat('de-DE', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(date);
}

const COUNTABLE_RECOMMENDATION_UNITS: Record<string, { singular: string; plural: string }> = {
  kapsel: { singular: 'Kapsel', plural: 'Kapseln' },
  kapseln: { singular: 'Kapsel', plural: 'Kapseln' },
  tablette: { singular: 'Tablette', plural: 'Tabletten' },
  tabletten: { singular: 'Tablette', plural: 'Tabletten' },
  portion: { singular: 'Portion', plural: 'Portionen' },
  portionen: { singular: 'Portion', plural: 'Portionen' },
};

export function formatRecommendationUnit(value: string | null, quantity?: number): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const countable = COUNTABLE_RECOMMENDATION_UNITS[trimmed.toLocaleLowerCase('de-DE')];
  if (!countable) return trimmed;
  if (quantity === undefined) return countable.singular;
  return quantity === 1 ? countable.singular : countable.plural;
}

export function formatRecommendationAmount(quantity: number, unit: string | null): string {
  const amount = formatRecommendationNumber(quantity);
  const formattedUnit = formatRecommendationUnit(unit, quantity);
  return formattedUnit ? `${amount} ${formattedUnit}` : `${amount} (Einheit nicht angegeben)`;
}

export function formatRecommendationInterval(days: number | null): string | null {
  if (!Number.isInteger(days) || Number(days) < 1) return null;
  if (days === 1) return 'täglich';
  if (days === 2) return 'alle zwei Tage';
  return `alle ${days} Tage`;
}
