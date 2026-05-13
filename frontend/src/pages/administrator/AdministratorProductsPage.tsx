import { useCallback, useEffect, useRef, useState } from 'react';
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
  Upload,
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
  role: ShopLinkRole;
  active: boolean;
  sort_order: string;
};

type ShopLinkRole = 'primary' | 'alternative' | 'standard';

const STANDARD_LINK_SORT_ORDER = 1000;

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

function defaultShopLinkRole(existingCount: number, rowIndex = 0): ShopLinkRole {
  const position = existingCount + rowIndex;
  if (position === 0) return 'primary';
  if (position <= 3) return 'alternative';
  return 'standard';
}

function sortOrderForRole(role: ShopLinkRole, existingCount: number, rowIndex = 0): string {
  if (role === 'primary') return '0';
  if (role === 'standard') return String(STANDARD_LINK_SORT_ORDER + Math.max(0, existingCount + rowIndex - 4) * 10);
  return String(Math.max(1, existingCount + rowIndex) * 10);
}

function roleFromShopLink(link: AdminProductShopLink, index: number): ShopLinkRole {
  if (link.is_primary === 1) return 'primary';
  if (link.source_type === 'user_product' || link.source_type === 'user_submission') return 'standard';
  if ((link.sort_order ?? 0) >= STANDARD_LINK_SORT_ORDER) return 'standard';
  return index <= 3 ? 'alternative' : 'standard';
}

function emptyShopLinkForm(role: ShopLinkRole = 'standard', sortOrder = '0'): ShopLinkForm {
  return {
    shop_name: '',
    url: '',
    is_affiliate: true,
    affiliate_owner_type: 'nick',
    affiliate_owner_user_id: null,
    role,
    active: true,
    sort_order: sortOrder,
  };
}

function shopLinkFormFromLink(link: AdminProductShopLink, index: number): ShopLinkForm {
  const isAffiliate = link.affiliate_owner_type !== 'none' || link.is_affiliate === 1;
  return {
    shop_name: link.shop_name ?? '',
    url: link.url,
    is_affiliate: isAffiliate,
    affiliate_owner_type: isAffiliate ? link.affiliate_owner_type : 'none',
    affiliate_owner_user_id: link.affiliate_owner_user_id,
    role: roleFromShopLink(link, index),
    active: link.active !== 0,
    sort_order: String(link.sort_order ?? 0),
  };
}

function payloadFromShopLinkForm(form: ShopLinkForm): AdminProductShopLinkPayload {
  const url = form.url.trim();
  if (!url) throw new Error('URL ist erforderlich.');

  const parsedSortOrder = Number(form.sort_order.trim() || '0');
  if (!Number.isInteger(parsedSortOrder)) throw new Error('Sortierung muss eine ganze Zahl sein.');
  const sortOrder = form.role === 'standard'
    ? Math.max(parsedSortOrder, STANDARD_LINK_SORT_ORDER)
    : form.role === 'alternative' && parsedSortOrder >= STANDARD_LINK_SORT_ORDER
      ? 10
      : parsedSortOrder;

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
    is_primary: form.role === 'primary' ? 1 : 0,
    active: form.active ? 1 : 0,
    sort_order: sortOrder,
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
  if (health.status === 'ok') return 'OK';
  return 'Defekt';
}

function linkHealthBadgeText(health: AdminAffiliateLinkHealth | null): string {
  const label = linkHealthLabel(health);
  if (label === 'OK') return 'Link: OK';
  if (label === 'Defekt') return 'Link: Defekt';
  return 'Link: Noch nicht geprüft';
}

function formatLinkHealthTitle(health: AdminAffiliateLinkHealth | null): string {
  if (!health || health.status === null || health.status === 'unchecked') return 'Link: Noch nicht geprüft';
  const parts = [
    linkHealthBadgeText(health),
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
  onOpenLinks,
}: {
  product: AdminCatalogProduct;
  onSaved: (product: AdminCatalogProduct) => void;
  onImageEdit: (product: AdminCatalogProduct) => void;
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
                <AdminBadge tone={linkHealthTone(product.link_health)}>{linkHealthBadgeText(product.link_health)}</AdminBadge>
              </span>
              <AdminBadge>{moderationLabel(product.moderation_status)}</AdminBadge>
              <AdminBadge tone="warn" className="admin-badge-warn">Link-Klicks: {product.link_click_count}</AdminBadge>
            </div>
          </div>
        </div>

        <div className="grid gap-2 md:grid-cols-[minmax(260px,1fr)_120px_150px_auto]">
          <div className="text-xs font-medium text-[color:var(--admin-ink-2)]">
            <span>Hauptlink</span>
            <div className="mt-1 flex gap-1.5">
              <input
                value={form.shop_link}
                onChange={(event) => updateField('shop_link', event.target.value)}
                className="admin-input admin-url-input"
                placeholder="https://..."
              />
              {product.shop_link && (
                <a
                  href={product.shop_link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="admin-icon-btn admin-icon-btn-warn"
                  title="Hauptlink öffnen"
                  aria-label="Hauptlink öffnen"
                >
                  <ExternalLink size={16} />
                </a>
              )}
            </div>
            <button
              type="button"
              onClick={() => onOpenLinks(product)}
              className="admin-muted mt-1 block text-left text-xs hover:underline"
            >
              Weitere Links
            </button>
          </div>
          <label className={`admin-toggle-card mt-5 ${form.is_affiliate ? 'admin-toggle-card-ok' : 'admin-toggle-card-danger'}`}>
            <input
              type="checkbox"
              checked={form.is_affiliate}
              onChange={(event) => updateField('is_affiliate', event.target.checked)}
            />
            <span>Affiliate-Link: {form.is_affiliate ? 'Ja' : 'Nein'}</span>
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
  const [form, setForm] = useState<ShopLinkForm>(() => emptyShopLinkForm('standard', String(STANDARD_LINK_SORT_ORDER)));
  const [createForms, setCreateForms] = useState<ShopLinkForm[]>(() => [emptyShopLinkForm('primary', '0')]);

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

  useEffect(() => {
    setCreateForms((previous) => {
      if (previous.length !== 1 || previous[0].url.trim() || previous[0].shop_name.trim()) return previous;
      const role = defaultShopLinkRole(links.length);
      return [emptyShopLinkForm(role, sortOrderForRole(role, links.length))];
    });
  }, [links]);

  const updateField = <K extends keyof ShopLinkForm>(field: K, value: ShopLinkForm[K]) => {
    setForm((previous) => ({ ...previous, [field]: value }));
  };

  const updateCreateField = <K extends keyof ShopLinkForm>(index: number, field: K, value: ShopLinkForm[K]) => {
    setCreateForms((previous) =>
      previous.map((entry, entryIndex) => {
        if (entryIndex !== index) return entry;
        return { ...entry, [field]: value };
      }),
    );
  };

  const addCreateForm = () => {
    setCreateForms((previous) => {
      const role = defaultShopLinkRole(links.length, previous.length);
      return [...previous, emptyShopLinkForm(role, sortOrderForRole(role, links.length, previous.length))];
    });
  };

  const startCreate = () => {
    setEditingId(null);
    const role = defaultShopLinkRole(links.length);
    setCreateForms([emptyShopLinkForm(role, sortOrderForRole(role, links.length))]);
    setError('');
    setMessage('');
  };

  const startEdit = (link: AdminProductShopLink, index: number) => {
    setEditingId(link.id);
    setForm(shopLinkFormFromLink(link, index));
    setError('');
    setMessage('');
  };

  const cancelEdit = () => {
    setEditingId(null);
    const role = defaultShopLinkRole(links.length);
    setForm(emptyShopLinkForm('standard', String(STANDARD_LINK_SORT_ORDER)));
    setCreateForms([emptyShopLinkForm(role, sortOrderForRole(role, links.length))]);
  };

  const refreshAfterMutation = async (successMessage: string) => {
    await loadLinks();
    onProductChanged();
    setMessage(successMessage);
    window.setTimeout(() => setMessage(''), 2200);
  };

  const handleSaveLink = async () => {
    const savingKey = editingId ? `save-${editingId}` : 'create';
    let createdCount = 0;
    let attemptedCreateCount = 0;
    setSavingId(savingKey);
    setError('');
    setMessage('');
    try {
      if (editingId) {
        const payload = payloadFromShopLinkForm(form);
        const existing = links.find((link) => link.id === editingId);
        await updateAdminProductShopLink(product.id, editingId, payload, { version: existing?.version ?? null });
      } else {
        const filledForms = createForms.filter((entry) => entry.url.trim() || entry.shop_name.trim());
        if (filledForms.length === 0) throw new Error('Mindestens eine URL ist erforderlich.');
        attemptedCreateCount = filledForms.length;
        for (const [index, entry] of filledForms.entries()) {
          const payload = payloadFromShopLinkForm(entry);
          if (links.length === 0 && index === 0) payload.is_primary = entry.role === 'standard' ? 0 : payload.is_primary;
          await createAdminProductShopLink(product.id, { ...payload, source_type: 'admin' });
          createdCount += 1;
        }
      }
      setEditingId(null);
      const role = defaultShopLinkRole(links.length + (editingId ? 0 : createForms.length));
      setForm(emptyShopLinkForm('standard', String(STANDARD_LINK_SORT_ORDER)));
      setCreateForms([emptyShopLinkForm(role, sortOrderForRole(role, links.length + (editingId ? 0 : createForms.length)))]);
      await refreshAfterMutation(editingId ? 'Shop-Link gespeichert.' : 'Shop-Links angelegt.');
    } catch (errorValue) {
      if (!editingId) {
        await loadLinks().catch(() => undefined);
        if (createdCount > 0) onProductChanged();
      }
      const errorMessage = getErrorMessage(errorValue);
      setError(createdCount > 0 && attemptedCreateCount > 0
        ? `${createdCount} von ${attemptedCreateCount} Shop-Links wurden angelegt. Danach ist ein Fehler aufgetreten: ${errorMessage}`
        : errorMessage);
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
              Schließen
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
              {links.map((link, index) => {
                const isMain = mainLink?.id === link.id;
                const role = roleFromShopLink(link, index);
                return (
                  <article
                    key={link.id}
                    className="rounded-[var(--admin-r-sm)] border border-[color:var(--admin-line)] bg-[color:var(--admin-bg)] p-3 text-sm"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-medium">{link.shop_name || linkHost(link.url)}</span>
                          {isMain ? <AdminBadge tone="ok">Hauptlink</AdminBadge> : (
                            <AdminBadge tone={role === 'alternative' ? 'info' : 'neutral'}>
                              {role === 'alternative' ? 'Alternative' : 'Standard'}
                            </AdminBadge>
                          )}
                          <AdminBadge tone={link.active ? 'info' : 'neutral'}>{link.active ? 'aktiv' : 'inaktiv'}</AdminBadge>
                          <AdminBadge tone={shopLinkOwnerTone(link)}>{shopLinkOwnerLabel(link)}</AdminBadge>
                          <AdminBadge tone={linkHealthTone(link.health)}>{linkHealthBadgeText(link.health)}</AdminBadge>
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
                            Als Hauptlink
                          </AdminButton>
                        ) : null}
                        <AdminButton size="sm" variant="ghost" onClick={() => void handleToggleActive(link)} disabled={savingId !== null}>
                          {link.active ? 'Deaktivieren' : 'Aktivieren'}
                        </AdminButton>
                        <AdminButton size="sm" variant="ghost" onClick={() => void handleRecheck(link)} disabled={savingId !== null || !healthAvailable}>
                          <RefreshCw size={13} />
                          {savingId === `recheck-${link.id}` ? 'Prüfe...' : 'Neu prüfen'}
                        </AdminButton>
                        <AdminButton size="sm" variant="ghost" onClick={() => startEdit(link, index)} disabled={savingId !== null}>
                          <Edit3 size={13} />
                          Bearbeiten
                        </AdminButton>
                        <AdminButton size="sm" variant="danger" onClick={() => void handleDelete(link)} disabled={savingId !== null}>
                          <Trash2 size={13} />
                          Löschen
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
            <div className="grid gap-3 p-3">
              {(editingId ? [form] : createForms).map((entry, index) => {
                const update = <K extends keyof ShopLinkForm,>(field: K, value: ShopLinkForm[K]) => {
                  if (editingId) updateField(field, value);
                  else updateCreateField(index, field, value);
                };
                return (
                  <div
                    key={editingId ?? `create-${index}`}
                    className="grid gap-3 rounded-[var(--admin-r-md)] border border-[color:var(--admin-line)] bg-[color:var(--admin-bg)] p-3 md:grid-cols-[160px_minmax(280px,1fr)_112px_132px_150px]"
                  >
                    <label className="text-xs font-medium text-[color:var(--admin-ink-2)]">
                      Shop
                      <input
                        value={entry.shop_name}
                        onChange={(event) => update('shop_name', event.target.value)}
                        className="admin-input mt-1"
                        placeholder="z. B. Amazon"
                      />
                    </label>
                    <label className="text-xs font-medium text-[color:var(--admin-ink-2)]">
                      URL
                      <input
                        value={entry.url}
                        onChange={(event) => update('url', event.target.value)}
                        className="admin-input admin-url-input mt-1"
                        placeholder="https://..."
                      />
                    </label>
                    <label className="text-xs font-medium text-[color:var(--admin-ink-2)]">
                      Sortierung
                      <input
                        value={entry.sort_order}
                        onChange={(event) => update('sort_order', event.target.value)}
                        inputMode="numeric"
                        className="admin-input mt-1"
                      />
                    </label>
                    <label className="text-xs font-medium text-[color:var(--admin-ink-2)]">
                      Rolle
                      <select
                        value={entry.role}
                        onChange={(event) => update('role', event.target.value as ShopLinkRole)}
                        className="admin-select mt-1"
                      >
                        <option value="primary">Hauptlink</option>
                        <option value="alternative">Alternative</option>
                        <option value="standard">Standard</option>
                      </select>
                    </label>
                    <div className="grid gap-2 pt-5">
                      <label className="admin-toggle-card">
                        <input
                          type="checkbox"
                          checked={entry.is_affiliate}
                          onChange={(event) => update('is_affiliate', event.target.checked)}
                        />
                        <span>Affiliate</span>
                      </label>
                      <label className="admin-toggle-card">
                        <input
                          type="checkbox"
                          checked={entry.active}
                          onChange={(event) => update('active', event.target.checked)}
                        />
                        <span>Aktiv</span>
                      </label>
                    </div>
                  </div>
                );
              })}
              {!editingId && (
                <button
                  type="button"
                  onClick={addCreateForm}
                  className="admin-muted justify-self-start text-xs font-medium hover:underline"
                  disabled={savingId !== null}
                >
                  Weiteren Link hinzufügen
                </button>
              )}
              <div className="flex items-end justify-end">
                <AdminButton className="admin-btn-success" onClick={() => void handleSaveLink()} disabled={savingId !== null}>
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

function ProductImageModal({
  product,
  onClose,
  onDelete,
  onUploaded,
  onError,
}: {
  product: AdminCatalogProduct;
  onClose: () => void;
  onDelete: (product: AdminCatalogProduct) => Promise<void>;
  onUploaded: (product: AdminCatalogProduct, imageUrl: string, response?: { image_url: string; image_r2_key?: string | null; product_version?: number | null }) => void;
  onError: (message: string) => void;
}) {
  const [showUpload, setShowUpload] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    if (!product.image_url) return;
    setDeleting(true);
    try {
      await onDelete(product);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 px-3 py-8" role="dialog" aria-modal="true">
        <div className="admin-card w-full max-w-2xl overflow-hidden bg-[color:var(--admin-panel)] shadow-xl">
          <div className="admin-card-head">
            <div className="min-w-0">
              <h2 className="admin-card-title">Produktbild</h2>
              <p className="admin-card-sub truncate">{product.name}</p>
            </div>
            <AdminButton size="sm" variant="ghost" onClick={onClose}>
              <X size={13} />
              Schließen
            </AdminButton>
          </div>
          <div className="grid gap-4 p-4">
            <div className="grid min-h-[320px] place-items-center rounded-[var(--admin-r-md)] border border-[color:var(--admin-line)] bg-[color:var(--admin-bg)] p-4">
              {product.image_url ? (
                <img
                  src={product.image_url}
                  alt=""
                  className="max-h-[460px] w-full rounded-[var(--admin-r-md)] object-contain"
                />
              ) : (
                <div className="grid justify-items-center gap-2 text-center">
                  <PackageSearch size={32} className="admin-muted" />
                  <p className="admin-muted text-sm">Noch kein Produktbild hinterlegt.</p>
                </div>
              )}
            </div>
            <div className="flex flex-wrap justify-end gap-2">
              {product.image_url && (
                <AdminButton variant="danger" onClick={() => void handleDelete()} disabled={deleting}>
                  <Trash2 size={14} />
                  {deleting ? 'Lösche...' : 'Bild löschen'}
                </AdminButton>
              )}
              <AdminButton variant="primary" onClick={() => setShowUpload(true)} disabled={deleting}>
                <Upload size={14} />
                {product.image_url ? 'Bild ersetzen' : 'Bild hochladen'}
              </AdminButton>
            </div>
          </div>
        </div>
      </div>
      {showUpload && (
        <ImageCropModal
          currentImageUrl={product.image_url ?? undefined}
          productId={product.id}
          uploadEndpoint={`/api/admin/products/${product.id}/image`}
          uploadVersion={product.version}
          onClose={() => setShowUpload(false)}
          onSuccess={(imageUrl, response) => {
            onUploaded(product, imageUrl, response);
            setShowUpload(false);
          }}
          onError={onError}
        />
      )}
    </>
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
  const loadProductsRequestIdRef = useRef(0);

  const loadProducts = useCallback(async () => {
    const requestId = loadProductsRequestIdRef.current + 1;
    loadProductsRequestIdRef.current = requestId;
    const isLatestRequest = () => loadProductsRequestIdRef.current === requestId;

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
      if (!isLatestRequest()) return;
      setProducts(response.products);
      setTotal(response.total);
    } catch (err) {
      if (!isLatestRequest()) return;
      setProducts([]);
      setTotal(0);
      setError(err instanceof Error ? err.message : 'Produkte konnten nicht geladen werden.');
    } finally {
      if (isLatestRequest()) {
        setLoading(false);
      }
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

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      const nextQuery = queryInput.trim();
      setPage(1);
      setQuery(nextQuery);
    }, 300);

    return () => window.clearTimeout(timeoutId);
  }, [queryInput]);

  useEffect(() => {
    const next = new URLSearchParams();
    if (query) next.set('q', query);
    if (moderation !== 'all') next.set('moderation', moderation);
    if (affiliate !== 'all') next.set('affiliate', affiliate);
    if (image !== 'all') next.set('image', image);
    if (linkStatus !== 'all') next.set('link_status', linkStatus);
    setSearchParams(next, { replace: true });
  }, [affiliate, image, linkStatus, moderation, query, setSearchParams]);

  const handleSaved = useCallback((updated: AdminCatalogProduct) => {
    setProducts((previous) => previous.map((product) => (product.id === updated.id ? updated : product)));
  }, []);

  const handleImageDeleted = useCallback(async (product: AdminCatalogProduct) => {
    if (!window.confirm(`Bild für "${product.name}" löschen?`)) return;
    try {
      const response = await deleteAdminProductImage(product.id, { version: product.version });
      const updatedProduct = {
        ...product,
        image_url: null,
        image_r2_key: response.image_r2_key,
        version: response.product_version,
      };
      setProducts((previous) =>
        previous.map((entry) =>
          entry.id === product.id
            ? { ...entry, image_url: null, image_r2_key: response.image_r2_key, version: response.product_version }
            : entry,
        ),
      );
      setImageProduct((current) => (current?.id === product.id ? updatedProduct : current));
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
    setImageProduct((current) =>
      current?.id === product.id
        ? {
            ...current,
            image_url: imageUrl,
            image_r2_key: response?.image_r2_key ?? current.image_r2_key,
            version: response?.product_version ?? current.version,
          }
        : current,
    );
  }, []);

  return (
    <>
      <AdminPageHeader
        title="Produkte"
        subtitle="Produkte anlegen, verwalten und freigeben"
        meta={<AdminBadge tone="info">{total} Treffer</AdminBadge>}
      />

      <div className="mb-4 grid gap-2">
        <div className="admin-filter-bar">
          <div className="admin-filter-main">
            <label className="admin-filter-field admin-filter-search-field">
              <span className="admin-filter-label">Suche</span>
              <span className="admin-filter-search-with-icon relative">
                <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[color:var(--admin-ink-3)]" />
                <input
                  value={queryInput}
                  onChange={(event) => setQueryInput(event.target.value)}
                  placeholder="Produkt, Marke oder Link suchen"
                  className="admin-input admin-filter-search pl-9"
                />
              </span>
            </label>
          </div>
          <div className="admin-filter-controls">
            <label className="admin-filter-field">
              <span className="admin-filter-label">Freigabe</span>
              <select value={moderation} onChange={(event) => { setPage(1); setModeration(event.target.value); }} className="admin-select">
                <option value="all">Alle</option>
                <option value="approved">Freigegeben</option>
                <option value="pending">Nicht freigegeben</option>
                <option value="blocked">Gesperrt</option>
                <option value="rejected">Abgelehnt</option>
              </select>
            </label>
            <label className="admin-filter-field">
              <span className="admin-filter-label">Partner-Status</span>
              <select value={affiliate} onChange={(event) => { setPage(1); setAffiliate(event.target.value); }} className="admin-select">
                <option value="all">Alle</option>
                <option value="partner">Partnerlink</option>
                <option value="no_partner">Kein Partnerlink</option>
              </select>
            </label>
            <label className="admin-filter-field">
              <span className="admin-filter-label">Linkstatus</span>
              <select value={linkStatus} onChange={(event) => { setPage(1); setLinkStatus(event.target.value); }} className="admin-select">
                <option value="all">Alle</option>
                <option value="unchecked">Ungeprüft</option>
                <option value="dead">Deadlinks</option>
              </select>
            </label>
            <label className="admin-filter-field">
              <span className="admin-filter-label">Produktbild</span>
              <select value={image} onChange={(event) => { setPage(1); setImage(event.target.value); }} className="admin-select">
                <option value="all">Alle</option>
                <option value="with">Mit Bild</option>
                <option value="without">Ohne Bild</option>
              </select>
            </label>
            <button
              type="button"
              onClick={() => void loadProducts()}
              disabled={loading}
              className="admin-icon-btn admin-filter-refresh"
              title="Aktualisieren"
              aria-label="Aktualisieren"
            >
              <RefreshCw size={14} />
            </button>
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
              Zurück
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
        <AdminCard title="Produktliste">
          <div className="space-y-2 p-3">
            {products.map((product) => (
              <ProductRow
                key={product.id}
                product={product}
                onSaved={handleSaved}
                onImageEdit={setImageProduct}
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
        <ProductImageModal
          product={imageProduct}
          onClose={() => setImageProduct(null)}
          onDelete={handleImageDeleted}
          onUploaded={handleImageUploaded}
          onError={setError}
        />
      )}
    </>
  );
}
