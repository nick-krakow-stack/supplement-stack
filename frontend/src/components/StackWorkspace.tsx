import { useEffect, useState, useCallback, useMemo } from 'react';
import type { FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Calculator,
  Flag,
  Info,
  LayoutGrid,
  List,
  Package,
  Plus,
  Printer,
  Search,
  X,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { apiPath } from '../api/base';
import SearchBar from './SearchBar';
import ProductCard from './ProductCard';
import StacksHeader, { type StacksHeaderVariant } from './StacksHeader';
import EditStackModal from './EditStackModal';
import { getFamilyMembers } from '../api/family';
import { reportProductLink } from '../api/stacks';
import type { FamilyMember, ProductSafetyWarning } from '../types';
import type { DosageGuideline, Ingredient, ShopDomain } from '../types/local';
import { writeDemoStackSnapshot } from '../lib/stackFlow';
import {
  calculateProductUsage,
  intakeIntervalDays as calculateIntakeIntervalDays,
  productTotalServings as calculateTotalServings,
} from '../lib/stackCalculations';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface DemoProduct {
  id: number;
  product_type?: 'catalog' | 'user_product';
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
  basis_quantity?: number | null;
  basis_unit?: string | null;
  intake_interval_days?: number;
  unit?: string;
  form?: string;
  timing?: string;
  ingredient_timing?: string | null;
  ingredient_timing_note?: string | null;
  ingredient_intake_hint?: string | null;
  dosage_text?: string;
  ingredient_effect_summary?: string | null;
  effect_summary?: string;
  warning_title?: string;
  warning_message?: string;
  warning_type?: string;
  alternative_note?: string;
  warnings?: ProductSafetyWarning[];
  ingredient_category?: string;
  status?: 'pending' | 'approved' | 'rejected' | 'blocked';
  user_product_status?: 'pending' | 'approved' | 'rejected' | 'blocked';
  published_product_id?: number | null;
  ingredients?: Array<{
    ingredient_id: number;
    form_id?: number | null;
    quantity?: number | null;
    unit?: string | null;
    basis_quantity?: number | null;
    basis_unit?: string | null;
    search_relevant?: number | boolean;
    parent_ingredient_id?: number | null;
  }>;
}

export interface DemoStack {
  id: string;
  name: string;
  products: DemoProduct[];
  description?: string;
  family_member_id?: number | null;
  family_member_first_name?: string | null;
}

type IngredientFormOption = {
  id: number;
  name: string;
  comment?: string | null;
  timing?: string | null;
  score?: number | null;
};

interface DemoState {
  stacks: DemoStack[];
  activeStackId: string;
}

export interface StackWorkspaceProps {
  mode?: 'demo' | 'authenticated';
  standaloneHeader?: boolean;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const DEMO_NOTICE =
  'Diese Funktion ist nur in der kostenlosen Vollversion verfÃ¼gbar. Registriere dich, damit deine Ã„nderungen dauerhaft gespeichert werden.';
const DEMO_SHARE_NOTICE =
  'Stack mailen und Plan drucken/PDF sind kostenlos verfuegbar, sobald du dich registriert hast.';
const DESC_STORAGE_KEY = 'ss_stack_descriptions';

function newStackId(): string {
  return `stack_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

function createDefaultState(): DemoState {
  const id = newStackId();
  return { stacks: [{ id, name: 'Basis Gesundheit', products: [] }], activeStackId: id };
}

const JSON_HEADERS: Record<string, string> = {
  'Content-Type': 'application/json',
};

function credentialedFetch(input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> {
  return fetch(input, { credentials: 'include', ...init });
}

function demoRestrictedNotice() {
  window.alert(DEMO_NOTICE);
}

function mapStackDetail(
  stack: { id: number | string; name: string; family_member_id?: number | null; family_member_first_name?: string | null },
  detail?: Record<string, unknown>,
): DemoStack {
  const products = (detail?.products ?? detail?.items ?? []) as DemoProduct[];
  const stackDetail = detail?.stack as {
    name?: string;
    family_member_id?: number | null;
    family_member_first_name?: string | null;
  } | undefined;
  return {
    id: String(stack.id),
    name: stackDetail?.name ?? stack.name,
    products,
    family_member_id: stackDetail?.family_member_id ?? stack.family_member_id ?? null,
    family_member_first_name: stackDetail?.family_member_first_name ?? stack.family_member_first_name ?? null,
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

function productStackKey(product: Pick<DemoProduct, 'id' | 'product_type'>): string {
  return `${product.product_type ?? 'catalog'}:${product.id}`;
}

function productMatchesIngredient(product: DemoProduct, ingredientId: number): boolean {
  return product.ingredients?.some((row) => (
    row.ingredient_id === ingredientId || row.parent_ingredient_id === ingredientId
  )) ?? false;
}

interface ManualDose {
  value: number;
  unit: string;
}

function normalizeUnitToGerman(unit?: string): string {
  return (unit ?? '').replace(/\bIU\b/gi, 'IE').replace(/\biu\b/g, 'IE');
}

function unitLabel(unit?: string, amount?: number): string {
  const normalized = normalizeUnitToGerman(unit).trim();
  const singular = amount == null || Math.abs(amount - 1) < 0.001;
  switch (normalized.toLowerCase()) {
    case 'kapsel':
    case 'kapseln':
      return singular ? 'Kapsel' : 'Kapseln';
    case 'tablette':
    case 'tabletten':
      return singular ? 'Tablette' : 'Tabletten';
    case 'softgel':
    case 'softgels':
      return singular ? 'Softgel' : 'Softgels';
    case 'portion':
    case 'portionen':
      return singular ? 'Portion' : 'Portionen';
    default:
      return normalized;
  }
}

function primaryDose(guideline?: DosageGuideline): ManualDose | null {
  if (!guideline) return null;
  const value = guideline.dose_max ?? guideline.dose_min;
  if (value == null || !guideline.unit) return null;
  return { value, unit: normalizeUnitToGerman(guideline.unit) };
}

function formatContentAmount(value: number): string {
  const rounded = value >= 100 ? Math.round(value / 10) * 10 : Math.round(value);
  return rounded.toLocaleString('de-DE', { maximumFractionDigits: 0 });
}

function productContentLabel(product: DemoProduct, previewProduct: DemoProduct): string {
  const totalServings = calculateTotalServings(product, 0);
  const servingSize = typeof product.serving_size === 'number' && Number.isFinite(product.serving_size)
    ? product.serving_size
    : null;
  const unit = product.serving_unit?.trim();
  const usage = calculateProductUsage(previewProduct, previewProduct.price, { fallbackTotalServings: 30 });
  const daysLabel = usage.daysSupply ? ` (reicht fÃ¼r ${usage.daysSupply} Tage)` : '';

  if (totalServings > 0 && servingSize && unit) {
    const totalUnits = totalServings * servingSize;
    return `${formatContentAmount(totalUnits)} ${unitLabel(unit, totalUnits)}${daysLabel}`;
  }
  if (totalServings > 0) {
    return `${formatContentAmount(totalServings)} Einnahmen${daysLabel}`;
  }
  return `Inhalt unbekannt${daysLabel}`;
}

function productServingsFromDose(product: DemoProduct): number | null {
  const usage = calculateProductUsage(product, product.price, { fallbackTotalServings: 30 });
  return usage.calculationSource === 'target_dose' ? usage.servingsPerIntake : null;
}

function productServingsPerDay(product: DemoProduct): number {
  return calculateProductUsage(product, product.price, { fallbackTotalServings: 30 }).servingsPerIntake;
}

function productIntakeIntervalDays(product: DemoProduct): number {
  return calculateIntakeIntervalDays(product);
}

function formatIntakeInterval(days: number): string {
  return days === 1 ? 'tÃ¤glich' : `alle ${days} Tage`;
}

function productMonthlyPrice(product: DemoProduct): number {
  return calculateProductUsage(product, product.price, { fallbackTotalServings: 30 }).monthlyCost ?? product.price;
}

function formatEuro(value: number): string {
  return value.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function stackProfileLabel(stack: DemoStack | undefined): string {
  if (!stack?.family_member_id) return 'Mein Stack';
  return stack.family_member_first_name ? `FÃ¼r ${stack.family_member_first_name}` : 'Familienprofil';
}

function productDoseSignature(product: DemoProduct): string {
  const ingredientParts = (product.ingredients ?? [])
    .filter((ingredient) => ingredient.search_relevant === undefined || ingredient.search_relevant === true || ingredient.search_relevant === 1)
    .map((ingredient) => [
      ingredient.ingredient_id,
      ingredient.quantity ?? '',
      ingredient.unit ?? '',
      ingredient.basis_quantity ?? '',
      ingredient.basis_unit ?? '',
    ].join(':'))
    .sort()
    .join('|');
  return [
    product.form ?? '',
    product.serving_size ?? '',
    product.serving_unit ?? '',
    product.servings_per_container ?? '',
    product.container_count ?? '',
    ingredientParts,
  ].join('#').toLowerCase();
}

type ProductViewMode = 'grid' | 'list';

// ---------------------------------------------------------------------------
// AddProductModal
// ---------------------------------------------------------------------------

function AddProductModal({
  stacks,
  activeStackId,
  isDemo,
  onAdd,
  onClose,
  ignoredExistingProductKey,
  title = 'Produkt hinzufÃ¼gen',
  submitLabel = 'HinzufÃ¼gen',
  onEditExisting,
  onReplaceExisting,
}: {
  stacks: DemoStack[];
  activeStackId: string;
  isDemo: boolean;
  onAdd: (product: DemoProduct, stackId: string) => Promise<void>;
  onClose: () => void;
  title?: string;
  submitLabel?: string;
  ignoredExistingProductKey?: string;
  onEditExisting?: (productKey: string) => void;
  onReplaceExisting?: (productKey: string) => void;
}) {
  const [step, setStep] = useState<'search' | 'duplicate' | 'dosage' | 'products'>('search');
  const [ingredient, setIngredient] = useState<Ingredient | null>(null);
  const [forms, setForms] = useState<IngredientFormOption[]>([]);
  const [selectedFormId, setSelectedFormId] = useState<number | null>(null);
  const [ingredientLoading, setIngredientLoading] = useState(false);
  const [guidelines, setGuidelines] = useState<DosageGuideline[]>([]);
  const [guidelinesLoading, setGuidelinesLoading] = useState(false);
  const [dose, setDose] = useState<ManualDose>({ value: 0, unit: '' });
  const [targetStackId, setTargetStackId] = useState(activeStackId);
  const [products, setProducts] = useState<DemoProduct[]>([]);
  const [productsLoading, setProductsLoading] = useState(false);
  const [savingProductKey, setSavingProductKey] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [duplicateIngredientProduct, setDuplicateIngredientProduct] = useState<DemoProduct | null>(null);
  const [duplicateBypass, setDuplicateBypass] = useState<{ ingredientId: number; stackId: string } | null>(null);
  const [demoOwnProductNoticeOpen, setDemoOwnProductNoticeOpen] = useState(false);
  const targetStack = stacks.find((stack) => stack.id === targetStackId);
  const existingProductKeys = useMemo(
    () => new Set((targetStack?.products ?? []).map(productStackKey)),
    [targetStack],
  );

  const dgeGuideline = guidelines.find((gl) => gl.source === 'DGE' || gl.is_default) ?? guidelines[0];
  const studyGuideline =
    guidelines.find((gl) => gl.source === 'study') ??
    guidelines.find((gl) => gl.id !== dgeGuideline?.id);

  const selectedForm = useMemo(
    () => forms.find((form) => form.id === selectedFormId) ?? null,
    [forms, selectedFormId],
  );

  const findDuplicateForIngredient = useCallback(
    (selected: Ingredient, stackId = targetStackId): DemoProduct | null => {
      const stack = stacks.find((item) => item.id === stackId);
      return (stack?.products ?? []).find((product) => {
        const key = productStackKey(product);
        return key !== ignoredExistingProductKey && productMatchesIngredient(product, selected.id);
      }) ?? null;
    },
    [ignoredExistingProductKey, stacks, targetStackId],
  );

  const duplicateBypassApplies = useCallback(
    (selected: Ingredient, stackId = targetStackId) =>
      duplicateBypass?.ingredientId === selected.id && duplicateBypass.stackId === stackId,
    [duplicateBypass, targetStackId],
  );

  const loadDosageGuidelines = useCallback((selected: Ingredient) => {
    setGuidelines([]);
    setGuidelinesLoading(true);
    setStep('dosage');
    credentialedFetch(apiPath(`/ingredients/${selected.id}/dosage-guidelines`))
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
  }, []);

  const continueWithIngredient = (selected: Ingredient) => {
    setIngredient(selected);
    setError('');
    setDuplicateIngredientProduct(null);
    setGuidelines([]);
    setForms([]);
    setSelectedFormId(null);
    setIngredientLoading(true);

    credentialedFetch(apiPath(`/ingredients/${selected.id}`))
      .then((response) => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return response.json() as Promise<{ forms?: IngredientFormOption[] }>;
      })
      .then((data) => {
        const loadedForms = Array.isArray(data.forms)
          ? data.forms.filter((form) => Number.isInteger(form.id) && form.id > 0 && typeof form.name === 'string')
          : [];
        setForms(loadedForms);
        setSelectedFormId(null);
        loadDosageGuidelines(selected);
      })
      .catch(() => {
        setForms([]);
        setSelectedFormId(null);
        loadDosageGuidelines(selected);
      })
      .finally(() => setIngredientLoading(false));
  };

  const chooseIngredient = (selected: Ingredient) => {
    const duplicate = findDuplicateForIngredient(selected);
    if (duplicate && !duplicateBypassApplies(selected)) {
      setIngredient(selected);
      setError('');
      setDuplicateIngredientProduct(duplicate);
      setStep('duplicate');
      return;
    }
    continueWithIngredient(selected);
  };

  const handleTargetStackChange = (nextStackId: string) => {
    setTargetStackId(nextStackId);
    setError('');
    setDuplicateBypass(null);
    if (!ingredient) return;
    const duplicate = findDuplicateForIngredient(ingredient, nextStackId);
    if (duplicate) {
      setDuplicateIngredientProduct(duplicate);
      setStep('duplicate');
      return;
    }
    setDuplicateIngredientProduct(null);
    if (step === 'duplicate') {
      continueWithIngredient(ingredient);
    }
  };

  const loadProducts = (formId = selectedFormId) => {
    if (!ingredient) return;
    setStep('products');
    setProductsLoading(true);
    setError('');
    const productParams = new URLSearchParams();
    if (formId !== null) productParams.set('form_id', String(formId));
    const productQuery = productParams.toString();
    const catalogPromise = credentialedFetch(apiPath(`/ingredients/${ingredient.id}/products${productQuery ? `?${productQuery}` : ''}`))
      .then((response) => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return response.json() as Promise<{ products?: DemoProduct[] }>;
      });
    const userProductsPromise = !isDemo
      ? credentialedFetch(apiPath('/user-products'), { headers: JSON_HEADERS })
          .then((response) => (response.ok ? response.json() : { products: [] }))
          .catch(() => ({ products: [] }))
      : Promise.resolve({ products: [] });

    Promise.all([catalogPromise, userProductsPromise])
      .then(([catalogData, userData]) => {
        const catalogProducts = (catalogData.products ?? []).map((product) => ({
          ...product,
          product_type: 'catalog' as const,
        }));
        const catalogKeys = new Set(catalogProducts.map(productStackKey));
        const catalogIds = new Set(catalogProducts.map((product) => product.id));
        const ownProducts = ((userData.products ?? []) as DemoProduct[])
          .filter((product) => product.user_product_status !== 'rejected' && product.status !== 'rejected')
          .filter((product) => product.published_product_id == null || !catalogIds.has(product.published_product_id))
          .filter((product) => product.ingredients?.some((row) => (
            (row.ingredient_id === ingredient.id || row.parent_ingredient_id === ingredient.id) &&
            Boolean(row.search_relevant ?? 1) &&
            (formId === null || row.form_id === formId)
          )))
          .map((product) => {
            const matchingIngredient = product.ingredients?.find((row) => (
              (row.ingredient_id === ingredient.id || row.parent_ingredient_id === ingredient.id) &&
              (formId === null || row.form_id === formId)
            ));
            return {
              ...product,
              product_type: 'user_product' as const,
              quantity: product.quantity ?? matchingIngredient?.quantity ?? undefined,
              unit: product.unit ?? matchingIngredient?.unit ?? undefined,
              user_product_status: product.user_product_status ?? product.status,
            };
          })
          .filter((product) => !catalogKeys.has(productStackKey(product)));

        setProducts([...ownProducts, ...catalogProducts]);
      })
      .catch(() => setError('Produkte konnten nicht geladen werden.'))
      .finally(() => setProductsLoading(false));
  };

  const handleContinueFromDosage = () => {
    if (!ingredient) return;
    const duplicate = findDuplicateForIngredient(ingredient);
    if (duplicate && !duplicateBypassApplies(ingredient)) {
      setDuplicateIngredientProduct(duplicate);
      setStep('duplicate');
      return;
    }
    loadProducts();
  };

  const addProduct = async (product: DemoProduct) => {
    const key = productStackKey(product);
    if (existingProductKeys.has(key) && key !== ignoredExistingProductKey) {
      setError('Produkt ist bereits in diesem Stack.');
      return;
    }
    const targetDosageText = dose.value > 0 && dose.unit
      ? `${dose.value} ${dose.unit} tÃ¤glich`
      : product.dosage_text || '1 Portion tÃ¤glich';
    const enhanced: DemoProduct = {
      ...product,
      dosage_text: targetDosageText,
      timing: product.ingredient_timing || product.timing || 'Zum FrÃ¼hstÃ¼ck',
      intake_interval_days: product.intake_interval_days ?? 1,
    };
    enhanced.quantity = productServingsPerDay(enhanced);
    setSavingProductKey(key);
    setError('');
    try {
      await onAdd(enhanced, targetStackId);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Produkt konnte nicht gespeichert werden.');
    } finally {
      setSavingProductKey(null);
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
              {title}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="rounded-2xl p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
            aria-label="SchlieÃŸen"
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
            <label className="mb-2 block text-base font-black text-slate-700">Ziel-Stack</label>
            <select
              value={targetStackId}
              onChange={(event) => handleTargetStackChange(event.target.value)}
              className="mb-5 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-lg font-semibold text-slate-950 shadow-sm focus:border-blue-400 focus:outline-none focus:ring-4 focus:ring-blue-100"
            >
              {stacks.map((stack) => (
                <option key={stack.id} value={stack.id}>{stack.name}</option>
              ))}
            </select>
            <p className="mb-3 text-base font-black text-slate-700">Nach Wirkstoff suchen</p>
            <SearchBar onSelect={chooseIngredient} placeholder="z.B. D3, Cobalamin, Magnesium..." autoFocus />
            <p className="mt-3 text-sm font-semibold text-slate-500">
              Beginnen Sie zu tippen, um Wirkstoffe zu finden.
            </p>
            {ingredientLoading && (
              <p className="mt-3 text-sm font-bold text-blue-700">Wirkstoffdaten werden geladen...</p>
            )}
          </div>
        )}

        {step === 'duplicate' && ingredient && duplicateIngredientProduct && (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 sm:p-5">
            <div className="mb-4 flex items-start gap-3 text-amber-800">
              <AlertTriangle size={24} className="mt-1 shrink-0" />
              <div>
                <h3 className="text-xl font-black sm:text-2xl">
                  Dieser Wirkstoff ist bereits in deinem Stack vorhanden
                </h3>
                <p className="mt-2 text-sm font-semibold text-amber-900">
                  {ingredient.name} ist schon ueber dieses Produkt abgedeckt:
                </p>
              </div>
            </div>
            <div className="rounded-2xl border border-amber-100 bg-white p-4">
              <p className="text-lg font-black text-slate-950">{duplicateIngredientProduct.name}</p>
              {duplicateIngredientProduct.brand && (
                <p className="mt-1 text-sm font-semibold text-slate-500">{duplicateIngredientProduct.brand}</p>
              )}
              <p className="mt-3 text-sm font-semibold text-slate-700">
                {duplicateIngredientProduct.dosage_text || 'Dosierung noch nicht gesetzt'}
              </p>
            </div>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <button
                type="button"
                className="rounded-xl bg-blue-600 px-4 py-3 text-sm font-black text-white hover:bg-blue-700"
                onClick={() => {
                  onEditExisting?.(productStackKey(duplicateIngredientProduct));
                  onClose();
                }}
              >
                Wirkstoffmenge bearbeiten
              </button>
              <button
                type="button"
                className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-black text-slate-700 hover:bg-slate-50"
                onClick={() => {
                  onReplaceExisting?.(productStackKey(duplicateIngredientProduct));
                  onClose();
                }}
              >
                Produkt aendern
              </button>
              <button
                type="button"
                className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-black text-slate-700 hover:bg-slate-50"
                onClick={onClose}
              >
                So lassen
              </button>
              <button
                type="button"
                className="rounded-xl border border-amber-300 bg-amber-100 px-4 py-3 text-sm font-black text-amber-800 hover:bg-amber-200"
                onClick={() => {
                  setDuplicateBypass({ ingredientId: ingredient.id, stackId: targetStackId });
                  continueWithIngredient(ingredient);
                }}
              >
                Trotzdem weiteres Produkt hinzufuegen
              </button>
            </div>
          </div>
        )}

        {step === 'dosage' && ingredient && (
          <>
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50/50 p-4 sm:p-5">
              <div className="mb-4 flex items-center gap-3 text-emerald-800">
                <Calculator size={24} />
                <h3 className="text-xl font-black sm:text-2xl">
                  Dosierung fÃ¼r {ingredient.name} festlegen
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
                      <p className="text-base font-black text-blue-700">DGE-Referenzwert</p>
                      <p className="mt-2 text-2xl font-black text-blue-600">
                        {primaryDose(dgeGuideline)!.value}
                        {primaryDose(dgeGuideline)!.unit}
                      </p>
                      <span className="mt-4 flex justify-center rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-black text-white">
                        Referenzwert Ã¼bernehmen
                      </span>
                    </button>
                  ) : (
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-left cursor-default">
                      <p className="text-base font-black text-slate-500">DGE-Referenzwert</p>
                      <p className="mt-2 text-sm font-semibold text-slate-400">
                        Kein offizieller Referenzwert verfÃ¼gbar
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
                      <p className="text-base font-black text-violet-700">Studienbasierter Richtwert</p>
                      <p className="mt-2 text-2xl font-black text-violet-600">
                        {primaryDose(studyGuideline)!.value}
                        {primaryDose(studyGuideline)!.unit}
                      </p>
                      <span className="mt-4 flex justify-center rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-black text-white">
                        Richtwert aus Studienquelle
                      </span>
                    </button>
                  ) : (
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-left cursor-default">
                      <p className="text-base font-black text-slate-500">Studienbasierter Richtwert</p>
                      <p className="mt-2 text-sm font-semibold text-slate-400">
                        Keine Studiendaten hinterlegt
                      </p>
                    </div>
                  )}
                </div>
              )}

              <label className="mt-5 block text-base font-black text-slate-700">
                Geplante Tagesmenge ({dose.unit || normalizeUnitToGerman(ingredient.unit) || 'Einheit'})
              </label>
              <input
                type="text"
                inputMode="decimal"
                value={dose.value ? String(dose.value).replace('.', ',') : ''}
                onChange={(event) => {
                  const normalized = event.target.value.replace(',', '.');
                  const parsed = Number(normalized);
                  setDose((prev) => ({ ...prev, value: Number.isFinite(parsed) ? parsed : 0 }));
                }}
                className="mt-3 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-xl font-semibold text-slate-950 shadow-sm focus:border-blue-400 focus:outline-none focus:ring-4 focus:ring-blue-100"
              />
              <p className="mt-2 text-sm font-semibold text-slate-500">
                Geben Sie die Menge ein, mit der gerechnet werden soll.
              </p>

              {dosePercent != null && (
                <div className="mt-5 flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-amber-800">
                  <AlertTriangle size={24} className="mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="font-black">Im Bereich des DGE-Referenzwerts</p>
                    <p className="mt-1 text-sm font-semibold">
                      Diese Menge entspricht {dosePercent}% des DGE-Referenzwerts.
                    </p>
                  </div>
                </div>
              )}

              <label className="mt-5 block text-base font-black text-slate-700">Stack auswÃ¤hlen</label>
              <select
                value={targetStackId}
                onChange={(event) => handleTargetStackChange(event.target.value)}
                className="mt-3 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-lg font-semibold text-slate-950 shadow-sm focus:border-blue-400 focus:outline-none focus:ring-4 focus:ring-blue-100"
              >
                {stacks.map((stack) => (
                  <option key={stack.id} value={stack.id}>{stack.name}</option>
                ))}
              </select>
              <p className="mt-2 text-sm font-semibold text-slate-500">
                Produkt wird diesem Stack hinzugefÃ¼gt.
              </p>
            </div>

            <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <button
                onClick={() => setStep('search')}
                className="inline-flex items-center gap-2 rounded-xl px-2 py-2 text-base font-semibold text-blue-600 hover:text-blue-800"
              >
                <ArrowLeft size={20} />
                Zuruck zur Suche
              </button>
              <button
                onClick={() => handleContinueFromDosage()}
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
            <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h3 className="text-2xl font-black tracking-tight text-slate-950">Produkt auswÃ¤hlen</h3>
                <p className="mt-1 text-base font-semibold text-slate-500">
                  {ingredient.name} Â· {dose.value || 1} {dose.unit || normalizeUnitToGerman(ingredient.unit)}
                  {selectedForm ? ` Â· ${selectedForm.name}` : ''}
                </p>
              </div>
              {isDemo ? (
                <button
                  type="button"
                  className="inline-flex items-center justify-center rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-black text-emerald-700 hover:bg-emerald-100"
                  onClick={() => setDemoOwnProductNoticeOpen(true)}
                >
                  Eigenes Produkt hinzufuegen
                </button>
              ) : (
                <Link
                  to="/my-products"
                  className="inline-flex items-center justify-center rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-black text-emerald-700 hover:bg-emerald-100"
                >
                  Eigenes Produkt hinzufuegen
                </Link>
              )}
            </div>
            {forms.length > 0 && (
              <div className="mb-5 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <label className="block text-sm font-black text-slate-700" htmlFor="product-form-filter">
                  Form
                </label>
                <select
                  id="product-form-filter"
                  value={selectedFormId === null ? '' : String(selectedFormId)}
                  onChange={(event) => {
                    const nextFormId = event.target.value ? Number(event.target.value) : null;
                    setSelectedFormId(nextFormId);
                    loadProducts(nextFormId);
                  }}
                  className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-base font-semibold text-slate-950 shadow-sm focus:border-blue-400 focus:outline-none focus:ring-4 focus:ring-blue-100"
                >
                  <option value="">Alle Formen</option>
                  {forms.map((form) => (
                    <option key={form.id} value={form.id}>
                      {form.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
            <div className="border-y border-slate-200 py-5">
              {productsLoading && (
                <div className="flex justify-center py-12">
                  <div className="h-10 w-10 animate-spin rounded-full border-4 border-blue-500 border-t-transparent" />
                </div>
              )}
              {error && <p className="rounded-2xl bg-red-50 px-4 py-3 text-sm font-bold text-red-700">{error}</p>}
              {!productsLoading && products.length === 0 && !error && (
                <p className="py-10 text-center text-sm font-semibold text-slate-500">
                  Keine Produkte fÃ¼r diesen Wirkstoff gefunden.
                </p>
              )}
              <div className="grid gap-4">
                {products.map((product) => {
                  const key = productStackKey(product);
                  const alreadyInTargetStack = existingProductKeys.has(key) && key !== ignoredExistingProductKey;
                  const previewProduct: DemoProduct = {
                    ...product,
                    dosage_text: dose.value > 0 && dose.unit
                      ? `${dose.value} ${dose.unit} tÃ¤glich`
                      : product.dosage_text,
                  };
                  return (
                  <div key={key} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <h4 className="text-xl font-black text-slate-950">{product.name}</h4>
                          {product.product_type === 'user_product' && (
                            <span className="rounded-full bg-violet-100 px-2.5 py-1 text-xs font-black text-violet-700">
                              Eigenes Produkt
                            </span>
                          )}
                        </div>
                        {product.brand && (
                          <p className="mt-1 text-base font-semibold text-slate-500">{product.brand}</p>
                        )}
                        {product.form && (
                          <p className="mt-2 text-sm font-semibold text-slate-400">{product.form}</p>
                        )}
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="text-xl font-black text-emerald-600">
                          â‚¬{formatEuro(productMonthlyPrice(previewProduct))}
                        </p>
                        <p className="text-xs font-semibold text-slate-500">pro Monat</p>
                      </div>
                    </div>
                    <div className="mt-4 grid grid-cols-2 gap-3 rounded-2xl bg-slate-50 p-4">
                      <div>
                        <p className="text-sm font-semibold text-slate-500">Dosierung:</p>
                        <p className="mt-1 text-base font-black text-slate-950">
                          {previewProduct.dosage_text || `${dose.value || 1} ${dose.unit || 'Portion'}`}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-slate-500">Inhalt:</p>
                        <p className="mt-1 text-base font-black text-slate-950">
                          {productContentLabel(product, previewProduct)}
                        </p>
                      </div>
                    </div>
                    <div className="mt-3 grid grid-cols-2 gap-3">
                      <div className="rounded-2xl border border-slate-100 bg-white px-4 py-3">
                        <p className="text-xs font-semibold text-slate-500">Einmalpreis</p>
                        <p className="mt-1 text-lg font-black text-slate-950">â‚¬{formatEuro(product.price)}</p>
                      </div>
                      <div className="rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-3">
                        <p className="text-xs font-semibold text-emerald-700">Pro Monat</p>
                        <p className="mt-1 text-lg font-black text-emerald-700">
                          â‚¬{formatEuro(productMonthlyPrice(previewProduct))}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => void addProduct(product)}
                      disabled={savingProductKey === key || alreadyInTargetStack}
                      className="mt-4 inline-flex w-full items-center justify-center gap-3 rounded-xl bg-blue-600 px-5 py-3 text-base font-black text-white shadow-lg shadow-blue-600/20 hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <Plus size={22} />
                      {alreadyInTargetStack ? 'Bereits im Stack' : savingProductKey === key ? 'Speichert...' : submitLabel}
                    </button>
                  </div>
                  );
                })}
              </div>
            </div>
            <div className="mt-6 flex items-center justify-between gap-4">
              <button
                onClick={() => setStep('dosage')}
                className="inline-flex items-center gap-2 rounded-xl px-2 py-3 text-lg font-semibold text-blue-600 hover:text-blue-800"
              >
                <ArrowLeft size={20} />
                ZurÃ¼ck zur Dosierung
              </button>
              {isDemo && (
                <p className="hidden items-center gap-2 text-sm font-semibold text-slate-500 sm:flex">
                  <Info size={18} />
                  Demo-Modus: Ã„nderungen werden nach Neuladen zurÃ¼ckgesetzt.
                </p>
              )}
            </div>
          </>
        )}

        {demoOwnProductNoticeOpen && (
          <div
            className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/40 px-4"
            onClick={(event) => {
              if (event.target === event.currentTarget) setDemoOwnProductNoticeOpen(false);
            }}
          >
            <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl">
              <h3 className="text-xl font-black text-slate-950">Produkt zur Datenbank hinzufuegen</h3>
              <p className="mt-3 text-sm font-semibold leading-relaxed text-slate-600">
                Danke, dass du ein neues Produkt zu unserer Datenbank hinzufuegen moechtest.
                Diese Funktion steht dir kostenlos zur Verfuegung, sobald du dich als Nutzer angemeldet hast.
              </p>
              <div className="mt-5 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-black text-slate-600 hover:bg-slate-50"
                  onClick={() => setDemoOwnProductNoticeOpen(false)}
                >
                  Abbrechen
                </button>
                <Link
                  to="/register?redirect=/stacks"
                  className="inline-flex justify-center rounded-xl bg-emerald-600 px-4 py-3 text-sm font-black text-white hover:bg-emerald-700"
                >
                  Jetzt anmelden
                </Link>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function EditProductModal({
  product,
  onSave,
  onReplace,
  onClose,
}: {
  product: DemoProduct;
  onSave: (patch: Pick<DemoProduct, 'quantity' | 'dosage_text' | 'timing' | 'intake_interval_days'>) => Promise<void>;
  onReplace: () => void;
  onClose: () => void;
}) {
  const [dosageText, setDosageText] = useState(product.dosage_text ?? '');
  const [timing, setTiming] = useState(product.timing ?? '');
  const [quantity, setQuantity] = useState(String(productServingsPerDay(product)));
  const [interval, setInterval] = useState(String(productIntakeIntervalDays(product)));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const intervalNumber = Number(interval);
  const intervalLabel = Number.isInteger(intervalNumber) && intervalNumber >= 1
    ? formatIntakeInterval(intervalNumber)
    : '';

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const parsedQuantity = Number(quantity);
    const parsedInterval = Number(interval);
    if (!Number.isFinite(parsedQuantity) || parsedQuantity <= 0) {
      setError('Portionen pro Einnahmetag mÃ¼ssen grÃ¶ÃŸer als 0 sein.');
      return;
    }
    if (!Number.isInteger(parsedInterval) || parsedInterval < 1) {
      setError('Das Einnahmeintervall muss mindestens 1 Tag betragen.');
      return;
    }

    setSaving(true);
    setError('');
    try {
      await onSave({
        quantity: parsedQuantity,
        dosage_text: dosageText.trim() || undefined,
        timing: timing.trim() || undefined,
        intake_interval_days: parsedInterval,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Produkt konnte nicht gespeichert werden.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-950/55 px-3 py-6 backdrop-blur-sm sm:px-6"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <form
        onSubmit={(event) => void submit(event)}
        className="w-full max-w-lg rounded-[1.6rem] bg-white p-5 shadow-[0_30px_80px_rgba(15,23,42,0.35)] sm:p-6"
      >
        <div className="mb-5 flex items-start justify-between gap-4">
          <div className="flex min-w-0 items-start gap-3">
            <span className="mt-1 text-indigo-600"><IconPencil /></span>
            <div className="min-w-0">
              <h2 className="text-2xl font-black tracking-tight text-slate-950">Produkt bearbeiten</h2>
              <p className="mt-1 truncate text-sm font-semibold text-slate-500">{product.name}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-2xl p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
            aria-label="SchlieÃŸen"
          >
            <X size={24} />
          </button>
        </div>

        {error && <p className="mb-4 rounded-2xl bg-red-50 px-4 py-3 text-sm font-bold text-red-700">{error}</p>}

        <div className="space-y-4">
          <label className="block">
            <span className="text-sm font-black text-slate-700">Dosierung</span>
            <input
              value={dosageText}
              onChange={(event) => setDosageText(event.target.value)}
              placeholder="z.B. 2000 IE tÃ¤glich"
              className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-base font-semibold text-slate-950 shadow-sm focus:border-blue-400 focus:outline-none focus:ring-4 focus:ring-blue-100"
            />
          </label>

          <label className="block">
            <span className="text-sm font-black text-slate-700">Fallback: manuelle Einnahmemenge</span>
            <input
              type="number"
              min={0.1}
              step={0.1}
              value={quantity}
              onChange={(event) => setQuantity(event.target.value)}
              className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-base font-semibold text-slate-950 shadow-sm focus:border-blue-400 focus:outline-none focus:ring-4 focus:ring-blue-100"
            />
            <span className="mt-2 block text-xs font-semibold text-slate-500">
              Wird nur genutzt, wenn die Dosierung nicht aus Wirkstoffmenge und Produktdaten ableitbar ist.
            </span>
          </label>

          <label className="block">
            <span className="text-sm font-black text-slate-700">Timing</span>
            <input
              value={timing}
              onChange={(event) => setTiming(event.target.value)}
              placeholder="z.B. Zum FrÃ¼hstÃ¼ck"
              className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-base font-semibold text-slate-950 shadow-sm focus:border-blue-400 focus:outline-none focus:ring-4 focus:ring-blue-100"
            />
          </label>

          <label className="block">
            <span className="text-sm font-black text-slate-700">Einnahmeintervall in Tagen</span>
            <input
              type="number"
              min={1}
              step={1}
              value={interval}
              onChange={(event) => setInterval(event.target.value)}
              className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-base font-semibold text-slate-950 shadow-sm focus:border-blue-400 focus:outline-none focus:ring-4 focus:ring-blue-100"
            />
            {intervalLabel && (
              <span className="mt-2 inline-flex rounded-full bg-indigo-50 px-3 py-1 text-xs font-black text-indigo-700">
                {intervalLabel}
              </span>
            )}
          </label>
        </div>

        <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-slate-200 bg-white px-5 py-3 text-sm font-black text-slate-600 hover:bg-slate-50"
          >
            Abbrechen
          </button>
          <button
            type="button"
            onClick={onReplace}
            className="rounded-xl border border-amber-200 bg-amber-50 px-5 py-3 text-sm font-black text-amber-700 hover:bg-amber-100"
          >
            Produkt wechseln
          </button>
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-3 text-sm font-black text-white shadow-lg shadow-blue-600/20 hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <IconPencil />
            {saving ? 'Speichert...' : 'Ã„nderungen speichern'}
          </button>
        </div>
      </form>
    </div>
  );
}

function ConfirmDialog({
  title,
  message,
  confirmLabel,
  onConfirm,
  onClose,
}: {
  title: string;
  message: string;
  confirmLabel: string;
  onConfirm: () => void | Promise<void>;
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-950/55 px-3 py-6 backdrop-blur-sm sm:px-6"
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <div className="w-full max-w-md rounded-[1.6rem] bg-white p-5 shadow-[0_30px_80px_rgba(15,23,42,0.35)] sm:p-6">
        <div className="mb-5 flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <span className="mt-1 text-red-600">
              <AlertTriangle size={24} />
            </span>
            <div>
              <h2 className="text-2xl font-black tracking-tight text-slate-950">{title}</h2>
              <p className="mt-2 text-sm font-semibold text-slate-600">{message}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-2xl p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
            aria-label="Schliessen"
          >
            <X size={22} />
          </button>
        </div>
        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-slate-200 bg-white px-5 py-3 text-sm font-black text-slate-600 hover:bg-slate-50"
          >
            Abbrechen
          </button>
          <button
            type="button"
            onClick={() => void onConfirm()}
            className="rounded-xl bg-red-600 px-5 py-3 text-sm font-black text-white shadow-lg shadow-red-600/20 hover:bg-red-700"
          >
            {confirmLabel}
          </button>
        </div>
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
function IconPrint() {
  return <Printer size={14} />;
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
const STACK_PRODUCT_VIEW_KEY = 'supplement-stack-product-view';

function loadProductViewMode(): ProductViewMode {
  if (typeof window === 'undefined') return 'grid';
  return window.localStorage.getItem(STACK_PRODUCT_VIEW_KEY) === 'list' ? 'list' : 'grid';
}

export function StackWorkspace({
  mode = 'demo',
  standaloneHeader,
}: StackWorkspaceProps) {
  const [state, setState] = useState<DemoState>(createDefaultState);
  const [descriptions, setDescriptions] = useState<Record<string, string>>(() =>
    mode === 'authenticated' ? loadDescriptions() : {},
  );
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [createStackModalOpen, setCreateStackModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editingProductKey, setEditingProductKey] = useState<string | null>(null);
  const [replaceProductKey, setReplaceProductKey] = useState<string | null>(null);
  const [pendingDeleteProductKey, setPendingDeleteProductKey] = useState<string | null>(null);
  const [shopDomains, setShopDomains] = useState<ShopDomain[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(mode === 'authenticated');
  const [error, setError] = useState('');
  const [emailSending, setEmailSending] = useState(false);
  const [emailStatus, setEmailStatus] = useState('');
  const [demoShareNoticeOpen, setDemoShareNoticeOpen] = useState(false);
  const [familyMembers, setFamilyMembers] = useState<FamilyMember[]>([]);
  const [linkReportStatus, setLinkReportStatus] = useState('');
  const [productViewMode, setProductViewMode] = useState<ProductViewMode>(loadProductViewMode);
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const isDemo = mode === 'demo';
  const showStandaloneHeader = standaloneHeader ?? isDemo;

  useEffect(() => {
    window.localStorage.setItem(STACK_PRODUCT_VIEW_KEY, productViewMode);
  }, [productViewMode]);

  useEffect(() => {
    if (!isDemo) return;
    try {
      writeDemoStackSnapshot(window.localStorage, {
        activeStackId: state.activeStackId,
        stacks: state.stacks,
      });
    } catch {
      // Demo carryover is optional; storage failures must not block the demo.
    }
  }, [isDemo, state.activeStackId, state.stacks]);

  // Fetch shop domains
  useEffect(() => {
    credentialedFetch(apiPath('/shop-domains'))
      .then((r) => (r.ok ? r.json() : { shops: [] }))
      .then((data) => setShopDomains(data.shops ?? []))
      .catch(() => { /* ignore */ });
  }, []);

  const loadFamilyProfiles = useCallback(async () => {
    if (mode !== 'authenticated') return;
    try {
      const members = await getFamilyMembers();
      setFamilyMembers(members);
    } catch {
      setError('Familienprofile konnten nicht geladen werden.');
    }
  }, [mode]);

  const loadAuthenticatedStacks = useCallback(async () => {
    if (mode !== 'authenticated') return;
    setLoading(true);
    setError('');
    try {
      const res = await credentialedFetch(apiPath('/stacks'), { headers: JSON_HEADERS });
      if (!res.ok) throw new Error('Stacks konnten nicht geladen werden.');
      const data = await res.json();
      const stackList: Array<{
        id: number;
        name: string;
        family_member_id?: number | null;
        family_member_first_name?: string | null;
      }> = data.stacks ?? data ?? [];
      if (stackList.length === 0) {
        const createRes = await credentialedFetch(apiPath('/stacks'), {
          method: 'POST',
          headers: JSON_HEADERS,
          body: JSON.stringify({ name: 'Mein Stack', product_ids: [] }),
        });
        const createData = await createRes.json().catch(() => ({})) as Record<string, unknown>;
        if (!createRes.ok) {
          throw new Error(typeof createData.error === 'string' ? createData.error : 'Start-Stack konnte nicht erstellt werden.');
        }
        const createdStack = (createData.stack ?? createData) as {
          id: number | string;
          name: string;
          family_member_id?: number | null;
          family_member_first_name?: string | null;
        };
        setState({ stacks: [mapStackDetail(createdStack)], activeStackId: String(createdStack.id) });
        setSelectedIds(new Set());
        return;
      }
      const detailed = await Promise.all(
        stackList.map(async (stack) => {
          const detailRes = await credentialedFetch(apiPath(`/stacks/${stack.id}`), {
            headers: JSON_HEADERS,
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
      const selectedStack = detailed[0];
      setSelectedIds(new Set((selectedStack?.products ?? []).map(productStackKey)));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unbekannter Fehler.');
    } finally {
      setLoading(false);
    }
  }, [mode]);

  useEffect(() => {
    if (mode === 'authenticated') {
      void loadAuthenticatedStacks();
      void loadFamilyProfiles();
      return;
    }

    const fresh = createDefaultState();
    credentialedFetch(apiPath('/demo/products'))
      .then((res) => (res.ok ? res.json() : { products: [] }))
      .then((data) => {
        const products = ((data.products ?? []) as DemoProduct[]).slice(0, 6).map((product) => {
          const next = { ...product, intake_interval_days: product.intake_interval_days ?? 1 };
          return { ...next, quantity: productServingsPerDay(next) };
        });
        setState({
          stacks: [{ ...fresh.stacks[0], products }],
          activeStackId: fresh.activeStackId,
        });
        setSelectedIds(new Set(products.map(productStackKey)));
      })
      .catch(() => setState(fresh));
  }, [loadAuthenticatedStacks, loadFamilyProfiles, mode]);

  const activeStack = state.stacks.find((s) => s.id === state.activeStackId) ?? state.stacks[0];

  // Reset selection when active stack changes
  useEffect(() => {
    const stack = state.stacks.find((item) => item.id === state.activeStackId);
    setSelectedIds(new Set((stack?.products ?? []).map(productStackKey)));
  }, [state.activeStackId, state.stacks]);

  // Keep selection in sync if products change
  useEffect(() => {
    if (!activeStack) return;
    setSelectedIds((prev) => {
      const valid = new Set([...prev].filter((key) => activeStack.products.some((p) => productStackKey(p) === key)));
      if (valid.size === prev.size) return prev;
      return valid;
    });
  }, [activeStack]);

  const persistStackProducts = useCallback(
    async (stackId: string, products: DemoProduct[], name?: string, familyMemberId?: number | null) => {
      if (mode !== 'authenticated') return;
      const payload = {
        ...(name ? { name } : {}),
        ...(familyMemberId !== undefined ? { family_member_id: familyMemberId } : {}),
        product_ids: products.map((product) => ({
          id: product.id,
          product_type: product.product_type ?? 'catalog',
          quantity: productServingsPerDay(product),
          intake_interval_days: productIntakeIntervalDays(product),
          dosage_text: product.dosage_text,
          timing: product.timing,
        })),
      };
      const res = await credentialedFetch(apiPath(`/stacks/${stackId}`), {
        method: 'PUT',
        headers: JSON_HEADERS,
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? 'Stack konnte nicht gespeichert werden.');
    },
    [mode],
  );

  const handleReportMissingLink = useCallback(
    async (product: DemoProduct, reason: 'missing_link' | 'invalid_link') => {
      if (isDemo || !activeStack) {
        setLinkReportStatus('Danke. In der Vollversion wird die Meldung direkt an die Produktpflege gesendet.');
        return;
      }
      setLinkReportStatus('');
      try {
        await reportProductLink({
          product_id: product.id,
          product_type: product.product_type ?? 'catalog',
          stack_id: activeStack.id,
          reason,
        });
        setLinkReportStatus('Danke, der fehlende Link wurde gemeldet.');
      } catch (err) {
        setLinkReportStatus(err instanceof Error ? err.message : 'Link konnte nicht gemeldet werden.');
      }
    },
    [activeStack, isDemo],
  );

  // ---- Stack management ----

  const handleCreateStack = useCallback(async (name: string, description: string, familyMemberId: number | null) => {
    const id = newStackId();
    const finalName = name.trim() || `Stack ${state.stacks.length + 1}`;
    const selectedMember = familyMembers.find((member) => member.id === familyMemberId);
    if (mode === 'authenticated') {
      try {
        const res = await credentialedFetch(apiPath('/stacks'), {
          method: 'POST',
          headers: JSON_HEADERS,
          body: JSON.stringify({ name: finalName, family_member_id: familyMemberId, product_ids: [] }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error ?? 'Stack konnte nicht erstellt werden.');
        const created = data.stack ?? data;
        const createdStack = {
          ...mapStackDetail(created),
          name: finalName,
          family_member_id: familyMemberId,
          family_member_first_name: selectedMember?.first_name ?? null,
        };
        setState((prev) => ({
          stacks: [...prev.stacks, createdStack],
          activeStackId: createdStack.id,
        }));
        if (description) saveDescription(createdStack.id, description);
        setDescriptions((prev) => (description ? { ...prev, [createdStack.id]: description } : prev));
        setCreateStackModalOpen(false);
        return;
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Stack konnte nicht erstellt werden.');
        throw err instanceof Error ? err : new Error('Stack konnte nicht erstellt werden.');
      }
    }
    setState((prev) => ({
      stacks: [...prev.stacks, {
        id,
        name: finalName,
        products: [],
        family_member_id: familyMemberId,
        family_member_first_name: selectedMember?.first_name ?? null,
      }],
      activeStackId: id,
    }));
    setDescriptions((prev) => (description ? { ...prev, [id]: description } : prev));
    setCreateStackModalOpen(false);
  }, [familyMembers, mode, state.stacks.length]);

  const handleDeleteStack = useCallback(
    async (id: string) => {
      if (state.stacks.length <= 1) {
        if (isDemo) demoRestrictedNotice();
        else setError('Der letzte Stack kann nicht gelÃ¶scht werden.');
        return;
      }
      const stack = state.stacks.find((s) => s.id === id);
      if (!stack) return;
      if (!window.confirm(`Stack "${stack.name}" wirklich lÃ¶schen?`)) return;
      if (mode === 'authenticated') {
        try {
          const res = await credentialedFetch(apiPath(`/stacks/${id}`), {
            method: 'DELETE',
            headers: JSON_HEADERS,
          });
          if (!res.ok) throw new Error('Stack konnte nicht gelÃ¶scht werden.');
        } catch (err) {
          setError(err instanceof Error ? err.message : 'Stack konnte nicht gelÃ¶scht werden.');
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
        if (mode === 'authenticated') saveDescription(id, '');
        return next;
      });
    },
    [isDemo, mode, state.stacks],
  );

  const handleSaveStackMeta = useCallback(
    async (newName: string, newDescription: string, familyMemberId: number | null) => {
      if (!activeStack) return;
      const prevName = activeStack.name;
      const prevFamilyMemberId = activeStack.family_member_id ?? null;
      const familyChanged = familyMemberId !== prevFamilyMemberId;
      if (mode === 'authenticated' && (newName !== prevName || familyChanged)) {
        await persistStackProducts(activeStack.id, activeStack.products, newName, familyMemberId);
      }
      const selectedMember = familyMembers.find((member) => member.id === familyMemberId);
      setState((prev) => ({
        ...prev,
        stacks: prev.stacks.map((s) => (
          s.id === activeStack.id
            ? {
                ...s,
                name: newName,
                family_member_id: familyMemberId,
                family_member_first_name: selectedMember?.first_name ?? null,
              }
            : s
        )),
      }));
      setDescriptions((prev) => {
        const next = { ...prev };
        if (newDescription) next[activeStack.id] = newDescription;
        else delete next[activeStack.id];
        if (mode === 'authenticated') saveDescription(activeStack.id, newDescription);
        return next;
      });
      setEditModalOpen(false);
    },
    [activeStack, familyMembers, mode, persistStackProducts],
  );

  // ---- Product management ----

  const handleAddProduct = useCallback(
    async (product: DemoProduct, stackId?: string) => {
      const targetStackId = stackId ?? state.activeStackId;
      const targetStack = state.stacks.find((s) => s.id === targetStackId);
      if (!targetStack) throw new Error('Stack konnte nicht gefunden werden.');
      if (targetStack.products.some((p) => productStackKey(p) === productStackKey(product))) {
        throw new Error('Produkt ist bereits in diesem Stack.');
      }
      const nextProducts = [...targetStack.products, product];
      if (mode === 'authenticated') {
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
      setSelectedIds((prev) => {
        const next = new Set(prev);
        next.add(productStackKey(product));
        return next;
      });
    },
    [loadAuthenticatedStacks, mode, persistStackProducts, state.activeStackId, state.stacks],
  );

  const handleRemoveProduct = useCallback(
    async (productKey: string) => {
      if (!activeStack) return;
      const nextProducts = activeStack.products.filter((p) => productStackKey(p) !== productKey);
      if (mode === 'authenticated') {
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
    [activeStack, loadAuthenticatedStacks, mode, persistStackProducts],
  );

  const handleSaveProduct = useCallback(
    async (productKey: string, productPatch: Pick<DemoProduct, 'quantity' | 'dosage_text' | 'timing' | 'intake_interval_days'>) => {
      if (!activeStack) return;
      const nextProducts = activeStack.products.map((product) =>
        productStackKey(product) === productKey ? { ...product, ...productPatch } : product,
      );
      if (mode === 'authenticated') {
        try {
          await persistStackProducts(activeStack.id, nextProducts);
        } catch (err) {
          setError(err instanceof Error ? err.message : 'Produkt konnte nicht gespeichert werden.');
          void loadAuthenticatedStacks();
          return;
        }
      }
      setState((prev) => ({
        ...prev,
        stacks: prev.stacks.map((stack) =>
          stack.id === prev.activeStackId ? { ...stack, products: nextProducts } : stack,
        ),
      }));
      setEditingProductKey(null);
    },
    [activeStack, loadAuthenticatedStacks, mode, persistStackProducts],
  );

  const handleReplaceProduct = useCallback(
    async (replacement: DemoProduct, stackId?: string) => {
      if (!replaceProductKey) throw new Error('Zu ersetzendes Produkt wurde nicht gefunden.');
      const targetStackId = stackId ?? state.activeStackId;
      const targetStack = state.stacks.find((stack) => stack.id === targetStackId);
      if (!targetStack) throw new Error('Stack konnte nicht gefunden werden.');
      const previousProduct = targetStack.products.find((product) => productStackKey(product) === replaceProductKey);
      if (!previousProduct) throw new Error('Zu ersetzendes Produkt wurde nicht gefunden.');

      const replacementKey = productStackKey(replacement);
      const duplicate = targetStack.products.some((product) => (
        productStackKey(product) !== replaceProductKey && productStackKey(product) === replacementKey
      ));
      if (duplicate) throw new Error('Produkt ist bereits in diesem Stack.');

      const preservedDosage = previousProduct.dosage_text ?? replacement.dosage_text;
      const preservedTiming = previousProduct.timing ?? replacement.timing;
      const preservedInterval = productIntakeIntervalDays(previousProduct);
      const preservesOldDosageOnDifferentProduct = Boolean(previousProduct.dosage_text)
        && productDoseSignature(previousProduct) !== productDoseSignature(replacement);
      if (preservesOldDosageOnDifferentProduct) {
        const confirmed = window.confirm(
          'Die bisherige Dosierung wird fÃ¼r das neue Produkt Ã¼bernommen. Produktform oder StÃ¤rke kÃ¶nnen abweichen. Bitte prÃ¼fe die Dosierung nach dem Ersetzen. Trotzdem ersetzen?'
        );
        if (!confirmed) return;
      }
      const candidate: DemoProduct = {
        ...replacement,
        dosage_text: preservedDosage,
        timing: preservedTiming,
        intake_interval_days: preservedInterval,
      };
      const quantityFromDose = productServingsFromDose(candidate);
      candidate.quantity = quantityFromDose ?? previousProduct.quantity ?? productServingsPerDay(candidate);

      const nextProducts = targetStack.products.map((product) =>
        productStackKey(product) === replaceProductKey ? candidate : product,
      );
      if (mode === 'authenticated') {
        try {
          await persistStackProducts(targetStackId, nextProducts);
        } catch (err) {
          setError(err instanceof Error ? err.message : 'Produkt konnte nicht ersetzt werden.');
          void loadAuthenticatedStacks();
          throw err;
        }
      }

      setState((prev) => ({
        ...prev,
        stacks: prev.stacks.map((stack) =>
          stack.id === targetStackId ? { ...stack, products: nextProducts } : stack,
        ),
      }));
      setSelectedIds((prev) => {
        if (!prev.has(replaceProductKey)) return prev;
        const next = new Set(prev);
        next.delete(replaceProductKey);
        next.add(productStackKey(candidate));
        return next;
      });
      setReplaceProductKey(null);
      setEditingProductKey(null);
    },
    [loadAuthenticatedStacks, mode, persistStackProducts, replaceProductKey, state.activeStackId, state.stacks],
  );

  // ---- Selection / totals ----

  const toggleSelected = (key: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const selectedProducts = useMemo(
    () => (activeStack?.products.filter((p) => selectedIds.has(productStackKey(p))) ?? []),
    [activeStack, selectedIds],
  );
  const activeProducts = useMemo(() => activeStack?.products ?? [], [activeStack]);
  const totalOnce = selectedProducts.reduce((sum, p) => sum + (p.price ?? 0), 0);
  const totalMonthly = selectedProducts.reduce((sum, p) => sum + productMonthlyPrice(p), 0);
  const productsCount = activeProducts.length;
  const allSelected = productsCount > 0 && selectedIds.size === productsCount;
  const hasOpenModal =
    addModalOpen ||
    createStackModalOpen ||
    editModalOpen ||
    editingProductKey !== null ||
    replaceProductKey !== null ||
    pendingDeleteProductKey !== null;
  const bottomBarVisible = productsCount > 0 && !hasOpenModal;

  useEffect(() => {
    document.body.classList.toggle('ss-stack-bottom-bar-active', bottomBarVisible);
    return () => {
      document.body.classList.remove('ss-stack-bottom-bar-active');
    };
  }, [bottomBarVisible]);


  const handleSelectAll = () => {
    if (!activeStack) return;
    setSelectedIds((prev) =>
      prev.size === activeStack.products.length
        ? new Set()
        : new Set(activeStack.products.map(productStackKey)),
    );
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const handleEmailStack = async () => {
    if (isDemo) {
      setDemoShareNoticeOpen(true);
      return;
    }
    if (!activeStack) return;
    setEmailSending(true);
    setEmailStatus('');
    try {
      const res = await credentialedFetch(apiPath(`/stacks/${activeStack.id}/email`), {
        method: 'POST',
        headers: JSON_HEADERS,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error ?? 'Stack-Mail konnte nicht gesendet werden.');
      }
      setEmailStatus('Stack wurde an deine E-Mail-Adresse gesendet.');
    } catch (err) {
      setEmailStatus(err instanceof Error ? err.message : 'Stack-Mail konnte nicht gesendet werden.');
    } finally {
      setEmailSending(false);
    }
  };

  const handlePrintStack = () => {
    if (isDemo) {
      setDemoShareNoticeOpen(true);
      return;
    }
    window.print();
  };

  const activeDescription = activeStack ? descriptions[activeStack.id] ?? '' : '';
  const editingProduct = activeStack?.products.find((product) => productStackKey(product) === editingProductKey) ?? null;
  const pendingDeleteProduct = activeStack?.products.find((product) => productStackKey(product) === pendingDeleteProductKey) ?? null;
  const replacingStack = activeStack && replaceProductKey ? activeStack : null;

  const rightSlot = isDemo ? (
    <>
      <span className="header-email">Demo-Modus â€” nicht angemeldet</span>
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
      {showStandaloneHeader && (
      <StacksHeader
        variant={HEADER_VARIANT}
        title={isDemo ? 'Demo â€“ Supplement Stack' : 'Meine Supplement Stacks'}
        subtitle={
          isDemo
            ? 'Teste die komplette OberflÃ¤che. Ã„nderungen werden nach dem Neuladen zurÃ¼ckgesetzt.'
            : 'Verwalte deine Supplements dauerhaft mit derselben OberflÃ¤che wie in der Demo.'
        }
        rightSlot={rightSlot}
      />
      )}

      <div className={showStandaloneHeader ? 'ss-page' : 'ss-page ss-page-embedded'}>
        {isDemo && (
          <div className="info-banner info-banner-demo">
            <IconInfoCircle />
            <strong>Interaktive Demo:</strong>
            &nbsp;
            <span>
              Alles nutzbar â€” nach dem Neuladen startet wieder der Demo-Stack. Registriere dich,
              um Ã„nderungen dauerhaft zu speichern.
            </span>
          </div>
        )}

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


          <button className="ss-btn ss-btn-indigo" onClick={() => setCreateStackModalOpen(true)}>
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
            onClick={() => void handleEmailStack()}
            disabled={!isDemo && (!activeStack || emailSending)}
            title={isDemo ? DEMO_SHARE_NOTICE : undefined}
            style={!isDemo && (!activeStack || emailSending) ? { opacity: 0.55, cursor: 'not-allowed' } : undefined}
          >
            <IconMail />
            {emailSending ? 'Wird gesendet...' : 'Stack mailen'}
          </button>
          <button
            className="ss-btn ss-btn-outline print-action"
            onClick={handlePrintStack}
            disabled={!isDemo && (!activeStack || productsCount === 0)}
            title={isDemo ? DEMO_SHARE_NOTICE : undefined}
            style={!isDemo && (!activeStack || productsCount === 0) ? { opacity: 0.55, cursor: 'not-allowed' } : undefined}
          >
            <IconPrint />
            Plan drucken/PDF
          </button>
          {emailStatus && (
            <span style={{ fontSize: 11, fontWeight: 700, color: '#64748b' }}>
              {emailStatus}
            </span>
          )}

          <button className="ss-btn ss-btn-green" onClick={() => setAddModalOpen(true)}>
            <IconPlus />
            Produkt hinzufuegen
          </button>

          <button
            className="ss-btn ss-btn-red-soft"
            onClick={() => void handleDeleteStack(state.activeStackId)}
          >
            <IconTrash />
            Stack lÃ¶schen
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

        <section className="stack-cockpit" aria-label="Stack-Steuerung">
          <div className="print-sheet-heading">
            <strong>Supplement Stack Einnahmeplan</strong>
            <span>{activeStack?.name ?? 'Stack'} Â· {stackProfileLabel(activeStack)}</span>
          </div>
          <div className="stack-cockpit-head">
            <div>
              <h2>{activeStack?.name ?? 'Stack'}</h2>
            </div>
            <div className="stack-cockpit-profile">{stackProfileLabel(activeStack)}</div>
          </div>

          {linkReportStatus && (
            <div className="link-report-status">
              <Flag size={14} />
              {linkReportStatus}
            </div>
          )}
        </section>

        <div className="ss-section-title ss-products-title">
          <span>Supplement Ãœbersicht</span>
          <div className="product-view-toggle" role="group" aria-label="Produktansicht wÃ¤hlen">
            <button
              type="button"
              className={productViewMode === 'grid' ? 'active' : ''}
              onClick={() => setProductViewMode('grid')}
              aria-pressed={productViewMode === 'grid'}
              title="Kachelansicht"
            >
              <LayoutGrid size={16} />
              <span>Kacheln</span>
            </button>
            <button
              type="button"
              className={productViewMode === 'list' ? 'active' : ''}
              onClick={() => setProductViewMode('list')}
              aria-pressed={productViewMode === 'list'}
              title="Listenansicht"
            >
              <List size={16} />
              <span>Liste</span>
            </button>
          </div>
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
              Noch leer â€” klicke auf &bdquo;Produkt hinzufÃ¼gen&ldquo;, um zu starten.
            </p>
            <button
              type="button"
              onClick={() => setAddModalOpen(true)}
              className="ss-btn ss-btn-green"
              style={{ margin: '18px auto 0' }}
            >
              <IconPlus />
              Produkt hinzufÃ¼gen
            </button>
          </div>
        )}

        {!loading && activeProducts.length > 0 && (
          <div className={productViewMode === 'grid' ? 'masonry-grid' : 'product-list-view'}>
            {activeProducts.map((p) => {
              const key = productStackKey(p);
              return (
                <div key={key} className={productViewMode === 'grid' ? 'masonry-item' : 'product-list-item'}>
                  <ProductCard
                    product={p}
                    shopDomains={shopDomains}
                    selected={selectedIds.has(key)}
                    display={productViewMode === 'list' ? 'list' : 'card'}
                    onToggleSelected={() => toggleSelected(key)}
                    onEdit={() => setEditingProductKey(key)}
                    onDelete={() => setPendingDeleteProductKey(key)}
                    onReportMissingLink={(product, reason) => void handleReportMissingLink(product as DemoProduct, reason)}
                    showSelectButton={false}
                  />
                </div>
              );
            })}
            {productViewMode === 'grid' && (
              <button
                type="button"
                className="masonry-item flex min-h-[220px] items-center justify-center rounded-[14px] border-2 border-dashed border-emerald-300 bg-emerald-50 text-emerald-600 shadow-sm transition hover:border-emerald-500 hover:bg-emerald-100"
                onClick={() => setAddModalOpen(true)}
                aria-label="Produkt hinzufuegen"
                title="Produkt hinzufuegen"
              >
                <Plus size={56} strokeWidth={2.4} />
              </button>
            )}
            {productViewMode === 'list' && (
              <button
                type="button"
                className="product-list-add-row"
                onClick={() => setAddModalOpen(true)}
                aria-label="Produkt hinzufuegen"
                title="Produkt hinzufuegen"
              >
                <Plus size={20} strokeWidth={2.5} />
                <span>
                  <strong>Produkt hinzufuegen</strong>
                  <small>Produkt als kompakte Zeile hinzufuegen</small>
                </span>
              </button>
            )}
          </div>
        )}
      </div>

      {/* Bottom bar */}
      {bottomBarVisible && (
      <div className="bottom-bar">
        <div>
          <div className="bb-title">Auswahl</div>
          <div className="bb-sub">
            {selectedIds.size} von {productsCount} Produkten
          </div>
        </div>
        <div className="bb-prices">
          <div className="bb-price-block">
            <div className="bb-price-label">Einmalkosten</div>
            <div className="bb-price-value">{formatEuro(totalOnce)} â‚¬</div>
          </div>
          <div className="bb-divider" />
          <div className="bb-price-block">
            <div className="bb-price-label">Pro Monat</div>
            <div className="bb-price-value">{formatEuro(totalMonthly)} â‚¬</div>
          </div>
          <button
            className="btn-select-all"
            onClick={handleSelectAll}
            disabled={productsCount === 0}
            style={productsCount === 0 ? { opacity: 0.5, cursor: 'not-allowed' } : undefined}
          >
            {allSelected ? 'Alles abwÃ¤hlen' : 'Alles auswÃ¤hlen'}
          </button>
        </div>
      </div>
      )}

      {addModalOpen && (
        <AddProductModal
          stacks={state.stacks}
          activeStackId={state.activeStackId}
          isDemo={isDemo}
          onAdd={handleAddProduct}
          onEditExisting={(key) => setEditingProductKey(key)}
          onReplaceExisting={(key) => setReplaceProductKey(key)}
          onClose={() => setAddModalOpen(false)}
        />
      )}

      {replaceProductKey && replacingStack && (
        <AddProductModal
          stacks={[replacingStack]}
          activeStackId={replacingStack.id}
          isDemo={isDemo}
          onAdd={handleReplaceProduct}
          onEditExisting={(key) => setEditingProductKey(key)}
          onReplaceExisting={(key) => setReplaceProductKey(key)}
          onClose={() => setReplaceProductKey(null)}
          title="Produkt wechseln"
          submitLabel="Produkt ersetzen"
          ignoredExistingProductKey={replaceProductKey}
        />
      )}

      {editingProductKey && editingProduct && (
        <EditProductModal
          product={editingProduct}
          onSave={(patch) => handleSaveProduct(editingProductKey, patch)}
          onReplace={() => {
            setReplaceProductKey(editingProductKey);
            setEditingProductKey(null);
          }}
          onClose={() => setEditingProductKey(null)}
        />
      )}

      {createStackModalOpen && (
        <EditStackModal
          initialName=""
          initialDescription=""
          initialFamilyMemberId={null}
          familyMembers={familyMembers}
          title="Stack anlegen"
          submitLabel="Stack erstellen"
          onSave={(name, description, familyMemberId) => handleCreateStack(name, description, familyMemberId)}
          onClose={() => setCreateStackModalOpen(false)}
        />
      )}

      {editModalOpen && activeStack && (
        <EditStackModal
          initialName={activeStack.name}
          initialDescription={activeDescription}
          initialFamilyMemberId={activeStack.family_member_id ?? null}
          familyMembers={familyMembers}
          onSave={(n, d, familyMemberId) => handleSaveStackMeta(n, d, familyMemberId)}
          onClose={() => setEditModalOpen(false)}
        />
      )}

      {pendingDeleteProductKey && pendingDeleteProduct && (
        <ConfirmDialog
          title="Produkt loeschen?"
          message="Willst du dieses Produkt wirklich loeschen?"
          confirmLabel="Ja, loeschen"
          onConfirm={async () => {
            const key = pendingDeleteProductKey;
            setPendingDeleteProductKey(null);
            await handleRemoveProduct(key);
          }}
          onClose={() => setPendingDeleteProductKey(null)}
        />
      )}

      {demoShareNoticeOpen && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-950/55 px-3 py-6 backdrop-blur-sm sm:px-6"
          onClick={(event) => {
            if (event.target === event.currentTarget) setDemoShareNoticeOpen(false);
          }}
        >
          <div className="w-full max-w-md rounded-[1.6rem] bg-white p-5 shadow-[0_30px_80px_rgba(15,23,42,0.35)] sm:p-6">
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <h2 className="text-2xl font-black tracking-tight text-slate-950">Kostenlos mit Konto verfuegbar</h2>
                <p className="mt-2 text-sm font-semibold leading-relaxed text-slate-600">
                  Funktion ist kostenlos verfuegbar, sobald man angemeldet ist. Registriere dich oder melde dich an,
                  um Stack-Mail und PDF dauerhaft mit deinem echten Stack zu nutzen.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setDemoShareNoticeOpen(false)}
                className="rounded-2xl p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
                aria-label="Schliessen"
              >
                <X size={22} />
              </button>
            </div>
            <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => setDemoShareNoticeOpen(false)}
                className="rounded-xl border border-slate-200 bg-white px-5 py-3 text-sm font-black text-slate-600 hover:bg-slate-50"
              >
                In der Demo bleiben
              </button>
              <Link
                to="/login?redirect=/stacks"
                className="inline-flex justify-center rounded-xl border border-emerald-200 bg-white px-5 py-3 text-sm font-black text-emerald-700 hover:bg-emerald-50"
              >
                Anmelden
              </Link>
              <Link
                to="/register?redirect=/stacks"
                className="inline-flex justify-center rounded-xl bg-emerald-600 px-5 py-3 text-sm font-black text-white hover:bg-emerald-700"
              >
                Kostenlos registrieren
              </Link>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default StackWorkspace;
