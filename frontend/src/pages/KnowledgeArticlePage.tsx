import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useNavigationType, useParams } from 'react-router-dom';
import { ArrowLeft, ExternalLink } from 'lucide-react';
import { apiPath } from '../api/base';
import {
  loadKnowledgeArticle,
  KnowledgeArticleLoadError,
  readPrimedKnowledgeArticle,
} from '../lib/knowledgeArticleClient';
import type { KnowledgeArticle } from '../types';
import { knowledgeCategoryLabel } from '../lib/knowledgeCategories';
import { knowledgeContextLabel, knowledgeNavigationState, knowledgeOverviewSearch } from '../lib/knowledgeNavigation';
import { KnowledgeArticleActions } from './KnowledgeArticleActions';
import KnowledgeArticleRecovery from './KnowledgeArticleRecovery';
import {
  hasUnsafeKnowledgeUrlCharacters,
  deduplicateKnowledgeSources,
  isRenderableKnowledgeSource,
  KnowledgeMagazineArticle,
  KnowledgeSourceInternalArticleLinks,
  normalizeKnowledgeSourceUrl,
} from './KnowledgeMagazineArticle';
import {
  knowledgeInlineMarkdownToText,
  type KnowledgeMarkdownBlock,
  parseKnowledgeMarkdown,
  renderKnowledgeInlineMarkdown,
  renderKnowledgeMarkdownBlock,
} from './KnowledgeMarkdown';

type StudyArticleSection = {
  id: string;
  title: string;
  blocks: KnowledgeMarkdownBlock[];
};

function studySectionId(title: string, usedIds: Set<string>): string {
  const base = title
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/ß/g, 'ss')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'abschnitt';
  let candidate = base;
  let suffix = 2;
  while (usedIds.has(candidate)) {
    candidate = `${base}-${suffix}`;
    suffix += 1;
  }
  usedIds.add(candidate);
  return candidate;
}

function buildStudyArticleSections(markdown: string): StudyArticleSection[] {
  const blocks = parseKnowledgeMarkdown(markdown);
  const usedIds = new Set<string>(['quellen']);
  const sections: StudyArticleSection[] = [];
  let active: StudyArticleSection | null = null;
  let skippingSources = false;

  for (const block of blocks) {
    if (block.type === 'heading' && block.level === 2) {
      const headingText = knowledgeInlineMarkdownToText(block.text).trim();
      if (/^quellen?$/i.test(headingText)) {
        active = null;
        skippingSources = true;
        continue;
      }
      skippingSources = false;
      const isFazit = /^fazit$/i.test(headingText);
      const id = isFazit ? 'fazit' : studySectionId(headingText, usedIds);
      usedIds.add(id);
      active = { id, title: block.text, blocks: [] };
      sections.push(active);
      continue;
    }

    if (skippingSources) continue;
    if (!active) {
      if (block.type === 'heading' && block.level === 1) continue;
      const lead = sections.find((section) => section.id === 'lead') ?? { id: 'lead', title: '', blocks: [] };
      if (!sections.includes(lead)) sections.unshift(lead);
      lead.blocks.push(block);
      continue;
    }
    active.blocks.push(block);
  }

  return sections;
}

function formatReviewedDate(value?: string | null): string | null {
  if (!value) return null;
  const dateOnly = /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : null;
  const date = new Date(dateOnly ? `${dateOnly}T12:00:00.000Z` : value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('de-DE', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'UTC',
  }).format(date);
}

function normalizeSeoTimestamp(value?: string | null): { value: string; time: number } | null {
  if (!value) return null;
  const dateOnly = /^\d{4}-\d{2}-\d{2}$/.test(value);
  const sqliteUtc = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}(?:\.\d{1,3})?$/.test(value)
    ? `${value.replace(' ', 'T')}Z`
    : value;
  const parsed = new Date(dateOnly ? `${value}T00:00:00.000Z` : sqliteUtc);
  if (Number.isNaN(parsed.getTime())) return null;
  return { value: dateOnly ? value : parsed.toISOString(), time: parsed.getTime() };
}

export function knowledgeSeoTimestamps(article: KnowledgeArticle): { publishedAt: string | null; modifiedAt: string | null } {
  const published = normalizeSeoTimestamp(article.created_at)
    ?? normalizeSeoTimestamp(article.reviewed_at);
  if (!published) return { publishedAt: null, modifiedAt: null };

  const fallbackModified = [article.reviewed_at, article.updated_at]
    .map(normalizeSeoTimestamp)
    .filter((entry): entry is { value: string; time: number } => entry !== null)
    .sort((left, right) => right.time - left.time)[0] ?? published;
  return {
    publishedAt: published.value,
    modifiedAt: fallbackModified.time >= published.time ? fallbackModified.value : published.value,
  };
}

function normalizeSeoText(value: string): string {
  return knowledgeInlineMarkdownToText(value)
    .replace(/\s+/g, ' ')
    .trim();
}

function buildKnowledgeArticleUrl(slug: string): string {
  return new URL(`/wissen/${encodeURIComponent(slug)}`, window.location.origin).href;
}

function knowledgeApiPathWithCacheCheck(path: string, search: string): string {
  const routeParams = new URLSearchParams(search);
  const endpoint = apiPath(path);
  if (!routeParams.has('cfcheck')) return endpoint;

  const endpointUrl = new URL(endpoint, window.location.origin);
  endpointUrl.searchParams.set('cfcheck', routeParams.get('cfcheck') ?? '');
  return endpoint.startsWith('/') ? `${endpointUrl.pathname}${endpointUrl.search}` : endpointUrl.href;
}

function normalizeKnowledgeImageUrl(value?: string | null): string | null {
  if (
    typeof value !== 'string'
    || value.length === 0
    || value !== value.trim()
    || hasUnsafeKnowledgeUrlCharacters(value)
  ) {
    return null;
  }

  try {
    if (value.startsWith('/')) {
      if (value.startsWith('//')) return null;
      const parsed = new URL(value, window.location.origin);
      return parsed.origin === window.location.origin ? parsed.href : null;
    }

    const lowerCaseValue = value.toLowerCase();
    if (!lowerCaseValue.startsWith('https://') && !lowerCaseValue.startsWith('http://')) return null;

    const parsed = new URL(value);
    if (
      !['https:', 'http:'].includes(parsed.protocol)
      || !parsed.hostname
      || parsed.username
      || parsed.password
    ) {
      return null;
    }
    return parsed.href;
  } catch {
    return null;
  }
}

function firstBoundKnowledgeBodyAsset(article: KnowledgeArticle): string | null {
  const expectedPath = new RegExp(`^/api/r2/knowledge/${article.slug}/[a-f0-9]{64}\\.(?:png|jpg)$`);
  for (const block of parseKnowledgeMarkdown(article.body)) {
    if (block.type !== 'image') continue;
    const normalized = normalizeKnowledgeImageUrl(block.src);
    if (!normalized) continue;
    const parsed = new URL(normalized);
    if (parsed.origin === window.location.origin && expectedPath.test(parsed.pathname) && !parsed.search && !parsed.hash) {
      return parsed.href;
    }
  }
  return null;
}

function knowledgeOrganization(origin: string): Record<string, string> {
  return {
    '@type': 'Organization',
    '@id': new URL('/#organization', origin).href,
    name: 'Supplement Stack',
    url: new URL('/', origin).href,
  };
}

function serializeJsonLd(value: unknown): string {
  const escapedCharacters: Record<string, string> = {
    '<': '\\u003c',
    '>': '\\u003e',
    '&': '\\u0026',
    '\u2028': '\\u2028',
    '\u2029': '\\u2029',
  };

  return JSON.stringify(value).replace(/[<>&\u2028\u2029]/g, (character) => escapedCharacters[character]);
}

function setHeadAttribute(
  selector: string,
  createElement: () => HTMLElement,
  attributeName: string,
  value: string,
): () => void {
  const existingElement = document.head.querySelector<HTMLElement>(selector);
  const element = existingElement ?? createElement();
  const created = existingElement === null;
  const previousValue = element.getAttribute(attributeName);

  if (created) {
    element.dataset.knowledgeArticleMeta = 'true';
    document.head.append(element);
  }
  element.setAttribute(attributeName, value);

  return () => {
    if (!element.isConnected) return;

    if (element.getAttribute(attributeName) !== value) {
      if (created) delete element.dataset.knowledgeArticleMeta;
      return;
    }

    if (created) {
      element.remove();
    } else if (previousValue === null) {
      element.removeAttribute(attributeName);
    } else {
      element.setAttribute(attributeName, previousValue);
    }
  };
}

function createMetaTag(attributeName: 'name' | 'property', attributeValue: string): HTMLMetaElement {
  const element = document.createElement('meta');
  element.setAttribute(attributeName, attributeValue);
  return element;
}

export default function KnowledgeArticlePage() {
  const { slug } = useParams();
  const location = useLocation();
  const navigationType = useNavigationType();
  const previousArticleSlugRef = useRef<string | null>(null);
  const bypassPrimedArticle = useMemo(
    () => new URLSearchParams(location.search).has('cfcheck'),
    [location.search],
  );
  const initialArticle = useMemo(
    () => slug && !bypassPrimedArticle ? readPrimedKnowledgeArticle(slug) : null,
    [bypassPrimedArticle, slug],
  );
  const [article, setArticle] = useState<KnowledgeArticle | null>(initialArticle);
  const [loading, setLoading] = useState(initialArticle === null);
  const [error, setError] = useState('');
  const [errorStatus, setErrorStatus] = useState(0);
  const [loadAttempt, setLoadAttempt] = useState(0);

  useLayoutEffect(() => {
    const previousSlug = previousArticleSlugRef.current;
    previousArticleSlugRef.current = slug ?? null;
    if (!slug || previousSlug === slug || navigationType === 'POP' || location.hash) return;
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
  }, [location.hash, navigationType, slug]);
  const articleApiEndpoint = useMemo(
    () => slug ? knowledgeApiPathWithCacheCheck(`/knowledge/${encodeURIComponent(slug)}`, location.search) : null,
    [location.search, slug],
  );
  useEffect(() => {
    if (!slug || !articleApiEndpoint) {
      setArticle(null);
      setError('Artikel nicht gefunden.');
      setErrorStatus(404);
      setLoading(false);
      return;
    }

    let active = true;
    const primedArticle = bypassPrimedArticle ? null : readPrimedKnowledgeArticle(slug);
    setArticle(primedArticle);
    setLoading(primedArticle === null);
    setError('');
    setErrorStatus(0);

    loadKnowledgeArticle(slug, articleApiEndpoint, bypassPrimedArticle)
      .then((loadedArticle) => {
        if (!active) return;
        setArticle(loadedArticle);
      })
      .catch((err) => {
        if (!active) return;
        setError(err instanceof Error ? err.message : 'Artikel konnte nicht geladen werden.');
        setErrorStatus(err instanceof KnowledgeArticleLoadError ? err.status : 0);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [articleApiEndpoint, bypassPrimedArticle, slug, loadAttempt]);

  const visibleArticle = article && slug && article.slug === slug ? article : null;

  useLayoutEffect(() => {
    if (!visibleArticle || !slug) return;

    const articleTitle = normalizeSeoText(visibleArticle.seo?.meta_title ?? visibleArticle.title);
    const description = normalizeSeoText(visibleArticle.seo?.meta_description ?? visibleArticle.summary);
    const canonicalUrl = visibleArticle.seo?.canonical_url ?? buildKnowledgeArticleUrl(slug);
    const imageUrl = firstBoundKnowledgeBodyAsset(visibleArticle);
    const { publishedAt, modifiedAt } = knowledgeSeoTimestamps(visibleArticle);
    const organization = knowledgeOrganization(window.location.origin);
    const pageTitle = articleTitle;
    const previousTitle = document.title;
    const restoreHeadAttributes = [
      setHeadAttribute(
        'meta[name="description"]',
        () => createMetaTag('name', 'description'),
        'content',
        description,
      ),
      setHeadAttribute(
        'meta[name="robots"]',
        () => createMetaTag('name', 'robots'),
        'content',
        visibleArticle.seo?.robots ?? 'index,follow',
      ),
      setHeadAttribute(
        'link[rel="canonical"]',
        () => {
          const element = document.createElement('link');
          element.setAttribute('rel', 'canonical');
          return element;
        },
        'href',
        canonicalUrl,
      ),
      setHeadAttribute(
        'meta[property="og:title"]',
        () => createMetaTag('property', 'og:title'),
        'content',
        articleTitle,
      ),
      setHeadAttribute(
        'meta[property="og:description"]',
        () => createMetaTag('property', 'og:description'),
        'content',
        description,
      ),
      setHeadAttribute(
        'meta[property="og:url"]',
        () => createMetaTag('property', 'og:url'),
        'content',
        canonicalUrl,
      ),
      setHeadAttribute(
        'meta[property="og:type"]',
        () => createMetaTag('property', 'og:type'),
        'content',
        'article',
      ),
    ];

    if (imageUrl) {
      restoreHeadAttributes.push(
        setHeadAttribute(
          'meta[property="og:image"]',
          () => createMetaTag('property', 'og:image'),
          'content',
          imageUrl,
        ),
      );
    }

    const storedStructuredData = visibleArticle.seo?.json_ld;
    const structuredData: Record<string, unknown> = storedStructuredData
      ? {
        ...storedStructuredData,
        ...(typeof storedStructuredData.headline === 'string'
          ? { headline: normalizeSeoText(storedStructuredData.headline) }
          : {}),
        ...(typeof storedStructuredData.description === 'string'
          ? { description: normalizeSeoText(storedStructuredData.description) }
          : {}),
      }
      : {
        '@context': 'https://schema.org',
        '@type': 'Article',
        headline: articleTitle,
        description,
        mainEntityOfPage: canonicalUrl,
        inLanguage: 'de',
        ...(publishedAt && modifiedAt ? { datePublished: publishedAt, dateModified: modifiedAt } : {}),
        author: organization,
        publisher: organization,
        ...(imageUrl ? { image: imageUrl } : {}),
      };
    const structuredDataElement = document.createElement('script');
    structuredDataElement.type = 'application/ld+json';
    structuredDataElement.dataset.knowledgeArticleJsonLd = 'true';
    structuredDataElement.textContent = serializeJsonLd(structuredData);
    document.head.append(structuredDataElement);
    document.title = pageTitle;

    return () => {
      structuredDataElement.remove();
      for (const restore of restoreHeadAttributes.reverse()) restore();
      if (document.title === pageTitle) document.title = previousTitle;
    };
  }, [slug, visibleArticle]);

  const reviewedDate = formatReviewedDate(visibleArticle?.reviewed_at);
  const normalizedBody = visibleArticle?.body ?? '';
  const useMagazineTemplate = visibleArticle?.article_layer === 'main_article';
  const inheritedNavigationState = knowledgeNavigationState(location.state);
  const overviewSearch = knowledgeOverviewSearch(location.search) || inheritedNavigationState.overviewSearch || '';
  const backToKnowledgeOverview = `/wissen${overviewSearch}`;
  const navigationState = { ...inheritedNavigationState, overviewSearch };
  const overviewParams = new URLSearchParams(overviewSearch);
  const filterName = knowledgeCategoryLabel(overviewParams.get('category'));
  const filterQuery = overviewParams.get('q')?.trim();
  const filterDescription = [overviewParams.get('saved') === '1' ? 'Gemerkte Artikel' : null, filterName, filterQuery ? `Suche „${filterQuery}“` : null].filter(Boolean).join(' · ');
  const stageIngredientName = visibleArticle?.ingredients?.length === 1
    ? visibleArticle.ingredients[0].name?.trim() || null
    : null;
  const visibleSources = useMemo(
    () => deduplicateKnowledgeSources(visibleArticle?.sources.filter(isRenderableKnowledgeSource) ?? []),
    [visibleArticle],
  );
  const studySections = useMemo(
    () => (visibleArticle && !useMagazineTemplate ? buildStudyArticleSections(normalizedBody) : []),
    [normalizedBody, useMagazineTemplate, visibleArticle],
  );
  const routeTransitionPending = Boolean(article && slug && article.slug !== slug);
  const showLoading = loading || routeTransitionPending;
  const missingArticle = errorStatus === 404 || errorStatus === 410;

  useLayoutEffect(() => {
    if (showLoading || !error) return;
    const previousTitle = document.title;
    const title = `${missingArticle ? 'Artikel nicht gefunden' : 'Artikel gerade nicht erreichbar'} | Supplement Stack`;
    document.title = title;
    const restore = setHeadAttribute('meta[name="robots"]', () => createMetaTag('name', 'robots'), 'content', 'noindex,follow');
    return () => { restore(); if (document.title === title) document.title = previousTitle; };
  }, [error, missingArticle, showLoading]);

  const relatedArticles = visibleArticle?.related_articles ?? [];
  const mainArticles = useMagazineTemplate ? [] : relatedArticles.filter((related) => related.article_layer === 'main_article');
  const linkedSourcePaths = new Set(visibleSources.flatMap((source) => [source.url, ...(source.internal_articles ?? []).map((entry) => entry.url)]).map((url) => url.split(/[?#]/)[0]));
  const furtherArticles = relatedArticles.filter((related) => (
    related.slug !== visibleArticle?.slug
    && !mainArticles.some((entry) => entry.slug === related.slug)
    && !linkedSourcePaths.has(`/wissen/${related.slug}`)
  ));
  const editorialInfo = (
    <details className="mt-4 text-sm text-slate-600" data-projection-additive-navigation="true">
      <summary className="min-h-11 cursor-pointer py-3 font-bold">Redaktion und Artikelstand</summary>
      <p className="py-2">Verantwortlich für diese Wissensseite: <Link to="/impressum" className="font-bold text-blue-700 underline">Supplement Stack</Link>.</p>
      {reviewedDate && <p className="py-2">Der angezeigte Prüfstand bezieht sich auf den {reviewedDate}.</p>}
      {visibleArticle?.update_reason && <p className="py-2"><strong>Grund der letzten Aktualisierung:</strong> {visibleArticle.update_reason}</p>}
    </details>
  );

  return (
    <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
      <Link
        to={backToKnowledgeOverview}
        state={navigationState}
        className="mb-8 inline-flex items-center gap-2 text-sm font-bold text-slate-500 transition-colors hover:text-slate-900"
      >
        <ArrowLeft size={16} />
        Zur Wissensübersicht
      </Link>
      {filterDescription && <p className="-mt-5 mb-6 text-sm text-slate-600">Deine Auswahl bleibt erhalten: {filterDescription}.</p>}
      {navigationState.returnTo && <Link to={navigationState.returnTo} className="mb-6 flex min-h-11 items-center gap-2 text-sm font-bold text-blue-700 underline">{knowledgeContextLabel(navigationState.returnTo)}</Link>}

      {showLoading && (
        <div role="status" aria-live="polite" className="rounded-xl border border-slate-200 bg-white p-8 text-base font-semibold text-slate-600 shadow-sm">
          Artikel wird geladen …
        </div>
      )}

      {!showLoading && error && (
        <KnowledgeArticleRecovery key={slug} missing={missingArticle} slug={slug ?? ''} onRetry={() => setLoadAttempt((attempt) => attempt + 1)} />
      )}

      {!showLoading && visibleArticle && useMagazineTemplate && (
        <KnowledgeMagazineArticle key={visibleArticle.slug} article={visibleArticle} reviewedDate={reviewedDate} navigationState={navigationState} heroActions={<KnowledgeArticleActions key={visibleArticle.slug} slug={visibleArticle.slug} title={knowledgeInlineMarkdownToText(visibleArticle.title)} />} editorialInfo={editorialInfo} />
      )}

      {!showLoading && visibleArticle && !useMagazineTemplate && (
        <article
          data-testid="knowledge-study-article"
          data-template="study_article_v2"
          data-ui-contract="knowledge-study-article-ui.v2"
          className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8"
        >
          <div className="mb-6 border-b border-slate-100 pb-6">
            {mainArticles.length > 0 && <nav className="mb-5 space-y-2" aria-label="Einordnung zum Wirkstoff">{mainArticles.map((related) => <Link key={related.slug} to={`/wissen/${related.slug}${overviewSearch}`} state={navigationState} className="block min-h-11 rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 text-base font-bold text-blue-800 hover:underline">Einordnung zu {related.ingredients.map((ingredient) => ingredient.name).join(', ')}</Link>)}</nav>}
            <h1 tabIndex={-1} className="break-words text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">{renderKnowledgeInlineMarkdown(visibleArticle.title)}</h1>
            <p data-knowledge-ui="dek" className="mt-4 text-base font-semibold leading-relaxed text-slate-600">{renderKnowledgeInlineMarkdown(visibleArticle.summary)}</p>
            <div className="mt-4 flex flex-wrap gap-3 text-sm font-semibold text-slate-500">
              {stageIngredientName && (
                <span data-knowledge-ui="ingredient-chip">Wirkstoff: {stageIngredientName}</span>
              )}
              {reviewedDate && (
                <span data-knowledge-ui="reviewed-date">Geprüft am {reviewedDate}</span>
              )}
            </div>
            <KnowledgeArticleActions key={visibleArticle.slug} slug={visibleArticle.slug} title={knowledgeInlineMarkdownToText(visibleArticle.title)} />
            {editorialInfo}
          </div>

          <div data-study-content className="space-y-4">
            {studySections.map((section) => (
              <section
                key={section.id}
                id={section.id}
                data-study-section
                data-study-kind={section.id === 'fazit' ? 'fazit' : 'content'}
                className={section.id === 'fazit' ? 'mt-8 rounded-lg border border-emerald-100 bg-emerald-50 p-5' : 'space-y-4'}
              >
                {section.title && (
                  <h2 className={section.id === 'fazit'
                    ? 'text-sm font-black uppercase tracking-[0.12em] text-emerald-700'
                    : 'mt-8 text-xl font-black tracking-tight text-slate-950 sm:text-2xl'}>
                    {renderKnowledgeInlineMarkdown(section.title)}
                  </h2>
                )}
                {section.blocks.map(renderKnowledgeMarkdownBlock)}
              </section>
            ))}
          </div>

          {visibleSources.length > 0 && (
            <section id="quellen" data-study-section data-study-kind="sources" className="mt-8 border-t border-slate-100 pt-6">
              <h2 data-knowledge-ui="sources-label" className="text-sm font-black uppercase tracking-[0.12em] text-slate-500">Quellen</h2>
              <span className="sr-only" data-knowledge-ui="sources-count">
                {visibleSources.length} {visibleSources.length === 1 ? 'Quelle' : 'Quellen'}
              </span>
              <p className="mt-2 text-sm text-slate-600">{visibleSources.length} {visibleSources.length === 1 ? 'Originalquelle bildet' : 'Originalquellen bilden'} die Grundlage dieses Artikels. Dort findest du die genauen Ergebnisse und Grenzen.</p>
              <ul className="mt-4 space-y-3">
                {visibleSources.map((source, index) => {
                  const normalizedUrl = normalizeKnowledgeSourceUrl(source.url);
                  const label = source.label.trim();
                  const className = 'source-link inline-flex items-start gap-2 text-sm font-bold text-blue-700 hover:text-blue-900';
                  const content = (
                    <>
                      <ExternalLink size={15} className="mt-0.5 shrink-0" aria-hidden="true" />
                      <span>{label}</span>
                    </>
                  );

                  return (
                    <li key={`${source.url}-${label}-${index}`} data-source-id={source.source_id ?? ''}>
                      {normalizedUrl?.kind === 'internal' ? (
                        <Link to={normalizedUrl.href} state={navigationState} className={className}>
                          {content}
                        </Link>
                      ) : normalizedUrl?.kind === 'external' ? (
                        <a
                          href={normalizedUrl.href}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={className}
                        >
                          {content}
                        </a>
                      ) : (
                        <span className="text-sm font-semibold text-slate-600" data-invalid-source-url="true">
                          {label}
                        </span>
                      )}
                      <KnowledgeSourceInternalArticleLinks
                        source={source}
                        navigationState={navigationState}
                        className="source-internal-links mt-2 flex flex-col gap-1 pl-6"
                      />
                    </li>
                  );
                })}
              </ul>
            </section>
          )}
        </article>
      )}
      {!showLoading && visibleArticle && furtherArticles.length > 0 && (
        <nav className="mt-8 rounded-2xl border border-slate-200 bg-white p-6" aria-label="Verwandte Wissensartikel">
          <h2 className="text-xl font-black text-slate-900">Weiterlesen zum Wirkstoff</h2>
          <p className="mt-2 text-base text-slate-600">Diese Artikel sind mit denselben Wirkstoffen verknüpft.</p>
          <ul className="mt-4 space-y-3">{furtherArticles.map((related) => <li key={related.slug}><Link to={`/wissen/${related.slug}${overviewSearch}`} state={navigationState} className="inline-flex min-h-11 items-center break-words font-bold text-blue-700 underline">{renderKnowledgeInlineMarkdown(related.title)}</Link></li>)}</ul>
        </nav>
      )}
      {!showLoading && visibleArticle && !useMagazineTemplate && <a href="#" onClick={(event) => { event.preventDefault(); window.scrollTo({ top: 0, behavior: 'auto' }); document.querySelector<HTMLElement>('main h1')?.focus({ preventScroll: true }); }} className="mt-6 inline-flex min-h-11 items-center font-bold text-blue-700 underline">Nach oben</a>}
    </main>
  );
}
