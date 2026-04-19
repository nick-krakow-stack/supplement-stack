import React, { useEffect, useState, useCallback } from 'react';
import {
  CheckCircle,
  XCircle,
  AlertTriangle,
  BarChart3,
  Settings,
  Trash2,
  Plus,
} from 'lucide-react';
import ImageCropModal from '../components/ImageCropModal';

// ---- Local types ----
interface AdminProduct {
  id: number;
  name: string;
  brand?: string;
  price: number;
  moderation_status?: string;
  visibility?: string;
  image_url?: string;
  is_affiliate?: number;
  shop_link?: string;
  timing?: string;
  dosage_text?: string;
  effect_summary?: string;
  warning_title?: string;
  warning_message?: string;
  warning_type?: string;
  alternative_note?: string;
}

interface AdminUserProduct {
  id: number;
  user_id: number;
  user_email?: string;
  name: string;
  brand?: string;
  form?: string;
  price: number;
  shop_link?: string;
  serving_size?: number;
  serving_unit?: string;
  servings_per_container?: number;
  container_count?: number;
  is_affiliate?: number;
  notes?: string;
  status: 'pending' | 'approved' | 'rejected';
  created_at: string;
}

interface Ingredient {
  id: number;
  name: string;
  unit?: string;
  description?: string;
}

interface Interaction {
  id: number;
  ingredient_a_id: number;
  ingredient_b_id: number;
  ingredient_a_name?: string;
  ingredient_b_name?: string;
  type: 'danger' | 'caution' | string;
  comment: string;
}

interface AdminStats {
  users?: number;
  ingredients?: number;
  products_total?: number;
  products_pending?: number;
  stacks?: number;
  [key: string]: number | undefined;
}

type ProductDetailPatch = Pick<
  AdminProduct,
  | 'timing'
  | 'dosage_text'
  | 'effect_summary'
  | 'warning_title'
  | 'warning_message'
  | 'warning_type'
  | 'alternative_note'
  | 'is_affiliate'
>;

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

type Tab = 'products' | 'ingredients' | 'interactions' | 'stats' | 'shop_domains' | 'rankings' | 'user_products';

// ---- Status badge ----
function StatusBadge({ status }: { status?: string }) {
  if (status === 'approved') {
    return (
      <span className="inline-flex items-center gap-1 bg-green-100 text-green-700 text-xs font-medium px-2 py-0.5 rounded-full">
        <CheckCircle size={12} /> Freigegeben
      </span>
    );
  }
  if (status === 'rejected') {
    return (
      <span className="inline-flex items-center gap-1 bg-red-100 text-red-700 text-xs font-medium px-2 py-0.5 rounded-full">
        <XCircle size={12} /> Abgelehnt
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 bg-yellow-100 text-yellow-700 text-xs font-medium px-2 py-0.5 rounded-full">
      <AlertTriangle size={12} /> Ausstehend
    </span>
  );
}

// ============================================================
// Tab 1: Products
// ============================================================
function ProductsTab() {
  const [products, setProducts] = useState<AdminProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionLoading, setActionLoading] = useState<number | null>(null);
  const [filterNoAffiliate, setFilterNoAffiliate] = useState(false);
  const [cropModalProductId, setCropModalProductId] = useState<number | null>(null);

  const handleImageUploadSuccess = (productId: number, imageUrl: string) => {
    setProducts((prev) =>
      prev.map((p) => p.id === productId ? { ...p, image_url: imageUrl } : p)
    );
    setCropModalProductId(null);
  };

  useEffect(() => {
    fetch('/api/admin/products', { headers: authHeaders() })
      .then((r) => {
        if (!r.ok) throw new Error('Produkte konnten nicht geladen werden.');
        return r.json();
      })
      .then((data) => setProducts(data.products ?? data ?? []))
      .catch((e: unknown) => setError(e instanceof Error ? e.message : 'Fehler.'))
      .finally(() => setLoading(false));
  }, []);

  const updateProduct = async (
    id: number,
    body: { moderation_status?: string; visibility?: string; is_affiliate?: number }
  ) => {
    setActionLoading(id);
    try {
      const res = await fetch(`/api/products/${id}/status`, {
        method: 'PUT',
        headers: authHeaders(),
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error('Aktion fehlgeschlagen.');
      const data = await res.json();
      const updated = data.product ?? data;
      setProducts((prev) =>
        prev.map((p) =>
          p.id === id
            ? {
                ...p,
                moderation_status: updated.moderation_status ?? body.moderation_status ?? p.moderation_status,
                visibility: updated.visibility ?? body.visibility ?? p.visibility,
                is_affiliate: updated.is_affiliate ?? body.is_affiliate ?? p.is_affiliate,
              }
            : p
        )
      );
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Fehler.');
    } finally {
      setActionLoading(null);
    }
  };

  const updateProductField = (
    id: number,
    field: keyof ProductDetailPatch,
    value: string | number
  ) => {
    setProducts((prev) =>
      prev.map((product) => (product.id === id ? { ...product, [field]: value } : product))
    );
  };

  const saveProductDetails = async (product: AdminProduct) => {
    setActionLoading(product.id);
    setError('');
    try {
      const body: ProductDetailPatch = {
        timing: product.timing?.trim() ?? '',
        dosage_text: product.dosage_text?.trim() ?? '',
        effect_summary: product.effect_summary?.trim() ?? '',
        warning_title: product.warning_title?.trim() ?? '',
        warning_message: product.warning_message?.trim() ?? '',
        warning_type: product.warning_type?.trim() ?? '',
        alternative_note: product.alternative_note?.trim() ?? '',
        is_affiliate: product.is_affiliate ? 1 : 0,
      };
      const res = await fetch(`/api/products/${product.id}`, {
        method: 'PUT',
        headers: authHeaders(),
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error('Produktdetails konnten nicht gespeichert werden.');
      const data = await res.json();
      const updated = data.product ?? data;
      setProducts((prev) =>
        prev.map((p) => (p.id === product.id ? { ...p, ...updated } : p))
      );
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Fehler.');
    } finally {
      setActionLoading(null);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-10">
        <div className="animate-spin border-4 border-indigo-500 border-t-transparent rounded-full w-8 h-8" />
      </div>
    );
  }

  const visibleProducts = filterNoAffiliate
    ? products.filter((p) => p.shop_link && !p.is_affiliate)
    : products;

  return (
    <div className="flex flex-col gap-4">
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm">
          {error}
        </div>
      )}
      {/* Affiliate filter */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => setFilterNoAffiliate((v) => !v)}
          className={`px-3 py-1.5 text-xs font-medium rounded-full transition-colors ${
            filterNoAffiliate
              ? 'bg-amber-100 text-amber-700'
              : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
          }`}
        >
          Ohne Affiliate-Tag
        </button>
        {filterNoAffiliate && (
          <span className="text-xs text-gray-500">{visibleProducts.length} Produkt(e) mit Shop-Link aber ohne Affiliate-Tag</span>
        )}
      </div>
      {visibleProducts.length === 0 && !error && (
        <p className="text-gray-500">Keine Produkte vorhanden.</p>
      )}
      {cropModalProductId !== null && (
        <ImageCropModal
          productId={cropModalProductId}
          currentImageUrl={products.find((p) => p.id === cropModalProductId)?.image_url}
          onSuccess={(imageUrl) => handleImageUploadSuccess(cropModalProductId, imageUrl)}
          onClose={() => setCropModalProductId(null)}
        />
      )}

      <div className="flex flex-col gap-3">
        {visibleProducts.map((product) => (
          <div
            key={product.id}
            className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex flex-col gap-3"
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="font-semibold text-gray-900 truncate">{product.name}</p>
                {product.brand && (
                  <p className="text-sm text-gray-500">{product.brand}</p>
                )}
                <p className="text-sm text-green-600 font-bold">€{product.price.toFixed(2)}/Monat</p>
                <div className="mt-1">
                  <StatusBadge status={product.moderation_status} />
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() =>
                    updateProduct(product.id, {
                      moderation_status: 'approved',
                      visibility: 'public',
                    })
                  }
                  disabled={actionLoading === product.id}
                  className="text-sm bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-600 hover:to-green-700 text-white px-3 py-1.5 rounded-xl font-medium transition-all shadow-sm disabled:opacity-50"
                >
                  Freigeben
                </button>
                <button
                  onClick={() =>
                    updateProduct(product.id, {
                      moderation_status: 'rejected',
                      visibility: 'hidden',
                    })
                  }
                  disabled={actionLoading === product.id}
                  className="text-sm bg-red-500 hover:bg-red-600 text-white px-3 py-1.5 rounded-xl font-medium transition-colors disabled:opacity-50"
                >
                  Ablehnen
                </button>
                <button
                  onClick={() => updateProduct(product.id, { visibility: 'hidden' })}
                  disabled={actionLoading === product.id}
                  className="text-sm bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 px-3 py-1.5 rounded-xl font-medium transition-colors disabled:opacity-50"
                >
                  Verbergen
                </button>
              </div>
            </div>

            {/* Affiliate-Link toggle */}
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id={`is_affiliate_${product.id}`}
                checked={!!product.is_affiliate}
                onChange={(e) =>
                  updateProductField(product.id, 'is_affiliate', e.target.checked ? 1 : 0)
                }
              />
              <label htmlFor={`is_affiliate_${product.id}`} className="text-sm font-medium text-gray-700">
                Affiliate-Link
              </label>
            </div>

            {/* Product card metadata */}
            <div className="rounded-2xl border border-indigo-100 bg-indigo-50/40 p-3">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold text-gray-900">Karteninfos</p>
                  <p className="text-xs text-gray-500">
                    Diese Angaben erscheinen direkt auf den Produktkarten.
                  </p>
                </div>
                <button
                  onClick={() => saveProductDetails(product)}
                  disabled={actionLoading === product.id}
                  className="text-sm bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1.5 rounded-xl font-medium transition-colors disabled:opacity-50"
                >
                  Speichern
                </button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <input
                  value={product.timing ?? ''}
                  onChange={(e) => updateProductField(product.id, 'timing', e.target.value)}
                  placeholder="Timing, z.B. Zum Frühstück"
                  className="border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-400"
                />
                <input
                  value={product.dosage_text ?? ''}
                  onChange={(e) => updateProductField(product.id, 'dosage_text', e.target.value)}
                  placeholder="Dosierung, z.B. 2 Kapseln täglich (888mg)"
                  className="border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-400"
                />
                <input
                  value={product.effect_summary ?? ''}
                  onChange={(e) => updateProductField(product.id, 'effect_summary', e.target.value)}
                  placeholder="Wirkung, z.B. Muskel- & Nervenfunktion"
                  className="md:col-span-2 border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-400"
                />
                <input
                  value={product.warning_title ?? ''}
                  onChange={(e) => updateProductField(product.id, 'warning_title', e.target.value)}
                  placeholder="Hinweis-Titel"
                  className="border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-400"
                />
                <select
                  value={product.warning_type ?? 'caution'}
                  onChange={(e) => updateProductField(product.id, 'warning_type', e.target.value)}
                  className="border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-400"
                >
                  <option value="caution">Warnung: Vorsicht</option>
                  <option value="danger">Warnung: Kritisch</option>
                  <option value="info">Hinweis: Info</option>
                </select>
                <textarea
                  value={product.warning_message ?? ''}
                  onChange={(e) => updateProductField(product.id, 'warning_message', e.target.value)}
                  placeholder="Hinweistext, z.B. nicht direkt mit Kaffee kombinieren..."
                  rows={2}
                  className="md:col-span-2 border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-400"
                />
                <input
                  value={product.alternative_note ?? ''}
                  onChange={(e) => updateProductField(product.id, 'alternative_note', e.target.value)}
                  placeholder="Alternativprodukt-Hinweis"
                  className="md:col-span-2 border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-400"
                />
              </div>
            </div>

            {/* Image upload */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Produktbild</label>
              {product.image_url && (
                <img src={product.image_url} alt="" className="w-16 h-16 object-cover rounded mb-2" />
              )}
              <button
                type="button"
                onClick={() => setCropModalProductId(product.id)}
                className="text-sm bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 px-3 py-1.5 rounded-xl font-medium transition-colors"
              >
                {product.image_url ? 'Bild ersetzen' : 'Bild hochladen'}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================================
// Tab 2: Ingredients
// ============================================================
interface IngredientWithEdit extends Ingredient {
  editing?: boolean;
  editName?: string;
  editUnit?: string;
  editDesc?: string;
  newSynonym?: string;
  newFormName?: string;
  newFormComment?: string;
}

function IngredientsTab() {
  const [ingredients, setIngredients] = useState<IngredientWithEdit[]>([]);
  const [allIngredients, setAllIngredients] = useState<Ingredient[]>([]);
  const [allProducts, setAllProducts] = useState<{ id: number; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Create form state
  const [newName, setNewName] = useState('');
  const [newUnit, setNewUnit] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState('');

  // Recommendation form
  const [recIngredientId, setRecIngredientId] = useState('');
  const [recProductId, setRecProductId] = useState('');
  const [recType, setRecType] = useState<'empfohlen' | 'alternative'>('empfohlen');
  const [recSaving, setRecSaving] = useState(false);
  const [recError, setRecError] = useState('');
  const [recSuccess, setRecSuccess] = useState('');

  const load = useCallback(() => {
    fetch('/api/ingredients', { headers: authHeaders() })
      .then((r) => r.json())
      .then((data) => {
        const list: Ingredient[] = data.ingredients ?? data ?? [];
        setIngredients(list.map((i) => ({ ...i })));
        setAllIngredients(list);
      })
      .catch((e: unknown) => setError(e instanceof Error ? e.message : 'Fehler.'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
    // Load products for recommendation dropdown
    fetch('/api/products', { headers: authHeaders() })
      .then((r) => r.json())
      .then((data) => setAllProducts(data.products ?? []))
      .catch(() => {});
  }, [load]);

  const setField = (id: number, field: Partial<IngredientWithEdit>) => {
    setIngredients((prev) => prev.map((i) => (i.id === id ? { ...i, ...field } : i)));
  };

  const startEdit = (ingredient: IngredientWithEdit) => {
    setField(ingredient.id, {
      editing: true,
      editName: ingredient.name,
      editUnit: ingredient.unit ?? '',
      editDesc: ingredient.description ?? '',
      newSynonym: '',
      newFormName: '',
      newFormComment: '',
    });
  };

  const saveEdit = async (ingredient: IngredientWithEdit) => {
    try {
      const res = await fetch(`/api/ingredients/${ingredient.id}`, {
        method: 'PUT',
        headers: authHeaders(),
        body: JSON.stringify({
          name: ingredient.editName,
          unit: ingredient.editUnit || undefined,
          description: ingredient.editDesc || undefined,
        }),
      });
      if (!res.ok) throw new Error('Speichern fehlgeschlagen.');
      setField(ingredient.id, {
        editing: false,
        name: ingredient.editName ?? ingredient.name,
        unit: ingredient.editUnit || ingredient.unit,
        description: ingredient.editDesc || ingredient.description,
      });
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Fehler.');
    }
  };

  const addSynonym = async (ingredient: IngredientWithEdit) => {
    const synonym = ingredient.newSynonym?.trim();
    if (!synonym) return;
    try {
      const res = await fetch(`/api/ingredients/${ingredient.id}/synonyms`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ synonym }),
      });
      if (!res.ok) throw new Error('Synonym konnte nicht hinzugefügt werden.');
      setField(ingredient.id, { newSynonym: '' });
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Fehler.');
    }
  };

  const addForm = async (ingredient: IngredientWithEdit) => {
    const name = ingredient.newFormName?.trim();
    if (!name) return;
    try {
      const res = await fetch(`/api/ingredients/${ingredient.id}/forms`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({
          name,
          comment: ingredient.newFormComment?.trim() || undefined,
        }),
      });
      if (!res.ok) throw new Error('Form konnte nicht hinzugefügt werden.');
      setField(ingredient.id, { newFormName: '', newFormComment: '' });
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Fehler.');
    }
  };

  const handleCreate = async () => {
    const name = newName.trim();
    if (!name) {
      setCreateError('Name ist erforderlich.');
      return;
    }
    setCreating(true);
    setCreateError('');
    try {
      const res = await fetch('/api/ingredients', {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({
          name,
          unit: newUnit.trim() || undefined,
          description: newDesc.trim() || undefined,
        }),
      });
      if (!res.ok) throw new Error('Wirkstoff konnte nicht erstellt werden.');
      setNewName('');
      setNewUnit('');
      setNewDesc('');
      load();
    } catch (e: unknown) {
      setCreateError(e instanceof Error ? e.message : 'Fehler.');
    } finally {
      setCreating(false);
    }
  };

  const handleAddRecommendation = async () => {
    if (!recIngredientId || !recProductId) {
      setRecError('Bitte Wirkstoff und Produkt auswählen.');
      return;
    }
    setRecSaving(true);
    setRecError('');
    setRecSuccess('');
    try {
      const res = await fetch('/api/recommendations', {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({
          ingredient_id: Number(recIngredientId),
          product_id: Number(recProductId),
          type: recType === 'empfohlen' ? 'recommended' : 'alternative',
        }),
      });
      if (!res.ok) throw new Error('Empfehlung konnte nicht gespeichert werden.');
      setRecSuccess('Empfehlung gespeichert.');
      setRecIngredientId('');
      setRecProductId('');
    } catch (e: unknown) {
      setRecError(e instanceof Error ? e.message : 'Fehler.');
    } finally {
      setRecSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-10">
        <div className="animate-spin border-4 border-indigo-500 border-t-transparent rounded-full w-8 h-8" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm">
          {error}
        </div>
      )}

      {/* Create new ingredient */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 flex flex-col gap-3">
        <h3 className="font-semibold text-gray-900">Neuer Wirkstoff</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <input
            placeholder="Name *"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            className="border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-400"
          />
          <input
            placeholder="Einheit (z.B. mg)"
            value={newUnit}
            onChange={(e) => setNewUnit(e.target.value)}
            className="border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-400"
          />
          <input
            placeholder="Beschreibung"
            value={newDesc}
            onChange={(e) => setNewDesc(e.target.value)}
            className="border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-400"
          />
        </div>
        {createError && <p className="text-sm text-red-600">{createError}</p>}
        <button
          onClick={handleCreate}
          disabled={creating}
          className="self-start bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white font-semibold px-4 py-2 rounded-xl text-sm transition-all shadow-sm disabled:opacity-60"
        >
          {creating ? 'Erstelle...' : 'Erstellen'}
        </button>
      </div>

      {/* Recommendation form */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 flex flex-col gap-3">
        <h3 className="font-semibold text-gray-900">Empfehlung hinzufügen</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <select
            value={recIngredientId}
            onChange={(e) => setRecIngredientId(e.target.value)}
            className="border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-400"
          >
            <option value="">Wirkstoff wählen</option>
            {allIngredients.map((i) => (
              <option key={i.id} value={i.id}>{i.name}</option>
            ))}
          </select>
          <select
            value={recProductId}
            onChange={(e) => setRecProductId(e.target.value)}
            className="border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-400"
          >
            <option value="">Produkt wählen</option>
            {allProducts.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
          <select
            value={recType}
            onChange={(e) => setRecType(e.target.value as 'empfohlen' | 'alternative')}
            className="border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-400"
          >
            <option value="empfohlen">Empfohlen</option>
            <option value="alternative">Alternative</option>
          </select>
        </div>
        {recError && <p className="text-sm text-red-600">{recError}</p>}
        {recSuccess && <p className="text-sm text-emerald-600">{recSuccess}</p>}
        <button
          onClick={handleAddRecommendation}
          disabled={recSaving}
          className="self-start bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white font-semibold px-4 py-2 rounded-xl text-sm transition-all shadow-sm disabled:opacity-60"
        >
          {recSaving ? 'Speichere...' : 'Empfehlung speichern'}
        </button>
      </div>

      {/* Ingredient list */}
      <div className="flex flex-col gap-3">
        {ingredients.map((ingredient) => (
          <div key={ingredient.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex flex-col gap-3">
            {!ingredient.editing ? (
              <div className="flex items-center justify-between gap-2">
                <div>
                  <p className="font-semibold text-gray-900">{ingredient.name}</p>
                  {ingredient.unit && (
                    <p className="text-xs text-gray-500">Einheit: {ingredient.unit}</p>
                  )}
                  {ingredient.description && (
                    <p className="text-xs text-gray-500 mt-0.5">{ingredient.description}</p>
                  )}
                </div>
                <button
                  onClick={() => startEdit(ingredient)}
                  className="text-sm bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 px-3 py-1.5 rounded-xl font-medium transition-colors"
                >
                  Bearbeiten
                </button>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <input
                    value={ingredient.editName ?? ''}
                    onChange={(e) => setField(ingredient.id, { editName: e.target.value })}
                    placeholder="Name"
                    className="border border-gray-200 rounded-xl px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-400"
                  />
                  <input
                    value={ingredient.editUnit ?? ''}
                    onChange={(e) => setField(ingredient.id, { editUnit: e.target.value })}
                    placeholder="Einheit"
                    className="border border-gray-200 rounded-xl px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-400"
                  />
                  <input
                    value={ingredient.editDesc ?? ''}
                    onChange={(e) => setField(ingredient.id, { editDesc: e.target.value })}
                    placeholder="Beschreibung"
                    className="border border-gray-200 rounded-xl px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-400"
                  />
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => saveEdit(ingredient)}
                    className="text-sm bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-600 hover:to-green-700 text-white font-semibold px-3 py-1.5 rounded-xl transition-all shadow-sm"
                  >
                    Speichern
                  </button>
                  <button
                    onClick={() => setField(ingredient.id, { editing: false })}
                    className="text-sm bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 px-3 py-1.5 rounded-xl font-medium transition-colors"
                  >
                    Abbrechen
                  </button>
                </div>

                {/* Synonym */}
                <div className="border-t border-gray-100 pt-3">
                  <p className="text-xs font-semibold text-gray-500 mb-2">Synonym hinzufügen</p>
                  <div className="flex gap-2">
                    <input
                      value={ingredient.newSynonym ?? ''}
                      onChange={(e) => setField(ingredient.id, { newSynonym: e.target.value })}
                      placeholder="Synonym"
                      className="flex-1 border border-gray-200 rounded-xl px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-400"
                    />
                    <button
                      onClick={() => addSynonym(ingredient)}
                      className="p-1.5 bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white rounded-xl transition-all shadow-sm"
                      aria-label="Synonym hinzufügen"
                    >
                      <Plus size={16} />
                    </button>
                  </div>
                </div>

                {/* Form */}
                <div className="border-t border-gray-100 pt-3">
                  <p className="text-xs font-semibold text-gray-500 mb-2">Darreichungsform hinzufügen</p>
                  <div className="flex gap-2">
                    <input
                      value={ingredient.newFormName ?? ''}
                      onChange={(e) => setField(ingredient.id, { newFormName: e.target.value })}
                      placeholder="Name der Form"
                      className="flex-1 border border-gray-200 rounded-xl px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-400"
                    />
                    <input
                      value={ingredient.newFormComment ?? ''}
                      onChange={(e) => setField(ingredient.id, { newFormComment: e.target.value })}
                      placeholder="Kommentar"
                      className="flex-1 border border-gray-200 rounded-xl px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-400"
                    />
                    <button
                      onClick={() => addForm(ingredient)}
                      className="p-1.5 bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white rounded-xl transition-all shadow-sm"
                      aria-label="Form hinzufügen"
                    >
                      <Plus size={16} />
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================================
// Tab 3: Interactions
// ============================================================
function InteractionsTab() {
  const [interactions, setInteractions] = useState<Interaction[]>([]);
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [deletingId, setDeletingId] = useState<number | null>(null);

  // Form state
  const [formA, setFormA] = useState('');
  const [formB, setFormB] = useState('');
  const [formType, setFormType] = useState<'danger' | 'caution'>('caution');
  const [formComment, setFormComment] = useState('');
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState('');

  useEffect(() => {
    Promise.all([
      fetch('/api/interactions', { headers: authHeaders() }).then((r) => r.json()),
      fetch('/api/ingredients', { headers: authHeaders() }).then((r) => r.json()),
    ])
      .then(([intData, ingData]) => {
        setInteractions(intData.interactions ?? intData ?? []);
        setIngredients(ingData.ingredients ?? ingData ?? []);
      })
      .catch((e: unknown) => setError(e instanceof Error ? e.message : 'Fehler.'))
      .finally(() => setLoading(false));
  }, []);

  const handleCreate = async () => {
    if (!formA || !formB || !formComment.trim()) {
      setCreateError('Bitte alle Felder ausfüllen.');
      return;
    }
    setCreating(true);
    setCreateError('');
    try {
      const res = await fetch('/api/interactions', {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({
          ingredient_a_id: Number(formA),
          ingredient_b_id: Number(formB),
          type: formType,
          comment: formComment.trim(),
        }),
      });
      if (!res.ok) throw new Error('Interaktion konnte nicht erstellt werden.');
      const data = await res.json();
      const newInteraction: Interaction = data.interaction ?? data;
      // Enrich with names
      const ingA = ingredients.find((i) => i.id === Number(formA));
      const ingB = ingredients.find((i) => i.id === Number(formB));
      setInteractions((prev) => [
        ...prev,
        {
          ...newInteraction,
          ingredient_a_name: ingA?.name,
          ingredient_b_name: ingB?.name,
        },
      ]);
      setFormA('');
      setFormB('');
      setFormComment('');
    } catch (e: unknown) {
      setCreateError(e instanceof Error ? e.message : 'Fehler.');
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm('Interaktion wirklich löschen?')) return;
    setDeletingId(id);
    try {
      await fetch(`/api/interactions/${id}`, {
        method: 'DELETE',
        headers: authHeaders(),
      });
      setInteractions((prev) => prev.filter((i) => i.id !== id));
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Fehler.');
    } finally {
      setDeletingId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-10">
        <div className="animate-spin border-4 border-indigo-500 border-t-transparent rounded-full w-8 h-8" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm">
          {error}
        </div>
      )}

      {/* Create form */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 flex flex-col gap-3">
        <h3 className="font-semibold text-gray-900">Neue Interaktion</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <select
            value={formA}
            onChange={(e) => setFormA(e.target.value)}
            className="border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-400"
          >
            <option value="">Wirkstoff A wählen</option>
            {ingredients.map((i) => (
              <option key={i.id} value={i.id}>{i.name}</option>
            ))}
          </select>
          <select
            value={formB}
            onChange={(e) => setFormB(e.target.value)}
            className="border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-400"
          >
            <option value="">Wirkstoff B wählen</option>
            {ingredients.map((i) => (
              <option key={i.id} value={i.id}>{i.name}</option>
            ))}
          </select>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <select
            value={formType}
            onChange={(e) => setFormType(e.target.value as 'danger' | 'caution')}
            className="border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-400"
          >
            <option value="caution">Vorsicht (caution)</option>
            <option value="danger">Gefährlich (danger)</option>
          </select>
          <input
            value={formComment}
            onChange={(e) => setFormComment(e.target.value)}
            placeholder="Kommentar / Beschreibung"
            className="border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-400"
          />
        </div>
        {createError && <p className="text-sm text-red-600">{createError}</p>}
        <button
          onClick={handleCreate}
          disabled={creating}
          className="self-start bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white font-semibold px-4 py-2 rounded-xl text-sm transition-all shadow-sm disabled:opacity-60"
        >
          {creating ? 'Erstelle...' : 'Interaktion erstellen'}
        </button>
      </div>

      {/* List */}
      {interactions.length === 0 && !error && (
        <p className="text-gray-500">Keine Interaktionen vorhanden.</p>
      )}
      <div className="flex flex-col gap-2">
        {interactions.map((interaction) => {
          const ingA = interaction.ingredient_a_name
            ?? ingredients.find((i) => i.id === interaction.ingredient_a_id)?.name
            ?? `ID ${interaction.ingredient_a_id}`;
          const ingB = interaction.ingredient_b_name
            ?? ingredients.find((i) => i.id === interaction.ingredient_b_id)?.name
            ?? `ID ${interaction.ingredient_b_id}`;

          return (
            <div
              key={interaction.id}
              className="flex items-start justify-between gap-3 bg-white rounded-2xl border border-gray-100 shadow-sm px-4 py-3"
            >
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-900">
                  {ingA} + {ingB}
                </p>
                <p className="text-sm text-gray-600 mt-0.5">{interaction.comment}</p>
                <span
                  className={`inline-block mt-1 text-xs font-medium px-2 py-0.5 rounded-full ${
                    interaction.type === 'danger'
                      ? 'bg-red-100 text-red-700'
                      : interaction.type === 'caution'
                      ? 'bg-orange-100 text-orange-700'
                      : 'bg-gray-100 text-gray-600'
                  }`}
                >
                  {interaction.type}
                </span>
              </div>
              <button
                onClick={() => handleDelete(interaction.id)}
                disabled={deletingId === interaction.id}
                className="flex-shrink-0 p-1.5 rounded-lg text-red-400 hover:text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50"
                aria-label="Interaktion löschen"
              >
                <Trash2 size={16} />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ============================================================
// Tab 4: Stats
// ============================================================
function StatsTab() {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch('/api/admin/stats', { headers: authHeaders() })
      .then((r) => {
        if (!r.ok) throw new Error('Statistiken konnten nicht geladen werden.');
        return r.json();
      })
      .then((data) => setStats(data.stats ?? data))
      .catch((e: unknown) => setError(e instanceof Error ? e.message : 'Fehler.'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex justify-center py-10">
        <div className="animate-spin border-4 border-indigo-500 border-t-transparent rounded-full w-8 h-8" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">
        {error}
      </div>
    );
  }

  if (!stats) return null;

  const cards: Array<{ label: string; key: keyof AdminStats; icon: React.ReactNode; color: string }> = [
    { label: 'Nutzer', key: 'users', icon: <Settings size={24} />, color: 'text-indigo-500' },
    { label: 'Wirkstoffe', key: 'ingredients', icon: <BarChart3 size={24} />, color: 'text-green-500' },
    { label: 'Produkte (gesamt)', key: 'products_total', icon: <CheckCircle size={24} />, color: 'text-purple-500' },
    { label: 'Produkte (ausstehend)', key: 'products_pending', icon: <AlertTriangle size={24} />, color: 'text-yellow-500' },
    { label: 'Stacks', key: 'stacks', icon: <BarChart3 size={24} />, color: 'text-orange-500' },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {cards.map(({ label, key, icon, color }) => (
        <div key={key} className="bg-white rounded-2xl border border-gray-100 p-5 flex items-center gap-4 shadow-sm">
          <div className={color}>{icon}</div>
          <div>
            <p className="text-2xl font-bold text-gray-900">
              {stats[key] ?? '–'}
            </p>
            <p className="text-sm text-gray-500">{label}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

// ============================================================
// Main Admin Page
// ============================================================
const TAB_LABELS: Array<{ key: Tab; label: string }> = [
  { key: 'products', label: 'Produkte' },
  { key: 'ingredients', label: 'Wirkstoffe' },
  { key: 'interactions', label: 'Interaktionen' },
  { key: 'stats', label: 'Statistiken' },
  { key: 'shop_domains', label: 'Shop-Domains' },
  { key: 'rankings', label: 'Rankings' },
  { key: 'user_products', label: 'Nutzer-Produkte' },
];

export default function AdminPage() {
  const [activeTab, setActiveTab] = useState<Tab>('products');

  // Check admin access via localStorage
  const isAdmin = (() => {
    try {
      const user = JSON.parse(localStorage.getItem('ss_user') || '{}');
      return user.role === 'admin';
    } catch {
      return false;
    }
  })();

  if (!isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[40vh] gap-4 text-center">
        <XCircle size={48} className="text-red-400" />
        <h1 className="text-2xl font-bold text-red-600">Kein Zugriff</h1>
        <p className="text-gray-600">Du hast keine Berechtigung, diese Seite aufzurufen.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-indigo-50/30 p-4 md:p-6">
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold text-gray-900">Admin-Panel</h1>

      {/* Tab bar */}
      <div className="flex gap-1 bg-white border border-gray-100 shadow-sm rounded-2xl p-1.5 flex-wrap">
        {TAB_LABELS.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className={`flex-1 min-w-[100px] text-sm font-medium px-4 py-2 rounded-xl transition-all duration-200 ${
              activeTab === key
                ? 'bg-gradient-to-r from-indigo-500 to-purple-600 text-white shadow-sm'
                : 'bg-white border border-gray-200 text-gray-600 hover:text-indigo-600'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === 'products' && <ProductsTab />}
      {activeTab === 'ingredients' && <IngredientsTab />}
      {activeTab === 'interactions' && <InteractionsTab />}
      {activeTab === 'stats' && <StatsTab />}
      {activeTab === 'shop_domains' && <ShopDomainsPanel />}
      {activeTab === 'rankings' && <RankingsPanel />}
      {activeTab === 'user_products' && <UserProductsTab />}
    </div>
    </div>
  );
}

// ---- Shop Domains Panel ----
function ShopDomainsPanel() {
  const [shops, setShops] = useState<{ id: number; domain: string; display_name: string }[]>([]);
  const [newDomain, setNewDomain] = useState('');
  const [newName, setNewName] = useState('');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/shop-domains', { headers: authHeaders() });
      const data = await res.json() as { shops: { id: number; domain: string; display_name: string }[] };
      setShops(data.shops ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const addShop = async () => {
    if (!newDomain.trim() || !newName.trim()) return;
    await fetch('/api/admin/shop-domains', {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ domain: newDomain.trim(), display_name: newName.trim() }),
    });
    setNewDomain('');
    setNewName('');
    load();
  };

  const deleteShop = async (id: number) => {
    await fetch(`/api/admin/shop-domains/${id}`, { method: 'DELETE', headers: authHeaders() });
    load();
  };

  if (loading) return <p className="text-gray-500 py-8 text-center">Lade...</p>;

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">Shop-Domains</h2>
      <p className="text-sm text-gray-500">
        Ordne Shop-URLs einem Anzeigenamen zu. Wird für Kaufen-Buttons verwendet.
      </p>
      <div className="flex gap-2">
        <input
          value={newDomain}
          onChange={e => setNewDomain(e.target.value)}
          placeholder="amazon.de"
          className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-400"
        />
        <input
          value={newName}
          onChange={e => setNewName(e.target.value)}
          placeholder="Amazon"
          className="w-36 border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-400"
        />
        <button
          onClick={addShop}
          className="inline-flex items-center gap-1.5 bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white font-semibold px-4 py-2 rounded-xl text-sm transition-all shadow-sm"
        >
          <Plus size={14} /> Hinzufügen
        </button>
      </div>
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="border-b text-left text-gray-500 text-xs uppercase tracking-widest font-semibold">
            <th className="py-2 pr-4">Domain</th>
            <th className="py-2 pr-4">Anzeigename</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {shops.map(s => (
            <tr key={s.id} className="border-b hover:bg-gray-50">
              <td className="py-2 pr-4 font-mono text-xs text-gray-600">{s.domain}</td>
              <td className="py-2 pr-4 font-medium">{s.display_name}</td>
              <td className="py-2 text-right">
                <button
                  onClick={() => deleteShop(s.id)}
                  className="text-red-500 hover:text-red-700 text-xs"
                >
                  <Trash2 size={14} />
                </button>
              </td>
            </tr>
          ))}
          {shops.length === 0 && (
            <tr>
              <td colSpan={3} className="py-6 text-center text-gray-500 text-sm">
                Keine Domains hinterlegt.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

// ---- Rankings Panel ----
function RankingsPanel() {
  const [rankings, setRankings] = useState<{
    id: number;
    product_id: number;
    product_name: string;
    rank_score: number;
    notes?: string;
  }[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/product-rankings', { headers: authHeaders() });
      const data = await res.json() as { rankings: typeof rankings };
      setRankings(data.rankings ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const updateRank = async (productId: number, score: number) => {
    await fetch(`/api/admin/product-rankings/${productId}`, {
      method: 'PUT',
      headers: authHeaders(),
      body: JSON.stringify({ rank_score: score }),
    });
  };

  if (loading) return <p className="text-gray-500 py-8 text-center">Lade...</p>;

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">Produkt-Rankings</h2>
      <p className="text-sm text-gray-500">
        Höherer Score = weiter oben in Empfehlungslisten. Änderungen werden beim Verlassen des Feldes gespeichert.
      </p>
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="border-b text-left text-gray-500 text-xs uppercase tracking-widest font-semibold">
            <th className="py-2 pr-4">Produkt</th>
            <th className="py-2 pr-4">Score</th>
          </tr>
        </thead>
        <tbody>
          {rankings.map(r => (
            <tr key={r.id} className="border-b hover:bg-gray-50">
              <td className="py-2 pr-4 font-medium">{r.product_name}</td>
              <td className="py-2 pr-4">
                <input
                  type="number"
                  defaultValue={r.rank_score}
                  className="w-20 border border-gray-200 rounded-xl px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-400"
                  onBlur={e => updateRank(r.product_id, Number(e.target.value))}
                />
              </td>
            </tr>
          ))}
          {rankings.length === 0 && (
            <tr>
              <td colSpan={2} className="py-6 text-center text-gray-500 text-sm">
                Noch keine Rankings vergeben.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

// ---- User Products Panel ----
function UserProductsTab() {
  const [products, setProducts] = useState<AdminUserProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<'pending' | 'approved' | 'rejected'>('pending');
  const [actionId, setActionId] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/user-products?status=${statusFilter}`, { headers: authHeaders() });
      const data = await res.json() as { products: AdminUserProduct[] };
      setProducts(data.products ?? []);
    } catch {}
    finally { setLoading(false); }
  }, [statusFilter]);

  useEffect(() => { load(); }, [load]);

  const handleApprove = async (id: number) => {
    setActionId(id);
    await fetch(`/api/admin/user-products/${id}/approve`, { method: 'PUT', headers: authHeaders() });
    setProducts((prev) => prev.filter((p) => p.id !== id));
    setActionId(null);
  };

  const handleReject = async (id: number) => {
    setActionId(id);
    await fetch(`/api/admin/user-products/${id}/reject`, { method: 'PUT', headers: authHeaders() });
    setProducts((prev) => prev.filter((p) => p.id !== id));
    setActionId(null);
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm('Produkt wirklich löschen?')) return;
    setActionId(id);
    await fetch(`/api/admin/user-products/${id}`, { method: 'DELETE', headers: authHeaders() });
    setProducts((prev) => prev.filter((p) => p.id !== id));
    setActionId(null);
  };

  return (
    <div className="space-y-4">
      {/* Status filter pills */}
      <div className="flex gap-2">
        {(['pending', 'approved', 'rejected'] as const).map((s) => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={`px-3 py-1.5 text-xs font-medium rounded-full transition-all ${
              statusFilter === s ? 'bg-gradient-to-r from-indigo-500 to-purple-600 text-white shadow-sm' : 'bg-white border border-gray-200 text-gray-600 hover:text-indigo-600'
            }`}
          >
            {s === 'pending' ? 'Ausstehend' : s === 'approved' ? 'Freigegeben' : 'Abgelehnt'}
          </button>
        ))}
      </div>

      {loading && <p className="text-sm text-gray-500">Laden…</p>}

      {!loading && products.length === 0 && (
        <p className="text-sm text-gray-500 py-4 text-center">Keine Produkte in diesem Status.</p>
      )}

      {!loading && products.length > 0 && (
        <ul className="space-y-3">
          {products.map((p) => (
            <li key={p.id} className="p-4 bg-white border border-gray-100 shadow-sm rounded-2xl flex flex-col gap-2">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-semibold text-gray-900 text-sm">{p.name}</p>
                  {p.brand && <p className="text-xs text-gray-500">{p.brand}</p>}
                  <p className="text-xs text-gray-500 mt-0.5">
                    von {p.user_email ?? `user_id=${p.user_id}`} · €{p.price.toFixed(2)}
                    {p.shop_link && (
                      <> · <a href={p.shop_link} target="_blank" rel="noopener noreferrer" className="text-indigo-600 hover:underline">Link</a></>
                    )}
                  </p>
                  {p.serving_size && (
                    <p className="text-xs text-gray-500">
                      {p.serving_size}{p.serving_unit} · {p.servings_per_container ?? '?'} Portionen · {p.container_count ?? 1} Packung(en)
                    </p>
                  )}
                  {p.notes && <p className="text-xs text-gray-500 italic mt-1">{p.notes}</p>}
                </div>
                {p.is_affiliate ? (
                  <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full flex-shrink-0">Affiliate</span>
                ) : null}
              </div>
              {statusFilter === 'pending' && (
                <div className="flex gap-2 mt-1">
                  <button
                    onClick={() => handleApprove(p.id)}
                    disabled={actionId === p.id}
                    className="flex-1 px-3 py-1.5 text-xs font-semibold bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-600 hover:to-green-700 text-white rounded-xl transition-all shadow-sm disabled:opacity-50"
                  >
                    Freigeben
                  </button>
                  <button
                    onClick={() => handleReject(p.id)}
                    disabled={actionId === p.id}
                    className="flex-1 px-3 py-1.5 text-xs font-semibold bg-red-500 hover:bg-red-600 text-white rounded-xl transition-colors disabled:opacity-50"
                  >
                    Ablehnen
                  </button>
                  <button
                    onClick={() => handleDelete(p.id)}
                    disabled={actionId === p.id}
                    className="px-3 py-1.5 text-xs font-medium text-red-600 border border-red-200 hover:bg-red-50 rounded-xl transition-colors disabled:opacity-50"
                  >
                    Löschen
                  </button>
                </div>
              )}
              {statusFilter !== 'pending' && (
                <button
                  onClick={() => handleDelete(p.id)}
                  disabled={actionId === p.id}
                  className="self-start px-3 py-1.5 text-xs font-medium text-red-600 border border-red-200 hover:bg-red-50 rounded-xl transition-colors disabled:opacity-50"
                >
                  Löschen
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
