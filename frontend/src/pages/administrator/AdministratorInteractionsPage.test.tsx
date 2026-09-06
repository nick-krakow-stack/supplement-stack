// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import AdministratorInteractionsPage from './AdministratorInteractionsPage';

const ingredients = [{ id: 1, name: 'Magnesium' }, { id: 2, name: 'Zink' }];
const interaction = { id: 7, ingredient_id: 1, ingredient_a_id: 1, ingredient_a_name: 'Magnesium', partner_type: 'ingredient', partner_ingredient_id: 2, ingredient_b_name: 'Zink', type: 'caution', severity: 'medium', comment: 'Testhinweis', is_active: 1, version: 3 };
const response = (payload: unknown) => ({ ok: true, json: async () => payload });

describe('interaction loading and user-confirmed recovery', () => {
  afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

  it('labels loading, reports a read error, and retries only the failed GET after an explicit click', async () => {
    let finishFirst: ((value: unknown) => void) | undefined;
    const first = new Promise((_resolve, reject) => { finishFirst = reject; });
    let reads = 0;
    const fetchMock = vi.fn(async (url: string) => {
      if (url === '/api/ingredients') return response({ ingredients });
      reads += 1;
      return reads === 1 ? first : response({ interactions: [] });
    });
    vi.stubGlobal('fetch', fetchMock);
    render(<MemoryRouter><AdministratorInteractionsPage /></MemoryRouter>);
    expect(screen.getByRole('status').textContent).toBe('Wechselwirkungen werden geladen …');
    finishFirst?.(null);
    expect(await screen.findByRole('alert')).toHaveProperty('textContent', 'Das Laden der Wechselwirkungen hat gerade nicht geklappt. Bitte versuche es erneut.');
    expect(screen.queryByText('Keine Einträge für die aktuelle Filterung.')).toBeNull();
    expect(reads).toBe(1);
    fireEvent.click(screen.getByRole('button', { name: 'Übersicht erneut laden' }));
    expect(await screen.findByText('Keine Einträge für die aktuelle Filterung.')).toBeTruthy();
    expect(reads).toBe(2);
    expect(fetchMock.mock.calls.filter(([url]) => url === '/api/ingredients')).toHaveLength(1);
  });

  it('keeps create inputs and uses the existing submit action for an explicit retry without automatic writes', async () => {
    let writes = 0;
    vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
      if (url === '/api/ingredients') return response({ ingredients });
      if (init?.method === 'POST') { writes += 1; if (writes === 1) throw null; return response({}); }
      return response({ interactions: [] });
    }));
    render(<MemoryRouter><AdministratorInteractionsPage /></MemoryRouter>);
    await screen.findByText('Keine Einträge für die aktuelle Filterung.');
    fireEvent.click(screen.getByRole('button', { name: 'Hinzufügen' }));
    fireEvent.change(screen.getByLabelText('Erster Wirkstoff'), { target: { value: '1' } });
    fireEvent.change(screen.getByLabelText('Zweiter Wirkstoff'), { target: { value: '2' } });
    fireEvent.change(screen.getByLabelText('Hinweistext'), { target: { value: 'Eigener Hinweis bleibt erhalten' } });
    fireEvent.click(screen.getByRole('button', { name: 'Neue Wechselwirkung speichern' }));
    expect(await screen.findByRole('alert')).toHaveProperty('textContent', 'Das Speichern der Wechselwirkung hat gerade nicht geklappt. Bitte versuche es erneut.');
    expect(screen.getByDisplayValue('Eigener Hinweis bleibt erhalten')).toBeTruthy();
    expect(writes).toBe(1);
    fireEvent.click(screen.getByRole('button', { name: 'Neue Wechselwirkung speichern' }));
    await waitFor(() => expect(writes).toBe(2));
  });

  it('requires confirmation again on delete retry and preserves the original version guard', async () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true);
    const deletes: RequestInit[] = [];
    vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
      if (url === '/api/ingredients') return response({ ingredients });
      if (init?.method === 'DELETE') { deletes.push(init); if (deletes.length === 1) throw new TypeError('Failed to fetch'); return response({}); }
      return response({ interactions: [interaction] });
    }));
    render(<MemoryRouter><AdministratorInteractionsPage /></MemoryRouter>);
    fireEvent.click(screen.getByRole('button', { name: 'Liste' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Eintrag löschen' }));
    expect(await screen.findByRole('alert')).toHaveProperty('textContent', 'Das Löschen der Wechselwirkung hat gerade nicht geklappt. Bitte versuche es erneut.');
    expect(deletes).toHaveLength(1);
    fireEvent.click(screen.getByRole('button', { name: 'Eintrag löschen' }));
    await waitFor(() => expect(deletes).toHaveLength(2));
    expect(confirm).toHaveBeenCalledTimes(2);
    for (const request of deletes) expect(request.headers).toHaveProperty('If-Match', '3');
  });
});
