import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { DosageGuideline } from '../types/local';
import {
  describeStudyGuidelineEffect,
  describeStudyGuidelineContext,
  modalIngredientDescription,
  modalVisibleGuidelineOptions,
  populationLabel,
  selectStudyGuideline,
} from './StackWorkspace';

describe('StackWorkspace dosage guideline helpers', () => {
  it('selects active tested study amounts and describes them as context', () => {
    const guidelines: DosageGuideline[] = [
      {
        id: 1,
        ingredient_id: 42,
        source: 'DGE',
        source_title: 'DGE Referenzwert',
        population: 'adult',
        dose_max: 1000,
        unit: 'mg',
        is_default: 1,
        amount_type: 'reference_value',
        stack_visible: 1,
      },
      {
        id: 2,
        ingredient_id: 42,
        source: 'study',
        source_title: 'Jackson et al. Calcium Study',
        population: 'adult',
        dose_max: 1200,
        unit: 'mg',
        is_default: 0,
        amount_type: 'tested_amount',
        stack_role: 'not_in_stack',
        stage4_status: 'active',
        stack_visible: 0,
        notes: 'Getestete Menge aus Studienkontext, nicht als operative Empfehlung.',
      },
      {
        id: 3,
        ingredient_id: 42,
        source: 'practice',
        source_title: 'Praxiswert',
        population: 'adult',
        dose_max: 800,
        unit: 'mg',
        is_default: 0,
      },
    ];

    const selected = selectStudyGuideline(guidelines, guidelines[0]);

    expect(selected?.id).toBe(2);
    expect(describeStudyGuidelineContext(selected)).toBe(
      'Jackson et al. Calcium Study: Getestete Menge aus Studienkontext, nicht als operative Empfehlung.',
    );
  });

  it('keeps study source context separate from the observed effect', () => {
    const guideline: DosageGuideline = {
      id: 4,
      ingredient_id: 32,
      source: 'study',
      source_title: 'AREDS-Mischung im AMD-Kontext',
      population: 'adult',
      dose_max: 15,
      unit: 'mg',
      is_default: 0,
      amount_type: 'tested_amount',
      notes: 'Das Fortschreiten einer bestimmten Augenerkrankung wurde bei Risikopersonen gebremst.',
    };

    expect(describeStudyGuidelineEffect(guideline)).toBe(
      'Das Fortschreiten einer bestimmten Augenerkrankung wurde bei Risikopersonen gebremst.',
    );
  });

  it('keeps the add-product modal wired to the supplied template frame', () => {
    const workspaceSource = readFileSync(resolve(process.cwd(), 'src/components/StackWorkspace.tsx'), 'utf8');
    const stylesSource = readFileSync(resolve(process.cwd(), 'src/styles.css'), 'utf8');

    expect(workspaceSource).toContain('modal-wrap ss-add-modal-overlay');
    expect(workspaceSource).toContain('stage ss-add-modal-stage');
    expect(workspaceSource).toContain('modal ss-add-modal');
    expect(workspaceSource).toContain('ss-dosage-panel');
    expect(workspaceSource).toContain('ss-reference-card--study');
    expect(stylesSource).toContain('--radius-modal: 26px');
    expect(stylesSource).toContain('--font: \'Poppins\', system-ui, sans-serif');
    expect(stylesSource).toContain('font-family: var(--font)');
  });

  it('keeps modal copy compact enough for the supplied template card', () => {
    const description = modalIngredientDescription({
      name: 'Vitamin A',
      description: 'Vitamin A ist ein fettlösliches Vitamin, das in zwei Hauptformen vorkommt. Retinol ist in tierischen Lebensmitteln enthalten. Beta-Carotin kommt in Pflanzen vor. Diese sehr lange Beschreibung darf das Modal nicht aufblähen.',
    });

    expect(description.length).toBeLessThanOrEqual(180);
    expect(description).toContain('Vitamin A');
  });

  it('uses readable target-group labels and deduplicates modal guideline tabs', () => {
    const guidelines: DosageGuideline[] = [
      { id: 1, ingredient_id: 1, source: 'DGE', population: 'adult_female', dose_max: 700, unit: 'µg RAE', is_default: 0 },
      { id: 2, ingredient_id: 1, source: 'DGE', population: 'adult_male', dose_max: 850, unit: 'µg RAE', is_default: 1 },
      { id: 3, ingredient_id: 1, source: 'DGE', population: 'adult_male', dose_max: 850, unit: 'µg RAE', is_default: 0 },
      { id: 4, ingredient_id: 1, source: 'DGE', population: 'pregnant', dose_max: 800, unit: 'µg RAE', is_default: 0 },
    ];

    expect(populationLabel('adult_male')).toBe('Männer');
    expect(populationLabel('adult_female')).toBe('Frauen');
    expect(modalVisibleGuidelineOptions(guidelines).map((item) => populationLabel(item.population))).toEqual([
      'Frauen',
      'Männer',
      'Schwangere',
    ]);
  });

  it('prevents the reference cards from creating a horizontal scrollbar', () => {
    const stylesSource = readFileSync(resolve(process.cwd(), 'src/styles.css'), 'utf8');

    expect(stylesSource).toContain('overflow-x: hidden');
    expect(stylesSource).toContain('grid-template-columns: minmax(0, 1fr) minmax(0, 1fr)');
    expect(stylesSource).toContain('min-width: 0');
  });
});
