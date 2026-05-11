import { describe, expect, it } from 'vitest';
import {
  buildStackProductPayload,
  findDuplicateIngredientInStack,
  readDemoStackSnapshot,
  summarizeDailyIngredientTotals,
  transferDemoStacksToAccount,
  writeDemoStackSnapshot,
} from './stackFlow';

function createStorage(): Storage {
  const values = new Map<string, string>();
  return {
    get length() {
      return values.size;
    },
    clear: () => values.clear(),
    getItem: (key: string) => values.get(key) ?? null,
    key: (index: number) => [...values.keys()][index] ?? null,
    removeItem: (key: string) => {
      values.delete(key);
    },
    setItem: (key: string, value: string) => {
      values.set(key, value);
    },
  };
}

describe('stackFlow', () => {
  it('persists demo stack snapshots and reads only valid stacks back', () => {
    const storage = createStorage();

    writeDemoStackSnapshot(storage, {
      activeStackId: 'stack-1',
      stacks: [
        {
          id: 'stack-1',
          name: 'Demo Stack',
          products: [
            {
              id: 7,
              product_type: 'catalog',
              name: 'Vitamin D',
              price: 9.99,
              quantity: 2,
              intake_interval_days: 1,
              dosage_text: '2000 IE täglich',
              timing: 'morning',
            },
          ],
        },
      ],
    });

    const snapshot = readDemoStackSnapshot(storage);

    expect(snapshot?.activeStackId).toBe('stack-1');
    expect(snapshot?.stacks).toHaveLength(1);
    expect(snapshot?.stacks[0].products[0].id).toBe(7);
  });

  it('builds stack API product payloads from demo products', () => {
    expect(
      buildStackProductPayload([
        {
          id: 3,
          product_type: 'user_product',
          name: 'Magnesium',
          price: 12,
          quantity: 1.5,
          intake_interval_days: 2,
          dosage_text: '300 mg täglich',
          timing: 'evening',
        },
      ]),
    ).toEqual([
      {
        id: 3,
        product_type: 'user_product',
        quantity: 1.5,
        intake_interval_days: 2,
        dosage_text: '300 mg täglich',
        timing: 'evening',
      },
    ]);
  });

  it('transfers empty demo stacks to the account', async () => {
    const storage = createStorage();
    writeDemoStackSnapshot(storage, {
      activeStackId: 'stack-empty',
      stacks: [
        {
          id: 'stack-empty',
          name: 'Leerer Demo Stack',
          products: [],
        },
      ],
    });
    const requests: Array<{ url: string; body: unknown }> = [];
    const fetcher = async (input: RequestInfo | URL, init?: RequestInit) => {
      requests.push({
        url: String(input),
        body: init?.body ? JSON.parse(String(init.body)) : null,
      });
      return new Response(JSON.stringify({ id: 123 }), { status: 200 });
    };

    const result = await transferDemoStacksToAccount(storage, fetcher, (path) => `/api${path}`);

    expect(result).toEqual({ importedStacks: 1, importedProducts: 0 });
    expect(requests).toEqual([
      {
        url: '/api/stacks',
        body: {
          name: 'Leerer Demo Stack',
          product_ids: [],
        },
      },
    ]);
    expect(readDemoStackSnapshot(storage)).toBeNull();
  });

  it('finds an existing stack product with the same effective ingredient', () => {
    const duplicate = findDuplicateIngredientInStack(
      [
        {
          id: 'stack-1',
          name: 'Basis',
          products: [
            {
              id: 10,
              product_type: 'catalog',
              name: 'D3 Tropfen',
              price: 8,
              dosage_text: '2000 IE täglich',
              ingredients: [{ ingredient_id: 99, parent_ingredient_id: 12, search_relevant: 1 }],
            },
          ],
        },
      ],
      'stack-1',
      12,
    );

    expect(duplicate?.product.name).toBe('D3 Tropfen');
    expect(duplicate?.productKey).toBe('catalog:10');
  });

  it('summarizes daily ingredient totals by ingredient and unit', () => {
    const totals = summarizeDailyIngredientTotals([
      {
        id: 1,
        name: 'Magnesium Produkt',
        price: 10,
        quantity: 2,
        intake_interval_days: 2,
        ingredients: [
          {
            ingredient_id: 5,
            quantity: 100,
            unit: 'mg',
            basis_quantity: 1,
            basis_unit: 'Kapsel',
            search_relevant: 1,
          },
        ],
      },
      {
        id: 2,
        name: 'Magnesium Zweitprodukt',
        price: 10,
        quantity: 1,
        intake_interval_days: 1,
        ingredients: [
          {
            ingredient_id: 5,
            quantity: 50,
            unit: 'mg',
            basis_quantity: 1,
            basis_unit: 'Tablette',
            search_relevant: 1,
          },
        ],
      },
    ]);

    expect(totals).toEqual([
      {
        ingredientId: 5,
        label: 'Wirkstoff 5',
        total: 150,
        unit: 'mg',
      },
    ]);
  });
});
