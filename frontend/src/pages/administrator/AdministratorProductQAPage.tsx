import { Fragment, useCallback, useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, ExternalLink, PackageSearch, RefreshCw, Search, Save, Upload } from 'lucide-react';
import { useLocation } from 'react-router-dom';
import { getProductQA, type AdminProductQAProduct, type AdminProductQAPatch, updateProductQA } from '../../api/admin';
import ImageCropModal from '../../components/ImageCropModal';
import { AdminBadge, AdminButton, AdminCard, AdminEmpty, AdminError, AdminPageHeader } from './AdminUi';

const ISSUE_OPTIONS = [
  { value: '', label: 'Alle Hinweise' },
  { value: 'missing_image', label: 'Bild fehlt' },
  { value: 'missing_shop_link', label: 'Shop-Link fehlt' },
  { value: 'missing_serving_data', label: 'Portionsdaten fehlen' },
  { value: 'suspicious_price_zero_or_high', label: 'Preis auff\u00e4llig' },
  { value: 'missing_ingredient_rows', label: 'Wirkstoffzeilen fehlen' },
  { value: 'no_affiliate_flag_on_shop_link', label: 'Link-Zuordnung fehlt' },
] as const;

const PAGE_LIMIT_OPTIONS = [25, 50, 100] as const;

type IssueFilter = '' | (typeof ISSUE_OPTIONS)[number]['value'];
type AffiliateOwnerType = 'none' | 'nick' | 'user';
type LinkHealthStatus = 'unchecked' | 'ok' | 'failed' | 'timeout' | 'invalid';

type AdminProductLinkHealth = {
  status: LinkHealthStatus | null;
  http_status: number | null;
  failure_reason: string | null;
  last_checked_at: string | null;
  last_success_at: string | null;
  consecutive_failures: number | null;
  response_time_ms: number | null;
  final_url: string | null;
  redirected: number | null;
};

function issueLabel(issue: string): string {
  const found = ISSUE_OPTIONS.find((entry) => entry.value === issue);
  if (found) return found.label;
  return issue.replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim();
}

function issueTone(issue: string): 'neutral' | 'warn' | 'danger' | 'info' {
  if (issue === 'suspicious_price_zero_or_high') return 'warn';
  if (issue === 'missing_shop_link' || issue === 'missing_image') return 'danger';
  return 'info';
}

function formatPrice(value: number | null): string {
  if (value === null) return 'kein Preis';
  return new Intl.NumberFormat('de-DE', {
    style: 'currency',
    currency: 'EUR',
  }).format(value);
}

function formatDecimalInput(value: number | null | undefined): string {
  if (value === null || value === undefined) return '';
  return String(value).replace('.', ',');
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat('de-DE', {
    maximumFractionDigits: 6,
  }).format(value);
}

function formatServing(
  servingSize: number | null,
  servingUnit: string | null,
  servingsPerContainer: number | null,
  containerCount: number | null,
): string {
  const size = servingSize === null || servingUnit === null ? null : `${formatNumber(servingSize)} ${servingUnit}`;
  const parts = [
    size,
    servingsPerContainer === null ? null : `${formatNumber(servingsPerContainer)} Portionen`,
    containerCount === null ? null : `${formatNumber(containerCount)} Packung(en)`,
  ].filter(Boolean);
  return parts.length === 0 ? 'Portionsdaten fehlen' : parts.join(' - ');
}

function linkHost(value: string): string {
  try {
    return new URL(value).hostname.replace(/^www\./, '');
  } catch {
    return value.replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0] || value;
  }
}

function textOrNull(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

function numberOrNull(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number(value.trim());
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function normalizeLinkHealthStatus(value: unknown): LinkHealthStatus | null {
  if (value === 'unchecked' || value === 'ok' || value === 'failed' || value === 'timeout' || value === 'invalid') {
    return value;
  }
  return null;
}

function readLinkHealth(raw: Record<string, unknown> | undefined): AdminProductLinkHealth | null {
  const source = raw?.link_health;
  if (!source || typeof source !== 'object') return null;
  const entry = source as Record<string, unknown>;

  return {
    status: normalizeLinkHealthStatus(entry.status),
    http_status: numberOrNull(entry.http_status),
    failure_reason: textOrNull(entry.failure_reason),
    last_checked_at: textOrNull(entry.last_checked_at),
    last_success_at: textOrNull(entry.last_success_at),
    consecutive_failures: numberOrNull(entry.consecutive_failures),
    response_time_ms: numberOrNull(entry.response_time_ms),
    final_url: textOrNull(entry.final_url),
    redirected: numberOrNull(entry.redirected),
  };
}

function linkHealthTone(health: AdminProductLinkHealth | null): 'neutral' | 'ok' | 'warn' | 'danger' | 'info' {
  if (!health || health.status === null || health.status === 'unchecked') return 'neutral';
  if (health.status === 'ok') return 'ok';
  if (health.status === 'timeout') return 'warn';
  return 'danger';
}

function linkHealthLabel(health: AdminProductLinkHealth | null): string {
  if (!health || health.status === null || health.status === 'unchecked') return 'Noch nicht gepr\u00fcft';
  if (health.status === 'ok') return 'Link ok';
  if (health.status === 'timeout') return 'Timeout';
  if (health.status === 'invalid') return 'Ung\u00fcltiger Link';
  return 'Link fehlgeschlagen';
}

function formatDate(value: string | null): string {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return new Intl.DateTimeFormat('de-DE', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
}

function formatResponseTime(value: number | null): string {
  if (value === null) return '-';
  return `${Math.round(value)} ms`;
}

function normalizeOwnerType(type: AdminProductQAProduct['affiliate_owner_type'], isAffiliate: number | null): AffiliateOwnerType {
  if (type === 'nick' || type === 'user') return type;
  if (type === 'none') return 'none';
  return isAffiliate ? 'nick' : 'none';
}

function affiliateOwnerLabel(
  ownerType: AffiliateOwnerType,
  ownerUserId: number | null,
): string {
  if (ownerType === 'user') return ownerUserId === null ? 'Link: Nutzer-ID fehlt' : `Link: Nutzer #${ownerUserId}`;
  if (ownerType === 'nick') return 'Link: Nick';
  return 'kein Partnerlink';
}

interface ProductQAForm {
  price: string;
  shop_link: string;
  affiliate_owner_type: AffiliateOwnerType;
  affiliate_owner_user_id: string;
  serving_size: string;
  serving_unit: string;
  servings_per_container: string;
  container_count: string;
}

function formFromProduct(product: AdminProductQAProduct): ProductQAForm {
  const ownerType = normalizeOwnerType(product.affiliate_owner_type, product.is_affiliate);
  return {
    price: formatDecimalInput(product.price),
    shop_link: product.shop_link ?? '',
    affiliate_owner_type: ownerType,
    affiliate_owner_user_id:
      ownerType === 'user' && product.affiliate_owner_user_id !== null ? String(product.affiliate_owner_user_id) : '',
    serving_size: formatDecimalInput(product.serving_size),
    serving_unit: product.serving_unit ?? '',
    servings_per_container: formatDecimalInput(product.servings_per_container),
    container_count: formatDecimalInput(product.container_count),
  };
}

function parseDecimalInput(value: string, field: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = Number(trimmed.replace(',', '.'));
  if (!Number.isFinite(parsed)) throw new Error(`${field} muss eine Zahl sein.`);
  if (parsed <= 0) throw new Error(`${field} muss gr\u00f6\u00dfer als 0 sein.`);
  return parsed;
}

function parseIntInput(value: string, field: string): number | null {
  const parsed = parseDecimalInput(value, field);
  if (parsed === null) return null;
  if (!Number.isInteger(parsed)) throw new Error(`${field} muss eine ganze Zahl sein.`);
  return parsed;
}

function buildPatch(form: ProductQAForm): AdminProductQAPatch {
  const price = parseDecimalInput(form.price, 'Preis');
  const servingSize = parseDecimalInput(form.serving_size, 'Portionsgr\u00f6\u00dfe');
  const servingsPerContainer = parseIntInput(form.servings_per_container, 'Portionen pro Packung');
  const containerCount = parseIntInput(form.container_count, 'Packungsanzahl');
  const servingUnit = form.serving_unit.trim();

  if (servingSize !== null && !servingUnit) {
    throw new Error('Portionseinheit darf nicht leer sein, wenn eine Portionsgr\u00f6\u00dfe gesetzt ist.');
  }

  const ownerType = form.affiliate_owner_type;
  const ownerUserId =
    ownerType === 'user' ? parseIntInput(form.affiliate_owner_user_id, 'Nutzer-ID') : null;

  if (ownerType === 'user' && ownerUserId === null) {
    throw new Error('Die Nutzer-ID wird ben\u00f6tigt, wenn der Link einem Nutzer geh\u00f6rt.');
  }

  return {
    price,
    shop_link: form.shop_link.trim() || null,
    is_affiliate: ownerType === 'none' ? 0 : 1,
    affiliate_owner_type: ownerType,
    affiliate_owner_user_id: ownerUserId,
    serving_size: servingSize,
    serving_unit: servingUnit || null,
    servings_per_container: servingsPerContainer,
    container_count: containerCount,
  };
}

function ProductQAEditor({
  product,
  onSaved,
}: {
  product: AdminProductQAProduct;
  onSaved: (product: AdminProductQAProduct) => void;
}) {
  const [form, setForm] = useState<ProductQAForm>(() => formFromProduct(product));
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState('');

  useEffect(() => {
    setForm(formFromProduct(product));
    setStatus('');
  }, [product]);

  const updateField = (field: keyof ProductQAForm, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
    setSaving(true);
    setStatus('');
    try {
      const updated = await updateProductQA(product.id, buildPatch(form), { version: product.version });
      onSaved(updated);
      setStatus('Gespeichert.');
    } catch (err) {
      setStatus(err instanceof Error ? err.message : 'Speichern fehlgeschlagen.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="grid gap-3 lg:grid-cols-[150px_minmax(220px,1fr)_170px_150px]">
        <label className="text-xs font-medium text-[color:var(--admin-ink-2)]">
          Preis in Euro
          <input
            value={form.price}
            onChange={(event) => updateField('price', event.target.value)}
            inputMode="decimal"
            placeholder="z. B. 19,99"
            className="admin-input mt-1"
          />
        </label>
        <label className="text-xs font-medium text-[color:var(--admin-ink-2)]">
          Shop-Link
          <input
            value={form.shop_link}
            onChange={(event) => updateField('shop_link', event.target.value)}
            className="admin-input mt-1"
            placeholder="https://..."
          />
        </label>
        <label className="text-xs font-medium text-[color:var(--admin-ink-2)]">
          Link geh&ouml;rt zu
          <select
            value={form.affiliate_owner_type}
            onChange={(event) => updateField('affiliate_owner_type', event.target.value as AffiliateOwnerType)}
            className="admin-select mt-1"
            disabled={saving}
          >
            <option value="none">kein Partnerlink</option>
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
            placeholder="nur bei Nutzer-Link"
            className="admin-input mt-1"
            disabled={form.affiliate_owner_type !== 'user' || saving}
          />
        </label>
      </div>

      <div className="grid gap-3 md:grid-cols-4">
        <label className="text-xs font-medium text-[color:var(--admin-ink-2)]">
          Portionsgr&ouml;&szlig;e
          <input
            value={form.serving_size}
            onChange={(event) => updateField('serving_size', event.target.value)}
            inputMode="decimal"
            placeholder="z. B. 4,5"
            className="admin-input mt-1"
          />
        </label>
        <label className="text-xs font-medium text-[color:var(--admin-ink-2)]">
          Einheit pro Portion
          <input
            value={form.serving_unit}
            onChange={(event) => updateField('serving_unit', event.target.value)}
            placeholder="z. B. g, ml, Kapseln"
            className="admin-input mt-1"
          />
        </label>
        <label className="text-xs font-medium text-[color:var(--admin-ink-2)]">
          Portionen pro Packung
          <input
            value={form.servings_per_container}
            onChange={(event) => updateField('servings_per_container', event.target.value)}
            inputMode="numeric"
            placeholder="z. B. 30"
            className="admin-input mt-1"
          />
        </label>
        <label className="text-xs font-medium text-[color:var(--admin-ink-2)]">
          Anzahl Packungen
          <input
            value={form.container_count}
            onChange={(event) => updateField('container_count', event.target.value)}
            inputMode="numeric"
            placeholder="z. B. 1"
            className="admin-input mt-1"
          />
        </label>
      </div>

      <div className="admin-toolbar-inline items-center justify-between">
        {status && <span className="admin-muted text-[12px]">{status}</span>}
        <AdminButton size="sm" variant="primary" onClick={handleSave} disabled={saving}>
          <Save size={13} />
          {saving ? 'Speichert...' : 'Speichern'}
        </AdminButton>
      </div>
    </div>
  );
}

function ProductQAProductCard({
  product,
  onSaved,
  onUploadImage,
}: {
  product: AdminProductQAProduct;
  onSaved: (product: AdminProductQAProduct) => void;
  onUploadImage: (product: AdminProductQAProduct) => void;
}) {
  const ownerType = normalizeOwnerType(product.affiliate_owner_type, product.is_affiliate);
  const host = product.shop_link ? linkHost(product.shop_link) : null;
  const linkHealth = readLinkHealth(product.raw);

  return (
    <article className="admin-card">
      <div className="admin-card-pad">
        <div className="mb-2 flex flex-wrap items-start gap-2">
          <div>
            <div className="admin-mono text-[13px] text-[color:var(--admin-ink-3)]">#{product.id}</div>
            <div className="admin-card-title">{product.name}</div>
            <div className="admin-muted mt-1 text-xs">
              {product.brand || 'Ohne Marke'} - {formatPrice(product.price)}
            </div>
          </div>
          {product.image_url ? (
            <img
              src={product.image_url}
              alt=""
              className="ml-auto h-14 w-14 rounded-[var(--admin-r-sm)] border border-[color:var(--admin-line)] object-cover"
            />
          ) : (
            <div className="ml-auto flex h-14 w-14 items-center justify-center rounded-[var(--admin-r-sm)] border border-[color:var(--admin-line)] bg-[color:var(--admin-bg-sunk)]">
              <PackageSearch size={18} />
            </div>
          )}
        </div>

        <div className="mb-3">
          <AdminButton size="sm" variant={product.image_url ? 'ghost' : 'primary'} onClick={() => onUploadImage(product)}>
            <Upload size={13} />
            {product.image_url ? 'Bild ersetzen' : 'Bild hochladen'}
          </AdminButton>
        </div>

        <div className="flex flex-wrap gap-1.5">
          {product.issues.map((entry) => (
            <AdminBadge key={entry} tone={issueTone(entry)}>
              {issueLabel(entry)}
            </AdminBadge>
          ))}
        </div>

        <div className="admin-muted mt-3 text-xs">
          <p>{formatServing(product.serving_size, product.serving_unit, product.servings_per_container, product.container_count)}</p>
          <p>{affiliateOwnerLabel(ownerType, product.affiliate_owner_user_id)}</p>
          <p className="admin-mono mt-1">
            {product.ingredient_count} Wirkstoff(e) - {product.main_ingredient_count} Hauptwirkstoff(e)
          </p>
          {product.shop_link && (
            <a
              href={product.shop_link}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 inline-flex items-center gap-1 text-[color:var(--admin-info-ink)]"
            >
              {host}
              <ExternalLink size={12} />
            </a>
          )}
        </div>

        <div className="mt-3 rounded-[var(--admin-r-sm)] border border-[color:var(--admin-line)] bg-[color:var(--admin-bg)] p-2 text-xs">
          <div className="flex flex-wrap items-center gap-2">
            <AdminBadge tone={linkHealthTone(linkHealth)}>{linkHealthLabel(linkHealth)}</AdminBadge>
            {linkHealth?.http_status !== null && linkHealth?.http_status !== undefined ? (
              <span className="admin-mono">HTTP {linkHealth.http_status}</span>
            ) : null}
            {linkHealth?.redirected ? <AdminBadge tone="info">Weiterleitung</AdminBadge> : null}
          </div>
          <div className="admin-muted mt-2 grid gap-1 sm:grid-cols-2">
            <span>Gepr?ft: {formatDate(linkHealth?.last_checked_at ?? null)}</span>
            <span>Antwort: {formatResponseTime(linkHealth?.response_time_ms ?? null)}</span>
          </div>
          {linkHealth?.failure_reason ? <p className="admin-muted mt-1 break-words">{linkHealth.failure_reason}</p> : null}
        </div>

        <div className="mt-4">
          <ProductQAEditor product={product} onSaved={onSaved} />
        </div>
      </div>
    </article>
  );
}

export default function AdministratorProductQAPage() {
  const location = useLocation();
  const [products, setProducts] = useState<AdminProductQAProduct[]>([]);
  const [queryInput, setQueryInput] = useState('');
  const [query, setQuery] = useState('');
  const [issueFilter, setIssueFilter] = useState<IssueFilter>('');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState<(typeof PAGE_LIMIT_OPTIONS)[number]>(50);
  const [total, setTotal] = useState(0);
  const [issueSummary, setIssueSummary] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [imageProduct, setImageProduct] = useState<AdminProductQAProduct | null>(null);

  const applyFilters = useCallback(() => {
    setPage(1);
    setQuery(queryInput);
  }, [queryInput]);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const result = await getProductQA({
        q: query,
        issue: issueFilter || undefined,
        page,
        limit,
      });
      setProducts(result.products);
      setTotal(result.total);
      setIssueSummary(result.summary.issues);
    } catch (err) {
      setProducts([]);
      setTotal(0);
      setIssueSummary({});
      setError(err instanceof Error ? err.message : 'Produktprüfung konnte nicht geladen werden.');
    } finally {
      setLoading(false);
    }
  }, [issueFilter, limit, page, query]);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const urlQuery = params.get('q') ?? '';
    const urlIssue = params.get('issue') ?? '';
    setQueryInput(urlQuery);
    setQuery(urlQuery);
    setPage(1);
    if (ISSUE_OPTIONS.some((entry) => entry.value === urlIssue)) {
      setIssueFilter(urlIssue as IssueFilter);
    } else {
      setIssueFilter('');
    }
  }, [location.search]);

  useEffect(() => {
    void load();
  }, [load]);

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

  const issueCounts = useMemo(() => {
    return ISSUE_OPTIONS.slice(1)
      .map((entry) => [entry.value, issueSummary[entry.value] ?? 0] as const)
      .filter(([, count]) => count > 0);
  }, [issueSummary]);

  const handleSaved = useCallback((updated: AdminProductQAProduct) => {
    setProducts((previous) => previous.map((item) => (item.id === updated.id ? updated : item)));
    void load();
  }, [load]);

  const handleImageUploadSuccess = useCallback(() => {
    setImageProduct(null);
    void load();
  }, [load]);

  return (
    <>
      <AdminPageHeader
        title="Produktprüfung"
        subtitle="Fehlende Bilder, Links und Packungsdaten korrigieren."
        meta={<AdminBadge tone="info">{total} Treffer</AdminBadge>}
      />

      <div className="admin-toolbar">
        <div className="admin-toolbar-inline">
          <div className="relative flex-1 min-w-[220px]">
            <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[color:var(--admin-ink-3)]" />
            <input
              value={queryInput}
              onChange={(event) => setQueryInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') applyFilters();
              }}
              placeholder="Produkt oder Marke suchen"
              className="admin-input pl-9"
            />
          </div>
          <select
            value={issueFilter}
            onChange={(event) => {
              setPage(1);
              setIssueFilter(event.target.value as IssueFilter);
            }}
            className="admin-select min-w-[220px]"
          >
            {ISSUE_OPTIONS.map((entry) => (
              <option key={entry.value || 'all'} value={entry.value}>
                {entry.label}
              </option>
            ))}
          </select>
          <AdminButton onClick={applyFilters}>
            <Search size={13} />
            Suche
          </AdminButton>
          <AdminButton onClick={() => void load()} disabled={loading}>
            <RefreshCw size={13} />
            Aktualisieren
          </AdminButton>
        </div>

        {issueCounts.length > 0 && (
          <div className="admin-toolbar-inline">
            <AdminButton
              variant={issueFilter === '' ? 'primary' : 'default'}
              onClick={() => {
                setPage(1);
                setIssueFilter('');
              }}
            >
              Alle
            </AdminButton>
            {issueCounts.map(([issue, count]) => (
              <AdminButton
                key={issue}
                variant={issueFilter === issue ? 'primary' : 'default'}
                onClick={() => {
                  setPage(1);
                  setIssueFilter(issue as IssueFilter);
                }}
              >
                {issueLabel(issue)} ({count})
              </AdminButton>
            ))}
          </div>
        )}

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

      {loading && <AdminEmpty>Lade Produktprüfung...</AdminEmpty>}
      {!loading && products.length === 0 && (
        <AdminEmpty>{query || issueFilter ? 'Keine Treffer mit den Filtern.' : 'Aktuell keine offenen Produktprüfungen.'}</AdminEmpty>
      )}

      {!loading && products.length > 0 && (
        <>
          <div className="grid gap-3 md:hidden">
            {products.map((product) => (
              <ProductQAProductCard key={product.id} product={product} onSaved={handleSaved} onUploadImage={setImageProduct} />
            ))}
          </div>

          <AdminCard padded className="hidden md:block">
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Produkt</th>
                    <th>Hinweise</th>
                    <th>Wirkstoff-Kontext</th>
                    <th>Bearbeiten</th>
                  </tr>
                </thead>
                <tbody>
                  {products.map((product) => {
                    const ownerType = normalizeOwnerType(product.affiliate_owner_type, product.is_affiliate);
                    const linkHealth = readLinkHealth(product.raw);
                    return (
                      <Fragment key={product.id}>
                        <tr>
                          <td className="min-w-[300px]">
                            <div className="flex items-start gap-3">
                              {product.image_url ? (
                                <img
                                  src={product.image_url}
                                  alt=""
                                  className="h-12 w-12 shrink-0 rounded-[var(--admin-r-sm)] border border-[color:var(--admin-line)] object-cover"
                                />
                              ) : (
                                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[var(--admin-r-sm)] border border-[color:var(--admin-line)] bg-[color:var(--admin-bg-sunk)]">
                                  <PackageSearch size={16} />
                                </div>
                              )}
                              <div className="min-w-0">
                                <div className="font-medium" style={{ fontFamily: 'var(--admin-serif)' }}>
                                  {product.name}
                                </div>
                                <div className="admin-muted mt-1 text-xs">
                                  #{product.id} - {product.brand || 'Ohne Marke'} - {formatPrice(product.price)}
                                </div>
                                <AdminButton size="sm" variant={product.image_url ? 'ghost' : 'primary'} onClick={() => setImageProduct(product)} className="mt-2">
                                  <Upload size={13} />
                                  {product.image_url ? 'Bild ersetzen' : 'Bild hochladen'}
                                </AdminButton>
                              </div>
                            </div>
                            <div className="admin-muted mt-1 text-xs">
                              {product.shop_link ? (
                                <a href={product.shop_link} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1">
                                  <span>{linkHost(product.shop_link)}</span>
                                  <ExternalLink size={12} />
                                </a>
                              ) : (
                                <span>kein Link</span>
                              )}
                            </div>
                            <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[11px]">
                              <AdminBadge tone={linkHealthTone(linkHealth)}>{linkHealthLabel(linkHealth)}</AdminBadge>
                              {linkHealth?.http_status !== null && linkHealth?.http_status !== undefined ? (
                                <span className="admin-mono">HTTP {linkHealth.http_status}</span>
                              ) : null}
                              {linkHealth?.response_time_ms !== null && linkHealth?.response_time_ms !== undefined ? (
                                <span className="admin-muted">{formatResponseTime(linkHealth.response_time_ms)}</span>
                              ) : null}
                              {linkHealth?.redirected ? <AdminBadge tone="info">Weiterleitung</AdminBadge> : null}
                            </div>
                            <div className="admin-muted mt-1 text-[11px]">
                              Gepr?ft: {formatDate(linkHealth?.last_checked_at ?? null)}
                              {linkHealth?.failure_reason ? ` - ${linkHealth.failure_reason}` : ''}
                            </div>
                          </td>
                          <td>
                            <div className="flex flex-wrap gap-1.5">
                              {product.issues.map((entry) => (
                                <AdminBadge key={entry} tone={issueTone(entry)}>
                                  {issueLabel(entry)}
                                </AdminBadge>
                              ))}
                            </div>
                          </td>
                          <td className="min-w-[220px]">
                            <div className="text-xs">
                              {product.ingredient_count} Wirkstoff(e) / {product.main_ingredient_count} Hauptwirkstoff(e)
                            </div>
                            <div className="admin-muted mt-1 text-[11px]">
                              {formatServing(
                                product.serving_size,
                                product.serving_unit,
                                product.servings_per_container,
                                product.container_count,
                              )}
                            </div>
                            <div className="admin-muted mt-1 text-[11px]">
                              {affiliateOwnerLabel(ownerType, product.affiliate_owner_user_id)}
                            </div>
                          </td>
                          <td className="min-w-[340px]">
                            <ProductQAEditor product={product} onSaved={handleSaved} />
                          </td>
                        </tr>
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </AdminCard>

          <div className="admin-toolbar mt-3">
            <div className="admin-toolbar-inline justify-end">
              <span className="admin-muted text-sm">
                Seite {page} / {totalPages}
              </span>
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
        </>
      )}

      {imageProduct ? (
        <ImageCropModal
          productId={imageProduct.id}
          uploadEndpoint={`/api/admin/products/${imageProduct.id}/image`}
          uploadVersion={imageProduct.version ?? null}
          currentImageUrl={imageProduct.image_url ?? undefined}
          onSuccess={handleImageUploadSuccess}
          onError={(message) => setError(message)}
          onClose={() => setImageProduct(null)}
        />
      ) : null}
    </>
  );
}
