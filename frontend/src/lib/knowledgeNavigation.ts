import { safeInternalReturnTo } from './returnTo';

export type KnowledgeNavigationState = { returnTo?: string; overviewScroll?: number; overviewSearch?: string };

export function knowledgeNavigationState(value: unknown): KnowledgeNavigationState {
  if (!value || typeof value !== 'object') return {};
  const candidate = value as Record<string, unknown>;
  const safe = safeInternalReturnTo(candidate.returnTo, '');
  const pathname = safe.split(/[?#]/)[0];
  const returnTo = ['/stacks', '/demo', '/einnahmeplan'].includes(pathname) ? safe : undefined;
  const overviewScroll = typeof candidate.overviewScroll === 'number'
    && Number.isFinite(candidate.overviewScroll) && candidate.overviewScroll >= 0
    ? candidate.overviewScroll : undefined;
  const overviewSearch = typeof candidate.overviewSearch === 'string' && candidate.overviewSearch.length <= 2048
    ? knowledgeOverviewSearch(candidate.overviewSearch) : '';
  return { ...(returnTo ? { returnTo } : {}), ...(overviewScroll !== undefined ? { overviewScroll } : {}), ...(overviewSearch ? { overviewSearch } : {}) };
}

export function knowledgeContextLabel(returnTo: string): string {
  if (returnTo.startsWith('/demo')) return 'Zurück zur Demo';
  if (returnTo.startsWith('/einnahmeplan')) return 'Zurück zum Einnahmeplan';
  return 'Zurück zu meinen Stacks';
}

export function knowledgeOverviewSearch(search: string): string {
  const incoming = new URLSearchParams(search);
  const result = new URLSearchParams();
  for (const name of ['category', 'q', 'saved', 'cfcheck']) {
    const value = incoming.get(name);
    if (value !== null) result.set(name, value);
  }
  return result.size ? `?${result}` : '';
}

export function publicKnowledgeArticleUrl(slug: string, hash = ''): string {
  const url = new URL(`/wissen/${encodeURIComponent(slug)}`, window.location.origin);
  if (hash) url.hash = hash;
  return url.href;
}

const SAVED_ARTICLES_KEY = 'knowledge-saved-slugs.v1';
export const SAVED_ARTICLES_EVENT = 'knowledge-saved-articles-changed';

export function readSavedKnowledgeSlugs(): string[] {
  try {
    const value: unknown = JSON.parse(window.localStorage.getItem(SAVED_ARTICLES_KEY) ?? '[]');
    return Array.isArray(value)
      ? [...new Set(value.filter((slug): slug is string => typeof slug === 'string' && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)))]
      : [];
  } catch {
    return [];
  }
}

export function setKnowledgeArticleSaved(slug: string, saved: boolean): void {
  const slugs = new Set(readSavedKnowledgeSlugs());
  if (saved) slugs.add(slug);
  else slugs.delete(slug);
  window.localStorage.setItem(SAVED_ARTICLES_KEY, JSON.stringify([...slugs]));
  window.dispatchEvent(new Event(SAVED_ARTICLES_EVENT));
}
