// @vitest-environment jsdom
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';

import LandingPage, { buildTrustStats, FeaturesSection, TrustSection } from './LandingPage';

vi.mock('../contexts/AuthContext', () => ({ useAuth: () => ({ user: null }) }));

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
    expect(within(stats).getByText('Aktive Wirkstoffe in unserer Datenbank')).toBeTruthy();
    expect(within(stats).getByText('Wissensartikel mit Quellen und Prüfdatum')).toBeTruthy();
    expect(within(stats).getByText('Durchsuchte und zum Lesen aufbereitete Studien')).toBeTruthy();
    expect(within(stats).getByText('Verknüpfte Produkte mit erfassten Inhaltsstoffen')).toBeTruthy();
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

  it('describes product filtering as the user’s own comparison and decision', () => {
    render(<FeaturesSection />);

    expect(screen.getByRole('heading', { name: 'Produktangaben vergleichen' })).toBeTruthy();
    expect(screen.getByText('Nach Angaben filterbar')).toBeTruthy();
    expect(screen.getByText(/Filtere selbst.*Vergleiche.*entscheide selbst/i)).toBeTruthy();
    expect(screen.queryByText('Passende Produktauswahl')).toBeNull();
    expect(screen.queryByText('Automatisch gefiltert')).toBeNull();
  });

  it('uses the same source and cost labels in hero chips and feature cards', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false }));
    const { container } = render(<MemoryRouter><LandingPage /></MemoryRouter>);
    expect(screen.getAllByText('Quellen: DGE, EFSA und NIH')).toHaveLength(2);
    expect(screen.getAllByText('Kosten pro Einnahme im Vergleich')).toHaveLength(2);
    expect(screen.getByText(/Vergleiche Produkte anhand der Kosten pro Einnahme/)).toBeTruthy();
    expect(container.textContent).not.toMatch(/Preis[- ]pro[- ]Portion|Preises pro Portion|DGE · EFSA · NIH/);
    await screen.findByRole('button', { name: 'Erneut laden' });
  });

  it('states the real demo scope and account-only actions instead of promising all steps', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false }));
    const { container } = render(<MemoryRouter><LandingPage /></MemoryRouter>);
    const demoLinks = screen.getAllByRole('link', { name: 'Demo ohne Konto ausprobieren' });
    expect(demoLinks).toHaveLength(2);
    expect(demoLinks.every((link) => link.getAttribute('href') === '/demo')).toBe(true);
    expect(screen.getAllByText('Teste Suche, Stack-Aufbau und Kostenübersicht. Speichern, E-Mail und eigene Produkte gibt es nach kostenloser Anmeldung.')).toHaveLength(3);
    expect(container.textContent).not.toMatch(/alle Schritte ausprobieren|vollständig ausprobieren|Alles nutzbar|ohne Risiko|neueste Erkenntnisse|geprüfte Inhaltsstoffe/);
    await screen.findByRole('button', { name: 'Erneut laden' });
  });
});
