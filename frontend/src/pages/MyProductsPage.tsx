import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Pencil, Trash2, Info } from 'lucide-react';
import UserProductForm, { UserProduct } from '../components/modals/UserProductForm';

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

// ---- Skeleton row ----
function SkeletonRow() {
  return (
    <div className="flex items-center gap-4 p-4 animate-pulse max-[430px]:items-start">
      <div className="flex-1 flex flex-col gap-2">
        <div className="h-4 bg-gray-200 rounded w-1/3" />
        <div className="h-3 bg-gray-100 rounded w-1/4" />
      </div>
      <div className="h-4 bg-gray-200 rounded w-16" />
      <div className="flex gap-2">
        <div className="h-8 w-8 bg-gray-100 rounded-lg" />
        <div className="h-8 w-8 bg-gray-100 rounded-lg" />
      </div>
    </div>
  );
}

// ---- Form badge ----
function FormBadge({ form }: { form: string }) {
  return (
    <span className="inline-block bg-indigo-50 text-indigo-700 text-xs font-medium px-2 py-0.5 rounded-full">
      {form}
    </span>
  );
}

// ---- Product row ----
function ProductRow({
  product,
  onEdit,
  onDelete,
  deleting,
}: {
  product: UserProduct;
  onEdit: (p: UserProduct) => void;
  onDelete: (id: number) => void;
  deleting: boolean;
}) {
  const servingInfo =
    product.serving_size != null && product.serving_unit
      ? `${product.serving_size} ${product.serving_unit}`
      : product.serving_size != null
      ? String(product.serving_size)
      : null;

  return (
    <div className="flex items-start gap-3 px-4 py-3 transition-colors hover:bg-gray-50 max-[430px]:flex-col">
      {/* Main info */}
      <div className="flex-1 min-w-0 flex flex-col gap-0.5">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="min-w-0 break-words font-medium text-gray-900">{product.name}</span>
          {product.form && <FormBadge form={product.form} />}
        </div>
        <div className="flex items-center gap-3 text-sm text-gray-500 flex-wrap">
          {product.brand && <span>{product.brand}</span>}
          {servingInfo && <span>{servingInfo}</span>}
          {product.servings_per_container != null && (
            <span>{product.servings_per_container} Portionen</span>
          )}
        </div>
      </div>

      {/* Price */}
      <span className="text-sm font-semibold text-emerald-600 max-[430px]:w-full">
        €{Number(product.price).toFixed(2)}/Mo.
      </span>

      {/* Actions */}
      <div className="flex flex-shrink-0 items-center gap-2 max-[430px]:w-full">
        <button
          onClick={() => onEdit(product)}
          className="flex h-11 w-11 items-center justify-center rounded-lg text-gray-500 transition-colors hover:bg-indigo-50 hover:text-indigo-600 max-[430px]:flex-1"
          aria-label={`${product.name} bearbeiten`}
          title="Bearbeiten"
        >
          <Pencil size={16} />
        </button>
        <button
          onClick={() => onDelete(product.id)}
          disabled={deleting}
          className="flex h-11 w-11 items-center justify-center rounded-lg text-gray-500 transition-colors hover:bg-red-50 hover:text-red-600 disabled:opacity-50 max-[430px]:flex-1"
          aria-label={`${product.name} löschen`}
          title="Löschen"
        >
          <Trash2 size={16} />
        </button>
      </div>
    </div>
  );
}

// ---- Main page ----
export default function MyProductsPage() {
  const token = getToken();

  const [products, setProducts] = useState<UserProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const [showForm, setShowForm] = useState(false);
  const [editingProduct, setEditingProduct] = useState<UserProduct | undefined>(undefined);

  const loadProducts = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/user-products', { headers: authHeaders() });
      if (!res.ok) throw new Error('Fehler beim Laden der Produkte.');
      const data = await res.json();
      setProducts(data.products ?? []);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Unbekannter Fehler.');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    loadProducts();
  }, [loadProducts]);

  const handleOpenCreate = () => {
    setEditingProduct(undefined);
    setShowForm(true);
  };

  const handleOpenEdit = (product: UserProduct) => {
    setEditingProduct(product);
    setShowForm(true);
  };

  const handleCloseForm = () => {
    setShowForm(false);
    setEditingProduct(undefined);
  };

  const handleSaved = (saved: UserProduct) => {
    setProducts((prev) => {
      const exists = prev.some((p) => p.id === saved.id);
      if (exists) {
        return prev.map((p) => (p.id === saved.id ? saved : p));
      }
      return [...prev, saved];
    });
    setShowForm(false);
    setEditingProduct(undefined);
  };

  const handleDelete = async (id: number) => {
    const product = products.find((p) => p.id === id);
    if (!window.confirm(`Produkt "${product?.name ?? id}" wirklich löschen?`)) return;
    setDeletingId(id);
    try {
      const res = await fetch(`/api/user-products/${id}`, {
        method: 'DELETE',
        headers: authHeaders(),
      });
      if (!res.ok) throw new Error('Löschen fehlgeschlagen.');
      setProducts((prev) => prev.filter((p) => p.id !== id));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Löschen fehlgeschlagen.');
    } finally {
      setDeletingId(null);
    }
  };

  // Not logged in guard
  if (!token) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[40vh] gap-4 text-center">
        <h1 className="text-2xl font-bold text-gray-900">Bitte anmelden</h1>
        <p className="text-gray-600">Du musst angemeldet sein, um eigene Produkte zu verwalten.</p>
        <Link
          to="/login"
          className="bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white font-semibold px-5 py-2 rounded-xl transition-all duration-200 shadow-sm"
        >
          Zur Anmeldung
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-indigo-50/30 p-4 md:p-6">
    <div className="flex flex-col gap-6">
      {/* Page header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <h1 className="text-2xl font-bold text-gray-900">Eigene Produkte</h1>
        <button
          onClick={handleOpenCreate}
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 px-4 py-2 font-semibold text-white shadow-sm transition-all duration-200 hover:from-indigo-600 hover:to-purple-700 max-[430px]:w-full"
        >
          <Plus size={18} />
          Neues Produkt erstellen
        </button>
      </div>

      {/* Info banner */}
      <div className="flex items-start gap-2 bg-indigo-50 border border-indigo-100 text-indigo-700 rounded-xl px-4 py-3 text-sm">
        <Info size={16} className="flex-shrink-0 mt-0.5" />
        <span>Eigene Produkte sind nur für dich sichtbar.</span>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm">
          {error}
        </div>
      )}

      {/* Product list card */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        {/* Loading skeleton */}
        {loading && (
          <div className="divide-y divide-gray-100">
            <SkeletonRow />
            <SkeletonRow />
            <SkeletonRow />
          </div>
        )}

        {/* Empty state */}
        {!loading && !error && products.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 gap-3 text-center px-4">
            <p className="text-gray-500 text-base">
              Noch keine eigenen Produkte. Erstelle dein erstes Produkt!
            </p>
            <button
              onClick={handleOpenCreate}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 text-sm font-medium text-indigo-600 transition-colors hover:text-indigo-800"
            >
              <Plus size={16} />
              Produkt erstellen
            </button>
          </div>
        )}

        {/* Product rows */}
        {!loading && products.length > 0 && (
          <div className="divide-y divide-gray-100">
            {products.map((product) => (
              <ProductRow
                key={product.id}
                product={product}
                onEdit={handleOpenEdit}
                onDelete={handleDelete}
                deleting={deletingId === product.id}
              />
            ))}
          </div>
        )}
      </div>

      {/* Modal form */}
      {showForm && (
        <UserProductForm
          onClose={handleCloseForm}
          onSaved={handleSaved}
          initialProduct={editingProduct}
        />
      )}
    </div>
    </div>
  );
}
