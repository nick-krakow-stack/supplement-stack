// @vitest-environment jsdom

import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
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
});
