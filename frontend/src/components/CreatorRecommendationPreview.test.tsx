// @vitest-environment jsdom

import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import type { CreatorSharePreview } from '../api/creatorSharing';
import CreatorRecommendationPreview, {
  formatRecommendationDate,
  formatRecommendationInterval,
  formatRecommendationTiming,
} from './CreatorRecommendationPreview';
import { formatRecommendationAmount, formatRecommendationUnit } from '../lib/creatorRecommendationFormat';

const preview: CreatorSharePreview = {
  token: 'test-token',
  type: 'dose_recommendation',
  title: 'Meine Magnesium-Empfehlung',
  creator: { id: 1, name: 'Alex Alltag', type: 'creator' },
  published_at: '2026-08-07T08:00:00.000Z',
  items: [{
    catalog_product_id: 9,
    product_name: 'Magnesium Pur',
    brand: 'Beispiel',
    image_url: '/api/r2/products/magnesium.webp',
    effect_summary: 'Unterstützt die normale Muskelfunktion.',
    quantity: 1,
    unit: null,
    intake_interval_days: 1,
    dosage_text: null,
    timing: 'abends',
    timing_label: 'Abends',
    creator_statement: 'Passt gut in meinen Alltag.',
  }],
};

describe('CreatorRecommendationPreview', () => {
  afterEach(cleanup);

  it('shows no additional affiliate notice, frames usage as the creator’s routine and invents no unit', () => {
    render(<CreatorRecommendationPreview preview={preview} />);

    expect(screen.getByText('Empfohlen von Alex Alltag')).toBeTruthy();
    expect(screen.getByText('Stand: 7. August 2026')).toBeTruthy();
    expect(screen.getByText('So nutzt Alex Alltag das Produkt:')).toBeTruthy();
    expect(screen.getByText(/Menge laut Empfehlung:/).parentElement?.textContent).toContain('1 (Einheit nicht angegeben)');
    expect(screen.getByText('Einnahme:').parentElement?.textContent).toBe('Einnahme: täglich');
    expect(screen.getByText(/keine Dosierungsanweisung für dich/)).toBeTruthy();
    expect(screen.getByText(/Passt gut in meinen Alltag/)).toBeTruthy();
    expect(screen.getByRole('img', { name: 'Produktbild: Magnesium Pur' }).getAttribute('src')).toBe('/api/r2/products/magnesium.webp');
    expect(screen.getByText('Wofür es genutzt wird:').parentElement?.textContent).toContain('Unterstützt die normale Muskelfunktion.');
    expect(screen.getByText('Zeitpunkt:').parentElement?.textContent).toBe('Zeitpunkt: Abends');
    expect(screen.queryByText(/Affiliate-Hinweis:/)).toBeNull();
    expect(screen.queryByText(/^Affiliate$/)).toBeNull();
    expect(screen.queryByText(/Affiliate-Link$/, { selector: 'span' })).toBeNull();
  });

  it('formats known raw timing keys but never exposes an unknown internal key', () => {
    expect(formatRecommendationTiming(null, 'before_breakfast')).toBe('Vor dem Frühstück');
    expect(formatRecommendationTiming(null, 'internal_future_key')).toBe('Keine Angabe');

    render(<CreatorRecommendationPreview preview={{
      ...preview,
      items: [{ ...preview.items[0], timing_label: null, timing: 'internal_future_key' }],
    }} />);

    expect(screen.getByText('Zeitpunkt:').parentElement?.textContent).toBe('Zeitpunkt: Keine Angabe');
    expect(screen.queryByText(/internal_future_key/)).toBeNull();
  });

  it('formats valid German dates and intervals without fallback inventions', () => {
    expect(formatRecommendationDate('2026-08-07T08:00:00.000Z')).toBe('7. August 2026');
    expect(formatRecommendationDate('ungültig')).toBeNull();
    expect(formatRecommendationInterval(1)).toBe('täglich');
    expect(formatRecommendationInterval(2)).toBe('alle zwei Tage');
    expect(formatRecommendationInterval(3)).toBe('alle 3 Tage');
    expect(formatRecommendationInterval(0)).toBeNull();
    expect(formatRecommendationInterval(null)).toBeNull();
  });

  it('does not invent a daily schedule when the saved interval is missing', () => {
    render(<CreatorRecommendationPreview preview={{
      ...preview,
      items: [{ ...preview.items[0], intake_interval_days: null }],
    }} />);

    expect(screen.queryByText('Einnahme:')).toBeNull();
    expect(screen.queryByText(/täglich/)).toBeNull();
  });

  it('formats a bound v2 unit centrally without adding a product badge', () => {
    render(<CreatorRecommendationPreview preview={{
      ...preview,
      items: [{ ...preview.items[0], unit: 'Kapsel' }],
    }} />);

    expect(screen.getByText(/Menge laut Empfehlung:/).parentElement?.textContent).toContain('1 Kapsel');
    expect(formatRecommendationUnit(' µg ')).toBe('µg');
    expect(formatRecommendationAmount(2.5, 'ml')).toBe('2,5 ml');
    expect(formatRecommendationAmount(1, ' kapseln ')).toBe('1 Kapsel');
    expect(formatRecommendationAmount(2, 'KAPSEL')).toBe('2 Kapseln');
    expect(formatRecommendationAmount(1, 'TABLETTEN')).toBe('1 Tablette');
    expect(formatRecommendationAmount(2, ' tablette ')).toBe('2 Tabletten');
    expect(formatRecommendationAmount(1, 'Portionen')).toBe('1 Portion');
    expect(formatRecommendationAmount(2, 'PORTION')).toBe('2 Portionen');
    expect(formatRecommendationAmount(2, 'Messlöffel')).toBe('2 Messlöffel');
    expect(screen.queryByText(/Affiliate-Hinweis:/)).toBeNull();
    expect(screen.queryByText(/^Affiliate$/)).toBeNull();
  });
});
