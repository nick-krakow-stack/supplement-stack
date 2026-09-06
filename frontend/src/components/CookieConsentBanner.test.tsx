// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import CookieConsentBanner from './CookieConsentBanner';
import { ANALYTICS_CONSENT_RESET_EVENT, initializeAnalytics, persistAnalyticsConsent, readStoredAnalyticsConsent, revokeAnalyticsConsent, trackPageView } from '../lib/analytics';

vi.mock('../lib/analytics', () => ({
  ANALYTICS_CONSENT_RESET_EVENT: 'supplement-stack:analytics-consent-reset',
  initializeAnalytics: vi.fn(), persistAnalyticsConsent: vi.fn(), readStoredAnalyticsConsent: vi.fn(),
  revokeAnalyticsConsent: vi.fn(), trackPageView: vi.fn(),
}));

function renderBanner() {
  return render(<MemoryRouter initialEntries={['/demo']}><CookieConsentBanner /></MemoryRouter>);
}

describe('optional analysis consent copy', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(readStoredAnalyticsConsent).mockReturnValue(null);
  });
  afterEach(cleanup);

  it('explains that declining leaves the app usable and does not start analytics', () => {
    renderBanner();
    expect(screen.getByRole('heading', { name: 'Optionale Nutzungsanalyse' })).toBeTruthy();
    expect(screen.getByText(/Die App funktioniert auch, wenn du ablehnst\./)).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Datenschutz' }).getAttribute('href')).toBe('/datenschutz');
    expect(initializeAnalytics).not.toHaveBeenCalled();
    expect(trackPageView).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Ablehnen' }));
    expect(persistAnalyticsConsent).toHaveBeenCalledWith('declined');
    expect(revokeAnalyticsConsent).toHaveBeenCalledTimes(1);
    expect(initializeAnalytics).not.toHaveBeenCalled();
    expect(trackPageView).not.toHaveBeenCalled();
    expect(screen.queryByRole('heading', { name: 'Optionale Nutzungsanalyse' })).toBeNull();
  });

  it('accepts only through the existing action and allows the choice to be reopened', async () => {
    renderBanner();
    fireEvent.click(screen.getByRole('button', { name: 'Zustimmen' }));
    expect(persistAnalyticsConsent).toHaveBeenCalledWith('accepted');
    expect(initializeAnalytics).toHaveBeenCalledTimes(1);
    expect(trackPageView).toHaveBeenCalledWith('/demo');
    act(() => window.dispatchEvent(new Event(ANALYTICS_CONSENT_RESET_EVENT)));
    const heading = screen.getByRole('heading', { name: 'Optionale Nutzungsanalyse' });
    await waitFor(() => expect(document.activeElement).toBe(heading));
    expect(screen.getByRole('button', { name: 'Ablehnen' })).toBeTruthy();
  });

  it('keeps a stored declined choice without displaying the banner or tracking', () => {
    vi.mocked(readStoredAnalyticsConsent).mockReturnValue('declined');
    const { container } = renderBanner();
    expect(container.textContent).toBe('');
    expect(initializeAnalytics).not.toHaveBeenCalled();
    expect(trackPageView).not.toHaveBeenCalled();
  });
});
