import { useCallback, useEffect, useMemo, useState } from 'react';
import { CheckCircle, Loader2, Plus, Search, Save, Trash2, Pencil, X } from 'lucide-react';
import {
  createIngredientResearchSource,
  createIngredientResearchWarning,
  deleteIngredientResearchSource,
  deleteIngredientResearchWarning,
  getIngredientResearchDetail,
  getIngredientResearchItems,
  updateIngredientResearchSource,
  updateIngredientResearchStatus,
  updateIngredientResearchWarning,
  type AdminIngredientResearchListItem,
  type AdminIngredientResearchStatus,
  type AdminIngredientResearchStatusPayload,
  type AdminIngredientResearchSource,
  type AdminIngredientResearchSourcePayload,
  type AdminIngredientResearchWarning,
  type AdminIngredientResearchWarningPayload,
} from '../../api/admin';

type DetailPanelMode = 'idle' | 'loading' | 'error';

interface SourceFormState {
  source_kind: string;
  source_title: string;
  source_url: string;
  organization: string;
  country: string;
  recommendation_type: string;
  population: string;
  no_recommendation: boolean;
  finding: string;
  outcome: string;
  study_type: string;
  evidence_quality: string;
  source_date: string;
  reviewed_at: string;
  notes: string;
  dose_min: string;
  dose_max: string;
  dose_unit: string;
}

interface WarningFormState {
  short_label: string;
  popover_text: string;
  severity: string;
  article_slug: string;
  min_amount: string;
  unit: string;
}

interface StatusFormState {
  research_status: string;
  calculation_status: string;
  internal_notes: string;
  blog_url: string;
  reviewed_at: string;
  review_due_at: string;
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

function toInputDateTime(value?: string | null): string {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const pad = (next: number) => String(next).padStart(2, '0');
  const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return `${localDate.getFullYear()}-${pad(localDate.getMonth() + 1)}-${pad(localDate.getDate())}T${pad(localDate.getHours())}:${pad(localDate.getMinutes())}`;
}

function toIsoOrNull(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const date = new Date(trimmed);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function parseOptionalNumber(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const normalized = trimmed.replace(',', '.');
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeSourceForm(form: SourceFormState): AdminIngredientResearchSourcePayload {
  return {
    source_kind: normalizeSourceType(form.source_kind),
    source_title: form.source_title.trim() || null,
    source_url: form.source_url.trim() || null,
    organization: form.organization.trim() || null,
    country: form.country.trim() || null,
    recommendation_type: form.recommendation_type.trim() || null,
    population: form.population.trim() || null,
    no_recommendation: form.no_recommendation,
    finding: form.finding.trim() || null,
    outcome: form.outcome.trim() || null,
    study_type: form.study_type.trim() || null,
    evidence_quality: form.evidence_quality.trim() || null,
    source_date: toIsoOrNull(form.source_date),
    reviewed_at: toIsoOrNull(form.reviewed_at),
    notes: form.notes.trim() || null,
    dose_min: parseOptionalNumber(form.dose_min),
    dose_max: parseOptionalNumber(form.dose_max),
    dose_unit: form.dose_unit.trim() || null,
  };
}

function normalizeWarningForm(form: WarningFormState): AdminIngredientResearchWarningPayload {
  return {
    short_label: form.short_label.trim() || null,
    popover_text: form.popover_text.trim() || null,
    severity: form.severity.trim() || null,
    article_slug: form.article_slug.trim() || null,
    min_amount: parseOptionalNumber(form.min_amount),
    unit: form.unit.trim() || null,
  };
}

function statusBadgeClass(status: string): string {
  switch (status) {
    case 'reviewed':
      return 'bg-emerald-100 text-emerald-700';
    case 'stale':
    case 'researching':
    case 'needs_review':
      return 'bg-amber-100 text-amber-700';
    case 'blocked':
      return 'bg-red-100 text-red-700';
    case 'unreviewed':
    default:
      return 'bg-slate-100 text-slate-700';
  }
}

function countBySourceType(sources: AdminIngredientResearchSource[]) {
  return {
    official: sources.filter((entry) => entry.source_kind === 'official').length,
    study: sources.filter((entry) => entry.source_kind === 'study').length,
    other: sources.filter((entry) => !['official', 'study'].includes(entry.source_kind)).length,
  };
}

function normalizeSourceType(value: string): string {
  const normalized = value.trim().toLowerCase();
  return normalized.length > 0 ? normalized : 'other';
}

const EMPTY_STATUS_FORM: StatusFormState = {
  research_status: 'unreviewed',
  calculation_status: '',
  internal_notes: '',
  blog_url: '',
  reviewed_at: '',
  review_due_at: '',
};

const EMPTY_SOURCE_FORM: SourceFormState = {
  source_kind: '',
  source_title: '',
  source_url: '',
  organization: '',
  country: '',
  recommendation_type: '',
  population: '',
  no_recommendation: false,
  finding: '',
  outcome: '',
  study_type: '',
  evidence_quality: '',
  source_date: '',
  reviewed_at: '',
  notes: '',
  dose_min: '',
  dose_max: '',
  dose_unit: '',
};

const EMPTY_WARNING_FORM: WarningFormState = {
  short_label: '',
  popover_text: '',
  severity: '',
  article_slug: '',
  min_amount: '',
  unit: '',
};

const DEFAULT_STATUS_FILTERS = ['', 'unreviewed', 'researching', 'needs_review', 'reviewed', 'stale', 'blocked'];
const DEFAULT_SOURCE_TYPES = ['official', 'study'];
const DEFAULT_WARNING_SEVERITIES = ['info', 'caution', 'danger'];

export default function IngredientResearchTab() {
  const [items, setItems] = useState<AdminIngredientResearchListItem[]>([]);
  const [loadingItems, setLoadingItems] = useState(true);
  const [loadingState, setLoadingState] = useState<DetailPanelMode>('idle');
  const [listError, setListError] = useState('');
  const [detailError, setDetailError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [selectedIngredientId, setSelectedIngredientId] = useState<number | null>(null);
  const [selectedIngredientName, setSelectedIngredientName] = useState('');
  const [selectedDetail, setSelectedDetail] = useState<{
    ingredient: { id: number; name: string; unit: string | null; category: string | null };
    status: AdminIngredientResearchStatus;
    sources: AdminIngredientResearchSource[];
    warnings: AdminIngredientResearchWarning[];
  } | null>(null);

  const [statusForm, setStatusForm] = useState<StatusFormState>(EMPTY_STATUS_FORM);
  const [savingStatus, setSavingStatus] = useState(false);

  const [newSourceForm, setNewSourceForm] = useState<SourceFormState>(EMPTY_SOURCE_FORM);
  const [editingSourceId, setEditingSourceId] = useState<number | null>(null);
  const [editingSourceForm, setEditingSourceForm] = useState<SourceFormState>(EMPTY_SOURCE_FORM);
  const [sourceSaving, setSourceSaving] = useState<number | null>(null);
  const [sourceDeleting, setSourceDeleting] = useState<number | null>(null);

  const [newWarningForm, setNewWarningForm] = useState<WarningFormState>(EMPTY_WARNING_FORM);
  const [editingWarningId, setEditingWarningId] = useState<number | null>(null);
  const [editingWarningForm, setEditingWarningForm] = useState<WarningFormState>(EMPTY_WARNING_FORM);
  const [warningSaving, setWarningSaving] = useState<number | null>(null);
  const [warningDeleting, setWarningDeleting] = useState<number | null>(null);

  const sourceCounts = useMemo(
    () => countBySourceType(selectedDetail?.sources ?? []),
    [selectedDetail?.sources],
  );

  const categories = useMemo(() => {
    const unique = new Map<string, number>();
    unique.set('(ohne Kategorie)', 1);
    items.forEach((item) => {
      const name = item.category?.trim() || '(ohne Kategorie)';
      unique.set(name, 1);
    });
    return [...unique.keys()].filter((value, index, arr) => arr.indexOf(value) === index).sort((a, b) => a.localeCompare(b));
  }, [items]);

  const groupedItems = useMemo(() => {
    const grouped = new Map<string, AdminIngredientResearchListItem[]>();
    items.forEach((item) => {
      const category = item.category?.trim() || '(ohne Kategorie)';
      const bucket = grouped.get(category) ?? [];
      bucket.push(item);
      grouped.set(category, bucket);
    });
    grouped.forEach((bucket, categoryName) => {
      bucket.sort((left, right) => left.ingredient_name.localeCompare(right.ingredient_name));
      grouped.set(categoryName, bucket);
    });

    return [...grouped.entries()].sort((left, right) => left[0].localeCompare(right[0]));
  }, [items]);

  const loadItems = useCallback(async () => {
    setLoadingItems(true);
    setListError('');
    try {
      const response = await getIngredientResearchItems({
        q: search.trim() || undefined,
        category: categoryFilter.trim() || undefined,
        status: statusFilter || undefined,
      });
      setItems(response.items ?? []);
    } catch (error) {
      setListError(getErrorMessage(error));
      setItems([]);
    } finally {
      setLoadingItems(false);
    }
  }, [categoryFilter, search, statusFilter]);

  const loadDetail = useCallback(async (ingredientId: number) => {
    setLoadingState('loading');
    setDetailError('');
    try {
      const detail = await getIngredientResearchDetail(ingredientId);
      setSelectedDetail(detail);
      setSelectedIngredientName(detail.ingredient.name);
      setStatusForm({
        research_status: detail.status.research_status,
        calculation_status: detail.status.calculation_status ?? '',
        internal_notes: detail.status.internal_notes ?? '',
        blog_url: detail.status.blog_url ?? '',
        reviewed_at: toInputDateTime(detail.status.reviewed_at),
        review_due_at: toInputDateTime(detail.status.review_due_at),
      });
      setLoadingState('idle');
    } catch (error) {
      setDetailError(getErrorMessage(error));
      setLoadingState('error');
    }
  }, []);

  const applySelectionFromItems = useCallback(() => {
    if (!items.length) {
      setSelectedIngredientId(null);
      setSelectedDetail(null);
      setSelectedIngredientName('');
      return;
    }

    if (selectedIngredientId === null) {
      const first = items[0];
      setSelectedIngredientId(first.ingredient_id);
      return;
    }

    const exists = items.some((item) => item.ingredient_id === selectedIngredientId);
    if (!exists) {
      const first = items[0];
      setSelectedIngredientId(first.ingredient_id);
    }
  }, [items, selectedIngredientId]);

  const updateStatusInList = useCallback((ingredientId: number, next: { research_status: string }) => {
    setItems((previous) =>
      previous.map((item) =>
        item.ingredient_id === ingredientId
          ? {
              ...item,
              research_status: next.research_status,
            }
          : item,
      ),
    );
  }, []);

  const handleSelect = (ingredientId: number, name: string) => {
    if (selectedIngredientId === ingredientId) {
      return;
    }
    setSelectedIngredientId(ingredientId);
    setSelectedIngredientName(name);
    void loadDetail(ingredientId);
  };

  useEffect(() => {
    void loadItems();
  }, [loadItems]);

  useEffect(() => {
    applySelectionFromItems();
  }, [applySelectionFromItems]);

  useEffect(() => {
    if (selectedIngredientId === null) return;
    void loadDetail(selectedIngredientId);
  }, [selectedIngredientId, loadDetail]);

  useEffect(() => {
    setEditingSourceId(null);
    setEditingWarningId(null);
    setSuccessMessage('');
    setDetailError('');
  }, [selectedIngredientId]);

  const handleSaveStatus = async () => {
    if (!selectedIngredientId || !selectedDetail) return;
    setSavingStatus(true);
    setDetailError('');
    try {
      const payload: AdminIngredientResearchStatusPayload = {
        research_status: statusForm.research_status || null,
        calculation_status: statusForm.calculation_status || null,
        internal_notes: statusForm.internal_notes || null,
        blog_url: statusForm.blog_url || null,
        reviewed_at: toIsoOrNull(statusForm.reviewed_at) ?? null,
        review_due_at: toIsoOrNull(statusForm.review_due_at) ?? null,
      };

      const status = await updateIngredientResearchStatus(selectedIngredientId, payload);
      setSelectedDetail((previous) =>
        previous
              ? {
                  ...previous,
                  status: {
                    research_status: status.research_status,
                    calculation_status: status.calculation_status,
                    internal_notes: status.internal_notes,
                    blog_url: status.blog_url,
                    reviewed_at: status.reviewed_at,
                    review_due_at: status.review_due_at,
                    raw: status.raw,
                  },
                }
              : previous,
      );
      updateStatusInList(selectedIngredientId, {
        research_status: status.research_status,
      });
      setSuccessMessage('Status gespeichert.');
      setTimeout(() => setSuccessMessage(''), 2500);
    } catch (error) {
      setDetailError(getErrorMessage(error));
    } finally {
      setSavingStatus(false);
    }
  };

  const handleCreateSource = async () => {
    if (!selectedIngredientId) return;
    const normalized = normalizeSourceForm(newSourceForm);
    setSourceSaving(-1);
    setDetailError('');
    try {
      const created = await createIngredientResearchSource(selectedIngredientId, normalized);
      setSelectedDetail((previous) =>
        previous ? { ...previous, sources: [...previous.sources, created] } : previous,
      );
      setNewSourceForm(EMPTY_SOURCE_FORM);
      setSuccessMessage('Quelle hinzugefuegt.');
      setTimeout(() => setSuccessMessage(''), 2500);
    } catch (error) {
      setDetailError(getErrorMessage(error));
    } finally {
      setSourceSaving(null);
    }
  };

  const handleUpdateSource = async () => {
    if (editingSourceId === null) return;
    const normalized = normalizeSourceForm(editingSourceForm);
    setSourceSaving(editingSourceId);
    setDetailError('');
    try {
      const updated = await updateIngredientResearchSource(editingSourceId, normalized);
      setSelectedDetail((previous) =>
        previous
          ? {
              ...previous,
              sources: previous.sources.map((source) => (source.id === editingSourceId ? updated : source)),
            }
          : previous,
      );
      setEditingSourceId(null);
      setEditingSourceForm(EMPTY_SOURCE_FORM);
      setSuccessMessage('Quelle aktualisiert.');
      setTimeout(() => setSuccessMessage(''), 2500);
    } catch (error) {
      setDetailError(getErrorMessage(error));
    } finally {
      setSourceSaving(null);
    }
  };

  const handleDeleteSource = async (sourceId: number) => {
    if (!window.confirm('Quelle loeschen?')) return;
    setSourceDeleting(sourceId);
    setDetailError('');
    try {
      await deleteIngredientResearchSource(sourceId);
      setSelectedDetail((previous) =>
        previous ? { ...previous, sources: previous.sources.filter((source) => source.id !== sourceId) } : previous,
      );
      setSuccessMessage('Quelle geloescht.');
      setTimeout(() => setSuccessMessage(''), 2500);
    } catch (error) {
      setDetailError(getErrorMessage(error));
    } finally {
      setSourceDeleting(null);
    }
  };

  const handleCreateWarning = async () => {
    if (!selectedIngredientId) return;
    const normalized = normalizeWarningForm(newWarningForm);
    setWarningSaving(-1);
    setDetailError('');
    try {
      const created = await createIngredientResearchWarning(selectedIngredientId, normalized);
      setSelectedDetail((previous) =>
        previous ? { ...previous, warnings: [...previous.warnings, created] } : previous,
      );
      setNewWarningForm(EMPTY_WARNING_FORM);
      setSuccessMessage('Warnung hinzugefuegt.');
      setTimeout(() => setSuccessMessage(''), 2500);
    } catch (error) {
      setDetailError(getErrorMessage(error));
    } finally {
      setWarningSaving(null);
    }
  };

  const handleUpdateWarning = async () => {
    if (editingWarningId === null) return;
    const normalized = normalizeWarningForm(editingWarningForm);
    setWarningSaving(editingWarningId);
    setDetailError('');
    try {
      const updated = await updateIngredientResearchWarning(editingWarningId, normalized);
      setSelectedDetail((previous) =>
        previous
          ? {
              ...previous,
              warnings: previous.warnings.map((warning) => (warning.id === editingWarningId ? updated : warning)),
            }
          : previous,
      );
      setEditingWarningId(null);
      setEditingWarningForm(EMPTY_WARNING_FORM);
      setSuccessMessage('Warnung aktualisiert.');
      setTimeout(() => setSuccessMessage(''), 2500);
    } catch (error) {
      setDetailError(getErrorMessage(error));
    } finally {
      setWarningSaving(null);
    }
  };

  const handleDeleteWarning = async (warningId: number) => {
    if (!window.confirm('Warnung loeschen?')) return;
    setWarningDeleting(warningId);
    setDetailError('');
    try {
      await deleteIngredientResearchWarning(warningId);
      setSelectedDetail((previous) =>
        previous ? { ...previous, warnings: previous.warnings.filter((warning) => warning.id !== warningId) } : previous,
      );
      setSuccessMessage('Warnung geloescht.');
      setTimeout(() => setSuccessMessage(''), 2500);
    } catch (error) {
      setDetailError(getErrorMessage(error));
    } finally {
      setWarningDeleting(null);
    }
  };

  const startEditingSource = (source: AdminIngredientResearchSource) => {
    setEditingSourceId(source.id);
    setEditingSourceForm({
      source_kind: source.source_kind,
      source_title: source.source_title ?? '',
      source_url: source.source_url ?? '',
      organization: source.organization ?? '',
      country: source.country ?? '',
      recommendation_type: source.recommendation_type ?? '',
      population: source.population ?? '',
      no_recommendation: Boolean(source.no_recommendation),
      finding: source.finding ?? '',
      outcome: source.outcome ?? '',
      study_type: source.study_type ?? '',
      evidence_quality: source.evidence_quality ?? '',
      source_date: source.source_date ? toInputDateTime(source.source_date) : '',
      reviewed_at: source.reviewed_at ? toInputDateTime(source.reviewed_at) : '',
      notes: source.notes ?? '',
      dose_min: source.dose_min == null ? '' : String(source.dose_min),
      dose_max: source.dose_max == null ? '' : String(source.dose_max),
      dose_unit: source.dose_unit ?? '',
    });
  };

  const startEditingWarning = (warning: AdminIngredientResearchWarning) => {
    setEditingWarningId(warning.id);
    setEditingWarningForm({
      short_label: warning.short_label ?? '',
      popover_text: warning.popover_text ?? '',
      severity: warning.severity ?? '',
      article_slug: warning.article_slug ?? '',
      min_amount: warning.min_amount == null ? '' : String(warning.min_amount),
      unit: warning.unit ?? '',
    });
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
      <section className="lg:col-span-4 xl:col-span-3 rounded-2xl border border-gray-100 bg-white p-4 shadow-sm min-h-[70vh]">
        <div className="flex items-center gap-2 mb-4">
          <Search size={16} className="text-gray-500" />
          <h2 className="text-sm font-semibold text-gray-900">Liste</h2>
        </div>

        <div className="flex flex-col gap-2">
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Wirkstoffsuche"
            className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-400"
          />
          <label className="flex flex-col gap-1 text-xs font-semibold uppercase tracking-wide text-gray-500">
            Kategorie
            <select
              value={categoryFilter}
              onChange={(event) => setCategoryFilter(event.target.value)}
              className="border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-400"
            >
              <option value="">Alle Kategorien</option>
              {categories.map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-xs font-semibold uppercase tracking-wide text-gray-500">
            Status
            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
              className="border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-400"
            >
              <option value="">Alle Stati</option>
              {DEFAULT_STATUS_FILTERS.filter(Boolean).map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            onClick={() => void loadItems()}
            className="mt-1 min-h-11 inline-flex items-center justify-center gap-2 rounded-xl border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            <Loader2 size={16} className={loadingItems ? 'animate-spin' : ''} />
            Liste aktualisieren
          </button>
        </div>

        {loadingItems && <p className="text-sm text-gray-500 mt-4">Lade Daten...</p>}
        {listError ? (
          <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {listError}
          </div>
        ) : null}

        {!loadingItems && !listError && items.length === 0 && (
          <p className="mt-4 text-sm text-gray-500">Keine Treffer.</p>
        )}

        <div className="mt-4 space-y-3">
          <p className="text-xs text-gray-500">
            {items.length} Wirkstoff
            {selectedIngredientName ? ` · aktiv: ${selectedIngredientName}` : ''}
          </p>

          <div className="space-y-4">
            {groupedItems.map(([categoryName, rows]) => (
              <div key={categoryName}>
                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">{categoryName}</h3>
                <ul className="space-y-2">
                  {rows.map((item) => {
                    const isSelected = item.ingredient_id === selectedIngredientId;
                    return (
                      <li key={item.ingredient_id}>
                        <button
                          type="button"
                          onClick={() => handleSelect(item.ingredient_id, item.ingredient_name)}
                          className={`w-full text-left rounded-xl border px-3 py-2.5 transition-colors ${
                            isSelected
                              ? 'bg-indigo-50 border-indigo-200'
                              : 'bg-white border-gray-100 hover:border-gray-300 hover:bg-slate-50'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <p className="font-medium text-sm text-gray-900 truncate">{item.ingredient_name}</p>
                              <p className="text-xs text-gray-500 truncate">{item.ingredient_unit ?? '-'} {item.ingredient_id ? `(ID ${item.ingredient_id})` : ''}</p>
                            </div>
                            {item.no_recommendation_count > 0 ? (
                              <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold bg-rose-100 text-rose-700">
                                Kein Nutzen
                              </span>
                            ) : null}
                          </div>
                          <div className="mt-2 flex flex-wrap gap-1.5">
                            <span
                              className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] ${statusBadgeClass(item.research_status)}`}
                            >
                              {item.research_status}
                            </span>
                            <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] bg-sky-100 text-sky-700">
                              {item.official_source_count} off.
                            </span>
                            <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] bg-violet-100 text-violet-700">
                              {item.study_source_count} stud.
                            </span>
                            <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] bg-amber-100 text-amber-700">
                              {item.warning_count} warn.
                            </span>
                          </div>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="lg:col-span-8 xl:col-span-9 rounded-2xl border border-gray-100 bg-white p-4 shadow-sm min-h-[70vh]">
        <div className="flex flex-wrap items-start justify-between gap-2 mb-4">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Wirkstoff-Forschung</h2>
            <p className="text-sm text-gray-500">
              {selectedDetail ? `Bearbeite ${selectedDetail.ingredient.name}` : 'Wirkstoff auswaehlen.'}
            </p>
          </div>
          {successMessage ? (
            <span className="inline-flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-700">
              <CheckCircle size={15} />
              {successMessage}
            </span>
          ) : null}
        </div>

        {loadingState === 'loading' && <p className="text-sm text-gray-500">Lade Details...</p>}
        {loadingState === 'error' && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {detailError || 'Detailansicht konnte nicht geladen werden.'}
          </div>
        )}

        {!selectedDetail && loadingState !== 'loading' && (
          <p className="text-sm text-gray-500 py-8 text-center">
            Bitte waehlst du zuerst einen Wirkstoff aus der Liste.
          </p>
        )}

        {selectedDetail ? (
          <div className="space-y-5">
            <div className="rounded-xl border border-gray-100 p-4">
              <h3 className="font-semibold text-gray-900 text-sm mb-3">Status</h3>
              <div className="grid gap-3 grid-cols-1 md:grid-cols-2">
                <label className="flex flex-col gap-1 text-sm font-medium text-gray-700">
                  Status
                  <input
                    list="status-options"
                    value={statusForm.research_status}
                    onChange={(event) => setStatusForm((previous) => ({ ...previous, research_status: event.target.value }))}
                    className="border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-400"
                  />
                  <datalist id="status-options">
                    {DEFAULT_STATUS_FILTERS.filter(Boolean).map((entry) => (
                      <option key={`status-${entry}`} value={entry} />
                    ))}
                  </datalist>
                </label>
                <label className="flex flex-col gap-1 text-sm font-medium text-gray-700">
                  Berechnung
                  <input
                    value={statusForm.calculation_status}
                    onChange={(event) =>
                      setStatusForm((previous) => ({ ...previous, calculation_status: event.target.value }))
                    }
                    placeholder="z. B. auto / manual"
                    className="border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-400"
                  />
                </label>
                <label className="flex flex-col gap-1 text-sm font-medium text-gray-700">
                  Blog / Fundstelle
                  <input
                    type="url"
                    value={statusForm.blog_url}
                    onChange={(event) => setStatusForm((previous) => ({ ...previous, blog_url: event.target.value }))}
                    placeholder="https://..."
                    className="border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-400"
                  />
                </label>
                <label className="flex flex-col gap-1 text-sm font-medium text-gray-700">
                  Review bis
                  <input
                    type="datetime-local"
                    value={statusForm.review_due_at}
                    onChange={(event) => setStatusForm((previous) => ({ ...previous, review_due_at: event.target.value }))}
                    className="border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-400"
                  />
                </label>
                <label className="flex flex-col gap-1 text-sm font-medium text-gray-700">
                  Reviewed
                  <input
                    type="datetime-local"
                    value={statusForm.reviewed_at}
                    onChange={(event) => setStatusForm((previous) => ({ ...previous, reviewed_at: event.target.value }))}
                    className="border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-400"
                  />
                </label>
              </div>
              <label className="mt-3 flex flex-col gap-1 text-sm font-medium text-gray-700">
                Interne Notizen
                <textarea
                  value={statusForm.internal_notes}
                  onChange={(event) => setStatusForm((previous) => ({ ...previous, internal_notes: event.target.value }))}
                  rows={3}
                  placeholder="Kurzer Hinweis fuer Admin..."
                  className="border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-400"
                />
              </label>

              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => void handleSaveStatus()}
                  disabled={savingStatus}
                  className="inline-flex items-center justify-center gap-2 min-h-11 px-4 py-2 rounded-xl bg-indigo-600 text-white text-sm font-semibold shadow-sm hover:bg-indigo-700 disabled:opacity-50"
                >
                  {savingStatus ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                  Status speichern
                </button>
                <a
                  href={selectedDetail.status.blog_url || '#'}
                  target="_blank"
                  rel="noreferrer"
                  className={`inline-flex items-center justify-center min-h-11 px-4 py-2 rounded-xl border border-gray-200 text-sm font-medium ${
                    selectedDetail.status.blog_url ? 'text-indigo-700 hover:bg-indigo-50' : 'text-gray-400'
                  }`}
                >
                  Blog-Link
                </a>
              </div>
            </div>

            <div className="rounded-xl border border-gray-100 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                <h3 className="font-semibold text-gray-900 text-sm">Quellen</h3>
                <div className="text-xs text-gray-500 flex flex-wrap gap-1.5">
                  <span className="inline-flex rounded-full px-2 py-0.5 bg-sky-100 text-sky-700">offiziell {sourceCounts.official}</span>
                  <span className="inline-flex rounded-full px-2 py-0.5 bg-violet-100 text-violet-700">studien {sourceCounts.study}</span>
                  <span className="inline-flex rounded-full px-2 py-0.5 bg-amber-100 text-amber-700">sonstige {sourceCounts.other}</span>
                </div>
              </div>

              <div className="grid gap-3 grid-cols-1 lg:grid-cols-2">
                <label className="flex flex-col gap-1 text-sm font-medium text-gray-700">
                  Typ
                  <select
                    id="source-type-options"
                    value={newSourceForm.source_kind}
                    onChange={(event) =>
                      setNewSourceForm((previous) => ({ ...previous, source_kind: normalizeSourceType(event.target.value) }))
                    }
                    className="border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-900"
                  >
                    <option value="">Auswahl</option>
                    {DEFAULT_SOURCE_TYPES.map((entry) => (
                      <option key={`source-type-${entry}`} value={entry}>
                        {entry}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="flex flex-col gap-1 text-sm font-medium text-gray-700">
                  Titel
                  <input
                    value={newSourceForm.source_title}
                    onChange={(event) => setNewSourceForm((previous) => ({ ...previous, source_title: event.target.value }))}
                    className="border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-900"
                  />
                </label>
                <label className="flex flex-col gap-1 text-sm font-medium text-gray-700">
                  Link
                  <input
                    type="url"
                    value={newSourceForm.source_url}
                    onChange={(event) => setNewSourceForm((previous) => ({ ...previous, source_url: event.target.value }))}
                    className="border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-900"
                  />
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <label className="flex flex-col gap-1 text-sm font-medium text-gray-700">
                    Land
                    <input
                      value={newSourceForm.country}
                      onChange={(event) => setNewSourceForm((previous) => ({ ...previous, country: event.target.value }))}
                      className="border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-900"
                    />
                  </label>
                  <label className="flex flex-col gap-1 text-sm font-medium text-gray-700">
                    Organisation
                    <input
                      value={newSourceForm.organization}
                      onChange={(event) => setNewSourceForm((previous) => ({ ...previous, organization: event.target.value }))}
                      className="border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-900"
                    />
                  </label>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <label className="flex flex-col gap-1 text-sm font-medium text-gray-700">
                    Dosis min
                    <input
                      value={newSourceForm.dose_min}
                      onChange={(event) => setNewSourceForm((previous) => ({ ...previous, dose_min: event.target.value }))}
                      placeholder="z. B. 10"
                      className="border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-900"
                    />
                  </label>
                  <label className="flex flex-col gap-1 text-sm font-medium text-gray-700">
                    Dosis max
                    <input
                      value={newSourceForm.dose_max}
                      onChange={(event) => setNewSourceForm((previous) => ({ ...previous, dose_max: event.target.value }))}
                      placeholder="z. B. 20"
                      className="border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-900"
                    />
                  </label>
                  <label className="flex flex-col gap-1 text-sm font-medium text-gray-700">
                    Einheit
                    <input
                      value={newSourceForm.dose_unit}
                      onChange={(event) => setNewSourceForm((previous) => ({ ...previous, dose_unit: event.target.value }))}
                      placeholder="mg"
                      className="border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-900"
                    />
                  </label>
                </div>
                <label className="flex items-center gap-2 mt-1 text-sm font-medium text-gray-700">
                  <input
                    type="checkbox"
                    checked={newSourceForm.no_recommendation}
                    onChange={(event) =>
                      setNewSourceForm((previous) => ({ ...previous, no_recommendation: event.target.checked }))
                    }
                  />
                  Keine Empfehlung
                </label>
                <label className="flex flex-col gap-1 text-sm font-medium text-gray-700">
                  Empfehlungsart
                  <input
                    value={newSourceForm.recommendation_type}
                    onChange={(event) => setNewSourceForm((previous) => ({ ...previous, recommendation_type: event.target.value }))}
                    className="border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-900"
                    placeholder="z. B. Nutzen, Risiko, Vorsicht"
                  />
                </label>
                <label className="flex flex-col gap-1 text-sm font-medium text-gray-700">
                  Zielgruppe / Population
                  <input
                    value={newSourceForm.population}
                    onChange={(event) => setNewSourceForm((previous) => ({ ...previous, population: event.target.value }))}
                    className="border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-900"
                    placeholder="z. B. Erwachsene"
                  />
                </label>
                <label className="flex flex-col gap-1 text-sm font-medium text-gray-700">
                  Ergebnis
                  <input
                    value={newSourceForm.outcome}
                    onChange={(event) => setNewSourceForm((previous) => ({ ...previous, outcome: event.target.value }))}
                    className="border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-900"
                    placeholder="kurzes Fazit"
                  />
                </label>
                <label className="flex flex-col gap-1 text-sm font-medium text-gray-700">
                  Befund
                  <input
                    value={newSourceForm.finding}
                    onChange={(event) => setNewSourceForm((previous) => ({ ...previous, finding: event.target.value }))}
                    className="border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-900"
                    placeholder="Studienbefund / Kernaussage"
                  />
                </label>
                <label className="flex flex-col gap-1 text-sm font-medium text-gray-700">
                  Studientyp
                  <input
                    value={newSourceForm.study_type}
                    onChange={(event) => setNewSourceForm((previous) => ({ ...previous, study_type: event.target.value }))}
                    className="border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-900"
                    placeholder="z. B. RCT, Meta-Analyse"
                  />
                </label>
                <label className="flex flex-col gap-1 text-sm font-medium text-gray-700">
                  Evidenzqualität
                  <input
                    value={newSourceForm.evidence_quality}
                    onChange={(event) =>
                      setNewSourceForm((previous) => ({ ...previous, evidence_quality: event.target.value }))
                    }
                    className="border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-900"
                    placeholder="hoch/mittel/niedrig"
                  />
                </label>
                <label className="flex flex-col gap-1 text-sm font-medium text-gray-700">
                  Quellen-Datum
                  <input
                    type="date"
                    value={newSourceForm.source_date}
                    onChange={(event) => setNewSourceForm((previous) => ({ ...previous, source_date: event.target.value }))}
                    className="border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-900"
                  />
                </label>
                <label className="flex flex-col gap-1 text-sm font-medium text-gray-700">
                  Review-Datum
                  <input
                    type="datetime-local"
                    value={newSourceForm.reviewed_at}
                    onChange={(event) => setNewSourceForm((previous) => ({ ...previous, reviewed_at: event.target.value }))}
                    className="border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-900"
                  />
                </label>
                <label className="flex flex-col gap-1 text-sm font-medium text-gray-700 col-span-full">
                  Notiz
                  <input
                    value={newSourceForm.notes}
                    onChange={(event) => setNewSourceForm((previous) => ({ ...previous, notes: event.target.value }))}
                    className="border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-900"
                  />
                </label>
              </div>
              <button
                type="button"
                onClick={() => void handleCreateSource()}
                disabled={sourceSaving !== null}
                className="mt-3 inline-flex items-center gap-2 min-h-11 px-4 py-2 rounded-xl bg-emerald-600 text-white text-sm font-semibold shadow-sm hover:bg-emerald-700 disabled:opacity-50"
              >
                {sourceSaving === -1 ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
                Quelle anlegen
              </button>

              <div className="mt-4 space-y-3">
                {selectedDetail.sources.length === 0 ? (
                  <p className="text-sm text-gray-500">Noch keine Quellen vorhanden.</p>
                ) : null}

                {selectedDetail.sources.map((source) => {
                  const isEditing = editingSourceId === source.id;
                  return (
                    <div key={source.id} className="rounded-lg border border-gray-100 p-3">
                      {isEditing ? (
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-2">
                          <select
                            value={editingSourceForm.source_kind}
                            onChange={(event) =>
                              setEditingSourceForm((previous) => ({ ...previous, source_kind: normalizeSourceType(event.target.value) }))
                            }
                            className="border border-gray-200 rounded-lg px-2.5 py-2 text-sm"
                          >
                            <option value="">Auswahl</option>
                            {DEFAULT_SOURCE_TYPES.map((entry) => (
                              <option key={`source-type-edit-${entry}`} value={entry}>
                                {entry}
                              </option>
                            ))}
                          </select>
                          <input
                            value={editingSourceForm.source_title}
                            onChange={(event) => setEditingSourceForm((previous) => ({ ...previous, source_title: event.target.value }))}
                            className="border border-gray-200 rounded-lg px-2.5 py-2 text-sm"
                            placeholder="Titel"
                          />
                          <input
                            value={editingSourceForm.source_url}
                            onChange={(event) => setEditingSourceForm((previous) => ({ ...previous, source_url: event.target.value }))}
                            className="border border-gray-200 rounded-lg px-2.5 py-2 text-sm"
                            placeholder="https://..."
                          />
                          <div className="flex gap-2">
                            <input
                              value={editingSourceForm.dose_min}
                              onChange={(event) => setEditingSourceForm((previous) => ({ ...previous, dose_min: event.target.value }))}
                              className="border border-gray-200 rounded-lg px-2.5 py-2 text-sm flex-1"
                              placeholder="Dose min"
                            />
                            <input
                              value={editingSourceForm.dose_max}
                              onChange={(event) => setEditingSourceForm((previous) => ({ ...previous, dose_max: event.target.value }))}
                              className="border border-gray-200 rounded-lg px-2.5 py-2 text-sm flex-1"
                              placeholder="Dose max"
                            />
                            <input
                              value={editingSourceForm.dose_unit}
                              onChange={(event) => setEditingSourceForm((previous) => ({ ...previous, dose_unit: event.target.value }))}
                              className="border border-gray-200 rounded-lg px-2.5 py-2 text-sm w-20"
                              placeholder="mg"
                            />
                          </div>
                          <input
                            value={editingSourceForm.notes}
                            onChange={(event) => setEditingSourceForm((previous) => ({ ...previous, notes: event.target.value }))}
                            className="border border-gray-200 rounded-lg px-2.5 py-2 text-sm"
                            placeholder="Notiz"
                          />
                          <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
                            <input
                              type="checkbox"
                              checked={editingSourceForm.no_recommendation}
                              onChange={(event) =>
                                setEditingSourceForm((previous) => ({ ...previous, no_recommendation: event.target.checked }))
                              }
                            />
                            Keine Empfehlung
                          </label>
                          <label className="flex flex-col gap-1 text-sm font-medium text-gray-700">
                            Empfehlungsart
                            <input
                              value={editingSourceForm.recommendation_type}
                              onChange={(event) =>
                                setEditingSourceForm((previous) => ({ ...previous, recommendation_type: event.target.value }))
                              }
                              className="border border-gray-200 rounded-lg px-2.5 py-2 text-sm"
                              placeholder="z. B. Nutzen, Risiko, Vorsicht"
                            />
                          </label>
                          <label className="flex flex-col gap-1 text-sm font-medium text-gray-700">
                            Zielgruppe / Population
                            <input
                              value={editingSourceForm.population}
                              onChange={(event) =>
                                setEditingSourceForm((previous) => ({ ...previous, population: event.target.value }))
                              }
                              className="border border-gray-200 rounded-lg px-2.5 py-2 text-sm"
                              placeholder="z. B. Erwachsene"
                            />
                          </label>
                          <label className="flex flex-col gap-1 text-sm font-medium text-gray-700">
                            Ergebnis
                            <input
                              value={editingSourceForm.outcome}
                              onChange={(event) => setEditingSourceForm((previous) => ({ ...previous, outcome: event.target.value }))}
                              className="border border-gray-200 rounded-lg px-2.5 py-2 text-sm"
                              placeholder="kurzes Fazit"
                            />
                          </label>
                          <label className="flex flex-col gap-1 text-sm font-medium text-gray-700">
                            Befund
                            <input
                              value={editingSourceForm.finding}
                              onChange={(event) => setEditingSourceForm((previous) => ({ ...previous, finding: event.target.value }))}
                              className="border border-gray-200 rounded-lg px-2.5 py-2 text-sm"
                              placeholder="Studienbefund / Kernaussage"
                            />
                          </label>
                          <label className="flex flex-col gap-1 text-sm font-medium text-gray-700">
                            Studientyp
                            <input
                              value={editingSourceForm.study_type}
                              onChange={(event) =>
                                setEditingSourceForm((previous) => ({ ...previous, study_type: event.target.value }))
                              }
                              className="border border-gray-200 rounded-lg px-2.5 py-2 text-sm"
                              placeholder="z. B. RCT, Meta-Analyse"
                            />
                          </label>
                          <label className="flex flex-col gap-1 text-sm font-medium text-gray-700">
                            Evidenzqualität
                            <input
                              value={editingSourceForm.evidence_quality}
                              onChange={(event) =>
                                setEditingSourceForm((previous) => ({ ...previous, evidence_quality: event.target.value }))
                              }
                              className="border border-gray-200 rounded-lg px-2.5 py-2 text-sm"
                              placeholder="hoch/mittel/niedrig"
                            />
                          </label>
                          <label className="flex flex-col gap-1 text-sm font-medium text-gray-700">
                            Quellen-Datum
                            <input
                              type="date"
                              value={editingSourceForm.source_date}
                              onChange={(event) =>
                                setEditingSourceForm((previous) => ({ ...previous, source_date: event.target.value }))
                              }
                              className="border border-gray-200 rounded-lg px-2.5 py-2 text-sm"
                            />
                          </label>
                          <label className="flex flex-col gap-1 text-sm font-medium text-gray-700">
                            Review-Datum
                            <input
                              type="datetime-local"
                              value={editingSourceForm.reviewed_at}
                              onChange={(event) =>
                                setEditingSourceForm((previous) => ({ ...previous, reviewed_at: event.target.value }))
                              }
                              className="border border-gray-200 rounded-lg px-2.5 py-2 text-sm"
                            />
                          </label>
                          <div className="col-span-full flex flex-wrap gap-2">
                            <button
                              type="button"
                              onClick={() => void handleUpdateSource()}
                              disabled={sourceSaving === source.id}
                              className="inline-flex items-center gap-2 rounded-lg border border-emerald-200 text-emerald-700 px-3 py-2 text-sm"
                            >
                              {sourceSaving === source.id ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                              Speichern
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setEditingSourceId(null);
                                setEditingSourceForm(EMPTY_SOURCE_FORM);
                              }}
                              className="inline-flex items-center gap-2 rounded-lg border border-gray-200 text-gray-700 px-3 py-2 text-sm"
                            >
                              <X size={14} />
                              Abbrechen
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-1">
                          <div className="flex flex-wrap items-start justify-between gap-2">
                            <p className="font-medium text-sm text-gray-900">{source.source_title || source.source_url || 'Quelle'}</p>
                            <div className="text-xs text-gray-500 flex flex-wrap gap-1">
                              {source.source_kind ? <span className="inline-flex rounded-full px-2 py-0.5 bg-slate-100">{source.source_kind}</span> : null}
                              {source.no_recommendation ? <span className="inline-flex rounded-full px-2 py-0.5 bg-rose-100 text-rose-700">Keine Empfehlung</span> : null}
                              {source.population ? <span className="inline-flex rounded-full px-2 py-0.5 bg-slate-100">{source.population}</span> : null}
                              {source.study_type ? <span className="inline-flex rounded-full px-2 py-0.5 bg-slate-100">{source.study_type}</span> : null}
                              {source.evidence_quality ? <span className="inline-flex rounded-full px-2 py-0.5 bg-slate-100">{source.evidence_quality}</span> : null}
                              {source.country ? <span className="inline-flex rounded-full px-2 py-0.5 bg-slate-100">{source.country}</span> : null}
                              {source.organization ? <span className="inline-flex rounded-full px-2 py-0.5 bg-slate-100">{source.organization}</span> : null}
                            </div>
                            <span className="text-xs">
                              {source.dose_min != null || source.dose_max != null
                                ? `${source.dose_min ?? '-'}${source.dose_max != null ? ` - ${source.dose_max}` : ''} ${source.dose_unit ?? ''}`
                                : null}
                            </span>
                          </div>
                          {source.notes ? <p className="text-sm text-gray-600">{source.notes}</p> : null}
                          {source.recommendation_type ? <p className="text-sm text-gray-700">Typ: {source.recommendation_type}</p> : null}
                          {source.finding ? <p className="text-sm text-gray-700">Befund: {source.finding}</p> : null}
                          {source.outcome ? <p className="text-sm text-gray-700">Ergebnis: {source.outcome}</p> : null}
                          {source.source_url ? (
                            <a className="text-sm text-indigo-700 hover:underline" href={source.source_url} target="_blank" rel="noreferrer">
                              Quelle oeffnen
                            </a>
                          ) : null}
                          <div className="pt-2 flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => startEditingSource(source)}
                              className="inline-flex items-center gap-1 text-xs text-gray-700 hover:text-gray-900"
                            >
                              <Pencil size={14} />
                              Bearbeiten
                            </button>
                            <button
                              type="button"
                              onClick={() => void handleDeleteSource(source.id)}
                              disabled={sourceDeleting === source.id}
                              className="inline-flex items-center gap-1 text-xs text-red-600 hover:text-red-700"
                            >
                              {sourceDeleting === source.id ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                              Entfernen
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="rounded-xl border border-gray-100 p-4">
              <h3 className="font-semibold text-gray-900 text-sm mb-3">Warnhinweise</h3>
              <div className="grid gap-3 grid-cols-1 lg:grid-cols-2">
                <label className="flex flex-col gap-1 text-sm font-medium text-gray-700">
                  Label
                  <input
                    value={newWarningForm.short_label}
                    onChange={(event) => setNewWarningForm((previous) => ({ ...previous, short_label: event.target.value }))}
                    className="border border-gray-200 rounded-xl px-3 py-2 text-sm"
                    placeholder="z. B. Lebertoxizitaet"
                  />
                </label>
                <label className="flex flex-col gap-1 text-sm font-medium text-gray-700">
                  Schwere
                  <input
                    list="warning-severity"
                    value={newWarningForm.severity}
                    onChange={(event) => setNewWarningForm((previous) => ({ ...previous, severity: event.target.value }))}
                    className="border border-gray-200 rounded-xl px-3 py-2 text-sm"
                    placeholder="info, caution, danger"
                  />
                  <datalist id="warning-severity">
                    {DEFAULT_WARNING_SEVERITIES.map((entry) => (
                      <option key={`warning-severity-${entry}`} value={entry} />
                    ))}
                  </datalist>
                </label>
                <label className="flex flex-col gap-1 text-sm font-medium text-gray-700">
                  Artikel-Slug
                  <input
                    value={newWarningForm.article_slug}
                    onChange={(event) => setNewWarningForm((previous) => ({ ...previous, article_slug: event.target.value }))}
                    className="border border-gray-200 rounded-xl px-3 py-2 text-sm"
                  />
                </label>
                <label className="flex flex-col gap-1 text-sm font-medium text-gray-700 col-span-full">
                  Hinweistext
                  <textarea
                    value={newWarningForm.popover_text}
                    onChange={(event) => setNewWarningForm((previous) => ({ ...previous, popover_text: event.target.value }))}
                    rows={2}
                    className="border border-gray-200 rounded-xl px-3 py-2 text-sm"
                    placeholder="kurzer Text..."
                  />
                </label>
                <div className="grid grid-cols-2 gap-2 col-span-full">
                  <label className="flex flex-col gap-1 text-sm font-medium text-gray-700">
                    Mindestmenge
                    <input
                      value={newWarningForm.min_amount}
                      onChange={(event) => setNewWarningForm((previous) => ({ ...previous, min_amount: event.target.value }))}
                      className="border border-gray-200 rounded-xl px-3 py-2 text-sm"
                      placeholder="z. B. 10"
                    />
                  </label>
                  <label className="flex flex-col gap-1 text-sm font-medium text-gray-700">
                    Einheit
                    <input
                      value={newWarningForm.unit}
                      onChange={(event) => setNewWarningForm((previous) => ({ ...previous, unit: event.target.value }))}
                      className="border border-gray-200 rounded-xl px-3 py-2 text-sm"
                      placeholder="mg"
                    />
                  </label>
                </div>
              </div>
              <button
                type="button"
                onClick={() => void handleCreateWarning()}
                disabled={warningSaving !== null}
                className="mt-3 inline-flex items-center gap-2 min-h-11 px-4 py-2 rounded-xl bg-rose-600 text-white text-sm font-semibold shadow-sm hover:bg-rose-700 disabled:opacity-50"
              >
                {warningSaving === -1 ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
                Warnung anlegen
              </button>

              <div className="mt-4 space-y-3">
                {selectedDetail.warnings.length === 0 ? (
                  <p className="text-sm text-gray-500">Noch keine Warnungen vorhanden.</p>
                ) : null}
                {selectedDetail.warnings.map((warning) => {
                  const isEditing = editingWarningId === warning.id;
                  return (
                    <div key={warning.id} className="rounded-lg border border-gray-100 p-3">
                      {isEditing ? (
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-2">
                          <input
                            value={editingWarningForm.short_label}
                            onChange={(event) => setEditingWarningForm((previous) => ({ ...previous, short_label: event.target.value }))}
                            className="border border-gray-200 rounded-lg px-2.5 py-2 text-sm"
                            placeholder="Label"
                          />
                          <input
                            value={editingWarningForm.severity}
                            onChange={(event) => setEditingWarningForm((previous) => ({ ...previous, severity: event.target.value }))}
                            className="border border-gray-200 rounded-lg px-2.5 py-2 text-sm"
                          />
                          <input
                            value={editingWarningForm.article_slug}
                            onChange={(event) => setEditingWarningForm((previous) => ({ ...previous, article_slug: event.target.value }))}
                            className="border border-gray-200 rounded-lg px-2.5 py-2 text-sm"
                            placeholder="Artikel-Slug"
                          />
                          <input
                            value={editingWarningForm.popover_text}
                            onChange={(event) => setEditingWarningForm((previous) => ({ ...previous, popover_text: event.target.value }))}
                            className="border border-gray-200 rounded-lg px-2.5 py-2 text-sm"
                            placeholder="Hinweis"
                          />
                          <div className="grid grid-cols-2 gap-2 col-span-full">
                            <input
                              value={editingWarningForm.min_amount}
                              onChange={(event) => setEditingWarningForm((previous) => ({ ...previous, min_amount: event.target.value }))}
                              className="border border-gray-200 rounded-lg px-2.5 py-2 text-sm"
                              placeholder="Mindestmenge"
                            />
                            <input
                              value={editingWarningForm.unit}
                              onChange={(event) => setEditingWarningForm((previous) => ({ ...previous, unit: event.target.value }))}
                              className="border border-gray-200 rounded-lg px-2.5 py-2 text-sm"
                              placeholder="Einheit"
                            />
                          </div>
                          <div className="flex flex-wrap gap-2 col-span-full">
                            <button
                              type="button"
                              onClick={() => void handleUpdateWarning()}
                              disabled={warningSaving === warning.id}
                              className="inline-flex items-center gap-2 rounded-lg border border-rose-200 text-rose-700 px-3 py-2 text-sm"
                            >
                              {warningSaving === warning.id ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                              Speichern
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setEditingWarningId(null);
                                setEditingWarningForm(EMPTY_WARNING_FORM);
                              }}
                              className="inline-flex items-center gap-2 rounded-lg border border-gray-200 text-gray-700 px-3 py-2 text-sm"
                            >
                              <X size={14} />
                              Abbrechen
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-1">
                          <div className="flex flex-wrap justify-between gap-2">
                            <p className="font-medium text-sm text-gray-900">{warning.short_label || 'Warnung'}</p>
                            <span className="text-xs">
                              {warning.short_label || '-'} {warning.severity ? `· ${warning.severity}` : ''}
                            </span>
                          </div>
                          {warning.popover_text ? <p className="text-sm text-gray-600">{warning.popover_text}</p> : null}
                          <p className="text-xs text-gray-500">
                            {warning.article_slug ? `Artikel: ${warning.article_slug}` : null}
                            {warning.article_slug && (warning.min_amount != null || warning.unit) ? ' · ' : ''}
                            {warning.min_amount != null ? `Mindestmenge: ${warning.min_amount}` : ''}
                            {warning.min_amount != null && warning.unit ? ' ' : ''}
                            {warning.unit}
                          </p>
                          <p className="text-xs text-gray-500">
                            {warning.active ? 'Aktiv' : 'Inaktiv'}
                          </p>
                          <div className="pt-2 flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => startEditingWarning(warning)}
                              className="inline-flex items-center gap-1 text-xs text-gray-700 hover:text-gray-900"
                            >
                              <Pencil size={14} />
                              Bearbeiten
                            </button>
                            <button
                              type="button"
                              onClick={() => void handleDeleteWarning(warning.id)}
                              disabled={warningDeleting === warning.id}
                              className="inline-flex items-center gap-1 text-xs text-red-600 hover:text-red-700"
                            >
                              {warningDeleting === warning.id ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                              Entfernen
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        ) : null}

        {detailError ? (
          <div className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {detailError}
          </div>
        ) : null}
      </section>

      <section className="md:hidden lg:hidden">
        <div className="rounded-2xl border border-gray-100 bg-white p-4 mt-4">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-semibold text-gray-900">Mobile: Suche & Filter</h3>
          </div>
          <div className="space-y-2">
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Wirkstoffsuche"
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm"
            />
            <select
              value={categoryFilter}
              onChange={(event) => setCategoryFilter(event.target.value)}
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm"
            >
              <option value="">Alle Kategorien</option>
              {categories.map((category) => (
                <option key={`mobile-${category}`} value={category}>
                  {category}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => void loadItems()}
              className="inline-flex items-center gap-2 rounded-xl border border-gray-200 text-sm px-3 py-2"
            >
              <Search size={14} />
              Suche aktualisieren
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
