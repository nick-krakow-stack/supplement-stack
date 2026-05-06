import { type FormEvent, useMemo, useState } from 'react';
import ModalWrapper from './ModalWrapper';
import ImageCropModal from '../ImageCropModal';
import SearchBar from '../SearchBar';
import { Camera, ChevronDown, ChevronUp, Plus, X } from 'lucide-react';
import { getIngredient, getSubIngredients } from '../../api/ingredients';
import type {
  Ingredient,
  IngredientSubIngredient,
  UserProductIngredient as UserProductIngredientType,
} from '../../types/local';

export interface UserProduct {
  id: number;
  user_id?: number;
  name: string;
  brand?: string;
  form?: string;
  price: number;
  shop_link?: string;
  image_url?: string;
  serving_size?: number;
  serving_unit?: string;
  servings_per_container?: number;
  container_count?: number;
  is_affiliate?: number | boolean;
  notes?: string;
  status?: 'pending' | 'approved' | 'rejected';
  approved_at?: string | null;
  created_at?: string;
  published_product_id?: number | null;
  ingredients?: UserProductIngredientType[];
}

interface UserProductFormProps {
  onClose: () => void;
  onSaved: (product: UserProduct) => void;
  initialProduct?: UserProduct;
}

interface IngredientSubIngredientState {
  items: IngredientSubIngredient[];
  loading: boolean;
}

interface IngredientFormRow {
  clientId: string;
  ingredientId: number | null;
  ingredientName: string;
  formId: number | null;
  availableForms: Ingredient['forms'];
  quantity: string;
  unit: string;
  basisQuantity: string;
  basisUnit: string;
  searchRelevant: boolean;
  parentIngredientId: number | null;
  parentIngredientName?: string;
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

const FORM_OPTIONS = ['Kapsel', 'Tablette', 'Pulver', 'Tropfen', 'Gel', 'Sonstige'];
const SERVING_UNIT_OPTIONS = [
  'Kapsel',
  'Kapseln',
  'Tablette',
  'Tabletten',
  'Tropfen',
  'Portion',
  'Portionen',
  'Messlöffel',
  'Esslöffel',
  'Teelöffel',
  'Softgel',
  'Softgels',
  'ml',
  'g',
  'Sonstige',
];

const MAX_INGREDIENT_ROWS = 50;
const ROW_LIMIT_MESSAGE = 'Maximal 50 Wirkstoffe sind erlaubt.';

const labelClass = 'block text-sm font-medium text-gray-700 mb-1';
const inputClass =
  'w-full border border-gray-200 rounded-xl px-4 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent text-sm';
const fieldHintClass = 'text-xs text-gray-500 mt-1';

const makeClientId = () => `ingredient_${Date.now()}_${Math.random().toString(16).slice(2)}`;

export default function UserProductForm({ onClose, onSaved, initialProduct }: UserProductFormProps) {
  const isEdit = initialProduct !== undefined;

  const [name, setName] = useState(initialProduct?.name ?? '');
  const [brand, setBrand] = useState(initialProduct?.brand ?? '');
  const [form, setForm] = useState(initialProduct?.form ?? '');
  const [price, setPrice] = useState(initialProduct?.price != null ? String(initialProduct.price) : '');
  const [imageUrl, setImageUrl] = useState(initialProduct?.image_url ?? '');
  const [servingSize, setServingSize] = useState(
    initialProduct?.serving_size != null ? String(initialProduct.serving_size) : ''
  );
  const [servingUnit, setServingUnit] = useState(initialProduct?.serving_unit ?? '');
  const [servingsPerContainer, setServingsPerContainer] = useState(
    initialProduct?.servings_per_container != null ? String(initialProduct.servings_per_container) : ''
  );
  const [containerCount, setContainerCount] = useState(
    initialProduct?.container_count != null ? String(initialProduct.container_count) : '1'
  );
  const [shopLink, setShopLink] = useState(initialProduct?.shop_link ?? '');
  const isAffiliate = Boolean(initialProduct?.is_affiliate);
  const [notes, setNotes] = useState(initialProduct?.notes ?? '');
  const [showIngredientSection, setShowIngredientSection] = useState(true);
  const [ingredientRows, setIngredientRows] = useState<IngredientFormRow[]>(() => {
    const mapped: IngredientFormRow[] = (initialProduct?.ingredients ?? []).map((ingredient): IngredientFormRow => ({
      clientId: makeClientId(),
      ingredientId: ingredient.ingredient_id,
      ingredientName: ingredient.ingredient_name ?? `ID ${ingredient.ingredient_id}`,
      formId: ingredient.form_id ?? null,
      availableForms: [],
      quantity: ingredient.quantity == null ? '' : String(ingredient.quantity),
      unit: ingredient.unit ?? '',
      basisQuantity: ingredient.basis_quantity == null ? '1' : String(ingredient.basis_quantity),
      basisUnit: ingredient.basis_unit ?? '',
      searchRelevant: Boolean(ingredient.search_relevant),
      parentIngredientId: ingredient.parent_ingredient_id ?? null,
    }));

    if (mapped.length > 0) {
      const ingredientNameById = new Map<number, string>();
      for (const row of mapped) {
        if (row.ingredientId != null && row.ingredientName) {
          ingredientNameById.set(row.ingredientId, row.ingredientName);
        }
      }
      mapped.forEach((row) => {
        if (row.parentIngredientId != null && row.parentIngredientName == null) {
          row.parentIngredientName = ingredientNameById.get(row.parentIngredientId);
        }
      });
      return mapped;
    }

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
        basisUnit: initialProduct?.serving_unit ?? '',
        searchRelevant: true,
        parentIngredientId: null,
      },
    ];
  });
  const [rowSubIngredients, setRowSubIngredients] = useState<Record<string, IngredientSubIngredientState>>({});

  const [showCrop, setShowCrop] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const isIngredientLimitReached = ingredientRows.length >= MAX_INGREDIENT_ROWS;
  const servingUnitOptions = useMemo(() => {
    const normalized = servingUnit.trim();
    if (!normalized || SERVING_UNIT_OPTIONS.includes(normalized)) {
      return SERVING_UNIT_OPTIONS;
    }
    return [...SERVING_UNIT_OPTIONS, normalized];
  }, [servingUnit]);

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
    parentIngredientId: null,
    ...overrides,
  });

  const updateIngredientRow = (clientId: string, patch: Partial<IngredientFormRow>) => {
    setIngredientRows((rows) => rows.map((row) => (row.clientId === clientId ? { ...row, ...patch } : row)));
  };

  const clearSubIngredientState = (clientId: string) => {
    setRowSubIngredients((state) => {
      const next = { ...state };
      delete next[clientId];
      return next;
    });
  };

  const loadSubIngredients = async (clientId: string, ingredientId: number) => {
    setRowSubIngredients((state) => ({
      ...state,
      [clientId]: {
        items: [],
        loading: true,
      },
    }));

    try {
      const subIngredients = await getSubIngredients(ingredientId);
      setRowSubIngredients((state) => ({
        ...state,
        [clientId]: {
          items: subIngredients,
          loading: false,
        },
      }));
    } catch {
      setRowSubIngredients((state) => ({
        ...state,
        [clientId]: {
          items: [],
          loading: false,
        },
      }));
    }
  };

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
    clearSubIngredientState(clientId);
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
      formId: null,
      availableForms: forms,
      parentIngredientId: null,
      parentIngredientName: undefined,
    });
    await loadSubIngredients(clientId, ingredient.id);
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
      parentIngredientId: null,
      parentIngredientName: undefined,
    });
    clearSubIngredientState(clientId);
  };

  const parseDecimal = (value: string): number | null => {
    const normalized = value.trim().replace(',', '.');
    if (!normalized) return null;
    const parsed = Number.parseFloat(normalized);
    return Number.isFinite(parsed) ? parsed : null;
  };

  const getSubIngredientState = (clientId: string) => rowSubIngredients[clientId];

  const handleAddSubIngredient = (parentClientId: string, subIngredient: IngredientSubIngredient) => {
    if (isIngredientLimitReached) {
      setError(ROW_LIMIT_MESSAGE);
      setShowIngredientSection(true);
      return;
    }

    setIngredientRows((rows) => {
      const parentRow = rows.find((row) => row.clientId === parentClientId);
      if (!parentRow || parentRow.ingredientId == null) {
        return rows;
      }

      const alreadyAdded = rows.some(
        (row) =>
          row.parentIngredientId === parentRow.ingredientId &&
          row.ingredientId === subIngredient.child_ingredient_id
      );
      if (alreadyAdded) {
        setError('Dieser Unterwirkstoff wurde bereits hinzugefügt.');
        return rows;
      }

      setError('');
      return [
        ...rows,
        createIngredientRow({
          ingredientId: subIngredient.child_ingredient_id,
          ingredientName: subIngredient.child_name,
          unit: subIngredient.child_unit ?? '',
          quantity: '',
          basisQuantity: parentRow.basisQuantity,
          basisUnit: parentRow.basisUnit || defaultBasisUnit(),
          searchRelevant: true,
          parentIngredientId: parentRow.ingredientId,
          parentIngredientName: parentRow.ingredientName,
        }),
      ];
    });
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
        if (parsedBasisQuantity == null || parsedBasisQuantity <= 0) {
          return {
            ingredients: [],
            error: `Wirkstoff ${line}: Bezugsgröße ist für die Suche erforderlich und muss größer als 0 sein.`,
          };
        }
        if (!trimmedBasisUnit) {
          return {
            ingredients: [],
            error: `Wirkstoff ${line}: Bezugsgröße braucht eine Einheit.`,
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

      normalized.push({
        ingredient_id: ingredientId,
        form_id: row.formId,
        quantity: hasQuantity ? parsedQuantity : null,
        unit: hasUnit ? row.unit.trim() : null,
        basis_quantity: parsedBasisQuantity == null ? 1 : parsedBasisQuantity,
        basis_unit: hasBasisUnit ? trimmedBasisUnit : row.basisUnit.trim(),
        search_relevant: row.searchRelevant ? 1 : 0,
        parent_ingredient_id: row.parentIngredientId,
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

    const trimmedName = name.trim();
    if (!trimmedName) {
      setError('Bitte einen Produktnamen eingeben.');
      return;
    }

    const trimmedBrand = brand.trim();
    if (!trimmedBrand) {
      setError('Bitte Marke oder Hersteller eingeben.');
      return;
    }

    if (!form) {
      setError('Bitte eine Produktform wählen.');
      return;
    }

    const parsedPrice = parseDecimal(price);
    if (parsedPrice === null || parsedPrice <= 0) {
      setError('Bitte einen gültigen Preis pro Packung eingeben.');
      return;
    }

    const parsedServingSize = parseDecimal(servingSize);
    if (parsedServingSize === null || parsedServingSize <= 0) {
      setError('Bitte eine gültige Portionsgröße eingeben.');
      return;
    }

    const trimmedServingUnit = servingUnit.trim();
    if (!trimmedServingUnit) {
      setError('Bitte eine Einheit pro Portion eingeben.');
      return;
    }

    const parsedServingsPerContainer = Number.parseInt(servingsPerContainer, 10);
    if (Number.isNaN(parsedServingsPerContainer) || parsedServingsPerContainer <= 0) {
      setError('Bitte die Portionen pro Behälter eingeben.');
      return;
    }

    const parsedContainerCount = Number.parseInt(containerCount, 10);
    if (Number.isNaN(parsedContainerCount) || parsedContainerCount <= 0) {
      setError('Bitte die Anzahl der Behälter eingeben.');
      return;
    }

    if (ingredientRows.length > MAX_INGREDIENT_ROWS) {
      setError(`${ROW_LIMIT_MESSAGE} Bitte entferne zuerst überzählige Einträge.`);
      setShowIngredientSection(true);
      return;
    }

    const ingredientBuild = buildIngredientRows();
    if (ingredientBuild.error) {
      setError(ingredientBuild.error);
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
      shop_link?: string;
      notes?: string;
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
      ingredients: normalizedIngredients,
    };
    if (imageUrl.trim()) body.image_url = imageUrl.trim();
    else if (isEdit && initialProduct?.image_url) body.image_url = null;
    if (shopLink.trim()) body.shop_link = shopLink.trim();
    if (notes.trim()) body.notes = notes.trim();

    setSubmitting(true);
    try {
      const url = isEdit ? `/api/user-products/${initialProduct!.id}` : '/api/user-products';
      const method = isEdit ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: authHeaders(),
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? 'Anfrage fehlgeschlagen.');
      }

      const data = await res.json();
      const responseProduct = data.product as UserProduct | undefined;
      const ingredientsForSave = responseProduct?.ingredients ?? normalizedIngredients;
      const saved: UserProduct = {
        ...(isEdit ? initialProduct! : { id: data.id, status: 'pending' }),
        ...(responseProduct ?? (body as UserProduct)),
        ingredients: ingredientsForSave,
      };

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

  const renderSubIngredientHint = (row: IngredientFormRow) => {
    const state = getSubIngredientState(row.clientId);
    if (!state || (!state.loading && state.items.length === 0)) return null;

    if (state.loading) {
      return <p className="text-xs text-gray-500">Weitere Details werden geladen…</p>;
    }

    if (!state.items.length) return null;

    return (
      <div className="rounded-lg border border-indigo-100 bg-indigo-50/60 p-2 text-sm">
        <p className="text-xs text-gray-700">Für diesen Wirkstoff können Details erfasst werden:</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {state.items.map((subIngredient) => (
            <button
              key={`${row.clientId}-${subIngredient.child_ingredient_id}`}
              type="button"
              onClick={() => handleAddSubIngredient(row.clientId, subIngredient)}
              disabled={isIngredientLimitReached}
              className="inline-flex items-center gap-1 rounded-md border border-indigo-200 bg-white px-2 py-1 text-xs text-indigo-700 transition hover:bg-indigo-50 disabled:cursor-not-allowed disabled:border-gray-200 disabled:text-gray-400"
            >
              <Plus size={12} />
              {isIngredientLimitReached ? 'Limit erreicht' : `+ ${subIngredient.child_name} hinzufügen`}
            </button>
          ))}
        </div>
      </div>
    );
  };

  const renderIngredientSection = () => (
    <div className="border border-indigo-100 rounded-2xl overflow-hidden">
      <button
        type="button"
        onClick={() => setShowIngredientSection((prev) => !prev)}
        className="w-full px-4 py-3 bg-indigo-50 flex items-center justify-between gap-2 text-sm font-medium text-indigo-700"
      >
        <span>Wirkstoffe</span>
        <span className="flex items-center gap-2 text-xs">
          {ingredientRows.length} Eintrag{ingredientRows.length === 1 ? '' : 'e'}
          {showIngredientSection ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </span>
      </button>

      {showIngredientSection && (
        <div className="p-3 space-y-3">
          <p className="text-xs text-gray-500">
            Tipp: Markiere den Haken nur bei Wirkstoffen, die für Suche und Produktvergleich genutzt werden sollen.
          </p>

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
                  {row.ingredientId && row.availableForms && row.availableForms.length > 0 && (
                    <label className="mt-2 flex flex-col gap-1 text-sm font-medium text-gray-700">
                      Wirkstoffform
                      <select
                        value={row.formId ?? ''}
                        onChange={(e) =>
                          updateIngredientRow(row.clientId, {
                            formId: e.target.value ? Number(e.target.value) : null,
                          })
                        }
                        className={inputClass}
                      >
                        <option value="">Basis-Wirkstoff / keine spezielle Form</option>
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
                  {row.parentIngredientId ? (
                    <p className="text-xs text-gray-500">
                      Teil von: {row.parentIngredientName ?? `Wirkstoff ${row.parentIngredientId}`}
                    </p>
                  ) : null}
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
                  Wirkstoffmenge pro Einheit
                  {row.searchRelevant && <span className="text-red-500 ml-1">*</span>}
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <input
                    type="number"
                    value={row.quantity}
                    onChange={(e) => updateIngredientRow(row.clientId, { quantity: e.target.value })}
                    className={inputClass}
                    placeholder="z.B. 1000"
                    step="any"
                    min="0.000001"
                  />
                  <input
                    type="text"
                    value={row.unit}
                    onChange={(e) => updateIngredientRow(row.clientId, { unit: e.target.value })}
                    className={inputClass}
                    placeholder="z.B. mg"
                  />
                  <label className="text-xs text-gray-500 self-end">pro</label>
                  <input
                    type="number"
                    value={row.basisQuantity}
                    onChange={(e) => updateIngredientRow(row.clientId, { basisQuantity: e.target.value })}
                    className={inputClass}
                    placeholder="z.B. 4"
                    step="any"
                    min="0.000001"
                  />
                  <input
                    type="text"
                    value={row.basisUnit}
                    onChange={(e) => updateIngredientRow(row.clientId, { basisUnit: e.target.value })}
                    className={inputClass}
                    placeholder={`z.B. ${defaultBasisUnit() || 'Stück'}`}
                  />
                  <div />
                </div>
                <p className={fieldHintClass}>Beispiel: 2000 IE pro 3 Tropfen oder 300 mg pro 2 Kapseln.</p>
                {row.searchRelevant && (
                  <p className={fieldHintClass}>
                    Für Such- und Vergleichsauswertung bitte Menge, Einheit und Bezugsgröße ausfüllen.
                  </p>
                )}
              </div>

              <label className="inline-flex items-center gap-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={row.searchRelevant}
                  onChange={(e) => updateIngredientRow(row.clientId, { searchRelevant: e.target.checked })}
                  className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                />
                Für Suche und Produktvergleich berücksichtigen
              </label>

              {renderSubIngredientHint(row)}
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
      <ModalWrapper onClose={onClose} title={isEdit ? 'Produkt bearbeiten' : 'Neues Produkt erstellen'}>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label className={labelClass}>Produktfoto</label>
            <div className="flex items-start gap-4 max-[430px]:flex-col">
              <div className="relative flex-shrink-0">
                {imageUrl ? (
                  <img
                    src={imageUrl}
                    alt="Vorschau"
                    className="w-16 h-16 rounded-full object-cover border-2 border-indigo-100"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = '';
                    }}
                  />
                ) : (
                  <div className="w-16 h-16 rounded-full bg-gradient-to-br from-indigo-100 to-purple-100 flex items-center justify-center text-xs text-slate-500 select-none">
                    IMG
                  </div>
                )}
                {imageUrl && (
                  <button
                    type="button"
                    onClick={() => setImageUrl('')}
                    className="absolute -right-2 -top-2 flex h-8 w-8 items-center justify-center rounded-full bg-red-500 text-white transition-colors hover:bg-red-600"
                    aria-label="Foto entfernen"
                  >
                    <X size={10} />
                  </button>
                )}
              </div>

              <div className="flex flex-1 flex-col gap-2 max-[430px]:w-full">
                <button
                  type="button"
                  onClick={() => setShowCrop(true)}
                  className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-xl border border-indigo-200 px-3 py-2 text-xs font-medium text-indigo-600 transition-colors hover:bg-indigo-50"
                >
                  <Camera size={14} />
                  {imageUrl ? 'Foto ändern' : 'Foto hochladen'}
                </button>
                <input
                  type="text"
                  value={imageUrl.startsWith('data:') ? '' : imageUrl}
                  onChange={(e) => setImageUrl(e.target.value)}
                  className={inputClass}
                  placeholder="oder Bild-URL einfügen"
                />
              </div>
            </div>
          </div>

          <div>
            <label className={labelClass}>
              Produktname <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={inputClass}
              placeholder="z.B. Omega-3 Fischöl"
              required
              autoFocus={!isEdit}
            />
          </div>

          <div>
            <label className={labelClass}>
              Marke / Hersteller <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={brand}
              onChange={(e) => setBrand(e.target.value)}
              className={inputClass}
              placeholder="z.B. Now Foods"
              required
            />
          </div>

          <div>
            <label className={labelClass}>
              Form <span className="text-red-500">*</span>
            </label>
            <select value={form} onChange={(e) => setForm(e.target.value)} className={inputClass} required>
              <option value="">-- bitte wählen --</option>
              {FORM_OPTIONS.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className={labelClass}>
              Preis pro Packung <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              className={inputClass}
              placeholder="z.B. 29.99 €"
              step="0.01"
              min="0.01"
              required
            />
          </div>

          <div>
            <label className={labelClass}>
              Dosierung pro Portion <span className="text-red-500">*</span>
            </label>
            <div className="flex gap-3 max-[430px]:flex-col">
              <input
                type="number"
                value={servingSize}
                onChange={(e) => setServingSize(e.target.value)}
                className={inputClass}
                placeholder="z.B. 1"
                step="any"
                min="0.01"
                required
              />
              <select
                value={servingUnit}
                onChange={(e) => setServingUnit(e.target.value)}
                className={inputClass}
                required
              >
                <option value="">-- bitte auswählen --</option>
                {servingUnitOptions.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </div>
            <p className="mt-1 text-xs text-gray-500">Beispiel: 400 mg pro 1 Kapsel</p>
          </div>

          <div>
            <label className={labelClass}>
              Packungsinhalt / Portionen <span className="text-red-500">*</span>
            </label>
            <div className="flex gap-3 max-[430px]:flex-col">
              <input
                type="number"
                value={servingsPerContainer}
                onChange={(e) => setServingsPerContainer(e.target.value)}
                className={inputClass}
                placeholder="Portionen pro Behälter, z.B. 60"
                step="1"
                min="1"
                required
              />
              <input
                type="number"
                value={containerCount}
                onChange={(e) => setContainerCount(e.target.value)}
                className={inputClass}
                placeholder="Anzahl Behälter, z.B. 1"
                step="1"
                min="1"
                required
              />
            </div>
          </div>

          {renderIngredientSection()}

          <div>
            <label className={labelClass}>Shop-Link</label>
            <input
              type="text"
              value={shopLink}
              onChange={(e) => setShopLink(e.target.value)}
              className={inputClass}
              placeholder="https://..."
            />
          </div>

          <div>
            <label className={labelClass}>Notizen</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className={inputClass}
              rows={3}
              placeholder="Persönliche Notizen zum Produkt."
            />
          </div>

          {error && <p className="text-sm text-red-600 bg-red-50 rounded-xl px-3 py-2">{error}</p>}

          <div className="flex justify-end gap-3 pt-1 max-[430px]:flex-col">
            <button
              type="button"
              onClick={onClose}
              className="min-h-11 rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
            >
              Abbrechen
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="min-h-11 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 px-4 py-3 text-sm font-semibold text-white shadow-sm transition-all hover:from-indigo-600 hover:to-purple-700 disabled:opacity-60"
            >
              {submitting ? 'Speichere…' : isEdit ? 'Speichern' : 'Erstellen'}
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
