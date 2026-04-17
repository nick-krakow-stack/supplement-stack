import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { ChevronLeft, Heart, Package, ShoppingCart, Star, X } from 'lucide-react';
import ModalWrapper from './ModalWrapper';
import type { Product, Recommendation } from '../../types/local';

interface Modal2ProductsProps {
  ingredientId: number;
  ingredientName: string;
  onClose: () => void;
  onBack: () => void;
  onSelect: (product: Product) => void;
  onAddToWishlist?: (productId: number) => Promise<void>;
  recommendedDose?: { value: number; unit: string };
}

type RecommendationType = 'recommended' | 'alternative' | 'other';

interface ProductWithRec {
  product: Product;
  recType: RecommendationType;
}

interface UserProduct {
  id: number;
  name: string;
  brand?: string;
  form?: string;
  price: number;
  shop_link?: string;
  image_url?: string;
  serving_size?: number;
  serving_unit?: string;
  servings_per_container?: number;
  container_count?: number;
  is_affiliate?: number;
  notes?: string;
}

function BadgeRec({ type }: { type: RecommendationType }) {
  if (type === 'recommended') {
    return (
      <span className="inline-flex flex-shrink-0 items-center gap-1 rounded-full bg-gradient-to-r from-emerald-400 to-green-500 px-2.5 py-1 text-xs font-black text-white">
        <Star size={10} />
        Empfohlen
      </span>
    );
  }

  if (type === 'alternative') {
    return (
      <span className="flex-shrink-0 rounded-full bg-indigo-100 px-2.5 py-1 text-xs font-black text-indigo-700">
        Alternative
      </span>
    );
  }

  return null;
}

function calcMonthlyPrice(price: number, servingsPerContainer?: number, containerCount?: number): number | null {
  const total = (servingsPerContainer ?? 0) * (containerCount ?? 1);
  return total > 0 ? (price / total) * 30 : null;
}

function calcServingsPerDay(
  dose: { value: number; unit: string },
  qty: number,
  unit: string,
): number | null {
  if (qty <= 0) return null;
  const normalize = (s: string) => s.toLowerCase().replace(/\s/g, '');
  if (normalize(dose.unit) !== normalize(unit)) return null;
  return Math.ceil(dose.value / qty);
}

function ProductImage({ src, name }: { src?: string; name: string }) {
  if (src) {
    return (
      <img
        src={src}
        alt={name}
        className="h-20 w-20 flex-shrink-0 rounded-2xl border border-slate-200 bg-slate-50 object-cover shadow-sm sm:h-24 sm:w-24"
      />
    );
  }

  return (
    <div className="flex h-20 w-20 flex-shrink-0 items-center justify-center rounded-2xl border border-slate-200 bg-slate-50 shadow-sm sm:h-24 sm:w-24">
      <Package size={30} className="text-slate-400" />
    </div>
  );
}

function ProductRow({
  product,
  badge,
  ingredientId,
  recommendedDose,
  onSelect,
  onAddToWishlist,
}: {
  product: Product;
  badge?: ReactNode;
  ingredientId: number;
  recommendedDose?: { value: number; unit: string };
  onSelect: (product: Product) => void;
  onAddToWishlist?: (productId: number) => Promise<void>;
}) {
  const [wishlistState, setWishlistState] = useState<'idle' | 'loading' | 'done'>('idle');
  const mainIng = product.ingredients?.find((i) => i.ingredient_id === ingredientId);
  const monthlyPrice = calcMonthlyPrice(product.price, product.servings_per_container, product.container_count);

  return (
    <li className="group flex items-center gap-4 rounded-3xl border border-transparent bg-white px-2 py-3 transition-all hover:border-slate-100 hover:bg-slate-50/80 sm:gap-6 sm:px-4">
      <ProductImage src={product.image_url} name={product.name} />

      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            {product.brand && (
              <p className="mb-1 text-xs font-black uppercase tracking-[0.2em] text-slate-400">
                {product.brand}
              </p>
            )}
            <p className="truncate text-xl font-black tracking-tight text-slate-900 sm:text-2xl">
              {product.name}
            </p>
          </div>
          {badge}
        </div>

        <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="inline-flex items-center rounded-full bg-emerald-500 px-4 py-1.5 text-sm font-black text-white shadow-sm shadow-emerald-500/20">
            €{product.price.toFixed(2)}/Packung
          </span>
          {monthlyPrice != null && (
            <span className="inline-flex items-center rounded-full border border-indigo-100 bg-indigo-50 px-3 py-1 text-xs font-black text-indigo-700">
              ≈ €{monthlyPrice.toFixed(2)}/Mo.
            </span>
          )}
          {mainIng?.quantity != null && (
            <span className="text-xs font-semibold text-slate-400">
              {mainIng.quantity}{mainIng.unit ?? ''} pro Portion
            </span>
          )}
          {mainIng?.quantity != null && mainIng.unit && recommendedDose && (() => {
            const servings = calcServingsPerDay(recommendedDose, mainIng.quantity!, mainIng.unit!);
            return servings != null ? (
              <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-xs font-black text-indigo-600">
                ca. {servings}×/Tag
              </span>
            ) : null;
          })()}
        </div>
      </div>

      <div className="flex flex-shrink-0 flex-col items-end gap-2">
        <button
          onClick={() => onSelect(product)}
          className="rounded-2xl bg-gradient-to-r from-blue-600 to-violet-700 px-5 py-3 text-sm font-black text-white shadow-lg shadow-violet-600/20 transition-all hover:-translate-y-0.5 hover:shadow-xl sm:px-8 sm:py-4 sm:text-lg"
        >
          Hinzufügen
        </button>
        {onAddToWishlist && (
          <button
            disabled={wishlistState !== 'idle'}
            onClick={async () => {
              if (wishlistState !== 'idle') return;
              setWishlistState('loading');
              try {
                await onAddToWishlist(product.id);
                setWishlistState('done');
              } catch {
                setWishlistState('idle');
              }
            }}
            className={`flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-bold transition-colors ${
              wishlistState === 'done'
                ? 'border-rose-200 bg-rose-100 text-rose-600'
                : 'border-slate-200 bg-white text-slate-500 hover:border-rose-200 hover:bg-rose-50 hover:text-rose-500'
            }`}
            aria-label="Zur Wunschliste"
          >
            <Heart
              size={13}
              className={wishlistState === 'done' ? 'fill-rose-500 text-rose-500' : ''}
            />
            {wishlistState === 'done' ? 'Gemerkt' : 'Merken'}
          </button>
        )}
      </div>
    </li>
  );
}

export default function Modal2Products({
  ingredientId,
  ingredientName,
  onClose,
  onBack,
  onSelect,
  onAddToWishlist,
  recommendedDose,
}: Modal2ProductsProps) {
  const [items, setItems] = useState<ProductWithRec[]>([]);
  const [userProducts, setUserProducts] = useState<UserProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const fetchAll = async () => {
      setLoading(true);
      setError(null);

      const token = localStorage.getItem('ss_token');

      try {
        const userProductPromise = token
          ? fetch('/api/user-products', {
              headers: { Authorization: `Bearer ${token}` },
            }).catch(() => null)
          : Promise.resolve(null);

        const [recRes, prodRes, userProdRes] = await Promise.all([
          fetch(`/api/recommendations?ingredient_id=${ingredientId}`),
          fetch(`/api/ingredients/${ingredientId}/products`),
          userProductPromise,
        ]);

        if (!cancelled && userProdRes && userProdRes.ok) {
          try {
            const userProdData = await userProdRes.json();
            setUserProducts(userProdData.products ?? userProdData.user_products ?? []);
          } catch {
            // User products are optional for this modal.
          }
        }

        if (!recRes.ok && recRes.status !== 404) throw new Error(`Empfehlungen: HTTP ${recRes.status}`);
        if (!prodRes.ok) throw new Error(`Produkte: HTTP ${prodRes.status}`);

        const recData = recRes.ok ? await recRes.json() : { recommendations: [] };
        const prodData = await prodRes.json();

        if (cancelled) return;

        const recommendations: Recommendation[] = recData.recommendations ?? [];
        const allProducts: Product[] = prodData.products ?? [];
        const recMap = new Map<number, RecommendationType>();
        recommendations.forEach((recommendation) => {
          recMap.set(recommendation.product_id, recommendation.type === 'recommended' ? 'recommended' : 'alternative');
        });

        const recOrder: Record<RecommendationType, number> = { recommended: 0, alternative: 1, other: 2 };
        const withRec = allProducts.map((product) => ({
          product,
          recType: recMap.get(product.id) ?? 'other',
        }));

        withRec.sort((a, b) => {
          const aMain = (a.product.ingredients?.find((i) => i.ingredient_id === ingredientId)?.is_main ?? 0) as number;
          const bMain = (b.product.ingredients?.find((i) => i.ingredient_id === ingredientId)?.is_main ?? 0) as number;
          if (bMain !== aMain) return bMain - aMain;
          return recOrder[a.recType] - recOrder[b.recType];
        });

        setItems(withRec);
      } catch (err) {
        if (!cancelled) {
          setError('Produkte konnten nicht geladen werden.');
          console.error(err);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchAll();
    return () => {
      cancelled = true;
    };
  }, [ingredientId]);

  return (
    <ModalWrapper onClose={onClose} size="lg" padded={false}>
      <div className="sticky top-0 z-10 bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-700 px-6 py-7 text-white sm:px-9 sm:py-8">
        <div className="flex items-start justify-between gap-6">
          <div className="flex min-w-0 items-start gap-3">
            <button
              onClick={onBack}
              className="mt-1 rounded-2xl p-2 text-white/70 transition-colors hover:bg-white/10 hover:text-white"
              aria-label="Zurück"
            >
              <ChevronLeft size={26} />
            </button>
            <div className="min-w-0">
              <p className="text-sm font-black uppercase tracking-[0.22em] text-white/70">
                Produkt wählen
              </p>
              <h2 className="mt-1 truncate text-3xl font-black tracking-tight sm:text-4xl">
                {ingredientName}
              </h2>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-2xl p-2 text-white/75 transition-colors hover:bg-white/10 hover:text-white"
            aria-label="Schließen"
          >
            <X size={32} strokeWidth={1.8} />
          </button>
        </div>
      </div>

      <div className="px-5 py-6 sm:px-9 sm:py-8">
        {loading && (
          <div className="flex items-center justify-center py-12">
            <div className="mr-3 h-8 w-8 animate-spin rounded-full border-4 border-indigo-500 border-t-transparent" />
            <span className="text-sm font-semibold text-slate-500">Produkte werden geladen…</span>
          </div>
        )}

        {error && !loading && (
          <div className="rounded-2xl bg-red-50 p-4">
            <p className="text-sm font-semibold text-red-700">{error}</p>
            <button
              onClick={() => window.location.reload()}
              className="mt-2 text-xs font-bold text-red-600 underline"
            >
              Erneut versuchen
            </button>
          </div>
        )}

        {!loading && !error && items.length === 0 && userProducts.length === 0 && (
          <div className="py-12 text-center">
            <ShoppingCart size={40} className="mx-auto mb-3 text-gray-200" />
            <p className="text-sm font-semibold text-gray-400">
              Keine Produkte für diesen Wirkstoff gefunden.
            </p>
          </div>
        )}

        {!loading && !error && (
          <div className="space-y-6">
            {userProducts.length > 0 && (
              <section>
                <p className="mb-3 text-xs font-black uppercase tracking-[0.2em] text-slate-400">
                  Meine Produkte
                </p>
                <ul className="space-y-3">
                  {userProducts.map((userProd) => {
                    const asProduct: Product = {
                      id: userProd.id,
                      name: userProd.name,
                      brand: userProd.brand,
                      price: userProd.price,
                      shop_link: userProd.shop_link,
                      image_url: userProd.image_url,
                      form: userProd.form,
                      serving_size: userProd.serving_size,
                      serving_unit: userProd.serving_unit,
                      servings_per_container: userProd.servings_per_container,
                      container_count: userProd.container_count,
                      is_affiliate: userProd.is_affiliate,
                    };

                    return (
                      <ProductRow
                        key={`user-${userProd.id}`}
                        product={asProduct}
                        badge={<span className="flex-shrink-0 rounded-full bg-purple-100 px-2.5 py-1 text-xs font-black text-purple-700">Eigenes</span>}
                        ingredientId={ingredientId}
                        recommendedDose={recommendedDose}
                        onSelect={onSelect}
                        onAddToWishlist={onAddToWishlist}
                      />
                    );
                  })}
                </ul>
              </section>
            )}

            {items.length > 0 && (
              <section>
                {userProducts.length > 0 && (
                  <p className="mb-3 text-xs font-black uppercase tracking-[0.2em] text-slate-400">
                    Empfohlene Produkte
                  </p>
                )}
                <ul className="space-y-3">
                  {items.map(({ product, recType }) => (
                    <ProductRow
                      key={product.id}
                      product={product}
                      badge={<BadgeRec type={recType} />}
                      ingredientId={ingredientId}
                      recommendedDose={recommendedDose}
                      onSelect={onSelect}
                      onAddToWishlist={onAddToWishlist}
                    />
                  ))}
                </ul>
              </section>
            )}
          </div>
        )}
      </div>
    </ModalWrapper>
  );
}
