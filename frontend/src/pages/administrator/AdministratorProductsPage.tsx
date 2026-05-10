import { useCallback, useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  ChevronLeft,
  ChevronRight,
  Edit3,
  ExternalLink,
  PackageSearch,
  Plus,
  RefreshCw,
  Save,
  Search,
  Trash2,
  X,
} from 'lucide-react';
import {
  createAdminProductShopLink,
  deleteAdminProductImage,
  deleteAdminProductShopLink,
  getAdminProducts,
  getAdminProductShopLinks,
  recheckAdminProductShopLink,
  updateAdminProductShopLink,
  updateProductQA,
  type AdminAffiliateLinkHealth,
  type AdminCatalogProduct,
  type AdminProductQAPatch,
  type AdminProductShopLink,
  type AdminProductShopLinkPayload,
  type AdminProductShopLinkOwnerType,
} from '../../api/admin';
import ImageCropModal from '../../components/ImageCropModal';
import { AdminBadge, AdminButton, AdminCard, AdminEmpty, AdminError, AdminPageHeader, type AdminTone } from './AdminUi';

type ProductModerationStatus = 'pending' | 'approved' | 'rejected' | 'blocked';
const PAGE_LIMIT_OPTIONS = [25, 50, 100] as const;

type ProductQuickForm = {
  shop_link: string;
  is_affiliate: boolean;
  moderation_status: ProductModerationStatus;
};

type ShopLinkForm = {
  shop_name: string;
  url: string;
  is_affiliate: boolean;
  affiliate_owner_type: AdminProductShopLinkOwnerType;
  affiliate_owner_user_id: number | null;
  is_primary: boolean;
  active: boolean;
  sort_order: string;
};

function getErrorMessage(error: unknown): string {
  const response = (error as { response?: { status?: number; data?: unknown } } | null)?.response;
  const data = response?.data && typeof response.data === 'object' ? response.data as Record<string, unknown> : null;
  const apiError = typeof data?.error === 'string' ? data.error : null;
  if (response?.status === 409) return 'Konflikt: Das Produkt wurde zwischenzeitlich geaendert. Bitte aktualisieren.';
  if (apiError) return apiError;
  if (error instanceof Error) return error.message;
  return 'Die Anfrage ist fehlgeschlagen.';
}

function textValue(value: string): string | null {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function linkHost(value: string): string {
  try {
    return new URL(value).hostname.replace(/^www\./, '');
  } catch {
    return value.replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0] || value;
  }
}

function formatDate(value: string | null): string {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return new Intl.DateTimeFormat('de-DE', { dateStyle: 'short', timeStyle: 'short' }).format(date);
}

function productIsAffiliate(product: AdminCatalogProduct): boolean {
  if (product.affiliate_owner_type === 'none') return false;
  if (product.affiliate_owner_type === 'nick' || product.affiliate_owner_type === 'user') return true;
  if (product.is_affiliate === 0) return false;
  return true;
}

function formFromProduct(product: AdminCatalogProduct): ProductQuickForm {
  return {
    shop_link: product.shop_link ?? '',
    is_affiliate: productIsAffiliate(product),
    moderation_status:
      product.moderation_status === 'approved' ||
      product.moderation_status === 'rejected' ||
      product.moderation_status === 'blocked'
        ? product.moderation_status
        : 'pending',
  };
}

function emptyShopLinkForm(): ShopLinkForm {
  return {
    shop_name: '',
    url: '',
    is_affiliate: true,
    affiliate_owner_type: 'nick',
    affiliate_owner_user_id: null,
    is_primary: false,
    active: true,
    sort_order: '0',
  };
}

function shopLinkFormFromLink(link: AdminProductShopLink): ShopLinkForm {
  const isAffiliate = link.affiliate_owner_type !== 'none' || link.is_affiliate === 1;
  return {
    shop_name: link.shop_name ?? '',
    url: link.url,
    is_affiliate: isAffiliate,
    affiliate_owner_type: isAffiliate ? link.affiliate_owner_type : 'none',
    affiliate_owner_user_id: link.affiliate_owner_user_id,
    is_primary: link.is_primary === 1,
    active: link.active !== 0,
    sort_order: String(link.sort_order ?? 0),
  };
}

function payloadFromShopLinkForm(form: ShopLinkForm): AdminProductShopLinkPayload {
  const url = form.url.trim();
  if (!url) throw new Error('URL ist erforderlich.');

  const parsedSortOrder = Number(form.sort_order.trim() || '0');
  if (!Number.isInteger(parsedSortOrder)) throw new Error('Sortierung muss eine ganze Zahl sein.');

  const ownerType: AdminProductShopLinkOwnerType = form.is_affiliate
    ? form.affiliate_owner_type === 'user'
      ? 'user'
      : 'nick'
    : 'none';

  return {
    shop_name: textValue(form.shop_name),
    url,
    is_affiliate: form.is_affiliate ? 1 : 0,
    affiliate_owner_type: ownerType,
    affiliate_owner_user_id: ownerType === 'user' ? form.affiliate_owner_user_id : null,
    is_primary: form.is_primary ? 1 : 0,
    active: form.active ? 1 : 0,
    sort_order: parsedSortOrder,
  };
}

function buildPatch(form: ProductQuickForm): AdminProductQAPatch {
  const hasLink = form.shop_link.trim().length > 0;
  return {
    shop_link: form.shop_link.trim() || null,
    is_affiliate: hasLink && form.is_affiliate ? 1 : 0,
    affiliate_owner_type: hasLink && form.is_affiliate ? 'nick' : 'none',
    affiliate_owner_user_id: null,
    moderation_status: form.moderation_status,
  };
}

function formatPrice(value: number | null): string {
  if (value === null) return 'kein Preis';
  return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(value);
}

function linkHealthTone(health: AdminAffiliateLinkHealth | null): AdminTone {
  if (!health || health.status === null || health.status === 'unchecked') return 'neutral';
  if (health.status === 'ok') return 'ok';
  if (health.status === 'timeout') return 'warn';
  return 'danger';
}

function linkHealthLabel(health: AdminAffiliateLinkHealth | null): string {
  if (!health || health.status === null || health.status === 'unchecked') return 'Noch nicht geprüft';
  if (health.status === 'ok') return 'Link ok';
  if (health.status === 'timeout') return 'Timeout';
  if (health.status === 'invalid') return 'Ungueltiger Link';
  return 'Link fehlgeschlagen';
}

function formatLinkHealthTitle(health: AdminAffiliateLinkHealth | null): string {
  if (!health || health.status === null || health.status === 'unchecked') return 'Linkstatus: Noch nicht geprüft';
  const parts = [
    `Linkstatus: ${linkHealthLabel(health)}`,
    health.http_status !== null ? `HTTP ${health.http_status}` : null,
    health.consecutive_failures !== null && health.consecutive_failures > 0
      ? `${health.consecutive_failures} Fehler in Folge`
      : null,
    health.last_checked_at ? `Zuletzt: ${health.last_checked_at}` : null,
  ].filter(Boolean);
  return parts.join(' | ');
}

function moderationLabel(value?: string | null): string {
  if (value === 'pending') return 'wartet auf Prüfung';
  if (value === 'approved') return 'freigegeben';
  if (value === 'rejected') return 'abgelehnt';
  if (value === 'blocked') return 'gesperrt';
  return 'ohne Status';
}

function shopLinkOwnerLabel(link: AdminProductShopLink): string {
  if (link.affiliate_owner_type === 'nick') return 'Partnerlink';
  if (link.affiliate_owner_type === 'user') return 'User-Link';
  return 'Kein Partnerlink';
}

function shopLinkOwnerTone(link: AdminProductShopLink): AdminTone {
  if (link.affiliate_owner_type === 'nick') return 'ok';
  if (link.affiliate_owner_type === 'user') return 'info';
  return 'neutral';
}

function primaryOrFirstLink(links: AdminProductShopLink[]): AdminProductShopLink | null {
  return links.find((link) => link.is_primary === 1 && link.active !== 0) ??
    links.find((link) => link.active !== 0) ??
    links[0] ??
    null;
}

function ProductRow({
  product,
  onSaved,
  onImageEdit,
  onImageDelete,
  onOpenLinks,
}: {
  product: AdminCatalogProduct;
  onSaved: (product: AdminCatalogProduct) => void;
  onImageEdit: (product: AdminCatalogProduct) => void;
  onImageDelete: (product: AdminCatalogProduct) => void;
  onOpenLinks: (product: AdminCatalogProduct) => void;
}) {
  const [form, setForm] = useState<ProductQuickForm>(() => formFromProduct(product));
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState('');

  useEffect(() => {
    setForm(formFromProduct(product));
    setStatus('');
  }, [product]);

  const updateField = <K extends keyof ProductQuickForm>(field: K, value: ProductQuickForm[K]) => {
    setForm((previous) => ({ ...previous, [field]: value }));
  };

  const handleSave = async () => {
    setSaving(true);
    setStatus('');
    try {
      const updated = await updateProductQA(product.id, buildPatch(form), { version: product.version });
      onSaved({
        ...product,
        shop_link: updated.shop_link,
        is_affiliate: updated.is_affiliate,
        affiliate_owner_type: updated.affiliate_owner_type,
        affiliate_owner_user_id: updated.affiliate_owner_user_id,
        link_health: updated.link_health,
        moderation_status: updated.moderation_status,
        version: updated.version,
      });
      setStatus('Gespeichert.');
    } catch (error) {
      setStatus(getErrorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  return (
    <article className="admin-card admin-card-pad">
      <div className="grid gap-3 xl:grid-cols-[minmax(260px,0.78fr)_minmax(520px,1.22fr)]">
        <div className="flex min-w-0 gap-3">
          <button
            type="button"
            onClick={() => onImageEdit(product)}
            className="relative grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-[var(--admin-r-md)] border border-[color:var(--admin-line)] bg-[color:var(--admin-bg)]"
            title="Produktbild bearbeiten"
          >
            {product.image_url ? (
              <img src={product.image_url} alt="" className="h-full w-full object-cover" />
            ) : (
              <PackageSearch size={20} className="admin-muted" />
            )}
          </button>
          <div className="min-w-0">
            <Link
              to={`/administrator/products/${product.id}`}
              className="truncate text-sm font-medium hover:underline"
              style={{ fontFamily: 'var(--admin-serif)' }}
            >
              {product.name}
            </Link>
            <p className="admin-muted mt-1 text-xs">
              {product.brand || 'Ohne Marke'} - {formatPrice(product.price)}
            </p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              <span title={formatLinkHealthTitle(product.link_health)}>
                <AdminBadge tone={linkHealthTone(product.link_health)}>Link: {linkHealthLabel(product.link_health)}</AdminBadge>
              </span>
              <AdminBadge>{moderationLabel(product.moderation_status)}</AdminBadge>
              {product.image_url && (
                <button
                  type="button"
                  onClick={() => onImageDelete(product)}
                  className="admin-badge admin-badge-danger"
                  title="Bild löschen"
                >
                  <Trash2 size={12} />
                  Bild löschen
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="grid gap-2 md:grid-cols-[minmax(260px,1fr)_120px_150px_auto]">
          <label className="text-xs font-medium text-[color:var(--admin-ink-2)]">
            Hauptlink
            <input
              value={form.shop_link}
              onChange={(event) => updateField('shop_link', event.target.value)}
              className="admin-input mt-1"
              placeholder="https://..."
            />
            <button
              type="button"
              onClick={() => onOpenLinks(product)}
              className="admin-muted mt-1 block text-left text-xs hover:underline"
            >
              weitere Links
            </button>
          </label>
          <label className="flex min-h-[38px] items-center gap-2 pt-5 text-xs font-medium text-[color:var(--admin-ink-2)]">
            <input
              type="checkbox"
              checked={form.is_affiliate}
              onChange={(event) => updateField('is_affiliate', event.target.checked)}
            />
            Affiliate
          </label>
          <label className="text-xs font-medium text-[color:var(--admin-ink-2)]">
            Freigabe
            <select
              value={form.moderation_status}
              onChange={(event) => updateField('moderation_status', event.target.value as ProductModerationStatus)}
              className="admin-select mt-1"
            >
              <option value="approved">Freigegeben</option>
              <option value="pending">Prüfen</option>
              <option value="blocked">Gesperrt</option>
              <option value="rejected">Abgelehnt</option>
            </select>
          </label>
          <div className="flex items-start justify-end gap-2 pt-5">
            {product.shop_link && (
              <a
                href={product.shop_link}
                target="_blank"
                rel="noopener noreferrer"
                className="admin-icon-btn"
                title="Hauptlink öffnen"
                aria-label="Hauptlink öffnen"
              >
                <ExternalLink size={16} />
              </a>
            )}
            <AdminButton variant="primary" onClick={() => void handleSave()} disabled={saving} title="Speichern">
              <Save size={16} />
            </AdminButton>
          </div>
        </div>
      </div>
      {status && <p className="admin-muted mt-2 text-xs">{status}</p>}
    </article>
  );
}

function ShopLinksModal({
  product,
  onClose,
  onProductChanged,
}: {
  product: AdminCatalogProduct;
  onClose: () => void;
  onProductChanged: () => void;
}) {
  const [links, setLinks] = useState<AdminProductShopLink[]>([]);
  const [healthAvailable, setHealthAvailable] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [savingId, setSavingId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<ShopLinkForm>(() => emptyShopLinkForm());

  const loadLinks = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await getAdminProductShopLinks(product.id);
      let nextLinks = response.links;
      if (nextLinks.length === 1 && nextLinks[0].is_primary !== 1) {
        const onlyLink = nextLinks[0];
        const updated = await updateAdminProductShopLink(
          product.id,
          onlyLink.id,
          { is_primary: 1, version: onlyLink.version },
          { version: onlyLink.version },
        );
        nextLinks = [updated];
        onProductChanged();
      }
      setLinks(nextLinks);
      setHealthAvailable(response.health_available);
    } catch (errorValue) {
      setError(getErrorMessage(errorValue));
      setLinks([]);
      setHealthAvailable(false);
    } finally {
      setLoading(false);
    }
  }, [onProductChanged, product.id]);

  useEffect(() => {
    void loadLinks();
  }, [loadLinks]);

  const updateField = <K extends keyof ShopLinkForm>(field: K, value: ShopLinkForm[K]) => {
    setForm((previous) => ({ ...previous, [field]: value }));
  };

  const startCreate = () => {
    setEditingId(null);
    setForm({
      ...emptyShopLinkForm(),
      is_primary: links.length === 0,
      sort_order: String(links.length * 10),
    });
    setError('');
    setMessage('');
  };

  const startEdit = (link: AdminProductShopLink) => {
    setEditingId(link.id);
    setForm(shopLinkFormFromLink(link));
    setError('');
    setMessage('');
  };

  const cancelEdit = () => {
    setEditingId(null);
    setForm(emptyShopLinkForm());
  };

  const refreshAfterMutation = async (successMessage: string) => {
    await loadLinks();
    onProductChanged();
    setMessage(successMessage);
    window.setTimeout(() => setMessage(''), 2200);
  };

  const handleSaveLink = async () => {
    const savingKey = editingId ? `save-${editingId}` : 'create';
    setSavingId(savingKey);
    setError('');
    setMessage('');
    try {
      const payload = payloadFromShopLinkForm(form);
      if (!editingId && links.length === 0) payload.is_primary = 1;
      if (editingId) {
        const existing = links.find((link) => link.id === editingId);
        await updateAdminProductShopLink(product.id, editingId, payload, { version: existing?.version ?? null });
      } else {
        await createAdminProductShopLink(product.id, payload);
      }
      setEditingId(null);
      setForm(emptyShopLinkForm());
      await refreshAfterMutation(editingId ? 'Shop-Link gespeichert.' : 'Shop-Link angelegt.');
    } catch (errorValue) {
      setError(getErrorMessage(errorValue));
    } finally {
      setSavingId(null);
    }
  };

  const handleSetPrimary = async (link: AdminProductShopLink) => {
    setSavingId(`primary-${link.id}`);
    setError('');
    try {
      await updateAdminProductShopLink(
        product.id,
        link.id,
        { is_primary: 1, active: 1, version: link.version },
        { version: link.version },
      );
      await refreshAfterMutation('Hauptlink gesetzt.');
    } catch (errorValue) {
      setError(getErrorMessage(errorValue));
    } finally {
      setSavingId(null);
    }
  };

  const handleToggleActive = async (link: AdminProductShopLink) => {
    setSavingId(`active-${link.id}`);
    setError('');
    try {
      await updateAdminProductShopLink(
        product.id,
        link.id,
        { active: link.active === 0 ? 1 : 0, version: link.version },
        { version: link.version },
      );
      await refreshAfterMutation(link.active === 0 ? 'Link aktiviert.' : 'Link deaktiviert.');
    } catch (errorValue) {
      setError(getErrorMessage(errorValue));
    } finally {
      setSavingId(null);
    }
  };

  const handleRecheck = async (link: AdminProductShopLink) => {
    setSavingId(`recheck-${link.id}`);
    setError('');
    try {
      await recheckAdminProductShopLink(product.id, link.id);
      await refreshAfterMutation('Link erneut geprüft.');
    } catch (errorValue) {
      setError(getErrorMessage(errorValue));
    } finally {
      setSavingId(null);
    }
  };

  const handleDelete = async (link: AdminProductShopLink) => {
    if (!window.confirm(`Shop-Link "${link.shop_name || linkHost(link.url)}" löschen?`)) return;
    setSavingId(`delete-${link.id}`);
    setError('');
    try {
      await deleteAdminProductShopLink(product.id, link.id, { version: link.version });
      if (editingId === link.id) cancelEdit();
      await refreshAfterMutation('Shop-Link gelöscht.');
    } catch (errorValue) {
      setError(getErrorMessage(errorValue));
    } finally {
      setSavingId(null);
    }
  };

  const mainLink = primaryOrFirstLink(links);

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/35 px-3 py-8" role="dialog" aria-modal="true">
      <div className="admin-card w-full max-w-5xl overflow-hidden bg-[color:var(--admin-panel)] shadow-xl">
        <div className="admin-card-head">
          <div className="min-w-0">
            <h2 className="admin-card-title">Shoplinks</h2>
            <p className="admin-card-sub truncate">{product.name}</p>
          </div>
          <div className="flex flex-wrap justify-end gap-2">
            <AdminButton size="sm" onClick={() => void loadLinks()} disabled={loading || savingId !== null}>
              <RefreshCw size={13} />
              Aktualisieren
            </AdminButton>
            <AdminButton size="sm" variant="primary" onClick={startCreate} disabled={savingId !== null}>
              <Plus size={13} />
              Neuer Link
            </AdminButton>
            <AdminButton size="sm" variant="ghost" onClick={onClose}>
              <X size={13} />
              Schliessen
            </AdminButton>
          </div>
        </div>

        <div className="grid gap-4 p-4">
          {error && <AdminError>{error}</AdminError>}
          {message && <p className="admin-muted text-xs">{message}</p>}
          {!healthAvailable && (
            <p className="admin-muted text-xs">Linkcheck-Daten sind in dieser Umgebung nicht verfuegbar.</p>
          )}

          {loading ? (
            <AdminEmpty>Lade Shoplinks...</AdminEmpty>
          ) : links.length === 0 ? (
            <AdminEmpty>Keine Shoplinks vorhanden. Lege den ersten Hauptlink an.</AdminEmpty>
          ) : (
            <div className="grid gap-2">
              {links.map((link) => {
                const isMain = mainLink?.id === link.id;
                return (
                  <article
                    key={link.id}
                    className="rounded-[var(--admin-r-sm)] border border-[color:var(--admin-line)] bg-[color:var(--admin-bg)] p-3 text-sm"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-medium">{link.shop_name || linkHost(link.url)}</span>
                          {isMain ? <AdminBadge tone="ok">Hauptlink</AdminBadge> : null}
                          <AdminBadge tone={link.active ? 'info' : 'neutral'}>{link.active ? 'aktiv' : 'inaktiv'}</AdminBadge>
                          <AdminBadge tone={shopLinkOwnerTone(link)}>{shopLinkOwnerLabel(link)}</AdminBadge>
                          <AdminBadge tone={linkHealthTone(link.health)}>{linkHealthLabel(link.health)}</AdminBadge>
                        </div>
                        <a
                          href={link.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="admin-mono mt-2 block break-all text-xs text-[color:var(--admin-info-ink)] hover:underline"
                        >
                          {link.url}
                        </a>
                        <div className="admin-muted mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs">
                          <span>Sortierung: {link.sort_order}</span>
                          <span>Check: {formatDate(link.health?.last_checked_at ?? null)}</span>
                          {link.health?.http_status ? <span>HTTP {link.health.http_status}</span> : null}
                        </div>
                        {link.health?.failure_reason ? (
                          <p className="admin-muted mt-1 text-xs">Fehler: {link.health.failure_reason}</p>
                        ) : null}
                      </div>
                      <div className="flex shrink-0 flex-wrap gap-2">
                        <a href={link.url} target="_blank" rel="noopener noreferrer" className="admin-icon-btn" title="Shoplink öffnen" aria-label="Shoplink öffnen">
                          <ExternalLink size={15} />
                        </a>
                        {!isMain ? (
                          <AdminButton size="sm" variant="ghost" onClick={() => void handleSetPrimary(link)} disabled={savingId !== null}>
                            Hauptlink
                          </AdminButton>
                        ) : null}
                        <AdminButton size="sm" variant="ghost" onClick={() => void handleToggleActive(link)} disabled={savingId !== null}>
                          {link.active ? 'Deaktivieren' : 'Aktivieren'}
                        </AdminButton>
                        <AdminButton size="sm" variant="ghost" onClick={() => void handleRecheck(link)} disabled={savingId !== null || !healthAvailable}>
                          <RefreshCw size={13} />
                          {savingId === `recheck-${link.id}` ? 'Prüfe...' : 'Recheck'}
                        </AdminButton>
                        <AdminButton size="sm" variant="ghost" onClick={() => startEdit(link)} disabled={savingId !== null}>
                          <Edit3 size={13} />
                          Bearbeiten
                        </AdminButton>
                        <AdminButton size="sm" variant="danger" onClick={() => void handleDelete(link)} disabled={savingId !== null}>
                          <Trash2 size={13} />
                          Loeschen
                        </AdminButton>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}

          <AdminCard
            title={editingId ? 'Shoplink bearbeiten' : 'Neuen Shoplink anlegen'}
            subtitle="Der aktive Hauptlink wird in der Produktliste als sichtbarer Link verwendet."
            actions={editingId ? (
              <AdminButton size="sm" variant="ghost" onClick={cancelEdit} disabled={savingId !== null}>
                <X size={13} />
                Abbrechen
              </AdminButton>
            ) : null}
          >
            <div className="grid gap-3 p-3 md:grid-cols-[160px_minmax(280px,1fr)_110px_120px_120px_auto]">
              <label className="text-xs font-medium text-[color:var(--admin-ink-2)]">
                Shop
                <input
                  value={form.shop_name}
                  onChange={(event) => updateField('shop_name', event.target.value)}
                  className="admin-input mt-1"
                  placeholder="z. B. Amazon"
                />
              </label>
              <label className="text-xs font-medium text-[color:var(--admin-ink-2)]">
                URL
                <input
                  value={form.url}
                  onChange={(event) => updateField('url', event.target.value)}
                  className="admin-input mt-1"
                  placeholder="https://..."
                />
              </label>
              <label className="text-xs font-medium text-[color:var(--admin-ink-2)]">
                Sortierung
                <input
                  value={form.sort_order}
                  onChange={(event) => updateField('sort_order', event.target.value)}
                  inputMode="numeric"
                  className="admin-input mt-1"
                />
              </label>
              <label className="flex min-h-[38px] items-center gap-2 pt-5 text-xs font-medium text-[color:var(--admin-ink-2)]">
                <input
                  type="checkbox"
                  checked={form.is_affiliate}
                  onChange={(event) => updateField('is_affiliate', event.target.checked)}
                />
                Affiliate
              </label>
              <label className="flex min-h-[38px] items-center gap-2 pt-5 text-xs font-medium text-[color:var(--admin-ink-2)]">
                <input
                  type="checkbox"
                  checked={form.active}
                  onChange={(event) => updateField('active', event.target.checked)}
                />
                Aktiv
              </label>
              <label className="flex min-h-[38px] items-center gap-2 pt-5 text-xs font-medium text-[color:var(--admin-ink-2)]">
                <input
                  type="checkbox"
                  checked={form.is_primary}
                  onChange={(event) => updateField('is_primary', event.target.checked)}
                />
                Hauptlink
              </label>
              <div className="flex items-end justify-end md:col-span-6">
                <AdminButton variant="primary" onClick={() => void handleSaveLink()} disabled={savingId !== null}>
                  <Save size={15} />
                  {savingId === 'create' || (editingId && savingId === `save-${editingId}`)
                    ? 'Speichere...'
                    : editingId ? 'Speichern' : 'Anlegen'}
                </AdminButton>
              </div>
            </div>
          </AdminCard>
        </div>
      </div>
    </div>
  );
}

export default function AdministratorProductsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [products, setProducts] = useState<AdminCatalogProduct[]>([]);
  const [queryInput, setQueryInput] = useState(searchParams.get('q') ?? '');
  const [query, setQuery] = useState(searchParams.get('q') ?? '');
  const [moderation, setModeration] = useState(searchParams.get('moderation') ?? 'all');
  const [affiliate, setAffiliate] = useState(searchParams.get('affiliate') ?? 'all');
  const [image, setImage] = useState(searchParams.get('image') ?? 'all');
  const [linkStatus, setLinkStatus] = useState(searchParams.get('link_status') ?? 'all');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState<(typeof PAGE_LIMIT_OPTIONS)[number]>(50);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [imageProduct, setImageProduct] = useState<AdminCatalogProduct | null>(null);
  const [shopLinksProduct, setShopLinksProduct] = useState<AdminCatalogProduct | null>(null);

  const loadProducts = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await getAdminProducts({
        q: query,
        page,
        limit,
        moderation,
        affiliate,
        image,
        link_status: linkStatus,
      });
      setProducts(response.products);
      setTotal(response.total);
    } catch (err) {
      setProducts([]);
      setTotal(0);
      setError(err instanceof Error ? err.message : 'Produkte konnten nicht geladen werden.');
    } finally {
      setLoading(false);
    }
  }, [affiliate, image, limit, linkStatus, moderation, page, query]);

  useEffect(() => {
    void loadProducts();
  }, [loadProducts]);

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

  const applyQuery = useCallback(() => {
    setPage(1);
    setQuery(queryInput);
    const next = new URLSearchParams();
    if (queryInput.trim()) next.set('q', queryInput.trim());
    if (moderation !== 'all') next.set('moderation', moderation);
    if (affiliate !== 'all') next.set('affiliate', affiliate);
    if (image !== 'all') next.set('image', image);
    if (linkStatus !== 'all') next.set('link_status', linkStatus);
    setSearchParams(next);
  }, [affiliate, image, linkStatus, moderation, queryInput, setSearchParams]);

  const handleSaved = useCallback((updated: AdminCatalogProduct) => {
    setProducts((previous) => previous.map((product) => (product.id === updated.id ? updated : product)));
  }, []);

  const handleImageDeleted = useCallback(async (product: AdminCatalogProduct) => {
    if (!window.confirm(`Bild für "${product.name}" löschen?`)) return;
    try {
      const response = await deleteAdminProductImage(product.id, { version: product.version });
      setProducts((previous) =>
        previous.map((entry) =>
          entry.id === product.id
            ? { ...entry, image_url: null, image_r2_key: response.image_r2_key, version: response.product_version }
            : entry,
        ),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Bild konnte nicht gelöscht werden.');
    }
  }, []);

  const handleImageUploaded = useCallback((product: AdminCatalogProduct, imageUrl: string, response?: { image_url: string; image_r2_key?: string | null; product_version?: number | null }) => {
    setProducts((previous) =>
      previous.map((entry) =>
        entry.id === product.id
          ? {
              ...entry,
              image_url: imageUrl,
              image_r2_key: response?.image_r2_key ?? entry.image_r2_key,
              version: response?.product_version ?? entry.version,
            }
          : entry,
      ),
    );
  }, []);

  return (
    <>
      <AdminPageHeader
        title="Produkte"
        subtitle="Produkte prüfen, Links setzen und freigeben."
        meta={<AdminBadge tone="info">{total} Treffer</AdminBadge>}
      />

      <div className="mb-4 grid gap-2">
        <div className="admin-filter-bar">
          <div className="admin-filter-main">
            <label className="relative flex-1">
              <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[color:var(--admin-ink-3)]" />
              <input
                value={queryInput}
                onChange={(event) => setQueryInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') applyQuery();
                }}
                placeholder="Produkt, Marke oder Link suchen"
                className="admin-input admin-filter-search pl-9"
              />
            </label>
          </div>
          <div className="admin-filter-controls">
            <select value={moderation} onChange={(event) => { setPage(1); setModeration(event.target.value); }} className="admin-select">
              <option value="all">Alle Freigaben</option>
              <option value="approved">Freigegeben</option>
              <option value="pending">Nicht freigegeben</option>
              <option value="blocked">Gesperrt</option>
              <option value="rejected">Abgelehnt</option>
            </select>
            <select value={affiliate} onChange={(event) => { setPage(1); setAffiliate(event.target.value); }} className="admin-select">
              <option value="all">Alle Partnerlinks</option>
              <option value="partner">Partnerlink</option>
              <option value="no_partner">Kein Partnerlink</option>
            </select>
            <select value={linkStatus} onChange={(event) => { setPage(1); setLinkStatus(event.target.value); }} className="admin-select">
              <option value="all">Alle Linkchecks</option>
              <option value="unchecked">Ungeprüft</option>
              <option value="dead">Deadlinks</option>
            </select>
            <select value={image} onChange={(event) => { setPage(1); setImage(event.target.value); }} className="admin-select">
              <option value="all">Alle Bilder</option>
              <option value="with">Mit Bild</option>
              <option value="without">Ohne Bild</option>
            </select>
          </div>
          <div className="admin-filter-actions">
            <AdminButton onClick={applyQuery}>
              <Search size={13} />
              Suchen
            </AdminButton>
            <AdminButton onClick={() => void loadProducts()} disabled={loading}>
              <RefreshCw size={14} />
              Aktualisieren
            </AdminButton>
          </div>
        </div>

        <div className="admin-filter-bar admin-filter-bar-flat">
          <div className="admin-filter-main">
            <span className="admin-muted text-sm">
              Seite {page} / {totalPages} - {rangeStart}-{rangeEnd} von {total}
            </span>
          </div>
          <div className="admin-filter-actions">
            <select
              value={limit}
              onChange={(event) => {
                setPage(1);
                setLimit(Number(event.target.value) as (typeof PAGE_LIMIT_OPTIONS)[number]);
              }}
              className="admin-select w-[140px]"
              aria-label="Eintraege pro Seite"
            >
              {PAGE_LIMIT_OPTIONS.map((entry) => (
                <option key={entry} value={entry}>
                  {entry} / Seite
                </option>
              ))}
            </select>
            <AdminButton onClick={() => setPage((current) => Math.max(1, current - 1))} disabled={!canLoadPrevious || loading}>
              <ChevronLeft size={13} />
              Zurueck
            </AdminButton>
            <AdminButton onClick={() => setPage((current) => current + 1)} disabled={!canLoadNext || loading}>
              Weiter
              <ChevronRight size={13} />
            </AdminButton>
          </div>
        </div>
      </div>

      {error && <AdminError>{error}</AdminError>}

      {loading ? (
        <AdminEmpty>Lade Produkte...</AdminEmpty>
      ) : (
        <AdminCard title="Produktliste" subtitle="Hauptlinks direkt bearbeiten, weitere Links öffnen.">
          <div className="space-y-2 p-3">
            {products.map((product) => (
              <ProductRow
                key={product.id}
                product={product}
                onSaved={handleSaved}
                onImageEdit={setImageProduct}
                onImageDelete={(entry) => void handleImageDeleted(entry)}
                onOpenLinks={setShopLinksProduct}
              />
            ))}
            {products.length === 0 && <AdminEmpty>Keine Produkte gefunden.</AdminEmpty>}
          </div>
        </AdminCard>
      )}

      {shopLinksProduct && (
        <ShopLinksModal
          product={shopLinksProduct}
          onClose={() => setShopLinksProduct(null)}
          onProductChanged={() => void loadProducts()}
        />
      )}

      {imageProduct && (
        <ImageCropModal
          currentImageUrl={imageProduct.image_url ?? undefined}
          productId={imageProduct.id}
          uploadEndpoint={`/api/admin/products/${imageProduct.id}/image`}
          uploadVersion={imageProduct.version}
          onClose={() => setImageProduct(null)}
          onSuccess={(imageUrl, response) => handleImageUploaded(imageProduct, imageUrl, response)}
          onError={(message) => setError(message)}
        />
      )}
    </>
  );
}
