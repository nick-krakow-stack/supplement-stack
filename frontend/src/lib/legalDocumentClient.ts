export type LegalSlug = 'impressum' | 'datenschutz' | 'nutzungsbedingungen';

export type LegalDocument = {
  slug: LegalSlug;
  title: string;
  body_md: string;
  status: 'published';
  updated_at: string | null;
  published_at: string | null;
  version: number | null;
};

export type LegalDocumentState =
  | { status: 'loading' }
  | { status: 'ready'; document: LegalDocument }
  | { status: 'error'; httpStatus: number };

function object(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

export function parseLegalDocument(value: unknown, slug: LegalSlug): LegalDocument | null {
  const document = object(object(value)?.document);
  if (!document || document.slug !== slug || document.status !== 'published'
    || typeof document.title !== 'string' || !document.title.trim()
    || typeof document.body_md !== 'string' || !document.body_md.trim()) return null;
  return {
    slug,
    title: document.title,
    body_md: document.body_md,
    status: 'published',
    updated_at: typeof document.updated_at === 'string' ? document.updated_at : null,
    published_at: typeof document.published_at === 'string' ? document.published_at : null,
    version: typeof document.version === 'number' && Number.isInteger(document.version) && document.version >= 1 ? document.version : null,
  };
}

export function readLegalDocumentBootstrap(slug: LegalSlug): LegalDocumentState | null {
  if (typeof document === 'undefined') return null;
  const script = document.getElementById('legal-document-bootstrap');
  if (!script || script.getAttribute('type') !== 'application/json') return null;
  try {
    const payload: unknown = JSON.parse(script.textContent ?? '');
    const legalDocument = parseLegalDocument(payload, slug);
    if (legalDocument) return { status: 'ready', document: legalDocument };
    const error = object(payload);
    if (error?.document === null && (error.status === 404 || error.status === 503)) {
      return { status: 'error', httpStatus: error.status };
    }
  } catch {
    // Invalid or wrong-route projections are not legal content; load the exact route.
  }
  return null;
}

export async function loadLegalDocument(slug: LegalSlug, signal: AbortSignal): Promise<LegalDocumentState> {
  try {
    const response = await fetch(`/api/legal-documents/${encodeURIComponent(slug)}`, {
      signal,
      headers: { Accept: 'application/json' },
    });
    if (!response.ok) return { status: 'error', httpStatus: response.status };
    const legalDocument = parseLegalDocument(await response.json(), slug);
    return legalDocument ? { status: 'ready', document: legalDocument } : { status: 'error', httpStatus: 503 };
  } catch {
    return { status: 'error', httpStatus: 503 };
  }
}
