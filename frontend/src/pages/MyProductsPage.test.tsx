// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import MyProductsPage from './MyProductsPage';

vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({ user: { id: 42, email: 'test@example.com' } }),
}));

vi.mock('../components/modals/UserProductForm', () => ({
  default: ({ copyProduct }: { copyProduct?: { name: string } }) => (
    <div>{copyProduct ? `Kopie von ${copyProduct.name}` : 'Produktformular'}</div>
  ),
}));

const products = [
  {
    id: 1,
    version: 1,
    name: 'Vitamin-B-Komplex',
    brand: 'Beispielmarke',
    form: 'Kapsel',
    price: 30,
    serving_size: 2,
    serving_unit: 'Kapseln',
    servings_per_container: 180,
    container_count: 1,
    status: 'pending',
    visibility: 'private',
    created_at: '2026-08-16 10:00:00',
    ingredients: [{
      ingredient_id: 10,
      ingredient_name: 'Vitamin-B-Komplex',
      quantity: 100,
      unit: 'mg',
      search_relevant: 1,
      parts: [{ part_id: 11, part_name: 'Vitamin B3', search_relevant: 1 }],
    }],
    stack_usage: [{
      stack_item_id: 1000,
      stack_id: 100,
      stack_name: 'Mein Alltag',
      quantity: 9,
      intake_interval_days: 1,
      dosage_text: '100 mg',
    }],
    status_history: [{
      moderation_status: 'pending',
      visibility: 'private',
      created_at: '2026-08-16 10:00:00',
    }],
  },
  {
    id: 2,
    version: 1,
    name: 'Magnesium öffentlich',
    brand: 'Andere Marke',
    form: 'Pulver',
    price: 20,
    serving_size: 1,
    serving_unit: 'Messlöffel',
    servings_per_container: 60,
    container_count: 1,
    status: 'approved',
    visibility: 'public',
    published_product_id: 200,
    created_at: '2026-08-15 10:00:00',
    ingredients: [{ ingredient_id: 20, ingredient_name: 'Magnesium', search_relevant: 1, parts: [] }],
    stack_usage: [],
    status_history: [{
      moderation_status: 'approved',
      visibility: 'public',
      created_at: '2026-08-15 12:00:00',
    }],
  },
];

describe('MyProductsPage', () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('trennt Packungspreis und echte Stack-Monatskosten und sucht über Wirkstoffteile', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ products }),
    }));
    render(<MemoryRouter><MyProductsPage /></MemoryRouter>);

    await screen.findAllByText('Vitamin-B-Komplex');
    expect(screen.getAllByText('Packungspreis')).toHaveLength(2);
    expect(screen.getByText('Mein Alltag:')).toBeTruthy();
    expect(screen.getByText(/5,00.*€ pro Monat/)).toBeTruthy();
    expect(screen.queryByText(/\/Mo\./)).toBeNull();

    fireEvent.change(screen.getByPlaceholderText('Name, Marke oder Wirkstoff suchen'), { target: { value: 'B3' } });
    expect(screen.getAllByText('Vitamin-B-Komplex').length).toBeGreaterThan(0);
    expect(screen.queryByText('Magnesium öffentlich')).toBeNull();
  });

  it('explains the own-product publication wait and returns only to the exact internal creator draft', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ products }),
    }));
    render(
      <MemoryRouter initialEntries={['/my-products?creatorReturn=%2Fcreator%3Fbereich%3Dstack%26party%3D7%26stack%3D10%26repair%3D90']}>
        <MyProductsPage />
      </MemoryRouter>,
    );

    expect(await screen.findByText('Dein Creator-Entwurf bleibt gespeichert.')).toBeTruthy();
    expect(screen.getByText(/Erst nach Freigabe und Veröffentlichung/)).toBeTruthy();
    expect(screen.getByText(/musst du die Entscheidung abwarten/)).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Zur Empfehlung zurück' }).getAttribute('href'))
      .toBe('/creator?bereich=stack&party=7&stack=10&repair=90');
  });

  it('fails closed for an external creator return target', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ products }),
    }));
    render(
      <MemoryRouter initialEntries={['/my-products?creatorReturn=https%3A%2F%2Fevil.example%2Fcreator']}>
        <MyProductsPage />
      </MemoryRouter>,
    );

    await screen.findAllByText('Vitamin-B-Komplex');
    expect(screen.queryByText('Dein Creator-Entwurf bleibt gespeichert.')).toBeNull();
    expect(screen.queryByRole('link', { name: 'Zur Empfehlung zurück' })).toBeNull();
  });

  it('filtert Privat/Öffentlich und öffnet für öffentliche Produkte eine bearbeitbare Kopie', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ products }),
    }));
    render(<MemoryRouter><MyProductsPage /></MemoryRouter>);
    await screen.findAllByText('Vitamin-B-Komplex');

    fireEvent.change(screen.getByLabelText('Sichtbarkeit filtern'), { target: { value: 'public' } });
    expect(screen.queryByText('Vitamin-B-Komplex')).toBeNull();
    expect(screen.getByText('Magnesium öffentlich')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Magnesium öffentlich als bearbeitbare Kopie anlegen' }));
    await waitFor(() => expect(screen.getByText('Kopie von Magnesium öffentlich')).toBeTruthy());
  });

  it('bindet das Löschen an die aktuell geladene Produktversion', async () => {
    const fetchMock = vi.fn().mockImplementation(async (_url: string, init?: RequestInit) => {
      if (init?.method === 'DELETE') {
        return { ok: true, json: async () => ({ ok: true }) };
      }
      return { ok: true, json: async () => ({ products }) };
    });
    vi.stubGlobal('fetch', fetchMock);
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    render(<MemoryRouter><MyProductsPage /></MemoryRouter>);
    await screen.findAllByText('Vitamin-B-Komplex');

    fireEvent.click(screen.getByRole('button', { name: 'Vitamin-B-Komplex löschen' }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    const [, deleteInit] = fetchMock.mock.calls[1] as [string, RequestInit];
    expect(deleteInit.method).toBe('DELETE');
    expect(JSON.parse(String(deleteInit.body))).toEqual({ expected_version: 1 });
  });
});
