// @vitest-environment jsdom
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { TrustSection } from './LandingPage';

describe('LandingPage trust statistics', () => {
  afterEach(() => {
    cleanup();
    window.sessionStorage.clear();
    vi.unstubAllGlobals();
  });

  it('renders current public knowledge counts instead of static claims', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        articles: [
          { slug: 'magnesium', title: 'Magnesium', summary: '', sources_count: 12 },
          { slug: 'vitamin-c', title: 'Vitamin C', summary: '', sources_count: 21 },
        ],
        nutrient_statuses: [
          { ingredient_id: 1, has_dge: true },
          { ingredient_id: 2, has_dge: false },
          { ingredient_id: 3, has_dge: true },
        ],
        total: 2,
      }),
    });
    vi.stubGlobal('fetch', fetchMock);

    render(<TrustSection />);

    const stats = screen.getByLabelText('Aktuelle öffentliche Datenbasis');
    await waitFor(() => expect(within(stats).getByText('33')).toBeTruthy());
    expect(within(stats).getByText('3')).toBeTruthy();
    expect(within(stats).getAllByText('2')).toHaveLength(2);
    expect(within(stats).queryByText('500+')).toBeNull();
    expect(within(stats).queryByText('< 30 s')).toBeNull();
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringMatching(/\/api\/knowledge$/),
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
    expect(within(stats).queryByText('500+')).toBeNull();
  });
});
