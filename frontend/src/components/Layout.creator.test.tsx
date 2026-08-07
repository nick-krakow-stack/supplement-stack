// @vitest-environment jsdom

import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { getCreatorParties } from '../api/creatorSharing';
import { useAuth } from '../contexts/AuthContext';
import Layout from './Layout';

vi.mock('../api/creatorSharing', () => ({
  creatorSharingEnabled: true,
  getCreatorParties: vi.fn(),
}));

vi.mock('../contexts/AuthContext', () => ({ useAuth: vi.fn() }));

const user = {
  id: 42,
  email: 'user@example.test',
  role: 'user' as const,
};

describe('Layout creator navigation', () => {
  beforeEach(() => {
    vi.mocked(useAuth).mockReturnValue({
      user,
      isAdmin: false,
      loading: false,
      login: vi.fn(),
      register: vi.fn(),
      logout: vi.fn(),
      refreshUser: vi.fn(),
    });
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('does not show the creator link before or without a positive membership result', async () => {
    let resolveParties: (value: []) => void = () => undefined;
    vi.mocked(getCreatorParties).mockReturnValue(new Promise((resolve) => { resolveParties = resolve; }));

    render(<MemoryRouter><Layout><div>Inhalt</div></Layout></MemoryRouter>);

    expect(screen.queryByText('Für Creator')).toBeNull();
    resolveParties([]);
    await waitFor(() => expect(getCreatorParties).toHaveBeenCalledTimes(1));
    expect(screen.queryByText('Für Creator')).toBeNull();
  });

  it('shows the creator link only after an active creator or brand membership loads', async () => {
    vi.mocked(getCreatorParties).mockResolvedValue([{
      id: 7,
      type: 'creator',
      name: 'Alex Alltag',
      slug: 'alex-alltag',
      role: 'owner',
    }]);

    render(<MemoryRouter><Layout><div>Inhalt</div></Layout></MemoryRouter>);

    expect(screen.queryByText('Für Creator')).toBeNull();
    await waitFor(() => expect(screen.getAllByText('Für Creator').length).toBeGreaterThan(0));
  });
});
