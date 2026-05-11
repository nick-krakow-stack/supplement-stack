const GA_MEASUREMENT_ID = 'G-QVHTTK2CNP';
const GA_SCRIPT_ID = 'supplement-stack-ga4-script';
export const ANALYTICS_CONSENT_STORAGE_KEY = 'supplement-stack-analytics-consent';
export const ANALYTICS_CONSENT_RESET_EVENT = 'supplement-stack:analytics-consent-reset';
const ATTRIBUTION_STORAGE_KEY = 'supplement-stack-attribution';
const VISITOR_ID_STORAGE_KEY = 'supplement-stack-visitor-id';

type GtagArguments = [command: string, ...args: unknown[]];
export type AnalyticsConsent = 'accepted' | 'declined';

declare global {
  interface Window {
    dataLayer?: GtagArguments[];
    gtag?: (...args: GtagArguments) => void;
  }
}

let analyticsInitialized = false;
let analyticsConsentGranted = false;
let scriptRequested = false;
let lastTrackedPath: string | null = null;

export type SignupAttribution = {
  visitor_id: string;
  first_referrer_host: string | null;
  first_referrer_source: string | null;
  first_landing_path: string;
  first_seen_at: string;
  last_referrer_host: string | null;
  last_referrer_source: string | null;
  last_landing_path: string;
  last_seen_at: string;
};

function isBrowser() {
  return typeof window !== 'undefined' && typeof document !== 'undefined';
}

function randomToken(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}

function readVisitorId(): string {
  if (!isBrowser()) return `ssv-${randomToken()}`;

  try {
    const existing = window.localStorage.getItem(VISITOR_ID_STORAGE_KEY);
    if (existing) return existing;
    const next = `ssv-${randomToken()}`;
    window.localStorage.setItem(VISITOR_ID_STORAGE_KEY, next);
    return next;
  } catch {
    return `ssv-${randomToken()}`;
  }
}

function referrerHost(value: string): string | null {
  if (!value) return null;
  try {
    return new URL(value).hostname.replace(/^www\./, '').toLowerCase().slice(0, 120);
  } catch {
    return null;
  }
}

function referrerSource(host: string | null): string | null {
  if (!host) return null;
  const currentHost = window.location.hostname.replace(/^www\./, '').toLowerCase();
  if (host === currentHost || host.endsWith(`.${currentHost}`)) return 'internal';
  if (host.includes('google.')) return 'google';
  if (host.includes('bing.')) return 'bing';
  if (host.includes('duckduckgo.')) return 'duckduckgo';
  return 'external';
}

function readAttribution(): SignupAttribution | null {
  if (!isBrowser()) return null;
  try {
    const raw = window.localStorage.getItem(ATTRIBUTION_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<SignupAttribution>;
    return typeof parsed.visitor_id === 'string' && typeof parsed.first_seen_at === 'string'
      ? (parsed as SignupAttribution)
      : null;
  } catch {
    return null;
  }
}

function updateAttribution(path: string): SignupAttribution {
  const visitorId = readVisitorId();
  const host = referrerHost(document.referrer || '');
  const source = referrerSource(host);
  const now = new Date().toISOString();
  const existing = readAttribution();
  const shouldUpdateLast = source !== 'internal';
  const first = existing ?? {
    visitor_id: visitorId,
    first_referrer_host: host,
    first_referrer_source: source,
    first_landing_path: path,
    first_seen_at: now,
    last_referrer_host: host,
    last_referrer_source: source,
    last_landing_path: path,
    last_seen_at: now,
  };
  const next: SignupAttribution = shouldUpdateLast
    ? {
        ...first,
        visitor_id: first.visitor_id || visitorId,
        last_referrer_host: host,
        last_referrer_source: source,
        last_landing_path: path,
        last_seen_at: now,
      }
    : first;

  try {
    window.localStorage.setItem(ATTRIBUTION_STORAGE_KEY, JSON.stringify(next));
  } catch {
    // The in-memory return value is still useful for the current registration.
  }
  return next;
}

export function getSignupAttribution(): SignupAttribution | null {
  return readAttribution();
}

function ensureGtagQueue() {
  window.dataLayer = window.dataLayer || [];
  window.gtag =
    window.gtag ||
    function gtag(...args: GtagArguments) {
      window.dataLayer?.push(args);
    };
}

function loadGtagScript() {
  if (scriptRequested || document.getElementById(GA_SCRIPT_ID)) return;

  const script = document.createElement('script');
  script.id = GA_SCRIPT_ID;
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`;
  document.head.appendChild(script);
  scriptRequested = true;
}

export function readStoredAnalyticsConsent(): AnalyticsConsent | null {
  if (!isBrowser()) return null;

  try {
    const value = window.localStorage.getItem(ANALYTICS_CONSENT_STORAGE_KEY);
    return value === 'accepted' || value === 'declined' ? value : null;
  } catch {
    return null;
  }
}

export function persistAnalyticsConsent(consent: AnalyticsConsent) {
  if (!isBrowser()) return;

  try {
    window.localStorage.setItem(ANALYTICS_CONSENT_STORAGE_KEY, consent);
  } catch {
    // Keep the in-memory choice for this session if storage is unavailable.
  }
}

export function revokeAnalyticsConsent() {
  if (!isBrowser()) return;

  analyticsConsentGranted = false;
  lastTrackedPath = null;

  if (!window.gtag) return;

  window.gtag('consent', 'update', {
    ad_storage: 'denied',
    ad_user_data: 'denied',
    ad_personalization: 'denied',
    analytics_storage: 'denied',
  });
}

export function resetAnalyticsConsentChoice() {
  if (!isBrowser()) return;

  try {
    window.localStorage.removeItem(ANALYTICS_CONSENT_STORAGE_KEY);
  } catch {
    // The banner still reopens through the in-memory event below.
  }

  revokeAnalyticsConsent();
  window.dispatchEvent(new Event(ANALYTICS_CONSENT_RESET_EVENT));
}

export function initializeAnalytics() {
  if (!isBrowser()) return;

  ensureGtagQueue();
  if (!analyticsInitialized) {
    window.gtag?.('consent', 'default', {
      ad_storage: 'denied',
      ad_user_data: 'denied',
      ad_personalization: 'denied',
      analytics_storage: 'denied',
    });
    window.gtag?.('js', new Date());
    window.gtag?.('config', GA_MEASUREMENT_ID, {
      send_page_view: false,
    });
    loadGtagScript();
    analyticsInitialized = true;
  }

  window.gtag?.('consent', 'update', {
    ad_storage: 'denied',
    ad_user_data: 'denied',
    ad_personalization: 'denied',
    analytics_storage: 'granted',
  });
  analyticsConsentGranted = true;
}

export function trackPageView(path: string) {
  if (!isBrowser() || !analyticsInitialized || !analyticsConsentGranted || !window.gtag) return;
  if (lastTrackedPath === path) return;

  lastTrackedPath = path;
  const attribution = updateAttribution(path);
  window.gtag('event', 'page_view', {
    page_title: document.title,
    page_location: `${window.location.origin}${path}`,
    page_path: path,
  });

  void fetch('/api/analytics/pageview', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      path,
      referrer: document.referrer || null,
      visitor_id: attribution.visitor_id,
    }),
    credentials: 'include',
    keepalive: true,
  }).catch(() => {
    // Analytics must never interrupt normal page usage.
  });
}
