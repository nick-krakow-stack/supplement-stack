import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Trash2, ShoppingBag, Package } from 'lucide-react';

// ---- Local types ----
interface WishlistProduct {
  id: number;
  name: string;
  brand?: string;
  price: number;
  shop_link?: string;
  image_url?: string;
}

function getToken(): string | null {
  return localStorage.getItem('ss_token');
}

function authHeaders(): Record<string, string> {
  const token = getToken();
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

// ---- Product card row for wishlist ----
function WishlistCard({
  product,
  onRemove,
  removing,
}: {
  product: WishlistProduct;
  onRemove: (id: number) => void;
  removing: boolean;
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 flex gap-4 hover:shadow-md transition-shadow">
      {/* Image */}
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
      <div className="flex-1 min-w-0 flex flex-col gap-2">
        <div>
          <p className="font-semibold text-gray-900 truncate">{product.name}</p>
          {product.brand && (
            <p className="text-sm text-gray-500 truncate">{product.brand}</p>
          )}
          <p className="text-green-600 font-bold text-sm mt-0.5">
            €{product.price.toFixed(2)}/Monat
          </p>
        </div>

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
            </a>
          )}
          <button
            onClick={() => onRemove(product.id)}
            disabled={removing}
            className="inline-flex items-center gap-1.5 text-sm border border-red-200 text-red-600 hover:bg-red-50 px-3 py-1.5 rounded-lg font-medium transition-colors disabled:opacity-50"
          >
            <Trash2 size={14} />
            Entfernen
          </button>
        </div>
      </div>
    </div>
  );
}

// ---- Main page ----
export default function WishlistPage() {
  const token = getToken();
  const [products, setProducts] = useState<WishlistProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [removingId, setRemovingId] = useState<number | null>(null);

  useEffect(() => {
    if (!token) {
      setLoading(false);
      return;
    }
    fetch('/api/wishlist', { headers: authHeaders() })
      .then((r) => {
        if (!r.ok) throw new Error('Wunschliste konnte nicht geladen werden.');
        return r.json();
      })
      .then((data) => {
        setProducts(data.products ?? data.items ?? data ?? []);
      })
      .catch((e: unknown) => {
        setError(e instanceof Error ? e.message : 'Fehler beim Laden.');
      })
      .finally(() => setLoading(false));
  }, [token]);

  const handleRemove = async (productId: number) => {
    setRemovingId(productId);
    try {
      const res = await fetch(`/api/wishlist/${productId}`, {
        method: 'DELETE',
        headers: authHeaders(),
      });
      if (res.ok) {
        setProducts((prev) => prev.filter((p) => p.id !== productId));
      } else {
        setError('Produkt konnte nicht entfernt werden.');
      }
    } catch {
      setError('Netzwerkfehler.');
    } finally {
      setRemovingId(null);
    }
  };

  // Not logged in
  if (!token) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[40vh] gap-4 text-center">
        <h1 className="text-2xl font-bold text-gray-800">Bitte anmelden</h1>
        <p className="text-gray-600">Du musst angemeldet sein, um deine Wunschliste zu sehen.</p>
        <Link
          to="/login"
          className="bg-blue-500 text-white hover:bg-blue-600 px-5 py-2 rounded-lg font-medium transition-colors"
        >
          Zur Anmeldung
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold text-gray-900">Wunschliste</h1>

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin border-4 border-blue-500 border-t-transparent rounded-full w-8 h-8" />
        </div>
      )}

      {/* Error */}
      {error && !loading && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3">
          {error}
        </div>
      )}

      {/* Empty state */}
      {!loading && !error && products.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-center gap-3">
          <p className="text-gray-500 text-lg">Deine Wunschliste ist leer.</p>
          <Link
            to="/"
            className="text-blue-500 hover:text-blue-600 font-medium transition-colors"
          >
            Wirkstoffe suchen →
          </Link>
        </div>
      )}

      {/* Product list */}
      {!loading && products.length > 0 && (
        <div className="flex flex-col gap-4">
          {products.map((product) => (
            <WishlistCard
              key={product.id}
              product={product}
              onRemove={handleRemove}
              removing={removingId === product.id}
            />
          ))}
        </div>
      )}
    </div>
  );
}
