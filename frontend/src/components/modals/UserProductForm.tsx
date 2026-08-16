import { type FormEvent, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { UNSAFE_NavigationContext } from 'react-router-dom';
import ModalWrapper from './ModalWrapper';
import ImageCropModal from '../ImageCropModal';
import SearchBar from '../SearchBar';
import { Camera, ChevronDown, ChevronUp, Info, Plus, X } from 'lucide-react';
import { getIngredient, getIngredientParts } from '../../api/ingredients';
import type {
  Ingredient,
  IngredientPartAmount,
  IngredientPartOption,
  UserProductIngredient as UserProductIngredientType,
} from '../../types/local';

export interface UserProduct {
  id: number;
  version: number;
  user_id?: number;
  name: string;
  brand?: string;
  form?: string;
  price: number;
  shop_link?: string | null;
  image_url?: string | null;
  serving_size?: number;
  serving_unit?: string;
  servings_per_container?: number;
  container_count?: number;
  is_affiliate?: number | boolean;
  notes?: string | null;
  status?: 'pending' | 'approved' | 'rejected' | 'blocked';
  approved_at?: string | null;
  created_at?: string;
  published_product_id?: number | null;
  published_at?: string | null;
  review_note?: string | null;
  visibility?: 'private' | 'public';
  status_history?: UserProductStatusHistory[];
  stack_usage?: UserProductStackUsage[];
  ingredients?: UserProductIngredientType[];
}

export interface UserProductStatusHistory {
  moderation_status: string;
  visibility: 'private' | 'public';
  note?: string | null;
  created_at: string;
}

export interface UserProductStackUsage {
  stack_item_id: number;
  stack_id: number;
  stack_name: string;
  quantity: number;
  dosage_text?: string | null;
  intake_interval_days?: number | null;
}

interface UserProductFormProps {
  onClose: () => void;
  onSaved: (product: UserProduct) => void;
  initialProduct?: UserProduct;
  copyProduct?: UserProduct;
  draftOwnerId?: number;
}

interface IngredientPartState {
  items: IngredientPartOption[];
  loading: boolean;
}

interface IngredientPartFormRow {
  partId: number;
  partName: string;
  partStatus?: string | null;
  quantity: string;
  unit: string;
  basisQuantity: string;
  basisUnit: string;
  searchRelevant: boolean;
}

export interface IngredientFormRow {
  clientId: string;
  ingredientId: number | null;
  ingredientName: string;
  formId: number | null;
  availableForms: NonNullable<Ingredient['forms']>;
  quantity: string;
  unit: string;
  basisQuantity: string;
  basisUnit: string;
  searchRelevant: boolean;
  parts: IngredientPartFormRow[];
}

const JSON_HEADERS: Record<string, string> = {
  'Content-Type': 'application/json',
};

const FORM_OPTIONS = ['Kapsel', 'Tablette', 'Softgel', 'Pulver', 'Tropfen', 'Flüssigkeit', 'Öl', 'Spray', 'Gel', 'Gummibärchen', 'Beutel', 'Sonstige'];
const SERVING_UNIT_OPTIONS = [
  'Kapseln',
  'Tabletten',
  'Tropfen',
  'Messlöffel',
  'Esslöffel',
  'Teelöffel',
  'Softgels',
  'Gummies',
  'Beutel',
  'ml',
  'g',
  'Sonstige',
];

const LEGACY_PRODUCT_DRAFT_KEY = 'supplement-stack:user-product-draft:v1';
const PRODUCT_DRAFT_KEY_PREFIX = 'supplement-stack:user-product-draft:v2';
const DISCARD_CHANGES_MESSAGE =
  'Du hast noch nicht gespeicherte Änderungen. Möchtest du sie wirklich verwerfen? Produktfotos werden nicht im Entwurf gespeichert.';

const MAX_INGREDIENT_ROWS = 50;
const ROW_LIMIT_MESSAGE = 'Maximal 50 Wirkstoffe sind erlaubt.';

const labelClass = 'block text-sm font-medium text-gray-700 mb-1';
const inputClass =
  'w-full border border-gray-200 rounded-xl px-4 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent text-sm';
const fieldHintClass = 'text-xs text-gray-500 mt-1';

const makeClientId = () => `ingredient_${Date.now()}_${Math.random().toString(16).slice(2)}`;
const formatInputNumber = (value: number) => String(value);
const formatDisplayNumber = (value: number) => String(value).replace('.', ',');
const normalizeDraftNumber = (value: unknown) => typeof value === 'string' ? value.replace(',', '.') : '';

function parseDecimal(value: string): number | null {
  const normalized = value.trim().replace(',', '.');
  if (!normalized) return null;
  const parsed = Number.parseFloat(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function draftIngredientRows(rows: IngredientFormRow[]) {
  return rows.map((row) => ({
    basisQuantity: row.basisQuantity,
    basisUnit: row.basisUnit,
    formId: row.formId,
    ingredientId: row.ingredientId,
    ingredientName: row.ingredientName,
    parts: row.parts,
    quantity: row.quantity,
    searchRelevant: row.searchRelevant,
    unit: row.unit,
  }));
}

function restoreDraftParts(value: unknown): IngredientPartFormRow[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry): IngredientPartFormRow[] => {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return [];
    const part = entry as Partial<IngredientPartFormRow>;
    if (typeof part.partId !== 'number' || !Number.isSafeInteger(part.partId) || part.partId <= 0) return [];
    return [{
      basisQuantity: normalizeDraftNumber(part.basisQuantity),
      basisUnit: typeof part.basisUnit === 'string' ? part.basisUnit : '',
      partId: part.partId,
      partName: typeof part.partName === 'string' ? part.partName : 'Wirkstoffteil',
      partStatus: typeof part.partStatus === 'string' ? part.partStatus : null,
      quantity: normalizeDraftNumber(part.quantity),
      searchRelevant: part.searchRelevant !== false,
      unit: typeof part.unit === 'string' ? part.unit : '',
    }];
  });
}

function massInMilligrams(value: number, unit: string): number | null {
  const normalized = unit.trim().toLowerCase().replace('μ', 'µ');
  if (normalized === 'mg') return value;
  if (normalized === 'g') return value * 1000;
  if (['µg', 'ug', 'mcg'].includes(normalized)) return value / 1000;
  return null;
}

function normalizedBasisUnit(value: string): string {
  return value.trim().toLocaleLowerCase('de').replace(/\s+/g, ' ');
}

export default function UserProductForm({ onClose, onSaved, initialProduct, copyProduct, draftOwnerId }: UserProductFormProps) {
  const isEdit = initialProduct !== undefined;
  const sourceProduct = initialProduct ?? copyProduct;
  const navigationContext = useContext(UNSAFE_NavigationContext);
  const draftKey = draftOwnerId == null ? null : `${PRODUCT_DRAFT_KEY_PREFIX}:${draftOwnerId}`;

  const [name, setName] = useState(sourceProduct?.name ? `${sourceProduct.name}${copyProduct ? ' – Kopie' : ''}` : '');
  const [brand, setBrand] = useState(sourceProduct?.brand ?? '');
  const [form, setForm] = useState(sourceProduct?.form ?? '');
  const [price, setPrice] = useState(sourceProduct?.price != null ? formatInputNumber(sourceProduct.price) : '');
  const [imageUrl, setImageUrl] = useState(sourceProduct?.image_url ?? '');
  const [servingSize, setServingSize] = useState(
    sourceProduct?.serving_size != null ? formatInputNumber(sourceProduct.serving_size) : ''
  );
  const [servingUnit, setServingUnit] = useState(sourceProduct?.serving_unit ?? '');
  const [packageInputMode, setPackageInputMode] = useState<'units' | 'portions'>('portions');
  const [packageAmount, setPackageAmount] = useState(
    sourceProduct?.servings_per_container != null ? formatInputNumber(sourceProduct.servings_per_container) : ''
  );
  const [containerCount, setContainerCount] = useState(
    sourceProduct?.container_count != null ? formatInputNumber(sourceProduct.container_count) : '1'
  );
  const [shopLink, setShopLink] = useState(sourceProduct?.shop_link ?? '');
  const isAffiliate = Boolean(sourceProduct?.is_affiliate);
  const [notes, setNotes] = useState(sourceProduct?.notes ?? '');
  const [showIngredientSection, setShowIngredientSection] = useState(true);
  const [showExpertDetails, setShowExpertDetails] = useState(false);
  const [ingredientRows, setIngredientRows] = useState<IngredientFormRow[]>(() => {
    const mapped: IngredientFormRow[] = (sourceProduct?.ingredients ?? []).map((ingredient): IngredientFormRow => ({
      clientId: makeClientId(),
      ingredientId: ingredient.ingredient_id,
      ingredientName: ingredient.ingredient_name ?? `ID ${ingredient.ingredient_id}`,
      formId: ingredient.form_id ?? null,
      availableForms: [],
      quantity: ingredient.quantity == null ? '' : formatInputNumber(ingredient.quantity),
      unit: ingredient.unit ?? '',
      basisQuantity: ingredient.basis_quantity == null ? '' : formatInputNumber(ingredient.basis_quantity),
      basisUnit: ingredient.basis_unit ?? '',
      searchRelevant: Boolean(ingredient.search_relevant),
      parts: (ingredient.parts ?? []).map((part) => ({
        partId: part.part_id,
        partName: part.part_name ?? `Sub-Wirkstoff ${part.part_id}`,
        partStatus: part.part_status,
        quantity: part.quantity == null ? '' : formatInputNumber(part.quantity),
        unit: part.unit ?? '',
        basisQuantity: part.basis_quantity == null ? '' : formatInputNumber(part.basis_quantity),
        basisUnit: part.basis_unit ?? '',
        searchRelevant: Boolean(part.search_relevant),
      })),
    }));
    if (mapped.length > 0) return mapped;

    return [
      {
        clientId: makeClientId(),
        ingredientId: null,
        ingredientName: '',
        formId: null,
        availableForms: [],
        quantity: '',
        unit: '',
        basisQuantity: '',
        basisUnit: sourceProduct?.serving_unit ?? '',
        searchRelevant: true,
        parts: [],
      },
    ];
  });
  const [rowIngredientParts, setRowIngredientParts] = useState<Record<string, IngredientPartState>>({});
  const hydratedFormRowsRef = useRef(new Set<string>());

  const [showCrop, setShowCrop] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [draftRestored, setDraftRestored] = useState(false);
  const [draftHydrated, setDraftHydrated] = useState(false);
  const restoringPopRef = useRef(false);

  const isIngredientLimitReached = ingredientRows.length >= MAX_INGREDIENT_ROWS;
  const productFormOptions = useMemo(() => {
    const current = form.trim();
    return current && !FORM_OPTIONS.includes(current) ? [...FORM_OPTIONS, current] : FORM_OPTIONS;
  }, [form]);
  const servingUnitOptions = useMemo(() => {
    const normalized = servingUnit.trim();
    if (!normalized || SERVING_UNIT_OPTIONS.includes(normalized)) {
      return SERVING_UNIT_OPTIONS;
    }
    return [...SERVING_UNIT_OPTIONS, normalized];
  }, [servingUnit]);

  const formSnapshot = useMemo(() => JSON.stringify({
    brand,
    containerCount,
    form,
    imageUrl,
    ingredientRows: draftIngredientRows(ingredientRows),
    name,
    notes,
    packageAmount,
    packageInputMode,
    price,
    servingSize,
    servingUnit,
    shopLink,
  }), [
    brand,
    containerCount,
    form,
    imageUrl,
    ingredientRows,
    name,
    notes,
    packageAmount,
    packageInputMode,
    price,
    servingSize,
    servingUnit,
    shopLink,
  ]);
  const initialSnapshotRef = useRef(formSnapshot);
  const isDirty = formSnapshot !== initialSnapshotRef.current;

  useEffect(() => {
    if (isEdit || copyProduct) {
      setDraftHydrated(true);
      return;
    }
    try {
      window.localStorage.removeItem(LEGACY_PRODUCT_DRAFT_KEY);
      if (!draftKey) {
        setDraftHydrated(true);
        return;
      }
      const raw = window.localStorage.getItem(draftKey);
      if (!raw) {
        setDraftHydrated(true);
        return;
      }
      const parsed = JSON.parse(raw) as Record<string, unknown>;
      const readText = (key: string) => typeof parsed[key] === 'string' ? String(parsed[key]) : '';
      setName(readText('name'));
      setBrand(readText('brand'));
      setForm(readText('form'));
      setPrice(normalizeDraftNumber(parsed.price));
      setImageUrl(readText('imageUrl'));
      setServingSize(normalizeDraftNumber(parsed.servingSize));
      setServingUnit(readText('servingUnit'));
      setPackageAmount(normalizeDraftNumber(parsed.packageAmount));
      setContainerCount(normalizeDraftNumber(parsed.containerCount) || '1');
      setShopLink(readText('shopLink'));
      setNotes(readText('notes'));
      setPackageInputMode(parsed.packageInputMode === 'units' ? 'units' : 'portions');
      if (Array.isArray(parsed.ingredientRows)) {
        const restoredRows = parsed.ingredientRows.flatMap((entry): IngredientFormRow[] => {
          if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return [];
          const row = entry as Partial<IngredientFormRow>;
          return [{
            clientId: makeClientId(),
            ingredientId: typeof row.ingredientId === 'number' ? row.ingredientId : null,
            ingredientName: typeof row.ingredientName === 'string' ? row.ingredientName : '',
            formId: typeof row.formId === 'number' ? row.formId : null,
            availableForms: [],
            quantity: normalizeDraftNumber(row.quantity),
            unit: typeof row.unit === 'string' ? row.unit : '',
            basisQuantity: normalizeDraftNumber(row.basisQuantity),
            basisUnit: typeof row.basisUnit === 'string' ? row.basisUnit : '',
            searchRelevant: row.searchRelevant !== false,
            parts: restoreDraftParts(row.parts),
          }];
        });
        if (restoredRows.length > 0) setIngredientRows(restoredRows);
      }
      setDraftRestored(true);
    } catch {
      if (draftKey) window.localStorage.removeItem(draftKey);
    } finally {
      setDraftHydrated(true);
    }
  }, [copyProduct, draftKey, isEdit]);

  useEffect(() => {
    if (!draftHydrated || !draftKey || isEdit || !isDirty) return;
    const timer = window.setTimeout(() => {
      const snapshot = JSON.parse(formSnapshot) as Record<string, unknown>;
      if (typeof snapshot.imageUrl === 'string' && snapshot.imageUrl.startsWith('data:')) {
        snapshot.imageUrl = '';
      }
      window.localStorage.setItem(draftKey, JSON.stringify(snapshot));
    }, 400);
    return () => window.clearTimeout(timer);
  }, [draftHydrated, draftKey, formSnapshot, isDirty, isEdit]);

  useEffect(() => {
    if (!isDirty) return;
    const warnBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', warnBeforeUnload);
    return () => window.removeEventListener('beforeunload', warnBeforeUnload);
  }, [isDirty]);

  useEffect(() => {
    if (!isDirty) {
      restoringPopRef.current = false;
      return;
    }
    const guardBrowserBack = (event: PopStateEvent) => {
      if (restoringPopRef.current) {
        restoringPopRef.current = false;
        return;
      }
      if (window.confirm(DISCARD_CHANGES_MESSAGE)) return;
      event.stopImmediatePropagation();
      restoringPopRef.current = true;
      window.history.go(1);
    };
    window.addEventListener('popstate', guardBrowserBack, true);
    return () => {
      window.removeEventListener('popstate', guardBrowserBack, true);
      restoringPopRef.current = false;
    };
  }, [isDirty]);

  useEffect(() => {
    if (!isDirty || !navigationContext?.navigator) return;
    const navigator = navigationContext.navigator;
    const originalPush = navigator.push;
    const originalReplace = navigator.replace;
    const confirmNavigation = () => window.confirm(DISCARD_CHANGES_MESSAGE);
    const guardedPush: typeof navigator.push = (...args) => {
      if (confirmNavigation()) originalPush.apply(navigator, args);
    };
    const guardedReplace: typeof navigator.replace = (...args) => {
      if (confirmNavigation()) originalReplace.apply(navigator, args);
    };
    navigator.push = guardedPush;
    navigator.replace = guardedReplace;
    return () => {
      if (navigator.push === guardedPush) navigator.push = originalPush;
      if (navigator.replace === guardedReplace) navigator.replace = originalReplace;
    };
  }, [isDirty, navigationContext?.navigator]);

  const requestClose = () => {
    if (!isDirty) {
      onClose();
      return;
    }
    const discard = window.confirm(DISCARD_CHANGES_MESSAGE);
    if (!discard) return;
    if (!isEdit && draftKey) window.localStorage.removeItem(draftKey);
    onClose();
  };

  const requestFormClose = () => {
    if (showCrop) {
      setShowCrop(false);
      return;
    }
    requestClose();
  };

  const clearFieldError = (key: string) => {
    setFieldErrors((current) => {
      if (!current[key]) return current;
      const next = { ...current };
      delete next[key];
      return next;
    });
  };

  const failField = (key: string, message: string, elementId = key) => {
    setFieldErrors({ [key]: message });
    setError('');
    window.setTimeout(() => document.getElementById(elementId)?.focus(), 0);
  };

  const packageEquivalence = useMemo(() => {
    const amount = parseDecimal(packageAmount);
    const unitsPerPortion = parseDecimal(servingSize);
    if (amount == null || amount <= 0 || unitsPerPortion == null || unitsPerPortion <= 0 || !servingUnit) return null;
    const units = packageInputMode === 'units' ? amount : amount * unitsPerPortion;
    const portions = packageInputMode === 'portions' ? amount : amount / unitsPerPortion;
    if (!Number.isFinite(units) || !Number.isFinite(portions)) return null;
    return {
      portions,
      text: packageInputMode === 'units'
        ? `${formatDisplayNumber(amount)} ${servingUnit} entsprechen ${formatDisplayNumber(portions)} Portionen.`
        : `${formatDisplayNumber(amount)} Portionen entsprechen ${formatDisplayNumber(units)} ${servingUnit}.`,
    };
  }, [packageAmount, packageInputMode, servingSize, servingUnit]);

  const changePackageInputMode = (nextMode: 'units' | 'portions') => {
    if (nextMode === packageInputMode) return;
    const amount = parseDecimal(packageAmount);
    const unitsPerPortion = parseDecimal(servingSize);
    if (amount != null && amount > 0 && unitsPerPortion != null && unitsPerPortion > 0) {
      setPackageAmount(formatInputNumber(nextMode === 'units' ? amount * unitsPerPortion : amount / unitsPerPortion));
    }
    setPackageInputMode(nextMode);
    clearFieldError('packageAmount');
  };

  const defaultBasisUnit = () => servingUnit.trim();

  const createIngredientRow = (overrides: Partial<IngredientFormRow> = {}): IngredientFormRow => ({
    clientId: makeClientId(),
    ingredientId: null,
    ingredientName: '',
    formId: null,
    availableForms: [],
    quantity: '',
    unit: '',
    basisQuantity: '',
    basisUnit: defaultBasisUnit(),
    searchRelevant: true,
    parts: [],
    ...overrides,
  });

  const updateIngredientRow = (clientId: string, patch: Partial<IngredientFormRow>) => {
    setIngredientRows((rows) => rows.map((row) => (row.clientId === clientId ? { ...row, ...patch } : row)));
  };

  const clearIngredientPartState = (clientId: string) => {
    setRowIngredientParts((state) => {
      const next = { ...state };
      delete next[clientId];
      return next;
    });
  };

  const loadIngredientParts = async (clientId: string, ingredientId: number) => {
    setRowIngredientParts((state) => ({
      ...state,
      [clientId]: {
        items: [],
        loading: true,
      },
    }));

    try {
      const parts = await getIngredientParts(ingredientId);
      setRowIngredientParts((state) => ({
        ...state,
        [clientId]: {
          items: parts,
          loading: false,
        },
      }));
    } catch {
      setRowIngredientParts((state) => ({
        ...state,
        [clientId]: {
          items: [],
          loading: false,
        },
      }));
    }
  };

  useEffect(() => {
    ingredientRows.forEach((row) => {
      if (row.ingredientId != null && !rowIngredientParts[row.clientId]) {
        void loadIngredientParts(row.clientId, row.ingredientId);
      }
      if (
        row.ingredientId != null
        && row.availableForms.length === 0
        && !hydratedFormRowsRef.current.has(row.clientId)
      ) {
        hydratedFormRowsRef.current.add(row.clientId);
        void Promise.resolve(getIngredient(row.ingredientId))
          .then((detail) => updateIngredientRow(row.clientId, { availableForms: detail.forms ?? [] }))
          .catch(() => undefined);
      }
    });
  // The loaders are guarded per row; including their state would only repeat completed work.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ingredientRows]);

  const addIngredientRow = () => {
    if (isIngredientLimitReached) {
      setError(ROW_LIMIT_MESSAGE);
      setShowIngredientSection(true);
      return;
    }
    setError('');
    setIngredientRows((rows) => [...rows, createIngredientRow()]);
  };

  const removeIngredientRow = (clientId: string) => {
    setIngredientRows((rows) => {
      const next = rows.filter((row) => row.clientId !== clientId);
      if (next.length > 0) return next;
      return [createIngredientRow()];
    });
    clearIngredientPartState(clientId);
  };

  const handleSelectIngredient = async (clientId: string, ingredient: Ingredient) => {
    let forms = ingredient.forms ?? [];
    if (forms.length === 0) {
      try {
        const detail = await getIngredient(ingredient.id);
        forms = detail.forms ?? [];
      } catch {
        forms = [];
      }
    }
    updateIngredientRow(clientId, {
      ingredientId: ingredient.id,
      ingredientName: ingredient.name,
      formId: ingredient.matched_form_id ?? null,
      availableForms: forms,
      basisQuantity: servingSize.trim(),
      basisUnit: servingUnit.trim(),
      searchRelevant: true,
      parts: [],
    });
    clearFieldError(`ingredient-${clientId}`);
    await loadIngredientParts(clientId, ingredient.id);
  };

  const clearIngredientSelection = (clientId: string) => {
    updateIngredientRow(clientId, {
      ingredientId: null,
      ingredientName: '',
      formId: null,
      availableForms: [],
      quantity: '',
      unit: '',
      basisQuantity: '',
      basisUnit: defaultBasisUnit(),
      searchRelevant: true,
      parts: [],
    });
    clearIngredientPartState(clientId);
  };

  const getIngredientPartState = (clientId: string) => rowIngredientParts[clientId];

  const handleAddIngredientPart = (parentClientId: string, part: IngredientPartOption) => {
    setIngredientRows((rows) => {
      const parentRow = rows.find((row) => row.clientId === parentClientId);
      if (!parentRow || parentRow.ingredientId == null) {
        return rows;
      }

      const alreadyAdded = parentRow.parts.some((entry) => entry.partId === part.part_id);
      if (alreadyAdded) {
        setError('Dieser Sub-Wirkstoff wurde bereits hinzugefügt.');
        return rows;
      }

      setError('');
      return rows.map((row) => row.clientId === parentClientId ? {
        ...row,
        parts: [...row.parts, {
          partId: part.part_id,
          partName: part.part_name,
          partStatus: part.part_status,
          quantity: '',
          unit: row.unit,
          basisQuantity: row.basisQuantity && row.basisUnit ? row.basisQuantity : '',
          basisUnit: row.basisQuantity && row.basisUnit ? row.basisUnit : '',
          searchRelevant: true,
        }],
      } : row);
    });
  };

  const updateIngredientPart = (clientId: string, partId: number, patch: Partial<IngredientPartFormRow>) => {
    setIngredientRows((rows) => rows.map((row) => row.clientId === clientId ? {
      ...row,
      parts: row.parts.map((part) => part.partId === partId ? { ...part, ...patch } : part),
    } : row));
  };

  const removeIngredientPart = (clientId: string, partId: number) => {
    setIngredientRows((rows) => rows.map((row) => row.clientId === clientId ? {
      ...row,
      parts: row.parts.filter((part) => part.partId !== partId),
    } : row));
  };

  interface BuiltIngredientsResult {
    ingredients: UserProductIngredientType[];
    error?: string;
  }

  const buildIngredientRows = (): BuiltIngredientsResult => {
    const normalized: UserProductIngredientType[] = [];

    for (let index = 0; index < ingredientRows.length; index += 1) {
      const row = ingredientRows[index];
      const line = index + 1;
      const hasIngredient = row.ingredientId !== null;
      const hasQuantity = row.quantity.trim().length > 0;
      const hasUnit = row.unit.trim().length > 0;
      const hasBasisQuantity = row.basisQuantity.trim().length > 0;
      const hasBasisUnit = row.basisUnit.trim().length > 0;

      if (!hasIngredient) {
        if (hasQuantity || hasUnit || hasBasisQuantity || hasBasisUnit) {
          return {
            ingredients: [],
            error: `Bitte wähle in Zeile ${line} einen Wirkstoff aus.`,
          };
        }
        continue;
      }

      const parsedQuantity = parseDecimal(row.quantity);
      const parsedBasisQuantity = parseDecimal(row.basisQuantity);
      const trimmedBasisUnit = row.basisUnit.trim();

      if (hasBasisQuantity !== hasBasisUnit) {
        return {
          ingredients: [],
          error: `Wirkstoff ${line}: Bezugsmenge und Bezugseinheit müssen gemeinsam angegeben oder beide leer sein.`,
        };
      }

      if (row.searchRelevant) {
        if (!hasQuantity || !hasUnit) {
          return {
            ingredients: [],
            error: `Wirkstoff ${line}: Für Suche und Produktvergleich sind Menge und Einheit erforderlich.`,
          };
        }
        if (parsedQuantity == null || parsedQuantity <= 0) {
          return {
            ingredients: [],
            error: `Wirkstoff ${line}: Die Menge muss größer als 0 sein.`,
          };
        }
        if (hasBasisQuantity && (parsedBasisQuantity == null || parsedBasisQuantity <= 0)) {
          return {
            ingredients: [],
            error: `Wirkstoff ${line}: Bezugsgröße muss größer als 0 sein, falls angegeben.`,
          };
        }
      } else {
        if (hasQuantity && (parsedQuantity == null || parsedQuantity <= 0)) {
          return {
            ingredients: [],
            error: `Wirkstoff ${line}: Die Menge muss größer als 0 sein, falls angegeben.`,
          };
        }
        if (parsedBasisQuantity != null && parsedBasisQuantity <= 0) {
          return {
            ingredients: [],
            error: `Wirkstoff ${line}: Bezugsgröße muss positiv sein, falls angegeben.`,
          };
        }
        if (parsedBasisQuantity != null && !trimmedBasisUnit) {
          return {
            ingredients: [],
            error: `Wirkstoff ${line}: Bezugsgröße braucht eine Einheit, falls angegeben.`,
          };
        }
      }

      const ingredientId = row.ingredientId;
      if (ingredientId === null) {
        return {
          ingredients: [],
          error: `Wirkstoff ${line}: Interner Fehler - Wirkstoff-ID fehlt.`,
        };
      }

      const normalizedParts: IngredientPartAmount[] = [];
      for (const part of row.parts) {
        const partQuantity = parseDecimal(part.quantity);
        const partBasisQuantity = parseDecimal(part.basisQuantity);
        const partUnit = part.unit.trim();
        const partBasisUnit = part.basisUnit.trim();
        const hasPartBasisQuantity = part.basisQuantity.trim().length > 0;
        const hasPartBasisUnit = partBasisUnit.length > 0;

        if (part.searchRelevant && (!partUnit || partQuantity == null || partQuantity <= 0)) {
          return {
            ingredients: [],
            error: `${row.ingredientName}, davon ${part.partName}: Für Suche und Vergleich sind eine positive Menge und Einheit erforderlich.`,
          };
        }
        if (!part.searchRelevant && part.quantity.trim() && (partQuantity == null || partQuantity <= 0)) {
          return {
            ingredients: [],
            error: `${row.ingredientName}, davon ${part.partName}: Die Menge muss größer als 0 sein, falls angegeben.`,
          };
        }
        if (hasPartBasisQuantity !== hasPartBasisUnit) {
          return {
            ingredients: [],
            error: `${row.ingredientName}, davon ${part.partName}: Bezugsmenge und Bezugseinheit müssen gemeinsam angegeben oder beide leer sein.`,
          };
        }
        if (hasPartBasisQuantity && (partBasisQuantity == null || partBasisQuantity <= 0)) {
          return {
            ingredients: [],
            error: `${row.ingredientName}, davon ${part.partName}: Die Bezugsgröße muss positiv sein.`,
          };
        }
        normalizedParts.push({
          part_id: part.partId,
          part_name: part.partName,
          part_status: part.partStatus,
          quantity: partQuantity,
          unit: partUnit || null,
          basis_quantity: partBasisQuantity,
          basis_unit: partBasisUnit || null,
          search_relevant: part.searchRelevant ? 1 : 0,
        });
      }

      if (parsedQuantity != null && parsedQuantity > 0 && parsedBasisQuantity != null && parsedBasisQuantity > 0) {
        const parentMass = massInMilligrams(parsedQuantity, row.unit);
        const parentBasisUnit = normalizedBasisUnit(trimmedBasisUnit);
        if (parentMass != null && parentBasisUnit) {
          const comparablePartTotal = normalizedParts.reduce<number | null>((total, part) => {
            if (total == null || part.quantity == null || !part.unit) return total;
            const partMass = massInMilligrams(part.quantity, part.unit);
            const partBasis = part.basis_quantity ?? parsedBasisQuantity;
            const partBasisUnit = normalizedBasisUnit(part.basis_unit ?? trimmedBasisUnit);
            if (partMass == null || partBasis <= 0 || partBasisUnit !== parentBasisUnit) return null;
            return total + (partMass / partBasis);
          }, 0);
          if (comparablePartTotal != null && comparablePartTotal > (parentMass / parsedBasisQuantity) + 1e-9) {
            return {
              ingredients: [],
              error: `${row.ingredientName}: Die Summe der vergleichbaren Teilmengen darf die Hauptmenge nicht überschreiten.`,
            };
          }
        }
      }

      normalized.push({
        ingredient_id: ingredientId,
        form_id: row.formId,
        quantity: hasQuantity ? parsedQuantity : null,
        unit: hasUnit ? row.unit.trim() : null,
        basis_quantity: parsedBasisQuantity,
        basis_unit: hasBasisUnit ? trimmedBasisUnit : null,
        search_relevant: row.searchRelevant ? 1 : 0,
        parts: normalizedParts,
      });
    }

    if (normalized.length === 0) {
      return {
        ingredients: [],
        error: 'Bitte mindestens einen Wirkstoff hinzufügen.',
      };
    }

    return { ingredients: normalized };
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError('');
    setFieldErrors({});

    const trimmedName = name.trim();
    if (!trimmedName) {
      failField('name', 'Bitte gib einen Produktnamen ein.');
      return;
    }

    const trimmedBrand = brand.trim();
    if (!trimmedBrand) {
      failField('brand', 'Bitte gib die Marke oder den Hersteller ein.');
      return;
    }

    if (!form) {
      failField('form', 'Bitte wähle die Produktform aus.');
      return;
    }

    const parsedPrice = parseDecimal(price);
    if (parsedPrice === null || parsedPrice <= 0) {
      failField('price', 'Bitte gib den Preis für eine Packung ein.');
      return;
    }

    const parsedServingSize = parseDecimal(servingSize);
    if (parsedServingSize === null || parsedServingSize <= 0) {
      failField('servingSize', 'Bitte gib an, aus wie vielen Einheiten eine Portion besteht.');
      return;
    }

    const trimmedServingUnit = servingUnit.trim();
    if (!trimmedServingUnit) {
      failField('servingUnit', 'Bitte wähle die Einheit der Portion aus.');
      return;
    }

    const parsedPackageAmount = parseDecimal(packageAmount);
    if (parsedPackageAmount === null || parsedPackageAmount <= 0) {
      failField('packageAmount', 'Bitte gib den Inhalt eines Behälters ein.');
      return;
    }
    const calculatedPortions = packageInputMode === 'portions'
      ? parsedPackageAmount
      : parsedPackageAmount / parsedServingSize;
    if (!Number.isInteger(calculatedPortions) || calculatedPortions <= 0) {
      failField(
        'packageAmount',
        `Der Packungsinhalt muss mit ${formatDisplayNumber(parsedServingSize)} ${trimmedServingUnit} pro Portion eine ganze Anzahl Portionen ergeben.`,
      );
      return;
    }
    const parsedServingsPerContainer = calculatedPortions;

    const parsedContainerCount = Number.parseInt(containerCount, 10);
    if (Number.isNaN(parsedContainerCount) || parsedContainerCount <= 0) {
      failField('containerCount', 'Bitte gib die Anzahl der Behälter in der Packung ein.');
      return;
    }

    if (ingredientRows.length > MAX_INGREDIENT_ROWS) {
      failField('ingredients', `${ROW_LIMIT_MESSAGE} Bitte entferne zuerst überzählige Einträge.`, 'ingredients-section');
      setShowIngredientSection(true);
      return;
    }

    const ingredientBuild = buildIngredientRows();
    if (ingredientBuild.error) {
      failField('ingredients', ingredientBuild.error, 'ingredients-section');
      setShowIngredientSection(true);
      return;
    }

    const normalizedIngredients = ingredientBuild.ingredients;

    const body: {
      name: string;
      brand: string;
      form: string;
      price: number;
      serving_size: number;
      serving_unit: string;
      servings_per_container: number;
      container_count: number;
      is_affiliate: number;
      image_url?: string | null;
      shop_link: string | null;
      notes: string | null;
      expected_version?: number;
      ingredients: UserProductIngredientType[];
    } = {
      name: trimmedName,
      brand: trimmedBrand,
      form,
      price: parsedPrice,
      serving_size: parsedServingSize,
      serving_unit: trimmedServingUnit,
      servings_per_container: parsedServingsPerContainer,
      container_count: parsedContainerCount,
      is_affiliate: isAffiliate ? 1 : 0,
      shop_link: shopLink.trim() || null,
      notes: notes.trim() || null,
      ingredients: normalizedIngredients,
    };
    if (isEdit) body.expected_version = initialProduct.version;
    if (imageUrl.trim()) body.image_url = imageUrl.trim();
    else if (isEdit && initialProduct?.image_url) body.image_url = null;

    setSubmitting(true);
    try {
      const url = isEdit ? `/api/user-products/${initialProduct!.id}` : '/api/user-products';
      const method = isEdit ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        credentials: 'include',
        headers: JSON_HEADERS,
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? 'Anfrage fehlgeschlagen.');
      }

      const data = await res.json();
      const responseProduct = data.product as UserProduct | undefined;
      if (!responseProduct || !Number.isSafeInteger(responseProduct.version) || responseProduct.version < 1) {
        throw new Error('Die gespeicherte Produktversion fehlt. Bitte lade die Seite neu.');
      }
      const saved: UserProduct = responseProduct;

      if (!isEdit && draftKey) window.localStorage.removeItem(draftKey);
      onSaved(saved);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unbekannter Fehler.';
      setError(message);
      if (message.includes('Wirkstoff') || message.includes('Menge') || message.includes('Bezugs') || message.includes('ingredient')) {
        setShowIngredientSection(true);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const renderIngredientParts = (row: IngredientFormRow) => {
    const state = getIngredientPartState(row.clientId);
    if ((!state || (!state.loading && state.items.length === 0)) && row.parts.length === 0) return null;

    if (state?.loading && row.parts.length === 0) {
      return <p className="text-xs text-gray-500">Weitere Details werden geladen…</p>;
    }

    const availableParts = state?.items ?? [];

    return (
      <div className="rounded-lg border border-indigo-100 bg-indigo-50/60 p-2 text-sm">
        <p className="text-xs font-semibold text-gray-700">Enthaltene Wirkstoffteile</p>
        <p className="mt-0.5 text-xs text-gray-500">
          Diese Teile werden nur dem gewählten Hauptwirkstoff zugeordnet. Sie erscheinen nie als eigener auswählbarer Wirkstoff.
        </p>
        <div className="mt-2 flex flex-wrap gap-2">
          {availableParts.filter((part) => !row.parts.some((entry) => entry.partId === part.part_id)).map((part) => (
            <button
              key={`${row.clientId}-${part.part_id}`}
              type="button"
              onClick={() => handleAddIngredientPart(row.clientId, part)}
              className="inline-flex items-center gap-1 rounded-md border border-indigo-200 bg-white px-2 py-1 text-xs text-indigo-700 transition hover:bg-indigo-50 disabled:cursor-not-allowed disabled:border-gray-200 disabled:text-gray-400"
            >
              <Plus size={12} />
              {`${part.part_name} hinzufügen`}
            </button>
          ))}
        </div>
        {row.parts.length > 0 && (
          <div className="mt-3 space-y-2">
            {row.parts.map((part) => (
              <fieldset key={part.partId} className="rounded-lg border border-indigo-100 bg-white p-2">
                <legend className="px-1 text-xs font-semibold text-indigo-800">
                  davon {part.partName}
                  {part.partStatus && part.partStatus !== 'active' ? ` (${part.partStatus === 'deprecated' ? 'veraltet' : 'inaktiv'})` : ''}
                </legend>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_1fr_auto_1fr_1fr_auto]">
                  <input
                    aria-label={`Menge ${part.partName}`}
                    type="number"
                    value={part.quantity}
                    onChange={(event) => updateIngredientPart(row.clientId, part.partId, { quantity: event.target.value })}
                    className={inputClass}
                    placeholder="Menge"
                    step="any"
                    min="0.000001"
                  />
                  <input
                    aria-label={`Einheit ${part.partName}`}
                    value={part.unit}
                    onChange={(event) => updateIngredientPart(row.clientId, part.partId, { unit: event.target.value })}
                    className={inputClass}
                    placeholder="z. B. mg"
                  />
                  <span className="self-center text-xs text-gray-500">pro</span>
                  <input
                    aria-label={`Bezugsgröße ${part.partName}`}
                    type="number"
                    value={part.basisQuantity}
                    onChange={(event) => updateIngredientPart(row.clientId, part.partId, { basisQuantity: event.target.value })}
                    className={inputClass}
                    placeholder="Basis"
                    step="any"
                    min="0.000001"
                  />
                  <input
                    aria-label={`Bezugseinheit ${part.partName}`}
                    value={part.basisUnit}
                    onChange={(event) => updateIngredientPart(row.clientId, part.partId, { basisUnit: event.target.value })}
                    className={inputClass}
                    placeholder={row.basisUnit || defaultBasisUnit() || 'Einheit'}
                  />
                  <button
                    type="button"
                    onClick={() => removeIngredientPart(row.clientId, part.partId)}
                    className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50"
                    aria-label={`${part.partName} entfernen`}
                  >
                    <X size={14} />
                  </button>
                </div>
                <label className="mt-2 inline-flex items-center gap-2 text-xs text-gray-600">
                  <input
                    type="checkbox"
                    checked={part.searchRelevant}
                    onChange={(event) => updateIngredientPart(row.clientId, part.partId, { searchRelevant: event.target.checked })}
                    className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  Produkt auch über diesen enthaltenen Wirkstoffteil finden
                </label>
              </fieldset>
            ))}
          </div>
        )}
      </div>
    );
  };

  const renderIngredientSection = () => (
    <div id="ingredients-section" className="border border-indigo-100 rounded-2xl overflow-hidden" tabIndex={-1}>
      <button
        type="button"
        onClick={() => setShowIngredientSection((prev) => !prev)}
        className="w-full px-4 py-3 bg-indigo-50 flex items-center justify-between gap-2 text-sm font-medium text-indigo-700"
      >
        <span>3. Wirkstoffe</span>
        <span className="flex items-center gap-2 text-xs">
          {ingredientRows.length} Eintrag{ingredientRows.length === 1 ? '' : 'e'}
          {showIngredientSection ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </span>
      </button>

      {showIngredientSection && (
        <div className="p-3 space-y-3">
          <p className="text-sm text-gray-600">
            Suche den Wirkstoff, der auf dem Etikett steht. Die Suche berücksichtigt auch enthaltene Wirkstoffteile:
            Suchst du zum Beispiel nach EPA, findest du den zugehörigen Omega-3-Hauptwirkstoff.
          </p>
          <button
            type="button"
            onClick={() => setShowExpertDetails((current) => !current)}
            className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            aria-expanded={showExpertDetails}
          >
            {showExpertDetails ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            Weitere Angaben für Experten
          </button>

          {fieldErrors.ingredients && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
              {fieldErrors.ingredients}
            </p>
          )}

          {ingredientRows.map((row, index) => (
            <div
              key={row.clientId}
              className="border border-gray-100 rounded-xl bg-white p-3 space-y-3"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 space-y-1">
                  <label className={labelClass}>Wirkstoff {index + 1}</label>
                  <p className="text-sm text-gray-700 min-h-6">
                    {row.ingredientName || 'Noch nicht ausgewählt'}
                  </p>
                  <SearchBar
                    onSelect={(ingredient) => handleSelectIngredient(row.clientId, ingredient)}
                    placeholder={row.ingredientId ? 'Anderen Wirkstoff suchen' : 'Wirkstoff suchen'}
                  />
                  {showExpertDetails && row.ingredientId && row.availableForms && row.availableForms.length > 0 && (
                    <label className="mt-2 flex flex-col gap-1 text-sm font-medium text-gray-700">
                      Darreichungsform dieses Wirkstoffs
                      <select
                        value={row.formId ?? ''}
                        onChange={(e) =>
                          updateIngredientRow(row.clientId, {
                            formId: e.target.value ? Number(e.target.value) : null,
                          })
                        }
                        className={inputClass}
                      >
                        <option value="">Keine besondere Form angegeben</option>
                        {row.availableForms.map((ingredientForm) => (
                          <option key={ingredientForm.id ?? ingredientForm.name} value={ingredientForm.id ?? ''}>
                            {ingredientForm.name}
                          </option>
                        ))}
                      </select>
                    </label>
                  )}
                  {row.ingredientId && (
                    <button
                      type="button"
                      onClick={() => clearIngredientSelection(row.clientId)}
                      className="text-xs text-indigo-700 underline hover:text-indigo-900"
                    >
                      Auswahl löschen
                    </button>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => removeIngredientRow(row.clientId)}
                  className="mt-6 h-9 w-9 inline-flex items-center justify-center rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50"
                  aria-label={`Wirkstoff ${index + 1} entfernen`}
                  title="Wirkstoff entfernen"
                >
                  <X size={14} />
                </button>
              </div>

              <div>
                <label className={labelClass}>
                  Wirkstoffmenge pro Portion
                  {row.searchRelevant && <span className="text-red-500 ml-1">*</span>}
                </label>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <input
                    type="number"
                    value={row.quantity}
                    onChange={(e) => updateIngredientRow(row.clientId, { quantity: e.target.value })}
                    className={inputClass}
                    placeholder="z. B. 1000"
                    step="any"
                    min="0.000001"
                    aria-label={`Wirkstoffmenge ${row.ingredientName || index + 1}`}
                  />
                  <input
                    type="text"
                    value={row.unit}
                    onChange={(e) => updateIngredientRow(row.clientId, { unit: e.target.value })}
                    className={inputClass}
                    placeholder="z. B. mg"
                    aria-label={`Einheit der Wirkstoffmenge ${row.ingredientName || index + 1}`}
                  />
                </div>
                <p className={fieldHintClass}>
                  Gemeint ist die gesamte Wirkstoffmenge in einer Portion – nicht die Anzahl der Kapseln, Tropfen oder Löffel.
                </p>
              </div>

              {showExpertDetails && (
                <div className="space-y-3 rounded-xl bg-slate-50 p-3">
                  <div>
                    <p className="text-sm font-semibold text-slate-800">Bezugsangabe vom Etikett</p>
                    <p className="mb-2 text-xs text-slate-500">
                      Nur ändern, wenn die Wirkstoffmenge auf dem Etikett nicht für genau eine Portion angegeben ist.
                    </p>
                    <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
                      <input
                        type="number"
                        value={row.basisQuantity}
                        onChange={(e) => updateIngredientRow(row.clientId, { basisQuantity: e.target.value })}
                        className={inputClass}
                        placeholder={servingSize || 'z. B. 2'}
                        step="any"
                        min="0.000001"
                        aria-label={`Bezugsmenge ${row.ingredientName || index + 1}`}
                      />
                      <span className="text-xs text-slate-500">×</span>
                      <input
                        type="text"
                        value={row.basisUnit}
                        onChange={(e) => updateIngredientRow(row.clientId, { basisUnit: e.target.value })}
                        className={inputClass}
                        placeholder={defaultBasisUnit() || 'Einheit'}
                        aria-label={`Bezugseinheit ${row.ingredientName || index + 1}`}
                      />
                    </div>
                  </div>
                  <label className="flex items-start gap-2 text-sm text-gray-700">
                    <input
                      type="checkbox"
                      checked={row.searchRelevant}
                      onChange={(e) => updateIngredientRow(row.clientId, { searchRelevant: e.target.checked })}
                      className="mt-0.5 h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                    />
                    <span>
                      Dieses Produkt finden, wenn jemand nach {row.ingredientName || 'diesem Wirkstoff'} sucht.
                      <span className="mt-0.5 block text-xs text-gray-500">Empfohlen und deshalb bereits ausgewählt.</span>
                    </span>
                  </label>
                  {renderIngredientParts(row)}
                </div>
              )}
            </div>
          ))}

          {isIngredientLimitReached && (
            <p className="text-sm text-amber-700">{`${ROW_LIMIT_MESSAGE} Entferne zuerst einen Eintrag, um weitere hinzufügen zu können.`}</p>
          )}

          <button
            type="button"
            onClick={addIngredientRow}
            disabled={isIngredientLimitReached}
            className="inline-flex items-center gap-2 rounded-lg border border-dashed border-gray-300 px-3 py-2 text-sm text-gray-600 hover:border-gray-400 hover:text-gray-900 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Plus size={14} /> Wirkstoff hinzufügen
          </button>
        </div>
      )}
    </div>
  );

  return (
    <>
      <ModalWrapper
        onClose={requestFormClose}
        size="lg"
        title={isEdit ? 'Produkt bearbeiten' : copyProduct ? 'Bearbeitbare Kopie anlegen' : 'Neues Produkt erstellen'}
      >
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {copyProduct && (
            <p className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900">
              {copyProduct.visibility === 'public' || copyProduct.published_product_id != null
                ? 'Das öffentliche Original bleibt unverändert. Du erstellst eine private Kopie, die du bearbeiten kannst.'
                : 'Das geprüfte private Original bleibt unverändert. Du erstellst eine private Kopie, die du bearbeiten kannst.'}
            </p>
          )}
          {draftRestored && (
            <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900" role="status">
              Dein Entwurf aus diesem Browser wurde wiederhergestellt. Produktfotos werden nicht im Entwurf gespeichert.
            </p>
          )}

          <section className="space-y-4 rounded-2xl border border-slate-200 p-4" aria-labelledby="product-basics-heading">
            <div>
              <h3 id="product-basics-heading" className="font-bold text-slate-900">1. Produkt</h3>
              <p className="mt-1 text-sm text-slate-600">Übernimm Name, Marke und Produktform direkt von der Packung.</p>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label htmlFor="name" className={labelClass}>Produktname <span className="text-red-500">*</span></label>
                <input
                  id="name"
                  type="text"
                  value={name}
                  onChange={(e) => { setName(e.target.value); clearFieldError('name'); }}
                  className={inputClass}
                  placeholder="z. B. Omega-3 Fischöl"
                  aria-invalid={Boolean(fieldErrors.name)}
                  aria-describedby={fieldErrors.name ? 'name-error' : undefined}
                  autoFocus={!isEdit}
                />
                {fieldErrors.name && <p id="name-error" className="mt-1 text-sm text-red-700">{fieldErrors.name}</p>}
              </div>
              <div>
                <label htmlFor="brand" className={labelClass}>Marke / Hersteller <span className="text-red-500">*</span></label>
                <input
                  id="brand"
                  type="text"
                  value={brand}
                  onChange={(e) => { setBrand(e.target.value); clearFieldError('brand'); }}
                  className={inputClass}
                  placeholder="z. B. Sunday Natural"
                  aria-invalid={Boolean(fieldErrors.brand)}
                />
                {fieldErrors.brand && <p className="mt-1 text-sm text-red-700">{fieldErrors.brand}</p>}
              </div>
              <div>
                <label htmlFor="form" className={labelClass}>Produktform <span className="text-red-500">*</span></label>
                <select
                  id="form"
                  value={form}
                  onChange={(e) => { setForm(e.target.value); clearFieldError('form'); }}
                  className={inputClass}
                  aria-invalid={Boolean(fieldErrors.form)}
                >
                  <option value="">Bitte auswählen</option>
                  {productFormOptions.map((option) => <option key={option} value={option}>{option}</option>)}
                </select>
                {fieldErrors.form && <p className="mt-1 text-sm text-red-700">{fieldErrors.form}</p>}
              </div>
              <div>
                <label htmlFor="price" className={labelClass}>Packungspreis <span className="text-red-500">*</span></label>
                <input
                  id="price"
                  type="number"
                  inputMode="decimal"
                  value={price}
                  onChange={(e) => { setPrice(e.target.value); clearFieldError('price'); }}
                  className={inputClass}
                  placeholder="z. B. 29,99"
                  step="0.01"
                  min="0.01"
                  aria-invalid={Boolean(fieldErrors.price)}
                />
                <p className={fieldHintClass}>Preis für die gesamte Packung, nicht die Monatskosten.</p>
                {fieldErrors.price && <p className="mt-1 text-sm text-red-700">{fieldErrors.price}</p>}
              </div>
            </div>

            <div className="rounded-xl bg-slate-50 p-3">
              <label className={labelClass}>Produktfoto (optional)</label>
              <div className="flex items-start gap-4 max-[430px]:flex-col">
                <div className="relative flex-shrink-0">
                  {imageUrl ? (
                    <img
                      src={imageUrl}
                      alt="Vorschau des Produktfotos"
                      className="h-20 w-20 rounded-xl border-2 border-indigo-100 object-cover"
                      onError={(event) => { (event.currentTarget as HTMLImageElement).style.display = 'none'; }}
                    />
                  ) : (
                    <div className="flex h-20 w-20 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-100 to-purple-100 text-xs text-slate-500">Kein Foto</div>
                  )}
                  {imageUrl && (
                    <button
                      type="button"
                      onClick={() => {
                        if (window.confirm('Möchtest du das Produktfoto wirklich entfernen?')) setImageUrl('');
                      }}
                      className="absolute -right-2 -top-2 flex h-9 w-9 items-center justify-center rounded-full bg-red-600 text-white hover:bg-red-700"
                      aria-label="Produktfoto entfernen"
                    ><X size={14} /></button>
                  )}
                </div>
                <div className="flex flex-1 flex-col gap-2 max-[430px]:w-full">
                  <button
                    type="button"
                    onClick={() => setShowCrop(true)}
                    className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-indigo-200 bg-white px-3 py-2 text-sm font-medium text-indigo-700 hover:bg-indigo-50"
                  >
                    <Camera size={16} /> {imageUrl ? 'Foto ändern' : 'Foto hochladen'}
                  </button>
                  <p className="text-xs leading-relaxed text-slate-500">
                    JPEG, PNG oder WebP, höchstens 10 MB. Lade nur ein Foto hoch, das du verwenden darfst. Das Bild wird als Teil deiner Produktangaben gespeichert.
                  </p>
                  <details className="text-sm text-slate-600">
                    <summary className="cursor-pointer font-medium">Stattdessen Bildadresse verwenden</summary>
                    <input
                      type="url"
                      value={imageUrl.startsWith('data:') ? '' : imageUrl}
                      onChange={(e) => setImageUrl(e.target.value)}
                      className={`${inputClass} mt-2`}
                      placeholder="https://…"
                    />
                    <p className={fieldHintClass}>Die fremde Website kann beim Laden des Bildes technische Zugriffsdaten erhalten.</p>
                  </details>
                </div>
              </div>
            </div>
          </section>

          <section className="space-y-4 rounded-2xl border border-slate-200 p-4" aria-labelledby="packaging-heading">
            <div>
              <h3 id="packaging-heading" className="font-bold text-slate-900">2. Packung und Portion</h3>
              <p className="mt-1 text-sm text-slate-600">Damit Reichweite und Monatskosten später korrekt berechnet werden.</p>
            </div>
            <div>
              <label className={labelClass}>Eine Portion besteht aus <span className="text-red-500">*</span></label>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <input
                  id="servingSize"
                  type="number"
                  inputMode="decimal"
                  value={servingSize}
                  onChange={(e) => { setServingSize(e.target.value); clearFieldError('servingSize'); }}
                  className={inputClass}
                  placeholder="z. B. 2"
                  step="any"
                  min="0.000001"
                  aria-label="Anzahl Einheiten pro Portion"
                  aria-invalid={Boolean(fieldErrors.servingSize)}
                />
                <select
                  id="servingUnit"
                  value={servingUnit}
                  onChange={(e) => { setServingUnit(e.target.value); clearFieldError('servingUnit'); }}
                  className={inputClass}
                  aria-label="Einheit der Portion"
                  aria-invalid={Boolean(fieldErrors.servingUnit)}
                >
                  <option value="">Einheit auswählen</option>
                  {servingUnitOptions.map((option) => <option key={option} value={option}>{option}</option>)}
                </select>
              </div>
              {(fieldErrors.servingSize || fieldErrors.servingUnit) && (
                <p className="mt-1 text-sm text-red-700">{fieldErrors.servingSize ?? fieldErrors.servingUnit}</p>
              )}
            </div>

            <fieldset>
              <legend className={labelClass}>Packungsinhalt angeben als</legend>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <label className={`flex min-h-11 cursor-pointer items-center gap-2 rounded-xl border px-3 py-2 text-sm ${packageInputMode === 'units' ? 'border-indigo-400 bg-indigo-50 text-indigo-900' : 'border-slate-200'}`}>
                  <input type="radio" name="package-mode" checked={packageInputMode === 'units'} onChange={() => changePackageInputMode('units')} />
                  {servingUnit || 'Einheiten'}
                </label>
                <label className={`flex min-h-11 cursor-pointer items-center gap-2 rounded-xl border px-3 py-2 text-sm ${packageInputMode === 'portions' ? 'border-indigo-400 bg-indigo-50 text-indigo-900' : 'border-slate-200'}`}>
                  <input type="radio" name="package-mode" checked={packageInputMode === 'portions'} onChange={() => changePackageInputMode('portions')} />
                  Portionen
                </label>
              </div>
            </fieldset>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="packageAmount" className={labelClass}>
                  {packageInputMode === 'units' ? `${servingUnit || 'Einheiten'} pro Behälter` : 'Portionen pro Behälter'} <span className="text-red-500">*</span>
                </label>
                <input
                  id="packageAmount"
                  type="number"
                  inputMode="decimal"
                  value={packageAmount}
                  onChange={(e) => { setPackageAmount(e.target.value); clearFieldError('packageAmount'); }}
                  className={inputClass}
                  placeholder={packageInputMode === 'units' ? 'z. B. 360' : 'z. B. 180'}
                  step="any"
                  min="0.000001"
                  aria-invalid={Boolean(fieldErrors.packageAmount)}
                />
                {fieldErrors.packageAmount && <p className="mt-1 text-sm text-red-700">{fieldErrors.packageAmount}</p>}
              </div>
              <div>
                <label htmlFor="containerCount" className={labelClass}>Behälter in dieser Packung <span className="text-red-500">*</span></label>
                <input
                  id="containerCount"
                  type="number"
                  inputMode="numeric"
                  value={containerCount}
                  onChange={(e) => { setContainerCount(e.target.value); clearFieldError('containerCount'); }}
                  className={inputClass}
                  placeholder="z. B. 1"
                  step="1"
                  min="1"
                  aria-invalid={Boolean(fieldErrors.containerCount)}
                />
                {fieldErrors.containerCount && <p className="mt-1 text-sm text-red-700">{fieldErrors.containerCount}</p>}
              </div>
            </div>
            {packageEquivalence && (
              <p className="flex items-start gap-2 rounded-xl bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-900" aria-live="polite">
                <Info className="mt-0.5 shrink-0" size={16} /> {packageEquivalence.text}
              </p>
            )}
          </section>

          {renderIngredientSection()}

          <details className="rounded-2xl border border-slate-200 p-4">
            <summary className="cursor-pointer font-bold text-slate-900">4. Weitere freiwillige Angaben</summary>
            <div className="mt-4 space-y-4">
              <div>
                <label htmlFor="shopLink" className={labelClass}>Shop-Link</label>
                <input id="shopLink" type="url" value={shopLink} onChange={(e) => setShopLink(e.target.value)} className={inputClass} placeholder="https://…" />
              </div>
              <div>
                <label htmlFor="notes" className={labelClass}>Persönliche Notizen</label>
                <textarea id="notes" value={notes} onChange={(e) => setNotes(e.target.value)} className={inputClass} rows={3} placeholder="Was möchtest du zu diesem Produkt festhalten?" />
                <p className={fieldHintClass}>Diese Notiz ist nur in deinem Konto sichtbar.</p>
              </div>
            </div>
          </details>

          {error && <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">{error}</p>}

          <div className="flex justify-end gap-3 pt-1 max-[430px]:flex-col">
            <button
              type="button"
              onClick={requestClose}
              className="min-h-11 rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
            >
              Abbrechen
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="min-h-11 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 px-4 py-3 text-sm font-semibold text-white shadow-sm transition-all hover:from-indigo-600 hover:to-purple-700 disabled:opacity-60"
            >
              {submitting ? 'Speichere…' : isEdit ? 'Änderungen speichern' : copyProduct ? 'Private Kopie erstellen' : 'Produkt erstellen'}
            </button>
          </div>
        </form>
      </ModalWrapper>

      {showCrop && (
        <ImageCropModal
          currentImageUrl={imageUrl || undefined}
          onCrop={(dataUrl) => {
            setImageUrl(dataUrl);
            setShowCrop(false);
          }}
          onClose={() => setShowCrop(false)}
        />
      )}
    </>
  );
}
