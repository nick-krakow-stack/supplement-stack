// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes, useNavigate } from 'react-router-dom';
import {
  getCreatorShare,
  importCreatorShare,
  preflightCreatorShare,
  reportCreatorShare,
  undoCreatorShareImport,
  type CreatorSharePreflight,
  type CreatorSharePreview,
  type CreatorShareSaveResult,
} from '../api/creatorSharing';
import { getStacks } from '../api/stacks';
import { writeCreatorShareDraft } from '../lib/creatorShareDraft';
import CreatorShareImportPage, { ResultCard } from './CreatorShareImportPage';

let currentUser: { id: number } | null = null;

vi.mock('../api/creatorSharing', () => ({
  creatorSharingEnabled: true,
  getCreatorShare: vi.fn(),
  importCreatorShare: vi.fn(),
  preflightCreatorShare: vi.fn(),
  reportCreatorShare: vi.fn(),
  undoCreatorShareImport: vi.fn(),
}));
vi.mock('../api/stacks', () => ({ getStacks: vi.fn() }));
vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({ user: currentUser, loading: false }),
}));

function RouteSwitch({ token }: { token: string }) {
  const navigate = useNavigate();
  return <button type="button" onClick={() => navigate(`/share/${token}`)}>Andere Empfehlung öffnen</button>;
}

function previewFor(token: string, title: string, type: CreatorSharePreview['type'], creatorName: string): CreatorSharePreview {
  return {
    token,
    type,
    title,
    creator: { id: 7, name: creatorName, type: 'creator' },
    published_at: '2026-08-07T08:00:00.000Z',
    items: [{
      catalog_product_id: 9,
      product_name: `${title} Produkt`,
      brand: 'Beispiel',
      quantity: 1,
      unit: 'Kapsel',
      intake_interval_days: 1,
      dosage_text: '1 Kapsel',
      timing: 'abends',
      creator_statement: 'Passt in meinen Alltag.',
    }],
  };
}

function checkedSelection(overrides: Partial<CreatorSharePreflight> = {}): CreatorSharePreflight {
  return {
    type: 'dose_recommendation',
    snapshot_hash: 'hash-1',
    title: 'Magnesium am Abend',
    creator: { id: 7, name: 'Alex Alltag' },
    target: {
      mode: 'existing',
      stack_id: 101,
      stack_name: 'Mein Alltag',
      name_already_used: false,
      suggested_stack_name: null,
    },
    main_ingredient_names: ['Magnesium'],
    recommendation: {
      product_name: 'Creator Magnesium',
      quantity: 2,
      unit: 'Kapseln',
      intake_interval_days: 1,
      dosage_text: '2 Kapseln',
      timing_label: 'Abends',
      ...{ timing: 'evening' },
    },
    similar_products: [],
    stack_item_count: 1,
    preflight_fingerprint: 'fingerprint-1',
    ...overrides,
  };
}

function similarProduct(stackItemId: number, productName: string): CreatorSharePreflight['similar_products'][number] {
  return {
    stack_item_id: stackItemId,
    version: 1,
    product_type: 'catalog',
    main_ingredient_names: ['Magnesium'],
    comparison: {
      product_name: productName,
      quantity: 1,
      unit: 'Kapsel',
      intake_interval_days: 1,
      dosage_text: '1 Kapsel',
      timing_label: 'Abends',
      ...{ timing: 'evening' },
    },
    private_note: null,
  };
}

describe('CreatorShareImportPage', () => {
  beforeEach(() => {
    currentUser = null;
    window.localStorage.clear();
    vi.mocked(getCreatorShare).mockReset();
    vi.mocked(preflightCreatorShare).mockReset();
    vi.mocked(importCreatorShare).mockReset();
    vi.mocked(reportCreatorShare).mockReset().mockResolvedValue({ ok: true, report_id: 1, status: 'pending' });
    vi.mocked(undoCreatorShareImport).mockReset().mockResolvedValue({
      ok: true,
      stack_id: 304,
      stack_name: 'Ziel',
      summary: 'Produkt B wird wiederhergestellt. Produkt A wird entfernt.',
      restored_summary: 'Der vorherige Stand in „Ziel“ wurde wiederhergestellt.',
      undone_at: '2026-08-17T08:05:00.000Z',
    });
    vi.mocked(getStacks).mockReset();
    let uuidCounter = 0;
    Object.defineProperty(globalThis, 'crypto', {
      configurable: true,
      value: {
        ...globalThis.crypto,
        randomUUID: () => `00000000-0000-4000-8000-${String(++uuidCounter).padStart(12, '0')}`,
      },
    });
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: vi.fn().mockResolvedValue(undefined) },
    });
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 1024 });
    vi.mocked(getCreatorShare).mockResolvedValue(previewFor(
      'public-token',
      'Mein Magnesium',
      'dose_recommendation',
      'Alex Alltag',
    ));
    vi.mocked(getStacks).mockResolvedValue({ stacks: [] });
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it('uses the same plain-language recommendation preview on the public route', async () => {
    const token = 'abcdefghijklmnopqrstuvwxyz123456';
    render(
      <MemoryRouter initialEntries={[`/share/${token}?view=full#details`]}>
        <Routes>
          <Route path="/share/:token" element={<CreatorShareImportPage />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByText('Geteilte Empfehlung')).toBeTruthy();
    expect(screen.getByText('Empfohlen von Alex Alltag')).toBeTruthy();
    expect(screen.getByText('So nutzt Alex Alltag das Produkt:')).toBeTruthy();
    expect(screen.getByText(/Menge laut Empfehlung:/).parentElement?.textContent).toContain('1 Kapsel');
    expect(screen.queryByText(/Affiliate-Hinweis:/)).toBeNull();
    expect(screen.getByRole('heading', { name: 'Möchtest du die Empfehlung in deinen Stacks speichern?' })).toBeTruthy();
    expect(screen.getByText('Vor der Anmeldung wird nichts gespeichert.')).toBeTruthy();
    const login = screen.getByRole('link', { name: 'Anmelden und weitermachen' });
    const register = screen.getByRole('link', { name: 'Konto erstellen' });
    expect(new URLSearchParams(login.getAttribute('href')?.split('?')[1]).get('returnTo')).toBe(`/share/${token}?view=full#details`);
    expect(new URLSearchParams(register.getAttribute('href')?.split('?')[1]).get('returnTo')).toBe(`/share/${token}?view=full#details`);
    expect(document.body.textContent).not.toMatch(/Snapshot|Einheit\(en\)|Verbindlich importieren|Hauptwirkstoff-Set|Idempotenz/);
  });

  it.each<CreatorShareSaveResult>([
    { ok: true, type: 'stack', action: 'stack_created', stack_id: 301, stack_name: 'Ganzer Stack', imported_items: 3 },
    { ok: true, type: 'dose_recommendation', action: 'added', stack_id: 302, stack_name: 'Ziel', creator_product_name: 'Produkt A' },
    { ok: true, type: 'dose_recommendation', action: 'kept_existing', stack_id: 303, stack_name: 'Ziel', creator_product_name: 'Produkt A', existing_product_name: 'Produkt B' },
    { ok: true, type: 'dose_recommendation', action: 'replaced', stack_id: 304, stack_name: 'Ziel', creator_product_name: 'Produkt A', replaced_product_name: 'Produkt B' },
  ])('links the $action result directly to its affected stack', (result) => {
    render(<MemoryRouter><ResultCard result={result} onStay={vi.fn()} /></MemoryRouter>);

    expect(screen.getByRole('link', { name: 'Stack jetzt ansehen' }).getAttribute('href')).toBe(`/stacks?stack=${result.stack_id}`);
    expect(screen.getByRole('button', { name: 'Empfehlung weiter ansehen' })).toBeTruthy();
  });

  it('offers a short, exactly bound undo only for a replace result', async () => {
    const result: CreatorShareSaveResult = {
      ok: true,
      type: 'dose_recommendation',
      action: 'replaced',
      stack_id: 304,
      stack_name: 'Ziel',
      stack_item_id: 88,
      creator_product_name: 'Produkt A',
      replaced_product_name: 'Produkt B',
      undo: {
        token: 'undo_00000000-0000-4000-8000-000000000099',
        expires_at: 1_800_000_000,
        version: 4,
        stack_id: 304,
        stack_item_id: 88,
        summary: 'Produkt B wird in „Ziel“ wiederhergestellt. Produkt A wird von diesem Platz entfernt.',
      },
    };
    render(<MemoryRouter><ResultCard result={result} shareToken="share-token" onStay={vi.fn()} /></MemoryRouter>);

    expect(screen.getByText(result.undo!.summary)).toBeTruthy();
    expect(screen.getByText(/bis .* Uhr verfügbar/)).toBeTruthy();
    expect(screen.getByText(/nur Produkt B durch Produkt A ersetzt/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Änderung rückgängig machen' }));

    await waitFor(() => expect(undoCreatorShareImport).toHaveBeenCalledWith('share-token', {
      undo_token: result.undo!.token,
      expected_version: 4,
      expected_stack_id: 304,
      expected_stack_item_id: 88,
    }));
    const confirmation = await screen.findByRole('status');
    expect(screen.getByRole('heading', { name: 'Änderung rückgängig gemacht' })).toBeTruthy();
    expect(confirmation.textContent).toContain('Der vorherige Stand in „Ziel“ wurde wiederhergestellt.');
    expect(confirmation.textContent).not.toContain('wird wiederhergestellt');
    expect(document.activeElement).toBe(confirmation);
    expect(screen.queryByText(/nur Produkt B durch Produkt A ersetzt/)).toBeNull();
    expect(screen.queryByRole('heading', { name: 'Alles erledigt' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Änderung rückgängig machen' })).toBeNull();
  });

  it('removes undo exactly at its deadline and cleans up the timer', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-17T08:00:00.000Z'));
    const clearTimeoutSpy = vi.spyOn(window, 'clearTimeout');
    const result: CreatorShareSaveResult = {
      ok: true,
      type: 'dose_recommendation',
      action: 'replaced',
      stack_id: 304,
      stack_name: 'Ziel',
      creator_product_name: 'Produkt A',
      replaced_product_name: 'Produkt B',
      undo: {
        token: 'undo_deadline',
        expires_at: Math.floor(Date.now() / 1000) + 2,
        version: 1,
        stack_id: 304,
        stack_item_id: 88,
        summary: 'Produkt B kann wiederhergestellt werden.',
      },
    };
    render(<MemoryRouter><ResultCard result={result} shareToken="share-token" onStay={vi.fn()} /></MemoryRouter>);

    expect(screen.getByRole('button', { name: 'Änderung rückgängig machen' })).toBeTruthy();
    act(() => vi.advanceTimersByTime(1_999));
    expect(screen.getByRole('button', { name: 'Änderung rückgängig machen' })).toBeTruthy();
    act(() => vi.advanceTimersByTime(1));
    expect(screen.queryByRole('button', { name: 'Änderung rückgängig machen' })).toBeNull();
    const expirationStatus = screen.getByRole('status');
    expect(expirationStatus.textContent).toContain('Frist zum Rückgängigmachen ist abgelaufen');
    expect(document.activeElement).toBe(expirationStatus);
    expect(clearTimeoutSpy).toHaveBeenCalled();
    clearTimeoutSpy.mockRestore();
  });

  it.each([undefined, -1, 1.5, Number.NaN])('does not invent an imported item count for %s', (importedItems) => {
    const result: CreatorShareSaveResult = {
      ok: true,
      type: 'stack',
      action: 'stack_created',
      stack_id: 301,
      stack_name: 'Ganzer Stack',
      imported_items: importedItems,
    };
    render(<MemoryRouter><ResultCard result={result} onStay={vi.fn()} /></MemoryRouter>);

    expect(screen.getByText('Der neue Stack „Ganzer Stack“ wurde angelegt.')).toBeTruthy();
    expect(document.body.textContent).not.toContain('mit 0 Produkten');
  });

  it('reports a public recommendation with a clear category, disclosure state and confirmation', async () => {
    const token = 'rrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrr';
    render(
      <MemoryRouter initialEntries={[`/share/${token}`]}>
        <Routes>
          <Route path="/share/:token" element={<CreatorShareImportPage />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByText('Empfohlen von Alex Alltag')).toBeTruthy();
    const toggle = screen.getByRole('button', { name: 'Stimmt etwas mit dieser Empfehlung nicht?' });
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    fireEvent.click(toggle);
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    const reportHeading = screen.getByRole('heading', { name: 'Empfehlung melden' });
    expect(reportHeading).toBeTruthy();
    expect(document.activeElement).toBe(reportHeading);
    fireEvent.click(screen.getByRole('radio', { name: /Missverständlich/ }));
    fireEvent.change(screen.getByLabelText(/Kurzer Hinweis \(optional\)/), {
      target: { value: 'Der Zeitpunkt ist für mich unklar.' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Meldung senden' }));

    await waitFor(() => expect(reportCreatorShare).toHaveBeenCalledWith(token, expect.objectContaining({
      idempotency_key: expect.stringMatching(/^[a-f0-9-]{36}$/),
      category: 'misleading',
      details: 'Der Zeitpunkt ist für mich unklar.',
    })));
    const reportStatus = await screen.findByRole('status');
    expect(reportStatus.textContent).toContain('Danke. Deine Meldung ist angekommen');
    expect(document.activeElement).toBe(reportStatus);
  });

  it('freezes the first report while pending and retries its exact payload until the user chooses to edit', async () => {
    const token = 'ssssssssssssssssssssssssssssssss';
    let rejectFirst!: (reason?: unknown) => void;
    vi.mocked(reportCreatorShare)
      .mockImplementationOnce(() => new Promise<Awaited<ReturnType<typeof reportCreatorShare>>>((_, reject) => { rejectFirst = reject; }))
      .mockRejectedValueOnce(new Error('retry remains unclear'))
      .mockResolvedValue({ ok: true, report_id: 2, status: 'pending' });
    render(
      <MemoryRouter initialEntries={[`/share/${token}`]}>
        <Routes>
          <Route path="/share/:token" element={<CreatorShareImportPage />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByText('Empfohlen von Alex Alltag')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Stimmt etwas mit dieser Empfehlung nicht?' }));
    fireEvent.click(screen.getByRole('radio', { name: /Nicht mehr aktuell/ }));
    const detailsInput = screen.getByLabelText(/Kurzer Hinweis \(optional\)/) as HTMLTextAreaElement;
    fireEvent.change(detailsInput, { target: { value: 'Meldung A bleibt gebunden.' } });
    fireEvent.click(screen.getByRole('button', { name: 'Meldung senden' }));

    await waitFor(() => expect(reportCreatorShare).toHaveBeenCalledTimes(1));
    const firstSubmission = { ...vi.mocked(reportCreatorShare).mock.calls[0][1] };
    expect(screen.getByRole('button', { name: 'Meldung wird gesendet…' })).toBeTruthy();
    expect(screen.getByRole('radio', { name: /Nicht mehr aktuell/ }).matches(':disabled')).toBe(true);
    expect(detailsInput.disabled).toBe(true);
    fireEvent.click(screen.getByRole('radio', { name: /Anderer Grund/ }));
    fireEvent.change(detailsInput, { target: { value: 'Meldung B darf nicht in den Retry rutschen.' } });
    expect((screen.getByRole('radio', { name: /Nicht mehr aktuell/ }) as HTMLInputElement).checked).toBe(true);
    expect(detailsInput.value).toBe('Meldung A bleibt gebunden.');

    await act(async () => {
      rejectFirst(new Error('unclear network outcome'));
      await Promise.resolve();
    });
    expect((await screen.findByRole('alert')).textContent).toContain('dieselbe Meldung noch einmal');
    expect(screen.getByRole('radio', { name: /Nicht mehr aktuell/ }).matches(':disabled')).toBe(true);
    expect(detailsInput.disabled).toBe(true);
    expect(screen.getByRole('button', { name: 'Meldung ändern' })).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Dieselbe Meldung erneut senden' }));
    await waitFor(() => expect(reportCreatorShare).toHaveBeenCalledTimes(2));
    expect(vi.mocked(reportCreatorShare).mock.calls[1][1]).toEqual(firstSubmission);
    expect((await screen.findByRole('alert')).textContent).toContain('dieselbe Meldung noch einmal');

    fireEvent.click(screen.getByRole('button', { name: 'Meldung ändern' }));
    expect(screen.getByRole('radio', { name: /Nicht mehr aktuell/ }).matches(':disabled')).toBe(false);
    expect(detailsInput.disabled).toBe(false);
    fireEvent.click(screen.getByRole('radio', { name: /Anderer Grund/ }));
    fireEvent.change(detailsInput, { target: { value: 'Meldung B ist jetzt bewusst neu.' } });
    fireEvent.click(screen.getByRole('button', { name: 'Meldung senden' }));
    await waitFor(() => expect(reportCreatorShare).toHaveBeenCalledTimes(3));
    expect(vi.mocked(reportCreatorShare).mock.calls[2][1]).toMatchObject({
      category: 'other',
      details: 'Meldung B ist jetzt bewusst neu.',
    });
    expect(vi.mocked(reportCreatorShare).mock.calls[2][1].idempotency_key).not.toBe(firstSubmission.idempotency_key);
  });

  it('resets checked choices when the token or target changes', async () => {
    currentUser = { id: 11 };
    const tokenA = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
    const tokenB = 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb';
    writeCreatorShareDraft(tokenB, { stack_name: 'Entwurf B', target_stack_id: 202 });
    vi.mocked(getCreatorShare).mockImplementation(async (token) => token === tokenA
      ? previewFor(tokenA, 'Empfehlung A', 'stack', 'Creator A')
      : previewFor(tokenB, 'Empfehlung B', 'dose_recommendation', 'Creator B'));
    vi.mocked(getStacks).mockResolvedValue({
      stacks: [
        { id: 101, name: 'Stack A', created_at: '2026-08-01T08:00:00.000Z' },
        { id: 202, name: 'Stack B', created_at: '2026-08-02T08:00:00.000Z' },
      ],
    });
    vi.mocked(preflightCreatorShare).mockImplementation(async (token, selection) => token === tokenA
      ? checkedSelection({
        type: 'stack',
        title: 'Empfehlung A',
        target: { mode: 'new', stack_id: null, stack_name: selection.stack_name ?? '', name_already_used: false, suggested_stack_name: null },
        recommendation: null,
        stack_item_count: 2,
      })
      : checkedSelection({
        title: 'Empfehlung B',
        target: { mode: 'existing', stack_id: 202, stack_name: 'Stack B', name_already_used: false, suggested_stack_name: null },
      }));

    render(
      <MemoryRouter initialEntries={[`/share/${tokenA}`]}>
        <RouteSwitch token={tokenB} />
        <Routes>
          <Route path="/share/:token" element={<CreatorShareImportPage />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByText('Empfohlen von Creator A')).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Name des neuen Stacks'), { target: { value: 'Mein Name für A' } });
    fireEvent.click(screen.getByRole('button', { name: 'Änderungen ansehen' }));
    expect(await screen.findByText(/Ein neuer Stack „Mein Name für A“/)).toBeTruthy();
    expect(preflightCreatorShare).toHaveBeenLastCalledWith(tokenA, { stack_name: 'Mein Name für A' });

    fireEvent.click(screen.getByRole('button', { name: 'Andere Empfehlung öffnen' }));

    expect(await screen.findByText('Empfohlen von Creator B')).toBeTruthy();
    expect(screen.queryByText('Empfohlen von Creator A')).toBeNull();
    expect(screen.queryByText(/Mein Name für A/)).toBeNull();
    expect((screen.getByLabelText('Ziel-Stack') as HTMLSelectElement).value).toBe('202');
    expect(window.localStorage.getItem(`ss_creator_share_draft_v1:${tokenB}`)).toContain('Entwurf B');
    fireEvent.click(screen.getByRole('button', { name: 'Änderungen ansehen' }));
    expect(await screen.findByText(/Creator Magnesium wird zu „Stack B“ hinzugefügt/)).toBeTruthy();
    expect(preflightCreatorShare).toHaveBeenLastCalledWith(tokenB, { target_mode: 'existing', target_stack_id: 202 });

    fireEvent.click(screen.getByRole('radio', { name: /Neuen Stack anlegen/ }));
    expect(screen.queryByRole('button', { name: /anlegen|hinzufügen|ersetzen|unverändert/ })).toBeNull();
    expect(screen.getByRole('button', { name: 'Änderungen ansehen' })).toBeTruthy();
  });

  it('shows every similar product neutrally and explains an exact replacement before saving', async () => {
    currentUser = { id: 11 };
    const token = 'eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee';
    vi.mocked(getCreatorShare).mockResolvedValue(previewFor(token, 'Magnesium am Abend', 'dose_recommendation', 'Alex Alltag'));
    vi.mocked(getStacks).mockResolvedValue({
      stacks: [{ id: 101, name: 'Mein Alltag', created_at: '2026-08-01T08:00:00.000Z' }],
    });
    vi.mocked(preflightCreatorShare).mockResolvedValue(checkedSelection({
      similar_products: [
        {
          stack_item_id: 31,
          version: 4,
          product_type: 'catalog',
          main_ingredient_names: ['Magnesium'],
          comparison: {
            product_name: 'Magnesium Alt',
            quantity: 1,
            unit: 'Kapsel',
            intake_interval_days: 2,
            dosage_text: '1 Kapsel',
            timing_label: 'Morgens',
            ...{ timing: 'morning' },
          },
          private_note: null,
        },
        {
          stack_item_id: 32,
          version: 6,
          product_type: 'user_product',
          main_ingredient_names: ['Magnesium'],
          comparison: {
            product_name: 'Mein Magnesium',
            quantity: 1,
            unit: 'Portion',
            intake_interval_days: 1,
            dosage_text: '1 Portion',
            timing_label: null,
            ...{ timing: 'unknown_internal_key' },
          },
          private_note: 'Nur nach dem Essen',
        },
      ],
    }));
    vi.mocked(importCreatorShare).mockResolvedValue({
      ok: true,
      type: 'dose_recommendation',
      action: 'replaced',
      stack_id: 101,
      stack_name: 'Mein Alltag',
      stack_item_id: 32,
      creator_product_name: 'Creator Magnesium',
      replaced_product_name: 'Mein Magnesium',
      replaced_user_product_retained: true,
    });

    render(
      <MemoryRouter initialEntries={[`/share/${token}`]}>
        <Routes>
          <Route path="/share/:token" element={<CreatorShareImportPage />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByText('Empfohlen von Alex Alltag')).toBeTruthy();
    fireEvent.click(await screen.findByRole('radio', { name: /In einen vorhandenen Stack/ }));
    expect((screen.getByLabelText('Ziel-Stack') as HTMLSelectElement).value).toBe('101');
    fireEvent.click(screen.getByRole('button', { name: 'Änderungen ansehen' }));
    expect(await screen.findByRole('heading', { name: 'Ähnliche Produkte sind schon in diesem Stack.' })).toBeTruthy();
    expect(document.activeElement).toBe(screen.getByRole('heading', { name: 'Änderungen ansehen' }));
    expect(screen.getByText('Diese wichtigen Inhaltsstoffe stimmen überein: Magnesium.')).toBeTruthy();
    expect(screen.getByRole('radio', { name: 'Magnesium Alt' })).toBeTruthy();
    expect(screen.getByRole('radio', { name: 'Mein Magnesium' })).toBeTruthy();
    expect((screen.getByRole('button', { name: 'Zuerst eine Auswahl treffen' }) as HTMLButtonElement).disabled).toBe(true);
    expect(document.body.textContent).not.toMatch(/Konflikt|Hauptwirkstoff-Set|Snapshot|Position|Import|Idempotenz/);

    fireEvent.click(screen.getByRole('radio', { name: 'Mein Magnesium' }));
    expect(screen.getByText('Deine private Notiz: Nur nach dem Essen')).toBeTruthy();
    expect(screen.getAllByText('Wie oft:', { exact: false })).toHaveLength(2);
    expect(screen.getByText('Abends')).toBeTruthy();
    expect(screen.getAllByText('Keine Angabe').length).toBeGreaterThan(0);
    expect(document.body.textContent).not.toContain('evening');
    expect(document.body.textContent).not.toContain('unknown_internal_key');
    fireEvent.click(screen.getByRole('button', { name: /Nichts ändern/ }));
    expect(screen.getByText(/Mein Magnesium bleibt in „Mein Alltag“ unverändert/)).toBeTruthy();
    expect(screen.getByText(/Creator Magnesium wird nicht hinzugefügt/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /Produkt ersetzen/ }));
    expect(screen.getByText(/Nur Mein Magnesium wird in „Mein Alltag“ durch Creator Magnesium ersetzt/)).toBeTruthy();
    expect(screen.getByText(/Die Reihenfolge bleibt gleich/)).toBeTruthy();
    expect(screen.queryByText(/Kategorie/)).toBeNull();
    expect(screen.getByText(/Dein eigenes Produkt und seine private Notiz bleiben gespeichert/)).toBeTruthy();
    expect((screen.getByRole('button', { name: 'Mein Magnesium ersetzen' }) as HTMLButtonElement).disabled).toBe(false);

    fireEvent.click(screen.getByRole('button', { name: 'Mein Magnesium ersetzen' }));
    const resultHeading = await screen.findByRole('heading', { name: 'Alles erledigt' });
    expect(resultHeading).toBeTruthy();
    expect(document.activeElement?.contains(resultHeading)).toBe(true);
    expect(screen.getByText(/nur Mein Magnesium durch Creator Magnesium ersetzt/)).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Stack jetzt ansehen' }).getAttribute('href')).toBe('/stacks?stack=101');
    expect(screen.getByRole('link', { name: 'Eigene Produkte ansehen' }).getAttribute('href')).toBe('/my-products');
    expect(screen.getByRole('button', { name: 'Empfehlung weiter ansehen' })).toBeTruthy();
    expect(importCreatorShare).toHaveBeenCalledWith(token, expect.objectContaining({
      idempotency_key: '00000000-0000-4000-8000-000000000001',
      preflight_fingerprint: 'fingerprint-1',
      expected_snapshot_hash: 'hash-1',
      decision: 'replace',
      selected_stack_item_id: 32,
      expected_stack_item_version: 6,
      target_mode: 'existing',
      target_stack_id: 101,
    }));
  });

  it.each([320, 390])('keeps every share radio compact with a touch-sized label at %spx', async (viewportWidth) => {
    currentUser = { id: 11 };
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: viewportWidth });
    window.dispatchEvent(new Event('resize'));
    const token = `radio${viewportWidth}`.padEnd(32, 'r');
    vi.mocked(getCreatorShare).mockResolvedValue(previewFor(token, 'Kompakte Auswahl', 'dose_recommendation', 'Alex Alltag'));
    vi.mocked(getStacks).mockResolvedValue({
      stacks: [{ id: 101, name: 'Mein Alltag', created_at: '2026-08-01T08:00:00.000Z' }],
    });
    vi.mocked(preflightCreatorShare).mockResolvedValue(checkedSelection({
      similar_products: [similarProduct(31, 'Magnesium Eins'), similarProduct(32, 'Magnesium Zwei')],
    }));

    render(
      <MemoryRouter initialEntries={[`/share/${token}`]}>
        <Routes>
          <Route path="/share/:token" element={<CreatorShareImportPage />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByText('Empfohlen von Alex Alltag')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Änderungen ansehen' }));
    expect(await screen.findByRole('radio', { name: 'Magnesium Eins' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Stimmt etwas mit dieser Empfehlung nicht?' }));

    const radios = screen.getAllByRole('radio');
    expect(radios.length).toBeGreaterThanOrEqual(8);
    for (const radio of radios) {
      expect(radio.className).toContain('shrink-0');
      expect(radio.className).toContain('!w-5');
      expect(radio.className).toContain('!p-0');
      const label = radio.closest('label');
      expect(label).toBeTruthy();
      expect(label?.className).toMatch(/min-h-(11|14|16)/);
    }
  });

  it('allows a full stack to keep a duplicate name and offers a clear alternative', async () => {
    currentUser = { id: 11 };
    const token = 'ffffffffffffffffffffffffffffffff';
    vi.mocked(getCreatorShare).mockResolvedValue(previewFor(token, 'Abendroutine', 'stack', 'Creator A'));
    vi.mocked(preflightCreatorShare).mockResolvedValue(checkedSelection({
      type: 'stack',
      title: 'Abendroutine',
      target: {
        mode: 'new',
        stack_id: null,
        stack_name: 'Abendroutine',
        name_already_used: true,
        suggested_stack_name: 'Abendroutine – von Creator A',
      },
      recommendation: null,
      stack_item_count: 3,
    }));
    vi.mocked(importCreatorShare).mockResolvedValue({
      ok: true,
      type: 'stack',
      action: 'stack_created',
      stack_id: 303,
      stack_name: 'Abendroutine',
      imported_items: 3,
    });

    render(
      <MemoryRouter initialEntries={[`/share/${token}`]}>
        <Routes>
          <Route path="/share/:token" element={<CreatorShareImportPage />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByText('Empfohlen von Creator A')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Änderungen ansehen' }));
    expect(await screen.findByText('Diesen Namen verwendest du bereits.')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Vorschlag verwenden: Abendroutine – von Creator A' })).toBeTruthy();
    expect(screen.getByText('Du kannst den Namen trotzdem behalten.')).toBeTruthy();
    expect(screen.getByText(/Ein neuer Stack „Abendroutine“ mit 3 Produkten wird angelegt/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Stack mit 3 Produkten anlegen' }));
    expect(await screen.findByText('Der neue Stack „Abendroutine“ wurde mit 3 Produkten angelegt.')).toBeTruthy();
  });

  it('ignores a late save response after another token has replaced the page state', async () => {
    currentUser = { id: 11 };
    const tokenA = 'cccccccccccccccccccccccccccccccc';
    const tokenB = 'dddddddddddddddddddddddddddddddd';
    vi.mocked(getCreatorShare).mockImplementation(async (token) => token === tokenA
      ? previewFor(tokenA, 'Späte Empfehlung A', 'stack', 'Creator A')
      : previewFor(tokenB, 'Aktuelle Empfehlung B', 'stack', 'Creator B'));
    vi.mocked(preflightCreatorShare).mockResolvedValue(checkedSelection({
      type: 'stack',
      target: { mode: 'new', stack_id: null, stack_name: 'Nur A', name_already_used: false, suggested_stack_name: null },
      recommendation: null,
      stack_item_count: 1,
    }));
    let resolveSave!: (result: {
      ok: true;
      type: 'stack';
      action: 'stack_created';
      stack_id: number;
      stack_name: string;
      imported_items: number;
    }) => void;
    vi.mocked(importCreatorShare).mockReturnValue(new Promise((resolve) => {
      resolveSave = resolve;
    }));

    render(
      <MemoryRouter initialEntries={[`/share/${tokenA}`]}>
        <RouteSwitch token={tokenB} />
        <Routes>
          <Route path="/share/:token" element={<CreatorShareImportPage />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByText('Empfohlen von Creator A')).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Name des neuen Stacks'), { target: { value: 'Nur A' } });
    fireEvent.click(screen.getByRole('button', { name: 'Änderungen ansehen' }));
    expect(await screen.findByText(/Ein neuer Stack „Nur A“/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Stack mit 1 Produkt anlegen' }));
    await waitFor(() => expect(importCreatorShare).toHaveBeenCalledTimes(1));
    expect(vi.mocked(importCreatorShare).mock.calls[0][0]).toBe(tokenA);
    expect(vi.mocked(importCreatorShare).mock.calls[0][1].idempotency_key).toBe('00000000-0000-4000-8000-000000000001');

    fireEvent.click(screen.getByRole('button', { name: 'Andere Empfehlung öffnen' }));
    expect(await screen.findByText('Empfohlen von Creator B')).toBeTruthy();
    expect(screen.getByLabelText('Name des neuen Stacks')).toHaveProperty('value', 'Aktuelle Empfehlung B');

    resolveSave({ ok: true, type: 'stack', action: 'stack_created', stack_id: 77, stack_name: 'Nur A', imported_items: 1 });
    await waitFor(() => expect(window.localStorage.getItem(`ss_creator_share_draft_v1:${tokenA}`)).toBeNull());
    expect(screen.getByText('Empfohlen von Creator B')).toBeTruthy();
    expect(screen.queryByRole('heading', { name: 'Alles erledigt' })).toBeNull();
    expect(window.localStorage.getItem(`ss_creator_share_draft_v1:${tokenB}`)).toContain('Aktuelle Empfehlung B');
  });

  it('switches to the matching recovery view if the recommendation expires before confirmation', async () => {
    currentUser = { id: 11 };
    const token = 'xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx';
    vi.mocked(getCreatorShare).mockResolvedValue(previewFor(token, 'Kurz verfügbar', 'stack', 'Creator A'));
    vi.mocked(preflightCreatorShare).mockResolvedValue(checkedSelection({
      type: 'stack',
      target: { mode: 'new', stack_id: null, stack_name: 'Kurz verfügbar', name_already_used: false, suggested_stack_name: null },
      recommendation: null,
      stack_item_count: 1,
    }));
    vi.mocked(importCreatorShare).mockRejectedValue({ response: { data: { code: 'SHARE_EXPIRED' } } });

    render(
      <MemoryRouter initialEntries={[`/share/${token}`]}>
        <Routes>
          <Route path="/share/:token" element={<CreatorShareImportPage />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByText('Empfohlen von Creator A')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Änderungen ansehen' }));
    expect(await screen.findByText(/Ein neuer Stack „Kurz verfügbar“/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Stack mit 1 Produkt anlegen' }));
    expect(await screen.findByRole('heading', { name: 'Dieser Link ist abgelaufen.' })).toBeTruthy();
    expect(screen.queryByText('Das hat gerade nicht geklappt. Bitte versuche es noch einmal.')).toBeNull();
  });

  it.each([
    ['SHARE_PENDING', 'Diese Empfehlung wird noch geprüft.'],
    ['SHARE_PAUSED', 'Diese Empfehlung ist vorübergehend pausiert.'],
    ['SHARE_EXPIRED', 'Dieser Link ist abgelaufen.'],
    ['SHARE_UNAVAILABLE', 'Diese Empfehlung ist nicht mehr verfügbar.'],
    ['SHARE_UNKNOWN', 'Diese Empfehlung wurde nicht gefunden.'],
  ])('offers a useful recovery path for %s', async (code, title) => {
    currentUser = { id: 11 };
    vi.mocked(getCreatorShare).mockRejectedValueOnce({ response: { data: { code } } });

    render(
      <MemoryRouter initialEntries={['/share/zzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzz']}>
        <Routes>
          <Route path="/share/:token" element={<CreatorShareImportPage />} />
        </Routes>
      </MemoryRouter>,
    );

    const recoveryHeading = await screen.findByRole('heading', { name: title });
    const recoveryStatus = recoveryHeading.closest('[role="status"]');
    expect(recoveryStatus).toBeTruthy();
    expect(document.activeElement).toBe(recoveryStatus);
    expect(screen.getByText('Du kannst sie danach selbst senden.')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Zu meinen Stacks' })).toBeTruthy();
    expect(screen.getAllByRole('link', { name: 'Zur Startseite' })).toHaveLength(1);
    fireEvent.click(screen.getByRole('button', { name: 'Nachricht an Creator kopieren' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Nachricht kopiert' })).toBeTruthy());
    const copyStatus = screen.getByRole('status');
    expect(copyStatus.textContent).toContain('Zwischenablage kopiert');
    expect(document.activeElement).toBe(copyStatus);
    expect(navigator.clipboard.writeText).toHaveBeenCalledTimes(1);
  });

  it('shows technical failures in red and lets the user retry', async () => {
    const token = 'yyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyy';
    vi.mocked(getCreatorShare)
      .mockRejectedValueOnce(new Error('network'))
      .mockResolvedValueOnce(previewFor(token, 'Erneut geladen', 'stack', 'Creator A'));

    render(
      <MemoryRouter initialEntries={[`/share/${token}`]}>
        <Routes>
          <Route path="/share/:token" element={<CreatorShareImportPage />} />
        </Routes>
      </MemoryRouter>,
    );

    const error = await screen.findByText('Das hat gerade nicht geklappt. Bitte versuche es noch einmal.');
    expect(error.className).toContain('text-red-700');
    const retry = screen.getByRole('button', { name: 'Erneut versuchen' });
    expect(retry.className).toContain('min-h-11');
    expect(retry.className).toContain('border-2');
    fireEvent.click(retry);
    expect(await screen.findByText('Empfohlen von Creator A')).toBeTruthy();
    expect(getCreatorShare).toHaveBeenCalledTimes(2);
  });

  it('retries the stack list itself and blocks checking until the list is available', async () => {
    currentUser = { id: 11 };
    const token = 'wwwwwwwwwwwwwwwwwwwwwwwwwwwwwwww';
    vi.mocked(getCreatorShare).mockResolvedValue(previewFor(token, 'Ein Produkt', 'dose_recommendation', 'Creator A'));
    let rejectFirstLoad!: (reason?: unknown) => void;
    vi.mocked(getStacks)
      .mockReturnValueOnce(new Promise((_resolve, reject) => { rejectFirstLoad = reject; }))
      .mockResolvedValueOnce({
        stacks: [{ id: 909, name: 'Vorhandener Stack', created_at: '2026-08-07T08:00:00.000Z' }],
      });

    render(
      <MemoryRouter initialEntries={[`/share/${token}`]}>
        <Routes>
          <Route path="/share/:token" element={<CreatorShareImportPage />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByText('Empfohlen von Creator A')).toBeTruthy();
    expect((screen.getByRole('button', { name: 'Änderungen ansehen' }) as HTMLButtonElement).disabled).toBe(true);
    rejectFirstLoad(new Error('network'));
    expect(await screen.findByText('Das hat gerade nicht geklappt. Bitte versuche es noch einmal.')).toBeTruthy();
    expect(document.activeElement).toBe(screen.getByRole('alert'));
    expect((screen.getByRole('button', { name: 'Änderungen ansehen' }) as HTMLButtonElement).disabled).toBe(true);

    const retry = screen.getByRole('button', { name: 'Erneut versuchen' });
    expect(retry.className).toContain('min-h-11');
    expect(retry.className).toContain('border-2');
    fireEvent.click(retry);
    expect(await screen.findByRole('radio', { name: /In einen vorhandenen Stack/ })).toBeTruthy();
    fireEvent.click(screen.getByRole('radio', { name: /In einen vorhandenen Stack/ }));
    expect((screen.getByLabelText('Ziel-Stack') as HTMLSelectElement).value).toBe('909');
    expect((screen.getByRole('button', { name: 'Änderungen ansehen' }) as HTMLButtonElement).disabled).toBe(false);
    expect(getStacks).toHaveBeenCalledTimes(2);
  });

  it('shows a red retry message when copying a recovery message fails', async () => {
    vi.mocked(getCreatorShare).mockRejectedValueOnce({ response: { data: { code: 'SHARE_EXPIRED' } } });
    vi.mocked(navigator.clipboard.writeText)
      .mockRejectedValueOnce(new Error('clipboard blocked'))
      .mockResolvedValueOnce(undefined);

    render(
      <MemoryRouter initialEntries={['/share/vvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvv']}>
        <Routes>
          <Route path="/share/:token" element={<CreatorShareImportPage />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByRole('heading', { name: 'Dieser Link ist abgelaufen.' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Nachricht an Creator kopieren' }));
    const copyError = await screen.findByText(/Das Kopieren hat nicht geklappt/);
    expect(copyError.className).toContain('text-red-700');
    const copyAlert = screen.getByRole('alert');
    expect(document.activeElement).toBe(copyAlert);
    const retry = screen.getByRole('button', { name: 'Erneut kopieren' });
    expect(retry.className).toContain('min-h-11');
    fireEvent.click(retry);
    expect(await screen.findByRole('button', { name: 'Nachricht kopiert' })).toBeTruthy();
    const copyStatus = screen.getByRole('status');
    expect(document.activeElement).toBe(copyStatus);
    expect(screen.queryByText(/Das Kopieren hat nicht geklappt/)).toBeNull();
    expect(navigator.clipboard.writeText).toHaveBeenCalledTimes(2);
  });
});
