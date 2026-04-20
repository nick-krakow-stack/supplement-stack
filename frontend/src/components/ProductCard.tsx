import { ExternalLink, RefreshCcw, Trash2 } from 'lucide-react';
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
  onDelete?: () => void;
  recommendationType?: 'recommended' | 'alternative' | null;
  showWishlistButton?: boolean;
  showSelectButton?: boolean;
  shopDomains?: ShopDomain[];
  selected?: boolean;
  warning?: ProductWarning | null;
  compact?: boolean;
}

function formatEur(value: number): string {
  return value.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';
}

function calcMonthlyPrice(price: number, servingsPerContainer?: number, containerCount?: number): number | null {
  const total = (servingsPerContainer ?? 0) * (containerCount ?? 1);
  if (total <= 0) return null;
  return (price / total) * 30;
}

function getDaysSupply(servingsPerContainer?: number, containerCount?: number): number | null {
  const total = (servingsPerContainer ?? 0) * (containerCount ?? 1);
  if (total <= 0) return null;
  return Math.round(total);
}

function getDose(product: ProductCardProduct): string {
  if (product.dosage_text) return product.dosage_text;
  if (product.quantity && product.unit) return `${product.quantity} ${product.unit}`;
  if (product.serving_size && product.serving_unit) return `${product.serving_size} ${product.serving_unit}`;
  return '—';
}

type TimingKey = 'morning' | 'evening' | 'noon' | 'trial' | 'anytime';

function getTimingKey(timing?: string): TimingKey {
  const t = (timing ?? '').toLowerCase();
  if (t.includes('morgen') || t.includes('morning') || t.includes('früh')) return 'morning';
  if (t.includes('abend') || t.includes('evening') || t.includes('nacht')) return 'evening';
  if (t.includes('mittag') || t.includes('noon')) return 'noon';
  if (t.includes('probe') || t.includes('trial') || t.includes('test')) return 'trial';
  return 'anytime';
}

const TIMING_STYLES: Record<TimingKey, { cls: string; label: string }> = {
  morning: { cls: 'bg-[#fef3c7] text-[#d97706]', label: 'Zum Frühstück' },
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
  if (hay.includes('omega') || hay.includes('fischöl') || hay.includes('fish') || hay.includes('dha') || hay.includes('epa')) return 'omega';
  if (hay.includes('protein') || hay.includes('kreatin') || hay.includes('bcaa')) return 'protein';
  return 'default';
}

const CATEGORY_EMOJI: Record<CategoryKey, string> = {
  vitamin: '☀️',
  mineral: '💊',
  omega:   '🐟',
  protein: '💪',
  default: '🌿',
};

function getFallbackWarning(product: ProductCardProduct): ProductWarning | null {
  const t = product.name.toLowerCase();
  if (t.includes('b12')) return { type: 'caution', title: 'Nicht mit Kaffee direkt danach', message: 'Kaffee-Polyphenole können die B12-Absorption beeinträchtigen. Mindestens 1 h Abstand einhalten.' };
  if (t.includes('jod')) return { type: 'danger', title: 'Nicht mit Fluor, Brom oder Chlorella', message: 'Halogene konkurrieren um Schilddrüsenrezeptoren.' };
  return null;
}

export default function ProductCard({
  product, onAddToWishlist, onSelect, onToggleSelected, onDelete,
  recommendationType, showWishlistButton = false, showSelectButton = false,
  shopDomains, selected = false, warning,
}: ProductCardProps) {
  const price = product.product_price ?? product.price;
  const brand = product.product_brand ?? product.brand;
  const name = product.product_name ?? product.name;
  const category = getCategory(product);
  const emoji = CATEGORY_EMOJI[category];

  const timingKey = getTimingKey(product.timing);
  const timing = TIMING_STYLES[timingKey];

  const matchedShop = shopDomains?.find((s) => product.shop_link?.toLowerCase().includes(s.domain.toLowerCase()));
  const shopName = matchedShop?.display_name ?? (product.shop_link?.toLowerCase().includes('amazon') ? 'Amazon' : null);
  const buttonText = shopName ? `Bei ${shopName} kaufen` : 'Jetzt kaufen';

  const monthlyPrice = calcMonthlyPrice(price, product.servings_per_container, product.container_count);
  const daysSupply = getDaysSupply(product.servings_per_container, product.container_count);
  const dose = getDose(product);

  const productWarning = product.warning_message
    ? { title: product.warning_title, message: product.warning_message, type: product.warning_type ?? 'caution' }
    : null;
  const cardWarning = warning ?? productWarning ?? getFallbackWarning(product);

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
      <div className="flex items-start gap-[11px] mb-3">
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
            {product.timing ? product.timing : timing.label}
          </span>
          {recommendationType && (
            <span className={`ml-1 inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-extrabold ${
              recommendationType === 'recommended' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-indigo-50 text-indigo-700 border border-indigo-200'
            }`}>
              {recommendationType === 'recommended' ? '★ Empfohlen' : 'Alternative'}
            </span>
          )}
        </div>
      </div>

      {/* Meta grid */}
      <div className="grid grid-cols-2 gap-2 mb-2.5">
        <div>
          <div className="text-[10px] font-bold uppercase tracking-[0.4px] text-slate-400 mb-0.5">Dosierung</div>
          <div className="text-[12.5px] font-bold text-slate-700">{dose}</div>
        </div>
        <div>
          <div className="text-[10px] font-bold uppercase tracking-[0.4px] text-slate-400 mb-0.5">Reicht für</div>
          <div className="text-[12.5px] font-bold text-slate-700">
            {daysSupply ? `${daysSupply} Tage` : '—'}
          </div>
        </div>
      </div>

      {/* Effect */}
      {(product.effect_summary ?? product.form) && (
        <div className="mb-2.5">
          <div className="text-[10px] font-bold uppercase tracking-[0.4px] text-slate-400 mb-1">Wirkung</div>
          <div className="text-[12px] text-slate-500 leading-relaxed font-medium">
            {product.effect_summary ?? product.form}
          </div>
        </div>
      )}

      {/* Discontinued */}
      {product.discontinued_at && (
        <div className="flex items-center gap-1.5 rounded-lg bg-slate-100 px-2.5 py-1.5 text-xs text-slate-500 mb-2.5">
          <RefreshCcw size={12} className="shrink-0" />
          Eingestellt — Alternative wählen
        </div>
      )}

      {/* Alternative note */}
      {product.alternative_note && (
        <div className="rounded-lg border border-indigo-100 bg-indigo-50 px-2.5 py-1.5 text-xs leading-relaxed text-indigo-700 mb-2.5">
          <span className="font-bold">Alternative:</span> {product.alternative_note}
        </div>
      )}

      {/* Warning box */}
      {cardWarning && (
        <div className="rounded-lg bg-[#fff8f0] border border-[#fed7aa] px-3 py-2.5 mb-2.5">
          <div className="flex items-center gap-1.5 text-[11.5px] font-extrabold text-orange-600 mb-1.5">
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <path d="M6 1.5L11.5 10.5H.5L6 1.5Z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round"/>
              <path d="M6 5v2.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
              <circle cx="6" cy="9" r="0.6" fill="currentColor"/>
            </svg>
            {cardWarning.title ?? 'Hinweis'}
          </div>
          <ul className="list-none space-y-0.5">
            {cardWarning.message.split('.').filter(s => s.trim()).map((item, i) => (
              <li key={i} className="text-[11px] text-orange-900 font-medium pl-3 relative leading-snug before:content-['•'] before:absolute before:left-0.5 before:text-orange-500">
                {item.trim()}.
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Price row */}
      <div className="flex items-center justify-between pt-2.5 border-t border-slate-100 mb-2.5">
        <span className="text-[18px] font-black text-slate-900">{formatEur(price)}</span>
        {monthlyPrice !== null && (
          <span className="bg-emerald-500 text-white px-2.5 py-0.5 rounded-full text-[12px] font-extrabold">
            {formatEur(monthlyPrice)}/Mo
          </span>
        )}
        {!!product.is_affiliate && (
          <span className="bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full text-[10px] font-bold">
            Affiliate
          </span>
        )}
      </div>

      {/* Actions */}
      <div className="flex gap-[7px]">
        {product.shop_link && (
          <a
            href={product.shop_link}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="flex-1 inline-flex items-center justify-center gap-1.5 text-white rounded-[10px] py-[9px] text-[12.5px] font-bold transition-colors"
            style={{ background: '#3b82f6' }}
            onMouseEnter={(e) => (e.currentTarget.style.background = '#2563eb')}
            onMouseLeave={(e) => (e.currentTarget.style.background = '#3b82f6')}
          >
            <ExternalLink size={13} />
            {buttonText}
          </a>
        )}
        {onDelete && (
          <button
            onClick={(e) => { e.stopPropagation(); onDelete(); }}
            aria-label="Produkt entfernen"
            className="w-[38px] h-[38px] shrink-0 flex items-center justify-center rounded-[10px] transition-colors"
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
            className="flex-1 rounded-[10px] border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50 transition-colors"
          >
            Alternative
          </button>
        )}
        {showWishlistButton && onAddToWishlist && (
          <button
            onClick={(e) => { e.stopPropagation(); onAddToWishlist(); }}
            className="flex-1 rounded-[10px] border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-bold text-rose-600 hover:bg-rose-100 transition-colors"
          >
            ♡ Merken
          </button>
        )}
      </div>
    </article>
  );
}
