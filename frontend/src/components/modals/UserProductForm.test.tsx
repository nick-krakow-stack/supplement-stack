// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { BrowserRouter, Link, MemoryRouter, Route, Routes, useNavigate } from 'react-router-dom';
import UserProductForm from './UserProductForm';

vi.mock('../../api/ingredients', () => ({
  getIngredient: vi.fn().mockResolvedValue({ forms: [] }),
  getIngredientParts: vi.fn().mockResolvedValue([]),
}));

function ProgrammaticBackButton() {
  const navigate = useNavigate();
  return <button type="button" onClick={() => navigate(-1)}>Programmgesteuert zurück</button>;
}

describe('UserProductForm sub-ingredient roundtrip', () => {
  afterEach(() => {
    cleanup();
    window.localStorage.clear();
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it('keeps sub-ingredients nested under their parent on save', async () => {
    const fetchMock = vi.fn().mockImplementation(async (_url: string, init?: RequestInit) => {
      const request = JSON.parse(String(init?.body));
      return {
        ok: true,
        json: async () => ({ product: { id: 7, status: 'pending', ...request, version: request.expected_version + 1 } }),
      };
    });
    vi.stubGlobal('fetch', fetchMock);
    const onSaved = vi.fn();

    render(<UserProductForm
      onClose={() => undefined}
      onSaved={onSaved}
      initialProduct={{
        id: 7,
        version: 1,
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

    fireEvent.click(screen.getByRole('button', { name: 'Weitere Angaben für Experten' }));
    expect(screen.getByDisplayValue('300')).toBeTruthy();
    expect(screen.getByText('davon EPA')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Änderungen speichern' }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const body = JSON.parse(String((fetchMock.mock.calls[0][1] as RequestInit).body));
    expect(body.expected_version).toBe(1);
    expect(body.ingredients).toHaveLength(1);
    expect(body.ingredients[0]).not.toHaveProperty('parent_ingredient_id');
    expect(body.ingredients[0].parts).toEqual([
      expect.objectContaining({ part_id: 1, quantity: 300, unit: 'mg' }),
      expect.objectContaining({ part_id: 2, quantity: 200, unit: 'mg' }),
    ]);
    expect(onSaved).toHaveBeenCalledWith(expect.objectContaining({
      version: 2,
      ingredients: [expect.objectContaining({ ingredient_id: 10, parts: expect.any(Array) })],
    }));
  });

  it('roundtrips an absent parent and part basis as null without inventing 1', async () => {
    const fetchMock = vi.fn().mockImplementation(async (_url: string, init?: RequestInit) => {
      const request = JSON.parse(String(init?.body));
      return {
        ok: true,
        json: async () => ({ product: { id: 8, status: 'pending', ...request, version: request.expected_version + 1 } }),
      };
    });
    vi.stubGlobal('fetch', fetchMock);

    render(<UserProductForm
      onClose={() => undefined}
      onSaved={() => undefined}
      initialProduct={{
        id: 8,
        version: 1,
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

    fireEvent.click(screen.getByRole('button', { name: 'Änderungen speichern' }));
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

  it('hydratisiert Dezimalwerte mit Punkt in Zahlenfeldern', () => {
    render(<UserProductForm
      onClose={() => undefined}
      onSaved={() => undefined}
      initialProduct={{
        id: 81,
        version: 1,
        name: 'Dezimalprodukt',
        brand: 'Testmarke',
        form: 'Kapsel',
        price: 19.95,
        serving_size: 1.5,
        serving_unit: 'Kapseln',
        servings_per_container: 40,
        container_count: 1,
        status: 'pending',
        ingredients: [{
          ingredient_id: 10,
          ingredient_name: 'Omega-3',
          quantity: 12.5,
          unit: 'mg',
          basis_quantity: 1.5,
          basis_unit: 'Kapseln',
          search_relevant: 1,
          parts: [{
            part_id: 1,
            part_name: 'EPA',
            quantity: 2.25,
            unit: 'mg',
            basis_quantity: 1.5,
            basis_unit: 'Kapseln',
            search_relevant: 1,
          }],
        }],
      }}
    />);

    expect((screen.getByLabelText('Packungspreis *') as HTMLInputElement).value).toBe('19.95');
    expect((screen.getByLabelText('Anzahl Einheiten pro Portion') as HTMLInputElement).value).toBe('1.5');
    expect((screen.getByLabelText('Wirkstoffmenge Omega-3') as HTMLInputElement).value).toBe('12.5');

    fireEvent.click(screen.getByRole('button', { name: 'Weitere Angaben für Experten' }));
    expect((screen.getByLabelText('Bezugsmenge Omega-3') as HTMLInputElement).value).toBe('1.5');
    expect((screen.getByLabelText('Menge EPA') as HTMLInputElement).value).toBe('2.25');
    expect((screen.getByLabelText('Bezugsgröße EPA') as HTMLInputElement).value).toBe('1.5');
  });

  it('sendet geleerte Shop-Links und Notizen ausdrücklich als null', async () => {
    const fetchMock = vi.fn().mockImplementation(async (_url: string, init?: RequestInit) => ({
      ok: true,
      json: async () => {
        const request = JSON.parse(String(init?.body));
        return { product: { id: 82, status: 'pending', ...request, version: request.expected_version + 1 } };
      },
    }));
    vi.stubGlobal('fetch', fetchMock);

    render(<UserProductForm
      onClose={() => undefined}
      onSaved={() => undefined}
      initialProduct={{
        id: 82,
        version: 1,
        name: 'Optionales leeren',
        brand: 'Testmarke',
        form: 'Kapsel',
        price: 20,
        serving_size: 1,
        serving_unit: 'Kapsel',
        servings_per_container: 60,
        container_count: 1,
        shop_link: 'https://shop.example/product',
        notes: 'Nur morgens',
        status: 'pending',
        ingredients: [{
          ingredient_id: 10,
          ingredient_name: 'Omega-3',
          quantity: 1000,
          unit: 'mg',
          basis_quantity: 1,
          basis_unit: 'Kapsel',
          search_relevant: 1,
          parts: [],
        }],
      }}
    />);

    fireEvent.click(screen.getByText('4. Weitere freiwillige Angaben'));
    fireEvent.change(screen.getByLabelText('Shop-Link'), { target: { value: '' } });
    fireEvent.change(screen.getByLabelText('Persönliche Notizen'), { target: { value: '' } });
    fireEvent.click(screen.getByRole('button', { name: 'Änderungen speichern' }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const body = JSON.parse(String((fetchMock.mock.calls[0][1] as RequestInit).body));
    expect(body.shop_link).toBeNull();
    expect(body.notes).toBeNull();
  });

  it('rechnet Packungseinheiten und Portionen in beide Richtungen ohne zweite Datenwahrheit um', async () => {
    const fetchMock = vi.fn().mockImplementation(async (_url: string, init?: RequestInit) => ({
      ok: true,
      json: async () => {
        const request = JSON.parse(String(init?.body));
        return { product: { id: 9, status: 'pending', ...request, version: request.expected_version + 1 } };
      },
    }));
    vi.stubGlobal('fetch', fetchMock);

    render(<UserProductForm
      onClose={() => undefined}
      onSaved={() => undefined}
      initialProduct={{
        id: 9,
        version: 1,
        name: 'Kapseltest',
        brand: 'Testmarke',
        form: 'Kapsel',
        price: 30,
        serving_size: 2,
        serving_unit: 'Kapseln',
        servings_per_container: 180,
        container_count: 1,
        status: 'pending',
        ingredients: [{
          ingredient_id: 10,
          ingredient_name: 'Vitamin-B-Komplex',
          quantity: 100,
          unit: 'mg',
          basis_quantity: 2,
          basis_unit: 'Kapseln',
          search_relevant: 1,
          parts: [],
        }],
      }}
    />);

    expect(screen.getByText('180 Portionen entsprechen 360 Kapseln.')).toBeTruthy();
    fireEvent.click(screen.getByRole('radio', { name: 'Kapseln' }));
    expect(screen.getByDisplayValue('360')).toBeTruthy();
    expect(screen.getByText('360 Kapseln entsprechen 180 Portionen.')).toBeTruthy();

    fireEvent.change(screen.getByLabelText('Kapseln pro Behälter *'), { target: { value: '720' } });
    fireEvent.click(screen.getByRole('button', { name: 'Änderungen speichern' }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const body = JSON.parse(String((fetchMock.mock.calls[0][1] as RequestInit).body));
    expect(body).toMatchObject({
      serving_size: 2,
      serving_unit: 'Kapseln',
      servings_per_container: 360,
    });
  });

  it.each(['Tropfen', 'Teelöffel', 'Esslöffel', 'Messlöffel', 'ml'])(
    'zeigt die bidirektionale Packungsrechnung auch für %s',
    async (unit) => {
      render(<UserProductForm
        onClose={() => undefined}
        onSaved={() => undefined}
        initialProduct={{
          id: 10,
          version: 1,
          name: `${unit}-Test`,
          brand: 'Testmarke',
          form: unit === 'Tropfen' ? 'Tropfen' : 'Flüssigkeit',
          price: 20,
          serving_size: 2,
          serving_unit: unit,
          servings_per_container: 180,
          container_count: 1,
          status: 'pending',
          ingredients: [{
            ingredient_id: 10,
            ingredient_name: 'Testwirkstoff',
            quantity: 100,
            unit: 'mg',
            basis_quantity: 2,
            basis_unit: unit,
            search_relevant: 1,
            parts: [],
          }],
        }}
      />);

      expect(screen.getByText(`180 Portionen entsprechen 360 ${unit}.`)).toBeTruthy();
      fireEvent.click(screen.getByRole('radio', { name: unit }));
      expect(screen.getByDisplayValue('360')).toBeTruthy();
      expect(screen.getByText(`360 ${unit} entsprechen 180 Portionen.`)).toBeTruthy();
    },
  );

  it('schließt mit Escape zuerst nur den Foto-Dialog und behält das Produktformular', async () => {
    const onClose = vi.fn();
    render(<UserProductForm onClose={onClose} onSaved={() => undefined} />);

    fireEvent.click(screen.getByRole('button', { name: 'Foto hochladen' }));
    expect(screen.getByRole('dialog', { name: 'Produktfoto zuschneiden' })).toBeTruthy();
    fireEvent.keyDown(document, { key: 'Escape' });

    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Produktfoto zuschneiden' })).toBeNull());
    expect(screen.getByRole('dialog', { name: 'Neues Produkt erstellen' })).toBeTruthy();
    expect(onClose).not.toHaveBeenCalled();
  });

  it('zeigt Feldfehler direkt und setzt den Fokus auf das erste unvollständige Feld', async () => {
    render(<UserProductForm onClose={() => undefined} onSaved={() => undefined} />);
    fireEvent.click(screen.getByRole('button', { name: 'Produkt erstellen' }));

    expect(screen.getByText('Bitte gib einen Produktnamen ein.')).toBeTruthy();
    await waitFor(() => expect(document.activeElement).toBe(screen.getByLabelText('Produktname *')));
  });

  it('bindet lokale Entwürfe an das angemeldete Konto', async () => {
    const onClose = vi.fn();
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    render(<UserProductForm draftOwnerId={101} onClose={onClose} onSaved={() => undefined} />);

    fireEvent.change(screen.getByLabelText('Produktname *'), { target: { value: 'Mein Entwurf' } });
    fireEvent.click(screen.getByRole('button', { name: 'Schließen' }));
    expect(confirm).toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();

    await waitFor(() => {
      expect(window.localStorage.getItem('supplement-stack:user-product-draft:v2:101')).toContain('Mein Entwurf');
    });
    cleanup();

    render(<UserProductForm draftOwnerId={202} onClose={() => undefined} onSaved={() => undefined} />);
    expect((screen.getByLabelText('Produktname *') as HTMLInputElement).value).toBe('');
    expect(screen.queryByText(/Entwurf aus diesem Browser wurde wiederhergestellt/)).toBeNull();
    cleanup();

    render(<UserProductForm draftOwnerId={101} onClose={() => undefined} onSaved={() => undefined} />);
    await waitFor(() => expect(screen.getByDisplayValue('Mein Entwurf')).toBeTruthy());
    expect(screen.getByText(/Entwurf aus diesem Browser wurde wiederhergestellt/)).toBeTruthy();
  });

  it('blockiert SPA-Navigation und Modal-Schließen bei einem nicht im Entwurf gespeicherten Foto', async () => {
    const onClose = vi.fn();
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    render(
      <MemoryRouter initialEntries={['/my-products']}>
        <Link to="/stacks">Zu den Stacks</Link>
        <Routes>
          <Route path="/my-products" element={(
            <UserProductForm draftOwnerId={303} onClose={onClose} onSaved={() => undefined} />
          )} />
          <Route path="/stacks" element={<p>Zielseite</p>} />
        </Routes>
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByText('Stattdessen Bildadresse verwenden'));
    fireEvent.change(screen.getAllByPlaceholderText('https://…')[0], {
      target: { value: 'data:image/webp;base64,bm9jaC1uaWNodC1nZXNwZWljaGVydA==' },
    });
    await waitFor(() => {
      const draft = window.localStorage.getItem('supplement-stack:user-product-draft:v2:303');
      expect(draft).not.toBeNull();
      expect(draft).not.toContain('data:image');
    });

    fireEvent.click(screen.getByRole('link', { name: 'Zu den Stacks' }));
    expect(confirm).toHaveBeenCalledWith(expect.stringContaining('Produktfotos werden nicht im Entwurf gespeichert'));
    expect(screen.queryByText('Zielseite')).toBeNull();
    expect(screen.getByRole('dialog', { name: 'Neues Produkt erstellen' })).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Schließen' }));
    expect(onClose).not.toHaveBeenCalled();
    expect(confirm).toHaveBeenCalledTimes(2);
  });

  it('blockiert echten Browser-Zurück-POP und stellt den Verlauf ohne Fotoverlust wieder her', async () => {
    const originalUrl = `${window.location.pathname}${window.location.search}${window.location.hash}`;
    window.history.replaceState({ idx: 0, key: 'before-form', usr: null }, '', '/stacks');
    window.history.pushState({ idx: 1, key: 'product-form', usr: null }, '', '/my-products');
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);

    render(
      <BrowserRouter>
        <Routes>
          <Route path="/my-products" element={(
            <UserProductForm draftOwnerId={404} onClose={() => undefined} onSaved={() => undefined} />
          )} />
          <Route path="/stacks" element={<p>Zielseite nach Browser-Zurück</p>} />
        </Routes>
      </BrowserRouter>,
    );

    fireEvent.click(screen.getByText('Stattdessen Bildadresse verwenden'));
    fireEvent.change(screen.getAllByPlaceholderText('https://…')[0], {
      target: { value: 'data:image/webp;base64,dW5nZXNwZWljaGVydGVzLWZvdG8=' },
    });
    await waitFor(() => {
      const draft = window.localStorage.getItem('supplement-stack:user-product-draft:v2:404');
      expect(draft).not.toBeNull();
      expect(draft).not.toContain('data:image');
    });

    window.history.back();

    await waitFor(() => expect(confirm).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(window.location.pathname).toBe('/my-products'));
    expect(screen.queryByText('Zielseite nach Browser-Zurück')).toBeNull();
    expect(screen.getByRole('dialog', { name: 'Neues Produkt erstellen' })).toBeTruthy();

    cleanup();
    window.history.replaceState({}, '', originalUrl || '/');
  });

  it('bestätigt programmgesteuertes Browser-Zurück bei Zustimmung genau einmal', async () => {
    const originalUrl = `${window.location.pathname}${window.location.search}${window.location.hash}`;
    window.history.replaceState({ idx: 0, key: 'programmatic-before', usr: null }, '', '/stacks');
    window.history.pushState({ idx: 1, key: 'programmatic-form', usr: null }, '', '/my-products');
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true);

    render(
      <BrowserRouter>
        <Routes>
          <Route path="/my-products" element={(
            <>
              <ProgrammaticBackButton />
              <UserProductForm draftOwnerId={405} onClose={() => undefined} onSaved={() => undefined} />
            </>
          )} />
          <Route path="/stacks" element={<p>Zielseite nach bestätigtem Zurück</p>} />
        </Routes>
      </BrowserRouter>,
    );

    fireEvent.change(screen.getByLabelText('Produktname *'), { target: { value: 'Ungespeichert' } });
    fireEvent.click(screen.getByRole('button', { name: 'Programmgesteuert zurück' }));

    await waitFor(() => expect(screen.getByText('Zielseite nach bestätigtem Zurück')).toBeTruthy());
    expect(confirm).toHaveBeenCalledTimes(1);

    cleanup();
    window.history.replaceState({}, '', originalUrl || '/');
  });
});
