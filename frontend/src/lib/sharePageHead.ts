/** Keep only the initial document's authoritative SSR head while its first GET loads.
 * The URL comparison stays in memory; no capability is copied into a head/bootstrap.
 */
export function hasInitialShareHead(pathname: string): boolean {
  if (window.location.pathname !== pathname || !document.getElementById('site-page-prerender')) return false;
  try {
    const bootstrap: unknown = JSON.parse(document.getElementById('site-delivery-bootstrap')?.textContent ?? 'null');
    if (!bootstrap || typeof bootstrap !== 'object' || !('pageKind' in bootstrap) || !('status' in bootstrap)) return false;
    return bootstrap.pageKind === 'share' && bootstrap.status === 200
      || bootstrap.pageKind === 'error' && [404, 409, 410, 503].includes(Number(bootstrap.status));
  } catch {
    return false;
  }
}
