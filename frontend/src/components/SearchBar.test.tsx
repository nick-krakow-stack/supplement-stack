// @vitest-environment jsdom

import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import SearchBar from './SearchBar';

describe('SearchBar sub-ingredient matches', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('labels a part hit while selecting its parent ingredient', async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        ingredients: [{ id: 10, name: 'Omega-3', matched_part_id: 1, matched_part_name: 'EPA' }],
      }),
    });
    vi.stubGlobal('fetch', fetchMock);

    render(<SearchBar onSelect={() => undefined} />);
    fireEvent.change(screen.getByLabelText('Wirkstoff suchen'), { target: { value: 'EPA' } });
    await act(async () => {
      vi.advanceTimersByTime(310);
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(screen.getByText('Omega-3')).toBeTruthy();
    expect(screen.getByText('Enthält: EPA')).toBeTruthy();
  });
});
