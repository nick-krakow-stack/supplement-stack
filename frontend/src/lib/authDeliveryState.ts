/** Read once during page render, before the layout removes the initial delivery marker. */
export function authDeliveryStatus(pathname: string): 400 | 410 | 503 | null {
  if (typeof document === 'undefined') return null;
  try {
    const value: unknown = JSON.parse(document.getElementById('site-delivery-bootstrap')?.textContent ?? 'null');
    if (!value || typeof value !== 'object' || !('pathname' in value) || value.pathname !== pathname || !('status' in value)) return null;
    return value.status === 400 || value.status === 410 || value.status === 503 ? value.status : null;
  } catch { return null; }
}
