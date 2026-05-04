import { useCallback, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { ChevronLeft, Heart, Package, ShoppingCart, Star, X } from 'lucide-react';
import ModalWrapper from './ModalWrapper';
import type { Product, Recommendation, UserProductIngredient } from '../../types/local';

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
  status?: 'pending' | 'approved' | 'rejected';
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
  published_product_id?: number | null;
  ingredients?: UserProductIngredient[];
}

interface UserProductRow {
  product: Product;
  canSelect: boolean;
  statusHint: string;
  badgeText: string;
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

function normalizeComparableUnit(unit: string): string {
  const normalized = unit.toLowerCase().replace(/[\s.]/g, '');
  return normalized === 'ie' || normalized === 'iu' ? 'iu' : normalized;
}

function calcServingsPerDay(
  dose: { value: number; unit: string },
  qty: number,
  unit: string,
): number | null {
  if (qty <= 0) return null;
  if (normalizeComparableUnit(dose.unit) !== normalizeComparableUnit(unit)) return null;
  return Math.ceil(dose.value / qty);
}

function normalizeProductForIngredient(product: Product, ingredientId: number): Product {
  if (product.quantity == null && product.unit == null && product.is_main == null) return product;

  const ingredients = product.ingredients ?? [];
  const matchingIndex = ingredients.findIndex((ingredient) => ingredient.ingredient_id === ingredientId);
  const flatIsMain = product.is_main ?? 0;

  if (matchingIndex >= 0) {
    return {
      ...product,
      ingredients: ingredients.map((ingredient, index) => (
        index === matchingIndex
          ? {
              ...ingredient,
              quantity: ingredient.quantity ?? product.quantity,
              unit: ingredient.unit ?? product.unit,
              is_main: ingredient.is_main ?? flatIsMain,
            }
          : ingredient
      )),
    };
  }

  return {
    ...product,
    ingredients: [
      ...ingredients,
      {
        ingredient_id: product.ingredient_id ?? ingredientId,
        ingredient_name: product.ingredient_name,
        quantity: product.quantity,
        unit: product.unit,
        is_main: flatIsMain,
      },
    ],
  };
}

function ProductImage({ src, name }: { src?: string; name: string }) {
  if (src) {
    return (
      <img
        src={src}
        alt={name}
        className="h-16 w-16 flex-shrink-0 rounded-2xl border border-slate-200 bg-slate-50 object-cover shadow-sm min-[431px]:h-20 min-[431px]:w-20 sm:h-24 sm:w-24"
      />
    );
  }

  return (
    <div className="flex h-16 w-16 flex-shrink-0 items-center justify-center rounded-2xl border border-slate-200 bg-slate-50 shadow-sm min-[431px]:h-20 min-[431px]:w-20 sm:h-24 sm:w-24">
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
  statusHint,
}: {
  product: Product;
  badge?: ReactNode;
  ingredientId: number;
  recommendedDose?: { value: number; unit: string };
  onSelect?: (product: Product) => void;
  onAddToWishlist?: (productId: number) => Promise<void>;
  statusHint?: string;
}) {
  const [wishlistState, setWishlistState] = useState<'idle' | 'loading' | 'done'>('idle');
  const mainIng = product.ingredients?.find((i) => i.ingredient_id === ingredientId);
  const monthlyPrice = calcMonthlyPrice(product.price, product.servings_per_container, product.container_count);
  const isSelectable = Boolean(onSelect);

  return (
    <li className="group flex flex-col items-stretch gap-3 rounded-3xl border border-transparent bg-white px-2 py-3 transition-all hover:border-slate-100 hover:bg-slate-50/80 min-[431px]:flex-row min-[431px]:items-center min-[431px]:gap-4 sm:gap-6 sm:px-4">
      <ProductImage src={product.image_url} name={product.name} />

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            {product.brand && (
              <p className="mb-1 text-xs font-black uppercase tracking-[0.2em] text-slate-400">
                {product.brand}
              </p>
            )}
            <p className="break-words text-lg font-black tracking-tight text-slate-900 min-[431px]:text-xl sm:text-2xl">
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
        {statusHint && (
          <p className="mt-2 text-xs font-semibold text-slate-500">{statusHint}</p>
        )}
      </div>

      <div className="flex w-full flex-shrink-0 flex-col items-stretch gap-2 min-[431px]:w-auto min-[431px]:items-end">
        {isSelectable ? (
        <button
            onClick={() => onSelect?.(product)}
            className="min-h-11 rounded-2xl bg-gradient-to-r from-blue-600 to-violet-700 px-5 py-3 text-sm font-black text-white shadow-lg shadow-violet-600/20 transition-all hover:-translate-y-0.5 hover:shadow-xl sm:px-8 sm:py-4 sm:text-lg"
          >
            Hinzufügen
          </button>
        ) : (
          <span className="flex min-h-11 items-center justify-center rounded-2xl border border-slate-200 bg-slate-100 px-5 py-3 text-xs font-semibold text-slate-500 sm:text-sm">
            Nicht im Katalog
          </span>
        )}
        {isSelectable && onAddToWishlist && (
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
            className={`flex min-h-11 items-center justify-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-bold transition-colors ${
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
  const [recommendationWarning, setRecommendationWarning] = useState(false);

  const loadProducts = useCallback(
    async (isCancelled: () => boolean = () => false) => {
      setLoading(true);
      setError(null);
      setRecommendationWarning(false);
      setItems([]);
      setUserProducts([]);

      const token = localStorage.getItem('ss_token');

      try {
        const userProductPromise = token
          ? fetch('/api/user-products', {
              headers: { Authorization: `Bearer ${token}` },
            }).catch(() => null)
          : Promise.resolve(null);

        const [recResult, prodResult, userProdResult] = await Promise.allSettled([
          fetch(`/api/recommendations?ingredient_id=${ingredientId}`),
          fetch(`/api/ingredients/${ingredientId}/products`),
          userProductPromise,
        ]);

        const userProdRes = userProdResult.status === 'fulfilled' ? userProdResult.value : null;
        if (!isCancelled() && userProdRes && userProdRes.ok) {
          try {
            const userProdData = await userProdRes.json();
            setUserProducts(userProdData.products ?? userProdData.user_products ?? []);
          } catch {
            // User products are optional for this modal.
          }
        }

        if (prodResult.status === 'rejected') {
          throw prodResult.reason;
        }

        const prodRes = prodResult.value;
        if (!prodRes.ok) throw new Error(`Produkte: HTTP ${prodRes.status}`);
        const prodData = await prodRes.json();

        let recData: { recommendations?: Recommendation[] } = { recommendations: [] };
        let recWarning = false;
        if (recResult.status === 'fulfilled' && recResult.value.ok) {
          try {
            recData = await recResult.value.json();
          } catch (err) {
            recWarning = true;
            console.warn('Recommendations response could not be parsed:', err);
          }
        } else if (recResult.status === 'fulfilled') {
          recWarning = true;
          console.warn(`Recommendations fetch failed: HTTP ${recResult.value.status}`);
        } else if (recResult.status === 'rejected') {
          recWarning = true;
          console.warn('Recommendations fetch failed:', recResult.reason);
        }

        if (isCancelled()) return;

        const recommendations: Recommendation[] = recData.recommendations ?? [];
        const allProducts: Product[] = (prodData.products ?? []).map((product: Product) => (
          normalizeProductForIngredient(product, ingredientId)
        ));
        const recMap = new Map<number, RecommendationType>();
        recommendations.forEach((recommendation) => {
          if (typeof recommendation.product_id === 'number') {
            recMap.set(
              recommendation.product_id,
              recommendation.type === 'recommended' ? 'recommended' : 'alternative',
            );
          }
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
        setRecommendationWarning(recWarning);
      } catch (err) {
        if (!isCancelled()) {
          setError('Produkte konnten nicht geladen werden.');
          console.error(err);
        }
      } finally {
        if (!isCancelled()) setLoading(false);
      }
    },
    [ingredientId],
  );

  useEffect(() => {
    let cancelled = false;

    void loadProducts(() => cancelled);
    return () => {
      cancelled = true;
    };
  }, [loadProducts]);

  const catalogProductIds = new Set(items.map(({ product }) => product.id));

  const userProductRows: UserProductRow[] = userProducts
    .map((userProd): UserProductRow | null => {
      const publishedId = userProd.published_product_id ?? null;
      const hasSearchRelevantIngredient = userProd.ingredients?.some(
        (ingredient) => ingredient.ingredient_id === ingredientId && Boolean(ingredient.search_relevant)
      );
      if (!hasSearchRelevantIngredient) return null;

      const hasPublishedMapping = publishedId != null;
      const duplicateInCatalog = hasPublishedMapping && catalogProductIds.has(publishedId);
      const userStatus: 'pending' | 'approved' | 'rejected' | 'unknown' = userProd.status ?? 'unknown';
      const isApproved = userStatus === 'approved';

      const canSelect = isApproved && hasPublishedMapping && !duplicateInCatalog;
      const productId = hasPublishedMapping ? publishedId : userProd.id;

      const statusHint =
        userStatus === 'pending'
          ? 'In Prüfung (privat)'
          : userStatus === 'rejected'
            ? 'Abgelehnt (nicht nutzbar)'
            : hasPublishedMapping
              ? duplicateInCatalog
                ? 'Bereits im Katalog vorhanden'
                : isApproved
                  ? 'Freigegeben'
                  : 'Status unklar'
              : isApproved
                ? 'Freigegeben, aber noch nicht im Katalog'
                : userStatus === 'unknown'
                  ? 'Status nicht geliefert'
                  : 'Privat';

      const badgeText = hasPublishedMapping
        ? duplicateInCatalog
          ? 'Bereits vorhanden'
          : 'Öffentlich'
        : 'Eigenes';

      const asProduct: Product = {
        id: productId,
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

      return {
        product: asProduct,
        canSelect,
        statusHint,
        badgeText,
      };
    })
    .filter((row): row is UserProductRow => row != null);

  return (
    <ModalWrapper onClose={onClose} size="lg" padded={false}>
      <div className="sticky top-0 z-10 bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-700 px-4 py-5 text-white sm:px-9 sm:py-8">
        <div className="flex items-start justify-between gap-3 sm:gap-6">
          <div className="flex min-w-0 items-start gap-3">
            <button
              onClick={onBack}
              className="mt-0 flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-2xl text-white/70 transition-colors hover:bg-white/10 hover:text-white sm:mt-1"
              aria-label="Zurück"
            >
              <ChevronLeft size={26} />
            </button>
            <div className="min-w-0">
              <p className="text-xs font-black uppercase tracking-[0.18em] text-white/70 sm:text-sm sm:tracking-[0.22em]">
                Produkt wählen
              </p>
              <h2 className="mt-1 break-words text-2xl font-black tracking-tight sm:text-4xl">
                {ingredientName}
              </h2>
            </div>
          </div>
          <button
            onClick={onClose}
            className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-2xl text-white/75 transition-colors hover:bg-white/10 hover:text-white"
            aria-label="Schließen"
          >
            <X size={32} strokeWidth={1.8} />
          </button>
        </div>
      </div>

      <div className="px-3 py-5 sm:px-9 sm:py-8">
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
              onClick={() => void loadProducts()}
              className="mt-2 text-xs font-bold text-red-600 underline"
            >
              Erneut versuchen
            </button>
          </div>
        )}

        {!loading && !error && items.length === 0 && userProductRows.length === 0 && (
          <div className="py-12 text-center">
            <ShoppingCart size={40} className="mx-auto mb-3 text-gray-200" />
            <p className="text-sm font-semibold text-gray-400">
              Keine Produkte für diesen Wirkstoff gefunden.
            </p>
          </div>
        )}

        {!loading && !error && (
          <div className="space-y-6">
            {recommendationWarning && items.length > 0 && (
              <p className="rounded-2xl border border-amber-100 bg-amber-50 px-4 py-2 text-xs font-semibold text-amber-700">
                Hinweis: Produkt-Badges konnten nicht geladen werden.
              </p>
            )}

            {userProductRows.length > 0 && (
              <section>
                <p className="mb-3 text-xs font-black uppercase tracking-[0.2em] text-slate-400">
                  Meine Produkte
                </p>
                <ul className="space-y-3">
                  {userProductRows.map((row) => {
                    return (
                      <ProductRow
                        key={`user-${row.product.id}-${userProdKey(row.product)}`}
                        product={row.product}
                        badge={
                          <span className="flex-shrink-0 rounded-full bg-purple-100 px-2.5 py-1 text-xs font-black text-purple-700">
                            {row.badgeText}
                          </span>
                        }
                        ingredientId={ingredientId}
                        recommendedDose={recommendedDose}
                        onSelect={row.canSelect ? onSelect : undefined}
                        onAddToWishlist={row.canSelect ? onAddToWishlist : undefined}
                        statusHint={row.statusHint}
                      />
                    );
                  })}
                </ul>
              </section>
            )}

            {items.length > 0 && (
              <section>
                {userProductRows.length > 0 && (
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

function userProdKey(product: Product) {
  return `${product.id}-${product.name}`;
}
