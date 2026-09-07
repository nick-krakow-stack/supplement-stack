const numberFormat = new Intl.NumberFormat('de-DE', { maximumFractionDigits: 6 });
const moneyFormat = new Intl.NumberFormat('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function pluralLabel(count: number, singular: string, plural: string): string {
  return count === 1 ? singular : plural;
}

export function countLabel(count: number, singular: string, plural: string): string {
  return `${numberFormat.format(count)} ${pluralLabel(count, singular, plural)}`;
}

export function formatMonthlyCost(value: number): string {
  return `${moneyFormat.format(value)} € pro Monat`;
}

export { formatIntakeTimingLabel as timingLabel } from '../../../functions/lib/intake-timing-labels.mjs';
