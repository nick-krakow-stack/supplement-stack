// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import KnowledgeOverviewPage from './KnowledgeOverviewPage';

type StatusFixture = {
  ingredient_id: number;
  name: string;
  category: string;
  category_key: string;
  solubility: 'fat' | 'water' | null;
  description: string | null;
  aliases: string[];
  has_dge: boolean;
  has_studies: boolean;
};

type ArticleFixture = {
  slug: string;
  title: string;
  summary: string;
  sources_count: number;
  ingredients: Array<{ ingredient_id: number; name: string; sort_order: number }>;
  ingredient_ids: number[];
};

const CATEGORY_KEYS = [
  'vitamine',
  'mineralstoffe',
  'spurenelemente',
  'aminosaeuren_proteine',
  'fettsaeuren',
  'pflanzenstoffe_extrakte',
  'heilpilze',
  'enzyme',
  'probiotika',
  'sonstige',
] as const;

function status(
  ingredientId: number,
  name: string,
  categoryKey: string,
  overrides: Partial<StatusFixture> = {},
): StatusFixture {
  return {
    ingredient_id: ingredientId,
    name,
    category: categoryKey,
    category_key: categoryKey,
    solubility: null,
    description: `Zentraler Kurztext für ${name}`,
    aliases: [],
    has_dge: false,
    has_studies: false,
    ...overrides,
  };
}

function article(slug: string, ingredientId: number, name: string): ArticleFixture {
  return {
    slug,
    title: `${name}: ausführlicher Titel`,
    summary: `Artikel über ${name}`,
    sources_count: 4,
    ingredients: [{ ingredient_id: ingredientId, name, sort_order: 0 }],
    ingredient_ids: [ingredientId],
  };
}

function stubOverview(
  nutrientStatuses: StatusFixture[],
  articles: ArticleFixture[] = [],
) {
  const fetchMock = vi.fn().mockResolvedValue({
    ok: true,
    json: () => Promise.resolve({
      articles,
      nutrient_statuses: nutrientStatuses,
      total: articles.length,
    }),
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

function LocationProbe() {
  const location = useLocation();
  return <output aria-label="Aktuelle URL">{`${location.pathname}${location.search}`}</output>;
}

function renderOverview(initialEntry = '/wissen') {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <Routes>
        <Route
          path="/wissen"
          element={(
            <>
              <KnowledgeOverviewPage />
              <LocationProbe />
            </>
          )}
        />
      </Routes>
    </MemoryRouter>,
  );
}

describe('KnowledgeOverviewPage', () => {
  afterEach(() => {
    cleanup();
    window.sessionStorage.clear();
    delete window.__knowledgeOverviewRequest;
    vi.unstubAllGlobals();
  });

  it('explains the overview factually with correct typography and consistent Wirkstoff wording', async () => {
    const magnesiumSummary = 'Mineralstoff für die normale Funktion von Muskeln und Nerven.';
    stubOverview([status(1, 'Magnesium', 'mineralstoffe', { description: magnesiumSummary })]);
    renderOverview();

    expect(await screen.findByRole('heading', {
      level: 1,
      name: 'Alles über Vitamine, Mineralstoffe & Co. – einfach erklärt',
    })).toBeTruthy();
    expect(screen.getByText(/was über einen Wirkstoff bekannt ist, wo er vorkommt und welche Grenzen/i)).toBeTruthy();
    expect(screen.getByRole('searchbox', { name: 'Wirkstoff suchen' })).toBeTruthy();
    expect(screen.getByPlaceholderText('Wirkstoff suchen – z. B. Vitamin D, Magnesium oder Eisen …')).toBeTruthy();
    expect(screen.getByText(magnesiumSummary)).toBeTruthy();
    expect(document.body.textContent).not.toContain('Nährstoff suchen');
  });

  it('renders exactly the 92 active API ingredients, including formerly missing entries, without a local fallback list', async () => {
    const statuses = Array.from({ length: 92 }, (_, index) => {
      const ingredientId = index + 1;
      const categoryKey = CATEGORY_KEYS[index % CATEGORY_KEYS.length];
      const names: Record<number, string> = { 90: 'Molybdän', 91: 'Natrium', 92: 'Phosphor' };
      return status(ingredientId, names[ingredientId] ?? `Zentraler Wirkstoff ${ingredientId}`, categoryKey);
    });
    stubOverview(statuses, [article('zentraler-wirkstoff-1', 1, 'Zentraler Wirkstoff 1')]);
    renderOverview();

    expect(await screen.findByText('Molybdän')).toBeTruthy();
    expect(screen.getByText('Natrium')).toBeTruthy();
    expect(screen.getByText('Phosphor')).toBeTruthy();
    expect(document.querySelectorAll('.knowledge-overview .nutri')).toHaveLength(92);
    expect(Array.from(document.querySelectorAll('.knowledge-overview .db-stat')).map((node) => (
      node.textContent?.replace(/\s+/g, '')
    ))).toEqual(['92Wirkstoffe', '10Kategorien', '1ausführlicherArtikel']);
    expect(screen.queryByText('Vitamin A')).toBeNull();
  });

  it('binds articles to the canonical ingredient id rather than titles, summaries, or aliases', async () => {
    const statuses = [
      status(3, 'Magnesium', 'mineralstoffe'),
      status(4, 'Vitamin D', 'vitamine'),
    ];
    const misleadingArticle = {
      ...article('ungewoehnlicher-slug', 3, 'Fremder Titel'),
      title: 'Vitamin D steht nur im Titel',
      summary: 'Auch Vitamin D steht in der Zusammenfassung.',
    };
    stubOverview(statuses, [misleadingArticle]);
    renderOverview();

    const magnesiumLink = await screen.findByRole('link', { name: /Magnesium/ });
    expect(magnesiumLink.getAttribute('href')).toBe('/wissen/ungewoehnlicher-slug');
    expect(screen.queryByRole('link', { name: /Vitamin D/ })).toBeNull();
    expect(screen.getByText('Vitamin D').closest('.nutri')?.tagName).toBe('ARTICLE');
  });

  it('uses central descriptions and aliases for search and shows the approved neutral fallback for missing copy', async () => {
    stubOverview([
      status(1, 'Magnesium', 'mineralstoffe', {
        description: 'Muskel- und Nervenfunktion',
        aliases: ['Mg', 'Magnesiumcitrat'],
      }),
      status(2, 'Boswellia (Weihrauch)', 'pflanzenstoffe_extrakte', { description: null }),
      status(3, 'Ginseng', 'pflanzenstoffe_extrakte', {
        description: 'Quellen beschreiben Ginseng im Zusammenhang mit Energie und Stress.',
      }),
    ]);
    renderOverview();

    expect(await screen.findByText('Muskel- und Nervenfunktion')).toBeTruthy();
    expect(screen.getByText('Kurztext wird geprüft.')).toBeTruthy();
    expect(screen.getByText('Quellen beschreiben Ginseng im Zusammenhang mit Energie und Stress.')).toBeTruthy();

    fireEvent.change(screen.getByRole('searchbox', { name: 'Wirkstoff suchen' }), { target: { value: 'Magnesiumcitrat' } });
    expect(screen.getByText('Magnesium')).toBeTruthy();
    expect(screen.queryByText('Boswellia (Weihrauch)')).toBeNull();
    expect(document.querySelector('.db-results')?.textContent).toBe('1 Treffer');
  });

  it('announces result counts and clears the URL search with Escape or the keyboard-accessible clear button', async () => {
    stubOverview([
      status(1, 'Magnesium', 'mineralstoffe'),
      status(2, 'Natrium', 'mineralstoffe'),
    ]);
    renderOverview();
    const input = await screen.findByRole('searchbox', { name: 'Wirkstoff suchen' });

    fireEvent.change(input, { target: { value: 'mag' } });
    expect(document.querySelector('.db-results')?.textContent).toBe('1 Treffer');
    expect(screen.getByLabelText('Aktuelle URL').textContent).toBe('/wissen?q=mag');

    fireEvent.keyDown(input, { key: 'Escape' });
    expect((input as HTMLInputElement).value).toBe('');
    expect(screen.getByLabelText('Aktuelle URL').textContent).toBe('/wissen');

    fireEvent.change(input, { target: { value: 'natrium' } });
    const clear = screen.getByRole('button', { name: 'Suche löschen' });
    clear.focus();
    fireEvent.keyDown(clear, { key: 'Enter' });
    fireEvent.click(clear);
    expect((input as HTMLInputElement).value).toBe('');
  });

  it('offers API-derived suggestions and a direct reset when search has no result', async () => {
    stubOverview([
      status(1, 'Magnesium', 'mineralstoffe'),
      status(2, 'Vitamin D', 'vitamine'),
      status(3, 'Eisen', 'spurenelemente'),
    ]);
    renderOverview('/wissen?category=mineralstoffe&q=unbekannt');

    expect(await screen.findByRole('heading', { name: 'Nichts gefunden' })).toBeTruthy();
    const suggestions = screen.getByLabelText('Suchvorschläge');
    expect(within(suggestions).getByRole('button', { name: 'Magnesium' })).toBeTruthy();
    fireEvent.click(within(suggestions).getByRole('button', { name: 'Vitamin D' }));
    expect(screen.getByText('Vitamin D')).toBeTruthy();
    expect(screen.getByLabelText('Aktuelle URL').textContent).toBe('/wissen?q=Vitamin+D');

    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'kein Treffer' } });
    fireEvent.click(screen.getByRole('button', { name: 'Suche und Filter zurücksetzen' }));
    expect(screen.getByLabelText('Aktuelle URL').textContent).toBe('/wissen');
    expect(document.activeElement).toBe(screen.getByRole('searchbox'));
  });

  it('marks category filters semantically, announces their count, and canonicalizes invalid URL parameters', async () => {
    stubOverview([
      status(1, 'Magnesium', 'mineralstoffe'),
      status(2, 'Vitamin D', 'vitamine'),
      status(3, 'Natrium', 'mineralstoffe'),
    ]);
    renderOverview('/wissen?category=ungueltig&q=magnesium&extra=weg');

    const all = await screen.findByRole('button', { name: /Alle\s*3/ });
    await waitFor(() => expect(screen.getByLabelText('Aktuelle URL').textContent).toBe('/wissen?q=magnesium'));
    expect(all.getAttribute('aria-pressed')).toBe('true');

    const minerals = screen.getByRole('button', { name: /Mineralstoffe\s*2/ });
    fireEvent.click(minerals);
    expect(minerals.getAttribute('aria-pressed')).toBe('true');
    expect(all.getAttribute('aria-pressed')).toBe('false');
    expect(document.querySelector('.db-results')?.textContent).toBe('1 Treffer');
    expect(screen.getByLabelText('Aktuelle URL').textContent).toBe('/wissen?category=mineralstoffe&q=magnesium');
  });

  it('renders unfinished cards as noninteractive content with a clear preparation status', async () => {
    stubOverview([status(1, 'Zeolith', 'sonstige')]);
    renderOverview();

    const card = (await screen.findByText('Zeolith')).closest('.nutri');
    expect(card?.tagName).toBe('ARTICLE');
    expect(card?.getAttribute('role')).toBeNull();
    expect(card?.getAttribute('tabindex')).toBeNull();
    expect(within(card as HTMLElement).getByText('Artikel in Vorbereitung')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Zeolith/ })).toBeNull();
    expect(screen.getByText('1 Eintrag')).toBeTruthy();
  });

  it('keeps available cards readable and explains DGE and study badges', async () => {
    stubOverview([
      status(1, 'Vitamin D', 'vitamine', {
        solubility: 'fat',
        has_dge: true,
        has_studies: true,
      }),
    ], [article('vitamin-d', 1, 'Vitamin D')]);
    renderOverview();

    const card = await screen.findByRole('link', { name: /Vitamin D/ });
    expect(within(card).getByText('fettlöslich')).toBeTruthy();
    expect(within(card).getByText('Artikel lesen')).toBeTruthy();
    expect(within(card).getByLabelText('DGE-Referenzwert vorhanden').getAttribute('title'))
      .toBe('Ein öffentlicher DGE-Referenzwert ist vorhanden.');
    expect(within(card).getByLabelText('Veröffentlichte Studienartikel vorhanden').getAttribute('title'))
      .toBe('Zu diesem Wirkstoff gibt es veröffentlichte Studienartikel.');
    const explanation = screen.getByText('Was bedeuten „Studien“ und „DGE“?').closest('details');
    expect(explanation?.textContent).toContain('veröffentlichte Studienartikel');
    expect(explanation?.textContent).toContain('Deutschen Gesellschaft für Ernährung');
  });

  it('keeps knowledge labels at least 12 px and reflows cards and actions on narrow screens', () => {
    const css = readFileSync(resolve(process.cwd(), 'src/styles.css'), 'utf8');
    const knowledgeCss = css.slice(
      css.indexOf('/* Knowledge database overview */'),
      css.indexOf('/* Knowledge magazine article template */'),
    );
    expect(knowledgeCss).not.toMatch(/font-size:\s*(?:[0-9](?:\.\d+)?|1[01](?:\.\d+)?)px/);
    expect(knowledgeCss).toMatch(/@media \(max-width: 620px\)[\s\S]*?\.knowledge-overview \.card-grid \{[\s\S]*?grid-template-columns: 1fr;/);
    expect(knowledgeCss).toMatch(/@media \(max-width: 620px\)[\s\S]*?\.knowledge-overview \.nutri__foot \{[\s\S]*?flex-direction: column;/);
    expect(knowledgeCss).toMatch(/@media \(max-width: 620px\)[\s\S]*?\.knowledge-overview \.db-state__actions \.btn \{[\s\S]*?width: 100%;/);
    expect(knowledgeCss).toContain('overflow-x: auto;');
  });

  it('shows loading, error, retry, and null-data states exclusively', async () => {
    let resolveFirst: ((value: unknown) => void) | undefined;
    const pending = new Promise((resolve) => { resolveFirst = resolve; });
    const fetchMock = vi.fn()
      .mockReturnValueOnce(pending)
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          articles: [],
          nutrient_statuses: [status(1, 'Wieder geladen', 'sonstige')],
          total: 0,
        }),
      });
    vi.stubGlobal('fetch', fetchMock);
    renderOverview('/wissen?q=test');

    expect(screen.getByRole('heading', { name: 'Wissensdatenbank wird geladen' }).closest('[role="status"]')).toBeTruthy();
    expect(screen.queryByRole('heading', { name: 'Nichts gefunden' })).toBeNull();
    resolveFirst?.(Promise.reject(new Error('interne Nachricht')));

    const error = await screen.findByRole('alert');
    expect(error.textContent).toContain('Die Wissensdatenbank konnte gerade nicht geladen werden');
    expect(error.textContent).not.toContain('interne Nachricht');
    expect(screen.queryByRole('heading', { name: 'Nichts gefunden' })).toBeNull();
    expect(document.querySelectorAll('.knowledge-overview .nutri')).toHaveLength(0);

    fireEvent.click(screen.getByRole('button', { name: 'Erneut versuchen' }));
    expect(await screen.findByText('Wieder geladen')).toBeTruthy();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('treats a malformed or empty central response as its own state and never restores the removed list', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ articles: [], total: 0 }),
    }));
    const first = renderOverview();
    expect(await screen.findByRole('alert')).toBeTruthy();
    expect(document.querySelectorAll('.knowledge-overview .nutri')).toHaveLength(0);
    expect(screen.queryByText('Vitamin A')).toBeNull();
    first.unmount();

    stubOverview([]);
    renderOverview();
    expect(await screen.findByRole('heading', { name: 'Noch keine Wirkstoffe verfügbar' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Erneut laden' })).toBeTruthy();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('reuses the HTML-started request once and ignores the obsolete v1 session cache', async () => {
    window.sessionStorage.setItem('knowledge-overview.v1', JSON.stringify({
      cached_at: Date.now(),
      payload: { articles: [], nutrient_statuses: [status(99, 'Veraltet', 'sonstige')] },
    }));
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    window.__knowledgeOverviewRequest = Promise.resolve(new Response(JSON.stringify({
      articles: [],
      nutrient_statuses: [status(1, 'Aktuell', 'sonstige')],
      total: 0,
    }), { status: 200, headers: { 'Content-Type': 'application/json' } }));

    renderOverview();
    expect(await screen.findByText('Aktuell')).toBeTruthy();
    expect(screen.queryByText('Veraltet')).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(window.__knowledgeOverviewRequest).toBeUndefined();
  });

  it('propagates cfcheck, overview filters, and search to the API and article link', async () => {
    const fetchMock = stubOverview([
      status(3, 'Magnesium', 'mineralstoffe'),
    ], [article('magnesium', 3, 'Magnesium')]);
    renderOverview('/wissen?category=mineralstoffe&q=magnesium&cfcheck=sha256%3Aabc123');

    const link = await screen.findByRole('link', { name: /Magnesium/ });
    expect(String(fetchMock.mock.calls[0][0])).toMatch(/\/api\/knowledge\?cfcheck=sha256%3Aabc123$/);
    expect(link.getAttribute('href')).toBe('/wissen/magnesium?category=mineralstoffe&q=magnesium&cfcheck=sha256%3Aabc123');
  });

  it('prefetches a ready article when its card is approached', async () => {
    const fetchMock = vi.fn((input: RequestInfo | URL) => {
      if (String(input).includes('/api/knowledge/magnesium')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve({
            article: {
              slug: 'magnesium',
              title: 'Magnesium',
              summary: 'Mineralstoffartikel',
              body: 'Vollständiger Artikel',
              sources: [],
            },
          }),
        });
      }
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve({
          articles: [article('magnesium', 3, 'Magnesium')],
          nutrient_statuses: [status(3, 'Magnesium', 'mineralstoffe')],
          total: 1,
        }),
      });
    });
    vi.stubGlobal('fetch', fetchMock);
    renderOverview();

    fireEvent.pointerEnter(await screen.findByRole('link', { name: /Magnesium/ }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    expect(String(fetchMock.mock.calls[1][0])).toMatch(/\/api\/knowledge\/magnesium$/);
  });
});
