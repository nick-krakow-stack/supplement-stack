// @vitest-environment jsdom

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { DosageGuideline } from '../types/local';
import { useAuth } from '../contexts/AuthContext';
import { getPublicIntakeTimings, reportProductLink } from '../api/stacks';
import {
  applyPlannedDoseToProduct,
  buildStackPdf,
  describeProductPlan,
  describeStudyGuidelineEffect,
  describeStudyGuidelineContext,
  downloadStackPdf,
  modalIngredientDescription,
  modalVisibleGuidelineOptions,
  populationLabel,
  productTimingLabel,
  selectStudyGuideline,
  StackWorkspace,
} from './StackWorkspace';

vi.mock('../contexts/AuthContext', () => ({ useAuth: vi.fn() }));
vi.mock('../api/stacks', () => ({
  getPublicIntakeTimings: vi.fn(async () => []),
  getTrashedStacks: vi.fn(async () => []),
  reportProductLink: vi.fn(async () => undefined),
  restoreStack: vi.fn(async () => undefined),
  updateStackItemsLayout: vi.fn(async () => undefined),
}));
vi.mock('../api/creatorSharing', () => ({
  creatorSharingEnabled: false,
  markStackOpened: vi.fn(async () => undefined),
}));

function authValue(guidelineSource: 'DGE' | 'studien' | null = null): ReturnType<typeof useAuth> {
  const user = guidelineSource === null
    ? { id: 1, email: 'user@test.invalid', role: 'user' as const, guideline_source: null }
    : { id: 1, email: 'user@test.invalid', role: 'user' as const, guideline_source: guidelineSource };
  return {
    user,
    isAdmin: false,
    loading: false,
    login: vi.fn(async () => user),
    register: vi.fn(),
    logout: vi.fn(async () => undefined),
    refreshUser: vi.fn(async () => undefined),
  } as ReturnType<typeof useAuth>;
}

function guestAuthValue(): ReturnType<typeof useAuth> {
  return {
    user: null,
    isAdmin: false,
    loading: false,
    login: vi.fn(),
    register: vi.fn(),
    logout: vi.fn(async () => undefined),
    refreshUser: vi.fn(async () => undefined),
  } as ReturnType<typeof useAuth>;
}

function LocationProbe() {
  const location = useLocation();
  return <><output data-testid="location-search">{location.search}</output><output data-testid="location-hash">{location.hash}</output></>;
}

function BackButton() {
  const navigate = useNavigate();
  return <button type="button" onClick={() => navigate(-1)}>Browser zurück</button>;
}

function mockWorkspaceFetch(catalogProducts: Array<Record<string, unknown>> = [], guidelinesOverride?: DosageGuideline[]): ReturnType<typeof vi.fn> {
  const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input instanceof Request ? input.url : input);
    let body: Record<string, unknown> = {};
    if (url.includes('/demo/products')) body = { products: [] };
    else if (url.includes('/shop-domains')) body = { shops: [] };
    else if (url.includes('/ingredients/search')) {
      body = {
        ingredients: [{ id: 77, name: 'Magnesium', unit: 'mg', description: 'Ein Mineralstoff.' }],
      };
    } else if (url.includes('/ingredients/77/dosage-guidelines')) {
      body = {
        guidelines: guidelinesOverride ?? [
          { id: 1, ingredient_id: 77, source: 'DGE', source_title: 'DGE', population: 'adult', dose_max: 10, unit: 'mg', is_default: 1 },
          { id: 2, ingredient_id: 77, source: 'study', source_title: 'Studie', population: 'adult', dose_max: 20, unit: 'mg', is_default: 0, amount_type: 'tested_amount' },
        ],
      };
    } else if (/\/ingredients\/77(?:\?|$)/.test(url)) {
      body = {
        ingredient: { id: 77, name: 'Magnesium', unit: 'mg', description: 'Ein Mineralstoff.' },
        forms: [],
        display_profiles: [{ id: 1, form_id: null, part_id: null, effect_summary: 'Mineralstoff für die normale Funktion von Muskeln und Nerven.' }],
      };
    } else if (url.includes('/ingredients/77/products')) {
      body = { products: catalogProducts };
    }
    return new Response(JSON.stringify(body), {
      status: 200,
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
    });
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

function mockAuthenticatedStacksFetch(initialStacks: Array<Record<string, unknown>>) {
  let stacks = structuredClone(initialStacks) as Array<Record<string, unknown>>;
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init: RequestInit = {}) => {
    const rawUrl = String(input instanceof Request ? input.url : input);
    const url = new URL(rawUrl, 'https://app.test');
    const method = (init.method ?? (input instanceof Request ? input.method : 'GET')).toUpperCase();
    let body: Record<string, unknown> = {};
    let status = 200;

    if (url.pathname.endsWith('/shop-domains')) body = { shops: [] };
    else if (url.pathname.endsWith('/stacks') && method === 'GET') {
      body = { stacks: stacks.map((stack) => {
        const row = { ...stack };
        delete row.products;
        return row;
      }) };
    } else if (/\/stacks\/[^/]+\/email$/.test(url.pathname) && method === 'POST') {
      body = { ok: true };
    } else {
      const match = /\/stacks\/([^/]+)$/.exec(url.pathname);
      const stackIndex = match ? stacks.findIndex((stack) => String(stack.id) === decodeURIComponent(match[1])) : -1;
      if (stackIndex >= 0 && method === 'GET') {
        const stack = stacks[stackIndex];
        body = { stack: { ...stack, products: undefined }, items: stack.products ?? [] };
      } else if (stackIndex >= 0 && method === 'PUT') {
        const requestBody = JSON.parse(String(init.body ?? '{}')) as Record<string, unknown>;
        const current = stacks[stackIndex];
        const currentProducts = Array.isArray(current.products) ? current.products as Array<Record<string, unknown>> : [];
        const requestedProducts = Array.isArray(requestBody.product_ids)
          ? requestBody.product_ids as Array<Record<string, unknown>>
          : null;
        const products = requestedProducts
          ? requestedProducts.map((requested) => {
            const existing = currentProducts.find((product) => (
              Number(product.id) === Number(requested.id)
              && String(product.product_type ?? 'catalog') === String(requested.product_type ?? 'catalog')
            )) ?? {};
            return { ...existing, ...requested, version: Number(existing.version ?? 1) + 1 };
          })
          : currentProducts;
        const next = {
          ...current,
          ...(typeof requestBody.name === 'string' ? { name: requestBody.name } : {}),
          ...(requestBody.description !== undefined ? { description: requestBody.description } : {}),
          version: Number(current.version ?? 1) + 1,
          products,
        };
        stacks = stacks.map((stack, index) => index === stackIndex ? next : stack);
        body = { stack: { ...next, products: undefined }, items: products };
      } else {
        status = 404;
        body = { error: 'Nicht gefunden' };
      }
    }

    return new Response(JSON.stringify(body), {
      status,
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
    });
  });
  vi.stubGlobal('fetch', fetchMock);
  return { fetchMock, getStacks: () => stacks };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(useAuth).mockReturnValue(authValue());
  vi.mocked(reportProductLink).mockResolvedValue(undefined);
  mockWorkspaceFetch();
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  window.localStorage.clear();
  window.sessionStorage.clear();
});

describe('StackWorkspace dosage guideline helpers', () => {
  it('selects active tested study amounts and describes them as context', () => {
    const guidelines: DosageGuideline[] = [
      {
        id: 1,
        ingredient_id: 42,
        source: 'DGE',
        source_title: 'DGE Referenzwert',
        population: 'adult',
        dose_max: 1000,
        unit: 'mg',
        is_default: 1,
        amount_type: 'reference_value',
        stack_visible: 1,
      },
      {
        id: 2,
        ingredient_id: 42,
        source: 'study',
        source_title: 'Jackson et al. Calcium Study',
        population: 'adult',
        dose_max: 1200,
        unit: 'mg',
        is_default: 0,
        amount_type: 'tested_amount',
        stack_role: 'not_in_stack',
        stage4_status: 'active',
        stack_visible: 0,
        notes: 'Getestete Menge aus Studienkontext, nicht als operative Empfehlung.',
      },
      {
        id: 3,
        ingredient_id: 42,
        source: 'practice',
        source_title: 'Praxiswert',
        population: 'adult',
        dose_max: 800,
        unit: 'mg',
        is_default: 0,
      },
    ];

    const selected = selectStudyGuideline(guidelines, guidelines[0]);

    expect(selected?.id).toBe(2);
    expect(describeStudyGuidelineContext(selected)).toBe(
      'Jackson et al. Calcium Study: Getestete Menge aus Studienkontext, nicht als operative Empfehlung.',
    );
  });

  it('keeps study source context separate from the observed effect', () => {
    const guideline: DosageGuideline = {
      id: 4,
      ingredient_id: 32,
      source: 'study',
      source_title: 'AREDS-Mischung im AMD-Kontext',
      population: 'adult',
      dose_max: 15,
      unit: 'mg',
      is_default: 0,
      amount_type: 'tested_amount',
      notes: 'Das Fortschreiten einer bestimmten Augenerkrankung wurde bei Risikopersonen gebremst.',
    };

    expect(describeStudyGuidelineEffect(guideline)).toBe(
      'Das Fortschreiten einer bestimmten Augenerkrankung wurde bei Risikopersonen gebremst.',
    );
  });

  it('keeps the add-product modal wired to the supplied template frame', () => {
    const workspaceSource = readFileSync(resolve(process.cwd(), 'src/components/StackWorkspace.tsx'), 'utf8');
    const stylesSource = readFileSync(resolve(process.cwd(), 'src/styles.css'), 'utf8');

    expect(workspaceSource).toContain('<ModalWrapper onClose={onClose} title="Produkt hinzufügen"');
    expect(workspaceSource).toContain('stage ss-add-modal-stage');
    expect(workspaceSource).toContain('modal ss-add-modal ss-add-modal-embedded');
    expect(workspaceSource).toContain('ss-dosage-panel');
    expect(workspaceSource).toContain('ss-reference-card--study');
    expect(stylesSource).toContain('--radius-modal: 26px');
    expect(stylesSource).toContain('--font: \'Poppins\', system-ui, sans-serif');
    expect(stylesSource).toContain('font-family: var(--font)');
  });

  it('creates a byte-correct multipage PDF with every product and real German WinAnsi characters', async () => {
    const products = Array.from({ length: 70 }, (_, index) => ({
      id: index + 1,
      name: `Produkt ${index + 1} für Größe und Maß`,
      price: index === 0 ? null : 12.5,
      dosage_text: `${index + 1} µg täglich`,
      timing_label: 'Morgens',
      creator_snapshot_at: '2026-08-10T09:00:00.000Z',
      creator_statement_snapshot: index === 0 ? 'Bitte morgens mit einem Glas Wasser einnehmen.' : null,
    }));
    const pdf = buildStackPdf({
      id: '1',
      name: 'Übersicht für Jörg',
      description: 'Vollständige persönliche Übersicht.',
      origin_party_name: 'Creatorin Käthe',
      products,
    }, new Date('2026-08-16T08:30:00+02:00'));
    const bytes = await new Promise<Uint8Array>((resolveBytes, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(reader.error);
      reader.onload = () => resolveBytes(new Uint8Array(reader.result as ArrayBuffer));
      reader.readAsArrayBuffer(pdf);
    });
    const binary = String.fromCharCode(...bytes);

    expect(binary.startsWith('%PDF-1.4')).toBe(true);
    expect(binary).toContain('/Encoding /WinAnsiEncoding');
    expect(binary).toContain('Produkt 70 f\u00fcr Gr\u00f6\u00dfe und Ma\u00df');
    expect(binary).toContain('Creatorin K\u00e4the');
    expect(binary).toContain('Preis nicht verf\u00fcgbar');
    expect(binary).not.toContain(`0,00 ${String.fromCharCode(0x80)}`);
    expect(binary).toContain('Stand der Creator-Empfehlung: 10.8.2026');
    expect(binary).toContain('Allgemeiner Creator-Hinweis: Bitte morgens mit einem Glas Wasser einnehmen.');
    expect((binary.match(/Allgemeiner Creator-Hinweis/g) ?? [])).toHaveLength(1);
    expect(binary).toContain('Pers\u00f6nlicher Stack-Hinweis: Vollst\u00e4ndige pers\u00f6nliche \u00dcbersicht.');
    expect(binary).not.toContain('Affiliate');
    expect(binary).toContain('Gesundheitshinweis: Diese \u00dcbersicht dient der Orientierung');
    const byteValues = Array.from(bytes);
    expect(byteValues).toContain(0xfc); // ü
    expect(byteValues).toContain(0xdf); // ß
    expect(byteValues).toContain(0xb5); // µ
    expect(byteValues).toContain(0x80); // €
    const count = Number(binary.match(/\/Count (\d+)/)?.[1] ?? 0);
    expect(count).toBeGreaterThan(1);
    expect((binary.match(/\. Produkt /g) ?? []).length).toBeGreaterThanOrEqual(70);

    const startXref = Number(binary.match(/startxref\n(\d+)/)?.[1]);
    expect(binary.slice(startXref, startXref + 4)).toBe('xref');
    const offsets = [...binary.matchAll(/^(\d{10}) 00000 n $/gm)].map((match) => Number(match[1]));
    offsets.forEach((offset, index) => expect(binary.slice(offset)).toMatch(new RegExp(`^${index + 1} 0 obj`)));
  });

  it('downloads the generated PDF as a real file instead of opening the print dialog', () => {
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
    const createObjectURL = vi.fn(() => 'blob:stack-pdf');
    const revokeObjectURL = vi.fn();
    Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: createObjectURL });
    Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: revokeObjectURL });
    const print = vi.spyOn(window, 'print').mockImplementation(() => undefined);

    downloadStackPdf({ id: '1', name: 'Morgendliche Übersicht', products: [] });
    const link = document.querySelector('a[download="morgendliche-uebersicht.pdf"]');

    expect(createObjectURL).toHaveBeenCalledWith(expect.any(Blob));
    expect(click).toHaveBeenCalledOnce();
    expect(print).not.toHaveBeenCalled();
    expect(link).toBeNull();
  });

  it('shows every saved intake time, honest plan values and one general creator context', async () => {
    mockAuthenticatedStacksFetch([{
      id: 1,
      name: 'Alltagsplan',
      description: 'Meine gespeicherte Übersicht.',
      origin_party_name: 'Creatorin Mia',
      version: 1,
      products: [
        {
          id: 11,
          product_type: 'catalog',
          stack_item_id: 111,
          version: 1,
          name: 'Morgen-und-Abend-Produkt',
          price: 30,
          quantity: 1,
          intake_interval_days: 1,
          timing: 'Morgens & Abends',
          timing_label: 'Morgens & Abends',
          servings_per_container: 30,
          container_count: 1,
          serving_size: 1,
          serving_unit: 'Kapsel',
          creator_statement_snapshot: 'So nutze ich diesen Stack in meinem Alltag.',
          creator_snapshot_at: '2026-08-10T09:00:00.000Z',
          creator_party_name: 'Creatorin Mia',
        },
        {
          id: 12,
          product_type: 'catalog',
          stack_item_id: 112,
          version: 1,
          name: 'Produkt zum Essen',
          price: null,
          product_price: null,
          quantity: 1,
          intake_interval_days: 1,
          timing: 'with_meal',
          timing_label: 'Zum Essen',
          creator_statement_snapshot: 'So nutze ich diesen Stack in meinem Alltag.',
          creator_party_name: 'Creatorin Mia',
        },
      ],
    }]);

    render(<MemoryRouter initialEntries={['/einnahmeplan']}><StackWorkspace mode="authenticated" view="routine" /></MemoryRouter>);

    expect(await screen.findByRole('heading', { name: 'Dein Einnahmeplan', level: 1 })).toBeTruthy();
    expect((await screen.findByRole('button', { name: /Alltagsplan/ })).getAttribute('aria-pressed')).toBe('true');
    expect(screen.getAllByRole('heading', { name: 'Morgen-und-Abend-Produkt', level: 3 })).toHaveLength(2);
    expect(screen.getAllByText('Die Menge ist die Gesamtmenge pro Einnahmetag. Wie sie auf die Zeitfenster verteilt wird, ist nicht gespeichert.')).toHaveLength(2);
    expect(screen.getByRole('button', { name: /Mittags/ }).getAttribute('aria-expanded')).toBe('false');
    expect(screen.getByRole('button', { name: /Flexibel/ }).getAttribute('aria-expanded')).toBe('true');
    expect(screen.getByRole('heading', { name: 'Produkt zum Essen', level: 3 })).toBeTruthy();
    expect(screen.getAllByText('30,00 € pro Monat')).toHaveLength(2);
    expect(screen.getByText('Nicht berechenbar – Packungsangaben fehlen.')).toBeTruthy();
    expect(screen.getByText('Nicht berechenbar – Preis oder Packungsangaben fehlen.')).toBeTruthy();
    expect(screen.getByText('So nutze ich diesen Stack in meinem Alltag.')).toBeTruthy();
    expect(screen.getAllByText(/Allgemeiner Creator-Hinweis:/)).toHaveLength(1);
    expect(screen.getByRole('button', { name: 'Einnahmeplan per E-Mail senden' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Drucken oder als PDF speichern' })).toBeTruthy();
  });

  it('separates the public example plan clearly from a saved private plan', async () => {
    vi.mocked(useAuth).mockReturnValue(guestAuthValue());
    render(<MemoryRouter initialEntries={['/einnahmeplan']}><StackWorkspace mode="demo" view="routine" /></MemoryRouter>);

    expect(screen.getByRole('heading', { name: 'Dein Einnahmeplan', level: 1 })).toBeTruthy();
    expect(screen.getByText(/Eine öffentliche Beispielansicht/)).toBeTruthy();
    expect(screen.getByText('Das ist eine Beispielansicht.')).toBeTruthy();
    expect(screen.getByText(/Dauerhaft gespeichert und per E-Mail versendet wird erst nach der Anmeldung/)).toBeTruthy();
    expect(await screen.findByRole('button', { name: /Basis Gesundheit/ })).toBeTruthy();
  });

  it('edits one intake time without inventing a time and keeps meal timing flexible', async () => {
    vi.mocked(getPublicIntakeTimings).mockResolvedValueOnce([
      { value: 'with_meal', label: 'Zum Essen', description: null, sort_order: 10 },
      { value: 'morning_evening', label: 'Morgens & Abends', description: null, sort_order: 20 },
    ]);
    const { fetchMock } = mockAuthenticatedStacksFetch([{
      id: 1,
      name: 'Zeitplan',
      description: '',
      version: 1,
      products: [{
        id: 21,
        product_type: 'catalog',
        stack_item_id: 121,
        version: 1,
        name: 'Zeitprodukt',
        price: 20,
        quantity: 1,
        intake_interval_days: 1,
        timing: 'with_meal',
        timing_label: 'Zum Essen',
        servings_per_container: 60,
        container_count: 1,
        serving_size: 1,
        serving_unit: 'Kapsel',
      }],
    }]);

    render(<MemoryRouter initialEntries={['/einnahmeplan']}><StackWorkspace mode="authenticated" view="routine" /></MemoryRouter>);
    fireEvent.click(await screen.findByRole('button', { name: 'Einnahmezeit bearbeiten' }));
    const timing = screen.getByLabelText('Zeitpunkt') as HTMLSelectElement;
    expect(timing.value).toBe('with_meal');
    expect(screen.getByText(/„Zum Essen“ bleibt ohne erfundene Uhrzeit/)).toBeTruthy();
    fireEvent.change(timing, { target: { value: 'morning_evening' } });
    fireEvent.click(screen.getByRole('button', { name: 'Speichern' }));

    await screen.findByText('Einnahmemenge und Rhythmus wurden gespeichert.');
    const putCall = fetchMock.mock.calls.find(([, init]) => (init as RequestInit | undefined)?.method === 'PUT');
    const payload = JSON.parse(String((putCall?.[1] as RequestInit | undefined)?.body ?? '{}')) as { product_ids?: Array<Record<string, unknown>> };
    expect(payload.product_ids?.[0]).toMatchObject({ timing: 'morning_evening' });
    expect(screen.getAllByRole('heading', { name: 'Zeitprodukt', level: 3 })).toHaveLength(2);
  });

  it('confirms the account address, content and privacy consequence before sending', async () => {
    const { fetchMock } = mockAuthenticatedStacksFetch([{
      id: 1,
      name: 'Mail-Plan',
      description: '',
      version: 1,
      products: [{ id: 31, name: 'Mail-Produkt', product_type: 'catalog', price: 10, quantity: 1, intake_interval_days: 1 }],
    }]);
    render(<MemoryRouter initialEntries={['/einnahmeplan']}><StackWorkspace mode="authenticated" view="routine" /></MemoryRouter>);

    fireEvent.click(await screen.findByRole('button', { name: 'Einnahmeplan per E-Mail senden' }));
    const dialog = screen.getByRole('dialog', { name: 'Einnahmeplan per E-Mail senden?' });
    expect(within(dialog).getByText(/Mail-Plan/)).toBeTruthy();
    expect(within(dialog).getByText(/user@test.invalid/)).toBeTruthy();
    expect(within(dialog).getByText(/E-Mail-Dienst/)).toBeTruthy();
    expect(within(dialog).getByRole('link', { name: 'Datenschutzerklärung' }).getAttribute('href')).toBe('/datenschutz');
    fireEvent.click(within(dialog).getByRole('button', { name: 'An meine Account-Adresse senden' }));

    expect(await screen.findByText(/Der Einnahmeplan „Mail-Plan“ wurde an user@test.invalid gesendet/)).toBeTruthy();
    expect(fetchMock.mock.calls.some(([input, init]) => String(input).includes('/stacks/1/email') && (init as RequestInit | undefined)?.method === 'POST')).toBe(true);
  });

  it('never turns missing or unknown timing values into jederzeit', () => {
    expect(productTimingLabel({ timing: null, timing_label: null, ingredient_timing_label: null })).toBe('Keine Angabe');
    expect(productTimingLabel({ timing: null, timing_label: null, ingredient_timing_label: 'Morgens' })).toBe('Keine Angabe');
    expect(productTimingLabel({ timing: 'UNKNOWN_TIMING', timing_label: null, ingredient_timing_label: 'Morgens' })).toBe('Keine Angabe');
    expect(productTimingLabel({ timing: 'anytime', timing_label: null, ingredient_timing_label: null })).toBe('Zeit flexibel');
  });

  it('does not present one-time or monthly totals as complete when a selected price is missing', async () => {
    mockAuthenticatedStacksFetch([{
      id: 1,
      name: 'Kostenplan',
      description: '',
      version: 1,
      products: [
        {
          id: 41,
          stack_item_id: 141,
          product_type: 'catalog',
          name: 'Produkt mit Preis',
          price: 10,
          quantity: 1,
          intake_interval_days: 1,
          servings_per_container: 30,
          container_count: 1,
        },
        {
          id: 42,
          stack_item_id: 142,
          product_type: 'catalog',
          name: 'Produkt ohne Preis',
          price: null,
          product_price: null,
          quantity: 1,
          intake_interval_days: 1,
          servings_per_container: 30,
          container_count: 1,
        },
      ],
    }]);

    render(<MemoryRouter initialEntries={['/stacks']}><StackWorkspace mode="authenticated" /></MemoryRouter>);

    expect(await screen.findByText('2 von 2 Produkten enthalten')).toBeTruthy();
    expect(screen.getByText('Packungen einmalig').parentElement?.textContent).toContain('Nicht vollständig berechenbar');
    expect(screen.getByText('Aus Nutzung pro Monat').parentElement?.textContent).toContain('Nicht vollständig berechenbar');
    expect(screen.queryByText('0,00 €')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Produkt ohne Preis aus der Kostenübersicht entfernen' }));
    await waitFor(() => expect(screen.getByText('1 von 2 Produkten enthalten')).toBeTruthy());
    expect(screen.getByText('Packungen einmalig').parentElement?.textContent).toContain('10,00 €');
    expect(screen.getByText('Aus Nutzung pro Monat').parentElement?.textContent).toContain('10,00 €');
  });

  it('keeps modal copy compact enough for the supplied template card', () => {
    const description = modalIngredientDescription({
      name: 'Vitamin A',
      description: 'Vitamin A ist ein fettlösliches Vitamin, das in zwei Hauptformen vorkommt. Retinol ist in tierischen Lebensmitteln enthalten. Beta-Carotin kommt in Pflanzen vor. Diese sehr lange Beschreibung darf das Modal nicht aufblähen.',
    });

    expect(description.length).toBeLessThanOrEqual(180);
    expect(description).toContain('Vitamin A');
  });

  it('uses readable target-group labels and deduplicates modal guideline tabs', () => {
    const guidelines: DosageGuideline[] = [
      { id: 1, ingredient_id: 1, source: 'DGE', population: 'adult_female', dose_max: 700, unit: 'µg RAE', is_default: 0 },
      { id: 2, ingredient_id: 1, source: 'DGE', population: 'adult_male', dose_max: 850, unit: 'µg RAE', is_default: 1 },
      { id: 3, ingredient_id: 1, source: 'DGE', population: 'adult_male', dose_max: 850, unit: 'µg RAE', is_default: 0 },
      { id: 4, ingredient_id: 1, source: 'DGE', population: 'pregnant', dose_max: 800, unit: 'µg RAE', is_default: 0 },
    ];

    expect(populationLabel('adult_male')).toBe('Männer');
    expect(populationLabel('adult_female')).toBe('Frauen');
    expect(modalVisibleGuidelineOptions(guidelines).map((item) => populationLabel(item.population))).toEqual([
      'Frauen',
      'Männer',
      'Schwangere',
    ]);
  });

  it('prevents the reference cards from creating a horizontal scrollbar', () => {
    const stylesSource = readFileSync(resolve(process.cwd(), 'src/styles.css'), 'utf8');

    expect(stylesSource).toContain('overflow-x: hidden');
    expect(stylesSource).toContain('grid-template-columns: minmax(0, 1fr) minmax(0, 1fr)');
    expect(stylesSource).toContain('min-width: 0');
  });

  it('consumes openSearch once, opens the search dialog and preserves every other URL parameter', async () => {
    render(
      <MemoryRouter initialEntries={['/stacks?openSearch=1&from=home']}>
        <Routes>
          <Route path="/stacks" element={<><StackWorkspace mode="demo" /><LocationProbe /></>} />
        </Routes>
      </MemoryRouter>,
    );

    const dialog = await screen.findByRole('dialog', { name: 'Produkt hinzufügen' });
    await waitFor(() => expect(screen.getByTestId('location-search').textContent).toBe('?from=home'));
    fireEvent.click(within(dialog).getByRole('button', { name: 'Schließen' }));
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Produkt hinzufügen' })).toBeNull());

    await Promise.resolve();
    expect(screen.queryByRole('dialog', { name: 'Produkt hinzufügen' })).toBeNull();
    expect(screen.getByTestId('location-search').textContent).toBe('?from=home');
  });

  it('explains locked demo actions correctly to guests and already signed-in users', async () => {
    vi.mocked(useAuth).mockReturnValue(guestAuthValue());
    const guest = render(
      <MemoryRouter initialEntries={['/demo']}>
        <StackWorkspace mode="demo" standaloneHeader />
      </MemoryRouter>,
    );

    fireEvent.click(await screen.findByRole('button', { name: 'Drucken oder als PDF speichern' }));
    fireEvent.click(screen.getByRole('button', { name: 'PDF herunterladen' }));
    expect(await screen.findByRole('dialog', { name: 'PDF kostenlos erstellen' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Kostenlos anmelden' })).toBeTruthy();
    expect(screen.getByText(/sobald du angemeldet bist/)).toBeTruthy();

    guest.unmount();
    vi.mocked(useAuth).mockReturnValue(authValue());
    render(
      <MemoryRouter initialEntries={['/demo']}>
        <StackWorkspace mode="demo" standaloneHeader />
      </MemoryRouter>,
    );

    fireEvent.click(await screen.findByRole('button', { name: 'Drucken oder als PDF speichern' }));
    fireEvent.click(screen.getByRole('button', { name: 'PDF herunterladen' }));
    expect(await screen.findByRole('dialog', { name: 'Funktion in deinen Stacks nutzen' })).toBeTruthy();
    expect(screen.getByText(/Du bist bereits angemeldet/)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Meine Stacks öffnen' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Kostenlos anmelden' })).toBeNull();
  });

  it('keeps the selected stack in the URL and restores the prior stack on browser back', async () => {
    mockAuthenticatedStacksFetch([
      { id: 1, name: 'Stack A', description: '', version: 1, products: [] },
      { id: 2, name: 'Stack B', description: '', version: 1, products: [] },
    ]);
    render(
      <MemoryRouter initialEntries={['/stacks?from=review#plan']}>
        <Routes>
          <Route path="/stacks" element={<><StackWorkspace mode="authenticated" /><LocationProbe /><BackButton /></>} />
        </Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByRole('heading', { name: 'Stack A', level: 2 })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /Stack B/ }));
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Stack B', level: 2 })).toBeTruthy());
    expect(new URLSearchParams(screen.getByTestId('location-search').textContent ?? '').get('stack')).toBe('2');
    expect(new URLSearchParams(screen.getByTestId('location-search').textContent ?? '').get('from')).toBe('review');
    expect(screen.getByTestId('location-hash').textContent).toBe('#plan');

    fireEvent.click(screen.getByRole('button', { name: 'Browser zurück' }));
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Stack A', level: 2 })).toBeTruthy());
    expect(new URLSearchParams(screen.getByTestId('location-search').textContent ?? '').get('stack')).toBeNull();
    expect(new URLSearchParams(screen.getByTestId('location-search').textContent ?? '').get('from')).toBe('review');
    expect(screen.getByTestId('location-hash').textContent).toBe('#plan');
  });

  it('uses a valid stack URL and removes only an invalid stack parameter', async () => {
    mockAuthenticatedStacksFetch([
      { id: 1, name: 'Stack A', description: '', version: 1, products: [] },
      { id: 2, name: 'Stack B', description: '', version: 1, products: [] },
    ]);
    const view = render(
      <MemoryRouter initialEntries={['/stacks?stack=2&from=mail#details']}>
        <Routes><Route path="/stacks" element={<><StackWorkspace mode="authenticated" /><LocationProbe /></>} /></Routes>
      </MemoryRouter>,
    );
    expect(await screen.findByRole('heading', { name: 'Stack B', level: 2 })).toBeTruthy();
    expect(screen.getByTestId('location-hash').textContent).toBe('#details');

    view.unmount();
    mockAuthenticatedStacksFetch([
      { id: 1, name: 'Stack A', description: '', version: 1, products: [] },
      { id: 2, name: 'Stack B', description: '', version: 1, products: [] },
    ]);
    render(
      <MemoryRouter initialEntries={['/stacks?stack=999&from=mail#details']}>
        <Routes><Route path="/stacks" element={<><StackWorkspace mode="authenticated" /><LocationProbe /></>} /></Routes>
      </MemoryRouter>,
    );
    expect(await screen.findByRole('heading', { name: 'Stack A', level: 2 })).toBeTruthy();
    await waitFor(() => expect(new URLSearchParams(screen.getByTestId('location-search').textContent ?? '').get('stack')).toBeNull());
    expect(new URLSearchParams(screen.getByTestId('location-search').textContent ?? '').get('from')).toBe('mail');
    expect(screen.getByTestId('location-hash').textContent).toBe('#details');
    expect(screen.getByText(/Dieser Stack ist nicht verfügbar/)).toBeTruthy();
  });

  it('offers a safe return to the exact saved creator draft after a stack repair', async () => {
    mockAuthenticatedStacksFetch([
      { id: 1, name: 'Stack A', description: '', version: 1, products: [] },
    ]);
    const creatorReturn = '/creator?bereich=stack&party=7&stack=1&editShare=4';
    render(
      <MemoryRouter initialEntries={[`/stacks?stack=1&creatorReturn=${encodeURIComponent(creatorReturn)}`]}>
        <Routes>
          <Route path="/stacks" element={<StackWorkspace mode="authenticated" />} />
          <Route path="/creator" element={<LocationProbe />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByText('Dein Creator-Entwurf bleibt gespeichert.')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Zur Empfehlung zurück' }));
    await waitFor(() => {
      const params = new URLSearchParams(screen.getByTestId('location-search').textContent ?? '');
      expect(params.get('bereich')).toBe('stack');
      expect(params.get('party')).toBe('7');
      expect(params.get('stack')).toBe('1');
      expect(params.get('editShare')).toBe('4');
    });
  });

  it('never renders a creator return action for an external target', async () => {
    mockAuthenticatedStacksFetch([
      { id: 1, name: 'Stack A', description: '', version: 1, products: [] },
    ]);
    render(
      <MemoryRouter initialEntries={['/stacks?stack=1&creatorReturn=https%3A%2F%2Fexample.test%2Fcreator']}>
        <StackWorkspace mode="authenticated" />
      </MemoryRouter>,
    );

    expect(await screen.findByRole('heading', { name: 'Stack A', level: 2 })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Zur Empfehlung zurück' })).toBeNull();
  });

  it('replaces an old target dose with the edited portions and recalculates interval, reach and cost', async () => {
    const { fetchMock, getStacks } = mockAuthenticatedStacksFetch([{
      id: 1,
      name: 'Magnesium-Plan',
      description: '',
      version: 1,
      products: [{
        id: 10,
        product_type: 'catalog',
        stack_item_id: 100,
        version: 1,
        name: 'Magnesium 300',
        price: 30,
        dosage_text: '400 mg täglich',
        quantity: 2,
        intake_interval_days: 1,
        servings_per_container: 30,
        container_count: 1,
        serving_size: 1,
        serving_unit: 'Portion',
        ingredients: [{ ingredient_id: 77, ingredient_name: 'Magnesium', quantity: 300, unit: 'mg', basis_quantity: 1, basis_unit: 'Portion', search_relevant: 1 }],
      }],
    }]);
    render(<MemoryRouter initialEntries={['/stacks']}><StackWorkspace mode="authenticated" /></MemoryRouter>);

    expect(await screen.findByText('400 mg täglich')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Produkt bearbeiten' }));
    const amount = screen.getByLabelText('Menge pro Einnahme (Portionen)') as HTMLInputElement;
    expect(amount.value).toBe('2');
    fireEvent.change(amount, { target: { value: '1' } });
    fireEvent.click(screen.getByRole('radio', { name: 'Eigener Abstand' }));
    fireEvent.change(screen.getByLabelText('Abstand in Tagen'), { target: { value: '2' } });
    fireEvent.click(screen.getByRole('button', { name: 'Speichern' }));

    await screen.findByText('Einnahmemenge und Rhythmus wurden gespeichert.');
    const putCall = fetchMock.mock.calls.find(([, init]) => (init as RequestInit | undefined)?.method === 'PUT');
    const payload = JSON.parse(String((putCall?.[1] as RequestInit | undefined)?.body ?? '{}')) as { product_ids?: Array<Record<string, unknown>> };
    expect(payload.product_ids?.[0]).toMatchObject({ quantity: 1, intake_interval_days: 2, dosage_text: null });
    expect((getStacks()[0].products as Array<Record<string, unknown>>)[0]).toMatchObject({ quantity: 1, intake_interval_days: 2, dosage_text: null });
    expect(screen.queryByText('400 mg täglich')).toBeNull();
    expect(screen.getByText('1 Portion')).toBeTruthy();
    expect(screen.getByText('60 Tage')).toBeTruthy();
    expect(screen.getAllByText('15,00 € pro Monat')).toHaveLength(2);
  });

  it('keeps every product, stack heading, creator and health note printable in grid and list view', async () => {
    mockAuthenticatedStacksFetch([{
      id: 1,
      name: 'Creator-Stack',
      description: 'Persönlicher Plan',
      origin_party_name: 'Creatorin Mia',
      version: 1,
      products: [
        { id: 1, name: 'Produkt Eins', price: 10, product_type: 'catalog', dosage_text: '1 Portion täglich' },
        { id: 2, name: 'Produkt Zwei', price: 20, product_type: 'catalog', dosage_text: '2 Portionen täglich' },
      ],
    }]);
    render(<MemoryRouter initialEntries={['/stacks']}><StackWorkspace mode="authenticated" /></MemoryRouter>);

    expect(await screen.findByRole('heading', { name: 'Creator-Stack', level: 2 })).toBeTruthy();
    expect(screen.getByText('Ursprünglich empfohlen von Creatorin Mia. Du kannst diesen Stack selbst anpassen.')).toBeTruthy();
    expect(screen.getByText('Produkt Eins')).toBeTruthy();
    expect(screen.getByText('Produkt Zwei')).toBeTruthy();
    expect(screen.getByText(/Gesundheitshinweis: Diese Übersicht dient der Orientierung/)).toBeTruthy();
    expect(document.querySelector('.ss-stable-product-grid')).not.toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Liste' }));
    expect(document.querySelector('.product-list-view')).not.toBeNull();
    expect(screen.getByText('Produkt Eins')).toBeTruthy();
    expect(screen.getByText('Produkt Zwei')).toBeTruthy();

    const stylesSource = readFileSync(resolve(process.cwd(), 'src/styles.css'), 'utf8');
    expect(stylesSource).not.toMatch(/\.masonry-grid,\s*\.product-list-view,/);
    expect(stylesSource).toContain('.product-list-view { display: grid !important; grid-template-columns: 1fr; gap: 5mm; }');
    expect(stylesSource).toContain('.ss-print-health-note { display: block;');
  });

  it('shows a failed link report, offers retry and confirms the successful retry', async () => {
    mockAuthenticatedStacksFetch([{
      id: 1,
      name: 'Link-Test',
      description: '',
      version: 1,
      products: [{ id: 4, name: 'Produkt mit Link', price: 10, product_type: 'catalog', shop_link: 'https://shop.example/product', click_url: 'https://app.test/api/products/4/out?context=stack' }],
    }]);
    vi.mocked(reportProductLink).mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce(undefined);
    render(<MemoryRouter initialEntries={['/stacks']}><StackWorkspace mode="authenticated" /></MemoryRouter>);

    fireEvent.click(await screen.findByRole('button', { name: 'Fehlenden oder defekten Link melden: Produkt mit Link' }));
    expect(await screen.findByText(/konnte nicht gesendet werden/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Erneut versuchen' }));
    expect(await screen.findByText(/Danke. Der Link zu „Produkt mit Link“ wurde gemeldet/)).toBeTruthy();
    expect(reportProductLink).toHaveBeenCalledTimes(2);
    expect(reportProductLink).toHaveBeenLastCalledWith(expect.objectContaining({ reason: 'invalid_link', stack_id: '1' }));
  });

  it('shows plan portions, reach and monthly cost before saving and switches to the chosen target stack URL', async () => {
    const catalogProducts = [
      {
        id: 301,
        name: 'Produkt mit 300 mg',
        price: 30,
        shop_link: 'https://shop.example/magnesium',
        servings_per_container: 30,
        container_count: 1,
        serving_size: 1,
        serving_unit: 'Portion',
        ingredients: [{ ingredient_id: 77, ingredient_name: 'Magnesium', quantity: 300, unit: 'mg', basis_quantity: 1, basis_unit: 'Portion', search_relevant: 1 }],
      },
      {
        id: 501,
        name: 'Produkt mit 500 mg',
        price: 30,
        servings_per_container: 30,
        container_count: 1,
        serving_size: 1,
        serving_unit: 'Portion',
        ingredients: [{ ingredient_id: 77, ingredient_name: 'Magnesium', quantity: 500, unit: 'mg', basis_quantity: 1, basis_unit: 'Portion', search_relevant: 1 }],
      },
    ];
    mockWorkspaceFetch(catalogProducts);
    render(
      <MemoryRouter initialEntries={['/stacks?from=compare#products']}>
        <Routes><Route path="/stacks" element={<><StackWorkspace mode="demo" /><LocationProbe /></>} /></Routes>
      </MemoryRouter>,
    );

    fireEvent.click(await screen.findByRole('button', { name: 'Neuen Stack anlegen' }));
    const addButtons = screen.getAllByRole('button', { name: 'Produkt hinzufügen' });
    fireEvent.click(addButtons[0]);
    fireEvent.change(screen.getByRole('combobox', { name: 'Wirkstoff suchen' }), { target: { value: 'Magnesium' } });
    fireEvent.mouseDown(await screen.findByRole('option', { name: /Magnesium/ }, { timeout: 1500 }));
    await screen.findByText('DGE-Referenzwert für die gesamte tägliche Zufuhr');
    expect(screen.queryByText('Wirkung')).toBeNull();
    expect(screen.queryByText('Mineralstoff für die normale Funktion von Muskeln und Nerven.')).toBeNull();
    fireEvent.change(screen.getByLabelText('Mit welcher täglichen Wirkstoffmenge möchtest du planen?'), { target: { value: '400' } });
    fireEvent.click(screen.getByRole('button', { name: 'Passende Produkte anzeigen' }));

    expect(await screen.findByText('Für deinen Plan: 2 Portionen, reicht 15 Tage, 60,00 € pro Monat')).toBeTruthy();
    expect(screen.getByText('Für deinen Plan: 1 Portion, reicht 30 Tage, 30,00 € pro Monat')).toBeTruthy();
    expect(screen.getByRole('link', { name: /Jetzt kaufen: Produkt mit 300 mg/ })).toBeTruthy();
    const targetSelect = screen.getByRole('combobox', { name: 'Für Stack' }) as HTMLSelectElement;
    const firstStackId = (targetSelect.options[0] as HTMLOptionElement).value;
    fireEvent.change(targetSelect, { target: { value: firstStackId } });
    fireEvent.click(screen.getByRole('button', { name: 'Produkt mit 300 mg zu „Basis Gesundheit“ hinzufügen' }));

    await waitFor(() => expect(new URLSearchParams(screen.getByTestId('location-search').textContent ?? '').get('stack')).toBe(firstStackId));
    expect(new URLSearchParams(screen.getByTestId('location-search').textContent ?? '').get('from')).toBe('compare');
    expect(screen.getByTestId('location-hash').textContent).toBe('#products');
    expect(screen.getByRole('heading', { name: 'Basis Gesundheit', level: 2 })).toBeTruthy();
  });

  it('labels plan values honestly when pack size or price is missing', () => {
    const planned = applyPlannedDoseToProduct({
      id: 9,
      name: 'Unvollständiges Produkt',
      price: Number.NaN,
      serving_size: 1,
      serving_unit: 'Portion',
      ingredients: [{ ingredient_id: 77, quantity: 300, unit: 'mg', basis_quantity: 1, basis_unit: 'Portion' }],
    }, { value: 400, unit: 'mg' });
    expect(planned.timing).toBeNull();
    expect(describeProductPlan(planned)).toContain('Reichweite nicht berechenbar, Monatskosten nicht berechenbar');
  });

  it('uses DGE visibly first when the account has not chosen a guideline source', async () => {
    vi.mocked(useAuth).mockReturnValue(authValue(null));
    render(
      <MemoryRouter initialEntries={['/stacks?openSearch=1']}>
        <Routes>
          <Route path="/stacks" element={<StackWorkspace mode="demo" />} />
        </Routes>
      </MemoryRouter>,
    );

    await screen.findByRole('dialog', { name: 'Produkt hinzufügen' });
    fireEvent.change(screen.getByRole('combobox', { name: 'Wirkstoff suchen' }), {
      target: { value: 'Magnesium' },
    });
    const option = await screen.findByRole('option', { name: /Magnesium/ }, { timeout: 1500 });
    fireEvent.mouseDown(option);

    await screen.findByText('DGE-Referenzwert für die gesamte tägliche Zufuhr');
    const referenceGrid = document.querySelector<HTMLElement>('.ss-reference-grid');
    expect(referenceGrid).not.toBeNull();
    expect(referenceGrid!.classList.contains('ss-reference-grid--DGE')).toBe(true);
    expect(referenceGrid!.firstElementChild?.classList.contains('ss-reference-card--dge')).toBe(true);
    expect((screen.getByLabelText('Mit welcher täglichen Wirkstoffmenge möchtest du planen?') as HTMLInputElement).value).toBe('');
    expect(screen.getByText(/Untersuchte Personengruppe: Erwachsene/)).toBeTruthy();
    expect(screen.getByText(/Dauer und untersuchte Form sind hier nicht gesondert hinterlegt/)).toBeTruthy();
    expect(screen.getByText(/Diese Menge ist keine persönliche Einnahmeempfehlung/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Passende Produkte anzeigen' }));
    expect(screen.getByRole('alert').textContent).toContain('Trage zuerst deine geplante Wirkstoffmenge ein');
    fireEvent.click(within(referenceGrid!.firstElementChild as HTMLElement).getByRole('button', { name: 'Als geplante Menge eintragen' }));
    expect((screen.getByLabelText('Mit welcher täglichen Wirkstoffmenge möchtest du planen?') as HTMLInputElement).value).toBe('10');
    expect(screen.getByText('Vergleich mit dem DGE-Referenzwert: Deine eingetragene Menge entspricht 100 %.')).toBeTruthy();
  });

  it('preserves a historical amount and validates the visible 0.1 minimum before any write', async () => {
    const { fetchMock, getStacks } = mockAuthenticatedStacksFetch([{ id: 1, name: 'Mein Plan', version: 1, products: [{ id: 10, name: 'Mein Produkt', quantity: 0.05, intake_interval_days: 1, version: 1 }] }]);
    render(<MemoryRouter><StackWorkspace mode="authenticated" /></MemoryRouter>);
    fireEvent.click(await screen.findByRole('button', { name: 'Produkt bearbeiten' }));
    const amount = screen.getByLabelText('Menge pro Einnahme (Portionen)') as HTMLInputElement;
    expect(amount.value).toBe('0.05');
    expect(amount.min).toBe('0.1');
    fireEvent.click(screen.getByRole('button', { name: 'Speichern' }));
    expect(screen.getByRole('alert').textContent).toBe('Trage mindestens 0,1 Portionen pro Einnahme ein.');
    expect(fetchMock.mock.calls.filter(([, init]) => (init as RequestInit | undefined)?.method === 'PUT')).toHaveLength(0);
    fireEvent.change(amount, { target: { value: '0.1' } });
    fireEvent.click(screen.getByRole('radio', { name: 'Wöchentlich' }));
    fireEvent.click(screen.getByRole('button', { name: 'Speichern' }));
    await screen.findByText('Einnahmemenge und Rhythmus wurden gespeichert.');
    expect((getStacks()[0].products as Array<Record<string, unknown>>)[0]).toMatchObject({ quantity: 0.1, intake_interval_days: 7 });
  });

  it('offers one export action while retaining browser printing and a separate real PDF download', async () => {
    const print = vi.spyOn(window, 'print').mockImplementation(() => undefined);
    render(<MemoryRouter><StackWorkspace mode="demo" /></MemoryRouter>);
    fireEvent.click(screen.getByRole('button', { name: 'Drucken oder als PDF speichern' }));
    expect(screen.getByRole('button', { name: 'PDF herunterladen' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Druckansicht öffnen' }));
    await waitFor(() => expect(print).toHaveBeenCalledOnce());
    expect(screen.queryByRole('dialog', { name: 'Drucken oder als PDF speichern' })).toBeNull();
  });

  it.each(['https://source.example/study?original=1', 'javascript:alert(1)'])('does not mislabel a default study as official, preserves its context, and bounds source links (%s)', async (sourceUrl) => {
    mockWorkspaceFetch([], [{ id: 2, ingredient_id: 77, source: 'study', source_title: 'Originalstudie', source_url: sourceUrl, population: 'elderly', dose_min: 5, dose_max: 20, unit: 'mg', is_default: 1, amount_type: 'tested_amount', notes: '12 Wochen; untersuchte Form laut Originalquelle.' }]);
    render(<MemoryRouter initialEntries={['/stacks?openSearch=1']}><StackWorkspace mode="demo" /></MemoryRouter>);
    fireEvent.change(await screen.findByRole('combobox', { name: 'Wirkstoff suchen' }), { target: { value: 'Magnesium' } });
    fireEvent.mouseDown(await screen.findByRole('option', { name: /Magnesium/ }));
    await screen.findByText('Kein offizieller Referenzwert verfügbar.');
    expect(screen.getByText(/Untersuchte Personengruppe: Ältere/)).toBeTruthy();
    expect(screen.getByText('12 Wochen; untersuchte Form laut Originalquelle.')).toBeTruthy();
    expect(screen.getByText(/Hinterlegter Bereich: 5–20 mg/)).toBeTruthy();
    expect((screen.getByLabelText('Mit welcher täglichen Wirkstoffmenge möchtest du planen?') as HTMLInputElement).value).toBe('');
    const source = screen.queryByRole('link', { name: 'Originalquelle zur Studie öffnen' });
    if (sourceUrl.startsWith('https:')) expect(source?.getAttribute('href')).toBe(sourceUrl);
    else expect(source).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Als geplante Menge eintragen' }));
    expect((screen.getByLabelText('Mit welcher täglichen Wirkstoffmenge möchtest du planen?') as HTMLInputElement).value).toBe('20');
    expect(screen.queryByText(/Deine eingetragene Menge entspricht/)).toBeNull();
  });

  it('explains duplicate choices and stack deletion before any write, with no imaginary groups or family control', async () => {
    const ingredientFetch = mockWorkspaceFetch().getMockImplementation()!;
    const { fetchMock, getStacks } = mockAuthenticatedStacksFetch([{ id: 1, name: 'Mein Plan', version: 1, products: [{ id: 10, name: 'Vorhandenes Produkt', quantity: 1, version: 1, ingredients: [{ ingredient_id: 77, ingredient_name: 'Magnesium' }] }] }]);
    vi.stubGlobal('fetch', vi.fn((input: RequestInfo | URL, init?: RequestInit) => String(input).includes('/ingredients/') ? ingredientFetch(input) : fetchMock(input, init)));
    render(<MemoryRouter><StackWorkspace mode="authenticated" /></MemoryRouter>);
    fireEvent.click(await screen.findByRole('button', { name: 'Produkt hinzufügen' }));
    fireEvent.change(screen.getByRole('combobox', { name: 'Wirkstoff suchen' }), { target: { value: 'Magnesium' } });
    fireEvent.mouseDown(await screen.findByRole('option', { name: /Magnesium/ }));
    const duplicate = await screen.findByRole('dialog', { name: 'Magnesium ist bereits enthalten' });
    for (const name of ['Einnahme bearbeiten', 'Produkt wechseln', 'Als zusätzliches Produkt hinzufügen', 'Nichts ändern']) expect(within(duplicate).getByRole('button', { name })).toBeTruthy();
    expect(within(duplicate).getByText('Beide Produkte bleiben im Stack. Ihre Wirkstoffmengen werden zusammengezählt.')).toBeTruthy();
    fireEvent.click(within(duplicate).getByRole('button', { name: 'Nichts ändern' }));
    fireEvent.click(within(screen.getByRole('dialog', { name: 'Produkt hinzufügen' })).getByRole('button', { name: 'Schließen' }));
    fireEvent.click(screen.getByRole('button', { name: 'In Papierkorb' }));
    expect(within(screen.getByRole('dialog', { name: 'Stack in den Papierkorb verschieben?' })).getByText(/Eigene Produkte bleiben unter „Eigene Produkte“ erhalten/)).toBeTruthy();
    expect(fetchMock.mock.calls.filter(([, init]) => (init as RequestInit | undefined)?.method)).toHaveLength(0);
    expect((getStacks()[0].products as unknown[])).toHaveLength(1);
    expect(screen.queryByText('Familienprofil')).toBeNull();
    expect(screen.queryByText('Meine Gruppen')).toBeNull();
  });
});
