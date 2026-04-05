import { useState, useEffect } from 'react';
import { ChevronLeft, X, Star, ShoppingCart } from 'lucide-react';
import ModalWrapper from './ModalWrapper';
import type { Product, Recommendation } from '../../types/local';

interface Modal2ProductsProps {
  ingredientId: number;
  ingredientName: string;
  onClose: () => void;
  onBack: () => void;
  onSelect: (product: Product) => void;
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

const PLACEHOLDER_IMAGE =
  'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="60" height="60" viewBox="0 0 60 60"%3E%3Crect width="60" height="60" fill="%23f3f4f6"/%3E%3Ctext x="50%25" y="54%25" dominant-baseline="middle" text-anchor="middle" font-size="24" fill="%239ca3af"%3E💊%3C/text%3E%3C/svg%3E';

function BadgeRec({ type }: { type: RecommendationType }) {
  if (type === 'recommended') {
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-full bg-gradient-to-r from-emerald-400 to-green-500 text-white">
        <Star size={10} />
        Empfohlen
      </span>
    );
  }
  if (type === 'alternative') {
    return (
      <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-indigo-100 text-indigo-700">
        Alternative
      </span>
    );
  }
  return null;
}

// Calculate monthly price from one-time price + serving data
function calcMonthlyPrice(price: number, servingsPerContainer?: number, containerCount?: number): number | null {
  const total = (servingsPerContainer ?? 0) * (containerCount ?? 1);
  return total > 0 ? (price / total) * 30 : null;
}

// Calculate how many servings/day based on dose and ingredient quantity per serving
function calcServingsPerDay(
  dose: { value: number; unit: string },
  qty: number,
  unit: string
): number | null {
  if (qty <= 0) return null;
  const normalize = (s: string) => s.toLowerCase().replace(/\s/g, '');
  if (normalize(dose.unit) !== normalize(unit)) return null;
  return Math.ceil(dose.value / qty);
}

export default function Modal2Products({
  ingredientId,
  ingredientName,
  onClose,
  onBack,
  onSelect,
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
        // Fetch recommendations, all products, and (if logged in) user products in parallel
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

        // Silently load user products — failure is non-fatal
        if (!cancelled && userProdRes && userProdRes.ok) {
          try {
            const userProdData = await userProdRes.json();
            setUserProducts(userProdData.products ?? userProdData.user_products ?? []);
          } catch {
            // silently ignore parse errors
          }
        }

        if (!recRes.ok && recRes.status !== 404) {
          throw new Error(`Empfehlungen: HTTP ${recRes.status}`);
        }
        if (!prodRes.ok) throw new Error(`Produkte: HTTP ${prodRes.status}`);

        const recData = recRes.ok ? await recRes.json() : { recommendations: [] };
        const prodData = await prodRes.json();

        if (cancelled) return;

        const recommendations: Recommendation[] = recData.recommendations ?? [];
        const allProducts: Product[] = prodData.products ?? [];

        // Build recommendation map
        const recMap = new Map<number, RecommendationType>();
        recommendations.forEach((r) => {
          recMap.set(r.product_id, r.type === 'recommended' ? 'recommended' : 'alternative');
        });

        // Sort: main-ingredient products first, then by recommendation status
        const recOrder: Record<RecommendationType, number> = { recommended: 0, alternative: 1, other: 2 };

        const withRec: ProductWithRec[] = allProducts.map((p) => ({
          product: p,
          recType: recMap.get(p.id) ?? 'other',
        }));

        withRec.sort((a, b) => {
          const aMain = (a.product.ingredients?.find(i => i.ingredient_id === ingredientId)?.is_main ?? 0) as number;
          const bMain = (b.product.ingredients?.find(i => i.ingredient_id === ingredientId)?.is_main ?? 0) as number;
          if (bMain !== aMain) return bMain - aMain; // main ingredients first
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
    <ModalWrapper onClose={onClose}>
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2">
          <button
            onClick={onBack}
            className="p-2 rounded-xl text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
            aria-label="Zurück"
          >
            <ChevronLeft size={20} />
          </button>
          <div>
            <h2 className="text-lg font-bold text-gray-900 leading-tight">Produkte</h2>
            <p className="text-xs text-gray-400 mt-0.5">{ingredientName}</p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="p-2 rounded-xl text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
          aria-label="Schließen"
        >
          <X size={20} />
        </button>
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-12">
          <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin mr-3" />
          <span className="text-gray-500 text-sm">Produkte werden geladen…</span>
        </div>
      )}

      {/* Error */}
      {error && !loading && (
        <div className="p-4 bg-red-50 rounded-xl">
          <p className="text-sm text-red-700">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="mt-2 text-xs text-red-600 underline"
          >
            Erneut versuchen
          </button>
        </div>
      )}

      {/* Empty state — only when there are also no user products */}
      {!loading && !error && items.length === 0 && userProducts.length === 0 && (
        <div className="py-12 text-center">
          <ShoppingCart size={40} className="mx-auto text-gray-200 mb-3" />
          <p className="text-gray-400 text-sm">
            Keine Produkte für diesen Wirkstoff gefunden.
          </p>
        </div>
      )}

      {!loading && !error && (
        <>
          {/* User products section */}
          {userProducts.length > 0 && (
            <div className="mb-4">
              <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-3 mt-1">
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
                    <li
                      key={`user-${userProd.id}`}
                      className="flex items-start gap-4 p-4 bg-white border border-gray-100 rounded-2xl shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-200"
                    >
                      {/* Image */}
                      <img
                        src={userProd.image_url || PLACEHOLDER_IMAGE}
                        alt={userProd.name}
                        width={60}
                        height={60}
                        className="w-16 h-16 rounded-xl object-cover flex-shrink-0 bg-gray-100 border border-gray-100"
                        onError={(e) => {
                          (e.target as HTMLImageElement).src = PLACEHOLDER_IMAGE;
                        }}
                      />

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-gray-900 truncate">
                              {userProd.name}
                            </p>
                            {userProd.brand && (
                              <p className="text-xs text-gray-400">{userProd.brand}</p>
                            )}
                          </div>
                          <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-purple-100 text-purple-700 flex-shrink-0">
                            Eigenes
                          </span>
                        </div>

                        <div className="mt-1.5 flex flex-wrap items-center gap-2">
                          <span className="inline-flex items-center px-2.5 py-1 bg-gradient-to-r from-emerald-500 to-green-600 text-white text-xs font-bold rounded-full">
                            €{userProd.price.toFixed(2)}/Packung
                          </span>
                          {(() => {
                            const mp = calcMonthlyPrice(userProd.price, userProd.servings_per_container, userProd.container_count);
                            return mp != null ? (
                              <span className="inline-flex items-center px-2.5 py-1 bg-indigo-50 text-indigo-700 text-xs font-semibold rounded-full border border-indigo-100">
                                ≈ €{mp.toFixed(2)}/Mo.
                              </span>
                            ) : null;
                          })()}
                        </div>

                        <button
                          onClick={() => onSelect(asProduct)}
                          className="mt-2 w-full px-4 py-2 text-sm font-semibold bg-gradient-to-r from-indigo-500 to-purple-600 text-white rounded-xl hover:from-indigo-600 hover:to-purple-700 transition-all"
                        >
                          Auswählen
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>

              {/* Divider between user products and global products */}
              {items.length > 0 && (
                <hr className="mt-4 border-gray-200" />
              )}
            </div>
          )}

          {/* Global product list */}
          {items.length > 0 && (
            <ul className="space-y-3">
              {items.map(({ product, recType }) => {
                const mainIng = product.ingredients?.find(
                  (i) => i.ingredient_id === ingredientId,
                );

                return (
                  <li
                    key={product.id}
                    className="flex items-start gap-4 p-4 bg-white border border-gray-100 rounded-2xl shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-200"
                  >
                    {/* Image */}
                    <img
                      src={product.image_url || PLACEHOLDER_IMAGE}
                      alt={product.name}
                      width={60}
                      height={60}
                      className="w-16 h-16 rounded-xl object-cover flex-shrink-0 bg-gray-100 border border-gray-100"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = PLACEHOLDER_IMAGE;
                      }}
                    />

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-gray-900 truncate">
                            {product.name}
                          </p>
                          {product.brand && (
                            <p className="text-xs text-gray-400">{product.brand}</p>
                          )}
                        </div>
                        <BadgeRec type={recType} />
                      </div>

                      <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1">
                        <span className="inline-flex items-center px-2.5 py-1 bg-gradient-to-r from-emerald-500 to-green-600 text-white text-xs font-bold rounded-full">
                          €{product.price.toFixed(2)}/Packung
                        </span>
                        {(() => {
                          const mp = calcMonthlyPrice(product.price, product.servings_per_container, product.container_count);
                          return mp != null ? (
                            <span className="inline-flex items-center px-2.5 py-1 bg-indigo-50 text-indigo-700 text-xs font-semibold rounded-full border border-indigo-100">
                              ≈ €{mp.toFixed(2)}/Mo.
                            </span>
                          ) : null;
                        })()}
                        {mainIng?.quantity != null && (
                          <span className="text-xs text-gray-400">
                            {mainIng.quantity}{mainIng.unit ?? ''} pro Portion
                          </span>
                        )}
                        {mainIng?.quantity != null && mainIng.unit && recommendedDose && (() => {
                          const s = calcServingsPerDay(recommendedDose, mainIng.quantity!, mainIng.unit!);
                          return s != null ? (
                            <span className="text-xs font-semibold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full">
                              ca. {s}×/Tag
                            </span>
                          ) : null;
                        })()}
                      </div>

                      <button
                        onClick={() => onSelect(product)}
                        className="mt-2 w-full px-4 py-2 text-sm font-semibold bg-gradient-to-r from-indigo-500 to-purple-600 text-white rounded-xl hover:from-indigo-600 hover:to-purple-700 transition-all"
                      >
                        Auswählen
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </>
      )}
    </ModalWrapper>
  );
}
