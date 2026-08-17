import type {
  KnowledgeArticleOverviewItem,
  KnowledgeNutrientStatus,
} from '../types';

export type KnowledgeOverviewResponse = {
  articles: KnowledgeArticleOverviewItem[];
  nutrient_statuses: KnowledgeNutrientStatus[];
  total?: number;
};

declare global {
  interface Window {
    __knowledgeOverviewRequest?: Promise<Response>;
  }
}

const OVERVIEW_SESSION_CACHE_KEY = 'knowledge-overview.v2';
const OVERVIEW_SESSION_CACHE_TTL_MS = 5 * 60 * 1000;

type CachedKnowledgeOverview = {
  cached_at: number;
  payload: KnowledgeOverviewResponse;
};

export function isKnowledgeOverviewResponse(value: unknown): value is KnowledgeOverviewResponse {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<KnowledgeOverviewResponse>;
  return Array.isArray(candidate.articles)
    && Array.isArray(candidate.nutrient_statuses)
    && candidate.nutrient_statuses.every((status) => (
      status !== null
      && typeof status === 'object'
      && Number.isInteger(Number(status.ingredient_id))
      && Number(status.ingredient_id) > 0
      && typeof status.category_key === 'string'
      && Array.isArray(status.aliases)
    ));
}

export function readCachedKnowledgeOverview(): KnowledgeOverviewResponse | null {
  try {
    const raw = window.sessionStorage.getItem(OVERVIEW_SESSION_CACHE_KEY);
    if (!raw) return null;
    const cached = JSON.parse(raw) as CachedKnowledgeOverview;
    if (!Number.isFinite(cached.cached_at) || Date.now() - cached.cached_at > OVERVIEW_SESSION_CACHE_TTL_MS) {
      window.sessionStorage.removeItem(OVERVIEW_SESSION_CACHE_KEY);
      return null;
    }
    return isKnowledgeOverviewResponse(cached.payload) ? cached.payload : null;
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
