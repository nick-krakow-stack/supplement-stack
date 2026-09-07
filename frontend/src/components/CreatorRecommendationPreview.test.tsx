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
    const legacyClaimPreview = {
      ...preview,
      items: [{
        ...preview.items[0],
        effect_summary: 'Mineralstoff für die normale Funktion von Muskeln und Nerven.',
      }],
    } as unknown as CreatorSharePreview;
    render(<CreatorRecommendationPreview preview={legacyClaimPreview} />);

    expect(screen.getByText('Empfohlen von Alex Alltag')).toBeTruthy();
    expect(screen.getByText('Stand: 7. August 2026')).toBeTruthy();
    expect(screen.getByText('So nutzt Alex Alltag das Produkt:')).toBeTruthy();
    expect(screen.getByText('Menge:').parentElement?.textContent).toContain('1 (Einheit nicht angegeben)');
    expect(screen.getByText('Wie oft:').parentElement?.textContent).toBe('Wie oft: täglich');
    expect(screen.getByText('Eigene Angabe:').parentElement?.textContent).toBe('Eigene Angabe: Keine Angabe');
    expect(screen.getByText(/keine Dosierungsanweisung für dich/)).toBeTruthy();
    expect(screen.getByText(/Passt gut in meinen Alltag/)).toBeTruthy();
    expect(screen.getByRole('img', { name: 'Produktbild: Magnesium Pur' }).getAttribute('src')).toBe('/api/r2/products/magnesium.webp');
    expect(screen.queryByText('Wofür es genutzt wird:')).toBeNull();
    expect(screen.queryByText('Mineralstoff für die normale Funktion von Muskeln und Nerven.')).toBeNull();
    expect(screen.getByText('Zeitpunkt:').parentElement?.textContent).toBe('Zeitpunkt: Abends');
    expect(screen.queryByText(/Affiliate-Hinweis:/)).toBeNull();
    expect(screen.queryByText(/^Affiliate$/)).toBeNull();
    expect(screen.queryByText(/Affiliate-Link$/, { selector: 'span' })).toBeNull();
  });

  it('formats known raw timing keys but never exposes an unknown internal key', () => {
    expect(formatRecommendationTiming(null, 'before_breakfast')).toBe('Vor dem Frühstück');
    expect(formatRecommendationTiming(null, 'internal_future_key')).toBe('Keine Angabe');
    expect(formatRecommendationTiming('before_breakfast', 'before_breakfast')).toBe('Vor dem Frühstück');

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

    expect(screen.getByText('Wie oft:').parentElement?.textContent).toBe('Wie oft: Keine Angabe');
    expect(screen.queryByText(/täglich/)).toBeNull();
  });

  it('formats a bound v2 unit centrally without adding a product badge', () => {
    render(<CreatorRecommendationPreview preview={{
      ...preview,
      items: [{ ...preview.items[0], unit: 'Kapsel' }],
    }} />);

    expect(screen.getByText('Menge:').parentElement?.textContent).toContain('1 Kapsel');
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

  it('shows a creator profile image only when the canonical preview contains one', () => {
    const { rerender } = render(<CreatorRecommendationPreview preview={preview} />);
    expect(screen.queryByRole('img', { name: 'Profilbild von Alex Alltag' })).toBeNull();

    rerender(<CreatorRecommendationPreview preview={{
      ...preview,
      creator: { ...preview.creator, profile_image_url: 'https://images.example/alex.jpg' },
    }} />);
    expect(screen.getByRole('img', { name: 'Profilbild von Alex Alltag' }).getAttribute('src'))
      .toBe('https://images.example/alex.jpg');
  });

  it('deduplicates product statements into one general creator block and chunks long stacks without categories', () => {
    const items = Array.from({ length: 10 }, (_, index) => ({
      ...preview.items[0],
      catalog_product_id: 100 + index,
      product_name: `Produkt ${index + 1}`,
      creator_statement: index === 9 ? 'Eine zweite allgemeine Ergänzung.' : 'Passt gut in meinen Alltag.',
    }));
    render(<CreatorRecommendationPreview preview={{ ...preview, type: 'stack', items }} />);

    expect(screen.getAllByRole('heading', { name: 'Allgemeiner Hinweis von Alex Alltag' })).toHaveLength(1);
    expect(screen.getAllByText(/keine Dosierungsanweisung für dich/)).toHaveLength(1);
    const quotes = [...document.querySelectorAll('blockquote')];
    expect(quotes).toHaveLength(2);
    expect(quotes.filter((quote) => quote.textContent?.includes('Passt gut in meinen Alltag.'))).toHaveLength(1);
    expect(quotes.every((quote) => quote.closest('article') === null)).toBe(true);
    expect(screen.getByRole('navigation', { name: 'Übersicht der geteilten Produkte' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Produkte 1–8' }).getAttribute('href')).toMatch(/-products-1-8$/);
    expect(screen.getByRole('link', { name: 'Produkte 9–10' }).getAttribute('href')).toMatch(/-products-9-10$/);
    expect(screen.queryByText(/Kategorie/)).toBeNull();
  });
});
