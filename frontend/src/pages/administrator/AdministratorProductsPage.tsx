import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeft, ChevronRight, ExternalLink, PackageSearch, RefreshCw, Save, Search } from 'lucide-react';
import {
  getAdminProducts,
  updateProductQA,
  type AdminAffiliateLinkHealth,
  type AdminCatalogProduct,
  type AdminProductQAPatch,
} from '../../api/admin';
import { AdminBadge, AdminButton, AdminCard, AdminEmpty, AdminError, AdminPageHeader, type AdminTone } from './AdminUi';

type AffiliateOwnerType = 'none' | 'nick' | 'user';
const PAGE_LIMIT_OPTIONS = [25, 50, 100] as const;

type ProductAffiliateForm = {
  shop_link: string;
  affiliate_owner_type: AffiliateOwnerType;
  affiliate_owner_user_id: string;
};

function ownerTypeFromProduct(product: AdminCatalogProduct): AffiliateOwnerType {
  return product.affiliate_owner_type ?? (product.is_affiliate ? 'nick' : 'none');
}

function formFromProduct(product: AdminCatalogProduct): ProductAffiliateForm {
  const ownerType = ownerTypeFromProduct(product);
  return {
    shop_link: product.shop_link ?? '',
    affiliate_owner_type: ownerType,
    affiliate_owner_user_id:
      ownerType === 'user' && product.affiliate_owner_user_id !== null
        ? String(product.affiliate_owner_user_id)
        : '',
  };
}

function formatPrice(value: number | null): string {
  if (value === null) return 'kein Preis';
  return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(value);
}

function ownerLabel(product: AdminCatalogProduct): string {
  const ownerType = ownerTypeFromProduct(product);
  if (ownerType === 'nick') return 'Nick';
  if (ownerType === 'user') {
    return product.affiliate_owner_user_id !== null
      ? `Nutzer #${product.affiliate_owner_user_id}`
      : 'Nutzer-ID fehlt';
  }
  return 'Kein Partnerlink';
}

function ownerTone(product: AdminCatalogProduct): 'neutral' | 'ok' | 'warn' | 'info' {
  const ownerType = ownerTypeFromProduct(product);
  if (ownerType === 'nick') return 'ok';
  if (ownerType === 'user') return product.affiliate_owner_user_id ? 'info' as const : 'warn';
  return 'neutral';
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
  if (health.status === 'invalid') return 'Ungültiger Link';
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
  return 'ohne Status';
}

function visibilityLabel(value?: string | null): string {
  if (value === 'public') return 'sichtbar';
  if (value === 'hidden') return 'ausgeblendet';
  return 'ohne Sichtbarkeit';
}

function buildPatch(form: ProductAffiliateForm): AdminProductQAPatch {
  const ownerUserIdText = form.affiliate_owner_user_id.trim();
  let ownerUserId: number | null = null;
  if (form.affiliate_owner_type === 'user') {
    const parsed = Number(ownerUserIdText);
    if (!Number.isInteger(parsed) || parsed <= 0) {
      throw new Error('Nutzer-ID muss eine positive ganze Zahl sein.');
    }
    ownerUserId = parsed;
  }
  return {
    shop_link: form.shop_link.trim() || null,
    affiliate_owner_type: form.affiliate_owner_type,
    affiliate_owner_user_id: ownerUserId,
  };
}

function ProductRow({
  product,
  onSaved,
}: {
  product: AdminCatalogProduct;
  onSaved: (product: AdminCatalogProduct) => void;
}) {
  const [form, setForm] = useState<ProductAffiliateForm>(() => formFromProduct(product));
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState('');

  useEffect(() => {
    setForm(formFromProduct(product));
    setStatus('');
  }, [product]);

  const updateField = (field: keyof ProductAffiliateForm, value: string) => {
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
        version: updated.version,
      });
      setStatus('Gespeichert.');
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Speichern fehlgeschlagen.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <article className="admin-card admin-card-pad">
      <div className="grid gap-4 xl:grid-cols-[minmax(280px,0.8fr)_minmax(460px,1.2fr)]">
        <div className="flex min-w-0 gap-3">
          <div className="grid h-14 w-14 shrink-0 place-items-center overflow-hidden rounded-[var(--admin-r-md)] border border-[color:var(--admin-line)] bg-[color:var(--admin-bg)]">
            {product.image_url ? (
              <img src={product.image_url} alt="" className="h-full w-full object-cover" />
            ) : (
              <PackageSearch size={22} className="admin-muted" />
            )}
          </div>
          <div className="min-w-0">
            <Link
              to={`/administrator/products/${product.id}`}
              className="truncate font-medium hover:underline"
              style={{ fontFamily: 'var(--admin-serif)' }}
            >
              #{product.id} {product.name}
            </Link>
            <p className="admin-muted mt-1 text-xs">
              {product.brand || 'Ohne Marke'} - {formatPrice(product.price)}
            </p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              <AdminBadge tone={ownerTone(product)}>{ownerLabel(product)}</AdminBadge>
              <span title={formatLinkHealthTitle(product.link_health)}>
                <AdminBadge tone={linkHealthTone(product.link_health)}>Link: {linkHealthLabel(product.link_health)}</AdminBadge>
              </span>
              <AdminBadge>{moderationLabel(product.moderation_status)}</AdminBadge>
              <AdminBadge>{visibilityLabel(product.visibility)}</AdminBadge>
            </div>
          </div>
        </div>

        <div className="grid gap-2 md:grid-cols-[minmax(220px,1fr)_150px_150px_auto]">
          <label className="text-xs font-medium text-[color:var(--admin-ink-2)]">
            Shop-Link
            <input
              value={form.shop_link}
              onChange={(event) => updateField('shop_link', event.target.value)}
              className="admin-input mt-1"
            />
          </label>
          <label className="text-xs font-medium text-[color:var(--admin-ink-2)]">
            Link gehört zu
            <select
              value={form.affiliate_owner_type}
              onChange={(event) => updateField('affiliate_owner_type', event.target.value as AffiliateOwnerType)}
              className="admin-select mt-1"
            >
              <option value="none">Keiner</option>
              <option value="nick">Nick</option>
            <option value="user">Nutzer</option>
            </select>
          </label>
          <label className="text-xs font-medium text-[color:var(--admin-ink-2)]">
            Nutzer-ID
            <input
              value={form.affiliate_owner_user_id}
              onChange={(event) => updateField('affiliate_owner_user_id', event.target.value)}
              inputMode="numeric"
              disabled={form.affiliate_owner_type !== 'user'}
              className="admin-input mt-1"
            />
          </label>
          <div className="flex items-end gap-2">
            {product.shop_link && (
              <a
                href={product.shop_link}
                target="_blank"
                rel="noopener noreferrer"
                className="admin-icon-btn"
                title="Shop-Link öffnen"
                aria-label="Shop-Link öffnen"
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

export default function AdministratorProductsPage() {
  const [products, setProducts] = useState<AdminCatalogProduct[]>([]);
  const [queryInput, setQueryInput] = useState('');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState<(typeof PAGE_LIMIT_OPTIONS)[number]>(50);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadProducts = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await getAdminProducts({ q: query, page, limit });
      setProducts(response.products);
      setTotal(response.total);
    } catch (err) {
      setProducts([]);
      setTotal(0);
      setError(err instanceof Error ? err.message : 'Produkte konnten nicht geladen werden.');
    } finally {
      setLoading(false);
    }
  }, [limit, page, query]);

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
  }, [queryInput]);

  const handleSaved = useCallback((updated: AdminCatalogProduct) => {
    setProducts((previous) => previous.map((product) => (product.id === updated.id ? updated : product)));
  }, []);

  return (
    <>
      <AdminPageHeader
        title="Produkte"
        subtitle="Produktdaten, Shop-Links und Link-Zuordnung für den Katalog pflegen."
        meta={<AdminBadge tone="info">{total} Treffer</AdminBadge>}
      />

      <div className="mb-4 admin-toolbar">
        <div className="admin-toolbar-inline">
          <label className="flex min-h-[38px] min-w-[280px] flex-1 items-center gap-2 rounded-[var(--admin-r-sm)] border border-[color:var(--admin-line)] bg-[color:var(--admin-bg)] px-3">
            <Search size={16} className="admin-muted" />
            <input
              value={queryInput}
              onChange={(event) => setQueryInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') applyQuery();
              }}
              placeholder="Produkt, Marke, ID oder Link suchen"
              className="min-w-0 flex-1 bg-transparent text-[13px] outline-none"
            />
          </label>
          <AdminButton onClick={applyQuery}>
            <Search size={13} />
            Suche
          </AdminButton>
          <AdminButton onClick={() => void loadProducts()} disabled={loading}>
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

      {error && <AdminError>{error}</AdminError>}

      {loading ? (
        <AdminEmpty>Lade Produkte...</AdminEmpty>
      ) : (
        <AdminCard title="Produktliste" subtitle="Produkte suchen, prüfen und direkt bearbeiten.">
          <div className="space-y-3 p-3">
            {products.map((product) => (
              <ProductRow key={product.id} product={product} onSaved={handleSaved} />
            ))}
            {products.length === 0 && <AdminEmpty>Keine Produkte gefunden.</AdminEmpty>}
          </div>
        </AdminCard>
      )}
    </>
  );
}
