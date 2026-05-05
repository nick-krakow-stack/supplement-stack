import { describe, expect, it } from 'vitest';
import { calculateProductUsage, ingredientAmountPerProductServing } from './stackCalculations';

describe('stackCalculations', () => {
  it('keeps the D3 drops calculation interval-aware', () => {
    const usage = calculateProductUsage({
      price: 27.5,
      dosage_text: '10000 IE täglich',
      serving_size: 3,
      serving_unit: 'Tropfen',
      servings_per_container: 330,
      container_count: 1,
      intake_interval_days: 1,
      ingredients: [{
        ingredient_id: 1,
        quantity: 2000,
        unit: 'IU',
        basis_quantity: 3,
        basis_unit: 'Tropfen',
        search_relevant: 1,
      }],
    }, 27.5);

    expect(usage.servingsPerIntake).toBe(15);
    expect(usage.intakeAmountPerDay).toBe(15);
    expect(usage.daysSupply).toBe(66);
    expect(usage.monthlyCost).toBeCloseTo(12.5, 2);
  });

  it('rounds multi-drop portions up to whole physical units', () => {
    const usage = calculateProductUsage({
      price: 12.5,
      dosage_text: '800 IE täglich',
      serving_size: 3,
      serving_unit: 'Tropfen',
      servings_per_container: 333,
      container_count: 1,
      intake_interval_days: 1,
      ingredients: [{
        ingredient_id: 1,
        quantity: 2000,
        unit: 'IU',
        basis_quantity: 3,
        basis_unit: 'Tropfen',
        search_relevant: 1,
      }],
    }, 12.5);

    expect(usage.servingsPerIntake).toBe(2);
    expect(usage.intakeAmountPerDay).toBe(2);
    expect(usage.daysSupply).toBe(499);
    expect(usage.monthlyCost).toBeCloseTo(0.75, 2);
  });

  it('uses basis quantity for capsule potency', () => {
    const amountPerCapsule = ingredientAmountPerProductServing({
      quantity: 1000,
      unit: 'mg',
      basis_quantity: 4,
      basis_unit: 'Kapseln',
    }, {
      serving_size: 1,
      serving_unit: 'Kapseln',
    });

    expect(amountPerCapsule).toBe(250);
    expect(calculateProductUsage({
      dosage_text: '500 mg täglich',
      serving_size: 1,
      serving_unit: 'Kapseln',
      servings_per_container: 120,
      ingredients: [{
        quantity: 1000,
        unit: 'mg',
        basis_quantity: 4,
        basis_unit: 'Kapseln',
        search_relevant: 1,
      }],
    }).servingsPerIntake).toBe(2);
  });

  it('converts compatible mass units but not IU into mass', () => {
    expect(calculateProductUsage({
      dosage_text: '500 mg täglich',
      servings_per_container: 60,
      ingredients: [{ quantity: 0.25, unit: 'g', search_relevant: 1 }],
    }).servingsPerIntake).toBe(2);

    expect(calculateProductUsage({
      dosage_text: '25 µg täglich',
      quantity: 3,
      servings_per_container: 60,
      ingredients: [{ quantity: 1000, unit: 'IU', search_relevant: 1 }],
    }).calculationSource).toBe('manual_quantity');
  });

  it('prefers a compatible ingredient unit over an incompatible search-relevant row', () => {
    const usage = calculateProductUsage({
      dosage_text: '500 mg täglich',
      servings_per_container: 90,
      ingredients: [
        { ingredient_id: 1, quantity: 2000, unit: 'IU', search_relevant: 1 },
        { ingredient_id: 2, quantity: 250, unit: 'mg', search_relevant: 0 },
      ],
    });

    expect(usage.calculationSource).toBe('target_dose');
    expect(usage.servingsPerIntake).toBe(2);
    expect(usage.matchedIngredient?.ingredient_id).toBe(2);
  });

  it('falls back to default when dosage text is not parseable', () => {
    const usage = calculateProductUsage({
      dosage_text: 'unbekannt',
      servings_per_container: 30,
      container_count: 1,
      quantity: 500,
    }, 15);

    expect(usage.calculationSource).toBe('default');
    expect(usage.servingsPerIntake).toBe(1);
    expect(usage.daysSupply).toBe(30);
    expect(usage.monthlyCost).toBeCloseTo(15, 2);
  });
}); 
