import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { isKnownAppPath } from '../../../functions/lib/site-routes.mjs';
import { setPublicPageHead } from '../lib/publicPageHead';

const routeTitles: Record<string, string> = {
  '/': 'Supplement Stack – quellenbasiert planen und vergleichen',
  '/login': 'Anmelden | Supplement Stack',
  '/register': 'Kostenlos registrieren | Supplement Stack',
  '/profile': 'Mein Profil | Supplement Stack',
  '/stacks': 'Meine Stacks | Supplement Stack',
  '/demo': 'Kostenlose Demo | Supplement Stack',
  '/creator': 'Creator-Bereich | Supplement Stack',
  '/einnahmeplan': 'Einnahmeplan | Supplement Stack',
  '/my-products': 'Eigene Produkte | Supplement Stack',
  '/forgot-password': 'Passwort zurücksetzen | Supplement Stack',
  '/reset-password': 'Neues Passwort | Supplement Stack',
  '/verify-email': 'E-Mail bestätigen | Supplement Stack',
  '/impressum': 'Impressum | Supplement Stack',
  '/datenschutz': 'Datenschutz | Supplement Stack',
  '/nutzungsbedingungen': 'Nutzungsbedingungen | Supplement Stack',
  '/agb': 'Nutzungsbedingungen | Supplement Stack',
  '/wissen': 'Wissen zu Nahrungsergänzung | Supplement Stack',
};


const legalPaths = new Set(['/impressum', '/datenschutz', '/nutzungsbedingungen']);
const indexablePaths = new Set(['/', '/demo', '/wissen']);

export default function RouteMetadata() {
  const { pathname } = useLocation();

  useEffect(() => {
    const path = pathname === '/' ? pathname : pathname.replace(/\/$/, '');
    if (!legalPaths.has(path)) {
      document.getElementById('legal-prerender')?.remove();
      document.getElementById('legal-document-bootstrap')?.remove();
    }
    if (isKnownAppPath(path)) document.getElementById('site-not-found-prerender')?.remove();
    // These pages own their source-bound metadata and loading/error states.
    if (legalPaths.has(path) || /^\/wissen\/[^/]+$/.test(path)) return;
    if (path.startsWith('/administrator')) return;

    const known = isKnownAppPath(path) || path === '/agb';
    setPublicPageHead({
      title: routeTitles[path]
        ?? (/^\/share\/[^/]+$/.test(path) ? 'Geteilte Empfehlung | Supplement Stack' : 'Seite nicht gefunden | Supplement Stack'),
      robots: !known ? 'noindex,nofollow' : indexablePaths.has(path) ? 'index,follow' : 'noindex,follow',
      // Only explicit public paths enter a canonical; unknown paths may contain secrets.
      canonicalPath: indexablePaths.has(path) ? path : null,
    });
  }, [pathname]);

  return null;
}
