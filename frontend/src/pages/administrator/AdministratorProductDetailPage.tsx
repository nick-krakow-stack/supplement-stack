import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Edit3, ExternalLink, Loader2, Plus, RefreshCw, Save, Trash2, Upload, X } from 'lucide-react';
import {
  createAdminProductIngredient,
  createAdminProductShopLink,
  createAdminProductWarning,
  deleteAdminProductIngredient,
  deleteAdminProductShopLink,
  deleteAdminProductWarning,
  getAdminProduct,
  getAdminProductShopLinks,
  getAllIngredients,
  recheckAdminProductShopLink,
  searchIngredients,
  updateAdminProductIngredient,
  updateAdminProductShopLink,
  updateAdminProductWarning,
  updateProductQA,
  type AdminCatalogProduct,
  type AdminProductDetail,
  type AdminProductIngredient,
  type AdminProductIngredientPayload,
  type AdminProductShopLink,
  type AdminProductShopLinkPayload,
  type AdminProductWarning,
  type AdminProductWarningPayload,
  type AdminProductWarningSeverity,
  type AdminProductQAPatch,
  type AdminProductSafetyWarning,
  type IngredientLookup,
} from '../../api/admin';
import ImageCropModal from '../../components/ImageCropModal';
import { AdminBadge, AdminButton, AdminCard, AdminEmpty, AdminError, AdminPageHeader, type AdminTone } from './AdminUi';

type TabName = 'overview' | 'wirkstoffe' | 'moderation' | 'affiliate' | 'warnungen';

type AffiliateOwnerType = 'none' | 'nick' | 'user';
type ProductModerationStatus = 'pending' | 'approved' | 'rejected' | 'blocked';
type ProductVisibility = 'hidden' | 'public';

type ProductEditForm = {
  name: string;
  brand: string;
  image_url: string;
  price: string;
  serving_size: string;
  serving_unit: string;
  servings_per_container: string;
  container_count: string;
  moderation_status: ProductModerationStatus;
  visibility: ProductVisibility;
  shop_link: string;
  affiliate_owner_type: AffiliateOwnerType;
  affiliate_owner_user_id: string;
};

type ShopLinkForm = {
  shop_name: string;
  url: string;
  affiliate_owner_type: AffiliateOwnerType;
  affiliate_owner_user_id: string;
  is_primary: boolean;
  active: boolean;
  sort_order: string;
};

type WarningItem = {
  label: string;
  tone: 'neutral' | 'info' | 'warn' | 'danger';
};

type ProductWarningForm = {
  severity: AdminProductWarningSeverity;
  title: string;
  message: string;
  alternative_note: string;
  active: boolean;
};

type ProductIngredientForm = {
  ingredient_id: string;
  quantity: string;
  unit: string;
  basis_quantity: string;
  basis_unit: string;
  form_id: string;
  parent_ingredient_id: string;
  is_main: boolean;
  search_relevant: boolean;
};

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

const TAB_OPTIONS: { key: TabName; label: string }[] = [
  { key: 'overview', label: 'Übersicht' },
  { key: 'wirkstoffe', label: 'Wirkstoffe' },
  { key: 'moderation', label: 'Freigabe' },
  { key: 'affiliate', label: 'Shop-Link' },
  { key: 'warnungen', label: 'Warnungen' },
];

function getTabFromSection(section: string | null): TabName {
  return TAB_OPTIONS.find((tab) => tab.key === section)?.key ?? 'overview';
}

function getErrorMessage(error: unknown): string {
  const response = (error as { response?: { status?: number; data?: unknown } } | null)?.response;
  const data = response?.data && typeof response.data === 'object' ? response.data as Record<string, unknown> : null;
  const apiError = typeof data?.error === 'string' ? data.error : null;
  if (response?.status === 409) {
    const currentVersion = data?.current_version === null || data?.current_version === undefined
      ? null
      : String(data.current_version);
    return currentVersion
      ? `Konflikt: Das Produkt wurde zwischenzeitlich geändert. Aktuelle Version: ${currentVersion}. Bitte aktualisieren und erneut speichern.`
      : 'Konflikt: Das Produkt wurde zwischenzeitlich geändert. Bitte aktualisieren und erneut speichern.';
  }
  if (apiError) return apiError;
  if (error instanceof Error) return error.message;
  return 'Die Anfrage ist fehlgeschlagen.';
}

function ownerTypeFromProduct(product: AdminCatalogProduct): AffiliateOwnerType {
  return product.affiliate_owner_type ?? (product.is_affiliate ? 'nick' : 'none');
}

function emptyProductEditForm(): ProductEditForm {
  return {
    name: '',
    brand: '',
    image_url: '',
    price: '',
    serving_size: '',
    serving_unit: '',
    servings_per_container: '',
    container_count: '',
    moderation_status: 'pending',
    visibility: 'hidden',
    shop_link: '',
    affiliate_owner_type: 'none',
    affiliate_owner_user_id: '',
  };
}

function emptyShopLinkForm(): ShopLinkForm {
  return {
    shop_name: '',
    url: '',
    affiliate_owner_type: 'none',
    affiliate_owner_user_id: '',
    is_primary: false,
    active: true,
    sort_order: '0',
  };
}

function shopLinkFormFromLink(link: AdminProductShopLink): ShopLinkForm {
  return {
    shop_name: link.shop_name ?? '',
    url: link.url,
    affiliate_owner_type: link.affiliate_owner_type,
    affiliate_owner_user_id: link.affiliate_owner_type === 'user' && link.affiliate_owner_user_id !== null
      ? String(link.affiliate_owner_user_id)
      : '',
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

  let ownerUserId: number | null = null;
  if (form.affiliate_owner_type === 'user') {
    const parsedUserId = Number(form.affiliate_owner_user_id.trim());
    if (!Number.isInteger(parsedUserId) || parsedUserId <= 0) {
      throw new Error('Nutzer-ID muss eine positive ganze Zahl sein.');
    }
    ownerUserId = parsedUserId;
  }

  return {
    shop_name: textValue(form.shop_name),
    url,
    affiliate_owner_type: form.affiliate_owner_type,
    affiliate_owner_user_id: ownerUserId,
    is_affiliate: form.affiliate_owner_type === 'none' ? 0 : 1,
    is_primary: form.is_primary ? 1 : 0,
    active: form.active ? 1 : 0,
    sort_order: parsedSortOrder,
  };
}

function shopLinkOwnerLabel(link: AdminProductShopLink): string {
  if (link.affiliate_owner_type === 'nick') return 'Nick';
  if (link.affiliate_owner_type === 'user') {
    return link.affiliate_owner_user_id ? `Nutzer #${link.affiliate_owner_user_id}` : 'Nutzer-ID fehlt';
  }
  return 'Kein Partnerlink';
}

function shopLinkOwnerTone(link: AdminProductShopLink): AdminTone {
  if (link.affiliate_owner_type === 'nick') return 'ok';
  if (link.affiliate_owner_type === 'user') return link.affiliate_owner_user_id ? 'info' : 'warn';
  return 'neutral';
}

function formFromProduct(product: AdminCatalogProduct): ProductEditForm {
  const ownerType = ownerTypeFromProduct(product);
  return {
    name: product.name,
    brand: product.brand ?? '',
    image_url: product.image_url ?? '',
    price: numberText(product.price),
    serving_size: numberText(product.serving_size),
    serving_unit: product.serving_unit ?? '',
    servings_per_container:
      product.servings_per_container === null || product.servings_per_container === undefined
        ? ''
        : numberText(product.servings_per_container),
    container_count:
      product.container_count === null || product.container_count === undefined ? '' : numberText(product.container_count),
    moderation_status:
      product.moderation_status === 'approved' || product.moderation_status === 'rejected' || product.moderation_status === 'blocked'
        ? product.moderation_status
        : 'pending',
    visibility: product.visibility === 'public' ? 'public' : 'hidden',
    shop_link: product.shop_link ?? '',
    affiliate_owner_type: ownerType,
    affiliate_owner_user_id:
      ownerType === 'user' && product.affiliate_owner_user_id !== null
        ? String(product.affiliate_owner_user_id)
        : '',
  };
}

function ownerLabel(product: AdminCatalogProduct): string {
  const ownerType = ownerTypeFromProduct(product);
  if (ownerType === 'nick') return 'Nick';
  if (ownerType === 'user') {
    return product.affiliate_owner_user_id !== null
      ? `Nutzer #${product.affiliate_owner_user_id}`
      : 'Nutzer-ID fehlt';
  }
  return 'kein Partnerlink';
}

function ownerTone(product: AdminCatalogProduct): AdminTone {
  const ownerType = ownerTypeFromProduct(product);
  if (ownerType === 'nick') return 'ok';
  if (ownerType === 'user') return product.affiliate_owner_user_id ? 'info' : 'warn';
  return 'neutral';
}

function moderationTone(value: string | null): AdminTone {
  if (!value || value === 'approved') return 'ok';
  if (value === 'pending') return 'warn';
  if (value === 'rejected') return 'danger';
  if (value === 'blocked') return 'danger';
  return 'neutral';
}

function visibilityTone(value: string | null): AdminTone {
  if (!value || value === 'public') return 'ok';
  if (value === 'private') return 'warn';
  return 'neutral';
}

function moderationStatusLabel(value?: string | null): string {
  if (value === 'pending') return 'wartet auf Prüfung';
  if (value === 'approved') return 'freigegeben';
  if (value === 'rejected') return 'abgelehnt';
  if (value === 'blocked') return 'gesperrt';
  return 'unbekannt';
}

function visibilityLabel(value?: string | null): string {
  if (value === 'public') return 'sichtbar';
  if (value === 'hidden') return 'ausgeblendet';
  if (value === 'private') return 'privat';
  return 'unbekannt';
}

function toInt(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return Math.trunc(value);
  if (typeof value === 'string') {
    const parsed = Number(value.trim());
    return Number.isFinite(parsed) ? Math.trunc(parsed) : null;
  }
  return null;
}

function toBooleanFromRaw(value: unknown): boolean | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (['1', 'true', 'yes', 'ja', 'on'].includes(normalized)) return true;
    if (['0', 'false', 'no', 'nein', 'off'].includes(normalized)) return false;
  }
  return null;
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

function numberText(value: number | null | undefined): string {
  return value === null || value === undefined ? '' : String(value).replace('.', ',');
}

function textValue(value: string): string | null {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function changedText(next: string, previous: string | null | undefined): boolean {
  return (textValue(next) ?? '') !== (previous ?? '');
}

function changedNumber(next: string, previous: number | null | undefined): boolean {
  const trimmed = next.trim();
  if (!trimmed && (previous === null || previous === undefined)) return false;
  if (!trimmed) return previous !== null && previous !== undefined;
  const parsed = Number(trimmed.replace(',', '.'));
  if (!Number.isFinite(parsed)) return true;
  return previous === null || previous === undefined ? true : parsed !== previous;
}

function parseRequiredNumber(value: string, label: string, integer = false): number {
  const trimmed = value.trim();
  if (!trimmed) throw new Error(`${label} ist erforderlich, wenn das Feld gespeichert wird.`);
  const parsed = Number(trimmed.replace(',', '.'));
  if (!Number.isFinite(parsed) || parsed <= 0) throw new Error(`${label} muss eine positive Zahl sein.`);
  if (integer && !Number.isInteger(parsed)) throw new Error(`${label} muss eine ganze Zahl sein.`);
  return parsed;
}

function linkHost(value: string): string {
  try {
    return new URL(value).hostname.replace(/^www\./, '');
  } catch {
    return value.replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0] || value;
  }
}

function normalizeLinkHealthStatus(value: unknown): LinkHealthStatus | null {
  if (value === 'unchecked' || value === 'ok' || value === 'failed' || value === 'timeout' || value === 'invalid') {
    return value;
  }
  return null;
}

function readLinkHealth(raw: Record<string, unknown> | undefined): AdminProductLinkHealth | null {
  const productRaw = raw?.product && typeof raw.product === 'object' ? raw.product as Record<string, unknown> : null;
  const source = raw?.link_health ?? productRaw?.link_health;
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

function linkHealthTone(health: AdminProductLinkHealth | null): AdminTone {
  if (!health || health.status === null || health.status === 'unchecked') return 'neutral';
  if (health.status === 'ok') return 'ok';
  if (health.status === 'timeout') return 'warn';
  return 'danger';
}

function linkHealthLabel(health: AdminProductLinkHealth | null): string {
  if (!health || health.status === null || health.status === 'unchecked') return 'Link: Noch nicht geprüft';
  if (health.status === 'ok') return 'Link: OK';
  return 'Link: Defekt';
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

function formatAmount(row: AdminProductIngredient): string {
  const amount = row.quantity === null ? '-' : `${numberText(row.quantity)} ${row.unit ?? ''}`.trim();
  if (row.basis_quantity === null || !row.basis_unit) return amount;
  return `${amount} pro ${numberText(row.basis_quantity)} ${row.basis_unit}`;
}

function ingredientRole(row: AdminProductIngredient): string {
  if (row.is_main === 1) return 'Hauptwirkstoff';
  if (row.search_relevant === 0) return 'Zusatzstoff';
  return 'Wirkstoff';
}

function issueLabel(issue: string): string {
  const labels: Record<string, string> = {
    missing_image: 'Bild fehlt',
    missing_shop_link: 'Shop-Link fehlt',
    missing_serving_data: 'Portionsdaten fehlen',
    suspicious_price_zero_or_high: 'Preis auffällig',
    missing_ingredient_rows: 'Wirkstoffe fehlen',
    no_affiliate_flag_on_shop_link: 'Link-Zuordnung fehlt',
  };
  return labels[issue] ?? issue;
}

function safetyWarningTone(warning: AdminProductSafetyWarning): AdminTone {
  if (warning.severity === 'danger') return 'danger';
  if (warning.severity === 'info') return 'info';
  return 'warn';
}

function productWarningTone(warning: Pick<AdminProductWarning, 'severity' | 'active'>): AdminTone {
  if (warning.active === 0) return 'neutral';
  if (warning.severity === 'danger') return 'danger';
  if (warning.severity === 'info') return 'info';
  return 'warn';
}

function productWarningSeverityLabel(value?: string | null): string {
  if (value === 'info') return 'Hinweis';
  if (value === 'caution') return 'Mit Vorsicht';
  if (value === 'warning') return 'Warnung';
  if (value === 'danger') return 'Kritisch';
  return 'Warnung';
}

function emptyProductWarningForm(): ProductWarningForm {
  return {
    severity: 'warning',
    title: '',
    message: '',
    alternative_note: '',
    active: true,
  };
}

function formFromProductWarning(warning: AdminProductWarning): ProductWarningForm {
  return {
    severity: warning.severity,
    title: warning.title,
    message: warning.message,
    alternative_note: warning.alternative_note ?? '',
    active: warning.active !== 0,
  };
}

function payloadFromProductWarningForm(form: ProductWarningForm): AdminProductWarningPayload {
  return {
    severity: form.severity,
    title: form.title.trim(),
    message: form.message.trim(),
    alternative_note: form.alternative_note.trim() || null,
    active: form.active ? 1 : 0,
  };
}

function emptyProductIngredientForm(): ProductIngredientForm {
  return {
    ingredient_id: '',
    quantity: '',
    unit: '',
    basis_quantity: '',
    basis_unit: '',
    form_id: '',
    parent_ingredient_id: '',
    is_main: false,
    search_relevant: true,
  };
}

function formFromProductIngredient(row: AdminProductIngredient): ProductIngredientForm {
  return {
    ingredient_id: String(row.ingredient_id),
    quantity: numberText(row.quantity),
    unit: row.unit ?? '',
    basis_quantity: numberText(row.basis_quantity),
    basis_unit: row.basis_unit ?? '',
    form_id: row.form_id === null ? '' : String(row.form_id),
    parent_ingredient_id: row.parent_ingredient_id === null ? '' : String(row.parent_ingredient_id),
    is_main: row.is_main === 1,
    search_relevant: row.search_relevant !== 0,
  };
}

function parsePositiveIntegerText(value: string, label: string): number {
  const parsed = Number(value.trim());
  if (!Number.isInteger(parsed) || parsed <= 0) throw new Error(`${label} muss eine positive ganze Zahl sein.`);
  return parsed;
}

function parseOptionalPositiveIntegerText(value: string, label: string): number | null {
  const trimmed = value.trim();
  return trimmed ? parsePositiveIntegerText(trimmed, label) : null;
}

function parseOptionalNumberText(value: string, label: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = Number(trimmed.replace(',', '.'));
  if (!Number.isFinite(parsed) || parsed < 0) throw new Error(`${label} muss eine Zahl größer oder gleich 0 sein.`);
  return parsed;
}

function payloadFromProductIngredientForm(form: ProductIngredientForm): AdminProductIngredientPayload {
  return {
    ingredient_id: parsePositiveIntegerText(form.ingredient_id, 'Wirkstoff'),
    quantity: parseOptionalNumberText(form.quantity, 'Menge'),
    unit: textValue(form.unit),
    basis_quantity: parseOptionalNumberText(form.basis_quantity, 'Basis-Menge'),
    basis_unit: textValue(form.basis_unit),
    form_id: parseOptionalPositiveIntegerText(form.form_id, 'Form-ID'),
    parent_ingredient_id: parseOptionalPositiveIntegerText(form.parent_ingredient_id, 'Übergeordneter Wirkstoff'),
    is_main: form.is_main ? 1 : 0,
    search_relevant: form.search_relevant ? 1 : 0,
  };
}

function mergeIngredientOptions(
  existing: IngredientLookup[],
  next: IngredientLookup[],
): IngredientLookup[] {
  const byId = new Map<number, IngredientLookup>();
  [...existing, ...next].forEach((entry) => {
    if (entry.id > 0) byId.set(entry.id, entry);
  });
  return [...byId.values()].sort((a, b) => a.name.localeCompare(b.name, 'de'));
}

function productIngredientLookupRows(product: AdminProductDetail): IngredientLookup[] {
  const rows: IngredientLookup[] = [];
  product.ingredients.forEach((row) => {
    rows.push({ id: row.ingredient_id, name: row.ingredient_name, unit: row.ingredient_unit });
    if (row.parent_ingredient_id && row.parent_ingredient_name) {
      rows.push({ id: row.parent_ingredient_id, name: row.parent_ingredient_name });
    }
  });
  return rows;
}

function buildOverviewPatch(form: ProductEditForm, product: AdminCatalogProduct): AdminProductQAPatch {
  const patch: AdminProductQAPatch = {};
  const name = form.name.trim();
  if (!name) throw new Error('Name ist erforderlich.');
  if (name !== product.name) patch.name = name;
  if (changedText(form.brand, product.brand)) patch.brand = textValue(form.brand);
  if (changedText(form.image_url, product.image_url)) patch.image_url = textValue(form.image_url);
  if (changedNumber(form.price, product.price)) patch.price = parseRequiredNumber(form.price, 'Preis');
  if (changedNumber(form.serving_size, product.serving_size)) {
    patch.serving_size = parseRequiredNumber(form.serving_size, 'Portionsgröße');
  }
  if (changedText(form.serving_unit, product.serving_unit)) {
    const servingUnit = textValue(form.serving_unit);
    if (!servingUnit) throw new Error('Portionseinheit ist erforderlich, wenn das Feld gespeichert wird.');
    patch.serving_unit = servingUnit;
  }
  if (changedNumber(form.servings_per_container, product.servings_per_container)) {
    patch.servings_per_container = parseRequiredNumber(form.servings_per_container, 'Portionen pro Packung', true);
  }
  if (changedNumber(form.container_count, product.container_count)) {
    patch.container_count = parseRequiredNumber(form.container_count, 'Packungsanzahl', true);
  }
  if (Object.keys(patch).length === 0) throw new Error('Keine Aenderungen zum Speichern.');
  return patch;
}

function buildModerationPatch(form: ProductEditForm, product: AdminCatalogProduct): AdminProductQAPatch {
  const patch: AdminProductQAPatch = {};
  if (form.moderation_status !== product.moderation_status) patch.moderation_status = form.moderation_status;
  if (form.visibility !== product.visibility) patch.visibility = form.visibility;
  if (Object.keys(patch).length === 0) throw new Error('Keine Aenderungen zum Speichern.');
  return patch;
}

function getWarnings(product: AdminProductDetail): WarningItem[] {
  const warnings: WarningItem[] = [];
  const raw = product.raw ?? {};

  if (!product.shop_link || product.shop_link.trim().length === 0) {
    warnings.push({
      label: 'Shop-Link fehlt',
      tone: 'warn',
    });
  }
  if (!product.image_url || product.image_url.trim().length === 0) {
    warnings.push({
      label: 'Produktbild fehlt',
      tone: 'warn',
    });
  }
  if (product.price === null || product.price <= 0) {
    warnings.push({
      label: product.price === null ? 'Preis fehlt' : 'Preis ist nicht gültig',
      tone: 'warn',
    });
  }
  if (product.price !== null && product.price > 300) {
    warnings.push({
      label: 'Preis untypisch hoch',
      tone: 'warn',
    });
  }
  if (product.moderation_status && product.moderation_status !== 'approved') {
    warnings.push({
      label: `Freigabe: ${moderationStatusLabel(product.moderation_status)}`,
      tone: 'warn',
    });
  }
  if (product.visibility && product.visibility !== 'public') {
    warnings.push({
      label: `Sichtbarkeit: ${product.visibility}`,
      tone: 'info',
    });
  }
  if (product.warning_title || product.warning_message) {
    warnings.push({
      label: `Produktwarnung: ${product.warning_title || product.warning_message || 'gesetzt'}`,
      tone: product.warning_type === 'danger' ? 'danger' : 'warn',
    });
  }

  const missingImage = toBooleanFromRaw(raw.missing_image);
  const missingShopLink = toBooleanFromRaw(raw.missing_shop_link);
  const suspiciousPrice = toBooleanFromRaw(raw.suspicious_price_zero_or_high);
  const missingServingData = toBooleanFromRaw(raw.missing_serving_data);
  const missingIngredients = toBooleanFromRaw(raw.missing_ingredient_rows);
  const noAffiliateFlag = toBooleanFromRaw(raw.no_affiliate_flag_on_shop_link);

  if (missingImage === true) {
    warnings.push({ label: 'Prüfung: Produktbild fehlt', tone: 'warn' });
  }
  if (missingShopLink === true) {
    warnings.push({ label: 'Prüfung: Shop-Link fehlt', tone: 'warn' });
  }
  if (suspiciousPrice === true) {
    warnings.push({ label: 'Produktprüfung: Preiswert ist auffällig', tone: 'warn' });
  }
  if (missingServingData === true) {
    warnings.push({ label: 'Produktprüfung: Portionsdaten unvollständig', tone: 'warn' });
  }
  if (missingIngredients === true) {
    warnings.push({ label: 'Prüfung: Wirkstoffe fehlen', tone: 'warn' });
  }
  if (noAffiliateFlag === true) {
    warnings.push({ label: 'Prüfung: Link-Zuordnung fehlt', tone: 'warn' });
  }
  product.qa?.issues.forEach((issue) => {
    if (!warnings.some((entry) => entry.label.includes(issueLabel(issue)))) {
      warnings.push({ label: `Prüfung: ${issueLabel(issue)}`, tone: 'warn' });
    }
  });
  product.product_warnings.forEach((warning) => {
    if (warning.active === 0) return;
    const tone = warning.severity === 'danger' ? 'danger' : warning.severity === 'info' ? 'info' : 'warn';
    warnings.push({
      label: `Produktwarnung: ${warning.title}`,
      tone,
    });
  });
  product.warnings.forEach((warning) => {
    const tone = warning.severity === 'danger' ? 'danger' : warning.severity === 'info' ? 'info' : 'warn';
    warnings.push({
      label: `Sicherheit: ${warning.short_label}`,
      tone,
    });
  });

  return warnings;
}

function deriveIngredientSummary(product: AdminCatalogProduct): string {
  if ('qa_counts' in product) {
    const detail = product as AdminProductDetail;
    return `Wirkstoffe: ${detail.qa_counts.ingredient_count} / Hauptwirkstoffe: ${detail.qa_counts.main_ingredient_count}`;
  }
  const raw = product.raw ?? {};
  const mainCount = toInt(raw.main_ingredient_count);
  const ingredientCount = toInt(raw.ingredient_count);
  const counts = [
    ingredientCount !== null ? `Wirkstoffe: ${ingredientCount}` : null,
    mainCount !== null ? `Hauptwirkstoffe: ${mainCount}` : null,
  ].filter(Boolean);
  if (counts.length > 0) return counts.join(' / ');
  return 'Keine Wirkstoff-Zusammenfassung vorhanden.';
}

export default function AdministratorProductDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const productId = useMemo(() => {
    const parsed = Number(id);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
  }, [id]);
  const activeTab = getTabFromSection(searchParams.get('section'));

  const [product, setProduct] = useState<AdminProductDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);
  const [warningSaving, setWarningSaving] = useState(false);
  const [editingWarningId, setEditingWarningId] = useState<number | null>(null);
  const [warningForm, setWarningForm] = useState<ProductWarningForm>(() => emptyProductWarningForm());
  const [form, setForm] = useState<ProductEditForm>(() => emptyProductEditForm());
  const [shopLinks, setShopLinks] = useState<AdminProductShopLink[]>([]);
  const [shopLinksLoading, setShopLinksLoading] = useState(false);
  const [shopLinkHealthAvailable, setShopLinkHealthAvailable] = useState(false);
  const [shopLinkSavingId, setShopLinkSavingId] = useState<string | null>(null);
  const [editingShopLinkId, setEditingShopLinkId] = useState<number | null>(null);
  const [shopLinkForm, setShopLinkForm] = useState<ShopLinkForm>(() => emptyShopLinkForm());
  const [ingredientOptions, setIngredientOptions] = useState<IngredientLookup[]>([]);
  const [ingredientLookupQuery, setIngredientLookupQuery] = useState('');
  const [ingredientLookupLoading, setIngredientLookupLoading] = useState(false);
  const [ingredientSavingId, setIngredientSavingId] = useState<number | 'create' | 'delete' | null>(null);
  const [editingIngredientId, setEditingIngredientId] = useState<number | null>(null);
  const [newIngredientForm, setNewIngredientForm] = useState<ProductIngredientForm>(() => emptyProductIngredientForm());
  const [ingredientForm, setIngredientForm] = useState<ProductIngredientForm>(() => emptyProductIngredientForm());
  const [imageCropOpen, setImageCropOpen] = useState(false);

  const loadProduct = useCallback(async () => {
    if (!productId) {
      setProduct(null);
      setShopLinks([]);
      setError('Ungültige Produkt-ID.');
      setLoading(false);
      return;
    }
    setLoading(true);
    setError('');
    setMessage('');
    try {
      setProduct(await getAdminProduct(productId));
    } catch (errorValue) {
      setError(getErrorMessage(errorValue));
      setProduct(null);
    } finally {
      setLoading(false);
    }
  }, [productId]);

  const loadShopLinks = useCallback(async (idToLoad = productId) => {
    if (!idToLoad) {
      setShopLinks([]);
      setShopLinkHealthAvailable(false);
      return;
    }
    setShopLinksLoading(true);
    try {
      const response = await getAdminProductShopLinks(idToLoad);
      setShopLinks(response.links);
      setShopLinkHealthAvailable(response.health_available);
    } catch (errorValue) {
      setShopLinks([]);
      setShopLinkHealthAvailable(false);
      setError(getErrorMessage(errorValue));
    } finally {
      setShopLinksLoading(false);
    }
  }, [productId]);

  const loadIngredientOptions = useCallback(async (query = '') => {
    setIngredientLookupLoading(true);
    try {
      const rows = query.trim().length >= 2
        ? await searchIngredients(query)
        : await getAllIngredients();
      setIngredientOptions((previous) => mergeIngredientOptions(previous, rows));
    } catch (errorValue) {
      setError(getErrorMessage(errorValue));
    } finally {
      setIngredientLookupLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadProduct();
  }, [loadProduct]);

  useEffect(() => {
    void loadShopLinks();
  }, [loadShopLinks]);

  useEffect(() => {
    void loadIngredientOptions();
  }, [loadIngredientOptions]);

  useEffect(() => {
    if (product) {
      setForm(formFromProduct(product));
      setIngredientOptions((previous) => mergeIngredientOptions(previous, productIngredientLookupRows(product)));
    }
  }, [product]);

  const updateField = <K extends keyof ProductEditForm>(field: K, value: ProductEditForm[K]) => {
    setForm((previous) => ({ ...previous, [field]: value }));
  };

  const updateShopLinkField = <K extends keyof ShopLinkForm>(field: K, value: ShopLinkForm[K]) => {
    setShopLinkForm((previous) => ({ ...previous, [field]: value }));
  };

  const updateWarningField = <K extends keyof ProductWarningForm>(field: K, value: ProductWarningForm[K]) => {
    setWarningForm((previous) => ({ ...previous, [field]: value }));
  };

  const updateNewIngredientField = <K extends keyof ProductIngredientForm>(field: K, value: ProductIngredientForm[K]) => {
    setNewIngredientForm((previous) => ({ ...previous, [field]: value }));
  };

  const updateIngredientField = <K extends keyof ProductIngredientForm>(field: K, value: ProductIngredientForm[K]) => {
    setIngredientForm((previous) => ({ ...previous, [field]: value }));
  };

  const handleTabChange = (tab: TabName) => {
    const nextSearchParams = new URLSearchParams(searchParams);
    nextSearchParams.set('section', tab);
    setSearchParams(nextSearchParams);
  };

  const saveProductPatch = async (patch: AdminProductQAPatch, successText: string) => {
    if (!product) return;
    setSaving(true);
    setMessage('');
    setError('');
    try {
      await updateProductQA(product.id, patch, { version: product.version ?? product.qa?.version ?? null });
      const fresh = await getAdminProduct(product.id);
      setProduct(fresh);
      setMessage(successText);
    } catch (errorValue) {
      setError(getErrorMessage(errorValue));
    } finally {
      setSaving(false);
      setTimeout(() => setMessage(''), 2200);
    }
  };

  const handleSaveOverview = async () => {
    if (!product) return;
    try {
      await saveProductPatch(buildOverviewPatch(form, product), 'Basisdaten gespeichert.');
    } catch (errorValue) {
      setError(getErrorMessage(errorValue));
    }
  };

  const handleSaveModeration = async () => {
    if (!product) return;
    try {
      await saveProductPatch(buildModerationPatch(form, product), 'Freigabe gespeichert.');
    } catch (errorValue) {
      setError(getErrorMessage(errorValue));
    }
  };

  const refreshProductAndShopLinks = async (idToRefresh: number) => {
    const [freshProduct] = await Promise.all([
      getAdminProduct(idToRefresh),
      loadShopLinks(idToRefresh),
    ]);
    setProduct(freshProduct);
  };

  const handleStartCreateShopLink = () => {
    setEditingShopLinkId(null);
    setShopLinkForm({
      ...emptyShopLinkForm(),
      is_primary: shopLinks.length === 0,
      sort_order: String(shopLinks.length * 10),
    });
    setError('');
    setMessage('');
  };

  const handleStartEditShopLink = (link: AdminProductShopLink) => {
    setEditingShopLinkId(link.id);
    setShopLinkForm(shopLinkFormFromLink(link));
    setError('');
    setMessage('');
  };

  const handleCancelShopLinkEdit = () => {
    setEditingShopLinkId(null);
    setShopLinkForm(emptyShopLinkForm());
  };

  const handleSaveShopLink = async () => {
    if (!product) return;
    const savingId = editingShopLinkId ? `save-${editingShopLinkId}` : 'create';
    setShopLinkSavingId(savingId);
    setError('');
    setMessage('');
    try {
      const payload = payloadFromShopLinkForm(shopLinkForm);
      if (editingShopLinkId) {
        const existing = shopLinks.find((link) => link.id === editingShopLinkId);
        await updateAdminProductShopLink(product.id, editingShopLinkId, payload, { version: existing?.version ?? null });
        setMessage('Shop-Link gespeichert.');
      } else {
        if (shopLinks.length === 0) payload.is_primary = 1;
        await createAdminProductShopLink(product.id, payload);
        setMessage('Shop-Link erstellt.');
      }
      setEditingShopLinkId(null);
      setShopLinkForm(emptyShopLinkForm());
      await refreshProductAndShopLinks(product.id);
    } catch (errorValue) {
      setError(getErrorMessage(errorValue));
    } finally {
      setShopLinkSavingId(null);
      setTimeout(() => setMessage(''), 2200);
    }
  };

  const handleSetPrimaryShopLink = async (link: AdminProductShopLink) => {
    if (!product) return;
    setShopLinkSavingId(`primary-${link.id}`);
    setError('');
    setMessage('');
    try {
      await updateAdminProductShopLink(
        product.id,
        link.id,
        { is_primary: 1, active: 1, version: link.version },
        { version: link.version },
      );
      await refreshProductAndShopLinks(product.id);
      setMessage('Hauptlink gesetzt.');
    } catch (errorValue) {
      setError(getErrorMessage(errorValue));
    } finally {
      setShopLinkSavingId(null);
      setTimeout(() => setMessage(''), 2200);
    }
  };

  const handleRecheckShopLink = async (link: AdminProductShopLink) => {
    if (!product) return;
    setShopLinkSavingId(`recheck-${link.id}`);
    setError('');
    setMessage('');
    try {
      const response = await recheckAdminProductShopLink(product.id, link.id);
      if (response.link) {
        setShopLinks((previous) => previous.map((entry) => (entry.id === response.link?.id ? response.link : entry)));
      } else {
        await loadShopLinks(product.id);
      }
      setMessage('Link erneut geprüft.');
    } catch (errorValue) {
      setError(getErrorMessage(errorValue));
    } finally {
      setShopLinkSavingId(null);
      setTimeout(() => setMessage(''), 2200);
    }
  };

  const handleDeleteShopLink = async (link: AdminProductShopLink) => {
    if (!product) return;
    if (!window.confirm(`Shop-Link "${link.shop_name || linkHost(link.url)}" löschen?`)) return;
    setShopLinkSavingId(`delete-${link.id}`);
    setError('');
    setMessage('');
    try {
      await deleteAdminProductShopLink(product.id, link.id, { version: link.version });
      await refreshProductAndShopLinks(product.id);
      if (editingShopLinkId === link.id) handleCancelShopLinkEdit();
      setMessage('Shop-Link gelöscht.');
    } catch (errorValue) {
      setError(getErrorMessage(errorValue));
    } finally {
      setShopLinkSavingId(null);
      setTimeout(() => setMessage(''), 2200);
    }
  };

  const handleImageUploadSuccess = async () => {
    if (!product) return;
    setImageCropOpen(false);
    setError('');
    try {
      setProduct(await getAdminProduct(product.id));
      setMessage('Produktbild hochgeladen.');
      setTimeout(() => setMessage(''), 2200);
    } catch (errorValue) {
      setError(getErrorMessage(errorValue));
    }
  };

  const handleIngredientLookup = async () => {
    await loadIngredientOptions(ingredientLookupQuery);
  };

  const handleCreateIngredient = async () => {
    if (!product) return;
    setIngredientSavingId('create');
    setMessage('');
    setError('');
    try {
      await createAdminProductIngredient(
        product.id,
        payloadFromProductIngredientForm(newIngredientForm),
        { version: product.version ?? null },
      );
      setProduct(await getAdminProduct(product.id));
      setNewIngredientForm(emptyProductIngredientForm());
      setMessage('Wirkstoffzeile erstellt.');
    } catch (errorValue) {
      setError(getErrorMessage(errorValue));
    } finally {
      setIngredientSavingId(null);
      setTimeout(() => setMessage(''), 2200);
    }
  };

  const handleEditIngredient = (row: AdminProductIngredient) => {
    setEditingIngredientId(row.id);
    setIngredientForm(formFromProductIngredient(row));
    setMessage('');
    setError('');
  };

  const handleCancelIngredientEdit = () => {
    setEditingIngredientId(null);
    setIngredientForm(emptyProductIngredientForm());
  };

  const handleSaveIngredient = async (rowId: number) => {
    if (!product) return;
    setIngredientSavingId(rowId);
    setMessage('');
    setError('');
    try {
      await updateAdminProductIngredient(
        product.id,
        rowId,
        payloadFromProductIngredientForm(ingredientForm),
        { version: product.version ?? null },
      );
      setProduct(await getAdminProduct(product.id));
      setEditingIngredientId(null);
      setIngredientForm(emptyProductIngredientForm());
      setMessage('Wirkstoffzeile gespeichert.');
    } catch (errorValue) {
      setError(getErrorMessage(errorValue));
    } finally {
      setIngredientSavingId(null);
      setTimeout(() => setMessage(''), 2200);
    }
  };

  const handleDeleteIngredient = async (row: AdminProductIngredient) => {
    if (!product) return;
    const confirmed = window.confirm(`Wirkstoffzeile "${row.ingredient_name}" wirklich löschen?`);
    if (!confirmed) return;
    setIngredientSavingId('delete');
    setMessage('');
    setError('');
    try {
      await deleteAdminProductIngredient(product.id, row.id, { version: product.version ?? null });
      setProduct(await getAdminProduct(product.id));
      if (editingIngredientId === row.id) handleCancelIngredientEdit();
      setMessage('Wirkstoffzeile gelöscht.');
    } catch (errorValue) {
      setError(getErrorMessage(errorValue));
    } finally {
      setIngredientSavingId(null);
      setTimeout(() => setMessage(''), 2200);
    }
  };

  const handleEditWarning = (warning: AdminProductWarning) => {
    setEditingWarningId(warning.id);
    setWarningForm(formFromProductWarning(warning));
    setMessage('');
    setError('');
  };

  const handleCancelWarningEdit = () => {
    setEditingWarningId(null);
    setWarningForm(emptyProductWarningForm());
  };

  const handleSaveProductWarning = async () => {
    if (!product) return;
    const payload = payloadFromProductWarningForm(warningForm);
    if (!payload.title || !payload.message) {
      setError('Titel und Text der Produktwarnung sind erforderlich.');
      return;
    }
    setWarningSaving(true);
    setMessage('');
    setError('');
    try {
      const existingWarning = editingWarningId
        ? product.product_warnings.find((warning) => warning.id === editingWarningId)
        : null;
      if (editingWarningId) {
        await updateAdminProductWarning(product.id, editingWarningId, payload, { version: existingWarning?.version ?? null });
      } else {
        await createAdminProductWarning(product.id, payload);
      }
      setProduct(await getAdminProduct(product.id));
      setEditingWarningId(null);
      setWarningForm(emptyProductWarningForm());
      setMessage(editingWarningId ? 'Produktwarnung gespeichert.' : 'Produktwarnung erstellt.');
    } catch (errorValue) {
      setError(getErrorMessage(errorValue));
    } finally {
      setWarningSaving(false);
      setTimeout(() => setMessage(''), 2200);
    }
  };

  const handleDeactivateProductWarning = async (warning: AdminProductWarning) => {
    if (!product) return;
    setWarningSaving(true);
    setMessage('');
    setError('');
    try {
      await deleteAdminProductWarning(product.id, warning.id, { version: warning.version });
      setProduct(await getAdminProduct(product.id));
      if (editingWarningId === warning.id) {
        setEditingWarningId(null);
        setWarningForm(emptyProductWarningForm());
      }
      setMessage('Produktwarnung deaktiviert.');
    } catch (errorValue) {
      setError(getErrorMessage(errorValue));
    } finally {
      setWarningSaving(false);
      setTimeout(() => setMessage(''), 2200);
    }
  };

  const warnings = useMemo(() => (product ? getWarnings(product) : []), [product]);
  const linkHealth = useMemo(() => (product ? readLinkHealth(product.raw) : null), [product]);

  const renderLinkHealthSummary = (health: AdminProductLinkHealth | null) => (
    <div className="rounded-[var(--admin-r-sm)] border border-[color:var(--admin-line)] bg-[color:var(--admin-bg)] p-3 text-xs">
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <AdminBadge tone={linkHealthTone(health)}>{linkHealthLabel(health)}</AdminBadge>
        {health?.http_status !== null && health?.http_status !== undefined ? (
          <span className="admin-mono">HTTP {health.http_status}</span>
        ) : null}
        {health?.redirected ? <AdminBadge tone="info">Weiterleitung</AdminBadge> : null}
      </div>
      <dl className="grid gap-2 sm:grid-cols-2">
        <div>
          <dt className="admin-muted">Letzter Check</dt>
          <dd>{formatDate(health?.last_checked_at ?? null)}</dd>
        </div>
        <div>
          <dt className="admin-muted">Letzter Erfolg</dt>
          <dd>{formatDate(health?.last_success_at ?? null)}</dd>
        </div>
        <div>
          <dt className="admin-muted">Antwortzeit</dt>
          <dd className="admin-mono">{formatResponseTime(health?.response_time_ms ?? null)}</dd>
        </div>
        <div>
          <dt className="admin-muted">Fehler in Folge</dt>
          <dd className="admin-mono">{health?.consecutive_failures ?? '-'}</dd>
        </div>
      </dl>
      {health?.failure_reason ? (
        <p className="admin-muted mt-2 break-words">Grund: {health.failure_reason}</p>
      ) : null}
      {health?.final_url ? (
        <p className="admin-muted mt-2 break-all">
          Ziel: <span className="admin-mono">{linkHost(health.final_url)}</span>
        </p>
      ) : null}
    </div>
  );

  const renderOverviewTab = (selected: AdminCatalogProduct) => (
    <div className="grid gap-4 xl:grid-cols-2">
      <AdminCard title="Produktübersicht" subtitle="Basisdaten, Produktbild und Packungsdaten direkt bearbeiten.">
        <div className="grid gap-3">
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="admin-muted">ID</span>
            <span className="admin-mono">#{selected.id}</span>
            <span className="admin-muted">Erstellt</span>
            <span>{formatDate(selected.created_at)}</span>
            <AdminBadge tone={ownerTone(selected)}>{ownerLabel(selected)}</AdminBadge>
            <AdminBadge tone={moderationTone(selected.moderation_status)}>{moderationStatusLabel(selected.moderation_status)}</AdminBadge>
            <AdminBadge tone={visibilityTone(selected.visibility)}>{visibilityLabel(selected.visibility)}</AdminBadge>
            <AdminBadge tone={linkHealthTone(linkHealth)}>{linkHealthLabel(linkHealth)}</AdminBadge>
          </div>
          <label className="text-xs font-medium text-[color:var(--admin-ink-2)]">
            Name
            <input
              value={form.name}
              onChange={(event) => updateField('name', event.target.value)}
              className="admin-input mt-1"
              maxLength={240}
            />
          </label>
          <div className="grid gap-3 md:grid-cols-2">
            <label className="text-xs font-medium text-[color:var(--admin-ink-2)]">
              Marke
              <input
                value={form.brand}
                onChange={(event) => updateField('brand', event.target.value)}
                className="admin-input mt-1"
                maxLength={240}
              />
            </label>
            <label className="text-xs font-medium text-[color:var(--admin-ink-2)]">
              Preis EUR
              <input
                value={form.price}
                onChange={(event) => updateField('price', event.target.value)}
                inputMode="decimal"
                className="admin-input mt-1"
              />
            </label>
          </div>
          <label className="text-xs font-medium text-[color:var(--admin-ink-2)]">
            Bild-URL
            <input
              value={form.image_url}
              onChange={(event) => updateField('image_url', event.target.value)}
              className="admin-input mt-1"
              maxLength={2048}
            />
          </label>
          <div className="grid gap-3 rounded-[var(--admin-r-sm)] border border-[color:var(--admin-line)] bg-[color:var(--admin-bg)] p-3 md:grid-cols-[96px_1fr_auto] md:items-center">
            <div className="h-20 w-20 overflow-hidden rounded-[var(--admin-r-sm)] border border-[color:var(--admin-line)] bg-[color:var(--admin-bg-sunk)]">
              {selected.image_url ? (
                <img
                  src={selected.image_url}
                  alt={selected.name}
                  className="h-full w-full object-cover"
                  onError={(event) => { (event.currentTarget as HTMLImageElement).style.display = 'none'; }}
                />
              ) : null}
            </div>
            <div className="min-w-0 text-xs">
              <p className="font-semibold text-[color:var(--admin-ink)]">Produktbild hochladen</p>
              <p className="admin-muted mt-1">
                Bilder werden automatisch als WebP auf 512 x 512 px optimiert und versioniert in R2 gespeichert.
              </p>
              <p className="admin-mono admin-muted mt-1 break-all">
                {selected.image_r2_key || selected.image_url || 'Noch kein Bild gespeichert.'}
              </p>
            </div>
            <AdminButton
              variant="ghost"
              onClick={() => {
                setError('');
                setImageCropOpen(true);
              }}
              disabled={saving}
            >
              <Upload size={15} />
              Bild hochladen
            </AdminButton>
          </div>
          <div className="grid gap-3 md:grid-cols-4">
            <label className="text-xs font-medium text-[color:var(--admin-ink-2)]">
              Portionsgröße
              <input
                value={form.serving_size}
                onChange={(event) => updateField('serving_size', event.target.value)}
                inputMode="decimal"
                className="admin-input mt-1"
              />
            </label>
            <label className="text-xs font-medium text-[color:var(--admin-ink-2)]">
              Einheit
              <input
                value={form.serving_unit}
                onChange={(event) => updateField('serving_unit', event.target.value)}
                className="admin-input mt-1"
                maxLength={40}
              />
            </label>
            <label className="text-xs font-medium text-[color:var(--admin-ink-2)]">
              Portionen
              <input
                value={form.servings_per_container}
                onChange={(event) => updateField('servings_per_container', event.target.value)}
                inputMode="numeric"
                className="admin-input mt-1"
              />
            </label>
            <label className="text-xs font-medium text-[color:var(--admin-ink-2)]">
              Packungen
              <input
                value={form.container_count}
                onChange={(event) => updateField('container_count', event.target.value)}
                inputMode="numeric"
                className="admin-input mt-1"
              />
            </label>
          </div>
          <div className="flex justify-end">
            <AdminButton variant="primary" onClick={() => void handleSaveOverview()} disabled={saving}>
              <Save size={15} />
              {saving ? 'Speichere...' : 'Basisdaten speichern'}
            </AdminButton>
          </div>
        </div>
      </AdminCard>
      <AdminCard title="Shop-Link" subtitle="Sichtbarer Linkstatus im Katalog.">
        <dl className="grid gap-2 text-[13px]">
          <div>
            <dt className="admin-muted">Shop-Link</dt>
            <dd className="break-all">
              {selected.shop_link ? (
                <a
                  href={selected.shop_link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-[color:var(--admin-info-ink)]"
                >
                  {selected.shop_link}
                  <ExternalLink size={12} />
                </a>
              ) : (
                <span className="admin-muted">nicht gesetzt</span>
              )}
            </dd>
          </div>
          <div>
            <dt className="admin-muted">Wirkstoffe</dt>
            <dd>{deriveIngredientSummary(selected)}</dd>
          </div>
        </dl>
        <div className="mt-3">{renderLinkHealthSummary(linkHealth)}</div>
      </AdminCard>
    </div>
  );

  const renderIngredientSelect = (
    label: string,
    value: string,
    onChange: (value: string) => void,
    includeEmpty = false,
  ) => (
    <label className="text-xs font-medium text-[color:var(--admin-ink-2)]">
      {label}
      <select value={value} onChange={(event) => onChange(event.target.value)} className="admin-select mt-1">
        {includeEmpty ? <option value="">nicht gesetzt</option> : <option value="">Wirkstoff wählen</option>}
        {ingredientOptions.map((ingredient) => (
          <option key={ingredient.id} value={ingredient.id}>
            {ingredient.name}{ingredient.unit ? ` (${ingredient.unit})` : ''} - #{ingredient.id}
          </option>
        ))}
      </select>
    </label>
  );

  const renderProductIngredientForm = (
    currentForm: ProductIngredientForm,
    onChange: <K extends keyof ProductIngredientForm>(field: K, value: ProductIngredientForm[K]) => void,
    onSubmit: () => void,
    submitLabel: string,
    busy: boolean,
    onCancel?: () => void,
  ) => (
    <div className="rounded-[var(--admin-r-sm)] border border-[color:var(--admin-line)] bg-[color:var(--admin-bg)] p-3">
      <div className="grid gap-3 lg:grid-cols-[minmax(220px,1.5fr)_repeat(4,minmax(90px,1fr))]">
        {renderIngredientSelect('Wirkstoff', currentForm.ingredient_id, (value) => onChange('ingredient_id', value))}
        <label className="text-xs font-medium text-[color:var(--admin-ink-2)]">
          Menge
          <input
            value={currentForm.quantity}
            onChange={(event) => onChange('quantity', event.target.value)}
            inputMode="decimal"
            className="admin-input mt-1"
          />
        </label>
        <label className="text-xs font-medium text-[color:var(--admin-ink-2)]">
          Einheit
          <input
            value={currentForm.unit}
            onChange={(event) => onChange('unit', event.target.value)}
            className="admin-input mt-1"
            maxLength={64}
          />
        </label>
        <label className="text-xs font-medium text-[color:var(--admin-ink-2)]">
          Basis-Menge
          <input
            value={currentForm.basis_quantity}
            onChange={(event) => onChange('basis_quantity', event.target.value)}
            inputMode="decimal"
            className="admin-input mt-1"
          />
        </label>
        <label className="text-xs font-medium text-[color:var(--admin-ink-2)]">
          Basis-Einheit
          <input
            value={currentForm.basis_unit}
            onChange={(event) => onChange('basis_unit', event.target.value)}
            className="admin-input mt-1"
            maxLength={64}
          />
        </label>
      </div>
      <div className="mt-3 grid gap-3 md:grid-cols-[140px_minmax(220px,1fr)_auto]">
        <label className="text-xs font-medium text-[color:var(--admin-ink-2)]">
          Form-ID
          <input
            value={currentForm.form_id}
            onChange={(event) => onChange('form_id', event.target.value)}
            inputMode="numeric"
            className="admin-input mt-1"
            placeholder="optional"
          />
        </label>
        {renderIngredientSelect(
          'Übergeordneter Wirkstoff',
          currentForm.parent_ingredient_id,
          (value) => onChange('parent_ingredient_id', value),
          true,
        )}
        <div className="flex flex-wrap items-end gap-3">
          <label className="admin-input inline-flex min-h-[38px] items-center gap-2">
            <input
              type="checkbox"
              checked={currentForm.is_main}
              onChange={(event) => onChange('is_main', event.target.checked)}
            />
            Hauptwirkstoff
          </label>
          <label className="admin-input inline-flex min-h-[38px] items-center gap-2">
            <input
              type="checkbox"
              checked={currentForm.search_relevant}
              onChange={(event) => onChange('search_relevant', event.target.checked)}
            />
            Suchrelevant
          </label>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap justify-end gap-2">
        {onCancel ? (
          <AdminButton variant="ghost" onClick={onCancel} disabled={busy}>
            <X size={14} />
            Abbrechen
          </AdminButton>
        ) : null}
        <AdminButton variant="primary" onClick={onSubmit} disabled={busy}>
          <Save size={14} />
          {busy ? 'Speichere...' : submitLabel}
        </AdminButton>
      </div>
    </div>
  );

  const renderWirkstoffeTab = (selected: AdminProductDetail) => (
    <div className="grid gap-4">
      <AdminCard
        title="Wirkstoffe"
        subtitle={`${selected.qa_counts.ingredient_count} Zeile(n), ${selected.qa_counts.main_ingredient_count} Hauptwirkstoff(e).`}
      >
        <div className="mb-4 grid gap-3">
          <div className="flex flex-wrap items-end gap-2">
            <label className="min-w-[220px] flex-1 text-xs font-medium text-[color:var(--admin-ink-2)]">
              Wirkstoff suchen
              <input
                value={ingredientLookupQuery}
                onChange={(event) => setIngredientLookupQuery(event.target.value)}
                className="admin-input mt-1"
                placeholder="Name oder Einheit suchen"
              />
            </label>
            <AdminButton onClick={() => void handleIngredientLookup()} disabled={ingredientLookupLoading}>
              <RefreshCw size={14} className={ingredientLookupLoading ? 'animate-spin' : ''} />
              Suchen
            </AdminButton>
          </div>
          {renderProductIngredientForm(
            newIngredientForm,
            updateNewIngredientField,
            () => void handleCreateIngredient(),
            'Wirkstoffzeile hinzufügen',
            ingredientSavingId === 'create',
          )}
        </div>
        {selected.ingredients.length === 0 ? (
          <AdminEmpty>Keine Wirkstoffzeilen für dieses Produkt.</AdminEmpty>
        ) : (
          <>
            <div className="grid gap-3 md:hidden">
              {selected.ingredients.map((row) => (
                <article key={row.id} className="rounded-[var(--admin-r-sm)] border border-[color:var(--admin-line)] bg-[color:var(--admin-bg)] p-3">
                  {editingIngredientId === row.id ? (
                    renderProductIngredientForm(
                      ingredientForm,
                      updateIngredientField,
                      () => void handleSaveIngredient(row.id),
                      'Speichern',
                      ingredientSavingId === row.id,
                      handleCancelIngredientEdit,
                    )
                  ) : (
                    <>
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div>
                          <div className="font-medium">{row.ingredient_name}</div>
                          <div className="admin-muted text-xs">
                            {row.form_name || 'Basisform'}{row.parent_ingredient_name ? ` - übergeordnet: ${row.parent_ingredient_name}` : ''}
                          </div>
                        </div>
                        <AdminBadge tone={row.is_main === 1 ? 'ok' : row.search_relevant === 0 ? 'neutral' : 'info'}>
                          {ingredientRole(row)}
                        </AdminBadge>
                      </div>
                      <p className="admin-mono mt-2 text-xs">{formatAmount(row)}</p>
                      {row.effect_summary ? <p className="admin-muted mt-2 text-xs">{row.effect_summary}</p> : null}
                      <div className="mt-3 flex flex-wrap gap-2">
                        <AdminButton size="sm" variant="ghost" onClick={() => handleEditIngredient(row)} disabled={ingredientSavingId !== null}>
                          <Edit3 size={13} />
                          Bearbeiten
                        </AdminButton>
                        <AdminButton size="sm" variant="danger" onClick={() => void handleDeleteIngredient(row)} disabled={ingredientSavingId !== null}>
                          <Trash2 size={13} />
                            Löschen
                        </AdminButton>
                      </div>
                    </>
                  )}
                </article>
              ))}
            </div>
            <div className="admin-table-wrap hidden md:block">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Wirkstoff</th>
                    <th>Menge</th>
                    <th>Rolle</th>
                    <th>Profil-Kontext</th>
                    <th>Aktionen</th>
                  </tr>
                </thead>
                <tbody>
                  {selected.ingredients.map((row) => (
                    editingIngredientId === row.id ? (
                      <tr key={row.id}>
                        <td colSpan={5}>
                          {renderProductIngredientForm(
                            ingredientForm,
                            updateIngredientField,
                            () => void handleSaveIngredient(row.id),
                            'Speichern',
                            ingredientSavingId === row.id,
                            handleCancelIngredientEdit,
                          )}
                        </td>
                      </tr>
                    ) : (
                      <tr key={row.id}>
                        <td className="min-w-[220px]">
                          <div className="font-medium">{row.ingredient_name}</div>
                          <div className="admin-muted mt-1 text-xs">
                            ID {row.ingredient_id}
                            {row.form_name ? ` - ${row.form_name}` : ''}
                            {row.parent_ingredient_name ? ` - übergeordnet: ${row.parent_ingredient_name}` : ''}
                          </div>
                        </td>
                        <td className="admin-mono text-[12px]">{formatAmount(row)}</td>
                        <td>
                          <AdminBadge tone={row.is_main === 1 ? 'ok' : row.search_relevant === 0 ? 'neutral' : 'info'}>
                            {ingredientRole(row)}
                          </AdminBadge>
                        </td>
                        <td className="min-w-[260px]">
                          <div className="text-[13px]">{row.effect_summary || row.card_note || '-'}</div>
                          <div className="admin-muted mt-1 text-xs">
                            {row.timing || row.intake_hint || row.timing_note || 'Kein Anzeige-Profiltext'}
                          </div>
                        </td>
                        <td>
                          <div className="flex flex-wrap gap-2">
                            <AdminButton size="sm" variant="ghost" onClick={() => handleEditIngredient(row)} disabled={ingredientSavingId !== null}>
                              <Edit3 size={13} />
                              Bearbeiten
                            </AdminButton>
                            <AdminButton size="sm" variant="danger" onClick={() => void handleDeleteIngredient(row)} disabled={ingredientSavingId !== null}>
                              <Trash2 size={13} />
                              Löschen
                            </AdminButton>
                          </div>
                        </td>
                      </tr>
                    )
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </AdminCard>
    </div>
  );

  const renderModerationTab = (selected: AdminProductDetail) => (
    <AdminCard title="Freigabe" subtitle="Prüfstatus, Sichtbarkeit und offene Hinweise.">
      <div className="grid gap-4">
        <div className="grid gap-3 md:grid-cols-[180px_180px_auto]">
          <label className="text-xs font-medium text-[color:var(--admin-ink-2)]">
            Status
            <select
              value={form.moderation_status}
              onChange={(event) => updateField('moderation_status', event.target.value as ProductModerationStatus)}
              className="admin-select mt-1"
            >
              <option value="pending">wartet auf Prüfung</option>
              <option value="approved">freigegeben</option>
              <option value="rejected">abgelehnt</option>
              <option value="blocked">gesperrt</option>
            </select>
          </label>
          <label className="text-xs font-medium text-[color:var(--admin-ink-2)]">
            Sichtbarkeit
            <select
              value={form.visibility}
              onChange={(event) => updateField('visibility', event.target.value as ProductVisibility)}
              className="admin-select mt-1"
            >
              <option value="hidden">ausgeblendet</option>
              <option value="public">sichtbar</option>
            </select>
          </label>
          <div className="flex items-end">
            <AdminButton variant="primary" onClick={() => void handleSaveModeration()} disabled={saving}>
              <Save size={15} />
              {saving ? 'Speichere...' : 'Freigabe speichern'}
            </AdminButton>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <AdminBadge tone={moderationTone(selected.moderation_status)}>
            Aktuell: {moderationStatusLabel(selected.moderation_status)}
          </AdminBadge>
          <AdminBadge tone={visibilityTone(selected.visibility)}>
            Sichtbarkeit: {visibilityLabel(selected.visibility)}
          </AdminBadge>
        </div>
      </div>
      <dl className="mt-4 grid gap-2 text-[13px]">
        <div>
          <dt className="admin-muted">Produkt-ID</dt>
          <dd className="admin-mono">#{selected.id}</dd>
        </div>
        <div>
          <dt className="admin-muted">Hinweise</dt>
          <dd className="mt-1 flex flex-wrap gap-1.5">
            {selected.qa?.issues.length ? (
              selected.qa.issues.map((issue) => (
                <AdminBadge key={issue} tone="warn">{issueLabel(issue)}</AdminBadge>
              ))
            ) : (
              <AdminBadge tone="ok">Keine Hinweise</AdminBadge>
            )}
          </dd>
        </div>
        <div>
          <dt className="admin-muted">Kontext</dt>
          <dd>
            {selected.qa_counts.link_report_count} Linkmeldung(en), {selected.qa_counts.product_warning_count} Produktwarnung(en), {selected.qa_counts.warning_count} Sicherheitswarnung(en)
          </dd>
        </div>
      </dl>
    </AdminCard>
  );

  const renderShopLinksTab = (selected: AdminProductDetail) => (
    <div className="grid gap-4">
      <AdminCard
        title="Shop-Links"
        subtitle="Der Hauptlink wird im Katalog angezeigt."
        actions={
          <div className="flex flex-wrap gap-2">
            <AdminButton size="sm" onClick={() => void loadShopLinks(selected.id)} disabled={shopLinksLoading}>
              <RefreshCw size={13} />
              Aktualisieren
            </AdminButton>
            <AdminButton size="sm" variant="primary" onClick={handleStartCreateShopLink}>
              <Plus size={13} />
              Neuer Link
            </AdminButton>
          </div>
        }
      >
        {!shopLinkHealthAvailable ? (
          <p className="admin-muted mb-3 text-xs">Linkcheck-Daten sind in dieser Umgebung nicht verfuegbar.</p>
        ) : null}
        {shopLinksLoading ? (
          <AdminEmpty>Lade Shop-Links...</AdminEmpty>
        ) : shopLinks.length === 0 ? (
          <AdminEmpty>Keine Shop-Links vorhanden. Lege unten den ersten Link an.</AdminEmpty>
        ) : (
          <div className="grid gap-3">
            {shopLinks.map((link) => (
              <article key={link.id} className="rounded-[var(--admin-r-sm)] border border-[color:var(--admin-line)] bg-[color:var(--admin-bg)] p-3 text-sm">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium">{link.shop_name || linkHost(link.url)}</span>
                      {link.is_primary ? <AdminBadge tone="ok">Hauptlink</AdminBadge> : null}
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
                      <span>Quelle: {link.source_type}</span>
                      <span>Check: {formatDate(link.health?.last_checked_at ?? null)}</span>
                      {link.health?.http_status ? <span>HTTP {link.health.http_status}</span> : null}
                    </div>
                    {link.health?.failure_reason ? (
                      <p className="admin-muted mt-1 text-xs">Fehler: {link.health.failure_reason}</p>
                    ) : null}
                  </div>
                  <div className="flex shrink-0 flex-wrap gap-2">
                    <a href={link.url} target="_blank" rel="noopener noreferrer" className="admin-icon-btn" title="Shop-Link öffnen" aria-label="Shop-Link öffnen">
                      <ExternalLink size={15} />
                    </a>
                    {!link.is_primary ? (
                      <AdminButton size="sm" variant="ghost" onClick={() => void handleSetPrimaryShopLink(link)} disabled={shopLinkSavingId !== null}>
                        Hauptlink
                      </AdminButton>
                    ) : null}
                    <AdminButton size="sm" variant="ghost" onClick={() => void handleRecheckShopLink(link)} disabled={shopLinkSavingId !== null || !shopLinkHealthAvailable}>
                      <RefreshCw size={13} />
                      {shopLinkSavingId === `recheck-${link.id}` ? 'Prüfe...' : 'Erneut prüfen'}
                    </AdminButton>
                    <AdminButton size="sm" variant="ghost" onClick={() => handleStartEditShopLink(link)} disabled={shopLinkSavingId !== null}>
                      <Edit3 size={13} />
                      Bearbeiten
                    </AdminButton>
                    <AdminButton size="sm" variant="danger" onClick={() => void handleDeleteShopLink(link)} disabled={shopLinkSavingId !== null}>
                      <Trash2 size={13} />
                      Loeschen
                    </AdminButton>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </AdminCard>

      <AdminCard
        title={editingShopLinkId ? 'Shop-Link bearbeiten' : 'Neuen Shop-Link anlegen'}
        subtitle="Der aktive Hauptlink bleibt als Legacy-Shop-Link am Produkt gespiegelt."
        actions={editingShopLinkId ? (
          <AdminButton size="sm" variant="ghost" onClick={handleCancelShopLinkEdit} disabled={shopLinkSavingId !== null}>
            <X size={13} />
            Abbrechen
          </AdminButton>
        ) : null}
      >
        <div className="grid gap-3 md:grid-cols-[180px_minmax(260px,1fr)_150px_140px]">
          <label className="text-xs font-medium text-[color:var(--admin-ink-2)]">
            Shop
            <input value={shopLinkForm.shop_name} onChange={(event) => updateShopLinkField('shop_name', event.target.value)} className="admin-input mt-1" placeholder="z. B. Amazon" />
          </label>
          <label className="text-xs font-medium text-[color:var(--admin-ink-2)]">
            URL
            <input value={shopLinkForm.url} onChange={(event) => updateShopLinkField('url', event.target.value)} className="admin-input mt-1" placeholder="https://..." />
          </label>
          <label className="text-xs font-medium text-[color:var(--admin-ink-2)]">
            Link gehoert zu
            <select value={shopLinkForm.affiliate_owner_type} onChange={(event) => updateShopLinkField('affiliate_owner_type', event.target.value as AffiliateOwnerType)} className="admin-select mt-1">
              <option value="none">Keiner</option>
              <option value="nick">Nick</option>
              <option value="user">Nutzer</option>
            </select>
          </label>
          <label className="text-xs font-medium text-[color:var(--admin-ink-2)]">
            Nutzer-ID
            <input value={shopLinkForm.affiliate_owner_user_id} onChange={(event) => updateShopLinkField('affiliate_owner_user_id', event.target.value)} inputMode="numeric" disabled={shopLinkForm.affiliate_owner_type !== 'user'} className="admin-input mt-1" />
          </label>
          <label className="text-xs font-medium text-[color:var(--admin-ink-2)]">
            Sortierung
            <input value={shopLinkForm.sort_order} onChange={(event) => updateShopLinkField('sort_order', event.target.value)} inputMode="numeric" className="admin-input mt-1" />
          </label>
          <div className="flex flex-wrap items-end gap-4 md:col-span-2">
            <label className="inline-flex min-h-[38px] items-center gap-2 text-xs font-medium text-[color:var(--admin-ink-2)]">
              <input type="checkbox" checked={shopLinkForm.is_primary} onChange={(event) => updateShopLinkField('is_primary', event.target.checked)} />
              Hauptlink
            </label>
            <label className="inline-flex min-h-[38px] items-center gap-2 text-xs font-medium text-[color:var(--admin-ink-2)]">
              <input type="checkbox" checked={shopLinkForm.active} onChange={(event) => updateShopLinkField('active', event.target.checked)} />
              Aktiv
            </label>
          </div>
          <div className="flex items-end justify-end">
            <AdminButton variant="primary" onClick={() => void handleSaveShopLink()} disabled={shopLinkSavingId !== null}>
              <Save size={15} />
              {shopLinkSavingId === 'create' || (editingShopLinkId && shopLinkSavingId === `save-${editingShopLinkId}`)
                ? 'Speichere...'
                : editingShopLinkId ? 'Speichern' : 'Anlegen'}
            </AdminButton>
          </div>
        </div>
      </AdminCard>

      <AdminCard title="Linkmeldungen" subtitle="Gemeldete fehlende oder defekte Shop-Links.">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <AdminBadge tone={selected.qa_counts.open_link_report_count > 0 ? 'warn' : 'ok'}>
            {selected.qa_counts.open_link_report_count} offen
          </AdminBadge>
          <AdminBadge tone="neutral">{selected.qa_counts.link_report_count} gesamt</AdminBadge>
        </div>
        {selected.link_reports.length === 0 ? (
          <AdminEmpty>Keine Linkmeldungen für dieses Katalogprodukt.</AdminEmpty>
        ) : (
          <div className="grid gap-2">
            {selected.link_reports.map((report) => (
              <div key={report.id} className="rounded-[var(--admin-r-sm)] border border-[color:var(--admin-line)] bg-[color:var(--admin-bg)] p-3 text-xs">
                <div className="flex flex-wrap items-center gap-2">
                  <AdminBadge tone={report.status === 'open' ? 'warn' : report.status === 'closed' ? 'neutral' : 'info'}>
                    {report.status === 'open' ? 'offen' : report.status === 'closed' ? 'erledigt' : report.status === 'reviewed' ? 'geprüft' : report.status}
                  </AdminBadge>
                  <span className="admin-muted">#{report.id} - {formatDate(report.created_at)}</span>
                  <span className="admin-muted">{report.user_email ?? `Nutzer #${report.user_id}`}</span>
                </div>
                <div className="mt-2 grid gap-2 md:grid-cols-2">
                  <div>
                    <div className="admin-muted">Gemeldet</div>
                    <div className="admin-mono break-all">{report.shop_link_snapshot || '-'}</div>
                  </div>
                  <div>
                    <div className="admin-muted">Aktuell</div>
                    <div className="admin-mono break-all">{report.current_shop_link || '-'}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </AdminCard>
    </div>
  );

  const renderWarnungenTab = (selected: AdminProductDetail, warningList: WarningItem[]) => {
    const hasLegacyWarning = Boolean(selected.warning_title || selected.warning_message || selected.alternative_note);

    return (
      <div className="grid gap-4">
        <AdminCard
          title="Strukturierte Produktwarnungen"
          subtitle="Produktbezogene Warnungen anlegen, bearbeiten und bei Bedarf ausblenden."
          actions={
            editingWarningId ? (
              <AdminButton variant="ghost" size="sm" onClick={handleCancelWarningEdit} disabled={warningSaving}>
                <X size={14} />
                Abbrechen
              </AdminButton>
            ) : null
          }
        >
          <div className="grid gap-3">
            <div className="grid gap-3 rounded-[var(--admin-r-sm)] border border-[color:var(--admin-line)] bg-[color:var(--admin-bg)] p-3 md:grid-cols-[150px_minmax(180px,1fr)]">
              <label className="text-xs font-medium text-[color:var(--admin-ink-2)]">
                Schweregrad
                <select
                  value={warningForm.severity}
                  onChange={(event) => updateWarningField('severity', event.target.value as AdminProductWarningSeverity)}
                  className="admin-select mt-1"
                >
                  <option value="info">Hinweis</option>
                  <option value="caution">Mit Vorsicht</option>
                  <option value="warning">Warnung</option>
                  <option value="danger">Kritisch</option>
                </select>
              </label>
              <label className="text-xs font-medium text-[color:var(--admin-ink-2)]">
                Titel
                <input
                  value={warningForm.title}
                  onChange={(event) => updateWarningField('title', event.target.value)}
                  className="admin-input mt-1"
                  maxLength={255}
                />
              </label>
              <label className="text-xs font-medium text-[color:var(--admin-ink-2)] md:col-span-2">
                Warntext
                <textarea
                  value={warningForm.message}
                  onChange={(event) => updateWarningField('message', event.target.value)}
                  className="admin-input mt-1 min-h-[96px]"
                  maxLength={2000}
                />
              </label>
              <label className="text-xs font-medium text-[color:var(--admin-ink-2)] md:col-span-2">
                Alternative / Hinweis
                <textarea
                  value={warningForm.alternative_note}
                  onChange={(event) => updateWarningField('alternative_note', event.target.value)}
                  className="admin-input mt-1 min-h-[72px]"
                  maxLength={2000}
                />
              </label>
              <div className="flex flex-wrap items-center justify-between gap-3 md:col-span-2">
                <label className="inline-flex items-center gap-2 text-xs font-medium text-[color:var(--admin-ink-2)]">
                  <input
                    type="checkbox"
                    checked={warningForm.active}
                    onChange={(event) => updateWarningField('active', event.target.checked)}
                  />
                  Aktiv
                </label>
                <AdminButton variant="primary" onClick={() => void handleSaveProductWarning()} disabled={warningSaving}>
                  {editingWarningId ? <Save size={15} /> : <Plus size={15} />}
                  {warningSaving ? 'Speichere...' : editingWarningId ? 'Warnung speichern' : 'Warnung erstellen'}
                </AdminButton>
              </div>
            </div>

            {selected.product_warnings.length === 0 ? (
              <AdminEmpty>Keine strukturierten Produktwarnungen vorhanden.</AdminEmpty>
            ) : (
              <div className="grid gap-2">
                {selected.product_warnings.map((warning) => (
                  <article
                    key={warning.id}
                    className="rounded-[var(--admin-r-sm)] border border-[color:var(--admin-line)] bg-[color:var(--admin-bg)] p-3 text-sm"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <AdminBadge tone={productWarningTone(warning)}>
                            {warning.active === 0 ? 'inaktiv' : productWarningSeverityLabel(warning.severity)}
                          </AdminBadge>
                          <span className="font-medium">{warning.title}</span>
                          <span className="admin-muted admin-mono text-xs">#{warning.id}</span>
                        </div>
                        <p className="admin-muted mt-2 whitespace-pre-wrap">{warning.message}</p>
                        {warning.alternative_note ? (
                          <p className="admin-muted mt-2 text-xs whitespace-pre-wrap">Alternative: {warning.alternative_note}</p>
                        ) : null}
                      </div>
                      <div className="flex shrink-0 flex-wrap gap-2">
                        <AdminButton variant="ghost" size="sm" onClick={() => handleEditWarning(warning)} disabled={warningSaving}>
                          <Edit3 size={14} />
                          Bearbeiten
                        </AdminButton>
                        {warning.active !== 0 ? (
                          <AdminButton
                            variant="danger"
                            size="sm"
                            onClick={() => void handleDeactivateProductWarning(warning)}
                            disabled={warningSaving}
                          >
                            <Trash2 size={14} />
                            Deaktivieren
                          </AdminButton>
                        ) : null}
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </div>
        </AdminCard>

        {hasLegacyWarning ? (
          <AdminCard title="Alte Warnfelder" subtitle="Ältere Warntexte, die noch am Produkt gespeichert sind.">
            <div className="rounded-[var(--admin-r-sm)] border border-[color:var(--admin-line)] bg-[color:var(--admin-bg)] p-3 text-sm">
              <div className="flex flex-wrap items-center gap-2">
                <AdminBadge tone={selected.warning_type === 'danger' ? 'danger' : 'warn'}>{selected.warning_type === 'danger' ? 'Kritisch' : selected.warning_type === 'info' ? 'Hinweis' : 'Mit Vorsicht'}</AdminBadge>
                <p className="font-medium">{selected.warning_title || 'Produktwarnung'}</p>
              </div>
              {selected.warning_message ? <p className="admin-muted mt-2 whitespace-pre-wrap">{selected.warning_message}</p> : null}
              {selected.alternative_note ? <p className="admin-muted mt-2 text-xs whitespace-pre-wrap">Alternative: {selected.alternative_note}</p> : null}
            </div>
          </AdminCard>
        ) : null}

        <AdminCard title="Abgeleitete Warnsignale" subtitle="Prüfhinweise und aktive Wirkstoff-Sicherheitswarnungen.">
          {warningList.length === 0 ? (
            <AdminEmpty>Keine abgeleiteten Warnsignale im aktuellen Datensatz.</AdminEmpty>
          ) : (
            <div className="flex flex-wrap gap-2">
              {warningList.map((entry, index) => (
                <AdminBadge key={`${entry.label}-${index}`} tone={entry.tone}>
                  {entry.label}
                </AdminBadge>
              ))}
            </div>
          )}
          <div className="mt-4 grid gap-3">
            {selected.warnings.length === 0 ? (
              <AdminEmpty>Keine aktiven Sicherheitswarnungen für die Wirkstoffzeilen.</AdminEmpty>
            ) : (
              selected.warnings.map((warning) => (
                <article key={warning.id} className="rounded-[var(--admin-r-sm)] border border-[color:var(--admin-line)] bg-[color:var(--admin-bg)] p-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <AdminBadge tone={safetyWarningTone(warning)}>{productWarningSeverityLabel(warning.severity)}</AdminBadge>
                    <span className="font-medium">{warning.short_label}</span>
                  </div>
                  {warning.popover_text ? <p className="admin-muted mt-2 text-sm">{warning.popover_text}</p> : null}
                  {warning.article_url ? (
                    <Link to={warning.article_url} className="admin-btn admin-btn-sm admin-btn-ghost mt-3">
                      Artikel öffnen
                    </Link>
                  ) : null}
                </article>
              ))
            )}
          </div>
        </AdminCard>
      </div>
    );
  };

  return (
    <>
      <div className="mb-4">
        <Link to="/administrator/products" className="admin-btn admin-btn-ghost">
          <ArrowLeft size={14} />
          Zurück zur Produktliste
        </Link>
      </div>

      <AdminPageHeader
        title={product ? product.name : `Produkt #${id || ''}`}
        subtitle={product ? 'Produktdaten, Links, Wirkstoffe und Warnungen bearbeiten.' : 'Lade Produktdaten'}
        meta={
          product ? (
            <div className="flex flex-wrap items-center gap-2">
              <AdminBadge tone={ownerTone(product)}>{`Link: ${ownerLabel(product)}`}</AdminBadge>
              <AdminBadge tone="neutral">{`ID: ${product.id}`}</AdminBadge>
              <AdminBadge tone={moderationTone(product.moderation_status)}>{`Freigabe: ${moderationStatusLabel(product.moderation_status)}`}</AdminBadge>
              <AdminBadge tone={visibilityTone(product.visibility)}>{`Sichtbarkeit: ${visibilityLabel(product.visibility)}`}</AdminBadge>
            </div>
          ) : (
            <AdminBadge tone="info">Detail</AdminBadge>
          )
        }
      />

      <div className="mb-4 admin-toolbar">
        <div className="admin-toolbar-inline">
          <AdminButton variant="primary" onClick={() => void loadProduct()} disabled={loading}>
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            Aktualisieren
          </AdminButton>
        </div>
      </div>

      <div className="mb-3 flex flex-wrap gap-2" role="tablist" aria-label="Product detail tabs">
        {TAB_OPTIONS.map((tab) => (
          <button
            key={tab.key}
            type="button"
            role="tab"
            aria-selected={activeTab === tab.key}
            onClick={() => handleTabChange(tab.key)}
            className={`admin-btn admin-btn-sm ${activeTab === tab.key ? 'admin-btn-primary' : 'admin-btn-ghost'}`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {loading ? (
        <AdminEmpty>
          <Loader2 size={15} className="mr-2 inline animate-spin" />
          Lade Produkt...
        </AdminEmpty>
      ) : null}
      {error ? <AdminError>{error}</AdminError> : null}
      {message ? (
        <div className="rounded-[var(--admin-r-sm)] border border-[color:var(--admin-success-soft)] bg-[color:var(--admin-success-soft)] px-3 py-2 text-[color:var(--admin-success-ink)] text-sm">
          {message}
        </div>
      ) : null}

      {!loading && product ? (
        <div>
          {activeTab === 'overview' && renderOverviewTab(product)}
          {activeTab === 'wirkstoffe' && renderWirkstoffeTab(product)}
          {activeTab === 'moderation' && renderModerationTab(product)}
          {activeTab === 'affiliate' && renderShopLinksTab(product)}
          {activeTab === 'warnungen' && renderWarnungenTab(product, warnings)}
        </div>
      ) : null}

      {!loading && !product ? (
        <AdminCard title="Kein Datensatz">
          <p className="admin-muted text-sm">Für diese Produkt-ID sind keine Detaildaten vorhanden.</p>
        </AdminCard>
      ) : null}

      {imageCropOpen && product ? (
        <ImageCropModal
          productId={product.id}
          uploadEndpoint={`/api/admin/products/${product.id}/image`}
          uploadVersion={product.version ?? null}
          currentImageUrl={product.image_url ?? undefined}
          onSuccess={() => { void handleImageUploadSuccess(); }}
          onError={(messageValue) => setError(messageValue)}
          onClose={() => setImageCropOpen(false)}
        />
      ) : null}
    </>
  );
}
