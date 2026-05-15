import { FormEvent, useEffect, useState } from 'react';
import { ArrowLeft, Plus, Save } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import {
  createAdminProduct,
  getAdminManagedListItems,
  type AdminManagedListItem,
  type AdminProductCreatePayload,
} from '../../api/admin';
import { AdminBadge, AdminButton, AdminCard, AdminError, AdminPageHeader } from './AdminUi';

type ProductModerationStatus = NonNullable<AdminProductCreatePayload['moderation_status']>;
type ProductVisibility = NonNullable<AdminProductCreatePayload['visibility']>;

type ProductCreateForm = {
  name: string;
  brand: string;
  form: string;
  price: string;
  shop_link: string;
  is_affiliate: boolean;
  moderation_status: ProductModerationStatus;
  visibility: ProductVisibility;
  serving_size: string;
  serving_unit: string;
  servings_per_container: string;
  container_count: string;
};

type ServingUnitOption = {
  value: string;
  label: string;
};

const FALLBACK_SERVING_UNIT_OPTIONS: ServingUnitOption[] = [
  { value: 'Kapsel', label: 'Kapsel' },
  { value: 'Tablette', label: 'Tablette' },
  { value: 'Portion', label: 'Portion' },
  { value: 'g', label: 'g' },
  { value: 'ml', label: 'ml' },
  { value: 'Tropfen', label: 'Tropfen' },
];

const INITIAL_FORM: ProductCreateForm = {
  name: '',
  brand: '',
  form: '',
  price: '',
  shop_link: '',
  is_affiliate: true,
  moderation_status: 'pending',
  visibility: 'hidden',
  serving_size: '',
  serving_unit: '',
  servings_per_container: '',
  container_count: '',
};

function servingUnitOptionsFromItems(items: AdminManagedListItem[]): ServingUnitOption[] {
  return items
    .filter((item) => item.active !== 0 && item.value.trim().length > 0)
    .map((item) => ({
      value: item.value,
      label: item.label.trim().length > 0 ? item.label : item.value,
    }));
}

function trimmedOrNull(value: string): string | null {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function numberFromText(value: string): number | null {
  const trimmed = value.trim().replace(',', '.');
  if (!trimmed) return null;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
}

function priceText(value: number): string {
  return value.toFixed(2).replace('.', ',');
}

function normalizePriceDraft(value: string): string {
  const parsed = numberFromText(value);
  return parsed !== null && parsed > 0 ? priceText(Math.round(parsed * 100) / 100) : value;
}

function optionalPositiveNumber(value: string, label: string): number | null {
  const parsed = numberFromText(value);
  if (parsed === null) return null;
  if (parsed <= 0) throw new Error(`${label} muss größer als 0 sein.`);
  return parsed;
}

function optionalPositiveInteger(value: string, label: string): number | null {
  const parsed = optionalPositiveNumber(value, label);
  if (parsed === null) return null;
  if (!Number.isInteger(parsed)) throw new Error(`${label} muss eine ganze Zahl sein.`);
  return parsed;
}

function payloadFromForm(form: ProductCreateForm): AdminProductCreatePayload {
  const name = form.name.trim();
  if (!name) throw new Error('Produktname ist erforderlich.');

  const price = numberFromText(form.price);
  if (price === null || price <= 0) throw new Error('Preis muss größer als 0 sein.');

  const shopLink = trimmedOrNull(form.shop_link);
  const isAffiliate = Boolean(shopLink && form.is_affiliate);

  return {
    name,
    brand: trimmedOrNull(form.brand),
    form: trimmedOrNull(form.form),
    price,
    shop_link: shopLink,
    is_affiliate: isAffiliate ? 1 : 0,
    affiliate_owner_type: isAffiliate ? 'nick' : 'none',
    affiliate_owner_user_id: null,
    moderation_status: form.moderation_status,
    visibility: form.visibility,
    serving_size: optionalPositiveNumber(form.serving_size, 'Portionsgröße'),
    serving_unit: trimmedOrNull(form.serving_unit),
    servings_per_container: optionalPositiveInteger(form.servings_per_container, 'Portionen pro Packung'),
    container_count: optionalPositiveInteger(form.container_count, 'Packungsanzahl'),
  };
}

function errorMessage(error: unknown): string {
  const response = (error as { response?: { data?: unknown } } | null)?.response;
  const data = response?.data && typeof response.data === 'object'
    ? response.data as Record<string, unknown>
    : null;
  if (typeof data?.error === 'string') return data.error;
  if (error instanceof Error) return error.message;
  return 'Produkt konnte nicht angelegt werden.';
}

export default function AdministratorProductCreatePage() {
  const navigate = useNavigate();
  const [form, setForm] = useState<ProductCreateForm>(INITIAL_FORM);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [servingUnitOptions, setServingUnitOptions] = useState<ServingUnitOption[]>(FALLBACK_SERVING_UNIT_OPTIONS);
  const [servingUnitSource, setServingUnitSource] = useState<'loading' | 'managed' | 'fallback'>('loading');

  useEffect(() => {
    let cancelled = false;

    async function loadServingUnits() {
      setServingUnitSource('loading');
      try {
        const response = await getAdminManagedListItems('serving_unit');
        const managedOptions = servingUnitOptionsFromItems(response.items);
        if (cancelled) return;
        setServingUnitOptions(managedOptions.length > 0 ? managedOptions : FALLBACK_SERVING_UNIT_OPTIONS);
        setServingUnitSource(managedOptions.length > 0 ? 'managed' : 'fallback');
      } catch {
        if (cancelled) return;
        setServingUnitOptions(FALLBACK_SERVING_UNIT_OPTIONS);
        setServingUnitSource('fallback');
      }
    }

    void loadServingUnits();

    return () => {
      cancelled = true;
    };
  }, []);

  const updateField = <K extends keyof ProductCreateForm>(field: K, value: ProductCreateForm[K]) => {
    setForm((previous) => ({ ...previous, [field]: value }));
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    setError('');
    try {
      const product = await createAdminProduct(payloadFromForm(form));
      navigate(`/administrator/products/${product.id}`);
    } catch (submitError) {
      setError(errorMessage(submitError));
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <AdminPageHeader
        title="Produkt anlegen"
        subtitle="Neues Katalogprodukt für Verwaltung, Linkpflege und Wirkstoffzuordnung vorbereiten"
        meta={<AdminBadge tone="info">Neu</AdminBadge>}
      />

      <AdminCard
        title="Basisdaten"
        actions={(
          <Link to="/administrator/products" className="admin-btn admin-btn-sm">
            <ArrowLeft size={13} />
            Zurück
          </Link>
        )}
        padded
      >
        <form onSubmit={handleSubmit} className="grid gap-4">
          {error && <AdminError>{error}</AdminError>}

          <div className="grid gap-3 md:grid-cols-2">
            <label className="grid gap-1 text-sm font-medium">
              Produktname
              <input
                className="admin-input"
                value={form.name}
                onChange={(event) => updateField('name', event.target.value)}
                maxLength={240}
                required
              />
            </label>
            <label className="grid gap-1 text-sm font-medium">
              Hersteller
              <input
                className="admin-input"
                value={form.brand}
                onChange={(event) => updateField('brand', event.target.value)}
                maxLength={240}
              />
            </label>
            <label className="grid gap-1 text-sm font-medium">
              Darreichungsform
              <input
                className="admin-input"
                value={form.form}
                onChange={(event) => updateField('form', event.target.value)}
                maxLength={120}
                placeholder="Kapseln, Pulver, Tropfen"
              />
            </label>
            <label className="grid gap-1 text-sm font-medium">
              Preis pro Packung
              <input
                className="admin-input"
                value={form.price}
                onChange={(event) => updateField('price', event.target.value)}
                onBlur={() => updateField('price', normalizePriceDraft(form.price))}
                inputMode="decimal"
                placeholder="19,99"
                required
              />
            </label>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <label className="grid gap-1 text-sm font-medium md:col-span-2">
              Hauptlink
              <input
                className="admin-input admin-url-input"
                value={form.shop_link}
                onChange={(event) => updateField('shop_link', event.target.value)}
                placeholder="https://..."
              />
            </label>
            <label className={form.shop_link.trim() && form.is_affiliate ? 'admin-toggle-card admin-toggle-card-ok' : 'admin-toggle-card'}>
              <input
                type="checkbox"
                checked={form.is_affiliate}
                onChange={(event) => updateField('is_affiliate', event.target.checked)}
              />
              Partnerlink für Nick
            </label>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <label className="grid gap-1 text-sm font-medium">
              Freigabe
              <select
                className="admin-select"
                value={form.moderation_status}
                onChange={(event) => updateField('moderation_status', event.target.value as ProductModerationStatus)}
              >
                <option value="pending">Nicht freigegeben</option>
                <option value="approved">Freigegeben</option>
                <option value="blocked">Gesperrt</option>
                <option value="rejected">Abgelehnt</option>
              </select>
            </label>
            <label className="grid gap-1 text-sm font-medium">
              Sichtbarkeit
              <select
                className="admin-select"
                value={form.visibility}
                onChange={(event) => updateField('visibility', event.target.value as ProductVisibility)}
              >
                <option value="hidden">Versteckt</option>
                <option value="public">Öffentlich</option>
              </select>
            </label>
          </div>

          <div className="grid gap-3 md:grid-cols-4">
            <label className="grid gap-1 text-sm font-medium">
              Portionsgröße
              <input
                className="admin-input"
                value={form.serving_size}
                onChange={(event) => updateField('serving_size', event.target.value)}
                inputMode="decimal"
              />
            </label>
            <label className="grid gap-1 text-sm font-medium">
              Einheit
              <select
                className="admin-select"
                value={form.serving_unit}
                onChange={(event) => updateField('serving_unit', event.target.value)}
              >
                <option value="">{servingUnitSource === 'loading' ? 'Einheiten werden geladen...' : 'Keine Einheit'}</option>
                {servingUnitOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              {servingUnitSource === 'fallback' ? (
                <span className="admin-muted text-xs">Standardauswahl aktiv, zentrale Einheiten konnten nicht geladen werden.</span>
              ) : null}
            </label>
            <label className="grid gap-1 text-sm font-medium">
              Portionen
              <input
                className="admin-input"
                value={form.servings_per_container}
                onChange={(event) => updateField('servings_per_container', event.target.value)}
                inputMode="numeric"
              />
            </label>
            <label className="grid gap-1 text-sm font-medium">
              Packungen
              <input
                className="admin-input"
                value={form.container_count}
                onChange={(event) => updateField('container_count', event.target.value)}
                inputMode="numeric"
              />
            </label>
          </div>

          <div className="flex flex-wrap justify-end gap-2">
            <Link to="/administrator/products" className="admin-btn">
              Abbrechen
            </Link>
            <AdminButton type="submit" variant="primary" disabled={saving}>
              {saving ? <Plus size={13} /> : <Save size={13} />}
              {saving ? 'Lege an...' : 'Produkt anlegen'}
            </AdminButton>
          </div>
        </form>
      </AdminCard>
    </>
  );
}
