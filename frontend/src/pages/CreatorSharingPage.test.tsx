// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { apiClient } from '../api/client';
import {
  createCreatorShare,
  getCreatorDashboard,
  getCreatorOwnedSharePreview,
  getCreatorOwnedShares,
  getCreatorParties,
  getCreatorShareReadiness,
  revokeCreatorShare,
  type CreatorOwnedShare,
  type CreatorOwnedSharePreview,
} from '../api/creatorSharing';
import { getStacks } from '../api/stacks';
import CreatorSharingPage from './CreatorSharingPage';

vi.mock('../api/client', () => ({ apiClient: { get: vi.fn() } }));
vi.mock('../api/stacks', () => ({ getStacks: vi.fn() }));
vi.mock('../api/creatorSharing', () => ({
  creatorSharingEnabled: true,
  createCreatorShare: vi.fn(),
  getCreatorDashboard: vi.fn(),
  getCreatorOwnedSharePreview: vi.fn(),
  getCreatorOwnedShares: vi.fn(),
  getCreatorParties: vi.fn(),
  getCreatorShareReadiness: vi.fn(),
  revokeCreatorShare: vi.fn(),
}));

const creatorParty = {
  id: 7,
  type: 'creator' as const,
  name: 'Alex Alltag',
  slug: 'alex-alltag',
  role: 'owner' as const,
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
    serving_unit: 'Kapsel',
    quantity: 1,
    unit: 'Kapsel',
    intake_interval_days: 1,
    dosage_text: '1 Kapsel',
    timing: 'abends',
    category_name: 'Abend',
  }],
};

const preview: CreatorOwnedSharePreview = {
  share_id: 1,
  creator_status: 'approved',
  snapshot_hash: '1'.repeat(64),
  moderation_status: 'approved',
  is_revoked: 0,
  expires_at: null,
  token: 'token-1',
  type: 'dose_recommendation',
  title: 'Mein Magnesium',
  creator: { id: 7, name: 'Alex Alltag', type: 'creator' },
  published_at: '2026-08-07T08:00:00.000Z',
  disclosure: 'Einige Produktlinks sind Affiliate-Links.',
  items: [{
    catalog_product_id: 9,
    product_name: 'Magnesium Pur',
    brand: 'Beispiel',
    quantity: 1,
    unit: 'Kapsel',
    intake_interval_days: 1,
    dosage_text: '1 Kapsel',
    timing: 'abends',
    creator_statement: 'Passt in meinen Alltag.',
    category_name: 'Abend',
    has_affiliate_attribution: false,
  }],
};

function ownedShare(id: number, status: CreatorOwnedShare['status'], type: CreatorOwnedShare['type'] = 'stack'): CreatorOwnedShare {
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
    expires_at: status === 'expired' ? 1 : null,
    status,
    moderation_status: status === 'blocked' ? 'blocked' : status === 'pending' ? 'pending' : 'approved',
    is_revoked: status === 'revoked' ? 1 : 0,
    snapshot_hash: String(id).padStart(64, '0'),
    views: id,
    saves: id,
  };
}

describe('CreatorSharingPage', () => {
  beforeEach(() => {
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: vi.fn().mockResolvedValue(undefined) },
    });
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    vi.mocked(getStacks).mockResolvedValue({ stacks: [stack] });
    vi.mocked(apiClient.get).mockResolvedValue({ data: stackDetails });
    vi.mocked(getCreatorOwnedShares).mockResolvedValue([]);
    vi.mocked(getCreatorShareReadiness).mockResolvedValue({
      ready: true,
      shareable_stack_item_ids: [90],
      unshareable_products: [],
    });
    vi.mocked(getCreatorOwnedSharePreview).mockResolvedValue(preview);
    vi.mocked(revokeCreatorShare).mockResolvedValue();
    vi.mocked(getCreatorDashboard).mockResolvedValue({
      party: { id: 7, name: 'Alex Alltag', type: 'creator' },
      period_days: 30,
      clicks_total: 0,
      clicks: 0,
      previous_clicks: 0,
      imported_stacks: 0,
      clicked_products: 0,
      clicked_shops: 0,
      active_shares: 0,
      imports: 0,
    });
    vi.mocked(createCreatorShare).mockResolvedValue({ id: 1, token: 'new-token', moderation_status: 'pending' });
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('replaces the former dead end with a clear explanation and route back', async () => {
    vi.mocked(getCreatorParties).mockResolvedValue([]);

    render(<MemoryRouter><CreatorSharingPage /></MemoryRouter>);

    expect(await screen.findByRole('heading', { name: 'Creator-Bereich nicht freigeschaltet' })).toBeTruthy();
    expect(screen.getByText(/nur für freigeschaltete Creator und Marken/)).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Zu meinen Stacks' }).getAttribute('href')).toBe('/stacks');
    expect(screen.queryByText('Deinem Konto ist noch keine')).toBeNull();
  });

  it('offers the three clear creator tasks and uses the shared recommendation preview', async () => {
    vi.mocked(getCreatorParties).mockResolvedValue([creatorParty]);

    render(<MemoryRouter><CreatorSharingPage /></MemoryRouter>);

    expect(await screen.findByRole('button', { name: /Ganzen Stack teilen/ })).toBeTruthy();
    expect(screen.getByRole('button', { name: /Ein Produkt empfehlen/ })).toBeTruthy();
    expect(screen.getByRole('button', { name: /Meine Empfehlungen/ })).toBeTruthy();
    await waitFor(() => expect(screen.getByLabelText('Welchen Stack möchtest du teilen?')).toBeTruthy());
    expect(screen.getByLabelText('Name der Empfehlung')).toBeTruthy();
    expect(await screen.findByText('So sehen andere deine Empfehlung')).toBeTruthy();
    expect(screen.getByText('Empfohlen von Alex Alltag')).toBeTruthy();
    expect(screen.getByText(/Menge laut Empfehlung:/).parentElement?.textContent).toContain('1 Kapsel');
    expect(screen.queryByText(/Affiliate-Hinweis:/)).toBeNull();
    expect(screen.queryByText(/unveränderlichen Share-Snapshot/)).toBeNull();
    expect(screen.queryByText(/Zur Moderation einreichen/)).toBeNull();
  });

  it('submits understandable creator fields and explains where the link will appear', async () => {
    vi.mocked(getCreatorParties).mockResolvedValue([creatorParty]);

    render(<MemoryRouter><CreatorSharingPage /></MemoryRouter>);

    const submit = await screen.findByRole('button', { name: 'Zur Prüfung senden' });
    fireEvent.change(screen.getByLabelText('Name der Empfehlung'), { target: { value: 'Mein Magnesium' } });
    fireEvent.click(submit);

    await waitFor(() => expect(createCreatorShare).toHaveBeenCalledWith(expect.objectContaining({
      party_id: 7,
      stack_id: 10,
      type: 'stack',
      title: 'Mein Magnesium',
    })));
    expect(await screen.findByText(/unter „Meine Empfehlungen“ kopieren/)).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Meine Empfehlungen' })).toBeTruthy();
  });

  it('shows a separate access error with retry instead of claiming the account is not enabled', async () => {
    vi.mocked(getCreatorParties)
      .mockRejectedValueOnce(new Error('network'))
      .mockResolvedValueOnce([creatorParty]);

    render(<MemoryRouter><CreatorSharingPage /></MemoryRouter>);

    expect(await screen.findByRole('heading', { name: 'Creator-Bereich konnte nicht geladen werden' })).toBeTruthy();
    expect(screen.queryByText('Creator-Bereich nicht freigeschaltet')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Erneut versuchen' }));
    expect(await screen.findByRole('heading', { name: 'Empfehlungen teilen' })).toBeTruthy();
  });

  it('shows every status, keeps public link actions approved-only and refreshes both list and dashboard after ending a link', async () => {
    vi.mocked(getCreatorParties).mockResolvedValue([creatorParty]);
    const shares = [
      ownedShare(1, 'pending'),
      ownedShare(2, 'approved'),
      ownedShare(3, 'blocked'),
      ownedShare(4, 'revoked'),
      ownedShare(5, 'expired'),
    ];
    vi.mocked(getCreatorOwnedShares).mockResolvedValue(shares);
    vi.mocked(getCreatorOwnedSharePreview).mockImplementation(async (id) => ({
      ...preview,
      share_id: id,
      title: `Empfehlung ${id}`,
      creator_status: shares.find((share) => share.id === id)?.status ?? 'pending',
    }));

    render(<MemoryRouter><CreatorSharingPage /></MemoryRouter>);
    fireEvent.click(await screen.findByRole('button', { name: /Meine Empfehlungen/ }));

    for (const label of ['Wird geprüft', 'Freigegeben', 'Nicht freigegeben', 'Von dir beendet', 'Abgelaufen']) {
      expect(await screen.findByText(label)).toBeTruthy();
    }
    expect(screen.getAllByRole('button', { name: 'Link kopieren' })).toHaveLength(1);
    expect(screen.getAllByRole('link', { name: 'Öffentliche Seite öffnen' })).toHaveLength(1);
    expect(screen.getAllByRole('button', { name: 'Link beenden' })).toHaveLength(1);
    expect(screen.getAllByRole('button', { name: 'Überarbeiten und erneut senden' })).toHaveLength(1);
    expect(screen.getAllByRole('button', { name: 'Mit aktuellem Stand neu erstellen' })).toHaveLength(2);

    for (const share of shares) {
      const card = screen.getByRole('heading', { name: share.title }).closest('article');
      expect(card).toBeTruthy();
      fireEvent.click(within(card as HTMLElement).getByRole('button', { name: 'Vorschau ansehen' }));
      await waitFor(() => expect(getCreatorOwnedSharePreview).toHaveBeenCalledWith(share.id));
      fireEvent.click(within(card as HTMLElement).getByRole('button', { name: 'Vorschau schließen' }));
    }

    fireEvent.click(screen.getByRole('button', { name: 'Link kopieren' }));
    await waitFor(() => expect(navigator.clipboard.writeText).toHaveBeenCalledWith(`${window.location.origin}/share/token-2`));
    const listCallsBefore = vi.mocked(getCreatorOwnedShares).mock.calls.length;
    const dashboardCallsBefore = vi.mocked(getCreatorDashboard).mock.calls.length;
    fireEvent.click(screen.getByRole('button', { name: 'Link beenden' }));
    await waitFor(() => expect(revokeCreatorShare).toHaveBeenCalledWith(expect.objectContaining({ id: 2 })));
    await waitFor(() => expect(vi.mocked(getCreatorOwnedShares).mock.calls.length).toBeGreaterThan(listCallsBefore));
    expect(vi.mocked(getCreatorDashboard).mock.calls.length).toBeGreaterThan(dashboardCallsBefore);
    expect(screen.getByText(/aktuell freigegebene Links/)).toBeTruthy();
  });

  it('never substitutes another product when the originally recommended stack item is gone', async () => {
    vi.mocked(getCreatorParties).mockResolvedValue([creatorParty]);
    const blocked = { ...ownedShare(3, 'blocked', 'dose_recommendation'), entity_id: 999 };
    vi.mocked(getCreatorOwnedShares).mockResolvedValue([blocked]);
    vi.mocked(getCreatorOwnedSharePreview).mockResolvedValue({
      ...preview,
      creator_status: 'blocked',
      moderation_status: 'blocked',
    });

    render(<MemoryRouter><CreatorSharingPage /></MemoryRouter>);
    fireEvent.click(await screen.findByRole('button', { name: /Meine Empfehlungen/ }));
    fireEvent.click(await screen.findByRole('button', { name: 'Überarbeiten und erneut senden' }));

    expect(await screen.findByText('Das ursprünglich empfohlene Produkt ist nicht mehr in diesem Stack. Wähle ein Produkt, bevor du die neue Empfehlung sendest.')).toBeTruthy();
    expect((screen.getByLabelText('Welches Produkt möchtest du empfehlen?') as HTMLSelectElement).value).toBe('');
    expect((screen.getByRole('button', { name: 'Zur Prüfung senden' }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('binds a resubmission to the exact source recommendation state', async () => {
    vi.mocked(getCreatorParties).mockResolvedValue([creatorParty]);
    const blocked = ownedShare(3, 'blocked', 'dose_recommendation');
    vi.mocked(getCreatorOwnedShares).mockResolvedValue([blocked]);
    vi.mocked(getCreatorOwnedSharePreview).mockResolvedValue({
      ...preview,
      share_id: 3,
      creator_status: 'blocked',
      snapshot_hash: blocked.snapshot_hash,
      moderation_status: 'blocked',
      is_revoked: 0,
      expires_at: null,
    });

    render(<MemoryRouter><CreatorSharingPage /></MemoryRouter>);
    fireEvent.click(await screen.findByRole('button', { name: /Meine Empfehlungen/ }));
    fireEvent.click(await screen.findByRole('button', { name: 'Überarbeiten und erneut senden' }));
    const submit = await screen.findByRole('button', { name: 'Zur Prüfung senden' });
    await waitFor(() => expect((submit as HTMLButtonElement).disabled).toBe(false));
    fireEvent.click(submit);

    await waitFor(() => expect(createCreatorShare).toHaveBeenCalledWith(expect.objectContaining({
      source_share_guard: {
        share_id: 3,
        expected_snapshot_hash: blocked.snapshot_hash,
        expected_status: 'blocked',
        expected_moderation_status: 'blocked',
        expected_is_revoked: 0,
        expected_expires_at: null,
      },
    })));
  });

  it('points to a fresh entry when the old stack is gone but another stack exists', async () => {
    vi.mocked(getCreatorParties).mockResolvedValue([creatorParty]);
    const blocked = { ...ownedShare(3, 'blocked'), source_stack_id: null };
    vi.mocked(getCreatorOwnedShares).mockResolvedValue([blocked]);
    vi.mocked(getCreatorOwnedSharePreview).mockResolvedValue({
      ...preview,
      creator_status: 'blocked',
      moderation_status: 'blocked',
    });

    render(<MemoryRouter><CreatorSharingPage /></MemoryRouter>);
    fireEvent.click(await screen.findByRole('button', { name: /Meine Empfehlungen/ }));
    fireEvent.click(await screen.findByRole('button', { name: 'Überarbeiten und erneut senden' }));

    expect(await screen.findByText('Der ursprüngliche Stack ist nicht mehr verfügbar. Wähle oben „Ganzen Stack teilen“ oder „Ein Produkt empfehlen“ und danach einen anderen Stack.')).toBeTruthy();
    expect(screen.queryByText('Lege zuerst einen Stack an.')).toBeNull();
  });

  it('keeps portfolio responses bound to the currently selected creator', async () => {
    const secondParty = { ...creatorParty, id: 8, name: 'Bea Bewegung', slug: 'bea-bewegung' };
    vi.mocked(getCreatorParties).mockResolvedValue([creatorParty, secondParty]);
    let resolveFirst!: (shares: CreatorOwnedShare[]) => void;
    let resolveSecond!: (shares: CreatorOwnedShare[]) => void;
    const first = new Promise<CreatorOwnedShare[]>((resolve) => { resolveFirst = resolve; });
    const second = new Promise<CreatorOwnedShare[]>((resolve) => { resolveSecond = resolve; });
    vi.mocked(getCreatorOwnedShares).mockImplementation((id) => id === 7 ? first : second);

    render(<MemoryRouter><CreatorSharingPage /></MemoryRouter>);
    const partySelect = await screen.findByLabelText('Wer teilt die Empfehlung?');
    await waitFor(() => expect(getCreatorOwnedShares).toHaveBeenCalledWith(7));
    fireEvent.change(partySelect, { target: { value: '8' } });
    await waitFor(() => expect(getCreatorOwnedShares).toHaveBeenCalledWith(8));
    resolveSecond([{ ...ownedShare(8, 'approved'), title: 'Beas Empfehlung' }]);
    fireEvent.click(screen.getByRole('button', { name: /Meine Empfehlungen/ }));
    expect(await screen.findByRole('heading', { name: 'Beas Empfehlung' })).toBeTruthy();
    resolveFirst([{ ...ownedShare(7, 'approved'), title: 'Alex Empfehlung' }]);
    await waitFor(() => expect(screen.queryByRole('heading', { name: 'Alex Empfehlung' })).toBeNull());
  });

  it('explains the next step when a stack has no shareable product and keeps technical server text hidden', async () => {
    vi.mocked(getCreatorParties).mockResolvedValue([creatorParty]);
    vi.mocked(getCreatorShareReadiness).mockResolvedValue({
      ready: false,
      shareable_stack_item_ids: [],
      unshareable_products: [{ stack_item_id: 90, product_name: 'Magnesium Pur' }],
    });

    render(<MemoryRouter><CreatorSharingPage /></MemoryRouter>);
    expect(await screen.findByText(/Dieser Stack kann noch nicht vollständig geteilt werden/)).toBeTruthy();
    expect(screen.getByText('Betroffen: Magnesium Pur')).toBeTruthy();
    expect(screen.queryByText('So sehen andere deine Empfehlung')).toBeNull();
    fireEvent.click(await screen.findByRole('button', { name: /Ein Produkt empfehlen/ }));

    expect(await screen.findByText(/In diesem Stack kann derzeit kein Produkt geteilt werden/)).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Stack bearbeiten' }).getAttribute('href')).toBe('/stacks');
    expect((screen.getByRole('button', { name: 'Zur Prüfung senden' }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.queryByText(/Hauptwirkstoff-Set|party_id|Forbidden/)).toBeNull();
  });

  it('replaces technical API errors with a clear next step', async () => {
    vi.mocked(getCreatorParties).mockResolvedValue([creatorParty]);
    vi.mocked(createCreatorShare).mockRejectedValue({
      response: { status: 400, data: { error: 'party_id und Hauptwirkstoff-Set fehlen' } },
    });

    render(<MemoryRouter><CreatorSharingPage /></MemoryRouter>);
    fireEvent.change(await screen.findByLabelText('Name der Empfehlung'), { target: { value: 'Mein Magnesium' } });
    fireEvent.click(screen.getByRole('button', { name: 'Zur Prüfung senden' }));

    expect(await screen.findByText('Die Empfehlung konnte nicht gespeichert werden. Bitte versuche es noch einmal.')).toBeTruthy();
    expect(screen.queryByText(/party_id|Hauptwirkstoff-Set/)).toBeNull();
  });

  it('lets viewers inspect the portfolio without showing write actions', async () => {
    vi.mocked(getCreatorParties).mockResolvedValue([{ ...creatorParty, role: 'viewer' }]);
    vi.mocked(getCreatorOwnedShares).mockResolvedValue([ownedShare(2, 'approved'), ownedShare(3, 'blocked')]);

    render(<MemoryRouter><CreatorSharingPage /></MemoryRouter>);
    fireEvent.click(await screen.findByRole('button', { name: /Meine Empfehlungen/ }));

    expect((screen.getByRole('button', { name: /Ganzen Stack teilen/ }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getAllByRole('button', { name: 'Vorschau ansehen' })).toHaveLength(2);
    expect(screen.queryByRole('button', { name: 'Link beenden' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Überarbeiten und erneut senden' })).toBeNull();
  });
});
