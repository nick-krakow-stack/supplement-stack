import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  ANALYTICS_CONSENT_RESET_EVENT,
  type AnalyticsConsent,
  initializeAnalytics,
  persistAnalyticsConsent,
  readStoredAnalyticsConsent,
  revokeAnalyticsConsent,
  trackPageView,
} from '../lib/analytics';

export default function CookieConsentBanner() {
  const location = useLocation();
  const [consent, setConsent] = useState<AnalyticsConsent | null>(() => readStoredAnalyticsConsent());
  const currentPath = `${location.pathname}${location.search}${location.hash}`;

  useEffect(() => {
    const handleConsentReset = () => setConsent(null);

    window.addEventListener(ANALYTICS_CONSENT_RESET_EVENT, handleConsentReset);
    return () => window.removeEventListener(ANALYTICS_CONSENT_RESET_EVENT, handleConsentReset);
  }, []);

  useEffect(() => {
    if (consent !== 'accepted') return;

    initializeAnalytics();
    trackPageView(currentPath);
  }, [consent, currentPath]);

  const handleDecline = () => {
    persistAnalyticsConsent('declined');
    revokeAnalyticsConsent();
    setConsent('declined');
  };

  const handleAccept = () => {
    persistAnalyticsConsent('accepted');
    setConsent('accepted');
  };

  if (consent !== null) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-[90] px-3 pb-3 sm:px-4 sm:pb-4">
      <section
        className="mx-auto flex max-w-4xl flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-4 text-slate-700 shadow-2xl shadow-slate-900/15 sm:flex-row sm:items-center sm:justify-between sm:p-5"
        aria-label="Cookie- und Analytics-Einwilligung"
      >
        <div className="min-w-0 space-y-1">
          <p className="text-sm font-extrabold text-slate-900">Analytics-Einwilligung</p>
          <p className="text-sm leading-relaxed text-slate-600">
            Wir nutzen Google Analytics nur mit deiner Zustimmung, um die Nutzung der App besser
            zu verstehen. Ohne Zustimmung laden wir keine Google-Analytics-Skripte.
            {' '}
            <Link to="/datenschutz" className="font-bold text-blue-700 underline-offset-4 hover:underline">
              Datenschutz
            </Link>
          </p>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-shrink-0">
          <button
            type="button"
            onClick={handleDecline}
            className="min-h-11 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-extrabold text-slate-700 hover:bg-slate-50"
          >
            Ablehnen
          </button>
          <button
            type="button"
            onClick={handleAccept}
            className="min-h-11 rounded-xl bg-blue-600 px-4 py-2 text-sm font-extrabold text-white hover:bg-blue-700"
          >
            Zustimmen
          </button>
        </div>
      </section>
    </div>
  );
}
