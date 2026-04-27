import { useEffect, useState, useCallback, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Calculator,
  Info,
  Package,
  Plus,
  Search,
  X,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import SearchBar from './SearchBar';
import ProductCard from './ProductCard';
import StacksHeader, { type StacksHeaderVariant } from './StacksHeader';
import EditStackModal from './EditStackModal';
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
  ingredient_category?: string;
}

export interface DemoStack {
  id: string;
  name: string;
  products: DemoProduct[];
  description?: string;
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
// Helpers
// ---------------------------------------------------------------------------

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';
const DEMO_NOTICE =
  'Diese Funktion ist nur in der kostenlosen Vollversion verfügbar. Registriere dich, damit deine Änderungen dauerhaft gespeichert werden.';
const DESC_STORAGE_KEY = 'ss_stack_descriptions';

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

function mapStackDetail(
  stack: { id: number | string; name: string },
  detail?: Record<string, unknown>,
): DemoStack {
  const products = (detail?.products ?? detail?.items ?? []) as DemoProduct[];
  return {
    id: String(stack.id),
    name: (detail?.stack as { name?: string } | undefined)?.name ?? stack.name,
    products,
  };
}

function loadDescriptions(): Record<string, string> {
  try {
    const raw = localStorage.getItem(DESC_STORAGE_KEY);
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    return (parsed && typeof parsed === 'object' ? (parsed as Record<string, string>) : {});
  } catch {
    return {};
  }
}

function saveDescription(stackId: string, description: string) {
  try {
    const next = loadDescriptions();
    if (description) next[stackId] = description;
    else delete next[stackId];
    localStorage.setItem(DESC_STORAGE_KEY, JSON.stringify(next));
  } catch {
    // ignore storage errors
  }
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
// Category classification (client-side)
// ---------------------------------------------------------------------------

type CategoryKey = 'general' | 'detox' | 'sports' | 'cognition';

interface CategoryMeta {
  label: string;
  cls: string;
  order: number;
}

const CATEGORY_META: Record<CategoryKey, CategoryMeta> = {
  general:   { label: 'Allgemeine Versorgung', cls: 'cat-general', order: 1 },
  detox:     { label: 'Entgiftung', cls: 'cat-detox', order: 2 },
  sports:    { label: 'Sport', cls: 'cat-sports', order: 3 },
  cognition: { label: 'Kognition', cls: 'cat-cognition', order: 4 },
};

const CATEGORY_ICONS: Record<CategoryKey, string> = {
  general: '🧬',
  detox: '🌿',
  sports: '🏃',
  cognition: '🧠',
};

function categorize(product: DemoProduct): CategoryKey {
  const hay = `${product.ingredient_category ?? ''} ${product.form ?? ''} ${product.name ?? ''} ${product.effect_summary ?? ''}`.toLowerCase();
  if (/(chlorella|spirulina|detox|entgiftung|zeolith|mariendistel|leber|gluta|ala)/i.test(hay)) return 'detox';
  if (/(creatin|kreatin|bcaa|protein|whey|beta-alanin|citrullin|arginin|pump|pre-workout|preworkout)/i.test(hay)) return 'sports';
  if (/(ashwagandha|rhodiola|ginkgo|nootrop|kogniti|fokus|gehirn|l-theanin|bacopa)/i.test(hay)) return 'cognition';
  return 'general';
}

// ---------------------------------------------------------------------------
// AddProductModal (unchanged styling from original — 3-step flow preserved)
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
  const studyGuideline =
    guidelines.find((gl) => gl.source === 'study') ??
    guidelines.find((gl) => gl.id !== dgeGuideline?.id);

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
        const loaded: DosageGuideline[] = data.guidelines ?? [];
        setGuidelines(loaded);
        const defaultDose = primaryDose(loaded.find((gl) => gl.is_default) ?? loaded[0]);
        setDose(defaultDose ?? { value: 0, unit: normalizeUnitToGerman(selected.unit) || '' });
      })
      .catch(() => {
        setDose({ value: 0, unit: normalizeUnitToGerman(selected.unit) || '' });
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
    const enhanced: DemoProduct = {
      ...product,
      dosage_text: product.dosage_text || `${dose.value || 1} ${dose.unit || 'Portion'} täglich`,
      timing: product.timing || 'Zum Frühstück',
    };
    setSavingProductId(product.id);
    setError('');
    try {
      await onAdd(enhanced, targetStackId);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Produkt konnte nicht gespeichert werden.');
    } finally {
      setSavingProductId(null);
    }
  };

  const dosePercent =
    dgeGuideline && dose.value
      ? Math.round(
          (dose.value / (dgeGuideline.dose_max ?? dgeGuideline.dose_min ?? dose.value)) * 100,
        )
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
            <SearchBar onSelect={chooseIngredient} placeholder="z.B. D3, Cobalamin, Magnesium..." />
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
                  {primaryDose(dgeGuideline) ? (
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
                        {primaryDose(dgeGuideline)!.value}
                        {primaryDose(dgeGuideline)!.unit}
                      </p>
                      <span className="mt-4 flex justify-center rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-black text-white">
                        DGE verwenden
                      </span>
                    </button>
                  ) : (
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-left cursor-default">
                      <p className="text-base font-black text-slate-500">DGE-Empfehlung</p>
                      <p className="mt-2 text-sm font-semibold text-slate-400">
                        Keine offizielle Empfehlung verfügbar
                      </p>
                    </div>
                  )}
                  {primaryDose(studyGuideline) ? (
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
                        {primaryDose(studyGuideline)!.value}
                        {primaryDose(studyGuideline)!.unit}
                      </p>
                      <span className="mt-4 flex justify-center rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-black text-white">
                        Studien-Dosierung
                      </span>
                    </button>
                  ) : (
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-left cursor-default">
                      <p className="text-base font-black text-slate-500">Studien-Empfehlung</p>
                      <p className="mt-2 text-sm font-semibold text-slate-400">
                        Keine Studiendaten hinterlegt
                      </p>
                    </div>
                  )}
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
                <p className="py-10 text-center text-sm font-semibold text-slate-500">
                  Keine Produkte für diesen Wirkstoff gefunden.
                </p>
              )}
              <div className="grid gap-4">
                {products.map((product) => (
                  <div key={product.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <h4 className="text-xl font-black text-slate-950">{product.name}</h4>
                        {product.brand && (
                          <p className="mt-1 text-base font-semibold text-slate-500">{product.brand}</p>
                        )}
                        {product.form && (
                          <p className="mt-2 text-sm font-semibold text-slate-400">{product.form}</p>
                        )}
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="text-xl font-black text-emerald-600">
                          €{formatEuro(productMonthlyPrice(product))}
                        </p>
                        <p className="text-xs font-semibold text-slate-500">pro Monat</p>
                      </div>
                    </div>
                    <div className="mt-4 grid grid-cols-2 gap-3 rounded-2xl bg-slate-50 p-4">
                      <div>
                        <p className="text-sm font-semibold text-slate-500">Dosierung:</p>
                        <p className="mt-1 text-base font-black text-slate-950">
                          {product.dosage_text || `${dose.value || 1} ${dose.unit || 'Portion'}`}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-slate-500">Packung:</p>
                        <p className="mt-1 text-base font-black text-slate-950">
                          {product.servings_per_container
                            ? `${product.servings_per_container} Stück`
                            : 'Nach Verbrauch'}
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
                        <p className="mt-1 text-lg font-black text-emerald-700">
                          €{formatEuro(productMonthlyPrice(product))}
                        </p>
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
// Icons used in toolbar
// ---------------------------------------------------------------------------

function IconPlus() {
  return (
    <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
      <path d="M6.5 1.5v10M1.5 6.5h10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}
function IconStackPlus() {
  return (
    <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
      <rect x="1.5" y="1.5" width="10" height="10" rx="2" stroke="currentColor" strokeWidth="1.5" />
      <path d="M4.5 6.5h4M6.5 4.5v4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}
function IconPencil() {
  return (
    <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
      <path d="M9 2L11 4L4.5 10.5L2 11L2.5 8.5L9 2Z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
      <path d="M8 3L10 5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}
function IconMail() {
  return (
    <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
      <path d="M2 3.5h9M2 6.5h9M2 9.5h5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}
function IconTrash() {
  return (
    <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
      <polyline points="1.5,3.5 13.5,3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M5 3.5V2.5h5v1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M3 3.5l.8 9.5h7.4L12 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M6 6.5v4M9 6.5v4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  );
}
function IconInfoCircle() {
  return (
    <svg width="15" height="15" viewBox="0 0 15 15" fill="none" style={{ flexShrink: 0, marginTop: 1 }}>
      <circle cx="7.5" cy="7.5" r="6.5" stroke="currentColor" strokeWidth="1.5" />
      <path d="M7.5 5v4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <circle cx="7.5" cy="11" r="0.7" fill="currentColor" />
    </svg>
  );
}
function IconChevron() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
      <polyline points="2,4 6,8 10,4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// StackWorkspace main
// ---------------------------------------------------------------------------

const HEADER_VARIANT: StacksHeaderVariant = 'warm';

export function StackWorkspace({ mode = 'demo', token = null }: StackWorkspaceProps) {
  const [state, setState] = useState<DemoState>(createDefaultState);
  const [descriptions, setDescriptions] = useState<Record<string, string>>(() => loadDescriptions());
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [shopDomains, setShopDomains] = useState<ShopDomain[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(mode === 'authenticated');
  const [error, setError] = useState('');
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const isDemo = mode === 'demo';

  // Fetch shop domains
  useEffect(() => {
    fetch(apiPath('/shop-domains'))
      .then((r) => (r.ok ? r.json() : { shops: [] }))
      .then((data) => setShopDomains(data.shops ?? []))
      .catch(() => { /* ignore */ });
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
      const detailed = await Promise.all(
        stackList.map(async (stack) => {
          const detailRes = await fetch(apiPath(`/stacks/${stack.id}`), {
            headers: authHeaders(token),
          });
          if (!detailRes.ok) return mapStackDetail(stack);
          const detail = await detailRes.json();
          return mapStackDetail(stack, detail);
        }),
      );
      setState((prev) => ({
        stacks: detailed,
        activeStackId: detailed.some((s) => s.id === prev.activeStackId)
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
      .then((res) => (res.ok ? res.json() : { products: [] }))
      .then((data) => {
        const products = ((data.products ?? []) as DemoProduct[]).slice(0, 6);
        setState({
          stacks: [{ ...fresh.stacks[0], products }],
          activeStackId: fresh.activeStackId,
        });
      })
      .catch(() => setState(fresh));
  }, [loadAuthenticatedStacks, mode]);

  const activeStack = state.stacks.find((s) => s.id === state.activeStackId) ?? state.stacks[0];

  // Reset selection when active stack changes
  useEffect(() => {
    setSelectedIds(new Set());
  }, [state.activeStackId]);

  // Keep selection in sync if products change
  useEffect(() => {
    if (!activeStack) return;
    setSelectedIds((prev) => {
      const valid = new Set([...prev].filter((id) => activeStack.products.some((p) => p.id === id)));
      if (valid.size === prev.size) return prev;
      return valid;
    });
  }, [activeStack]);

  const persistStackProducts = useCallback(
    async (stackId: string, products: DemoProduct[], name?: string) => {
      if (mode !== 'authenticated' || !token) return;
      const payload = {
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
    },
    [mode, token],
  );

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

  const handleDeleteStack = useCallback(
    async (id: string) => {
      if (state.stacks.length <= 1) {
        if (isDemo) demoRestrictedNotice();
        else setError('Der letzte Stack kann nicht gelöscht werden.');
        return;
      }
      const stack = state.stacks.find((s) => s.id === id);
      if (!stack) return;
      if (!window.confirm(`Stack "${stack.name}" wirklich löschen?`)) return;
      if (mode === 'authenticated' && token) {
        try {
          const res = await fetch(apiPath(`/stacks/${id}`), {
            method: 'DELETE',
            headers: authHeaders(token),
          });
          if (!res.ok) throw new Error('Stack konnte nicht gelöscht werden.');
        } catch (err) {
          setError(err instanceof Error ? err.message : 'Stack konnte nicht gelöscht werden.');
          return;
        }
      }
      setState((prev) => {
        const remaining = prev.stacks.filter((s) => s.id !== id);
        const newActive =
          prev.activeStackId === id ? remaining[remaining.length - 1].id : prev.activeStackId;
        return { stacks: remaining, activeStackId: newActive };
      });
      // Clean up description
      setDescriptions((prev) => {
        const next = { ...prev };
        delete next[id];
        saveDescription(id, '');
        return next;
      });
    },
    [isDemo, mode, state.stacks, token],
  );

  const handleSaveStackMeta = useCallback(
    async (newName: string, newDescription: string) => {
      if (!activeStack) return;
      const prevName = activeStack.name;
      if (mode === 'authenticated' && token && newName !== prevName) {
        await persistStackProducts(activeStack.id, activeStack.products, newName);
      }
      setState((prev) => ({
        ...prev,
        stacks: prev.stacks.map((s) => (s.id === activeStack.id ? { ...s, name: newName } : s)),
      }));
      setDescriptions((prev) => {
        const next = { ...prev, [activeStack.id]: newDescription };
        saveDescription(activeStack.id, newDescription);
        return next;
      });
      setEditModalOpen(false);
    },
    [activeStack, mode, persistStackProducts, token],
  );

  // ---- Product management ----

  const handleAddProduct = useCallback(
    async (product: DemoProduct, stackId?: string) => {
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
          s.id === targetStackId ? { ...s, products: nextProducts } : s,
        ),
      }));
    },
    [loadAuthenticatedStacks, mode, persistStackProducts, state.activeStackId, state.stacks, token],
  );

  const handleRemoveProduct = useCallback(
    async (productId: number) => {
      if (!activeStack) return;
      const nextProducts = activeStack.products.filter((p) => p.id !== productId);
      if (mode === 'authenticated' && token) {
        try {
          await persistStackProducts(activeStack.id, nextProducts);
        } catch (err) {
          setError(err instanceof Error ? err.message : 'Produkt konnte nicht entfernt werden.');
          void loadAuthenticatedStacks();
          return;
        }
      }
      setState((prev) => ({
        ...prev,
        stacks: prev.stacks.map((s) =>
          s.id === prev.activeStackId ? { ...s, products: nextProducts } : s,
        ),
      }));
    },
    [activeStack, loadAuthenticatedStacks, mode, persistStackProducts, token],
  );

  // ---- Selection / totals ----

  const toggleSelected = (id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectedProducts = useMemo(
    () => (activeStack?.products.filter((p) => selectedIds.has(p.id)) ?? []),
    [activeStack, selectedIds],
  );
  const totalOnce = selectedProducts.reduce((sum, p) => sum + (p.price ?? 0), 0);
  const totalMonthly = selectedProducts.reduce((sum, p) => sum + productMonthlyPrice(p), 0);
  const productsCount = activeStack?.products.length ?? 0;
  const allSelected = productsCount > 0 && selectedIds.size === productsCount;

  const handleSelectAll = () => {
    if (!activeStack) return;
    setSelectedIds((prev) =>
      prev.size === activeStack.products.length
        ? new Set()
        : new Set(activeStack.products.map((p) => p.id)),
    );
  };

  // ---- Category grouping ----

  const groupedProducts = useMemo(() => {
    if (!activeStack) return [] as Array<[CategoryKey, DemoProduct[]]>;
    const groups = new Map<CategoryKey, DemoProduct[]>();
    for (const p of activeStack.products) {
      const cat = categorize(p);
      if (!groups.has(cat)) groups.set(cat, []);
      groups.get(cat)!.push(p);
    }
    return [...groups.entries()].sort((a, b) => CATEGORY_META[a[0]].order - CATEGORY_META[b[0]].order);
  }, [activeStack]);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const activeDescription = activeStack ? descriptions[activeStack.id] ?? '' : '';

  const rightSlot = isDemo ? (
    <>
      <span className="header-email">Demo-Modus — nicht angemeldet</span>
      <Link
        to="/register"
        className="btn-logout"
        style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center' }}
      >
        Registrieren
      </Link>
    </>
  ) : (
    <>
      <span className="header-email">{user?.email ?? ''}</span>
      <button className="btn-logout" onClick={handleLogout}>
        Abmelden
      </button>
    </>
  );

  return (
    <>
      <StacksHeader
        variant={HEADER_VARIANT}
        title={isDemo ? 'Demo – Supplement Stack' : 'Meine Supplement Stacks'}
        subtitle={
          isDemo
            ? 'Teste die komplette Oberfläche. Änderungen werden nach dem Neuladen zurückgesetzt.'
            : 'Verwalte deine Supplements dauerhaft mit derselben Oberfläche wie in der Demo.'
        }
        rightSlot={rightSlot}
      />

      <main className="ss-page">
        <div className={`info-banner${isDemo ? ' info-banner-demo' : ''}`}>
          <IconInfoCircle />
          <strong>{isDemo ? 'Interaktive Demo:' : 'Gespeicherte Verwaltung:'}</strong>
          &nbsp;
          <span>
            {isDemo
              ? 'Alles nutzbar — nach dem Neuladen startet wieder der Demo-Stack. Registriere dich, um Änderungen dauerhaft zu speichern.'
              : 'Diese Ansicht nutzt dieselbe Oberfläche wie die Demo und speichert Änderungen dauerhaft in deinem Account.'}
          </span>
        </div>

        {error && (
          <div
            style={{
              marginBottom: 20,
              padding: '10px 16px',
              borderRadius: 10,
              background: '#fef2f2',
              border: '1px solid #fecaca',
              color: '#b91c1c',
              fontSize: 13,
              fontWeight: 600,
            }}
          >
            {error}
          </div>
        )}

        <div className="ss-toolbar">
          <div className="stack-select-wrap">
            <select
              className="stack-select"
              value={state.activeStackId}
              onChange={(e) =>
                setState((prev) => ({ ...prev, activeStackId: e.target.value }))
              }
            >
              {state.stacks.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.products.length} Produkte)
                </option>
              ))}
            </select>
            <span className="stack-select-arrow">
              <IconChevron />
            </span>
          </div>

          <button className="ss-btn ss-btn-green" onClick={() => setAddModalOpen(true)}>
            <IconPlus />
            Produkt hinzufügen
          </button>

          <button className="ss-btn ss-btn-indigo" onClick={() => void handleCreateStack()}>
            <IconStackPlus />
            Stack erstellen
          </button>

          <button
            className="ss-btn ss-btn-outline"
            onClick={() => setEditModalOpen(true)}
            disabled={!activeStack}
          >
            <IconPencil />
            Stack bearbeiten
          </button>

          <button
            className="ss-btn ss-btn-outline"
            onClick={() =>
              isDemo
                ? demoRestrictedNotice()
                : window.alert('Stack-Mailversand folgt im nächsten Release.')
            }
          >
            <IconMail />
            Stack mailen
          </button>

          <button
            className="ss-btn ss-btn-red-soft"
            onClick={() => void handleDeleteStack(state.activeStackId)}
          >
            <IconTrash />
            Stack löschen
          </button>
        </div>

        {activeDescription && (
          <div
            style={{
              marginBottom: 20,
              padding: '10px 16px',
              background: '#f5f3ff',
              border: '1px solid #ddd6fe',
              borderRadius: 10,
              fontSize: 13,
              color: '#5b21b6',
              fontWeight: 500,
            }}
          >
            {activeDescription}
          </div>
        )}

        <div className="ss-section-title">
          <span>🚀</span>
          <span>Supplement Übersicht</span>
        </div>

        {loading && (
          <div style={{ padding: 40, textAlign: 'center' }}>
            <div
              className="animate-spin"
              style={{
                display: 'inline-block',
                width: 36,
                height: 36,
                border: '4px solid #c7d2fe',
                borderTopColor: '#6366f1',
                borderRadius: '50%',
              }}
            />
          </div>
        )}

        {!loading && productsCount === 0 && (
          <div
            style={{
              padding: '48px 24px',
              textAlign: 'center',
              borderRadius: 14,
              border: '2px dashed #e0e4f0',
              background: '#fff',
              color: '#6b7280',
            }}
          >
            <Package size={32} style={{ margin: '0 auto 10px', color: '#c7d2fe' }} />
            <p style={{ fontSize: 14, fontWeight: 600 }}>
              Noch leer — klicke auf „Produkt hinzufügen", um zu starten.
            </p>
          </div>
        )}

        {groupedProducts.map(([cat, items]) => {
          const meta = CATEGORY_META[cat];
          return (
            <div key={cat} className="category-group">
              <div className="category-header">
                <span className={`category-label ${meta.cls}`}>
                  <span>{CATEGORY_ICONS[cat]}</span>
                  <span>{meta.label}</span>
                </span>
              </div>
              <div className="masonry-grid">
                {items.map((p) => (
                  <div key={p.id} className="masonry-item">
                    <ProductCard
                      product={p}
                      shopDomains={shopDomains}
                      selected={selectedIds.has(p.id)}
                      onToggleSelected={() => toggleSelected(p.id)}
                      onDelete={() => void handleRemoveProduct(p.id)}
                      showWishlistButton={false}
                      showSelectButton={false}
                    />
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </main>

      {/* Bottom bar */}
      <div className="bottom-bar">
        <div>
          <div className="bb-title">Gewählte Supplements</div>
          <div className="bb-sub">
            {selectedIds.size} von {productsCount} ausgewählt
          </div>
        </div>
        <div className="bb-prices">
          <div className="bb-price-block">
            <div className="bb-price-label">Einmalkosten</div>
            <div className="bb-price-value">{formatEuro(totalOnce)} €</div>
          </div>
          <div className="bb-divider" />
          <div className="bb-price-block">
            <div className="bb-price-label">Pro Monat</div>
            <div className="bb-price-value">{formatEuro(totalMonthly)} €</div>
          </div>
          <button
            className="btn-select-all"
            onClick={handleSelectAll}
            disabled={productsCount === 0}
            style={productsCount === 0 ? { opacity: 0.5, cursor: 'not-allowed' } : undefined}
          >
            {allSelected ? 'Auswahl aufheben' : 'Alle auswählen'}
          </button>
        </div>
      </div>

      {addModalOpen && (
        <AddProductModal
          stacks={state.stacks}
          activeStackId={state.activeStackId}
          onAdd={handleAddProduct}
          onClose={() => setAddModalOpen(false)}
        />
      )}

      {editModalOpen && activeStack && (
        <EditStackModal
          initialName={activeStack.name}
          initialDescription={activeDescription}
          onSave={(n, d) => handleSaveStackMeta(n, d)}
          onClose={() => setEditModalOpen(false)}
        />
      )}
    </>
  );
}

export default StackWorkspace;
