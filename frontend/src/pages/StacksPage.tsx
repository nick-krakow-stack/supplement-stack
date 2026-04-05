import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Trash2, AlertTriangle, Plus, ChevronDown, ChevronUp, Check, X } from 'lucide-react';
import ProductCard from '../components/ProductCard';
import { ShopDomain } from '../types/local';

// ---- Local types ----
interface StackProduct {
  id: number;
  name: string;
  price: number;
  brand?: string;
  shop_link?: string;
  is_affiliate?: number;
  image_url?: string;
  discontinued_at?: string;
  servings_per_container?: number;
  container_count?: number;
}

function calcMonthlyPrice(price: number, spc?: number, cc?: number): number | null {
  const total = (spc ?? 0) * (cc ?? 1);
  return total > 0 ? (price / total) * 30 : null;
}

interface InteractionWarning {
  id?: number;
  ingredient_a_name?: string;
  ingredient_b_name?: string;
  ingredient_a?: string;
  ingredient_b?: string;
  type: 'danger' | 'caution' | string;
  comment: string;
}

interface Stack {
  id: number;
  name: string;
  products?: StackProduct[];
  total_monthly?: number;
  warnings?: InteractionWarning[];
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

// ---- Warning badge ----
function WarningBadge({ warning }: { warning: InteractionWarning }) {
  const ingredientA = warning.ingredient_a_name ?? warning.ingredient_a ?? 'Unbekannt';
  const ingredientB = warning.ingredient_b_name ?? warning.ingredient_b ?? 'Unbekannt';

  if (warning.type === 'danger') {
    return (
      <div className="flex items-start gap-2 rounded-xl px-4 py-3 bg-red-50 text-red-700 text-sm border border-red-100">
        <AlertTriangle size={16} className="flex-shrink-0 mt-0.5" />
        <span>
          <span className="font-semibold">{ingredientA} + {ingredientB}:</span> {warning.comment}
        </span>
      </div>
    );
  }
  if (warning.type === 'caution') {
    return (
      <div className="flex items-start gap-2 rounded-xl px-4 py-3 bg-amber-50 text-amber-700 text-sm border border-amber-100">
        <AlertTriangle size={16} className="flex-shrink-0 mt-0.5" />
        <span>
          <span className="font-semibold">{ingredientA} + {ingredientB}:</span> {warning.comment}
        </span>
      </div>
    );
  }
  return (
    <div className="flex items-start gap-2 rounded-xl px-4 py-3 bg-gray-50 text-gray-700 text-sm border border-gray-200">
      <span>
        <span className="font-semibold">{ingredientA} + {ingredientB}:</span> {warning.comment}
      </span>
    </div>
  );
}

// ---- Stack card ----
function StackCard({
  stack,
  onDeleted,
  onRenamed,
  shopDomains,
}: {
  stack: Stack;
  onDeleted: (id: number) => void;
  onRenamed: (id: number, name: string) => void;
  shopDomains: ShopDomain[];
}) {
  const [editingName, setEditingName] = useState(false);
  const [nameValue, setNameValue] = useState(stack.name);
  const [savingName, setSavingName] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [removingProductId, setRemovingProductId] = useState<number | null>(null);
  const [products, setProducts] = useState<StackProduct[]>(stack.products ?? []);
  const [warnings, setWarnings] = useState<InteractionWarning[]>(stack.warnings ?? []);
  const [loadingWarnings, setLoadingWarnings] = useState(false);
  const [error, setError] = useState('');
  const [selectedProductIds, setSelectedProductIds] = useState<Set<number>>(new Set());

  // Fetch warnings on mount if not already provided
  useEffect(() => {
    if (stack.warnings !== undefined) return;
    setLoadingWarnings(true);
    fetch(`/api/stack-warnings/${stack.id}`, { headers: authHeaders() })
      .then((r) => r.json())
      .then((data) => {
        setWarnings(data.warnings ?? data ?? []);
      })
      .catch(() => {})
      .finally(() => setLoadingWarnings(false));
  }, [stack.id, stack.warnings]);

  const saveName = async () => {
    const trimmed = nameValue.trim();
    if (!trimmed || trimmed === stack.name) {
      setEditingName(false);
      setNameValue(stack.name);
      return;
    }
    setSavingName(true);
    try {
      const res = await fetch(`/api/stacks/${stack.id}`, {
        method: 'PUT',
        headers: authHeaders(),
        body: JSON.stringify({ name: trimmed }),
      });
      if (res.ok) {
        onRenamed(stack.id, trimmed);
        setEditingName(false);
      } else {
        setError('Name konnte nicht gespeichert werden.');
      }
    } catch {
      setError('Netzwerkfehler.');
    } finally {
      setSavingName(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm(`Stack "${stack.name}" wirklich löschen?`)) return;
    setDeleting(true);
    try {
      await fetch(`/api/stacks/${stack.id}`, {
        method: 'DELETE',
        headers: authHeaders(),
      });
      onDeleted(stack.id);
    } catch {
      setError('Löschen fehlgeschlagen.');
      setDeleting(false);
    }
  };

  const handleRemoveProduct = async (productId: number) => {
    setRemovingProductId(productId);
    try {
      const res = await fetch(`/api/stacks/${stack.id}/products/${productId}`, {
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
      setRemovingProductId(null);
    }
  };

  const totalOnce = products.reduce((sum, p) => sum + (p.price ?? 0), 0);
  const totalMonthly = products.reduce((sum, p) => {
    const m = calcMonthlyPrice(p.price, p.servings_per_container, p.container_count);
    return sum + (m ?? p.price ?? 0);
  }, 0);
  const hasAnyMonthlyData = products.some(
    (p) => (p.servings_per_container ?? 0) > 0
  );

  const selectedTotalOnce = products
    .filter((p) => selectedProductIds.has(p.id))
    .reduce((sum, p) => sum + (p.price ?? 0), 0);
  const selectedTotalMonthly = products
    .filter((p) => selectedProductIds.has(p.id))
    .reduce((sum, p) => {
      const m = calcMonthlyPrice(p.price, p.servings_per_container, p.container_count);
      return sum + (m ?? p.price ?? 0);
    }, 0);

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden flex flex-col">
      <div className="p-5 flex flex-col gap-4">
      {/* Header: name + delete */}
      <div className="flex items-center justify-between gap-2">
        {editingName ? (
          <div className="flex items-center gap-2 flex-1">
            <input
              autoFocus
              value={nameValue}
              onChange={(e) => setNameValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') saveName();
                if (e.key === 'Escape') {
                  setEditingName(false);
                  setNameValue(stack.name);
                }
              }}
              className="flex-1 border border-gray-200 rounded-xl px-4 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent text-sm"
            />
            <button
              onClick={saveName}
              disabled={savingName}
              className="p-1.5 rounded-xl text-green-600 hover:bg-green-50 transition-colors"
              aria-label="Speichern"
            >
              <Check size={18} />
            </button>
            <button
              onClick={() => { setEditingName(false); setNameValue(stack.name); }}
              className="p-1.5 rounded-xl text-gray-500 hover:bg-gray-50 transition-colors"
              aria-label="Abbrechen"
            >
              <X size={18} />
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-3 min-w-0">
            <h2
              className="text-lg font-bold text-gray-900 cursor-pointer hover:text-indigo-600 transition-colors"
              title="Klicken zum Bearbeiten"
              onClick={() => setEditingName(true)}
            >
              {stack.name}
            </h2>
            {products.length > 0 && (
              <button
                onClick={() => {
                  if (selectedProductIds.size === products.length) setSelectedProductIds(new Set());
                  else setSelectedProductIds(new Set(products.map((p) => p.id)));
                }}
                className="text-xs font-medium text-indigo-600 hover:text-indigo-800 transition-colors"
              >
                {selectedProductIds.size === products.length ? 'Keine' : 'Alle'}
              </button>
            )}
          </div>
        )}

        <button
          onClick={handleDelete}
          disabled={deleting}
          className="flex-shrink-0 p-2 rounded-xl text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors disabled:opacity-50"
          aria-label="Stack löschen"
        >
          <Trash2 size={18} />
        </button>
      </div>

      {error && (
        <p className="text-sm text-red-600 bg-red-50 rounded-xl px-3 py-2">{error}</p>
      )}

      {/* Products */}
      {products.length === 0 ? (
        <p className="text-sm text-gray-500 italic">Keine Produkte in diesem Stack.</p>
      ) : (
        <div style={{ columnCount: 2, columnGap: '12px' }}>
          {products.map((product) => (
            <div key={product.id} style={{ breakInside: 'avoid', marginBottom: '12px' }}>
              <div className="relative">
                <div className="absolute top-2 left-2 z-10">
                  <input
                    type="checkbox"
                    checked={selectedProductIds.has(product.id)}
                    onChange={() =>
                      setSelectedProductIds((prev) => {
                        const next = new Set(prev);
                        if (next.has(product.id)) next.delete(product.id);
                        else next.add(product.id);
                        return next;
                      })
                    }
                    className="w-4 h-4 rounded border-gray-300 text-indigo-600 cursor-pointer"
                  />
                </div>
                <ProductCard
                  product={product}
                  shopDomains={shopDomains}
                  showWishlistButton={false}
                />
              </div>
              <div className="flex justify-end mt-1">
                <button
                  onClick={() => handleRemoveProduct(product.id)}
                  disabled={removingProductId === product.id}
                  className="p-1 rounded-lg text-red-300 hover:text-red-500 hover:bg-red-50 transition-colors disabled:opacity-50"
                  aria-label={`${product.name} entfernen`}
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Warnings */}
      {loadingWarnings ? (
        <p className="text-xs text-gray-500">Lade Warnungen...</p>
      ) : warnings.length > 0 ? (
        <div className="flex flex-col gap-2">
          <p className="text-xs font-semibold uppercase tracking-widest text-gray-500">
            Interaktionswarnungen
          </p>
          {warnings.map((w, i) => (
            <WarningBadge key={w.id ?? i} warning={w} />
          ))}
        </div>
      ) : null}

      {/* Footer total */}
      <div className="border-t border-gray-50 pt-3 flex items-center justify-between flex-wrap gap-2">
        <div className="flex flex-col items-start">
          <span className="text-xs text-gray-400">Einmalpreis</span>
          <span className="text-gray-700 font-bold text-sm">€{totalOnce.toFixed(2)}</span>
        </div>
        {hasAnyMonthlyData && (
          <div className="flex flex-col items-end">
            <span className="text-xs text-gray-400">Monatlich (≈)</span>
            <span className="text-emerald-600 font-bold text-sm">€{totalMonthly.toFixed(2)}/Mo.</span>
          </div>
        )}
        {!hasAnyMonthlyData && (
          <span className="text-emerald-600 font-bold text-sm">€{totalOnce.toFixed(2)}/Monat</span>
        )}
      </div>
      </div>

      {/* Selected products footer */}
      {selectedProductIds.size > 0 && (
        <div className="bg-gradient-to-r from-indigo-500 to-purple-600 text-white rounded-b-2xl px-5 py-3 flex items-center justify-between gap-3">
          <span className="text-white font-semibold text-sm">
            {selectedProductIds.size} ausgewählt
          </span>
          <div className="flex items-center gap-3 text-right">
            <div className="text-xs opacity-80">
              <div>€{selectedTotalOnce.toFixed(2)} einmalig</div>
              {hasAnyMonthlyData && <div>≈ €{selectedTotalMonthly.toFixed(2)}/Mo.</div>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ---- Main page ----
export default function StacksPage() {
  const token = getToken();
  const [stacks, setStacks] = useState<Stack[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newStackName, setNewStackName] = useState('');
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState('');
  const [shopDomains, setShopDomains] = useState<ShopDomain[]>([]);

  const loadStacks = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/stacks', { headers: authHeaders() });
      if (!res.ok) throw new Error('Fehler beim Laden der Stacks.');
      const data = await res.json();
      const stackList: Stack[] = data.stacks ?? data ?? [];

      // Fetch details (products + warnings) for each stack
      const detailed = await Promise.all(
        stackList.map(async (s) => {
          try {
            const r = await fetch(`/api/stacks/${s.id}`, { headers: authHeaders() });
            if (r.ok) {
              const d = await r.json();
              return {
                ...s,
                ...d,
                products: d.products ?? d.items ?? [],
              } as Stack;
            }
          } catch {}
          return s;
        })
      );
      setStacks(detailed);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Unbekannter Fehler.');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    loadStacks();
  }, [loadStacks]);

  useEffect(() => {
    fetch('/api/shop-domains')
      .then((r) => r.json())
      .then((data) => setShopDomains(data.shops ?? []))
      .catch(() => {});
  }, []);

  const handleCreate = async () => {
    const name = newStackName.trim();
    if (!name) {
      setCreateError('Bitte einen Namen eingeben.');
      return;
    }
    setCreating(true);
    setCreateError('');
    try {
      const res = await fetch('/api/stacks', {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ name, products: [] }),
      });
      if (!res.ok) throw new Error('Stack konnte nicht erstellt werden.');
      const data = await res.json();
      const newStack: Stack = { ...(data.stack ?? data), products: [], warnings: [] };
      setStacks((prev) => [...prev, newStack]);
      setNewStackName('');
      setShowCreateForm(false);
    } catch (e: unknown) {
      setCreateError(e instanceof Error ? e.message : 'Fehler.');
    } finally {
      setCreating(false);
    }
  };

  const handleDeleted = (id: number) => {
    setStacks((prev) => prev.filter((s) => s.id !== id));
  };

  const handleRenamed = (id: number, name: string) => {
    setStacks((prev) => prev.map((s) => (s.id === id ? { ...s, name } : s)));
  };

  // Not logged in
  if (!token) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[40vh] gap-4 text-center">
        <h1 className="text-2xl font-bold text-gray-900">Bitte anmelden</h1>
        <p className="text-gray-600">Du musst angemeldet sein, um deine Stacks zu sehen.</p>
        <Link
          to="/login"
          className="bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white font-semibold rounded-xl transition-all duration-200 shadow-sm px-5 py-2"
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
          <h1 className="text-2xl font-bold text-gray-900">Meine Stacks</h1>
          <button
            onClick={() => setShowCreateForm((v) => !v)}
            className="inline-flex items-center gap-2 bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white font-semibold rounded-xl transition-all duration-200 shadow-sm px-4 py-2"
          >
            <Plus size={18} />
            Neuen Stack erstellen
            {showCreateForm ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>
        </div>

        {/* Create form */}
        {showCreateForm && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 flex flex-col gap-3">
            <h2 className="font-semibold text-gray-900">Neuer Stack</h2>
            <div className="flex gap-3">
              <input
                autoFocus
                type="text"
                placeholder="Stack-Name"
                value={newStackName}
                onChange={(e) => setNewStackName(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleCreate(); }}
                className="flex-1 border border-gray-200 rounded-xl px-4 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent text-sm"
              />
              <button
                onClick={handleCreate}
                disabled={creating}
                className="bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white font-semibold rounded-xl transition-all duration-200 shadow-sm px-4 py-2 disabled:opacity-60"
              >
                {creating ? 'Erstelle...' : 'Erstellen'}
              </button>
            </div>
            {createError && <p className="text-sm text-red-500">{createError}</p>}
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin border-4 border-indigo-500 border-t-transparent rounded-full w-8 h-8" />
          </div>
        )}

        {/* Error */}
        {error && !loading && (
          <div className="bg-red-50 border border-red-100 text-red-700 rounded-xl px-4 py-3">
            {error}
          </div>
        )}

        {/* Empty state */}
        {!loading && !error && stacks.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
            <p className="text-gray-500 text-lg">
              Noch keine Stacks. Suche nach Wirkstoffen, um Produkte hinzuzufügen.
            </p>
          </div>
        )}

        {/* Stack list */}
        {!loading && stacks.length > 0 && (
          <div className="flex flex-col gap-4">
            {stacks.map((stack) => (
              <StackCard
                key={stack.id}
                stack={stack}
                onDeleted={handleDeleted}
                onRenamed={handleRenamed}
                shopDomains={shopDomains}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
