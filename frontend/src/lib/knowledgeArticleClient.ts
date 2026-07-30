import type { KnowledgeArticle } from '../types';

type KnowledgeArticleBootstrap = {
  article?: KnowledgeArticle;
};

declare global {
  interface Window {
    __knowledgeArticleBootstrap?: KnowledgeArticleBootstrap;
  }
}

const ARTICLE_CACHE_PREFIX = 'knowledge-article.v1:';
const ARTICLE_CACHE_TTL_MS = 5 * 60 * 1000;
const prefetchRequests = new Map<string, Promise<KnowledgeArticle>>();

type CachedKnowledgeArticle = {
  cached_at: number;
  article: KnowledgeArticle;
};

function articleCacheKey(slug: string): string {
  return `${ARTICLE_CACHE_PREFIX}${slug}`;
}

function parseArticlePayload(value: unknown, slug: string): KnowledgeArticle | null {
  if (!value || typeof value !== 'object') return null;
  const article = (value as { article?: KnowledgeArticle }).article;
  return article?.slug === slug ? article : null;
}

function readSessionArticle(slug: string): KnowledgeArticle | null {
  try {
    const stored = window.sessionStorage.getItem(articleCacheKey(slug));
    if (!stored) return null;
    const cached = JSON.parse(stored) as CachedKnowledgeArticle;
    if (
      typeof cached.cached_at !== 'number'
      || Date.now() - cached.cached_at > ARTICLE_CACHE_TTL_MS
      || cached.article?.slug !== slug
    ) {
      window.sessionStorage.removeItem(articleCacheKey(slug));
      return null;
    }
    return cached.article;
  } catch {
    return null;
  }
}

function writeSessionArticle(article: KnowledgeArticle): void {
  try {
    window.sessionStorage.setItem(articleCacheKey(article.slug), JSON.stringify({
      cached_at: Date.now(),
      article,
    } satisfies CachedKnowledgeArticle));
  } catch {
    // Prefetch remains an optional optimization when browser storage is unavailable.
  }
}

export function readPrimedKnowledgeArticle(slug: string): KnowledgeArticle | null {
  return parseArticlePayload(window.__knowledgeArticleBootstrap, slug) ?? readSessionArticle(slug);
}

async function fetchKnowledgeArticle(slug: string, endpoint: string): Promise<KnowledgeArticle> {
  const response = await fetch(endpoint, { headers: { Accept: 'application/json' } });
  if (!response.ok) {
    throw new Error(response.status === 404 ? 'Artikel nicht gefunden.' : 'Artikel konnte nicht geladen werden.');
  }
  const article = parseArticlePayload(await response.json(), slug);
  if (!article) throw new Error('Artikel konnte nicht eindeutig geladen werden.');
  return article;
}

export function prefetchKnowledgeArticle(slug: string, endpoint: string): Promise<KnowledgeArticle> {
  const primed = readPrimedKnowledgeArticle(slug);
  if (primed) return Promise.resolve(primed);

  const existing = prefetchRequests.get(slug);
  if (existing) return existing;

  const request = fetchKnowledgeArticle(slug, endpoint)
    .then((article) => {
      writeSessionArticle(article);
      return article;
    })
    .finally(() => {
      prefetchRequests.delete(slug);
    });
  prefetchRequests.set(slug, request);
  return request;
}

export function loadKnowledgeArticle(
  slug: string,
  endpoint: string,
  bypassPrimedArticle = false,
): Promise<KnowledgeArticle> {
  if (!bypassPrimedArticle) {
    const primed = readPrimedKnowledgeArticle(slug);
    if (primed) return Promise.resolve(primed);
    const prefetched = prefetchRequests.get(slug);
    if (prefetched) return prefetched;
  }
  return fetchKnowledgeArticle(slug, endpoint);
}
