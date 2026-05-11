const GA_MEASUREMENT_ID = 'G-QVHTTK2CNP';
const GA_SCRIPT_ID = 'supplement-stack-ga4-script';
export const ANALYTICS_CONSENT_STORAGE_KEY = 'supplement-stack-analytics-consent';
export const ANALYTICS_CONSENT_RESET_EVENT = 'supplement-stack:analytics-consent-reset';

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

function isBrowser() {
  return typeof window !== 'undefined' && typeof document !== 'undefined';
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
    }),
    credentials: 'include',
    keepalive: true,
  }).catch(() => {
    // Analytics must never interrupt normal page usage.
  });
}
