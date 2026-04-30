// ---------------------------------------------------------------------------
// Unit conversion helpers — pure logic, no D1/Hono dependencies.
// Cloudflare Worker compatible (Web Standard APIs only, no Node).
// ---------------------------------------------------------------------------

// EFSA / NIH ODS standard conversion factors
const IU_FACTORS: Record<string, { microgramsPerIU: number; namePatterns: ReadonlyArray<string> }> = {
  'vitamin-d': {
    // Vitamin D / D3 / D2: 1 IU = 0.025 µg cholecalciferol (1 µg = 40 IU)
    // Source: EFSA NDA Panel 2012; NIH ODS Vitamin D Fact Sheet
    microgramsPerIU: 0.025,
    namePatterns: ['vitamin d', 'vitamin d3', 'vitamin d2', 'cholecalciferol', 'ergocalciferol', 'calciferol'],
  },
  'vitamin-a': {
    // Vitamin A (Retinol / RAE): 1 IU = 0.3 µg retinol (1 µg RAE = 3.33 IU)
    // Source: NIH ODS Vitamin A Fact Sheet; EFSA NDA 2015
    microgramsPerIU: 0.3,
    namePatterns: ['vitamin a', 'retinol', 'retinyl', 'retinoic acid', 'beta-carotene', 'betacarotin'],
  },
  'vitamin-e': {
    // Vitamin E (DL-α-Tocopherol synthetic): 1 IU = ~0.671 mg; RRR-natural: 1 IU = ~0.671 mg
    // For mass conversion: 1 IU ≈ 0.671 mg (DL-α) or 0.671 mg (RRR); using 0.671 mg
    // Source: NIH ODS Vitamin E Fact Sheet (1 mg dl-α-tocopherol = 1.49 IU → 1 IU ≈ 0.671 mg)
    // Note: IU↔mg only (not IU↔µg directly — convert mg→µg separately if needed)
    microgramsPerIU: 671, // 0.671 mg × 1000 = 671 µg
    namePatterns: ['vitamin e', 'tocopherol', 'tocotrienol', 'alpha-tocopherol', 'd-alpha-tocopherol', 'dl-alpha-tocopherol'],
  },
}

export type CanonicalUnit = 'µg' | 'mg' | 'g' | 'IU'

/**
 * Normalizes a raw unit string to a canonical form.
 * Returns null if the unit is not recognized.
 */
export function normalizeUnit(raw: string): CanonicalUnit | null {
  const trimmed = raw.trim()
  // Normalize unicode: replace μ (U+03BC Greek mu) with µ (U+00B5 micro sign)
  const norm = trimmed.replace(/μ/g, 'µ').toLowerCase()

  if (norm === 'µg' || norm === 'mcg' || norm === 'ug') return 'µg'
  if (norm === 'mg') return 'mg'
  if (norm === 'g') return 'g'
  if (norm === 'iu') return 'IU'

  return null
}

/**
 * Resolves the IU factor entry for an ingredient by matching its name against
 * known patterns. Returns the entry or null if no match is found.
 */
function resolveIUFactor(
  hint: { slug?: string | null; name?: string | null }
): { microgramsPerIU: number } | null {
  const candidates: string[] = []
  if (hint.slug) candidates.push(hint.slug.toLowerCase())
  if (hint.name) candidates.push(hint.name.toLowerCase())

  for (const entry of Object.values(IU_FACTORS)) {
    for (const candidate of candidates) {
      for (const pattern of entry.namePatterns) {
        if (candidate.includes(pattern)) return entry
      }
    }
  }
  return null
}

/**
 * Mass-only conversion between µg, mg, and g.
 * Returns null if either unit is not a mass unit.
 */
function convertMass(amount: number, from: CanonicalUnit, to: CanonicalUnit): number | null {
  const massOrder: Record<string, number> = { 'µg': 0, 'mg': 1, 'g': 2 }
  const fromIndex = massOrder[from]
  const toIndex = massOrder[to]
  if (fromIndex === undefined || toIndex === undefined) return null

  const diff = fromIndex - toIndex
  if (diff === 0) return amount
  const factor = Math.pow(1000, Math.abs(diff))
  return diff > 0 ? amount / factor : amount * factor
}

/**
 * Attempts to convert an amount from one unit to another.
 *
 * For IU conversions, `ingredientHint` is required (slug or lowercased name).
 * Returns null when conversion is not possible.
 */
export function convertAmount(
  amount: number,
  fromUnit: string,
  toUnit: string,
  ingredientHint?: { slug?: string | null; name?: string | null }
): number | null {
  if (!Number.isFinite(amount)) return null

  const from = normalizeUnit(fromUnit)
  const to = normalizeUnit(toUnit)
  if (from === null || to === null) return null
  if (from === to) return amount

  // Pure mass conversion (µg ↔ mg ↔ g)
  if (from !== 'IU' && to !== 'IU') {
    return convertMass(amount, from, to)
  }

  // IU ↔ mass: requires ingredient-specific factor
  const hint = ingredientHint ?? {}
  const factorEntry = resolveIUFactor(hint)
  if (factorEntry === null) return null

  const { microgramsPerIU } = factorEntry

  if (from === 'IU' && to === 'µg') {
    return amount * microgramsPerIU
  }
  if (from === 'IU' && to === 'mg') {
    return (amount * microgramsPerIU) / 1000
  }
  if (from === 'IU' && to === 'g') {
    return (amount * microgramsPerIU) / 1_000_000
  }
  if (from === 'µg' && to === 'IU') {
    return amount / microgramsPerIU
  }
  if (from === 'mg' && to === 'IU') {
    return (amount * 1000) / microgramsPerIU
  }
  if (from === 'g' && to === 'IU') {
    return (amount * 1_000_000) / microgramsPerIU
  }

  return null
}
