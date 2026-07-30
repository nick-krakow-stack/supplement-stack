import { useEffect, useLayoutEffect, useMemo, useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { ArrowLeft, ExternalLink } from 'lucide-react';
import { apiPath } from '../api/base';
import type { KnowledgeArticle } from '../types';
import {
  hasUnsafeKnowledgeUrlCharacters,
  isMagazineKnowledgeArticle,
  isRenderableKnowledgeSource,
  KnowledgeMagazineArticle,
  KnowledgeSourceInternalArticleLinks,
  normalizeKnowledgeSourceUrl,
} from './KnowledgeMagazineArticle';
import {
  type KnowledgeMarkdownBlock,
  parseKnowledgeMarkdown,
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
      if (/^quellen?$/i.test(block.text.trim())) {
        active = null;
        skippingSources = true;
        continue;
      }
      skippingSources = false;
      const isFazit = /^fazit$/i.test(block.text.trim());
      const id = isFazit ? 'fazit' : studySectionId(block.text, usedIds);
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
  return value
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/[*_`~]+/g, '')
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
  const [article, setArticle] = useState<KnowledgeArticle | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const articleApiEndpoint = useMemo(
    () => slug ? knowledgeApiPathWithCacheCheck(`/knowledge/${encodeURIComponent(slug)}`, location.search) : null,
    [location.search, slug],
  );

  useEffect(() => {
    if (!slug || !articleApiEndpoint) {
      setArticle(null);
      setError('Artikel nicht gefunden.');
      setLoading(false);
      return;
    }

    const controller = new AbortController();
    let active = true;
    setArticle(null);
    setLoading(true);
    setError('');

    fetch(articleApiEndpoint, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error(response.status === 404 ? 'Artikel nicht gefunden.' : 'Artikel konnte nicht geladen werden.');
        return response.json() as Promise<{ article?: KnowledgeArticle }>;
      })
      .then((data) => {
        if (!active) return;
        if (!data.article || data.article.slug !== slug) {
          setArticle(null);
          setError('Artikel konnte nicht eindeutig geladen werden.');
          return;
        }
        setArticle(data.article);
      })
      .catch((err) => {
        if (!active || (err instanceof DOMException && err.name === 'AbortError')) return;
        setError(err instanceof Error ? err.message : 'Artikel konnte nicht geladen werden.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
      controller.abort();
    };
  }, [articleApiEndpoint, slug]);

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

    const structuredData: Record<string, unknown> = visibleArticle.seo?.json_ld ?? {
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
  const useMagazineTemplate = isMagazineKnowledgeArticle(normalizedBody);
  const backToKnowledgeOverview = `/wissen${location.search}`;
  const stageIngredientName = visibleArticle?.ingredients?.length === 1
    ? visibleArticle.ingredients[0].name?.trim() || null
    : null;
  const visibleSources = useMemo(
    () => visibleArticle?.sources.filter(isRenderableKnowledgeSource) ?? [],
    [visibleArticle],
  );
  const studySections = useMemo(
    () => (visibleArticle && !useMagazineTemplate ? buildStudyArticleSections(normalizedBody) : []),
    [normalizedBody, useMagazineTemplate, visibleArticle],
  );
  const routeTransitionPending = Boolean(article && slug && article.slug !== slug);
  const showLoading = loading || routeTransitionPending;

  return (
    <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
      <Link
        to={backToKnowledgeOverview}
        className="mb-8 inline-flex items-center gap-2 text-sm font-bold text-slate-500 transition-colors hover:text-slate-900"
      >
        <ArrowLeft size={16} />
        Zurück
      </Link>

      {showLoading && (
        <div className="rounded-xl border border-slate-200 bg-white p-8 text-sm font-semibold text-slate-500 shadow-sm">
          Artikel wird geladen...
        </div>
      )}

      {!showLoading && error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-8 text-sm font-bold text-red-700">
          {error}
        </div>
      )}

      {!showLoading && visibleArticle && useMagazineTemplate && (
        <KnowledgeMagazineArticle key={visibleArticle.slug} article={visibleArticle} reviewedDate={reviewedDate} />
      )}

      {!showLoading && visibleArticle && !useMagazineTemplate && (
        <article
          data-testid="knowledge-study-article"
          data-template="study_article_v2"
          data-ui-contract="knowledge-study-article-ui.v2"
          className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8"
        >
          <div className="mb-6 border-b border-slate-100 pb-6">
            <h1 className="break-words text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">{visibleArticle.title}</h1>
            <p data-knowledge-ui="dek" className="mt-4 text-base font-semibold leading-relaxed text-slate-600">{visibleArticle.summary}</p>
            <div className="mt-4 flex flex-wrap gap-3 text-sm font-semibold text-slate-500">
              {stageIngredientName && (
                <span data-knowledge-ui="ingredient-chip">Wirkstoffe: {stageIngredientName}</span>
              )}
              {reviewedDate && (
                <span data-knowledge-ui="reviewed-date">Geprüft am {reviewedDate}</span>
              )}
            </div>
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
                    {section.title}
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
                        <Link to={normalizedUrl.href} className={className}>
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
    </main>
  );
}
