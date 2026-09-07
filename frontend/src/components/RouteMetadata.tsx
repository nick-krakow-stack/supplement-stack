import { useLayoutEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { isKnownAppPath } from '../../../functions/lib/site-routes.mjs';
import { applyPublicRouteHead } from '../lib/publicPageHead';
import { resolveRouteHead } from '../../../functions/lib/route-head-contract.mjs';

const legalPaths = new Set(['/impressum', '/datenschutz', '/nutzungsbedingungen']);

export default function RouteMetadata() {
  const { pathname } = useLocation();

  useLayoutEffect(() => {
    const path = pathname === '/' ? pathname : pathname.replace(/\/$/, '');
    if (!legalPaths.has(path)) {
      document.getElementById('legal-prerender')?.remove();
      document.getElementById('legal-document-bootstrap')?.remove();
    }
    if (isKnownAppPath(path)) document.getElementById('site-not-found-prerender')?.remove();
    // These pages own their source-bound metadata and loading/error states.
    if (legalPaths.has(path) || /^\/wissen\/[^/]+$/.test(path)) return;
    applyPublicRouteHead(resolveRouteHead({ pathname: path }));
  }, [pathname]);

  return null;
}
