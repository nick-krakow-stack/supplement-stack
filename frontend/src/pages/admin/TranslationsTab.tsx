import { useCallback, useEffect, useMemo, useState } from 'react';
import { CheckCircle, Languages, Loader2, Save, Search, XCircle } from 'lucide-react';
import { apiClient } from '../../api/client';

type TranslationStatus = 'missing' | 'translated';

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

interface TranslationDraft {
  name: string;
  description: string;
  hypo_symptoms: string;
  hyper_symptoms: string;
}

const LANGUAGE_OPTIONS = [
  { value: 'de', label: 'Deutsch' },
  { value: 'en', label: 'Englisch' },
  { value: 'fr', label: 'Franzoesisch' },
  { value: 'es', label: 'Spanisch' },
];

function toDraft(row: IngredientTranslationRow): TranslationDraft {
  return {
    name: row.name ?? '',
    description: row.description ?? '',
    hypo_symptoms: row.hypo_symptoms ?? '',
    hyper_symptoms: row.hyper_symptoms ?? '',
  };
}

function normalizeLanguage(value: string): string {
  return value.trim().toLowerCase().replace(/_/g, '-');
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return 'Die Anfrage ist fehlgeschlagen.';
}

export default function TranslationsTab() {
  const [language, setLanguage] = useState('de');
  const [query, setQuery] = useState('');
  const [rows, setRows] = useState<IngredientTranslationRow[]>([]);
  const [drafts, setDrafts] = useState<Record<number, TranslationDraft>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [savingId, setSavingId] = useState<number | null>(null);
  const [savedId, setSavedId] = useState<number | null>(null);

  const normalizedLanguage = useMemo(() => normalizeLanguage(language), [language]);

  const loadTranslations = useCallback(async () => {
    setLoading(true);
    setError('');
    setSavedId(null);

    try {
      const res = await apiClient.get<{
        language: string;
        translations: IngredientTranslationRow[];
      }>('/admin/translations/ingredients', {
        params: {
          language: normalizedLanguage,
          q: query.trim(),
          limit: 50,
          offset: 0,
        },
      });
      const nextRows = res.data.translations ?? [];
      setRows(nextRows);
      setDrafts(Object.fromEntries(nextRows.map((row) => [row.ingredient_id, toDraft(row)])));
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [normalizedLanguage, query]);

  useEffect(() => {
    loadTranslations();
  }, [loadTranslations]);

  const updateDraft = (ingredientId: number, field: keyof TranslationDraft, value: string) => {
    setDrafts((prev) => ({
      ...prev,
      [ingredientId]: {
        ...prev[ingredientId],
        [field]: value,
      },
    }));
    setSavedId(null);
  };

  const saveTranslation = async (row: IngredientTranslationRow) => {
    const draft = drafts[row.ingredient_id];
    if (!draft?.name.trim()) {
      setError('Name ist Pflicht.');
      return;
    }

    setSavingId(row.ingredient_id);
    setError('');
    setSavedId(null);

    try {
      const payload = {
        name: draft.name.trim(),
        description: draft.description.trim() || null,
        hypo_symptoms: draft.hypo_symptoms.trim() || null,
        hyper_symptoms: draft.hyper_symptoms.trim() || null,
      };
      const res = await apiClient.put<{
        translation: {
          ingredient_id: number;
          language: string;
          name: string;
          description: string | null;
          hypo_symptoms: string | null;
          hyper_symptoms: string | null;
        };
      }>(
        `/admin/translations/ingredients/${row.ingredient_id}/${normalizedLanguage}`,
        payload,
      );
      const translation = res.data.translation;
      setRows((prev) =>
        prev.map((item) =>
          item.ingredient_id === row.ingredient_id
            ? {
                ...item,
                language: translation.language,
                name: translation.name,
                description: translation.description,
                hypo_symptoms: translation.hypo_symptoms,
                hyper_symptoms: translation.hyper_symptoms,
                status: 'translated',
              }
            : item,
        ),
      );
      setDrafts((prev) => ({
        ...prev,
        [row.ingredient_id]: {
          name: translation.name,
          description: translation.description ?? '',
          hypo_symptoms: translation.hypo_symptoms ?? '',
          hyper_symptoms: translation.hyper_symptoms ?? '',
        },
      }));
      setSavedId(row.ingredient_id);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSavingId(null);
    }
  };

  return (
    <div className="space-y-5">
      <div className="bg-white border border-gray-100 shadow-sm rounded-2xl p-5">
        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Languages size={20} className="text-indigo-600" />
              <h2 className="text-lg font-semibold text-gray-900">Ingredient-Translations</h2>
            </div>
            <p className="text-sm text-gray-600 max-w-3xl">
              Dieses MVP pflegt nur Eintraege in ingredient_translations. Die oeffentliche i18n-Ausspielung
              wird separat umgesetzt und hier noch nicht beeinflusst.
            </p>
          </div>
          {savedId !== null && (
            <div className="inline-flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-700">
              <CheckCircle size={16} />
              Gespeichert
            </div>
          )}
        </div>

        <div className="mt-5 grid grid-cols-1 md:grid-cols-[180px_1fr_auto] gap-3">
          <label className="flex flex-col gap-1 text-xs font-semibold uppercase tracking-wider text-gray-500">
            Sprache
            <select
              value={language}
              onChange={(event) => setLanguage(event.target.value)}
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
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Ingredient oder Translation suchen"
                className="w-full border border-gray-200 rounded-xl pl-9 pr-3 py-2 text-sm font-normal normal-case tracking-normal text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-400"
              />
            </div>
          </label>

          <button
            type="button"
            onClick={loadTranslations}
            disabled={loading}
            className="self-end inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-indigo-700 disabled:opacity-60"
          >
            {loading ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
            Laden
          </button>
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
          Keine Ingredients fuer diese Suche gefunden.
        </div>
      )}

      {!loading && rows.length > 0 && (
        <div className="space-y-4">
          {rows.map((row) => {
            const draft = drafts[row.ingredient_id] ?? toDraft(row);
            const isSaving = savingId === row.ingredient_id;

            return (
              <section key={row.ingredient_id} className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-base font-semibold text-gray-900">{row.source_name}</h3>
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                          row.status === 'missing'
                            ? 'bg-amber-100 text-amber-700'
                            : 'bg-emerald-100 text-emerald-700'
                        }`}
                      >
                        {row.status === 'missing' ? 'missing' : 'translated'}
                      </span>
                      <span className="text-xs text-gray-400">ID {row.ingredient_id}</span>
                    </div>
                    {row.source_description && (
                      <p className="mt-1 line-clamp-2 text-sm text-gray-500">{row.source_description}</p>
                    )}
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

                <div className="mt-4 grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <label className="flex flex-col gap-1 text-sm font-medium text-gray-700">
                    Name
                    <input
                      value={draft.name}
                      onChange={(event) => updateDraft(row.ingredient_id, 'name', event.target.value)}
                      className="border border-gray-200 rounded-xl px-3 py-2 text-sm font-normal text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-400"
                    />
                  </label>

                  <label className="flex flex-col gap-1 text-sm font-medium text-gray-700">
                    Beschreibung
                    <textarea
                      value={draft.description}
                      onChange={(event) => updateDraft(row.ingredient_id, 'description', event.target.value)}
                      rows={3}
                      className="border border-gray-200 rounded-xl px-3 py-2 text-sm font-normal text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-400"
                    />
                  </label>

                  <label className="flex flex-col gap-1 text-sm font-medium text-gray-700">
                    Mangel-Symptome
                    <textarea
                      value={draft.hypo_symptoms}
                      onChange={(event) => updateDraft(row.ingredient_id, 'hypo_symptoms', event.target.value)}
                      rows={3}
                      className="border border-gray-200 rounded-xl px-3 py-2 text-sm font-normal text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-400"
                    />
                  </label>

                  <label className="flex flex-col gap-1 text-sm font-medium text-gray-700">
                    Ueberdosierungs-Symptome
                    <textarea
                      value={draft.hyper_symptoms}
                      onChange={(event) => updateDraft(row.ingredient_id, 'hyper_symptoms', event.target.value)}
                      rows={3}
                      className="border border-gray-200 rounded-xl px-3 py-2 text-sm font-normal text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-400"
                    />
                  </label>
                </div>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
