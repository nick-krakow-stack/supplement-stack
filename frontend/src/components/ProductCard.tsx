import { useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, BookOpen, ExternalLink, Flag, Info, Pencil, RefreshCcw, Trash2 } from 'lucide-react';
import type { ShopDomain } from '../types/local';
import type { ProductSafetyWarning } from '../types';
import {
  calculateProductUsage,
  ingredientAmountPerProductServing,
  intakeIntervalDays as getIntakeIntervalDays,
} from '../lib/stackCalculations';

interface ProductCardProduct {
  id: number;
  product_type?: 'catalog' | 'user_product';
  name: string;
  brand?: string;
  price: number;
  shop_link?: string;
  click_url?: string;
  image_url?: string;
  visibility?: string;
  moderation_status?: string;
  is_affiliate?: number;
  discontinued_at?: string;
  servings_per_container?: number;
  container_count?: number;
  serving_size?: number;
  serving_unit?: string;
  form?: string;
  quantity?: number;
  unit?: string;
  basis_quantity?: number | null;
  basis_unit?: string | null;
  product_price?: number;
  product_name?: string;
  product_brand?: string;
  timing?: string;
  dosage_text?: string;
  intake_interval_days?: number;
  ingredient_effect_summary?: string | null;
  ingredient_timing?: string | null;
  ingredient_timing_note?: string | null;
  ingredient_intake_hint?: string | null;
  ingredients?: Array<{
    ingredient_id: number;
    quantity?: number | null;
    unit?: string | null;
    basis_quantity?: number | null;
    basis_unit?: string | null;
    search_relevant?: number | boolean;
  }>;
  effect_summary?: string;
  warning_title?: string;
  warning_message?: string;
  warning_type?: string;
  alternative_note?: string;
  warnings?: ProductSafetyWarning[];
  ingredient_category?: string;
}

interface ProductWarning {
  title?: string;
  message: string;
  type?: 'danger' | 'caution' | 'info' | string;
  shortLabel?: string;
}

interface ProductCardProps {
  product: ProductCardProduct;
  onSelect?: () => void;
  onToggleSelected?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  onReportMissingLink?: (product: ProductCardProduct, reason: 'missing_link' | 'invalid_link') => void;
  recommendationType?: 'recommended' | 'alternative' | null;
  showSelectButton?: boolean;
  shopDomains?: ShopDomain[];
  selected?: boolean;
  warning?: ProductWarning | null;
  compact?: boolean;
  display?: 'card' | 'list';
}

function formatEur(value: number): string {
  return value.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' \u20ac';
}

function formatAmount(value: number): string {
  return new Intl.NumberFormat('de-DE', { maximumFractionDigits: 6 }).format(value);
}

function formatCompactAmount(value: number): string {
  return new Intl.NumberFormat('de-DE', { maximumFractionDigits: 2 }).format(value);
}

function effectPoints(value?: string | null): string[] {
  return (value ?? '')
    .split(/[,;]+/)
    .map((part) => part.trim())
    .filter(Boolean)
    .slice(0, 4);
}

function unitLabel(unit?: string, amount?: number): string {
  const normalized = (unit ?? '').replace(/\bIU\b/gi, 'IE').replace(/\biu\b/g, 'IE').trim();
  const singular = amount == null || Math.abs(amount - 1) < 0.001;
  switch (normalized.toLowerCase()) {
    case 'kapsel':
    case 'kapseln':
      return singular ? 'Kapsel' : 'Kapseln';
    case 'tablette':
    case 'tabletten':
      return singular ? 'Tablette' : 'Tabletten';
    case 'softgel':
    case 'softgels':
      return singular ? 'Softgel' : 'Softgels';
    case 'tropfen':
      return 'Tropfen';
    case 'portion':
    case 'portionen':
      return singular ? 'Portion' : 'Portionen';
    default:
      return normalized;
  }
}

function calcMonthlyPrice(product: ProductCardProduct, price: number): number | null {
  return calculateProductUsage(product, price).monthlyCost;
}

function getDaysSupply(product: ProductCardProduct): number | null {
  return calculateProductUsage(product).daysSupply;
}

function getDose(product: ProductCardProduct): string {
  if (product.dosage_text) return product.dosage_text;
  if (product.quantity && product.unit) return `${formatAmount(product.quantity)} ${unitLabel(product.unit, product.quantity)}`;
  if (product.serving_size && product.serving_unit) return `${formatAmount(product.serving_size)} ${unitLabel(product.serving_unit, product.serving_size)}`;
  return '\u2014';
}

function isSearchRelevant(ingredient: NonNullable<ProductCardProduct['ingredients']>[number]): boolean {
  return ingredient.search_relevant === undefined || ingredient.search_relevant === true || ingredient.search_relevant === 1;
}

function isCountUnit(unit?: string | null): boolean {
  const normalized = (unit ?? '').trim().toLowerCase();
  return ['kapsel', 'kapseln', 'tablette', 'tabletten', 'softgel', 'softgels', 'tropfen', 'portion', 'portionen'].includes(normalized);
}

function reliableServingUnit(product: ProductCardProduct): string | null {
  const servingUnit = product.serving_unit?.trim();
  if (servingUnit && isCountUnit(servingUnit)) return servingUnit;
  const productUnit = product.unit?.trim();
  if (productUnit && isCountUnit(productUnit)) return productUnit;
  return null;
}

function hasManualCountQuantity(product: ProductCardProduct): boolean {
  if (typeof product.quantity !== 'number' || !Number.isFinite(product.quantity) || product.quantity <= 0) return false;
  const productUnit = product.unit?.trim();
  return !productUnit || isCountUnit(productUnit);
}

function primaryContentAmount(product: ProductCardProduct, servingsPerDay: number): { amount: number; unit: string } | null {
  const ingredient = product.ingredients?.find(isSearchRelevant) ?? product.ingredients?.[0];
  if (ingredient?.unit) {
    const amountPerServing = ingredientAmountPerProductServing(ingredient, product);
    if (amountPerServing != null && amountPerServing > 0) {
      return { amount: amountPerServing * servingsPerDay, unit: ingredient.unit };
    }
  }

  if (product.quantity && product.unit && !isCountUnit(product.unit)) {
    return { amount: product.quantity * servingsPerDay, unit: product.unit };
  }

  return null;
}

function getListDoseFallback(product: ProductCardProduct): string {
  return getDose(product);
}

function getListDose(product: ProductCardProduct): string {
  const usage = calculateProductUsage(product);
  const hasReliableDailyAmount = usage.calculationSource === 'target_dose'
    || (usage.calculationSource === 'manual_quantity' && hasManualCountQuantity(product));
  if (!hasReliableDailyAmount) return getListDoseFallback(product);

  const interval = getIntakeIntervalDays(product);
  const servingsPerDay = interval > 1 ? usage.effectiveDailyUsage : usage.servingsPerIntake;
  const servingUnit = reliableServingUnit(product);
  const content = primaryContentAmount(product, servingsPerDay);
  const contentLabel = content ? ` (${formatCompactAmount(content.amount)} ${unitLabel(content.unit, content.amount)})` : '';

  if (servingsPerDay > 0 && servingUnit) {
    return `${formatCompactAmount(servingsPerDay)} ${unitLabel(servingUnit, servingsPerDay)}${contentLabel} pro Tag`;
  }

  return getListDoseFallback(product);
}

type TimingKey = 'morning' | 'evening' | 'noon' | 'trial' | 'anytime';

function getTimingKey(timing?: string): TimingKey {
  const t = (timing ?? '').toLowerCase();
  if (t.includes('morgen') || t.includes('morning') || t.includes('fr\u00fch')) return 'morning';
  if (t.includes('abend') || t.includes('evening') || t.includes('nacht')) return 'evening';
  if (t.includes('mittag') || t.includes('noon')) return 'noon';
  if (t.includes('probe') || t.includes('trial') || t.includes('test')) return 'trial';
  return 'anytime';
}

function getListTimingPanelKey(timing?: string): TimingKey | 'meal' {
  const t = (timing ?? '').toLowerCase();
  if (t.includes('mahlzeit') || t.includes('meal') || t.includes('essen')) return 'meal';
  return getTimingKey(timing);
}

const TIMING_STYLES: Record<TimingKey, { cls: string; label: string }> = {
  morning: { cls: 'bg-[#fef3c7] text-[#d97706]', label: 'Zum Fr\u00fchst\u00fcck' },
  evening: { cls: 'bg-[#ede9fe] text-[#7c3aed]', label: 'Zum Abendessen' },
  noon:    { cls: 'bg-[#dcfce7] text-[#16a34a]', label: 'Mittags' },
  trial:   { cls: 'bg-[#fee2e2] text-[#dc2626] border border-dashed border-[#fca5a5]', label: 'Zum Probieren' },
  anytime: { cls: 'bg-[#e0f2fe] text-[#0284c7]', label: 'Jederzeit' },
};

type CategoryKey = 'vitamin' | 'mineral' | 'omega' | 'protein' | 'default';

function getCategory(product: ProductCardProduct): CategoryKey {
  const hay = `${product.ingredient_category ?? ''} ${product.form ?? ''} ${product.name}`.toLowerCase();
  if (hay.includes('vitamin')) return 'vitamin';
  if (hay.includes('mineral') || hay.includes('magnesium') || hay.includes('zink') || hay.includes('calcium') || hay.includes('selen') || hay.includes('jod') || hay.includes('eisen')) return 'mineral';
  if (hay.includes('omega') || hay.includes('fisch\u00f6l') || hay.includes('fish') || hay.includes('dha') || hay.includes('epa')) return 'omega';
  if (hay.includes('protein') || hay.includes('kreatin') || hay.includes('bcaa')) return 'protein';
  return 'default';
}

const CATEGORY_EMOJI: Record<CategoryKey, string> = {
  vitamin: '\u2600\ufe0f',
  mineral: '\u25cf',
  omega: '\u03a9',
  protein: '\u26a1',
  default: '\u2733',
};

const SAFETY_WARNING_STYLES: Record<ProductSafetyWarning['severity'], string> = {
  danger: 'border-red-200 bg-red-50 text-red-700',
  caution: 'border-amber-200 bg-amber-50 text-amber-700',
  info: 'border-sky-200 bg-sky-50 text-sky-700',
};

function getFallbackWarning(product: ProductCardProduct): ProductWarning | null {
  const t = product.name.toLowerCase();
  if (t.includes('b12')) return { type: 'caution', title: 'Einnahmeabstand pr\u00fcfen', shortLabel: '20-30min Abstand zu Kaffee/Tee', message: 'Kaffee oder Tee werden in Quellen im Zusammenhang mit m\u00f6glicher geringerer Aufnahme einzelner N\u00e4hrstoffe diskutiert. Ein zeitlicher Abstand kann sinnvoll sein.' };
  if (t.includes('jod')) return { type: 'danger', title: 'Schilddr\u00fcsenkontext beachten', message: 'Bei Schilddr\u00fcsenerkrankungen, Jodmedikation oder unklarer Versorgung sollte Jod nur nach \u00e4rztlicher R\u00fccksprache erg\u00e4nzt werden.' };
  return null;
}

function compactWarningLabel(product: ProductCardProduct, warning: ProductWarning | null): string | null {
  const safetyLabel = product.warnings?.find((item) => item.short_label.trim())?.short_label.trim();
  if (safetyLabel) return safetyLabel;
  if (!warning) return null;
  if (warning.shortLabel) return warning.shortLabel;
  const combined = `${warning.title ?? ''} ${warning.message}`.toLowerCase();
  if (combined.includes('kaffee') || combined.includes('tee')) return '20-30min Abstand zu Kaffee/Tee';
  const source = warning.title?.trim() || warning.message.trim();
  const firstSentence = source.split(/[.!?]/).map((part) => part.trim()).find(Boolean) ?? source;
  return firstSentence.length > 72 ? `${firstSentence.slice(0, 69).trimEnd()}...` : firstSentence;
}

function normalizeShopHostname(value?: string): string | null {
  const raw = value?.trim().toLowerCase();
  if (!raw) return null;
  const withScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(raw) ? raw : `https://${raw}`;
  try {
    const url = new URL(withScheme);
    const hostname = url.hostname.toLowerCase().replace(/\.$/, '');
    if (!hostname || hostname.includes('..')) return null;
    return hostname;
  } catch {
    return null;
  }
}

function normalizeShopHref(value?: string): string | null {
  const raw = value?.trim();
  if (!raw) return null;
  const withScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(raw) ? raw : `https://${raw}`;
  try {
    const url = new URL(withScheme);
    if (!['http:', 'https:'].includes(url.protocol)) return null;
    if (!url.hostname || url.hostname.includes('..')) return null;
    return url.toString();
  } catch {
    return null;
  }
}

function shopHostMatchesDomain(hostname: string, domain: string): boolean {
  return hostname === domain || hostname.endsWith(`.${domain}`);
}

export default function ProductCard({
  product, onSelect, onToggleSelected, onEdit, onDelete,
  onReportMissingLink,
  recommendationType, showSelectButton = false,
  shopDomains, selected = false, warning, display = 'card',
}: ProductCardProps) {
  const [openSafetyWarningId, setOpenSafetyWarningId] = useState<number | null>(null);
  const price = product.product_price ?? product.price;
  const brand = product.product_brand ?? product.brand;
  const name = product.product_name ?? product.name;
  const category = getCategory(product);
  const emoji = CATEGORY_EMOJI[category];

  const effectiveTiming = product.ingredient_timing?.trim() || product.timing;
  const timingKey = getTimingKey(effectiveTiming);
  const timing = TIMING_STYLES[timingKey];

  const productHost = normalizeShopHostname(product.shop_link);
  const directShopHref = normalizeShopHref(product.shop_link);
  const shopHref = directShopHref
    ? product.click_url ?? (product.product_type === 'user_product' ? directShopHref : `/api/products/${product.id}/out?context=product_card`)
    : null;
  const matchedShop = productHost
    ? shopDomains?.find((s) => {
        const domain = normalizeShopHostname(s.domain);
        return domain ? shopHostMatchesDomain(productHost, domain) : false;
      })
    : undefined;
  const shopName = matchedShop?.display_name ?? null;
  const buttonText = shopName ? `Bei ${shopName} kaufen` : 'Jetzt kaufen';
  const reportReason: 'missing_link' | 'invalid_link' = product.shop_link ? 'invalid_link' : 'missing_link';

  const monthlyPrice = calcMonthlyPrice(product, price);
  const daysSupply = getDaysSupply(product);
  const dose = getDose(product);
  const effectText = product.ingredient_effect_summary?.trim() ?? product.effect_summary?.trim() ?? '';
  const effects = effectPoints(effectText);
  const intervalDays = getIntakeIntervalDays(product);
  const intervalLabel = intervalDays === 1 ? 't\u00e4glich' : `alle ${intervalDays} Tage`;
  const showInterval = product.intake_interval_days != null;

  const productWarning = product.warning_message
    ? { title: product.warning_title, message: product.warning_message, type: product.warning_type ?? 'caution' }
    : null;
  const cardWarning = warning ?? productWarning ?? getFallbackWarning(product);
  const cardWarningLabel = cardWarning ? compactWarningLabel(product, cardWarning) : null;

  if (display === 'list') {
    const listDose = getListDose(product);
    const listWarning = compactWarningLabel(product, cardWarning);
    const timingPanelKey = getListTimingPanelKey(effectiveTiming);
    const timingLabel = effectiveTiming ? effectiveTiming : timing.label;

    return (
      <article
        onClick={onToggleSelected}
        className={`ss-product-card ss-product-list-row ${selected ? 'ss-product-list-row-selected' : ''}`}
      >
        <div className={`ss-product-list-media ss-product-list-media-${timingPanelKey}`}>
          {product.image_url ? (
            <img
              src={product.image_url}
              alt={name}
              onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
            />
          ) : (
            <span>{emoji}</span>
          )}
          <span className="ss-product-list-timing-caption">{timingLabel}</span>
        </div>

        <div className="ss-product-list-content">
          <div className="ss-product-list-top">
            {(onToggleSelected ?? onSelect) && (
              <span className={`ss-product-list-check ${selected ? 'selected' : ''}`} aria-hidden="true">
                {selected && (
                  <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
                    <polyline points="1.5,5.5 4.5,8.5 9.5,2.5" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                )}
              </span>
            )}
            {brand && <span className="ss-product-list-brand">{brand}</span>}
          </div>
          <div className="ss-product-list-title">{name}</div>
          <div className="ss-product-list-meta">
            <span className={`ss-product-list-timing ${timing.cls}`}>
              {timingLabel}
            </span>
            <span className="ss-product-list-meta-item">
              <span>Dosierung</span>
              {listDose}
            </span>
            <span className="ss-product-list-meta-item">
              <span>Reicht f\u00fcr</span>
              {daysSupply ? `${daysSupply} Tage` : 'unbekannt'}
            </span>
            {showInterval && (
              <span className="ss-product-list-meta-item">
                <span>Intervall</span>
                {intervalLabel}
              </span>
            )}
            {listWarning && (
              <span className="ss-product-list-warning">
                <AlertTriangle size={13} />
                <span>{listWarning}</span>
              </span>
            )}
          </div>
        </div>

        <div className="ss-product-list-actions-panel">
          <div className="ss-product-list-price">
            <strong>{formatEur(price)}</strong>
            {monthlyPrice !== null && <span>{formatEur(monthlyPrice)} pro Monat</span>}
          </div>

          <div className="ss-product-list-actions">
            {shopHref && (
              <a
                href={shopHref}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                aria-label={`${buttonText}: ${name}`}
                className="ss-product-list-buy"
              >
                <ExternalLink size={14} />
                <span>{buttonText}</span>
              </a>
            )}
            {!shopHref && onReportMissingLink && (
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onReportMissingLink(product, reportReason); }}
                aria-label={`Fehlenden oder defekten Link melden: ${name}`}
                className="ss-product-list-report"
              >
                <Flag size={14} />
                <span>Link melden</span>
              </button>
            )}
            {onEdit && (
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onEdit(); }}
                aria-label="Produkt bearbeiten"
                title="Produkt bearbeiten"
                className="ss-product-list-icon-btn ss-product-list-edit"
              >
                <Pencil size={15} />
              </button>
            )}
            {onDelete && (
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onDelete(); }}
                aria-label="Produkt entfernen"
                title="Produkt entfernen"
                className="ss-product-list-icon-btn ss-product-list-delete"
              >
                <Trash2 size={15} />
              </button>
            )}
            {showSelectButton && onSelect && (
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onSelect(); }}
                className="ss-product-list-alt"
              >
                Alternative
              </button>
            )}
          </div>
        </div>
      </article>
    );
  }

  return (
    <article
      onClick={onToggleSelected}
      style={{
        borderRadius: '14px',
        padding: '14px',
        border: `2px solid ${selected ? '#6366f1' : 'transparent'}`,
        boxShadow: selected
          ? '0 4px 20px rgba(99,102,241,0.2)'
          : '0 2px 12px rgba(99,102,241,0.08), 0 1px 3px rgba(0,0,0,0.04)',
      }}
      className="ss-product-card relative flex flex-col bg-white cursor-pointer transition-all duration-150 hover:-translate-y-px"
    >
      {/* Checkbox */}
      {(onToggleSelected ?? onSelect) && (
        <div className={`absolute top-3 right-3 z-10 flex h-5 w-5 items-center justify-center rounded-md border-2 transition-colors ${
          selected ? 'bg-indigo-500 border-indigo-500 text-white' : 'bg-white border-slate-300'
        }`}>
          {selected && (
            <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
              <polyline points="1.5,5.5 4.5,8.5 9.5,2.5" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          )}
        </div>
      )}

      {/* Card top */}
      <div className="ss-product-card-top flex items-start gap-[11px] mb-3">
        {/* Image / emoji */}
        {product.image_url ? (
          <img
            src={product.image_url}
            alt={name}
            className="w-[52px] h-[52px] shrink-0 rounded-[10px] border border-[#e5e7eb] bg-[#f3f4f6] object-cover"
            onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
          />
        ) : (
          <div
            className="w-[52px] h-[52px] shrink-0 rounded-[10px] border border-[#e5e7eb] bg-[#f3f4f6] flex items-center justify-center select-none"
            style={{ fontSize: '22px' }}
          >
            {emoji}
          </div>
        )}

        {/* Name + brand + timing */}
        <div className="flex-1 min-w-0 pr-6">
          {brand && (
            <div className="text-[10px] font-bold tracking-[0.8px] text-slate-400 uppercase mb-0.5">
              {brand}
            </div>
          )}
          <div className="text-[13.5px] font-extrabold text-slate-900 leading-snug mb-1.5">
            {name}
          </div>
          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-extrabold ${timing.cls}`}>
            {effectiveTiming ? effectiveTiming : timing.label}
          </span>
          {recommendationType && (
            <span className={`ml-1 inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-extrabold ${
              recommendationType === 'recommended' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-indigo-50 text-indigo-700 border border-indigo-200'
            }`}>
              {recommendationType === 'recommended' ? 'Passend' : 'Alternative'}
            </span>
          )}
        </div>
      </div>

      {/* Meta grid */}
      <div className="ss-product-card-meta grid grid-cols-2 gap-2 mb-2.5">
        <div>
          <div className="text-[10px] font-bold uppercase tracking-[0.4px] text-slate-400 mb-0.5">Dosierung</div>
          <div className="text-[12.5px] font-bold text-slate-700">{dose}</div>
          {showInterval && <div className="mt-0.5 text-[11px] font-semibold text-slate-500">{intervalLabel}</div>}
        </div>
        <div>
          <div className="text-[10px] font-bold uppercase tracking-[0.4px] text-slate-400 mb-0.5">Reicht f&uuml;r</div>
          <div className="text-[12.5px] font-bold text-slate-700">
            {daysSupply ? `${daysSupply} Tage` : '\u2014'}
          </div>
        </div>
      </div>

      {/* Effect */}
      {effectText && (
        <div className="ss-product-card-effect mb-2.5">
          <div className="text-[10px] font-bold uppercase tracking-[0.4px] text-slate-400 mb-1">Wirkung</div>
          {effects.length > 1 ? (
            <div className="ss-effect-points">
              {effects.map((effect) => (
                <span key={effect}>{effect}</span>
              ))}
            </div>
          ) : (
            <div className="text-[12px] text-slate-500 leading-relaxed font-medium">
              {effectText}
            </div>
          )}
        </div>
      )}

      {/* Discontinued */}
      {product.discontinued_at && (
        <div className="ss-product-card-note flex items-center gap-1.5 rounded-lg bg-slate-100 px-2.5 py-1.5 text-xs text-slate-500 mb-2.5">
          <RefreshCcw size={12} className="shrink-0" />
          Eingestellt &mdash; Alternative w&auml;hlen
        </div>
      )}

      {/* Alternative note */}
      {product.alternative_note && (
        <div className="ss-product-card-note rounded-lg border border-indigo-100 bg-indigo-50 px-2.5 py-1.5 text-xs leading-relaxed text-indigo-700 mb-2.5">
          <span className="font-bold">Alternative:</span> {product.alternative_note}
        </div>
      )}

      {/* Ingredient safety warnings */}
      {product.warnings && product.warnings.length > 0 && (
        <div className="ss-product-card-warnings mb-2.5 flex flex-wrap gap-1.5">
          {product.warnings.map((safetyWarning) => {
            const isOpen = openSafetyWarningId === safetyWarning.id;
            const popoverId = `safety-warning-${product.id}-${safetyWarning.id}`;
            return (
              <span
                key={safetyWarning.id}
                className={`group relative inline-flex max-w-full items-center gap-1.5 rounded-full border px-2 py-1 text-[11px] font-extrabold ${SAFETY_WARNING_STYLES[safetyWarning.severity]}`}
                onClick={(e) => e.stopPropagation()}
                onBlur={(e) => {
                  if (!e.currentTarget.contains(e.relatedTarget as Node | null)) {
                    setOpenSafetyWarningId(null);
                  }
                }}
              >
                <span className="truncate">{safetyWarning.short_label}</span>
                <button
                  type="button"
                  aria-label={`Mehr Informationen: ${safetyWarning.short_label}`}
                  aria-expanded={isOpen}
                  aria-describedby={popoverId}
                  className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full transition-colors hover:bg-white/70 focus:outline-none focus:ring-2 focus:ring-current focus:ring-offset-1"
                  onClick={(e) => {
                    e.stopPropagation();
                    setOpenSafetyWarningId(isOpen ? null : safetyWarning.id);
                  }}
                  onFocus={() => setOpenSafetyWarningId(safetyWarning.id)}
                >
                  <Info size={13} />
                </button>
                {safetyWarning.article_url && (
                  <Link
                    to={safetyWarning.article_url}
                    aria-label={safetyWarning.article_title ?? 'Wissensartikel \u00f6ffnen'}
                    title={safetyWarning.article_title ?? 'Wissensartikel \u00f6ffnen'}
                    className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full transition-colors hover:bg-white/70 focus:outline-none focus:ring-2 focus:ring-current focus:ring-offset-1"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <BookOpen size={13} />
                  </Link>
                )}
                <span
                  id={popoverId}
                  role="tooltip"
                  className={`absolute left-0 top-full z-30 mt-2 w-[260px] max-w-[calc(100vw-3rem)] rounded-xl border border-slate-200 bg-white p-3 text-left text-[12px] font-semibold leading-relaxed text-slate-700 shadow-xl transition-all group-hover:pointer-events-auto group-hover:translate-y-0 group-hover:opacity-100 group-focus-within:pointer-events-auto group-focus-within:translate-y-0 group-focus-within:opacity-100 ${
                    isOpen ? 'pointer-events-auto translate-y-0 opacity-100' : 'pointer-events-none translate-y-1 opacity-0'
                  }`}
                >
                  {safetyWarning.popover_text}
                </span>
              </span>
            );
          })}
        </div>
      )}

      {/* Compact warning */}
      {cardWarningLabel && (
        <div className="ss-product-card-compact-warning mb-2.5">
          <AlertTriangle size={13} className="shrink-0" />
          <span>{cardWarningLabel}</span>
        </div>
      )}

      {/* Price row */}
      <div className="ss-product-card-price flex items-center justify-between pt-2.5 border-t border-slate-100 mb-2.5">
        <span className="text-[18px] font-black text-slate-900">{formatEur(price)}</span>
        {monthlyPrice !== null && (
          <span className="bg-emerald-500 text-white px-2.5 py-0.5 rounded-full text-[12px] font-extrabold">
            {formatEur(monthlyPrice)}/Mo
          </span>
        )}
      </div>

      {/* Actions */}
      <div className="ss-product-card-actions flex gap-[7px]">
        {shopHref && (
          <a
            href={shopHref}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="flex-1 inline-flex min-h-11 items-center justify-center gap-1.5 rounded-[10px] py-[9px] text-[12.5px] font-bold text-white transition-colors"
            style={{ background: '#3b82f6' }}
            onMouseEnter={(e) => (e.currentTarget.style.background = '#2563eb')}
            onMouseLeave={(e) => (e.currentTarget.style.background = '#3b82f6')}
          >
            <ExternalLink size={13} />
            {buttonText}
          </a>
        )}
        {!shopHref && onReportMissingLink && (
          <button
            onClick={(e) => { e.stopPropagation(); onReportMissingLink(product, reportReason); }}
            className="flex-1 inline-flex min-h-11 items-center justify-center gap-1.5 rounded-[10px] border border-amber-200 bg-amber-50 px-3 py-2 text-[12.5px] font-bold text-amber-700 transition-colors hover:bg-amber-100"
          >
            <Flag size={13} />
            Link melden
          </button>
        )}
        {onEdit && (
          <button
            onClick={(e) => { e.stopPropagation(); onEdit(); }}
            aria-label="Produkt bearbeiten"
            className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-[10px] transition-colors"
            style={{ background: '#fef3c7', border: '1.5px solid #fbbf24', color: '#b45309' }}
            onMouseEnter={(e) => { e.currentTarget.style.background = '#fde68a'; e.currentTarget.style.borderColor = '#f59e0b'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = '#fef3c7'; e.currentTarget.style.borderColor = '#fbbf24'; }}
          >
            <Pencil size={15} />
          </button>
        )}
        {onDelete && (
          <button
            onClick={(e) => { e.stopPropagation(); onDelete(); }}
            aria-label="Produkt entfernen"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[10px] transition-colors"
            style={{ background: '#fee2e2', border: '1.5px solid #fca5a5', color: '#dc2626' }}
            onMouseEnter={(e) => { e.currentTarget.style.background = '#fecaca'; e.currentTarget.style.borderColor = '#f87171'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = '#fee2e2'; e.currentTarget.style.borderColor = '#fca5a5'; }}
          >
            <Trash2 size={15} />
          </button>
        )}
        {showSelectButton && onSelect && (
          <button
            onClick={(e) => { e.stopPropagation(); onSelect(); }}
            className="min-h-11 flex-1 rounded-[10px] border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-600 transition-colors hover:bg-slate-50"
          >
            Alternative
          </button>
        )}
      </div>
    </article>
  );
}
