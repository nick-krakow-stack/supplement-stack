import { useCallback, useEffect, useState } from 'react';
import { ExternalLink, RefreshCw, Save } from 'lucide-react';
import { AdminBadge, AdminButton, AdminCard, AdminEmpty, AdminError, AdminPageHeader } from './AdminUi';

type LegalDocument = {
  slug: string;
  title: string;
  body_md: string;
  status: 'draft' | 'published' | string;
  updated_at: string | null;
  version: number | null;
};

const PUBLIC_LINKS: Record<string, string> = {
  impressum: '/impressum',
  datenschutz: '/datenschutz',
  nutzungsbedingungen: '/nutzungsbedingungen',
};

async function responseError(response: Response, fallback: string): Promise<string> {
  const body = (await response.json().catch(() => ({}))) as { error?: string };
  return body.error ?? fallback;
}

function normalizeDocuments(value: unknown): LegalDocument[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry) => (entry && typeof entry === 'object' ? entry as Record<string, unknown> : null))
    .filter((entry): entry is Record<string, unknown> => Boolean(entry))
    .map((entry) => ({
      slug: typeof entry.slug === 'string' ? entry.slug : '',
      title: typeof entry.title === 'string' ? entry.title : '',
      body_md: typeof entry.body_md === 'string' ? entry.body_md : '',
      status: typeof entry.status === 'string' ? entry.status : 'draft',
      updated_at: typeof entry.updated_at === 'string' ? entry.updated_at : null,
      version: typeof entry.version === 'number' ? entry.version : null,
    }))
    .filter((entry) => entry.slug);
}

export default function AdministratorLegalPage() {
  const [documents, setDocuments] = useState<LegalDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingSlug, setSavingSlug] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await fetch('/api/admin/legal-documents', { credentials: 'include' });
      if (!response.ok) throw new Error(await responseError(response, 'Rechtstexte konnten nicht geladen werden.'));
      const data = (await response.json()) as { documents?: unknown };
      setDocuments(normalizeDocuments(data.documents));
    } catch (err) {
      setDocuments([]);
      setError(err instanceof Error ? err.message : 'Rechtstexte konnten nicht geladen werden.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const updateDocument = (slug: string, patch: Partial<LegalDocument>) => {
    setDocuments((previous) => previous.map((entry) => (entry.slug === slug ? { ...entry, ...patch } : entry)));
  };

  const saveDocument = async (document: LegalDocument) => {
    setSavingSlug(document.slug);
    setError('');
    setStatus('');
    try {
      const response = await fetch(`/api/admin/legal-documents/${encodeURIComponent(document.slug)}`, {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: document.title,
          body_md: document.body_md,
          status: document.status,
        }),
      });
      if (!response.ok) throw new Error(await responseError(response, 'Rechtstext konnte nicht gespeichert werden.'));
      const data = (await response.json()) as { document?: LegalDocument };
      if (data.document) updateDocument(document.slug, data.document);
      setStatus('Gespeichert.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Rechtstext konnte nicht gespeichert werden.');
    } finally {
      setSavingSlug(null);
    }
  };

  return (
    <>
      <AdminPageHeader
        title="Rechtliches"
        subtitle="Rechtstexte bearbeiten und vor dem Veröffentlichen prüfen."
        meta={<AdminBadge tone="info">{documents.length} Dokumente</AdminBadge>}
      />

      <div className="mb-4">
        <AdminButton onClick={() => void load()} disabled={loading}>
          <RefreshCw size={14} />
          Aktualisieren
        </AdminButton>
      </div>

      {error && <AdminError>{error}</AdminError>}
      {status && <p className="admin-muted mb-3 text-sm">{status}</p>}

      {loading ? (
        <AdminEmpty>Lade Rechtstexte...</AdminEmpty>
      ) : documents.length === 0 ? (
        <AdminEmpty>Keine Rechtstexte gefunden. Bitte Migration ausführen.</AdminEmpty>
      ) : (
        <div className="space-y-4">
          {documents.map((document) => (
            <AdminCard
              key={document.slug}
              title={document.title || document.slug}
              subtitle={document.updated_at ? `Zuletzt bearbeitet: ${document.updated_at}` : 'Noch nicht bearbeitet'}
              actions={
                <div className="flex flex-wrap gap-2">
                  {PUBLIC_LINKS[document.slug] && (
                    <a className="admin-btn admin-btn-sm" href={PUBLIC_LINKS[document.slug]} target="_blank" rel="noreferrer">
                      <ExternalLink size={13} />
                      Vorschau
                    </a>
                  )}
                  <AdminButton size="sm" variant="primary" disabled={savingSlug === document.slug} onClick={() => void saveDocument(document)}>
                    <Save size={13} />
                    Speichern
                  </AdminButton>
                </div>
              }
              padded
            >
              <div className="grid gap-3 lg:grid-cols-[260px_1fr]">
                <div className="space-y-3">
                  <label className="block text-xs font-medium text-[color:var(--admin-ink-2)]">
                    Titel
                    <input
                      value={document.title}
                      onChange={(event) => updateDocument(document.slug, { title: event.target.value })}
                      className="admin-input mt-1"
                    />
                  </label>
                  <label className="block text-xs font-medium text-[color:var(--admin-ink-2)]">
                    Status
                    <select
                      value={document.status}
                      onChange={(event) => updateDocument(document.slug, { status: event.target.value })}
                      className="admin-select mt-1"
                    >
                      <option value="draft">Entwurf</option>
                      <option value="published">Veröffentlicht</option>
                    </select>
                  </label>
                </div>
                <label className="block text-xs font-medium text-[color:var(--admin-ink-2)]">
                  Text
                  <textarea
                    value={document.body_md}
                    onChange={(event) => updateDocument(document.slug, { body_md: event.target.value })}
                    className="admin-input mt-1 min-h-[220px] font-mono text-xs"
                  />
                </label>
              </div>
            </AdminCard>
          ))}
        </div>
      )}
    </>
  );
}
