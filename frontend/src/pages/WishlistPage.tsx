import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Trash2, Heart, Search } from 'lucide-react';
import { apiClient } from '../api/client';
import { useAuth } from '../contexts/AuthContext';
import ProductCard from '../components/ProductCard';
import { ShopDomain } from '../types/local';

// ---- Local types ----
interface WishlistProduct {
  id: number;
  name: string;
  brand?: string;
  price: number;
  shop_link?: string;
  image_url?: string;
}

// ---- Main page ----
export default function WishlistPage() {
  const { user } = useAuth();
  const [products, setProducts] = useState<WishlistProduct[]>([]);
  const [shopDomains, setShopDomains] = useState<ShopDomain[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [removingId, setRemovingId] = useState<number | null>(null);

  // Load shop domains (public endpoint, no token needed)
  useEffect(() => {
    apiClient
      .get<ShopDomain[]>('/shop-domains')
      .then((res) => {
        setShopDomains(res.data ?? []);
      })
      .catch(() => {
        // Graceful fallback: leave shopDomains empty, ProductCard handles it
      });
  }, []);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }
    apiClient
      .get<{ wishlist: WishlistProduct[] }>('/wishlist')
      .then((res) => {
        setProducts(res.data.wishlist ?? []);
      })
      .catch((e: unknown) => {
        setError(e instanceof Error ? e.message : 'Fehler beim Laden.');
      })
      .finally(() => setLoading(false));
  }, [user]);

  const handleRemove = async (productId: number) => {
    setRemovingId(productId);
    try {
      await apiClient.delete(`/wishlist/${productId}`);
      setProducts((prev) => prev.filter((p) => p.id !== productId));
    } catch {
      setError('Produkt konnte nicht entfernt werden.');
    } finally {
      setRemovingId(null);
    }
  };

  // Not logged in
  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[40vh] gap-4 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-indigo-50">
          <Heart size={32} className="text-indigo-400" />
        </div>
        <h1 className="text-2xl font-black tracking-tight text-slate-950">Bitte anmelden</h1>
        <p className="text-slate-500 font-semibold">Du musst angemeldet sein, um deine Wunschliste zu sehen.</p>
        <Link
          to="/login"
          className="inline-flex items-center justify-center rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 px-5 py-2.5 font-semibold text-white shadow-sm transition hover:opacity-90"
        >
          Zur Anmeldung
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-black tracking-tight text-slate-950">Wunschliste</h1>

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin border-4 border-indigo-500 border-t-transparent rounded-full w-8 h-8" />
        </div>
      )}

      {/* Error */}
      {error && !loading && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
          {error}
        </div>
      )}

      {/* Empty state */}
      {!loading && !error && products.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-center gap-4">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-100">
            <Heart size={32} className="text-slate-400" />
          </div>
          <div className="flex flex-col gap-1">
            <p className="text-base font-black text-slate-700">Deine Wunschliste ist leer</p>
            <p className="text-sm font-semibold text-slate-500">
              Speichere Produkte aus der Suche, um sie hier wiederzufinden.
            </p>
          </div>
          <Link
            to="/search"
            className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 px-4 py-2 font-semibold text-white shadow-sm transition hover:opacity-90"
          >
            <Search size={15} />
            Wirkstoffe suchen
          </Link>
        </div>
      )}

      {/* Product list */}
      {!loading && products.length > 0 && (
        <div className="flex flex-col gap-4">
          {products.map((product) => (
            <div key={product.id} className="relative">
              <ProductCard
                product={product}
                shopDomains={shopDomains}
              />
              <div className="mt-2 flex justify-end">
                <button
                  onClick={() => handleRemove(product.id)}
                  disabled={removingId === product.id}
                  className="inline-flex items-center gap-1.5 text-sm rounded-xl border border-red-200 text-red-600 hover:bg-red-50 px-3 py-1.5 font-semibold transition-colors disabled:opacity-50"
                >
                  <Trash2 size={14} />
                  Entfernen
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
