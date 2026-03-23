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

// ---- Local types ----
interface AdminProduct {
  id: number;
  name: string;
  brand?: string;
  price: number;
  moderation_status?: string;
  visibility?: string;
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

type Tab = 'products' | 'ingredients' | 'interactions' | 'stats';

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
    body: { moderation_status?: string; visibility?: string }
  ) => {
    setActionLoading(id);
    try {
      const res = await fetch(`/api/products/${id}/status`, {
        method: 'PUT',
        headers: authHeaders(),
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error('Aktion fehlgeschlagen.');
      const updated = await res.json();
      setProducts((prev) =>
        prev.map((p) =>
          p.id === id
            ? {
                ...p,
                moderation_status: updated.moderation_status ?? body.moderation_status ?? p.moderation_status,
                visibility: updated.visibility ?? body.visibility ?? p.visibility,
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

  if (loading) {
    return (
      <div className="flex justify-center py-10">
        <div className="animate-spin border-4 border-blue-500 border-t-transparent rounded-full w-8 h-8" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">
          {error}
        </div>
      )}
      {products.length === 0 && !error && (
        <p className="text-gray-500">Keine Produkte vorhanden.</p>
      )}
      <div className="flex flex-col gap-3">
        {products.map((product) => (
          <div
            key={product.id}
            className="bg-white rounded-xl border border-gray-200 p-4 flex flex-wrap items-center justify-between gap-3"
          >
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
                className="text-sm bg-green-100 text-green-700 hover:bg-green-200 px-3 py-1.5 rounded-lg font-medium transition-colors disabled:opacity-50"
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
                className="text-sm bg-red-100 text-red-700 hover:bg-red-200 px-3 py-1.5 rounded-lg font-medium transition-colors disabled:opacity-50"
              >
                Ablehnen
              </button>
              <button
                onClick={() => updateProduct(product.id, { visibility: 'hidden' })}
                disabled={actionLoading === product.id}
                className="text-sm bg-gray-100 text-gray-700 hover:bg-gray-200 px-3 py-1.5 rounded-lg font-medium transition-colors disabled:opacity-50"
              >
                Verbergen
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
        <div className="animate-spin border-4 border-blue-500 border-t-transparent rounded-full w-8 h-8" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">
          {error}
        </div>
      )}

      {/* Create new ingredient */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 flex flex-col gap-3">
        <h3 className="font-semibold text-gray-800">Neuer Wirkstoff</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <input
            placeholder="Name *"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <input
            placeholder="Einheit (z.B. mg)"
            value={newUnit}
            onChange={(e) => setNewUnit(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <input
            placeholder="Beschreibung"
            value={newDesc}
            onChange={(e) => setNewDesc(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        {createError && <p className="text-sm text-red-600">{createError}</p>}
        <button
          onClick={handleCreate}
          disabled={creating}
          className="self-start bg-blue-500 text-white hover:bg-blue-600 px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-60"
        >
          {creating ? 'Erstelle...' : 'Erstellen'}
        </button>
      </div>

      {/* Recommendation form */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 flex flex-col gap-3">
        <h3 className="font-semibold text-gray-800">Empfehlung hinzufügen</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <select
            value={recIngredientId}
            onChange={(e) => setRecIngredientId(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Wirkstoff wählen</option>
            {allIngredients.map((i) => (
              <option key={i.id} value={i.id}>{i.name}</option>
            ))}
          </select>
          <select
            value={recProductId}
            onChange={(e) => setRecProductId(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Produkt wählen</option>
            {allProducts.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
          <select
            value={recType}
            onChange={(e) => setRecType(e.target.value as 'empfohlen' | 'alternative')}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="empfohlen">Empfohlen</option>
            <option value="alternative">Alternative</option>
          </select>
        </div>
        {recError && <p className="text-sm text-red-600">{recError}</p>}
        {recSuccess && <p className="text-sm text-green-600">{recSuccess}</p>}
        <button
          onClick={handleAddRecommendation}
          disabled={recSaving}
          className="self-start bg-blue-500 text-white hover:bg-blue-600 px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-60"
        >
          {recSaving ? 'Speichere...' : 'Empfehlung speichern'}
        </button>
      </div>

      {/* Ingredient list */}
      <div className="flex flex-col gap-3">
        {ingredients.map((ingredient) => (
          <div key={ingredient.id} className="bg-white rounded-xl border border-gray-200 p-4 flex flex-col gap-3">
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
                  className="text-sm bg-gray-100 text-gray-700 hover:bg-gray-200 px-3 py-1.5 rounded-lg font-medium transition-colors"
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
                    className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <input
                    value={ingredient.editUnit ?? ''}
                    onChange={(e) => setField(ingredient.id, { editUnit: e.target.value })}
                    placeholder="Einheit"
                    className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <input
                    value={ingredient.editDesc ?? ''}
                    onChange={(e) => setField(ingredient.id, { editDesc: e.target.value })}
                    placeholder="Beschreibung"
                    className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => saveEdit(ingredient)}
                    className="text-sm bg-green-500 text-white hover:bg-green-600 px-3 py-1.5 rounded-lg font-medium transition-colors"
                  >
                    Speichern
                  </button>
                  <button
                    onClick={() => setField(ingredient.id, { editing: false })}
                    className="text-sm bg-gray-100 text-gray-700 hover:bg-gray-200 px-3 py-1.5 rounded-lg font-medium transition-colors"
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
                      className="flex-1 border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <button
                      onClick={() => addSynonym(ingredient)}
                      className="p-1.5 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
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
                      className="flex-1 border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <input
                      value={ingredient.newFormComment ?? ''}
                      onChange={(e) => setField(ingredient.id, { newFormComment: e.target.value })}
                      placeholder="Kommentar"
                      className="flex-1 border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <button
                      onClick={() => addForm(ingredient)}
                      className="p-1.5 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
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
        <div className="animate-spin border-4 border-blue-500 border-t-transparent rounded-full w-8 h-8" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">
          {error}
        </div>
      )}

      {/* Create form */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 flex flex-col gap-3">
        <h3 className="font-semibold text-gray-800">Neue Interaktion</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <select
            value={formA}
            onChange={(e) => setFormA(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Wirkstoff A wählen</option>
            {ingredients.map((i) => (
              <option key={i.id} value={i.id}>{i.name}</option>
            ))}
          </select>
          <select
            value={formB}
            onChange={(e) => setFormB(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
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
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="caution">Vorsicht (caution)</option>
            <option value="danger">Gefährlich (danger)</option>
          </select>
          <input
            value={formComment}
            onChange={(e) => setFormComment(e.target.value)}
            placeholder="Kommentar / Beschreibung"
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        {createError && <p className="text-sm text-red-600">{createError}</p>}
        <button
          onClick={handleCreate}
          disabled={creating}
          className="self-start bg-blue-500 text-white hover:bg-blue-600 px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-60"
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
              className="flex items-start justify-between gap-3 bg-white rounded-xl border border-gray-200 px-4 py-3"
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
        <div className="animate-spin border-4 border-blue-500 border-t-transparent rounded-full w-8 h-8" />
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
    { label: 'Nutzer', key: 'users', icon: <Settings size={24} />, color: 'text-blue-500' },
    { label: 'Wirkstoffe', key: 'ingredients', icon: <BarChart3 size={24} />, color: 'text-green-500' },
    { label: 'Produkte (gesamt)', key: 'products_total', icon: <CheckCircle size={24} />, color: 'text-purple-500' },
    { label: 'Produkte (ausstehend)', key: 'products_pending', icon: <AlertTriangle size={24} />, color: 'text-yellow-500' },
    { label: 'Stacks', key: 'stacks', icon: <BarChart3 size={24} />, color: 'text-orange-500' },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {cards.map(({ label, key, icon, color }) => (
        <div key={key} className="bg-white rounded-xl border border-gray-200 p-5 flex items-center gap-4 shadow-sm">
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
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold text-gray-900">Admin-Panel</h1>

      {/* Tab bar */}
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1 flex-wrap">
        {TAB_LABELS.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className={`flex-1 min-w-[100px] text-sm font-medium px-4 py-2 rounded-lg transition-colors ${
              activeTab === key
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
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
    </div>
  );
}
