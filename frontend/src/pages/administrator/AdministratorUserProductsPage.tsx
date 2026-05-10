import { useCallback, useEffect, useMemo, useState } from 'react';
import { Check, ChevronLeft, ChevronRight, ExternalLink, RefreshCw, ShieldCheck, Trash2, X } from 'lucide-react';
import { bulkApproveUserProducts, getAdminUserProducts } from '../../api/admin';
import type { AdminUserProduct, AdminUserProductStatus } from '../../api/admin';
import { AdminBadge, AdminButton, AdminCard, AdminEmpty, AdminError, AdminPageHeader } from './AdminUi';

const PAGE_LIMIT_OPTIONS = [25, 50, 100] as const;

const JSON_HEADERS: Record<string, string> = {
  'Content-Type': 'application/json',
};

function formatPrice(value: number): string {
  return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(value || 0);
}

function formatDate(value: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return 'unbekannt';
  return parsed.toLocaleDateString('de-DE');
}

function getShopHost(shopLink?: string | null): string {
  if (!shopLink) return 'kein Link';
  try {
    const url = new URL(shopLink);
    return url.hostname.replace(/^www\./, '');
  } catch {
    return shopLink.replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0] || shopLink;
  }
}

function statusLabel(status: AdminUserProductStatus, publishedId?: number | null): string {
  if (status === 'pending') return 'Ausstehend';
  if (status === 'rejected') return 'Abgelehnt';
  if (status === 'blocked') return 'Gesperrt';
  return publishedId ? 'Im Katalog' : 'Freigegeben';
}

function statusTone(status: AdminUserProductStatus, publishedId?: number | null): 'neutral' | 'ok' | 'warn' | 'danger' | 'info' {
  if (status === 'pending') return 'warn';
  if (status === 'rejected') return 'danger';
  if (status === 'blocked') return 'danger';
  return publishedId ? 'ok' : 'info';
}

function ingredientSummary(product: AdminUserProduct): string {
  const ingredients = product.ingredients ?? [];
  if (ingredients.length === 0) return 'Keine Wirkstoffangaben.';

  const visible = ingredients.slice(0, 3).map((ingredient) => {
    const name = ingredient.ingredient_name ?? `ID ${ingredient.ingredient_id}`;
    const quantity = ingredient.quantity == null ? '' : `${ingredient.quantity}${ingredient.unit ?? ''}`;
    const basis =
      ingredient.basis_quantity == null || !ingredient.basis_unit
        ? ''
        : `pro ${ingredient.basis_quantity} ${ingredient.basis_unit}`;
    const relevance = ingredient.search_relevant === false || ingredient.search_relevant === 0 ? 'Zusatzstoff' : '';
    return [name, quantity, basis, relevance].filter(Boolean).join(' ');
  });
  const rest = ingredients.length - visible.length;
  return `${visible.join(' | ')}${rest > 0 ? ` +${rest} weitere` : ''}`;
}

async function parseError(response: Response, fallback: string): Promise<string> {
  const data = (await response.json().catch(() => ({}))) as { error?: string };
  return data.error ?? fallback;
}

export default function AdministratorUserProductsPage() {
  const [products, setProducts] = useState<AdminUserProduct[]>([]);
  const [statusFilter, setStatusFilter] = useState<AdminUserProductStatus>('pending');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState<(typeof PAGE_LIMIT_OPTIONS)[number]>(50);
  const [total, setTotal] = useState(0);
  const [statusSummary, setStatusSummary] = useState<Record<AdminUserProductStatus, number>>({
    pending: 0,
    approved: 0,
    rejected: 0,
    blocked: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionId, setActionId] = useState<number | null>(null);
  const [trustedUserActionId, setTrustedUserActionId] = useState<number | null>(null);
  const [bulkRunning, setBulkRunning] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(() => new Set());

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await getAdminUserProducts({ status: statusFilter, page, limit });
      setProducts(data.products);
      setTotal(data.total);
      if (data.summary?.statuses) setStatusSummary(data.summary.statuses);
      setSelectedIds(new Set());
    } catch (err) {
      setProducts([]);
      setTotal(0);
      setError(err instanceof Error ? err.message : 'Nutzer-Produkte konnten nicht geladen werden.');
    } finally {
      setLoading(false);
    }
  }, [limit, page, statusFilter]);

  useEffect(() => {
    void load();
  }, [load]);

  const selectedPending = useMemo(
    () => products.filter((product) => product.status === 'pending' && selectedIds.has(product.id)),
    [products, selectedIds],
  );
  const visiblePending = useMemo(
    () => products.filter((product) => product.status === 'pending'),
    [products],
  );
  const bulkLimitExceeded = selectedPending.length > 100;
  const totalPages = Math.max(1, Math.ceil(total / limit));
  const canLoadPrevious = page > 1;
  const canLoadNext = page < totalPages;
  const rangeStart = total === 0 ? 0 : (page - 1) * limit + 1;
  const rangeEnd = Math.min(total, (page - 1) * limit + products.length);

  useEffect(() => {
    if (!loading && page > totalPages) {
      setPage(totalPages);
    }
  }, [loading, page, totalPages]);

  const setSelected = (id: number, selected: boolean) => {
    setSelectedIds((previous) => {
      const next = new Set(previous);
      if (selected) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  const allPendingSelected =
    visiblePending.length > 0 && visiblePending.every((product) => selectedIds.has(product.id));

  const toggleAllPending = () => {
    setSelectedIds((previous) => {
      if (allPendingSelected) return new Set();
      const next = new Set(previous);
      visiblePending.forEach((product) => next.add(product.id));
      return next;
    });
  };

  const runAction = async (
    productId: number,
    url: string,
    method: 'PUT' | 'DELETE',
    fallback: string,
  ) => {
    setActionId(productId);
    setError('');
    try {
      const response = await fetch(url, {
        method,
        credentials: 'include',
        headers: JSON_HEADERS,
      });
      if (!response.ok) {
        throw new Error(await parseError(response, fallback));
      }
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : fallback);
    } finally {
      setActionId(null);
    }
  };

  const handleApprove = (id: number) =>
    runAction(id, `/api/admin/user-products/${id}/approve`, 'PUT', 'Nutzer-Produkt konnte nicht freigegeben werden.');

  const handleReject = (id: number) =>
    runAction(id, `/api/admin/user-products/${id}/reject`, 'PUT', 'Nutzer-Produkt konnte nicht abgelehnt werden.');

  const handleDelete = (id: number) => {
    if (!window.confirm('Produkt wirklich löschen?')) return;
    void runAction(id, `/api/admin/user-products/${id}`, 'DELETE', 'Eingereichtes Produkt konnte nicht gelöscht werden.');
  };

  const handlePublish = async (productId: number) => {
    setActionId(productId);
    setError('');
    try {
      const response = await fetch(`/api/admin/user-products/${productId}/publish`, {
        method: 'PUT',
        credentials: 'include',
        headers: JSON_HEADERS,
      });
      if (!response.ok) {
        throw new Error(await parseError(response, 'Eingereichtes Produkt konnte nicht als Katalogprodukt veröffentlicht werden.'));
      }
      const payload = (await response.json().catch(() => ({}))) as {
        published_product_id?: number | null;
        product?: Partial<AdminUserProduct>;
      };
      const publishedId = payload.published_product_id ?? payload.product?.published_product_id ?? null;
      setProducts((previous) =>
        previous.map((product) =>
          product.id === productId
            ? {
                ...product,
                ...payload.product,
                status: 'approved',
                published_product_id: publishedId ?? product.published_product_id,
              }
            : product,
        ),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Eingereichtes Produkt konnte nicht als Katalogprodukt veröffentlicht werden.');
    } finally {
      setActionId(null);
    }
  };

  const handleTrustedToggle = async (product: AdminUserProduct) => {
    const nextValue = product.user_is_trusted_product_submitter ? 0 : 1;
    setTrustedUserActionId(product.user_id);
    setError('');
    try {
      const response = await fetch(`/api/admin/users/${product.user_id}/trusted-product-submitter`, {
        method: 'PUT',
        credentials: 'include',
        headers: JSON_HEADERS,
        body: JSON.stringify({ is_trusted_product_submitter: nextValue }),
      });
      if (!response.ok) {
        throw new Error(await parseError(response, 'Trusted-Status konnte nicht gespeichert werden.'));
      }
      setProducts((previous) =>
        previous.map((entry) =>
          entry.user_id === product.user_id
            ? { ...entry, user_is_trusted_product_submitter: nextValue }
            : entry,
        ),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Trusted-Status konnte nicht gespeichert werden.');
    } finally {
      setTrustedUserActionId(null);
    }
  };

  const handleBulkApprove = async () => {
    if (selectedPending.length === 0) return;
    const ids = selectedPending.map((product) => product.id);
    if (ids.length > 100) {
      setError('Bulk-Freigabe ist auf maximal 100 Produkte pro Request begrenzt.');
      return;
    }
    setBulkRunning(true);
    setError('');
    try {
      const result = await bulkApproveUserProducts(ids);
      if (result.failed > 0) {
        await load();
        const failedPreview = result.results
          .filter((entry) => !entry.ok)
          .slice(0, 3)
          .map((entry) => `#${entry.id}: ${entry.error ?? 'fehlgeschlagen'}`)
          .join(', ');
        setError(
          `${result.approved} Produkt(e) freigegeben, ${result.failed} fehlgeschlagen.${failedPreview ? ` ${failedPreview}` : ''}`,
        );
        return;
      }
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Bulk-Freigabe fehlgeschlagen.');
      await load();
    } finally {
      setBulkRunning(false);
    }
  };

  return (
    <>
      <AdminPageHeader
        title="Nutzer-Produkte"
        subtitle="Eingereichte Produkte prüfen, freigeben, ablehnen oder in den Katalog übernehmen."
        meta={<AdminBadge tone={statusFilter === 'pending' ? 'warn' : 'info'}>{total} Treffer</AdminBadge>}
      />

      <div className="mb-4 admin-toolbar">
        <div className="admin-toolbar-inline">
          {(['pending', 'approved', 'rejected', 'blocked'] as const).map((status) => (
            <AdminButton
              key={status}
              variant={statusFilter === status ? 'primary' : 'default'}
              onClick={() => {
                setPage(1);
                setStatusFilter(status);
              }}
            >
              {status === 'pending' ? 'Ausstehend' : status === 'approved' ? 'Freigegeben' : status === 'blocked' ? 'Gesperrt' : 'Abgelehnt'}
              <AdminBadge tone={status === 'pending' ? 'warn' : status === 'approved' ? 'info' : 'danger'}>
                {statusSummary[status]}
              </AdminBadge>
            </AdminButton>
          ))}
          <AdminButton onClick={() => void load()} disabled={loading}>
            <RefreshCw size={14} />
            Aktualisieren
          </AdminButton>
        </div>

        <div className="admin-toolbar-inline">
          <span className="admin-muted text-sm">
            Seite {page} / {totalPages} - {rangeStart}-{rangeEnd} von {total}
          </span>
          <select
            value={limit}
            onChange={(event) => {
              setPage(1);
              setLimit(Number(event.target.value) as (typeof PAGE_LIMIT_OPTIONS)[number]);
            }}
            className="admin-select w-[140px]"
            aria-label="Einträge pro Seite"
          >
            {PAGE_LIMIT_OPTIONS.map((entry) => (
              <option key={entry} value={entry}>
                {entry} / Seite
              </option>
            ))}
          </select>
          <AdminButton onClick={() => setPage((current) => Math.max(1, current - 1))} disabled={!canLoadPrevious || loading}>
            <ChevronLeft size={13} />
            Zurück
          </AdminButton>
          <AdminButton onClick={() => setPage((current) => current + 1)} disabled={!canLoadNext || loading}>
            Weiter
            <ChevronRight size={13} />
          </AdminButton>
        </div>
      </div>

      {statusFilter === 'pending' && visiblePending.length > 0 && (
        <AdminCard className="mb-4" padded>
          <div className="flex flex-wrap items-center gap-3">
            <label className="inline-flex items-center gap-2 text-[13px] text-[color:var(--admin-ink-2)]">
              <input type="checkbox" checked={allPendingSelected} onChange={toggleAllPending} />
              Alle sichtbaren wartenden Produkte auswählen
            </label>
            <AdminBadge tone="warn">{selectedPending.length} ausgewählt</AdminBadge>
            <AdminButton
              variant="primary"
              onClick={() => void handleBulkApprove()}
              disabled={selectedPending.length === 0 || bulkRunning || bulkLimitExceeded}
            >
              <Check size={14} />
              Auswahl freigeben
            </AdminButton>
            {bulkLimitExceeded && (
              <span className="text-xs text-[color:var(--admin-danger-ink)]">
                Maximal 100 pro Bulk-Request
              </span>
            )}
          </div>
        </AdminCard>
      )}

      {error && <AdminError>{error}</AdminError>}

      <AdminCard
        title="Einreichungen"
        subtitle="Die Detailzeile zeigt Link, Portionierung, Wirkstoffe und Katalogstatus."
      >
        {loading && <div className="admin-empty">Lade Nutzer-Produkte...</div>}

        {!loading && products.length === 0 && (
          <AdminEmpty>Keine Nutzer-Produkte in diesem Status.</AdminEmpty>
        )}

        {!loading && products.length > 0 && (
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  {statusFilter === 'pending' && <th className="w-10">Auswahl</th>}
                  <th>Produkt</th>
                  <th>Nutzer</th>
                  <th>Link</th>
                  <th>Status</th>
                  <th>Aktionen</th>
                </tr>
              </thead>
              <tbody>
                {products.map((product) => {
                  const published = product.published_product_id != null;
                  const isBusy = actionId === product.id || bulkRunning;
                  return (
                    <tr key={product.id}>
                      {statusFilter === 'pending' && (
                        <td>
                          <input
                            type="checkbox"
                            checked={selectedIds.has(product.id)}
                            onChange={(event) => setSelected(product.id, event.target.checked)}
                          />
                        </td>
                      )}
                      <td className="min-w-[320px]">
                        <div className="font-medium" style={{ fontFamily: 'var(--admin-serif)' }}>
                          #{product.id} {product.name}
                        </div>
                        <div className="admin-muted mt-1 text-xs">
                          {[product.brand || 'Ohne Marke', product.form, formatPrice(product.price), formatDate(product.created_at)]
                            .filter(Boolean)
                            .join(' - ')}
                        </div>
                        <div className="admin-muted mt-1 text-xs">
                          {product.serving_size ? `${product.serving_size}${product.serving_unit ?? ''}` : 'Portionierung fehlt'}
                          {' - '}
                          {product.servings_per_container ?? '?'} Portionen
                          {' - '}
                          {product.container_count ?? 1} Packung(en)
                        </div>
                        <div className="mt-2 text-xs text-[color:var(--admin-ink-2)]">{ingredientSummary(product)}</div>
                        {product.notes && <div className="admin-muted mt-1 text-xs">Notiz: {product.notes}</div>}
                      </td>
                      <td className="min-w-[180px]">
                        <div className="text-[12.5px]">{product.user_email ?? `Nutzer #${product.user_id}`}</div>
                        <div className="admin-muted admin-mono">#{product.user_id}</div>
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          <AdminBadge tone={product.user_is_trusted_product_submitter ? 'ok' : 'neutral'}>
                            {product.user_is_trusted_product_submitter ? 'Trusted' : 'Nicht trusted'}
                          </AdminBadge>
                          <AdminButton
                            size="sm"
                            onClick={() => void handleTrustedToggle(product)}
                            disabled={trustedUserActionId === product.user_id}
                          >
                            <ShieldCheck size={13} />
                            {product.user_is_trusted_product_submitter ? 'Entfernen' : 'Markieren'}
                          </AdminButton>
                        </div>
                      </td>
                      <td className="min-w-[170px]">
                        <div className="admin-mono">{getShopHost(product.shop_link)}</div>
                        {product.shop_link && (
                          <a
                            href={product.shop_link}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="mt-2 inline-flex items-center gap-1 text-xs text-[color:var(--admin-info-ink)] underline"
                          >
                            Link öffnen
                            <ExternalLink size={12} />
                          </a>
                        )}
                      </td>
                      <td>
                        <div className="flex flex-col gap-1.5">
                          <AdminBadge tone={statusTone(product.status, product.published_product_id)}>
                            {statusLabel(product.status, product.published_product_id)}
                          </AdminBadge>
                          {published && <span className="admin-muted admin-mono">Katalog #{product.published_product_id}</span>}
                          {product.status === 'approved' && !published && (
                            <span className="text-xs text-[color:var(--admin-warn-ink)]">Publish offen</span>
                          )}
                        </div>
                      </td>
                      <td className="min-w-[220px]">
                        <div className="flex flex-wrap gap-2">
                          {product.status === 'pending' && (
                            <>
                              <AdminButton variant="primary" size="sm" onClick={() => void handleApprove(product.id)} disabled={isBusy}>
                                <Check size={13} />
                                Freigeben
                              </AdminButton>
                              <AdminButton size="sm" onClick={() => void handleReject(product.id)} disabled={isBusy}>
                                <X size={13} />
                                Ablehnen
                              </AdminButton>
                            </>
                          )}
                          {product.status === 'approved' && !published && (
                            <AdminButton variant="primary" size="sm" onClick={() => void handlePublish(product.id)} disabled={isBusy}>
                              Publish
                            </AdminButton>
                          )}
                          <AdminButton variant="danger" size="sm" onClick={() => handleDelete(product.id)} disabled={isBusy}>
                            <Trash2 size={13} />
                            Loeschen
                          </AdminButton>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </AdminCard>
    </>
  );
}
