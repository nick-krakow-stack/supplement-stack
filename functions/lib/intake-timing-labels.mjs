/** Display fallback only. Managed database labels remain the primary source. */
export const INTAKE_TIMING_LABELS = Object.freeze({
  anytime: 'Zeit flexibel', flexible: 'Zeit flexibel', jederzeit: 'Zeit flexibel',
  before_breakfast: 'Vor dem Frühstück', after_breakfast: 'Nach dem Frühstück',
  with_meal: 'Zum Essen', with_breakfast: 'Zum Frühstück', morning: 'Morgens', noon: 'Mittags', evening: 'Abends',
  morning_evening: 'Morgens & Abends', zum_essen: 'Zum Essen',
  zum_fruehstueck: 'Zum Frühstück', zum_frühstück: 'Zum Frühstück',
  zum_abendessen: 'Abends', trial: 'Zum Probieren',
});

export function formatIntakeTimingLabel(value, managedLabel) {
  const key = (text) => text.trim().toLowerCase().replace(/[\s-]+/g, '_');
  const managed = typeof managedLabel === 'string' ? managedLabel.trim() : '';
  if (managed) {
    const known = INTAKE_TIMING_LABELS[key(managed)];
    if (known) return known;
    if (/^[A-Z0-9_-]+$/.test(managed) || /^[a-z0-9]+(?:[_-][a-z0-9]+)+$/.test(managed)) return 'Keine Angabe';
    return managed;
  }
  return INTAKE_TIMING_LABELS[key(typeof value === 'string' ? value : '')] ?? 'Keine Angabe';
}
