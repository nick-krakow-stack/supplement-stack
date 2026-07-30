// @vitest-environment jsdom
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { buildTrustStats, TrustSection } from './LandingPage';

describe('LandingPage trust statistics', () => {
  afterEach(() => {
    cleanup();
    window.sessionStorage.clear();
    vi.unstubAllGlobals();
  });

  it('renders current public catalog counts with the requested labels', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        active_nutrients: 92,
        published_knowledge_articles: 44,
        prepared_studies: 707,
        public_approved_products: 33,
      }),
    });
    vi.stubGlobal('fetch', fetchMock);

    render(<TrustSection />);

    const stats = screen.getByLabelText('Aktuelle öffentliche Datenbasis');
    await waitFor(() => expect(within(stats).getByText('707')).toBeTruthy());
    expect(within(stats).getByText('92')).toBeTruthy();
    expect(within(stats).getByText('44')).toBeTruthy();
    expect(within(stats).getByText('33')).toBeTruthy();
    expect(within(stats).getByText('Aktive Nährstoffe in unserer Datenbank')).toBeTruthy();
    expect(within(stats).getByText('Wissensartikel mit den neuesten Erkenntnissen und Richtlinien')).toBeTruthy();
    expect(within(stats).getByText('Durchsuchte und zum Lesen aufbereitete Studien')).toBeTruthy();
    expect(within(stats).getByText('Verknüpfte Produkte mit geprüften Inhaltsstoffen')).toBeTruthy();
    expect(within(stats).queryByText('Quellenverknüpfungen in Wissensartikeln')).toBeNull();
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringMatching(/\/api\/public-stats$/),
      expect.objectContaining({
        signal: expect.any(AbortSignal),
        headers: { Accept: 'application/json' },
      }),
    );
  });

  it('shows no invented fallback values when the public data is unavailable', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false }));

    render(<TrustSection />);

    const stats = screen.getByLabelText('Aktuelle öffentliche Datenbasis');
    expect(within(stats).getAllByText('–')).toHaveLength(4);
    await waitFor(() => expect(within(stats).getAllByText('–')).toHaveLength(4));
    expect(within(stats).queryByText('Quellenverknüpfungen in Wissensartikeln')).toBeNull();
  });

  it('does not display malformed API counts as real values', () => {
    const stats = buildTrustStats({
      active_nutrients: 92,
      published_knowledge_articles: 44,
      prepared_studies: Number.NaN,
      public_approved_products: 33,
    });

    expect(stats[2].value).toBe('–');
  });
});
