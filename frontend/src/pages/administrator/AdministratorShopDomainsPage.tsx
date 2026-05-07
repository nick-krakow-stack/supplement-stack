import { useCallback, useEffect, useMemo, useState } from 'react';
import { ExternalLink, Plus, RefreshCw, Trash2 } from 'lucide-react';
import { AdminBadge, AdminButton, AdminCard, AdminEmpty, AdminError, AdminPageHeader } from './AdminUi';

type ShopDomain = {
  id: number;
  domain: string;
  display_name: string;
  created_at?: string | null;
};

type ShopDomainsResponse = {
  shops: ShopDomain[];
};

const JSON_HEADERS: Record<string, string> = {
  'Content-Type': 'application/json',
};

function formatDate(value?: string | null): string {
  if (!value) return 'kein Datum';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return 'ungueltiges Datum';
  return parsed.toLocaleDateString('de-DE');
}

async function parseError(response: Response, fallback: string): Promise<string> {
  const body = (await response.json().catch(() => ({}))) as { error?: string };
  return body.error ?? fallback;
}

export default function AdministratorShopDomainsPage() {
  const [shops, setShops] = useState<ShopDomain[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [newDomain, setNewDomain] = useState('');
  const [newName, setNewName] = useState('');
  const [savingId, setSavingId] = useState<number | 'create' | null>(null);
  const [feedback, setFeedback] = useState('');
  const [query, setQuery] = useState('');

  const visibleShops = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return shops;
    return shops.filter((shop) => {
      return (
        shop.domain.toLowerCase().includes(needle) ||
        shop.display_name.toLowerCase().includes(needle)
      );
    });
  }, [shops, query]);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await fetch('/api/admin/shop-domains', {
        credentials: 'include',
        headers: JSON_HEADERS,
      });
      if (!response.ok) {
        throw new Error(await parseError(response, 'Shop-Domains konnten nicht geladen werden.'));
      }
      const data = (await response.json()) as ShopDomainsResponse;
      setShops(data.shops ?? []);
    } catch (err) {
      setShops([]);
      setError(err instanceof Error ? err.message : 'Shop-Domains konnten nicht geladen werden.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const handleAdd = async () => {
    const trimmedDomain = newDomain.trim();
    const trimmedName = newName.trim();
    if (!trimmedDomain || !trimmedName) return;

    setSavingId('create');
    setError('');
    setFeedback('');
    try {
      const response = await fetch('/api/admin/shop-domains', {
        method: 'POST',
        credentials: 'include',
        headers: JSON_HEADERS,
        body: JSON.stringify({
          domain: trimmedDomain,
          display_name: trimmedName,
        }),
      });
      if (!response.ok) {
        throw new Error(await parseError(response, 'Shop-Domain konnte nicht angelegt werden.'));
      }
      const data = (await response.json().catch(() => ({}))) as { id?: number };
      setShops((previous) => [
        { id: data.id ?? Date.now(), domain: trimmedDomain, display_name: trimmedName },
        ...previous,
      ]);
      setNewDomain('');
      setNewName('');
      setFeedback('Domain gespeichert.');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Shop-Domain konnte nicht angelegt werden.');
    } finally {
      setSavingId(null);
    }
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm('Shop-Domain wirklich löschen?')) return;
    setSavingId(id);
    setError('');
    setFeedback('');
    try {
      const response = await fetch(`/api/admin/shop-domains/${id}`, {
        method: 'DELETE',
        credentials: 'include',
        headers: JSON_HEADERS,
      });
      if (!response.ok) {
        throw new Error(await parseError(response, 'Shop-Domain konnte nicht gelöscht werden.'));
      }
      setShops((previous) => previous.filter((shop) => shop.id !== id));
      setFeedback('Domain gelöscht.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Shop-Domain konnte nicht gelöscht werden.');
    } finally {
      setSavingId(null);
    }
  };

  return (
    <>
      <AdminPageHeader
        title="Shop-Domains"
        subtitle="Domainnamen auf Kauf-Links pflegen. Neue Domains direkt als Marken- oder Hostnamen speichern."
        meta={<AdminBadge tone="info">{shops.length} Domains</AdminBadge>}
      />

      <div className="admin-toolbar mb-4">
        <div className="admin-toolbar-inline">
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Suchen: domain oder anzeige"
            className="admin-input min-w-[220px]"
          />
          <AdminButton onClick={() => void load()} disabled={loading}>
            <RefreshCw size={14} />
            Aktualisieren
          </AdminButton>
        </div>
      </div>

      <AdminCard title="Neu anlegen" subtitle="Domain und Anzeigenamen erfassen. Beispiel: domain + Markenname.">
        <div className="admin-toolbar">
          <div className="admin-toolbar-inline">
            <input
              value={newDomain}
              onChange={(event) => setNewDomain(event.target.value)}
              placeholder="amazon.de"
              className="admin-input min-w-[220px]"
            />
            <input
              value={newName}
              onChange={(event) => setNewName(event.target.value)}
              placeholder="Amazon"
              className="admin-input min-w-[220px]"
            />
            <AdminButton variant="primary" onClick={() => void handleAdd()} disabled={savingId === 'create'}>
              <Plus size={14} />
              Domain speichern
            </AdminButton>
          </div>
          {feedback && <p className="admin-muted mt-2 text-xs">{feedback}</p>}
        </div>
      </AdminCard>

      {error && <AdminError>{error}</AdminError>}

      <AdminCard title="Domainliste">
        {loading && <AdminEmpty>Lade Shop-Domains...</AdminEmpty>}

        {!loading && visibleShops.length === 0 && (
          <AdminEmpty>Keine Shop-Domains vorhanden.</AdminEmpty>
        )}

        {!loading && visibleShops.length > 0 && (
          <>
            <div className="admin-table-wrap hidden md:block">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Domain</th>
                    <th>Anzeige</th>
                    <th>Angelegt</th>
                    <th className="w-[120px]">Aktionen</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleShops.map((shop) => (
                    <tr key={shop.id}>
                      <td className="admin-mono">{shop.domain}</td>
                      <td>{shop.display_name}</td>
                      <td className="admin-muted">{formatDate(shop.created_at)}</td>
                      <td>
                        <div className="flex gap-2">
                          <a
                            href={`https://${shop.domain}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="admin-icon-btn"
                            title="Domain testen"
                            aria-label="Domain testen"
                          >
                            <ExternalLink size={14} />
                          </a>
                          <AdminButton
                            variant="danger"
                            size="sm"
                            onClick={() => void handleDelete(shop.id)}
                            disabled={savingId === shop.id}
                          >
                            <Trash2 size={13} />
                            Loeschen
                          </AdminButton>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mt-4 space-y-3 md:hidden">
              {visibleShops.map((shop) => (
                <article key={shop.id} className="rounded-[var(--admin-r-md)] border border-[color:var(--admin-line)] p-3">
                  <div className="font-medium">{shop.display_name}</div>
                  <div className="admin-muted admin-mono text-sm">{shop.domain}</div>
                  <div className="admin-muted mt-1 text-xs">{formatDate(shop.created_at)}</div>
                  <div className="mt-3 flex items-center justify-between gap-2">
                    <a
                      href={`https://${shop.domain}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="admin-icon-btn"
                      title="Domain testen"
                      aria-label="Domain testen"
                    >
                      <ExternalLink size={14} />
                    </a>
                    <AdminButton
                      variant="danger"
                      size="sm"
                      onClick={() => void handleDelete(shop.id)}
                      disabled={savingId === shop.id}
                    >
                      <Trash2 size={13} />
                      Loeschen
                    </AdminButton>
                  </div>
                </article>
              ))}
            </div>
          </>
        )}
      </AdminCard>
    </>
  );
}
