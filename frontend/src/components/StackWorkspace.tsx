import { useEffect, useState, useCallback, useRef } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Calculator,
  ChevronDown,
  ChevronUp,
  FlaskConical,
  Info,
  Layers,
  Mail,
  Package,
  Plus,
  Search,
  Trash2,
  X,
} from 'lucide-react';
import SearchBar from './SearchBar';
import ProductCard from './ProductCard';
import type { DosageGuideline, Ingredient, ShopDomain } from '../types/local';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface DemoProduct {
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
  quantity?: number;
  unit?: string;
  form?: string;
  timing?: string;
  dosage_text?: string;
  effect_summary?: string;
  warning_title?: string;
  warning_message?: string;
  warning_type?: string;
  alternative_note?: string;
}

export interface DemoStack {
  id: string;
  name: string;
  products: DemoProduct[];
}

interface DemoState {
  stacks: DemoStack[];
  activeStackId: string;
}

export interface StackWorkspaceProps {
  mode?: 'demo' | 'authenticated';
  token?: string | null;
}

// ---------------------------------------------------------------------------
// Shared stack workspace helpers
// ---------------------------------------------------------------------------

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';
const DEMO_NOTICE = 'Diese Funktion ist nur in der kostenlosen Vollversion verfügbar. Registriere dich, damit deine Änderungen dauerhaft gespeichert werden.';

function apiPath(path: string): string {
  return `${API_BASE_URL}${path}`;
}

function newStackId(): string {
  return `stack_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

function createDefaultState(): DemoState {
  const id = newStackId();
  return { stacks: [{ id, name: 'Basis Gesundheit', products: [] }], activeStackId: id };
}

function authHeaders(token?: string | null): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

function demoRestrictedNotice() {
  window.alert(DEMO_NOTICE);
}

function mapStackDetail(stack: { id: number | string; name: string }, detail?: Record<string, unknown>): DemoStack {
  return {
    id: String(stack.id),
    name: (detail?.stack as { name?: string } | undefined)?.name ?? stack.name,
    products: ((detail?.products ?? detail?.items ?? []) as DemoProduct[]),
  };
}

interface ManualDose {
  value: number;
  unit: string;
}

function normalizeUnitToGerman(unit?: string): string {
  return (unit ?? '').replace(/\bIU\b/gi, 'IE').replace(/\biu\b/g, 'IE');
}

function primaryDose(guideline?: DosageGuideline): ManualDose | null {
  if (!guideline) return null;
  const value = guideline.dose_max ?? guideline.dose_min;
  if (value == null || !guideline.unit) return null;
  return { value, unit: normalizeUnitToGerman(guideline.unit) };
}

function productMonthlyPrice(product: DemoProduct): number {
  const totalServings = (product.servings_per_container ?? 0) * (product.container_count ?? 1);
  return totalServings > 0 ? (product.price / totalServings) * 30 : product.price;
}

function formatEuro(value: number): string {
  return value.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// ---------------------------------------------------------------------------
// AddProductModal
// ---------------------------------------------------------------------------

function AddProductModal({
  stacks,
  activeStackId,
  onAdd,
  onClose,
}: {
  stacks: DemoStack[];
  activeStackId: string;
  onAdd: (product: DemoProduct, stackId: string) => Promise<void>;
  onClose: () => void;
}) {
  const [step, setStep] = useState<'search' | 'dosage' | 'products'>('search');
  const [ingredient, setIngredient] = useState<Ingredient | null>(null);
  const [guidelines, setGuidelines] = useState<DosageGuideline[]>([]);
  const [guidelinesLoading, setGuidelinesLoading] = useState(false);
  const [dose, setDose] = useState<ManualDose>({ value: 0, unit: '' });
  const [targetStackId, setTargetStackId] = useState(activeStackId);
  const [products, setProducts] = useState<DemoProduct[]>([]);
  const [productsLoading, setProductsLoading] = useState(false);
  const [savingProductId, setSavingProductId] = useState<number | null>(null);
  const [error, setError] = useState('');

  const dgeGuideline = guidelines.find((gl) => gl.source === 'DGE' || gl.is_default) ?? guidelines[0];
  const studyGuideline = guidelines.find((gl) => gl.source === 'study') ?? guidelines.find((gl) => gl.id !== dgeGuideline?.id);
  const chooseIngredient = (selected: Ingredient) => {
    setIngredient(selected);
    setStep('dosage');
    setError('');
    setGuidelines([]);
    setGuidelinesLoading(true);

    fetch(apiPath(`/ingredients/${selected.id}/dosage-guidelines`))
      .then((response) => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return response.json();
      })
      .then((data) => {
        const loadedGuidelines: DosageGuideline[] = data.guidelines ?? [];
        setGuidelines(loadedGuidelines);
        const defaultDose = primaryDose(loadedGuidelines.find((gl) => gl.is_default) ?? loadedGuidelines[0]);
        setDose(defaultDose ?? { value: 1, unit: normalizeUnitToGerman(selected.unit) || 'Portion' });
      })
      .catch(() => {
        setDose({ value: 1, unit: normalizeUnitToGerman(selected.unit) || 'Portion' });
      })
      .finally(() => setGuidelinesLoading(false));
  };

  const loadProducts = () => {
    if (!ingredient) return;
    setStep('products');
    setProductsLoading(true);
    setError('');
    fetch(apiPath(`/ingredients/${ingredient.id}/products`))
      .then((response) => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return response.json();
      })
      .then((data) => setProducts(data.products ?? []))
      .catch(() => setError('Produkte konnten nicht geladen werden.'))
      .finally(() => setProductsLoading(false));
  };

  const addProduct = async (product: DemoProduct) => {
    const enhancedProduct: DemoProduct = {
      ...product,
      dosage_text: product.dosage_text || `${dose.value || 1} ${dose.unit || 'Portion'} täglich`,
      timing: product.timing || 'Zum Frühstück',
    };
    setSavingProductId(product.id);
    setError('');
    try {
      await onAdd(enhancedProduct, targetStackId);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Produkt konnte nicht gespeichert werden.');
    } finally {
      setSavingProductId(null);
    }
  };

  const dosePercent = dgeGuideline && dose.value
    ? Math.round((dose.value / (dgeGuideline.dose_max ?? dgeGuideline.dose_min ?? dose.value)) * 100)
    : null;
  const modalWidthClass = step === 'products' ? 'max-w-xl' : 'max-w-3xl';

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-950/55 px-3 py-6 backdrop-blur-sm sm:px-6"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className={`w-full ${modalWidthClass} rounded-[1.6rem] bg-white p-5 shadow-[0_30px_80px_rgba(15,23,42,0.35)] sm:p-6`}>
        <div className="mb-6 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Plus size={28} className="text-emerald-600" />
            <h2 className="text-2xl font-black tracking-tight text-slate-950 sm:text-3xl">
              Produkt hinzufügen
            </h2>
          </div>
          <button
            onClick={onClose}
            className="rounded-2xl p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
            aria-label="Schließen"
          >
            <X size={24} />
          </button>
        </div>

        {step === 'search' && (
          <div className="rounded-2xl border border-blue-200 bg-blue-50/50 p-4 sm:p-5">
            <div className="mb-4 flex items-center gap-3 text-blue-900">
              <Search size={26} />
              <h3 className="text-xl font-black sm:text-2xl">Wirkstoff suchen</h3>
            </div>
            <p className="mb-3 text-base font-black text-slate-700">Nach Wirkstoff suchen</p>
            <SearchBar
              onSelect={chooseIngredient}
              placeholder="z.B. D3, Cobalamin, Magnesium..."
            />
            <p className="mt-3 text-sm font-semibold text-slate-500">
              Beginnen Sie zu tippen, um Wirkstoffe zu finden.
            </p>
          </div>
        )}

        {step === 'dosage' && ingredient && (
          <>
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50/50 p-4 sm:p-5">
              <div className="mb-4 flex items-center gap-3 text-emerald-800">
                <Calculator size={24} />
                <h3 className="text-xl font-black sm:text-2xl">
                  Dosierung für {ingredient.name} festlegen
                </h3>
              </div>

              {guidelinesLoading ? (
                <div className="py-8 text-center text-sm font-semibold text-slate-500">
                  Leitlinien werden geladen...
                </div>
              ) : (
                <div className="grid gap-4 md:grid-cols-2">
                  <button
                    type="button"
                    onClick={() => {
                      const nextDose = primaryDose(dgeGuideline);
                      if (nextDose) setDose(nextDose);
                    }}
                    className="rounded-2xl border border-blue-200 bg-white/80 p-4 text-left transition hover:border-blue-400 hover:bg-blue-50"
                  >
                    <p className="text-base font-black text-blue-700">DGE-Empfehlung</p>
                    <p className="mt-2 text-2xl font-black text-blue-600">
                      {primaryDose(dgeGuideline)?.value ?? dose.value}{primaryDose(dgeGuideline)?.unit ?? dose.unit}
                    </p>
                    <span className="mt-4 flex justify-center rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-black text-white">
                      DGE verwenden
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const nextDose = primaryDose(studyGuideline);
                      if (nextDose) setDose(nextDose);
                    }}
                    className="rounded-2xl border border-violet-200 bg-white/80 p-4 text-left transition hover:border-violet-400 hover:bg-violet-50"
                  >
                    <p className="text-base font-black text-violet-700">Studien-Empfehlung</p>
                    <p className="mt-2 text-2xl font-black text-violet-600">
                      {primaryDose(studyGuideline)?.value ?? Math.max(dose.value * 2, dose.value)}{primaryDose(studyGuideline)?.unit ?? dose.unit}
                    </p>
                    <span className="mt-4 flex justify-center rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-black text-white">
                      Studien-Dosierung
                    </span>
                  </button>
                </div>
              )}

              <label className="mt-5 block text-base font-black text-slate-700">
                Gewünschte Tagesdosis ({dose.unit || normalizeUnitToGerman(ingredient.unit) || 'Einheit'})
              </label>
              <input
                type="number"
                min={0}
                value={dose.value || ''}
                onChange={(event) => setDose((prev) => ({ ...prev, value: Number(event.target.value) }))}
                className="mt-3 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-xl font-semibold text-slate-950 shadow-sm focus:border-blue-400 focus:outline-none focus:ring-4 focus:ring-blue-100"
              />
              <p className="mt-2 text-sm font-semibold text-slate-500">
                Geben Sie Ihre gewünschte tägliche Menge ein.
              </p>

              {dosePercent != null && (
                <div className="mt-5 flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-amber-800">
                  <AlertTriangle size={24} className="mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="font-black">Innerhalb DGE-Empfehlung</p>
                    <p className="mt-1 text-sm font-semibold">
                      Diese Dosierung entspricht {dosePercent}% der DGE-Empfehlung.
                    </p>
                  </div>
                </div>
              )}

              <label className="mt-5 block text-base font-black text-slate-700">Stack auswählen</label>
              <select
                value={targetStackId}
                onChange={(event) => setTargetStackId(event.target.value)}
                className="mt-3 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-lg font-semibold text-slate-950 shadow-sm focus:border-blue-400 focus:outline-none focus:ring-4 focus:ring-blue-100"
              >
                {stacks.map((stack) => (
                  <option key={stack.id} value={stack.id}>{stack.name}</option>
                ))}
              </select>
              <p className="mt-2 text-sm font-semibold text-slate-500">
                Produkt wird diesem Stack hinzugefügt.
              </p>
            </div>

            <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <button
                onClick={() => setStep('search')}
                className="inline-flex items-center gap-2 rounded-xl px-2 py-2 text-base font-semibold text-blue-600 hover:text-blue-800"
              >
                <ArrowLeft size={20} />
                Zurück zur Suche
              </button>
              <button
                onClick={loadProducts}
                className="inline-flex items-center justify-center gap-3 rounded-xl bg-emerald-600 px-6 py-3 text-lg font-black text-white shadow-lg shadow-emerald-600/20 hover:bg-emerald-700"
              >
                Weiter zu Produkten
                <ArrowRight size={24} />
              </button>
            </div>
          </>
        )}

        {step === 'products' && ingredient && (
          <>
            <div className="mb-5">
              <h3 className="text-2xl font-black tracking-tight text-slate-950">Produkt auswählen</h3>
              <p className="mt-1 text-base font-semibold text-slate-500">
                {ingredient.name} · {dose.value || 1} {dose.unit || normalizeUnitToGerman(ingredient.unit)}
              </p>
            </div>
            <div className="border-y border-slate-200 py-5">
              {productsLoading && (
                <div className="flex justify-center py-12">
                  <div className="h-10 w-10 animate-spin rounded-full border-4 border-blue-500 border-t-transparent" />
                </div>
              )}
              {error && <p className="rounded-2xl bg-red-50 px-4 py-3 text-sm font-bold text-red-700">{error}</p>}
              {!productsLoading && products.length === 0 && !error && (
                <p className="py-10 text-center text-sm font-semibold text-slate-500">Keine Produkte für diesen Wirkstoff gefunden.</p>
              )}
              <div className="grid gap-4">
                {products.map((product) => (
                  <div key={product.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <h4 className="text-xl font-black text-slate-950">{product.name}</h4>
                        {product.brand && <p className="mt-1 text-base font-semibold text-slate-500">{product.brand}</p>}
                        {product.form && <p className="mt-2 text-sm font-semibold text-slate-400">{product.form}</p>}
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="text-xl font-black text-emerald-600">€{formatEuro(productMonthlyPrice(product))}</p>
                        <p className="text-xs font-semibold text-slate-500">pro Monat</p>
                      </div>
                    </div>
                    <div className="mt-4 grid grid-cols-2 gap-3 rounded-2xl bg-slate-50 p-4">
                      <div>
                        <p className="text-sm font-semibold text-slate-500">Dosierung:</p>
                        <p className="mt-1 text-base font-black text-slate-950">{product.dosage_text || `${dose.value || 1} ${dose.unit || 'Portion'}`}</p>
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-slate-500">Packung:</p>
                        <p className="mt-1 text-base font-black text-slate-950">
                          {product.servings_per_container ? `${product.servings_per_container} Stück` : 'Nach Verbrauch'}
                        </p>
                      </div>
                    </div>
                    <div className="mt-3 grid grid-cols-2 gap-3">
                      <div className="rounded-2xl border border-slate-100 bg-white px-4 py-3">
                        <p className="text-xs font-semibold text-slate-500">Einmalpreis</p>
                        <p className="mt-1 text-lg font-black text-slate-950">€{formatEuro(product.price)}</p>
                      </div>
                      <div className="rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-3">
                        <p className="text-xs font-semibold text-emerald-700">Pro Monat</p>
                        <p className="mt-1 text-lg font-black text-emerald-700">€{formatEuro(productMonthlyPrice(product))}</p>
                      </div>
                    </div>
                    <button
                      onClick={() => void addProduct(product)}
                      disabled={savingProductId === product.id}
                      className="mt-4 inline-flex w-full items-center justify-center gap-3 rounded-xl bg-blue-600 px-5 py-3 text-base font-black text-white shadow-lg shadow-blue-600/20 hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <Plus size={22} />
                      {savingProductId === product.id ? 'Speichert...' : 'Hinzufügen'}
                    </button>
                  </div>
                ))}
              </div>
            </div>
            <div className="mt-6 flex items-center justify-between gap-4">
              <button
                onClick={() => setStep('dosage')}
                className="inline-flex items-center gap-2 rounded-xl px-2 py-3 text-lg font-semibold text-blue-600 hover:text-blue-800"
              >
                <ArrowLeft size={20} />
                Zurück zur Dosierung
              </button>
              <p className="hidden items-center gap-2 text-sm font-semibold text-slate-500 sm:flex">
                <Info size={18} />
                Demo-Modus: Änderungen werden nach Neuladen zurückgesetzt.
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Stack tabs
// ---------------------------------------------------------------------------

export function StackTabs({
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
    <div className="flex gap-2 overflow-x-auto rounded-2xl border border-slate-200 bg-white/80 p-2 shadow-sm">
      {stacks.map((stack) => (
        <div
          key={stack.id}
          className={`flex-shrink-0 flex items-center gap-1 transition-all cursor-pointer ${
            stack.id === activeId
              ? 'bg-gradient-to-r from-blue-600 to-violet-600 text-white rounded-xl px-4 py-2 text-sm font-black shadow-sm whitespace-nowrap'
              : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50 rounded-xl px-4 py-2 text-sm font-bold transition-colors whitespace-nowrap'
          }`}
        >
          {editingId === stack.id ? (
            <input
              ref={inputRef}
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onBlur={commitEdit}
              onKeyDown={(e) => { if (e.key === 'Enter') commitEdit(); if (e.key === 'Escape') setEditingId(null); }}
              className="w-44 bg-white/90 text-sm font-bold outline-none placeholder-white/60"
            />
          ) : (
            <span
              className="max-w-[180px] truncate text-sm font-black"
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
        className="flex-shrink-0 flex items-center gap-1 rounded-xl border-2 border-dashed border-slate-200 bg-white px-4 py-2 text-sm font-black text-slate-400 transition-colors hover:border-blue-300 hover:text-blue-600"
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
  const [selectedProductIds, setSelectedProductIds] = useState<Set<number>>(new Set());
  const PREVIEW_COUNT = 4;
  const visibleProducts = showAll ? stack.products : stack.products.slice(0, PREVIEW_COUNT);
  const hasMore = stack.products.length > PREVIEW_COUNT;
  const selectedProducts = stack.products.filter((product) => selectedProductIds.has(product.id));
  const totalOnce = selectedProducts.reduce((sum, product) => sum + (product.price ?? 0), 0);
  const totalMonthly = selectedProducts.reduce((sum, product) => {
    const totalServings = (product.servings_per_container ?? 0) * (product.container_count ?? 1);
    return sum + (totalServings > 0 ? (product.price / totalServings) * 30 : product.price);
  }, 0);

  useEffect(() => {
    setSelectedProductIds(new Set());
  }, [stack.id]);

  useEffect(() => {
    setSelectedProductIds((prev) => new Set([...prev].filter((id) => stack.products.some((product) => product.id === id))));
  }, [stack.products]);

  if (stack.products.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 gap-2 text-center border-2 border-dashed border-gray-200 rounded-xl">
        <Package size={32} className="text-gray-300" />
        <p className="text-gray-500 text-sm">Noch leer — suche nach einem Wirkstoff und füge Produkte hinzu.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5 pb-28">
      {/* Masonry grid */}
      <div className="grid grid-cols-1 items-start gap-5 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
        {visibleProducts.map((product) => (
          <div key={product.id} className="relative">
            {/* Remove button overlay */}
            <button
              onClick={() => onRemove(product.id)}
              className="absolute -right-1 -top-1 z-20 flex h-7 w-7 items-center justify-center rounded-full border border-slate-200 bg-white/95 p-0 text-slate-400 shadow-sm transition-colors hover:text-red-500"
              aria-label={`${product.name} entfernen`}
            >
              <Trash2 size={12} />
            </button>
            <ProductCard
              product={product}
              shopDomains={shopDomains}
              selected={selectedProductIds.has(product.id)}
              onToggleSelected={() =>
                setSelectedProductIds((prev) => {
                  const next = new Set(prev);
                  if (next.has(product.id)) next.delete(product.id);
                  else next.add(product.id);
                  return next;
                })
              }
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

      {/* Selection footer */}
      <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-blue-200 bg-white/95 px-4 py-4 shadow-[0_-16px_40px_rgba(15,23,42,0.10)] backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-lg font-black text-slate-900">Gewählte Supplements</p>
            <p className="text-sm text-slate-500">
              {selectedProductIds.size} von {stack.products.length} ausgewählt
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-5">
            <div className="text-right">
              <p className="text-sm text-slate-500">Einmalkosten</p>
              <p className="text-2xl font-black text-blue-600">{totalOnce.toFixed(2)} €</p>
            </div>
            <div className="text-right">
              <p className="text-sm text-slate-500">Pro Monat</p>
              <p className="text-2xl font-black text-emerald-600">{totalMonthly.toFixed(2)} €</p>
            </div>
            <button
              onClick={() => {
                if (selectedProductIds.size === stack.products.length) setSelectedProductIds(new Set());
                else setSelectedProductIds(new Set(stack.products.map((product) => product.id)));
              }}
              className="rounded-xl bg-violet-600 px-8 py-3 text-sm font-black text-white shadow-lg shadow-violet-600/20 hover:bg-violet-700"
            >
              {selectedProductIds.size === stack.products.length ? 'Alle abwählen' : 'Alle auswählen'}
            </button>
          </div>
        </div>
      </div>

    </div>
  );
}

// ---------------------------------------------------------------------------
// StackWorkspace — main exported component
// ---------------------------------------------------------------------------

export function StackWorkspace({ mode = 'demo', token = null }: StackWorkspaceProps) {
  const [state, setState] = useState<DemoState>(createDefaultState);
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [shopDomains, setShopDomains] = useState<ShopDomain[]>([]);
  const [loading, setLoading] = useState(mode === 'authenticated');
  const [error, setError] = useState('');

  // Fetch shop domains once
  useEffect(() => {
    fetch(apiPath('/shop-domains'))
      .then((r) => r.ok ? r.json() : { shops: [] })
      .then((data) => setShopDomains(data.shops ?? []))
      .catch(() => { /* non-critical */ });
  }, []);

  const loadAuthenticatedStacks = useCallback(async () => {
    if (mode !== 'authenticated' || !token) return;
    setLoading(true);
    setError('');
    try {
      const res = await fetch(apiPath('/stacks'), { headers: authHeaders(token) });
      if (!res.ok) throw new Error('Stacks konnten nicht geladen werden.');
      const data = await res.json();
      const stackList: Array<{ id: number; name: string }> = data.stacks ?? data ?? [];
      if (stackList.length === 0) {
        const createRes = await fetch(apiPath('/stacks'), {
          method: 'POST',
          headers: authHeaders(token),
          body: JSON.stringify({ name: 'Mein Stack', product_ids: [] }),
        });
        if (!createRes.ok) throw new Error('Start-Stack konnte nicht erstellt werden.');
        const created = await createRes.json();
        const createdStack = created.stack ?? created;
        setState({ stacks: [mapStackDetail(createdStack)], activeStackId: String(createdStack.id) });
        return;
      }
      const detailed = await Promise.all(stackList.map(async (stack) => {
        const detailRes = await fetch(apiPath(`/stacks/${stack.id}`), { headers: authHeaders(token) });
        if (!detailRes.ok) return mapStackDetail(stack);
        const detail = await detailRes.json();
        return mapStackDetail(stack, detail);
      }));
      setState((prev) => ({
        stacks: detailed,
        activeStackId: detailed.some((stack) => stack.id === prev.activeStackId)
          ? prev.activeStackId
          : detailed[0].id,
      }));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unbekannter Fehler.');
    } finally {
      setLoading(false);
    }
  }, [mode, token]);

  useEffect(() => {
    if (mode === 'authenticated') {
      void loadAuthenticatedStacks();
      return;
    }

    const fresh = createDefaultState();
    fetch(apiPath('/demo/products'))
      .then((res) => res.ok ? res.json() : { products: [] })
      .then((data) => {
        const products = ((data.products ?? []) as DemoProduct[]).slice(0, 3);
        setState({ stacks: [{ ...fresh.stacks[0], products }], activeStackId: fresh.activeStackId });
      })
      .catch(() => setState(fresh));
  }, [loadAuthenticatedStacks, mode]);

  const activeStack = state.stacks.find((s) => s.id === state.activeStackId) ?? state.stacks[0];
  const isDemo = mode === 'demo';

  const persistStackProducts = useCallback(async (stackId: string, products: DemoProduct[], name?: string) => {
    if (mode !== 'authenticated' || !token) return;
    const payload: {
      name?: string;
      product_ids: Array<{ id: number; quantity: number; dosage_text?: string; timing?: string }>;
    } = {
      ...(name ? { name } : {}),
      product_ids: products.map((product) => ({
        id: product.id,
        quantity: product.quantity ?? 1,
        dosage_text: product.dosage_text,
        timing: product.timing,
      })),
    };
    const res = await fetch(apiPath(`/stacks/${stackId}`), {
      method: 'PUT',
      headers: authHeaders(token),
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error('Stack konnte nicht gespeichert werden.');
  }, [mode, token]);

  // ---- Stack management ----

  const handleCreateStack = useCallback(async () => {
    const id = newStackId();
    const name = `Stack ${state.stacks.length + 1}`;
    if (mode === 'authenticated' && token) {
      try {
        const res = await fetch(apiPath('/stacks'), {
          method: 'POST',
          headers: authHeaders(token),
          body: JSON.stringify({ name, product_ids: [] }),
        });
        if (!res.ok) throw new Error('Stack konnte nicht erstellt werden.');
        const data = await res.json();
        const created = data.stack ?? data;
        const createdStack = mapStackDetail(created);
        setState((prev) => ({
          stacks: [...prev.stacks, createdStack],
          activeStackId: createdStack.id,
        }));
        return;
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Stack konnte nicht erstellt werden.');
        return;
      }
    }
    setState((prev) => ({
      stacks: [...prev.stacks, { id, name, products: [] }],
      activeStackId: id,
    }));
  }, [mode, state.stacks.length, token]);

  const handleSwitchStack = useCallback((id: string) => {
    setState((prev) => ({ ...prev, activeStackId: id }));
  }, []);

  const handleDeleteStack = useCallback(async (id: string) => {
    if (state.stacks.length <= 1) {
      if (isDemo) {
        demoRestrictedNotice();
      } else {
        setError('Der letzte Stack kann nicht geloescht werden.');
      }
      return;
    }
    if (mode === 'authenticated' && token) {
      try {
        const res = await fetch(apiPath(`/stacks/${id}`), {
          method: 'DELETE',
          headers: authHeaders(token),
        });
        if (!res.ok) throw new Error('Stack konnte nicht geloescht werden.');
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Stack konnte nicht geloescht werden.');
        return;
      }
    }
    setState((prev) => {
      const remaining = prev.stacks.filter((s) => s.id !== id);
      const newActive = prev.activeStackId === id
        ? remaining[remaining.length - 1].id
        : prev.activeStackId;
      return { stacks: remaining, activeStackId: newActive };
    });
  }, [isDemo, mode, state.stacks.length, token]);

  const handleRenameStack = useCallback(async (id: string, name: string) => {
    const stack = state.stacks.find((s) => s.id === id);
    if (!stack) return;
    if (mode === 'authenticated' && token) {
      try {
        await persistStackProducts(id, stack.products, name);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Name konnte nicht gespeichert werden.');
        return;
      }
    }
    setState((prev) => ({
      ...prev,
      stacks: prev.stacks.map((s) => s.id === id ? { ...s, name } : s),
    }));
  }, [mode, persistStackProducts, state.stacks, token]);

  // ---- Product management ----

  const handleAddProduct = useCallback(async (product: DemoProduct, stackId?: string) => {
    const targetStackId = stackId ?? state.activeStackId;
    const targetStack = state.stacks.find((s) => s.id === targetStackId);
    if (!targetStack || targetStack.products.some((p) => p.id === product.id)) return;
    const nextProducts = [...targetStack.products, product];
    if (mode === 'authenticated' && token) {
      try {
        await persistStackProducts(targetStackId, nextProducts);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Produkt konnte nicht gespeichert werden.');
        void loadAuthenticatedStacks();
        throw err;
      }
    }
    setState((prev) => ({
      ...prev,
      stacks: prev.stacks.map((s) =>
        s.id === targetStackId
          ? { ...s, products: nextProducts }
          : s
      ),
    }));
  }, [loadAuthenticatedStacks, mode, persistStackProducts, state.activeStackId, state.stacks, token]);

  const handleRemoveProduct = useCallback(async (productId: number) => {
    const targetStack = activeStack;
    if (!targetStack) return;
    const nextProducts = targetStack.products.filter((p) => p.id !== productId);
    if (mode === 'authenticated' && token) {
      try {
        await persistStackProducts(targetStack.id, nextProducts);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Produkt konnte nicht entfernt werden.');
        void loadAuthenticatedStacks();
        throw err;
      }
    }
    setState((prev) => ({
      ...prev,
      stacks: prev.stacks.map((s) =>
        s.id === prev.activeStackId
          ? { ...s, products: nextProducts }
          : s
      ),
    }));
  }, [activeStack, loadAuthenticatedStacks, mode, persistStackProducts, token]);

  // ---- Reset ----

  const handleReset = () => {
    if (!window.confirm('Demo zurücksetzen? Alle Stacks und Produkte werden gelöscht.')) return;
    const fresh = createDefaultState();
    setState(fresh);
  };

  return (
    <div className="min-h-screen">
      <div className="flex flex-col gap-8 pb-10">
        <div className="text-center">
          <div className="inline-flex items-center justify-center gap-4">
            <FlaskConical size={42} className="text-blue-600" />
            <h1 className="text-4xl font-black tracking-tight text-slate-950 md:text-5xl">
              {isDemo ? 'Demo - Supplement Stack' : 'Meine Supplement Stacks'}
            </h1>
          </div>
          <p className="mt-3 text-xl font-semibold text-slate-500">
            {isDemo
              ? 'Teste den kompletten Ablauf mit einem Demo-Stack.'
              : 'Verwalte deine Supplements dauerhaft mit derselben Oberflaeche wie in der Demo.'}
          </p>
          <div className={`mx-auto mt-6 flex max-w-4xl items-start justify-center gap-3 rounded-xl border px-6 py-4 ${
            isDemo ? 'border-blue-200 bg-blue-50 text-blue-900' : 'border-emerald-200 bg-emerald-50 text-emerald-900'
          }`}>
            <Info size={18} className="mt-1 flex-shrink-0" />
            <p className="text-sm font-semibold leading-relaxed">
              {isDemo ? (
                <>
                  <span className="font-black">Interaktive Demo:</span> Produkt-Auswahl, Dosierung und Kostenrechnung sind nutzbar.
                  Nach dem Neuladen startet wieder der Demo-Stack; echte Datenbank-Aenderungen sind der Vollversion vorbehalten.
                </>
              ) : (
                <>
                  <span className="font-black">Gespeicherte Verwaltung:</span> Diese Ansicht nutzt dieselbe Oberflaeche wie die Demo
                  und speichert Aenderungen dauerhaft in deinem Account.
                </>
              )}
            </p>
          </div>
        </div>

        <div className="flex flex-col gap-6">
          {loading && (
            <div className="flex items-center justify-center rounded-2xl bg-white p-10 shadow-sm">
              <div className="h-9 w-9 animate-spin rounded-full border-4 border-blue-500 border-t-transparent" />
            </div>
          )}

          {error && (
            <div className="rounded-2xl border border-red-100 bg-red-50 px-5 py-4 text-sm font-bold text-red-700">
              {error}
            </div>
          )}

          <div className="rounded-2xl bg-white p-5 shadow-[0_16px_40px_rgba(15,23,42,0.08)]">
            <label className="mb-3 block text-sm font-black text-slate-700">Stack auswählen:</label>
            <div className="grid gap-3 lg:grid-cols-[1fr_auto_auto_auto_auto]">
              <select
                value={state.activeStackId}
                onChange={(event) => handleSwitchStack(event.target.value)}
                className="w-full rounded-lg border border-blue-300 bg-white px-4 py-3 text-base font-semibold text-slate-950 focus:border-blue-500 focus:outline-none focus:ring-4 focus:ring-blue-100"
              >
                {state.stacks.map((stack) => (
                  <option key={stack.id} value={stack.id}>
                    {stack.name} ({stack.products.length} Produkte)
                  </option>
                ))}
              </select>
              <button
                onClick={() => setAddModalOpen(true)}
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-600 px-5 py-3 text-sm font-black text-white shadow-lg shadow-emerald-600/20 hover:bg-emerald-700"
              >
                <Plus size={18} />
                Produkt hinzufügen
              </button>
              <button
                onClick={() => void handleCreateStack()}
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-violet-600 px-5 py-3 text-sm font-black text-white shadow-lg shadow-violet-600/20 hover:bg-violet-700"
              >
                <Plus size={18} />
                Stack erstellen
              </button>
              <button
                onClick={isDemo ? demoRestrictedNotice : () => window.alert('Mail-Versand bauen wir als naechsten Vollversions-Schritt ein.')}
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-slate-900 px-5 py-3 text-sm font-black text-white shadow-lg shadow-slate-900/10 hover:bg-slate-800"
              >
                <Mail size={17} />
                Stack mailen
              </button>
              <button
                onClick={() => void handleDeleteStack(state.activeStackId)}
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-red-600 px-5 py-3 text-sm font-black text-white shadow-lg shadow-red-600/20 hover:bg-red-700"
              >
                <Trash2 size={17} />
                Stack löschen
              </button>
            </div>
          </div>

          {/* Active stack */}
          {activeStack && (
            <section className="rounded-2xl bg-white p-5 shadow-[0_16px_40px_rgba(15,23,42,0.08)] sm:p-7">
              <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700">
                    <Layers size={24} />
                  </span>
                  <h2 className="mb-0 text-3xl font-black tracking-tight text-slate-950">
                    {isDemo ? 'Ihr Demo Stack' : activeStack.name}
                  </h2>
                </div>
                <span className="inline-flex items-center gap-2 rounded-full bg-blue-100 px-4 py-2 text-sm font-black text-blue-700">
                  <Package size={17} />
                  {activeStack.products.length} Produkte im Stack
                </span>
              </div>
              <StackView
                stack={activeStack}
                shopDomains={shopDomains}
                onRemove={handleRemoveProduct}
              />
            </section>
          )}

          {/* Register CTA (bottom) */}
          {isDemo && (
          <div className="rounded-2xl border border-blue-100 bg-gradient-to-r from-blue-50 to-violet-50 p-8 text-center shadow-sm">
            <p className="text-2xl font-black text-slate-950">Gefällt Ihnen die Demo?</p>
            <p className="mt-2 text-slate-600">Registrieren Sie sich, um Ihre Stacks dauerhaft zu speichern.</p>
            <Link
              to="/register"
              className="mt-5 inline-flex items-center gap-2 rounded-xl bg-blue-600 px-8 py-3 text-base font-black text-white shadow-lg shadow-blue-600/20 hover:bg-blue-700"
            >
              Kostenlos registrieren
            </Link>
          </div>
          )}
        </div>

        {addModalOpen && (
          <AddProductModal
            stacks={state.stacks}
            activeStackId={state.activeStackId}
            onAdd={handleAddProduct}
            onClose={() => setAddModalOpen(false)}
          />
        )}
      </div>
    </div>
  );
}

export default StackWorkspace;
