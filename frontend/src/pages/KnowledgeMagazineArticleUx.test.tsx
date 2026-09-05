// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { BrowserRouter, MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { KnowledgeArticle } from '../types';
import type { KnowledgeNavigationState } from '../lib/knowledgeNavigation';
import { deduplicateKnowledgeSources, KnowledgeMagazineArticle } from './KnowledgeMagazineArticle';

const article: KnowledgeArticle = {
  slug: 'teststoff', title: 'Teststoff verstehen', summary: 'Eine Einordnung.', article_layer: 'main_article',
  body: [
    '## Auf einen Blick', '- Die Forschung wird eingeordnet.',
    '## Was sagt die Forschung?', 'Die vorhandenen Ergebnisse.',
    '## Welche Fragen sind noch nicht beantwortet?', 'Langzeitdaten fehlen.',
    '## Häufige Fragen', '### Was ist wichtig?', 'Eine **klare** Antwort.',
    '### Wie geht es weiter?', 'Eine zweite Antwort.',
  ].join('\n\n'),
  sources: [{ source_id: 'src-1', label: 'Studie mit Grenzen', url: '/wissen/teststoff-studie' }],
};

function renderArticle(hash = '') {
  return render(<MemoryRouter initialEntries={[`/wissen/teststoff${hash}`]}><KnowledgeMagazineArticle article={article} reviewedDate={null} /></MemoryRouter>);
}

describe('knowledge magazine article navigation', () => {
  beforeEach(() => {
    vi.stubGlobal('scrollTo', vi.fn());
    vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() })));
  });
  afterEach(() => {
    cleanup();
    window.history.replaceState(null, '', '/');
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('opens and focuses the exact linked FAQ while leaving other answers closed', async () => {
    renderArticle('#haufige-fragen-frage-was-ist-wichtig');
    const question = screen.getByRole('button', { name: 'Was ist wichtig?' });
    await waitFor(() => expect(document.activeElement).toBe(question));
    expect(question.getAttribute('aria-expanded')).toBe('true');
    expect(screen.getByRole('heading', { level: 3, name: 'Was ist wichtig?' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Wie geht es weiter?' }).getAttribute('aria-expanded')).toBe('false');
    expect(screen.queryByRole('button', { name: /alle öffnen/i })).toBeNull();
  });

  it('copies a stable question link and responds to a different native hash without overwriting it', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } });
    renderArticle();
    fireEvent.click(screen.getByRole('button', { name: 'Was ist wichtig?' }));
    fireEvent.click(screen.getByRole('button', { name: 'Link zur Frage kopieren' }));
    await waitFor(() => expect(writeText).toHaveBeenCalledWith(`${window.location.origin}/wissen/teststoff#haufige-fragen-frage-was-ist-wichtig`));
    expect(screen.getByRole('status').textContent).toBe('Link zur Frage kopiert.');
    act(() => {
      window.history.replaceState(null, '', '#haufige-fragen-frage-wie-geht-es-weiter');
      window.dispatchEvent(new HashChangeEvent('hashchange'));
    });
    await waitFor(() => expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Wie geht es weiter?' })));
    expect(window.location.hash).toBe('#haufige-fragen-frage-wie-geht-es-weiter');
  });

  it('offers a selectable question link when clipboard access fails', async () => {
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: vi.fn().mockRejectedValue(new Error('denied')) } });
    renderArticle();
    fireEvent.click(screen.getByRole('button', { name: 'Was ist wichtig?' }));
    fireEvent.click(screen.getByRole('button', { name: 'Link zur Frage kopieren' }));
    const fallback = await screen.findByRole('textbox', { name: 'Link zu dieser Frage' });
    expect((fallback as HTMLInputElement).value).toContain('#haufige-fragen-frage-was-ist-wichtig');
  });

  it('shows a compact mobile contents list, moves focus out of it after a choice, and offers the page beginning', async () => {
    vi.mocked(window.matchMedia).mockReturnValue({ matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() } as unknown as MediaQueryList);
    renderArticle();
    const toc = screen.getByLabelText('Inhaltsverzeichnis');
    const toggle = within(toc).getByRole('button', { name: 'Inhaltsübersicht' });
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    expect(within(toc).queryByRole('link', { name: 'Was sagt die Forschung?' })).toBeNull();
    fireEvent.click(toggle);
    fireEvent.click(within(toc).getByRole('link', { name: 'Was sagt die Forschung?' }));
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    await waitFor(() => expect(document.activeElement).toBe(screen.getByRole('heading', { level: 2, name: 'Was sagt die Forschung?' })));
    fireEvent.click(toggle);
    fireEvent.click(within(toc).getByRole('link', { name: 'Quellen' }));
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    await waitFor(() => expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Quellen 1 Quelle' })));
    fireEvent.click(within(toc).getAllByRole('button', { name: 'Nach oben' })[0]);
    expect(window.scrollTo).toHaveBeenCalledWith({ top: 0, left: 0, behavior: 'auto' });
    expect(document.activeElement).toBe(screen.getByRole('heading', { level: 1 }));
  });

  it('links the summary to existing research, limits and automatically opened sources', async () => {
    const { container } = renderArticle();
    const context = container.querySelector('.takeaway-context') as HTMLElement;
    expect(within(context).getByRole('link', { name: 'Was sagt die Forschung?' }).getAttribute('href')).toBe('#was-sagt-die-forschung');
    expect(within(context).getByRole('link', { name: 'Welche Fragen sind noch nicht beantwortet?' }).getAttribute('href')).toBe('#welche-fragen-sind-noch-nicht-beantwortet');
    expect(screen.getByText('Die Quellen öffnen Studienartikel mit Ergebnissen, Grenzen und Links zu den Originalquellen.')).toBeTruthy();
    expect(screen.queryByRole('link', { name: 'Studie mit Grenzen' })).toBeNull();
    fireEvent.click(within(context).getByRole('link', { name: 'Quellen ansehen' }));
    expect(await screen.findByRole('link', { name: 'Studie mit Grenzen' })).toBeTruthy();
  });

  it('opens a directly linked source and preserves stack and overview context through TOC and source navigation', async () => {
    function Target() {
      const location = useLocation();
      const state = location.state as KnowledgeNavigationState;
      return <div><span>{state?.returnTo}</span><span>{state?.overviewSearch}</span></div>;
    }
    const navigationState = { returnTo: '/stacks/7', overviewSearch: '?category=vitamine&q=Vitamin&saved=1' };
    window.history.replaceState(null, '', '/wissen/teststoff#quelle-src-1');
    render(<BrowserRouter><Routes>
      <Route path="/wissen/teststoff" element={<KnowledgeMagazineArticle article={article} reviewedDate={null} navigationState={navigationState} />} />
      <Route path="/wissen/teststoff-studie" element={<Target />} />
    </Routes></BrowserRouter>);
    fireEvent.click(within(screen.getByLabelText('Inhaltsverzeichnis')).getByRole('link', { name: 'Quellen' }));
    expect(window.history.state.usr).toEqual(navigationState);
    fireEvent.click(await screen.findByRole('link', { name: 'Studie mit Grenzen' }));
    expect(await screen.findByText('/stacks/7')).toBeTruthy();
    expect(await screen.findByText('?category=vitamine&q=Vitamin&saved=1')).toBeTruthy();
  });

  it('removes only exact repeated sources and keeps identity, label and original-link distinctions', () => {
    const source = article.sources[0];
    const variants = [source, { ...source }, { ...source, source_id: 'src-2' }, { ...source, label: 'Anderer Titel' }, { ...source, url: 'https://example.org/original' }];
    expect(deduplicateKnowledgeSources(variants)).toEqual([variants[0], variants[2], variants[3], variants[4]]);
  });
});
