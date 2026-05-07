import { useCallback, useEffect, useMemo, useState } from 'react';
import { Archive, FilePlus, RefreshCw, Save, Search } from 'lucide-react';
import {
  archiveKnowledgeArticle,
  createKnowledgeArticle,
  getKnowledgeArticle,
  getKnowledgeArticles,
  updateKnowledgeArticle,
  type AdminKnowledgeArticle,
  type AdminKnowledgeArticlePayload,
} from '../../api/admin';
import {
  AdminBadge,
  AdminButton,
  AdminCard,
  AdminEmpty,
  AdminError,
  AdminPageHeader,
  type AdminTone,
} from './AdminUi';

const STATUS_OPTIONS = [
  { value: '', label: 'Alle Status' },
  { value: 'draft', label: 'Entwurf' },
  { value: 'published', label: 'Veröffentlicht' },
  { value: 'archived', label: 'Archiviert' },
] as const;

const EDIT_STATUS_OPTIONS = STATUS_OPTIONS.filter((option) => option.value);

type EditorMode = 'create' | 'edit';

type ArticleDraft = {
  slug: string;
  title: string;
  summary: string;
  body: string;
  status: string;
  reviewed_at: string;
  sources_text: string;
  version: number | null;
};

function statusLabel(status: string): string {
  if (status === 'published') return 'Veröffentlicht';
  if (status === 'archived') return 'Archiviert';
  return 'Entwurf';
}

function statusTone(status: string): AdminTone {
  if (status === 'published') return 'ok';
  if (status === 'archived') return 'warn';
  return 'danger';
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
    version: null,
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
    version: article.version,
  };
}

function parseSources(text: string): unknown[] {
  const trimmed = text.trim();
  if (!trimmed) return [];
  const parsed = JSON.parse(trimmed);
  if (!Array.isArray(parsed)) {
    throw new Error('Quellen müssen als JSON-Array vorliegen.');
  }
  return parsed;
}

export default function AdministratorKnowledgePage() {
  const [articles, setArticles] = useState<AdminKnowledgeArticle[]>([]);
  const [selectedSlug, setSelectedSlug] = useState<string | null>(null);
  const [mode, setMode] = useState<EditorMode>('edit');
  const [draft, setDraft] = useState<ArticleDraft>(() => emptyDraft());
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('');
  const [loadingList, setLoadingList] = useState(true);
  const [loadingArticle, setLoadingArticle] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const isCreateMode = mode === 'create';
  const filteredStatusLabel = useMemo(
    () => STATUS_OPTIONS.find((option) => option.value === status)?.label ?? 'Alle Status',
    [status],
  );

  const loadList = useCallback(async () => {
    setLoadingList(true);
    setError('');

    try {
      const response = await getKnowledgeArticles({
        q: query.trim() || undefined,
        status: status || undefined,
      });
      const nextArticles = response.articles;
      setArticles(nextArticles);

      if (mode === 'edit') {
        if (!selectedSlug) {
          setSelectedSlug(nextArticles[0]?.slug ?? null);
          return;
        }

        const stillPresent = nextArticles.some((article) => article.slug === selectedSlug);
        if (!stillPresent) {
          setSelectedSlug(nextArticles[0]?.slug ?? null);
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Artikel konnten nicht geladen werden.');
    } finally {
      setLoadingList(false);
    }
  }, [mode, query, selectedSlug, status]);

  useEffect(() => {
    void loadList();
  }, [loadList]);

  useEffect(() => {
    if (!selectedSlug || mode === 'create') {
      return;
    }

    let alive = true;
    setLoadingArticle(true);
    setError('');

    getKnowledgeArticle(selectedSlug)
      .then((article) => {
        if (alive) {
          setDraft(articleToDraft(article));
          setMode('edit');
        }
      })
      .catch((err) => {
        if (!alive) return;
        setError(err instanceof Error ? err.message : 'Artikel konnte nicht geladen werden.');
      })
      .finally(() => {
        if (alive) setLoadingArticle(false);
      });

    return () => {
      alive = false;
    };
  }, [mode, selectedSlug]);

  const updateDraft = (field: keyof ArticleDraft, value: string) => {
    setDraft((previous) => ({ ...previous, [field]: value }));
  };

  const startCreate = () => {
    setMode('create');
    setSelectedSlug(null);
    setDraft(emptyDraft());
    setError('');
    setNotice('');
  };

  const cancelCreate = () => {
    const first = articles[0]?.slug ?? null;
    setMode('edit');
    setSelectedSlug(first);
    setError('');
    setNotice('');
  };

  const loadArticle = (slug: string) => {
    setMode('edit');
    setSelectedSlug(slug);
    setNotice('');
    setError('');
  };

  const handleSave = async () => {
    setSaving(true);
    setError('');
    setNotice('');

    try {
      const sources = parseSources(draft.sources_text);
      const payload: AdminKnowledgeArticlePayload = {
        ...(isCreateMode ? { slug: draft.slug.trim() } : {}),
        title: draft.title.trim(),
        summary: draft.summary.trim() || null,
        body: draft.body.trim() || null,
        status: draft.status,
        reviewed_at: draft.reviewed_at || null,
        sources_json: sources,
        version: draft.version,
      };

      if (!payload.title) throw new Error('Titel ist erforderlich.');
      if (isCreateMode && !payload.slug) {
        throw new Error('Slug ist beim Erstellen erforderlich.');
      }
      if (payload.status === 'published' && !payload.body) {
        throw new Error('Veröffentlichte Wissensartikel brauchen einen Artikeltext.');
      }
      if (payload.status === 'published' && sources.length === 0) {
        throw new Error('Veröffentlichte Wissensartikel brauchen mindestens eine Quelle.');
      }

      let saved: AdminKnowledgeArticle;
      if (isCreateMode) {
        saved = await createKnowledgeArticle(payload);
      } else {
        const targetSlug = selectedSlug;
        if (!targetSlug) {
          throw new Error('Kein Artikel ausgewählt.');
        }
        saved = await updateKnowledgeArticle(targetSlug, payload);
      }

      setMode('edit');
      setSelectedSlug(saved.slug);
      setDraft(articleToDraft(saved));
      setNotice(isCreateMode ? 'Artikel wurde angelegt.' : 'Artikel wurde gespeichert.');
      await loadList();
    } catch (err) {
      setError(
        err instanceof SyntaxError
          ? 'Quellen-JSON ist nicht gültig.'
          : err instanceof Error
            ? err.message
            : 'Artikel konnte nicht gespeichert werden.',
      );
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
      const archived = await archiveKnowledgeArticle(selectedSlug, { version: draft.version });
      setMode('edit');
      setDraft(articleToDraft(archived));
      setNotice('Artikel wurde archiviert.');
      await loadList();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Artikel konnte nicht archiviert werden.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <AdminPageHeader
        title="Wissen"
        subtitle="Wissensartikel schreiben, prüfen, veröffentlichen oder archivieren."
        meta={<AdminBadge tone="info">{articles.length} Artikelliste</AdminBadge>}
      />

      <div className="mb-4 admin-toolbar">
        <div className="admin-toolbar-inline">
          <label className="admin-toolbar-inline">
            <span className="admin-muted flex items-center gap-2 text-xs uppercase tracking-wide">
              <Search size={14} />
              Suchen
            </span>
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Titel oder Slug suchen"
              className="admin-input"
            />
          </label>
          <label className="admin-toolbar-inline text-xs font-medium text-[color:var(--admin-ink-2)]">
            <span className="admin-muted">Status</span>
            <select
              value={status}
              onChange={(event) => setStatus(event.target.value)}
              className="admin-select"
              aria-label={filteredStatusLabel}
            >
              {STATUS_OPTIONS.map((option) => (
                <option key={option.value || 'all'} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <AdminButton onClick={() => void loadList()} disabled={loadingList}>
            <RefreshCw size={14} />
            Aktualisieren
          </AdminButton>
          <AdminButton variant="primary" onClick={startCreate} disabled={loadingList}>
            <FilePlus size={14} />
            Neu
          </AdminButton>
        </div>
      </div>

      {error && <AdminError>{error}</AdminError>}
      {notice && <div className="admin-empty">{notice}</div>}

      <div className="grid gap-4 xl:grid-cols-[360px_minmax(0,1fr)]">
        <AdminCard title="Artikel" subtitle="Liste filtern und einen Artikel zur Bearbeitung auswählen" padded>
          {loadingList ? (
            <AdminEmpty>Lade Artikel...</AdminEmpty>
          ) : articles.length === 0 ? (
            <AdminEmpty>Keine Artikel gefunden.</AdminEmpty>
          ) : (
            <div className="space-y-2">
              {articles.map((article) => (
                <button
                  key={article.slug}
                  type="button"
                  onClick={() => loadArticle(article.slug)}
                  className={`w-full rounded-[var(--admin-r-md)] border px-3 py-2 text-left transition-colors ${
                    article.slug === selectedSlug && mode === 'edit'
                      ? 'border-[color:var(--admin-line-strong)] bg-[color:var(--admin-bg-sunk)]'
                      : 'border-[color:var(--admin-line)] bg-[color:var(--admin-bg)] hover:bg-[color:var(--admin-bg-sunk)]'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold">{article.title}</p>
                      <p className="admin-muted mt-1 text-xs">{article.slug}</p>
                    </div>
                    <AdminBadge tone={statusTone(article.status)}>{statusLabel(article.status)}</AdminBadge>
                  </div>
                  {article.reviewed_at && <p className="admin-muted mt-1 text-xs">Geprüft: {article.reviewed_at}</p>}
                </button>
              ))}
            </div>
          )}
        </AdminCard>

        <AdminCard
          title={isCreateMode ? 'Neuer Artikel' : 'Artikel bearbeiten'}
          subtitle={
            isCreateMode
              ? 'Zum Veröffentlichen braucht der Artikel Text und mindestens eine Quelle.'
              : 'Änderungen werden direkt gespeichert.'
          }
        >
          {loadingArticle ? (
            <AdminEmpty>Lade Artikelinhalt...</AdminEmpty>
          ) : (
            <div className="space-y-3 p-3">
              <div className="grid gap-3 lg:grid-cols-[minmax(200px,1fr)_140px]">
                <label className="text-xs font-medium text-[color:var(--admin-ink-2)]">
                  Slug
                  <input
                    value={draft.slug}
                    onChange={(event) => updateDraft('slug', event.target.value)}
                    disabled={!isCreateMode}
                    className="admin-input mt-1"
                  />
                </label>
                <label className="text-xs font-medium text-[color:var(--admin-ink-2)]">
                  Status
                  <select
                    value={draft.status}
                    onChange={(event) => updateDraft('status', event.target.value)}
                    className="admin-select mt-1"
                  >
                    {EDIT_STATUS_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <label className="text-xs font-medium text-[color:var(--admin-ink-2)]">
                Titel
                <input
                  value={draft.title}
                  onChange={(event) => updateDraft('title', event.target.value)}
                  className="admin-input mt-1"
                />
              </label>

              <label className="text-xs font-medium text-[color:var(--admin-ink-2)]">
                Zusammenfassung
                <textarea
                  value={draft.summary}
                  onChange={(event) => updateDraft('summary', event.target.value)}
                  rows={3}
                  className="admin-input mt-1 min-h-[82px]"
                />
              </label>

              <label className="text-xs font-medium text-[color:var(--admin-ink-2)]">
                Inhalt
                <textarea
                  value={draft.body}
                  onChange={(event) => updateDraft('body', event.target.value)}
                  rows={11}
                  className="admin-input mt-1 min-h-[210px]"
                />
              </label>

              <div className="grid gap-3 lg:grid-cols-[1fr_1.2fr]">
                <label className="text-xs font-medium text-[color:var(--admin-ink-2)]">
                  Geprüft am
                  <input
                    type="date"
                    value={draft.reviewed_at}
                    onChange={(event) => updateDraft('reviewed_at', event.target.value)}
                    className="admin-input mt-1"
                  />
                </label>

                <label className="text-xs font-medium text-[color:var(--admin-ink-2)]">
                  Quellen (JSON)
                  <textarea
                    value={draft.sources_text}
                    onChange={(event) => updateDraft('sources_text', event.target.value)}
                    rows={8}
                    spellCheck={false}
                    className="admin-input mt-1 min-h-[112px] font-mono"
                  />
                </label>
              </div>

              <div className="flex flex-wrap gap-2 border-t border-[color:var(--admin-line)] pt-3">
                {isCreateMode ? (
                  <AdminButton variant="ghost" onClick={cancelCreate} disabled={saving}>
                    Abbrechen
                  </AdminButton>
                ) : (
                  <AdminButton
                    variant="danger"
                    onClick={handleArchive}
                    disabled={saving || draft.status === 'archived'}
                  >
                    <Archive size={14} />
                    Archivieren
                  </AdminButton>
                )}
                <AdminButton variant="primary" onClick={handleSave} disabled={saving}>
                  <Save size={14} />
                  {isCreateMode ? 'Erstellen' : 'Speichern'}
                </AdminButton>
              </div>

              {!isCreateMode && draft.status === 'published' && (
                <p className="admin-muted text-xs">Veröffentlicht: Text und Quellen wurden geprüft.</p>
              )}
            </div>
          )}
        </AdminCard>
      </div>
    </>
  );
}
