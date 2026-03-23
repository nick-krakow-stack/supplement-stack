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

const PLACEHOLDER_IMAGE =
  'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="60" height="60" viewBox="0 0 60 60"%3E%3Crect width="60" height="60" fill="%23f3f4f6"/%3E%3Ctext x="50%25" y="54%25" dominant-baseline="middle" text-anchor="middle" font-size="24" fill="%239ca3af"%3E💊%3C/text%3E%3C/svg%3E';

function BadgeRec({ type }: { type: RecommendationType }) {
  if (type === 'recommended') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-semibold rounded-full bg-green-100 text-green-700">
        <Star size={10} />
        Empfohlen
      </span>
    );
  }
  if (type === 'alternative') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-semibold rounded-full bg-blue-100 text-blue-700">
        Alternative
      </span>
    );
  }
  return null;
}

export default function Modal2Products({
  ingredientId,
  ingredientName,
  onClose,
  onBack,
  onSelect,
}: Modal2ProductsProps) {
  const [items, setItems] = useState<ProductWithRec[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const fetchAll = async () => {
      setLoading(true);
      setError(null);

      try {
        // Fetch recommendations and all products in parallel
        const [recRes, prodRes] = await Promise.all([
          fetch(`/api/recommendations?ingredient_id=${ingredientId}`),
          fetch(`/api/products`),
        ]);

        if (!recRes.ok && recRes.status !== 404) {
          throw new Error(`Empfehlungen: HTTP ${recRes.status}`);
        }
        if (!prodRes.ok) throw new Error(`Produkte: HTTP ${prodRes.status}`);

        const recData = recRes.ok ? await recRes.json() : { recommendations: [] };
        const prodData = await prodRes.json();

        if (cancelled) return;

        const recommendations: Recommendation[] = recData.recommendations ?? [];
        const allProducts: Product[] = prodData.products ?? [];

        // Build a map for quick lookup
        const recMap = new Map<number, RecommendationType>();
        recommendations.forEach((r) => {
          recMap.set(r.product_id, r.type === 'recommended' ? 'recommended' : 'alternative');
        });

        // Filter products that contain this ingredient
        const filtered = allProducts.filter((p) => {
          if (!p.ingredients || p.ingredients.length === 0) return false;
          return p.ingredients.some((ing) => ing.ingredient_id === ingredientId);
        });

        // If no ingredient filtering works (API may not include ingredient list in list view),
        // show all rec products for this ingredient + rest
        const recProductIds = new Set(recommendations.map((r) => r.product_id));

        // Determine which products to show
        let toShow: Product[];
        if (filtered.length > 0) {
          toShow = filtered;
        } else {
          // Fall back: show rec'd products plus all products (the API may not embed ingredients in list)
          const recProducts = allProducts.filter((p) => recProductIds.has(p.id));
          toShow = recProducts.length > 0 ? recProducts : allProducts;
        }

        // Sort: recommended first, then alternatives, then others
        const withRec: ProductWithRec[] = toShow.map((p) => ({
          product: p,
          recType: recMap.get(p.id) ?? 'other',
        }));

        const order: Record<RecommendationType, number> = {
          recommended: 0,
          alternative: 1,
          other: 2,
        };

        withRec.sort((a, b) => order[a.recType] - order[b.recType]);

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
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
            aria-label="Zurück"
          >
            <ChevronLeft size={20} />
          </button>
          <div>
            <h2 className="text-lg font-bold text-gray-900 leading-tight">Produkte</h2>
            <p className="text-xs text-gray-500">{ingredientName}</p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
          aria-label="Schließen"
        >
          <X size={20} />
        </button>
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-12">
          <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mr-3" />
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

      {/* Empty state */}
      {!loading && !error && items.length === 0 && (
        <div className="py-12 text-center">
          <ShoppingCart size={40} className="mx-auto text-gray-300 mb-3" />
          <p className="text-gray-500 text-sm">
            Keine Produkte für diesen Wirkstoff gefunden.
          </p>
        </div>
      )}

      {/* Product list */}
      {!loading && !error && items.length > 0 && (
        <ul className="space-y-3">
          {items.map(({ product, recType }) => {
            const mainIng = product.ingredients?.find(
              (i) => i.ingredient_id === ingredientId,
            );

            return (
              <li
                key={product.id}
                className="flex items-start gap-3 p-3 border border-gray-200 rounded-xl hover:border-blue-200 hover:bg-blue-50/30 transition-colors"
              >
                {/* Image */}
                <img
                  src={product.image_url || PLACEHOLDER_IMAGE}
                  alt={product.name}
                  width={60}
                  height={60}
                  className="w-[60px] h-[60px] rounded-lg object-cover flex-shrink-0 bg-gray-100"
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
                        <p className="text-xs text-gray-500">{product.brand}</p>
                      )}
                    </div>
                    <BadgeRec type={recType} />
                  </div>

                  <div className="mt-1.5 flex items-center gap-3">
                    <span className="text-sm font-bold text-gray-900">
                      €{product.price.toFixed(2)}
                    </span>
                    {mainIng && (
                      <span className="text-xs text-gray-500">
                        {mainIng.quantity != null
                          ? `${mainIng.quantity}${mainIng.unit ?? ''} pro Portion`
                          : mainIng.ingredient_name ?? ingredientName}
                      </span>
                    )}
                  </div>

                  <button
                    onClick={() => onSelect(product)}
                    className="mt-2 px-3 py-1.5 text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
                  >
                    Auswählen
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </ModalWrapper>
  );
}
