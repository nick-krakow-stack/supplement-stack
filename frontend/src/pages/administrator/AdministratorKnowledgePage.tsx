import { useCallback, useEffect, useMemo, useState } from 'react';
import { Archive, ChevronLeft, ChevronRight, FilePlus, ImagePlus, Plus, RefreshCw, Save, Search, Trash2, X } from 'lucide-react';
import {
  archiveKnowledgeArticle,
  createKnowledgeArticle,
  getAdminIngredients,
  getAdminStudyInterpretationRecords,
  getIngredientParts,
  getKnowledgeArticle,
  getKnowledgeArticleParts,
  getKnowledgeArticles,
  getKnowledgeOverviewProjectionAudit,
  refreshKnowledgeOverviewProjection,
  saveAdminStudyInterpretationRecord,
  uploadKnowledgeArticleImage,
  updateAdminStudyInterpretationRecord,
  updateKnowledgeArticle,
  updateKnowledgeArticleParts,
  type AdminIngredientPartLink,
  type AdminIngredientListItem,
  type AdminKnowledgeArticle,
  type AdminKnowledgeArticleLayer,
  type AdminKnowledgeArticlePart,
  type AdminKnowledgeArticlePayload,
  type AdminKnowledgeArticleSource,
  type AdminKnowledgeOverviewProjectionAudit,
  type AdminStudyInterpretationRecord,
  type AdminStudyInterpretationStatus,
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
const LAYER_OPTIONS: Array<{ value: AdminKnowledgeArticleLayer | ''; label: string }> = [
  { value: '', label: 'Alle Schichten' },
  { value: 'main_article', label: 'Hauptartikel' },
  { value: 'single_study', label: 'Einzelstudien' },
];
const EDIT_LAYER_OPTIONS = LAYER_OPTIONS.filter((option): option is { value: AdminKnowledgeArticleLayer; label: string } => Boolean(option.value));
const PAGE_SIZE_OPTIONS = [25, 50, 100] as const;
const STUDY_INTERPRETATION_STATUS_OPTIONS: Array<{ value: AdminStudyInterpretationStatus; label: string }> = [
  { value: 'planned', label: 'Geplant' },
  { value: 'delegated', label: 'Delegiert' },
  { value: 'drafted', label: 'Entwurf' },
  { value: 'reviewed', label: 'Geprüft' },
  { value: 'accepted', label: 'Akzeptiert' },
  { value: 'blocked', label: 'Blockiert' },
  { value: 'excluded', label: 'Ausgeschlossen' },
];

type EditorMode = 'create' | 'edit';

type ArticleDraft = {
  slug: string;
  title: string;
  summary: string;
  body: string;
  status: string;
  article_layer: AdminKnowledgeArticleLayer;
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

type StudyInterpretationDraft = {
  id: number | null;
  ingredient_id: string;
  source_id: string;
  research_artifact_id: string;
  status: AdminStudyInterpretationStatus;
  structured_summary_json: string;
  stage3_reference_summary: string;
  notes: string;
  review_notes: string;
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

function layerLabel(layer: AdminKnowledgeArticleLayer | string): string {
  return layer === 'single_study' ? 'Einzelstudie' : 'Hauptartikel';
}

function layerTone(layer: AdminKnowledgeArticleLayer | string): AdminTone {
  return layer === 'single_study' ? 'info' : 'neutral';
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
    article_layer: 'main_article',
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

function emptyStudyInterpretationDraft(defaultIngredientId: number | null = null): StudyInterpretationDraft {
  return {
    id: null,
    ingredient_id: defaultIngredientId ? String(defaultIngredientId) : '',
    source_id: '',
    research_artifact_id: '',
    status: 'planned',
    structured_summary_json: '{}',
    stage3_reference_summary: '',
    notes: '',
    review_notes: '',
    version: null,
  };
}

function isEmptyJsonObject(value: string): boolean {
  try {
    const parsed: unknown = JSON.parse(value.trim() || '{}');
    return typeof parsed === 'object'
      && parsed !== null
      && !Array.isArray(parsed)
      && Object.keys(parsed).length === 0;
  } catch {
    return false;
  }
}

function articleToDraft(article: AdminKnowledgeArticle): ArticleDraft {
  return {
    slug: article.slug,
    title: article.title,
    summary: article.summary ?? '',
    body: article.body ?? '',
    status: article.status || 'draft',
    article_layer: article.article_layer,
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

function studyInterpretationRecordToDraft(record: AdminStudyInterpretationRecord): StudyInterpretationDraft {
  return {
    id: record.id,
    ingredient_id: String(record.ingredient_id),
    source_id: String(record.source_id),
    research_artifact_id: record.research_artifact_id ? String(record.research_artifact_id) : '',
    status: record.status,
    structured_summary_json: record.structured_summary_json || '{}',
    stage3_reference_summary: record.stage3_reference_summary ?? '',
    notes: record.notes ?? '',
    review_notes: record.review_notes ?? '',
    version: record.version,
  };
}

function parseRequiredPositiveInteger(value: string, label: string): number {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) throw new Error(`${label} muss eine positive ID sein.`);
  return parsed;
}

function parseOptionalPositiveInteger(value: string, label: string): number | null {
  if (!value.trim()) return null;
  return parseRequiredPositiveInteger(value, label);
}

function studyInterpretationStatusLabel(status: AdminStudyInterpretationStatus): string {
  return STUDY_INTERPRETATION_STATUS_OPTIONS.find((option) => option.value === status)?.label ?? 'Geplant';
}

function sourceEvidenceLabel(record: AdminStudyInterpretationRecord | null): string {
  if (!record) return 'Nach dem Speichern aus der verknüpften Quelle';
  const parts = [
    record.source_evidence_quality,
    record.source_evidence_grade ? `Grad ${record.source_evidence_grade}` : null,
  ].filter(Boolean);
  return parts.length > 0 ? parts.join(' / ') : 'Keine Einstufung an der Quelle';
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
  const [layer, setLayer] = useState<AdminKnowledgeArticleLayer | ''>('');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState<(typeof PAGE_SIZE_OPTIONS)[number]>(25);
  const [totalArticles, setTotalArticles] = useState(0);
  const [loadingList, setLoadingList] = useState(true);
  const [loadingArticle, setLoadingArticle] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [ingredientQuery, setIngredientQuery] = useState('');
  const [ingredientResults, setIngredientResults] = useState<AdminIngredientListItem[]>([]);
  const [knowledgePartLinks, setKnowledgePartLinks] = useState<AdminKnowledgeArticlePart[]>([]);
  const [ingredientPartOptions, setIngredientPartOptions] = useState<Record<number, AdminIngredientPartLink[]>>({});
  const [loadingKnowledgeParts, setLoadingKnowledgeParts] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [studyInterpretations, setStudyInterpretations] = useState<AdminStudyInterpretationRecord[]>([]);
  const [studyInterpretationDraft, setStudyInterpretationDraft] = useState<StudyInterpretationDraft>(() => emptyStudyInterpretationDraft());
  const [loadingStudyInterpretations, setLoadingStudyInterpretations] = useState(false);
  const [savingStudyInterpretation, setSavingStudyInterpretation] = useState(false);
  const [overviewAudit, setOverviewAudit] = useState<AdminKnowledgeOverviewProjectionAudit | null>(null);
  const [checkingOverview, setCheckingOverview] = useState(false);
  const [refreshingOverview, setRefreshingOverview] = useState(false);

  const isCreateMode = mode === 'create';
  const isSingleStudyArticle = draft.article_layer === 'single_study';
  const filteredStatusLabel = useMemo(
    () => STATUS_OPTIONS.find((option) => option.value === status)?.label ?? 'Alle Status',
    [status],
  );
  const filteredLayerLabel = useMemo(
    () => LAYER_OPTIONS.find((option) => option.value === layer)?.label ?? 'Alle Schichten',
    [layer],
  );
  const selectedStudyInterpretation = useMemo(
    () => studyInterpretations.find((record) => record.id === studyInterpretationDraft.id) ?? null,
    [studyInterpretationDraft.id, studyInterpretations],
  );
  const totalPages = Math.max(1, Math.ceil(totalArticles / limit));
  const listStart = totalArticles === 0 ? 0 : (page - 1) * limit + 1;
  const listEnd = Math.min(page * limit, totalArticles);

  const loadList = useCallback(async () => {
    setLoadingList(true);
    setError('');

    try {
      const response = await getKnowledgeArticles({
        q: query.trim() || undefined,
        status: status || undefined,
        layer: layer || undefined,
        page,
        limit,
      });
      const nextTotal = Math.max(0, response.total ?? 0);
      const nextTotalPages = Math.max(1, Math.ceil(nextTotal / limit));
      setTotalArticles(nextTotal);
      if (page > nextTotalPages) {
        setPage(nextTotalPages);
        return;
      }
      const nextArticles = response.articles;
      setArticles(nextArticles);

      if (mode === 'edit') {
        setSelectedSlug((currentSlug) => {
          if (!currentSlug) return nextArticles[0]?.slug ?? null;
          const stillPresent = nextArticles.some((article) => article.slug === currentSlug);
          return stillPresent ? currentSlug : nextArticles[0]?.slug ?? null;
        });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Artikel konnten nicht geladen werden.');
    } finally {
      setLoadingList(false);
    }
  }, [layer, limit, mode, page, query, status]);

  const loadOverviewAudit = useCallback(async () => {
    setCheckingOverview(true);
    try {
      setOverviewAudit(await getKnowledgeOverviewProjectionAudit());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Der Wissensübersicht-Abgleich konnte nicht geladen werden.');
    } finally {
      setCheckingOverview(false);
    }
  }, []);

  const loadStudyInterpretations = useCallback(async (articleSlug: string, defaultIngredientId: number | null) => {
    setLoadingStudyInterpretations(true);
    try {
      const response = await getAdminStudyInterpretationRecords({ knowledge_article_slug: articleSlug });
      const records = response.records;
      setStudyInterpretations(records);
      setStudyInterpretationDraft(records[0]
        ? studyInterpretationRecordToDraft(records[0])
        : emptyStudyInterpretationDraft(defaultIngredientId));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Quellenbezüge konnten nicht geladen werden.');
      setStudyInterpretations([]);
      setStudyInterpretationDraft(emptyStudyInterpretationDraft(defaultIngredientId));
    } finally {
      setLoadingStudyInterpretations(false);
    }
  }, []);

  useEffect(() => {
    void loadList();
  }, [loadList]);

  useEffect(() => {
    void loadOverviewAudit();
  }, [loadOverviewAudit]);

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

  useEffect(() => {
    if (!selectedSlug || mode === 'create') {
      setKnowledgePartLinks([]);
      return;
    }
    let alive = true;
    setLoadingKnowledgeParts(true);
    setKnowledgePartLinks([]);
    getKnowledgeArticleParts(selectedSlug)
      .then((parts) => { if (alive) setKnowledgePartLinks(parts); })
      .catch((err) => { if (alive) setError(err instanceof Error ? err.message : 'Sub-Wirkstoff-Verknüpfungen konnten nicht geladen werden.'); })
      .finally(() => { if (alive) setLoadingKnowledgeParts(false); });
    return () => { alive = false; };
  }, [mode, selectedSlug]);

  useEffect(() => {
    const missing = draft.ingredient_ids.filter((ingredientId) => !ingredientPartOptions[ingredientId]);
    if (missing.length === 0) return;
    let alive = true;
    Promise.all(missing.map(async (ingredientId) => [ingredientId, await getIngredientParts(ingredientId)] as const))
      .then((entries) => {
        if (!alive) return;
        setIngredientPartOptions((previous) => ({ ...previous, ...Object.fromEntries(entries) }));
      })
      .catch((err) => { if (alive) setError(err instanceof Error ? err.message : 'Sub-Wirkstoffe konnten nicht geladen werden.'); });
    return () => { alive = false; };
  }, [draft.ingredient_ids, ingredientPartOptions]);

  useEffect(() => {
    if (mode === 'create' || !selectedSlug || draft.article_layer !== 'single_study') {
      setStudyInterpretations([]);
      setStudyInterpretationDraft(emptyStudyInterpretationDraft(draft.ingredient_ids[0] ?? null));
      return;
    }

    void loadStudyInterpretations(selectedSlug, draft.ingredient_ids[0] ?? null);
  }, [draft.article_layer, draft.ingredient_ids, loadStudyInterpretations, mode, selectedSlug]);

  const updateDraft = <K extends keyof ArticleDraft>(field: K, value: ArticleDraft[K]) => {
    setDraft((previous) => ({ ...previous, [field]: value }));
  };

  const updateStudyInterpretationDraft = <K extends keyof StudyInterpretationDraft>(
    field: K,
    value: StudyInterpretationDraft[K],
  ) => {
    setStudyInterpretationDraft((previous) => ({ ...previous, [field]: value }));
  };

  const startNewStudyInterpretation = () => {
    setStudyInterpretationDraft(emptyStudyInterpretationDraft(draft.ingredient_ids[0] ?? null));
  };

  const selectStudyInterpretation = (record: AdminStudyInterpretationRecord) => {
    setStudyInterpretationDraft(studyInterpretationRecordToDraft(record));
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
    setKnowledgePartLinks((previous) => previous.filter((part) => part.ingredient_id !== ingredientId));
  };

  const toggleKnowledgePart = (ingredientId: number, ingredientName: string | null, part: AdminIngredientPartLink) => {
    setKnowledgePartLinks((previous) => {
      const exists = previous.some((entry) => entry.ingredient_id === ingredientId && entry.part_id === part.part_id);
      if (exists) return previous.filter((entry) => !(entry.ingredient_id === ingredientId && entry.part_id === part.part_id));
      return [...previous, {
        article_slug: selectedSlug ?? draft.slug,
        ingredient_id: ingredientId,
        ingredient_name: ingredientName,
        part_id: part.part_id,
        part_name: part.part_name,
        part_type: part.part_type,
        part_status: part.part_status,
        sort_order: previous.length,
      }];
    });
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
    setKnowledgePartLinks([]);
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
    setKnowledgePartLinks([]);
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
        article_layer: draft.article_layer,
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

      await updateKnowledgeArticleParts(saved.slug, knowledgePartLinks.map((part, index) => ({
        ingredient_id: part.ingredient_id,
        part_id: part.part_id,
        sort_order: index,
      })));

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

  const handleSaveStudyInterpretation = async () => {
    if (!selectedSlug || isCreateMode) {
      setError('Der Quellenbezug kann erst nach dem Speichern des Einzelstudien-Artikels verknüpft werden.');
      return;
    }

    setSavingStudyInterpretation(true);
    setError('');
    setNotice('');

    try {
      JSON.parse(studyInterpretationDraft.structured_summary_json || '{}');
      const payload = {
        ingredient_id: parseRequiredPositiveInteger(studyInterpretationDraft.ingredient_id, 'Wirkstoff-ID'),
        source_id: parseRequiredPositiveInteger(studyInterpretationDraft.source_id, 'Quellen-ID'),
        research_artifact_id: parseOptionalPositiveInteger(studyInterpretationDraft.research_artifact_id, 'Forschungsartefakt-ID'),
        knowledge_article_slug: selectedSlug,
        status: studyInterpretationDraft.status,
        structured_summary_json: studyInterpretationDraft.structured_summary_json.trim() || '{}',
        stage3_reference_summary: studyInterpretationDraft.stage3_reference_summary.trim() || null,
        notes: studyInterpretationDraft.notes.trim() || null,
        review_notes: studyInterpretationDraft.review_notes.trim() || null,
        version: studyInterpretationDraft.version,
      };

      const saved = studyInterpretationDraft.id
        ? await updateAdminStudyInterpretationRecord(studyInterpretationDraft.id, payload)
        : await saveAdminStudyInterpretationRecord(payload);
      setStudyInterpretationDraft(studyInterpretationRecordToDraft(saved));
      setNotice('Quellenbezug und optionale Bestandsdaten wurden gespeichert.');
      await loadStudyInterpretations(selectedSlug, draft.ingredient_ids[0] ?? null);
    } catch (err) {
      setError(
        err instanceof SyntaxError
          ? 'Die optionalen Legacy-JSON-Daten müssen gültiges JSON sein.'
          : err instanceof Error
            ? err.message
            : 'Quellenbezug und optionale Bestandsdaten konnten nicht gespeichert werden.',
      );
    } finally {
      setSavingStudyInterpretation(false);
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

  const handleRefreshOverview = async () => {
    if (!overviewAudit || overviewAudit.consistent || !overviewAudit.available) return;
    setRefreshingOverview(true);
    setError('');
    setNotice('');
    try {
      const result = await refreshKnowledgeOverviewProjection(overviewAudit);
      setOverviewAudit(result.audit);
      setNotice(result.applied
        ? 'Die Wissensübersicht wurde atomar aktualisiert und der öffentliche Cache geleert.'
        : 'Die Wissensübersicht war bereits aktuell.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Die Wissensübersicht konnte nicht aktualisiert werden.');
      await loadOverviewAudit();
    } finally {
      setRefreshingOverview(false);
    }
  };

  return (
    <>
      <AdminPageHeader
        title="Wissen"
        subtitle="Artikel schreiben, prüfen und veröffentlichen."
        meta={<AdminBadge tone="info">{totalArticles} Artikel</AdminBadge>}
      />

      <div className="mb-4">
        <AdminCard
          title="Öffentliche Wissensübersicht"
          subtitle="Materialisierte Karteikarten- und Badge-Daten für einen schnellen öffentlichen Aufruf."
          actions={(
            <div className="admin-toolbar-inline">
              <AdminButton size="sm" onClick={() => void loadOverviewAudit()} disabled={checkingOverview || refreshingOverview}>
                <RefreshCw size={14} />
                {checkingOverview ? 'Prüft...' : 'Abgleich prüfen'}
              </AdminButton>
              <AdminButton
                size="sm"
                variant="primary"
                onClick={() => void handleRefreshOverview()}
                disabled={!overviewAudit || !overviewAudit.available || overviewAudit.consistent || refreshingOverview}
              >
                <RefreshCw size={14} />
                {refreshingOverview ? 'Aktualisiert...' : 'Status aktualisieren'}
              </AdminButton>
            </div>
          )}
        >
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <AdminBadge tone={overviewAudit?.consistent ? 'ok' : overviewAudit?.available === false ? 'danger' : 'warn'}>
              {overviewAudit?.consistent
                ? 'Synchron'
                : overviewAudit?.available === false
                  ? 'Migration fehlt'
                  : overviewAudit
                    ? 'Abgleich nötig'
                    : 'Wird geprüft'}
            </AdminBadge>
            {overviewAudit && (
              <>
                <span className="admin-muted">
                  Projektion {overviewAudit.projected_record_count} / Quelle {overviewAudit.live_record_count} Datensätze
                </span>
                <span className="admin-muted">Quellversion {overviewAudit.source_version}</span>
                {overviewAudit.refreshed_at && (
                  <span className="admin-muted">
                    Aktualisiert {new Date(overviewAudit.refreshed_at).toLocaleString('de-DE')}
                  </span>
                )}
              </>
            )}
          </div>
        </AdminCard>
      </div>

      <div className="mb-4 admin-toolbar">
        <div className="admin-toolbar-inline">
          <label className="admin-toolbar-inline">
            <span className="admin-muted flex items-center gap-2 text-xs uppercase tracking-wide">
              <Search size={14} />
              Suchen
            </span>
            <input
              value={query}
              onChange={(event) => {
                setPage(1);
                setQuery(event.target.value);
              }}
              placeholder="Titel oder Slug suchen"
              className="admin-input"
            />
          </label>
          <label className="admin-toolbar-inline text-xs font-medium text-[color:var(--admin-ink-2)]">
            <span className="admin-muted">Status</span>
            <select
              value={status}
              onChange={(event) => {
                setPage(1);
                setStatus(event.target.value);
              }}
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
          <label className="admin-toolbar-inline text-xs font-medium text-[color:var(--admin-ink-2)]">
            <span className="admin-muted">Schicht</span>
            <select
              value={layer}
              onChange={(event) => {
                setPage(1);
                setLayer(event.target.value as AdminKnowledgeArticleLayer | '');
              }}
              className="admin-select"
              aria-label={filteredLayerLabel}
            >
              {LAYER_OPTIONS.map((option) => (
                <option key={option.value || 'all'} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label className="admin-toolbar-inline text-xs font-medium text-[color:var(--admin-ink-2)]">
            <span className="admin-muted">Pro Seite</span>
            <select
              value={limit}
              onChange={(event) => {
                setPage(1);
                setLimit(Number(event.target.value) as (typeof PAGE_SIZE_OPTIONS)[number]);
              }}
              className="admin-select"
              aria-label="Artikel pro Seite"
            >
              {PAGE_SIZE_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option}
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
        <AdminCard
          title="Artikel"
          subtitle={totalArticles > 0 ? `${listStart}-${listEnd} von ${totalArticles}` : 'Artikel auswählen oder neu anlegen.'}
          actions={(
            <div className="admin-toolbar-inline">
              <AdminButton
                size="sm"
                variant="ghost"
                onClick={() => setPage((current) => Math.max(1, current - 1))}
                disabled={loadingList || page <= 1}
                aria-label="Vorherige Artikelseite"
              >
                <ChevronLeft size={14} />
              </AdminButton>
              <span className="admin-muted text-xs">
                Seite {page} / {totalPages}
              </span>
              <AdminButton
                size="sm"
                variant="ghost"
                onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
                disabled={loadingList || page >= totalPages}
                aria-label="Nächste Artikelseite"
              >
                <ChevronRight size={14} />
              </AdminButton>
            </div>
          )}
          padded
        >
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
                    <div className="flex flex-shrink-0 flex-wrap justify-end gap-1">
                      <AdminBadge tone={layerTone(article.article_layer)}>{layerLabel(article.article_layer)}</AdminBadge>
                      <AdminBadge tone={statusTone(article.status)}>{statusLabel(article.status)}</AdminBadge>
                    </div>
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
              <div className="grid gap-3 lg:grid-cols-[minmax(200px,1fr)_140px_160px]">
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
                <label className="text-xs font-medium text-[color:var(--admin-ink-2)]">
                  Schicht
                  <select
                    value={draft.article_layer}
                    onChange={(event) => updateDraft('article_layer', event.target.value as AdminKnowledgeArticleLayer)}
                    className="admin-select mt-1"
                  >
                    {EDIT_LAYER_OPTIONS.map((option) => (
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

              {isSingleStudyArticle && (
                <div className="admin-study-interpretation-panel">
                  <div className="admin-study-interpretation-head">
                    <div>
                      <h3>Quellenbezug und optionale Bestandsdaten</h3>
                      <p>
                        Die neue Pipeline arbeitet mit Coverage-Plan und direkt aus der Quelle erfassten Fakten.
                        Bestehende strukturierte Auswertungen bleiben hier zur Nachvollziehbarkeit erhalten.
                      </p>
                    </div>
                    <div className="admin-study-interpretation-actions">
                      <AdminBadge tone="info">{studyInterpretations.length} Quellenbezüge</AdminBadge>
                      <AdminButton size="sm" onClick={startNewStudyInterpretation} disabled={isCreateMode}>
                        <FilePlus size={13} />
                        Neu
                      </AdminButton>
                    </div>
                  </div>

                  {isCreateMode ? (
                    <AdminEmpty>Speichere den Einzelstudien-Artikel zuerst. Danach können Quelle und optionale Bestandsdaten verknüpft werden.</AdminEmpty>
                  ) : loadingStudyInterpretations ? (
                    <AdminEmpty>Lade Quellenbezüge...</AdminEmpty>
                  ) : (
                    <>
                      {studyInterpretations.length > 0 && (
                        <div className="admin-study-interpretation-tabs">
                          {studyInterpretations.map((record) => (
                            <button
                              key={record.id}
                              type="button"
                              className={record.id === studyInterpretationDraft.id ? 'active' : undefined}
                              onClick={() => selectStudyInterpretation(record)}
                            >
                              <span>{record.source_title || `Quelle #${record.source_id}`}</span>
                              <AdminBadge tone={record.status === 'accepted' ? 'ok' : record.status === 'blocked' ? 'danger' : 'neutral'}>
                                {studyInterpretationStatusLabel(record.status)}
                              </AdminBadge>
                            </button>
                          ))}
                        </div>
                      )}

                      <div className="admin-study-interpretation-grid">
                        <label>
                          Wirkstoff-ID
                          <input
                            value={studyInterpretationDraft.ingredient_id}
                            onChange={(event) => updateStudyInterpretationDraft('ingredient_id', event.target.value)}
                            className="admin-input mt-1"
                            inputMode="numeric"
                          />
                        </label>
                        <label>
                          Quellen-ID
                          <input
                            value={studyInterpretationDraft.source_id}
                            onChange={(event) => updateStudyInterpretationDraft('source_id', event.target.value)}
                            className="admin-input mt-1"
                            inputMode="numeric"
                          />
                        </label>
                        <label>
                          Quellen-Evidenz
                          <input
                            value={sourceEvidenceLabel(selectedStudyInterpretation)}
                            className="admin-input mt-1"
                            readOnly
                          />
                        </label>
                        <label>
                          Forschungsartefakt-ID
                          <input
                            value={studyInterpretationDraft.research_artifact_id}
                            onChange={(event) => updateStudyInterpretationDraft('research_artifact_id', event.target.value)}
                            className="admin-input mt-1"
                            inputMode="numeric"
                            placeholder="Optional"
                          />
                        </label>
                        <label>
                          Status
                          <select
                            value={studyInterpretationDraft.status}
                            onChange={(event) => updateStudyInterpretationDraft('status', event.target.value as AdminStudyInterpretationStatus)}
                            className="admin-select mt-1"
                          >
                            {STUDY_INTERPRETATION_STATUS_OPTIONS.map((option) => (
                              <option key={option.value} value={option.value}>{option.label}</option>
                            ))}
                          </select>
                        </label>
                      </div>

                      <label className="admin-study-interpretation-field">
                        Optionale strukturierte Bestandsdaten (Legacy-JSON)
                        <textarea
                          value={studyInterpretationDraft.structured_summary_json}
                          onChange={(event) => updateStudyInterpretationDraft('structured_summary_json', event.target.value)}
                          rows={12}
                          className="admin-input mt-1 font-mono text-xs"
                          aria-describedby="study-interpretation-json-help"
                        />
                        <span id="study-interpretation-json-help" className="admin-study-interpretation-help">
                          Nur für vorhandene Legacy-Daten oder einen kompakten Provenienzverweis. Neue Quellenfakten werden im Coverage-/Source-Evidence-Flow geführt.
                        </span>
                        {isEmptyJsonObject(studyInterpretationDraft.structured_summary_json) && (
                          <span className="admin-study-interpretation-empty">Keine optionalen Bestandsdaten hinterlegt.</span>
                        )}
                      </label>

                      <label className="admin-study-interpretation-field">
                        Optionale redaktionelle Kurznotiz (Legacy)
                        <textarea
                          value={studyInterpretationDraft.stage3_reference_summary}
                          onChange={(event) => updateStudyInterpretationDraft('stage3_reference_summary', event.target.value)}
                          rows={4}
                          className="admin-input mt-1"
                          placeholder="Keine Kurznotiz hinterlegt"
                          aria-describedby="stage3-reference-summary-help"
                        />
                        <span id="stage3-reference-summary-help" className="admin-study-interpretation-help">
                          Kein Pflichtfeld und keine Faktengrundlage für neue Hauptartikel.
                        </span>
                        {!studyInterpretationDraft.stage3_reference_summary.trim() && (
                          <span className="admin-study-interpretation-empty">Keine optionale Kurznotiz hinterlegt.</span>
                        )}
                      </label>

                      <div className="admin-study-interpretation-grid admin-study-interpretation-grid-notes">
                        <label>
                          Notizen
                          <textarea
                            value={studyInterpretationDraft.notes}
                            onChange={(event) => updateStudyInterpretationDraft('notes', event.target.value)}
                            rows={3}
                            className="admin-input mt-1"
                          />
                        </label>
                        <label>
                          Review-Notizen
                          <textarea
                            value={studyInterpretationDraft.review_notes}
                            onChange={(event) => updateStudyInterpretationDraft('review_notes', event.target.value)}
                            rows={3}
                            className="admin-input mt-1"
                          />
                        </label>
                      </div>

                      <div className="admin-study-interpretation-save-row">
                        <AdminButton onClick={() => void handleSaveStudyInterpretation()} disabled={savingStudyInterpretation}>
                          <Save size={14} />
                          {savingStudyInterpretation ? 'Speichert...' : 'Quellenbezug speichern'}
                        </AdminButton>
                      </div>
                    </>
                  )}
                </div>
              )}

              <label className="text-xs font-medium text-[color:var(--admin-ink-2)]">
                Artikeltext
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
                {draft.ingredients.length > 0 && (
                  <div className="mt-3 border-t border-[color:var(--admin-line)] pt-3">
                    <h4 className="text-xs font-semibold uppercase tracking-wide text-[color:var(--admin-ink-2)]">Sub-Wirkstoff-Verknüpfungen</h4>
                    <p className="admin-muted mt-1 text-xs">Nur auswählen, wenn der Artikel diesen Sub-Wirkstoff tatsächlich behandelt.</p>
                    {loadingKnowledgeParts ? <p className="admin-muted mt-2 text-xs">Lade Verknüpfungen...</p> : null}
                    <div className="mt-2 grid gap-2">
                      {draft.ingredients.map((ingredient) => {
                        const options = ingredientPartOptions[ingredient.ingredient_id] ?? [];
                        const historical = knowledgePartLinks.filter((link) => (
                          link.ingredient_id === ingredient.ingredient_id
                          && !options.some((option) => option.part_id === link.part_id)
                        ));
                        if (options.length === 0 && historical.length === 0) return null;
                        return (
                          <fieldset key={`parts-${ingredient.ingredient_id}`} className="rounded-[var(--admin-r-sm)] border border-[color:var(--admin-line)] p-2">
                            <legend className="px-1 text-xs font-semibold">{ingredient.name ?? `Wirkstoff ${ingredient.ingredient_id}`}</legend>
                            <div className="flex flex-wrap gap-2">
                              {[...options.map((part) => ({
                                ...part,
                                historical: false,
                              })), ...historical.map((part) => ({
                                ingredient_id: part.ingredient_id,
                                part_id: part.part_id,
                                part_name: part.part_name,
                                part_type: part.part_type,
                                part_status: part.part_status,
                                sort_order: part.sort_order,
                                created_at: null,
                                historical: true,
                              }))].map((part) => {
                                const checked = knowledgePartLinks.some((link) => link.ingredient_id === ingredient.ingredient_id && link.part_id === part.part_id);
                                return (
                                  <label key={part.part_id} className="admin-input inline-flex min-h-[38px] items-center gap-2 text-xs">
                                    <input type="checkbox" checked={checked} onChange={() => toggleKnowledgePart(ingredient.ingredient_id, ingredient.name, part)} />
                                    {part.part_name}
                                    {part.historical ? <AdminBadge tone="warn">historisch</AdminBadge> : null}
                                  </label>
                                );
                              })}
                            </div>
                          </fieldset>
                        );
                      })}
                    </div>
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
