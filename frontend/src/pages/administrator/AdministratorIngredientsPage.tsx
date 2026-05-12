import { type FormEvent, type ReactNode, useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Circle,
  ExternalLink,
  ListChecks,
  PackageCheck,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  X,
} from 'lucide-react';
import {
  createIngredientPrecursor,
  createIngredientResearchSource,
  deleteAdminIngredientProductRecommendation,
  deleteIngredientPrecursor,
  deleteIngredientResearchSource,
  getAdminIngredientProductRecommendations,
  getAdminIngredientTaskStatuses,
  getAdminIngredients,
  getAdminProducts,
  getAdminProductShopLinks,
  getIngredientPrecursors,
  getIngredientResearchDetail,
  updateIngredientPrecursor,
  updateIngredientResearchSource,
  updateAdminIngredientTaskStatus,
  upsertAdminIngredientProductRecommendation,
  type AdminCatalogProduct,
  type AdminIngredientGroupOption,
  type AdminIngredientListItem,
  type AdminIngredientPrecursor,
  type AdminIngredientProductRecommendation,
  type AdminIngredientProductRecommendationSlot,
  type AdminIngredientProductRecommendationSlots,
  type AdminIngredientResearchSource,
  type AdminIngredientTaskKey,
  type AdminIngredientTaskStatusMap,
  type AdminIngredientTaskStatusValue,
  type AdminProductShopLink,
} from '../../api/admin';
import { addForm, addSynonym, deleteForm, deleteSynonym, getIngredient, updateForm, updateSynonym } from '../../api/ingredients';
import type { IngredientForm, IngredientSynonym } from '../../types';
import { AdminBadge, AdminButton, AdminCard, AdminEmpty, AdminError, AdminPageHeader } from './AdminUi';

const PAGE_LIMIT_OPTIONS = [25, 50, 100] as const;

type IngredientTaskFilter = 'all' | AdminIngredientTaskKey | 'knowledge' | 'dosing';
type IngredientGroupFilter = 'all' | string;

const TASK_FILTERS: Array<{ value: IngredientTaskFilter; label: string }> = [
  { value: 'all', label: 'Alle Bearbeitungsstände' },
  { value: 'forms', label: 'Fehlend: Formen' },
  { value: 'dge', label: 'Fehlend: DGE' },
  { value: 'precursors', label: 'Fehlend: Wirkstoffteile' },
  { value: 'synonyms', label: 'Fehlend: Synonyme' },
  { value: 'knowledge', label: 'Fehlend: Blog / Wissen' },
  { value: 'dosing', label: 'Fehlend: Richtwerte' },
];

const RECOMMENDATION_SLOTS = ['primary', 'alternative_1', 'alternative_2'] as const;

const DEFAULT_INGREDIENT_GROUP_OPTIONS: AdminIngredientGroupOption[] = [
  { value: 'all', label: 'Alle Gruppen', count: 0 },
  { value: 'vitamins', label: 'Vitamine', count: 0 },
  { value: 'minerals', label: 'Mineralstoffe', count: 0 },
  { value: 'trace_elements', label: 'Spurenelemente', count: 0 },
  { value: 'enzymes', label: 'Enzyme', count: 0 },
];

const TASK_META: Record<AdminIngredientTaskKey, {
  label: string;
  noneLabel: string;
  doneLabel: string;
  emptyLabel: string;
}> = {
  forms: {
    label: 'Formen',
    noneLabel: 'Keine speziellen Darreichungsformen vorhanden',
    doneLabel: 'Formen geprüft',
    emptyLabel: 'Keine Formen hinterlegt.',
  },
  dge: {
    label: 'DGE',
    noneLabel: 'Keine Empfehlungen oder Einschränkungen laut DGE',
    doneLabel: 'DGE geprüft',
    emptyLabel: 'Keine DGE-Quelle hinterlegt.',
  },
  precursors: {
    label: 'Wirkstoffteile',
    noneLabel: 'Keine speziellen Wirkstoffteile vorhanden',
    doneLabel: 'Wirkstoffteile geprüft',
    emptyLabel: 'Keine Wirkstoffteile hinterlegt.',
  },
  synonyms: {
    label: 'Synonyme',
    noneLabel: 'Keine Synonyme',
    doneLabel: 'Synonyme geprüft',
    emptyLabel: 'Keine Synonyme hinterlegt.',
  },
};

const RECOMMENDATION_SLOT_LABELS: Record<AdminIngredientProductRecommendationSlot, string> = {
  primary: 'Hauptempfehlung',
  alternative_1: 'Alternative 1',
  alternative_2: 'Alternative 2',
};

const RECOMMENDATION_SLOT_SHORT_LABELS: Record<AdminIngredientProductRecommendationSlot, string> = {
  primary: 'Haupt',
  alternative_1: 'Alt. 1',
  alternative_2: 'Alt. 2',
};

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (error && typeof error === 'object' && 'message' in error && typeof error.message === 'string') return error.message;
  return 'Die Aktion konnte nicht ausgeführt werden.';
}

function hasBlogCoverage(ingredient: AdminIngredientListItem): boolean {
  return ingredient.has_blog_url || ingredient.knowledge_article_count > 0;
}

function taskCount(ingredient: AdminIngredientListItem, task: AdminIngredientTaskKey): number {
  if (task === 'forms') return ingredient.form_count;
  if (task === 'dge') return ingredient.dge_source_count;
  if (task === 'precursors') return ingredient.precursor_count;
  return ingredient.synonym_count;
}

function taskStatus(ingredient: AdminIngredientListItem, task: AdminIngredientTaskKey): AdminIngredientTaskStatusValue {
  return ingredient.task_statuses[task]?.status ?? 'open';
}

function isTaskResolved(ingredient: AdminIngredientListItem, task: AdminIngredientTaskKey): boolean {
  const status = taskStatus(ingredient, task);
  return taskCount(ingredient, task) > 0 || status === 'done' || status === 'none';
}

function taskDetail(ingredient: AdminIngredientListItem, task: AdminIngredientTaskKey): string {
  const count = taskCount(ingredient, task);
  const status = taskStatus(ingredient, task);
  if (count > 0) return String(count);
  if (status === 'none') return 'keine';
  if (status === 'done') return 'geprüft';
  return 'fehlt';
}

function taskTone(ingredient: AdminIngredientListItem, task: AdminIngredientTaskKey): 'ok' | 'warn' | 'info' {
  if (taskStatus(ingredient, task) === 'none') return 'info';
  return isTaskResolved(ingredient, task) ? 'ok' : 'warn';
}

function sourceMatchesDge(source: AdminIngredientResearchSource): boolean {
  const haystack = [
    source.organization,
    source.source_title,
    source.source_url,
  ].filter(Boolean).join(' ').toLowerCase();
  return source.source_kind === 'official' && (
    haystack.includes('dge') ||
    haystack.includes('dge.de') ||
    haystack.includes('deutsche gesellschaft') ||
    haystack.includes('gesellschaft für ernährung') ||
    haystack.includes('gesellschaft fuer ernaehrung') ||
    haystack.includes('gesellschaft fur ernahrung')
  );
}

function shopLinkHost(url: string | null): string {
  if (!url) return 'kein Shoplink';
  try {
    return new URL(url).host.replace(/^www\./, '');
  } catch {
    return url;
  }
}

function productLabel(product: Pick<AdminCatalogProduct, 'name' | 'brand'>): string {
  return product.brand ? `${product.brand} · ${product.name}` : product.name;
}

function parseModalNumber(value: string): number | null {
  const trimmed = value.trim().replace(',', '.');
  if (!trimmed) return null;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
}

function recommendationSummary(recommendation: AdminIngredientProductRecommendation | null): string {
  if (!recommendation) return 'fehlt';
  const shop = recommendation.shop_link_name || recommendation.shop_link_host || shopLinkHost(recommendation.shop_link_url);
  return shop && shop !== 'kein Shoplink' ? `${recommendation.product_name} · ${shop}` : recommendation.product_name;
}

function selectDefaultShopLink(links: AdminProductShopLink[]): AdminProductShopLink | null {
  return (
    links.find((link) => link.active === 1 && link.is_primary === 1) ??
    links.find((link) => link.active === 1) ??
    links[0] ??
    null
  );
}

function AdminDialog({
  title,
  subtitle,
  children,
  onClose,
  maxWidth = 'max-w-4xl',
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  children: ReactNode;
  onClose: () => void;
  maxWidth?: string;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/35 px-3 py-8"
      role="dialog"
      aria-modal="true"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className={`admin-card w-full ${maxWidth} overflow-hidden bg-[color:var(--admin-panel)] shadow-xl`}>
        <div className="admin-card-head">
          <div className="min-w-0">
            <h2 className="admin-card-title">{title}</h2>
            {subtitle ? <p className="admin-card-sub truncate">{subtitle}</p> : null}
          </div>
          <AdminButton size="sm" variant="ghost" onClick={onClose}>
            <X size={13} />
            Schließen
          </AdminButton>
        </div>
        <div className="grid gap-4 p-4">{children}</div>
      </div>
    </div>
  );
}

function EditableTaskBadge({
  ingredient,
  task,
  onOpen,
}: {
  ingredient: AdminIngredientListItem;
  task: AdminIngredientTaskKey;
  onOpen: (ingredient: AdminIngredientListItem, task: AdminIngredientTaskKey) => void;
}) {
  const Icon = isTaskResolved(ingredient, task) ? CheckCircle2 : Circle;
  const tone = taskTone(ingredient, task);
  return (
    <button
      type="button"
      className={`admin-badge admin-badge-${tone} gap-1 text-left`}
      onClick={() => onOpen(ingredient, task)}
      title={`${TASK_META[task].label} bearbeiten`}
    >
      <Icon size={12} />
      <span>{TASK_META[task].label}</span>
      <span className="opacity-70">{taskDetail(ingredient, task)}</span>
    </button>
  );
}

function IngredientProgressBadges({
  ingredient,
  onOpenTask,
}: {
  ingredient: AdminIngredientListItem;
  onOpenTask: (ingredient: AdminIngredientListItem, task: AdminIngredientTaskKey) => void;
}) {
  const knowledgeOk = hasBlogCoverage(ingredient);
  const dosingOk = ingredient.dose_recommendation_count > 0;
  const knowledgeDetail = ingredient.has_blog_url
    ? 'Blog-Link'
    : ingredient.knowledge_article_count > 0
      ? String(ingredient.knowledge_article_count)
      : 'fehlt';
  const dosingDetail = dosingOk ? String(ingredient.dose_recommendation_count) : 'fehlt';

  return (
    <div className="flex max-w-[720px] flex-wrap gap-1.5">
      <EditableTaskBadge ingredient={ingredient} task="forms" onOpen={onOpenTask} />
      <EditableTaskBadge ingredient={ingredient} task="dge" onOpen={onOpenTask} />
      <EditableTaskBadge ingredient={ingredient} task="precursors" onOpen={onOpenTask} />
      <EditableTaskBadge ingredient={ingredient} task="synonyms" onOpen={onOpenTask} />
      <Link
        to={`/administrator/knowledge?q=${encodeURIComponent(ingredient.name)}`}
        className={`admin-badge admin-badge-${knowledgeOk ? 'ok' : 'warn'} gap-1`}
        title="Blog / Wissen öffnen"
      >
        {knowledgeOk ? <CheckCircle2 size={12} /> : <Circle size={12} />}
        <span>Blog / Wissen</span>
        <span className="opacity-70">{knowledgeDetail}</span>
      </Link>
      <Link
        to={`/administrator/dosing?ingredient_id=${ingredient.id}&q=${encodeURIComponent(ingredient.name)}`}
        className={`admin-badge admin-badge-${dosingOk ? 'ok' : 'warn'} gap-1`}
        title="Richtwerte öffnen"
      >
        {dosingOk ? <CheckCircle2 size={12} /> : <Circle size={12} />}
        <span>Richtwerte</span>
        <span className="opacity-70">{dosingDetail}</span>
      </Link>
    </div>
  );
}

function RecommendationSlots({
  ingredient,
  onOpen,
}: {
  ingredient: AdminIngredientListItem;
  onOpen: (ingredient: AdminIngredientListItem) => void;
}) {
  return (
    <button
      type="button"
      className="grid min-w-[260px] gap-1 rounded-[var(--admin-r-sm)] border border-[color:var(--admin-line)] bg-[color:var(--admin-bg)] p-2 text-left text-xs hover:border-[color:var(--admin-line-strong)]"
      onClick={() => onOpen(ingredient)}
      title={`Empfehlungen fuer ${ingredient.name} verwalten`}
    >
      <span className="flex items-center gap-1 font-medium">
        <PackageCheck size={12} />
        Empfehlungen verwalten
      </span>
      {RECOMMENDATION_SLOTS.map((slot) => {
        const recommendation = ingredient.product_recommendations[slot];
        return (
          <span key={slot} className="min-w-0 truncate text-[color:var(--admin-ink-3)]">
            {RECOMMENDATION_SLOT_SHORT_LABELS[slot]}: {recommendationSummary(recommendation)}
          </span>
        );
      })}
    </button>
  );
}

function TaskStatusControls({
  task,
  status,
  note,
  disabled,
  onStatusChange,
  onNoteChange,
  onSaveNote,
}: {
  task: AdminIngredientTaskKey;
  status: AdminIngredientTaskStatusValue;
  note: string;
  disabled: boolean;
  onStatusChange: (status: AdminIngredientTaskStatusValue) => Promise<void>;
  onNoteChange: (note: string) => void;
  onSaveNote: () => Promise<void>;
}) {
  const noneChecked = status === 'none';
  const doneChecked = status === 'done';

  return (
    <div className="rounded-[var(--admin-r-sm)] border border-[color:var(--admin-line)] bg-[color:var(--admin-bg)] p-3">
      <div className="grid gap-2 text-sm">
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={noneChecked}
            disabled={disabled}
            onChange={(event) => void onStatusChange(event.target.checked ? 'none' : 'open')}
          />
          <span>{TASK_META[task].noneLabel}</span>
        </label>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={doneChecked}
            disabled={disabled || noneChecked}
            onChange={(event) => void onStatusChange(event.target.checked ? 'done' : 'open')}
          />
          <span>{TASK_META[task].doneLabel}</span>
        </label>
      </div>
      <div className="mt-3 grid gap-2">
        <textarea
          value={note}
          onChange={(event) => onNoteChange(event.target.value)}
          className="admin-input min-h-[82px]"
          placeholder="Interner Kommentar, optional"
          disabled={disabled}
        />
        <div className="flex justify-end">
          <AdminButton size="sm" onClick={() => void onSaveNote()} disabled={disabled}>
            Kommentar speichern
          </AdminButton>
        </div>
      </div>
    </div>
  );
}

function TaskModal({
  ingredient,
  task,
  onClose,
  onChanged,
}: {
  ingredient: AdminIngredientListItem;
  task: AdminIngredientTaskKey;
  onClose: () => void;
  onChanged: () => Promise<void>;
}) {
  const [statuses, setStatuses] = useState<AdminIngredientTaskStatusMap>({});
  const [forms, setForms] = useState<IngredientForm[]>([]);
  const [synonyms, setSynonyms] = useState<IngredientSynonym[]>([]);
  const [precursors, setPrecursors] = useState<AdminIngredientPrecursor[]>([]);
  const [dgeSources, setDgeSources] = useState<AdminIngredientResearchSource[]>([]);
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const [formName, setFormName] = useState('');
  const [formComment, setFormComment] = useState('');
  const [formTags, setFormTags] = useState('');
  const [synonymName, setSynonymName] = useState('');
  const [formDrafts, setFormDrafts] = useState<Record<number, { name: string; comment: string; tags: string; score: string }>>({});
  const [synonymDrafts, setSynonymDrafts] = useState<Record<number, { synonym: string; language: string }>>({});
  const [precursorDrafts, setPrecursorDrafts] = useState<Record<number, { note: string; sort_order: string }>>({});
  const [dgeDrafts, setDgeDrafts] = useState<Record<number, { title: string; url: string; notes: string; recommendation_type: string; no_recommendation: boolean; dose_min: string; dose_max: string; dose_unit: string }>>({});
  const [newDge, setNewDge] = useState({ title: '', url: '', notes: '', recommendation_type: '', no_recommendation: false, dose_min: '', dose_max: '', dose_unit: '' });
  const [precursorQuery, setPrecursorQuery] = useState('');
  const [precursorResults, setPrecursorResults] = useState<AdminIngredientListItem[]>([]);
  const [selectedPrecursorId, setSelectedPrecursorId] = useState<number | null>(null);
  const [precursorNote, setPrecursorNote] = useState('');

  const currentStatus = statuses[task]?.status ?? 'open';
  const fieldsDisabled = saving || currentStatus === 'none';

  const reload = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const nextStatuses = await getAdminIngredientTaskStatuses(ingredient.id);
      setStatuses(nextStatuses);
      setNote(nextStatuses[task]?.note ?? '');

      if (task === 'forms' || task === 'synonyms') {
        const detail = await getIngredient(ingredient.id);
        setForms(detail.forms ?? []);
        setSynonyms(detail.synonyms ?? []);
        setFormDrafts(Object.fromEntries((detail.forms ?? []).map((form) => [form.id, {
          name: form.name ?? '',
          comment: form.comment ?? '',
          tags: form.tags ?? '',
          score: form.score === undefined || form.score === null ? '' : String(form.score),
        }])));
        setSynonymDrafts(Object.fromEntries((detail.synonyms ?? []).map((synonym) => [synonym.id, {
          synonym: synonym.synonym ?? '',
          language: synonym.language ?? 'de',
        }])));
      }
      if (task === 'precursors') {
        const nextPrecursors = await getIngredientPrecursors(ingredient.id);
        setPrecursors(nextPrecursors);
        setPrecursorDrafts(Object.fromEntries(nextPrecursors.map((precursor) => [precursor.precursor_ingredient_id, {
          note: precursor.note ?? '',
          sort_order: String(precursor.sort_order ?? 0),
        }])));
      }
      if (task === 'dge') {
        const detail = await getIngredientResearchDetail(ingredient.id);
        const sources = detail.sources.filter(sourceMatchesDge);
        setDgeSources(sources);
        setDgeDrafts(Object.fromEntries(sources.map((source) => [source.id, {
          title: source.source_title ?? '',
          url: source.source_url ?? '',
          notes: source.notes ?? '',
          recommendation_type: source.recommendation_type ?? '',
          no_recommendation: Boolean(source.no_recommendation),
          dose_min: source.dose_min === null ? '' : String(source.dose_min),
          dose_max: source.dose_max === null ? '' : String(source.dose_max),
          dose_unit: source.dose_unit ?? '',
        }])));
      }
    } catch (modalError) {
      setError(getErrorMessage(modalError));
    } finally {
      setLoading(false);
    }
  }, [ingredient.id, task]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const persistStatus = async (nextStatus: AdminIngredientTaskStatusValue, nextNote = note) => {
    setSaving(true);
    setError('');
    setMessage('');
    try {
      const nextStatuses = await updateAdminIngredientTaskStatus(ingredient.id, task, {
        status: nextStatus,
        note: nextNote,
      });
      setStatuses(nextStatuses);
      setNote(nextStatuses[task]?.note ?? nextNote);
      setMessage('Bearbeitungsstand gespeichert.');
      await onChanged();
    } catch (modalError) {
      setError(getErrorMessage(modalError));
    } finally {
      setSaving(false);
    }
  };

  const handleAddForm = async (event: FormEvent) => {
    event.preventDefault();
    if (!formName.trim()) return;
    setSaving(true);
    setError('');
    setMessage('');
    try {
      await addForm(ingredient.id, {
        name: formName.trim(),
        comment: formComment.trim() || undefined,
        tags: formTags.trim() || undefined,
        score: 0,
      });
      setFormName('');
      setFormComment('');
      setFormTags('');
      await reload();
      await onChanged();
      setMessage('Form hinzugefügt.');
    } catch (modalError) {
      setError(getErrorMessage(modalError));
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteForm = async (form: IngredientForm) => {
    if (!window.confirm(`Form "${form.name}" löschen?`)) return;
    setSaving(true);
    setError('');
    setMessage('');
    try {
      await deleteForm(ingredient.id, form.id);
      await reload();
      await onChanged();
      setMessage('Form gelöscht.');
    } catch (modalError) {
      setError(getErrorMessage(modalError));
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateForm = async (form: IngredientForm) => {
    const draft = formDrafts[form.id];
    if (!draft?.name.trim()) return;
    setSaving(true);
    setError('');
    setMessage('');
    try {
      await updateForm(ingredient.id, form.id, {
        name: draft.name.trim(),
        comment: draft.comment.trim() || undefined,
        tags: draft.tags.trim() || undefined,
        score: parseModalNumber(draft.score) ?? 0,
      });
      await reload();
      await onChanged();
      setMessage('Form gespeichert.');
    } catch (modalError) {
      setError(getErrorMessage(modalError));
    } finally {
      setSaving(false);
    }
  };

  const handleAddSynonym = async (event: FormEvent) => {
    event.preventDefault();
    if (!synonymName.trim()) return;
    setSaving(true);
    setError('');
    setMessage('');
    try {
      await addSynonym(ingredient.id, synonymName.trim());
      setSynonymName('');
      await reload();
      await onChanged();
      setMessage('Synonym hinzugefügt.');
    } catch (modalError) {
      setError(getErrorMessage(modalError));
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteSynonym = async (synonym: IngredientSynonym) => {
    if (!window.confirm(`Synonym "${synonym.synonym}" löschen?`)) return;
    setSaving(true);
    setError('');
    setMessage('');
    try {
      await deleteSynonym(ingredient.id, synonym.id);
      await reload();
      await onChanged();
      setMessage('Synonym gelöscht.');
    } catch (modalError) {
      setError(getErrorMessage(modalError));
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateSynonym = async (synonym: IngredientSynonym) => {
    const draft = synonymDrafts[synonym.id];
    if (!draft?.synonym.trim()) return;
    setSaving(true);
    setError('');
    setMessage('');
    try {
      await updateSynonym(ingredient.id, synonym.id, {
        synonym: draft.synonym.trim(),
        language: draft.language.trim() || 'de',
      });
      await reload();
      await onChanged();
      setMessage('Synonym gespeichert.');
    } catch (modalError) {
      setError(getErrorMessage(modalError));
    } finally {
      setSaving(false);
    }
  };

  const handleSearchPrecursors = async (event?: FormEvent) => {
    event?.preventDefault();
    if (!precursorQuery.trim()) return;
    setSaving(true);
    setError('');
    try {
      const response = await getAdminIngredients({ q: precursorQuery.trim(), limit: 8 });
      setPrecursorResults(response.ingredients.filter((entry) => entry.id !== ingredient.id));
    } catch (modalError) {
      setError(getErrorMessage(modalError));
    } finally {
      setSaving(false);
    }
  };

  const handleAddPrecursor = async () => {
    if (!selectedPrecursorId) return;
    setSaving(true);
    setError('');
    setMessage('');
    try {
      await createIngredientPrecursor(ingredient.id, {
        precursor_ingredient_id: selectedPrecursorId,
        note: precursorNote.trim() || null,
      });
      setSelectedPrecursorId(null);
      setPrecursorQuery('');
      setPrecursorResults([]);
      setPrecursorNote('');
      await reload();
      await onChanged();
      setMessage('Wirkstoffteil hinzugefügt.');
    } catch (modalError) {
      setError(getErrorMessage(modalError));
    } finally {
      setSaving(false);
    }
  };

  const handleDeletePrecursor = async (precursor: AdminIngredientPrecursor) => {
    if (!window.confirm(`Wirkstoffteil "${precursor.precursor_name}" löschen?`)) return;
    setSaving(true);
    setError('');
    setMessage('');
    try {
      await deleteIngredientPrecursor(ingredient.id, precursor.precursor_ingredient_id);
      await reload();
      await onChanged();
      setMessage('Wirkstoffteil gelöscht.');
    } catch (modalError) {
      setError(getErrorMessage(modalError));
    } finally {
      setSaving(false);
    }
  };

  const handleUpdatePrecursor = async (precursor: AdminIngredientPrecursor) => {
    const draft = precursorDrafts[precursor.precursor_ingredient_id];
    if (!draft) return;
    setSaving(true);
    setError('');
    setMessage('');
    try {
      await updateIngredientPrecursor(ingredient.id, precursor.precursor_ingredient_id, {
        note: draft.note.trim() || null,
        sort_order: parseModalNumber(draft.sort_order) ?? 0,
      });
      await reload();
      await onChanged();
      setMessage('Wirkstoffteil gespeichert.');
    } catch (modalError) {
      setError(getErrorMessage(modalError));
    } finally {
      setSaving(false);
    }
  };

  const dgePayload = (draft: typeof newDge) => ({
    source_kind: 'official',
    organization: 'Deutsche Gesellschaft für Ernährung',
    source_title: draft.title.trim() || 'Deutsche Gesellschaft für Ernährung',
    source_url: draft.url.trim() || null,
    notes: draft.notes.trim() || null,
    recommendation_type: draft.recommendation_type.trim() || null,
    no_recommendation: draft.no_recommendation,
    dose_min: parseModalNumber(draft.dose_min),
    dose_max: parseModalNumber(draft.dose_max),
    dose_unit: draft.dose_unit.trim() || null,
  });

  const handleCreateDgeSource = async () => {
    setSaving(true);
    setError('');
    setMessage('');
    try {
      await createIngredientResearchSource(ingredient.id, dgePayload(newDge));
      setNewDge({ title: '', url: '', notes: '', recommendation_type: '', no_recommendation: false, dose_min: '', dose_max: '', dose_unit: '' });
      await reload();
      await onChanged();
      setMessage('DGE-Quelle angelegt.');
    } catch (modalError) {
      setError(getErrorMessage(modalError));
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateDgeSource = async (source: AdminIngredientResearchSource) => {
    const draft = dgeDrafts[source.id];
    if (!draft) return;
    setSaving(true);
    setError('');
    setMessage('');
    try {
      await updateIngredientResearchSource(source.id, {
        ingredient_id: ingredient.id,
        ...dgePayload(draft),
        version: source.version,
      });
      await reload();
      await onChanged();
      setMessage('DGE-Quelle gespeichert.');
    } catch (modalError) {
      setError(getErrorMessage(modalError));
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteDgeSource = async (source: AdminIngredientResearchSource) => {
    if (!window.confirm('DGE-Quelle löschen?')) return;
    setSaving(true);
    setError('');
    setMessage('');
    try {
      await deleteIngredientResearchSource(source.id, { version: source.version });
      await reload();
      await onChanged();
      setMessage('DGE-Quelle gelöscht.');
    } catch (modalError) {
      setError(getErrorMessage(modalError));
    } finally {
      setSaving(false);
    }
  };

  return (
    <AdminDialog title={TASK_META[task].label} subtitle={ingredient.name} onClose={onClose}>
      {error && <AdminError>{error}</AdminError>}
      {message && <p className="admin-muted text-xs">{message}</p>}
      {loading ? (
        <AdminEmpty>Lade Daten...</AdminEmpty>
      ) : (
        <>
          <TaskStatusControls
            task={task}
            status={currentStatus}
            note={note}
            disabled={saving}
            onStatusChange={persistStatus}
            onNoteChange={setNote}
            onSaveNote={() => persistStatus(currentStatus, note)}
          />

          {task === 'forms' && (
            <div className="grid gap-3">
              <div className="grid gap-2">
                {forms.length === 0 ? (
                  <AdminEmpty>{TASK_META.forms.emptyLabel}</AdminEmpty>
                ) : forms.map((form) => (
                  <div key={form.id} className="flex flex-wrap items-start justify-between gap-3 rounded-[var(--admin-r-sm)] border border-[color:var(--admin-line)] bg-[color:var(--admin-bg)] p-3 text-sm">
                    <div className="min-w-0">
                      <div className="font-medium">{form.name}</div>
                      {form.comment ? <p className="admin-muted mt-1">{form.comment}</p> : null}
                      {form.tags ? <p className="admin-muted mt-1 text-xs">Tags: {form.tags}</p> : null}
                    </div>
                    <div className="grid min-w-[260px] flex-1 gap-2 md:grid-cols-[1fr_1fr_0.8fr_72px_auto]">
                      <input
                        value={formDrafts[form.id]?.name ?? form.name}
                        onChange={(event) => setFormDrafts((previous) => ({
                          ...previous,
                          [form.id]: { ...(previous[form.id] ?? { name: form.name, comment: form.comment ?? '', tags: form.tags ?? '', score: form.score == null ? '' : String(form.score) }), name: event.target.value },
                        }))}
                        className="admin-input"
                        placeholder="Form"
                        disabled={fieldsDisabled}
                      />
                      <input
                        value={formDrafts[form.id]?.comment ?? form.comment ?? ''}
                        onChange={(event) => setFormDrafts((previous) => ({
                          ...previous,
                          [form.id]: { ...(previous[form.id] ?? { name: form.name, comment: '', tags: form.tags ?? '', score: form.score == null ? '' : String(form.score) }), comment: event.target.value },
                        }))}
                        className="admin-input"
                        placeholder="Kommentar"
                        disabled={fieldsDisabled}
                      />
                      <input
                        value={formDrafts[form.id]?.tags ?? form.tags ?? ''}
                        onChange={(event) => setFormDrafts((previous) => ({
                          ...previous,
                          [form.id]: { ...(previous[form.id] ?? { name: form.name, comment: form.comment ?? '', tags: '', score: form.score == null ? '' : String(form.score) }), tags: event.target.value },
                        }))}
                        className="admin-input"
                        placeholder="Tags"
                        disabled={fieldsDisabled}
                      />
                      <input
                        value={formDrafts[form.id]?.score ?? (form.score == null ? '' : String(form.score))}
                        onChange={(event) => setFormDrafts((previous) => ({
                          ...previous,
                          [form.id]: { ...(previous[form.id] ?? { name: form.name, comment: form.comment ?? '', tags: form.tags ?? '', score: '' }), score: event.target.value },
                        }))}
                        className="admin-input"
                        placeholder="Score"
                        inputMode="numeric"
                        disabled={fieldsDisabled}
                      />
                      <AdminButton size="sm" onClick={() => void handleUpdateForm(form)} disabled={fieldsDisabled || !formDrafts[form.id]?.name?.trim()}>
                        Speichern
                      </AdminButton>
                    </div>
                    <AdminButton size="sm" variant="danger" onClick={() => void handleDeleteForm(form)} disabled={fieldsDisabled}>
                      <Trash2 size={13} />
                      Löschen
                    </AdminButton>
                  </div>
                ))}
              </div>
              <form className="grid gap-2 rounded-[var(--admin-r-sm)] border border-[color:var(--admin-line)] p-3" onSubmit={handleAddForm}>
                <input value={formName} onChange={(event) => setFormName(event.target.value)} className="admin-input" placeholder="Form, z. B. Magnesiumcitrat" disabled={fieldsDisabled} />
                <input value={formComment} onChange={(event) => setFormComment(event.target.value)} className="admin-input" placeholder="Kommentar, optional" disabled={fieldsDisabled} />
                <input value={formTags} onChange={(event) => setFormTags(event.target.value)} className="admin-input" placeholder="Tags, optional" disabled={fieldsDisabled} />
                <div className="flex justify-end">
                  <AdminButton type="submit" variant="primary" disabled={fieldsDisabled || !formName.trim()}>
                    <Plus size={13} />
                    Form hinzufügen
                  </AdminButton>
                </div>
              </form>
            </div>
          )}

          {task === 'synonyms' && (
            <div className="grid gap-3">
              <div className="grid gap-2">
                {synonyms.length === 0 ? (
                  <AdminEmpty>{TASK_META.synonyms.emptyLabel}</AdminEmpty>
                ) : synonyms.map((synonym) => (
                  <div key={synonym.id} className="flex flex-wrap items-center justify-between gap-3 rounded-[var(--admin-r-sm)] border border-[color:var(--admin-line)] bg-[color:var(--admin-bg)] p-3 text-sm">
                    <span className="font-medium">{synonym.synonym}</span>
                    <div className="grid min-w-[260px] flex-1 gap-2 md:grid-cols-[1fr_84px_auto]">
                      <input
                        value={synonymDrafts[synonym.id]?.synonym ?? synonym.synonym}
                        onChange={(event) => setSynonymDrafts((previous) => ({
                          ...previous,
                          [synonym.id]: { ...(previous[synonym.id] ?? { synonym: synonym.synonym, language: synonym.language ?? 'de' }), synonym: event.target.value },
                        }))}
                        className="admin-input"
                        placeholder="Synonym"
                        disabled={fieldsDisabled}
                      />
                      <input
                        value={synonymDrafts[synonym.id]?.language ?? synonym.language ?? 'de'}
                        onChange={(event) => setSynonymDrafts((previous) => ({
                          ...previous,
                          [synonym.id]: { ...(previous[synonym.id] ?? { synonym: synonym.synonym, language: synonym.language ?? 'de' }), language: event.target.value },
                        }))}
                        className="admin-input"
                        placeholder="Sprache"
                        disabled={fieldsDisabled}
                      />
                      <AdminButton size="sm" onClick={() => void handleUpdateSynonym(synonym)} disabled={fieldsDisabled || !synonymDrafts[synonym.id]?.synonym?.trim()}>
                        Speichern
                      </AdminButton>
                    </div>
                    <AdminButton size="sm" variant="danger" onClick={() => void handleDeleteSynonym(synonym)} disabled={fieldsDisabled}>
                      <Trash2 size={13} />
                      Löschen
                    </AdminButton>
                  </div>
                ))}
              </div>
              <form className="flex flex-wrap gap-2 rounded-[var(--admin-r-sm)] border border-[color:var(--admin-line)] p-3" onSubmit={handleAddSynonym}>
                <input value={synonymName} onChange={(event) => setSynonymName(event.target.value)} className="admin-input min-w-[220px] flex-1" placeholder="Synonym oder Abkürzung" disabled={fieldsDisabled} />
                <AdminButton type="submit" variant="primary" disabled={fieldsDisabled || !synonymName.trim()}>
                  <Plus size={13} />
                  Synonym hinzufügen
                </AdminButton>
              </form>
            </div>
          )}

          {task === 'precursors' && (
            <div className="grid gap-3">
              <div className="grid gap-2">
                {precursors.length === 0 ? (
                  <AdminEmpty>{TASK_META.precursors.emptyLabel}</AdminEmpty>
                ) : precursors.map((precursor) => (
                  <div key={precursor.precursor_ingredient_id} className="flex flex-wrap items-start justify-between gap-3 rounded-[var(--admin-r-sm)] border border-[color:var(--admin-line)] bg-[color:var(--admin-bg)] p-3 text-sm">
                    <div className="min-w-0">
                      <div className="font-medium">{precursor.precursor_name}</div>
                      {precursor.note ? <p className="admin-muted mt-1">{precursor.note}</p> : null}
                    </div>
                    <div className="grid min-w-[260px] flex-1 gap-2 md:grid-cols-[1fr_96px_auto]">
                      <input
                        value={precursorDrafts[precursor.precursor_ingredient_id]?.note ?? precursor.note ?? ''}
                        onChange={(event) => setPrecursorDrafts((previous) => ({
                          ...previous,
                          [precursor.precursor_ingredient_id]: {
                            ...(previous[precursor.precursor_ingredient_id] ?? { note: precursor.note ?? '', sort_order: String(precursor.sort_order ?? 0) }),
                            note: event.target.value,
                          },
                        }))}
                        className="admin-input"
                        placeholder="Notiz"
                        disabled={fieldsDisabled}
                      />
                      <input
                        value={precursorDrafts[precursor.precursor_ingredient_id]?.sort_order ?? String(precursor.sort_order ?? 0)}
                        onChange={(event) => setPrecursorDrafts((previous) => ({
                          ...previous,
                          [precursor.precursor_ingredient_id]: {
                            ...(previous[precursor.precursor_ingredient_id] ?? { note: precursor.note ?? '', sort_order: String(precursor.sort_order ?? 0) }),
                            sort_order: event.target.value,
                          },
                        }))}
                        className="admin-input"
                        placeholder="Reihenfolge"
                        inputMode="numeric"
                        disabled={fieldsDisabled}
                      />
                      <AdminButton size="sm" onClick={() => void handleUpdatePrecursor(precursor)} disabled={fieldsDisabled}>
                        Speichern
                      </AdminButton>
                    </div>
                    <AdminButton size="sm" variant="danger" onClick={() => void handleDeletePrecursor(precursor)} disabled={fieldsDisabled}>
                      <Trash2 size={13} />
                      Löschen
                    </AdminButton>
                  </div>
                ))}
              </div>
              <form className="grid gap-2 rounded-[var(--admin-r-sm)] border border-[color:var(--admin-line)] p-3" onSubmit={handleSearchPrecursors}>
                <div className="flex flex-wrap gap-2">
                  <input value={precursorQuery} onChange={(event) => setPrecursorQuery(event.target.value)} className="admin-input min-w-[220px] flex-1" placeholder="Wirkstoffteil suchen" disabled={fieldsDisabled} />
                  <AdminButton type="submit" disabled={fieldsDisabled || !precursorQuery.trim()}>
                    <Search size={13} />
                    Suchen
                  </AdminButton>
                </div>
                {precursorResults.length > 0 && (
                  <select
                    value={selectedPrecursorId ?? ''}
                    onChange={(event) => setSelectedPrecursorId(event.target.value ? Number(event.target.value) : null)}
                    className="admin-select"
                    disabled={fieldsDisabled}
                  >
                    <option value="">Wirkstoffteil auswählen</option>
                    {precursorResults.map((entry) => (
                      <option key={entry.id} value={entry.id}>{entry.name}</option>
                    ))}
                  </select>
                )}
                <input value={precursorNote} onChange={(event) => setPrecursorNote(event.target.value)} className="admin-input" placeholder="Notiz, optional" disabled={fieldsDisabled} />
                <div className="flex justify-end">
                  <AdminButton variant="primary" onClick={() => void handleAddPrecursor()} disabled={fieldsDisabled || !selectedPrecursorId}>
                    <Plus size={13} />
                    Wirkstoffteil hinzufügen
                  </AdminButton>
                </div>
              </form>
            </div>
          )}

          {task === 'dge' && (
            <div className="grid gap-3">
              {dgeSources.length === 0 ? (
                <AdminEmpty>{TASK_META.dge.emptyLabel}</AdminEmpty>
              ) : dgeSources.map((source) => (
                <article key={source.id} className="rounded-[var(--admin-r-sm)] border border-[color:var(--admin-line)] bg-[color:var(--admin-bg)] p-3 text-sm">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="font-medium">{source.source_title || source.organization || 'DGE-Quelle'}</div>
                      <div className="admin-muted mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs">
                        {source.organization ? <span>{source.organization}</span> : null}
                        {source.recommendation_type ? <span>{source.recommendation_type}</span> : null}
                        {source.no_recommendation ? <span>Keine Empfehlung</span> : null}
                      </div>
                      {source.notes ? <p className="admin-muted mt-2">{source.notes}</p> : null}
                    </div>
                    {source.source_url ? (
                      <a href={source.source_url} target="_blank" rel="noopener noreferrer" className="admin-icon-btn" aria-label="DGE-Quelle öffnen">
                        <ExternalLink size={15} />
                      </a>
                    ) : null}
                  </div>
                  <div className="mt-3 grid gap-2">
                    <div className="grid gap-2 md:grid-cols-2">
                      <input
                        value={dgeDrafts[source.id]?.title ?? source.source_title ?? ''}
                        onChange={(event) => setDgeDrafts((previous) => ({
                          ...previous,
                          [source.id]: { ...(previous[source.id] ?? {
                            title: source.source_title ?? '',
                            url: source.source_url ?? '',
                            notes: source.notes ?? '',
                            recommendation_type: source.recommendation_type ?? '',
                            no_recommendation: Boolean(source.no_recommendation),
                            dose_min: source.dose_min === null ? '' : String(source.dose_min),
                            dose_max: source.dose_max === null ? '' : String(source.dose_max),
                            dose_unit: source.dose_unit ?? '',
                          }), title: event.target.value },
                        }))}
                        className="admin-input"
                        placeholder="Quellentitel"
                        disabled={fieldsDisabled}
                      />
                      <input
                        value={dgeDrafts[source.id]?.url ?? source.source_url ?? ''}
                        onChange={(event) => setDgeDrafts((previous) => ({
                          ...previous,
                          [source.id]: { ...(previous[source.id] ?? {
                            title: source.source_title ?? '',
                            url: source.source_url ?? '',
                            notes: source.notes ?? '',
                            recommendation_type: source.recommendation_type ?? '',
                            no_recommendation: Boolean(source.no_recommendation),
                            dose_min: source.dose_min === null ? '' : String(source.dose_min),
                            dose_max: source.dose_max === null ? '' : String(source.dose_max),
                            dose_unit: source.dose_unit ?? '',
                          }), url: event.target.value },
                        }))}
                        className="admin-input"
                        placeholder="URL"
                        disabled={fieldsDisabled}
                      />
                    </div>
                    <div className="grid gap-2 md:grid-cols-[1fr_0.7fr_0.7fr_0.7fr]">
                      <input
                        value={dgeDrafts[source.id]?.recommendation_type ?? source.recommendation_type ?? ''}
                        onChange={(event) => setDgeDrafts((previous) => ({
                          ...previous,
                          [source.id]: { ...(previous[source.id] ?? {
                            title: source.source_title ?? '',
                            url: source.source_url ?? '',
                            notes: source.notes ?? '',
                            recommendation_type: source.recommendation_type ?? '',
                            no_recommendation: Boolean(source.no_recommendation),
                            dose_min: source.dose_min === null ? '' : String(source.dose_min),
                            dose_max: source.dose_max === null ? '' : String(source.dose_max),
                            dose_unit: source.dose_unit ?? '',
                          }), recommendation_type: event.target.value },
                        }))}
                        className="admin-input"
                        placeholder="Empfehlungstyp"
                        disabled={fieldsDisabled}
                      />
                      <input
                        value={dgeDrafts[source.id]?.dose_min ?? (source.dose_min === null ? '' : String(source.dose_min))}
                        onChange={(event) => setDgeDrafts((previous) => ({
                          ...previous,
                          [source.id]: { ...(previous[source.id] ?? {
                            title: source.source_title ?? '',
                            url: source.source_url ?? '',
                            notes: source.notes ?? '',
                            recommendation_type: source.recommendation_type ?? '',
                            no_recommendation: Boolean(source.no_recommendation),
                            dose_min: source.dose_min === null ? '' : String(source.dose_min),
                            dose_max: source.dose_max === null ? '' : String(source.dose_max),
                            dose_unit: source.dose_unit ?? '',
                          }), dose_min: event.target.value },
                        }))}
                        className="admin-input"
                        placeholder="Min"
                        inputMode="decimal"
                        disabled={fieldsDisabled}
                      />
                      <input
                        value={dgeDrafts[source.id]?.dose_max ?? (source.dose_max === null ? '' : String(source.dose_max))}
                        onChange={(event) => setDgeDrafts((previous) => ({
                          ...previous,
                          [source.id]: { ...(previous[source.id] ?? {
                            title: source.source_title ?? '',
                            url: source.source_url ?? '',
                            notes: source.notes ?? '',
                            recommendation_type: source.recommendation_type ?? '',
                            no_recommendation: Boolean(source.no_recommendation),
                            dose_min: source.dose_min === null ? '' : String(source.dose_min),
                            dose_max: source.dose_max === null ? '' : String(source.dose_max),
                            dose_unit: source.dose_unit ?? '',
                          }), dose_max: event.target.value },
                        }))}
                        className="admin-input"
                        placeholder="Max"
                        inputMode="decimal"
                        disabled={fieldsDisabled}
                      />
                      <input
                        value={dgeDrafts[source.id]?.dose_unit ?? source.dose_unit ?? ''}
                        onChange={(event) => setDgeDrafts((previous) => ({
                          ...previous,
                          [source.id]: { ...(previous[source.id] ?? {
                            title: source.source_title ?? '',
                            url: source.source_url ?? '',
                            notes: source.notes ?? '',
                            recommendation_type: source.recommendation_type ?? '',
                            no_recommendation: Boolean(source.no_recommendation),
                            dose_min: source.dose_min === null ? '' : String(source.dose_min),
                            dose_max: source.dose_max === null ? '' : String(source.dose_max),
                            dose_unit: source.dose_unit ?? '',
                          }), dose_unit: event.target.value },
                        }))}
                        className="admin-input"
                        placeholder="Einheit"
                        disabled={fieldsDisabled}
                      />
                    </div>
                    <textarea
                      value={dgeDrafts[source.id]?.notes ?? source.notes ?? ''}
                      onChange={(event) => setDgeDrafts((previous) => ({
                        ...previous,
                        [source.id]: { ...(previous[source.id] ?? {
                          title: source.source_title ?? '',
                          url: source.source_url ?? '',
                          notes: source.notes ?? '',
                          recommendation_type: source.recommendation_type ?? '',
                          no_recommendation: Boolean(source.no_recommendation),
                          dose_min: source.dose_min === null ? '' : String(source.dose_min),
                          dose_max: source.dose_max === null ? '' : String(source.dose_max),
                          dose_unit: source.dose_unit ?? '',
                        }), notes: event.target.value },
                      }))}
                      className="admin-input min-h-[82px]"
                      placeholder="Notiz"
                      disabled={fieldsDisabled}
                    />
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <label className="flex items-center gap-2 text-xs">
                        <input
                          type="checkbox"
                          checked={dgeDrafts[source.id]?.no_recommendation ?? Boolean(source.no_recommendation)}
                          onChange={(event) => setDgeDrafts((previous) => ({
                            ...previous,
                            [source.id]: { ...(previous[source.id] ?? {
                              title: source.source_title ?? '',
                              url: source.source_url ?? '',
                              notes: source.notes ?? '',
                              recommendation_type: source.recommendation_type ?? '',
                              no_recommendation: Boolean(source.no_recommendation),
                              dose_min: source.dose_min === null ? '' : String(source.dose_min),
                              dose_max: source.dose_max === null ? '' : String(source.dose_max),
                              dose_unit: source.dose_unit ?? '',
                            }), no_recommendation: event.target.checked },
                          }))}
                          disabled={fieldsDisabled}
                        />
                        Keine Empfehlung
                      </label>
                      <div className="flex flex-wrap gap-2">
                        <AdminButton size="sm" onClick={() => void handleUpdateDgeSource(source)} disabled={fieldsDisabled}>
                          Speichern
                        </AdminButton>
                        <AdminButton size="sm" variant="danger" onClick={() => void handleDeleteDgeSource(source)} disabled={fieldsDisabled}>
                          <Trash2 size={13} />
                          Loeschen
                        </AdminButton>
                      </div>
                    </div>
                  </div>
                </article>
              ))}
              <form
                className="grid gap-2 rounded-[var(--admin-r-sm)] border border-[color:var(--admin-line)] p-3"
                onSubmit={(event) => {
                  event.preventDefault();
                  void handleCreateDgeSource();
                }}
              >
                <div className="grid gap-2 md:grid-cols-2">
                  <input
                    value={newDge.title}
                    onChange={(event) => setNewDge((previous) => ({ ...previous, title: event.target.value }))}
                    className="admin-input"
                    placeholder="Neue DGE-Quelle"
                    disabled={fieldsDisabled}
                  />
                  <input
                    value={newDge.url}
                    onChange={(event) => setNewDge((previous) => ({ ...previous, url: event.target.value }))}
                    className="admin-input"
                    placeholder="URL"
                    disabled={fieldsDisabled}
                  />
                </div>
                <div className="grid gap-2 md:grid-cols-[1fr_0.7fr_0.7fr_0.7fr]">
                  <input
                    value={newDge.recommendation_type}
                    onChange={(event) => setNewDge((previous) => ({ ...previous, recommendation_type: event.target.value }))}
                    className="admin-input"
                    placeholder="Empfehlungstyp"
                    disabled={fieldsDisabled}
                  />
                  <input
                    value={newDge.dose_min}
                    onChange={(event) => setNewDge((previous) => ({ ...previous, dose_min: event.target.value }))}
                    className="admin-input"
                    placeholder="Min"
                    inputMode="decimal"
                    disabled={fieldsDisabled}
                  />
                  <input
                    value={newDge.dose_max}
                    onChange={(event) => setNewDge((previous) => ({ ...previous, dose_max: event.target.value }))}
                    className="admin-input"
                    placeholder="Max"
                    inputMode="decimal"
                    disabled={fieldsDisabled}
                  />
                  <input
                    value={newDge.dose_unit}
                    onChange={(event) => setNewDge((previous) => ({ ...previous, dose_unit: event.target.value }))}
                    className="admin-input"
                    placeholder="Einheit"
                    disabled={fieldsDisabled}
                  />
                </div>
                <textarea
                  value={newDge.notes}
                  onChange={(event) => setNewDge((previous) => ({ ...previous, notes: event.target.value }))}
                  className="admin-input min-h-[82px]"
                  placeholder="Notiz, optional"
                  disabled={fieldsDisabled}
                />
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <label className="flex items-center gap-2 text-xs">
                    <input
                      type="checkbox"
                      checked={newDge.no_recommendation}
                      onChange={(event) => setNewDge((previous) => ({ ...previous, no_recommendation: event.target.checked }))}
                      disabled={fieldsDisabled}
                    />
                    Keine Empfehlung
                  </label>
                  <AdminButton type="submit" variant="primary" disabled={fieldsDisabled || (!newDge.title.trim() && !newDge.url.trim())}>
                    <Plus size={13} />
                    DGE-Quelle hinzufuegen
                  </AdminButton>
                </div>
              </form>
              <div className="flex flex-wrap justify-end gap-2">
                <Link to={`/administrator/ingredients/${ingredient.id}?section=research`} className="admin-btn admin-btn-sm">
                  Recherche-Detail öffnen
                </Link>
              </div>
            </div>
          )}
        </>
      )}
    </AdminDialog>
  );
}

type RecommendationSlotDraft = {
  productQuery: string;
  products: AdminCatalogProduct[];
  selectedProductId: number | null;
  selectedProductLabel: string;
  shopLinks: AdminProductShopLink[];
  selectedShopLinkId: number | null;
};

function recommendationSlotDraft(
  recommendation: AdminIngredientProductRecommendation | null,
  fallbackQuery: string,
): RecommendationSlotDraft {
  return {
    productQuery: recommendation?.product_name ?? fallbackQuery,
    products: [],
    selectedProductId: recommendation?.product_id ?? null,
    selectedProductLabel: recommendation?.product_name ?? '',
    shopLinks: [],
    selectedShopLinkId: recommendation?.shop_link_id ?? null,
  };
}

function recommendationSlotDrafts(
  slots: AdminIngredientProductRecommendationSlots,
  fallbackQuery: string,
): Record<AdminIngredientProductRecommendationSlot, RecommendationSlotDraft> {
  return Object.fromEntries(
    RECOMMENDATION_SLOTS.map((slot) => [slot, recommendationSlotDraft(slots[slot], fallbackQuery)]),
  ) as Record<AdminIngredientProductRecommendationSlot, RecommendationSlotDraft>;
}

function RecommendationModal({
  ingredient,
  onClose,
  onChanged,
}: {
  ingredient: AdminIngredientListItem;
  onClose: () => void;
  onChanged: () => Promise<void>;
}) {
  const [slots, setSlots] = useState<AdminIngredientProductRecommendationSlots>(ingredient.product_recommendations);
  const [drafts, setDrafts] = useState<Record<AdminIngredientProductRecommendationSlot, RecommendationSlotDraft>>(
    recommendationSlotDrafts(ingredient.product_recommendations, ingredient.name),
  );
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const fetchShopLinks = useCallback(async (productId: number): Promise<AdminProductShopLink[]> => {
    try {
      const response = await getAdminProductShopLinks(productId);
      return response.links;
    } catch {
      return [];
    }
  }, []);

  const updateDraft = useCallback((
    slot: AdminIngredientProductRecommendationSlot,
    patch: Partial<RecommendationSlotDraft>,
  ) => {
    setDrafts((previous) => ({
      ...previous,
      [slot]: {
        ...previous[slot],
        ...patch,
      },
    }));
  }, []);

  const loadRecommendations = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await getAdminIngredientProductRecommendations(ingredient.id);
      const nextDrafts = recommendationSlotDrafts(response.slots, ingredient.name);
      const draftsWithLinks = await Promise.all(
        RECOMMENDATION_SLOTS.map(async (slot) => {
          const draft = nextDrafts[slot];
          if (!draft.selectedProductId) return [slot, draft] as const;
          const links = await fetchShopLinks(draft.selectedProductId);
          const selectedShopLinkId = draft.selectedShopLinkId && links.some((link) => link.id === draft.selectedShopLinkId)
            ? draft.selectedShopLinkId
            : selectDefaultShopLink(links)?.id ?? null;
          return [slot, { ...draft, shopLinks: links, selectedShopLinkId }] as const;
        }),
      );
      setSlots(response.slots);
      setDrafts(Object.fromEntries(draftsWithLinks) as Record<AdminIngredientProductRecommendationSlot, RecommendationSlotDraft>);
    } catch (modalError) {
      setError(getErrorMessage(modalError));
    } finally {
      setLoading(false);
    }
  }, [fetchShopLinks, ingredient.id, ingredient.name]);

  useEffect(() => {
    void loadRecommendations();
  }, [loadRecommendations]);

  const handleSearchProducts = async (slot: AdminIngredientProductRecommendationSlot, event?: FormEvent) => {
    event?.preventDefault();
    const draft = drafts[slot];
    setSaving(true);
    setError('');
    setMessage('');
    try {
      const response = await getAdminProducts({
        q: draft.productQuery.trim() || ingredient.name,
        ingredient_id: ingredient.id,
        limit: 8,
      });
      updateDraft(slot, { products: response.products });
      if (response.products.length === 0) {
        setMessage(`Keine Produkte mit ${ingredient.name} gefunden.`);
      }
    } catch (modalError) {
      setError(getErrorMessage(modalError));
    } finally {
      setSaving(false);
    }
  };

  const selectProduct = async (slot: AdminIngredientProductRecommendationSlot, product: AdminCatalogProduct) => {
    setSaving(true);
    setError('');
    setMessage('');
    try {
      const links = await fetchShopLinks(product.id);
      updateDraft(slot, {
        productQuery: productLabel(product),
        products: [],
        selectedProductId: product.id,
        selectedProductLabel: productLabel(product),
        shopLinks: links,
        selectedShopLinkId: selectDefaultShopLink(links)?.id ?? null,
      });
    } finally {
      setSaving(false);
    }
  };

  const handleSave = async (slot: AdminIngredientProductRecommendationSlot) => {
    const draft = drafts[slot];
    if (!draft.selectedProductId) {
      setError(`Bitte zuerst ein Produkt fuer ${RECOMMENDATION_SLOT_LABELS[slot]} auswählen.`);
      return;
    }
    setSaving(true);
    setError('');
    setMessage('');
    try {
      const response = await upsertAdminIngredientProductRecommendation(ingredient.id, slot, {
        product_id: draft.selectedProductId,
        shop_link_id: draft.selectedShopLinkId,
      });
      setSlots(response.slots);
      setMessage(`${RECOMMENDATION_SLOT_LABELS[slot]} gespeichert.`);
      await onChanged();
    } catch (modalError) {
      setError(getErrorMessage(modalError));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (slot: AdminIngredientProductRecommendationSlot) => {
    if (!slots[slot]) return;
    if (!window.confirm(`${RECOMMENDATION_SLOT_LABELS[slot]} entfernen?`)) return;
    setSaving(true);
    setError('');
    setMessage('');
    try {
      const response = await deleteAdminIngredientProductRecommendation(ingredient.id, slot);
      setSlots(response.slots);
      updateDraft(slot, recommendationSlotDraft(null, ingredient.name));
      setMessage(`${RECOMMENDATION_SLOT_LABELS[slot]} entfernt.`);
      await onChanged();
    } catch (modalError) {
      setError(getErrorMessage(modalError));
    } finally {
      setSaving(false);
    }
  };

  return (
    <AdminDialog title="Empfehlungen verwalten" subtitle={ingredient.name} onClose={onClose} maxWidth="max-w-5xl">
      {error && <AdminError>{error}</AdminError>}
      {message && <p className="admin-muted text-xs">{message}</p>}
      {loading ? (
        <AdminEmpty>Lade Empfehlungen...</AdminEmpty>
      ) : (
        <div className="grid gap-4">
          <div className="rounded-[var(--admin-r-sm)] border border-[color:var(--admin-line)] bg-[color:var(--admin-bg)] p-3 text-sm">
            <span className="admin-muted">Wirkstoff</span>
            <div className="mt-1 font-medium">{ingredient.name}</div>
          </div>

          <div className="grid gap-3">
            {RECOMMENDATION_SLOTS.map((slot) => {
              const draft = drafts[slot];
              const currentRecommendation = slots[slot];
              return (
                <section key={slot} className="grid gap-3 rounded-[var(--admin-r-sm)] border border-[color:var(--admin-line)] p-3">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <h3 className="m-0 text-sm font-medium">{RECOMMENDATION_SLOT_LABELS[slot]}</h3>
                      <p className="admin-muted mt-1 text-xs">
                        {currentRecommendation
                          ? recommendationSummary(currentRecommendation)
                          : 'Noch kein Produkt gesetzt.'}
                      </p>
                    </div>
                    {currentRecommendation && (
                      <AdminButton variant="danger" size="sm" onClick={() => void handleDelete(slot)} disabled={saving}>
                        <Trash2 size={13} />
                        Entfernen
                      </AdminButton>
                    )}
                  </div>

                  <form className="grid gap-2" onSubmit={(event) => void handleSearchProducts(slot, event)}>
                    <div className="flex flex-wrap gap-2">
                      <input
                        value={draft.productQuery}
                        onChange={(event) => updateDraft(slot, { productQuery: event.target.value })}
                        className="admin-input min-w-[220px] flex-1"
                        placeholder={`${ingredient.name} Produkt suchen`}
                        disabled={saving}
                      />
                      <AdminButton type="submit" disabled={saving}>
                        <Search size={13} />
                        Suchen
                      </AdminButton>
                    </div>
                    {draft.products.length > 0 && (
                      <div className="grid gap-2">
                        {draft.products.map((product) => (
                          <button
                            key={product.id}
                            type="button"
                            className="rounded-[var(--admin-r-sm)] border border-[color:var(--admin-line)] bg-[color:var(--admin-bg)] p-3 text-left text-sm hover:border-[color:var(--admin-line-strong)]"
                            onClick={() => void selectProduct(slot, product)}
                            disabled={saving}
                          >
                            <span className="font-medium">{productLabel(product)}</span>
                            <span className="admin-muted ml-2">{product.moderation_status || 'ohne Status'}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </form>

                  <div className="grid gap-2 md:grid-cols-[minmax(0,1fr)_minmax(220px,0.7fr)_auto] md:items-end">
                    <div className="grid gap-2">
                      <label className="text-sm font-medium">Ausgewähltes Produkt</label>
                      <div className="rounded-[var(--admin-r-sm)] border border-[color:var(--admin-line)] bg-[color:var(--admin-bg)] p-3 text-sm">
                        {draft.selectedProductId ? draft.selectedProductLabel || `Produkt ${draft.selectedProductId}` : 'Noch kein Produkt ausgewählt'}
                      </div>
                    </div>

                    <div className="grid gap-2">
                      <label className="text-sm font-medium">Shoplink</label>
                      {draft.shopLinks.length > 1 ? (
                        <select
                          value={draft.selectedShopLinkId ?? ''}
                          onChange={(event) => updateDraft(slot, { selectedShopLinkId: event.target.value ? Number(event.target.value) : null })}
                          className="admin-select"
                          disabled={saving}
                        >
                          <option value="">Kein konkreter Shoplink</option>
                          {draft.shopLinks.map((link) => (
                            <option key={link.id} value={link.id}>
                              {link.shop_name || link.normalized_host || shopLinkHost(link.url)}{link.is_primary ? ' · Hauptlink' : ''}
                            </option>
                          ))}
                        </select>
                      ) : draft.shopLinks.length === 1 ? (
                        <div className="rounded-[var(--admin-r-sm)] border border-[color:var(--admin-line)] bg-[color:var(--admin-bg)] p-3 text-sm">
                          {draft.shopLinks[0].shop_name || draft.shopLinks[0].normalized_host || shopLinkHost(draft.shopLinks[0].url)}
                        </div>
                      ) : (
                        <p className="admin-muted text-sm">Kein konkreter Shoplink ausgewählt.</p>
                      )}
                    </div>

                    <AdminButton variant="primary" onClick={() => void handleSave(slot)} disabled={saving || !draft.selectedProductId}>
                      <PackageCheck size={13} />
                      Speichern
                    </AdminButton>
                  </div>
                </section>
              );
            })}
          </div>
        </div>
      )}
    </AdminDialog>
  );
}

export default function AdministratorIngredientsPage() {
  const [ingredients, setIngredients] = useState<AdminIngredientListItem[]>([]);
  const [queryInput, setQueryInput] = useState('');
  const [query, setQuery] = useState('');
  const [taskFilter, setTaskFilter] = useState<IngredientTaskFilter>('all');
  const [ingredientGroupFilter, setIngredientGroupFilter] = useState<IngredientGroupFilter>('all');
  const [ingredientGroupOptions, setIngredientGroupOptions] = useState<AdminIngredientGroupOption[]>(DEFAULT_INGREDIENT_GROUP_OPTIONS);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState<(typeof PAGE_LIMIT_OPTIONS)[number]>(50);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [taskModal, setTaskModal] = useState<{ ingredient: AdminIngredientListItem; task: AdminIngredientTaskKey } | null>(null);
  const [recommendationModal, setRecommendationModal] = useState<{ ingredient: AdminIngredientListItem } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await getAdminIngredients({
        q: query,
        task: taskFilter === 'all' ? undefined : taskFilter,
        ingredient_group: ingredientGroupFilter === 'all' ? undefined : ingredientGroupFilter,
        page,
        limit,
      });
      setIngredients(response.ingredients);
      setTotal(response.total);
      const responseGroups = response.summary?.groups ?? [];
      if (responseGroups.length > 0) {
        const merged = [
          { value: 'all', label: 'Alle Gruppen', count: response.summary?.total ?? response.total },
          ...responseGroups,
        ];
        const values = new Set(merged.map((group) => group.value));
        const withDefaults = [
          ...merged,
          ...DEFAULT_INGREDIENT_GROUP_OPTIONS.filter((group) => !values.has(group.value)),
        ];
        setIngredientGroupOptions(withDefaults);
      }
    } catch (loadError) {
      setIngredients([]);
      setTotal(0);
      setError(getErrorMessage(loadError));
    } finally {
      setLoading(false);
    }
  }, [ingredientGroupFilter, limit, page, query, taskFilter]);

  useEffect(() => {
    void load();
  }, [load]);

  const totalPages = Math.max(1, Math.ceil(total / limit));
  const canLoadPrevious = page > 1;
  const canLoadNext = page < totalPages;
  const rangeStart = total === 0 ? 0 : (page - 1) * limit + 1;
  const rangeEnd = Math.min(total, (page - 1) * limit + ingredients.length);

  useEffect(() => {
    if (!loading && page > totalPages) {
      setPage(totalPages);
    }
  }, [loading, page, totalPages]);

  const applyQuery = useCallback(() => {
    setPage(1);
    setQuery(queryInput);
  }, [queryInput]);

  return (
    <>
      <AdminPageHeader
        title="Wirkstoffe"
        subtitle="Wirkstoffe prüfen, ergänzen und verknüpfen."
        meta={(
          <div className="flex flex-wrap gap-2">
            <AdminBadge tone="info">
              <ListChecks size={12} />
              {rangeStart}-{rangeEnd} von {total}
            </AdminBadge>
          </div>
        )}
      />

      <div className="mb-4 grid gap-2">
        <div className="admin-filter-bar">
          <div className="admin-filter-main">
            <label className="admin-filter-search-with-icon relative flex-1">
              <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[color:var(--admin-ink-3)]" />
              <input
                value={queryInput}
                onChange={(event) => setQueryInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') applyQuery();
                }}
                placeholder="Wirkstoff suchen"
                className="admin-input admin-filter-search"
              />
            </label>
          </div>
          <div className="admin-filter-controls">
            <select
              value={ingredientGroupFilter}
              onChange={(event) => {
                setPage(1);
                setIngredientGroupFilter(event.target.value);
              }}
              className="admin-select w-[210px]"
              aria-label="Wirkstoffgruppe filtern"
            >
              {ingredientGroupOptions.map((entry) => (
                <option key={entry.value} value={entry.value}>
                  {entry.label}{entry.count > 0 ? ` (${entry.count})` : ''}
                </option>
              ))}
            </select>
            <select
              value={taskFilter}
              onChange={(event) => {
                setPage(1);
                setTaskFilter(event.target.value as IngredientTaskFilter);
              }}
              className="admin-select w-[230px]"
              aria-label="Bearbeitungsstand filtern"
            >
              {TASK_FILTERS.map((entry) => (
                <option key={entry.value} value={entry.value}>{entry.label}</option>
              ))}
            </select>
          </div>
          <div className="admin-filter-actions">
            <AdminButton onClick={applyQuery}>
              <Search size={13} />
              Suchen
            </AdminButton>
            <AdminButton onClick={() => void load()} disabled={loading}>
              <RefreshCw size={14} />
              Aktualisieren
            </AdminButton>
            <Link to="/administrator/dosing" className="admin-btn admin-btn-primary">
              Richtwerte
            </Link>
          </div>
        </div>

        <div className="admin-filter-bar admin-filter-bar-flat">
          <div className="admin-filter-main">
            <span className="admin-muted text-sm">
              Seite {page} / {totalPages}
            </span>
          </div>
          <div className="admin-filter-actions">
          <select
            value={limit}
            onChange={(event) => {
              setPage(1);
              setLimit(Number(event.target.value) as (typeof PAGE_LIMIT_OPTIONS)[number]);
            }}
            className="admin-select w-[140px]"
            aria-label="Einträge pro Seite"
          >
            {PAGE_LIMIT_OPTIONS.map((entry) => (
              <option key={entry} value={entry}>
                {entry} / Seite
              </option>
            ))}
          </select>
          <AdminButton onClick={() => setPage((current) => Math.max(1, current - 1))} disabled={!canLoadPrevious || loading}>
            <ChevronLeft size={13} />
            Zurück
          </AdminButton>
          <AdminButton onClick={() => setPage((current) => current + 1)} disabled={!canLoadNext || loading}>
            Weiter
            <ChevronRight size={13} />
          </AdminButton>
          </div>
        </div>
      </div>

      {error && <AdminError>{error}</AdminError>}

      {loading ? (
        <AdminEmpty>Lade Wirkstoffe...</AdminEmpty>
      ) : ingredients.length === 0 ? (
        <AdminEmpty>Keine Wirkstoffe gefunden.</AdminEmpty>
      ) : (
        <AdminCard title="Wirkstoff-Katalog">
          <div className="admin-table-wrap">
            <table className="admin-table admin-compact-table">
              <thead>
                <tr>
                  <th>Wirkstoff</th>
                  <th>Bearbeitungsstand</th>
                  <th>Empfehlung</th>
                </tr>
              </thead>
              <tbody>
                {ingredients.map((ingredient) => (
                  <tr key={ingredient.id}>
                    <td>
                      <Link
                        to={`/administrator/ingredients/${ingredient.id}`}
                        className="font-medium text-[color:var(--admin-ink)] underline-offset-4 hover:underline"
                        style={{ fontFamily: 'var(--admin-serif)' }}
                      >
                        {ingredient.name}
                      </Link>
                    </td>
                    <td>
                      <IngredientProgressBadges
                        ingredient={ingredient}
                        onOpenTask={(selectedIngredient, selectedTask) => setTaskModal({ ingredient: selectedIngredient, task: selectedTask })}
                      />
                    </td>
                    <td>
                      <RecommendationSlots
                        ingredient={ingredient}
                        onOpen={(selectedIngredient) => setRecommendationModal({ ingredient: selectedIngredient })}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </AdminCard>
      )}

      {taskModal && (
        <TaskModal
          ingredient={taskModal.ingredient}
          task={taskModal.task}
          onClose={() => setTaskModal(null)}
          onChanged={load}
        />
      )}

      {recommendationModal && (
        <RecommendationModal
          ingredient={recommendationModal.ingredient}
          onClose={() => setRecommendationModal(null)}
          onChanged={load}
        />
      )}
    </>
  );
}
