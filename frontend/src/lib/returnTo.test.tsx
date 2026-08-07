// @vitest-environment jsdom

import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import ProtectedRoute from '../components/ProtectedRoute';
import { authReturnTo, currentLocationReturnTo, safeInternalReturnTo } from './returnTo';

vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({ user: null, isAdmin: false, loading: false }),
}));

function LocationProbe() {
  const location = useLocation();
  return <output>{JSON.stringify({ pathname: location.pathname, search: location.search, hash: location.hash, state: location.state })}</output>;
}

describe('safe returnTo contract', () => {
  afterEach(cleanup);

  it('preserves an exact internal pathname, query and hash', () => {
    const target = '/share/abcdefghijklmnopqrstuvwxyz123456?view=full&tab=details#product-2';
    expect(safeInternalReturnTo(target)).toBe(target);
    expect(currentLocationReturnTo({ pathname: '/share/abcdefghijklmnopqrstuvwxyz123456', search: '?view=full&tab=details', hash: '#product-2' })).toBe(target);
    expect(authReturnTo({ search: `?returnTo=${encodeURIComponent(target)}` })).toBe(target);
    expect(authReturnTo({ state: { returnTo: target } })).toBe(target);
    expect(authReturnTo({ state: { from: { pathname: '/share/abcdefghijklmnopqrstuvwxyz123456', search: '?view=full', hash: '#product-2' } } })).toBe('/share/abcdefghijklmnopqrstuvwxyz123456?view=full#product-2');
  });

  it.each([
    'https://evil.example/path',
    '//evil.example/path',
    '/\\evil.example/path',
    '/%5cevil.example/path',
    '/%255cevil.example/path',
    '/%2f%2fevil.example/path',
    '/%252f%252fevil.example/path',
    '%2f%2fevil.example/path',
  ])('blocks unsafe or encoded redirect %s', (unsafe) => {
    expect(safeInternalReturnTo(unsafe)).toBe('/stacks');
    expect(authReturnTo({ search: `?returnTo=${encodeURIComponent(unsafe)}` })).toBe('/stacks');
  });

  it('gives login the exact protected location', async () => {
    render(
      <MemoryRouter initialEntries={['/private/path?view=full#section']}>
        <Routes>
          <Route path="/private/path" element={<ProtectedRoute><div>Geheim</div></ProtectedRoute>} />
          <Route path="/login" element={<LocationProbe />} />
        </Routes>
      </MemoryRouter>,
    );

    const location = JSON.parse((await screen.findByRole('status')).textContent || '{}') as {
      search: string;
      state: { returnTo: string };
    };
    expect(new URLSearchParams(location.search).get('returnTo')).toBe('/private/path?view=full#section');
    expect(location.state.returnTo).toBe('/private/path?view=full#section');
  });
});
