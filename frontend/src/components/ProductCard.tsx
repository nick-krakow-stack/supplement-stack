import { Heart, ShoppingBag } from 'lucide-react';
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
}

interface ProductCardProps {
  product: ProductCardProduct;
  onAddToWishlist?: () => void;
  onSelect?: () => void;
  recommendationType?: 'recommended' | 'alternative' | null;
  showWishlistButton?: boolean;
  showSelectButton?: boolean;
  shopDomains?: ShopDomain[];
}

export default function ProductCard({
  product,
  onAddToWishlist,
  onSelect,
  recommendationType,
  showWishlistButton = false,
  showSelectButton = false,
  shopDomains,
}: ProductCardProps) {
  const matchedShop = shopDomains?.find(
    (s) => product.shop_link?.toLowerCase().includes(s.domain.toLowerCase())
  );
  const buttonText = matchedShop ? `Bei ${matchedShop.display_name} kaufen` : 'Jetzt kaufen';

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm hover:-translate-y-0.5 hover:shadow-md transition-all duration-200 overflow-hidden flex flex-col">
      {/* Product image / placeholder */}
      {product.image_url ? (
        <img
          src={product.image_url}
          alt={product.name}
          className="w-full h-32 object-cover"
        />
      ) : (
        <div className="h-28 bg-gradient-to-br from-indigo-100 to-purple-100 flex items-center justify-center text-4xl">
          💊
        </div>
      )}

      {/* Discontinued banner */}
      {product.discontinued_at && (
        <div className="bg-red-50 text-red-500 text-xs font-medium px-3 py-2 text-center border-t border-red-100">
          Dieses Produkt ist eingestellt.
        </div>
      )}

      {/* Card body */}
      <div className="p-4 flex flex-col flex-1 gap-2">
        {/* Name, brand, recommendation badge */}
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-gray-900 leading-tight truncate">{product.name}</p>
            {product.brand && (
              <p className="text-xs text-gray-500 mt-0.5 truncate">{product.brand}</p>
            )}
          </div>
          {recommendationType && (
            <span
              className={`flex-shrink-0 text-xs font-medium px-2 py-0.5 rounded-full ${
                recommendationType === 'recommended'
                  ? 'bg-green-100 text-green-700'
                  : 'bg-indigo-100 text-indigo-700'
              }`}
            >
              {recommendationType === 'recommended' ? 'Empfohlen' : 'Alternative'}
            </span>
          )}
        </div>

        {/* Price badge */}
        <div>
          <span className="inline-flex items-center px-2.5 py-1 bg-gradient-to-r from-emerald-500 to-green-600 text-white text-xs font-bold rounded-full">
            €{product.price.toFixed(2)}/Monat
          </span>
        </div>

        {/* Buttons */}
        {(product.shop_link || showWishlistButton || showSelectButton) && (
          <div className="flex flex-wrap gap-2 mt-auto">
            {product.shop_link && (
              <a
                href={product.shop_link}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 inline-flex items-center justify-center gap-1.5 bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white font-semibold rounded-xl transition-all duration-200 shadow-sm text-xs py-2"
              >
                <ShoppingBag size={13} />
                {buttonText}
                {product.is_affiliate === 1 && (
                  <span className="ml-1 text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-medium">
                    Werbelink
                  </span>
                )}
              </a>
            )}
            {showWishlistButton && onAddToWishlist && (
              <button
                onClick={onAddToWishlist}
                className="p-1.5 text-gray-300 hover:text-red-400 transition-colors"
                aria-label="Zur Wunschliste"
              >
                <Heart size={16} />
              </button>
            )}
            {showSelectButton && onSelect && (
              <button
                onClick={onSelect}
                className="inline-flex items-center gap-1.5 border border-gray-200 bg-white hover:bg-gray-50 text-gray-700 font-medium rounded-xl transition-colors text-xs py-2 px-3"
              >
                Auswählen
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
