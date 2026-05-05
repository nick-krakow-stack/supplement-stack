import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Archive, FilePlus, Save, Search } from 'lucide-react';
import {
  archiveKnowledgeArticle,
  createKnowledgeArticle,
  getKnowledgeArticle,
  getKnowledgeArticles,
  updateKnowledgeArticle,
  type AdminKnowledgeArticle,
  type AdminKnowledgeArticlePayload,
} from '../../api/admin';

const STATUS_OPTIONS = [
  { value: '', label: 'Alle Status' },
  { value: 'draft', label: 'Entwurf' },
  { value: 'published', label: 'Veröffentlicht' },
  { value: 'archived', label: 'Archiviert' },
] as const;

const EDIT_STATUS_OPTIONS = STATUS_OPTIONS.filter((option) => option.value);

interface ArticleDraft {
  slug: string;
  title: string;
  summary: string;
  body: string;
  status: string;
  reviewed_at: string;
  sources_text: string;
}

function statusLabel(status: string): string {
  if (status === 'published') return 'Veröffentlicht';
  if (status === 'archived') return 'Archiviert';
  return 'Entwurf';
}

function statusClass(status: string): string {
  if (status === 'published') return 'bg-emerald-50 text-emerald-700 border-emerald-100';
  if (status === 'archived') return 'bg-slate-100 text-slate-600 border-slate-200';
  return 'bg-amber-50 text-amber-700 border-amber-100';
}

function toDateInput(value?: string | null): string {
  if (!value) return '';
  return value.slice(0, 10);
}

function sourcesToText(value: unknown): string {
  if (value === undefined || value === null || value === '') return '';
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return '';
    try {
      return JSON.stringify(JSON.parse(trimmed), null, 2);
    } catch {
      return trimmed;
    }
  }
  return JSON.stringify(value, null, 2);
}

function emptyDraft(): ArticleDraft {
  return {
    slug: '',
    title: '',
    summary: '',
    body: '',
    status: 'draft',
    reviewed_at: '',
    sources_text: '',
  };
}

function articleToDraft(article: AdminKnowledgeArticle): ArticleDraft {
  return {
    slug: article.slug,
    title: article.title,
    summary: article.summary ?? '',
    body: article.body ?? '',
    status: article.status || 'draft',
    reviewed_at: toDateInput(article.reviewed_at),
    sources_text: sourcesToText(article.sources_json),
  };
}

function parseSources(text: string): unknown {
  const trimmed = text.trim();
  if (!trimmed) return null;
  return JSON.parse(trimmed);
}

export default function AdminKnowledgeArticlesTab() {
  const [articles, setArticles] = useState<AdminKnowledgeArticle[]>([]);
  const [selectedSlug, setSelectedSlug] = useState<string | null>(null);
  const [draft, setDraft] = useState<ArticleDraft>(() => emptyDraft());
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('');
  const [loadingList, setLoadingList] = useState(true);
  const [loadingArticle, setLoadingArticle] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const initialAutoSelectDoneRef = useRef(false);
  const createModeRequestedRef = useRef(false);

  const isCreateMode = selectedSlug === null;

  const loadList = useCallback(async () => {
    setLoadingList(true);
    setError('');
    try {
      const response = await getKnowledgeArticles({ q: query, status });
      setArticles(response.articles);
      if (
        !initialAutoSelectDoneRef.current &&
        !createModeRequestedRef.current &&
        response.articles.length > 0
      ) {
        const first = response.articles[0];
        setSelectedSlug((current) => current ?? first.slug);
      }
      initialAutoSelectDoneRef.current = true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Artikel konnten nicht geladen werden.');
    } finally {
      setLoadingList(false);
    }
  }, [query, status]);

  useEffect(() => {
    loadList();
  }, [loadList]);

  useEffect(() => {
    if (!selectedSlug) return;
    let alive = true;
    setLoadingArticle(true);
    setError('');
    getKnowledgeArticle(selectedSlug)
      .then((article) => {
        if (alive) setDraft(articleToDraft(article));
      })
      .catch((err: unknown) => {
        if (alive) setError(err instanceof Error ? err.message : 'Artikel konnte nicht geladen werden.');
      })
      .finally(() => {
        if (alive) setLoadingArticle(false);
      });
    return () => {
      alive = false;
    };
  }, [selectedSlug]);

  const filteredStatusLabel = useMemo(() => {
    return STATUS_OPTIONS.find((option) => option.value === status)?.label ?? 'Alle Status';
  }, [status]);

  const updateDraft = (field: keyof ArticleDraft, value: string) => {
    setDraft((current) => ({ ...current, [field]: value }));
  };

  const startNewArticle = () => {
    createModeRequestedRef.current = true;
    setSelectedSlug(null);
    setDraft(emptyDraft());
    setNotice('');
    setError('');
  };

  const handleSave = async () => {
    setSaving(true);
    setError('');
    setNotice('');
    try {
      const payload: AdminKnowledgeArticlePayload = {
        ...(isCreateMode ? { slug: draft.slug.trim() } : {}),
        title: draft.title.trim(),
        summary: draft.summary.trim() || null,
        body: draft.body.trim() || null,
        status: draft.status,
        reviewed_at: draft.reviewed_at || null,
        sources_json: parseSources(draft.sources_text),
      };

      if (!payload.title) throw new Error('Titel ist erforderlich.');
      if (isCreateMode && !payload.slug) throw new Error('Slug ist beim Erstellen erforderlich.');

      const saved = isCreateMode
        ? await createKnowledgeArticle(payload)
        : await updateKnowledgeArticle(selectedSlug, payload);
      createModeRequestedRef.current = false;
      setSelectedSlug(saved.slug);
      setDraft(articleToDraft(saved));
      setNotice('Artikel gespeichert.');
      await loadList();
    } catch (err) {
      setError(err instanceof SyntaxError
        ? 'Quellen-JSON ist nicht gültig.'
        : err instanceof Error
          ? err.message
          : 'Artikel konnte nicht gespeichert werden.');
    } finally {
      setSaving(false);
    }
  };

  const handleArchive = async () => {
    if (!selectedSlug) return;
    setSaving(true);
    setError('');
    setNotice('');
    try {
      const archived = await archiveKnowledgeArticle(selectedSlug);
      setDraft(articleToDraft(archived));
      setNotice('Artikel archiviert.');
      await loadList();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Artikel konnte nicht archiviert werden.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Wissen</h2>
          <p className="text-sm text-slate-500">Knowledge-Artikel bearbeiten und veröffentlichen.</p>
        </div>
        <button
          type="button"
          onClick={startNewArticle}
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-indigo-600 px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-indigo-700"
        >
          <FilePlus size={16} />
          Neuer Artikel
        </button>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}
      {notice && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          {notice}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[360px_minmax(0,1fr)]">
        <aside className="space-y-3 rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-[minmax(0,1fr)_180px] xl:grid-cols-1">
            <label className="relative block">
              <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Suchen"
                className="min-h-11 w-full rounded-lg border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm outline-none transition focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100"
              />
            </label>
            <select
              value={status}
              onChange={(event) => setStatus(event.target.value)}
              className="min-h-11 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100"
              aria-label={filteredStatusLabel}
            >
              {STATUS_OPTIONS.map((option) => (
                <option key={option.value || 'all'} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          {loadingList && <p className="py-6 text-center text-sm text-slate-500">Lade...</p>}
          {!loadingList && articles.length === 0 && (
            <p className="py-6 text-center text-sm text-slate-500">Keine Artikel gefunden.</p>
          )}

          {!loadingList && articles.length > 0 && (
            <div className="max-h-[60vh] space-y-2 overflow-y-auto pr-1">
              {articles.map((article) => (
                <button
                  key={article.slug}
                  type="button"
                  onClick={() => {
                    createModeRequestedRef.current = false;
                    setSelectedSlug(article.slug);
                  }}
                  className={`w-full rounded-lg border p-3 text-left transition-colors ${
                    selectedSlug === article.slug
                      ? 'border-indigo-200 bg-indigo-50'
                      : 'border-slate-200 bg-white hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-slate-900">{article.title}</p>
                      <p className="mt-0.5 truncate font-mono text-xs text-slate-500">{article.slug}</p>
                    </div>
                    <span className={`shrink-0 rounded-full border px-2 py-0.5 text-xs font-medium ${statusClass(article.status)}`}>
                      {statusLabel(article.status)}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </aside>

        <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          {loadingArticle ? (
            <div className="flex justify-center py-10">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-500 border-t-transparent" />
            </div>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <label className="space-y-1">
                  <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Slug</span>
                  <input
                    value={draft.slug}
                    onChange={(event) => updateDraft('slug', event.target.value)}
                    disabled={!isCreateMode}
                    className="min-h-11 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none transition disabled:bg-slate-50 disabled:text-slate-500 focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100"
                  />
                </label>
                <label className="space-y-1">
                  <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Status</span>
                  <select
                    value={draft.status}
                    onChange={(event) => updateDraft('status', event.target.value)}
                    className="min-h-11 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100"
                  >
                    {EDIT_STATUS_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <label className="space-y-1">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Titel</span>
                <input
                  value={draft.title}
                  onChange={(event) => updateDraft('title', event.target.value)}
                  className="min-h-11 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100"
                />
              </label>

              <label className="space-y-1">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Zusammenfassung</span>
                <textarea
                  value={draft.summary}
                  onChange={(event) => updateDraft('summary', event.target.value)}
                  rows={3}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100"
                />
              </label>

              <label className="space-y-1">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Inhalt</span>
                <textarea
                  value={draft.body}
                  onChange={(event) => updateDraft('body', event.target.value)}
                  rows={12}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100"
                />
              </label>

              <div className="grid grid-cols-1 gap-3 md:grid-cols-[220px_minmax(0,1fr)]">
                <label className="space-y-1">
                  <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Geprüft am</span>
                  <input
                    type="date"
                    value={draft.reviewed_at}
                    onChange={(event) => updateDraft('reviewed_at', event.target.value)}
                    className="min-h-11 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100"
                  />
                </label>
                <label className="space-y-1">
                  <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Quellen JSON</span>
                  <textarea
                    value={draft.sources_text}
                    onChange={(event) => updateDraft('sources_text', event.target.value)}
                    rows={6}
                    spellCheck={false}
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 font-mono text-xs outline-none transition focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100"
                  />
                </label>
              </div>

              <div className="flex flex-col gap-2 border-t border-slate-100 pt-4 sm:flex-row sm:justify-end">
                {!isCreateMode && (
                  <button
                    type="button"
                    onClick={handleArchive}
                    disabled={saving || draft.status === 'archived'}
                    className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-red-200 px-3 py-2 text-sm font-semibold text-red-700 transition-colors hover:bg-red-50 disabled:opacity-50"
                  >
                    <Archive size={16} />
                    Archivieren
                  </button>
                )}
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={saving}
                  className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-indigo-700 disabled:opacity-50"
                >
                  <Save size={16} />
                  {isCreateMode ? 'Erstellen' : 'Speichern'}
                </button>
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
