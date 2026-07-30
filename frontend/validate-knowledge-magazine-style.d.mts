export class StyleContractError extends Error {
  readonly code: string;
  readonly exit_code: number;
}

export type RouteContractCheck = {
  id: string;
  result: 'PASS' | 'FAIL';
  error_codes: string[];
};

export type RouteContractAssessment = {
  checks: RouteContractCheck[];
  errors: Array<{ code: string; message: string; expected?: unknown; actual?: unknown }>;
  result: 'PASS' | 'FAIL';
};

export function assessHydratedRouteState(state: unknown, fixture: unknown): RouteContractAssessment;
export function assessPublicRouteState(
  state: unknown,
  expected: unknown,
  viewportName?: 'desktop' | 'mobile',
  releaseHash?: string | null,
): {
  projection: unknown;
  projection_hash: string;
  seo: unknown;
  seo_hash: string;
  asset_hashes: string[];
  checked: string[];
  mismatches: string[];
  result: 'MATCH' | 'MISMATCH';
};
export function createTemporaryBrowserProfile(implementation?: (prefix: string) => Promise<string>): Promise<string>;
export function spawnBrowserProcess(executable: string, args: string[], implementation?: (...args: unknown[]) => unknown): Promise<unknown>;
export function terminateBrowserProcess(child: unknown): Promise<void>;
export function removeBrowserProfile(path: string | undefined, implementation?: (...args: unknown[]) => Promise<void>): Promise<void>;
export function closeActualRouteServer(resources: unknown, closeHttpImplementation?: (server: unknown) => Promise<void>): Promise<void>;
export function startActualRouteServer(route: string, options?: {
  articles?: unknown[];
  knowledgeOverview?: unknown;
  productionApiFetch?: ((request: Request) => Promise<Response>) | null;
  publicRoutes?: string[];
  robotsText?: string;
  robotsStatus?: number;
  sitemapText?: string | ((origin: string) => string);
  sitemapStatus?: number;
  assets?: Array<{ path: string; content_type: string; bytes: Uint8Array | string }>;
}): Promise<{
  vite: { close(): Promise<void> };
  server: unknown;
  url: string;
  base_url: string;
  request_log: string[];
}>;
export type ReadbackResource = {
  url: string;
  fetch_status: 'FETCHED' | 'NOT_FOUND' | 'HTTP_ERROR' | 'NETWORK_ERROR';
  http_status: number | null;
  content_type?: string | null;
  body_hash: string | null;
  body: string;
};
export function assessRawHtmlReadback(readback: ReadbackResource, expected: unknown): {
  url: string;
  fetch_status: 'FETCHED' | 'NETWORK_ERROR';
  http_status: number | null;
  content_type: string | null;
  body_hash: string | null;
  title_match: boolean;
  article_text_match: boolean;
  article_json_ld_match: boolean;
  seo_delivery_state: 'RAW_HTML_MATCH' | 'CLIENT_RENDERED_ONLY';
};
export function buildSitemapReceipt(discovery: {
  discovery_url: string;
  sitemap_url: string;
  fetch_status: ReadbackResource['fetch_status'];
  http_status: number | null;
  body_hash: string | null;
  body: string;
}, articleUrl: string): {
  state: 'INCLUDED' | 'NOT_INCLUDED' | 'NOT_AVAILABLE';
  discovery_url: string;
  sitemap_url: string;
  fetch_status: ReadbackResource['fetch_status'];
  http_status: number | null;
  body_hash: string | null;
  article_url_match: boolean;
};
export type RobotsRule = { global_rule: 'ALLOW' | 'DISALLOW' | 'UNKNOWN'; matched_rule: string | null };
export type RobotsReceipt = {
  url: string;
  fetch_status: ReadbackResource['fetch_status'];
  http_status: number | null;
  body_hash: string | null;
  user_agent: string;
} & RobotsRule;
export function buildRobotsReceipt(readback: ReadbackResource, articleUrl: string, userAgent?: string): RobotsReceipt;
export function interpretRobotsTxt(body: string, articleUrl: string, userAgent?: string): RobotsRule;
export function deriveIndexabilityState(seo: { indexable?: boolean } | null, robotsTxt: RobotsReceipt):
  'INDEXABLE' | 'BLOCKED_BY_PAGE_META' | 'BLOCKED_BY_SITE_POLICY' | 'BLOCKED_BY_HTTP' | 'UNKNOWN';
export function deriveOriginIndexabilityState(robotsTxt: Pick<RobotsReceipt, 'global_rule' | 'fetch_status'>):
  'INDEXABLE' | 'BLOCKED_BY_SITE_POLICY' | 'BLOCKED_BY_HTTP' | 'UNKNOWN';
export type OverviewBadgeOriginReceipt = {
  origin: string;
  api: unknown;
  hydrated_overview: {
    url: string;
    viewport: { width: number; height: number; device_scale_factor: number };
    route_ready: boolean;
    api_request_url: string | null;
    cards: Array<{
      ingredient_id: number;
      card_match_count: number;
      studies_visible: boolean;
      dge_visible: boolean;
    }>;
  };
  result: 'MATCH' | 'MISMATCH';
  mismatches: string[];
};
export function buildOverviewBadgeOriginReceipt(value: {
  origin: string;
  apiUrl: URL;
  overviewUrl: URL;
  apiResult: {
    receipt: unknown;
    mismatches: string[];
    statuses: Array<{
      ingredient_id: number;
      has_studies: boolean;
      has_dge: boolean;
    }>;
  };
  overview: {
    route_ready: boolean;
    api_request_url: string | null;
    cards: Array<{
      ingredient_id: number;
      card_match_count: number;
      studies_visible: boolean;
      dge_visible: boolean;
    }>;
  };
  request: { affected_ingredient_ids: number[] };
}): OverviewBadgeOriginReceipt;
export function writeReceiptAtomic(path: string, serialized: string): Promise<void>;
export function main(argv?: string[]): Promise<void>;
