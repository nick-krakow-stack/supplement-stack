import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { CheckCircle, Languages, Loader2, Save, Search, XCircle } from 'lucide-react';
import { apiClient } from '../../api/client';

type EntityKey = 'ingredients' | 'dose-recommendations' | 'verified-profiles' | 'blog-posts';
type TranslationStatus = 'missing' | 'translated';

interface EntityConfig {
  label: string;
  heading: string;
  endpoint: string;
  searchPlaceholder: string;
  emptyLabel: string;
}

interface IngredientTranslationRow {
  ingredient_id: number;
  source_name: string;
  source_description: string | null;
  source_hypo_symptoms: string | null;
  source_hyper_symptoms: string | null;
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
  population_slug: string | null;
  purpose: string;
  sex_filter: string | null;
  is_athlete: number;
  is_active: number;
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
  base_bio: string | null;
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
  { value: 'de', label: 'Deutsch' },
  { value: 'en', label: 'English' },
  { value: 'fr', label: 'FranÃ§ais' },
  { value: 'es', label: 'EspaÃ±ol' },
];

const ENTITY_CONFIG: Record<EntityKey, EntityConfig> = {
  ingredients: {
    label: 'Ingredients',
    heading: 'Ingredient-Translations',
    endpoint: '/admin/translations/ingredients',
    searchPlaceholder: 'Ingredient oder Translation suchen',
    emptyLabel: 'Keine Ingredients fuer diese Suche gefunden.',
  },
  'dose-recommendations': {
    label: 'Dose Recommendations',
    heading: 'Dose-Recommendation-Translations',
    endpoint: '/admin/translations/dose-recommendations',
    searchPlaceholder: 'Ingredient, Quelle, Timing oder Kontext suchen',
    emptyLabel: 'Keine Dose Recommendations fuer diese Suche gefunden.',
  },
  'verified-profiles': {
    label: 'Verified Profiles',
    heading: 'Verified-Profile-Translations',
    endpoint: '/admin/translations/verified-profiles',
    searchPlaceholder: 'Name, Slug, Credentials oder Bio suchen',
    emptyLabel: 'Keine Verified Profiles fuer diese Suche gefunden.',
  },
  'blog-posts': {
    label: 'Blog Posts',
    heading: 'Blog-Translations',
    endpoint: '/admin/translations/blog-posts',
    searchPlaceholder: 'R2-Key, Titel, Slug oder Excerpt suchen',
    emptyLabel: 'Keine Blog Posts fuer diese Suche gefunden.',
  },
};

function normalizeLanguage(value: string): string {
  return value.trim().toLowerCase().replace(/_/g, '-');
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

function isCanceledRequest(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) return false;

  const candidate = error as { code?: unknown; name?: unknown };
  return candidate.code === 'ERR_CANCELED' || candidate.name === 'CanceledError' || candidate.name === 'AbortError';
}

function rowKey(entity: EntityKey, row: TranslationRow): string {
  if ('ingredient_id' in row) return `ingredients:${row.ingredient_id}`;
  if ('dose_recommendation_id' in row) return `dose-recommendations:${row.dose_recommendation_id}`;
  if ('verified_profile_id' in row) return `verified-profiles:${row.verified_profile_id}`;
  return `blog-posts:${row.blog_post_id}`;
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

function formatDose(row: DoseRecommendationTranslationRow): string {
  const min = row.dose_min !== null ? `${row.dose_min}-` : '';
  const perKg = row.per_kg_body_weight !== null ? `, ${row.per_kg_body_weight} ${row.unit}/kg` : '';
  const cap = row.per_kg_cap !== null ? `, cap ${row.per_kg_cap} ${row.unit}` : '';
  return `${min}${row.dose_max ?? ''} ${row.unit}${perKg}${cap}`;
}

function formatTimestamp(value: number | null): string {
  if (value === null) return 'unpublished';
  return new Date(value * 1000).toLocaleDateString('de-DE');
}

function statusBadge(status: TranslationStatus) {
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-xs font-medium ${
        status === 'missing' ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'
      }`}
    >
      {status}
    </span>
  );
}

interface TextInputProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  placeholder?: string;
}

function TextInput({ label, value, onChange, required = false, placeholder }: TextInputProps) {
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

interface TextAreaProps extends TextInputProps {
  rows?: number;
}

function TextArea({ label, value, onChange, required = false, placeholder, rows = 3 }: TextAreaProps) {
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

function SourceBlock({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="rounded-xl border border-gray-100 bg-gray-50 p-3">
      <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-500">{title}</div>
      <div className="space-y-2 text-sm text-gray-700">{children}</div>
    </div>
  );
}

export default function TranslationsTab() {
  const [entity, setEntity] = useState<EntityKey>('ingredients');
  const [language, setLanguage] = useState('de');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [rows, setRows] = useState<TranslationRow[]>([]);
  const [drafts, setDrafts] = useState<Record<string, TranslationDraft>>({});
  const [total, setTotal] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [savedKey, setSavedKey] = useState<string | null>(null);
  const loadRequestIdRef = useRef(0);
  const loadAbortControllerRef = useRef<AbortController | null>(null);

  const normalizedLanguage = useMemo(() => normalizeLanguage(language), [language]);
  const config = ENTITY_CONFIG[entity];
  const pageLimit = DEFAULT_PAGE_LIMIT;

  const totalPages = total != null ? Math.max(1, Math.ceil(total / pageLimit)) : null;
  const hasNext = totalPages != null ? page < totalPages : rows.length === pageLimit;
  const hasPrevious = page > 1;

  const loadTranslations = useCallback(async () => {
    const requestId = loadRequestIdRef.current + 1;
    loadRequestIdRef.current = requestId;
    loadAbortControllerRef.current?.abort();
    const abortController = new AbortController();
    loadAbortControllerRef.current = abortController;
    const offset = (page - 1) * pageLimit;

    setLoading(true);
    setError('');
    setSavedKey(null);

    try {
      const res = await apiClient.get<{
        language: string;
        translations: TranslationRow[];
        total?: number;
        count?: number;
        limit?: number;
      }>(config.endpoint, {
        params: {
          language: normalizedLanguage,
          q: query.trim(),
          limit: pageLimit,
          offset,
        },
        signal: abortController.signal,
      });

      if (requestId !== loadRequestIdRef.current || abortController.signal.aborted) return;

      const nextRows = res.data.translations ?? [];
      const nextTotal = typeof res.data.total === 'number' ? res.data.total : typeof res.data.count === 'number' ? res.data.count : null;

      setRows(nextRows);
      setTotal(nextTotal);
      setDrafts((prev) => {
        const nextDrafts = { ...prev };
        for (const row of nextRows) {
          const key = rowKey(entity, row);
          if (!nextDrafts[key]) {
            nextDrafts[key] = toDraft(row);
          }
        }
        return nextDrafts;
      });
    } catch (err) {
      if (isCanceledRequest(err) || requestId !== loadRequestIdRef.current) return;
      setError(getErrorMessage(err));
      setRows([]);
      setTotal(null);
    } finally {
      if (requestId === loadRequestIdRef.current) {
        setLoading(false);
        if (loadAbortControllerRef.current === abortController) {
          loadAbortControllerRef.current = null;
        }
      }
    }
  }, [config.endpoint, entity, normalizedLanguage, page, pageLimit, query]);

  useEffect(() => {
    loadTranslations();
  }, [loadTranslations]);

  useEffect(() => {
    return () => {
      loadRequestIdRef.current += 1;
      loadAbortControllerRef.current?.abort();
    };
  }, []);

  const updateDraft = (key: string, field: string, value: string) => {
    setDrafts((prev) => ({
      ...prev,
      [key]: {
        ...(prev[key] ?? {}),
        [field]: value,
      } as TranslationDraft,
    }));
    setSavedKey(null);
  };

  const saveTranslation = async (row: TranslationRow) => {
    const key = rowKey(entity, row);
    const draft = drafts[key] ?? toDraft(row);

    setSavingKey(key);
    setError('');
    setSavedKey(null);

    try {
      if ('ingredient_id' in row) {
        const ingredientDraft = draft as IngredientDraft;
        if (!ingredientDraft.name.trim()) {
          setError('Name ist Pflicht.');
          return;
        }

        const payload = {
          name: ingredientDraft.name.trim(),
          description: ingredientDraft.description.trim() || null,
          hypo_symptoms: ingredientDraft.hypo_symptoms.trim() || null,
          hyper_symptoms: ingredientDraft.hyper_symptoms.trim() || null,
        };
        const res = await apiClient.put<{ translation: SavedIngredientTranslation }>(
          `${ENTITY_CONFIG.ingredients.endpoint}/${row.ingredient_id}/${normalizedLanguage}`,
          payload,
        );
        const translation = res.data.translation;
        setRows((prev) =>
          prev.map((item) =>
            'ingredient_id' in item && item.ingredient_id === row.ingredient_id
              ? { ...item, ...translation, status: 'translated' }
              : item,
          ),
        );
        setDrafts((prev) => ({
          ...prev,
          [key]: {
            name: translation.name,
            description: translation.description ?? '',
            hypo_symptoms: translation.hypo_symptoms ?? '',
            hyper_symptoms: translation.hyper_symptoms ?? '',
          },
        }));
      } else if ('dose_recommendation_id' in row) {
        const doseDraft = draft as DoseRecommendationDraft;
        const payload = {
          source_label: doseDraft.source_label.trim() || null,
          timing: doseDraft.timing.trim() || null,
          context_note: doseDraft.context_note.trim() || null,
        };
        const res = await apiClient.put<{ translation: SavedDoseRecommendationTranslation }>(
          `${ENTITY_CONFIG['dose-recommendations'].endpoint}/${row.dose_recommendation_id}/${normalizedLanguage}`,
          payload,
        );
        const translation = res.data.translation;
        setRows((prev) =>
          prev.map((item) =>
            'dose_recommendation_id' in item &&
            item.dose_recommendation_id === row.dose_recommendation_id
              ? { ...item, ...translation, status: 'translated' }
              : item,
          ),
        );
        setDrafts((prev) => ({
          ...prev,
          [key]: {
            source_label: translation.source_label ?? '',
            timing: translation.timing ?? '',
            context_note: translation.context_note ?? '',
          },
        }));
      } else if ('verified_profile_id' in row) {
        const profileDraft = draft as VerifiedProfileDraft;
        const payload = {
          credentials: profileDraft.credentials.trim() || null,
          bio: profileDraft.bio.trim() || null,
        };
        const res = await apiClient.put<{ translation: SavedVerifiedProfileTranslation }>(
          `${ENTITY_CONFIG['verified-profiles'].endpoint}/${row.verified_profile_id}/${normalizedLanguage}`,
          payload,
        );
        const translation = res.data.translation;
        setRows((prev) =>
          prev.map((item) =>
            'verified_profile_id' in item && item.verified_profile_id === row.verified_profile_id
              ? { ...item, ...translation, status: 'translated' }
              : item,
          ),
        );
        setDrafts((prev) => ({
          ...prev,
          [key]: {
            credentials: translation.credentials ?? '',
            bio: translation.bio ?? '',
          },
        }));
      } else {
        const blogDraft = draft as BlogDraft;
        if (!blogDraft.title.trim()) {
          setError('Title ist Pflicht.');
          return;
        }
        if (!blogDraft.slug.trim()) {
          setError('Slug ist Pflicht.');
          return;
        }

        const payload = {
          title: blogDraft.title.trim(),
          slug: blogDraft.slug.trim().toLowerCase(),
          excerpt: blogDraft.excerpt.trim() || null,
          meta_description: blogDraft.meta_description.trim() || null,
        };
        const res = await apiClient.put<{ translation: SavedBlogTranslation }>(
          `${ENTITY_CONFIG['blog-posts'].endpoint}/${row.blog_post_id}/${normalizedLanguage}`,
          payload,
        );
        const translation = res.data.translation;
        setRows((prev) =>
          prev.map((item) =>
            'blog_post_id' in item && item.blog_post_id === row.blog_post_id
              ? { ...item, ...translation, status: 'translated' }
              : item,
          ),
        );
        setDrafts((prev) => ({
          ...prev,
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

  const renderFields = (row: TranslationRow) => {
    const key = rowKey(entity, row);
    const draft = drafts[key] ?? toDraft(row);

    if ('ingredient_id' in row) {
      const ingredientDraft = draft as IngredientDraft;
      return (
        <div className="mt-4 grid grid-cols-1 lg:grid-cols-2 gap-4">
          <SourceBlock title="Base / Source">
            <p className="font-medium text-gray-900">{row.source_name}</p>
            {row.source_description && <p className="line-clamp-3">{row.source_description}</p>}
          </SourceBlock>
          <div className="grid grid-cols-1 gap-4">
            <TextInput
              label="Translation name"
              value={ingredientDraft.name}
              onChange={(value) => updateDraft(key, 'name', value)}
              required
            />
            <TextArea
              label="Translation description"
              value={ingredientDraft.description}
              onChange={(value) => updateDraft(key, 'description', value)}
            />
          </div>
          <TextArea
            label="Translation hypo symptoms"
            value={ingredientDraft.hypo_symptoms}
            onChange={(value) => updateDraft(key, 'hypo_symptoms', value)}
          />
          <TextArea
            label="Translation hyper symptoms"
            value={ingredientDraft.hyper_symptoms}
            onChange={(value) => updateDraft(key, 'hyper_symptoms', value)}
          />
        </div>
      );
    }

    if ('dose_recommendation_id' in row) {
      const doseDraft = draft as DoseRecommendationDraft;
      return (
        <div className="mt-4 grid grid-cols-1 lg:grid-cols-2 gap-4">
          <SourceBlock title="Base / Source">
            <p>
              <span className="font-medium text-gray-900">{row.ingredient_name}</span>
              <span className="text-gray-500"> · {row.source_type}</span>
            </p>
            <p>Source label: {row.base_source_label}</p>
            <p>Dose: {formatDose(row)}</p>
            <p>
              Context: {row.population_slug ?? 'population n/a'} · {row.purpose}
              {row.sex_filter ? ` · ${row.sex_filter}` : ''}
              {row.is_athlete === 1 ? ' · athlete' : ''}
            </p>
            {row.base_timing && <p>Timing: {row.base_timing}</p>}
            {row.base_context_note && <p>Note: {row.base_context_note}</p>}
          </SourceBlock>
          <div className="grid grid-cols-1 gap-4">
            <TextInput
              label="Translation source label"
              value={doseDraft.source_label}
              onChange={(value) => updateDraft(key, 'source_label', value)}
              placeholder="Optional"
            />
            <TextInput
              label="Translation timing"
              value={doseDraft.timing}
              onChange={(value) => updateDraft(key, 'timing', value)}
              placeholder="Optional"
            />
            <TextArea
              label="Translation context note"
              value={doseDraft.context_note}
              onChange={(value) => updateDraft(key, 'context_note', value)}
              placeholder="Optional"
            />
          </div>
        </div>
      );
    }

    if ('verified_profile_id' in row) {
      const profileDraft = draft as VerifiedProfileDraft;
      return (
        <div className="mt-4 grid grid-cols-1 lg:grid-cols-2 gap-4">
          <SourceBlock title="Base / Source">
            <p className="font-medium text-gray-900">{row.base_name}</p>
            <p>Slug: {row.base_slug}</p>
            {row.base_credentials && <p>Credentials: {row.base_credentials}</p>}
            {row.base_bio && <p className="line-clamp-4">Bio: {row.base_bio}</p>}
          </SourceBlock>
          <div className="grid grid-cols-1 gap-4">
            <TextInput
              label="Translation credentials"
              value={profileDraft.credentials}
              onChange={(value) => updateDraft(key, 'credentials', value)}
              placeholder="Optional"
            />
            <TextArea
              label="Translation bio"
              value={profileDraft.bio}
              onChange={(value) => updateDraft(key, 'bio', value)}
              rows={5}
              placeholder="Optional"
            />
          </div>
        </div>
      );
    }

    const blogDraft = draft as BlogDraft;
    return (
      <div className="mt-4 grid grid-cols-1 lg:grid-cols-2 gap-4">
        <SourceBlock title="Base / Source">
          <p className="font-medium text-gray-900">Blog post ID {row.blog_post_id}</p>
          <p>R2 key: {row.r2_key}</p>
          <p>Status: {row.post_status}</p>
          <p>Published: {formatTimestamp(row.published_at)}</p>
        </SourceBlock>
        <div className="grid grid-cols-1 gap-4">
          <TextInput
            label="Translation title"
            value={blogDraft.title}
            onChange={(value) => updateDraft(key, 'title', value)}
            required
          />
          <TextInput
            label="Translation slug"
            value={blogDraft.slug}
            onChange={(value) => updateDraft(key, 'slug', value)}
            required
            placeholder="lowercase-slug"
          />
          <TextArea
            label="Translation excerpt"
            value={blogDraft.excerpt}
            onChange={(value) => updateDraft(key, 'excerpt', value)}
            placeholder="Optional"
          />
          <TextArea
            label="Translation meta description"
            value={blogDraft.meta_description}
            onChange={(value) => updateDraft(key, 'meta_description', value)}
            placeholder="Optional"
          />
        </div>
      </div>
    );
  };

  const displayTotal = total != null ? `${total}` : 'unbekannt';

  return (
    <div className="space-y-5">
      <div className="bg-white border border-gray-100 shadow-sm rounded-2xl p-5">
        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Languages size={20} className="text-indigo-600" />
              <h2 className="text-lg font-semibold text-gray-900">{config.heading}</h2>
            </div>
            <p className="text-sm text-gray-600 max-w-3xl">
              Dieser Admin-Tab pflegt bestehende Translation-Tabellen. Die oeffentliche i18n-Ausspielung
              bleibt davon unberuehrt.
            </p>
          </div>
          {savedKey !== null && (
            <div className="inline-flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-700">
              <CheckCircle size={16} />
              Gespeichert
            </div>
          )}
        </div>

        <div className="mt-5 grid grid-cols-1 gap-4">
          <div className="flex flex-wrap gap-2">
            {(Object.keys(ENTITY_CONFIG) as EntityKey[]).map((key) => (
              <button
                key={key}
                type="button"
                onClick={() => {
                  setEntity(key);
                  setPage(1);
                }}
                className={`rounded-xl border px-3 py-2 text-sm font-semibold transition-colors ${
                  entity === key
                    ? 'border-indigo-600 bg-indigo-600 text-white'
                    : 'border-gray-200 bg-white text-gray-700 hover:border-indigo-300 hover:text-indigo-700'
                }`}
              >
                {ENTITY_CONFIG[key].label}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-[180px_1fr_auto] gap-3">
            <label className="flex flex-col gap-1 text-xs font-semibold uppercase tracking-wider text-gray-500">
              Sprache
              <select
                value={language}
                onChange={(event) => {
                  setLanguage(event.target.value);
                  setPage(1);
                }}
                className="border border-gray-200 rounded-xl px-3 py-2 text-sm font-normal normal-case tracking-normal text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-400"
              >
                {LANGUAGE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label} ({option.value})
                  </option>
                ))}
              </select>
            </label>

            <label className="flex flex-col gap-1 text-xs font-semibold uppercase tracking-wider text-gray-500">
              Suche
              <div className="relative">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  value={query}
                  onChange={(event) => {
                    setQuery(event.target.value);
                    setPage(1);
                  }}
                  placeholder={config.searchPlaceholder}
                  className="w-full border border-gray-200 rounded-xl pl-9 pr-3 py-2 text-sm font-normal normal-case tracking-normal text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-400"
                />
              </div>
            </label>

            <button
              type="button"
              onClick={() => {
                setPage(1);
                loadTranslations();
              }}
              disabled={loading}
              className="self-end inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-indigo-700 disabled:opacity-60"
            >
              {loading ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
              Laden
            </button>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
            <span className="text-gray-500">
              Seite {page}
              {totalPages ? ` / ${totalPages}` : ''}
              {total === null ? ' von unbek. Seiten' : ` · ${displayTotal} Treffer`}
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setPage((prev) => Math.max(1, prev - 1))}
                disabled={!hasPrevious || loading}
                className="min-h-10 px-3 py-2 rounded-lg border border-gray-200 text-sm font-medium disabled:opacity-50"
              >
                Zurueck
              </button>
              <button
                type="button"
                onClick={() => setPage((prev) => prev + 1)}
                disabled={!hasNext || loading}
                className="min-h-10 px-3 py-2 rounded-lg border border-gray-200 text-sm font-medium disabled:opacity-50"
              >
                Weiter
              </button>
            </div>
          </div>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <XCircle size={16} />
          {error}
        </div>
      )}

      {loading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 size={28} className="animate-spin text-indigo-600" />
        </div>
      )}

      {!loading && rows.length === 0 && (
        <div className="rounded-2xl border border-gray-100 bg-white p-8 text-center text-sm text-gray-500 shadow-sm">
          {config.emptyLabel}
        </div>
      )}

      {!loading && rows.length > 0 && (
        <div className="space-y-4">
          {rows.map((row) => {
            const key = rowKey(entity, row);
            const isSaving = savingKey === key;

            return (
              <section
                key={key}
                className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm"
              >
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-base font-semibold text-gray-900">
                        {'ingredient_id' in row
                          ? row.source_name
                          : 'dose_recommendation_id' in row
                            ? row.ingredient_name
                            : 'verified_profile_id' in row
                              ? row.base_name
                              : row.r2_key}
                      </h3>
                      {statusBadge(row.status)}
                      <span className="text-xs text-gray-400">ID {key}</span>
                    </div>
                    {'dose_recommendation_id' in row && (
                      <p className="text-xs text-gray-500 mt-1">
                        {row.source_type} · Dose {row.dose_max ?? '-'} {row.unit}
                      </p>
                    )}
                    {'ingredient_id' in row && <p className="text-xs text-gray-500 mt-1">Sprache {row.language}</p>}
                  </div>
                  <button
                    type="button"
                    onClick={() => saveTranslation(row)}
                    disabled={isSaving}
                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-emerald-700 disabled:opacity-60"
                  >
                    {isSaving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                    Speichern
                  </button>
                </div>

                {renderFields(row)}
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
