import type {
  KnowledgeArticleOverviewItem,
  KnowledgeNutrientStatus,
} from '../types';

export type KnowledgeOverviewResponse = {
  articles: KnowledgeArticleOverviewItem[];
  nutrient_statuses?: KnowledgeNutrientStatus[];
  total?: number;
};

declare global {
  interface Window {
    __knowledgeOverviewRequest?: Promise<Response>;
  }
}

const OVERVIEW_SESSION_CACHE_KEY = 'knowledge-overview.v1';
const OVERVIEW_SESSION_CACHE_TTL_MS = 5 * 60 * 1000;

type CachedKnowledgeOverview = {
  cached_at: number;
  payload: KnowledgeOverviewResponse;
};

export function readCachedKnowledgeOverview(): KnowledgeOverviewResponse | null {
  try {
    const raw = window.sessionStorage.getItem(OVERVIEW_SESSION_CACHE_KEY);
    if (!raw) return null;
    const cached = JSON.parse(raw) as CachedKnowledgeOverview;
    if (!Number.isFinite(cached.cached_at) || Date.now() - cached.cached_at > OVERVIEW_SESSION_CACHE_TTL_MS) {
      window.sessionStorage.removeItem(OVERVIEW_SESSION_CACHE_KEY);
      return null;
    }
    return cached.payload && Array.isArray(cached.payload.articles) ? cached.payload : null;
  } catch {
    return null;
  }
}

export function writeCachedKnowledgeOverview(payload: KnowledgeOverviewResponse): void {
  try {
    window.sessionStorage.setItem(OVERVIEW_SESSION_CACHE_KEY, JSON.stringify({
      cached_at: Date.now(),
      payload,
    } satisfies CachedKnowledgeOverview));
  } catch {
    // Public knowledge pages remain functional when browser storage is unavailable.
  }
}
