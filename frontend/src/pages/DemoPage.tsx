import { useEffect, useState, useCallback, useRef } from 'react';
import { Link } from 'react-router-dom';
import { Trash2, Package, Plus, X, RotateCcw, ShoppingBag, ChevronDown, ChevronUp } from 'lucide-react';
import SearchBar from '../components/SearchBar';
import ProductCard from '../components/ProductCard';
import type { Ingredient, ShopDomain } from '../types/local';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface DemoProduct {
  id: number;
  name: string;
  price: number;
  brand?: string;
  shop_link?: string;
  image_url?: string;
  is_affiliate?: number;
  discontinued_at?: string;
  serving_size?: number;
  serving_unit?: string;
  servings_per_container?: number;
  container_count?: number;
}

interface DemoStack {
  id: string;
  name: string;
  products: DemoProduct[];
}

interface DemoState {
  stacks: DemoStack[];
  activeStackId: string;
}

// ---------------------------------------------------------------------------
// sessionStorage state manager
// ---------------------------------------------------------------------------

const DEMO_STORAGE_KEY = 'ss_demo_v2';

function newStackId(): string {
  return `stack_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

function createDefaultState(): DemoState {
  const id = newStackId();
  return { stacks: [{ id, name: 'Mein Stack', products: [] }], activeStackId: id };
}

function loadState(): DemoState {
  try {
    const raw = sessionStorage.getItem(DEMO_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as DemoState;
      if (parsed.stacks?.length > 0) return parsed;
    }
  } catch { /* ignore */ }
  return createDefaultState();
}

function saveState(state: DemoState): void {
  try {
    sessionStorage.setItem(DEMO_STORAGE_KEY, JSON.stringify(state));
  } catch { /* ignore quota errors */ }
}

// ---------------------------------------------------------------------------
// Product picker modal
// ---------------------------------------------------------------------------

function ProductPickerModal({
  ingredient,
  onAdd,
  onClose,
}: {
  ingredient: Ingredient;
  onAdd: (product: DemoProduct) => void;
  onClose: () => void;
}) {
  const [products, setProducts] = useState<DemoProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch(`/api/ingredients/${ingredient.id}/products`)
      .then((r) => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
      .then((data) => setProducts(data.products ?? []))
      .catch(() => setError('Produkte konnten nicht geladen werden.'))
      .finally(() => setLoading(false));
  }, [ingredient.id]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 px-0 sm:px-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="w-full sm:max-w-lg max-h-[85vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl shadow-2xl bg-white flex flex-col">
        {/* Header */}
        <div className="sticky top-0 z-10 bg-gradient-to-r from-indigo-500 to-purple-600 text-white p-4 rounded-t-2xl flex items-center justify-between">
          <div>
            <p className="text-xs text-white/70 font-medium uppercase tracking-wider">Produkt wählen</p>
            <h2 className="text-lg font-bold leading-tight">{ingredient.name}</h2>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg text-white/70 hover:text-white hover:bg-white/10 transition-colors" aria-label="Schließen">
            <X size={20} />
          </button>
        </div>

        <div className="p-4 flex flex-col gap-3">
          {loading && (
            <div className="flex justify-center py-8">
              <div className="animate-spin border-4 border-indigo-500 border-t-transparent rounded-full w-8 h-8" />
            </div>
          )}
          {error && <p className="text-red-600 text-sm bg-red-50 rounded-xl px-3 py-2">{error}</p>}
          {!loading && products.length === 0 && !error && (
            <p className="text-gray-500 text-sm text-center py-6">Keine Produkte für diesen Wirkstoff gefunden.</p>
          )}
          {products.map((p) => (
            <div key={p.id} className="flex items-center gap-3 p-3 rounded-xl hover:bg-gray-50 transition-colors cursor-pointer border border-transparent hover:border-gray-100">
              <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-white border border-gray-200 overflow-hidden flex items-center justify-center">
                {p.image_url
                  ? <img src={p.image_url} alt={p.name} className="w-full h-full object-cover" />
                  : <Package size={18} className="text-gray-400" />
                }
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-900 truncate">{p.name}</p>
                {p.brand && <p className="text-xs text-gray-500">{p.brand}</p>}
                <span className="inline-flex items-center px-2 py-0.5 bg-gradient-to-r from-emerald-500 to-green-600 text-white text-xs font-bold rounded-full mt-0.5">
                  €{p.price.toFixed(2)}/Monat
                </span>
              </div>
              <button
                onClick={() => { onAdd(p); onClose(); }}
                className="flex-shrink-0 bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white font-semibold rounded-xl transition-all duration-200 shadow-sm px-3 py-1.5 text-sm"
              >
                Hinzufügen
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Stack tabs
// ---------------------------------------------------------------------------

function StackTabs({
  stacks,
  activeId,
  onSwitch,
  onCreate,
  onDelete,
  onRename,
}: {
  stacks: DemoStack[];
  activeId: string;
  onSwitch: (id: string) => void;
  onCreate: () => void;
  onDelete: (id: string) => void;
  onRename: (id: string, name: string) => void;
}) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const startEdit = (stack: DemoStack) => {
    setEditingId(stack.id);
    setEditValue(stack.name);
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  const commitEdit = () => {
    if (editingId && editValue.trim()) {
      onRename(editingId, editValue.trim());
    }
    setEditingId(null);
  };

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-2 flex gap-1 overflow-x-auto">
      {stacks.map((stack) => (
        <div
          key={stack.id}
          className={`flex-shrink-0 flex items-center gap-1 transition-all cursor-pointer ${
            stack.id === activeId
              ? 'bg-gradient-to-r from-indigo-500 to-purple-600 text-white rounded-xl px-4 py-2 text-sm font-semibold shadow-sm whitespace-nowrap'
              : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50 rounded-xl px-4 py-2 text-sm font-medium transition-colors whitespace-nowrap'
          }`}
        >
          {editingId === stack.id ? (
            <input
              ref={inputRef}
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onBlur={commitEdit}
              onKeyDown={(e) => { if (e.key === 'Enter') commitEdit(); if (e.key === 'Escape') setEditingId(null); }}
              className="text-sm font-medium bg-transparent outline-none w-24 placeholder-white/60"
            />
          ) : (
            <span
              className="text-sm font-medium max-w-[120px] truncate"
              onClick={() => stack.id === activeId ? startEdit(stack) : onSwitch(stack.id)}
              title={stack.id === activeId ? 'Klicken zum Umbenennen' : stack.name}
            >
              {stack.name}
            </span>
          )}
          {stacks.length > 1 && (
            <button
              onClick={(e) => { e.stopPropagation(); onDelete(stack.id); }}
              className={`ml-0.5 rounded-full p-0.5 transition-colors ${stack.id === activeId ? 'hover:bg-white/20 text-white/70' : 'hover:bg-gray-200 text-gray-400'}`}
              aria-label={`Stack "${stack.name}" löschen`}
            >
              <X size={12} />
            </button>
          )}
        </div>
      ))}
      <button
        onClick={onCreate}
        className="flex-shrink-0 flex items-center gap-1 border-2 border-dashed border-gray-200 text-gray-400 hover:border-indigo-300 hover:text-indigo-500 rounded-xl px-4 py-2 text-sm font-medium transition-colors whitespace-nowrap"
        aria-label="Neuen Stack erstellen"
      >
        <Plus size={14} />
        Neu
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Active stack view
// ---------------------------------------------------------------------------

function StackView({
  stack,
  shopDomains,
  onRemove,
}: {
  stack: DemoStack;
  shopDomains: ShopDomain[];
  onRemove: (productId: number) => void;
}) {
  const [showAll, setShowAll] = useState(false);
  const total = stack.products.reduce((s, p) => s + (p.price ?? 0), 0);
  const PREVIEW_COUNT = 4;
  const visibleProducts = showAll ? stack.products : stack.products.slice(0, PREVIEW_COUNT);
  const hasMore = stack.products.length > PREVIEW_COUNT;

  if (stack.products.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 gap-2 text-center border-2 border-dashed border-gray-200 rounded-xl">
        <Package size={32} className="text-gray-300" />
        <p className="text-gray-400 text-sm">Noch leer — suche nach einem Wirkstoff und füge Produkte hinzu.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Masonry grid */}
      <div style={{ columnCount: 2, columnGap: '12px' }}>
        {visibleProducts.map((product) => (
          <div key={product.id} style={{ breakInside: 'avoid', marginBottom: '12px' }} className="relative">
            {/* Remove button overlay */}
            <button
              onClick={() => onRemove(product.id)}
              className="absolute top-1.5 right-1.5 z-10 p-1 rounded-lg bg-white/80 text-gray-400 hover:text-red-500 hover:bg-white transition-colors shadow-sm"
              aria-label={`${product.name} entfernen`}
            >
              <Trash2 size={12} />
            </button>
            <ProductCard
              product={product}
              shopDomains={shopDomains}
              showWishlistButton={false}
              showSelectButton={false}
            />
          </div>
        ))}
      </div>

      {/* Show more/less */}
      {hasMore && (
        <button
          onClick={() => setShowAll((v) => !v)}
          className="flex items-center justify-center gap-1.5 text-sm text-indigo-500 hover:text-indigo-700 hover:bg-indigo-50 rounded-xl px-4 py-1.5 transition-colors"
        >
          {showAll ? <><ChevronUp size={14} /> Weniger anzeigen</> : <><ChevronDown size={14} /> {stack.products.length - PREVIEW_COUNT} weitere anzeigen</>}
        </button>
      )}

      {/* Total footer */}
      <div className="bg-gradient-to-r from-indigo-500 to-purple-600 text-white rounded-2xl px-5 py-4 flex items-center justify-between shadow-sm mt-2">
        <span className="text-white/80 text-sm">{stack.products.length} {stack.products.length === 1 ? 'Produkt' : 'Produkte'}</span>
        <span className="text-white font-bold text-xl">€{total.toFixed(2)}/Monat</span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main DemoPage
// ---------------------------------------------------------------------------

export default function DemoPage() {
  const [state, setState] = useState<DemoState>(loadState);
  const [selectedIngredient, setSelectedIngredient] = useState<Ingredient | null>(null);
  const [shopDomains, setShopDomains] = useState<ShopDomain[]>([]);

  // Persist to sessionStorage on every state change
  useEffect(() => {
    saveState(state);
  }, [state]);

  // Fetch shop domains once
  useEffect(() => {
    fetch('/api/shop-domains')
      .then((r) => r.ok ? r.json() : { shops: [] })
      .then((data) => setShopDomains(data.shops ?? []))
      .catch(() => { /* non-critical */ });
  }, []);

  const activeStack = state.stacks.find((s) => s.id === state.activeStackId) ?? state.stacks[0];

  // ---- Stack management ----

  const handleCreateStack = useCallback(() => {
    const id = newStackId();
    const name = `Stack ${state.stacks.length + 1}`;
    setState((prev) => ({
      stacks: [...prev.stacks, { id, name, products: [] }],
      activeStackId: id,
    }));
  }, [state.stacks.length]);

  const handleSwitchStack = useCallback((id: string) => {
    setState((prev) => ({ ...prev, activeStackId: id }));
  }, []);

  const handleDeleteStack = useCallback((id: string) => {
    setState((prev) => {
      const remaining = prev.stacks.filter((s) => s.id !== id);
      if (remaining.length === 0) {
        return createDefaultState();
      }
      const newActive = prev.activeStackId === id
        ? remaining[remaining.length - 1].id
        : prev.activeStackId;
      return { stacks: remaining, activeStackId: newActive };
    });
  }, []);

  const handleRenameStack = useCallback((id: string, name: string) => {
    setState((prev) => ({
      ...prev,
      stacks: prev.stacks.map((s) => s.id === id ? { ...s, name } : s),
    }));
  }, []);

  // ---- Product management ----

  const handleAddProduct = useCallback((product: DemoProduct) => {
    setState((prev) => ({
      ...prev,
      stacks: prev.stacks.map((s) =>
        s.id === prev.activeStackId && !s.products.some((p) => p.id === product.id)
          ? { ...s, products: [...s.products, product] }
          : s
      ),
    }));
  }, []);

  const handleRemoveProduct = useCallback((productId: number) => {
    setState((prev) => ({
      ...prev,
      stacks: prev.stacks.map((s) =>
        s.id === prev.activeStackId
          ? { ...s, products: s.products.filter((p) => p.id !== productId) }
          : s
      ),
    }));
  }, []);

  // ---- Reset ----

  const handleReset = () => {
    if (!window.confirm('Demo zurücksetzen? Alle Stacks und Produkte werden gelöscht.')) return;
    const fresh = createDefaultState();
    setState(fresh);
    saveState(fresh);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-indigo-50/30">
      <div className="flex flex-col gap-5 pb-8">
        {/* Demo banner */}
        <div className="sticky top-0 z-30 bg-gradient-to-r from-amber-400 to-orange-400 text-white px-4 py-3 text-sm font-medium flex flex-wrap items-center justify-between gap-3">
          <p className="font-medium">
            Demo-Modus — Daten bleiben nur für diese Browser-Sitzung gespeichert.
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={handleReset}
              className="inline-flex items-center gap-1.5 border border-white/30 text-white hover:bg-white/10 px-3 py-1 rounded-lg text-xs font-medium transition-colors"
            >
              <RotateCcw size={13} />
              Zurücksetzen
            </button>
            <Link
              to="/register"
              className="inline-flex items-center gap-1.5 text-sm bg-white text-amber-600 hover:bg-gray-50 font-semibold px-3 py-1.5 rounded-lg transition-colors"
            >
              Registrieren →
            </Link>
          </div>
        </div>

        <div className="px-4 md:px-6 flex flex-col gap-5">
          {/* Stack tabs */}
          <StackTabs
            stacks={state.stacks}
            activeId={state.activeStackId}
            onSwitch={handleSwitchStack}
            onCreate={handleCreateStack}
            onDelete={handleDeleteStack}
            onRename={handleRenameStack}
          />

          {/* Search bar */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-2">
              Wirkstoff zum Stack hinzufügen
            </p>
            <SearchBar
              onSelect={setSelectedIngredient}
              placeholder="Wirkstoff suchen, z.B. Magnesium, Vitamin D..."
            />
          </div>

          {/* Active stack */}
          {activeStack && (
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-semibold text-gray-800">{activeStack.name}</h2>
                {activeStack.products.length > 0 && (
                  <button
                    onClick={() => setState((prev) => ({
                      ...prev,
                      stacks: prev.stacks.map((s) =>
                        s.id === prev.activeStackId ? { ...s, products: [] } : s
                      ),
                    }))}
                    className="text-xs text-red-400 hover:text-red-600 font-medium transition-colors"
                  >
                    Alle entfernen
                  </button>
                )}
              </div>
              <StackView
                stack={activeStack}
                shopDomains={shopDomains}
                onRemove={handleRemoveProduct}
              />
            </div>
          )}

          {/* Register CTA (bottom) */}
          <div className="mt-4 bg-gradient-to-br from-indigo-600 to-purple-700 rounded-2xl p-6 text-center text-white shadow-md">
            <p className="text-lg font-bold mb-1">Bereit für mehr?</p>
            <p className="text-white/80 text-sm mb-4">Registriere dich, um deine Stacks dauerhaft zu speichern.</p>
            <Link
              to="/register"
              className="inline-flex items-center gap-2 bg-white text-indigo-700 font-bold px-6 py-2.5 rounded-xl hover:bg-gray-50 transition-colors"
            >
              Kostenlos registrieren →
            </Link>
          </div>
        </div>

        {/* Product picker modal */}
        {selectedIngredient && (
          <ProductPickerModal
            ingredient={selectedIngredient}
            onAdd={handleAddProduct}
            onClose={() => setSelectedIngredient(null)}
          />
        )}
      </div>
    </div>
  );
}
