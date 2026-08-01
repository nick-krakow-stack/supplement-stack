// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import UserProductForm from './UserProductForm';

vi.mock('../../api/ingredients', () => ({
  getIngredient: vi.fn(),
  getIngredientParts: vi.fn().mockResolvedValue([]),
}));

describe('UserProductForm sub-ingredient roundtrip', () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it('keeps sub-ingredients nested under their parent on save', async () => {
    const fetchMock = vi.fn().mockImplementation(async (_url: string, init?: RequestInit) => {
      const request = JSON.parse(String(init?.body));
      return {
        ok: true,
        json: async () => ({ product: { id: 7, status: 'pending', ...request } }),
      };
    });
    vi.stubGlobal('fetch', fetchMock);
    const onSaved = vi.fn();

    render(<UserProductForm
      onClose={() => undefined}
      onSaved={onSaved}
      initialProduct={{
        id: 7,
        name: 'Omega-3 Test',
        brand: 'Testmarke',
        form: 'Kapsel',
        price: 20,
        serving_size: 1,
        serving_unit: 'Kapsel',
        servings_per_container: 60,
        container_count: 1,
        status: 'pending',
        ingredients: [{
          ingredient_id: 10,
          ingredient_name: 'Omega-3',
          quantity: 1000,
          unit: 'mg',
          basis_quantity: 1,
          basis_unit: 'Kapsel',
          search_relevant: 1,
          parts: [
            { part_id: 1, part_name: 'EPA', part_status: 'active', quantity: 300, unit: 'mg', basis_quantity: 1, basis_unit: 'Kapsel', search_relevant: 1 },
            { part_id: 2, part_name: 'DHA', part_status: 'active', quantity: 200, unit: 'mg', basis_quantity: 1, basis_unit: 'Kapsel', search_relevant: 1 },
          ],
        }],
      }}
    />);

    expect(screen.getByDisplayValue('300')).toBeTruthy();
    expect(screen.getByText('davon EPA')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Speichern' }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const body = JSON.parse(String((fetchMock.mock.calls[0][1] as RequestInit).body));
    expect(body.ingredients).toHaveLength(1);
    expect(body.ingredients[0]).not.toHaveProperty('parent_ingredient_id');
    expect(body.ingredients[0].parts).toEqual([
      expect.objectContaining({ part_id: 1, quantity: 300, unit: 'mg' }),
      expect.objectContaining({ part_id: 2, quantity: 200, unit: 'mg' }),
    ]);
    expect(onSaved).toHaveBeenCalledWith(expect.objectContaining({
      ingredients: [expect.objectContaining({ ingredient_id: 10, parts: expect.any(Array) })],
    }));
  });

  it('roundtrips an absent parent and part basis as null without inventing 1', async () => {
    const fetchMock = vi.fn().mockImplementation(async (_url: string, init?: RequestInit) => {
      const request = JSON.parse(String(init?.body));
      return {
        ok: true,
        json: async () => ({ product: { id: 8, status: 'pending', ...request } }),
      };
    });
    vi.stubGlobal('fetch', fetchMock);

    render(<UserProductForm
      onClose={() => undefined}
      onSaved={() => undefined}
      initialProduct={{
        id: 8,
        name: 'Omega-3 ohne Bezugsgröße',
        brand: 'Testmarke',
        form: 'Kapsel',
        price: 20,
        serving_size: 1,
        serving_unit: 'Kapsel',
        servings_per_container: 60,
        container_count: 1,
        status: 'pending',
        ingredients: [{
          ingredient_id: 10,
          ingredient_name: 'Omega-3',
          quantity: 1000,
          unit: 'mg',
          basis_quantity: null,
          basis_unit: null,
          search_relevant: 1,
          parts: [{
            part_id: 1,
            part_name: 'EPA',
            part_status: 'active',
            quantity: 300,
            unit: 'mg',
            basis_quantity: null,
            basis_unit: null,
            search_relevant: 1,
          }],
        }],
      }}
    />);

    fireEvent.click(screen.getByRole('button', { name: 'Speichern' }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const body = JSON.parse(String((fetchMock.mock.calls[0][1] as RequestInit).body));
    expect(body.ingredients[0]).toMatchObject({
      basis_quantity: null,
      basis_unit: null,
    });
    expect(body.ingredients[0].parts[0]).toMatchObject({
      basis_quantity: null,
      basis_unit: null,
    });
  });
});
