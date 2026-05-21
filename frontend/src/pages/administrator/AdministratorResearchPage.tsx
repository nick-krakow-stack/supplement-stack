import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Archive,
  BookOpen,
  CheckCircle2,
  CircleDot,
  ClipboardCheck,
  FileText,
  Loader2,
  Plus,
  RefreshCw,
  Save,
  Search,
  XCircle,
} from 'lucide-react';
import {
  createAdminResearchPipelineArtifact,
  createAdminResearchPipelineKnowledgeDraft,
  createIngredientResearchSource,
  getAdminResearchPipelineDetail,
  getAdminResearchPipelineOverview,
  setAdminResearchPipelineArtifactStatus,
  setAdminResearchPipelineStageStatus,
  updateAdminResearchPipelineArtifact,
  type AdminIngredientResearchSource,
  type AdminIngredientResearchSourcePayload,
  type AdminResearchPipelineArtifact,
  type AdminResearchPipelineDetail,
  type AdminResearchPipelineOverviewItem,
  type AdminResearchPipelineStage,
  type AdminResearchPipelineStageKey,
  type AdminResearchPipelineStatus,
} from '../../api/admin';
import { AdminBadge, AdminButton, AdminCard, AdminEmpty, AdminError, AdminPageHeader, type AdminTone } from './AdminUi';

type StageConfig = {
  key: AdminResearchPipelineStageKey;
  label: string;
  shortLabel: string;
  description: string;
};

type ArtifactDraft = {
  stage: AdminResearchPipelineStageKey;
  title: string;
  content: string;
  evidence_strength: string;
  source_ids: number[];
};

type SourceDraft = {
  source_kind: string;
  source_title: string;
  source_url: string;
  organization: string;
  evidence_quality: string;
  evidence_grade: string;
  notes: string;
  doi: string;
  pubmed_id: string;
};

const STAGES: StageConfig[] = [
  {
    key: 'research',
    label: 'Research-Durchlauf',
    shortLabel: 'Research',
    description: 'Evidenzsammlung und Quellenlage.',
  },
  {
    key: 'interpretation',
    label: 'Interpreter-Durchlauf',
    shortLabel: 'Interpreter',
    description: 'Methodische Einordnung der Studien.',
  },
  {
    key: 'writer',
    label: 'Writer-Durchlauf',
    shortLabel: 'Writer',
    description: 'Freigegebener Website-Entwurf.',
  },
];

const STATUS_OPTIONS: Array<{ value: AdminResearchPipelineStatus; label: string; tone: AdminTone }> = [
  { value: 'not_started', label: 'Nicht gestartet', tone: 'neutral' },
  { value: 'draft', label: 'Entwurf', tone: 'neutral' },
  { value: 'pending', label: 'Offen', tone: 'neutral' },
  { value: 'pending_review', label: 'Zur Pruefung', tone: 'info' },
  { value: 'in_progress', label: 'In Arbeit', tone: 'info' },
  { value: 'needs_changes', label: 'Aenderungen', tone: 'warn' },
  { value: 'approved', label: 'Freigegeben', tone: 'ok' },
  { value: 'archived', label: 'Archiviert', tone: 'neutral' },
];

const EVIDENCE_STRENGTHS = ['STARK', 'MODERAT', 'SCHWACH', 'UNZUREICHEND'] as const;

const EMPTY_SOURCE_DRAFT: SourceDraft = {
  source_kind: 'study',
  source_title: '',
  source_url: '',
  organization: '',
  evidence_quality: '',
  evidence_grade: '',
  notes: '',
  doi: '',
  pubmed_id: '',
};

function emptyArtifactDraft(stage: AdminResearchPipelineStageKey): ArtifactDraft {
  return {
    stage,
    title: '',
    content: '',
    evidence_strength: '',
    source_ids: [],
  };
}

function artifactToDraft(artifact: AdminResearchPipelineArtifact): ArtifactDraft {
  return {
    stage: artifact.stage,
    title: artifact.title ?? '',
    content: artifact.content ?? '',
    evidence_strength: artifact.evidence_strength ?? '',
    source_ids: artifact.source_ids,
  };
}

function artifactDraftEquals(left: ArtifactDraft, right: ArtifactDraft): boolean {
  return left.stage === right.stage &&
    left.title === right.title &&
    left.content === right.content &&
    left.evidence_strength === right.evidence_strength &&
    left.source_ids.length === right.source_ids.length &&
    left.source_ids.every((value, index) => value === right.source_ids[index]);
}

function getErrorMessage(error: unknown): string {
  const response = (error as { response?: { data?: unknown } } | null)?.response;
  const data = response?.data && typeof response.data === 'object' ? response.data as Record<string, unknown> : null;
  const apiError = typeof data?.error === 'string' ? data.error : null;
  if (apiError) return apiError;
  if (error instanceof Error) return error.message;
  return 'Die Anfrage ist fehlgeschlagen.';
}

function statusLabel(status?: string | null): string {
  return STATUS_OPTIONS.find((option) => option.value === status)?.label ?? status ?? 'Offen';
}

function statusTone(status?: string | null): AdminTone {
  return STATUS_OPTIONS.find((option) => option.value === status)?.tone ?? 'neutral';
}

function stageConfig(stage: AdminResearchPipelineStageKey): StageConfig {
  return STAGES.find((entry) => entry.key === stage) ?? STAGES[0];
}

function stageStatus(stages: AdminResearchPipelineStage[], stage: AdminResearchPipelineStageKey): AdminResearchPipelineStage | null {
  return stages.find((entry) => entry.stage === stage) ?? null;
}

function sourceTitle(source: AdminIngredientResearchSource): string {
  return source.source_title || source.source_url || `Quelle #${source.id}`;
}

function formatDate(value?: string | null): string {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('de-DE', { dateStyle: 'short', timeStyle: 'short' }).format(date);
}

function sourceDraftToPayload(form: SourceDraft): AdminIngredientResearchSourcePayload {
  const sourceKind = form.source_kind.trim().toLowerCase();
  return {
    source_kind: sourceKind === 'official' ? 'official' : 'study',
    source_title: form.source_title.trim() || null,
    source_url: form.source_url.trim() || null,
    organization: form.organization.trim() || null,
    evidence_quality: form.evidence_quality.trim() || null,
    evidence_grade: form.evidence_grade.trim().toUpperCase() || null,
    notes: form.notes.trim() || null,
    doi: form.doi.trim() || null,
    pubmed_id: form.pubmed_id.trim() || null,
  };
}

export default function AdministratorResearchPage() {
  const [items, setItems] = useState<AdminResearchPipelineOverviewItem[]>([]);
  const [selectedIngredientId, setSelectedIngredientId] = useState<number | null>(null);
  const [detail, setDetail] = useState<AdminResearchPipelineDetail | null>(null);
  const [activeStage, setActiveStage] = useState<AdminResearchPipelineStageKey>('research');
  const [selectedArtifactId, setSelectedArtifactId] = useState<number | null>(null);
  const [artifactDraft, setArtifactDraft] = useState<ArtifactDraft>(() => emptyArtifactDraft('research'));
  const [sourceDraft, setSourceDraft] = useState<SourceDraft>(EMPTY_SOURCE_DRAFT);
  const [query, setQuery] = useState('');
  const [overviewLoading, setOverviewLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [artifactSaving, setArtifactSaving] = useState(false);
  const [sourceSaving, setSourceSaving] = useState(false);
  const [statusSaving, setStatusSaving] = useState<string | null>(null);
  const [draftCreating, setDraftCreating] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const filteredItems = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return items;
    return items.filter((item) => item.ingredient.name.toLowerCase().includes(needle));
  }, [items, query]);

  const selectedArtifact = useMemo(
    () => detail?.artifacts.find((artifact) => artifact.id === selectedArtifactId) ?? null,
    [detail, selectedArtifactId],
  );

  const activeStageStatus = useMemo(
    () => detail ? stageStatus(detail.stages, activeStage) : null,
    [activeStage, detail],
  );

  const activeStageArtifacts = useMemo(
    () => detail?.artifacts.filter((artifact) => artifact.stage === activeStage) ?? [],
    [activeStage, detail],
  );

  const overviewCounts = useMemo(
    () => ({
      vitamins: items.length,
      artifacts: items.reduce((sum, item) => sum + item.artifact_count, 0),
      sources: items.reduce((sum, item) => sum + item.source_count, 0),
    }),
    [items],
  );

  const loadOverview = useCallback(async () => {
    setOverviewLoading(true);
    setError('');
    try {
      const response = await getAdminResearchPipelineOverview();
      setItems(response.items);
      setSelectedIngredientId((previous) => previous ?? response.items[0]?.ingredient.id ?? null);
    } catch (errorValue) {
      setItems([]);
      setError(getErrorMessage(errorValue));
    } finally {
      setOverviewLoading(false);
    }
  }, []);

  const loadDetail = useCallback(async (ingredientId: number) => {
    setDetailLoading(true);
    setError('');
    try {
      const nextDetail = await getAdminResearchPipelineDetail(ingredientId);
      setDetail(nextDetail);
    } catch (errorValue) {
      setDetail(null);
      setError(getErrorMessage(errorValue));
    } finally {
      setDetailLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadOverview();
  }, [loadOverview]);

  useEffect(() => {
    if (selectedIngredientId === null) {
      setDetail(null);
      return;
    }
    void loadDetail(selectedIngredientId);
  }, [loadDetail, selectedIngredientId]);

  useEffect(() => {
    const artifact = detail?.artifacts.find((entry) => entry.id === selectedArtifactId && entry.stage === activeStage) ?? null;
    if (artifact) {
      const nextDraft = artifactToDraft(artifact);
      setArtifactDraft((previous) => artifactDraftEquals(previous, nextDraft) ? previous : nextDraft);
      return;
    }

    const firstStageArtifact = detail?.artifacts.find((entry) => entry.stage === activeStage) ?? null;
    if (selectedArtifactId !== null) {
      setSelectedArtifactId(firstStageArtifact?.id ?? null);
      setArtifactDraft(firstStageArtifact ? artifactToDraft(firstStageArtifact) : emptyArtifactDraft(activeStage));
      return;
    }

    const draftIsEmpty =
      !artifactDraft.title.trim() &&
      !artifactDraft.content.trim() &&
      !artifactDraft.evidence_strength.trim() &&
      artifactDraft.source_ids.length === 0;
    if (firstStageArtifact && (artifactDraft.stage !== activeStage || draftIsEmpty)) {
      setSelectedArtifactId(firstStageArtifact.id);
      setArtifactDraft(artifactToDraft(firstStageArtifact));
      return;
    }

    setArtifactDraft((previous) => (
      previous.stage === activeStage ? previous : emptyArtifactDraft(activeStage)
    ));
  }, [activeStage, artifactDraft, detail, selectedArtifactId]);

  const updateArtifactDraft = <K extends keyof ArtifactDraft>(field: K, value: ArtifactDraft[K]) => {
    setArtifactDraft((previous) => ({ ...previous, [field]: value }));
  };

  const updateSourceDraft = <K extends keyof SourceDraft>(field: K, value: SourceDraft[K]) => {
    setSourceDraft((previous) => ({ ...previous, [field]: value }));
  };

  const refreshSelectedDetail = async () => {
    if (selectedIngredientId === null) return;
    await Promise.all([loadDetail(selectedIngredientId), loadOverview()]);
  };

  const handleSelectArtifact = (artifact: AdminResearchPipelineArtifact | null) => {
    setSelectedArtifactId(artifact?.id ?? null);
    setArtifactDraft(artifact ? artifactToDraft(artifact) : emptyArtifactDraft(activeStage));
    setError('');
    setMessage('');
  };

  const handleToggleSource = (sourceId: number, checked: boolean) => {
    setArtifactDraft((previous) => ({
      ...previous,
      source_ids: checked
        ? [...new Set([...previous.source_ids, sourceId])]
        : previous.source_ids.filter((id) => id !== sourceId),
    }));
  };

  const handleSaveArtifact = async () => {
    if (selectedIngredientId === null) return;
    if (!artifactDraft.content.trim()) {
      setError('Agent-Ausgabe ist erforderlich.');
      return;
    }

    setArtifactSaving(true);
    setError('');
    setMessage('');
    try {
      const payload = {
        ...artifactDraft,
        title: artifactDraft.title.trim() || stageConfig(artifactDraft.stage).label,
        evidence_strength: artifactDraft.evidence_strength.trim() || null,
      };
      const saved = selectedArtifact
        ? await updateAdminResearchPipelineArtifact(
            selectedArtifact.id,
            { ...payload, version: selectedArtifact.version },
            { version: selectedArtifact.version },
          )
        : await createAdminResearchPipelineArtifact(selectedIngredientId, payload);
      setSelectedArtifactId(saved.id);
      setArtifactDraft(artifactToDraft(saved));
      await refreshSelectedDetail();
      setMessage('Forschungsartefakt gespeichert.');
    } catch (errorValue) {
      setError(getErrorMessage(errorValue));
    } finally {
      setArtifactSaving(false);
    }
  };

  const handleArtifactStatus = async (status: AdminResearchPipelineStatus) => {
    if (!selectedArtifact) return;
    setStatusSaving(`artifact:${status}`);
    setError('');
    setMessage('');
    try {
      await setAdminResearchPipelineArtifactStatus(
        selectedArtifact.id,
        { status, version: selectedArtifact.version },
        { version: selectedArtifact.version },
      );
      await refreshSelectedDetail();
      setMessage(`Artefaktstatus: ${statusLabel(status)}.`);
    } catch (errorValue) {
      setError(getErrorMessage(errorValue));
    } finally {
      setStatusSaving(null);
    }
  };

  const handleStageStatus = async (status: AdminResearchPipelineStatus) => {
    if (selectedIngredientId === null) return;
    setStatusSaving(`stage:${status}`);
    setError('');
    setMessage('');
    try {
      await setAdminResearchPipelineStageStatus(
        selectedIngredientId,
        activeStage,
        { status, version: activeStageStatus?.version ?? null },
        { version: activeStageStatus?.version ?? null },
      );
      await refreshSelectedDetail();
      setMessage(`Durchlaufstatus: ${statusLabel(status)}.`);
    } catch (errorValue) {
      setError(getErrorMessage(errorValue));
    } finally {
      setStatusSaving(null);
    }
  };

  const handleCreateKnowledgeDraft = async () => {
    if (!selectedArtifact || selectedArtifact.stage !== 'writer') return;
    setDraftCreating(true);
    setError('');
    setMessage('');
    try {
      const response = await createAdminResearchPipelineKnowledgeDraft(selectedArtifact.id);
      await refreshSelectedDetail();
      setMessage(response.slug ? `Wissensdatenbank-Entwurf erstellt: ${response.slug}.` : 'Wissensdatenbank-Entwurf erstellt.');
    } catch (errorValue) {
      setError(getErrorMessage(errorValue));
    } finally {
      setDraftCreating(false);
    }
  };

  const handleCreateSource = async () => {
    if (selectedIngredientId === null) return;
    if (!sourceDraft.source_title.trim() && !sourceDraft.source_url.trim()) {
      setError('Quelle braucht mindestens Titel oder Link.');
      return;
    }

    setSourceSaving(true);
    setError('');
    setMessage('');
    try {
      const created = await createIngredientResearchSource(selectedIngredientId, sourceDraftToPayload(sourceDraft));
      setDetail((previous) => previous ? { ...previous, sources: [...previous.sources, created] } : previous);
      setSourceDraft(EMPTY_SOURCE_DRAFT);
      setMessage('Quelle hinzugefuegt.');
    } catch (errorValue) {
      setError(getErrorMessage(errorValue));
    } finally {
      setSourceSaving(false);
    }
  };

  const selectedItem = useMemo(
    () => items.find((item) => item.ingredient.id === selectedIngredientId) ?? null,
    [items, selectedIngredientId],
  );

  return (
    <div className="admin-research-workspace">
      <AdminPageHeader
        title="Forschung"
        subtitle="Agent-Ausgaben landen zuerst hier, werden redaktionell freigegeben und erst danach explizit in die Wissensdatenbank ueberfuehrt."
        meta={
          <div className="flex flex-wrap gap-2">
            <AdminBadge tone="info">{overviewCounts.vitamins} Vitamine</AdminBadge>
            <AdminBadge>{overviewCounts.artifacts} Artefakte</AdminBadge>
            <AdminBadge>{overviewCounts.sources} Quellen</AdminBadge>
          </div>
        }
      />

      {error ? <AdminError>{error}</AdminError> : null}
      {message ? <div className="admin-success">{message}</div> : null}

      <div className="admin-research-layout">
        <AdminCard
          title="Pipeline"
          subtitle="Vitamin auswaehlen und Durchlaufstatus pruefen."
          actions={
            <button
              type="button"
              className="admin-icon-btn"
              onClick={() => void loadOverview()}
              disabled={overviewLoading}
              aria-label="Forschung aktualisieren"
              title="Aktualisieren"
            >
              {overviewLoading ? <Loader2 size={15} className="animate-spin" /> : <RefreshCw size={15} />}
            </button>
          }
        >
          <div className="admin-card-pad">
            <label className="admin-filter-field admin-filter-search-field">
              <span className="admin-filter-label">Suchen</span>
              <span className="admin-filter-search-with-icon relative block">
                <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[color:var(--admin-ink-3)]" />
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  className="admin-input admin-filter-search pl-9"
                  placeholder="Vitamin suchen"
                />
              </span>
            </label>
          </div>

          <div className="admin-research-overview-list">
            {overviewLoading && items.length === 0 ? (
              <AdminEmpty>Lade Forschungspipeline...</AdminEmpty>
            ) : filteredItems.length === 0 ? (
              <AdminEmpty>Keine Vitamine gefunden.</AdminEmpty>
            ) : (
              filteredItems.map((item) => (
                <button
                  type="button"
                  key={item.ingredient.id}
                  className={`admin-research-overview-item${item.ingredient.id === selectedIngredientId ? ' active' : ''}`}
                  onClick={() => setSelectedIngredientId(item.ingredient.id)}
                >
                  <span className="admin-research-overview-main">
                    <strong>{item.ingredient.name}</strong>
                    <small>{item.source_count} Quellen · {item.artifact_count} Artefakte</small>
                  </span>
                  <span className="admin-research-mini-stages" aria-label={`Forschungsstatus ${item.ingredient.name}`}>
                    {STAGES.map((stage) => {
                      const status = stageStatus(item.stages, stage.key);
                      return (
                        <AdminBadge key={stage.key} tone={statusTone(status?.status)}>
                          {stage.shortLabel}: {statusLabel(status?.status)}
                        </AdminBadge>
                      );
                    })}
                  </span>
                </button>
              ))
            )}
          </div>
        </AdminCard>

        <div className="admin-research-detail">
          {!selectedItem ? (
            <AdminCard padded>
              <AdminEmpty>Vitamin aus der Liste auswaehlen.</AdminEmpty>
            </AdminCard>
          ) : (
            <>
              <AdminCard
                title={detail?.ingredient.name ?? selectedItem.ingredient.name}
                subtitle="Dreistufige Freigabe vor Wissensdatenbank und Veroeffentlichung."
              >
                <div className="admin-card-pad">
                  {detailLoading ? (
                    <div className="admin-muted flex items-center gap-2 text-sm">
                      <Loader2 size={15} className="animate-spin" />
                      Lade Forschungsdetails...
                    </div>
                  ) : null}

                  <div className="admin-research-stage-checklist">
                    {STAGES.map((stage) => {
                      const status = detail ? stageStatus(detail.stages, stage.key) : stageStatus(selectedItem.stages, stage.key);
                      const stageArtifacts = detail?.artifacts.filter((artifact) => artifact.stage === stage.key).length ?? 0;
                      return (
                        <button
                          type="button"
                          key={stage.key}
                          className={`admin-research-stage-card${activeStage === stage.key ? ' active' : ''}`}
                          onClick={() => setActiveStage(stage.key)}
                        >
                          <span className="admin-research-stage-icon">
                            {status?.status === 'approved' ? <CheckCircle2 size={18} /> : <CircleDot size={18} />}
                          </span>
                          <span>
                            <strong>{stage.label}</strong>
                            <small>{stage.description}</small>
                            <span className="admin-research-stage-meta">
                              <AdminBadge tone={statusTone(status?.status)}>{statusLabel(status?.status)}</AdminBadge>
                              <AdminBadge>{stageArtifacts || status?.artifact_count || 0} Artefakte</AdminBadge>
                            </span>
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </AdminCard>

              <div className="admin-research-editor-grid">
                <AdminCard
                  title={`${stageConfig(activeStage).label}: Agent-Ausgabe`}
                  subtitle="Output einfuegen, Evidenzstaerke setzen, Quellen anhaken und zur Pruefung speichern."
                  actions={
                    <AdminButton size="sm" variant="ghost" onClick={() => handleSelectArtifact(null)}>
                      <Plus size={14} />
                      Neu
                    </AdminButton>
                  }
                >
                  <div className="admin-card-pad">
                    <div className="admin-research-artifact-tabs">
                      {activeStageArtifacts.map((artifact) => (
                        <button
                          type="button"
                          key={artifact.id}
                          className={artifact.id === selectedArtifactId ? 'active' : undefined}
                          onClick={() => handleSelectArtifact(artifact)}
                        >
                          <FileText size={14} />
                          <span>{artifact.title || `Artefakt #${artifact.id}`}</span>
                          <AdminBadge tone={statusTone(artifact.status)}>{statusLabel(artifact.status)}</AdminBadge>
                        </button>
                      ))}
                      {activeStageArtifacts.length === 0 ? (
                        <span className="admin-muted text-xs">Noch kein Artefakt fuer diesen Durchlauf.</span>
                      ) : null}
                    </div>

                    <div className="admin-research-form-grid mt-4">
                      <label>
                        <span>Titel</span>
                        <input
                          className="admin-input"
                          value={artifactDraft.title}
                          onChange={(event) => updateArtifactDraft('title', event.target.value)}
                          placeholder={stageConfig(activeStage).label}
                        />
                      </label>
                      <label>
                        <span>Evidenzstaerke</span>
                        <select
                          className="admin-select"
                          value={artifactDraft.evidence_strength}
                          onChange={(event) => updateArtifactDraft('evidence_strength', event.target.value)}
                        >
                          <option value="">Nicht gesetzt</option>
                          {EVIDENCE_STRENGTHS.map((strength) => (
                            <option key={strength} value={strength}>{strength}</option>
                          ))}
                        </select>
                      </label>
                    </div>

                    <label className="admin-research-output-field">
                      <span>Agent-Ausgabe</span>
                      <textarea
                        className="admin-input"
                        value={artifactDraft.content}
                        onChange={(event) => updateArtifactDraft('content', event.target.value)}
                        rows={18}
                        placeholder="Markdown, strukturierte Analyse oder Writer-Text einfuegen"
                      />
                    </label>

                    <div className="admin-research-actions">
                      <AdminButton onClick={() => void handleSaveArtifact()} disabled={artifactSaving}>
                        {artifactSaving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
                        Speichern
                      </AdminButton>
                      <AdminButton
                        variant="ghost"
                        onClick={() => void handleStageStatus('in_progress')}
                        disabled={statusSaving !== null}
                      >
                        <ClipboardCheck size={15} />
                        Durchlauf starten
                      </AdminButton>
                      <AdminButton
                        variant="ghost"
                        onClick={() => void handleStageStatus('approved')}
                        disabled={statusSaving !== null}
                      >
                        <CheckCircle2 size={15} />
                        Durchlauf freigeben
                      </AdminButton>
                    </div>

                    {selectedArtifact ? (
                      <div className="admin-research-status-actions" aria-label="Artefaktstatus setzen">
                        <AdminButton
                          size="sm"
                          variant="ghost"
                          onClick={() => void handleArtifactStatus('approved')}
                          disabled={statusSaving !== null}
                        >
                          <CheckCircle2 size={14} />
                          Freigeben
                        </AdminButton>
                        <AdminButton
                          size="sm"
                          variant="ghost"
                          onClick={() => void handleArtifactStatus('needs_changes')}
                          disabled={statusSaving !== null}
                        >
                          <XCircle size={14} />
                          Aenderungen anfordern
                        </AdminButton>
                        <AdminButton
                          size="sm"
                          variant="ghost"
                          onClick={() => void handleArtifactStatus('archived')}
                          disabled={statusSaving !== null}
                        >
                          <Archive size={14} />
                          Archivieren
                        </AdminButton>
                        {selectedArtifact.stage === 'writer' ? (
                          <AdminButton
                            size="sm"
                            onClick={() => void handleCreateKnowledgeDraft()}
                            disabled={draftCreating || selectedArtifact.status !== 'approved'}
                          >
                            {draftCreating ? <Loader2 size={14} className="animate-spin" /> : <BookOpen size={14} />}
                            Wissensdatenbank-Entwurf erstellen
                          </AdminButton>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                </AdminCard>

                <AdminCard title="Quellen" subtitle="Bestehende Research-Quellen an das Artefakt haengen.">
                  <div className="admin-card-pad">
                    <div className="admin-research-source-checklist">
                      {detail?.sources.length ? (
                        detail.sources.map((source) => (
                          <label key={source.id} className="admin-research-source-row">
                            <input
                              type="checkbox"
                              checked={artifactDraft.source_ids.includes(source.id)}
                              onChange={(event) => handleToggleSource(source.id, event.target.checked)}
                            />
                            <span>
                              <strong>{sourceTitle(source)}</strong>
                              <small>
                                {source.source_kind || 'Quelle'} · {source.evidence_quality || source.evidence_grade || 'ohne Einstufung'}
                              </small>
                            </span>
                          </label>
                        ))
                      ) : (
                        <AdminEmpty>Keine Quellen vorhanden.</AdminEmpty>
                      )}
                    </div>

                    <div className="admin-research-source-create">
                      <h3>Quelle hinzufuegen</h3>
                      <div className="admin-research-form-grid">
                        <label>
                          <span>Art</span>
                          <select
                            className="admin-select"
                            value={sourceDraft.source_kind}
                            onChange={(event) => updateSourceDraft('source_kind', event.target.value)}
                        >
                          <option value="study">Studie</option>
                          <option value="official">Offizielle Quelle</option>
                        </select>
                      </label>
                        <label>
                          <span>Titel</span>
                          <input
                            className="admin-input"
                            value={sourceDraft.source_title}
                            onChange={(event) => updateSourceDraft('source_title', event.target.value)}
                          />
                        </label>
                        <label>
                          <span>Link</span>
                          <input
                            className="admin-input"
                            value={sourceDraft.source_url}
                            onChange={(event) => updateSourceDraft('source_url', event.target.value)}
                          />
                        </label>
                        <label>
                          <span>Organisation</span>
                          <input
                            className="admin-input"
                            value={sourceDraft.organization}
                            onChange={(event) => updateSourceDraft('organization', event.target.value)}
                          />
                        </label>
                        <label>
                          <span>Qualitaet</span>
                          <input
                            className="admin-input"
                            value={sourceDraft.evidence_quality}
                            onChange={(event) => updateSourceDraft('evidence_quality', event.target.value)}
                          />
                        </label>
                        <label>
                          <span>Stufe</span>
                          <input
                            className="admin-input"
                            value={sourceDraft.evidence_grade}
                            onChange={(event) => updateSourceDraft('evidence_grade', event.target.value)}
                          />
                        </label>
                        <label>
                          <span>DOI</span>
                          <input
                            className="admin-input"
                            value={sourceDraft.doi}
                            onChange={(event) => updateSourceDraft('doi', event.target.value)}
                          />
                        </label>
                        <label>
                          <span>PubMed</span>
                          <input
                            className="admin-input"
                            value={sourceDraft.pubmed_id}
                            onChange={(event) => updateSourceDraft('pubmed_id', event.target.value)}
                          />
                        </label>
                      </div>
                      <label className="admin-research-output-field">
                        <span>Notiz</span>
                        <textarea
                          className="admin-input"
                          value={sourceDraft.notes}
                          onChange={(event) => updateSourceDraft('notes', event.target.value)}
                          rows={4}
                        />
                      </label>
                      <AdminButton onClick={() => void handleCreateSource()} disabled={sourceSaving}>
                        {sourceSaving ? <Loader2 size={15} className="animate-spin" /> : <Plus size={15} />}
                        Quelle anlegen
                      </AdminButton>
                    </div>
                  </div>
                </AdminCard>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
