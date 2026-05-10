import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AxiosError } from 'axios';
import { Link, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Languages, Loader2, RefreshCw, Save, Search, XCircle } from 'lucide-react';
import { apiClient } from '../../api/client';
import { AdminBadge, AdminButton, AdminCard, AdminEmpty, AdminError, AdminPageHeader } from './AdminUi';

type AdminEntity = 'ingredients' | 'dose-recommendations' | 'blog-posts';
type TranslationStatus = 'missing' | 'translated';
type TranslationFilter = 'all' | 'missing' | 'translated';

interface EntityConfig {
  label: string;
  endpoint: string;
  searchPlaceholder: string;
  emptyLabel: string;
}

interface IngredientTranslationRow {
  ingredient_id: number;
  source_name: string;
  source_description: string | null;
  language: string;
  name: string | null;
  description: string | null;
  hypo_symptoms: string | null;
  hyper_symptoms: string | null;
  status: TranslationStatus;
}

interface DoseRecommendationTranslationRow {
  dose_recommendation_id: number;
  ingredient_name: string;
  source_type: string;
  base_source_label: string;
  base_timing: string | null;
  base_context_note: string | null;
  dose_min: number | null;
  dose_max: number | null;
  unit: string;
  per_kg_body_weight: number | null;
  per_kg_cap: number | null;
  language: string;
  source_label: string | null;
  timing: string | null;
  context_note: string | null;
  status: TranslationStatus;
}

interface VerifiedProfileTranslationRow {
  verified_profile_id: number;
  base_name: string;
  base_slug: string;
  base_credentials: string | null;
  language: string;
  credentials: string | null;
  bio: string | null;
  status: TranslationStatus;
}

interface BlogTranslationRow {
  blog_post_id: number;
  r2_key: string;
  post_status: string;
  published_at: number | null;
  language: string;
  title: string | null;
  slug: string | null;
  excerpt: string | null;
  meta_description: string | null;
  status: TranslationStatus;
}

type TranslationRow =
  | IngredientTranslationRow
  | DoseRecommendationTranslationRow
  | VerifiedProfileTranslationRow
  | BlogTranslationRow;

interface IngredientDraft {
  name: string;
  description: string;
  hypo_symptoms: string;
  hyper_symptoms: string;
}

interface DoseRecommendationDraft {
  source_label: string;
  timing: string;
  context_note: string;
}

interface VerifiedProfileDraft {
  credentials: string;
  bio: string;
}

interface BlogDraft {
  title: string;
  slug: string;
  excerpt: string;
  meta_description: string;
}

type TranslationDraft = IngredientDraft | DoseRecommendationDraft | VerifiedProfileDraft | BlogDraft;

interface SavedIngredientTranslation {
  ingredient_id: number;
  language: string;
  name: string;
  description: string | null;
  hypo_symptoms: string | null;
  hyper_symptoms: string | null;
}

interface SavedDoseRecommendationTranslation {
  dose_recommendation_id: number;
  language: string;
  source_label: string | null;
  timing: string | null;
  context_note: string | null;
}

interface SavedVerifiedProfileTranslation {
  verified_profile_id: number;
  language: string;
  credentials: string | null;
  bio: string | null;
}

interface SavedBlogTranslation {
  blog_post_id: number;
  language: string;
  title: string;
  slug: string;
  excerpt: string | null;
  meta_description: string | null;
}

const DEFAULT_PAGE_LIMIT = 25;

const LANGUAGE_OPTIONS = [
  { value: 'en', label: 'Englisch' },
  { value: 'fr', label: 'Franz\u00f6sisch' },
  { value: 'es', label: 'Spanisch' },
];

const ENTITY_CONFIG: Record<AdminEntity, EntityConfig> = {
  ingredients: {
    label: 'Wirkstoffe',
    endpoint: '/admin/translations/ingredients',
    searchPlaceholder: 'Wirkstoff oder \u00dcbersetzung suchen',
    emptyLabel: 'Keine Wirkstoffe f\u00fcr diese Suche gefunden.',
  },
  'dose-recommendations': {
    label: 'Dosierungen',
    endpoint: '/admin/translations/dose-recommendations',
    searchPlaceholder: 'Wirkstoff, Quelle oder Hinweis suchen',
    emptyLabel: 'Keine Dosierungen f\u00fcr diese Suche gefunden.',
  },
  'blog-posts': {
    label: 'Blogartikel',
    endpoint: '/admin/translations/blog-posts',
    searchPlaceholder: 'Titel, Slug oder Kurztext suchen',
    emptyLabel: 'Keine Blogartikel f\u00fcr diese Suche gefunden.',
  },
};

const LOAD_FILTER_OPTIONS: Array<{ value: TranslationFilter; label: string }> = [
  { value: 'all', label: 'Alle' },
  { value: 'missing', label: 'Fehlt noch' },
  { value: 'translated', label: 'Vorhanden' },
];

function isAdminEntity(value: string | null): value is AdminEntity {
  return value !== null && Object.prototype.hasOwnProperty.call(ENTITY_CONFIG, value);
}

function isTranslationFilter(value: string | null): value is TranslationFilter {
  return value === 'all' || value === 'missing' || value === 'translated';
}

function translationStatusLabel(status: TranslationStatus): string {
  return status === 'translated' ? 'Vorhanden' : 'Fehlt noch';
}

function parseInitialPage(value: string | null): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : 1;
}

function internalAdministratorReturnTo(value: string | null): string {
  const trimmed = value?.trim() ?? '';
  return trimmed.startsWith('/administrator/') ? trimmed : '';
}

function normalizeLanguage(value: string): string {
  return value.trim().toLowerCase().replace(/_/g, '-');
}

function normalizeTargetLanguage(value: string | null): string {
  const normalized = normalizeLanguage(value || 'en');
  return LANGUAGE_OPTIONS.some((option) => option.value === normalized) ? normalized : 'en';
}

function rowKey(entity: AdminEntity, row: TranslationRow): string {
  const language = normalizeTargetLanguage(row.language || 'en');
  if ('ingredient_id' in row) return `${entity}:${row.ingredient_id}:${language}`;
  if ('dose_recommendation_id' in row) return `${entity}:${row.dose_recommendation_id}:${language}`;
  if ('verified_profile_id' in row) return `${entity}:${row.verified_profile_id}:${language}`;
  return `${entity}:${row.blog_post_id}:${language}`;
}

function toDraft(row: TranslationRow): TranslationDraft {
  if ('ingredient_id' in row) {
    return {
      name: row.name ?? '',
      description: row.description ?? '',
      hypo_symptoms: row.hypo_symptoms ?? '',
      hyper_symptoms: row.hyper_symptoms ?? '',
    };
  }
  if ('dose_recommendation_id' in row) {
    return {
      source_label: row.source_label ?? '',
      timing: row.timing ?? '',
      context_note: row.context_note ?? '',
    };
  }
  if ('verified_profile_id' in row) {
    return {
      credentials: row.credentials ?? '',
      bio: row.bio ?? '',
    };
  }
  return {
    title: row.title ?? '',
    slug: row.slug ?? '',
    excerpt: row.excerpt ?? '',
    meta_description: row.meta_description ?? '',
  };
}

function getErrorMessage(error: unknown): string {
  if (error instanceof AxiosError) {
    const data = error.response?.data;
    if (data && typeof data === 'object' && 'error' in data && typeof data.error === 'string') return data.error;
    if (typeof error.response?.status === 'number') return `Anfrage fehlgeschlagen (Status ${error.response.status}).`;
    return error.message;
  }
  if (error instanceof Error) return error.message;
  return 'Die Anfrage ist fehlgeschlagen.';
}

function isReadOnlyError(error: unknown): boolean {
  if (!(error instanceof AxiosError)) return false;
  return [404, 405, 501].includes(error.response?.status ?? 0);
}

function isMissingReadOnlyMessage(): string {
  return '\u00dcbersetzungen k\u00f6nnen in dieser Umgebung gerade nicht gespeichert werden.';
}

function formatDose(row: DoseRecommendationTranslationRow): string {
  const numberText = (value: number) => new Intl.NumberFormat('de-DE', { maximumFractionDigits: 6 }).format(value);
  const min = row.dose_min !== null ? `${numberText(row.dose_min)}-` : '';
  const perKg = row.per_kg_body_weight !== null ? `, ${numberText(row.per_kg_body_weight)} ${row.unit}/kg` : '';
  const cap = row.per_kg_cap !== null ? `, Obergrenze ${numberText(row.per_kg_cap)} ${row.unit}` : '';
  return `${min}${row.dose_max !== null ? numberText(row.dose_max) : ''} ${row.unit}${perKg}${cap}`;
}

function formatTimestamp(value: number | null): string {
  if (value === null) return 'unver\u00f6ffentlicht';
  return new Date(value * 1000).toLocaleDateString('de-DE');
}

export default function AdministratorTranslationsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [entity, setEntity] = useState<AdminEntity>(() => {
    const value = searchParams.get('entity');
    return isAdminEntity(value) ? value : 'ingredients';
  });
  const [language, setLanguage] = useState(() => normalizeTargetLanguage(searchParams.get('language')));
  const [query, setQuery] = useState(() => searchParams.get('q') ?? '');
  const [statusFilter, setStatusFilter] = useState<TranslationFilter>(() => {
    const value = searchParams.get('status');
    return isTranslationFilter(value) ? value : 'all';
  });
  const [page, setPage] = useState(() => parseInitialPage(searchParams.get('page')));
  const [focusKey] = useState(() => searchParams.get('focus')?.trim() ?? '');
  const [returnTo] = useState(() => internalAdministratorReturnTo(searchParams.get('returnTo')));
  const [rows, setRows] = useState<TranslationRow[]>([]);
  const [drafts, setDrafts] = useState<Record<string, TranslationDraft>>({});
  const [total, setTotal] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [savedKey, setSavedKey] = useState<string | null>(null);
  const [limit, setLimit] = useState(DEFAULT_PAGE_LIMIT);
  const [readOnlyMessage, setReadOnlyMessage] = useState('');
  const loadRequestIdRef = useRef(0);
  const abortControllerRef = useRef<AbortController | null>(null);

  const config = ENTITY_CONFIG[entity];
  const normalizedLanguage = useMemo(() => normalizeTargetLanguage(language), [language]);
  const visibleRows = useMemo(() => {
    if (statusFilter === 'all') return rows;
    return rows.filter((row) => row.status === statusFilter);
  }, [rows, statusFilter]);

  const totalPages = total != null ? Math.max(1, Math.ceil(total / limit)) : null;
  const hasPrevious = page > 1;
  const hasNext = totalPages != null ? page < totalPages : rows.length === limit;
  const focusLoaded = useMemo(() => rows.some((row) => rowKey(entity, row) === focusKey), [entity, focusKey, rows]);

  useEffect(() => {
    const nextParams = new URLSearchParams({
      entity,
      language: normalizedLanguage,
      status: statusFilter,
      page: String(page),
    });
    const trimmedQuery = query.trim();
    if (trimmedQuery) nextParams.set('q', trimmedQuery);
    if (focusKey) nextParams.set('focus', focusKey);
    if (returnTo) nextParams.set('returnTo', returnTo);

    setSearchParams((current) => {
      if (current.toString() === nextParams.toString()) return current;
      return nextParams;
    }, { replace: true });
  }, [entity, focusKey, normalizedLanguage, page, query, returnTo, setSearchParams, statusFilter]);

  const loadTranslations = useCallback(async () => {
    const requestId = ++loadRequestIdRef.current;
    abortControllerRef.current?.abort();
    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    setLoading(true);
    setError('');
    setReadOnlyMessage('');
    setSavedKey(null);

    try {
      const response = await apiClient.get<{ translations: TranslationRow[]; total?: number; count?: number; limit?: number }>(
        config.endpoint,
        {
          params: {
            language: normalizedLanguage,
            q: query.trim(),
            limit,
            offset: (page - 1) * limit,
          },
          signal: abortController.signal,
        },
      );

      if (requestId !== loadRequestIdRef.current || abortController.signal.aborted) return;
      const nextRows = Array.isArray(response.data.translations) ? response.data.translations : [];
      setRows(nextRows);
      setTotal(typeof response.data.total === 'number' ? response.data.total : typeof response.data.count === 'number' ? response.data.count : null);
      if (typeof response.data.limit === 'number' && response.data.limit > 0) setLimit(response.data.limit);
      setDrafts((previous) => {
        const next = { ...previous };
        for (const row of nextRows) {
          const key = rowKey(entity, row);
          if (!next[key]) next[key] = toDraft(row);
        }
        return next;
      });
    } catch (err) {
      if (requestId !== loadRequestIdRef.current) return;
      if (err instanceof AxiosError && err.code === 'ERR_CANCELED') return;
      if (isReadOnlyError(err)) {
        const message = isMissingReadOnlyMessage();
        setReadOnlyMessage(message);
        setError(message);
      } else {
        setError(getErrorMessage(err));
      }
      setRows([]);
      setTotal(null);
    } finally {
      if (requestId === loadRequestIdRef.current) setLoading(false);
    }
  }, [config.endpoint, entity, limit, normalizedLanguage, page, query]);

  useEffect(() => {
    void loadTranslations();
  }, [loadTranslations]);

  useEffect(() => {
    return () => {
      loadRequestIdRef.current += 1;
      abortControllerRef.current?.abort();
    };
  }, []);

  const updateDraft = (key: string, field: string, value: string) => {
    setDrafts((previous) => ({
      ...previous,
      [key]: { ...(previous[key] ?? {}), [field]: value } as TranslationDraft,
    }));
    setSavedKey(null);
  };

  const saveTranslation = async (row: TranslationRow) => {
    const key = rowKey(entity, row);
    const draft = drafts[key] ?? toDraft(row);
    setSavingKey(key);
    setError('');
    setSavedKey(null);

    if (readOnlyMessage) {
      setError(readOnlyMessage);
      setSavingKey(null);
      return;
    }

    try {
      if ('ingredient_id' in row) {
        const local = draft as IngredientDraft;
        const payload = {
          name: local.name.trim(),
          description: local.description.trim() || null,
          hypo_symptoms: local.hypo_symptoms.trim() || null,
          hyper_symptoms: local.hyper_symptoms.trim() || null,
        };
        if (!payload.name) throw new Error('Der übersetzte Name ist erforderlich.');
        const response = await apiClient.put<{ translation: SavedIngredientTranslation }>(
          `${config.endpoint}/${row.ingredient_id}/${normalizedLanguage}`,
          payload,
        );
        const translation = response.data.translation;
        setRows((previous) =>
          previous.map((item) => ('ingredient_id' in item && item.ingredient_id === row.ingredient_id ? { ...item, ...translation, status: 'translated' } : item)),
        );
        setDrafts((previous) => ({
          ...previous,
          [key]: {
            name: translation.name,
            description: translation.description ?? '',
            hypo_symptoms: translation.hypo_symptoms ?? '',
            hyper_symptoms: translation.hyper_symptoms ?? '',
          },
        }));
      } else if ('dose_recommendation_id' in row) {
        const local = draft as DoseRecommendationDraft;
        const payload = {
          source_label: local.source_label.trim() || null,
          timing: local.timing.trim() || null,
          context_note: local.context_note.trim() || null,
        };
        const response = await apiClient.put<{ translation: SavedDoseRecommendationTranslation }>(
          `${config.endpoint}/${row.dose_recommendation_id}/${normalizedLanguage}`,
          payload,
        );
        const translation = response.data.translation;
        setRows((previous) =>
          previous.map((item) =>
            'dose_recommendation_id' in item && item.dose_recommendation_id === row.dose_recommendation_id
              ? { ...item, ...translation, status: 'translated' }
              : item,
          ),
        );
        setDrafts((previous) => ({
          ...previous,
          [key]: {
            source_label: translation.source_label ?? '',
            timing: translation.timing ?? '',
            context_note: translation.context_note ?? '',
          },
        }));
      } else if ('verified_profile_id' in row) {
        const local = draft as VerifiedProfileDraft;
        const response = await apiClient.put<{ translation: SavedVerifiedProfileTranslation }>(
          `${config.endpoint}/${row.verified_profile_id}/${normalizedLanguage}`,
          {
            credentials: local.credentials.trim() || null,
            bio: local.bio.trim() || null,
          },
        );
        const translation = response.data.translation;
        setRows((previous) =>
          previous.map((item) =>
            'verified_profile_id' in item && item.verified_profile_id === row.verified_profile_id
              ? { ...item, ...translation, status: 'translated' }
              : item,
          ),
        );
        setDrafts((previous) => ({
          ...previous,
          [key]: {
            credentials: translation.credentials ?? '',
            bio: translation.bio ?? '',
          },
        }));
      } else {
        const local = draft as BlogDraft;
        const payload = {
          title: local.title.trim(),
          slug: local.slug.trim().toLowerCase(),
          excerpt: local.excerpt.trim() || null,
          meta_description: local.meta_description.trim() || null,
        };
        if (!payload.title) throw new Error('Der übersetzte Titel ist erforderlich.');
        if (!payload.slug) throw new Error('Der übersetzte Slug ist erforderlich.');
        const response = await apiClient.put<{ translation: SavedBlogTranslation }>(
          `${config.endpoint}/${row.blog_post_id}/${normalizedLanguage}`,
          payload,
        );
        const translation = response.data.translation;
        setRows((previous) =>
          previous.map((item) => ('blog_post_id' in item && item.blog_post_id === row.blog_post_id ? { ...item, ...translation, status: 'translated' } : item)),
        );
        setDrafts((previous) => ({
          ...previous,
          [key]: {
            title: translation.title,
            slug: translation.slug,
            excerpt: translation.excerpt ?? '',
            meta_description: translation.meta_description ?? '',
          },
        }));
      }
      setSavedKey(key);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSavingKey(null);
    }
  };

  const renderSource = (row: TranslationRow) => {
    if ('ingredient_id' in row) {
      return (
        <div className="admin-empty mt-2 space-y-1">
          <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[color:var(--admin-ink-3)]">Original</p>
          <p className="admin-muted"><span className="font-medium text-[color:var(--admin-ink-2)]">Name:</span> {row.source_name}</p>
          <p className="admin-muted"><span className="font-medium text-[color:var(--admin-ink-2)]">Beschreibung:</span> {row.source_description || 'Keine Beschreibung vorhanden.'}</p>
          <p className="admin-muted"><span className="font-medium text-[color:var(--admin-ink-2)]">Mangel-Symptome:</span> aus dem deutschen Basisdatensatz, wenn vorhanden.</p>
          <p className="admin-muted"><span className="font-medium text-[color:var(--admin-ink-2)]">Überschuss-Symptome:</span> aus dem deutschen Basisdatensatz, wenn vorhanden.</p>
        </div>
      );
    }
    if ('dose_recommendation_id' in row) {
      return (
        <div className="admin-empty mt-2 space-y-1">
          <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[color:var(--admin-ink-3)]">Original</p>
          <p className="admin-muted"><span className="font-medium text-[color:var(--admin-ink-2)]">Wirkstoff:</span> {row.ingredient_name}</p>
          <p className="admin-muted"><span className="font-medium text-[color:var(--admin-ink-2)]">Quellentyp:</span> {row.source_type}</p>
          <p className="admin-muted"><span className="font-medium text-[color:var(--admin-ink-2)]">Quellenbezeichnung:</span> {row.base_source_label || 'nicht gesetzt'}</p>
          <p className="admin-muted"><span className="font-medium text-[color:var(--admin-ink-2)]">Dosierung:</span> {formatDose(row)}</p>
          {row.base_timing ? <p className="admin-muted"><span className="font-medium text-[color:var(--admin-ink-2)]">Einnahmezeitpunkt:</span> {row.base_timing}</p> : null}
          {row.base_context_note ? <p className="admin-muted"><span className="font-medium text-[color:var(--admin-ink-2)]">Hinweis:</span> {row.base_context_note}</p> : null}
        </div>
      );
    }
    if ('verified_profile_id' in row) {
      return (
        <div className="admin-empty mt-2">
          <p className="admin-muted">{row.base_name}</p>
          <p className="admin-muted">Slug: {row.base_slug}</p>
          <p className="admin-muted">Originale Qualifikation: {row.base_credentials || '-'}</p>
        </div>
      );
    }
    return (
      <div className="admin-empty mt-2 space-y-1">
        <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[color:var(--admin-ink-3)]">Original</p>
        <p className="admin-muted"><span className="font-medium text-[color:var(--admin-ink-2)]">Artikel-Schluessel:</span> {row.r2_key}</p>
        <p className="admin-muted"><span className="font-medium text-[color:var(--admin-ink-2)]">Status:</span> {row.post_status}</p>
        <p className="admin-muted">Veröffentlicht: {formatTimestamp(row.published_at)}</p>
      </div>
    );
  };

  const renderEditor = (row: TranslationRow) => {
    const key = rowKey(entity, row);
    const draft = drafts[key] ?? toDraft(row);

    if ('ingredient_id' in row) {
      const local = draft as IngredientDraft;
      return (
        <div className="admin-card-pad mt-3">
          <div className="grid gap-2 md:grid-cols-2">
            <label className="text-xs font-medium">
              Übersetzter Name
              <input value={local.name} onChange={(event) => updateDraft(key, 'name', event.target.value)} className="admin-input mt-1" required />
            </label>
            <label className="text-xs font-medium">
              Übersetzte Beschreibung
              <textarea value={local.description} onChange={(event) => updateDraft(key, 'description', event.target.value)} className="admin-input mt-1 min-h-[96px]" rows={3} />
            </label>
            <label className="text-xs font-medium">
              Mangel-Symptome
              <textarea value={local.hypo_symptoms} onChange={(event) => updateDraft(key, 'hypo_symptoms', event.target.value)} className="admin-input mt-1 min-h-[96px]" rows={3} />
            </label>
            <label className="text-xs font-medium">
              Überschuss-Symptome
              <textarea value={local.hyper_symptoms} onChange={(event) => updateDraft(key, 'hyper_symptoms', event.target.value)} className="admin-input mt-1 min-h-[96px]" rows={3} />
            </label>
          </div>
        </div>
      );
    }

    if ('dose_recommendation_id' in row) {
      const local = draft as DoseRecommendationDraft;
      return (
        <div className="admin-card-pad mt-3">
          <div className="grid gap-2 md:grid-cols-3">
            <label className="text-xs font-medium">
              Quellenbezeichnung
              <input value={local.source_label} onChange={(event) => updateDraft(key, 'source_label', event.target.value)} className="admin-input mt-1" />
            </label>
            <label className="text-xs font-medium">
              Einnahmezeitpunkt
              <input value={local.timing} onChange={(event) => updateDraft(key, 'timing', event.target.value)} className="admin-input mt-1" />
            </label>
            <label className="text-xs font-medium">
              Hinweis
              <textarea value={local.context_note} onChange={(event) => updateDraft(key, 'context_note', event.target.value)} className="admin-input mt-1 min-h-[96px]" rows={3} />
            </label>
          </div>
        </div>
      );
    }

    if ('verified_profile_id' in row) {
      const local = draft as VerifiedProfileDraft;
      return (
        <div className="admin-card-pad mt-3">
          <div className="grid gap-2 md:grid-cols-2">
            <label className="text-xs font-medium">
              Qualifikation
              <input value={local.credentials} onChange={(event) => updateDraft(key, 'credentials', event.target.value)} className="admin-input mt-1" />
            </label>
            <label className="text-xs font-medium">
              Biografie
              <textarea value={local.bio} onChange={(event) => updateDraft(key, 'bio', event.target.value)} className="admin-input mt-1 min-h-[120px]" rows={4} />
            </label>
          </div>
        </div>
      );
    }

    const local = draft as BlogDraft;
    return (
      <div className="admin-card-pad mt-3">
        <div className="grid gap-2 md:grid-cols-2">
          <label className="text-xs font-medium">
            Titel
            <input value={local.title} onChange={(event) => updateDraft(key, 'title', event.target.value)} className="admin-input mt-1" required />
          </label>
          <label className="text-xs font-medium">
            Slug
            <input value={local.slug} onChange={(event) => updateDraft(key, 'slug', event.target.value)} className="admin-input mt-1" required />
          </label>
          <label className="text-xs font-medium">
            Kurztext
            <textarea value={local.excerpt} onChange={(event) => updateDraft(key, 'excerpt', event.target.value)} className="admin-input mt-1 min-h-[80px]" rows={3} />
          </label>
          <label className="text-xs font-medium">
            Meta-Beschreibung
            <textarea value={local.meta_description} onChange={(event) => updateDraft(key, 'meta_description', event.target.value)} className="admin-input mt-1 min-h-[80px]" rows={3} />
          </label>
        </div>
      </div>
    );
  };

  return (
    <>
      <AdminPageHeader
        title="Übersetzungen"
        subtitle="Übersetzungen prüfen und fehlende Texte ergänzen."
        meta={
          <div className="flex flex-wrap items-center gap-2">
            <AdminBadge tone={readOnlyMessage ? 'warn' : 'info'}>{rows.length} Zeilen</AdminBadge>
            {focusKey ? <AdminBadge tone={focusLoaded ? 'ok' : 'neutral'}>{focusLoaded ? 'Eintrag geladen' : 'Eintrag nicht auf dieser Seite'}</AdminBadge> : null}
          </div>
        }
      />

      {returnTo ? (
        <div className="mb-4">
          <Link to={returnTo} className="admin-btn admin-btn-ghost">
            <ArrowLeft size={14} />
            Zurück zum Ausgangsdatensatz
          </Link>
        </div>
      ) : null}

      <div className="admin-filter-bar mb-3">
        <div className="admin-filter-main">
          <label className="flex min-h-[38px] min-w-[220px] flex-1 items-center gap-2 rounded-[var(--admin-r-sm)] border border-[color:var(--admin-line)] bg-[color:var(--admin-bg)] px-3">
            <Search size={16} className="admin-muted" />
            <input
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setPage(1);
              }}
              placeholder={config.searchPlaceholder}
              className="min-w-0 flex-1 bg-transparent text-[13px] outline-none"
            />
          </label>
        </div>
        <div className="admin-filter-controls">
          <select
            value={language}
            onChange={(event) => {
              setLanguage(normalizeTargetLanguage(event.target.value));
              setPage(1);
            }}
            className="admin-select"
          >
            {LANGUAGE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label} ({option.value})
              </option>
            ))}
          </select>
          <select
            value={statusFilter}
            onChange={(event) => {
              setStatusFilter(event.target.value as TranslationFilter);
              setPage(1);
            }}
            className="admin-select"
          >
            {LOAD_FILTER_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <AdminButton onClick={() => void loadTranslations()} disabled={loading}>
            <RefreshCw size={14} />
            Laden
          </AdminButton>
        </div>
      </div>

      <div className="admin-filter-bar admin-filter-bar-flat mb-4">
        <div className="admin-filter-controls">
          {(Object.keys(ENTITY_CONFIG) as AdminEntity[]).map((key) => (
            <AdminButton
              key={key}
              variant={entity === key ? 'primary' : 'default'}
              onClick={() => {
                setEntity(key);
                setPage(1);
              }}
            >
              <Languages size={13} />
              {ENTITY_CONFIG[key].label}
            </AdminButton>
          ))}
        </div>
      </div>

      <AdminCard
        title={config.label}
        subtitle={`${total != null ? `${total} Treffer` : 'Einträge'} für ${normalizedLanguage}${totalPages != null && totalPages > 1 ? `, Seite ${page} von ${totalPages}` : ''}`}
        className="admin-compact-card"
      >
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3 text-sm">
          <p className="admin-muted">
            Sprache {normalizedLanguage} {query ? ` / Suche: ${query}` : ''}
          </p>
          <div className="flex items-center gap-2">
            <AdminButton size="sm" onClick={() => setPage((current) => Math.max(1, current - 1))} disabled={!hasPrevious || loading}>
              Zurück
            </AdminButton>
            <AdminButton size="sm" onClick={() => setPage((current) => current + 1)} disabled={!hasNext || loading}>
              Weiter
            </AdminButton>
          </div>
        </div>

        {error ? (
          <AdminError>
            <XCircle size={14} />
            {error}
          </AdminError>
        ) : null}

        {readOnlyMessage ? (
          <AdminError>
            <div className="flex items-center gap-2">
              <XCircle size={14} />
              {readOnlyMessage}
            </div>
            <div className="mt-2">
              Bitte später erneut versuchen.
            </div>
          </AdminError>
        ) : null}

        {loading ? (
          <AdminEmpty>
            <Loader2 size={16} className="mr-2 inline animate-spin" />
            Lade...
          </AdminEmpty>
        ) : visibleRows.length === 0 ? (
          <AdminEmpty>{config.emptyLabel}</AdminEmpty>
        ) : (
          <div className="space-y-3">
            {visibleRows.map((row) => {
              const key = rowKey(entity, row);
              const isFocused = key === focusKey;
              const isSaving = savingKey === key;
              const title =
                ('ingredient_id' in row && row.source_name) ||
                ('dose_recommendation_id' in row && row.ingredient_name) ||
                ('verified_profile_id' in row && row.base_name) ||
                ('blog_post_id' in row && row.r2_key) ||
                'Zeile';

              return (
                <article
                  key={key}
                  className="admin-compact-card admin-card p-3"
                  style={
                    isFocused
                      ? {
                          borderColor: 'var(--admin-info)',
                          boxShadow: '0 0 0 3px var(--admin-info-soft)',
                        }
                      : undefined
                  }
                >
                  <div className="admin-card-head">
                    <div>
                      <div className="admin-card-title">{title}</div>
                      <p className="admin-card-sub">ID {key}</p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      {isFocused ? <AdminBadge tone="info">Fokus</AdminBadge> : null}
                      <AdminBadge tone={row.status === 'missing' ? 'warn' : 'ok'}>{translationStatusLabel(row.status)}</AdminBadge>
                      {savedKey === key ? <AdminBadge tone="ok">Gespeichert</AdminBadge> : null}
                      <AdminButton size="sm" onClick={() => void saveTranslation(row)} disabled={isSaving || !!readOnlyMessage}>
                        {isSaving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                        Speichern
                      </AdminButton>
                    </div>
                  </div>
                  {renderSource(row)}
                  {renderEditor(row)}
                </article>
              );
            })}
          </div>
        )}
      </AdminCard>
    </>
  );
}
