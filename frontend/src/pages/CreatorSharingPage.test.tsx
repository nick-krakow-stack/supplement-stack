// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter, useLocation, useNavigate } from 'react-router-dom';
import { apiClient } from '../api/client';
import {
  createCreatorShare,
  getCreatorAccess,
  getCreatorDashboard,
  getCreatorOwnedSharePreview,
  getCreatorPortfolio,
  getCreatorShareReadiness,
  setCreatorShareArchived,
  updateCreatorShareLifecycle,
  type CreatorDashboard,
  type CreatorOwnedShare,
  type CreatorOwnedSharePreview,
  type CreatorParty,
  type CreatorPortfolioPage,
} from '../api/creatorSharing';
import { getStacks } from '../api/stacks';
import {
  readCreatorAuthorDraft,
  writeCreatorAuthorDraft,
  writeSelectedCreatorParty,
} from '../lib/creatorAuthorDraft';
import CreatorSharingPage from './CreatorSharingPage';

let currentUser = { id: 41, email: 'alex@example.test', role: 'user' as const };

vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({
    user: currentUser,
    isAdmin: false,
    loading: false,
    login: vi.fn(),
    register: vi.fn(),
    logout: vi.fn(),
    refreshUser: vi.fn(),
  }),
}));
vi.mock('../api/client', () => ({ apiClient: { get: vi.fn() } }));
vi.mock('../api/stacks', () => ({ getStacks: vi.fn() }));
vi.mock('../api/creatorSharing', () => ({
  creatorSharingEnabled: true,
  createCreatorShare: vi.fn(),
  getCreatorAccess: vi.fn(),
  getCreatorDashboard: vi.fn(),
  getCreatorOwnedSharePreview: vi.fn(),
  getCreatorPortfolio: vi.fn(),
  getCreatorShareReadiness: vi.fn(),
  setCreatorShareArchived: vi.fn(),
  updateCreatorShareLifecycle: vi.fn(),
}));

const creatorParty: CreatorParty = {
  id: 7,
  type: 'creator',
  name: 'Alex Alltag',
  slug: 'alex-alltag',
  role: 'owner',
  status: 'active',
};

const stack = { id: 10, name: 'Mein Alltag', created_at: '2026-08-07T08:00:00.000Z' };
const stackDetails = {
  stack,
  items: [{
    id: 9,
    stack_id: 10,
    stack_item_id: 90,
    product_id: 9,
    product_type: 'catalog' as const,
    name: 'Magnesium Pur',
    brand: 'Beispiel',
    image_url: '/api/r2/products/magnesium.webp',
    serving_unit: 'Kapsel',
    quantity: 1,
    unit: 'Kapsel',
    intake_interval_days: 1,
    dosage_text: '1 Kapsel',
    timing: 'evening',
    timing_label: 'Abends',
  }],
};

function ownedShare(
  id: number,
  status: CreatorOwnedShare['status'],
  type: CreatorOwnedShare['type'] = 'stack',
  overrides: Partial<CreatorOwnedShare> = {},
): CreatorOwnedShare {
  return {
    id,
    token: `token-${id}`,
    type,
    entity_id: type === 'stack' ? 10 : 90,
    source_stack_id: 10,
    source_stack_name: 'Mein Alltag',
    title: `Empfehlung ${id}`,
    published_at: '2026-08-07T08:00:00.000Z',
    created_at: 1_786_089_600,
    expires_at: status === 'expired' ? 1_786_176_000 : null,
    paused_at: status === 'paused' ? 1_786_089_700 : null,
    archived_at: null,
    supersedes_share_link_id: null,
    status,
    moderation_status: status === 'blocked' ? 'blocked' : status === 'pending' ? 'pending' : 'approved',
    moderation_reason: status === 'blocked' ? 'Bitte formuliere deinen Hinweis als persönliche Alltagserfahrung.' : null,
    moderation_target: status === 'blocked' ? 'creator_statement' : null,
    moderation_item_index: status === 'blocked' ? 0 : null,
    moderation_item_name: status === 'blocked' ? 'Magnesium Pur' : null,
    is_revoked: status === 'revoked' ? 1 : 0,
    snapshot_hash: String(id).padStart(64, '0'),
    version: id + 3,
    metrics: {
      unique_visitors: id,
      saves: id,
      previous_unique_visitors: Math.max(0, id - 1),
      previous_saves: Math.max(0, id - 1),
    },
    ...overrides,
  };
}

function ownedPreview(overrides: Partial<CreatorOwnedSharePreview> = {}): CreatorOwnedSharePreview {
  return {
    share_id: 3,
    entity_id: 90,
    source_stack_id: 10,
    source_stack_name: 'Mein Alltag',
    creator_status: 'blocked',
    snapshot_hash: '3'.repeat(64),
    version: 6,
    moderation_status: 'blocked',
    moderation_reason: 'Bitte bleibe bei deiner persönlichen Alltagserfahrung.',
    moderation_target: 'creator_statement',
    moderation_item_index: 0,
    moderation_item_name: 'Magnesium Pur',
    is_revoked: 0,
    paused_at: null,
    archived_at: null,
    expires_at: null,
    token: 'token-3',
    type: 'dose_recommendation',
    title: 'Mein Magnesium',
    creator: { id: 7, name: 'Alex Alltag', type: 'creator', slug: 'alex-alltag' },
    published_at: '2026-08-07T08:00:00.000Z',
    items: [{
      catalog_product_id: 9,
      product_name: 'Magnesium Pur',
      brand: 'Beispiel',
      image_url: '/api/r2/products/magnesium.webp',
      quantity: 1,
      unit: 'Kapsel',
      intake_interval_days: 1,
      dosage_text: '1 Kapsel',
      timing: 'evening',
      timing_label: 'Abends',
      creator_statement: 'Passt in meinen Alltag.',
    }],
    ...overrides,
  };
}

const dashboard: CreatorDashboard = {
  party: { id: 7, name: 'Alex Alltag', type: 'creator' },
  period: {
    days: 30,
    from: '2026-07-09',
    to: '2026-08-07',
    previous_from: '2026-06-09',
    previous_to: '2026-07-08',
    definitions: {
      unique_visitors: 'Erfasste Menschen mit Statistik-Zustimmung.',
      clicks: 'Produktklicks.',
      saves: 'Gespeicherte Empfehlungen.',
      imported_stacks: 'Übernommene Stacks.',
      clicked_products: 'Produkte mit Klick.',
      clicked_shops: 'Shops mit Klick.',
    },
  },
  current: { unique_visitors: 8, clicks: 7, saves: 6, imported_stacks: 5, clicked_products: 4, clicked_shops: 3 },
  previous: { unique_visitors: 4, clicks: 3, saves: 2, imported_stacks: 1, clicked_products: 1, clicked_shops: 1 },
  active_shares: 2,
  trend: [{ date: '2026-08-07', unique_visitors: 2, clicks: 1, saves: 1 }],
};

function portfolioPage(items: CreatorOwnedShare[] = [], overrides: Partial<CreatorPortfolioPage> = {}): CreatorPortfolioPage {
  return {
    party: { id: 7, name: 'Alex Alltag', type: 'creator' },
    items,
    next_cursor: null,
    has_more: false,
    metrics_period: {
      days: 30,
      from: '2026-07-09',
      to: '2026-08-07',
      previous_from: '2026-06-09',
      previous_to: '2026-07-08',
      unique_visitors_definition: 'Nur mit Statistik-Zustimmung.',
      saves_definition: 'Erfolgreich gespeicherte Empfehlungen.',
    },
    ...overrides,
  };
}

function LocationProbe() {
  const location = useLocation();
  const navigate = useNavigate();
  return <><output data-testid="creator-location">{location.pathname}{location.search}</output><button type="button" onClick={() => navigate(-1)}>Test zurück</button><button type="button" onClick={() => navigate(1)}>Test vor</button><button type="button" onClick={() => navigate('/creator')}>Test Creator-Start</button></>;
}

function renderCreator(entry = '/creator') {
  render(<MemoryRouter initialEntries={[entry]}><CreatorSharingPage /><LocationProbe /></MemoryRouter>);
}

describe('CreatorSharingPage', () => {
  beforeEach(() => {
    currentUser = { id: 41, email: 'alex@example.test', role: 'user' };
    window.sessionStorage.clear();
    Object.defineProperty(window, 'requestAnimationFrame', {
      configurable: true,
      value: (callback: FrameRequestCallback) => window.setTimeout(() => callback(performance.now()), 0),
    });
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: vi.fn().mockResolvedValue(undefined) },
    });
    Object.defineProperty(navigator, 'share', { configurable: true, value: undefined });
    vi.mocked(getCreatorAccess).mockResolvedValue({ access_state: 'active', parties: [creatorParty] });
    vi.mocked(getStacks).mockResolvedValue({ stacks: [stack] });
    vi.mocked(apiClient.get).mockResolvedValue({ data: stackDetails });
    vi.mocked(getCreatorShareReadiness).mockResolvedValue({
      ready: true,
      shareable_stack_item_ids: [90],
      unshareable_products: [],
      products: [{ stack_item_id: 90, product_name: 'Magnesium Pur', shareable: true, reason_code: null, repair_kind: null }],
    });
    vi.mocked(getCreatorPortfolio).mockResolvedValue(portfolioPage());
    vi.mocked(getCreatorDashboard).mockResolvedValue(dashboard);
    vi.mocked(getCreatorOwnedSharePreview).mockResolvedValue(ownedPreview());
    vi.mocked(createCreatorShare).mockResolvedValue({
      id: 11,
      token: 'new-token',
      moderation_status: 'pending',
      snapshot_hash: 'a'.repeat(64),
      version: 1,
    });
    vi.mocked(updateCreatorShareLifecycle).mockResolvedValue({
      ok: true,
      status: 'paused',
      version: 2,
      paused_at: 1,
      expires_at: null,
      is_revoked: 0,
    });
    vi.mocked(setCreatorShareArchived).mockResolvedValue({ ok: true, version: 2, archived_at: 1 });
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('separates access failure from missing access and restores focus after retry', async () => {
    vi.mocked(getCreatorAccess)
      .mockRejectedValueOnce(new Error('network'))
      .mockResolvedValueOnce({ access_state: 'active', parties: [creatorParty] });
    renderCreator();

    expect((await screen.findByRole('alert')).textContent).toContain('Creator-Bereich konnte nicht geladen werden');
    fireEvent.click(screen.getByRole('button', { name: 'Erneut versuchen' }));
    const heading = await screen.findByRole('heading', { name: 'Empfehlungen teilen' });
    await waitFor(() => expect(document.activeElement).toBe(heading));
    expect(screen.queryByText(/Deinem Konto ist noch keine/)).toBeNull();
  });

  it('uses semantic keyboard-focusable tabs and mirrors back/forward navigation in URL and selected view', async () => {
    writeCreatorAuthorDraft({
      user_id: 41,
      party_id: 7,
      view: 'stack',
      stack_id: 10,
      stack_item_id: null,
      source_share_id: null,
      title: 'Gespeicherter Stack-Entwurf',
      statements: { '90': 'Hinweis für den ganzen Stack.' },
      source_share_guard: null,
    });
    writeCreatorAuthorDraft({
      user_id: 41,
      party_id: 7,
      view: 'product',
      stack_id: 10,
      stack_item_id: 90,
      source_share_id: null,
      title: 'Gespeicherter Produkt-Entwurf',
      statements: { '90': 'Hinweis nur für das Produkt.' },
      source_share_guard: null,
    });
    renderCreator('/creator?bereich=stack&party=7');
    const stackTab = await screen.findByRole('tab', { name: /Ganzen Stack teilen/ });
    expect(await screen.findByDisplayValue('Gespeicherter Stack-Entwurf')).toBeTruthy();
    expect(stackTab.getAttribute('aria-selected')).toBe('true');

    screen.getByRole('tab', { name: /Ein Produkt empfehlen/ }).focus();
    fireEvent.click(screen.getByRole('tab', { name: /Ein Produkt empfehlen/ }));
    await waitFor(() => expect(screen.getByTestId('creator-location').textContent).toContain('bereich=product'));
    await waitFor(() => expect(screen.getByRole('tab', { name: /Ein Produkt empfehlen/ }).getAttribute('aria-selected')).toBe('true'));
    expect((screen.getByRole('tab', { name: /Ein Produkt empfehlen/ }) as HTMLButtonElement).tabIndex).toBe(0);
    expect(await screen.findByDisplayValue('Gespeicherter Produkt-Entwurf')).toBeTruthy();

    fireEvent.click(screen.getByRole('tab', { name: /Meine Empfehlungen/ }));
    await waitFor(() => expect(screen.getByRole('tab', { name: /Meine Empfehlungen/ }).getAttribute('aria-selected')).toBe('true'));
    fireEvent.click(screen.getByRole('button', { name: 'Test zurück' }));
    await waitFor(() => expect(screen.getByRole('tab', { name: /Ein Produkt empfehlen/ }).getAttribute('aria-selected')).toBe('true'));
    expect(await screen.findByDisplayValue('Gespeicherter Produkt-Entwurf')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Test zurück' }));
    await waitFor(() => expect(screen.getByRole('tab', { name: /Ganzen Stack teilen/ }).getAttribute('aria-selected')).toBe('true'));
    expect(await screen.findByDisplayValue('Gespeicherter Stack-Entwurf')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Test vor' }));
    await waitFor(() => expect(screen.getByRole('tab', { name: /Ein Produkt empfehlen/ }).getAttribute('aria-selected')).toBe('true'));
    expect(await screen.findByDisplayValue('Gespeicherter Produkt-Entwurf')).toBeTruthy();
  });

  it('binds source-share drafts to history so back restores the exact earlier blocked recommendation', async () => {
    vi.mocked(getCreatorPortfolio).mockResolvedValue(portfolioPage([
      ownedShare(3, 'blocked', 'dose_recommendation'),
      ownedShare(4, 'blocked', 'dose_recommendation'),
    ]));
    vi.mocked(getCreatorOwnedSharePreview).mockImplementation(async (id) => ownedPreview({
      share_id: id,
      title: id === 3 ? 'Entwurf aus Quelle A' : 'Entwurf aus Quelle B',
      snapshot_hash: String(id).repeat(64),
      version: id + 10,
    }));
    renderCreator('/creator?bereich=portfolio&party=7');

    let actions = await screen.findAllByRole('button', { name: 'Überarbeiten und erneut senden' });
    fireEvent.click(actions[0]);
    expect(await screen.findByDisplayValue('Entwurf aus Quelle A')).toBeTruthy();
    await waitFor(() => expect(screen.getByTestId('creator-location').textContent).toContain('sourceShare=3'));

    fireEvent.click(screen.getByRole('tab', { name: /Meine Empfehlungen/ }));
    await waitFor(() => expect(screen.getByRole('tab', { name: /Meine Empfehlungen/ }).getAttribute('aria-selected')).toBe('true'));
    actions = await screen.findAllByRole('button', { name: 'Überarbeiten und erneut senden' });
    fireEvent.click(actions[1]);
    expect(await screen.findByDisplayValue('Entwurf aus Quelle B')).toBeTruthy();
    await waitFor(() => expect(screen.getByTestId('creator-location').textContent).toContain('sourceShare=4'));

    fireEvent.click(screen.getByRole('button', { name: 'Test zurück' }));
    await waitFor(() => expect(screen.getByRole('tab', { name: /Meine Empfehlungen/ }).getAttribute('aria-selected')).toBe('true'));
    fireEvent.click(screen.getByRole('button', { name: 'Test zurück' }));

    expect(await screen.findByDisplayValue('Entwurf aus Quelle A')).toBeTruthy();
    expect(screen.queryByDisplayValue('Entwurf aus Quelle B')).toBeNull();
    expect(screen.getByTestId('creator-location').textContent).toContain('sourceShare=3');
  });

  it('restores exact product drafts on direct dropdown changes and starts an empty target without overwriting either draft', async () => {
    const secondItem = { ...stackDetails.items[0], id: 10, stack_item_id: 91, product_id: 10, name: 'Zink Pur' };
    const thirdItem = { ...stackDetails.items[0], id: 11, stack_item_id: 92, product_id: 11, name: 'Vitamin C Pur' };
    vi.mocked(apiClient.get).mockResolvedValue({ data: { stack, items: [...stackDetails.items, secondItem, thirdItem] } });
    vi.mocked(getCreatorShareReadiness).mockResolvedValue({
      ready: true,
      shareable_stack_item_ids: [90, 91, 92],
      unshareable_products: [],
      products: [90, 91, 92].map((stackItemId) => ({
        stack_item_id: stackItemId,
        product_name: stackItemId === 90 ? 'Magnesium Pur' : stackItemId === 91 ? 'Zink Pur' : 'Vitamin C Pur',
        shareable: true,
        reason_code: null,
        repair_kind: null,
      })),
    });
    const scopeA = { user_id: 41, party_id: 7, view: 'product' as const, stack_id: 10, stack_item_id: 90, source_share_id: null };
    const scopeB = { ...scopeA, stack_item_id: 91 };
    writeCreatorAuthorDraft({ ...scopeA, title: 'Produktentwurf A', statements: { '90': 'Hinweis A' }, source_share_guard: null });
    writeCreatorAuthorDraft({ ...scopeB, title: 'Produktentwurf B', statements: { '91': 'Hinweis B' }, source_share_guard: null });
    renderCreator('/creator?bereich=product&party=7&stack=10&product=90');

    expect(await screen.findByDisplayValue('Produktentwurf A')).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Welches Produkt möchtest du empfehlen?'), { target: { value: '91' } });
    expect(await screen.findByDisplayValue('Produktentwurf B')).toBeTruthy();
    expect(readCreatorAuthorDraft(scopeA)?.title).toBe('Produktentwurf A');
    expect(readCreatorAuthorDraft(scopeB)?.title).toBe('Produktentwurf B');

    fireEvent.change(screen.getByLabelText('Welches Produkt möchtest du empfehlen?'), { target: { value: '92' } });
    await waitFor(() => expect((screen.getByLabelText('Name der Empfehlung') as HTMLInputElement).value).toBe('Mein Alltag'));
    expect((screen.getByPlaceholderText('Zum Beispiel: Passt gut in meine Abendroutine.') as HTMLTextAreaElement).value).toBe('');
    expect(readCreatorAuthorDraft(scopeA)?.title).toBe('Produktentwurf A');
    expect(readCreatorAuthorDraft(scopeB)?.title).toBe('Produktentwurf B');
  });

  it('restores exact stack drafts on dropdown changes and does not copy one stack draft into a clean stack', async () => {
    const stackB = { ...stack, id: 11, name: 'Stack B' };
    const stackC = { ...stack, id: 12, name: 'Stack C' };
    vi.mocked(getStacks).mockResolvedValue({ stacks: [stack, stackB, stackC] });
    vi.mocked(apiClient.get).mockImplementation(async (url) => {
      const id = Number(String(url).split('/').pop());
      const selectedStack = id === 11 ? stackB : id === 12 ? stackC : stack;
      const item = { ...stackDetails.items[0], stack_id: id, stack_item_id: id * 10, id };
      return { data: { stack: selectedStack, items: [item] } };
    });
    vi.mocked(getCreatorShareReadiness).mockImplementation(async (id) => ({
      ready: true,
      shareable_stack_item_ids: [id * 10],
      unshareable_products: [],
      products: [{ stack_item_id: id * 10, product_name: `Produkt ${id}`, shareable: true, reason_code: null, repair_kind: null }],
    }));
    const scopeA = { user_id: 41, party_id: 7, view: 'stack' as const, stack_id: 10, stack_item_id: null, source_share_id: null };
    const scopeB = { ...scopeA, stack_id: 11 };
    writeCreatorAuthorDraft({ ...scopeA, title: 'Stackentwurf A', statements: { '100': 'Hinweis A' }, source_share_guard: null });
    writeCreatorAuthorDraft({ ...scopeB, title: 'Stackentwurf B', statements: { '110': 'Hinweis B' }, source_share_guard: null });
    renderCreator('/creator?bereich=stack&party=7&stack=10');

    expect(await screen.findByDisplayValue('Stackentwurf A')).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Welchen Stack möchtest du teilen?'), { target: { value: '11' } });
    expect(await screen.findByDisplayValue('Stackentwurf B')).toBeTruthy();
    expect(readCreatorAuthorDraft(scopeA)?.title).toBe('Stackentwurf A');
    expect(readCreatorAuthorDraft(scopeB)?.title).toBe('Stackentwurf B');

    fireEvent.change(screen.getByLabelText('Welchen Stack möchtest du teilen?'), { target: { value: '12' } });
    await waitFor(() => expect((screen.getByLabelText('Name der Empfehlung') as HTMLInputElement).value).toBe('Stack C'));
    expect(readCreatorAuthorDraft(scopeA)?.title).toBe('Stackentwurf A');
    expect(readCreatorAuthorDraft(scopeB)?.title).toBe('Stackentwurf B');
  });

  it('shows repair blockers only for the selected product and never calls an existing unshareable item missing', async () => {
    const ownItem = {
      ...stackDetails.items[0],
      id: 10,
      stack_item_id: 91,
      product_id: 10,
      product_type: 'user_product' as const,
      name: 'Mein eigenes Produkt',
    };
    vi.mocked(apiClient.get).mockResolvedValue({ data: { stack, items: [...stackDetails.items, ownItem] } });
    vi.mocked(getCreatorShareReadiness).mockResolvedValue({
      ready: false,
      shareable_stack_item_ids: [90],
      unshareable_products: [{ stack_item_id: 91, product_name: 'Mein eigenes Produkt' }],
      products: [
        { stack_item_id: 90, product_name: 'Magnesium Pur', shareable: true, reason_code: null, repair_kind: null },
        { stack_item_id: 91, product_name: 'Mein eigenes Produkt', shareable: false, reason_code: 'own_product_not_published', repair_kind: 'own_product' },
      ],
    });
    renderCreator('/creator?bereich=product&party=7&stack=10&product=90');

    const send = await screen.findByRole('button', { name: 'Zur Prüfung senden' });
    expect((send as HTMLButtonElement).disabled).toBe(false);
    expect(screen.queryByText('Produkt ist noch nicht freigegeben. Prüfe den Freigabestatus deines eigenen Produkts.')).toBeNull();
    expect(screen.queryByRole('link', { name: 'Eigenes Produkt und Freigabestatus prüfen' })).toBeNull();

    fireEvent.change(screen.getByLabelText('Welches Produkt möchtest du empfehlen?'), { target: { value: '91' } });
    expect(await screen.findByText('Produkt ist noch nicht freigegeben. Prüfe den Freigabestatus deines eigenen Produkts.')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Eigenes Produkt und Freigabestatus prüfen' })).toBeTruthy();
    expect((screen.getByRole('button', { name: 'Zur Prüfung senden' }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.queryByText(/ursprünglich empfohlene Produkt ist nicht mehr in diesem Stack/)).toBeNull();
    expect(screen.getByTestId('creator-location').textContent).toContain('product=91');
  });

  it('shows safe examples and counters, submits the exact guard, and makes in-app review status binding', async () => {
    renderCreator('/creator?bereich=portfolio&editShare=3');
    expect(await screen.findByDisplayValue('Mein Magnesium')).toBeTruthy();
    await waitFor(() => expect(screen.getByTestId('creator-location').textContent).toContain('bereich=product'));
    await waitFor(() => expect(screen.getAllByRole('alert').some((entry) => entry.textContent?.includes('Rückmeldung zu Persönlicher Hinweis bei Magnesium Pur'))).toBe(true));
    expect(screen.getByText(/zusammen mit dem Frühstück/)).toBeTruthy();

    const title = screen.getByLabelText('Name der Empfehlung');
    fireEvent.change(title, { target: { value: 'Mein neuer Stand' } });
    expect(screen.getByLabelText('16 von 120 Zeichen')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Zur Prüfung senden' }));

    await waitFor(() => expect(createCreatorShare).toHaveBeenCalledWith(expect.objectContaining({
      party_id: 7,
      stack_id: 10,
      type: 'dose_recommendation',
      title: 'Mein neuer Stand',
      source_share_guard: expect.objectContaining({
        share_id: 3,
        expected_version: 6,
        expected_snapshot_hash: '3'.repeat(64),
      }),
    })));
    const message = await screen.findByText(/Deine Empfehlung wird geprüft/);
    expect(message.textContent).toContain('Verbindlich ist der Status hier');
    expect(message.textContent).toContain('Wir versuchen zusätzlich');
    expect(message.textContent).not.toContain('Nach der Entscheidung erhältst du eine E-Mail');
    await waitFor(() => expect(document.activeElement).toBe(message));
  });

  it('explains readiness per product and preserves the focused creator return path', async () => {
    vi.mocked(getCreatorShareReadiness).mockResolvedValue({
      ready: false,
      shareable_stack_item_ids: [],
      unshareable_products: [{ stack_item_id: 90, product_name: 'Magnesium Pur' }],
      products: [{
        stack_item_id: 90,
        product_name: 'Magnesium Pur',
        shareable: false,
        reason_code: 'intake_missing',
        repair_kind: 'stack_product',
      }],
    });
    renderCreator('/creator?bereich=stack&party=7&stack=10');

    expect(await screen.findByText('Im Stack fehlt die Angabe, wie oft das Produkt genutzt wird.')).toBeTruthy();
    const link = screen.getByRole('link', { name: 'Dieses Produkt im Stack reparieren' });
    const href = link.getAttribute('href') ?? '';
    expect(href).toContain('/stacks?');
    const params = new URLSearchParams(href.split('?')[1]);
    expect(params.get('stack')).toBe('10');
    expect(params.get('creatorReturn')).toContain('/creator?bereich=stack');
    expect(params.get('creatorReturn')).toContain('repair=90');
    expect(screen.queryByText(/Affiliate/i)).toBeNull();
    expect(screen.queryByText(/Familienprofil|Kategorie auswählen/)).toBeNull();
  });

  it.each([
    ['shop_link_missing', 'Shop-Link fehlt. Für dieses Produkt ist noch kein nutzbarer Shop-Link hinterlegt.'],
    ['not_approved', 'Produkt ist noch nicht freigegeben.'],
  ])('names the actual per-product blocker %s', async (reason, copy) => {
    vi.mocked(getCreatorShareReadiness).mockResolvedValue({
      ready: false, shareable_stack_item_ids: [],
      unshareable_products: [{ stack_item_id: 90, product_name: 'Magnesium Pur' }],
      products: [{ stack_item_id: 90, product_name: 'Magnesium Pur', shareable: false, reason_code: reason, repair_kind: 'stack_product' }],
    });
    renderCreator('/creator?bereich=stack&party=7&stack=10');
    const explanation = await screen.findByText(copy);
    expect(explanation.closest('article')?.textContent).toContain('Magnesium Pur');
    expect((screen.getByRole('button', { name: 'Zur Prüfung senden' }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('names the pending action as submission for review, not publication or sending mail', async () => {
    vi.mocked(createCreatorShare).mockReturnValue(new Promise(() => {}));
    renderCreator('/creator?bereich=stack&party=7&stack=10');
    const button = await screen.findByRole('button', { name: 'Zur Prüfung senden' });
    await waitFor(() => expect((button as HTMLButtonElement).disabled).toBe(false));
    fireEvent.click(button);
    expect(await screen.findByRole('button', { name: 'Wird zur Prüfung eingereicht …' })).toBeTruthy();
    expect(createCreatorShare).toHaveBeenCalledTimes(1);
  });

  it('pluralizes actual consent-scoped visits, approved links and stack transfers centrally', async () => {
    vi.mocked(getCreatorDashboard).mockResolvedValue({ ...dashboard, active_shares: 1 });
    vi.mocked(getCreatorPortfolio).mockResolvedValue(portfolioPage([ownedShare(1, 'approved'), ownedShare(2, 'approved')]));
    renderCreator('/creator?bereich=portfolio&party=7');
    expect(await screen.findByText('1 freigegebener Link')).toBeTruthy();
    expect(screen.getByText('In einen Stack übernommen')).toBeTruthy();
    const first = screen.getByRole('heading', { name: 'Empfehlung 1' }).closest('article') as HTMLElement;
    const second = screen.getByRole('heading', { name: 'Empfehlung 2' }).closest('article') as HTMLElement;
    expect(within(first).getByText('1 erfasster eindeutiger Besuch (mit Statistik-Zustimmung)')).toBeTruthy();
    expect(within(first).getByText('1 Übernahme')).toBeTruthy();
    expect(within(second).getByText('2 erfasste eindeutige Besuche (mit Statistik-Zustimmung)')).toBeTruthy();
    expect(within(second).getByText('2 Übernahmen')).toBeTruthy();
    expect(screen.queryByText(/-mal gespeichert/)).toBeNull();
  });

  it('sends an unpublished own product to its real management page and saves the exact creator draft first', async () => {
    vi.mocked(getCreatorShareReadiness).mockResolvedValue({
      ready: false,
      shareable_stack_item_ids: [],
      unshareable_products: [{ stack_item_id: 90, product_name: 'Mein Magnesium' }],
      products: [{
        stack_item_id: 90,
        product_name: 'Mein Magnesium',
        shareable: false,
        reason_code: 'own_product_not_published',
        repair_kind: 'own_product',
      }],
    });
    renderCreator('/creator?bereich=stack&party=7&stack=10');

    const title = await screen.findByLabelText('Name der Empfehlung');
    fireEvent.change(title, { target: { value: 'Mein sicher gespeicherter Entwurf' } });
    const link = screen.getByRole('link', { name: 'Eigenes Produkt und Freigabestatus prüfen' });
    const href = link.getAttribute('href') ?? '';
    expect(href).toContain('/my-products?');
    const params = new URLSearchParams(href.split('?')[1]);
    expect(params.get('creatorReturn')).toContain('/creator?bereich=stack');
    expect(params.get('creatorReturn')).toContain('repair=90');
    fireEvent.click(link);

    expect(readCreatorAuthorDraft({
      user_id: 41,
      party_id: 7,
      view: 'stack',
      stack_id: 10,
      stack_item_id: null,
      source_share_id: null,
    })?.title).toBe('Mein sicher gespeicherter Entwurf');
    expect(screen.getByTestId('creator-location').textContent).toContain('/my-products?creatorReturn=');
  });

  it('shows honest consent-scoped metrics, status meaning, dates, pagination and server filters', async () => {
    const pending = ownedShare(1, 'pending');
    const paused = ownedShare(2, 'paused');
    vi.mocked(getCreatorPortfolio)
      .mockResolvedValueOnce(portfolioPage([pending, paused], { has_more: true, next_cursor: 'next-2' }))
      .mockResolvedValueOnce(portfolioPage([ownedShare(3, 'approved')]));
    renderCreator('/creator?bereich=portfolio&party=7');

    expect(await screen.findAllByText(/Erfasste eindeutige Besuche \(mit Statistik-Zustimmung\)/i)).not.toHaveLength(0);
    expect(screen.getAllByText(/Besuche ohne Statistik-Zustimmung sind nicht enthalten/i)).not.toHaveLength(0);
    expect(screen.getByText(/Du musst jetzt nichts tun/)).toBeTruthy();
    expect(screen.getByText(/vorübergehend nicht erreichbar/)).toBeTruthy();
    expect(screen.getAllByText('Kein Ablaufdatum')).toHaveLength(2);
    expect(screen.queryByText(/^Aufrufe:?$/)).toBeNull();

    const pausedCard = screen.getByRole('heading', { name: 'Empfehlung 2' }).closest('article') as HTMLElement;
    expect(within(pausedCard).queryByRole('link', { name: 'Per WhatsApp' })).toBeNull();
    expect((within(pausedCard).getByRole('button', { name: 'Per WhatsApp' }) as HTMLButtonElement).disabled).toBe(true);
    expect(within(pausedCard).queryByRole('link', { name: /Öffentliche Seite öffnen/ })).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Weitere Empfehlungen laden' }));
    await waitFor(() => expect(getCreatorPortfolio).toHaveBeenLastCalledWith(expect.objectContaining({ cursor: 'next-2' })));
    fireEvent.change(screen.getByLabelText('Status'), { target: { value: 'blocked' } });
    await waitFor(() => expect(getCreatorPortfolio).toHaveBeenLastCalledWith(expect.objectContaining({ status: 'blocked' })));
    expect(screen.getAllByRole('status').some((entry) => entry.textContent?.includes('Statusfilter: Nicht freigegeben'))).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'Test zurück' }));
    await waitFor(() => expect((screen.getByLabelText('Status') as HTMLSelectElement).value).toBe('all'));
    await waitFor(() => expect(getCreatorPortfolio).toHaveBeenLastCalledWith(expect.objectContaining({ status: undefined })));
  });

  it('offers a focus-trapped lifecycle dialog and returns focus after Escape and success', async () => {
    vi.mocked(getCreatorPortfolio).mockResolvedValue(portfolioPage([ownedShare(2, 'approved')]));
    renderCreator('/creator?bereich=portfolio&party=7');
    const trigger = await screen.findByRole('button', { name: 'Link verwalten' });
    trigger.focus();
    fireEvent.click(trigger);

    const dialog = await screen.findByRole('dialog', { name: 'Link verwalten' });
    await waitFor(() => expect(dialog.contains(document.activeElement)).toBe(true));
    expect(within(dialog).getByLabelText('Link pausieren')).toBeTruthy();
    expect(within(dialog).getByLabelText('Ablaufdatum setzen')).toBeTruthy();
    expect(within(dialog).getByLabelText('Link dauerhaft beenden')).toBeTruthy();
    const dialogButtons = within(dialog).getAllByRole('button');
    const firstButton = dialogButtons[0];
    const lastButton = dialogButtons[dialogButtons.length - 1];
    lastButton.focus();
    fireEvent.keyDown(document, { key: 'Tab' });
    expect(document.activeElement).toBe(firstButton);
    firstButton.focus();
    fireEvent.keyDown(document, { key: 'Tab', shiftKey: true });
    expect(document.activeElement).toBe(lastButton);

    fireEvent.keyDown(document, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    await waitFor(() => expect(document.activeElement).toBe(trigger));

    trigger.focus();
    fireEvent.click(trigger);
    const reopened = await screen.findByRole('dialog', { name: 'Link verwalten' });
    fireEvent.click(within(reopened).getByRole('button', { name: 'Änderung speichern' }));
    await waitFor(() => expect(updateCreatorShareLifecycle).toHaveBeenCalledWith(
      expect.objectContaining({ id: 2, version: 5 }),
      'pause',
      undefined,
    ));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    const refreshedTrigger = await screen.findByRole('button', { name: 'Link verwalten' });
    await waitFor(() => expect(document.activeElement).toBe(refreshedTrigger));
  });

  it('falls back to the author form for an invalid moderation item index', async () => {
    vi.mocked(getCreatorOwnedSharePreview).mockResolvedValue(ownedPreview({
      moderation_target: 'product',
      moderation_item_index: 99,
      moderation_item_name: null,
      moderation_reason: 'Bitte prüfe den betroffenen Inhalt.',
    }));
    renderCreator('/creator?bereich=portfolio&party=7&editShare=3');

    await screen.findByRole('heading', { name: 'Ein Produkt empfehlen', level: 2 });
    await waitFor(() => expect(screen.getAllByRole('alert').some((entry) => entry.textContent?.includes('Bitte prüfe den betroffenen Inhalt'))).toBe(true));
    await waitFor(() => expect(document.activeElement).toBe(
      screen.getByRole('heading', { name: 'Ein Produkt empfehlen', level: 2 }),
    ));
    expect(screen.queryByText(/Produkt 100/)).toBeNull();
  });

  it('opens an archived or older mail deep-link directly and focuses the exact moderation target', async () => {
    vi.mocked(getCreatorPortfolio).mockResolvedValue(portfolioPage([], { has_more: true, next_cursor: 'older' }));
    vi.mocked(getCreatorOwnedSharePreview).mockResolvedValue(ownedPreview({
      share_id: 99,
      archived_at: 1_786_089_800,
      moderation_target: 'title',
      moderation_reason: 'Bitte wähle einen sachlichen Namen.',
      title: 'Alter archivierter Stand',
    }));
    renderCreator('/creator?bereich=portfolio&party=7&archive=active&editShare=99');

    const title = await screen.findByDisplayValue('Alter archivierter Stand');
    expect(getCreatorOwnedSharePreview).toHaveBeenCalledWith(99);
    await waitFor(() => expect(screen.getAllByRole('alert').some((entry) => entry.textContent?.includes('Bitte wähle einen sachlichen Namen'))).toBe(true));
    await waitFor(() => expect(document.activeElement).toBe(title));
  });

  it('opens an approval mail deep-link as a focused published preview instead of an edit error', async () => {
    vi.mocked(getCreatorPortfolio).mockResolvedValue(portfolioPage([]));
    vi.mocked(getCreatorOwnedSharePreview).mockResolvedValue(ownedPreview({
      share_id: 77,
      token: 'approved-token-77',
      creator_status: 'approved',
      moderation_status: 'approved',
      moderation_reason: null,
      moderation_target: null,
      moderation_item_index: null,
      moderation_item_name: null,
      title: 'Freigegebener Stand',
    }));
    renderCreator('/creator?bereich=portfolio&party=7&editShare=77');

    const statusHeading = await screen.findByRole('heading', { name: 'Freigegeben' });
    const directSection = statusHeading.closest('section') as HTMLElement;
    expect(await screen.findByText('Freigegebener Stand')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Öffentliche Seite öffnen (neuer Tab)' }).getAttribute('href')).toBe('/share/approved-token-77');
    expect(screen.queryByText(/Status dieser Empfehlung hat sich geändert/)).toBeNull();
    await waitFor(() => expect(document.activeElement).toBe(directSection));
  });

  it('keeps an approval deep-link while a remembered viewer party is active and selects the owning party', async () => {
    const viewerParty = { ...creatorParty, id: 7, name: 'Team nur ansehen', role: 'viewer' as const };
    const ownerParty = { ...creatorParty, id: 8, name: 'Alex Eigentümer', slug: 'alex-owner' };
    writeSelectedCreatorParty(41, viewerParty.id);
    vi.mocked(getCreatorAccess).mockResolvedValue({ access_state: 'active', parties: [viewerParty, ownerParty] });
    vi.mocked(getCreatorOwnedSharePreview).mockResolvedValue(ownedPreview({
      share_id: 77,
      creator_status: 'approved',
      moderation_status: 'approved',
      moderation_reason: null,
      moderation_target: null,
      moderation_item_index: null,
      moderation_item_name: null,
      creator: { id: 8, name: 'Alex Eigentümer', type: 'creator', slug: 'alex-owner' },
      title: 'Freigabe aus dem Eigentümerkonto',
    }));
    renderCreator('/creator?bereich=portfolio&editShare=77');

    expect(await screen.findByRole('heading', { name: 'Freigegeben' })).toBeTruthy();
    expect(screen.getByText('Freigabe aus dem Eigentümerkonto')).toBeTruthy();
    await waitFor(() => expect((screen.getByLabelText('Creator oder Marke wechseln') as HTMLSelectElement).value).toBe('8'));
    expect(screen.getByTestId('creator-location').textContent).toContain('party=8');
    expect(screen.getByTestId('creator-location').textContent).toContain('editShare=77');
    expect(screen.queryByText(/Du kannst die Empfehlungen ansehen, aber nicht ändern/)).toBeNull();
  });

  it('keeps a blocked deep-link while a remembered viewer party is active and prepares it for its editor party', async () => {
    const viewerParty = { ...creatorParty, id: 7, name: 'Team nur ansehen', role: 'viewer' as const };
    const editorParty = { ...creatorParty, id: 8, name: 'Redaktion', slug: 'redaktion', role: 'editor' as const };
    writeSelectedCreatorParty(41, viewerParty.id);
    vi.mocked(getCreatorAccess).mockResolvedValue({ access_state: 'active', parties: [viewerParty, editorParty] });
    vi.mocked(getCreatorOwnedSharePreview).mockResolvedValue(ownedPreview({
      share_id: 78,
      creator: { id: 8, name: 'Redaktion', type: 'creator', slug: 'redaktion' },
      title: 'Überarbeitung aus der Redaktion',
    }));
    renderCreator('/creator?bereich=portfolio&editShare=78');

    expect(await screen.findByDisplayValue('Überarbeitung aus der Redaktion')).toBeTruthy();
    await waitFor(() => expect((screen.getByLabelText('Creator oder Marke wechseln') as HTMLSelectElement).value).toBe('8'));
    expect(screen.getByTestId('creator-location').textContent).toContain('party=8');
    expect(screen.getByTestId('creator-location').textContent).toContain('sourceShare=78');
    expect(screen.getByTestId('creator-location').textContent).not.toContain('editShare=78');
    expect(screen.queryByText(/Du kannst die Empfehlungen ansehen, aber nicht ändern/)).toBeNull();
  });

  it('does not call a blocked deep-link stack missing when stack loading failed and prepares it after retry', async () => {
    vi.mocked(getStacks)
      .mockRejectedValueOnce(new Error('network'))
      .mockResolvedValueOnce({ stacks: [stack] });
    vi.mocked(getCreatorOwnedSharePreview).mockResolvedValue(ownedPreview({
      share_id: 88,
      title: 'Nach Stack-Retry geöffnet',
    }));
    renderCreator('/creator?bereich=portfolio&editShare=88');

    const retry = await screen.findByRole('button', { name: 'Stacks erneut laden' });
    expect(getCreatorOwnedSharePreview).toHaveBeenCalledWith(88);
    expect(screen.queryByText(/ursprüngliche Stack ist nicht mehr verfügbar/)).toBeNull();
    expect(screen.getByText(/Es wurde noch nichts als fehlend bewertet/)).toBeTruthy();
    fireEvent.click(retry);

    expect(await screen.findByDisplayValue('Nach Stack-Retry geöffnet')).toBeTruthy();
    await waitFor(() => expect(getStacks).toHaveBeenCalledTimes(2));
    expect(getCreatorOwnedSharePreview).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('creator-location').textContent).toContain('sourceShare=88');
    expect(screen.getByTestId('creator-location').textContent).not.toContain('editShare=88');
  });

  it('ignores a late prepare response when a newer recommendation was chosen', async () => {
    const firstShare = ownedShare(3, 'blocked', 'dose_recommendation');
    const secondShare = ownedShare(4, 'blocked', 'dose_recommendation');
    vi.mocked(getCreatorPortfolio).mockResolvedValue(portfolioPage([firstShare, secondShare]));
    let resolveFirst!: (value: CreatorOwnedSharePreview) => void;
    let resolveSecond!: (value: CreatorOwnedSharePreview) => void;
    const first = new Promise<CreatorOwnedSharePreview>((resolve) => { resolveFirst = resolve; });
    const second = new Promise<CreatorOwnedSharePreview>((resolve) => { resolveSecond = resolve; });
    vi.mocked(getCreatorOwnedSharePreview).mockImplementation((id) => id === 3 ? first : second);
    renderCreator('/creator?bereich=portfolio&party=7');

    const cards = await screen.findAllByRole('button', { name: 'Überarbeiten und erneut senden' });
    fireEvent.click(cards[0]);
    fireEvent.click(cards[1]);
    await act(async () => { resolveSecond(ownedPreview({ share_id: 4, title: 'Neuer gewählter Entwurf' })); });
    expect(await screen.findByDisplayValue('Neuer gewählter Entwurf')).toBeTruthy();
    await act(async () => { resolveFirst(ownedPreview({ share_id: 3, title: 'Später falscher Entwurf' })); });
    await waitFor(() => expect(screen.queryByDisplayValue('Später falscher Entwurf')).toBeNull());
    expect(screen.getByDisplayValue('Neuer gewählter Entwurf')).toBeTruthy();
  });

  it('keeps viewers in a read-only portfolio and never renders product-specific affiliate UI', async () => {
    vi.mocked(getCreatorAccess).mockResolvedValue({
      access_state: 'active',
      parties: [{ ...creatorParty, role: 'viewer' }],
    });
    vi.mocked(getCreatorPortfolio).mockResolvedValue(portfolioPage([ownedShare(2, 'approved'), ownedShare(3, 'blocked')]));
    renderCreator('/creator');

    expect(await screen.findByText(/Du kannst die Empfehlungen ansehen, aber nicht ändern/)).toBeTruthy();
    await waitFor(() => expect(screen.getByTestId('creator-location').textContent).toContain('bereich=portfolio'));
    expect(screen.getByRole('tab', { name: /Meine Empfehlungen/ }).getAttribute('aria-selected')).toBe('true');
    expect((screen.getByRole('tab', { name: /Ganzen Stack teilen/ }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.queryByRole('heading', { name: 'Ganzen Stack teilen', level: 2 })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Zur Prüfung senden' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Test Creator-Start' }));
    await waitFor(() => expect(screen.getByTestId('creator-location').textContent).toContain('bereich=portfolio'));
    expect(screen.getByRole('tab', { name: /Meine Empfehlungen/ }).getAttribute('aria-selected')).toBe('true');
    expect(screen.queryByRole('heading', { name: 'Ganzen Stack teilen', level: 2 })).toBeNull();
    expect(screen.getAllByRole('button', { name: 'Vorschau ansehen' })).toHaveLength(2);
    expect(screen.queryByRole('button', { name: 'Link verwalten' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Archivieren' })).toBeNull();
    expect(screen.queryByText(/Affiliate/i)).toBeNull();
  });

  it('falls back to a selected visible URL when clipboard and native sharing are unavailable', async () => {
    vi.mocked(getCreatorPortfolio).mockResolvedValue(portfolioPage([ownedShare(2, 'approved')]));
    vi.mocked(navigator.clipboard.writeText).mockRejectedValueOnce(new Error('denied'));
    renderCreator('/creator?bereich=portfolio&party=7');

    const urlInput = await screen.findByLabelText('Öffentliche URL für Empfehlung 2');
    fireEvent.click(screen.getByRole('button', { name: 'Link kopieren' }));
    await waitFor(() => expect(document.activeElement).toBe(urlInput));
    expect(screen.getByRole('alert').textContent).toContain('manuell');
    fireEvent.click(screen.getByRole('button', { name: 'Teilen' }));
    await waitFor(() => expect(document.activeElement).toBe(urlInput));
    expect(screen.getByRole('link', { name: 'Per WhatsApp' }).getAttribute('href')).toContain('wa.me');
    expect(screen.getByRole('link', { name: 'Per E-Mail' }).getAttribute('href')).toContain('mailto:');
    expect(screen.getByRole('link', { name: /Öffentliche Seite öffnen/ }).getAttribute('target')).toBe('_blank');
  });
});
