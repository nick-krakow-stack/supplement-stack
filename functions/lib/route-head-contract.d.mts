export type RouteJsonLd = Record<string, unknown> | readonly Record<string, unknown>[];
export interface RouteHeadInput {
  pathname: string;
  status?: number;
  title?: string | null;
  description?: string | null;
  jsonLd?: RouteJsonLd | null;
  image?: string | null;
}
export interface RouteHead {
  kind: string;
  title: string;
  description: string;
  robots: 'index,follow' | 'noindex,follow' | 'noindex,nofollow';
  canonicalUrl: string | null;
  ogType: 'article' | 'website';
  image: string;
  imageAlt: string;
  jsonLd: RouteJsonLd | null;
  status: number;
  cacheControl: string;
  referrerPolicy: string;
  indexable: boolean;
  authRequired: boolean;
}
export const SITE_ORIGIN: string;
export const DEFAULT_SOCIAL_IMAGE: string;
export const PUBLIC_SITEMAP_PATHS: readonly string[];
export function buildKnowledgeOverviewJsonLd(articles: readonly { slug: string; title: string; article_layer?: string | null }[]): RouteJsonLd;
export function resolveRouteHead(input: RouteHeadInput): RouteHead;
export function canonicalRouteRedirect(inputURL: string | URL): string | null;
export function normalizeIsoTimestamp(value: unknown): string | null;
export function renderRouteHeadHtml(head: RouteHead): string;
export function applyRouteHeadHtml(shell: string, head: RouteHead): string;
