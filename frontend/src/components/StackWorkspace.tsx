import { useEffect, useState, useCallback, useMemo, useLayoutEffect, useRef } from 'react';
import type { ChangeEvent, FormEvent, MouseEvent as ReactMouseEvent, PointerEvent as ReactPointerEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Calculator,
  Flag,
  FileText,
  Info,
  LayoutGrid,
  List,
  Mail,
  Package,
  Pencil,
  Plus,
  Search,
  Trash2,
  X,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { apiPath } from '../api/base';
import SearchBar from './SearchBar';
import ProductCard from './ProductCard';
import StacksHeader, { type StacksHeaderVariant } from './StacksHeader';
import EditStackModal from './EditStackModal';
import { createFamilyMember, deleteFamilyMember, getFamilyMembers } from '../api/family';
import {
  createStackCategory,
  deleteStackCategory,
  getPublicIntakeTimings,
  reportProductLink,
  updateStackCategory,
  updateStackItemsLayout,
  type PublicIntakeTimingOption,
  type StackCategoryRecord,
} from '../api/stacks';
import type { FamilyMember, ProductSafetyWarning, User } from '../types';
import type { DosageGuideline, Ingredient, ShopDomain } from '../types/local';
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
  stack_item_id?: number;
  name: string;
  product_name?: string | null;
  price: number;
  brand?: string;
  product_brand?: string | null;
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
  timing_label?: string | null;
  ingredient_timing?: string | null;
  ingredient_timing_label?: string | null;
  ingredient_timing_note?: string | null;
  ingredient_intake_hint?: string | null;
  dosage_text?: string;
  sort_order?: number;
  category_id?: number | string | null;
  category_name?: string | null;
  category_is_default?: boolean | null;
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

interface StackCategory {
  id: number | string;
  stack_id: number | string;
  name: string;
  sort_order: number;
  is_default: boolean;
}

export interface DemoStack {
  id: string;
  name: string;
  products: DemoProduct[];
  categories: StackCategory[];
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
  view?: 'workspace' | 'routine';
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const DEMO_NOTICE =
  'Diese Funktion ist nur in der kostenlosen Vollversion verfügbar. Registriere dich, damit deine Änderungen dauerhaft gespeichert werden.';
const DESC_STORAGE_KEY = 'ss_stack_descriptions';
const SS_DEMO_STACK_HANDOFF_KEY = 'ss_demo_stack_handoff_v1';
const OWN_PRODUCT_DEMO_CTA_TEXT =
  'Danke, dass du ein neues Produkt zu unserer Datenbank hinzufügen möchtest. Diese Funktion steht dir kostenlos zur Verfügung, sobald du dich als Nutzer angemeldet hast.';

interface DemoStackHandoff {
  version: 1;
  source: 'demo';
  created_at: string;
  active_stack_id: string;
  stacks: Array<{
    id: string;
    name: string;
    description?: string;
    products: DemoProduct[];
    categories?: StackCategory[];
  }>;
}

const DEMO_STACK_HANDOFF_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
const DEFAULT_CUSTOM_CATEGORY_LOCAL_ID = 'default-local-category';

function normalizedCategoryId(value: number | string | null | undefined): string {
  if (value === null || value === undefined) return '';
  return String(value).trim();
}

function categoryNameKey(value: string): string {
  return value.trim().toLocaleLowerCase('de');
}

function createDefaultCategory(stackId: string | number): StackCategory {
  return {
    id: DEFAULT_CUSTOM_CATEGORY_LOCAL_ID,
    stack_id: stackId,
    name: 'Unkategorisiert',
    sort_order: 0,
    is_default: true,
  };
}

function normalizeStackCategories(stackId: string | number, rawCategories: unknown): StackCategory[] {
  const categories = Array.isArray(rawCategories) ? rawCategories : [];
  const parsed: StackCategory[] = categories
    .map((entry, index) => {
      if (!entry || typeof entry !== 'object') return null;
      const source = entry as Partial<StackCategoryRecord>;
      if (source.id === undefined || source.id === null) return null;
      const name = typeof source.name === 'string' && source.name.trim()
        ? source.name.trim()
        : `Kategorie ${index + 1}`;
      return {
        id: source.id,
        stack_id: source.stack_id ?? stackId,
        name,
        sort_order: Number.isFinite(source.sort_order) ? Number(source.sort_order) : index,
        is_default: Boolean(source.is_default),
      } satisfies StackCategory;
    })
    .filter((entry): entry is StackCategory => entry !== null)
    .sort((left, right) => left.sort_order - right.sort_order || left.name.localeCompare(right.name, 'de'));

  const fallbackDefault = createDefaultCategory(stackId);
  const defaultFromApi = parsed.find((category) => category.is_default);
  const defaultCategory = defaultFromApi ?? fallbackDefault;
  const withoutDefaultDuplicate = parsed.filter((category) => normalizedCategoryId(category.id) !== normalizedCategoryId(defaultCategory.id));
  return [defaultCategory, ...withoutDefaultDuplicate]
    .map((category, index) => ({ ...category, sort_order: index }))
    .sort((left, right) => left.sort_order - right.sort_order || left.name.localeCompare(right.name, 'de'));
}

function applySequentialSortOrder(products: DemoProduct[]): DemoProduct[] {
  return products.map((product, index) => ({ ...product, sort_order: index }));
}

function newStackId(): string {
  return `stack_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

function createDefaultState(): DemoState {
  const id = newStackId();
  return {
    stacks: [{ id, name: 'Basis Gesundheit', products: [], categories: [createDefaultCategory(id)] }],
    activeStackId: id,
  };
}

const JSON_HEADERS: Record<string, string> = {
  'Content-Type': 'application/json',
};

function credentialedFetch(input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> {
  return fetch(input, { credentials: 'include', ...init });
}

function mapStackDetail(
  stack: { id: number | string; name: string; family_member_id?: number | null; family_member_first_name?: string | null },
  detail?: Record<string, unknown>,
): DemoStack {
  const stackId = String(stack.id);
  const rawProducts = (detail?.products ?? detail?.items ?? []) as DemoProduct[];
  const products = applySequentialSortOrder(
    [...rawProducts].sort((left, right) => {
      const leftOrder = Number.isFinite(left.sort_order) ? Number(left.sort_order) : Number.MAX_SAFE_INTEGER;
      const rightOrder = Number.isFinite(right.sort_order) ? Number(right.sort_order) : Number.MAX_SAFE_INTEGER;
      if (leftOrder !== rightOrder) return leftOrder - rightOrder;
      return compareProductsByName(left, right);
    }),
  );
  const stackDetail = detail?.stack as {
    name?: string;
    family_member_id?: number | null;
    family_member_first_name?: string | null;
  } | undefined;
  const categories = normalizeStackCategories(stack.id, detail?.categories);
  const defaultCategory = categories.find((category) => category.is_default) ?? createDefaultCategory(stackId);
  const normalizedProducts = products.map((product) => {
    const productCategory = categories.find((category) => normalizedCategoryId(category.id) === normalizedCategoryId(product.category_id));
    return {
      ...product,
      category_id: productCategory?.id ?? product.category_id ?? defaultCategory.id,
      category_name: productCategory?.name ?? product.category_name ?? defaultCategory.name,
      category_is_default: productCategory?.is_default ?? product.category_is_default ?? false,
    };
  });
  return {
    id: stackId,
    name: stackDetail?.name ?? stack.name,
    products: normalizedProducts,
    categories,
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

function persistDemoStackHandoff(state: DemoState, descriptions: Record<string, string>): boolean {
  try {
    const snapshot: DemoStackHandoff = {
      version: 1,
      source: 'demo',
      created_at: new Date().toISOString(),
      active_stack_id: state.activeStackId,
      stacks: state.stacks.map((stack) => ({
        id: stack.id,
        name: stack.name,
        description: descriptions[stack.id],
        products: stack.products,
        categories: stack.categories,
      })),
    };
    window.localStorage.setItem(SS_DEMO_STACK_HANDOFF_KEY, JSON.stringify(snapshot));
    window.sessionStorage.setItem(SS_DEMO_STACK_HANDOFF_KEY, JSON.stringify({ pending: true }));
    return true;
  } catch {
    return false;
  }
}

function clearDemoStackHandoff() {
  try {
    window.localStorage.removeItem(SS_DEMO_STACK_HANDOFF_KEY);
  } catch {
    // ignore storage errors
  }
  try {
    window.sessionStorage.removeItem(SS_DEMO_STACK_HANDOFF_KEY);
  } catch {
    // ignore storage errors
  }
}

function productStackKey(product: Pick<DemoProduct, 'id' | 'product_type'>): string {
  return `${product.product_type ?? 'catalog'}:${product.id}`;
}

function isDemoStackHandoff(value: unknown): value is DemoStackHandoff {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as {
    version?: unknown;
    source?: unknown;
    created_at?: unknown;
    active_stack_id?: unknown;
    stacks?: unknown;
  };
  if (candidate.version !== 1 || candidate.source !== 'demo') return false;
  if (typeof candidate.created_at !== 'string' || typeof candidate.active_stack_id !== 'string') return false;
  const createdAt = Date.parse(candidate.created_at);
  if (!Number.isFinite(createdAt) || Date.now() - createdAt > DEMO_STACK_HANDOFF_MAX_AGE_MS) return false;
  if (!Array.isArray(candidate.stacks)) return false;
  return candidate.stacks.every((stack) => {
    if (!stack || typeof stack !== 'object') return false;
    const item = stack as { id?: unknown; name?: unknown; products?: unknown; categories?: unknown };
    const hasCategories = item.categories === undefined || Array.isArray(item.categories);
    return typeof item.id === 'string' && typeof item.name === 'string' && Array.isArray(item.products) && hasCategories;
  });
}

function loadDemoStackHandoff(): DemoStackHandoff | null {
  try {
    const raw = window.localStorage.getItem(SS_DEMO_STACK_HANDOFF_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (!isDemoStackHandoff(parsed)) {
      clearDemoStackHandoff();
      return null;
    }
    return parsed;
  } catch {
    clearDemoStackHandoff();
    return null;
  }
}

function productKeysMatch(left: DemoProduct[], right: DemoProduct[]): boolean {
  if (left.length !== right.length) return false;
  const rightKeys = new Set(right.map(productStackKey));
  return left.every((product) => rightKeys.has(productStackKey(product)));
}

function findExistingImportedStack(stacks: DemoStack[], candidate: DemoStackHandoff['stacks'][number]): DemoStack | null {
  const matchingProducts = stacks.find((stack) => stack.name === candidate.name && productKeysMatch(stack.products, candidate.products));
  if (matchingProducts) return matchingProducts;
  return stacks.find((stack) => stack.name === candidate.name && stack.products.length === 0) ?? null;
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
  const daysLabel = usage.daysSupply ? ` (reicht für ${usage.daysSupply} Tage)` : '';

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
  return days === 1 ? 'täglich' : `alle ${days} Tage`;
}

function productMonthlyPrice(product: DemoProduct): number {
  return calculateProductUsage(product, product.price, { fallbackTotalServings: 30 }).monthlyCost ?? product.price;
}

function formatEuro(value: number): string {
  return value.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatDaysSupply(days: number | null): string {
  return days ? `${days} Tage` : 'unbekannt';
}

function getUserDisplayName(user: User | null | undefined): string | null {
  const userRecord = user as Partial<Record<'name' | 'display_name' | 'full_name' | 'email', unknown>> | null;
  const candidateKeys: Array<'name' | 'display_name' | 'full_name'> = ['name', 'display_name', 'full_name'];
  for (const key of candidateKeys) {
    const value = userRecord?.[key];
    if (typeof value === 'string') {
      const trimmed = value.trim();
      if (trimmed) return trimmed;
    }
  }
  return typeof userRecord?.email === 'string' && userRecord.email.trim() ? userRecord.email : null;
}

function stackProfileLabel(stack: DemoStack | undefined): string {
  if (!stack?.family_member_id) return 'Eigener Stack';
  return stack.family_member_first_name ? `Für ${stack.family_member_first_name}` : 'Familienprofil';
}

type RoutineKey = 'morning' | 'noon' | 'evening' | 'flexible';
type ProductSortMode = 'az' | 'timing' | 'custom';
type ProductCategoryMode = 'none' | 'timing' | 'custom';

const ROUTINE_META: Record<RoutineKey, { label: string; hint: string }> = {
  morning: { label: 'Morgens', hint: 'Frühstück / Start in den Tag' },
  noon: { label: 'Mittags', hint: 'Mittag / nach dem Essen' },
  evening: { label: 'Abends', hint: 'Abendessen / vor dem Schlafen' },
  flexible: { label: 'Jederzeit', hint: 'Zeitpunkt frei wählbar' },
};

type IntakeTimingOption = Pick<PublicIntakeTimingOption, 'value' | 'label' | 'description' | 'sort_order'>;

const FALLBACK_INTAKE_TIMING_OPTIONS: IntakeTimingOption[] = [
  { value: 'anytime', label: 'Jederzeit' },
  { value: 'before_breakfast', label: 'Vor dem Frühstück' },
  { value: 'after_breakfast', label: 'Nach dem Frühstück' },
  { value: 'with_meal', label: 'Zum Essen' },
  { value: 'morning', label: 'Morgens' },
  { value: 'evening', label: 'Abends' },
  { value: 'noon', label: 'Mittags' },
  { value: 'morning_evening', label: 'Morgens & Abends' },
].map((option, index) => ({ ...option, description: null, sort_order: index + 1 }));

const INTAKE_TIMING_LABELS: Record<string, string> = {
  anytime: 'Jederzeit',
  flexible: 'Jederzeit',
  before_breakfast: 'Vor dem Frühstück',
  after_breakfast: 'Nach dem Frühstück',
  with_meal: 'Zum Essen',
  morning: 'Morgens',
  evening: 'Abends',
  noon: 'Mittags',
  morning_evening: 'Morgens & Abends',
};

function buildIntakeTimingOptions(managedTimingOptions: IntakeTimingOption[]): IntakeTimingOption[] {
  const activeManagedOptions = managedTimingOptions
    .filter((option) => option.value.trim() && option.label.trim())
    .sort((left, right) => left.sort_order - right.sort_order || left.label.localeCompare(right.label, 'de'));
  return activeManagedOptions.length > 0 ? activeManagedOptions : FALLBACK_INTAKE_TIMING_OPTIONS;
}

function humanizeTimingFallback(timing?: string | null): string {
  const raw = timing?.trim();
  if (!raw) return INTAKE_TIMING_LABELS.anytime;
  const enumLike = /^[A-Z0-9_-]+$/.test(raw) || /^[a-z0-9_-]+$/.test(raw);
  if (enumLike) return INTAKE_TIMING_LABELS.anytime;
  return raw.replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim() || INTAKE_TIMING_LABELS.anytime;
}

function timingLabelForDisplay(timing?: string | null, managedTimingOptions: IntakeTimingOption[] = []): string {
  const raw = timing?.trim();
  if (!raw) return INTAKE_TIMING_LABELS.anytime;
  const normalized = raw.toLowerCase().replace(/\s+/g, '_').replace(/-/g, '_');
  const managedLabel = managedTimingOptions.find((option) => option.value === normalized)?.label;
  return managedLabel ?? INTAKE_TIMING_LABELS[normalized] ?? humanizeTimingFallback(raw);
}

function routineKeyForTiming(timing?: string): RoutineKey {
  const normalized = (timing ?? '').toLowerCase().replace(/\s+/g, '_').replace(/-/g, '_');
  if (
    normalized.includes('before_breakfast') ||
    normalized.includes('after_breakfast') ||
    normalized.includes('morning_evening') ||
    normalized.includes('morgen') ||
    normalized.includes('frueh') ||
    normalized.includes('früh') ||
    normalized.includes('morning')
  ) return 'morning';
  if (normalized.includes('with_meal') || normalized.includes('mittag') || normalized.includes('noon') || normalized.includes('essen') || normalized.includes('meal')) return 'noon';
  if (normalized.includes('abend') || normalized.includes('nacht') || normalized.includes('evening')) return 'evening';
  return 'flexible';
}

const PRODUCT_TIMING_ORDER: RoutineKey[] = ['morning', 'noon', 'evening', 'flexible'];
const PRODUCT_NAME_COLLATOR = new Intl.Collator('de-DE', { sensitivity: 'base', numeric: true });

function productSortName(product: DemoProduct): string {
  return (product.product_name ?? product.name ?? '').trim();
}

function compareProductsByName(a: DemoProduct, b: DemoProduct): number {
  const byName = PRODUCT_NAME_COLLATOR.compare(productSortName(a), productSortName(b));
  if (byName !== 0) return byName;
  return PRODUCT_NAME_COLLATOR.compare(String(a.id), String(b.id));
}

function compareProductsByCustomOrder(a: DemoProduct, b: DemoProduct): number {
  const aOrder = Number.isFinite(a.sort_order) ? Number(a.sort_order) : Number.MAX_SAFE_INTEGER;
  const bOrder = Number.isFinite(b.sort_order) ? Number(b.sort_order) : Number.MAX_SAFE_INTEGER;
  if (aOrder !== bOrder) return aOrder - bOrder;
  return compareProductsByName(a, b);
}

function sortProductsForDisplay(products: DemoProduct[], sortMode: ProductSortMode): DemoProduct[] {
  const sorted = [...products];
  if (sortMode === 'az') return sorted.sort(compareProductsByName);
  if (sortMode === 'custom') return sorted.sort(compareProductsByCustomOrder);

  return sorted.sort((a, b) => {
    const aRoutine = routineKeyForTiming(a.timing);
    const bRoutine = routineKeyForTiming(b.timing);
    const byTiming = PRODUCT_TIMING_ORDER.indexOf(aRoutine) - PRODUCT_TIMING_ORDER.indexOf(bRoutine);
    return byTiming || compareProductsByName(a, b);
  });
}

interface ProductSection {
  id: string;
  heading: string | null;
  categoryId: number | string | null;
  products: DemoProduct[];
}

type ProductLayoutDropPlacement = 'before' | 'after' | 'end';

interface ProductLayoutSectionTarget {
  id: string;
  categoryId: number | string | null;
  productKeys: string[];
}

interface ProductLayoutMeasuredItem {
  productKey: string;
  rect: DOMRect;
}

interface ProductLayoutMasonryColumn {
  left: number;
  right: number;
  items: ProductLayoutMeasuredItem[];
}

interface ProductLayoutMeasuredSection extends ProductLayoutSectionTarget {
  rect: DOMRect;
  items: ProductLayoutMeasuredItem[];
}

interface ProductLayoutDropSlot {
  targetProductKey: string | null;
  targetCategoryId: number | string | null;
  placement: ProductLayoutDropPlacement;
  targetSectionId: string | null;
  targetSectionProductKeys: string[];
  distance: number;
}

interface ProductPointerDragState {
  productKey: string;
  pointerId: number;
  startX: number;
  startY: number;
  lastPreviewProducts: DemoProduct[] | null;
  lastAcceptedSlot: ProductLayoutDropSlot | null;
  lastAcceptedSlotKey: string | null;
  lastAcceptedClientX: number;
  lastAcceptedClientY: number;
  hasMoved: boolean;
}

const PRODUCT_LAYOUT_POINTER_START_PX = 6;
const PRODUCT_LAYOUT_SLOT_HYSTERESIS_PX = 16;
const PRODUCT_LAYOUT_SLOT_DISTANCE_ADVANTAGE_PX = 6;
const PRODUCT_LAYOUT_SECTION_TARGET_MARGIN_PX = 48;
const PRODUCT_LAYOUT_SECTION_END_MARGIN_PX = 28;
const PRODUCT_LAYOUT_MASONRY_COLUMN_TOLERANCE_PX = 24;

function sectionSortMode(sortMode: ProductSortMode, categoryMode: ProductCategoryMode): ProductSortMode {
  if (categoryMode === 'timing' && sortMode === 'timing') return 'az';
  return sortMode;
}

function buildProductSections(
  products: DemoProduct[],
  categories: StackCategory[],
  sortMode: ProductSortMode,
  categoryMode: ProductCategoryMode,
): ProductSection[] {
  const effectiveSort = sectionSortMode(sortMode, categoryMode);
  if (categoryMode === 'none') {
    return [{ id: 'none', heading: null, categoryId: null, products: sortProductsForDisplay(products, effectiveSort) }];
  }

  if (categoryMode === 'timing') {
    const byRoutine: Record<RoutineKey, DemoProduct[]> = {
      morning: [],
      noon: [],
      evening: [],
      flexible: [],
    };
    for (const product of products) {
      byRoutine[routineKeyForTiming(product.timing)].push(product);
    }
    return (Object.keys(ROUTINE_META) as RoutineKey[])
      .map((routine) => ({
        id: `timing-${routine}`,
        heading: ROUTINE_META[routine].label,
        categoryId: routine,
        products: sortProductsForDisplay(byRoutine[routine], effectiveSort),
      }))
      .filter((section) => section.products.length > 0);
  }

  const orderedCategories = [...categories]
    .sort((left, right) => left.sort_order - right.sort_order || left.name.localeCompare(right.name, 'de'));
  const defaultCategory = orderedCategories.find((category) => category.is_default) ?? createDefaultCategory('local-stack');
  const sections = orderedCategories.map((category) => ({
    id: `custom-${normalizedCategoryId(category.id)}`,
    heading: category.name,
    categoryId: category.id,
    products: [] as DemoProduct[],
  }));

  const sectionByCategory = new Map<string, ProductSection>();
  for (const section of sections) {
    sectionByCategory.set(normalizedCategoryId(section.categoryId), section);
  }
  for (const product of products) {
    const section = sectionByCategory.get(normalizedCategoryId(product.category_id))
      ?? sectionByCategory.get(normalizedCategoryId(defaultCategory.id))
      ?? sections[0];
    section.products.push(product);
  }
  for (const section of sections) {
    section.products = sortProductsForDisplay(section.products, effectiveSort);
  }
  return sections;
}

function productLayoutTargetCategory(
  categories: StackCategory[],
  categoryMode: ProductCategoryMode,
  targetCategoryId: number | string | null,
  stackId: string,
): StackCategory | null {
  if (categoryMode !== 'custom') return null;
  const defaultCategory = categories.find((category) => category.is_default) ?? categories[0] ?? createDefaultCategory(stackId);
  return categories.find((category) => normalizedCategoryId(category.id) === normalizedCategoryId(targetCategoryId)) ?? defaultCategory;
}

function productLayoutProductsEqual(left: DemoProduct[] | null, right: DemoProduct[]): boolean {
  if (!left || left.length !== right.length) return false;
  return left.every((product, index) => (
    productStackKey(product) === productStackKey(right[index])
    && normalizedCategoryId(product.category_id) === normalizedCategoryId(right[index].category_id)
  ));
}

function productLayoutSectionEndIndex(
  products: DemoProduct[],
  productKey: string,
  targetSectionId: string | null,
  targetSectionProductKeys: string[],
  sectionTargets: ProductLayoutSectionTarget[],
): number | null {
  const targetIndex = sectionTargets.findIndex((section) => section.id === targetSectionId);
  const targetKeys = targetIndex >= 0 ? sectionTargets[targetIndex].productKeys : targetSectionProductKeys;
  const targetProductKeys = new Set(targetKeys.filter((key) => key !== productKey));

  for (let index = products.length - 1; index >= 0; index -= 1) {
    if (targetProductKeys.has(productStackKey(products[index]))) {
      return index + 1;
    }
  }

  if (targetIndex < 0) return null;

  for (let sectionIndex = targetIndex - 1; sectionIndex >= 0; sectionIndex -= 1) {
    const previousKeys = new Set(sectionTargets[sectionIndex].productKeys.filter((key) => key !== productKey));
    for (let productIndex = products.length - 1; productIndex >= 0; productIndex -= 1) {
      if (previousKeys.has(productStackKey(products[productIndex]))) {
        return productIndex + 1;
      }
    }
  }

  for (let sectionIndex = targetIndex + 1; sectionIndex < sectionTargets.length; sectionIndex += 1) {
    const nextKeys = new Set(sectionTargets[sectionIndex].productKeys.filter((key) => key !== productKey));
    for (let productIndex = 0; productIndex < products.length; productIndex += 1) {
      if (nextKeys.has(productStackKey(products[productIndex]))) {
        return productIndex;
      }
    }
  }

  return products.length;
}

function productLayoutDropSlotKey(slot: ProductLayoutDropSlot): string {
  return [
    slot.targetSectionId ?? '',
    normalizedCategoryId(slot.targetCategoryId),
    slot.targetProductKey ?? '',
    slot.placement,
  ].join('|');
}

function productLayoutRectDistance(rect: DOMRect, clientX: number, clientY: number): number {
  const deltaX = clientX < rect.left ? rect.left - clientX : clientX > rect.right ? clientX - rect.right : 0;
  const deltaY = clientY < rect.top ? rect.top - clientY : clientY > rect.bottom ? clientY - rect.bottom : 0;
  return Math.hypot(deltaX, deltaY);
}

function productLayoutSectionForPoint(
  sections: ProductLayoutMeasuredSection[],
  clientX: number,
  clientY: number,
): ProductLayoutMeasuredSection | null {
  if (sections.length === 0) return null;

  const nearbySections = sections.filter((section) => {
    const rect = section.rect;
    return (
      clientX >= rect.left - PRODUCT_LAYOUT_SECTION_TARGET_MARGIN_PX
      && clientX <= rect.right + PRODUCT_LAYOUT_SECTION_TARGET_MARGIN_PX
      && clientY >= rect.top - PRODUCT_LAYOUT_SECTION_TARGET_MARGIN_PX
      && clientY <= rect.bottom + PRODUCT_LAYOUT_SECTION_TARGET_MARGIN_PX
    );
  });

  if (nearbySections.length === 0) return null;

  return nearbySections.reduce<ProductLayoutMeasuredSection | null>((best, section) => {
    if (!best) return section;
    return productLayoutRectDistance(section.rect, clientX, clientY) < productLayoutRectDistance(best.rect, clientX, clientY)
      ? section
      : best;
  }, null);
}

function buildMasonryItemColumns(items: ProductLayoutMeasuredItem[]): ProductLayoutMasonryColumn[] {
  if (items.length === 0) {
    return [];
  }

  const sorted = [...items].sort((left, right) => left.rect.left - right.rect.left || left.rect.top - right.rect.top);
  const columns: ProductLayoutMasonryColumn[] = [];

  for (const item of sorted) {
    const itemLeft = item.rect.left;
    const itemRight = item.rect.left + item.rect.width;

    const column = columns.find((entry) => (
      Math.abs(entry.left - itemLeft) <= PRODUCT_LAYOUT_MASONRY_COLUMN_TOLERANCE_PX
    ));
    if (column) {
      column.items.push(item);
      column.left = Math.min(column.left, itemLeft);
      column.right = Math.max(column.right, itemRight);
      continue;
    }

    columns.push({
      left: itemLeft,
      right: itemRight,
      items: [item],
    });
  }

  return columns.sort((left, right) => left.left - right.left);
}

function pickMasonryColumnForX(
  columns: ProductLayoutMasonryColumn[],
  clientX: number,
): ProductLayoutMasonryColumn | null {
  if (columns.length === 0) return null;

  const tolerance = PRODUCT_LAYOUT_MASONRY_COLUMN_TOLERANCE_PX;
  const underPointer = columns.filter((column) => {
    const start = column.left - tolerance;
    const end = column.right + tolerance;
    return clientX >= start && clientX <= end;
  });
  const candidates = underPointer.length > 0 ? underPointer : columns;

  return candidates.reduce((best, column) => {
    const columnCenterX = (column.left + column.right) / 2;
    const bestCenterX = (best.left + best.right) / 2;
    return Math.abs(columnCenterX - clientX) < Math.abs(bestCenterX - clientX) ? column : best;
  }, candidates[0]);
}

function findGridProductLayoutDropSlotFallbackToNearestCenter(
  section: ProductLayoutMeasuredSection,
  items: ProductLayoutMeasuredItem[],
  clientX: number,
  clientY: number,
): ProductLayoutDropSlot | null {
  if (items.length === 0) return null;

  const nearest = items.reduce((best, item) => (
    productLayoutItemCenterDistance(item, clientX, clientY) < productLayoutItemCenterDistance(best, clientX, clientY) ? item : best
  ), items[0]);
  const centerY = nearest.rect.top + nearest.rect.height / 2;

  return {
    targetProductKey: nearest.productKey,
    targetCategoryId: section.categoryId,
    placement: clientY < centerY ? 'before' : 'after',
    targetSectionId: section.id,
    targetSectionProductKeys: section.productKeys,
    distance: Math.abs(clientY - centerY),
  };
}

function productLayoutItemCenterDistance(item: ProductLayoutMeasuredItem, clientX: number, clientY: number): number {
  const centerX = item.rect.left + item.rect.width / 2;
  const centerY = item.rect.top + item.rect.height / 2;
  return Math.hypot(clientX - centerX, clientY - centerY);
}

function productLayoutEndSlot(section: ProductLayoutMeasuredSection, clientX: number, clientY: number): ProductLayoutDropSlot {
  const endX = section.rect.left + section.rect.width / 2;
  const endY = section.rect.bottom;
  return {
    targetProductKey: null,
    targetCategoryId: section.categoryId,
    placement: 'end',
    targetSectionId: section.id,
    targetSectionProductKeys: section.productKeys,
    distance: Math.hypot(clientX - endX, clientY - endY),
  };
}

function findListProductLayoutDropSlot(
  sections: ProductLayoutMeasuredSection[],
  productKey: string,
  clientX: number,
  clientY: number,
): ProductLayoutDropSlot | null {
  const section = productLayoutSectionForPoint(sections, clientX, clientY);
  if (!section) return null;

  const items = section.items
    .filter((item) => item.productKey !== productKey)
    .sort((left, right) => left.rect.top - right.rect.top || left.rect.left - right.rect.left);

  if (items.length === 0) {
    return productLayoutEndSlot(section, clientX, clientY);
  }

  const lastItem = items[items.length - 1];
  if (clientY > lastItem.rect.bottom + PRODUCT_LAYOUT_SECTION_END_MARGIN_PX) {
    return productLayoutEndSlot(section, clientX, clientY);
  }

  const nearest = items.reduce((best, item) => (
    productLayoutItemCenterDistance(item, clientX, clientY) < productLayoutItemCenterDistance(best, clientX, clientY) ? item : best
  ), items[0]);
  const centerY = nearest.rect.top + nearest.rect.height / 2;

  return {
    targetProductKey: nearest.productKey,
    targetCategoryId: section.categoryId,
    placement: clientY < centerY ? 'before' : 'after',
    targetSectionId: section.id,
    targetSectionProductKeys: section.productKeys,
    distance: Math.abs(clientY - centerY),
  };
}

function findGridProductLayoutDropSlot(
  sections: ProductLayoutMeasuredSection[],
  productKey: string,
  clientX: number,
  clientY: number,
): ProductLayoutDropSlot | null {
  const section = productLayoutSectionForPoint(sections, clientX, clientY);
  if (!section) return null;

  const items = section.items.filter((item) => item.productKey !== productKey);
  if (items.length === 0) {
    return productLayoutEndSlot(section, clientX, clientY);
  }

  const maxItemBottom = Math.max(...items.map((item) => item.rect.bottom));
  if (clientY > maxItemBottom + PRODUCT_LAYOUT_SECTION_END_MARGIN_PX) {
    return productLayoutEndSlot(section, clientX, clientY);
  }

  const columns = buildMasonryItemColumns(items);
  const targetColumn = pickMasonryColumnForX(columns, clientX);
  if (!targetColumn) {
    return findGridProductLayoutDropSlotFallbackToNearestCenter(section, items, clientX, clientY);
  }

  const orderedColumnItems = [...targetColumn.items].sort((left, right) => (
    left.rect.top - right.rect.top || left.rect.left - right.rect.left
  ));
  if (orderedColumnItems.length === 0) {
    return findGridProductLayoutDropSlotFallbackToNearestCenter(section, items, clientX, clientY);
  }

  const nearestInColumn = orderedColumnItems.reduce((best, item) => {
    const bestCenterY = best.rect.top + best.rect.height / 2;
    const itemCenterY = item.rect.top + item.rect.height / 2;
    return Math.abs(clientY - itemCenterY) < Math.abs(clientY - bestCenterY) ? item : best;
  }, orderedColumnItems[0]);
  const centerY = nearestInColumn.rect.top + nearestInColumn.rect.height / 2;

  return {
    targetProductKey: nearestInColumn.productKey,
    targetCategoryId: section.categoryId,
    placement: clientY < centerY ? 'before' : 'after',
    targetSectionId: section.id,
    targetSectionProductKeys: section.productKeys,
    distance: Math.abs(clientY - centerY),
  };
}

function findProductLayoutDropSlot(
  sections: ProductLayoutMeasuredSection[],
  productKey: string,
  clientX: number,
  clientY: number,
  viewMode: ProductViewMode,
): ProductLayoutDropSlot | null {
  return viewMode === 'grid'
    ? findGridProductLayoutDropSlot(sections, productKey, clientX, clientY)
    : findListProductLayoutDropSlot(sections, productKey, clientX, clientY);
}

function productLayoutDropSlotDistance(
  slot: ProductLayoutDropSlot,
  sections: ProductLayoutMeasuredSection[],
  clientX: number,
  clientY: number,
  viewMode: ProductViewMode,
): number {
  const section = sections.find((entry) => entry.id === slot.targetSectionId);
  if (!section) return Number.POSITIVE_INFINITY;
  if (!slot.targetProductKey || slot.placement === 'end') {
    return productLayoutEndSlot(section, clientX, clientY).distance;
  }
  const item = section.items.find((entry) => entry.productKey === slot.targetProductKey);
  if (!item) return Number.POSITIVE_INFINITY;
  if (viewMode === 'list') {
    const centerY = item.rect.top + item.rect.height / 2;
    return Math.abs(clientY - centerY);
  }
  const centerY = item.rect.top + item.rect.height / 2;
  return Math.abs(clientY - centerY);
}

function acceptProductLayoutDropSlot(
  pointerDrag: ProductPointerDragState,
  candidateSlot: ProductLayoutDropSlot,
  sections: ProductLayoutMeasuredSection[],
  clientX: number,
  clientY: number,
  viewMode: ProductViewMode,
): boolean {
  if (!pointerDrag.lastAcceptedSlot || !pointerDrag.lastAcceptedSlotKey) return true;
  const candidateKey = productLayoutDropSlotKey(candidateSlot);
  if (candidateKey === pointerDrag.lastAcceptedSlotKey) return false;

  const pointerTravel = Math.hypot(clientX - pointerDrag.lastAcceptedClientX, clientY - pointerDrag.lastAcceptedClientY);
  const candidateDistance = productLayoutDropSlotDistance(candidateSlot, sections, clientX, clientY, viewMode);
  const previousDistance = productLayoutDropSlotDistance(pointerDrag.lastAcceptedSlot, sections, clientX, clientY, viewMode);

  return (
    pointerTravel >= PRODUCT_LAYOUT_SLOT_HYSTERESIS_PX
    || candidateDistance + PRODUCT_LAYOUT_SLOT_DISTANCE_ADVANTAGE_PX < previousDistance
  );
}

function validateProductLayoutDropAtPoint(
  sections: ProductLayoutMeasuredSection[],
  productKey: string,
  clientX: number,
  clientY: number,
  viewMode: ProductViewMode,
): ProductLayoutDropSlot | null {
  return findProductLayoutDropSlot(sections, productKey, clientX, clientY, viewMode);
}

function previewProductLayoutProducts(
  products: DemoProduct[],
  categories: StackCategory[],
  categoryMode: ProductCategoryMode,
  stackId: string,
  productKey: string,
  targetProductKey: string | null,
  targetCategoryId: number | string | null,
  placement: ProductLayoutDropPlacement,
  targetSectionId: string | null,
  targetSectionProductKeys: string[],
  sectionTargets: ProductLayoutSectionTarget[],
): DemoProduct[] {
  const sourceIndex = products.findIndex((product) => productStackKey(product) === productKey);
  if (sourceIndex < 0) return products;

  const next = [...products];
  const [moved] = next.splice(sourceIndex, 1);
  const targetCategory = productLayoutTargetCategory(categories, categoryMode, targetCategoryId, stackId);
  const movedProduct = targetCategory
    ? {
        ...moved,
        category_id: targetCategory.id,
        category_name: targetCategory.name,
        category_is_default: targetCategory.is_default,
      }
    : moved;

  let targetIndex = next.length;
  if (targetProductKey && placement !== 'end') {
    const targetIndexAfterRemoval = next.findIndex((product) => productStackKey(product) === targetProductKey);
    if (targetIndexAfterRemoval < 0) return products;
    targetIndex = targetIndexAfterRemoval + (placement === 'after' ? 1 : 0);
  } else if (placement === 'end') {
    targetIndex = productLayoutSectionEndIndex(next, productKey, targetSectionId, targetSectionProductKeys, sectionTargets) ?? next.length;
  }

  const boundedIndex = Math.max(0, Math.min(targetIndex, next.length));
  next.splice(boundedIndex, 0, movedProduct);
  return applySequentialSortOrder(next);
}

function normalizeStackWithLayout(stack: DemoStack): DemoStack {
  const categories = normalizeStackCategories(stack.id, stack.categories);
  const defaultCategory = categories.find((category) => category.is_default) ?? createDefaultCategory(stack.id);
  const products = applySequentialSortOrder(stack.products).map((product) => {
    const category = categories.find((entry) => normalizedCategoryId(entry.id) === normalizedCategoryId(product.category_id));
    return {
      ...product,
      category_id: category?.id ?? defaultCategory.id,
      category_name: category?.name ?? defaultCategory.name,
      category_is_default: category?.is_default ?? false,
    };
  });
  return { ...stack, categories, products };
}

function toApiCategoryId(value: number | string | null | undefined): number | null | undefined {
  if (value === null || value === undefined || value === '') return undefined;
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
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
  title = 'Produkt hinzufügen',
  submitLabel = 'Hinzufügen',
  onRequestOwnProduct,
  onEditExistingProduct,
  onReplaceExistingProduct,
  timingOptions,
}: {
  stacks: DemoStack[];
  activeStackId: string;
  isDemo: boolean;
  onAdd: (product: DemoProduct, stackId: string) => Promise<void>;
  onClose: () => void;
  onRequestOwnProduct: () => void;
  onEditExistingProduct?: (productKey: string) => void;
  onReplaceExistingProduct?: (productKey: string) => void;
  timingOptions: IntakeTimingOption[];
  title?: string;
  submitLabel?: string;
  ignoredExistingProductKey?: string;
}) {
  const [step, setStep] = useState<'search' | 'dosage' | 'products'>('search');
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
  const [duplicateIngredient, setDuplicateIngredient] = useState<{
    ingredient: Ingredient;
    product: DemoProduct;
  } | null>(null);
  const targetStack = stacks.find((stack) => stack.id === targetStackId);
  const existingProductKeys = useMemo(
    () => new Set((targetStack?.products ?? []).map(productStackKey)),
    [targetStack],
  );
  const duplicateProductKey = duplicateIngredient ? productStackKey(duplicateIngredient.product) : null;

  const dgeGuideline = guidelines.find((gl) => gl.source === 'DGE' || gl.is_default) ?? guidelines[0];
  const studyGuideline =
    guidelines.find((gl) => gl.source === 'study') ??
    guidelines.find((gl) => gl.id !== dgeGuideline?.id);

  const selectedForm = useMemo(
    () => forms.find((form) => form.id === selectedFormId) ?? null,
    [forms, selectedFormId],
  );

  const findDuplicateIngredientProduct = useCallback(
    (selected: Ingredient): DemoProduct | null => {
      const stack = stacks.find((item) => item.id === targetStackId);
      return stack?.products.find((product) =>
        productStackKey(product) !== ignoredExistingProductKey &&
        product.ingredients?.some((row) =>
          row.ingredient_id === selected.id || row.parent_ingredient_id === selected.id,
        ),
      ) ?? null;
    },
    [ignoredExistingProductKey, stacks, targetStackId],
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

  const startIngredientFlow = useCallback((selected: Ingredient) => {
    setIngredient(selected);
    setError('');
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
  }, [loadDosageGuidelines]);

  const chooseIngredient = (selected: Ingredient) => {
    const duplicateProduct = findDuplicateIngredientProduct(selected);
    if (duplicateProduct) {
      setDuplicateIngredient({ ingredient: selected, product: duplicateProduct });
      return;
    }
    startIngredientFlow(selected);
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

  const addProduct = async (product: DemoProduct) => {
    const key = productStackKey(product);
    if (existingProductKeys.has(key) && key !== ignoredExistingProductKey) {
      setError('Produkt ist bereits in diesem Stack.');
      return;
    }
    const targetDosageText = dose.value > 0 && dose.unit
      ? `${dose.value} ${dose.unit} täglich`
      : product.dosage_text || '1 Portion täglich';
    const enhanced: DemoProduct = {
      ...product,
      dosage_text: targetDosageText,
      timing: product.ingredient_timing || product.timing || 'anytime',
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
            <SearchBar onSelect={chooseIngredient} placeholder="z.B. D3, Cobalamin, Magnesium..." autoFocus />
            <p className="mt-3 text-sm font-semibold text-slate-500">
              Beginnen Sie zu tippen, um Wirkstoffe zu finden.
            </p>
            {ingredientLoading && (
              <p className="mt-3 text-sm font-bold text-blue-700">Wirkstoffdaten werden geladen...</p>
            )}
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
                      <p className="text-base font-black text-blue-700">DGE-Referenzwert</p>
                      <p className="mt-2 text-2xl font-black text-blue-600">
                        {primaryDose(dgeGuideline)!.value}
                        {primaryDose(dgeGuideline)!.unit}
                      </p>
                      <span className="mt-4 flex justify-center rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-black text-white">
                        Referenzwert übernehmen
                      </span>
                    </button>
                  ) : (
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-left cursor-default">
                      <p className="text-base font-black text-slate-500">DGE-Referenzwert</p>
                      <p className="mt-2 text-sm font-semibold text-slate-400">
                        Kein offizieller Referenzwert verfügbar
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
                Zuruck zur Suche
              </button>
              <button
                onClick={() => loadProducts()}
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
                {selectedForm ? ` · ${selectedForm.name}` : ''}
              </p>
            </div>
            <button
              type="button"
              className="ss-own-product-cta"
              onClick={onRequestOwnProduct}
            >
              <Plus size={18} />
              Eigenes Produkt hinzufügen
            </button>
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
                  Keine Produkte für diesen Wirkstoff gefunden.
                </p>
              )}
              <div className="grid gap-4">
                {products.map((product) => {
                  const key = productStackKey(product);
                  const alreadyInTargetStack = existingProductKeys.has(key) && key !== ignoredExistingProductKey;
                  const previewProduct: DemoProduct = {
                    ...product,
                    dosage_text: dose.value > 0 && dose.unit
                      ? `${dose.value} ${dose.unit} täglich`
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
                          €{formatEuro(productMonthlyPrice(previewProduct))}
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
                        <p className="mt-1 text-lg font-black text-slate-950">€{formatEuro(product.price)}</p>
                      </div>
                      <div className="rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-3">
                        <p className="text-xs font-semibold text-emerald-700">Pro Monat</p>
                        <p className="mt-1 text-lg font-black text-emerald-700">
                          €{formatEuro(productMonthlyPrice(previewProduct))}
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
                Zurück zur Dosierung
              </button>
              {isDemo && (
                <p className="hidden items-center gap-2 text-sm font-semibold text-slate-500 sm:flex">
                  <Info size={18} />
                  Demo-Modus: Änderungen werden nach Neuladen zurückgesetzt.
                </p>
              )}
            </div>
          </>
        )}

        {duplicateIngredient && (
          <div className="ss-modal-overlay ss-duplicate-modal" role="dialog" aria-modal="true">
            <div className="ss-modal ss-restriction-modal">
              <div className="ss-modal-header">
                <h3 className="ss-modal-title">Dieser Wirkstoff ist bereits in deinem Stack vorhanden</h3>
                <button
                  type="button"
                  className="ss-modal-close"
                  onClick={() => setDuplicateIngredient(null)}
                  aria-label="Schließen"
                >
                  ×
                </button>
              </div>
              <div className="ss-existing-product-detail">
                <strong>{duplicateIngredient.product.name}</strong>
                {duplicateIngredient.product.brand && <span>{duplicateIngredient.product.brand}</span>}
                <small>
                  {duplicateIngredient.product.dosage_text ?? 'Dosierung nicht hinterlegt'}
                  {' · '}
                  {timingLabelForDisplay(duplicateIngredient.product.timing, timingOptions)}
                </small>
              </div>
              <div className="ss-modal-actions ss-modal-actions-stack">
                <button
                  type="button"
                  className="ss-modal-btn-save"
                  onClick={() => {
                    if (duplicateProductKey && onEditExistingProduct) {
                      onEditExistingProduct(duplicateProductKey);
                    }
                  }}
                >
                  Wirkstoffmengen bearbeiten
                </button>
                <button
                  type="button"
                  className="ss-modal-btn-cancel"
                  onClick={() => {
                    if (duplicateProductKey && onReplaceExistingProduct) {
                      onReplaceExistingProduct(duplicateProductKey);
                    }
                  }}
                >
                  Produkt ändern
                </button>
                <button
                  type="button"
                  className="ss-modal-btn-cancel"
                  onClick={() => setDuplicateIngredient(null)}
                >
                  So lassen
                </button>
                <button
                  type="button"
                  className="ss-modal-btn-save"
                  onClick={() => {
                    const selected = duplicateIngredient.ingredient;
                    setDuplicateIngredient(null);
                    startIngredientFlow(selected);
                  }}
                >
                  Trotzdem weiteres Produkt mit gleichem Wirkstoff hinzufügen
                </button>
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
  timingOptions,
}: {
  product: DemoProduct;
  onSave: (patch: Pick<DemoProduct, 'quantity' | 'dosage_text' | 'timing' | 'intake_interval_days'>) => Promise<void>;
  onReplace: () => void;
  onClose: () => void;
  timingOptions: IntakeTimingOption[];
}) {
  const [dosageText, setDosageText] = useState(product.dosage_text ?? '');
  const [timing, setTiming] = useState(product.timing ?? '');
  const [quantity, setQuantity] = useState(String(productServingsPerDay(product)));
  const [interval, setInterval] = useState(String(productIntakeIntervalDays(product)));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const managedTimingOptions = timingOptions;

  const intervalNumber = Number(interval);
  const intervalLabel = Number.isInteger(intervalNumber) && intervalNumber >= 1
    ? formatIntakeInterval(intervalNumber)
    : '';
  const timingHasManagedOption = managedTimingOptions.some((option) => option.value === timing);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const parsedQuantity = Number(quantity);
    const parsedInterval = Number(interval);
    if (!Number.isFinite(parsedQuantity) || parsedQuantity <= 0) {
      setError('Portionen pro Einnahmetag müssen größer als 0 sein.');
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
            aria-label="Schließen"
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
              placeholder="z.B. 2000 IE täglich"
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
            <select
              value={timing}
              onChange={(event) => setTiming(event.target.value)}
              className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-base font-semibold text-slate-950 shadow-sm focus:border-blue-400 focus:outline-none focus:ring-4 focus:ring-blue-100"
            >
              {!timingHasManagedOption && timing.trim() ? (
                <option value={timing}>{timingLabelForDisplay(timing, managedTimingOptions)}</option>
              ) : null}
              {managedTimingOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
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
            {saving ? 'Speichert...' : 'Änderungen speichern'}
          </button>
        </div>
      </form>
    </div>
  );
}

interface WorkspaceNotice {
  title: string;
  message: string;
  primaryLabel?: string;
  onPrimary?: () => void;
}

function WorkspaceNoticeModal({
  notice,
  onClose,
}: {
  notice: WorkspaceNotice;
  onClose: () => void;
}) {
  return (
    <div className="ss-modal-overlay ss-restriction-modal" role="dialog" aria-modal="true" onClick={onClose}>
      <div className="ss-modal" onClick={(event) => event.stopPropagation()}>
        <div className="ss-modal-header">
          <h3 className="ss-modal-title">{notice.title}</h3>
          <button type="button" className="ss-modal-close" onClick={onClose} aria-label="Schließen">
            ×
          </button>
        </div>
        <p className="ss-modal-copy">{notice.message}</p>
        <div className="ss-modal-actions">
          <button type="button" className="ss-modal-btn-cancel" onClick={onClose}>
            Abbrechen
          </button>
          <button
            type="button"
            className="ss-modal-btn-save"
            onClick={() => {
              const action = notice.onPrimary;
              onClose();
              if (action) action();
            }}
          >
            {notice.primaryLabel ?? 'Verstanden'}
          </button>
        </div>
      </div>
    </div>
  );
}

function ConfirmDeleteProductModal({
  productName,
  onConfirm,
  onCancel,
}: {
  productName?: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="ss-modal-overlay ss-confirm-modal" role="dialog" aria-modal="true" onClick={onCancel}>
      <div className="ss-modal" onClick={(event) => event.stopPropagation()}>
        <div className="ss-modal-header">
          <h3 className="ss-modal-title">Willst du dieses Produkt wirklich löschen?</h3>
          <button type="button" className="ss-modal-close" onClick={onCancel} aria-label="Schließen">
            ×
          </button>
        </div>
        {productName && <p className="ss-modal-copy">{productName}</p>}
        <div className="ss-modal-actions">
          <button type="button" className="ss-modal-btn-cancel" onClick={onCancel}>
            Abbrechen
          </button>
          <button type="button" className="ss-modal-btn-save ss-modal-btn-danger" onClick={onConfirm}>
            Ja, löschen
          </button>
        </div>
      </div>
    </div>
  );
}

function CategoryCreateModal({
  draft,
  status,
  isBusy,
  onDraftChange,
  onSubmit,
  onClose,
}: {
  draft: string;
  status: string;
  isBusy: boolean;
  onDraftChange: (value: string) => void;
  onSubmit: () => Promise<void>;
  onClose: () => void;
}) {
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isBusy) return;
    await onSubmit();
  };

  return (
    <div className="ss-modal-overlay" role="dialog" aria-modal="true" onClick={onClose}>
      <form className="ss-modal" onSubmit={submit} onClick={(event) => event.stopPropagation()}>
        <div className="ss-modal-header">
          <h3 className="ss-modal-title">Neue Kategorie</h3>
          <button type="button" className="ss-modal-close" onClick={onClose} aria-label="Schließen">
            ×
          </button>
        </div>
        <label className="ss-modal-label">
          Kategorie-Name
          <input
            value={draft}
            onChange={(event) => onDraftChange(event.target.value)}
            className="ss-modal-input mt-2"
            placeholder="z. B. Basis-Supplements"
            maxLength={80}
            disabled={isBusy}
          />
        </label>
        {status && <p className="ss-modal-copy text-red-700">{status}</p>}
        <div className="ss-modal-actions">
          <button type="button" className="ss-modal-btn-cancel" onClick={onClose}>
            Abbrechen
          </button>
          <button type="submit" className="ss-modal-btn-save" disabled={isBusy}>
            Erstellen
          </button>
        </div>
      </form>
    </div>
  );
}

function CategoryRenameModal({
  draft,
  status,
  isBusy,
  onDraftChange,
  onSubmit,
  onClose,
}: {
  draft: string;
  status: string;
  isBusy: boolean;
  onDraftChange: (value: string) => void;
  onSubmit: () => Promise<void>;
  onClose: () => void;
}) {
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isBusy) return;
    await onSubmit();
  };

  return (
    <div className="ss-modal-overlay" role="dialog" aria-modal="true" onClick={onClose}>
      <form className="ss-modal" onSubmit={submit} onClick={(event) => event.stopPropagation()}>
        <div className="ss-modal-header">
          <h3 className="ss-modal-title">Kategorie umbenennen</h3>
          <button type="button" className="ss-modal-close" onClick={onClose} aria-label="Schließen">
            ×
          </button>
        </div>
        <label className="ss-modal-label">
          Neuer Name
          <input
            value={draft}
            onChange={(event) => onDraftChange(event.target.value)}
            className="ss-modal-input mt-2"
            placeholder="Neuer Kategoriename"
            maxLength={80}
            disabled={isBusy}
          />
        </label>
        {status && <p className="ss-modal-copy text-red-700">{status}</p>}
        <div className="ss-modal-actions">
          <button type="button" className="ss-modal-btn-cancel" onClick={onClose}>
            Abbrechen
          </button>
          <button type="submit" className="ss-modal-btn-save" disabled={isBusy}>
            Speichern
          </button>
        </div>
      </form>
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
function IconPencil() {
  return <Pencil size={17} strokeWidth={2.2} />;
}
function IconMail() {
  return <Mail size={18} strokeWidth={2.1} />;
}
function IconPdf() {
  return <FileText size={18} strokeWidth={2.1} />;
}
function IconTrash() {
  return <Trash2 size={18} strokeWidth={2.1} />;
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
const STACK_PRODUCT_SORT_KEY = 'supplement-stack-product-sort';
const STACK_PRODUCT_CATEGORY_MODE_KEY = 'supplement-stack-product-category-mode';
const STACK_PRODUCT_LAYOUT_EDIT_MODE_KEY = 'supplement-stack-product-layout-edit-mode';
const CREATE_STACK_SELECT_VALUE = '__create_stack__';

function loadProductViewMode(): ProductViewMode {
  if (typeof window === 'undefined') return 'grid';
  return window.localStorage.getItem(STACK_PRODUCT_VIEW_KEY) === 'list' ? 'list' : 'grid';
}

function loadProductSortMode(): ProductSortMode {
  if (typeof window === 'undefined') return 'az';
  const raw = window.localStorage.getItem(STACK_PRODUCT_SORT_KEY);
  return raw === 'timing' || raw === 'custom' ? raw : 'az';
}

function loadProductCategoryMode(): ProductCategoryMode {
  if (typeof window === 'undefined') return 'none';
  const raw = window.localStorage.getItem(STACK_PRODUCT_CATEGORY_MODE_KEY);
  return raw === 'timing' || raw === 'custom' ? raw : 'none';
}

function loadProductLayoutEditMode(productSortMode: ProductSortMode, productCategoryMode: ProductCategoryMode): boolean {
  if (typeof window === 'undefined') return false;
  if (productSortMode !== 'custom' && productCategoryMode !== 'custom') return false;
  return window.localStorage.getItem(STACK_PRODUCT_LAYOUT_EDIT_MODE_KEY) === '1';
}

export function StackWorkspace({
  mode = 'demo',
  standaloneHeader,
  view = 'workspace',
}: StackWorkspaceProps) {
  const [state, setState] = useState<DemoState>(createDefaultState);
  const [descriptions, setDescriptions] = useState<Record<string, string>>(() =>
    mode === 'authenticated' ? loadDescriptions() : {},
  );
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editingProductKey, setEditingProductKey] = useState<string | null>(null);
  const [replaceProductKey, setReplaceProductKey] = useState<string | null>(null);
  const [shopDomains, setShopDomains] = useState<ShopDomain[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(mode === 'authenticated');
  const [error, setError] = useState('');
  const [emailSending, setEmailSending] = useState(false);
  const [emailStatus, setEmailStatus] = useState('');
  const [familyMembers, setFamilyMembers] = useState<FamilyMember[]>([]);
  const [familyFormOpen, setFamilyFormOpen] = useState(false);
  const [familyDraft, setFamilyDraft] = useState({ first_name: '', age: '', weight: '' });
  const [familySaving, setFamilySaving] = useState(false);
  const [familyStatus, setFamilyStatus] = useState('');
  const [linkReportStatus, setLinkReportStatus] = useState('');
  const [productViewMode, setProductViewMode] = useState<ProductViewMode>(loadProductViewMode);
  const [productSortMode, setProductSortMode] = useState<ProductSortMode>(loadProductSortMode);
  const [productCategoryMode, setProductCategoryMode] = useState<ProductCategoryMode>(loadProductCategoryMode);
  const [isLayoutEditMode, setIsLayoutEditMode] = useState(() =>
    loadProductLayoutEditMode(loadProductSortMode(), loadProductCategoryMode()),
  );
  const [managedTimingOptions, setManagedTimingOptions] = useState<IntakeTimingOption[]>([]);
  const [notice, setNotice] = useState<WorkspaceNotice | null>(null);
  const [deleteProductKey, setDeleteProductKey] = useState<string | null>(null);
  const [categoryDraft, setCategoryDraft] = useState('');
  const [categoryStatus, setCategoryStatus] = useState('');
  const [isCategoryCreateModalOpen, setIsCategoryCreateModalOpen] = useState(false);
  const [renamingCategory, setRenamingCategory] = useState<StackCategory | null>(null);
  const [categoryRenameDraft, setCategoryRenameDraft] = useState('');
  const [isCategoryActionBusy, setIsCategoryActionBusy] = useState(false);
  const [draggingProductKey, setDraggingProductKey] = useState<string | null>(null);
  const [productLayoutDropSlot, setProductLayoutDropSlot] = useState<ProductLayoutDropSlot | null>(null);
  const [productLayoutPreviewProducts, setProductLayoutPreviewProducts] = useState<DemoProduct[] | null>(null);
  const productItemRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const productSectionRefs = useRef<Map<string, HTMLElement>>(new Map());
  const productItemRectsRef = useRef<Map<string, DOMRect>>(new Map());
  const productLayoutAnimationsRef = useRef<Map<string, Animation>>(new Map());
  const productPointerDragRef = useRef<ProductPointerDragState | null>(null);
  const productLayoutPreviewProductsRef = useRef<DemoProduct[] | null>(null);
  const suppressProductClickRef = useRef(false);
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const cockpitUserLabel = getUserDisplayName(user);

  const isDemo = mode === 'demo';
  const showStandaloneHeader = standaloneHeader ?? isDemo;
  const editTimingOptions = useMemo(() => buildIntakeTimingOptions(managedTimingOptions), [managedTimingOptions]);

  useEffect(() => {
    window.localStorage.setItem(STACK_PRODUCT_VIEW_KEY, productViewMode);
  }, [productViewMode]);

  useEffect(() => {
    window.localStorage.setItem(STACK_PRODUCT_SORT_KEY, productSortMode);
  }, [productSortMode]);

  useEffect(() => {
    window.localStorage.setItem(STACK_PRODUCT_CATEGORY_MODE_KEY, productCategoryMode);
  }, [productCategoryMode]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(STACK_PRODUCT_LAYOUT_EDIT_MODE_KEY, isLayoutEditMode ? '1' : '0');
  }, [isLayoutEditMode]);

  useEffect(() => {
    if (productSortMode !== 'custom' && productCategoryMode !== 'custom') {
      setIsLayoutEditMode(false);
    }
  }, [productSortMode, productCategoryMode]);

  const isProductLayoutEditMode = isLayoutEditMode && (productSortMode === 'custom' || productCategoryMode === 'custom');
  const isCustomLayoutControlsVisible = productSortMode === 'custom' || productCategoryMode === 'custom';
  const showSortLayoutEditToggle = productSortMode === 'custom';
  const showCategoryLayoutEditToggle = productCategoryMode === 'custom' && productSortMode !== 'custom';

  const isInteractiveDragSource = useCallback((target: EventTarget | null): boolean => {
    if (!(target instanceof Element)) return false;
    return target.closest('button, a, input, select, textarea, [role="button"], [role="link"], label, summary, [contenteditable="true"], [data-no-drag="true"]') !== null;
  }, []);

  const handleToggleProductLayoutEditMode = useCallback(() => {
    setIsLayoutEditMode((current) => !current);
  }, []);

  useEffect(() => {
    let cancelled = false;
    getPublicIntakeTimings()
      .then((items) => {
        if (cancelled) return;
        setManagedTimingOptions(items);
      })
      .catch(() => {
        if (!cancelled) setManagedTimingOptions([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

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
      setFamilyStatus('Familienprofile konnten nicht geladen werden.');
    }
  }, [mode]);

  const persistStackProducts = useCallback(
    async (stackId: string, products: DemoProduct[], categories: StackCategory[], name?: string): Promise<DemoStack | null> => {
      if (mode !== 'authenticated') return null;
      const normalizedProducts = applySequentialSortOrder(products);
      const payload = {
        ...(name ? { name } : {}),
        product_ids: normalizedProducts.map((product) => ({
          id: product.id,
          product_type: product.product_type ?? 'catalog',
          quantity: productServingsPerDay(product),
          intake_interval_days: productIntakeIntervalDays(product),
          dosage_text: product.dosage_text,
          timing: product.timing,
          sort_order: product.sort_order,
          category_id: toApiCategoryId(product.category_id),
        })),
      };
      const res = await credentialedFetch(apiPath(`/stacks/${stackId}`), {
        method: 'PUT',
        headers: JSON_HEADERS,
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({})) as unknown;
      const dataRecord = data && typeof data === 'object' ? data as Record<string, unknown> : {};
      if (!res.ok) {
        const errorMessage = typeof dataRecord.error === 'string' ? dataRecord.error : 'Stack konnte nicht gespeichert werden.';
        throw new Error(errorMessage);
      }
      const responseStack = dataRecord.stack && typeof dataRecord.stack === 'object'
        ? dataRecord.stack as Record<string, unknown>
        : dataRecord;
      const items = Array.isArray(dataRecord.items)
        ? dataRecord.items
        : Array.isArray(responseStack.items)
          ? responseStack.items
          : Array.isArray(dataRecord.products)
            ? dataRecord.products
            : Array.isArray(responseStack.products)
              ? responseStack.products
              : normalizedProducts;
      const persistedCategories = Array.isArray(dataRecord.categories)
        ? dataRecord.categories
        : Array.isArray(responseStack.categories)
          ? responseStack.categories
          : categories;
      const fallbackName = typeof name === 'string' && name.trim()
        ? name.trim()
        : (typeof responseStack.name === 'string' && responseStack.name.trim() ? responseStack.name : `Stack ${stackId}`);
      return normalizeStackWithLayout(
        mapStackDetail(
          {
            id: (responseStack.id as number | string | undefined) ?? stackId,
            name: fallbackName,
            family_member_id: (responseStack.family_member_id as number | null | undefined) ?? null,
            family_member_first_name: (responseStack.family_member_first_name as string | null | undefined) ?? null,
          },
          {
            ...dataRecord,
            items,
            categories: persistedCategories,
          },
        ),
      );
    },
    [mode],
  );

  const persistStackLayout = useCallback(
    async (stackId: string, products: DemoProduct[]) => {
      if (mode !== 'authenticated') return;
      const normalizedProducts = applySequentialSortOrder(products);
      const missingStackItemId = normalizedProducts.some((product) => !Number.isFinite(product.stack_item_id));
      if (missingStackItemId) {
        throw new Error('Layout konnte nicht gespeichert werden, da die Stack-Elemente noch nicht synchronisiert sind. Bitte neu laden.');
      }
      const items = normalizedProducts
        .map((product) => ({
          stack_item_id: product.stack_item_id as number,
          sort_order: product.sort_order ?? 0,
          category_id: toApiCategoryId(product.category_id),
        }));
      await updateStackItemsLayout(stackId, { items });
    },
    [mode],
  );

  const prepareProductsForAuthenticatedImport = useCallback(
    async (
      stackId: string,
      products: DemoProduct[],
      categories: StackCategory[],
      existingCategories: StackCategory[],
    ): Promise<{ products: DemoProduct[]; categories: StackCategory[] }> => {
      const knownCategories = normalizeStackCategories(stackId, existingCategories);
      const categoryByName = new Map<string, StackCategory>();
      for (const category of knownCategories) {
        if (category.is_default) continue;
        categoryByName.set(categoryNameKey(category.name), category);
      }

      const categoryIdMap = new Map<string, number | string>();
      for (const category of normalizeStackCategories(stackId, categories)) {
        if (category.is_default) continue;
        const normalizedId = normalizedCategoryId(category.id);
        const apiCategoryId = toApiCategoryId(category.id);
        if (apiCategoryId !== undefined) {
          const existingById = knownCategories.find((entry) => (
            normalizedCategoryId(entry.id) === normalizedCategoryId(apiCategoryId)
          ));
          if (existingById) {
            categoryIdMap.set(normalizedId, existingById.id);
            continue;
          }
        }

        const existingMatch = categoryByName.get(categoryNameKey(category.name));
        if (existingMatch) {
          categoryIdMap.set(normalizedId, existingMatch.id);
          continue;
        }

        const created = await createStackCategory(stackId, {
          name: category.name,
          sort_order: knownCategories.length,
        });
        const mappedCategory: StackCategory = {
          id: created.id,
          stack_id: created.stack_id,
          name: created.name,
          sort_order: created.sort_order,
          is_default: created.is_default,
        };
        knownCategories.push(mappedCategory);
        categoryByName.set(categoryNameKey(mappedCategory.name), mappedCategory);
        categoryIdMap.set(normalizedId, mappedCategory.id);
      }

      const mappedProducts = applySequentialSortOrder(products).map((product) => {
        const mappedCategoryId = categoryIdMap.get(normalizedCategoryId(product.category_id));
        if (mappedCategoryId === undefined) return product;
        const mappedCategory = knownCategories.find((category) => (
          normalizedCategoryId(category.id) === normalizedCategoryId(mappedCategoryId)
        ));
        return {
          ...product,
          category_id: mappedCategoryId,
          category_name: mappedCategory?.name ?? product.category_name,
          category_is_default: mappedCategory?.is_default ?? false,
        };
      });

      return {
        products: mappedProducts,
        categories: knownCategories,
      };
    },
    [],
  );

  const consumePendingDemoStackHandoff = useCallback(
    async (loadedStacks: DemoStack[]) => {
      const snapshot = loadDemoStackHandoff();
      if (!snapshot) return null;
      const importCandidates = snapshot.stacks
        .filter((stack) => stack.products.length > 0)
        .sort((left, right) => {
          if (left.id === snapshot.active_stack_id) return -1;
          if (right.id === snapshot.active_stack_id) return 1;
          return 0;
        });
      if (importCandidates.length === 0) {
        clearDemoStackHandoff();
        return null;
      }

      const nextStacks = [...loadedStacks];
      let activeStackId = '';

      for (const candidate of importCandidates) {
        const existing = findExistingImportedStack(nextStacks, candidate);
        let importedStack: DemoStack;

        if (existing) {
          const candidateCategories = normalizeStackCategories(existing.id, candidate.categories ?? existing.categories);
          const preparedImport = await prepareProductsForAuthenticatedImport(
            existing.id,
            candidate.products,
            candidateCategories,
            existing.categories,
          );
          importedStack = {
            ...existing,
            name: candidate.name,
            products: preparedImport.products,
            categories: preparedImport.categories,
          };
          importedStack = normalizeStackWithLayout(importedStack);
          const persistedStack = await persistStackProducts(
            importedStack.id,
            importedStack.products,
            importedStack.categories,
            importedStack.name,
          );
          if (persistedStack) {
            importedStack = persistedStack;
          }
          const existingIndex = nextStacks.findIndex((stack) => stack.id === existing.id);
          if (existingIndex >= 0) nextStacks[existingIndex] = importedStack;
        } else {
          const res = await credentialedFetch(apiPath('/stacks'), {
            method: 'POST',
            headers: JSON_HEADERS,
            body: JSON.stringify({ name: candidate.name, product_ids: [] }),
          });
          const data = await res.json().catch(() => ({})) as Record<string, unknown>;
          if (!res.ok) {
            throw new Error(typeof data.error === 'string' ? data.error : 'Demo-Stack konnte nicht importiert werden.');
          }
          const createdStack = (data.stack ?? data) as {
            id: number | string;
            name: string;
            family_member_id?: number | null;
            family_member_first_name?: string | null;
          };
          const mappedCreatedStack = mapStackDetail(createdStack);
          const candidateCategories = normalizeStackCategories(mappedCreatedStack.id, candidate.categories ?? mappedCreatedStack.categories);
          const preparedImport = await prepareProductsForAuthenticatedImport(
            mappedCreatedStack.id,
            candidate.products,
            candidateCategories,
            mappedCreatedStack.categories,
          );
          importedStack = {
            ...mappedCreatedStack,
            name: candidate.name,
            products: preparedImport.products,
            categories: preparedImport.categories,
          };
          importedStack = normalizeStackWithLayout(importedStack);
          const persistedStack = await persistStackProducts(
            importedStack.id,
            importedStack.products,
            importedStack.categories,
            importedStack.name,
          );
          if (persistedStack) {
            importedStack = persistedStack;
          }
          nextStacks.push(importedStack);
        }

        if (candidate.description) {
          saveDescription(importedStack.id, candidate.description);
        }
        if (candidate.id === snapshot.active_stack_id) {
          activeStackId = importedStack.id;
        }
      }

      clearDemoStackHandoff();
      return {
        stacks: nextStacks,
        activeStackId: activeStackId || nextStacks[nextStacks.length - 1]?.id || '',
      };
    },
    [persistStackProducts, prepareProductsForAuthenticatedImport],
  );

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

      const detailedRaw = await Promise.all(
        stackList.map(async (stack) => {
          const detailRes = await credentialedFetch(apiPath(`/stacks/${stack.id}`), {
            headers: JSON_HEADERS,
          });
          if (!detailRes.ok) return mapStackDetail(stack);
          const detail = await detailRes.json();
          return mapStackDetail(stack, detail);
        }),
      );
      const detailed = detailedRaw.map(normalizeStackWithLayout);

      const imported = await consumePendingDemoStackHandoff(detailed);
      if (imported) {
        setState({
          stacks: imported.stacks.map(normalizeStackWithLayout),
          activeStackId: imported.activeStackId,
        });
        const selectedStack = imported.stacks.find((stack) => stack.id === imported.activeStackId) ?? imported.stacks[0];
        setSelectedIds(new Set((selectedStack?.products ?? []).map(productStackKey)));
        return;
      }

      if (detailed.length === 0) {
        const createRes = await credentialedFetch(apiPath('/stacks'), {
          method: 'POST',
          headers: JSON_HEADERS,
          body: JSON.stringify({ name: 'Basis Gesundheit', product_ids: [] }),
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
  }, [consumePendingDemoStackHandoff, mode]);

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
        const defaultCategory = fresh.stacks[0].categories[0];
        const normalizedProducts = applySequentialSortOrder(products).map((product) => ({
          ...product,
          category_id: defaultCategory.id,
          category_name: defaultCategory.name,
          category_is_default: true,
        }));
        setState({
          stacks: [{ ...fresh.stacks[0], products: normalizedProducts }],
          activeStackId: fresh.activeStackId,
        });
        setSelectedIds(new Set(normalizedProducts.map(productStackKey)));
      })
      .catch(() => setState(fresh));
  }, [loadAuthenticatedStacks, loadFamilyProfiles, mode]);

  const activeStack = state.stacks.find((s) => s.id === state.activeStackId) ?? state.stacks[0];

  const handleRegisterFromDemo = useCallback(() => {
    if (isDemo) {
      persistDemoStackHandoff(state, descriptions);
    }
    navigate('/register', {
      state: {
        redirect: '/stacks',
        demoStackHandoffKey: SS_DEMO_STACK_HANDOFF_KEY,
      },
    });
  }, [descriptions, isDemo, navigate, state]);

  const openDemoRestriction = useCallback(
    (title: string, message = DEMO_NOTICE) => {
      setNotice({
        title,
        message,
        primaryLabel: 'Jetzt anmelden',
        onPrimary: handleRegisterFromDemo,
      });
    },
    [handleRegisterFromDemo],
  );

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

  const handleAssignFamilyMember = useCallback(
    async (familyMemberId: number | null) => {
      if (!activeStack) return;
      if (mode !== 'authenticated') {
        setFamilyStatus('Familienprofile sind nur angemeldet verfügbar.');
        return;
      }
      setFamilyStatus('');
      try {
        const res = await credentialedFetch(apiPath(`/stacks/${activeStack.id}`), {
          method: 'PUT',
          headers: JSON_HEADERS,
          body: JSON.stringify({ family_member_id: familyMemberId }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error ?? 'Profil konnte nicht zugeordnet werden.');
        const selectedMember = familyMembers.find((member) => member.id === familyMemberId);
        setState((prev) => ({
          ...prev,
          stacks: prev.stacks.map((stack) => (
            stack.id === activeStack.id
              ? {
                  ...stack,
                  family_member_id: familyMemberId,
                  family_member_first_name: selectedMember?.first_name ?? null,
                }
              : stack
          )),
        }));
      } catch (err) {
        setFamilyStatus(err instanceof Error ? err.message : 'Profil konnte nicht zugeordnet werden.');
      }
    },
    [activeStack, familyMembers, mode],
  );

  const handleSaveStackFamilyMember = useCallback(
    async (familyMemberId: number | null) => {
      if (!activeStack) return;
      if (mode !== 'authenticated') {
        throw new Error('Familienprofile sind nur angemeldet verfügbar.');
      }
      setFamilyStatus('');
      const res = await credentialedFetch(apiPath(`/stacks/${activeStack.id}`), {
        method: 'PUT',
        headers: JSON_HEADERS,
        body: JSON.stringify({ family_member_id: familyMemberId }),
      });
      const data = await res.json().catch(() => ({})) as Record<string, unknown>;
      if (!res.ok) {
        throw new Error(typeof data.error === 'string' ? data.error : 'Profil konnte nicht zugeordnet werden.');
      }
      const selectedMember = familyMembers.find((member) => member.id === familyMemberId);
      setState((prev) => ({
        ...prev,
        stacks: prev.stacks.map((stack) => (
          stack.id === activeStack.id
            ? {
                ...stack,
                family_member_id: familyMemberId,
                family_member_first_name: selectedMember?.first_name ?? null,
              }
            : stack
        )),
      }));
    },
    [activeStack, familyMembers, mode],
  );

  const handleCreateFamilyMember = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (mode !== 'authenticated') {
        setFamilyStatus('Familienprofile sind nur angemeldet verfügbar.');
        return;
      }
      const firstName = familyDraft.first_name.trim();
      const age = familyDraft.age.trim() ? Number(familyDraft.age) : null;
      const weight = familyDraft.weight.trim() ? Number(familyDraft.weight) : null;
      if (!firstName) {
        setFamilyStatus('Bitte gib einen Vornamen ein.');
        return;
      }
      if (age !== null && (!Number.isInteger(age) || age < 0 || age > 120)) {
        setFamilyStatus('Alter muss zwischen 0 und 120 liegen.');
        return;
      }
      if (weight !== null && (!Number.isFinite(weight) || weight <= 0 || weight > 300)) {
        setFamilyStatus('Gewicht muss zwischen 1 und 300 kg liegen.');
        return;
      }

      setFamilySaving(true);
      setFamilyStatus('');
      try {
        const member = await createFamilyMember({ first_name: firstName, age, weight });
        setFamilyMembers((prev) => [...prev, member]);
        setFamilyDraft({ first_name: '', age: '', weight: '' });
        setFamilyFormOpen(false);
        if (activeStack) {
          await handleAssignFamilyMember(member.id);
          setState((prev) => ({
            ...prev,
            stacks: prev.stacks.map((stack) => (
              stack.id === activeStack.id
                ? { ...stack, family_member_id: member.id, family_member_first_name: member.first_name }
                : stack
            )),
          }));
        }
      } catch (err) {
        setFamilyStatus(err instanceof Error ? err.message : 'Familienprofil konnte nicht gespeichert werden.');
      } finally {
        setFamilySaving(false);
      }
    },
    [activeStack, familyDraft, handleAssignFamilyMember, mode],
  );

  const handleDeleteFamilyMember = useCallback(
    async (memberId: number) => {
      if (mode !== 'authenticated') return;
      const member = familyMembers.find((item) => item.id === memberId);
      if (!member || !window.confirm(`Profil "${member.first_name}" entfernen?`)) return;
      setFamilyStatus('');
      try {
        await deleteFamilyMember(memberId);
        setFamilyMembers((prev) => prev.filter((item) => item.id !== memberId));
        setState((prev) => ({
          ...prev,
          stacks: prev.stacks.map((stack) => (
            stack.family_member_id === memberId
              ? { ...stack, family_member_id: null, family_member_first_name: null }
              : stack
          )),
        }));
      } catch (err) {
        setFamilyStatus(err instanceof Error ? err.message : 'Familienprofil konnte nicht entfernt werden.');
      }
    },
    [familyMembers, mode],
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

  const handleCreateStack = useCallback(async () => {
    const id = newStackId();
    const name = `Stack ${state.stacks.length + 1}`;
    if (mode === 'authenticated') {
      try {
        const res = await credentialedFetch(apiPath('/stacks'), {
          method: 'POST',
          headers: JSON_HEADERS,
          body: JSON.stringify({ name, product_ids: [] }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error ?? 'Stack konnte nicht erstellt werden.');
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
      stacks: [...prev.stacks, { id, name, products: [], categories: [createDefaultCategory(id)] }],
      activeStackId: id,
    }));
  }, [mode, state.stacks.length]);

  const handleStackSelectChange = useCallback(
    (event: ChangeEvent<HTMLSelectElement>) => {
      const nextStackId = event.target.value;
      if (nextStackId === CREATE_STACK_SELECT_VALUE) {
        void handleCreateStack();
        return;
      }
      setState((prev) => ({ ...prev, activeStackId: nextStackId }));
    },
    [handleCreateStack],
  );

  const handleDeleteStack = useCallback(
    async (id: string) => {
      if (state.stacks.length <= 1) {
        if (isDemo) openDemoRestriction('Stack löschen ist in der Demo nicht verfügbar.');
        else setError('Der letzte Stack kann nicht gelöscht werden.');
        return;
      }
      const stack = state.stacks.find((s) => s.id === id);
      if (!stack) return;
      if (!window.confirm(`Stack "${stack.name}" wirklich löschen?`)) return;
      if (mode === 'authenticated') {
        try {
          const res = await credentialedFetch(apiPath(`/stacks/${id}`), {
            method: 'DELETE',
            headers: JSON_HEADERS,
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
        if (mode === 'authenticated') saveDescription(id, '');
        return next;
      });
    },
    [isDemo, mode, openDemoRestriction, state.stacks],
  );

  const handleSaveStackMeta = useCallback(
    async (newName: string, newDescription: string) => {
      if (!activeStack) return;
      const prevName = activeStack.name;
      let persistedStack: DemoStack | null = null;
      if (mode === 'authenticated' && newName !== prevName) {
        persistedStack = await persistStackProducts(activeStack.id, activeStack.products, activeStack.categories, newName);
      }
      setState((prev) => ({
        ...prev,
        stacks: prev.stacks.map((stack) => {
          if (stack.id !== activeStack.id) return stack;
          if (persistedStack) return persistedStack;
          return { ...stack, name: newName };
        }),
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
    [activeStack, mode, persistStackProducts],
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
      const defaultCategory = targetStack.categories.find((category) => category.is_default) ?? targetStack.categories[0] ?? createDefaultCategory(targetStackId);
      const nextProduct = {
        ...product,
        category_id: product.category_id ?? defaultCategory.id,
        category_name: product.category_name ?? defaultCategory.name,
        category_is_default: product.category_is_default ?? defaultCategory.is_default,
      };
      const nextProducts = applySequentialSortOrder([...targetStack.products, nextProduct]);
      let persistedStack: DemoStack | null = null;
      if (mode === 'authenticated') {
        try {
          persistedStack = await persistStackProducts(targetStackId, nextProducts, targetStack.categories);
        } catch (err) {
          setError(err instanceof Error ? err.message : 'Produkt konnte nicht gespeichert werden.');
          void loadAuthenticatedStacks();
          throw err;
        }
      }
      setState((prev) => ({
        ...prev,
        stacks: prev.stacks.map((s) =>
          s.id === targetStackId ? (persistedStack ?? { ...s, products: nextProducts }) : s,
        ),
      }));
      setSelectedIds((prev) => {
        const next = new Set(prev);
        next.add(productStackKey(nextProduct));
        return next;
      });
    },
    [loadAuthenticatedStacks, mode, persistStackProducts, state.activeStackId, state.stacks],
  );

  const handleRemoveProduct = useCallback(
    async (productKey: string) => {
      if (!activeStack) return;
      const nextProducts = applySequentialSortOrder(activeStack.products.filter((p) => productStackKey(p) !== productKey));
      let persistedStack: DemoStack | null = null;
      if (mode === 'authenticated') {
        try {
          persistedStack = await persistStackProducts(activeStack.id, nextProducts, activeStack.categories);
        } catch (err) {
          setError(err instanceof Error ? err.message : 'Produkt konnte nicht entfernt werden.');
          void loadAuthenticatedStacks();
          return;
        }
      }
      setState((prev) => ({
        ...prev,
        stacks: prev.stacks.map((s) =>
          s.id === prev.activeStackId ? (persistedStack ?? { ...s, products: nextProducts }) : s,
        ),
      }));
    },
    [activeStack, loadAuthenticatedStacks, mode, persistStackProducts],
  );

  const handleSaveProduct = useCallback(
    async (productKey: string, productPatch: Pick<DemoProduct, 'quantity' | 'dosage_text' | 'timing' | 'intake_interval_days'>) => {
      if (!activeStack) return;
      const nextProducts = applySequentialSortOrder(activeStack.products.map((product) =>
        productStackKey(product) === productKey ? { ...product, ...productPatch } : product,
      ));
      let persistedStack: DemoStack | null = null;
      if (mode === 'authenticated') {
        try {
          persistedStack = await persistStackProducts(activeStack.id, nextProducts, activeStack.categories);
        } catch (err) {
          setError(err instanceof Error ? err.message : 'Produkt konnte nicht gespeichert werden.');
          void loadAuthenticatedStacks();
          return;
        }
      }
      setState((prev) => ({
        ...prev,
        stacks: prev.stacks.map((stack) =>
          stack.id === prev.activeStackId ? (persistedStack ?? { ...stack, products: nextProducts }) : stack,
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
          'Die bisherige Dosierung wird für das neue Produkt übernommen. Produktform oder Stärke können abweichen. Bitte prüfe die Dosierung nach dem Ersetzen. Trotzdem ersetzen?'
        );
        if (!confirmed) return;
      }
      const candidate: DemoProduct = {
        ...replacement,
        dosage_text: preservedDosage,
        timing: preservedTiming,
        intake_interval_days: preservedInterval,
        category_id: previousProduct.category_id ?? replacement.category_id,
        category_name: previousProduct.category_name ?? replacement.category_name,
        category_is_default: previousProduct.category_is_default ?? replacement.category_is_default,
      };
      const quantityFromDose = productServingsFromDose(candidate);
      candidate.quantity = quantityFromDose ?? previousProduct.quantity ?? productServingsPerDay(candidate);

      const nextProducts = applySequentialSortOrder(targetStack.products.map((product) =>
        productStackKey(product) === replaceProductKey ? candidate : product,
      ));
      let persistedStack: DemoStack | null = null;
      if (mode === 'authenticated') {
        try {
          persistedStack = await persistStackProducts(targetStackId, nextProducts, targetStack.categories);
        } catch (err) {
          setError(err instanceof Error ? err.message : 'Produkt konnte nicht ersetzt werden.');
          void loadAuthenticatedStacks();
          throw err;
        }
      }

      setState((prev) => ({
        ...prev,
        stacks: prev.stacks.map((stack) =>
          stack.id === targetStackId ? (persistedStack ?? { ...stack, products: nextProducts }) : stack,
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
  const activeCategories = useMemo(
    () => activeStack?.categories ?? [createDefaultCategory(activeStack?.id ?? 'stack')],
    [activeStack],
  );
  const activeProducts = useMemo(
    () => applySequentialSortOrder(activeStack?.products ?? []),
    [activeStack],
  );
  const displayedProducts = productLayoutPreviewProducts ?? activeProducts;
  const productSections = useMemo(
    () => buildProductSections(displayedProducts, activeCategories, productSortMode, productCategoryMode),
    [activeCategories, displayedProducts, productCategoryMode, productSortMode],
  );
  const productSectionTargets = useMemo<ProductLayoutSectionTarget[]>(
    () => productSections.map((section) => ({
      id: section.id,
      categoryId: section.categoryId,
      productKeys: section.products.map(productStackKey),
    })),
    [productSections],
  );
  useEffect(() => {
    productLayoutPreviewProductsRef.current = productLayoutPreviewProducts;
  }, [productLayoutPreviewProducts]);
  const totalOnce = selectedProducts.reduce((sum, p) => sum + (p.price ?? 0), 0);
  const totalMonthly = selectedProducts.reduce((sum, p) => sum + productMonthlyPrice(p), 0);
  const productsCount = activeProducts.length;
  const allSelected = productsCount > 0 && selectedIds.size === productsCount;
  const hasOpenModal =
    addModalOpen ||
    editModalOpen ||
    isCategoryCreateModalOpen ||
    renamingCategory !== null ||
    editingProductKey !== null ||
    replaceProductKey !== null ||
    deleteProductKey !== null;
  const bottomBarVisible = productsCount > 0 && !hasOpenModal;

  useEffect(() => {
    document.body.classList.toggle('ss-stack-bottom-bar-active', bottomBarVisible);
    return () => {
      document.body.classList.remove('ss-stack-bottom-bar-active');
    };
  }, [bottomBarVisible]);

  const routineGroups = useMemo(() => {
    const groups: Record<RoutineKey, DemoProduct[]> = {
      morning: [],
      noon: [],
      evening: [],
      flexible: [],
    };
    for (const product of activeProducts) {
      groups[routineKeyForTiming(product.timing)].push(product);
    }
    return groups;
  }, [activeProducts]);

  const setActiveStackProducts = useCallback(
    (nextProducts: DemoProduct[]) => {
      if (!activeStack) return;
      const normalizedProducts = applySequentialSortOrder(nextProducts);
      setState((prev) => ({
        ...prev,
        stacks: prev.stacks.map((stack) =>
          stack.id === activeStack.id ? { ...stack, products: normalizedProducts } : stack,
        ),
      }));
    },
    [activeStack],
  );

  const setActiveStackCategories = useCallback(
    (nextCategories: StackCategory[]) => {
      if (!activeStack) return;
      const normalizedCategories = normalizeStackCategories(activeStack.id, nextCategories);
      setState((prev) => ({
        ...prev,
        stacks: prev.stacks.map((stack) =>
          stack.id === activeStack.id ? normalizeStackWithLayout({ ...stack, categories: normalizedCategories }) : stack,
        ),
      }));
    },
    [activeStack],
  );

  const persistCustomLayout = useCallback(
    async (nextProducts: DemoProduct[]) => {
      if (!activeStack) return;
      const normalizedProducts = applySequentialSortOrder(nextProducts);
      setActiveStackProducts(normalizedProducts);
      if (mode !== 'authenticated') return;
      try {
        await persistStackLayout(activeStack.id, normalizedProducts);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Layout konnte nicht gespeichert werden.');
        void loadAuthenticatedStacks();
      }
    },
    [activeStack, loadAuthenticatedStacks, mode, persistStackLayout, setActiveStackProducts],
  );

  const setProductItemRef = useCallback((productKey: string, node: HTMLDivElement | null) => {
    if (node) {
      productItemRefs.current.set(productKey, node);
      return;
    }
    productItemRefs.current.delete(productKey);
  }, []);

  const setProductSectionRef = useCallback((sectionId: string, node: HTMLElement | null) => {
    if (node) {
      productSectionRefs.current.set(sectionId, node);
      return;
    }
    productSectionRefs.current.delete(sectionId);
  }, []);

  const readProductLayoutMeasurements = useCallback((): ProductLayoutMeasuredSection[] => (
    productSectionTargets
      .map((section) => {
        const sectionNode = productSectionRefs.current.get(section.id);
        if (!sectionNode) return null;
        const items = section.productKeys
          .map((productKey) => {
            const productNode = productItemRefs.current.get(productKey);
            if (!productNode) return null;
            return {
              productKey,
              rect: productNode.getBoundingClientRect(),
            };
          })
          .filter((item): item is ProductLayoutMeasuredItem => item !== null);

        return {
          ...section,
          rect: sectionNode.getBoundingClientRect(),
          items,
        };
      })
      .filter((section): section is ProductLayoutMeasuredSection => section !== null)
  ), [productSectionTargets]);

  const captureProductLayoutRects = useCallback(() => {
    const rects = new Map<string, DOMRect>();
    productItemRefs.current.forEach((node, productKey) => {
      rects.set(productKey, node.getBoundingClientRect());
    });
    productItemRectsRef.current = rects;
  }, []);

  const cancelProductLayoutAnimations = useCallback(() => {
    productLayoutAnimationsRef.current.forEach((animation) => animation.cancel());
    productLayoutAnimationsRef.current.clear();
  }, []);

  useLayoutEffect(() => {
    const previousRects = productItemRectsRef.current;
    if (previousRects.size === 0) return;
    productItemRectsRef.current = new Map();

    productItemRefs.current.forEach((node, productKey) => {
      if (draggingProductKey === productKey) return;
      const previousRect = previousRects.get(productKey);
      if (!previousRect) return;
      const nextRect = node.getBoundingClientRect();
      const deltaX = previousRect.left - nextRect.left;
      const deltaY = previousRect.top - nextRect.top;
      if (Math.abs(deltaX) < 1 && Math.abs(deltaY) < 1) return;

      productLayoutAnimationsRef.current.get(productKey)?.cancel();
      const animation = node.animate(
        [
          { transform: `translate(${deltaX}px, ${deltaY}px)` },
          { transform: 'translate(0, 0)' },
        ],
        { duration: 180, easing: 'ease-out' },
      );
      productLayoutAnimationsRef.current.set(productKey, animation);
      animation.onfinish = () => {
        if (productLayoutAnimationsRef.current.get(productKey) === animation) {
          productLayoutAnimationsRef.current.delete(productKey);
        }
      };
      animation.oncancel = animation.onfinish;
    });
  }, [draggingProductKey, productSections]);

  useEffect(() => cancelProductLayoutAnimations, [cancelProductLayoutAnimations]);

  const clearProductLayoutPreview = useCallback(() => {
    productPointerDragRef.current = null;
    suppressProductClickRef.current = false;
    setDraggingProductKey(null);
    setProductLayoutDropSlot(null);
    productLayoutPreviewProductsRef.current = null;
    setProductLayoutPreviewProducts(null);
    productItemRectsRef.current = new Map();
    cancelProductLayoutAnimations();
  }, [cancelProductLayoutAnimations]);

  useEffect(() => {
    if (!isProductLayoutEditMode) {
      clearProductLayoutPreview();
    }
  }, [clearProductLayoutPreview, isProductLayoutEditMode]);

  useEffect(() => {
    clearProductLayoutPreview();
  }, [activeStack?.id, clearProductLayoutPreview]);

  const previewProductLayoutPlacement = useCallback(
    (
      productKey: string,
      targetProductKey: string | null,
      targetCategoryId: number | string | null,
      placement: ProductLayoutDropPlacement,
      targetSectionId: string | null,
      targetSectionProductKeys: string[] = [],
    ): DemoProduct[] | null => {
      if (!activeStack) return null;
      const baseProducts = productLayoutPreviewProductsRef.current ?? productLayoutPreviewProducts ?? activeProducts;
      const nextProducts = previewProductLayoutProducts(
        baseProducts,
        activeCategories,
        productCategoryMode,
        activeStack.id,
        productKey,
        targetProductKey,
        targetCategoryId,
        placement,
        targetSectionId,
        targetSectionProductKeys,
        productSectionTargets,
      );
      if (productLayoutProductsEqual(baseProducts, nextProducts)) return nextProducts;
      captureProductLayoutRects();
      productLayoutPreviewProductsRef.current = nextProducts;
      setProductLayoutPreviewProducts((currentProducts) => (
        productLayoutProductsEqual(currentProducts ?? activeProducts, nextProducts) ? currentProducts : nextProducts
      ));
      return nextProducts;
    },
    [
      activeCategories,
      activeProducts,
      activeStack,
      captureProductLayoutRects,
      productCategoryMode,
      productLayoutPreviewProducts,
      productSectionTargets,
    ],
  );

  const commitProductLayoutPreview = useCallback(
    async (fallbackProducts: DemoProduct[] | null = null) => {
      const nextProducts = fallbackProducts ?? productLayoutPreviewProductsRef.current ?? productLayoutPreviewProducts;
      productPointerDragRef.current = null;
      setDraggingProductKey(null);
      setProductLayoutDropSlot(null);
      productLayoutPreviewProductsRef.current = null;
      setProductLayoutPreviewProducts(null);
      productItemRectsRef.current = new Map();
      if (!nextProducts) return;
      await persistCustomLayout(nextProducts);
    },
    [persistCustomLayout, productLayoutPreviewProducts],
  );

  const handleProductPointerDown = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>, productKey: string) => {
      if (!isProductLayoutEditMode || event.button !== 0) return;
      const target = event.target as HTMLElement | null;
      if (!target || isInteractiveDragSource(target)) return;

      captureProductLayoutRects();
      productPointerDragRef.current = {
        productKey,
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        lastPreviewProducts: null,
        lastAcceptedSlot: null,
        lastAcceptedSlotKey: null,
        lastAcceptedClientX: event.clientX,
        lastAcceptedClientY: event.clientY,
        hasMoved: false,
      };
      setProductLayoutDropSlot(null);
      event.currentTarget.setPointerCapture(event.pointerId);
      event.preventDefault();
      event.stopPropagation();
      setDraggingProductKey(productKey);
    },
    [captureProductLayoutRects, isInteractiveDragSource, isProductLayoutEditMode],
  );

  const previewProductLayoutFromPoint = useCallback(
    (pointerDrag: ProductPointerDragState, clientX: number, clientY: number): DemoProduct[] | null => {
      const measurements = readProductLayoutMeasurements();
      const dropSlot = findProductLayoutDropSlot(measurements, pointerDrag.productKey, clientX, clientY, productViewMode);
      if (!dropSlot || !acceptProductLayoutDropSlot(pointerDrag, dropSlot, measurements, clientX, clientY, productViewMode)) {
        return null;
      }

      const dropSlotKey = productLayoutDropSlotKey(dropSlot);
      const nextProducts = previewProductLayoutPlacement(
        pointerDrag.productKey,
        dropSlot.targetProductKey,
        dropSlot.targetCategoryId,
        dropSlot.placement,
        dropSlot.targetSectionId,
        dropSlot.targetSectionProductKeys,
      );

      if (nextProducts) {
        pointerDrag.lastAcceptedSlot = dropSlot;
        pointerDrag.lastAcceptedSlotKey = dropSlotKey;
        pointerDrag.lastAcceptedClientX = clientX;
        pointerDrag.lastAcceptedClientY = clientY;
        setProductLayoutDropSlot(dropSlot);
      }

      return nextProducts;
    },
    [previewProductLayoutPlacement, productViewMode, readProductLayoutMeasurements],
  );

  const previewValidatedProductLayoutDrop = useCallback(
    (pointerDrag: ProductPointerDragState, dropSlot: ProductLayoutDropSlot, clientX: number, clientY: number): DemoProduct[] | null => {
      const dropSlotKey = productLayoutDropSlotKey(dropSlot);
      const nextProducts = previewProductLayoutPlacement(
        pointerDrag.productKey,
        dropSlot.targetProductKey,
        dropSlot.targetCategoryId,
        dropSlot.placement,
        dropSlot.targetSectionId,
        dropSlot.targetSectionProductKeys,
      );

      if (nextProducts) {
        pointerDrag.lastAcceptedSlot = dropSlot;
        pointerDrag.lastAcceptedSlotKey = dropSlotKey;
        pointerDrag.lastAcceptedClientX = clientX;
        pointerDrag.lastAcceptedClientY = clientY;
        pointerDrag.lastPreviewProducts = nextProducts;
        setProductLayoutDropSlot(dropSlot);
      }

      return nextProducts;
    },
    [previewProductLayoutPlacement],
  );

  const handleProductPointerMove = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      const pointerDrag = productPointerDragRef.current;
      if (!pointerDrag || pointerDrag.pointerId !== event.pointerId || !isProductLayoutEditMode) return;

      const deltaX = event.clientX - pointerDrag.startX;
      const deltaY = event.clientY - pointerDrag.startY;
      if (!pointerDrag.hasMoved && Math.hypot(deltaX, deltaY) < PRODUCT_LAYOUT_POINTER_START_PX) return;

      pointerDrag.hasMoved = true;
      suppressProductClickRef.current = true;
      event.preventDefault();
      event.stopPropagation();

      const nextProducts = previewProductLayoutFromPoint(pointerDrag, event.clientX, event.clientY);
      if (nextProducts) {
        pointerDrag.lastPreviewProducts = nextProducts;
      }
    },
    [isProductLayoutEditMode, previewProductLayoutFromPoint],
  );

  const scheduleProductClickSuppressionReset = useCallback(() => {
    window.setTimeout(() => {
      suppressProductClickRef.current = false;
    }, 350);
  }, []);

  const handleProductPointerUp = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      const pointerDrag = productPointerDragRef.current;
      if (!pointerDrag || pointerDrag.pointerId !== event.pointerId) return;

      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }

      if (!pointerDrag.hasMoved) {
        clearProductLayoutPreview();
        return;
      }

      suppressProductClickRef.current = true;
      scheduleProductClickSuppressionReset();
      event.preventDefault();
      event.stopPropagation();
      const endpointSlot = validateProductLayoutDropAtPoint(
        readProductLayoutMeasurements(),
        pointerDrag.productKey,
        event.clientX,
        event.clientY,
        productViewMode,
      );
      if (!endpointSlot) {
        clearProductLayoutPreview();
        suppressProductClickRef.current = true;
        scheduleProductClickSuppressionReset();
        return;
      }
      const endpointSlotKey = productLayoutDropSlotKey(endpointSlot);
      const endpointProducts = endpointSlotKey === pointerDrag.lastAcceptedSlotKey
        ? pointerDrag.lastPreviewProducts
        : previewValidatedProductLayoutDrop(pointerDrag, endpointSlot, event.clientX, event.clientY);
      void commitProductLayoutPreview(endpointProducts);
    },
    [
      clearProductLayoutPreview,
      commitProductLayoutPreview,
      previewValidatedProductLayoutDrop,
      productViewMode,
      readProductLayoutMeasurements,
      scheduleProductClickSuppressionReset,
    ],
  );

  const handleProductPointerCancel = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      const pointerDrag = productPointerDragRef.current;
      if (!pointerDrag || pointerDrag.pointerId !== event.pointerId) return;
      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }
      clearProductLayoutPreview();
    },
    [clearProductLayoutPreview],
  );

  const handleProductClickCapture = useCallback((event: ReactMouseEvent<HTMLDivElement>) => {
    if (!suppressProductClickRef.current) return;
    suppressProductClickRef.current = false;
    event.preventDefault();
    event.stopPropagation();
  }, []);

  const openCreateCategoryModal = useCallback(() => {
    if (productCategoryMode !== 'custom') return;
    if (loading) {
      setCategoryStatus('Bitte warte einen Moment, der Stack wird geladen.');
      return;
    }
    if (!activeStack) {
      setCategoryStatus('Bitte warte einen Moment, die Stack-Daten sind noch nicht bereit.');
      return;
    }
    setCategoryDraft('');
    setCategoryStatus('');
    setIsCategoryCreateModalOpen(true);
  }, [activeStack, loading, productCategoryMode]);

  const closeCreateCategoryModal = useCallback(() => {
    setIsCategoryCreateModalOpen(false);
    setCategoryDraft('');
    setCategoryStatus('');
    setIsCategoryActionBusy(false);
  }, []);

  const openRenameCategoryModal = useCallback((category: StackCategory) => {
    if (!activeStack || category.is_default || productCategoryMode !== 'custom') return;
    setRenamingCategory(category);
    setCategoryRenameDraft(category.name);
    setCategoryStatus('');
    setIsCategoryActionBusy(false);
  }, [activeStack, productCategoryMode]);

  const closeRenameCategoryModal = useCallback(() => {
    setRenamingCategory(null);
    setCategoryRenameDraft('');
    setCategoryStatus('');
    setIsCategoryActionBusy(false);
  }, []);

  const handleCreateCategory = useCallback(async () => {
    if (!activeStack || productCategoryMode !== 'custom' || isCategoryActionBusy) return;
    const name = categoryDraft.trim();
    if (!name) {
      setCategoryStatus('Bitte einen Kategorienamen eingeben.');
      return;
    }
    setIsCategoryActionBusy(true);
    const nextSortOrder = activeCategories.length;
    const localCategory: StackCategory = {
      id: `local-category-${Date.now()}`,
      stack_id: activeStack.id,
      name,
      sort_order: nextSortOrder,
      is_default: false,
    };

    try {
      if (mode === 'authenticated') {
        const created = await createStackCategory(activeStack.id, { name, sort_order: nextSortOrder });
        setActiveStackCategories([...activeCategories, {
          id: created.id,
          stack_id: created.stack_id,
          name: created.name,
          sort_order: created.sort_order,
          is_default: created.is_default,
        }]);
      } else {
        setActiveStackCategories([...activeCategories, localCategory]);
      }
      setIsCategoryCreateModalOpen(false);
      setCategoryDraft('');
      setCategoryStatus('');
    } catch (err) {
      setCategoryStatus(err instanceof Error ? err.message : 'Kategorie konnte nicht erstellt werden.');
    } finally {
      setIsCategoryActionBusy(false);
    }
  }, [activeCategories, activeStack, categoryDraft, isCategoryActionBusy, mode, productCategoryMode, setActiveStackCategories]);

  const handleRenameCategory = useCallback(async () => {
    if (!activeStack || !renamingCategory || productCategoryMode !== 'custom' || isCategoryActionBusy) return;
    if (renamingCategory.is_default) return;
    const nextName = categoryRenameDraft.trim();
    if (!nextName) {
      setCategoryStatus('Bitte einen Kategorienamen eingeben.');
      return;
    }
    if (nextName === renamingCategory.name.trim()) {
      closeRenameCategoryModal();
      return;
    }
    setIsCategoryActionBusy(true);

    try {
      if (mode === 'authenticated' && toApiCategoryId(renamingCategory.id) !== undefined) {
        const updated = await updateStackCategory(activeStack.id, renamingCategory.id, { name: nextName });
        setActiveStackCategories(
          activeCategories.map((entry) => (
            normalizedCategoryId(entry.id) === normalizedCategoryId(renamingCategory.id)
              ? { ...entry, name: updated.name }
              : entry
          )),
        );
      } else {
        setActiveStackCategories(
          activeCategories.map((entry) => (
            normalizedCategoryId(entry.id) === normalizedCategoryId(renamingCategory.id)
              ? { ...entry, name: nextName }
              : entry
          )),
        );
      }
      setCategoryStatus('');
      closeRenameCategoryModal();
    } catch (err) {
      setCategoryStatus(err instanceof Error ? err.message : 'Kategorie konnte nicht umbenannt werden.');
    } finally {
      setIsCategoryActionBusy(false);
    }
  }, [activeCategories, activeStack, categoryRenameDraft, isCategoryActionBusy, mode, productCategoryMode, renamingCategory, setActiveStackCategories, closeRenameCategoryModal]);

  const handleDeleteCategory = useCallback(async (category: StackCategory) => {
    if (!activeStack || category.is_default || productCategoryMode !== 'custom') return;
    const confirmed = window.confirm(`Kategorie "${category.name}" wirklich löschen?`);
    if (!confirmed) return;
    const defaultCategory = activeCategories.find((entry) => entry.is_default) ?? activeCategories[0];
    if (!defaultCategory) return;

    if (mode === 'authenticated' && toApiCategoryId(category.id) !== undefined) {
      try {
        await deleteStackCategory(activeStack.id, category.id);
      } catch (err) {
        setCategoryStatus(err instanceof Error ? err.message : 'Kategorie konnte nicht gelöscht werden.');
        return;
      }
    }

    const recategorizedProducts = activeProducts.map((product) => (
      normalizedCategoryId(product.category_id) === normalizedCategoryId(category.id)
        ? {
            ...product,
            category_id: defaultCategory.id,
            category_name: defaultCategory.name,
            category_is_default: true,
          }
        : product
    ));
    setActiveStackCategories(activeCategories.filter((entry) => normalizedCategoryId(entry.id) !== normalizedCategoryId(category.id)));
    await persistCustomLayout(recategorizedProducts);
    setCategoryStatus('');
  }, [activeCategories, activeProducts, activeStack, mode, persistCustomLayout, productCategoryMode, setActiveStackCategories]);

  const assignProductCategory = useCallback(
    async (productKey: string, categoryId: string) => {
      if (!activeStack || productCategoryMode !== 'custom') return;
      const category = activeCategories.find((entry) => normalizedCategoryId(entry.id) === normalizedCategoryId(categoryId));
      if (!category) return;
      const nextProducts = activeProducts.map((product) => (
        productStackKey(product) === productKey
          ? {
              ...product,
              category_id: category.id,
              category_name: category.name,
              category_is_default: category.is_default,
            }
          : product
      ));
      await persistCustomLayout(nextProducts);
    },
    [activeCategories, activeProducts, activeStack, persistCustomLayout, productCategoryMode],
  );

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
      openDemoRestriction('Stack mailen ist nur angemeldet verfügbar.');
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
      openDemoRestriction('Plan drucken/PDF ist in der Demo nicht verfügbar.');
      return;
    }
    if (!activeStack || productsCount === 0) {
      setNotice({
        title: 'Plan drucken/PDF ist noch nicht verfügbar.',
        message: 'Füge zuerst ein Produkt zum Stack hinzu.',
      });
      return;
    }
    window.print();
  };

  const activeDescription = activeStack ? descriptions[activeStack.id] ?? '' : '';
  const editingProduct = activeStack?.products.find((product) => productStackKey(product) === editingProductKey) ?? null;
  const deletingProduct = activeStack?.products.find((product) => productStackKey(product) === deleteProductKey) ?? null;
  const replacingStack = activeStack && replaceProductKey ? activeStack : null;
  const editStackActionLabel = 'Stack bearbeiten';
  const emailActionLabel = emailSending
    ? 'Stack-Mail wird gesendet'
    : isDemo
      ? 'Stack mailen ist nur angemeldet verfügbar.'
      : 'Stack per E-Mail senden';
  const printStackActionLabel = isDemo
    ? 'Plan drucken/PDF ist in der Demo nicht verfügbar.'
    : 'Plan drucken oder als PDF speichern';
  const deleteStackActionLabel = 'Stack löschen';

  const rightSlot = isDemo ? (
    <>
      <span className="header-email">Demo-Modus — nicht angemeldet</span>
      <Link
        to="/register"
        state={{ redirect: '/stacks', demoStackHandoffKey: SS_DEMO_STACK_HANDOFF_KEY }}
        onClick={() => persistDemoStackHandoff(state, descriptions)}
        className="btn-logout"
        style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center' }}
      >
        Registrieren
      </Link>
    </>
  ) : (
    <>
      <span className="header-email">{cockpitUserLabel ?? ''}</span>
      <button className="btn-logout" onClick={handleLogout}>
        Abmelden
      </button>
    </>
  );

  if (view === 'routine') {
    return (
      <>
        <div className="ss-page ss-page-embedded ss-routine-page">
          {isDemo && (
            <div className="info-banner info-banner-demo">
              <IconInfoCircle />
              <strong>Demo-Einnahmeplan:</strong>
              &nbsp;
              <span>Registriere dich, um den Plan zu speichern oder zu versenden.</span>
            </div>
          )}

          <section className="stack-cockpit" aria-label="Einnahmeplan">
            <div className="print-sheet-heading">
              <strong>Supplement Stack Einnahmeplan</strong>
              <span>{activeStack?.name ?? 'Stack'}</span>
            </div>
            <div className="stack-cockpit-head">
              <div>
                <h2>{activeStack?.name ?? 'Stack'}</h2>
              </div>
              {cockpitUserLabel && <div className="stack-cockpit-user">{cockpitUserLabel}</div>}
            </div>
            <div className="ss-routine-actions">
              <button
                type="button"
                className="ss-btn ss-btn-outline"
                onClick={() => void handleEmailStack()}
                disabled={!activeStack || emailSending}
                title={isDemo ? 'Stack mailen ist nur angemeldet verfügbar.' : 'Stack per E-Mail senden'}
              >
                <IconMail />
                {emailSending ? 'Wird gesendet...' : 'Stack mailen'}
              </button>
              <button
                type="button"
                className="ss-btn ss-btn-outline print-action"
                onClick={handlePrintStack}
                disabled={!activeStack || (!isDemo && productsCount === 0)}
                title={isDemo ? 'Plan drucken/PDF ist in der Demo nicht verfügbar.' : 'Plan drucken oder als PDF speichern'}
              >
                <IconPdf />
                Plan drucken/PDF
              </button>
            </div>
            {emailStatus && <p className="family-status">{emailStatus}</p>}
          </section>

          {error && <p className="rounded-2xl bg-red-50 px-4 py-3 text-sm font-bold text-red-700">{error}</p>}

          {loading ? (
            <div style={{ padding: 40, textAlign: 'center' }}>Laden...</div>
          ) : (
            <div className="routine-panel routine-open">
              <div className="routine-grid">
                {(Object.keys(ROUTINE_META) as RoutineKey[]).map((routineKey) => {
                  const products = routineGroups[routineKey];
                  const meta = ROUTINE_META[routineKey];
                  return (
                    <div key={routineKey} className="routine-column">
                      <div className="routine-column-head">
                        <strong>{meta.label}</strong>
                        <span>{products.length}</span>
                      </div>
                      <p>{meta.hint}</p>
                      {products.length === 0 ? (
                        <div className="routine-empty">Keine Produkte</div>
                      ) : (
                        <div className="routine-list">
                          {products.map((product) => {
                            const usage = calculateProductUsage(product, product.price, { fallbackTotalServings: 30 });
                            return (
                              <div key={productStackKey(product)} className="routine-item">
                                <strong>{product.name}</strong>
                                <span>{product.dosage_text || `${usage.servingsPerIntake} ${unitLabel(product.serving_unit ?? 'Portion', usage.servingsPerIntake)}`}</span>
                                <small>
                                  {formatIntakeInterval(productIntakeIntervalDays(product))}
                                  {' - '}
                                  {formatEuro(usage.monthlyCost ?? product.price)} EUR/Monat
                                  {' - '}
                                  {formatDaysSupply(usage.daysSupply)}
                                </small>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
        {notice && <WorkspaceNoticeModal notice={notice} onClose={() => setNotice(null)} />}
      </>
    );
  }

  return (
    <>
      {showStandaloneHeader && (
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
      )}

      <div className={showStandaloneHeader ? 'ss-page' : 'ss-page ss-page-embedded'}>
        {isDemo && (
          <div className="info-banner info-banner-demo">
            <IconInfoCircle />
            <strong>Interaktive Demo:</strong>
            &nbsp;
            <span>
              Alles nutzbar — nach dem Neuladen startet wieder der Demo-Stack. Registriere dich,
              um Änderungen dauerhaft zu speichern.
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
              onChange={handleStackSelectChange}
            >
              {state.stacks.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.products.length} Produkte)
                </option>
              ))}
              <option value={CREATE_STACK_SELECT_VALUE}>Neuen Stack anlegen</option>
            </select>
            <span className="stack-select-arrow">
              <IconChevron />
            </span>
          </div>

          <button
            className="ss-btn ss-toolbar-icon-action ss-toolbar-icon-action-edit"
            onClick={() => setEditModalOpen(true)}
            disabled={!activeStack}
            aria-label={editStackActionLabel}
            title={editStackActionLabel}
          >
            <IconPencil />
          </button>

          <button
            className="ss-btn ss-toolbar-icon-action ss-toolbar-icon-action-blue"
            onClick={() => void handleEmailStack()}
            disabled={!activeStack || emailSending}
            aria-label={emailActionLabel}
            title={emailActionLabel}
          >
            <IconMail />
          </button>
          <button
            className="ss-btn ss-toolbar-icon-action ss-toolbar-icon-action-blue print-action"
            onClick={handlePrintStack}
            disabled={!activeStack || (!isDemo && productsCount === 0)}
            aria-label={printStackActionLabel}
            title={printStackActionLabel}
          >
            <IconPdf />
          </button>
          {emailStatus && (
            <span style={{ fontSize: 11, fontWeight: 700, color: '#64748b' }}>
              {emailStatus}
            </span>
          )}

          <button
            className="ss-btn ss-btn-red-soft ss-toolbar-icon-action"
            onClick={() => void handleDeleteStack(state.activeStackId)}
            aria-label={deleteStackActionLabel}
            title={deleteStackActionLabel}
          >
            <IconTrash />
          </button>

          <span className="ss-toolbar-divider" aria-hidden="true">|</span>

          <button className="ss-btn ss-btn-green ss-toolbar-primary-action" onClick={() => setAddModalOpen(true)}>
            <IconPlus />
            Produkt hinzufügen
          </button>
        </div>

        <hr className="ss-toolbar-section-divider" aria-hidden="true" />

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

        <div className="ss-section-title ss-products-title">
          <div className="ss-product-title-controls">
            <div className="ss-control-group">
              <span className="ss-control-group-label">Sortierung</span>
              <div className="ss-control-group-row">
                <div className="product-view-toggle" role="group" aria-label="Produktsortierung waehlen">
                  <button
                    type="button"
                    className={productSortMode === 'az' ? 'active' : ''}
                    onClick={() => setProductSortMode('az')}
                    aria-pressed={productSortMode === 'az'}
                    title="Alphabetisch sortieren"
                  >
                    <span>A-Z</span>
                  </button>
                  <button
                    type="button"
                    className={productSortMode === 'timing' ? 'active' : ''}
                    onClick={() => setProductSortMode('timing')}
                    aria-pressed={productSortMode === 'timing'}
                    title="Nach Tageszeiten sortieren"
                  >
                    <span>Tageszeiten</span>
                  </button>
                  <button
                    type="button"
                    className={productSortMode === 'custom' ? 'active' : ''}
                    onClick={() => setProductSortMode('custom')}
                    aria-pressed={productSortMode === 'custom'}
                    title="Eigene Sortierung"
                  >
                    <span>Eigene</span>
                  </button>
                </div>
                {isCustomLayoutControlsVisible && showSortLayoutEditToggle && (
                  <button
                    type="button"
                    className={`ss-layout-edit-toggle-btn ${isProductLayoutEditMode ? 'active' : ''}`}
                    onClick={handleToggleProductLayoutEditMode}
                    aria-pressed={isProductLayoutEditMode}
                    title={isProductLayoutEditMode ? 'Layout-Bearbeitung beenden' : 'Layout bearbeiten'}
                    aria-label={isProductLayoutEditMode ? 'Layout-Bearbeitung beenden' : 'Layout bearbeiten'}
                  >
                    <Pencil size={16} />
                  </button>
                )}
              </div>
            </div>
            <div className="ss-control-group">
              <span className="ss-control-group-label">Kategorien</span>
              <div className="ss-control-group-row">
                <div className="product-view-toggle" role="group" aria-label="Produktkategorien waehlen">
                  <button
                    type="button"
                    className={productCategoryMode === 'none' ? 'active' : ''}
                    onClick={() => setProductCategoryMode('none')}
                    aria-pressed={productCategoryMode === 'none'}
                    title="Keine Kategorien"
                  >
                    <span>Keine</span>
                  </button>
                  <button
                    type="button"
                    className={productCategoryMode === 'timing' ? 'active' : ''}
                    onClick={() => setProductCategoryMode('timing')}
                    aria-pressed={productCategoryMode === 'timing'}
                    title="Nach Tageszeiten gruppieren"
                  >
                    <span>Tageszeiten</span>
                  </button>
                  <button
                    type="button"
                    className={productCategoryMode === 'custom' ? 'active' : ''}
                    onClick={() => setProductCategoryMode('custom')}
                    aria-pressed={productCategoryMode === 'custom'}
                    title="Eigene Kategorien"
                  >
                    <span>Eigene</span>
                  </button>
                </div>
                {isCustomLayoutControlsVisible && showCategoryLayoutEditToggle && (
                  <button
                    type="button"
                    className={`ss-layout-edit-toggle-btn ${isProductLayoutEditMode ? 'active' : ''}`}
                    onClick={handleToggleProductLayoutEditMode}
                    aria-pressed={isProductLayoutEditMode}
                    title={isProductLayoutEditMode ? 'Layout-Bearbeitung beenden' : 'Layout bearbeiten'}
                    aria-label={isProductLayoutEditMode ? 'Layout-Bearbeitung beenden' : 'Layout bearbeiten'}
                  >
                    <Pencil size={16} />
                  </button>
                )}
                {productCategoryMode === 'custom' && (
                  <button
                    type="button"
                    className="ss-layout-edit-toggle-btn ss-category-create-btn"
                    onClick={openCreateCategoryModal}
                    disabled={loading || !activeStack || isCategoryActionBusy}
                    aria-label="Neue Kategorie"
                    title="Neue Kategorie"
                  >
                    <Plus size={16} />
                  </button>
                )}
              </div>
            </div>
            <div className="ss-control-group">
              <span className="ss-control-group-label">Ansicht</span>
              <div className="ss-control-group-row">
                <div className="product-view-toggle" role="group" aria-label="Produktansicht waehlen">
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
            </div>
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
              Noch leer — klicke auf &bdquo;Produkt hinzufügen&ldquo;, um zu starten.
            </p>
            <button
              type="button"
              onClick={() => setAddModalOpen(true)}
              className="ss-btn ss-btn-green"
              style={{ margin: '18px auto 0' }}
            >
              <IconPlus />
              Produkt hinzufügen
            </button>
          </div>
        )}

        {!loading && (activeProducts.length > 0 || productCategoryMode === 'custom') && (
          <>
            <div className={['ss-product-sections', isProductLayoutEditMode ? 'ss-product-layout-edit-active' : ''].filter(Boolean).join(' ')}>
              {productSections.map((section) => {
                const sectionCategory = productCategoryMode === 'custom'
                  ? activeCategories.find((category) => normalizedCategoryId(category.id) === normalizedCategoryId(section.categoryId))
                  : null;
                const isSectionDropEnd = (
                  productLayoutDropSlot?.targetSectionId === section.id
                  && productLayoutDropSlot.placement === 'end'
                  && !productLayoutDropSlot.targetProductKey
                );
                return (
                  <section
                    key={section.id}
                    ref={(node) => setProductSectionRef(section.id, node)}
                    className={[
                      'ss-product-section',
                      isSectionDropEnd ? 'ss-product-layout-drop-target ss-product-layout-drop-end' : '',
                    ].filter(Boolean).join(' ')}
                    data-product-section-id={section.id}
                    data-product-section-category-id={section.categoryId === null ? '' : String(section.categoryId)}
                  >
                    {section.heading && (
                      <div className="ss-product-section-head">
                        <div className="ss-product-section-title-row">
                          <h3>{section.heading}</h3>
                          <span>{section.products.length}</span>
                        </div>
                        {sectionCategory && isProductLayoutEditMode && !sectionCategory.is_default && (
                          <div className="ss-product-section-actions">
                            <button
                              type="button"
                              className="ss-section-action-btn"
                              onClick={() => openRenameCategoryModal(sectionCategory)}
                              aria-label={`Kategorie umbenennen: ${sectionCategory.name}`}
                            >
                              <Pencil size={14} />
                            </button>
                            <button
                              type="button"
                              className="ss-section-action-btn ss-section-action-btn-danger"
                              onClick={() => void handleDeleteCategory(sectionCategory)}
                              aria-label={`Kategorie löschen: ${sectionCategory.name}`}
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                    <div className={productViewMode === 'grid' ? 'masonry-grid ss-section-grid' : 'product-list-view'}>
                      {section.products.map((product) => {
                        const key = productStackKey(product);
                        const isDraggingProduct = draggingProductKey === key;
                        const itemDropPlacement = (
                          productLayoutDropSlot?.targetSectionId === section.id
                          && productLayoutDropSlot.targetProductKey === key
                        )
                          ? productLayoutDropSlot.placement
                          : null;
                        return (
                          <div
                            key={key}
                            ref={(node) => setProductItemRef(key, node)}
                            data-product-layout-key={key}
                            className={[
                              'ss-product-layout-editable-item',
                              productViewMode === 'grid' ? 'masonry-item' : 'product-list-item',
                              isProductLayoutEditMode ? 'ss-product-layout-edit-mode' : '',
                              isDraggingProduct ? 'ss-product-layout-item-dragging' : '',
                              itemDropPlacement ? 'ss-product-layout-drop-target' : '',
                              itemDropPlacement === 'before' ? 'ss-product-layout-drop-before' : '',
                              itemDropPlacement === 'after' ? 'ss-product-layout-drop-after' : '',
                            ].filter(Boolean).join(' ')}
                            onPointerDown={(event) => handleProductPointerDown(event, key)}
                            onPointerMove={handleProductPointerMove}
                            onPointerUp={handleProductPointerUp}
                            onPointerCancel={handleProductPointerCancel}
                            onClickCapture={handleProductClickCapture}
                          >
                            {isProductLayoutEditMode && (
                              <div className="ss-product-layout-edit-toolbar" data-no-drag="true" onClick={(event) => event.stopPropagation()}>
                                {productCategoryMode === 'custom' && (
                                  <select
                                    className="ss-product-category-select"
                                    value={normalizedCategoryId(product.category_id)}
                                    data-no-drag="true"
                                    onMouseDown={(event) => event.stopPropagation()}
                                    onMouseMove={(event) => event.stopPropagation()}
                                    onChange={(event) => {
                                      event.stopPropagation();
                                      const input = event.target as HTMLSelectElement;
                                      void assignProductCategory(key, input.value);
                                    }}
                                    aria-label={`Kategorie für ${product.name}`}
                                  >
                                    {activeCategories.map((category) => (
                                      <option key={String(category.id)} value={normalizedCategoryId(category.id)}>
                                        {category.name}
                                      </option>
                                    ))}
                                  </select>
                                )}
                              </div>
                            )}
                            {isProductLayoutEditMode && <div className="ss-product-layout-edit-overlay" aria-hidden="true" />}
                            <ProductCard
                              product={product}
                              shopDomains={shopDomains}
                              selected={selectedIds.has(key)}
                              display={productViewMode === 'list' ? 'list' : 'card'}
                              onToggleSelected={() => toggleSelected(key)}
                              onEdit={() => setEditingProductKey(key)}
                              onDelete={() => setDeleteProductKey(key)}
                              onReportMissingLink={(item, reason) => void handleReportMissingLink(item as DemoProduct, reason)}
                              showSelectButton={false}
                            />
                          </div>
                        );
                      })}
                      {productViewMode === 'grid' && section.id === productSections[productSections.length - 1]?.id && (
                        <div className="masonry-item">
                          <button
                            type="button"
                            className="ss-add-product-tile"
                            onClick={() => setAddModalOpen(true)}
                          >
                            <Plus size={28} />
                            <span>Produkt hinzufügen</span>
                          </button>
                        </div>
                      )}
                    </div>
                  </section>
                );
              })}
            </div>
          </>
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
            {allSelected ? 'Alles abwählen' : 'Alles auswählen'}
          </button>
        </div>
      </div>
      )}

      {addModalOpen && (
        <AddProductModal
          stacks={state.stacks}
          activeStackId={state.activeStackId}
          isDemo={isDemo}
          timingOptions={editTimingOptions}
          onAdd={handleAddProduct}
          onClose={() => setAddModalOpen(false)}
          onRequestOwnProduct={() => {
            if (isDemo) {
              setNotice({
                title: 'Eigenes Produkt hinzufügen',
                message: OWN_PRODUCT_DEMO_CTA_TEXT,
                primaryLabel: 'Jetzt anmelden',
                onPrimary: handleRegisterFromDemo,
              });
              return;
            }
            navigate('/my-products');
          }}
          onEditExistingProduct={(productKey) => {
            setAddModalOpen(false);
            setEditingProductKey(productKey);
          }}
          onReplaceExistingProduct={(productKey) => {
            setAddModalOpen(false);
            setReplaceProductKey(productKey);
          }}
        />
      )}

      {isCategoryCreateModalOpen && (
        <CategoryCreateModal
          draft={categoryDraft}
          status={categoryStatus}
          isBusy={isCategoryActionBusy}
          onDraftChange={setCategoryDraft}
          onSubmit={handleCreateCategory}
          onClose={closeCreateCategoryModal}
        />
      )}

      {renamingCategory && (
        <CategoryRenameModal
          draft={categoryRenameDraft}
          status={categoryStatus}
          isBusy={isCategoryActionBusy}
          onDraftChange={setCategoryRenameDraft}
          onSubmit={handleRenameCategory}
          onClose={closeRenameCategoryModal}
        />
      )}

      {replaceProductKey && replacingStack && (
        <AddProductModal
          stacks={[replacingStack]}
          activeStackId={replacingStack.id}
          isDemo={isDemo}
          timingOptions={editTimingOptions}
          onAdd={handleReplaceProduct}
          onClose={() => setReplaceProductKey(null)}
          title="Produkt wechseln"
          submitLabel="Produkt ersetzen"
          ignoredExistingProductKey={replaceProductKey}
          onRequestOwnProduct={() => {
            if (isDemo) {
              setNotice({
                title: 'Eigenes Produkt hinzufügen',
                message: OWN_PRODUCT_DEMO_CTA_TEXT,
                primaryLabel: 'Jetzt anmelden',
                onPrimary: handleRegisterFromDemo,
              });
              return;
            }
            navigate('/my-products');
          }}
          onEditExistingProduct={(productKey) => {
            setReplaceProductKey(null);
            setEditingProductKey(productKey);
          }}
          onReplaceExistingProduct={(productKey) => {
            setReplaceProductKey(productKey);
          }}
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
          timingOptions={editTimingOptions}
          onClose={() => setEditingProductKey(null)}
        />
      )}

      {editModalOpen && activeStack && (
        <EditStackModal
          initialName={activeStack.name}
          initialDescription={activeDescription}
          initialFamilyMemberId={activeStack.family_member_id ?? null}
          familyMembers={familyMembers}
          onFamilyMemberChange={handleSaveStackFamilyMember}
          onSave={(n, d) => handleSaveStackMeta(n, d)}
          onClose={() => setEditModalOpen(false)}
        />
      )}

      {deleteProductKey && (
        <ConfirmDeleteProductModal
          productName={deletingProduct?.name}
          onCancel={() => setDeleteProductKey(null)}
          onConfirm={() => {
            const productKey = deleteProductKey;
            setDeleteProductKey(null);
            void handleRemoveProduct(productKey);
          }}
        />
      )}

      {notice && <WorkspaceNoticeModal notice={notice} onClose={() => setNotice(null)} />}
    </>
  );
}

export default StackWorkspace;
