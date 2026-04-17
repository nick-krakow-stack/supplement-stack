import { AlertTriangle, Check, ExternalLink, Package, RefreshCcw } from 'lucide-react';
import { ShopDomain } from '../types/local';

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

function calcMonthlyPrice(price: number, servingsPerContainer?: number, containerCount?: number): number | null {
  const total = (servingsPerContainer ?? 0) * (containerCount ?? 1);
  if (total <= 0) return null;
  return (price / total) * 30;
}

function getDaysSupply(servingsPerContainer?: number, containerCount?: number, portionsPerDay = 1): number | null {
  const total = (servingsPerContainer ?? 0) * (containerCount ?? 1);
  if (total <= 0) return null;
  return Math.round(total / Math.max(portionsPerDay, 0.001));
}

function getTiming(product: ProductCardProduct): string {
  if (product.timing) return product.timing;
  const text = `${product.name} ${product.form ?? ''}`.toLowerCase();
  if (text.includes('b12')) return 'Morgens nuechtern';
  if (text.includes('jod')) return 'Nach dem Aufstehen';
  if (text.includes('carnitin')) return 'Morgens oder vor dem Training';
  if (text.includes('creatin') || text.includes('kreatin')) return 'Morgens & Abends';
  return 'Zum Frühstück';
}

function getEffect(product: ProductCardProduct): string {
  if (product.effect_summary) return product.effect_summary;
  const text = `${product.name} ${product.form ?? ''}`.toLowerCase();
  if (text.includes('magnesium')) return 'Muskel- & Nervenfunktion, Entspannung';
  if (text.includes('b12')) return 'Energie, Nerven, Blutbildung, DNA-Synthese';
  if (text.includes('jod')) return 'Schilddruese, Hormone, Stoffwechsel';
  if (text.includes('q10')) return 'Zellenergie, Herzfunktion, antioxidativer Schutz';
  if (text.includes('creatin') || text.includes('kreatin')) return 'Explosivkraft, ATP-Resynthese, Regeneration';
  if (text.includes('kollagen')) return 'Haut, Haare, Gelenke, Bindegewebe';
  if (text.includes('grapefruit')) return 'Antimikrobiell, antiviral, Darmreinigung';
  return product.form ? `${product.form} Supplement` : 'Allgemeine Versorgung';
}

function getDose(product: ProductCardProduct): string {
  if (product.dosage_text) return product.dosage_text;
  if (product.quantity && product.unit) {
    return `1 Portion taeglich (${product.quantity}${product.unit})`;
  }
  if (product.serving_size && product.serving_unit) {
    return `1 Portion taeglich (${product.serving_size}${product.serving_unit})`;
  }
  return 'Nach Empfehlung';
}

function getFallbackWarning(product: ProductCardProduct): ProductWarning | null {
  const text = product.name.toLowerCase();
  if (text.includes('b12')) {
    return {
      type: 'caution',
      title: 'Nicht mit Kaffee direkt danach',
      message: 'Kaffee-Polyphenole koennen die B12-Absorption beeintraechtigen. Mindestens 1 h Abstand einhalten.',
    };
  }
  if (text.includes('jod')) {
    return {
      type: 'danger',
      title: 'Nicht mit Fluor, Brom, Chlorella oder Zeolith',
      message: 'Halogene konkurrieren um Schilddruesenrezeptoren. Chlorella/Zeolith koennen Jod binden.',
    };
  }
  return null;
}

function ProductImage({ product }: { product: ProductCardProduct }) {
  if (!product.image_url) {
    return (
      <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-slate-100 to-indigo-100 shadow-inner">
        <Package size={24} className="text-slate-400" />
      </div>
    );
  }

  return (
    <img
      src={product.image_url}
      alt={product.name}
      className="h-16 w-16 shrink-0 rounded-full bg-white object-cover shadow-lg ring-4 ring-white"
      onError={(e) => {
        (e.currentTarget as HTMLImageElement).style.display = 'none';
      }}
    />
  );
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
  compact = false,
}: ProductCardProps) {
  const price = product.product_price ?? product.price;
  const brand = product.product_brand ?? product.brand;
  const name = product.product_name ?? product.name;
  const matchedShop = shopDomains?.find(
    (s) => product.shop_link?.toLowerCase().includes(s.domain.toLowerCase())
  );
  const shopName = matchedShop?.display_name ?? (product.shop_link?.toLowerCase().includes('amazon') ? 'Amazon' : null);
  const buttonText = shopName ? `Bei ${shopName} kaufen` : 'Jetzt kaufen';
  const monthlyPrice = calcMonthlyPrice(price, product.servings_per_container, product.container_count) ?? price;
  const daysSupply = getDaysSupply(product.servings_per_container, product.container_count);
  const productWarning = product.warning_message
    ? {
        title: product.warning_title,
        message: product.warning_message,
        type: product.warning_type ?? 'caution',
      }
    : null;
  const cardWarning = warning ?? productWarning ?? getFallbackWarning(product);

  return (
    <article
      className={`group relative overflow-hidden rounded-[1.15rem] border bg-white/95 shadow-[0_12px_28px_rgba(15,23,42,0.08)] backdrop-blur transition-all duration-200 ${
        selected
          ? 'border-blue-400 ring-2 ring-blue-200'
          : 'border-slate-200/80 hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-[0_18px_38px_rgba(15,23,42,0.12)]'
      }`}
    >
      {(onToggleSelected || onSelect) && (
        <button
          type="button"
          onClick={onToggleSelected ?? onSelect}
          className={`absolute right-4 top-4 z-10 flex h-6 w-6 items-center justify-center rounded-md border-2 p-0 transition-colors ${
            selected
              ? 'border-blue-500 bg-blue-500 text-white'
              : 'border-slate-300 bg-white/80 text-transparent hover:border-blue-400'
          }`}
          aria-label={selected ? `${name} abwählen` : `${name} auswählen`}
        >
          <Check size={16} />
        </button>
      )}

      <div className={`p-4 ${compact ? 'space-y-2.5' : 'space-y-3'}`}>
        <div className="flex items-start gap-3 pr-8">
          <ProductImage product={product} />
          <div className="min-w-0 flex-1 pt-1">
            {brand && (
              <p className="mb-0.5 truncate text-[0.65rem] font-black uppercase tracking-[0.18em] text-slate-400">
                {brand}
              </p>
            )}
            <h3 className="break-words text-base font-black leading-tight tracking-tight text-slate-900">
              {name}
            </h3>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <span className="whitespace-nowrap rounded-full bg-amber-500 px-2.5 py-1 text-[0.72rem] font-black text-white shadow-sm">
                {getTiming(product)}
              </span>
              {recommendationType && (
                <span className={`rounded-full px-3 py-1 text-xs font-bold ${
                  recommendationType === 'recommended'
                    ? 'bg-emerald-100 text-emerald-700'
                    : 'bg-indigo-100 text-indigo-700'
                }`}>
                  {recommendationType === 'recommended' ? 'Empfohlen' : 'Alternative'}
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 text-slate-600">
          <div>
            <p className="text-xs font-black text-slate-700">Dosierung:</p>
            <p className="mt-1 text-sm leading-relaxed text-slate-600">{getDose(product)}</p>
          </div>
          <div>
            <p className="text-xs font-black text-slate-700">Reicht für:</p>
            <p className="mt-1 text-sm leading-relaxed text-slate-600">
              {daysSupply ? `${daysSupply} Tage` : 'Nach Verbrauch'}
            </p>
          </div>
        </div>

        {!compact && (
          <div>
            <p className="text-xs font-black text-slate-700">Wirkung:</p>
            <p className="mt-1.5 text-sm leading-relaxed text-slate-600">{getEffect(product)}</p>
          </div>
        )}

        {cardWarning && (
          <div className={`rounded-2xl border-l-4 p-4 ${
            cardWarning.type === 'danger'
              ? 'border-red-500 bg-red-50 text-red-600'
              : cardWarning.type === 'info'
              ? 'border-blue-500 bg-blue-50 text-blue-700'
              : 'border-amber-500 bg-amber-50 text-amber-700'
          }`}>
            <div className="flex items-start gap-2">
              <AlertTriangle size={17} className="mt-0.5 flex-shrink-0" />
              <div>
                {cardWarning.title && <p className="font-black">{cardWarning.title}</p>}
                <p className="mt-1 text-sm leading-relaxed">{cardWarning.message}</p>
              </div>
            </div>
          </div>
        )}

        {product.discontinued_at && (
          <div className="flex items-center gap-2 rounded-2xl bg-slate-100 px-4 py-3 text-sm text-slate-600">
            <RefreshCcw size={16} />
            Dieses Produkt ist eingestellt. Alternative waehlen empfohlen.
          </div>
        )}

        {product.alternative_note && (
          <div className="rounded-2xl border border-indigo-100 bg-indigo-50 px-4 py-3 text-sm leading-relaxed text-indigo-700">
            <span className="font-black">Alternative:</span> {product.alternative_note}
          </div>
        )}

        <div className="border-t border-slate-100 pt-3">
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="text-xs text-slate-500">Einmalkosten</p>
              <p className="text-xl font-black tracking-tight text-slate-900">{formatCurrency(price)}</p>
            </div>
            <div className="text-right">
              <p className="text-xs text-slate-500">Pro Monat</p>
              <span className="inline-flex rounded-full bg-emerald-600 px-3.5 py-1.5 text-sm font-black text-white">
                {formatCurrency(monthlyPrice)}
              </span>
            </div>
          </div>
        </div>

        <div className="flex gap-2">
          {product.shop_link && (
            <a
              href={product.shop_link}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-black text-white shadow-lg shadow-blue-600/20 transition-colors hover:bg-blue-700"
            >
              <ExternalLink size={17} />
              {buttonText}
            </a>
          )}
          {showSelectButton && onSelect && (
            <button
              onClick={onSelect}
              className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-black text-slate-700 hover:bg-slate-50"
            >
              Alternative
            </button>
          )}
          {showWishlistButton && onAddToWishlist && (
            <button
              onClick={onAddToWishlist}
              className="rounded-xl border border-rose-100 bg-rose-50 px-4 py-3 text-sm font-black text-rose-600 hover:bg-rose-100"
            >
              Merken
            </button>
          )}
        </div>
      </div>
    </article>
  );
}
