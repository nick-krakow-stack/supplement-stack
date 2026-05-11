export interface CalculableIngredient {
  ingredient_id?: number
  quantity?: number | null
  unit?: string | null
  basis_quantity?: number | null
  basis_unit?: string | null
  search_relevant?: number | boolean | null
}

export interface CalculableProduct {
  price?: number | null
  quantity?: number | null
  unit?: string | null
  basis_quantity?: number | null
  basis_unit?: string | null
  serving_size?: number | null
  serving_unit?: string | null
  servings_per_container?: number | null
  container_count?: number | null
  dosage_text?: string | null
  intake_interval_days?: number | null
  ingredients?: CalculableIngredient[]
}

export interface ParsedDose {
  value: number
  unit: string
}

export interface ProductUsage {
  servingsPerIntake: number
  effectiveDailyUsage: number
  daysSupply: number | null
  monthlyCost: number | null
  intakeAmountPerDay: number
  intakeUnit: string
  calculationSource: 'target_dose' | 'manual_quantity' | 'default'
  matchedIngredient?: CalculableIngredient
}

type UnitKind = 'mass' | 'volume' | 'iu' | 'count' | 'other'

interface NormalizedUnit {
  key: string
  kind: UnitKind
}

function positiveNumber(value: number | null | undefined): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : null
}

export function intakeIntervalDays(product: CalculableProduct): number {
  const interval = product.intake_interval_days ?? 1
  return Number.isInteger(interval) && interval >= 1 ? interval : 1
}

export function productTotalServings(product: CalculableProduct, fallback = 0): number {
  const total = (product.servings_per_container ?? 0) * (product.container_count ?? 1)
  return total > 0 ? total : fallback
}

export function productTotalIntakeUnits(product: CalculableProduct, fallback = 0): number {
  const totalServings = productTotalServings(product, 0)
  const servingSize = positiveNumber(product.serving_size) ?? 1
  return totalServings > 0 ? totalServings * servingSize : fallback
}

export function normalizeCalculationUnit(unit?: string | null): NormalizedUnit {
  const normalized = (unit ?? '')
    .trim()
    .toLowerCase()
    .replace(/\u03bc/g, '\u00b5')
    .replace(/\./g, '')

  if (['iu', 'ie'].includes(normalized)) return { key: 'iu', kind: 'iu' }
  if (['\u00b5g', 'ug', 'mcg'].includes(normalized)) return { key: 'ug', kind: 'mass' }
  if (normalized === 'mg') return { key: 'mg', kind: 'mass' }
  if (normalized === 'g') return { key: 'g', kind: 'mass' }
  if (['ml', 'milliliter'].includes(normalized)) return { key: 'ml', kind: 'volume' }
  if (['kapsel', 'kapseln', 'capsule', 'capsules'].includes(normalized)) return { key: 'kapsel', kind: 'count' }
  if (['tablette', 'tabletten', 'tablet', 'tablets'].includes(normalized)) return { key: 'tablette', kind: 'count' }
  if (['tropfen', 'drop', 'drops'].includes(normalized)) return { key: 'tropfen', kind: 'count' }
  if (['softgel', 'softgels'].includes(normalized)) return { key: 'softgel', kind: 'count' }
  if (['portion', 'portionen', 'serving', 'servings'].includes(normalized)) return { key: 'portion', kind: 'count' }
  return { key: normalized, kind: normalized ? 'other' : 'other' }
}

function unitsAreCompatible(fromUnit?: string | null, toUnit?: string | null): boolean {
  const from = normalizeCalculationUnit(fromUnit)
  const to = normalizeCalculationUnit(toUnit)
  if (!from.key || !to.key) return false
  if (from.kind === 'mass' && to.kind === 'mass') return true
  return from.kind === to.kind && from.key === to.key
}

function massToMicrograms(value: number, unit: string): number | null {
  const normalized = normalizeCalculationUnit(unit)
  if (normalized.kind !== 'mass') return null
  if (normalized.key === 'ug') return value
  if (normalized.key === 'mg') return value * 1000
  if (normalized.key === 'g') return value * 1_000_000
  return null
}

function convertCompatibleAmount(value: number, fromUnit?: string | null, toUnit?: string | null): number | null {
  if (!unitsAreCompatible(fromUnit, toUnit)) return null
  const from = normalizeCalculationUnit(fromUnit)
  const to = normalizeCalculationUnit(toUnit)
  if (from.kind !== 'mass') return value

  const micrograms = massToMicrograms(value, fromUnit ?? '')
  if (micrograms == null) return null
  if (to.key === 'ug') return micrograms
  if (to.key === 'mg') return micrograms / 1000
  if (to.key === 'g') return micrograms / 1_000_000
  return null
}

function parseGermanNumber(value: string): number | null {
  const trimmed = value.trim()
  const normalized = trimmed.includes(',')
    ? trimmed.replace(/\./g, '').replace(',', '.')
    : /^\d{1,3}(?:\.\d{3})+$/.test(trimmed)
      ? trimmed.replace(/\./g, '')
      : trimmed
  const parsed = Number(normalized)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null
}

export function parseDoseFromText(text?: string | null): ParsedDose | null {
  if (!text) return null
  const match = /(\d+(?:[.,]\d{1,3})?(?:\.\d{3})*)\s*(IE|IU|\u00b5g|\u03bcg|ug|mcg|mg|g|ml|Milliliter|Kapseln?|Tabletten?|Tropfen|Softgels?|Portionen?)/i.exec(text)
  if (!match) return null
  const value = parseGermanNumber(match[1])
  return value ? { value, unit: match[2] } : null
}

function ingredientIsSearchRelevant(ingredient: CalculableIngredient): boolean {
  return ingredient.search_relevant === undefined || ingredient.search_relevant === null || ingredient.search_relevant === true || ingredient.search_relevant === 1
}

function ingredientCandidates(product: CalculableProduct): CalculableIngredient[] {
  const candidates = [...(product.ingredients ?? [])]
  if (positiveNumber(product.quantity) != null && product.unit) {
    candidates.push({
      quantity: product.quantity,
      unit: product.unit,
      basis_quantity: product.basis_quantity,
      basis_unit: product.basis_unit,
      search_relevant: true,
    })
  }
  return candidates
}

export function ingredientAmountPerProductServing(
  ingredient: CalculableIngredient,
  product: Pick<CalculableProduct, 'serving_size' | 'serving_unit'>,
): number | null {
  const quantity = positiveNumber(ingredient.quantity)
  if (quantity == null) return null

  const basisQuantity = positiveNumber(ingredient.basis_quantity)
  if (basisQuantity != null) return quantity / basisQuantity

  const servingSize = positiveNumber(product.serving_size)
  if (servingSize != null && servingSize > 1 && product.serving_unit) return quantity / servingSize

  return quantity
}

function bestDoseIngredient(product: CalculableProduct, dose: ParsedDose): { ingredient: CalculableIngredient; amountInDoseUnit: number } | null {
  const compatible = ingredientCandidates(product)
    .map((ingredient, index) => {
      const amount = ingredientAmountPerProductServing(ingredient, product)
      const amountInDoseUnit = amount == null ? null : convertCompatibleAmount(amount, ingredient.unit, dose.unit)
      return { ingredient, amountInDoseUnit, index }
    })
    .filter((candidate): candidate is { ingredient: CalculableIngredient; amountInDoseUnit: number; index: number } => (
      candidate.amountInDoseUnit != null && candidate.amountInDoseUnit > 0
    ))

  compatible.sort((a, b) => {
    const relevantDelta = Number(ingredientIsSearchRelevant(b.ingredient)) - Number(ingredientIsSearchRelevant(a.ingredient))
    if (relevantDelta !== 0) return relevantDelta
    return a.index - b.index
  })

  return compatible[0] ?? null
}

export function calculateProductUsage(
  product: CalculableProduct,
  price?: number | null,
  options: { fallbackTotalServings?: number } = {},
): ProductUsage {
  const parsedDose = parseDoseFromText(product.dosage_text)
  let servingsPerIntake: number | null = null
  let matchedIngredient: CalculableIngredient | undefined
  let calculationSource: ProductUsage['calculationSource'] = 'default'

  if (parsedDose) {
    const match = bestDoseIngredient(product, parsedDose)
    if (match) {
      servingsPerIntake = Math.max(1, Math.ceil(parsedDose.value / match.amountInDoseUnit))
      matchedIngredient = match.ingredient
      calculationSource = 'target_dose'
    } else if (
      positiveNumber(product.serving_size) != null &&
      convertCompatibleAmount(product.serving_size ?? 0, product.serving_unit, parsedDose.unit) != null
    ) {
      const servingSizeInDoseUnit = convertCompatibleAmount(product.serving_size ?? 0, product.serving_unit, parsedDose.unit) ?? 0
      servingsPerIntake = Math.max(1, Math.ceil(parsedDose.value / servingSizeInDoseUnit))
      calculationSource = 'target_dose'
    }
  }

  if (servingsPerIntake == null) {
    const manualQuantity = positiveNumber(product.quantity)
    if (manualQuantity != null && manualQuantity <= 100) {
      servingsPerIntake = manualQuantity
      calculationSource = 'manual_quantity'
    } else {
      servingsPerIntake = 1
    }
  }

  const interval = intakeIntervalDays(product)
  const effectiveDailyUsage = servingsPerIntake / interval
  const totalIntakeUnits = productTotalIntakeUnits(product, options.fallbackTotalServings ?? 0)
  const daysSupply = totalIntakeUnits > 0 && effectiveDailyUsage > 0
    ? Math.floor(totalIntakeUnits / effectiveDailyUsage)
    : null
  const monthlyCost = daysSupply && daysSupply > 0 && price != null
    ? (price / daysSupply) * 30
    : null

  return {
    servingsPerIntake,
    effectiveDailyUsage,
    daysSupply,
    monthlyCost,
    intakeAmountPerDay: servingsPerIntake,
    intakeUnit: product.serving_unit ?? 'Portionen',
    calculationSource,
    matchedIngredient,
  }
}
