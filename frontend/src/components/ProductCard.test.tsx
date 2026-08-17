// @vitest-environment jsdom

import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import ProductCard from './ProductCard';

describe('ProductCard sub-ingredients', () => {
  it('shows active contained amounts as davon values and hides inactive parts', () => {
    render(<ProductCard product={{
      id: 1,
      name: 'Omega-3 Kapseln',
      price: 19.9,
      quantity: 1000,
      unit: 'mg',
      ingredients: [{
        ingredient_id: 10,
        quantity: 1000,
        unit: 'mg',
        parts: [
          { part_id: 1, part_name: 'EPA', part_status: 'active', quantity: 300, unit: 'mg' },
          { part_id: 2, part_name: 'DPA', part_status: 'inactive', quantity: 20, unit: 'mg' },
        ],
      }],
    }} />);

    expect(screen.getByText('davon EPA: 300 mg')).toBeTruthy();
    expect(screen.queryByText(/DPA/)).toBeNull();
  });

  it('shows no product-level affiliate label in card or list view', () => {
    const affiliateProduct = {
      id: 2,
      name: 'Vitamin K2',
      price: 22.9,
      quantity: 180,
      unit: 'µg',
      shop_link: 'https://example.com/vitamin-k2',
      is_affiliate: 1,
      ingredients: [],
    };

    const { rerender } = render(<ProductCard product={affiliateProduct} />);
    expect(screen.queryByText(/^Affiliate(?:-Link)?$/)).toBeNull();

    rerender(<ProductCard product={affiliateProduct} display="list" />);
    expect(screen.queryByText(/^Affiliate(?:-Link)?$/)).toBeNull();
  });

  it('shows the B12 fallback as a calm intake note instead of an alarm', () => {
    render(<ProductCard product={{
      id: 3,
      name: 'Vitamin B12 500µg',
      price: 11.9,
      ingredients: [],
    }} />);

    expect(screen.getByText('Hinweis')).toBeTruthy();
    expect(screen.getByText('Kaffee und Tee zeitversetzt trinken')).toBeTruthy();
    expect(screen.queryByText('Achtung')).toBeNull();
    expect(screen.queryByText(/20-30min/)).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Mehr Informationen: Kaffee und Tee zeitversetzt trinken' }));
    expect(screen.getByRole('heading', { name: 'Einnahmehinweis' })).toBeTruthy();
    expect(screen.queryByText('Warnung')).toBeNull();
  });

  it('keeps claims out of a commercial card while preserving its buy link and honest missing-data state', () => {
    const legacyProduct = {
      id: 4,
      name: 'Magnesium Bisglycinat',
      price: 22.9,
      shop_link: 'https://shop.example/magnesium',
      ingredient_effect_summary: 'Mineralstoff für die normale Funktion von Muskeln und Nerven.',
      effect_summary: 'Dieser alte Produkttext darf ebenfalls nicht erscheinen.',
      ingredients: [],
    };
    const { container } = render(<ProductCard product={legacyProduct} />);
    const card = within(container);

    expect(card.queryByText('Wirkung')).toBeNull();
    expect(card.queryByText(legacyProduct.ingredient_effect_summary)).toBeNull();
    expect(card.queryByText(legacyProduct.effect_summary)).toBeNull();
    expect(card.getByText(/Nicht berechenbar/)).toBeTruthy();
    expect(card.getByRole('link', { name: /Jetzt kaufen: Magnesium Bisglycinat/ })).toBeTruthy();
  });

  it.each(['card', 'list'] as const)(
    'shows the report action next to a valid buy link in %s view and reports it as invalid',
    (display) => {
      const onReportMissingLink = vi.fn();
      const product = {
        id: 5,
        name: 'Magnesium Bisglycinat',
        price: 18.9,
        shop_link: 'https://shop.example/magnesium',
        ingredients: [],
      };

      const { container } = render(
        <ProductCard
          product={product}
          display={display}
          onReportMissingLink={onReportMissingLink}
        />,
      );
      const card = within(container);

      expect(card.getByRole('link', { name: /Jetzt kaufen: Magnesium Bisglycinat/ })).toBeTruthy();
      fireEvent.click(card.getByRole('button', { name: 'Fehlenden oder defekten Link melden: Magnesium Bisglycinat' }));

      expect(onReportMissingLink).toHaveBeenCalledOnce();
      expect(onReportMissingLink).toHaveBeenCalledWith(product, 'invalid_link');
    },
  );

  it.each([
    { shopLink: undefined, expectedReason: 'missing_link' as const },
    { shopLink: 'https://ungültig..example', expectedReason: 'invalid_link' as const },
  ])('uses $expectedReason when the shop link is missing or invalid', ({ shopLink, expectedReason }) => {
    const onReportMissingLink = vi.fn();
    const product = {
      id: 6,
      name: 'Vitamin C',
      price: 12.9,
      shop_link: shopLink,
      ingredients: [],
    };

    const { container } = render(
      <ProductCard product={product} onReportMissingLink={onReportMissingLink} />,
    );
    const card = within(container);

    expect(card.queryByRole('link', { name: /Jetzt kaufen: Vitamin C/ })).toBeNull();
    fireEvent.click(card.getByRole('button', { name: 'Fehlenden oder defekten Link melden: Vitamin C' }));

    expect(onReportMissingLink).toHaveBeenCalledWith(product, expectedReason);
  });
});
