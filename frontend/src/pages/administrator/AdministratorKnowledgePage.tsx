import { useCallback, useEffect, useMemo, useState } from 'react';
import { Archive, FilePlus, ImagePlus, Plus, RefreshCw, Save, Search, Trash2, X } from 'lucide-react';
import {
  archiveKnowledgeArticle,
  createKnowledgeArticle,
  getAdminIngredients,
  getKnowledgeArticle,
  getKnowledgeArticles,
  uploadKnowledgeArticleImage,
  updateKnowledgeArticle,
  type AdminIngredientListItem,
  type AdminKnowledgeArticle,
  type AdminKnowledgeArticlePayload,
  type AdminKnowledgeArticleSource,
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
  sources: AdminKnowledgeArticleSource[];
  conclusion: string;
  featured_image_url: string;
  dose_min: string;
  dose_max: string;
  dose_unit: string;
  product_note: string;
  ingredient_ids: number[];
  ingredients: Array<{ ingredient_id: number; name: string | null }>;
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

function emptyDraft(): ArticleDraft {
  return {
    slug: '',
    title: '',
    summary: '',
    body: '',
    status: 'draft',
    reviewed_at: '',
    sources: [{ name: '', link: '', sort_order: 0 }],
    conclusion: '',
    featured_image_url: '',
    dose_min: '',
    dose_max: '',
    dose_unit: '',
    product_note: '',
    ingredient_ids: [],
    ingredients: [],
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
    sources: article.sources.length > 0
      ? article.sources.map((source, index) => ({
          name: source.name || source.label || '',
          link: source.link || source.url || '',
          sort_order: source.sort_order ?? index,
        }))
      : [{ name: '', link: '', sort_order: 0 }],
    conclusion: article.conclusion ?? '',
    featured_image_url: article.featured_image_url ?? '',
    dose_min: article.dose_min === null ? '' : String(article.dose_min),
    dose_max: article.dose_max === null ? '' : String(article.dose_max),
    dose_unit: article.dose_unit ?? '',
    product_note: article.product_note ?? '',
    ingredient_ids: article.ingredient_ids,
    ingredients: article.ingredients,
    version: article.version,
  };
}

function normalizeSources(sources: AdminKnowledgeArticleSource[]): AdminKnowledgeArticleSource[] {
  return sources
    .map((source, index) => ({
      name: source.name.trim(),
      link: source.link.trim(),
      sort_order: index,
    }))
    .filter((source) => source.name || source.link);
}

function parseOptionalNumber(value: string): number | null {
  const trimmed = value.trim().replace(',', '.');
  if (!trimmed) return null;
  const parsed = Number(trimmed);
  if (Number.isFinite(parsed) && parsed >= 0) return parsed;
  if (!Number.isFinite(parsed) || parsed < 0) throw new Error('Dosiswerte müssen positive Zahlen sein.');
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
  const [ingredientQuery, setIngredientQuery] = useState('');
  const [ingredientResults, setIngredientResults] = useState<AdminIngredientListItem[]>([]);
  const [uploadingImage, setUploadingImage] = useState(false);

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

  const updateSource = (index: number, field: 'name' | 'link', value: string) => {
    setDraft((previous) => ({
      ...previous,
      sources: previous.sources.map((source, sourceIndex) => (
        sourceIndex === index ? { ...source, [field]: value } : source
      )),
    }));
  };

  const addSource = () => {
    setDraft((previous) => ({
      ...previous,
      sources: [...previous.sources, { name: '', link: '', sort_order: previous.sources.length }],
    }));
  };

  const removeSource = (index: number) => {
    setDraft((previous) => {
      const nextSources = previous.sources.filter((_, sourceIndex) => sourceIndex !== index);
      return {
        ...previous,
        sources: nextSources.length > 0 ? nextSources : [{ name: '', link: '', sort_order: 0 }],
      };
    });
  };

  const searchIngredients = async () => {
    if (!ingredientQuery.trim()) {
      setIngredientResults([]);
      return;
    }
    const response = await getAdminIngredients({ q: ingredientQuery.trim(), limit: 8 });
    setIngredientResults(response.ingredients.filter((ingredient) => !draft.ingredient_ids.includes(ingredient.id)));
  };

  const addIngredient = (ingredient: AdminIngredientListItem) => {
    setDraft((previous) => {
      if (previous.ingredient_ids.includes(ingredient.id)) return previous;
      return {
        ...previous,
        ingredient_ids: [...previous.ingredient_ids, ingredient.id],
        ingredients: [...previous.ingredients, { ingredient_id: ingredient.id, name: ingredient.name }],
      };
    });
    setIngredientQuery('');
    setIngredientResults([]);
  };

  const removeIngredient = (ingredientId: number) => {
    setDraft((previous) => ({
      ...previous,
      ingredient_ids: previous.ingredient_ids.filter((id) => id !== ingredientId),
      ingredients: previous.ingredients.filter((ingredient) => ingredient.ingredient_id !== ingredientId),
    }));
  };

  const handleImageUpload = async (file: File | null) => {
    if (!file || !selectedSlug || isCreateMode) return;
    setUploadingImage(true);
    setError('');
    setNotice('');
    try {
      const response = await uploadKnowledgeArticleImage(selectedSlug, file);
      setDraft((previous) => ({
        ...previous,
        featured_image_url: response.image_url,
      }));
      setNotice('Artikelbild wurde hochgeladen.');
      await loadList();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Artikelbild konnte nicht hochgeladen werden.');
    } finally {
      setUploadingImage(false);
    }
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
      const sources = normalizeSources(draft.sources);
      if (sources.some((source) => !source.name || !source.link)) {
        throw new Error('Jede Quelle braucht Name und Link.');
      }
      const payload: AdminKnowledgeArticlePayload = {
        ...(isCreateMode ? { slug: draft.slug.trim() } : {}),
        title: draft.title.trim(),
        summary: draft.summary.trim() || null,
        body: draft.body.trim() || null,
        status: draft.status,
        reviewed_at: draft.reviewed_at || null,
        sources,
        ingredient_ids: draft.ingredient_ids,
        conclusion: draft.conclusion.trim() || null,
        featured_image_url: draft.featured_image_url.trim() || null,
        dose_min: parseOptionalNumber(draft.dose_min),
        dose_max: parseOptionalNumber(draft.dose_max),
        dose_unit: draft.dose_unit.trim() || null,
        product_note: draft.product_note.trim() || null,
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
        subtitle="Artikel schreiben, prüfen und veröffentlichen."
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
        <AdminCard title="Artikel" subtitle="Artikel auswählen oder neu anlegen." padded>
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
          subtitle="Änderungen prüfen und speichern."
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

              <div className="grid gap-3 lg:grid-cols-[1fr_1fr_1fr_1fr]">
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
                  Artikelbild-URL
                  <input
                    value={draft.featured_image_url}
                    onChange={(event) => updateDraft('featured_image_url', event.target.value)}
                    className="admin-input mt-1"
                    placeholder="https://..."
                  />
                </label>
              </div>

              {!isCreateMode && selectedSlug && (
                <div className="rounded-[var(--admin-r-sm)] border border-[color:var(--admin-line)] p-3">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <h3 className="text-xs font-semibold uppercase tracking-wide text-[color:var(--admin-ink-2)]">Artikelbild</h3>
                      <p className="admin-muted mt-1 text-xs">Optionales Bild hochladen oder eine externe Bild-URL eintragen.</p>
                    </div>
                    <label className="admin-btn admin-btn-sm cursor-pointer">
                      <ImagePlus size={14} />
                      {uploadingImage ? 'Lade hoch...' : 'Bild hochladen'}
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        className="sr-only"
                        disabled={uploadingImage}
                        onChange={(event) => void handleImageUpload(event.target.files?.[0] ?? null)}
                      />
                    </label>
                  </div>
                  {draft.featured_image_url ? (
                    <img
                      src={draft.featured_image_url}
                      alt=""
                      className="mt-3 aspect-[16/9] w-full max-w-xl rounded-[var(--admin-r-sm)] object-cover"
                    />
                  ) : null}
                </div>
              )}

              <div className="grid gap-3 lg:grid-cols-[1fr_1fr_120px]">
                <label className="text-xs font-medium text-[color:var(--admin-ink-2)]">
                  Dosis min.
                  <input value={draft.dose_min} onChange={(event) => updateDraft('dose_min', event.target.value)} className="admin-input mt-1" inputMode="decimal" />
                </label>
                <label className="text-xs font-medium text-[color:var(--admin-ink-2)]">
                  Dosis max.
                  <input value={draft.dose_max} onChange={(event) => updateDraft('dose_max', event.target.value)} className="admin-input mt-1" inputMode="decimal" />
                </label>
                <label className="text-xs font-medium text-[color:var(--admin-ink-2)]">
                  Einheit
                  <select value={draft.dose_unit} onChange={(event) => updateDraft('dose_unit', event.target.value)} className="admin-select mt-1">
                    <option value="">Keine</option>
                    <option value="mg">mg</option>
                    <option value="µg">µg</option>
                    <option value="g">g</option>
                    <option value="IE">IE</option>
                    <option value="ml">ml</option>
                  </select>
                </label>
              </div>

              <label className="text-xs font-medium text-[color:var(--admin-ink-2)]">
                Fazit
                <textarea value={draft.conclusion} onChange={(event) => updateDraft('conclusion', event.target.value)} rows={4} className="admin-input mt-1 min-h-[100px]" />
              </label>

              <label className="text-xs font-medium text-[color:var(--admin-ink-2)]">
                Produkthinweis
                <textarea value={draft.product_note} onChange={(event) => updateDraft('product_note', event.target.value)} rows={3} className="admin-input mt-1 min-h-[82px]" />
              </label>

              <div className="rounded-[var(--admin-r-sm)] border border-[color:var(--admin-line)] p-3">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-[color:var(--admin-ink-2)]">Quellen</h3>
                  <AdminButton size="sm" onClick={addSource}><Plus size={13} />Quelle</AdminButton>
                </div>
                <div className="grid gap-2">
                  {draft.sources.map((source, index) => (
                    <div key={index} className="grid gap-2 lg:grid-cols-[minmax(160px,0.8fr)_minmax(220px,1.2fr)_auto]">
                      <input value={source.name} onChange={(event) => updateSource(index, 'name', event.target.value)} className="admin-input" placeholder="Name" />
                      <input value={source.link} onChange={(event) => updateSource(index, 'link', event.target.value)} className="admin-input" placeholder="Link" />
                      <AdminButton size="sm" variant="danger" onClick={() => removeSource(index)} disabled={draft.sources.length <= 1}>
                        <Trash2 size={13} />
                      </AdminButton>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-[var(--admin-r-sm)] border border-[color:var(--admin-line)] p-3">
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-[color:var(--admin-ink-2)]">Wirkstoff-Zuordnung</h3>
                <div className="mb-2 flex flex-wrap gap-2">
                  {draft.ingredients.length === 0 ? (
                    <span className="admin-muted text-xs">Kein Wirkstoff zugeordnet.</span>
                  ) : draft.ingredients.map((ingredient) => (
                    <span key={ingredient.ingredient_id} className="admin-badge admin-badge-info gap-1">
                      {ingredient.name || `#${ingredient.ingredient_id}`}
                      <button type="button" onClick={() => removeIngredient(ingredient.ingredient_id)} aria-label="Wirkstoff entfernen"><X size={12} /></button>
                    </span>
                  ))}
                </div>
                <div className="flex flex-wrap gap-2">
                  <input value={ingredientQuery} onChange={(event) => setIngredientQuery(event.target.value)} className="admin-input min-w-[220px] flex-1" placeholder="Wirkstoff suchen" />
                  <AdminButton onClick={() => void searchIngredients()} disabled={!ingredientQuery.trim()}><Search size={13} />Suchen</AdminButton>
                </div>
                {ingredientResults.length > 0 && (
                  <div className="mt-2 grid gap-2">
                    {ingredientResults.map((ingredient) => (
                      <button key={ingredient.id} type="button" onClick={() => addIngredient(ingredient)} className="rounded-[var(--admin-r-sm)] border border-[color:var(--admin-line)] px-3 py-2 text-left text-sm hover:bg-[color:var(--admin-bg-sunk)]">
                        {ingredient.name}
                      </button>
                    ))}
                  </div>
                )}
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
