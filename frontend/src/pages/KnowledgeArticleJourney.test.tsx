// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import KnowledgeArticlePage from './KnowledgeArticlePage';
import KnowledgeOverviewPage from './KnowledgeOverviewPage';
import { KnowledgeArticleActions } from './KnowledgeArticleActions';
import { readSavedKnowledgeSlugs } from '../lib/knowledgeNavigation';
import type { KnowledgeArticle } from '../types';

const article: KnowledgeArticle = {
  slug: 'teststoff', title: 'Teststoff erklärt', summary: 'Ein einfacher Überblick.',
  body: '## Einordnung\n\nDie Aussagen gelten für die untersuchten Bedingungen.',
  article_layer: 'single_study', sources: [{ label: 'Originalquelle', url: 'https://example.com/study' }],
  ingredients: [{ ingredient_id: 1, name: 'Teststoff' }], related_articles: [],
};
const overview = {
  articles: [{ slug: 'teststoff', title: 'Teststoff erklärt', summary: 'Überblick', sources_count: 1, ingredient_ids: [1] }],
  nutrient_statuses: [{ ingredient_id: 1, name: 'Teststoff', description: 'Ein Wirkstoff.', category_key: 'vitamine', aliases: [], has_studies: true, has_dge: false }],
};

function LocationProbe() {
  const location = useLocation();
  return <output data-testid="location">{JSON.stringify({ path: location.pathname, search: location.search, state: location.state })}</output>;
}

function renderJourney(path: string, state: unknown = null) {
  return render(<MemoryRouter initialEntries={[{ pathname: path.split('?')[0], search: path.includes('?') ? `?${path.split('?')[1]}` : '', state }]}><Routes><Route path="/wissen" element={<KnowledgeOverviewPage />} /><Route path="/wissen/:slug" element={<KnowledgeArticlePage />} /></Routes><LocationProbe /></MemoryRouter>);
}

beforeEach(() => {
  window.localStorage.clear();
  window.sessionStorage.clear();
  delete window.__knowledgeArticleBootstrap;
  delete window.__knowledgeOverviewRequest;
  vi.stubGlobal('scrollTo', vi.fn());
  vi.stubGlobal('fetch', vi.fn(async (input: string) => ({ ok: true, status: 200, json: async () => input.split('?')[0].endsWith('/knowledge') ? overview : { article } })));
  Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: vi.fn().mockResolvedValue(undefined) } });
  Object.defineProperty(navigator, 'share', { configurable: true, value: undefined });
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe('Wissensartikel aus Nutzer- und Creator-Sicht', () => {
  it('keeps stack and filters through search, article, bookmarks and back', async () => {
    renderJourney('/wissen?category=vitamine', { returnTo: '/stacks?stack=17' });
    await screen.findByRole('link', { name: /Teststoff.*Artikel lesen/ });
    fireEvent.change(screen.getByRole('searchbox', { name: 'Nährstoff suchen' }), { target: { value: 'Teststoff' } });
    fireEvent.click(screen.getByRole('link', { name: /Teststoff.*Artikel lesen/ }));
    await screen.findByRole('heading', { name: 'Teststoff erklärt', level: 1 });
    expect(screen.getByRole('link', { name: 'Zurück zu meinen Stacks' })).toHaveAttribute('href', '/stacks?stack=17');
    expect(screen.getByRole('link', { name: 'Zur Wissensübersicht' })).toHaveAttribute('href', '/wissen?category=vitamine&q=Teststoff');
    fireEvent.click(screen.getByRole('button', { name: 'Artikel merken' }));
    expect(readSavedKnowledgeSlugs()).toEqual(['teststoff']);
    fireEvent.click(screen.getByRole('link', { name: 'Gemerkte Artikel ansehen' }));
    await screen.findByRole('heading', { name: 'Gemerkte Artikel' });
    expect(screen.getByRole('link', { name: 'Zur Wissensübersicht' })).toHaveAttribute('href', '/wissen?category=vitamine&q=Teststoff');
    fireEvent.click(await screen.findByRole('link', { name: 'Teststoff erklärt' }));
    await screen.findByRole('heading', { name: 'Teststoff erklärt', level: 1 });
    expect(screen.getByRole('link', { name: 'Zurück zu meinen Stacks' })).toHaveAttribute('href', '/stacks?stack=17');
  });

  it('copies only the public article URL and offers a usable clipboard fallback', async () => {
    const writeText = vi.mocked(navigator.clipboard.writeText);
    render(<MemoryRouter initialEntries={['/wissen/teststoff?returnTo=%2Fstacks%3Fstack%3D17&q=privat&cfcheck=1']}><KnowledgeArticleActions slug="teststoff" title="Teststoff erklärt" /></MemoryRouter>);
    fireEvent.click(screen.getByRole('button', { name: 'Link kopieren' }));
    await waitFor(() => expect(writeText).toHaveBeenCalledWith(`${window.location.origin}/wissen/teststoff`));
    writeText.mockRejectedValueOnce(new Error('denied'));
    fireEvent.click(screen.getByRole('button', { name: 'Link kopieren' }));
    expect(await screen.findByRole('textbox', { name: 'Artikellink zum Kopieren' })).toHaveValue(`${window.location.origin}/wissen/teststoff`);
  });

  it('shows a missing article with H1, noindex and a working search', async () => {
    vi.mocked(fetch).mockImplementation(async (input) => ({ ok: !String(input).includes('/fehlend'), status: String(input).includes('/fehlend') ? 404 : 200, json: async () => overview } as Response));
    renderJourney('/wissen/fehlend');
    await screen.findByRole('heading', { name: 'Artikel nicht gefunden', level: 1 });
    expect(document.head.querySelector('meta[name="robots"]')).toHaveAttribute('content', 'noindex,follow');
    fireEvent.change(screen.getByRole('searchbox', { name: 'Wirkstoff suchen' }), { target: { value: 'Teststoff' } });
    fireEvent.click(screen.getByRole('button', { name: 'Suchen' }));
    await screen.findByRole('link', { name: /Teststoff.*Artikel lesen/ });
    expect(screen.getByTestId('location').textContent).toContain('?q=Teststoff');
  });

  it('retries a temporary error instead of treating it as a missing article', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({ ok: false, status: 503 } as Response);
    renderJourney('/wissen/teststoff');
    await screen.findByRole('heading', { name: 'Artikel gerade nicht erreichbar' });
    fireEvent.click(screen.getByRole('button', { name: 'Erneut versuchen' }));
    await screen.findByRole('heading', { name: 'Teststoff erklärt', level: 1 });
    expect(screen.queryByRole('heading', { name: 'Artikel nicht gefunden' })).not.toBeInTheDocument();
  });

  it('preserves source-to-article context and shows only a real update reason', async () => {
    window.__knowledgeArticleBootstrap = { article: { ...article, update_reason: 'Schreibfehler korrigiert.', related_articles: [{ slug: 'hauptartikel', title: 'Einordnung', article_layer: 'main_article', ingredients: [{ ingredient_id: 1, name: 'Teststoff' }] }] } };
    renderJourney('/wissen/teststoff', { returnTo: '/demo', overviewSearch: '?category=vitamine&q=Teststoff' });
    expect(await screen.findByRole('link', { name: 'Einordnung zu Teststoff' })).toHaveAttribute('href', '/wissen/hauptartikel?category=vitamine&q=Teststoff');
    expect(screen.getByRole('link', { name: 'Zur Wissensübersicht' })).toHaveAttribute('href', '/wissen?category=vitamine&q=Teststoff');
    expect(screen.getByText('Schreibfehler korrigiert.')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Teststoff erklärt', level: 1 })).toHaveAttribute('tabindex', '-1');
  });
});
