import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useSearchParams } from 'react-router-dom';
import { KNOWLEDGE_CATEGORY_LABELS } from '../lib/knowledgeCategories';
import { knowledgeNavigationState } from '../lib/knowledgeNavigation';
import SavedKnowledgeArticles from './SavedKnowledgeArticles';
import { apiPath } from '../api/base';
import {
  isKnowledgeOverviewResponse,
  type KnowledgeOverviewResponse,
  readCachedKnowledgeOverview,
  writeCachedKnowledgeOverview,
} from '../lib/knowledgeOverviewClient';
import type { KnowledgeArticleOverviewItem, KnowledgeNutrientStatus } from '../types';

type CategoryKey =
  | 'vitamine'
  | 'mineralstoffe'
  | 'spurenelemente'
  | 'aminosaeuren_proteine'
  | 'fettsaeuren'
  | 'pflanzenstoffe_extrakte'
  | 'heilpilze'
  | 'enzyme'
  | 'probiotika'
  | 'sonstige';

type IconKey = keyof typeof ICON_PATHS;

type CategoryConfig = {
  key: CategoryKey;
  label: string;
  cssClass: string;
  icon: IconKey;
  description: string;
};

type NutrientCard = {
  ingredientId: number;
  category: CategoryKey;
  name: string;
  description: string | null;
  aliases: string[];
  solubility: 'fat' | 'water' | null;
  article: KnowledgeArticleOverviewItem | null;
  status: KnowledgeNutrientStatus;
};

const ICON_PATHS = {
  heart: '<path d="M19 5a5 5 0 0 0-7 0l-0 0-0-0a5 5 0 0 0-7 7l7 7 7-7a5 5 0 0 0 0-7Z"/>',
  muscle: '<path d="M4 7c4-3 12-3 16 0 1 4-1 9-5 10-1 .3-2 1-3 2-1-1-2-1.7-3-2-4-1-6-6-5-10Z"/>',
  flask: '<path d="M9 3h6M10 3v6l-5 9a2 2 0 0 0 2 3h10a2 2 0 0 0 2-3l-5-9V3"/><path d="M7 16h10"/>',
  atom: '<circle cx="12" cy="12" r="2"/><path d="M12 2a14 6 0 0 0 0 20 14 6 0 0 0 0-20Z" transform="rotate(60 12 12)"/><path d="M12 2a14 6 0 0 0 0 20 14 6 0 0 0 0-20Z" transform="rotate(-60 12 12)"/>',
  wave: '<path d="M2 12c2-4 4-4 6 0s4 4 6 0 4-4 6 0"/>',
  spark: '<path d="M12 2v6M12 16v6M2 12h6M16 12h6M5 5l3 3M16 16l3 3M19 5l-3 3M8 16l-3 3"/>',
  sprout: '<path d="M12 22V11M12 11C12 7 9 4 4 4c0 4 3 7 8 7ZM12 13c0-4 3-7 8-7 0 4-3 7-8 7Z"/>',
  fish: '<path d="M3 12c4-5 11-5 15 0-4 5-11 5-15 0Z"/><path d="M18 12c1.5-1.5 3-1.5 3-1.5s0 3-3 1.5ZM8 11h.01"/>',
  leaf: '<path d="M5 19c5-2 9-6 11-11 1 5-2 12-8 12-2 0-3-1-3-1Z"/><path d="M16 8c1-2 3-3 3-3"/>',
  arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/>',
  x: '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
} as const;

const CATEGORIES: CategoryConfig[] = [
  {
    key: 'vitamine',
    label: KNOWLEDGE_CATEGORY_LABELS.vitamine,
    cssClass: 'c-vit',
    icon: 'spark',
    description: 'Vitamine und vitaminähnliche Stoffe',
  },
  {
    key: 'mineralstoffe',
    label: KNOWLEDGE_CATEGORY_LABELS.mineralstoffe,
    cssClass: 'c-min',
    icon: 'atom',
    description: 'Mineralstoffe, die der Körper in größeren Mengen benötigt',
  },
  {
    key: 'spurenelemente',
    label: KNOWLEDGE_CATEGORY_LABELS.spurenelemente,
    cssClass: 'c-spur',
    icon: 'flask',
    description: 'Mineralstoffe, von denen der Körper nur kleine Mengen benötigt',
  },
  {
    key: 'aminosaeuren_proteine',
    label: KNOWLEDGE_CATEGORY_LABELS.aminosaeuren_proteine,
    cssClass: 'c-amino-protein',
    icon: 'muscle',
    description: 'Aminosäuren, Eiweiße und verwandte Stoffe',
  },
  {
    key: 'fettsaeuren',
    label: KNOWLEDGE_CATEGORY_LABELS.fettsaeuren,
    cssClass: 'c-fett',
    icon: 'fish',
    description: 'Fettsäuren und daraus gewonnene Produkte',
  },
  {
    key: 'pflanzenstoffe_extrakte',
    label: KNOWLEDGE_CATEGORY_LABELS.pflanzenstoffe_extrakte,
    cssClass: 'c-pflz-extrakt',
    icon: 'sprout',
    description: 'Pflanzen, Pflanzenstoffe und Extrakte',
  },
  {
    key: 'heilpilze',
    label: KNOWLEDGE_CATEGORY_LABELS.heilpilze,
    cssClass: 'c-heilpilz',
    icon: 'leaf',
    description: 'Pilze und Pilzextrakte im Nahrungsergänzungsbereich',
  },
  {
    key: 'enzyme',
    label: KNOWLEDGE_CATEGORY_LABELS.enzyme,
    cssClass: 'c-enzyme',
    icon: 'flask',
    description: 'Enzyme und enzymähnliche Stoffe',
  },
  {
    key: 'probiotika',
    label: KNOWLEDGE_CATEGORY_LABELS.probiotika,
    cssClass: 'c-probiotika',
    icon: 'heart',
    description: 'Lebende Kulturen und verwandte Produkte',
  },
  {
    key: 'sonstige',
    label: KNOWLEDGE_CATEGORY_LABELS.sonstige,
    cssClass: 'c-sonstige',
    icon: 'wave',
    description: 'Weitere Wirkstoffe außerhalb der anderen Gruppen',
  },
];

const CATEGORY_KEYS = new Set<CategoryKey>(CATEGORIES.map((category) => category.key));
const CATEGORY_BY_KEY = new Map(CATEGORIES.map((category) => [category.key, category]));

function isCategoryKey(value: string | null | undefined): value is CategoryKey {
  return typeof value === 'string' && CATEGORY_KEYS.has(value as CategoryKey);
}

function getActiveCategory(searchParams: URLSearchParams): CategoryKey | 'all' {
  const category = searchParams.get('category');
  return isCategoryKey(category) ? category : 'all';
}

function getSearchQuery(searchParams: URLSearchParams): string {
  return searchParams.get('q') ?? '';
}

function getCacheCheck(searchParams: URLSearchParams): string | null {
  return searchParams.has('cfcheck') ? searchParams.get('cfcheck') ?? '' : null;
}

function buildOverviewSearch(category: CategoryKey | 'all', query: string, cacheCheck: string | null = null): string {
  const params = new URLSearchParams();
  if (category !== 'all') params.set('category', category);
  if (query.trim()) params.set('q', query);
  if (cacheCheck !== null) params.set('cfcheck', cacheCheck);
  const search = params.toString();
  return search ? `?${search}` : '';
}

function SvgIcon({ icon, className }: { icon: IconKey; className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      dangerouslySetInnerHTML={{ __html: ICON_PATHS[icon] }}
    />
  );
}

function normalizeSearchText(value: string): string {
  return value
    .replace(/Ä/g, 'Ae')
    .replace(/Ö/g, 'Oe')
    .replace(/Ü/g, 'Ue')
    .replace(/ä/g, 'ae')
    .replace(/ö/g, 'oe')
    .replace(/ü/g, 'ue')
    .replace(/ẞ/g, 'SS')
    .replace(/ß/g, 'ss')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('de-DE')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function toPositiveInteger(value: unknown): number | null {
  const numeric = typeof value === 'number' ? value : Number(value);
  return Number.isInteger(numeric) && numeric > 0 ? numeric : null;
}

function articleIngredientIds(article: KnowledgeArticleOverviewItem): number[] {
  const ids = new Set<number>();
  article.ingredient_ids?.forEach((value) => {
    const id = toPositiveInteger(value);
    if (id !== null) ids.add(id);
  });
  article.ingredients?.forEach((ingredient) => {
    const id = toPositiveInteger(ingredient.ingredient_id);
    if (id !== null) ids.add(id);
  });
  return [...ids];
}

function buildNutrientCards(
  articles: KnowledgeArticleOverviewItem[],
  statuses: KnowledgeNutrientStatus[],
): NutrientCard[] {
  const articlesByIngredient = new Map<number, KnowledgeArticleOverviewItem>();
  articles.forEach((article) => {
    articleIngredientIds(article).forEach((ingredientId) => {
      if (!articlesByIngredient.has(ingredientId)) articlesByIngredient.set(ingredientId, article);
    });
  });

  const uniqueStatuses = new Map<number, KnowledgeNutrientStatus>();
  statuses.forEach((status) => {
    const ingredientId = toPositiveInteger(status.ingredient_id);
    if (ingredientId !== null && !uniqueStatuses.has(ingredientId)) uniqueStatuses.set(ingredientId, status);
  });

  return [...uniqueStatuses.entries()].flatMap(([ingredientId, status]) => {
    const name = status.name?.trim();
    if (!name) return [];
    const category = isCategoryKey(status.category_key) ? status.category_key : 'sonstige';
    const aliases = Array.isArray(status.aliases)
      ? [...new Set(status.aliases.map((alias) => alias.trim()).filter(Boolean))]
      : [];
    return [{
      ingredientId,
      category,
      name,
      description: status.description?.trim() || null,
      aliases,
      solubility: status.solubility === 'fat' || status.solubility === 'water' ? status.solubility : null,
      article: articlesByIngredient.get(ingredientId) ?? null,
      status,
    }];
  }).sort((left, right) => {
    const categoryOrder = CATEGORIES.findIndex((category) => category.key === left.category)
      - CATEGORIES.findIndex((category) => category.key === right.category);
    return categoryOrder || left.name.localeCompare(right.name, 'de');
  });
}

function cardSearchText(card: NutrientCard, category: CategoryConfig): string {
  return [
    card.name,
    card.description ?? '',
    ...card.aliases,
    category.label,
    category.description,
  ].join(' ');
}

function solubilityLabel(solubility: NutrientCard['solubility']): string | null {
  if (solubility === 'fat') return 'fettlöslich';
  if (solubility === 'water') return 'wasserlöslich';
  return null;
}

function pluralize(count: number, singular: string, plural: string): string {
  return `${count} ${count === 1 ? singular : plural}`;
}

function CoverageBadges({ card }: { card: NutrientCard }) {
  if (!card.status.has_studies && !card.status.has_dge) return null;

  return (
    <div className="nutri__tags" aria-label={`${card.name}: vorhandene Informationen`}>
      {card.status.has_studies && (
        <span
          className="tag-data tag-data--studies"
          title="Zu diesem Wirkstoff gibt es veröffentlichte Studienartikel."
          aria-label="Veröffentlichte Studienartikel vorhanden"
        >
          Studien
        </span>
      )}
      {card.status.has_dge && (
        <span
          className="tag-data tag-data--dge"
          title="Ein öffentlicher DGE-Referenzwert ist vorhanden."
          aria-label="DGE-Referenzwert vorhanden"
        >
          DGE
        </span>
      )}
    </div>
  );
}

function CardBody({ card }: { card: NutrientCard }) {
  const category = CATEGORY_BY_KEY.get(card.category) ?? CATEGORIES[CATEGORIES.length - 1];
  const solubility = solubilityLabel(card.solubility);
  return (
    <>
      <div className="nutri__top">
        <span className="nutri__ic">
          <SvgIcon icon={category.icon} />
        </span>
      </div>
      <h3>{card.name}</h3>
      {card.description && <p>{card.description}</p>}
      {solubility && (
        <div className="nutri__sol">
          <span className={`tag-sm ${card.solubility}`}>{solubility}</span>
        </div>
      )}
    </>
  );
}

function ComingCard({ card }: { card: NutrientCard }) {
  return (
    <article
      className="nutri coming"
      data-ingredient-id={card.ingredientId}
      data-ingredient-ids={card.ingredientId}
      data-name={normalizeSearchText(card.name)}
      data-cat={card.category}
    >
      <CardBody card={card} />
      <div className="nutri__foot">
        <CoverageBadges card={card} />
      </div>
    </article>
  );
}

function ReadyCard({ card, search }: { card: NutrientCard & { article: KnowledgeArticleOverviewItem }; search: string }) {
  const location = useLocation();
  const prefetchArticle = () => {
    if (new URLSearchParams(search).has('cfcheck')) return;
    void Promise.all([
      import('./KnowledgeArticlePage'),
      import('../lib/knowledgeArticleClient').then(({ prefetchKnowledgeArticle }) => (
        prefetchKnowledgeArticle(
          card.article.slug,
          apiPath(`/knowledge/${encodeURIComponent(card.article.slug)}`),
        )
      )),
    ]).catch(() => undefined);
  };

  return (
    <Link
      className="nutri is-ready"
      to={`/wissen/${card.article.slug}${search}`}
      state={{ ...knowledgeNavigationState(location.state), overviewSearch: search }}
      data-ingredient-id={card.ingredientId}
      data-ingredient-ids={card.ingredientId}
      data-name={normalizeSearchText(card.name)}
      data-cat={card.category}
      onFocus={prefetchArticle}
      onPointerEnter={prefetchArticle}
      onTouchStart={prefetchArticle}
    >
      <CardBody card={card} />
      <div className="nutri__foot">
        <CoverageBadges card={card} />
        <span className="nutri__go">
          Artikel lesen
          <SvgIcon icon="arrow" />
        </span>
      </div>
    </Link>
  );
}

export default function KnowledgeOverviewPage() {
  const location = useLocation();
  return new URLSearchParams(location.search).get('saved') === '1'
    ? <SavedKnowledgeArticles /> : <KnowledgeOverview />;
}

function KnowledgeOverview() {
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const query = getSearchQuery(searchParams);
  const activeCategory = getActiveCategory(searchParams);
  const cacheCheck = getCacheCheck(searchParams);
  const cachedOverview = useMemo(
    () => (cacheCheck === null ? readCachedKnowledgeOverview() : null),
    [cacheCheck],
  );
  const [overview, setOverview] = useState<KnowledgeOverviewResponse | null>(cachedOverview);
  const [loading, setLoading] = useState(cachedOverview === null);
  const [error, setError] = useState('');
  const [loadAttempt, setLoadAttempt] = useState(0);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const canonicalSearch = buildOverviewSearch(activeCategory, query, cacheCheck);
  const currentSearch = searchParams.toString();
  useEffect(() => {
    const canonicalParams = new URLSearchParams(canonicalSearch.startsWith('?') ? canonicalSearch.slice(1) : canonicalSearch);
    if (currentSearch !== canonicalParams.toString()) setSearchParams(canonicalParams, { replace: true, state: knowledgeNavigationState(location.state) });
  }, [canonicalSearch, currentSearch, setSearchParams, location.state]);

  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    setError('');
    setLoading(true);
    if (cacheCheck !== null) setOverview(null);

    const endpoint = apiPath(`/knowledge${cacheCheck === null ? '' : `?cfcheck=${encodeURIComponent(cacheCheck)}`}`);
    const bootstrapRequest = cacheCheck === null ? window.__knowledgeOverviewRequest : undefined;
    if (bootstrapRequest) delete window.__knowledgeOverviewRequest;
    const request = bootstrapRequest
      ? bootstrapRequest.then((response) => response.clone())
      : fetch(endpoint, { signal: controller.signal, headers: { Accept: 'application/json' } });

    request
      .then(async (response) => {
        if (!response.ok) throw new Error('knowledge-overview-response');
        const data: unknown = await response.json();
        if (!isKnowledgeOverviewResponse(data)) throw new Error('knowledge-overview-shape');
        return data;
      })
      .then((data) => {
        if (!active) return;
        setOverview(data);
        setLoading(false);
        writeCachedKnowledgeOverview(data);
      })
      .catch((caught) => {
        if (!active) return;
        if (caught instanceof DOMException && caught.name === 'AbortError') return;
        setOverview(null);
        setLoading(false);
        setError('Die Wissensdatenbank konnte gerade nicht geladen werden. Bitte versuche es erneut.');
      });

    return () => {
      active = false;
      controller.abort();
    };
  }, [cacheCheck, loadAttempt]);

  const cards = useMemo(
    () => buildNutrientCards(overview?.articles ?? [], overview?.nutrient_statuses ?? []),
    [overview],
  );
  const normalizedQuery = normalizeSearchText(query);
  const hasQuery = query.trim().length > 0;
  const hasActiveFilters = hasQuery || activeCategory !== 'all';
  const articleSearch = buildOverviewSearch(activeCategory, query, cacheCheck);
  const categories = useMemo(() => CATEGORIES.filter((category) => (
    cards.some((card) => card.category === category.key)
  )), [cards]);

  const groupedCards = useMemo(() => categories.map((category) => {
    const categoryCards = cards.filter((card) => {
      if (card.category !== category.key) return false;
      if (activeCategory !== 'all' && activeCategory !== category.key) return false;
      if (!normalizedQuery) return true;
      return normalizeSearchText(cardSearchText(card, category)).includes(normalizedQuery);
    });
    return { category, cards: categoryCards };
  }), [activeCategory, cards, categories, normalizedQuery]);

  const visibleCount = groupedCards.reduce((sum, group) => sum + group.cards.length, 0);
  const suggestions = cards.slice(0, 3);
  const hasCoverageBadges = cards.some((card) => card.status.has_dge || card.status.has_studies);

  const updateOverviewSearch = (nextCategory: CategoryKey | 'all', nextQuery: string) => {
    const nextSearch = buildOverviewSearch(nextCategory, nextQuery, cacheCheck);
    setSearchParams(new URLSearchParams(nextSearch.startsWith('?') ? nextSearch.slice(1) : nextSearch), { replace: true, state: knowledgeNavigationState(location.state) });
  };

  const resetOverviewSearch = () => {
    updateOverviewSearch('all', '');
    searchInputRef.current?.focus();
  };

  return (
    <div className="knowledge-overview">
      <section className="db-hero">
        <div className="db-hero__in">
          <span className="eyebrow">Wissensdatenbank</span>
          <h1>Alles über Vitamine, Mineralstoffe &amp; Co. – einfach erklärt</h1>
          <p className="dek">
            Hier findest du, was über einen Wirkstoff bekannt ist, wo er vorkommt und welche Grenzen der Wissensstand hat.
            Verständlich erklärt und mit Quellen.
          </p>
          <Link to={`/wissen?${new URLSearchParams({ ...Object.fromEntries(new URLSearchParams(canonicalSearch)), saved: '1' })}`} state={knowledgeNavigationState(location.state)} className="mb-4 inline-flex min-h-11 items-center font-bold text-blue-700 underline underline-offset-4">Gemerkte Artikel ansehen</Link>

          <div className={`db-search${hasQuery ? ' has-text' : ''}`}>
            <SvgIcon icon="search" className="mag" />
            <input
              ref={searchInputRef}
              type="search"
              value={query}
              onChange={(event) => updateOverviewSearch(activeCategory, event.target.value)}
              onKeyDown={(event) => {
                if (event.key !== 'Escape') return;
                event.preventDefault();
                updateOverviewSearch(activeCategory, '');
              }}
              placeholder="Wirkstoff suchen – z. B. Vitamin D, Magnesium oder Eisen …"
              autoComplete="off"
              aria-label="Wirkstoff suchen"
              aria-controls="knowledge-results"
            />
            {hasQuery && (
              <button
                type="button"
                className="clear"
                onClick={() => updateOverviewSearch(activeCategory, '')}
                aria-label="Suche löschen"
              >
                <SvgIcon icon="x" />
              </button>
            )}
          </div>

          <div className="db-stats" aria-label="Umfang der Wissensdatenbank">
            <div className="db-stat">
              <b>{loading || error ? '–' : cards.length}</b>
              <span>{loading ? 'Wirkstoffe werden geladen' : error ? 'Wirkstoffe zurzeit nicht verfügbar' : 'Wirkstoffe'}</span>
            </div>
            <div className="db-stat">
              <b>{loading || error ? '–' : categories.length}</b>
              <span>{loading ? 'Kategorien werden geladen' : error ? 'Kategorien zurzeit nicht verfügbar' : 'Kategorien'}</span>
            </div>
            <div className="db-stat">
              <b>{loading || error ? '–' : overview?.articles.length ?? 0}</b>
              <span>{loading ? 'Artikel werden geladen' : error ? 'Artikel zurzeit nicht verfügbar' : pluralize(overview?.articles.length ?? 0, 'ausführlicher Artikel', 'ausführliche Artikel').replace(/^\d+ /, '')}</span>
            </div>
          </div>
        </div>
      </section>

      {!loading && !error && cards.length > 0 && (
        <div className="filter-bar" aria-label="Wissensdatenbank filtern">
          <div className="filter-bar__in">
            <button
              type="button"
              className={`filter-pill${activeCategory === 'all' ? ' is-active' : ''}`}
              aria-pressed={activeCategory === 'all'}
              aria-controls="knowledge-results"
              onClick={() => updateOverviewSearch('all', query)}
            >
              Alle
              <span className="ct">{cards.length}</span>
            </button>
            {categories.map((category) => {
              const count = cards.filter((card) => card.category === category.key).length;
              return (
                <button
                  key={category.key}
                  type="button"
                  className={`filter-pill ${category.cssClass}${activeCategory === category.key ? ' is-active' : ''}`}
                  aria-pressed={activeCategory === category.key}
                  aria-controls="knowledge-results"
                  onClick={() => updateOverviewSearch(category.key, query)}
                >
                  <span className="dot" aria-hidden="true" />
                  {category.label}
                  <span className="ct">{count}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      <main className="db-body" id="knowledge-results">
        {loading && !error && (
          <div className="db-state" role="status" aria-live="polite">
            <SvgIcon icon="search" />
            <h2>Wissensdatenbank wird geladen</h2>
            <p>Die Wirkstoffe und Artikel werden vorbereitet.</p>
          </div>
        )}

        {!loading && error && (
          <div className="db-state db-state--error" role="alert">
            <SvgIcon icon="search" />
            <h2>Laden fehlgeschlagen</h2>
            <p>{error}</p>
            <div className="db-state__actions">
              <button type="button" className="btn btn--primary" onClick={() => setLoadAttempt((attempt) => attempt + 1)}>
                Erneut versuchen
              </button>
              {hasActiveFilters && (
                <button type="button" className="btn btn--secondary" onClick={resetOverviewSearch}>
                  Suche und Filter zurücksetzen
                </button>
              )}
            </div>
          </div>
        )}

        {!loading && !error && cards.length === 0 && (
          <div className="db-empty show" role="status">
            <SvgIcon icon="search" />
            <h2>Noch keine Wirkstoffe verfügbar</h2>
            <p>Die Übersicht enthält zurzeit keine freigegebenen Wirkstoffe.</p>
            <div className="db-state__actions">
              <button type="button" className="btn btn--primary" onClick={() => setLoadAttempt((attempt) => attempt + 1)}>
                Erneut laden
              </button>
            </div>
          </div>
        )}

        {!loading && !error && cards.length > 0 && (
          <p className="db-results" role="status" aria-live="polite" aria-atomic="true">
            {hasActiveFilters
              ? pluralize(visibleCount, 'Treffer', 'Treffer')
              : pluralize(cards.length, 'Wirkstoff', 'Wirkstoffe')}
          </p>
        )}

        {!loading && !error && visibleCount > 0 && hasCoverageBadges && (
          <details className="db-status-help">
            <summary>Was bedeuten „Studien“ und „DGE“?</summary>
            <p><strong>Studien</strong> bedeutet: Es gibt veröffentlichte Studienartikel zu diesem Wirkstoff.</p>
            <p><strong>DGE</strong> bedeutet: Ein öffentlicher Referenzwert der Deutschen Gesellschaft für Ernährung ist vorhanden.</p>
          </details>
        )}

        {!loading && !error && cards.length > 0 && visibleCount === 0 && (
          <div className="db-empty show">
            <SvgIcon icon="search" />
            <h2>Nichts gefunden</h2>
            <p>Versuche einen kürzeren Suchbegriff oder wähle eine andere Kategorie.</p>
            {suggestions.length > 0 && (
              <div className="db-suggestions" aria-label="Suchvorschläge">
                <span>Du kannst auch danach suchen:</span>
                <div>
                  {suggestions.map((card) => (
                    <button
                      key={card.ingredientId}
                      type="button"
                      onClick={() => updateOverviewSearch('all', card.name)}
                    >
                      {card.name}
                    </button>
                  ))}
                </div>
              </div>
            )}
            <div className="db-state__actions">
              <button type="button" className="btn btn--primary" onClick={resetOverviewSearch}>
                Suche und Filter zurücksetzen
              </button>
            </div>
          </div>
        )}

        {!loading && !error && visibleCount > 0 && groupedCards.map(({ category, cards: categoryCards }) => {
          if (categoryCards.length === 0) return null;
          return (
            <section
              key={category.key}
              className={`cat-block ${category.cssClass}`}
              data-testid={`knowledge-category-${category.key}`}
            >
              <header className="cat-head">
                <span className="cat-head__ic">
                  <SvgIcon icon={category.icon} />
                </span>
                <div>
                  <h2>{category.label}</h2>
                  <p className="sub">{category.description}</p>
                </div>
                <span className="meta">{pluralize(categoryCards.length, 'Eintrag', 'Einträge')}</span>
              </header>

              <div className="card-grid">
                {categoryCards.map((card) => (
                  card.article
                    ? <ReadyCard key={card.ingredientId} card={{ ...card, article: card.article }} search={articleSearch} />
                    : <ComingCard key={card.ingredientId} card={card} />
                ))}
              </div>
            </section>
          );
        })}
      </main>
    </div>
  );
}
