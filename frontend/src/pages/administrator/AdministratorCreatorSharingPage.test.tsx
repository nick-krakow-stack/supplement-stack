// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { apiClient } from '../../api/client';
import AdministratorCreatorSharingPage from './AdministratorCreatorSharingPage';

vi.mock('../../api/client', () => ({
  apiClient: {
    get: vi.fn(),
    patch: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
  },
}));

const party = {
  id: 12,
  type: 'creator',
  name: 'Test Creator',
  slug: 'test-creator',
  status: 'active',
  auto_catalog_approval: 0,
  version: 3,
  members_count: 1,
  products_count: 4,
  shares_count: 1,
};

const share = {
  id: 41,
  token: 'creator-share-token',
  entity_type: 'stack',
  creator_name: 'Test Creator',
  title: 'Mein Morgen-Stack',
  snapshot_hash: 'a'.repeat(64),
  moderation_status: 'pending',
  moderation_reason: null,
  moderation_target: null,
  moderation_item_index: null,
  is_revoked: 0,
  version: 7,
  paused_at: null,
  expires_at: 1_800_000_000,
  archived_at: null,
  supersedes_share_link_id: 39,
  views: 91,
  imports: 13,
};
let visibleShare = share;

function apiResponse(data: unknown) {
  return Promise.resolve({ data }) as ReturnType<typeof apiClient.get>;
}

describe('AdministratorCreatorSharingPage moderation', () => {
  beforeEach(() => {
    visibleShare = share;
    vi.mocked(apiClient.get).mockReset().mockImplementation((url) => {
      if (url === '/admin/creator-sharing/parties') return apiResponse({ parties: [party] });
      if (url === '/admin/creator-sharing/shares') return apiResponse({ shares: [visibleShare] });
      if (url === '/admin/creator-sharing/missing-platform-codes') return apiResponse({ shops: [] });
      if (url === '/admin/shop-domains') return apiResponse({ shops: [] });
      if (url === `/admin/creator-sharing/parties/${party.id}/settings`) {
        return apiResponse({ affiliate_versions: [], default_shop: null, product_picks: [] });
      }
      return Promise.reject(new Error(`Unexpected GET ${String(url)}`));
    });
    vi.mocked(apiClient.patch).mockReset().mockResolvedValue({ data: { ok: true } });
    vi.mocked(apiClient.post).mockReset();
    vi.mocked(apiClient.put).mockReset();
  });

  afterEach(cleanup);

  it('hides legacy counters and sends a fully bound rejection with a helpful target', async () => {
    render(<AdministratorCreatorSharingPage />);

    expect(await screen.findByText('Mein Morgen-Stack')).toBeTruthy();
    expect(screen.queryByText('Aufrufe / Importe')).toBeNull();
    expect(document.body.textContent).not.toContain('91 / 13');
    expect(screen.getByText('Korrektur von #39')).toBeTruthy();

    const rejectButton = screen.getByRole('button', { name: 'Mit Rückmeldung ablehnen' });
    expect(rejectButton.hasAttribute('disabled')).toBe(true);

    fireEvent.change(screen.getByLabelText('Grund für die Ablehnung von Test Creator'), {
      target: { value: 'Bitte erkläre die Produktauswahl ohne Fachbegriffe.' },
    });
    fireEvent.change(screen.getByLabelText('Betroffener Bereich von Test Creator'), {
      target: { value: 'product' },
    });
    expect(rejectButton.hasAttribute('disabled')).toBe(true);

    fireEvent.change(screen.getByLabelText('Nummer des betroffenen Eintrags von Test Creator'), {
      target: { value: '3' },
    });
    expect(rejectButton.hasAttribute('disabled')).toBe(false);
    fireEvent.click(rejectButton);

    await waitFor(() => expect(apiClient.patch).toHaveBeenCalledWith(
      '/admin/creator-sharing/shares/41',
      {
        expected_version: 7,
        expected_snapshot_hash: 'a'.repeat(64),
        expected_moderation_status: 'pending',
        expected_is_revoked: 0,
        expected_paused_at: null,
        expected_expires_at: 1_800_000_000,
        expected_archived_at: null,
        moderation_status: 'blocked',
        moderation_reason: 'Bitte erkläre die Produktauswahl ohne Fachbegriffe.',
        moderation_target: 'product',
        moderation_item_index: 2,
      },
    ));

    const requestBody = vi.mocked(apiClient.patch).mock.calls[0]?.[1] as Record<string, unknown>;
    expect(requestBody).not.toHaveProperty('is_revoked');
    expect(requestBody).not.toHaveProperty('expected_status');
  });

  it('clears all feedback fields when approving without changing the link lifecycle', async () => {
    render(<AdministratorCreatorSharingPage />);

    fireEvent.click(await screen.findByRole('button', { name: 'Freigeben' }));

    await waitFor(() => expect(apiClient.patch).toHaveBeenCalledWith(
      '/admin/creator-sharing/shares/41',
      {
        expected_version: 7,
        expected_snapshot_hash: 'a'.repeat(64),
        expected_moderation_status: 'pending',
        expected_is_revoked: 0,
        expected_paused_at: null,
        expected_expires_at: 1_800_000_000,
        expected_archived_at: null,
        moderation_status: 'approved',
        moderation_reason: null,
        moderation_target: null,
        moderation_item_index: null,
      },
    ));

    const requestBody = vi.mocked(apiClient.patch).mock.calls[0]?.[1] as Record<string, unknown>;
    expect(requestBody).not.toHaveProperty('is_revoked');
  });

  it('does not offer moderation for a recommendation the creator already ended', async () => {
    visibleShare = { ...share, is_revoked: 1 };
    render(<AdministratorCreatorSharingPage />);

    expect(await screen.findByText('Vom Creator beendet – keine weitere Prüfung möglich.')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Freigeben' }).hasAttribute('disabled')).toBe(true);
    expect(screen.getByRole('button', { name: 'Mit Rückmeldung ablehnen' }).hasAttribute('disabled')).toBe(true);
    expect(apiClient.patch).not.toHaveBeenCalled();
  });
});
