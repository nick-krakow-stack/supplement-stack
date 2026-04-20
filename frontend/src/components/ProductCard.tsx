import { AlertTriangle, ExternalLink, RefreshCcw } from 'lucide-react';
import type { ShopDomain } from '../types/local';

interface ProductCardProduct {
  id: number;
  name: string;
  brand?: string;
  price: number;
  shop_link?: string;
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
  product_price?: number;
  product_name?: string;
  product_brand?: string;
  timing?: string;
  dosage_text?: string;
  effect_summary?: string;
  warning_title?: string;
  warning_message?: string;
  warning_type?: string;
  alternative_note?: string;
  ingredient_category?: string;
}

interface ProductWarning {
  title?: string;
  message: string;
  type?: 'danger' | 'caution' | 'info' | string;
}

interface ProductCardProps {
  product: ProductCardProduct;
  onAddToWishlist?: () => void;
  onSelect?: () => void;
  onToggleSelected?: () => void;
  recommendationType?: 'recommended' | 'alternative' | null;
  showWishlistButton?: boolean;
  showSelectButton?: boolean;
  shopDomains?: ShopDomain[];
  selected?: boolean;
  warning?: ProductWarning | null;
  compact?: boolean;
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('de-DE', {
    style: 'currency',
    currency: 'EUR',
  }).format(value);
}

function calcMonthlyPrice(
  price: number,
  servingsPerContainer?: number,
  containerCount?: number,
): number | null {
  const total = (servingsPerContainer ?? 0) * (containerCount ?? 1);
  if (total <= 0) return null;
  return (price / total) * 30;
}

function getDaysSupply(
  servingsPerContainer?: number,
  containerCount?: number,
  portionsPerDay = 1,
): number | null {
  const total = (servingsPerContainer ?? 0) * (containerCount ?? 1);
  if (total <= 0) return null;
  return Math.round(total / Math.max(portionsPerDay, 0.001));
}

function getDose(product: ProductCardProduct): string {
  if (product.dosage_text) return product.dosage_text;
  if (product.quantity && product.unit) {
    return `${product.quantity} ${product.unit}`;
  }
  if (product.serving_size && product.serving_unit) {
    return `${product.serving_size} ${product.serving_unit}`;
  }
  return 'Nach Empfehlung';
}

type CategoryKey = 'vitamin' | 'mineral' | 'omega' | 'default';

function getCategory(product: ProductCardProduct): CategoryKey {
  const hay = `${product.ingredient_category ?? ''} ${product.form ?? ''} ${product.name}`.toLowerCase();
  if (hay.includes('vitamin')) return 'vitamin';
  if (
    hay.includes('mineral') ||
    hay.includes('magnesium') ||
    hay.includes('zink') ||
    hay.includes('zinc') ||
    hay.includes('eisen') ||
    hay.includes('kalzium') ||
    hay.includes('calcium') ||
    hay.includes('selen') ||
    hay.includes('jod') ||
    hay.includes('iodine')
  )
    return 'mineral';
  if (
    hay.includes('omega') ||
    hay.includes('fischöl') ||
    hay.includes('fischoel') ||
    hay.includes('fish oil') ||
    hay.includes('dha') ||
    hay.includes('epa')
  )
    return 'omega';
  return 'default';
}

const CATEGORY_BORDER: Record<CategoryKey, string> = {
  vitamin: 'border-l-4 border-l-amber-400',
  mineral: 'border-l-4 border-l-emerald-400',
  omega: 'border-l-4 border-l-blue-400',
  default: 'border-l-4 border-l-indigo-400',
};

const CATEGORY_INITIALS_BG: Record<CategoryKey, string> = {
  vitamin: 'bg-amber-100 text-amber-700',
  mineral: 'bg-emerald-100 text-emerald-700',
  omega: 'bg-blue-100 text-blue-700',
  default: 'bg-indigo-100 text-indigo-700',
};

function ProductImage({
  product,
  category,
}: {
  product: ProductCardProduct;
  category: CategoryKey;
}) {
  const initials = (product.product_name ?? product.name)
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('');

  if (!product.image_url) {
    return (
      <div
        className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full ring-2 ring-slate-100 text-sm font-bold ${CATEGORY_INITIALS_BG[category]}`}
      >
        {initials}
      </div>
    );
  }

  return (
    <img
      src={product.image_url}
      alt={product.product_name ?? product.name}
      className="h-12 w-12 shrink-0 rounded-full bg-white object-cover ring-2 ring-slate-100"
      onError={(e) => {
        (e.currentTarget as HTMLImageElement).style.display = 'none';
      }}
    />
  );
}

function getFallbackWarning(product: ProductCardProduct): ProductWarning | null {
  const text = product.name.toLowerCase();
  if (text.includes('b12')) {
    return {
      type: 'caution',
      title: 'Nicht mit Kaffee direkt danach',
      message: 'Kaffee-Polyphenole können die B12-Absorption beeinträchtigen. Mindestens 1 h Abstand.',
    };
  }
  if (text.includes('jod')) {
    return {
      type: 'danger',
      title: 'Nicht mit Fluor, Brom, Chlorella oder Zeolith',
      message: 'Halogene konkurrieren um Schilddrüsenrezeptoren.',
    };
  }
  return null;
}

export default function ProductCard({
  product,
  onAddToWishlist,
  onSelect,
  onToggleSelected,
  recommendationType,
  showWishlistButton = false,
  showSelectButton = false,
  shopDomains,
  selected = false,
  warning,
}: ProductCardProps) {
  const price = product.product_price ?? product.price;
  const brand = product.product_brand ?? product.brand;
  const name = product.product_name ?? product.name;
  const category = getCategory(product);

  const matchedShop = shopDomains?.find((s) =>
    product.shop_link?.toLowerCase().includes(s.domain.toLowerCase()),
  );
  const shopName =
    matchedShop?.display_name ??
    (product.shop_link?.toLowerCase().includes('amazon') ? 'Amazon' : null);
  const buttonText = shopName ? `Bei ${shopName} kaufen` : 'Jetzt kaufen';

  const monthlyPrice =
    calcMonthlyPrice(price, product.servings_per_container, product.container_count) ?? price;
  const daysSupply = getDaysSupply(product.servings_per_container, product.container_count);

  const productWarning = product.warning_message
    ? {
        title: product.warning_title,
        message: product.warning_message,
        type: product.warning_type ?? 'caution',
      }
    : null;
  const cardWarning = warning ?? productWarning ?? getFallbackWarning(product);

  const borderClass = CATEGORY_BORDER[category];

  return (
    <article
      className={`relative flex flex-col overflow-hidden rounded-xl border border-slate-100 bg-white shadow-sm transition-shadow duration-200 hover:shadow-md ${borderClass} ${
        selected ? 'ring-2 ring-blue-200' : ''
      }`}
    >
      {/* Affiliate badge */}
      {!!product.is_affiliate && (
        <span className="absolute right-2 top-2 z-10 rounded-full bg-amber-100 px-1.5 text-xs font-semibold text-amber-700">
          A
        </span>
      )}

      {/* Select checkbox */}
      {(onToggleSelected ?? onSelect) && (
        <button
          type="button"
          onClick={onToggleSelected ?? onSelect}
          className={`absolute left-2 top-2 z-10 flex h-5 w-5 items-center justify-center rounded border-2 transition-colors ${
            selected
              ? 'border-blue-500 bg-blue-500 text-white'
              : 'border-slate-300 bg-white/80 text-transparent hover:border-blue-400'
          }`}
          aria-label={selected ? `${name} abwählen` : `${name} auswählen`}
        >
          {selected && (
            <svg viewBox="0 0 10 8" className="h-2.5 w-2.5 fill-current" aria-hidden="true">
              <path d="M1 4l3 3 5-6" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          )}
        </button>
      )}

      <div className="flex flex-1 flex-col gap-2.5 p-4">
        {/* Header: image + name + brand + form badge */}
        <div className="flex items-center gap-3 pr-6">
          <ProductImage product={product} category={category} />
          <div className="min-w-0 flex-1">
            <h3 className="truncate text-sm font-bold leading-tight text-slate-900">{name}</h3>
            <div className="mt-0.5 flex flex-wrap items-center gap-1">
              {brand && (
                <span className="text-xs text-slate-500">{brand}</span>
              )}
              {brand && product.form && (
                <span className="text-xs text-slate-300">·</span>
              )}
              {product.form && (
                <span className="rounded-full bg-indigo-50 px-1.5 py-0.5 text-xs font-semibold text-indigo-700">
                  {product.form}
                </span>
              )}
              {recommendationType && (
                <span
                  className={`rounded-full px-1.5 py-0.5 text-xs font-semibold ${
                    recommendationType === 'recommended'
                      ? 'bg-emerald-50 text-emerald-700'
                      : 'bg-indigo-50 text-indigo-700'
                  }`}
                >
                  {recommendationType === 'recommended' ? 'Empfohlen' : 'Alternative'}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Dosierung row */}
        <p className="text-xs text-slate-500">
          <span className="font-semibold">Dosierung:</span>{' '}
          {getDose(product)}
          {daysSupply ? ` · ${daysSupply} Kaps` : ''}
        </p>

        {/* Discontinued banner */}
        {product.discontinued_at && (
          <div className="flex items-center gap-1.5 rounded-lg bg-slate-100 px-2.5 py-1.5 text-xs text-slate-500">
            <RefreshCcw size={12} className="shrink-0" />
            Eingestellt — Alternative wählen
          </div>
        )}

        {/* Alternative note */}
        {product.alternative_note && (
          <div className="rounded-lg border border-indigo-100 bg-indigo-50 px-2.5 py-1.5 text-xs leading-relaxed text-indigo-700">
            <span className="font-semibold">Alternative:</span> {product.alternative_note}
          </div>
        )}

        {/* Spacer */}
        <div className="flex-1" />

        {/* Price row */}
        <div className="flex items-end gap-3">
          <span className="text-base font-bold text-slate-900">{formatCurrency(price)}</span>
          <span className="text-xs text-slate-400">{formatCurrency(monthlyPrice)}/Mt</span>
        </div>

        {/* Buy button */}
        {product.shop_link && (
          <a
            href={product.shop_link}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue-700"
          >
            <ExternalLink size={14} />
            {buttonText}
          </a>
        )}

        {/* Secondary actions */}
        {(showSelectButton || showWishlistButton) && (
          <div className="flex gap-2">
            {showSelectButton && onSelect && (
              <button
                onClick={onSelect}
                className="flex-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 transition-colors hover:bg-slate-50"
              >
                Alternative
              </button>
            )}
            {showWishlistButton && onAddToWishlist && (
              <button
                onClick={onAddToWishlist}
                className="flex-1 rounded-lg border border-rose-100 bg-rose-50 px-3 py-1.5 text-xs font-semibold text-rose-600 transition-colors hover:bg-rose-100"
              >
                Merken
              </button>
            )}
          </div>
        )}

        {/* Interaction warning */}
        {cardWarning && (
          <div
            className={`flex items-start gap-1.5 rounded-lg px-2.5 py-1.5 text-xs ${
              cardWarning.type === 'danger'
                ? 'bg-red-50 text-red-700'
                : cardWarning.type === 'info'
                ? 'bg-blue-50 text-blue-700'
                : 'bg-amber-50 text-amber-700'
            }`}
          >
            <AlertTriangle size={12} className="mt-0.5 shrink-0" />
            <span className="leading-relaxed">
              {cardWarning.title && (
                <strong className="mr-1">{cardWarning.title}:</strong>
              )}
              {cardWarning.message}
            </span>
          </div>
        )}
      </div>
    </article>
  );
}
