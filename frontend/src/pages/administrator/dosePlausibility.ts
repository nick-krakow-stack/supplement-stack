export type DosePlausibilityInput = {
  ingredientName: string;
  doseMin?: number | null;
  doseMax?: number | null;
  unit?: string | null;
  perKgBodyWeight?: number | null;
};

export type DosePlausibilityWarning = {
  code: string;
  label: string;
  detail: string;
};

type Threshold = {
  aliases: string[];
  unit: 'mcg' | 'mg' | 'g' | 'iu';
  reviewAbove: number;
  reviewBelow?: number;
  note: string;
  conversions?: Record<string, number>;
};

const THRESHOLDS: Threshold[] = [
  {
    aliases: ['vitamin d', 'vitamin d3', 'cholecalciferol', 'colecalciferol'],
    unit: 'mcg',
    reviewAbove: 100,
    reviewBelow: 2.5,
    note: 'Vitamin D ist in der Prüfliste nur grob hinterlegt. Werte über 100 mcg bzw. 4.000 IE für Erwachsene bitte fachlich prüfen.',
    conversions: { ie: 1 / 40, iu: 1 / 40 },
  },
  {
    aliases: ['magnesium'],
    unit: 'mg',
    reviewAbove: 375,
    reviewBelow: 50,
    note: 'Magnesium-Dosen deutlich über typischen Supplement-Bereichen bitte gegen Form, Quelle und Zielkontext prüfen.',
  },
  {
    aliases: ['zink', 'zinc'],
    unit: 'mg',
    reviewAbove: 25,
    reviewBelow: 1,
    note: 'Zink-Dosen oberhalb der Pr\u00fcfschwelle können zusätzlichen Quellenkontext brauchen.',
  },
  {
    aliases: ['selen', 'selenium'],
    unit: 'mcg',
    reviewAbove: 300,
    reviewBelow: 10,
    note: 'Selen ist in kleinen Mengen relevant; hohe Werte bitte vor Veröffentlichung prüfen.',
  },
  {
    aliases: ['eisen', 'iron'],
    unit: 'mg',
    reviewAbove: 20,
    note: 'Eisen-Dosen sollten besonders nach Zielgruppe, Status und Quelle gepr\u00fcft werden.',
  },
  {
    aliases: ['jod', 'iodine', 'iodid', 'iodide'],
    unit: 'mcg',
    reviewAbove: 500,
    reviewBelow: 20,
    note: 'Jod-Werte außerhalb typischer Prüfbereiche bitte gegen Zielgruppe und Quelle prüfen.',
  },
  {
    aliases: ['vitamin a', 'retinol'],
    unit: 'mcg',
    reviewAbove: 1500,
    note: 'Vitamin-A-Dosen brauchen klare Form- und Quellenprüfung, besonders bei Retinol.',
    conversions: { ie: 0.3, iu: 0.3 },
  },
  {
    aliases: ['vitamin b6', 'pyridoxin', 'pyridoxine', 'pyridoxal'],
    unit: 'mg',
    reviewAbove: 10,
    note: 'Vitamin B6 ist fachlich sensibel; hohe Werte bitte redaktionell prüfen.',
  },
  {
    aliases: ['folsaeure', 'folsaure', 'folic acid', 'folate', 'folat'],
    unit: 'mcg',
    reviewAbove: 1000,
    note: 'Folat-/Folsäure-Werte oberhalb der Prüfschwelle bitte gegen Form und Quelle prüfen.',
  },
  {
    aliases: ['niacin', 'vitamin b3'],
    unit: 'mg',
    reviewAbove: 35,
    note: 'Niacin-Werte bitte nach Form und Quelle prüfen.',
  },
  {
    aliases: ['calcium', 'kalzium'],
    unit: 'mg',
    reviewAbove: 1200,
    reviewBelow: 50,
    note: 'Calcium-Dosen außerhalb typischer Supplement-Bereiche bitte gegen Zielkontext prüfen.',
  },
  {
    aliases: ['kalium', 'potassium'],
    unit: 'mg',
    reviewAbove: 1000,
    note: 'Kalium-Dosen in Supplements bitte besonders sorgfältig prüfen.',
  },
  {
    aliases: ['omega 3', 'omega-3', 'epa', 'dha', 'fischoel'],
    unit: 'mg',
    reviewAbove: 3000,
    reviewBelow: 100,
    note: 'Omega-3/EPA/DHA-Werte bitte gegen Bezugsbasis und Quelle prüfen.',
  },
  {
    aliases: ['creatin', 'creatine', 'kreatin'],
    unit: 'g',
    reviewAbove: 10,
    reviewBelow: 1,
    note: 'Kreatin-Dosen außerhalb üblicher Prüfbereiche bitte gegen Zweck und Quelle prüfen.',
    conversions: { mg: 0.001 },
  },
];

function normalizeText(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\w\s-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeUnit(value?: string | null): string {
  const rawUnit = (value ?? '').trim().toLowerCase();
  if (rawUnit === '\u00b5g') return 'mcg';
  const unit = normalizeText(rawUnit).replace(/\s/g, '');
  if (unit === 'ug' || unit === 'mcg' || unit === 'microgramm' || unit === 'mikrogramm') return 'mcg';
  if (unit === 'ie' || unit === 'iu') return unit;
  if (unit === 'milligramm') return 'mg';
  if (unit === 'gramm') return 'g';
  return unit;
}

function findThreshold(ingredientName: string): Threshold | null {
  const normalizedName = normalizeText(ingredientName);
  return THRESHOLDS.find((entry) =>
    entry.aliases.some((alias) => normalizedName.includes(normalizeText(alias))),
  ) ?? null;
}

function convertDose(value: number, fromUnit: string, threshold: Threshold): number | null {
  if (fromUnit === threshold.unit) return value;
  if (fromUnit === 'g' && threshold.unit === 'mg') return value * 1000;
  if (fromUnit === 'mg' && threshold.unit === 'mcg') return value * 1000;
  if (fromUnit === 'mcg' && threshold.unit === 'mg') return value / 1000;
  if (threshold.conversions?.[fromUnit] != null) return value * threshold.conversions[fromUnit];
  return null;
}

function formatThreshold(value: number, unit: string): string {
  return `${value.toLocaleString('de-DE', { maximumFractionDigits: 2 })} ${unit}`;
}

export function getDosePlausibilityWarnings(input: DosePlausibilityInput): DosePlausibilityWarning[] {
  const warnings: DosePlausibilityWarning[] = [];
  const doseMin = input.doseMin ?? null;
  const doseMax = input.doseMax ?? null;

  if (doseMin != null && doseMax != null && doseMin > doseMax) {
    warnings.push({
      code: 'min_gt_max',
      label: 'Min/Max prüfen',
      detail: 'Die Mindestdosis liegt über der Höchstdosis. Speichern bleibt möglich, aber der Datensatz sollte vor Freigabe geprüft werden.',
    });
  }

  if (input.perKgBodyWeight != null && input.perKgBodyWeight > 0) {
    warnings.push({
      code: 'per_kg',
      label: 'Per-kg-Dosis',
      detail: 'Per-kg-Dosis erkannt. Bitte prüfen, ob Cap, Population und sichtbare Hinweise zum Kontext passen.',
    });
  }

  const threshold = findThreshold(input.ingredientName);
  if (!threshold) return warnings;

  const unit = normalizeUnit(input.unit);
  if (!unit) return warnings;

  const comparisonDose = doseMax ?? doseMin;
  if (comparisonDose == null) return warnings;

  const normalizedDose = convertDose(comparisonDose, unit, threshold);
  if (normalizedDose == null) {
    warnings.push({
      code: 'unit_unknown',
      label: 'Einheit prüfen',
      detail: `Die Prüflogik kennt ${input.ingredientName} in ${threshold.unit}, der Datensatz nutzt ${input.unit}. Bitte Einheit und Umrechnung manuell prüfen.`,
    });
    return warnings;
  }

  if (normalizedDose > threshold.reviewAbove) {
    warnings.push({
      code: 'above_review',
      label: 'Hoher Prüfwert',
      detail: `${formatThreshold(normalizedDose, threshold.unit)} liegt über der lokalen Prüfschwelle ${formatThreshold(threshold.reviewAbove, threshold.unit)}. ${threshold.note}`,
    });
  }

  if (threshold.reviewBelow != null && normalizedDose > 0 && normalizedDose < threshold.reviewBelow) {
    warnings.push({
      code: 'below_review',
      label: 'Niedriger Prüfwert',
      detail: `${formatThreshold(normalizedDose, threshold.unit)} liegt unter der lokalen Prüfschwelle ${formatThreshold(threshold.reviewBelow, threshold.unit)}. Bitte prüfen, ob Bezugsbasis, Einheit oder Population korrekt sind.`,
    });
  }

  return warnings;
}
