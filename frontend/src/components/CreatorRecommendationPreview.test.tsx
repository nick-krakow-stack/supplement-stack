// @vitest-environment jsdom

import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import type { CreatorSharePreview } from '../api/creatorSharing';
import CreatorRecommendationPreview, {
  formatRecommendationDate,
  formatRecommendationInterval,
} from './CreatorRecommendationPreview';
import { formatRecommendationAmount, formatRecommendationUnit } from '../lib/creatorRecommendationFormat';

const preview: CreatorSharePreview = {
  token: 'test-token',
  type: 'dose_recommendation',
  title: 'Meine Magnesium-Empfehlung',
  creator: { id: 1, name: 'Alex Alltag', type: 'creator' },
  published_at: '2026-08-07T08:00:00.000Z',
  disclosure: 'Einige Links können vergütet sein.',
  items: [{
    catalog_product_id: 9,
    product_name: 'Magnesium Pur',
    brand: 'Beispiel',
    quantity: 1,
    unit: null,
    intake_interval_days: 1,
    dosage_text: null,
    timing: 'abends',
    creator_statement: 'Passt gut in meinen Alltag.',
    has_affiliate_attribution: true,
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
    expect(screen.queryByText(/Affiliate-Hinweis:/)).toBeNull();
    expect(screen.queryByText(preview.disclosure)).toBeNull();
    expect(screen.queryByText(/^Affiliate$/)).toBeNull();
    expect(screen.queryByText(/Affiliate-Link$/, { selector: 'span' })).toBeNull();
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
    expect(screen.queryByText(preview.disclosure)).toBeNull();
    expect(screen.queryByText(/^Affiliate$/)).toBeNull();
  });
});
