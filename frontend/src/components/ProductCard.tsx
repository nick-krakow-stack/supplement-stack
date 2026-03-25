import { Heart, Package, ShoppingBag } from 'lucide-react';

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
}

interface ProductCardProps {
  product: ProductCardProduct;
  onAddToWishlist?: () => void;
  onSelect?: () => void;
  recommendationType?: 'recommended' | 'alternative' | null;
  showWishlistButton?: boolean;
  showSelectButton?: boolean;
}

export default function ProductCard({
  product,
  onAddToWishlist,
  onSelect,
  recommendationType,
  showWishlistButton = false,
  showSelectButton = false,
}: ProductCardProps) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 flex flex-col gap-3 hover:shadow-md transition-shadow">
      {product.discontinued_at && (
        <div className="bg-gray-100 border border-gray-300 rounded-lg px-3 py-2 mb-3 text-sm text-gray-600 flex items-center gap-2">
          <span>⚠️</span>
          <span>Dieses Produkt ist eingestellt.</span>
        </div>
      )}
      <div className="flex gap-3">
        {/* Product image */}
        <div className="flex-shrink-0 w-[60px] h-[60px] rounded-lg bg-gray-100 overflow-hidden flex items-center justify-center">
          {product.image_url ? (
            <img
              src={product.image_url}
              alt={product.name}
              className="w-full h-full object-cover"
            />
          ) : (
            <Package size={28} className="text-gray-400" />
          )}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="font-semibold text-gray-900 truncate">{product.name}</p>
              {product.brand && (
                <p className="text-sm text-gray-500 truncate">{product.brand}</p>
              )}
            </div>
            {recommendationType && (
              <span
                className={`flex-shrink-0 text-xs font-medium px-2 py-0.5 rounded-full ${
                  recommendationType === 'recommended'
                    ? 'bg-green-100 text-green-700'
                    : 'bg-blue-100 text-blue-700'
                }`}
              >
                {recommendationType === 'recommended' ? 'Empfohlen' : 'Alternative'}
              </span>
            )}
          </div>
          <p className="mt-1 text-green-600 font-bold text-sm">
            €{product.price.toFixed(2)}/Monat
          </p>
        </div>
      </div>

      {/* Buttons */}
      {(product.shop_link || showWishlistButton || showSelectButton) && (
        <div className="flex flex-wrap gap-2">
          {product.shop_link && (
            <a
              href={product.shop_link}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-sm bg-gray-200 text-gray-700 hover:bg-gray-300 px-3 py-1.5 rounded-lg font-medium transition-colors"
            >
              <ShoppingBag size={14} />
              Bei Amazon kaufen
              {product.is_affiliate === 1 && (
                <span className="ml-1 text-xs bg-amber-100 text-amber-700 border border-amber-300 rounded px-1 py-0 align-middle">
                  Werbelink
                </span>
              )}
            </a>
          )}
          {showWishlistButton && onAddToWishlist && (
            <button
              onClick={onAddToWishlist}
              className="inline-flex items-center gap-1.5 text-sm border border-gray-300 text-gray-700 hover:bg-gray-50 px-3 py-1.5 rounded-lg font-medium transition-colors"
            >
              <Heart size={14} />
              Zur Wunschliste
            </button>
          )}
          {showSelectButton && onSelect && (
            <button
              onClick={onSelect}
              className="inline-flex items-center gap-1.5 text-sm bg-blue-500 text-white hover:bg-blue-600 px-3 py-1.5 rounded-lg font-medium transition-colors"
            >
              Auswählen
            </button>
          )}
        </div>
      )}
    </div>
  );
}
