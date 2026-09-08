import { useLayoutEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { isCreatorProfilePath, isKnownAppPath } from '../../../functions/lib/site-routes.mjs';
import { applyPublicRouteHead } from '../lib/publicPageHead';
import { resolveRouteHead } from '../../../functions/lib/route-head-contract.mjs';
import { projectShareHead } from '../../../functions/lib/share-head-projection.mjs';
import { hasInitialShareHead } from '../lib/sharePageHead';
import { initialCreatorProfileState } from '../lib/creatorProfileBootstrap';

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
    if (!isCreatorProfilePath(path)) document.getElementById('creator-profile-bootstrap')?.remove();
    // These pages own their source-bound metadata and loading/error states.
    if (legalPaths.has(path) || /^\/wissen\/[^/]+$/.test(path)) return;
    if (isCreatorProfilePath(path)) {
      if (!initialCreatorProfileState(pathname)) applyPublicRouteHead(resolveRouteHead({ pathname: path }));
      return;
    }
    if (/^\/share\/[^/]+$/.test(path)) {
      if (!hasInitialShareHead(pathname)) applyPublicRouteHead(projectShareHead({ status: 'loading' }).head);
      return;
    }
    applyPublicRouteHead(resolveRouteHead({ pathname: path }));
  }, [pathname]);

  return null;
}
