import { useCallback, useEffect, useMemo, useState } from 'react';
import { CheckCircle, History, Loader2, Plus, Save, Search, Trash2, XCircle } from 'lucide-react';
import {
  type AdminDoseRecommendation,
  type AdminDoseRecommendationPayload,
  createDoseRecommendation,
  deleteDoseRecommendation,
  getDoseRecommendations,
  updateDoseRecommendation,
  type IngredientLookup,
  getAllIngredients,
  searchIngredients,
} from '../../api/admin';

type BooleanFlag = 0 | 1;

interface DoseDraft {
  ingredient_id: string;
  population_slug: string;
  source_type: string;
  source_label: string;
  source_url: string;
  dose_min: string;
  dose_max: string;
  unit: string;
  per_kg_body_weight: string;
  per_kg_cap: string;
  timing: string;
  context_note: string;
  sex_filter: string;
  is_athlete: string;
  purpose: string;
  is_default: string;
  is_active: string;
  is_public: string;
  relevance_score: string;
  verified_profile_id: string;
  category_name: string;
}

interface DraftErrors {
  [rowId: string]: string;
}

const SOURCE_TYPES = [
  { value: 'official', label: 'official' },
  { value: 'study', label: 'study' },
  { value: 'profile', label: 'profile' },
  { value: 'user_private', label: 'user_private' },
  { value: 'user_public', label: 'user_public' },
];

const PURPOSES = [
  { value: 'maintenance', label: 'Erhaltung / Orientierung' },
  { value: 'deficiency_correction', label: 'Mangel-Kontext' },
  { value: 'therapeutic', label: 'Ärztlich begleiteter Kontext' },
];

const SEX_FILTERS = [
  { value: '', label: 'Keine Einschränkung' },
  { value: 'male', label: 'männlich' },
  { value: 'female', label: 'weiblich' },
];

const PAGE_LIMIT_OPTIONS = [10, 20, 25, 50, 100];

function createBlankDraft(): DoseDraft {
  return {
    ingredient_id: '',
    population_slug: '',
    source_type: 'official',
    source_label: '',
    source_url: '',
    dose_min: '',
    dose_max: '',
    unit: 'mg',
    per_kg_body_weight: '',
    per_kg_cap: '',
    timing: '',
    context_note: '',
    sex_filter: '',
    is_athlete: '0',
    purpose: 'maintenance',
    is_default: '0',
    is_active: '1',
    is_public: '0',
    relevance_score: '50',
    verified_profile_id: '',
    category_name: '',
  };
}

function draftFromRow(row: AdminDoseRecommendation): DoseDraft {
  return {
    ingredient_id: String(row.ingredient_id ?? ''),
    population_slug: row.population_slug ?? '',
    source_type: row.source_type ?? 'official',
    source_label: row.source_label ?? '',
    source_url: row.source_url ?? '',
    dose_min: row.dose_min == null ? '' : String(row.dose_min),
    dose_max: row.dose_max == null ? '' : String(row.dose_max),
    unit: row.unit ?? 'mg',
    per_kg_body_weight: row.per_kg_body_weight == null ? '' : String(row.per_kg_body_weight),
    per_kg_cap: row.per_kg_cap == null ? '' : String(row.per_kg_cap),
    timing: row.timing ?? '',
    context_note: row.context_note ?? '',
    sex_filter: row.sex_filter ?? '',
    is_athlete: String(row.is_athlete ?? 0),
    purpose: row.purpose ?? 'maintenance',
    is_default: String(row.is_default ?? 0),
    is_active: String(row.is_active ?? 1),
    is_public: String(row.is_public ?? 0),
    relevance_score: row.relevance_score == null ? '50' : String(row.relevance_score),
    verified_profile_id: row.verified_profile_id == null ? '' : String(row.verified_profile_id),
    category_name: row.category_name ?? '',
  };
}

function parseNumber(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseBooleanFlag(value: string): BooleanFlag {
  if (value === '1' || value === 'true' || value === 'on') return 1;
  return 0;
}

function isRequiredSourceTypeUrl(sourceType: string): boolean {
  return sourceType === 'official' || sourceType === 'study' || sourceType === 'user_public';
}

function hasValue(value: string): boolean {
  return value.trim().length > 0;
}

function toPayload(draft: DoseDraft): AdminDoseRecommendationPayload {
  return {
    ingredient_id: draft.ingredient_id ? Number(draft.ingredient_id) : null,
    population_slug: hasValue(draft.population_slug) ? draft.population_slug.trim() : null,
    source_type: hasValue(draft.source_type) ? draft.source_type.trim() : null,
    source_label: hasValue(draft.source_label) ? draft.source_label.trim() : null,
    source_url: hasValue(draft.source_url) ? draft.source_url.trim() : null,
    dose_min: parseNumber(draft.dose_min),
    dose_max: parseNumber(draft.dose_max),
    unit: hasValue(draft.unit) ? draft.unit.trim() : null,
    per_kg_body_weight: parseNumber(draft.per_kg_body_weight),
    per_kg_cap: parseNumber(draft.per_kg_cap),
    timing: hasValue(draft.timing) ? draft.timing.trim() : null,
    context_note: hasValue(draft.context_note) ? draft.context_note.trim() : null,
    sex_filter: hasValue(draft.sex_filter) ? draft.sex_filter.trim() : null,
    is_athlete: parseBooleanFlag(draft.is_athlete),
    purpose: hasValue(draft.purpose) ? draft.purpose.trim() : 'maintenance',
    is_default: parseBooleanFlag(draft.is_default),
    is_active: parseBooleanFlag(draft.is_active),
    is_public: parseBooleanFlag(draft.is_public),
    relevance_score: parseNumber(draft.relevance_score),
    verified_profile_id: hasValue(draft.verified_profile_id) ? Number(draft.verified_profile_id) : null,
    category_name: hasValue(draft.category_name) ? draft.category_name.trim() : null,
  };
}

function getErrorMessage(error: unknown): string {
  if (
    typeof error === 'object' &&
    error !== null &&
    'response' in error &&
    typeof error.response === 'object' &&
    error.response !== null &&
    'data' in error.response &&
    typeof error.response.data === 'object' &&
    error.response.data !== null &&
    'error' in error.response.data &&
    typeof error.response.data.error === 'string'
  ) {
    return error.response.data.error;
  }
  if (error instanceof Error) return error.message;
  return 'Die Anfrage ist fehlgeschlagen.';
}

interface TextFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  placeholder?: string;
}

function TextField({ label, value, onChange, required = false, placeholder }: TextFieldProps) {
  return (
    <label className="flex flex-col gap-1 text-sm font-medium text-gray-700">
      <span>
        {label}
        {required && <span className="text-red-500"> *</span>}
      </span>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="border border-gray-200 rounded-xl px-3 py-2 text-sm font-normal text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-400"
      />
    </label>
  );
}

function TextArea({ label, value, onChange, required = false, placeholder, rows = 3 }: Omit<TextFieldProps, 'placeholder'> & { rows?: number; placeholder?: string }) {
  return (
    <label className="flex flex-col gap-1 text-sm font-medium text-gray-700">
      <span>
        {label}
        {required && <span className="text-red-500"> *</span>}
      </span>
      <textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        rows={rows}
        className="border border-gray-200 rounded-xl px-3 py-2 text-sm font-normal text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-400"
      />
    </label>
  );
}

function SelectField({
  label,
  value,
  onChange,
  options,
  required = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
  required?: boolean;
}) {
  return (
    <label className="flex flex-col gap-1 text-sm font-medium text-gray-700">
      <span>
        {label}
        {required && <span className="text-red-500"> *</span>}
      </span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="border border-gray-200 rounded-xl px-3 py-2 text-sm font-normal text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-400"
      >
        {options.map((option) => (
          <option key={option.value || option.label} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function getIdNameMap(ingredients: IngredientLookup[]): Map<number, string> {
  const map = new Map<number, string>();
  ingredients.forEach((entry) => {
    map.set(entry.id, entry.name);
  });
  return map;
}

export default function DoseRecommendationsTab() {
  const [items, setItems] = useState<AdminDoseRecommendation[]>([]);
  const [ingredients, setIngredients] = useState<IngredientLookup[]>([]);
  const [drafts, setDrafts] = useState<Record<number, DoseDraft>>({});
  const [draftErrors, setDraftErrors] = useState<DraftErrors>({});
  const [loading, setLoading] = useState(true);
  const [loadingIngredients, setLoadingIngredients] = useState(true);
  const [submittingId, setSubmittingId] = useState<number | 'create' | null>(null);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [ingredientFilter, setIngredientFilter] = useState('');
  const [sourceTypeFilter, setSourceTypeFilter] = useState('');
  const [activeFilter, setActiveFilter] = useState('');
  const [publicFilter, setPublicFilter] = useState('');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(25);
  const [total, setTotal] = useState<number | null>(null);
  const [createDraft, setCreateDraft] = useState<DoseDraft>(createBlankDraft());
  const [createError, setCreateError] = useState('');
  const [savedInfo, setSavedInfo] = useState('');

  const ingredientNameById = useMemo(() => getIdNameMap(ingredients), [ingredients]);
  const totalPages = total !== null ? Math.max(1, Math.ceil(total / limit)) : null;
  const hasNext = totalPages !== null ? page < totalPages : items.length === limit;
  const hasPrevious = page > 1;

  const loadIngredients = useCallback(async () => {
    setLoadingIngredients(true);
    try {
      const list = await getAllIngredients();
      setIngredients(list);
    } catch {
      try {
        const searchResult = await searchIngredients('');
        setIngredients(searchResult);
      } catch {
        setIngredients([]);
      }
    } finally {
      setLoadingIngredients(false);
    }
  }, []);

  const loadItems = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await getDoseRecommendations({
        q: query.trim(),
        page,
        limit,
        ingredient_id: ingredientFilter ? Number(ingredientFilter) : undefined,
        source_type: sourceTypeFilter || undefined,
        active: activeFilter === '' ? undefined : activeFilter,
        public: publicFilter === '' ? undefined : publicFilter,
      });

      const nextRows = response.recommendations ?? [];
      setItems(nextRows);
      setTotal(response.total ?? null);
      setDrafts((prev) => {
        const next = { ...prev };
        for (const row of nextRows) {
          if (!next[row.id]) {
            next[row.id] = draftFromRow(row);
          }
        }
        return next;
      });
      if (savedInfo) setSavedInfo('');
      setDraftErrors({});
    } catch (err) {
      setError(getErrorMessage(err));
      setItems([]);
      setTotal(null);
    } finally {
      setLoading(false);
    }
  }, [activeFilter, ingredientFilter, limit, page, publicFilter, query, sourceTypeFilter, savedInfo]);

  useEffect(() => {
    void loadIngredients();
    void loadItems();
  }, [loadIngredients, loadItems]);

  const updateDraft = (id: number, field: keyof DoseDraft, value: string) => {
    setDrafts((prev) => ({
      ...prev,
      [id]: {
        ...(prev[id] ?? createBlankDraft()),
        [field]: value,
      },
    }));
    setDraftErrors({});
  };

  const getPopulationOptions = useMemo(() => {
    const known = new Set<string>();
    for (const row of items) {
      if (row.population_slug) {
        known.add(row.population_slug);
      }
    }
    return Array.from(known);
  }, [items]);

  const validatePayload = (
    payload: AdminDoseRecommendationPayload,
    scope: 'create' | 'edit',
    draft: DoseDraft,
  ): string | null => {
    if (scope === 'create' && (typeof payload.ingredient_id !== 'number' || Number.isNaN(payload.ingredient_id))) {
      return 'ingredient_id ist erforderlich.';
    }
    if (!payload.population_slug) {
      return 'population_slug oder population_id ist erforderlich.';
    }
    if (!payload.source_type) {
      return 'source_type ist erforderlich.';
    }
    if (!hasValue(draft.source_label)) {
      return 'source_label ist erforderlich.';
    }
    if (payload.dose_max == null) {
      return 'dose_max ist erforderlich.';
    }
    if (!hasValue(draft.unit)) {
      return 'unit ist erforderlich.';
    }
    if (!hasValue(draft.purpose)) {
      return 'purpose ist erforderlich.';
    }
    if (isRequiredSourceTypeUrl(payload.source_type) && !hasValue(draft.source_url || '')) {
      return 'Für den gewählten source_type ist source_url erforderlich.';
    }
    if (payload.relevance_score != null && (payload.relevance_score < 0 || payload.relevance_score > 100)) {
      return 'relevance_score muss 0 bis 100 sein.';
    }
    return null;
  };

  const saveItem = async (row: AdminDoseRecommendation, id: number) => {
    const draft = drafts[id];
    if (!draft) return;
    setSubmittingId(id);
    setError('');

    try {
      const payload = toPayload(draft);
      const validation = validatePayload(payload, 'edit', draft);
      if (validation) {
        setDraftErrors((prev) => ({ ...prev, [String(id)]: validation }));
        return;
      }

      const saved = await updateDoseRecommendation(id, payload);
      setItems((prev) => prev.map((current) => (current.id === id ? { ...current, ...saved } : current)));
      setDrafts((prev) => ({
        ...prev,
        [id]: draftFromRow(saved),
      }));
      setSavedInfo(`Richtwert #${id} gespeichert.`);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSubmittingId(null);
    }
  };

  const deleteItem = async (id: number) => {
    if (!window.confirm('Richtwert wirklich loeschen?')) return;
    setSubmittingId(id);
    setError('');

    try {
      await deleteDoseRecommendation(id);
      setItems((prev) => prev.filter((item) => item.id !== id));
      setDrafts((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
      setSavedInfo(`Richtwert #${id} entfernt.`);
      if (items.length <= 1 && page > 1) {
        setPage((prev) => prev - 1);
      } else {
        void loadItems();
      }
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSubmittingId(null);
    }
  };

  const resetCreateDraft = () => {
    setCreateDraft(createBlankDraft());
  };

  const createItem = async () => {
    setSubmittingId('create');
    setCreateError('');
    setError('');

    try {
      const payload = toPayload(createDraft);
      const validation = validatePayload(payload, 'create', createDraft);
      if (validation) {
        setCreateError(validation);
        return;
      }

      const saved = await createDoseRecommendation(payload);
      setItems((prev) => [saved, ...prev]);
      setDrafts((prev) => ({
        ...prev,
        [saved.id]: draftFromRow(saved),
      }));
      resetCreateDraft();
      setSavedInfo(`Richtwert #${saved.id} erstellt.`);
      await loadItems();
    } catch (err) {
      setCreateError(getErrorMessage(err));
    } finally {
      setSubmittingId(null);
    }
  };

  const ingredientName = (id?: number | null) => {
    if (id == null) return 'unbekannt';
    return ingredientNameById.get(id) ?? `ID ${id}`;
  };

  return (
    <div className="space-y-5">
      <div className="bg-white border border-gray-100 shadow-sm rounded-2xl p-5 space-y-4">
        <div className="flex flex-col gap-1">
          <h2 className="text-lg font-semibold text-gray-900">Dose-Richtwerte verwalten</h2>
          <p className="text-sm text-gray-600">
            Diese Ansicht erlaubt das Erstellen, Ändern und Entfernen von quellenbasierten Dose-Richtwerten.
          </p>
        </div>

        {savedInfo && (
          <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-700">
            <CheckCircle size={16} />
            {savedInfo}
          </div>
        )}

        <div className="grid grid-cols-1 gap-3">
          <div className="grid grid-cols-1 lg:grid-cols-[180px_180px_1fr_auto] gap-3">
            <TextField
              label="Suche"
              value={query}
              onChange={(value) => {
                setQuery(value);
                setPage(1);
              }}
              placeholder="Textsuche in Richtwert/Dose/Quelle"
            />
            <SelectField
              label="Source Type"
              value={sourceTypeFilter}
              onChange={setSourceTypeFilter}
              options={[{ value: '', label: 'Alle' }, ...SOURCE_TYPES]}
            />
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <SelectField
                label="Ingredient"
                value={ingredientFilter}
                onChange={setIngredientFilter}
                options={[{ value: '', label: 'Alle' }, ...ingredients.map((entry) => ({ value: String(entry.id), label: entry.name }))]}
              />
              <SelectField
                label="Active"
                value={activeFilter}
                onChange={setActiveFilter}
                options={[
                  { value: '', label: 'Alle' },
                  { value: '1', label: 'Aktiv' },
                  { value: '0', label: 'Inaktiv' },
                ]}
              />
              <SelectField
                label="Public"
                value={publicFilter}
                onChange={setPublicFilter}
                options={[
                  { value: '', label: 'Alle' },
                  { value: '1', label: 'Sichtbar' },
                  { value: '0', label: 'Versteckt' },
                ]}
              />
            </div>
            <div className="flex items-end">
              <button
                onClick={() => void loadItems()}
                disabled={loading}
                className="min-h-10 inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-indigo-700 disabled:opacity-60"
              >
                {loading ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
                Laden
              </button>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
            <div className="text-gray-500">
              Seite {page}
              {totalPages ? ` / ${totalPages}` : ''}
              {total != null ? ` · ${total} Treffer` : ' · Trefferanzahl unbekannt'}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <SelectField
                label="Pro Seite"
                value={String(limit)}
                onChange={(value) => {
                  const next = Number(value) || 25;
                  setLimit(next);
                  setPage(1);
                }}
                options={PAGE_LIMIT_OPTIONS.map((entry) => ({ value: String(entry), label: String(entry) }))}
              />
              <button
                onClick={() => setPage((previous) => Math.max(1, previous - 1))}
                disabled={!hasPrevious || loading}
                className="min-h-10 px-3 py-2 rounded-lg border border-gray-200 text-sm font-medium disabled:opacity-50"
              >
                Vorherige
              </button>
              <button
                onClick={() => setPage((previous) => previous + 1)}
                disabled={!hasNext || loading}
                className="min-h-10 px-3 py-2 rounded-lg border border-gray-200 text-sm font-medium disabled:opacity-50"
              >
                Nächste
              </button>
            </div>
          </div>
        </div>
      </div>

      {loadingIngredients && <p className="text-sm text-gray-500">Lade Wirkstoffe...</p>}

      {error && (
        <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <XCircle size={16} />
          {error}
        </div>
      )}

      <section className="bg-white border border-gray-100 shadow-sm rounded-2xl p-5 space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-base font-semibold text-gray-900">Neuen Dose-Richtwert erstellen</h3>
            <p className="text-sm text-gray-500">Nur die Felder mit * sind Pflichtfelder.</p>
          </div>
          <button
            onClick={createItem}
            disabled={submittingId === 'create'}
            className="min-h-11 inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-emerald-700 disabled:opacity-50"
          >
            {submittingId === 'create' ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
            Erstellen
          </button>
        </div>

        {createError && <p className="text-sm text-red-600">{createError}</p>}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          <TextField
            label="Ingredient ID *"
            value={createDraft.ingredient_id}
            onChange={(value) => {
              setCreateDraft((prev) => ({ ...prev, ingredient_id: value }));
            }}
            placeholder="z. B. 12"
            required
          />
          <TextField
            label="Population Slug *"
            value={createDraft.population_slug}
            onChange={(value) => {
              setCreateDraft((prev) => ({ ...prev, population_slug: value }));
            }}
            placeholder={getPopulationOptions[0] ?? 'adult'}
            required
          />
          <TextField
            label="Source Label *"
            value={createDraft.source_label}
            onChange={(value) => {
              setCreateDraft((prev) => ({ ...prev, source_label: value }));
            }}
            placeholder="z. B. WHO Richtlinie"
            required
          />
          <SelectField
            label="Source Type *"
            value={createDraft.source_type}
            onChange={(value) => {
              setCreateDraft((prev) => ({ ...prev, source_type: value }));
            }}
            options={SOURCE_TYPES}
            required
          />
          <TextField
            label="Source URL"
            value={createDraft.source_url}
            onChange={(value) => {
              setCreateDraft((prev) => ({ ...prev, source_url: value }));
            }}
            placeholder={isRequiredSourceTypeUrl(createDraft.source_type) ? 'https://...' : 'optional'}
          />
          <TextField
            label="Dose Min"
            value={createDraft.dose_min}
            onChange={(value) => {
              setCreateDraft((prev) => ({ ...prev, dose_min: value }));
            }}
            placeholder="z. B. 10"
          />
          <TextField
            label="Dose Max *"
            value={createDraft.dose_max}
            onChange={(value) => {
              setCreateDraft((prev) => ({ ...prev, dose_max: value }));
            }}
            placeholder="z. B. 100"
            required
          />
          <TextField
            label="Unit *"
            value={createDraft.unit}
            onChange={(value) => {
              setCreateDraft((prev) => ({ ...prev, unit: value }));
            }}
            placeholder="mg, IU ..."
            required
          />
          <TextField
            label="Per kg body weight"
            value={createDraft.per_kg_body_weight}
            onChange={(value) => {
              setCreateDraft((prev) => ({ ...prev, per_kg_body_weight: value }));
            }}
            placeholder="optional"
          />
          <TextField
            label="Per kg cap"
            value={createDraft.per_kg_cap}
            onChange={(value) => {
              setCreateDraft((prev) => ({ ...prev, per_kg_cap: value }));
            }}
            placeholder="optional"
          />
          <TextField
            label="Timing"
            value={createDraft.timing}
            onChange={(value) => {
              setCreateDraft((prev) => ({ ...prev, timing: value }));
            }}
            placeholder="optional"
          />
          <TextField
            label="Sex Filter"
            value={createDraft.sex_filter}
            onChange={(value) => {
              setCreateDraft((prev) => ({ ...prev, sex_filter: value }));
            }}
            placeholder="male | female"
          />
          <TextField
            label="Category"
            value={createDraft.category_name}
            onChange={(value) => {
              setCreateDraft((prev) => ({ ...prev, category_name: value }));
            }}
            placeholder="optional"
          />
          <SelectField
            label="Purpose *"
            value={createDraft.purpose}
            onChange={(value) => {
              setCreateDraft((prev) => ({ ...prev, purpose: value }));
            }}
            options={PURPOSES}
            required
          />
          <TextField
            label="Relevance Score"
            value={createDraft.relevance_score}
            onChange={(value) => {
              setCreateDraft((prev) => ({ ...prev, relevance_score: value }));
            }}
            placeholder="0-100"
          />
          <SelectField
            label="Athlet"
            value={createDraft.is_athlete}
            onChange={(value) => {
              setCreateDraft((prev) => ({ ...prev, is_athlete: value }));
            }}
            options={[
              { value: '0', label: 'Nein' },
              { value: '1', label: 'Ja' },
            ]}
          />
          <SelectField
            label="Default"
            value={createDraft.is_default}
            onChange={(value) => {
              setCreateDraft((prev) => ({ ...prev, is_default: value }));
            }}
            options={[
              { value: '0', label: 'Nein' },
              { value: '1', label: 'Ja' },
            ]}
          />
          <SelectField
            label="Aktiv"
            value={createDraft.is_active}
            onChange={(value) => {
              setCreateDraft((prev) => ({ ...prev, is_active: value }));
            }}
            options={[
              { value: '0', label: 'Inaktiv' },
              { value: '1', label: 'Aktiv' },
            ]}
          />
          <SelectField
            label="Öffentlich"
            value={createDraft.is_public}
            onChange={(value) => {
              setCreateDraft((prev) => ({ ...prev, is_public: value }));
            }}
            options={[
              { value: '0', label: 'Nein' },
              { value: '1', label: 'Ja' },
            ]}
          />
          <TextArea
            label="Context Note"
            value={createDraft.context_note}
            onChange={(value) => {
              setCreateDraft((prev) => ({ ...prev, context_note: value }));
            }}
            rows={2}
          />
          <TextField
            label="Verified Profile ID"
            value={createDraft.verified_profile_id}
            onChange={(value) => {
              setCreateDraft((prev) => ({ ...prev, verified_profile_id: value }));
            }}
            placeholder="optional"
          />
        </div>
      </section>

      <section className="space-y-4">
        {loading && <div className="text-sm text-gray-500 flex items-center gap-2"><Loader2 size={16} className="animate-spin" /> Lade...</div>}

        {!loading && items.length === 0 && (
          <p className="text-sm text-gray-500 text-center p-8 border border-gray-200 rounded-2xl bg-white">
            Keine Dose-Richtwerte fuer diese Filter.
          </p>
        )}

        {!loading && items.map((item) => {
          const draft = drafts[item.id] ?? draftFromRow(item);
          const itemError = draftErrors[String(item.id)] ?? '';
          const isSaving = submittingId === item.id;
          const isDeleting = submittingId === item.id;

          return (
            <div
              key={item.id}
              className="rounded-2xl border border-gray-100 bg-white p-4 md:p-5 shadow-sm space-y-3"
            >
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-semibold text-gray-900 text-sm">
                    #{item.id} · {ingredientName(item.ingredient_id)} · {item.source_type} {item.source_label}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    Dose {item.dose_min ?? '-'}{item.dose_max != null ? ` - ${item.dose_max}` : ''} {item.unit} ·
                    {item.population_slug ? ` pop: ${item.population_slug}` : ''} ·
                    {item.purpose} · {item.is_active ? 'aktiv' : 'inaktiv'}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    Erstellt: {item.created_by_user_id ?? '-'} · Status: {item.is_public ? 'public' : 'private'}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {item.id === 0 && <History size={16} className="text-indigo-500" />}
                  <span className="text-xs px-2 py-1 rounded-full bg-gray-100">{item.source_type}</span>
                </div>
              </div>

              {itemError && <p className="text-sm text-red-600">{itemError}</p>}

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
                <TextField
                  label="Ingredient ID"
                  value={draft.ingredient_id}
                  onChange={(value) => updateDraft(item.id, 'ingredient_id', value)}
                />
                <SelectField
                  label="Source Type"
                  value={draft.source_type}
                  onChange={(value) => updateDraft(item.id, 'source_type', value)}
                  options={SOURCE_TYPES}
                />
                <TextField
                  label="Source Label"
                  value={draft.source_label}
                  onChange={(value) => updateDraft(item.id, 'source_label', value)}
                />
                <TextField
                  label="Source URL"
                  value={draft.source_url}
                  onChange={(value) => updateDraft(item.id, 'source_url', value)}
                />
                <TextField
                  label="Population Slug"
                  value={draft.population_slug}
                  onChange={(value) => updateDraft(item.id, 'population_slug', value)}
                />
                <SelectField
                  label="Purpose"
                  value={draft.purpose}
                  onChange={(value) => updateDraft(item.id, 'purpose', value)}
                  options={PURPOSES}
                />
                <TextField
                  label="Dose Min"
                  value={draft.dose_min}
                  onChange={(value) => updateDraft(item.id, 'dose_min', value)}
                />
                <TextField
                  label="Dose Max"
                  value={draft.dose_max}
                  onChange={(value) => updateDraft(item.id, 'dose_max', value)}
                />
                <TextField
                  label="Unit"
                  value={draft.unit}
                  onChange={(value) => updateDraft(item.id, 'unit', value)}
                />
                <TextField
                  label="Per kg body weight"
                  value={draft.per_kg_body_weight}
                  onChange={(value) => updateDraft(item.id, 'per_kg_body_weight', value)}
                />
                <TextField
                  label="Per kg cap"
                  value={draft.per_kg_cap}
                  onChange={(value) => updateDraft(item.id, 'per_kg_cap', value)}
                />
                <TextField
                  label="Timing"
                  value={draft.timing}
                  onChange={(value) => updateDraft(item.id, 'timing', value)}
                />
                <TextArea
                  label="Context Note"
                  value={draft.context_note}
                  onChange={(value) => updateDraft(item.id, 'context_note', value)}
                  rows={2}
                />
                <SelectField
                  label="Sex Filter"
                  value={draft.sex_filter}
                  onChange={(value) => updateDraft(item.id, 'sex_filter', value)}
                  options={SEX_FILTERS}
                />
                <TextField
                  label="Relevance Score"
                  value={draft.relevance_score}
                  onChange={(value) => updateDraft(item.id, 'relevance_score', value)}
                  placeholder="0-100"
                />
                <TextField
                  label="Category"
                  value={draft.category_name}
                  onChange={(value) => updateDraft(item.id, 'category_name', value)}
                />
                <SelectField
                  label="Athlete"
                  value={draft.is_athlete}
                  onChange={(value) => updateDraft(item.id, 'is_athlete', value)}
                  options={[
                    { value: '0', label: 'Nein' },
                    { value: '1', label: 'Ja' },
                  ]}
                />
                <SelectField
                  label="Default"
                  value={draft.is_default}
                  onChange={(value) => updateDraft(item.id, 'is_default', value)}
                  options={[
                    { value: '0', label: 'Nein' },
                    { value: '1', label: 'Ja' },
                  ]}
                />
                <SelectField
                  label="Aktiv"
                  value={draft.is_active}
                  onChange={(value) => updateDraft(item.id, 'is_active', value)}
                  options={[
                    { value: '0', label: 'Inaktiv' },
                    { value: '1', label: 'Aktiv' },
                  ]}
                />
                <SelectField
                  label="Öffentlich"
                  value={draft.is_public}
                  onChange={(value) => updateDraft(item.id, 'is_public', value)}
                  options={[
                    { value: '0', label: 'Nein' },
                    { value: '1', label: 'Ja' },
                  ]}
                />
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => void saveItem(item, item.id)}
                  disabled={isSaving}
                  className="min-h-11 inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-indigo-700 disabled:opacity-50"
                >
                  {isSaving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                  Speichern
                </button>
                <button
                  onClick={() => void deleteItem(item.id)}
                  disabled={isDeleting}
                  className="min-h-11 inline-flex items-center justify-center gap-2 rounded-xl border border-red-200 text-red-600 px-4 py-2 text-sm font-medium hover:bg-red-50 disabled:opacity-50"
                >
                  {isDeleting ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
                  Löschen
                </button>
              </div>
            </div>
          );
        })}
      </section>
    </div>
  );
}
